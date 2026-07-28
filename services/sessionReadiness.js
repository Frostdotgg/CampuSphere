'use strict';
/* ========================================
   CampuSphere — Session readiness coordinator (M12.P1-R3)

   ONE single-flight readiness attempt shared by local startup and every
   request. It exists because `server.js` exports the Express app
   (`module.exports = app`): on Vercel the platform imports that app and
   routes requests into it immediately, with no `app.listen()` and therefore
   no place to `await` the session-store bootstrap. Without this gate an
   imported app can reach `express-session` — and the application routes
   behind it — while the Supabase session store is still initializing.

   Contract:
     - Exactly ONE initialization attempt per coordinator. The attempt is
       started EAGERLY at construction inside `Promise.resolve().then(...)`,
       so a synchronous throw from `init()` and a rejected promise from
       `init()` share the identical failure path.
     - A store without `init()` (and the development-only memory store, where
       there is no store object at all) resolves successfully.
     - The SAME promise instance backs `whenReady()` and the request gate, so
       concurrent first requests can never trigger a second `init()`, a second
       store, a second cleanup timer, or a second listener.
     - There is NO retry, NO timeout, and NO fallback store. Once the attempt
       rejects, this coordinator stays failed for the life of the process;
       recovery is a deploy/restart concern, not a per-request one.
     - Rejection is observed at construction so an exported (Vercel) app can
       never emit an unhandled-rejection warning before its first request.

   Request gate behaviour:
     - pending  -> hold the request; neither `next()` nor a response.
     - ready    -> `next()` exactly once.
     - failed   -> respond directly with a fixed sanitized 503. It does NOT
                   call `next(err)`: the error pipeline renders EJS/JSON error
                   pages through middleware that has not been mounted yet at
                   this point in the chain, and a partially-served application
                   is exactly what this gate exists to prevent.

   Privacy: this module logs NOTHING — not per request, not once, not a
   sanitized summary. It never inspects, stores, or emits the initialization
   error, so a backend host, key, DSN, or stack can never reach a response
   body or the process output through this path. The 503 body below is a
   fixed literal with no interpolation.
   ======================================== */

// The exact sanitized unavailable payload. Written as a literal (not
// JSON.stringify of an object) so the serialized bytes are pinned and can
// never drift with key ordering or a future field addition.
const UNAVAILABLE_BODY = '{"success":false,"message":"Service temporarily unavailable."}';

function noop() { /* intentionally empty */ }

/**
 * Create the process's single session-readiness coordinator.
 *
 * @param {object|undefined} sessionStore the ALREADY-CONSTRUCTED persistent
 *   session store (or undefined for the development-only memory store). This
 *   function never creates, selects, or replaces a store.
 * @returns {{ whenReady: function(): Promise<void>, middleware: function }}
 */
function createSessionReadiness(sessionStore) {
  /* The one eager attempt. Promise.resolve().then(...) defers the call by a
     microtask, which is what makes a SYNCHRONOUS throw inside init() become a
     rejection of `ready` instead of a throw out of createSessionReadiness().
     Both failure shapes therefore land on the identical path. */
  const ready = Promise.resolve().then(function initOnce() {
    if (!sessionStore || typeof sessionStore.init !== 'function') {
      // No persistent store to bootstrap (memory store / store without init).
      return undefined;
    }
    return sessionStore.init();
  });

  /* Observe the rejection immediately. `ready.then(noop, noop)` returns a NEW
     already-handled promise; it does not swallow the rejection for the real
     consumers below, but it does mean an exported app that has not yet served
     a request cannot trigger an unhandled-rejection warning. */
  ready.then(noop, noop);

  // Fixed sanitized refusal. No logging, no error detail, no interpolation.
  function sendUnavailable(res) {
    if (res.headersSent) return;
    res.status(503);
    res.set('Cache-Control', 'no-store');
    res.type('application/json');
    res.send(UNAVAILABLE_BODY);
  }

  /**
   * Express middleware. Mounted immediately after the security headers and
   * BEFORE rate limiting, body parsers, static serving, express-session, the
   * authenticated middleware, CSRF, logging, routes, and error handlers.
   */
  function middleware(req, res, next) {
    /* Two SEPARATE handlers, deliberately. `then(onReady, onUnavailable)`
       routes only a rejection of `ready` to onUnavailable — an exception
       thrown by downstream middleware inside next() propagates as it normally
       would and can never be misreported as a readiness failure. A
       .then(...).catch(...) chain would wrongly convert it into a 503. */
    ready.then(
      function onReady() { next(); },
      function onUnavailable() { sendUnavailable(res); }
    );
  }

  return {
    // The EXACT shared promise — local startup awaits the same instance the
    // request gate awaits.
    whenReady: function whenReady() { return ready; },
    middleware: middleware,
  };
}

module.exports = { createSessionReadiness, UNAVAILABLE_BODY };
