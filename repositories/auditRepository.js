'use strict';

/* ========================================
   CampuSphere - Audit Repository (Supabase, append-only)
   Milestone 7, Section 7.3.

   Supabase-backed audit-log insertion plus filtered, paginated reads
   and exact counts over the `system_logs` table. Consumed by the
   (later) audit service (Section 7.4) and the admin logs view
   (Section 7.7); no controller, route, view, or public file imports
   this module yet.

   Privacy / immutability:
   - The audit row is built from a FIXED set of fields ONLY. Arbitrary
     payload keys are ignored, so an IP address, request body,
     password, token, cookie, session id, OAuth subject, secret, stack
     trace, or any other raw metadata can never reach a column.
   - There are NO update or delete methods. Combined with the
     service_role grants in 0006 (SELECT + INSERT only; UPDATE/DELETE/
     TRUNCATE revoked), audit rows are immutable.

   Boundary rules:
   - Imports `config/supabase.js` ONLY. It does NOT import
     `config/db.js`, any controller, route, view, middleware, or
     public file. Server-only.
   - Supabase failures are rethrown as plain Error objects prefixed
     with `auditRepository.<method>:`, carrying only a redacted
     message (never keys, URLs, or other secret-like values).
   ======================================== */

const { getSupabaseClient } = require('../config/supabase');

// Explicit audit column list (matches system_logs in 0006).
const AUDIT_COLUMNS =
  'id, event_type, action, outcome, actor_user_id, attempted_email, ' +
  'actor_role, target_type, target_id, message, created_at';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
// Hard ceiling on pagination offset so a crafted ?offset=… can never push
// PostgREST into a huge range scan. UI paging stays well under this.
const MAX_OFFSET = 10000;

/* ---------- helpers ---------- */

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
  return new Error('auditRepository.' + method + ': ' + safeSupabaseMessage(error));
}

function strOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// attempted_email -> trimmed lowercase, or null. Never throws.
function emailOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  return s === '' ? null : s;
}

// A positive integer user id, or null (anonymous / failed-login events).
function userIdOrNull(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

function clampLimit(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(n), 1), MAX_LIMIT);
}

function clampOffset(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.trunc(n), MAX_OFFSET);
}

// Escape LIKE/ILIKE wildcards so user-supplied text matches literally.
function escapeLike(term) {
  return String(term).replace(/[\\%_]/g, (ch) => '\\' + ch);
}

// Apply the shared, exact/parameterized filters to a query builder.
// Returns the (re-chained) builder.
function applyFilters(query, { eventType, outcome, from, to, text } = {}) {
  let q = query;
  const et = strOrNull(eventType);
  if (et !== null) q = q.eq('event_type', et);
  const oc = strOrNull(outcome);
  if (oc !== null) q = q.eq('outcome', oc);
  const fromVal = strOrNull(from);
  if (fromVal !== null) q = q.gte('created_at', fromVal);
  const toVal = strOrNull(to);
  if (toVal !== null) q = q.lte('created_at', toVal);
  const txt = strOrNull(text);
  if (txt !== null) q = q.ilike('message', '%' + escapeLike(txt) + '%');
  return q;
}

/* ---------- writes (append-only) ---------- */

/**
 * Insert one audit row built from a FIXED field set and return the
 * inserted row. Any other payload key is ignored. attempted_email is
 * normalized to trimmed lowercase or null; actor_user_id to a positive
 * integer or null. No IP, request body, token, cookie, session, OAuth
 * subject, secret, or stack trace is ever read.
 */
async function insertLog(payload = {}) {
  const row = {
    event_type: strOrNull(payload.event_type),
    action: strOrNull(payload.action),
    outcome: strOrNull(payload.outcome),
    actor_user_id: userIdOrNull(payload.actor_user_id),
    attempted_email: emailOrNull(payload.attempted_email),
    actor_role: strOrNull(payload.actor_role),
    target_type: strOrNull(payload.target_type),
    target_id: strOrNull(payload.target_id),
    message: strOrNull(payload.message)
  };

  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('system_logs')
    .insert(row)
    .select(AUDIT_COLUMNS)
    .single();
  if (error) throw fail('insertLog', error);
  return data || null;
}

/* ---------- reads ---------- */

/**
 * List audit rows newest-first (created_at DESC, then id DESC) with
 * bounded pagination (default 50, max 100; non-negative offset) and the
 * shared exact/parameterized filters.
 */
async function listLogs({ eventType, outcome, from, to, text, limit, offset } = {}) {
  const lim = clampLimit(limit);
  const off = clampOffset(offset);

  const sb = getSupabaseClient();
  let query = sb
    .from('system_logs')
    .select(AUDIT_COLUMNS)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  query = applyFilters(query, { eventType, outcome, from, to, text });
  query = query.range(off, off + lim - 1);

  const { data, error } = await query;
  if (error) throw fail('listLogs', error);
  return data || [];
}

/**
 * Exact count of audit rows matching the same filters (head count; no
 * rows transferred). Lets UI code show truthful totals independent of
 * the current page.
 */
async function countLogs({ eventType, outcome, from, to, text } = {}) {
  const sb = getSupabaseClient();
  let query = sb.from('system_logs').select('id', { count: 'exact', head: true });
  query = applyFilters(query, { eventType, outcome, from, to, text });

  const { count, error } = await query;
  if (error) throw fail('countLogs', error);
  return count || 0;
}

module.exports = {
  // writes (append-only)
  insertLog,
  // reads
  listLogs,
  countLogs
};
