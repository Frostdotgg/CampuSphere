import http from 'k6/http';
import { browser } from 'k6/browser';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { validateStoredSnapshot } from './lt-07-offline-policy.js';

/*
 * LT-07 is a bounded browser recovery check, not a stress test. Three
 * isolated Chromium contexts represent desktop, tablet, and phone profiles.
 * Each profile downloads the explicit offline guide, disconnects, proves the
 * service-worker fallback can reopen the stored guide and both route
 * directions, then reconnects and performs one normal update check.
 *
 * The current Chrome window is deliberately not reused. The only shared
 * state is one temporary guest login cookie copied into the three contexts;
 * IndexedDB and service-worker state remain isolated per context.
 */
const BASE_URL = String(__ENV.BASE_URL || '').replace(/\/+$/, '');
const EMAIL = String(__ENV.K6_TEST_EMAIL || '');
const PASSWORD = String(__ENV.K6_TEST_PASSWORD || '');
const SCREENSHOT_DIR = String(__ENV.K6_LT07_SCREENSHOT_DIR || '').replace(/[\\/]+$/, '');
const EXPECTED_HOST = 'campusphere-cspc.vercel.app';
const SESSION_COOKIE_NAME = '__Host-campusphere.sid';
const GUIDE_SCHEMA = 'campusphere.offline-guide/1';
const PROFILES = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'tablet', width: 820, height: 1180 },
  { id: 'phone', width: 390, height: 844 },
];
const HASH_PATTERN = /^[a-f0-9]{64}$/;

if (!/^https:\/\/[a-z0-9.-]+$/i.test(BASE_URL)) {
  throw new Error('BASE_URL must be an HTTPS origin.');
}
const BASE_HOST = BASE_URL.replace(/^https:\/\//i, '').toLowerCase();
if (BASE_HOST !== EXPECTED_HOST) {
  throw new Error(`LT-07 refuses a non-Production host: ${BASE_HOST}`);
}
if (!EMAIL || !PASSWORD) {
  throw new Error('K6_TEST_EMAIL and K6_TEST_PASSWORD are required.');
}

const deviceSuccess = new Rate('lt07_device_success');
const downloadSuccess = new Rate('lt07_download_success');
const offlineRecoverySuccess = new Rate('lt07_offline_recovery_success');
const entryRouteSuccess = new Rate('lt07_entry_route_success');
const exitRouteSuccess = new Rate('lt07_exit_route_success');
const reconnectSuccess = new Rate('lt07_reconnect_success');
const downloadDuration = new Trend('lt07_download_duration_ms');
const offlineReadyDuration = new Trend('lt07_offline_ready_duration_ms');
const reconnectDuration = new Trend('lt07_reconnect_duration_ms');
const observedServiceWorkerVersion = new Trend('lt07_service_worker_version');
const browserCheckFailures = new Counter('lt07_diag_browser_check_failures');
const browserAuthFailures = new Counter('lt07_diag_browser_auth');
const browserRedirectFailures = new Counter('lt07_diag_browser_redirect');
const browserNetworkFailures = new Counter('lt07_diag_browser_network');
const browserClientFailures = new Counter('lt07_diag_browser_client_status');
const browserServerFailures = new Counter('lt07_diag_browser_server_status');
const browserOtherFailures = new Counter('lt07_diag_browser_other_status');
const browserRenderFailures = new Counter('lt07_diag_browser_render');
const browserUnexpectedFailures = new Counter('lt07_diag_browser_unexpected');
const offlineForbiddenResources = new Counter('lt07_diag_offline_forbidden_resources');
const offlineShellCacheMissing = new Counter('lt07_diag_offline_shell_cache_missing');
const offlineControllerMissing = new Counter('lt07_diag_offline_controller_missing');
const offlineNavigationUnsettled = new Counter('lt07_diag_offline_navigation_unsettled');
const offlinePageUnreadable = new Counter('lt07_diag_offline_page_unreadable');
const offlineWorkspaceHidden = new Counter('lt07_diag_offline_workspace_hidden');

export const options = {
  // Keep retained metrics aggregate-only. In particular, do not retain URL
  // or cookie-bearing request labels in the dashboard or summary.
  systemTags: ['status', 'method', 'scenario', 'expected_response'],
  scenarios: {
    offline_recovery: {
      executor: 'per-vu-iterations',
      vus: PROFILES.length,
      iterations: 1,
      maxDuration: '8m',
      gracefulStop: '60s',
      options: { browser: { type: 'chromium' } },
    },
  },
  thresholds: {
    // Let every isolated profile finish so one failure cannot terminate the
    // other Chromium processes before their fixed diagnostics are recorded.
    checks: ['rate==1.0'],
    lt07_device_success: ['rate==1.0'],
    lt07_download_success: ['rate==1.0'],
    lt07_offline_recovery_success: ['rate==1.0'],
    lt07_entry_route_success: ['rate==1.0'],
    lt07_exit_route_success: ['rate==1.0'],
    lt07_reconnect_success: ['rate==1.0'],
    lt07_download_duration_ms: ['p(95)<60000'],
    lt07_offline_ready_duration_ms: ['p(95)<30000'],
    lt07_reconnect_duration_ms: ['p(95)<30000'],
    lt07_diag_browser_auth: ['count==0'],
    lt07_diag_browser_redirect: ['count==0'],
    lt07_diag_browser_network: ['count==0'],
    lt07_diag_browser_client_status: ['count==0'],
    lt07_diag_browser_server_status: ['count==0'],
    lt07_diag_browser_other_status: ['count==0'],
    lt07_diag_browser_render: ['count==0'],
    lt07_diag_browser_unexpected: ['count==0'],
    lt07_diag_offline_forbidden_resources: ['count==0'],
    lt07_diag_offline_shell_cache_missing: ['count==0'],
    lt07_diag_offline_controller_missing: ['count==0'],
    lt07_diag_offline_navigation_unsettled: ['count==0'],
    lt07_diag_offline_page_unreadable: ['count==0'],
    lt07_diag_offline_workspace_hidden: ['count==0'],
    // The controlled offline navigation intentionally has no network path.
    // k6's browser_http_req_failed therefore is diagnostic-only for this test;
    // the online setup/update status checks above are the pass/fail boundary.
    http_req_failed: ['rate==0.0'],
  },
};

function responseStatus(response) {
  try { return response ? Number(response.status()) || 0 : 0; } catch (_) { return 0; }
}

function classifyStatus(status) {
  if (status === 401 || status === 403) browserAuthFailures.add(1);
  else if (status >= 300 && status < 400) browserRedirectFailures.add(1);
  else if (status >= 500) browserServerFailures.add(1);
  else if (status >= 400) browserClientFailures.add(1);
  else if (status === 0) browserNetworkFailures.add(1);
  else browserOtherFailures.add(1);
}

function requireResponse(response, description) {
  const status = responseStatus(response);
  if (status !== 200) {
    classifyStatus(status);
    throw new Error(`response-${description}`);
  }
  return status;
}

function sessionCookieFromJar(jar) {
  const cookies = jar.cookiesForURL(`${BASE_URL}/`);
  const values = cookies && cookies[SESSION_COOKIE_NAME];
  const value = values && values[0];
  if (!value) throw new Error('LT-07 setup did not receive a Production session cookie.');
  return String(value);
}

function requireSetupResponse(response, description, expectedStatuses) {
  const allowed = new Set(expectedStatuses);
  if (!response || !allowed.has(response.status)) {
    if (response && response.status === 429) {
      throw new Error('LT-07 setup was rate-limited by Production login protection; wait for Retry-After.');
    }
    throw new Error(`LT-07 setup could not ${description}.`);
  }
}

export function setup() {
  const jar = http.cookieJar();
  const authPage = http.get(`${BASE_URL}/auth`, {
    jar,
    tags: { phase: 'setup-auth-page' },
  });
  requireSetupResponse(authPage, 'open the authentication page', [200]);
  const csrfToken = String(authPage.html('input[name="_csrf"]').attr('value') || '');
  if (!csrfToken) throw new Error('LT-07 setup could not read the authentication request token.');

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
    throw new Error('LT-07 setup login did not redirect to the authenticated dashboard.');
  }

  const workerResponse = http.get(`${BASE_URL}/sw.js`, {
    jar,
    tags: { phase: 'setup-service-worker' },
  });
  requireSetupResponse(workerResponse, 'read the service-worker shell', [200]);
  const workerText = String(workerResponse.body || '');
  const workerMatch = workerText.match(/CACHE_VERSION\s*=\s*['"]v(\d+)['"]/);
  const serviceWorkerVersion = workerMatch ? Number(workerMatch[1]) : 0;
  if (!serviceWorkerVersion) throw new Error('LT-07 setup could not identify the deployed service-worker version.');
  observedServiceWorkerVersion.add(serviceWorkerVersion);
  return { sessionCookie: sessionCookieFromJar(jar), serviceWorkerVersion };
}

async function installPresenceStub(page) {
  await page.route(`${BASE_URL}/api/presence/heartbeat`, async (route) => {
    await route.fulfill({ status: 204, headers: { 'Cache-Control': 'no-store' } });
  });
}

async function waitUntil(predicate, timeoutMs, page) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await predicate()) return true;
    } catch (_) {
      // A browser-native reload briefly replaces the execution context. Keep
      // polling until the new document is readable or the bounded timeout wins.
    }
    if (page && typeof page.waitForTimeout === 'function') await page.waitForTimeout(250);
    else return false;
  }
  return false;
}

async function pageStatusText(page) {
  return String(await page.evaluate(() => Array.from(
    document.querySelectorAll('[data-offline-guide-status]')
  ).map((node) => node.textContent || '').join(' ')) || '');
}

async function waitForStatus(page, pattern, timeoutMs) {
  return waitUntil(async () => pattern.test(await pageStatusText(page)), timeoutMs, page);
}

async function clickVisibleElement(page, selector, timeoutMs) {
  return waitUntil(async () => Boolean(await page.evaluate((value) => {
    const elements = Array.from(document.querySelectorAll(value));
    const element = elements.find((candidate) => !candidate.disabled && !candidate.hidden &&
      (candidate.offsetWidth > 0 || candidate.offsetHeight > 0));
    if (!element) return false;
    element.click();
    return true;
  }, selector)), timeoutMs, page);
}

async function clickElementById(page, id) {
  return Boolean(await page.evaluate((value) => {
    const element = document.getElementById(value);
    if (!element || element.disabled || element.hidden) return false;
    element.click();
    return true;
  }, id));
}

async function ensureServiceWorker(page) {
  const ready = await waitUntil(async () => Boolean(await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    try { await navigator.serviceWorker.ready; } catch (_) { return false; }
    return Boolean(navigator.serviceWorker.controller);
  })), 30000, page);
  if (ready) return true;
  try { await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }); } catch (_) { /* state check below reports failure */ }
  return waitUntil(async () => Boolean(await page.evaluate(() => Boolean(
    navigator.serviceWorker && navigator.serviceWorker.controller
  ))), 30000, page);
}

async function managerReady(page) {
  return waitUntil(async () => Boolean(await page.evaluate(() => Boolean(
    window.CampuSphereOfflineGuide && typeof window.CampuSphereOfflineGuide.read === 'function'
  ))), 30000, page);
}

async function offlineShellPreflight(page) {
  return page.evaluate(async () => {
    const controlled = Boolean(navigator.serviceWorker && navigator.serviceWorker.controller);
    if (!('caches' in window)) return { controlled, cached: false };
    try {
      const shellUrl = new URL('/offline.html', window.location.origin).href;
      const cached = await window.caches.match(shellUrl);
      return { controlled, cached: Boolean(cached) };
    } catch (_) {
      return { controlled, cached: false };
    }
  });
}

async function offlinePageState(page) {
  try {
    return await page.evaluate(() => ({
      readable: true,
      controlled: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
      offlinePage: Boolean(document.body && document.body.classList.contains('offline-page')),
    }));
  } catch (_) {
    return { readable: false, controlled: false, offlinePage: false };
  }
}

async function storedSnapshot(page) {
  return page.evaluate(async () => {
    function forbidden(value, seen) {
      if (typeof value === 'string') return /(?:cloudinary|panorama|360|scene|\bvr\b|image_url|\/img\/vr\/|\/api\/vr\/|res\.cloudinary\.com)/i.test(value);
      if (!value || typeof value !== 'object') return false;
      const objects = seen || [];
      if (objects.indexOf(value) !== -1) return false;
      objects.push(value);
      return Object.keys(value).some((key) => /(?:cloudinary|panorama|360|scene|\bvr\b|image_url)/i.test(key) || forbidden(value[key], objects));
    }
    try {
      const record = await window.CampuSphereOfflineGuide.read();
      if (!record) return { schema: '', fingerprint: '', basemapBytes: 0, expectedBasemapBytes: 0, buildingCount: 0, entryRouteCount: 0, exitRouteCount: 0, buildingWithBothRoutes: false, forbiddenData: false, buildingIndex: -1 };
      const guide = record.guide || {};
      const buildings = Array.isArray(guide.buildings) ? guide.buildings : [];
      const routes = Array.isArray(guide.routes) ? guide.routes : [];
      const exitRoutes = Array.isArray(guide.exitRoutes) ? guide.exitRoutes : [];
      const entryKeys = new Set(routes.map((route) => String(route && route.destinationKey || '').trim()).filter(Boolean));
      const exitKeys = new Set(exitRoutes.map((route) => String(route && route.buildingKey || '').trim()).filter(Boolean));
      const buildingIndex = buildings.findIndex((building) => {
        const key = String(building && building.key || '').trim();
        return key && entryKeys.has(key) && exitKeys.has(key);
      });
      return {
        schema: String(record.schema || ''),
        fingerprint: String(record.fingerprint || ''),
        basemapBytes: record.basemap && Number(record.basemap.size) || 0,
        expectedBasemapBytes: guide.basemap && Number(guide.basemap.bytes) || 0,
        buildingCount: buildings.length,
        entryRouteCount: routes.length,
        exitRouteCount: exitRoutes.length,
        buildingWithBothRoutes: buildingIndex >= 0,
        forbiddenData: forbidden(guide),
        buildingIndex,
      };
    } catch (_) {
      return { schema: '', fingerprint: '', basemapBytes: 0, expectedBasemapBytes: 0, buildingCount: 0, entryRouteCount: 0, exitRouteCount: 0, buildingWithBothRoutes: false, forbiddenData: false, buildingIndex: -1 };
    }
  });
}

async function offlineResourceSummary(page) {
  return page.evaluate(() => {
    const forbidden = /(?:cloudinary|panorama|360|scene|\/img\/vr\/|\/api\/vr\/|res\.cloudinary\.com)/i;
    let forbiddenCount = 0;
    performance.getEntriesByType('resource').forEach((entry) => {
      if (forbidden.test(String(entry && entry.name || ''))) forbiddenCount += 1;
    });
    return { forbiddenCount };
  });
}

async function checkFixed(label, condition) {
  const passed = check({ value: Boolean(condition) }, { [label]: (value) => value.value === true });
  if (!passed) browserCheckFailures.add(1);
  return passed;
}

function screenshotPath(profile, state) {
  return SCREENSHOT_DIR ? `${SCREENSHOT_DIR}/lt-07-${profile.id}-${state}.png` : '';
}

async function runDevice(profile, sessionCookie) {
  const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height } });
  const page = await context.newPage();
  let failedCheck = '';
  const actions = { download: false, offline: false, entry: false, exit: false, reconnect: false };
  try {
    await context.addCookies([{
      name: SESSION_COOKIE_NAME,
      value: String(sessionCookie || ''),
      url: `${BASE_URL}/`,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    }]);
    await installPresenceStub(page);

    let mapResponse = null;
    try {
      mapResponse = await page.goto(`${BASE_URL}/map`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch (_) { /* status 0 below records the fixed network category */ }
    const mapStatus = responseStatus(mapResponse);
    if (mapStatus !== 200) classifyStatus(mapStatus);
    failedCheck = 'online-map-status';
    if (!await checkFixed('online-map-status', mapStatus === 200)) throw new Error('online-map-status');
    failedCheck = 'service-worker-control';
    if (!await checkFixed('service-worker-control', await ensureServiceWorker(page))) throw new Error('service-worker-control');
    failedCheck = 'online-map-surface';
    let onlineMapSurface;
    try {
      await page.locator('#mapView').waitFor({ state: 'visible', timeout: 30000 });
      onlineMapSurface = page.locator(
        '#mapView .maplibregl-canvas, #mapView .leaflet-container, #mapView .map-fallback'
      );
      await onlineMapSurface.first().waitFor({ state: 'visible', timeout: 30000 });
    } catch (_) {
      browserRenderFailures.add(1);
      throw new Error('online-map-surface');
    }
    await page.waitForTimeout(1000);
    if (!await checkFixed('online-map-surface', await onlineMapSurface.count() > 0)) throw new Error('online-map-surface');
    failedCheck = 'offline-guide-manager';
    if (!await checkFixed('offline-guide-manager', await managerReady(page))) throw new Error('offline-guide-manager');

    const downloadStarted = Date.now();
    const downloadResponsePromise = page.waitForResponse(/\/api\/offline-guide(?:\?|$)/, { timeout: 60000 })
      .then((response) => response)
      .catch(() => null);
    failedCheck = 'download-button';
    if (!await checkFixed('download-button', await clickVisibleElement(page, '[data-offline-guide-download]', 30000))) throw new Error('download-button');
    const downloadResponse = await downloadResponsePromise;
    failedCheck = 'download-http-200';
    if (!await checkFixed('download-http-200', responseStatus(downloadResponse) === 200)) {
      classifyStatus(responseStatus(downloadResponse));
      throw new Error('download-http-200');
    }
    failedCheck = 'download-status';
    if (!await checkFixed('download-status', await waitForStatus(page, /Offline map ready on this device\.|Offline map is already up to date\./, 60000))) throw new Error('download-status');
    downloadDuration.add(Date.now() - downloadStarted);
    failedCheck = 'downloaded-guide-integrity';
    const downloadedSnapshot = await storedSnapshot(page);
    if (!await checkFixed('downloaded-guide-integrity', validateStoredSnapshot(downloadedSnapshot).accepted)) throw new Error('downloaded-guide-integrity');
    actions.download = true;

    failedCheck = 'offline-shell-cache';
    const shellPreflight = await offlineShellPreflight(page);
    if (!shellPreflight.controlled) offlineControllerMissing.add(1);
    if (!shellPreflight.cached) offlineShellCacheMissing.add(1);
    if (!await checkFixed('offline-shell-cache', shellPreflight.controlled && shellPreflight.cached)) {
      throw new Error('offline-shell-cache');
    }

    const offlineStarted = Date.now();
    failedCheck = 'offline-toggle';
    try { await context.setOffline(true); } catch (_) { browserNetworkFailures.add(1); throw new Error('offline-toggle'); }

    // page.goto() is intentionally not used after setOffline(true): k6 treats
    // that automation navigation as unable to load in an offline context. A
    // browser-native reload follows the same controlled-page path a user takes
    // when reopening /map and lets the active service worker answer with the
    // already-proven cached /offline.html shell.
    failedCheck = 'offline-navigation';
    try {
      await page.evaluate(() => { window.location.reload(); });
    } catch (_) {
      // Destroying the old execution context can reject evaluate even when the
      // reload started. The resulting fixed page state is authoritative below.
    }
    failedCheck = 'offline-shell';
    const offlineShell = await waitUntil(async () => Boolean(await page.evaluate(() =>
      document.body && document.body.classList.contains('offline-page'))), 30000, page);
    if (!offlineShell) {
      const state = await offlinePageState(page);
      if (!state.readable) offlinePageUnreadable.add(1);
      else if (!state.controlled) offlineControllerMissing.add(1);
      else if (!state.offlinePage) offlineNavigationUnsettled.add(1);
      browserRenderFailures.add(1);
    }
    if (!await checkFixed('offline-shell', offlineShell)) throw new Error('offline-shell');
    failedCheck = 'offline-workspace';
    const offlineWorkspace = await waitUntil(async () => Boolean(await page.evaluate(() => {
      const workspace = document.getElementById('offlineGuideWorkspace');
      return workspace && !workspace.hidden;
    })), 30000, page);
    if (!offlineWorkspace) {
      offlineWorkspaceHidden.add(1);
      browserRenderFailures.add(1);
    }
    if (!await checkFixed('offline-workspace', offlineWorkspace)) throw new Error('offline-workspace');
    const offlineReady = Date.now() - offlineStarted;
    offlineReadyDuration.add(offlineReady);
    failedCheck = 'offline-map-surface';
    const mapSurface = await waitUntil(async () => Boolean(await page.evaluate(() => {
      const map = document.getElementById('offlineMap');
      const fallback = document.getElementById('offlineMapFallback');
      return Boolean((map && !map.hidden && (map.querySelector('.maplibregl-canvas') || map.children.length > 0)) ||
        (fallback && !fallback.hidden && fallback.children.length > 0));
    })), 30000, page);
    if (!await checkFixed('offline-map-surface', mapSurface)) { browserRenderFailures.add(1); throw new Error('offline-map-surface'); }
    failedCheck = 'offline-guide-integrity';
    const offlineSnapshot = await storedSnapshot(page);
    if (!await checkFixed('offline-guide-integrity', validateStoredSnapshot(offlineSnapshot).accepted)) throw new Error('offline-guide-integrity');
    failedCheck = 'offline-building-list';
    const buildingCount = await page.locator('#offlineBuildingList .offline-building').count();
    if (!await checkFixed('offline-building-list', buildingCount === offlineSnapshot.buildingCount && buildingCount > 0)) throw new Error('offline-building-list');
    const resources = await offlineResourceSummary(page);
    if (resources && resources.forbiddenCount > 0) offlineForbiddenResources.add(resources.forbiddenCount);
    failedCheck = 'offline-no-vr-resources';
    if (!await checkFixed('offline-no-vr-resources', !resources || resources.forbiddenCount === 0)) throw new Error('offline-no-vr-resources');
    actions.offline = true;

    failedCheck = 'offline-building-details';
    if (!await checkFixed('offline-building-details', await page.evaluate((index) => {
      const buttons = Array.from(document.querySelectorAll('#offlineBuildingList .offline-building'));
      const button = buttons[index];
      if (!button) return false;
      button.click();
      return true;
    }, offlineSnapshot.buildingIndex))) throw new Error('offline-building-details');
    const detailsReady = await waitUntil(async () => Boolean(await page.evaluate(() => {
      const panel = document.getElementById('offlineDetailsPanel');
      const title = document.getElementById('offline-details-title');
      return Boolean(panel && !panel.hidden && title && String(title.textContent || '').trim());
    })), 10000, page);
    failedCheck = 'offline-building-details-visible';
    if (!await checkFixed('offline-building-details-visible', detailsReady)) throw new Error('offline-building-details-visible');

    failedCheck = 'offline-entry-route';
    if (!await checkFixed('offline-entry-route-button', await clickElementById(page, 'offlineSetDestination'))) throw new Error('offline-entry-route-button');
    const entryReady = await waitUntil(async () => Boolean(await page.evaluate(() => {
      const summary = document.getElementById('offlineRouteSummary');
      const subtitle = document.getElementById('offlineRouteSubtitle');
      const steps = document.querySelectorAll('#offlineRouteSteps li');
      return Boolean(summary && !summary.hidden && /From Guard House \/ Main Gate/i.test(String(subtitle && subtitle.textContent || '')) && steps.length > 0);
    })), 10000, page);
    if (!await checkFixed('offline-entry-route', entryReady)) throw new Error('offline-entry-route');
    actions.entry = true;
    await clickElementById(page, 'offlineRouteClose');

    failedCheck = 'offline-exit-building-details';
    if (!await checkFixed('offline-exit-building-details', await page.evaluate((index) => {
      const buttons = Array.from(document.querySelectorAll('#offlineBuildingList .offline-building'));
      const button = buttons[index];
      if (!button) return false;
      button.click();
      return true;
    }, offlineSnapshot.buildingIndex))) throw new Error('offline-exit-building-details');
    const detailsAgain = await waitUntil(async () => Boolean(await page.evaluate(() => {
      const panel = document.getElementById('offlineDetailsPanel');
      return Boolean(panel && !panel.hidden);
    })), 10000, page);
    if (!await checkFixed('offline-exit-building-details-visible', detailsAgain)) throw new Error('offline-exit-building-details-visible');
    failedCheck = 'offline-exit-route';
    if (!await checkFixed('offline-exit-route-button', await clickElementById(page, 'offlineExitRoute'))) throw new Error('offline-exit-route-button');
    const exitReady = await waitUntil(async () => Boolean(await page.evaluate(() => {
      const summary = document.getElementById('offlineRouteSummary');
      const subtitle = document.getElementById('offlineRouteSubtitle');
      const steps = document.querySelectorAll('#offlineRouteSteps li');
      return Boolean(summary && !summary.hidden && /Exit route to Guard House \/ Main Gate/i.test(String(subtitle && subtitle.textContent || '')) && steps.length > 0);
    })), 10000, page);
    if (!await checkFixed('offline-exit-route', exitReady)) throw new Error('offline-exit-route');
    actions.exit = true;
    if (SCREENSHOT_DIR) {
      try { await page.screenshot({ path: screenshotPath(profile, 'offline'), fullPage: true }); }
      catch (_) { browserRenderFailures.add(1); throw new Error('offline-screenshot'); }
    }

    const reconnectStarted = Date.now();
    failedCheck = 'reconnect-toggle';
    try { await context.setOffline(false); } catch (_) { browserNetworkFailures.add(1); throw new Error('reconnect-toggle'); }
    const onlineAgain = await waitUntil(async () => Boolean(await page.evaluate(() => navigator.onLine !== false)), 10000, page);
    if (!await checkFixed('reconnect-online', onlineAgain)) throw new Error('reconnect-online');
    const updateResponsePromise = page.waitForResponse(/\/api\/offline-guide(?:\?|$)/, { timeout: 60000 })
      .then((response) => response)
      .catch(() => null);
    failedCheck = 'reconnect-update-button';
    if (!await checkFixed('reconnect-update-button', await clickVisibleElement(page, '[data-offline-guide-download]', 30000))) throw new Error('reconnect-update-button');
    const updateResponse = await updateResponsePromise;
    failedCheck = 'reconnect-update-http-200';
    if (!await checkFixed('reconnect-update-http-200', responseStatus(updateResponse) === 200)) {
      classifyStatus(responseStatus(updateResponse));
      throw new Error('reconnect-update-http-200');
    }
    failedCheck = 'reconnect-update-status';
    if (!await checkFixed('reconnect-update-status', await waitForStatus(page, /Offline map ready on this device\.|Offline map is already up to date\./, 60000))) throw new Error('reconnect-update-status');
    failedCheck = 'reconnect-guide-integrity';
    const reconnectedSnapshot = await storedSnapshot(page);
    if (!await checkFixed('reconnect-guide-integrity', validateStoredSnapshot(reconnectedSnapshot).accepted)) throw new Error('reconnect-guide-integrity');
    const reconnectResources = await offlineResourceSummary(page);
    if (reconnectResources && reconnectResources.forbiddenCount > 0) offlineForbiddenResources.add(reconnectResources.forbiddenCount);
    failedCheck = 'reconnect-no-vr-resources';
    if (!await checkFixed('reconnect-no-vr-resources', !reconnectResources || reconnectResources.forbiddenCount === 0)) throw new Error('reconnect-no-vr-resources');
    reconnectDuration.add(Date.now() - reconnectStarted);
    actions.reconnect = true;
    if (SCREENSHOT_DIR) {
      try { await page.screenshot({ path: screenshotPath(profile, 'reconnected'), fullPage: true }); }
      catch (_) { browserRenderFailures.add(1); throw new Error('reconnected-screenshot'); }
    }
  } catch (_) {
    if (!failedCheck) browserUnexpectedFailures.add(1);
    console.error(`LT-07 ${profile.id} failed check: ${failedCheck || 'browser-flow'}`);
    check({ value: false }, { 'LT-07 device flow completed': (value) => value.value === true });
  } finally {
    try { await context.setOffline(false); } catch (_) { /* context is closing */ }
    try { await page.close(); } catch (_) { /* context close remains authoritative */ }
    await context.close();
  }

  downloadSuccess.add(actions.download ? 1 : 0);
  offlineRecoverySuccess.add(actions.offline ? 1 : 0);
  entryRouteSuccess.add(actions.entry ? 1 : 0);
  exitRouteSuccess.add(actions.exit ? 1 : 0);
  reconnectSuccess.add(actions.reconnect ? 1 : 0);
  const complete = actions.download && actions.offline && actions.entry && actions.exit && actions.reconnect;
  deviceSuccess.add(complete ? 1 : 0);
}

export default async function (data) {
  const index = Math.max(0, Math.min(PROFILES.length - 1, Number(__VU) - 1));
  await runDevice(PROFILES[index], String(data && data.sessionCookie || ''));
}

export function teardown(data) {
  const sessionCookie = String(data && data.sessionCookie || '');
  if (!sessionCookie) throw new Error('LT-07 teardown did not receive the setup session.');
  const jar = http.cookieJar();
  jar.set(`${BASE_URL}/`, SESSION_COOKIE_NAME, sessionCookie, {
    path: '/', httpOnly: true, secure: true, sameSite: 'Lax',
  });
  const csrfResponse = http.get(`${BASE_URL}/auth/csrf-token`, {
    jar,
    headers: { Accept: 'application/json' },
    tags: { phase: 'teardown-csrf' },
  });
  if (!csrfResponse || csrfResponse.status !== 200) throw new Error('LT-07 teardown could not obtain the authenticated request token.');
  const body = csrfResponse.json();
  const csrfToken = body && body.success === true ? String(body.csrfToken || '') : '';
  if (!csrfToken) throw new Error('LT-07 teardown received an invalid authenticated request token.');
  const logoutResponse = http.post(`${BASE_URL}/logout`, null, {
    jar,
    redirects: 0,
    headers: { Accept: 'application/json', 'X-CSRF-Token': csrfToken },
    tags: { phase: 'teardown-logout' },
  });
  if (!logoutResponse || logoutResponse.status !== 200) throw new Error('LT-07 teardown could not terminate the test session.');
}

export function handleSummary(data) {
  const safeSummary = { ...data };
  delete safeSummary.setup_data;
  const summaryPath = String(__ENV.K6_SUMMARY_PATH || '').trim();
  if (!summaryPath) return { stdout: JSON.stringify(safeSummary, null, 2) };
  return { [summaryPath]: JSON.stringify(safeSummary, null, 2) };
}
