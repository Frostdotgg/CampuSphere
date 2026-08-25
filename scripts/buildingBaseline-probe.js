'use strict';

/* ========================================
   CampuSphere - Canonical building dataset baseline probe
   BE.2 baseline + BE.5 selected-demo parity verification script.

   READ-ONLY. Starts no server, writes no rows, applies no SQL.

   The defect this probe locks down
   --------------------------------
   Historically, the College of Arts and Sciences (CAS) was created through the
   admin UI but was missing from the canonical static seed roster. BE.2 made the
   13-building seed reproducible. The current candidate deliberately separates
   that seed history from the larger backend-specific live catalogs.

   BE.2 makes CAS canonical (models/data.js + migration 0018). BE.5 treats the
   current source-controlled roster as the selected orientation-demo set while
   preserving normal admin edits and future additions. This probe proves the
   selected roster is reproducible and internally consistent:

     Canonical source (models/data.js):
       - exactly 13 buildings, names unique
       - CAS present with the owner-confirmed minimum
         (category Academic, lat 13.40594916, lng 123.37704274)
       - CAS carries NO invented metadata and NO media

     Seed hardening (database/seed.js, static):
       - a missing OR duplicate canonical building name FAILS CLOSED; the seed
         can no longer create a building-backed route node with building_id NULL

     Live MySQL and live Supabase (SELECT / repository reads only):
       - every seed building remains present exactly once by NORMALIZED NAME
         while each complete live roster matches its backend-specific freeze
         (numeric ids are NEVER compared across backends)
       - every active Guided-VR destination resolves to exactly one building and
         its exact configured natural route-node key
       - NO building-type route node has a NULL building_id, no building node
         dangles, and all 25 configured destinations are reachable
       - complete backend-specific node/edge/pair/geometry counts and
         fingerprints match the refreshed freeze

     Static migrations:
       - 0018 exists, is transactional, data-only, idempotent, natural-key based,
         and has a fail-closed preflight
       - migration source list is contiguous 0001-0020
       - 0019 is declared for the selected-demo parity correction
       - owner-applied 0014-0018 are byte-for-byte unchanged

   Prints fixed labels and counts only — never raw DB errors, hosts, keys,
   cookies, credentials, coordinates of unknown provenance, or row payloads.

   Run:   node scripts/buildingBaseline-probe.js
   ======================================== */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../config/db');
const { getSupabaseClient, hasSupabaseConfig } = require('../config/supabase');
const { findShortestPath } = require('../utils/pathfinding');
const { validatePathGeometry } = require('../utils/routeGeometry');
const data = require('../models/data');
const { GUIDED_VR_ROUTES } = require('../config/guidedVrRoutes');
const { SELECTED_DEMO_FREEZE } = require('../config/selectedDemoFreeze');

const EXPECTED_BUILDINGS = data.buildings.length;
const CAS_NAME = 'College of Arts and Sciences';
const CAS_DESCRIPTION = 'College of Arts and Sciences (CAS)';
const CAS_NODE_KEY = 'cas';
const CAS_CATEGORY = 'Academic';
const CAS_LAT = 13.40594916;
const CAS_LNG = 123.37704274;
// buildings.lat/lng are 8-dp DECIMAL/numeric in both backends.
const COORD_EPSILON = 1e-6;

// Owner-applied migrations remain immutable.
const IMMUTABLE = {
  '0014_route_graph_accuracy.sql': 'ad9179bd0def19567b512e495fd3133211288e253c872b260421a912cc44e6aa',
  '0015_route_edge_path_geometry.sql': 'e7c6d828faf07c53d923ed58651a0abb8a834273eefa38aa0c04fbf492f70c99',
  '0016_route_geometry_admin_writes.sql': 'e567239f81a6ae6190b8fa66a044126204ca0ef5f64bb80c7960a921ecad7dcf',
  '0017_route_topology_guard_house.sql': 'bc0b3f38a186b321b3c9c53e4c6f9b7abd8e440da12e1fe25e5400b823670997',
  '0018_cas_building_baseline.sql': '2f38221806b98c0aefa0575b180d65b8c3ec86682d83080b1d2aebac62399e48'
};

const failures = [];
const printed = [];
function say(line) { printed.push(line); console.log(line); }
function check(scope, label, ok) {
  const line = `  [${ok ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`;
  printed.push(line);
  console.log(line);
  if (!ok) failures.push(`${scope} :: ${label}`);
}

// Case/punctuation-insensitive canonical key. Backends are compared by this,
// never by numeric id (MySQL and Supabase ids legitimately differ).
const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const num = (v) => (v == null || v === '' ? null : Number(v));

function parseGeom(raw) {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch (e) { return undefined; } }
  return undefined;
}

/* ---------------------------------------------------------------------------
   BE.2 NO-GO repair: 0018 CONCURRENCY GATE (static).

   `buildings.name` has no unique constraint and the admin building create/update
   RPCs write `name`, so an unlocked preflight is a TOCTOU race: a concurrent
   admin insert/rename can add a SECOND CAS row after the check, making the
   update-or-insert multi-row and the `UPDATE ... FROM` node link ambiguous.

   0018 must therefore: take BOTH table locks immediately after BEGIN and BEFORE
   any preflight read, in a deterministic order (buildings, then route_nodes, so
   concurrent transactions cannot deadlock), and prove its END state with a
   fail-closed postcondition placed after the node-link UPDATE and before COMMIT.

   This is a PURE function over a COMMENT-STRIPPED body so it can be run against
   both the real migration and an in-memory negative fixture. It executes nothing.
--------------------------------------------------------------------------- */
function evaluateLockingGate(body) {
  const iBegin = body.search(/\bBEGIN\s*;/i);
  const iLockBuildings = body.search(/LOCK\s+TABLE\s+public\.buildings\s+IN\s+SHARE\s+ROW\s+EXCLUSIVE\s+MODE\s*;/i);
  const iLockNodes = body.search(/LOCK\s+TABLE\s+public\.route_nodes\s+IN\s+SHARE\s+ROW\s+EXCLUSIVE\s+MODE\s*;/i);
  const iFirstDo = body.search(/DO\s+\$\$/i);
  const iNodeLink = body.search(/UPDATE\s+public\.route_nodes/i);
  const iCommit = body.search(/\bCOMMIT\s*;/i);

  // The postcondition is the LAST DO block in the file.
  const doPositions = [];
  const doRe = /DO\s+\$\$/gi;
  let m;
  while ((m = doRe.exec(body)) !== null) doPositions.push(m.index);
  const iLastDo = doPositions.length ? doPositions[doPositions.length - 1] : -1;

  const have = (i) => i !== -1;
  const postBody = (iLastDo !== -1 && iCommit !== -1 && iLastDo < iCommit)
    ? body.slice(iLastDo, iCommit)
    : '';

  return {
    // locks present
    locksPresent: have(iLockBuildings) && have(iLockNodes),
    // taken after BEGIN, before ANY preflight read
    locksAfterBegin: have(iBegin) && have(iLockBuildings) && have(iLockNodes) &&
      iBegin < iLockBuildings && iBegin < iLockNodes,
    locksBeforePreflight: have(iFirstDo) && have(iLockBuildings) && have(iLockNodes) &&
      iLockBuildings < iFirstDo && iLockNodes < iFirstDo,
    // deterministic order: buildings BEFORE route_nodes (deadlock avoidance)
    buildingsLockedFirst: have(iLockBuildings) && have(iLockNodes) && iLockBuildings < iLockNodes,
    // two distinct DO blocks: preflight + postcondition
    hasTwoDoBlocks: doPositions.length >= 2,
    // postcondition sits AFTER the node-link UPDATE and BEFORE COMMIT
    postconditionAfterNodeLink: have(iLastDo) && have(iNodeLink) && iLastDo > iNodeLink,
    postconditionBeforeCommit: have(iLastDo) && have(iCommit) && iLastDo < iCommit,
    // postcondition proves all three invariants and rolls back on failure
    postconditionAssertsOneBuilding: /building_count\s*<>\s*1/i.test(postBody),
    postconditionAssertsOneNode: /node_count\s*<>\s*1/i.test(postBody),
    postconditionAssertsLinkedNode: /linked_count\s*<>\s*1/i.test(postBody) &&
      /JOIN\s+public\.buildings/i.test(postBody) &&
      /b\.id\s*=\s*rn\.building_id/i.test(postBody),
    postconditionRaises: /RAISE\s+EXCEPTION/i.test(postBody)
  };
}

// The PRE-REPAIR 0018: correct-looking, natural-key, transactional — but it
// takes NO locks and has NO postcondition. It is the exact form Codex rejected.
// Kept in memory only (never written, never executed) so the gate above is proven
// to actually REJECT it rather than passing vacuously.
const OLD_UNLOCKED_0018_FIXTURE = `
BEGIN;

DO $$
DECLARE
    building_count integer;
    node_count     integer;
BEGIN
    SELECT count(*) INTO building_count
      FROM public.buildings b
     WHERE b.name = 'College of Arts and Sciences';
    IF building_count > 1 THEN
        RAISE EXCEPTION 'Migration 0018 preflight FAILED: duplicate CAS rows (%).', building_count;
    END IF;

    SELECT count(*) INTO node_count
      FROM public.route_nodes rn
     WHERE rn.node_key = 'cas';
    IF node_count <> 1 THEN
        RAISE EXCEPTION 'Migration 0018 preflight FAILED: cas node count (%).', node_count;
    END IF;
END
$$;

UPDATE public.buildings
   SET category = 'Academic'
 WHERE name = 'College of Arts and Sciences';

INSERT INTO public.buildings (name, category)
SELECT 'College of Arts and Sciences', 'Academic'
 WHERE NOT EXISTS (
     SELECT 1 FROM public.buildings b WHERE b.name = 'College of Arts and Sciences'
 );

UPDATE public.route_nodes rn
   SET building_id = b.id
  FROM public.buildings b
 WHERE rn.node_key = 'cas'
   AND b.name = 'College of Arts and Sciences';

COMMIT;
`;

/* ---------------------------------------------------------------------------
   Shared live-backend validator. MySQL and Supabase get the IDENTICAL contract.
--------------------------------------------------------------------------- */
function verifyBackend(scope, buildings, nodes, edges) {
  const frozen = SELECTED_DEMO_FREEZE.backends[scope];
  check(scope, `complete live roster has ${frozen.counts.buildings} buildings (found ${buildings.length})`,
    buildings.length === frozen.counts.buildings);

  const liveNames = buildings.map((building) => building.name).sort();
  check(scope, 'complete live roster matches the refreshed backend freeze',
    JSON.stringify(liveNames) === JSON.stringify(frozen.roster));
  check(scope, 'all live canonical building names are unique',
    new Set(buildings.map((building) => norm(building.name))).size === buildings.length);

  const buildingByCanonical = new Map();
  for (const building of buildings) {
    const key = norm(building.name);
    const list = buildingByCanonical.get(key) || [];
    list.push(building);
    buildingByCanonical.set(key, list);
  }
  const nodesByKey = new Map();
  for (const node of nodes) {
    const list = nodesByKey.get(node.node_key) || [];
    list.push(node);
    nodesByKey.set(node.node_key, list);
  }
  check(scope, 'all 25 active destination buildings exist exactly once', GUIDED_VR_ROUTES.every((route) =>
    (buildingByCanonical.get(norm(route.destination_name)) || []).length === 1));
  check(scope, 'all configured natural destination nodes exist exactly once and map to their building',
    GUIDED_VR_ROUTES.every((route) => {
      const matchingBuildings = buildingByCanonical.get(norm(route.destination_name)) || [];
      const matchingNodes = nodesByKey.get(route.destination_node_key) || [];
      return matchingBuildings.length === 1 && matchingNodes.length === 1 &&
        Number(matchingNodes[0].building_id) === Number(matchingBuildings[0].id);
    }));

  // NO building-type node may be unmapped — this is the regression class itself
  const unmapped = nodes.filter((n) => n.node_type === 'building' && n.building_id == null);
  check(scope, `no building-type route node has a NULL building_id (unmapped ${unmapped.length})`,
    unmapped.length === 0);

  // route nodes must not dangle at a missing building
  const bIds = new Set(buildings.map((b) => Number(b.id)));
  const dangling = nodes.filter((n) => n.building_id != null && !bIds.has(Number(n.building_id)));
  check(scope, `no route node points at a missing building (dangling ${dangling.length})`, dangling.length === 0);

  check(scope, `route graph matches ${frozen.counts.route_nodes} frozen nodes (found ${nodes.length})`,
    nodes.length === frozen.counts.route_nodes);
  check(scope, `route graph matches ${frozen.counts.route_edges} frozen directed edges (found ${edges.length})`,
    edges.length === frozen.counts.route_edges);

  const keyById = new Map(nodes.map((n) => [Number(n.id), n.node_key]));
  let geomValid = 0;
  const seen = new Set();
  let pairs = 0;
  for (const e of edges) {
    const g = parseGeom(e.path_geometry);
    const from = nodes.find((n) => Number(n.id) === Number(e.from_node_id));
    const to = nodes.find((n) => Number(n.id) === Number(e.to_node_id));
    if (g && from && to && validatePathGeometry(g, { fromNode: from, toNode: to, allowNull: false, snapEndpoints: false }).ok) {
      geomValid++;
    }
    const a = keyById.get(Number(e.from_node_id));
    const b = keyById.get(Number(e.to_node_id));
    const un = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (!seen.has(un)) { seen.add(un); pairs++; }
  }
  check(scope, `all ${edges.length} edges carry valid endpoint-continuous geometry (valid ${geomValid})`,
    geomValid === edges.length);
  check(scope, `route graph matches ${frozen.counts.reverse_pairs} frozen reverse pairs (found ${pairs})`,
    pairs === frozen.counts.reverse_pairs);

  // Every active catalog destination is routable from the Guard House through
  // its configured natural node key. Sibling/legacy building nodes cannot win.
  const pfNodes = nodes.map((n) => ({
    id: Number(n.id), key: n.node_key, label: n.label, node_type: n.node_type,
    building_id: n.building_id != null ? Number(n.building_id) : null,
    lat: num(n.lat), lng: num(n.lng)
  }));
  const pfEdges = edges.map((e) => ({
    from: keyById.get(Number(e.from_node_id)), to: keyById.get(Number(e.to_node_id)),
    distance_meters: Number(e.distance_meters) || 0,
    walk_time_seconds: Number(e.walk_time_seconds) || 0,
    is_accessible: Number(e.is_accessible)
  }));
  const routable = GUIDED_VR_ROUTES.filter((route) => {
    const result = findShortestPath({ nodes: pfNodes, edges: pfEdges,
      startKey: 'main-gate', endKey: route.destination_node_key });
    return result.success && result.nodes.length >= 2;
  }).length;
  check(scope, `25/25 active destinations are routable from main-gate (routable ${routable})`,
    routable === GUIDED_VR_ROUTES.length);
}

(async () => {
  say('=== CampuSphere canonical building baseline probe (BE.2 baseline + BE.5 parity) ===');
  try {
    /* ---------------- canonical static roster ---------------- */
    say('\ncanonical source (models/data.js):');
    const roster = Array.isArray(data.buildings) ? data.buildings : [];
    check('canonical', `models/data.js declares exactly ${EXPECTED_BUILDINGS} buildings (found ${roster.length})`,
      roster.length === EXPECTED_BUILDINGS);
    const names = roster.map((b) => norm(b.name));
    check('canonical', `canonical building names are unique (unique ${new Set(names).size})`,
      new Set(names).size === roster.length);

    const cas = roster.find((b) => norm(b.name) === norm(CAS_NAME)) || null;
    check('canonical', `"${CAS_NAME}" is a canonical building`, !!cas);
    if (cas) {
      check('canonical', `CAS category is ${CAS_CATEGORY}`, cas.category === CAS_CATEGORY);
      check('canonical', `CAS public description is "${CAS_DESCRIPTION}"`,
        cas.desc === CAS_DESCRIPTION);
      check('canonical', 'CAS carries the owner-confirmed coordinate',
        Math.abs(Number(cas.lat) - CAS_LAT) <= COORD_EPSILON &&
        Math.abs(Number(cas.lng) - CAS_LNG) <= COORD_EPSILON);
      // Unknown metadata must stay EMPTY — BE.2 must not invent content.
      const emptyArr = (v) => Array.isArray(v) && v.length === 0;
      check('canonical', 'CAS invents no entrances / floors / landmarks / info (all empty)',
        emptyArr(cas.entrances) && emptyArr(cas.floors) && emptyArr(cas.landmarks) && emptyArr(cas.info));
      check('canonical', 'CAS is assigned NO media (img null, no Cloudinary id)',
        (cas.img === null || cas.img === undefined) && cas.cloudinary_public_id == null);
      check('canonical', 'CAS has no invented walk time', cas.walkTime === null || cas.walkTime === undefined);
    }

    /* ---------------- seed hardening (static) ---------------- */
    say('\nseed hardening (database/seed.js, static):');
    const seedSrc = fs.readFileSync(path.join(__dirname, '..', 'database', 'seed.js'), 'utf8');
    // Assert against the COMMENT-STRIPPED body: seed.js documents the old lossy
    // `bldgByName.get(name) || null` pattern in a comment explaining WHY it was
    // removed, and prose must neither satisfy nor trip these checks.
    const seedBody = seedSrc.replace(/\/\/[^\n]*/g, '');
    check('seed', 'seed resolves canonical buildings through a fail-closed requireBuilding()',
      /function\s+requireBuilding\s*\(/.test(seedBody));
    check('seed', 'seed no longer uses the silent `bldgByName.get(...) || null` fallback',
      !/bldgByName\.get\([^)]*\)\s*\|\|\s*null/.test(seedBody));
    check('seed', 'seed preflights the whole canonical set and aborts on missing OR duplicate names',
      /CANONICAL_BUILDING_NAMES/.test(seedBody) &&
      /missingNames/.test(seedBody) && /duplicateNames/.test(seedBody) &&
      /throw new Error\(/.test(seedBody));
    check('seed', 'seed lists CAS among the canonical names', seedBody.includes(CAS_NAME));

    /* ---------------- live MySQL ---------------- */
    say('\nmysql live baseline:');
    const [myB] = await db.query('SELECT id, name, category, description, lat, lng FROM buildings');
    const [myN] = await db.query('SELECT id, node_key, label, node_type, building_id, lat, lng FROM route_nodes');
    const [myE] = await db.query(
      `SELECT from_node_id, to_node_id, distance_meters, walk_time_seconds,
              is_accessible, path_geometry
         FROM route_edges`
    );
    verifyBackend('mysql', myB, myN, myE);

    /* ---------------- live Supabase ---------------- */
    say('\nsupabase live baseline:');
    if (!hasSupabaseConfig()) {
      if (process.env.PROBE_SKIP_SUPABASE === '1') {
        say('  SKIP - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (MySQL fallback mode).');
      } else {
        check('supabase', 'Supabase env is configured (fail-closed)', false);
      }
    } else {
      const sb = getSupabaseClient();
      const { data: sbB, error: bErr } = await sb.from('buildings').select('id, name, category, description, lat, lng');
      const { data: sbN, error: nErr } = await sb.from('route_nodes')
        .select('id, node_key, label, node_type, building_id, lat, lng');
      const { data: sbE, error: eErr } = await sb.from('route_edges')
        .select('from_node_id, to_node_id, distance_meters, walk_time_seconds, is_accessible, path_geometry');
      const readable = !bErr && !nErr && !eErr &&
        Array.isArray(sbB) && Array.isArray(sbN) && Array.isArray(sbE);
      check('supabase', 'live buildings + route graph are readable', readable);
      if (readable) {
        verifyBackend('supabase', sbB, sbN, sbE);
        check('cross-backend',
          'both backends contain every active destination natural building name',
          GUIDED_VR_ROUTES.every((route) =>
            myB.filter((building) => norm(building.name) === norm(route.destination_name)).length === 1 &&
            sbB.filter((building) => norm(building.name) === norm(route.destination_name)).length === 1));
        check('cross-backend',
          'both backends contain every configured natural destination node key',
          GUIDED_VR_ROUTES.every((route) =>
            myN.filter((node) => node.node_key === route.destination_node_key).length === 1 &&
            sbN.filter((node) => node.node_key === route.destination_node_key).length === 1));
      }
    }

    /* ---------------- static migration checks ---------------- */
    say('\nstatic migration checks (this probe applies NO SQL):');
    const dir = path.join(__dirname, '..', 'database', 'supabase');
    const sqlFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    const m18 = '0018_cas_building_baseline.sql';
    const m18Path = path.join(dir, m18);
    const m18Exists = fs.existsSync(m18Path);
    check('static', `${m18} exists`, m18Exists);
    check('static', '0019_be5_selected_demo_parity.sql is declared for owner review',
      sqlFiles.some((f) => f === '0019_be5_selected_demo_parity.sql'));
    check('static', `migration source list is contiguous 0001-0020 (20 files, found ${sqlFiles.length})`,
      sqlFiles.length === 20 &&
      sqlFiles.every((file, index) => file.startsWith(String(index + 1).padStart(4, '0') + '_')) &&
      sqlFiles[19] === '0020_room_schedule_documents.sql');

    if (m18Exists) {
      const sql = fs.readFileSync(m18Path, 'utf8');
      const body = sql.replace(/--[^\n]*/g, '');
      check('static', '0018 is transactional (BEGIN + COMMIT)',
        /\bBEGIN\s*;/i.test(body) && /\bCOMMIT\s*;/i.test(body));
      check('static', '0018 has a fail-closed preflight (DO block + RAISE EXCEPTION)',
        /DO\s+\$\$/i.test(body) && /RAISE\s+EXCEPTION/i.test(body));
      check('static', '0018 aborts on a duplicate CAS building row and on a missing/duplicate cas node',
        /building_count\s*>\s*1/i.test(body) && /node_count\s*<>\s*1/i.test(body));
      check('static', '0018 resolves by NATURAL KEY (building name + node_key), hardcoding no numeric id',
        /name\s*=\s*'College of Arts and Sciences'/i.test(body) &&
        /node_key\s*=\s*'cas'/i.test(body) &&
        !/(building_id|from_node_id|to_node_id)\s*=\s*\d+/i.test(body));
      check('static', '0018 update-or-inserts CAS (idempotent; no unique constraint on name to rely on)',
        /UPDATE\s+public\.buildings/i.test(body) &&
        /INSERT\s+INTO\s+public\.buildings/i.test(body) &&
        /WHERE\s+NOT\s+EXISTS/i.test(body));
      check('static', '0018 refreshes the PostGIS location with the schema-qualified expression',
        /extensions\.ST_SetSRID\s*\(\s*extensions\.ST_MakePoint/i.test(body));
      check('static', '0018 links ONLY the cas route node', /UPDATE\s+public\.route_nodes/i.test(body));
      check('static', '0018 is DATA-ONLY: no DDL, RLS, grants, or privilege changes',
        !/\bALTER\s+TABLE\b/i.test(body) && !/\bDROP\b/i.test(body) &&
        !/\bCREATE\s+(TABLE|INDEX|FUNCTION|POLICY)\b/i.test(body) &&
        !/ROW\s+LEVEL\s+SECURITY/i.test(body) &&
        !/\bGRANT\b/i.test(body) && !/\bREVOKE\b/i.test(body));
      check('static', '0018 does NOT touch route_edges, geometry, VR, schedules, media, or sessions',
        !/\broute_edges\b/i.test(body) && !/\bpath_geometry\b/i.test(body) &&
        !/\bvr_scenes\b/i.test(body) && !/\bvr_hotspots\b/i.test(body) &&
        !/\broom_schedules\b/i.test(body) && !/\bapp_sessions\b/i.test(body) &&
        !/\bimage_url\b/i.test(body) && !/\bcloudinary_public_id\b/i.test(body));

      /* ---- BE.2 NO-GO repair: concurrency-safety gate (comment-stripped body) ---- */
      say('\n  0018 concurrency safety (race-safe locking + postcondition):');
      const g = evaluateLockingGate(body);
      check('static', '0018 LOCKs public.buildings AND public.route_nodes IN SHARE ROW EXCLUSIVE MODE',
        g.locksPresent);
      check('static', '0018 takes both locks AFTER BEGIN', g.locksAfterBegin);
      check('static', '0018 takes both locks BEFORE the preflight DO block (no TOCTOU read)',
        g.locksBeforePreflight);
      check('static', '0018 locks buildings BEFORE route_nodes (deterministic order; no deadlock)',
        g.buildingsLockedFirst);
      check('static', '0018 has BOTH a preflight and a postcondition DO block', g.hasTwoDoBlocks);
      check('static', '0018 postcondition runs AFTER the route-node link UPDATE',
        g.postconditionAfterNodeLink);
      check('static', '0018 postcondition runs BEFORE COMMIT (still under the locks)',
        g.postconditionBeforeCommit);
      check('static', '0018 postcondition asserts exactly ONE canonical CAS building',
        g.postconditionAssertsOneBuilding);
      check('static', "0018 postcondition asserts exactly ONE 'cas' route node",
        g.postconditionAssertsOneNode);
      check('static', '0018 postcondition asserts the cas node is LINKED to that CAS building (one joined row)',
        g.postconditionAssertsLinkedNode);
      check('static', '0018 postcondition RAISEs (rolls the whole transaction back) on any failure',
        g.postconditionRaises);

      /* ---- negative fixture: the PRE-REPAIR form must be REJECTED ----
         Proves this gate is not vacuous. The old migration was transactional,
         natural-key and fail-closed on its PREflight — it just took no locks and
         proved no postcondition. It must now fail. Never written; never executed. */
      const old = evaluateLockingGate(OLD_UNLOCKED_0018_FIXTURE.replace(/--[^\n]*/g, ''));
      const oldRejected =
        old.locksPresent === false &&
        old.locksAfterBegin === false &&
        old.locksBeforePreflight === false &&
        old.buildingsLockedFirst === false &&
        old.hasTwoDoBlocks === false &&
        old.postconditionAssertsOneBuilding === false &&
        old.postconditionAssertsLinkedNode === false;
      check('static', 'NEGATIVE FIXTURE: the prior UNLOCKED 0018 form is REJECTED by this gate (gate is not vacuous)',
        oldRejected);
    }

    const sha = (f) => crypto.createHash('sha256')
      .update(fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r\n/g, '\n'), 'utf8')
      .digest('hex');
    for (const [file, expected] of Object.entries(IMMUTABLE)) {
      check('static', `${file.slice(0, 4)} is byte-for-byte unchanged (owner-applied)`, sha(file) === expected);
    }

    /* ---------------- leak scan ---------------- */
    say('\nleak scan over this probe\'s own output:');
    const blob = printed.join('\n');
    const LEAKS = [
      ['JWT-like token', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
      ['Supabase host', /[a-z0-9-]+\.supabase\.(co|com|in)/i],
      ['Supabase/Cloudinary credential name', /SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|CLOUDINARY_API_KEY|CLOUDINARY_API_SECRET/],
      ['session cookie value', /campusphere\.sid=/],
      ['SQL/driver/PostgREST text', /sqlMessage|ER_[A-Z_]{3,}|SQLSTATE|PostgREST|relation "[^"]+" does not exist/i],
      ['stack frame', /\bat [\w.$<>[\] ]+ \((?:file:\/\/|\/|[A-Za-z]:\\)[^)]*:\d+:\d+\)/]
    ];
    for (const [label, re] of LEAKS) check('leak', `no ${label}`, !re.test(blob));

    say('');
    say('NOTE 0018 is OWNER-APPLIED and immutable. Migration 0019 is only declared; this probe does not apply it.');
    say('NOTE read-only probe: no rows were created or modified, and no SQL was applied.');
  } catch (e) {
    console.error('  [FAIL] probe aborted by an unexpected error (sanitized).');
    failures.push('unexpected probe error');
  } finally {
    try { await db.end(); } catch (e) { /* already closed */ }
  }

  if (failures.length === 0) {
    console.log('BUILDING-BASELINE-PROBE OK: all checks passed.');
    process.exitCode = 0;
  } else {
    console.error(`BUILDING-BASELINE-PROBE FAILED: ${failures.length} check(s) did not pass:`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }
})();
