/* ========================================
   CampuSphere — VR Runtime Data Source Switch
   Milestone 5, Section 5.2
   ======================================== */

/**
 * Runtime switch that selects which backend the VR / 360 controllers (scene
 * browser, guided route viewer, VR route API) read from once the later
 * Milestone 5 sections (5.4 scene reads, 5.5 guided route reads/API) wire them
 * to the repository layer. This module only normalises and exposes the value;
 * no controller consumes it yet.
 *
 *   VR_DATA_SOURCE=mysql    -> existing direct MySQL queries (default).
 *   VR_DATA_SOURCE=supabase -> Supabase repository path (added later).
 *
 * Unset, empty, or unrecognised values fall back to "mysql" with a single
 * non-secret warning. The helper has no side effects beyond that warning
 * and reads only process.env — it does not import the Supabase client,
 * the MySQL pool, or any repository, so requiring it cannot accidentally
 * trigger a backend connection.
 */

const VALID_VR_DATA_SOURCES = Object.freeze(['mysql', 'supabase']);
const DEFAULT_VR_DATA_SOURCE = 'mysql';

let warnedInvalid = false;

function getVrDataSource() {
  const raw = String(process.env.VR_DATA_SOURCE || '').trim().toLowerCase();
  if (raw === '') return DEFAULT_VR_DATA_SOURCE;
  if (VALID_VR_DATA_SOURCES.includes(raw)) return raw;

  if (!warnedInvalid) {
    // Do not echo any part of the raw value — a misconfigured env could
    // contain anything (including accidentally-pasted secrets).
    console.warn(
      `[vr] Unrecognised VR_DATA_SOURCE value. ` +
      `Valid values: ${VALID_VR_DATA_SOURCES.join(', ')}. ` +
      `Falling back to "${DEFAULT_VR_DATA_SOURCE}".`
    );
    warnedInvalid = true;
  }
  return DEFAULT_VR_DATA_SOURCE;
}

function isSupabase() {
  return getVrDataSource() === 'supabase';
}

function isMysql() {
  return getVrDataSource() === 'mysql';
}

module.exports = {
  getVrDataSource,
  isSupabase,
  isMysql,
  VALID_VR_DATA_SOURCES,
  DEFAULT_VR_DATA_SOURCE,
};
