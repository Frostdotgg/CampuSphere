'use strict';

// Maintenance safety: older data copies must never resurrect retired content.
// Pure, database-free preflight; it also rejects stale metadata on info/scene
// rows until the owner's explicit cleanup has cleared it.
function assertNoRetiredScheduling(value) {
  if (!value || typeof value !== 'object') return;
  if ([value.hotspot_type, value.type].some(type => typeof type === 'string' && type.trim().toLowerCase() === 'schedule')) {
    throw new Error('Room scheduling is retired. Complete the owner-controlled data cleanup before synchronization.');
  }
  for (const [key, item] of Object.entries(value)) {
    if (['room_schedules', 'room_schedule_documents', 'scheduleDocuments'].includes(key) && Array.isArray(item) && item.length ||
        key.startsWith('schedule_') && item !== null && item !== undefined) {
      throw new Error('Room scheduling is retired. Complete the owner-controlled data cleanup before synchronization.');
    }
    if (item && typeof item === 'object') assertNoRetiredScheduling(item);
  }
}

module.exports = { assertNoRetiredScheduling };
