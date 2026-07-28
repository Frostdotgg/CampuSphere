'use strict';

/* ========================================
   CampuSphere - userRepository write-method probe
   Milestone 2, Section 2.5 verification script.

   Creates uniquely-named throwaway accounts in the Supabase project
   to exercise every write method, then deletes them in the cleanup
   step at the end. Seeded demo accounts (admin@cspc.edu.ph,
   aaron.lasprillas@cspc.edu.ph, etc.) are never touched.

   Throwaway identifier convention:
     email    : probe-2.5-<role>-<run-id>@probe.invalid
     username : probe-2.5-<role>-<run-id-slice>   (<= 50 chars)
     oauth    : probe-2.5-oauth-sub-<run-id>      (synthetic, not Google)

   Run:   node scripts/userRepository-write-probe.js

   Safety:
     - No password hashes, OAuth subjects, or secrets are printed.
     - Throwaway rows are deleted via the Supabase client (FK CASCADE
       removes the matching role profile rows).
     - On error, cleanup still runs in the finally block.
   ======================================== */

require('dotenv').config();

const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;
const PROBE_PREFIX = 'probe-2.5-';

const runId = Date.now() + '-' + Math.random().toString(36).slice(2, 8);

function makeEmail(role) {
  return PROBE_PREFIX + role + '-' + runId + '@probe.invalid';
}

function makeUsername(role) {
  // username is varchar(50). Slice the runId to fit.
  return (PROBE_PREFIX + role + '-' + runId).slice(0, 50);
}

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
    has_oauth_subject: typeof u.oauth_subject === 'string' && u.oauth_subject.length > 0
  };
}

function out(label, value) {
  // eslint-disable-next-line no-console
  console.log(label + ':', typeof value === 'string' ? value : JSON.stringify(value));
}

async function deleteUserById(sb, id) {
  const { error } = await sb.from('users').delete().eq('id', id);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('cleanup warning for user id', id, ':', error.message);
    return false;
  }
  return true;
}

(async () => {
  const repo = require('../repositories/userRepository');
  const { getSupabaseClient } = require('../config/supabase');
  const sb = getSupabaseClient();

  const createdIds = [];
  let step = 0;
  let allOk = true;

  // Pre-baseline: count rows so we can assert cleanup at the end.
  const baselineCount = await repo.countAll();
  out('0a. baseline countAll', baselineCount);

  try {
    // ----- 1. createLocalUser (student-cspc) with optional profile -------
    step = 1;
    const studentPasswordHash = await bcrypt.hash('probe-password-do-not-use', SALT_ROUNDS);
    const studentId = await repo.createLocalUser({
      username: makeUsername('stu'),
      email: makeEmail('stu'),
      passwordHash: studentPasswordHash,
      role: 'student-cspc',
      first_name: 'Probe',
      last_name: 'Student',
      profile: {
        student_id_number: 'PROBE-' + runId,
        course: 'BS Probe Studies',
        year_level: '1st Year',
        semester: '1st Semester 2026-2027'
      }
    });
    createdIds.push(studentId);
    out('1. createLocalUser(student-cspc) returned id (typeof number)',
      { id: studentId, isFiniteNumber: Number.isFinite(studentId) });

    // ----- 2. createLocalUser(role=admin) must fail -----------------------
    step = 2;
    let adminBlocked = '';
    try {
      const id = await repo.createLocalUser({
        username: makeUsername('admin-attempt'),
        email: makeEmail('admin-attempt'),
        passwordHash: studentPasswordHash,
        role: 'admin',
        first_name: 'Probe',
        last_name: 'Admin'
      });
      // If this returns, record the id so cleanup can remove it.
      createdIds.push(id);
      adminBlocked = 'UNEXPECTED_RETURN_id=' + id;
      allOk = false;
    } catch (e) {
      adminBlocked = e && e.message ? e.message : String(e);
    }
    out('2. createLocalUser(role=admin) blocked', adminBlocked);

    // ----- 3. findUserById round-trips the throwaway student --------------
    step = 3;
    const fetched = await repo.findUserById(studentId);
    out('3. findUserById(throwaway student)', redactUser(fetched));

    // ----- 4. updateUserName ---------------------------------------------
    step = 4;
    const beforeUpdate = await repo.findUserById(studentId);
    const beforeUpdated = beforeUpdate && beforeUpdate.updated_at;
    await repo.updateUserName(studentId, { first_name: 'Probe2', last_name: 'StudentRenamed' });
    const afterUpdate = await repo.findUserById(studentId);
    out('4a. updateUserName names', {
      first_name: afterUpdate && afterUpdate.first_name,
      last_name: afterUpdate && afterUpdate.last_name
    });
    out('4b. updateUserName bumped updated_at',
      !!(afterUpdate && afterUpdate.updated_at && afterUpdate.updated_at !== beforeUpdated));

    // ----- 5. upsertStudentProfile - update existing row, partial fields --
    step = 5;
    const studentProfileBefore = await repo.loadRoleProfile(studentId, 'student-cspc');
    await repo.upsertStudentProfile(studentId, {
      course: 'BS Probe Studies (updated)',
      year_level: null,         // null means leave alone
      enrollment_status: null,  // null means leave alone
      semester: null
    });
    const studentProfileAfter = await repo.loadRoleProfile(studentId, 'student-cspc');
    out('5a. student profile partial-update result', {
      student_id_number: studentProfileAfter && studentProfileAfter.student_id_number,
      course: studentProfileAfter && studentProfileAfter.course,
      year_level_preserved:
        !!(studentProfileBefore && studentProfileAfter
           && studentProfileAfter.year_level === studentProfileBefore.year_level),
      enrollment_status_preserved:
        !!(studentProfileBefore && studentProfileAfter
           && studentProfileAfter.enrollment_status === studentProfileBefore.enrollment_status),
      semester_preserved:
        !!(studentProfileBefore && studentProfileAfter
           && studentProfileAfter.semester === studentProfileBefore.semester)
    });

    // ----- 6. createLocalUser(instructor) + upsertInstructorProfile -------
    step = 6;
    const instructorPasswordHash = await bcrypt.hash('probe-password-do-not-use', SALT_ROUNDS);
    const instructorIdNew = await repo.createLocalUser({
      username: makeUsername('ins'),
      email: makeEmail('ins'),
      passwordHash: instructorPasswordHash,
      role: 'instructor',
      first_name: 'Probe',
      last_name: 'Instructor',
      profile: {
        employee_id: 'PROBE-EMP-' + runId,
        department: 'Probe Dept',
        position: 'Probe Position'
      }
    });
    createdIds.push(instructorIdNew);
    await repo.upsertInstructorProfile(instructorIdNew, {
      department: 'Probe Dept (updated)',
      // employee_id intentionally null on the update branch: leave alone
      employee_id: null,
      position: null,
      status: null
    });
    const instructorProfile = await repo.loadRoleProfile(instructorIdNew, 'instructor');
    out('6. upsertInstructorProfile result', {
      employee_id_preserved: !!(instructorProfile && instructorProfile.employee_id === 'PROBE-EMP-' + runId),
      department: instructorProfile && instructorProfile.department,
      position_preserved: !!(instructorProfile && instructorProfile.position === 'Probe Position'),
      status: instructorProfile && instructorProfile.status
    });

    // ----- 7. createLocalUser(guest) + upsertGuestProfile -----------------
    step = 7;
    const guestPasswordHash = await bcrypt.hash('probe-password-do-not-use', SALT_ROUNDS);
    const guestIdNew = await repo.createLocalUser({
      username: makeUsername('gue'),
      email: makeEmail('gue'),
      passwordHash: guestPasswordHash,
      role: 'guest',
      first_name: 'Probe',
      last_name: 'Guest',
      profile: {
        address: '123 Probe St',
        phone_number: '09000000000'
      }
    });
    createdIds.push(guestIdNew);
    await repo.upsertGuestProfile(guestIdNew, {
      address: '456 Probe Ave (updated)',
      phone_number: null // leave alone
    });
    const guestProfile = await repo.loadRoleProfile(guestIdNew, 'guest');
    out('7. upsertGuestProfile result', {
      address: guestProfile && guestProfile.address,
      phone_number_preserved: !!(guestProfile && guestProfile.phone_number === '09000000000')
    });

    // ----- 8. createOAuthUserWithProfile (Google) -------------------------
    step = 8;
    const oauthEmail = makeEmail('oauth');
    const oauthSubject = 'probe-2.5-oauth-sub-' + runId;
    const oauthId = await repo.createOAuthUserWithProfile(
      {
        email: oauthEmail,
        role: 'guest',
        googleSub: oauthSubject,
        givenName: 'OAuthProbe',
        familyName: 'Guest',
        fullName: 'OAuthProbe Guest',
        picture: ''
      },
      {
        address: 'OAuth probe street',
        phone: '09111111111'
      }
    );
    createdIds.push(oauthId);
    const oauthUser = await repo.findUserById(oauthId);
    out('8a. createOAuthUserWithProfile returned id', { id: oauthId, isFiniteNumber: Number.isFinite(oauthId) });
    out('8b. oauth user shape', redactUser(oauthUser));
    const oauthProfile = await repo.loadRoleProfile(oauthId, 'guest');
    out('8c. oauth role profile present', {
      hasAddress: !!(oauthProfile && oauthProfile.address),
      hasPhone: !!(oauthProfile && oauthProfile.phone_number)
    });

    // ----- 9. Error path: missing required field --------------------------
    step = 9;
    let missingFieldErr = '';
    try {
      await repo.createLocalUser({
        // username intentionally omitted
        email: makeEmail('missing'),
        passwordHash: studentPasswordHash,
        role: 'guest',
        first_name: 'X',
        last_name: 'Y'
      });
      missingFieldErr = 'UNEXPECTED_RETURN';
      allOk = false;
    } catch (e) {
      missingFieldErr = e && e.message ? e.message : String(e);
    }
    out('9. createLocalUser missing required field throws', missingFieldErr);

    // ----- 10. Error path: OAuth missing OAuth subject --------------------
    step = 10;
    let missingOauth = '';
    try {
      await repo.createOAuthUserWithProfile(
        {
          email: makeEmail('oauth-bad'),
          role: 'guest',
          googleSub: '',
          fullName: 'Bad Probe'
        },
        { address: 'x', phone: 'y' }
      );
      missingOauth = 'UNEXPECTED_RETURN';
      allOk = false;
    } catch (e) {
      missingOauth = e && e.message ? e.message : String(e);
    }
    out('10. createOAuthUserWithProfile missing googleSub throws code', missingOauth);

  } catch (e) {
    allOk = false;
    // eslint-disable-next-line no-console
    console.error('PROBE FAILED at step', step, ':', e && e.stack ? e.stack : e);
  } finally {
    // ---- Cleanup: delete every throwaway id created during this run -----
    // eslint-disable-next-line no-console
    console.log('cleanup: deleting', createdIds.length, 'throwaway user id(s)');
    let cleanupFailures = 0;
    for (const id of createdIds) {
      const ok = await deleteUserById(sb, id);
      if (!ok) cleanupFailures++;
    }
    const afterCount = await repo.countAll();
    out('11. countAll after cleanup', afterCount);
    out('11. cleanup matches baseline', afterCount === baselineCount);
    if (cleanupFailures > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        'WARNING:', cleanupFailures, 'throwaway row(s) failed to clean up. ' +
        'Find them with:  SELECT id, email FROM users WHERE email LIKE \'' + PROBE_PREFIX + '%@probe.invalid\';'
      );
    }
  }

  // eslint-disable-next-line no-console
  console.log(allOk ? 'PROBE DONE: ALL_OK' : 'PROBE DONE: WITH_ISSUES');
  process.exit(allOk ? 0 : 1);
})().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('PROBE FAILED (top-level):', e && e.stack ? e.stack : e);
  process.exit(1);
});
