import http from 'k6/http';
import { browser } from 'k6/browser';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { LT08_PROFILE, classifyEnduranceWindow } from './lt-08-endurance-policy.js';

/*
 * LT-08 sustains the supported 50-client read workload. Forty-nine HTTP VUs
 * rotate through the authenticated map, catalog, search, route, and pathfind
 * reads while one Chromium canary checks the rendered map every minute. Four
 * temporary guest sessions distribute session-store touches. No write,
 * presence, offline, admin, or media-management request is sent to Production.
 */
const BASE_URL = String(__ENV.BASE_URL || '').replace(/\/+$/, '');
const EMAIL = String(__ENV.K6_TEST_EMAIL || '');
const PASSWORD = String(__ENV.K6_TEST_PASSWORD || '');
const PEAK_SCREENSHOT = String(__ENV.K6_PEAK_SCREENSHOT_PATH || '');
const FINAL_SCREENSHOT = String(__ENV.K6_FINAL_SCREENSHOT_PATH || '');
const EXPECTED_HOST = 'campusphere-cspc.vercel.app';
const SESSION_COOKIE_NAME = '__Host-campusphere.sid';
const SESSION_POOL_SIZE = LT08_PROFILE.sessionPoolSize;
const HTTP_PEAK_VUS = LT08_PROFILE.httpPeakVUs;
const CANARY_DURATION_MS = 13 * 60 * 1000;
const CANARY_INTERVAL_MS = LT08_PROFILE.canaryIntervalMs;
const CANARY_SETTLE_MS = 3000;
const HOLD_START_MS = LT08_PROFILE.holdStartMs;
const HOLD_END_MS = LT08_PROFILE.holdEndMs;
const SEARCH_TERMS = [
  'Academic',
  'Library',
  'Administration',
  'Gymnasium',
  'Freedom Park',
];

if (!/^https:\/\/[a-z0-9.-]+$/i.test(BASE_URL)) {
  throw new Error('BASE_URL must be an HTTPS origin.');
}
if (BASE_URL.replace(/^https:\/\//i, '').toLowerCase() !== EXPECTED_HOST) {
  throw new Error('LT-08 refuses a non-Production host.');
}
if (!EMAIL || !PASSWORD) throw new Error('K6_TEST_EMAIL and K6_TEST_PASSWORD are required.');

const journeySuccess = new Rate('lt08_journey_success');
const mapSuccess = new Rate('lt08_map_success');
const buildingsSuccess = new Rate('lt08_buildings_success');
const directorySuccess = new Rate('lt08_directory_success');
const searchSuccess = new Rate('lt08_search_success');
const routesSuccess = new Rate('lt08_routes_success');
const pathfindSuccess = new Rate('lt08_pathfind_success');
const healthSuccess = new Rate('lt08_health_success');
const browserSuccess = new Rate('lt08_browser_success');
const dynamicDuration = new Trend('lt08_dynamic_duration_ms');
const earlyDuration = new Trend('lt08_dynamic_duration_early_ms');
const middleDuration = new Trend('lt08_dynamic_duration_middle_ms');
const lateDuration = new Trend('lt08_dynamic_duration_late_ms');
const iterationDuration = new Trend('lt08_iteration_duration_ms');
const completedJourneys = new Counter('lt08_completed_journeys');
const browserCycles = new Counter('lt08_browser_cycles');
const server5xx = new Rate('lt08_http_5xx');
const rateLimited = new Rate('lt08_rate_limited');

// Diagnostics contain only fixed phase names and numeric statuses.
const diagnosticAuth = new Counter('lt08_diag_auth_responses');
const diagnosticRedirect = new Counter('lt08_diag_redirect_responses');
const diagnosticNetwork = new Counter('lt08_diag_network_errors');
const diagnosticClient = new Counter('lt08_diag_other_client_errors');
const diagnosticServer = new Counter('lt08_diag_server_errors');
const diagnosticOther = new Counter('lt08_diag_other_responses');
const setupCandidates = new Counter('lt08_setup_route_candidates');
const setupSelected = new Counter('lt08_setup_route_selected');
const setupInvalid = new Counter('lt08_setup_invalid_responses');
const browserDiagnosticAuth = new Counter('lt08_diag_browser_auth');
const browserDiagnosticRedirect = new Counter('lt08_diag_browser_redirect');
const browserDiagnosticNetwork = new Counter('lt08_diag_browser_network');
const browserDiagnosticClient = new Counter('lt08_diag_browser_client_status');
const browserDiagnosticServer = new Counter('lt08_diag_browser_server_status');
const browserDiagnosticOther = new Counter('lt08_diag_browser_other_status');
const browserDiagnosticRender = new Counter('lt08_diag_browser_render');
const browserDiagnosticUnexpected = new Counter('lt08_diag_browser_unexpected');
const browserNavigationResponse = new Counter('lt08_diag_browser_navigation_response');
const browserNavigationNull = new Counter('lt08_diag_browser_navigation_null');
const browserNavigationNullRecovered = new Counter('lt08_diag_browser_navigation_null_recovered');
const browserNavigationThrow = new Counter('lt08_diag_browser_navigation_throw');

export const options = {
  systemTags: ['status', 'method', 'name', 'proto', 'scenario', 'expected_response'],
  setupTimeout: '3m',
  scenarios: {
    http_endurance: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: LT08_PROFILE.rampStages.map((stage) => ({ ...stage })),
      gracefulRampDown: '30s',
      gracefulStop: '30s',
      exec: 'httpEndurance',
    },
    browser_canary: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '14m',
      gracefulStop: '30s',
      options: { browser: { type: 'chromium' } },
      exec: 'browserCanary',
    },
  },
  thresholds: {
    checks: [{ threshold: 'rate==1.0', abortOnFail: true, delayAbortEval: '2m' }],
    lt08_journey_success: [{ threshold: 'rate==1.0', abortOnFail: true, delayAbortEval: '2m' }],
    lt08_map_success: ['rate==1.0'],
    lt08_buildings_success: ['rate==1.0'],
    lt08_directory_success: ['rate==1.0'],
    lt08_search_success: ['rate==1.0'],
    lt08_routes_success: ['rate==1.0'],
    lt08_pathfind_success: ['rate==1.0'],
    lt08_health_success: ['rate==1.0'],
    lt08_completed_journeys: ['count>=2500'],
    lt08_browser_cycles: ['count>=10'],
    lt08_browser_success: ['rate==1.0'],
    lt08_dynamic_duration_ms: ['p(95)<3000', 'p(99)<8000'],
    lt08_dynamic_duration_early_ms: ['p(95)<3000', 'p(99)<8000'],
    lt08_dynamic_duration_middle_ms: ['p(95)<3000', 'p(99)<8000'],
    lt08_dynamic_duration_late_ms: ['p(95)<3000', 'p(99)<8000'],
    lt08_browser_map_ready_ms: ['p(95)<15000'],
    lt08_http_5xx: [{ threshold: 'rate==0.0', abortOnFail: true, delayAbortEval: '30s' }],
    lt08_rate_limited: [{ threshold: 'rate==0.0', abortOnFail: true, delayAbortEval: '30s' }],
    browser_http_req_failed: ['rate==0.0'],
    browser_web_vital_lcp: ['p(95)<5000'],
    http_req_failed: ['rate==0.0'],
  },
};

const browserMapReady = new Trend('lt08_browser_map_ready_ms');

function setupFailure(stage, reason) {
  return new Error(`LT-08 setup stage ${stage} failed (${reason}).`);
}

function requireSetupResponse(response, expectedStatuses, stage) {
  if (!response || !new Set(expectedStatuses).has(response.status)) {
    setupInvalid.add(1, { stage: String(stage) });
    if (response && response.status === 429) throw setupFailure(stage, 'rate-limited');
    throw setupFailure(stage, response ? `status-${response.status}` : 'network');
  }
}

function csrfTokenFromAuthPage(response) {
  if (!response) return '';
  const hidden = String(response.html('input[name="_csrf"]').attr('value') || '');
  if (hidden) return hidden;
  const meta = String(response.html('meta[name="csrf-token"]').attr('content') || '');
  if (meta) return meta;
  const body = String(response.body || '');
  const hiddenMatch = /<input[^>]+name=["']_csrf["'][^>]+value=["']([^"']+)["']/i.exec(body);
  if (hiddenMatch) return hiddenMatch[1];
  const metaMatch = /<meta[^>]+name=["']csrf-token["'][^>]+content=["']([^"']+)["']/i.exec(body);
  return metaMatch ? metaMatch[1] : '';
}

function sessionCookieFromJar(jar, stage) {
  const values = jar.cookiesForURL(`${BASE_URL}/`)[SESSION_COOKIE_NAME];
  const value = Array.isArray(values) && values.length ? values[values.length - 1] : '';
  if (!value) throw setupFailure(stage, 'session-cookie-missing');
  return String(value);
}

function jsonOrNull(response) {
  try { return response ? response.json() : null; } catch (_) { return null; }
}

function requestOptions(cookie, phase, sessionSlot = null) {
  const tags = { test_case: 'LT-08', phase, name: `GET ${phase}` };
  if (sessionSlot !== null) tags.session_slot = String(sessionSlot);
  return {
    cookies: { [SESSION_COOKIE_NAME]: { value: String(cookie || ''), replace: true } },
    headers: { Accept: 'text/html,application/json' },
    redirects: 0,
    timeout: '30s',
    tags,
  };
}

function setupLogin(index) {
  const jar = new http.CookieJar();
  let csrfToken = '';
  for (let attempt = 0; attempt < 3 && !csrfToken; attempt += 1) {
    const authPage = http.get(`${BASE_URL}/auth`, {
      jar,
      redirects: 0,
      timeout: '30s',
      headers: { Accept: 'text/html' },
      tags: { test_case: 'LT-08', phase: 'setup-auth-page', session_slot: String(index + 1) },
    });
    requireSetupResponse(authPage, [200], 'auth-page');
    csrfToken = csrfTokenFromAuthPage(authPage);
    if (!csrfToken && attempt < 2) sleep(0.25);
  }
  if (!csrfToken) throw setupFailure('auth-page', 'csrf-token-missing');
  const loginResponse = http.post(`${BASE_URL}/login`, {
    _csrf: csrfToken,
    email: EMAIL,
    password: PASSWORD,
  }, {
    jar,
    redirects: 0,
    timeout: '30s',
    headers: { Accept: 'text/html', 'Content-Type': 'application/x-www-form-urlencoded' },
    tags: { test_case: 'LT-08', phase: 'setup-login', session_slot: String(index + 1) },
  });
  requireSetupResponse(loginResponse, [302], 'login');
  const location = loginResponse.headers.Location || loginResponse.headers.location || '';
  if (!/^\/dashboard(?:[/?#]|$)/.test(String(location))) throw setupFailure('login', 'redirect-unexpected');
  const session = { cookie: sessionCookieFromJar(jar, 'login'), jar };
  try {
    validateOriginalSession(session, index);
  } catch (error) {
    try { logoutSession(session.cookie, 'setup-login-failure', jar); } catch (_) { /* best effort */ }
    throw error;
  }
  return session;
}

function logoutSession(cookie, phase, existingJar = null) {
  const csrfParams = existingJar
    ? { jar: existingJar, timeout: '30s', headers: { Accept: 'application/json' }, tags: { test_case: 'LT-08', phase: `${phase}-csrf` } }
    : requestOptions(cookie, `${phase}-csrf`);
  csrfParams.headers.Accept = 'application/json';
  const csrfResponse = http.get(`${BASE_URL}/auth/csrf-token`, csrfParams);
  const body = jsonOrNull(csrfResponse);
  const csrfToken = body && body.success === true ? String(body.csrfToken || '') : '';
  if (!csrfResponse || csrfResponse.status !== 200 || !csrfToken) throw new Error('LT-08 session cleanup could not obtain the request token.');
  const logoutParams = existingJar
    ? { jar: existingJar, redirects: 0, timeout: '30s', headers: { Accept: 'application/json', 'X-CSRF-Token': csrfToken }, tags: { test_case: 'LT-08', phase: `${phase}-logout` } }
    : requestOptions(cookie, `${phase}-logout`);
  logoutParams.redirects = 0;
  logoutParams.headers.Accept = 'application/json';
  logoutParams.headers['X-CSRF-Token'] = csrfToken;
  const logoutResponse = http.post(`${BASE_URL}/logout`, null, logoutParams);
  if (!logoutResponse || logoutResponse.status !== 200) throw new Error('LT-08 session cleanup could not terminate the test session.');
}

function cleanupPartialSessions(sessions) {
  for (const session of sessions) {
    try { logoutSession(session.cookie, 'setup-cleanup', session.jar); } catch (_) { console.error('LT-08 setup cleanup encountered a session-termination error.'); }
  }
}

function validateOriginalSession(session, index) {
  const response = http.get(`${BASE_URL}/api/routes`, {
    jar: session.jar,
    redirects: 0,
    timeout: '30s',
    headers: { Accept: 'application/json' },
    tags: { test_case: 'LT-08', phase: 'setup-original-session', session_slot: String(index + 1) },
  });
  requireSetupResponse(response, [200], `original-session-${index + 1}`);
}

function validateSessionHandoff(session, index) {
  const response = http.get(`${BASE_URL}/api/routes`, requestOptions(session.cookie, 'setup-session-handoff', index + 1));
  requireSetupResponse(response, [200], `session-handoff-${index + 1}`);
}

function discoverRouteDestinationIds(session) {
  const response = http.get(`${BASE_URL}/api/routes`, {
    jar: session.jar,
    redirects: 0,
    timeout: '30s',
    headers: { Accept: 'application/json' },
    tags: { test_case: 'LT-08', phase: 'setup-route-catalog' },
  });
  requireSetupResponse(response, [200], 'route-catalog');
  const payload = jsonOrNull(response);
  if (!payload || payload.success !== true || !Array.isArray(payload.routes)) {
    setupInvalid.add(1, { stage: 'route-catalog-body' });
    throw setupFailure('route-catalog', 'body-invalid');
  }
  const ids = Array.from(new Set(payload.routes.map((route) => Number(route && (route.destination_building_id ?? route.destination?.id)))
    .filter((id) => Number.isSafeInteger(id) && id > 0)));
  if (ids.length < 5) {
    setupInvalid.add(1, { stage: 'route-catalog-destinations' });
    throw setupFailure('route-catalog', 'fewer-than-five-destinations');
  }
  return ids.slice(0, 10);
}

function responseStatus(response) {
  return response && Number.isFinite(Number(response.status)) ? Number(response.status) : 0;
}

function classifyResponse(status, phase, expected = 200) {
  const passed = status === expected;
  if (!passed) {
    const tags = { phase: String(phase), status: String(status) };
    if (status === 0) diagnosticNetwork.add(1, tags);
    else if (status === 401 || status === 403) diagnosticAuth.add(1, tags);
    else if (status >= 300 && status < 400) diagnosticRedirect.add(1, tags);
    else if (status >= 500) diagnosticServer.add(1, tags);
    else if (status >= 400) diagnosticClient.add(1, tags);
    else diagnosticOther.add(1, tags);
  }
  server5xx.add(status >= 500 ? 1 : 0);
  rateLimited.add(status === 429 ? 1 : 0);
  return passed;
}

function embeddedBuildingsOrNull(body) {
  const match = String(body || '').match(/<script[^>]+id=["']buildingsData["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try { const parsed = JSON.parse(match[1]); return Array.isArray(parsed) ? parsed : null; } catch (_) { return null; }
}

function validBuilding(building) {
  return Boolean(building && Number.isSafeInteger(Number(building.id)) && Number(building.id) > 0 &&
    typeof building.name === 'string' && Number.isFinite(Number(building.lat)) && Number.isFinite(Number(building.lng)));
}

function classifyWindow(startedAtMs) {
  return classifyEnduranceWindow(Date.now() - startedAtMs);
}

function recordDuration(response, startedAtMs) {
  const duration = response && response.timings && Number(response.timings.duration);
  if (!Number.isFinite(duration)) return;
  dynamicDuration.add(duration);
  const window = classifyWindow(startedAtMs);
  if (window === 'early') earlyDuration.add(duration);
  if (window === 'middle') middleDuration.add(duration);
  if (window === 'late') lateDuration.add(duration);
}

function recordResponse(response, phase, startedAtMs, expected = 200) {
  recordDuration(response, startedAtMs);
  return classifyResponse(responseStatus(response), phase, expected);
}

export function setup() {
  const sessions = [];
  try {
    for (let index = 0; index < SESSION_POOL_SIZE; index += 1) sessions.push(setupLogin(index));
    sessions.forEach((session, index) => validateSessionHandoff(session, index));
    const routeDestinationIds = discoverRouteDestinationIds(sessions[0]);
    setupCandidates.add(routeDestinationIds.length);
    setupSelected.add(routeDestinationIds.length);
    console.log(`LT-08 setup complete; selected ${routeDestinationIds.length} route destinations.`);
    return {
      sessionCookies: sessions.map((session) => session.cookie),
      routeDestinationIds,
      workloadStartedAtMs: Date.now(),
    };
  } catch (error) {
    cleanupPartialSessions(sessions);
    const safeMessage = error && typeof error.message === 'string' && error.message.indexOf('LT-08 setup stage ') === 0
      ? error.message
      : 'LT-08 setup stage failed (unexpected).';
    console.error(safeMessage);
    throw new Error('LT-08 setup failed; no endurance workload was started.');
  }
}

function httpSessionIndex(vu) {
  if (vu <= 13) return 0;
  if (vu <= 25) return 1;
  if (vu <= 37) return 2;
  return 3;
}

let vuCookie = null;
let mapLoaded = false;

export function httpEndurance(data) {
  if (!data || !Array.isArray(data.sessionCookies) || data.sessionCookies.length !== SESSION_POOL_SIZE) {
    journeySuccess.add(0);
    return;
  }
  if (!vuCookie) vuCookie = data.sessionCookies[httpSessionIndex(__VU)];
  const startedAt = Number(data.workloadStartedAtMs) || Date.now();
  const iterationStarted = Date.now();
  let passed = true;

  if (!mapLoaded) {
    const [mapPage, buildingsPage, directory] = http.batch([
      ['GET', `${BASE_URL}/map`, null, requestOptions(vuCookie, 'workload-map')],
      ['GET', `${BASE_URL}/buildings`, null, requestOptions(vuCookie, 'workload-buildings-page')],
      ['GET', `${BASE_URL}/api/buildings`, null, requestOptions(vuCookie, 'workload-directory')],
    ]);
    const mapData = embeddedBuildingsOrNull(mapPage.body);
    const mapPass = recordResponse(mapPage, 'workload-map', startedAt) && Array.isArray(mapData) && mapData.length > 0 && mapData.every(validBuilding);
    const buildingData = embeddedBuildingsOrNull(buildingsPage.body);
    const buildingsPass = recordResponse(buildingsPage, 'workload-buildings-page', startedAt) && Array.isArray(buildingData) && buildingData.length > 0;
    const directoryData = jsonOrNull(directory);
    const directoryPass = recordResponse(directory, 'workload-directory', startedAt) && directoryData && directoryData.success === true && Array.isArray(directoryData.buildings) && directoryData.buildings.length > 0 && directoryData.buildings.every(validBuilding);
    mapSuccess.add(mapPass ? 1 : 0);
    buildingsSuccess.add(buildingsPass ? 1 : 0);
    directorySuccess.add(directoryPass ? 1 : 0);
    check(mapPage, { 'LT-08 map returned valid building data': () => mapPass });
    check(buildingsPage, { 'LT-08 Buildings page returned the catalog': () => buildingsPass });
    check(directory, { 'LT-08 directory returned valid markers': () => directoryPass });
    passed = mapPass && buildingsPass && directoryPass;
    mapLoaded = mapPass;
  }

  if (passed) {
    const choice = (__VU + __ITER) % 10;
    let response;
    let phase;
    if (choice < 4) {
      const term = SEARCH_TERMS[(__VU + __ITER) % SEARCH_TERMS.length];
      response = http.get(`${BASE_URL}/api/search?q=${encodeURIComponent(term)}`, requestOptions(vuCookie, 'workload-search'));
      phase = 'workload-search';
    } else if (choice < 7) {
      response = http.get(`${BASE_URL}/api/routes`, requestOptions(vuCookie, 'workload-routes'));
      phase = 'workload-routes';
    } else {
      const destinationId = data.routeDestinationIds[(__VU + __ITER) % data.routeDestinationIds.length];
      response = http.get(`${BASE_URL}/api/pathfind?start=main-gate&destinationBuildingId=${encodeURIComponent(destinationId)}`, requestOptions(vuCookie, 'workload-pathfind'));
      phase = 'workload-pathfind';
    }
    const payload = jsonOrNull(response);
    const actionPass = recordResponse(response, phase, startedAt) && payload && payload.success === true;
    if (phase === 'workload-search') searchSuccess.add(actionPass ? 1 : 0);
    else if (phase === 'workload-routes') routesSuccess.add(actionPass ? 1 : 0);
    else pathfindSuccess.add(actionPass ? 1 : 0);
    check(response, { [`LT-08 ${phase} returned a successful JSON payload`]: () => Boolean(actionPass) });
    passed = Boolean(actionPass);
  }

  if (__VU === 1 && __ITER % 5 === 0) {
    const healthStartedAt = Date.now();
    const health = http.get(`${BASE_URL}/healthz`, requestOptions(vuCookie, 'workload-health'));
    const healthPass = recordResponse(health, 'workload-health', healthStartedAt) && health.status === 200;
    healthSuccess.add(healthPass ? 1 : 0);
    check(health, { 'LT-08 health check returned 200': () => healthPass });
    passed = healthPass && passed;
  }

  journeySuccess.add(passed ? 1 : 0);
  if (passed) completedJourneys.add(1);
  check({ passed }, { 'LT-08 endurance journey completed': (value) => value.passed === true });
  iterationDuration.add(Date.now() - iterationStarted);
  sleep(4 + Math.random() * 4);
}

async function installPresenceStub(context) {
  await context.addInitScript(`
    (() => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = function (input, init) {
        let pathname = '';
        try { pathname = new URL(String(typeof input === 'string' ? input : input && input.url || ''), location.href).pathname; } catch (_) { pathname = ''; }
        if (pathname === '/api/presence/heartbeat') return Promise.resolve(new Response(null, { status: 204 }));
        return originalFetch(input, init);
      };
    })();
  `);
}

function browserStatus(response) {
  try { return response && typeof response.status === 'function' ? Number(response.status()) : 0; } catch (_) { return 0; }
}

function classifyBrowserStatus(status, phase) {
  if (status === 0) browserDiagnosticNetwork.add(1, { phase, status: '0' });
  else if (status === 401 || status === 403) browserDiagnosticAuth.add(1, { phase, status: String(status) });
  else if (status >= 300 && status < 400) browserDiagnosticRedirect.add(1, { phase, status: String(status) });
  else if (status >= 500) browserDiagnosticServer.add(1, { phase, status: String(status) });
  else if (status >= 400) browserDiagnosticClient.add(1, { phase, status: String(status) });
  else if (status !== 200) browserDiagnosticOther.add(1, { phase, status: String(status) });
}

async function inspectCanaryMap(page, cycle) {
  const started = Date.now();
  let response = null;
  try {
    if (cycle === 1 || !/\/map(?:[/?#]|$)/i.test(String(page.url() || ''))) {
      response = await page.goto(`${BASE_URL}/map`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } else {
      const captured = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 })
        .then((value) => ({ kind: 'response', value }))
        .catch(() => ({ kind: 'missing', value: null }));
      const reloaded = page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 })
        .then((value) => ({ kind: value ? 'response' : 'null', value: value || null }))
        .catch(() => ({ kind: 'throw', value: null }));
      const [capturedResult, reloadResult] = await Promise.all([captured, reloaded]);
      if (reloadResult.kind === 'throw') {
        browserNavigationThrow.add(1, { phase: 'browser-navigation', status: '0' });
        return false;
      }
      response = reloadResult.value;
      if (!response && capturedResult.kind === 'response') {
        browserNavigationNullRecovered.add(1, { phase: 'browser-navigation', status: '0' });
        response = capturedResult.value;
      }
    }
  } catch (_) {
    browserNavigationThrow.add(1, { phase: 'browser-navigation', status: '0' });
    browserDiagnosticUnexpected.add(1, { phase: 'browser-navigation', status: '0' });
    return false;
  }
  if (!response) {
    browserNavigationNull.add(1, { phase: 'browser-navigation', status: '0' });
    return false;
  }
  const status = browserStatus(response);
  browserNavigationResponse.add(1, { phase: 'browser-navigation', status: String(status) });
  classifyBrowserStatus(status, 'browser-navigation');
  if (status !== 200 || !/\/map(?:[/?#]|$)/i.test(String(page.url() || ''))) {
    browserDiagnosticRender.add(1, { phase: 'browser-navigation', status: String(status) });
    return false;
  }
  try {
    await page.locator('#mapView').waitFor({ state: 'visible', timeout: 30000 });
    await page.locator('#mapView .maplibregl-canvas, #mapView .leaflet-container, #mapView .map-fallback').waitFor({ state: 'visible', timeout: 30000 });
    await page.locator('.map-start-label').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(CANARY_SETTLE_MS);
    const surface = await page.locator('#mapView .maplibregl-canvas, #mapView .leaflet-container, #mapView .map-fallback').count();
    const startText = String(await page.locator('.map-start-label').first().textContent() || '');
    const bodyText = String(await page.locator('body').textContent() || '');
    const checks = {
      url: /\/map(?:[/?#]|$)/i.test(String(page.url() || '')),
      status: status === 200,
      surface: surface > 0,
      start: /Guard House/i.test(startText),
      labels: (await page.locator('.map-building-label--maplibre, .map-building-label--leaflet, .map-building-label--fallback').count()) > 0,
      controls: /Plan Route|Find Location/i.test(bodyText),
    };
    const passed = check(page, {
      'LT-08 canary stayed on /map': () => checks.url,
      'LT-08 canary received HTTP 200': () => checks.status,
      'LT-08 canary map surface rendered': () => checks.surface,
      'LT-08 canary has Guard House label': () => checks.start,
      'LT-08 canary has building labels': () => checks.labels,
      'LT-08 canary exposes route controls': () => checks.controls,
    });
    if (!passed) browserDiagnosticRender.add(1, { phase: 'browser-map-checks', status: String(status) });
    browserMapReady.add(Date.now() - started);
    return passed;
  } catch (_) {
    browserDiagnosticRender.add(1, { phase: 'browser-map-inspection', status: String(status) });
    return false;
  }
}

export async function browserCanary(data) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const started = Date.now();
  let cycle = 0;
  let peakShot = false;
  let finalShot = false;
  try {
    await context.addCookies([{
      name: SESSION_COOKIE_NAME,
      value: String(data && data.sessionCookies && data.sessionCookies[0] || ''),
      url: `${BASE_URL}/`,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    }]);
    await installPresenceStub(context);
    while (Date.now() - started < CANARY_DURATION_MS) {
      cycle += 1;
      const passed = await inspectCanaryMap(page, cycle);
      browserSuccess.add(passed ? 1 : 0);
      browserCycles.add(1);
      const elapsed = Date.now() - started;
      if (passed && !peakShot && elapsed >= HOLD_START_MS + 60000 && PEAK_SCREENSHOT) {
        await page.screenshot({ path: PEAK_SCREENSHOT, fullPage: true });
        peakShot = true;
      }
      if (passed && !finalShot && elapsed >= HOLD_END_MS - 60000 && FINAL_SCREENSHOT) {
        await page.screenshot({ path: FINAL_SCREENSHOT, fullPage: true });
        finalShot = true;
      }
      const remaining = CANARY_INTERVAL_MS - (Date.now() - (started + (cycle - 1) * CANARY_INTERVAL_MS));
      if (remaining > 0) await page.waitForTimeout(remaining);
    }
  } catch (_) {
    browserDiagnosticUnexpected.add(1, { phase: 'browser-canary', status: '0' });
    browserSuccess.add(0);
  } finally {
    try { await page.close(); } catch (_) { /* context close remains authoritative */ }
    await context.close();
  }
}

export function teardown(data) {
  const cookies = data && Array.isArray(data.sessionCookies) ? data.sessionCookies : [];
  if (cookies.length !== SESSION_POOL_SIZE) throw new Error('LT-08 teardown did not receive the complete test-session pool.');
  let failed = false;
  cookies.forEach((cookie, index) => {
    try { logoutSession(String(cookie || ''), `teardown-${index + 1}`); } catch (_) { failed = true; }
  });
  if (failed) throw new Error('LT-08 could not terminate every test session.');
}

export function handleSummary(data) {
  const safeSummary = { ...data };
  delete safeSummary.setup_data;
  const summaryPath = String(__ENV.K6_SUMMARY_PATH || '').trim();
  if (!summaryPath) return { stdout: JSON.stringify(safeSummary, null, 2) };
  return { [summaryPath]: JSON.stringify(safeSummary, null, 2) };
}
