/* ========================================
   CampuSphere — Admin Content API Controller
   Handles CRUD for News/Announcements & Events
   ======================================== */

const db = require('../config/db');
const contentDataSource = require('../config/contentDataSource');
const contentRepository = require('../repositories/contentRepository');
const siteContentRepository = require('../repositories/siteContentRepository');
const auditService = require('../services/auditService');
const V = require('../utils/adminValidation');
const {
  SCHOOL_DESCRIPTION_MAX_LENGTH,
  canonicalizeSchoolDescription,
} = require('../utils/siteSettingsDescription');

// Standardized announcement category + audience values (Milestone 4).
// R7 repair: the allowlist is the UNION of the admin UI options and every
// category present in live/seeded data (both backends hold Academic, Advisory,
// Events, Facilities, General). 'Events' (plural) and 'Facilities' are included
// so existing announcements stay editable with their category preserved — no
// data migration required — while validation remains a strict allowlist.
const ALLOWED_NEWS_CATEGORIES = ['General', 'Academic', 'Event', 'Events', 'Advisory', 'Maintenance', 'Emergency', 'Facilities'];
const ALLOWED_AUDIENCES = ['all', 'student-cspc', 'instructor', 'guest', 'admin'];
// R7: news status + event category allowlists (mirror the admin UI option sets
// in views/admin/news.ejs). Field caps mirror the schema / spec.
const ALLOWED_NEWS_STATUS = ['published', 'draft'];
const EVENT_CATEGORIES = ['Academic', 'Sports', 'Cultural'];
const NEWS_KEYS = ['title', 'category', 'excerpt', 'content', 'status', 'audience'];
const EVENT_KEYS = ['title', 'category', 'event_date', 'event_time', 'location', 'description'];
const NEWS_MAX_TITLE = 150;
const NEWS_MAX_EXCERPT = 500;
const NEWS_MAX_CONTENT = 10000;
const EVENT_MAX_TITLE = 150;
const EVENT_MAX_DESCRIPTION = 5000;
const EVENT_MAX_LOCATION = 255;
const EVENT_MAX_TIME = 100;

/**
 * Validate + normalize a news create/update body. Returns { ok, value } with
 * exactly { title, category, audience, excerpt, content, status } or
 * { ok:false, message }. `content` defaults to `excerpt` when blank; `status`
 * (published|draft) and `audience` default sanely. No DB work, no extras.
 */
function validateNewsPayload(body) {
  const shape = V.validateBody(body, NEWS_KEYS);
  if (!shape.ok) return shape;

  const title = V.requiredString(body.title, 'Title', NEWS_MAX_TITLE);
  if (!title.ok) return title;
  const category = V.allowedValue(body.category, 'category', ALLOWED_NEWS_CATEGORIES);
  if (!category.ok) return category;
  const excerpt = V.requiredString(body.excerpt, 'Excerpt', NEWS_MAX_EXCERPT);
  if (!excerpt.ok) return excerpt;

  const contentCheck = V.optionalString(body.content, 'Content', NEWS_MAX_CONTENT);
  if (!contentCheck.ok) return contentCheck;
  const content = contentCheck.value === '' ? excerpt.value : contentCheck.value;

  let audience = 'all';
  if (body.audience !== undefined && body.audience !== null && String(body.audience).trim() !== '') {
    const a = V.allowedValue(body.audience, 'audience', ALLOWED_AUDIENCES);
    if (!a.ok) return a;
    audience = a.value;
  }

  let status = 'published';
  if (body.status !== undefined && body.status !== null && String(body.status).trim() !== '') {
    const s = V.allowedValue(body.status, 'status', ALLOWED_NEWS_STATUS);
    if (!s.ok) return s;
    status = s.value;
  }

  return { ok: true, value: { title: title.value, category: category.value, audience, excerpt: excerpt.value, content, status } };
}

/**
 * Validate + normalize an event create/update body. Returns { ok, value } with
 * exactly { title, category, event_date, description, location, event_time }
 * or { ok:false, message }. No DB work, no extras.
 */
function validateEventPayload(body) {
  const shape = V.validateBody(body, EVENT_KEYS);
  if (!shape.ok) return shape;

  const title = V.requiredString(body.title, 'Title', EVENT_MAX_TITLE);
  if (!title.ok) return title;
  const category = V.allowedValue(body.category, 'category', EVENT_CATEGORIES);
  if (!category.ok) return category;
  const date = V.validateYmdDate(body.event_date, 'Event date');
  if (!date.ok) return date;
  const description = V.optionalString(body.description, 'Description', EVENT_MAX_DESCRIPTION);
  if (!description.ok) return description;
  const location = V.optionalString(body.location, 'Location', EVENT_MAX_LOCATION);
  if (!location.ok) return location;
  const time = V.optionalString(body.event_time, 'Event time', EVENT_MAX_TIME);
  if (!time.ok) return time;

  return { ok: true, value: { title: title.value, category: category.value, event_date: date.value, description: description.value, location: location.value, event_time: time.value } };
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

// ============================================================
//  NEWS / ANNOUNCEMENTS
// ============================================================

/**
 * POST /admin/api/news — Create a news article
 */
exports.createNews = async (req, res) => {
  const check = validateNewsPayload(req.body);
  if (!check.ok) {
    return res.status(400).json({ success: false, message: check.message });
  }
  const value = check.value; // { title, category, audience, excerpt, content, status }

  try {
    const authorId = req.session.user ? req.session.user.id : null;
    const publishedDate = (value.status === 'draft') ? null : new Date();

    // Supabase path: same validated values + draft/published decision. The
    // repository sets published_date explicitly (null for a draft) so the
    // column DEFAULT never auto-publishes; it returns the inserted row in the
    // MySQL-era shape the admin UI already consumes.
    if (contentDataSource.isSupabase()) {
      const article = await contentRepository.createAnnouncement({
        title: value.title,
        category: value.category,
        audience: value.audience,
        excerpt: value.excerpt,
        content: value.content,
        author_id: authorId,
        published_date: publishedDate
      });
      auditAdminMutation(req, 'admin.news.create', 'news', article && article.id, 'Admin created an announcement.');
      return res.status(201).json({
        success: true,
        message: 'Article created successfully.',
        article
      });
    }

    const [result] = await db.query(
      `INSERT INTO news_announcements (title, category, audience, excerpt, content, author_id, published_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [value.title, value.category, value.audience, value.excerpt, value.content, authorId, publishedDate]
    );

    const [newItem] = await db.query('SELECT * FROM news_announcements WHERE id = ?', [result.insertId]);

    auditAdminMutation(req, 'admin.news.create', 'news', result.insertId, 'Admin created an announcement.');
    return res.status(201).json({
      success: true,
      message: 'Article created successfully.',
      article: newItem[0]
    });
  } catch (error) {
    console.error('Error creating news: unexpected failure.');
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

/**
 * PUT /admin/api/news/:id — Update a news article
 */
exports.updateNews = async (req, res) => {
  const id = V.parseRouteId(req.params.id);
  if (id === null) {
    return res.status(400).json({ success: false, message: 'Invalid article id.' });
  }

  const check = validateNewsPayload(req.body);
  if (!check.ok) {
    return res.status(400).json({ success: false, message: check.message });
  }
  const value = check.value;

  try {
    // Supabase path. contentRepository exposes no getById, so the existing
    // row is located via the admin list (created_at DESC) to read its current
    // published_date before deciding the new value — preserving the MySQL
    // publish/keep/draft semantics exactly.
    if (contentDataSource.isSupabase()) {
      const all = await contentRepository.listAllAnnouncementsForAdmin();
      const existing = all.find((a) => String(a.id) === String(id));
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Article not found.' });
      }

      const publishedDate = (value.status === 'draft')
        ? null
        : (existing.published_date || new Date());

      const article = await contentRepository.updateAnnouncement(id, {
        title: value.title,
        category: value.category,
        audience: value.audience,
        excerpt: value.excerpt,
        content: value.content,
        published_date: publishedDate
      });
      if (!article) {
        return res.status(404).json({ success: false, message: 'Article not found.' });
      }
      auditAdminMutation(req, 'admin.news.update', 'news', id, 'Admin updated an announcement.');
      return res.status(200).json({
        success: true,
        message: 'Article updated successfully.',
        article
      });
    }

    const [existing] = await db.query('SELECT id FROM news_announcements WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Article not found.' });
    }

    // If publishing a draft, set published_date now; if saving as draft, null it
    let publishedDate;
    if (value.status === 'draft') {
      publishedDate = null;
    } else {
      // Keep original published_date if already published, otherwise set now
      const [current] = await db.query('SELECT published_date FROM news_announcements WHERE id = ?', [id]);
      publishedDate = current[0].published_date || new Date();
    }

    await db.query(
      `UPDATE news_announcements
       SET title = ?, category = ?, audience = ?, excerpt = ?, content = ?, published_date = ?, updated_at = NOW()
       WHERE id = ?`,
      [value.title, value.category, value.audience, value.excerpt, value.content, publishedDate, id]
    );

    const [updated] = await db.query('SELECT * FROM news_announcements WHERE id = ?', [id]);

    auditAdminMutation(req, 'admin.news.update', 'news', id, 'Admin updated an announcement.');
    return res.status(200).json({
      success: true,
      message: 'Article updated successfully.',
      article: updated[0]
    });
  } catch (error) {
    console.error('Error updating news: unexpected failure.');
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

/**
 * DELETE /admin/api/news/:id — Delete a news article
 */
exports.deleteNews = async (req, res) => {
  const id = V.parseRouteId(req.params.id);
  if (id === null) {
    return res.status(400).json({ success: false, message: 'Invalid article id.' });
  }

  try {
    // Supabase path: the repository returns the deleted id, or null when the
    // id matched no row (mapped to the same 404 as the MySQL path).
    if (contentDataSource.isSupabase()) {
      const deletedId = await contentRepository.deleteAnnouncement(id);
      if (deletedId === null) {
        return res.status(404).json({ success: false, message: 'Article not found.' });
      }
      auditAdminMutation(req, 'admin.news.delete', 'news', id, 'Admin deleted an announcement.');
      return res.status(200).json({
        success: true,
        message: 'Article deleted successfully.'
      });
    }

    const [existing] = await db.query('SELECT id FROM news_announcements WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Article not found.' });
    }

    await db.query('DELETE FROM news_announcements WHERE id = ?', [id]);

    auditAdminMutation(req, 'admin.news.delete', 'news', id, 'Admin deleted an announcement.');
    return res.status(200).json({
      success: true,
      message: 'Article deleted successfully.'
    });
  } catch (error) {
    console.error('Error deleting news: unexpected failure.');
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// ============================================================
//  EVENTS
// ============================================================

/**
 * POST /admin/api/events — Create an event
 */
exports.createEvent = async (req, res) => {
  const check = validateEventPayload(req.body);
  if (!check.ok) {
    return res.status(400).json({ success: false, message: check.message });
  }
  const value = check.value; // { title, category, event_date, description, location, event_time }

  try {
    // Supabase path: same validated values; the repository keeps event_date
    // date-compatible and returns the inserted row in the MySQL-era shape.
    if (contentDataSource.isSupabase()) {
      const event = await contentRepository.createEvent({
        title: value.title,
        category: value.category,
        event_date: value.event_date,
        description: value.description,
        location: value.location,
        event_time: value.event_time
      });
      auditAdminMutation(req, 'admin.event.create', 'event', event && event.id, 'Admin created an event.');
      return res.status(201).json({
        success: true,
        message: 'Event created successfully.',
        event
      });
    }

    const [result] = await db.query(
      `INSERT INTO events (title, category, event_date, description, location, event_time)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [value.title, value.category, value.event_date, value.description, value.location, value.event_time]
    );

    const [newEvent] = await db.query('SELECT * FROM events WHERE id = ?', [result.insertId]);

    auditAdminMutation(req, 'admin.event.create', 'event', result.insertId, 'Admin created an event.');
    return res.status(201).json({
      success: true,
      message: 'Event created successfully.',
      event: newEvent[0]
    });
  } catch (error) {
    console.error('Error creating event: unexpected failure.');
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

/**
 * PUT /admin/api/events/:id — Update an event
 */
exports.updateEvent = async (req, res) => {
  const id = V.parseRouteId(req.params.id);
  if (id === null) {
    return res.status(400).json({ success: false, message: 'Invalid event id.' });
  }

  const check = validateEventPayload(req.body);
  if (!check.ok) {
    return res.status(400).json({ success: false, message: check.message });
  }
  const value = check.value;

  try {
    // Supabase path: the repository updates the provided fields and returns
    // the updated row, or null when the id matched no row (mapped to 404 to
    // match the MySQL existence-check behavior).
    if (contentDataSource.isSupabase()) {
      const event = await contentRepository.updateEvent(id, {
        title: value.title,
        category: value.category,
        event_date: value.event_date,
        description: value.description,
        location: value.location,
        event_time: value.event_time
      });
      if (!event) {
        return res.status(404).json({ success: false, message: 'Event not found.' });
      }
      auditAdminMutation(req, 'admin.event.update', 'event', id, 'Admin updated an event.');
      return res.status(200).json({
        success: true,
        message: 'Event updated successfully.',
        event
      });
    }

    const [existing] = await db.query('SELECT id FROM events WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    await db.query(
      `UPDATE events
       SET title = ?, category = ?, event_date = ?, description = ?, location = ?, event_time = ?, updated_at = NOW()
       WHERE id = ?`,
      [value.title, value.category, value.event_date, value.description, value.location, value.event_time, id]
    );

    const [updated] = await db.query('SELECT * FROM events WHERE id = ?', [id]);

    auditAdminMutation(req, 'admin.event.update', 'event', id, 'Admin updated an event.');
    return res.status(200).json({
      success: true,
      message: 'Event updated successfully.',
      event: updated[0]
    });
  } catch (error) {
    console.error('Error updating event: unexpected failure.');
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

/**
 * DELETE /admin/api/events/:id — Delete an event
 */
exports.deleteEvent = async (req, res) => {
  const id = V.parseRouteId(req.params.id);
  if (id === null) {
    return res.status(400).json({ success: false, message: 'Invalid event id.' });
  }

  try {
    // Supabase path: the repository returns the deleted id, or null when the
    // id matched no row (mapped to the same 404 as the MySQL path).
    if (contentDataSource.isSupabase()) {
      const deletedId = await contentRepository.deleteEvent(id);
      if (deletedId === null) {
        return res.status(404).json({ success: false, message: 'Event not found.' });
      }
      auditAdminMutation(req, 'admin.event.delete', 'event', id, 'Admin deleted an event.');
      return res.status(200).json({
        success: true,
        message: 'Event deleted successfully.'
      });
    }

    const [existing] = await db.query('SELECT id FROM events WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    await db.query('DELETE FROM events WHERE id = ?', [id]);

    auditAdminMutation(req, 'admin.event.delete', 'event', id, 'Admin deleted an event.');
    return res.status(200).json({
      success: true,
      message: 'Event deleted successfully.'
    });
  } catch (error) {
    console.error('Error deleting event: unexpected failure.');
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// ============================================================
//  FAQs (Milestone 7, Section 7.5)
// ============================================================
//  CONTENT_DATA_SOURCE=supabase -> repositories/siteContentRepository.js
//  CONTENT_DATA_SOURCE=mysql    -> parameterized queries via config/db.js
//  Both branches use the explicit column list
//  (id, question, answer, category, display_order) and order lists by
//  display_order ASC, id ASC. Validation happens here so neither backend
//  ever sees an unvalidated value; arbitrary extra payload fields are
//  never forwarded.

// Field limits mirror database/schema.sql + 0001 column definitions.
const FAQ_MAX_QUESTION = 255;
const FAQ_MAX_ANSWER = 5000;
const FAQ_MAX_CATEGORY = 50;
const FAQ_MAX_ORDER = 2147483647; // signed 32-bit INT ceiling in both schemas

const FAQ_COLUMNS_SQL = 'id, question, answer, category, display_order';

/**
 * Parse a route id into a canonical positive integer, or null.
 * Rejects blanks, signs, leading zeros, fractions, scientific notation,
 * and unsafe magnitudes. null -> the route handler answers 400.
 */
function parseFaqId(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const s = String(raw).trim();
  if (!/^(0|[1-9][0-9]*)$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < 1) return null;
  return n;
}

/**
 * Parse display_order: an integer number or canonical integer string,
 * 0..FAQ_MAX_ORDER. Booleans, blanks, fractions, negatives, NaN,
 * scientific notation, and oversized values are rejected.
 */
function parseFaqDisplayOrder(raw) {
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw)) return { ok: false };
    if (raw < 0 || raw > FAQ_MAX_ORDER) return { ok: false };
    return { ok: true, value: raw };
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!/^(0|[1-9][0-9]*)$/.test(s)) return { ok: false };
    const n = Number(s);
    if (!Number.isSafeInteger(n) || n > FAQ_MAX_ORDER) return { ok: false };
    return { ok: true, value: n };
  }
  return { ok: false };
}

/**
 * Validate a FAQ create/update body. Returns { ok: true, value } with
 * EXACTLY the four writable fields (extra payload keys are dropped here
 * and never reach a repository or query), or { ok: false, message }.
 */
function validateFaqPayload(body) {
  if (body === null || body === undefined || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'Request body must be a JSON object.' };
  }

  if (typeof body.question !== 'string' || body.question.trim() === '') {
    return { ok: false, message: 'Question is required.' };
  }
  const question = body.question.trim();
  if (question.length > FAQ_MAX_QUESTION) {
    return { ok: false, message: `Question must be ${FAQ_MAX_QUESTION} characters or fewer.` };
  }

  if (typeof body.answer !== 'string' || body.answer.trim() === '') {
    return { ok: false, message: 'Answer is required.' };
  }
  const answer = body.answer.trim();
  if (answer.length > FAQ_MAX_ANSWER) {
    return { ok: false, message: `Answer must be ${FAQ_MAX_ANSWER} characters or fewer.` };
  }

  let category = null;
  if (body.category !== undefined && body.category !== null) {
    if (typeof body.category !== 'string') {
      return { ok: false, message: 'Category must be text.' };
    }
    const trimmedCategory = body.category.trim();
    if (trimmedCategory.length > FAQ_MAX_CATEGORY) {
      return { ok: false, message: `Category must be ${FAQ_MAX_CATEGORY} characters or fewer.` };
    }
    category = trimmedCategory === '' ? null : trimmedCategory;
  }

  if (body.display_order === undefined || body.display_order === null) {
    return { ok: false, message: 'Display order is required.' };
  }
  const order = parseFaqDisplayOrder(body.display_order);
  if (!order.ok) {
    return { ok: false, message: `Display order must be a whole number between 0 and ${FAQ_MAX_ORDER}.` };
  }

  return { ok: true, value: { question, answer, category, display_order: order.value } };
}

/**
 * MySQL duplicate-question check (trimmed, case-folded), optionally
 * excluding the row being edited. The Supabase branch uses
 * siteContentRepository.findFaqByQuestion instead.
 */
async function faqQuestionExistsMysql(question, excludeId) {
  const q = question.trim().toLowerCase();
  if (excludeId != null) {
    const [rows] = await db.query(
      'SELECT id FROM faqs WHERE LOWER(TRIM(question)) = ? AND id <> ? LIMIT 1',
      [q, excludeId]
    );
    return rows.length > 0;
  }
  const [rows] = await db.query(
    'SELECT id FROM faqs WHERE LOWER(TRIM(question)) = ? LIMIT 1',
    [q]
  );
  return rows.length > 0;
}

/**
 * GET /admin/api/faqs — All FAQs ordered by display_order ASC, id ASC
 */
exports.listFaqs = async (req, res) => {
  try {
    let faqs;
    if (contentDataSource.isSupabase()) {
      faqs = await siteContentRepository.listFaqs();
    } else {
      const [rows] = await db.query(
        `SELECT ${FAQ_COLUMNS_SQL} FROM faqs ORDER BY display_order ASC, id ASC`
      );
      faqs = rows;
    }
    return res.status(200).json({ success: true, faqs, total: faqs.length });
  } catch (error) {
    console.error('Error listing FAQs: unexpected failure.');
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

/**
 * GET /admin/api/faqs/:id — One FAQ
 */
exports.getFaq = async (req, res) => {
  const faqId = parseFaqId(req.params.id);
  if (faqId === null) {
    return res.status(400).json({ success: false, message: 'Invalid FAQ id.' });
  }

  try {
    let faq;
    if (contentDataSource.isSupabase()) {
      faq = await siteContentRepository.findFaqById(faqId);
    } else {
      const [rows] = await db.query(
        `SELECT ${FAQ_COLUMNS_SQL} FROM faqs WHERE id = ?`,
        [faqId]
      );
      faq = rows[0] || null;
    }
    if (!faq) {
      return res.status(404).json({ success: false, message: 'FAQ not found.' });
    }
    return res.status(200).json({ success: true, faq });
  } catch (error) {
    console.error('Error fetching FAQ: unexpected failure.');
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

/**
 * POST /admin/api/faqs — Create a FAQ
 */
exports.createFaq = async (req, res) => {
  const check = validateFaqPayload(req.body);
  if (!check.ok) {
    return res.status(400).json({ success: false, message: check.message });
  }
  const value = check.value;

  try {
    let faq;
    if (contentDataSource.isSupabase()) {
      const dup = await siteContentRepository.findFaqByQuestion(value.question);
      if (dup) {
        return res.status(409).json({ success: false, message: 'A FAQ with this question already exists.' });
      }
      faq = await siteContentRepository.createFaq(value);
    } else {
      const dup = await faqQuestionExistsMysql(value.question, null);
      if (dup) {
        return res.status(409).json({ success: false, message: 'A FAQ with this question already exists.' });
      }
      const [result] = await db.query(
        'INSERT INTO faqs (question, answer, category, display_order) VALUES (?, ?, ?, ?)',
        [value.question, value.answer, value.category, value.display_order]
      );
      const [rows] = await db.query(
        `SELECT ${FAQ_COLUMNS_SQL} FROM faqs WHERE id = ?`,
        [result.insertId]
      );
      faq = rows[0];
    }

    auditAdminMutation(req, 'admin.faq.create', 'faq', faq && faq.id, 'Admin created an FAQ.');
    return res.status(201).json({
      success: true,
      message: 'FAQ created successfully.',
      faq
    });
  } catch (error) {
    console.error('Error creating FAQ: unexpected failure.');
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

/**
 * PUT /admin/api/faqs/:id — Update a FAQ
 */
exports.updateFaq = async (req, res) => {
  const faqId = parseFaqId(req.params.id);
  if (faqId === null) {
    return res.status(400).json({ success: false, message: 'Invalid FAQ id.' });
  }

  const check = validateFaqPayload(req.body);
  if (!check.ok) {
    return res.status(400).json({ success: false, message: check.message });
  }
  const value = check.value;

  try {
    let faq;
    if (contentDataSource.isSupabase()) {
      const existing = await siteContentRepository.findFaqById(faqId);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'FAQ not found.' });
      }
      const dup = await siteContentRepository.findFaqByQuestion(value.question, { excludeId: faqId });
      if (dup) {
        return res.status(409).json({ success: false, message: 'A FAQ with this question already exists.' });
      }
      faq = await siteContentRepository.updateFaq(faqId, value);
      if (!faq) {
        return res.status(404).json({ success: false, message: 'FAQ not found.' });
      }
    } else {
      const [existing] = await db.query('SELECT id FROM faqs WHERE id = ?', [faqId]);
      if (existing.length === 0) {
        return res.status(404).json({ success: false, message: 'FAQ not found.' });
      }
      const dup = await faqQuestionExistsMysql(value.question, faqId);
      if (dup) {
        return res.status(409).json({ success: false, message: 'A FAQ with this question already exists.' });
      }
      await db.query(
        'UPDATE faqs SET question = ?, answer = ?, category = ?, display_order = ? WHERE id = ?',
        [value.question, value.answer, value.category, value.display_order, faqId]
      );
      const [rows] = await db.query(
        `SELECT ${FAQ_COLUMNS_SQL} FROM faqs WHERE id = ?`,
        [faqId]
      );
      faq = rows[0];
    }

    auditAdminMutation(req, 'admin.faq.update', 'faq', faqId, 'Admin updated an FAQ.');
    return res.status(200).json({
      success: true,
      message: 'FAQ updated successfully.',
      faq
    });
  } catch (error) {
    console.error('Error updating FAQ: unexpected failure.');
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

/**
 * DELETE /admin/api/faqs/:id — Delete a FAQ
 */
exports.deleteFaq = async (req, res) => {
  const faqId = parseFaqId(req.params.id);
  if (faqId === null) {
    return res.status(400).json({ success: false, message: 'Invalid FAQ id.' });
  }

  try {
    if (contentDataSource.isSupabase()) {
      const deletedId = await siteContentRepository.deleteFaq(faqId);
      if (deletedId === null) {
        return res.status(404).json({ success: false, message: 'FAQ not found.' });
      }
    } else {
      const [existing] = await db.query('SELECT id FROM faqs WHERE id = ?', [faqId]);
      if (existing.length === 0) {
        return res.status(404).json({ success: false, message: 'FAQ not found.' });
      }
      await db.query('DELETE FROM faqs WHERE id = ?', [faqId]);
    }

    auditAdminMutation(req, 'admin.faq.delete', 'faq', faqId, 'Admin deleted an FAQ.');
    return res.status(200).json({
      success: true,
      message: 'FAQ deleted successfully.'
    });
  } catch (error) {
    console.error('Error deleting FAQ: unexpected failure.');
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// ============================================================
//  INSTITUTIONAL SETTINGS (Milestone 7, Section 7.6)
// ============================================================
//  CONTENT_DATA_SOURCE=supabase -> siteContentRepository.listSettings /
//                                  updateSettings (one atomic upsert).
//  CONTENT_DATA_SOURCE=mysql    -> read/write the ten allowlisted keys only,
//                                  writes wrapped in a transaction so the whole
//                                  batch commits or rolls back together.
//  Only the ten allowlisted institutional keys are ever read or written; the
//  request must carry exactly those ten keys. Audit logs the fact of the
//  change, never the values.

// Per-key spec: the ten allowlisted keys, in the canonical response order,
// with validation limits. Mirrors siteContentRepository.SETTINGS_ALLOWLIST.
const SETTINGS_SPEC = [
  { key: 'school_name', label: 'School name', max: 150 },
  { key: 'school_acronym', label: 'Acronym', max: 20 },
  { key: 'school_address', label: 'School address', max: 255 },
  { key: 'school_founded', label: 'Founded year', year: true },
  { key: 'school_description', label: 'Description', max: SCHOOL_DESCRIPTION_MAX_LENGTH },
  { key: 'contact_address', label: 'Contact address', max: 255 },
  { key: 'contact_phone', label: 'Phone', max: 50 },
  { key: 'contact_email', label: 'Email', max: 254, email: true },
  { key: 'contact_website', label: 'Website', max: 2048, url: true },
  { key: 'contact_hours', label: 'Office hours', max: 255 },
];
const SETTINGS_KEYS = SETTINGS_SPEC.map((s) => s.key);
const SETTINGS_MIN_YEAR = 1900;
const SETTINGS_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Build the fixed ten-key settings object from a {setting_key, setting_value}
// row array, in canonical order. Keys outside the allowlist are dropped;
// any missing key defaults to '' (the canonical DB always has all ten).
function rowsToSettings(rows) {
  const map = {};
  for (const r of rows || []) map[r.setting_key] = r.setting_value;
  const out = {};
  for (const key of SETTINGS_KEYS) {
    out[key] = map[key] == null ? '' : String(map[key]);
  }
  return out;
}

// Parse school_founded into a canonical integer-year string, or null.
// Accepts an integer number or a canonical integer string (no leading zeros,
// sign, decimal, or exponent). Range 1900..currentYear.
function parseFoundedYear(raw, currentYear) {
  let n;
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw)) return null;
    n = raw;
  } else if (typeof raw === 'string') {
    const s = raw.trim();
    if (!/^\d+$/.test(s)) return null;
    n = Number(s);
    if (!Number.isInteger(n) || String(n) !== s) return null; // reject leading zeros
  } else {
    return null;
  }
  if (n < SETTINGS_MIN_YEAR || n > currentYear) return null;
  return String(n);
}

// Validate the PUT body. Returns { ok: true, value } with EXACTLY the ten
// cleaned (trimmed) string values, or { ok: false, message }. Rejects the
// body before any database operation. Messages name the field and rule only —
// never the submitted value.
function validateSettingsPayload(body, currentYear) {
  if (body === null || body === undefined || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'Request body must be a JSON object.' };
  }

  // Exactly the ten allowlisted keys: no missing, no unknown.
  for (const key of SETTINGS_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) {
      return { ok: false, message: 'Settings payload must contain exactly the ten allowed settings.' };
    }
  }
  for (const key of Object.keys(body)) {
    if (!SETTINGS_KEYS.includes(key)) {
      return { ok: false, message: 'Settings payload must contain exactly the ten allowed settings.' };
    }
  }

  const out = {};
  for (const spec of SETTINGS_SPEC) {
    const raw = body[spec.key];

    if (spec.year) {
      const year = parseFoundedYear(raw, currentYear);
      if (year === null) {
        return { ok: false, message: `Founded year must be a whole number between ${SETTINGS_MIN_YEAR} and ${currentYear}.` };
      }
      out[spec.key] = year;
      continue;
    }

    if (typeof raw !== 'string') {
      return { ok: false, message: `${spec.label} is required.` };
    }
    const v = raw.trim();
    if (v === '') {
      return { ok: false, message: `${spec.label} is required.` };
    }
    if (v.length > spec.max) {
      return { ok: false, message: `${spec.label} must be ${spec.max} characters or fewer.` };
    }
    if (spec.key === 'school_description') {
      const parsedDescription = canonicalizeSchoolDescription(v);
      if (!parsedDescription.ok) return { ok: false, message: parsedDescription.message };
      out[spec.key] = parsedDescription.value;
      continue;
    }
    if (spec.email && !SETTINGS_EMAIL_RE.test(v)) {
      return { ok: false, message: 'Email must be a valid email address.' };
    }
    if (spec.url) {
      let parsed;
      try { parsed = new URL(v); } catch (e) { parsed = null; }
      if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
        return { ok: false, message: 'Website must be an absolute http:// or https:// URL.' };
      }
    }
    out[spec.key] = v;
  }

  return { ok: true, value: out };
}

// Read the ten allowlisted settings rows from the active backend.
async function readSettingsRows() {
  if (contentDataSource.isSupabase()) {
    return siteContentRepository.listSettings();
  }
  const placeholders = SETTINGS_KEYS.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${placeholders})`,
    SETTINGS_KEYS
  );
  return rows;
}

/**
 * GET /admin/api/settings — Read the ten institutional settings
 */
exports.getSettings = async (req, res) => {
  try {
    const rows = await readSettingsRows();
    return res.status(200).json({ success: true, settings: rowsToSettings(rows) });
  } catch (error) {
    console.error('Error reading settings: unexpected failure.');
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

/**
 * PUT /admin/api/settings — Batch-update the ten institutional settings
 */
exports.updateSettings = async (req, res) => {
  const currentYear = new Date().getFullYear();
  const check = validateSettingsPayload(req.body, currentYear);
  if (!check.ok) {
    return res.status(400).json({ success: false, message: check.message });
  }
  const value = check.value;

  try {
    let rows;
    if (contentDataSource.isSupabase()) {
      // One atomic allowlisted upsert; returns the resulting allowlisted rows.
      rows = await siteContentRepository.updateSettings(value);
    } else {
      // MySQL: wrap the ten upserts in a single transaction so the batch
      // commits or rolls back together.
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();
        for (const key of SETTINGS_KEYS) {
          await conn.query(
            'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ' +
              'ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
            [key, value[key]]
          );
        }
        await conn.commit();
      } catch (txErr) {
        try { await conn.rollback(); } catch (e) { /* ignore */ }
        throw txErr;
      } finally {
        conn.release();
      }
      rows = await readSettingsRows();
    }

    // Best-effort audit AFTER the committed batch; logs the fact only, never
    // any setting value or submitted content.
    auditAdminMutation(req, 'admin.settings.update', 'settings', 'institutional', 'Admin updated institutional settings.');

    return res.status(200).json({
      success: true,
      message: 'Settings updated successfully.',
      settings: rowsToSettings(rows),
    });
  } catch (error) {
    console.error('Error updating settings: unexpected failure.');
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};
