'use strict';

/* ========================================
   CampuSphere - Admin Dashboard Analytics Repository (dual backend)
   M12.P1-D6.

   SELECT-ONLY data access for the real admin-dashboard analytics model. It
   exists so `controllers/adminController.js` contains NO analytics SQL and so
   the Asia/Manila month arithmetic in `services/adminAnalyticsService.js` can
   stay pure.

   Backend selection follows the SAME switches the rest of the dashboard uses,
   and the two are INDEPENDENT (a supported mixed configuration is normal):
     - user rows / role counts -> config/authDataSource.js  (AUTH_DATA_SOURCE)
     - building rows           -> config/mapRuntime.js      (BUILDING_DATA_SOURCE)

   What this module does NOT do, by design:
     - It writes nothing. There is no INSERT/UPDATE/DELETE/DDL/RPC path, no
       page-view, visit, session, event, or analytics table, and no cache or
       persisted result. Every method is a bounded read of columns that already
       exist (`users.created_at`, `users.role`, `buildings.created_at`).
     - It never reads req / res / sessions / res.locals / app.locals / browser
       globals, and imports no controller, route, view, or middleware.
     - It never returns an identifier, email, name, or any per-row payload.
       Timestamp readers return NUMBERS ONLY (epoch milliseconds); counters
       return NUMBERS ONLY. The row `id` used to make Supabase paging
       deterministic is consumed internally and never leaves this module.

   Deferred backend wiring
   -----------------------
   `config/db.js`, `config/supabase.js`, and the two sibling repositories are
   required LAZILY, inside the functions that use them. Importing this module
   therefore creates no MySQL pool and no Supabase client, so a purely static
   analysis of the D6 contract can load it without initializing any database.

   Strict counting
   ---------------
   `parseExactCount` is the ONE parser every count in the D6 path goes through.
   It accepts a nonnegative safe-integer number, or a digit-only nonnegative
   integer string within Number.MAX_SAFE_INTEGER, and rejects everything else —
   null, undefined, booleans, blanks, negatives, fractions, NaN, Infinity,
   arbitrary strings, and unsafe integers. There is no `Number(x) || 0` anywhere
   in this module: a value that cannot be parsed makes the read FAIL, because
   silently substituting 0 would publish a fabricated number.

   Range semantics (shared by both backends and both entities):
     readUserAdditionTimestamps / readBuildingAdditionTimestamps take
     { startMs, endMs, limit } and apply a HALF-OPEN window:

         startMs <= created_at < endMs

     The start instant is INCLUDED and the end instant is EXCLUDED, so a row
     sitting exactly on a month boundary is counted once and only once by the
     window that starts on it. Both bounds are absolute instants (epoch
     milliseconds), never local wall-clock text, so neither the MySQL session
     timezone nor the Node process timezone can move a boundary.

   Fail-closed cap:
     Each reader returns { timestampsMs, capped }. `capped` is true when the
     backend returned as many rows as the caller's limit allowed, meaning the
     window may be truncated. The service treats a capped read as UNAVAILABLE
     rather than reporting a silently low number.
   ======================================== */

const authDataSource = require('../config/authDataSource');
const mapRuntime = require('../config/mapRuntime');

// The four roles the dashboard reports. Fixed here as well as in the service
// so a single edit cannot silently add or drop a category.
const ANALYTICS_ROLE_KEYS = Object.freeze([
  'student-cspc',
  'instructor',
  'admin',
  'guest',
]);

// Hard ceiling for one window read, and the Supabase page size beneath it.
// The ceiling exists so an unexpectedly large table can never turn into an
// unbounded scan; exceeding it fails closed in the service.
const MAX_WINDOW_ROWS = 20000;
const SUPABASE_PAGE_SIZE = 1000;

/* ---------------------------------------------------------------------------
   Deferred backend accessors — nothing is constructed at import time.
   -------------------------------------------------------------------------*/
function mysqlPool() { return require('../config/db'); }
function supabaseClient() { return require('../config/supabase').getSupabaseClient(); }
function userRepo() { return require('./userRepository'); }
function buildingRepo() { return require('./buildingRepository'); }

/**
 * PURE: the ONE exact count parser for the whole D6 path.
 *
 * @param {*} value raw value from a backend, a mock, or a caller
 * @returns {number|null} the exact count, or null when the value is not a
 *   valid count. NEVER returns 0 as a stand-in for an unusable value.
 */
function parseExactCount(value) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value === 'string') {
    // Digit-only, so '', ' ', '-1', '1.5', '1e3', '0x10', and 'abc' are all out.
    if (!/^[0-9]+$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  // booleans, null, undefined, bigint, objects, arrays, symbols, functions
  return null;
}

/** Redact a Supabase error down to a plain, safe Error. */
function supabaseError(method, error) {
  const raw = error && typeof error.message === 'string' ? error.message : '';
  // Strip anything that could carry a host, URL, JWT, or key fragment.
  const safe = raw
    .replace(/https?:\/\/\S+/gi, '[redacted]')
    .replace(/eyJ[A-Za-z0-9_\-.]{10,}/g, '[redacted]')
    .slice(0, 200);
  return new Error(`analyticsRepository.${method}: ${safe || 'read failed'}`);
}

/** PURE: clamp a caller-supplied limit into 1..MAX_WINDOW_ROWS. */
function clampLimit(limit) {
  const n = Number(limit);
  if (!Number.isFinite(n)) return MAX_WINDOW_ROWS;
  return Math.max(1, Math.min(MAX_WINDOW_ROWS, Math.floor(n)));
}

/** PURE: validate a half-open instant range; throws on anything unusable. */
function normalizeRange(range, method) {
  const startMs = Number(range && range.startMs);
  const endMs = Number(range && range.endMs);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || !(endMs > startMs)) {
    throw new Error(`analyticsRepository.${method}: a finite startMs < endMs range is required`);
  }
  return { startMs, endMs, limit: clampLimit(range && range.limit) };
}

/* ---------------------------------------------------------------------------
   MySQL readers
   -------------------------------------------------------------------------*/

/**
 * MySQL half-open created_at window for one table.
 *
 * The bounds are pushed into SQL as FROM_UNIXTIME(?) so the comparison happens
 * against the TIMESTAMP column in the SAME representation MySQL stores, and the
 * SELECT returns UNIX_TIMESTAMP(created_at) so the value that comes back to
 * Node is an absolute instant rather than a timezone-dependent wall-clock
 * string. `id` is the tiebreaker that makes the LIMIT slice deterministic when
 * two rows share a timestamp; it is used for ordering only and never returned.
 * `table` is NEVER caller-controlled: it comes from the two literal call sites.
 */
async function mysqlWindow(table, range) {
  const startSeconds = range.startMs / 1000;
  const endSeconds = range.endMs / 1000;
  const [rows] = await mysqlPool().query(
    'SELECT UNIX_TIMESTAMP(created_at) AS created_epoch FROM ' + table +
    ' WHERE created_at IS NOT NULL AND created_at >= FROM_UNIXTIME(?) AND created_at < FROM_UNIXTIME(?)' +
    ' ORDER BY created_at ASC, id ASC LIMIT ?',
    [startSeconds, endSeconds, range.limit]
  );
  const timestampsMs = [];
  for (const row of rows) {
    const seconds = Number(row.created_epoch);
    if (!Number.isFinite(seconds)) {
      throw new Error('analyticsRepository.mysqlWindow: a row carried an unusable created_at');
    }
    timestampsMs.push(seconds * 1000);
  }
  return { timestampsMs, capped: rows.length >= range.limit };
}

/* ---------------------------------------------------------------------------
   Supabase readers
   -------------------------------------------------------------------------*/

/**
 * Supabase half-open created_at window for one table, by DETERMINISTIC bounded
 * pagination.
 *
 * Ordering is composite — `created_at` ascending, then `id` ascending — so rows
 * sharing a timestamp keep a stable total order across page requests. Without
 * the `id` tiebreaker a row could be returned twice, or skipped entirely,
 * between two `.range()` calls. `id` is selected for that ordering only: the
 * returned object exposes timestamps and the cap flag, never an identifier.
 *
 * The loop is bounded by the caller's limit, which `clampLimit` has already
 * held at or below MAX_WINDOW_ROWS, so the request count is bounded by
 * limit / SUPABASE_PAGE_SIZE. It is NOT one large limit that a provider row cap
 * could silently truncate.
 *
 * @param {object} client Supabase client (injected so this is testable)
 */
async function supabaseWindow(client, table, range, method) {
  const startISO = new Date(range.startMs).toISOString();
  const endISO = new Date(range.endMs).toISOString();
  const timestampsMs = [];
  let offset = 0;

  while (offset < range.limit) {
    const pageSize = Math.min(SUPABASE_PAGE_SIZE, range.limit - offset);
    const { data, error } = await client
      .from(table)
      .select('id, created_at')
      .not('created_at', 'is', null)
      .gte('created_at', startISO)
      .lt('created_at', endISO)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw supabaseError(method, error);

    const page = Array.isArray(data) ? data : [];
    for (const row of page) {
      const ms = Date.parse(row && row.created_at);
      if (!Number.isFinite(ms)) {
        throw new Error(`analyticsRepository.${method}: a row carried an unusable created_at`);
      }
      timestampsMs.push(ms);
    }
    offset += page.length;
    if (page.length < pageSize) return { timestampsMs, capped: false };
  }
  // The loop only exits here after consuming the full allowance, which means
  // more rows may remain unread.
  return { timestampsMs, capped: true };
}

/* ---------------------------------------------------------------------------
   Public read methods
   -------------------------------------------------------------------------*/

/**
 * User rows created inside a half-open instant window.
 * @param {{startMs:number,endMs:number,limit?:number}} range
 * @returns {Promise<{timestampsMs:number[],capped:boolean}>}
 */
async function readUserAdditionTimestamps(range) {
  const normalized = normalizeRange(range, 'readUserAdditionTimestamps');
  return authDataSource.isSupabase()
    ? supabaseWindow(supabaseClient(), 'users', normalized, 'readUserAdditionTimestamps')
    : mysqlWindow('users', normalized);
}

/**
 * Building rows created inside a half-open instant window.
 * @param {{startMs:number,endMs:number,limit?:number}} range
 * @returns {Promise<{timestampsMs:number[],capped:boolean}>}
 */
async function readBuildingAdditionTimestamps(range) {
  const normalized = normalizeRange(range, 'readBuildingAdditionTimestamps');
  return mapRuntime.isBuildingSupabase()
    ? supabaseWindow(supabaseClient(), 'buildings', normalized, 'readBuildingAdditionTimestamps')
    : mysqlWindow('buildings', normalized);
}

/**
 * Exact account count per reported role.
 *
 * MySQL answers with ONE bounded GROUP BY. The four reported roles are
 * initialised to 0 — a role with no accounts legitimately has zero — but a row
 * carrying a role OUTSIDE the reported set is a REJECTION, not something to
 * discard: it would mean the four buckets no longer describe the table.
 * Supabase answers with one exact head-count per reported role, each of which
 * must parse.
 *
 * Every value goes through parseExactCount; an unusable one throws rather than
 * becoming 0.
 *
 * @returns {Promise<Record<string, number>>} exactly the four reported roles
 */
async function countUsersByRole() {
  const counts = {};
  for (const role of ANALYTICS_ROLE_KEYS) counts[role] = 0;

  if (authDataSource.isSupabase()) {
    for (const role of ANALYTICS_ROLE_KEYS) {
      const parsed = parseExactCount(await userRepo().countByRole(role));
      if (parsed === null) {
        throw new Error('analyticsRepository.countUsersByRole: a role count was not an exact count');
      }
      counts[role] = parsed;
    }
    return counts;
  }

  const [rows] = await mysqlPool().query(
    'SELECT role, COUNT(*) AS role_count FROM users GROUP BY role'
  );
  for (const row of rows) {
    const role = row.role == null ? '' : String(row.role);
    if (!Object.prototype.hasOwnProperty.call(counts, role)) {
      // An unreported role exists in the table: the four buckets would no
      // longer sum to the user total, so this read is not usable.
      throw new Error('analyticsRepository.countUsersByRole: an unreported role was returned');
    }
    const parsed = parseExactCount(row.role_count);
    if (parsed === null) {
      throw new Error('analyticsRepository.countUsersByRole: a role count was not an exact count');
    }
    counts[role] = parsed;
  }
  return counts;
}

/** Exact total account count. @returns {Promise<number>} */
async function countUsersTotal() {
  const raw = authDataSource.isSupabase()
    ? await userRepo().countAll()
    : (await mysqlPool().query('SELECT COUNT(*) AS total FROM users'))[0][0].total;
  const parsed = parseExactCount(raw);
  if (parsed === null) {
    throw new Error('analyticsRepository.countUsersTotal: the total was not an exact count');
  }
  return parsed;
}

/** Exact total building count. @returns {Promise<number>} */
async function countBuildingsTotal() {
  const raw = mapRuntime.isBuildingSupabase()
    ? await buildingRepo().countAll()
    : (await mysqlPool().query('SELECT COUNT(*) AS total FROM buildings'))[0][0].total;
  const parsed = parseExactCount(raw);
  if (parsed === null) {
    throw new Error('analyticsRepository.countBuildingsTotal: the total was not an exact count');
  }
  return parsed;
}

module.exports = {
  ANALYTICS_ROLE_KEYS,
  MAX_WINDOW_ROWS,
  SUPABASE_PAGE_SIZE,
  parseExactCount,
  clampLimit,
  normalizeRange,
  // Exported so the focused probe can drive the deterministic paging contract
  // against an injected fake client, with no database involved. It returns the
  // same id-free shape as the public readers.
  supabaseWindow,
  readUserAdditionTimestamps,
  readBuildingAdditionTimestamps,
  countUsersByRole,
  countUsersTotal,
  countBuildingsTotal,
};
