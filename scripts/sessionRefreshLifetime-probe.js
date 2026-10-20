'use strict';

/* Isolated HTTP/SDK regression for session refresh ownership. All provider
 * calls use an in-memory fetch; no account, real session or database is used.
 * The platform fixture implements the published @vercel/functions context
 * contract. It models lifetime draining, not Vercel's actual process freezing.
 */
const http = require('node:http');
const { AsyncLocalStorage } = require('node:async_hooks');
const { performance } = require('node:perf_hooks');
const express = require('express');
const session = require('express-session');
const { createClient } = require('@supabase/supabase-js');
const { requestDiagnostics } = require('../utils/requestDiagnostics');

const configPath = require.resolve('../config/supabase');
const previousConfig = require.cache[configPath];
require.cache[configPath] = { id: configPath, filename: configPath, loaded: true,
  exports: { getSupabaseClient() { throw new Error('Real provider disabled.'); } } };
let SupabaseSessionStore;
try { ({ SupabaseSessionStore } = require('../services/supabaseSessionStore')); }
finally {
  if (previousConfig) require.cache[configPath] = previousConfig;
  else delete require.cache[configPath];
}

const CANARY = 'private-fixture-cookie-session-key-provider-error';
const platform = new AsyncLocalStorage();
const contextSymbol = Symbol.for('@vercel/request-context');
const previousContext = globalThis[contextSymbol];
globalThis[contextSymbol] = { get: () => platform.getStore() || {} };
const rows = new Map();
const lines = [];
let queue = [];
let current = null;
let clock = 0;
let checks = 0;
const failures = [];
function check(label, passed) {
  checks += 1;
  console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${label}`);
  if (!passed) failures.push(label);
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const client = createClient('https://synthetic.invalid', 'synthetic-fixture-key-only', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname !== 'synthetic.invalid') throw new Error('External provider prohibited.');
    const sid = (url.searchParams.get('sid') || '').replace(/^eq\./, '');
    if (init.method === 'POST') {
      const row = JSON.parse(init.body); rows.set(row.sid, row);
      return new Response(null, { status: 201 });
    }
    if (init.method === 'GET') return new Response(JSON.stringify(rows.get(sid) || null), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
    if (init.method === 'DELETE') { rows.delete(sid); return new Response(null, { status: 204 }); }
    if (init.method !== 'PATCH') throw new Error('Unexpected provider method.');
    const context = platform.getStore() || { attempts: 0, aborts: 0 };
    context.attempts += 1;
    const mode = queue.shift() || 'ok';
    if (context.disconnect && context.attempts === 1) setImmediate(() => context.request.destroy());
    if (mode === 'authorization') return new Response(JSON.stringify({ message: CANARY }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    });
    if (mode === 'network') throw new TypeError(CANARY);
    if (mode === 'hang') await new Promise((_resolve, reject) => {
      const abort = () => { context.aborts += 1; reject(new DOMException(CANARY, 'AbortError')); };
      if (init.signal.aborted) abort(); else init.signal.addEventListener('abort', abort, { once: true });
    });
    if (mode === 'slow' || mode === 'late') await delay(mode === 'slow' ? 15 : 120);
    if (rows.has(sid)) Object.assign(rows.get(sid), JSON.parse(init.body));
    return new Response(null, { status: 204 });
  } },
});
const store = new SupabaseSessionStore({ client, requestTimeoutMs: 35, retryDelayMs: 5,
  now: () => clock, logger: { warn: line => lines.push(line), info: line => lines.push(line), error: line => lines.push(line) } });
const originalTouch = store.touch.bind(store);
store.touch = (sid, value, callback) => {
  const context = platform.getStore();
  context.expectedExpiry = new Date(value.cookie.expires).getTime();
  originalTouch(sid, value, error => {
    context.callbacks += 1; context.error = Boolean(error); context.callbackAt = performance.now();
    callback(error);
  });
};
const app = express();
app.use(requestDiagnostics);
app.use(session({ secret: 'synthetic-lifetime-probe-secret-only', store,
  resave: false, saveUninitialized: false, cookie: { secure: false, maxAge: 60000 } }));
app.get('/seed', (req, res) => { req.session.user = { id: 17, role: 'guest' }; res.status(204).end(); });
app.all('/probe/:status', (_req, res) => {
  const status = Number(_req.params.status);
  if (status === 302) return res.redirect('/destination');
  res.status(status);
  return status === 200 ? res.json({ ok: true }) : res.end();
});
app.use((error, req, res, next) => {
  const context = platform.getStore(); context.errors += 1;
  if (res.headersSent) {
    if (!res.writableEnded && !res.finished) return next(error);
    return;
  }
  res.status(500).end();
});

async function run() {
  const server = http.createServer((req, res) => {
    const context = current || { tasks: [], attempts: 0, callbacks: 0, aborts: 0, errors: 0 };
    context.waitUntil = promise => context.tasks.push(promise);
    platform.run(context, () => app(req, res));
  });
  let cookie;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const seed = await fetch(base + '/seed'); cookie = String(seed.headers.get('set-cookie')).split(';')[0]; await seed.text();
    check('one disposable session is created by the real middleware and SDK', rows.size === 1 && Boolean(cookie));
    async function request(status, modes, { method = 'GET', disconnect = false } = {}) {
      clock += 60000; queue = [...modes];
      const context = { tasks: [], attempts: 0, callbacks: 0, aborts: 0, errors: 0, disconnect };
      current = context; const start = performance.now();
      const response = await new Promise((resolve, reject) => {
        const req = http.request(base + '/probe/' + status, { method, headers: { Cookie: cookie } }, res => {
          const headersAt = performance.now(); res.resume();
          res.on('end', () => resolve({ status: res.statusCode, headersAt, completeAt: performance.now() }));
        });
        context.request = req;
        req.on('error', error => disconnect && error.code === 'ECONNRESET' ? resolve({ disconnected: true }) : reject(error));
        req.end();
      });
      const pendingAtDisconnect = disconnect && context.callbacks === 0;
      const taskCount = context.tasks.length;
      await Promise.all(context.tasks);
      await new Promise(resolve => setImmediate(resolve));
      current = null;
      return { ...response, context, taskCount, pendingAtDisconnect, duration: performance.now() - start };
    }
    for (const status of [200, 204, 304, 302]) {
      for (const mode of ['healthy', 'recovered', 'failed']) {
        const offset = lines.length;
        const result = await request(status, mode === 'healthy' ? ['slow'] : mode === 'recovered' ? ['hang', 'ok'] : ['hang', 'hang']);
        const context = result.context; const row = [...rows.values()][0];
        const messages = lines.slice(offset);
        check(`${status} ${mode}: response and callback remain intact`, result.status === status && context.callbacks === 1 && context.error === (mode === 'failed'));
        check(`${status} ${mode}: one lifetime includes attempts and callback`, result.taskCount === 1 && context.attempts === (mode === 'healthy' ? 1 : 2));
        check(`${status} ${mode}: abort/diagnostic budget is preserved`, context.aborts === (mode === 'healthy' ? 0 : mode === 'recovered' ? 1 : 2) && messages.length === (mode === 'healthy' ? 0 : 2));
        check(`${status} ${mode}: stored expiry reflects the outcome`, mode === 'failed' ? row.expires_at < context.expectedExpiry : row.expires_at === context.expectedExpiry);
      }
    }
    const head = await request(200, ['slow'], { method: 'HEAD' });
    check('HEAD retains its callback and lifetime', head.status === 200 && head.context.callbacks === 1 && head.taskCount === 1);
    for (const mode of ['healthy', 'recovered', 'failed']) {
      const result = await request(204, mode === 'healthy' ? ['slow'] : mode === 'recovered' ? ['hang', 'ok'] : ['hang', 'hang'], { disconnect: true });
      check(`${mode}: real client closes while refresh is still pending`, result.disconnected && result.pendingAtDisconnect);
      check(`${mode}: invocation cannot retire before callback settlement`, result.taskCount === 1 && result.context.callbacks === 1 && result.context.error === (mode === 'failed'));
    }
    const late = await request(204, ['late', 'ok']); await delay(150);
    check('late first completion does not repeat the callback', late.context.callbacks === 1 && late.context.attempts === 2);
    const authorization = await request(204, ['authorization']);
    check('authorization failure remains one attempt with a sanitized callback', authorization.context.error && authorization.context.attempts === 1 && authorization.context.callbacks === 1);
    const network = await request(204, ['network']);
    check('the real SDK preserves the existing network-error classification', network.context.error && network.context.callbacks === 1 && network.context.attempts === 1);

    const directSid = [...rows.keys()][0]; const directSession = rows.get(directSid).sess;
    const noContext = new SupabaseSessionStore({ client, logger: { info() {}, warn() {}, error() {} } });
    let localCallbacks = 0;
    await new Promise(resolve => noContext.touch(directSid, directSession, error => { localCallbacks += 1; resolve(error); }));
    check('persistent local execution needs no platform lifetime context', localCallbacks === 1);
    const registrationLines = [];
    let registrationClock = 0;
    const throwing = new SupabaseSessionStore({ client, now: () => registrationClock, retainRequest() { throw new Error(CANARY); },
      logger: { error: line => registrationLines.push(line), warn: line => registrationLines.push(line), info: line => registrationLines.push(line) } });
    let throwingCallbacks = 0;
    const registrationErrors = [];
    for (const time of [0, 59999, 60000]) {
      registrationClock = time;
      registrationErrors.push(await platform.run({ tasks: [], attempts: 0, aborts: 0 }, () => new Promise(resolve => throwing.touch(directSid, directSession, error => { throwingCallbacks += 1; resolve(error); }))));
    }
    check('throwing registration preserves success and samples at zero and sixty seconds', throwingCallbacks === 3 && registrationErrors.every(error => !error) && registrationLines.length === 2 && registrationLines.every(line => line.includes('operation=lifetime state=failed')));
    function context() {
      const value = { tasks: [], attempts: 0, aborts: 0 };
      value.waitUntil = promise => value.tasks.push(promise);
      return value;
    }
    const callbackLines = [];
    const callbackStore = new SupabaseSessionStore({ client, logger: { error: line => callbackLines.push(line) } });
    const callbackContext = context(); let thrownCallbacks = 0;
    platform.run(callbackContext, () => callbackStore.touch(directSid, directSession, () => { thrownCallbacks += 1; throw new Error(CANARY); }));
    await Promise.all(callbackContext.tasks);
    check('a throwing callback cannot trigger another callback or leak its error', thrownCallbacks === 1 && callbackLines.length === 1 && !callbackLines[0].includes(CANARY));
    const badLogger = new SupabaseSessionStore({ client, retainRequest() { throw new Error(CANARY); }, logger: { error() { throw new Error(CANARY); } } });
    const badLoggerError = await platform.run(context(), () => new Promise(resolve => badLogger.touch(directSid, directSession, resolve)));
    check('registration and logger failures cannot change a successful refresh', !badLoggerError);

    const a = context(); const b = context(); let aCallbacks = 0; let bCallbacks = 0;
    queue = ['hang', 'ok', 'ok'];
    // Use a short-budget store without the HTTP callback instrumentation.
    const concurrent = new SupabaseSessionStore({ client, requestTimeoutMs: 35, retryDelayMs: 5, logger: { warn() {}, info() {}, error() {} } });
    platform.run(a, () => concurrent.touch(directSid, directSession, () => { aCallbacks += 1; }));
    await new Promise(resolve => setImmediate(resolve));
    platform.run(b, () => concurrent.touch(directSid, directSession, () => { bCallbacks += 1; }));
    await Promise.all(b.tasks);
    check('a faster request owns only its own completed lifetime', bCallbacks === 1 && aCallbacks === 0 && a.tasks.length === 1 && b.tasks.length === 1);
    await Promise.all(a.tasks);
    check('the earlier request retains its retry after the faster request ends', aCallbacks === 1 && a.attempts === 2 && b.attempts === 1);

    const defaultContext = context(); const defaultStarted = performance.now(); let defaultCallbacks = 0; let defaultFailure;
    const defaults = new SupabaseSessionStore({ client, logger: { warn() {}, info() {}, error() {} } });
    queue = ['hang', 'hang'];
    platform.run(defaultContext, () => defaults.touch(directSid, directSession, error => { defaultCallbacks += 1; defaultFailure = error; }));
    await Promise.all(defaultContext.tasks);
    const defaultElapsed = performance.now() - defaultStarted;
    check('unchanged production budgets finish exhausted refreshes in approximately 4.2 seconds', defaultElapsed >= 4150 && defaultElapsed < 5000 && defaultCallbacks === 1 && Boolean(defaultFailure));
    check('default exhaustion still aborts exactly two provider attempts', defaultContext.tasks.length === 1 && defaultContext.attempts === 2 && defaultContext.aborts === 2);

    const expiredSid = 'synthetic-expired-fixture';
    rows.set(expiredSid, { sid: expiredSid, sess: directSession, expires_at: Date.now() - 1 });
    const expired = await new Promise(resolve => defaults.get(expiredSid, (error, value) => resolve({ error, value })));
    await new Promise(resolve => setImmediate(resolve));
    check('expired sessions remain unusable and are removed by existing behavior', !expired.error && expired.value === null && !rows.has(expiredSid));
    const revokedSid = 'synthetic-revoked-fixture'; const siblingSid = 'synthetic-sibling-fixture';
    rows.set(revokedSid, { sid: revokedSid, sess: directSession, expires_at: Date.now() + 60000 });
    rows.set(siblingSid, { sid: siblingSid, sess: directSession, expires_at: Date.now() + 60000 });
    const revokeContext = context(); let revokedCallbacks = 0;
    queue = ['late'];
    platform.run(revokeContext, () => defaults.touch(revokedSid, directSession, () => { revokedCallbacks += 1; }));
    await new Promise(resolve => setImmediate(resolve));
    const logoutError = await new Promise(resolve => defaults.destroy(revokedSid, resolve));
    await Promise.all(revokeContext.tasks);
    const revoked = await new Promise(resolve => defaults.get(revokedSid, (error, value) => resolve({ error, value })));
    check('a late refresh cannot recreate a concurrently logged-out session', !logoutError && revokedCallbacks === 1 && !rows.has(revokedSid) && !revoked.error && revoked.value === null);
    check('logout remains scoped and preserves another session', rows.has(siblingSid) && rows.has(directSid));
    check('diagnostics contain no synthetic secrets or private payloads', !lines.concat(registrationLines).join('\n').includes(CANARY) && !lines.join('\n').includes('synthetic.invalid') && !lines.join('\n').includes(cookie));
    check('no operation/request ID is persisted in session rows', !JSON.stringify([...rows.values()]).includes('operation_id') && !JSON.stringify([...rows.values()]).includes('request_id'));
  } finally {
    current = null;
    await new Promise(resolve => server.close(resolve));
    if (previousContext === undefined) delete globalThis[contextSymbol]; else globalThis[contextSymbol] = previousContext;
  }
  console.log(`SESSION-REFRESH-LIFETIME ${checks - failures.length}/${checks}`);
  if (failures.length) process.exitCode = 1;
}
run().catch(() => { console.error('Session refresh lifetime probe failed.'); process.exitCode = 1; });
