'use strict';

/* =============================================================================
   CampuSphere — R8 identity/profile constraint deployment verifier
   =============================================================================
   Read-only deployment check. Verifies that the R8 identity/profile uniqueness
   parity is actually in force:

     MySQL:
       - the 4 UNIQUE indexes exist with the right columns:
           uq_users_oauth_provider_subject  users(oauth_provider, oauth_subject)
           uq_student_profiles_user_id       student_profiles(user_id)
           uq_instructor_profiles_user_id    instructor_profiles(user_id)
           uq_guest_profiles_user_id         guest_profiles(user_id)
       - zero duplicate groups for those four identity/profile keys.
     Supabase:
       - zero duplicate groups for the same four keys (read-only), AND
       - the constraints are actually enforced (a small duplicate-write probe
         whose throwaway rows are ALWAYS cleaned up).

   Exits 0 only when every check passes; otherwise exits nonzero. Output is
   limited to fixed, sanitized PASS/FAIL labels and a count — never passwords,
   cookies, session ids, OAuth subjects, emails, the Supabase host/service-role
   value, raw SQL errors, row values, or stack traces. The MySQL pool is always
   closed; the process never hangs.

   Usage (safe to run repeatedly):
     node scripts/verify-identity-constraints.js
   ============================================================================= */

const db = require('../config/db');
const { getSupabaseClient, hasSupabaseConfig } = require('../config/supabase');

const failures = [];
function check(ok, label) {
  console.log((ok ? '  PASS ' : '  FAIL ') + label);
  if (!ok) failures.push(label);
}

const INDEXES = [
  { table: 'users', index: 'uq_users_oauth_provider_subject', cols: 'oauth_provider,oauth_subject' },
  { table: 'student_profiles', index: 'uq_student_profiles_user_id', cols: 'user_id' },
  { table: 'instructor_profiles', index: 'uq_instructor_profiles_user_id', cols: 'user_id' },
  { table: 'guest_profiles', index: 'uq_guest_profiles_user_id', cols: 'user_id' }
];
const DUP_CHECKS = [
  { label: 'student_profiles.user_id', sql: 'SELECT user_id FROM student_profiles GROUP BY user_id HAVING COUNT(*) > 1' },
  { label: 'instructor_profiles.user_id', sql: 'SELECT user_id FROM instructor_profiles GROUP BY user_id HAVING COUNT(*) > 1' },
  { label: 'guest_profiles.user_id', sql: 'SELECT user_id FROM guest_profiles GROUP BY user_id HAVING COUNT(*) > 1' },
  { label: 'users(oauth_provider,oauth_subject) non-null', sql: "SELECT oauth_provider, oauth_subject FROM users WHERE oauth_subject IS NOT NULL GROUP BY oauth_provider, oauth_subject HAVING COUNT(*) > 1" }
];

async function verifyMysql() {
  console.log('MySQL identity constraints:');
  for (const { table, index, cols } of INDEXES) {
    try {
      const [rows] = await db.query(
        `SELECT NON_UNIQUE, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols
           FROM INFORMATION_SCHEMA.STATISTICS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
          GROUP BY NON_UNIQUE`,
        [table, index]
      );
      const ok = rows.length === 1 && Number(rows[0].NON_UNIQUE) === 0 && rows[0].cols === cols;
      check(ok, `unique index ${index} on ${table}(${cols})`);
    } catch (e) {
      check(false, `unique index ${index} on ${table} (check errored)`);
    }
  }
  for (const { label, sql } of DUP_CHECKS) {
    try {
      const [rows] = await db.query(sql);
      check(rows.length === 0, `no duplicate groups: ${label}`);
    } catch (e) {
      check(false, `duplicate check errored: ${label}`);
    }
  }
}

function hasDup(rows, keyFn) {
  const m = {};
  for (const r of rows || []) {
    const k = keyFn(r);
    if (k == null) continue;
    m[k] = (m[k] || 0) + 1;
  }
  return Object.values(m).some((c) => c > 1);
}
const isUniqueViolation = (error) =>
  !!error && (error.code === '23505' || /duplicate key value|unique constraint/i.test(error.message || ''));

// Read rows for a duplicate check, failing CLOSED: on ANY read error (the
// Supabase { error } value OR a thrown network error) record a sanitized
// failure and return null, so the caller never treats the table as passing on
// missing/partial data. Never prints the raw error, host, SQL, credentials, or
// row values.
async function readSupabaseRows(sb, table, columns, label) {
  try {
    const { data, error } = await sb.from(table).select(columns);
    if (error) { check(false, label + ' read failed'); return null; }
    return data || [];
  } catch (e) {
    check(false, label + ' read failed');
    return null;
  }
}

async function verifySupabase() {
  console.log('Supabase identity constraints:');
  if (!hasSupabaseConfig()) {
    check(false, 'Supabase configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)');
    return;
  }
  const sb = getSupabaseClient();
  const PREFIX = '__verify_identity__.' + Date.now();

  // --- read-only duplicate checks (fail CLOSED if a read errors) ---
  const sp = await readSupabaseRows(sb, 'student_profiles', 'user_id', 'student_profiles.user_id');
  if (sp !== null) check(!hasDup(sp, (r) => r.user_id), 'no duplicate groups: student_profiles.user_id');
  const ip = await readSupabaseRows(sb, 'instructor_profiles', 'user_id', 'instructor_profiles.user_id');
  if (ip !== null) check(!hasDup(ip, (r) => r.user_id), 'no duplicate groups: instructor_profiles.user_id');
  const gp = await readSupabaseRows(sb, 'guest_profiles', 'user_id', 'guest_profiles.user_id');
  if (gp !== null) check(!hasDup(gp, (r) => r.user_id), 'no duplicate groups: guest_profiles.user_id');
  const us = await readSupabaseRows(sb, 'users', 'oauth_provider, oauth_subject', 'users(oauth_provider,oauth_subject)');
  if (us !== null) check(!hasDup(us.filter((u) => u.oauth_subject != null), (u) => u.oauth_provider + '|' + u.oauth_subject),
    'no duplicate groups: users(oauth_provider,oauth_subject) non-null');

  // --- enforcement probe (throwaway rows ALWAYS cleaned up) ---
  const mkUser = async (suffix, provider, subject) => {
    const { data, error } = await sb.from('users').insert({
      username: 'vfy' + suffix, email: PREFIX + '.' + suffix + '@example.invalid', password: 'x',
      role: 'guest', first_name: 'V', last_name: 'F', oauth_provider: provider, oauth_subject: subject
    }).select('id').single();
    return { id: data && data.id, error };
  };
  try {
    const main = await mkUser('main', 'local', null);
    if (main.error || !main.id) {
      check(false, 'Supabase enforcement probe setup (could not create throwaway)');
    } else {
      const u = main.id;
      await sb.from('student_profiles').insert({ user_id: u, student_id_number: 'S', course: 'C', year_level: 'Y', enrollment_status: 'Enrolled', semester: 'M' });
      const sDup = await sb.from('student_profiles').insert({ user_id: u, student_id_number: 'S2', course: 'C', year_level: 'Y', enrollment_status: 'Enrolled', semester: 'M' });
      check(isUniqueViolation(sDup.error), 'enforced: duplicate student_profiles.user_id rejected');

      await sb.from('instructor_profiles').insert({ user_id: u, employee_id: 'E', department: 'D', position: 'P', status: 'Active' });
      const iDup = await sb.from('instructor_profiles').insert({ user_id: u, employee_id: 'E2', department: 'D', position: 'P', status: 'Active' });
      check(isUniqueViolation(iDup.error), 'enforced: duplicate instructor_profiles.user_id rejected');

      await sb.from('guest_profiles').insert({ user_id: u, address: 'A', phone_number: '1' });
      const gDup = await sb.from('guest_profiles').insert({ user_id: u, address: 'A2', phone_number: '2' });
      check(isUniqueViolation(gDup.error), 'enforced: duplicate guest_profiles.user_id rejected');

      const sub = PREFIX + '-sub';
      const o1 = await mkUser('o1', 'google', sub);
      const o2 = await mkUser('o2', 'google', sub);
      check(!o1.error && isUniqueViolation(o2.error), 'enforced: duplicate non-null (oauth_provider,oauth_subject) rejected');
    }
  } catch (e) {
    check(false, 'Supabase enforcement probe (errored)');
  } finally {
    // Guaranteed cleanup: remove every throwaway row by its unmistakable
    // prefix; FK ON DELETE CASCADE removes the probe profile rows.
    try { await sb.from('users').delete().like('email', PREFIX + '.%'); } catch (e) {}
  }
}

(async () => {
  try { await verifyMysql(); }
  catch (e) { check(false, 'MySQL verification (errored)'); }
  finally { try { await db.end(); } catch (e) {} }

  try { await verifySupabase(); }
  catch (e) { check(false, 'Supabase verification (errored)'); }

  if (failures.length === 0) {
    console.log('IDENTITY-CONSTRAINTS OK: all checks passed.');
    process.exitCode = 0;
  } else {
    console.error('IDENTITY-CONSTRAINTS FAILED: ' + failures.length + ' check(s) did not pass.');
    process.exitCode = 1;
  }
  // Safety net so a lingering Supabase/undici handle cannot hang the process.
  setTimeout(() => process.exit(process.exitCode || 0), 1500).unref();
})();
