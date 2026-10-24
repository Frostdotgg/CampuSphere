'use strict';

const { getSupabaseClient } = require('../config/supabase');
const COLUMNS = 'destination_building_id, mode, direction, steps';
function checked(response) {
  if (response.error) throw new Error('Route instructions are unavailable.');
  return response.data;
}
async function get(destinationId, mode, direction) {
  return checked(await getSupabaseClient().from('campus_route_instruction_lists').select(COLUMNS)
    .eq('destination_building_id', destinationId).eq('mode', mode).eq('direction', direction).maybeSingle());
}
async function list() {
  return allRows('campus_route_instruction_lists', COLUMNS, ['destination_building_id', 'mode', 'direction']);
}
async function allRows(table, columns, order, destinationId) {
  const rows = [], size = 500;
  for (let offset = 0; ; offset += size) {
    let query = getSupabaseClient().from(table).select(columns);
    if (destinationId !== undefined) query = query.eq('destination_building_id', destinationId);
    for (const key of order) query = query.order(key);
    const page = checked(await query.range(offset, offset + size - 1));
    if (!Array.isArray(page)) throw new Error('Route instructions are unavailable.');
    rows.push(...page);
    if (page.length < size) return rows;
  }
}
async function vehicleRoutes(destinationId) {
  return allRows('campus_routes', 'id, start_label, destination_building_id', ['id'], destinationId);
}
async function replace(destinationId, mode, direction, steps) {
  // One row per complete list: an upsert is atomic and never replaces another list.
  checked(await getSupabaseClient().from('campus_route_instruction_lists').upsert({
    destination_building_id: destinationId, mode, direction, steps, updated_at: new Date().toISOString()
  }, { onConflict: 'destination_building_id,mode,direction' }));
}
async function legacySnapshot() {
  const [routes, steps] = await Promise.all([
    vehicleRoutes(),
    allRows('campus_route_steps', 'route_id, step_order, instruction, landmark, lat, lng', ['route_id', 'step_order'])
  ]);
  return { routes, steps };
}
module.exports = { get, list, replace, legacySnapshot, vehicleRoutes };
