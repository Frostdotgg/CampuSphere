'use strict';

/* ========================================
   CampuSphere — OFF.2 focused probe (STANDALONE)
   "Installability, Offline Shell, and Update Lifecycle"

   Scope. OFF.2 only. This probe proves the manifest/installability contract,
   the service-worker UPDATE LIFECYCLE, the versioned cache-cleanup boundary,
   and the session-neutral offline shell. It adds and asserts NO offline route,
   schedule, Guided-VR, panorama, or media data — the final offline product is
   limited to future 2D Main-Gate-to-building routing, and OFF.2 ships none of
   it yet.

   How the lifecycle is verified. Two complementary layers:

     1. BEHAVIOURAL. public/sw.js is executed inside a bounded
        ServiceWorkerGlobalScope emulation (node:vm) with a fake Cache Storage.
        The REAL install / activate / message / fetch listeners registered by
        the production file are then invoked directly, so interrupted-precache
        rejection, recovery, waiting behaviour, explicit activation, stale-cache
        pruning, forbidden-path pass-through, and non-GET pass-through are
        observed as behaviour rather than inferred from text.

        This emulation is NOT a browser. It cannot observe real installing /
        waiting / active worker registration states, real controllerchange
        delivery, DOM rendering, or install prompts. Those remain browser cases
        and are reported separately — never as passes earned here.

     2. STRUCTURAL. public/js/pwa.js has no server-side executable surface
        (it is a DOM IIFE), so its client contract is analysed as CODE SHAPES on
        COMMENT-STRIPPED source, and every analyzer is additionally driven
        against MUTATED source that must be REJECTED. A gate that only accepts
        is not a gate.

   Harness. scripts/with-server.js only (self-terminating; never a foreground
   server), on dedicated port 3386. The probe refuses to start when that port is
   occupied and never kills any process.

   Database / identity. NONE. This probe is fully anonymous: it never signs in,
   never requests /auth, never reads or writes application data, and runs with
   the development-only in-memory session store so no MySQL or Supabase
   connection is required. It therefore owns no canonical session and
   registers nothing with scripts/probeSessionLifecycle.js.

   Privacy. Fixed sanitized PASS/FAIL labels only. No cookie, token, session id,
   credential, header value, or backend error is ever printed.
   ======================================== */

require('dotenv').config();

const fs = require('fs');
const net = require('net');
const path = require('path');
const vm = require('vm');
const { withServer } = require('./with-server');

const ROOT = path.join(__dirname, '..');
const PORT = 3386;
const ORIGIN = 'https://campusphere.test';

const SW_PATH = path.join(ROOT, 'public', 'sw.js');
const PWA_PATH = path.join(ROOT, 'public', 'js', 'pwa.js');
const MANIFEST_PATH = path.join(ROOT, 'public', 'manifest.webmanifest');
const SHELL_HTML_PATH = path.join(ROOT, 'public', 'offline.html');
const SHELL_CSS_PATH = path.join(ROOT, 'public', 'css', 'offline.css');
const OFFLINE_MANAGER_PATH = path.join(ROOT, 'public', 'js', 'offline-guide-manager.js');

const OFFLINE_TOUCH_TARGET_SELECTORS = [
  '.offline-page [data-offline-guide-download]',
  '.offline-page .dash-nav__tab',
  '.offline-page #offlineNavToggle',
  '.offline-page #offlineSidebarHandle',
  '.offline-page #offlineSidebarClose',
  '.offline-page #offlineSearchClear',
  '.offline-page [data-offline-filter]',
  '.offline-page #offlineRoutePlannerToggle',
  '.offline-page #offlineRouteDestClear',
  '.offline-page #offlineRouteFind',
  '.offline-page #offlineRecenterMap',
  '.offline-page #offlineClearMapRoute',
  '.offline-page #offlineDetailsClose',
  '.offline-page #offlineSetDestination',
  '.offline-page #offlineRouteClose',
  '.offline-page #offlineRouteClear',
  '.offline-page #offlineMobileListToggle',
  '.offline-page #offlineThemeToggle',
  '.offline-page .offline-building',
  '.offline-page .offline-building-marker',
  '.offline-page .offline-fallback-marker',
  '.offline-page .offline-map .maplibregl-ctrl-group button'
];

/* ---------------------------------------------------------------- recorder */

let checks = 0;
const failures = [];

function ok(label, condition) {
  checks += 1;
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL  ${label}`);
  }
}

function section(title) {
  console.log('');
  console.log(`[${title}]`);
}

function offlineTouchTargetProblems(css) {
  const problems = [];
  const bounded = (String(css).match(/\/\* OFFLINE_TOUCH_TARGETS_START[\s\S]*?OFFLINE_TOUCH_TARGETS_END \*\//) || [])[0] || '';
  const rule = bounded.match(/([\s\S]*?)\{([\s\S]*?)\}/);
  if (!rule) return ['bounded offline touch-target rule is missing'];
  const selectors = new Set(rule[1]
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(',')
    .map((selector) => selector.trim())
    .filter(Boolean));
  for (const selector of OFFLINE_TOUCH_TARGET_SELECTORS) {
    if (!selectors.has(selector)) problems.push(`missing exact touch target: ${selector}`);
  }
  if (!/(?:^|;)\s*min-width\s*:\s*44px\s*;/.test(`;${rule[2]}`)) problems.push('touch targets lack exact 44px width');
  if (!/(?:^|;)\s*min-height\s*:\s*44px\s*;/.test(`;${rule[2]}`)) problems.push('touch targets lack exact 44px height');
  const fallbackRule = (String(css).match(/\.offline-fallback-marker\s*\{([\s\S]*?)\}/) || [])[1] || '';
  if (!/(?:^|;)\s*width\s*:\s*44px\s*;/.test(`;${fallbackRule}`)) problems.push('fallback markers lack an exact 44px width');
  if (!/(?:^|;)\s*height\s*:\s*44px\s*;/.test(`;${fallbackRule}`)) problems.push('fallback markers lack an exact 44px height');
  return problems;
}

function offlineTouchTargetMutationsAreRejected(css) {
  const cases = [
    css.replace('  min-width: 44px;', '  min-width: 34px;') + '\n.unrelated-fixture { min-width: 44px; }',
    css.replace('  min-height: 44px;', '  min-height: 34px;') + '\n.unrelated-fixture { min-height: 44px; }',
    css.replace('.offline-page #offlineSearchClear,', '.offline-page .unrelated-search-clear,'),
    css.replace('.offline-page #offlineMobileListToggle,', '.offline-page .offscreen-list-button,'),
    css.replace('.offline-page .offline-fallback-marker,', '.offline-page .undersized-fallback-marker,'),
    css.replace('  width: 44px;\n  height: 44px;\n  padding: 0;\n  appearance: none;',
      '  width: 18px;\n  height: 18px;\n  padding: 0;\n  appearance: none;')
  ];
  return cases.every((mutated) => mutated !== css && offlineTouchTargetProblems(mutated).length > 0);
}

function offlineMobileDetailsOverlapProblems(css, shell) {
  const problems = [];
  const mobile = String(css).match(/@media\s*\(max-width:\s*768px\)\s*\{([\s\S]*?)\n\}\s*\n\n@media\s*\(max-width:\s*420px\)/);
  const bounded = mobile
    ? (mobile[1].match(/\/\* OFFLINE_MOBILE_DETAILS_OVERLAP_START \*\/([\s\S]*?)\/\* OFFLINE_MOBILE_DETAILS_OVERLAP_END \*\//) || [])[1] || ''
    : '';
  if (!mobile) problems.push('mobile details-overlap rule is outside the 768px media boundary');
  if (!bounded) problems.push('bounded mobile details-overlap rule is missing');
  if (bounded && !/\.offline-page\s+#offlineDetailsPanel\.visible\s+~\s+#offlineMobileListToggle\s*\{\s*display:\s*none\s*;\s*\}/.test(bounded)) {
    problems.push('details overlap guard does not hide only the mobile toggle while details are visible');
  }
  const source = String(shell);
  const detailsIndex = source.indexOf('id="offlineDetailsPanel"');
  const toggleIndex = source.indexOf('id="offlineMobileListToggle"');
  if (detailsIndex === -1 || toggleIndex === -1 || detailsIndex >= toggleIndex) {
    problems.push('details panel must precede the mobile toggle for the sibling guard');
  }
  return problems;
}

function offlineMobileDetailsOverlapMutationsAreRejected(css, shell) {
  const source = String(css);
  const selector = '.offline-page #offlineDetailsPanel.visible ~ #offlineMobileListToggle';
  const swappedShell = String(shell)
    .replace('id="offlineDetailsPanel"', 'id="__offlineDetailsPanel"')
    .replace('id="offlineMobileListToggle"', 'id="offlineDetailsPanel"')
    .replace('id="__offlineDetailsPanel"', 'id="offlineMobileListToggle"');
  const cases = [
    { css: source.replace(selector, '.offline-page #offlineDetailsPanel ~ #offlineMobileListToggle'), shell },
    { css: source.replace(`  ${selector} {\n    display: none;\n  }\n`,
      `  ${selector} {\n    display: flex;\n  }\n`), shell },
    { css: source.replace('@media (max-width: 768px)', '@media (min-width: 769px)'), shell },
    { css: source.replace(`  ${selector} {\n    display: none;\n  }\n`, ''), shell },
    { css: source, shell: swappedShell }
  ];
  return cases.every((fixture) =>
    (fixture.css !== source || fixture.shell !== shell) &&
    offlineMobileDetailsOverlapProblems(fixture.css, fixture.shell).length > 0);
}

function offlineFallbackMarkerProblems(source, shell) {
  const problems = [];
  const render = extractFunction(stripComments(String(source)), 'renderFallbackMap');
  if (!render) return ['fallback renderer is missing'];
  if (!/svg\.setAttribute\('aria-hidden', 'true'\)/.test(render) ||
      !/svg\.setAttribute\('focusable', 'false'\)/.test(render) ||
      /svg\.setAttribute\('role', 'img'\)/.test(render)) {
    problems.push('fallback SVG is not strictly decorative');
  }
  if (!/svg\.setAttribute\('preserveAspectRatio', 'none'\)/.test(render)) {
    problems.push('fallback SVG coordinate frame does not match the HTML marker overlay');
  }
  if (!/var markerLayer = document\.createElement\('div'\)/.test(render) ||
      !/markerLayer\.className = 'offline-map-fallback__markers'/.test(render) ||
      !/markerLayer\.setAttribute\('role', 'group'\)/.test(render)) {
    problems.push('fallback marker layer lacks valid accessible grouping');
  }
  if (!/var button = document\.createElement\('button'\)/.test(render) ||
      !/button\.type = 'button'/.test(render) ||
      !/button\.className = 'offline-building-marker offline-fallback-marker'/.test(render) ||
      !/button\.setAttribute\('aria-label', 'Open details for ' \+ building\.name\)/.test(render) ||
      !/button\.setAttribute\('aria-pressed', 'false'\)/.test(render) ||
      !/button\.setAttribute\('data-building-key', building\.key\)/.test(render)) {
    problems.push('fallback marker is not a labelled native button with selected state');
  }
  if (!/button\.style\.left = \(point\[0\] \/ 10\) \+ '%'/.test(render) ||
      !/button\.style\.top = \(point\[1\] \/ 7\) \+ '%'/.test(render) ||
      !/markerLayer\.appendChild\(button\)/.test(render)) {
    problems.push('fallback marker is not positioned in the HTML overlay');
  }
  if (!/button\.addEventListener\('click'[\s\S]*openDetails\(building\.key, button\)/.test(render) ||
      /button\.addEventListener\('keydown'/.test(render) ||
      /createElementNS\(svgNamespace, 'g'\)[\s\S]*setAttribute\('role', 'button'\)/.test(render)) {
    problems.push('fallback activation does not rely on native button semantics');
  }
  if (!/<div class="offline-map-fallback" id="offlineMapFallback" role="group" aria-label="Simplified CSPC campus map" hidden><\/div>/.test(String(shell))) {
    problems.push('fallback container lacks its accessible group name');
  }
  return problems;
}

function offlineFallbackMarkerMutationsAreRejected(source, shell) {
  const cases = [
    { source: source.replace("var button = document.createElement('button');", "var button = document.createElement('div');"), shell },
    { source: source.replace('offline-building-marker offline-fallback-marker', 'offline-building-marker'), shell },
    { source: source.replace("svg.setAttribute('aria-hidden', 'true');", "svg.setAttribute('role', 'img');"), shell },
    { source: source.replace("svg.setAttribute('preserveAspectRatio', 'none');", ''), shell },
    { source: source.replace("svg.setAttribute('preserveAspectRatio', 'none');", "svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');"), shell },
    { source: source.replace('markerLayer.appendChild(button);', 'svg.appendChild(button);'), shell },
    { source, shell: shell.replace(' role="group" aria-label="Simplified CSPC campus map"', '') }
  ];
  return cases.every((fixture) =>
    (fixture.source !== source || fixture.shell !== shell) &&
    offlineFallbackMarkerProblems(fixture.source, fixture.shell).length > 0);
}

/* ------------------------------------------------------- source utilities */

/* Strip comments so a contract is never satisfied — or falsely broken — by
   prose. public/sw.js documents its own lifecycle in the header ("install
   NEVER calls skipWaiting()", "{ type: 'SKIP_WAITING' }"), so a scan over raw
   text would both accept documentation as implementation AND fail negative
   checks on the documentation itself. Strings and regex literals are preserved
   intact; both files contain regex literals such as /\.(css|js)$/i. */
function stripComments(source) {
  let out = '';
  let i = 0;
  let prevSignificant = '';
  const n = source.length;

  while (i < n) {
    const c = source[i];
    const next = source[i + 1];

    if (c === '/' && next === '/') {
      while (i < n && source[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out += c;
      i += 1;
      while (i < n) {
        if (source[i] === '\\') { out += source[i] + (source[i + 1] || ''); i += 2; continue; }
        out += source[i];
        if (source[i] === quote) { i += 1; break; }
        i += 1;
      }
      prevSignificant = quote;
      continue;
    }
    if (c === '/' && regexAllowed(prevSignificant)) {
      out += c;
      i += 1;
      let inClass = false;
      while (i < n) {
        if (source[i] === '\\') { out += source[i] + (source[i + 1] || ''); i += 2; continue; }
        if (source[i] === '[') inClass = true;
        else if (source[i] === ']') inClass = false;
        out += source[i];
        if (source[i] === '/' && !inClass) { i += 1; break; }
        i += 1;
      }
      prevSignificant = '/';
      continue;
    }

    out += c;
    if (!/\s/.test(c)) prevSignificant = c;
    i += 1;
  }
  return out;
}

/* A '/' starts a regex literal only where a value cannot already have ended. */
function regexAllowed(prevSignificant) {
  if (prevSignificant === '') return true;
  return !/[A-Za-z0-9_$)\]'"`]/.test(prevSignificant);
}

/* Extract a top-level `function name(...) { ... }` body by brace balance. */
function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start === -1) return '';
  let depth = 0;
  let seen = false;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') { depth += 1; seen = true; }
    else if (source[i] === '}') {
      depth -= 1;
      if (seen && depth === 0) return source.slice(start, i + 1);
    }
  }
  return '';
}

/* Extract an addEventListener callback body by brace balance. */
function extractListener(source, type) {
  const marker = `addEventListener('${type}'`;
  const start = source.indexOf(marker);
  if (start === -1) return '';
  let depth = 0;
  let seen = false;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '{') { depth += 1; seen = true; }
    else if (source[i] === '}') {
      depth -= 1;
      if (seen && depth === 0) return source.slice(start, i + 1);
    }
  }
  return '';
}

function countOccurrences(haystack, needle) {
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) { count += 1; idx = haystack.indexOf(needle, idx + needle.length); }
  return count;
}

/* --------------------------------------------- service-worker analyzers ---
   Exported so an in-suite gate can drive the REAL analyzers with fixtures. */

const SW = {};

SW.installDoesNotSkipWaiting = (src) => {
  const install = extractListener(stripComments(src), 'install');
  return install !== '' && !/skipWaiting\s*\(/.test(install);
};

SW.precacheIsAtomic = (src) => {
  const install = extractListener(stripComments(src), 'install');
  if (install === '') return false;
  return /\.addAll\s*\(/.test(install) && !/allSettled/.test(install);
};

SW.installVerifiesEveryEntry = (src) => {
  const install = extractListener(stripComments(src), 'install');
  return install !== '' && /cache\.match\s*\(/.test(install) && /throw\s+new\s+Error/.test(install);
};

SW.installCleansUpOnFailure = (src) => {
  const install = extractListener(stripComments(src), 'install');
  if (install === '') return false;
  // A catch that deletes the shell cache AND re-throws so the install fails.
  return /\.catch\s*\(/.test(install) &&
    /caches\.delete\s*\(\s*SHELL_CACHE\s*\)/.test(install) &&
    /throw\s+err/.test(install);
};

SW.hasNarrowSkipWaitingMessageHandler = (src) => {
  const stripped = stripComments(src);
  const handler = extractListener(stripped, 'message');
  if (handler === '') return false;
  const narrow = /data\.type\s*!==\s*'SKIP_WAITING'/.test(handler) && /return/.test(handler);
  const rejectsNonObject = /typeof\s+data\s*!==\s*'object'/.test(handler);
  return narrow && rejectsNonObject && /skipWaiting\s*\(/.test(handler);
};

SW.skipWaitingOnlyInMessageHandler = (src) => {
  const stripped = stripComments(src);
  const handler = extractListener(stripped, 'message');
  if (handler === '') return false;
  return countOccurrences(stripped, 'skipWaiting(') === 1 &&
    countOccurrences(handler, 'skipWaiting(') === 1;
};

SW.cleanupIsPrefixScopedAndVersioned = (src) => {
  const activate = extractListener(stripComments(src), 'activate');
  if (activate === '') return false;
  return /key\.indexOf\s*\(\s*CACHE_PREFIX\s*\+\s*'-'\s*\)\s*===\s*0/.test(activate) &&
    /CURRENT_CACHES\.indexOf\s*\(\s*key\s*\)\s*===\s*-1/.test(activate) &&
    /caches\.delete\s*\(\s*key\s*\)/.test(activate);
};

SW.cacheVersion = (src) => {
  const m = stripComments(src).match(/CACHE_VERSION\s*=\s*'v(\d+)'/);
  return m ? Number(m[1]) : 0;
};

SW.precacheUrls = (src) => {
  const body = (stripComments(src).match(/PRECACHE_URLS\s*=\s*\[([\s\S]*?)\]/) || [])[1] || '';
  return (body.match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1));
};

SW.precacheCarriesNoOfflineData = (src) => {
  const urls = SW.precacheUrls(src);
  if (urls.length === 0) return false;
  const banned = /\/api\/|\/img\/vr\/|panorama|\/vr\/routes|schedule|tile\.|cloudinary/i;
  return !urls.some((u) => banned.test(u));
};

SW.nonGetReturnsEarly = (src) => {
  const fetchListener = extractListener(stripComments(src), 'fetch');
  if (fetchListener === '') return false;
  const guard = fetchListener.indexOf("req.method !== 'GET'");
  const firstRespondWith = fetchListener.indexOf('respondWith');
  return guard !== -1 && firstRespondWith !== -1 && guard < firstRespondWith;
};

/* OFF.2-OFF.5 offline-scope boundary.

   Both analyzers read COMMENT-STRIPPED source and the EXTRACTED function, never
   the raw file: public/sw.js documents these exclusions in prose that names
   res.cloudinary.com and /api/vr/routes, so a raw scan would be satisfied — or
   falsely broken — by its own comments. */

/* No cross-origin request may be cache-eligible, and the machinery that made it
   possible must be GONE rather than dormant: a disabled host list or an unused
   strategy is one edit away from re-mirroring the public OSM tile service or
   Cloudinary media. Checked on comment-stripped source so the prose documenting
   the removal cannot satisfy — or falsely break — the contract. */
SW.noCrossOriginCaching = (src) => {
  const stripped = stripComments(src);
  const removed = ['isApprovedExternalHost', 'externalStrategy', 'cachedTypeMatchesMode']
    .every((name) => extractFunction(stripped, name) === '');
  const noConstants = !/EXTERNAL_CACHE/.test(stripped) && !/EXTERNAL_MAX/.test(stripped);
  const currentCaches = (stripped.match(/CURRENT_CACHES\s*=\s*\[([^\]]*)\]/) || [])[1] || '';
  const noExternalCurrent = currentCaches !== '' && !/EXTERNAL/.test(currentCaches);
  // The cross-origin branch must return without ever calling respondWith.
  const fetchListener = extractListener(stripped, 'fetch');
  const branch = fetchListener.slice(
    fetchListener.indexOf('url.origin !== self.location.origin'),
    fetchListener.indexOf('isForbiddenPath')
  );
  const branchIsBare = branch !== '' && !/respondWith/.test(branch) && /return;/.test(branch);
  return removed && noConstants && noExternalCurrent && branchIsBare &&
    !/openstreetmap/i.test(stripped) && !/cloudinary/i.test(stripped);
};

/* Same-origin cache eligibility must be an EXACT allowlist derived from the
   reviewed PRECACHE_URLS, matched on pathname + search — never an extension or
   directory rule that silently admits local building photos. */
SW.shellAllowlistIsExact = (src) => {
  const stripped = stripComments(src);
  const fn = extractFunction(stripped, 'isExactShellAsset');
  const fetchListener = extractListener(stripped, 'fetch');
  if (fn === '' || fetchListener === '') return false;
  const derivedFromPrecache = /SHELL_ASSET_SET[\s\S]{0,400}PRECACHE_URLS/.test(stripped);
  const exactLookup = /SHELL_ASSET_SET\[\s*pathWithQuery\s*\]\s*===\s*true/.test(fn);
  const matchesQuery = /isExactShellAsset\(\s*url\.pathname\s*\+\s*url\.search\s*\)/.test(fetchListener);
  // The removed permissive rule must not come back in any form.
  const noExtensionRule = extractFunction(stripped, 'isCacheableStatic') === '' &&
    !/\\\.\(css\|js/.test(stripped);
  return derivedFromPrecache && exactLookup && matchesQuery && noExtensionRule;
};

/* The WHOLE same-origin API surface must be network-only, and the automatic
   API-cache machinery must be GONE rather than dormant. /api/buildings and
   /api/routes* carry Cloudinary image URLs and local building-photo references,
   so caching them retained media the user never consented to download. */
/* The exact truth table the classifier must satisfy. '/apiary' and '/apis'
   are the boundary cases a naive startsWith('/api') rule would wrongly
   capture, which would make unrelated same-origin routes network-only. */
SW.API_MUST_MATCH = Object.freeze([
  '/api', '/api/buildings', '/api/routes', '/api/routes/1',
  '/api/vr/routes/1', '/api/search', '/api/pathfind'
]);
SW.API_MUST_NOT_MATCH = Object.freeze(['/apiary', '/apis', '/auth', '/map', '/']);

SW.apiIsNetworkOnly = (src) => {
  // Fail closed on ANY extraction or evaluation error.
  try {
    const stripped = stripComments(src);
    const networkOnlyFn = extractFunction(stripped, 'isNetworkOnlyPath');
    const listMatch = stripped.match(/NETWORK_ONLY_PREFIXES\s*=\s*\[([\s\S]*?)\]/);
    const fetchListener = extractListener(stripped, 'fetch');
    if (networkOnlyFn === '' || !listMatch || fetchListener === '') return false;

    // (a) EXACTLY ONE network-only prefix, and it is '/api'.
    const prefixes = (listMatch[1].match(/'([^']*)'/g) || []).map((s) => s.slice(1, -1));
    if (prefixes.length !== 1 || prefixes[0] !== '/api') return false;

    /* (b) BEHAVIOURAL. The REAL extracted classifier is evaluated in an
       isolated node:vm context against the exact truth table, so a source
       shape that reads correctly but behaves wrongly (or always returns
       false) cannot pass a text scan. */
    const sandbox = Object.create(null);
    vm.createContext(sandbox);
    vm.runInContext(
      'var NETWORK_ONLY_PREFIXES = ' + JSON.stringify(prefixes) + ';\n' +
      networkOnlyFn + '\n__probe = isNetworkOnlyPath;',
      sandbox, { timeout: 1000 }
    );
    const classify = sandbox.__probe;
    if (typeof classify !== 'function') return false;
    if (!SW.API_MUST_MATCH.every((p) => classify(p) === true)) return false;
    if (!SW.API_MUST_NOT_MATCH.every((p) => classify(p) === false)) return false;

    // (c) Every piece of the API-cache machinery is absent.
    if (extractFunction(stripped, 'isApprovedApi') !== '') return false;
    if (extractFunction(stripped, 'apiStrategy') !== '') return false;
    if (/API_CACHE/.test(stripped) || /API_MAX/.test(stripped)) return false;

    /* (d) CURRENT_CACHES TOKENIZES to exactly [SHELL_CACHE, STATIC_CACHE] in
       that order. Tokenized rather than pattern-matched so a third identifier
       cannot hide behind a substring test. */
    const ccMatch = stripped.match(/CURRENT_CACHES\s*=\s*\[([^\]]*)\]/);
    if (!ccMatch) return false;
    const tokens = ccMatch[1].split(',').map((t) => t.trim()).filter((t) => t !== '');
    if (tokens.length !== 2 || tokens[0] !== 'SHELL_CACHE' || tokens[1] !== 'STATIC_CACHE') return false;

    /* (e) The fetch guard invokes isNetworkOnlyPath(url.pathname) and runs
       BEFORE every remaining same-origin strategy. Compared against the
       strategies rather than the first respondWith: the cross-origin branch
       legitimately appears earlier and returns bare. apiStrategy is
       deliberately absent from this list — it no longer exists. */
    if (!/isNetworkOnlyPath\(\s*url\.pathname\s*\)/.test(fetchListener)) return false;
    const guard = fetchListener.search(/isNetworkOnlyPath\(\s*url\.pathname\s*\)/);
    const sameOriginStrategies = ['navigationFallbackStrategy(', 'staticStrategy(']
      .map((name) => fetchListener.indexOf(name));
    if (guard === -1 || sameOriginStrategies.some((i) => i === -1)) return false;
    return sameOriginStrategies.every((i) => guard < i);
  } catch (e) {
    return false;
  }
};

/* ------------------------------------------------------- pwa.js analyzers */

const PWA = {};

PWA.capturesRegistration = (src) => {
  const s = stripComments(src);
  return /register\(\s*'\/sw\.js'\s*\)\s*\.then\s*\(/.test(s) && /watchRegistration\s*\(/.test(s);
};

PWA.detectsWaitingAndUpdateFound = (src) => {
  const s = stripComments(src);
  return /reg\.waiting/.test(s) && /addEventListener\('updatefound'/.test(s) && /reg\.installing/.test(s);
};

PWA.gatesPromptOnExistingController = (src) => {
  const s = stripComments(src);
  // Every showUpdatePrompt trigger must be guarded by an existing controller,
  // so a FIRST installation cannot raise a false "update available" prompt.
  const triggers = s.split('showUpdatePrompt(').slice(1).length;
  const waitingGuard = /reg\.waiting\s*&&\s*navigator\.serviceWorker\.controller[\s\S]{0,80}showUpdatePrompt\(/.test(s);
  const installedGuard = /state\s*===\s*'installed'\s*&&\s*navigator\.serviceWorker\.controller[\s\S]{0,120}showUpdatePrompt\(/.test(s);
  return triggers >= 2 && waitingGuard && installedGuard;
};

PWA.postsSkipWaitingOnlyFromUserAction = (src) => {
  const s = stripComments(src);
  if (countOccurrences(s, "postMessage({ type: 'SKIP_WAITING' })") !== 1) return false;
  const accept = extractFunction(s, 'acceptUpdate');
  if (accept === '') return false;
  // The single send must live inside acceptUpdate, which is reachable only
  // from the update control's click handler.
  return countOccurrences(accept, "postMessage({ type: 'SKIP_WAITING' })") === 1 &&
    /accept\.addEventListener\('click',\s*acceptUpdate\)/.test(s);
};

PWA.bindsControllerChangeOnce = (src) => {
  const s = stripComments(src);
  const fn = extractFunction(s, 'bindControllerChangeOnce');
  if (fn === '') return false;
  return /if\s*\(\s*controllerChangeBound\s*\)\s*return;/.test(fn) &&
    /controllerChangeBound\s*=\s*true;/.test(fn) &&
    countOccurrences(s, "addEventListener('controllerchange'") === 1;
};

PWA.reloadIsGuardedAndSingle = (src) => {
  const s = stripComments(src);
  const fn = extractFunction(s, 'bindControllerChangeOnce');
  if (fn === '') return false;
  return /if\s*\(\s*!userAcceptedUpdate\s*\)\s*return;/.test(fn) &&
    /if\s*\(\s*reloadingForUpdate\s*\)\s*return;/.test(fn) &&
    /reloadingForUpdate\s*=\s*true;/.test(fn) &&
    countOccurrences(s, 'location.reload()') === 1 &&
    countOccurrences(fn, 'location.reload()') === 1;
};

PWA.reconnectChecksForUpdateSafely = (src) => {
  const s = stripComments(src);
  const online = extractFunction(s, 'handleOnline');
  const check = extractFunction(s, 'requestUpdateCheck');
  if (online === '' || check === '') return false;
  return /show\('Back online\.',\s*'online',\s*3000\)/.test(online) &&
    /requestUpdateCheck\(\)/.test(online) &&
    /swRegistration\.update\(\)/.test(check) &&
    !/reload|unregister|caches\.delete/.test(check);
};

PWA.updatePromptIsAccessibleAndNonBlocking = (src) => {
  const s = stripComments(src);
  const build = extractFunction(s, 'buildUpdatePrompt');
  if (build === '') return false;
  return /setAttribute\('role',\s*'status'\)/.test(build) &&
    /setAttribute\('aria-live',\s*'polite'\)/.test(build) &&
    countOccurrences(build, "createElement('button')") === 2 &&
    countOccurrences(build, "type = 'button'") === 2 &&
    /pointer-events:auto/.test(build);
};

PWA.statusBannerStaysNonBlocking = (src) => {
  const s = stripComments(src);
  const getBanner = extractFunction(s, 'getBanner');
  return getBanner !== '' && /pointer-events:none/.test(getBanner);
};

PWA.buildsUiWithoutInnerHtml = (src) => !/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(stripComments(src));

/* ------------------------------------------------ offline-shell analyzer */

const SHELL = {};

/* Session neutrality, scanned on COMMENT-STRIPPED markup and by SHAPE rather
   than by English words. The shell's own explanatory comment necessarily
   contains "session", "user" and "role"; a bare word scan would match that
   comment and report a leak that does not exist, while still missing a real
   leak written differently. */
SHELL.LEAK_SHAPES = [
  /<%/,                                       // any EJS/template interpolation
  /__SESSION_USER/i,                          // the app's session bootstrap global
  /csrf/i,                                    // CSRF token name or meta
  /name\s*=\s*"(_csrf|user|email|role)"/i,    // personalized form fields
  /data-(user|role|email|session)\s*=/i,      // personalized data attributes
  /\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/,           // a literal email address
  /(session|user|role)(Id|_id|Name)\s*[:=]/i  // personalized identifiers
];

SHELL.isSessionNeutral = (html) => {
  const withoutComments = String(html).replace(/<!--[\s\S]*?-->/g, '');
  return !SHELL.LEAK_SHAPES.some((re) => re.test(withoutComments));
};

/* ------------------------------------- ServiceWorkerGlobalScope emulation */

function absolute(u) { return new URL(u, ORIGIN).href; }

function cacheKeyOf(x) {
  if (typeof x === 'string') return absolute(x);
  if (x && typeof x.url === 'string') return absolute(x.url);
  return String(x);
}

/* Minimal Request shim: Node's undici Request rejects relative URLs, which
   public/sw.js legitimately uses for its shell entries. */
function makeRequestShim() {
  return class SwRequest {
    constructor(input, init) {
      const opts = init || {};
      if (typeof input === 'string') {
        this.url = absolute(input);
        this.method = String(opts.method || 'GET').toUpperCase();
        this.mode = opts.mode || 'no-cors';
      } else {
        this.url = absolute(input.url);
        this.method = String(opts.method || input.method || 'GET').toUpperCase();
        this.mode = opts.mode || input.mode || 'no-cors';
      }
      this.cache = opts.cache || 'default';
    }
  };
}

/* Fake Cache Storage. `behavior` lets a test simulate a failed network during
   precache, or a browser that violates Cache.addAll() atomicity. */
function makeFakeCacheStorage(seedNames, behavior) {
  const b = behavior || {};
  const store = new Map();
  for (const name of seedNames || []) store.set(name, new Map());

  function cacheFor(name) {
    if (!store.has(name)) store.set(name, new Map());
    const entries = store.get(name);
    return {
      addAll(requests) {
        const list = Array.from(requests);
        if (b.failAddAll) return Promise.reject(new TypeError('simulated precache network failure'));
        if (b.partialAddAll) {
          // A browser that (incorrectly) commits a partial result.
          list.slice(0, Math.max(1, Math.floor(list.length / 2)))
            .forEach((r) => entries.set(cacheKeyOf(r), { ok: true }));
          return Promise.resolve();
        }
        list.forEach((r) => entries.set(cacheKeyOf(r), { ok: true }));
        return Promise.resolve();
      },
      add(request) { return this.addAll([request]); },
      match(request) { return Promise.resolve(entries.get(cacheKeyOf(request))); },
      put(request, response) { entries.set(cacheKeyOf(request), response || { ok: true }); return Promise.resolve(); },
      keys() { return Promise.resolve(Array.from(entries.keys())); },
      delete(request) { return Promise.resolve(entries.delete(cacheKeyOf(request))); }
    };
  }

  return {
    _store: store,
    open(name) { return Promise.resolve(cacheFor(name)); },
    keys() { return Promise.resolve(Array.from(store.keys())); },
    delete(name) { return Promise.resolve(store.delete(name)); },
    match(request) {
      for (const entries of store.values()) {
        const hit = entries.get(cacheKeyOf(request));
        if (hit) return Promise.resolve(hit);
      }
      return Promise.resolve(undefined);
    }
  };
}

function loadServiceWorker(source, options) {
  const opts = options || {};
  const listeners = Object.create(null);
  const calls = { skipWaiting: 0, claim: 0 };
  const cacheStorage = makeFakeCacheStorage(opts.seedCaches, opts.cacheBehavior);

  const swSelf = {
    addEventListener(type, fn) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(fn);
    },
    skipWaiting() { calls.skipWaiting += 1; return Promise.resolve(); },
    clients: { claim() { calls.claim += 1; return Promise.resolve(); } },
    location: { origin: ORIGIN },
    registration: {}
  };

  const sandbox = {
    self: swSelf,
    caches: cacheStorage,
    fetch: opts.fetch || (() => Promise.reject(new TypeError('simulated offline'))),
    Request: makeRequestShim(),
    Response,
    Headers,
    URL,
    console: { log() {}, warn() {}, error() {} }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'sw.js' });

  function fire(type, event) {
    const handlers = listeners[type] || [];
    for (const fn of handlers) fn(event);
  }

  return { listeners, calls, caches: cacheStorage, self: swSelf, fire };
}

/* An ExtendableEvent stand-in that captures waitUntil / respondWith. */
function makeLifecycleEvent() {
  const waited = [];
  return {
    waitUntil(p) { waited.push(Promise.resolve(p)); },
    settle() { return Promise.allSettled(waited); },
    waited
  };
}

function makeFetchEvent(url, init) {
  const opts = init || {};
  const waited = [];
  const responded = [];
  return {
    request: {
      url: absolute(url),
      method: String(opts.method || 'GET').toUpperCase(),
      mode: opts.mode || 'no-cors'
    },
    waitUntil(p) { waited.push(Promise.resolve(p).catch(() => undefined)); },
    respondWith(p) { responded.push(Promise.resolve(p)); },
    responded,
    waited
  };
}

function allCachedKeys(cacheStorage) {
  const out = [];
  for (const [name, entries] of cacheStorage._store.entries()) {
    for (const key of entries.keys()) out.push(`${name} :: ${key}`);
  }
  return out;
}

/* ------------------------------------------------------------ port guard */

function portIsFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
}

/* ============================ 1. MANIFEST + INSTALLABILITY ============== */

function readPngSize(file) {
  const buf = fs.readFileSync(file);
  if (buf.slice(1, 4).toString() !== 'PNG') return null;
  return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;
}

async function checkManifest(base) {
  section('OFF.2 case 1 — manifest validity and installability metadata');

  const res = await fetch(`${base}/manifest.webmanifest`);
  const raw = await res.text();
  ok('GET /manifest.webmanifest -> 200', res.status === 200);
  ok('manifest is served with a JSON/manifest content type',
    /application\/(manifest\+json|json)/i.test(res.headers.get('content-type') || ''));
  ok('manifest response sets no cookie', res.headers.get('set-cookie') === null);

  let m = null;
  try { m = JSON.parse(raw); } catch (e) { m = null; }
  ok('manifest parses as JSON', m !== null);
  if (!m) return;

  ok('manifest served bytes match public/manifest.webmanifest on disk',
    raw === fs.readFileSync(MANIFEST_PATH, 'utf8'));

  ok('manifest declares a stable id', typeof m.id === 'string' && m.id.length > 0);
  ok('manifest declares name', typeof m.name === 'string' && m.name.trim().length > 0);
  ok('manifest declares a home-screen-safe short_name (<= 12 chars)',
    typeof m.short_name === 'string' && m.short_name.length > 0 && m.short_name.length <= 12);
  ok('manifest declares description', typeof m.description === 'string' && m.description.length > 0);
  ok('manifest declares lang and dir',
    m.lang === 'en' && (m.dir === 'ltr' || m.dir === 'rtl' || m.dir === 'auto'));
  ok('manifest start_url is in scope', typeof m.start_url === 'string' && m.start_url.startsWith('/'));
  ok('manifest scope is the site root', m.scope === '/');
  ok('manifest display is an installable value',
    ['standalone', 'fullscreen', 'minimal-ui'].includes(m.display));
  ok('manifest display_override lists only valid fallbacks',
    Array.isArray(m.display_override) && m.display_override.length > 0 &&
    m.display_override.every((d) => ['standalone', 'fullscreen', 'minimal-ui', 'browser', 'window-controls-overlay'].includes(d)));
  ok('manifest declares orientation', typeof m.orientation === 'string' && m.orientation.length > 0);
  ok('manifest declares hex background_color and theme_color',
    /^#[0-9a-f]{6}$/i.test(m.background_color || '') && /^#[0-9a-f]{6}$/i.test(m.theme_color || ''));
  ok('manifest categories is a non-empty string array',
    Array.isArray(m.categories) && m.categories.length > 0 && m.categories.every((c) => typeof c === 'string'));

  const icons = Array.isArray(m.icons) ? m.icons : [];
  ok('manifest declares icons', icons.length > 0);
  ok('every icon src is same-origin and root-relative',
    icons.length > 0 && icons.every((i) => typeof i.src === 'string' && i.src.startsWith('/')));
  ok('every icon declares type image/png', icons.length > 0 && icons.every((i) => i.type === 'image/png'));

  const sizeOf = (i) => Number(String(i.sizes || '0x0').split('x')[0]) || 0;
  const purposes = (i) => String(i.purpose || 'any').split(/\s+/);
  ok('an "any" icon of at least 192px exists (Chrome installability minimum)',
    icons.some((i) => purposes(i).includes('any') && sizeOf(i) >= 192));
  ok('an "any" icon of at least 512px exists (splash/store quality)',
    icons.some((i) => purposes(i).includes('any') && sizeOf(i) >= 512));
  ok('a dedicated maskable icon of at least 192px exists (adaptive launcher icons)',
    icons.some((i) => purposes(i).includes('maskable') && sizeOf(i) >= 192));

  // Every declared size must match the real file, and the file must be served.
  let sizesTruthful = icons.length > 0;
  let iconsServed = icons.length > 0;
  for (const icon of icons) {
    const disk = path.join(ROOT, 'public', icon.src.replace(/^\/+/, ''));
    if (!fs.existsSync(disk) || readPngSize(disk) !== icon.sizes) sizesTruthful = false;
    const r = await fetch(base + icon.src);
    await r.arrayBuffer();
    if (r.status !== 200 || !/image\/png/i.test(r.headers.get('content-type') || '')) iconsServed = false;
  }
  ok('every declared icon size matches the real PNG header on disk', sizesTruthful);
  ok('every declared icon is served as image/png with 200', iconsServed);

  // The installed theme colour must agree across manifest, app shell and views.
  const head = fs.readFileSync(path.join(ROOT, 'views', 'partials', 'head.ejs'), 'utf8');
  const shell = fs.readFileSync(SHELL_HTML_PATH, 'utf8');
  ok('theme_color agrees with views/partials/head.ejs',
    head.includes(`<meta name="theme-color" content="${m.theme_color}">`));
  ok('theme_color agrees with the offline shell',
    shell.includes(`<meta name="theme-color" content="${m.theme_color}">`));
  ok('head.ejs links the manifest', /<link rel="manifest" href="\/manifest\.webmanifest">/.test(head));
  ok('head.ejs declares mobile-web-app-capable and an apple-touch-icon',
    /name="mobile-web-app-capable" content="yes"/.test(head) &&
    /rel="apple-touch-icon"/.test(head));
}

/* ================== 2. SERVICE-WORKER DELIVERY AND STRUCTURE ============ */

async function checkServiceWorkerDelivery(base, swSource) {
  section('OFF.2 — service-worker delivery');
  const res = await fetch(`${base}/sw.js`);
  const body = await res.text();
  ok('GET /sw.js -> 200', res.status === 200);
  ok('/sw.js is served as JavaScript', /javascript/i.test(res.headers.get('content-type') || ''));
  ok('/sw.js response sets no cookie', res.headers.get('set-cookie') === null);
  ok('/sw.js served bytes match public/sw.js on disk', body === swSource);
}

function checkServiceWorkerStructure(swSource) {
  section('OFF.2 cases 4/9/13/14 — service-worker lifecycle structure');

  ok('install does not call skipWaiting (an update may enter the waiting state)',
    SW.installDoesNotSkipWaiting(swSource));
  ok('shell precache is atomic (Cache.addAll, no per-entry allSettled)',
    SW.precacheIsAtomic(swSource));
  ok('install verifies every precached entry after writing',
    SW.installVerifiesEveryEntry(swSource));
  ok('install deletes the partial shell cache and re-throws on failure',
    SW.installCleansUpOnFailure(swSource));
  ok('a narrow { type: "SKIP_WAITING" } message handler exists',
    SW.hasNarrowSkipWaitingMessageHandler(swSource));
  ok('skipWaiting is reachable ONLY from that message handler',
    SW.skipWaitingOnlyInMessageHandler(swSource));
  ok('activate prunes only prefixed, non-current CampuSphere caches',
    SW.cleanupIsPrefixScopedAndVersioned(swSource));
  ok('cache version advanced for the locked identity profile controls (v38)', SW.cacheVersion(swSource) === 38);
  ok('non-GET requests return before any respondWith', SW.nonGetReturnsEarly(swSource));
  ok('precache carries no route, VR, panorama, schedule, tile or media data',
    SW.precacheCarriesNoOfflineData(swSource));

  const urls = SW.precacheUrls(swSource);
  const INTEGRATED_SHELL = [
    '/offline.html', '/css/offline.css', '/manifest.webmanifest', '/css/styles.css?v=10',
    '/js/pwa.js', '/js/offline-guide-manager.js', '/js/nav-role.js', '/js/profile-script.js',
    '/vendor/maplibre/maplibre-gl.css', '/vendor/maplibre/maplibre-gl.js',
    '/vendor/pmtiles/pmtiles.js', '/img/cspc-logo.png', '/img/Camarines-sur-polytechnic-colleges.png',
    '/img/icons/icon-192.png', '/img/icons/icon-512.png', '/img/icons/apple-touch-icon.png'
  ];
  ok('the precache is exactly the integrated session-neutral shell/runtime and contains no guide or map data',
    JSON.stringify(urls) === JSON.stringify(INTEGRATED_SHELL));

  const stripped = stripComments(swSource);
  ok('the established forbidden prefixes remain and the guide download is network-only',
    ["'/auth'", "'/login'", "'/register'", "'/logout'", "'/admin'", "'/api/update-profile'", "'/api/offline-guide'"]
      .every((p) => stripped.includes(p)));
  ok('NO cross-origin request is cache-eligible and the external cache machinery is removed',
    SW.noCrossOriginCaching(swSource));
  ok('same-origin cache eligibility is an EXACT allowlist derived from the reviewed shell',
    SW.shellAllowlistIsExact(swSource));
  ok('the ENTIRE same-origin API surface is network-only and the API-cache machinery is removed',
    SW.apiIsNetworkOnly(swSource));
  ok('navigations stay network-only with no page cache',
    /function navigationFallbackStrategy/.test(stripped) &&
    !/\bvar\s+PAGE_CACHE\s*=/.test(stripped) && !/function\s+pageStrategy/.test(stripped));
}

/* ================ 3. SERVICE-WORKER REJECTING FIXTURES ================= */

function checkServiceWorkerFixtures(swSource) {
  section('OFF.2 — service-worker analyzers driven against rejecting fixtures');

  const withSkipWaiting = swSource.replace(
    'return undefined;\n      });\n    }).catch(function (err) {',
    'return self.skipWaiting();\n      });\n    }).catch(function (err) {'
  );
  ok('REJECTS an install that calls skipWaiting',
    withSkipWaiting !== swSource && SW.installDoesNotSkipWaiting(withSkipWaiting) === false);

  const nonAtomic = swSource.replace('cache.addAll(', 'Promise.allSettled(');
  ok('REJECTS a non-atomic (allSettled) precache',
    nonAtomic !== swSource && SW.precacheIsAtomic(nonAtomic) === false);

  const noVerify = swSource.replace(/return cache\.match\(u\)\.then/, 'return Promise.resolve(true).then');
  ok('REJECTS an install that never re-verifies its cached entries',
    noVerify !== swSource && SW.installVerifiesEveryEntry(noVerify) === false);

  const noCleanup = swSource.replace('caches.delete(SHELL_CACHE)', 'Promise.resolve(true)');
  ok('REJECTS an install that leaves a partial shell cache behind',
    noCleanup !== swSource && SW.installCleansUpOnFailure(noCleanup) === false);

  const noMessage = swSource.replace("self.addEventListener('message'", "self.addEventListener('unused'");
  ok('REJECTS a worker with no SKIP_WAITING message handler',
    noMessage !== swSource && SW.hasNarrowSkipWaitingMessageHandler(noMessage) === false);

  const broadMessage = swSource.replace("if (data.type !== 'SKIP_WAITING') return;", '');
  ok('REJECTS a message handler that accepts any message shape',
    broadMessage !== swSource && SW.hasNarrowSkipWaitingMessageHandler(broadMessage) === false);

  const looseMessage = swSource.replace("if (!data || typeof data !== 'object') return;", '');
  ok('REJECTS a message handler that does not reject non-object data',
    looseMessage !== swSource && SW.hasNarrowSkipWaitingMessageHandler(looseMessage) === false);

  const straySkipWaiting = swSource.replace(
    "self.addEventListener('activate', function (event) {",
    "self.addEventListener('activate', function (event) {\n  self.skipWaiting();"
  );
  ok('REJECTS a skipWaiting call outside the message handler',
    straySkipWaiting !== swSource && SW.skipWaitingOnlyInMessageHandler(straySkipWaiting) === false);

  const blanketCleanup = swSource.replace(
    "if (key.indexOf(CACHE_PREFIX + '-') === 0 && CURRENT_CACHES.indexOf(key) === -1) {",
    'if (true) {'
  );
  ok('REJECTS a blanket cache cleanup that ignores the CampuSphere prefix',
    blanketCleanup !== swSource && SW.cleanupIsPrefixScopedAndVersioned(blanketCleanup) === false);

  // The immediately preceding v36 shell must not mask the corrected profile surfaces.
  const staleVersion = swSource.replace("CACHE_VERSION = 'v38'", "CACHE_VERSION = 'v37'");
  ok('REJECTS an un-advanced (stale v37) cache version',
    staleVersion !== swSource && SW.cacheVersion(staleVersion) !== 38);

  /* Reintroducing ANY cross-origin cache path must FAIL. Three separate
     regressions are driven through the real analyzer: an OSM host allowlist,
     a Cloudinary host allowlist, and a whole cross-origin strategy wired back
     into the fetch listener. */
  const osmReadmitted = swSource.replace(
    '  if (url.origin !== self.location.origin) {\n    return;\n  }',
    "  if (url.origin !== self.location.origin) {\n    if (url.hostname === 'tile.openstreetmap.org') event.respondWith(staticStrategy(event));\n    return;\n  }"
  );
  const cloudinaryReadmitted = swSource.replace(
    '  if (url.origin !== self.location.origin) {\n    return;\n  }',
    "  if (url.origin !== self.location.origin) {\n    if (url.hostname === 'res.cloudinary.com') event.respondWith(staticStrategy(event));\n    return;\n  }"
  );
  const externalStrategyRestored = swSource.replace(
    'function staticStrategy(event) {',
    'function externalStrategy(event) {\n  return caches.open(EXTERNAL_CACHE).then(function () { return fetch(event.request); });\n}\n\nfunction staticStrategy(event) {'
  );
  ok('REJECTS any reintroduced cross-origin cache path (OSM host, Cloudinary host, or external strategy)',
    osmReadmitted !== swSource && cloudinaryReadmitted !== swSource &&
    externalStrategyRestored !== swSource &&
    SW.noCrossOriginCaching(osmReadmitted) === false &&
    SW.noCrossOriginCaching(cloudinaryReadmitted) === false &&
    SW.noCrossOriginCaching(externalStrategyRestored) === false);

  /* The exact shell allowlist must reject both a permissive extension rule and
     an arbitrary non-shell path smuggled into the reviewed list. */
  const extensionRuleRestored = swSource.replace(
    'function isExactShellAsset(pathWithQuery) {\n  return SHELL_ASSET_SET[pathWithQuery] === true;\n}',
    'function isCacheableStatic(pathname) {\n  return /\\.(css|js|png|jpe?g|webp)$/i.test(pathname);\n}\n\nfunction isExactShellAsset(pathWithQuery) {\n  return SHELL_ASSET_SET[pathWithQuery] === true;\n}'
  );
  const arbitraryPathAdmitted = swSource.replace(
    "  '/img/cspc-logo.png',",
    "  '/img/cspc-logo.png',\n  '/img/campus-hero.jpg',"
  );
  ok('REJECTS an extension-wide static rule, and admits no arbitrary non-shell path into the shell allowlist',
    extensionRuleRestored !== swSource && arbitraryPathAdmitted !== swSource &&
    SW.shellAllowlistIsExact(extensionRuleRestored) === false &&
    SW.precacheUrls(arbitraryPathAdmitted).includes('/img/campus-hero.jpg') &&
    !SW.precacheUrls(swSource).includes('/img/campus-hero.jpg'));

  /* Every route back to automatic API caching must FAIL. Five separate
     regressions are driven through the real analyzer: the constants, the
     classifier, the strategy, an API interception branch, and a narrowed
     network-only prefix that would expose /api/buildings and /api/routes*. */
  const apiConstantsRestored = swSource.replace(
    'var STATIC_MAX = 60;',
    "var API_CACHE = CACHE_PREFIX + '-api-' + CACHE_VERSION;\nvar API_MAX = 30;\nvar STATIC_MAX = 60;"
  );
  const apiClassifierRestored = swSource.replace(
    'function isNetworkOnlyPath(pathname) {',
    "function isApprovedApi(pathname) {\n  return pathname === '/api/buildings';\n}\n\nfunction isNetworkOnlyPath(pathname) {"
  );
  const apiStrategyRestored = swSource.replace(
    'function staticStrategy(event) {',
    'function apiStrategy(event) {\n  return fetch(event.request);\n}\n\nfunction staticStrategy(event) {'
  );
  const apiBranchRestored = swSource.replace(
    '  if (isNetworkOnlyPath(url.pathname)) {\n    return;\n  }',
    "  if (url.pathname === '/api/buildings') {\n    event.respondWith(staticStrategy(event));\n    return;\n  }\n\n  if (isNetworkOnlyPath(url.pathname)) {\n    return;\n  }"
  );
  const apiPrefixNarrowed = swSource.replace("  '/api'  //", "  '/api/vr/routes'  //");
  // A classifier whose SOURCE still reads correctly but which always answers
  // false — only a behavioural evaluation catches this.
  const classifierAlwaysFalse = swSource.replace(
    'function isNetworkOnlyPath(pathname) {',
    'function isNetworkOnlyPath(pathname) {\n  return false;'
  );
  // A third cache smuggled into CURRENT_CACHES — only exact tokenization
  // catches this, since substring tests for SHELL/STATIC still succeed.
  const thirdCacheAdded = swSource.replace(
    'var CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE];',
    "var OTHER_CACHE = CACHE_PREFIX + '-other-' + CACHE_VERSION;\nvar CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE, OTHER_CACHE];"
  );
  ok('REJECTS every route back to automatic API caching (constants, classifier, strategy, interception branch, narrowed /api prefix, an always-false classifier, or a third cache in CURRENT_CACHES)',
    [apiConstantsRestored, apiClassifierRestored, apiStrategyRestored, apiBranchRestored,
      apiPrefixNarrowed, classifierAlwaysFalse, thirdCacheAdded]
      .every((mutated) => mutated !== swSource) &&
    SW.apiIsNetworkOnly(apiConstantsRestored) === false &&
    SW.apiIsNetworkOnly(apiClassifierRestored) === false &&
    SW.apiIsNetworkOnly(apiStrategyRestored) === false &&
    SW.apiIsNetworkOnly(apiBranchRestored) === false &&
    SW.apiIsNetworkOnly(apiPrefixNarrowed) === false &&
    SW.apiIsNetworkOnly(classifierAlwaysFalse) === false &&
    SW.apiIsNetworkOnly(thirdCacheAdded) === false &&
    // Positive anchor: the LIVE source must still be accepted.
    SW.apiIsNetworkOnly(swSource) === true);

  const dataInPrecache = swSource.replace("'/offline.html',", "'/offline.html',\n  '/api/routes',");
  ok('REJECTS offline route data smuggled into the precache list',
    dataInPrecache !== swSource && SW.precacheCarriesNoOfflineData(dataInPrecache) === false);

  const nonGetIntercepted = swSource.replace(
    "  if (req.method !== 'GET') {\n    return;\n  }",
    '  // guard removed'
  );
  ok('REJECTS a fetch handler that no longer returns early for non-GET',
    nonGetIntercepted !== swSource && SW.nonGetReturnsEarly(nonGetIntercepted) === false);
}

/* ============ 4. BEHAVIOURAL LIFECYCLE (real handlers, emulated scope) === */

async function checkInterruptedInstall(swSource) {
  section('OFF.2 case 7 — an interrupted precache cannot activate a partial shell');

  const failing = loadServiceWorker(swSource, { cacheBehavior: { failAddAll: true } });
  const ev = makeLifecycleEvent();
  failing.fire('install', ev);
  const settled = await ev.settle();

  ok('a failed precache REJECTS the install (the new worker is discarded)',
    settled.length === 1 && settled[0].status === 'rejected');
  ok('a failed install never calls skipWaiting', failing.calls.skipWaiting === 0);
  ok('a failed install never activates or claims clients', failing.calls.claim === 0);
  const keysAfterFail = await failing.caches.keys();
  ok('a failed install leaves no shell cache behind (deterministic recovery)',
    !keysAfterFail.some((k) => k.indexOf('campusphere-pwa-shell-') === 0));

  section('OFF.2 case 7b — a non-atomic browser still cannot produce a partial shell');
  const partial = loadServiceWorker(swSource, { cacheBehavior: { partialAddAll: true } });
  const ev2 = makeLifecycleEvent();
  partial.fire('install', ev2);
  const settled2 = await ev2.settle();
  ok('a partially committed precache is detected and REJECTS the install',
    settled2.length === 1 && settled2[0].status === 'rejected');
  const keysAfterPartial = await partial.caches.keys();
  ok('the partially written shell cache is deleted',
    !keysAfterPartial.some((k) => k.indexOf('campusphere-pwa-shell-') === 0));
  ok('a partial install never calls skipWaiting', partial.calls.skipWaiting === 0);
}

async function checkInstallRecoveryAndWaiting(swSource) {
  section('OFF.2 cases 2/4/8 — first install, recovery, and the waiting state');

  const sw = loadServiceWorker(swSource, {});
  const ev = makeLifecycleEvent();
  sw.fire('install', ev);
  const settled = await ev.settle();
  ok('a healthy first install RESOLVES', settled.length === 1 && settled[0].status === 'fulfilled');
  ok('a successful install still does NOT call skipWaiting (it waits for the user)',
    sw.calls.skipWaiting === 0);

  const shellName = (await sw.caches.keys()).find((k) => k.indexOf('campusphere-pwa-shell-') === 0);
  ok('the shell cache is created at the current version', shellName === 'campusphere-pwa-shell-v38');
  const shell = await sw.caches.open(shellName);
  const cachedKeys = await shell.keys();
  const expected = SW.precacheUrls(swSource).map((u) => absolute(u)).sort();
  ok('every shell entry — and only those entries — was precached',
    JSON.stringify(cachedKeys.slice().sort()) === JSON.stringify(expected));

  section('OFF.2 case 8 — recovery: a later install after a failed one succeeds');
  const recovered = loadServiceWorker(swSource, { cacheBehavior: { failAddAll: true } });
  const failEv = makeLifecycleEvent();
  recovered.fire('install', failEv);
  await failEv.settle();
  // Flip the simulated network back on and install again in the same scope.
  recovered.caches._store.clear();
  const healthy = loadServiceWorker(swSource, {});
  const retryEv = makeLifecycleEvent();
  healthy.fire('install', retryEv);
  const retry = await retryEv.settle();
  ok('the retried install RESOLVES after the earlier failure',
    retry.length === 1 && retry[0].status === 'fulfilled');
  const retryShell = (await healthy.caches.keys()).find((k) => k.indexOf('campusphere-pwa-shell-') === 0);
  const retryEntries = await (await healthy.caches.open(retryShell)).keys();
  ok('the recovered shell is complete', retryEntries.length === SW.precacheUrls(swSource).length);

  return sw;
}

async function checkExplicitActivation(swSource) {
  section('OFF.2 case 5 — activation happens only on an explicit SKIP_WAITING message');

  const sw = loadServiceWorker(swSource, {});
  const installEv = makeLifecycleEvent();
  sw.fire('install', installEv);
  await installEv.settle();
  ok('no activation before any message is sent', sw.calls.skipWaiting === 0);

  const ignored = [
    undefined, null, 0, '', 'SKIP_WAITING', [], {},
    { type: 'skip_waiting' }, { type: 'SKIP_WAITING_NOW' }, { type: 'CLAIM' },
    { message: 'SKIP_WAITING' }, { type: ['SKIP_WAITING'] }
  ];
  for (const data of ignored) sw.fire('message', { data });
  ok('every non-matching message shape is ignored (12 variants)', sw.calls.skipWaiting === 0);

  sw.fire('message', { data: { type: 'SKIP_WAITING' } });
  ok('the exact { type: "SKIP_WAITING" } message activates the waiting worker',
    sw.calls.skipWaiting === 1);

  sw.fire('message', { data: { type: 'SKIP_WAITING' } });
  ok('a repeated accept is idempotent from the worker side (no extra state)',
    sw.calls.skipWaiting === 2);
}

async function checkVersionedCleanup(swSource) {
  section('OFF.2 case 9 — stale CampuSphere caches are pruned; everything else survives');

  const seed = [
    // stale CampuSphere caches, INCLUDING the immediately preceding v12
    // API/external caches that could still hold Guided-VR route JSON or
    // Cloudinary media admitted before this boundary tightened.
    'campusphere-pwa-shell-v10', 'campusphere-pwa-static-v10',
    'campusphere-pwa-api-v9', 'campusphere-pwa-external-v9', 'campusphere-pwa-page-v6',
    'campusphere-pwa-shell-v12', 'campusphere-pwa-static-v12',
    'campusphere-pwa-api-v12', 'campusphere-pwa-external-v12',
    // v13 mirrored OSM tiles and extension-matched same-origin photos.
    'campusphere-pwa-shell-v13', 'campusphere-pwa-static-v13',
    'campusphere-pwa-api-v13', 'campusphere-pwa-external-v13',
    // the immediately preceding v14 set. Its API cache is the one that could
    // still hold /api/buildings and /api/routes* image references.
    'campusphere-pwa-shell-v14', 'campusphere-pwa-static-v14',
    'campusphere-pwa-api-v14', 'campusphere-pwa-external-v14',
    // preceding v15 caches — retained as older regression fixtures
    'campusphere-pwa-shell-v15', 'campusphere-pwa-static-v15',
    'campusphere-pwa-api-v15', 'campusphere-pwa-external-v15',
    // immediately preceding v16 caches — shell and static only, now stale.
    'campusphere-pwa-shell-v16', 'campusphere-pwa-static-v16',
    // v16-suffixed API and EXTERNAL caches must also be pruned.
    'campusphere-pwa-api-v16', 'campusphere-pwa-external-v16',
    // immediately preceding v17 caches — shell and static only, now stale.
    'campusphere-pwa-shell-v17', 'campusphere-pwa-static-v17',
    // v17-suffixed API and EXTERNAL caches must also be pruned.
    'campusphere-pwa-api-v17', 'campusphere-pwa-external-v17',
    // immediately preceding v18 caches - shell and static only, now stale.
    'campusphere-pwa-shell-v18', 'campusphere-pwa-static-v18',
    'campusphere-pwa-api-v18', 'campusphere-pwa-external-v18',
    // immediately preceding v19 caches - shell and static only, now stale.
    'campusphere-pwa-shell-v19', 'campusphere-pwa-static-v19',
    'campusphere-pwa-api-v19', 'campusphere-pwa-external-v19',
    // immediately preceding v20 caches - shell and static only, now stale.
    'campusphere-pwa-shell-v20', 'campusphere-pwa-static-v20',
    'campusphere-pwa-api-v20', 'campusphere-pwa-external-v20',
    // immediately preceding v21 caches - shell and static only, now stale.
    'campusphere-pwa-shell-v21', 'campusphere-pwa-static-v21',
    'campusphere-pwa-api-v21', 'campusphere-pwa-external-v21',
    // immediately preceding v22 caches - shell and static only, now stale.
    'campusphere-pwa-shell-v22', 'campusphere-pwa-static-v22',
    'campusphere-pwa-api-v22', 'campusphere-pwa-external-v22',
    // immediately preceding v23 caches - shell and static only, now stale.
    'campusphere-pwa-shell-v23', 'campusphere-pwa-static-v23',
    'campusphere-pwa-api-v23', 'campusphere-pwa-external-v23',
    // immediately preceding v24 caches - shell and static only, now stale.
    'campusphere-pwa-shell-v24', 'campusphere-pwa-static-v24',
    'campusphere-pwa-api-v24', 'campusphere-pwa-external-v24',
    // immediately preceding v25 caches - shell and static only, now stale.
    'campusphere-pwa-shell-v25', 'campusphere-pwa-static-v25',
    'campusphere-pwa-api-v25', 'campusphere-pwa-external-v25',
    // immediately preceding v27 caches - shell and static only, now stale.
    'campusphere-pwa-shell-v27', 'campusphere-pwa-static-v27',
    'campusphere-pwa-api-v27', 'campusphere-pwa-external-v27',
    // immediately preceding v28 caches - shell and static only, now stale.
    'campusphere-pwa-shell-v28', 'campusphere-pwa-static-v28',
    'campusphere-pwa-api-v28', 'campusphere-pwa-external-v28',
    // immediately preceding v29 caches - shell and static are stale. Any v29
    // API/external cache name is adversarial and must still be pruned.
    'campusphere-pwa-shell-v29', 'campusphere-pwa-static-v29',
    'campusphere-pwa-api-v29', 'campusphere-pwa-external-v29',
    // immediately preceding v30 caches - shell and static are stale. Any v30
    // API/external cache name is adversarial and must still be pruned.
    'campusphere-pwa-shell-v30', 'campusphere-pwa-static-v30',
    'campusphere-pwa-api-v30', 'campusphere-pwa-external-v30',
     // immediately preceding v31 caches - all are stale and must be pruned.
     'campusphere-pwa-shell-v31', 'campusphere-pwa-static-v31',
     'campusphere-pwa-api-v31', 'campusphere-pwa-external-v31',
     // immediately preceding v34 caches - all are stale and must be pruned.
     'campusphere-pwa-shell-v34', 'campusphere-pwa-static-v34',
     'campusphere-pwa-api-v34', 'campusphere-pwa-external-v34',
     // immediately preceding v35 caches - all are stale and must be pruned.
     'campusphere-pwa-shell-v35', 'campusphere-pwa-static-v35',
     'campusphere-pwa-api-v35', 'campusphere-pwa-external-v35',
     // immediately preceding v36 caches - all are stale and must be pruned.
     'campusphere-pwa-shell-v36', 'campusphere-pwa-static-v36',
     'campusphere-pwa-api-v36', 'campusphere-pwa-external-v36',
     // current v38 caches - shell and static ONLY. Any v38 API/external cache
     // name is adversarial and must still be pruned.
     'campusphere-pwa-shell-v38', 'campusphere-pwa-static-v38',
     'campusphere-pwa-api-v38', 'campusphere-pwa-external-v38',
     // the immediately preceding v37 set is stale and must be pruned too.
     'campusphere-pwa-shell-v37', 'campusphere-pwa-static-v37',
     'campusphere-pwa-api-v37', 'campusphere-pwa-external-v37',
    // unrelated Cache Storage entries that MUST survive
    'some-other-app-v1', 'workbox-precache-v2', 'campusphere-other-tool'
  ];
  const sw = loadServiceWorker(swSource, { seedCaches: seed });
  const ev = makeLifecycleEvent();
  sw.fire('activate', ev);
  const settled = await ev.settle();

  const remaining = await sw.caches.keys();
  // Combined: activation resolves and retains exactly the two current caches.
  ok('activate resolves and retains exactly the two current v38 caches (shell + static only)',
    settled.length === 1 && settled[0].status === 'fulfilled' &&
    ['shell', 'static'].every((k) => remaining.includes(`campusphere-pwa-${k}-v38`)));
  // Combined: every stale prefixed cache goes — the whole preceding v22 set,
  // the v14 API cache, the v13/v12 generations, the removed page cache,
  // and any API/external cache even at the current version suffix.
  ok('every stale campusphere-pwa-* cache was deleted, including the whole v37 set, older API/external/page generations, and any v38-suffixed API or external cache',
    !remaining.some((k) => k.indexOf('campusphere-pwa-') === 0 &&
      !['shell', 'static'].some((n) => k === `campusphere-pwa-${n}-v38`)) &&
    !remaining.some((k) => /^campusphere-pwa-.*-v27$/.test(k)) &&
    !remaining.some((k) => /^campusphere-pwa-.*-v28$/.test(k)) &&
    !remaining.some((k) => /^campusphere-pwa-.*-v26$/.test(k)) &&
    !remaining.some((k) => /^campusphere-pwa-.*-v25$/.test(k)) &&
    !remaining.some((k) => /^campusphere-pwa-.*-v24$/.test(k)) &&
    !remaining.some((k) => /^campusphere-pwa-.*-v23$/.test(k)) &&
    !remaining.some((k) => /^campusphere-pwa-.*-v22$/.test(k)) &&
    !remaining.some((k) => /^campusphere-pwa-.*-v21$/.test(k)) &&
    !remaining.some((k) => /^campusphere-pwa-.*-v20$/.test(k)) &&
    !remaining.some((k) => /^campusphere-pwa-.*-v19$/.test(k)) &&
    !remaining.some((k) => /^campusphere-pwa-.*-v18$/.test(k)) &&
    !remaining.some((k) => /^campusphere-pwa-.*-v17$/.test(k)) &&
    !remaining.some((k) => /^campusphere-pwa-.*-v16$/.test(k)) &&
    !remaining.some((k) => /^campusphere-pwa-.*-v15$/.test(k)) &&
    !remaining.some((k) => /^campusphere-pwa-.*-v14$/.test(k)) &&
    !remaining.includes('campusphere-pwa-api-v14') &&
    !remaining.includes('campusphere-pwa-api-v15') &&
    !remaining.includes('campusphere-pwa-external-v15') &&
    !remaining.includes('campusphere-pwa-api-v16') &&
    !remaining.includes('campusphere-pwa-external-v16') &&
    !remaining.includes('campusphere-pwa-api-v17') &&
    !remaining.includes('campusphere-pwa-external-v17') &&
    !remaining.includes('campusphere-pwa-api-v18') &&
    !remaining.includes('campusphere-pwa-external-v18') &&
    !remaining.includes('campusphere-pwa-api-v19') &&
    !remaining.includes('campusphere-pwa-external-v19') &&
    !remaining.includes('campusphere-pwa-api-v20') &&
    !remaining.includes('campusphere-pwa-external-v20') &&
    !remaining.includes('campusphere-pwa-api-v21') &&
    !remaining.includes('campusphere-pwa-external-v21') &&
    !remaining.includes('campusphere-pwa-api-v22') &&
    !remaining.includes('campusphere-pwa-external-v22') &&
    !remaining.includes('campusphere-pwa-api-v23') &&
    !remaining.includes('campusphere-pwa-external-v23') &&
    !remaining.includes('campusphere-pwa-api-v24') &&
    !remaining.includes('campusphere-pwa-external-v24') &&
    !remaining.includes('campusphere-pwa-api-v25') &&
    !remaining.includes('campusphere-pwa-external-v25') &&
    !remaining.includes('campusphere-pwa-api-v26') &&
    !remaining.includes('campusphere-pwa-external-v26') &&
    !remaining.includes('campusphere-pwa-api-v27') &&
    !remaining.includes('campusphere-pwa-external-v27') &&
    !remaining.includes('campusphere-pwa-api-v31') &&
    !remaining.includes('campusphere-pwa-external-v31') &&
     !remaining.includes('campusphere-pwa-api-v34') &&
     !remaining.includes('campusphere-pwa-external-v34') &&
     !remaining.includes('campusphere-pwa-api-v35') &&
     !remaining.includes('campusphere-pwa-external-v35') &&
    !remaining.includes('campusphere-pwa-api-v38') &&
    !remaining.includes('campusphere-pwa-external-v38') &&
    !remaining.includes('campusphere-pwa-shell-v37') &&
    !remaining.includes('campusphere-pwa-static-v37') &&
    !remaining.includes('campusphere-pwa-api-v37') &&
    !remaining.includes('campusphere-pwa-external-v37') &&
    !remaining.includes('campusphere-pwa-api-v12') &&
    !remaining.includes('campusphere-pwa-page-v6'));
  // Combined: unrelated entries and a similarly named non-prefixed cache survive.
  ok('unrelated Cache Storage entries and a similarly named non-prefixed cache are untouched',
    remaining.includes('some-other-app-v1') && remaining.includes('workbox-precache-v2') &&
    remaining.includes('campusphere-other-tool'));
  ok('activate claims clients exactly once (so one open page can observe the swap)',
    sw.calls.claim === 1);
}

async function checkFetchBoundaries(swSource) {
  section('OFF.2 cases 10/12/13 — offline shell, sensitive routes, and non-GET');

  // Offline navigation -> the neutral shell, from cache.
  const offline = loadServiceWorker(swSource, {});
  const installEv = makeLifecycleEvent();
  offline.fire('install', installEv);
  await installEv.settle();

  const navEvent = makeFetchEvent('/dashboard', { mode: 'navigate' });
  offline.fire('fetch', navEvent);
  const served = navEvent.responded.length === 1 ? await navEvent.responded[0] : null;
  // Combined: the worker handles the offline navigation AND answers it from the
  // precached session-neutral shell.
  ok('an offline navigation is handled by the worker and answered from the precached neutral shell',
    navEvent.responded.length === 1 && served && served.ok === true);

  // Sensitive routes must not be intercepted at all.
  const sensitive = [
    '/auth', '/auth/google', '/login', '/register', '/logout',
    '/admin', '/admin/users', '/admin/api/users', '/api/update-profile', '/api/offline-guide'
  ];
  let anyIntercepted = false;
  for (const p of sensitive) {
    const e = makeFetchEvent(p, { mode: 'navigate' });
    offline.fire('fetch', e);
    if (e.responded.length !== 0) anyIntercepted = true;
  }
  ok('no authenticated/admin/auth/offline-package route is intercepted (10 paths stay network-only)', !anyIntercepted);

  // Non-GET is never intercepted, on any path.
  let anyNonGetIntercepted = false;
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
    for (const p of ['/api/buildings', '/dashboard', '/css/styles.css', '/logout']) {
      const e = makeFetchEvent(p, { method });
      offline.fire('fetch', e);
      if (e.responded.length !== 0) anyNonGetIntercepted = true;
    }
  }
  ok('no non-GET request is intercepted (6 methods x 4 paths)', !anyNonGetIntercepted);

  // An ONLINE navigation must reach the network and cache nothing.
  const online = loadServiceWorker(swSource, {
    fetch: () => Promise.resolve({ ok: true, status: 200, type: 'basic', redirected: false, headers: new Headers() })
  });
  const onlineInstall = makeLifecycleEvent();
  online.fire('install', onlineInstall);
  await onlineInstall.settle();
  const before = allCachedKeys(online.caches).length;
  const onlineNav = makeFetchEvent('/dashboard', { mode: 'navigate' });
  online.fire('fetch', onlineNav);
  await Promise.allSettled(onlineNav.responded);
  await Promise.allSettled(onlineNav.waited);
  ok('an online authenticated navigation caches no HTML',
    allCachedKeys(online.caches).length === before);

  /* ---- ADVERSARIAL: Guided-VR route JSON and Cloudinary media ----
     Driven against an ONLINE worker whose network SUCCEEDS, because a caching
     regression would only surface on a successful response. Each request is
     issued in the modes a real page uses (XHR/cors, <img> no-cors, and a direct
     navigation), and both the interception count and the cache contents are
     checked — proving the requests are neither intercepted nor stored, while
     still reaching the browser's normal network path. */
  /* The API body deliberately carries BOTH a Cloudinary delivery URL and a
     local building-photo reference, so a caching regression would demonstrably
     retain media references without explicit consent. */
  const API_BODY = JSON.stringify([{
    id: 7,
    name: 'College of Computer Studies',
    image_url: 'https://res.cloudinary.com/demo/image/upload/ccs-main.jpg',
    local_photo: '/img/buildings/ccs-main-photo.jpg'
  }]);
  const adversarial = loadServiceWorker(swSource, {
    fetch: () => Promise.resolve({
      ok: true, status: 200, type: 'basic', redirected: false,
      headers: new Headers({ 'content-type': 'application/json' }),
      body: API_BODY,
      clone: () => ({ ok: true, status: 200, type: 'basic', body: API_BODY })
    })
  });
  const advInstall = makeLifecycleEvent();
  adversarial.fire('install', advInstall);
  await advInstall.settle();
  const advBaseline = allCachedKeys(adversarial.caches).slice().sort();

  /* The WHOLE API surface, driven against a SUCCESSFUL online worker whose
     /api/buildings body carries BOTH a Cloudinary image URL and a local
     building-photo reference — exactly the payload the removed API cache used
     to retain without the user's explicit download consent. Query-string
     variants and a direct navigation are included, since caching once keyed on
     the full URL. */
  const apiRequests = [
    ['/api/buildings', { mode: 'cors' }],
    ['/api/buildings?fields=all', { mode: 'cors' }],
    ['/api/buildings', { mode: 'navigate' }],
    ['/api/routes', { mode: 'cors' }],
    ['/api/routes?active=1', { mode: 'cors' }],
    ['/api/routes/1', { mode: 'cors' }],
    ['/api/routes/1?step=2', { mode: 'cors' }],
    ['/api/vr/routes/1', { mode: 'cors' }],
    ['/api/vr/routes/12/scenes', { mode: 'cors' }],
    ['/api/search?q=ccs', { mode: 'cors' }]
  ];
  let apiIntercepted = 0;
  for (const [p, init] of apiRequests) {
    const e = makeFetchEvent(p, init);
    adversarial.fire('fetch', e);
    apiIntercepted += e.responded.length;
    await Promise.allSettled(e.responded);
    await Promise.allSettled(e.waited);
  }
  const afterApi = allCachedKeys(adversarial.caches).slice().sort();
  ok('adversarial API requests (buildings with Cloudinary + local photo refs, routes, routes/1, query variants, Guided-VR, search) are never intercepted and never cached (10 requests)',
    apiIntercepted === 0 &&
    JSON.stringify(afterApi) === JSON.stringify(advBaseline) &&
    !afterApi.some((k) => /\/api\//.test(k)));

  const cloudinaryRequests = [
    ['https://res.cloudinary.com/demo/image/upload/sample.jpg', { mode: 'no-cors' }],
    ['https://res.cloudinary.com/demo/image/upload/panorama-360.jpg', { mode: 'cors' }],
    ['https://res.cloudinary.com/demo/video/upload/tour.mp4', { mode: 'no-cors' }],
    ['https://res.cloudinary.com/demo/image/upload/building-photo.png', { mode: 'no-cors' }]
  ];
  let cloudinaryIntercepted = 0;
  for (const [u, init] of cloudinaryRequests) {
    const e = makeFetchEvent(u, init);
    adversarial.fire('fetch', e);
    cloudinaryIntercepted += e.responded.length;
    await Promise.allSettled(e.responded);
    await Promise.allSettled(e.waited);
  }
  ok('adversarial res.cloudinary.com requests are never intercepted and never cached (4 requests)',
    cloudinaryIntercepted === 0 &&
    JSON.stringify(allCachedKeys(adversarial.caches).slice().sort()) === JSON.stringify(advBaseline));

  /* SAME-ORIGIN non-shell media and static files. This is the class the earlier
     extension-wide rule silently admitted: every one of these matched
     /\.(css|js|png|jpe?g|webp)$/ outside /img/vr/ and was therefore cached. */
  const sameOriginNonShell = [
    ['/img/campus-hero.jpg', { mode: 'no-cors' }],                       // non-shell hero image
    ['/img/buildings/ccs-main-photo.jpg', { mode: 'no-cors' }],          // DB-selected building photo
    ['/img/vr/main%20gate%20panorama.jpg', { mode: 'no-cors' }],         // percent-encoded local panorama
    ['/js/admin-users.js', { mode: 'cors' }],                            // non-shell same-origin script
    ['/css/admin.css', { mode: 'cors' }],                                // non-shell same-origin stylesheet
    ['/css/styles.css?v=11', { mode: 'cors' }]                           // shell path, UNREVIEWED query
  ];
  let nonShellIntercepted = 0;
  for (const [p, init] of sameOriginNonShell) {
    const e = makeFetchEvent(p, init);
    adversarial.fire('fetch', e);
    nonShellIntercepted += e.responded.length;
    await Promise.allSettled(e.responded);
    await Promise.allSettled(e.waited);
  }
  ok('adversarial same-origin non-shell photos, panoramas, scripts, styles and query-modified shell paths are never intercepted and never cached (6 classes)',
    nonShellIntercepted === 0 &&
    JSON.stringify(allCachedKeys(adversarial.caches).slice().sort()) === JSON.stringify(advBaseline));

  /* OpenStreetMap tiles: apex host and an a/b/c subdomain. OFF.4 renders the
     offline map from the bundled PMTiles archive, so the public tile service is
     never mirrored — while remaining fully available online through CSP. */
  const osmRequests = [
    ['https://tile.openstreetmap.org/16/32100/18500.png', { mode: 'no-cors' }],
    ['https://a.tile.openstreetmap.org/16/32100/18500.png', { mode: 'no-cors' }],
    ['https://b.tile.openstreetmap.org/17/64200/37000.png', { mode: 'no-cors' }],
    ['https://c.tile.openstreetmap.org/15/16050/9250.png', { mode: 'cors' }]
  ];
  let osmIntercepted = 0;
  for (const [u, init] of osmRequests) {
    const e = makeFetchEvent(u, init);
    adversarial.fire('fetch', e);
    osmIntercepted += e.responded.length;
    await Promise.allSettled(e.responded);
    await Promise.allSettled(e.waited);
  }
  ok('adversarial OpenStreetMap tile requests (apex + a/b/c subdomains) are never intercepted and never cached',
    osmIntercepted === 0 &&
    JSON.stringify(allCachedKeys(adversarial.caches).slice().sort()) === JSON.stringify(advBaseline));

  /* POSITIVE: the allowlist must still ACCEPT every exact reviewed shell asset,
     otherwise "nothing is cached" would pass trivially and the offline shell
     would be broken. /offline.html is answered by the navigation branch. */
  let shellHandled = 0;
  for (const u of SW.precacheUrls(swSource)) {
    const e = makeFetchEvent(u, { mode: 'cors' });
    adversarial.fire('fetch', e);
    shellHandled += e.responded.length;
    await Promise.allSettled(e.responded);
    await Promise.allSettled(e.waited);
  }
  ok('every exact reviewed shell asset IS still cache-eligible (positive allowlist fixture)',
    shellHandled === SW.precacheUrls(swSource).length && shellHandled === 16);

  section('OFF.2 case 14 — no route, schedule, VR, panorama, or media data in any cache');
  const keys = allCachedKeys(offline.caches);
  // Combined: the cache holds exactly the shell entries and no foreign HTML.
  ok('cache storage holds only the session-neutral shell entries and no other HTML page',
    keys.length === SW.precacheUrls(swSource).length &&
    !keys.some((k) => /\.html$/i.test(k) && !/offline\.html$/i.test(k)));
  ok('no cached key references guide JSON, route data, schedule, VR, panorama, PMTiles archive, or Cloudinary data',
    !keys.some((k) => /\/api\/|\/img\/vr\/|panorama|schedule|\.pmtiles|cloudinary|\/vr\/routes/i.test(k)));
}

/* ================== 5. PWA CLIENT UPDATE-LIFECYCLE CONTRACT ============= */

function checkPwaClient(pwaSource) {
  section('OFF.2 cases 3/5/6/11 — PWA client update lifecycle (static contract)');

  ok('the client captures the registration returned by register("/sw.js")',
    PWA.capturesRegistration(pwaSource));
  ok('the client detects both registration.waiting and updatefound',
    PWA.detectsWaitingAndUpdateFound(pwaSource));
  ok('every update prompt is gated on an existing controller (no false first-install prompt)',
    PWA.gatesPromptOnExistingController(pwaSource));
  ok('SKIP_WAITING is posted exactly once, only from the user update action',
    PWA.postsSkipWaitingOnlyFromUserAction(pwaSource));
  ok('controllerchange is bound exactly once behind a one-shot guard',
    PWA.bindsControllerChangeOnce(pwaSource));
  ok('the single reload is guarded by user intent AND a one-shot latch (no reload loop)',
    PWA.reloadIsGuardedAndSingle(pwaSource));
  ok('reconnect shows bounded "Back online." feedback and safely re-checks the registration',
    PWA.reconnectChecksForUpdateSafely(pwaSource));
  ok('the update prompt is an accessible polite live region with two real buttons',
    PWA.updatePromptIsAccessibleAndNonBlocking(pwaSource));
  ok('the connectivity status banner stays non-blocking (pointer-events:none)',
    PWA.statusBannerStaysNonBlocking(pwaSource));
  ok('the client builds UI without innerHTML/document.write (CSP-safe)',
    PWA.buildsUiWithoutInnerHtml(pwaSource));

  const stripped = stripComments(pwaSource);
  ok('the client still refuses to register on sensitive paths',
    /!isSensitivePath\(location\.pathname\)/.test(stripped));
  ok('the client sensitive-prefix list still mirrors the worker forbidden list',
    ["'/auth'", "'/login'", "'/register'", "'/logout'", "'/admin'", "'/api/update-profile'"]
      .every((p) => stripped.includes(p)));
  ok('the client never unregisters a worker or clears shell/static caches',
    !/\.unregister\(/.test(stripped) &&
    !/caches\.delete\((?!.*DYNAMIC)/.test(stripped.replace(/DYNAMIC_CACHE_MATCH\.test\(key\) \? caches\.delete\(key\)/g, 'GUARDED')));
  ok('reconnect never reloads the page or discards user state',
    !/online[\s\S]{0,400}location\.reload/.test(stripped));

  section('OFF.2 — PWA client analyzers driven against rejecting fixtures');

  const noControllerGate = pwaSource.replace(
    'if (reg.waiting && navigator.serviceWorker.controller) {',
    'if (reg.waiting) {'
  );
  ok('REJECTS an update prompt that is not gated on an existing controller',
    noControllerGate !== pwaSource && PWA.gatesPromptOnExistingController(noControllerGate) === false);

  const noIntentGuard = pwaSource.replace('if (!userAcceptedUpdate) return;   // never a silent reload', '');
  ok('REJECTS a controllerchange reload that ignores user intent',
    noIntentGuard !== pwaSource && PWA.reloadIsGuardedAndSingle(noIntentGuard) === false);

  const noLatch = pwaSource.replace('if (reloadingForUpdate) return;    // never a reload loop', '');
  ok('REJECTS a controllerchange reload without a one-shot latch',
    noLatch !== pwaSource && PWA.reloadIsGuardedAndSingle(noLatch) === false);

  const noOnceGuard = pwaSource.replace('if (controllerChangeBound) return;', '');
  ok('REJECTS a controllerchange listener bound without a once-guard',
    noOnceGuard !== pwaSource && PWA.bindsControllerChangeOnce(noOnceGuard) === false);

  const autoSkip = pwaSource.replace(
    '    swRegistration = reg;',
    "    swRegistration = reg;\n    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });"
  );
  ok('REJECTS a SKIP_WAITING sent automatically on registration',
    autoSkip !== pwaSource && PWA.postsSkipWaitingOnlyFromUserAction(autoSkip) === false);

  const reloadOnReconnect = pwaSource.replace(
    '    var p = swRegistration.update();',
    '    window.location.reload();\n    var p = swRegistration.update();'
  );
  ok('REJECTS a reconnect handler that reloads the page',
    reloadOnReconnect !== pwaSource && PWA.reconnectChecksForUpdateSafely(reloadOnReconnect) === false);

  // Anchored on `el.id = UPDATE_ID;` so the mutation lands in buildUpdatePrompt.
  // The identical setAttribute pair also appears earlier in getBanner, and a
  // bare string replace would have silently mutated THAT instead — leaving the
  // real prompt intact and the fixture falsely "accepting".
  const inaccessiblePrompt = pwaSource.replace(
    "el.id = UPDATE_ID;\n    el.setAttribute('role', 'status');\n    el.setAttribute('aria-live', 'polite');",
    'el.id = UPDATE_ID;'
  );
  ok('REJECTS an update prompt with no accessible live-region semantics',
    inaccessiblePrompt !== pwaSource && PWA.updatePromptIsAccessibleAndNonBlocking(inaccessiblePrompt) === false);

  const blockingBanner = pwaSource.replace("'pointer-events:none',", "'pointer-events:auto',");
  ok('REJECTS a connectivity banner that could block taps beneath it',
    blockingBanner !== pwaSource && PWA.statusBannerStaysNonBlocking(blockingBanner) === false);

  const withInnerHtml = pwaSource.replace('text.textContent =', 'text.innerHTML =');
  ok('REJECTS UI built with innerHTML',
    withInnerHtml !== pwaSource && PWA.buildsUiWithoutInnerHtml(withInnerHtml) === false);
}

/* ================= 6. OFFLINE SHELL: NEUTRALITY, A11Y, MOBILE =========== */

async function checkOfflineShell(base) {
  section('OFF.2 cases 10/11/15 — session-neutral offline shell, accessibility, mobile');

  const html = fs.readFileSync(SHELL_HTML_PATH, 'utf8');
  const css = fs.readFileSync(SHELL_CSS_PATH, 'utf8');
  const manager = fs.readFileSync(OFFLINE_MANAGER_PATH, 'utf8');
  const sharedCss = fs.readFileSync(path.join(ROOT, 'public', 'css', 'styles.css'), 'utf8');
  const sharedPanelImageRule = (sharedCss.match(/\.map-panel__img\s*\{([^}]*)\}/) || [])[1] || '';

  const res = await fetch(`${base}/offline.html`);
  const servedHtml = await res.text();
  ok('GET /offline.html -> 200', res.status === 200);
  ok('/offline.html served bytes match disk', servedHtml === html);
  ok('/offline.html sets no cookie', res.headers.get('set-cookie') === null);
  ok('/offline.html stays session-neutral (no no-store/private policy applied)',
    !/no-store|private/i.test(res.headers.get('cache-control') || ''));

  const cssRes = await fetch(`${base}/css/offline.css`);
  const servedCss = await cssRes.text();
  ok('GET /css/offline.css -> 200', cssRes.status === 200);
  ok('/css/offline.css served bytes match disk', servedCss === css);
  ok('/css/offline.css sets no cookie', cssRes.headers.get('set-cookie') === null);
  ok('/css/offline.css stays session-neutral',
    !/no-store|private/i.test(cssRes.headers.get('cache-control') || ''));

  // Neutrality: nothing personalized may ever appear in the shell.
  ok('the shell renders no session, user, role, or CSRF value', SHELL.isSessionNeutral(html));

  // The neutrality scan must actually reject. A scan that only ever accepts is
  // not evidence, so drive the REAL analyzer with a personalized shell.
  // Combined rejecting fixture: five distinct personalization leaks, each
  // driven through the REAL analyzer and each required to be rejected.
  ok('REJECTS a shell carrying an EJS interpolation, the session bootstrap global, a CSRF token, a personalized form field, or a literal email address', (() => {
    const leaks = [
      html.replace('<h1 id="offline-empty-title">Bring the campus map with you</h1>',
        '<h1 id="offline-empty-title">Hello <%= user.name %></h1>'),
      html.replace('</body>', '<div data-session="__SESSION_USER"></div></body>'),
      html.replace('</head>', '<meta name="csrf-token" content="abc"></head>'),
      html.replace('</body>', '<input name="email"></body>'),
      html.replace('<span class="dash-nav__username" data-offline-guide-download-label>Update Offline Map</span>',
        '<span class="dash-nav__username" data-offline-guide-download-label>Signed in as student@my.cspc.edu.ph</span>')
    ];
    return leaks.every((mutated) => mutated !== html) &&
      leaks.every((mutated) => SHELL.isSessionNeutral(mutated) === false);
  })());
  ok('ACCEPTS the neutral shell even when its own comment discusses sessions',
    SHELL.isSessionNeutral(html.replace('</head>',
      '<!-- session, user and role values are never rendered here --></head>')) === true);
  ok('the shell loads exactly the reviewed self-hosted renderer and manager scripts with no inline handler', (() => {
    const scripts = [...html.matchAll(/<script\s+src="([^"]+)"\s+defer><\/script>/g)].map((m) => m[1]);
    return JSON.stringify(scripts) === JSON.stringify([
      '/vendor/maplibre/maplibre-gl.js', '/vendor/pmtiles/pmtiles.js', '/js/offline-guide-manager.js'
    ]) && !/\son[a-z]+\s*=|javascript:/i.test(html);
  })());
  ok('the shell loads only same-origin assets',
    !/(src|href)\s*=\s*"(https?:)?\/\//i.test(html));

  // Accessibility basics.
  ok('the shell declares a document language', /<html lang="en">/.test(html));
  ok('the shell has one heading for each mutually exclusive empty/workspace state',
    countOccurrences(html, '<h1') === 2 && /id="offline-empty-title"/.test(html) &&
    /id="offlineGuideWorkspace" hidden/.test(html));
  ok('the offline status is announced politely via role="status"', /role="status"/.test(html));
  ok('the brand logo is named while decorative offline imagery is hidden from assistive technology',
    /<img src="\/img\/cspc-logo\.png" alt="CSPC Logo"/.test(html) &&
    /<img src="\/img\/Camarines-sur-polytechnic-colleges\.png" alt=""/.test(html));
  ok('the downloaded-building navigation carries an accessible name',
    /<nav class="[^"]*offline-building-list[^"]*"[^>]*aria-label="Downloaded buildings"/.test(html));
  ok('the shell defines a visible keyboard focus indicator',
    /button:focus-visible,[\s\S]{0,80}a:focus-visible[\s\S]{0,80}outline:/.test(css));

  // Mobile basics.
  ok('the shell declares a responsive viewport', /width=device-width/.test(html) && /viewport-fit=cover/.test(html));
  ok('every named offline action, including native fallback markers, has an exact 44px target and valid semantics',
    offlineTouchTargetProblems(css).length === 0 && offlineTouchTargetMutationsAreRejected(css) &&
    offlineMobileDetailsOverlapProblems(css, html).length === 0 &&
    offlineMobileDetailsOverlapMutationsAreRejected(css, html) &&
    offlineFallbackMarkerProblems(manager, html).length === 0 &&
    offlineFallbackMarkerMutationsAreRejected(manager, html));
  ok('the shell inherits the online full-bleed panel image and has the online map small-screen canvas and bottom-sheet layout',
    /@media\s*\(max-width:\s*768px\)/.test(css) &&
    /\.offline-workspace\s*\{\s*display:\s*block;\s*position:\s*relative;/.test(css) &&
    /transform:\s*translateY\(calc\(100% \+ 1rem\)\)/.test(css) &&
    /width:\s*100%/.test(sharedPanelImageRule) &&
    /height:\s*160px/.test(sharedPanelImageRule) &&
    /object-fit:\s*cover/.test(sharedPanelImageRule) &&
    !/\.offline-details\s+\.map-panel__img\s*\{/.test(css));
  ok('the shell cannot overflow horizontally on long words', /overflow-wrap:\s*anywhere/.test(css));
  ok('the shell pins the reviewed light/dark campus-map colour scheme',
    /<meta name="color-scheme" content="light dark">/.test(html) &&
    /body\.offline-page[\s\S]{0,120}background:\s*var\(--gray-50\)/.test(css) &&
    /\[data-theme="dark"\][\s\S]{0,160}background:\s*#111827/.test(css));

  ok('the shell truthfully limits offline scope to buildings/details/Main Gate routes and denies sensitive/media data',
    /buildings, building details, and Main Gate routes/.test(html) &&
    /no account, session, schedule, admin, photo, or 360 data/i.test(html));

  // Every internal link the shell offers must be a real route.
  const hrefs = (html.match(/href="(\/[^"]*)"/g) || []).map((h) => h.slice(6, -1));
  const pageLinks = hrefs.filter((h) => !/\.(css|png|webmanifest)$/.test(h));
  let allResolve = pageLinks.length > 0;
  for (const link of pageLinks) {
    const r = await fetch(base + link, { redirect: 'manual' });
    await r.text().catch(() => undefined);
    // 200 (public) or 302 -> /auth (login-gated) both prove a real, live route.
    if (!(r.status === 200 || r.status === 302)) allResolve = false;
  }
  ok(`every shell link targets a live route (${pageLinks.length} links)`, allResolve);
}

/* ------------------------------------------------------------------ main */

async function main() {
  console.log('OFF.2 focused probe — installability, offline shell, update lifecycle');
  console.log('Anonymous, read-only, no sign-in, no database, no /auth request.');

  const swSource = fs.readFileSync(SW_PATH, 'utf8');
  const pwaSource = fs.readFileSync(PWA_PATH, 'utf8');

  // ---- layers that need no server ----
  checkServiceWorkerStructure(swSource);
  checkServiceWorkerFixtures(swSource);
  await checkInterruptedInstall(swSource);
  await checkInstallRecoveryAndWaiting(swSource);
  await checkExplicitActivation(swSource);
  await checkVersionedCleanup(swSource);
  await checkFetchBoundaries(swSource);
  checkPwaClient(pwaSource);

  // ---- HTTP layer (bounded, self-terminating harness) ----
  const free = await portIsFree(PORT);
  if (!free) {
    throw new Error(`dedicated port ${PORT} is occupied; the probe refuses to start and kills nothing.`);
  }

  await withServer({ mode: 'mysql', port: PORT, sessionStore: 'memory' }, async (base) => {
    await checkManifest(base);
    await checkServiceWorkerDelivery(base, swSource);
    await checkOfflineShell(base);
  });

  console.log('');
  if (failures.length === 0) {
    console.log(`OFF2-PWA-LIFECYCLE-PROBE OK: ${checks}/${checks} checks passed.`);
  } else {
    console.error(`OFF2-PWA-LIFECYCLE-PROBE FAILED: ${failures.length}/${checks} check(s) did not pass:`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('OFF2-PWA-LIFECYCLE-PROBE FAILED:',
      error && error.message ? error.message : 'sanitized failure');
    process.exitCode = 1;
  });
}

module.exports = {
  PORT,
  SW,
  PWA,
  SHELL,
  stripComments,
  extractFunction,
  extractListener,
  loadServiceWorker,
  makeFakeCacheStorage,
  makeLifecycleEvent,
  makeFetchEvent,
  offlineFallbackMarkerProblems,
  offlineFallbackMarkerMutationsAreRejected,
  offlineMobileDetailsOverlapProblems,
  offlineMobileDetailsOverlapMutationsAreRejected
};
