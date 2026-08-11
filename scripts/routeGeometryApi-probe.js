'use strict';

/* ========================================
   CampuSphere - Road-following route geometry API probe
   Pre-Milestone-12 RF.3 verification script.

   Part 1 (pure, no server, no DB writes): exercises the
   utils/routeGeometry.js normalization + assembly helpers against synthetic
   inputs — full geometry, one-edge fallback, mixed full/fallback, missing
   geometry, malformed MySQL JSON-string shape, malformed Supabase
   parsed-array shape, start-equals-destination, and the unavailable-node
   incomplete state.

   Part 2 (both runtime modes via scripts/with-server.js, never a foreground
   server): verifies the additive /api/pathfind contract:
     - every active catalog destination returns ordered numeric route.geometry
       whose first/last points equal the configured start/destination node
       coordinates, with no duplicated consecutive points;
     - route.nodes / route.segments / distance / walk-time metrics keep the
       pre-RF.3 shape byte-for-byte (segments carry NO geometry key);
     - reverse traversal returns the exact reversed forward geometry;
     - start-equals-destination returns exactly one coordinate;
     - leak scan over every captured body.

   READ-ONLY: no database rows are created or modified.
   Prints fixed PASS/FAIL labels and counts only - never raw geometry dumps,
   cookies, secrets, raw DB errors, hosts, or stack traces.

   Run:   node scripts/routeGeometryApi-probe.js
   ======================================== */

require('dotenv').config();

const { withServer } = require('./with-server');
const { hasSupabaseConfig } = require('../config/supabase');
const {
  ENDPOINT_EPSILON,
  normalizeStoredPathGeometry,
  assembleRouteGeometry,
  reversePathGeometry
} = require('../utils/routeGeometry');

// M12.P1-R1: regression identities come from the shared TEST-ONLY loader —
// deterministic local fixtures for the MySQL leg, SUPABASE_REGRESSION_* env
// (fail-closed, never printed) for the Supabase leg. No hardcoded
// live-capable credential remains in this probe.
const { getRegressionCredentials } = require('./regressionCredentials');
// Shared probe session ownership (scripts/probeSessionLifecycle.js): every
// canonical identity authenticated here is terminated through the real logout
// interface so `npm test` leaves no persisted regression session behind.
const { createProbeSessionTracker } = require('./probeSessionLifecycle');
const { GUIDED_VR_ROUTES } = require('../config/guidedVrRoutes');
const SEGMENT_KEYS = ['from', 'to', 'distance_meters', 'walk_time_seconds', 'path_label'];
const canonical = (value) => String(value == null ? '' : value)
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const failures = [];
function check(scope, label, ok) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!ok) failures.push(`${scope} :: ${label}`);
}

function near(a, b) { return Math.abs(a - b) <= ENDPOINT_EPSILON; }
function samePt(a, b) { return near(a.lat, b.lat) && near(a.lng, b.lng); }

function isOrderedNumericGeometry(g) {
  if (!Array.isArray(g) || g.length < 1) return false;
  for (const p of g) {
    if (p === null || typeof p !== 'object' || Array.isArray(p)) return false;
    if (Object.keys(p).length !== 2) return false;
    if (typeof p.lat !== 'number' || !Number.isFinite(p.lat)) return false;
    if (typeof p.lng !== 'number' || !Number.isFinite(p.lng)) return false;
    // RF.3 repair: public route.geometry must be geographically in range.
    if (p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) return false;
  }
  return true;
}

function hasConsecutiveDuplicate(g) {
  for (let i = 1; i < g.length; i++) {
    if (samePt(g[i - 1], g[i])) return true;
  }
  return false;
}

/* ---------------- Part 1: pure helper checks (no server) ---------------- */
function runPureHelperChecks() {
  const scope = 'helpers';
  const A = { key: 'a', lat: 10, lng: 20 };
  const B = { key: 'b', lat: 10.001, lng: 20.001 };
  const C = { key: 'c', lat: 10.002, lng: 20.002 };
  const abGeom = [{ lat: 10, lng: 20 }, { lat: 10.0005, lng: 20.0006 }, { lat: 10.001, lng: 20.001 }];
  const bcGeom = [{ lat: 10.001, lng: 20.001 }, { lat: 10.002, lng: 20.002 }];

  // normalization tri-state
  check(scope, 'null normalizes to missing', normalizeStoredPathGeometry(null).state === 'missing');
  check(scope, 'parsed array normalizes to present', normalizeStoredPathGeometry(abGeom).state === 'present');
  check(scope, 'MySQL JSON string normalizes to present', normalizeStoredPathGeometry(JSON.stringify(abGeom)).state === 'present');
  check(scope, 'malformed MySQL JSON string normalizes to invalid', normalizeStoredPathGeometry('{"not":"an array"').state === 'invalid');
  check(scope, 'non-array JSON string normalizes to invalid', normalizeStoredPathGeometry('"just a string"').state === 'invalid');
  check(scope, 'non-array parsed value normalizes to invalid', normalizeStoredPathGeometry({ lat: 1, lng: 2 }).state === 'invalid');

  // full geometry assembly
  const full = assembleRouteGeometry({
    nodes: [A, B, C],
    segments: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }],
    edgeGeometryByKey: new Map([['a|b', abGeom], ['b|c', bcGeom]])
  });
  check(scope, 'full geometry assembles in order with de-duplicated shared endpoint',
    full.geometry.length === 4 && full.fallbackEdges === 0 && full.invalidEdges === 0 &&
    !full.incomplete && samePt(full.geometry[0], A) && samePt(full.geometry[3], C) &&
    !hasConsecutiveDuplicate(full.geometry));

  // one-edge fallback (missing) mixed with full geometry
  const mixed = assembleRouteGeometry({
    nodes: [A, B, C],
    segments: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }],
    edgeGeometryByKey: new Map([['a|b', abGeom]]) // b|c missing
  });
  check(scope, 'missing edge geometry falls back to node endpoints (mixed route stays continuous)',
    mixed.fallbackEdges === 1 && mixed.invalidEdges === 0 && !mixed.incomplete &&
    mixed.geometry.length === 4 && samePt(mixed.geometry[3], C) && !hasConsecutiveDuplicate(mixed.geometry));

  // malformed Supabase parsed-array shape (bad point) -> invalid + fallback
  const badParsed = assembleRouteGeometry({
    nodes: [A, B],
    segments: [{ from: 'a', to: 'b' }],
    edgeGeometryByKey: new Map([['a|b', [{ lat: 'x', lng: 20 }, { lat: 10.001, lng: 20.001 }]]])
  });
  check(scope, 'malformed Supabase parsed-array shape falls back and is counted invalid',
    badParsed.invalidEdges === 1 && badParsed.geometry.length === 2 &&
    samePt(badParsed.geometry[0], A) && samePt(badParsed.geometry[1], B));

  // malformed MySQL JSON string -> invalid + fallback
  const badString = assembleRouteGeometry({
    nodes: [A, B],
    segments: [{ from: 'a', to: 'b' }],
    edgeGeometryByKey: new Map([['a|b', '[{"lat":10,']])
  });
  check(scope, 'malformed MySQL JSON string falls back and is counted invalid',
    badString.invalidEdges === 1 && badString.geometry.length === 2);

  // endpoint-mismatched stored geometry -> invalid + fallback
  const badEndpoint = assembleRouteGeometry({
    nodes: [A, B],
    segments: [{ from: 'a', to: 'b' }],
    edgeGeometryByKey: new Map([['a|b', [{ lat: 55, lng: 55 }, { lat: 10.001, lng: 20.001 }]]])
  });
  check(scope, 'endpoint-mismatched stored geometry falls back and is counted invalid',
    badEndpoint.invalidEdges === 1 && badEndpoint.geometry.length === 2);

  // start equals destination -> exactly one coordinate
  const trivial = assembleRouteGeometry({ nodes: [A], segments: [], edgeGeometryByKey: new Map() });
  check(scope, 'start-equals-destination returns exactly one coordinate',
    trivial.geometry.length === 1 && samePt(trivial.geometry[0], A) && !trivial.incomplete);

  // unavailable node coordinates -> empty geometry, incomplete
  const noCoords = assembleRouteGeometry({
    nodes: [{ key: 'a', lat: null, lng: null }, B],
    segments: [{ from: 'a', to: 'b' }],
    edgeGeometryByKey: new Map()
  });
  check(scope, 'unavailable node coordinates yield empty geometry with incomplete state',
    noCoords.geometry.length === 0 && noCoords.incomplete === true);

  // RF.3 repair: out-of-range endpoint nodes are unavailable. Missing edge
  // geometry combined with an out-of-range node must NOT expose the bad
  // coordinate through fallback — it returns the safe incomplete state.
  const outOfRange = [
    { name: 'latitude above 90',  bad: { key: 'a', lat: 91, lng: 20 } },
    { name: 'latitude below -90', bad: { key: 'a', lat: -91, lng: 20 } },
    { name: 'longitude above 180', bad: { key: 'a', lat: 10, lng: 181 } },
    { name: 'longitude below -180', bad: { key: 'a', lat: 10, lng: -181 } }
  ];
  for (const t of outOfRange) {
    const res = assembleRouteGeometry({
      nodes: [t.bad, B],
      segments: [{ from: 'a', to: 'b' }],
      edgeGeometryByKey: new Map() // missing geometry -> would fall back to endpoints
    });
    check(scope, `out-of-range endpoint (${t.name}) yields empty geometry with incomplete state`,
      res.geometry.length === 0 && res.incomplete === true);
  }

  // Exact geographic limits remain VALID endpoints (fallback works normally).
  const boundary = assembleRouteGeometry({
    nodes: [{ key: 'a', lat: -90, lng: -180 }, { key: 'b', lat: 90, lng: 180 }],
    segments: [{ from: 'a', to: 'b' }],
    edgeGeometryByKey: new Map()
  });
  check(scope, 'exact limit endpoints (-90/-180 .. 90/180) stay valid and fall back to endpoints',
    boundary.geometry.length === 2 && boundary.incomplete === false &&
    samePt(boundary.geometry[0], { lat: -90, lng: -180 }) &&
    samePt(boundary.geometry[1], { lat: 90, lng: 180 }));

  // Finite MySQL DECIMAL strings still supported for in-range coordinates.
  const decimalStr = assembleRouteGeometry({
    nodes: [{ key: 'a', lat: '10.00000000', lng: '20.00000000' }, B],
    segments: [{ from: 'a', to: 'b' }],
    edgeGeometryByKey: new Map()
  });
  check(scope, 'finite MySQL DECIMAL-string endpoints remain supported',
    decimalStr.geometry.length === 2 && decimalStr.incomplete === false &&
    samePt(decimalStr.geometry[0], A));

  // Start-equals-destination with an out-of-range node -> empty + incomplete.
  const trivialBad = assembleRouteGeometry({
    nodes: [{ key: 'a', lat: 200, lng: 20 }],
    segments: [],
    edgeGeometryByKey: new Map()
  });
  check(scope, 'start-equals-destination with an out-of-range node yields empty geometry with incomplete state',
    trivialBad.geometry.length === 0 && trivialBad.incomplete === true);
}

/* ---------------- Part 2: runtime API checks (both modes) ---------------- */

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
    header() {
      return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    },
  };
}

function metaCsrf(html) {
  const m = /<meta name="csrf-token" content="([^"]*)"/.exec(html || '');
  return m ? m[1] : '';
}

const LEAK_PATTERNS = [
  ['JWT-like token', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['Supabase host', /[a-z0-9-]+\.supabase\.(co|com|in)/i],
  ['stack frame', /\bat [\w.$<>[\] ]+ \((?:file:\/\/|\/|[A-Za-z]:\\)[^)]*:\d+:\d+\)/],
  ['SQL/driver/PostgREST text', /sqlMessage|SQLSTATE|PostgREST|relation "[^"]+" does not exist|syntax error at or near/i],
  ['MySQL driver error code', /\bER_[A-Z_]{3,}\b/],
  ['session cookie value', /campusphere\.sid=/],
  ['Supabase/Cloudinary credential name', /SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|CLOUDINARY_API_KEY|CLOUDINARY_API_SECRET/],
];

async function runMode(mode, base) {
  // M12.P1-R1: this leg's server has AUTH_DATA_SOURCE === mode (with-server
  // forces all six switches), so resolve matching regression credentials.
  const creds = getRegressionCredentials(mode);
  const STUDENT_EMAIL = creds.student.email;
  const STUDENT_PASS = creds.student.password;
  const bodies = [];

  async function jfetch(url, options) {
    const res = await fetch(base + url, options);
    const text = await res.text();
    bodies.push(text);
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* HTML */ }
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

  const sessions = createProbeSessionTracker({
    base,
    record: (label, pass) => check(mode, label, pass),
  });

  const student = await login(STUDENT_EMAIL, STUDENT_PASS);
  check(mode, 'student login -> 302', student.ok);
  if (student.ok) sessions.register('student', student.jar, '/dashboard');
  if (!student.ok) return bodies;

  /* Everything below runs inside a try whose finally terminates the session,
     so any early return still passes through cleanup. Intentionally NOT
     re-indented (minimal diff). */
  try {
  const H = { Cookie: student.jar.header(), Accept: 'application/json' };

  let r = await jfetch('/api/buildings', { headers: H });
  const buildings = (r.json && (r.json.buildings || r.json.data)) || [];
  const byName = new Map();
  for (const building of buildings) {
    const key = canonical(building.name);
    const list = byName.get(key) || [];
    list.push(building);
    byName.set(key, list);
  }
  const destinations = GUIDED_VR_ROUTES.map((policy) => {
    const matches = byName.get(canonical(policy.destination_name)) || [];
    return matches.length === 1 ? matches[0] : null;
  });
  check(mode, `all ${GUIDED_VR_ROUTES.length} configured destination buildings are listed exactly once`,
    GUIDED_VR_ROUTES.length === 25 && destinations.every(Boolean));

  // Every active catalog destination: additive geometry + unchanged legacy contract.
  let okCount = 0;
  let geometryPointTotal = 0;
  let directPair = null;
  for (const b of destinations.filter(Boolean)) {
    r = await jfetch(`/api/pathfind?start=main-gate&destinationBuildingId=${b.id}`, { headers: H });
    const route = r.json && r.json.route;
    if (!(r.status === 200 && r.json && r.json.success === true && route)) continue;

    const g = route.geometry;
    const nodes = route.nodes || [];
    const segs = route.segments || [];
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const legacyOk =
      Array.isArray(nodes) && nodes.length >= 2 &&
      Array.isArray(segs) && segs.length >= 1 &&
      segs.every((s) => {
        const keys = Object.keys(s).sort();
        return keys.length === SEGMENT_KEYS.length &&
          SEGMENT_KEYS.slice().sort().every((k, i) => keys[i] === k);
      }) &&
      Number(route.distance_meters) > 0 &&
      Number(route.walk_time_seconds) > 0 &&
      typeof route.estimated_walk_time === 'string';
    const geometryOk =
      isOrderedNumericGeometry(g) && g.length >= 2 &&
      samePt(g[0], { lat: Number(first.lat), lng: Number(first.lng) }) &&
      samePt(g[g.length - 1], { lat: Number(last.lat), lng: Number(last.lng) }) &&
      !hasConsecutiveDuplicate(g) &&
      g.length >= nodes.length; // stored shapes are at least as dense as the node line
    if (legacyOk && geometryOk) {
      okCount++;
      geometryPointTotal += g.length;
      if (!directPair && nodes.length >= 2) directPair = [nodes[0].key, nodes[1].key];
    }
  }
  check(mode, `${GUIDED_VR_ROUTES.length}/${GUIDED_VR_ROUTES.length} active destinations return ordered numeric route.geometry with intact legacy contract (ok ${okCount}/${GUIDED_VR_ROUTES.length}, total points ${geometryPointTotal})`,
    okCount === GUIDED_VR_ROUTES.length);

  // Reverse traversal: use the first direct segment from an accepted route so
  // no equal-cost whole-route tie can test Dijkstra selection instead of the
  // stored forward/reverse geometry contract.
  const pairStart = directPair && directPair[0];
  const pairEnd = directPair && directPair[1];
  const fwd = pairStart && pairEnd
    ? await jfetch(`/api/pathfind?start=${encodeURIComponent(pairStart)}&destinationNodeKey=${encodeURIComponent(pairEnd)}`, { headers: H })
    : { json: null };
  const rev = pairStart && pairEnd
    ? await jfetch(`/api/pathfind?start=${encodeURIComponent(pairEnd)}&destinationNodeKey=${encodeURIComponent(pairStart)}`, { headers: H })
    : { json: null };
  const fwdRoute = fwd.json && fwd.json.route;
  const revRoute = rev.json && rev.json.route;
  const fwdReversed = fwdRoute ? reversePathGeometry(fwdRoute.geometry) : [];
  const reverseMatches = !!fwdRoute && !!revRoute &&
    Array.isArray(fwdRoute.geometry) && fwdRoute.geometry.length >= 2 &&
    Array.isArray(revRoute.geometry) &&
    revRoute.geometry.length === fwdReversed.length &&
    revRoute.geometry.every((p, i) => samePt(p, fwdReversed[i]));
  check(mode, 'one direct route pair returns exact reversed forward geometry', reverseMatches);

  // Start equals destination: one coordinate.
  r = await jfetch('/api/pathfind?start=main-gate&destinationNodeKey=main-gate', { headers: H });
  const trivialRoute = r.json && r.json.route;
  check(mode, 'start-equals-destination returns exactly one geometry coordinate',
    r.status === 200 && !!trivialRoute && Array.isArray(trivialRoute.geometry) &&
    trivialRoute.geometry.length === 1 && Array.isArray(trivialRoute.nodes) && trivialRoute.nodes.length === 1);

  } finally {
    await sessions.terminateAll();
  }

  return bodies;
}

function leakScan(mode, bodies) {
  const blob = bodies.join('\n');
  for (const [label, re] of LEAK_PATTERNS) {
    check(mode, `leak scan: no ${label}`, !re.test(blob));
  }
}

(async () => {
  console.log('=== CampuSphere road-following route geometry API probe (Pre-Milestone-12 RF.3) ===');

  console.log('\npure helper checks (no server):');
  runPureHelperChecks();

  console.log('\nmysql mode:');
  const mysqlBodies = await withServer({ mode: 'mysql', port: 3378, sessionStore: 'mysql' }, (base) => runMode('mysql', base));
  leakScan('mysql', mysqlBodies || []);

  if (process.env.PROBE_SKIP_SUPABASE === '1' && !hasSupabaseConfig()) {
    console.log('\nsupabase mode: SKIP — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (MySQL fallback mode).');
  } else {
    console.log('\nsupabase mode:');
    const sbBodies = await withServer({ mode: 'supabase', port: 3379, sessionStore: 'supabase' }, (base) => runMode('supabase', base));
    leakScan('supabase', sbBodies || []);
  }

  console.log('');
  console.log('NOTE read-only probe: no rows were created or modified.');
  if (failures.length === 0) {
    console.log('ROUTE-GEOMETRY-API-PROBE OK: all checks passed.');
    process.exitCode = 0;
  } else {
    console.error(`ROUTE-GEOMETRY-API-PROBE FAILED: ${failures.length} check(s) did not pass:`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }
})();
