'use strict';

/* ========================================
   CampuSphere - Site Content Repository (Supabase)
   Milestone 7, Section 7.3.

   Supabase-backed FAQ CRUD and allowlisted system_settings reads /
   batch updates. Consumed by the admin FAQ controller and the public
   FAQ controller, while settings access remains available to its
   dedicated admin path.

   Boundary rules (see database/supabase/REPOSITORY_BOUNDARIES.md s11):
   - Imports `config/supabase.js` ONLY. It does NOT import
     `config/db.js`, any controller, route, view, middleware, or
     public file. MySQL fallback branching stays in the controller
     layer behind CONTENT_DATA_SOURCE.
   - Never reads req / res / sessions / res.locals / app.locals /
     browser globals. Returns plain row-like objects.
   - Explicit column lists pin the row shape; settings reads/writes
     are restricted to a fixed 10-key allowlist (unknown keys are
     rejected, never written).
   - Supabase failures are rethrown as plain Error objects prefixed
     with `siteContentRepository.<method>:`, carrying only a redacted
     message (never keys, URLs, headers, or other secret-like values).
   ======================================== */

const { getSupabaseClient } = require('../config/supabase');

// FAQ row shape (matches faqs in 0001_initial_schema.sql section B.2).
const FAQ_COLUMNS = 'id, question, answer, category, display_order';

// Fixed allowlist of writable / readable settings keys. Mirrors the 10
// keys seeded by database/seed.js and 0006_admin_content_and_logs.sql.
// Any key outside this list is rejected by updateSettings and excluded
// from listSettings, so the admin settings surface can never read or
// write an arbitrary system_settings key (e.g. a future internal flag).
const SETTINGS_ALLOWLIST = Object.freeze([
  'school_name',
  'school_acronym',
  'school_address',
  'school_founded',
  'school_description',
  'contact_address',
  'contact_phone',
  'contact_email',
  'contact_website',
  'contact_hours'
]);

/* ---------- helpers ---------- */

// Redact anything resembling a JWT (the service role key) or a full
// Supabase URL before it reaches an Error message / log.
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
  msg = msg.replace(/[A-Za-z0-9-]+\.supabase\.co/g, '[REDACTED_SUPABASE_HOST]');
  msg = msg.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[REDACTED_IP]');
  // Collapse whitespace and cap length so an unexpected HTML / non-JSON error
  // body (e.g. an upstream WAF page) cannot flood logs or smuggle markup into
  // an error string.
  msg = msg.replace(/\s+/g, ' ').trim();
  if (msg.length > 300) msg = msg.slice(0, 300) + '…';
  return msg;
}

function fail(method, error) {
  return new Error('siteContentRepository.' + method + ': ' + safeSupabaseMessage(error));
}

// Trim a value to a non-empty string, or null. NOT-NULL columns
// (question/answer) rely on the controller for presence validation;
// here null simply lets the DB constraint reject an empty write.
function strOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// Coerce a display_order to a truncated integer (defaults to 0 when
// absent/invalid). The controller enforces the non-negative rule.
function toOrderInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function isPositiveId(numId) {
  return Number.isInteger(numId) && numId >= 1;
}

/* ---------- FAQs ---------- */

/**
 * All FAQs ordered by display_order ASC, then id ASC.
 */
async function listFaqs() {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('faqs')
    .select(FAQ_COLUMNS)
    .order('display_order', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw fail('listFaqs', error);
  return data || [];
}

/**
 * Total FAQ count (exact head count; no rows transferred).
 */
async function countFaqs() {
  const sb = getSupabaseClient();
  const { count, error } = await sb
    .from('faqs')
    .select('id', { count: 'exact', head: true });
  if (error) throw fail('countFaqs', error);
  return count || 0;
}

/**
 * One FAQ by id, or null. Invalid / non-positive ids return null
 * WITHOUT querying.
 */
async function findFaqById(id) {
  const numId = Number(id);
  if (!isPositiveId(numId)) return null;

  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('faqs')
    .select(FAQ_COLUMNS)
    .eq('id', numId)
    .maybeSingle();
  if (error) throw fail('findFaqById', error);
  return data || null;
}

/**
 * Find a FAQ whose question matches `question` (trimmed, case-insensitive),
 * optionally excluding a given id (the row being edited). Returns the
 * conflicting row or null. Comparison is done in JS over the small FAQ set
 * so user text can never inject LIKE wildcards.
 */
async function findFaqByQuestion(question, { excludeId } = {}) {
  if (question == null) return null;
  const target = String(question).trim().toLowerCase();
  if (target === '') return null;

  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('faqs')
    .select(FAQ_COLUMNS)
    .order('id', { ascending: true });
  if (error) throw fail('findFaqByQuestion', error);

  const exId = Number(excludeId);
  const hasExclude = Number.isInteger(exId) && exId >= 1;
  for (const row of data || []) {
    if (hasExclude && Number(row.id) === exId) continue;
    const rowQ = row.question == null ? '' : String(row.question).trim().toLowerCase();
    if (rowQ === target) return row;
  }
  return null;
}

/**
 * Insert one FAQ from explicit fields only and return the inserted row.
 * Arbitrary payload keys are ignored.
 */
async function createFaq(payload = {}) {
  const row = {
    question: strOrNull(payload.question),
    answer: strOrNull(payload.answer),
    category: strOrNull(payload.category),
    display_order: toOrderInt(payload.display_order)
  };

  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('faqs')
    .insert(row)
    .select(FAQ_COLUMNS)
    .single();
  if (error) throw fail('createFaq', error);
  return data || null;
}

/**
 * Update only the provided fields of a FAQ; return the updated row, or
 * null when the id is invalid or matches no row. Only the four writable
 * columns are ever touched.
 */
async function updateFaq(id, payload = {}) {
  const numId = Number(id);
  if (!isPositiveId(numId)) return null;

  const patch = {};
  if (payload.question !== undefined) patch.question = strOrNull(payload.question);
  if (payload.answer !== undefined) patch.answer = strOrNull(payload.answer);
  if (payload.category !== undefined) patch.category = strOrNull(payload.category);
  if (payload.display_order !== undefined) patch.display_order = toOrderInt(payload.display_order);

  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('faqs')
    .update(patch)
    .eq('id', numId)
    .select(FAQ_COLUMNS)
    .maybeSingle();
  if (error) throw fail('updateFaq', error);
  return data || null;
}

/**
 * Delete a FAQ by id. Returns the deleted id, or null when the id is
 * invalid or matched no row.
 */
async function deleteFaq(id) {
  const numId = Number(id);
  if (!isPositiveId(numId)) return null;

  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('faqs')
    .delete()
    .eq('id', numId)
    .select('id')
    .maybeSingle();
  if (error) throw fail('deleteFaq', error);
  return data ? data.id : null;
}

/* ---------- system_settings (allowlisted) ---------- */

/**
 * Read the allowlisted settings as `{ setting_key, setting_value }` rows,
 * ordered by setting_key. Keys outside the allowlist are never returned.
 */
async function listSettings() {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('system_settings')
    .select('setting_key, setting_value')
    .in('setting_key', SETTINGS_ALLOWLIST)
    .order('setting_key', { ascending: true });
  if (error) throw fail('listSettings', error);
  return data || [];
}

/**
 * Batch-update allowlisted settings in ONE atomic upsert and return the
 * resulting allowlisted rows. Rejects a non-object, an empty batch, or
 * any unknown key before touching the database.
 */
async function updateSettings(values) {
  if (values == null || typeof values !== 'object' || Array.isArray(values)) {
    throw new Error('siteContentRepository.updateSettings: values must be a non-empty object.');
  }
  const keys = Object.keys(values);
  if (keys.length === 0) {
    throw new Error('siteContentRepository.updateSettings: no settings provided.');
  }
  const unknown = keys.filter((k) => !SETTINGS_ALLOWLIST.includes(k));
  if (unknown.length > 0) {
    throw new Error(
      'siteContentRepository.updateSettings: unknown setting key(s): ' + unknown.join(', ')
    );
  }

  const rows = keys.map((k) => ({
    setting_key: k,
    setting_value: values[k] == null ? '' : String(values[k])
  }));

  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('system_settings')
    .upsert(rows, { onConflict: 'setting_key' })
    .select('setting_key, setting_value');
  if (error) throw fail('updateSettings', error);
  return (data || []).filter((r) => SETTINGS_ALLOWLIST.includes(r.setting_key));
}

module.exports = {
  SETTINGS_ALLOWLIST,
  // FAQs
  listFaqs,
  countFaqs,
  findFaqById,
  findFaqByQuestion,
  createFaq,
  updateFaq,
  deleteFaq,
  // Settings
  listSettings,
  updateSettings
};
