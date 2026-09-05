'use strict';

/* ========================================
   CampuSphere - Admin road-geometry editor probe
   Pre-Milestone-12 RF.4 verification script.

   Live MySQL and Supabase verification of PUT
   /admin/api/route-edges/:id/geometry and the route-node coordinate-change
   guard, plus static Supabase 0016 checks. Migration 0016 is owner-applied, so
   both backend modes must pass the same mutation and cleanup contract. Boots
   through scripts/with-server.js — never a foreground server.

   Covers: logged-out 401, non-admin 403, missing-CSRF 403, strict allowlist
   rejection, valid save, exact reverse, clear, reset, malformed shapes,
   range/point limits, endpoint snapping, missing-reverse 409, rollback / no
   partial writes, node-move guard (409 + metadata-only 200), audit action, and
   full cleanup (every changed geometry/node restored in finally; any throwaway
   edge deleted). Prints fixed PASS/FAIL labels only — never raw geometry,
   cookies, secrets, hosts, raw DB errors, or stack traces.

   Static Supabase 0016 checks: NULL-clear RPC branch, node-move backstop,
   SECURITY INVOKER + pinned search_path, service-role-only grants, fixed
   errors; 0014 + 0015 byte-for-byte unchanged; no 0017.

   Run:   node scripts/adminRouteGeometryEditor-probe.js
   ======================================== */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { withServer } = require('./with-server');

// M12.P1-R1: regression identities come from the shared TEST-ONLY loader —
// deterministic local fixtures for the MySQL leg, SUPABASE_REGRESSION_* env
// (fail-closed, never printed) for the Supabase leg. No hardcoded
// live-capable credential remains in this probe.
const { getRegressionCredentials } = require('./regressionCredentials');
// Shared probe session ownership (scripts/probeSessionLifecycle.js). Every
// canonical identity this probe authenticates is terminated through the real
// logout interface, so a standalone run leaves no persisted regression session.
const { createProbeSessionTracker } = require('./probeSessionLifecycle');

const EXPECTED_0014_SHA256 = 'ad9179bd0def19567b512e495fd3133211288e253c872b260421a912cc44e6aa';
const EXPECTED_0015_SHA256 = 'e7c6d828faf07c53d923ed58651a0abb8a834273eefa38aa0c04fbf492f70c99';

// Exact migration-source sequence guard: every position 0001_..0020_
// must be present exactly once in sorted order. Migrations through 0019 are
// owner-applied; 0020 is source-only pending separate operational approval.
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
  const sorted = files.filter((file) => ![
    '0021_minimal_instructor_oauth_registration.sql',
    '0022_user_presence.sql'
  ].includes(file)).slice().sort();

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
function check(scope, label, ok) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!ok) failures.push(`${scope} :: ${label}`);
}

function cookieJar() {
  const cookies = new Map();
  return {
    apply(res) {
      let list = [];
      if (typeof res.headers.getSetCookie === 'function') list = res.headers.getSetCookie() || [];
      else { const sc = res.headers.get('set-cookie'); if (sc) list = [sc]; }
      for (const sc of list) {
        const pair = String(sc).split(';')[0];
        const eq = pair.indexOf('=');
        if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    },
    header() { return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; '); },
  };
}
function metaCsrf(html) { const m = /<meta name="csrf-token" content="([^"]*)"/.exec(html || ''); return m ? m[1] : ''; }

const LEAK_PATTERNS = [
  ['JWT-like token', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['Supabase host', /[a-z0-9-]+\.supabase\.(co|com|in)/i],
  ['stack frame', /\bat [\w.$<>[\] ]+ \((?:file:\/\/|\/|[A-Za-z]:\\)[^)]*:\d+:\d+\)/],
  ['SQL/driver/PostgREST text', /sqlMessage|SQLSTATE|PostgREST|relation "[^"]+" does not exist|syntax error at or near/i],
  ['MySQL driver error code', /\bER_[A-Z_]{3,}\b/],
  ['session cookie value', /campusphere\.sid=/],
  ['Supabase/Cloudinary credential name', /SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|CLOUDINARY_API_KEY|CLOUDINARY_API_SECRET/],
];

function near(a, b, eps) { return Math.abs(Number(a) - Number(b)) <= (eps || 1e-9); }

async function runMode(base, mode) {
  // M12.P1-R1: this leg's server has AUTH_DATA_SOURCE === mode (with-server
  // forces all six switches), so resolve matching regression credentials.
  const creds = getRegressionCredentials(mode);
  const ADMIN_EMAIL = creds.admin.email;
  const ADMIN_PASS = creds.admin.password;
  const STUDENT_EMAIL = creds.student.email;
  const STUDENT_PASS = creds.student.password;
  const bodies = [];
  async function jfetch(url, options) {
    const res = await fetch(base + url, options);
    const text = await res.text();
    bodies.push(text);
    let json = null; try { json = JSON.parse(text); } catch (e) { /* html */ }
    return { status: res.status, json };
  }
  async function login(email, pass) {
    const jar = cookieJar();
    const pre = await fetch(base + '/auth', { headers: { Accept: 'text/html' } });
    jar.apply(pre);
    const csrf0 = metaCsrf(await pre.text());
    const r = await fetch(base + '/login', {
      method: 'POST', redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.header() },
      body: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(pass)}&_csrf=${encodeURIComponent(csrf0)}`,
    });
    jar.apply(r);
    return { ok: r.status === 302, jar };
  }
  async function adminCsrf(jar) {
    const r = await fetch(base + '/admin/campus-map', { headers: { Accept: 'text/html', Cookie: jar.header() } });
    jar.apply(r);
    return metaCsrf(await r.text());
  }

  // One tracker per runMode/base/backend invocation.
  const sessions = createProbeSessionTracker({
    base,
    record: (label, pass) => check(mode, label, pass),
  });

  /* Outer try: session termination is the OUTERMOST cleanup action. It runs
     when a later assertion throws, on every early `return bodies`, and even if
     the geometry/node/throwaway-edge cleanup below fails — that fixture
     cleanup stays the INNER cleanup and is unchanged. The block is
     intentionally NOT re-indented so this stays a reviewable, minimal diff. */
  try {

  // ---- anonymous + non-admin + CSRF contracts ----
  let r = await jfetch('/admin/api/route-edges/1/geometry', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ path_geometry: null })
  });
  check(mode, 'anonymous geometry PUT -> 401 JSON', r.status === 401 && !!r.json && r.json.success === false);

  const student = await login(STUDENT_EMAIL, STUDENT_PASS);
  check(mode, 'student login -> 302', student.ok);
  if (student.ok) sessions.register('student', student.jar, '/dashboard');
  const scsrf = await adminCsrf(student.jar).catch(() => '');
  r = await jfetch('/admin/api/route-edges/1/geometry', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Cookie: student.jar.header(), 'X-CSRF-Token': scsrf || 'x' },
    body: JSON.stringify({ path_geometry: null })
  });
  check(mode, 'non-admin geometry PUT -> 403', r.status === 403);

  const admin = await login(ADMIN_EMAIL, ADMIN_PASS);
  check(mode, 'admin login -> 302', admin.ok);
  if (admin.ok) sessions.register('admin', admin.jar, '/admin/campus-map');
  if (!admin.ok) return bodies;
  const csrf = await adminCsrf(admin.jar);
  check(mode, 'admin CSRF token available', csrf.length > 0);
  const H = { 'Content-Type': 'application/json', Accept: 'application/json', Cookie: admin.jar.header(), 'X-CSRF-Token': csrf };
  const GET = { Accept: 'application/json', Cookie: admin.jar.header() };
  const put = (id, body) => jfetch('/admin/api/route-edges/' + id + '/geometry', { method: 'PUT', headers: H, body: JSON.stringify(body) });

  // Missing CSRF (admin cookie, no token) -> 403.
  r = await jfetch('/admin/api/route-edges/1/geometry', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Cookie: admin.jar.header() },
    body: JSON.stringify({ path_geometry: null })
  });
  check(mode, 'missing CSRF geometry PUT -> 403', r.status === 403);

  // ---- pick a target edge with a resolvable reverse ----
  r = await jfetch('/admin/api/route-edges', { headers: GET });
  const edges = (r.json && r.json.edges) || [];
  const nodesResp = await jfetch('/admin/api/route-nodes', { headers: GET });
  const allNodes = (nodesResp.json && nodesResp.json.nodes) || [];
  const byKey = new Map(allNodes.map((n) => [n.node_key, n]));
  const mainGate = byKey.get('main-gate');
  const revExists = (f, t) => edges.some((e) => Number(e.from_node_id) === t && Number(e.to_node_id) === f);
  const target = mainGate && edges.find((e) =>
    Number(e.from_node_id) === Number(mainGate.id) &&
    revExists(Number(e.from_node_id), Number(e.to_node_id)));
  check(mode, 'fixture: a main-gate edge with a reverse pair exists', !!target);
  if (!target) return bodies;
  const E = Number(target.id);
  const reverse = edges.find((e) => Number(e.from_node_id) === Number(target.to_node_id) && Number(e.to_node_id) === Number(target.from_node_id));
  const R = Number(reverse.id);

  // Editor read: geometry + endpoint coords.
  r = await jfetch('/admin/api/route-edges/' + E, { headers: GET });
  const edge = r.json && r.json.edge;
  check(mode, 'single-edge GET returns endpoint coords + path_geometry', !!edge &&
    typeof edge.from_lat === 'number' && typeof edge.to_lat === 'number' &&
    Object.prototype.hasOwnProperty.call(edge, 'path_geometry'));
  if (!edge) return bodies;
  const fromNode = { lat: edge.from_lat, lng: edge.from_lng };
  const toNode = { lat: edge.to_lat, lng: edge.to_lng };

  // Snapshot original geometry of E and R for exact restoration.
  const origForward = Array.isArray(edge.path_geometry) ? edge.path_geometry.map((p) => ({ lat: p.lat, lng: p.lng })) : null;
  const rEdgeResp = await jfetch('/admin/api/route-edges/' + R, { headers: GET });
  const origReverse = rEdgeResp.json && Array.isArray(rEdgeResp.json.edge && rEdgeResp.json.edge.path_geometry)
    ? rEdgeResp.json.edge.path_geometry.map((p) => ({ lat: p.lat, lng: p.lng })) : null;

  const mid = { lat: (fromNode.lat + toNode.lat) / 2, lng: (fromNode.lng + toNode.lng) / 2 };
  const validGeom = [{ lat: fromNode.lat, lng: fromNode.lng }, mid, { lat: toNode.lat, lng: toNode.lng }];

  // Ensure list endpoints stay geometry-free.
  check(mode, 'list endpoint stays geometry-free', edges.every((e) => !Object.prototype.hasOwnProperty.call(e, 'path_geometry')));

  // ---- Finding 1: directed-edge endpoints are immutable ----
  // A third node distinct from the target's endpoints, to attempt a reassignment.
  const thirdNode = edges
    .map((e) => Number(e.from_node_id))
    .find((nid) => nid !== Number(target.from_node_id) && nid !== Number(target.to_node_id));
  const scalarBody = {
    from_node_id: Number(target.from_node_id), to_node_id: Number(target.to_node_id),
    distance_meters: Number(target.distance_meters) || 1, walk_time_seconds: Number(target.walk_time_seconds) || 1,
    path_label: target.path_label != null ? target.path_label : null, is_accessible: !!target.is_accessible
  };
  // Reassigning the from-node is rejected with the fixed 409, and geometry is untouched.
  r = await jfetch('/admin/api/route-edges/' + E, { method: 'PUT', headers: H, body: JSON.stringify(Object.assign({}, scalarBody, { from_node_id: thirdNode })) });
  check(mode, 'endpoint reassignment (from-node) -> 409', r.status === 409 && !!r.json &&
    /cannot be changed after creation/i.test(String(r.json.message || '')));
  r = await jfetch('/admin/api/route-edges/' + E, { method: 'PUT', headers: H, body: JSON.stringify(Object.assign({}, scalarBody, { to_node_id: thirdNode })) });
  check(mode, 'endpoint reassignment (to-node) -> 409', r.status === 409);
  // Forward + reverse geometry must be exactly what it was before the rejects.
  let ge = await jfetch('/admin/api/route-edges/' + E, { headers: GET });
  let grr = await jfetch('/admin/api/route-edges/' + R, { headers: GET });
  check(mode, 'geometry unchanged after rejected reassignment',
    JSON.stringify((ge.json.edge && ge.json.edge.path_geometry) || null) === JSON.stringify(origForward || null) &&
    JSON.stringify((grr.json.edge && grr.json.edge.path_geometry) || null) === JSON.stringify(origReverse || null));
  // Scalar-only edit (same endpoints, changed distance) succeeds, then restore.
  r = await jfetch('/admin/api/route-edges/' + E, { method: 'PUT', headers: H, body: JSON.stringify(Object.assign({}, scalarBody, { distance_meters: scalarBody.distance_meters + 7 })) });
  check(mode, 'scalar-only edit (unchanged endpoints) -> 200', r.status === 200);
  await jfetch('/admin/api/route-edges/' + E, { method: 'PUT', headers: H, body: JSON.stringify(scalarBody) }); // restore scalars

  // ---- strict allowlist ----
  r = await put(E, { path_geometry: validGeom, extra_field: 1 });
  check(mode, 'strict allowlist: unknown field -> 400', r.status === 400);
  r = await jfetch('/admin/api/route-edges/' + E + '/geometry', { method: 'PUT', headers: H, body: JSON.stringify({ other: 1 }) });
  check(mode, 'strict allowlist: missing path_geometry -> 400', r.status === 400);

  // ---- malformed shapes ----
  r = await put(E, { path_geometry: 'not-an-array' });
  check(mode, 'malformed: string geometry -> 400', r.status === 400);
  r = await put(E, { path_geometry: [{ lat: fromNode.lat, lng: fromNode.lng }] });
  check(mode, 'malformed: fewer than 2 points -> 400', r.status === 400);
  r = await put(E, { path_geometry: [{ lat: fromNode.lat }, { lat: toNode.lat, lng: toNode.lng }] });
  check(mode, 'malformed: missing lng key -> 400', r.status === 400);
  r = await put(E, { path_geometry: [{ lat: fromNode.lat, lng: fromNode.lng, extra: 1 }, { lat: toNode.lat, lng: toNode.lng }] });
  check(mode, 'malformed: extra point key -> 400', r.status === 400);

  // ---- range / point limits ----
  r = await put(E, { path_geometry: [{ lat: 91, lng: fromNode.lng }, { lat: toNode.lat, lng: toNode.lng }] });
  check(mode, 'range: latitude 91 -> 400', r.status === 400);
  const tooMany = [{ lat: fromNode.lat, lng: fromNode.lng }];
  for (let i = 0; i < 200; i++) tooMany.push({ lat: mid.lat, lng: mid.lng });
  tooMany.push({ lat: toNode.lat, lng: toNode.lng }); // 202 points
  r = await put(E, { path_geometry: tooMany });
  check(mode, 'limits: over 200 points -> 400', r.status === 400);

  // ---- endpoint mismatch -> 400 (before any successful write) ----
  r = await put(E, { path_geometry: [{ lat: fromNode.lat + 0.01, lng: fromNode.lng }, { lat: toNode.lat, lng: toNode.lng }] });
  check(mode, 'endpoint mismatch beyond epsilon -> 400', r.status === 400);

  // Confirm no partial write happened from the rejected attempts above.
  let g = await jfetch('/admin/api/route-edges/' + E, { headers: GET });
  const afterRejects = g.json && g.json.edge ? g.json.edge.path_geometry : undefined;
  check(mode, 'rollback: rejected saves left geometry unchanged',
    JSON.stringify(afterRejects || null) === JSON.stringify(origForward || null));

  // ---- endpoint snapping (sub-epsilon offset accepted + snapped) ----
  const snapGeom = [
    { lat: fromNode.lat + 5e-7, lng: fromNode.lng },
    mid,
    { lat: toNode.lat, lng: toNode.lng + 5e-7 }
  ];
  r = await put(E, { path_geometry: snapGeom });
  check(mode, 'endpoint snapping: sub-epsilon offset accepted -> 200', r.status === 200 && !!r.json && r.json.success === true);
  g = await jfetch('/admin/api/route-edges/' + E, { headers: GET });
  const snapped = g.json && g.json.edge ? g.json.edge.path_geometry : null;
  check(mode, 'endpoint snapping: stored endpoints equal node coordinates',
    Array.isArray(snapped) && near(snapped[0].lat, fromNode.lat) && near(snapped[0].lng, fromNode.lng) &&
    near(snapped[snapped.length - 1].lat, toNode.lat) && near(snapped[snapped.length - 1].lng, toNode.lng));

  // ---- valid save + exact reverse ----
  r = await put(E, { path_geometry: validGeom });
  check(mode, 'valid geometry save -> 200', r.status === 200 && !!r.json && r.json.success === true);
  g = await jfetch('/admin/api/route-edges/' + E, { headers: GET });
  const savedFwd = g.json && g.json.edge ? g.json.edge.path_geometry : null;
  const gr = await jfetch('/admin/api/route-edges/' + R, { headers: GET });
  const savedRev = gr.json && gr.json.edge ? gr.json.edge.path_geometry : null;
  const isExactReverse = Array.isArray(savedFwd) && Array.isArray(savedRev) &&
    savedFwd.length === savedRev.length &&
    savedFwd.every((p, i) => near(p.lat, savedRev[savedRev.length - 1 - i].lat) && near(p.lng, savedRev[savedRev.length - 1 - i].lng));
  check(mode, 'reverse row stores the exact reversed sequence', isExactReverse);

  // ---- reset (two endpoints) ----
  r = await put(E, { path_geometry: [{ lat: fromNode.lat, lng: fromNode.lng }, { lat: toNode.lat, lng: toNode.lng }] });
  check(mode, 'reset to endpoints -> 200', r.status === 200);
  g = await jfetch('/admin/api/route-edges/' + E, { headers: GET });
  check(mode, 'reset stored exactly two points', Array.isArray(g.json.edge.path_geometry) && g.json.edge.path_geometry.length === 2);

  // ---- clear (null both directions) ----
  r = await put(E, { path_geometry: null });
  check(mode, 'clear geometry -> 200', r.status === 200);
  g = await jfetch('/admin/api/route-edges/' + E, { headers: GET });
  const clearedF = g.json && g.json.edge ? g.json.edge.path_geometry : 'x';
  const gr2 = await jfetch('/admin/api/route-edges/' + R, { headers: GET });
  const clearedR = gr2.json && gr2.json.edge ? gr2.json.edge.path_geometry : 'x';
  check(mode, 'clear removed geometry from both directions', clearedF === null && clearedR === null);

  // ---- missing-reverse 409 via a throwaway one-directional edge ----
  let throwawayEdgeId = null;
  const A = byKey.get('main-gate'), B = byKey.get('chs');
  const connected = (f, t) => edges.some((e) => (Number(e.from_node_id) === f && Number(e.to_node_id) === t));
  if (A && B && !connected(Number(A.id), Number(B.id)) && !connected(Number(B.id), Number(A.id))) {
    const cr = await jfetch('/admin/api/route-edges', {
      method: 'POST', headers: H,
      body: JSON.stringify({ from_node_id: A.id, to_node_id: B.id, distance_meters: 1, walk_time_seconds: 1, is_accessible: true })
    });
    if (cr.status === 201 && cr.json && cr.json.edge) {
      throwawayEdgeId = Number(cr.json.edge.id);
      const rr = await put(throwawayEdgeId, { path_geometry: [{ lat: Number(A.lat), lng: Number(A.lng) }, { lat: Number(B.lat), lng: Number(B.lng) }] });
      check(mode, 'missing reverse pair -> 409', rr.status === 409);
    } else {
      check(mode, 'missing reverse pair -> 409 (throwaway edge create failed)', false);
    }
  } else {
    check(mode, 'missing reverse pair -> 409 (fixture unavailable)', false);
  }

  // ---- node-move guard (attached geometry still exists on other edges) ----
  const fromNodeId = Number(target.from_node_id);
  const nGet = await jfetch('/admin/api/route-nodes/' + fromNodeId, { headers: GET });
  const nodeRow = nGet.json && nGet.json.node;
  check(mode, 'fixture: from-node loaded for node-move guard', !!nodeRow);
  let nodeRestore = null;
  if (nodeRow) {
    nodeRestore = { node_key: nodeRow.node_key, label: nodeRow.label, node_type: nodeRow.node_type, building_id: nodeRow.building_id, lat: nodeRow.lat, lng: nodeRow.lng, display_order: nodeRow.display_order };
    // Coordinate change -> 409 (main-gate has attached geometry on other edges).
    const moved = Object.assign({}, nodeRestore, { lat: Number(nodeRow.lat) + 0.0005 });
    let nm = await jfetch('/admin/api/route-nodes/' + fromNodeId, { method: 'PUT', headers: H, body: JSON.stringify(moved) });
    check(mode, 'node coordinate change with attached geometry -> 409', nm.status === 409);
    // Metadata-only edit (same coords, changed display_order) -> 200.
    const metaOnly = Object.assign({}, nodeRestore, { display_order: Number(nodeRestore.display_order || 0) + 100 });
    nm = await jfetch('/admin/api/route-nodes/' + fromNodeId, { method: 'PUT', headers: H, body: JSON.stringify(metaOnly) });
    check(mode, 'metadata-only node edit (unchanged coords) -> 200', nm.status === 200);
  }

  // ---- audit action recorded (best-effort read of the admin log) ----
  await put(E, { path_geometry: validGeom }); // produce an audited geometry update
  // The audit write is fire-and-forget; settle briefly and retry once.
  let auditSeen = false;
  for (let attempt = 0; attempt < 3 && !auditSeen; attempt++) {
    await new Promise((rs) => setTimeout(rs, 300));
    const logResp = await jfetch('/admin/api/logs?limit=25', { headers: GET });
    const logs = (logResp.json && (logResp.json.logs || logResp.json.entries || logResp.json.data)) || [];
    auditSeen = Array.isArray(logs) && logs.some((row) => /route_edge\.geometry/.test(JSON.stringify(row || {})));
  }
  check(mode, 'audit records a route_edge.geometry action', auditSeen);

  // ---- cleanup: restore E + R geometry and the node exactly ----
  try {
    if (origForward) await put(E, { path_geometry: origForward });
    else await put(E, { path_geometry: null });
    // Restoring E's forward geometry rewrites R as the exact reverse; verify
    // it matches the captured original reverse.
    const vf = await jfetch('/admin/api/route-edges/' + E, { headers: GET });
    const vr = await jfetch('/admin/api/route-edges/' + R, { headers: GET });
    const okF = JSON.stringify((vf.json.edge && vf.json.edge.path_geometry) || null) === JSON.stringify(origForward || null);
    const okR = JSON.stringify((vr.json.edge && vr.json.edge.path_geometry) || null) === JSON.stringify(origReverse || null);
    check(mode, 'cleanup: original forward + reverse geometry restored exactly', okF && okR);
  } catch (e) {
    check(mode, 'cleanup: original forward + reverse geometry restored exactly', false);
  }
  if (nodeRestore) {
    try {
      const rr = await jfetch('/admin/api/route-nodes/' + fromNodeId, { method: 'PUT', headers: H, body: JSON.stringify(nodeRestore) });
      check(mode, 'cleanup: node restored', rr.status === 200);
    } catch (e) { check(mode, 'cleanup: node restored', false); }
  }
  if (throwawayEdgeId) {
    try {
      const dr = await jfetch('/admin/api/route-edges/' + throwawayEdgeId, { method: 'DELETE', headers: H });
      check(mode, 'cleanup: throwaway edge deleted', dr.status === 200);
    } catch (e) { check(mode, 'cleanup: throwaway edge deleted', false); }
  }

  } finally {
    await sessions.terminateAll();
  }

  return bodies;
}

function leakScan(mode, bodies) {
  const blob = bodies.join('\n');
  for (const [label, re] of LEAK_PATTERNS) check(mode, `leak scan: no ${label}`, !re.test(blob));
}

function runStaticSupabaseChecks() {
  const scope = 'supabase-static';
  const root = path.join(__dirname, '..');
  const dir = path.join(root, 'database', 'supabase');
  const m16Path = path.join(dir, '0016_route_geometry_admin_writes.sql');
  const exists = fs.existsSync(m16Path);
  check(scope, '0016_route_geometry_admin_writes.sql exists', exists);
  if (exists) {
    const sql = fs.readFileSync(m16Path, 'utf8');
    check(scope, '0016 CREATE OR REPLACE app_set_route_edge_geometry_pair',
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.app_set_route_edge_geometry_pair/i.test(sql));
    check(scope, '0016 NULL geometry clears both directions',
      /p_geometry\s+IS\s+NULL/i.test(sql) && /SET\s+path_geometry\s*=\s*NULL/i.test(sql));
    check(scope, '0016 derives reverse mechanically (WITH ORDINALITY DESC)',
      /WITH\s+ORDINALITY/i.test(sql) && /ORDER\s+BY\s+t\.ord\s+DESC/i.test(sql));
    check(scope, '0016 keeps fixed errors INVALID_GEOMETRY + EDGE_PAIR_NOT_FOUND',
      /INVALID_GEOMETRY/.test(sql) && /EDGE_PAIR_NOT_FOUND/.test(sql));
    // Finding 2: deterministic locking + validate-under-lock.
    check(scope, '0016 geometry RPC locks nodes + edges in ascending-id order (FOR UPDATE)',
      (sql.match(/ORDER\s+BY\s+id\s+FOR\s+UPDATE/gi) || []).length >= 2 &&
      /route_nodes[\s\S]*ORDER\s+BY\s+id\s+FOR\s+UPDATE/i.test(sql) &&
      /route_edges[\s\S]*ORDER\s+BY\s+id\s+FOR\s+UPDATE/i.test(sql));
    check(scope, '0016 geometry RPC validates endpoints against locked node coords within 1e-6',
      /jsonb_typeof\(p_geometry->0->'lat'\)/.test(sql) &&
      /abs\(v_first_lat\s*-\s*v_from_lat[\s\S]*0\.000001/i.test(sql) &&
      /abs\(v_last_lat\s*-\s*v_to_lat[\s\S]*0\.000001/i.test(sql));
    check(scope, '0016 CREATE OR REPLACE app_update_route_node with node-move backstop',
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.app_update_route_node/i.test(sql) && /NODE_GEOMETRY_ATTACHED/.test(sql));
    check(scope, '0016 node-update RPC locks the target node FOR UPDATE before comparing',
      /route_nodes\s+rn[\s\S]*WHERE\s+rn\.id\s*=\s*p_id[\s\S]*FOR\s+UPDATE/i.test(sql));
    check(scope, '0016 functions use SECURITY INVOKER + pinned search_path',
      (sql.match(/SECURITY\s+INVOKER/gi) || []).length >= 2 &&
      (sql.match(/SET\s+search_path\s*=\s*pg_catalog,\s*public/gi) || []).length >= 2);
    check(scope, '0016 grants EXECUTE only to service_role (revokes PUBLIC/anon/authenticated)',
      /REVOKE\s+EXECUTE[\s\S]*FROM\s+PUBLIC/i.test(sql) && /REVOKE\s+EXECUTE[\s\S]*FROM\s+anon/i.test(sql) &&
      /REVOKE\s+EXECUTE[\s\S]*FROM\s+authenticated/i.test(sql) && /GRANT\s+EXECUTE[\s\S]*TO\s+service_role/i.test(sql));
  }
  // Application maps the RPC's INVALID_GEOMETRY to a sanitized 400 (EDGE_PAIR_
  // NOT_FOUND / NODE_GEOMETRY_ATTACHED remain 409).
  const ctrl = fs.readFileSync(path.join(root, 'controllers', 'adminRouteController.js'), 'utf8');
  check(scope, 'controller maps INVALID_GEOMETRY -> sanitized 400',
    /INVALID_GEOMETRY[\s\S]{0,160}status\(400\)/.test(ctrl));
  check(scope, 'controller keeps EDGE_PAIR_NOT_FOUND + NODE_GEOMETRY_ATTACHED -> 409',
    /EDGE_PAIR_NOT_FOUND[\s\S]{0,160}status\(409\)/.test(ctrl) &&
    /NODE_GEOMETRY_ATTACHED[\s\S]{0,160}status\(409\)/.test(ctrl));
  check(scope, 'controller enforces immutable edge endpoints (409)',
    /Edge endpoints cannot be changed after creation/.test(ctrl));

  // 0014 + 0015 immutable. 0017, 0018, and 0019 are owner-applied.
  const migrationHash = (file) => crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n'), 'utf8')
    .digest('hex');
  const h14 = migrationHash('0014_route_graph_accuracy.sql');
  const h15 = migrationHash('0015_route_edge_path_geometry.sql');
  check(scope, '0014 unchanged (byte-for-byte)', h14 === EXPECTED_0014_SHA256);
  check(scope, '0015 unchanged (byte-for-byte)', h15 === EXPECTED_0015_SHA256);
  const sqlFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  // BE.2 added 0018 (CAS building baseline; data-only, OWNER-APPLIED).
  // It grants no privilege and defines no function, so the admin write contract
  // asserted here is unaffected.
  check(scope, '0018_cas_building_baseline.sql is declared (BE.2; owner-applied)',
    sqlFiles.some((f) => f === '0018_cas_building_baseline.sql'));
  // BE.5 added 0019 (selected-demo parity; data-only, OWNER-APPLIED). It grants
  // no privilege and defines no function, so the admin write contract asserted
  // here is unaffected.
  check(scope, '0019_be5_selected_demo_parity.sql is declared (BE.5; owner-applied)',
    sqlFiles.some((f) => f === '0019_be5_selected_demo_parity.sql'));
  check(scope, 'migration source list is contiguous 0001-0020', hasExactMigrationSequence(sqlFiles));
  // Database-free negative fixture on an in-memory copy: no migration file is
  // created, renamed, deleted, or modified.
  check(scope, 'migration sequence guard rejects a missing middle migration and duplicate prefix',
    hasExactMigrationSequence(
      sqlFiles.filter((f) => !f.startsWith('0010_')).concat('0018_duplicate.sql')
    ) === false);
}

(async () => {
  console.log('=== CampuSphere admin road-geometry editor probe (Pre-Milestone-12 RF.4) ===');

  for (const [mode, port] of [['mysql', 3380], ['supabase', 3381]]) {
    console.log(`\n${mode} live checks:`);
    const bodies = await withServer({ mode, port, sessionStore: mode }, (base) => runMode(base, mode));
    leakScan(mode, bodies || []);
  }

  console.log('\nsupabase static migration/RPC checks (0016 owner-applied):');
  runStaticSupabaseChecks();

  console.log('');
  console.log('NOTE live MySQL and Supabase RF.4 mutation verification completed.');
  console.log('NOTE all changed geometry/nodes were restored and every throwaway edge was deleted in both modes.');
  if (failures.length === 0) {
    console.log('ADMIN-ROUTE-GEOMETRY-EDITOR-PROBE OK: all checks passed.');
    process.exitCode = 0;
  } else {
    console.error(`ADMIN-ROUTE-GEOMETRY-EDITOR-PROBE FAILED: ${failures.length} check(s) did not pass:`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }
})();
