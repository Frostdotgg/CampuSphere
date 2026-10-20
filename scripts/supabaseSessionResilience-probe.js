'use strict';
/* Database-free Supabase session-store resilience probe. It drives the real
   store with a thenable PostgREST-shaped fake and never reads environment
   configuration, opens a listener, authenticates, or touches a database. */

const fs = require('fs');
const path = require('path');
const { SupabaseSessionStore } = require('../services/supabaseSessionStore');
const { elapsedBucket, safeRequestCorrelationId, requestDiagnostics, requestCorrelationId } = require('../utils/requestDiagnostics');

const failures = [];
let checks = 0;
const runId = Math.random().toString(36).slice(2, 10);
const CANARY = `session-resilience-canary-${runId}-url-key-cookie-sid`;

function check(scope, label, condition) {
  checks += 1;
  const passed = condition === true;
  console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!passed) failures.push(`${scope} :: ${label}`);
}

function failure(status, extra) {
  return Object.assign({ error: { message: CANARY }, status }, extra || {});
}

function createClient(queues) {
  const calls = Object.create(null);
  const inputs = [];
  const aborts = [];

  function take(operation) {
    calls[operation] = (calls[operation] || 0) + 1;
    const queue = queues[operation] || [];
    return queue.length ? queue.shift() : { data: null, error: null, status: 200 };
  }

  return {
    calls,
    inputs,
    aborts,
    from(table) {
      let operation = 'unknown';
      let selectedColumns = null;
      let signal = null;
      const query = {
        select(columns) { operation = 'select'; selectedColumns = columns; inputs.push({ operation, table, columns }); return query; },
        upsert(row, options) { operation = 'set'; inputs.push({ operation, table, row, options }); return query; },
        update(row) { operation = 'touch'; inputs.push({ operation, table, row }); return query; },
        delete() { operation = 'destroy'; inputs.push({ operation, table }); return query; },
        eq(column) { inputs.push({ operation, column }); return query; },
        limit() { return query; },
        maybeSingle() {
          if (operation === 'select') {
            operation = selectedColumns === 'sid' ? 'confirm' : 'get';
          }
          return query;
        },
        abortSignal(value) {
          signal = value;
          signal.addEventListener('abort', () => aborts.push(operation), { once: true });
          return query;
        },
        then(resolve, reject) {
          const outcome = take(operation);
          if (outcome && outcome.pending) return outcome.pending.then(resolve, reject);
          if (outcome && outcome.hang) {
            if (signal) signal.addEventListener('abort', () => {
              const error = new Error(CANARY);
              error.name = 'AbortError';
              reject(error);
            }, { once: true });
            return;
          }
          if (outcome && outcome.reject) {
            const error = new Error(CANARY);
            if (outcome.code) error.code = outcome.code;
            if (outcome.status) error.status = outcome.status;
            reject(error);
            return;
          }
          resolve(outcome);
        },
      };
      return query;
    },
  };
}

function createLogger() {
  const lines = [];
  return {
    lines,
    info(line) { lines.push(line); },
    warn(line) { lines.push(line); },
    error(line) { lines.push(line); },
  };
}

const REQUEST_ID = '0123456789abcdef0123456789abcdef';

function testDiagnosticUtilityContract() {
  const bucketCases = [
    [-1, 'unknown'],
    [Number.NaN, 'unknown'],
    [Number.POSITIVE_INFINITY, 'unknown'],
    [0, 'lt250ms'],
    [249.999, 'lt250ms'],
    [250, '250to999ms'],
    [999.999, '250to999ms'],
    [1000, '1000to1999ms'],
    [1999.999, '1000to1999ms'],
    [2000, 'gte2000ms'],
  ];
  const bucketContract = bucketCases.every(([value, expected]) => elapsedBucket(value) === expected);
  const validId = safeRequestCorrelationId(REQUEST_ID) === REQUEST_ID;
  const invalidIds = [
    '0123456789ABCDEF0123456789ABCDEF',
    'short',
    '',
    null,
    123,
  ];
  const invalidIdsRejected = invalidIds.every((value) => safeRequestCorrelationId(value) === '-');

  check('diagnostics', 'elapsed buckets cover invalid values and every exact boundary', bucketContract);
  check('diagnostics', 'only a 32-character lowercase hex request id is accepted', validId && invalidIdsRejected);
}

function makeStore(client, extra) {
  return new SupabaseSessionStore(Object.assign({
    client,
    requestTimeoutMs: 30,
    retryDelayMs: 0,
    sleep: async () => {},
    logger: createLogger(),
  }, extra || {}));
}

function callStore(store, method, ...args) {
  return new Promise((resolve) => {
    const result = { error: null, value: undefined, calls: 0 };
    store[method](...args, (error, value) => {
      result.calls += 1;
      if (result.calls === 1) {
        result.error = error || null;
        result.value = value;
        resolve(result);
      }
    });
  });
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function flush() {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

function operationId(line) {
  const match = line.match(/ operation_id=([a-f0-9]{32})$/);
  return match ? match[1] : null;
}

async function testOverlappingSampledRetries() {
  const firstWait = deferred();
  const client = createClient({ touch: [failure(502), failure(502), { error: null, status: 204 }, { error: null, status: 204 }] });
  const logger = createLogger();
  let firstRequestId;
  const store = makeStore(client, {
    logger,
    now: () => 100000,
    retryDelayMs: 1,
    sleep: () => requestCorrelationId() === firstRequestId ? firstWait.promise : Promise.resolve(),
  });
  const first = requestDiagnostics({}, {}, () => {
    firstRequestId = requestCorrelationId();
    return callStore(store, 'touch', 'first-sid', { cookie: {} });
  });
  await flush();
  const second = requestDiagnostics({}, {}, () => callStore(store, 'touch', 'second-sid', { cookie: {} }));
  const secondResult = await second;
  firstWait.resolve();
  const firstResult = await first;
  const retries = logger.lines.filter(line => line.includes('state=retrying'));
  const recoveries = logger.lines.filter(line => line.includes('state=recovered'));
  check('pairing', 'overlapping operations both recover once with two provider attempts each',
    !firstResult.error && !secondResult.error && firstResult.calls === 1 && secondResult.calls === 1 && client.calls.touch === 4);
  check('pairing', 'the first sampled warning keeps its own recovery when another request finishes first',
    retries.length === 1 && recoveries.length === 1 &&
    retries[0].includes(`request_id=${firstRequestId}`) && recoveries[0].includes(`request_id=${firstRequestId}`));
  check('pairing', 'the sampled pair has one matching opaque operation id',
    retries.length === 1 && recoveries.length === 1 && operationId(retries[0]) !== null &&
    operationId(retries[0]) === operationId(recoveries[0]));
}

async function testSamplingWindowsAndBudgets() {
  let clock = 0;
  const client = createClient({ touch: Array.from({ length: 8 }, (_, i) => i % 2 ? { error: null, status: 204 } : failure(502)) });
  const logger = createLogger();
  const store = makeStore(client, { logger, now: () => clock });
  for (const [at, expected] of [[0, 2], [0, 2], [59999, 2], [60000, 4]]) {
    clock = at;
    const result = await callStore(store, 'touch', 'window-sid', { cookie: {} });
    check('sampling', 'a clock at ' + at + ' keeps the expected complete-pair budget ' + expected,
      !result.error && result.calls === 1 && logger.lines.length === expected);
  }
  check('sampling', 'successive admitted operations have distinct operation ids',
    operationId(logger.lines[0]) !== operationId(logger.lines[2]) &&
    operationId(logger.lines[2]) === operationId(logger.lines[3]));

  const standaloneLogger = createLogger();
  const standalone = makeStore(createClient({ get: Array.from({ length: 4 }, () => failure(401)) }),
    { logger: standaloneLogger, now: () => clock });
  for (const [at, expected] of [[0, 1], [0, 1], [59999, 1], [60000, 2]]) {
    clock = at;
    const result = await callStore(standalone, 'get', 'standalone-sid');
    check('sampling', 'standalone failures at ' + at + ' retain their separate one-minute allowance ' + expected,
      !!result.error && result.calls === 1 && standaloneLogger.lines.length === expected &&
      standaloneLogger.lines.every(line => line.includes('state=failed') && operationId(line) === null));
  }

  const distinctLogger = createLogger();
  const distinct = makeStore(createClient({}), { logger: distinctLogger, now: () => 0 });
  await Promise.all(['get', 'set', 'touch'].map(operation => {
    let attempt = 0;
    return distinct._runtimeRequest(operation, () => Promise.resolve(++attempt === 1
      ? failure(502) : { error: null, status: 200 }));
  }));
  check('sampling', 'get, set and touch have independent pair allowances for the same initial failure',
    distinctLogger.lines.length === 6 && ['get', 'set', 'touch'].every(operation =>
      distinctLogger.lines.filter(line => line.includes('operation=' + operation + ' ')).length === 2));

  for (const terminal of [false, true]) {
    const burstLogger = createLogger();
    const burstStore = makeStore(createClient({}), { logger: burstLogger, now: () => 0 });
    const operations = Array.from({ length: 100 }, () => {
      let attempt = 0;
      return burstStore._runtimeRequest('touch', () => Promise.resolve(
        ++attempt === 1 || terminal ? failure(502) : { error: null, status: 204 }
      )).then(() => true, () => false);
    });
    const results = await Promise.all(operations);
    const retries = burstLogger.lines.filter(line => line.includes('state=retrying'));
    const endings = burstLogger.lines.filter(line => !line.includes('state=retrying'));
    check('sampling', '100 concurrent ' + (terminal ? 'failed' : 'recovered') + ' operations keep the fixed logging budget',
      results.every(result => result === !terminal) && retries.length === 1 && burstLogger.lines.length === (terminal ? 3 : 2));
    check('sampling', 'the sampled burst outcome retains its warning operation id',
      endings.filter(line => operationId(line) === operationId(retries[0])).length === 1);
    if (terminal) check('sampling', 'the only additional burst error is a standalone limited failure',
      endings.filter(line => operationId(line) === null && line.includes('state=failed')).length === 1);
    check('sampling', 'sampling state contains category keys, never request or operation ids',
      burstStore._lastDiagnosticAt.size === (terminal ? 2 : 1) &&
      [...burstStore._lastDiagnosticAt.keys()].every(key => /^touch:(retrying|failed):upstream:502$/.test(key)));
  }
}

async function testSameRequestAndChangedFailure() {
  const wait = deferred();
  let sleeps = 0;
  const client = createClient({ touch: [failure(502), failure(503), { error: null, status: 204 }, { error: null, status: 204 }] });
  const logger = createLogger();
  const store = makeStore(client, { logger, requestIdProvider: () => REQUEST_ID, retryDelayMs: 1,
    sleep: () => ++sleeps === 1 ? wait.promise : Promise.resolve() });
  const first = callStore(store, 'touch', 'same-request-first', { cookie: {} });
  await flush();
  const second = await callStore(store, 'touch', 'same-request-second', { cookie: {} });
  wait.resolve();
  const firstResult = await first;
  const warnings = logger.lines.filter(line => line.includes('state=retrying'));
  check('pairing', 'different initial statuses have independent pair sampling windows',
    !firstResult.error && !second.error && warnings.length === 2 && logger.lines.length === 4);
  check('pairing', 'two operations in one request have distinct correctly matched pair ids',
    warnings.every(warning => logger.lines.filter(line => operationId(line) === operationId(warning)).length === 2) &&
    operationId(warnings[0]) !== operationId(warnings[1]) && logger.lines.every(line => line.includes(`request_id=${REQUEST_ID}`)));
  check('pairing', 'each recovery describes its own triggering failure category and status',
    warnings.every(warning => {
      const recovered = logger.lines.find(line => operationId(line) === operationId(warning) && line.includes('state=recovered'));
      return recovered && recovered.match(/category=\S+ status=\d+/)[0] === warning.match(/category=\S+ status=\d+/)[0];
    }));

  const changed = createClient({ touch: [failure(502), failure(403)] });
  const changedLogger = createLogger();
  const changedResult = await callStore(makeStore(changed, { logger: changedLogger }), 'touch', 'changed-sid', { cookie: {} });
  check('pairing', 'a changed terminal category keeps the admitted operation identity',
    !!changedResult.error && changedResult.calls === 1 && changed.calls.touch === 2 && changedLogger.lines.length === 2 &&
    changedLogger.lines[0].includes('category=upstream status=502') &&
    changedLogger.lines[1].includes('state=failed category=authorization status=403') &&
    operationId(changedLogger.lines[0]) === operationId(changedLogger.lines[1]));
  check('pairing', 'a sampled failure does not emit a duplicate standalone error',
    changedLogger.lines.filter(line => line.includes('state=failed')).length === 1 &&
    changedLogger.lines.every(line => operationId(line) !== null));
}

async function testReservedOutcomeAcrossWindow() {
  let clock = 0;
  let sleeps = 0;
  const wait = deferred();
  const client = createClient({ touch: [failure(502), failure(502), { error: null, status: 204 }, { error: null, status: 204 }] });
  const logger = createLogger();
  const store = makeStore(client, { logger, now: () => clock, retryDelayMs: 1,
    sleep: () => ++sleeps === 1 ? wait.promise : Promise.resolve() });
  const first = callStore(store, 'touch', 'old-window', { cookie: {} });
  await flush();
  clock = 60000;
  await callStore(store, 'touch', 'new-window', { cookie: {} });
  wait.resolve();
  await first;
  check('pairing', 'a late reserved outcome survives a new sampling window and another completion',
    logger.lines.length === 4 && operationId(logger.lines[0]) === operationId(logger.lines[3]) &&
    operationId(logger.lines[1]) === operationId(logger.lines[2]));
}

async function testDiagnosticWriterIsolation() {
  const cases = [
    ['missing warning', {}],
    ['throwing warning', { warn() { throw new Error(CANARY); } }],
    ['throwing warning getter', Object.defineProperty({}, 'warn', { get() { throw new Error(CANARY); } })],
    ['missing recovery', { warn() {} }],
    ['throwing recovery', { warn() {}, info() { throw new Error(CANARY); } }],
  ];
  for (const [label, logger] of cases) {
    const client = createClient({ touch: [failure(502), { error: null, status: 204 }] });
    const result = await callStore(makeStore(client, { logger }), 'touch', 'writer-sid', { cookie: {} });
    check('writers', label + ' cannot turn provider recovery into another retry or failure',
      !result.error && result.calls === 1 && client.calls.touch === 2);
  }
  for (const sampled of [false, true]) {
    const client = createClient({ touch: sampled ? [failure(502), failure(502)] : [failure(403)] });
    const result = await callStore(makeStore(client, { logger: { warn() {}, error() { throw new Error(CANARY); } } }),
      'touch', 'failed-writer-sid', { cookie: {} });
    check('writers', (sampled ? 'paired' : 'standalone') + ' throwing error writer preserves one fixed failure callback',
      result.calls === 1 && result.error && result.error.message === 'Session store operation failed.' &&
      client.calls.touch === (sampled ? 2 : 1));
  }
  const omitted = createLogger();
  delete omitted.warn;
  const missingClient = createClient({ touch: [failure(502), { error: null, status: 204 }] });
  await callStore(makeStore(missingClient, { logger: omitted }), 'touch', 'missing-warn-sid', { cookie: {} });
  check('writers', 'a warning that cannot be emitted does not create an orphan recovery', omitted.lines.length === 0);
  const generatedLogger = createLogger();
  const generatedClient = createClient({ touch: [failure(502), { error: null, status: 204 }] });
  const generatedResult = await callStore(makeStore(generatedClient, {
    logger: generatedLogger, operationIdProvider() { throw new Error(CANARY); },
  }), 'touch', 'generator-sid', { cookie: {} });
  check('writers', 'a throwing operation-id generator cannot alter recovery or emit unsafe diagnostics',
    !generatedResult.error && generatedResult.calls === 1 && generatedClient.calls.touch === 2 && generatedLogger.lines.length === 0);

  const reentrantLines = [];
  let reentrant;
  let nested;
  const reentrantLogger = {
    warn(line) {
      reentrantLines.push(line);
      nested = reentrant._sampleRetry('touch', { category: 'upstream', status: 502 }, 1, { requestId: REQUEST_ID });
    },
    info(line) { reentrantLines.push(line); },
  };
  reentrant = makeStore(createClient({ touch: [failure(502), { error: null, status: 204 }] }),
    { logger: reentrantLogger, now: () => 0 });
  const reentrantResult = await callStore(reentrant, 'touch', 'reentrant-sid', { cookie: {} });
  check('writers', 'the admission window is claimed before a writer can reenter the sampler',
    !reentrantResult.error && nested === null && reentrantLines.length === 2 &&
    operationId(reentrantLines[0]) === operationId(reentrantLines[1]));
  for (const badClock of [() => NaN, () => { throw new Error(CANARY); }]) {
    const client = createClient({ touch: [failure(502), { error: null, status: 204 }] });
    const result = await callStore(makeStore(client, { now: badClock }), 'touch', 'clock-sid', { cookie: {} });
    check('writers', 'an unavailable diagnostic clock cannot alter a recovered operation', !result.error && result.calls === 1 && client.calls.touch === 2);
  }
}

async function testPairIdPrivacyAndLateCompletion() {
  for (const badId of [CANARY, REQUEST_ID.toUpperCase(), '', '-', null, 12, 'a'.repeat(32) + '\n']) {
    const client = createClient({ touch: [failure(502), { error: null, status: 204 }] });
    const logger = createLogger();
    const result = await callStore(makeStore(client, { logger, operationIdProvider: () => badId }), 'touch', 'private-sid', { cookie: {} });
    check('privacy', 'an invalid operation id is not emitted and cannot change store success', !result.error && result.calls === 1 && logger.lines.length === 0);
  }
  const idClient = createClient({ touch: [failure(502), { error: null, status: 204 }] });
  const idLogger = createLogger();
  const expires = new Date(Date.now() + 60000);
  await callStore(makeStore(idClient, { logger: idLogger, requestIdProvider: () => CANARY }), 'touch', CANARY, {
    cookie: { expires }, user: { description: CANARY },
  });
  check('privacy', 'malformed request context is replaced and private data never reaches paired logs',
    idLogger.lines.length === 2 && idLogger.lines.every(line => line.includes('request_id=-') && operationId(line)) &&
    !idLogger.lines.join('\n').includes(CANARY));
  check('privacy', 'diagnostic operation ids are never persisted in touch query data',
    idLogger.lines.every(line => !JSON.stringify(idClient.inputs).includes(operationId(line))));
  const input = idClient.inputs.find(row => row.operation === 'touch');
  check('touch', 'expiry refresh still writes only expiry and a timestamp',
    input && Object.keys(input.row).sort().join(',') === 'expires_at,updated_at' &&
    input.row.expires_at === expires.getTime() && typeof input.row.updated_at === 'string');

  const pending = deferred();
  const lateClient = createClient({ touch: [{ pending: pending.promise }, { error: null, status: 204 }] });
  const lateLogger = createLogger();
  const result = await callStore(makeStore(lateClient, { logger: lateLogger }), 'touch', 'late-sid', { cookie: {} });
  pending.resolve({ error: null, status: 204 });
  await flush();
  await new Promise(resolve => setImmediate(resolve));
  check('late completion', 'an aborted first attempt resolving after recovery cannot duplicate callbacks or diagnostics',
    !result.error && result.calls === 1 && lateClient.aborts.length === 1 && lateClient.calls.touch === 2 && lateLogger.lines.length === 2);

  const timedOut = [deferred(), deferred()];
  const exhaustedClient = createClient({ touch: timedOut.map(item => ({ pending: item.promise })) });
  const exhaustedLogger = createLogger();
  const exhausted = await callStore(makeStore(exhaustedClient, { logger: exhaustedLogger }), 'touch', 'exhausted-sid', { cookie: {} });
  timedOut.forEach(item => item.reject(new Error(CANARY)));
  await flush();
  await new Promise(resolve => setImmediate(resolve));
  check('late completion', 'two timed-out attempts abort and settle once even after both providers reject late',
    exhausted.error && exhausted.error.message === 'Session store operation failed.' && exhausted.calls === 1 &&
    exhaustedClient.aborts.length === 2 && exhaustedClient.calls.touch === 2 && exhaustedLogger.lines.length === 2 &&
    exhaustedLogger.lines[1].includes('state=failed category=timeout') &&
    operationId(exhaustedLogger.lines[0]) === operationId(exhaustedLogger.lines[1]));

  const expiredClient = createClient({ get: [{ data: { sess: { private: CANARY }, expires_at: Date.now() - 1 }, error: null, status: 200 }] });
  const expired = await callStore(makeStore(expiredClient), 'get', 'expired-sid');
  await flush();
  check('expiry', 'an expired session remains absent and invokes only its scoped best-effort delete',
    !expired.error && expired.value === null && expired.calls === 1 && expiredClient.calls.get === 1 && expiredClient.calls.destroy === 1);
  let generated = 0;
  const immediate = createClient({ touch: [{ error: null, status: 204 }] });
  const immediateResult = await callStore(makeStore(immediate, { operationIdProvider() { generated += 1; return REQUEST_ID; } }), 'touch', 'immediate-sid', { cookie: {} });
  check('fast path', 'immediate success generates no diagnostic operation id or retry', !immediateResult.error && immediateResult.calls === 1 && generated === 0 && immediate.calls.touch === 1);
}

async function testInitClassification() {
  const client = createClient({ select: [failure(502)] });
  const store = makeStore(client);
  let caught = null;
  await store.init().catch((error) => { caught = error; });
  check('init', 'one readiness invocation issues one store query (coordinator owns wave retries)',
    client.calls.select === 1);
  check('init', 'a 502 becomes a fixed sanitized upstream initialization error',
    caught && caught.message === 'Session store initialization failed.' &&
    caught.category === 'upstream' && caught.status === 502 && !caught.message.includes(CANARY));
}

async function testGetRetry() {
  const client = createClient({ get: [failure(502), {
    data: { sess: { user: { role: 'guest' } }, expires_at: Date.now() + 60000 },
    error: null,
    status: 200,
  }] });
  const logger = createLogger();
  const store = makeStore(client, { logger });
  const result = await callStore(store, 'get', 'probe-sid');
  check('get', 'a transient 502 is retried once and returns the session',
    client.calls.get === 2 && !result.error && result.value.user.role === 'guest');
  check('get', 'the callback is called exactly once', result.calls === 1);
  check('get', 'retry and recovery diagnostics are sanitized',
    logger.lines.length === 2 && logger.lines.some((line) => line.includes('state=retrying')) &&
    logger.lines.some((line) => line.includes('state=recovered')) &&
    !logger.lines.join('\n').includes(CANARY) && !logger.lines.join('\n').includes('probe-sid'));
}

async function testSetAndTouchRetry() {
  const setClient = createClient({ set: [{ reject: true, code: 'ECONNRESET' }, { error: null, status: 201 }] });
  const setStore = makeStore(setClient);
  const setResult = await callStore(setStore, 'set', 'probe-sid', {
    cookie: { expires: new Date(Date.now() + 60000) }, user: { role: 'guest' },
  });
  check('set', 'an idempotent upsert retries one network failure and succeeds',
    setClient.calls.set === 2 && !setResult.error && setResult.calls === 1);

  const touchClient = createClient({ touch: [failure(429), { error: null, status: 204 }] });
  const touchStore = makeStore(touchClient);
  const touchResult = await callStore(touchStore, 'touch', 'probe-sid', { cookie: {} });
  check('touch', 'an idempotent touch retries one 429 and succeeds',
    touchClient.calls.touch === 2 && !touchResult.error && touchResult.calls === 1);
}

async function testAuthorizationAndTimeout() {
  const authClient = createClient({ get: [failure(401), { data: null, error: null, status: 200 }] });
  const authStore = makeStore(authClient);
  const authResult = await callStore(authStore, 'get', 'probe-sid');
  check('authorization', 'a permanent 401 fails closed without a runtime retry',
    authClient.calls.get === 1 && authResult.error &&
    authResult.error.message === 'Session store operation failed.' && authResult.calls === 1);

  const timeoutClient = createClient({ get: [{ hang: true }, {
    data: { sess: { ok: true }, expires_at: Date.now() + 60000 }, error: null, status: 200,
  }] });
  const timeoutStore = makeStore(timeoutClient);
  const timeoutResult = await callStore(timeoutStore, 'get', 'probe-sid');
  check('timeout', 'a hung read is aborted, retried once, and recovers',
    timeoutClient.calls.get === 2 && !timeoutResult.error && timeoutResult.value.ok === true &&
    timeoutResult.calls === 1);
}

async function testDiagnosticTimingAndCorrelation() {
  let clock = 0;
  const logger = createLogger();
  const client = createClient({ touch: [{ hang: true }, { error: null, status: 204 }] });
  const ticks = [0, 2000, 2000, 2050];
  const store = makeStore(client, {
    logger,
    requestIdProvider: () => REQUEST_ID,
    monotonicNow: () => ticks.shift(),
    now: () => clock,
  });
  const result = await callStore(store, 'touch', 'probe-sid', { cookie: {} });
  const lines = logger.lines.join('\n');

  check('diagnostics', 'a timeout retry and recovery retain the callback contract',
    client.calls.touch === 2 && !result.error && result.calls === 1);
  check('diagnostics', 'anomaly diagnostics carry coarse per-attempt timing buckets',
    logger.lines.length === 2 && lines.includes('state=retrying') &&
    lines.includes('state=recovered') && lines.includes('attempts=1 attempt_elapsed=gte2000ms') &&
    lines.includes('attempts=2 attempt_elapsed=lt250ms'));
  check('diagnostics', 'both anomaly lines carry the same opaque request correlation id',
    logger.lines.every((line) => line.includes(`request_id=${REQUEST_ID}`)));
  check('diagnostics', 'timing/correlation diagnostics remain free of the session canary',
    !lines.includes('probe-sid') && !lines.includes('url') && !lines.includes('key'));
}

async function testDestroyContract() {
  const absentClient = createClient({
    destroy: [failure(502)],
    confirm: [{ data: null, error: null, status: 200 }],
  });
  const absentStore = makeStore(absentClient);
  const absent = await callStore(absentStore, 'destroy', 'probe-sid');
  check('destroy', 'ambiguous delete success is confirmed without a duplicate delete',
    !absent.error && absent.calls === 1 && absentClient.calls.destroy === 1 && absentClient.calls.confirm === 1);

  const retryClient = createClient({
    destroy: [failure(502), { error: null, status: 204 }],
    confirm: [failure(502)],
  });
  const retryStore = makeStore(retryClient);
  const retry = await callStore(retryStore, 'destroy', 'probe-sid');
  check('destroy', 'inconclusive confirmation permits only the existing one bounded delete retry',
    !retry.error && retry.calls === 1 && retryClient.calls.destroy === 2 && retryClient.calls.confirm === 1);
}

async function testDiagnosticRateLimitAndSourcePrivacy() {
  let clock = 100000;
  const client = createClient({ get: [failure(401), failure(401), failure(401)] });
  const logger = createLogger();
  const store = makeStore(client, { logger, now: () => clock });
  await callStore(store, 'get', 'first-sid');
  await callStore(store, 'get', 'second-sid');
  check('diagnostics', 'repeated identical terminal failures emit one line per minute', logger.lines.length === 1);
  clock += 60000;
  await callStore(store, 'get', 'third-sid');
  check('diagnostics', 'the next one-minute window permits one new diagnostic', logger.lines.length === 2);
  check('diagnostics', 'no diagnostic includes raw errors or session identifiers',
    !logger.lines.join('\n').includes(CANARY) && !/first-sid|second-sid|third-sid/.test(logger.lines.join('\n')));

  const source = fs.readFileSync(path.join(__dirname, '..', 'services', 'supabaseSessionStore.js'), 'utf8');
  check('privacy', 'diagnostic construction never interpolates sid, session JSON, raw error, URL, or key',
    !/\[session-store\][^\n]*(?:sid|sess|cookie|url|key|error\.message)/i.test(source));
}

async function main() {
  console.log('=== CampuSphere Supabase session resilience probe (database-free) ===');
  testDiagnosticUtilityContract();
  await testInitClassification();
  await testGetRetry();
  await testSetAndTouchRetry();
  await testAuthorizationAndTimeout();
  await testDiagnosticTimingAndCorrelation();
  await testOverlappingSampledRetries();
  await testSamplingWindowsAndBudgets();
  await testSameRequestAndChangedFailure();
  await testReservedOutcomeAcrossWindow();
  await testDiagnosticWriterIsolation();
  await testPairIdPrivacyAndLateCompletion();
  await testDestroyContract();
  await testDiagnosticRateLimitAndSourcePrivacy();

  if (failures.length) {
    console.error(`\nSUPABASE-SESSION-RESILIENCE-PROBE FAILED: ${failures.length} check(s) did not pass.`);
    failures.forEach((item) => console.error('  - ' + item));
    process.exitCode = 1;
  } else {
    console.log(`\nSUPABASE-SESSION-RESILIENCE-PROBE OK: ${checks}/${checks} checks passed.`);
  }
}

main().catch(() => {
  console.error('SUPABASE-SESSION-RESILIENCE-PROBE FAILED: sanitized harness failure.');
  process.exitCode = 1;
});
