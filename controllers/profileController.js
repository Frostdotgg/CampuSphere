/* ========================================
   CampuSphere — Profile Controller
   Handles profile update (Edit Profile)
   ======================================== */

const db = require('../config/db');

/**
 * POST /api/update-profile — Update user profile in DB + session
 */
exports.updateProfile = async (req, res) => {
  const user = req.session.user;
  if (!user) {
    return res.status(401).json({ error: 'Not logged in.' });
  }

  const { role, name, email, studentId, course, yearLevel,
    employeeId, department, position } = req.body;

  try {
    // 1. Only update name if it was provided in the request
    if (name && name.trim()) {
      const nameParts = name.trim().split(/\s+/);
      const first_name = nameParts[0] || '';
      const last_name = nameParts.slice(1).join(' ') || '';

      // 2. Update users table (name only — email is identity, don't change)
      await db.query(
        'UPDATE users SET first_name = ?, last_name = ? WHERE id = ?',
        [first_name, last_name, user.id]
      );

      // 3. Update session
      user.first_name = first_name;
      user.last_name = last_name;
    }

    // 4. Role-specific profile updates
    if (role === 'student-cspc') {
      // Check if student profile exists
      const [profiles] = await db.query('SELECT * FROM student_profiles WHERE user_id = ?', [user.id]);
      if (profiles.length > 0) {
        const existing = profiles[0];

        // Only overwrite fields that were explicitly sent in the request
        const updatedStudentId = ('studentId' in req.body) ? studentId : existing.student_id_number;
        const updatedCourse    = ('course' in req.body)    ? course    : existing.course;
        const updatedYearLevel = ('yearLevel' in req.body) ? yearLevel : existing.year_level;
        await db.query(
          `UPDATE student_profiles
           SET student_id_number = ?, course = ?, year_level = ?
           WHERE user_id = ?`,
          [updatedStudentId, updatedCourse, updatedYearLevel, user.id]
        );

        // Update session only with the resolved values
        user.student_id_number = updatedStudentId;
        user.course = updatedCourse;
        user.year_level = updatedYearLevel;
      } else {
        // Create profile if it doesn't exist
        await db.query(
          `INSERT INTO student_profiles (user_id, student_id_number, course, year_level, enrollment_status, semester)
           VALUES (?, ?, ?, ?, 'Enrolled', '2nd Semester 2025-2026')`,
          [user.id, studentId || '', course || '', yearLevel || '']
        );

        // Update session with the new data
        user.student_id_number = studentId || '';
        user.course = course || '';
        user.year_level = yearLevel || '';
      }
    }

    if (role === 'instructor') {
      // Check if instructor profile exists
      const [profiles] = await db.query('SELECT * FROM instructor_profiles WHERE user_id = ?', [user.id]);
      if (profiles.length > 0) {
        const existing = profiles[0];

        // Only overwrite fields that were explicitly sent in the request
        const updatedEmployeeId = ('employeeId' in req.body)  ? employeeId  : existing.employee_id;
        const updatedDepartment = ('department' in req.body)   ? department  : existing.department;
        const updatedPosition   = ('position' in req.body)     ? position    : existing.position;

        await db.query(
          `UPDATE instructor_profiles
           SET employee_id = ?, department = ?, position = ?
           WHERE user_id = ?`,
          [updatedEmployeeId, updatedDepartment, updatedPosition, user.id]
        );

        // Update session with the resolved values
        user.employee_id = updatedEmployeeId;
        user.department = updatedDepartment;
        user.position = updatedPosition;
      } else {
        // Create profile if it doesn't exist
        await db.query(
          `INSERT INTO instructor_profiles (user_id, employee_id, department, position, status)
           VALUES (?, ?, ?, ?, 'Active')`,
          [user.id, employeeId || '', department || '', position || '']
        );

        // Update session with the new data
        user.employee_id = employeeId || '';
        user.department = department || '';
        user.position = position || '';
      }
    }

    // Save session
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Failed to update session.' });
      }
      return res.json({ success: true });
    });

  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ error: 'Server error updating profile.' });
  }
};
