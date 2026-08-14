'use strict';

/* ========================================
   CampuSphere — M12.P1-R6 self-hosted browser dependencies probe (STANDALONE)

   Proves, in BOTH runtime backends and BOTH map renderer modes, that every
   browser vendor library is served from THIS origin and that no executable
   remote script or stylesheet remains:

     - each affected rendered page references the EXACT intended /vendor asset;
     - no rendered page references a remote <script src>, a remote stylesheet,
       or a remote @import outside the single documented Google Fonts exception;
     - every destination recorded in public/vendor/manifest.json is served with
       HTTP 200 and bytes whose SHA-256 equals the manifest entry;
     - the Leaflet marker/control images resolve locally, which is what lets the
       views drop their former hard-coded remote marker URLs;
     - a missing /vendor path returns a plain 404 with no CDN fallback;
     - the response CSP drops the obsolete executable/style origins while
       keeping the per-request nonce, the approved data/media/font origins and
       the worker boundary MapLibre needs;
     - the service worker declares NO cache-eligible external host at all (OSM
       tiles and Cloudinary media are network-only, and CSP still permits both),
       while OFF.3 self-hosts its renderer and stores the explicitly downloaded
       guide outside Cache Storage.

   Harness: scripts/with-server.js only (self-terminating; never a foreground
   server). MySQL runs on dedicated port 3383, Supabase on 3384; the probe
   REFUSES to start a leg whose port is occupied and never kills any process.

   Session ownership: every canonical login is registered with
   scripts/probeSessionLifecycle.js immediately after login and terminated
   through the real logout interface from the OUTERMOST finally.

   This probe is READ-ONLY with respect to application state: it issues GET
   requests plus the supported login/logout flow. It creates, edits and deletes
   no building, route, scene, schedule, user, or session row directly.

   Privacy: fixed sanitized PASS/FAIL labels only. No credential, email, cookie,
   token, session id, nonce value, Supabase URL/key, or backend error is ever
   printed.
   ======================================== */

require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const net = require('net');
const path = require('path');

const { withServer } = require('./with-server');
const { hasSupabaseConfig } = require('../config/supabase');
const { getRegressionCredentials, requireIdentity } = require('./regressionCredentials');
const { createProbeSessionTracker } = require('./probeSessionLifecycle');

/* Dedicated ports; never shared with npm test (3371/3372) or R5 (3381/3382). */
const PORTS = Object.freeze({ mysql: 3383, supabase: 3384 });

const ROOT = path.join(__dirname, '..');
const VENDOR_DIR = path.join(ROOT, 'public', 'vendor');
const MANIFEST_PATH = path.join(VENDOR_DIR, 'manifest.json');

/* The exact reviewed versions R6 self-hosts. A drift here is a scope change,
   not a maintenance detail, so the analyzer treats it as fatal. */
const EXPECTED_PACKAGES = Object.freeze({
  'leaflet': '1.9.4',
  'maplibre-gl': '4.7.1',
  'pannellum': '2.5.6',
  'iconify-icon': '1.0.7',
  'pmtiles': '4.4.1',
  'lucide': '1.25.0',
});

/* The ONE documented transformation. leaflet/leaflet.js is the official 1.9.4
   distribution with only the trailing sourceMappingURL comment removed; every
   other shipped file is byte-identical to its tarball source (empty array). */
const LEAFLET_SOURCEMAP_TRANSFORMATION =
  "Removed the 35-byte trailing source-map comment '//# sourceMappingURL=leaflet.js.map'. " +
  "Nothing else was changed: the shipped bytes are a byte-exact prefix of the 147552-byte " +
  "tarball source. Pre-existing, reviewed under the post-11.8B Leaflet vendor cleanup and " +
  "preserved unchanged by R6.";

/* ============================================================================
   EXPECTED_VENDOR_INVENTORY — the independently reviewed provenance record.

   This is the SECURITY ANCHOR for R6 provenance. Every value here was verified
   against official npm registry metadata and the exact official tarballs (npm
   view + npm pack in external scratch space): package name/version/license,
   the registry tarball URL and its registry-published sha512 integrity, the
   source path inside the tarball, the shipped /vendor destination, the exact
   byte count, the SHA-256 of the FINAL SHIPPED BYTES, and the transformations
   array. Each non-Leaflet file was confirmed byte-identical to its tarball
   source; leaflet.js was confirmed to be a byte-exact prefix of the tarball
   minus exactly the 35-byte sourceMappingURL trailer.

   Crucially it lives OUTSIDE public/vendor/manifest.json. The manifest is a
   convenience record the app also ships; if an attacker swapped vendor bytes
   AND recomputed the manifest's own sha256 to match, the manifest would be
   internally self-consistent and every shape/self-consistency check would pass.
   This inventory closes that fail-open: the analyzer compares the manifest to
   these pinned values, and the gate re-verifies disk/HTTP bytes against these
   pinned SHA-256s — so changing vendor bytes now requires an explicit reviewed
   edit HERE, in code, not merely a coordinated data edit.
   ============================================================================ */
const EXPECTED_VENDOR_INVENTORY = Object.freeze([
  Object.freeze({
    name: 'leaflet',
    version: '1.9.4',
    license: 'BSD-2-Clause',
    globalInterface: 'L',
    tarball: 'https://registry.npmjs.org/leaflet/-/leaflet-1.9.4.tgz',
    integrity: 'sha512-nxS1ynzJOmOlHp+iL3FyWqK89GtNL8U8rvlMOsQdTTssxZwCXh8N2NB3GDQOL+YR3XnWyZAxwQixURb+FA74PA==',
    fileCount: 8,
    files: Object.freeze([
      Object.freeze({ source: 'package/dist/leaflet.js', destination: '/vendor/leaflet/leaflet.js', bytes: 147517, sha256: 'dc71f8a6880bc3ca1bd9fa8dc5f1af48c702dc510b0a78240a07c5feed7ce935', transformations: Object.freeze([LEAFLET_SOURCEMAP_TRANSFORMATION]) }),
      Object.freeze({ source: 'package/dist/leaflet.css', destination: '/vendor/leaflet/leaflet.css', bytes: 14806, sha256: 'a7837102824184820dfa198d1ebcd109ff6d0ff9a2672a074b9a1b4d147d04c6', transformations: Object.freeze([]) }),
      Object.freeze({ source: 'package/dist/images/layers.png', destination: '/vendor/leaflet/images/layers.png', bytes: 696, sha256: '1dbbe9d028e292f36fcba8f8b3a28d5e8932754fc2215b9ac69e4cdecf5107c6', transformations: Object.freeze([]) }),
      Object.freeze({ source: 'package/dist/images/layers-2x.png', destination: '/vendor/leaflet/images/layers-2x.png', bytes: 1259, sha256: '066daca850d8ffbef007af00b06eac0015728dee279c51f3cb6c716df7c42edf', transformations: Object.freeze([]) }),
      Object.freeze({ source: 'package/dist/images/marker-icon.png', destination: '/vendor/leaflet/images/marker-icon.png', bytes: 1466, sha256: '574c3a5cca85f4114085b6841596d62f00d7c892c7b03f28cbfa301deb1dc437', transformations: Object.freeze([]) }),
      Object.freeze({ source: 'package/dist/images/marker-icon-2x.png', destination: '/vendor/leaflet/images/marker-icon-2x.png', bytes: 2464, sha256: '00179c4c1ee830d3a108412ae0d294f55776cfeb085c60129a39aa6fc4ae2528', transformations: Object.freeze([]) }),
      Object.freeze({ source: 'package/dist/images/marker-shadow.png', destination: '/vendor/leaflet/images/marker-shadow.png', bytes: 618, sha256: '264f5c640339f042dd729062cfc04c17f8ea0f29882b538e3848ed8f10edb4da', transformations: Object.freeze([]) }),
      Object.freeze({ source: 'package/LICENSE', destination: '/vendor/leaflet/LICENSE', bytes: 1395, sha256: '53e8dc25862014e4324741ca18fbe3611e11d42ef69f59f86ea8c5389647d4cb', transformations: Object.freeze([]) }),
    ]),
  }),
  Object.freeze({
    name: 'maplibre-gl',
    version: '4.7.1',
    license: 'BSD-3-Clause',
    globalInterface: 'maplibregl',
    tarball: 'https://registry.npmjs.org/maplibre-gl/-/maplibre-gl-4.7.1.tgz',
    integrity: 'sha512-lgL7XpIwsgICiL82ITplfS7IGwrB1OJIw/pCvprDp2dhmSSEBgmPzYRvwYYYvJGJD7fxUv1Tvpih4nZ6VrLuaA==',
    fileCount: 3,
    files: Object.freeze([
      Object.freeze({ source: 'package/dist/maplibre-gl.js', destination: '/vendor/maplibre/maplibre-gl.js', bytes: 803086, sha256: 'be9633c4d870e26fb37f1cfe5c5a77181667114003ea16207ac7850d8da8add1', transformations: Object.freeze([]) }),
      Object.freeze({ source: 'package/dist/maplibre-gl.css', destination: '/vendor/maplibre/maplibre-gl.css', bytes: 65534, sha256: '576b085fdd9487a65a19215328c1e086c07ce5bf6da09b666b3806d3d008dae9', transformations: Object.freeze([]) }),
      Object.freeze({ source: 'package/dist/LICENSE.txt', destination: '/vendor/maplibre/LICENSE.txt', bytes: 5984, sha256: 'ee5fc05a0677eaf69601d2c7db0d9ecd6cc27c3abc1d0733bc9ed34707cf8ef2', transformations: Object.freeze([]) }),
    ]),
  }),
  Object.freeze({
    name: 'pannellum',
    version: '2.5.6',
    license: 'MIT',
    globalInterface: 'pannellum',
    tarball: 'https://registry.npmjs.org/pannellum/-/pannellum-2.5.6.tgz',
    integrity: 'sha512-R4kSPpj36wQPlyIi9ZftxPfVYF11DEbNBATUEI+pkMGZDFYBV5Jxi6tYFVDdmxA2xaTeKZQHMIuIIj7njVSTQQ==',
    fileCount: 3,
    files: Object.freeze([
      Object.freeze({ source: 'package/build/pannellum.js', destination: '/vendor/pannellum/pannellum.js', bytes: 56249, sha256: 'a28b2f7b339fd0a602c6769df1dca6ad43af73bc8c6a5be67209715289c12a9a', transformations: Object.freeze([]) }),
      Object.freeze({ source: 'package/build/pannellum.css', destination: '/vendor/pannellum/pannellum.css', bytes: 9677, sha256: 'a7f1d7b86f1068f228d92f1b0aef95bd41d1e2e12785516573adbf552ee2793d', transformations: Object.freeze([]) }),
      Object.freeze({ source: 'package/COPYING', destination: '/vendor/pannellum/COPYING', bytes: 1064, sha256: 'b956ebda245899e35149c6a0a867916bfc9d11a6e9464b09fa1d8b3485ce608f', transformations: Object.freeze([]) }),
    ]),
  }),
  Object.freeze({
    name: 'iconify-icon',
    version: '1.0.7',
    license: 'MIT',
    globalInterface: '<iconify-icon> custom element',
    tarball: 'https://registry.npmjs.org/iconify-icon/-/iconify-icon-1.0.7.tgz',
    integrity: 'sha512-MxaO3Jhf3f5ymPWGHR9x74f90TNKcq1D+B2iGucGhVtqAgbC9EtM06kKiTGH2CKELNnexckwhrA3/+OpT4HKFw==',
    fileCount: 2,
    files: Object.freeze([
      Object.freeze({ source: 'package/dist/iconify-icon.min.js', destination: '/vendor/iconify-icon/iconify-icon.min.js', bytes: 21987, sha256: '07f79fdfb76cf05e936327fca3d7cb9a9a31c577b54e6d9c3b7d2318de618510', transformations: Object.freeze([]) }),
      Object.freeze({ source: 'package/license.txt', destination: '/vendor/iconify-icon/license.txt', bytes: 1089, sha256: '1165c29c7cdb6c3280277f628ca76f329e5df4c28fbb5b912d8ad49bcf6c4dac', transformations: Object.freeze([]) }),
    ]),
  }),
  Object.freeze({
    name: 'pmtiles',
    version: '4.4.1',
    license: 'BSD-3-Clause',
    globalInterface: 'pmtiles',
    tarball: 'https://registry.npmjs.org/pmtiles/-/pmtiles-4.4.1.tgz',
    integrity: 'sha512-5oTeQc/yX/ft1evbpIlnoCZugQuug/iYIAj/ZTqIqzdGek4uZEho99En890EE6NOSI3JTI3IG8R7r8+SltphxA==',
    gitHead: '0cebcaeade40034b86facb6e7da4ec726b9053fb',
    fileCount: 2,
    files: Object.freeze([
      Object.freeze({ source: 'package/dist/pmtiles.js', destination: '/vendor/pmtiles/pmtiles.js', bytes: 19668, sha256: '36bcbe1ba97cc07b3fc90cee9cba11729b04e25ec8790cf65a0787d5b38e091b', transformations: Object.freeze([]) }),
      Object.freeze({ source: 'https://raw.githubusercontent.com/protomaps/PMTiles/0cebcaeade40034b86facb6e7da4ec726b9053fb/LICENSE', destination: '/vendor/pmtiles/LICENSE', bytes: 1713, sha256: '0371c38f338835f7fc13ed71176f3d92144e22c8b736a31cced57adbbeb647b3', transformations: Object.freeze([]) }),
    ]),
  }),
  Object.freeze({
    name: 'lucide',
    version: '1.25.0',
    license: 'ISC',
    globalInterface: 'lucide',
    tarball: 'https://registry.npmjs.org/lucide/-/lucide-1.25.0.tgz',
    integrity: 'sha512-Pg/9Ga1xTbrnI6GY/7J9krIYmJIkAf3PkK6wPmsAeUtAQsBdGxs1+dfvLqjf9nPI5aFm9+VquT75JGpO3QXSpQ==',
    fileCount: 2,
    files: Object.freeze([
      Object.freeze({ source: 'package/dist/umd/lucide.min.js', destination: '/vendor/lucide/lucide.min.js', bytes: 411977, sha256: '89678151bc9de869a48a8b430331073cb359478146b34dc103440f18bf143549', transformations: Object.freeze([]) }),
      Object.freeze({ source: 'package/LICENSE', destination: '/vendor/lucide/LICENSE', bytes: 3208, sha256: 'b495047bd93a9b06913511076f504daba17d5bbeb3e0650f3bb53a4220329c57', transformations: Object.freeze([]) }),
    ]),
  }),
]);

/* Total shipped files across all packages (20). Pinned so a missing/extra file
   anywhere is caught even if per-package counts were tampered to compensate. */
const EXPECTED_VENDOR_FILE_TOTAL = 20;

/** PURE: flatten EXPECTED_VENDOR_INVENTORY to a per-file list for disk/HTTP
    verification against the independently pinned SHA-256 (never the manifest). */
function flattenExpectedInventory() {
  const out = [];
  for (const pkg of EXPECTED_VENDOR_INVENTORY) {
    for (const f of pkg.files) {
      out.push({ pkg: pkg.name, source: f.source, destination: f.destination, bytes: f.bytes, sha256: f.sha256, transformations: f.transformations });
    }
  }
  return out;
}

/** PURE: same-length, element-wise === comparison of two string arrays. */
function sameStringArray(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * PURE, FAIL-CLOSED: does the manifest EXACTLY match EXPECTED_VENDOR_INVENTORY?
 *
 * Returns a list of human-readable mismatch strings; an empty list means the
 * manifest reproduces every independently pinned value. Detects missing/extra/
 * duplicate packages and files, and any altered version, license, tarball URL,
 * sha512 integrity, globalInterface, source path, destination, byte count,
 * sha256, or transformations array. This is what makes a coordinated
 * bytes+manifest-hash swap fail without an explicit reviewed code change here.
 *
 * @param {*} manifest parsed public/vendor/manifest.json
 * @returns {string[]} mismatches (empty when exact)
 */
function compareManifestToInventory(manifest) {
  const problems = [];
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.packages)) {
    return ['manifest has no packages array'];
  }

  const manNames = manifest.packages.map((p) => (p && typeof p.name === 'string' ? p.name : null));
  const seen = new Set();
  for (const n of manNames) {
    if (n === null) { problems.push('a manifest package has no name'); continue; }
    if (seen.has(n)) problems.push('duplicate package name: ' + n);
    seen.add(n);
  }
  const expNames = EXPECTED_VENDOR_INVENTORY.map((p) => p.name);
  for (const n of expNames) if (!manNames.includes(n)) problems.push('missing expected package: ' + n);
  for (const n of manNames) if (n !== null && !expNames.includes(n)) problems.push('unexpected package: ' + n);

  // Global destination-uniqueness across ALL packages.
  const allDests = [];
  for (const p of manifest.packages) {
    for (const f of (Array.isArray(p && p.files) ? p.files : [])) {
      if (f && typeof f.destination === 'string') allDests.push(f.destination);
    }
  }
  const dSeen = new Set();
  for (const d of allDests) { if (dSeen.has(d)) problems.push('duplicate destination across manifest: ' + d); dSeen.add(d); }
  if (allDests.length !== EXPECTED_VENDOR_FILE_TOTAL) {
    problems.push(`manifest ships ${allDests.length} files; expected exactly ${EXPECTED_VENDOR_FILE_TOTAL}`);
  }

  for (const ep of EXPECTED_VENDOR_INVENTORY) {
    const mp = manifest.packages.find((p) => p && p.name === ep.name);
    if (!mp) continue; // reported missing above
    if (mp.version !== ep.version) problems.push(`${ep.name}: version "${mp.version}" != expected "${ep.version}"`);
    if (mp.license !== ep.license) problems.push(`${ep.name}: license mismatch`);
    if (mp.tarball !== ep.tarball) problems.push(`${ep.name}: tarball URL mismatch`);
    if (mp.integrity !== ep.integrity) problems.push(`${ep.name}: sha512 integrity mismatch`);
    if (mp.globalInterface !== ep.globalInterface) problems.push(`${ep.name}: globalInterface mismatch`);
    if (ep.gitHead && mp.gitHead !== ep.gitHead) problems.push(`${ep.name}: gitHead mismatch`);

    const mFiles = Array.isArray(mp.files) ? mp.files : [];
    if (mFiles.length !== ep.fileCount) problems.push(`${ep.name}: file count ${mFiles.length} != expected ${ep.fileCount}`);

    for (const ef of ep.files) {
      const mf = mFiles.find((f) => f && f.destination === ef.destination);
      if (!mf) { problems.push(`${ep.name}: missing expected file ${ef.destination}`); continue; }
      if (mf.source !== ef.source) problems.push(`${ef.destination}: source path mismatch`);
      if (mf.bytes !== ef.bytes) problems.push(`${ef.destination}: byte count mismatch`);
      if (mf.sha256 !== ef.sha256) problems.push(`${ef.destination}: sha256 mismatch (independently pinned)`);
      if (!sameStringArray(Array.isArray(mf.transformations) ? mf.transformations : null, ef.transformations)) {
        problems.push(`${ef.destination}: transformations mismatch`);
      }
    }
    for (const mf of mFiles) {
      if (!ep.files.some((ef) => ef.destination === (mf && mf.destination))) {
        problems.push(`${ep.name}: unexpected file ${mf && mf.destination}`);
      }
    }
  }
  return problems;
}

/* The ONE documented external stylesheet exception. No external SCRIPT origin
   is approved at all, which is why the script list is deliberately empty. */
const APPROVED_STYLESHEET_ORIGINS = Object.freeze(['https://fonts.googleapis.com']);
const APPROVED_SCRIPT_ORIGINS = Object.freeze([]);

/* Executable/style CDN origins R6 removed. Kept as an explicit list so a
   regression that reintroduces any one of them is named, not merely counted. */
const REMOVED_EXECUTABLE_ORIGINS = Object.freeze([
  'https://unpkg.com',
  'https://cdn.jsdelivr.net',
  'https://code.iconify.design',
]);

/* Same-origin vendor assets each affected surface must reference. */
const VENDOR = Object.freeze({
  lucide: '/vendor/lucide/lucide.min.js',
  leafletJs: '/vendor/leaflet/leaflet.js',
  leafletCss: '/vendor/leaflet/leaflet.css',
  maplibreJs: '/vendor/maplibre/maplibre-gl.js',
  maplibreCss: '/vendor/maplibre/maplibre-gl.css',
  pannellumJs: '/vendor/pannellum/pannellum.js',
  pannellumCss: '/vendor/pannellum/pannellum.css',
  iconify: '/vendor/iconify-icon/iconify-icon.min.js',
});

/* Leaflet resolves these relatively from leaflet.css / L.Icon.Default. */
const LEAFLET_IMAGES = Object.freeze([
  '/vendor/leaflet/images/layers.png',
  '/vendor/leaflet/images/layers-2x.png',
  '/vendor/leaflet/images/marker-icon.png',
  '/vendor/leaflet/images/marker-icon-2x.png',
  '/vendor/leaflet/images/marker-shadow.png',
]);

const ADMIN_PAGES = Object.freeze([
  '/admin', '/admin/users', '/admin/news', '/admin/faqs',
  '/admin/logs', '/admin/campus-map', '/admin/vr', '/admin/settings',
]);

const failures = [];
let checks = 0;

function check(scope, label, ok) {
  checks += 1;
  const pass = ok === true;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!pass) failures.push(`${scope} :: ${label}`);
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function portIsFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => tester.close(() => resolve(true)));
    tester.listen(port, '127.0.0.1');
  });
}

function cookieJar() {
  const store = {};
  return {
    apply(res) {
      const list = res.headers.getSetCookie
        ? res.headers.getSetCookie()
        : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
      for (const c of list) {
        const pair = c.split(';')[0];
        const i = pair.indexOf('=');
        if (i > 0) store[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
      }
    },
    header() { return Object.entries(store).map(([k, v]) => `${k}=${v}`).join('; '); },
  };
}

const metaCsrf = (html) => {
  const m = String(html).match(/name="csrf-token" content="([^"]+)"/);
  return m ? m[1] : '';
};

/**
 * Authenticate through the supported CSRF + POST /login flow.
 * Credential values stay in memory and are never returned or printed.
 * @returns {Promise<boolean>} true when the login redirect was issued
 */
async function login(base, jar, email, password) {
  let r = await fetch(base + '/auth', { headers: { Accept: 'text/html' } });
  jar.apply(r);
  const token = metaCsrf(await r.text());
  if (!token) return false;
  r = await fetch(base + '/login', {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.header() },
    body: 'email=' + encodeURIComponent(email) +
      '&password=' + encodeURIComponent(password) +
      '&_csrf=' + encodeURIComponent(token),
  });
  jar.apply(r);
  await r.text();
  return r.status === 302;
}

/* =============================================================================
   PURE ANALYZERS — exported so the in-suite gate drives the SAME code path
   =============================================================================
   Every scan below is a CODE SHAPE (a real src=/href= attribute value, a real
   @import url(...)), never a bare substring search. Prose that merely NAMES a
   removed CDN — for example a comment recording which origin was dropped — must
   never be able to fail these contracts, and a negative fixture must not be
   satisfiable by editing a comment. */

/** PURE: remove HTML and EJS comments so commentary can never be scanned. */
function stripComments(source) {
  return String(source == null ? '' : source)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<%#[\s\S]*?%>/g, ' ');
}

/**
 * PURE: extract every asset reference a browser would actually FETCH from a
 * document — script sources, stylesheet hrefs, and CSS @import targets.
 *
 * `rel` is parsed so a preconnect/icon/manifest link is never miscounted as a
 * stylesheet. Comments are stripped first.
 *
 * @param {string} source rendered HTML (or a view/CSS source)
 * @returns {{scripts: string[], stylesheets: string[], imports: string[]}}
 */
function extractDocumentAssetRefs(source) {
  const s = stripComments(source);
  const scripts = [];
  const stylesheets = [];
  const imports = [];

  const scriptRe = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  for (let m = scriptRe.exec(s); m; m = scriptRe.exec(s)) scripts.push(m[1].trim());

  const linkRe = /<link\b([^>]*)>/gi;
  for (let m = linkRe.exec(s); m; m = linkRe.exec(s)) {
    const attrs = m[1];
    const rel = (attrs.match(/\brel\s*=\s*["']([^"']*)["']/i) || [, ''])[1].toLowerCase();
    const href = (attrs.match(/\bhref\s*=\s*["']([^"']*)["']/i) || [, ''])[1].trim();
    if (href && /\bstylesheet\b/.test(rel)) stylesheets.push(href);
  }

  const importRe = /@import\s+url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  for (let m = importRe.exec(s); m; m = importRe.exec(s)) imports.push(m[1].trim());

  return { scripts, stylesheets, imports };
}

/** PURE: the https?://origin of a reference, or '' when it is same-origin. */
function refOrigin(ref) {
  const m = String(ref == null ? '' : ref).match(/^(https?:)?\/\/([^/?#]+)/i);
  if (!m) return '';
  const scheme = (m[1] || 'https:').toLowerCase();
  return scheme + '//' + m[2].toLowerCase();
}

/**
 * PURE: split extracted references into approved and forbidden EXTERNAL ones.
 *
 * Same-origin references are never forbidden. An external stylesheet is allowed
 * only from the documented Google Fonts origin; an external executable script is
 * never allowed.
 *
 * @param {{scripts: string[], stylesheets: string[], imports: string[]}} refs
 * @returns {{approved: string[], forbidden: string[], externalScripts: string[]}}
 */
function classifyExternalRefs(refs) {
  const approved = [];
  const forbidden = [];
  const externalScripts = [];

  const walk = (list, allowedOrigins, isScript) => {
    for (const ref of (Array.isArray(list) ? list : [])) {
      const origin = refOrigin(ref);
      if (origin === '') continue;                    // same-origin: fine
      if (isScript) externalScripts.push(ref);
      if (allowedOrigins.includes(origin)) approved.push(ref);
      else forbidden.push(ref);
    }
  };

  walk(refs && refs.scripts, APPROVED_SCRIPT_ORIGINS, true);
  walk(refs && refs.stylesheets, APPROVED_STYLESHEET_ORIGINS, false);
  walk(refs && refs.imports, APPROVED_STYLESHEET_ORIGINS, false);

  return { approved, forbidden, externalScripts };
}

/** PURE: parse a Content-Security-Policy header into directive -> [values]. */
function parseCsp(headerValue) {
  const out = {};
  for (const part of String(headerValue == null ? '' : headerValue).split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const bits = trimmed.split(/\s+/);
    out[bits[0].toLowerCase()] = bits.slice(1);
  }
  return out;
}

/**
 * PURE: evaluate the R6 CSP contract against a parsed policy.
 *
 * Proves the contraction AND that nothing else was weakened: the per-request
 * nonce survives, no unsafe keyword appears, the approved data/media/font
 * origins remain, and worker-src still permits the blob: worker MapLibre needs.
 *
 * @param {object} directives output of parseCsp
 * @returns {{ok: boolean, violations: string[]}}
 */
function evaluateCspContract(directives) {
  const d = directives && typeof directives === 'object' ? directives : {};
  const violations = [];
  const list = (name) => (Array.isArray(d[name]) ? d[name] : []);
  const joined = (name) => list(name).join(' ');
  const has = (name, token) => list(name).includes(token);

  const script = list('script-src');
  if (!script.includes("'self'")) violations.push('script-src lost self');
  if (!script.some((v) => /^'nonce-/.test(v))) violations.push('script-src lost its per-request nonce');
  if (script.some((v) => /'unsafe-inline'|'unsafe-eval'|'unsafe-hashes'/.test(v))) {
    violations.push('script-src gained an unsafe keyword');
  }

  // Every removed origin must be gone from EVERY directive, not just script-src.
  for (const origin of REMOVED_EXECUTABLE_ORIGINS) {
    const host = origin.replace(/^https?:\/\//, '');
    for (const name of Object.keys(d)) {
      if (joined(name).toLowerCase().includes(host)) {
        violations.push(`${name} still allows ${host}`);
      }
    }
  }

  // Preserved boundaries.
  if (!has('style-src-elem', 'https://fonts.googleapis.com')) violations.push('style-src-elem lost Google Fonts');
  if (!has('style-src-elem', "'self'")) violations.push('style-src-elem lost self');
  if (!list('style-src-elem').some((v) => /^'nonce-/.test(v))) violations.push('style-src-elem lost its nonce');
  if (!has('font-src', 'https://fonts.gstatic.com')) violations.push('font-src lost Google Fonts');
  if (!has('img-src', 'https://*.tile.openstreetmap.org')) violations.push('img-src lost OSM tiles');
  if (!has('img-src', 'data:')) violations.push('img-src lost data: (vendor CSS uses data URIs)');
  if (!has('img-src', 'https://res.cloudinary.com')) violations.push('img-src lost Cloudinary');
  if (!has('media-src', 'https://res.cloudinary.com')) violations.push('media-src lost Cloudinary');
  if (!has('connect-src', 'https://api.iconify.design')) violations.push('connect-src lost the Iconify data API');
  if (!has('connect-src', 'https://res.cloudinary.com')) violations.push('connect-src lost Cloudinary');
  if (!has('connect-src', 'https://*.tile.openstreetmap.org')) violations.push('connect-src lost OSM tiles');
  if (!has('worker-src', 'blob:') || !has('worker-src', "'self'")) {
    violations.push('worker-src no longer permits the self/blob worker boundary');
  }
  if (!has('object-src', "'none'")) violations.push('object-src is no longer none');
  if (!has('frame-ancestors', "'none'")) violations.push('frame-ancestors is no longer none');

  return { ok: violations.length === 0, violations };
}

/**
 * PURE, FAIL-CLOSED validation of public/vendor/manifest.json.
 *
 * @param {*} manifest parsed manifest
 * @returns {{ok: boolean, problems: string[], files: object[], versions: object}}
 */
function analyzeVendorManifest(manifest) {
  const problems = [];
  const files = [];
  const versions = {};

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ok: false, problems: ['manifest is not an object'], files, versions };
  }
  if (!Array.isArray(manifest.packages) || manifest.packages.length === 0) {
    return { ok: false, problems: ['manifest declares no packages'], files, versions };
  }

  for (const pkg of manifest.packages) {
    if (!pkg || typeof pkg !== 'object') { problems.push('a package entry is not an object'); continue; }
    const name = typeof pkg.name === 'string' ? pkg.name : '';
    if (!name) { problems.push('a package entry has no name'); continue; }
    versions[name] = pkg.version;

    if (typeof pkg.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(pkg.version)) {
      problems.push(`${name}: version is not an exact x.y.z`);
    }
    if (typeof pkg.license !== 'string' || pkg.license.trim() === '') {
      problems.push(`${name}: no license recorded`);
    }
    if (typeof pkg.tarball !== 'string' || !/^https:\/\/registry\.npmjs\.org\//.test(pkg.tarball)) {
      problems.push(`${name}: tarball is not a public npm registry URL`);
    }
    if (typeof pkg.integrity !== 'string' || !/^sha512-/.test(pkg.integrity)) {
      problems.push(`${name}: no sha512 registry integrity recorded`);
    }
    if (!Array.isArray(pkg.files) || pkg.files.length === 0) {
      problems.push(`${name}: no files recorded`);
      continue;
    }
    for (const f of pkg.files) {
      if (!f || typeof f !== 'object') { problems.push(`${name}: a file entry is not an object`); continue; }
      if (typeof f.source !== 'string' || f.source.trim() === '') problems.push(`${name}: a file entry has no tarball source path`);
      if (typeof f.destination !== 'string' || !f.destination.startsWith('/vendor/')) {
        problems.push(`${name}: a file destination is not under /vendor/`);
      }
      if (typeof f.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(f.sha256)) {
        problems.push(`${name}: a file entry has no valid SHA-256`);
      }
      if (!Array.isArray(f.transformations)) {
        problems.push(`${name}: a file entry does not declare its transformations`);
      }
      files.push({ pkg: name, license: pkg.license, ...f });
    }
  }

  // No local path, credential, token, or private registry state may be recorded.
  const serialized = JSON.stringify(manifest);
  if (/[A-Za-z]:\\\\|\/Users\/|\/home\/|AppData/i.test(serialized)) problems.push('manifest leaks a local filesystem path');
  if (/(password|secret|token|api[_-]?key|authorization|cookie)\s*"?\s*:/i.test(serialized)) {
    problems.push('manifest appears to record a credential');
  }
  if (/\/\/[^/"]*:[^/"]*@/.test(serialized)) problems.push('manifest records embedded URL credentials');

  // FAIL CLOSED on ANY divergence from the independently reviewed inventory.
  // This is what defeats a coordinated bytes+manifest-hash swap: the manifest's
  // own internal consistency is not enough — it must reproduce the pinned
  // values that live in code and were verified against the official tarballs.
  // `files` is still returned (populated above) so disk/HTTP byte verification
  // can run against the on-disk reality even when a mismatch is present.
  for (const m of compareManifestToInventory(manifest)) problems.push('inventory: ' + m);

  return { ok: problems.length === 0, problems, files, versions };
}

/* ============================ leg execution ============================ */

async function get(base, pathname, jar, accept) {
  const headers = { Accept: accept || 'text/html' };
  if (jar) headers.Cookie = jar.header();
  return fetch(base + pathname, { headers, redirect: 'manual' });
}

/** Assert one rendered page: intended vendor refs present, zero forbidden refs. */
async function checkPage(scope, base, jar, pathname, requiredRefs, forbiddenRefs) {
  const r = await get(base, pathname, jar);
  const html = await r.text();
  const label = pathname;

  check(scope, `${label}: rendered 200`, r.status === 200);
  if (r.status !== 200) return;

  const refs = extractDocumentAssetRefs(html);
  const flat = refs.scripts.concat(refs.stylesheets, refs.imports);

  for (const required of requiredRefs) {
    check(scope, `${label}: references the same-origin ${required}`, flat.includes(required));
  }
  for (const absent of (forbiddenRefs || [])) {
    check(scope, `${label}: does not reference ${absent}`, !flat.includes(absent));
  }

  const { forbidden, externalScripts } = classifyExternalRefs(refs);
  check(scope, `${label}: loads zero external executable scripts`, externalScripts.length === 0);
  check(scope, `${label}: loads no remote asset outside the Google Fonts exception`, forbidden.length === 0);
}

async function runRendererLeg(mode, renderer, base, full) {
  const scope = `${mode}/${renderer}`;
  const creds = getRegressionCredentials(mode);
  const admin = requireIdentity(creds, 'admin');
  const student = requireIdentity(creds, 'student');

  const adminJar = cookieJar();
  const studentJar = cookieJar();
  const sessions = createProbeSessionTracker({
    base,
    record: (label, pass) => check(scope, label, pass),
  });

  try {
    const studentIn = await login(base, studentJar, student.email, student.password);
    check(scope, 'the canonical regression student authenticated', studentIn === true);
    if (!studentIn) return;
    sessions.register('student', studentJar, '/dashboard');

    /* ---- /map in THIS renderer mode ---- */
    if (renderer === 'maplibre') {
      await checkPage(scope, base, studentJar, '/map',
        [VENDOR.maplibreJs, VENDOR.maplibreCss],
        [VENDOR.leafletJs, VENDOR.leafletCss]);
    } else {
      await checkPage(scope, base, studentJar, '/map',
        [VENDOR.leafletJs, VENDOR.leafletCss],
        [VENDOR.maplibreJs, VENDOR.maplibreCss]);
    }

    if (!full) {
      check(scope, 'the renderer-only leg registered exactly one canonical session',
        sessions.count() === 1);
      return;
    }

    /* ---- public + authenticated participant pages ---- */
    await checkPage(scope, base, studentJar, '/home',
      [VENDOR.leafletJs, VENDOR.leafletCss, VENDOR.iconify], []);
    await checkPage(scope, base, studentJar, '/dashboard',
      [VENDOR.leafletJs, VENDOR.leafletCss, VENDOR.iconify], []);
    await checkPage(scope, base, studentJar, '/about', [VENDOR.iconify], []);
    await checkPage(scope, base, studentJar, '/events', [VENDOR.iconify], []);

    /* ---- VR: Free Roam and one valid guided route ---- */
    await checkPage(scope, base, studentJar, '/vr',
      [VENDOR.pannellumJs, VENDOR.pannellumCss], []);

    const search = await get(base, '/api/search?q=' + encodeURIComponent('Arts and Sciences'),
      studentJar, 'application/json');
    let casRouteId = null;
    try {
      const body = await search.json();
      for (const item of (body && body.results) || []) {
        const rd = item && item.building ? Number(item.building.route_destination_id) : NaN;
        if (Number.isInteger(rd) && rd > 0) { casRouteId = rd; break; }
      }
    } catch (e) { casRouteId = null; }
    check(scope, 'a valid guided VR destination was resolved through the search API',
      Number.isInteger(casRouteId) && casRouteId > 0);
    if (Number.isInteger(casRouteId) && casRouteId > 0) {
      await checkPage(scope, base, studentJar, '/vr/to/' + casRouteId,
        [VENDOR.pannellumJs, VENDOR.pannellumCss], []);
    }

    /* ---- CSP contract on a live authenticated response ---- */
    {
      const r = await get(base, '/dashboard', studentJar);
      await r.text();
      const contract = evaluateCspContract(parseCsp(r.headers.get('content-security-policy')));
      check(scope, 'the live CSP satisfies the complete R6 contract', contract.ok === true);
      if (!contract.ok) contract.violations.forEach((v) => console.error('    - CSP: ' + v));
    }

    /* ---- vendor assets are served, byte-exact, from this origin ---- */
    {
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
      const analysis = analyzeVendorManifest(manifest);
      check(scope, 'public/vendor/manifest.json is structurally valid', analysis.ok === true);
      if (!analysis.ok) analysis.problems.forEach((p) => console.error('    - manifest: ' + p));

      let served = 0;
      let mismatched = 0;
      for (const file of analysis.files) {
        const r = await get(base, file.destination, null, '*/*');
        if (r.status !== 200) { mismatched += 1; continue; }
        const bytes = Buffer.from(await r.arrayBuffer());
        if (sha256(bytes) === file.sha256) served += 1; else mismatched += 1;
      }
      check(scope, 'every manifest destination is served 200 with byte-exact SHA-256',
        analysis.files.length > 0 && mismatched === 0 && served === analysis.files.length);
    }

    /* ---- Leaflet marker/control images resolve locally ---- */
    {
      let ok = 0;
      for (const img of LEAFLET_IMAGES) {
        const r = await get(base, img, null, 'image/*');
        await r.arrayBuffer();
        if (r.status === 200) ok += 1;
      }
      check(scope, 'all five Leaflet distribution images resolve locally',
        ok === LEAFLET_IMAGES.length);
    }

    /* ---- a missing vendor path 404s and never falls back to a CDN ---- */
    {
      const r = await get(base, '/vendor/leaflet/this-asset-does-not-exist.js', null, '*/*');
      const body = await r.text();
      check(scope, 'a missing /vendor path returns 404', r.status === 404);
      check(scope, 'the 404 body advertises no CDN fallback',
        !REMOVED_EXECUTABLE_ORIGINS.some((o) => body.includes(o.replace(/^https?:\/\//, ''))));
      check(scope, 'the 404 carries no redirect to another origin',
        !r.headers.get('location'));
    }

    /* ---- service-worker privacy boundary remains intact ---- */
    {
      const r = await get(base, '/sw.js', null, '*/*');
      const sw = await r.text();
      check(scope, '/sw.js is served from this origin', r.status === 200);
      // 2D-only correction: NO cross-origin host is cache-eligible. OSM tiles
      // and Cloudinary media are network-only and the external cache machinery
      // is removed. This changes only the SERVICE-WORKER caching expectation —
      // the CSP checks above still require OSM/Cloudinary to remain permitted
      // so the ONLINE Leaflet/MapLibre map and media delivery are unaffected.
      /* Mirrors the OFF.2 probe's exact guard: no external host or strategy, no
         API cache machinery, EXACTLY ONE '/api' network-only prefix, the full
         classifier truth table evaluated behaviourally, CURRENT_CACHES
         tokenizing to exactly [SHELL_CACHE, STATIC_CACHE], and the guard before
         every remaining same-origin strategy. Fails closed on any error. The
         CSP checks above are untouched, so online OSM/Cloudinary stay allowed. */
      check(scope, 'sw.js declares no external host, no API cache, exactly two caches, and the exact /api network-only classifier',
        (() => {
          try {
            const code = sw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
            if (/function isApprovedExternalHost/.test(sw) || /function externalStrategy/.test(sw)) return false;
            if (/EXTERNAL_CACHE/.test(code)) return false;
            if (/function isApprovedApi/.test(sw) || /function apiStrategy/.test(sw)) return false;
            if (/API_CACHE/.test(code) || /API_MAX/.test(code)) return false;
            const fnMatch = sw.match(/function isNetworkOnlyPath[\s\S]*?\n}/);
            const listMatch = code.match(/NETWORK_ONLY_PREFIXES\s*=\s*\[([\s\S]*?)\]/);
            const fetchListener = (sw.match(/addEventListener\('fetch'[\s\S]*$/) || [''])[0];
            if (!fnMatch || !listMatch || fetchListener === '') return false;
            const prefixes = (listMatch[1].match(/'([^']*)'/g) || []).map((s) => s.slice(1, -1));
            if (prefixes.length !== 1 || prefixes[0] !== '/api') return false;
            const vm = require('vm');
            const box = Object.create(null);
            vm.createContext(box);
            vm.runInContext('var NETWORK_ONLY_PREFIXES = ' + JSON.stringify(prefixes) + ';\n' +
              fnMatch[0] + '\n__f = isNetworkOnlyPath;', box, { timeout: 1000 });
            const f = box.__f;
            if (typeof f !== 'function') return false;
            const yes = ['/api', '/api/buildings', '/api/routes', '/api/routes/1',
              '/api/vr/routes/1', '/api/search', '/api/pathfind'];
            const no = ['/apiary', '/apis', '/auth', '/map', '/'];
            if (!yes.every((p) => f(p) === true) || !no.every((p) => f(p) === false)) return false;
            const cc = code.match(/CURRENT_CACHES\s*=\s*\[([^\]]*)\]/);
            if (!cc) return false;
            const tok = cc[1].split(',').map((t) => t.trim()).filter(Boolean);
            if (tok.length !== 2 || tok[0] !== 'SHELL_CACHE' || tok[1] !== 'STATIC_CACHE') return false;
            const guard = fetchListener.search(/isNetworkOnlyPath\(\s*url\.pathname\s*\)/);
            const strategies = ['navigationFallbackStrategy(', 'staticStrategy(']
              .map((n) => fetchListener.indexOf(n));
            return guard !== -1 && strategies.every((i) => i !== -1) && strategies.every((i) => guard < i);
          } catch (e) { return false; }
        })());
      check(scope, 'sw.js still never caches HTML navigations',
        /function navigationFallbackStrategy/.test(sw) && !/\bvar\s+PAGE_CACHE\s*=/.test(sw));
      check(scope, 'sw.js still refuses the authenticated/forbidden prefixes',
        /FORBIDDEN_PREFIXES/.test(sw) && /'\/admin'/.test(sw) && /'\/api\/offline-guide'/.test(sw));
    }

    /* ---- the eight affected administrator pages ---- */
    const adminIn = await login(base, adminJar, admin.email, admin.password);
    check(scope, 'the canonical regression administrator authenticated', adminIn === true);
    if (adminIn) {
      sessions.register('admin', adminJar, '/dashboard');
      for (const page of ADMIN_PAGES) {
        const required = page === '/admin/campus-map'
          ? [VENDOR.lucide, VENDOR.leafletJs, VENDOR.leafletCss]
          : [VENDOR.lucide];
        await checkPage(scope, base, adminJar, page, required, []);
      }
    }

    check(scope, 'both canonical sessions were registered for owned termination',
      sessions.count() === 2);
  } finally {
    /* OUTERMOST termination through the supported logout interface. No session
       row is touched directly. */
    await sessions.terminateAll();
  }
}

async function runLeg(mode) {
  const port = PORTS[mode];
  const free = await portIsFree(port);
  check(mode, 'the dedicated probe port is confirmed free before launch', free === true);
  if (!free) {
    // Fail closed. Never kill or inspect whatever owns the port.
    console.error(`  [SKIP] ${mode} :: leg not started — its dedicated port is occupied by another process.`);
    return;
  }

  const previousRenderer = process.env.MAP_RENDERER;
  try {
    for (const renderer of ['leaflet', 'maplibre']) {
      // with-server spreads the full process environment into the child, so
      // setting it here selects the renderer without modifying the harness.
      process.env.MAP_RENDERER = renderer;
      console.log(`\n${mode} mode / ${renderer} renderer:`);
      await withServer({ mode, port, sessionStore: mode },
        (base) => runRendererLeg(mode, renderer, base, renderer === 'leaflet'));
    }
  } finally {
    if (previousRenderer === undefined) delete process.env.MAP_RENDERER;
    else process.env.MAP_RENDERER = previousRenderer;
  }
}

/* ---- database-free static checks (run once, not per backend) ---- */
function runStaticChecks() {
  const scope = 'static';
  const manifestRaw = fs.existsSync(MANIFEST_PATH) ? fs.readFileSync(MANIFEST_PATH, 'utf8') : '';
  check(scope, 'public/vendor/manifest.json exists', manifestRaw !== '');
  if (manifestRaw === '') return;

  let manifest = null;
  try { manifest = JSON.parse(manifestRaw); } catch (e) { manifest = null; }
  check(scope, 'public/vendor/manifest.json parses as JSON', manifest !== null);
  if (!manifest) return;

  const analysis = analyzeVendorManifest(manifest);
  check(scope, 'the manifest passes fail-closed structural validation', analysis.ok === true);
  if (!analysis.ok) analysis.problems.forEach((p) => console.error('    - ' + p));

  // The manifest must reproduce the independently reviewed inventory EXACTLY.
  const invMismatch = compareManifestToInventory(manifest);
  check(scope, 'the manifest matches the independently pinned reviewed inventory EXACTLY',
    invMismatch.length === 0);
  if (invMismatch.length) invMismatch.forEach((m) => console.error('    - inventory: ' + m));

  for (const [name, version] of Object.entries(EXPECTED_PACKAGES)) {
    check(scope, `${name} is pinned to the exact reviewed ${version}`,
      analysis.versions[name] === version);
  }

  let onDisk = 0;
  for (const file of analysis.files) {
    const abs = path.join(ROOT, 'public', file.destination.replace(/^\/+/, ''));
    if (fs.existsSync(abs) && sha256(fs.readFileSync(abs)) === file.sha256) onDisk += 1;
  }
  check(scope, 'every manifest file exists on disk with its recorded SHA-256',
    analysis.files.length > 0 && onDisk === analysis.files.length);

  // Independent of the manifest: disk bytes must equal the INVENTORY's pinned
  // SHA-256, so a coordinated bytes+manifest-hash swap still fails here.
  let invOnDisk = 0;
  const invFiles = flattenExpectedInventory();
  for (const file of invFiles) {
    const abs = path.join(ROOT, 'public', file.destination.replace(/^\/+/, ''));
    if (fs.existsSync(abs)) {
      const bytes = fs.readFileSync(abs);
      if (sha256(bytes) === file.sha256 && bytes.length === file.bytes) invOnDisk += 1;
    }
  }
  check(scope, 'every shipped file matches the independently pinned SHA-256 and byte count',
    invFiles.length === EXPECTED_VENDOR_FILE_TOTAL && invOnDisk === invFiles.length);

  // The single documented transformation, and no undocumented one.
  const transformed = analysis.files.filter((f) => f.transformations.length > 0);
  check(scope, 'exactly one shipped file declares a transformation', transformed.length === 1);
  check(scope, 'the transformed file is Leaflet JS and records the sourceMappingURL removal',
    transformed.length === 1 &&
    transformed[0].destination === '/vendor/leaflet/leaflet.js' &&
    /sourceMappingURL/.test(transformed[0].transformations.join(' ')));

  // Each package ships a license notice.
  const licensed = new Set(analysis.files
    .filter((f) => /(LICENSE|COPYING|license)/.test(path.basename(f.destination)))
    .map((f) => f.pkg));
  check(scope, 'every self-hosted package ships its license notice',
    Object.keys(EXPECTED_PACKAGES).every((p) => licensed.has(p)));
}

async function main() {
  console.log('=== CampuSphere M12.P1-R6 self-hosted browser dependencies probe (STANDALONE) ===');
  console.log('Read-only GETs plus the supported login/logout flow. No application data is created or modified.');

  console.log('\nstatic vendor inventory:');
  runStaticChecks();

  await runLeg('mysql');

  // Supabase FAILS CLOSED: an unconfigured environment is a probe failure, not
  // a skip. The regression-credential loader fails closed independently.
  if (!hasSupabaseConfig()) {
    throw new Error('Supabase configuration is required for the R6 probe; the Supabase leg is never skipped.');
  }
  await runLeg('supabase');

  console.log('');
  if (failures.length === 0) {
    console.log(`SELF-HOSTED-BROWSER-DEPENDENCIES-PROBE OK: ${checks}/${checks} checks passed.`);
  } else {
    console.error(`SELF-HOSTED-BROWSER-DEPENDENCIES-PROBE FAILED: ${failures.length}/${checks} check(s) did not pass:`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    // Fixed sanitized message only — never a stack, value, or backend detail.
    console.error('SELF-HOSTED-BROWSER-DEPENDENCIES-PROBE FAILED:',
      error && error.message ? error.message : 'sanitized failure');
    process.exitCode = 1;
  });
}

module.exports = {
  EXPECTED_PACKAGES,
  EXPECTED_VENDOR_INVENTORY,
  EXPECTED_VENDOR_FILE_TOTAL,
  LEAFLET_SOURCEMAP_TRANSFORMATION,
  APPROVED_STYLESHEET_ORIGINS,
  APPROVED_SCRIPT_ORIGINS,
  REMOVED_EXECUTABLE_ORIGINS,
  VENDOR,
  LEAFLET_IMAGES,
  ADMIN_PAGES,
  stripComments,
  extractDocumentAssetRefs,
  refOrigin,
  classifyExternalRefs,
  parseCsp,
  evaluateCspContract,
  analyzeVendorManifest,
  compareManifestToInventory,
  flattenExpectedInventory,
  sameStringArray,
};
