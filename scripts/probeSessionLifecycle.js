'use strict';

/* ========================================
   CampuSphere — shared probe session lifecycle (TEST TOOLING ONLY)

   Every probe that authenticates a canonical regression identity must OWN that
   session: `npm test` previously left unexpired persisted `app_sessions` rows
   for the canonical admin and student because most spawned probes logged in
   and never logged out, which dropped the read-only credential/session-safety
   probe to 22/24.

   This module is the single supported termination path. It:
     - only ever uses the real application interfaces (GET /auth/csrf-token and
       CSRF-protected POST /logout);
     - never calls services/sessionRevocation.js, never touches app_sessions,
       never deletes a user to invalidate a session, and never retries a failed
       logout mutation to manufacture success;
     - records every outcome through the caller's recorder so a failure is a
       visible test failure rather than a silent leak.

   Privacy: no credential, cookie value, token, session id, identifier, raw
   response body, or backend error is printed or returned. Token/cookie values
   exist only in memory for the duration of a call.

   TEST TOOLING ONLY — never required by server runtime code, an EJS view, or
   anything under public/.
   ======================================== */

// Mirrors config/sessionConfig.js (dev vs production cookie name).
const SESSION_COOKIE_NAMES = ['campusphere.sid', '__Host-campusphere.sid'];
const LOGOUT_REDIRECT = '/auth?logged_out=1';
// Bounded safe-GET repetition. Two consecutive equal reads confirm the token is
// durably persisted; six is the hard ceiling. This is NOT a mutation retry.
const MAX_TOKEN_READS = 6;

function parseJson(text) {
  try { return JSON.parse(text); } catch (e) { return null; }
}

function setCookieList(res) {
  return res.headers.getSetCookie
    ? res.headers.getSetCookie()
    : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
}

/**
 * True when the response carries an EXPIRING Set-Cookie for the configured
 * session cookie — the clearing signature res.clearCookie emits. The cookie
 * VALUE is never read, returned, or logged.
 */
function hasClearingSessionCookie(res) {
  return setCookieList(res).some((c) => {
    const name = c.split('=')[0].trim();
    if (!SESSION_COOKIE_NAMES.includes(name)) return false;
    return /expires=thu, 01 jan 1970/i.test(c) || /max-age=0/i.test(c);
  });
}

/**
 * Read the authenticated session's CSRF token until two CONSECUTIVE reads
 * agree, proving the value is durably persisted rather than a token the store
 * has not finished writing.
 *
 * Safe-GET repetition only — no sleep, no mutation, no retry of a failed write.
 * With the establishAuthenticatedSession correction (the token is minted before
 * the authenticated session is saved) the first two reads normally agree
 * immediately.
 *
 * @returns {Promise<string>} the stable token, or '' when the endpoint did not
 *   satisfy its exact success contract or no two consecutive reads agreed.
 */
async function getStableCsrfToken({ base, jar, maxReads = MAX_TOKEN_READS } = {}) {
  if (!base || !jar || typeof jar.header !== 'function') return '';
  const limit = Number.isInteger(maxReads) && maxReads > 0
    ? Math.min(maxReads, MAX_TOKEN_READS)
    : MAX_TOKEN_READS;

  let previous = null;
  for (let i = 0; i < limit; i++) {
    let res;
    try {
      res = await fetch(base + '/auth/csrf-token', {
        headers: { Accept: 'application/json', Cookie: jar.header() },
      });
    } catch (e) {
      return '';
    }
    if (typeof jar.apply === 'function') jar.apply(res); // pick up a rolled cookie
    const parsed = parseJson(await res.text()); // body is never returned/printed

    const valid = res.status === 200 && !!parsed && parsed.success === true &&
      typeof parsed.csrfToken === 'string' && parsed.csrfToken.length > 0 &&
      Object.keys(parsed).sort().join(',') === 'csrfToken,success';
    if (!valid) return '';

    if (previous !== null && parsed.csrfToken === previous) return parsed.csrfToken;
    previous = parsed.csrfToken;
  }
  // Bounded reads exhausted without agreement: fail explicitly rather than
  // returning a token that may not be persisted.
  return '';
}

/**
 * Create a per-server session tracker.
 *
 * Register each authenticated jar immediately after its login succeeds, then
 * call terminateAll() as the OUTERMOST finally action (after any fixture
 * cleanup that still needs the identity). terminateAll() is idempotent per
 * session, so a normal call and a finally-safeguard call cannot double-logout.
 *
 * @param {object} opts
 * @param {string} opts.base   base URL of the probe server
 * @param {function(string, boolean): void} opts.record recorder: (label, pass)
 */
function createProbeSessionTracker({ base, record } = {}) {
  const tracked = [];
  const report = typeof record === 'function' ? record : () => {};

  /**
   * @param {string} label            sanitized identity label (e.g. 'admin')
   * @param {object} jar              cookie jar exposing header()/apply()
   * @param {string} [protectedPath]  route used for the post-logout replay proof
   */
  function register(label, jar, protectedPath) {
    if (!jar || typeof jar.header !== 'function') return;
    tracked.push({
      label: String(label),
      jar,
      protectedPath: protectedPath || '/dashboard',
      attempted: false,
    });
  }

  /**
   * Mark a registered session as already attempted, so terminateAll() will not
   * touch it. This exists for the logout probe, whose SUBJECT is the logout
   * contract: once it has performed its own contract-valid logout — whether
   * that succeeded or failed — the result is evidence and must never be
   * retried. Sessions abandoned before their contract logout was attempted are
   * still owned by terminateAll().
   *
   * @param {object} jar the exact jar object passed to register()
   */
  function markAttempted(jar) {
    for (const entry of tracked) {
      if (entry.jar === jar) entry.attempted = true;
    }
  }

  async function terminateAll() {
    for (const entry of tracked) {
      if (entry.attempted) continue;
      entry.attempted = true; // idempotency: exactly one attempt per session
      const scope = `session cleanup [${entry.label}]`;

      try {
        // Stable token first — it also applies any rolled session cookie to the
        // jar, so the header captured next is the one the logout will present.
        const token = await getStableCsrfToken({ base, jar: entry.jar });
        report(`${scope}: obtained a stable CSRF token`, token.length > 0);
        if (!token) continue;

        const formerCookie = entry.jar.header(); // in memory only

        const lr = await fetch(base + '/logout', {
          method: 'POST',
          redirect: 'manual',
          headers: { Accept: 'application/json', 'X-CSRF-Token': token, Cookie: formerCookie },
        });
        const lo = parseJson(await lr.text());
        report(`${scope}: POST /logout -> 200 fixed {success:true, redirect}`,
          lr.status === 200 && !!lo && lo.success === true &&
          lo.redirect === LOGOUT_REDIRECT &&
          Object.keys(lo).sort().join(',') === 'redirect,success');
        report(`${scope}: logout emitted the clearing session cookie`,
          hasClearingSessionCookie(lr));

        const replay = await fetch(base + entry.protectedPath, {
          redirect: 'manual',
          headers: { Accept: 'text/html', Cookie: formerCookie },
        });
        await replay.text();
        report(`${scope}: replayed former cookie on ${entry.protectedPath} -> denied`,
          replay.status === 302 && /\/auth/.test(replay.headers.get('location') || ''));
      } catch (e) {
        // Fixed sanitized label only — never the raw error, stack, or a value.
        report(`${scope}: completed without an unexpected error`, false);
      }
    }
  }

  return {
    register,
    markAttempted,
    terminateAll,
    count() { return tracked.length; },
  };
}

module.exports = {
  getStableCsrfToken,
  hasClearingSessionCookie,
  createProbeSessionTracker,
  SESSION_COOKIE_NAMES,
  LOGOUT_REDIRECT,
  MAX_TOKEN_READS,
};
