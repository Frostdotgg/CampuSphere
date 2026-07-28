'use strict';
/* ========================================
   CampuSphere Service Worker
   Milestone 6, Section 6.4 (bounded caching).

   Scope: offline DEMO navigation only — NOT a full offline app.
   No Workbox, no dependencies. Plain, readable, capstone-scoped.

   Caches (all under the campusphere-pwa-* prefix, versioned):
     - shell     : minimal precached app-shell assets (install time)
     - static    : same-origin CSS/JS/img/icon/manifest (runtime, capped)
     - api       : approved JSON APIs (runtime, network-first, capped)
     - external  : approved CDN/tiles/media (runtime, capped, opaque allowed)

   Privacy boundary (R2 — Authenticated PWA Privacy):
     - HTML navigations are NEVER cached. Authenticated pages embed
       window.__SESSION_USER and personalized content, so caching their HTML
       would leak one user's identity to the next user of the same browser
       profile. Every same-origin navigation is network-only and falls back to
       the session-neutral /offline.html shell when the network is unavailable.
     - The page-HTML runtime cache was removed entirely (no pageStrategy, no
       PAGE_CACHE). This does not rely on logout cleanup as the privacy boundary.

   Hard security rules (do NOT relax):
     - Only same-origin GET (or approved cross-origin GET) is ever handled.
     - Never intercept/cache: /auth, /login, /register, /logout,
       /admin (+ /admin/*, /admin/api/*), /api/update-profile,
       any non-GET request, or any POST/PUT/PATCH/DELETE response.
     - Only successful responses are cached. Redirected responses are never
       cached (prevents an auth-redirect leaking into an approved cache key).
     - Cross-origin caching is opaque-allowed ONLY for the approved host list,
       and every runtime cache is CAPPED so this cannot become a tile/panorama
       mirror. /img/vr/ media is never cached.
     - No logging of request URLs or response bodies (avoids leaking data).
   ======================================== */

var CACHE_PREFIX = 'campusphere-pwa';
var CACHE_VERSION = 'v10'; // 11.8 map repair: purge pre-repair external/static caches; the /map page owns its local fallback if the map engine or tiles fail. (M12.P1-R6 self-hosted the map/VR/icon engines under /vendor, so they are now ordinary same-origin static assets — a caching-behaviour change was neither needed nor made, hence the version is unchanged. v9/10.8: jsdelivr removed from approved external hosts and externalStrategy made pass-through-safe; v6/R2: network-only authenticated navigations.)

var SHELL_CACHE = CACHE_PREFIX + '-shell-' + CACHE_VERSION;
var STATIC_CACHE = CACHE_PREFIX + '-static-' + CACHE_VERSION;
var API_CACHE = CACHE_PREFIX + '-api-' + CACHE_VERSION;
var EXTERNAL_CACHE = CACHE_PREFIX + '-external-' + CACHE_VERSION;

// No page cache: authenticated HTML is never stored (R2). Any campusphere-pwa-*
// cache not in this set (including every prior -page-* cache) is deleted on activate.
var CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE, API_CACHE, EXTERNAL_CACHE];

var OFFLINE_URL = '/offline.html';

// Minimal app-shell precache (same-origin only). No demo HTML / no APIs here.
var PRECACHE_URLS = [
  '/offline.html',
  '/css/offline.css', // CSP (8.5): offline page styles externalized; precached so the offline fallback stays styled
  '/manifest.webmanifest',
  '/css/styles.css?v=5',
  '/js/pwa.js',
  '/js/nav-role.js',
  '/js/profile-script.js',
  '/img/cspc-logo.png',
  '/img/icons/icon-192.png',
  '/img/icons/icon-512.png',
  '/img/icons/apple-touch-icon.png'
];

// Bounded cache sizes (FIFO trim). Keep small — demo scope only.
var STATIC_MAX = 60;
var API_MAX = 30;
var EXTERNAL_MAX = 80; // tiles dominate; cap prevents a full map-tile mirror

/* ---------- path / host classification ---------- */

var FORBIDDEN_PREFIXES = [
  '/auth',
  '/login',
  '/register',
  '/logout',
  '/admin',             // covers /admin, /admin/*, /admin/api/*
  '/api/update-profile'
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

// Approved JSON APIs (network-first JSON). Excludes /api/search, /api/pathfind,
// /api/update-profile (forbidden), and all admin APIs (forbidden via /admin).
function isApprovedApi(pathname) {
  if (pathname === '/api/buildings') return true;
  if (pathname === '/api/routes' || pathname.indexOf('/api/routes/') === 0) return true;
  if (pathname.indexOf('/api/vr/routes/') === 0) return true;
  return false;
}

// Same-origin static assets we may runtime-cache. Never mirror /img/vr/ media.
function isCacheableStatic(pathname) {
  if (pathname.indexOf('/img/vr/') === 0) return false;
  return /\.(css|js|mjs|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|webmanifest)$/i.test(pathname);
}

// Approved cross-origin hosts (opaque allowed, capped). Only map tiles and
// Cloudinary media are approved; both are bounded by EXTERNAL_MAX.
//
// M12.P1-R6: every browser vendor library (Leaflet, MapLibre, Pannellum,
// Iconify component, Lucide) is now served SAME-ORIGIN from /vendor, so no CDN
// host is involved in runtime UI assets at all. Those requests are ordinary
// same-origin static assets handled by staticStrategy below. Any other
// cross-origin host still falls through respondWith-free to the browser's
// normal network path — this remains a service-worker caching decision only.
function isApprovedExternalHost(hostname) {
  if (hostname === 'res.cloudinary.com') return true;   // Cloudinary media (bounded)
  if (hostname === 'tile.openstreetmap.org') return true;
  if (/\.tile\.openstreetmap\.org$/.test(hostname)) return true; // a/b/c + any subdomain
  return false;
}

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

function offlineJsonResponse() {
  return new Response(
    JSON.stringify({ success: false, offline: true, message: 'You are offline. Reconnect to refresh this data.' }),
    { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  );
}

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

// Network-first for approved JSON APIs; fall back to cached JSON, then safe 503 JSON.
function apiStrategy(event) {
  var req = event.request;
  return fetch(req).then(function (res) {
    if (isCacheableSameOrigin(res)) {
      var ct = res.headers.get('content-type') || '';
      if (ct.indexOf('application/json') !== -1) {
        event.waitUntil(putWithCap(API_CACHE, req, res.clone(), API_MAX));
      }
    }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (cached) {
      return cached || offlineJsonResponse();
    });
  });
}

// Stale-while-revalidate for same-origin static assets (capped).
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

// A cached response may only answer a request whose mode it can legally
// satisfy: answering a no-cors request (e.g. <img>) with a cors-type cached
// copy — or a cors request with an opaque copy — makes the browser fail the
// load with a TypeError (surfaces as net::ERR_FAILED). Cache entries are keyed
// by URL only, so the same asset fetched via XHR (cors) and <img> (no-cors)
// can collide; skip incompatible entries (the network branch then refreshes
// the entry with a compatible response type).
function cachedTypeMatchesMode(res, req) {
  if (req.mode === 'no-cors') return res.type !== 'cors';
  return res.type !== 'opaque';
}

// Cache-first (capped) for approved cross-origin assets; opaque responses
// allowed. 10.8 repair: PASS-THROUGH-SAFE — this strategy must never do worse
// than the raw network. Every Cache-API step is guarded so an unexpected
// rejection degrades to a plain fetch(req) (the browser's normal path) instead
// of surfacing as net::ERR_FAILED, and the synthesized 504 "Offline" response
// is a LAST resort used only when the network fetch itself fails.
function externalStrategy(event) {
  var req = event.request;
  return caches.open(EXTERNAL_CACHE).then(function (cache) {
    return cache.match(req).then(function (cached) {
      if (cached && !cachedTypeMatchesMode(cached, req)) cached = undefined;
      var network = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) {
          var copy = res.clone();
          event.waitUntil(putWithCap(EXTERNAL_CACHE, req, copy, EXTERNAL_MAX).catch(function () {}));
        }
        return res;
      });
      if (cached) {
        // Serve cached; refresh in the background, ignoring failures (offline).
        event.waitUntil(network.catch(function () {}));
        return cached;
      }
      return network.catch(function () {
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    });
  }).catch(function () {
    // Cache API failure must never take down the request: plain network.
    return fetch(req);
  });
}

/* ---------- lifecycle ---------- */

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      // Resilient precache: one missing asset must not fail the whole install.
      return Promise.allSettled(PRECACHE_URLS.map(function (u) {
        return cache.add(new Request(u, { cache: 'reload' }));
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

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

  // Cross-origin: only approved hosts are runtime-cached; everything else
  // (e.g. api.iconify.design icon data) is left entirely to the network.
  if (url.origin !== self.location.origin) {
    if (isApprovedExternalHost(url.hostname)) {
      event.respondWith(externalStrategy(event));
    }
    return;
  }

  // Same-origin forbidden paths are never intercepted or cached.
  if (isForbiddenPath(url.pathname)) {
    return;
  }

  // Approved JSON APIs (handled before navigation so a direct visit still
  // returns JSON, never an HTML page).
  if (isApprovedApi(url.pathname)) {
    event.respondWith(apiStrategy(event));
    return;
  }

  // Page navigations: ALWAYS network-only with an /offline.html fallback.
  // No HTML response is ever cached, so a personalized authenticated page can
  // never be stored or replayed to another user of this browser profile (R2).
  if (req.mode === 'navigate') {
    event.respondWith(navigationFallbackStrategy(event));
    return;
  }

  // Same-origin static assets (excludes /img/vr/ media).
  if (isCacheableStatic(url.pathname)) {
    event.respondWith(staticStrategy(event));
    return;
  }

  // Everything else same-origin (e.g. /api/search, /api/pathfind): network,
  // no caching. Falling through leaves the request to the browser default.
});
