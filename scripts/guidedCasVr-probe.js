'use strict';

/*
 * Catalog-wide Guided VR runtime acceptance probe.
 *
 * The historical filename is retained to avoid needless registration churn.
 * The probe now iterates every GUIDED_VR_ROUTES entry in MySQL, Supabase, and
 * both supported mixed route/VR source combinations. It is read-only apart
 * from its owned login sessions, which are terminated through real logout in
 * finally blocks.
 */

require('dotenv').config();

const { withServer } = require('./with-server');
const { hasSupabaseConfig } = require('../config/supabase');
const { GUIDED_VR_ROUTES, DEFERRED_GUIDED_VR_DESTINATIONS } = require('../config/guidedVrRoutes');
const { getRegressionCredentials } = require('./regressionCredentials');
const { createProbeSessionTracker } = require('./probeSessionLifecycle');

const CLOUDINARY_PREFIX = 'https://res.cloudinary.com/';
const ARRIVAL_MARKERS = ['Route complete', 'You have arrived'];
const failures = [];

function check(scope, label, ok) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!ok) failures.push(`${scope} :: ${label}`);
}

function normName(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cookieJar() {
  const cookies = new Map();
  return {
    apply(response) {
      let list = [];
      if (typeof response.headers.getSetCookie === 'function') list = response.headers.getSetCookie() || [];
      else {
        const header = response.headers.get('set-cookie');
        if (header) list = [header];
      }
      for (const header of list) {
        const pair = String(header).split(';')[0];
        const split = pair.indexOf('=');
        if (split > 0) cookies.set(pair.slice(0, split).trim(), pair.slice(split + 1).trim());
      }
    },
    header() {
      return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
    }
  };
}

function metaCsrf(html) {
  const match = /<meta name="csrf-token" content="([^"]*)"/.exec(html || '');
  return match ? match[1] : '';
}

const LEAK_PATTERNS = [
  ['JWT-like token', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['Supabase host', /[a-z0-9-]+\.supabase\.(co|com|in)/i],
  ['stack frame', /\bat [\w.$<>[\] ]+ \((?:file:\/\/|\/|[A-Za-z]:\\)[^)]*:\d+:\d+\)/],
  ['SQL/driver/PostgREST text', /sqlMessage|SQLSTATE|PostgREST|relation "[^"]+" does not exist|syntax error at or near/i],
  ['MySQL driver error code', /\bER_[A-Z_]{3,}\b/],
  ['session cookie value', /campusphere\.sid=/],
  ['credential name', /SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|CLOUDINARY_API_KEY|CLOUDINARY_API_SECRET/],
  ['cloudinary_public_id leak', /cloudinary_public_id/i]
];

async function runMode(scope, base, authSource) {
  const credentials = getRegressionCredentials(authSource);
  const bodies = [];

  async function request(url, options) {
    const response = await fetch(base + url, options);
    const body = await response.text();
    bodies.push(body);
    let json = null;
    try { json = JSON.parse(body); } catch (_) { /* HTML */ }
    return { status: response.status, text: body, json };
  }

  async function login() {
    const jar = cookieJar();
    const preflight = await fetch(base + '/auth', { headers: { Accept: 'text/html' } });
    jar.apply(preflight);
    const csrf = metaCsrf(await preflight.text());
    const response = await fetch(base + '/login', {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.header() },
      body: `email=${encodeURIComponent(credentials.student.email)}` +
        `&password=${encodeURIComponent(credentials.student.password)}` +
        `&_csrf=${encodeURIComponent(csrf)}`
    });
    jar.apply(response);
    return { ok: response.status === 302, jar };
  }

  let response = await request('/api/vr/to/1', { headers: { Accept: 'application/json' } });
  check(scope, 'anonymous destination API is denied with 401 JSON',
    response.status === 401 && response.json && response.json.success === false);

  const sessions = createProbeSessionTracker({
    base,
    record: (label, pass) => check(scope, label, pass)
  });
  const student = await login();
  check(scope, 'student login succeeds', student.ok);
  if (student.ok) sessions.register('student', student.jar, '/dashboard');
  if (!student.ok) return bodies;

  try {
    const jsonHeaders = { Cookie: student.jar.header(), Accept: 'application/json' };
    const htmlHeaders = { Cookie: student.jar.header(), Accept: 'text/html' };

    response = await request('/api/buildings', { headers: jsonHeaders });
    const buildings = Array.isArray(response.json && response.json.buildings)
      ? response.json.buildings
      : [];
    check(scope, 'authenticated building catalog is available',
      response.status === 200 && response.json && response.json.success === true && buildings.length > 0);

    for (const route of GUIDED_VR_ROUTES) {
      const key = route.destination_node_key;
      const exact = buildings.filter((building) =>
        building && normName(building.name) === normName(route.destination_name));
      const ids = exact.map((building) => Number(building.route_destination_id))
        .filter((id) => Number.isInteger(id) && id > 0);
      check(scope, `${key}: exactly one canonical route-source building`,
        exact.length === 1 && ids.length === 1);
      if (ids.length !== 1) continue;

      const buildingId = ids[0];
      response = await request('/api/vr/to/' + buildingId, { headers: jsonHeaders });
      const payload = response.json || {};
      const scenes = Array.isArray(payload.scenes) ? payload.scenes : [];
      const sceneKeys = scenes.map((scene) => scene.scene_key);
      const path = Array.isArray(payload.path) ? payload.path : [];

      check(scope, `${key}: destination API succeeds`, response.status === 200 && payload.success === true);
      check(scope, `${key}: route path reaches the configured natural node`,
        path.length >= 2 && path[0] === 'main-gate' && path[path.length - 1] === key &&
        new Set(path).size === path.length && Number(payload.route && payload.route.distance_meters) > 0 &&
        Number(payload.route && payload.route.walk_time_seconds) > 0);
      check(scope, `${key}: exact configured scene order`,
        sceneKeys.length === route.scene_keys.length &&
        sceneKeys.every((sceneKey, index) => sceneKey === route.scene_keys[index]) &&
        new Set(sceneKeys).size === sceneKeys.length);
      check(scope, `${key}: stored start and arrival node mappings are exposed truthfully`,
        scenes.length === route.scene_keys.length && scenes[0].node_key === 'main-gate' &&
        scenes[scenes.length - 1].node_key === key);
      check(scope, `${key}: every scene has approved Cloudinary delivery URL`,
        scenes.length === route.scene_keys.length && scenes.every((scene) =>
          typeof scene.image_url === 'string' && scene.image_url.startsWith(CLOUDINARY_PREFIX)));
      check(scope, `${key}: arrival is true only after complete catalog coverage`,
        payload.destination_reached === true &&
        !(typeof payload.message === 'string' && payload.message.includes('VR coverage ends')));

      const finalStep = route.scene_keys.length;
      response = await request(`/vr/to/${buildingId}?step=${finalStep}`, { headers: htmlHeaders });
      const finalHtml = response.text || '';
      check(scope, `${key}: final HTML reports arrival and has bounded previous navigation`,
        response.status === 200 && ARRIVAL_MARKERS.every((marker) => finalHtml.includes(marker)) &&
        finalHtml.includes(`href="/vr/to/${buildingId}?step=${finalStep - 1}"`) &&
        !finalHtml.includes(`href="/vr/to/${buildingId}?step=${finalStep + 1}"`) &&
        !finalHtml.includes('VR coverage ends'));

      response = await request(`/vr/to/${buildingId}?step=${finalStep - 1}`, { headers: htmlHeaders });
      const priorHtml = response.text || '';
      check(scope, `${key}: penultimate HTML is not arrival and links to final step`,
        response.status === 200 && ARRIVAL_MARKERS.every((marker) => !priorHtml.includes(marker)) &&
        priorHtml.includes(`href="/vr/to/${buildingId}?step=${finalStep}"`));
    }
  } finally {
    await sessions.terminateAll();
  }

  return bodies;
}

function leakScan(scope, bodies) {
  const body = bodies.join('\n');
  for (const [label, pattern] of LEAK_PATTERNS) {
    check(scope, `leak scan: no ${label}`, !pattern.test(body));
  }
}

(async () => {
  console.log('=== CampuSphere catalog-wide Guided VR runtime probe ===');
  if (GUIDED_VR_ROUTES.length !== 25 || DEFERRED_GUIDED_VR_DESTINATIONS.length !== 0) {
    console.error('GUIDED-CATALOG-VR-PROBE FAILED: expected 25 active and zero deferred destinations.');
    process.exitCode = 1;
    return;
  }

  const skipSupabase = process.env.PROBE_SKIP_SUPABASE === '1' && !hasSupabaseConfig();

  console.log('\nROUTE=mysql + VR=mysql:');
  const mysqlBodies = await withServer(
    { mode: 'mysql', port: 3372, sessionStore: 'mysql' },
    (base) => runMode('mysql/mysql', base, 'mysql')
  );
  leakScan('mysql/mysql', mysqlBodies || []);

  if (skipSupabase) {
    console.log('\nSupabase configurations skipped by explicit fallback mode.');
  } else {
    console.log('\nROUTE=supabase + VR=supabase:');
    const supabaseBodies = await withServer(
      { mode: 'supabase', port: 3373, sessionStore: 'supabase' },
      (base) => runMode('supabase/supabase', base, 'supabase')
    );
    leakScan('supabase/supabase', supabaseBodies || []);

    console.log('\nROUTE=mysql + VR=supabase:');
    const mixedSupabaseBodies = await withServer(
      { mode: 'mysql', port: 3374, sessionStore: 'mysql', sourceOverrides: { VR_DATA_SOURCE: 'supabase' } },
      (base) => runMode('mysql-route/supabase-vr', base, 'mysql')
    );
    leakScan('mysql-route/supabase-vr', mixedSupabaseBodies || []);

    console.log('\nROUTE=supabase + VR=mysql:');
    const mixedMysqlBodies = await withServer(
      { mode: 'supabase', port: 3375, sessionStore: 'supabase', sourceOverrides: { VR_DATA_SOURCE: 'mysql' } },
      (base) => runMode('supabase-route/mysql-vr', base, 'supabase')
    );
    leakScan('supabase-route/mysql-vr', mixedMysqlBodies || []);
  }

  console.log('');
  if (failures.length === 0) {
    console.log('GUIDED-CATALOG-VR-PROBE OK: all active destinations passed in every supported source mode.');
  } else {
    console.error(`GUIDED-CATALOG-VR-PROBE FAILED: ${failures.length} check(s) did not pass:`);
    failures.forEach((failure) => console.error('  - ' + failure));
    process.exitCode = 1;
  }
})().catch(() => {
  console.error('GUIDED-CATALOG-VR-PROBE FAILED: runtime probe did not complete.');
  process.exitCode = 1;
});
