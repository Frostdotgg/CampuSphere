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

   Privacy: this module logs NOTHING — never a session id, cookie value, the
   session JSON, the Supabase URL, the service-role key, PostgREST/SQL detail, a
   stack, or a raw error. Store-operation failures surface a fixed, sanitized
   Error to express-session; init failure throws a fixed, sanitized Error so the
   caller can fail closed at startup (Section 9.4).

   Supabase Auth is NOT used.
   ======================================== */

const session = require('express-session');
const Store = session.Store;
const { getSupabaseClient } = require('../config/supabase');

const DEFAULT_TABLE = 'app_sessions';
const DAY_MS = 24 * 60 * 60 * 1000;
const REAP_INTERVAL_MS = 60 * 60 * 1000; // hourly expired-row purge (capped by ttl)

function sanitizedStoreError() {
  // Fixed message; carries no sid, session JSON, Supabase URL/key, SQL/PostgREST
  // detail, or raw error.
  return new Error('Session store operation failed.');
}

function sanitizedInitError() {
  // Fixed message; suitable for fail-closed startup handling (Section 9.4).
  // Never carries Supabase host/key, table name detail, or a raw error.
  return new Error('Session store initialization failed.');
}

function utcTimestamp(ms) {
  // timestamptz value for updated_at, set explicitly by application code.
  return new Date(ms).toISOString();
}

class SupabaseSessionStore extends Store {
  constructor({ client = null, tableName = DEFAULT_TABLE, ttlMs = DAY_MS } = {}) {
    super();
    if (!/^[A-Za-z0-9_]+$/.test(tableName)) {
      throw new Error('SupabaseSessionStore table name must be alphanumeric/underscore.');
    }
    // client is optional: resolved lazily via getSupabaseClient() on first use so
    // constructing the store never throws when Supabase env is absent.
    this.client = client || null;
    this.table = tableName;
    this.ttlMs = ttlMs > 0 ? ttlMs : DAY_MS;
    this._reapTimer = null;
  }

  // Resolve (and cache) the server-only Supabase client. Throws if Supabase env
  // is not configured; callers wrap this in try/catch and sanitize.
  _getClient() {
    if (this.client) return this.client;
    this.client = getSupabaseClient();
    return this.client;
  }

  // Startup verification: confirm the service role can reach app_sessions, then
  // arm the cleanup timer. Must finish before app.listen in production so we
  // never serve a request without a working session backend (wired in 9.4).
  async init() {
    try {
      const client = this._getClient();
      const { error } = await client.from(this.table).select('sid').limit(1);
      if (error) throw error;
    } catch (e) {
      throw sanitizedInitError();
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
    client.from(this.table).select('sess, expires_at').eq('sid', sid).maybeSingle()
      .then(({ data, error }) => {
        if (error) return cb(sanitizedStoreError());
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
    client.from(this.table).upsert(row, { onConflict: 'sid' })
      .then(({ error }) => { if (error) return cb(sanitizedStoreError()); cb(null); })
      .catch(() => cb(sanitizedStoreError()));
  }

  touch(sid, sess, cb) {
    let client;
    try { client = this._getClient(); } catch (e) { return cb(sanitizedStoreError()); }
    const now = Date.now();
    client.from(this.table)
      .update({ expires_at: this._expiryFor(sess), updated_at: utcTimestamp(now) })
      .eq('sid', sid)
      .then(({ error }) => { if (error) return cb(sanitizedStoreError()); cb(null); })
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
    const deleteSid = () => client.from(this.table).delete().eq('sid', sid);
    const sidIsAbsent = async () => {
      const { data, error } = await client
        .from(this.table)
        .select('sid')
        .eq('sid', sid)
        .maybeSingle();
      if (error) throw error;
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
