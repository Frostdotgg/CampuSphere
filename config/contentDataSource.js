/* ========================================
   CampuSphere — Content Runtime Data Source Switch
   Milestone 4, Section 4.3
   ======================================== */

/**
 * Runtime switch that selects which backend the content controllers
 * (dashboard announcements, events, admin news/events CRUD) read from once the
 * later Milestone 4 sections (4.5 reads, 4.7 CRUD) wire them to the repository
 * layer. This module only normalises and exposes the value; no controller
 * consumes it yet.
 *
 *   CONTENT_DATA_SOURCE=mysql    -> existing direct MySQL queries (default).
 *   CONTENT_DATA_SOURCE=supabase -> Supabase repository path (added later).
 *
 * Unset, empty, or unrecognised values fall back to "mysql" with a single
 * non-secret warning. The helper has no side effects beyond that warning
 * and reads only process.env — it does not import the Supabase client,
 * the MySQL pool, or any repository, so requiring it cannot accidentally
 * trigger a backend connection.
 */

const VALID_CONTENT_DATA_SOURCES = Object.freeze(['mysql', 'supabase']);
const DEFAULT_CONTENT_DATA_SOURCE = 'mysql';

let warnedInvalid = false;

function getContentDataSource() {
  const raw = String(process.env.CONTENT_DATA_SOURCE || '').trim().toLowerCase();
  if (raw === '') return DEFAULT_CONTENT_DATA_SOURCE;
  if (VALID_CONTENT_DATA_SOURCES.includes(raw)) return raw;

  if (!warnedInvalid) {
    // Do not echo any part of the raw value — a misconfigured env could
    // contain anything (including accidentally-pasted secrets).
    console.warn(
      `[content] Unrecognised CONTENT_DATA_SOURCE value. ` +
      `Valid values: ${VALID_CONTENT_DATA_SOURCES.join(', ')}. ` +
      `Falling back to "${DEFAULT_CONTENT_DATA_SOURCE}".`
    );
    warnedInvalid = true;
  }
  return DEFAULT_CONTENT_DATA_SOURCE;
}

function isSupabase() {
  return getContentDataSource() === 'supabase';
}

function isMysql() {
  return getContentDataSource() === 'mysql';
}

module.exports = {
  getContentDataSource,
  isSupabase,
  isMysql,
  VALID_CONTENT_DATA_SOURCES,
  DEFAULT_CONTENT_DATA_SOURCE,
};
