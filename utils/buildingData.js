/* ========================================
   CampuSphere - Building Data Helpers
   Single source of truth for normalizing
   building rows from MySQL.
   ======================================== */

const { normalizeMediaUrl } = require('./mediaUrl');

const DEFAULT_IMG = '/img/Camarines-sur-polytechnic-colleges.png';

/**
 * Safely parse the `details` JSON column.
 * Returns a plain object, or {} on any failure.
 */
function parseBuildingDetails(details) {
  if (!details) return {};
  if (typeof details === 'object' && !Array.isArray(details)) return details;
  try {
    const parsed = JSON.parse(details);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    // malformed JSON - fall through
  }
  return {};
}

/**
 * Convert a raw coordinate value to a finite Number, or null.
 * Handles null, undefined, and empty string as missing.
 */
function toCoord(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalize a single MySQL building row into the shape used by
 * every view and JSON response. Row-level fields always win over
 * anything found inside `details`.
 */
function normalizeBuildingRow(row) {
  const details = parseBuildingDetails(row.details);

  return {
    // detail-only fields (lowest priority - row columns override these)
    floors:    Array.isArray(details.floors)    ? details.floors    : [],
    entrances: Array.isArray(details.entrances) ? details.entrances : [],
    walkTime:  details.walkTime  ?? null,
    landmarks: Array.isArray(details.landmarks) ? details.landmarks : [],
    info:      Array.isArray(details.info)      ? details.info      : [],
    routes:    Array.isArray(details.routes)    ? details.routes    : [],

    // canonical row fields - row values always win over anything in details
    id:          row.id,
    name:        row.name,
    category:    row.category    || 'Uncategorized',
    description: row.description || 'No description available.',
    desc:        row.description || 'No description available.',
    lat:         toCoord(row.lat),
    lng:         toCoord(row.lng),
    // Milestone 10 (Section 10.4): prefer a validated row.image_url (the 10.3
    // parity column, possibly a Cloudinary delivery URL), then a validated
    // details.img, then the local default. normalizeMediaUrl only passes safe
    // local /img/ paths or https://res.cloudinary.com URLs, so an unsafe or
    // malformed stored value falls through to the next option instead of
    // rendering. Output key stays `img` so views / public JS are unaffected.
    img:         normalizeMediaUrl(row.image_url) || normalizeMediaUrl(details.img) || DEFAULT_IMG,
    guestAccess: details.guestAccess ?? false,
  };
}

/**
 * Normalize an array of MySQL building rows.
 */
function normalizeBuildingRows(rows) {
  return rows.map(normalizeBuildingRow);
}

module.exports = { parseBuildingDetails, normalizeBuildingRow, normalizeBuildingRows };
