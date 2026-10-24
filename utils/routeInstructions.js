'use strict';

// Shared, database-free instruction contract. Geometry never comes from text.
const EMPTY_MESSAGE = 'No instructions have been added for this route yet.';
const UNAVAILABLE_MESSAGE = 'Instructions are temporarily unavailable.';
const MAX_STEPS = 200;
const MAX_INSTRUCTION = 5000;
const MAX_LANDMARK = 255;
const GATE_ALIASES = new Set(['guard house', 'guard house main gate', 'main gate']);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function validId(value) {
  if (!['string', 'number'].includes(typeof value) || !/^[1-9][0-9]*$/.test(String(value))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}
function validSelection(mode, direction) {
  return ['vehicle', 'walking'].includes(mode) && ['entry', 'exit'].includes(direction);
}
function isAdditionalList(mode, direction) {
  return validSelection(mode, direction) && !(mode === 'vehicle' && direction === 'entry');
}
function coordinate(value, limit) {
  if (value == null || value === '') return { ok: true, value: null };
  if (typeof value === 'string' && value.trim() === '') return { ok: true, value: null };
  if (!['string', 'number'].includes(typeof value) ||
      (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value.trim()))) return { ok: false };
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? { ok: true, value: number } : { ok: false };
}
function validateSteps(body, { strictFields = false } = {}) {
  const fail = message => ({ ok: false, message });
  if (!plain(body) || (strictFields && Object.keys(body).some(key => key !== 'steps'))) return fail('Only an ordered steps list is accepted.');
  if (!Array.isArray(body.steps)) return fail('Steps must be an array.');
  if (body.steps.length > MAX_STEPS) return fail('A route can have at most 200 steps.');
  const steps = [];
  for (const [index, step] of body.steps.entries()) {
    if (!plain(step) || (strictFields && Object.keys(step).some(key => !['step_order', 'instruction', 'landmark', 'lat', 'lng'].includes(key)))) return fail('Each step must contain only supported instruction fields.');
    if (typeof step.instruction !== 'string' || !step.instruction.trim() || step.instruction.trim().length > MAX_INSTRUCTION) return fail('Step ' + (index + 1) + ': instruction is required and must be 5000 characters or fewer.');
    let landmark = null;
    if (step.landmark != null) {
      if (typeof step.landmark !== 'string' || step.landmark.trim().length > MAX_LANDMARK) return fail('Step ' + (index + 1) + ': landmark must be 255 characters or fewer.');
      landmark = step.landmark.trim() || null;
    }
    const lat = coordinate(step.lat, 90), lng = coordinate(step.lng, 180);
    if (!lat.ok || !lng.ok) return fail('Step ' + (index + 1) + ': coordinates must be valid latitude/longitude values or blank.');
    const suppliedOrder = typeof step.step_order === 'string' ? step.step_order.trim() : step.step_order;
    if (step.step_order != null && step.step_order !== '' && validId(suppliedOrder) !== index + 1) return fail('Step order must be sequential (1..N) and match each step\'s position.');
    steps.push({ step_order: index + 1, instruction: step.instruction.trim(), landmark, lat: lat.value, lng: lng.value });
  }
  return { ok: true, value: steps };
}
function result(steps, instructionStatus) {
  return { instructions: steps.map(step => ({ order: step.step_order, instruction: step.instruction })), instructionStatus };
}
function fromStored(steps) {
  const validation = validateSteps({ steps });
  return validation.ok ? result(validation.value, validation.value.length ? 'saved' : 'empty') : result([], 'unavailable');
}
function resolveVehicleRoute(routes, destinationId) {
  const id = validId(destinationId);
  const matches = id === null ? [] : (routes || []).filter(route => {
    const label = String(route.start_label || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return validId(route.destination_building_id) === id && GATE_ALIASES.has(label);
  });
  return matches.length === 1 ? { route: matches[0], ambiguous: false } : { route: null, ambiguous: matches.length > 1 };
}
function resolveSnapshot(snapshot, destinationId, mode, direction) {
  if (!validId(destinationId) || !validSelection(mode, direction)) return result([], 'unavailable');
  if (mode === 'vehicle' && direction === 'entry') {
    const match = resolveVehicleRoute(snapshot.routes, destinationId);
    if (match.ambiguous) return result([], 'unavailable');
    if (!match.route) return result([], 'empty');
    if (!validId(match.route.id)) return result([], 'unavailable');
    return fromStored((snapshot.steps || []).filter(step => validId(step.route_id) === validId(match.route.id))
      .slice().sort((a, b) => Number(a.step_order) - Number(b.step_order)));
  }
  const matches = (snapshot.lists || []).filter(row => validId(row.destination_building_id) === validId(destinationId) && row.mode === mode && row.direction === direction);
  if (matches.length > 1) return result([], 'unavailable');
  return fromStored(matches.length ? matches[0].steps : []);
}
module.exports = { EMPTY_MESSAGE, UNAVAILABLE_MESSAGE, MAX_STEPS, MAX_INSTRUCTION, MAX_LANDMARK,
  validId, validSelection, isAdditionalList, validateSteps, fromStored, resolveVehicleRoute, resolveSnapshot };
