'use strict';
/* ========================================
   CampuSphere — Supabase-backed express-session Store (Milestone 9, Section 9.3)

   Server-only. Persists sessions in the Supabase/PostgreSQL `app_sessions`
   table (migration database/supabase/0011_supabase_session_store.sql) via the
   existing server-only Supabase client (config/supabase.js, service role).

   Table shape (from 0011; this module does NOT create it — the migration is
   applied manually in the Supabase SQL editor by the project owner):
     sid        text        PRIMARY KEY
     sess       jsonb       NOT NULL          (the session object itself)
     expires_at bigint      NOT NULL          (epoch ms; indexed)
     created_at timestamptz NOT NULL DEFAULT  (set by the DB default on insert)
     updated_at timestamptz NOT NULL DEFAULT  (refreshed by THIS code on set/touch)

   Mirrors services/mysqlSessionStore.js in shape and privacy posture so the two
   stores are interchangeable behind express-session.

   Privacy: diagnostics contain only a fixed operation/state, a safe failure
   category, an optional numeric HTTP status, an attempt count, a coarse
   elapsed-time bucket, and a server-generated opaque request id. They never
   contain a session id, cookie value, session JSON, Supabase URL/key,
   PostgREST/SQL detail, stack, or raw error. Store-operation failures surface a
   fixed sanitized Error to express-session; init failure throws a fixed
   sanitized Error so the readiness coordinator can fail closed and recover.

   Supabase Auth is NOT used.
   ======================================== */

const session = require('express-session');
const Store = session.Store;
const { performance } = require('node:perf_hooks');
const { getSupabaseClient } = require('../config/supabase');
const {
  elapsedBucket,
  requestCorrelationId,
  safeRequestCorrelationId,
} = require('../utils/requestDiagnostics');

const DEFAULT_TABLE = 'app_sessions';
const DAY_MS = 24 * 60 * 60 * 1000;
const REAP_INTERVAL_MS = 60 * 60 * 1000; // hourly expired-row purge (capped by ttl)
const REQUEST_TIMEOUT_MS = 2000;
const RETRY_DELAY_MS = 200;
const DIAGNOSTIC_WINDOW_MS = 60000;
const FAILURE_CATEGORIES = new Set(['authorization', 'rate-limit', 'upstream', 'timeout', 'network', 'unknown']);

function safeStatus(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 100 && number <= 599 ? number : null;
}

function classifyFailure(value, timedOut = false) {
  const error = value && value.error ? value.error : value;
  const status = safeStatus((value && value.status) || (error && error.status));
  if (error && FAILURE_CATEGORIES.has(error.category)) return { category: error.category, status };
  if (timedOut || (error && (error.name === 'AbortError' || error.code === 'SESSION_STORE_TIMEOUT'))) {
    return { category: 'timeout', status };
  }
  if (status === 401 || status === 403) return { category: 'authorization', status };
  if (status === 429) return { category: 'rate-limit', status };
  if (status === 408) return { category: 'timeout', status };
  if (status !== null && status >= 500) return { category: 'upstream', status };
  const networkCode = error && (error.code || (error.cause && error.cause.code));
  if (error && (error.name === 'TypeError' || networkCode === 'ECONNRESET' || networkCode === 'ECONNREFUSED' || networkCode === 'ENOTFOUND' || networkCode === 'EAI_AGAIN')) {
    return { category: 'network', status };
  }
  return { category: 'unknown', status };
}

function safeError(message, failure) {
  const error = new Error(message);
  error.category = failure && FAILURE_CATEGORIES.has(failure.category) ? failure.category : 'unknown';
  const status = safeStatus(failure && failure.status);
  if (status !== null) error.status = status;
  return error;
}

function sanitizedStoreError(failure) {
  // Fixed message; carries no sid, session JSON, Supabase URL/key, SQL/PostgREST
  // detail, or raw error.
  const error = safeError('Session store operation failed.', failure);
  error.code = 'SESSION_STORE_OPERATION_FAILED';
  return error;
}

function sanitizedInitError(failure) {
  // Fixed message; suitable for fail-closed startup handling (Section 9.4).
  // Never carries Supabase host/key, table name detail, or a raw error.
  const error = safeError('Session store initialization failed.', failure);
  error.code = 'SESSION_STORE_INIT_FAILED';
  return error;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withAbortSignal(query, signal) {
  if (query && signal && typeof query.abortSignal === 'function') return query.abortSignal(signal);
  return query;
}

function isRuntimeRetryable(failure) {
  return failure.category === 'timeout' || failure.category === 'network' ||
    failure.category === 'rate-limit' || failure.category === 'upstream' ||
    failure.status === 408;
}

function utcTimestamp(ms) {
  // timestamptz value for updated_at, set explicitly by application code.
  return new Date(ms).toISOString();
}

class SupabaseSessionStore extends Store {
  constructor({
    client = null,
    tableName = DEFAULT_TABLE,
    ttlMs = DAY_MS,
    requestTimeoutMs = REQUEST_TIMEOUT_MS,
    retryDelayMs = RETRY_DELAY_MS,
    logger = console,
    now = Date.now,
    sleep = wait,
    monotonicNow = () => performance.now(),
    requestIdProvider = requestCorrelationId,
  } = {}) {
    super();
    if (!/^[A-Za-z0-9_]+$/.test(tableName)) {
      throw new Error('SupabaseSessionStore table name must be alphanumeric/underscore.');
    }
    // client is optional: resolved lazily via getSupabaseClient() on first use so
    // constructing the store never throws when Supabase env is absent.
    this.client = client || null;
    this.table = tableName;
    this.ttlMs = ttlMs > 0 ? ttlMs : DAY_MS;
    this.requestTimeoutMs = Number.isFinite(requestTimeoutMs) && requestTimeoutMs > 0
      ? requestTimeoutMs : REQUEST_TIMEOUT_MS;
    this.retryDelayMs = Number.isFinite(retryDelayMs) && retryDelayMs >= 0
      ? retryDelayMs : RETRY_DELAY_MS;
    this.logger = logger && typeof logger === 'object' ? logger : console;
    this._now = typeof now === 'function' ? now : Date.now;
    this._sleep = typeof sleep === 'function' ? sleep : wait;
    this._monotonicNow = typeof monotonicNow === 'function' ? monotonicNow : () => performance.now();
    this._requestIdProvider = typeof requestIdProvider === 'function'
      ? requestIdProvider : requestCorrelationId;
    this._lastDiagnosticAt = new Map();
    this._reapTimer = null;
  }

  // Resolve (and cache) the server-only Supabase client. Throws if Supabase env
  // is not configured; callers wrap this in try/catch and sanitize.
  _getClient() {
    if (this.client) return this.client;
    this.client = getSupabaseClient();
    return this.client;
  }

  _requestId() {
    try { return safeRequestCorrelationId(this._requestIdProvider()); }
    catch (e) { return '-'; }
  }

  _monotonicStart() {
    try {
      const value = Number(this._monotonicNow());
      return Number.isFinite(value) ? value : null;
    } catch (e) {
      return null;
    }
  }

  _elapsedSince(startedAt) {
    if (!Number.isFinite(startedAt)) return null;
    try {
      const elapsed = Number(this._monotonicNow()) - startedAt;
      return Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null;
    } catch (e) {
      return null;
    }
  }

  _diagnostic(operation, state, failure, attempts, { requestId = '-', elapsedMs = null } = {}) {
    const key = `${operation}:${state}:${failure.category}:${failure.status || 0}`;
    const timestamp = this._now();
    const previous = this._lastDiagnosticAt.get(key) || 0;
    if (previous && timestamp - previous < DIAGNOSTIC_WINDOW_MS) return;
    this._lastDiagnosticAt.set(key, timestamp);

    const level = state === 'recovered' ? 'info' : (state === 'failed' ? 'error' : 'warn');
    const writer = this.logger && typeof this.logger[level] === 'function' ? this.logger[level] : null;
    if (!writer) return;
    let line = `[session-store] operation=${operation} state=${state} category=${failure.category}`;
    if (failure.status !== null) line += ` status=${failure.status}`;
    line += ` attempts=${attempts} attempt_elapsed=${elapsedBucket(elapsedMs)}`;
    line += ` request_id=${safeRequestCorrelationId(requestId)}`;
    writer.call(this.logger, line);
  }

  async _requestOnce(makeQuery, { initialization = false, signal: externalSignal = null } = {}) {
    const controller = new AbortController();
    let timer = null;
    let timedOut = false;
    const signals = [controller.signal];
    if (externalSignal && typeof externalSignal.aborted === 'boolean') signals.push(externalSignal);
    const signal = signals.length > 1 && typeof AbortSignal.any === 'function'
      ? AbortSignal.any(signals) : controller.signal;
    const timeout = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(sanitizedStoreError({ category: 'timeout', status: null }));
      }, this.requestTimeoutMs);
    });

    try {
      const request = Promise.resolve().then(() => withAbortSignal(makeQuery(), signal));
      const result = await Promise.race([request, timeout]);
      if (!result || result.error) {
        const failure = classifyFailure(result || null);
        throw initialization ? sanitizedInitError(failure) : sanitizedStoreError(failure);
      }
      return result;
    } catch (error) {
      const failure = classifyFailure(error, timedOut || Boolean(externalSignal && externalSignal.aborted));
      throw initialization ? sanitizedInitError(failure) : sanitizedStoreError(failure);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async _runtimeRequest(operation, makeQuery) {
    let lastFailure = { category: 'unknown', status: null };
    const requestId = this._requestId();
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const startedAt = this._monotonicStart();
      try {
        const result = await this._requestOnce(makeQuery);
        if (attempt > 1) {
          this._diagnostic(operation, 'recovered', lastFailure, attempt, {
            requestId,
            elapsedMs: this._elapsedSince(startedAt),
          });
        }
        return result;
      } catch (error) {
        lastFailure = classifyFailure(error);
        if (attempt < 2 && isRuntimeRetryable(lastFailure)) {
          this._diagnostic(operation, 'retrying', lastFailure, attempt, {
            requestId,
            elapsedMs: this._elapsedSince(startedAt),
          });
          if (this.retryDelayMs > 0) await this._sleep(this.retryDelayMs);
          continue;
        }
        this._diagnostic(operation, 'failed', lastFailure, attempt, {
          requestId,
          elapsedMs: this._elapsedSince(startedAt),
        });
        throw sanitizedStoreError(lastFailure);
      }
    }
    throw sanitizedStoreError(lastFailure);
  }

  // Startup verification: confirm the service role can reach app_sessions, then
  // arm the cleanup timer. Must finish before app.listen in production so we
  // never serve a request without a working session backend (wired in 9.4).
  async init({ signal = null } = {}) {
    try {
      const client = this._getClient();
      await this._requestOnce(
        () => client.from(this.table).select('sid').limit(1),
        { initialization: true, signal }
      );
    } catch (e) {
      throw sanitizedInitError(classifyFailure(e));
    }
    if (!this._reapTimer) {
      const interval = Math.min(this.ttlMs, REAP_INTERVAL_MS);
      this._reapTimer = setInterval(() => { this._reap(); }, interval);
      if (this._reapTimer && typeof this._reapTimer.unref === 'function') this._reapTimer.unref();
    }
    return this;
  }

  _expiryFor(sess) {
    const cookie = sess && sess.cookie;
    if (cookie && cookie.expires) {
      const t = new Date(cookie.expires).getTime();
      if (Number.isFinite(t)) return t;
    }
    return Date.now() + this.ttlMs;
  }

  _reap() {
    let client;
    try { client = this._getClient(); } catch (e) { return; /* best effort; never log */ }
    client.from(this.table).delete().lte('expires_at', Date.now())
      .then(() => { /* ignore result; best effort */ })
      .catch(() => { /* best effort; never log */ });
  }

  get(sid, cb) {
    let client;
    try { client = this._getClient(); } catch (e) { return cb(sanitizedStoreError()); }
    this._runtimeRequest('get', () =>
      client.from(this.table).select('sess, expires_at').eq('sid', sid).maybeSingle())
      .then(({ data }) => {
        if (!data) return cb(null, null);
        if (Number(data.expires_at) <= Date.now()) {
          this.destroy(sid, () => {}); // expired -> treat as missing + best-effort delete
          return cb(null, null);
        }
        // jsonb is returned as a parsed object; defensively handle a string
        // payload, and treat anything non-object as corrupted (missing + purge).
        let parsed = data.sess;
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); }
          catch (e) { this.destroy(sid, () => {}); return cb(null, null); }
        }
        if (parsed === null || typeof parsed !== 'object') {
          this.destroy(sid, () => {});
          return cb(null, null);
        }
        return cb(null, parsed);
      })
      .catch(() => cb(sanitizedStoreError()));
  }

  set(sid, sess, cb) {
    let client;
    let sessObj;
    try {
      client = this._getClient();
      // Verify JSON-serializability, then store a clean JSON object (jsonb),
      // not a pre-stringified string.
      sessObj = JSON.parse(JSON.stringify(sess));
    } catch (e) {
      return cb(sanitizedStoreError());
    }
    const now = Date.now();
    const row = {
      sid,
      sess: sessObj,
      expires_at: this._expiryFor(sess),
      updated_at: utcTimestamp(now),
      // created_at intentionally omitted: DB default on insert, preserved on
      // conflict-update (only provided columns are written).
    };
    this._runtimeRequest('set', () => client.from(this.table).upsert(row, { onConflict: 'sid' }))
      .then(() => cb(null))
      .catch(() => cb(sanitizedStoreError()));
  }

  touch(sid, sess, cb) {
    let client;
    try { client = this._getClient(); } catch (e) { return cb(sanitizedStoreError()); }
    const now = Date.now();
    this._runtimeRequest('touch', () => client.from(this.table)
      .update({ expires_at: this._expiryFor(sess), updated_at: utcTimestamp(now) })
      .eq('sid', sid))
      .then(() => cb(null))
      .catch(() => cb(sanitizedStoreError()));
  }

  destroy(sid, cb) {
    let client;
    try { client = this._getClient(); } catch (e) { if (cb) cb(sanitizedStoreError()); return; }

    // Logout must remain scoped to this exact sid. A transient PostgREST
    // response error can be ambiguous (the DELETE may already have committed),
    // so confirm the row before issuing one bounded retry. Never fall back to a
    // user-wide revocation here: express-session destroy owns one session only.
    let callbackCalled = false;
    const done = (error) => {
      if (callbackCalled || !cb) return;
      callbackCalled = true;
      cb(error || null);
    };
    const deleteSid = () => this._requestOnce(
      () => client.from(this.table).delete().eq('sid', sid));
    const sidIsAbsent = async () => {
      const { data } = await this._requestOnce(() => client
        .from(this.table).select('sid').eq('sid', sid).maybeSingle());
      return !data;
    };

    (async () => {
      try {
        const first = await deleteSid();
        if (!first || first.error) throw new Error('delete failed');
        return done(null);
      } catch (e) {
        try {
          if (await sidIsAbsent()) return done(null);
        } catch (readError) {
          // An inconclusive read still permits the single bounded retry below.
        }
      }

      try {
        const retry = await deleteSid();
        if (!retry || retry.error) throw new Error('delete retry failed');
        return done(null);
      } catch (e) {
        try {
          if (await sidIsAbsent()) return done(null);
        } catch (readError) {
          // Fall through to the fixed sanitized terminal error.
        }
        return done(sanitizedStoreError());
      }
    })();
  }
}

function createSupabaseSessionStore(opts) {
  return new SupabaseSessionStore(opts);
}

module.exports = { SupabaseSessionStore, createSupabaseSessionStore };
