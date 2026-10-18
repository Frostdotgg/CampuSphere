'use strict';

const { getSupabaseClient } = require('../config/supabase');

const COLUMNS = 'destination_building_id, path_geometry, distance_meters, walk_time_seconds';
function client() { return getSupabaseClient(); }
function checked(result) {
  if (result.error) throw new Error('Walking route data is unavailable.');
  return result.data;
}
async function list() {
  return checked(await client().from('walking_routes').select(COLUMNS).order('destination_building_id')) || [];
}
async function get(id) {
  return checked(await client().from('walking_routes').select(COLUMNS).eq('destination_building_id', id).maybeSingle());
}
async function building(id) {
  return checked(await client().from('buildings').select('id, name, lat, lng').eq('id', id).maybeSingle());
}
async function buildings() {
  return checked(await client().from('buildings').select('id, name, lat, lng').order('name')) || [];
}
async function save(id, geometry, metrics) {
  return checked(await client().from('walking_routes').upsert({
    destination_building_id: id,
    path_geometry: geometry,
    distance_meters: metrics.distance_meters,
    walk_time_seconds: metrics.walk_time_seconds,
    updated_at: new Date().toISOString()
  }, { onConflict: 'destination_building_id' }).select(COLUMNS).single());
}
async function remove(id) {
  checked(await client().from('walking_routes').delete().eq('destination_building_id', id));
}
module.exports = { list, get, building, buildings, save, remove };
