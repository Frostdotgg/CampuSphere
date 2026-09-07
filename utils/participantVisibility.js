'use strict';

/*
 * Participant visibility policy shared by schedule routes, VR controllers,
 * and the participant views.  This is deliberately fail-closed: only the
 * three participant roles that already have schedule access receive the full
 * hotspot payload.  Guests can navigate every scene/exit and may see only
 * information hotspots explicitly approved by an administrator.
 */

const SCHEDULE_VIEW_ROLES = Object.freeze(['student-cspc', 'instructor', 'admin']);
const SCHEDULE_VIEW_ROLE_SET = new Set(SCHEDULE_VIEW_ROLES);

function roleOf(value) {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value.role === 'string') return value.role.trim();
  return '';
}

function canViewRoomSchedules(value) {
  return SCHEDULE_VIEW_ROLE_SET.has(roleOf(value));
}

function isGuestVisible(value) {
  return value === true || value === 1 || value === '1';
}

function stripPolicyField(hotspot) {
  if (!hotspot || typeof hotspot !== 'object') return hotspot;
  const { guest_visible: _guestVisible, ...publicHotspot } = hotspot;
  return publicHotspot;
}

/**
 * Filter internal hotspot rows before they reach HTML or inline JSON.
 * Privileged participant roles preserve the existing full hotspot behavior;
 * guests and unknown roles receive scene/exit hotspots plus approved info
 * hotspots, while schedule hotspots are always removed.
 */
function filterHotspotsForRole(hotspots, value) {
  const rows = Array.isArray(hotspots) ? hotspots : [];
  const privileged = canViewRoomSchedules(value);
  return rows
    .filter((hotspot) => {
      if (!hotspot || typeof hotspot !== 'object') return false;
      if (privileged) return true;
      const type = String(hotspot.hotspot_type || '').trim().toLowerCase();
      return type === 'scene' || type === 'exit' ||
        (type === 'info' && isGuestVisible(hotspot.guest_visible));
    })
    .map(stripPolicyField);
}

module.exports = {
  SCHEDULE_VIEW_ROLES,
  canViewRoomSchedules,
  filterHotspotsForRole,
  isGuestVisible,
  roleOf
};
