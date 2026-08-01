'use strict';

/* ========================================
   CampuSphere - active selected-demo guided VR probe (BE.4 acceptance)

   Boots through scripts/with-server.js (never a foreground server) and asserts
   the COMPLETED BE.4 Guard House -> College of Arts and Sciences guided VR state
   in FOUR source configurations:

     1. ROUTE=supabase + VR=supabase
     2. ROUTE=mysql    + VR=mysql
     3. ROUTE=mysql    + VR=supabase (mixed, via sourceOverrides)
     4. ROUTE=supabase + VR=mysql    (mixed, via sourceOverrides)

   Every configuration expects the SAME finished acceptance target:
     - exact route-source path main-gate -> flagpole -> mid-campus -> east-walk -> cas;
     - the exact configured 24-scene sequence, scene-guard-house first and
       scene-cas-1st-floor last;
     - an approved https://res.cloudinary.com delivery URL for every guided scene;
     - destination_reached === true only at the final scene, no coverage message;
     - step 24 exposes the Road 39 Previous link AND the CAS interior explore link;
     - the CAS 101 / room / First Floor schedule hotspot in BOTH VR backends;
     - CCS uses the exact configured 23-scene route through Road 94 and reaches
       scene-ccs-1st-floor truthfully only on the final step;
     - natural-key source separation (route-source CAS/CCS ids resolved per mode
       by normalized name; never reused across backends) and sanitized output.

   This is the acceptance target, NOT the current live state. Until BOTH the
   Supabase route-graph repair and the selected CAS VR MySQL parity sync are
   separately authorized and applied, this probe FAILS HONESTLY wherever the
   live route graph (supabase-route shortcut) or MySQL VR parity (missing
   scenes/links/schedule hotspot) is still incomplete. It is never weakened to
   obtain a green run.

   READ-ONLY: creates no rows and mutates nothing. Prints fixed PASS/FAIL labels
   only — never raw rows, cookies, secrets, request bodies, DB errors, or stacks.

   Run:   node scripts/guidedCasVr-probe.js
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
// Shared probe session ownership (scripts/probeSessionLifecycle.js): every
// canonical identity authenticated here is terminated through the real logout
// interface so `npm test` leaves no persisted regression session behind.
const { createProbeSessionTracker } = require('./probeSessionLifecycle');

const CAS = GUIDED_VR_ROUTES.find((d) => d.destination_node_key === 'cas');
const CCS = GUIDED_VR_ROUTES.find((d) => d.destination_node_key === 'ccs');
const CAS_NORM = 'college of arts and sciences';
const CCS_NORM = 'college of computer studies ccs';
const SEQ = CAS ? CAS.scene_keys : [];
const CCS_SEQ = CCS ? CCS.scene_keys : [];
const CAS_EXACT_PATH = ['main-gate', 'flagpole', 'mid-campus', 'east-walk', 'cas'];
const CCS_EXACT_PATH = ['main-gate', 'flagpole', 'mid-campus', 'east-walk', 'ccs'];
const CLOUDINARY_PREFIX = 'https://res.cloudinary.com/';

const ARRIVAL_MARKERS = ['Route complete', 'You have arrived'];
const COVERAGE_MARKER = 'VR coverage ends';

const failures = [];
function check(scope, label, ok) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!ok) failures.push(`${scope} :: ${label}`);
}

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

const LEAK_PATTERNS = [
  ['JWT-like token', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['Supabase host', /[a-z0-9-]+\.supabase\.(co|com|in)/i],
  ['stack frame', /\bat [\w.$<>[\] ]+ \((?:file:\/\/|\/|[A-Za-z]:\\)[^)]*:\d+:\d+\)/],
  ['SQL/driver/PostgREST text', /sqlMessage|SQLSTATE|PostgREST|relation "[^"]+" does not exist|syntax error at or near/i],
  ['MySQL driver error code', /\bER_[A-Z_]{3,}\b/],
  ['session cookie value', /campusphere\.sid=/],
  ['Supabase/Cloudinary credential name', /SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|CLOUDINARY_API_KEY|CLOUDINARY_API_SECRET/],
  ['cloudinary_public_id leak', /cloudinary_public_id/i],
];

// Every configuration asserts the SAME active selected-demo acceptance target.
async function runMode(scope, base, authSource) {
  // M12.P1-R1: the mixed combos override only VR_DATA_SOURCE, so the withServer
  // BASE mode (passed explicitly as authSource) is this leg's AUTH_DATA_SOURCE.
  const creds = getRegressionCredentials(authSource);
  const STUDENT_EMAIL = creds.student.email;
  const STUDENT_PASS = creds.student.password;
  const bodies = [];

  async function jfetch(url, options) {
    const res = await fetch(base + url, options);
    const text = await res.text();
    bodies.push(text);
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* HTML */ }
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

  // ---- anonymous contract ----
  let r = await jfetch('/api/vr/to/1', { headers: { Accept: 'application/json' } });
  check(scope, 'anonymous /api/vr/to -> 401 JSON', r.status === 401 && !!r.json && r.json.success === false);

  const sessions = createProbeSessionTracker({
    base,
    record: (label, pass) => check(scope, label, pass),
  });

  const student = await login(STUDENT_EMAIL, STUDENT_PASS);
  check(scope, 'student login -> 302', student.ok);
  if (student.ok) sessions.register('student', student.jar, '/dashboard');
  if (!student.ok) return bodies;

  /* Everything below runs inside a try whose finally terminates the session,
     so any early return still passes through cleanup. Intentionally NOT
     re-indented (minimal diff). */
  try {
  const H = { Cookie: student.jar.header(), Accept: 'application/json' };
  const HTMLH = { Cookie: student.jar.header(), Accept: 'text/html' };

  // ---- route-source CAS id resolved BY NORMALIZED NAME in this mode ----
  r = await jfetch('/api/search?q=' + encodeURIComponent('Arts and Sciences'), { headers: H });
  let casRouteId = null;
  for (const item of (r.json && r.json.results) || []) {
    if (item && item.building && normName(item.building.name) === CAS_NORM) {
      const rd = Number(item.building.route_destination_id);
      if (Number.isInteger(rd) && rd > 0) casRouteId = rd;
      break;
    }
  }
  check(scope, 'route-source CAS id resolved by normalized name (never reused across modes)',
    Number.isInteger(casRouteId) && casRouteId > 0);
  if (!casRouteId) return bodies;

  r = await jfetch('/api/search?q=' + encodeURIComponent('Computer Studies'), { headers: H });
  let ccsRouteId = null;
  for (const item of (r.json && r.json.results) || []) {
    if (item && item.building && normName(item.building.name) === CCS_NORM) {
      const rd = Number(item.building.route_destination_id);
      if (Number.isInteger(rd) && rd > 0) ccsRouteId = rd;
      break;
    }
  }
  check(scope, 'route-source CCS id resolved by normalized name (never reused across modes)',
    Number.isInteger(ccsRouteId) && ccsRouteId > 0);
  if (!ccsRouteId) return bodies;

  // ---- guided CAS destination API: the completed acceptance target ----
  r = await jfetch('/api/vr/to/' + casRouteId, { headers: H });
  const j = r.json || {};
  const scenes = Array.isArray(j.scenes) ? j.scenes : [];
  const sceneKeys = scenes.map((s) => s.scene_key);

  check(scope, 'CAS /api/vr/to -> 200 success', r.status === 200 && j.success === true);
  check(scope, 'CAS route synthesized from the route source (id null, start label)',
    !!j.route && j.route.id === null && j.route.start_label === 'Guard House / Main Gate');
  check(scope, 'exact road-following path main-gate -> flagpole -> mid-campus -> east-walk -> cas',
    Array.isArray(j.path) && j.path.length === CAS_EXACT_PATH.length &&
    j.path.every((k, i) => k === CAS_EXACT_PATH[i]) &&
    Number(j.route.distance_meters) > 0 && Number(j.route.walk_time_seconds) > 0);
  check(scope, 'exact configured 24-scene sequence (guard-house first, cas last)',
    sceneKeys.length === SEQ.length && sceneKeys.every((k, i) => k === SEQ[i]) &&
    sceneKeys[0] === 'scene-guard-house' && sceneKeys[sceneKeys.length - 1] === 'scene-cas-1st-floor');
  check(scope, 'first scene node_key main-gate; final scene node_key cas',
    scenes.length === SEQ.length && scenes[0].node_key === 'main-gate' &&
    scenes[scenes.length - 1].node_key === 'cas');
  check(scope, 'every guided scene has an approved Cloudinary delivery URL',
    scenes.length === SEQ.length &&
    scenes.every((s) => typeof s.image_url === 'string' && s.image_url.indexOf(CLOUDINARY_PREFIX) === 0));
  check(scope, 'destination_reached === true', j.destination_reached === true);
  check(scope, 'no coverage-ended message for CAS',
    !(typeof j.message === 'string' && /VR coverage ends/.test(j.message)));

  // ---- final step (24): arrival + Road 39 Previous link + interior explore ----
  r = await jfetch(`/vr/to/${casRouteId}?step=${SEQ.length}`, { headers: HTMLH });
  const lastHtml = r.text || '';
  check(scope, 'step 24 HTML declares arrival',
    r.status === 200 && ARRIVAL_MARKERS.every((m) => lastHtml.includes(m)));
  check(scope, 'step 24 shows no coverage notice', !lastHtml.includes(COVERAGE_MARKER));
  check(scope, 'step 24 exposes the Road 39 Previous link (guided step 23)',
    lastHtml.includes(`href="/vr/to/${casRouteId}?step=${SEQ.length - 1}"`));
  check(scope, 'step 24 exposes the CAS interior exploration link to scene-cas-1st-floor-2',
    lastHtml.includes('href="/vr/scene-cas-1st-floor-2"'));
  check(scope, 'step 24 has no Next link past the sequence',
    !lastHtml.includes(`href="/vr/to/${casRouteId}?step=${SEQ.length + 1}"`));

  // ---- earlier step (23): no arrival, working Next, no interior link ----
  r = await jfetch(`/vr/to/${casRouteId}?step=${SEQ.length - 1}`, { headers: HTMLH });
  const prevHtml = r.text || '';
  check(scope, 'step 23 shows NO arrival markers',
    r.status === 200 && ARRIVAL_MARKERS.every((m) => !prevHtml.includes(m)));
  check(scope, 'step 23 keeps a working Next link to step 24',
    prevHtml.includes(`href="/vr/to/${casRouteId}?step=${SEQ.length}"`));
  check(scope, 'step 23 exposes NO interior exploration link (final step only)',
    !prevHtml.includes('href="/vr/scene-cas-1st-floor-2"'));

  // ---- interior exploration + schedule hotspot required in BOTH VR backends ----
  r = await jfetch('/vr/scene-cas-1st-floor-2', { headers: HTMLH });
  check(scope, 'interior: /vr/scene-cas-1st-floor-2 -> 200 with link to -3',
    r.status === 200 && r.text.includes('href="/vr/scene-cas-1st-floor-3"'));
  r = await jfetch('/vr/scene-cas-1st-floor-3', { headers: HTMLH });
  check(scope, 'interior: /vr/scene-cas-1st-floor-3 -> 200 with link back to -2',
    r.status === 200 && r.text.includes('href="/vr/scene-cas-1st-floor-2"'));
  check(scope, 'CAS 101 / room / First Floor schedule hotspot present in this VR backend',
    r.text.includes('data-vr-schedule-hotspot') &&
    r.text.includes('data-schedule-location-label="CAS 101"') &&
    r.text.includes('data-schedule-location-type="room"') &&
    r.text.includes('data-schedule-floor-label="First Floor"'));

  // ---- guided CCS destination API: exact 23-scene active route ----
  r = await jfetch('/api/vr/to/' + ccsRouteId, { headers: H });
  const ccs = r.json || {};
  const ccsScenes = Array.isArray(ccs.scenes) ? ccs.scenes : [];
  const ccsSceneKeys = ccsScenes.map((scene) => scene.scene_key);
  check(scope, 'CCS /api/vr/to -> 200 success', r.status === 200 && ccs.success === true);
  check(scope, 'CCS keeps the exact route-source path and metrics',
    Array.isArray(ccs.path) && ccs.path.length === CCS_EXACT_PATH.length &&
    ccs.path.every((k, i) => k === CCS_EXACT_PATH[i]) &&
    Number(ccs.route && ccs.route.distance_meters) > 0 &&
    Number(ccs.route && ccs.route.walk_time_seconds) > 0);
  check(scope, 'CCS has the exact configured 23-scene sequence through Road 94',
    ccsSceneKeys.length === CCS_SEQ.length &&
    ccsSceneKeys.every((key, index) => key === CCS_SEQ[index]) &&
    ccsSceneKeys[0] === 'scene-guard-house' &&
    ccsSceneKeys[ccsSceneKeys.length - 2] === 'scene-general-road-94' &&
    ccsSceneKeys[ccsSceneKeys.length - 1] === 'scene-ccs-1st-floor');
  check(scope, 'CCS first scene maps to main-gate and final scene maps to ccs',
    ccsScenes.length === CCS_SEQ.length && ccsScenes[0].node_key === 'main-gate' &&
    ccsScenes[ccsScenes.length - 1].node_key === 'ccs');
  check(scope, 'every CCS guided scene has an approved Cloudinary delivery URL',
    ccsScenes.length === CCS_SEQ.length &&
    ccsScenes.every((scene) => typeof scene.image_url === 'string' &&
      scene.image_url.indexOf(CLOUDINARY_PREFIX) === 0));
  check(scope, 'CCS destination_reached === true with no coverage-ended message',
    ccs.destination_reached === true &&
    !(typeof ccs.message === 'string' && /VR coverage ends/.test(ccs.message)));

  r = await jfetch(`/vr/to/${ccsRouteId}?step=${CCS_SEQ.length}`, { headers: HTMLH });
  const ccsLastHtml = r.text || '';
  check(scope, 'CCS final step declares arrival with Road 94 Previous navigation',
    r.status === 200 && ARRIVAL_MARKERS.every((marker) => ccsLastHtml.includes(marker)) &&
    ccsLastHtml.includes(`href="/vr/to/${ccsRouteId}?step=${CCS_SEQ.length - 1}"`));
  check(scope, 'CCS final step has no coverage notice or Next link past arrival',
    !ccsLastHtml.includes(COVERAGE_MARKER) &&
    !ccsLastHtml.includes(`href="/vr/to/${ccsRouteId}?step=${CCS_SEQ.length + 1}"`));

  r = await jfetch(`/vr/to/${ccsRouteId}?step=${CCS_SEQ.length - 1}`, { headers: HTMLH });
  const ccsRoad94Html = r.text || '';
  check(scope, 'CCS Road 94 step is not arrival and links forward to the CCS scene',
    r.status === 200 && ARRIVAL_MARKERS.every((marker) => !ccsRoad94Html.includes(marker)) &&
    ccsRoad94Html.includes(`href="/vr/to/${ccsRouteId}?step=${CCS_SEQ.length}"`));

  } finally {
    await sessions.terminateAll();
  }

  return bodies;
}

function leakScan(scope, bodies) {
  const blob = bodies.join('\n');
  for (const [label, re] of LEAK_PATTERNS) {
    check(scope, `leak scan: no ${label}`, !re.test(blob));
  }
}

(async () => {
  console.log('=== CampuSphere active selected-demo guided VR probe (BE.4 acceptance) ===');
  if (!CAS || SEQ.length !== 24 || !CCS || CCS_SEQ.length !== 23) {
    console.error('GUIDED-CAS-VR-PROBE FAILED: guided catalog does not define the 24-scene CAS and 23-scene CCS sequences.');
    process.exitCode = 1;
    return;
  }

  const skipSupabase = process.env.PROBE_SKIP_SUPABASE === '1' && !hasSupabaseConfig();

  console.log('\nROUTE=mysql + VR=mysql:');
  const b2 = await withServer({ mode: 'mysql', port: 3372, sessionStore: 'mysql' }, (base) => runMode('mysql/mysql', base, 'mysql'));
  leakScan('mysql/mysql', b2 || []);

  if (skipSupabase) {
    console.log('\nsupabase configurations: SKIP — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (MySQL fallback mode).');
  } else {
    console.log('\nROUTE=supabase + VR=supabase:');
    const b1 = await withServer({ mode: 'supabase', port: 3373, sessionStore: 'supabase' }, (base) => runMode('supabase/supabase', base, 'supabase'));
    leakScan('supabase/supabase', b1 || []);

    console.log('\nROUTE=mysql + VR=supabase (mixed):');
    const b3 = await withServer(
      // Mixed leg: only VR_DATA_SOURCE diverges, so the session store follows
      // this probe's base/auth mode (mysql), not the overridden VR source.
      { mode: 'mysql', port: 3374, sessionStore: 'mysql', sourceOverrides: { VR_DATA_SOURCE: 'supabase' } },
      (base) => runMode('mysql-route/supabase-vr', base, 'mysql')
    );
    leakScan('mysql-route/supabase-vr', b3 || []);

    console.log('\nROUTE=supabase + VR=mysql (mixed):');
    const b4 = await withServer(
      // Mixed leg: session store follows the base/auth mode (supabase).
      { mode: 'supabase', port: 3375, sessionStore: 'supabase', sourceOverrides: { VR_DATA_SOURCE: 'mysql' } },
      (base) => runMode('supabase-route/mysql-vr', base, 'supabase')
    );
    leakScan('supabase-route/mysql-vr', b4 || []);
  }

  console.log('');
  console.log('NOTE read-only probe: no rows were created or mutated, so no cleanup is required.');
  if (failures.length === 0) {
    console.log('GUIDED-CAS-VR-PROBE OK: active CAS and CCS guided contracts passed.');
    process.exitCode = 0;
  } else {
    console.error(`GUIDED-CAS-VR-PROBE FAILED: ${failures.length} check(s) did not pass (expected until both data applies are authorized):`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }
})();
