'use strict';

/* ========================================
   CampuSphere — fail-closed Vercel production profile (M12.P1-R2)

   PURE configuration preflight. This module deliberately imports NOTHING
   project-local and nothing with side effects — no dotenv, no Supabase or
   MySQL client, no session store, no Express, no middleware, controller, or
   route — so server.js can execute it BEFORE any backend module loads.

   Contract:
     - Outside Vercel (env.VERCEL !== '1') the preflight is a no-op that
       returns false without validating or changing anything; the documented
       MySQL/Leaflet/local-development fallbacks stay untouched.
     - On Vercel (env.VERCEL === '1') the runtime must be EXACTLY the
       Supabase-only production profile below. Anything missing, blank,
       misspelled, or conflicting throws VercelProductionProfileError with
       ONE fixed sanitized message. Vercel can never fall back to MySQL,
       Leaflet, or memory sessions.
     - SUPABASE_URL must be a parseable HTTPS URL with a hostname and no
       embedded URL username/password.
     - SUPABASE_SERVICE_ROLE_KEY must match one of the two official
       SERVER-ONLY Supabase key families, by shape:
         1. an opaque secret key: `sb_secret_` followed by at least 20
            characters from [A-Za-z0-9_-]; or
         2. a legacy three-segment JWT whose base64url-decoded header is
            JSON with alg exactly "HS256" and whose decoded payload is JSON
            with role exactly "service_role".
       Everything else is rejected: generic/one-character strings, short or
       empty `sb_secret_` values, `sb_publishable_`/`sb_anon_` browser keys
       (case-insensitive), documented placeholders, malformed or
       non-three-segment JWTs, invalid base64url or JSON, JWTs whose role is
       anon/authenticated/missing/non-string, and non-HS256 algorithms.
     - Shape-only: JWT decoding here is structural validation. No signature
       verification, no network request, no live key authentication, and no
       logging or serialization of decoded claims. Connectivity/session
       readiness is verified separately.

   M12.P1-R4 additions (shared rate-limit infrastructure). On Vercel the
   process-local rate-limit Map is not a correct enforcement boundary — each
   serverless instance would keep its own counter and multiply the effective
   limit — so the SHARED store's configuration is mandatory here, at startup,
   before anything can serve:
     - UPSTASH_REDIS_REST_URL must be a parseable HTTPS URL with a hostname
       and no embedded URL username/password (same server-only URL contract
       as SUPABASE_URL).
     - UPSTASH_REDIS_REST_TOKEN must be nonblank and must not be a documented
       .env.example placeholder.
     - RATE_LIMIT_KEY_SECRET must be at least 32 characters (after trimming)
       and must not be a documented placeholder. It keys the HMAC that makes
       stored bucket identifiers opaque, so a short or published value would
       make the digests guessable.
   None of the three is required outside Vercel: local development keeps the
   in-memory adapter and needs no shared store or key secret. Validation stays
   PURE — still no network call, no Redis client, and no live credential
   check.

   Privacy: failures never echo the setting name, the supplied value, any
   partial value, URL, key, or stack detail — only the fixed message.
   ======================================== */

// The single fixed sanitized failure message (exported for focused tests).
const VERCEL_PROFILE_ERROR_MESSAGE =
  'The Vercel production profile is invalid or incomplete. ' +
  'See docs/deployment.md and .env.example for the required fail-closed matrix.';

class VercelProductionProfileError extends Error {
  // No constructor arguments: this error can never carry a value.
  constructor() {
    super(VERCEL_PROFILE_ERROR_MESSAGE);
    this.name = 'VercelProductionProfileError';
  }
}

// Exact canonical values required on Vercel. Comparison is strict equality on
// the raw string: a missing, blank, misspelled, differently-cased, padded, or
// conflicting (valid-elsewhere) value all fail identically.
const REQUIRED_EXACT = Object.freeze({
  NODE_ENV: 'production',
  SESSION_STORE: 'supabase',
  AUTH_DATA_SOURCE: 'supabase',
  CONTENT_DATA_SOURCE: 'supabase',
  BUILDING_DATA_SOURCE: 'supabase',
  ROUTE_DATA_SOURCE: 'supabase',
  VR_DATA_SOURCE: 'supabase',
  SCHEDULE_DATA_SOURCE: 'supabase',
  MAP_RENDERER: 'maplibre',
});

// Documented placeholders (from .env.example) and browser/public key
// prefixes. A publishable/anon/browser key must never act as the server
// secret, regardless of casing.
const REJECTED_KEY_VALUES = Object.freeze([
  'replace-with-server-only-service-role-key',
  'replace-with-anon-key',
]);
const REJECTED_KEY_PREFIXES = Object.freeze(['sb_publishable_', 'sb_anon_']);

/* M12.P1-R4: documented .env.example placeholders for the shared rate-limit
   store. A copy-pasted placeholder must never reach the live Vercel profile,
   so each is rejected explicitly (the key secret's placeholder is deliberately
   longer than the 32-character minimum, which is exactly why a length check
   alone is not sufficient). Compared case-insensitively against the trimmed
   value; the value itself is never echoed. */
const REJECTED_UPSTASH_TOKEN_VALUES = Object.freeze([
  'replace-with-upstash-rest-token',
  'replace-with-server-only-upstash-rest-token',
]);
const REJECTED_RATE_LIMIT_SECRET_VALUES = Object.freeze([
  'replace-with-a-long-random-server-only-rate-limit-key-secret',
  'replace-with-rate-limit-key-secret',
]);

// Minimum RATE_LIMIT_KEY_SECRET length (characters, after trimming).
const RATE_LIMIT_KEY_SECRET_MIN_LENGTH = 32;

// Official server-only key families, by shape (see header):
//   1. opaque secret: sb_secret_ + >=20 chars of the opaque charset;
//   2. legacy JWT: three base64url segments, header alg exactly HS256,
//      payload role exactly service_role.
const OPAQUE_SECRET_KEY_RE = /^sb_secret_[A-Za-z0-9_-]{20,}$/;
const BASE64URL_SEGMENT_RE = /^[A-Za-z0-9_-]+$/;

function isNonblankString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Shared server-only endpoint URL contract: a parseable HTTPS URL with a
 * hostname and NO embedded URL username/password (credentials belong in the
 * dedicated server-only token variable, never in the URL). Used for both
 * SUPABASE_URL and the M12.P1-R4 UPSTASH_REDIS_REST_URL.
 */
function isValidServerHttpsUrl(raw) {
  if (!isNonblankString(raw)) return false;
  let parsed;
  try {
    parsed = new URL(raw.trim());
  } catch (_) {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (!parsed.hostname) return false;
  if (parsed.username !== '' || parsed.password !== '') return false;
  return true;
}

/**
 * M12.P1-R4: the shared rate-limit store REST token. Shape-only — nonblank and
 * not a documented placeholder. No live authentication is attempted, and the
 * value is never echoed, logged, or partially reported.
 */
function isAcceptableUpstashToken(raw) {
  if (!isNonblankString(raw)) return false;
  const token = raw.trim();
  if (REJECTED_UPSTASH_TOKEN_VALUES.includes(token.toLowerCase())) return false;
  return true;
}

/**
 * M12.P1-R4: the HMAC key that makes stored rate-limit bucket identifiers
 * opaque. At least RATE_LIMIT_KEY_SECRET_MIN_LENGTH characters after trimming,
 * and never a documented placeholder.
 */
function isAcceptableRateLimitKeySecret(raw) {
  if (!isNonblankString(raw)) return false;
  const secret = raw.trim();
  if (REJECTED_RATE_LIMIT_SECRET_VALUES.includes(secret.toLowerCase())) return false;
  return secret.length >= RATE_LIMIT_KEY_SECRET_MIN_LENGTH;
}

// Strict structural base64url-JSON-object decode. Returns null (never
// throws, never logs) for an empty/invalid-charset segment, undecodable
// bytes, invalid JSON, or a non-object/array JSON value.
function decodeBase64UrlJsonObject(segment) {
  if (typeof segment !== 'string' || !BASE64URL_SEGMENT_RE.test(segment)) return null;
  let text;
  try {
    text = Buffer.from(segment, 'base64url').toString('utf8');
  } catch (_) {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return parsed;
}

// Legacy server key: exactly three base64url segments; decoded header JSON
// with alg EXACTLY 'HS256'; decoded payload JSON with role EXACTLY
// 'service_role' (anon/authenticated/missing/non-string roles all fail).
// Shape-only: no signature verification and no claim is retained or logged.
function isLegacyServiceRoleJwt(key) {
  const segments = key.split('.');
  if (segments.length !== 3) return false;
  if (!BASE64URL_SEGMENT_RE.test(segments[2])) return false;
  const header = decodeBase64UrlJsonObject(segments[0]);
  if (!header || header.alg !== 'HS256') return false;
  const payload = decodeBase64UrlJsonObject(segments[1]);
  if (!payload || payload.role !== 'service_role') return false;
  return true;
}

function isAcceptableServiceKey(raw) {
  if (!isNonblankString(raw)) return false;
  const key = raw.trim();
  const lower = key.toLowerCase();
  if (REJECTED_KEY_VALUES.includes(lower)) return false;
  if (REJECTED_KEY_PREFIXES.some((prefix) => lower.startsWith(prefix))) return false;
  // Positive shape requirement: exactly the two official server-only key
  // families. Anything else — including generic or one-character strings —
  // is rejected. No live authentication is attempted in this preflight.
  return OPAQUE_SECRET_KEY_RE.test(key) || isLegacyServiceRoleJwt(key);
}

/**
 * Fail-closed Vercel production-profile preflight.
 *
 * @param {object} [env=process.env] environment to validate (read-only).
 * @returns {boolean} false outside Vercel (no validation performed);
 *   true when VERCEL=1 and the complete profile is valid.
 * @throws {VercelProductionProfileError} one fixed sanitized error for every
 *   invalid Vercel case; the message never identifies the offending setting.
 */
function assertVercelProductionProfile(env = process.env) {
  const source = (env && typeof env === 'object') ? env : {};

  // Not on Vercel: change nothing, validate nothing.
  if (source.VERCEL !== '1') return false;

  for (const [name, expected] of Object.entries(REQUIRED_EXACT)) {
    if (source[name] !== expected) throw new VercelProductionProfileError();
  }
  if (!isValidServerHttpsUrl(source.SUPABASE_URL)) {
    throw new VercelProductionProfileError();
  }
  if (!isAcceptableServiceKey(source.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new VercelProductionProfileError();
  }
  /* M12.P1-R4 shared rate-limit store. Same single fixed sanitized failure as
     every other case above: which of the three is wrong is never disclosed. */
  if (!isValidServerHttpsUrl(source.UPSTASH_REDIS_REST_URL)) {
    throw new VercelProductionProfileError();
  }
  if (!isAcceptableUpstashToken(source.UPSTASH_REDIS_REST_TOKEN)) {
    throw new VercelProductionProfileError();
  }
  if (!isAcceptableRateLimitKeySecret(source.RATE_LIMIT_KEY_SECRET)) {
    throw new VercelProductionProfileError();
  }
  return true;
}

module.exports = {
  assertVercelProductionProfile,
  VercelProductionProfileError,
  VERCEL_PROFILE_ERROR_MESSAGE,
  RATE_LIMIT_KEY_SECRET_MIN_LENGTH,
};
