import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import { Counter, Rate, Trend } from 'k6/metrics';
import { validateRoutePayload, validateScenePage } from './lt-06-route-policy.js';

/*
 * LT-06 measures repeated guided-route playback at a bounded 50-client peak.
 * It validates the route API and every server-rendered scene page in the
 * selected vehicle-entry, walking-entry, and walking-exit sequences. It does
 * not download panorama media; LT-04 owns that CDN delivery measurement.
 */
const BASE_URL = String(__ENV.BASE_URL || '').replace(/\/+$/, '');
const EMAIL = String(__ENV.K6_TEST_EMAIL || '');
const PASSWORD = String(__ENV.K6_TEST_PASSWORD || '');
const EXPECTED_HOST = 'campusphere-cspc.vercel.app';
const SESSION_COOKIE_NAME = '__Host-campusphere.sid';
const SESSION_POOL_SIZE = 4;
const EXPECTED_ROUTE_COUNT = 25;
const EXPECTED_VARIANT_COUNT = EXPECTED_ROUTE_COUNT * 3;
const SCENE_DWELL_SECONDS = 0.5;

if (!/^https:\/\/[a-z0-9.-]+$/i.test(BASE_URL)) {
  throw new Error('BASE_URL must be an HTTPS origin.');
}
const BASE_HOST = BASE_URL.replace(/^https:\/\//i, '').toLowerCase();
if (BASE_HOST !== EXPECTED_HOST) {
  throw new Error(`LT-06 refuses a non-Production host: ${BASE_HOST}`);
}
if (!EMAIL || !PASSWORD) {
  throw new Error('K6_TEST_EMAIL and K6_TEST_PASSWORD are required.');
}

const journeySuccess = new Rate('lt06_journey_success');
const routeApiCorrect = new Rate('lt06_route_api_correct');
const sequenceCorrect = new Rate('lt06_sequence_consistent');
const scenePageCorrect = new Rate('lt06_scene_page_correct');
const completionCorrect = new Rate('lt06_route_completion_correct');
const playbackDuration = new Trend('lt06_playback_duration_ms');
const apiDuration = new Trend('lt06_route_api_duration_ms');
const scenePageDuration = new Trend('lt06_scene_page_duration_ms');
const sceneCount = new Trend('lt06_scene_count');
const scenePages = new Counter('lt06_scene_pages');
const playbacksCompleted = new Counter('lt06_playbacks_completed');
const http5xx = new Rate('lt06_http_5xx');
const rateLimited = new Rate('lt06_rate_limited');

const setupRouteResponses = new Counter('lt06_setup_route_responses');
const setupVariantCandidates = new Counter('lt06_setup_variant_candidates');
const setupVariantsSelected = new Counter('lt06_setup_variants_selected');
const setupInvalidResponses = new Counter('lt06_setup_invalid_responses');
const setupScenes = new Counter('lt06_setup_scenes');

const diagnosticAuth = new Counter('lt06_diag_auth_responses');
const diagnosticRedirect = new Counter('lt06_diag_redirect_responses');
const diagnosticNetwork = new Counter('lt06_diag_network_errors');
const diagnosticClient = new Counter('lt06_diag_other_client_errors');
const diagnosticServer = new Counter('lt06_diag_server_errors');
const diagnosticOther = new Counter('lt06_diag_other_responses');
const diagnosticInvalidRoute = new Counter('lt06_diag_invalid_route_response');
const diagnosticSequence = new Counter('lt06_diag_sequence_mismatch');
const diagnosticScenePage = new Counter('lt06_diag_scene_page_mismatch');
const diagnosticCompletion = new Counter('lt06_diag_completion_mismatch');

export const options = {
  setupTimeout: '3m',
  maxRedirects: 0,
  // Do not retain route IDs, scene keys, or query-bearing URLs as metric tags.
  systemTags: ['status', 'method', 'name', 'proto', 'scenario', 'expected_response'],
  scenarios: {
    route_playback: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '30s', target: 25 },
        { duration: '1m', target: 50 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '90s',
      gracefulStop: '30s',
      exec: 'routePlayback',
    },
  },
  thresholds: {
    checks: [{ threshold: 'rate==1.0', abortOnFail: true, delayAbortEval: '30s' }],
    lt06_journey_success: [{ threshold: 'rate==1.0', abortOnFail: true, delayAbortEval: '30s' }],
    lt06_route_api_correct: ['rate==1.0'],
    lt06_sequence_consistent: ['rate==1.0'],
    lt06_scene_page_correct: ['rate==1.0'],
    lt06_route_completion_correct: ['rate==1.0'],
    lt06_playbacks_completed: ['count>=150'],
    lt06_route_api_duration_ms: ['p(95)<3000', 'p(99)<8000'],
    lt06_scene_page_duration_ms: ['p(95)<3000', 'p(99)<8000'],
    lt06_http_5xx: [{ threshold: 'rate==0.0', abortOnFail: true, delayAbortEval: '30s' }],
    lt06_rate_limited: [{ threshold: 'rate==0.0', abortOnFail: true, delayAbortEval: '30s' }],
    http_req_failed: ['rate==0.0'],
  },
};

function setupFailure(stage, reason) {
  return new Error(`LT-06 setup stage ${stage} failed (${reason}).`);
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

function jsonOrNull(response) {
  try {
    return response ? response.json() : null;
  } catch (_) {
    return null;
  }
}

function requestOptions(cookie, phase, sessionSlot = null) {
  const tags = { test_case: 'LT-06', phase, name: `GET ${phase}` };
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
      redirects: 0,
      timeout: '30s',
      headers: { Accept: 'text/html' },
      tags: { test_case: 'LT-06', phase: 'setup-auth-page', name: 'GET /auth' },
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
    tags: { test_case: 'LT-06', phase: 'setup-login', name: 'POST /login' },
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

function validateOriginalSession(session, index) {
  const response = http.get(`${BASE_URL}/api/routes`, {
    jar: session.jar,
    redirects: 0,
    timeout: '30s',
    headers: { Accept: 'application/json' },
    tags: {
      test_case: 'LT-06',
      phase: 'setup-original-session',
      session_slot: String(index + 1),
      name: 'GET /api/routes',
    },
  });
  requireSetupResponse(response, [200], `original-session-${index + 1}`);
}

function validateSessionHandoff(session, index) {
  const options = requestOptions(session.cookie, 'setup-session-handoff', index + 1);
  options.tags.name = 'GET /api/routes';
  const response = http.get(`${BASE_URL}/api/routes`, options);
  requireSetupResponse(response, [200], `session-handoff-${index + 1}`);
}

function logoutSession(cookie, phase, existingJar = null) {
  const csrfParams = existingJar
    ? {
      jar: existingJar,
      timeout: '30s',
      headers: { Accept: 'application/json' },
      tags: { test_case: 'LT-06', phase: `${phase}-csrf`, name: 'GET /auth/csrf-token' },
    }
    : requestOptions(cookie, `${phase}-csrf`);
  csrfParams.headers.Accept = 'application/json';
  const csrfResponse = http.get(`${BASE_URL}/auth/csrf-token`, csrfParams);
  if (!csrfResponse || csrfResponse.status !== 200) {
    throw new Error('LT-06 session cleanup could not obtain the authenticated request token.');
  }
  const body = jsonOrNull(csrfResponse);
  const csrfToken = body && body.success === true ? String(body.csrfToken || '') : '';
  if (!csrfToken) throw new Error('LT-06 session cleanup received an invalid request token.');

  const logoutParams = existingJar
    ? {
      jar: existingJar,
      redirects: 0,
      timeout: '30s',
      headers: { Accept: 'application/json', 'X-CSRF-Token': csrfToken },
      tags: { test_case: 'LT-06', phase: `${phase}-logout`, name: 'POST /logout' },
    }
    : requestOptions(cookie, `${phase}-logout`);
  logoutParams.redirects = 0;
  logoutParams.headers.Accept = 'application/json';
  logoutParams.headers['X-CSRF-Token'] = csrfToken;
  logoutParams.tags.name = 'POST /logout';
  const logoutResponse = http.post(`${BASE_URL}/logout`, null, logoutParams);
  if (!logoutResponse || logoutResponse.status !== 200) {
    throw new Error('LT-06 session cleanup could not terminate the test session.');
  }
}

function cleanupPartialSessions(sessions) {
  for (const session of sessions) {
    try {
      logoutSession(session.cookie, 'setup-cleanup', session.jar);
    } catch (_) {
      console.error('LT-06 setup cleanup encountered a session-termination error.');
    }
  }
}

function catalogRoutes(session) {
  const response = http.get(`${BASE_URL}/api/routes`, {
    jar: session.jar,
    redirects: 0,
    timeout: '30s',
    headers: { Accept: 'application/json' },
    tags: { test_case: 'LT-06', phase: 'setup-route-catalog', name: 'GET /api/routes' },
  });
  requireSetupResponse(response, [200], 'route-catalog');
  const payload = jsonOrNull(response);
  if (!payload || payload.success !== true || !Array.isArray(payload.routes)) {
    throw setupFailure('route-catalog', 'body-invalid');
  }
  const routes = payload.routes.map((route) => ({
    id: Number(route && route.id),
  })).sort((a, b) => a.id - b.id);
  if (routes.length !== EXPECTED_ROUTE_COUNT || routes.some((route) => !Number.isSafeInteger(route.id) || route.id <= 0)) {
    throw setupFailure('route-catalog', 'route-count-or-id-invalid');
  }
  if (new Set(routes.map((route) => route.id)).size !== routes.length) {
    throw setupFailure('route-catalog', 'duplicate-route-id');
  }
  return routes;
}

function preflightVariants(session, routes) {
  const variants = [];
  const modes = [
    { mode: 'vehicle', direction: 'entry' },
    { mode: 'walking', direction: 'entry' },
    { mode: 'walking', direction: 'exit' },
  ];
  for (const route of routes) {
    for (const variant of modes) {
      setupVariantCandidates.add(1);
      const response = http.get(
        `${BASE_URL}/api/vr/routes/${route.id}?mode=${variant.mode}&direction=${variant.direction}`,
        {
          jar: session.jar,
          redirects: 0,
          timeout: '30s',
          headers: { Accept: 'application/json' },
          tags: { test_case: 'LT-06', phase: 'setup-route-preflight', name: 'GET /api/vr/routes/:id' },
        }
      );
      setupRouteResponses.add(response && response.status === 200 ? 1 : 0);
      requireSetupResponse(response, [200], 'route-preflight');
      const decision = validateRoutePayload(route.id, variant.mode, variant.direction, jsonOrNull(response));
      if (!decision.accepted) {
        setupInvalidResponses.add(1);
        throw setupFailure('route-preflight', 'invalid-route-sequence');
      }
      setupVariantsSelected.add(1);
      setupScenes.add(decision.sceneCount);
      variants.push({
        slot: variants.length,
        routeId: decision.routeId,
        mode: decision.mode,
        direction: decision.direction,
        pathKeys: decision.pathKeys,
        sceneKeys: decision.sceneKeys,
        sceneTitles: decision.sceneTitles,
        sceneCount: decision.sceneCount,
      });
      sleep(0.2);
    }
  }
  if (variants.length !== EXPECTED_VARIANT_COUNT) {
    throw setupFailure('route-preflight', 'variant-count-invalid');
  }
  console.log(`LT-06 route preflight complete; routes=${routes.length}, variants=${variants.length}, scene_sequences=${variants.length}.`);
  return variants;
}

export function setup() {
  const sessions = [];
  try {
    for (let i = 0; i < SESSION_POOL_SIZE; i += 1) sessions.push(setupLogin(i));
    sessions.forEach((session, index) => validateSessionHandoff(session, index));
    const routes = catalogRoutes(sessions[0]);
    const variants = preflightVariants(sessions[0], routes);
    console.log(`LT-06 setup complete; ${variants.length} supported route playback variants selected.`);
    return {
      sessionCookies: sessions.map((session) => session.cookie),
      variants,
    };
  } catch (error) {
    cleanupPartialSessions(sessions);
    const safeMessage = error && typeof error.message === 'string' && error.message.indexOf('LT-06 setup stage ') === 0
      ? error.message
      : 'LT-06 setup stage failed (unexpected).';
    console.error(safeMessage);
    throw new Error('LT-06 setup failed; no route playback workload was started.');
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

function recordResponse(response, expectedStatus, phase, durationMetric = null) {
  const status = responseStatus(response);
  const duration = response && response.timings && Number(response.timings.duration);
  if (durationMetric && Number.isFinite(duration)) durationMetric.add(duration);
  classifyHttpResponse(status, phase, expectedStatus);
  http5xx.add(status >= 500 ? 1 : 0);
  rateLimited.add(status === 429 ? 1 : 0);
  return status === expectedStatus;
}

function sameArray(left, right) {
  return Array.isArray(left) && Array.isArray(right) &&
    left.length === right.length && left.every((value, index) => value === right[index]);
}

function scenarioIteration() {
  try {
    const value = Number(exec.scenario.iterationInTest);
    if (Number.isSafeInteger(value) && value >= 0) return value;
  } catch (_) { /* fallback below */ }
  return Math.max(0, (Number(__ITER) || 0) * 50 + (Number(__VU) || 1) - 1);
}

function routeApiUrl(variant) {
  return `${BASE_URL}/api/vr/routes/${variant.routeId}?mode=${encodeURIComponent(variant.mode)}&direction=${encodeURIComponent(variant.direction)}`;
}

function routePageUrl(variant, step) {
  return `${BASE_URL}/vr/routes/${variant.routeId}?mode=${encodeURIComponent(variant.mode)}&direction=${encodeURIComponent(variant.direction)}&step=${step}`;
}

export function routePlayback(data) {
  if (!data || !Array.isArray(data.sessionCookies) || data.sessionCookies.length !== SESSION_POOL_SIZE ||
      !Array.isArray(data.variants) || data.variants.length !== EXPECTED_VARIANT_COUNT) {
    journeySuccess.add(0);
    check(false, { 'LT-06 setup data is available': (value) => value === true });
    return;
  }

  const sessionSlot = (Math.max(1, Number(__VU) || 1) - 1) % SESSION_POOL_SIZE;
  const cookie = data.sessionCookies[sessionSlot];
  const variant = data.variants[scenarioIteration() % data.variants.length];
  const startedAt = Date.now();
  const apiOptions = requestOptions(cookie, 'workload-route-api', sessionSlot + 1);
  apiOptions.tags.name = 'GET /api/vr/routes/:id';
  const apiResponse = http.get(routeApiUrl(variant), apiOptions);
  const apiStatusOk = recordResponse(apiResponse, 200, 'workload-route-api', apiDuration);
  const apiPayload = apiStatusOk ? jsonOrNull(apiResponse) : null;
  const apiDecision = validateRoutePayload(variant.routeId, variant.mode, variant.direction, apiPayload);
  const apiPass = apiStatusOk && apiDecision.accepted;
  const sequencePass = apiPass && sameArray(apiDecision.pathKeys, variant.pathKeys) &&
    sameArray(apiDecision.sceneKeys, variant.sceneKeys) && apiDecision.sceneCount === variant.sceneCount;
  routeApiCorrect.add(apiPass ? 1 : 0);
  sequenceCorrect.add(sequencePass ? 1 : 0);
  sceneCount.add(apiDecision.sceneCount || 0);
  if (!apiPass) diagnosticInvalidRoute.add(1, diagnosticTags('workload-route-api-body', 200));
  if (apiPass && !sequencePass) diagnosticSequence.add(1, diagnosticTags('workload-route-sequence', 200));
  check({ apiPass, sequencePass }, {
    'VR route API returns a complete supported route': (value) => value.apiPass === true,
    'VR route sequence matches the preflight sequence': (value) => value.sequencePass === true,
  });

  let pagesPass = Boolean(apiPass && sequencePass);
  if (apiPass && sequencePass) {
    for (let step = 1; step <= variant.sceneCount; step += 1) {
      const pageOptions = requestOptions(cookie, 'workload-route-scene', sessionSlot + 1);
      pageOptions.tags.name = 'GET /vr/routes/:id';
      const pageResponse = http.get(routePageUrl(variant, step), pageOptions);
      const pageStatusOk = recordResponse(pageResponse, 200, 'workload-route-scene', scenePageDuration);
      scenePages.add(1);
      const pageDecision = pageStatusOk
        ? validateScenePage(String(pageResponse.body || ''), variant, step, variant.mode, variant.direction)
        : { accepted: false };
      const pagePass = pageStatusOk && pageDecision.accepted;
      scenePageCorrect.add(pagePass ? 1 : 0);
      check({ pagePass }, {
        'VR scene page contains the expected ordered scene': (value) => value.pagePass === true,
      });
      if (!pagePass) {
        pagesPass = false;
        diagnosticScenePage.add(1, diagnosticTags('workload-route-scene-page', responseStatus(pageResponse)));
      }
      sleep(SCENE_DWELL_SECONDS);
    }
  } else {
    scenePageCorrect.add(0);
  }

  const playbackPass = apiPass && sequencePass && pagesPass;
  completionCorrect.add(playbackPass ? 1 : 0);
  if (!playbackPass) diagnosticCompletion.add(1, diagnosticTags('workload-route-completion', 0));
  playbackDuration.add(Date.now() - startedAt);
  if (playbackPass) playbacksCompleted.add(1);
  check({ playbackPass }, {
    'VR route playback completes without dropped scenes': (value) => value.playbackPass === true,
  });
  journeySuccess.add(playbackPass ? 1 : 0);
}

export function teardown(data) {
  const cookies = data && Array.isArray(data.sessionCookies) ? data.sessionCookies : [];
  if (cookies.length !== SESSION_POOL_SIZE) {
    throw new Error('LT-06 teardown did not receive the complete test-session pool.');
  }
  let cleanupFailed = false;
  cookies.forEach((cookie, index) => {
    try {
      logoutSession(String(cookie || ''), `teardown-${index + 1}`);
    } catch (_) {
      cleanupFailed = true;
    }
  });
  if (cleanupFailed) throw new Error('LT-06 could not terminate every test session.');
}

export function handleSummary(data) {
  const safeSummary = { ...data };
  delete safeSummary.setup_data;
  const summaryPath = String(__ENV.K6_SUMMARY_PATH || '').trim();
  if (!summaryPath) return { stdout: JSON.stringify(safeSummary, null, 2) };
  return { [summaryPath]: JSON.stringify(safeSummary, null, 2) };
}
