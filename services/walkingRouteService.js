'use strict';

const db = require('../config/db');
const mapRuntime = require('../config/mapRuntime');
const supabase = require('../repositories/walkingRouteRepository');
const buildingRepository = require('../repositories/buildingRepository');
const { validatePathGeometry, calculateRouteMetrics, normalizeStoredPathGeometry, reversePathGeometry } = require('../utils/routeGeometry');

const ORIGIN = Object.freeze({ key: 'walking-guard-house', label: 'Walking Guard House', lat: 13.405710, lng: 123.374181 });
const validId = (value) => {
  if (typeof value === 'string' && !/^[1-9][0-9]*$/.test(value)) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};
const coord = (value) => value === null || value === undefined || value === '' ? null : Number(value);
const point = (row) => row && Number.isFinite(coord(row.lat)) && Number.isFinite(coord(row.lng))
  ? { lat: coord(row.lat), lng: coord(row.lng) } : null;

async function listRows() {
  if (mapRuntime.isRouteSupabase()) return supabase.list();
  const [rows] = await db.query('SELECT destination_building_id, path_geometry, distance_meters, walk_time_seconds FROM walking_routes ORDER BY destination_building_id');
  return rows;
}
async function getRow(id) {
  if (mapRuntime.isRouteSupabase()) return supabase.get(id);
  const [rows] = await db.query('SELECT destination_building_id, path_geometry, distance_meters, walk_time_seconds FROM walking_routes WHERE destination_building_id = ? LIMIT 1', [id]);
  return rows[0] || null;
}
async function getBuilding(id) {
  if (mapRuntime.isRouteSupabase()) return supabase.building(id);
  const [rows] = await db.query('SELECT id, name, lat, lng FROM buildings WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}
async function listBuildings() {
  if (mapRuntime.isRouteSupabase()) return supabase.buildings();
  const [rows] = await db.query('SELECT id, name, lat, lng FROM buildings ORDER BY name');
  return rows;
}
async function listDisplayBuildings() {
  return mapRuntime.isBuildingSupabase()
    ? buildingRepository.listAll()
    : (await db.query('SELECT id, name, lat, lng FROM buildings ORDER BY id'))[0];
}
async function displayPinMatches(destination) {
  const rows = await listDisplayBuildings();
  const key = String(destination.name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const matches = rows.filter(row => String(row.name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() === key);
  const source = point(destination), display = matches.length === 1 ? point(matches[0]) : null;
  return !!(source && display && Math.abs(source.lat - display.lat) <= 1e-6 && Math.abs(source.lng - display.lng) <= 1e-6);
}
async function save(id, geometry, metrics) {
  if (mapRuntime.isRouteSupabase()) return supabase.save(id, geometry, metrics);
  await db.query('INSERT INTO walking_routes (destination_building_id, path_geometry, distance_meters, walk_time_seconds) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE path_geometry = VALUES(path_geometry), distance_meters = VALUES(distance_meters), walk_time_seconds = VALUES(walk_time_seconds)',
    [id, JSON.stringify(geometry), metrics.distance_meters, metrics.walk_time_seconds]);
  return getRow(id);
}
async function remove(id) {
  if (mapRuntime.isRouteSupabase()) return supabase.remove(id);
  await db.query('DELETE FROM walking_routes WHERE destination_building_id = ?', [id]);
}
function shape(row, destination) {
  if (!row || !destination || !validId(row.destination_building_id) ||
      validId(row.destination_building_id) !== validId(destination.id)) return null;
  const end = point(destination);
  const geometry = normalizeStoredPathGeometry(row && row.path_geometry);
  if (!end || !geometry || geometry.state !== 'present' || geometry.value.length < 3) return null;
  const checked = validatePathGeometry(geometry.value, { fromNode: ORIGIN, toNode: end, snapEndpoints: true });
  if (!checked.ok) return null;
  const metrics = calculateRouteMetrics(checked.value);
  if (!metrics || Number(row.distance_meters) !== metrics.distance_meters || Number(row.walk_time_seconds) !== metrics.walk_time_seconds) return null;
  return { geometry: checked.value, ...metrics };
}
function forDirection(path, destination, direction) {
  const exit = direction === 'exit';
  return {
    mode: 'walking', direction,
    start: exit ? { key: String(destination.id), label: destination.name } : ORIGIN,
    destination: exit ? ORIGIN : { key: String(destination.id), label: destination.name, buildingId: Number(destination.id) },
    distance_meters: path.distance_meters,
    walk_time_seconds: path.walk_time_seconds,
    estimated_walk_time: Math.max(1, Math.ceil(path.walk_time_seconds / 60)) + ' minutes',
    nodes: exit
      ? [{ key: String(destination.id), label: destination.name }, ORIGIN]
      : [ORIGIN, { key: String(destination.id), label: destination.name }],
    segments: [{
      from: exit ? String(destination.id) : ORIGIN.key,
      to: exit ? ORIGIN.key : String(destination.id),
      path_label: 'pedestrian path',
      distance_meters: path.distance_meters
    }],
    geometry: exit ? reversePathGeometry(path.geometry) : path.geometry
  };
}
async function getValidated(id) {
  const destination = await getBuilding(id);
  if (!destination) return { destination: null, path: null };
  const row = await getRow(id);
  return { destination, path: shape(row, destination) };
}
async function decorate(buildings) {
  const list = Array.isArray(buildings) ? buildings : [];
  try {
    const [rows, destinations] = await Promise.all([listRows(), listBuildings()]);
    const byId = new Map(destinations.map((b) => [Number(b.id), b]));
    const paths = new Map(rows.map((r) => [Number(r.destination_building_id), r]));
    for (const building of list) {
      const id = validId(building.route_destination_id);
      const destination = id && byId.get(id);
      const displayPoint = point(building), routePoint = point(destination);
      const samePin = displayPoint && routePoint && Math.abs(displayPoint.lat - routePoint.lat) <= 1e-6 && Math.abs(displayPoint.lng - routePoint.lng) <= 1e-6;
      building.walking_available = !!(building.route_available && id && samePin && shape(paths.get(id), destination));
      building.walking_unavailable_reason = building.walking_available ? null : 'walking_not_drawn';
    }
    return { buildings: list, ok: true };
  } catch (_) {
    for (const building of list) { building.walking_available = false; building.walking_unavailable_reason = 'route_data_unavailable'; }
    return { buildings: list, ok: false };
  }
}
module.exports = { ORIGIN, validId, point, shape, forDirection, listRows, getRow, getBuilding, listBuildings, save, remove, getValidated, listDisplayBuildings, displayPinMatches, decorate };
