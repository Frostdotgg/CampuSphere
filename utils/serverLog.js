/* ========================================
   CampuSphere — Sanitized Server Logging
   (Milestone 8, Section 8.7 / R11: Centralized Sanitized Error Contracts)

   A single helper for server-side error logging. It prints a FIXED, sanitized
   one-line record and NEVER the Error object, its message, its stack, SQL text,
   request bodies, query strings, headers, cookies, session identifiers, OAuth
   subjects, or any secret. This keeps production/default logs free of sensitive
   data while still giving operators the method + path + call-site scope needed
   to locate a failure.

   Line shape:  [ERROR] <ISO timestamp> <scope> <METHOD> <path>
   `scope` is a short FIXED label supplied by the call site (e.g.
   'map.search', 'admin.users'); it must contain no user/request data.
   ======================================== */

/**
 * Return the request path only — never the query string. OAuth flows carry
 * sensitive values (?code=…&state=…) and search endpoints carry user terms in
 * the query, so we split on the first '?' and drop everything after it. Mirrors
 * middleware/logger.js so logging behaves identically everywhere.
 */
function safePath(req) {
  if (!req) return '-';
  const raw = req.originalUrl || req.url || '';
  return String(raw).split('?')[0] || '-';
}

/**
 * Log an unexpected server-side error in a sanitized, fixed format.
 *
 * The Error object is intentionally NOT a parameter: there is no code path that
 * can accidentally print a stack, message, SQL fragment, or raw DB/Supabase
 * error through this helper. Call sites catch the error, then call this with a
 * fixed scope label and the request.
 *
 * @param {string} scope  short FIXED call-site label (no user/request data)
 * @param {object} [req]  the request, used ONLY for method + sanitized path
 */
function logServerError(scope, req) {
  const ts = new Date().toISOString();
  const method = (req && req.method) || '-';
  const label = typeof scope === 'string' && scope.length > 0 ? scope : 'unknown';
  console.error(`[ERROR] ${ts} ${label} ${method} ${safePath(req)}`);
}

module.exports = { logServerError, safePath };
