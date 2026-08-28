/* ========================================
   CampuSphere - Public Site Settings Service

   Reads the fixed, administrator-managed institutional settings for the
   server-rendered public pages. The admin API remains the write authority;
   this module only provides a safe presentation projection.
   ======================================== */

const db = require('../config/db');
const contentDataSource = require('../config/contentDataSource');
const siteContentRepository = require('../repositories/siteContentRepository');
const { logServerError } = require('../utils/serverLog');
const {
  DEFAULT_SCHOOL_DESCRIPTION,
  canonicalizeSchoolDescription,
  expandLegacySchoolDescription,
} = require('../utils/siteSettingsDescription');

const SETTINGS_SPEC = Object.freeze([
  { key: 'school_name', max: 150 },
  { key: 'school_acronym', max: 20 },
  { key: 'school_address', max: 255 },
  { key: 'school_founded', max: 4, year: true },
  { key: 'school_description', max: 2000 },
  { key: 'contact_address', max: 255 },
  { key: 'contact_phone', max: 50 },
  { key: 'contact_email', max: 254, email: true },
  { key: 'contact_website', max: 2048, url: true },
  { key: 'contact_hours', max: 255 },
]);

const SETTINGS_KEYS = Object.freeze(SETTINGS_SPEC.map((field) => field.key));
const SETTINGS_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SETTINGS_MIN_YEAR = 1900;

// These values are presentation fallbacks only; no request can write them
// through this module. The description keeps the two-block About format.
const DEFAULT_PUBLIC_SETTINGS = Object.freeze({
  school_name: 'Camarines Sur Polytechnic Colleges',
  school_acronym: 'CSPC',
  school_address: 'Nabua, Camarines Sur, Philippines',
  school_founded: '1983',
  school_description: DEFAULT_SCHOOL_DESCRIPTION,
  contact_address: 'San Miguel, Nabua, Camarines Sur 4434',
  contact_phone: '(054) 288 4421 to 23',
  contact_email: 'mail@cspc.edu.ph',
  contact_website: 'https://cspc.edu.ph',
  contact_hours: 'Monday - Friday, 8:00 AM - 5:00 PM',
});

function isValidSettingValue(spec, raw) {
  if (typeof raw !== 'string') return false;
  const value = raw.trim();
  if (value === '' || value.length > spec.max) return false;

  if (spec.key === 'school_description') {
    return canonicalizeSchoolDescription(value).ok;
  }

  if (spec.year) {
    const year = Number(value);
    const currentYear = new Date().getFullYear();
    return /^\d{4}$/.test(value) && Number.isInteger(year) &&
      year >= SETTINGS_MIN_YEAR && year <= currentYear;
  }

  if (spec.email && !SETTINGS_EMAIL_RE.test(value)) return false;

  if (spec.url) {
    let parsed;
    try { parsed = new URL(value); } catch (error) { parsed = null; }
    if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) return false;
  }

  return true;
}

/**
 * Build a public presentation object from database rows. Unknown keys,
 * malformed legacy values, and empty values fall back per field so one bad
 * row cannot break the public page or become an unsafe link.
 */
function normalizePublicSettings(rows) {
  const settings = { ...DEFAULT_PUBLIC_SETTINGS };
  const byKey = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row && typeof row.setting_key === 'string') byKey.set(row.setting_key, row.setting_value);
  }

  for (const spec of SETTINGS_SPEC) {
    const raw = byKey.get(spec.key);
    if (isValidSettingValue(spec, raw)) {
      settings[spec.key] = spec.key === 'school_description'
        ? expandLegacySchoolDescription(raw)
        : raw.trim();
    }
  }
  return settings;
}

async function readSettingsRows() {
  if (contentDataSource.isSupabase()) return siteContentRepository.listSettings();

  const placeholders = SETTINGS_KEYS.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${placeholders})`,
    SETTINGS_KEYS
  );
  return rows;
}

async function getPublicSettings() {
  return normalizePublicSettings(await readSettingsRows());
}

/**
 * Route middleware for public server-rendered pages. Public presentation keeps
 * its canonical fallback if the content backend is temporarily unavailable;
 * the admin API still reports backend errors to the administrator.
 */
async function loadPublicSettings(req, res, next) {
  try {
    res.locals.siteSettings = await getPublicSettings();
  } catch (error) {
    logServerError('siteSettings.public', req);
    res.locals.siteSettings = { ...DEFAULT_PUBLIC_SETTINGS };
  }
  return next();
}

module.exports = {
  DEFAULT_PUBLIC_SETTINGS,
  SETTINGS_KEYS,
  getPublicSettings,
  loadPublicSettings,
  normalizePublicSettings,
};
