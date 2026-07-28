/* ========================================
   CampuSphere — Admin Controller
   Handles all Admin panel pages
   ======================================== */

const db = require('../config/db');
const authDataSource = require('../config/authDataSource');
const userRepository = require('../repositories/userRepository');
const mapRuntime = require('../config/mapRuntime');
const buildingRepository = require('../repositories/buildingRepository');
const contentDataSource = require('../config/contentDataSource');
const contentRepository = require('../repositories/contentRepository');
const auditRepository = require('../repositories/auditRepository');
const routeAvailability = require('../services/routeAvailability');
const { logServerError } = require('../utils/serverLog');

/**
 * GET /admin — Admin Dashboard
 */
exports.index = async (req, res) => {
  try {
    const useSupabase = authDataSource.isSupabase();

    // User-scoped reads — Supabase repository when enabled, MySQL otherwise.
    let recentUsers;
    let totalUsers;
    let totalStudents;
    if (useSupabase) {
      recentUsers = await userRepository.listRecentUsers(5);
      totalUsers = await userRepository.countAll();
      totalStudents = await userRepository.countByRole('student-cspc');
    } else {
      const [rows] = await db.query('SELECT * FROM users ORDER BY created_at DESC LIMIT 5');
      recentUsers = rows;
      const [[u]] = await db.query('SELECT COUNT(*) as totalUsers FROM users');
      totalUsers = u.totalUsers;
      const [[s]] = await db.query('SELECT COUNT(*) as totalStudents FROM users WHERE role = "student-cspc"');
      totalStudents = s.totalStudents;
    }

    // News reads route through the content repository when CONTENT_DATA_SOURCE=supabase.
    let recentNews;
    let totalNews;
    if (contentDataSource.isSupabase()) {
      recentNews = await contentRepository.listRecentAnnouncements(4);
      totalNews = await contentRepository.countAnnouncements();
    } else {
      [recentNews] = await db.query('SELECT * FROM news_announcements ORDER BY published_date DESC LIMIT 4');
      const [[{ totalNews: totalNewsCount }]] = await db.query('SELECT COUNT(*) as totalNews FROM news_announcements');
      totalNews = totalNewsCount;
    }

    // Building count routes through the repository when BUILDING_DATA_SOURCE=supabase.
    let totalBuildings;
    if (mapRuntime.isBuildingSupabase()) {
      totalBuildings = await buildingRepository.countAll();
    } else {
      const [[bRow]] = await db.query('SELECT COUNT(*) as totalBuildings FROM buildings');
      totalBuildings = bRow.totalBuildings;
    }

    res.render('admin/index', {
      title: 'CampuSphere Admin | Dashboard',
      description: 'CampuSphere Admin Dashboard — Manage campus data, users, and settings.',
      activePage: 'dashboard',
      recentUsers,
      recentNews,
      // M12.P1-R8: this KPI has always been a real building count; only its
      // view-model name claimed otherwise. Exposed as totalBuildings so the
      // property name matches the "Buildings" tile it renders. No page-view
      // tracking or analytics persistence is introduced (that remains D6).
      stats: { totalUsers, totalStudents, totalNews, totalBuildings }
    });
  } catch (error) {
    logServerError('admin.index', req);
    res.render('admin/index', {
      title: 'CampuSphere Admin | Dashboard',
      description: 'CampuSphere Admin Dashboard — Manage campus data, users, and settings.',
      activePage: 'dashboard',
      recentUsers: [],
      recentNews: [],
      stats: { totalUsers: 0, totalStudents: 0, totalNews: 0, totalBuildings: 0 }
    });
  }
};

/**
 * GET /admin/users — User Management
 */
exports.users = async (req, res) => {
  try {
    const useSupabase = authDataSource.isSupabase();

    let users;
    let activeCount;
    let newThisMonth;
    if (useSupabase) {
      users = await userRepository.listAllUsersForAdmin();
      // "Active" stays a 30-day rolling proxy. MySQL uses
      // DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) which is midnight 30 days
      // ago in MySQL server-local time. The Supabase repository compares
      // updated_at against the supplied instant in UTC; passing
      // now() - 30 days preserves the rolling-window intent (boundary may
      // shift by hours depending on server TZ vs. UTC — acceptable).
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      activeCount = await userRepository.countUpdatedSince(since);
      // newThisMonth uses calendar month. Repository uses UTC month
      // boundaries; MySQL used server-local month. Pass the current UTC
      // month — for a server in a non-UTC TZ this may differ at month
      // edges by up to a day. Documented as a known discrepancy.
      const now = new Date();
      newThisMonth = await userRepository.countCreatedInMonth({
        year: now.getUTCFullYear(),
        month: now.getUTCMonth() + 1
      });
    } else {
      const [rows] = await db.query('SELECT * FROM users ORDER BY created_at DESC');
      users = rows;
      const [[a]] = await db.query(
        'SELECT COUNT(*) as activeCount FROM users WHERE updated_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)'
      );
      activeCount = a.activeCount;
      const [[n]] = await db.query(
        'SELECT COUNT(*) as newThisMonth FROM users WHERE MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())'
      );
      newThisMonth = n.newThisMonth;
    }

    const total = users.length;
    const inactiveCount = total - activeCount;

    res.render('admin/users', {
      title: 'CampuSphere Admin | Users',
      description: 'Manage CampuSphere users.',
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
    logServerError('admin.users', req);
    res.render('admin/users', {
      title: 'CampuSphere Admin | Users',
      description: 'Manage CampuSphere users.',
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
    // Admin article/event lists route through the content repository when
    // CONTENT_DATA_SOURCE=supabase (created_at DESC / event_date DESC match
    // the MySQL ordering). Stats stay computed here, unchanged.
    let articles;
    let events;
    if (contentDataSource.isSupabase()) {
      articles = await contentRepository.listAllAnnouncementsForAdmin();
      events = await contentRepository.listEventsForAdmin();
    } else {
      [articles] = await db.query('SELECT * FROM news_announcements ORDER BY created_at DESC');
      [events] = await db.query('SELECT * FROM events ORDER BY event_date DESC');
    }

    const totalArticles = articles.length;
    const published = articles.filter(a => a.published_date !== null).length;
    const drafts = totalArticles - published;
    const totalEvents = events.length;

    res.render('admin/news', {
      title: 'CampuSphere Admin | News & Events',
      description: 'Manage campus news, announcements, and events.',
      activePage: 'news',
      articles,
      events,
      stats: { totalArticles, published, drafts, totalEvents }
    });
  } catch (error) {
    logServerError('admin.news', req);
    res.render('admin/news', {
      title: 'CampuSphere Admin | News & Events',
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
    title: 'CampuSphere Admin | FAQs',
    description: 'Manage frequently asked questions.',
    activePage: 'faqs'
  });
};

/**
 * GET /admin/logs — System Logs
 */
exports.logs = (req, res) => {
  res.render('admin/logs', {
    title: 'CampuSphere Admin | Logs',
    description: 'View system activity logs.',
    activePage: 'logs'
  });
};

/**
 * GET /admin/vr — VR Scene & Hotspot Administration (Milestone 7, Section 7.8)
 *
 * Pre-Milestone-12 UX repair: the schedule-hotspot form offers a building
 * dropdown instead of a raw numeric id, so the page loads the building list
 * through the same runtime-source pattern as campusMap — but passes ONLY
 * { id, name, category } to the view (no details/coords/media metadata).
 * The admin API contract is unchanged: the form still submits
 * schedule_building_id.
 */
exports.vr = async (req, res) => {
  const baseLocals = {
    title: 'CampuSphere Admin | VR Tour',
    description: 'Manage VR scenes and hotspots.',
    activePage: 'vr'
  };
  try {
    let rows;
    if (mapRuntime.isBuildingSupabase()) {
      rows = await buildingRepository.listAllOrderedByName();
    } else {
      [rows] = await db.query('SELECT id, name, category FROM buildings ORDER BY name ASC');
    }
    const buildings = rows.map((b) => ({
      id: b.id,
      name: b.name,
      category: b.category != null ? b.category : null
    }));
    res.render('admin/vr', { ...baseLocals, buildings });
  } catch (error) {
    logServerError('admin.vr', req);
    // The page stays usable without the dropdown data; the API contract and
    // server-side validation are unaffected.
    res.render('admin/vr', { ...baseLocals, buildings: [] });
  }
};

/* ========================================
   System Logs API (Milestone 7, Section 7.7)

   Read-only, database-backed reads of the immutable `system_logs` audit
   trail for GET /admin/api/logs. Gated by requireRole('admin')
   (routes/admin.js). Reads NEVER write an audit row. CONTENT_DATA_SOURCE
   selects the backend:
     supabase -> auditRepository.listLogs/countLogs (append-only repo)
     mysql    -> parameterized SELECTs against system_logs
   There is no edit / delete / clear / export / arbitrary-query path.
   Errors are fixed and sanitized: filters, submitted text, raw errors,
   database output, and stacks are never logged or returned.
   ======================================== */

const LOG_EVENT_TYPES = Object.freeze(['authentication', 'profile', 'authorization', 'admin_mutation']);
const LOG_OUTCOMES = Object.freeze(['success', 'failure', 'denied']);
const LOG_LIMIT_DEFAULT = 50;
const LOG_LIMIT_MIN = 1;
const LOG_LIMIT_MAX = 100;
const LOG_OFFSET_DEFAULT = 0;
const LOG_OFFSET_MIN = 0;
const LOG_OFFSET_MAX = 10000;
const LOG_TEXT_MAX = 200;

// A query param must be a single scalar string (or absent). Express turns a
// repeated ?k=a&k=b into an array and ?k[x]= into an object; both are rejected
// (returns null) so a crafted shape can never slip past validation.
function logSingleScalar(v) {
  if (v === undefined) return undefined;
  return typeof v === 'string' ? v : null;
}

// Strict calendar-date guard: exactly YYYY-MM-DD AND a real date.
function logIsValidYmd(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Escape LIKE wildcards so user text matches literally (MySQL path). Mirrors
// the Supabase auditRepository.escapeLike and relies on the default `\` LIKE
// escape character, so `%`, `_`, and `\` are treated as literals.
function logEscapeMysqlLike(term) {
  return String(term).replace(/[\\%_]/g, (ch) => '\\' + ch);
}

// Reduce a row to EXACTLY the allowlisted fields; created_at -> ISO string.
function logToDto(row) {
  let createdAt = null;
  const raw = row.created_at;
  if (raw instanceof Date) {
    createdAt = raw.toISOString();
  } else if (raw != null) {
    const d = new Date(raw);
    createdAt = Number.isNaN(d.getTime()) ? String(raw) : d.toISOString();
  }
  return {
    id: row.id,
    event_type: row.event_type == null ? null : String(row.event_type),
    action: row.action == null ? null : String(row.action),
    outcome: row.outcome == null ? null : String(row.outcome),
    actor_user_id: row.actor_user_id == null ? null : row.actor_user_id,
    attempted_email: row.attempted_email == null ? null : String(row.attempted_email),
    actor_role: row.actor_role == null ? null : String(row.actor_role),
    target_type: row.target_type == null ? null : String(row.target_type),
    target_id: row.target_id == null ? null : String(row.target_id),
    message: row.message == null ? null : String(row.message),
    created_at: createdAt
  };
}

// Supabase backend: append-only audit repository (Section 7.3). The repo
// escapes the text term and applies the same filters to list + count.
async function logReadSupabase(f) {
  // Inclusive whole-day UTC bounds; created_at is timestamptz (stored UTC).
  const from = f.fromYmd ? f.fromYmd + 'T00:00:00.000Z' : undefined;
  const to = f.toYmd ? f.toYmd + 'T23:59:59.999Z' : undefined;
  const filters = { eventType: f.eventType, outcome: f.outcome, from, to, text: f.text };

  const rows = await auditRepository.listLogs({ ...filters, limit: f.limit, offset: f.offset });
  const total = await auditRepository.countLogs(filters);
  const summary = {
    total: await auditRepository.countLogs({}),
    success: await auditRepository.countLogs({ outcome: 'success' }),
    failure: await auditRepository.countLogs({ outcome: 'failure' }),
    denied: await auditRepository.countLogs({ outcome: 'denied' })
  };
  return { logs: rows.map(logToDto), total, summary };
}

// MySQL backend: parameterized SELECTs against system_logs. The date bounds
// are interpreted in the MySQL session timezone (same as the stored
// TIMESTAMP), keeping the calendar-day filter internally consistent.
async function logReadMysql(f) {
  const where = [];
  const params = [];
  if (f.eventType) { where.push('event_type = ?'); params.push(f.eventType); }
  if (f.outcome) { where.push('outcome = ?'); params.push(f.outcome); }
  if (f.fromYmd) { where.push('created_at >= ?'); params.push(f.fromYmd + ' 00:00:00'); }
  if (f.toYmd) { where.push('created_at <= ?'); params.push(f.toYmd + ' 23:59:59'); }
  if (f.text) { where.push('message LIKE ?'); params.push('%' + logEscapeMysqlLike(f.text) + '%'); }
  const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';

  const [rows] = await db.query(
    'SELECT id, event_type, action, outcome, actor_user_id, attempted_email, ' +
      'actor_role, target_type, target_id, message, created_at ' +
      'FROM system_logs' + whereSql +
      ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?',
    [...params, f.limit, f.offset]
  );

  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) AS total FROM system_logs' + whereSql,
    params
  );

  const [groups] = await db.query(
    'SELECT outcome, COUNT(*) AS c FROM system_logs GROUP BY outcome'
  );
  const summary = { total: 0, success: 0, failure: 0, denied: 0 };
  for (const g of groups) {
    const c = Number(g.c) || 0;
    summary.total += c;
    if (g.outcome === 'success') summary.success = c;
    else if (g.outcome === 'failure') summary.failure = c;
    else if (g.outcome === 'denied') summary.denied = c;
  }
  return { logs: rows.map(logToDto), total: Number(total) || 0, summary };
}

/**
 * GET /admin/api/logs — read-only, paginated, filtered audit-log reads.
 * Newest-first (created_at DESC, id DESC). No write/mutation path.
 */
exports.getLogs = async (req, res) => {
  try {
    const q = req.query || {};

    // Every recognised param must be a scalar string or absent.
    const keys = ['event_type', 'outcome', 'from', 'to', 'text', 'limit', 'offset'];
    const s = {};
    for (const k of keys) {
      const v = logSingleScalar(q[k]);
      if (v === null) {
        return res.status(400).json({ success: false, message: 'Invalid request parameters.' });
      }
      s[k] = v;
    }

    const f = {
      eventType: undefined,
      outcome: undefined,
      fromYmd: null,
      toYmd: null,
      text: null,
      limit: LOG_LIMIT_DEFAULT,
      offset: LOG_OFFSET_DEFAULT
    };

    if (s.event_type !== undefined && s.event_type !== '') {
      if (!LOG_EVENT_TYPES.includes(s.event_type)) {
        return res.status(400).json({ success: false, message: 'Invalid event type filter.' });
      }
      f.eventType = s.event_type;
    }

    if (s.outcome !== undefined && s.outcome !== '') {
      if (!LOG_OUTCOMES.includes(s.outcome)) {
        return res.status(400).json({ success: false, message: 'Invalid outcome filter.' });
      }
      f.outcome = s.outcome;
    }

    if (s.from !== undefined && s.from !== '') {
      if (!logIsValidYmd(s.from)) {
        return res.status(400).json({ success: false, message: 'Invalid from date. Use YYYY-MM-DD.' });
      }
      f.fromYmd = s.from;
    }
    if (s.to !== undefined && s.to !== '') {
      if (!logIsValidYmd(s.to)) {
        return res.status(400).json({ success: false, message: 'Invalid to date. Use YYYY-MM-DD.' });
      }
      f.toYmd = s.to;
    }
    if (f.fromYmd && f.toYmd && f.fromYmd > f.toYmd) {
      return res.status(400).json({ success: false, message: 'The from date must not be after the to date.' });
    }

    if (s.text !== undefined) {
      const t = s.text.trim();
      if (t.length > LOG_TEXT_MAX) {
        return res.status(400).json({ success: false, message: 'Search text must be 200 characters or fewer.' });
      }
      if (t !== '') f.text = t;
    }

    if (s.limit !== undefined && s.limit !== '') {
      if (!/^\d+$/.test(s.limit)) {
        return res.status(400).json({ success: false, message: 'Invalid limit.' });
      }
      const n = Number(s.limit);
      if (n < LOG_LIMIT_MIN || n > LOG_LIMIT_MAX) {
        return res.status(400).json({ success: false, message: 'Limit must be between 1 and 100.' });
      }
      f.limit = n;
    }

    if (s.offset !== undefined && s.offset !== '') {
      if (!/^\d+$/.test(s.offset)) {
        return res.status(400).json({ success: false, message: 'Invalid offset.' });
      }
      const n = Number(s.offset);
      if (n < LOG_OFFSET_MIN || n > LOG_OFFSET_MAX) {
        return res.status(400).json({ success: false, message: 'Offset must be between 0 and 10000.' });
      }
      f.offset = n;
    }

    const result = contentDataSource.isSupabase()
      ? await logReadSupabase(f)
      : await logReadMysql(f);

    const returned = result.logs.length;
    return res.json({
      success: true,
      logs: result.logs,
      total: result.total,
      summary: result.summary,
      pagination: {
        limit: f.limit,
        offset: f.offset,
        returned,
        has_more: f.offset + returned < result.total
      }
    });
  } catch (err) {
    // Fixed, sanitized error only — never echo filters, text, or raw errors.
    console.error('[admin logs] Failed to read system logs.');
    return res.status(500).json({ success: false, message: 'Unable to load system logs at this time.' });
  }
};

/**
 * GET /admin/settings — Settings
 */
exports.settings = (req, res) => {
  res.render('admin/settings', {
    title: 'CampuSphere Admin | Settings',
    description: 'CampuSphere system settings.',
    activePage: 'settings'
  });
};

/**
 * GET /admin/campus-map — Campus Map Management
 */
exports.campusMap = async (req, res) => {
  try {
    // Building list routes through the repository when BUILDING_DATA_SOURCE=supabase.
    // The admin view consumes RAW rows (details as a JSON string, not normalized),
    // so the Supabase branch stringifies jsonb details to preserve that exact shape.
    let buildings;
    if (mapRuntime.isBuildingSupabase()) {
      buildings = (await buildingRepository.listAllOrderedByName()).map((b) => ({
        ...b,
        details: b.details == null ? null : (typeof b.details === 'string' ? b.details : JSON.stringify(b.details))
      }));
    } else {
      [buildings] = await db.query('SELECT * FROM buildings ORDER BY name ASC');
    }

    // BE.3: the admin cards render from THIS embedded row set on first paint (not
    // from GET /admin/api/buildings), so it must carry the availability fields too —
    // otherwise every card would fall back to "Route status unavailable" until the
    // first refresh.
    const decorated = await routeAvailability.decorateBuildings(buildings);
    if (!decorated.ok) logServerError('admin.campusMap.routeAvailability', req);
    buildings = decorated.buildings;

    const totalBuildings = buildings.length;
    const categories = [...new Set(buildings.map(b => b.category))];

    res.render('admin/campus-map', {
      title: 'CampuSphere Admin | Campus Map',
      description: 'Manage campus map data and markers.',
      activePage: 'campus-map',
      buildings,
      stats: { totalBuildings, totalCategories: categories.length }
    });
  } catch (error) {
    logServerError('admin.campusMap', req);
    res.render('admin/campus-map', {
      title: 'CampuSphere Admin | Campus Map',
      description: 'Manage campus map data and markers.',
      activePage: 'campus-map',
      buildings: [],
      stats: { totalBuildings: 0, totalCategories: 0 }
    });
  }
};
