'use strict';

/* ========================================
   CampuSphere - Admin Dashboard Analytics Service
   M12.P1-D6: real admin dashboard analytics.

   Builds the render-ready analytics model for GET /admin from data that ALREADY
   EXISTS in the configured backends. It replaces the hard-coded illustrative
   arrays the dashboard previously drew, and it introduces no new kind of data:

     "Account additions"  = user rows whose created_at falls in a calendar month.
     "Building additions" = building rows whose created_at falls in that month.

   Those are ROW-CREATION counts. They are NOT visits, sessions, logins, map
   views, page views, or any other usage signal, and nothing in CampuSphere
   records such a signal. This service reads only `users.created_at`,
   `users.role` and `buildings.created_at`; it creates no tracking table, adds
   no schema or migration, writes nothing, persists no result, and exposes no
   endpoint. It never touches req / res / sessions / cookies / IP addresses /
   user agents.

   ---------------------------------------------------------------------------
   Asia/Manila calendar months
   ---------------------------------------------------------------------------
   Every month boundary is an Asia/Manila calendar boundary, not a UTC one and
   not the host machine's local one. The Philippines has observed no daylight
   saving time since 1978, so Asia/Manila is a FIXED UTC+08:00 offset; that is
   pinned in MANILA_UTC_OFFSET_MINUTES and used for both directions of the
   conversion. Fixing the offset (rather than formatting through Intl) keeps the
   arithmetic exact, allocation-free, and identical on every host regardless of
   the process timezone or ICU build.

   A month window is HALF-OPEN:

       start (inclusive)  <=  created_at  <  end (exclusive)

   so a row created at exactly 00:00:00.000 Manila on the first of a month
   belongs to that month and to no other. Adjacent windows therefore tile the
   period without gaps and without double counting. Windows are derived with
   Date.UTC month arithmetic, which normalises month indexes outside 1..12, so
   year rollover is exact and February automatically spans 29 days in a leap
   year (its window ends when March begins).

   ---------------------------------------------------------------------------
   Truthfulness contract
   ---------------------------------------------------------------------------
   A genuine successful count of zero is reported as 0. A failed, truncated, or
   MALFORMED read is NEVER reported as 0: the affected series becomes null and
   its status becomes 'unavailable', so the dashboard can say so instead of
   drawing an invented flat line. Errors are swallowed here and surfaced only as
   that status plus a single fixed sanitized message; no raw database error, SQL
   text, stack, credential, host, or backend identifier ever reaches the model.

   Strict acceptance
   -----------------
   Every count arrives through `parseExactCount`, the single parser owned by
   `repositories/analyticsRepository.js`. There is no `Number(x) || 0` in this
   path. On top of that, the users side is accepted ONLY when:

     - the role map has EXACTLY the four reported own keys, no more and no less;
     - every role value and the total parse as exact counts; and
     - the four role counts SUM to the total user count.

   The sum invariant is meaningful because `users.role` is constrained to those
   four values, so a mismatch means the four buckets no longer describe the
   table — a condition under which reporting them would be misleading. Any of
   these failures makes the users side unavailable, and the overall model can
   never stay 'ready' once either side has failed.
   ======================================== */

const analyticsRepositoryModule = require('../repositories/analyticsRepository');

/* The injectable data source (tests and the gate pass a mock) and the ONE exact
   count parser, deliberately separated: swapping the repository must not be
   able to swap in a laxer parser. */
const defaultRepository = analyticsRepositoryModule;
const parseExactCount = analyticsRepositoryModule.parseExactCount;

const TIMEZONE = 'Asia/Manila';
// Asia/Manila is UTC+08:00 year-round (no DST since 1978).
const MANILA_UTC_OFFSET_MINUTES = 480;
const MONTH_COUNT = 12;

// The exact four reported roles, in display order. Pinned here as well as in
// the repository so one edit cannot silently add or drop a category.
const ROLE_KEYS = Object.freeze(['student-cspc', 'instructor', 'admin', 'guest']);
const ROLE_LABELS = Object.freeze({
  'student-cspc': 'Students',
  instructor: 'Instructors',
  admin: 'Administrators',
  guest: 'Guests',
});

// Fixed English abbreviations: deterministic on every host, no Intl/locale
// dependency, and stable enough for the quality gate to pin.
const MONTH_ABBREVIATIONS = Object.freeze([
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]);

const STATE_READY = 'ready';
const STATE_PARTIAL = 'partial';
const STATE_UNAVAILABLE = 'unavailable';

// The ONE sanitized message the dashboard may show when a read fails. It names
// no table, column, backend, host, or error.
const UNAVAILABLE_MESSAGE = 'Analytics data is unavailable right now.';

/* ---------------------------------------------------------------------------
   Pure Asia/Manila month arithmetic
   -------------------------------------------------------------------------*/

/** PURE: coerce a Date / number / ISO string to epoch ms, or null. */
function toInstantMs(value) {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/**
 * PURE: the Asia/Manila calendar year and 1-12 month containing an instant.
 * @param {number} instantMs epoch milliseconds
 */
function manilaCalendarParts(instantMs) {
  const shifted = new Date(instantMs + MANILA_UTC_OFFSET_MINUTES * 60000);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
}

/**
 * PURE: the exact instant at which an Asia/Manila calendar month begins.
 *
 * `month` may fall outside 1..12; Date.UTC normalises it, which is how year
 * rollover is handled (month 0 -> previous December, month 13 -> next January).
 *
 * @param {number} year   4-digit Manila calendar year
 * @param {number} month  1-12, or outside that range to roll over
 * @returns {number} epoch milliseconds
 */
function manilaMonthStartMs(year, month) {
  return Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - MANILA_UTC_OFFSET_MINUTES * 60000;
}

/** PURE: 'YYYY-MM' key for a Manila calendar month. */
function monthKey(year, month) {
  return String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0');
}

/** PURE: 'Mon YYYY' display label for a Manila calendar month. */
function monthLabel(year, month) {
  return MONTH_ABBREVIATIONS[month - 1] + ' ' + String(year);
}

/**
 * PURE: the latest `count` Asia/Manila calendar months, oldest first, ending
 * with the month that CONTAINS `now`.
 *
 * Each entry is half-open: startMs is inclusive, endMs is exclusive, and
 * entry[i].endMs === entry[i + 1].startMs so the months tile exactly.
 *
 * @param {Date|number|string} now
 * @param {number} [count=12]
 * @returns {Array<{key:string,label:string,year:number,month:number,startMs:number,endMs:number}>}
 * @throws {TypeError} when `now` is not a usable instant
 */
function buildMonthWindows(now, count = MONTH_COUNT) {
  const nowMs = toInstantMs(now);
  if (nowMs === null) throw new TypeError('adminAnalyticsService: a valid instant is required');
  const total = Number(count);
  if (!Number.isInteger(total) || total < 1) {
    throw new TypeError('adminAnalyticsService: month count must be a positive integer');
  }

  const current = manilaCalendarParts(nowMs);
  const windows = [];
  for (let back = total - 1; back >= 0; back -= 1) {
    const startMs = manilaMonthStartMs(current.year, current.month - back);
    const endMs = manilaMonthStartMs(current.year, current.month - back + 1);
    // Re-derive the calendar identity FROM the boundary instant so a rolled-over
    // month index can never produce a label like "Month 0" or "2025-13".
    const parts = manilaCalendarParts(startMs);
    windows.push({
      key: monthKey(parts.year, parts.month),
      label: monthLabel(parts.year, parts.month),
      year: parts.year,
      month: parts.month,
      startMs,
      endMs,
    });
  }
  return windows;
}

/**
 * PURE: bucket creation instants into month windows.
 *
 * Assignment is half-open (start inclusive, end exclusive). A value that is not
 * a finite instant is counted as INVALID rather than dropped, so the caller can
 * fail closed instead of reporting a silently low number.
 *
 * @param {Array<number|string|Date>} values
 * @param {Array<{startMs:number,endMs:number}>} windows
 * @returns {{counts:number[], invalid:number, outside:number}}
 */
function bucketByMonth(values, windows) {
  const counts = windows.map(() => 0);
  let invalid = 0;
  let outside = 0;

  for (const value of (Array.isArray(values) ? values : [])) {
    const ms = toInstantMs(value);
    if (ms === null) { invalid += 1; continue; }
    let placed = false;
    for (let i = 0; i < windows.length; i += 1) {
      // Inclusive start, EXCLUSIVE end: a row exactly on windows[i].endMs
      // belongs to windows[i + 1], never to both.
      if (ms >= windows[i].startMs && ms < windows[i].endMs) {
        counts[i] += 1;
        placed = true;
        break;
      }
    }
    if (!placed) outside += 1;
  }
  return { counts, invalid, outside };
}

/**
 * PURE: strictly accept a raw backend role map, or reject it entirely.
 *
 * The map must be a plain object carrying EXACTLY the four reported roles as
 * own keys — a missing key and an extra key are both rejections — and every
 * value must pass `parseExactCount`. A legitimate zero must be supplied
 * explicitly as 0; a zero is never manufactured for a key that is absent,
 * malformed, negative, fractional, non-numeric, or an unsafe integer.
 *
 * @param {*} raw
 * @returns {Record<string, number>|null} the exact counts, or null on rejection
 */
function parseRoleCounts(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  // Exactly four OWN keys: this rejects an extra role without needing to know
  // what it is, and rejects a missing role in the loop below.
  const ownKeys = Object.keys(raw);
  if (ownKeys.length !== ROLE_KEYS.length) return null;

  const out = {};
  for (const role of ROLE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(raw, role)) return null;
    const count = parseExactCount(raw[role]);
    if (count === null) return null;
    out[role] = count;
  }
  return out;
}

/**
 * PURE: do the four role counts account for exactly the total user population?
 * A mismatch means the reported buckets no longer describe the table.
 */
function roleCountsMatchTotal(roleCounts, total) {
  if (!roleCounts || !Number.isSafeInteger(total)) return false;
  let sum = 0;
  for (const role of ROLE_KEYS) {
    if (!Number.isSafeInteger(roleCounts[role])) return false;
    sum += roleCounts[role];
  }
  return sum === total;
}

/** PURE: the four role rows in display order, with labels and exact values. */
function buildRoleRows(roleCounts) {
  return ROLE_KEYS.map((role) => ({
    role,
    label: ROLE_LABELS[role],
    count: roleCounts ? roleCounts[role] : null,
  }));
}

/* ---------------------------------------------------------------------------
   Model assembly
   -------------------------------------------------------------------------*/

/** PURE: the 12 month rows with both series, honouring per-series availability. */
function buildMonthRows(windows, userCounts, buildingCounts) {
  return windows.map((window, index) => ({
    key: window.key,
    label: window.label,
    userAdditions: userCounts ? userCounts[index] : null,
    buildingAdditions: buildingCounts ? buildingCounts[index] : null,
  }));
}

/** PURE: overall state from the two per-series statuses. */
function resolveState(usersReady, buildingsReady) {
  if (usersReady && buildingsReady) return STATE_READY;
  if (!usersReady && !buildingsReady) return STATE_UNAVAILABLE;
  return STATE_PARTIAL;
}

/**
 * PURE: is this a genuine, fully successful all-zero result?
 * Only true when BOTH series are ready and every reported number is exactly 0.
 */
function isGenuineZero(model) {
  if (!model || model.state !== STATE_READY) return false;
  const monthsZero = model.months.every(
    (month) => month.userAdditions === 0 && month.buildingAdditions === 0
  );
  const rolesZero = ROLE_KEYS.every((role) => model.roleCounts[role] === 0);
  return monthsZero && rolesZero && model.totals.users === 0 && model.totals.buildings === 0;
}

/**
 * Load the real admin dashboard analytics model.
 *
 * Never throws and never rejects: any failure inside a read collapses that
 * series to `null` with an 'unavailable' status. The two series are resolved
 * INDEPENDENTLY, which also means a supported mixed configuration (for example
 * AUTH_DATA_SOURCE=supabase with BUILDING_DATA_SOURCE=mysql) degrades one side
 * without inventing numbers for the other.
 *
 * @param {{now?: Date|number|string, repository?: object, monthCount?: number}} [options]
 * @returns {Promise<object>} deterministic, render-ready model
 */
async function loadAdminDashboardAnalytics(options) {
  const settings = options || {};
  const repository = settings.repository || defaultRepository;
  const monthCount = settings.monthCount === undefined ? MONTH_COUNT : settings.monthCount;

  let windows;
  try {
    windows = buildMonthWindows(settings.now === undefined ? Date.now() : settings.now, monthCount);
  } catch (error) {
    // An unusable clock is not something to paper over with zeroes.
    return unavailableModel([]);
  }

  const rowLimit = repository.MAX_WINDOW_ROWS || 20000;
  const range = { startMs: windows[0].startMs, endMs: windows[windows.length - 1].endMs, limit: rowLimit };

  // Each read is isolated so one failing backend cannot blank the other.
  const [userSeries, buildingSeries, roleCounts, userTotal, buildingTotal] = await Promise.all([
    safeWindow(() => repository.readUserAdditionTimestamps(range), windows),
    safeWindow(() => repository.readBuildingAdditionTimestamps(range), windows),
    safeValue(() => repository.countUsersByRole()),
    safeValue(() => repository.countUsersTotal()),
    safeValue(() => repository.countBuildingsTotal()),
  ]);

  /* Every acceptance below is strict, and each one gates the NEXT: a role map
     is only compared against a total that itself parsed, so no comparison is
     ever made against a coerced value. */
  const parsedRoleCounts = roleCounts.ok ? parseRoleCounts(roleCounts.value) : null;
  const parsedUserTotal = userTotal.ok ? parseExactCount(userTotal.value) : null;
  const parsedBuildingTotal = buildingTotal.ok ? parseExactCount(buildingTotal.value) : null;

  const usersReady =
    userSeries.ok &&
    parsedRoleCounts !== null &&
    parsedUserTotal !== null &&
    roleCountsMatchTotal(parsedRoleCounts, parsedUserTotal);
  const buildingsReady = buildingSeries.ok && parsedBuildingTotal !== null;

  const model = {
    timezone: TIMEZONE,
    monthCount: windows.length,
    roleKeys: ROLE_KEYS.slice(),
    months: buildMonthRows(
      windows,
      usersReady ? userSeries.counts : null,
      buildingsReady ? buildingSeries.counts : null
    ),
    roleCounts: usersReady ? parsedRoleCounts : nullRoleCounts(),
    totals: {
      users: usersReady ? parsedUserTotal : null,
      buildings: buildingsReady ? parsedBuildingTotal : null,
    },
    status: {
      users: usersReady ? STATE_READY : STATE_UNAVAILABLE,
      buildings: buildingsReady ? STATE_READY : STATE_UNAVAILABLE,
    },
    state: resolveState(usersReady, buildingsReady),
    isZero: false,
    message: null,
  };
  model.roleRows = buildRoleRows(usersReady ? model.roleCounts : null);
  model.isZero = isGenuineZero(model);
  model.message = model.state === STATE_READY ? null : UNAVAILABLE_MESSAGE;
  return model;
}

/**
 * PURE: is a bucketing result usable as reported fact?
 *
 * Rejects an invalid timestamp (the read cannot be trusted) AND any row that
 * fell OUTSIDE the requested windows. The repository queries the exact
 * half-open range the windows describe, so an out-of-window row means the
 * returned set does not match the range that was asked for — reporting the
 * in-window subset as the answer would be a fabricated number.
 */
function bucketResultIsUsable(bucketed) {
  return !!bucketed && Array.isArray(bucketed.counts) &&
    bucketed.invalid === 0 && bucketed.outside === 0;
}

/** Run a windowed read, bucket it, and fail closed on error, cap, or bad data. */
async function safeWindow(read, windows) {
  try {
    const result = await read();
    if (!result || !Array.isArray(result.timestampsMs)) return { ok: false, counts: null };
    // A capped read may be missing rows; reporting the partial total as fact
    // would be a fabricated number.
    if (result.capped !== false) return { ok: false, counts: null };
    const bucketed = bucketByMonth(result.timestampsMs, windows);
    if (!bucketResultIsUsable(bucketed)) return { ok: false, counts: null };
    return { ok: true, counts: bucketed.counts };
  } catch (error) {
    return { ok: false, counts: null };
  }
}

/** Run a scalar/map read and fail closed on error. */
async function safeValue(read) {
  try {
    const value = await read();
    if (value === undefined || value === null) return { ok: false, value: null };
    return { ok: true, value };
  } catch (error) {
    return { ok: false, value: null };
  }
}

/** PURE: the four role keys with no value at all (never zero). */
function nullRoleCounts() {
  const out = {};
  for (const role of ROLE_KEYS) out[role] = null;
  return out;
}

/** PURE: the fully unavailable model — nulls everywhere, never zeroes. */
function unavailableModel(months) {
  const model = {
    timezone: TIMEZONE,
    monthCount: Array.isArray(months) ? months.length : 0,
    roleKeys: ROLE_KEYS.slice(),
    months: Array.isArray(months) ? months : [],
    roleCounts: nullRoleCounts(),
    totals: { users: null, buildings: null },
    status: { users: STATE_UNAVAILABLE, buildings: STATE_UNAVAILABLE },
    state: STATE_UNAVAILABLE,
    isZero: false,
    message: UNAVAILABLE_MESSAGE,
  };
  model.roleRows = buildRoleRows(null);
  return model;
}

module.exports = {
  TIMEZONE,
  MANILA_UTC_OFFSET_MINUTES,
  MONTH_COUNT,
  ROLE_KEYS,
  ROLE_LABELS,
  MONTH_ABBREVIATIONS,
  STATE_READY,
  STATE_PARTIAL,
  STATE_UNAVAILABLE,
  UNAVAILABLE_MESSAGE,
  toInstantMs,
  manilaCalendarParts,
  manilaMonthStartMs,
  monthKey,
  monthLabel,
  buildMonthWindows,
  bucketByMonth,
  bucketResultIsUsable,
  parseExactCount,
  parseRoleCounts,
  roleCountsMatchTotal,
  buildRoleRows,
  buildMonthRows,
  resolveState,
  isGenuineZero,
  loadAdminDashboardAnalytics,
};
