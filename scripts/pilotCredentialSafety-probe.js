'use strict';

/* ========================================
   CampuSphere — M12.P1-R1 pilot credential/session safety probe (READ ONLY)

   Verifies the owner's live-credential containment for the four retained
   local-login regression identities (admin, student, instructor, guest)
   against the LIVE Supabase backend, without calling any login endpoint,
   creating a session, or mutating anything.

   Per identity (located ONLY by its canonical email from the test-only
   SUPABASE_REGRESSION_* environment):
     - exactly one live users row exists;
     - the row carries the intended role;
     - the student / instructor / guest role-profile row exists (exactly one);
     - the private replacement password matches the live bcrypt hash
       (compared ONLY in memory; the candidate and hash are never printed);
     - every repository-known FORMER DEFAULT password is rejected by the
       live hash;
     - zero unexpired public.app_sessions rows reference the identity
       (the owner signs out any deliberate post-rotation session first).

   Access is SELECT-only (count/head reads for profiles and sessions). This
   probe performs NO insert, update, delete, RPC, SQL, migration, login,
   session creation, or session deletion. If unexpired sessions remain, it
   reports a sanitized failure and does NOT clear them.

   Output contract: fixed sanitized PASS/FAIL labels only. No email, numeric
   id, password, candidate, hash, sid, cookie, raw PostgREST/DB error, or
   stack trace is ever printed.
   ======================================== */

require('dotenv').config();

const bcrypt = require('bcrypt');
const { getSupabaseClient, hasSupabaseConfig } = require('../config/supabase');
const { getRegressionCredentials } = require('./regressionCredentials');

// Complete set of local-login demo passwords ever recorded in repository
// documentation or seed history (README table, docs tables, seed fixtures).
// These are already-public DEAD values being verified as rejected; keeping
// the list in source is the rejection contract, not a credential leak.
const FORMER_DEFAULT_CANDIDATES = Object.freeze([
  'admin123',
  'student123',
  'instructor123',
  'guest123',
]);

// Intended role and role-profile table per regression identity slot.
const IDENTITIES = Object.freeze([
  Object.freeze({ slot: 'admin', role: 'admin', profileTable: null }),
  Object.freeze({ slot: 'student', role: 'student-cspc', profileTable: 'student_profiles' }),
  Object.freeze({ slot: 'instructor', role: 'instructor', profileTable: 'instructor_profiles' }),
  Object.freeze({ slot: 'guest', role: 'guest', profileTable: 'guest_profiles' }),
]);

const failures = [];
let checks = 0;

function check(scope, label, ok) {
  checks += 1;
  const pass = ok === true;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!pass) failures.push(`${scope} :: ${label}`);
}

// In-memory bcrypt comparison that can never throw a hash-shaped error into
// the output: a malformed/absent stored hash simply compares false.
async function compareInMemory(candidate, hash) {
  try {
    return await bcrypt.compare(String(candidate), String(hash == null ? '' : hash));
  } catch (_) {
    return false;
  }
}

async function selectRows(sb, table, columns, build) {
  let query = sb.from(table).select(columns);
  if (build) query = build(query);
  const { data, error } = await query;
  if (error) throw new Error(`Unable to read Supabase ${table}.`);
  return data || [];
}

async function countRows(sb, table, build) {
  let query = sb.from(table).select('*', { count: 'exact', head: true });
  if (build) query = build(query);
  const { count, error } = await query;
  if (error) throw new Error(`Unable to read Supabase ${table}.`);
  return typeof count === 'number' ? count : -1;
}

async function main() {
  console.log('=== CampuSphere M12.P1-R1 pilot credential/session safety probe (READ ONLY) ===');
  console.log('No login endpoint is called; no row, session, or credential is created, changed, or deleted.');

  if (!hasSupabaseConfig()) {
    throw new Error('Supabase configuration is required for the pilot credential safety probe.');
  }

  // Fails closed (fixed sanitized message) when any of the eight test-only
  // variables is missing or blank. Values stay in memory only.
  const creds = getRegressionCredentials('supabase');

  const distinctEmails = new Set(IDENTITIES.map(({ slot }) => creds[slot].email.toLowerCase()));
  check('env', 'the four regression identities use four distinct canonical emails',
    distinctEmails.size === IDENTITIES.length);

  const sb = getSupabaseClient();

  for (const { slot, role, profileTable } of IDENTITIES) {
    const rows = await selectRows(sb, 'users', 'id, role, password',
      (q) => q.eq('email', creds[slot].email));

    check(slot, 'exactly one live users row exists for the canonical email', rows.length === 1);
    if (rows.length !== 1) continue;

    const row = rows[0];
    check(slot, 'the live row carries the intended role', row.role === role);

    if (profileTable) {
      const profileCount = await countRows(sb, profileTable,
        (q) => q.eq('user_id', row.id));
      check(slot, `exactly one ${profileTable} row exists for the identity`, profileCount === 1);
    }

    const replacementMatches = await compareInMemory(creds[slot].password, row.password);
    check(slot, 'private replacement password matches the live bcrypt hash (in-memory only)',
      replacementMatches === true);

    let anyFormerDefaultAccepted = false;
    for (const candidate of FORMER_DEFAULT_CANDIDATES) {
      if (await compareInMemory(candidate, row.password)) anyFormerDefaultAccepted = true;
    }
    check(slot, 'every repository-known former default password is rejected',
      anyFormerDefaultAccepted === false);

    const unexpiredSessions = await countRows(sb, 'app_sessions',
      (q) => q.eq('sess->user->>id', String(row.id)).gt('expires_at', Date.now()));
    check(slot, 'zero unexpired persisted app_sessions rows reference the identity',
      unexpiredSessions === 0);
  }

  if (failures.length) {
    console.error(`\nPILOT-CREDENTIAL-SAFETY-PROBE FAILED: ${failures.length} check(s) did not pass.`);
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error('No session was cleared and no data was changed by this probe.');
    process.exitCode = 1;
  } else {
    console.log(`\nPILOT-CREDENTIAL-SAFETY-PROBE OK: ${checks}/${checks} checks passed.`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    // Only fixed sanitized messages reach this point (loader/read wrappers);
    // print the message alone — never a stack, value, or backend detail.
    console.error(`PILOT-CREDENTIAL-SAFETY-PROBE FAILED: ${error && error.message ? error.message : 'sanitized failure'}`);
    process.exitCode = 1;
  });
}

module.exports = { FORMER_DEFAULT_CANDIDATES, IDENTITIES };
