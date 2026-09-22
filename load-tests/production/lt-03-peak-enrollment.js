import http from 'k6/http';
import { browser } from 'k6/browser';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

/*
 * LT-03 measures a 200-client peak without launching 200 local browsers.
 * 199 HTTP users exercise the authenticated map read paths while one real
 * browser canary continuously verifies the rendered map during the peak.
 * Four temporary sessions distribute session-store touches without creating
 * an authentication storm or a single hot session row.
 *
 * The map's advisory presence heartbeat is fulfilled locally by the browser
 * canary. No presence, route, profile, admin, offline, or VR mutation is sent
 * to Production by this test.
 */
const BASE_URL = String(__ENV.BASE_URL || '').replace(/\/+$/, '');
const EMAIL = String(__ENV.K6_TEST_EMAIL || '');
const PASSWORD = String(__ENV.K6_TEST_PASSWORD || '');
const PAGE_SCREENSHOT = String(__ENV.K6_PAGE_SCREENSHOT_PATH || '');
const EXPECTED_HOST = 'campusphere-cspc.vercel.app';
const SESSION_COOKIE_NAME = '__Host-campusphere.sid';
const SESSION_POOL_SIZE = 4;
const HTTP_PEAK_VUS = 199;
const CANARY_DURATION_MS = 14 * 60 * 1000;
const PEAK_HOLD_START_MS = (1 + 2 + 2 + 2 + 2) * 60 * 1000;
const CANARY_INTERVAL_MS = 30 * 1000;
const CANARY_SETTLE_MS = 3000;
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
const BASE_HOST = BASE_URL.replace(/^https:\/\//i, '').toLowerCase();
if (BASE_HOST !== EXPECTED_HOST) {
  throw new Error(`LT-03 refuses a non-Production host: ${BASE_HOST}`);
}
if (!EMAIL || !PASSWORD) {
  throw new Error('K6_TEST_EMAIL and K6_TEST_PASSWORD are required.');
}

const journeySuccess = new Rate('lt03_journey_success');
const dynamicDuration = new Trend('lt03_dynamic_duration_ms');
const mapReadyMs = new Trend('lt03_browser_map_ready_ms');
const browserSuccess = new Rate('lt03_browser_success');
const server5xx = new Rate('lt03_http_5xx');
const rateLimited = new Rate('lt03_rate_limited');
const healthSuccess = new Rate('lt03_health_success');
// Safe failure classification for a failed run. Tags contain only fixed phase
// names and numeric status classes; no URL, cookie, token, body, or credential
// value is recorded. The counters make a short/aborted run diagnosable from
// summary.json instead of leaving only the aggregate http_req_failed metric.
const diagnosticAuth = new Counter('lt03_diag_auth_responses');
const diagnosticRedirect = new Counter('lt03_diag_redirect_responses');
const diagnosticNetwork = new Counter('lt03_diag_network_errors');
const diagnosticClient = new Counter('lt03_diag_other_client_errors');
const diagnosticServer = new Counter('lt03_diag_server_errors');
const diagnosticOther = new Counter('lt03_diag_other_responses');
const browserDiagnosticAuth = new Counter('lt03_diag_browser_auth');
const browserDiagnosticRedirect = new Counter('lt03_diag_browser_redirect');
const browserDiagnosticNavigationResponse = new Counter('lt03_diag_browser_navigation_response');
const browserDiagnosticNavigationNullRecovered = new Counter('lt03_diag_browser_navigation_null_recovered');
const browserDiagnosticNavigationNull = new Counter('lt03_diag_browser_navigation_null');
const browserDiagnosticNavigationThrow = new Counter('lt03_diag_browser_navigation_throw');
const browserDiagnosticClient = new Counter('lt03_diag_browser_client_status');
const browserDiagnosticServer = new Counter('lt03_diag_browser_server_status');
const browserDiagnosticOther = new Counter('lt03_diag_browser_other_status');
const browserDiagnosticRender = new Counter('lt03_diag_browser_render');
const browserDiagnosticWaitMapContainer = new Counter('lt03_diag_browser_wait_map_container');
const browserDiagnosticWaitMapSurface = new Counter('lt03_diag_browser_wait_map_surface');
const browserDiagnosticWaitStartLabel = new Counter('lt03_diag_browser_wait_start_label');
const browserDiagnosticCheckUrl = new Counter('lt03_diag_browser_check_url');
const browserDiagnosticCheckStatus = new Counter('lt03_diag_browser_check_status');
const browserDiagnosticCheckSurface = new Counter('lt03_diag_browser_check_surface');
const browserDiagnosticCheckStartLabel = new Counter('lt03_diag_browser_check_start_label');
const browserDiagnosticCheckBuildingLabels = new Counter('lt03_diag_browser_check_building_labels');
const browserDiagnosticCheckRouteControls = new Counter('lt03_diag_browser_check_route_controls');
const browserDiagnosticUnexpected = new Counter('lt03_diag_browser_unexpected');

const browserFailureWarnings = Object.create(null);

export const options = {
  scenarios: {
    http_peak: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 },
        { duration: '2m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '2m', target: 150 },
        { duration: '2m', target: HTTP_PEAK_VUS },
        { duration: '3m', target: HTTP_PEAK_VUS },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
      gracefulStop: '30s',
      exec: 'httpPeak',
    },
    browser_canary: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '16m',
      gracefulStop: '30s',
      options: { browser: { type: 'chromium' } },
      exec: 'browserCanary',
    },
  },
  thresholds: {
    checks: [{ threshold: 'rate>=0.99', abortOnFail: true, delayAbortEval: '1m' }],
    lt03_journey_success: [{ threshold: 'rate>=0.99', abortOnFail: true, delayAbortEval: '1m' }],
    lt03_dynamic_duration_ms: ['p(95)<3000', 'p(99)<8000'],
    lt03_http_5xx: [{ threshold: 'rate==0.0', abortOnFail: true, delayAbortEval: '30s' }],
    lt03_rate_limited: [{ threshold: 'rate==0.0', abortOnFail: true, delayAbortEval: '30s' }],
    lt03_health_success: ['rate==1.0'],
    lt03_browser_success: ['rate==1.0'],
    lt03_browser_map_ready_ms: ['p(95)<15000'],
    browser_web_vital_lcp: ['p(95)<5000'],
    browser_http_req_failed: ['rate==0.0'],
    http_req_failed: ['rate<0.01'],
  },
};

function setupFailure(stage, reason) {
  return new Error(`LT-03 setup stage ${stage} failed (${reason}).`);
}

function requireSetupResponse(response, description, expectedStatuses, stage) {
  const allowed = new Set(expectedStatuses);
  if (!response) {
    throw setupFailure(stage, 'network');
  }
  if (!allowed.has(response.status)) {
    if (response && response.status === 429) {
      throw setupFailure(stage, 'rate-limited');
    }
    throw setupFailure(stage, `status-${response.status}`);
  }
}

function sessionCookieFromJar(jar, stage) {
  const jarCookies = jar.cookiesForURL(`${BASE_URL}/`);
  const jarValues = jarCookies && jarCookies[SESSION_COOKIE_NAME];
  const value = Array.isArray(jarValues) && jarValues.length > 0
    ? jarValues[jarValues.length - 1]
    : '';
  if (!value) throw setupFailure(stage, 'session-cookie-missing');
  return String(value);
}

function csrfTokenFromAuthPage(response) {
  if (!response) return '';

  // k6's HTML selector is the normal path. The meta token is rendered by the
  // shared head partial and is a safe fallback if a transient response omits
  // or reshapes the login form markup. A bounded raw-HTML fallback keeps this
  // harness independent of parser quirks without logging the token itself.
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

function setupLogin(index) {
  // http.cookieJar() returns the current VU's default jar. A new local jar is
  // required here: each login regenerates and persists a distinct session.
  const jar = new http.CookieJar();
  let csrfToken = '';
  for (let attempt = 0; attempt < 3 && !csrfToken; attempt += 1) {
    const authPage = http.get(`${BASE_URL}/auth`, {
      jar,
      tags: { test_case: 'LT-03', phase: 'setup-auth-page', session_slot: String(index + 1) },
    });
    requireSetupResponse(authPage, 'open the authentication page', [200], 'auth-page');
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
    headers: {
      Accept: 'text/html',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    tags: { test_case: 'LT-03', phase: 'setup-login', session_slot: String(index + 1) },
  });
  requireSetupResponse(loginResponse, 'authenticate the dedicated guest account', [302], 'login');
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
      headers: { Accept: 'application/json' },
      tags: { test_case: 'LT-03', phase: `${phase}-csrf` },
    }
    : requestOptions(cookie, `${phase}-csrf`);
  csrfParams.headers.Accept = 'application/json';
  const csrfResponse = http.get(`${BASE_URL}/auth/csrf-token`, csrfParams);
  if (!csrfResponse || csrfResponse.status !== 200) {
    throw new Error('LT-03 session cleanup could not obtain the authenticated request token.');
  }
  const body = csrfResponse.json();
  const csrfToken = body && body.success === true ? String(body.csrfToken || '') : '';
  if (!csrfToken) throw new Error('LT-03 session cleanup received an invalid request token.');

  const logoutParams = existingJar
    ? {
      jar: existingJar,
      redirects: 0,
      headers: {
        Accept: 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      tags: { test_case: 'LT-03', phase: `${phase}-logout` },
    }
    : requestOptions(cookie, `${phase}-logout`);
  logoutParams.redirects = 0;
  logoutParams.headers.Accept = 'application/json';
  logoutParams.headers['X-CSRF-Token'] = csrfToken;
  const logoutResponse = http.post(`${BASE_URL}/logout`, null, logoutParams);
  if (!logoutResponse || logoutResponse.status !== 200) {
    throw new Error('LT-03 session cleanup could not terminate the test session.');
  }
}

function cleanupPartialSessions(sessions) {
  for (const session of sessions) {
    try {
      // If handoff validation fails, the copied cookie may be the defect. Use
      // the original authenticated jar so setup cleanup still terminates the
      // temporary session and does not leave a Production session behind.
      logoutSession(session.cookie, 'setup-cleanup', session.jar);
    } catch (_) {
      console.error('LT-03 setup cleanup encountered a session-termination error.');
    }
  }
}

function liveDestinationIds(session) {
  const response = http.get(`${BASE_URL}/api/routes`, {
    jar: session.jar,
    redirects: 0,
    headers: { Accept: 'application/json' },
    tags: { test_case: 'LT-03', phase: 'setup-route-catalog' },
  });
  requireSetupResponse(response, 'read the route catalog', [200], 'route-catalog');
  const body = response.json();
  if (!body || body.success !== true || !Array.isArray(body.routes)) {
    throw setupFailure('route-catalog', 'body-invalid');
  }
  const routes = body.routes;
  const ids = Array.from(new Set(routes
    .map((route) => {
      const directId = route && route.destination_building_id;
      const nestedId = route && route.destination && route.destination.id;
      return Number(directId != null ? directId : nestedId);
    })
    .filter((id) => Number.isSafeInteger(id) && id > 0)));
  if (ids.length === 0) throw setupFailure('route-catalog', 'destinations-empty');
  return ids;
}

function validateOriginalSession(session, index) {
  const response = http.get(`${BASE_URL}/api/routes`, {
    jar: session.jar,
    redirects: 0,
    headers: { Accept: 'application/json' },
    tags: {
      test_case: 'LT-03',
      phase: 'setup-original-session',
      session_slot: String(index + 1),
    },
  });
  requireSetupResponse(
    response,
    'validate the original authenticated session',
    [200],
    `original-session-${index + 1}`
  );
}

// setup() receives the original jar for each login, but the peak scenarios
// intentionally run with fresh VUs/contexts. Verify that each copied cookie
// still authenticates before starting any ramp traffic. The response is used
// only for a fixed status classification; no body, cookie, or credential is
// logged or returned in setup data.
function validateSessionHandoff(session, index) {
  const response = http.get(
    `${BASE_URL}/api/routes`,
    requestOptions(session.cookie, 'setup-session-handoff', index + 1)
  );
  requireSetupResponse(
    response,
    'validate the copied authenticated session',
    [200],
    `session-handoff-${index + 1}`
  );
}

function validateSessionHandoffs(sessions) {
  sessions.forEach((session, index) => validateSessionHandoff(session, index));
}

/* Authenticate four times, then use one authenticated read to discover valid
   pathfinding destination ids. Setup data is removed from the k6 summary. */
export function setup() {
  const sessions = [];
  try {
    for (let i = 0; i < SESSION_POOL_SIZE; i += 1) {
      sessions.push(setupLogin(i));
    }
    sessions.forEach((session, index) => validateOriginalSession(session, index));
    validateSessionHandoffs(sessions);
    const routeDestinationIds = liveDestinationIds(sessions[0]);
    console.log('LT-03 setup complete; peak workload may begin.');
    return {
      sessionCookies: sessions.map((session) => session.cookie),
      routeDestinationIds,
    };
  } catch (error) {
    cleanupPartialSessions(sessions);
    const safeMessage = error && typeof error.message === 'string' && error.message.indexOf('LT-03 setup stage ') === 0
      ? error.message
      : 'LT-03 setup stage failed (unexpected).';
    console.error(safeMessage);
    throw new Error('LT-03 setup failed; no peak workload was started.');
  }
}

function httpSessionIndex(vu) {
  // The browser canary uses slot 0, so its 49 HTTP companions keep that slot
  // at 50 total clients; the other slots each receive 50 HTTP clients.
  if (vu <= 49) return 0;
  if (vu <= 99) return 1;
  if (vu <= 149) return 2;
  return 3;
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
  if (status === 0) {
    diagnosticNetwork.add(1, tags);
  } else if (status === 401 || status === 403) {
    diagnosticAuth.add(1, tags);
  } else if (status >= 300 && status < 400) {
    diagnosticRedirect.add(1, tags);
  } else if (status >= 500) {
    diagnosticServer.add(1, tags);
  } else if (status >= 400) {
    diagnosticClient.add(1, tags);
  } else {
    diagnosticOther.add(1, tags);
  }
}

function browserStatus(status) {
  return Number.isFinite(Number(status)) ? Number(status) : 0;
}

function browserStatusLabel(status) {
  const safeStatus = browserStatus(status);
  return safeStatus > 0 ? String(safeStatus) : 'none';
}

function warnBrowserFailure(checkName, status, cycle, navigationMethod = '') {
  const name = String(checkName || 'unknown');
  const method = String(navigationMethod || '');
  if (browserFailureWarnings[name]) return;
  browserFailureWarnings[name] = true;
  const methodSuffix = method ? `, method=${method}` : '';
  console.warn(
    `LT-03 browser check failed: ${name} (cycle=${Number(cycle) || 0}, status=${browserStatusLabel(status)}${methodSuffix}).`
  );
}

function recordBrowserDiagnostic(counter, checkName, status, cycle, navigationMethod = '') {
  const tags = diagnosticTags(checkName, browserStatus(status));
  if (navigationMethod) tags.navigation_method = String(navigationMethod);
  counter.add(1, tags);
  warnBrowserFailure(checkName, status, cycle, navigationMethod);
}

function browserNavigationTags(outcome, status, navigationMethod) {
  return {
    phase: `browser-navigation-${String(outcome || 'unknown')}`,
    navigation_method: String(navigationMethod || 'unknown'),
    status: browserStatusLabel(status),
  };
}

function recordBrowserNavigationOutcome(counter, outcome, status, cycle, navigationMethod) {
  const name = `browser-navigation-${String(outcome || 'unknown')}`;
  counter.add(1, browserNavigationTags(outcome, status, navigationMethod));
  warnBrowserFailure(name, status, cycle, navigationMethod);
}

function recordBrowserNavigationRecovery(counter, outcome, status, navigationMethod) {
  counter.add(1, browserNavigationTags(outcome, status, navigationMethod));
}

function classifyBrowserNavigation(status, pageUrl, cycle, navigationMethod) {
  const safeStatus = browserStatus(status);
  const url = String(pageUrl || '');
  const reachedMap = /\/map(?:[/?#]|$)/i.test(url);

  if (safeStatus === 0) {
    recordBrowserDiagnostic(
      browserDiagnosticUnexpected,
      'browser-navigation-status-unavailable',
      safeStatus,
      cycle,
      navigationMethod
    );
    return false;
  }
  if (safeStatus === 401 || safeStatus === 403 || /\/auth(?:[/?#]|$)/i.test(url)) {
    recordBrowserDiagnostic(
      browserDiagnosticAuth,
      'browser-navigation-auth',
      safeStatus,
      cycle,
      navigationMethod
    );
    return false;
  }
  if (safeStatus >= 500) {
    recordBrowserDiagnostic(
      browserDiagnosticServer,
      'browser-navigation-server',
      safeStatus,
      cycle,
      navigationMethod
    );
    return false;
  }
  if (safeStatus >= 400) {
    recordBrowserDiagnostic(
      browserDiagnosticClient,
      'browser-navigation-client',
      safeStatus,
      cycle,
      navigationMethod
    );
    return false;
  }
  if ((safeStatus >= 300 && safeStatus < 400) || !reachedMap) {
    recordBrowserDiagnostic(
      browserDiagnosticRedirect,
      'browser-navigation-redirect',
      safeStatus,
      cycle,
      navigationMethod
    );
    return false;
  }
  if (safeStatus !== 200) {
    recordBrowserDiagnostic(
      browserDiagnosticOther,
      'browser-navigation-status',
      safeStatus,
      cycle,
      navigationMethod
    );
    return false;
  }
  return true;
}

async function waitForBrowserSelector(page, selector, counter, checkName, status, cycle) {
  try {
    await page.locator(selector).waitFor({ state: 'visible', timeout: 30000 });
    return true;
  } catch (_) {
    recordBrowserDiagnostic(counter, checkName, status, cycle);
    browserDiagnosticRender.add(1, diagnosticTags(checkName, browserStatus(status)));
    return false;
  }
}

function recordResponse(response, expectedStatus, phase) {
  const status = responseStatus(response);
  if (response && response.timings && Number.isFinite(Number(response.timings.duration))) {
    dynamicDuration.add(Number(response.timings.duration));
  }
  classifyHttpResponse(status, phase, expectedStatus);
  server5xx.add(status >= 500 ? 1 : 0);
  rateLimited.add(status === 429 ? 1 : 0);
  return status === expectedStatus;
}

function requestOptions(cookie, phase, sessionSlot = null) {
  const tags = { test_case: 'LT-03', phase };
  if (sessionSlot !== null) tags.session_slot = String(sessionSlot);
  return {
    // Use a request-scoped cookie so each VU receives only its assigned
    // session. It is not added to a shared jar or exposed in evidence.
    cookies: {
      [SESSION_COOKIE_NAME]: {
        value: String(cookie || ''),
        replace: true,
      },
    },
    headers: {
      Accept: 'text/html,application/json',
    },
    // Keep redirects visible to the diagnostic classifier. An unauthenticated
    // /map request otherwise follows 302 -> /auth and looks like a false 200.
    redirects: 0,
    tags,
  };
}

let vuCookie = null;
let mapLoaded = false;

export function httpPeak(data) {
  if (!data || !Array.isArray(data.sessionCookies) || data.sessionCookies.length !== SESSION_POOL_SIZE) {
    journeySuccess.add(0);
    return;
  }

  if (!vuCookie) vuCookie = data.sessionCookies[httpSessionIndex(__VU)];

  let passed = true;
  if (!mapLoaded) {
    const mapResponse = http.get(`${BASE_URL}/map`, requestOptions(vuCookie, 'workload-map'));
    passed = recordResponse(mapResponse, 200, 'workload-map');
    mapLoaded = passed;
  }

  if (passed) {
    const choice = (__VU + __ITER) % 10;
    let actionResponse;
    if (choice < 4) {
      const term = SEARCH_TERMS[(__VU + __ITER) % SEARCH_TERMS.length];
      actionResponse = http.get(
        `${BASE_URL}/api/search?q=${encodeURIComponent(term)}`,
        requestOptions(vuCookie, 'workload-search')
      );
    } else if (choice < 7) {
      actionResponse = http.get(`${BASE_URL}/api/routes`, requestOptions(vuCookie, 'workload-routes'));
    } else {
      const ids = data.routeDestinationIds;
      const destinationId = ids[(__VU + __ITER) % ids.length];
      actionResponse = http.get(
        `${BASE_URL}/api/pathfind?start=main-gate&destinationBuildingId=${encodeURIComponent(destinationId)}`,
        requestOptions(vuCookie, 'workload-pathfind')
      );
    }
    const actionPhase = choice < 4
      ? 'workload-search'
      : (choice < 7 ? 'workload-routes' : 'workload-pathfind');
    passed = recordResponse(actionResponse, 200, actionPhase) && passed;
  }

  // One lightweight health observation follows the same ramp without creating
  // a separate simulated user or a second browser process.
  if (__VU === 1 && __ITER % 5 === 0) {
    const healthResponse = http.get(`${BASE_URL}/healthz`, requestOptions(vuCookie, 'workload-health'));
    const healthOk = responseStatus(healthResponse) === 200;
    healthSuccess.add(healthOk ? 1 : 0);
    passed = recordResponse(healthResponse, 200, 'workload-health') && passed;
  }

  journeySuccess.add(passed ? 1 : 0);
  check({ passed }, {
    'LT-03 authenticated read-only journey succeeds': (value) => value.passed === true,
  });
  sleep(4 + Math.random() * 4);
}

async function installPresenceStub(context) {
  // Route interception can make Chromium report a null main-navigation
  // response during reload. Stub fetch before page scripts run instead, so the
  // advisory heartbeat stays local without intercepting document navigation.
  await context.addInitScript(`
    (() => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = function (input, init) {
        const rawUrl = typeof input === 'string' ? input : input && input.url;
        let pathname = '';
        try {
          pathname = new URL(String(rawUrl || ''), window.location.href).pathname;
        } catch (_) {
          pathname = '';
        }
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

async function inspectCanaryMap(page, cycle) {
  const startedAt = Date.now();
  let mapResponse = null;
  let pageUrl = '';
  let navigationStatus = 0;
  let navigationMethod = 'goto';

  try {
    const currentUrl = String(page.url() || '');
    navigationMethod = cycle > 1 && /\/map(?:[/?#]|$)/i.test(currentUrl) ? 'reload' : 'goto';
  } catch (_) {
    recordBrowserDiagnostic(
      browserDiagnosticUnexpected,
      'browser-navigation-inspection',
      0,
      cycle,
      navigationMethod
    );
    return false;
  }

  const navigationOptions = {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  };

  if (navigationMethod === 'reload') {
    // k6/browser may return null from reload even though the browser completed
    // the document navigation. Start the main-navigation listener before the
    // reload so that its real /map response remains available for classification.
    const capturedNavigation = page.waitForNavigation({
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    }).then((response) => ({
      kind: 'response',
      response,
    })).catch(() => ({
      kind: 'missing',
      response: null,
    }));
    const reloadResult = page.reload(navigationOptions).then((response) => ({
      kind: response ? 'response' : 'null',
      response: response || null,
    })).catch(() => ({
      kind: 'throw',
      response: null,
    }));
    const [captured, reloaded] = await Promise.all([capturedNavigation, reloadResult]);

    if (reloaded.kind === 'throw') {
      recordBrowserNavigationOutcome(
        browserDiagnosticNavigationThrow,
        'throw',
        null,
        cycle,
        navigationMethod
      );
      return false;
    }

    mapResponse = reloaded.response;
    if (!mapResponse && captured.kind === 'response') {
      recordBrowserNavigationRecovery(
        browserDiagnosticNavigationNullRecovered,
        'null-recovered',
        null,
        navigationMethod
      );
      mapResponse = captured.response;
    }
  } else {
    try {
      mapResponse = await page.goto(`${BASE_URL}/map`, navigationOptions);
    } catch (_) {
      recordBrowserNavigationOutcome(
        browserDiagnosticNavigationThrow,
        'throw',
        null,
        cycle,
        navigationMethod
      );
      return false;
    }
  }

  try {
    pageUrl = String(page.url() || '');
  } catch (_) {
    recordBrowserDiagnostic(
      browserDiagnosticUnexpected,
      'browser-navigation-inspection',
      0,
      cycle,
      navigationMethod
    );
    return false;
  }

  if (mapResponse === null || typeof mapResponse === 'undefined') {
    recordBrowserNavigationOutcome(
      browserDiagnosticNavigationNull,
      'null',
      null,
      cycle,
      navigationMethod
    );
    return false;
  }

  try {
    navigationStatus = typeof mapResponse.status === 'function'
      ? browserStatus(mapResponse.status())
      : 0;
  } catch (_) {
    recordBrowserDiagnostic(
      browserDiagnosticUnexpected,
      'browser-navigation-status-inspection',
      0,
      cycle,
      navigationMethod
    );
    return false;
  }

  browserDiagnosticNavigationResponse.add(
    1,
    browserNavigationTags('response', navigationStatus, navigationMethod)
  );

  if (navigationStatus > 0 && navigationStatus !== 200) {
    browserDiagnosticCheckStatus.add(
      1,
      diagnosticTags('browser-navigation-http-status', navigationStatus)
    );
  }
  if (!classifyBrowserNavigation(navigationStatus, pageUrl, cycle, navigationMethod)) return false;

  if (!await waitForBrowserSelector(
    page,
    '#mapView',
    browserDiagnosticWaitMapContainer,
    'browser-wait-map-container',
    navigationStatus,
    cycle
  )) return false;
  if (!await waitForBrowserSelector(
    page,
    '#mapView .maplibregl-canvas, #mapView .leaflet-container, #mapView .map-fallback',
    browserDiagnosticWaitMapSurface,
    'browser-wait-map-surface',
    navigationStatus,
    cycle
  )) return false;
  if (!await waitForBrowserSelector(
    page,
    '.map-start-label',
    browserDiagnosticWaitStartLabel,
    'browser-wait-start-label',
    navigationStatus,
    cycle
  )) return false;
  mapReadyMs.add(Date.now() - startedAt);

  try {
    // LT-02 uses the same settling window. Keep the initial readiness metric
    // separate from this stabilization delay so historical timings remain
    // comparable while assertions observe the settled map DOM.
    await page.waitForTimeout(CANARY_SETTLE_MS);

    const mapSurfaceCount = await page.locator(
      '#mapView .maplibregl-canvas, #mapView .leaflet-container, #mapView .map-fallback'
    ).count();
    const startLabelCount = await page.locator('.map-start-label').count();
    const buildingLabelCount = await page.locator(
      '.map-building-label--maplibre, .map-building-label--leaflet, .map-building-label--fallback'
    ).count();
    const startText = startLabelCount > 0
      ? String(await page.locator('.map-start-label').first().textContent() || '')
      : '';
    const pageText = String(await page.locator('body').textContent() || '');
    const checks = {
      url: pageUrl.includes('/map'),
      status: navigationStatus === 200,
      surface: mapSurfaceCount > 0,
      startLabel: /Guard House/i.test(startText),
      buildingLabels: buildingLabelCount > 0,
      routeControls: /Plan Route|Find Location/i.test(pageText),
    };
    const passed = check(page, {
      'map stayed on the authenticated /map page': () => checks.url,
      'map response was successful': () => checks.status,
      'map surface is rendered': () => checks.surface,
      'map has the Guard House start label': () => checks.startLabel,
      'map has building labels': () => checks.buildingLabels,
      'map exposes route controls': () => checks.routeControls,
    });
    const failedChecks = [];
    if (!checks.url) {
      recordBrowserDiagnostic(browserDiagnosticCheckUrl, 'browser-check-url', navigationStatus, cycle);
      failedChecks.push('url');
    }
    if (!checks.status) {
      recordBrowserDiagnostic(browserDiagnosticCheckStatus, 'browser-check-status', navigationStatus, cycle);
      failedChecks.push('status');
    }
    if (!checks.surface) {
      recordBrowserDiagnostic(browserDiagnosticCheckSurface, 'browser-check-surface', navigationStatus, cycle);
      failedChecks.push('surface');
    }
    if (!checks.startLabel) {
      recordBrowserDiagnostic(browserDiagnosticCheckStartLabel, 'browser-check-start-label', navigationStatus, cycle);
      failedChecks.push('start-label');
    }
    if (!checks.buildingLabels) {
      recordBrowserDiagnostic(
        browserDiagnosticCheckBuildingLabels,
        'browser-check-building-labels',
        navigationStatus,
        cycle
      );
      failedChecks.push('building-labels');
    }
    if (!checks.routeControls) {
      recordBrowserDiagnostic(
        browserDiagnosticCheckRouteControls,
        'browser-check-route-controls',
        navigationStatus,
        cycle
      );
      failedChecks.push('route-controls');
    }
    if (failedChecks.length > 0) {
      browserDiagnosticRender.add(1, diagnosticTags('browser-map-checks', navigationStatus));
    }
    return passed;
  } catch (_) {
    recordBrowserDiagnostic(browserDiagnosticUnexpected, 'browser-map-inspection', navigationStatus, cycle);
    return false;
  }
}

export async function browserCanary(data) {
  const context = await browser.newContext();
  const page = await context.newPage();
  let screenshotSaved = false;
  const startedAt = Date.now();
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

    let cycle = 0;
    while (Date.now() - startedAt < CANARY_DURATION_MS) {
      cycle += 1;
      const cycleStartedAt = Date.now();
      let passed = false;
      try {
        passed = await inspectCanaryMap(page, cycle);
        if (passed && !screenshotSaved && PAGE_SCREENSHOT && Date.now() - startedAt >= PEAK_HOLD_START_MS + 15000) {
          await page.screenshot({ path: PAGE_SCREENSHOT, fullPage: true });
          screenshotSaved = true;
        }
      } catch (_) {
        recordBrowserDiagnostic(browserDiagnosticUnexpected, 'browser-canary-cycle', 0, cycle);
        check(page, { 'LT-03 browser canary completes without an error': () => false });
      }
      browserSuccess.add(passed ? 1 : 0);
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
    throw new Error('LT-03 teardown did not receive the complete test-session pool.');
  }
  let cleanupFailed = false;
  cookies.forEach((cookie, index) => {
    try {
      logoutSession(String(cookie || ''), `teardown-${index + 1}`);
    } catch (_) {
      cleanupFailed = true;
    }
  });
  if (cleanupFailed) throw new Error('LT-03 could not terminate every test session.');
}

export function handleSummary(data) {
  const safeSummary = { ...data };
  delete safeSummary.setup_data;
  const summaryPath = String(__ENV.K6_SUMMARY_PATH || '').trim();
  if (!summaryPath) return { stdout: JSON.stringify(safeSummary, null, 2) };
  return { [summaryPath]: JSON.stringify(safeSummary, null, 2) };
}
