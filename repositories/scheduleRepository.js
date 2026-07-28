'use strict';

/* ========================================
   CampuSphere - Schedule Repository (dual backend)
   Milestone 11, Section 11.4.

   Data access for the `room_schedules` table (MySQL: database/schema.sql;
   Supabase: database/supabase/0012_room_schedules.sql, owner-applied), per
   the approved domain contract (docs/room-scheduling-domain-contract.md).

   Unlike the older read repositories, this module — per the approved
   Section 11.4 design — switches backends INTERNALLY via
   config/scheduleDataSource.js (SCHEDULE_DATA_SOURCE=mysql|supabase,
   default mysql), so later controllers call one method regardless of mode:
   - MySQL path: parameterized queries on the shared pool (config/db.js).
   - Supabase path: server-only client (config/supabase.js, service role).

   Boundary rules:
   - Never reads req / res / sessions / res.locals / app.locals / browser
     globals; no route, controller, view, middleware, or public/ imports.
   - Explicit column lists only; never SELECT *.
   - Supabase failures are rethrown as plain Error objects prefixed with
     `scheduleRepository.<method>:` carrying only a redacted message
     (JWTs, Supabase URLs/hosts, IPs, and noisy text stripped — never
     keys, URLs, headers, or other secret-like values).

   Stable row shape (identical in both modes):
     id, title, schedule_date ('YYYY-MM-DD'), start_time ('HH:MM'),
     end_time ('HH:MM'), audience, status, building_id, building_name,
     location_type, location_label, floor_label, description,
     created_by_user_id, created_at, updated_at (ISO strings).

   Filter semantics (listSchedules / countSchedules):
     { buildingId, from, to, audience, status, locationType,
       locationLabel, floorLabel, limit, offset }
   - buildingId must be a positive integer; from/to must be strict
     YYYY-MM-DD. An INVALID provided filter never broadens the result:
     it makes the query impossible (empty list / count 0) instead of
     being silently dropped.
   - audience/status are applied as plain equality (an unsupported value
     simply matches nothing; allowlist validation is controller work).
   - limit: default 50, clamped to 1..100. offset: default 0, clamped
     to 0..10000.
   - List order: schedule_date ASC, start_time ASC, id ASC.
   ======================================== */

const db = require('../config/db');
const { getSupabaseClient } = require('../config/supabase');
const scheduleDataSource = require('../config/scheduleDataSource');
// M12.P1-D4: proven metacharacter encoders for the optional `q` text search.
const {
  SEARCH_MAX,
  SEARCH_SCAN_MAX,
  SEARCH_SCAN_PAGES,
  mysqlLikePattern,
  supabaseIlikePattern,
  supabaseScheduleOrExpression,
  searchNeedsExactPostFilter,
  matchesScheduleSearch,
} = require('../utils/scheduleSearch');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;
const MAX_OFFSET = 10000;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

// Sentinel: a filter that was provided but invalid. Queries carrying it
// return no rows rather than ignoring (and thereby broadening) the filter.
const INVALID = Symbol('invalid-filter');

// Explicit column list (Supabase select + MySQL parity; never SELECT *).
const SCHEDULE_COLUMNS =
  'id, title, schedule_date, start_time, end_time, audience, status, ' +
  'building_id, location_type, location_label, floor_label, description, ' +
  'created_by_user_id, created_at, updated_at';

// MySQL read: DATE/TIME are formatted in SQL so both backends yield the
// same string shapes; buildings is LEFT JOINed for building_name.
const MYSQL_SELECT =
  `SELECT rs.id, rs.title,
          DATE_FORMAT(rs.schedule_date, '%Y-%m-%d') AS schedule_date,
          TIME_FORMAT(rs.start_time, '%H:%i') AS start_time,
          TIME_FORMAT(rs.end_time, '%H:%i') AS end_time,
          rs.audience, rs.status, rs.building_id, b.name AS building_name,
          rs.location_type, rs.location_label, rs.floor_label, rs.description,
          rs.created_by_user_id, rs.created_at, rs.updated_at
     FROM room_schedules rs
     LEFT JOIN buildings b ON b.id = rs.building_id`;

/* ---------------- error redaction (Supabase) ---------------- */

// Redact anything that could resemble the service role key (a JWT), a
// Supabase URL/host, or an IP before it reaches an Error message / log.
// Mirrors contentRepository.safeSupabaseMessage with the Section 11.4
// additions (hosts, IPs, noisy-length cap).
function safeSupabaseMessage(error) {
  let msg;
  if (!error) msg = 'Supabase request failed.';
  else if (typeof error === 'string') msg = error;
  else if (error.message) msg = String(error.message);
  else msg = 'Supabase request failed.';

  msg = msg.replace(
    /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    '[REDACTED_JWT]'
  );
  msg = msg.replace(
    /https?:\/\/[^\s]+/g,
    '[REDACTED_URL]'
  );
  msg = msg.replace(
    /\b[A-Za-z0-9-]+\.supabase\.(co|com|in)\b[^\s]*/g,
    '[REDACTED_SUPABASE_HOST]'
  );
  msg = msg.replace(
    /\b\d{1,3}(?:\.\d{1,3}){3}\b(?::\d+)?/g,
    '[REDACTED_IP]'
  );
  msg = msg.replace(/\s+/g, ' ').trim();
  if (msg.length > 300) msg = msg.slice(0, 300) + '…';
  return msg;
}

// Wrap a Supabase error as a plain Error with a fixed method prefix and
// only the redacted message. Never includes keys/URLs/credentials.
function fail(method, error) {
  return new Error('scheduleRepository.' + method + ': ' + safeSupabaseMessage(error));
}

/* ---------------- bounded-search refusal (M12.P1-D4 corrective) ----------------
   A `*` search is narrowed in JavaScript over a BOUNDED candidate scan. When
   that scan cannot prove it reached the end of the candidate set, the only
   truthful answer is a refusal: returning the rows scanned so far would report
   a partial list and count as though they were exact.

   The error is a fixed contract: a stable code plus one client-safe sentence.
   It carries no search text, row, count, URL, key, host, or database message,
   so a caller may surface the message verbatim. */
const SCHEDULE_SEARCH_LIMIT_CODE = 'SCHEDULE_SEARCH_LIMIT';
const SCHEDULE_SEARCH_LIMIT_MESSAGE =
  'Schedule search is too broad. Narrow the date range or search text and try again.';

function scheduleSearchLimitError() {
  const err = new Error(SCHEDULE_SEARCH_LIMIT_MESSAGE);
  err.code = SCHEDULE_SEARCH_LIMIT_CODE;
  return err;
}

// The controller uses this to map ONLY this refusal to its own status code;
// every other failure keeps the existing sanitized 500 behaviour.
function isScheduleSearchLimitError(error) {
  return !!error && error.code === SCHEDULE_SEARCH_LIMIT_CODE;
}

/* ---------------- filter normalisation ---------------- */

// Positive integer or null (absent) or INVALID (provided but unusable).
function normPositiveInt(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return INVALID;
  return n;
}

// Strict YYYY-MM-DD string or null (absent) or INVALID.
function normYmd(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const s = String(raw).trim();
  return YMD_RE.test(s) ? s : INVALID;
}

// Equality filter string or null (absent). Cannot broaden results.
function normEquals(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  return s === '' ? null : s;
}

// M12.P1-D4 free-text search. Defence in depth: the controller already
// validates `q`, but the repository re-applies the scalar/trim/length rules so
// a direct repository caller cannot submit an array, object, or unbounded
// string. A non-scalar value is INVALID (empty result), never ignored.
function normSearch(raw) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return INVALID;
  const s = raw.trim();
  if (s === '') return null;
  if (s.length > SEARCH_MAX) return INVALID;
  return s;
}

function clampInt(raw, def, min, max) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(Math.floor(n), min), max);
}

// Normalise list/count filters. `impossible: true` means an invalid
// provided filter must yield an empty result without querying.
function normalizeFilters(filters) {
  const f = filters && typeof filters === 'object' ? filters : {};
  const buildingId = normPositiveInt(f.buildingId);
  const from = normYmd(f.from);
  const to = normYmd(f.to);
  const q = normSearch(f.q);
  return {
    impossible: buildingId === INVALID || from === INVALID || to === INVALID || q === INVALID,
    buildingId: buildingId === INVALID ? null : buildingId,
    from: from === INVALID ? null : from,
    to: to === INVALID ? null : to,
    q: q === INVALID ? null : q,
    audience: normEquals(f.audience),
    status: normEquals(f.status),
    locationType: normEquals(f.locationType),
    locationLabel: normEquals(f.locationLabel),
    floorLabel: normEquals(f.floorLabel),
    limit: clampInt(f.limit, DEFAULT_LIMIT, 1, MAX_LIMIT),
    offset: clampInt(f.offset, DEFAULT_OFFSET, 0, MAX_OFFSET),
  };
}

/* ---------------- row shaping (backend parity) ---------------- */

function normTimeString(v) {
  if (v === undefined || v === null) return null;
  const s = String(v);
  return s.length >= 5 ? s.slice(0, 5) : s;
}

function normTimestamp(v) {
  if (v === undefined || v === null) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

// Stable shape for a schedule row. buildingName overrides row.building_name
// (Supabase path resolves names separately; MySQL path joins them in SQL).
function shapeRow(row, buildingName) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    schedule_date: row.schedule_date === undefined || row.schedule_date === null
      ? null : String(row.schedule_date),
    start_time: normTimeString(row.start_time),
    end_time: normTimeString(row.end_time),
    audience: row.audience,
    status: row.status,
    building_id: row.building_id,
    building_name: buildingName !== undefined
      ? buildingName
      : (row.building_name === undefined ? null : row.building_name),
    location_type: row.location_type,
    location_label: row.location_label,
    floor_label: row.floor_label === undefined ? null : row.floor_label,
    description: row.description === undefined ? null : row.description,
    created_by_user_id: row.created_by_user_id === undefined ? null : row.created_by_user_id,
    created_at: normTimestamp(row.created_at),
    updated_at: normTimestamp(row.updated_at),
  };
}

/* ---------------- Supabase helpers ---------------- */

// building_id -> name map for a set of Supabase schedule rows. The codebase
// convention resolves related names with a second explicit query
// (see routeRepository) rather than a PostgREST relational embed.
async function supabaseBuildingNames(sb, rows) {
  const ids = [...new Set(rows.map((r) => r.building_id).filter((v) => Number.isInteger(v) && v > 0))];
  if (ids.length === 0) return new Map();
  const { data, error } = await sb.from('buildings').select('id, name').in('id', ids);
  if (error) throw fail('buildingNames', error);
  return new Map((data || []).map((b) => [b.id, b.name]));
}

function applySupabaseFilters(query, f, searchBuildingIds) {
  let q = query;
  if (f.buildingId !== null) q = q.eq('building_id', f.buildingId);
  if (f.from !== null) q = q.gte('schedule_date', f.from);
  if (f.to !== null) q = q.lte('schedule_date', f.to);
  if (f.audience !== null) q = q.eq('audience', f.audience);
  if (f.status !== null) q = q.eq('status', f.status);
  if (f.locationType !== null) q = q.eq('location_type', f.locationType);
  if (f.locationLabel !== null) q = q.eq('location_label', f.locationLabel);
  if (f.floorLabel !== null) q = q.eq('floor_label', f.floorLabel);
  // M12.P1-D4: the text search is AND-ed with every filter above and is an OR
  // across the four row columns plus the name-resolved building ids. The
  // expression is built exclusively by the proven encoder — the raw `q` never
  // reaches the filter string.
  if (f.q !== null) q = q.or(supabaseScheduleOrExpression(f.q, searchBuildingIds));
  return q;
}

// One ordering, applied identically wherever schedule rows are read, so a
// list and its count can never be built from differently-ordered scans.
function orderSchedules(query) {
  return query
    .order('schedule_date', { ascending: true })
    .order('start_time', { ascending: true })
    .order('id', { ascending: true });
}

/**
 * Ordered candidate scan for an asterisk search, over a BOUNDED page budget.
 *
 * The `*` pattern is only a SUPERSET (see utils/scheduleSearch.js), so the
 * exact result has to be computed in JavaScript. Both listSchedules and
 * countSchedules call THIS function, so they narrow the identical ordered set
 * and can never disagree.
 *
 * Exhaustion is PROVEN by a short page. If the last permitted page comes back
 * completely full, more candidates may exist and this scan cannot answer
 * exactly — so it throws the bounded-search refusal immediately, before any
 * name resolution, filtering, slicing, or counting. No candidate row and no
 * partial count ever escapes that condition.
 */
async function supabaseExactSearchRows(sb, f, searchBuildingIds) {
  const rows = [];
  let exhausted = false;
  let expectedTotal = null;
  for (let page = 0; page < SEARCH_SCAN_PAGES; page++) {
    const from = page * SEARCH_SCAN_MAX;
    // The FIRST page asks for the exact candidate count. Exhaustion is then
    // proven against that server-reported total rather than inferred from a
    // page being short — a deployment whose API caps rows below
    // SEARCH_SCAN_MAX would otherwise make every page look like the last one
    // and silently truncate the result.
    const selection = page === 0
      ? sb.from('room_schedules').select(SCHEDULE_COLUMNS, { count: 'exact' })
      : sb.from('room_schedules').select(SCHEDULE_COLUMNS);
    const { data, error, count } = await orderSchedules(
      applySupabaseFilters(selection, f, searchBuildingIds)
    ).range(from, from + SEARCH_SCAN_MAX - 1);
    if (error) throw fail('searchSchedules', error);
    if (page === 0) {
      expectedTotal = typeof count === 'number' ? count : null;
      // Refuse before doing any further work when the candidate set cannot
      // fit in the budget at all.
      if (expectedTotal !== null && expectedTotal > SEARCH_SCAN_MAX * SEARCH_SCAN_PAGES) {
        throw scheduleSearchLimitError();
      }
    }
    const batch = data || [];
    const collected = rows.length + batch.length;
    const exhaustedNow = expectedTotal !== null
      ? collected >= expectedTotal
      : batch.length < SEARCH_SCAN_MAX;
    // Not exhausted and no budget left: refuse BEFORE accumulating this page.
    if (!exhaustedNow && page === SEARCH_SCAN_PAGES - 1) throw scheduleSearchLimitError();
    rows.push(...batch);
    if (exhaustedNow) { exhausted = true; break; }
    // A page that returned nothing makes no progress toward the expected
    // total, so exhaustion can never be proven — refuse instead of looping.
    if (batch.length === 0) throw scheduleSearchLimitError();
  }
  // Defensive: the loop can only exit by proving exhaustion or throwing, so a
  // zero/negative page budget must also refuse rather than report an empty
  // result as exact.
  if (!exhausted) throw scheduleSearchLimitError();

  const names = await supabaseBuildingNames(sb, rows);
  return rows
    .map((r) => shapeRow(r, names.has(r.building_id) ? names.get(r.building_id) : null))
    .filter((row) => matchesScheduleSearch(row, f.q));
}

// Building ids whose NAME matches the search text. Uses a STANDALONE .ilike()
// (single-layer escaping, value encoded by supabase-js as a query parameter),
// so no user text is ever interpolated into a filter expression. The id list
// it returns is the only thing that reaches the .or() building disjunct.
async function supabaseSearchBuildingIds(sb, q) {
  if (q === null) return [];
  const { data, error } = await sb
    .from('buildings').select('id').ilike('name', supabaseIlikePattern(q));
  if (error) throw fail('searchBuildingIds', error);
  return (data || [])
    .map((b) => Number(b.id))
    .filter((n) => Number.isInteger(n) && n > 0);
}

/* ---------------- MySQL helpers ---------------- */

// M12.P1-D4: the searched columns, matched case-insensitively as LITERAL
// substrings. LOWER(column) keeps the comparison case-insensitive whatever the
// column collation is, and the pattern is a bound parameter whose \ % _ are
// escaped with an explicit ESCAPE clause, so user metacharacters cannot widen
// the match. b.name requires the buildings join (see mysqlFrom below).
const MYSQL_SEARCH_COLUMNS = [
  'rs.title', 'b.name', 'rs.location_label', 'rs.floor_label', 'rs.description',
];

function mysqlWhere(f) {
  const parts = [];
  const params = [];
  if (f.buildingId !== null) { parts.push('rs.building_id = ?'); params.push(f.buildingId); }
  if (f.from !== null) { parts.push('rs.schedule_date >= ?'); params.push(f.from); }
  if (f.to !== null) { parts.push('rs.schedule_date <= ?'); params.push(f.to); }
  if (f.audience !== null) { parts.push('rs.audience = ?'); params.push(f.audience); }
  if (f.status !== null) { parts.push('rs.status = ?'); params.push(f.status); }
  if (f.locationType !== null) { parts.push('rs.location_type = ?'); params.push(f.locationType); }
  if (f.locationLabel !== null) { parts.push('rs.location_label = ?'); params.push(f.locationLabel); }
  if (f.floorLabel !== null) { parts.push('rs.floor_label = ?'); params.push(f.floorLabel); }
  if (f.q !== null) {
    const pattern = mysqlLikePattern(f.q);
    // No explicit ESCAPE clause: backslash is already MySQL's default LIKE
    // escape character, and spelling it out breaks under the
    // NO_BACKSLASH_ESCAPES sql_mode (the literal would be read as two
    // backslashes and raise "Incorrect arguments to ESCAPE").
    parts.push(
      '(' + MYSQL_SEARCH_COLUMNS
        .map((c) => `LOWER(${c}) LIKE ?`)
        .join(' OR ') + ')'
    );
    for (let i = 0; i < MYSQL_SEARCH_COLUMNS.length; i++) params.push(pattern);
  }
  return { where: parts.length ? ' WHERE ' + parts.join(' AND ') : '', params };
}

// COUNT source. The count must apply exactly the same filters as the list, so
// it needs the buildings join whenever the search can match a building name.
function mysqlCountFrom(f) {
  return f.q !== null
    ? 'SELECT COUNT(*) AS n FROM room_schedules rs LEFT JOIN buildings b ON b.id = rs.building_id'
    : 'SELECT COUNT(*) AS n FROM room_schedules rs';
}

/* ---------------- reads ---------------- */

/**
 * Bounded, filtered schedule list ordered by schedule_date ASC,
 * start_time ASC, id ASC. Invalid provided filters yield [].
 */
async function listSchedules(filters = {}) {
  const f = normalizeFilters(filters);
  if (f.impossible) return [];

  if (scheduleDataSource.isSupabase()) {
    const sb = getSupabaseClient();
    const searchBuildingIds = await supabaseSearchBuildingIds(sb, f.q);

    // Asterisk queries: the ilike pattern is only a SUPERSET, so the shared
    // ordered scan is narrowed to the exact literal match and paginated in
    // memory. Every other query keeps server-side range pagination.
    if (searchNeedsExactPostFilter(f.q)) {
      const exact = await supabaseExactSearchRows(sb, f, searchBuildingIds);
      return exact.slice(f.offset, f.offset + f.limit);
    }

    const { data, error } = await orderSchedules(applySupabaseFilters(
      sb.from('room_schedules').select(SCHEDULE_COLUMNS), f, searchBuildingIds
    )).range(f.offset, f.offset + f.limit - 1);
    if (error) throw fail('listSchedules', error);
    const rows = data || [];
    const names = await supabaseBuildingNames(sb, rows);
    return rows.map((r) => shapeRow(r, names.has(r.building_id) ? names.get(r.building_id) : null));
  }

  const { where, params } = mysqlWhere(f);
  const [rows] = await db.query(
    MYSQL_SELECT + where +
    ' ORDER BY rs.schedule_date ASC, rs.start_time ASC, rs.id ASC LIMIT ? OFFSET ?',
    [...params, f.limit, f.offset]
  );
  return rows.map((r) => shapeRow(r));
}

/**
 * Count of schedule rows matching the same filters (limit/offset ignored).
 * Invalid provided filters yield 0.
 */
async function countSchedules(filters = {}) {
  const f = normalizeFilters(filters);
  if (f.impossible) return 0;

  if (scheduleDataSource.isSupabase()) {
    const sb = getSupabaseClient();
    const searchBuildingIds = await supabaseSearchBuildingIds(sb, f.q);

    // Asterisk queries are counted from the SAME shared ordered scan the list
    // narrows, so list and count can never disagree.
    if (searchNeedsExactPostFilter(f.q)) {
      return (await supabaseExactSearchRows(sb, f, searchBuildingIds)).length;
    }

    const q = applySupabaseFilters(
      sb.from('room_schedules').select('id', { count: 'exact', head: true }), f, searchBuildingIds
    );
    const { count, error } = await q;
    if (error) throw fail('countSchedules', error);
    return count || 0;
  }

  const { where, params } = mysqlWhere(f);
  const [rows] = await db.query(mysqlCountFrom(f) + where, params);
  return rows.length ? Number(rows[0].n) : 0;
}

/**
 * Single schedule row by id (stable shape), or null when absent or the id
 * is not a positive integer.
 */
async function findScheduleById(id) {
  const n = normPositiveInt(id);
  if (n === null || n === INVALID) return null;

  if (scheduleDataSource.isSupabase()) {
    const sb = getSupabaseClient();
    const { data, error } = await sb
      .from('room_schedules').select(SCHEDULE_COLUMNS).eq('id', n).maybeSingle();
    if (error) throw fail('findScheduleById', error);
    if (!data) return null;
    const names = await supabaseBuildingNames(sb, [data]);
    return shapeRow(data, names.has(data.building_id) ? names.get(data.building_id) : null);
  }

  const [rows] = await db.query(MYSQL_SELECT + ' WHERE rs.id = ? LIMIT 1', [n]);
  return rows.length ? shapeRow(rows[0]) : null;
}

/**
 * True when a building row with this id exists in the active backend.
 */
async function buildingExists(id) {
  const n = normPositiveInt(id);
  if (n === null || n === INVALID) return false;

  if (scheduleDataSource.isSupabase()) {
    const sb = getSupabaseClient();
    const { data, error } = await sb.from('buildings').select('id').eq('id', n).maybeSingle();
    if (error) throw fail('buildingExists', error);
    return !!data;
  }

  const [rows] = await db.query('SELECT id FROM buildings WHERE id = ? LIMIT 1', [n]);
  return rows.length > 0;
}

/**
 * Count of schedule rows referencing a building (any status/date). Used by
 * the later building-delete guard. Invalid ids count as 0.
 */
async function countSchedulesByBuilding(buildingId) {
  const n = normPositiveInt(buildingId);
  if (n === null || n === INVALID) return 0;
  return countSchedules({ buildingId: n });
}

/* ---------------- writes ---------------- */

const REQUIRED_CREATE_FIELDS = [
  'title', 'schedule_date', 'start_time', 'end_time',
  'audience', 'status', 'building_id', 'location_type', 'location_label',
];

function assertWritePayload(method, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('scheduleRepository.' + method + ': payload must be an object.');
  }
  for (const k of REQUIRED_CREATE_FIELDS) {
    const v = payload[k];
    if (v === undefined || v === null || String(v).trim() === '') {
      throw new Error('scheduleRepository.' + method + ': ' + k + ' is required.');
    }
  }
}

/**
 * Insert one schedule row and return it in the stable shape. Allowlist /
 * format validation is controller work (Section 11.5); this asserts only
 * required-field presence. created_by_user_id is optional (nullable).
 */
async function createSchedule(payload = {}) {
  assertWritePayload('createSchedule', payload);
  const row = {
    title: payload.title,
    schedule_date: payload.schedule_date,
    start_time: payload.start_time,
    end_time: payload.end_time,
    audience: payload.audience,
    status: payload.status,
    building_id: payload.building_id,
    location_type: payload.location_type,
    location_label: payload.location_label,
    floor_label: payload.floor_label === undefined || payload.floor_label === '' ? null : payload.floor_label,
    description: payload.description === undefined || payload.description === '' ? null : payload.description,
    created_by_user_id: payload.created_by_user_id === undefined ? null : payload.created_by_user_id,
  };

  if (scheduleDataSource.isSupabase()) {
    const sb = getSupabaseClient();
    const { data, error } = await sb
      .from('room_schedules').insert(row).select(SCHEDULE_COLUMNS).single();
    if (error) throw fail('createSchedule', error);
    const names = await supabaseBuildingNames(sb, [data]);
    return shapeRow(data, names.has(data.building_id) ? names.get(data.building_id) : null);
  }

  const [result] = await db.query(
    `INSERT INTO room_schedules
       (title, schedule_date, start_time, end_time, audience, status,
        building_id, location_type, location_label, floor_label, description,
        created_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.title, row.schedule_date, row.start_time, row.end_time, row.audience,
     row.status, row.building_id, row.location_type, row.location_label,
     row.floor_label, row.description, row.created_by_user_id]
  );
  return findScheduleById(result.insertId);
}

/**
 * Full update of the writable fields of one schedule row. Returns the
 * updated row in the stable shape, or null when the id does not exist.
 * created_by_user_id is intentionally not writable.
 */
async function updateSchedule(id, payload = {}) {
  const n = normPositiveInt(id);
  if (n === null || n === INVALID) return null;
  assertWritePayload('updateSchedule', payload);
  const row = {
    title: payload.title,
    schedule_date: payload.schedule_date,
    start_time: payload.start_time,
    end_time: payload.end_time,
    audience: payload.audience,
    status: payload.status,
    building_id: payload.building_id,
    location_type: payload.location_type,
    location_label: payload.location_label,
    floor_label: payload.floor_label === undefined || payload.floor_label === '' ? null : payload.floor_label,
    description: payload.description === undefined || payload.description === '' ? null : payload.description,
  };

  if (scheduleDataSource.isSupabase()) {
    const sb = getSupabaseClient();
    // 0012 defines no auto-update trigger (repo convention since 0001/0011),
    // so updated_at must be refreshed by application code on every update.
    // MySQL needs no equivalent: its column is ON UPDATE CURRENT_TIMESTAMP.
    const { data, error } = await sb
      .from('room_schedules')
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq('id', n)
      .select(SCHEDULE_COLUMNS).maybeSingle();
    if (error) throw fail('updateSchedule', error);
    if (!data) return null;
    const names = await supabaseBuildingNames(sb, [data]);
    return shapeRow(data, names.has(data.building_id) ? names.get(data.building_id) : null);
  }

  // Existence check first: MySQL affectedRows is 0 for identical-value
  // updates, so it cannot distinguish "missing" from "unchanged".
  const existing = await findScheduleById(n);
  if (!existing) return null;
  await db.query(
    `UPDATE room_schedules
        SET title = ?, schedule_date = ?, start_time = ?, end_time = ?,
            audience = ?, status = ?, building_id = ?, location_type = ?,
            location_label = ?, floor_label = ?, description = ?
      WHERE id = ?`,
    [row.title, row.schedule_date, row.start_time, row.end_time, row.audience,
     row.status, row.building_id, row.location_type, row.location_label,
     row.floor_label, row.description, n]
  );
  return findScheduleById(n);
}

/**
 * Delete one schedule row by id. Returns true when a row was removed,
 * false when the id was absent or invalid.
 */
async function deleteScheduleById(id) {
  const n = normPositiveInt(id);
  if (n === null || n === INVALID) return false;

  if (scheduleDataSource.isSupabase()) {
    const sb = getSupabaseClient();
    const { data, error } = await sb
      .from('room_schedules').delete().eq('id', n).select('id').maybeSingle();
    if (error) throw fail('deleteScheduleById', error);
    return !!data;
  }

  const [result] = await db.query('DELETE FROM room_schedules WHERE id = ?', [n]);
  return result.affectedRows > 0;
}

module.exports = {
  // Bounded-search refusal contract: the fixed client-safe message and the
  // predicate the controller needs. The scan helpers stay private.
  SCHEDULE_SEARCH_LIMIT_MESSAGE,
  isScheduleSearchLimitError,
  listSchedules,
  countSchedules,
  findScheduleById,
  createSchedule,
  updateSchedule,
  deleteScheduleById,
  buildingExists,
  countSchedulesByBuilding,
};
