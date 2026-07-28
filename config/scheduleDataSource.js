/* ========================================
   CampuSphere — Schedule Runtime Data Source Switch
   Milestone 11, Section 11.4
   ======================================== */

/**
 * Runtime switch that selects which backend the room-scheduling data access
 * (repositories/scheduleRepository.js; consumed by the later Milestone 11
 * admin CRUD and public display sections) runs against. This module only
 * normalises and exposes the value.
 *
 *   SCHEDULE_DATA_SOURCE=mysql    -> parameterized MySQL pool queries (default).
 *   SCHEDULE_DATA_SOURCE=supabase -> server-only Supabase repository path.
 *
 * Unset, empty, or unrecognised values fall back to "mysql" with a single
 * non-secret warning. The helper has no side effects beyond that warning
 * and reads only process.env — it does not import the Supabase client,
 * the MySQL pool, or any repository, so requiring it cannot accidentally
 * trigger a backend connection.
 */

const VALID_SCHEDULE_DATA_SOURCES = Object.freeze(['mysql', 'supabase']);
const DEFAULT_SCHEDULE_DATA_SOURCE = 'mysql';

let warnedInvalid = false;

function getScheduleDataSource() {
  const raw = String(process.env.SCHEDULE_DATA_SOURCE || '').trim().toLowerCase();
  if (raw === '') return DEFAULT_SCHEDULE_DATA_SOURCE;
  if (VALID_SCHEDULE_DATA_SOURCES.includes(raw)) return raw;

  if (!warnedInvalid) {
    // Do not echo any part of the raw value — a misconfigured env could
    // contain anything (including accidentally-pasted secrets).
    console.warn(
      `[schedule] Unrecognised SCHEDULE_DATA_SOURCE value. ` +
      `Valid values: ${VALID_SCHEDULE_DATA_SOURCES.join(', ')}. ` +
      `Falling back to "${DEFAULT_SCHEDULE_DATA_SOURCE}".`
    );
    warnedInvalid = true;
  }
  return DEFAULT_SCHEDULE_DATA_SOURCE;
}

function isSupabase() {
  return getScheduleDataSource() === 'supabase';
}

function isMysql() {
  return getScheduleDataSource() === 'mysql';
}

module.exports = {
  getScheduleDataSource,
  isSupabase,
  isMysql,
  VALID_SCHEDULE_DATA_SOURCES,
  DEFAULT_SCHEDULE_DATA_SOURCE,
};
