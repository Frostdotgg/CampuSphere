'use strict';

const db = require('../config/db');
const mapRuntime = require('../config/mapRuntime');
const repository = require('../repositories/routeInstructionRepository');
const routes = require('../repositories/routeRepository');
const rules = require('../utils/routeInstructions');

function decode(row) {
  if (!row) return null;
  const steps = typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps;
  return { ...row, steps };
}
async function loadSnapshot() {
  // Offline assembly reads each instruction dataset once, never per building.
  if (mapRuntime.isRouteSupabase()) {
    const [legacy, lists] = await Promise.all([repository.legacySnapshot(), repository.list()]);
    return { ...legacy, lists: lists.map(decode) };
  }
  const [[legacyRoutes], [steps], [lists]] = await Promise.all([
    db.query('SELECT id, start_label, destination_building_id FROM campus_routes ORDER BY id'),
    db.query('SELECT route_id, step_order, instruction, landmark, lat, lng FROM campus_route_steps ORDER BY route_id, step_order'),
    db.query('SELECT destination_building_id, mode, direction, steps FROM campus_route_instruction_lists')
  ]);
  return { routes: legacyRoutes, steps, lists: lists.map(decode) };
}
async function getList(destinationId, mode, direction) {
  if (!rules.validId(destinationId) || !rules.isAdditionalList(mode, direction)) throw new Error('Invalid instruction selection.');
  const row = mapRuntime.isRouteSupabase() ? await repository.get(destinationId, mode, direction)
    : (await db.query('SELECT destination_building_id, mode, direction, steps FROM campus_route_instruction_lists WHERE destination_building_id = ? AND mode = ? AND direction = ?', [destinationId, mode, direction]))[0][0];
  const validation = rules.validateSteps({ steps: row ? decode(row).steps : [] });
  if (!validation.ok) throw new Error('Stored instructions are unavailable.');
  return validation.value;
}
async function replaceList(destinationId, mode, direction, steps) {
  const validation = rules.validateSteps({ steps }, { strictFields: true });
  if (!rules.validId(destinationId) || !rules.isAdditionalList(mode, direction) || !validation.ok) throw new Error('Invalid instruction selection.');
  if (mapRuntime.isRouteSupabase()) return repository.replace(destinationId, mode, direction, validation.value);
  await db.query(`INSERT INTO campus_route_instruction_lists (destination_building_id, mode, direction, steps)
    VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE steps = VALUES(steps), updated_at = CURRENT_TIMESTAMP`,
  [destinationId, mode, direction, JSON.stringify(validation.value)]);
}
async function buildingExists(destinationId) {
  if (mapRuntime.isRouteSupabase()) return Boolean(await routes.findRouteSourceBuildingById(destinationId));
  return (await db.query('SELECT id FROM buildings WHERE id = ? LIMIT 1', [destinationId]))[0].length > 0;
}
async function readForDestination(destinationId, mode, direction) {
  try {
    if (!rules.validId(destinationId) || !rules.validSelection(mode, direction)) return rules.fromStored(null);
    if (rules.isAdditionalList(mode, direction)) {
      const steps = await getList(destinationId, mode, direction);
      return rules.resolveSnapshot({ lists: [{ destination_building_id: destinationId, mode, direction, steps }] }, destinationId, mode, direction);
    }
    let candidates;
    if (mapRuntime.isRouteSupabase()) {
      candidates = await repository.vehicleRoutes(destinationId);
    } else {
      [candidates] = await db.query('SELECT id, start_label, destination_building_id FROM campus_routes WHERE destination_building_id = ?', [destinationId]);
    }
    const match = rules.resolveVehicleRoute(candidates, destinationId);
    let steps = [];
    if (match.route && rules.validId(match.route.id)) {
      steps = mapRuntime.isRouteSupabase() ? await routes.adminListSteps(match.route.id)
        : (await db.query('SELECT step_order, instruction, landmark, lat, lng FROM campus_route_steps WHERE route_id = ? ORDER BY step_order', [match.route.id]))[0];
      steps = steps.map(step => ({ ...step, route_id: match.route.id }));
    }
    // Online and offline assembly finish through exactly the same resolver.
    return rules.resolveSnapshot({ routes: candidates, steps }, destinationId, mode, direction);
  } catch (_) {
    console.warn('[route-instructions] read unavailable');
    return rules.fromStored(null);
  }
}
module.exports = { loadSnapshot, getList, replaceList, buildingExists, readForDestination };
