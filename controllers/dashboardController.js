/* ========================================
   CampuSphere — Dashboard Controller
   Handles the main role-based Dashboard
   ======================================== */

const db = require('../config/db');

/**
 * GET /dashboard — Role-Based Dashboard
 */
exports.index = async (req, res) => {
  try {
    const [newsRows] = await db.query('SELECT * FROM news_announcements ORDER BY published_date DESC');

    // Get user data from session
    const user = req.session.user || null;

    // Fetch additional profile data if student
    let studentProfile = null;
    if (user && user.role === 'student-cspc') {
      const [profiles] = await db.query('SELECT * FROM student_profiles WHERE user_id = ?', [user.id]);

      // Helper: return the value if it's truthy, otherwise a consistent default
      const fallback = (val, def = 'Not yet set') => (val != null && val !== '') ? val : def;

      if (profiles.length > 0) {
        const sp = profiles[0];
        studentProfile = {
          name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unknown',
          studentId: fallback(sp.student_id_number),
          email: user.email,
          course: fallback(sp.course),
          yearLevel: fallback(sp.year_level),
          enrollmentStatus: fallback(sp.enrollment_status, 'Enrolled'),
          semester: fallback(sp.semester)
        };
      } else {
        // No profile row exists yet — show empty-state defaults
        studentProfile = {
          name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unknown',
          studentId: 'Not yet set',
          email: user.email,
          course: 'Not yet set',
          yearLevel: 'Not yet set',
          enrollmentStatus: 'Enrolled',
          semester: 'Not yet set'
        };
      }
    }

    // Fetch additional profile data if instructor
    let instructorProfile = null;
    if (user && user.role === 'instructor') {
      const [profiles] = await db.query('SELECT * FROM instructor_profiles WHERE user_id = ?', [user.id]);

      const fallback = (val, def = 'Not yet set') => (val != null && val !== '') ? val : def;

      if (profiles.length > 0) {
        const ip = profiles[0];
        instructorProfile = {
          name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unknown',
          employeeId: fallback(ip.employee_id),
          email: user.email,
          department: fallback(ip.department),
          position: fallback(ip.position),
          status: fallback(ip.status, 'Active'),
          assignedRooms: []
        };
      } else {
        // No profile row exists yet — show empty-state defaults
        instructorProfile = {
          name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unknown',
          employeeId: 'Not yet set',
          email: user.email,
          department: 'Not yet set',
          position: 'Not yet set',
          status: 'Active',
          assignedRooms: []
        };
      }
    }

    res.render('dashboard', {
      title: 'CampuSphere | Dashboard',
      description: 'CampuSphere — Role-Based Dashboard for CSPC campus management and navigation.',
      activeTab: 'tabDashboard',
      news: newsRows,
      user: user,
      studentProfile: studentProfile,
      instructorProfile: instructorProfile
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.render('dashboard', {
      title: 'CampuSphere | Dashboard',
      description: 'CampuSphere — Role-Based Dashboard for CSPC campus management and navigation.',
      activeTab: 'tabDashboard',
      news: [],
      user: null,
      studentProfile: null,
      instructorProfile: null
    });
  }
};
