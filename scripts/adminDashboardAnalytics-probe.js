'use strict';

/* ============================================================================
   M12.P1-D6 focused probe — Real Admin Dashboard Analytics.

   TWO MODES
   ---------
   normal        (default, and the mode the registered suite spawns)
                 Runs every static/pure section AND requires BOTH live backend
                 comparison legs — MySQL and Supabase. A leg that is not
                 configured, not reachable, or skipped is a FAILURE: it records
                 no PASS, the probe exits nonzero, and the success marker
                 ADMIN-DASHBOARD-ANALYTICS-PROBE OK is not printed. There is no
                 environment variable that can soften this; PROBE_SKIP_SUPABASE
                 is treated as a rejected skip request, not as permission.

   --static-only Runs ONLY the pure and static sections. It initializes NO
                 database: `config/db` is replaced in the module cache with a
                 poisoned stub before anything can require it, so no MySQL pool
                 object is ever constructed, and no Supabase client is created.
                 It prints the distinct marker D6-STATIC-ONLY-PROBE OK and can
                 NEVER print the normal success marker. It exists for bounded
                 static verification only and is not what the quality gate or
                 the registered suite invokes.

   Safety in both modes:
     - It authenticates NOBODY. It never requires scripts/regressionCredentials,
       never issues a /login request, never creates or terminates a session, and
       therefore owns no session lifecycle.
     - It starts no server and opens no listener.
     - Its only database traffic is the normal-mode comparison section, which is
       SELECT-only. It issues no INSERT/UPDATE/DELETE/DDL/RPC, applies no
       migration, and writes nothing anywhere.

   Sections
     1. Asia/Manila month arithmetic (pure)
     2. Bucketing and boundary semantics (pure)
     3. Exact count parsing and strict role acceptance (pure)
     4. Model composition over mocked adapters, fail-closed (pure)
     5. Static truthfulness of the shipped source
     6. Admin dashboard rendering (real EJS, three states)
     7. Non-admin denial leaks no analytics (real middleware, mocked req/res)
     8. Client chart module against a mock DOM (resize + theme redraw)
     9. Chart colour contrast and non-colour pattern encoding
    10. Deterministic Supabase pagination (injected fake client)
    11. Backend comparison disposition (pure, fail-closed)
    12. Independent comparison against BOTH required backends (normal mode only)
   ==========================================================================*/

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/* ---------------------------------------------------------------------------
   Mode selection, and the static-only database lockout
   -------------------------------------------------------------------------*/
const MODE_NORMAL = 'normal';
const MODE_STATIC_ONLY = 'static-only';
const MODE = process.argv.includes('--static-only') ? MODE_STATIC_ONLY : MODE_NORMAL;

const NORMAL_SUCCESS_MARKER = 'ADMIN-DASHBOARD-ANALYTICS-PROBE OK';
const NORMAL_FAILURE_MARKER = 'ADMIN-DASHBOARD-ANALYTICS-PROBE FAILED';
const STATIC_ONLY_SUCCESS_MARKER = 'D6-STATIC-ONLY-PROBE OK';
const STATIC_ONLY_FAILURE_MARKER = 'D6-STATIC-ONLY-PROBE FAILED';

let mysqlPoolWasPoisoned = false;
if (MODE === MODE_STATIC_ONLY) {
  /* Replace config/db in the module cache BEFORE any transitive require can
     load the real one. services/auditService.js (reached through
     middleware/roleAuth.js in section 7) requires it at module scope, and the
     real module calls mysql.createPool() on load. With this stub in place the
     static-only run constructs no pool at all, and any accidental query throws
     instead of silently opening a connection. */
  const Module = require('module');
  const dbPath = require.resolve('../config/db');
  const poisoned = {
    query() { throw new Error('static-only mode: the MySQL pool must not be used'); },
    execute() { throw new Error('static-only mode: the MySQL pool must not be used'); },
    getConnection() { throw new Error('static-only mode: the MySQL pool must not be used'); },
    end() { throw new Error('static-only mode: the MySQL pool must not be used'); },
    __staticOnlyStub: true,
  };
  const stub = new Module(dbPath, null);
  stub.filename = dbPath;
  stub.loaded = true;
  stub.exports = poisoned;
  require.cache[dbPath] = stub;
  mysqlPoolWasPoisoned = true;
}

const analytics = require('../services/adminAnalyticsService');
const analyticsRepository = require('../repositories/analyticsRepository');
const charts = require('../public/js/admin/dashboard-analytics.js');

const auditService = require('../services/auditService');
const roleAuth = require('../middleware/roleAuth');

/* Section 7 drives the REAL authorization middleware, whose authenticated
   wrong-role branch dispatches one best-effort audit write. This probe must
   mutate nothing, so the audit sink is swapped for an in-memory recorder.
   middleware/roleAuth.js holds a reference to the MODULE, not to the function,
   so replacing the property at call time is sufficient — and doing it inside
   the section rather than at import time keeps merely REQUIRING this file free
   of side effects, so the quality gate can read its pure helpers safely. */
const capturedAuditEvents = [];
let realAuditRecord = null;
function installAuditRecorder() {
  if (realAuditRecord === null) realAuditRecord = auditService.record;
  auditService.record = async (event) => { capturedAuditEvents.push(event); return true; };
}
function restoreAuditRecorder() {
  if (realAuditRecord !== null) auditService.record = realAuditRecord;
}

let checks = 0;
const failures = [];

function ok(label, value) {
  checks += 1;
  const passed = value === true;
  console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${label}`);
  if (!passed) failures.push(label);
}

function note(text) {
  console.log(`  NOTE ${text}`);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/** PURE: drop JS comments so a detector cannot match the file's own prose. */
function stripJsComments(source) {
  return String(source)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** PURE: drop EJS and HTML comments from a template. */
function stripViewComments(source) {
  return String(source)
    .replace(/<%#[\s\S]*?%>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

/* Independent Asia/Manila arithmetic. Deliberately NOT imported from the
   service: it is re-derived here so a wrong offset or a wrong month boundary in
   the service cannot agree with itself. */
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
function probeMonthStartMs(year, month) {
  return Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - MANILA_OFFSET_MS;
}
function probeManilaParts(ms) {
  const shifted = new Date(ms + MANILA_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
}
function probeWindows(nowMs, count) {
  const current = probeManilaParts(nowMs);
  const out = [];
  for (let back = count - 1; back >= 0; back -= 1) {
    const startMs = probeMonthStartMs(current.year, current.month - back);
    const endMs = probeMonthStartMs(current.year, current.month - back + 1);
    const parts = probeManilaParts(startMs);
    out.push({ startMs, endMs, year: parts.year, month: parts.month });
  }
  return out;
}

/* ---------------------------------------------------------------------------
   Backend comparison disposition — PURE, and the reason the normal mode is
   fail-closed. Exported so a static harness can prove every branch.
   -------------------------------------------------------------------------*/

/**
 * PURE: what must happen to one backend comparison leg?
 *
 * In NORMAL mode both supported backends are REQUIRED. Anything that would
 * prevent a required leg from running — an explicit skip request, missing
 * configuration, or unreachability — is a REJECTION that must fail the probe,
 * never a quiet omission that still looks green.
 *
 * @param {{mode:string, backend:string, configured?:boolean, reachable?:boolean, skipRequested?:boolean}} input
 * @returns {{backend:string, action:'execute'|'reject'|'omit', reason:string}}
 */
function resolveBackendDisposition(input) {
  const spec = input || {};
  const backend = String(spec.backend || '');
  if (spec.mode !== MODE_NORMAL) {
    return { backend, action: 'omit', reason: 'static-only mode performs no live comparison' };
  }
  if (spec.skipRequested === true) {
    return { backend, action: 'reject', reason: 'a skip was requested for a required backend comparison' };
  }
  if (spec.configured !== true) {
    return { backend, action: 'reject', reason: 'a required backend is not configured' };
  }
  if (spec.reachable !== true) {
    return { backend, action: 'reject', reason: 'a required backend is not reachable' };
  }
  return { backend, action: 'execute', reason: 'the required backend is configured and reachable' };
}

/**
 * PURE: may the NORMAL success marker be printed?
 *
 * Only when BOTH supported backends produced an `execute` disposition AND
 * actually executed. A leg that was rejected, omitted, or planned but never run
 * makes the normal run ineligible for success.
 *
 * @param {Array<{backend:string, action:string, executed:boolean}>} legs
 */
function normalSuccessAllowed(legs) {
  if (!Array.isArray(legs) || legs.length !== 2) return false;
  const names = legs.map((leg) => (leg && leg.backend) || '').slice().sort();
  if (names[0] !== 'mysql' || names[1] !== 'supabase') return false;
  return legs.every((leg) => leg && leg.action === 'execute' && leg.executed === true);
}

/* ---------------------------------------------------------------------------
   Colour contrast — WCAG 2.x relative luminance, computed here rather than
   trusted from a comment.
   -------------------------------------------------------------------------*/
function hexToRgb(hex) {
  const value = String(hex).trim().replace('#', '');
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
}
function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return (light + 0.05) / (dark + 0.05);
}

/* ---------------------------------------------------------------------------
   1. Asia/Manila month arithmetic
   -------------------------------------------------------------------------*/
function runMonthArithmetic() {
  console.log('[1] Asia/Manila calendar month arithmetic');

  ok('the reported timezone is exactly Asia/Manila', analytics.TIMEZONE === 'Asia/Manila');
  ok('the Manila offset is a fixed UTC+08:00 (480 minutes, no DST)',
    analytics.MANILA_UTC_OFFSET_MINUTES === 480);

  const earlyManila = Date.UTC(2026, 7, 13, 16, 30, 0);
  const parts = analytics.manilaCalendarParts(earlyManila);
  ok('an instant that is already "tomorrow" in Manila resolves to the Manila month',
    parts.year === 2026 && parts.month === 8 &&
    new Date(earlyManila).getUTCDate() === 13);

  const lateUtc = Date.UTC(2025, 11, 31, 20, 0, 0); // 2026-01-01 04:00 Manila
  const rolled = analytics.manilaCalendarParts(lateUtc);
  ok('a late-UTC instant that is next year in Manila rolls the year forward',
    rolled.year === 2026 && rolled.month === 1);

  const windows = analytics.buildMonthWindows(new Date(Date.UTC(2026, 7, 14, 4, 0, 0)));
  ok('exactly 12 month windows are produced', windows.length === 12);
  ok('windows are ordered oldest to newest with no repeats',
    windows.every((w, i) => i === 0 || w.startMs > windows[i - 1].startMs));
  ok('adjacent windows tile exactly (end of one is the start of the next)',
    windows.every((w, i) => i === 0 || w.startMs === windows[i - 1].endMs));
  ok('the final window is the Manila month containing "now"',
    windows[11].year === 2026 && windows[11].month === 8);
  ok('the first window is 11 Manila months earlier',
    windows[0].year === 2025 && windows[0].month === 9);
  ok('every window matches independently recomputed Manila boundaries',
    (() => {
      const expected = probeWindows(Date.UTC(2026, 7, 14, 4, 0, 0), 12);
      return windows.every((w, i) =>
        w.startMs === expected[i].startMs && w.endMs === expected[i].endMs);
    })());
  ok('keys are YYYY-MM and labels are "Mon YYYY"',
    windows.every((w) => /^\d{4}-(0[1-9]|1[0-2])$/.test(w.key)) &&
    windows[11].key === '2026-08' && windows[11].label === 'Aug 2026' &&
    windows[0].key === '2025-09' && windows[0].label === 'Sep 2025');

  const january = analytics.buildMonthWindows(new Date(Date.UTC(2026, 0, 15, 4, 0, 0)));
  ok('year rollover: a January window set spans Feb of the previous year to Jan',
    january.length === 12 &&
    january[0].key === '2025-02' && january[11].key === '2026-01' &&
    january.every((w, i) => i === 0 || w.startMs === january[i - 1].endMs));

  const leap = analytics.buildMonthWindows(new Date(Date.UTC(2024, 1, 20, 4, 0, 0)));
  const feb2024 = leap[11];
  const dayMs = 24 * 60 * 60 * 1000;
  ok('leap-year February 2024 spans exactly 29 days',
    feb2024.key === '2024-02' && (feb2024.endMs - feb2024.startMs) === 29 * dayMs);
  const nonLeap = analytics.buildMonthWindows(new Date(Date.UTC(2025, 1, 20, 4, 0, 0)));
  ok('non-leap February 2025 spans exactly 28 days',
    nonLeap[11].key === '2025-02' && (nonLeap[11].endMs - nonLeap[11].startMs) === 28 * dayMs);
  ok('a leap window set still tiles exactly across the leap boundary',
    leap.every((w, i) => i === 0 || w.startMs === leap[i - 1].endMs));

  ok('60 consecutive month origins each produce 12 exactly-tiling windows',
    (() => {
      for (let m = 0; m < 60; m += 1) {
        const set = analytics.buildMonthWindows(Date.UTC(2022, m, 10, 4, 0, 0));
        if (set.length !== 12) return false;
        for (let i = 1; i < set.length; i += 1) {
          if (set[i].startMs !== set[i - 1].endMs) return false;
        }
      }
      return true;
    })());

  ok('an invalid Date throws instead of silently substituting a clock',
    (() => { try { analytics.buildMonthWindows(new Date('nope')); return false; } catch (e) { return true; } })());
  ok('a non-instant value throws', (() => {
    for (const bad of [null, '', {}, [], NaN, 'not-a-date']) {
      try { analytics.buildMonthWindows(bad); return false; } catch (e) { /* expected */ }
    }
    return true;
  })());
  ok('a non-positive month count throws',
    (() => { try { analytics.buildMonthWindows(Date.now(), 0); return false; } catch (e) { return true; } })());
}

/* ---------------------------------------------------------------------------
   2. Bucketing and boundary semantics
   -------------------------------------------------------------------------*/
function runBucketing() {
  console.log('[2] Half-open month bucketing and boundary semantics');

  const windows = analytics.buildMonthWindows(Date.UTC(2026, 7, 14, 4, 0, 0));
  const first = windows[0];
  const last = windows[11];

  ok('a row exactly on a window START is INCLUDED by that window',
    (() => {
      const r = analytics.bucketByMonth([last.startMs], windows);
      return r.counts[11] === 1 && r.counts[10] === 0 && r.invalid === 0 && r.outside === 0;
    })());

  ok('a row exactly on a window END is EXCLUDED from that window',
    (() => {
      const r = analytics.bucketByMonth([windows[10].endMs], windows);
      return r.counts[10] === 0 && r.counts[11] === 1;
    })());

  ok('a boundary row is counted exactly once across all 12 windows',
    (() => {
      const r = analytics.bucketByMonth([windows[5].endMs], windows);
      return r.counts.reduce((s, n) => s + n, 0) === 1 && r.counts[6] === 1;
    })());

  ok('one millisecond before a window start belongs to the previous window',
    (() => {
      const r = analytics.bucketByMonth([windows[7].startMs - 1], windows);
      return r.counts[6] === 1 && r.counts[7] === 0;
    })());

  ok('a row on the FINAL window end is reported OUTSIDE the requested period',
    (() => {
      const r = analytics.bucketByMonth([last.endMs], windows);
      return r.counts.every((n) => n === 0) && r.outside === 1 && r.invalid === 0;
    })());

  ok('a row before the FIRST window start is outside, not folded into month 1',
    (() => {
      const r = analytics.bucketByMonth([first.startMs - 1], windows);
      return r.counts.every((n) => n === 0) && r.outside === 1;
    })());

  ok('ISO strings and Date objects bucket identically to epoch numbers',
    (() => {
      const target = windows[4].startMs + 1000;
      const a = analytics.bucketByMonth([target], windows).counts;
      const b = analytics.bucketByMonth([new Date(target)], windows).counts;
      const c = analytics.bucketByMonth([new Date(target).toISOString()], windows).counts;
      return a.join() === b.join() && b.join() === c.join() && a[4] === 1;
    })());

  ok('invalid timestamps are REPORTED as invalid rather than dropped',
    (() => {
      const r = analytics.bucketByMonth(['not-a-date', null, undefined, NaN, {}], windows);
      return r.invalid === 5 && r.counts.every((n) => n === 0) && r.outside === 0;
    })());

  ok('a mixed batch keeps valid counts and still reports the invalid ones',
    (() => {
      const r = analytics.bucketByMonth([windows[2].startMs, 'bad', windows[2].endMs], windows);
      return r.counts[2] === 1 && r.counts[3] === 1 && r.invalid === 1;
    })());

  ok('an empty batch is a genuine all-zero result, not an error',
    (() => {
      const r = analytics.bucketByMonth([], windows);
      return r.counts.length === 12 && r.counts.every((n) => n === 0) &&
        r.invalid === 0 && r.outside === 0;
    })());

  // The usability predicate is what turns those reports into a fail-closed
  // decision, so it is asserted directly.
  ok('a clean bucket result is usable',
    analytics.bucketResultIsUsable(analytics.bucketByMonth([windows[1].startMs], windows)) === true);
  ok('a bucket result carrying ANY invalid timestamp is rejected',
    analytics.bucketResultIsUsable(analytics.bucketByMonth(['bad'], windows)) === false);
  ok('a bucket result carrying ANY out-of-window row is rejected',
    analytics.bucketResultIsUsable(analytics.bucketByMonth([last.endMs], windows)) === false &&
    analytics.bucketResultIsUsable(analytics.bucketByMonth([first.startMs - 1], windows)) === false);
  ok('a malformed bucket result is rejected',
    analytics.bucketResultIsUsable(null) === false &&
    analytics.bucketResultIsUsable({ counts: null, invalid: 0, outside: 0 }) === false);
}

/* ---------------------------------------------------------------------------
   3. Exact count parsing and strict role acceptance
   -------------------------------------------------------------------------*/
function runStrictCounts() {
  console.log('[3] Exact count parsing and strict four-role acceptance');

  const parse = analyticsRepository.parseExactCount;

  ok('the service and the repository share ONE exact count parser',
    typeof parse === 'function' && analytics.parseExactCount === parse);

  ok('nonnegative safe-integer numbers are accepted exactly',
    parse(0) === 0 && parse(1) === 1 && parse(21) === 21 &&
    parse(Number.MAX_SAFE_INTEGER) === Number.MAX_SAFE_INTEGER);
  ok('digit-only nonnegative integer strings are accepted exactly',
    parse('0') === 0 && parse('21') === 21 &&
    parse(String(Number.MAX_SAFE_INTEGER)) === Number.MAX_SAFE_INTEGER);

  const rejected = [
    ['null', null], ['undefined', undefined],
    ['true', true], ['false', false],
    ['empty string', ''], ['blank string', '   '],
    ['negative number', -1], ['negative string', '-1'],
    ['fraction', 1.5], ['fraction string', '1.5'],
    ['NaN', NaN], ['Infinity', Infinity], ['-Infinity', -Infinity],
    ['arbitrary string', 'twelve'], ['exponent string', '1e3'],
    ['hex string', '0x10'], ['padded string', ' 12 '],
    ['unsafe integer', Number.MAX_SAFE_INTEGER + 1],
    ['unsafe integer string', String(Number.MAX_SAFE_INTEGER + 2)],
    ['object', {}], ['array', [1]], ['array of one', [1]],
  ];
  for (const [label, value] of rejected) {
    ok(`the exact count parser rejects ${label}`, parse(value) === null);
  }
  ok('the exact count parser never substitutes 0 for a rejected value',
    rejected.every(([, value]) => parse(value) !== 0));

  // ---- strict role-map acceptance ----
  const good = { 'student-cspc': 12, instructor: 4, admin: 2, guest: 3 };
  const parsedGood = analytics.parseRoleCounts(good);
  ok('an exact four-role map is accepted unchanged',
    parsedGood !== null && Object.keys(parsedGood).length === 4 &&
    parsedGood['student-cspc'] === 12 && parsedGood.instructor === 4 &&
    parsedGood.admin === 2 && parsedGood.guest === 3);
  ok('an explicit all-zero four-role map is accepted as a genuine zero',
    (() => {
      const zero = analytics.parseRoleCounts({ 'student-cspc': 0, instructor: 0, admin: 0, guest: 0 });
      return zero !== null && analytics.ROLE_KEYS.every((r) => zero[r] === 0);
    })());

  const roleRejections = [
    ['a MISSING role key', { 'student-cspc': 1, instructor: 1, admin: 1 }],
    ['an ADDITIONAL role key', { 'student-cspc': 1, instructor: 1, admin: 1, guest: 1, 'student-guest': 1 }],
    ['a renamed role key', { 'student-cspc': 1, instructor: 1, admin: 1, visitor: 1 }],
    ['a NEGATIVE count', { 'student-cspc': -1, instructor: 1, admin: 1, guest: 1 }],
    ['a FRACTIONAL count', { 'student-cspc': 1.5, instructor: 1, admin: 1, guest: 1 }],
    ['a NON-NUMERIC count', { 'student-cspc': 'x', instructor: 1, admin: 1, guest: 1 }],
    ['a null count', { 'student-cspc': null, instructor: 1, admin: 1, guest: 1 }],
    ['a boolean count', { 'student-cspc': true, instructor: 1, admin: 1, guest: 1 }],
    ['an UNSAFE integer count', { 'student-cspc': Number.MAX_SAFE_INTEGER + 1, instructor: 1, admin: 1, guest: 1 }],
    ['a non-object', 'nope'],
    ['null', null],
    ['an array', []],
  ];
  for (const [label, value] of roleRejections) {
    ok(`the strict role parser rejects ${label}`, analytics.parseRoleCounts(value) === null);
  }
  ok('a rejected role map never becomes a map of zeroes',
    roleRejections.every(([, value]) => analytics.parseRoleCounts(value) === null));

  // ---- the sum invariant ----
  ok('four role counts that sum to the total are accepted',
    analytics.roleCountsMatchTotal(parsedGood, 21) === true);
  ok('a role/total MISMATCH is rejected in both directions',
    analytics.roleCountsMatchTotal(parsedGood, 20) === false &&
    analytics.roleCountsMatchTotal(parsedGood, 22) === false);
  ok('an all-zero role map matches a zero total',
    analytics.roleCountsMatchTotal({ 'student-cspc': 0, instructor: 0, admin: 0, guest: 0 }, 0) === true);
  ok('a null role map or an unsafe total is rejected',
    analytics.roleCountsMatchTotal(null, 0) === false &&
    analytics.roleCountsMatchTotal(parsedGood, Number.MAX_SAFE_INTEGER + 1) === false &&
    analytics.roleCountsMatchTotal(parsedGood, 21.5) === false);

  ok('the repository pins the same four roles independently of the service',
    analyticsRepository.ANALYTICS_ROLE_KEYS.length === 4 &&
    analyticsRepository.ANALYTICS_ROLE_KEYS.join(',') === analytics.ROLE_KEYS.join(',') &&
    analytics.ROLE_KEYS.join(',') === 'student-cspc,instructor,admin,guest');

  ok('role rows carry a stable label for each of the four roles',
    (() => {
      const rows = analytics.buildRoleRows(parsedGood);
      return rows.length === 4 &&
        rows.map((r) => r.role).join(',') === 'student-cspc,instructor,admin,guest' &&
        rows.every((r) => typeof r.label === 'string' && r.label.length > 0);
    })());

  // ---- no permissive coercion survives in the D6 path ----
  ok('no `Number(...) || 0` coercion remains in the D6 repository or service',
    (() => {
      const repo = stripJsComments(read('repositories/analyticsRepository.js'));
      const service = stripJsComments(read('services/adminAnalyticsService.js'));
      const permissive = /Number\s*\([^)]*\)\s*\|\|\s*0/;
      return !permissive.test(repo) && !permissive.test(service);
    })());
  ok('the repository rejects an unreported role rather than discarding it',
    /an unreported role was returned/.test(read('repositories/analyticsRepository.js')));
  ok('every repository count goes through the exact parser',
    (() => {
      const repo = stripJsComments(read('repositories/analyticsRepository.js'));
      return (repo.match(/parseExactCount\(/g) || []).length >= 4;
    })());
}

/* ---------------------------------------------------------------------------
   4. Composition over mocked adapters (fail-closed)
   -------------------------------------------------------------------------*/

/** A mock repository whose behaviour per entity is caller-controlled. */
function mockRepository(spec) {
  const calls = { userWindow: 0, buildingWindow: 0 };
  const roleCounts = spec.roleCounts || { 'student-cspc': 0, instructor: 0, admin: 0, guest: 0 };
  let derivedTotal = 0;
  for (const key of Object.keys(roleCounts)) {
    if (typeof roleCounts[key] === 'number' && Number.isFinite(roleCounts[key])) {
      derivedTotal += roleCounts[key];
    }
  }
  const userTotalValue = spec.userTotalValue === undefined ? derivedTotal : spec.userTotalValue;
  const buildingTotalValue = spec.buildingTotalValue === undefined ? 0 : spec.buildingTotalValue;

  return {
    calls,
    MAX_WINDOW_ROWS: 20000,
    readUserAdditionTimestamps: async (range) => {
      calls.userWindow += 1;
      if (spec.users === 'throw') throw new Error('users read failed at db.internal');
      if (spec.users === 'capped') return { timestampsMs: [range.startMs], capped: true };
      if (spec.users === 'invalid') return { timestampsMs: ['garbage'], capped: false };
      if (spec.users === 'outside') return { timestampsMs: [range.endMs], capped: false };
      return { timestampsMs: spec.userTimestamps || [], capped: false };
    },
    readBuildingAdditionTimestamps: async (range) => {
      calls.buildingWindow += 1;
      if (spec.buildings === 'throw') throw new Error('buildings read failed at db.internal');
      if (spec.buildings === 'capped') return { timestampsMs: [range.startMs], capped: true };
      if (spec.buildings === 'outside') return { timestampsMs: [range.endMs], capped: false };
      return { timestampsMs: spec.buildingTimestamps || [], capped: false };
    },
    countUsersByRole: async () => {
      if (spec.roles === 'throw') throw new Error('roles read failed at db.internal');
      return roleCounts;
    },
    countUsersTotal: async () => {
      if (spec.userTotal === 'throw') throw new Error('total read failed at db.internal');
      return userTotalValue;
    },
    countBuildingsTotal: async () => {
      if (spec.buildingTotal === 'throw') throw new Error('building total failed at db.internal');
      return buildingTotalValue;
    },
  };
}

const NOW = Date.UTC(2026, 7, 14, 4, 0, 0);

async function runComposition() {
  console.log('[4] Model composition over mocked adapters, fail-closed');

  const windows = analytics.buildMonthWindows(NOW);

  const ready = await analytics.loadAdminDashboardAnalytics({
    now: NOW,
    repository: mockRepository({
      userTimestamps: [windows[11].startMs, windows[11].startMs + 5000, windows[3].startMs + 10],
      buildingTimestamps: [windows[0].startMs, windows[10].endMs],
      roleCounts: { 'student-cspc': 12, instructor: 4, admin: 2, guest: 3 },
      userTotalValue: 21,
      buildingTotalValue: 25,
    }),
  });

  ok('a ready model reports state "ready" with no message',
    ready.state === 'ready' && ready.message === null && ready.isZero === false);
  ok('a ready model carries exactly 12 ordered months with both series',
    ready.months.length === 12 &&
    ready.months.every((m, i) => m.key === windows[i].key && m.label === windows[i].label) &&
    ready.months.every((m) => typeof m.userAdditions === 'number' && typeof m.buildingAdditions === 'number'));
  ok('account additions land in the correct months',
    ready.months[11].userAdditions === 2 && ready.months[3].userAdditions === 1 &&
    ready.months.reduce((s, m) => s + m.userAdditions, 0) === 3);
  ok('a building row on a month end is counted by the FOLLOWING month only',
    ready.months[0].buildingAdditions === 1 && ready.months[10].buildingAdditions === 0 &&
    ready.months[11].buildingAdditions === 1);
  ok('totals and role counts are the exact backend values',
    ready.totals.users === 21 && ready.totals.buildings === 25 &&
    ready.roleCounts['student-cspc'] === 12 && ready.roleCounts.instructor === 4 &&
    ready.roleCounts.admin === 2 && ready.roleCounts.guest === 3);
  ok('the model names Asia/Manila and exposes exactly the four role keys',
    ready.timezone === 'Asia/Manila' && ready.roleKeys.join(',') === 'student-cspc,instructor,admin,guest');

  const zero = await analytics.loadAdminDashboardAnalytics({
    now: NOW, repository: mockRepository({ userTotalValue: 0, buildingTotalValue: 0 }),
  });
  ok('a genuine empty backend reports zeroes, state ready, and isZero true',
    zero.state === 'ready' && zero.isZero === true && zero.message === null &&
    zero.months.length === 12 &&
    zero.months.every((m) => m.userAdditions === 0 && m.buildingAdditions === 0) &&
    zero.totals.users === 0 && zero.totals.buildings === 0 &&
    analytics.ROLE_KEYS.every((r) => zero.roleCounts[r] === 0));

  const broken = await analytics.loadAdminDashboardAnalytics({
    now: NOW,
    repository: mockRepository({
      users: 'throw', buildings: 'throw', roles: 'throw',
      userTotal: 'throw', buildingTotal: 'throw',
    }),
  });
  ok('a total backend failure reports state "unavailable"',
    broken.state === 'unavailable' && broken.isZero === false);
  ok('a failed read yields NULL values, never fabricated zeroes',
    broken.months.length === 12 &&
    broken.months.every((m) => m.userAdditions === null && m.buildingAdditions === null) &&
    broken.totals.users === null && broken.totals.buildings === null &&
    analytics.ROLE_KEYS.every((r) => broken.roleCounts[r] === null));
  ok('the unavailable message is the single fixed sanitized string',
    broken.message === analytics.UNAVAILABLE_MESSAGE &&
    broken.message === 'Analytics data is unavailable right now.');
  ok('no raw error, host, credential, SQL, or stack reaches the model',
    !/db\.internal|SECRET|failed at|Error:|\bat \/|SELECT |supabase|postgres|mysql/i
      .test(JSON.stringify(broken)));

  const partial = await analytics.loadAdminDashboardAnalytics({
    now: NOW,
    repository: mockRepository({
      users: 'throw', roles: 'throw', userTotal: 'throw',
      buildingTimestamps: [windows[9].startMs], buildingTotalValue: 25,
    }),
  });
  ok('a one-sided failure reports state "partial" with per-series status',
    partial.state === 'partial' &&
    partial.status.users === 'unavailable' && partial.status.buildings === 'ready');
  ok('the failed series is null while the healthy series keeps real numbers',
    partial.months.every((m) => m.userAdditions === null) &&
    partial.months[9].buildingAdditions === 1 && partial.totals.buildings === 25 &&
    partial.totals.users === null && partial.isZero === false);

  /* ---- every malformed-count path must make its side unavailable ---- */
  const malformed = [
    ['a MISSING role key', { roleCounts: { 'student-cspc': 1, instructor: 1, admin: 1 }, userTotalValue: 3 }],
    ['an ADDITIONAL role key', { roleCounts: { 'student-cspc': 1, instructor: 1, admin: 1, guest: 1, 'student-guest': 2 }, userTotalValue: 6 }],
    ['a NEGATIVE role count', { roleCounts: { 'student-cspc': -1, instructor: 1, admin: 1, guest: 1 }, userTotalValue: 2 }],
    ['a FRACTIONAL role count', { roleCounts: { 'student-cspc': 1.5, instructor: 1, admin: 1, guest: 1 }, userTotalValue: 5 }],
    ['a NON-NUMERIC role count', { roleCounts: { 'student-cspc': 'x', instructor: 1, admin: 1, guest: 1 }, userTotalValue: 4 }],
    ['an UNSAFE role count', { roleCounts: { 'student-cspc': Number.MAX_SAFE_INTEGER + 1, instructor: 0, admin: 0, guest: 0 }, userTotalValue: 1 }],
    ['an INVALID user total', { roleCounts: { 'student-cspc': 1, instructor: 1, admin: 1, guest: 1 }, userTotalValue: -4 }],
    ['a role/total MISMATCH', { roleCounts: { 'student-cspc': 1, instructor: 1, admin: 1, guest: 1 }, userTotalValue: 99 }],
  ];
  for (const [label, spec] of malformed) {
    const model = await analytics.loadAdminDashboardAnalytics({
      now: NOW, repository: mockRepository(Object.assign({ buildingTotalValue: 5 }, spec)),
    });
    ok(`${label} makes the users side unavailable with NULL values, not zeroes`,
      model.status.users === 'unavailable' &&
      model.state !== 'ready' &&
      model.totals.users === null &&
      model.months.every((m) => m.userAdditions === null) &&
      analytics.ROLE_KEYS.every((r) => model.roleCounts[r] === null));
  }

  const badBuildingTotal = await analytics.loadAdminDashboardAnalytics({
    now: NOW,
    repository: mockRepository({
      roleCounts: { 'student-cspc': 1, instructor: 0, admin: 0, guest: 0 },
      userTotalValue: 1, buildingTotalValue: 'many',
    }),
  });
  ok('an INVALID building total makes the buildings side unavailable',
    badBuildingTotal.status.buildings === 'unavailable' &&
    badBuildingTotal.totals.buildings === null &&
    badBuildingTotal.months.every((m) => m.buildingAdditions === null) &&
    badBuildingTotal.state !== 'ready');

  const capped = await analytics.loadAdminDashboardAnalytics({
    now: NOW, repository: mockRepository({ users: 'capped', buildingTotalValue: 3 }),
  });
  ok('a capped (possibly truncated) window read is reported unavailable, not low',
    capped.status.users === 'unavailable' &&
    capped.months.every((m) => m.userAdditions === null) && capped.state !== 'ready');

  const invalid = await analytics.loadAdminDashboardAnalytics({
    now: NOW, repository: mockRepository({ users: 'invalid' }),
  });
  ok('an invalid stored timestamp makes the series unavailable, not under-counted',
    invalid.status.users === 'unavailable' &&
    invalid.months.every((m) => m.userAdditions === null) && invalid.state !== 'ready');

  const outside = await analytics.loadAdminDashboardAnalytics({
    now: NOW, repository: mockRepository({ users: 'outside' }),
  });
  ok('a timestamp OUTSIDE the requested half-open window makes the series unavailable',
    outside.status.users === 'unavailable' &&
    outside.months.every((m) => m.userAdditions === null) && outside.state !== 'ready');

  const outsideBuildings = await analytics.loadAdminDashboardAnalytics({
    now: NOW,
    repository: mockRepository({
      buildings: 'outside',
      roleCounts: { 'student-cspc': 1, instructor: 0, admin: 0, guest: 0 }, userTotalValue: 1,
    }),
  });
  ok('an out-of-window BUILDING row makes the buildings side unavailable too',
    outsideBuildings.status.buildings === 'unavailable' &&
    outsideBuildings.months.every((m) => m.buildingAdditions === null));

  ok('the overall model is never "ready" once either side has failed',
    [broken, partial, capped, invalid, outside, badBuildingTotal, outsideBuildings]
      .every((model) => model.state !== 'ready'));

  const mixed = mockRepository({
    userTimestamps: [windows[11].startMs], buildingTimestamps: [windows[11].startMs],
    roleCounts: { 'student-cspc': 7, instructor: 0, admin: 0, guest: 0 },
    userTotalValue: 7, buildingTotalValue: 9,
  });
  const mixedModel = await analytics.loadAdminDashboardAnalytics({ now: NOW, repository: mixed });
  ok('user and building series are read through separate independent calls',
    mixed.calls.userWindow === 1 && mixed.calls.buildingWindow === 1 &&
    mixedModel.totals.users === 7 && mixedModel.totals.buildings === 9);

  ok('the repository honours AUTH_DATA_SOURCE and BUILDING_DATA_SOURCE independently',
    (() => {
      const src = read('repositories/analyticsRepository.js');
      return /readUserAdditionTimestamps[\s\S]{0,400}authDataSource\.isSupabase\(\)/.test(src) &&
        /readBuildingAdditionTimestamps[\s\S]{0,400}mapRuntime\.isBuildingSupabase\(\)/.test(src) &&
        /countUsersByRole[\s\S]{0,600}authDataSource\.isSupabase\(\)/.test(src) &&
        /countBuildingsTotal[\s\S]{0,300}mapRuntime\.isBuildingSupabase\(\)/.test(src);
    })());

  ok('the repository never lets a caller choose a table name',
    (() => {
      const src = stripJsComments(read('repositories/analyticsRepository.js'));
      for (const helper of ['mysqlWindow', 'supabaseWindow']) {
        const callSites = src.match(new RegExp('(?<!function\\s)' + helper + '\\(', 'g')) || [];
        const literalCalls = src.match(new RegExp(helper + "\\((?:supabaseClient\\(\\), )?'(users|buildings)'", 'g')) || [];
        if (callSites.length !== 2 || literalCalls.length !== 2) return false;
      }
      return true;
    })());

  ok('every windowed read is bounded by an explicit limit and a hard ceiling',
    analyticsRepository.MAX_WINDOW_ROWS === 20000 &&
    analyticsRepository.clampLimit(999999999) === 20000 &&
    analyticsRepository.clampLimit(0) === 1 &&
    analyticsRepository.clampLimit('nope') === 20000 &&
    /LIMIT \?/.test(read('repositories/analyticsRepository.js')));

  ok('a malformed range is refused before any query is built',
    (() => {
      for (const bad of [undefined, {}, { startMs: 1, endMs: 1 }, { startMs: 2, endMs: 1 },
        { startMs: NaN, endMs: 5 }]) {
        try { analyticsRepository.normalizeRange(bad, 'test'); return false; } catch (e) { /* expected */ }
      }
      const good = analyticsRepository.normalizeRange({ startMs: 1, endMs: 2, limit: 5 }, 'test');
      return good.startMs === 1 && good.endMs === 2 && good.limit === 5;
    })());
}

/* ---------------------------------------------------------------------------
   5. Static truthfulness of the shipped source
   -------------------------------------------------------------------------*/
function runStaticTruthfulness() {
  console.log('[5] Static truthfulness of controller, view, and client module');

  const controller = read('controllers/adminController.js');
  const view = read('views/admin/index.ejs');
  const client = read('public/js/admin/dashboard-analytics.js');
  const service = read('services/adminAnalyticsService.js');
  const repository = read('repositories/analyticsRepository.js');

  const indexStart = controller.indexOf('exports.index');
  const indexEnd = controller.indexOf('exports.users');
  const indexAction = indexStart >= 0 && indexEnd > indexStart
    ? controller.slice(indexStart, indexEnd) : '';

  ok('the dashboard action exists and delegates to the analytics service',
    indexAction.length > 0 &&
    /adminAnalyticsService\.loadAdminDashboardAnalytics\(/.test(indexAction));
  ok('the dashboard action contains no analytics SQL of its own',
    indexAction.length > 0 &&
    !/COUNT\([\s\S]{0,20}\)[\s\S]{0,120}?\bFROM\s+(?:users|buildings)\b/i.test(indexAction) &&
    !/\bGROUP\s+BY\b|UNIX_TIMESTAMP|FROM_UNIXTIME/i.test(indexAction));
  ok('the fabricated mapViews series is gone from the controller and the view',
    !/\bmapViews\b/.test(controller) && !/\bmapViews\b/.test(view));
  ok('the misleading totalMapViews KPI name is absent everywhere',
    !/\btotalMapViews\b/.test(controller) && !/\btotalMapViews\b/.test(view) &&
    !/\btotalMapViews\b/.test(client));
  ok('no "Sample data" pill or sample-data notice survives in the view',
    !/Sample data/i.test(view) && !/admin-chart-sample-note/.test(view) &&
    !/illustrative only/i.test(view));
  ok('the view no longer contains a hard-coded chart data array',
    !/\{\s*date:\s*'(Jan|Feb)'/.test(view) &&
    !/\{\s*value:\s*\d{3,},\s*color:/.test(view) &&
    !/const\s+roles\s*=\s*\[/.test(view));

  const DISCLAIMER =
    /These are record-creation counts only[^.]*records no visits, sessions, logins, map views, or page views\./i;
  ok('the view states the counting basis explicitly', DISCLAIMER.test(view));
  ok('no usage, visit, or page-view claim is made anywhere else on the dashboard',
    (() => {
      const remainder = stripViewComments(view).replace(DISCLAIMER, ' ');
      return !/map interactions|usage analytics|page views|\bvisits\b|map views|user activity|active sessions/i
        .test(remainder);
    })());

  const trackingPattern = /\b(page_?views?|pageview|visit_?count|visit_?log|analytics_events?|analytics_table|trackEvent|trackPageView|sendBeacon)\b/i;
  ok('no tracking table, counter, event, or beacon appears in the new source',
    !trackingPattern.test(stripJsComments(service)) &&
    !trackingPattern.test(stripJsComments(repository)) &&
    !trackingPattern.test(stripJsComments(client)) &&
    !trackingPattern.test(stripJsComments(indexAction)));
  ok('the analytics repository is SELECT-only (no write verb, DDL, or RPC)',
    (() => {
      const code = stripJsComments(repository);
      return !/\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|TRUNCATE|DROP\s+TABLE)\b/i.test(code) &&
        !/\.rpc\(|\.insert\(|\.upsert\(|\.delete\(/.test(code) &&
        /SELECT /.test(code);
    })());
  ok('the analytics service performs no data access of its own',
    !/require\('\.\.\/config\/db'\)|getSupabaseClient/.test(stripJsComments(service)));
  ok('no analytics result is cached or persisted',
    !/\b(fs\.writeFile|localStorage|sessionStorage|redis|cache\.set)\b/i
      .test(stripJsComments(service) + stripJsComments(repository) + stripJsComments(client)));
  ok('the repository constructs no backend at import time (deferred wiring)',
    (() => {
      const code = stripJsComments(repository);
      // No module-scope require of the pool/client; both are function-local.
      return !/^const\s+db\s*=\s*require\(/m.test(code) &&
        /function mysqlPool\(\)\s*\{\s*return require\('\.\.\/config\/db'\)/.test(code) &&
        /function supabaseClient\(\)/.test(code);
    })());

  const routeFiles = fs.readdirSync(path.join(ROOT, 'routes')).filter((f) => f.endsWith('.js'));
  ok('no route file declares an analytics/stats/metrics endpoint',
    routeFiles.every((f) => !/router\.(get|post|put|patch|delete)\(\s*['"][^'"]*(analytics|metrics|stats|pageviews)/i
      .test(read(path.join('routes', f)))));
  ok('the dashboard stays a role-gated admin page render, not an API',
    /router\.use\(requireRole\('admin'\)\)/.test(read('routes/admin.js')) &&
    /router\.get\('\/',\s*adminController\.index\)/.test(read('routes/admin.js')) &&
    /res\.render\('admin\/index'/.test(indexAction));

  ok('the client module never uses innerHTML, eval, document.write, or Function',
    !/\binnerHTML\b|\beval\s*\(|document\.write|new Function\(|outerHTML|insertAdjacentHTML/
      .test(stripJsComments(client)));
  ok('the client module reads its numbers from the DOM, not from injected data',
    /getAttribute\('data-value'\)/.test(stripJsComments(client)) &&
    !/JSON\.parse\(/.test(stripJsComments(client)));
  ok('no inline script body contains ANY server interpolation (no executable inline data)',
    (() => {
      const markup = stripViewComments(view);
      const blocks = markup.match(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi) || [];
      let inlineBlocks = 0;
      for (const block of blocks) {
        const openTag = block.slice(0, block.indexOf('>') + 1);
        if (/\bsrc=/i.test(openTag)) continue;
        inlineBlocks += 1;
        if (/<%/.test(block.slice(openTag.length, block.lastIndexOf('</script')))) return false;
      }
      return inlineBlocks >= 1 && !/JSON\.stringify/.test(markup);
    })());
  ok('the view loads the chart module as a deferred same-origin script, exactly once',
    /<script src="\/js\/admin\/dashboard-analytics\.js" defer><\/script>/.test(view) &&
    (view.match(/<script src="\/js\/admin\/dashboard-analytics\.js"/g) || []).length === 1);
  ok('the client module adds no network, storage, or cookie access',
    !/\bfetch\(|XMLHttpRequest|navigator\.sendBeacon|document\.cookie|localStorage|sessionStorage|WebSocket/
      .test(stripJsComments(client)));
}

/* ---------------------------------------------------------------------------
   6. Admin dashboard rendering
   -------------------------------------------------------------------------*/
function fixtureModel(kind, nowMs) {
  const windows = analytics.buildMonthWindows(nowMs);
  const roleCounts = kind === 'unavailable'
    ? { 'student-cspc': null, instructor: null, admin: null, guest: null }
    : (kind === 'zero'
      ? { 'student-cspc': 0, instructor: 0, admin: 0, guest: 0 }
      : { 'student-cspc': 12, instructor: 4, admin: 2, guest: 3 });
  const months = windows.map((w, i) => ({
    key: w.key,
    label: w.label,
    userAdditions: kind === 'unavailable' ? null : (kind === 'zero' ? 0 : i),
    buildingAdditions: kind === 'unavailable' ? null : (kind === 'zero' ? 0 : (i % 3)),
  }));
  return {
    timezone: analytics.TIMEZONE,
    monthCount: 12,
    roleKeys: analytics.ROLE_KEYS.slice(),
    months,
    roleCounts,
    roleRows: analytics.buildRoleRows(kind === 'unavailable' ? null : roleCounts),
    totals: kind === 'unavailable' ? { users: null, buildings: null }
      : (kind === 'zero' ? { users: 0, buildings: 0 } : { users: 21, buildings: 25 }),
    status: kind === 'unavailable'
      ? { users: 'unavailable', buildings: 'unavailable' }
      : { users: 'ready', buildings: 'ready' },
    state: kind === 'unavailable' ? 'unavailable' : 'ready',
    isZero: kind === 'zero',
    message: kind === 'unavailable' ? analytics.UNAVAILABLE_MESSAGE : null,
  };
}

function renderDashboard(model) {
  const ejs = require('ejs');
  const viewPath = path.join(ROOT, 'views', 'admin', 'index.ejs');
  return ejs.render(fs.readFileSync(viewPath, 'utf8'), {
    cspNonce: 'test-nonce',
    csrfToken: 'test-csrf',
    user: { first_name: 'Test', last_name: 'Admin', email: 'admin@example.invalid' },
    recentUsers: [],
    recentNews: [],
    analytics: model,
    stats: {
      totalUsers: model.totals.users,
      totalStudents: model.roleCounts['student-cspc'],
      totalNews: model.state === 'unavailable' ? null : 7,
      totalBuildings: model.totals.buildings,
    },
  }, { filename: viewPath });
}

function runRendering() {
  console.log('[6] Admin dashboard rendering (real EJS, three states)');

  const ready = renderDashboard(fixtureModel('ready', NOW));
  const zero = renderDashboard(fixtureModel('zero', NOW));
  const unavailable = renderDashboard(fixtureModel('unavailable', NOW));

  ok('the ready render exposes exactly 12 keyed month rows',
    (ready.match(/data-month-key="/g) || []).length === 12);
  ok('the ready render exposes exactly the four keyed role rows',
    (ready.match(/data-role-key="/g) || []).length === 4 &&
    analytics.ROLE_KEYS.every((r) => ready.includes(`data-role-key="${r}"`)));
  ok('every rendered month value matches the model exactly',
    (() => {
      const model = fixtureModel('ready', NOW);
      return model.months.every((m) =>
        new RegExp(`data-month-key="${m.key}"[\\s\\S]{0,400}?data-series="users" data-value="${m.userAdditions}"`)
          .test(ready) &&
        new RegExp(`data-month-key="${m.key}"[\\s\\S]{0,400}?data-series="buildings" data-value="${m.buildingAdditions}"`)
          .test(ready));
    })());
  ok('every rendered role value matches the model exactly',
    /data-role-key="student-cspc"[\s\S]{0,300}?data-value="12"/.test(ready) &&
    /data-role-key="instructor"[\s\S]{0,300}?data-value="4"/.test(ready) &&
    /data-role-key="admin"[\s\S]{0,300}?data-value="2"/.test(ready) &&
    /data-role-key="guest"[\s\S]{0,300}?data-value="3"/.test(ready));
  ok('the KPI tiles render the real totals',
    /admin-kpi-value">21</.test(ready) && /admin-kpi-value">25</.test(ready) &&
    /admin-kpi-value">12</.test(ready));
  ok('both charts are rendered as accessible images with headings and descriptions',
    /<canvas id="additionsChart"[^>]*role="img"[^>]*aria-labelledby="additionsChartHeading"[^>]*aria-describedby="additionsChartDescription"/.test(ready) &&
    /<svg id="roleChart"[^>]*role="img"[^>]*aria-labelledby="roleChartHeading"[^>]*aria-describedby="roleChartDescription"/.test(ready) &&
    /id="additionsChartHeading"/.test(ready) && /id="roleChartHeading"/.test(ready));
  ok('both tables carry a caption and scoped headers',
    (ready.match(/<caption>/g) || []).length === 2 &&
    (ready.match(/<th scope="col">/g) || []).length === 5 &&
    (ready.match(/<th scope="row">/g) || []).length === 16);
  ok('the section headings are truthful about what is counted',
    /Account and Building Additions/.test(ready) &&
    /Account Role Distribution/.test(ready) &&
    !/Activity Overview/.test(ready) && !/Role Mix/.test(ready));
  ok('the Asia/Manila basis is stated on the page',
    /Asia\/Manila/.test(ready) && /data-analytics-timezone="Asia\/Manila"/.test(ready));

  ok('a genuine zero renders visible zeroes, not "Unavailable"',
    (zero.match(/data-value="0"/g) || []).length === 28 &&
    !/>Unavailable</.test(zero) &&
    /<canvas id="additionsChart"/.test(zero) && /<svg id="roleChart"/.test(zero));

  ok('an unavailable model renders the fixed sanitized message',
    unavailable.includes(analytics.UNAVAILABLE_MESSAGE) &&
    (unavailable.match(/admin-analytics-unavailable/g) || []).length >= 2);
  ok('an unavailable model NEVER renders a fabricated zero',
    !/data-value="0"/.test(unavailable) && (unavailable.match(/>Unavailable</g) || []).length >= 20);
  ok('an unavailable model draws no chart surface at all',
    !/<canvas id="additionsChart"/.test(unavailable) && !/<svg id="roleChart"/.test(unavailable));
  ok('the unavailable state still lists all 12 months and all 4 roles as rows',
    (unavailable.match(/data-month-key="/g) || []).length === 12 &&
    (unavailable.match(/data-role-key="/g) || []).length === 4);
  ok('unavailable cells carry an EMPTY data-value so the client cannot invent one',
    (unavailable.match(/data-value=""/g) || []).length === 28);
  ok('no rendered state leaks a backend identifier, SQL, host, or stack',
    [ready, zero, unavailable].every((html) =>
      !/AUTH_DATA_SOURCE|BUILDING_DATA_SOURCE|SUPABASE_URL|service_role|SELECT |UNIX_TIMESTAMP|\bat \/|Error:/i.test(html)));
  ok('the rendered attributes match exactly what the client module reads',
    /data-month-key="/.test(ready) && /data-series="users"/.test(ready) &&
    /data-series="buildings"/.test(ready) && /data-series="role"/.test(ready) &&
    /getAttribute\('data-series'\)/.test(read('public/js/admin/dashboard-analytics.js')));
}

/* ---------------------------------------------------------------------------
   7. Non-admin denial leaks no analytics
   -------------------------------------------------------------------------*/
function runDenial() {
  console.log('[7] Non-admin denial leaks no analytics');

  installAuditRecorder();
  const guard = roleAuth.requireRole('admin');

  function attempt(sessionUser, wantsJson) {
    const captured = { status: null, rendered: null, json: null, redirect: null, nextCalled: false };
    const req = {
      session: sessionUser ? { user: sessionUser } : {},
      originalUrl: wantsJson ? '/admin/api/anything' : '/admin',
      method: 'GET',
      get: (h) => (h === 'Accept' ? (wantsJson ? 'application/json' : 'text/html') : ''),
    };
    const res = {
      status(code) { captured.status = code; return res; },
      json(body) { captured.json = body; return res; },
      render(view, locals) { captured.rendered = { view, locals }; return res; },
      redirect(target) { captured.redirect = target; return res; },
    };
    guard(req, res, () => { captured.nextCalled = true; });
    return captured;
  }

  for (const role of ['student-cspc', 'instructor', 'guest']) {
    const html = attempt({ id: 5, role }, false);
    ok(`${role}: the admin dashboard is refused with 403 and never reaches the controller`,
      html.status === 403 && html.nextCalled === false && html.rendered !== null &&
      html.rendered.view === 'error');
    ok(`${role}: the denial response carries no analytics value or label`,
      !/(additions|roleCounts|Asia\/Manila|totalUsers|totalBuildings|monthCount|data-month-key)/i
        .test(JSON.stringify(html.rendered.locals || {})));
    const json = attempt({ id: 5, role }, true);
    ok(`${role}: the JSON denial is a fixed 403 with no analytics payload`,
      json.status === 403 && json.nextCalled === false && json.json &&
      json.json.success === false &&
      !/(additions|roleCounts|Asia\/Manila|months)/i.test(JSON.stringify(json.json)));
  }

  const anonymous = attempt(null, false);
  ok('anonymous: the dashboard redirects to /auth without invoking the controller',
    anonymous.redirect === '/auth' && anonymous.nextCalled === false &&
    anonymous.rendered === null && anonymous.json === null);

  const admin = attempt({ id: 1, role: 'admin' }, false);
  ok('admin: the guard still passes the request through',
    admin.nextCalled === true && admin.status === null && admin.redirect === null);

  ok('captured authorization-denial audit events carry no analytics payload',
    capturedAuditEvents.length === 6 &&
    capturedAuditEvents.every((e) => e.event_type === 'authorization' && e.outcome === 'denied') &&
    !/(additions|roleCounts|Asia\/Manila|monthCount|totalBuildings)/i
      .test(JSON.stringify(capturedAuditEvents)));

  // Hand the real sink back so this section leaves no residue in the process.
  restoreAuditRecorder();
  ok('the real audit sink is restored after the section, leaving no global stub',
    auditService.record === realAuditRecord && typeof auditService.record === 'function');
}

/* ---------------------------------------------------------------------------
   8. Client chart module against a mock DOM
   -------------------------------------------------------------------------*/

function makeElement(doc, tag, attributes) {
  const attrs = Object.assign({}, attributes || {});
  const element = {
    tagName: String(tag).toUpperCase(),
    ownerDocument: doc,
    parentNode: null,
    childNodes: [],
    textContent: '',
    attributes: attrs,
    getAttribute: (name) => (Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null),
    setAttribute: (name, value) => { attrs[name] = String(value); },
    appendChild(child) { child.parentNode = element; element.childNodes.push(child); return child; },
    removeChild(child) {
      const i = element.childNodes.indexOf(child);
      if (i >= 0) element.childNodes.splice(i, 1);
      return child;
    },
    getElementsByTagName(name) {
      const wanted = String(name).toUpperCase();
      const out = [];
      (function walk(node) {
        for (const child of node.childNodes) {
          if (child.tagName === wanted) out.push(child);
          walk(child);
        }
      })(element);
      return out;
    },
  };
  Object.defineProperty(element, 'firstChild', {
    get() { return element.childNodes.length ? element.childNodes[0] : null; },
  });
  return element;
}

/** A recording 2D context: proves what was drawn without a real canvas. */
function recordingContext() {
  const calls = [];
  const record = (name) => (...args) => { calls.push({ name, args }); };
  return {
    calls,
    setTransform: record('setTransform'),
    clearRect: record('clearRect'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    stroke: record('stroke'),
    fill: record('fill'),
    fillRect: record('fillRect'),
    arc: record('arc'),
    save: record('save'),
    restore: record('restore'),
    setLineDash: record('setLineDash'),
    fillText: (text, x, y) => { calls.push({ name: 'fillText', args: [text, x, y] }); },
  };
}

function buildMockDocument(model, options) {
  const settings = options || {};
  const listeners = {};
  const observed = { resize: 0, mutation: 0, mutationOptions: null };
  const doc = {
    documentElement: null,
    defaultView: null,
    createElementNS: (ns, tag) => makeElement(doc, tag, { xmlns: ns }),
    getElementById: (id) => doc._byId[id] || null,
    _byId: {},
  };

  const root = makeElement(doc, 'html', { 'data-theme': settings.theme || 'light' });
  doc.documentElement = root;

  class MockResizeObserver {
    constructor(callback) { this.callback = callback; }
    observe() { observed.resize += 1; doc._resizeCallbacks.push(this.callback); }
  }
  class MockMutationObserver {
    constructor(callback) { this.callback = callback; }
    observe(target, opts) {
      observed.mutation += 1;
      observed.mutationOptions = opts;
      doc._mutationCallbacks.push(this.callback);
    }
  }
  doc._resizeCallbacks = [];
  doc._mutationCallbacks = [];
  doc.observed = observed;
  doc.defaultView = {
    devicePixelRatio: 2,
    ResizeObserver: MockResizeObserver,
    MutationObserver: MockMutationObserver,
    addEventListener: (type, handler) => { (listeners[type] = listeners[type] || []).push(handler); },
    requestAnimationFrame: (fn) => { fn(); return 1; },
  };
  if (settings.cssTokens) {
    doc.defaultView.getComputedStyle = () => ({
      getPropertyValue: (name) => (
        Object.prototype.hasOwnProperty.call(settings.cssTokens, name) ? settings.cssTokens[name] : ''),
    });
  }
  doc.listeners = listeners;

  const container = makeElement(doc, 'div');
  const context = recordingContext();
  const canvas = makeElement(doc, 'canvas', { id: 'additionsChart' });
  canvas.getContext = () => context;
  canvas.getBoundingClientRect = () => ({ width: doc._width, height: 300 });
  canvas.context = context;
  container.appendChild(canvas);
  doc._width = 640;

  const svg = makeElement(doc, 'svg', { id: 'roleChart' });

  const additionsTable = makeElement(doc, 'table', { id: 'additionsTable' });
  const additionsBody = makeElement(doc, 'tbody');
  additionsTable.appendChild(additionsBody);
  for (const month of model.months) {
    const row = makeElement(doc, 'tr', { 'data-month-key': month.key });
    const head = makeElement(doc, 'th', { scope: 'row' });
    head.textContent = month.label;
    row.appendChild(head);
    row.appendChild(makeElement(doc, 'td', {
      'data-series': 'users',
      'data-value': month.userAdditions === null ? '' : String(month.userAdditions),
    }));
    row.appendChild(makeElement(doc, 'td', {
      'data-series': 'buildings',
      'data-value': month.buildingAdditions === null ? '' : String(month.buildingAdditions),
    }));
    additionsBody.appendChild(row);
  }

  const roleTable = makeElement(doc, 'table', { id: 'roleTable' });
  const roleBody = makeElement(doc, 'tbody');
  roleTable.appendChild(roleBody);
  for (const row of model.roleRows) {
    const tr = makeElement(doc, 'tr', { 'data-role-key': row.role });
    const th = makeElement(doc, 'th', { scope: 'row' });
    th.textContent = row.label;
    tr.appendChild(th);
    tr.appendChild(makeElement(doc, 'td', {
      'data-series': 'role',
      'data-value': row.count === null ? '' : String(row.count),
    }));
    roleBody.appendChild(tr);
  }

  doc._byId.additionsChart = canvas;
  doc._byId.roleChart = svg;
  doc._byId.additionsTable = additionsTable;
  doc._byId.roleTable = roleTable;
  doc.canvas = canvas;
  doc.svg = svg;
  return doc;
}

function runClientModule() {
  console.log('[8] Client chart module against a mock DOM');

  const readyModel = fixtureModel('ready', NOW);
  const doc = buildMockDocument(readyModel);

  const additions = charts.readAdditionsModel(doc);
  ok('the client reads exactly 12 months back out of the rendered table',
    additions.months.length === 12 && additions.usersReady === true && additions.buildingsReady === true);
  ok('the client reads the exact server values, in order',
    additions.months.every((m, i) =>
      m.key === readyModel.months[i].key &&
      m.users === readyModel.months[i].userAdditions &&
      m.buildings === readyModel.months[i].buildingAdditions));
  ok('the client reads exactly the four roles and their exact counts',
    (() => {
      const roles = charts.readRoleModel(doc);
      return roles.roles.length === 4 && roles.ready === true && roles.total === 21 &&
        roles.roles.map((r) => r.key).join(',') === 'student-cspc,instructor,admin,guest' &&
        roles.roles[0].count === 12 && roles.roles[3].count === 3;
    })());
  ok('an empty data-value marks the whole series unavailable rather than 0',
    (() => {
      const blank = buildMockDocument(fixtureModel('unavailable', NOW));
      const m = charts.readAdditionsModel(blank);
      const r = charts.readRoleModel(blank);
      return m.usersReady === false && m.buildingsReady === false &&
        m.months.every((x) => x.users === null && x.buildings === null) &&
        r.ready === false && r.total === null;
    })());
  ok('the client cell parser is as strict as the server parser',
    (() => {
      const cell = (raw) => ({ getAttribute: () => raw });
      return charts.cellValue(cell('0')) === 0 && charts.cellValue(cell('21')) === 21 &&
        ['', ' ', '-1', '1.5', '1e3', 'x', null, undefined,
          String(Number.MAX_SAFE_INTEGER + 2)]
          .every((bad) => charts.cellValue(cell(bad)) === null);
    })());

  ok('the axis maximum is never zero, so no scale can divide by zero',
    charts.axisMax({ months: [{ users: 0, buildings: 0 }], usersReady: true, buildingsReady: true }) === 1 &&
    charts.axisMax({ months: [{ users: 9, buildings: 3 }], usersReady: true, buildingsReady: true }) === 9);

  const initialised = charts.initAdminAnalytics(doc);
  ok('initialisation succeeds against the mock DOM', initialised === true);
  ok('the additions chart drew a grid, axis labels, and both series',
    (() => {
      const names = doc.canvas.context.calls.map((c) => c.name);
      const texts = doc.canvas.context.calls.filter((c) => c.name === 'fillText').map((c) => c.args[0]);
      return names.includes('stroke') && names.includes('arc') && names.includes('fillRect') &&
        texts.includes('Aug') && texts.includes('Sep');
    })());
  ok('the canvas backing store honours the device pixel ratio',
    doc.canvas.width === 1280 && doc.canvas.height === 600);
  ok('the role donut drew one defs block plus one path per non-zero role',
    doc.svg.childNodes.filter((n) => n.tagName === 'DEFS').length === 1 &&
    doc.svg.childNodes.filter((n) => n.tagName === 'PATH').length === 4);

  const drawsBeforeResize = doc.canvas.context.calls.length;
  ok('a ResizeObserver is attached to the chart container', doc.observed.resize === 1);
  doc._width = 320;
  doc._resizeCallbacks.forEach((cb) => cb());
  ok('a container resize triggers a redraw at the new width',
    doc.canvas.context.calls.length > drawsBeforeResize && doc.canvas.width === 640);

  const drawsBeforeTheme = doc.canvas.context.calls.length;
  ok('a MutationObserver watches exactly the data-theme attribute',
    doc.observed.mutation === 1 && doc.observed.mutationOptions &&
    doc.observed.mutationOptions.attributes === true &&
    Array.isArray(doc.observed.mutationOptions.attributeFilter) &&
    doc.observed.mutationOptions.attributeFilter.length === 1 &&
    doc.observed.mutationOptions.attributeFilter[0] === 'data-theme');
  doc.documentElement.setAttribute('data-theme', 'dark');
  doc._mutationCallbacks.forEach((cb) => cb());
  ok('a data-theme change triggers a redraw',
    doc.canvas.context.calls.length > drawsBeforeTheme);
  ok('the redraw is repeatable and does not accumulate donut segments',
    (() => {
      doc._mutationCallbacks.forEach((cb) => cb());
      doc._mutationCallbacks.forEach((cb) => cb());
      return doc.svg.childNodes.filter((n) => n.tagName === 'PATH').length === 4 &&
        doc.svg.childNodes.filter((n) => n.tagName === 'DEFS').length === 1;
    })());

  const zeroDoc = buildMockDocument(fixtureModel('zero', NOW));
  charts.initAdminAnalytics(zeroDoc);
  ok('a genuine all-zero period still draws axes plus an explicit empty statement',
    (() => {
      const texts = zeroDoc.canvas.context.calls.filter((c) => c.name === 'fillText').map((c) => c.args[0]);
      return texts.includes(charts.EMPTY_ADDITIONS_TEXT) && texts.includes('Aug');
    })());
  ok('a zero role total draws a visible ring plus an explicit empty statement',
    (() => {
      const kinds = zeroDoc.svg.childNodes.map((n) => n.tagName);
      const text = zeroDoc.svg.childNodes.find((n) => n.tagName === 'TEXT');
      return kinds.includes('CIRCLE') && !!text && text.textContent === charts.EMPTY_ROLES_TEXT;
    })());

  const blankDoc = buildMockDocument(fixtureModel('unavailable', NOW));
  const blankResult = charts.renderAdminAnalytics(blankDoc);
  ok('an unavailable model draws neither chart instead of an invented flat line',
    blankResult.additions === false && blankResult.roles === false &&
    blankDoc.canvas.context.calls.length === 0 && blankDoc.svg.childNodes.length === 0);

  ok('a partially available model still draws the healthy series only',
    (() => {
      const partial = fixtureModel('ready', NOW);
      partial.months.forEach((m) => { m.userAdditions = null; });
      const pDoc = buildMockDocument(partial);
      const model = charts.readAdditionsModel(pDoc);
      charts.renderAdminAnalytics(pDoc);
      const names = pDoc.canvas.context.calls.map((c) => c.name);
      return model.usersReady === false && model.buildingsReady === true &&
        names.includes('fillRect') && !names.includes('arc');
    })());
}

/* ---------------------------------------------------------------------------
   9. Chart colour contrast and non-colour pattern encoding
   -------------------------------------------------------------------------*/

/** PURE: does every non-zero donut segment reference its own role pattern? */
function donutSegmentsUsePatterns(svg, expectedCount) {
  const paths = svg.childNodes.filter((n) => n.tagName === 'PATH');
  if (paths.length !== expectedCount) return false;
  return paths.every((path, i) => {
    const fill = path.getAttribute('fill');
    const index = path.getAttribute('data-role-index');
    return fill === 'url(#' + charts.rolePatternId(i) + ')' && index === String(i + 1);
  });
}

function runChartAccessibility() {
  console.log('[9] Chart colour contrast and non-colour pattern encoding');

  const palette = charts.ANALYTICS_PALETTE;
  const MIN_RATIO = 3;

  ok('both a light and a dark palette are defined with a declared surface',
    !!palette.light && !!palette.dark &&
    palette.light.surface === '#ffffff' && palette.dark.surface === '#0b1220');

  for (const theme of ['light', 'dark']) {
    const set = palette[theme];
    const colors = [set.users, set.buildings].concat(set.roles);
    ok(`${theme}: exactly two series colours and four role colours are defined`,
      set.roles.length === 4 && colors.every(charts.isHexColor));
    const ratios = colors.map((c) => contrastRatio(c, set.surface));
    ok(`${theme}: every data colour clears ${MIN_RATIO}:1 against its own surface ` +
      `(measured ${ratios.map((r) => r.toFixed(2)).join(', ')})`,
      ratios.every((r) => r >= MIN_RATIO));
    ok(`${theme}: the four role colours are all distinct`,
      new Set(set.roles).size === 4);
  }

  /* The ratios recorded in the view and in the client header are recomputed
     here from the shipped hex values, so a documented ratio can never drift
     away from the colour it claims to describe. Role order, not swatch order. */
  ok('the recorded light-surface role ratios reproduce (11.28, 6.12, 5.93, 7.56)',
    (() => {
      const s = palette.light;
      const measured = s.roles.map((c) => Number(contrastRatio(c, s.surface).toFixed(2)));
      return measured.join(',') === '11.28,6.12,5.93,7.56';
    })());
  ok('the recorded dark-surface role ratios reproduce (8.88, 12.66, 11.16, 12.71)',
    (() => {
      const s = palette.dark;
      const measured = s.roles.map((c) => Number(contrastRatio(c, s.surface).toFixed(2)));
      return measured.join(',') === '8.88,12.66,11.16,12.71';
    })());
  ok('the two series colours reproduce their own recorded ratios',
    Number(contrastRatio(palette.light.users, palette.light.surface).toFixed(2)) === 11.28 &&
    Number(contrastRatio(palette.light.buildings, palette.light.surface).toFixed(2)) === 5.93 &&
    Number(contrastRatio(palette.dark.users, palette.dark.surface).toFixed(2)) === 8.88 &&
    Number(contrastRatio(palette.dark.buildings, palette.dark.surface).toFixed(2)) === 11.16);

  // ---- the view and the renderer share ONE set of tokens ----
  const view = read('views/admin/index.ejs');
  const tokenValue = (block, name) => {
    const match = block.match(new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{6})'));
    return match ? match[1].toLowerCase() : null;
  };
  const lightBlock = (view.match(/:root\s*\{[\s\S]*?\}/) || [''])[0];
  const darkBlock = (view.match(/\[data-theme="dark"\]\s*\{[\s\S]*?\}/) || [''])[0];

  ok('the view declares the analytics colour tokens for both themes',
    /--analytics-surface/.test(lightBlock) && /--analytics-surface/.test(darkBlock));
  for (const [theme, block] of [['light', lightBlock], ['dark', darkBlock]]) {
    const set = palette[theme];
    ok(`${theme}: every view token matches the client palette exactly`,
      tokenValue(block, 'analytics-surface') === set.surface.toLowerCase() &&
      tokenValue(block, 'analytics-users') === set.users.toLowerCase() &&
      tokenValue(block, 'analytics-buildings') === set.buildings.toLowerCase() &&
      set.roles.every((color, i) =>
        tokenValue(block, 'analytics-role-' + (i + 1)) === color.toLowerCase()));
  }
  ok('the client prefers the page CSS tokens when they are available',
    (() => {
      const doc = buildMockDocument(fixtureModel('ready', NOW), {
        cssTokens: { '--analytics-users': '#123456', '--analytics-role-2': '#654321' },
      });
      const resolved = charts.paletteFor(doc);
      return resolved.users === '#123456' && resolved.roles[1] === '#654321' &&
        resolved.buildings === palette.light.buildings;
    })());
  ok('a malformed CSS token is ignored in favour of the built-in palette',
    (() => {
      const doc = buildMockDocument(fixtureModel('ready', NOW), {
        cssTokens: { '--analytics-users': 'not-a-colour' },
      });
      return charts.paletteFor(doc).users === palette.light.users;
    })());
  ok('the dark palette is selected from the data-theme attribute',
    (() => {
      const doc = buildMockDocument(fixtureModel('ready', NOW), { theme: 'dark' });
      const resolved = charts.paletteFor(doc);
      return resolved.users === palette.dark.users && resolved.surface === palette.dark.surface;
    })());

  // ---- no gold-tinted small legend text ----
  ok('no legend text is tinted with the gold accent, and no data hex is inlined',
    (() => {
      const markup = stripViewComments(view);
      const legendText = markup.match(/<span class="admin-analytics-legend-text">[\s\S]*?<\/span>/g) || [];
      return legendText.length >= 2 &&
        legendText.every((span) => !/style="[^"]*color\s*:/i.test(span)) &&
        !/admin-analytics-shape[^>]*style="color:#/i.test(markup) &&
        !/#d4a843/i.test((markup.match(/<ul class="admin-(analytics-legend|mini-legend)"[\s\S]*?<\/ul>/g) || []).join(''));
    })());

  // ---- four distinct patterns, in the donut AND the legend ----
  ok('exactly four distinct non-colour encodings are declared',
    charts.ROLE_PATTERNS.length === 4 &&
    new Set(charts.ROLE_PATTERNS).size === 4 &&
    charts.ROLE_PATTERNS.join(',') === 'solid,diagonal,crosshatch,dots');

  const doc = buildMockDocument(fixtureModel('ready', NOW));
  charts.renderAdminAnalytics(doc);
  const defs = doc.svg.childNodes.find((n) => n.tagName === 'DEFS');
  ok('the donut declares exactly four SVG patterns with the four distinct kinds',
    !!defs && defs.childNodes.length === 4 &&
    defs.childNodes.every((p) => p.tagName === 'PATTERN') &&
    defs.childNodes.map((p) => p.getAttribute('data-pattern-kind')).join(',') ===
      charts.ROLE_PATTERNS.join(',') &&
    new Set(defs.childNodes.map((p) => p.getAttribute('id'))).size === 4);
  ok('each pattern tile is filled with its own role colour and textured in the surface colour',
    defs.childNodes.every((pattern, i) => {
      const base = pattern.childNodes[0];
      return base && base.tagName === 'RECT' &&
        base.getAttribute('fill') === charts.ANALYTICS_PALETTE.light.roles[i];
    }));
  ok('the three textured patterns carry real texture geometry, and solid does not',
    defs.childNodes[0].childNodes.length === 1 &&
    defs.childNodes[1].childNodes.length === 4 &&
    defs.childNodes[2].childNodes.length === 3 &&
    defs.childNodes[3].childNodes.length === 3);
  ok('every non-zero donut segment references its own pattern, not a flat colour',
    donutSegmentsUsePatterns(doc.svg, 4));

  ok('fixture: a colour-only donut (flat fills, no pattern reference) is REJECTED',
    (() => {
      const mutated = buildMockDocument(fixtureModel('ready', NOW));
      charts.renderAdminAnalytics(mutated);
      mutated.svg.childNodes
        .filter((n) => n.tagName === 'PATH')
        .forEach((p, i) => p.setAttribute('fill', charts.ANALYTICS_PALETTE.light.roles[i]));
      return donutSegmentsUsePatterns(mutated.svg, 4) === false;
    })());
  ok('fixture: a donut whose segments all share ONE pattern is REJECTED',
    (() => {
      const mutated = buildMockDocument(fixtureModel('ready', NOW));
      charts.renderAdminAnalytics(mutated);
      mutated.svg.childNodes
        .filter((n) => n.tagName === 'PATH')
        .forEach((p) => p.setAttribute('fill', 'url(#' + charts.rolePatternId(0) + ')'));
      return donutSegmentsUsePatterns(mutated.svg, 4) === false;
    })());

  // ---- the legend repeats the same four encodings ----
  const rendered = renderDashboard(fixtureModel('ready', NOW));
  ok('the legend renders four swatches carrying the same four pattern kinds, in order',
    (() => {
      const kinds = [...rendered.matchAll(/data-pattern-kind="([a-z]+)"/g)].map((m) => m[1]);
      return kinds.length === 4 && kinds.join(',') === charts.ROLE_PATTERNS.join(',');
    })());
  ok('each legend swatch fills from its own pattern and its own colour token',
    (() => {
      for (let i = 1; i <= 4; i += 1) {
        if (!rendered.includes('fill="url(#legend-pattern-role-' + i + ')"')) return false;
        if (!rendered.includes('var(--analytics-role-' + i + ')')) return false;
      }
      return true;
    })());
  ok('the monthly legend keeps the line/marker distinction and names it in text',
    /stroke-dasharray="6 4"/.test(rendered) &&
    /New accounts \(solid line, round marker\)/.test(rendered) &&
    /New buildings \(dashed line, square marker\)/.test(rendered));
  ok('the semantic role table remains the authoritative non-visual alternative',
    /<table class="admin-analytics-table" id="roleTable">/.test(rendered) &&
    (rendered.match(/data-role-key="/g) || []).length === 4);
}

/* ---------------------------------------------------------------------------
   10. Deterministic Supabase pagination (injected fake client)
   -------------------------------------------------------------------------*/

/** A fake Supabase client that records the exact query it was asked to build. */
function fakeSupabaseClient(rowsByTable) {
  const queries = [];
  return {
    queries,
    from(table) {
      const q = { table, select: null, orders: [], ranges: [], filters: [] };
      queries.push(q);
      const builder = {
        select(columns) { q.select = columns; return builder; },
        not(column, op, value) { q.filters.push(['not', column, op, value]); return builder; },
        gte(column, value) { q.filters.push(['gte', column, value]); return builder; },
        lt(column, value) { q.filters.push(['lt', column, value]); return builder; },
        order(column, opts) { q.orders.push([column, !!(opts && opts.ascending)]); return builder; },
        range(from, to) {
          q.ranges.push([from, to]);
          const all = rowsByTable[table] || [];
          return Promise.resolve({ data: all.slice(from, to + 1), error: null });
        },
      };
      return builder;
    },
  };
}

async function runSupabasePagination() {
  console.log('[10] Deterministic Supabase pagination (injected fake client, no network)');

  const start = Date.UTC(2026, 0, 1);
  const end = Date.UTC(2027, 0, 1);
  const makeRows = (n) => Array.from({ length: n }, (_, i) => ({
    id: i + 1, created_at: new Date(start + i * 1000).toISOString(),
  }));

  // Two full pages plus a short one: 2500 rows under a 20000 ceiling.
  const client = fakeSupabaseClient({ users: makeRows(2500) });
  const range = analyticsRepository.normalizeRange({ startMs: start, endMs: end }, 'test');
  const result = await analyticsRepository.supabaseWindow(client, 'users', range, 'test');

  const q = client.queries[0];
  ok('the query selects id together with created_at',
    client.queries.length === 3 && q.select === 'id, created_at');
  ok('ordering is composite: created_at ascending THEN id ascending',
    client.queries.every((query) =>
      query.orders.length === 2 &&
      query.orders[0][0] === 'created_at' && query.orders[0][1] === true &&
      query.orders[1][0] === 'id' && query.orders[1][1] === true));
  ok('the window is applied as a half-open range with a null guard',
    q.filters.some((f) => f[0] === 'gte' && f[1] === 'created_at') &&
    q.filters.some((f) => f[0] === 'lt' && f[1] === 'created_at') &&
    q.filters.some((f) => f[0] === 'not' && f[1] === 'created_at'));
  ok('reads are paginated in fixed pages, not one large limit',
    (() => {
      const ranges = client.queries.map((query) => query.ranges[0]);
      return ranges.length === 3 &&
        ranges[0][0] === 0 && ranges[0][1] === 999 &&
        ranges[1][0] === 1000 && ranges[1][1] === 1999 &&
        ranges[2][0] === 2000 && ranges[2][1] === 2999;
    })());
  ok('a complete read returns every row and is not marked capped',
    result.timestampsMs.length === 2500 && result.capped === false);
  ok('the public result exposes ONLY timestamps and the cap flag — never an id',
    Object.keys(result).sort().join(',') === 'capped,timestampsMs' &&
    result.timestampsMs.every((ms) => typeof ms === 'number' && Number.isFinite(ms)) &&
    !JSON.stringify(result).includes('"id"'));
  ok('timestamps come back in ascending order',
    result.timestampsMs.every((ms, i) => i === 0 || ms >= result.timestampsMs[i - 1]));

  // The ceiling must stop the walk and mark the read capped.
  const bigClient = fakeSupabaseClient({ users: makeRows(3000) });
  const cappedResult = await analyticsRepository.supabaseWindow(
    bigClient, 'users', { startMs: start, endMs: end, limit: 2000 }, 'test');
  ok('the hard ceiling stops paging and marks the read capped rather than truncating silently',
    cappedResult.capped === true && cappedResult.timestampsMs.length === 2000 &&
    bigClient.queries.length === 2);
  ok('the clamped ceiling never exceeds MAX_WINDOW_ROWS',
    analyticsRepository.clampLimit(10 ** 9) === analyticsRepository.MAX_WINDOW_ROWS &&
    analyticsRepository.SUPABASE_PAGE_SIZE < analyticsRepository.MAX_WINDOW_ROWS);

  ok('an unparseable created_at rejects the whole read instead of skipping the row',
    (() => {
      const badClient = fakeSupabaseClient({ users: [{ id: 1, created_at: 'nonsense' }] });
      return analyticsRepository
        .supabaseWindow(badClient, 'users', range, 'test')
        .then(() => false, () => true);
    })() instanceof Promise ? await (async () => {
      const badClient = fakeSupabaseClient({ users: [{ id: 1, created_at: 'nonsense' }] });
      try {
        await analyticsRepository.supabaseWindow(badClient, 'users', range, 'test');
        return false;
      } catch (e) { return true; }
    })() : false);

  ok('a backend error is rethrown sanitized, with no host or key',
    await (async () => {
      const errClient = {
        from() {
          const builder = {
            select: () => builder, not: () => builder, gte: () => builder,
            lt: () => builder, order: () => builder,
            range: () => Promise.resolve({
              data: null,
              error: { message: 'connect failed https://project.supabase.co eyJhbGciOiJIUzI1NiJ9secret' },
            }),
          };
          return builder;
        },
      };
      try {
        await analyticsRepository.supabaseWindow(errClient, 'users', range, 'test');
        return false;
      } catch (e) {
        return /analyticsRepository\.test:/.test(e.message) &&
          !/supabase\.co/.test(e.message) && !/eyJ/.test(e.message);
      }
    })());

  // ---- rejecting source assertions: the contract cannot be quietly removed ----
  const repoSource = stripJsComments(read('repositories/analyticsRepository.js'));
  const hasCompositeOrder = (src) =>
    /\.order\('created_at',\s*\{\s*ascending:\s*true\s*\}\)[\s\S]{0,80}\.order\('id',\s*\{\s*ascending:\s*true\s*\}\)/.test(src);
  const hasPagination = (src) => /\.range\(offset,\s*offset \+ pageSize - 1\)/.test(src);
  const hasCeiling = (src) => /while \(offset < range\.limit\)/.test(src) && /SUPABASE_PAGE_SIZE/.test(src);
  const keepsIdInternal = (src) =>
    /return \{ timestampsMs, capped(?::| )/.test(src) && !/timestampsMs,\s*ids/.test(src);

  ok('accepting: the live repository source satisfies every paging contract',
    hasCompositeOrder(repoSource) && hasPagination(repoSource) &&
    hasCeiling(repoSource) && keepsIdInternal(repoSource));
  ok('fixture: removing the secondary id ordering is detected',
    !hasCompositeOrder(repoSource.replace(/\.order\('id',\s*\{\s*ascending:\s*true\s*\}\)/, '')));
  ok('fixture: replacing pagination with one large limit is detected',
    !hasPagination(repoSource.replace(/\.range\(offset,\s*offset \+ pageSize - 1\)/, '.limit(20000)')));
  ok('fixture: removing the page ceiling is detected',
    !hasCeiling(repoSource.replace(/while \(offset < range\.limit\)/, 'while (true)')));
  ok('fixture: returning ids to the service is detected',
    !keepsIdInternal(repoSource.replace(/return \{ timestampsMs, capped/g, 'return { timestampsMs, ids, capped')));
  ok('the repository issues no single unbounded limit call',
    !/\.limit\(/.test(repoSource));
}

/* ---------------------------------------------------------------------------
   11. Backend comparison disposition (pure, fail-closed)
   -------------------------------------------------------------------------*/
function runBackendDisposition() {
  console.log('[11] Backend comparison disposition (pure, fail-closed)');

  const normal = (extra) => resolveBackendDisposition(
    Object.assign({ mode: MODE_NORMAL, backend: 'mysql' }, extra));

  ok('a required, configured, reachable leg is EXECUTED',
    normal({ configured: true, reachable: true }).action === 'execute');
  ok('a required but UNREACHABLE leg is REJECTED',
    normal({ configured: true, reachable: false }).action === 'reject');
  ok('a required but UNCONFIGURED leg is REJECTED',
    normal({ configured: false, reachable: true }).action === 'reject');
  ok('a SKIP REQUEST in normal mode is REJECTED, never honoured',
    normal({ configured: true, reachable: true, skipRequested: true }).action === 'reject' &&
    normal({ configured: false, reachable: false, skipRequested: true }).action === 'reject');
  ok('a missing reachability/configuration flag fails closed rather than open',
    normal({}).action === 'reject' &&
    normal({ configured: true }).action === 'reject' &&
    normal({ reachable: true }).action === 'reject');
  ok('static-only mode OMITS the leg rather than pretending it executed',
    resolveBackendDisposition({ mode: MODE_STATIC_ONLY, backend: 'mysql' }).action === 'omit');

  const executed = (backend) => ({ backend, action: 'execute', executed: true });
  ok('both required legs executed makes the run eligible for the normal success marker',
    normalSuccessAllowed([executed('mysql'), executed('supabase')]) === true);
  ok('one executed leg alone is NOT eligible',
    normalSuccessAllowed([executed('mysql')]) === false &&
    normalSuccessAllowed([executed('supabase')]) === false);
  ok('a rejected or unexecuted leg makes the run ineligible',
    normalSuccessAllowed([executed('mysql'), { backend: 'supabase', action: 'reject', executed: false }]) === false &&
    normalSuccessAllowed([executed('mysql'), { backend: 'supabase', action: 'execute', executed: false }]) === false &&
    normalSuccessAllowed([executed('mysql'), { backend: 'supabase', action: 'omit', executed: false }]) === false);
  ok('the same backend twice is NOT eligible — both distinct backends are required',
    normalSuccessAllowed([executed('mysql'), executed('mysql')]) === false);
  ok('an empty or malformed leg list is NOT eligible',
    normalSuccessAllowed([]) === false && normalSuccessAllowed(null) === false &&
    normalSuccessAllowed([null, null]) === false);

  // The probe's own source must wire those helpers into the real run.
  const self = stripJsComments(read('scripts/adminDashboardAnalytics-probe.js'));
  ok('the normal run requires BOTH legs and records a failure for a rejected one',
    /normalSuccessAllowed\(legs\)/.test(self) &&
    /both required backend comparison legs executed/.test(self));
  ok('PROBE_SKIP_SUPABASE is read as a skip REQUEST, never as permission',
    /skipRequested:\s*String\(process\.env\.PROBE_SKIP_SUPABASE/.test(self));
  ok('the static-only marker is distinct and the normal marker is never printed by it',
    STATIC_ONLY_SUCCESS_MARKER !== NORMAL_SUCCESS_MARKER &&
    !STATIC_ONLY_SUCCESS_MARKER.includes(NORMAL_SUCCESS_MARKER) &&
    !NORMAL_SUCCESS_MARKER.includes(STATIC_ONLY_SUCCESS_MARKER));
  ok('static-only mode is opt-in by an explicit flag, so the suite gets the normal mode',
    /process\.argv\.includes\('--static-only'\)/.test(self));
  ok('static-only mode poisons the MySQL pool module instead of loading it',
    /require\.cache\[dbPath\] = stub/.test(self) &&
    /static-only mode: the MySQL pool must not be used/.test(self));

  if (MODE === MODE_STATIC_ONLY) {
    ok('static-only: the MySQL pool module was replaced before any require could load it',
      mysqlPoolWasPoisoned === true && require('../config/db').__staticOnlyStub === true);
    ok('static-only: no Supabase client was ever constructed',
      require('../config/supabase').hasSupabaseConfig !== undefined &&
      // getSupabaseClient is lazy; nothing in this mode calls it.
      !/getSupabaseClient\(\)/.test(stripJsComments(read('scripts/adminDashboardAnalytics-probe.js')).split('runIndependentComparison')[0]));
  }
}

/* ---------------------------------------------------------------------------
   12. Independent comparison against BOTH required backends (normal mode only)
   -------------------------------------------------------------------------*/

/** SELECT-only: independently bucket a MySQL table's created_at values. */
async function independentMysqlCounts(db, table, windows) {
  const [rows] = await db.query(
    'SELECT UNIX_TIMESTAMP(created_at) AS ts FROM ' + table + ' WHERE created_at IS NOT NULL'
  );
  const counts = windows.map(() => 0);
  for (const row of rows) {
    const ms = Number(row.ts) * 1000;
    for (let i = 0; i < windows.length; i += 1) {
      if (ms >= windows[i].startMs && ms < windows[i].endMs) { counts[i] += 1; break; }
    }
  }
  return counts;
}

/**
 * SELECT-only: read a Supabase table's created_at values by DETERMINISTIC
 * bounded pagination with the SAME composite ordering the repository uses.
 * It is deliberately not one large `.limit()`, which a provider row cap could
 * silently truncate.
 */
async function independentSupabasePage(client, table, ceiling) {
  const pageSize = 1000;
  const timestamps = [];
  let offset = 0;
  while (offset < ceiling) {
    const size = Math.min(pageSize, ceiling - offset);
    const { data, error } = await client
      .from(table)
      .select('id, created_at')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + size - 1);
    if (error) throw error;
    const page = Array.isArray(data) ? data : [];
    for (const row of page) timestamps.push(Date.parse(row.created_at));
    offset += page.length;
    if (page.length < size) return { timestamps, capped: false };
  }
  return { timestamps, capped: true };
}

function bucketInto(windows, values) {
  const counts = windows.map(() => 0);
  for (const ms of values) {
    if (!Number.isFinite(ms)) continue;
    for (let i = 0; i < windows.length; i += 1) {
      if (ms >= windows[i].startMs && ms < windows[i].endMs) { counts[i] += 1; break; }
    }
  }
  return counts;
}

async function compareBackend(mode, label) {
  const previous = {
    AUTH_DATA_SOURCE: process.env.AUTH_DATA_SOURCE,
    BUILDING_DATA_SOURCE: process.env.BUILDING_DATA_SOURCE,
  };
  process.env.AUTH_DATA_SOURCE = mode;
  process.env.BUILDING_DATA_SOURCE = mode;

  try {
    const nowMs = Date.now();
    const windows = probeWindows(nowMs, 12);
    const model = await analytics.loadAdminDashboardAnalytics({ now: nowMs });

    ok(`${label}: the live model resolves to state "ready"`, model.state === 'ready');
    if (model.state !== 'ready') return;

    ok(`${label}: the live model carries exactly 12 ordered Asia/Manila months`,
      model.months.length === 12 &&
      model.months.every((m, i) => {
        const parts = probeManilaParts(windows[i].startMs);
        return m.key === String(parts.year).padStart(4, '0') + '-' + String(parts.month).padStart(2, '0');
      }));

    if (mode === 'mysql') {
      const db = require('../config/db');
      const [[userRow]] = await db.query('SELECT COUNT(*) AS total FROM users');
      const [[buildingRow]] = await db.query('SELECT COUNT(*) AS total FROM buildings');
      const [roleRows] = await db.query('SELECT role, COUNT(*) AS c FROM users GROUP BY role');
      const roleMap = Object.create(null);
      for (const row of roleRows) roleMap[String(row.role)] = Number(row.c);

      ok(`${label}: total users matches an independent COUNT(*)`,
        model.totals.users === Number(userRow.total));
      ok(`${label}: total buildings matches an independent COUNT(*)`,
        model.totals.buildings === Number(buildingRow.total));
      ok(`${label}: every role count matches an independent GROUP BY`,
        analytics.ROLE_KEYS.every((r) => model.roleCounts[r] === (roleMap[r] || 0)));
      ok(`${label}: the four role counts SUM to the independent total`,
        analytics.ROLE_KEYS.reduce((s, r) => s + model.roleCounts[r], 0) === Number(userRow.total));

      const userCounts = await independentMysqlCounts(db, 'users', windows);
      const buildingCounts = await independentMysqlCounts(db, 'buildings', windows);
      ok(`${label}: monthly account additions match an independent full-table bucketing`,
        model.months.every((m, i) => m.userAdditions === userCounts[i]));
      ok(`${label}: monthly building additions match an independent full-table bucketing`,
        model.months.every((m, i) => m.buildingAdditions === buildingCounts[i]));
    } else {
      const userRepository = require('../repositories/userRepository');
      const buildingRepository = require('../repositories/buildingRepository');
      const { getSupabaseClient } = require('../config/supabase');

      const userTotal = Number(await userRepository.countAll());
      const buildingTotal = Number(await buildingRepository.countAll());
      ok(`${label}: total users matches the independent userRepository count`,
        model.totals.users === userTotal);
      ok(`${label}: total buildings matches the independent buildingRepository count`,
        model.totals.buildings === buildingTotal);
      ok(`${label}: every role count matches an independent per-role exact count`,
        (await Promise.all(analytics.ROLE_KEYS.map((r) => userRepository.countByRole(r))))
          .every((count, i) => model.roleCounts[analytics.ROLE_KEYS[i]] === Number(count)));
      ok(`${label}: the four role counts SUM to the independent total`,
        analytics.ROLE_KEYS.reduce((s, r) => s + model.roleCounts[r], 0) === userTotal);

      const client = getSupabaseClient();
      const ceiling = analyticsRepository.MAX_WINDOW_ROWS;
      for (const [table, series] of [['users', 'userAdditions'], ['buildings', 'buildingAdditions']]) {
        const page = await independentSupabasePage(client, table, ceiling);
        ok(`${label}: the independent ${table} read completed without hitting its ceiling`,
          page.capped === false);
        const counts = bucketInto(windows, page.timestamps);
        ok(`${label}: monthly ${table} additions match an independent paginated bucketing`,
          model.months.every((m, i) => m[series] === counts[i]));
      }
    }
  } finally {
    if (previous.AUTH_DATA_SOURCE === undefined) delete process.env.AUTH_DATA_SOURCE;
    else process.env.AUTH_DATA_SOURCE = previous.AUTH_DATA_SOURCE;
    if (previous.BUILDING_DATA_SOURCE === undefined) delete process.env.BUILDING_DATA_SOURCE;
    else process.env.BUILDING_DATA_SOURCE = previous.BUILDING_DATA_SOURCE;
  }
}

async function runIndependentComparison() {
  console.log('[12] Independent comparison against BOTH required backends (SELECT-only)');

  const legs = [];
  let mysqlPool = null;

  // ---- MySQL leg (REQUIRED) ----
  let mysqlReachable = false;
  try {
    mysqlPool = require('../config/db');
    await mysqlPool.query('SELECT 1');
    mysqlReachable = true;
  } catch (error) {
    mysqlReachable = false;
  }
  const mysqlDisposition = resolveBackendDisposition({
    mode: MODE, backend: 'mysql', configured: true, reachable: mysqlReachable,
    skipRequested: String(process.env.PROBE_SKIP_MYSQL || '') === '1',
  });
  ok('MySQL is a REQUIRED comparison backend and is available',
    mysqlDisposition.action === 'execute');
  if (mysqlDisposition.action === 'execute') {
    await compareBackend('mysql', 'MySQL');
    legs.push({ backend: 'mysql', action: 'execute', executed: true });
  } else {
    note(`MySQL comparison did not execute (${mysqlDisposition.reason}). This is a FAILURE, not a skip.`);
    legs.push({ backend: 'mysql', action: mysqlDisposition.action, executed: false });
  }

  // ---- Supabase leg (REQUIRED) ----
  const supabaseConfigured = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  let supabaseReachable = false;
  if (supabaseConfigured) {
    try {
      await require('../repositories/userRepository').countAll();
      supabaseReachable = true;
    } catch (error) {
      supabaseReachable = false;
    }
  }
  const supabaseDisposition = resolveBackendDisposition({
    mode: MODE, backend: 'supabase', configured: supabaseConfigured, reachable: supabaseReachable,
    skipRequested: String(process.env.PROBE_SKIP_SUPABASE || '') === '1',
  });
  ok('Supabase is a REQUIRED comparison backend and is available (a skip request is refused)',
    supabaseDisposition.action === 'execute');
  if (supabaseDisposition.action === 'execute') {
    await compareBackend('supabase', 'Supabase');
    legs.push({ backend: 'supabase', action: 'execute', executed: true });
  } else {
    note(`Supabase comparison did not execute (${supabaseDisposition.reason}). This is a FAILURE, not a skip.`);
    legs.push({ backend: 'supabase', action: supabaseDisposition.action, executed: false });
  }

  ok('both required backend comparison legs executed', normalSuccessAllowed(legs));

  if (mysqlReachable && mysqlPool && typeof mysqlPool.end === 'function') {
    await mysqlPool.end();
  }
}

/* ---------------------------------------------------------------------------
   main
   -------------------------------------------------------------------------*/
async function main() {
  if (MODE === MODE_STATIC_ONLY) {
    console.log('M12.P1-D6 focused probe — STATIC-ONLY mode');
    console.log('Pure and static sections only. No database is initialized and no live');
    console.log('backend comparison runs, so this mode can NEVER report the normal success marker.');
  } else {
    console.log('M12.P1-D6 focused probe — real admin dashboard analytics');
    console.log('Server-free, browser-free, session-free; database access is SELECT-only.');
    console.log('BOTH backend comparison legs are REQUIRED; a skipped or unreachable one fails.');
  }
  console.log('');

  runMonthArithmetic();
  runBucketing();
  runStrictCounts();
  await runComposition();
  runStaticTruthfulness();
  runRendering();
  runDenial();
  runClientModule();
  runChartAccessibility();
  await runSupabasePagination();
  runBackendDisposition();

  if (MODE === MODE_NORMAL) {
    await runIndependentComparison();
  } else {
    note('Sections requiring a live backend are not part of static-only mode.');
  }

  console.log('');
  const successMarker = MODE === MODE_STATIC_ONLY ? STATIC_ONLY_SUCCESS_MARKER : NORMAL_SUCCESS_MARKER;
  const failureMarker = MODE === MODE_STATIC_ONLY ? STATIC_ONLY_FAILURE_MARKER : NORMAL_FAILURE_MARKER;

  if (failures.length === 0) {
    console.log(`${successMarker}: ${checks}/${checks} checks passed.`);
    return;
  }
  console.error(`${failureMarker}: ${failures.length}/${checks} check(s) failed.`);
  failures.forEach((failure) => console.error('  - ' + failure));
  process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[admin-dashboard-analytics-probe] FATAL:',
      error && error.message ? error.message : 'unknown error');
    process.exitCode = 1;
  });
}

module.exports = {
  MODE_NORMAL,
  MODE_STATIC_ONLY,
  NORMAL_SUCCESS_MARKER,
  STATIC_ONLY_SUCCESS_MARKER,
  resolveBackendDisposition,
  normalSuccessAllowed,
  contrastRatio,
  probeWindows,
  probeManilaParts,
  probeMonthStartMs,
};
