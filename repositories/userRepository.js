'use strict';

/* ========================================
   CampuSphere - User Repository
   Milestone 2, Sections 2.4 (read methods) and 2.5 (write methods).

   Server-only data-access boundary between auth/profile/admin-user
   controllers and the Supabase `users` / `*_profiles` tables. The
   boundary, callers, table list, and method semantics are documented
   in `database/supabase/REPOSITORY_BOUNDARIES.md` section 5.

   Status
     - Read methods implemented (Section 2.4):
         findUserByEmail, findUserById, loadRoleProfile,
         listRecentUsers, listAllUsersForAdmin,
         countAll, countByRole, countUpdatedSince, countCreatedInMonth,
         touchUserPresence, listUserPresence
     - Write methods implemented (Section 2.5) via the SQL functions in
       database/supabase/0003_auth_profile_functions.sql:
         createLocalUser              -> app_create_local_user
         createOAuthUserWithProfile   -> app_create_oauth_user_with_profile
         updateUserName               -> direct UPDATE on public.users
         updateUserProfileImage       -> validated Google-image UPDATE on public.users
         upsertStudentProfile         -> app_upsert_student_profile
         upsertInstructorProfile      -> app_upsert_instructor_profile
         upsertGuestProfile           -> app_upsert_guest_profile
     - Admin-managed user CRUD implemented (Section 2.10):
         createAdminManagedUser       -> app_create_admin_managed_user
         updateAdminManagedUser       -> direct UPDATE on public.users
         deleteUserById               -> direct DELETE on public.users
           (role-profile rows are removed by ON DELETE CASCADE declared
            in database/supabase/0001_initial_schema.sql section B.1)

   This module is not imported by any controller, route, middleware,
   view, or anything under public/ yet. Section 2.6 onward wires it in.

   Security
     - Server-only. Obtains the Supabase client via config/supabase.js
       (service role key, server-only).
     - Returns plain row-shaped objects and inserted ids. Never reads
       req, res, sessions, EJS locals, or browser globals.
     - Throws plain Error instances on unexpected Supabase/RPC errors.
       For the known SQL-function error codes raised by the 0003
       functions (MISSING_NAME, MISSING_STUDENT, MISSING_INSTRUCTOR,
       MISSING_GUEST, MISSING_OAUTH_SUBJECT, INVALID_ROLE,
       INVALID_ROLE_FOR_PUBLIC_REGISTRATION), the thrown Error's
       `.message` is exactly the code so the future controller's
       `err.message === 'MISSING_X'` checks (currently in
       authController.completeRegistrationPost) keep working.
     - The SUPABASE_SERVICE_ROLE_KEY value is never read, formatted, or
       logged by this module.
     - For Google OAuth user creation, this module computes a bcrypt
       placeholder hash from a fresh 32-byte random and passes that as
       the users.password value. NO real Google password is ever stored.
   ======================================== */

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { getSupabaseClient, hasSupabaseConfig } = require('../config/supabase');
const { normalizeMediaUrl } = require('../utils/mediaUrl');
const { normalizeGoogleProfileImageUrl } = require('../utils/googleProfileImage');
const { resolveAccountIdentityName } = require('../utils/accountIdentityName');

const SALT_ROUNDS = 10;
const USERS = 'users';
const USER_PRESENCE = 'user_presence';
const ROLE_PROFILE_TABLE = {
  'student-cspc': 'student_profiles',
  instructor: 'instructor_profiles',
  guest: 'guest_profiles'
};

// SQL-function error codes whose .message must pass through unchanged so
// the future controller layer can match them with === comparisons.
const KNOWN_RPC_ERRORS = new Set([
  'MISSING_NAME',
  'MISSING_STUDENT',
  'MISSING_INSTRUCTOR',
  'MISSING_GUEST',
  'MISSING_OAUTH_SUBJECT',
  'INVALID_ROLE',
  'INVALID_ROLE_FOR_PUBLIC_REGISTRATION'
]);

function ensureNoError(error, method) {
  if (error) {
    const msg = (error && error.message) ? error.message : String(error);
    throw new Error('userRepository.' + method + ': ' + msg);
  }
}

// Throw a plain Error suitable for the controller layer. If the underlying
// Supabase/PostgREST error carries one of the well-known SQL-function
// exception codes, surface it verbatim so existing controller error-code
// matches keep working. Otherwise wrap with the method prefix.
function throwRpcError(error, method) {
  const raw = (error && typeof error.message === 'string') ? error.message.trim() : '';
  if (raw && KNOWN_RPC_ERRORS.has(raw)) {
    const e = new Error(raw);
    e.code = raw;
    throw e;
  }
  throw new Error('userRepository.' + method + ': ' + (raw || String(error)));
}

function client() {
  if (!hasSupabaseConfig()) {
    throw new Error(
      'userRepository: Supabase client is not configured. ' +
      'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the server environment.'
    );
  }
  return getSupabaseClient();
}

// Escape PostgREST `ilike` pattern metacharacters so the caller's input is
// treated as literal text (case-insensitive equality), not a LIKE pattern.
function escapeLikePattern(s) {
  return s.replace(/[\\%_]/g, function (c) { return '\\' + c; });
}

// Trim a value to a non-empty string, or return null. Used for fields where
// blank input means "not provided" (OAuth profile fields, optional payload
// fields). Distinct from fieldOrNull below.
function trimOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// Coerce a value to string, or return null if it is null/undefined. Preserves
// the empty-string-vs-not-provided distinction that profileController.js
// relies on for partial updates (an explicit '' means "set to blank"; null
// means "leave the existing column value alone" on the UPDATE-first branch
// of the app_upsert_*_profile functions).
function fieldOrNull(v) {
  if (v === null || v === undefined) return null;
  return String(v);
}

// ---------------------------------------------------------------------------
// Read methods (Section 2.4)
// ---------------------------------------------------------------------------

/**
 * Look up one user by email. Case-insensitive, trims whitespace.
 * Returns the users row or null.
 */
async function findUserByEmail(rawEmail) {
  const email = typeof rawEmail === 'string' ? rawEmail.trim() : '';
  if (!email) return null;

  const sb = client();
  const escaped = escapeLikePattern(email);
  const { data, error } = await sb
    .from(USERS)
    .select('*')
    .ilike('email', escaped)
    .limit(1)
    .maybeSingle();
  ensureNoError(error, 'findUserByEmail');
  return data || null;
}

/**
 * Look up one user by primary key. Returns the users row or null.
 */
async function findUserById(id) {
  if (id === null || id === undefined || id === '') return null;

  const sb = client();
  const { data, error } = await sb
    .from(USERS)
    .select('*')
    .eq('id', id)
    .limit(1)
    .maybeSingle();
  ensureNoError(error, 'findUserById');
  return data || null;
}

/**
 * Return the role-specific profile row for the given user_id, or null.
 *   - student-cspc -> student_profiles
 *   - instructor   -> instructor_profiles
 *   - guest        -> guest_profiles
 *   - admin / unknown / missing role -> null (no profile table)
 */
async function loadRoleProfile(userId, role) {
  const table = ROLE_PROFILE_TABLE[role];
  if (!table) return null;
  if (userId === null || userId === undefined || userId === '') return null;

  const sb = client();
  const { data, error } = await sb
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  ensureNoError(error, 'loadRoleProfile');
  return data || null;
}

/**
 * Recent users, newest first. Backs the admin dashboard "recent users"
 * panel. limit is clamped to a positive integer no larger than 100.
 */
async function listRecentUsers(limit) {
  const n = Number(limit);
  const safeLimit = Number.isFinite(n) && n >= 1
    ? Math.min(Math.floor(n), 100)
    : 5;

  const sb = client();
  const { data, error } = await sb
    .from(USERS)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(safeLimit);
  ensureNoError(error, 'listRecentUsers');
  return Array.isArray(data) ? data : [];
}

/**
 * Full user list ordered by created_at DESC. Backs the admin users page.
 */
async function listAllUsersForAdmin() {
  const sb = client();
  const { data, error } = await sb
    .from(USERS)
    .select('id, username, email, role, first_name, last_name, created_at')
    .order('created_at', { ascending: false });
  ensureNoError(error, 'listAllUsersForAdmin');
  return Array.isArray(data) ? data : [];
}

/**
 * Atomically record a recent authenticated activity signal. The database
 * function owns the 60-second write throttle and its clock; callers cannot
 * supply a timestamp or a looser interval.
 */
async function touchUserPresence(userId) {
  if (userId === null || userId === undefined || userId === '') {
    throw new Error('userRepository.touchUserPresence: userId is required');
  }
  const sb = client();
  const { error } = await sb.rpc('app_touch_user_presence', {
    p_user_id: userId
  });
  ensureNoError(error, 'touchUserPresence');
}

/** Return only the presence rows needed by the administrator Users page. */
async function listUserPresence() {
  const sb = client();
  const { data, error } = await sb
    .from(USER_PRESENCE)
    // Ordering by the indexed timestamp keeps the read index-friendly while
    // still returning the complete one-row-per-user snapshot in one request.
    .select('user_id, last_seen_at')
    .order('last_seen_at', { ascending: true });
  ensureNoError(error, 'listUserPresence');
  return Array.isArray(data) ? data : [];
}

/** Total user count. Returns a number. */
async function countAll() {
  const sb = client();
  const { count, error } = await sb
    .from(USERS)
    .select('*', { count: 'exact', head: true });
  ensureNoError(error, 'countAll');
  return typeof count === 'number' ? count : 0;
}

/** Count of users with the given role. Returns a number. */
async function countByRole(role) {
  const sb = client();
  const { count, error } = await sb
    .from(USERS)
    .select('*', { count: 'exact', head: true })
    .eq('role', role);
  ensureNoError(error, 'countByRole');
  return typeof count === 'number' ? count : 0;
}

/**
 * Count of users whose updated_at >= the given timestamp. Accepts a JS Date
 * or any ISO-8601 / date-parseable string. Returns a number.
 */
async function countUpdatedSince(date) {
  const iso = date instanceof Date ? date.toISOString() : String(date);

  const sb = client();
  const { count, error } = await sb
    .from(USERS)
    .select('*', { count: 'exact', head: true })
    .gte('updated_at', iso);
  ensureNoError(error, 'countUpdatedSince');
  return typeof count === 'number' ? count : 0;
}

/**
 * Count of users created within the given calendar month (UTC boundaries).
 * `year` is a 4-digit year, `month` is 1-12. Returns a number.
 */
async function countCreatedInMonth(arg) {
  const params = arg || {};
  const y = Number(params.year);
  const m = Number(params.month);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
    throw new Error(
      'userRepository.countCreatedInMonth: { year, month } must be integers with month in 1..12'
    );
  }
  const startISO = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const endISO = new Date(Date.UTC(y, m, 1)).toISOString();

  const sb = client();
  const { count, error } = await sb
    .from(USERS)
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startISO)
    .lt('created_at', endISO);
  ensureNoError(error, 'countCreatedInMonth');
  return typeof count === 'number' ? count : 0;
}

// ---------------------------------------------------------------------------
// Write methods (Section 2.5)
// ---------------------------------------------------------------------------

/**
 * Create a local (non-OAuth) user atomically with an optional role profile.
 * Wraps the public.app_create_local_user SQL function (0003, redefined by 0009).
 *
 * Section 8.6 (Production Registration Trust Policy): migration 0009 redefines
 * the SQL function to accept role='guest' ONLY for this local public-registration
 * path; student-cspc / instructor / admin are rejected. Trusted institutional
 * roles come from verified Google OAuth domain mapping, seed data, or the
 * admin-managed flow (Section 2.10) — never from local self-registration.
 *
 * Caller is responsible for hashing the user-supplied password with bcrypt
 * before invoking. The repository never sees plaintext passwords.
 *
 * payload: {
 *   username, email, passwordHash, role, first_name, last_name,
 *   profile?: {
 *     // role='student-cspc'
 *     student_id_number?, course?, year_level?, semester?,
 *     // role='instructor'
 *     employee_id?, department?, position?,
 *     // role='guest'
 *     address?, phone_number?
 *   }
 * }
 *
 * Returns the inserted users.id (number).
 */
async function createLocalUser(payload) {
  const p = payload || {};
  const username = typeof p.username === 'string' ? p.username.trim() : '';
  const email = typeof p.email === 'string' ? p.email.trim() : '';
  const passwordHash = typeof p.passwordHash === 'string' ? p.passwordHash : '';
  const role = typeof p.role === 'string' ? p.role.trim() : '';
  const first_name = typeof p.first_name === 'string' ? p.first_name : '';
  const last_name = typeof p.last_name === 'string' ? p.last_name : '';

  if (!username) throw new Error('userRepository.createLocalUser: username is required');
  if (!email) throw new Error('userRepository.createLocalUser: email is required');
  if (!passwordHash) throw new Error('userRepository.createLocalUser: passwordHash is required');
  if (!role) throw new Error('userRepository.createLocalUser: role is required');
  if (!first_name) throw new Error('userRepository.createLocalUser: first_name is required');

  const profile = (p.profile && typeof p.profile === 'object') ? p.profile : {};

  const params = {
    p_username: username,
    p_email: email,
    p_password_hash: passwordHash,
    p_role: role,
    p_first_name: first_name,
    p_last_name: last_name,
    p_student_id_number: trimOrNull(profile.student_id_number),
    p_course: fieldOrNull(profile.course),
    p_year_level: trimOrNull(profile.year_level),
    p_semester: trimOrNull(profile.semester),
    p_employee_id: trimOrNull(profile.employee_id),
    p_department: fieldOrNull(profile.department),
    p_position: fieldOrNull(profile.position),
    p_address: trimOrNull(profile.address),
    p_phone_number: trimOrNull(profile.phone_number)
  };

  const sb = client();
  const { data, error } = await sb.rpc('app_create_local_user', params);
  if (error) throwRpcError(error, 'createLocalUser');
  const id = typeof data === 'number' ? data : Number(data);
  if (!Number.isFinite(id)) {
    throw new Error('userRepository.createLocalUser: RPC returned no user id');
  }
  return id;
}

/**
 * Create a Google OAuth user + role profile atomically. Wraps
 * public.app_create_oauth_user_with_profile from 0003.
 *
 * Mirrors the controller signature
 *   controllers/authController.js -> createOAuthUserWithProfile(pending, body)
 * so Section 2.7 can swap the call site with no shape change.
 *
 * Behavior:
 *   - Resolves first_name / last_name from the pending verified Google
 *     identity, falling back to the normalized email prefix. Request
 *     body.fullName is deliberately ignored.
 *   - Derives username from the email local part (max 50 chars).
 *   - Computes a bcrypt placeholder hash from 32 random bytes. NO real
 *     Google password is ever stored.
 *   - Refuses role='admin' (the SQL function refuses it too; the JS-side
 *     check fails earlier with the same error code).
 *   - Performs role-specific required-field validation matching the
 *     existing controller error codes (MISSING_STUDENT / MISSING_GUEST /
 *     MISSING_OAUTH_SUBJECT). Instructor OAuth identity is complete from the
 *     verified Google claims; its legacy profile fields are deliberately
 *     ignored. The resolver supplies a safe non-empty name before the SQL
 *     function is called, so a submitted fullName can never affect identity.
 *
 * Returns the inserted users.id (number). On failure, throws a plain Error
 * with one of the documented codes as `.message` (and `.code`) for the
 * controller to translate to a user-facing message.
 */
async function createOAuthUserWithProfile(pending, body) {
  const p = pending || {};
  const b = body || {};
  const email = typeof p.email === 'string' ? p.email.trim().toLowerCase() : '';
  if (!email) {
    throw new Error('userRepository.createOAuthUserWithProfile: pending.email is required');
  }

  const identity = resolveAccountIdentityName({
    givenName: p.givenName,
    familyName: p.familyName,
    fullName: p.fullName,
    email
  });
  const first_name = identity.firstName;
  const last_name = identity.lastName;

  const role = typeof p.role === 'string' ? p.role.trim() : '';
  if (!role) {
    throw new Error('userRepository.createOAuthUserWithProfile: pending.role is required');
  }

  const oauthSubject = typeof p.googleSub === 'string' ? p.googleSub.trim() : '';
  if (!oauthSubject) {
    const err = new Error('MISSING_OAUTH_SUBJECT');
    err.code = 'MISSING_OAUTH_SUBJECT';
    throw err;
  }

  // JS-side role-specific required-field checks matching authController.
  if (role === 'student-cspc') {
    const sid = typeof b.studentId === 'string' ? b.studentId.trim() : '';
    if (!sid) {
      const err = new Error('MISSING_STUDENT');
      err.code = 'MISSING_STUDENT';
      throw err;
    }
  } else if (role === 'guest') {
    const addr = typeof b.address === 'string' ? b.address.trim() : '';
    const ph = typeof b.phone === 'string' ? b.phone.trim() : '';
    if (!addr || !ph) {
      const err = new Error('MISSING_GUEST');
      err.code = 'MISSING_GUEST';
      throw err;
    }
  }

  const rawUser = email.split('@')[0] || 'user';
  const username = rawUser.slice(0, 50);
  const picture = normalizeGoogleProfileImageUrl(p.picture);

  // Bcrypt placeholder. Caller never sees the value; it is never logged.
  const placeholderHash = await bcrypt.hash(
    crypto.randomBytes(32).toString('hex'),
    SALT_ROUNDS
  );

  const params = {
    p_username: username,
    p_email: email,
    p_placeholder_password_hash: placeholderHash,
    p_role: role,
    p_first_name: first_name,
    p_last_name: last_name,
    p_profile_image_url: picture,
    p_oauth_subject: oauthSubject,
    p_student_id_number: trimOrNull(b.studentId),
    p_course: trimOrNull(b.course),
    p_year_level: trimOrNull(b.yearLevel),
    p_semester: trimOrNull(b.semester),
    // These instructor fields are retired from self-registration. Keep the
    // RPC signature stable for already-deployed clients, but never forward
    // request values from this OAuth path.
    p_employee_id: role === 'instructor' ? null : trimOrNull(b.employeeId),
    p_department: role === 'instructor' ? null : trimOrNull(b.department),
    p_position: role === 'instructor' ? null : trimOrNull(b.position),
    p_address: trimOrNull(b.address),
    p_phone_number: trimOrNull(b.phone)
  };

  const sb = client();
  const { data, error } = await sb.rpc('app_create_oauth_user_with_profile', params);
  if (error) throwRpcError(error, 'createOAuthUserWithProfile');
  const id = typeof data === 'number' ? data : Number(data);
  if (!Number.isFinite(id)) {
    throw new Error('userRepository.createOAuthUserWithProfile: RPC returned no user id');
  }
  return id;
}

/**
 * Update first_name / last_name on a users row and bump updated_at.
 * Direct .update() rather than an RPC (single-table; no atomicity wrapper
 * needed). Returns void.
 */
async function updateUserName(userId, fields) {
  if (userId === null || userId === undefined || userId === '') {
    throw new Error('userRepository.updateUserName: userId is required');
  }
  const f = fields || {};
  const hasFirst = Object.prototype.hasOwnProperty.call(f, 'first_name');
  const hasLast = Object.prototype.hasOwnProperty.call(f, 'last_name');
  if (!hasFirst && !hasLast) {
    throw new Error('userRepository.updateUserName: provide first_name and/or last_name');
  }

  const patch = { updated_at: new Date().toISOString() };
  if (hasFirst) patch.first_name = f.first_name == null ? '' : String(f.first_name);
  if (hasLast) patch.last_name = f.last_name == null ? '' : String(f.last_name);

  const sb = client();
  const { error } = await sb.from(USERS).update(patch).eq('id', userId);
  ensureNoError(error, 'updateUserName');
}

/**
 * Store a validated Google profile-picture URL and bump updated_at.
 * The controller performs the optional-sync decision; this repository method
 * remains fail-closed so callers cannot write an arbitrary external URL.
 */
async function updateUserProfileImage(userId, imageUrl) {
  if (userId === null || userId === undefined || userId === '') {
    throw new Error('userRepository.updateUserProfileImage: userId is required');
  }
  const picture = normalizeGoogleProfileImageUrl(imageUrl);
  if (!picture) {
    throw new Error('userRepository.updateUserProfileImage: invalid Google profile image URL');
  }

  const sb = client();
  const { error } = await sb.from(USERS).update({
    profile_image_url: picture,
    updated_at: new Date().toISOString()
  }).eq('id', userId);
  ensureNoError(error, 'updateUserProfileImage');
}

/**
 * Upsert a student_profiles row via public.app_upsert_student_profile.
 * Null fields are preserved as "leave the existing column value alone" by
 * the SQL function's UPDATE-first branch; empty strings are honored as
 * active sets. Returns void.
 */
async function upsertStudentProfile(userId, fields) {
  if (userId === null || userId === undefined || userId === '') {
    throw new Error('userRepository.upsertStudentProfile: userId is required');
  }
  const f = fields || {};
  const params = {
    p_user_id: userId,
    p_student_id_number: fieldOrNull(f.student_id_number),
    p_course: fieldOrNull(f.course),
    p_year_level: fieldOrNull(f.year_level),
    p_enrollment_status: fieldOrNull(f.enrollment_status),
    p_semester: fieldOrNull(f.semester)
  };

  const sb = client();
  const { error } = await sb.rpc('app_upsert_student_profile', params);
  if (error) throwRpcError(error, 'upsertStudentProfile');
}

/**
 * Upsert an instructor_profiles row via public.app_upsert_instructor_profile.
 * Returns void.
 */
async function upsertInstructorProfile(userId, fields) {
  if (userId === null || userId === undefined || userId === '') {
    throw new Error('userRepository.upsertInstructorProfile: userId is required');
  }
  const f = fields || {};
  const params = {
    p_user_id: userId,
    p_employee_id: fieldOrNull(f.employee_id),
    p_department: fieldOrNull(f.department),
    p_position: fieldOrNull(f.position),
    p_status: fieldOrNull(f.status)
  };

  const sb = client();
  const { error } = await sb.rpc('app_upsert_instructor_profile', params);
  if (error) throwRpcError(error, 'upsertInstructorProfile');
}

/**
 * Upsert a guest_profiles row via public.app_upsert_guest_profile.
 * Returns void.
 */
async function upsertGuestProfile(userId, fields) {
  if (userId === null || userId === undefined || userId === '') {
    throw new Error('userRepository.upsertGuestProfile: userId is required');
  }
  const f = fields || {};
  const params = {
    p_user_id: userId,
    p_address: fieldOrNull(f.address),
    p_phone_number: fieldOrNull(f.phone_number)
  };

  const sb = client();
  const { error } = await sb.rpc('app_upsert_guest_profile', params);
  if (error) throwRpcError(error, 'upsertGuestProfile');
}

/**
 * R6: atomically update users.first_name/last_name AND the role profile row
 * in ONE server-side transaction via public.app_update_user_profile (0008).
 * Replaces the previous two-call Supabase profile-update path (updateUserName
 * + app_upsert_*_profile), which could leave a partial name update if the
 * profile write failed.
 *
 * plan: {
 *   updateName?: boolean, first_name?, last_name?,   // when updateName
 *   updateProfile?: boolean, role?,                  // when updateProfile
 *   profile?: {                                      // role-specific fields
 *     student_id_number?, course?, year_level?, enrollment_status?, semester?,
 *     employee_id?, department?, position?, status?,
 *     address?, phone_number?
 *   }
 * }
 *
 * Profile fields use the same fieldOrNull mapping as the upsert methods, so
 * '' means "set to blank" and a missing/null field means "leave alone" on the
 * UPDATE-first branch. Returns void.
 */
async function updateUserProfileAtomic(userId, plan) {
  if (userId === null || userId === undefined || userId === '') {
    throw new Error('userRepository.updateUserProfileAtomic: userId is required');
  }
  const p = plan || {};
  const prof = (p.profile && typeof p.profile === 'object') ? p.profile : {};
  const updateName = !!p.updateName;
  const updateProfile = !!p.updateProfile;

  const params = {
    p_user_id: userId,
    p_update_name: updateName,
    p_first_name: updateName ? (p.first_name == null ? '' : String(p.first_name)) : null,
    p_last_name: updateName ? (p.last_name == null ? '' : String(p.last_name)) : null,
    p_update_profile: updateProfile,
    p_role: updateProfile ? String(p.role == null ? '' : p.role) : null,
    p_student_id_number: fieldOrNull(prof.student_id_number),
    p_course: fieldOrNull(prof.course),
    p_year_level: fieldOrNull(prof.year_level),
    p_enrollment_status: fieldOrNull(prof.enrollment_status),
    p_semester: fieldOrNull(prof.semester),
    p_employee_id: fieldOrNull(prof.employee_id),
    p_department: fieldOrNull(prof.department),
    p_position: fieldOrNull(prof.position),
    p_status: fieldOrNull(prof.status),
    p_address: fieldOrNull(prof.address),
    p_phone_number: fieldOrNull(prof.phone_number)
  };

  const sb = client();
  const { error } = await sb.rpc('app_update_user_profile', params);
  if (error) throwRpcError(error, 'updateUserProfileAtomic');
}

// ---------------------------------------------------------------------------
// Admin-managed user CRUD (Section 2.10)
// ---------------------------------------------------------------------------
//
// Backs controllers/adminUsersController.js -> createUser / updateUser /
// deleteUser when AUTH_DATA_SOURCE=supabase. All three methods assume the
// caller has already enforced admin authorization at the route layer
// (routes/admin.js -> router.use(requireRole('admin'))).
//
// createAdminManagedUser uses the app_create_admin_managed_user SQL function
// from 0003 so users + optional role profile are created atomically. The
// admin form today only collects {first_name, last_name, email, password,
// role}, so the profile parameters are typically blank/NULL; the SQL
// function then skips the role-profile insert and only writes a users row
// (mirrors the current MySQL controller, which also only writes users).
//
// updateAdminManagedUser and deleteUserById use direct .update()/.delete()
// against public.users:
//   - update is single-table (the admin form only edits users-row fields),
//     so no multi-table atomicity wrapper is needed; this matches the
//     existing controllers/profileController.js update path that also uses
//     a direct UPDATE for users.
//   - delete relies on the ON DELETE CASCADE foreign keys on
//     student_profiles.user_id / instructor_profiles.user_id /
//     guest_profiles.user_id (0001 section B.1) to clean up role-profile
//     rows in the same transaction. The MySQL controller manually deletes
//     student_profiles first because MySQL CASCADE rules are not declared
//     in database/schema.sql; that manual step is not needed here.
// See database/supabase/0003_auth_profile_functions.sql notes (bottom) and
// REPOSITORY_BOUNDARIES.md section 10.1 for the atomicity rationale.

/**
 * Atomically create an admin-managed user (and an optional role profile)
 * via public.app_create_admin_managed_user. Accepts all four canonical
 * roles including 'admin'; intended ONLY to be called from an admin-only
 * route (routes/admin.js).
 *
 * Caller is responsible for hashing the user-supplied password with bcrypt
 * before invoking. The repository never sees plaintext passwords.
 *
 * payload: {
 *   username, email, passwordHash, role, first_name, last_name,
 *   profile?: {  // all fields optional; blank/missing => skip profile insert
 *     // role='student-cspc'
 *     student_id_number?, course?, year_level?, semester?,
 *     // role='instructor'
 *     employee_id?, department?, position?,
 *     // role='guest'
 *     address?, phone_number?
 *   }
 * }
 *
 * Returns the inserted users.id (number). Throws a plain Error on failure;
 * the SQL function's INVALID_ROLE code is surfaced verbatim as .message
 * (and .code) so the controller can map it to a 400 response.
 */
async function createAdminManagedUser(payload) {
  const p = payload || {};
  const username = typeof p.username === 'string' ? p.username.trim() : '';
  const email = typeof p.email === 'string' ? p.email.trim() : '';
  const passwordHash = typeof p.passwordHash === 'string' ? p.passwordHash : '';
  const role = typeof p.role === 'string' ? p.role.trim() : '';
  const first_name = typeof p.first_name === 'string' ? p.first_name : '';
  const last_name = typeof p.last_name === 'string' ? p.last_name : '';

  if (!username) throw new Error('userRepository.createAdminManagedUser: username is required');
  if (!email) throw new Error('userRepository.createAdminManagedUser: email is required');
  if (!passwordHash) throw new Error('userRepository.createAdminManagedUser: passwordHash is required');
  if (!role) throw new Error('userRepository.createAdminManagedUser: role is required');
  if (!first_name) throw new Error('userRepository.createAdminManagedUser: first_name is required');

  const profile = (p.profile && typeof p.profile === 'object') ? p.profile : {};
  const params = {
    p_username: username,
    p_email: email,
    p_password_hash: passwordHash,
    p_role: role,
    p_first_name: first_name,
    p_last_name: last_name,
    p_student_id_number: trimOrNull(profile.student_id_number),
    p_course: fieldOrNull(profile.course),
    p_year_level: trimOrNull(profile.year_level),
    p_semester: trimOrNull(profile.semester),
    p_employee_id: trimOrNull(profile.employee_id),
    p_department: fieldOrNull(profile.department),
    p_position: fieldOrNull(profile.position),
    p_address: trimOrNull(profile.address),
    p_phone_number: trimOrNull(profile.phone_number)
  };

  const sb = client();
  const { data, error } = await sb.rpc('app_create_admin_managed_user', params);
  if (error) throwRpcError(error, 'createAdminManagedUser');
  const id = typeof data === 'number' ? data : Number(data);
  if (!Number.isFinite(id)) {
    throw new Error('userRepository.createAdminManagedUser: RPC returned no user id');
  }
  return id;
}

/**
 * Update mutable fields on a users row via direct .update(). Only the
 * fields explicitly present on `fields` are patched; everything else is
 * left untouched. `updated_at` is always refreshed.
 *
 * Allowed fields: username, email, role, first_name, last_name, passwordHash.
 * The repository validates `role` against the canonical four-role set
 * (defense in depth; the controller already validates). All other inputs
 * are coerced to strings and passed through.
 *
 * Returns void. Throws an Error with code 'INVALID_ROLE' if a role is
 * passed that is not one of the canonical four; throws a wrapped Error on
 * any Supabase-side failure.
 */
async function updateAdminManagedUser(userId, fields) {
  if (userId === null || userId === undefined || userId === '') {
    throw new Error('userRepository.updateAdminManagedUser: userId is required');
  }
  const f = fields || {};
  const VALID_ROLES = ['student-cspc', 'instructor', 'admin', 'guest'];

  const patch = { updated_at: new Date().toISOString() };
  if (Object.prototype.hasOwnProperty.call(f, 'username')) {
    patch.username = f.username == null ? '' : String(f.username);
  }
  if (Object.prototype.hasOwnProperty.call(f, 'email')) {
    patch.email = f.email == null ? '' : String(f.email);
  }
  if (Object.prototype.hasOwnProperty.call(f, 'role')) {
    const r = String(f.role == null ? '' : f.role).trim();
    if (!VALID_ROLES.includes(r)) {
      const e = new Error('INVALID_ROLE');
      e.code = 'INVALID_ROLE';
      throw e;
    }
    patch.role = r;
  }
  if (Object.prototype.hasOwnProperty.call(f, 'first_name')) {
    patch.first_name = f.first_name == null ? '' : String(f.first_name);
  }
  if (Object.prototype.hasOwnProperty.call(f, 'last_name')) {
    patch.last_name = f.last_name == null ? '' : String(f.last_name);
  }
  if (Object.prototype.hasOwnProperty.call(f, 'passwordHash')
      && typeof f.passwordHash === 'string'
      && f.passwordHash.length > 0) {
    patch.password = f.passwordHash;
  }

  const sb = client();
  const { error } = await sb.from(USERS).update(patch).eq('id', userId);
  ensureNoError(error, 'updateAdminManagedUser');
}

/**
 * Delete a users row by primary key. Role-profile rows for the same
 * user_id are removed automatically by the ON DELETE CASCADE foreign keys
 * declared on student_profiles / instructor_profiles / guest_profiles in
 * 0001_initial_schema.sql section B.1.
 *
 * Returns void. Existence check, self-delete prevention, and 404 mapping
 * stay in the controller layer per REPOSITORY_BOUNDARIES.md section 10.2.
 */
async function deleteUserById(userId) {
  if (userId === null || userId === undefined || userId === '') {
    throw new Error('userRepository.deleteUserById: userId is required');
  }
  const sb = client();
  const { error } = await sb.from(USERS).delete().eq('id', userId);
  ensureNoError(error, 'deleteUserById');
}

module.exports = {
  findUserByEmail,
  findUserById,
  loadRoleProfile,
  listRecentUsers,
  listAllUsersForAdmin,
  touchUserPresence,
  listUserPresence,
  countAll,
  countByRole,
  countUpdatedSince,
  countCreatedInMonth,
  createLocalUser,
  createOAuthUserWithProfile,
  updateUserName,
  updateUserProfileImage,
  upsertStudentProfile,
  upsertInstructorProfile,
  upsertGuestProfile,
  updateUserProfileAtomic,
  createAdminManagedUser,
  updateAdminManagedUser,
  deleteUserById
};
