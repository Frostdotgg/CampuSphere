'use strict';

/*
 * Catalog-wide Guided VR runtime acceptance probe.
 *
 * The historical filename is retained to avoid needless registration churn.
 * The probe now iterates every GUIDED_VR_ROUTES entry in MySQL, Supabase, and
 * both supported mixed route/VR source combinations. It is read-only apart
 * from its owned login sessions, which are terminated through real logout in
 * finally blocks. Pass `--supabase-only` to omit deferred MySQL/mixed legs.
 */

require('dotenv').config();

const { withServer } = require('./with-server');
const { hasSupabaseConfig } = require('../config/supabase');
const {
  GUIDED_VR_ROUTES,
  WALKING_GUIDED_VR_ROUTES,
  DEFERRED_GUIDED_VR_DESTINATIONS
} = require('../config/guidedVrRoutes');
const { getRegressionCredentials } = require('./regressionCredentials');
const { createProbeSessionTracker } = require('./probeSessionLifecycle');

const SUPABASE_ONLY = process.argv.includes('--supabase-only');
const CLOUDINARY_PREFIX = 'https://res.cloudinary.com/';
const DRIVE_PROXY_RE = /^\/api\/media\/google-drive\/[A-Za-z0-9_-]{1,200}(?:\?resourcekey=[A-Za-z0-9_-]{1,200})?$/;
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

function isApprovedSceneMedia(value) {
  return typeof value === 'string' &&
    (value.startsWith(CLOUDINARY_PREFIX) || DRIVE_PROXY_RE.test(value));
}

function htmlStepHref(path, mode, step) {
  return `${path}?mode=${mode}&amp;step=${step}`;
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
      check(scope, `${key}: legacy API request selects Vehicle mode`, payload.travel_mode === 'vehicle');
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
      check(scope, `${key}: every scene has approved Cloudinary or Google Drive media URL`,
        scenes.length === route.scene_keys.length && scenes.every((scene) =>
          isApprovedSceneMedia(scene.image_url)));
      check(scope, `${key}: arrival is true only after complete catalog coverage`,
        payload.destination_reached === true &&
        !(typeof payload.message === 'string' && payload.message.includes('VR coverage ends')));

      const finalStep = route.scene_keys.length;
      response = await request(`/vr/to/${buildingId}?mode=vehicle&step=${finalStep}`, { headers: htmlHeaders });
      const finalHtml = response.text || '';
      check(scope, `${key}: final HTML reports arrival and has bounded previous navigation`,
        response.status === 200 && ARRIVAL_MARKERS.every((marker) => finalHtml.includes(marker)) &&
        finalHtml.includes(htmlStepHref(`/vr/to/${buildingId}`, 'vehicle', finalStep - 1)) &&
        !finalHtml.includes(htmlStepHref(`/vr/to/${buildingId}`, 'vehicle', finalStep + 1)) &&
        !finalHtml.includes('VR coverage ends'));

      response = await request(`/vr/to/${buildingId}?mode=vehicle&step=${finalStep - 1}`, { headers: htmlHeaders });
      const priorHtml = response.text || '';
      check(scope, `${key}: penultimate HTML is not arrival and links to final step`,
        response.status === 200 && ARRIVAL_MARKERS.every((marker) => !priorHtml.includes(marker)) &&
        priorHtml.includes(htmlStepHref(`/vr/to/${buildingId}`, 'vehicle', finalStep)));
    }

    const walkingDestinationNames = new Set(WALKING_GUIDED_VR_ROUTES.map((route) =>
      normName(route.destination_name)));
    for (const walkingRoute of WALKING_GUIDED_VR_ROUTES) {
      const walkingMatches = buildings.filter((building) =>
        normName(building && building.name) === normName(walkingRoute.destination_name));
      const walkingIds = walkingMatches
        .map((building) => Number(building.route_destination_id))
        .filter((id) => Number.isInteger(id) && id > 0);
      check(scope, `${walkingRoute.destination_node_key}: exactly one Walking route-source building`,
        walkingMatches.length === 1 && walkingIds.length === 1);
      if (walkingIds.length !== 1) continue;

      const walkingBuildingId = walkingIds[0];
      response = await request(`/api/vr/to/${walkingBuildingId}?mode=walking`, { headers: jsonHeaders });
      const walkingPayload = response.json || {};
      const walkingScenes = Array.isArray(walkingPayload.scenes) ? walkingPayload.scenes : [];
      const walkingKeys = walkingScenes.map((scene) => scene.scene_key);
      check(scope, `${walkingRoute.destination_node_key}: Walking API selects Walking mode and advertises both choices`,
        response.status === 200 && walkingPayload.success === true &&
        walkingPayload.travel_mode === 'walking' &&
        JSON.stringify(walkingPayload.available_travel_modes) === JSON.stringify(['vehicle', 'walking']));
      check(scope, `${walkingRoute.destination_node_key}: Walking API returns the exact configured scene chain`,
        walkingKeys.length === walkingRoute.scene_keys.length &&
        walkingKeys.every((key, index) => key === walkingRoute.scene_keys[index]) &&
        walkingPayload.destination_reached === true &&
        walkingScenes[0] && walkingScenes[0].node_key === 'main-gate' &&
        walkingScenes[walkingScenes.length - 1] &&
        walkingScenes[walkingScenes.length - 1].node_key === walkingRoute.destination_node_key);

      response = await request(`/vr/to/${walkingBuildingId}?mode=walking&step=1`, { headers: htmlHeaders });
      const walkingFirstHtml = response.text || '';
      check(scope, `${walkingRoute.destination_node_key}: first Walking HTML starts at the route start`,
        response.status === 200 && !ARRIVAL_MARKERS.some((marker) => walkingFirstHtml.includes(marker)) &&
        walkingFirstHtml.includes(htmlStepHref(`/vr/to/${walkingBuildingId}`, 'walking', 2)) &&
        !walkingFirstHtml.includes(htmlStepHref(`/vr/to/${walkingBuildingId}`, 'walking', 0)));

      const walkingFinalStep = walkingRoute.scene_keys.length;
      response = await request(`/vr/to/${walkingBuildingId}?mode=walking&step=${walkingFinalStep - 1}`, { headers: htmlHeaders });
      const walkingPriorHtml = response.text || '';
      check(scope, `${walkingRoute.destination_node_key}: penultimate Walking HTML links to arrival without claiming it`,
        response.status === 200 && !ARRIVAL_MARKERS.some((marker) => walkingPriorHtml.includes(marker)) &&
        walkingPriorHtml.includes(htmlStepHref(`/vr/to/${walkingBuildingId}`, 'walking', walkingFinalStep)));

      response = await request(`/vr/to/${walkingBuildingId}?mode=walking&step=${walkingFinalStep}`, { headers: htmlHeaders });
      const walkingFinalHtml = response.text || '';
      check(scope, `${walkingRoute.destination_node_key}: final Walking HTML preserves navigation and reports arrival`,
        response.status === 200 && ARRIVAL_MARKERS.every((marker) => walkingFinalHtml.includes(marker)) &&
        walkingFinalHtml.includes(htmlStepHref(`/vr/to/${walkingBuildingId}`, 'walking', walkingFinalStep - 1)) &&
        !walkingFinalHtml.includes(htmlStepHref(`/vr/to/${walkingBuildingId}`, 'walking', walkingFinalStep + 1)) &&
        !walkingFinalHtml.includes('VR coverage ends'));

      response = await request(`/vr/to/${walkingBuildingId}`, { headers: htmlHeaders });
      const chooserHtml = response.text || '';
      check(scope, `${walkingRoute.destination_node_key}: mode-less HTML renders the travel-mode chooser`,
        response.status === 200 && chooserHtml.includes('How are you traveling') &&
        chooserHtml.includes(`/vr/to/${walkingBuildingId}?mode=walking`) &&
        chooserHtml.includes(`/vr/to/${walkingBuildingId}?mode=vehicle`) &&
        !chooserHtml.includes('id="vrPano"'));
    }

    const invalidModeRoute = WALKING_GUIDED_VR_ROUTES[0];
    const invalidModeBuilding = buildings.find((building) =>
      normName(building && building.name) === normName(invalidModeRoute && invalidModeRoute.destination_name));
    const invalidModeBuildingId = invalidModeBuilding ? Number(invalidModeBuilding.route_destination_id) : null;
    if (Number.isInteger(invalidModeBuildingId) && invalidModeBuildingId > 0) {
      response = await request(`/api/vr/to/${invalidModeBuildingId}?mode=bicycle`, { headers: jsonHeaders });
      check(scope, 'unsupported API travel mode is rejected without route data',
        response.status === 400 && response.json && response.json.success === false &&
        response.json.code === 'invalid_travel_mode');
    }

    const vehicleOnlyRoute = GUIDED_VR_ROUTES.find((route) =>
      !walkingDestinationNames.has(normName(route.destination_name)));
    const vehicleOnlyBuilding = buildings.find((building) =>
      normName(building && building.name) === normName(vehicleOnlyRoute && vehicleOnlyRoute.destination_name));
    const vehicleOnlyBuildingId = vehicleOnlyBuilding ? Number(vehicleOnlyBuilding.route_destination_id) : null;
    if (vehicleOnlyRoute && Number.isInteger(vehicleOnlyBuildingId) && vehicleOnlyBuildingId > 0) {
      response = await request(`/vr/to/${vehicleOnlyBuildingId}`, { headers: htmlHeaders });
      const vehicleOnlyHtml = response.text || '';
      check(scope, 'vehicle-only destination keeps the direct Vehicle launch',
        response.status === 200 && vehicleOnlyHtml.includes('id="vrPano"') &&
        !vehicleOnlyHtml.includes('How are you traveling'));
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

  if (SUPABASE_ONLY && !hasSupabaseConfig()) {
    console.error('GUIDED-CATALOG-VR-PROBE FAILED: --supabase-only requires Supabase configuration.');
    process.exitCode = 1;
    return;
  }

  if (!SUPABASE_ONLY) {
    console.log('\nROUTE=mysql + VR=mysql:');
    const mysqlBodies = await withServer(
      { mode: 'mysql', port: 3372, sessionStore: 'mysql' },
      (base) => runMode('mysql/mysql', base, 'mysql')
    );
    leakScan('mysql/mysql', mysqlBodies || []);
  }

  if (skipSupabase && !SUPABASE_ONLY) {
    console.log('\nSupabase configurations skipped by explicit fallback mode.');
  } else {
    console.log('\nROUTE=supabase + VR=supabase:');
    const supabaseBodies = await withServer(
      { mode: 'supabase', port: 3373, sessionStore: 'supabase' },
      (base) => runMode('supabase/supabase', base, 'supabase')
    );
    leakScan('supabase/supabase', supabaseBodies || []);

    if (!SUPABASE_ONLY) {
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
  }

  console.log('');
  if (failures.length === 0) {
    console.log(SUPABASE_ONLY
      ? 'GUIDED-CATALOG-VR-PROBE OK: all active destinations passed in Supabase route/VR mode.'
      : 'GUIDED-CATALOG-VR-PROBE OK: all active destinations passed in every supported source mode.');
  } else {
    console.error(`GUIDED-CATALOG-VR-PROBE FAILED: ${failures.length} check(s) did not pass:`);
    failures.forEach((failure) => console.error('  - ' + failure));
    process.exitCode = 1;
  }
})().catch((error) => {
  const name = error && error.name ? String(error.name).replace(/[^A-Za-z0-9_$.-]/g, '') : 'Error';
  const message = error && error.message ? String(error.message)
    .replace(/(?:https?:\/\/)[^\s]+/gi, '[url]')
    .replace(/[A-Za-z]:\\[^\r\n]+/g, '[path]')
    .replace(/\b(?:SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|CLOUDINARY_API_KEY|CLOUDINARY_API_SECRET)\b[^\s]*/gi, '[redacted]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[token]')
    .slice(0, 240)
    : 'unknown failure';
  console.error(`GUIDED-CATALOG-VR-PROBE FAILED: runtime probe did not complete (${name}: ${message}).`);
  process.exitCode = 1;
});
