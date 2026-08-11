'use strict';

/*
 * BE.6 expanded Guided-VR catalog freeze verifier.
 *
 * Database access is SELECT-only. The complete current MySQL and Supabase
 * rosters are pinned independently because local MySQL intentionally retains
 * reproducible seed-era records while Supabase is the accepted live catalog.
 * The shared 25-route Guided VR contract must nevertheless resolve completely
 * in both backends by natural building, node, and scene identities.
 */

require('dotenv').config({ quiet: true });

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { getSupabaseClient, hasSupabaseConfig } = require('../config/supabase');
const { SELECTED_DEMO_FREEZE } = require('../config/selectedDemoFreeze');
const { GUIDED_VR_ROUTES, DEFERRED_GUIDED_VR_DESTINATIONS } = require('../config/guidedVrRoutes');
const sourceData = require('../models/data');
const { analyzeState, fingerprint, positiveInt } = require('./applyBe5SelectedDemoParityMysql');
const { INTERIOR_KEYS } = require('./syncSelectedCasVrSupabaseToMysql');
const { verifyGuidedChain } = require('../services/guidedVrResolution');
const { canonicalKey } = require('../services/routeAvailability');
const { findShortestPath } = require('../utils/pathfinding');

const MIGRATION_DIR = path.join(__dirname, '..', 'database', 'supabase');
const GUIDED_KEYS = [...new Set(GUIDED_VR_ROUTES.flatMap((route) => route.scene_keys || []))];
const SELECTED_KEYS = [...new Set([...GUIDED_KEYS, ...INTERIOR_KEYS])];
const CONFIGURED_STEPS = GUIDED_VR_ROUTES.reduce((sum, route) => sum + route.scene_keys.length, 0);
const failures = [];
let checks = 0;

function check(scope, label, value) {
  checks += 1;
  const ok = value === true;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!ok) failures.push(`${scope} :: ${label}`);
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

function requiredString(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
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

function policySnapshot(activeRoutes, deferredDestinations) {
  const active = Array.isArray(activeRoutes) ? activeRoutes : [];
  const deferred = Array.isArray(deferredDestinations) ? deferredDestinations : [];
  const blockers = [];
  const names = new Set();
  const nodes = new Set();
  const normalizedActive = [];

  for (const route of active) {
    const name = requiredString(route && route.destination_name);
    const node = requiredString(route && route.destination_node_key);
    const arrival = requiredString(route && route.arrival_scene_key);
    const keys = Array.isArray(route && route.scene_keys) ? [...route.scene_keys] : [];
    const canonical = canonicalKey(name);
    if (!name || !canonical || !node || !arrival || keys.length === 0) blockers.push('missing route identity');
    if (names.has(canonical) || nodes.has(node)) blockers.push('duplicate route identity');
    if (new Set(keys).size !== keys.length || keys.some((key) => !requiredString(key))) blockers.push('invalid scene identity');
    if (keys[keys.length - 1] !== arrival) blockers.push('arrival is not final');
    names.add(canonical);
    nodes.add(node);
    normalizedActive.push({
      destination_name: name,
      destination_node_key: node,
      arrival_scene_key: arrival,
      step_count: keys.length,
      scene_keys_sha256: fingerprint(keys)
    });
  }

  const normalizedDeferred = [];
  for (const route of deferred) {
    const name = requiredString(route && route.destination_name);
    const node = requiredString(route && route.destination_node_key);
    const canonical = canonicalKey(name);
    if (!name || !canonical || !node || names.has(canonical) || nodes.has(node)) blockers.push('invalid deferred identity');
    names.add(canonical);
    nodes.add(node);
    normalizedDeferred.push({ destination_name: name, destination_node_key: node });
  }

  normalizedActive.sort((a, b) => a.destination_node_key.localeCompare(b.destination_node_key));
  normalizedDeferred.sort((a, b) => a.destination_node_key.localeCompare(b.destination_node_key));
  return {
    blockers: [...new Set(blockers)],
    snapshot: {
      active_routes: normalizedActive,
      deferred_destinations: normalizedDeferred,
      interior_scene_keys: [...INTERIOR_KEYS]
    }
  };
}

function selectedLinks(vr) {
  const keyById = new Map(vr.allScenes.map((scene) => [positiveInt(scene.id), scene.scene_key]));
  return vr.hotspots.filter((hotspot) => hotspot.hotspot_type === 'scene').map((hotspot) => ({
    fromKey: keyById.get(positiveInt(hotspot.scene_id)) || null,
    toKey: keyById.get(positiveInt(hotspot.target_scene_id)) || null
  })).filter((link) => link.fromKey && link.toKey);
}

function routeCounts(analysis, state) {
  return {
    buildings: analysis.metrics.buildings,
    route_nodes: analysis.metrics.nodes,
    building_nodes: state.nodes.filter((node) => node.node_type === 'building').length,
    route_edges: analysis.metrics.edges,
    reverse_pairs: analysis.metrics.pairs,
    valid_geometries: analysis.metrics.geometries,
    exact_reverse_geometries: analysis.metrics.exactReverse,
    routable_destinations: analysis.metrics.routable
  };
}

function expandedSelectedVrFingerprint(vr, scenes) {
  const nodeKeyById = new Map(vr.nodes.map((node) => [positiveInt(node.id), node.node_key]));
  const buildingNameById = new Map(vr.buildings.map((building) => [positiveInt(building.id), building.name]));
  const sceneKeyById = new Map(vr.allScenes.map((scene) => [positiveInt(scene.id), scene.scene_key]));
  const selectedSceneKeyById = new Map(scenes.map((scene) => [positiveInt(scene.id), scene.scene_key]));

  const sceneSnapshot = scenes.map((scene) => ({
    scene_key: scene.scene_key,
    title: scene.title,
    description: scene.description == null ? null : scene.description,
    image_url: scene.image_url,
    cloudinary_public_id: scene.cloudinary_public_id,
    node_key: scene.node_id == null ? null : (nodeKeyById.get(positiveInt(scene.node_id)) || null),
    building_canonical: scene.building_id == null
      ? null
      : canonicalKey(buildingNameById.get(positiveInt(scene.building_id))),
    initial_yaw: Number(scene.initial_yaw),
    initial_pitch: Number(scene.initial_pitch),
    display_order: Number(scene.display_order)
  })).sort((left, right) => left.scene_key.localeCompare(right.scene_key));

  const hotspotSnapshot = vr.hotspots.map((hotspot) => ({
    source_scene_key: selectedSceneKeyById.get(positiveInt(hotspot.scene_id)) || null,
    target_scene_key: hotspot.target_scene_id == null
      ? null
      : (sceneKeyById.get(positiveInt(hotspot.target_scene_id)) || null),
    hotspot_type: hotspot.hotspot_type,
    label: hotspot.label == null ? null : hotspot.label,
    text: hotspot.text == null ? null : hotspot.text,
    schedule_building_canonical: hotspot.schedule_building_id == null
      ? null
      : canonicalKey(buildingNameById.get(positiveInt(hotspot.schedule_building_id))),
    schedule_location_type: hotspot.schedule_location_type == null ? null : hotspot.schedule_location_type,
    schedule_location_label: hotspot.schedule_location_label == null ? null : hotspot.schedule_location_label,
    schedule_floor_label: hotspot.schedule_floor_label == null ? null : hotspot.schedule_floor_label,
    yaw: Number(hotspot.yaw),
    pitch: Number(hotspot.pitch),
    display_order: Number(hotspot.display_order)
  }));
  hotspotSnapshot.sort((left, right) => JSON.stringify(stableValue(left)).localeCompare(JSON.stringify(stableValue(right))));

  const invalid = sceneSnapshot.some((scene) => !scene.scene_key ||
    !Number.isFinite(scene.initial_yaw) || !Number.isFinite(scene.initial_pitch) || !Number.isFinite(scene.display_order)) ||
    hotspotSnapshot.some((hotspot) => !hotspot.source_scene_key ||
      (hotspot.hotspot_type === 'scene' && !hotspot.target_scene_key) ||
      !Number.isFinite(hotspot.yaw) || !Number.isFinite(hotspot.pitch) || !Number.isFinite(hotspot.display_order));
  if (invalid) throw new Error('expanded selected VR snapshot is invalid');
  return fingerprint({ scenes: sceneSnapshot, hotspots: hotspotSnapshot });
}

function buildBackendCandidate(name, input, policy) {
  const analysis = analyzeState(input.route);
  const blockers = [...analysis.blockers];
  if (!analysis.snapshot || !analysis.metrics) throw new Error(`${name} route snapshot is invalid.`);

  const buildingByCanonical = new Map();
  for (const building of input.route.buildings) {
    const canonical = canonicalKey(building.name);
    const list = buildingByCanonical.get(canonical) || [];
    list.push(building);
    buildingByCanonical.set(canonical, list);
  }
  const nodesByKey = new Map();
  for (const node of input.route.nodes) {
    const list = nodesByKey.get(node.node_key) || [];
    list.push(node);
    nodesByKey.set(node.node_key, list);
  }
  const buildingById = new Map(input.route.buildings.map((building) => [Number(building.id), building]));
  const sceneNodeKeyById = new Map(input.vr.nodes.map((node) => [positiveInt(node.id), node.node_key]));
  const scenes = input.vr.scenes.map((scene) => ({
    ...scene,
    node_key: scene.node_id == null ? null : (sceneNodeKeyById.get(positiveInt(scene.node_id)) || null)
  }));
  const links = selectedLinks(input.vr);
  const graphNodes = analysis.snapshot.nodes.map((node) => ({ key: node.node_key, lat: node.lat, lng: node.lng }));
  const graphEdges = analysis.snapshot.edges.map((edge) => ({
    from: edge.from_key,
    to: edge.to_key,
    distance_meters: edge.distance_meters,
    walk_time_seconds: edge.walk_time_seconds,
    is_accessible: edge.is_accessible
  }));

  const routeResults = [];
  for (const route of GUIDED_VR_ROUTES) {
    const canonical = canonicalKey(route.destination_name);
    const buildings = buildingByCanonical.get(canonical) || [];
    const nodes = nodesByKey.get(route.destination_node_key) || [];
    const nodeMapsBuilding = buildings.length === 1 && nodes.length === 1 &&
      Number(nodes[0].building_id) === Number(buildings[0].id);
    const pathResult = nodeMapsBuilding ? findShortestPath({
      nodes: graphNodes,
      edges: graphEdges,
      startKey: 'main-gate',
      endKey: route.destination_node_key
    }) : null;
    const chain = verifyGuidedChain({
      keys: route.scene_keys,
      arrivalKey: route.arrival_scene_key,
      scenes,
      links,
      startNodeKey: 'main-gate',
      destinationNodeKey: route.destination_node_key
    });
    routeResults.push({
      destination_node_key: route.destination_node_key,
      building_unique: buildings.length === 1,
      node_unique: nodes.length === 1,
      node_maps_building: nodeMapsBuilding,
      path_reachable: !!pathResult && pathResult.success === true,
      chain_complete: chain.complete === true && chain.verifiedKeys.length === route.scene_keys.length,
      verified_scene_keys: chain.verifiedKeys
    });
  }

  const selectedCounts = new Map();
  for (const scene of scenes) selectedCounts.set(scene.scene_key, (selectedCounts.get(scene.scene_key) || 0) + 1);
  const exactSelectedScenes = SELECTED_KEYS.every((key) => selectedCounts.get(key) === 1) &&
    scenes.length === SELECTED_KEYS.length;
  if (!exactSelectedScenes) blockers.push('selected scene identities are incomplete or ambiguous');

  const buildingNodesValid = input.route.nodes
    .filter((node) => node.node_type === 'building')
    .every((node) => positiveInt(node.building_id) !== null && buildingById.has(Number(node.building_id)));
  if (!buildingNodesValid) blockers.push('building node is not mapped to exactly one existing building');

  let selectedVrFingerprint = null;
  try {
    selectedVrFingerprint = expandedSelectedVrFingerprint(input.vr, scenes);
  } catch (_) {
    blockers.push('selected VR semantic identity is ambiguous');
  }

  const guidedSnapshot = routeResults.map((result) => ({
    destination_node_key: result.destination_node_key,
    verified_scene_keys: result.verified_scene_keys,
    chain_complete: result.chain_complete
  }));

  const counts = {
    ...routeCounts(analysis, input.route),
    total_vr_scenes: input.totals.scenes,
    total_vr_hotspots: input.totals.hotspots,
    selected_vr_scenes: scenes.length,
    selected_source_hotspots: input.vr.hotspots.length,
    selected_schedule_hotspots: input.vr.hotspots.filter((hotspot) => hotspot.hotspot_type === 'schedule').length,
    active_guided_destinations: GUIDED_VR_ROUTES.length,
    configured_guided_steps: CONFIGURED_STEPS,
    unique_guided_scenes: GUIDED_KEYS.length,
    interior_scenes: INTERIOR_KEYS.length
  };

  return {
    blockers: [...new Set(blockers)],
    counts,
    roster: analysis.snapshot.buildings.map((building) => building.name).sort(),
    fingerprints: {
      building_route: analysis.semanticFingerprint,
      selected_vr: selectedVrFingerprint,
      guided_catalog: fingerprint(guidedSnapshot)
    },
    route_results: routeResults,
    selected_scene_keys: [...selectedCounts.keys()].sort(),
    building_nodes_valid: buildingNodesValid
  };
}

function expectedCore(candidate) {
  return {
    schema_version: candidate.schema_version,
    frozen_on: candidate.frozen_on,
    migrations: candidate.migrations,
    seed_roster: candidate.seed_roster,
    policy: candidate.policy,
    backends: candidate.backends,
    fingerprints: {
      migrations: candidate.fingerprints.migrations,
      guided_policy: candidate.fingerprints.guided_policy
    }
  };
}

function buildCandidate(mysql, supabase, migrations, policy) {
  const seedRoster = sourceData.buildings.map((building) => building.name).sort();
  const candidate = {
    schema_version: 2,
    frozen_on: '2026-08-10',
    migrations,
    seed_roster: seedRoster,
    policy: policy.snapshot,
    backends: {
      mysql: buildBackendCandidate('MySQL', mysql, policy),
      supabase: buildBackendCandidate('Supabase', supabase, policy)
    },
    fingerprints: {
      migrations: fingerprint(migrations),
      guided_policy: fingerprint({
        active: GUIDED_VR_ROUTES,
        deferred: DEFERRED_GUIDED_VR_DESTINATIONS,
        interior: INTERIOR_KEYS
      }),
      manifest: null
    }
  };
  for (const backend of Object.values(candidate.backends)) {
    delete backend.blockers;
    delete backend.route_results;
    delete backend.selected_scene_keys;
    delete backend.building_nodes_valid;
  }
  candidate.fingerprints.manifest = fingerprint(expectedCore(candidate));
  return candidate;
}

async function readMysql() {
  const [buildings] = await db.query(
    'SELECT id,name,category,description,lat,lng,details,image_url,cloudinary_public_id FROM buildings ORDER BY id');
  const [nodes] = await db.query(
    'SELECT id,node_key,label,node_type,building_id,lat,lng,display_order FROM route_nodes ORDER BY id');
  const [edges] = await db.query(
    'SELECT id,from_node_id,to_node_id,distance_meters,walk_time_seconds,path_label,is_accessible,path_geometry FROM route_edges ORDER BY id');
  const [scenes] = await db.query(
    'SELECT id,scene_key,title,description,image_url,cloudinary_public_id,node_id,building_id,initial_yaw,initial_pitch,display_order FROM vr_scenes WHERE scene_key IN (?)',
    [SELECTED_KEYS]);
  const sceneIds = scenes.map((scene) => positiveInt(scene.id)).filter(Boolean);
  const [hotspots] = await db.query(
    'SELECT id,scene_id,target_scene_id,hotspot_type,label,`text` AS text,schedule_building_id,schedule_location_type,schedule_location_label,schedule_floor_label,yaw,pitch,display_order FROM vr_hotspots WHERE scene_id IN (?)',
    [sceneIds]);
  const [allScenes] = await db.query('SELECT id,scene_key FROM vr_scenes');
  const [totals] = await db.query('SELECT (SELECT COUNT(*) FROM vr_scenes) scenes, (SELECT COUNT(*) FROM vr_hotspots) hotspots');
  return {
    route: { buildings, nodes, edges },
    vr: { scenes, hotspots, nodes: nodes.map((node) => ({ id: node.id, node_key: node.node_key })),
      buildings: buildings.map((building) => ({ id: building.id, name: building.name })), allScenes },
    totals: { scenes: Number(totals[0].scenes), hotspots: Number(totals[0].hotspots) }
  };
}

async function selectPaged(factory) {
  const rows = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await factory().range(from, from + size - 1);
    if (error) throw new Error('Unable to read Supabase freeze data.');
    rows.push(...(data || []));
    if (!data || data.length < size) return rows;
  }
}

async function readSupabase() {
  const sb = getSupabaseClient();
  const buildings = await selectPaged(() => sb.from('buildings').select(
    'id,name,category,description,lat,lng,details,image_url,cloudinary_public_id').order('id'));
  const nodes = await selectPaged(() => sb.from('route_nodes').select(
    'id,node_key,label,node_type,building_id,lat,lng,display_order').order('id'));
  const edges = await selectPaged(() => sb.from('route_edges').select(
    'id,from_node_id,to_node_id,distance_meters,walk_time_seconds,path_label,is_accessible,path_geometry').order('id'));
  const scenes = await selectPaged(() => sb.from('vr_scenes').select(
    'id,scene_key,title,description,image_url,cloudinary_public_id,node_id,building_id,initial_yaw,initial_pitch,display_order')
    .in('scene_key', SELECTED_KEYS).order('id'));
  const sceneIds = scenes.map((scene) => positiveInt(scene.id)).filter(Boolean);
  const hotspots = await selectPaged(() => sb.from('vr_hotspots').select(
    'id,scene_id,target_scene_id,hotspot_type,label,text,schedule_building_id,schedule_location_type,schedule_location_label,schedule_floor_label,yaw,pitch,display_order')
    .in('scene_id', sceneIds).order('id'));
  const allScenes = await selectPaged(() => sb.from('vr_scenes').select('id,scene_key').order('id'));
  const sceneTotal = await sb.from('vr_scenes').select('id', { count: 'exact', head: true });
  const hotspotTotal = await sb.from('vr_hotspots').select('id', { count: 'exact', head: true });
  if (sceneTotal.error || hotspotTotal.error) throw new Error('Unable to count Supabase freeze data.');
  return {
    route: { buildings, nodes, edges },
    vr: { scenes, hotspots, nodes: nodes.map((node) => ({ id: node.id, node_key: node.node_key })),
      buildings: buildings.map((building) => ({ id: building.id, name: building.name })), allScenes },
    totals: { scenes: sceneTotal.count, hotspots: hotspotTotal.count }
  };
}

function hasPlaceholder(value) {
  if (value === '__BE6_CANDIDATE__') return true;
  if (Array.isArray(value)) return value.some(hasPlaceholder);
  return !!value && typeof value === 'object' && Object.values(value).some(hasPlaceholder);
}

function runPureChecks(migrations, policy) {
  check('pure', 'stable fingerprint ignores object key order',
    fingerprint({ a: 1, b: 2 }) === fingerprint({ b: 2, a: 1 }));
  check('pure', 'array order remains semantic', fingerprint(['a', 'b']) !== fingerprint(['b', 'a']));
  check('pure', 'count drift changes a fingerprint', fingerprint({ count: 1 }) !== fingerprint({ count: 2 }));
  check('pure', 'policy identities are valid', policy.blockers.length === 0);
  check('pure', 'canonical destination names are unique',
    new Set(GUIDED_VR_ROUTES.map((route) => canonicalKey(route.destination_name))).size === GUIDED_VR_ROUTES.length);
  check('pure', 'destination node keys are unique',
    new Set(GUIDED_VR_ROUTES.map((route) => route.destination_node_key)).size === GUIDED_VR_ROUTES.length);
  check('pure', 'every configured arrival is the final unique scene', GUIDED_VR_ROUTES.every((route) =>
    route.scene_keys[route.scene_keys.length - 1] === route.arrival_scene_key &&
    new Set(route.scene_keys).size === route.scene_keys.length));
  check('pure', 'active/deferred identities do not overlap', DEFERRED_GUIDED_VR_DESTINATIONS.every((deferred) =>
    !GUIDED_VR_ROUTES.some((active) => canonicalKey(active.destination_name) === canonicalKey(deferred.destination_name) ||
      active.destination_node_key === deferred.destination_node_key)));
  check('pure', 'migration hashes are SHA-256 values', migrations.every((entry) => /^[a-f0-9]{64}$/.test(entry[1])));
  check('pure', 'migration sequence is contiguous 0001 through 0019', migrations.length === 19 &&
    migrations.every((entry, index) => entry[0].startsWith(String(index + 1).padStart(4, '0') + '_')));
}

function runSourceChecks() {
  const seedNames = sourceData.buildings.map((building) => building.name).sort();
  check('source', 'models/data.js preserves the 13-building reproducible seed baseline', seedNames.length === 13);
  check('source', 'seed building names are canonically unique',
    new Set(seedNames.map(canonicalKey)).size === seedNames.length);
  check('source', 'catalog declares exactly 25 active destinations', GUIDED_VR_ROUTES.length === 25);
  check('source', 'catalog declares zero deferred destinations', DEFERRED_GUIDED_VR_DESTINATIONS.length === 0);
  check('source', 'catalog declares exactly 472 configured steps', CONFIGURED_STEPS === 472);
  check('source', 'catalog scope is 99 unique guided scenes plus two interior scenes',
    GUIDED_KEYS.length === 99 && SELECTED_KEYS.length === 101 && INTERIOR_KEYS.length === 2);
}

function runBackendChecks(scope, live, frozen) {
  const results = live.route_results;
  check(scope, 'route/building snapshot has no structural blockers', live.blockers.length === 0);
  check(scope, 'complete live building roster matches the refreshed freeze', sameValue(live.roster, frozen.roster));
  check(scope, 'all measured counts match the refreshed freeze', sameValue(live.counts, frozen.counts));
  check(scope, 'all live canonical building names are unique',
    new Set(live.roster.map(canonicalKey)).size === live.roster.length);
  check(scope, 'every building-type node maps to an existing building', live.building_nodes_valid === true);
  check(scope, 'every active destination building exists exactly once', results.every((result) => result.building_unique));
  check(scope, 'every configured destination node exists exactly once and maps to its building',
    results.every((result) => result.node_unique && result.node_maps_building));
  check(scope, 'every active destination is reachable from main-gate', results.every((result) => result.path_reachable));
  check(scope, 'all 25 media/link/endpoint guided chains are complete',
    results.length === 25 && results.every((result) => result.chain_complete));
  check(scope, 'building/route semantic fingerprint matches',
    live.fingerprints.building_route === frozen.fingerprints.building_route);
  check(scope, 'selected-VR and Guided catalog fingerprints match',
    live.fingerprints.selected_vr === frozen.fingerprints.selected_vr &&
    live.fingerprints.guided_catalog === frozen.fingerprints.guided_catalog);
}

async function main() {
  console.log('=== CampuSphere BE.6 expanded Guided-VR catalog freeze (SELECT ONLY) ===');
  if (!hasSupabaseConfig()) throw new Error('Supabase configuration is required.');
  const migrations = migrationRecords();
  const policy = policySnapshot(GUIDED_VR_ROUTES, DEFERRED_GUIDED_VR_DESTINATIONS);
  runPureChecks(migrations, policy);
  runSourceChecks();

  const [mysqlInput, supabaseInput] = await Promise.all([readMysql(), readSupabase()]);
  const mysqlLive = buildBackendCandidate('MySQL', mysqlInput, policy);
  const supabaseLive = buildBackendCandidate('Supabase', supabaseInput, policy);
  const candidate = buildCandidate(mysqlInput, supabaseInput, migrations, policy);

  console.log('\nLive MySQL freeze checks:');
  runBackendChecks('mysql', mysqlLive, SELECTED_DEMO_FREEZE.backends.mysql);
  console.log('\nLive Supabase freeze checks:');
  runBackendChecks('supabase', supabaseLive, SELECTED_DEMO_FREEZE.backends.supabase);

  check('cross-backend', 'migration filename/hash sequence matches the freeze',
    sameValue(migrations, SELECTED_DEMO_FREEZE.migrations));
  check('cross-backend', 'catalog policy summary matches the freeze',
    sameValue(policy.snapshot, SELECTED_DEMO_FREEZE.policy));
  check('cross-backend', 'migration fingerprint matches the freeze',
    candidate.fingerprints.migrations === SELECTED_DEMO_FREEZE.fingerprints.migrations);
  check('cross-backend', 'full Guided policy fingerprint matches the freeze',
    candidate.fingerprints.guided_policy === SELECTED_DEMO_FREEZE.fingerprints.guided_policy);
  check('cross-backend', 'selected scene identity sets match',
    sameValue(mysqlLive.selected_scene_keys, supabaseLive.selected_scene_keys));
  check('cross-backend', 'Guided catalog natural-key verification fingerprints match',
    mysqlLive.fingerprints.guided_catalog === supabaseLive.fingerprints.guided_catalog);
  check('cross-backend', 'combined expanded-freeze manifest fingerprint matches',
    candidate.fingerprints.manifest === SELECTED_DEMO_FREEZE.fingerprints.manifest);
  check('cross-backend', 'both backends verify all 25 active routes',
    mysqlLive.route_results.length === 25 && supabaseLive.route_results.length === 25 &&
    mysqlLive.route_results.every((result) => result.chain_complete && result.path_reachable) &&
    supabaseLive.route_results.every((result) => result.chain_complete && result.path_reachable));

  if (hasPlaceholder(SELECTED_DEMO_FREEZE)) {
    console.log('\nBE.6 CANDIDATE (safe natural-key/count/hash values):');
    console.log(JSON.stringify(candidate, null, 2));
    failures.push('freeze manifest still contains candidate placeholders');
  }

  if (checks !== 46) failures.push(`probe emitted ${checks} checks instead of the established 46`);
  if (failures.length) {
    console.error(`\nBE6-DATASET-FREEZE-PROBE FAILED: ${failures.length} check(s) did not pass.`);
    failures.forEach((failure) => console.error('  - ' + failure));
    process.exitCode = 1;
  } else {
    console.log(`\nBE6-DATASET-FREEZE-PROBE OK: ${checks}/${checks} checks passed.`);
  }
}

if (require.main === module) {
  main().catch(() => {
    console.error('BE6-DATASET-FREEZE-PROBE FAILED: sanitized read/verification failure.');
    process.exitCode = 1;
  }).finally(async () => {
    try { await db.end(); } catch (_) { /* no-op */ }
  });
}

module.exports = { stableValue, policySnapshot, expectedCore, buildCandidate };
