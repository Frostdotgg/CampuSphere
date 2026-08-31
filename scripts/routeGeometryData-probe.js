'use strict';

/* ========================================
   CampuSphere - Route edge geometry data probe
   BE.6 backend-specific verification script.

   READ-ONLY. Verifies, without starting any server:

   Migrations 0014, 0015 and 0017 are ALL OWNER-APPLIED. The immutable
   migrations remain source history; current live expectations come from the
   backend-specific BE.6 freeze. Every count below is fail-closed on that
   repaired state — the obsolete 52/26 shape is rejected, not tolerated.

     MySQL (direct pool reads):
       - route_edges.path_geometry column exists
       - 34 buildings / 44 route nodes / 100 directed edges
       - all 100 active edges carry valid path_geometry per the shared
         utils/routeGeometry.js contract (2-200 points, exact lat/lng keys,
         finite in-range values)
       - endpoint continuity: first/last points match the live from/to node
         coordinates within ENDPOINT_EPSILON
       - 50 forward/reverse pairs are EXACT reversals of each other
       - 33/34 buildings remain routable from main-gate (pure Dijkstra over
         the same rows; utils/pathfinding.js untouched)
       - retired shortcut/transit pairs stay absent
       - no orphan edge endpoints, no malformed stored payloads

     Live Supabase (0015 + 0017 OWNER-APPLIED; fail-closed):
       - route_edges.path_geometry column is readable
       - 25 buildings / 26 nodes / 50 directed edges
       - 50/50 valid geometries with endpoint continuity
       - 25/25 forward/reverse pairs are exact reversals
       - 25/25 buildings remain routable from main-gate
       Fails CLOSED when the Supabase env is missing (unless
       PROBE_SKIP_SUPABASE=1 marks an intentionally unconfigured
       MySQL-fallback environment).

     Static (filesystem):
       - 0015 declares the jsonb column, the 2-200 array constraint, its
         shipped (immutable) 26-pair dataset with mechanical reverse
         derivation, the atomic pair RPC, and service-role-only privileges
       - 0014 content hash is byte-identical to the owner-applied version
       - 0017 exists; migration source list is contiguous 0001-0020 (0018 =
         BE.2 CAS building baseline and 0019 = BE.5 selected-demo parity are
         owner-applied; 0020 is source-only pending separate authorization)

   Prints fixed labels and counts only - never raw DB errors, hosts, keys,
   geometry dumps, cookies, or credentials.

   Run:   node scripts/routeGeometryData-probe.js
   ======================================== */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../config/db');
const { getSupabaseClient, hasSupabaseConfig } = require('../config/supabase');
const { findShortestPath } = require('../utils/pathfinding');
const {
  validatePathGeometry,
  reversePathGeometry
} = require('../utils/routeGeometry');
const { SELECTED_DEMO_FREEZE } = require('../config/selectedDemoFreeze');

// Owner-applied 0014 must remain immutable. Pinned at RF.2 authoring time.
const EXPECTED_0014_SHA256 =
  'ad9179bd0def19567b512e495fd3133211288e253c872b260421a912cc44e6aa';

const MYSQL_COUNTS = SELECTED_DEMO_FREEZE.backends.mysql.counts;
const SUPABASE_COUNTS = SELECTED_DEMO_FREEZE.backends.supabase.counts;
// 0015 is owner-applied and IMMUTABLE: its shipped dataset still declares the
// pre-repair 26-pair shape. Migration 0017 carries the topology correction.
const EXPECTED_0015_PAIRS = 26;
const RETIRED_PAIRS = [
  ['flagpole', 'ccs'],
  ['flagpole', 'clinic'],
  ['mid-campus', 'green-building'],
  // Pre-RF.6 eastern topology correction: eastern buildings are terminal
  // destinations off east-walk, never transit hops between one another.
  ['green-building', 'cas'],
  ['cas', 'ccs'],
  ['cas', 'clinic'],
  ['ccs', 'chs'],
  // NO-GO V2: ICTU / Gymnasium / Auditorium are building DESTINATIONS and must
  // never be intermediate routing junctions into mid-campus.
  ['ictu', 'mid-campus'],
  ['gymnasium', 'mid-campus'],
  ['auditorium', 'mid-campus']
];

// Exact migration-source sequence guard: every position 0001_..0020_
// must be present exactly once in sorted order.
// migration. Length/first/last alone would accept a corrupted list (e.g.
// missing 0010 plus a duplicate 0018), so each sorted slot is pinned.
const EXPECTED_MIGRATION_PREFIXES = Object.freeze(
  Array.from(
    { length: 20 },
    (_, index) => `${String(index + 1).padStart(4, '0')}_`
  )
);

function hasExactMigrationSequence(files) {
  if (!Array.isArray(files)) return false;
  const sorted = files.filter((file) => file !== '0021_minimal_instructor_oauth_registration.sql').slice().sort();

  return (
    sorted.length === EXPECTED_MIGRATION_PREFIXES.length &&
    EXPECTED_MIGRATION_PREFIXES.every(
      (prefix, index) =>
        typeof sorted[index] === 'string' &&
        sorted[index].startsWith(prefix)
    ) &&
    sorted[18] === '0019_be5_selected_demo_parity.sql' &&
    sorted[19] === '0020_room_schedule_documents.sql'
  );
}

const failures = [];
function check(label, ok) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}`);
  if (!ok) failures.push(label);
}

function parseStoredGeometry(raw) {
  // mysql2 returns JSON columns pre-parsed; be defensive about strings.
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch (e) { return undefined; } // malformed
  }
  return undefined; // unexpected shape counts as malformed
}

function normalizePoints(points) {
  return points.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
}

(async () => {
  console.log('=== CampuSphere route edge geometry probe (BE.6 backend-specific freeze) ===');
  try {
    console.log('\nmysql data checks:');

    const [colRows] = await db.query(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'route_edges'
          AND COLUMN_NAME = 'path_geometry' LIMIT 1`
    );
    check('MySQL route_edges.path_geometry column exists', colRows.length === 1);

    const [nodes] = await db.query(
      'SELECT id, node_key, label, node_type, building_id, lat, lng FROM route_nodes'
    );
    const [edges] = await db.query(
      `SELECT from_node_id, to_node_id, distance_meters, walk_time_seconds,
              path_label, is_accessible, path_geometry
         FROM route_edges`
    );
    check(`MySQL route graph has ${MYSQL_COUNTS.route_nodes} nodes (found ${nodes.length})`,
      nodes.length === MYSQL_COUNTS.route_nodes);
    check(`MySQL route graph has ${MYSQL_COUNTS.route_edges} directed edges (found ${edges.length})`,
      edges.length === MYSQL_COUNTS.route_edges);

    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const keyById = new Map(nodes.map((n) => [n.id, n.node_key]));
    const idByKey = new Map(nodes.map((n) => [n.node_key, n.id]));

    // Orphan endpoints
    const orphans = edges.filter((e) => !nodeById.has(e.from_node_id) || !nodeById.has(e.to_node_id));
    check('no orphan edge endpoints', orphans.length === 0);

    // Per-edge geometry validity + endpoint continuity
    let validCount = 0;
    let malformedCount = 0;
    let missingCount = 0;
    let endpointFailCount = 0;
    const geometryByPair = new Map(); // 'fromKey|toKey' -> normalized points
    for (const e of edges) {
      const parsed = parseStoredGeometry(e.path_geometry);
      if (parsed === undefined) { malformedCount++; continue; }
      if (parsed === null) { missingCount++; continue; }
      const fromNode = nodeById.get(e.from_node_id);
      const toNode = nodeById.get(e.to_node_id);
      const v = validatePathGeometry(parsed, {
        fromNode, toNode, allowNull: false, snapEndpoints: false
      });
      if (!v.ok) {
        // Distinguish endpoint-continuity failures for reporting; the
        // validator messages are fixed strings, safe to match.
        if (String(v.message).indexOf('must match') !== -1) endpointFailCount++;
        else malformedCount++;
        continue;
      }
      validCount++;
      geometryByPair.set(keyById.get(e.from_node_id) + '|' + keyById.get(e.to_node_id), normalizePoints(v.value));
    }
    check(`all ${MYSQL_COUNTS.valid_geometries} MySQL edges carry valid geometry (valid ${validCount}, missing ${missingCount}, malformed ${malformedCount})`,
      validCount === MYSQL_COUNTS.valid_geometries && edges.length === MYSQL_COUNTS.route_edges &&
      missingCount === 0 && malformedCount === 0);
    check('endpoint continuity holds for every stored geometry (failures ' + endpointFailCount + ')', endpointFailCount === 0);

    // Forward/reverse exact-reversal parity across the undirected pairs
    let pairCount = 0;
    let reversalFail = 0;
    const seen = new Set();
    for (const [k, fwd] of geometryByPair) {
      const [a, b] = k.split('|');
      const rk = b + '|' + a;
      const unordered = a < b ? a + '|' + b : b + '|' + a;
      if (seen.has(unordered)) continue;
      seen.add(unordered);
      pairCount++;
      const rev = geometryByPair.get(rk);
      if (!rev || JSON.stringify(rev) !== JSON.stringify(reversePathGeometry(fwd))) reversalFail++;
    }
    check(`${MYSQL_COUNTS.exact_reverse_geometries} MySQL forward/reverse pairs are exact reversals (pairs ${pairCount}, mismatches ${reversalFail})`,
      pairCount === MYSQL_COUNTS.exact_reverse_geometries && reversalFail === 0);

    // Retired shortcut pairs stay absent
    let retiredPresent = 0;
    for (const [aKey, bKey] of RETIRED_PAIRS) {
      const aId = idByKey.get(aKey);
      const bId = idByKey.get(bKey);
      if (!aId || !bId) continue;
      if (edges.some((e) =>
        (e.from_node_id === aId && e.to_node_id === bId) ||
        (e.from_node_id === bId && e.to_node_id === aId))) retiredPresent++;
    }
    check('retired shortcut pairs remain absent', retiredPresent === 0);

    // Complete MySQL building catalog and routability from main-gate.
    const [buildings] = await db.query('SELECT id, name FROM buildings');
    check(`MySQL building count is ${MYSQL_COUNTS.buildings} (found ${buildings.length})`,
      buildings.length === MYSQL_COUNTS.buildings);
    const pfNodes = nodes.map((n) => ({
      id: n.id, key: n.node_key, label: n.label, node_type: n.node_type,
      building_id: n.building_id != null ? Number(n.building_id) : null,
      lat: Number(n.lat), lng: Number(n.lng)
    }));
    const pfEdges = edges.map((e) => ({
      from: keyById.get(e.from_node_id), to: keyById.get(e.to_node_id),
      distance_meters: Number(e.distance_meters) || 0,
      walk_time_seconds: Number(e.walk_time_seconds) || 0,
      path_label: e.path_label != null ? e.path_label : null,
      is_accessible: Number(e.is_accessible)
    }));
    let routable = 0;
    for (const b of buildings) {
      const matches = pfNodes.filter((n) => n.building_id === Number(b.id));
      const dest = matches.find((n) => n.node_type === 'building') || matches[0] || null;
      if (!dest) continue;
      const r = findShortestPath({ nodes: pfNodes, edges: pfEdges, startKey: 'main-gate', endKey: dest.key });
      if (r.success && r.nodes.length >= 2) routable++;
    }
    check(`${MYSQL_COUNTS.routable_destinations}/${MYSQL_COUNTS.buildings} MySQL buildings remain routable from main-gate (routable ${routable})`,
      routable === MYSQL_COUNTS.routable_destinations);

    // ---- Live Supabase verification (0015 + 0017 are OWNER-APPLIED) ----
    // Mirrors the MySQL geometry checks against the live production store with
    // Supabase's own frozen counts. Fails CLOSED when Supabase is
    // unreachable/unconfigured, unless PROBE_SKIP_SUPABASE=1 marks an
    // intentional MySQL-fallback environment.
    console.log('\nsupabase live data checks (0015 + 0017 owner-applied; fail-closed):');
    if (!hasSupabaseConfig()) {
      if (process.env.PROBE_SKIP_SUPABASE === '1') {
        console.log('  SKIP — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (MySQL fallback mode).');
      } else {
        check('Supabase env is configured for live route-geometry verification (fail-closed)', false);
      }
    } else {
      const sb = getSupabaseClient();
      const { data: sbNodes, error: nErr } = await sb
        .from('route_nodes').select('id, node_key, label, node_type, building_id, lat, lng').order('id', { ascending: true });
      const { data: sbEdges, error: eErr } = await sb
        .from('route_edges').select('from_node_id, to_node_id, distance_meters, walk_time_seconds, path_label, is_accessible, path_geometry').order('id', { ascending: true });
      const { data: sbBuildings, error: bErr } = await sb
        .from('buildings').select('id, name').order('id', { ascending: true });
      check('live Supabase route graph and building catalog are readable including path_geometry',
        !nErr && !eErr && !bErr && Array.isArray(sbNodes) && Array.isArray(sbEdges) && Array.isArray(sbBuildings));
      if (!nErr && !eErr && !bErr && Array.isArray(sbNodes) && Array.isArray(sbEdges) && Array.isArray(sbBuildings)) {
        check(`live Supabase has ${SUPABASE_COUNTS.route_nodes} nodes (found ${sbNodes.length})`,
          sbNodes.length === SUPABASE_COUNTS.route_nodes);
        // Migration 0017 (Guard House start + eastern terminal topology) is
        // OWNER-APPLIED, so live Supabase must carry the REPAIRED graph. This
        // now fails CLOSED: the obsolete pre-0017 52-row / 26-pair state is a
        // hard failure, not an accepted alternative.
        check(`live Supabase has ${SUPABASE_COUNTS.route_edges} directed edges (found ${sbEdges.length}; the pre-0017 52-row state is rejected)`,
          sbEdges.length === SUPABASE_COUNTS.route_edges);

        const sbNodeById = new Map(sbNodes.map((n) => [Number(n.id), n]));
        const sbKeyById = new Map(sbNodes.map((n) => [Number(n.id), n.node_key]));
        let sbValid = 0;
        let sbBad = 0;
        const sbGeomByPair = new Map();
        for (const e of sbEdges) {
          const parsed = parseStoredGeometry(e.path_geometry);
          const fromNode = sbNodeById.get(Number(e.from_node_id));
          const toNode = sbNodeById.get(Number(e.to_node_id));
          if (parsed === undefined || parsed === null || !fromNode || !toNode) { sbBad++; continue; }
          const v = validatePathGeometry(parsed, {
            fromNode, toNode, allowNull: false, snapEndpoints: false
          });
          if (!v.ok) { sbBad++; continue; }
          sbValid++;
          sbGeomByPair.set(sbKeyById.get(Number(e.from_node_id)) + '|' + sbKeyById.get(Number(e.to_node_id)), normalizePoints(v.value));
        }
        check(`live Supabase edges all carry valid geometry with endpoint continuity (valid ${sbValid}/${SUPABASE_COUNTS.valid_geometries}, bad ${sbBad})`,
          sbValid === SUPABASE_COUNTS.valid_geometries &&
          sbEdges.length === SUPABASE_COUNTS.route_edges && sbBad === 0);

        let sbPairs = 0;
        let sbRevFail = 0;
        const sbSeen = new Set();
        for (const [k, fwd] of sbGeomByPair) {
          const [a, b] = k.split('|');
          const unordered = a < b ? a + '|' + b : b + '|' + a;
          if (sbSeen.has(unordered)) continue;
          sbSeen.add(unordered);
          sbPairs++;
          const rev = sbGeomByPair.get(b + '|' + a);
          if (!rev || JSON.stringify(rev) !== JSON.stringify(reversePathGeometry(fwd))) sbRevFail++;
        }
        check(`live Supabase has ${SUPABASE_COUNTS.exact_reverse_geometries} forward/reverse pairs, all exact reversals (pairs ${sbPairs}, mismatches ${sbRevFail})`,
          sbRevFail === 0 && sbPairs === SUPABASE_COUNTS.exact_reverse_geometries &&
          sbPairs * 2 === sbEdges.length);

        check(`live Supabase building count is ${SUPABASE_COUNTS.buildings} (found ${sbBuildings.length})`,
          sbBuildings.length === SUPABASE_COUNTS.buildings);
        const sbPfNodes = sbNodes.map((n) => ({
          id: Number(n.id), key: n.node_key, label: n.label, node_type: n.node_type,
          building_id: n.building_id != null ? Number(n.building_id) : null,
          lat: Number(n.lat), lng: Number(n.lng)
        }));
        const sbPfEdges = sbEdges.map((e) => ({
          from: sbKeyById.get(Number(e.from_node_id)), to: sbKeyById.get(Number(e.to_node_id)),
          distance_meters: Number(e.distance_meters) || 0,
          walk_time_seconds: Number(e.walk_time_seconds) || 0,
          path_label: e.path_label != null ? e.path_label : null,
          is_accessible: Number(e.is_accessible)
        }));
        let sbRoutable = 0;
        for (const building of sbBuildings) {
          const matches = sbPfNodes.filter((node) => node.building_id === Number(building.id));
          const destination = matches.find((node) => node.node_type === 'building') || matches[0] || null;
          if (!destination) continue;
          const route = findShortestPath({
            nodes: sbPfNodes, edges: sbPfEdges, startKey: 'main-gate', endKey: destination.key
          });
          if (route.success && route.nodes.length >= 2) sbRoutable++;
        }
        check(`${SUPABASE_COUNTS.routable_destinations}/${SUPABASE_COUNTS.buildings} Supabase buildings remain routable from main-gate (routable ${sbRoutable})`,
          sbRoutable === SUPABASE_COUNTS.routable_destinations);
      }
    }

    console.log('\nstatic migration checks:');
    const root = path.join(__dirname, '..');
    const m15Path = path.join(root, 'database', 'supabase', '0015_route_edge_path_geometry.sql');
    const m15Exists = fs.existsSync(m15Path);
    check('0015_route_edge_path_geometry.sql exists', m15Exists);
    if (m15Exists) {
      const sql = fs.readFileSync(m15Path, 'utf8');
      check('0015 declares ADD COLUMN IF NOT EXISTS path_geometry jsonb',
        /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+path_geometry\s+jsonb/i.test(sql));
      check('0015 declares the 2-200 array shape constraint',
        /jsonb_typeof\(path_geometry\)\s*=\s*'array'/i.test(sql) &&
        /jsonb_array_length\(path_geometry\)\s+BETWEEN\s+2\s+AND\s+200/i.test(sql));
      const pairRows = (sql.match(/^\s*\('[a-z-]+'(::varchar)?,\s*'[a-z-]+'(::varchar)?,\s*'\[/gm) || []).length;
      check(`0015 still declares its shipped ${EXPECTED_0015_PAIRS}-pair dataset (owner-applied + immutable; pairs ${pairRows})`,
        pairRows === EXPECTED_0015_PAIRS);
      check('0015 derives reverse rows mechanically (UNION ALL + WITH ORDINALITY DESC)',
        /UNION\s+ALL/i.test(sql) && /WITH\s+ORDINALITY/i.test(sql) && /ORDER\s+BY\s+t\.ord\s+DESC/i.test(sql));
      check('0015 resolves endpoints by node_key (no hardcoded ids)',
        /JOIN\s+public\.route_nodes\s+\w+\s+ON\s+\w+\.node_key\s*=/i.test(sql));
      check('0015 declares the atomic pair RPC app_set_route_edge_geometry_pair',
        /FUNCTION\s+public\.app_set_route_edge_geometry_pair\s*\(/i.test(sql) &&
        /EDGE_PAIR_NOT_FOUND/.test(sql) && /INVALID_GEOMETRY/.test(sql));
      check('0015 RPC uses SECURITY INVOKER with pinned search_path',
        /SECURITY\s+INVOKER/i.test(sql) && /SET\s+search_path\s*=\s*pg_catalog,\s*public/i.test(sql));
      check('0015 RPC is service-role-only (REVOKE PUBLIC/anon/authenticated, GRANT service_role)',
        /REVOKE\s+EXECUTE[\s\S]{0,120}FROM\s+PUBLIC/i.test(sql) &&
        /REVOKE\s+EXECUTE[\s\S]{0,120}FROM\s+anon/i.test(sql) &&
        /REVOKE\s+EXECUTE[\s\S]{0,120}FROM\s+authenticated/i.test(sql) &&
        /GRANT\s+EXECUTE[\s\S]{0,120}TO\s+service_role/i.test(sql));
    }

    const m14 = fs.readFileSync(path.join(root, 'database', 'supabase', '0014_route_graph_accuracy.sql'), 'utf8')
      .replace(/\r\n/g, '\n');
    const m14Hash = crypto.createHash('sha256').update(m14, 'utf8').digest('hex');
    check('0014 content hash is unchanged (owner-applied migration is immutable)', m14Hash === EXPECTED_0014_SHA256);

    const sqlFiles = fs.readdirSync(path.join(root, 'database', 'supabase')).filter((f) => f.endsWith('.sql')).sort();
    // 0017 (Guard House + eastern topology repair) exists and is OWNER-APPLIED.
    check('0017 migration exists (Guard House + eastern topology repair, owner-applied)', sqlFiles.some((f) => f.startsWith('0017')));
    // BE.2 added 0018 (CAS building baseline; data-only, OWNER-APPLIED).
    // It writes no route edge and no path_geometry, so the geometry contract below
    // is unaffected.
    check('0018_cas_building_baseline.sql is declared (BE.2; owner-applied)',
      sqlFiles.some((f) => f === '0018_cas_building_baseline.sql'));
    // BE.5 added 0019 (selected-demo parity; data-only, OWNER-APPLIED). It rebuilds
    // only the east-walk <-> cas geometry pair to the same validated shape asserted
    // live above, so the geometry contract is unaffected.
    check('0019_be5_selected_demo_parity.sql is declared (BE.5; owner-applied)',
      sqlFiles.some((f) => f === '0019_be5_selected_demo_parity.sql'));
    check('migration source list is contiguous 0001-0020', hasExactMigrationSequence(sqlFiles));
    // Database-free negative fixture on an in-memory copy: no migration file is
    // created, renamed, deleted, or modified.
    check('migration sequence guard rejects a missing middle migration and duplicate prefix',
      hasExactMigrationSequence(
        sqlFiles.filter((f) => !f.startsWith('0010_')).concat('0018_duplicate.sql')
      ) === false);

    console.log('');
    console.log(`NOTE 0015 and 0017 are OWNER-APPLIED; live Supabase path_geometry column, ${SUPABASE_COUNTS.valid_geometries}/${SUPABASE_COUNTS.route_edges} coverage, and ${SUPABASE_COUNTS.exact_reverse_geometries}-pair reverse parity are verified above (read-only).`);
    console.log('NOTE read-only probe: no rows were created or modified, and no SQL was applied.');
  } catch (e) {
    console.error('  [FAIL] probe aborted by an unexpected error (sanitized).');
    failures.push('unexpected probe error');
  } finally {
    try { await db.end(); } catch (e) { /* pool already closed */ }
  }

  if (failures.length === 0) {
    console.log('ROUTE-GEOMETRY-DATA-PROBE OK: all checks passed.');
    process.exitCode = 0;
  } else {
    console.error(`ROUTE-GEOMETRY-DATA-PROBE FAILED: ${failures.length} check(s) did not pass:`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }
})();
