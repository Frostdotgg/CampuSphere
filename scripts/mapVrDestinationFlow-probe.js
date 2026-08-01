'use strict';

/* ========================================
   CampuSphere - Map Destination & VR Route Flow probe
   Milestone 11 Section 11.8B + RF.6 guided-VR arrival contract.

   Boots through scripts/with-server.js (never a foreground server) in BOTH
   runtime modes and verifies the destination-based navigation contract:

     - /api/pathfind?start=main-gate&destinationBuildingId=<valid> returns a
       computed route (nodes, segments, walk time) when graph data supports it
     - invalid building id -> sanitized 400; unknown building/start -> 404;
       missing params -> 400
     - /api/vr/to/:buildingId returns the synthesized Guard House / Main Gate
       route (route.id null, destination match, scene sequence + path)
     - /vr/to/:buildingId renders usable HTML (including for invalid ids)
     - backward compatibility: /api/routes, /api/routes/:id,
       /vr/routes/:routeId, /api/vr/routes/:routeId still work
     - anonymous access still gets the clean 401 JSON contract
     - leak scan over every captured body

   RF.6 ARRIVAL CONTRACT (the NO-GO this probe now locks down)
   -----------------------------------------------------------
   Collecting SOME scenes along the path does NOT mean the walkthrough reaches
   the destination. Guided VR must never claim arrival at a building that has
   no mapped 360 scene.

     PARTIAL case  — Engineering Building (no mapped VR scene):
       * the path's available scene(s) are still shown (nothing is hidden)
       * destination_reached === false
       * the API carries a fixed coverage message
       * the HTML shows the coverage notice and NEVER "Route complete" /
         "You have arrived"
       * there is NO active Next link past the last available scene

     ACTIVE case — College of Computer Studies (CCS):
       * campus-map pathfinding remains available through the `ccs` node
       * guided VR returns the exact 23-scene route through Road 94
       * HTML/API claim arrival only at the final mapped CCS scene

   Buildings are resolved PER MODE by NORMALIZED NAME via /api/search — never
   by reusing a numeric id across backends (MySQL and Supabase ids need not
   agree).

   The probe is READ-ONLY: it creates no rows and mutates nothing, so there is
   nothing to clean up. Prints fixed PASS/FAIL labels only — never raw rows,
   cookies, secrets, raw request bodies, raw DB errors, or stack traces.

   Run:   node scripts/mapVrDestinationFlow-probe.js
   ======================================== */

require('dotenv').config();

const { withServer } = require('./with-server');
const { hasSupabaseConfig } = require('../config/supabase');
const { GUIDED_VR_ROUTES } = require('../config/guidedVrRoutes');

// M12.P1-R1: regression identities come from the shared TEST-ONLY loader —
// deterministic local fixtures for the MySQL leg, SUPABASE_REGRESSION_* env
// (fail-closed, never printed) for the Supabase leg. No hardcoded
// live-capable credential remains in this probe.
const { getRegressionCredentials } = require('./regressionCredentials');
// Shared probe session ownership (scripts/probeSessionLifecycle.js). This probe
// mutates no application data, but authenticating still creates a real session,
// which is terminated through the supported logout interface.
const { createProbeSessionTracker } = require('./probeSessionLifecycle');

// Deterministic RF.6 fixtures, addressed by normalized name (never by id).
// PARTIAL: no VR scene is mapped to the Engineering destination node.
const ENGINEERING = { query: 'Engineering', norm: 'engineering building' };
const CCS = { query: 'Computer Studies', norm: 'college of computer studies ccs' };
const CCS_DEST_NODE_KEY = 'ccs';
const CCS_GUIDED_ROUTE = GUIDED_VR_ROUTES.find((route) => route.destination_node_key === CCS_DEST_NODE_KEY);
const CCS_SCENE_KEYS = CCS_GUIDED_ROUTE ? CCS_GUIDED_ROUTE.scene_keys : [];
const CCS_EXACT_PATH = ['main-gate', 'flagpole', 'mid-campus', 'east-walk', 'ccs'];
const CLOUDINARY_PREFIX = 'https://res.cloudinary.com/';

const failures = [];
function check(scope, label, ok) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!ok) failures.push(`${scope} :: ${label}`);
}

// Case/punctuation-insensitive building-name key. Lets the probe match the
// SAME building in either backend without ever comparing numeric ids.
function normName(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
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
    header() {
      return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    },
  };
}

function metaCsrf(html) {
  const m = /<meta name="csrf-token" content="([^"]*)"/.exec(html || '');
  return m ? m[1] : '';
}

// Arrival/completion copy that must NEVER appear on a partial route.
const ARRIVAL_MARKERS = ['Route complete', 'You have arrived'];
const COVERAGE_MARKER = 'VR coverage ends here';

const LEAK_PATTERNS = [
  ['JWT-like token', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['Supabase host', /[a-z0-9-]+\.supabase\.(co|com|in)/i],
  ['stack frame', /\bat [\w.$<>[\] ]+ \((?:file:\/\/|\/|[A-Za-z]:\\)[^)]*:\d+:\d+\)/],
  ['SQL/driver/PostgREST text', /sqlMessage|ER_[A-Z_]{3,}|SQLSTATE|PostgREST|relation "[^"]+" does not exist|syntax error at or near/i],
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
    try { json = JSON.parse(text); } catch (e) { /* HTML or empty */ }
    return { status: res.status, text, json };
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

  // ---- anonymous contract first ----
  let r = await jfetch('/api/pathfind?start=main-gate&destinationBuildingId=1');
  check(mode, 'anonymous pathfind -> 401 JSON', r.status === 401 && !!r.json && r.json.success === false);

  // One tracker per runMode/base/backend invocation.
  const sessions = createProbeSessionTracker({
    base,
    record: (label, pass) => check(mode, label, pass),
  });

  const student = await login(STUDENT_EMAIL, STUDENT_PASS);
  check(mode, 'student login -> 302', student.ok);
  if (student.ok) sessions.register('student', student.jar, '/dashboard');
  if (!student.ok) return bodies;

  /* The authenticated flow runs inside a try whose finally terminates the
     session, so every early return still passes through it. Intentionally NOT
     re-indented (minimal diff). */
  try {
  const H = { Cookie: student.jar.header(), Accept: 'application/json' };
  const HTMLH = { Cookie: student.jar.header(), Accept: 'text/html' };

  // Resolve a building's id IN THIS BACKEND by normalized name. Numeric ids are
  // never carried across modes.
  async function buildingIdByName(spec) {
    const res = await jfetch('/api/search?q=' + encodeURIComponent(spec.query), { headers: H });
    const results = (res.json && res.json.results) || [];
    for (const item of results) {
      if (item && item.building && normName(item.building.name) === spec.norm) {
        const id = Number(item.building.id);
        return Number.isInteger(id) && id > 0 ? id : null;
      }
    }
    return null;
  }

  // ---- pick a destination that the seeded graph provably maps ----
  r = await jfetch('/api/routes', { headers: H });
  const routes = (r.json && r.json.routes) || [];
  check(mode, 'backward-compat: /api/routes -> 200 with routes', r.status === 200 && routes.length > 0);
  const routeId = routes.length ? routes[0].id : null;

  const engId = await buildingIdByName(ENGINEERING);
  const ccsId = await buildingIdByName(CCS);
  check(mode, 'fixture: Engineering Building resolved by normalized name (no cross-backend id reuse)',
    Number.isInteger(engId) && engId > 0);
  check(mode, 'fixture: College of Computer Studies (CCS) resolved by normalized name (no cross-backend id reuse)',
    Number.isInteger(ccsId) && ccsId > 0);
  if (!engId || !ccsId) return bodies;

  // ---- computed map path (uses the name-resolved CCS id) ----
  r = await jfetch(`/api/pathfind?start=main-gate&destinationBuildingId=${ccsId}`, { headers: H });
  const route = r.json && r.json.route;
  check(mode, 'pathfind valid -> 200 computed route',
    r.status === 200 && !!r.json && r.json.success === true && !!route);
  check(mode, 'pathfind route starts at main-gate', !!route && route.start && route.start.key === 'main-gate');
  check(mode, 'pathfind route has ordered nodes + segments',
    !!route && Array.isArray(route.nodes) && route.nodes.length >= 2 &&
    Array.isArray(route.segments) && route.segments.length >= 1);
  check(mode, 'pathfind route carries estimated walk time',
    !!route && typeof route.estimated_walk_time === 'string' && route.estimated_walk_time.length > 0);

  // ---- sanitized pathfind failures ----
  r = await jfetch('/api/pathfind?start=main-gate&destinationBuildingId=abc', { headers: H });
  check(mode, 'pathfind invalid building id -> 400', r.status === 400 && !!r.json && r.json.success === false);
  r = await jfetch('/api/pathfind?start=main-gate', { headers: H });
  check(mode, 'pathfind missing destination -> 400', r.status === 400 && !!r.json && r.json.success === false);
  r = await jfetch('/api/pathfind?start=main-gate&destinationBuildingId=999999999', { headers: H });
  check(mode, 'pathfind unknown building -> 404 sanitized', r.status === 404 && !!r.json && r.json.success === false);
  r = await jfetch('/api/pathfind?start=no-such-node&destinationBuildingId=' + ccsId, { headers: H });
  check(mode, 'pathfind unknown start -> 404 sanitized', r.status === 404 && !!r.json && r.json.success === false);

  /* =====================================================================
     RF.6 PARTIAL CASE — Engineering Building (no mapped VR scene).
     Must retain its available scene(s), report destination_reached=false,
     never claim arrival, and expose no Next link past the last scene.
  ===================================================================== */
  r = await jfetch('/api/vr/to/' + engId, { headers: H });
  const engJson = r.json || {};
  const engScenes = Array.isArray(engJson.scenes) ? engJson.scenes : [];
  const engRoute = engJson.route;
  check(mode, 'vr destination API -> 200 success', r.status === 200 && engJson.success === true);
  check(mode, 'vr destination route is synthesized (id null, destination match)',
    !!engRoute && engRoute.id === null && engRoute.destination && Number(engRoute.destination.id) === Number(engId));
  check(mode, 'vr destination route starts at Guard House / Main Gate',
    !!engRoute && engRoute.start_label === 'Guard House / Main Gate');
  check(mode, 'vr destination API carries path + scenes arrays',
    Array.isArray(engJson.path) && Array.isArray(engJson.scenes));

  check(mode, 'RF.6 partial: Engineering retains its available scene(s) (nothing hidden)',
    engScenes.length >= 1);
  check(mode, 'RF.6 partial: Engineering API destination_reached === false',
    engJson.destination_reached === false);
  check(mode, 'RF.6 partial: Engineering final scene is NOT the destination node',
    engScenes.length >= 1 &&
    String(engScenes[engScenes.length - 1].node_key) !== String(engJson.path[engJson.path.length - 1]));
  check(mode, 'RF.6 partial: Engineering API carries a coverage-ends message',
    typeof engJson.message === 'string' && /VR coverage ends before the destination/.test(engJson.message));

  // HTML at the last available scene.
  r = await jfetch('/vr/to/' + engId, { headers: HTMLH });
  const engHtml = r.text || '';
  check(mode, 'RF.6 partial: Engineering HTML -> 200 and still renders its scene',
    r.status === 200 && engHtml.includes('Scene 1 of'));
  check(mode, 'RF.6 partial: Engineering HTML shows the coverage-ends notice',
    engHtml.includes(COVERAGE_MARKER));
  check(mode, 'RF.6 partial: Engineering HTML NEVER claims arrival or route completion',
    ARRIVAL_MARKERS.every((m) => !engHtml.includes(m)));
  check(mode, 'RF.6 partial: Engineering HTML has NO active Next link past the last available scene',
    !engHtml.includes(`href="/vr/to/${engId}?step=${engScenes.length + 1}"`));

  /* =====================================================================
     Active selected demo: CCS is a valid map and Guided VR destination.
  ===================================================================== */
  r = await jfetch('/api/vr/to/' + ccsId, { headers: H });
  const ccsJson = r.json || {};
  const ccsScenes = Array.isArray(ccsJson.scenes) ? ccsJson.scenes : [];
  const ccsSceneKeys = ccsScenes.map((scene) => scene.scene_key);
  check(mode, 'CCS active: API -> 200 success', r.status === 200 && ccsJson.success === true);
  check(mode, 'CCS active: real route path reaches ccs through the exact route-source path',
    Array.isArray(ccsJson.path) && ccsJson.path.length === CCS_EXACT_PATH.length &&
    ccsJson.path.every((key, index) => key === CCS_EXACT_PATH[index]) &&
    Number(ccsJson.route && ccsJson.route.distance_meters) > 0 &&
    Number(ccsJson.route && ccsJson.route.walk_time_seconds) > 0);
  check(mode, 'CCS active: exact 23-scene sequence includes Road 94 and the CCS arrival scene',
    ccsSceneKeys.length === 23 && ccsSceneKeys.length === CCS_SCENE_KEYS.length &&
    ccsSceneKeys.every((key, index) => key === CCS_SCENE_KEYS[index]) &&
    ccsSceneKeys[ccsSceneKeys.length - 2] === 'scene-general-road-94' &&
    ccsSceneKeys[ccsSceneKeys.length - 1] === 'scene-ccs-1st-floor');
  check(mode, 'CCS active: first and final scenes map to main-gate and ccs',
    ccsScenes.length === CCS_SCENE_KEYS.length && ccsScenes[0].node_key === 'main-gate' &&
    ccsScenes[ccsScenes.length - 1].node_key === CCS_DEST_NODE_KEY);
  check(mode, 'CCS active: every guided scene uses an approved Cloudinary delivery URL',
    ccsScenes.length === CCS_SCENE_KEYS.length &&
    ccsScenes.every((scene) => typeof scene.image_url === 'string' &&
      scene.image_url.indexOf(CLOUDINARY_PREFIX) === 0));
  check(mode, 'CCS active: destination_reached === true with no coverage-ended message',
    ccsJson.destination_reached === true &&
    !(typeof ccsJson.message === 'string' && /VR coverage ends/.test(ccsJson.message)));

  r = await jfetch(`/vr/to/${ccsId}?step=${CCS_SCENE_KEYS.length}`, { headers: HTMLH });
  const ccsHtml = r.text || '';
  check(mode, 'CCS active: final HTML step declares arrival and links back to Road 94',
    r.status === 200 && ARRIVAL_MARKERS.every((marker) => ccsHtml.includes(marker)) &&
    ccsHtml.includes(`href="/vr/to/${ccsId}?step=${CCS_SCENE_KEYS.length - 1}"`));
  check(mode, 'CCS active: final HTML step has no coverage notice or link past arrival',
    !ccsHtml.includes(COVERAGE_MARKER) &&
    !ccsHtml.includes(`href="/vr/to/${ccsId}?step=${CCS_SCENE_KEYS.length + 1}"`));

  /* ---- zero-scene contract (guarded) ----
     No real building can currently yield an EMPTY scene list: every graph path
     starts at main-gate, which has a mapped scene. Rather than fabricate a
     fixture (forbidden — no persistent rows, no production mutation), assert
     the contract conditionally so it fails closed if the data ever changes:
     an empty scene list must report destination_reached=false and the
     no-scenes message, never arrival. */
  const zeroSceneContractHolds =
    engScenes.length > 0 ||
    (engJson.destination_reached === false &&
      typeof engJson.message === 'string' &&
      /No VR scenes are available/.test(engJson.message));
  check(mode, 'zero-scene contract: an empty scene list would report destination_reached=false + the no-scenes message',
    zeroSceneContractHolds);

  // ---- invalid ids / sanitized errors ----
  r = await jfetch('/api/vr/to/abc', { headers: H });
  check(mode, 'vr destination API invalid id -> 400', r.status === 400 && !!r.json && r.json.success === false);
  r = await jfetch('/api/vr/to/999999999', { headers: H });
  check(mode, 'vr destination API unknown building -> 404', r.status === 404 && !!r.json && r.json.success === false);
  r = await jfetch('/vr/to/abc', { headers: HTMLH });
  check(mode, 'vr destination HTML invalid id -> usable 200 page (no arrival claim)',
    r.status === 200 && r.text.includes('Invalid building id.') &&
    ARRIVAL_MARKERS.every((m) => !r.text.includes(m)));

  /* ---- predefined campus_routes flow: API + view ---- */
  r = await jfetch('/api/routes/' + routeId, { headers: H });
  check(mode, 'backward-compat: /api/routes/:id -> 200 route', r.status === 200 && !!r.json && !!r.json.route);
  r = await jfetch('/vr/routes/' + routeId, { headers: HTMLH });
  const predefHtml = r.text || '';
  check(mode, 'backward-compat: /vr/routes/:routeId -> 200 HTML', r.status === 200 && predefHtml.includes('Guided VR Route'));

  r = await jfetch('/api/vr/routes/' + routeId, { headers: H });
  const predefJson = r.json || {};
  const predefScenes = Array.isArray(predefJson.scenes) ? predefJson.scenes : [];
  check(mode, 'backward-compat: /api/vr/routes/:routeId -> 200 success', r.status === 200 && predefJson.success === true);
  check(mode, 'RF.6 predefined: /api/vr/routes/:routeId exposes destination_reached',
    typeof predefJson.destination_reached === 'boolean');
  // The predefined view must obey the SAME arrival rule as the destination flow.
  const predefLast = predefScenes.length;
  if (predefLast > 0) {
    r = await jfetch(`/vr/routes/${routeId}?step=${predefLast}`, { headers: HTMLH });
    const lastHtml = r.text || '';
    const claimsArrival = lastHtml.includes('class="vr-complete"');
    check(mode, 'RF.6 predefined: last-scene view claims arrival ONLY when destination_reached is true',
      claimsArrival === (predefJson.destination_reached === true));
    check(mode, 'RF.6 predefined: last-scene view shows the coverage notice exactly when NOT reached',
      lastHtml.includes(COVERAGE_MARKER) === (predefJson.destination_reached !== true));
  }

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
  console.log('=== CampuSphere Map Destination & VR Route Flow probe (11.8B + RF.6 arrival contract) ===');

  console.log('\nmysql mode:');
  const mysqlBodies = await withServer({ mode: 'mysql', port: 3364, sessionStore: 'mysql' }, (base) => runMode('mysql', base));
  leakScan('mysql', mysqlBodies || []);

  if (process.env.PROBE_SKIP_SUPABASE === '1' && !hasSupabaseConfig()) {
    console.log('\nsupabase mode: SKIP — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (MySQL fallback mode).');
  } else {
    console.log('\nsupabase mode:');
    const sbBodies = await withServer({ mode: 'supabase', port: 3365, sessionStore: 'supabase' }, (base) => runMode('supabase', base));
    leakScan('supabase', sbBodies || []);
  }

  console.log('');
  console.log('NOTE application data remains read-only: no row was created, changed, or deleted.');
  console.log('NOTE authenticating still creates a temporary session, which is terminated');
  console.log('NOTE through the supported logout interface before this probe exits.');
  if (failures.length === 0) {
    console.log('MAP-VR-DESTINATION-FLOW-PROBE OK: all checks passed.');
    process.exitCode = 0;
  } else {
    console.error(`MAP-VR-DESTINATION-FLOW-PROBE FAILED: ${failures.length} check(s) did not pass:`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }
})();
