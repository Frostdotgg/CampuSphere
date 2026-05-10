/* ========================================
   CampuSphere — Admin Content API Controller
   Handles CRUD for News/Announcements & Events
   ======================================== */

const db = require('../config/db');

// ============================================================
//  NEWS / ANNOUNCEMENTS
// ============================================================

/**
 * POST /admin/api/news — Create a news article
 */
exports.createNews = async (req, res) => {
  const { title, category, excerpt, content, status } = req.body;

  if (!title || !category || !excerpt) {
    return res.status(400).json({ success: false, message: 'Title, category, and excerpt are required.' });
  }

  try {
    const authorId = req.session.user ? req.session.user.id : null;
    const publishedDate = (status === 'draft') ? null : new Date();

    const [result] = await db.query(
      `INSERT INTO news_announcements (title, category, excerpt, content, author_id, published_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title.trim(), category.trim(), excerpt.trim(), (content || excerpt).trim(), authorId, publishedDate]
    );

    const [newItem] = await db.query('SELECT * FROM news_announcements WHERE id = ?', [result.insertId]);

    return res.status(201).json({
      success: true,
      message: 'Article created successfully.',
      article: newItem[0]
    });
  } catch (error) {
    console.error('Error creating news:', error);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

/**
 * PUT /admin/api/news/:id — Update a news article
 */
exports.updateNews = async (req, res) => {
  const id = req.params.id;
  const { title, category, excerpt, content, status } = req.body;

  if (!title || !category || !excerpt) {
    return res.status(400).json({ success: false, message: 'Title, category, and excerpt are required.' });
  }

  try {
    const [existing] = await db.query('SELECT id FROM news_announcements WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Article not found.' });
    }

    // If publishing a draft, set published_date now; if saving as draft, null it
    let publishedDate;
    if (status === 'draft') {
      publishedDate = null;
    } else {
      // Keep original published_date if already published, otherwise set now
      const [current] = await db.query('SELECT published_date FROM news_announcements WHERE id = ?', [id]);
      publishedDate = current[0].published_date || new Date();
    }

    await db.query(
      `UPDATE news_announcements
       SET title = ?, category = ?, excerpt = ?, content = ?, published_date = ?, updated_at = NOW()
       WHERE id = ?`,
      [title.trim(), category.trim(), excerpt.trim(), (content || excerpt).trim(), publishedDate, id]
    );

    const [updated] = await db.query('SELECT * FROM news_announcements WHERE id = ?', [id]);

    return res.status(200).json({
      success: true,
      message: 'Article updated successfully.',
      article: updated[0]
    });
  } catch (error) {
    console.error('Error updating news:', error);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

/**
 * DELETE /admin/api/news/:id — Delete a news article
 */
exports.deleteNews = async (req, res) => {
  const id = req.params.id;

  try {
    const [existing] = await db.query('SELECT id FROM news_announcements WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Article not found.' });
    }

    await db.query('DELETE FROM news_announcements WHERE id = ?', [id]);

    return res.status(200).json({
      success: true,
      message: 'Article deleted successfully.'
    });
  } catch (error) {
    console.error('Error deleting news:', error);
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
  const { title, category, event_date, description, location, event_time } = req.body;

  if (!title || !category || !event_date) {
    return res.status(400).json({ success: false, message: 'Title, category, and event date are required.' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO events (title, category, event_date, description, location, event_time)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title.trim(), category.trim(), event_date, (description || '').trim(), (location || '').trim(), (event_time || '').trim()]
    );

    const [newEvent] = await db.query('SELECT * FROM events WHERE id = ?', [result.insertId]);

    return res.status(201).json({
      success: true,
      message: 'Event created successfully.',
      event: newEvent[0]
    });
  } catch (error) {
    console.error('Error creating event:', error);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

/**
 * PUT /admin/api/events/:id — Update an event
 */
exports.updateEvent = async (req, res) => {
  const id = req.params.id;
  const { title, category, event_date, description, location, event_time } = req.body;

  if (!title || !category || !event_date) {
    return res.status(400).json({ success: false, message: 'Title, category, and event date are required.' });
  }

  try {
    const [existing] = await db.query('SELECT id FROM events WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    await db.query(
      `UPDATE events
       SET title = ?, category = ?, event_date = ?, description = ?, location = ?, event_time = ?, updated_at = NOW()
       WHERE id = ?`,
      [title.trim(), category.trim(), event_date, (description || '').trim(), (location || '').trim(), (event_time || '').trim(), id]
    );

    const [updated] = await db.query('SELECT * FROM events WHERE id = ?', [id]);

    return res.status(200).json({
      success: true,
      message: 'Event updated successfully.',
      event: updated[0]
    });
  } catch (error) {
    console.error('Error updating event:', error);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

/**
 * DELETE /admin/api/events/:id — Delete an event
 */
exports.deleteEvent = async (req, res) => {
  const id = req.params.id;

  try {
    const [existing] = await db.query('SELECT id FROM events WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    await db.query('DELETE FROM events WHERE id = ?', [id]);

    return res.status(200).json({
      success: true,
      message: 'Event deleted successfully.'
    });
  } catch (error) {
    console.error('Error deleting event:', error);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};
