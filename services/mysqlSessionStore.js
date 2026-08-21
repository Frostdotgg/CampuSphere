'use strict';
/* ========================================
   CampuSphere — MySQL-backed express-session Store (Milestone 8, Section 8.4)

   Server-only. Persists sessions in the `app_sessions` table via the shared
   mysql2 pool (config/db.js). No external session-store dependency.

   Table shape (also created by init() if missing, and seeded in schema.sql):
     sid        VARCHAR(128) PRIMARY KEY
     sess       LONGTEXT     NOT NULL   (JSON.stringify of the session)
     expires_at BIGINT       NOT NULL   (epoch ms; indexed)

   Privacy: this module logs NOTHING — never a session id, cookie value, the
   session JSON, SQL text, or a raw DB error. Store-operation failures surface a
   fixed, sanitized Error to express-session.
   ======================================== */

const session = require('express-session');
const Store = session.Store;

const DEFAULT_TABLE = 'app_sessions';
const DAY_MS = 24 * 60 * 60 * 1000;
const REAP_INTERVAL_MS = 60 * 60 * 1000; // hourly expired-row purge (capped by ttl)

function sanitizedStoreError() {
  // Fixed message; carries no sid, session JSON, SQL text, or DB detail.
  return new Error('Session store operation failed.');
}

class MysqlSessionStore extends Store {
  constructor({ pool, tableName = DEFAULT_TABLE, ttlMs = DAY_MS } = {}) {
    super();
    if (!pool || typeof pool.query !== 'function') {
      throw new Error('MysqlSessionStore requires a mysql2 promise pool.');
    }
    if (!/^[A-Za-z0-9_]+$/.test(tableName)) {
      throw new Error('MysqlSessionStore table name must be alphanumeric/underscore.');
    }
    this.pool = pool;
    this.table = tableName;
    this.ttlMs = ttlMs > 0 ? ttlMs : DAY_MS;
    this._reapTimer = null;
  }

  // Create the table if missing; must finish before app.listen in production.
  async init() {
    await this.pool.query(
      'CREATE TABLE IF NOT EXISTS `' + this.table + '` (' +
      '  sid VARCHAR(128) NOT NULL PRIMARY KEY,' +
      '  sess LONGTEXT NOT NULL,' +
      '  expires_at BIGINT NOT NULL,' +
      '  INDEX idx_' + this.table + '_expires (expires_at)' +
      ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
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
    this.pool.query('DELETE FROM `' + this.table + '` WHERE expires_at <= ?', [Date.now()])
      .catch(() => { /* best effort; never log */ });
  }

  get(sid, cb) {
    this.pool.query('SELECT sess, expires_at FROM `' + this.table + '` WHERE sid = ? LIMIT 1', [sid])
      .then(([rows]) => {
        if (!rows || rows.length === 0) return cb(null, null);
        const row = rows[0];
        if (Number(row.expires_at) <= Date.now()) {
          this.destroy(sid, () => {}); // expired -> treat as missing + best-effort delete
          return cb(null, null);
        }
        let parsed;
        try { parsed = JSON.parse(row.sess); }
        catch (e) { this.destroy(sid, () => {}); return cb(null, null); }
        return cb(null, parsed);
      })
      .catch(() => cb(sanitizedStoreError()));
  }

  set(sid, sess, cb) {
    let json;
    try { json = JSON.stringify(sess); }
    catch (e) { return cb(sanitizedStoreError()); }
    const expiresAt = this._expiryFor(sess);
    this.pool.query(
      'INSERT INTO `' + this.table + '` (sid, sess, expires_at) VALUES (?, ?, ?) ' +
      'ON DUPLICATE KEY UPDATE sess = VALUES(sess), expires_at = VALUES(expires_at)',
      [sid, json, expiresAt]
    ).then(() => cb(null)).catch(() => cb(sanitizedStoreError()));
  }

  touch(sid, sess, cb) {
    const expiresAt = this._expiryFor(sess);
    this.pool.query('UPDATE `' + this.table + '` SET expires_at = ? WHERE sid = ?', [expiresAt, sid])
      .then(() => cb(null)).catch(() => cb(sanitizedStoreError()));
  }

  destroy(sid, cb) {
    this.pool.query('DELETE FROM `' + this.table + '` WHERE sid = ?', [sid])
      .then(() => { if (cb) cb(null); })
      .catch(() => { if (cb) cb(sanitizedStoreError()); });
  }

  /*
   * Operator-only conditional destruction. The caller must supply the exact
   * session payload and expiry observed in the same read-only snapshot. The
   * conditional predicate makes a replacement, touch, or other concurrent
   * change fail closed instead of allowing a stale SID to be deleted.
   */
  destroyIfUnchanged(sid, expectedSess, expectedExpiresAt, cb) {
    const done = typeof cb === 'function' ? cb : () => {};
    if (typeof sid !== 'string' || sid.length === 0 || sid.length > 128 ||
        typeof expectedSess !== 'string' || expectedSess.length === 0 ||
        !Number.isSafeInteger(expectedExpiresAt) || expectedExpiresAt <= 0) {
      return done(sanitizedStoreError());
    }
    this.pool.query(
      'DELETE FROM `' + this.table + '` WHERE sid = ? AND BINARY sess = BINARY ? AND expires_at = ?',
      [sid, expectedSess, expectedExpiresAt]
    ).then(([result]) => {
      if (!result || result.affectedRows !== 1) return done(sanitizedStoreError());
      return done(null);
    }).catch(() => done(sanitizedStoreError()));
  }
}

function createMysqlSessionStore(opts) {
  return new MysqlSessionStore(opts);
}

module.exports = { MysqlSessionStore, createMysqlSessionStore };
