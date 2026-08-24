'use strict';

/* ========================================
   CampuSphere - Content Repository (Supabase reads)
   Milestone 4, Section 4.4.

   Supabase-backed READ methods for the `news_announcements` and
   `events` tables. Write methods stay NotImplemented stubs until
   Section 4.6; no controller consumes this module until 4.5/4.7.

   Boundary rules (see database/supabase/REPOSITORY_BOUNDARIES.md s7):
   - Imports `config/supabase.js` ONLY. It does NOT import
     `config/db.js`, any controller, route, view, middleware, or
     public file.
   - Never reads req / res / sessions / res.locals / app.locals /
     browser globals. The only role input is the `role` argument to
     listAnnouncementsForRole; this module makes no other role
     decision (audience filtering is data, not policy).
   - Returns plain row-like objects in the MySQL-era shapes the
     controllers/views already consume; the controllers keep owning
     response/EJS shaping:
       announcements: id, title, category, audience, excerpt, content,
                      author_id, published_date, created_at, updated_at
       events:        id, title, category, event_date, description,
                      location, event_time, created_at, updated_at
   - Ordering / draft-visibility / audience rules (s7 + plan.md 4.4):
       listAnnouncementsForRole     : published only (published_date
                                      NOT NULL), audience IN
                                      ('all', role), published_date
                                      DESC. role null/empty -> only
                                      audience = 'all'.
       listRecentAnnouncements      : published_date DESC, capped by a
                                      sanitised limit (default 4,
                                      clamped 1..50). Intentionally
                                      includes drafts (admin panel).
       listAllAnnouncementsForAdmin : created_at DESC.
       listEvents                   : event_date ASC.
       listEventsForAdmin           : event_date DESC.
   - Supabase failures are rethrown as plain Error objects prefixed
     with `contentRepository.<method>:`, carrying only a redacted
     Supabase message (never keys, URLs, headers, or other
     secret-like values).
   ======================================== */

const { getSupabaseClient } = require('../config/supabase');

// Explicit column lists pin the MySQL-era row shape and avoid leaking
// any column the controllers/views do not already expect.
const ANNOUNCEMENT_COLUMNS =
  'id, title, category, audience, excerpt, content, author_id, published_date, created_at, updated_at';
const EVENT_COLUMNS =
  'id, title, category, event_date, description, location, event_time, created_at, updated_at';

// listRecentAnnouncements limit clamp. The admin "recent news" panel
// uses 4 today; missing/invalid -> 4, otherwise clamped to 1..50.
const DEFAULT_RECENT_LIMIT = 4;
const MIN_RECENT_LIMIT = 1;
const MAX_RECENT_LIMIT = 50;

function clampRecentLimit(limit) {
  const n = Number(limit);
  if (!Number.isFinite(n)) return DEFAULT_RECENT_LIMIT;
  return Math.min(Math.max(Math.floor(n), MIN_RECENT_LIMIT), MAX_RECENT_LIMIT);
}

// Redact anything that could resemble the service role key (a JWT) or a
// full Supabase URL before it reaches an Error message / log. Mirrors
// the defensive scrub in scripts/supabase-smoke.js.
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
    /https?:\/\/[A-Za-z0-9-]+\.supabase\.co[^\s]*/g,
    '[REDACTED_SUPABASE_URL]'
  );
  return msg;
}

// Wrap a Supabase error as a plain Error with a fixed method prefix and
// only the redacted message. Never includes keys/URLs/credentials.
function fail(method, error) {
  return new Error('contentRepository.' + method + ': ' + safeSupabaseMessage(error));
}

function notImplemented(method) {
  throw new Error('NotImplemented: contentRepository.' + method);
}

// Normalise a published_date payload value into an explicit insert/update
// value. null / undefined / '' all collapse to an explicit null (a draft) so
// the column's DEFAULT now() can never silently auto-publish; a Date becomes
// an ISO string; any other value (e.g. an ISO timestamp string) passes
// through. The controller (Section 4.7) owns the draft-vs-published decision
// and passes the final value here — this never auto-publishes on its own.
function normalizePublishedDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

// Keep event_date as a date-compatible value. A Date collapses to YYYY-MM-DD
// (the `date` column has no time component); strings pass through unchanged.
function normalizeEventDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

// ----- Announcements ---------------------------------------------------------

/**
 * Published announcements visible to `role`, ordered by published_date
 * DESC. "Visible" = audience 'all' OR audience === role. A null/empty
 * role collapses to the 'all' subset only. Drafts (published_date IS
 * NULL) are never returned here. The audience list is passed via `.in`
 * (parameterised) rather than a string-built `.or`, so the role value
 * can never alter the filter structure.
 */
async function listAnnouncementsForRole(role, options = {}) {
  const trimmed = typeof role === 'string' ? role.trim() : '';
  const audiences = trimmed === '' ? ['all'] : ['all', trimmed];
  const rawLimit = options && options.limit;
  const parsedLimit = Number(rawLimit);
  const limit = rawLimit == null
    ? null
    : (Number.isFinite(parsedLimit) ? Math.min(Math.max(Math.floor(parsedLimit), 1), 50) : 5);

  const sb = getSupabaseClient();
  let query = sb
    .from('news_announcements')
    .select(ANNOUNCEMENT_COLUMNS)
    .not('published_date', 'is', null)
    .in('audience', audiences)
    .order('published_date', { ascending: false });
  if (limit != null) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw fail('listAnnouncementsForRole', error);
  return data || [];
}

/**
 * Most-recent announcements for the admin dashboard panel, ordered by
 * published_date DESC and capped by a sanitised limit. Unlike
 * listAnnouncementsForRole, this intentionally returns drafts too so
 * admins keep visibility into unpublished articles (s7).
 */
async function listRecentAnnouncements(limit) {
  const max = clampRecentLimit(limit);
  const sb = getSupabaseClient();
  // nullsFirst:false keeps drafts (published_date IS NULL) at the bottom,
  // mirroring MySQL's `ORDER BY published_date DESC` (NULLs last). Without it
  // Postgres sorts NULLs first on DESC, which would float drafts to the top of
  // the admin "recent news" panel once Section 4.6 writes can create them.
  const { data, error } = await sb
    .from('news_announcements')
    .select(ANNOUNCEMENT_COLUMNS)
    .order('published_date', { ascending: false, nullsFirst: false })
    .limit(max);
  if (error) throw fail('listRecentAnnouncements', error);
  return data || [];
}

/**
 * Total announcement count (admin dashboard `totalNews`). Returns a
 * number.
 */
async function countAnnouncements() {
  const sb = getSupabaseClient();
  const { count, error } = await sb
    .from('news_announcements')
    .select('id', { count: 'exact', head: true });
  if (error) throw fail('countAnnouncements', error);
  return count || 0;
}

/**
 * Full article list for the admin news page, ordered by created_at
 * DESC. The published/drafts split stays in the controller.
 */
async function listAllAnnouncementsForAdmin() {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('news_announcements')
    .select(ANNOUNCEMENT_COLUMNS)
    .order('created_at', { ascending: false });
  if (error) throw fail('listAllAnnouncementsForAdmin', error);
  return data || [];
}

// Read method documented in REPOSITORY_BOUNDARIES.md s7 but not part of
// the Section 4.4 scope; kept as a NotImplemented stub to preserve the
// module's export surface until a later section needs it.
async function listAllAnnouncements() {
  notImplemented('listAllAnnouncements');
}

// ----- Events ----------------------------------------------------------------

/**
 * Events ordered by event_date ASC (public /events page). The optional
 * { from, to } window matches the boundary contract (s7); both bounds
 * are inclusive and compared against event_date. eventsController still
 * reshapes rows into its EJS view shape.
 */
async function listEvents({ from, to, limit } = {}) {
  const sb = getSupabaseClient();
  let query = sb.from('events').select(EVENT_COLUMNS);
  if (from != null) query = query.gte('event_date', from);
  if (to != null) query = query.lte('event_date', to);
  query = query.order('event_date', { ascending: true });
  const parsedLimit = Number(limit);
  if (limit != null) {
    query = query.limit(Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.floor(parsedLimit), 1), 50)
      : 5);
  }

  const { data, error } = await query;
  if (error) throw fail('listEvents', error);
  return data || [];
}

/**
 * Full events list for the admin news page events table, ordered by
 * event_date DESC.
 */
async function listEventsForAdmin() {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('events')
    .select(EVENT_COLUMNS)
    .order('event_date', { ascending: false });
  if (error) throw fail('listEventsForAdmin', error);
  return data || [];
}

/**
 * Total event count (admin news page `totalEvents`). Returns a number.
 */
async function countEvents() {
  const sb = getSupabaseClient();
  const { count, error } = await sb
    .from('events')
    .select('id', { count: 'exact', head: true });
  if (error) throw fail('countEvents', error);
  return count || 0;
}

// ----- Writes (Section 4.6) --------------------------------------------------
// Direct Supabase table operations (single-row inserts/updates/deletes — no
// cross-table atomicity gap, so no RPC is needed). The repository accepts
// pre-validated values; category/audience allowlists and the draft-vs-
// published decision stay in adminContentController (Section 4.7).
//
// Not-found contract (update/delete): return null when the id matches no row
// (or is not a positive integer). Section 4.7 maps null -> HTTP 404. Inserts
// throw on failure; reads of the inserted/updated row come back in the same
// MySQL-era column shape the controllers/views already consume.

/**
 * Insert one announcement and return the inserted row. `published_date` is set
 * explicitly (null for a draft) so the column DEFAULT never auto-publishes;
 * `audience` defaults to 'all' to match the NOT NULL column + controller
 * default. `author_id` is optional (nullable FK).
 */
async function createAnnouncement(payload = {}) {
  const row = {
    title: payload.title,
    category: payload.category,
    audience: payload.audience != null && payload.audience !== '' ? payload.audience : 'all',
    excerpt: payload.excerpt != null ? payload.excerpt : null,
    content: payload.content != null ? payload.content : null,
    author_id: payload.author_id != null ? payload.author_id : null,
    published_date: normalizePublishedDate(payload.published_date)
  };

  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('news_announcements')
    .insert(row)
    .select(ANNOUNCEMENT_COLUMNS)
    .single();
  if (error) throw fail('createAnnouncement', error);
  return data || null;
}

/**
 * Update an announcement's provided fields and return the updated row, or null
 * when the id does not exist. Only keys present in `payload` are written.
 * `published_date` is touched only when the caller explicitly includes the key
 * (an explicit null means "save as draft"); when omitted it is left unchanged,
 * so the repository never auto-publishes. updated_at is set explicitly because
 * news_announcements has no auto-update trigger (see 0001 schema).
 */
async function updateAnnouncement(id, payload = {}) {
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId < 1) return null;

  const patch = {};
  for (const key of ['title', 'category', 'audience', 'excerpt', 'content', 'author_id']) {
    if (payload[key] !== undefined) patch[key] = payload[key];
  }
  if ('published_date' in payload) {
    patch.published_date = normalizePublishedDate(payload.published_date);
  }
  patch.updated_at = new Date().toISOString();

  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('news_announcements')
    .update(patch)
    .eq('id', numId)
    .select(ANNOUNCEMENT_COLUMNS)
    .maybeSingle();
  if (error) throw fail('updateAnnouncement', error);
  return data || null;
}

/**
 * Delete an announcement by id. Returns the deleted id, or null when the id
 * matched no row (Section 4.7 maps null -> 404).
 */
async function deleteAnnouncement(id) {
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId < 1) return null;

  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('news_announcements')
    .delete()
    .eq('id', numId)
    .select('id')
    .maybeSingle();
  if (error) throw fail('deleteAnnouncement', error);
  return data ? data.id : null;
}

/**
 * Insert one event and return the inserted row. event_date is kept
 * date-compatible; event_time stays free text; categories are not normalised.
 */
async function createEvent(payload = {}) {
  const row = {
    title: payload.title,
    category: payload.category,
    event_date: normalizeEventDate(payload.event_date),
    description: payload.description != null ? payload.description : null,
    location: payload.location != null ? payload.location : null,
    event_time: payload.event_time != null ? payload.event_time : null
  };

  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('events')
    .insert(row)
    .select(EVENT_COLUMNS)
    .single();
  if (error) throw fail('createEvent', error);
  return data || null;
}

/**
 * Update an event's provided fields and return the updated row, or null when
 * the id does not exist. Only keys present in `payload` are written; updated_at
 * is set explicitly (no auto-update trigger on events — see 0001 schema).
 */
async function updateEvent(id, payload = {}) {
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId < 1) return null;

  const patch = {};
  for (const key of ['title', 'category', 'description', 'location', 'event_time']) {
    if (payload[key] !== undefined) patch[key] = payload[key];
  }
  if (payload.event_date !== undefined) patch.event_date = normalizeEventDate(payload.event_date);
  patch.updated_at = new Date().toISOString();

  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('events')
    .update(patch)
    .eq('id', numId)
    .select(EVENT_COLUMNS)
    .maybeSingle();
  if (error) throw fail('updateEvent', error);
  return data || null;
}

/**
 * Delete an event by id. Returns the deleted id, or null when the id matched no
 * row (Section 4.7 maps null -> 404).
 */
async function deleteEvent(id) {
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId < 1) return null;

  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('events')
    .delete()
    .eq('id', numId)
    .select('id')
    .maybeSingle();
  if (error) throw fail('deleteEvent', error);
  return data ? data.id : null;
}

module.exports = {
  // Announcements (reads)
  listAnnouncementsForRole,
  listRecentAnnouncements,
  countAnnouncements,
  listAllAnnouncementsForAdmin,
  listAllAnnouncements,
  // Announcements (writes - Section 4.6)
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  // Events (reads)
  listEvents,
  listEventsForAdmin,
  countEvents,
  // Events (writes - Section 4.6)
  createEvent,
  updateEvent,
  deleteEvent
};
