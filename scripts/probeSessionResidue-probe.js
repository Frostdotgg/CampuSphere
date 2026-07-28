'use strict';

/* ========================================
   CampuSphere — canonical session residue gate (SELECT ONLY)

   Proves the POSTCONDITION that logout-response, clearing-cookie, and
   former-cookie-replay assertions cannot: after the suite has run, ZERO
   unexpired persisted sessions remain for any canonical regression identity,
   in the ACTUAL session stores.

   Those per-request assertions only prove that one cookie stopped working for
   one server. They say nothing about the final global store state — a probe
   could still leave a row behind through a leg nobody asserted. This gate reads
   the stores directly.

   Scope:
     - MySQL  `app_sessions` : the deterministic local fixtures (administrator
       and student only — database/seed.js creates no instructor/guest).
     - Supabase `app_sessions` : all four regression identities (administrator,
       student, instructor, guest).

   Strictly read-only: no insert, update, delete, RPC, login, logout, session
   cleanup, SQL migration, or revocation. Identities come from the shared
   TEST-ONLY loader and are resolved with parameterized MySQL queries and the
   server-only Supabase client. Missing, duplicate, malformed, or ambiguous
   identities FAIL CLOSED.

   Output: fixed sanitized labels only. No email, numeric id, password, hash,
   sid, cookie, CSRF token, session JSON, database host/key, query text, raw
   backend error, or stack is ever printed.

   This is NOT the R1 credential-safety probe: it asserts only session residue,
   and it is registered as the final npm-test gate.
   ======================================== */

require('dotenv').config({ quiet: true });

const db = require('../config/db');
const { getSupabaseClient, hasSupabaseConfig } = require('../config/supabase');
const { getRegressionCredentials } = require('./regressionCredentials');

const SESSIONS_TABLE = 'app_sessions';

// Intended role per identity slot (natural-key validation, never printed).
const MYSQL_IDENTITIES = Object.freeze([
  Object.freeze({ slot: 'admin', role: 'admin' }),
  Object.freeze({ slot: 'student', role: 'student-cspc' }),
]);
const SUPABASE_IDENTITIES = Object.freeze([
  Object.freeze({ slot: 'admin', role: 'admin' }),
  Object.freeze({ slot: 'student', role: 'student-cspc' }),
  Object.freeze({ slot: 'instructor', role: 'instructor' }),
  Object.freeze({ slot: 'guest', role: 'guest' }),
]);

const failures = [];
let checks = 0;
function check(scope, label, ok) {
  checks += 1;
  const pass = ok === true;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!pass) failures.push(`${scope} :: ${label}`);
}

function isPositiveId(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 1;
}

/* ---------------- MySQL (local deterministic fixtures) ---------------- */
async function runMysql() {
  const scope = 'mysql';
  let creds;
  try {
    creds = getRegressionCredentials('mysql');
  } catch (e) {
    check(scope, 'local regression fixtures resolved', false);
    return;
  }

  for (const { slot, role } of MYSQL_IDENTITIES) {
    const email = creds[slot] && creds[slot].email;
    if (typeof email !== 'string' || email.trim() === '') {
      check(scope, `${slot}: canonical identity is resolvable`, false);
      continue;
    }

    let rows;
    try {
      // Parameterized; the email value is never echoed.
      const [result] = await db.query('SELECT id, role FROM users WHERE email = ?', [email]);
      rows = Array.isArray(result) ? result : [];
    } catch (e) {
      check(scope, `${slot}: identity lookup succeeded`, false);
      continue;
    }

    // Fail closed on missing / duplicate / ambiguous identity.
    const exactlyOne = rows.length === 1;
    check(scope, `${slot}: exactly one local users row exists`, exactlyOne);
    if (!exactlyOne) continue;

    const row = rows[0];
    const wellFormed = isPositiveId(row.id) && row.role === role;
    check(scope, `${slot}: row carries a canonical id and the intended role`, wellFormed);
    if (!wellFormed) continue;

    let count = -1;
    try {
      const [res] = await db.query(
        'SELECT COUNT(*) AS c FROM `' + SESSIONS_TABLE + '` ' +
        "WHERE JSON_VALID(sess) AND JSON_EXTRACT(sess, '$.user.id') = ? AND expires_at > ?",
        [Number(row.id), Date.now()]
      );
      count = Array.isArray(res) && res[0] ? Number(res[0].c) : -1;
    } catch (e) {
      // A missing/unreadable session table fails closed rather than silently
      // reporting "no residue".
      check(scope, `${slot}: session store is readable`, false);
      continue;
    }

    check(scope, `${slot}: zero unexpired persisted sessions remain`, count === 0);
  }
}

/* ---------------- Supabase (four regression identities) ---------------- */
async function runSupabase() {
  const scope = 'supabase';
  /* FAIL CLOSED. A missing Supabase configuration must never look like a clean
     result: an unreadable store is indistinguishable from "no residue", and
     silently skipping the production session store is exactly how canonical
     sessions went unnoticed. Recording this only on the MISSING path keeps the
     configured total at the fixed 18 while still forcing one sanitized failure
     and a nonzero exit when the store cannot be reached. */
  if (!hasSupabaseConfig()) {
    check(scope, 'session store configuration is available', false);
    return;
  }

  let creds;
  try {
    creds = getRegressionCredentials('supabase');
  } catch (e) {
    // Fixed sanitized loader message only; fail closed.
    check(scope, 'regression identities resolved from the test-only environment', false);
    return;
  }

  const sb = getSupabaseClient();

  for (const { slot, role } of SUPABASE_IDENTITIES) {
    const email = creds[slot] && creds[slot].email;
    if (typeof email !== 'string' || email.trim() === '') {
      check(scope, `${slot}: canonical identity is resolvable`, false);
      continue;
    }

    let rows;
    try {
      const { data, error } = await sb.from('users').select('id, role').eq('email', email);
      if (error) throw new Error('read failed');
      rows = data || [];
    } catch (e) {
      check(scope, `${slot}: identity lookup succeeded`, false);
      continue;
    }

    const exactlyOne = rows.length === 1;
    check(scope, `${slot}: exactly one live users row exists`, exactlyOne);
    if (!exactlyOne) continue;

    const row = rows[0];
    const wellFormed = isPositiveId(row.id) && row.role === role;
    check(scope, `${slot}: row carries a canonical id and the intended role`, wellFormed);
    if (!wellFormed) continue;

    let count = -1;
    try {
      const { count: c, error } = await sb
        .from(SESSIONS_TABLE)
        .select('*', { count: 'exact', head: true })
        .eq('sess->user->>id', String(row.id))
        .gt('expires_at', Date.now());
      if (error) throw new Error('read failed');
      count = typeof c === 'number' ? c : -1;
    } catch (e) {
      check(scope, `${slot}: session store is readable`, false);
      continue;
    }

    check(scope, `${slot}: zero unexpired persisted sessions remain`, count === 0);
  }
}

async function main() {
  console.log('=== CampuSphere canonical session residue gate (SELECT ONLY) ===');
  console.log('No login, logout, revocation, cleanup, or mutation is performed by this gate.');

  try {
    await runMysql();
    await runSupabase();
  } finally {
    // Release the locally opened MySQL pool so this probe self-terminates.
    try { await db.end(); } catch (e) { /* already closed; never logged */ }
  }

  if (failures.length) {
    console.error(`\nSESSION-RESIDUE-PROBE FAILED: ${failures.length} check(s) did not pass.`);
    for (const f of failures) console.error(`  - ${f}`);
    console.error('No session was cleared and no data was changed by this gate.');
    process.exitCode = 1;
  } else {
    console.log(`\nSESSION-RESIDUE-PROBE OK: ${checks}/${checks} checks passed.`);
  }
}

if (require.main === module) {
  main().catch(() => {
    // Only fixed sanitized messages reach here.
    console.error('SESSION-RESIDUE-PROBE FAILED: sanitized harness failure.');
    process.exitCode = 1;
  });
}

module.exports = { MYSQL_IDENTITIES, SUPABASE_IDENTITIES };
