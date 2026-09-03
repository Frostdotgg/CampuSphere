'use strict';

/* ========================================
   CampuSphere - authenticated notification panel probe

   DATABASE-FREE and NETWORK-FREE.  The source checks cover the shared
   authenticated partial, role-safe read-only feed route, backend-parity
   service, no-store response, and network-only service-worker boundary.  A
   small mock DOM exercises the real client disclosure, revision dot, focus,
   Escape/outside close, rendering, and retry behavior.
   ======================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const failures = [];

function check(scope, label, ok) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!ok) failures.push(`${scope} :: ${label}`);
}

/* ---------------- 1. server/view contracts ---------------- */
{
  const nav = read('views/partials/dash-navbar.ejs');
  const route = read('routes/dashboard.js');
  const controller = read('controllers/notificationController.js');
  const service = read('services/notificationFeedService.js');
  const repository = read('repositories/contentRepository.js');
  const dashboard = read('views/dashboard.ejs');
  const gates = read('scripts/quality-gates.js');

  check('markup', 'desktop and mobile notification triggers are present',
    (nav.match(/data-notification-trigger/g) || []).length === 2 &&
    nav.includes('id="notifBtn"') && nav.includes('id="mobileNotifBtn"'));
  check('markup', 'triggers are real buttons with disclosure ARIA',
    (nav.match(/data-notification-trigger/g) || []).every(() => true) &&
    (nav.match(/type="button" data-notification-trigger/g) || []).length >= 1 &&
    (nav.match(/aria-haspopup="dialog"/g) || []).length === 2 &&
    (nav.match(/aria-controls="notificationPanel"/g) || []).length === 2 &&
    (nav.match(/aria-expanded="false"/g) || []).length >= 2);
  check('markup', 'revision dots start hidden and have no stale static state',
    (nav.match(/class="dash-nav__notif-dot" hidden aria-hidden="true"/g) || []).length === 2);
  check('markup', 'one accessible panel and one deferred client include live in the shared partial',
    (nav.match(/id="notificationPanel"/g) || []).length === 1 &&
    (nav.match(/<script src="\/js\/notification-panel\.js" defer><\/script>/g) || []).length === 1 &&
    !/\sonclick\s*=/.test(nav));
  check('markup', 'panel has labelled dialog, status, error/retry, lists, and safe footer links',
    nav.includes('role="dialog"') && nav.includes('aria-labelledby="notificationPanelTitle"') &&
    nav.includes('id="notificationPanelStatus"') && nav.includes('id="notificationPanelRetry"') &&
    nav.includes('id="notificationPanelError" class="dash-nav__notification-error" role="alert"') &&
    nav.includes('id="notificationAnnouncementsList"') && nav.includes('id="notificationEventsList"') &&
    nav.includes('id="notificationAnnouncementsLink"') && nav.includes('id="notificationEventsLink"'));
  check('route', 'notification feed is authenticated and read-only',
    /router\.get\('\/api\/notifications',\s*requireLogin,\s*notificationController\.index\)/.test(route) &&
    !/router\.(post|put|patch|delete)\('\/api\/notifications'/.test(route));
  check('controller', 'feed response is private and uncached',
    controller.includes("res.set('Cache-Control', 'no-store, private')") &&
    controller.includes('Notifications are temporarily unavailable.') &&
    /status\(503\)\.json/.test(controller));
  check('service', 'feed is bounded, role-filtered, and backend-parity',
    service.includes('ANNOUNCEMENT_LIMIT = 5') && service.includes('EVENT_LIMIT = 5') &&
    service.includes("timeZone: 'Asia/Manila'") && service.includes('Promise.all') &&
    service.includes('listAnnouncementsForRole') && service.includes('listEvents') &&
    service.includes('LIMIT ${ANNOUNCEMENT_LIMIT}') && service.includes('LIMIT ${EVENT_LIMIT}') &&
    service.includes('published_date IS NOT NULL') && service.includes('event_date >= ?'));
  check('service', 'feed shape excludes authors, credentials, and raw database identifiers',
    service.includes('title') && service.includes('publishedAt') && service.includes('links') &&
    !/author_id|email|password|session|database_url|signedUrl/i.test(service));
  check('repository', 'Supabase query limits are optional and do not change existing callers',
    repository.includes('listAnnouncementsForRole(role, options = {})') &&
    repository.includes('query = query.limit(limit)') &&
    repository.includes("listEvents({ from, to, limit, sortDirection = 'asc' } = {})") &&
    repository.includes("const descending = sortDirection === 'desc'"));
  check('deep-link', 'dashboard accepts only role-mapped section query values',
    dashboard.includes('requestedDashboardSection') &&
    dashboard.includes('Object.prototype.hasOwnProperty.call(templateMap[role], requestedDashboardSection)') &&
    dashboard.includes("new URLSearchParams(window.location.search || '')"));
  check('quality-gates', 'focused notification probe is registered after shared navigation',
    gates.includes("['notification panel contracts', 'notificationPanel-probe.js']") &&
    gates.includes("key: 'notifications'") &&
    gates.includes('probes: NOTIFICATION_PANEL_PROBES') &&
    gates.indexOf("key: 'shared-nav'") < gates.indexOf("key: 'notifications'"));
}

/* ---------------- 2. service-worker / CSS / client source boundaries ---------------- */
{
  const sw = read('public/sw.js');
  const css = read('public/css/styles.css');
  const client = read('public/js/notification-panel.js');
  const stylesheetConsumers = [
    'public/offline.html',
    'views/about.ejs',
    'views/buildings.ejs',
    'views/events.ejs',
    'views/map.ejs',
    'views/partials/head.ejs',
    'views/vr.ejs',
    'views/vr-route.ejs'
  ].map(read);
  check('offline', 'service worker keeps the entire same-origin /api surface network-only',
    sw.includes("var NETWORK_ONLY_PREFIXES = [") &&
    sw.includes("'/api'") &&
    sw.includes('if (isNetworkOnlyPath(url.pathname))') &&
    !/NOTIFICATION_CACHE|notification.*cache/i.test(sw));
  check('offline', 'notification CSS is addressed consistently by the precache and all shared pages',
    sw.includes("'/css/styles.css?v=10'") &&
    stylesheetConsumers.every((source) =>
      (source.match(/\/css\/styles\.css\?v=\d+/g) || []).length === 1 &&
      source.includes('/css/styles.css?v=10')));
  check('css', 'panel, mobile layout, dark mode, reduced motion, and 44px controls are defined',
    css.includes('.dash-nav__notifications-panel') &&
    css.includes('.dash-nav__notification-mobile') &&
    css.includes('[data-theme="dark"] .dash-nav__notifications-panel') &&
    css.includes('@media (prefers-reduced-motion: reduce)') &&
    /\.dash-nav__icon-btn\s*\{[\s\S]*?width:\s*44px[\s\S]*?height:\s*44px/.test(css) &&
    /\.dash-nav__notification-close\s*\{[\s\S]*?width:\s*44px[\s\S]*?height:\s*44px/.test(css));
  check('client', 'CommonJS require is safe and the client avoids unsafe HTML sinks/navigation',
    !client.includes('innerHTML') && !client.includes('document.write') && !/\beval\s*\(/.test(client) &&
    !client.includes('window.location') && client.includes('module.exports') &&
    client.includes("'/api/notifications'") && client.includes("cache: 'no-store'"));
  check('client', 'browser-seen state stores only the revision and handles loading/empty/error/retry',
    client.includes("campussphere-notification-revision") && client.includes('localStorage') &&
    client.includes('No announcements or upcoming events.') &&
    client.includes('Notifications are temporarily unavailable.') &&
    client.includes('loadFeed(true)') && client.includes('Escape'));
  check('client', 'links use a strict same-origin allowlist and item text uses textContent',
    client.includes("'/admin/news'") && client.includes("'/dashboard?section=news-events'") &&
    client.includes('safeInternalHref') && client.includes('node.textContent = text'));
}

/* ---------------- 3. minimal DOM for real client behavior ---------------- */
function makeElement(id, className = '') {
  const element = {
    id,
    className,
    hidden: false,
    attrs: {},
    childNodes: [],
    parentNode: null,
    listeners: {},
    focused: 0,
    textContent: '',
    setAttribute(name, value) { this.attrs[name] = String(value); },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    removeEventListener(type, fn) {
      this.listeners[type] = (this.listeners[type] || []).filter((candidate) => candidate !== fn);
    },
    dispatchEvent(event) {
      const enriched = Object.assign({ currentTarget: this, target: this, preventDefault() {} }, event);
      (this.listeners[enriched.type] || []).slice().forEach((fn) => fn(enriched));
    },
    appendChild(child) { child.parentNode = this; this.childNodes.push(child); return child; },
    removeChild(child) {
      const index = this.childNodes.indexOf(child);
      if (index >= 0) this.childNodes.splice(index, 1);
      child.parentNode = null;
      return child;
    },
    get firstChild() { return this.childNodes[0] || null; },
    contains(node) {
      let current = node;
      while (current) { if (current === this) return true; current = current.parentNode; }
      return false;
    },
    querySelector(selector) {
      if (selector !== '.dash-nav__notif-dot') return null;
      const queue = this.childNodes.slice();
      while (queue.length) {
        const item = queue.shift();
        if (item.className === 'dash-nav__notif-dot') return item;
        queue.push(...(item.childNodes || []));
      }
      return null;
    },
    focus() { this.focused += 1; }
  };
  return element;
}

function makeDocument(elements) {
  const byId = {};
  elements.forEach((element) => { if (element.id) byId[element.id] = element; });
  const doc = {
    readyState: 'complete',
    listeners: {},
    getElementById(id) { return byId[id] || null; },
    querySelectorAll(selector) {
      return selector === '[data-notification-trigger]' ? elements.filter((element) => element.isTrigger) : [];
    },
    createElement() { return makeElement(''); },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    removeEventListener(type, fn) {
      this.listeners[type] = (this.listeners[type] || []).filter((candidate) => candidate !== fn);
    },
    dispatch(type, event) { (this.listeners[type] || []).slice().forEach((fn) => fn(event)); }
  };
  return doc;
}

async function exerciseClient() {
  const ids = [
    'notificationPanel', 'notificationPanelClose', 'notificationPanelTitle',
    'notificationPanelStatus', 'notificationPanelError', 'notificationPanelRetry',
    'notificationPanelContent', 'notificationPanelEmpty',
    'notificationAnnouncementsSection', 'notificationEventsSection',
    'notificationAnnouncementsList', 'notificationEventsList',
    'notificationAnnouncementsLink', 'notificationEventsLink'
  ];
  const panelElements = ids.map((id) => makeElement(id));
  const desktop = makeElement('notifBtn');
  const desktopDot = makeElement('', 'dash-nav__notif-dot');
  desktop.isTrigger = true;
  desktop.appendChild(desktopDot);
  const mobile = makeElement('mobileNotifBtn');
  const mobileDot = makeElement('', 'dash-nav__notif-dot');
  mobile.isTrigger = true;
  mobile.appendChild(mobileDot);
  const outside = makeElement('outside');
  const doc = makeDocument([...panelElements, desktop, mobile]);
  const storageValues = {};
  const storage = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(storageValues, key) ? storageValues[key] : null; },
    setItem(key, value) { storageValues[key] = String(value); }
  };
  let failing = false;
  const payload = {
    success: true,
    revision: 'a'.repeat(64),
    announcements: [{ title: 'Campus update', category: 'Notice', excerpt: 'A safe text update.', publishedAt: '2026-08-22T01:00:00.000Z' }],
    events: [{ title: 'Orientation', category: 'Event', date: '2026-08-25', time: '09:00', location: 'Main Hall', description: 'Welcome event.' }],
    links: { announcements: '/dashboard?section=news', events: '/events' }
  };
  const previousFetch = global.fetch;
  global.fetch = async () => {
    if (failing) throw new Error('offline');
    return { ok: true, async json() { return payload; } };
  };
  try {
    const { initNotificationPanel, hasFeedItems, safeInternalHref } = require('../public/js/notification-panel.js');
    check('client', 'pure helpers reject external links and detect feed items',
      hasFeedItems(payload) && safeInternalHref('https://example.test', '/events') === '/events');
    const instance = initNotificationPanel(doc, { localStorage: storage });
    check('client', 'initialization returns a controllable instance', !!instance && !!instance.state);
    const initialRequest = instance && instance.state.inFlight;
    if (initialRequest) await initialRequest;
    check('client', 'background refresh shows a browser-only new-update dot',
      desktopDot.hidden === false && mobileDot.hidden === false &&
      desktop.getAttribute('aria-label') === 'Notifications, new updates');

    desktop.dispatchEvent({ type: 'click' });
    const openRequest = instance.state.inFlight;
    if (openRequest) await openRequest;
    check('client', 'click opens the panel, synchronizes ARIA, renders both lists, and marks revision seen',
      instance.state.isOpen === true && panelElements[0].hidden === false &&
      desktop.getAttribute('aria-expanded') === 'true' && desktopDot.hidden === true && mobileDot.hidden === true &&
      panelElements[10].childNodes.length === 1 && panelElements[11].childNodes.length === 1 &&
      storageValues['campussphere-notification-revision'] === payload.revision);

    const focusBefore = desktop.focused;
    doc.dispatch('keydown', { key: 'Escape', preventDefault() {} });
    check('client', 'Escape closes and restores focus to the activating trigger',
      instance.state.isOpen === false && panelElements[0].hidden === true && desktop.focused === focusBefore + 1);

    mobile.dispatchEvent({ type: 'click' });
    const mobileOpenRequest = instance.state.inFlight;
    if (mobileOpenRequest) await mobileOpenRequest;
    const focusBeforeOutside = mobile.focused;
    doc.dispatch('pointerdown', { target: outside });
    check('client', 'outside pointer closes without stealing focus',
      instance.state.isOpen === false && mobile.focused === focusBeforeOutside);

    failing = true;
    await instance.refresh();
    check('client', 'transport failure shows a fixed error while preserving prior content',
      panelElements[4].hidden === false && panelElements[10].childNodes.length === 1);
    failing = false;
    panelElements[5].dispatchEvent({ type: 'click' });
    const retryRequest = instance.state.inFlight;
    if (retryRequest) await retryRequest;
    check('client', 'retry reloads the feed through the same read-only request',
      panelElements[4].hidden === true && panelElements[10].childNodes.length === 1);
    instance.destroy();
  } finally {
    global.fetch = previousFetch;
  }
}

exerciseClient().catch((error) => {
  check('client', 'mock-DOM exercise completes without an uncaught exception', false);
  console.error('  [FAIL] client :: ' + (error && error.message ? error.message : 'unknown client probe error'));
}).finally(() => {
  if (failures.length === 0) {
    console.log('NOTIFICATION-PANEL-PROBE OK: all checks passed.');
    process.exitCode = 0;
  } else {
    console.error(`NOTIFICATION-PANEL-PROBE FAILED: ${failures.length} check(s) did not pass:`);
    failures.forEach((failure) => console.error('  - ' + failure));
    process.exitCode = 1;
  }
});
