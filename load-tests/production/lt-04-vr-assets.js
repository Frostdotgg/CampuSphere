import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

/*
 * LT-04 measures a small, bounded burst of real Cloudinary panorama delivery.
 * The application is used only during setup to discover already-approved
 * guided-VR media URLs. The workload then requests those public delivery URLs
 * directly, so this test does not create browser sessions or exercise an
 * application request storm.
 */
const BASE_URL = String(__ENV.BASE_URL || '').replace(/\/+$/, '');
const EMAIL = String(__ENV.K6_TEST_EMAIL || '');
const PASSWORD = String(__ENV.K6_TEST_PASSWORD || '');
const EXPECTED_HOST = 'campusphere-cspc.vercel.app';
const CLOUDINARY_URL_PATTERN = /^https:\/\/res\.cloudinary\.com\/[^\s?#]+(?:\?[^\s#]*)?(?:#[^\s]*)?$/i;
const DRIVE_URL_PATTERN = /^https:\/\/(?:www\.)?drive\.google\.com(?:\/|$)/i;
const SESSION_COOKIE_NAME = '__Host-campusphere.sid';
const MIN_ASSETS = 5;
const MAX_ASSETS = 10;
const ASSET_REQUESTS = 10;
const ASSET_VUS = 5;
const REQUEST_TIMEOUT_MS = 30 * 1000;
const MAX_ROUTE_PROBES = 25;

if (!/^https:\/\/[a-z0-9.-]+$/i.test(BASE_URL)) {
  throw new Error('BASE_URL must be an HTTPS origin.');
}
const BASE_HOST = BASE_URL.replace(/^https:\/\//i, '').toLowerCase();
if (BASE_HOST !== EXPECTED_HOST) {
  throw new Error(`LT-04 refuses a non-Production host: ${BASE_HOST}`);
}
if (!EMAIL || !PASSWORD) {
  throw new Error('K6_TEST_EMAIL and K6_TEST_PASSWORD are required.');
}

const assetRequests = new Counter('lt04_asset_requests');
const assetSuccess = new Rate('lt04_asset_success');
const assetNoResponse = new Rate('lt04_asset_no_response');
const assetRedirect = new Counter('lt04_asset_redirects');
const assetClientError = new Counter('lt04_asset_client_errors');
const assetServerError = new Counter('lt04_asset_server_errors');
const assetOtherStatus = new Counter('lt04_asset_other_status');
const assetContentTypeFailure = new Counter('lt04_asset_content_type_failures');
const assetDuration = new Trend('lt04_asset_duration_ms');
// Setup diagnostics explain a zero-asset run without recording media URLs or
// response bodies. These counters are separate from workload metrics so a
// blocked setup can never look like a CDN pass.
const setupRouteResponses = new Counter('lt04_setup_route_responses');
const setupRouteFailures = new Counter('lt04_setup_route_failures');
const setupRoutesNoScenes = new Counter('lt04_setup_routes_no_scenes');
const setupScenes = new Counter('lt04_setup_scenes');
const setupCloudinary = new Counter('lt04_setup_cloudinary_urls');
const setupExplicitCloudinary = new Counter('lt04_setup_explicit_cloudinary_urls');
const setupLocal = new Counter('lt04_setup_local_urls');
const setupDrive = new Counter('lt04_setup_drive_urls');
const setupNull = new Counter('lt04_setup_null_urls');
const setupOther = new Counter('lt04_setup_other_urls');
const setupCounts = {
  routeResponses: 0,
  routeFailures: 0,
  routesNoScenes: 0,
  scenes: 0,
  cloudinary: 0,
  local: 0,
  drive: 0,
  nullMedia: 0,
  other: 0,
};

export const options = {
  scenarios: {
    asset_stress: {
      executor: 'shared-iterations',
      vus: ASSET_VUS,
      iterations: ASSET_REQUESTS,
      maxDuration: '45s',
      gracefulStop: '5s',
    },
  },
  // Bodies are discarded only after the CDN transfer completes. This keeps
  // the load generator bounded while still measuring real delivery bytes.
  discardResponseBodies: true,
  // Do not put full public media URLs into k6 metric labels or dashboards.
  systemTags: ['status', 'method', 'name', 'scenario', 'expected_response'],
  thresholds: {
    checks: [{ threshold: 'rate==1.0', abortOnFail: true, delayAbortEval: '5s' }],
    lt04_asset_success: [{ threshold: 'rate==1.0', abortOnFail: true, delayAbortEval: '5s' }],
    lt04_asset_no_response: ['rate==0.0'],
    lt04_asset_duration_ms: ['p(95)<20000', 'max<30000'],
    http_req_failed: ['rate==0.0'],
  },
};

function setupFailure(stage, reason) {
  return new Error(`LT-04 setup stage ${stage} failed (${reason}).`);
}

function requireSetupResponse(response, description, expectedStatuses, stage) {
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

function sessionCookieFromJar(jar) {
  const cookies = jar.cookiesForURL(`${BASE_URL}/`);
  const values = cookies && cookies[SESSION_COOKIE_NAME];
  const value = Array.isArray(values) && values.length > 0
    ? values[values.length - 1]
    : '';
  if (!value) throw setupFailure('login', 'session-cookie-missing');
  return String(value);
}

function setupLogin() {
  const jar = new http.CookieJar();
  const authPage = http.get(`${BASE_URL}/auth`, {
    jar,
    responseType: 'text',
    redirects: 0,
    tags: { test_case: 'LT-04', phase: 'setup-auth-page', name: 'LT-04 auth page' },
  });
  requireSetupResponse(authPage, 'open the authentication page', [200], 'auth-page');
  const csrfToken = csrfTokenFromAuthPage(authPage);
  if (!csrfToken) throw setupFailure('auth-page', 'csrf-token-missing');

  const loginResponse = http.post(`${BASE_URL}/login`, {
    _csrf: csrfToken,
    email: EMAIL,
    password: PASSWORD,
  }, {
    jar,
    responseType: 'none',
    redirects: 0,
    headers: {
      Accept: 'text/html',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    tags: { test_case: 'LT-04', phase: 'setup-login', name: 'LT-04 login' },
  });
  requireSetupResponse(loginResponse, 'authenticate the dedicated guest account', [302], 'login');
  const location = loginResponse.headers.Location || loginResponse.headers.location || '';
  if (!/^\/dashboard(?:[/?#]|$)/.test(String(location))) {
    throw setupFailure('login', 'redirect-unexpected');
  }
  return { jar, cookie: sessionCookieFromJar(jar) };
}

function authenticatedRequestOptions(jar, phase) {
  return {
    jar,
    responseType: 'text',
    redirects: 0,
    headers: { Accept: 'application/json' },
    tags: { test_case: 'LT-04', phase, name: `LT-04 ${phase}` },
  };
}

function collectCloudinaryUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const candidate = value.trim();
  return CLOUDINARY_URL_PATTERN.test(candidate) ? candidate : null;
}

function explicitCloudinaryUrls() {
  const raw = String(__ENV.K6_LT04_ASSET_URLS || '').trim();
  if (!raw) return [];

  let candidates;
  if (raw.indexOf('[') === 0) {
    try { candidates = JSON.parse(raw); } catch (_) { throw setupFailure('vr-assets', 'explicit-asset-url-invalid'); }
    if (!Array.isArray(candidates)) throw setupFailure('vr-assets', 'explicit-asset-url-invalid');
  } else {
    // Keep compatibility with the first runner revision, which used newlines.
    candidates = raw.split(/\r?\n|\\n|\|/);
  }

  const urls = [];
  const seen = new Set();
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') throw setupFailure('vr-assets', 'explicit-asset-url-invalid');
    const value = candidate.trim();
    if (!value) continue;
    const safeUrl = collectCloudinaryUrl(value);
    if (!safeUrl) throw setupFailure('vr-assets', 'explicit-asset-url-invalid');
    if (seen.has(safeUrl)) continue;
    seen.add(safeUrl);
    urls.push(safeUrl);
  }
  return urls;
}

function classifyMediaValue(value) {
  if (typeof value !== 'string' || value.trim() === '') return 'null';
  const raw = value.trim();
  if (raw.indexOf('/img/') === 0) return 'local';
  if (CLOUDINARY_URL_PATTERN.test(raw)) return 'cloudinary';
  if (DRIVE_URL_PATTERN.test(raw)) return 'drive';
  return 'other';
}

function discoverPanoramas(session) {
  const catalog = http.get(
    `${BASE_URL}/api/routes`,
    authenticatedRequestOptions(session.jar, 'setup-route-catalog')
  );
  requireSetupResponse(catalog, 'read the route catalog', [200], 'route-catalog');
  let catalogBody;
  try { catalogBody = catalog.json(); } catch (_) { throw setupFailure('route-catalog', 'body-invalid'); }
  if (!catalogBody || catalogBody.success !== true || !Array.isArray(catalogBody.routes)) {
    throw setupFailure('route-catalog', 'body-invalid');
  }

  const routeIds = Array.from(new Set(catalogBody.routes
    .map((route) => Number(route && (route.id || route.route_id)))
    .filter((id) => Number.isSafeInteger(id) && id > 0)))
    .slice(0, MAX_ROUTE_PROBES);
  if (routeIds.length === 0) throw setupFailure('route-catalog', 'routes-empty');

  const urls = [];
  const seen = new Set();
  for (const routeId of routeIds) {
    if (urls.length >= MAX_ASSETS) break;
    const response = http.get(
      `${BASE_URL}/api/vr/routes/${encodeURIComponent(routeId)}?mode=vehicle&direction=entry`,
      authenticatedRequestOptions(session.jar, 'setup-vr-route')
    );
    if (!response || response.status !== 200) {
      setupRouteFailures.add(1);
      setupCounts.routeFailures += 1;
      continue;
    }
    setupRouteResponses.add(1);
    setupCounts.routeResponses += 1;
    let body;
    try { body = response.json(); } catch (_) {
      setupRouteFailures.add(1);
      setupCounts.routeFailures += 1;
      continue;
    }
    if (!body || body.success !== true || !Array.isArray(body.scenes)) {
      setupRouteFailures.add(1);
      setupCounts.routeFailures += 1;
      continue;
    }
    if (body.scenes.length === 0) {
      setupRoutesNoScenes.add(1);
      setupCounts.routesNoScenes += 1;
    }
    for (const scene of body.scenes) {
      setupScenes.add(1);
      setupCounts.scenes += 1;
      const mediaKind = classifyMediaValue(scene && scene.image_url);
      if (mediaKind === 'cloudinary') {
        setupCloudinary.add(1);
        setupCounts.cloudinary += 1;
      } else if (mediaKind === 'local') {
        setupLocal.add(1);
        setupCounts.local += 1;
      } else if (mediaKind === 'drive') {
        setupDrive.add(1);
        setupCounts.drive += 1;
      } else if (mediaKind === 'null') {
        setupNull.add(1);
        setupCounts.nullMedia += 1;
      } else {
        setupOther.add(1);
        setupCounts.other += 1;
      }
      const safeUrl = collectCloudinaryUrl(scene && scene.image_url);
      if (!safeUrl || seen.has(safeUrl)) continue;
      seen.add(safeUrl);
      urls.push(safeUrl);
      if (urls.length >= MAX_ASSETS) break;
    }
  }

  if (urls.length < MIN_ASSETS) {
    throw setupFailure(
      'vr-assets',
      `only-${urls.length}-approved-cloudinary-assets; route_responses=${setupCounts.routeResponses}; route_failures=${setupCounts.routeFailures}; routes_without_scenes=${setupCounts.routesNoScenes}; scenes=${setupCounts.scenes}; local=${setupCounts.local}; drive=${setupCounts.drive}; null=${setupCounts.nullMedia}; other=${setupCounts.other}`
    );
  }
  return urls;
}

function logoutSession(session) {
  const csrfResponse = http.get(`${BASE_URL}/auth/csrf-token`, {
    jar: session.jar,
    responseType: 'text',
    redirects: 0,
    headers: { Accept: 'application/json' },
    tags: { test_case: 'LT-04', phase: 'teardown-csrf', name: 'LT-04 logout token' },
  });
  if (!csrfResponse || csrfResponse.status !== 200) {
    throw new Error('LT-04 session cleanup could not obtain the authenticated request token.');
  }
  let body;
  try { body = csrfResponse.json(); } catch (_) { body = null; }
  const csrfToken = body && body.success === true ? String(body.csrfToken || '') : '';
  if (!csrfToken) throw new Error('LT-04 session cleanup received an invalid request token.');

  const logoutResponse = http.post(`${BASE_URL}/logout`, null, {
    jar: session.jar,
    responseType: 'none',
    redirects: 0,
    headers: { Accept: 'application/json', 'X-CSRF-Token': csrfToken },
    tags: { test_case: 'LT-04', phase: 'teardown-logout', name: 'LT-04 logout' },
  });
  if (!logoutResponse || logoutResponse.status !== 200) {
    throw new Error('LT-04 session cleanup could not terminate the test session.');
  }
}

export function setup() {
  let session = null;
  try {
    session = setupLogin();
    const explicitUrls = explicitCloudinaryUrls();
    if (explicitUrls.length > 0 && explicitUrls.length < MIN_ASSETS) {
      throw setupFailure('vr-assets', `only-${explicitUrls.length}-explicit-cloudinary-assets`);
    }
    const assetUrls = explicitUrls.length > 0 ? explicitUrls : discoverPanoramas(session);
    if (explicitUrls.length > 0) {
      setupExplicitCloudinary.add(assetUrls.length);
      console.log(`LT-04 setup complete; ${assetUrls.length} explicitly supplied approved panorama assets selected.`);
    } else {
      console.log(`LT-04 setup complete; ${assetUrls.length} approved panorama assets selected.`);
    }
    return { sessionCookie: session.cookie, assetUrls };
  } catch (error) {
    if (session) {
      try { logoutSession(session); } catch (_) { console.error('LT-04 setup cleanup encountered a session-termination error.'); }
    }
    const safeMessage = error && typeof error.message === 'string' && error.message.indexOf('LT-04 setup stage ') === 0
      ? error.message
      : 'LT-04 setup stage failed (unexpected).';
    console.error(safeMessage);
    throw new Error('LT-04 setup failed; no asset workload was started.');
  }
}

function responseContentType(response) {
  if (!response || !response.headers) return '';
  return String(response.headers['Content-Type'] || response.headers['content-type'] || '').toLowerCase();
}

function recordAssetResponse(response, slot) {
  const status = response && Number.isFinite(Number(response.status)) ? Number(response.status) : 0;
  const duration = response && response.timings && Number.isFinite(Number(response.timings.duration))
    ? Number(response.timings.duration)
    : REQUEST_TIMEOUT_MS;
  const contentType = responseContentType(response);
  const received = status > 0;
  const statusOk = status === 200;
  const noRedirect = status < 300 || status >= 400;
  const typeOk = /^image\//i.test(contentType);
  const durationOk = duration < REQUEST_TIMEOUT_MS;
  const passed = received && statusOk && noRedirect && typeOk && durationOk;

  assetRequests.add(1);
  assetDuration.add(duration);
  assetSuccess.add(passed ? 1 : 0);
  assetNoResponse.add(received ? 0 : 1);
  if (status >= 300 && status < 400) assetRedirect.add(1);
  else if (status >= 400 && status < 500) assetClientError.add(1);
  else if (status >= 500) assetServerError.add(1);
  else if (!statusOk && status > 0) assetOtherStatus.add(1);
  if (!typeOk) assetContentTypeFailure.add(1);

  const checksPassed = check(response, {
    'LT-04 panorama response received': () => received,
    'LT-04 panorama status is 200': () => statusOk,
    'LT-04 panorama did not redirect': () => noRedirect,
    'LT-04 panorama content type is image': () => typeOk,
    'LT-04 panorama completed before timeout': () => durationOk,
  });
  if (!checksPassed) {
    console.warn(`LT-04 asset slot ${slot} failed (status=${status}, content_type=${typeOk ? 'image' : 'other'}).`);
  }
}

export default function (data) {
  const urls = data && Array.isArray(data.assetUrls) ? data.assetUrls : [];
  if (urls.length < MIN_ASSETS) {
    assetSuccess.add(0);
    check(null, { 'LT-04 has a discovered panorama pool': () => false });
    return;
  }
  const slot = ((__VU - 1) + (__ITER * ASSET_VUS)) % urls.length;
  const response = http.get(urls[slot], {
    timeout: `${REQUEST_TIMEOUT_MS}ms`,
    redirects: 0,
    responseType: 'none',
    tags: {
      test_case: 'LT-04',
      phase: 'asset-download',
      name: 'LT-04 Cloudinary panorama',
      asset_slot: String(slot + 1),
    },
  });
  recordAssetResponse(response, slot + 1);
}

export function teardown(data) {
  const cookie = String(data && data.sessionCookie || '');
  if (!cookie) throw new Error('LT-04 teardown did not receive the setup session.');
  const jar = new http.CookieJar();
  jar.set(`${BASE_URL}/`, SESSION_COOKIE_NAME, cookie, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
  });
  logoutSession({ jar, cookie });
}

export function handleSummary(data) {
  const safeSummary = { ...data };
  delete safeSummary.setup_data;
  const summaryPath = String(__ENV.K6_SUMMARY_PATH || '').trim();
  if (!summaryPath) return { stdout: JSON.stringify(safeSummary, null, 2) };
  return { [summaryPath]: JSON.stringify(safeSummary, null, 2) };
}
