'use strict';

/* ========================================
   CampuSphere — Rate-limit counter storage boundary (M12.P1-R4)

   The ONE place that decides WHERE a rate-limit counter lives and HOW it is
   incremented. `middleware/rateLimit.js` owns scopes, limits, windows, and the
   429/503 response contracts; this module owns storage only.

   Adapter selection (per process/module lifetime, never per request):
     - VERCEL=1  -> the SHARED Upstash Redis counter. Vercel runs many
                    independent serverless instances, so a process-local Map
                    would let each instance keep its own counter and multiply
                    the effective limit. There is NO local fallback here: if
                    the shared store is unreachable, rejects the command, or
                    returns a malformed reply, the caller fails closed.
     - otherwise -> the original in-memory fixed-window Map (local
                    development / container rehearsal, single process).

   Atomicity (the reason this is EVAL and not a pipeline):
     @upstash/redis pipelines are explicitly NOT atomic — its own docs state
     "commands sent by other clients can interleave with the pipeline". An
     INCR followed by a separate PEXPIRE could therefore interleave with
     another instance and lose the expiry, leaving a counter that never
     resets. INCREMENT_SCRIPT below runs INCR + PTTL + conditional PEXPIRE
     inside ONE server-side Lua EVAL, which Redis executes as a single
     uninterruptible unit, and returns the authoritative TTL the caller needs
     for Retry-After. Verified against the installed @upstash/redis@1.38.0
     declarations: `eval(script, keys, args) => Promise<TData>`.

   Privacy: only an HMAC-SHA-256 digest ever reaches storage. Raw IPs,
   emails, user IDs, cookies, session IDs, tokens, secrets, and submitted
   content are hashed inside `consume()` and never passed to an adapter, a
   Redis key, a Redis value, or any log. Redis VALUES are a bare integer
   counter — nothing else is written. This module logs NOTHING.
   ======================================== */

const crypto = require('crypto');

/* Versioned, deliberately NON-sensitive key namespace. A visible namespace and
   scope label are allowed by the R4 contract; the identity component is not. */
const KEY_NAMESPACE = 'csrl';
const KEY_VERSION = 'v1';

/* The exact sanitized unavailable payload for a shared-store failure. Written
   as a literal (not JSON.stringify) so the serialized bytes are pinned and
   cannot drift with key ordering or a future field addition.

   This intentionally RESTATES the sanitized-unavailable convention rather than
   importing it from services/sessionReadiness.js: R4 must not couple its
   failure path to R3's readiness coordinator, and neither module may be able
   to change the other's response contract by editing its own constant. */
const RATE_LIMIT_UNAVAILABLE_BODY = '{"success":false,"message":"Service temporarily unavailable."}';

/**
 * Storage failure marker. Carries NO cause, message detail, key, command,
 * response, or backend identity — constructing it can never capture one.
 */
class RateLimitStoreError extends Error {
  constructor() {
    super('Rate limit storage is unavailable.');
    this.name = 'RateLimitStoreError';
  }
}

/* ---------------- key derivation ---------------- */

/**
 * Unambiguous component framing. Each part is prefixed with its UTF-8 byte
 * length, so no combination of component values can produce the same material
 * as a different combination: ['a|b'] frames as `3:a|b` while ['a','b'] frames
 * as `1:a|1:b`. Without this, a separator-bearing email or scope name could
 * collide two distinct buckets into one.
 */
function frameComponents(parts) {
  return parts
    .map((part) => {
      const value = String(part == null ? '' : part);
      return Buffer.byteLength(value, 'utf8') + ':' + value;
    })
    .join('|');
}

/**
 * Derive the opaque bucket identifier that is the ONLY identity-derived value
 * allowed to reach storage.
 *
 * The namespace, version, and scope are part of the HMAC material as well as
 * the visible key, so two limiter scopes can never share a bucket even if
 * their identity components are byte-identical (e.g. the pre-body `profileip`
 * IP bucket and the identity-aware `profile` bucket for the same request).
 *
 * @param {string} scope limiter scope label (non-sensitive).
 * @param {string[]} components identity components (SENSITIVE; never stored).
 * @param {string|null} secret RATE_LIMIT_KEY_SECRET, required on Vercel.
 * @returns {string} hex digest
 */
function deriveBucketId(scope, components, secret) {
  const material = frameComponents([KEY_NAMESPACE, KEY_VERSION, scope].concat(components || []));
  if (typeof secret === 'string' && secret !== '') {
    return crypto.createHmac('sha256', secret).update(material, 'utf8').digest('hex');
  }
  /* Local development only. The shared Vercel store ALWAYS has a secret (the
     production preflight refuses to start without a >=32-character one), so
     this unkeyed path can never derive a key that is persisted to Redis. */
  return crypto.createHash('sha256').update(material, 'utf8').digest('hex');
}

/** Visible storage key. Contains only the namespace, version, scope, digest. */
function storageKey(scope, bucketId) {
  return KEY_NAMESPACE + ':' + KEY_VERSION + ':' + scope + ':' + bucketId;
}

/* ---------------- the atomic shared-counter script ---------------- */

/* ONE server-side unit of work:
     1. INCR   — create-or-increment the counter, returning the new count.
     2. PTTL   — read the authoritative remaining window in milliseconds.
     3. PEXPIRE when this is the first hit of a window (count == 1) OR the key
        somehow carries no expiry (PTTL -1, e.g. a prior crash between a manual
        INCR and its PEXPIRE). This is the deterministic expiry RECOVERY path:
        a counter can never become immortal, and a live window is never
        extended by later hits (which is what makes the window FIXED, matching
        the in-memory adapter).
   Returns {count, ttlMillis}. Because Redis runs the whole script atomically,
   no other instance can observe or interleave an increment without an
   expiry.

   The `#!lua flags=allow-key-locking` shebang MUST be the first line. Without
   it Upstash runs a Lua script under the GLOBAL database lock, so every
   rate-limit check would serialize against every unrelated command in the
   database. With it, Upstash locks only the keys passed through the KEYS
   array, letting disjoint buckets proceed in parallel. The flag's rule is that
   every key touched by redis.call must appear in KEYS — this script accesses
   KEYS[1] and nothing else, and performs no database-wide write. */
const INCREMENT_SCRIPT = [
  '#!lua flags=allow-key-locking',
  "local count = redis.call('INCR', KEYS[1])",
  "local ttl = redis.call('PTTL', KEYS[1])",
  'if count == 1 or ttl < 0 then',
  "  redis.call('PEXPIRE', KEYS[1], ARGV[1])",
  '  ttl = tonumber(ARGV[1])',
  'end',
  'return {count, ttl}',
].join('\n');

/** Strict integer coercion. Returns null for anything not a finite integer. */
function toInteger(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

/* ---------------- adapters ---------------- */

/**
 * SHARED Upstash adapter (Vercel). `client` may be null when the credentials
 * were absent — every hit then fails closed, exactly like an unreachable
 * store. It NEVER degrades to a local Map.
 */
function createUpstashCounterStore(client) {
  return {
    kind: 'upstash',
    hit(scope, bucketId, windowMs) {
      if (!client || typeof client.eval !== 'function') {
        return Promise.reject(new RateLimitStoreError());
      }
      let pending;
      try {
        pending = client.eval(INCREMENT_SCRIPT, [storageKey(scope, bucketId)], [String(windowMs)]);
      } catch (_) {
        // A synchronous throw is the same failure as a rejected promise.
        return Promise.reject(new RateLimitStoreError());
      }
      return Promise.resolve(pending).then(
        (raw) => {
          /* Malformed or impossible replies fail closed. The rejected value is
             a bare marker: the raw reply is never attached, logged, or
             re-thrown, so a backend error string can never reach a response. */
          if (!Array.isArray(raw) || raw.length < 2) throw new RateLimitStoreError();
          const count = toInteger(raw[0]);
          const ttl = toInteger(raw[1]);
          if (count === null || count < 1) throw new RateLimitStoreError();
          if (ttl === null || ttl < 0) throw new RateLimitStoreError();
          /* Return the AUTHORITATIVE Redis TTL, never a clamp to the configured
             window. PTTL is how long the counter actually stays elevated, so it
             is the only truthful basis for Retry-After. If an operator lowers a
             configured window, pre-existing keys legitimately hold a longer
             TTL; clamping there would tell the caller to retry at a moment when
             the bucket is still over the limit, producing a guaranteed second
             429. Understating the wait is a correctness bug, not a courtesy. */
          return { count, resetMs: ttl };
        },
        () => { throw new RateLimitStoreError(); }
      );
    },
  };
}

/**
 * LOCAL in-memory fixed-window adapter — the pre-R4 behaviour, unchanged:
 * `key -> { count, resetAt }`, reset lazily when the window has passed, with a
 * lazy sweep so the Map cannot grow unbounded. No timer, listener, or worker.
 *
 * One Map is shared by every scope (parity with the single shared Redis
 * keyspace). Scope is part of BOTH the HMAC material and the Map key, so
 * scopes remain isolated exactly as the per-limiter Maps were.
 */
function createMemoryCounterStore() {
  const store = new Map();
  let lastSweep = Date.now();
  return {
    kind: 'memory',
    hit(scope, bucketId, windowMs) {
      const now = Date.now();
      if (now - lastSweep > windowMs) {
        for (const [k, e] of store) {
          if (e.resetAt <= now) store.delete(k);
        }
        lastSweep = now;
      }
      const key = storageKey(scope, bucketId);
      let entry = store.get(key);
      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + windowMs };
        store.set(key, entry);
      }
      entry.count += 1;
      return Promise.resolve({ count: entry.count, resetMs: Math.max(0, entry.resetAt - now) });
    },
    // Test-only visibility; never used by the middleware.
    _size() { return store.size; },
  };
}

/* ---------------- runtime ---------------- */

/**
 * Default Upstash client factory. Required LAZILY so a non-Vercel process
 * never loads the dependency, and so requiring this module has no side effect.
 *
 * `enableTelemetry: false` is a documented constructor option of
 * @upstash/redis@1.38.0 (RedisOptions in its shipped type declarations); it
 * suppresses the SDK's anonymous telemetry headers.
 *
 * `retry: { retries: 0 }` gives EXACTLY ONE transport attempt. Verified
 * against the installed 1.38.0 source, whose request loop is
 * `for (let i = 0; i <= this.retry.attempts; i++)`:
 *   - omitted        -> attempts = 5 -> SIX attempts with exponential backoff;
 *   - `retry: false` -> attempts = 1 -> TWO attempts (it is NOT "no retries");
 *   - `{ retries: 0 }` -> attempts = 0 -> ONE attempt, and the
 *     `if (i < attempts)` backoff branch never runs, so no timer is created.
 * Retrying is wrong for this limiter: a rate-limit check sits in front of the
 * request, so silently re-attempting a failing shared store would multiply
 * latency on every request during an outage instead of failing closed
 * immediately. Fail-closed is the intended behaviour, so the first failure is
 * the answer.
 */
function defaultRedisFactory(config) {
  // eslint-disable-next-line global-require
  const { Redis } = require('@upstash/redis');
  return new Redis({
    url: config.url,
    token: config.token,
    enableTelemetry: false,
    retry: { retries: 0 },
  });
}

function readTrimmed(env, name) {
  const raw = env ? env[name] : undefined;
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Build the rate-limit storage runtime.
 *
 * @param {object} [options]
 * @param {object} [options.env=process.env] environment (read-only).
 * @param {function} [options.redisFactory] injectable client factory — the
 *   seam the focused probe uses to drive the SHARED path with a deterministic
 *   in-memory fake instead of a live Upstash database.
 * @returns {{mode: string, kind: string, consume: function}}
 */
function createRateLimitRuntime(options) {
  const opts = options || {};
  const env = opts.env || process.env;
  const onVercel = String(env && env.VERCEL) === '1';
  const secret = readTrimmed(env, 'RATE_LIMIT_KEY_SECRET');

  let store;
  if (onVercel) {
    const factory = typeof opts.redisFactory === 'function' ? opts.redisFactory : defaultRedisFactory;
    const url = readTrimmed(env, 'UPSTASH_REDIS_REST_URL');
    const token = readTrimmed(env, 'UPSTASH_REDIS_REST_TOKEN');
    let client = null;
    if (url !== '' && token !== '') {
      try {
        client = factory({ url, token });
      } catch (_) {
        // Fail closed: a construction failure must not become a local Map.
        client = null;
      }
    }
    // EXACTLY ONE client for this runtime's lifetime — never one per request.
    store = createUpstashCounterStore(client);
  } else {
    store = createMemoryCounterStore();
  }

  return {
    mode: onVercel ? 'shared' : 'local',
    kind: store.kind,
    /**
     * Count one request against a bucket.
     *
     * @param {string} scope non-sensitive limiter scope label.
     * @param {string[]} components SENSITIVE identity parts. They are hashed
     *   here and NEVER passed to the adapter, so no adapter, fake, capture,
     *   key, or value can observe them.
     * @param {number} windowMs fixed window length.
     * @returns {Promise<{count: number, resetMs: number}>} rejects with
     *   RateLimitStoreError when shared storage is unusable.
     */
    consume(scope, components, windowMs) {
      /* Defence in depth: the SHARED store persists identifiers, so an HMAC key
         is mandatory there. The production preflight already refuses to start
         Vercel without a >= 32-character RATE_LIMIT_KEY_SECRET; this makes the
         requirement STRUCTURAL rather than dependent on that check, so an
         unkeyed digest can never be written to shared storage. */
      if (onVercel && secret === '') {
        return Promise.reject(new RateLimitStoreError());
      }
      let bucketId;
      try {
        bucketId = deriveBucketId(scope, components, secret || null);
      } catch (_) {
        return Promise.reject(new RateLimitStoreError());
      }
      return store.hit(scope, bucketId, windowMs);
    },
    // Test-only visibility; the middleware never reads these.
    _store: store,
  };
}

module.exports = {
  createRateLimitRuntime,
  createUpstashCounterStore,
  createMemoryCounterStore,
  deriveBucketId,
  storageKey,
  frameComponents,
  toInteger,
  RateLimitStoreError,
  RATE_LIMIT_UNAVAILABLE_BODY,
  INCREMENT_SCRIPT,
  KEY_NAMESPACE,
  KEY_VERSION,
};
