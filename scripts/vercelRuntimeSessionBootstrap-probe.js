'use strict';

/* ========================================
   CampuSphere — M12.P1-R3 awaited runtime / session bootstrap probe

   DATABASE-FREE, network-free (beyond one loopback GET), self-terminating.
   Verifies the single-flight session-readiness coordinator
   (services/sessionReadiness.js) and its wiring in server.js:

     1. DYNAMIC: fake stores + mocked Express responses drive the real
        coordinator — resolve paths, the pending hold, a 25-request
        concurrent burst sharing ONE init, rejected and synchronously-thrown
        init producing the exact sanitized 503, no-retry-after-failure,
        single timer/listener creation, and per-request log silence. Plus a
        REAL in-process Express app (loopback, OS-assigned port) proving that
        a synchronous route throw and a rejected async route both reach the
        application's own error handler rather than the readiness 503.
     2. STATIC: the R2 preflight ordering invariant is intact, the security
        headers precede the readiness gate, the gate precedes static/session/
        routes, start() awaits the shared promise before app.listen(), the
        listener is guarded by require.main === module, module.exports = app
        survives, and the fixed 503 literal lives ONLY in the readiness module.
     3. SUBPROCESS: importing server.js opens no listener and the child exits
        promptly; executing `node server.js` on a dedicated confirmed-free
        port answers /auth, and only that exact PID is stopped in `finally`
        before the port is confirmed released.

   Both subprocess cases run with the development/memory-store profile and
   VERCEL forced off, inheriting the full parent environment and overriding
   only the test-specific values. GET /auth renders a static view, so no
   MySQL, Supabase, browser, or foreground server is involved.

   Output contract: fixed PASS/FAIL labels only. No environment value, raw
   error, URL, key, cookie, session id, stack, or canary-bearing response
   body is ever printed.

   Run:  node scripts/vercelRuntimeSessionBootstrap-probe.js
   ======================================== */

const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
// Already a production dependency; used only to build a throwaway in-process
// app for the real downstream-error propagation test below.
const express = require('express');

const { createSessionReadiness, UNAVAILABLE_BODY } = require('../services/sessionReadiness');

const ROOT = path.join(__dirname, '..');
const SERVER_PATH = path.join(ROOT, 'server.js');
const READINESS_PATH = path.join(ROOT, 'services', 'sessionReadiness.js');

const EXPECTED_BODY = '{"success":false,"message":"Service temporarily unavailable."}';
const LOCAL_FAILURE_LOG = '[startup] Session store initialization failed. Refusing to start.';
const LISTEN_BANNER = 'CampuSphere server running';

// Locally generated TEST-ONLY canary. It is embedded in a fake init error to
// prove nothing from a store failure reaches a response or this output. It is
// never printed and is not a real secret.
const runId = Math.random().toString(36).slice(2, 10);
const CANARY = `r3-canary-${runId}-host-key-dsn`;

const failures = [];
let checks = 0;
function check(scope, label, ok) {
  checks += 1;
  const pass = ok === true;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!pass) failures.push(`${scope} :: ${label}`);
}
function containsCanary(text) {
  return String(text == null ? '' : text).includes(CANARY);
}

/* ---------------- test doubles ---------------- */

// Minimal Express-shaped response recorder.
function makeRes() {
  const state = { status: null, headers: {}, type: null, body: null, sends: 0, headersSent: false };
  const res = {
    state,
    status(code) { state.status = code; return res; },
    set(key, value) { state.headers[key] = value; return res; },
    type(value) { state.type = value; return res; },
    send(body) { state.body = body; state.sends += 1; state.headersSent = true; return res; },
  };
  Object.defineProperty(res, 'headersSent', { get() { return state.headersSent; } });
  return res;
}

// Fake store whose init() behaviour is configurable. It counts its OWN calls,
// so the coordinator needs no debug property for the single-flight assertion.
function makeStore(options) {
  const opts = options || {};
  const store = { initCalls: 0 };
  if (opts.noInit) return store;
  store.init = function init() {
    store.initCalls += 1;
    if (opts.throwSync) throw new Error(CANARY);
    if (opts.reject) return Promise.reject(new Error(CANARY));
    if (opts.delayMs) return new Promise((resolve) => setTimeout(resolve, opts.delayMs));
    return Promise.resolve();
  };
  return store;
}

// Drive the gate once; returns the recorder plus the next() call count.
function dispatch(readiness) {
  const res = makeRes();
  const record = { res, nextCalls: 0 };
  readiness.middleware({}, res, () => { record.nextCalls += 1; });
  return record;
}

const tick = () => new Promise((resolve) => setImmediate(resolve));
const settle = async (times) => { for (let i = 0; i < (times || 6); i++) await tick(); };

function isExactUnavailable(record) {
  const s = record.res.state;
  return record.nextCalls === 0
    && s.status === 503
    && s.headers['Cache-Control'] === 'no-store'
    && s.type === 'application/json'
    && s.body === EXPECTED_BODY
    && s.sends === 1;
}

/* ---------------- 1. resolve paths ---------------- */
async function sectionResolve() {
  const noStore = createSessionReadiness(undefined);
  let resolved = false;
  await noStore.whenReady().then(() => { resolved = true; }, () => {});
  check('ready', 'no store (development memory profile) resolves successfully', resolved === true);

  const bare = makeStore({ noInit: true });
  let bareResolved = false;
  await createSessionReadiness(bare).whenReady().then(() => { bareResolved = true; }, () => {});
  check('ready', 'store without init() resolves successfully', bareResolved === true);

  const store = makeStore({});
  const readiness = createSessionReadiness(store);
  let storeResolved = false;
  await readiness.whenReady().then(() => { storeResolved = true; }, () => {});
  check('ready', 'store with init() resolves and init runs exactly once',
    storeResolved === true && store.initCalls === 1);

  check('ready', 'whenReady() returns the identical shared promise instance',
    readiness.whenReady() === readiness.whenReady());

  const ok = dispatch(readiness);
  await settle();
  check('ready', 'a request after success calls next() exactly once and writes no response',
    ok.nextCalls === 1 && ok.res.state.sends === 0 && ok.res.state.status === null);
}

/* ---------------- 2. pending hold ---------------- */
async function sectionPending() {
  const store = makeStore({ delayMs: 120 });
  const readiness = createSessionReadiness(store);
  const record = dispatch(readiness);

  await settle(8);
  check('pending', 'delayed init holds the request: next() not called while pending',
    record.nextCalls === 0);
  check('pending', 'delayed init holds the request: no response written while pending',
    record.res.state.sends === 0 && record.res.state.status === null);

  await readiness.whenReady();
  await settle();
  check('pending', 'the held request proceeds exactly once after readiness resolves',
    record.nextCalls === 1);
  check('pending', 'the released request still writes no response', record.res.state.sends === 0);
}

/* ---------------- 3. concurrent first requests ---------------- */
async function sectionConcurrent() {
  const CONCURRENCY = 25;
  const store = makeStore({ delayMs: 80 });
  const readiness = createSessionReadiness(store);
  const first = readiness.whenReady();

  const records = [];
  for (let i = 0; i < CONCURRENCY; i++) records.push(dispatch(readiness));

  await settle(4);
  check('concurrent', `${CONCURRENCY} concurrent first requests are all held while pending`,
    records.every((r) => r.nextCalls === 0 && r.res.state.sends === 0));

  await readiness.whenReady();
  await settle();

  check('concurrent', 'exactly ONE init() call is shared by every concurrent request',
    store.initCalls === 1);
  check('concurrent', 'every concurrent request calls next() exactly once',
    records.length === CONCURRENCY && records.every((r) => r.nextCalls === 1));
  check('concurrent', 'no concurrent request wrote a response',
    records.every((r) => r.res.state.sends === 0));
  check('concurrent', 'the shared promise instance is unchanged after the burst',
    readiness.whenReady() === first);
}

/* ---------------- 4. rejected init ---------------- */
async function sectionRejected() {
  const store = makeStore({ reject: true });
  const readiness = createSessionReadiness(store);
  await readiness.whenReady().then(() => {}, () => {});

  const record = dispatch(readiness);
  await settle();
  const s = record.res.state;

  check('rejected', 'rejected init never calls next()', record.nextCalls === 0);
  check('rejected', 'rejected init responds 503', s.status === 503);
  check('rejected', 'rejected init sets Cache-Control: no-store', s.headers['Cache-Control'] === 'no-store');
  check('rejected', 'rejected init responds as application/json', s.type === 'application/json');
  check('rejected', 'rejected init body is the exact fixed sanitized payload', s.body === EXPECTED_BODY);
  check('rejected', 'rejected init writes exactly one response', s.sends === 1);
  check('rejected', 'the module constant matches the exact fixed payload', UNAVAILABLE_BODY === EXPECTED_BODY);
  check('rejected', 'store-error canary never reaches the response body', !containsCanary(s.body));
  check('rejected', 'store-error canary never reaches the response headers',
    !containsCanary(JSON.stringify(s.headers)));
}

/* ---------------- 5. synchronous throw ---------------- */
async function sectionSyncThrow() {
  let constructed = true;
  let readiness = null;
  try {
    readiness = createSessionReadiness(makeStore({ throwSync: true }));
  } catch (e) {
    constructed = false;
  }
  check('sync-throw', 'a synchronously throwing init() does not throw out of the factory', constructed === true);
  if (!readiness) return;

  await readiness.whenReady().then(() => {}, () => {});
  const record = dispatch(readiness);
  await settle();

  check('sync-throw', 'a synchronous init() throw takes the identical 503 failure path',
    isExactUnavailable(record));
  check('sync-throw', 'store-error canary never reaches the response body',
    !containsCanary(record.res.state.body));
}

/* ---------------- 6. no retry after failure ---------------- */
async function sectionNoRetry() {
  const store = makeStore({ reject: true });
  const readiness = createSessionReadiness(store);
  await readiness.whenReady().then(() => {}, () => {});

  const later = [];
  for (let i = 0; i < 3; i++) later.push(dispatch(readiness));
  await settle();

  check('no-retry', 'every subsequent request after failure stays failed with the exact 503',
    later.every((r) => isExactUnavailable(r)));
  check('no-retry', 'no subsequent request triggers a second init() attempt', store.initCalls === 1);
  check('no-retry', 'the failed coordinator keeps returning the same promise instance',
    readiness.whenReady() === readiness.whenReady());
}

/* ---------------- 7. single timer / listener creation ---------------- */
async function sectionSingleResource() {
  const EVENT = `campusphere-r3-probe-${runId}`;
  const created = { timers: 0, listeners: 0 };
  let timer = null;
  const handler = () => {};
  const before = process.listenerCount(EVENT);

  try {
    const store = { initCalls: 0 };
    store.init = function init() {
      store.initCalls += 1;
      timer = setInterval(() => {}, 60000);
      if (timer && typeof timer.unref === 'function') timer.unref();
      created.timers += 1;
      process.on(EVENT, handler);
      created.listeners += 1;
      return Promise.resolve();
    };

    const readiness = createSessionReadiness(store);
    const records = [];
    for (let i = 0; i < 10; i++) records.push(dispatch(readiness));
    await readiness.whenReady();
    await settle();

    check('single-resource', 'a resource-creating init() runs once across 10 requests', store.initCalls === 1);
    check('single-resource', 'exactly one cleanup timer is armed', created.timers === 1);
    check('single-resource', 'exactly one process listener is added',
      created.listeners === 1 && process.listenerCount(EVENT) === before + 1);
    check('single-resource', 'all 10 requests proceeded after the single init',
      records.every((r) => r.nextCalls === 1));
  } finally {
    if (timer) clearInterval(timer);
    process.removeListener(EVENT, handler);
  }

  check('single-resource', 'the probe removed its own timer and listener',
    process.listenerCount(EVENT) === before);
}

/* ---------------- 8. per-request log silence ---------------- */
async function sectionSilence() {
  const original = { log: console.log, error: console.error, warn: console.warn };
  let writes = 0;
  const count = () => { writes += 1; };
  let readyRecords = [];
  let failedRecords = [];

  try {
    console.log = count; console.error = count; console.warn = count;

    const okReadiness = createSessionReadiness(makeStore({}));
    await okReadiness.whenReady().then(() => {}, () => {});
    for (let i = 0; i < 15; i++) readyRecords.push(dispatch(okReadiness));

    const badReadiness = createSessionReadiness(makeStore({ reject: true }));
    await badReadiness.whenReady().then(() => {}, () => {});
    for (let i = 0; i < 15; i++) failedRecords.push(dispatch(badReadiness));

    await settle();
  } finally {
    console.log = original.log; console.error = original.error; console.warn = original.warn;
  }

  check('silence', 'the readiness gate writes no log output across 30 ready/failed requests', writes === 0);
  check('silence', 'the silent ready requests still proceeded exactly once each',
    readyRecords.every((r) => r.nextCalls === 1));
  check('silence', 'the silent failed requests still produced the exact 503',
    failedRecords.every((r) => isExactUnavailable(r)));
}

/* ---------------- 9. real Express downstream-error propagation ----------------
   The gate uses then(onReady, onUnavailable) — two SEPARATE handlers — rather
   than .then(...).catch(...). Only a rejection of the readiness promise may
   reach the 503 path; an error raised downstream of next() must reach the
   application's own Express error handler untouched.

   This is a REAL Express integration test (database-free, loopback only, OS-
   assigned port) rather than a synthetic direct middleware call: it exercises
   the actual Layer error plumbing for both a synchronous throw and a rejected
   async handler, so it proves genuine propagation instead of merely proving
   that an artificially-created rejection was absorbed. No unhandled-rejection
   absorber is installed anywhere in this probe. */
async function sectionExpressErrorPropagation() {
  const SYNTHETIC_BODY = '{"success":false,"message":"Synthetic downstream failure."}';
  // Constructed at runtime so the source-level assertion below cannot match
  // its own literal.
  const ABSORBER_NEEDLE = 'process.on(\'unhandled' + 'Rejection\'';
  const rejectionListenersBefore = process.listenerCount('unhandledRejection');

  let initCalls = 0;
  let releaseInit = null;
  const pendingInit = new Promise((resolve) => { releaseInit = resolve; });
  const store = {
    init() { initCalls += 1; return pendingInit; },
  };

  const readiness = createSessionReadiness(store);

  let syncEntries = 0;
  let asyncEntries = 0;
  let handlerCalls = 0;

  /* Deterministic arrival barrier. A probe-only counting middleware mounted
     IMMEDIATELY BEFORE the readiness gate resolves `barrier` once BOTH test
     requests have actually reached that boundary. This replaces a blind sleep:
     the pending-state assertions below run because the requests are provably
     parked at the gate, not because a timer happened to expire. */
  let arrivals = 0;
  let resolveBarrier = null;
  const barrier = new Promise((resolve) => { resolveBarrier = resolve; });

  const app = express();
  app.use((req, res, next) => {
    arrivals += 1;
    if (arrivals >= 2 && resolveBarrier) { resolveBarrier(); resolveBarrier = null; }
    next();
  });
  app.use(readiness.middleware);
  app.get('/r3-sync', () => {
    syncEntries += 1;
    throw new Error(CANARY);
  });
  app.get('/r3-async', async () => {
    asyncEntries += 1;
    throw new Error(CANARY);
  });
  // Terminal error handler: fixed synthetic body, never the thrown canary.
  app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    handlerCalls += 1;
    res.status(500);
    res.type('application/json');
    res.send(SYNTHETIC_BODY);
  });

  let server = null;
  let syncResult = null;
  let asyncResult = null;
  let barrierTimer = null;
  let released = false;
  const controllers = [];
  const release = () => { if (!released) { released = true; releaseInit(); } };

  try {
    server = await new Promise((resolve, reject) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
      s.once('error', reject);
    });
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;

    // A hung request must FAIL a check rather than hang the probe. The
    // controller is retained so an outstanding request can be aborted in
    // finally.
    const get = async (p) => {
      const controller = new AbortController();
      controllers.push(controller);
      try {
        const res = await fetch(base + p, { signal: controller.signal });
        return { status: res.status, body: await res.text() };
      } catch (e) {
        return { status: 0, body: '' };
      }
    };

    // Fire both requests while readiness is still PENDING.
    const syncPending = get('/r3-sync');
    const asyncPending = get('/r3-async');

    /* Wait for the BARRIER, not for a duration. The timeout exists purely as
       hang protection: if it wins, the barrier check fails rather than the
       pending assertions being sequenced by a timer. */
    let barrierReached = false;
    const barrierTimeout = new Promise((resolve) => {
      barrierTimer = setTimeout(() => resolve('timeout'), 5000);
    });
    const outcome = await Promise.race([barrier.then(() => 'barrier'), barrierTimeout]);
    barrierReached = outcome === 'barrier';
    check('express', 'both requests deterministically reached the readiness boundary',
      barrierReached === true && arrivals === 2);

    check('express', 'downstream routes are NOT entered while readiness is pending',
      syncEntries === 0 && asyncEntries === 0);
    check('express', 'the error handler is NOT reached while readiness is pending',
      handlerCalls === 0);
    check('express', 'initialization stays single-flight while both requests are parked',
      initCalls === 1);

    release();
    syncResult = await syncPending;
    asyncResult = await asyncPending;

    check('express', 'exactly one initialization backed both held requests', initCalls === 1);
    check('express', 'each downstream route is entered exactly once after readiness',
      syncEntries === 1 && asyncEntries === 1);
    check('express', 'a synchronous route throw reaches the Express error handler (fixed 500)',
      syncResult.status === 500 && syncResult.body === SYNTHETIC_BODY);
    check('express', 'a rejected async route reaches the Express error handler (fixed 500)',
      asyncResult.status === 500 && asyncResult.body === SYNTHETIC_BODY);
    check('express', 'neither downstream error was converted into the readiness 503',
      syncResult.body !== EXPECTED_BODY && asyncResult.body !== EXPECTED_BODY);
    check('express', 'the error handler ran once per failing request', handlerCalls === 2);
    check('express', 'neither response leaks the thrown canary',
      !containsCanary(syncResult.body) && !containsCanary(asyncResult.body));
  } finally {
    // Idempotently release any still-pending initialization so nothing can
    // stay parked at the gate, abort outstanding requests, clear the hang
    // guard, then close the exact listener.
    release();
    for (const c of controllers) { try { c.abort(); } catch (e) { /* already settled */ } }
    if (barrierTimer) { clearTimeout(barrierTimer); barrierTimer = null; }
    if (server) {
      await new Promise((resolve) => server.close(() => resolve()));
    }
  }

  check('express', 'the probe listener was closed and is no longer listening',
    server !== null && server.listening === false);
  check('express', 'no unhandled-rejection absorber was installed at runtime',
    process.listenerCount('unhandledRejection') === rejectionListenersBefore);
  check('express', 'the probe source installs no unhandled-rejection absorber',
    !fs.readFileSync(__filename, 'utf8').includes(ABSORBER_NEEDLE));
}

/* ---------------- 10. static wiring ---------------- */
function sectionWiring() {
  const src = fs.readFileSync(SERVER_PATH, 'utf8');
  const readiness = fs.readFileSync(READINESS_PATH, 'utf8');

  const iPreflightImport = src.indexOf("require('./config/vercelProductionProfile')");
  const iPreflightCall = src.indexOf('assertVercelProductionProfile(process.env)');
  const iDotenv = src.indexOf("require('dotenv').config");
  const projectImports = [
    "require('./config/authDataSource')",
    "require('./config/mapRuntime')",
    "require('./middleware/roleAuth')",
    "require('./config/db')",
    "require('./config/sessionConfig')",
    "require('./services/mysqlSessionStore')",
    "require('./services/supabaseSessionStore')",
    "require('./services/sessionReadiness')",
    "require('./routes/index')",
    "require('./controllers/profileController')",
  ].map((s) => src.indexOf(s));

  check('wiring', 'R2 invariant: the preflight import precedes its process.env call',
    iPreflightImport !== -1 && iPreflightCall !== -1 && iPreflightImport < iPreflightCall);
  check('wiring', 'R2 invariant: the preflight call still precedes the dotenv load',
    iDotenv !== -1 && iPreflightCall < iDotenv);
  check('wiring', 'R2 invariant: dotenv still precedes every side-effectful project import',
    projectImports.every((i) => i !== -1 && iDotenv < i));

  const iCspNonce = src.indexOf('app.use(cspNonce)');
  const iHeaders = src.indexOf('app.use(securityHeaders)');
  const iGate = src.indexOf('app.use(sessionReadiness.middleware)');
  const iLimiter = src.indexOf('app.use(preParseAuthLimiter)');
  const iUrlencoded = src.indexOf('app.use(express.urlencoded(');
  const iJson = src.indexOf('app.use(express.json())');
  const iStatic = src.indexOf('express.static(');
  const iSession = src.indexOf('app.use(session(');
  const iNoStore = src.indexOf('app.use(authenticatedHtmlNoStore)');
  const iCsrf = src.indexOf('app.use(attachCsrfToken)');
  const iLogger = src.indexOf('app.use(logger)');
  const iRoutes = src.indexOf("app.use('/', indexRoutes)");
  const iNotFound = src.indexOf('app.use(notFound)');

  check('wiring', 'the security headers are mounted before the readiness gate',
    iCspNonce !== -1 && iHeaders !== -1 && iGate !== -1 && iCspNonce < iHeaders && iHeaders < iGate);
  check('wiring', 'the readiness gate precedes rate limiting and the body parsers',
    iGate < iLimiter && iGate < iUrlencoded && iGate < iJson);
  check('wiring', 'the readiness gate precedes static serving and express-session',
    iGate < iStatic && iGate < iSession);
  check('wiring', 'the readiness gate precedes the authenticated/CSRF/logger middleware',
    iGate < iNoStore && iGate < iCsrf && iGate < iLogger);
  check('wiring', 'the readiness gate precedes the routes and the error handlers',
    iGate < iRoutes && iGate < iNotFound);
  check('wiring', 'OFF.1 ordering survives: static before session, no-store between session and routes',
    iStatic < iSession && iSession < iNoStore && iNoStore < iRoutes);

  const gateMounts = (src.match(/app\.use\(sessionReadiness\.middleware\)/g) || []).length;
  const coordinators = (src.match(/createSessionReadiness\(/g) || []).length;
  check('wiring', 'exactly one readiness coordinator is constructed in server.js', coordinators === 1);
  check('wiring', 'the readiness gate is mounted exactly once', gateMounts === 1);

  /* Anchor on the real call site `app.listen(PORT` — a bare 'app.listen('
     substring also matches the explanatory comment above the gate, which
     would make this assertion pass or fail for the wrong reason. */
  const iWhenReadyAwait = src.indexOf('await sessionReadiness.whenReady()');
  const iListen = src.indexOf('app.listen(PORT');
  const listenCalls = (src.match(/app\.listen\(PORT/g) || []).length;
  check('wiring', 'start() awaits the shared readiness promise before app.listen(PORT ...)',
    iWhenReadyAwait !== -1 && iListen !== -1 && iWhenReadyAwait < iListen);
  check('wiring', 'server.js opens exactly one listener call site', listenCalls === 1);
  check('wiring', 'server.js no longer calls sessionStore.init() directly',
    src.indexOf('sessionStore.init()') === -1);

  const iGuard = src.indexOf('require.main === module');
  const iStartCall = src.indexOf('start().catch(');
  check('wiring', 'start() is invoked only under require.main === module',
    iGuard !== -1 && iStartCall !== -1 && iGuard < iStartCall);
  check('wiring', 'module.exports = app is preserved', /module\.exports\s*=\s*app;/.test(src));
  check('wiring', 'the fixed local failure log is present exactly once',
    (src.split(LOCAL_FAILURE_LOG).length - 1) === 1);

  check('wiring', 'the fixed 503 literal is defined in the readiness module',
    readiness.includes(EXPECTED_BODY));
  check('wiring', 'the fixed 503 literal does not appear in server.js', !src.includes(EXPECTED_BODY));

  const leaked = [];
  for (const dir of ['middleware', 'controllers', 'routes', 'config']) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const name of fs.readdirSync(abs)) {
      if (!name.endsWith('.js')) continue;
      if (fs.readFileSync(path.join(abs, name), 'utf8').includes(EXPECTED_BODY)) leaked.push(name);
    }
  }
  check('wiring', 'the fixed 503 literal exists only in the readiness implementation', leaked.length === 0);

  check('wiring', 'the readiness module arms no timeout/interval of its own',
    !/setTimeout\s*\(/.test(readiness) && !/setInterval\s*\(/.test(readiness));
  check('wiring', 'the readiness module starts exactly one init attempt',
    (readiness.match(/sessionStore\.init\(\)/g) || []).length === 1);
  check('wiring', 'the readiness module logs nothing',
    !/console\.(log|warn|error|info|debug)\s*\(/.test(readiness));
}

/* ---------------- 11. subprocess: import opens no listener ---------------- */
function childEnv(extra) {
  const env = Object.assign({}, process.env, {
    NODE_ENV: 'development',
    SESSION_STORE: 'memory',
  }, extra || {});
  delete env.VERCEL; // force the non-Vercel path for these cases
  return env;
}

function sectionImportNoListener() {
  const code = `require(${JSON.stringify(SERVER_PATH)}); console.log('R3_IMPORTED_NO_LISTENER');`;
  const r = spawnSync(process.execPath, ['-e', code], {
    cwd: ROOT, env: childEnv(), encoding: 'utf8', timeout: 20000,
  });
  const out = String(r.stdout || '') + String(r.stderr || '');

  check('import', 'importing server.js exits promptly and cleanly (no hung listener)',
    r.status === 0 && r.signal === null);
  check('import', 'the imported module reached the end of evaluation',
    out.includes('R3_IMPORTED_NO_LISTENER'));
  check('import', 'the import opened no listener (no server-running banner)', !out.includes(LISTEN_BANNER));
  check('import', 'the import printed no readiness/startup failure line', !out.includes(LOCAL_FAILURE_LOG));
  check('import', 'the import printed no canary', !containsCanary(out));
}

/* ---------------- 12. subprocess: real listener on a free port ---------------- */
function portIsFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => tester.close(() => resolve(true)));
    tester.listen(port, '127.0.0.1');
  });
}

async function waitForAuth(base, attempts, delayMs) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(base + '/auth');
      if (res.status === 200) { await res.text(); return true; }
      await res.text();
    } catch (e) { /* not up yet */ }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

async function sectionRealListener() {
  const PORT = 3487; // dedicated to this probe
  const base = `http://127.0.0.1:${PORT}`;

  const freeBefore = await portIsFree(PORT);
  check('listener', 'the dedicated probe port is confirmed free before launch', freeBefore === true);
  if (!freeBefore) return;

  let child = null;
  let exited = false;
  let reachable = false;
  let out = '';

  try {
    child = spawn(process.execPath, ['server.js'], {
      cwd: ROOT, env: childEnv({ PORT: String(PORT) }), stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (d) => { out += String(d); });
    child.stderr.on('data', (d) => { out += String(d); });
    child.once('exit', () => { exited = true; });

    reachable = await waitForAuth(base, 60, 300);
    check('listener', 'the local entry point opens a listener and answers GET /auth with 200',
      reachable === true);
    check('listener', 'the listener started only after readiness (startup banner present)',
      out.includes(LISTEN_BANNER));
    check('listener', 'the local run printed no readiness/startup failure line',
      !out.includes(LOCAL_FAILURE_LOG));
  } finally {
    if (child && !exited) {
      try { child.kill('SIGTERM'); } catch (e) { /* already gone */ }
      for (let i = 0; i < 40 && !exited; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (!exited) { try { child.kill('SIGKILL'); } catch (e) { /* already gone */ } }
    }
    await new Promise((r) => setTimeout(r, 400)); // let the port release
  }

  check('listener', 'the exact spawned PID was stopped (no stray child remains)', exited === true);

  const freeAfter = await portIsFree(PORT);
  check('listener', 'the dedicated probe port is released after teardown', freeAfter === true);
  check('listener', 'the child output printed no canary', !containsCanary(out));
}

/* ---------------- run ---------------- */
async function main() {
  console.log('=== CampuSphere M12.P1-R3 awaited runtime / session bootstrap probe (database-free) ===');

  await sectionResolve();
  await sectionPending();
  await sectionConcurrent();
  await sectionRejected();
  await sectionSyncThrow();
  await sectionNoRetry();
  await sectionSingleResource();
  await sectionSilence();
  await sectionExpressErrorPropagation();
  sectionWiring();
  sectionImportNoListener();
  await sectionRealListener();

  if (failures.length) {
    console.error(`\nVERCEL-RUNTIME-SESSION-BOOTSTRAP-PROBE FAILED: ${failures.length} check(s) did not pass.`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`\nVERCEL-RUNTIME-SESSION-BOOTSTRAP-PROBE OK: ${checks}/${checks} checks passed.`);
  }
}

main().catch((e) => {
  // Fixed sanitized failure only — never a stack, value, or backend detail.
  console.error('VERCEL-RUNTIME-SESSION-BOOTSTRAP-PROBE FAILED: sanitized harness failure.');
  process.exitCode = 1;
});
