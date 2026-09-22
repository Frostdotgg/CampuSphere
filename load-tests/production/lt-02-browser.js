import http from 'k6/http';
import { browser } from 'k6/browser';
import { check, fail } from 'k6';
import { Rate, Trend } from 'k6/metrics';

/*
 * LT-02 measures concurrent authenticated map browsing in Production. The
 * single dedicated guest account is authenticated once in setup(), then its
 * session cookie is copied into 50 isolated browser contexts. This keeps the
 * test focused on the map instead of creating a login-rate-limit outage.
 *
 * The map shell sends an immediate presence heartbeat. Because all test
 * contexts intentionally represent one guest identity, that advisory request
 * is fulfilled locally for this map-only test; every map/document/API/static
 * request remains a real Production request. Presence itself is covered by
 * its own bounded test and is never disabled in the application.
 */
const BASE_URL = String(__ENV.BASE_URL || '').replace(/\/+$/, '');
const EMAIL = String(__ENV.K6_TEST_EMAIL || '');
const PASSWORD = String(__ENV.K6_TEST_PASSWORD || '');
const PAGE_SCREENSHOT = String(__ENV.K6_PAGE_SCREENSHOT_PATH || '');
const EXPECTED_HOST = 'campusphere-cspc.vercel.app';
const SESSION_COOKIE_NAME = '__Host-campusphere.sid';

if (!/^https:\/\/[a-z0-9.-]+$/i.test(BASE_URL)) {
  throw new Error('BASE_URL must be an HTTPS origin.');
}
const BASE_HOST = BASE_URL.replace(/^https:\/\//i, '').toLowerCase();
if (BASE_HOST !== EXPECTED_HOST) {
  throw new Error(`LT-02 refuses a non-Production host: ${BASE_HOST}`);
}
if (!EMAIL || !PASSWORD) {
  throw new Error('K6_TEST_EMAIL and K6_TEST_PASSWORD are required.');
}

const vuSuccess = new Rate('lt02_vu_success');
const mapReadyMs = new Trend('lt02_map_ready_ms');

export const options = {
  scenarios: {
    concurrent_browser: {
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 1,
      maxDuration: '5m',
      gracefulStop: '30s',
      options: { browser: { type: 'chromium' } },
    },
  },
  thresholds: {
    checks: ['rate==1.0'],
    lt02_vu_success: ['rate==1.0'],
    http_req_failed: ['rate==0.0'],
    browser_http_req_failed: ['rate==0.0'],
    // Browser timing includes the load generator's own cost of launching and
    // closing 50 Chromium processes on one Windows host. Keep a generous
    // request guardrail, but record LCP/map-ready timing for review rather
    // than treating a client-side percentile as a Production outage.
    browser_http_req_duration: ['p(95)<10000', 'p(99)<15000'],
    lt02_map_ready_ms: ['p(95)<20000'],
  },
};

function representativeUser() {
  return __VU === 1 && __ITER === 0;
}

function logRepresentative(message) {
  if (representativeUser()) console.log(`LT-02: ${message}`);
}

function requireSetupResponse(response, description, expectedStatuses) {
  const allowed = new Set(expectedStatuses);
  if (!response || !allowed.has(response.status)) {
    if (response && response.status === 429) {
      throw new Error('LT-02 setup was rate-limited by Production login protection; wait for the Retry-After window.');
    }
    throw new Error(`LT-02 setup could not ${description}.`);
  }
}

function sessionCookieFromJar(jar) {
  const cookies = jar.cookiesForURL(`${BASE_URL}/`);
  const values = cookies && cookies[SESSION_COOKIE_NAME];
  const value = values && values[0];
  if (!value) throw new Error('LT-02 setup did not receive a Production session cookie.');
  return String(value);
}

/* Authenticate once outside the 50 browser iterations. The response body,
   CSRF token, password, and cookie are never logged or written to evidence. */
export function setup() {
  const jar = http.cookieJar();
  const authPage = http.get(`${BASE_URL}/auth`, {
    jar,
    tags: { phase: 'setup-auth-page' },
  });
  requireSetupResponse(authPage, 'open the authentication page', [200]);

  const csrfToken = String(authPage.html('input[name="_csrf"]').attr('value') || '');
  if (!csrfToken) throw new Error('LT-02 setup could not read the authentication request token.');

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
    tags: { phase: 'setup-login' },
  });
  requireSetupResponse(loginResponse, 'authenticate the dedicated guest account', [302]);
  const location = loginResponse.headers.Location || loginResponse.headers.location || '';
  if (!/^\/dashboard(?:[/?#]|$)/.test(String(location))) {
    throw new Error('LT-02 setup login did not redirect to the authenticated dashboard.');
  }

  return { sessionCookie: sessionCookieFromJar(jar) };
}

async function installPresenceStub(page) {
  await page.route(`${BASE_URL}/api/presence/heartbeat`, async (route) => {
    await route.fulfill({
      status: 204,
      headers: { 'Cache-Control': 'no-store' },
    });
  });
}

async function inspectMap(page) {
  const startedAt = Date.now();
  const mapResponse = await page.goto(`${BASE_URL}/map`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.locator('#mapView').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator(
    '#mapView .maplibregl-canvas, #mapView .leaflet-container, #mapView .map-fallback'
  ).waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('.map-start-label').waitFor({ state: 'visible', timeout: 30000 });
  mapReadyMs.add(Date.now() - startedAt);
  await page.waitForTimeout(3000);

  const mapUrl = page.url();
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

  const passed = check(page, {
    'map stayed on the authenticated /map page': () => mapUrl.includes('/map'),
    'map response was successful': () => Boolean(mapResponse && mapResponse.status() === 200),
    'map surface is rendered': () => mapSurfaceCount > 0,
    'map has the fixed Guard House start label': () => /Guard House/i.test(startText),
    'map has building labels': () => buildingLabelCount > 0,
    'map exposes route controls': () => /Plan Route|Find Location/i.test(pageText),
  });
  logRepresentative(`map checks collected (surface=${mapSurfaceCount}, start=${startLabelCount}, buildings=${buildingLabelCount})`);

  if (PAGE_SCREENSHOT && representativeUser()) {
    await page.screenshot({ path: PAGE_SCREENSHOT, fullPage: true });
    logRepresentative('map screenshot saved');
  }

  return passed;
}

export default async function (data) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await context.addCookies([{
      name: SESSION_COOKIE_NAME,
      value: String(data && data.sessionCookie || ''),
      url: `${BASE_URL}/`,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    }]);
    await installPresenceStub(page);
    const passed = await inspectMap(page);
    if (!passed) throw new Error('one or more authenticated map checks failed.');
    vuSuccess.add(1);
  } catch (error) {
    vuSuccess.add(0);
    const message = String(error && error.message ? error.message : error);
    console.error(`LT-02 VU ${__VU} browser flow failed: ${message}`);
    check(page, { 'LT-02 completed without a browser error': () => false });
    fail(`LT-02 browser flow failed: ${message}`);
  } finally {
    try { await page.close(); } catch (_) { /* context close remains authoritative */ }
    await context.close();
  }
}

/* End the one shared test session after every browser has closed. */
export function teardown(data) {
  const sessionCookie = String(data && data.sessionCookie || '');
  if (!sessionCookie) throw new Error('LT-02 teardown did not receive the setup session.');

  const jar = http.cookieJar();
  jar.set(`${BASE_URL}/`, SESSION_COOKIE_NAME, sessionCookie, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
  });

  const csrfResponse = http.get(`${BASE_URL}/auth/csrf-token`, {
    jar,
    headers: { Accept: 'application/json' },
    tags: { phase: 'teardown-csrf' },
  });
  if (!csrfResponse || csrfResponse.status !== 200) {
    throw new Error('LT-02 teardown could not obtain the authenticated request token.');
  }
  const body = csrfResponse.json();
  const csrfToken = body && body.success === true ? String(body.csrfToken || '') : '';
  if (!csrfToken) throw new Error('LT-02 teardown received an invalid authenticated request token.');

  const logoutResponse = http.post(`${BASE_URL}/logout`, null, {
    jar,
    redirects: 0,
    headers: {
      Accept: 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    tags: { phase: 'teardown-logout' },
  });
  if (!logoutResponse || logoutResponse.status !== 200) {
    throw new Error('LT-02 teardown could not terminate the test session.');
  }
}

/* k6 otherwise serializes setup()'s return value into summary.json. That value
   contains the temporary session cookie needed by the browser VUs, so publish
   only the metrics/evidence summary and never the setup object. */
export function handleSummary(data) {
  const safeSummary = { ...data };
  delete safeSummary.setup_data;
  const summaryPath = String(__ENV.K6_SUMMARY_PATH || '').trim();
  if (!summaryPath) return { stdout: JSON.stringify(safeSummary, null, 2) };
  return { [summaryPath]: JSON.stringify(safeSummary, null, 2) };
}
