/* ========================================
   CampuSphere — Admin Controller
   Handles all Admin panel pages
   ======================================== */

const db = require('../config/db');

/**
 * GET /admin — Admin Dashboard
 */
exports.index = async (req, res) => {
  try {
    const [recentUsers] = await db.query('SELECT * FROM users ORDER BY created_at DESC LIMIT 5');
    const [recentNews] = await db.query('SELECT * FROM news_announcements ORDER BY published_date DESC LIMIT 4');
    
    // Stats — real counts from the database
    const [[{totalUsers}]] = await db.query('SELECT COUNT(*) as totalUsers FROM users');
    const [[{totalStudents}]] = await db.query('SELECT COUNT(*) as totalStudents FROM users WHERE role = "student-cspc"');
    const [[{totalNews}]] = await db.query('SELECT COUNT(*) as totalNews FROM news_announcements');
    const [[{totalBuildings}]] = await db.query('SELECT COUNT(*) as totalBuildings FROM buildings');

    res.render('admin/index', {
      title: 'CampusSphere Admin | Dashboard',
      description: 'CampusSphere Admin Dashboard — Manage campus data, users, and settings.',
      activePage: 'dashboard',
      recentUsers,
      recentNews,
      stats: { totalUsers, totalStudents, totalNews, totalMapViews: totalBuildings }
    });
  } catch (error) {
    console.error('Error in admin index:', error);
    res.render('admin/index', {
      title: 'CampusSphere Admin | Dashboard',
      description: 'CampusSphere Admin Dashboard — Manage campus data, users, and settings.',
      activePage: 'dashboard',
      recentUsers: [],
      recentNews: [],
      stats: { totalUsers: 0, totalStudents: 0, totalNews: 0, totalMapViews: 0 }
    });
  }
};

/**
 * GET /admin/users — User Management
 */
exports.users = async (req, res) => {
  try {
    const [users] = await db.query('SELECT * FROM users ORDER BY created_at DESC');

    // Real counts derived from actual data
    const total = users.length;
    // Consider users who logged in (updated) within the last 30 days as "active"
    const [[{activeCount}]] = await db.query(
      'SELECT COUNT(*) as activeCount FROM users WHERE updated_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)'
    );
    const inactiveCount = total - activeCount;
    const [[{newThisMonth}]] = await db.query(
      'SELECT COUNT(*) as newThisMonth FROM users WHERE MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())'
    );

    res.render('admin/users', {
      title: 'CampusSphere Admin | Users',
      description: 'Manage CampusSphere users.',
      activePage: 'users',
      users,
      stats: {
        total,
        active: activeCount,
        inactive: inactiveCount,
        newThisMonth
      }
    });
  } catch (error) {
    console.error('Error in admin users:', error);
    res.render('admin/users', {
      title: 'CampusSphere Admin | Users',
      description: 'Manage CampusSphere users.',
      activePage: 'users',
      users: [],
      stats: { total: 0, active: 0, inactive: 0, newThisMonth: 0 }
    });
  }
};

/**
 * GET /admin/news — News & Events Editor
 */
exports.news = async (req, res) => {
  try {
    const [articles] = await db.query('SELECT * FROM news_announcements ORDER BY created_at DESC');
    const [events] = await db.query('SELECT * FROM events ORDER BY event_date DESC');

    const totalArticles = articles.length;
    const published = articles.filter(a => a.published_date !== null).length;
    const drafts = totalArticles - published;
    const totalEvents = events.length;

    res.render('admin/news', {
      title: 'CampusSphere Admin | News & Events',
      description: 'Manage campus news, announcements, and events.',
      activePage: 'news',
      articles,
      events,
      stats: { totalArticles, published, drafts, totalEvents }
    });
  } catch (error) {
    console.error('Error in admin news:', error);
    res.render('admin/news', {
      title: 'CampusSphere Admin | News & Events',
      description: 'Manage campus news, announcements, and events.',
      activePage: 'news',
      articles: [],
      events: [],
      stats: { totalArticles: 0, published: 0, drafts: 0, totalEvents: 0 }
    });
  }
};

/**
 * GET /admin/faqs — FAQ Management
 */
exports.faqs = (req, res) => {
  res.render('admin/faqs', {
    title: 'CampusSphere Admin | FAQs',
    description: 'Manage frequently asked questions.',
    activePage: 'faqs'
  });
};

/**
 * GET /admin/logs — System Logs
 */
exports.logs = (req, res) => {
  res.render('admin/logs', {
    title: 'CampusSphere Admin | Logs',
    description: 'View system activity logs.',
    activePage: 'logs'
  });
};

/**
 * GET /admin/settings — Settings
 */
exports.settings = (req, res) => {
  res.render('admin/settings', {
    title: 'CampusSphere Admin | Settings',
    description: 'CampusSphere system settings.',
    activePage: 'settings'
  });
};

/**
 * GET /admin/campus-map — Campus Map Management
 */
exports.campusMap = async (req, res) => {
  try {
    const [buildings] = await db.query('SELECT * FROM buildings ORDER BY name ASC');

    const totalBuildings = buildings.length;
    const categories = [...new Set(buildings.map(b => b.category))];

    res.render('admin/campus-map', {
      title: 'CampusSphere Admin | Campus Map',
      description: 'Manage campus map data and markers.',
      activePage: 'campus-map',
      buildings,
      stats: { totalBuildings, totalCategories: categories.length }
    });
  } catch (error) {
    console.error('Error in admin campus-map:', error);
    res.render('admin/campus-map', {
      title: 'CampusSphere Admin | Campus Map',
      description: 'Manage campus map data and markers.',
      activePage: 'campus-map',
      buildings: [],
      stats: { totalBuildings: 0, totalCategories: 0 }
    });
  }
};
