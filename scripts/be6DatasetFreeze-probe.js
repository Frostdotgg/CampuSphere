'use strict';

/*
 * BE.6 selected-demo dataset freeze verifier.
 *
 * Live access is SELECT-only. This probe never applies SQL, invokes an RPC,
 * writes a baseline, or mutates application data. Cross-backend comparison
 * uses canonical names, node keys, edge endpoints, and scene keys only.
 */

require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { getSupabaseClient, hasSupabaseConfig } = require('../config/supabase');
const { SELECTED_DEMO_FREEZE } = require('../config/selectedDemoFreeze');
const { GUIDED_VR_ROUTES, DEFERRED_GUIDED_VR_DESTINATIONS } = require('../config/guidedVrRoutes');
const sourceData = require('../models/data');
const {
  analyzeState,
  fingerprint,
  positiveInt
} = require('./applyBe5SelectedDemoParityMysql');
const {
  SELECTED_KEYS,
  GUIDED_KEYS,
  INTERIOR_KEYS,
  CAS_SCHEDULE,
  buildPlan,
  planIsFullyPresent,
  semanticScopeFingerprint
} = require('./syncSelectedCasVrSupabaseToMysql');
const { verifyGuidedChain } = require('../services/guidedVrResolution');
const { canonicalKey } = require('../services/routeAvailability');
const { findShortestPath } = require('../utils/pathfinding');

const MIGRATION_DIR = path.join(__dirname, '..', 'database', 'supabase');
const failures = [];
let checks = 0;

function check(scope, label, ok) {
  checks += 1;
  const pass = ok === true;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!pass) failures.push(`${scope} :: ${label}`);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = stableValue(value[key]);
      return out;
    }, {});
  }
  return value;
}

function sameValue(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function migrationRecords() {
  return fs.readdirSync(MIGRATION_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => [
      name,
      crypto.createHash('sha256').update(fs.readFileSync(path.join(MIGRATION_DIR, name))).digest('hex')
    ]);
}

function requiredString(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function policySnapshot(activeRoutes, deferredDestinations) {
  const active = Array.isArray(activeRoutes) ? activeRoutes : [];
  const deferred = Array.isArray(deferredDestinations) ? deferredDestinations : [];
  const seenNames = new Set();
  const seenNodes = new Set();
  const blockers = [];

  const normalizedActive = active.map((entry) => {
    const name = requiredString(entry && entry.destination_name);
    const nodeKey = requiredString(entry && entry.destination_node_key);
    const arrivalKey = requiredString(entry && entry.arrival_scene_key);
    const keys = Array.isArray(entry && entry.scene_keys) ? [...entry.scene_keys] : [];
    const canonical = name ? canonicalKey(name) : '';
    if (!name || !canonical || !nodeKey || !arrivalKey || keys.length === 0) {
      blockers.push('active guided policy has missing natural identity metadata.');
    }
    if (new Set(keys).size !== keys.length || keys.some((key) => !requiredString(key))) {
      blockers.push('active guided policy has duplicate or invalid scene keys.');
    }
    if (keys[keys.length - 1] !== arrivalKey) blockers.push('active guided arrival is not the final configured scene.');
    if (canonical && seenNames.has(canonical)) blockers.push('guided policy has a duplicate canonical destination.');
    if (nodeKey && seenNodes.has(nodeKey)) blockers.push('guided policy has a duplicate destination node key.');
    if (canonical) seenNames.add(canonical);
    if (nodeKey) seenNodes.add(nodeKey);
    return {
      destination_name: name,
      destination_node_key: nodeKey,
      arrival_scene_key: arrivalKey,
      scene_keys: keys
    };
  });

  const normalizedDeferred = deferred.map((entry) => {
    const name = requiredString(entry && entry.destination_name);
    const nodeKey = requiredString(entry && entry.destination_node_key);
    const canonical = name ? canonicalKey(name) : '';
    if (!name || !canonical || !nodeKey) blockers.push('deferred guided policy has missing natural identity metadata.');
    if (canonical && seenNames.has(canonical)) blockers.push('guided policy overlaps or duplicates a canonical destination.');
    if (nodeKey && seenNodes.has(nodeKey)) blockers.push('guided policy overlaps or duplicates a destination node key.');
    if (canonical) seenNames.add(canonical);
    if (nodeKey) seenNodes.add(nodeKey);
    return { destination_name: name, destination_node_key: nodeKey };
  });

  normalizedActive.sort((a, b) => String(a.destination_node_key).localeCompare(String(b.destination_node_key)));
  normalizedDeferred.sort((a, b) => String(a.destination_node_key).localeCompare(String(b.destination_node_key)));

  return {
    blockers: [...new Set(blockers)],
    snapshot: {
      active_routes: normalizedActive,
      deferred_destinations: normalizedDeferred,
      interior_scene_keys: [...INTERIOR_KEYS],
      schedule_target: { ...CAS_SCHEDULE }
    }
  };
}

function selectedLinks(backend) {
  const allSceneKeyById = new Map();
  for (const row of (backend.allScenes || [])) {
    const id = positiveInt(row.id);
    const key = requiredString(row.scene_key);
    if (id !== null && key) allSceneKeyById.set(id, key);
  }
  return (backend.hotspots || [])
    .filter((row) => row && row.hotspot_type === 'scene')
    .map((row) => ({
      fromKey: allSceneKeyById.get(positiveInt(row.scene_id)) || null,
      toKey: allSceneKeyById.get(positiveInt(row.target_scene_id)) || null
    }));
}

function routeCounts(analysis) {
  const m = analysis.metrics;
  return {
    buildings: m.buildings,
    route_nodes: m.nodes,
    route_edges: m.edges,
    reverse_pairs: m.pairs,
    valid_geometries: m.geometries,
    exact_reverse_geometries: m.exactReverse,
    routable_destinations: m.routable
  };
}

function expectedCore(candidate) {
  return {
    schema_version: candidate.schema_version,
    migrations: candidate.migrations,
    counts: candidate.counts,
    roster: candidate.roster,
    policy: candidate.policy,
    fingerprints: {
      migrations: candidate.fingerprints.migrations,
      building_route: candidate.fingerprints.building_route,
      selected_vr: candidate.fingerprints.selected_vr,
      guided_policy: candidate.fingerprints.guided_policy
    }
  };
}

function buildCandidate(routeState, vrBackend, totals, migrations, policyResult) {
  const route = analyzeState(routeState);
  if (route.blockers.length || !route.snapshot || !route.metrics) {
    throw new Error('Building/route identities are ambiguous or invalid.');
  }
  if (policyResult.blockers.length) throw new Error('Guided policy identities are ambiguous or invalid.');

  const parity = buildPlan(vrBackend, vrBackend);
  if (!planIsFullyPresent(parity)) throw new Error('Selected VR metadata is incomplete or invalid.');

  const chain = verifyGuidedChain({
    keys: GUIDED_KEYS,
    arrivalKey: policyResult.snapshot.active_routes[0] && policyResult.snapshot.active_routes[0].arrival_scene_key,
    scenes: vrBackend.scenes,
    links: selectedLinks(vrBackend)
  });
  if (!chain.complete || chain.verifiedKeys.length !== GUIDED_KEYS.length) {
    throw new Error('Selected guided chain is incomplete.');
  }

  const arrivalKey = policyResult.snapshot.active_routes[0].arrival_scene_key;
  const arrivalRows = vrBackend.scenes.filter((row) => row.scene_key === arrivalKey);
  const destinationNodeKey = policyResult.snapshot.active_routes[0].destination_node_key;
  const destinationNodeRows = route.snapshot.nodes.filter((row) => row.node_key === destinationNodeKey);
  if (arrivalRows.length !== 1 ||
      destinationNodeRows.length !== 1 ||
      destinationNodeRows[0].building_canonical !== canonicalKey('College of Arts and Sciences')) {
    throw new Error('Selected guided arrival or CAS destination identity is invalid.');
  }

  const deferredCcs = policyResult.snapshot.deferred_destinations.filter(
    (entry) => entry.destination_node_key === 'ccs' &&
      canonicalKey(entry.destination_name) === canonicalKey('College of Computer Studies (CCS)')
  );
  const activeCcs = policyResult.snapshot.active_routes.filter(
    (entry) => entry.destination_node_key === 'ccs' ||
      canonicalKey(entry.destination_name) === canonicalKey('College of Computer Studies (CCS)')
  );
  const ccsNodes = route.snapshot.nodes.filter(
    (row) => row.node_key === 'ccs' &&
      row.building_canonical === canonicalKey('College of Computer Studies (CCS)')
  );
  const ccsPath = ccsNodes.length === 1
    ? findShortestPath({
        nodes: route.snapshot.nodes.map((row) => ({ key: row.node_key, lat: row.lat, lng: row.lng })),
        edges: route.snapshot.edges.map((row) => ({
          from: row.from_key,
          to: row.to_key,
          distance_meters: row.distance_meters,
          walk_time_seconds: row.walk_time_seconds,
          is_accessible: row.is_accessible
        })),
        startKey: 'main-gate',
        endKey: 'ccs'
      })
    : null;
  if (deferredCcs.length !== 1 || activeCcs.length !== 0 || !ccsPath || ccsPath.success !== true) {
    throw new Error('Deferred CCS identity or map route is invalid.');
  }

  const counts = {
    ...routeCounts(route),
    total_vr_scenes: totals.scenes,
    total_vr_hotspots: totals.hotspots,
    selected_vr_scenes: vrBackend.scenes.length,
    selected_source_hotspots: vrBackend.hotspots.length,
    guided_scenes: GUIDED_KEYS.length,
    interior_scenes: INTERIOR_KEYS.length,
    cas_schedule_targets: parity.schedule_targets
  };
  const roster = route.snapshot.buildings.map((row) => row.name).sort();
  const candidate = {
    schema_version: 1,
    migrations,
    counts,
    roster,
    policy: policyResult.snapshot,
    fingerprints: {
      migrations: fingerprint(migrations),
      building_route: route.semanticFingerprint,
      selected_vr: semanticScopeFingerprint(vrBackend),
      guided_policy: fingerprint(policyResult.snapshot),
      manifest: null
    }
  };
  candidate.fingerprints.manifest = fingerprint(expectedCore(candidate));
  return candidate;
}

function compareCandidate(scope, candidate) {
  check(scope, 'migration filename/hash sequence matches the freeze', sameValue(candidate.migrations, SELECTED_DEMO_FREEZE.migrations));
  check(scope, 'all frozen counts match', sameValue(candidate.counts, SELECTED_DEMO_FREEZE.counts));
  check(scope, 'exact 13-building roster matches', sameValue(candidate.roster, SELECTED_DEMO_FREEZE.roster));
  check(scope, 'active CAS + deferred CCS policy matches', sameValue(candidate.policy, SELECTED_DEMO_FREEZE.policy));
  for (const key of ['migrations', 'building_route', 'selected_vr', 'guided_policy', 'manifest']) {
    check(scope, `${key} fingerprint matches`, candidate.fingerprints[key] === SELECTED_DEMO_FREEZE.fingerprints[key]);
  }
}

function routeFixture() {
  return {
    buildings: [{
      id: 1,
      name: 'Fixture Building',
      category: 'Academic',
      description: 'Fixture',
      lat: 1,
      lng: 2,
      details: { entrances: ['Front'] },
      image_url: null,
      cloudinary_public_id: null
    }],
    nodes: [{
      id: 1,
      node_key: 'fixture',
      label: 'Fixture',
      node_type: 'building',
      building_id: 1,
      lat: 1,
      lng: 2,
      display_order: 1
    }, {
      id: 2,
      node_key: 'fixture-path',
      label: 'Fixture Path',
      node_type: 'waypoint',
      building_id: null,
      lat: 1.1,
      lng: 2.1,
      display_order: 2
    }],
    edges: [{
      id: 1,
      from_node_id: 1,
      to_node_id: 2,
      distance_meters: 20,
      walk_time_seconds: 15,
      path_label: 'Fixture path',
      is_accessible: true,
      path_geometry: [{ lat: 1, lng: 2 }, { lat: 1.1, lng: 2.1 }]
    }, {
      id: 2,
      from_node_id: 2,
      to_node_id: 1,
      distance_meters: 20,
      walk_time_seconds: 15,
      path_label: 'Fixture path',
      is_accessible: true,
      path_geometry: [{ lat: 1.1, lng: 2.1 }, { lat: 1, lng: 2 }]
    }]
  };
}

function malformedVrFixture(kind) {
  const scene = {
    id: 1,
    scene_key: 'scene-guard-house',
    title: 'Guard House',
    description: null,
    image_url: 'https://res.cloudinary.com/demo/image/upload/example.jpg',
    cloudinary_public_id: 'demo/example',
    node_id: null,
    building_id: null,
    initial_yaw: 0,
    initial_pitch: 0,
    display_order: 1
  };
  const backend = {
    scenes: [scene],
    hotspots: [],
    nodes: [],
    buildings: [],
    allScenes: [{ id: 1, scene_key: scene.scene_key }]
  };
  if (kind === 'duplicate') backend.scenes.push({ ...scene, id: 2 });
  if (kind === 'orphan') backend.hotspots.push({
    id: 1,
    scene_id: 1,
    target_scene_id: 999,
    hotspot_type: 'scene',
    label: 'Broken',
    text: null,
    schedule_building_id: null,
    schedule_location_type: null,
    schedule_location_label: null,
    schedule_floor_label: null,
    yaw: 0,
    pitch: 0,
    display_order: 1
  });
  return backend;
}

function runPureChecks() {
  console.log('\nBE.6 database-free freeze safety checks:');
  const base = { b: 2, a: [{ z: 3, y: 4 }] };
  check('pure', 'stable fingerprint ignores object-key order',
    fingerprint(base) === fingerprint({ a: [{ y: 4, z: 3 }], b: 2 }));

  const categories = ['counts', 'roster', 'policy', 'migrations', 'building_route', 'selected_vr'];
  const core = expectedCore(SELECTED_DEMO_FREEZE);
  for (const category of categories) {
    const changed = deepClone(core);
    if (category === 'counts') changed.counts.buildings += 1;
    if (category === 'roster') changed.roster[0] = 'Changed Building';
    if (category === 'policy') changed.policy.active_routes[0].scene_keys[0] = 'changed-scene';
    if (category === 'migrations') changed.migrations[0][1] = '0'.repeat(64);
    if (category === 'building_route') changed.fingerprints.building_route = '1'.repeat(64);
    if (category === 'selected_vr') changed.fingerprints.selected_vr = '2'.repeat(64);
    check('pure', `${category} drift changes the aggregate fingerprint`, fingerprint(changed) !== fingerprint(core));
  }

  const reordered = deepClone(core);
  reordered.roster.reverse();
  check('pure', 'array order remains semantic and cannot be silently reordered', fingerprint(reordered) !== fingerprint(core));

  const routeBase = routeFixture();
  const routeBaseAnalysis = analyzeState(routeBase);
  const reorderedRoute = deepClone(routeBase);
  reorderedRoute.nodes.reverse();
  reorderedRoute.edges.reverse();
  check('pure', 'natural-key route hashing is stable under backend row reordering',
    routeBaseAnalysis.blockers.length === 0 &&
      analyzeState(reorderedRoute).semanticFingerprint === routeBaseAnalysis.semanticFingerprint);
  const changedMetadata = deepClone(routeBase);
  changedMetadata.buildings[0].description = 'Changed fixture metadata';
  check('pure', 'building metadata changes the route fingerprint',
    analyzeState(changedMetadata).semanticFingerprint !== routeBaseAnalysis.semanticFingerprint);
  const changedCoordinate = deepClone(routeBase);
  changedCoordinate.buildings[0].lat = 1.0001;
  check('pure', 'building coordinate changes the route fingerprint',
    analyzeState(changedCoordinate).semanticFingerprint !== routeBaseAnalysis.semanticFingerprint);
  const changedGeometry = deepClone(routeBase);
  changedGeometry.edges[0].path_geometry.splice(1, 0, { lat: 1.05, lng: 2.05 });
  check('pure', 'edge geometry changes the route fingerprint',
    analyzeState(changedGeometry).semanticFingerprint !== routeBaseAnalysis.semanticFingerprint);

  const changedSceneOrder = deepClone(core);
  const sceneKeys = changedSceneOrder.policy.active_routes[0].scene_keys;
  [sceneKeys[1], sceneKeys[2]] = [sceneKeys[2], sceneKeys[1]];
  check('pure', 'guided scene-order drift changes the aggregate fingerprint',
    fingerprint(changedSceneOrder) !== fingerprint(core));
  const changedScheduleTarget = deepClone(core);
  changedScheduleTarget.policy.schedule_target.location_label = 'Changed Room';
  check('pure', 'schedule-target drift changes the aggregate fingerprint',
    fingerprint(changedScheduleTarget) !== fingerprint(core));
  const changedHotspotFingerprint = deepClone(core);
  changedHotspotFingerprint.fingerprints.selected_vr = '3'.repeat(64);
  check('pure', 'hotspot semantic drift changes the aggregate fingerprint',
    fingerprint(changedHotspotFingerprint) !== fingerprint(core));

  const duplicateRoute = routeFixture();
  duplicateRoute.buildings.push({ ...duplicateRoute.buildings[0], id: 2 });
  check('pure', 'duplicate canonical building fails closed', analyzeState(duplicateRoute).blockers.length > 0);
  const orphanRoute = routeFixture();
  orphanRoute.nodes[0].building_id = 999;
  check('pure', 'orphan building relationship fails closed', analyzeState(orphanRoute).blockers.length > 0);

  let duplicateVrRejected = false;
  let orphanVrRejected = false;
  try { semanticScopeFingerprint(malformedVrFixture('duplicate')); } catch (_) { duplicateVrRejected = true; }
  try { semanticScopeFingerprint(malformedVrFixture('orphan')); } catch (_) { orphanVrRejected = true; }
  check('pure', 'duplicate scene key fails closed before fingerprinting', duplicateVrRejected);
  check('pure', 'orphan hotspot target fails closed before fingerprinting', orphanVrRejected);

  const overlapping = policySnapshot(GUIDED_VR_ROUTES, [{
    destination_name: GUIDED_VR_ROUTES[0].destination_name,
    destination_node_key: 'ccs'
  }]);
  check('pure', 'active/deferred canonical overlap fails closed', overlapping.blockers.length > 0);
  const duplicateKeyPolicy = deepClone(GUIDED_VR_ROUTES);
  duplicateKeyPolicy[0].scene_keys.push(duplicateKeyPolicy[0].scene_keys[0]);
  check('pure', 'duplicate guided scene key fails closed',
    policySnapshot(duplicateKeyPolicy, DEFERRED_GUIDED_VR_DESTINATIONS).blockers.length > 0);
}

async function readMysql() {
  const [buildings] = await db.query(
    'SELECT id, name, category, description, lat, lng, details, image_url, cloudinary_public_id FROM buildings ORDER BY id'
  );
  const [nodes] = await db.query(
    'SELECT id, node_key, label, node_type, building_id, lat, lng, display_order FROM route_nodes ORDER BY id'
  );
  const [edges] = await db.query(
    'SELECT id, from_node_id, to_node_id, distance_meters, walk_time_seconds, path_label, is_accessible, path_geometry FROM route_edges ORDER BY id'
  );
  const [scenes] = await db.query(
    'SELECT id, scene_key, title, description, image_url, cloudinary_public_id, node_id, building_id, initial_yaw, initial_pitch, display_order FROM vr_scenes WHERE scene_key IN (?)',
    [SELECTED_KEYS]
  );
  const sceneIds = scenes.map((row) => positiveInt(row.id)).filter((id) => id !== null);
  const [hotspots] = await db.query(
    'SELECT id, scene_id, target_scene_id, hotspot_type, label, `text` AS text, schedule_building_id, schedule_location_type, schedule_location_label, schedule_floor_label, yaw, pitch, display_order FROM vr_hotspots WHERE scene_id IN (?)',
    [sceneIds]
  );
  const [vrNodes] = await db.query('SELECT id, node_key FROM route_nodes');
  const [vrBuildings] = await db.query('SELECT id, name FROM buildings');
  const [allScenes] = await db.query('SELECT id, scene_key FROM vr_scenes');
  const [hotspotCount] = await db.query('SELECT COUNT(*) AS total FROM vr_hotspots');
  return {
    route: { buildings, nodes, edges },
    vr: { scenes, hotspots, nodes: vrNodes, buildings: vrBuildings, allScenes },
    totals: { scenes: allScenes.length, hotspots: Number(hotspotCount[0].total) }
  };
}

async function selectSupabase(sb, table, columns) {
  const { data, error } = await sb.from(table).select(columns);
  if (error) throw new Error(`Unable to read Supabase ${table}.`);
  return data || [];
}

async function selectSupabaseIn(sb, table, columns, field, values) {
  const { data, error } = await sb.from(table).select(columns).in(field, values);
  if (error) throw new Error(`Unable to read Supabase ${table}.`);
  return data || [];
}

async function readSupabase() {
  const sb = getSupabaseClient();
  const buildings = await selectSupabase(sb, 'buildings',
    'id,name,category,description,lat,lng,details,image_url,cloudinary_public_id');
  const nodes = await selectSupabase(sb, 'route_nodes',
    'id,node_key,label,node_type,building_id,lat,lng,display_order');
  const edges = await selectSupabase(sb, 'route_edges',
    'id,from_node_id,to_node_id,distance_meters,walk_time_seconds,path_label,is_accessible,path_geometry');
  const scenes = await selectSupabaseIn(sb, 'vr_scenes',
    'id,scene_key,title,description,image_url,cloudinary_public_id,node_id,building_id,initial_yaw,initial_pitch,display_order',
    'scene_key', SELECTED_KEYS);
  const sceneIds = scenes.map((row) => positiveInt(row.id)).filter((id) => id !== null);
  const hotspots = await selectSupabaseIn(sb, 'vr_hotspots',
    'id,scene_id,target_scene_id,hotspot_type,label,text,schedule_building_id,schedule_location_type,schedule_location_label,schedule_floor_label,yaw,pitch,display_order',
    'scene_id', sceneIds);
  const vrNodes = await selectSupabase(sb, 'route_nodes', 'id,node_key');
  const vrBuildings = await selectSupabase(sb, 'buildings', 'id,name');
  const allScenes = await selectSupabase(sb, 'vr_scenes', 'id,scene_key');
  const allHotspots = await selectSupabase(sb, 'vr_hotspots', 'id');
  return {
    route: { buildings, nodes, edges },
    vr: { scenes, hotspots, nodes: vrNodes, buildings: vrBuildings, allScenes },
    totals: { scenes: allScenes.length, hotspots: allHotspots.length }
  };
}

function verifySourceRoster() {
  const names = (sourceData.buildings || []).map((row) => row.name).sort();
  check('source', 'models/data.js declares the exact frozen roster', sameValue(names, SELECTED_DEMO_FREEZE.roster));
  check('source', 'guided catalog defines exactly 24 ordered CAS steps', GUIDED_KEYS.length === 24);
  check('source', 'selected scope is exactly 24 guided + 2 interior scenes', SELECTED_KEYS.length === 26 && INTERIOR_KEYS.length === 2);
}

async function main() {
  console.log('=== CampuSphere BE.6 selected-demo dataset freeze (READ ONLY) ===');
  console.log('No SQL, RPC, migration, fixture, or application mutation is performed.');
  runPureChecks();
  verifySourceRoster();

  if (!hasSupabaseConfig()) throw new Error('Supabase configuration is required for the BE.6 parity freeze.');
  const migrations = migrationRecords();
  const policy = policySnapshot(GUIDED_VR_ROUTES, DEFERRED_GUIDED_VR_DESTINATIONS);
  check('policy', 'policy identities are unique and fail-closed', policy.blockers.length === 0);

  const [mysql, supabase] = await Promise.all([readMysql(), readSupabase()]);
  const mysqlCandidate = buildCandidate(mysql.route, mysql.vr, mysql.totals, migrations, policy);
  const supabaseCandidate = buildCandidate(supabase.route, supabase.vr, supabase.totals, migrations, policy);

  console.log('\nLive MySQL freeze checks:');
  compareCandidate('mysql', mysqlCandidate);
  console.log('\nLive Supabase freeze checks:');
  compareCandidate('supabase', supabaseCandidate);
  check('cross-backend', 'building/route semantic fingerprints match',
    mysqlCandidate.fingerprints.building_route === supabaseCandidate.fingerprints.building_route);
  check('cross-backend', 'selected VR semantic fingerprints match',
    mysqlCandidate.fingerprints.selected_vr === supabaseCandidate.fingerprints.selected_vr);
  check('cross-backend', 'complete freeze candidates match', sameValue(mysqlCandidate, supabaseCandidate));

  if (Object.values(SELECTED_DEMO_FREEZE.fingerprints).some((value) => value === '__BE6_CANDIDATE__')) {
    console.log('\nBE.6 CANDIDATE FINGERPRINTS (safe SHA-256 values):');
    for (const [key, value] of Object.entries(mysqlCandidate.fingerprints)) console.log(`  ${key}=${value}`);
    failures.push('freeze manifest still contains candidate placeholders');
  }

  if (failures.length) {
    console.error(`\nBE6-DATASET-FREEZE-PROBE FAILED: ${failures.length} check(s) did not pass.`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`\nBE6-DATASET-FREEZE-PROBE OK: ${checks}/${checks} checks passed.`);
  }
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(`BE6-DATASET-FREEZE-PROBE FAILED: ${error && error.message ? error.message : 'sanitized failure'}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      try { await db.end(); } catch (_) { /* already closed */ }
    });
}

module.exports = {
  stableValue,
  policySnapshot,
  expectedCore,
  buildCandidate
};
