'use strict';

/* ========================================
   CampuSphere — Shared media URL policy (Milestone 10, Section 10.4)

   Single server-side source of truth for which image / 360-panorama media URLs
   are SAFE to store and render. Used by:
     - utils/buildingData.js  (building image normalization, read path)
     - controllers/adminVrController.js (VR scene image_url input validation)
     - later Milestone 10 sections (VR runtime in 10.5, admin media in 10.6)

   Policy (deny by default):
     - ACCEPT a local same-origin path under /img/ (covers /img/ and /img/vr/):
       must start with "/img/", contain no scheme, no protocol-relative "//",
       no ".." traversal, and only the allowlisted path characters.
     - ACCEPT an absolute HTTPS URL whose host is EXACTLY the Cloudinary delivery
       host (config/cloudinary.js -> CLOUDINARY_DELIVERY_HOST,
       i.e. res.cloudinary.com), with no embedded credentials (user:pass@).
     - REJECT everything else: http:, javascript:, data:, blob:, file:,
       protocol-relative ("//host"), traversal ("/img/../.."), arbitrary HTTPS
       hosts (example.com), look-alike hosts (res.cloudinary.com.evil.com),
       userinfo tricks (user@res.cloudinary.com), and malformed URLs.

   Boundary: pure + server-only. Imports config/cloudinary.js for the host
   constant only; it NEVER reads, returns, logs, or exposes any Cloudinary
   secret / API key. No DB, no req/res, no network. Returns a safe string or
   null; callers map a null to their own sanitized rejection / fallback.
   ======================================== */

const { CLOUDINARY_DELIVERY_HOST } = require('../config/cloudinary');

// Generous upper bound so a crafted/oversized URL can never reach a parser or a
// column. The media columns are VARCHAR(255); admin validators apply their own
// (255) limit before calling here. This is only a defensive ceiling.
const MEDIA_URL_MAX = 2048;

// Local same-origin media path under /img/ (covers /img/ and /img/vr/).
// No scheme, no protocol-relative "//", no ".." traversal, allowlisted chars.
function isLocalImgPath(v) {
  if (v.charAt(0) !== '/') return false;
  if (v.indexOf('//') !== -1) return false; // protocol-relative or doubled slash
  if (v.indexOf('..') !== -1) return false; // path traversal
  return /^\/img\/[A-Za-z0-9._/-]+$/.test(v);
}

// Absolute HTTPS Cloudinary delivery URL: scheme exactly https:, host exactly
// the approved delivery host, and no embedded userinfo (user:pass@host).
function isCloudinaryDeliveryUrl(v) {
  let u;
  try { u = new URL(v); } catch (e) { return false; }
  if (u.protocol !== 'https:') return false;
  if (u.hostname !== CLOUDINARY_DELIVERY_HOST) return false;
  if (u.username !== '' || u.password !== '') return false; // reject user@host tricks
  if (u.port !== '') return false; // reject an explicit non-default port (e.g. :444)
  // WHATWG normalizes the default https port :443 to an empty u.port, so a raw
  // authority check also rejects an explicit :443 (and any userinfo): the
  // authority — between "://" and the first '/', '?' or '#' — must carry no
  // ':' (port) and no '@' (userinfo).
  const schemeSep = v.indexOf('://');
  if (schemeSep === -1) return false;
  const authority = v.slice(schemeSep + 3).split(/[/?#]/, 1)[0];
  if (authority.indexOf(':') !== -1 || authority.indexOf('@') !== -1) return false;
  return true;
}

/**
 * Validate + normalize a media URL against the policy above.
 * @returns the safe (trimmed, unchanged) string when acceptable, else null.
 *          undefined / null / '' / non-string all return null.
 */
function normalizeMediaUrl(raw) {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (v === '' || v.length > MEDIA_URL_MAX) return null;
  if (v.charAt(0) === '/') return isLocalImgPath(v) ? v : null;
  return isCloudinaryDeliveryUrl(v) ? v : null;
}

/** Boolean convenience wrapper around normalizeMediaUrl. */
function isSafeMediaUrl(raw) {
  return normalizeMediaUrl(raw) !== null;
}

/**
 * Validate an OPTIONAL media `image_url` field for admin create/update payloads.
 * Distinguishes "blank -> store null" from "present-but-unsafe -> reject", which
 * normalizeMediaUrl alone cannot (it returns null for both). `max` bounds the
 * length to the storage column (callers pass 255 for the VARCHAR(255) columns).
 *
 * @returns { ok:true, value:(string|null) } on accept, or { ok:false } on reject.
 */
function validateImageUrlField(raw, max = MEDIA_URL_MAX) {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false };
  const v = raw.trim();
  if (v === '') return { ok: true, value: null };
  if (v.length > max) return { ok: false };
  const safe = normalizeMediaUrl(v);
  if (safe === null) return { ok: false };
  return { ok: true, value: safe };
}

// Cloudinary public-id length ceiling (mirrors the VARCHAR(255) columns).
const PUBLIC_ID_MAX = 255;

/**
 * Validate an optional Cloudinary public id (Milestone 10, Section 10.6). This
 * is DELIVERY METADATA only — this module never derives a delivery URL from it.
 *
 * Policy (deny by default):
 *   - undefined / null / '' (and all-whitespace) -> { ok:true, value:null }.
 *   - max 255 chars.
 *   - conservative allowlist ONLY: letters, numbers, '/', '.', '_', '-', '~'.
 *     This rejects whitespace, control chars, backslash, URL schemes (':'),
 *     query/fragment ('?','#'), '<','>', quotes, and any other character.
 *   - additionally reject '..' (traversal), '//' (doubled slash), and a
 *     leading or trailing '/'.
 *
 * @returns { ok:true, value:(string|null) } on accept, or { ok:false } on reject.
 */
function validateCloudinaryPublicId(raw) {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false };
  if (raw.trim() === '') return { ok: true, value: null };
  if (raw.length > PUBLIC_ID_MAX) return { ok: false };
  if (!/^[A-Za-z0-9/._~-]+$/.test(raw)) return { ok: false };
  if (raw.indexOf('..') !== -1) return { ok: false };
  if (raw.indexOf('//') !== -1) return { ok: false };
  if (raw.charAt(0) === '/' || raw.charAt(raw.length - 1) === '/') return { ok: false };
  return { ok: true, value: raw };
}

module.exports = {
  normalizeMediaUrl,
  isSafeMediaUrl,
  validateImageUrlField,
  validateCloudinaryPublicId,
  MEDIA_URL_MAX,
  PUBLIC_ID_MAX,
};
