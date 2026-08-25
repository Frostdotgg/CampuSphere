'use strict';

/* ========================================
   CampuSphere - Audit Service (server-only)
   Milestone 7, Section 7.4.

   Centralised, best-effort application audit trail. Controllers and
   middleware call record(payload); the service reconstructs a FIXED,
   sanitised field set and writes one immutable row to system_logs in
   whichever backend CONTENT_DATA_SOURCE selects:

     CONTENT_DATA_SOURCE=supabase -> repositories/auditRepository.insertLog()
     CONTENT_DATA_SOURCE=mysql    -> one parameterised INSERT (default)

   Best-effort contract (never alters the primary request):
   - record() NEVER throws and NEVER rejects. It returns true on a stored
     row, false on a refused/failed write. Callers fire-and-forget.
   - On any failure it prints ONE fixed warning and nothing else: no error
     object, no stack, no SQL, no Supabase URL/key, no row contents.

   Privacy / immutability:
   - The row is built from a fixed allowlist of columns ONLY. Arbitrary
     payload keys are ignored, so an IP address, password, request body,
     token, cookie, session id, OAuth subject, secret, or stack trace can
     never reach a column.
   - There is no update/delete path here; combined with the append-only
     repository and the service_role grants in migration 0006, audit rows
     are immutable through the application.

   Cross-database safety:
   - actor_user_id carries a FOREIGN KEY to users(id) in the SAME database
     the log is written to. When AUTH_DATA_SOURCE and CONTENT_DATA_SOURCE
     point at different backends, the actor's id belongs to a different id
     space, so we store actor_user_id = null (keeping actor_role and the
     attempted email for context) to avoid a wrong/violating reference.

   Boundary rules:
   - Server-only. Imports config/db (MySQL pool), config/contentDataSource,
     config/authDataSource, and repositories/auditRepository. It is never
     required by anything under public/ or by an EJS template.
   ======================================== */

const db = require('../config/db');
const contentDataSource = require('../config/contentDataSource');
const authDataSource = require('../config/authDataSource');
const auditRepository = require('../repositories/auditRepository');

/* ---------- fixed taxonomy (Section 7.4) ---------- */

const EVENT_TYPES = Object.freeze([
  'authentication',
  'profile',
  'authorization',
  'admin_mutation'
]);

const OUTCOMES = Object.freeze(['success', 'failure', 'denied']);

const ACTIONS = Object.freeze([
  // authentication
  'login.local',
  'login.google',
  // profile
  'profile.update',
  // authorization
  'access.denied',
  // admin_mutation
  'admin.user.create',
  'admin.user.update',
  'admin.user.delete',
  'admin.news.create',
  'admin.news.update',
  'admin.news.delete',
  'admin.faq.create',
  'admin.faq.update',
  'admin.faq.delete',
  'admin.event.create',
  'admin.event.update',
  'admin.event.delete',
  'admin.building.create',
  'admin.building.update',
  'admin.building.delete',
  // Room schedule administration (Milestone 11, Section 11.4)
  'admin.schedule.create',
  'admin.schedule.update',
  'admin.schedule.delete',
  // Semester-long room schedule image administration.
  'admin.room_schedule_document.create',
  'admin.room_schedule_document.update',
  'admin.room_schedule_document.delete',
  'admin.settings.update',
  // VR scene/hotspot administration (Milestone 7, Section 7.8)
  'admin.vr.scene.create',
  'admin.vr.scene.update',
  'admin.vr.scene.delete',
  'admin.vr.hotspot.create',
  'admin.vr.hotspot.update',
  'admin.vr.hotspot.delete',
  // Route / step / node / edge administration (Milestone 7, Section 7.9)
  'admin.route.create',
  'admin.route.update',
  'admin.route.delete',
  'admin.route.steps.update',
  'admin.route_node.create',
  'admin.route_node.update',
  'admin.route_node.delete',
  'admin.route_edge.create',
  'admin.route_edge.update',
  'admin.route_edge.delete',
  // Road-geometry editor (Pre-Milestone-12, RF.4). Fixed events only; the
  // audit row never carries coordinates (message is a fixed string).
  'admin.route_edge.geometry.update',
  'admin.route_edge.geometry.clear'
]);

// Column character caps, matching database/schema.sql and migration 0006.
const CAPS = Object.freeze({
  event_type: 50,
  action: 100,
  outcome: 20,
  attempted_email: 100,
  actor_role: 30,
  target_type: 50,
  target_id: 100,
  message: 500
});

// One fixed, non-secret warning for every failure path. No interpolation.
const WARNING = '[audit] Failed to record an audit event.';

/* ---------- field normalisation / sanitisation ---------- */

// Replace ASCII control characters (0x00-0x1F and DEL 0x7F) with `repl`.
// Done by character code rather than a regex literal so no control byte
// ever has to live in this source file. Guards against a newline/markup/
// NUL slipping into a stored value or a log line, even though every
// caller passes fixed, non-secret text.
function replaceControlChars(input, repl) {
  let out = '';
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    out += (code <= 0x1f || code === 0x7f) ? repl : input[i];
  }
  return out;
}

// Collapse control characters + whitespace, trim, and hard-cap length.
// Returns null for empty/blank input so optional columns stay NULL rather
// than storing an empty string.
function sanitizeField(value, maxLen) {
  if (value === undefined || value === null) return null;
  let s = replaceControlChars(String(value), ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (s === '') return null;
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

// Attempted-login email -> control-stripped, trimmed, lowercase, capped, or
// null. Never throws.
function emailOrNull(value) {
  if (value === undefined || value === null) return null;
  let s = replaceControlChars(String(value), '').trim().toLowerCase();
  if (s === '') return null;
  if (s.length > CAPS.attempted_email) s = s.slice(0, CAPS.attempted_email);
  return s;
}

// A positive integer actor id, or null (anonymous / failed-login events).
function actorIdOrNull(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/* ---------- public API ---------- */

/**
 * Record one audit event. Best-effort: never throws, never rejects.
 * @param {object} payload fixed-field audit payload (extra keys ignored)
 * @returns {Promise<boolean>} true if a row was stored, false otherwise
 */
async function record(payload = {}) {
  try {
    const event_type = sanitizeField(payload.event_type, CAPS.event_type);
    const action = sanitizeField(payload.action, CAPS.action);
    const outcome = sanitizeField(payload.outcome, CAPS.outcome);
    const actor_role = sanitizeField(payload.actor_role, CAPS.actor_role);
    const target_type = sanitizeField(payload.target_type, CAPS.target_type);
    const target_id = sanitizeField(payload.target_id, CAPS.target_id);
    const message = sanitizeField(payload.message, CAPS.message);
    const attempted_email = emailOrNull(payload.attempted_email);

    // Guard the NOT NULL columns and the fixed taxonomy. An out-of-taxonomy
    // call is a programming error, not a runtime audit failure; refuse it
    // quietly rather than writing a malformed row.
    if (!event_type || !EVENT_TYPES.includes(event_type)) {
      console.warn(WARNING);
      return false;
    }
    if (!action || !ACTIONS.includes(action)) {
      console.warn(WARNING);
      return false;
    }
    if (!outcome || !OUTCOMES.includes(outcome)) {
      console.warn(WARNING);
      return false;
    }
    if (!message) {
      console.warn(WARNING);
      return false;
    }

    // Only attribute the actor's id when the auth backend and the log
    // backend are the same database (shared id space + valid FK target).
    let actor_user_id = null;
    if (authDataSource.getAuthDataSource() === contentDataSource.getContentDataSource()) {
      actor_user_id = actorIdOrNull(payload.actor_user_id);
    }

    const row = {
      event_type,
      action,
      outcome,
      actor_user_id,
      attempted_email,
      actor_role,
      target_type,
      target_id,
      message
    };

    if (contentDataSource.isSupabase()) {
      await auditRepository.insertLog(row);
    } else {
      await db.query(
        'INSERT INTO system_logs ' +
          '(event_type, action, outcome, actor_user_id, attempted_email, ' +
          'actor_role, target_type, target_id, message) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          event_type,
          action,
          outcome,
          actor_user_id,
          attempted_email,
          actor_role,
          target_type,
          target_id,
          message
        ]
      );
    }

    return true;
  } catch (err) {
    // Best-effort: swallow everything, leak nothing, never reject.
    console.warn(WARNING);
    return false;
  }
}

module.exports = {
  record,
  EVENT_TYPES,
  OUTCOMES,
  ACTIONS
};
