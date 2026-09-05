'use strict';

/*
 * Catalog-wide map-to-Guided-VR flow probe.
 *
 * Read-only apart from an owned regression login per mode. Verifies that a
 * building-id path request and the VR destination request both resolve every
 * active destination through its configured natural destination_node_key.
 */

require('dotenv').config();

const { withServer } = require('./with-server');
const { hasSupabaseConfig } = require('../config/supabase');
const { GUIDED_VR_ROUTES, DEFERRED_GUIDED_VR_DESTINATIONS } = require('../config/guidedVrRoutes');
const { getRegressionCredentials } = require('./regressionCredentials');
const { createProbeSessionTracker } = require('./probeSessionLifecycle');

const failures = [];
function check(scope, label, ok) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!ok) failures.push(`${scope} :: ${label}`);
}

function canonical(value) {
  return String(value == null ? '' : value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function cookieJar() {
  const cookies = new Map();
  return {
    apply(response) {
      let values = [];
      if (typeof response.headers.getSetCookie === 'function') values = response.headers.getSetCookie() || [];
      else {
        const value = response.headers.get('set-cookie');
        if (value) values = [value];
      }
      for (const value of values) {
        const pair = String(value).split(';')[0];
        const split = pair.indexOf('=');
        if (split > 0) cookies.set(pair.slice(0, split).trim(), pair.slice(split + 1).trim());
      }
    },
    header() { return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; '); }
  };
}

function csrfFrom(html) {
  const match = /<meta name="csrf-token" content="([^"]*)"/.exec(html || '');
  return match ? match[1] : '';
}

const LEAK_PATTERNS = [
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /[a-z0-9-]+\.supabase\.(co|com|in)/i,
  /\bER_[A-Z_]{3,}\b/,
  /campusphere\.sid=/,
  /SUPABASE_SERVICE_ROLE|CLOUDINARY_API_SECRET|cloudinary_public_id/i,
  /\bat [\w.$<>[\] ]+ \((?:file:\/\/|\/|[A-Za-z]:\\)[^)]*:\d+:\d+\)/
];

async function runMode(scope, base, authSource) {
  const credentials = getRegressionCredentials(authSource);
  const bodies = [];
  async function request(url, options) {
    const response = await fetch(base + url, options);
    const text = await response.text();
    bodies.push(text);
    let json = null;
    try { json = JSON.parse(text); } catch (_) { /* HTML */ }
    return { status: response.status, text, json };
  }

  let response = await request('/api/pathfind?start=main-gate&destinationBuildingId=1', {
    headers: { Accept: 'application/json' }
  });
  check(scope, 'anonymous pathfinding is denied with 401 JSON',
    response.status === 401 && response.json && response.json.success === false);
  response = await request('/api/vr/to/1', { headers: { Accept: 'application/json' } });
  check(scope, 'anonymous Guided VR is denied with 401 JSON',
    response.status === 401 && response.json && response.json.success === false);

  const jar = cookieJar();
  const preflight = await fetch(base + '/auth', { headers: { Accept: 'text/html' } });
  jar.apply(preflight);
  const csrf = csrfFrom(await preflight.text());
  const login = await fetch(base + '/login', {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.header() },
    body: `email=${encodeURIComponent(credentials.student.email)}` +
      `&password=${encodeURIComponent(credentials.student.password)}` +
      `&_csrf=${encodeURIComponent(csrf)}`
  });
  jar.apply(login);
  const loginOk = login.status === 302;
  check(scope, 'student login succeeds', loginOk);
  const sessions = createProbeSessionTracker({ base, record: (label, pass) => check(scope, label, pass) });
  if (loginOk) sessions.register('student', jar, '/dashboard');
  if (!loginOk) return bodies;

  try {
    const jsonHeaders = { Cookie: jar.header(), Accept: 'application/json' };
    const htmlHeaders = { Cookie: jar.header(), Accept: 'text/html' };
    response = await request('/api/buildings', { headers: jsonHeaders });
    const buildings = Array.isArray(response.json && response.json.buildings)
      ? response.json.buildings
      : [];
    check(scope, 'complete authenticated building catalog is available',
      response.status === 200 && response.json && response.json.success === true && buildings.length > 0);

    for (const route of GUIDED_VR_ROUTES) {
      const matches = buildings.filter((building) =>
        canonical(building.name) === canonical(route.destination_name));
      const buildingId = matches.length === 1 ? Number(matches[0].route_destination_id) : null;
      check(scope, `${route.destination_node_key}: one routable catalog building`,
        matches.length === 1 && Number.isInteger(buildingId) && buildingId > 0 &&
        matches[0].route_available === true);
      if (!Number.isInteger(buildingId) || buildingId < 1) continue;

      response = await request(
        `/api/pathfind?start=main-gate&destinationBuildingId=${buildingId}`,
        { headers: jsonHeaders }
      );
      const mapRoute = response.json && response.json.route;
      check(scope, `${route.destination_node_key}: building-id pathfind resolves configured natural endpoint`,
        response.status === 200 && response.json && response.json.success === true && mapRoute &&
        mapRoute.start && mapRoute.start.key === 'main-gate' &&
        mapRoute.destination && mapRoute.destination.key === route.destination_node_key &&
        Array.isArray(mapRoute.nodes) && mapRoute.nodes.length >= 2 &&
        mapRoute.nodes[0].key === 'main-gate' &&
        mapRoute.nodes[mapRoute.nodes.length - 1].key === route.destination_node_key &&
        Array.isArray(mapRoute.segments) && mapRoute.segments.length === mapRoute.nodes.length - 1 &&
        Array.isArray(mapRoute.geometry) && mapRoute.geometry.length >= 2);

      response = await request('/api/vr/to/' + buildingId, { headers: jsonHeaders });
      const vr = response.json || {};
      const keys = Array.isArray(vr.scenes) ? vr.scenes.map((scene) => scene.scene_key) : [];
      check(scope, `${route.destination_node_key}: map destination opens exact Guided VR catalog chain`,
        response.status === 200 && vr.success === true && vr.destination_reached === true &&
        Array.isArray(vr.path) && vr.path[0] === 'main-gate' &&
        vr.path[vr.path.length - 1] === route.destination_node_key &&
        keys.length === route.scene_keys.length && keys.every((key, index) => key === route.scene_keys[index]));
    }

    const exitBuilding = buildings.find((building) =>
      building.route_available === true && Number.isInteger(Number(building.route_destination_id)) &&
      Number(building.route_destination_id) > 0);
    if (exitBuilding) {
      const exitId = Number(exitBuilding.route_destination_id);
      response = await request(
        `/api/pathfind?direction=exit&startBuildingId=${exitId}`,
        { headers: jsonHeaders }
      );
      const exitRoute = response.json && response.json.route;
      const exitExpected = exitBuilding.exit_route_available === true;
      check(scope, 'explicit exit selector enforces decorated availability and Main Gate destination',
        response.status === 200 && response.json && response.json.success === true &&
        (exitExpected
          ? !!exitRoute && exitRoute.start && exitRoute.start.key && exitRoute.destination &&
            exitRoute.destination.key === 'main-gate' &&
            Array.isArray(exitRoute.geometry) && exitRoute.geometry.length >= 2
          : !exitRoute && typeof response.json.exit_route_unavailable_reason === 'string'));

      response = await request(
        `/api/pathfind?startBuildingId=${exitId}&destinationNodeKey=main-gate`,
        { headers: jsonHeaders }
      );
      check(scope, 'legacy building-start form is rejected without explicit exit direction',
        response.status === 400 && response.json && response.json.success === false);
      response = await request(
        `/api/pathfind?direction=exit&startBuildingId=${exitId}&destinationNodeKey=main-gate`,
        { headers: jsonHeaders }
      );
      check(scope, 'exit mode rejects a caller-supplied destination override',
        response.status === 400 && response.json && response.json.success === false);
    } else {
      check(scope, 'building start selector fixture is available', false);
    }

    response = await request('/api/pathfind?direction=sideways&start=main-gate&destinationNodeKey=main-gate', {
      headers: jsonHeaders
    });
    check(scope, 'unknown pathfind direction returns sanitized 400',
      response.status === 400 && response.json && response.json.success === false);

    response = await request('/api/pathfind?start=main-gate&destinationBuildingId=abc', { headers: jsonHeaders });
    check(scope, 'invalid pathfind building id returns sanitized 400',
      response.status === 400 && response.json && response.json.success === false);
    response = await request('/api/pathfind?start=main-gate', { headers: jsonHeaders });
    check(scope, 'missing pathfind destination returns sanitized 400',
      response.status === 400 && response.json && response.json.success === false);
    response = await request('/api/pathfind?start=missing&destinationNodeKey=acad-1', { headers: jsonHeaders });
    check(scope, 'unknown pathfind start returns sanitized 404',
      response.status === 404 && response.json && response.json.success === false);
    response = await request('/api/vr/to/abc', { headers: jsonHeaders });
    check(scope, 'invalid Guided VR building id returns sanitized 400',
      response.status === 400 && response.json && response.json.success === false);
    response = await request('/vr/to/abc', { headers: htmlHeaders });
    check(scope, 'invalid Guided VR HTML remains usable and never claims arrival',
      response.status === 200 && response.text.includes('Invalid building id.') &&
      !response.text.includes('You have arrived'));

    response = await request('/api/routes', { headers: jsonHeaders });
    const routes = Array.isArray(response.json && response.json.routes) ? response.json.routes : [];
    check(scope, 'predefined route API remains available (empty catalog is valid)',
      response.status === 200 && response.json && response.json.success === true &&
      Array.isArray(response.json.routes));
    if (routes.length > 0) {
      response = await request('/api/vr/routes/' + routes[0].id, { headers: jsonHeaders });
      check(scope, 'predefined Guided VR API remains backward compatible',
        response.status === 200 && response.json && response.json.success === true &&
        typeof response.json.destination_reached === 'boolean');
    }
  } finally {
    await sessions.terminateAll();
  }

  for (let index = 0; index < LEAK_PATTERNS.length; index += 1) {
    check(scope, `captured response leak pattern ${index + 1} absent`, !LEAK_PATTERNS[index].test(bodies.join('\n')));
  }
  return bodies;
}

(async () => {
  console.log('=== CampuSphere catalog-wide map-to-Guided-VR flow probe ===');
  if (GUIDED_VR_ROUTES.length !== 25 || DEFERRED_GUIDED_VR_DESTINATIONS.length !== 0) {
    throw new Error('catalog shape mismatch');
  }

  await withServer({ mode: 'mysql', port: 3331, sessionStore: 'mysql' },
    (base) => runMode('mysql', base, 'mysql'));

  if (hasSupabaseConfig()) {
    await withServer({ mode: 'supabase', port: 3332, sessionStore: 'supabase' },
      (base) => runMode('supabase', base, 'supabase'));
  } else if (process.env.PROBE_SKIP_SUPABASE !== '1') {
    check('supabase', 'Supabase configuration is present', false);
  }

  console.log('');
  if (failures.length === 0) {
    console.log('MAP-VR-DESTINATION-FLOW-PROBE OK: catalog-wide natural destination flow passed.');
  } else {
    console.error(`MAP-VR-DESTINATION-FLOW-PROBE FAILED: ${failures.length} check(s) did not pass:`);
    failures.forEach((failure) => console.error('  - ' + failure));
    process.exitCode = 1;
  }
})().catch(() => {
  console.error('MAP-VR-DESTINATION-FLOW-PROBE FAILED: sanitized runtime failure.');
  process.exitCode = 1;
});
