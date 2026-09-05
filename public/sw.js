'use strict';
/* ========================================
   CampuSphere Service Worker
   Milestone 6, Section 6.4 (bounded caching).

   Scope: a session-neutral offline SHELL only — NOT a full offline app.
   No Workbox, no dependencies. Plain, readable, capstone-scoped.

   Update lifecycle (OFF.2):
     - install NEVER calls skipWaiting(). An updated worker deliberately enters
       the waiting state and activates only after the user accepts the update.
     - The shell precache is ATOMIC. A partially precached shell is never
       activated: a failed entry rejects the install, the half-written shell
       cache is dropped, and the currently ACTIVE worker keeps serving.
     - The only accepted message is the narrow { type: 'SKIP_WAITING' } sent by
       public/js/pwa.js from an explicit user action.
     - activate() advances the cache version once and deletes ONLY stale
       campusphere-pwa-* caches; unrelated Cache Storage entries are untouched.
     - No route, schedule, VR, panorama, basemap, or media payload is precached.
       OFF.3 adds the guide only after explicit user consent and stores it in a
       dedicated IndexedDB database; the service worker never captures it.

   Offline-scope boundary (2D-only correction):
     - EXACT SHELL ALLOWLIST. The only same-origin requests eligible for Cache
       Storage are the reviewed shell assets themselves, matched by exact
       pathname PLUS query string against PRECACHE_URLS. There is no
       extension-wide or directory-wide rule, so '/css/styles.css?v=11' is
       cacheable while an unreviewed '/css/styles.css?v=12' is not.
     - Every other same-origin static or media request is NETWORK-ONLY: local
       database-selected building photos, '/img/campus-hero.jpg', arbitrary
       '/img/*.jpg', local panorama paths under '/img/vr/', and non-shell
       admin CSS/JS are never intercepted and never written to any cache.
     - EVERY cross-origin request is NETWORK-ONLY. There is no external cache,
       no approved-host list, and no cross-origin strategy left to re-enable:
       OpenStreetMap tiles, res.cloudinary.com, and every other host go
       straight to the browser's normal network path. OSM remains permitted by
       CSP and the ONLINE Leaflet/MapLibre map is unchanged; the OFFLINE map
       renders from the bundled content-addressed PMTiles archive, which the
       explicit IndexedDB manager owns and the worker never touches.
     - EVERY same-origin API request is NETWORK-ONLY. /api/buildings,
       /api/routes, /api/routes/*, /api/vr/routes/*, every query-string variant,
       and the whole remaining '/api' surface are never intercepted and never
       cached. Automatic API caching was removed because those payloads carry
       Cloudinary image URLs and local building-photo references, which would
       retain media the user never consented to download; the explicit
       /api/offline-guide download into IndexedDB is the ONLY owner of offline
       campus data.
     - NETWORK-ONLY means the worker DECLINES to handle a request. It never
       blocks, redirects, rewrites, or synthesizes a response, so online
       delivery is byte-for-byte unchanged.

   Caches — EXACTLY TWO exist, both under the campusphere-pwa-* prefix and
   versioned. Neither holds anything but the exact reviewed shell assets:
     - shell   : the reviewed app-shell assets, precached atomically at install
     - static  : the SAME exact reviewed shell assets, refreshed at runtime
                 (stale-while-revalidate, FIFO-capped by STATIC_MAX)

   There is no api cache and no external cache. API_CACHE, API_MAX,
   EXTERNAL_CACHE, EXTERNAL_MAX, approved-host cross-origin caching, the
   approved-API classifier/strategy, and the synthesized offline JSON fallback
   response DO NOT EXIST — each was removed outright rather than disabled, so
   there is no dormant branch to re-enable. CURRENT_CACHES is exactly
   [SHELL_CACHE, STATIC_CACHE].

   Privacy boundary (R2 — Authenticated PWA Privacy):
     - HTML navigations are NEVER cached. Authenticated pages embed
       window.__SESSION_USER and personalized content, so caching their HTML
       would leak one user's identity to the next user of the same browser
       profile. Every same-origin navigation is network-only and falls back to
       the session-neutral /offline.html shell when the network is unavailable.
     - The page-HTML runtime cache was removed entirely (no pageStrategy, no
       PAGE_CACHE). This does not rely on logout cleanup as the privacy boundary.

   Hard security rules (do NOT relax):
     - The ONLY request the worker ever answers is a same-origin GET that is
       either a navigation or an EXACT reviewed shell asset. Nothing else is
       handled at all.
     - EVERY cross-origin request is network-only, without exception and
       without a host allowlist.
     - EVERY same-origin /api request is network-only, including
       /api/buildings, /api/routes, /api/routes/*, /api/vr/routes/*,
       /api/search, /api/pathfind and every query-string variant.
     - Never intercept/cache: /auth, /login, /register, /logout,
       /admin (+ /admin/*, /admin/api/*), /api/update-profile,
       /api/offline-guide, any non-GET request, or any
       POST/PUT/PATCH/DELETE response.
     - The successful-response and never-cache-a-redirect rules apply ONLY to
       reviewed shell/static caching — the sole caching path that still exists.
       They prevent an auth-redirect leaking into a shell cache key.
     - The one runtime cache is FIFO-capped by STATIC_MAX, and because only
       exact reviewed shell URLs are eligible it cannot grow into a tile,
       panorama, photo, or API mirror. /img/vr/ media is never cached.
     - No logging of request URLs or response bodies (avoids leaking data).
   ======================================== */

var CACHE_PREFIX = 'campusphere-pwa';
var CACHE_VERSION = 'v39'; // Shared button/theme contrast and secondary action styles. (v38: account identity name locking and read-only profile controls. v37: primary button contrast/reset correction and stylesheet cache-key refresh. v36: minimal instructor registration/profile surfaces. v35: stylesheet cache-key correction. v34: offline camera target correction. v33: offline-map refresh client and current shell corrections. v32: room-schedule viewer and current shell corrections. v31: prior shell generation. v30: Google-synced profile images and Edit Profile state. v29: About team stylesheet refresh, notification panel styles, and Paga portrait framing. v28: shared notification stylesheet refresh. v27: offline Guard House marker label. v26: compact online/offline building markers with exact 44-by-44 CSS-pixel interaction targets. v25: accessible simplified-map fallback and native HTML marker buttons. v24: mobile-sheet accessibility, exact touch-target enforcement, and persisted theme parity. v23: details-focus and theme-state accessibility. v22: route-dialog focus containment and visible-target restoration. v21: building-details hero media parity. v20: closing directions preserves the drawn route. v19: online marker and immediate-route parity. v18: absolute marker positioning. v17: bottom-tip marker anchoring. v16: online-map visual-shell parity. v15: automatic API caching removed. v14: exact shell allowlist; all cross-origin network-only. v13: Guided-VR route JSON and Cloudinary made network-only. v12/OFF.3: session-neutral offline guide UI/runtime added to the atomic shell.)

var SHELL_CACHE = CACHE_PREFIX + '-shell-' + CACHE_VERSION;
var STATIC_CACHE = CACHE_PREFIX + '-static-' + CACHE_VERSION;

/* Exactly TWO caches exist, and both hold only the reviewed static shell.

   No page cache: authenticated HTML is never stored (R2).
   No EXTERNAL cache: every cross-origin request is network-only.
   No API cache: every same-origin API request is network-only.

   In each case the constant, its size cap, its classifier, and its strategy
   were REMOVED rather than left dormant where they could be re-enabled by
   accident. Any campusphere-pwa-* cache outside this set — including every
   prior -page-*, -external-* and -api-* generation — is deleted on activate. */
var CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE];

var OFFLINE_URL = '/offline.html';

// Minimal app-shell precache (same-origin only). No demo HTML / no APIs here.
var PRECACHE_URLS = [
  '/offline.html',
  '/css/offline.css', // CSP (8.5): offline page styles externalized; precached so the offline fallback stays styled
  '/manifest.webmanifest',
  '/css/styles.css?v=11',
  '/js/pwa.js',
  '/js/offline-guide-manager.js',
  '/js/nav-role.js',
  '/js/profile-script.js',
  '/vendor/maplibre/maplibre-gl.css',
  '/vendor/maplibre/maplibre-gl.js',
  '/vendor/pmtiles/pmtiles.js',
  '/img/cspc-logo.png',
  '/img/Camarines-sur-polytechnic-colleges.png',
  '/img/icons/icon-192.png',
  '/img/icons/icon-512.png',
  '/img/icons/apple-touch-icon.png'
];

/* EXACT same-origin shell allowlist.

   DERIVED FROM PRECACHE_URLS so the runtime-cacheable set and the reviewed
   shell can never drift apart: adding a runtime-cacheable asset now requires
   adding it to the reviewed precache list, which is what review inspects.

   Keys are the exact 'pathname + search' string. Object.create(null) is used
   deliberately — a plain object would let a request for '/constructor' or
   '__proto__' inherit a truthy prototype member and be treated as shell. */
var SHELL_ASSET_SET = (function () {
  var set = Object.create(null);
  for (var i = 0; i < PRECACHE_URLS.length; i++) set[PRECACHE_URLS[i]] = true;
  return set;
})();

/* The ONLY same-origin cache-eligibility test. There is deliberately no
   extension rule and no directory rule, so local building photos,
   /img/campus-hero.jpg, arbitrary /img/*.jpg, /img/vr/ panoramas, non-shell
   admin CSS/JS, and a query-modified shell asset all return false and fall
   through to the network untouched. */
function isExactShellAsset(pathWithQuery) {
  return SHELL_ASSET_SET[pathWithQuery] === true;
}

// Bounded cache size (FIFO trim) for the one runtime cache that remains.
var STATIC_MAX = 60;

/* ---------- path / host classification ---------- */

var FORBIDDEN_PREFIXES = [
  '/auth',
  '/login',
  '/register',
  '/logout',
  '/admin',             // covers /admin, /admin/*, /admin/api/*
  '/api/update-profile',
  '/api/offline-guide'  // explicit no-store download; IndexedDB manager owns it
];

function isForbiddenPath(pathname) {
  for (var i = 0; i < FORBIDDEN_PREFIXES.length; i++) {
    var prefix = FORBIDDEN_PREFIXES[i];
    if (pathname === prefix || pathname.indexOf(prefix + '/') === 0) {
      return true;
    }
  }
  return false;
}

/* NETWORK-ONLY, but NOT sensitive.

   These paths are never intercepted and never Cache Storage eligible, yet they
   are deliberately kept OUT of FORBIDDEN_PREFIXES: that list mirrors the
   sensitive-path classifier in public/js/pwa.js, and these are ordinary public
   application requests, not authentication/admin surfaces.

   Declining to handle them leaves them on the browser's normal network path, so
   ONLINE Guided-VR behaviour is completely unchanged — nothing is blocked,
   redirected, or rewritten.

   The single '/api' prefix now covers the WHOLE API surface. Automatic API
   caching was removed: /api/buildings and /api/routes* returned building rows
   that can carry Cloudinary image URLs and local building-photo references, so
   caching them retained media references without the user's explicit consent,
   contradicting the consent-driven offline-package boundary. Offline campus
   data has exactly one owner — the explicit /api/offline-guide download stored
   in IndexedDB by public/js/offline-guide-manager.js.

   Matching is on PATHNAME, so every query-string variant of every API path is
   covered too. This subsumes /api/buildings, /api/routes, /api/routes/*,
   /api/vr/routes/*, /api/search and /api/pathfind. */
var NETWORK_ONLY_PREFIXES = [
  '/api'  // the entire API surface: never intercepted, never cached
];

function isNetworkOnlyPath(pathname) {
  for (var i = 0; i < NETWORK_ONLY_PREFIXES.length; i++) {
    var prefix = NETWORK_ONLY_PREFIXES[i];
    if (pathname === prefix || pathname.indexOf(prefix + '/') === 0) {
      return true;
    }
  }
  return false;
}

/* Same-origin cache eligibility is decided ONLY by isExactShellAsset() above.
   The former extension-wide isCacheableStatic() rule was REMOVED: it made every
   .png/.jpg/.webp outside /img/vr/ cacheable, which silently admitted local
   database-selected building photos and other non-shell media that are outside
   the approved 2D-only offline scope. /img/vr/ panoramas are excluded by the
   same allowlist, by construction rather than by a special case.

   There is no approved cross-origin host list. Every cross-origin request —
   tile.openstreetmap.org and its a/b/c subdomains, res.cloudinary.com, and any
   other host — is network-only. OSM is still permitted by CSP and the ONLINE
   Leaflet/MapLibre map is untouched; only the mirroring of the public tile
   service into Cache Storage is gone, because OFF.4 renders the offline map
   from the bundled PMTiles archive instead.

   M12.P1-R6: every browser vendor library (Leaflet, MapLibre, Pannellum,
   Iconify component, Lucide) is served SAME-ORIGIN from /vendor, so no CDN
   host is involved in runtime UI assets at all. */

/* ---------- cache helpers ---------- */

function trimCache(cache, max) {
  return cache.keys().then(function (keys) {
    if (keys.length <= max) return undefined;
    var overflow = keys.length - max;
    var deletions = [];
    for (var i = 0; i < overflow; i++) {
      deletions.push(cache.delete(keys[i])); // keys[] is oldest-first => FIFO
    }
    return Promise.all(deletions);
  });
}

function putWithCap(cacheName, request, response, max) {
  return caches.open(cacheName).then(function (cache) {
    return cache.put(request, response).then(function () {
      return trimCache(cache, max);
    });
  });
}

/* There is no synthesized offline JSON response any more. The worker never
   answers an API request at all, so it can neither transform a live response
   nor fabricate one — the browser surfaces its own ordinary network error. */

function offlinePageResponse() {
  return caches.match(OFFLINE_URL).then(function (cached) {
    return cached || new Response(
      '<!doctype html><meta charset="utf-8"><title>Offline</title><p>You are offline.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  });
}

// True only for a successful, same-origin, non-redirected response.
function isCacheableSameOrigin(res) {
  return !!res && res.status === 200 && res.type === 'basic' && res.redirected !== true;
}

/* ---------- runtime strategies ---------- */

// Network-only for ALL same-origin navigations (R2): authenticated HTML is
// never cached. On network failure, serve the session-neutral /offline.html
// shell — never a cached personalized page.
function navigationFallbackStrategy(event) {
  return fetch(event.request).catch(function () {
    return offlinePageResponse();
  });
}

/* There is intentionally NO API strategy.

   The former network-first apiStrategy() cached /api/buildings and /api/routes*
   JSON. Those payloads carry building rows including Cloudinary image URLs and
   local building-photo references, so caching them retained media references
   the user never consented to download — the exact boundary the explicit
   /api/offline-guide flow exists to enforce. API_CACHE, API_MAX,
   isApprovedApi(), apiStrategy() and the synthesized offline JSON response were
   REMOVED rather than disabled, so there is no branch left to re-enable.

   Online API behaviour is untouched: response schemas, headers and status codes
   are exactly what the server sends, because the worker never responds. */

// Stale-while-revalidate for EXACT reviewed shell assets only (capped).
function staticStrategy(event) {
  var req = event.request;
  return caches.match(req).then(function (cached) {
    var network = fetch(req).then(function (res) {
      if (isCacheableSameOrigin(res)) {
        event.waitUntil(putWithCap(STATIC_CACHE, req, res.clone(), STATIC_MAX));
      }
      return res;
    }).catch(function () {
      return cached || new Response('', { status: 504, statusText: 'Offline' });
    });
    if (cached) {
      event.waitUntil(network.then(function () {}).catch(function () {}));
      return cached;
    }
    return network;
  });
}

/* There is intentionally NO cross-origin strategy.

   The former cache-first externalStrategy() and its cachedTypeMatchesMode()
   helper were REMOVED together with EXTERNAL_CACHE and EXTERNAL_MAX. Leaving a
   dormant strategy behind an empty host list would be one edit away from
   re-mirroring the public OpenStreetMap tile service or Cloudinary media, so
   the machinery is gone rather than disabled. Cross-origin requests are handled
   by returning early in the fetch listener — the browser's normal network path.

   Consequence for response modes: because no cross-origin response is ever
   stored, an opaque/cors mode mismatch can no longer arise, which is why the
   mode-compatibility helper is unnecessary. */

/* ---------- lifecycle ---------- */

/* ATOMIC shell installation (OFF.2).

   Cache.addAll() is all-or-nothing by specification: if any entry fails to
   fetch, NONE are committed. That is the primary guarantee that an interrupted
   installation can never leave a half-usable shell behind. Two deliberate
   additions harden it:

     1. A post-write verification re-reads the cache and requires EVERY shell
        entry to be present, so a browser that deviates from the atomicity rule
        still cannot produce a partial shell.
     2. On any failure the half-written shell cache is DELETED before the
        install is failed, so the next installation attempt starts from a clean
        slate and recovers deterministically instead of inheriting fragments.

   Failing the install rejects the new worker. The previously ACTIVE worker is
   left untouched and keeps serving — a broken update never degrades a working
   installation.

   There is deliberately NO self.skipWaiting() here: an updated worker enters
   the waiting state and waits for the user (see the message handler below). */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      return cache.addAll(PRECACHE_URLS.map(function (u) {
        return new Request(u, { cache: 'reload' });
      })).then(function () {
        return Promise.all(PRECACHE_URLS.map(function (u) {
          return cache.match(u).then(function (hit) { return hit ? null : u; });
        }));
      }).then(function (results) {
        for (var i = 0; i < results.length; i++) {
          if (results[i] !== null) {
            throw new Error('shell precache incomplete');
          }
        }
        return undefined;
      });
    }).catch(function (err) {
      // Deterministic recovery: drop the partial shell, then fail the install.
      return caches.delete(SHELL_CACHE).catch(function () {
        return undefined;
      }).then(function () {
        throw err;
      });
    })
  );
});

/* User-controlled activation (OFF.2).

   The ONLY message this worker accepts is the narrow { type: 'SKIP_WAITING' }
   posted by public/js/pwa.js after the user explicitly selects the update
   action. Every other message shape is ignored. Nothing carried by the message
   is logged, echoed, cached, or used to build a request, so this cannot become
   a data channel. */
self.addEventListener('message', function (event) {
  var data = event && event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type !== 'SKIP_WAITING') return;
  self.skipWaiting();
});

/* Versioned cleanup runs only AFTER a successful activation, and only for this
   application's own prefix: any campusphere-pwa-* cache outside the current
   version set is removed, while the current caches and every unrelated Cache
   Storage entry (other apps, other tools) are left completely untouched.

   clients.claim() is what lets an already-open page observe the swap through
   its single controllerchange listener. */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        // Remove stale CampuSphere PWA caches (any version not in the current set).
        if (key.indexOf(CACHE_PREFIX + '-') === 0 && CURRENT_CACHES.indexOf(key) === -1) {
          return caches.delete(key);
        }
        return undefined;
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* ---------- fetch routing ---------- */

self.addEventListener('fetch', function (event) {
  var req = event.request;

  // Only GET is ever handled; everything else hits the network untouched.
  if (req.method !== 'GET') {
    return;
  }

  var url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }

  // Cross-origin: ALWAYS network-only. OpenStreetMap tiles, res.cloudinary.com,
  // the Iconify data API and every other host are left entirely to the browser.
  // Nothing is blocked or rewritten — the worker simply does not respond.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Same-origin forbidden paths are never intercepted or cached.
  if (isForbiddenPath(url.pathname)) {
    return;
  }

  // Network-only public paths: the ENTIRE '/api' surface. Checked BEFORE the
  // navigation and shell branches so neither an XHR, a query-string variant,
  // nor a direct navigation can route API data into any cache. There is no
  // API branch after this one — falling through leaves the request untouched on
  // the browser's normal network path.
  if (isNetworkOnlyPath(url.pathname)) {
    return;
  }

  // Page navigations: ALWAYS network-only with an /offline.html fallback.
  // No HTML response is ever cached, so a personalized authenticated page can
  // never be stored or replayed to another user of this browser profile (R2).
  if (req.mode === 'navigate') {
    event.respondWith(navigationFallbackStrategy(event));
    return;
  }

  // EXACT reviewed shell assets only, matched on pathname PLUS query string.
  // Anything else same-origin — local building photos, /img/campus-hero.jpg,
  // /img/vr/ panoramas, non-shell admin CSS/JS, or a shell path carrying an
  // unreviewed query — falls through untouched to the network below.
  if (isExactShellAsset(url.pathname + url.search)) {
    event.respondWith(staticStrategy(event));
    return;
  }

  // Everything else same-origin (e.g. /api/search, /api/pathfind): network,
  // no caching. Falling through leaves the request to the browser default.
});
