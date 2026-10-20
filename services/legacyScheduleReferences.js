'use strict';

// Compatibility only: the scheduling feature is retired, but its original
// FK RESTRICT tables remain until the owner performs the backed-up cleanup.
// Read only the building's own backend; never join independent numeric IDs.
async function hasBuildingReferences(id, { supabase = false, connection } = {}) {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid building reference.');
  for (const table of ['room_schedules', 'room_schedule_documents']) {
    if (supabase) {
      const { getSupabaseClient } = require('../config/supabase');
      const { data, error } = await getSupabaseClient().from(table).select('id').eq('building_id', id).limit(1);
      if (error) throw new Error('Unable to check archived building references.');
      if (data && data.length) return true;
    } else {
      const conn = connection || require('../config/db');
      const [rows] = await conn.query('SELECT id FROM ' + table + ' WHERE building_id = ? LIMIT 1', [id]);
      if (rows.length) return true;
    }
  }
  return false;
}

module.exports = { hasBuildingReferences };
