import { browser } from 'k6/browser';
import { check, fail } from 'k6';

/*
 * LT-01 is the single-user Production baseline.  It deliberately performs a
 * real browser login so the result covers the same authenticated map surface
 * a guest sees in Chrome.  Credentials are supplied only through the parent
 * process environment and are never logged by this script.
 */
const BASE_URL = String(__ENV.BASE_URL || '').replace(/\/+$/, '');
const EMAIL = String(__ENV.K6_TEST_EMAIL || '');
const PASSWORD = String(__ENV.K6_TEST_PASSWORD || '');
const PAGE_SCREENSHOT = String(__ENV.K6_PAGE_SCREENSHOT_PATH || '');
const EXPECTED_HOST = 'campusphere-cspc.vercel.app';

if (!/^https:\/\/[a-z0-9.-]+$/i.test(BASE_URL)) {
  throw new Error('BASE_URL must be an HTTPS origin.');
}
const BASE_HOST = BASE_URL.replace(/^https:\/\//i, '').toLowerCase();
if (BASE_HOST !== EXPECTED_HOST) {
  throw new Error(`LT-01 refuses a non-Production host: ${BASE_HOST}`);
}
if (!EMAIL || !PASSWORD) {
  throw new Error('K6_TEST_EMAIL and K6_TEST_PASSWORD are required.');
}

export const options = {
  scenarios: {
    baseline_browser: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '2m',
      options: { browser: { type: 'chromium' } },
    },
  },
  thresholds: {
    checks: [{ threshold: 'rate==1.0', abortOnFail: true, delayAbortEval: '10s' }],
    http_req_failed: ['rate==0.0'],
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
  },
};

async function login(page) {
  console.log('LT-01: opening authentication page');
  await page.goto(`${BASE_URL}/auth`, { waitUntil: 'domcontentloaded' });
  await page.locator('#loginForm').waitFor({ state: 'visible' });
  await page.locator('#loginEmail').fill(EMAIL);
  await page.locator('#loginPassword').fill(PASSWORD);
  await Promise.all([
    page.waitForURL(/\/dashboard(?:[/?#]|$)/, { waitUntil: 'domcontentloaded' }),
    page.locator('#loginEmailBtn').click(),
  ]);
  console.log('LT-01: login completed');
}

async function inspectMap(page) {
  await page.goto(`${BASE_URL}/map`, { waitUntil: 'domcontentloaded' });
  await page.locator('#mapView').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator(
    '#mapView .maplibregl-canvas, #mapView .leaflet-container, #mapView .map-fallback'
  ).waitFor({
    state: 'visible',
    timeout: 30000,
  });
  await page.waitForTimeout(2500);

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

  check(page, {
    'map stayed on the authenticated /map page': () => mapUrl.includes('/map'),
    'map surface is rendered': () => mapSurfaceCount > 0,
    'map has the fixed Guard House start label': () => /Guard House/i.test(startText),
    'map has building labels': () => buildingLabelCount > 0,
    'map exposes route controls': () => /Plan Route|Find Location/i.test(pageText),
  });
  console.log(`LT-01: map checks collected (surface=${mapSurfaceCount}, start=${startLabelCount}, buildings=${buildingLabelCount})`);

  if (PAGE_SCREENSHOT && __ITER === 0) {
    await page.screenshot({ path: PAGE_SCREENSHOT, fullPage: true });
    console.log('LT-01: map screenshot saved');
  }
}

async function logout(page) {
  console.log('LT-01: logging out');
  const button = page.locator('#logoutBtn');
  await button.waitFor({ state: 'attached', timeout: 30000 });
  await page.locator('.dash-nav__user').click();
  await button.waitFor({ state: 'visible', timeout: 10000 });
  await button.click();
  await page.waitForURL(/\/auth(?:[/?#]|$)/, { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('LT-01: logout completed');
}

export default async function () {
  const page = await browser.newPage();
  let loggedIn = false;
  try {
    await login(page);
    loggedIn = true;
    await inspectMap(page);
    await logout(page);
    loggedIn = false;
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    console.error(`LT-01 browser flow failed: ${message}`);
    check(page, { 'LT-01 completed without a browser error': () => false });
    fail(`LT-01 browser flow failed: ${message}`);
  } finally {
    if (loggedIn) {
      try { await logout(page); } catch (_) { /* preserve the original failure */ }
    }
    await page.close();
  }
}
