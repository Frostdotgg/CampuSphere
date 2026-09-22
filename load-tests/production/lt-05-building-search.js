import http from 'k6/http';
import { browser } from 'k6/browser';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { canonicalBuildingName, evaluateSearchPayload } from './lt-05-result-policy.js';

/*
 * LT-05 measures building-name search under a staged 50-client Production
 * workload without launching 50 local browsers. Forty-nine authenticated HTTP
 * users exercise the real Campus Map search endpoint while one Chromium canary
 * verifies the client-side Buildings filter, Map sidebar, and map-marker
 * stability. Four temporary guest sessions avoid a login storm and one hot
 * session row.
 *
 * Buildings-page filtering is entirely client-side, so repeated search input
 * there would not create server requests. Each HTTP VU opens the real
 * Buildings and Map pages once, then loads /api/search. The browser canary is
 * the authoritative check of both rendered search surfaces.
 */
const BASE_URL = String(__ENV.BASE_URL || '').replace(/\/+$/, '');
const EMAIL = String(__ENV.K6_TEST_EMAIL || '');
const PASSWORD = String(__ENV.K6_TEST_PASSWORD || '');
const BUILDINGS_SCREENSHOT = String(__ENV.K6_BUILDINGS_SCREENSHOT_PATH || '');
const MAP_SCREENSHOT = String(__ENV.K6_MAP_SCREENSHOT_PATH || '');
const EXPECTED_HOST = 'campusphere-cspc.vercel.app';
const SESSION_COOKIE_NAME = '__Host-campusphere.sid';
const SESSION_POOL_SIZE = 4;
const HTTP_PEAK_VUS = 49;
const MIN_QUERY_COUNT = 5;
const MAX_QUERY_COUNT = 50;
const CANARY_DURATION_MS = 4 * 60 * 1000;
const CANARY_INTERVAL_MS = 20 * 1000;
const PEAK_HOLD_START_MS = 2 * 60 * 1000;
const MAP_SETTLE_MS = 3000;

if (!/^https:\/\/[a-z0-9.-]+$/i.test(BASE_URL)) {
  throw new Error('BASE_URL must be an HTTPS origin.');
}
const BASE_HOST = BASE_URL.replace(/^https:\/\//i, '').toLowerCase();
if (BASE_HOST !== EXPECTED_HOST) {
  throw new Error(`LT-05 refuses a non-Production host: ${BASE_HOST}`);
}
if (!EMAIL || !PASSWORD) {
  throw new Error('K6_TEST_EMAIL and K6_TEST_PASSWORD are required.');
}

const journeySuccess = new Rate('lt05_journey_success');
const buildingsCatalogCorrect = new Rate('lt05_buildings_catalog_correct');
const mapCatalogCorrect = new Rate('lt05_map_catalog_correct');
const searchResponseCorrect = new Rate('lt05_search_response_correct');
const searchExactBuilding = new Rate('lt05_search_exact_building');
const searchResultScope = new Rate('lt05_search_result_scope');
const buildingsFilterCorrect = new Rate('lt05_buildings_filter_correct');
const mapResultCorrect = new Rate('lt05_map_result_correct');
const markerStability = new Rate('lt05_marker_stability');
const browserSuccess = new Rate('lt05_browser_success');
const searchDuration = new Trend('lt05_search_duration_ms');
const browserSearchSettle = new Trend('lt05_browser_search_settle_ms');
const server5xx = new Rate('lt05_http_5xx');
const rateLimited = new Rate('lt05_rate_limited');

// Diagnostics use fixed phases and numeric statuses only. They never contain a
// query, URL, cookie, token, response body, or credential value.
const diagnosticAuth = new Counter('lt05_diag_auth_responses');
const diagnosticRedirect = new Counter('lt05_diag_redirect_responses');
const diagnosticNetwork = new Counter('lt05_diag_network_errors');
const diagnosticClient = new Counter('lt05_diag_other_client_errors');
const diagnosticServer = new Counter('lt05_diag_server_errors');
const diagnosticOther = new Counter('lt05_diag_other_responses');
const diagnosticInvalidJson = new Counter('lt05_diag_invalid_json');
const diagnosticCatalog = new Counter('lt05_diag_catalog_mismatch');
const diagnosticMissingBuilding = new Counter('lt05_diag_missing_exact_building');
const diagnosticUnrelatedResult = new Counter('lt05_diag_unrelated_result');
const setupQueryCandidates = new Counter('lt05_setup_query_candidates');
const setupQuerySelected = new Counter('lt05_setup_query_selected');
const setupQueryRejectedAmbiguous = new Counter('lt05_setup_query_rejected_ambiguous');
const setupQueryRejectedMissingExact = new Counter('lt05_setup_query_rejected_missing_exact');
const setupQueryInvalidResponse = new Counter('lt05_setup_query_invalid_response');
const browserDiagnosticAuth = new Counter('lt05_diag_browser_auth');
const browserDiagnosticRedirect = new Counter('lt05_diag_browser_redirect');
const browserDiagnosticNetwork = new Counter('lt05_diag_browser_network');
const browserDiagnosticClient = new Counter('lt05_diag_browser_client_status');
const browserDiagnosticServer = new Counter('lt05_diag_browser_server_status');
const browserDiagnosticOther = new Counter('lt05_diag_browser_other_status');
const browserDiagnosticBuildings = new Counter('lt05_diag_browser_buildings_filter');
const browserDiagnosticMap = new Counter('lt05_diag_browser_map_result');
const browserDiagnosticConnection = new Counter('lt05_diag_browser_connection_message');
const browserDiagnosticMarkers = new Counter('lt05_diag_browser_marker_change');
const browserDiagnosticUnexpected = new Counter('lt05_diag_browser_unexpected');

const browserFailureWarnings = Object.create(null);

export const options = {
  // Do not retain full query-bearing URLs as metric tags in saved evidence.
  systemTags: ['status', 'method', 'name', 'proto', 'scenario', 'expected_response'],
  setupTimeout: '2m',
  scenarios: {
    http_search: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 9 },
        { duration: '30s', target: 24 },
        { duration: '1m', target: HTTP_PEAK_VUS },
        { duration: '1m', target: HTTP_PEAK_VUS },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
      gracefulStop: '30s',
      exec: 'httpSearch',
    },
    browser_canary: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '5m',
      gracefulStop: '30s',
      options: { browser: { type: 'chromium' } },
      exec: 'browserCanary',
    },
  },
  thresholds: {
    checks: [{ threshold: 'rate==1.0', abortOnFail: true, delayAbortEval: '30s' }],
    lt05_journey_success: [{ threshold: 'rate==1.0', abortOnFail: true, delayAbortEval: '30s' }],
    lt05_buildings_catalog_correct: ['rate==1.0'],
    lt05_map_catalog_correct: ['rate==1.0'],
    lt05_search_response_correct: ['rate==1.0'],
    lt05_search_exact_building: ['rate==1.0'],
    lt05_search_result_scope: ['rate==1.0'],
    lt05_buildings_filter_correct: ['rate==1.0'],
    lt05_map_result_correct: ['rate==1.0'],
    lt05_marker_stability: ['rate==1.0'],
    lt05_browser_success: ['rate==1.0'],
    lt05_search_duration_ms: ['p(95)<3000', 'p(99)<8000'],
    lt05_browser_search_settle_ms: ['p(95)<5000'],
    lt05_http_5xx: [{ threshold: 'rate==0.0', abortOnFail: true, delayAbortEval: '30s' }],
    lt05_rate_limited: [{ threshold: 'rate==0.0', abortOnFail: true, delayAbortEval: '30s' }],
    browser_web_vital_lcp: ['p(95)<5000'],
    browser_http_req_failed: ['rate==0.0'],
    http_req_failed: ['rate==0.0'],
  },
};

function setupFailure(stage, reason) {
  return new Error(`LT-05 setup stage ${stage} failed (${reason}).`);
}

function requireSetupResponse(response, expectedStatuses, stage) {
  const allowed = new Set(expectedStatuses);
  if (!response) throw setupFailure(stage, 'network');
  if (!allowed.has(response.status)) {
    if (response.status === 429) throw setupFailure(stage, 'rate-limited');
    throw setupFailure(stage, `status-${response.status}`);
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
  if (hiddenMatch && hiddenMatch[1]) return hiddenMatch[1];
  const metaMatch = /<meta[^>]+name=["']csrf-token["'][^>]+content=["']([^"']+)["']/i.exec(body);
  return metaMatch && metaMatch[1] ? metaMatch[1] : '';
}

function sessionCookieFromJar(jar, stage) {
  const jarCookies = jar.cookiesForURL(`${BASE_URL}/`);
  const values = jarCookies && jarCookies[SESSION_COOKIE_NAME];
  const value = Array.isArray(values) && values.length > 0 ? values[values.length - 1] : '';
  if (!value) throw setupFailure(stage, 'session-cookie-missing');
  return String(value);
}

function requestOptions(cookie, phase, sessionSlot = null) {
  const tags = { test_case: 'LT-05', phase, name: `GET ${phase}` };
  if (sessionSlot !== null) tags.session_slot = String(sessionSlot);
  return {
    cookies: {
      [SESSION_COOKIE_NAME]: { value: String(cookie || ''), replace: true },
    },
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
      timeout: '30s',
      tags: { test_case: 'LT-05', phase: 'setup-auth-page', name: 'GET /auth' },
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
    headers: {
      Accept: 'text/html',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    tags: { test_case: 'LT-05', phase: 'setup-login', name: 'POST /login' },
  });
  requireSetupResponse(loginResponse, [302], 'login');
  const location = loginResponse.headers.Location || loginResponse.headers.location || '';
  if (!/^\/dashboard(?:[/?#]|$)/.test(String(location))) {
    throw setupFailure('login', 'redirect-unexpected');
  }
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
    ? {
      jar: existingJar,
      timeout: '30s',
      headers: { Accept: 'application/json' },
      tags: { test_case: 'LT-05', phase: `${phase}-csrf`, name: 'GET /auth/csrf-token' },
    }
    : requestOptions(cookie, `${phase}-csrf`);
  csrfParams.headers.Accept = 'application/json';
  const csrfResponse = http.get(`${BASE_URL}/auth/csrf-token`, csrfParams);
  if (!csrfResponse || csrfResponse.status !== 200) {
    throw new Error('LT-05 session cleanup could not obtain the authenticated request token.');
  }
  const body = jsonOrNull(csrfResponse);
  const csrfToken = body && body.success === true ? String(body.csrfToken || '') : '';
  if (!csrfToken) throw new Error('LT-05 session cleanup received an invalid request token.');

  const logoutParams = existingJar
    ? {
      jar: existingJar,
      redirects: 0,
      timeout: '30s',
      headers: { Accept: 'application/json', 'X-CSRF-Token': csrfToken },
      tags: { test_case: 'LT-05', phase: `${phase}-logout`, name: 'POST /logout' },
    }
    : requestOptions(cookie, `${phase}-logout`);
  logoutParams.redirects = 0;
  logoutParams.headers.Accept = 'application/json';
  logoutParams.headers['X-CSRF-Token'] = csrfToken;
  logoutParams.tags.name = 'POST /logout';
  const logoutResponse = http.post(`${BASE_URL}/logout`, null, logoutParams);
  if (!logoutResponse || logoutResponse.status !== 200) {
    throw new Error('LT-05 session cleanup could not terminate the test session.');
  }
}

function cleanupPartialSessions(sessions) {
  for (const session of sessions) {
    try {
      logoutSession(session.cookie, 'setup-cleanup', session.jar);
    } catch (_) {
      console.error('LT-05 setup cleanup encountered a session-termination error.');
    }
  }
}

function validateOriginalSession(session, index) {
  const response = http.get(`${BASE_URL}/api/buildings`, {
    jar: session.jar,
    redirects: 0,
    timeout: '30s',
    headers: { Accept: 'application/json' },
    tags: {
      test_case: 'LT-05',
      phase: 'setup-original-session',
      session_slot: String(index + 1),
      name: 'GET /api/buildings',
    },
  });
  requireSetupResponse(response, [200], `original-session-${index + 1}`);
}

function validateSessionHandoff(session, index) {
  const options = requestOptions(session.cookie, 'setup-session-handoff', index + 1);
  options.tags.name = 'GET /api/buildings';
  const response = http.get(`${BASE_URL}/api/buildings`, options);
  requireSetupResponse(response, [200], `session-handoff-${index + 1}`);
}

function canonicalName(value) {
  return canonicalBuildingName(value);
}

function filterNeedle(value) {
  return String(value == null ? '' : value).toLowerCase().trim();
}

function jsonOrNull(response) {
  try {
    return response ? response.json() : null;
  } catch (_) {
    return null;
  }
}

function queryCatalog(session) {
  const response = http.get(`${BASE_URL}/api/buildings`, {
    jar: session.jar,
    redirects: 0,
    timeout: '30s',
    headers: { Accept: 'application/json' },
    tags: { test_case: 'LT-05', phase: 'setup-building-catalog', name: 'GET /api/buildings' },
  });
  requireSetupResponse(response, [200], 'building-catalog');
  const body = jsonOrNull(response);
  if (!body || body.success !== true || !Array.isArray(body.buildings)) {
    throw setupFailure('building-catalog', 'body-invalid');
  }

  const seenIds = new Set();
  const seenNames = new Set();
  const queries = [];
  for (const building of body.buildings) {
    const id = Number(building && building.id);
    const name = String(building && building.name || '').trim();
    const canonical = canonicalName(name);
    if (!Number.isSafeInteger(id) || id <= 0 || !name || !canonical) {
      throw setupFailure('building-catalog', 'row-invalid');
    }
    if (seenIds.has(id) || seenNames.has(canonical)) {
      throw setupFailure('building-catalog', 'duplicate-identity');
    }
    seenIds.add(id);
    seenNames.add(canonical);
    queries.push({
      id,
      name,
      description: String(building.desc || building.description || ''),
    });
  }
  queries.sort((a, b) => canonicalName(a.name).localeCompare(canonicalName(b.name)));
  if (queries.length < MIN_QUERY_COUNT) {
    throw setupFailure('building-catalog', 'too-few-buildings');
  }
  return queries.slice(0, MAX_QUERY_COUNT);
}

function preflightQueries(session, candidates) {
  const selected = [];
  let rejectedAmbiguous = 0;
  let rejectedMissingExact = 0;

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    setupQueryCandidates.add(1);
    const response = http.get(
      `${BASE_URL}/api/search?q=${encodeURIComponent(candidate.name)}`,
      {
        jar: session.jar,
        redirects: 0,
        timeout: '30s',
        headers: { Accept: 'application/json' },
        tags: {
          test_case: 'LT-05',
          phase: 'setup-query-preflight',
          candidate_slot: String(index),
          name: 'GET /api/search',
        },
      }
    );
    requireSetupResponse(response, [200], `query-preflight-${index + 1}`);
    const decision = evaluateSearchPayload(candidate, jsonOrNull(response));
    if (!decision.responseValid) {
      setupQueryInvalidResponse.add(1);
      throw setupFailure('query-preflight', 'response-invalid');
    }
    if (decision.accepted) {
      selected.push(candidate);
      setupQuerySelected.add(1);
    } else if (decision.reason === 'missing-exact') {
      rejectedMissingExact += 1;
      setupQueryRejectedMissingExact.add(1);
    } else {
      rejectedAmbiguous += 1;
      setupQueryRejectedAmbiguous.add(1);
    }
    if (index + 1 < candidates.length) sleep(0.2);
  }

  console.log(
    `LT-05 query preflight complete; candidates=${candidates.length}, selected=${selected.length}, ` +
    `rejected_ambiguous=${rejectedAmbiguous}, rejected_missing_exact=${rejectedMissingExact}.`
  );
  if (selected.length < MIN_QUERY_COUNT) {
    throw setupFailure('query-preflight', 'too-few-unambiguous-queries');
  }
  return selected;
}

export function setup() {
  const sessions = [];
  try {
    for (let i = 0; i < SESSION_POOL_SIZE; i += 1) sessions.push(setupLogin(i));
    sessions.forEach((session, index) => validateOriginalSession(session, index));
    sessions.forEach((session, index) => validateSessionHandoff(session, index));
    const candidates = queryCatalog(sessions[0]);
    const queries = preflightQueries(sessions[0], candidates);
    console.log(`LT-05 setup complete; ${queries.length} unambiguous exact building-name queries selected.`);
    return {
      sessionCookies: sessions.map((session) => session.cookie),
      queries,
    };
  } catch (error) {
    cleanupPartialSessions(sessions);
    const safeMessage = error && typeof error.message === 'string' && error.message.indexOf('LT-05 setup stage ') === 0
      ? error.message
      : 'LT-05 setup stage failed (unexpected).';
    console.error(safeMessage);
    throw new Error('LT-05 setup failed; no search workload was started.');
  }
}

function responseStatus(response) {
  return response && Number.isFinite(Number(response.status)) ? Number(response.status) : 0;
}

function diagnosticTags(phase, status) {
  return { phase: String(phase || 'unknown'), status: String(status) };
}

function classifyHttpResponse(status, phase, expectedStatus) {
  if (status === expectedStatus) return;
  const tags = diagnosticTags(phase, status);
  if (status === 0) diagnosticNetwork.add(1, tags);
  else if (status === 401 || status === 403) diagnosticAuth.add(1, tags);
  else if (status >= 300 && status < 400) diagnosticRedirect.add(1, tags);
  else if (status >= 500) diagnosticServer.add(1, tags);
  else if (status >= 400) diagnosticClient.add(1, tags);
  else diagnosticOther.add(1, tags);
}

function recordResponse(response, expectedStatus, phase, includeSearchTiming = false) {
  const status = responseStatus(response);
  if (includeSearchTiming && response && response.timings && Number.isFinite(Number(response.timings.duration))) {
    searchDuration.add(Number(response.timings.duration));
  }
  classifyHttpResponse(status, phase, expectedStatus);
  server5xx.add(status >= 500 ? 1 : 0);
  rateLimited.add(status === 429 ? 1 : 0);
  return status === expectedStatus;
}

function embeddedBuildingsOrNull(body) {
  const match = String(body || '').match(
    /<script[^>]+id=["']buildingsData["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed) ? parsed : null;
  } catch (_) {
    return null;
  }
}

function catalogContainsQueries(catalog, queries) {
  if (!Array.isArray(catalog) || catalog.length < queries.length) return false;
  const identities = new Set(catalog.map((building) => {
    const id = Number(building && building.id);
    const name = canonicalName(building && building.name);
    return Number.isSafeInteger(id) && id > 0 && name ? `${id}:${name}` : '';
  }).filter(Boolean));
  return queries.every((query) => identities.has(`${query.id}:${canonicalName(query.name)}`));
}

function sessionIndexForVu(vu) {
  return (Math.max(1, Number(vu) || 1) - 1) % SESSION_POOL_SIZE;
}

let vuCookie = null;
let warmupComplete = false;

function runHttpWarmup(data) {
  const buildingsOptions = requestOptions(vuCookie, 'workload-buildings-page');
  buildingsOptions.tags.name = 'GET /buildings';
  const mapOptions = requestOptions(vuCookie, 'workload-map-page');
  mapOptions.tags.name = 'GET /map';
  const directoryOptions = requestOptions(vuCookie, 'workload-building-directory');
  directoryOptions.tags.name = 'GET /api/buildings';

  const responses = http.batch([
    ['GET', `${BASE_URL}/buildings`, null, buildingsOptions],
    ['GET', `${BASE_URL}/map`, null, mapOptions],
    ['GET', `${BASE_URL}/api/buildings`, null, directoryOptions],
  ]);
  const buildingsResponse = responses[0];
  const mapResponse = responses[1];
  const directoryResponse = responses[2];

  const buildingsStatusOk = recordResponse(buildingsResponse, 200, 'workload-buildings-page');
  const mapStatusOk = recordResponse(mapResponse, 200, 'workload-map-page');
  const directoryStatusOk = recordResponse(directoryResponse, 200, 'workload-building-directory');
  const buildingsCatalog = buildingsStatusOk ? embeddedBuildingsOrNull(buildingsResponse.body) : null;
  const mapCatalog = mapStatusOk ? embeddedBuildingsOrNull(mapResponse.body) : null;
  const directoryBody = directoryStatusOk ? jsonOrNull(directoryResponse) : null;
  const directoryCatalog = directoryBody && directoryBody.success === true ? directoryBody.buildings : null;

  const buildingsPass = buildingsStatusOk && catalogContainsQueries(buildingsCatalog, data.queries);
  const mapPass = mapStatusOk &&
    catalogContainsQueries(mapCatalog, data.queries) &&
    directoryStatusOk &&
    catalogContainsQueries(directoryCatalog, data.queries);
  if (!buildingsPass) diagnosticCatalog.add(1, diagnosticTags('workload-buildings-catalog', responseStatus(buildingsResponse)));
  if (!mapPass) diagnosticCatalog.add(1, diagnosticTags('workload-map-catalog', responseStatus(mapResponse)));
  buildingsCatalogCorrect.add(buildingsPass ? 1 : 0);
  mapCatalogCorrect.add(mapPass ? 1 : 0);
  check({ buildingsPass, mapPass }, {
    'Buildings page contains the authoritative query catalog': (value) => value.buildingsPass === true,
    'Campus Map and directory contain the authoritative query catalog': (value) => value.mapPass === true,
  });
  return buildingsPass && mapPass;
}

export function httpSearch(data) {
  if (!data || !Array.isArray(data.sessionCookies) || data.sessionCookies.length !== SESSION_POOL_SIZE ||
      !Array.isArray(data.queries) || data.queries.length < MIN_QUERY_COUNT) {
    journeySuccess.add(0);
    check(false, { 'LT-05 setup data is available': (value) => value === true });
    return;
  }
  if (!vuCookie) vuCookie = data.sessionCookies[sessionIndexForVu(__VU)];

  let passed = true;
  if (!warmupComplete) {
    warmupComplete = runHttpWarmup(data);
    passed = warmupComplete;
  }

  if (passed) {
    const target = data.queries[(__VU + __ITER) % data.queries.length];
    const options = requestOptions(vuCookie, 'workload-search');
    options.tags.name = 'GET /api/search';
    options.tags.query_slot = String((__VU + __ITER) % data.queries.length);
    const response = http.get(
      `${BASE_URL}/api/search?q=${encodeURIComponent(target.name)}`,
      options
    );
    const statusOk = recordResponse(response, 200, 'workload-search', true);
    const payload = statusOk ? jsonOrNull(response) : null;
    const decision = evaluateSearchPayload(target, payload);
    const responsePass = statusOk && decision.responseValid;
    if (statusOk && !responsePass) diagnosticInvalidJson.add(1, diagnosticTags('workload-search-body', 200));
    const exactPass = responsePass && decision.exactFound;
    const scopePass = responsePass && decision.scoped;
    if (responsePass && !exactPass) diagnosticMissingBuilding.add(1, diagnosticTags('workload-search-exact', 200));
    if (responsePass && !scopePass) diagnosticUnrelatedResult.add(1, diagnosticTags('workload-search-scope', 200));

    searchResponseCorrect.add(responsePass ? 1 : 0);
    searchExactBuilding.add(exactPass ? 1 : 0);
    searchResultScope.add(scopePass ? 1 : 0);
    check({ responsePass, exactPass, scopePass }, {
      'Map search returns a valid successful response': (value) => value.responsePass === true,
      'Map search returns the exact requested building': (value) => value.exactPass === true,
      'Map search contains no unrelated building, office, or route result': (value) => value.scopePass === true,
    });
    passed = responsePass && exactPass && scopePass;
  }

  journeySuccess.add(passed ? 1 : 0);
  sleep(1 + Math.random() * 0.5);
}

async function installPresenceStub(context) {
  await context.addInitScript(`
    (() => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = function (input, init) {
        const rawUrl = typeof input === 'string' ? input : input && input.url;
        let pathname = '';
        try { pathname = new URL(String(rawUrl || ''), window.location.href).pathname; } catch (_) {}
        if (pathname === '/api/presence/heartbeat') {
          return Promise.resolve(new Response(null, {
            status: 204,
            headers: { 'Cache-Control': 'no-store' },
          }));
        }
        return originalFetch(input, init);
      };
    })();
  `);
}

function warnBrowserFailure(phase, status, cycle) {
  const key = String(phase || 'browser-unknown');
  if (browserFailureWarnings[key]) return;
  browserFailureWarnings[key] = true;
  const safeStatus = Number.isFinite(Number(status)) && Number(status) > 0 ? String(Number(status)) : 'none';
  console.warn(`LT-05 browser check failed: ${key} (cycle=${Number(cycle) || 0}, status=${safeStatus}).`);
}

function recordBrowserFailure(counter, phase, status, cycle) {
  counter.add(1, diagnosticTags(phase, Number(status) || 0));
  warnBrowserFailure(phase, status, cycle);
}

async function navigateAuthenticated(page, path, cycle) {
  let response;
  try {
    response = await page.goto(`${BASE_URL}${path}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
  } catch (_) {
    recordBrowserFailure(browserDiagnosticNetwork, `browser-navigation-${path.slice(1)}`, 0, cycle);
    return 0;
  }
  if (!response) {
    recordBrowserFailure(browserDiagnosticNetwork, `browser-navigation-${path.slice(1)}-null`, 0, cycle);
    return 0;
  }

  let status = 0;
  try { status = Number(response.status()) || 0; } catch (_) { status = 0; }
  let currentUrl = '';
  try { currentUrl = String(page.url() || ''); } catch (_) { currentUrl = ''; }
  if (status === 401 || status === 403 || /\/auth(?:[/?#]|$)/i.test(currentUrl)) {
    recordBrowserFailure(browserDiagnosticAuth, `browser-navigation-${path.slice(1)}-auth`, status, cycle);
    return status;
  }
  if ((status >= 300 && status < 400) || !currentUrl.includes(path)) {
    recordBrowserFailure(browserDiagnosticRedirect, `browser-navigation-${path.slice(1)}-redirect`, status, cycle);
    return status;
  }
  if (status >= 500) {
    recordBrowserFailure(browserDiagnosticServer, `browser-navigation-${path.slice(1)}-server`, status, cycle);
    return status;
  }
  if (status >= 400) {
    recordBrowserFailure(browserDiagnosticClient, `browser-navigation-${path.slice(1)}-client`, status, cycle);
    return status;
  }
  if (status !== 200) {
    recordBrowserFailure(browserDiagnosticOther, `browser-navigation-${path.slice(1)}-status`, status, cycle);
  }
  return status;
}

async function inspectBuildingsSearch(page, target, cycle, captureScreenshot) {
  const status = await navigateAuthenticated(page, '/buildings', cycle);
  if (status !== 200) return false;
  try {
    await page.locator('#bldgSearch').waitFor({ state: 'visible', timeout: 30000 });
    await page.locator('#bldgGrid .bldg-card').first().waitFor({ state: 'visible', timeout: 30000 });
    const initialCount = await page.locator('#bldgGrid .bldg-card').count();
    const startedAt = Date.now();
    await page.locator('#bldgSearch').fill(target.name);
    await page.locator(`#bldgGrid .bldg-card[data-id="${target.id}"]`).waitFor({ state: 'visible', timeout: 10000 });
    browserSearchSettle.add(Date.now() - startedAt);

    const cards = page.locator('#bldgGrid .bldg-card');
    const count = await cards.count();
    const needle = filterNeedle(target.name);
    let exactFound = false;
    let allMatchFilter = count > 0;
    for (let i = 0; i < count; i += 1) {
      const card = cards.nth(i);
      const id = Number(await card.getAttribute('data-id'));
      const name = String(await card.locator('.bldg-card__name').textContent() || '');
      const description = String(await card.locator('.bldg-card__desc').textContent() || '');
      if (id === target.id && canonicalName(name) === canonicalName(target.name)) exactFound = true;
      if (!filterNeedle(name).includes(needle) && !filterNeedle(description).includes(needle)) {
        allMatchFilter = false;
      }
    }
    const countText = String(await page.locator('#bldgCount').textContent() || '');
    const countMatches = countText.startsWith(`${count} building`);
    const passed = initialCount >= MIN_QUERY_COUNT && exactFound && allMatchFilter && countMatches;
    buildingsFilterCorrect.add(passed ? 1 : 0);
    check({ passed }, {
      'Buildings search returns only correct filtered cards': (value) => value.passed === true,
    });
    if (!passed) recordBrowserFailure(browserDiagnosticBuildings, 'browser-buildings-filter', status, cycle);

    if (passed && captureScreenshot && BUILDINGS_SCREENSHOT) {
      await page.screenshot({ path: BUILDINGS_SCREENSHOT, fullPage: true });
    }
    await page.locator('#bldgSearch').fill('');
    const restored = await page.locator('#bldgGrid .bldg-card').count() === initialCount;
    if (!restored) {
      buildingsFilterCorrect.add(0);
      recordBrowserFailure(browserDiagnosticBuildings, 'browser-buildings-clear', status, cycle);
    }
    return passed && restored;
  } catch (_) {
    buildingsFilterCorrect.add(0);
    recordBrowserFailure(browserDiagnosticBuildings, 'browser-buildings-inspection', status, cycle);
    return false;
  }
}

async function visibleMarkerSnapshot(page) {
  const markers = page.locator('.map-building-marker[aria-label], .map-fallback__marker[data-id]');
  const count = await markers.count();
  const identities = [];
  for (let i = 0; i < count; i += 1) {
    const marker = markers.nth(i);
    if (!await marker.isVisible()) continue;
    const label = String(await marker.getAttribute('aria-label') || '');
    const id = String(await marker.getAttribute('data-id') || '');
    const identity = label ? `label:${canonicalName(label)}` : `id:${id}`;
    if (identity !== 'id:') identities.push(identity);
  }
  identities.sort();
  return identities;
}

function sameStringList(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function inspectMapSearch(page, target, cycle, captureScreenshot) {
  const status = await navigateAuthenticated(page, '/map', cycle);
  if (status !== 200) return false;
  try {
    await page.locator('#mapSearchInput').waitFor({ state: 'visible', timeout: 30000 });
    await page.locator(
      '#mapView .maplibregl-canvas, #mapView .leaflet-container, #mapView .map-fallback'
    ).waitFor({ state: 'visible', timeout: 30000 });
    await page.locator(
      '.map-building-marker[aria-label], .map-fallback__marker[data-id]'
    ).first().waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(MAP_SETTLE_MS);
    const markersBefore = await visibleMarkerSnapshot(page);

    const startedAt = Date.now();
    const searchResponsePromise = page.waitForResponse(/\/api\/search\?/, { timeout: 10000 })
      .then((response) => ({ kind: 'response', response }))
      .catch(() => ({ kind: 'missing', response: null }));
    await page.locator('#mapSearchInput').fill(target.name);
    const observedSearch = await searchResponsePromise;
    let searchStatus = 0;
    if (observedSearch.kind === 'response' && observedSearch.response) {
      try { searchStatus = Number(observedSearch.response.status()) || 0; } catch (_) { searchStatus = 0; }
    }
    if (searchStatus !== 200) {
      if (searchStatus === 0) {
        recordBrowserFailure(browserDiagnosticNetwork, 'browser-map-search-network', 0, cycle);
      } else if (searchStatus === 401 || searchStatus === 403) {
        recordBrowserFailure(browserDiagnosticAuth, 'browser-map-search-auth', searchStatus, cycle);
      } else if (searchStatus >= 500) {
        recordBrowserFailure(browserDiagnosticServer, 'browser-map-search-server', searchStatus, cycle);
      } else if (searchStatus >= 400) {
        recordBrowserFailure(browserDiagnosticClient, 'browser-map-search-client', searchStatus, cycle);
      } else if (searchStatus >= 300) {
        recordBrowserFailure(browserDiagnosticRedirect, 'browser-map-search-redirect', searchStatus, cycle);
      } else {
        recordBrowserFailure(browserDiagnosticOther, 'browser-map-search-status', searchStatus, cycle);
      }
      const markersAfterFailure = await visibleMarkerSnapshot(page);
      const markersStillStable = markersBefore.length > 0 && sameStringList(markersBefore, markersAfterFailure);
      mapResultCorrect.add(0);
      markerStability.add(markersStillStable ? 1 : 0);
      recordBrowserFailure(browserDiagnosticMap, 'browser-map-result', searchStatus, cycle);
      if (!markersStillStable) {
        recordBrowserFailure(browserDiagnosticMarkers, 'browser-map-marker-change', searchStatus, cycle);
      }
      return false;
    }
    await page.locator(
      `.map-bldg-item[data-id="${target.id}"] .map-bldg-item__badge--building`
    ).waitFor({ state: 'visible', timeout: 10000 });
    browserSearchSettle.add(Date.now() - startedAt);

    const connectionMessages = page.locator('.map-empty-msg');
    let connectionFailure = false;
    for (let i = 0; i < await connectionMessages.count(); i += 1) {
      const text = String(await connectionMessages.nth(i).textContent() || '');
      if (/Connect to refresh search data/i.test(text)) connectionFailure = true;
    }

    const rows = page.locator('#bldgList .map-bldg-item');
    const rowCount = await rows.count();
    let exactBuildingFound = false;
    let scopedResults = rowCount > 0;
    for (let i = 0; i < rowCount; i += 1) {
      const row = rows.nth(i);
      const routeId = await row.getAttribute('data-route-id');
      if (routeId !== null) {
        const routeText = String(await row.textContent() || '');
        if (!canonicalName(routeText).includes(canonicalName(target.name))) scopedResults = false;
        continue;
      }
      const id = Number(await row.getAttribute('data-id'));
      const name = String(await row.getAttribute('data-name') || '');
      const sameTarget = id === target.id && canonicalName(name) === canonicalName(target.name);
      if (sameTarget) exactBuildingFound = true;
      else scopedResults = false;
    }

    const markersAfter = await visibleMarkerSnapshot(page);
    const markerPass = markersBefore.length > 0 && sameStringList(markersBefore, markersAfter);
    const resultPass = exactBuildingFound && scopedResults && !connectionFailure;
    mapResultCorrect.add(resultPass ? 1 : 0);
    markerStability.add(markerPass ? 1 : 0);
    check({ resultPass, markerPass }, {
      'Campus Map search returns the correct sidebar building entries': (value) => value.resultPass === true,
      'Campus Map search does not change the visible marker set': (value) => value.markerPass === true,
    });
    if (connectionFailure) {
      recordBrowserFailure(browserDiagnosticConnection, 'browser-map-connection-message', status, cycle);
    }
    if (!resultPass) recordBrowserFailure(browserDiagnosticMap, 'browser-map-result', status, cycle);
    if (!markerPass) recordBrowserFailure(browserDiagnosticMarkers, 'browser-map-marker-change', status, cycle);

    if (resultPass && markerPass && captureScreenshot && MAP_SCREENSHOT) {
      await page.screenshot({ path: MAP_SCREENSHOT, fullPage: true });
    }
    await page.locator('#mapSearchInput').fill('');
    return resultPass && markerPass;
  } catch (_) {
    let connectionFailure = false;
    try {
      connectionFailure = /Connect to refresh search data/i.test(
        String(await page.locator('body').textContent() || '')
      );
    } catch (_) { /* fixed diagnostics below remain authoritative */ }
    if (connectionFailure) {
      recordBrowserFailure(browserDiagnosticConnection, 'browser-map-connection-message', status, cycle);
    }
    mapResultCorrect.add(0);
    markerStability.add(0);
    recordBrowserFailure(browserDiagnosticMap, 'browser-map-inspection', status, cycle);
    return false;
  }
}

export async function browserCanary(data) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const screenshots = { buildings: false, map: false };
  const startedAt = Date.now();
  try {
    if (!data || !Array.isArray(data.sessionCookies) || data.sessionCookies.length !== SESSION_POOL_SIZE ||
        !Array.isArray(data.queries) || data.queries.length < MIN_QUERY_COUNT) {
      browserDiagnosticUnexpected.add(1, diagnosticTags('browser-setup-data', 0));
      browserSuccess.add(0);
      check(false, { 'LT-05 browser setup data is available': (value) => value === true });
      return;
    }
    await context.addCookies([{
      name: SESSION_COOKIE_NAME,
      value: String(data.sessionCookies[0] || ''),
      url: `${BASE_URL}/`,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    }]);
    await installPresenceStub(context);

    let cycle = 0;
    while (Date.now() - startedAt < CANARY_DURATION_MS) {
      cycle += 1;
      const cycleStartedAt = Date.now();
      const target = data.queries[(cycle - 1) % data.queries.length];
      const inPeakHold = Date.now() - startedAt >= PEAK_HOLD_START_MS + 15000;
      let buildingsPassed = false;
      let mapPassed = false;
      try {
        buildingsPassed = await inspectBuildingsSearch(page, target, cycle, inPeakHold && !screenshots.buildings);
        if (buildingsPassed && inPeakHold && !screenshots.buildings && BUILDINGS_SCREENSHOT) screenshots.buildings = true;
        mapPassed = await inspectMapSearch(page, target, cycle, inPeakHold && !screenshots.map);
        if (mapPassed && inPeakHold && !screenshots.map && MAP_SCREENSHOT) screenshots.map = true;
      } catch (_) {
        recordBrowserFailure(browserDiagnosticUnexpected, 'browser-canary-cycle', 0, cycle);
      }
      const passed = buildingsPassed && mapPassed;
      browserSuccess.add(passed ? 1 : 0);
      check({ passed }, {
        'LT-05 browser canary completes both search surfaces': (value) => value.passed === true,
      });
      const remaining = CANARY_INTERVAL_MS - (Date.now() - cycleStartedAt);
      if (remaining > 0) await page.waitForTimeout(remaining);
    }
  } finally {
    try { await page.close(); } catch (_) { /* context close remains authoritative */ }
    await context.close();
  }
}

export function teardown(data) {
  const cookies = data && Array.isArray(data.sessionCookies) ? data.sessionCookies : [];
  if (cookies.length !== SESSION_POOL_SIZE) {
    throw new Error('LT-05 teardown did not receive the complete test-session pool.');
  }
  let cleanupFailed = false;
  cookies.forEach((cookie, index) => {
    try {
      logoutSession(String(cookie || ''), `teardown-${index + 1}`);
    } catch (_) {
      cleanupFailed = true;
    }
  });
  if (cleanupFailed) throw new Error('LT-05 could not terminate every test session.');
}

export function handleSummary(data) {
  const safeSummary = { ...data };
  delete safeSummary.setup_data;
  const summaryPath = String(__ENV.K6_SUMMARY_PATH || '').trim();
  if (!summaryPath) return { stdout: JSON.stringify(safeSummary, null, 2) };
  return { [summaryPath]: JSON.stringify(safeSummary, null, 2) };
}
