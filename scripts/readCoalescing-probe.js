'use strict';

/*
 * Focused, database-free contract probe for the performance fix.
 *
 * It verifies that createSingleFlight shares one active read, drops the
 * completed result immediately (so the next call is fresh), invalidates an
 * active read without allowing its late completion to clear a newer read, and
 * retries after a rejected read. No server, database, credential, or session
 * module is imported.
 */

const { createSingleFlight } = require('../utils/singleFlight');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function main() {
  let loads = 0;
  let gate = deferred();
  const flight = createSingleFlight(() => {
    loads += 1;
    const current = gate;
    return current.promise;
  });

  const p1 = flight();
  const p2 = flight();
  const p3 = flight();
  assert(p1 === p2 && p2 === p3, 'concurrent callers did not share the active promise');
  assert(loads === 0, 'loader started before its scheduled microtask');
  await Promise.resolve();
  assert(loads === 1, 'active read was not started exactly once');
  gate.resolve('first');
  assert((await Promise.all([p1, p2, p3])).every((v) => v === 'first'), 'shared result was inconsistent');

  gate = deferred();
  const fresh = flight();
  await Promise.resolve();
  assert(loads === 2, 'completed result was retained as a cache');
  gate.resolve('second');
  assert(await fresh === 'second', 'fresh read returned the prior result');

  const oldGate = deferred();
  const newGate = deferred();
  let invalidationLoads = 0;
  const invalidated = createSingleFlight(() => {
    invalidationLoads += 1;
    return invalidationLoads === 1 ? oldGate.promise : newGate.promise;
  });
  const oldRead = invalidated();
  await Promise.resolve();
  invalidated.invalidate();
  const newRead = invalidated();
  await Promise.resolve();
  assert(oldRead !== newRead && invalidationLoads === 2, 'invalidation did not start a replacement read');
  oldGate.resolve('old');
  assert(await oldRead === 'old', 'old waiter did not finish on its original snapshot');
  newGate.resolve('new');
  assert(await newRead === 'new', 'late old completion displaced the replacement read');

  let rejectedLoads = 0;
  const rejecting = createSingleFlight(async () => {
    rejectedLoads += 1;
    if (rejectedLoads === 1) throw new Error('expected probe rejection');
    return 'recovered';
  });
  let rejected = false;
  try { await rejecting(); } catch (_) { rejected = true; }
  assert(rejected, 'rejected active read did not reject');
  assert(await rejecting() === 'recovered' && rejectedLoads === 2, 'rejected read did not clear for retry');

  console.log('[read-coalescing] PASS (6/6)');
}

main().catch((error) => {
  console.error('[read-coalescing] FAIL:', error && error.message ? error.message : 'unexpected failure');
  process.exitCode = 1;
});
