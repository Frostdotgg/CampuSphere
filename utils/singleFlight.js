'use strict';

/*
 * Share one active asynchronous read among concurrent callers.
 *
 * This is intentionally NOT a cache: the active promise is discarded as soon
 * as it settles. A later caller always starts a fresh read. `invalidate()`
 * detaches an in-flight promise so a caller that arrives after a mutation
 * cannot join work that started before that mutation.
 */
function createSingleFlight(loader) {
  if (typeof loader !== 'function') {
    throw new TypeError('createSingleFlight requires a loader function.');
  }

  let active = null;

  const run = (...args) => {
    if (active) return active.promise;

    const entry = {};
    entry.promise = Promise.resolve().then(() => loader(...args));
    active = entry;

    // Attach both handlers so a rejected loader never creates an unhandled
    // rejection while still returning the original rejection to its callers.
    entry.promise.then(
      () => { if (active === entry) active = null; },
      () => { if (active === entry) active = null; }
    );

    return entry.promise;
  };

  run.invalidate = () => { active = null; };
  run.isActive = () => active !== null;
  return run;
}

module.exports = { createSingleFlight };
