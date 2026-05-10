/* ========================================
   CampuSphere — Admin Users API Controller
   Handles CRUD operations for user management
   ======================================== */

const db = require('../config/db');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

/**
 * POST /api/admin/users — Create a new user
 */
exports.createUser = async (req, res) => {
  const { first_name, last_name, email, password, role } = req.body;

  // Validate required fields
  if (!first_name || !last_name || !email || !password || !role) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  // Validate role
  const validRoles = ['student-cspc', 'instructor', 'admin', 'guest'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role specified.' });
  }

  try {
    // Check if email already exists
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'A user with this email already exists.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Generate username from email
    const username = email.split('@')[0];

    // Insert user
    const [result] = await db.query(
      'INSERT INTO users (username, email, password, role, first_name, last_name) VALUES (?, ?, ?, ?, ?, ?)',
      [username, email, hashedPassword, role, first_name.trim(), last_name.trim()]
    );

    // Fetch the newly created user to return it
    const [newUser] = await db.query('SELECT id, username, email, role, first_name, last_name, created_at, updated_at FROM users WHERE id = ?', [result.insertId]);

    return res.status(201).json({
      success: true,
      message: 'User created successfully.',
      user: newUser[0]
    });

  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

/**
 * PUT /api/admin/users/:id — Update an existing user
 */
exports.updateUser = async (req, res) => {
  const userId = req.params.id;
  const { first_name, last_name, email, role, password } = req.body;

  // Validate required fields
  if (!first_name || !last_name || !email || !role) {
    return res.status(400).json({ success: false, message: 'First name, last name, email, and role are required.' });
  }

  // Validate role
  const validRoles = ['student-cspc', 'instructor', 'admin', 'guest'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role specified.' });
  }

  try {
    // Check if user exists
    const [existingUser] = await db.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (existingUser.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Check if email is taken by another user
    const [emailCheck] = await db.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
    if (emailCheck.length > 0) {
      return res.status(409).json({ success: false, message: 'This email is already used by another account.' });
    }

    // Generate updated username from email
    const username = email.split('@')[0];

    // Build update query — include password only if provided
    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      await db.query(
        'UPDATE users SET username = ?, email = ?, password = ?, role = ?, first_name = ?, last_name = ?, updated_at = NOW() WHERE id = ?',
        [username, email, hashedPassword, role, first_name.trim(), last_name.trim(), userId]
      );
    } else {
      await db.query(
        'UPDATE users SET username = ?, email = ?, role = ?, first_name = ?, last_name = ?, updated_at = NOW() WHERE id = ?',
        [username, email, role, first_name.trim(), last_name.trim(), userId]
      );
    }

    // Fetch updated user
    const [updatedUser] = await db.query('SELECT id, username, email, role, first_name, last_name, created_at, updated_at FROM users WHERE id = ?', [userId]);

    return res.status(200).json({
      success: true,
      message: 'User updated successfully.',
      user: updatedUser[0]
    });

  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

/**
 * DELETE /api/admin/users/:id — Delete a user
 */
exports.deleteUser = async (req, res) => {
  const userId = req.params.id;

  try {
    // Check if user exists
    const [existingUser] = await db.query('SELECT id, role FROM users WHERE id = ?', [userId]);
    if (existingUser.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Prevent admin from deleting themselves
    if (req.session.user && req.session.user.id === parseInt(userId)) {
      return res.status(403).json({ success: false, message: 'You cannot delete your own account.' });
    }

    // Delete student profile first if exists (foreign key)
    await db.query('DELETE FROM student_profiles WHERE user_id = ?', [userId]);

    // Delete the user
    await db.query('DELETE FROM users WHERE id = ?', [userId]);

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully.'
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};
