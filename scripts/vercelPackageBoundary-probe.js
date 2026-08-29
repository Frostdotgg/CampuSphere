'use strict';

/* ========================================
   CampuSphere — M12.P1-R7 Vercel package and static-CDN boundary probe
   (STANDALONE)

   Proves that the deployment package Vercel would upload contains ONLY the
   reviewed runtime surface, and that the excluded local scratch panorama
   directory is neither uploadable nor CDN-addressable:

     - `.vercelignore` is a structurally valid ALLOWLIST whose first rule is the
       root `/*` token, and whose vocabulary is restricted to the small set of
       patterns this contract understands (anything else fails closed);
     - the expected root files, runtime directories, public asset classes, and
       self-hosted vendor files are re-included, and every forbidden path class
       (`.env*`, docs/handoffs, scripts/tests, database/migrations, screenshots
       and evidence media, Docker packaging, local agent metadata, temporary
       material, node_modules, Git metadata, `public/img/sample 360/**`) stays
       out of the enumerated package;
     - `vercel.json` carries EXACTLY `$schema` and `headers`, its header rules
       match the reviewed contract one-for-one, no rule is broad/dynamic, and no
       rule other than `/offline.html` defines a Content-Security-Policy — so
       Express's per-response nonce CSP remains the sole CSP authority for
       dynamic application responses;
     - a bounded local static listener serving ONLY the allowlisted public files
       returns 200 with byte-identical bodies for representative CSS/JS/icon/
       manifest/offline-shell/service-worker/image assets and all 18 vendored
       runtime files, returns 404 for a missing asset, returns 404 for both the
       decoded-space and percent-encoded `public/img/sample 360/**` forms, and
       never exposes an excluded file through a redirect or fallback.

   INDEPENDENCE. Every expectation above is pinned in THIS FILE — in
   `EXPECTED_ROOT_FILES`, `EXPECTED_RUNTIME_DIRS`, `EXPECTED_DENIED_SUBTREES`,
   `FORBIDDEN_PATH_CLASSES`, `EXPECTED_PUBLIC_ASSET_CLASSES`,
   `EXPECTED_VENDOR_RUNTIME_FILES`, and `EXPECTED_HEADER_RULES` — deliberately
   OUTSIDE `.vercelignore` and `vercel.json`. A coordinated edit of the
   configuration plus the printed preview therefore still fails unless this
   reviewed contract is explicitly changed in code.

   SCOPE. Read-only with respect to the repository and database-free: it opens
   no database pool, no Supabase/Upstash/Cloudinary client, no application
   session, and no external network connection. It starts NO application server
   (`scripts/with-server.js` is not needed and is not used) — only one bounded
   static listener on dedicated port 3385, serving a temporary directory created
   OUTSIDE the repository. The listener is closed and the temporary directory is
   removed in `finally`. No process is ever killed.

   OUTPUT. The package inventory is CONSOLE-ONLY. Nothing is written into the
   repository: no package manifest, no deployment archive, no `.vercel`
   metadata. The inventory reflects the bytes currently present in the
   repository at the moment it runs. It does NOT itself establish that those
   bytes are committed, clean, or immutable — this probe never inspects Git
   state — and it is NOT deployment authorization. Git cleanliness and
   immutability are established separately, by the reviewer, from Git evidence.

   PRIVACY. Fixed sanitized PASS/FAIL labels. Ignored filenames are never
   printed — a forbidden inclusion is reported by CLASS LABEL and COUNT only.
   ======================================== */

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');

/* Dedicated port; never shared with npm test (3371/3372), R5 (3381/3382), or
   R6 (3383/3384). */
const STATIC_PORT = 3385;

const ROOT = path.join(__dirname, '..');
const IGNORE_FILE = '.vercelignore';
const VERCEL_JSON_FILE = 'vercel.json';

/* Independent exact-byte authority for the current reviewed package. Keep this
   pin local to the standalone probe so a coordinated documentation or
   quality-gate edit cannot silently bless changed deployable bytes. */
const EXPECTED_PACKAGE_INVENTORY = Object.freeze({
  files: 188,
  bytes: 7242664,
  sha256: '59292177ec4d8d48cfdde24a21ef61bcc2476c14e385416447d7627eaca45eee',
});

/* M12.P1-R8 label correction.
   The superseded label described this inventory as an uncommitted-working-tree
   preview and denied being an immutable manifest. That was accurate while the
   deployable application lived outside version control, but it became FALSE
   once the complete intended state was committed as a clean snapshot, and it
   contradicted docs/deployment.md.

   The replacement stays neutral about version-control state (which this probe
   does not inspect) while keeping the load-bearing disclaimer: enumerating the
   package is NOT permission to upload it. Accepted historical R7 evidence
   retains the original label and totals as history; see docs/test-evidence.md.

   The superseded literal is deliberately NOT reproduced anywhere in this file:
   the quality gate proves the old label is gone by scanning this source, so
   quoting it here — even in a comment — would fail that check. */
const PREVIEW_LABEL =
  'CURRENT VERCEL PACKAGE BOUNDARY INVENTORY - NOT DEPLOYMENT AUTHORIZATION';

/* =============================================================================
   INDEPENDENTLY PINNED CONTRACT (reviewed code, not derived from the configs)
   ========================================================================== */

/** The only root FILES the package may carry. */
const EXPECTED_ROOT_FILES = Object.freeze([
  'package-lock.json',
  'package.json',
  'server.js',
  'vercel.json',
]);

/** The only root DIRECTORIES the package may carry. */
const EXPECTED_RUNTIME_DIRS = Object.freeze([
  'config',
  'controllers',
  'middleware',
  'models',
  'public',
  'repositories',
  'routes',
  'services',
  'utils',
  'views',
]);

/** Subtrees that must be denied AFTER their parent is re-included. */
const EXPECTED_DENIED_SUBTREES = Object.freeze(['public/img/sample 360']);

/** The exact first rule of an allowlist ignore file. */
const ROOT_IGNORE_TOKEN = '/*';

/**
 * The R7 source files that must stay auditable with ORDINARY text tooling.
 *
 * A single literal 0x00 byte makes `rg`, `grep`, `git diff`, and most review
 * tools classify a UTF-8 source file as binary and print "binary file matches"
 * instead of the matching line — which silently removes the file from human and
 * automated source review. The separator inside `computeAggregateSha256()` is
 * intentionally a NUL CHARACTER at runtime, but it must be written as the
 * textual JavaScript escape `\0`, never as a literal source byte.
 */
const R7_AUDITABLE_SOURCE_FILES = Object.freeze([
  '.vercelignore',
  'vercel.json',
  'scripts/vercelPackageBoundary-probe.js',
  'scripts/quality-gates.js',
]);

/**
 * Path classes that must NEVER appear in the enumerated package. Each entry is
 * [label, predicate] over a normalized forward-slash repository-relative path.
 * Reported by label and count only — never by filename.
 */
const FORBIDDEN_PATH_CLASSES = Object.freeze([
  ['environment secrets (.env, .env.*, .env.example)',
    (p) => /(^|\/)\.env($|\.)/i.test(p)],
  ['documentation, handoffs, and plans',
    (p) => /^docs\//i.test(p) || /^[^/]+\.md$/i.test(p)],
  ['scripts, probes, and quality gates',
    (p) => /^scripts(\/|$)/i.test(p)],
  ['database schema, seed, dumps, and migrations',
    (p) => /^database(\/|$)/i.test(p) || /\.sql$/i.test(p)],
  ['screenshots, evidence, and defense media',
    (p) => !/^public\//i.test(p) &&
      /\.(png|jpe?g|gif|webp|bmp|svg|pdf|docx?|pptx?|xlsx?)$/i.test(p)],
  ['root presentation/report HTML',
    (p) => /^[^/]+\.html?$/i.test(p)],
  ['Docker packaging',
    (p) => /^(Dockerfile|\.dockerignore|docker-compose\.ya?ml)$/i.test(p)],
  ['local agent, editor, and tooling metadata',
    (p) => /^\.(agents|claude|codex|playwright-mcp|vscode|idea|vercel|edge-profile)(\/|$)/i.test(p)],
  ['installed dependencies',
    (p) => /^node_modules(\/|$)/i.test(p)],
  ['logs, caches, and temporary material',
    (p) => /^(logs|coverage|dist|build|tmp|temp|test-results|playwright-report|\.nyc_output|\.cache|\.npm)(\/|$)/i.test(p) ||
      /\.(log|tmp|temp|swp|bak|dump|sqlite3?)$/i.test(p)],
  ['version-control metadata',
    (p) => /^\.git(\/|$)/i.test(p) || /^\.git(ignore|attributes|modules)$/i.test(p)],
  ['local scratch panoramas',
    (p) => /^public\/img\/sample 360(\/|$)/i.test(p)],
]);

/** Public asset classes the package must still carry. [label, predicate] */
const EXPECTED_PUBLIC_ASSET_CLASSES = Object.freeze([
  ['stylesheets', (p) => /^public\/css\/[^/]+\.css$/.test(p)],
  ['client scripts', (p) => /^public\/js\/.+\.js$/.test(p)],
  ['campus images', (p) => /^public\/img\/[^/]+\.(png|jpe?g)$/i.test(p)],
  ['PWA icons', (p) => /^public\/img\/icons\/[^/]+\.png$/i.test(p)],
  ['web app manifest', (p) => p === 'public/manifest.webmanifest'],
  ['offline shell', (p) => p === 'public/offline.html'],
  ['service worker', (p) => p === 'public/sw.js'],
  ['offline campus map', (p) => /^public\/maps\/cspc-campus-[0-9a-f]{64}\.pmtiles$/.test(p)],
  ['offline campus map manifest', (p) => p === 'public/maps/manifest.json'],
  ['self-hosted vendor assets', (p) => /^public\/vendor\//.test(p)],
]);

/** The 20 vendored runtime files self-hosted by R6 plus OFF.3, pinned again here. */
const EXPECTED_VENDOR_RUNTIME_FILES = Object.freeze([
  'public/vendor/iconify-icon/iconify-icon.min.js',
  'public/vendor/iconify-icon/license.txt',
  'public/vendor/leaflet/LICENSE',
  'public/vendor/leaflet/images/layers-2x.png',
  'public/vendor/leaflet/images/layers.png',
  'public/vendor/leaflet/images/marker-icon-2x.png',
  'public/vendor/leaflet/images/marker-icon.png',
  'public/vendor/leaflet/images/marker-shadow.png',
  'public/vendor/leaflet/leaflet.css',
  'public/vendor/leaflet/leaflet.js',
  'public/vendor/lucide/LICENSE',
  'public/vendor/lucide/lucide.min.js',
  'public/vendor/maplibre/LICENSE.txt',
  'public/vendor/maplibre/maplibre-gl.css',
  'public/vendor/maplibre/maplibre-gl.js',
  'public/vendor/pannellum/COPYING',
  'public/vendor/pannellum/pannellum.css',
  'public/vendor/pannellum/pannellum.js',
  'public/vendor/pmtiles/LICENSE',
  'public/vendor/pmtiles/pmtiles.js',
]);
const EXPECTED_VENDOR_MANIFEST_FILE = 'public/vendor/manifest.json';

const EXPECTED_OFFLINE_MAP_RUNTIME_FILES = Object.freeze([
  'public/maps/cspc-campus-1f4ba05b5c69228e988f911a96a186bae52c52dda9be2127c0168512856ce44a.pmtiles',
  'public/maps/manifest.json',
]);

/** Representative non-vendor assets the static boundary must serve byte-exact. */
const REPRESENTATIVE_STATIC_ASSETS = Object.freeze([
  ['stylesheet', 'public/css/styles.css'],
  ['client script', 'public/js/pwa.js'],
  ['PWA icon', 'public/img/icons/icon-192.png'],
  ['web app manifest', 'public/manifest.webmanifest'],
  ['offline shell', 'public/offline.html'],
  ['service worker', 'public/sw.js'],
  ['normal campus image', 'public/img/cspc-logo.png'],
]);

const NOSNIFF = Object.freeze({ key: 'X-Content-Type-Options', value: 'nosniff' });

/** The fixed static-only CSP for the session-neutral offline shell. */
const EXPECTED_OFFLINE_CSP =
  "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; " +
  "frame-src 'none'; form-action 'self'; script-src 'self'; script-src-attr 'none'; " +
  "style-src 'self'; img-src 'self' data: blob:; manifest-src 'self'; " +
  "connect-src 'self'; worker-src 'self' blob:";

const EXPECTED_SCHEMA = 'https://openapi.vercel.sh/vercel.json';
const EXPECTED_VERCEL_JSON_KEYS = Object.freeze(['$schema', 'headers']);

/** Top-level keys that would turn the config into a build/routing authority. */
const FORBIDDEN_VERCEL_JSON_KEYS = Object.freeze([
  'builds', 'functions', 'routes', 'rewrites', 'redirects', 'outputDirectory',
  'framework', 'installCommand', 'buildCommand', 'devCommand', 'ignoreCommand',
  'cleanUrls', 'trailingSlash', 'public', 'regions', 'crons',
]);

/** The reviewed header rules, in order. */
const EXPECTED_HEADER_RULES = Object.freeze([
  { source: '/css/:path*', headers: [NOSNIFF] },
  { source: '/js/:path*', headers: [NOSNIFF] },
  { source: '/img/:path*', headers: [NOSNIFF] },
  { source: '/vendor/:path*', headers: [NOSNIFF] },
  { source: '/manifest.webmanifest', headers: [NOSNIFF] },
  {
    source: '/sw.js',
    headers: [
      { key: 'Cache-Control', value: 'no-cache' },
      { key: 'Service-Worker-Allowed', value: '/' },
      NOSNIFF,
    ],
  },
  {
    source: '/offline.html',
    headers: [
      NOSNIFF,
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'Content-Security-Policy', value: EXPECTED_OFFLINE_CSP },
    ],
  },
  {
    source: '/maps/cspc-campus-1f4ba05b5c69228e988f911a96a186bae52c52dda9be2127c0168512856ce44a.pmtiles',
    headers: [
      NOSNIFF,
      { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
    ],
  },
]);

/** Only the offline shell may carry a static CSP. */
const CSP_ALLOWED_SOURCE = '/offline.html';

/* =============================================================================
   PURE ANALYZERS
   ========================================================================== */

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/** PURE: normalize a repository path to forward slashes without a leading `./`. */
function toPosix(value) {
  return String(value == null ? '' : value).replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * PURE: is a header `source` broad enough to cover the dynamic application?
 * A source is broad when, after the leading slash, nothing but a wildcard token
 * remains — `/`, `/:path*`, `/(.*)`, `/**`, and friends.
 */
function isBroadHeaderSource(source) {
  const s = String(source == null ? '' : source).trim();
  if (s === '' || s === '/') return true;
  if (s[0] !== '/') return true; // a non-anchored source is not narrowly scoped
  const rest = s.slice(1).replace(/\/$/, '');
  return rest === '' || /^(\*{1,2}|:[^/]*\*|\([^)]*\)[?*]?)$/.test(rest);
}

/** PURE: only an exact filename carrying a 64-hex content hash may be immutable. */
function isContentHashedAssetSource(source) {
  return /^\/[A-Za-z0-9._~/-]*-[0-9a-f]{64}\.[A-Za-z0-9]+$/.test(
    String(source == null ? '' : source).trim()
  );
}

/**
 * PURE: does this raw file content contain a literal 0x00 byte?
 *
 * FAILS CLOSED: anything that is not a real Buffer is reported as containing a
 * literal NUL, so an unreadable file, a decoded string (which would silently
 * lose the distinction between the byte and the textual `\0` escape), or a
 * spoofed object can never be mistaken for a clean source file.
 *
 * @param {Buffer} bytes raw file content
 * @returns {boolean} true when a literal NUL is present OR the input is invalid
 */
function containsLiteralNulByte(bytes) {
  if (!Buffer.isBuffer(bytes)) return true; // fail closed on invalid input
  return bytes.includes(0x00);
}

/**
 * PURE: parse and structurally validate `.vercelignore`.
 *
 * Fails closed on: an empty/whitespace-only file; a rule that is not in the
 * supported vocabulary; an absolute path or drive letter; a `..` traversal
 * segment; a backslash or duplicated `/` separator; a percent-encoded or
 * doubled/leading/trailing space; a duplicate rule; or a case-fold collision.
 *
 * @returns {{ok: boolean, problems: string[], rules: Array}}
 */
function parseVercelIgnore(text) {
  const problems = [];
  const rules = [];
  const raw = String(text == null ? '' : text);
  if (raw.trim() === '') {
    return { ok: false, problems: ['.vercelignore is missing or empty'], rules: [] };
  }

  const seen = new Map();       // exact rule -> line number
  const folded = new Map();     // case-folded rule -> line number
  const lines = raw.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    if (/^\s/.test(line)) { problems.push(`line ${lineNo}: rule has leading whitespace`); continue; }
    if (/\s$/.test(line)) { problems.push(`line ${lineNo}: rule has trailing whitespace`); continue; }
    if (/\t/.test(line)) { problems.push(`line ${lineNo}: rule contains a tab`); continue; }
    if (line.includes('\\')) { problems.push(`line ${lineNo}: rule contains a backslash separator`); continue; }
    if (line.includes('//')) { problems.push(`line ${lineNo}: rule contains a duplicated separator`); continue; }
    if (/%[0-9a-fA-F]{2}/.test(line)) { problems.push(`line ${lineNo}: rule contains a percent-encoded character`); continue; }
    if (/ {2,}/.test(line)) { problems.push(`line ${lineNo}: rule contains a doubled space`); continue; }
    if (/^[A-Za-z]:/.test(line)) { problems.push(`line ${lineNo}: rule is an absolute path`); continue; }

    const negated = line.startsWith('!');
    const pattern = negated ? line.slice(1) : line;

    if (pattern === '') { problems.push(`line ${lineNo}: rule has an empty pattern`); continue; }
    if (pattern.split('/').includes('..')) { problems.push(`line ${lineNo}: rule contains a traversal segment`); continue; }
    if (pattern !== ROOT_IGNORE_TOKEN && pattern.startsWith('/')) {
      problems.push(`line ${lineNo}: rule is rooted with a leading slash outside the ${ROOT_IGNORE_TOKEN} token`);
      continue;
    }

    const supported =
      pattern === ROOT_IGNORE_TOKEN ||                       // the allowlist root token
      /^[A-Za-z0-9][A-Za-z0-9._ -]*(\/[A-Za-z0-9][A-Za-z0-9._ -]*)*$/.test(pattern) ||        // name or path
      /^[A-Za-z0-9][A-Za-z0-9._ -]*(\/[A-Za-z0-9][A-Za-z0-9._ -]*)*\/$/.test(pattern) ||      // directory
      /^[A-Za-z0-9][A-Za-z0-9._ -]*(\/[A-Za-z0-9][A-Za-z0-9._ -]*)*\/\*\*$/.test(pattern);    // subtree
    if (!supported) { problems.push(`line ${lineNo}: rule is outside the supported allowlist vocabulary`); continue; }

    const key = (negated ? '!' : '') + pattern;
    if (seen.has(key)) { problems.push(`line ${lineNo}: duplicate rule also present on line ${seen.get(key)}`); continue; }
    seen.set(key, lineNo);
    const foldKey = key.toLowerCase();
    if (folded.has(foldKey)) { problems.push(`line ${lineNo}: case-fold collision with the rule on line ${folded.get(foldKey)}`); continue; }
    folded.set(foldKey, lineNo);

    rules.push({ negated, pattern, line: lineNo, index: rules.length });
  }

  if (rules.length === 0) problems.push('.vercelignore declares no rules');
  else if (rules[0].negated || rules[0].pattern !== ROOT_IGNORE_TOKEN) {
    problems.push(`the first rule must be exactly ${ROOT_IGNORE_TOKEN} (allowlist root)`);
  }

  return { ok: problems.length === 0, problems, rules };
}

/** PURE: does ONE rule pattern match this exact repository-relative path? */
function ruleMatches(pattern, relPath) {
  const p = toPosix(relPath);
  if (pattern === ROOT_IGNORE_TOKEN) return p !== '' && p.indexOf('/') === -1;
  let base = pattern;
  if (base.endsWith('/**')) base = base.slice(0, -3);
  else if (base.endsWith('/')) base = base.slice(0, -1);
  return p === base || p.startsWith(base + '/');
}

/** PURE: last-match-wins decision for ONE exact path (ancestors not consulted). */
function matchDecision(rules, relPath) {
  let included = true;
  for (const rule of rules || []) {
    if (ruleMatches(rule.pattern, relPath)) included = rule.negated;
  }
  return included;
}

/**
 * PURE: is this path in the package? Every ancestor directory must also be
 * included — an excluded parent is never descended into, so a nested path can
 * never sneak in on a rule that only matches its own depth.
 */
function pathIsIncluded(rules, relPath) {
  const parts = toPosix(relPath).split('/').filter(Boolean);
  if (parts.length === 0) return false;
  let prefix = '';
  for (const part of parts) {
    prefix = prefix === '' ? part : prefix + '/' + part;
    if (!matchDecision(rules, prefix)) return false;
  }
  return true;
}

/**
 * PURE: does the parsed ignore file satisfy the independently pinned allowlist
 * contract? Checks the root token, every required re-inclusion, every denial,
 * and the ordering that keeps a denial from being re-broadened.
 * @returns {string[]} problems (empty = compliant)
 */
function evaluateIgnoreContract(parsed) {
  const problems = [];
  const rules = (parsed && parsed.rules) || [];
  if (rules.length === 0) return ['no rules to evaluate'];

  if (rules[0].negated || rules[0].pattern !== ROOT_IGNORE_TOKEN) {
    problems.push(`the first rule is not the ${ROOT_IGNORE_TOKEN} allowlist root`);
  }

  const negations = new Set(rules.filter((r) => r.negated).map((r) => r.pattern));
  const denials = rules.filter((r) => !r.negated);

  for (const file of EXPECTED_ROOT_FILES) {
    if (!negations.has(file)) problems.push(`required root file is not re-included: ${file}`);
  }
  for (const dir of EXPECTED_RUNTIME_DIRS) {
    if (!negations.has(dir)) problems.push(`required runtime directory is not re-included: ${dir}`);
    if (!negations.has(dir + '/**')) problems.push(`required runtime directory descendants are not re-included: ${dir}/**`);
  }

  for (const subtree of EXPECTED_DENIED_SUBTREES) {
    const dirRule = rules.find((r) => !r.negated && r.pattern === subtree + '/');
    const treeRule = rules.find((r) => !r.negated && r.pattern === subtree + '/**');
    if (!dirRule) problems.push(`required denial is missing: ${subtree}/`);
    if (!treeRule) problems.push(`required denial is missing: ${subtree}/**`);

    // The denial must come AFTER every negation that would otherwise
    // re-include it, or a later re-inclusion silently reopens the subtree.
    const parent = subtree.split('/')[0];
    const lastParentNegation = rules
      .filter((r) => r.negated && (r.pattern === parent || r.pattern === parent + '/**'))
      .reduce((max, r) => Math.max(max, r.index), -1);
    for (const rule of [dirRule, treeRule]) {
      if (rule && rule.index < lastParentNegation) {
        problems.push(`denial ${rule.pattern} is ordered before the ${parent} re-inclusion and is re-broadened`);
      }
    }
    // The rules must actually RESOLVE the subtree and its contents to excluded,
    // not merely mention them.
    if (pathIsIncluded(rules, subtree)) {
      problems.push(`denied subtree still resolves as included: ${subtree}`);
    }
    if (pathIsIncluded(rules, subtree + '/any-file.jpg')) {
      problems.push(`denied subtree contents still resolve as included: ${subtree}`);
    }
  }

  // A denial that is not one of the reviewed subtrees would silently shrink the
  // runtime surface, so it is a contract change rather than a maintenance edit.
  for (const rule of denials) {
    if (rule.pattern === ROOT_IGNORE_TOKEN) continue;
    const known = EXPECTED_DENIED_SUBTREES.some(
      (s) => rule.pattern === s + '/' || rule.pattern === s + '/**');
    if (!known) problems.push(`unreviewed denial rule on line ${rule.line}`);
  }

  // Likewise, a negation outside the reviewed allowlist would widen the upload.
  const allowedNegations = new Set([
    ...EXPECTED_ROOT_FILES,
    ...EXPECTED_RUNTIME_DIRS,
    ...EXPECTED_RUNTIME_DIRS.map((d) => d + '/**'),
  ]);
  for (const rule of rules.filter((r) => r.negated)) {
    if (!allowedNegations.has(rule.pattern)) {
      problems.push(`unreviewed re-inclusion rule on line ${rule.line}`);
    }
  }

  return problems;
}

/**
 * PURE: parse `vercel.json` and validate its shape fail-closed.
 * @returns {{ok: boolean, problems: string[], config: object|null}}
 */
function analyzeVercelJson(text) {
  const raw = String(text == null ? '' : text);
  if (raw.trim() === '') return { ok: false, problems: ['vercel.json is missing or empty'], config: null };
  let config = null;
  try { config = JSON.parse(raw); } catch (e) { return { ok: false, problems: ['vercel.json is not valid JSON'], config: null }; }
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    return { ok: false, problems: ['vercel.json is not a JSON object'], config: null };
  }
  const problems = [];
  const keys = Object.keys(config);
  for (const key of keys) {
    if (!EXPECTED_VERCEL_JSON_KEYS.includes(key)) problems.push(`unexpected top-level key: ${key}`);
    if (FORBIDDEN_VERCEL_JSON_KEYS.includes(key)) problems.push(`forbidden build/routing key: ${key}`);
  }
  for (const key of EXPECTED_VERCEL_JSON_KEYS) {
    if (!keys.includes(key)) problems.push(`missing required top-level key: ${key}`);
  }
  if (keys.includes('$schema') && config.$schema !== EXPECTED_SCHEMA) {
    problems.push('$schema is not the expected Vercel schema URL');
  }
  if (keys.includes('headers') && !Array.isArray(config.headers)) {
    problems.push('headers is not an array');
  }
  return { ok: problems.length === 0, problems, config };
}

/** PURE: compare one live header rule against its reviewed expectation. */
function headerRuleMatches(actual, expected) {
  if (!actual || typeof actual !== 'object') return false;
  if (actual.source !== expected.source) return false;
  if (Object.keys(actual).some((k) => k !== 'source' && k !== 'headers')) return false;
  if (!Array.isArray(actual.headers)) return false;
  if (actual.headers.length !== expected.headers.length) return false;
  return expected.headers.every((exp, i) => {
    const got = actual.headers[i];
    return got && typeof got === 'object' &&
      Object.keys(got).length === 2 &&
      got.key === exp.key && got.value === exp.value;
  });
}

/**
 * PURE: does the live header configuration match the reviewed contract exactly,
 * without a broad matcher, a duplicate source, or a CSP outside the offline
 * shell? Express's per-response nonce CSP must remain the only CSP authority
 * for dynamic responses.
 * @returns {string[]} problems (empty = compliant)
 */
function evaluateHeaderContract(config) {
  const problems = [];
  const headers = config && Array.isArray(config.headers) ? config.headers : null;
  if (!headers) return ['headers is missing or is not an array'];

  if (headers.length !== EXPECTED_HEADER_RULES.length) {
    problems.push(`expected ${EXPECTED_HEADER_RULES.length} header rules, found ${headers.length}`);
  }

  const sources = headers.map((r) => (r && typeof r === 'object' ? r.source : undefined));
  const seen = new Set();
  for (const source of sources) {
    if (typeof source !== 'string' || source === '') { problems.push('a header rule has no string source'); continue; }
    if (seen.has(source)) problems.push(`duplicate header rule source: ${source}`);
    seen.add(source);
    if (isBroadHeaderSource(source)) problems.push(`header rule source is a broad/dynamic matcher: ${source}`);
  }

  for (let i = 0; i < EXPECTED_HEADER_RULES.length; i++) {
    const expected = EXPECTED_HEADER_RULES[i];
    const actual = headers[i];
    if (!headerRuleMatches(actual, expected)) {
      problems.push(`header rule ${i + 1} does not match the reviewed contract for ${expected.source}`);
    }
  }

  for (const rule of headers) {
    if (!rule || !Array.isArray(rule.headers)) continue;
    for (const h of rule.headers) {
      if (!h || typeof h.key !== 'string') continue;
      if (h.key.toLowerCase() === 'content-security-policy' && rule.source !== CSP_ALLOWED_SOURCE) {
        problems.push(`a Content-Security-Policy is defined outside ${CSP_ALLOWED_SOURCE}: ${rule.source}`);
      }
      if (/^cache-control$/i.test(h.key) && /immutable|max-age=[1-9]\d{4,}/i.test(String(h.value)) &&
          !isContentHashedAssetSource(rule.source)) {
        problems.push(`long-lived immutable caching on a non-content-hashed URL: ${rule.source}`);
      }
    }
  }
  return problems;
}

/**
 * Enumerate the package candidate. Excluded entries are skipped silently and
 * are never collected, so an ignored filename cannot reach the output.
 * @returns {{files: string[], skipped: number}}
 */
function enumeratePackage(root, rules) {
  const files = [];
  let skipped = 0;
  const walk = (relDir) => {
    const abs = relDir === '' ? root : path.join(root, relDir);
    let entries;
    try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch (e) { return; }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const rel = relDir === '' ? entry.name : relDir + '/' + entry.name;
      if (!matchDecision(rules, rel)) continue; // excluded: never recorded
      if (entry.isDirectory()) walk(rel);
      else if (entry.isFile()) files.push(rel);
      else skipped += 1; // symlink/socket/device: never packaged
    }
  };
  walk('');
  files.sort();
  return { files, skipped };
}

/** PURE: deterministic aggregate over `<path>\0<sha256>\n` records. */
function computeAggregateSha256(files) {
  const h = crypto.createHash('sha256');
  for (const f of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    h.update(f.path + '\0' + f.sha256 + '\n');
  }
  return h.digest('hex');
}

/** Build the CONSOLE-ONLY preview manifest. Nothing is written to disk. */
function buildPackageManifest(root, rules) {
  const { files, skipped } = enumeratePackage(root, rules);
  const entries = files.map((rel) => {
    const buf = fs.readFileSync(path.join(root, rel));
    return { path: rel, bytes: buf.length, sha256: sha256(buf) };
  });
  return {
    label: PREVIEW_LABEL,
    files: entries,
    fileCount: entries.length,
    byteTotal: entries.reduce((sum, f) => sum + f.bytes, 0),
    aggregateSha256: computeAggregateSha256(entries),
    skippedNonRegularEntries: skipped,
  };
}

/**
 * PURE: is a manifest internally consistent? Rejects a falsified file count,
 * byte total, per-file byte count/hash shape, or aggregate hash.
 * @returns {string[]} problems (empty = compliant)
 */
function verifyManifestSelfConsistency(manifest) {
  const problems = [];
  if (!manifest || typeof manifest !== 'object') return ['manifest is missing'];
  if (manifest.label !== PREVIEW_LABEL) problems.push('manifest does not carry the exact neutral package-inventory label');
  if (!Array.isArray(manifest.files)) return [...problems, 'manifest has no file list'];

  const seen = new Set();
  for (const f of manifest.files) {
    if (!f || typeof f.path !== 'string' || f.path === '') { problems.push('a manifest entry has no path'); continue; }
    if (f.path !== toPosix(f.path)) problems.push('a manifest entry path is not normalized to forward slashes');
    if (seen.has(f.path)) problems.push('a manifest entry path is duplicated');
    seen.add(f.path);
    if (!Number.isInteger(f.bytes) || f.bytes < 0) problems.push('a manifest entry has an invalid byte count');
    if (typeof f.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(f.sha256)) problems.push('a manifest entry has an invalid SHA-256');
  }
  if (manifest.fileCount !== manifest.files.length) problems.push('manifest fileCount does not match the file list');
  const byteTotal = manifest.files.reduce((sum, f) => sum + (Number(f && f.bytes) || 0), 0);
  if (manifest.byteTotal !== byteTotal) problems.push('manifest byteTotal does not match the file list');
  if (manifest.aggregateSha256 !== computeAggregateSha256(manifest.files)) {
    problems.push('manifest aggregateSha256 does not match the file list');
  }
  return problems;
}

/**
 * PURE: does a self-consistent manifest match the independently pinned live
 * package inventory? This deliberately accepts no caller-supplied expectation.
 * @returns {string[]} problems (empty = exact match)
 */
function evaluatePinnedPackageManifest(manifest) {
  const problems = [];
  if (!manifest || typeof manifest !== 'object') return ['manifest is missing'];
  if (manifest.fileCount !== EXPECTED_PACKAGE_INVENTORY.files) {
    problems.push('manifest file count differs from the independently pinned inventory');
  }
  if (manifest.byteTotal !== EXPECTED_PACKAGE_INVENTORY.bytes) {
    problems.push('manifest byte total differs from the independently pinned inventory');
  }
  if (manifest.aggregateSha256 !== EXPECTED_PACKAGE_INVENTORY.sha256) {
    problems.push('manifest aggregate SHA-256 differs from the independently pinned inventory');
  }
  return problems;
}

/**
 * PURE: does an enumerated package satisfy the independently pinned contract?
 * Forbidden inclusions are reported by CLASS LABEL and COUNT only.
 * @returns {string[]} problems (empty = compliant)
 */
function evaluatePackageContract(files) {
  const problems = [];
  const list = (files || []).map(toPosix);
  const set = new Set(list);

  for (const file of EXPECTED_ROOT_FILES) {
    if (!set.has(file)) problems.push(`required root file missing from the package: ${file}`);
  }
  for (const dir of EXPECTED_RUNTIME_DIRS) {
    if (!list.some((p) => p.startsWith(dir + '/'))) {
      problems.push(`required runtime directory contributes no file: ${dir}`);
    }
  }
  for (const [label, predicate] of FORBIDDEN_PATH_CLASSES) {
    const count = list.filter(predicate).length;
    if (count > 0) problems.push(`forbidden path class present in the package: ${label} (${count} path(s))`);
  }
  for (const [label, predicate] of EXPECTED_PUBLIC_ASSET_CLASSES) {
    if (!list.some(predicate)) problems.push(`required public asset class missing from the package: ${label}`);
  }
  for (const file of EXPECTED_VENDOR_RUNTIME_FILES) {
    if (!set.has(file)) problems.push(`required vendor runtime file missing from the package: ${file}`);
  }
  for (const file of EXPECTED_OFFLINE_MAP_RUNTIME_FILES) {
    if (!set.has(file)) problems.push(`required offline map runtime file missing from the package: ${file}`);
  }
  if (!set.has(EXPECTED_VENDOR_MANIFEST_FILE)) {
    problems.push(`required vendor manifest missing from the package: ${EXPECTED_VENDOR_MANIFEST_FILE}`);
  }

  // Nothing outside the reviewed root files and runtime directories.
  for (const p of list) {
    const top = p.indexOf('/') === -1 ? p : p.slice(0, p.indexOf('/'));
    const isRootFile = p.indexOf('/') === -1;
    if (isRootFile && !EXPECTED_ROOT_FILES.includes(p)) {
      problems.push('an unreviewed root file is present in the package');
    } else if (!isRootFile && !EXPECTED_RUNTIME_DIRS.includes(top)) {
      problems.push('an unreviewed top-level directory is present in the package');
    }
  }
  return Array.from(new Set(problems));
}

/* =============================================================================
   HARNESS
   ========================================================================== */

const failures = [];
let checks = 0;

function check(scope, label, ok) {
  checks += 1;
  const pass = ok === true;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!pass) failures.push(`${scope} :: ${label}`);
}

function portIsFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => tester.close(() => resolve(true)));
    tester.listen(port, '127.0.0.1');
  });
}

/** Raw GET that never follows a redirect, so a fallback cannot hide a leak. */
function rawGet(port, rawPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, method: 'GET', path: rawPath },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({
          status: res.statusCode,
          location: res.headers.location || null,
          body: Buffer.concat(chunks),
        }));
      });
    req.on('error', reject);
    req.end();
  });
}

/**
 * Write an EXACT request line over a raw socket. `http.request` refuses a path
 * containing an unescaped space, so this is the only way to present the
 * literal decoded-space form `/img/sample 360/...` on the wire. A conforming
 * parser may answer 404 or reject the malformed line outright; either is
 * acceptable, but the response must never carry file bytes.
 * @returns {{status: number|null, location: string|null, raw: Buffer}}
 */
function rawSocketGet(port, requestLine) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1');
    const chunks = [];
    socket.setTimeout(5000, () => { socket.destroy(); });
    socket.on('connect', () => {
      socket.write(`GET ${requestLine} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`);
    });
    socket.on('data', (c) => chunks.push(c));
    socket.on('error', reject);
    socket.on('close', () => {
      const raw = Buffer.concat(chunks);
      const head = raw.slice(0, 512).toString('latin1');
      const m = head.match(/^HTTP\/1\.[01] (\d{3})/);
      const loc = head.match(/\r\nLocation:\s*([^\r\n]*)/i);
      resolve({ status: m ? Number(m[1]) : null, location: loc ? loc[1] : null, raw });
    });
  });
}

/* =============================================================================
   STATIC-BOUNDARY LEG
   ========================================================================== */

/**
 * Serve ONLY `staticRoot`: no directory listing, no index fallback, no
 * redirect, no rewrite. Anything that resolves outside the root, or is not a
 * regular file, is a plain 404 — the same fail-closed shape the excluded
 * panorama directory must produce.
 */
function createBoundedStaticServer(staticRoot) {
  return http.createServer((req, res) => {
    const deny = () => {
      res.writeHead(404, { 'Content-Type': 'text/plain', 'X-Content-Type-Options': 'nosniff' });
      res.end('Not found.');
    };
    if (req.method !== 'GET') return deny();
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    } catch (e) { return deny(); }
    const rel = pathname.replace(/^\/+/, '');
    if (rel === '') return deny();
    const abs = path.resolve(staticRoot, rel);
    if (abs !== staticRoot && !abs.startsWith(staticRoot + path.sep)) return deny();
    let stat;
    try { stat = fs.statSync(abs); } catch (e) { return deny(); }
    if (!stat.isFile()) return deny();
    res.writeHead(200, {
      'Content-Length': String(stat.size),
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(fs.readFileSync(abs));
  });
}

async function runStaticBoundaryLeg(manifest) {
  const scope = 'static-boundary';

  const free = await portIsFree(STATIC_PORT);
  check(scope, `dedicated port ${STATIC_PORT} is free before the listener starts`, free);
  if (!free) return;

  const staticRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'campusphere-r7-boundary-'));
  let server = null;
  try {
    // Populate the temporary root with ONLY the allowlisted public files.
    const publicFiles = manifest.files.filter((f) => f.path.startsWith('public/'));
    for (const f of publicFiles) {
      const target = path.join(staticRoot, f.path.slice('public/'.length).split('/').join(path.sep));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(ROOT, f.path), target);
    }
    check(scope, 'the temporary static root is created outside the repository',
      !path.resolve(staticRoot).startsWith(path.resolve(ROOT) + path.sep));
    check(scope, 'the temporary static root contains no excluded panorama directory',
      !fs.existsSync(path.join(staticRoot, 'img', 'sample 360')));

    server = createBoundedStaticServer(staticRoot);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(STATIC_PORT, '127.0.0.1', resolve);
    });

    const serves = async (label, repoPath, urlPath) => {
      const expected = fs.readFileSync(path.join(ROOT, repoPath));
      const res = await rawGet(STATIC_PORT, urlPath);
      check(scope, `${label} is served 200 byte-identical: ${urlPath}`,
        res.status === 200 && res.location === null && sha256(res.body) === sha256(expected));
    };

    for (const [label, repoPath] of REPRESENTATIVE_STATIC_ASSETS) {
      await serves(label, repoPath, '/' + repoPath.slice('public/'.length));
    }
    for (const repoPath of EXPECTED_VENDOR_RUNTIME_FILES) {
      await serves('vendored runtime file', repoPath, '/' + repoPath.slice('public/'.length));
    }
    await serves('vendor provenance manifest', EXPECTED_VENDOR_MANIFEST_FILE,
      '/' + EXPECTED_VENDOR_MANIFEST_FILE.slice('public/'.length));

    // A missing normal asset must 404 rather than fall back to anything.
    {
      const res = await rawGet(STATIC_PORT, '/img/campusphere-r7-absent-asset.png');
      check(scope, 'a missing normal asset returns 404 with no redirect',
        res.status === 404 && res.location === null);
    }

    /* The excluded panorama directory, in BOTH the percent-encoded wire form
       and the literal decoded-space wire form, for a file and for the
       directory itself. A synthetic target name is used so no ignored filename
       is ever printed.

       The percent-encoded requests are the DECODED-SPACE case as the server
       sees it: `%20` decodes to a literal space, so the resolved target is
       exactly `img/sample 360/...`. */
    const encodedTargets = [
      ['percent-encoded file', '/img/sample%20360/r7-boundary-target.jpg'],
      ['percent-encoded directory', '/img/sample%20360'],
      ['percent-encoded directory with trailing slash', '/img/sample%20360/'],
    ];
    for (const [label, urlPath] of encodedTargets) {
      const res = await rawGet(STATIC_PORT, urlPath);
      check(scope, `excluded panorama path decodes to a space and returns 404 with no redirect (${label})`,
        res.status === 404 && res.location === null);
    }

    /* The literal-space request line. A conforming HTTP parser may answer 404
       or refuse the malformed line; what must never happen is a 200 or any
       leaked file byte. */
    const literalSpaceTargets = [
      ['literal-space file', '/img/sample 360/r7-boundary-target.jpg'],
      ['literal-space directory', '/img/sample 360'],
      ['literal-space directory with trailing slash', '/img/sample 360/'],
    ];
    for (const [label, requestLine] of literalSpaceTargets) {
      const res = await rawSocketGet(STATIC_PORT, requestLine);
      const text = res.raw.toString('latin1');
      const split = text.indexOf('\r\n\r\n');
      const body = split === -1 ? '' : text.slice(split + 4);
      check(scope, `excluded panorama path is never exposed on a literal-space request line (${label})`,
        res.status !== 200 && res.location === null && (body === '' || body === 'Not found.'));
    }

    // Excluded classes are not CDN-addressable through the static boundary.
    for (const urlPath of ['/server.js', '/package.json', '/package-lock.json',
      '/vercel.json', '/.vercelignore', '/.env', '/scripts/quality-gates.js',
      '/database/schema.sql', '/docs/deployment.md', '/plan.md']) {
      const res = await rawGet(STATIC_PORT, urlPath);
      check(scope, `an excluded path is not addressable: ${urlPath}`,
        res.status === 404 && res.location === null);
    }

    // Traversal cannot reach outside the served root.
    for (const urlPath of ['/../server.js', '/%2e%2e/server.js', '/..%2fserver.js',
      '/css/../../server.js']) {
      const res = await rawGet(STATIC_PORT, urlPath);
      check(scope, `traversal is refused with no redirect: ${urlPath}`,
        res.status === 404 && res.location === null);
    }
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      check(scope, 'the bounded static listener is closed', server.listening === false);
    }
    fs.rmSync(staticRoot, { recursive: true, force: true });
    check(scope, 'the temporary static root is removed', !fs.existsSync(staticRoot));
    const freeAfter = await portIsFree(STATIC_PORT);
    check(scope, `dedicated port ${STATIC_PORT} is free again`, freeAfter);
  }
}

/* =============================================================================
   MAIN
   ========================================================================== */

function printPreview(manifest) {
  console.log('');
  console.log('=== ' + PREVIEW_LABEL + ' ===');
  console.log('Console-only. No manifest, archive, or .vercel metadata is written to the repository.');
  console.log('');
  for (const f of manifest.files) {
    console.log(`  ${f.sha256}  ${String(f.bytes).padStart(9)}  ${f.path}`);
  }
  console.log('');
  console.log(`  included files : ${manifest.fileCount}`);
  console.log(`  total bytes    : ${manifest.byteTotal}`);
  console.log(`  aggregate sha256: ${manifest.aggregateSha256}`);
  console.log(`  non-regular entries skipped: ${manifest.skippedNonRegularEntries}`);
  console.log('=== END ' + PREVIEW_LABEL + ' ===');
}

async function main() {
  console.log('=== CampuSphere M12.P1-R7 Vercel package boundary probe (STANDALONE) ===');
  console.log('Read-only, database-free, session-free, and external-network-free.');
  console.log('');

  console.log('ignore-file contract:');
  const ignoreRaw = fs.existsSync(path.join(ROOT, IGNORE_FILE))
    ? fs.readFileSync(path.join(ROOT, IGNORE_FILE), 'utf8') : '';
  check('ignore', `${IGNORE_FILE} exists and is non-empty`, ignoreRaw.trim() !== '');
  const parsed = parseVercelIgnore(ignoreRaw);
  check('ignore', `${IGNORE_FILE} parses with no structural defect`, parsed.ok === true);
  parsed.problems.forEach((p) => console.error('    - ignore: ' + p));
  check('ignore', `${IGNORE_FILE} begins with the ${ROOT_IGNORE_TOKEN} allowlist root`,
    parsed.rules.length > 0 && parsed.rules[0].pattern === ROOT_IGNORE_TOKEN && parsed.rules[0].negated === false);
  const ignoreProblems = evaluateIgnoreContract(parsed);
  check('ignore', `${IGNORE_FILE} satisfies the independently pinned allowlist contract`,
    ignoreProblems.length === 0);
  ignoreProblems.forEach((p) => console.error('    - ignore-contract: ' + p));

  console.log('');
  console.log('header contract:');
  const vercelRaw = fs.existsSync(path.join(ROOT, VERCEL_JSON_FILE))
    ? fs.readFileSync(path.join(ROOT, VERCEL_JSON_FILE), 'utf8') : '';
  const vj = analyzeVercelJson(vercelRaw);
  check('headers', `${VERCEL_JSON_FILE} exposes exactly $schema and headers`, vj.ok === true);
  vj.problems.forEach((p) => console.error('    - vercel.json: ' + p));
  const headerProblems = evaluateHeaderContract(vj.config);
  check('headers', 'the header rules match the reviewed static/PWA contract exactly',
    headerProblems.length === 0);
  headerProblems.forEach((p) => console.error('    - headers: ' + p));
  check('headers', 'no build, function, route, rewrite, redirect, or framework override is declared',
    vj.config !== null && FORBIDDEN_VERCEL_JSON_KEYS.every((k) => !Object.prototype.hasOwnProperty.call(vj.config, k)));
  check('headers', 'only the offline shell declares a static Content-Security-Policy',
    vj.config !== null && Array.isArray(vj.config.headers) &&
    vj.config.headers.every((r) => r && (r.source === CSP_ALLOWED_SOURCE ||
      !(Array.isArray(r.headers) && r.headers.some((h) => h && /^content-security-policy$/i.test(String(h.key)))))));

  console.log('');
  console.log('source auditability:');
  {
    /* Every R7 source file must stay reviewable with ORDINARY text tooling. A
       single literal 0x00 byte makes rg/grep/git-diff report "binary file
       matches" instead of the line, silently removing the file from review.
       Read as RAW BUFFERS: a utf8 decode would erase the distinction between
       the literal byte and the textual `\0` escape. */
    const nulOffenders = R7_AUDITABLE_SOURCE_FILES.filter((rel) => {
      let bytes = null;
      try { bytes = fs.readFileSync(path.join(ROOT, rel)); } catch (e) { bytes = null; }
      return containsLiteralNulByte(bytes); // missing/unreadable also fails closed
    });
    check('source', 'every R7 source file is free of literal NUL bytes and stays text-searchable',
      nulOffenders.length === 0 && R7_AUDITABLE_SOURCE_FILES.length === 4);
    nulOffenders.forEach((rel) => console.error('    - source: literal NUL byte or unreadable file: ' + rel));
  }

  console.log('');
  console.log('entrypoint contract:');
  {
    const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    check('entrypoint', 'server.js exports the Express app', /module\.exports\s*=\s*app\s*;/.test(serverSrc));
    check('entrypoint', 'server.js opens a listener only as the main module',
      /if\s*\(\s*require\.main\s*===\s*module\s*\)/.test(serverSrc));
    check('entrypoint', 'no duplicate api/ entrypoint exists', !fs.existsSync(path.join(ROOT, 'api')));
    check('entrypoint', 'no .vercel project metadata exists', !fs.existsSync(path.join(ROOT, '.vercel')));
  }

  console.log('');
  console.log('package enumeration:');
  const manifest = buildPackageManifest(ROOT, parsed.rules);
  const packageProblems = evaluatePackageContract(manifest.files.map((f) => f.path));
  check('package', 'the enumerated package satisfies the independently pinned contract',
    packageProblems.length === 0);
  packageProblems.forEach((p) => console.error('    - package: ' + p));
  const manifestProblems = verifyManifestSelfConsistency(manifest);
  check('package', 'the preview manifest is internally consistent', manifestProblems.length === 0);
  manifestProblems.forEach((p) => console.error('    - manifest: ' + p));
  const pinnedManifestProblems = evaluatePinnedPackageManifest(manifest);
  check('package', 'the live package manifest matches the independently pinned file count, bytes, and aggregate SHA-256',
    pinnedManifestProblems.length === 0);
  pinnedManifestProblems.forEach((p) => console.error('    - package-pin: ' + p));
  check('package', 'every enumerated path is normalized to forward slashes',
    manifest.files.every((f) => f.path === toPosix(f.path) && !f.path.startsWith('/') && !/^[A-Za-z]:/.test(f.path)));
  check('package', 'no enumerated path resolves inside the denied panorama subtree',
    manifest.files.every((f) => !/^public\/img\/sample 360(\/|$)/i.test(f.path)));
  check('package', 'the package carries at least the reviewed root files and runtime directories',
    manifest.fileCount > EXPECTED_ROOT_FILES.length);

  console.log('');
  console.log('static-CDN boundary:');
  await runStaticBoundaryLeg(manifest);

  printPreview(manifest);

  console.log('');
  if (failures.length === 0) {
    console.log(`VERCEL-PACKAGE-BOUNDARY-PROBE OK: ${checks}/${checks} checks passed.`);
  } else {
    console.error(`VERCEL-PACKAGE-BOUNDARY-PROBE FAILED: ${failures.length}/${checks} check(s) did not pass:`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    // Fixed sanitized message only — never a stack, value, or path detail.
    console.error('VERCEL-PACKAGE-BOUNDARY-PROBE FAILED:',
      error && error.message ? error.message : 'sanitized failure');
    process.exitCode = 1;
  });
}

module.exports = {
  PREVIEW_LABEL,
  EXPECTED_PACKAGE_INVENTORY,
  ROOT_IGNORE_TOKEN,
  EXPECTED_ROOT_FILES,
  EXPECTED_RUNTIME_DIRS,
  EXPECTED_DENIED_SUBTREES,
  R7_AUDITABLE_SOURCE_FILES,
  containsLiteralNulByte,
  FORBIDDEN_PATH_CLASSES,
  EXPECTED_PUBLIC_ASSET_CLASSES,
  EXPECTED_VENDOR_RUNTIME_FILES,
  EXPECTED_VENDOR_MANIFEST_FILE,
  EXPECTED_OFFLINE_MAP_RUNTIME_FILES,
  EXPECTED_HEADER_RULES,
  EXPECTED_VERCEL_JSON_KEYS,
  FORBIDDEN_VERCEL_JSON_KEYS,
  EXPECTED_OFFLINE_CSP,
  EXPECTED_SCHEMA,
  CSP_ALLOWED_SOURCE,
  REPRESENTATIVE_STATIC_ASSETS,
  toPosix,
  isBroadHeaderSource,
  isContentHashedAssetSource,
  parseVercelIgnore,
  ruleMatches,
  matchDecision,
  pathIsIncluded,
  evaluateIgnoreContract,
  analyzeVercelJson,
  headerRuleMatches,
  evaluateHeaderContract,
  enumeratePackage,
  computeAggregateSha256,
  buildPackageManifest,
  verifyManifestSelfConsistency,
  evaluatePinnedPackageManifest,
  evaluatePackageContract,
};
