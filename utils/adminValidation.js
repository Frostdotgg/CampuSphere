'use strict';

/* ========================================
   CampuSphere — Shared admin CRUD validation primitives (R7)

   Pure, server-only validation helpers used by the legacy admin JSON CRUD
   controllers (users, news/announcements, events, buildings) so they all
   reject malformed input the same way the FAQ/settings validators already do.

   Boundary: no DB, no req/res, no logging, no secrets. Each helper returns a
   plain { ok: true, value } or { ok: false, message } result (or a primitive
   for the id/object guards). Controllers map a failed result to the standard
   400 JSON { success: false, message } and perform NO database work or audit
   on failure. Messages name the field and rule only — never the submitted
   value, and never raw errors.
   ======================================== */

// Canonical positive-integer route id. Mirrors parseFaqId in
// adminContentController.js: rejects blanks, signs, leading zeros, fractions,
// scientific notation, and unsafe magnitudes. Returns a positive integer, or
// null (the caller answers 400 without touching the database).
function parseRouteId(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const s = String(raw).trim();
  if (!/^(0|[1-9][0-9]*)$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < 1) return null;
  return n;
}

// True only for a non-null, non-array plain object.
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// Guard the request body shape and reject any key outside `allowed`. Returns
// { ok: true } or { ok: false, message }. Unknown keys are rejected (not
// echoed) so attacker-controlled key text never reflects into the response.
function validateBody(body, allowed) {
  if (!isPlainObject(body)) {
    return { ok: false, message: 'Request body must be a JSON object.' };
  }
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) {
      return { ok: false, message: 'Request contains one or more unsupported fields.' };
    }
  }
  return { ok: true };
}

// Trimmed required string with an inclusive [min, max] length bound.
function requiredString(raw, label, max, min = 1) {
  if (typeof raw !== 'string') {
    return { ok: false, message: `${label} is required.` };
  }
  const value = raw.trim();
  if (value.length < min) {
    return { ok: false, message: `${label} is required.` };
  }
  if (value.length > max) {
    return { ok: false, message: `${label} must be ${max} characters or fewer.` };
  }
  return { ok: true, value };
}

// Trimmed optional string. undefined/null/'' -> '' (the column default the
// existing controllers already store). Non-strings are rejected; over-length
// is rejected.
function optionalString(raw, label, max) {
  if (raw === undefined || raw === null) return { ok: true, value: '' };
  if (typeof raw !== 'string') {
    return { ok: false, message: `${label} must be text.` };
  }
  const value = raw.trim();
  if (value.length > max) {
    return { ok: false, message: `${label} must be ${max} characters or fewer.` };
  }
  return { ok: true, value };
}

// Allowlisted trimmed string. Returns the trimmed value when it is one of
// `allowed`, else a fixed message.
function allowedValue(raw, label, allowed) {
  if (typeof raw !== 'string') {
    return { ok: false, message: `Invalid ${label}.` };
  }
  const value = raw.trim();
  if (!allowed.includes(value)) {
    return { ok: false, message: `Invalid ${label}.` };
  }
  return { ok: true, value };
}

// Trimmed, length-capped, format-checked email.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validateEmail(raw, max = 254) {
  if (typeof raw !== 'string') {
    return { ok: false, message: 'Email is required.' };
  }
  const value = raw.trim();
  if (value === '') return { ok: false, message: 'Email is required.' };
  if (value.length > max) {
    return { ok: false, message: `Email must be ${max} characters or fewer.` };
  }
  if (!EMAIL_RE.test(value)) {
    return { ok: false, message: 'Email must be a valid email address.' };
  }
  return { ok: true, value };
}

// Password: a string of [min, max] characters. The RAW value is returned for
// hashing and is never trimmed, logged, or echoed.
function validatePassword(raw, min = 8, max = 128) {
  if (typeof raw !== 'string') {
    return { ok: false, message: 'Password must be text.' };
  }
  if (raw.length < min) {
    return { ok: false, message: `Password must be at least ${min} characters.` };
  }
  if (raw.length > max) {
    return { ok: false, message: `Password must be ${max} characters or fewer.` };
  }
  return { ok: true, value: raw };
}

// Finite number within an inclusive [lo, hi] range. Accepts a finite JS number
// or a strict decimal string (no hex, exponent, NaN, Infinity, or blanks).
const DECIMAL_RE = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
function validateNumberInRange(raw, label, lo, hi) {
  let n;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return { ok: false, message: `${label} must be a number between ${lo} and ${hi}.` };
    n = raw;
  } else if (typeof raw === 'string') {
    const s = raw.trim();
    if (!DECIMAL_RE.test(s)) return { ok: false, message: `${label} must be a number between ${lo} and ${hi}.` };
    n = Number(s);
    if (!Number.isFinite(n)) return { ok: false, message: `${label} must be a number between ${lo} and ${hi}.` };
  } else {
    return { ok: false, message: `${label} must be a number between ${lo} and ${hi}.` };
  }
  if (n < lo || n > hi) {
    return { ok: false, message: `${label} must be between ${lo} and ${hi}.` };
  }
  return { ok: true, value: n };
}

// Strict calendar date in YYYY-MM-DD form (and a real date). Mirrors the logs
// admin date guard.
function validateYmdDate(raw, label) {
  if (typeof raw !== 'string') return { ok: false, message: `${label} must be a valid date (YYYY-MM-DD).` };
  const s = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { ok: false, message: `${label} must be a valid date (YYYY-MM-DD).` };
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  if (m < 1 || m > 12 || d < 1 || d > 31) return { ok: false, message: `${label} must be a valid date (YYYY-MM-DD).` };
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return { ok: false, message: `${label} must be a valid date (YYYY-MM-DD).` };
  }
  return { ok: true, value: s };
}

// Strict 24-hour wall-clock time in zero-padded HH:MM form (Milestone 11 room
// scheduling contract): 00:00–23:59, no seconds, no AM/PM, string input only.
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
function validateHhMmTime(raw, label) {
  if (typeof raw !== 'string') {
    return { ok: false, message: `${label} must be a valid time (HH:MM).` };
  }
  const s = raw.trim();
  if (!HHMM_RE.test(s)) {
    return { ok: false, message: `${label} must be a valid time (HH:MM).` };
  }
  return { ok: true, value: s };
}

// Same-day time range: both bounds strict HH:MM, and the end strictly after
// the start (inverted AND zero-length ranges are rejected). Returns
// { ok, value: { start, end } } with canonical HH:MM strings.
function validateTimeRange(startRaw, endRaw) {
  const start = validateHhMmTime(startRaw, 'Start time');
  if (!start.ok) return start;
  const end = validateHhMmTime(endRaw, 'End time');
  if (!end.ok) return end;
  const toMinutes = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  if (toMinutes(end.value) <= toMinutes(start.value)) {
    return { ok: false, message: 'End time must be after start time on the same day.' };
  }
  return { ok: true, value: { start: start.value, end: end.value } };
}

// Bounded structured `details` JSON for buildings. Accepts null / blank string
// / a plain object (or a JSON string that parses to a plain object). Rejects
// arrays, scalars, and unbounded structures. Returns a canonical JSON string
// (matching the existing TEXT/jsonb storage) or null. Bounds guard against an
// oversized/deeply-nested payload reaching the database.
const DETAILS_MAX_SERIALIZED = 10000; // characters of canonical JSON
const DETAILS_MAX_DEPTH = 8;
const DETAILS_MAX_NODES = 500;
const DETAILS_MAX_KEY_LEN = 100;
const DETAILS_MAX_STRING_LEN = 5000;
function validateDetails(raw) {
  if (raw === undefined || raw === null) return { ok: true, value: null };

  let parsed;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') return { ok: true, value: null };
    try { parsed = JSON.parse(trimmed); }
    catch (e) { return { ok: false, message: 'Details must be valid JSON.' }; }
  } else if (typeof raw === 'object') {
    parsed = raw;
  } else {
    return { ok: false, message: 'Details must be a JSON object or blank.' };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, message: 'Details must be a JSON object (not an array, string, number, or boolean).' };
  }

  let nodes = 0;
  function walk(node, depth) {
    if (depth > DETAILS_MAX_DEPTH) return 'Details JSON is nested too deeply.';
    if (++nodes > DETAILS_MAX_NODES) return 'Details JSON has too many fields.';
    if (typeof node === 'string') {
      if (node.length > DETAILS_MAX_STRING_LEN) return 'A details value is too long.';
      return null;
    }
    if (node === null || typeof node === 'number' || typeof node === 'boolean') return null;
    if (Array.isArray(node)) {
      for (const item of node) { const err = walk(item, depth + 1); if (err) return err; }
      return null;
    }
    if (typeof node === 'object') {
      for (const key of Object.keys(node)) {
        if (key.length > DETAILS_MAX_KEY_LEN) return 'A details field name is too long.';
        const err = walk(node[key], depth + 1);
        if (err) return err;
      }
      return null;
    }
    return 'Details contains an unsupported value.';
  }
  const walkErr = walk(parsed, 1);
  if (walkErr) return { ok: false, message: walkErr };

  const serialized = JSON.stringify(parsed);
  if (serialized.length > DETAILS_MAX_SERIALIZED) {
    return { ok: false, message: 'Details JSON is too large.' };
  }
  return { ok: true, value: serialized };
}

module.exports = {
  parseRouteId,
  isPlainObject,
  validateBody,
  requiredString,
  optionalString,
  allowedValue,
  validateEmail,
  validatePassword,
  validateNumberInRange,
  validateYmdDate,
  validateHhMmTime,
  validateTimeRange,
  validateDetails
};
