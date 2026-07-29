'use strict';
/* ========================================
   CampuSphere — Security headers + CSP (Milestone 8, Section 8.5)

   Per-request CSP nonce + Helmet with an explicit, nonce-based Content Security
   Policy. No `script-src 'unsafe-inline'`, no `'unsafe-eval'`, no
   `'unsafe-hashes'`. Inline <script>/<style> elements must carry
   nonce="<%= cspNonce %>".

   Narrow, documented exception:
   - `style-src-attr 'unsafe-inline'` — the existing templates use many inline
     `style="…"` attributes; allowing inline STYLE ATTRIBUTES only (not inline
     <style> ELEMENTS, which still require a nonce via style-src-elem) keeps the
     UI intact without weakening script execution. Tracked for later cleanup.

   M12.P1-R6 — Self-Hosted Browser Dependencies.
   Every browser vendor library (Leaflet 1.9.4, MapLibre GL JS 4.7.1, Pannellum
   2.5.6, Iconify Icon 1.0.7, Lucide 1.25.0) is now served same-origin from
   /vendor, so NO executable script or stylesheet origin is allowed any more.
   Removed from this policy: unpkg.com, cdn.jsdelivr.net, code.iconify.design.
   See public/vendor/manifest.json for the acquisition record.

   Remaining external origins — DATA, MEDIA and FONTS only, never executable:
   - fonts.googleapis.com + fonts.gstatic.com — Google Fonts (documented
     exception; the stylesheet is @imported by public/css/styles.css).
   - *.tile.openstreetmap.org — approved OpenStreetMap raster tiles.
   - api.iconify.design — icon DATA fetched by the self-hosted Iconify
     component (connect-src only; its SCRIPT host is gone).
   - res.cloudinary.com — owner-controlled campus/panorama media delivery
     (img/media/connect only).
   No broad wildcard origins.
   ======================================== */

const crypto = require('crypto');
const helmet = require('helmet');

const isProduction = process.env.NODE_ENV === 'production';

/* ========================================
   M12.P1-R8 — Pilot indexing protection.

   The facilitator-mediated pilot runs on a PUBLIC Vercel production hostname.
   Vercel applies an automatic noindex to PREVIEW deployments only, so a
   production deployment is crawlable unless the application says otherwise.

   THIS IS NOT ACCESS CONTROL. `X-Robots-Tag` and `public/robots.txt` are
   voluntary directives that well-behaved crawlers honour. They reduce
   incidental search-engine discovery of the pilot; they do not authenticate,
   authorize, rate-limit, or block anyone. Every access-control guarantee still
   comes from requireLogin/requireRole, the session cookie, and CSRF — see
   middleware/roleAuth.js. A crawler or person who ignores these directives is
   stopped by those controls, not by this header.
   ======================================== */
const PILOT_ROBOTS_TAG = 'noindex, nofollow, noarchive';

/**
 * Apply the exact pilot `X-Robots-Tag` to every response this app generates.
 * Mounted before the static handler and before every route, so anonymous pages
 * (`/`, `/auth`, `/privacy`), authenticated HTML, and JSON all carry it.
 */
function pilotNoIndex(req, res, next) {
  res.set('X-Robots-Tag', PILOT_ROBOTS_TAG);
  next();
}

/**
 * Generate a fresh CSP nonce per request and expose it to views. Mounted BEFORE
 * Helmet (which reads it) and before any route/render (which embeds it).
 */
function cspNonce(req, res, next) {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
}

// Helmet directive value: the current request's nonce. (req, res) => string.
const nonce = (req, res) => `'nonce-${res.locals.cspNonce}'`;

const directives = {
  defaultSrc: ["'self'"],
  baseUri: ["'self'"],
  objectSrc: ["'none'"],
  frameAncestors: ["'none'"],
  formAction: ["'self'"],
  // Executable scripts: self + per-request nonce ONLY. R6 removed the three
  // former CDN origins (unpkg.com, cdn.jsdelivr.net, code.iconify.design);
  // every vendor bundle is now served from /vendor on this origin.
  scriptSrc: ["'self'", nonce],
  // Block ALL inline event-handler attributes (onclick=…); they are migrated to
  // listeners instead of being allowed.
  scriptSrcAttr: ["'none'"],
  // Inline <style> ELEMENTS require a nonce. Vendor stylesheets are same-origin
  // ('self') after R6; Google Fonts remains the one documented external
  // stylesheet exception.
  styleSrcElem: ["'self'", nonce, 'https://fonts.googleapis.com'],
  // Narrow temporary exception (see header): inline style="" ATTRIBUTES only.
  styleSrcAttr: ["'unsafe-inline'"],
  fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
  // Milestone 10 (Sections 10.4 + 10.8 pre-gate): https://res.cloudinary.com is
  // the Cloudinary delivery host (config/cloudinary.js ->
  // CLOUDINARY_DELIVERY_HOST) for campus building images and 360 VR panoramas.
  // Allowed for MEDIA DELIVERY ONLY — img-src/media-src for <img>/Image()
  // loads, plus connect-src because Pannellum fetches the panorama JPG via
  // XHR/fetch at runtime. NEVER script-src.
  // R6: cdn.jsdelivr.net and unpkg.com are gone. `data:` stays because the
  // self-hosted Pannellum and MapLibre stylesheets embed every control image as
  // a data: URI; `blob:` stays for canvas/panorama rendering. Leaflet's marker
  // and control images are now same-origin under /vendor/leaflet/images/.
  imgSrc: ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org', 'https://res.cloudinary.com'],
  mediaSrc: ["'self'", 'blob:', 'https://res.cloudinary.com'],
  // api.iconify.design: exact host the iconify-icon component fetches icon DATA
  // from at runtime. After R6 the component SCRIPT is same-origin, so this is a
  // pure data origin — code.iconify.design is no longer in script-src at all.
  // res.cloudinary.com: Pannellum XHR-loads the panorama image (10.8 pre-gate).
  connectSrc: ["'self'", 'https://*.tile.openstreetmap.org', 'https://api.iconify.design', 'https://res.cloudinary.com'],
  // 'blob:' is REQUIRED: the self-hosted MapLibre GL JS 4.7.1 UMD bundle spawns
  // its map worker from a blob: URL. Unchanged by R6 — not a broadening.
  workerSrc: ["'self'", 'blob:'],
  manifestSrc: ["'self'"],
};

// Only force HTTPS upgrades in production (local dev is plain HTTP).
if (isProduction) {
  directives.upgradeInsecureRequests = [];
}

const securityHeaders = helmet({
  contentSecurityPolicy: { useDefaults: false, directives },
  // Keep cross-origin embedder/resource policies permissive enough that the
  // remaining approved cross-origin tiles, fonts, icon data, and panoramas
  // still load. (R6: no cross-origin SCRIPT depends on this any more.)
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

module.exports = { cspNonce, securityHeaders, pilotNoIndex, PILOT_ROBOTS_TAG };
