/* ========================================
   CampuSphere — Auth/Profile Data Source Switch
   Milestone 2, Section 2.2
   ======================================== */

/**
 * Runtime switch that selects which backend the auth/profile/dashboard/
 * admin-user controllers read from once the Milestone 2 migration sections
 * (2.6 onward) wire them to the repository layer. This module only
 * normalises and exposes the value; no controller consumes it yet.
 *
 *   AUTH_DATA_SOURCE=mysql    -> existing direct MySQL queries (default).
 *   AUTH_DATA_SOURCE=supabase -> Supabase repository path (added later).
 *
 * Unset, empty, or unrecognised values fall back to "mysql" with a single
 * non-secret warning. The helper has no side effects beyond that warning
 * and reads only process.env — it does not import the Supabase client,
 * the MySQL pool, or any repository, so requiring it cannot accidentally
 * trigger a backend connection.
 */

const VALID_AUTH_DATA_SOURCES = Object.freeze(['mysql', 'supabase']);
const DEFAULT_AUTH_DATA_SOURCE = 'mysql';

let warnedInvalid = false;

function getAuthDataSource() {
  const raw = String(process.env.AUTH_DATA_SOURCE || '').trim().toLowerCase();
  if (raw === '') return DEFAULT_AUTH_DATA_SOURCE;
  if (VALID_AUTH_DATA_SOURCES.includes(raw)) return raw;

  if (!warnedInvalid) {
    // Do not echo any part of the raw value — a misconfigured env could
    // contain anything (including accidentally-pasted secrets).
    console.warn(
      `[auth] Unrecognised AUTH_DATA_SOURCE value. ` +
      `Valid values: ${VALID_AUTH_DATA_SOURCES.join(', ')}. ` +
      `Falling back to "${DEFAULT_AUTH_DATA_SOURCE}".`
    );
    warnedInvalid = true;
  }
  return DEFAULT_AUTH_DATA_SOURCE;
}

function isSupabase() {
  return getAuthDataSource() === 'supabase';
}

function isMysql() {
  return getAuthDataSource() === 'mysql';
}

module.exports = {
  getAuthDataSource,
  isSupabase,
  isMysql,
  VALID_AUTH_DATA_SOURCES,
  DEFAULT_AUTH_DATA_SOURCE,
};
