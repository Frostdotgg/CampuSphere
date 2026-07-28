'use strict';
/* ========================================
   CampuSphere — Session runtime configuration (Milestone 8, Section 8.4;
   Milestone 9, Section 9.4 added the Supabase store and made Supabase the
   preferred/default persistent store in production, with MySQL as fallback)

   Resolves and VALIDATES the express-session runtime policy (store kind,
   secret(s) + rotation, cookie attributes, proxy trust) from the environment,
   and fails CLOSED in production for any missing/unsafe value.

   No secret, cookie value, or session id is ever logged from here; validation
   errors carry fixed, sanitized messages (the offending value is never echoed).
   ======================================== */

const DAY_MS = 24 * 60 * 60 * 1000;
const DEV_FALLBACK_SECRET = 'campusphere_fallback_secret';
const PLACEHOLDER_SECRETS = new Set([
  'campusphere_fallback_secret',
  'change_this_to_a_long_random_string',
]);
const MIN_PROD_SECRET_LEN = 32;

const PROD_COOKIE_NAME = '__Host-campusphere.sid';
const DEV_COOKIE_NAME = 'campusphere.sid';

class SessionConfigError extends Error {}

function isProd(env) {
  return env.NODE_ENV === 'production';
}

function parseSecretList(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Cookie NAME only — cheap, no validation/exit. Used by controllers that must
 * clear the session cookie with the exact configured name.
 */
function sessionCookieName(env = process.env) {
  return isProd(env) ? PROD_COOKIE_NAME : DEV_COOKIE_NAME;
}

/**
 * Best-effort clear of the active session cookie using the configured name and
 * matching attributes (so the browser actually drops it, including the
 * production __Host- prefixed cookie). Never throws.
 */
function clearSessionCookie(res, env = process.env) {
  try {
    res.clearCookie(sessionCookieName(env), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd(env),
    });
  } catch (e) { /* headers already sent, etc. — best effort */ }
}

/**
 * Resolve the full session runtime config. Throws SessionConfigError on any
 * fatal production misconfiguration; collects non-fatal `warnings` otherwise.
 * @returns {{ isProduction, storeKind, secrets, cookieName, cookie, trustProxy, warnings }}
 */
function resolveSessionConfig(env = process.env) {
  const production = isProd(env);
  const warnings = [];

  /* ---- store kind ---- */
  // Milestone 9: production prefers the Supabase persistent store and an empty
  // SESSION_STORE resolves to it; MySQL remains an explicit fallback; memory is
  // rejected in production. Non-production defaults to memory and also accepts
  // mysql/supabase for local rehearsal.
  const rawStore = String(env.SESSION_STORE || '').trim().toLowerCase();
  let storeKind;
  if (production) {
    if (rawStore === '' || rawStore === 'supabase') {
      storeKind = 'supabase';
    } else if (rawStore === 'mysql') {
      storeKind = 'mysql';
    } else if (rawStore === 'memory') {
      throw new SessionConfigError('SESSION_STORE=memory is not allowed in production; a persistent store is required (use "supabase" or "mysql").');
    } else {
      throw new SessionConfigError('SESSION_STORE has an invalid value in production (use "supabase" or "mysql").');
    }
  } else {
    if (rawStore === '') {
      storeKind = 'memory';
    } else if (rawStore === 'mysql' || rawStore === 'memory' || rawStore === 'supabase') {
      storeKind = rawStore;
    } else {
      warnings.push('SESSION_STORE has an invalid value; falling back to the in-memory store (non-production only).');
      storeKind = 'memory';
    }
  }

  /* ---- secret(s) + rotation ---- */
  const current = env.SESSION_SECRET;
  const previous = parseSecretList(env.SESSION_SECRET_PREVIOUS);
  let secrets;
  if (production) {
    const c = (current || '').trim();
    if (!c) {
      throw new SessionConfigError('SESSION_SECRET is required in production.');
    }
    if (PLACEHOLDER_SECRETS.has(c)) {
      throw new SessionConfigError('SESSION_SECRET must not be a known placeholder value in production.');
    }
    if (c.length < MIN_PROD_SECRET_LEN) {
      throw new SessionConfigError('SESSION_SECRET must be at least ' + MIN_PROD_SECRET_LEN + ' characters in production.');
    }
    // Rotated-out secrets still sign-verify cookies, so they must meet the same
    // production bar. Validate each (already trimmed + non-empty) value; never
    // echo the offending value.
    for (const prev of previous) {
      if (PLACEHOLDER_SECRETS.has(prev)) {
        throw new SessionConfigError('SESSION_SECRET_PREVIOUS must not contain a known placeholder value in production.');
      }
      if (prev.length < MIN_PROD_SECRET_LEN) {
        throw new SessionConfigError('Each SESSION_SECRET_PREVIOUS value must be at least ' + MIN_PROD_SECRET_LEN + ' characters in production.');
      }
    }
    secrets = [current, ...previous];
  } else if (current && current.trim() !== '') {
    secrets = [current, ...previous];
  } else {
    warnings.push('SESSION_SECRET not set; using the insecure dev fallback (non-production only). Set SESSION_SECRET before deploying.');
    secrets = [DEV_FALLBACK_SECRET, ...previous];
  }

  /* ---- cookie policy ---- */
  let maxAge = DAY_MS;
  const rawMaxAge = env.SESSION_COOKIE_MAX_AGE_MS;
  if (rawMaxAge !== undefined && String(rawMaxAge).trim() !== '') {
    const n = parseInt(String(rawMaxAge).trim(), 10);
    if (Number.isFinite(n) && n > 0) {
      maxAge = n;
    } else {
      const msg = 'SESSION_COOKIE_MAX_AGE_MS must be a positive integer.';
      if (production) throw new SessionConfigError(msg);
      warnings.push(msg + ' Using the default (non-production).');
    }
  }
  const cookieName = sessionCookieName(env);
  const cookie = {
    httpOnly: true,
    sameSite: 'lax',
    secure: production, // __Host- prefix (prod) requires Secure + Path=/ + no Domain
    path: '/',
    maxAge,
    // intentionally NO `domain` (required for the __Host- cookie prefix)
  };

  /* ---- proxy policy ---- */
  let trustProxy = production ? 1 : 0;
  const rawTp = env.TRUST_PROXY;
  if (rawTp !== undefined && String(rawTp).trim() !== '') {
    const s = String(rawTp).trim();
    if (/^\d+$/.test(s)) {
      trustProxy = parseInt(s, 10);
    } else {
      const msg = 'TRUST_PROXY must be a non-negative integer.';
      if (production) throw new SessionConfigError(msg);
      warnings.push(msg + ' Ignoring (non-production).');
    }
  }

  return { isProduction: production, storeKind, secrets, cookieName, cookie, trustProxy, warnings };
}

module.exports = {
  resolveSessionConfig,
  sessionCookieName,
  clearSessionCookie,
  SessionConfigError,
};
