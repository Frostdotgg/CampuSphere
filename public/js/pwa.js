/* ========================================
   CampuSphere PWA bootstrap
   Milestone 6, Section 6.3.

   Responsibilities (kept intentionally small):
   - Register the service worker (/sw.js) when supported.
   - Show an accessible, non-blocking online/offline status banner.

   Out of scope for this section:
   - No app-shell / runtime caching logic (that lives in /sw.js + Section 6.4).
   - No IndexedDB / offline catalog (Section 6.5).
   - No third-party libraries. No private user data is read or stored.
   ======================================== */
(function () {
  'use strict';

  /* ---- 0. Centralized sensitive-path classifier (Section 6.7) ----
     Single source of truth shared by: service-worker registration gating and
     offline-catalog exclusion (page capture + API fetch observer). Mirrors the
     service worker's FORBIDDEN_PREFIXES so the two lists cannot drift. */
  var SENSITIVE_PREFIXES = [
    '/auth',
    '/login',
    '/register',
    '/logout',
    '/admin',              // covers /admin, /admin/*, /admin/api/*
    '/api/update-profile'  // covers /api/update-profile and descendants
  ];
  function isSensitivePath(pathname) {
    var p = String(pathname || '');
    for (var i = 0; i < SENSITIVE_PREFIXES.length; i++) {
      var prefix = SENSITIVE_PREFIXES[i];
      if (p === prefix || p.indexOf(prefix + '/') === 0) return true;
    }
    return false;
  }

  /* ---- 1. Service worker registration (progressive enhancement) ----
     Sensitive pages (auth/login/register/logout/admin/profile-write) never
     initiate a new registration. An existing root-scope worker may still
     control them, but its forbidden-path guards keep those requests
     network-only. We never unregister an existing worker. */

  /* Update-lifecycle state (OFF.2). Module-scoped so each guard is evaluated
     exactly once per page load. */
  var swRegistration = null;
  var userAcceptedUpdate = false;   // set ONLY by the explicit update action
  var reloadingForUpdate = false;   // one-shot reload latch
  var controllerChangeBound = false;
  var lastUpdateCheckAt = 0;
  var UPDATE_CHECK_MIN_INTERVAL_MS = 60000; // throttle for flapping connections

  if ('serviceWorker' in navigator && !isSensitivePath(location.pathname)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').then(function (reg) {
        watchRegistration(reg);
      }).catch(function (err) {
        // Non-fatal: the app continues to work without the service worker.
        var msg = (err && err.message) ? err.message : String(err);
        console.warn('[pwa] Service worker registration failed:', msg);
      });
    });
  }

  /* ---- 1b. Update-available detection and user-controlled activation (OFF.2) ----

     Contract:
       - A waiting worker is surfaced, never auto-activated.
       - navigator.serviceWorker.controller gates every prompt, so a FIRST
         installation (which has no controller) can never raise a false
         "update available" message.
       - { type: 'SKIP_WAITING' } is posted only from the user's explicit
         action, never on load, install, or reconnect.
       - controllerchange is bound ONCE and reloads at most ONCE, and only when
         this page's user asked for the update — a swap triggered by another tab
         must never reload this page or discard what the user was doing. */

  function bindControllerChangeOnce() {
    if (controllerChangeBound) return;
    controllerChangeBound = true;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!userAcceptedUpdate) return;   // never a silent reload
      if (reloadingForUpdate) return;    // never a reload loop
      reloadingForUpdate = true;
      window.location.reload();
    });
  }

  function watchInstallingWorker(worker) {
    if (!worker) return;
    worker.addEventListener('statechange', function () {
      // 'installed' + an existing controller == a genuine update is waiting.
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        showUpdatePrompt(worker);
      }
      // 'redundant' means the installation failed (e.g. an interrupted precache).
      // The active worker is untouched and nothing is shown to the user.
    });
  }

  function watchRegistration(reg) {
    if (!reg) return;
    swRegistration = reg;
    bindControllerChangeOnce();
    if (reg.waiting && navigator.serviceWorker.controller) {
      showUpdatePrompt(reg.waiting);
    }
    reg.addEventListener('updatefound', function () {
      watchInstallingWorker(reg.installing);
    });
  }

  /* Reconnect handling: ask the browser to re-check /sw.js. This is a safe GET
     performed by the browser itself — it activates nothing, reloads nothing,
     and discards no user state. Throttled so a flapping connection cannot
     hammer the network. */
  function requestUpdateCheck() {
    if (!swRegistration) return;
    var now = Date.now();
    if (now - lastUpdateCheckAt < UPDATE_CHECK_MIN_INTERVAL_MS) return;
    lastUpdateCheckAt = now;
    try {
      var p = swRegistration.update();
      if (p && typeof p.catch === 'function') p.catch(function () { /* offline again: ignore */ });
    } catch (e) { /* never surface a raw error */ }
  }

  /* ---- 2. Accessible, non-blocking connectivity status banner ---- */
  var BANNER_ID = 'cs-connectivity-status';
  var hideTimer = null;

  function getBanner() {
    var el = document.getElementById(BANNER_ID);
    if (el) return el;

    el = document.createElement('div');
    el.id = BANNER_ID;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.hidden = true;

    // Inline styles only (no external CSS dependency).
    // pointer-events:none guarantees the banner can never block taps/clicks
    // on the navbar, map sidebar, or VR next/prev controls beneath it.
    el.style.cssText = [
      'position:fixed',
      'left:50%',
      'transform:translateX(-50%)',
      'bottom:calc(16px + env(safe-area-inset-bottom, 0px))',
      'z-index:2147483646',
      'max-width:calc(100vw - 24px)',
      'box-sizing:border-box',
      'margin:0',
      'padding:8px 16px',
      'border-radius:999px',
      'font:600 0.85rem/1.25 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
      'text-align:center',
      'box-shadow:0 6px 20px rgba(0,0,0,0.28)',
      'pointer-events:none',
      'opacity:0',
      'transition:opacity .2s ease'
    ].join(';');

    (document.body || document.documentElement).appendChild(el);
    return el;
  }

  /* Mobile /map shows a bottom "list" FAB (#mobileListToggle) that the banner
     used to overlap. Lift the banner above the FAB so their rectangles never
     intersect; keep the default bottom position on every other page and on
     desktop. pointer-events stays 'none' regardless, so the FAB is tappable. */
  var bannerMobileQuery = (typeof window.matchMedia === 'function')
    ? window.matchMedia('(max-width: 768px)') : null;
  function isMobileViewport() { return !!(bannerMobileQuery && bannerMobileQuery.matches); }
  var BANNER_DEFAULT_BOTTOM = 'calc(16px + env(safe-area-inset-bottom, 0px))';

  function applyBannerPosition(el) {
    if (!el) return;
    try {
      if (isMobileViewport() && location.pathname === '/map') {
        var fab = document.getElementById('mobileListToggle');
        if (fab) {
          var r = fab.getBoundingClientRect();
          // Only when the FAB is actually laid out and on-screen.
          if (r && r.height > 0 && r.top > 0 && r.top < window.innerHeight) {
            // Banner's bottom edge sits 12px above the FAB's top edge.
            el.style.bottom = (Math.round(window.innerHeight - r.top) + 12) + 'px';
            return;
          }
        }
      }
    } catch (e) { /* fall through to the default position */ }
    el.style.bottom = BANNER_DEFAULT_BOTTOM;
  }

  function repositionBannerIfVisible() {
    var el = document.getElementById(BANNER_ID);
    if (el && !el.hidden) applyBannerPosition(el);
  }
  window.addEventListener('resize', repositionBannerIfVisible);
  window.addEventListener('orientationchange', repositionBannerIfVisible);

  function clearHideTimer() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function show(message, tone, autoHideMs) {
    var el = getBanner();
    clearHideTimer();
    el.textContent = message;
    applyBannerPosition(el);
    if (tone === 'offline') {
      el.style.background = '#7a2e0e';
      el.style.color = '#ffffff';
    } else {
      el.style.background = '#0f5132';
      el.style.color = '#ffffff';
    }
    el.hidden = false;
    // Force reflow so the opacity transition runs from 0 -> 1.
    void el.offsetWidth;
    el.style.opacity = '1';
    if (autoHideMs) {
      hideTimer = setTimeout(hide, autoHideMs);
    }
  }

  function hide() {
    clearHideTimer();
    var el = document.getElementById(BANNER_ID);
    if (!el) return;
    el.style.opacity = '0';
    hideTimer = setTimeout(function () {
      var node = document.getElementById(BANNER_ID);
      if (node) node.hidden = true;
    }, 220);
  }

  /* ---- 2b. Accessible, non-blocking "update available" prompt (OFF.2) ----
     A polite live region, NOT a dialog: it never traps focus, never covers the
     page, and never blocks interaction with anything beneath it. Its own
     controls are real <button> elements, so they are keyboard reachable and
     announced by assistive technology. Built with createElement/textContent
     only — no innerHTML, no inline handler attribute, so the app's nonce-based
     CSP is unaffected. */
  var UPDATE_ID = 'cs-update-available';
  var updatePromptWorker = null;

  function styleUpdateButton(btn, primary) {
    btn.style.cssText = [
      'appearance:none',
      '-webkit-appearance:none',
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'min-height:36px',
      'padding:6px 14px',
      'border-radius:8px',
      'font:inherit',
      'font-weight:700',
      'cursor:pointer',
      'white-space:nowrap',
      primary ? 'background:#ffffff' : 'background:transparent',
      primary ? 'color:#0f2a44' : 'color:#ffffff',
      primary ? 'border:1px solid #ffffff' : 'border:1px solid rgba(255,255,255,0.6)'
    ].join(';');
    // Inline styles cannot express :focus-visible; mirror it with listeners so
    // keyboard users always get a visible focus indicator.
    btn.addEventListener('focus', function () {
      btn.style.outline = '3px solid #ffd166';
      btn.style.outlineOffset = '2px';
    });
    btn.addEventListener('blur', function () {
      btn.style.outline = 'none';
    });
  }

  function buildUpdatePrompt() {
    var el = document.createElement('div');
    el.id = UPDATE_ID;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.hidden = true;
    el.style.cssText = [
      'position:fixed',
      'left:50%',
      'transform:translateX(-50%)',
      'top:calc(12px + env(safe-area-inset-top, 0px))',
      'z-index:2147483645', // below the connectivity banner, above page content
      'display:flex',
      'flex-wrap:wrap',
      'align-items:center',
      'justify-content:center',
      'gap:10px',
      'max-width:calc(100vw - 24px)',
      'box-sizing:border-box',
      'margin:0',
      'padding:10px 14px',
      'border-radius:12px',
      'background:#0f2a44',
      'color:#ffffff',
      'font:600 0.85rem/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
      'text-align:center',
      'box-shadow:0 6px 20px rgba(0,0,0,0.28)',
      'pointer-events:auto' // it owns its own controls (unlike the status banner)
    ].join(';');

    var text = document.createElement('span');
    text.id = UPDATE_ID + '-text';
    text.textContent = 'A new version of CampuSphere is ready.';
    el.appendChild(text);

    var accept = document.createElement('button');
    accept.type = 'button';
    accept.id = UPDATE_ID + '-accept';
    accept.textContent = 'Update now';
    styleUpdateButton(accept, true);
    accept.addEventListener('click', acceptUpdate);
    el.appendChild(accept);

    var dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.id = UPDATE_ID + '-dismiss';
    dismiss.textContent = 'Not now';
    styleUpdateButton(dismiss, false);
    dismiss.addEventListener('click', hideUpdatePrompt);
    el.appendChild(dismiss);

    (document.body || document.documentElement).appendChild(el);
    return el;
  }

  function getUpdatePrompt() {
    return document.getElementById(UPDATE_ID) || buildUpdatePrompt();
  }

  function showUpdatePrompt(worker) {
    if (!worker) return;
    updatePromptWorker = worker;
    var el = getUpdatePrompt();
    var text = document.getElementById(UPDATE_ID + '-text');
    var accept = document.getElementById(UPDATE_ID + '-accept');
    var dismiss = document.getElementById(UPDATE_ID + '-dismiss');
    if (text) text.textContent = 'A new version of CampuSphere is ready.';
    if (accept) { accept.disabled = false; accept.textContent = 'Update now'; }
    if (dismiss) dismiss.hidden = false;
    el.hidden = false;
  }

  function hideUpdatePrompt() {
    var el = document.getElementById(UPDATE_ID);
    if (el) el.hidden = true;
  }

  /* The ONLY place { type: 'SKIP_WAITING' } is ever sent. Reaching it requires
     a real user activation of the update control. */
  function acceptUpdate() {
    var worker = updatePromptWorker;
    if (!worker) return;
    userAcceptedUpdate = true;

    var text = document.getElementById(UPDATE_ID + '-text');
    var accept = document.getElementById(UPDATE_ID + '-accept');
    var dismiss = document.getElementById(UPDATE_ID + '-dismiss');
    if (text) text.textContent = 'Updating CampuSphere…';
    if (accept) { accept.disabled = true; accept.textContent = 'Updating…'; }
    if (dismiss) dismiss.hidden = true;

    try {
      worker.postMessage({ type: 'SKIP_WAITING' });
    } catch (e) {
      // Sanitized: leave the prompt in its busy state; no raw error is shown.
    }
  }

  function handleOffline() {
    show(
      'You are offline. Pages you already opened may still work; sign-in and live updates need internet.',
      'offline',
      0 // persist while offline
    );
  }

  function handleOnline() {
    // Bounded, accessible confirmation. Reconnecting NEVER reloads the page or
    // discards user state — it only refreshes this status and asks the browser
    // to re-check the worker.
    show('Back online.', 'online', 3000);
    requestUpdateCheck();
  }

  window.addEventListener('offline', handleOffline);
  window.addEventListener('online', handleOnline);

  // Announce only if we are already offline at load; stay quiet when online.
  function init() {
    if (navigator.onLine === false) {
      handleOffline();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ---- 3. Offline demo catalog (Milestone 6, Section 6.5; updated R2) ----
     Records small, FIXED, SAFE metadata about approved demo APIs in IndexedDB so
     later sections can show offline/demo status. After R2 (Authenticated PWA
     Privacy), page HTML is no longer cached OR recorded — this catalog stores
     ONLY privacy-safe approved API metadata, and any obsolete page:* records
     from a prior installation are purged elsewhere in this file (see
     purgeObsoletePageRecords). The service worker cache stays the source of
     cached HTTP responses; this catalog stores NO HTML bodies, NO full API
     payloads, NO user identity, email, role, cookies, sessions, tokens, secrets,
     or cross-origin URLs. */
  var IDB_NAME = 'campusphere-offline-demo';
  var IDB_VERSION = 1;
  var IDB_STORE = 'catalog';
  var idbSupported = (typeof indexedDB !== 'undefined' && !!indexedDB);
  var dbPromise = null;
  var OFFLINE_GUIDE_CONTROL_CHANNEL = 'campusphere-offline-guide-control';
  var OFFLINE_GUIDE_LOGOUT_KEY = 'campusphere-offline-guide-logout';

  /* Durable offline-guide deletion (OFF.2-OFF.5 correction).

     The guide database can hold campus data downloaded under the previous
     authenticated session, so on a shared device its deletion must survive a
     blocked request, a closed tab, or a crash. The marker below records the
     INTENT before anything asynchronous begins and is cleared ONLY after
     deleteDatabase() actually succeeds; any later CampuSphere page load retries
     while it is still set.

     Exactly one localStorage key is ever written or removed, and exactly one
     IndexedDB database is ever deleted. No other storage, cache, database, or
     application data is touched. */
  var OFFLINE_GUIDE_DB_NAME = 'campusphere-offline-guide';
  var OFFLINE_GUIDE_PENDING_KEY = 'campusphere-offline-guide-pending-deletion';
  var OFFLINE_GUIDE_CLOSE_GRACE_MS = 150; // let signalled tabs close their handles
  var offlineGuideDeletionInFlight = null; // coalesces concurrent attempts

  function openDb() {
    if (!idbSupported) return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      var req;
      try { req = indexedDB.open(IDB_NAME, IDB_VERSION); }
      catch (e) { resolve(null); return; }
      req.onupgradeneeded = function () {
        try {
          var db = req.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE, { keyPath: 'key' });
          }
        } catch (e) { /* ignore */ }
      };
      req.onsuccess = function () { resolve(req.result || null); };
      req.onerror = function () { resolve(null); };
      req.onblocked = function () { resolve(null); };
    });
    return dbPromise;
  }

  function idbPut(record) {
    return openDb().then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).put(record);
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
          tx.onabort = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    });
  }

  function idbGetAll() {
    return openDb().then(function (db) {
      if (!db) return [];
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(IDB_STORE, 'readonly');
          var rq = tx.objectStore(IDB_STORE).getAll();
          rq.onsuccess = function () { resolve(rq.result || []); };
          rq.onerror = function () { resolve([]); };
        } catch (e) { resolve([]); }
      });
    });
  }

  function idbGet(key) {
    return openDb().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(IDB_STORE, 'readonly');
          var rq = tx.objectStore(IDB_STORE).get(key);
          rq.onsuccess = function () { resolve(rq.result || null); };
          rq.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    });
  }

  // Clear ONLY the catalog object store (not the whole DB) — used by logout
  // cleanup. Other IndexedDB databases are never touched.
  function idbClearCatalog() {
    return openDb().then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).clear();
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
          tx.onabort = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    });
  }

  // OFF.3 guide data lives in a separate, purpose-specific database. Explicit
  // logout deletes that whole database (JSON package + PMTiles Blob) so the next
  // user of a shared browser cannot inherit campus data downloaded under the
  // prior authenticated session. This is exact-name and best-effort; it never
  // touches any other application/database.
  /* Resolves TRUE only on a CONFIRMED deletion. A blocked or failed request
     resolves FALSE so the pending marker survives and a later page load retries
     — it never reports success it did not observe. Exactly one database name is
     ever passed to deleteDatabase(). */
  function deleteOfflineGuideDatabase() {
    if (!idbSupported) return Promise.resolve(false);
    return new Promise(function (resolve) {
      var req;
      try { req = indexedDB.deleteDatabase(OFFLINE_GUIDE_DB_NAME); }
      catch (e) { resolve(false); return; }
      var settled = false;
      function settle(value) {
        if (settled) return;
        settled = true;
        resolve(value);
      }
      req.onsuccess = function () { settle(true); };
      req.onerror = function () { settle(false); };
      // BLOCKED: another tab still holds an open connection. Report "not
      // confirmed" so the intent stays pending. If that tab later closes and
      // this request completes on its own, the retry simply finds no database
      // and succeeds — the outcome is identical and never claimed early.
      req.onblocked = function () { settle(false); };
    });
  }

  /* --- pending-deletion marker: exactly one namespaced localStorage key --- */

  function markOfflineGuideDeletionPending() {
    try {
      localStorage.setItem(OFFLINE_GUIDE_PENDING_KEY, '1');
      return true;
    } catch (e) {
      // Storage unavailable (private mode / quota / disabled). The attempt below
      // still runs best-effort for this page; nothing claims confirmed success.
      return false;
    }
  }

  function offlineGuideDeletionIsPending() {
    try { return localStorage.getItem(OFFLINE_GUIDE_PENDING_KEY) === '1'; }
    catch (e) { return false; }
  }

  function clearOfflineGuideDeletionPending() {
    // Removes ONLY this exact key; every other localStorage entry is preserved.
    try { localStorage.removeItem(OFFLINE_GUIDE_PENDING_KEY); }
    catch (e) { /* best-effort */ }
  }

  /* Signal every open CampuSphere tab to close/reset its offline-guide runtime,
     then delete the one guide database. Concurrent callers share a single
     in-flight attempt so a logout load and a retry cannot race. */
  function runOfflineGuideDeletion() {
    if (offlineGuideDeletionInFlight) return offlineGuideDeletionInFlight;

    signalOfflineGuideLogout();

    var attempt = new Promise(function (resolve) {
      setTimeout(function () { resolve(deleteOfflineGuideDatabase()); }, OFFLINE_GUIDE_CLOSE_GRACE_MS);
    }).then(function (deleted) {
      // The marker is cleared ONLY on a confirmed deletion.
      if (deleted) clearOfflineGuideDeletionPending();
      offlineGuideDeletionInFlight = null;
      return deleted;
    }).catch(function () {
      offlineGuideDeletionInFlight = null;
      return false; // never claim success
    });

    offlineGuideDeletionInFlight = attempt;
    return attempt;
  }

  /* Retry on any later CampuSphere page load while the intent is still pending. */
  function retryPendingOfflineGuideDeletion() {
    try {
      if (!offlineGuideDeletionIsPending()) return;
      runOfflineGuideDeletion();
    } catch (e) { /* best-effort; never blocks the page */ }
  }

  function signalOfflineGuideLogout() {
    if ('BroadcastChannel' in window) {
      try {
        var channel = new BroadcastChannel(OFFLINE_GUIDE_CONTROL_CHANNEL);
        channel.postMessage({ type: 'LOGOUT' });
        channel.close();
      } catch (e) { /* storage-event fallback below */ }
    }
    try {
      localStorage.setItem(OFFLINE_GUIDE_LOGOUT_KEY, String(Date.now()));
      localStorage.removeItem(OFFLINE_GUIDE_LOGOUT_KEY);
    } catch (e) { /* unavailable storage does not block logout */ }
  }

  // R2: page HTML is no longer cached, so a stored "page:*" availability record
  // would falsely imply a page is openable offline. On every load, remove obsolete
  // page records left by a prior installation while PRESERVING privacy-safe
  // "api:*" metadata. Best-effort: never throws.
  function purgeObsoletePageRecords() {
    return openDb().then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(IDB_STORE, 'readwrite');
          var store = tx.objectStore(IDB_STORE);
          var rq = store.getAllKeys();
          rq.onsuccess = function () {
            var keys = rq.result || [];
            for (var i = 0; i < keys.length; i++) {
              var k = keys[i];
              if (typeof k === 'string' && k.indexOf('page:') === 0) {
                try { store.delete(k); } catch (e) { /* ignore */ }
              }
            }
          };
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
          tx.onabort = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    });
  }

  // Coercers so only safe primitives are ever stored.
  function toNum(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
  function toStr(v) { return (typeof v === 'string') ? v.slice(0, 200) : null; }

  // Path classifiers (mirror the service worker's allow/deny lists).
  // Sensitive-path checks reuse the centralized isSensitivePath() defined above
  // so the registration gate and the catalog exclusion can never drift apart.
  function pathIsApprovedApi(p) {
    if (p === '/api/buildings') return true;
    if (p === '/api/routes' || p.indexOf('/api/routes/') === 0) return true;
    if (p.indexOf('/api/vr/routes/') === 0) return true;
    return false;
  }

  // Sanitize catalog URLs so NO arbitrary query string is ever persisted.
  // Path-only by default; the ONLY query param ever kept is a purely numeric
  // ?step=<n> on a /vr/routes/:id page (the route-walkthrough step). Everything
  // else (e.g. ?leak=..., tracking params) is dropped from both url and key.
  function sanitizeCatalogUrl(pathname, search) {
    if (/^\/vr\/routes\/[0-9]+$/.test(pathname) && search) {
      try {
        var step = new URLSearchParams(search).get('step');
        if (step !== null && /^[0-9]+$/.test(step)) {
          return pathname + '?step=' + step;
        }
      } catch (e) { /* fall through to path-only */ }
    }
    return pathname;
  }

  function makeRecord(type, url, extra) {
    extra = extra || {};
    return {
      key: type + ':' + url,
      type: type,
      url: url,
      routeId: toNum(extra.routeId),
      routeTitle: toStr(extra.routeTitle),
      buildingCount: toNum(extra.buildingCount),
      sceneCount: toNum(extra.sceneCount),
      lastSyncedAt: new Date().toISOString()
    };
  }

  // R2: pages are intentionally NOT recorded any more — opening a page no longer
  // means its authenticated HTML is available offline, so a "page:*" record would
  // be misleading. Page capture was removed; only privacy-safe api:* records are
  // written (by the fetch observer below), and obsolete page:* records are purged
  // on load.

  // Derive a safe API record from an approved JSON response body.
  function captureApi(pathname, url, data) {
    var extra = { routeId: null, routeTitle: null, buildingCount: null, sceneCount: null };
    try {
      if (pathname === '/api/buildings') {
        var list = Array.isArray(data) ? data : (data && Array.isArray(data.buildings) ? data.buildings : null);
        extra.buildingCount = list ? list.length : null;
      } else if (pathname === '/api/routes') {
        // List endpoint: aggregate only; route-specific fields stay null.
      } else if (/^\/api\/routes\/[0-9]+/.test(pathname)) {
        var r = (data && data.route) ? data.route : null;
        if (r) { extra.routeId = toNum(r.id); extra.routeTitle = toStr(r.title); }
      } else if (pathname.indexOf('/api/vr/routes/') === 0) {
        var vr = (data && data.route) ? data.route : null;
        if (vr) { extra.routeId = toNum(vr.id); extra.routeTitle = toStr(vr.title); }
        if (data && Array.isArray(data.scenes)) extra.sceneCount = data.scenes.length;
      }
    } catch (e) { /* leave nulls */ }
    idbPut(makeRecord('api', url, extra));
  }

  // Conservative fetch wrapper: preserves native fetch behavior EXACTLY and
  // only observes approved, same-origin, successful GET API responses while
  // online (a cached/offline read must not be recorded as a fresh sync).
  if (typeof window.fetch === 'function') {
    var nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var promise = nativeFetch(input, init);
      try {
        var method = 'GET';
        if (init && init.method) method = String(init.method).toUpperCase();
        else if (input && typeof input === 'object' && input.method) method = String(input.method).toUpperCase();
        if (method === 'GET') {
          var rawUrl = (input && typeof input === 'object' && input.url) ? input.url : String(input);
          promise.then(function (res) {
            try {
              if (!res || !res.ok) return;
              if (navigator.onLine === false) return; // never record offline/cached reads as a sync
              var u = new URL(rawUrl, location.href);
              if (u.origin !== location.origin) return;
              var p = u.pathname;
              if (isSensitivePath(p) || !pathIsApprovedApi(p)) return;
              var url = sanitizeCatalogUrl(p, u.search);
              res.clone().json().then(function (data) {
                captureApi(p, url, data);
              }).catch(function () { /* non-JSON / read error: ignore */ });
            } catch (e) { /* ignore */ }
          }).catch(function () { /* network error: nothing to record */ });
        }
      } catch (e) { /* never break fetch */ }
      return promise;
    };
  }

  // Read-only debug/demo accessor (safe no-ops when IndexedDB is unavailable).
  window.CampuSphereOfflineCatalog = {
    isSupported: function () { return idbSupported; },
    list: function () { return idbGetAll(); },
    get: function (key) { return idbGet(key); }
  };

  /* ---- 5. Online logout cleanup (Section 6.7) ----
     controllers/authController.js redirects normal logout to /auth?logged_out=1.
     On that load we run BEST-EFFORT, device-local cleanup so a previously cached
     authenticated demo page/API is no longer served offline:
       - delete ONLY the CampuSphere dynamic caches (page/api/external, any version)
       - clear ONLY the offline-demo catalog store
     We PRESERVE shell/static caches, every unrelated Cache Storage entry, and all
     other browser storage (other IndexedDB DBs, localStorage, sessionStorage,
     cookies). Cleanup never throws and never blocks the auth page from rendering;
     no secrets or raw errors are surfaced. */
  var DYNAMIC_CACHE_MATCH = /^campusphere-pwa-(page|api|external)-/;

  function deleteDynamicCaches() {
    if (!('caches' in window)) return Promise.resolve();
    return caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        return DYNAMIC_CACHE_MATCH.test(key) ? caches.delete(key) : undefined;
      }));
    }).catch(function () { /* swallow: cleanup is best-effort */ });
  }

  // Remove ONLY the logged_out marker from the visible URL; keep any other
  // query params and the hash intact. Prevents re-trigger on refresh/bookmark.
  function stripLoggedOutParam() {
    try {
      var url = new URL(location.href);
      if (!url.searchParams.has('logged_out')) return;
      url.searchParams.delete('logged_out');
      var qs = url.searchParams.toString();
      history.replaceState(null, '', url.pathname + (qs ? '?' + qs : '') + url.hash);
    } catch (e) { /* leave URL unchanged on failure */ }
  }

  function runLogoutCleanupIfFlagged() {
    try {
      if (location.pathname !== '/auth') return;
      var params = new URLSearchParams(location.search);
      if (params.get('logged_out') !== '1') return;
      // Record the deletion INTENT first. Stripping logged_out=1 is what makes
      // this load unrepeatable, so the marker must exist before that happens and
      // before any asynchronous cleanup starts — otherwise a blocked deletion or
      // a closed tab would lose the request entirely.
      markOfflineGuideDeletionPending();
      stripLoggedOutParam();
      deleteDynamicCaches();
      idbClearCatalog().catch(function () {});
      // Signals every open tab, then deletes only the guide database.
      runOfflineGuideDeletion();
    } catch (e) { /* never block the auth page */ }
  }

  // Run logout cleanup as early as possible (the deferred script already runs
  // after parse, so /auth is interactive regardless of cleanup timing).
  runLogoutCleanupIfFlagged();

  // R2: purge any obsolete page:* availability records left by a prior install
  // (privacy-safe api:* metadata is preserved). Runs once the DOM is ready.
  //
  // The pending offline-guide deletion is retried on the SAME tick: if a prior
  // logout could not confirm the deletion (blocked by another tab, or the page
  // closed first), every later CampuSphere page load tries again until it
  // succeeds. Coalescing makes the logout path and this retry share one attempt.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      purgeObsoletePageRecords();
      retryPendingOfflineGuideDeletion();
    });
  } else {
    purgeObsoletePageRecords();
    retryPendingOfflineGuideDeletion();
  }
})();
