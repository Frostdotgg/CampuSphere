'use strict';
/* ========================================
   CampuSphere — Session Revocation (server-only)
   M1 hardening: invalidate a target user's PERSISTED sessions when an admin
   changes that user's role or password, or deletes the user, so a stale cookie
   cannot retain elevated (or any) access until natural cookie/session expiry.

   Boundary / behavior:
   - SERVER-ONLY. Never required by anything under public/ or by an EJS template.
   - Operates on the ACTIVE persistent session store selected by
     config/sessionConfig.js (Supabase preferred/production; MySQL fallback),
     the SAME store server.js resolved at startup from the same env.
   - Both persistent stores key session rows by `sid` and store the serialized
     express-session object (which carries { user: { id, ... } } after login) in
     `sess`. This helper deletes exactly the rows whose sess.user.id matches the
     target user id, using parameterized SQL (MySQL) / the server-only Supabase
     client with a jsonb path filter (Supabase).
   - SESSION_STORE=memory is local-development only (it fails closed in
     production) and the in-process MemoryStore cannot be enumerated by user id
     through the persistent stores, so it is a documented no-op here.

   Privacy: this module logs NOTHING — never a sid, session JSON, SQL/PostgREST
   text, Supabase URL/key, cookie, or raw DB error. Any failure surfaces one
   fixed, sanitized Error to the caller (which maps it to a generic 500).
   ======================================== */

const db = require('../config/db');
const { getSupabaseClient } = require('../config/supabase');
const { resolveSessionConfig } = require('../config/sessionConfig');

// Fixed table name shared by both persistent stores. services/mysqlSessionStore.js
// (DEFAULT_TABLE) and database/supabase/0011_supabase_session_store.sql both use
// `app_sessions`; it is a compile-time constant here (never user input).
const SESSIONS_TABLE = 'app_sessions';

// Fixed, sanitized error. Carries no sid, session JSON, SQL/PostgREST detail,
// Supabase host/key, or raw DB error.
function sanitizedRevokeError() {
  return new Error('Session revocation failed.');
}

// Accept a canonical positive safe integer id (number or all-digit string), or
// null. Mirrors the controller's parseRouteId contract without importing it.
function normalizeUserId(raw) {
  if (typeof raw === 'number') {
    return Number.isSafeInteger(raw) && raw >= 1 ? raw : null;
  }
  if (typeof raw === 'string' && /^[1-9][0-9]*$/.test(raw.trim())) {
    const n = Number(raw.trim());
    return Number.isSafeInteger(n) && n >= 1 ? n : null;
  }
  return null;
}

// MySQL: delete session rows whose serialized payload has user.id === id.
// `sess` is LONGTEXT holding JSON.stringify(session); JSON_VALID guards any
// legacy/non-JSON row and the id is bound (parameterized). The JSON path is a
// fixed literal. No sid, JSON, SQL text, or value is logged.
async function revokeMysql(id) {
  await db.query(
    'DELETE FROM `' + SESSIONS_TABLE + '` ' +
    "WHERE JSON_VALID(sess) AND JSON_EXTRACT(sess, '$.user.id') = ?",
    [id]
  );
}

// Supabase: delete session rows whose jsonb payload has sess.user.id === id,
// via the server-only service-role client. `sess->user->>id` extracts the
// nested id as text, compared to the id as a string. No Supabase URL/key, sid,
// session JSON, PostgREST detail, or raw error is logged; a PostgREST error is
// rethrown to be sanitized by revokeUserSessions.
async function revokeSupabase(id) {
  const client = getSupabaseClient();
  const { error } = await client
    .from(SESSIONS_TABLE)
    .delete()
    .eq('sess->user->>id', String(id));
  if (error) throw error; // never logged; caller sanitizes
}

/**
 * Revoke every persisted session belonging to the given user id from the
 * ACTIVE session store. Best-effort by store kind:
 *   - mysql / supabase : delete matching persisted session rows.
 *   - memory           : no-op (local-dev only; not enumerable here).
 *
 * @param {number|string} userId canonical positive integer user id
 * @throws {Error} a fixed, sanitized Error on invalid id or revocation failure
 * @returns {Promise<void>}
 */
async function revokeUserSessions(userId) {
  const id = normalizeUserId(userId);
  if (id === null) {
    throw sanitizedRevokeError();
  }

  // Identify the active store from the same runtime policy server.js uses. The
  // server already started (so this resolve succeeded once); wrap defensively.
  let storeKind;
  try {
    storeKind = resolveSessionConfig().storeKind;
  } catch (e) {
    throw sanitizedRevokeError();
  }

  try {
    if (storeKind === 'mysql') {
      await revokeMysql(id);
    } else if (storeKind === 'supabase') {
      await revokeSupabase(id);
    } else {
      // memory: local-development only (SESSION_STORE=memory fails closed in
      // production). The in-process MemoryStore is not enumerable by user id
      // through the persistent stores, so there is nothing to revoke here.
      return;
    }
  } catch (e) {
    throw sanitizedRevokeError();
  }
}

module.exports = { revokeUserSessions };
