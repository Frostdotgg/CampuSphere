/* ========================================
   CampuSphere — Profile Controller
   Handles profile update (Edit Profile)
   ======================================== */

const db = require('../config/db');
const authDataSource = require('../config/authDataSource');
const userRepository = require('../repositories/userRepository');
const auditService = require('../services/auditService');
const { clearSessionCookie } = require('../config/sessionConfig');

const MAX_NAME_LENGTH = 100;
const MAX_STUDENT_ID_LENGTH = 50;
const MAX_COURSE_LENGTH = 100;
const MAX_YEAR_LEVEL_LENGTH = 50;
const MAX_ADDRESS_LENGTH = 255;
const MAX_PHONE_LENGTH = 50;

const IMMUTABLE_FIELDS = ['role', 'email', 'id', 'password'];
const IDENTITY_MANAGED_ROLES = new Set(['student-cspc', 'guest', 'instructor']);

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// R6: run the staged MySQL profile writes (users name + role profile) inside
// ONE transaction so they commit or roll back together — no partial
// multi-table write. Supabase mode does NOT use this; it issues a single
// atomic RPC (app_update_user_profile) instead. The caller mutates session
// state only after the writes succeed.
async function runMysqlProfileTx(ops) {
  if (!ops.length) return;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const op of ops) {
      await op(conn);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// R6: the profile DID commit but the session could not be refreshed. Do not
// misreport a rollback. Invalidate the now-stale session (so no authenticated
// half-updated session lingers) and tell the user truthfully to sign in again.
// No raw error, session ID, cookie, or profile payload is logged or returned.
function invalidateSessionAfterCommit(req, res) {
  const respond = () => {
    clearSessionCookie(res);
    return res.status(500).json({
      success: false,
      message: 'Profile was saved, but the session could not be refreshed. Please sign in again.'
    });
  };
  if (req.session && typeof req.session.destroy === 'function') {
    req.session.destroy(() => respond());
  } else {
    respond();
  }
}

/**
 * POST /api/update-profile — Update user profile in DB + session
 */
exports.updateProfile = async (req, res) => {
  const sessionUser = req.session.user;
  if (!sessionUser) {
    return fail(res, 401, 'Not logged in.');
  }

  // 1. The server controls names for Google-linked participant roles. Reject
  // an explicit name field rather than silently accepting a client-side
  // tampering attempt; administrator name editing remains supported below.
  const role = sessionUser.role;
  if (IDENTITY_MANAGED_ROLES.has(role) &&
      Object.prototype.hasOwnProperty.call(req.body, 'name')) {
    return fail(res, 400, 'Full name is managed by your account identity and cannot be changed.');
  }

  // 2. Reject other identity-tampering fields outright.
  for (const field of IMMUTABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      return fail(res, 400, `Field "${field}" cannot be changed through this endpoint.`);
    }
  }

  // 3. Authoritative role comes from the session, never the request body.
  const useSupabase = authDataSource.isSupabase();
  const userId = sessionUser.id;

  try {
    // R6: validate first, then STAGE the DB writes (writeOps) and the session
    // changes (pendingSession). Nothing is written and req.session.user is NOT
    // mutated until validation passes; the session is only updated after the
    // staged writes commit. So a validation 400 or a write failure leaves the
    // previous DB and session state intact.
    const pendingSession = {};
    const writeOps = []; // MySQL: each is (conn) => query, run in one transaction
    // R6 (Codex follow-up): Supabase performs the whole profile update in ONE
    // atomic RPC (app_update_user_profile). Stage WHAT to change here, then
    // issue a single call so users-name + role-profile commit/roll back together.
    const sbPlan = { updateName: false, first_name: null, last_name: null, updateProfile: false, role: null, profile: {} };

    // 4. Validate an administrator name if explicitly provided; stage its
    // write + session change. Locked participant roles returned above before
    // reaching this branch.
    if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
      const rawName = trimString(req.body.name);
      if (!rawName) {
        return fail(res, 400, 'Name cannot be blank.');
      }
      if (rawName.length > MAX_NAME_LENGTH) {
        return fail(res, 400, `Name must be ${MAX_NAME_LENGTH} characters or fewer.`);
      }

      const nameParts = rawName.split(/\s+/);
      const first_name = nameParts[0] || '';
      const last_name = nameParts.slice(1).join(' ') || '';

      writeOps.push((conn) =>
        conn.query(
          'UPDATE users SET first_name = ?, last_name = ? WHERE id = ?',
          [first_name, last_name, userId]
        )
      );
      sbPlan.updateName = true;
      sbPlan.first_name = first_name;
      sbPlan.last_name = last_name;
      pendingSession.first_name = first_name;
      pendingSession.last_name = last_name;
    }

    // 5. Role-specific profile updates — branch on the session role only.
    if (role === 'student-cspc') {
      const hasStudentId = Object.prototype.hasOwnProperty.call(req.body, 'studentId');
      const hasCourse = Object.prototype.hasOwnProperty.call(req.body, 'course');
      const hasYearLevel = Object.prototype.hasOwnProperty.call(req.body, 'yearLevel');

      const studentId = hasStudentId ? trimString(req.body.studentId) : null;
      const course = hasCourse ? trimString(req.body.course) : null;
      const yearLevel = hasYearLevel ? trimString(req.body.yearLevel) : null;

      if (hasStudentId && studentId.length > MAX_STUDENT_ID_LENGTH) {
        return fail(res, 400, `Student ID must be ${MAX_STUDENT_ID_LENGTH} characters or fewer.`);
      }
      if (hasCourse && course.length > MAX_COURSE_LENGTH) {
        return fail(res, 400, `Course must be ${MAX_COURSE_LENGTH} characters or fewer.`);
      }
      if (hasYearLevel && !yearLevel) {
        return fail(res, 400, 'Year level cannot be blank.');
      }
      if (hasYearLevel && yearLevel.length > MAX_YEAR_LEVEL_LENGTH) {
        return fail(res, 400, `Year level must be ${MAX_YEAR_LEVEL_LENGTH} characters or fewer.`);
      }

      let existing;
      if (useSupabase) {
        existing = await userRepository.loadRoleProfile(userId, 'student-cspc');
      } else {
        const [profiles] = await db.query(
          'SELECT * FROM student_profiles WHERE user_id = ?',
          [userId]
        );
        existing = profiles.length > 0 ? profiles[0] : null;
      }

      if (existing) {
        const updatedStudentId = hasStudentId ? studentId : existing.student_id_number;
        const updatedCourse = hasCourse ? course : existing.course;
        const updatedYearLevel = hasYearLevel ? yearLevel : existing.year_level;

        if (hasStudentId && !updatedStudentId) {
          return fail(res, 400, 'Student ID cannot be blank.');
        }

        writeOps.push((conn) =>
          conn.query(
            `UPDATE student_profiles
               SET student_id_number = ?, course = ?, year_level = ?
             WHERE user_id = ?`,
            [updatedStudentId, updatedCourse, updatedYearLevel, userId]
          )
        );
        sbPlan.updateProfile = true;
        sbPlan.role = 'student-cspc';
        sbPlan.profile = {
          student_id_number: hasStudentId ? studentId : null,
          course: hasCourse ? course : null,
          year_level: hasYearLevel ? yearLevel : null
        };

        pendingSession.student_id_number = updatedStudentId;
        pendingSession.course = updatedCourse;
        pendingSession.year_level = updatedYearLevel;
      } else {
        if (!studentId) {
          return fail(res, 400, 'Student ID is required.');
        }

        writeOps.push((conn) =>
          conn.query(
            `INSERT INTO student_profiles
               (user_id, student_id_number, course, year_level, enrollment_status, semester)
             VALUES (?, ?, ?, ?, 'Enrolled', '2nd Semester 2025-2026')`,
            [userId, studentId, course || '', yearLevel || '']
          )
        );
        sbPlan.updateProfile = true;
        sbPlan.role = 'student-cspc';
        sbPlan.profile = {
          student_id_number: studentId,
          course: course || '',
          year_level: yearLevel || '',
          enrollment_status: 'Enrolled',
          semester: '2nd Semester 2025-2026'
        };

        pendingSession.student_id_number = studentId;
        pendingSession.course = course || '';
        pendingSession.year_level = yearLevel || '';
      }
    } else if (role === 'guest') {
      const hasAddress = Object.prototype.hasOwnProperty.call(req.body, 'address');
      const hasPhone = Object.prototype.hasOwnProperty.call(req.body, 'phone');

      const address = hasAddress ? trimString(req.body.address) : null;
      const phone = hasPhone ? trimString(req.body.phone) : null;

      if (hasAddress && address.length > MAX_ADDRESS_LENGTH) {
        return fail(res, 400, `Address must be ${MAX_ADDRESS_LENGTH} characters or fewer.`);
      }
      if (hasPhone && phone.length > MAX_PHONE_LENGTH) {
        return fail(res, 400, `Phone must be ${MAX_PHONE_LENGTH} characters or fewer.`);
      }

      let existing;
      if (useSupabase) {
        existing = await userRepository.loadRoleProfile(userId, 'guest');
      } else {
        const [profiles] = await db.query(
          'SELECT * FROM guest_profiles WHERE user_id = ?',
          [userId]
        );
        existing = profiles.length > 0 ? profiles[0] : null;
      }

      if (existing) {
        const updatedAddress = hasAddress ? address : existing.address;
        const updatedPhone = hasPhone ? phone : existing.phone_number;

        if (hasAddress && !updatedAddress) {
          return fail(res, 400, 'Address cannot be blank.');
        }
        if (hasPhone && !updatedPhone) {
          return fail(res, 400, 'Phone cannot be blank.');
        }

        writeOps.push((conn) =>
          conn.query(
            `UPDATE guest_profiles
               SET address = ?, phone_number = ?
             WHERE user_id = ?`,
            [updatedAddress, updatedPhone, userId]
          )
        );
        sbPlan.updateProfile = true;
        sbPlan.role = 'guest';
        sbPlan.profile = {
          address: hasAddress ? address : null,
          phone_number: hasPhone ? phone : null
        };

        pendingSession.address = updatedAddress;
        pendingSession.phone_number = updatedPhone;
      } else if (hasAddress || hasPhone) {
        if (!address || !phone) {
          return fail(res, 400, 'Address and phone are both required to create a guest profile.');
        }

        writeOps.push((conn) =>
          conn.query(
            `INSERT INTO guest_profiles (user_id, address, phone_number)
             VALUES (?, ?, ?)`,
            [userId, address, phone]
          )
        );
        sbPlan.updateProfile = true;
        sbPlan.role = 'guest';
        sbPlan.profile = {
          address,
          phone_number: phone
        };

        pendingSession.address = address;
        pendingSession.phone_number = phone;
      }
    }

    // 6. Execute the writes. MySQL: one transaction over the staged ops.
    //    Supabase: a single atomic RPC (name + role profile commit together).
    if (useSupabase) {
      if (sbPlan.updateName || sbPlan.updateProfile) {
        await userRepository.updateUserProfileAtomic(userId, sbPlan);
      }
    } else {
      await runMysqlProfileTx(writeOps);
    }

    // 7. Only NOW, after the DB write has committed, mutate the session.
    Object.assign(sessionUser, pendingSession);

    req.session.save((err) => {
      if (err) {
        // The profile is committed but the session could not be refreshed.
        return invalidateSessionAfterCommit(req, res);
      }
      // Only audit once the profile write AND the session save have both
      // succeeded. Best-effort; never blocks or alters the JSON response.
      auditService.record({
        event_type: 'profile',
        action: 'profile.update',
        outcome: 'success',
        actor_user_id: sessionUser.id,
        actor_role: role,
        target_type: 'user',
        target_id: sessionUser.id,
        message: 'Profile updated.'
      }).catch(() => {});
      return res.json({ success: true });
    });
  } catch (error) {
    console.error('Profile update error: unexpected failure.');
    return fail(res, 500, 'Server error updating profile.');
  }
};
