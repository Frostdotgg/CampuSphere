'use strict';

/* ========================================
   CampuSphere — M12.P1-R4 shared rate-limit probe

   Database-free, NETWORK-FREE, self-terminating. It never contacts a real
   Upstash service: the SHARED path is driven through the injectable
   `redisFactory` seam with a deterministic in-memory fake that models the
   REQUIRED atomic operation (INCR + conditional PEXPIRE + PTTL applied as one
   uninterruptible unit) and records every command it receives.

   Concurrency is proven with explicit deferred promises and release barriers —
   never with sleeps, which would prove nothing about ordering.

   Output contract: fixed PASS/FAIL labels only. Canary identities (IP, email,
   user id, token, URL, key secret) are asserted absent from every recorded
   command, storage key, storage value, response body, and captured console
   line. No canary or environment value is ever printed.
   ======================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const {
  createRateLimitRuntime,
  createUpstashCounterStore,
  createMemoryCounterStore,
  deriveBucketId,
  storageKey,
  frameComponents,
  RateLimitStoreError,
  RATE_LIMIT_UNAVAILABLE_BODY,
  INCREMENT_SCRIPT,
} = require('../services/rateLimitStore');

const rateLimit = require('../middleware/rateLimit');
const {
  assertVercelProductionProfile,
  VercelProductionProfileError,
  VERCEL_PROFILE_ERROR_MESSAGE,
  RATE_LIMIT_KEY_SECRET_MIN_LENGTH,
} = require('../config/vercelProductionProfile');

/* ---------------- canaries (test-only, never real credentials) ---------------- */
const runId = Math.random().toString(36).slice(2, 10);
const CANARY_IP = `203.0.113.${(parseInt(runId.slice(0, 2), 36) % 200) + 10}`;
const CANARY_IP_B = `198.51.100.${(parseInt(runId.slice(2, 4), 36) % 200) + 10}`;
const CANARY_EMAIL = `r4canary-${runId}@example.invalid`;
const CANARY_USER_ID = `r4user${runId}`;
const CANARY_TOKEN = `r4-token-${runId}${runId}`;
const CANARY_HOST = `r4-canary-${runId}.upstash.invalid`;
const CANARY_URL = `https://${CANARY_HOST}`;
const CANARY_SECRET = `r4-secret-${runId}${runId}${runId}${runId}`; // >= 32 chars
const CANARY_SECRET_ALT = `r4-alt-${runId}${runId}${runId}${runId}x`;
const CANARIES = [
  CANARY_IP, CANARY_IP_B, CANARY_EMAIL, CANARY_USER_ID,
  CANARY_TOKEN, CANARY_HOST, CANARY_URL, CANARY_SECRET, CANARY_SECRET_ALT,
];

/* ---------------- console capture (for the final leak scan) ---------------- */
const consoleLines = [];
const realLog = console.log.bind(console);
const realError = console.error.bind(console);
console.log = (...a) => { consoleLines.push(a.join(' ')); realLog(...a); };
console.error = (...a) => { consoleLines.push(a.join(' ')); realError(...a); };

const failures = [];
let checks = 0;
function check(scope, label, ok) {
  checks += 1;
  const pass = ok === true;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!pass) failures.push(`${scope} :: ${label}`);
}
function hasCanary(text) {
  const s = String(text == null ? '' : text);
  return CANARIES.some((c) => s.includes(c));
}

/* ---------------- deferred / barrier helpers (no sleeps) ---------------- */
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
// Drain the microtask queue deterministically (no timers, no wall-clock waits).
function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

/* ---------------- the deterministic atomic fake ----------------
   `keyspace` is the SHARED Upstash database. Multiple fake clients built over
   the SAME keyspace model multiple serverless instances of one deployment.

   The mutation is applied SYNCHRONOUSLY inside eval() — exactly like Redis
   running a Lua script as one uninterruptible unit — while only the RESPONSE
   is deferred. That is what makes a lost update impossible and what a
   non-atomic pipeline could not guarantee. */
function createKeyspace() {
  return { map: new Map(), now: 0, commands: [] };
}

function createFakeRedis(keyspace, opts) {
  const options = opts || {};
  return {
    eval(script, keys, args) {
      keyspace.commands.push({ script, keys: keys.slice(), args: args.slice() });
      if (options.throwSync) throw new Error('fake sync transport failure');
      if (options.rejectAll) return Promise.reject(new Error('fake unreachable transport'));

      let reply;
      if (Object.prototype.hasOwnProperty.call(options, 'malformedReply')) {
        reply = options.malformedReply;
      } else {
        // ---- the atomic unit ----
        const key = keys[0];
        const windowMs = Number(args[0]);
        let entry = keyspace.map.get(key);
        if (entry && entry.expireAt !== null && entry.expireAt <= keyspace.now) {
          keyspace.map.delete(key);
          entry = undefined;
        }
        if (!entry) {
          entry = { count: 0, expireAt: null };
          keyspace.map.set(key, entry);
        }
        entry.count += 1;                                    // INCR
        let ttl = entry.expireAt === null ? -1 : entry.expireAt - keyspace.now; // PTTL
        if (entry.count === 1 || ttl < 0) {
          entry.expireAt = keyspace.now + windowMs;          // PEXPIRE
          ttl = windowMs;
        }
        reply = [entry.count, ttl];
        // ---- end atomic unit ----
      }

      if (options.gate) return options.gate(reply);
      return Promise.resolve(reply);
    },
  };
}

function vercelEnv(overrides) {
  const env = {
    VERCEL: '1',
    UPSTASH_REDIS_REST_URL: CANARY_URL,
    UPSTASH_REDIS_REST_TOKEN: CANARY_TOKEN,
    RATE_LIMIT_KEY_SECRET: CANARY_SECRET,
  };
  for (const [k, v] of Object.entries(overrides || {})) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
  return env;
}

/* ---------------- mock req/res ---------------- */
function mockReq(overrides) {
  return Object.assign({
    method: 'POST',
    path: '/login',
    originalUrl: '/login',
    ip: CANARY_IP,
    xhr: false,
    headers: {},
    body: {},
    session: {},
    get(name) { return this.headers[String(name).toLowerCase()] || ''; },
  }, overrides || {});
}

function mockRes() {
  const res = {
    statusCode: null,
    headers: {},
    body: null,
    rendered: null,
    contentType: null,
    headersSent: false,
    locals: {},
    status(code) { this.statusCode = code; return this; },
    set(name, value) { this.headers[String(name).toLowerCase()] = String(value); return this; },
    type(t) { this.contentType = t; return this; },
    send(payload) { this.body = payload; this.headersSent = true; return this; },
    json(payload) { this.body = JSON.stringify(payload); this.jsonPayload = payload; this.headersSent = true; return this; },
    render(view, locals) { this.rendered = { view, locals }; this.headersSent = true; return this; },
  };
  return res;
}

// Run one middleware invocation to completion; report exactly what happened.
async function invoke(mw, req, res) {
  let nextCalls = 0;
  let nextErr;
  mw(req, res, (e) => { nextCalls += 1; if (e) nextErr = e; });
  await flush();
  return { nextCalls, nextErr, res };
}

async function main() {
  console.log('=== CampuSphere M12.P1-R4 shared rate-limit probe (database-free, network-free) ===');

  /* ---------------- 1. dependency pin + runtime import ---------------- */
  {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const declared = (pkg.dependencies || {})['@upstash/redis'];
    check('dependency', 'package.json pins @upstash/redis to EXACTLY 1.38.0 (no range/caret)',
      declared === '1.38.0');
    check('dependency', 'no @upstash/ratelimit or alternative limiter dependency was added',
      !Object.prototype.hasOwnProperty.call(pkg.dependencies || {}, '@upstash/ratelimit') &&
      !Object.prototype.hasOwnProperty.call(pkg.dependencies || {}, 'rate-limit-redis') &&
      !Object.prototype.hasOwnProperty.call(pkg.dependencies || {}, 'express-rate-limit') &&
      !Object.prototype.hasOwnProperty.call(pkg.dependencies || {}, 'ioredis'));

    const installed = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'node_modules', '@upstash', 'redis', 'package.json'), 'utf8'));
    check('dependency', 'installed @upstash/redis reports version 1.38.0', installed.version === '1.38.0');

    const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
    const lockEntry = (lock.packages || {})['node_modules/@upstash/redis'];
    check('dependency', 'package-lock.json records @upstash/redis 1.38.0',
      !!lockEntry && lockEntry.version === '1.38.0');

    let mod = null;
    let importError = null;
    try { mod = require('@upstash/redis'); } catch (e) { importError = e; }
    check('dependency', 'CommonJS require("@upstash/redis") exposes the Redis constructor',
      importError === null && !!mod && typeof mod.Redis === 'function');

    // Constructing a client must not perform I/O; eval/pipeline/multi must exist.
    let client = null;
    try {
      client = new mod.Redis({ url: CANARY_URL, token: CANARY_TOKEN, enableTelemetry: false });
    } catch (_) { client = null; }
    check('dependency', 'client constructs offline and exposes eval(script, keys, args)',
      !!client && typeof client.eval === 'function');
    check('dependency', 'enableTelemetry:false is an accepted documented constructor option',
      !!client);

    const storeSrc = fs.readFileSync(path.join(ROOT, 'services', 'rateLimitStore.js'), 'utf8');
    check('dependency', 'the default client factory disables anonymous telemetry',
      /enableTelemetry:\s*false/.test(storeSrc));
    check('dependency', 'the shared adapter uses eval (never a non-atomic pipeline/multi)',
      /client\.eval\(/.test(storeSrc) && !/\.pipeline\(/.test(storeSrc) && !/\.multi\(/.test(storeSrc));
  }

  /* ---------------- 2. adapter selection ---------------- */
  {
    const shared = createRateLimitRuntime({
      env: vercelEnv(),
      redisFactory: () => createFakeRedis(createKeyspace()),
    });
    check('adapter', 'VERCEL=1 selects the shared Upstash adapter',
      shared.mode === 'shared' && shared.kind === 'upstash');

    let factoryCalls = 0;
    const counted = createRateLimitRuntime({
      env: vercelEnv(),
      redisFactory: () => { factoryCalls += 1; return createFakeRedis(createKeyspace()); },
    });
    await counted.consume('auth', [CANARY_IP], 1000);
    await counted.consume('auth', [CANARY_IP], 1000);
    await counted.consume('auth', [CANARY_IP_B], 1000);
    check('adapter', 'exactly ONE Upstash client is created per runtime, never per request',
      factoryCalls === 1);

    for (const [label, env] of [
      ['VERCEL unset', {}],
      ['VERCEL=0', { VERCEL: '0' }],
      ['VERCEL blank', { VERCEL: '' }],
      ['VERCEL=true', { VERCEL: 'true' }],
    ]) {
      const local = createRateLimitRuntime({
        env: env,
        redisFactory: () => { throw new Error('factory must not be used off Vercel'); },
      });
      check('adapter', `${label} selects the local in-memory adapter`,
        local.mode === 'local' && local.kind === 'memory');
    }

    const noConfig = createRateLimitRuntime({ env: {}, redisFactory: undefined });
    check('adapter', 'non-Vercel runtime needs no Upstash configuration at all',
      noConfig.kind === 'memory');
  }

  /* ---------------- 3. NO local fallback on Vercel ---------------- */
  {
    for (const [label, env] of [
      ['missing URL', vercelEnv({ UPSTASH_REDIS_REST_URL: undefined })],
      ['missing token', vercelEnv({ UPSTASH_REDIS_REST_TOKEN: undefined })],
      ['blank URL', vercelEnv({ UPSTASH_REDIS_REST_URL: '   ' })],
      ['blank token', vercelEnv({ UPSTASH_REDIS_REST_TOKEN: '   ' })],
    ]) {
      const rt = createRateLimitRuntime({ env, redisFactory: () => createFakeRedis(createKeyspace()) });
      let failed = false;
      try { await rt.consume('auth', [CANARY_IP], 1000); } catch (e) { failed = e instanceof RateLimitStoreError; }
      check('no-fallback', `Vercel with ${label} fails closed (never a local Map)`,
        rt.kind === 'upstash' && failed === true);
    }

    /* An unkeyed digest must never reach shared storage, even if the startup
       preflight were somehow bypassed. */
    for (const [label, env] of [
      ['missing key secret', vercelEnv({ RATE_LIMIT_KEY_SECRET: undefined })],
      ['blank key secret', vercelEnv({ RATE_LIMIT_KEY_SECRET: '   ' })],
    ]) {
      const ks = createKeyspace();
      const rt = createRateLimitRuntime({ env, redisFactory: () => createFakeRedis(ks) });
      let failed = false;
      try { await rt.consume('auth', [CANARY_IP], 1000); } catch (e) { failed = e instanceof RateLimitStoreError; }
      check('no-fallback', `Vercel with a ${label} fails closed and writes nothing`,
        failed === true && ks.map.size === 0 && ks.commands.length === 0);
    }

    const throwing = createRateLimitRuntime({
      env: vercelEnv(),
      redisFactory: () => { throw new Error('construction failed'); },
    });
    let ctorFailed = false;
    try { await throwing.consume('auth', [CANARY_IP], 1000); } catch (e) { ctorFailed = e instanceof RateLimitStoreError; }
    check('no-fallback', 'client construction failure on Vercel fails closed, never a local Map',
      throwing.kind === 'upstash' && ctorFailed === true);

    const src = fs.readFileSync(path.join(ROOT, 'services', 'rateLimitStore.js'), 'utf8');
    const vercelBranch = src.slice(src.indexOf('if (onVercel) {'), src.indexOf('} else {'));
    check('no-fallback', 'the Vercel branch never constructs a memory counter store',
      vercelBranch.length > 0 && !vercelBranch.includes('createMemoryCounterStore'));
  }

  /* -------- 3b. REAL SDK zero-retry transport policy (no network) --------
     This exercises the DEFAULT production path — createRateLimitRuntime() with
     NO injected redisFactory, so the genuine @upstash/redis client is built and
     the genuine request loop runs. `global.fetch` is swapped for a synthetic
     rejecting stub inside a strict try/finally, so NO real network request is
     ever performed and the original reference is restored exactly.

     Verified against the installed 1.38.0 request loop
     `for (let i = 0; i <= this.retry.attempts; i++)`:
       omitted -> attempts 5 -> 6 calls; `retry: false` -> attempts 1 -> 2
       calls; `{ retries: 0 }` -> attempts 0 -> exactly 1 call. Asserting the
     call COUNT is what makes this authoritative rather than a source grep. */
  {
    const originalFetch = global.fetch;
    let fetchCalls = 0;
    let outcome = 'never-ran';
    let selected = null;
    try {
      global.fetch = function syntheticFetch() {
        fetchCalls += 1;
        // Rejects immediately; no socket, DNS lookup, or request is performed.
        return Promise.reject(new Error('synthetic transport failure'));
      };
      const rt = createRateLimitRuntime({ env: vercelEnv() }); // real SDK path
      selected = rt.kind;
      try {
        await rt.consume('auth', [CANARY_IP], 60000);
        outcome = 'resolved';
      } catch (e) {
        outcome = (e instanceof RateLimitStoreError) ? 'sanitized' : 'unsanitized';
      }
    } finally {
      global.fetch = originalFetch;
    }
    check('retry', 'the default production runtime builds the REAL Upstash adapter (no fake injected)',
      selected === 'upstash');
    check('retry', 'the real SDK path performs EXACTLY ONE transport attempt (zero retries)',
      fetchCalls === 1);
    check('retry', 'a failed real-SDK attempt surfaces the fixed sanitized store error',
      outcome === 'sanitized');
    check('retry', 'global.fetch was restored to the exact original reference',
      global.fetch === originalFetch);

    /* Source assertions target the CONSTRUCTOR CALL ONLY. Scanning the whole
       file would match this module's own explanatory prose about why
       `retry: false` and a backoff are wrong, so the assertion must read code,
       not comments. */
    const storeSrc = fs.readFileSync(path.join(ROOT, 'services', 'rateLimitStore.js'), 'utf8');
    const ctorStart = storeSrc.indexOf('new Redis({');
    const ctorSrc = ctorStart === -1 ? '' : storeSrc.slice(ctorStart, storeSrc.indexOf('});', ctorStart) + 3);
    check('retry', 'the production constructor explicitly declares retry: { retries: 0 }',
      /retry:\s*\{\s*retries:\s*0\s*\}/.test(ctorSrc));
    check('retry', 'the production constructor does NOT use retry: false (which still allows 2 attempts)',
      ctorSrc.length > 0 && !/retry:\s*false/.test(ctorSrc));
    check('retry', 'no custom backoff is configured on the production client',
      ctorSrc.length > 0 && !/backoff/.test(ctorSrc));
    check('retry', 'the production constructor still disables anonymous telemetry',
      /enableTelemetry:\s*false/.test(ctorSrc));
  }

  /* ---------------- 4. HMAC key privacy ---------------- */
  {
    const a1 = deriveBucketId('login', [CANARY_EMAIL, CANARY_IP], CANARY_SECRET);
    const a2 = deriveBucketId('login', [CANARY_EMAIL, CANARY_IP], CANARY_SECRET);
    const b = deriveBucketId('login', [CANARY_EMAIL, CANARY_IP], CANARY_SECRET_ALT);
    check('hmac', 'same secret + same components -> identical digest (deterministic)', a1 === a2);
    check('hmac', 'different secret -> different digest', a1 !== b);
    check('hmac', 'digest is a 64-char hex SHA-256 HMAC', /^[0-9a-f]{64}$/.test(a1));
    check('hmac', 'digest contains no raw identity component', !hasCanary(a1));

    const scopes = ['auth', 'oauth', 'profileip', 'adminip', 'login', 'profile', 'adminmut'];
    const perScope = scopes.map((s) => deriveBucketId(s, [CANARY_EMAIL, CANARY_IP], CANARY_SECRET));
    check('hmac', 'every limiter scope derives a DISTINCT bucket for identical components',
      new Set(perScope).size === scopes.length);

    const idA = deriveBucketId('login', [CANARY_EMAIL, CANARY_IP], CANARY_SECRET);
    const idB = deriveBucketId('login', [CANARY_EMAIL, CANARY_IP_B], CANARY_SECRET);
    const idC = deriveBucketId('login', ['other@example.invalid', CANARY_IP], CANARY_SECRET);
    check('hmac', 'distinct IPs isolate buckets', idA !== idB);
    check('hmac', 'distinct identities isolate buckets', idA !== idC);

    // Length-prefixed framing: no component split can be forged into another.
    check('hmac', 'component framing is unambiguous (["a|b"] != ["a","b"])',
      frameComponents(['a|b']) !== frameComponents(['a', 'b']) &&
      deriveBucketId('login', ['a|b'], CANARY_SECRET) !== deriveBucketId('login', ['a', 'b'], CANARY_SECRET));
    check('hmac', 'scope+identity concatenation cannot collide across scopes',
      deriveBucketId('a', ['bc'], CANARY_SECRET) !== deriveBucketId('ab', ['c'], CANARY_SECRET));

    const key = storageKey('login', a1);
    check('hmac', 'storage key exposes only namespace/version/scope + digest',
      key === `csrl:v1:login:${a1}` && !hasCanary(key));
  }

  /* ---------------- 5. atomic increment + expiry ---------------- */
  {
    const ks = createKeyspace();
    const rt = createRateLimitRuntime({ env: vercelEnv(), redisFactory: () => createFakeRedis(ks) });

    check('atomic', 'the script issues INCR, PTTL and PEXPIRE in one server-side unit',
      /INCR/.test(INCREMENT_SCRIPT) && /PTTL/.test(INCREMENT_SCRIPT) && /PEXPIRE/.test(INCREMENT_SCRIPT));

    /* ---- key-level locking (not the global database lock) ---- */
    const scriptLines = INCREMENT_SCRIPT.split('\n');
    check('key-lock', 'the allow-key-locking shebang is the EXACT first script line',
      scriptLines[0] === '#!lua flags=allow-key-locking');
    check('key-lock', 'the shebang appears exactly once and never below the first line',
      scriptLines.filter((l) => l.startsWith('#!')).length === 1);
    const keyIndexes = [...new Set([...INCREMENT_SCRIPT.matchAll(/KEYS\[(\d+)\]/g)].map((m) => m[1]))];
    check('key-lock', 'the Lua body accesses ONLY KEYS[1]',
      keyIndexes.length === 1 && keyIndexes[0] === '1');
    /* Parse the actual redis.call argument lists instead of using a negative
       lookahead after `\s*` (which can backtrack to zero width and then match
       the separating space). Each call must be `'CMD', KEYS[1]` with at most a
       trailing ARGV[n] — no second key, no computed key name. */
    const luaCalls = [...INCREMENT_SCRIPT.matchAll(/redis\.call\(([^)]*)\)/g)].map((m) => m[1]);
    check('key-lock', 'every redis.call targets only KEYS[1] (no dynamic or undeclared key)',
      luaCalls.length === 3 &&
      luaCalls.every((args) => /^\s*'[A-Z]+'\s*,\s*KEYS\[1\](\s*,\s*ARGV\[\d+\])?\s*$/.test(args)));
    check('key-lock', 'no database-wide write is possible under allow-key-locking',
      !/FLUSH(DB|ALL)|SCAN|KEYS\s+\*/i.test(INCREMENT_SCRIPT));
    check('key-lock', 'the EVAL receives exactly ONE key',
      ks.commands.length === 0 || ks.commands.every((c) => c.keys.length === 1));

    const first = await rt.consume('auth', [CANARY_IP], 60000);
    check('atomic', 'first hit returns count 1', first.count === 1);
    check('atomic', 'first hit establishes the expiry in the SAME operation', first.resetMs === 60000);
    const storedKey = [...ks.map.keys()][0];
    check('atomic', 'the stored entry carries an expiry immediately after the first hit',
      ks.map.get(storedKey).expireAt === 60000);
    check('atomic', 'exactly ONE command round-trip per counted request', ks.commands.length === 1);

    const second = await rt.consume('auth', [CANARY_IP], 60000);
    check('atomic', 'second hit increments the same bucket', second.count === 2);
    check('atomic', 'a live window is NOT extended by later hits (fixed window)',
      ks.map.get(storedKey).expireAt === 60000 && second.resetMs === 60000);

    // Expiry RECOVERY: a key that somehow lost its TTL gets one back.
    ks.map.get(storedKey).expireAt = null;
    const recovered = await rt.consume('auth', [CANARY_IP], 60000);
    check('atomic', 'a counter with no expiry deterministically recovers one',
      ks.map.get(storedKey).expireAt === 60000 && recovered.resetMs === 60000 && recovered.count === 3);

    // Fresh window after expiry.
    ks.now = 60001;
    const fresh = await rt.consume('auth', [CANARY_IP], 60000);
    check('atomic', 'a fresh window restarts the count at 1', fresh.count === 1);
    check('atomic', 'the fresh window re-establishes a full expiry', fresh.resetMs === 60000);
    check('atomic', 'every EVAL in this run carried exactly one key',
      ks.commands.length > 0 && ks.commands.every((c) => c.keys.length === 1));
  }

  /* -------- 5b. AUTHORITATIVE TTL (no clamp to the configured window) --------
     PTTL is how long the counter actually stays elevated. If a stored key
     outlives a lowered configured window, clamping Retry-After to the window
     would tell the caller to retry while the bucket is still over the limit —
     a guaranteed second 429. The authoritative TTL must survive intact. */
  {
    const authoritative = createRateLimitRuntime({
      env: vercelEnv(),
      redisFactory: () => createFakeRedis(createKeyspace(), { malformedReply: [9, 120000] }),
    });
    const res = await authoritative.consume('login', [CANARY_EMAIL, CANARY_IP], 60000);
    check('authoritative-ttl', 'a TTL longer than the configured window is returned UNCLAMPED',
      res.count === 9 && res.resetMs === 120000);

    // ... and the middleware turns that into a truthful Retry-After.
    const mwRuntime = { mode: 'shared', kind: 'upstash', consume: () => Promise.resolve({ count: 9, resetMs: 120000 }) };
    const mw = rateLimit._fixedWindow({
      windowMs: 60000, max: 8, scope: 'login', runtime: mwRuntime,
      keyFn: (req) => [req.ip],
    });
    const mwRes = mockRes();
    const mwOut = await invoke(mw, mockReq({ headers: { accept: 'application/json' }, originalUrl: '/api/x' }), mwRes);
    check('authoritative-ttl', 'the middleware emits Retry-After: 120 for a 120000 ms authoritative TTL',
      mwRes.statusCode === 429 && mwRes.headers['retry-after'] === '120' && mwOut.nextCalls === 0);

    // Ordinary same-window behaviour is untouched.
    const ordinary = createRateLimitRuntime({
      env: vercelEnv(),
      redisFactory: () => createFakeRedis(createKeyspace()),
    });
    const o1 = await ordinary.consume('auth', [CANARY_IP], 60000);
    check('authoritative-ttl', 'an ordinary in-window TTL is unchanged',
      o1.count === 1 && o1.resetMs === 60000);
    const shortWindow = createRateLimitRuntime({
      env: vercelEnv(),
      redisFactory: () => createFakeRedis(createKeyspace(), { malformedReply: [2, 1500] }),
    });
    const o2 = await shortWindow.consume('auth', [CANARY_IP], 60000);
    check('authoritative-ttl', 'a TTL shorter than the window is returned unchanged (no floor)',
      o2.resetMs === 1500);

    // Unusable TTLs still fail closed — relaxing the clamp must not relax validation.
    for (const [label, reply] of [
      ['negative TTL', [1, -1]],
      ['non-integer TTL', [1, 1500.5]],
      ['non-numeric TTL', [1, 'soon']],
      ['null TTL', [1, null]],
      ['missing TTL', [1]],
    ]) {
      const bad = createRateLimitRuntime({
        env: vercelEnv(),
        redisFactory: () => createFakeRedis(createKeyspace(), { malformedReply: reply }),
      });
      const badMw = rateLimit._fixedWindow({
        windowMs: 60000, max: 5, scope: 'login', runtime: bad, keyFn: (req) => [req.ip],
      });
      const badRes = mockRes();
      const badOut = await invoke(badMw, mockReq(), badRes);
      check('authoritative-ttl', `${label} still fails closed with the fixed sanitized 503`,
        badRes.statusCode === 503 && badRes.body === RATE_LIMIT_UNAVAILABLE_BODY &&
        badOut.nextCalls === 0 && badRes.headers['retry-after'] === undefined);
    }

    // The local in-memory adapter is unaffected by the clamp removal.
    const local = createRateLimitRuntime({ env: {} });
    const l1 = await local.consume('auth', [CANARY_IP], 60000);
    check('authoritative-ttl', 'local in-memory TTL behaviour is unchanged',
      local.kind === 'memory' && l1.count === 1 && l1.resetMs > 0 && l1.resetMs <= 60000);

    const storeSrc = fs.readFileSync(path.join(ROOT, 'services', 'rateLimitStore.js'), 'utf8');
    check('authoritative-ttl', 'no Math.min clamp against the configured window remains',
      !/Math\.min\(\s*ttl\s*,\s*windowMs\s*\)/.test(storeSrc));
  }

  /* ---------------- 6. shared counters across simulated instances ---------------- */
  {
    const shared = createKeyspace();
    // TWO independent runtimes (two serverless instances) over ONE database.
    const instanceA = createRateLimitRuntime({ env: vercelEnv(), redisFactory: () => createFakeRedis(shared) });
    const instanceB = createRateLimitRuntime({ env: vercelEnv(), redisFactory: () => createFakeRedis(shared) });

    const r1 = await instanceA.consume('login', [CANARY_EMAIL, CANARY_IP], 60000);
    const r2 = await instanceB.consume('login', [CANARY_EMAIL, CANARY_IP], 60000);
    const r3 = await instanceA.consume('login', [CANARY_EMAIL, CANARY_IP], 60000);
    check('shared', 'independent limiter instances observe ONE shared counter',
      r1.count === 1 && r2.count === 2 && r3.count === 3);
    check('shared', 'the shared keyspace holds exactly one bucket for one identity',
      shared.map.size === 1);

    const other = await instanceB.consume('login', [CANARY_EMAIL, CANARY_IP_B], 60000);
    check('shared', 'a different IP starts its own shared bucket',
      other.count === 1 && shared.map.size === 2);

    // ---- concurrency via an explicit barrier (no sleeps) ----
    const ks2 = createKeyspace();
    const pending = [];
    const gate = (reply) => {
      const d = deferred();
      pending.push(() => d.resolve(reply));
      return d.promise;
    };
    const cA = createRateLimitRuntime({ env: vercelEnv(), redisFactory: () => createFakeRedis(ks2, { gate }) });
    const cB = createRateLimitRuntime({ env: vercelEnv(), redisFactory: () => createFakeRedis(ks2, { gate }) });

    const pA = cA.consume('login', [CANARY_EMAIL, CANARY_IP], 60000);
    const pB = cB.consume('login', [CANARY_EMAIL, CANARY_IP], 60000);
    const bucket = [...ks2.map.values()][0];
    check('shared', 'concurrent in-flight requests both applied atomically before any reply',
      pending.length === 2 && bucket.count === 2);
    check('shared', 'no lost update: the shared bucket has exactly one expiry',
      bucket.expireAt === 60000);
    pending.forEach((release) => release());
    const [rA, rB] = await Promise.all([pA, pB]);
    check('shared', 'concurrent replies carry distinct sequential counts',
      new Set([rA.count, rB.count]).size === 2 &&
      Math.min(rA.count, rB.count) === 1 && Math.max(rA.count, rB.count) === 2);

    /* Discriminating control: client-side conditional expiry (INCR, inspect the
       count, then PEXPIRE — i.e. what a non-atomic pipeline forces) can lose the
       expiry permanently. Instance A takes the first hit but is frozen before it
       can issue PEXPIRE; instance B then sees count 2 and correctly declines to
       set the expiry, so the counter becomes immortal and the bucket never
       resets. The atomic EVAL above cannot reach this state, and this control
       proves the assertions above are not trivially true. */
    const naive = { count: 0, expireAt: null };
    const countA = (naive.count += 1);            // A: INCR -> 1
    // A is frozen/timed out here, BEFORE its conditional PEXPIRE round-trip.
    const countB = (naive.count += 1);            // B: INCR -> 2
    if (countB === 1) naive.expireAt = 60000;     // B declines: not the first hit
    check('shared', 'control: non-atomic client-side conditional expiry can lose the window',
      countA === 1 && naive.count === 2 && naive.expireAt === null);
  }

  /* ---------------- 7. middleware boundary, 429 + Retry-After ---------------- */
  {
    const ks = createKeyspace();
    const rt = createRateLimitRuntime({ env: vercelEnv(), redisFactory: () => createFakeRedis(ks) });
    const mw = rateLimit._fixedWindow({
      windowMs: 60000, max: 3, scope: 'login', runtime: rt,
      keyFn: (req) => [String((req.body && req.body.email) || ''), req.ip],
    });

    let allowed = 0;
    let limited = 0;
    let lastRes = null;
    for (let i = 0; i < 4; i++) {
      const res = mockRes();
      const out = await invoke(mw, mockReq({ body: { email: CANARY_EMAIL }, headers: { accept: 'application/json' }, originalUrl: '/api/x' }), res);
      if (out.nextCalls === 1 && res.statusCode === null) allowed += 1;
      if (res.statusCode === 429) { limited += 1; lastRes = { res, out }; }
    }
    check('boundary', 'exactly `max` requests pass and max+1 is rejected',
      allowed === 3 && limited === 1);
    check('boundary', 'a limited request returns 429 and NEVER calls next()',
      !!lastRes && lastRes.out.nextCalls === 0);
    check('boundary', 'the 429 JSON body is the exact fixed sanitized contract',
      !!lastRes && lastRes.res.body === JSON.stringify({ success: false, message: 'Too many requests. Please try again later.' }));
    const ra = lastRes && lastRes.res.headers['retry-after'];
    check('boundary', 'Retry-After is an integer number of seconds, at least 1',
      typeof ra === 'string' && /^\d+$/.test(ra) && parseInt(ra, 10) >= 1);
    check('boundary', 'Retry-After reflects the authoritative remaining window', ra === '60');
    check('boundary', 'no canary reaches the 429 response body or headers',
      !!lastRes && !hasCanary(lastRes.res.body) && !hasCanary(JSON.stringify(lastRes.res.headers)));

    // Browser (HTML) 429.
    const ks2 = createKeyspace();
    const rt2 = createRateLimitRuntime({ env: vercelEnv(), redisFactory: () => createFakeRedis(ks2) });
    const mw2 = rateLimit._fixedWindow({
      windowMs: 60000, max: 1, scope: 'auth', runtime: rt2, keyFn: (req) => [req.ip],
    });
    await invoke(mw2, mockReq({ headers: { accept: 'text/html' } }), mockRes());
    const htmlRes = mockRes();
    const htmlOut = await invoke(mw2, mockReq({ headers: { accept: 'text/html' } }), htmlRes);
    check('boundary', 'a browser 429 renders the fixed error view with statusCode 429',
      htmlRes.statusCode === 429 && !!htmlRes.rendered && htmlRes.rendered.view === 'error' &&
      htmlRes.rendered.locals.statusCode === 429 &&
      htmlRes.rendered.locals.title === '429 — Too Many Requests' &&
      htmlRes.rendered.locals.message === 'Too many requests. Please try again later.');
    check('boundary', 'the browser 429 also carries an integer Retry-After and no next()',
      /^\d+$/.test(htmlRes.headers['retry-after'] || '') && htmlOut.nextCalls === 0);
    check('boundary', 'the browser 429 defines res.locals.user for shared partials',
      htmlRes.locals.user === null);

    // Skipped request (safe method on the admin mutation limiter).
    const skipMw = rateLimit._fixedWindow({
      windowMs: 60000, max: 1, scope: 'adminmut', runtime: rt2,
      keyFn: (req) => (['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? null : [req.ip]),
    });
    const skipRes = mockRes();
    const skipOut = await invoke(skipMw, mockReq({ method: 'GET' }), skipRes);
    check('boundary', 'a skipped (safe-method) request calls next() exactly once and stores nothing',
      skipOut.nextCalls === 1 && skipRes.statusCode === null);
    check('boundary', 'safe admin methods are never counted against the mutation bucket',
      ks2.commands.every((c) => !c.keys[0].includes(':adminmut:')));
  }

  /* ---------------- 8. fixed sanitized 503 on shared-store failure ---------------- */
  {
    const cases = [
      ['unreachable store (rejected command)', { rejectAll: true }],
      ['synchronous transport throw', { throwSync: true }],
      ['malformed reply: not an array', { malformedReply: 'OK' }],
      ['malformed reply: empty array', { malformedReply: [] }],
      ['malformed reply: nulls', { malformedReply: [null, null] }],
      ['malformed reply: non-numeric', { malformedReply: ['abc', 'def'] }],
      ['malformed reply: too short', { malformedReply: [1] }],
      ['malformed reply: zero count', { malformedReply: [0, 1000] }],
      ['malformed reply: negative ttl', { malformedReply: [1, -5] }],
      ['malformed reply: fractional count', { malformedReply: [1.5, 1000] }],
    ];
    for (const [label, opts] of cases) {
      const ks = createKeyspace();
      const rt = createRateLimitRuntime({ env: vercelEnv(), redisFactory: () => createFakeRedis(ks, opts) });
      const mw = rateLimit._fixedWindow({
        windowMs: 60000, max: 5, scope: 'login', runtime: rt, keyFn: (req) => [req.ip],
      });
      const res = mockRes();
      const out = await invoke(mw, mockReq(), res);
      check('fail-closed', `${label} -> fixed sanitized 503`,
        res.statusCode === 503 && res.body === RATE_LIMIT_UNAVAILABLE_BODY);
      check('fail-closed', `${label} -> never calls next()`, out.nextCalls === 0);
      check('fail-closed', `${label} -> Cache-Control: no-store`,
        res.headers['cache-control'] === 'no-store');
      check('fail-closed', `${label} -> body leaks no canary, key, command or backend detail`,
        !hasCanary(res.body) && !/upstash|redis|eval|INCR|PEXPIRE|csrl:/i.test(String(res.body)));
    }

    check('fail-closed', 'the 503 body is the exact pinned literal',
      RATE_LIMIT_UNAVAILABLE_BODY === '{"success":false,"message":"Service temporarily unavailable."}');

    // Repeated outage keeps failing closed — it never "recovers" into a Map.
    const ks = createKeyspace();
    const rt = createRateLimitRuntime({ env: vercelEnv(), redisFactory: () => createFakeRedis(ks, { rejectAll: true }) });
    const mw = rateLimit._fixedWindow({
      windowMs: 60000, max: 1, scope: 'login', runtime: rt, keyFn: (req) => [req.ip],
    });
    let allNextCalls = 0;
    let all503 = true;
    for (let i = 0; i < 5; i++) {
      const res = mockRes();
      const out = await invoke(mw, mockReq(), res);
      allNextCalls += out.nextCalls;
      if (res.statusCode !== 503) all503 = false;
    }
    check('fail-closed', 'a sustained outage never falls back to a local Map or lets a request through',
      all503 === true && allNextCalls === 0 && ks.map.size === 0);

    /* The R4 unavailable literal is DECLARED independently of R3. Match an
       actual require of the readiness module, not a prose mention of it: R4
       must be free to keep the shared sanitized wording while neither module
       can change the other's response contract. */
    const storeSrc = fs.readFileSync(path.join(ROOT, 'services', 'rateLimitStore.js'), 'utf8');
    const mwSrc = fs.readFileSync(path.join(ROOT, 'middleware', 'rateLimit.js'), 'utf8');
    const requiresReadiness = (src) => /require\(\s*['"][^'"]*sessionReadiness[^'"]*['"]\s*\)/.test(src);
    check('fail-closed', 'the R4 failure path does not import or couple to the R3 readiness module',
      !requiresReadiness(storeSrc) && !requiresReadiness(mwSrc));
    check('fail-closed', 'the R4 unavailable body is declared as its own pinned literal',
      /RATE_LIMIT_UNAVAILABLE_BODY\s*=\s*'\{"success":false,"message":"Service temporarily unavailable\."\}'/.test(storeSrc));
  }

  /* ---------------- 9. next() accounting + downstream error propagation ---------------- */
  {
    const ks = createKeyspace();
    const rt = createRateLimitRuntime({ env: vercelEnv(), redisFactory: () => createFakeRedis(ks) });
    const mw = rateLimit._fixedWindow({
      windowMs: 60000, max: 10, scope: 'profile', runtime: rt, keyFn: (req) => [req.ip],
    });
    const res = mockRes();
    const out = await invoke(mw, mockReq(), res);
    check('next-accounting', 'an allowed request calls next() exactly once with no error',
      out.nextCalls === 1 && out.nextErr === undefined && res.statusCode === null);

    /* A counter result whose fields are unusable must fail closed rather than
       emit `Retry-After: NaN`. Driven through a store stub so the guard is
       exercised even though the real adapters cannot produce this shape. */
    for (const [label, bad] of [
      ['non-finite resetMs', { count: 99, resetMs: NaN }],
      ['missing resetMs', { count: 99 }],
      ['non-finite count', { count: NaN, resetMs: 1000 }],
      ['null result', null],
    ]) {
      const stubRuntime = { mode: 'shared', kind: 'upstash', consume: () => Promise.resolve(bad) };
      const stubMw = rateLimit._fixedWindow({
        windowMs: 60000, max: 1, scope: 'login', runtime: stubRuntime, keyFn: (req) => [req.ip],
      });
      const badRes = mockRes();
      const badOut = await invoke(stubMw, mockReq(), badRes);
      check('next-accounting', `an unusable counter result (${label}) fails closed with the fixed 503`,
        badRes.statusCode === 503 && badRes.body === RATE_LIMIT_UNAVAILABLE_BODY &&
        badOut.nextCalls === 0 && badRes.headers['retry-after'] === undefined);
    }

    /* A downstream throw must NOT be reported as a rate-limit 503. In real
       Express the Layer try/catch owns this; here we assert the limiter does
       not convert it into its own response. */
    const throwRes = mockRes();
    let downstreamThrew = false;
    mw(mockReq(), throwRes, () => { downstreamThrew = true; throw new Error('downstream failure'); });
    await flush();
    check('next-accounting', 'a downstream exception is NOT transformed into a rate-limit 503',
      downstreamThrew === true && throwRes.statusCode === null && throwRes.body === null);
  }

  /* ---------------- 10. local in-memory adapter parity ---------------- */
  {
    const rt = createRateLimitRuntime({ env: {} });
    const mw = rateLimit._fixedWindow({
      windowMs: 60000, max: 2, scope: 'auth', runtime: rt, keyFn: (req) => [req.ip],
    });
    const results = [];
    for (let i = 0; i < 3; i++) {
      const res = mockRes();
      const out = await invoke(mw, mockReq({ headers: { accept: 'application/json' }, originalUrl: '/api/x' }), res);
      results.push({ status: res.statusCode, next: out.nextCalls, retry: res.headers['retry-after'] });
    }
    check('local', 'the local adapter enforces the same count boundary',
      results[0].next === 1 && results[1].next === 1 && results[2].next === 0 && results[2].status === 429);
    check('local', 'the local adapter emits an integer Retry-After >= 1',
      /^\d+$/.test(results[2].retry || '') && parseInt(results[2].retry, 10) >= 1);

    const isolated = createRateLimitRuntime({ env: {} });
    const a = await isolated.consume('auth', [CANARY_IP], 60000);
    const b = await isolated.consume('oauth', [CANARY_IP], 60000);
    const c = await isolated.consume('auth', [CANARY_IP_B], 60000);
    check('local', 'local scopes and identities remain isolated',
      a.count === 1 && b.count === 1 && c.count === 1);

    const noSecret = createRateLimitRuntime({ env: {} });
    let ok = false;
    try { await noSecret.consume('auth', [CANARY_IP], 1000); ok = true; } catch (_) { ok = false; }
    check('local', 'local development does NOT require RATE_LIMIT_KEY_SECRET', ok === true);
  }

  /* ---------------- 11. Vercel preflight: the three R4 variables ---------------- */
  {
    function fullEnv(overrides) {
      const env = {
        VERCEL: '1', NODE_ENV: 'production', SESSION_STORE: 'supabase',
        AUTH_DATA_SOURCE: 'supabase', CONTENT_DATA_SOURCE: 'supabase',
        BUILDING_DATA_SOURCE: 'supabase', ROUTE_DATA_SOURCE: 'supabase',
        VR_DATA_SOURCE: 'supabase', SCHEDULE_DATA_SOURCE: 'supabase',
        MAP_RENDERER: 'maplibre',
        SUPABASE_URL: `https://sb-${runId}.supabase.co`,
        SUPABASE_SERVICE_ROLE_KEY: `sb_secret_r4probe${runId}${runId}`,
        UPSTASH_REDIS_REST_URL: CANARY_URL,
        UPSTASH_REDIS_REST_TOKEN: CANARY_TOKEN,
        RATE_LIMIT_KEY_SECRET: CANARY_SECRET,
      };
      for (const [k, v] of Object.entries(overrides || {})) {
        if (v === undefined) delete env[k];
        else env[k] = v;
      }
      return env;
    }
    function expectRejected(label, env) {
      let threw = false, typed = false, fixed = false, leaked = true;
      try { assertVercelProductionProfile(env); } catch (e) {
        threw = true;
        typed = e instanceof VercelProductionProfileError;
        fixed = e.message === VERCEL_PROFILE_ERROR_MESSAGE;
        leaked = hasCanary(e.message);
      }
      check('preflight', `${label} -> fixed sanitized rejection`,
        threw && typed && fixed && leaked === false);
    }

    check('preflight', 'the complete Vercel matrix WITH the R4 variables passes',
      assertVercelProductionProfile(fullEnv()) === true);
    check('preflight', 'the documented minimum key-secret length is 32',
      RATE_LIMIT_KEY_SECRET_MIN_LENGTH === 32);

    expectRejected('UPSTASH_REDIS_REST_URL missing', fullEnv({ UPSTASH_REDIS_REST_URL: undefined }));
    expectRejected('UPSTASH_REDIS_REST_URL blank', fullEnv({ UPSTASH_REDIS_REST_URL: '   ' }));
    expectRejected('UPSTASH_REDIS_REST_URL non-HTTPS', fullEnv({ UPSTASH_REDIS_REST_URL: `http://${CANARY_HOST}` }));
    expectRejected('UPSTASH_REDIS_REST_URL malformed', fullEnv({ UPSTASH_REDIS_REST_URL: 'not a url' }));
    expectRejected('UPSTASH_REDIS_REST_URL without hostname', fullEnv({ UPSTASH_REDIS_REST_URL: 'https://' }));
    expectRejected('UPSTASH_REDIS_REST_URL with embedded credentials',
      fullEnv({ UPSTASH_REDIS_REST_URL: `https://user:pw${runId}@${CANARY_HOST}` }));
    expectRejected('UPSTASH_REDIS_REST_URL with embedded username only',
      fullEnv({ UPSTASH_REDIS_REST_URL: `https://user@${CANARY_HOST}` }));

    expectRejected('UPSTASH_REDIS_REST_TOKEN missing', fullEnv({ UPSTASH_REDIS_REST_TOKEN: undefined }));
    expectRejected('UPSTASH_REDIS_REST_TOKEN blank', fullEnv({ UPSTASH_REDIS_REST_TOKEN: '   ' }));
    expectRejected('UPSTASH_REDIS_REST_TOKEN documented placeholder',
      fullEnv({ UPSTASH_REDIS_REST_TOKEN: 'replace-with-upstash-rest-token' }));
    expectRejected('UPSTASH_REDIS_REST_TOKEN placeholder (cased)',
      fullEnv({ UPSTASH_REDIS_REST_TOKEN: 'REPLACE-WITH-UPSTASH-REST-TOKEN' }));

    expectRejected('RATE_LIMIT_KEY_SECRET missing', fullEnv({ RATE_LIMIT_KEY_SECRET: undefined }));
    expectRejected('RATE_LIMIT_KEY_SECRET blank', fullEnv({ RATE_LIMIT_KEY_SECRET: '   ' }));
    expectRejected('RATE_LIMIT_KEY_SECRET one character', fullEnv({ RATE_LIMIT_KEY_SECRET: 'x' }));
    expectRejected('RATE_LIMIT_KEY_SECRET 31 characters', fullEnv({ RATE_LIMIT_KEY_SECRET: 'a'.repeat(31) }));
    expectRejected('RATE_LIMIT_KEY_SECRET 31 chars padded to 33 with spaces',
      fullEnv({ RATE_LIMIT_KEY_SECRET: ' ' + 'a'.repeat(31) + ' ' }));
    expectRejected('RATE_LIMIT_KEY_SECRET documented placeholder',
      fullEnv({ RATE_LIMIT_KEY_SECRET: 'replace-with-a-long-random-server-only-rate-limit-key-secret' }));
    check('preflight', 'RATE_LIMIT_KEY_SECRET of exactly 32 characters is accepted',
      assertVercelProductionProfile(fullEnv({ RATE_LIMIT_KEY_SECRET: 'a'.repeat(32) })) === true);

    // Non-Vercel must NOT require any of the three.
    for (const name of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'RATE_LIMIT_KEY_SECRET']) {
      const env = fullEnv({ [name]: undefined });
      delete env.VERCEL;
      check('preflight', `non-Vercel does not require ${name}`,
        assertVercelProductionProfile(env) === false);
    }

    // Purity: no network, no dotenv, no side-effectful import.
    const src = fs.readFileSync(path.join(ROOT, 'config', 'vercelProductionProfile.js'), 'utf8');
    check('preflight', 'the preflight remains pure (no require of any module)',
      !/\brequire\s*\(/.test(src));
    check('preflight', 'the preflight performs no network or client construction',
      !/fetch\s*\(|https?\.request|new Redis|@upstash/.test(src));
  }

  /* ---------------- 12. leak scan across every captured surface ---------------- */
  {
    const ks = createKeyspace();
    const rt = createRateLimitRuntime({ env: vercelEnv(), redisFactory: () => createFakeRedis(ks) });
    await rt.consume('login', [CANARY_EMAIL, CANARY_IP], 60000);
    await rt.consume('profile', [CANARY_USER_ID, CANARY_IP_B], 60000);
    await rt.consume('adminmut', [CANARY_USER_ID, CANARY_IP], 60000);

    const commandBlob = JSON.stringify(ks.commands);
    check('leak', 'no raw identity reaches any recorded Redis command',
      !hasCanary(commandBlob));
    check('leak', 'no raw identity reaches any Redis KEY',
      [...ks.map.keys()].every((k) => !hasCanary(k)));
    check('leak', 'no raw identity reaches any Redis VALUE',
      !hasCanary(JSON.stringify([...ks.map.values()])));
    check('leak', 'stored values hold only the minimum counter data',
      [...ks.map.values()].every((v) =>
        Object.keys(v).sort().join(',') === 'count,expireAt' &&
        typeof v.count === 'number'));
    check('leak', 'the RATE_LIMIT_KEY_SECRET never appears in a command, key or value',
      !commandBlob.includes(CANARY_SECRET) &&
      ![...ks.map.keys()].some((k) => k.includes(CANARY_SECRET)));
    check('leak', 'every command targets the versioned csrl:v1 namespace',
      ks.commands.every((c) => /^csrl:v1:[a-z]+:[0-9a-f]{64}$/.test(c.keys[0])));
    check('leak', 'command arguments carry only the window length',
      ks.commands.every((c) => c.args.length === 1 && /^\d+$/.test(c.args[0])));

    const sources = ['services/rateLimitStore.js', 'middleware/rateLimit.js', 'config/vercelProductionProfile.js']
      .map((rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')).join('\n');
    check('leak', 'no live credential, token or URL is embedded in the R4 sources',
      !hasCanary(sources) && !/UPSTASH_REDIS_REST_TOKEN\s*=\s*['"][^'"]+['"]/.test(sources));
    check('leak', 'the R4 sources never log a key, command, reply or store error',
      !/console\.(log|error|warn|info)/.test(
        fs.readFileSync(path.join(ROOT, 'services', 'rateLimitStore.js'), 'utf8')));
  }

  /* ---------------- 13. no listener / timer / handle leak ---------------- */
  {
    const timers = process._getActiveHandles().filter((h) => h && h.constructor &&
      (h.constructor.name === 'Timeout' || h.constructor.name === 'Immediate'));
    check('cleanup', 'no timer handle is left behind by the rate-limit runtime', timers.length === 0);
    check('cleanup', 'no stray process listeners were added',
      process.listenerCount('unhandledRejection') === 0 &&
      process.listenerCount('uncaughtException') === 0);
    const storeSrc = fs.readFileSync(path.join(ROOT, 'services', 'rateLimitStore.js'), 'utf8');
    check('cleanup', 'the store creates no timers, intervals, or listeners',
      !/setInterval|setTimeout|\.on\(|addListener/.test(storeSrc));
  }

  /* ---------------- summary ---------------- */
  const outputBlob = consoleLines.join('\n');
  check('leak', 'no canary value appears anywhere in this probe output', !hasCanary(outputBlob));

  if (failures.length) {
    console.error(`\nSHARED-RATE-LIMIT-PROBE FAILED: ${failures.length} check(s) did not pass.`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`\nSHARED-RATE-LIMIT-PROBE OK: ${checks}/${checks} checks passed.`);
  }
}

main().catch((e) => {
  console.error('[sharedRateLimit-probe] FATAL: ' + (e && e.message ? e.message : 'unknown error'));
  process.exitCode = 1;
});
