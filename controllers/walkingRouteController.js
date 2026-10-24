'use strict';

const walking = require('../services/walkingRouteService');
const routeInstructions = require('../services/routeInstructionService');
const routeAvailability = require('../services/routeAvailability');
const auditService = require('../services/auditService');
const { validatePathGeometry, calculateRouteMetrics } = require('../utils/routeGeometry');

function idOf(req) { return walking.validId(req.params.destinationBuildingId); }
function bad(res, message) { return res.status(400).json({ success: false, message }); }
exports.noStore = (req, res, next) => {
  res.set('Cache-Control', 'no-store, private');
  next();
};
function audit(req, action, id) {
  const actor = req.session && req.session.user || {};
  auditService.record({ event_type: 'admin_mutation', action, outcome: 'success',
    actor_user_id: actor.id, actor_role: actor.role, target_type: 'walking_route', target_id: id,
    message: action === 'admin.walking_route.delete' ? 'Admin removed a walking route.' : 'Admin saved a walking route.' }).catch(() => {});
}

exports.publicRoute = async (req, res) => {
  const id = idOf(req);
  const direction = String(req.query.direction || 'entry');
  if (!id || !['entry', 'exit'].includes(direction)) return bad(res, 'Invalid walking route request.');
  try {
    const { destination, path } = await walking.getValidated(id);
    if (!destination) return res.status(404).json({ success: false, message: 'Unknown destination.' });
    if (!path) return res.json({ success: true, route: null, message: 'Walking route has not been drawn yet.' });
    if (!await walking.displayPinMatches(destination)) return res.json({ success: true, route: null, message: 'Walking route endpoint is unavailable.' });
    const index = await routeAvailability.buildAvailabilityIndex();
    if (!index.ok) throw new Error('Route availability is unavailable.');
    const status = index.ok && index.byName.get(routeAvailability.canonicalKey(destination.name));
    if (!status || !status.route_available || status.route_destination_id !== id) {
      return res.json({ success: true, route: null, message: 'Walking route is unavailable for this building.' });
    }
    const route = walking.forDirection(path, destination, direction);
    Object.assign(route, await routeInstructions.readForDestination(id, 'walking', direction));
    return res.json({ success: true, route });
  } catch (_) {
    return res.status(503).json({ success: false, message: 'Walking routes are temporarily unavailable.' });
  }
};

exports.adminList = async (req, res) => {
  try {
    const [buildings, displayRows, rows, index] = await Promise.all([
      walking.listBuildings(), walking.listDisplayBuildings(), walking.listRows(), routeAvailability.buildAvailabilityIndex()
    ]);
    if (!index.ok) throw new Error('Route availability is unavailable.');
    const byId = new Map(rows.map(row => [Number(row.destination_building_id), row]));
    const displayByKey = new Map();
    displayRows.forEach(row => {
      const key = routeAvailability.canonicalKey(row.name);
      if (!displayByKey.has(key)) displayByKey.set(key, []);
      displayByKey.get(key).push(row);
    });
    const destinations = buildings.map(building => {
      const status = index.byName.get(routeAvailability.canonicalKey(building.name));
      const ready = !!(status && status.route_available && status.route_destination_id === Number(building.id));
      const saved = walking.shape(byId.get(Number(building.id)), building);
      const match = displayByKey.get(routeAvailability.canonicalKey(building.name)) || [];
      const pin = walking.point(building), shown = match.length === 1 ? walking.point(match[0]) : null;
      const samePin = !!(pin && shown && Math.abs(pin.lat - shown.lat) <= 1e-6 && Math.abs(pin.lng - shown.lng) <= 1e-6);
      return {
        id: Number(building.id), name: String(building.name), lat: Number(building.lat), lng: Number(building.lng),
        routeReady: ready, walkingReady: ready && samePin && !!saved, pinMismatch: ready && !samePin,
        distanceMeters: saved ? saved.distance_meters : null
      };
    });
    return res.json({ success: true, origin: walking.ORIGIN, destinations });
  } catch (_) {
    return res.status(503).json({ success: false, message: 'Walking routes are temporarily unavailable.' });
  }
};

exports.adminGet = async (req, res) => {
  const id = idOf(req);
  if (!id) return bad(res, 'Invalid destination.');
  try {
    const { destination, path } = await walking.getValidated(id);
    if (!destination) return res.status(404).json({ success: false, message: 'Unknown destination.' });
    return res.json({ success: true, destination: {
      id: Number(destination.id), name: String(destination.name), lat: Number(destination.lat), lng: Number(destination.lng)
    }, path_geometry: path ? path.geometry : null });
  } catch (_) {
    return res.status(503).json({ success: false, message: 'Walking route is temporarily unavailable.' });
  }
};

exports.adminSave = async (req, res) => {
  const id = idOf(req);
  if (!id) return bad(res, 'Invalid destination.');
  const body = req.body || {};
  if (Object.keys(body).length !== 1 || !Object.prototype.hasOwnProperty.call(body, 'path_geometry')) {
    return bad(res, 'Only path_geometry is accepted.');
  }
  try {
    const destination = await walking.getBuilding(id);
    if (!destination) return res.status(404).json({ success: false, message: 'Unknown destination.' });
    const index = await routeAvailability.buildAvailabilityIndex();
    if (!index.ok) throw new Error('Route availability is unavailable.');
    const status = index.ok && index.byName.get(routeAvailability.canonicalKey(destination.name));
    if (!status || !status.route_available || status.route_destination_id !== id) {
      return res.status(409).json({ success: false, message: 'This building is not route-ready.' });
    }
    if (!Array.isArray(body.path_geometry) || body.path_geometry.length < 3) return bad(res, 'Add at least one pedestrian waypoint.');
    if (!await walking.displayPinMatches(destination)) return res.status(409).json({ success: false, message: 'Check the building map coordinates before drawing.' });
    const checked = validatePathGeometry(body.path_geometry, {
      fromNode: walking.ORIGIN, toNode: walking.point(destination), snapEndpoints: true
    });
    if (!checked.ok) return bad(res, checked.message);
    const metrics = calculateRouteMetrics(checked.value);
    if (!metrics) return bad(res, 'Invalid walking path metrics.');
    await walking.save(id, checked.value, metrics);
    audit(req, 'admin.walking_route.update', id);
    return res.json({ success: true, destinationBuildingId: id, ...metrics });
  } catch (_) {
    return res.status(503).json({ success: false, message: 'Walking route could not be saved.' });
  }
};

exports.adminDelete = async (req, res) => {
  const id = idOf(req);
  if (!id) return bad(res, 'Invalid destination.');
  try {
    await walking.remove(id);
    audit(req, 'admin.walking_route.delete', id);
    return res.json({ success: true });
  } catch (_) {
    return res.status(503).json({ success: false, message: 'Walking route could not be removed.' });
  }
};
