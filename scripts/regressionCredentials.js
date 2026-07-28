'use strict';

/* ========================================
   CampuSphere — shared TEST-ONLY regression credential loader (M12.P1-R1)

   Single source of the local-login regression identities used by the
   Supabase-capable authentication probes and quality gates. This module is
   TEST TOOLING ONLY: it must never be required by server runtime code, an EJS
   view, or anything under public/.

   Sources:
     'mysql'    -> deterministic LOCAL-ONLY fixtures matching database/seed.js.
                   These exist only in local development MySQL databases that
                   the seed script itself creates; they are not live
                   credentials. The MySQL seed creates only the admin and
                   student fixtures, so only those two identities exist here.
     'supabase' -> the eight TEST-ONLY SUPABASE_REGRESSION_* variables read
                   from the inherited environment (ignored local .env):
                     SUPABASE_REGRESSION_ADMIN_EMAIL / _ADMIN_PASSWORD
                     SUPABASE_REGRESSION_STUDENT_EMAIL / _STUDENT_PASSWORD
                     SUPABASE_REGRESSION_INSTRUCTOR_EMAIL / _INSTRUCTOR_PASSWORD
                     SUPABASE_REGRESSION_GUEST_EMAIL / _GUEST_PASSWORD
                   A missing or blank value FAILS CLOSED with one fixed
                   sanitized error. Supabase mode NEVER falls back to a
                   documented, hardcoded, or local-fixture credential.

   Privacy contract:
     - This module never logs, prints, serializes, or embeds a credential
       value (or which variable was missing) in any error or output.
     - Callers must never print, record, or transmit the returned values;
       they exist solely for in-memory authentication/regression use.
   ======================================== */

// Fixed sanitized failure messages. NEVER include a value, a partial value,
// or the specific missing variable name — operators diff their ignored local
// .env against .env.example instead.
const MISSING_SUPABASE_MESSAGE =
  'Supabase regression credentials are not configured. Set all eight ' +
  'SUPABASE_REGRESSION_* variables in the ignored local .env (test-only; ' +
  'values are never printed or committed).';
const UNKNOWN_SOURCE_MESSAGE =
  'Unknown regression credential source (expected "mysql" or "supabase").';
const MYSQL_IDENTITY_MESSAGE =
  'The requested regression identity has no deterministic local MySQL seed ' +
  'fixture (only admin and student exist in database/seed.js).';

// Deterministic LOCAL-ONLY MySQL seed fixtures (database/seed.js). These are
// permitted to stay in source per the M12.P1-R1 contract: they never leave
// the locally seeded development database and are dead as live credentials.
const MYSQL_FIXTURES = Object.freeze({
  admin: Object.freeze({ email: 'admin@cspc.edu.ph', password: 'admin123' }),
  student: Object.freeze({ email: 'aaron.lasprillas@cspc.edu.ph', password: 'student123' }),
});

// Environment variable names (names are public interface; values are not).
const SUPABASE_ENV_KEYS = Object.freeze({
  admin: Object.freeze({
    email: 'SUPABASE_REGRESSION_ADMIN_EMAIL',
    password: 'SUPABASE_REGRESSION_ADMIN_PASSWORD',
  }),
  student: Object.freeze({
    email: 'SUPABASE_REGRESSION_STUDENT_EMAIL',
    password: 'SUPABASE_REGRESSION_STUDENT_PASSWORD',
  }),
  instructor: Object.freeze({
    email: 'SUPABASE_REGRESSION_INSTRUCTOR_EMAIL',
    password: 'SUPABASE_REGRESSION_INSTRUCTOR_PASSWORD',
  }),
  guest: Object.freeze({
    email: 'SUPABASE_REGRESSION_GUEST_EMAIL',
    password: 'SUPABASE_REGRESSION_GUEST_PASSWORD',
  }),
});

function isPresent(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function loadSupabaseCredentials() {
  const out = {};
  for (const [slot, keys] of Object.entries(SUPABASE_ENV_KEYS)) {
    const email = process.env[keys.email];
    const password = process.env[keys.password];
    if (!isPresent(email) || !isPresent(password)) {
      // Fail closed. The message is fixed and sanitized: no value, no
      // variable name, no fallback to any documented/hardcoded credential.
      throw new Error(MISSING_SUPABASE_MESSAGE);
    }
    // Email may be safely trimmed; the password is kept byte-for-byte.
    out[slot] = Object.freeze({ email: email.trim(), password });
  }
  return Object.freeze(out);
}

/**
 * Resolve the regression credentials for one auth backend.
 *
 * @param {string} source 'mysql' (deterministic local seed fixtures: admin and
 *   student only) or 'supabase' (all four identities from the test-only
 *   SUPABASE_REGRESSION_* environment; fails closed when incomplete).
 * @returns {{admin?: {email: string, password: string},
 *            student?: {email: string, password: string},
 *            instructor?: {email: string, password: string},
 *            guest?: {email: string, password: string}}} frozen credential map
 * @throws {Error} one fixed sanitized message; never a credential value
 */
function getRegressionCredentials(source) {
  const normalized = String(source == null ? '' : source).trim().toLowerCase();
  if (normalized === 'mysql') return MYSQL_FIXTURES;
  if (normalized === 'supabase') return loadSupabaseCredentials();
  throw new Error(UNKNOWN_SOURCE_MESSAGE);
}

/**
 * Convenience guard for MySQL-mode callers that would otherwise dereference a
 * fixture the local seed does not create (instructor/guest). Fails closed
 * with a fixed sanitized message instead of returning undefined.
 */
function requireIdentity(credentials, slot) {
  const entry = credentials && credentials[slot];
  if (!entry || !isPresent(entry.email) || !isPresent(entry.password)) {
    throw new Error(MYSQL_IDENTITY_MESSAGE);
  }
  return entry;
}

module.exports = {
  getRegressionCredentials,
  requireIdentity,
  SUPABASE_ENV_KEYS,
};
