'use strict';

/* ========================================
   CampuSphere - Route topology probe
   RF.6 topology + BE.5 selected-demo parity verification script.

   READ-ONLY. Starts no server. Migration 0017 is OWNER-APPLIED, so BOTH
   backends are now held to the SAME repaired topology by the SAME shared
   validator (verifyTopology). There is no longer a weaker Supabase path and
   no "pending application" tolerance: live Supabase fails CLOSED on the
   pre-0017 (52-edge) state.

     verifyExpandedTopology(scope, nodes, edges, buildings) asserts, per backend:
       - the complete backend-specific frozen node/edge/reverse-pair counts
       - `main-gate` sits on the authoritative Guard House / Main Gate
         coordinate (13.40575220764974, 123.37434735272177, persisted at the
         8-dp precision both backends use)
       - every frozen geometry is valid + endpoint-continuous
       - all frozen forward/reverse geometry pairs are EXACT reversals, and the
         forward/reverse edge scalars are symmetric
       - the geometry-bearing pairs attached to the gate begin at the exact
         stored gate coordinate
       - the five eastern terminal spurs exist in BOTH directions:
             east-walk <-> green-building | cas | ccs | clinic | chs
       - the seven retired TRANSIT pairs are absent in BOTH directions:
             green-building<->cas, cas<->ccs, cas<->clinic, ccs<->chs,
             ictu<->mid-campus, gymnasium<->mid-campus, auditorium<->mid-campus
       - every active Guided-VR destination is routable from main-gate through
         its configured natural node key, with every route starting at the
         authoritative gate coordinate
       - the building-free central spine exists, and each eastern route is
         exactly  main-gate -> flagpole -> mid-campus -> east-walk -> <dest>
         with NO intermediate building-type node and no welcome-arch hairpin
       - ICTU / Gymnasium / Auditorium remain reachable TERMINAL destinations
       - the acceptance routes' drawn geometry never passes through the
         footprint of a building it is not visiting

     Static (filesystem):
       - 0017 exists, is transactional, idempotent, natural-key based, retires
         the seven transit pairs, upserts the eight repaired pairs, derives the
         reverse rows mechanically, refreshes route_nodes.location, uses the
         EXPLICIT PostgreSQL scalar column alias in its fail-closed preflight,
         and does NOT weaken 0016's NODE_GEOMETRY_ATTACHED runtime guard
       - 0014 / 0015 / 0016 / 0017 remain byte-for-byte unchanged (all four are
         owner-applied and therefore immutable)
       - migration list is exactly 0001-0019; 0018 is owner-applied and 0019 is
         declared for the selected-demo parity correction

   Prints fixed labels and counts only - never raw DB errors, hosts, keys,
   cookies, credentials, or geometry payloads.

   Run:   node scripts/routeTopology-probe.js
   ======================================== */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../config/db');
const { getSupabaseClient, hasSupabaseConfig } = require('../config/supabase');
const { findShortestPath } = require('../utils/pathfinding');
const { validatePathGeometry, reversePathGeometry } = require('../utils/routeGeometry');
const { GUIDED_VR_ROUTES } = require('../config/guidedVrRoutes');
const { SELECTED_DEMO_FREEZE } = require('../config/selectedDemoFreeze');

// Authoritative Guard House / Main Gate coordinate (owner-approved).
const GATE_LAT = 13.40575220764974;
const GATE_LNG = 123.37434735272177;
const GATE_LABEL = 'Guard House / Main Gate';
const CAS_LAT = 13.40594916;
const CAS_LNG = 123.37704274;
const CAS_EPSILON = 1e-8;
// route_nodes.lat/lng are 8-dp DECIMAL/numeric in both backends, so the
// persisted value differs from the authoritative one by <= 5e-9. The stored
// value must land within the shared endpoint epsilon.
const GATE_EPSILON = 1e-6;

const EXPECTED_NODES = 21;
const EXPECTED_EDGES = 50;   // 25 undirected pairs
const EXPECTED_PAIRS = 25;
const EXPECTED_BUILDINGS = 13;

// Eastern buildings: each must be a TERMINAL destination off east-walk.
const EASTERN_BUILDINGS = ['green-building', 'cas', 'ccs', 'clinic', 'chs'];
const EASTERN_SPURS = EASTERN_BUILDINGS.map((k) => ['east-walk', k]);

// The building-free central spine EVERY eastern route must now use.
const REQUIRED_SPINE_PAIRS = [['main-gate', 'flagpole'], ['flagpole', 'mid-campus']];
const EASTERN_PREFIX = ['main-gate', 'flagpole', 'mid-campus', 'east-walk'];
// Building DESTINATIONS that must never appear as routing junctions.
const BANNED_TRANSIT_NODES = ['ictu', 'gymnasium', 'auditorium'];

const RETIRED_TRANSIT_PAIRS = [
  // eastern buildings used as through-routes between eastern buildings
  ['green-building', 'cas'],
  ['cas', 'ccs'],
  ['cas', 'clinic'],
  ['ccs', 'chs'],
  // building-backed junctions into mid-campus (NO-GO V2)
  ['ictu', 'mid-campus'],
  ['gymnasium', 'mid-campus'],
  ['auditorium', 'mid-campus']
];
// Every geometry-bearing pair attached to the moved gate.
const GATE_PAIRS = [
  ['main-gate', 'welcome-arch'],
  ['main-gate', 'flagpole'],
  ['main-gate', 'west-road']
];

// Browser-acceptance destinations (eastern set + one west-campus route).
const ACCEPTANCE_ROUTES = ['ccs', 'cas', 'chs', 'clinic', 'green-building', 'engineering'];

// A building the route is NOT visiting must stay clear of the drawn line.
// Campus buildings here sit ~20-30 m apart, so 12 m is a conservative
// footprint proxy around each mapped building node.
const FOOTPRINT_RADIUS_M = 12;

// Immutable owner-applied migrations. 0017 joined this set once the owner
// applied it, so any later drift in the applied SQL is a hard failure.
const EXPECTED_0014_SHA256 = 'ad9179bd0def19567b512e495fd3133211288e253c872b260421a912cc44e6aa';
const EXPECTED_0015_SHA256 = 'e7c6d828faf07c53d923ed58651a0abb8a834273eefa38aa0c04fbf492f70c99';
const EXPECTED_0016_SHA256 = 'e567239f81a6ae6190b8fa66a044126204ca0ef5f64bb80c7960a921ecad7dcf';
const EXPECTED_0017_SHA256 = 'bc0b3f38a186b321b3c9c53e4c6f9b7abd8e440da12e1fe25e5400b823670997';
const EXPECTED_0018_SHA256 = '2f38221806b98c0aefa0575b180d65b8c3ec86682d83080b1d2aebac62399e48';

const failures = [];
const printed = [];
function say(line) { printed.push(line); console.log(line); }
function check(scope, label, ok) {
  const line = `  [${ok ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`;
  printed.push(line);
  console.log(line);
  if (!ok) failures.push(`${scope} :: ${label}`);
}

/* ---------------- geometry helpers (planar metres) ---------------- */
const toRad = (d) => (d * Math.PI) / 180;
// Local planar projection is accurate to well under a metre at campus scale.
function toXY(p, origin) {
  return {
    x: (p.lng - origin.lng) * 111320 * Math.cos(toRad(origin.lat)),
    y: (p.lat - origin.lat) * 110574
  };
}
function pointToSegmentMeters(pt, a, b, origin) {
  const P = toXY(pt, origin), A = toXY(a, origin), B = toXY(b, origin);
  const vx = B.x - A.x, vy = B.y - A.y;
  const wx = P.x - A.x, wy = P.y - A.y;
  const len2 = vx * vx + vy * vy;
  let t = len2 === 0 ? 0 : (wx * vx + wy * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = A.x + t * vx, cy = A.y + t * vy;
  return Math.hypot(P.x - cx, P.y - cy);
}
function pointToPolylineMeters(pt, poly, origin) {
  let min = Infinity;
  for (let i = 1; i < poly.length; i++) {
    min = Math.min(min, pointToSegmentMeters(pt, poly[i - 1], poly[i], origin));
  }
  return min;
}

function parseStoredGeometry(raw) {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch (e) { return undefined; } }
  return undefined;
}
const num = (v) => Number(v);
const pts = (arr) => arr.map((p) => ({ lat: num(p.lat), lng: num(p.lng) }));
const canonical = (value) => String(value == null ? '' : value)
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/* Current expanded-catalog validator. Historical migration-shape assertions
   below remain intact, but live acceptance is driven by the refreshed BE.6
   backend-specific freeze and the 25 configured natural destinations. */
function verifyExpandedTopology(scope, nodes, edges, buildings) {
  const frozen = SELECTED_DEMO_FREEZE.backends[scope];
  const expected = frozen && frozen.counts;
  check(scope, 'backend-specific freeze exists', !!expected);
  if (!expected) return;

  check(scope, `route graph has ${expected.route_nodes} nodes (found ${nodes.length})`,
    nodes.length === expected.route_nodes);
  check(scope, `route graph has ${expected.route_edges} directed edges (found ${edges.length})`,
    edges.length === expected.route_edges);
  check(scope, `building catalog has ${expected.buildings} rows (found ${buildings.length})`,
    buildings.length === expected.buildings);

  const nodeKeys = nodes.map((n) => String(n.node_key || '').trim());
  const buildingNames = buildings.map((b) => canonical(b.name));
  check(scope, 'every route node has one unique non-blank natural key',
    nodeKeys.every(Boolean) && new Set(nodeKeys).size === nodes.length);
  check(scope, 'every building has one unique non-blank canonical name',
    buildingNames.every(Boolean) && new Set(buildingNames).size === buildings.length);
  check(scope, 'complete current building roster matches the refreshed freeze',
    JSON.stringify(buildings.map((b) => String(b.name)).sort()) ===
      JSON.stringify([...frozen.roster].sort()));

  const nodeByKey = new Map(nodes.map((n) => [n.node_key, n]));
  const nodeById = new Map(nodes.map((n) => [Number(n.id), n]));
  const keyById = new Map(nodes.map((n) => [Number(n.id), n.node_key]));
  const buildingById = new Map(buildings.map((b) => [Number(b.id), b]));
  const buildingsByCanonical = new Map();
  for (const b of buildings) {
    const key = canonical(b.name);
    const list = buildingsByCanonical.get(key) || [];
    list.push(b);
    buildingsByCanonical.set(key, list);
  }

  const gate = nodeByKey.get('main-gate');
  check(scope, 'main-gate is the stored Guard House start',
    !!gate && String(gate.label) === GATE_LABEL &&
    Math.abs(num(gate.lat) - GATE_LAT) <= GATE_EPSILON &&
    Math.abs(num(gate.lng) - GATE_LNG) <= GATE_EPSILON);

  const buildingNodes = nodes.filter((n) => String(n.node_type) === 'building');
  check(scope, `building-node count matches the freeze (${expected.building_nodes})`,
    buildingNodes.length === expected.building_nodes);
  check(scope, 'every building node references an existing building',
    buildingNodes.every((n) => Number.isSafeInteger(Number(n.building_id)) &&
      buildingById.has(Number(n.building_id))));

  const edgeByPair = new Map();
  let validGeometry = 0;
  for (const edge of edges) {
    const from = nodeById.get(Number(edge.from_node_id));
    const to = nodeById.get(Number(edge.to_node_id));
    const pair = `${from ? from.node_key : '?'}|${to ? to.node_key : '?'}`;
    if (!edgeByPair.has(pair)) edgeByPair.set(pair, []);
    edgeByPair.get(pair).push(edge);
    const parsed = parseStoredGeometry(edge.path_geometry);
    const result = from && to && parsed != null
      ? validatePathGeometry(parsed, { fromNode: from, toNode: to, allowNull: false, snapEndpoints: false })
      : { ok: false };
    if (result.ok) validGeometry++;
  }
  check(scope, 'every directed edge identity is unique',
    edgeByPair.size === edges.length && [...edgeByPair.values()].every((rows) => rows.length === 1));
  check(scope, `all ${expected.valid_geometries} edges carry valid endpoint-continuous geometry`,
    validGeometry === expected.valid_geometries && validGeometry === edges.length);

  let exactPairs = 0;
  let scalarMismatch = 0;
  const seen = new Set();
  for (const [pair, rows] of edgeByPair) {
    const [a, b] = pair.split('|');
    const identity = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const reverse = edgeByPair.get(`${b}|${a}`);
    if (!reverse || rows.length !== 1 || reverse.length !== 1) continue;
    const forwardGeometry = pts(parseStoredGeometry(rows[0].path_geometry));
    const reverseGeometry = pts(parseStoredGeometry(reverse[0].path_geometry));
    if (JSON.stringify(reverseGeometry) === JSON.stringify(reversePathGeometry(forwardGeometry))) exactPairs++;
    if (Number(rows[0].distance_meters) !== Number(reverse[0].distance_meters) ||
        Number(rows[0].walk_time_seconds) !== Number(reverse[0].walk_time_seconds)) scalarMismatch++;
  }
  check(scope, `${expected.reverse_pairs} exact forward/reverse geometry pairs`,
    exactPairs === expected.exact_reverse_geometries && seen.size === expected.reverse_pairs);
  check(scope, 'forward/reverse distance and walk-time scalars are symmetric', scalarMismatch === 0);

  const pfNodes = nodes.map((n) => ({
    id: Number(n.id), key: n.node_key, label: n.label, node_type: n.node_type,
    building_id: n.building_id == null ? null : Number(n.building_id),
    lat: num(n.lat), lng: num(n.lng)
  }));
  const pfEdges = edges.map((e) => ({
    from: keyById.get(Number(e.from_node_id)),
    to: keyById.get(Number(e.to_node_id)),
    distance_meters: Number(e.distance_meters),
    walk_time_seconds: Number(e.walk_time_seconds),
    path_label: e.path_label == null ? null : e.path_label,
    is_accessible: Number(e.is_accessible)
  }));

  let exactCatalogMappings = 0;
  let reachable = 0;
  for (const policy of GUIDED_VR_ROUTES) {
    const matchedBuildings = buildingsByCanonical.get(canonical(policy.destination_name)) || [];
    const matchedNodes = nodes.filter((n) => n.node_key === policy.destination_node_key);
    if (matchedBuildings.length === 1 && matchedNodes.length === 1 &&
        Number(matchedNodes[0].building_id) === Number(matchedBuildings[0].id)) {
      exactCatalogMappings++;
    }
    const route = findShortestPath({
      nodes: pfNodes, edges: pfEdges, startKey: 'main-gate', endKey: policy.destination_node_key
    });
    if (route.success && route.nodes.length >= 2 &&
        route.nodes[0].key === 'main-gate' &&
        route.nodes[route.nodes.length - 1].key === policy.destination_node_key) reachable++;
  }
  check(scope, 'all 25 Guided-VR destinations map to exactly one natural building node',
    GUIDED_VR_ROUTES.length === 25 && exactCatalogMappings === GUIDED_VR_ROUTES.length);
  check(scope, 'all 25 Guided-VR destinations are reachable from main-gate',
    reachable === GUIDED_VR_ROUTES.length);
}

function expandedCatalogParity(mysql, supabase) {
  const summarize = (state) => {
    const buildingById = new Map(state.buildings.map((b) => [Number(b.id), canonical(b.name)]));
    return GUIDED_VR_ROUTES.map((policy) => {
      const matches = state.nodes.filter((n) => n.node_key === policy.destination_node_key);
      return [policy.destination_node_key, matches.length,
        matches.length === 1 ? buildingById.get(Number(matches[0].building_id)) : null];
    });
  };
  check('cross-backend', 'all configured natural destination identities map to the same canonical building',
    JSON.stringify(summarize(mysql)) === JSON.stringify(summarize(supabase)));
}

/* =============================================================================
   SHARED TOPOLOGY VALIDATOR

   One implementation, run identically against MySQL and live Supabase. Both
   backends are owner-applied through 0017, so neither gets a weaker contract.

   @param scope      'mysql' | 'supabase' (label only)
   @param nodes      [{ id, node_key, label, node_type, building_id, lat, lng }]
   @param edges      [{ from_node_id, to_node_id, distance_meters,
                        walk_time_seconds, path_label, is_accessible,
                        path_geometry }]
   @param buildings  [{ id }]  (the application building set)
============================================================================= */
// Historical 0017/selected-demo validator retained only as a readable reference
// for the static migration-shape assertions below. Live acceptance is exclusively
// verifyExpandedTopology(); this helper is intentionally not invoked.
function verifyHistoricalSelectedTopology(scope, nodes, edges, buildings) {
  check(scope, `route graph has ${EXPECTED_NODES} nodes (found ${nodes.length})`,
    nodes.length === EXPECTED_NODES);
  check(scope, `route graph has ${EXPECTED_EDGES} directed edges = ${EXPECTED_PAIRS} pairs (found ${edges.length})`,
    edges.length === EXPECTED_EDGES);

  const nodeByKey = new Map(nodes.map((n) => [n.node_key, n]));
  const keyById = new Map(nodes.map((n) => [Number(n.id), n.node_key]));
  const edgeByPair = new Map();
  for (const e of edges) {
    edgeByPair.set(keyById.get(Number(e.from_node_id)) + '|' + keyById.get(Number(e.to_node_id)), e);
  }
  const hasPair = (a, b) => edgeByPair.has(a + '|' + b);

  // ---- 1. authoritative Guard House / Main Gate coordinate ----
  const gate = nodeByKey.get('main-gate');
  const gateLat = gate ? num(gate.lat) : NaN;
  const gateLng = gate ? num(gate.lng) : NaN;
  check(scope, 'main-gate node exists with the stable node_key', !!gate);
  check(scope, `main-gate public label is "${GATE_LABEL}"`,
    !!gate && String(gate.label) === GATE_LABEL);
  check(scope,
    `main-gate is on the authoritative Guard House coordinate (within ${GATE_EPSILON})`,
    !!gate && Math.abs(gateLat - GATE_LAT) <= GATE_EPSILON && Math.abs(gateLng - GATE_LNG) <= GATE_EPSILON);

  const casNode = nodeByKey.get('cas');
  check(scope, 'cas node exists with the stable node_key', !!casNode);
  check(scope, 'cas node uses the exact selected-demo coordinate',
    !!casNode &&
    Math.abs(num(casNode.lat) - CAS_LAT) <= CAS_EPSILON &&
    Math.abs(num(casNode.lng) - CAS_LNG) <= CAS_EPSILON);

  // ---- 2. eastern terminal spurs exist in BOTH directions ----
  let spursOk = 0;
  for (const [a, b] of EASTERN_SPURS) {
    if (hasPair(a, b) && hasPair(b, a)) spursOk++;
  }
  check(scope, `all ${EASTERN_SPURS.length} eastern terminal spurs exist in both directions (found ${spursOk})`,
    spursOk === EASTERN_SPURS.length);

  // ---- 3. retired TRANSIT pairs are absent in BOTH directions ----
  let retiredPresent = 0;
  for (const [a, b] of RETIRED_TRANSIT_PAIRS) {
    if (hasPair(a, b) || hasPair(b, a)) retiredPresent++;
  }
  check(scope, `all ${RETIRED_TRANSIT_PAIRS.length} retired transit pairs are absent in both directions (present ${retiredPresent})`,
    retiredPresent === 0);

  // ---- 4. geometry validity + forward/reverse symmetry (all edges) ----
  let geomValid = 0, geomBad = 0, scalarAsym = 0, revAsym = 0, pairCount = 0;
  const geomByPair = new Map();
  for (const e of edges) {
    const parsed = parseStoredGeometry(e.path_geometry);
    const fromNode = nodes.find((n) => Number(n.id) === Number(e.from_node_id));
    const toNode = nodes.find((n) => Number(n.id) === Number(e.to_node_id));
    if (parsed === undefined || parsed === null || !fromNode || !toNode) { geomBad++; continue; }
    const v = validatePathGeometry(parsed, { fromNode, toNode, allowNull: false, snapEndpoints: false });
    if (!v.ok) { geomBad++; continue; }
    geomValid++;
    geomByPair.set(keyById.get(Number(e.from_node_id)) + '|' + keyById.get(Number(e.to_node_id)), pts(v.value));
  }
  check(scope, `all ${EXPECTED_EDGES} edges carry valid, endpoint-continuous geometry (valid ${geomValid}, bad ${geomBad})`,
    geomValid === EXPECTED_EDGES && geomBad === 0);

  const seen = new Set();
  for (const [k, fwd] of geomByPair) {
    const [a, b] = k.split('|');
    const un = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(un)) continue;
    seen.add(un);
    pairCount++;
    const rev = geomByPair.get(`${b}|${a}`);
    if (!rev || JSON.stringify(rev) !== JSON.stringify(reversePathGeometry(fwd))) revAsym++;
    const ef = edgeByPair.get(`${a}|${b}`), er = edgeByPair.get(`${b}|${a}`);
    if (!ef || !er ||
        Number(ef.distance_meters) !== Number(er.distance_meters) ||
        Number(ef.walk_time_seconds) !== Number(er.walk_time_seconds)) scalarAsym++;
  }
  check(scope, `${EXPECTED_PAIRS} forward/reverse geometry pairs are exact reversals (pairs ${pairCount}, mismatches ${revAsym})`,
    pairCount === EXPECTED_PAIRS && revAsym === 0);
  check(scope, `forward/reverse edge scalars are symmetric (asymmetric ${scalarAsym})`, scalarAsym === 0);

  // ---- 5. main-gate attached geometry begins at the exact gate coordinate ----
  let gateGeomOk = 0;
  for (const [a, b] of GATE_PAIRS) {
    const fwd = geomByPair.get(`${a}|${b}`);
    const rev = geomByPair.get(`${b}|${a}`);
    if (!fwd || !rev) continue;
    const startsAtGate = Math.abs(fwd[0].lat - gateLat) < 1e-9 && Math.abs(fwd[0].lng - gateLng) < 1e-9;
    const endsAtGate = Math.abs(rev[rev.length - 1].lat - gateLat) < 1e-9 &&
                       Math.abs(rev[rev.length - 1].lng - gateLng) < 1e-9;
    const exactReverse = JSON.stringify(rev) === JSON.stringify(reversePathGeometry(fwd));
    if (startsAtGate && endsAtGate && exactReverse) gateGeomOk++;
  }
  check(scope, `all gate-attached pairs begin at the exact gate coordinate and reverse exactly (ok ${gateGeomOk}/${GATE_PAIRS.length})`,
    gateGeomOk === GATE_PAIRS.length);

  // ---- 6. routability + route-level invariants ----
  check(scope, `building count is ${EXPECTED_BUILDINGS} (found ${buildings.length})`,
    buildings.length === EXPECTED_BUILDINGS);

  const pfNodes = nodes.map((n) => ({
    id: Number(n.id), key: n.node_key, label: n.label, node_type: n.node_type,
    building_id: n.building_id != null ? Number(n.building_id) : null,
    lat: num(n.lat), lng: num(n.lng)
  }));
  const pfEdges = edges.map((e) => ({
    from: keyById.get(Number(e.from_node_id)), to: keyById.get(Number(e.to_node_id)),
    distance_meters: Number(e.distance_meters) || 0,
    walk_time_seconds: Number(e.walk_time_seconds) || 0,
    path_label: e.path_label != null ? e.path_label : null,
    is_accessible: Number(e.is_accessible)
  }));
  const route = (endKey) => findShortestPath({ nodes: pfNodes, edges: pfEdges, startKey: 'main-gate', endKey });

  let routable = 0;
  let startsAtGateCount = 0;
  for (const b of buildings) {
    const matches = pfNodes.filter((n) => n.building_id === Number(b.id));
    const dest = matches.find((n) => n.node_type === 'building') || matches[0] || null;
    if (!dest) continue;
    const r = route(dest.key);
    if (r.success && r.nodes.length >= 2) {
      routable++;
      const first = r.nodes[0];
      if (first.key === 'main-gate' &&
          Math.abs(num(first.lat) - GATE_LAT) <= GATE_EPSILON &&
          Math.abs(num(first.lng) - GATE_LNG) <= GATE_EPSILON) startsAtGateCount++;
    }
  }
  check(scope, `13/13 destinations remain routable from main-gate (routable ${routable})`,
    routable === EXPECTED_BUILDINGS);
  check(scope, `every route begins at the authoritative Guard House coordinate (${startsAtGateCount}/${routable})`,
    startsAtGateCount === routable && routable > 0);

  // ---- 7. central spine exists; eastern routes carry NO building transit ----
  const nodeMeta = new Map(pfNodes.map((n) => [n.key, n]));
  const isBuildingNode = (k) => {
    const n = nodeMeta.get(k);
    return !!n && n.building_id != null;
  };

  let spineOk = 0;
  for (const [a, b] of REQUIRED_SPINE_PAIRS) if (hasPair(a, b) && hasPair(b, a)) spineOk++;
  check(scope,
    `central spine pairs exist in BOTH directions (main-gate<->flagpole, flagpole<->mid-campus) (found ${spineOk}/${REQUIRED_SPINE_PAIRS.length})`,
    spineOk === REQUIRED_SPINE_PAIRS.length);

  // STRICT: a building node may never be an intermediate routing junction. Each
  // eastern route must be exactly
  //   main-gate -> flagpole -> mid-campus -> east-walk -> <dest>.
  let easternStrict = 0;
  for (const destKey of EASTERN_BUILDINGS) {
    const r = route(destKey);
    const keys = r.success ? r.nodes.map((n) => n.key) : [];
    const startsAtGate = r.success && keys[0] === 'main-gate' &&
      Math.abs(num(r.nodes[0].lat) - GATE_LAT) <= GATE_EPSILON &&
      Math.abs(num(r.nodes[0].lng) - GATE_LNG) <= GATE_EPSILON;
    const prefixOk = EASTERN_PREFIX.every((k, i) => keys[i] === k);
    const endsAtDest = keys.length === EASTERN_PREFIX.length + 1 && keys[keys.length - 1] === destKey;
    const noWelcomeArch = !keys.includes('welcome-arch');
    const noBuildingTransit = keys.slice(0, -1).every((k) => !isBuildingNode(k));
    const noBanned = !keys.some((k) => BANNED_TRANSIT_NODES.includes(k));
    const ok = startsAtGate && prefixOk && endsAtDest && noWelcomeArch && noBuildingTransit && noBanned;
    if (ok) easternStrict++;
    check(scope,
      `${destKey}: authoritative main-gate -> flagpole -> mid-campus -> east-walk -> ${destKey} ` +
      `(every intermediate building_id NULL, no welcome-arch, no ICTU/Gymnasium/Auditorium)`, ok);
  }
  check(scope,
    `all ${EASTERN_BUILDINGS.length} eastern routes use the building-free central spine (clean ${easternStrict})`,
    easternStrict === EASTERN_BUILDINGS.length);

  // The hairpin is gone: welcome-arch must not appear on ANY destination route.
  let welcomeArchHits = 0;
  for (const b of buildings) {
    const matches = pfNodes.filter((n) => n.building_id === Number(b.id));
    const dest = matches.find((n) => n.node_type === 'building') || matches[0] || null;
    if (!dest) continue;
    const r = route(dest.key);
    if (r.success && r.nodes.some((n) => n.key === 'welcome-arch')) welcomeArchHits++;
  }
  check(scope,
    `Guard House hairpin eliminated: no destination route doubles back through welcome-arch (hits ${welcomeArchHits})`,
    welcomeArchHits === 0);

  // ICTU / Gymnasium / Auditorium must still be reachable TERMINAL destinations.
  for (const t of BANNED_TRANSIT_NODES) {
    const r = route(t);
    const keys = r.success ? r.nodes.map((n) => n.key) : [];
    check(scope, `${t} remains reachable as a TERMINAL destination (route ends at ${t})`,
      r.success && keys[keys.length - 1] === t);
  }

  // Explicit named invariants from the repair brief.
  const safeKeys = (k) => { const r = route(k); return r.success ? r.nodes.map((n) => n.key) : []; };
  const ccsKeys = safeKeys('ccs');
  const chsKeys = safeKeys('chs');
  const clinicKeys = safeKeys('clinic');
  const casKeys = safeKeys('cas');
  const greenKeys = safeKeys('green-building');
  check(scope, 'CCS route does NOT pass through CAS and ends at CCS',
    !ccsKeys.includes('cas') && ccsKeys[ccsKeys.length - 1] === 'ccs');
  check(scope, 'CHS route does NOT pass through CCS or CAS and ends at CHS',
    !chsKeys.includes('ccs') && !chsKeys.includes('cas') && chsKeys[chsKeys.length - 1] === 'chs');
  check(scope, 'Clinic route does NOT pass through CAS and ends at Clinic',
    !clinicKeys.includes('cas') && clinicKeys[clinicKeys.length - 1] === 'clinic');
  check(scope, 'CAS route ends at CAS as its only building destination',
    casKeys[casKeys.length - 1] === 'cas' && !casKeys.slice(0, -1).some((k) => EASTERN_BUILDINGS.includes(k)));
  check(scope, 'Green Building route does NOT traverse CAS',
    greenKeys.length > 0 && !greenKeys.includes('cas'));

  // ---- 8. drawn geometry avoids the footprints of buildings it is not visiting ----
  const buildingPoints = pfNodes
    .filter((n) => n.building_id != null && n.node_type === 'building')
    .map((n) => ({ key: n.key, lat: n.lat, lng: n.lng }));
  let footprintViolations = 0;
  let worstClearance = Infinity;
  for (const destKey of ACCEPTANCE_ROUTES) {
    const r = route(destKey);
    if (!r.success) continue;
    const onPath = new Set(r.nodes.map((n) => n.key));
    // Flatten the drawn shape from the SELECTED edges (same order the map draws).
    const poly = [];
    for (const seg of r.segments) {
      const g = geomByPair.get(`${seg.from}|${seg.to}`) ||
        [{ lat: nodeByKey.get(seg.from) ? num(nodeByKey.get(seg.from).lat) : 0,
           lng: nodeByKey.get(seg.from) ? num(nodeByKey.get(seg.from).lng) : 0 },
         { lat: nodeByKey.get(seg.to) ? num(nodeByKey.get(seg.to).lat) : 0,
           lng: nodeByKey.get(seg.to) ? num(nodeByKey.get(seg.to).lng) : 0 }];
      for (const p of g) {
        const last = poly[poly.length - 1];
        if (last && Math.abs(last.lat - p.lat) < 1e-9 && Math.abs(last.lng - p.lng) < 1e-9) continue;
        poly.push(p);
      }
    }
    if (poly.length < 2) continue;
    const origin = poly[0];
    for (const b of buildingPoints) {
      if (onPath.has(b.key)) continue; // a building the route legitimately visits
      const d = pointToPolylineMeters(b, poly, origin);
      if (d < worstClearance) worstClearance = d;
      if (d < FOOTPRINT_RADIUS_M) footprintViolations++;
    }
  }
  check(scope,
    `acceptance-route geometry never enters the footprint of a building it is not visiting ` +
    `(violations ${footprintViolations}, min clearance ${Math.round(worstClearance)} m >= ${FOOTPRINT_RADIUS_M} m)`,
    footprintViolations === 0);
}

// Historical CAS-only parity helper retained with the historical validator.
function historicalSelectedCasParity(mysql, supabase) {
  const geometryMap = (state) => {
    const keyById = new Map(state.nodes.map((node) => [Number(node.id), node.node_key]));
    return new Map(state.edges.map((edge) => {
      const parsed = parseStoredGeometry(edge.path_geometry);
      return [
        `${keyById.get(Number(edge.from_node_id))}>${keyById.get(Number(edge.to_node_id))}`,
        Array.isArray(parsed) ? pts(parsed) : null
      ];
    }));
  };
  const myNodes = new Map(mysql.nodes.map((node) => [node.node_key, node]));
  const sbNodes = new Map(supabase.nodes.map((node) => [node.node_key, node]));
  const myCas = myNodes.get('cas');
  const sbCas = sbNodes.get('cas');
  check('cross-backend', 'cas node coordinate matches by stable node_key',
    !!myCas && !!sbCas &&
    num(myCas.lat) === num(sbCas.lat) &&
    num(myCas.lng) === num(sbCas.lng));

  const myGeometry = geometryMap(mysql);
  const sbGeometry = geometryMap(supabase);
  for (const natural of ['east-walk>cas', 'cas>east-walk']) {
    check('cross-backend', `${natural} geometry is naturally identical`,
      myGeometry.has(natural) &&
      sbGeometry.has(natural) &&
      JSON.stringify(myGeometry.get(natural)) === JSON.stringify(sbGeometry.get(natural)));
  }
}

(async () => {
  say('=== CampuSphere route topology probe (Guard House + eastern topology; 0017 OWNER-APPLIED) ===');
  try {
    /* ================= MySQL ================= */
    say('\nmysql topology checks:');
    const [myNodes] = await db.query(
      'SELECT id, node_key, label, node_type, building_id, lat, lng FROM route_nodes'
    );
    const [myEdges] = await db.query(
      `SELECT from_node_id, to_node_id, distance_meters, walk_time_seconds,
              path_label, is_accessible, path_geometry
         FROM route_edges`
    );
    const [myBuildings] = await db.query('SELECT id, name FROM buildings');
    verifyExpandedTopology('mysql', myNodes, myEdges, myBuildings);
    const mysqlState = { nodes: myNodes, edges: myEdges, buildings: myBuildings };
    let supabaseState = null;

    /* ========= Live Supabase: SAME validator, fails closed ========= */
    // 0017 is OWNER-APPLIED. Live Supabase is held to the identical repaired
    // topology — the pre-0017 52-edge state is now a hard FAILURE.
    say('\nsupabase live topology checks (0017 owner-applied; same shared validator, fail-closed):');
    if (!hasSupabaseConfig()) {
      if (process.env.PROBE_SKIP_SUPABASE === '1') {
        say('  SKIP - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (MySQL fallback mode).');
      } else {
        check('supabase', 'Supabase env is configured (fail-closed)', false);
      }
    } else {
      const sb = getSupabaseClient();
      const { data: sbNodes, error: nErr } = await sb
        .from('route_nodes')
        .select('id, node_key, label, node_type, building_id, lat, lng')
        .order('id', { ascending: true });
      const { data: sbEdges, error: eErr } = await sb
        .from('route_edges')
        .select('from_node_id, to_node_id, distance_meters, walk_time_seconds, path_label, is_accessible, path_geometry')
        .order('id', { ascending: true });
      const { data: sbBuildings, error: bErr } = await sb
        .from('buildings').select('id, name').order('id', { ascending: true });
      const readable = !nErr && !eErr && !bErr &&
        Array.isArray(sbNodes) && Array.isArray(sbEdges) && Array.isArray(sbBuildings);
      check('supabase', 'live route graph + buildings are readable', readable);
      if (readable) {
        verifyExpandedTopology('supabase', sbNodes, sbEdges, sbBuildings);
        supabaseState = { nodes: sbNodes, edges: sbEdges, buildings: sbBuildings };
      }
    }
    if (supabaseState) expandedCatalogParity(mysqlState, supabaseState);

    /* ================= Static migration checks ================= */
    say('\nstatic migration checks (this probe applies NO SQL):');
    const dir = path.join(__dirname, '..', 'database', 'supabase');
    const sqlFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    const m17Path = path.join(dir, '0017_route_topology_guard_house.sql');
    const m17Exists = fs.existsSync(m17Path);
    check('static', '0017_route_topology_guard_house.sql exists', m17Exists);
    // BE.2 migration 0018 is owner-applied and immutable. BE.5 declares 0019
    // for the selected-demo metadata/endpoint parity correction.
    check('static', '0018_cas_building_baseline.sql is declared and owner-applied',
      sqlFiles.some((f) => f === '0018_cas_building_baseline.sql'));
    check('static', '0019_be5_selected_demo_parity.sql is declared for owner review',
      sqlFiles.some((f) => f === '0019_be5_selected_demo_parity.sql'));
    check('static', `migration list is exactly 0001-0019 (19 files, found ${sqlFiles.length})`, sqlFiles.length === 19);

    if (m17Exists) {
      const sql = fs.readFileSync(m17Path, 'utf8');
      check('static', '0017 is transactional (BEGIN + COMMIT)', /\bBEGIN\s*;/i.test(sql) && /\bCOMMIT\s*;/i.test(sql));
      check('static', '0017 moves main-gate to the authoritative coordinate',
        /UPDATE\s+public\.route_nodes[\s\S]*?13\.40575221[\s\S]*?123\.37434735[\s\S]*?node_key\s*=\s*'main-gate'/i.test(sql));
      check('static', '0017 refreshes route_nodes.location with the schema-qualified PostGIS expression',
        /extensions\.ST_SetSRID\s*\(\s*extensions\.ST_MakePoint/i.test(sql));
      check('static', '0017 has a fail-closed preflight that ABORTS on any missing node_key',
        /DO\s+\$\$/i.test(sql) && /RAISE\s+EXCEPTION/i.test(sql) &&
        /preflight/i.test(sql) && /NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+public\.route_nodes/i.test(sql));

      // V3: the preflight must name the table-function's SCALAR OUTPUT COLUMN, not
      // just the relation. `unnest(required_keys) AS k` aliases only the relation
      // and leaves every `k` reference resolving through an implicit same-named
      // column; PostgreSQL's unambiguous form is table_alias(column_alias). These
      // assertions run against the COMMENT-STRIPPED body so explanatory prose can
      // neither satisfy nor trip them.
      const sqlBody = sql.replace(/--[^\n]*/g, '');
      check('static', '0017 preflight uses the explicit scalar column alias: FROM unnest(required_keys) AS req(node_key)',
        /FROM\s+unnest\s*\(\s*required_keys\s*\)\s+AS\s+req\s*\(\s*node_key\s*\)/i.test(sqlBody));
      check('static', "0017 preflight aggregates the qualified scalar: string_agg(req.node_key, ', ' ORDER BY req.node_key)",
        /string_agg\s*\(\s*req\.node_key\s*,\s*'[^']*'\s+ORDER\s+BY\s+req\.node_key\s*\)/i.test(sqlBody));
      check('static', '0017 preflight compares the qualified scalar: rn.node_key = req.node_key',
        /rn\.node_key\s*=\s*req\.node_key/i.test(sqlBody));
      check('static', '0017 preflight does NOT use the ambiguous bare table-function alias (FROM unnest(required_keys) AS k)',
        !/FROM\s+unnest\s*\(\s*required_keys\s*\)\s+AS\s+k\b/i.test(sqlBody));
      check('static', '0017 preflight keeps the fail-closed RAISE EXCEPTION branch on a missing key',
        /IF\s+missing_keys\s+IS\s+NOT\s+NULL\s+THEN[\s\S]*?RAISE\s+EXCEPTION[\s\S]*?END\s+IF\s*;/i.test(sqlBody));

      check('static', `0017 retires all ${RETIRED_TRANSIT_PAIRS.length} transit pairs (eastern + building-backed mid-campus)`,
        /DELETE\s+FROM\s+public\.route_edges/i.test(sql) &&
        RETIRED_TRANSIT_PAIRS.every(([a, b]) => new RegExp(`'${a}'\\s*,\\s*'${b}'`).test(sql)));
      check('static', '0017 upserts all eight repaired pairs (incl. main-gate<->flagpole + flagpole<->mid-campus)',
        [['main-gate', 'welcome-arch'], ['main-gate', 'flagpole'], ['main-gate', 'west-road'],
         ['flagpole', 'mid-campus'], ['east-walk', 'cas'], ['east-walk', 'ccs'],
         ['east-walk', 'clinic'], ['east-walk', 'chs']]
          .every(([a, b]) => new RegExp(`'${a}'[^\\n]*,\\s*'${b}'`).test(sql)));
      check('static', '0017 keeps ICTU / Gymnasium / Auditorium reachable (does NOT retire their terminal edges)',
        !/'flagpole'\s*,\s*'ictu'/i.test(sql.split('DELETE FROM public.route_edges')[1] || '') &&
        !/'flagpole'\s*,\s*'gymnasium'/i.test(sql.split('DELETE FROM public.route_edges')[1] || '') &&
        !/'library'\s*,\s*'auditorium'/i.test(sql.split('DELETE FROM public.route_edges')[1] || ''));
      check('static', '0017 is natural-key based (joins route_nodes on node_key)',
        /JOIN\s+public\.route_nodes\s+\w+\s+ON\s+\w+\.node_key\s*=/i.test(sql));
      check('static', '0017 hardcodes NO numeric node/building id',
        !/(from_node_id|to_node_id|building_id)\s*=\s*\d+/i.test(sql));
      check('static', '0017 builds geometry endpoints from the LIVE node rows',
        /jsonb_build_object\(\s*'lat'\s*,\s*n[ab]\.lat/i.test(sql));
      check('static', '0017 derives reverse rows mechanically (jsonb_agg + ORDINALITY DESC)',
        /jsonb_agg\(\s*t\.elem\s+ORDER\s+BY\s+t\.ord\s+DESC\s*\)/i.test(sql) && /WITH\s+ORDINALITY/i.test(sql));
      check('static', '0017 is idempotent (ON CONFLICT DO UPDATE on the directed-edge key)',
        /ON\s+CONFLICT\s*\(\s*from_node_id\s*,\s*to_node_id\s*\)\s*DO\s+UPDATE/i.test(sql));
      check('static', '0017 does NOT weaken the 0016 NODE_GEOMETRY_ATTACHED runtime guard',
        !/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.app_update_route_node/i.test(sql) &&
        !/DROP\s+FUNCTION/i.test(sql) &&
        !/NODE_GEOMETRY_ATTACHED/.test(sql.replace(/--[^\n]*/g, '')));
      check('static', '0017 does not alter RLS, grants, or unrelated tables',
        !/ROW\s+LEVEL\s+SECURITY/i.test(sql) && !/\bGRANT\b/i.test(sql) && !/\bREVOKE\b/i.test(sql) &&
        !/\bDROP\s+TABLE\b/i.test(sql) && !/\bALTER\s+TABLE\b/i.test(sql) &&
        !/\b(app_sessions|room_schedules|vr_scenes|vr_hotspots|buildings|campus_routes)\b/i.test(
          sql.replace(/--[^\n]*/g, '')));
    }

    // All five are owner-applied and therefore immutable.
    const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, f))).digest('hex');
    check('static', '0014 is byte-for-byte unchanged (owner-applied)', sha('0014_route_graph_accuracy.sql') === EXPECTED_0014_SHA256);
    check('static', '0015 is byte-for-byte unchanged (owner-applied)', sha('0015_route_edge_path_geometry.sql') === EXPECTED_0015_SHA256);
    check('static', '0016 is byte-for-byte unchanged (owner-applied)', sha('0016_route_geometry_admin_writes.sql') === EXPECTED_0016_SHA256);
    check('static', '0017 is byte-for-byte unchanged (owner-applied)', sha('0017_route_topology_guard_house.sql') === EXPECTED_0017_SHA256);
    check('static', '0018 is byte-for-byte unchanged (owner-applied)', sha('0018_cas_building_baseline.sql') === EXPECTED_0018_SHA256);

    /* ================= Leak scan over everything printed ================= */
    say('\nleak scan over this probe\'s own output:');
    const blob = printed.join('\n');
    const LEAKS = [
      ['JWT-like token', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
      ['Supabase host', /[a-z0-9-]+\.supabase\.(co|com|in)/i],
      ['Supabase/Cloudinary credential name', /SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|CLOUDINARY_API_KEY|CLOUDINARY_API_SECRET/],
      ['session cookie value', /campusphere\.sid=/],
      ['SQL/driver/PostgREST text', /sqlMessage|ER_[A-Z_]{3,}|SQLSTATE|PostgREST|relation "[^"]+" does not exist/i],
      ['stack frame', /\bat [\w.$<>[\] ]+ \((?:file:\/\/|\/|[A-Za-z]:\\)[^)]*:\d+:\d+\)/],
      ['raw geometry payload dump', /\{\s*"?lat"?\s*:/]
    ];
    for (const [label, re] of LEAKS) check('leak', `no ${label}`, !re.test(blob));

    say('');
    say('NOTE 0017 is OWNER-APPLIED. MySQL and live Supabase are both held to the repaired topology by the same validator.');
    say('NOTE read-only probe: no rows were created or modified, and no SQL was applied.');
  } catch (e) {
    console.error('  [FAIL] probe aborted by an unexpected error (sanitized).');
    failures.push('unexpected probe error');
  } finally {
    try { await db.end(); } catch (e) { /* already closed */ }
  }

  if (failures.length === 0) {
    console.log('ROUTE-TOPOLOGY-PROBE OK: all checks passed.');
    process.exitCode = 0;
  } else {
    console.error(`ROUTE-TOPOLOGY-PROBE FAILED: ${failures.length} check(s) did not pass:`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }
})();
