'use strict';

/*
 * CampuSphere — user presence service
 *
 * This is the single source-selection boundary for presence. It keeps the
 * controller and authentication code independent of MySQL/Supabase details.
 * Presence writes are deliberately best-effort at login, while the explicit
 * heartbeat endpoint reports a fixed 503 when its store is unavailable.
 */

const db = require('../config/db');
const authDataSource = require('../config/authDataSource');
const userRepository = require('../repositories/userRepository');
const {
  ONLINE_WINDOW_MS,
  TOUCH_MIN_INTERVAL_SECONDS,
  presenceSnapshot
} = require('../utils/userPresence');

const MYSQL_TOUCH_SQL =
  'INSERT INTO user_presence (user_id, last_seen_at) VALUES (?, CURRENT_TIMESTAMP(3)) ' +
  'ON DUPLICATE KEY UPDATE last_seen_at = IF(' +
  'last_seen_at < CURRENT_TIMESTAMP(3) - INTERVAL ' + TOUCH_MIN_INTERVAL_SECONDS +
  ' SECOND, CURRENT_TIMESTAMP(3), last_seen_at)';

function validUserId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function touchUserPresence(userId) {
  const id = validUserId(userId);
  if (id === null) throw new Error('userPresenceService: user id is required');

  if (authDataSource.isSupabase()) {
    await userRepository.touchUserPresence(id);
    return;
  }

  // The interval is a fixed literal, never request input. MySQL performs the
  // conditional update atomically, so concurrent tabs cannot amplify writes.
  await db.query(MYSQL_TOUCH_SQL, [id]);
}

async function listUserPresence() {
  if (authDataSource.isSupabase()) {
    return userRepository.listUserPresence();
  }
  const [rows] = await db.query(
    // The timestamp index supports the deterministic snapshot order; the
    // controller still maps rows by user id and performs no N+1 reads.
    'SELECT user_id, last_seen_at FROM user_presence ORDER BY last_seen_at ASC'
  );
  return Array.isArray(rows) ? rows : [];
}

async function touchUserPresenceBestEffort(userId) {
  try {
    await touchUserPresence(userId);
    return true;
  } catch (error) {
    // The failure is intentionally fixed and contains no backend/credential
    // detail. Login must remain available if presence is temporarily down.
    console.warn('User presence update skipped.');
    return false;
  }
}

async function getAdminSnapshot(now = new Date()) {
  const rows = await listUserPresence();
  return {
    serverNow: (now instanceof Date ? now : new Date(now)).toISOString(),
    onlineWindowSeconds: Math.floor(ONLINE_WINDOW_MS / 1000),
    users: presenceSnapshot(rows, now)
  };
}

module.exports = {
  MYSQL_TOUCH_SQL,
  validUserId,
  touchUserPresence,
  touchUserPresenceBestEffort,
  listUserPresence,
  getAdminSnapshot,
  ONLINE_WINDOW_MS,
  TOUCH_MIN_INTERVAL_SECONDS
};
