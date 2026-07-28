/* ========================================
   CampuSphere — CSRF Protection (Milestone 8, Section 8.2)

   Session-backed synchronizer-token CSRF using Node's built-in `crypto`
   only — no external CSRF package.

   Design
   ------
   - A single random token per session is generated lazily and stored ONLY in
     `req.session.csrfToken`. It is never written to localStorage,
     sessionStorage, IndexedDB, CacheStorage, audit rows, server logs, or query
     strings.
   - `attachCsrfToken` runs globally (after express-session, before routes) and
     exposes the token to EJS via `res.locals.csrfToken` so rendered pages can
     embed it in a hidden `_csrf` form field and/or a <meta name="csrf-token">
     tag for fetch clients.
   - `verifyCsrf` guards individual unsafe (state-changing) routes. It is NOT
     mounted globally before auth/role middleware, so anonymous `/admin/api/*`
     calls still get 401 JSON and non-admin calls still get 403 role-denial
     JSON before any CSRF check runs.

   Accepted token locations on unsafe requests:
     - hidden form field `_csrf`
     - request header `X-CSRF-Token`

   Failure responses (fixed + sanitized; token values never logged):
     - JSON/API callers : HTTP 403 { success:false, message:'Invalid request token.' }
     - browser callers  : HTTP 403 error.ejs with a generic message
   ======================================== */

const crypto = require('crypto');
// Reuse the single content-negotiation helper so API vs browser detection is
// identical to the auth/error middleware. roleAuth does not require this
// module, so there is no import cycle.
const { wantsJson } = require('./roleAuth');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Constant-time string comparison. Returns false on any type/length mismatch
 * instead of throwing, so a malformed submitted token can never crash the
 * request or leak timing about the expected length beyond equal-length pairs.
 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length === 0 || b.length === 0) {
    return false;
  }
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(ab, bb);
  } catch (e) {
    return false;
  }
}

/**
 * Return the session's CSRF token, minting one when it is absent or unusable.
 *
 * This is the single token-issuance primitive. `attachCsrfToken` uses it for
 * lazy per-request issuance, and `establishAuthenticatedSession` uses it to
 * mint the regenerated session's token BEFORE that session is explicitly
 * saved — so an authenticated session is persisted already carrying its token
 * instead of acquiring one lazily on the first authenticated page render.
 * Without that, the first rendered page dirties the session asynchronously and
 * an immediately submitted form (e.g. the admin HTML logout) can be validated
 * against a stored session that does not yet contain the rendered token.
 *
 * Contract:
 *   - an existing NONEMPTY STRING token is returned unchanged (idempotent);
 *   - a missing, empty, or malformed (non-string) stored value is REPLACED
 *     with a freshly generated cryptographically random token;
 *   - a missing / non-object / array session returns '' and mints nothing.
 *
 * The token value is never logged, returned to a caller other than the request
 * that owns the session, or persisted outside `req.session`.
 *
 * @param {object} session an express-session-like object
 * @returns {string} the session's token, or '' when there is no usable session
 */
function ensureCsrfToken(session) {
  if (!session || typeof session !== 'object' || Array.isArray(session)) return '';
  const current = session.csrfToken;
  if (typeof current === 'string' && current.length > 0) return current;
  const token = generateToken();
  session.csrfToken = token;
  return token;
}

/**
 * Read the submitted token from the header first, then the parsed body. Body
 * parsing (`express.urlencoded` / `express.json`) runs before routes, so
 * `req.body._csrf` is available for form posts by the time verifyCsrf runs.
 */
function readSubmittedToken(req) {
  const header = req.get('X-CSRF-Token');
  if (typeof header === 'string' && header.length > 0) return header;
  if (req.body && typeof req.body._csrf === 'string' && req.body._csrf.length > 0) {
    return req.body._csrf;
  }
  return '';
}

/**
 * Global middleware: expose a CSRF token to views via res.locals.csrfToken, and
 * lazily persist one in the session ONLY when the request legitimately needs it.
 *
 * L3: express-session uses saveUninitialized:false, so an untouched anonymous
 * session is neither stored nor Set-Cookie'd. Minting req.session.csrfToken on
 * EVERY request would dirty otherwise-anonymous safe requests and force a
 * persisted session row + cookie for public/rendered/redirected dynamic routes.
 * A token is therefore issued (and the session thereby persisted) only when:
 *   - the session already carries a token — expose it unchanged; OR
 *   - the session is authenticated (req.session.user) — its pages/APIs may need
 *     a mutation token; OR
 *   - this is a SAFE request for the combined sign-in/register page (/auth); OR
 *   - this is a SAFE request for the OAuth completion page
 *     (/auth/complete-registration) with a real pending registration.
 * Every other request gets res.locals.csrfToken = '' and does NOT touch the
 * session. A token is never minted here on an UNSAFE request just because
 * verifyCsrf will run: an unsafe request whose session has no previously issued
 * token still fails 403 (verifyCsrf requires a stored token to match).
 * Mount AFTER express-session and BEFORE the route handlers.
 */
function attachCsrfToken(req, res, next) {
  if (!req.session) {
    res.locals.csrfToken = '';
    return next();
  }

  // Already issued -> expose without changing (covers authenticated sessions —
  // including the token minted at session establishment — and any session that
  // received a token on an earlier request).
  const existing = req.session.csrfToken;
  if (typeof existing === 'string' && existing.length > 0) {
    res.locals.csrfToken = existing;
    return next();
  }

  const isSafe = SAFE_METHODS.has(req.method);
  const needsToken =
    !!req.session.user ||
    (isSafe && req.path === '/auth') ||
    (isSafe && req.path === '/auth/complete-registration' && !!req.session.pendingOAuthRegistration);

  // Issuance policy is UNCHANGED — ensureCsrfToken is only reached when the
  // existing needsToken policy already permits creating one, so an anonymous
  // unrelated request still never dirties its session (L3), and an unsafe
  // request still cannot mint a missing token just because verifyCsrf will run.
  res.locals.csrfToken = needsToken ? ensureCsrfToken(req.session) : '';
  next();
}

/**
 * Reject a request whose CSRF token is missing/invalid. Fixed, sanitized
 * responses; the token value is never included in the response or any log line.
 */
function rejectCsrf(req, res) {
  if (wantsJson(req)) {
    return res.status(403).json({ success: false, message: 'Invalid request token.' });
  }
  return res.status(403).render('error', {
    title: '403 — Invalid Request',
    statusCode: 403,
    message: 'Invalid request token. Please refresh and try again.',
  });
}

/**
 * Per-route middleware: validate the synchronizer token on unsafe methods.
 * Safe methods (GET/HEAD/OPTIONS) pass through untouched so this can be mounted
 * on a router (e.g. the whole /admin namespace) without affecting page reads.
 */
function verifyCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const expected = req.session && req.session.csrfToken;
  const submitted = readSubmittedToken(req);
  if (expected && safeEqual(expected, submitted)) {
    return next();
  }
  return rejectCsrf(req, res);
}

module.exports = { attachCsrfToken, verifyCsrf, ensureCsrfToken };
