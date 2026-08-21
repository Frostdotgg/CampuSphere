'use strict';

/*
 * cleanupHarnessReadinessMysqlSessions.js is a Local-only operator for the
 * identity-free sessions left by the historical
 * `/auth` readiness poll. This file is excluded from the Vercel package.
 *
 * Default mode is a read-only dry run. Mutation requires all of:
 *   --apply --exclusive-local-test-db --scope-confirmed-local-only
 *   --expected-count N --expected-sha256 H
 * and is restricted to the exact session records returned by one matching
 * snapshot. Every deletion goes through the supported conditional store
 * interface; this script has no DELETE SQL, public route, Supabase path,
 * retry, or broad cleanup.
 *
 * The database schema has no provenance column. The exact cookie+csrfToken
 * shape is therefore an operational scope selector, not proof that every row
 * was created by the historical readiness request. The owner must explicitly
 * confirm both exclusive local ownership and this bounded scope.
 *
 * Output is deliberately limited to counts and a set fingerprint. It never
 * prints SIDs, cookies, CSRF tokens, session JSON, SQL, or raw DB errors.
 */

const crypto = require('crypto');
const { createMysqlSessionStore } = require('../services/mysqlSessionStore');

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const EXPECTED_DB_NAME = 'campusphere_db';

function sanitizedError(message = 'Local session maintenance failed.') {
  return new Error(message);
}

function normalizeEnvValue(value) {
  return String(value == null ? '' : value).trim();
}

function assertLocalTestEnvironment(env = process.env) {
  const store = normalizeEnvValue(env.SESSION_STORE).toLowerCase();
  const nodeEnv = normalizeEnvValue(env.NODE_ENV).toLowerCase();
  const host = normalizeEnvValue(env.DB_HOST || '127.0.0.1').toLowerCase();
  const database = normalizeEnvValue(env.DB_NAME || EXPECTED_DB_NAME);
  if (store !== 'mysql') throw sanitizedError('SESSION_STORE=mysql is required.');
  if (nodeEnv === 'production' || normalizeEnvValue(env.VERCEL) || normalizeEnvValue(env.VERCEL_ENV)) {
    throw sanitizedError('Production and Vercel execution are refused.');
  }
  if (!LOCAL_HOSTS.has(host) || database !== EXPECTED_DB_NAME) {
    throw sanitizedError('Only the local campusphere_db database is allowed.');
  }
}

function candidateFingerprint(sids) {
  if (!Array.isArray(sids) || !sids.every((sid) => typeof sid === 'string' && sid.length > 0)) {
    throw sanitizedError();
  }
  const sorted = [...sids].sort();
  return crypto.createHash('sha256').update(JSON.stringify(sorted), 'utf8').digest('hex');
}

function isExactReadinessShape(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  const keys = Object.keys(parsed).sort();
  return keys.length === 2 &&
    keys[0] === 'cookie' && keys[1] === 'csrfToken' &&
    parsed.cookie && typeof parsed.cookie === 'object' &&
    !Array.isArray(parsed.cookie) &&
    typeof parsed.csrfToken === 'string' && parsed.csrfToken.length > 0;
}

async function inspectHarnessReadinessSessions(pool, nowMs = Date.now()) {
  if (!pool || typeof pool.query !== 'function' ||
      !Number.isSafeInteger(nowMs) || nowMs < 0) throw sanitizedError();
  let rows;
  try {
    const result = await pool.query(
      'SELECT sid, sess, expires_at FROM `app_sessions` WHERE expires_at > ? ORDER BY sid ASC',
      [nowMs]
    );
    if (!Array.isArray(result) || !Array.isArray(result[0])) throw sanitizedError();
    rows = result[0];
  } catch (e) {
    if (e && e.message === 'Local session maintenance failed.') throw e;
    throw sanitizedError();
  }

  const snapshot = {
    scannedCount: 0,
    candidateSids: [],
    candidateRecords: [],
    userBearingCount: 0,
    statefulAnonymousCount: 0,
    malformedCount: 0,
  };
  for (const row of rows) {
    snapshot.scannedCount += 1;
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      snapshot.malformedCount += 1;
      continue;
    }
    const sid = row.sid;
    const expiresAt = Number(row.expires_at);
    if (typeof sid !== 'string' || sid.length === 0 || sid.length > 128 ||
        !Number.isSafeInteger(expiresAt) || expiresAt <= nowMs ||
        typeof row.sess !== 'string') {
      snapshot.malformedCount += 1;
      continue;
    }

    let parsed;
    try { parsed = JSON.parse(row.sess); }
    catch (e) {
      snapshot.malformedCount += 1;
      continue;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      snapshot.malformedCount += 1;
      continue;
    }

    if (isExactReadinessShape(parsed)) {
      snapshot.candidateSids.push(sid);
      snapshot.candidateRecords.push({ sid, sess: row.sess, expiresAt });
    } else if (Object.prototype.hasOwnProperty.call(parsed, 'user')) {
      snapshot.userBearingCount += 1;
    } else {
      snapshot.statefulAnonymousCount += 1;
    }
  }
  return snapshot;
}

function parseArgs(argv) {
  if (!Array.isArray(argv)) throw sanitizedError('Arguments are invalid.');
  const allowed = new Set([
    '--apply', '--check', '--dry-run', '--exclusive-local-test-db',
    '--scope-confirmed-local-only', '--expected-count', '--expected-sha256'
  ]);
  const seen = new Set();
  let apply = false;
  let check = false;
  let dryRun = false;
  let exclusive = false;
  let scopeConfirmed = false;
  let expectedCount = null;
  let expectedSha256 = null;
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (typeof flag !== 'string' || !allowed.has(flag)) {
      throw sanitizedError('Unknown or positional argument.');
    }
    if (seen.has(flag)) throw sanitizedError('Duplicate argument.');
    seen.add(flag);
    if (flag === '--apply') apply = true;
    else if (flag === '--check') check = true;
    else if (flag === '--dry-run') dryRun = true;
    else if (flag === '--exclusive-local-test-db') exclusive = true;
    else if (flag === '--scope-confirmed-local-only') scopeConfirmed = true;
    else if (flag === '--expected-count' || flag === '--expected-sha256') {
      const value = argv[++i];
      if (typeof value !== 'string' || value.length === 0 || value.startsWith('--')) {
        throw sanitizedError('Expected argument value is missing.');
      }
      if (flag === '--expected-count') expectedCount = value;
      else expectedSha256 = value;
    }
  }
  if (apply && check) throw sanitizedError('Choose one operation.');
  if (!exclusive) throw sanitizedError('Explicit exclusive-local-test-db confirmation is required.');
  if (!scopeConfirmed) throw sanitizedError('Explicit local scope confirmation is required.');
  if (dryRun && (apply || check)) throw sanitizedError('Choose one operation.');
  if (expectedCount !== null) {
    if (!/^(?:0|[1-9][0-9]*)$/.test(String(expectedCount))) {
      throw sanitizedError('Expected count is invalid.');
    }
    expectedCount = Number(expectedCount);
    if (!Number.isSafeInteger(expectedCount)) throw sanitizedError('Expected count is invalid.');
  }
  if (expectedSha256 !== null) {
    expectedSha256 = String(expectedSha256).trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expectedSha256)) throw sanitizedError('Expected fingerprint is invalid.');
  }
  if (apply && (expectedCount === null || expectedSha256 === null)) {
    throw sanitizedError('Apply requires an expected count and fingerprint.');
  }
  if (!apply && (expectedCount !== null || expectedSha256 !== null)) {
    throw sanitizedError('Expected values require apply.');
  }
  return { apply, check, expectedCount, expectedSha256 };
}

async function snapshot(pool, nowMs = Date.now()) {
  const raw = await inspectHarnessReadinessSessions(pool, nowMs);
  if (!raw || !Array.isArray(raw.candidateSids) || !Array.isArray(raw.candidateRecords) ||
      raw.candidateSids.length !== raw.candidateRecords.length) throw sanitizedError();
  const candidateSids = [...raw.candidateSids];
  const candidateRecords = raw.candidateRecords.map((record) => ({
    sid: record && record.sid,
    sess: record && record.sess,
    expiresAt: record && record.expiresAt,
  }));
  return {
    scannedCount: Number(raw.scannedCount) || 0,
    candidateCount: candidateSids.length,
    candidateSids,
    candidateRecords,
    candidateFingerprint: candidateFingerprint(candidateSids),
    userBearingCount: Number(raw.userBearingCount) || 0,
    statefulAnonymousCount: Number(raw.statefulAnonymousCount) || 0,
    malformedCount: Number(raw.malformedCount) || 0,
  };
}

function assertCleanSnapshot(state) {
  if (!state || state.scannedCount !== state.candidateCount ||
      state.userBearingCount !== 0 || state.statefulAnonymousCount !== 0 ||
      state.malformedCount !== 0) {
    throw sanitizedError('Snapshot contains non-harness or ambiguous sessions.');
  }
}

function destroyOne(store, record) {
  if (!store || typeof store.destroyIfUnchanged !== 'function' ||
      !record || typeof record.sid !== 'string' ||
      typeof record.sess !== 'string' || !Number.isSafeInteger(record.expiresAt)) {
    return Promise.reject(sanitizedError());
  }
  return new Promise((resolve, reject) => {
    store.destroyIfUnchanged(record.sid, record.sess, record.expiresAt,
      (error) => (error ? reject(sanitizedError()) : resolve()));
  });
}

async function run(argv, { env = process.env, store, pool } = {}) {
  const options = parseArgs(argv);
  assertLocalTestEnvironment(env);
  const ownedPool = !pool;
  const activePool = pool || require('../config/db');
  const activeStore = store || createMysqlSessionStore({ pool: activePool });
  let before;
  let destroyedCount = 0;
  try {
    before = await snapshot(activePool);
    if (options.apply) {
      assertCleanSnapshot(before);
      if (before.candidateCount !== options.expectedCount ||
          before.candidateFingerprint !== options.expectedSha256) {
        throw sanitizedError('Snapshot changed before apply.');
      }
      for (const record of before.candidateRecords) {
        await destroyOne(activeStore, record);
        destroyedCount += 1;
      }
      const after = await snapshot(activePool);
      if (after.candidateCount !== 0 || after.scannedCount !== 0 ||
          after.userBearingCount !== 0 || after.statefulAnonymousCount !== 0 ||
          after.malformedCount !== 0) {
        throw sanitizedError('Post-cleanup residue remains.');
      }
      return { mode: 'apply', before, destroyedCount, after };
    }
    if (options.check) {
      assertCleanSnapshot(before);
      if (before.candidateCount !== 0) throw sanitizedError('Anonymous session residue remains.');
      return { mode: 'check', before };
    }
    assertCleanSnapshot(before);
    return { mode: 'dry-run', before };
  } finally {
    if (ownedPool && activePool && typeof activePool.end === 'function') {
      try { await activePool.end(); } catch (e) { /* sanitized caller result */ }
    }
  }
}

module.exports = {
  assertLocalTestEnvironment,
  candidateFingerprint,
  inspectHarnessReadinessSessions,
  parseArgs,
  snapshot,
  assertCleanSnapshot,
  run,
};

if (require.main === module) {
  run(process.argv.slice(2))
    .then((result) => {
      const before = result.before;
      const after = result.after;
      console.log(JSON.stringify({
        mode: result.mode,
        scannedBefore: before.scannedCount,
        candidatesBefore: before.candidateCount,
        fingerprint: before.candidateFingerprint,
        destroyed: result.destroyedCount || 0,
        candidatesAfter: after ? after.candidateCount : undefined,
        scannedAfter: after ? after.scannedCount : undefined,
      }));
    })
    .catch((error) => {
      console.error('[local-maintenance] ' +
        (error && error.message ? error.message : 'failed'));
      process.exitCode = 1;
    });
}
