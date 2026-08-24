'use strict';

/* ========================================
   CampuSphere - Notification feed service

   Read-only, backend-parity feed for the authenticated navbar. Notifications
   are deliberately assembled from existing published announcements and future
   events; this service does not introduce a notification table or read-state
   writes.
   ======================================== */

const crypto = require('crypto');
const db = require('../config/db');
const contentDataSource = require('../config/contentDataSource');
const contentRepository = require('../repositories/contentRepository');

const ANNOUNCEMENT_LIMIT = 5;
const EVENT_LIMIT = 5;
const ALLOWED_ROLES = new Set(['student-cspc', 'instructor', 'admin', 'guest']);

function safeText(value, max) {
  if (value == null) return '';
  const text = String(value).trim();
  return text.slice(0, max);
}

function normalizeRole(role) {
  const value = typeof role === 'string' ? role.trim() : '';
  return ALLOWED_ROLES.has(value) ? value : '';
}

function manilaToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const values = {};
  for (const part of parts) {
    if (part.type !== 'literal') values[part.type] = part.value;
  }
  return `${values.year}-${values.month}-${values.day}`;
}

function safeIso(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function safeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = safeText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function rowRevision(kind, row, fallback) {
  const id = safeText(row && row.id, 80);
  const changed = safeText(
    row && (row.updated_at || row.created_at || row.published_date || row.event_date),
    80
  );
  const visible = kind === 'announcement'
    ? [row && row.title, row && row.category, row && (row.excerpt || row.content), row && row.published_date]
    : [row && row.title, row && row.category, row && row.event_date, row && row.event_time,
      row && row.location, row && row.description];
  return `${kind}|${id}|${changed || fallback}|${visible.map((value) => safeText(value, 240)).join('|')}`;
}

function buildRevision(tokens) {
  return crypto
    .createHash('sha256')
    .update(tokens.slice().sort().join('\n'), 'utf8')
    .digest('hex');
}

function normalizeAnnouncement(row) {
  const title = safeText(row && row.title, 160);
  if (!title) return null;
  return {
    title,
    category: safeText(row.category, 50) || 'Announcement',
    excerpt: safeText(row.excerpt || row.content, 240),
    publishedAt: safeIso(row.published_date)
  };
}

function normalizeEvent(row) {
  const title = safeText(row && row.title, 160);
  const date = safeDate(row && row.event_date);
  if (!title || !date) return null;
  return {
    title,
    category: safeText(row.category, 50) || 'Event',
    date,
    time: safeText(row.event_time, 100) || null,
    location: safeText(row.location, 160) || null,
    description: safeText(row.description, 240)
  };
}

function linksForRole(role) {
  if (role === 'admin') {
    return { announcements: '/admin/news', events: '/events' };
  }
  const section = role === 'instructor'
    ? 'announcements'
    : role === 'guest'
      ? 'news-events'
      : 'news';
  return {
    announcements: `/dashboard?section=${section}`,
    events: '/events'
  };
}

function buildNotificationFeed({ announcements = [], events = [], role = '' } = {}) {
  const normalizedRole = normalizeRole(role);
  const announcementRows = Array.isArray(announcements) ? announcements : [];
  const eventRows = Array.isArray(events) ? events : [];
  const announcementItems = [];
  const eventItems = [];
  const revisions = [];

  for (const row of announcementRows.slice(0, ANNOUNCEMENT_LIMIT)) {
    const item = normalizeAnnouncement(row);
    if (!item) continue;
    announcementItems.push(item);
    revisions.push(rowRevision('announcement', row, item.title));
  }
  for (const row of eventRows.slice(0, EVENT_LIMIT)) {
    const item = normalizeEvent(row);
    if (!item) continue;
    eventItems.push(item);
    revisions.push(rowRevision('event', row, item.date + '|' + item.title));
  }

  return {
    revision: buildRevision(revisions),
    announcements: announcementItems,
    events: eventItems,
    links: linksForRole(normalizedRole)
  };
}

async function loadNotificationFeed(role, now = new Date()) {
  const normalizedRole = normalizeRole(role);
  const today = manilaToday(now);

  if (contentDataSource.isSupabase()) {
    const [announcements, events] = await Promise.all([
      contentRepository.listAnnouncementsForRole(normalizedRole, { limit: ANNOUNCEMENT_LIMIT }),
      contentRepository.listEvents({ from: today, limit: EVENT_LIMIT })
    ]);
    return buildNotificationFeed({ announcements, events, role: normalizedRole });
  }

  const audienceSql = normalizedRole
    ? '(audience = ? OR audience = ?)'
    : 'audience = ?';
  const audienceParams = normalizedRole ? ['all', normalizedRole] : ['all'];
  const [[announcements], [events]] = await Promise.all([
    db.query(
      `SELECT id, title, category, excerpt, content, published_date,
              created_at, updated_at
         FROM news_announcements
        WHERE published_date IS NOT NULL
          AND ${audienceSql}
        ORDER BY published_date DESC
        LIMIT ${ANNOUNCEMENT_LIMIT}`,
      audienceParams
    ),
    db.query(
      `SELECT id, title, category, event_date, event_time, location,
              description, created_at, updated_at
         FROM events
        WHERE event_date >= ?
        ORDER BY event_date ASC, id ASC
        LIMIT ${EVENT_LIMIT}`,
      [today]
    )
  ]);

  return buildNotificationFeed({ announcements, events, role: normalizedRole });
}

module.exports = {
  ANNOUNCEMENT_LIMIT,
  EVENT_LIMIT,
  ALLOWED_ROLES,
  safeText,
  normalizeRole,
  manilaToday,
  safeIso,
  safeDate,
  buildRevision,
  normalizeAnnouncement,
  normalizeEvent,
  linksForRole,
  buildNotificationFeed,
  loadNotificationFeed
};
