'use strict';

/*
 * CampuSphere BE.5 selected-demo parity PURE safety probe.
 *
 * Database-free. Exercises the MySQL correction utility with in-memory states
 * and mocked transaction adapters, and statically reviews migration 0019.
 * It never opens a database connection and never applies SQL.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const parity = require('./applyBe5SelectedDemoParityMysql');
const canonicalData = require('../models/data');

const failures = [];
function check(section, label, ok) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${section} :: ${label}`);
  if (!ok) failures.push(`${section} :: ${label}`);
}
function catchMessage(fn) {
  try {
    const value = fn();
    if (value && typeof value.then === 'function') {
      return value.then(() => null).catch((error) => error && error.message ? error.message : '');
    }
    return Promise.resolve(null);
  } catch (error) {
    return Promise.resolve(error && error.message ? error.message : '');
  }
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }

function makeState() {
  const buildings = [];
  for (let i = 1; i <= 13; i += 1) {
    buildings.push({
      id: i,
      name: i === 1 ? parity.TARGET.casName : `Demo Building ${i}`,
      category: 'Academic',
      description: i === 1 ? 'College of Arts and Sciences' : `Demo description ${i}`,
      lat: i === 1 ? parity.TARGET.casLat : 13.4 + i * 0.0001,
      lng: i === 1 ? parity.TARGET.casLng : 123.37 + i * 0.0001,
      details: JSON.stringify({ info: [`Building ${i}`] }),
      image_url: null,
      cloudinary_public_id: null
    });
  }

  const nodes = [
    {
      id: 1, node_key: 'main-gate', label: 'Main Gate', node_type: 'gate',
      building_id: null, lat: 13.40575221, lng: 123.37434735, display_order: 1
    },
    {
      id: 2, node_key: 'east-walk', label: 'East Corridor Junction', node_type: 'walkway',
      building_id: null, lat: parity.TARGET.eastWalkLat, lng: parity.TARGET.eastWalkLng, display_order: 2
    }
  ];
  for (let i = 1; i <= 5; i += 1) {
    nodes.push({
      id: 2 + i,
      node_key: `walk-${i}`,
      label: `Walk ${i}`,
      node_type: 'walkway',
      building_id: null,
      lat: 13.404 + i * 0.0001,
      lng: 123.374 + i * 0.0001,
      display_order: 2 + i
    });
  }
  nodes.push({
    id: 8, node_key: 'cas', label: parity.TARGET.casNodeLabel, node_type: 'building',
    building_id: 1, lat: parity.TARGET.casLat, lng: parity.TARGET.casLng, display_order: 8
  });
  for (let i = 2; i <= 13; i += 1) {
    nodes.push({
      id: 7 + i,
      node_key: `building-${i}`,
      label: `Demo Building ${i}`,
      node_type: 'building',
      building_id: i,
      lat: buildings[i - 1].lat,
      lng: buildings[i - 1].lng,
      display_order: 7 + i
    });
  }

  const pairs = [
    ['main-gate', 'east-walk'],
    ['east-walk', 'cas'],
    ...Array.from({ length: 12 }, (_, index) => ['east-walk', `building-${index + 2}`]),
    ['main-gate', 'walk-1'],
    ['walk-1', 'walk-2'],
    ['walk-2', 'walk-3'],
    ['walk-3', 'walk-4'],
    ['walk-4', 'walk-5'],
    ['walk-5', 'east-walk'],
    ['main-gate', 'walk-2'],
    ['walk-1', 'walk-3'],
    ['walk-2', 'walk-4'],
    ['walk-3', 'walk-5']
  ];
  const nodeByKey = new Map(nodes.map((node) => [node.node_key, node]));
  const edges = [];
  let id = 1;
  for (const [fromKey, toKey] of pairs) {
    const from = nodeByKey.get(fromKey);
    const to = nodeByKey.get(toKey);
    const forward = fromKey === 'east-walk' && toKey === 'cas'
      ? clone(parity.CAS_FORWARD_GEOMETRY)
      : [{ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }];
    const reverse = clone(forward).reverse();
    edges.push({
      id: id++,
      from_node_id: from.id,
      to_node_id: to.id,
      distance_meters: 50,
      walk_time_seconds: 42,
      path_label: 'Demo walkway',
      is_accessible: 1,
      path_geometry: forward
    });
    edges.push({
      id: id++,
      from_node_id: to.id,
      to_node_id: from.id,
      distance_meters: 50,
      walk_time_seconds: 42,
      path_label: 'Demo walkway',
      is_accessible: 1,
      path_geometry: reverse
    });
  }
  return { buildings, nodes, edges };
}

function makeMockAdapter(initialState, options) {
  const opts = options || {};
  const original = clone(initialState);
  let state = clone(initialState);
  let committed = false;
  let readLockedCount = 0;
  const calls = {
    begin: 0,
    readLockedState: 0,
    createBackup: 0,
    applyActions: 0,
    commit: 0,
    rollback: 0,
    readFreshState: 0
  };
  return {
    _calls() { return { ...calls }; },
    _committed() { return committed; },
    async begin() {
      calls.begin += 1;
      if (opts.failBegin) throw new Error('transport failure');
    },
    async readLockedState() {
      calls.readLockedState += 1;
      readLockedCount += 1;
      if (opts.driftBeforeWrite && readLockedCount === 1) {
        const drift = clone(state);
        drift.buildings[1].description = 'Concurrent change';
        return drift;
      }
      if (opts.failLockedRead) throw new Error('transport failure');
      return clone(state);
    },
    async createBackup(_lockedState, fingerprint) {
      calls.createBackup += 1;
      if (opts.failBackup) throw new Error('backup failure');
      return {
        backupPath: '<be5-probe-backup>',
        fingerprint: opts.badBackupFingerprint ? 'bad' : fingerprint
      };
    },
    async applyActions(actions) {
      calls.applyActions += 1;
      state = parity.applyActionsToState(state, actions);
      if (opts.corruptBeforeProof) state.buildings[2].description = 'Corrupted';
      if (opts.failApplyResponse) return { ok: false, count: 0 };
      return { ok: true, count: actions.length };
    },
    async commit() {
      calls.commit += 1;
      if (opts.failCommit) throw new Error('commit failure');
      committed = true;
      return { ok: true };
    },
    async rollback() {
      calls.rollback += 1;
      if (opts.failRollback) throw new Error('rollback failure');
      state = clone(original);
      if (opts.corruptRollback) state.nodes[0].label = 'Rollback corruption';
      return { ok: true };
    },
    async readFreshState() {
      calls.readFreshState += 1;
      if (committed && opts.postCommitMismatch) {
        const mismatch = clone(state);
        mismatch.buildings[3].description = 'Post-commit drift';
        return mismatch;
      }
      return clone(state);
    }
  };
}

function runPurePlanTests() {
  const section = 'pure-plan';
  const state = makeState();
  const analysis = parity.analyzeState(state);
  check(section, 'fixture satisfies pinned 13/20/48/24/48/24/13 metrics',
    analysis.blockers.length === 0 &&
    Object.entries(parity.PINNED).every(([key, value]) => analysis.metrics[key] === value));

  const plan = parity.buildPlan(state);
  check(section, 'reviewed starting state projects exactly two text-row updates',
    plan.blockers.length === 0 &&
    plan.counts.building_updates === 1 &&
    plan.counts.node_updates === 1 &&
    plan.counts.edge_updates === 0 &&
    plan.counts.total_updates === 2);
  check(section, 'projection preserves pinned topology and reaches the target',
    plan.projected &&
    Object.entries(parity.PINNED).every(([key, value]) => plan.projected[key] === value) &&
    parity.planIsFullyPresent(parity.buildPlan(parity.applyActionsToState(state, plan.actions))));

  const reordered = {
    buildings: clone(state.buildings).reverse(),
    nodes: clone(state.nodes).reverse(),
    edges: clone(state.edges).reverse()
  };
  check(section, 'complete fingerprint is order independent',
    parity.analyzeState(reordered).semanticFingerprint === analysis.semanticFingerprint);

  const metadataDrift = clone(state);
  metadataDrift.buildings[5].description = 'Changed unrelated public metadata';
  check(section, 'complete fingerprint detects unrelated building metadata drift',
    parity.analyzeState(metadataDrift).semanticFingerprint !== analysis.semanticFingerprint);

  const duplicate = clone(state);
  duplicate.buildings.push({ ...duplicate.buildings[1], id: 99 });
  check(section, 'duplicate canonical building identity fails closed',
    parity.analyzeState(duplicate).blockers.some((blocker) => /duplicate canonical/i.test(blocker)));

  const dangling = clone(state);
  dangling.nodes[7].building_id = 999;
  check(section, 'dangling node-to-building identity fails closed',
    parity.analyzeState(dangling).blockers.some((blocker) => /dangling or malformed building/i.test(blocker)));

  const malformed = clone(state);
  malformed.edges[0].from_node_id = true;
  check(section, 'coercive or malformed numeric identity fails closed',
    parity.analyzeState(malformed).blockers.some((blocker) => /dangling or malformed node/i.test(blocker)));

  const malformedGeometry = clone(state);
  malformedGeometry.edges[0].path_geometry[0].lat =
    String(malformedGeometry.edges[0].path_geometry[0].lat);
  check(section, 'numeric-string geometry cannot collide with valid numeric geometry',
    parity.analyzeState(malformedGeometry).blockers.some((blocker) => /geometry/i.test(blocker)));

  const malformedMetadata = clone(state);
  malformedMetadata.nodes[0].label = null;
  check(section, 'missing required public metadata fails closed before fingerprinting',
    parity.analyzeState(malformedMetadata).blockers.some((blocker) => /public metadata types/i.test(blocker)));

  const malformedDetails = clone(state);
  malformedDetails.buildings[0].details = 'not-json';
  check(section, 'invalid details JSON cannot collide with valid semantic metadata',
    parity.analyzeState(malformedDetails).blockers.some((blocker) => /details JSON/i.test(blocker)));

  check(section, 'apply argument parser defaults to dry-run',
    parity.parseArgs(['node', 'script']).mode === 'dry-run');
  check(section, 'exact confirmation token is accepted',
    parity.parseArgs([
      'node', 'script', '--apply', `--confirm=${parity.APPLY_CONFIRMATION}`
    ]).mode === 'apply');
  const invalidArgs = [
    ['node', 'script', '--apply'],
    ['node', 'script', '--apply', '--confirm=WRONG'],
    ['node', 'script', '--dry-run', '--apply', `--confirm=${parity.APPLY_CONFIRMATION}`],
    ['node', 'script', '--dry-run', '--dry-run'],
    ['node', 'script', '--unknown']
  ];
  check(section, 'missing/wrong/conflicting/duplicate/unknown arguments all fail closed',
    invalidArgs.every((args) => {
      try { parity.parseArgs(args); return false; } catch (_) { return true; }
    }));
}

async function runTransactionTests() {
  const section = 'transaction';
  const initial = makeState();
  const approved = parity.buildPlan(initial);

  const success = makeMockAdapter(initial);
  const result = await parity.applyPlanWithAdapter(success, approved);
  check(section, 'successful apply proves parity before commit and post-commit',
    result.committed === true &&
    result.updates === 2 &&
    success._committed() === true &&
    success._calls().commit === 1 &&
    success._calls().rollback === 0);

  const drift = makeMockAdapter(initial, { driftBeforeWrite: true });
  const driftMessage = await catchMessage(() => parity.applyPlanWithAdapter(drift, approved));
  check(section, 'pre-write fingerprint drift blocks before backup or mutation',
    /changed after preflight/i.test(driftMessage) &&
    drift._calls().createBackup === 0 &&
    drift._calls().applyActions === 0 &&
    drift._calls().rollback === 1);

  const backupFailure = makeMockAdapter(initial, { failBackup: true });
  const backupMessage = await catchMessage(() => parity.applyPlanWithAdapter(backupFailure, approved));
  check(section, 'backup creation failure rolls back before mutation and invents no path',
    /rolled back and no data was written/i.test(backupMessage) &&
    !/Backup:/.test(backupMessage) &&
    backupFailure._calls().applyActions === 0 &&
    backupFailure._calls().rollback === 1);

  const proofFailure = makeMockAdapter(initial, { corruptBeforeProof: true });
  const proofMessage = await catchMessage(() => parity.applyPlanWithAdapter(proofFailure, approved));
  check(section, 'pre-commit proof failure rolls back and verifies with backup path',
    /rolled back and verified/i.test(proofMessage) &&
    /Backup: <be5-probe-backup>/.test(proofMessage) &&
    proofFailure._calls().commit === 0 &&
    proofFailure._calls().rollback === 1);

  const corruptRollback = makeMockAdapter(initial, {
    corruptBeforeProof: true,
    corruptRollback: true
  });
  const corruptRollbackMessage = await catchMessage(
    () => parity.applyPlanWithAdapter(corruptRollback, approved)
  );
  check(section, 'corrupted rollback cannot claim success',
    /ROLLBACK VERIFICATION FAILED/.test(corruptRollbackMessage) &&
    /Backup: <be5-probe-backup>/.test(corruptRollbackMessage));

  const rollbackFailure = makeMockAdapter(initial, {
    corruptBeforeProof: true,
    failRollback: true
  });
  const rollbackFailureMessage = await catchMessage(
    () => parity.applyPlanWithAdapter(rollbackFailure, approved)
  );
  check(section, 'rollback failure is explicit and retains recovery path',
    /ROLLBACK FAILED/.test(rollbackFailureMessage) &&
    /Backup: <be5-probe-backup>/.test(rollbackFailureMessage));

  const postCommitMismatch = makeMockAdapter(initial, { postCommitMismatch: true });
  const postCommitMessage = await catchMessage(
    () => parity.applyPlanWithAdapter(postCommitMismatch, approved)
  );
  check(section, 'post-commit failure never claims rollback and includes backup path',
    /POST-COMMIT READBACK MISMATCH/.test(postCommitMessage) &&
    /Backup: <be5-probe-backup>/.test(postCommitMessage) &&
    !/rolled back/i.test(postCommitMessage) &&
    postCommitMismatch._calls().rollback === 0 &&
    postCommitMismatch._committed() === true);
}

async function runConnectionTests() {
  const section = 'connection';
  function fakeConnection(options) {
    const opts = options || {};
    return {
      released: 0,
      destroyed: 0,
      async query() {
        if (opts.failIsolation) throw new Error('isolation failure');
        return [[], []];
      },
      async beginTransaction() {
        if (opts.failBegin) throw new Error('begin failure');
      },
      async rollback() {
        if (opts.failRollback) throw new Error('rollback failure');
      },
      async commit() {
        if (opts.failCommit) throw new Error('commit failure');
      },
      release() { this.released += 1; },
      destroy() { this.destroyed += 1; }
    };
  }
  const fakePool = (connection) => ({
    async getConnection() { return connection; }
  });

  const beginConnection = fakeConnection({ failBegin: true });
  const beginAdapter = parity.makeLiveAdapter(fakePool(beginConnection));
  const beginMessage = await catchMessage(() => beginAdapter.begin());
  check(section, 'ambiguous begin destroys and never releases the connection',
    beginMessage !== null &&
    beginConnection.destroyed === 1 &&
    beginConnection.released === 0 &&
    beginAdapter._hasConnection() === false);

  const rollbackConnection = fakeConnection({ failRollback: true });
  const rollbackAdapter = parity.makeLiveAdapter(fakePool(rollbackConnection));
  await rollbackAdapter.begin();
  const rollbackMessage = await catchMessage(() => rollbackAdapter.rollback());
  check(section, 'uncertain rollback destroys and never returns connection to pool',
    rollbackMessage !== null &&
    rollbackConnection.destroyed === 1 &&
    rollbackConnection.released === 0 &&
    rollbackAdapter._hasConnection() === false);

  const safeConnection = fakeConnection();
  const safeAdapter = parity.makeLiveAdapter(fakePool(safeConnection));
  await safeAdapter.begin();
  const safeResult = await safeAdapter.rollback();
  check(section, 'confirmed rollback releases exactly once',
    safeResult.ok === true &&
    safeConnection.released === 1 &&
    safeConnection.destroyed === 0 &&
    safeAdapter._hasConnection() === false);
}

function runMigrationTests() {
  const section = 'migration-0019';
  const root = path.join(__dirname, '..');
  const dir = path.join(root, 'database', 'supabase');
  const migrationName = '0019_be5_selected_demo_parity.sql';
  const migrationPath = path.join(dir, migrationName);
  const files = fs.readdirSync(dir).filter((file) => file.endsWith('.sql')).sort();
  const freezeFiles = files.filter((file) => ![
    '0021_minimal_instructor_oauth_registration.sql',
    '0022_user_presence.sql'
  ].includes(file));
  check(section, 'route-data freeze migration source list remains contiguous 0001-0020',
    freezeFiles.length === 20 &&
    freezeFiles[0].startsWith('0001_') &&
    freezeFiles[18] === migrationName &&
    freezeFiles[19] === '0020_room_schedule_documents.sql');

  const sql = fs.readFileSync(migrationPath, 'utf8');
  const body = sql.replace(/--[^\n]*/g, '');
  const begin = body.search(/\bBEGIN\s*;/i);
  const lockBuildings = body.search(/LOCK\s+TABLE\s+public\.buildings\s+IN\s+SHARE\s+ROW\s+EXCLUSIVE\s+MODE/i);
  const lockNodes = body.search(/LOCK\s+TABLE\s+public\.route_nodes\s+IN\s+SHARE\s+ROW\s+EXCLUSIVE\s+MODE/i);
  const lockEdges = body.search(/LOCK\s+TABLE\s+public\.route_edges\s+IN\s+SHARE\s+ROW\s+EXCLUSIVE\s+MODE/i);
  const firstDo = body.search(/DO\s+\$\$/i);
  const commit = body.search(/\bCOMMIT\s*;/i);
  check(section, 'transaction and deterministic lock order precede preflight',
    begin !== -1 &&
    begin < lockBuildings &&
    lockBuildings < lockNodes &&
    lockNodes < lockEdges &&
    lockEdges < firstDo &&
    firstDo < commit);
  check(section, 'natural keys resolve CAS, main-gate, east-walk, and both directed edges',
    /name\s*=\s*'College of Arts and Sciences'/i.test(body) &&
    /node_key\s*=\s*'main-gate'/i.test(body) &&
    /node_key\s*=\s*'east-walk'/i.test(body) &&
    /node_key\s*=\s*'cas'/i.test(body) &&
    !/\b(?:building_id|from_node_id|to_node_id|id)\s*=\s*\d+/i.test(body));
  check(section, 'reviewed public values and full-precision CAS coordinate are explicit',
    body.includes('College of Arts and Sciences (CAS)') &&
    body.includes('Guard House / Main Gate') &&
    body.includes('13.40594916') &&
    body.includes('123.37704274'));
  check(section, 'PostGIS location is refreshed with schema-qualified functions',
    /extensions\.ST_SetSRID\s*\(\s*extensions\.ST_MakePoint/i.test(body));
  check(section, 'CAS reverse geometry is derived mechanically',
    /jsonb_agg\s*\(\s*p\.elem\s+ORDER\s+BY\s+p\.ord\s+DESC\s*\)/i.test(body) &&
    /WITH\s+ORDINALITY\s+AS\s+p\s*\(\s*elem\s*,\s*ord\s*\)/i.test(body));
  check(section, 'postcondition pins 13/20/48/24/48/24/13',
    /graph_buildings\s*<>\s*13/i.test(body) &&
    /graph_nodes\s*<>\s*20/i.test(body) &&
    /graph_edges\s*<>\s*48/i.test(body) &&
    /pair_count\s*<>\s*24/i.test(body) &&
    /geometry_count\s*<>\s*48/i.test(body) &&
    /reverse_count\s*<>\s*24/i.test(body) &&
    /routable_count\s*<>\s*13/i.test(body));
  check(section, 'postcondition validates every geometry point type, range, and endpoint',
    /jsonb_array_elements\s*\(\s*e\.path_geometry\s*\)/i.test(body) &&
    /jsonb_typeof\s*\(\s*p\.elem\s*->\s*'lat'\s*\)\s*<>\s*'number'/i.test(body) &&
    /NOT\s+BETWEEN\s+-90::numeric\s+AND\s+90::numeric/i.test(body) &&
    /NOT\s+BETWEEN\s+-180::numeric\s+AND\s+180::numeric/i.test(body) &&
    /path_geometry\s*->\s*0\s*->>\s*'lat'/i.test(body));
  check(section, 'migration is data-only and touches no unrelated persistence domain',
    !/\bALTER\s+TABLE\b/i.test(body) &&
    !/\bCREATE\s+(?:TABLE|INDEX|FUNCTION|POLICY)\b/i.test(body) &&
    !/\bDROP\b/i.test(body) &&
    !/\bGRANT\b/i.test(body) &&
    !/\bREVOKE\b/i.test(body) &&
    !/\b(?:room_schedules|vr_scenes|vr_hotspots|app_sessions|users)\b/i.test(body));

  const immutable = {
    '0014_route_graph_accuracy.sql': 'ad9179bd0def19567b512e495fd3133211288e253c872b260421a912cc44e6aa',
    '0015_route_edge_path_geometry.sql': 'e7c6d828faf07c53d923ed58651a0abb8a834273eefa38aa0c04fbf492f70c99',
    '0016_route_geometry_admin_writes.sql': 'e567239f81a6ae6190b8fa66a044126204ca0ef5f64bb80c7960a921ecad7dcf',
    '0017_route_topology_guard_house.sql': 'bc0b3f38a186b321b3c9c53e4c6f9b7abd8e440da12e1fe25e5400b823670997',
    '0018_cas_building_baseline.sql': '2f38221806b98c0aefa0575b180d65b8c3ec86682d83080b1d2aebac62399e48'
  };
  const hashesMatch = Object.entries(immutable).every(([file, expected]) => {
    const canonicalBytes = fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n');
    const actual = crypto
      .createHash('sha256')
      .update(canonicalBytes, 'utf8')
      .digest('hex');
    return actual === expected;
  });
  check(section, 'owner-applied migrations 0014-0018 remain byte-for-byte unchanged', hashesMatch);
}

function runSourceTests() {
  const section = 'source-seed';
  const casRows = canonicalData.buildings.filter(
    (building) => parity.canonicalKey(building.name) === parity.canonicalKey(parity.TARGET.casName)
  );
  check(section, 'models/data.js contains one canonical CAS row with reviewed public values',
    canonicalData.buildings.length === parity.PINNED.buildings &&
    casRows.length === 1 &&
    casRows[0].category === parity.TARGET.casCategory &&
    casRows[0].desc === parity.TARGET.casDescription &&
    Number(casRows[0].lat) === parity.TARGET.casLat &&
    Number(casRows[0].lng) === parity.TARGET.casLng);

  const seed = fs.readFileSync(path.join(__dirname, '..', 'database', 'seed.js'), 'utf8')
    .replace(/\/\/[^\n]*/g, '');
  const utility = fs.readFileSync(
    path.join(__dirname, 'applyBe5SelectedDemoParityMysql.js'),
    'utf8'
  );
  check(section, 'fresh-install seed carries the combined main-gate label',
    /\{\s*key:\s*'main-gate'[\s\S]{0,180}label:\s*'Guard House \/ Main Gate'/i.test(seed));
  check(section, 'fresh-install seed carries the full-precision CAS node endpoint',
    /\{\s*key:\s*'cas'[\s\S]{0,220}lat:\s*13\.40594916[\s\S]{0,80}lng:\s*123\.37704274/i.test(seed));
  check(section, 'fresh-install seed defines east-walk to CAS once and derives reverse geometry mechanically',
    /\{\s*a:\s*'east-walk'\s*,\s*b:\s*'cas'[\s\S]{0,240}13\.40583[\s\S]{0,120}13\.40592/i.test(seed) &&
    /reversePathGeometry\s*\(/.test(seed));
  check(section, 'backup verification recomputes semantics from the written snapshot',
    /analyzeState\s*\(\s*verify\.selected_demo_state\s*\)/.test(utility) &&
    /verifiedState\.semanticFingerprint\s*!==\s*semanticFingerprint/.test(utility));
  check(section, 'utility mutation SQL is restricted to buildings, route_nodes, and route_edges',
    !/\b(?:UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+(?:vr_scenes|vr_hotspots|room_schedules|app_sessions|users)\b/i.test(utility));
}

(async () => {
  console.log('=== CampuSphere BE.5 selected-demo parity pure safety probe ===');
  console.log('\n-- Plan and semantic fingerprint --');
  runPurePlanTests();
  console.log('\n-- Transaction, backup, rollback, and post-commit behavior --');
  await runTransactionTests();
  console.log('\n-- MySQL connection lifecycle --');
  await runConnectionTests();
  console.log('\n-- Migration 0019 static safety --');
  runMigrationTests();
  console.log('\n-- Canonical source and fresh-install seed --');
  runSourceTests();

  console.log('');
  if (failures.length === 0) {
    console.log('BE5-SELECTED-DEMO-PARITY-PROBE OK: all pure/static checks passed.');
    process.exitCode = 0;
  } else {
    console.error(`BE5-SELECTED-DEMO-PARITY-PROBE FAILED: ${failures.length} check(s) did not pass:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
  }
})().catch((error) => {
  console.error('BE5-SELECTED-DEMO-PARITY-PROBE crashed:', error && error.message ? error.message : 'unknown');
  process.exitCode = 1;
});
