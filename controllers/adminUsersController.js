/* ========================================
   CampuSphere — Admin Users API Controller
   Handles CRUD operations for user management

   Backend selection (Milestone 2, Section 2.10):
     AUTH_DATA_SOURCE=mysql    -> existing direct MySQL queries (default).
     AUTH_DATA_SOURCE=supabase -> repositories/userRepository.js path.

   The Supabase branch routes writes through the user repository, which
   wraps multi-table inserts in the app_create_admin_managed_user SQL
   function (database/supabase/0003_auth_profile_functions.sql) and lets
   the ON DELETE CASCADE foreign keys on student_profiles /
   instructor_profiles / guest_profiles handle role-profile cleanup on
   delete. Validation, role allowlist, duplicate-email response, JSON
   response shape, HTTP status codes, and self-delete prevention are kept
   identical to the MySQL branch.

   Repository methods consumed (Supabase branch only):
     userRepository.findUserByEmail
     userRepository.findUserById
     userRepository.createAdminManagedUser
     userRepository.updateAdminManagedUser
     userRepository.deleteUserById

   This controller is protected upstream by routes/admin.js -> requireRole
   ('admin'). Non-admin requests are rejected by middleware/roleAuth.js
   (wantsJson() returns true for '/api/' paths, so unauthenticated/non-
   admin requests get JSON 401/403, not an HTML redirect).
   ======================================== */

const db = require('../config/db');
const bcrypt = require('bcrypt');
const authDataSource = require('../config/authDataSource');
const userRepository = require('../repositories/userRepository');
const auditService = require('../services/auditService');
const { revokeUserSessions } = require('../services/sessionRevocation');
const V = require('../utils/adminValidation');

const SALT_ROUNDS = 10;

// R7: canonical role set + per-operation key allowlists. The admin user form
// only collects these fields; role-profile fields are intentionally rejected.
const USER_ROLES = ['student-cspc', 'instructor', 'admin', 'guest'];
const USER_CREATE_KEYS = ['first_name', 'last_name', 'email', 'password', 'role'];
const USER_UPDATE_KEYS = ['first_name', 'last_name', 'email', 'role', 'password'];

/**
 * Validate + normalize a user create/update body. Returns { ok, value } with
 * exactly { first_name, last_name, email, role, password? } (password present
 * only when supplied), or { ok:false, message } for a 400. Performs no DB work.
 * Password is required on create and optional (blank = "no change") on update.
 */
function validateUserPayload(body, requirePassword) {
  const shape = V.validateBody(body, requirePassword ? USER_CREATE_KEYS : USER_UPDATE_KEYS);
  if (!shape.ok) return shape;

  const first = V.requiredString(body.first_name, 'First name', 100);
  if (!first.ok) return first;
  const last = V.requiredString(body.last_name, 'Last name', 100);
  if (!last.ok) return last;
  const email = V.validateEmail(body.email);
  if (!email.ok) return email;
  const role = V.allowedValue(body.role, 'role', USER_ROLES);
  if (!role.ok) return { ok: false, message: 'Invalid role specified.' };

  const value = { first_name: first.value, last_name: last.value, email: email.value, role: role.value };

  const rawPw = body.password;
  const pwProvided = typeof rawPw === 'string' ? rawPw.trim() !== '' : (rawPw !== undefined && rawPw !== null);
  if (requirePassword && !pwProvided) {
    return { ok: false, message: 'Password is required.' };
  }
  if (pwProvided) {
    const pw = V.validatePassword(rawPw);
    if (!pw.ok) return pw;
    value.password = pw.value;
  }
  return { ok: true, value };
}

// Best-effort audit of a successful admin mutation. Fire-and-forget: it never
// throws, never blocks, and never changes the JSON response. The actor is the
// admin in session (the route is gated by requireRole('admin')).
function auditAdminMutation(req, action, targetType, targetId, message) {
  const actor = (req.session && req.session.user) || {};
  auditService.record({
    event_type: 'admin_mutation',
    action,
    outcome: 'success',
    actor_user_id: actor.id,
    actor_role: actor.role,
    target_type: targetType,
    target_id: targetId,
    message
  }).catch(() => {});
}

// Best-effort audit of an admin self-delete authorization denial. Fire-and-
// forget: it never throws, never blocks, and never changes the 403 response.
function auditSelfDeleteDenied(req, userId) {
  const actor = (req.session && req.session.user) || {};
  auditService.record({
    event_type: 'authorization',
    action: 'access.denied',
    outcome: 'denied',
    actor_user_id: actor.id,
    actor_role: actor.role,
    target_type: 'user',
    target_id: userId,
    message: 'Admin self-delete was denied.'
  }).catch(() => {});
}

// Safe public projection of a users row. Mirrors the column list selected
// by the MySQL branch (`SELECT id, username, email, role, first_name,
// last_name, created_at, updated_at`) so the Supabase branch returns the
// exact same JSON shape. Never includes password, oauth_subject, or any
// other sensitive column.
const SAFE_USER_FIELDS = [
  'id',
  'username',
  'email',
  'role',
  'first_name',
  'last_name',
  'created_at',
  'updated_at'
];
function pickSafeUser(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const key of SAFE_USER_FIELDS) out[key] = row[key];
  return out;
}

/**
 * POST /api/admin/users — Create a new user
 */
exports.createUser = async (req, res) => {
  const check = validateUserPayload(req.body, true);
  if (!check.ok) {
    return res.status(400).json({ success: false, message: check.message });
  }
  const value = check.value; // { first_name, last_name, email, role, password }

  try {
    // ===== Supabase branch (AUTH_DATA_SOURCE=supabase) =====
    if (authDataSource.isSupabase()) {
      const sbExisting = await userRepository.findUserByEmail(value.email);
      if (sbExisting) {
        return res.status(409).json({ success: false, message: 'A user with this email already exists.' });
      }

      const sbHashedPassword = await bcrypt.hash(value.password, SALT_ROUNDS);
      const sbUsername = String(value.email).split('@')[0];

      let sbUserId;
      try {
        sbUserId = await userRepository.createAdminManagedUser({
          username: sbUsername,
          email: value.email,
          passwordHash: sbHashedPassword,
          role: value.role,
          first_name: value.first_name,
          last_name: value.last_name
          // No `profile`: the admin form does not collect role-specific
          // fields, so the SQL function will only insert the users row.
        });
      } catch (err) {
        if (err && err.code === 'INVALID_ROLE') {
          return res.status(400).json({ success: false, message: 'Invalid role specified.' });
        }
        throw err;
      }

      const sbNewUser = await userRepository.findUserById(sbUserId);
      auditAdminMutation(req, 'admin.user.create', 'user', sbUserId, 'Admin created a user.');
      return res.status(201).json({
        success: true,
        message: 'User created successfully.',
        user: pickSafeUser(sbNewUser)
      });
    }

    // ===== MySQL branch (default) =====
    // Check if email already exists
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [value.email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'A user with this email already exists.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(value.password, SALT_ROUNDS);

    // Generate username from email
    const username = value.email.split('@')[0];

    // Insert user
    const [result] = await db.query(
      'INSERT INTO users (username, email, password, role, first_name, last_name) VALUES (?, ?, ?, ?, ?, ?)',
      [username, value.email, hashedPassword, value.role, value.first_name, value.last_name]
    );

    // Fetch the newly created user to return it
    const [newUser] = await db.query('SELECT id, username, email, role, first_name, last_name, created_at, updated_at FROM users WHERE id = ?', [result.insertId]);

    auditAdminMutation(req, 'admin.user.create', 'user', result.insertId, 'Admin created a user.');
    return res.status(201).json({
      success: true,
      message: 'User created successfully.',
      user: newUser[0]
    });

  } catch (error) {
    console.error('Error creating user: unexpected failure.');
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

/**
 * PUT /api/admin/users/:id — Update an existing user
 */
exports.updateUser = async (req, res) => {
  const userId = V.parseRouteId(req.params.id);
  if (userId === null) {
    return res.status(400).json({ success: false, message: 'Invalid user id.' });
  }

  const check = validateUserPayload(req.body, false);
  if (!check.ok) {
    return res.status(400).json({ success: false, message: check.message });
  }
  const value = check.value; // { first_name, last_name, email, role, password? }

  try {
    // ===== Supabase branch (AUTH_DATA_SOURCE=supabase) =====
    if (authDataSource.isSupabase()) {
      const sbExistingUser = await userRepository.findUserById(userId);
      if (!sbExistingUser) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      // M1: a role change or a password change must invalidate the target's
      // live sessions after the update commits (below), so a stale cookie
      // cannot keep the old role / old-credential access.
      const sbRoleChanged = String(sbExistingUser.role) !== String(value.role);
      const sbPasswordChanged = Boolean(value.password);

      // Duplicate email check. findUserByEmail is case-insensitive (matches
      // the login lookup), and we exclude the current user from the
      // collision check by comparing numeric ids.
      const sbEmailOwner = await userRepository.findUserByEmail(value.email);
      if (sbEmailOwner && Number(sbEmailOwner.id) !== Number(sbExistingUser.id)) {
        return res.status(409).json({ success: false, message: 'This email is already used by another account.' });
      }

      const sbUsername = String(value.email).split('@')[0];
      const sbPatch = {
        username: sbUsername,
        email: value.email,
        role: value.role,
        first_name: value.first_name,
        last_name: value.last_name
      };
      if (value.password) {
        sbPatch.passwordHash = await bcrypt.hash(value.password, SALT_ROUNDS);
      }

      try {
        await userRepository.updateAdminManagedUser(userId, sbPatch);
      } catch (err) {
        if (err && err.code === 'INVALID_ROLE') {
          return res.status(400).json({ success: false, message: 'Invalid role specified.' });
        }
        throw err;
      }

      const sbUpdated = await userRepository.findUserById(userId);

      // M1: revoke the target's live sessions when role/password changed. The
      // update already committed; a revocation failure returns a sanitized 500
      // (no success audit) so the admin can retry rather than silently leaving
      // a stale elevated session live.
      if (sbRoleChanged || sbPasswordChanged) {
        try {
          await revokeUserSessions(userId);
        } catch (revokeErr) {
          return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
        }
      }

      auditAdminMutation(req, 'admin.user.update', 'user', userId, 'Admin updated a user.');
      return res.status(200).json({
        success: true,
        message: 'User updated successfully.',
        user: pickSafeUser(sbUpdated)
      });
    }

    // ===== MySQL branch (default) =====
    // Check if user exists (select role too, to detect a role change for M1).
    const [existingUser] = await db.query('SELECT id, role FROM users WHERE id = ?', [userId]);
    if (existingUser.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // M1: a role change or a password change must invalidate the target's live
    // sessions after the update commits (below).
    const roleChanged = String(existingUser[0].role) !== String(value.role);
    const passwordChanged = Boolean(value.password);

    // Check if email is taken by another user
    const [emailCheck] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [value.email, userId]);
    if (emailCheck.length > 0) {
      return res.status(409).json({ success: false, message: 'This email is already used by another account.' });
    }

    // Generate updated username from email
    const username = value.email.split('@')[0];

    // Build update query — include password only if provided
    if (value.password) {
      const hashedPassword = await bcrypt.hash(value.password, SALT_ROUNDS);
      await db.query(
        'UPDATE users SET username = ?, email = ?, password = ?, role = ?, first_name = ?, last_name = ?, updated_at = NOW() WHERE id = ?',
        [username, value.email, hashedPassword, value.role, value.first_name, value.last_name, userId]
      );
    } else {
      await db.query(
        'UPDATE users SET username = ?, email = ?, role = ?, first_name = ?, last_name = ?, updated_at = NOW() WHERE id = ?',
        [username, value.email, value.role, value.first_name, value.last_name, userId]
      );
    }

    // Fetch updated user
    const [updatedUser] = await db.query('SELECT id, username, email, role, first_name, last_name, created_at, updated_at FROM users WHERE id = ?', [userId]);

    // M1: revoke the target's live sessions when role/password changed. The
    // update already committed; a revocation failure returns a sanitized 500
    // (no success audit) so the admin can retry.
    if (roleChanged || passwordChanged) {
      try {
        await revokeUserSessions(userId);
      } catch (revokeErr) {
        return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
      }
    }

    auditAdminMutation(req, 'admin.user.update', 'user', userId, 'Admin updated a user.');
    return res.status(200).json({
      success: true,
      message: 'User updated successfully.',
      user: updatedUser[0]
    });

  } catch (error) {
    console.error('Error updating user: unexpected failure.');
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

/**
 * DELETE /api/admin/users/:id — Delete a user
 */
exports.deleteUser = async (req, res) => {
  const userId = V.parseRouteId(req.params.id);
  if (userId === null) {
    return res.status(400).json({ success: false, message: 'Invalid user id.' });
  }

  try {
    // ===== Supabase branch (AUTH_DATA_SOURCE=supabase) =====
    if (authDataSource.isSupabase()) {
      const sbExistingUser = await userRepository.findUserById(userId);
      if (!sbExistingUser) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      // Prevent admin from deleting themselves. userId is a canonical positive
      // integer (parseRouteId) and session.user.id is a number, so a direct
      // strict comparison is correct.
      if (req.session.user && req.session.user.id === userId) {
        auditSelfDeleteDenied(req, userId);
        return res.status(403).json({ success: false, message: 'You cannot delete your own account.' });
      }

      // Role-profile rows are removed automatically by the ON DELETE CASCADE
      // foreign keys declared in 0001_initial_schema.sql section B.1, so no
      // manual profile delete is needed here.
      await userRepository.deleteUserById(userId);

      // M1: a deleted user's persisted sessions carry no FK to users, so they
      // survive the delete until expiry — revoke them now. A revocation failure
      // returns a sanitized 500 (no success audit) so the admin can retry.
      try {
        await revokeUserSessions(userId);
      } catch (revokeErr) {
        return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
      }

      auditAdminMutation(req, 'admin.user.delete', 'user', userId, 'Admin deleted a user.');
      return res.status(200).json({
        success: true,
        message: 'User deleted successfully.'
      });
    }

    // ===== MySQL branch (default, unchanged) =====
    // Check if user exists
    const [existingUser] = await db.query('SELECT id, role FROM users WHERE id = ?', [userId]);
    if (existingUser.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Prevent admin from deleting themselves (userId is a canonical integer).
    if (req.session.user && req.session.user.id === userId) {
      auditSelfDeleteDenied(req, userId);
      return res.status(403).json({ success: false, message: 'You cannot delete your own account.' });
    }

    // Delete student profile first if exists (foreign key)
    await db.query('DELETE FROM student_profiles WHERE user_id = ?', [userId]);

    // Delete the user
    await db.query('DELETE FROM users WHERE id = ?', [userId]);

    // M1: a deleted user's persisted sessions carry no FK to users, so they
    // survive the delete until expiry — revoke them now. A revocation failure
    // returns a sanitized 500 (no success audit) so the admin can retry.
    try {
      await revokeUserSessions(userId);
    } catch (revokeErr) {
      return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }

    auditAdminMutation(req, 'admin.user.delete', 'user', userId, 'Admin deleted a user.');
    return res.status(200).json({
      success: true,
      message: 'User deleted successfully.'
    });

  } catch (error) {
    console.error('Error deleting user: unexpected failure.');
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};
