'use strict';

/* ========================================
   CampuSphere - userRepository read-method probe
   Milestone 2, Section 2.4 verification script.

   Read-only. Exercises every read method on the live Supabase
   project configured via SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
   in `.env`. Does NOT print password hashes or secrets.

   Run:   node scripts/userRepository-probe.js
   ======================================== */

require('dotenv').config();

const SAMPLE_ADMIN_EMAIL = ' ADMIN@CSPC.EDU.PH ';
const SAMPLE_STUDENT_EMAIL = 'aaron.lasprillas@cspc.edu.ph';
const MISSING_EMAIL = 'definitely-not-a-real-account@example.invalid';

function redactUser(u) {
  if (!u || typeof u !== 'object') return u;
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    first_name: u.first_name,
    last_name: u.last_name,
    oauth_provider: u.oauth_provider,
    has_password_hash: typeof u.password === 'string' && u.password.length > 0,
    has_oauth_subject: typeof u.oauth_subject === 'string' && u.oauth_subject.length > 0,
    has_profile_image_url: typeof u.profile_image_url === 'string' && u.profile_image_url.length > 0,
    created_at: u.created_at,
    updated_at: u.updated_at
  };
}

function out(label, value) {
  // eslint-disable-next-line no-console
  console.log(label + ':', typeof value === 'string' ? value : JSON.stringify(value));
}

(async () => {
  const repo = require('../repositories/userRepository');

  // 1. findUserByEmail - case-insensitive + whitespace trim.
  const admin = await repo.findUserByEmail(SAMPLE_ADMIN_EMAIL);
  out('1. admin lookup (trimmed/uppercased input)', redactUser(admin));

  // 2. findUserByEmail - missing email returns null.
  const missing = await repo.findUserByEmail(MISSING_EMAIL);
  out('2. missing email lookup (expect null)', missing);

  // 3. findUserById round-trip.
  const adminById = admin ? await repo.findUserById(admin.id) : null;
  out('3. findUserById round-trip ok', !!(adminById && adminById.id === admin.id));

  // 4. loadRoleProfile for sample student.
  const student = await repo.findUserByEmail(SAMPLE_STUDENT_EMAIL);
  out('4a. student lookup', redactUser(student));
  const studentProfile = student
    ? await repo.loadRoleProfile(student.id, 'student-cspc')
    : null;
  if (studentProfile) {
    out('4b. student profile (selected fields)', {
      user_id: studentProfile.user_id,
      student_id_number: studentProfile.student_id_number,
      course: studentProfile.course,
      year_level: studentProfile.year_level,
      enrollment_status: studentProfile.enrollment_status,
      semester: studentProfile.semester
    });
  } else {
    out('4b. student profile', null);
  }

  // 5. loadRoleProfile for admin/unknown role -> null.
  const adminProfile = admin ? await repo.loadRoleProfile(admin.id, 'admin') : null;
  out('5. loadRoleProfile(admin) (expect null)', adminProfile);
  const unknownProfile = admin
    ? await repo.loadRoleProfile(admin.id, 'not-a-role')
    : null;
  out('5b. loadRoleProfile(unknown role) (expect null)', unknownProfile);

  // 6. listRecentUsers(5) returns at most 5 entries.
  const recent = await repo.listRecentUsers(5);
  out('6a. listRecentUsers isArray', Array.isArray(recent));
  out('6b. listRecentUsers length (expect <=5)', Array.isArray(recent) ? recent.length : 'NOT_ARRAY');
  out('6c. listRecentUsers first email (no password)', recent && recent[0] ? recent[0].email : null);

  // 7. listAllUsersForAdmin returns an array.
  const all = await repo.listAllUsersForAdmin();
  out('7a. listAllUsersForAdmin isArray', Array.isArray(all));
  out('7b. listAllUsersForAdmin length', Array.isArray(all) ? all.length : 'NOT_ARRAY');

  // 8. Counts return numbers.
  const total = await repo.countAll();
  out('8a. countAll', { value: total, isNumber: typeof total === 'number' });
  const students = await repo.countByRole('student-cspc');
  out('8b. countByRole(student-cspc)', { value: students, isNumber: typeof students === 'number' });
  const instructors = await repo.countByRole('instructor');
  out('8c. countByRole(instructor)', { value: instructors, isNumber: typeof instructors === 'number' });
  const sinceEpoch = await repo.countUpdatedSince(new Date('1970-01-01T00:00:00Z'));
  out('8d. countUpdatedSince(epoch)', { value: sinceEpoch, isNumber: typeof sinceEpoch === 'number' });
  const now = new Date();
  const inMonth = await repo.countCreatedInMonth({
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1
  });
  out('8e. countCreatedInMonth (current UTC month)', { value: inMonth, isNumber: typeof inMonth === 'number' });

  // 9. Write methods still throw NotImplemented (spot-check one).
  let writeThrow = '';
  try {
    await repo.createLocalUser({});
    writeThrow = 'UNEXPECTEDLY_RETURNED_INSTEAD_OF_THROWING';
  } catch (e) {
    writeThrow = e && e.message ? e.message : String(e);
  }
  out('9. createLocalUser still throws', writeThrow);

  // eslint-disable-next-line no-console
  console.log('PROBE DONE');
})().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('PROBE FAILED:', e && e.stack ? e.stack : e);
  process.exit(1);
});
