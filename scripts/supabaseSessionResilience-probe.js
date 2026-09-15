'use strict';
/* Database-free Supabase session-store resilience probe. It drives the real
   store with a thenable PostgREST-shaped fake and never reads environment
   configuration, opens a listener, authenticates, or touches a database. */

const fs = require('fs');
const path = require('path');
const { SupabaseSessionStore } = require('../services/supabaseSessionStore');

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

  function take(operation) {
    calls[operation] = (calls[operation] || 0) + 1;
    const queue = queues[operation] || [];
    return queue.length ? queue.shift() : { data: null, error: null, status: 200 };
  }

  return {
    calls,
    inputs,
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
        abortSignal(value) { signal = value; return query; },
        then(resolve, reject) {
          const outcome = take(operation);
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
    let calls = 0;
    store[method](...args, (error, value) => {
      calls += 1;
      resolve({ error: error || null, value, calls });
    });
  });
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
  await testInitClassification();
  await testGetRetry();
  await testSetAndTouchRetry();
  await testAuthorizationAndTimeout();
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
