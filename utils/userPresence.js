'use strict';

/*
 * CampuSphere — user presence policy
 *
 * Presence is deliberately separate from account timestamps.  `updated_at`
 * describes a user-record change; this module describes the short-lived,
 * approximate "recently using the app" signal shown to administrators.
 */

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const TOUCH_MIN_INTERVAL_SECONDS = 60;

function timestampMs(value) {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string' || value.trim() === '') return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Online is inclusive at the five-minute boundary.  A missing or invalid
 * timestamp is never treated as recent.
 */
function isUserOnline(lastSeenAt, now = Date.now()) {
  const seen = timestampMs(lastSeenAt);
  const current = timestampMs(now);
  if (seen === null || current === null) return false;
  return seen >= current - ONLINE_WINDOW_MS && seen <= current;
}

function presenceSnapshot(rows, now = new Date()) {
  const serverNow = now instanceof Date ? now : new Date(now);
  const nowMs = serverNow.getTime();
  const safeNow = Number.isFinite(nowMs) ? serverNow : new Date();
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const id = Number(row && (row.id ?? row.user_id));
    const lastSeenAt = row && (row.lastSeenAt ?? row.last_seen_at);
    const parsed = timestampMs(lastSeenAt);
    return {
      id: Number.isSafeInteger(id) && id > 0 ? id : null,
      lastSeenAt: parsed === null ? null : new Date(parsed).toISOString(),
      isOnline: isUserOnline(lastSeenAt, safeNow.getTime())
    };
  }).filter((row) => row.id !== null);
}

module.exports = {
  ONLINE_WINDOW_MS,
  TOUCH_MIN_INTERVAL_SECONDS,
  timestampMs,
  isUserOnline,
  presenceSnapshot
};
