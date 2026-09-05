/* ========================================
   CampuSphere — Rate Limiting (Milestone 8, Section 8.3; M12.P1-R4)

   Fixed-window limiter. Scopes, limits, windows, and the 429/Retry-After
   contract are owned here; WHERE the counter lives is owned by
   services/rateLimitStore.js.

   Design
   ------
   - Fixed-window counters: bucket -> count, with the window's expiry
     established on the first hit of that window. On Vercel the counter is a
     SHARED Upstash Redis key incremented by one atomic server-side script; in
     local development it is the original in-memory Map. The middleware code
     path is identical for both — only the injected store differs.
   - All bucket identifiers are opaque digests of request metadata only (IP for
     the pre-body IP buckets; normalized-email/user-id + IP for account/identity
     buckets), HMAC-keyed by RATE_LIMIT_KEY_SECRET wherever that secret is
     configured (always, on Vercel). Raw IPs, emails, user IDs, and secrets are
     NEVER present in a bucket key, a stored value, a log, or a response.
   - Fixed, sanitized 429 responses with an integer Retry-After (seconds, >= 1).
     No IP, email, session id, token, route internal, DB error, or stack.
   - Fixed, sanitized 503 when SHARED storage is unusable (Vercel only). It
     never falls back to a process-local Map, and it never calls next().

   Buckets (defaults; each overridable via env for testability):
     - auth form preflight   : 20 / 15 min  per IP            (pre-body)
     - login account         :  8 / 15 min  per hash(email+IP)
     - OAuth start/callback   : 20 / 10 min  per IP            (pre-body)
     - profile update        : 20 / 10 min  per hash(user+IP)
     - admin mutations        : 80 /  5 min  per hash(admin+IP)
     - presence heartbeat     : 30 /  5 min  per hash(user id)
   ======================================== */

// Reuse the single content-negotiation helper for API vs browser detection.
const { wantsJson } = require('./roleAuth');
const {
  createRateLimitRuntime,
  RateLimitStoreError,
  RATE_LIMIT_UNAVAILABLE_BODY,
} = require('../services/rateLimitStore');

const MIN = 60 * 1000;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function intFromEnv(name, def) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || String(raw).trim() === '') return def;
  const n = parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

// Limits + windows (env-overridable). Defaults are deliberately generous so the
// seeded defense/demo flow stays usable.
const CFG = {
  authPreflight: {
    max: intFromEnv('RATE_LIMIT_AUTH_MAX', 20),
    windowMs: intFromEnv('RATE_LIMIT_AUTH_WINDOW_MS', 15 * MIN),
  },
  loginAccount: {
    max: intFromEnv('RATE_LIMIT_LOGIN_ACCOUNT_MAX', 8),
    windowMs: intFromEnv('RATE_LIMIT_LOGIN_ACCOUNT_WINDOW_MS', 15 * MIN),
  },
  oauth: {
    max: intFromEnv('RATE_LIMIT_OAUTH_MAX', 20),
    windowMs: intFromEnv('RATE_LIMIT_OAUTH_WINDOW_MS', 10 * MIN),
  },
  profile: {
    max: intFromEnv('RATE_LIMIT_PROFILE_MAX', 20),
    windowMs: intFromEnv('RATE_LIMIT_PROFILE_WINDOW_MS', 10 * MIN),
  },
  adminMutation: {
    max: intFromEnv('RATE_LIMIT_ADMIN_MUTATION_MAX', 80),
    windowMs: intFromEnv('RATE_LIMIT_ADMIN_MUTATION_WINDOW_MS', 5 * MIN),
  },
  presence: {
    // A visible tab sends at most five heartbeats per five-minute presence
    // window. The extra allowance covers page restores and multiple visible
    // windows without permitting an unbounded write/read flood.
    max: intFromEnv('RATE_LIMIT_PRESENCE_MAX', 30),
    windowMs: intFromEnv('RATE_LIMIT_PRESENCE_WINDOW_MS', 5 * MIN),
  },
};

/* THE storage runtime for this process. Created lazily on the first limited
   request (never at import time, and never per request) so that requiring this
   module has no side effect and a non-Vercel process never loads the Upstash
   dependency. One runtime => one Upstash client for the module lifetime. */
let runtime = null;
function getRuntime() {
  if (runtime === null) runtime = createRateLimitRuntime();
  return runtime;
}

function ipOf(req) {
  return (req.ip || (req.socket && req.socket.remoteAddress) || 'unknown');
}

/**
 * Build a fixed-window limiter middleware.
 *
 * `keyFn(req)` returns the SENSITIVE identity components for the bucket, or
 * null to skip limiting for that request (e.g. safe methods). The components
 * are hashed inside the storage boundary and never stored or logged.
 *
 * `runtime` is a TEST-ONLY injection seam. Production limiters omit it and
 * resolve the process runtime lazily, so there is no mutable global a request
 * could ever swap.
 */
function fixedWindow({ windowMs, max, scope, keyFn, runtime: injectedRuntime }) {
  const resolveRuntime = injectedRuntime ? () => injectedRuntime : getRuntime;
  return function rateLimitMiddleware(req, res, next) {
    const components = keyFn(req);
    if (components == null) return next();

    /* TWO SEPARATE handlers, deliberately (same reasoning as the R3 readiness
       gate): `then(onCounted, onStoreFailure)` routes ONLY a rejection of
       consume() to the failure path. An exception thrown by downstream
       middleware inside next() is Express's to handle and can never be
       misreported as a rate-limit 503 — a .then(...).catch(...) chain would
       wrongly convert it into one. */
    resolveRuntime().consume(scope, components, windowMs).then(
      function onCounted(result) {
        /* Validate BOTH fields before trusting either. A non-finite resetMs
           would otherwise serialize as `Retry-After: NaN`, breaking the
           integer-seconds contract; an unusable counter fails closed instead. */
        if (!result || !Number.isFinite(result.count) || !Number.isFinite(result.resetMs)) {
          return sendUnavailable(res);
        }
        if (result.count > max) {
          const retryAfter = Math.max(1, Math.ceil(result.resetMs / 1000));
          res.set('Retry-After', String(retryAfter));
          return reject429(req, res);
        }
        return next();
      },
      function onStoreFailure() {
        return sendUnavailable(res);
      }
    ).then(undefined, function guard() {
      /* Terminal no-op guard. It observes a throw from onCounted/onStoreFailure
         ONLY (a rejection of the derived promise), so an unhandled rejection
         cannot crash the process. It deliberately sends NOTHING: it must not
         turn a downstream failure into a rate-limit response. */
    });
  };
}

/* Fixed sanitized SHARED-STORAGE-UNAVAILABLE refusal (M12.P1-R4). Reached only
   when the Vercel shared store is unreachable, rejects the command, or returns
   a malformed reply. No URL, token, secret, HMAC input, key, command, reply,
   stack, or exception message is exposed, and nothing is logged — an outage
   must not produce unbounded per-request log volume. */
function sendUnavailable(res) {
  if (res.headersSent) return;
  res.status(503);
  res.set('Cache-Control', 'no-store');
  res.type('application/json');
  res.send(RATE_LIMIT_UNAVAILABLE_BODY);
}

function reject429(req, res) {
  if (wantsJson(req)) {
    return res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' });
  }
  // The pre-body limiter runs before the res.locals.user middleware, so ensure
  // `user` is always defined for shared partials in error.ejs (defensive: the
  // current head/error/theme-toggle partials do not reference it).
  if (res.locals.user === undefined) res.locals.user = null;
  return res.status(429).render('error', {
    title: '429 — Too Many Requests',
    statusCode: 429,
    message: 'Too many requests. Please try again later.',
  });
}

/* ---------- IP-keyed limiters used by the pre-body dispatcher ---------- */
const preAuthLimiter = fixedWindow({ ...CFG.authPreflight, scope: 'auth', keyFn: (req) => [ipOf(req)] });
const preOauthLimiter = fixedWindow({ ...CFG.oauth, scope: 'oauth', keyFn: (req) => [ipOf(req)] });
const preProfileLimiter = fixedWindow({ ...CFG.profile, scope: 'profileip', keyFn: (req) => [ipOf(req)] });
const preAdminLimiter = fixedWindow({ ...CFG.adminMutation, scope: 'adminip', keyFn: (req) => [ipOf(req)] });

// Classify a request (by method + normalized path, query stripped) into a
// sensitive category, or null. req.path excludes the query string, so
// `?x=1`/path-variant tricks cannot spawn a fresh bucket.
function classifyPreParse(req) {
  const m = req.method;
  const p = req.path || '';
  if (m === 'GET' && (p === '/auth/google' || p === '/auth/callback')) return preOauthLimiter;
  if (m === 'POST' && (p === '/login' || p === '/register' || p === '/auth/complete-registration' || p === '/logout')) return preAuthLimiter;
  if (m === 'POST' && p === '/api/update-profile') return preProfileLimiter;
  if ((p === '/admin/api' || p.indexOf('/admin/api/') === 0) && !SAFE_METHODS.has(m)) return preAdminLimiter;
  return null;
}

/**
 * Pre-body-parser limiter. Mounted FIRST in server.js (before express.json /
 * urlencoded) so malformed-body/JSON abuse on sensitive endpoints is counted
 * before the parser can throw. IP-keyed only (no body/session available yet).
 */
function preParseAuthLimiter(req, res, next) {
  const limiter = classifyPreParse(req);
  if (!limiter) return next();
  return limiter(req, res, next);
}

/* ---------- identity-aware route-level limiters ---------- */

// POST /login — per (hashed normalized email + IP). Runs after body parse + CSRF.
// Falls back to an IP-only-derived key when no email was submitted, so blank
// floods are still bounded without ever storing the raw value.
const loginAccountLimiter = fixedWindow({
  ...CFG.loginAccount,
  scope: 'login',
  keyFn: (req) => {
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    return [email, ipOf(req)];
  },
});

// Profile mutations (/api/update-profile) — per
// (hashed user id + IP). Runs after requireLogin + CSRF.
const profileUpdateLimiter = fixedWindow({
  ...CFG.profile,
  scope: 'profile',
  keyFn: (req) => {
    const uid = (req.session && req.session.user && req.session.user.id) || 'anon';
    return [String(uid), ipOf(req)];
  },
});

// Unsafe /admin/api/* — per (hashed admin id + IP). Mounted on the admin router
// after requireRole + CSRF; a no-op for safe (GET/HEAD/OPTIONS) admin reads.
const adminMutationLimiter = fixedWindow({
  ...CFG.adminMutation,
  scope: 'adminmut',
  keyFn: (req) => {
    if (SAFE_METHODS.has(req.method)) return null;
    const uid = (req.session && req.session.user && req.session.user.id) || 'anon';
    return [String(uid), ipOf(req)];
  },
});

// POST /api/presence/heartbeat — per hashed authenticated user id. This is
// separate from profile/admin mutation budgets because it is expected recurring
// traffic, while the database function independently throttles the actual
// timestamp write to once per 60 seconds. Keeping the key user-only prevents a
// client from bypassing the dedicated budget by changing source IPs.
const presenceHeartbeatLimiter = fixedWindow({
  ...CFG.presence,
  scope: 'presence',
  keyFn: (req) => {
    const uid = (req.session && req.session.user && req.session.user.id) || 'anon';
    return [String(uid)];
  },
});

module.exports = {
  preParseAuthLimiter,
  loginAccountLimiter,
  profileUpdateLimiter,
  adminMutationLimiter,
  presenceHeartbeatLimiter,
  // exported for visibility/testing only
  _config: CFG,
  _fixedWindow: fixedWindow,
  _classifyPreParse: classifyPreParse,
  _RateLimitStoreError: RateLimitStoreError,
};
