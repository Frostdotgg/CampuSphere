'use strict';

// Preserve Guest navigation and approved information hotspots. Schedules are
// retired for every role, including Administrators, before database cleanup.
const PARTICIPANT_ROLES = new Set(['student-cspc', 'instructor', 'admin']);
const HOTSPOT_TYPES = new Set(['scene', 'info', 'exit']);

function roleOf(value) {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value.role === 'string') return value.role.trim();
  return '';
}

function isGuestVisible(value) {
  return value === true || value === 1 || value === '1';
}

function isSupportedHotspot(hotspot) {
  return !!hotspot && typeof hotspot === 'object' && HOTSPOT_TYPES.has(hotspot.hotspot_type);
}

function withoutScheduleMetadata(hotspot) {
  if (!hotspot || typeof hotspot !== 'object') return hotspot;
  return Object.fromEntries(Object.entries(hotspot).filter(([key]) => !key.startsWith('schedule_')));
}

/**
 * Filter internal hotspot rows before they reach HTML or inline JSON.
 * Privileged participant roles preserve information hotspot behavior;
 * guests and unknown roles receive scene/exit hotspots plus approved info
 * hotspots, while schedule hotspots are always removed.
 */
function filterHotspotsForRole(hotspots, value) {
  const rows = Array.isArray(hotspots) ? hotspots : [];
  const privileged = PARTICIPANT_ROLES.has(roleOf(value));
  return rows
    .filter(isSupportedHotspot)
    .filter((hotspot) => {
      if (!hotspot || typeof hotspot !== 'object') return false;
      if (privileged) return true;
      const type = String(hotspot.hotspot_type || '').trim().toLowerCase();
      return type === 'scene' || type === 'exit' ||
        (type === 'info' && isGuestVisible(hotspot.guest_visible));
    })
    .map(h => {
      const { guest_visible: _policy, ...publicHotspot } = withoutScheduleMetadata(h);
      return publicHotspot;
    });
}

module.exports = {
  isSupportedHotspot,
  withoutScheduleMetadata,
  filterHotspotsForRole,
  isGuestVisible,
  roleOf
};
