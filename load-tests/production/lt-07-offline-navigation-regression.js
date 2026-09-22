import { browser } from 'k6/browser';
import { check } from 'k6';

const BASE_URL = 'http://127.0.0.1:3397';

export const options = {
  scenarios: {
    offline_navigation_regression: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '45s',
      options: { browser: { type: 'chromium' } },
    },
  },
  thresholds: { checks: ['rate==1.0'] },
};

async function waitUntil(page, predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await page.evaluate(predicate)) return true;
    } catch (_) {
      // A navigation can briefly replace the execution context.
    }
    await page.waitForTimeout(100);
  }
  return false;
}

export default async function () {
  const context = await browser.newContext();
  const page = await context.newPage();
  let controlled = false;
  let cached = false;
  let offlineShell = false;

  try {
    await page.goto(`${BASE_URL}/online`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await waitUntil(page, async () => {
      if (!('serviceWorker' in navigator)) return false;
      try { await navigator.serviceWorker.ready; } catch (_) { return false; }
      return true;
    }, 10000);

    controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
    if (!controlled) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
      controlled = await waitUntil(page, () => Boolean(navigator.serviceWorker.controller), 10000);
    }

    cached = await page.evaluate(async () => Boolean(await caches.match(
      new URL('/offline.html', window.location.origin).href
    )));

    await context.setOffline(true);
    await page.evaluate(() => {
      // Return the CDP evaluation result before the controlled navigation
      // replaces this document. This is the LT-07 production harness pattern.
      setTimeout(() => window.location.assign('/online?offline=1'), 0);
      return true;
    });
    offlineShell = await waitUntil(page, () => Boolean(
      document.body && document.body.classList.contains('offline-page')
    ), 10000);
  } finally {
    try { await context.setOffline(false); } catch (_) { /* context is closing */ }
    try { await page.close(); } catch (_) { /* context close remains authoritative */ }
    await context.close();
  }

  check({ controlled, cached, offlineShell }, {
    'fixture page is service-worker controlled': (value) => value.controlled === true,
    'fixture offline shell is precached': (value) => value.cached === true,
    'scheduled browser navigation reaches the offline shell': (value) => value.offlineShell === true,
  });
}
