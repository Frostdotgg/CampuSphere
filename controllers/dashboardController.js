/* ========================================
   CampuSphere — Dashboard Controller
   Handles the main role-based Dashboard
   ======================================== */

const db = require('../config/db');
const authDataSource = require('../config/authDataSource');
const userRepository = require('../repositories/userRepository');
const contentDataSource = require('../config/contentDataSource');
const contentRepository = require('../repositories/contentRepository');
const { logServerError } = require('../utils/serverLog');

/**
 * GET /dashboard — Role-Based Dashboard
 */
exports.index = async (req, res) => {
  try {
    // Get user data from session
    const user = req.session.user || null;
    const role = (user && user.role) ? user.role : null;

    // Role-targeted announcement filtering (Milestone 4, Phase 2 Section 5).
    // Only published announcements addressed to everyone ('all') plus those
    // targeted at the logged-in user's role are shown. Drafts (no
    // published_date) never appear. Filtering is done in SQL, not the client.
    let newsRows;
    if (contentDataSource.isSupabase()) {
      // Same rules, applied in the repository: published only
      // (published_date IS NOT NULL), audience 'all' OR the user's role,
      // ordered by published_date DESC. A null role yields the 'all' subset.
      newsRows = await contentRepository.listAnnouncementsForRole(role);
    } else if (role) {
      [newsRows] = await db.query(
        `SELECT * FROM news_announcements
         WHERE published_date IS NOT NULL
           AND (audience = 'all' OR audience = ?)
         ORDER BY published_date DESC`,
        [role]
      );
    } else {
      [newsRows] = await db.query(
        `SELECT * FROM news_announcements
         WHERE published_date IS NOT NULL
           AND audience = 'all'
         ORDER BY published_date DESC`
      );
    }

    const useSupabase = authDataSource.isSupabase();

    // Fetch additional profile data if student
    let studentProfile = null;
    if (user && user.role === 'student-cspc') {
      let sp = null;
      if (useSupabase) {
        sp = await userRepository.loadRoleProfile(user.id, 'student-cspc');
      } else {
        const [profiles] = await db.query('SELECT * FROM student_profiles WHERE user_id = ?', [user.id]);
        sp = profiles.length > 0 ? profiles[0] : null;
      }

      // Helper: return the value if it's truthy, otherwise a consistent default
      const fallback = (val, def = 'Not yet set') => (val != null && val !== '') ? val : def;

      if (sp) {
        studentProfile = {
          name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unknown',
          studentId: fallback(sp.student_id_number),
          email: user.email,
          course: fallback(sp.course),
          yearLevel: fallback(sp.year_level)
        };
      } else {
        // No profile row exists yet — show empty-state defaults
        studentProfile = {
          name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unknown',
          studentId: 'Not yet set',
          email: user.email,
          course: 'Not yet set',
          yearLevel: 'Not yet set'
        };
      }
    }

    // Fetch additional profile data if instructor
    let instructorProfile = null;
    if (user && user.role === 'instructor') {
      let ip = null;
      if (useSupabase) {
        ip = await userRepository.loadRoleProfile(user.id, 'instructor');
      } else {
        const [profiles] = await db.query('SELECT * FROM instructor_profiles WHERE user_id = ?', [user.id]);
        ip = profiles.length > 0 ? profiles[0] : null;
      }

      const fallback = (val, def = 'Not yet set') => (val != null && val !== '') ? val : def;

      if (ip) {
        instructorProfile = {
          name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unknown',
          employeeId: fallback(ip.employee_id),
          email: user.email,
          department: fallback(ip.department),
          position: fallback(ip.position),
          status: fallback(ip.status, 'Active')
        };
      } else {
        // No profile row exists yet — show empty-state defaults
        instructorProfile = {
          name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unknown',
          employeeId: 'Not yet set',
          email: user.email,
          department: 'Not yet set',
          position: 'Not yet set',
          status: 'Active'
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
    logServerError('dashboard.index', req);
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
