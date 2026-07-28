/* ========================================
   CampuSphere — Admin Route / Graph API Controller
   Milestone 7, Section 7.9: Route, Step, Node, and Edge Administration.

   Admin-only JSON CRUD for campus_routes, campus_route_steps, route_nodes,
   and route_edges, gated by routes/admin.js -> router.use(requireRole('admin')).
   Validation, HTTP status decisions, dependency guards, and audit logging live
   here; data access is parameterised SQL (MySQL) or repositories/routeRepository
   admin methods (Supabase), chosen by ROUTE_DATA_SOURCE.

   Atomicity:
     MySQL   -> route+steps replace and the node-delete guard run in a
                transaction (begin -> checks -> write -> commit / rollback).
     Supabase-> single-row writes are atomic; route+steps replace and node
                create/update/delete go through the service-role-only SQL
                functions in database/supabase/0007_route_graph_admin_write_functions.sql
                (node writes also compute the PostGIS `location` column).

   Privacy: never logs request bodies, payload values, SQL, raw errors, stacks,
   Supabase URLs/keys, cookies, sessions, or OAuth subjects. Failures emit one
   fixed sanitized warning and a generic 500. Audit rows store only fixed
   messages + the changed row id.
   ======================================== */

const db = require('../config/db');
const mapRuntime = require('../config/mapRuntime');
const routeRepository = require('../repositories/routeRepository');
const auditService = require('../services/auditService');
const {
  validatePathGeometry,
  reversePathGeometry,
  normalizeStoredPathGeometry,
  ENDPOINT_EPSILON
} = require('../utils/routeGeometry');

/* ---------- field limits / allowed values (mirror the schema) ---------- */

const ROUTE_TITLE_MAX = 150;
const ROUTE_START_MAX = 100;
const ROUTE_WALKTIME_MAX = 50;
const STEP_INSTRUCTION_MAX = 5000;
const STEP_LANDMARK_MAX = 255;
const STEP_MAX_COUNT = 200;
const NODE_KEY_MAX = 60;
const NODE_LABEL_MAX = 150;
const EDGE_PATHLABEL_MAX = 150;
const ORDER_MAX = 2147483647;
const LAT_MIN = -90, LAT_MAX = 90;
const LNG_MIN = -180, LNG_MAX = 180;
// node_type allowlist — exactly the practical values used by the seed/current data.
const NODE_TYPES = ['gate', 'walkway', 'building', 'service'];

const ROUTE_COLS_SQL = 'id, title, start_label, destination_building_id, estimated_walk_time';
const NODE_COLS_SQL = 'id, node_key, label, node_type, building_id, lat, lng, display_order';
const STEP_COLS_SQL = 'route_id, step_order, instruction, landmark, lat, lng';
const EDGE_SELECT_SQL =
  'SELECT e.id, e.from_node_id, e.to_node_id, e.distance_meters, e.walk_time_seconds, ' +
  'e.path_label, e.is_accessible, fn.node_key AS from_node_key, fn.label AS from_label, ' +
  'tn.node_key AS to_node_key, tn.label AS to_label ' +
  'FROM route_edges e JOIN route_nodes fn ON fn.id = e.from_node_id ' +
  'JOIN route_nodes tn ON tn.id = e.to_node_id';
// RF.4: single-edge editor read — the geometry-free EDGE_SELECT_SQL above stays
// the LIST shape; this adds path_geometry and the endpoint node coordinates the
// geometry editor needs (id, node id/key/label, lat, lng).
const EDGE_GEOMETRY_SELECT_SQL =
  'SELECT e.id, e.from_node_id, e.to_node_id, e.distance_meters, e.walk_time_seconds, ' +
  'e.path_label, e.is_accessible, e.path_geometry, ' +
  'fn.node_key AS from_node_key, fn.label AS from_label, fn.lat AS from_lat, fn.lng AS from_lng, ' +
  'tn.node_key AS to_node_key, tn.label AS to_label, tn.lat AS to_lat, tn.lng AS to_lng ' +
  'FROM route_edges e JOIN route_nodes fn ON fn.id = e.from_node_id ' +
  'JOIN route_nodes tn ON tn.id = e.to_node_id';
// RF.4 node-move guard message (decision 12) and the coordinate-change test.
const NODE_GEOMETRY_MSG =
  'This node has road geometry attached. Clear or redraw the attached edge geometry before moving this node.';
// RF.4 repair (Finding 1): directed-edge endpoints are immutable after
// creation — changing them would strand path_geometry on the row and its
// former reverse pair.
const EDGE_ENDPOINTS_IMMUTABLE_MSG =
  'Edge endpoints cannot be changed after creation. Delete and recreate the connection instead.';
function coordsChanged(oldLat, oldLng, newLat, newLng) {
  const oa = Number(oldLat), ob = Number(oldLng);
  const na = Number(newLat), nb = Number(newLng);
  if (!Number.isFinite(oa) || !Number.isFinite(ob)) return true; // unknown old coords -> treat as a change
  return Math.abs(oa - na) > ENDPOINT_EPSILON || Math.abs(ob - nb) > ENDPOINT_EPSILON;
}
// Shape a raw edge+geometry row (MySQL or Supabase) into the editor payload,
// returning only contract-valid snapped points or null. Never surfaces raw
// stored geometry — malformed storage becomes null (editor starts fresh).
function shapeEditorEdge(row) {
  const fromLat = row.from_lat != null ? Number(row.from_lat) : null;
  const fromLng = row.from_lng != null ? Number(row.from_lng) : null;
  const toLat = row.to_lat != null ? Number(row.to_lat) : null;
  const toLng = row.to_lng != null ? Number(row.to_lng) : null;
  let geometry = null;
  const norm = normalizeStoredPathGeometry(row.path_geometry);
  if (norm.state === 'present') {
    const v = validatePathGeometry(norm.value, {
      fromNode: { lat: fromLat, lng: fromLng }, toNode: { lat: toLat, lng: toLng },
      allowNull: false, snapEndpoints: true
    });
    if (v.ok) geometry = v.value;
  }
  return {
    id: Number(row.id),
    from_node_id: Number(row.from_node_id), from_node_key: row.from_node_key || null,
    from_label: row.from_label || null, from_lat: fromLat, from_lng: fromLng,
    to_node_id: Number(row.to_node_id), to_node_key: row.to_node_key || null,
    to_label: row.to_label || null, to_lat: toLat, to_lng: toLng,
    distance_meters: Number(row.distance_meters) || 0,
    walk_time_seconds: Number(row.walk_time_seconds) || 0,
    path_label: row.path_label != null ? row.path_label : null,
    is_accessible: (row.is_accessible === true || row.is_accessible === 1 || row.is_accessible === '1'),
    path_geometry: geometry
  };
}

function isSupabase() { return mapRuntime.isRouteSupabase(); }

/* ---------- error + transaction plumbing ---------- */

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; this.expose = true; }
}

function handleErr(res, e, label) {
  if (e && e.expose) return res.status(e.status).json({ success: false, message: e.message });
  // A Supabase node-delete guard raises NODE_REFERENCED; map it to 409 if it
  // surfaces (race backstop). Never echo the raw error.
  if (e && typeof e.message === 'string' && e.message.indexOf('NODE_REFERENCED') !== -1) {
    return res.status(409).json({ success: false, message: 'This node is referenced by an edge or VR scene and cannot be deleted.' });
  }
  // RF.4 Supabase atomic backstops (migration 0016). Map the fixed function
  // errors to their sanitized HTTP status; never echo the raw error.
  if (e && typeof e.message === 'string' && e.message.indexOf('NODE_GEOMETRY_ATTACHED') !== -1) {
    return res.status(409).json({ success: false, message: 'This node has road geometry attached. Clear or redraw the attached edge geometry before moving this node.' });
  }
  if (e && typeof e.message === 'string' && e.message.indexOf('EDGE_PAIR_NOT_FOUND') !== -1) {
    return res.status(409).json({ success: false, message: 'The reverse direction of this edge is missing. Both directions must exist to store geometry.' });
  }
  if (e && typeof e.message === 'string' && e.message.indexOf('INVALID_GEOMETRY') !== -1) {
    return res.status(400).json({ success: false, message: 'The submitted road geometry is invalid.' });
  }
  console.error('adminRouteController.' + label + ': unexpected failure.');
  return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
}

async function withTx(fn) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) {
    try { await conn.rollback(); } catch (_) { /* ignore */ }
    throw e;
  } finally {
    conn.release();
  }
}

function auditMut(req, action, targetType, targetId, message) {
  const actor = (req.session && req.session.user) || {};
  auditService.record({
    event_type: 'admin_mutation',
    action,
    outcome: 'success',
    actor_user_id: actor.id,
    actor_role: actor.role,
    target_type: targetType,
    target_id: targetId,
    message
  }).catch(() => {});
}

/* ---------- shared value parsing ---------- */

function isPlainObject(b) { return b !== null && typeof b === 'object' && !Array.isArray(b); }
function reqStr(raw, max) { if (typeof raw !== 'string') return { ok: false }; const v = raw.trim(); if (v === '' || v.length > max) return { ok: false }; return { ok: true, value: v }; }
function optStr(raw, max) { if (raw === undefined || raw === null) return { ok: true, value: null }; if (typeof raw !== 'string') return { ok: false }; const v = raw.trim(); if (v === '') return { ok: true, value: null }; if (v.length > max) return { ok: false }; return { ok: true, value: v }; }

function parseId(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const s = String(raw).trim();
  if (!/^(0|[1-9][0-9]*)$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < 1) return null;
  return n;
}
function optId(raw) {
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) return { ok: true, value: null };
  const n = parseId(raw);
  if (n === null) return { ok: false };
  return { ok: true, value: n };
}
function parseOrder(raw) {
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) return { ok: true, value: 0 };
  if (typeof raw === 'number') { if (!Number.isInteger(raw) || raw < 0 || raw > ORDER_MAX) return { ok: false }; return { ok: true, value: raw }; }
  if (typeof raw === 'string') { const s = raw.trim(); if (!/^(0|[1-9][0-9]*)$/.test(s)) return { ok: false }; const n = Number(s); if (!Number.isSafeInteger(n) || n > ORDER_MAX) return { ok: false }; return { ok: true, value: n }; }
  return { ok: false };
}
// positive integer >= 1 (distance / time)
function parsePosInt(raw) {
  if (typeof raw === 'number') { if (!Number.isInteger(raw) || raw < 1 || raw > ORDER_MAX) return { ok: false }; return { ok: true, value: raw }; }
  if (typeof raw === 'string') { const s = raw.trim(); if (!/^[1-9][0-9]*$/.test(s)) return { ok: false }; const n = Number(s); if (!Number.isSafeInteger(n) || n > ORDER_MAX) return { ok: false }; return { ok: true, value: n }; }
  return { ok: false };
}
// decimal coordinate: blank -> null; else a finite number or trimmed decimal
// string within [min,max]. Booleans, arrays, objects, NaN/Infinity rejected.
function parseDecimal(raw, min, max) {
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) return { ok: true, value: null };
  let n;
  if (typeof raw === 'number') { if (!Number.isFinite(raw)) return { ok: false }; n = raw; }
  else if (typeof raw === 'string') { const s = raw.trim(); if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(s)) return { ok: false }; n = Number(s); if (!Number.isFinite(n)) return { ok: false }; }
  else return { ok: false };
  if (n < min || n > max) return { ok: false };
  return { ok: true, value: n };
}
function parseBool(raw, dflt) {
  if (raw === undefined || raw === null || raw === '') return { ok: true, value: dflt };
  if (typeof raw === 'boolean') return { ok: true, value: raw };
  if (raw === 1) return { ok: true, value: true };
  if (raw === 0) return { ok: true, value: false };
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].indexOf(s) !== -1) return { ok: true, value: true };
    if (['false', '0', 'no', 'off'].indexOf(s) !== -1) return { ok: true, value: false };
  }
  return { ok: false };
}
function validateNodeKey(raw) {
  if (typeof raw !== 'string') return { ok: false };
  const v = raw.trim().toLowerCase();
  if (v === '' || v.length > NODE_KEY_MAX) return { ok: false };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v)) return { ok: false };
  return { ok: true, value: v };
}

/* ---------- validators ---------- */

function validateRoute(body) {
  if (!isPlainObject(body)) return { ok: false, message: 'Request body must be a JSON object.' };
  const title = reqStr(body.title, ROUTE_TITLE_MAX);
  if (!title.ok) return { ok: false, message: 'Title is required and must be ' + ROUTE_TITLE_MAX + ' characters or fewer.' };
  const start = reqStr(body.start_label, ROUTE_START_MAX);
  if (!start.ok) return { ok: false, message: 'Start label is required and must be ' + ROUTE_START_MAX + ' characters or fewer.' };
  const dest = optId(body.destination_building_id);
  if (!dest.ok || dest.value === null) return { ok: false, message: 'A destination building is required.' };
  const walk = optStr(body.estimated_walk_time, ROUTE_WALKTIME_MAX);
  if (!walk.ok) return { ok: false, message: 'Estimated walk time must be ' + ROUTE_WALKTIME_MAX + ' characters or fewer.' };
  return { ok: true, value: { title: title.value, start_label: start.value, destination_building_id: dest.value, estimated_walk_time: walk.value } };
}

function validateSteps(body) {
  if (!isPlainObject(body)) return { ok: false, message: 'Request body must be a JSON object.' };
  const steps = body.steps;
  if (!Array.isArray(steps) || steps.length === 0) return { ok: false, message: 'At least one ordered step is required.' };
  if (steps.length > STEP_MAX_COUNT) return { ok: false, message: 'A route can have at most ' + STEP_MAX_COUNT + ' steps.' };
  const out = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (!isPlainObject(s)) return { ok: false, message: 'Each step must be a JSON object.' };
    const instruction = reqStr(s.instruction, STEP_INSTRUCTION_MAX);
    if (!instruction.ok) return { ok: false, message: 'Step ' + (i + 1) + ': instruction is required and must be ' + STEP_INSTRUCTION_MAX + ' characters or fewer.' };
    const landmark = optStr(s.landmark, STEP_LANDMARK_MAX);
    if (!landmark.ok) return { ok: false, message: 'Step ' + (i + 1) + ': landmark must be ' + STEP_LANDMARK_MAX + ' characters or fewer.' };
    const lat = parseDecimal(s.lat, LAT_MIN, LAT_MAX);
    if (!lat.ok) return { ok: false, message: 'Step ' + (i + 1) + ': latitude must be a number between ' + LAT_MIN + ' and ' + LAT_MAX + '.' };
    const lng = parseDecimal(s.lng, LNG_MIN, LNG_MAX);
    if (!lng.ok) return { ok: false, message: 'Step ' + (i + 1) + ': longitude must be a number between ' + LNG_MIN + ' and ' + LNG_MAX + '.' };
    // step_order, if supplied, must match the 1-based position (sequential, unique).
    if (Object.prototype.hasOwnProperty.call(s, 'step_order') && s.step_order !== undefined && s.step_order !== null && s.step_order !== '') {
      const so = parseId(s.step_order);
      if (so === null || so !== i + 1) return { ok: false, message: 'Step order must be sequential (1..N) and match each step\'s position.' };
    }
    out.push({ step_order: i + 1, instruction: instruction.value, landmark: landmark.value, lat: lat.value, lng: lng.value });
  }
  return { ok: true, value: out };
}

function validateNode(body) {
  if (!isPlainObject(body)) return { ok: false, message: 'Request body must be a JSON object.' };
  const key = validateNodeKey(body.node_key);
  if (!key.ok) return { ok: false, message: 'Node key must be a lowercase slug (letters, numbers, hyphens) up to ' + NODE_KEY_MAX + ' characters.' };
  const label = reqStr(body.label, NODE_LABEL_MAX);
  if (!label.ok) return { ok: false, message: 'Label is required and must be ' + NODE_LABEL_MAX + ' characters or fewer.' };
  const type = typeof body.node_type === 'string' ? body.node_type.trim().toLowerCase() : '';
  if (NODE_TYPES.indexOf(type) === -1) return { ok: false, message: 'Node type must be one of: ' + NODE_TYPES.join(', ') + '.' };
  const building = optId(body.building_id);
  if (!building.ok) return { ok: false, message: 'Building id must be a positive integer or empty.' };
  const lat = parseDecimal(body.lat, LAT_MIN, LAT_MAX);
  if (!lat.ok || lat.value === null) return { ok: false, message: 'Latitude is required and must be a number between ' + LAT_MIN + ' and ' + LAT_MAX + '.' };
  const lng = parseDecimal(body.lng, LNG_MIN, LNG_MAX);
  if (!lng.ok || lng.value === null) return { ok: false, message: 'Longitude is required and must be a number between ' + LNG_MIN + ' and ' + LNG_MAX + '.' };
  const order = parseOrder(body.display_order);
  if (!order.ok) return { ok: false, message: 'Display order must be a whole number between 0 and ' + ORDER_MAX + '.' };
  return { ok: true, value: { node_key: key.value, label: label.value, node_type: type, building_id: building.value, lat: lat.value, lng: lng.value, display_order: order.value } };
}

function validateEdge(body) {
  if (!isPlainObject(body)) return { ok: false, message: 'Request body must be a JSON object.' };
  const from = optId(body.from_node_id);
  if (!from.ok || from.value === null) return { ok: false, message: 'A valid from-node is required.' };
  const to = optId(body.to_node_id);
  if (!to.ok || to.value === null) return { ok: false, message: 'A valid to-node is required.' };
  if (from.value === to.value) return { ok: false, message: 'An edge cannot connect a node to itself.' };
  const dist = parsePosInt(body.distance_meters);
  if (!dist.ok) return { ok: false, message: 'Distance (meters) must be a positive whole number.' };
  const time = parsePosInt(body.walk_time_seconds);
  if (!time.ok) return { ok: false, message: 'Walk time (seconds) must be a positive whole number.' };
  const label = optStr(body.path_label, EDGE_PATHLABEL_MAX);
  if (!label.ok) return { ok: false, message: 'Path label must be ' + EDGE_PATHLABEL_MAX + ' characters or fewer.' };
  const access = parseBool(body.is_accessible, true);
  if (!access.ok) return { ok: false, message: 'Accessible must be true or false.' };
  return { ok: true, value: { from_node_id: from.value, to_node_id: to.value, distance_meters: dist.value, walk_time_seconds: time.value, path_label: label.value, is_accessible: access.value } };
}

/* ============================================================
   ROUTES
============================================================ */

exports.listRoutes = async (req, res) => {
  try {
    let routes;
    if (isSupabase()) {
      routes = await routeRepository.adminListRoutes();
    } else {
      const [rows] = await db.query(
        'SELECT r.' + ROUTE_COLS_SQL.split(', ').join(', r.') + ', b.name AS destination_name ' +
        'FROM campus_routes r LEFT JOIN buildings b ON b.id = r.destination_building_id ORDER BY r.title ASC'
      );
      routes = rows;
    }
    return res.status(200).json({ success: true, routes, total: routes.length });
  } catch (e) { return handleErr(res, e, 'listRoutes'); }
};

exports.getRoute = async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ success: false, message: 'Invalid route id.' });
  try {
    let route;
    if (isSupabase()) {
      route = await routeRepository.adminGetRoute(id);
    } else {
      const [rows] = await db.query('SELECT ' + ROUTE_COLS_SQL + ' FROM campus_routes WHERE id = ?', [id]);
      route = rows[0] || null;
    }
    if (!route) return res.status(404).json({ success: false, message: 'Route not found.' });
    return res.status(200).json({ success: true, route });
  } catch (e) { return handleErr(res, e, 'getRoute'); }
};

exports.createRoute = async (req, res) => {
  const v = validateRoute(req.body);
  if (!v.ok) return res.status(400).json({ success: false, message: v.message });
  try {
    let route;
    if (isSupabase()) {
      if ((await routeRepository.adminFindRouteIdByTitle(v.value.title)) !== null) throw new ApiError(409, 'A route with this title already exists.');
      if (!(await routeRepository.adminBuildingExists(v.value.destination_building_id))) throw new ApiError(404, 'Destination building not found.');
      route = await routeRepository.adminCreateRoute(v.value);
    } else {
      route = await withTx(async (conn) => {
        const [dup] = await conn.query('SELECT id FROM campus_routes WHERE title = ? LIMIT 1', [v.value.title]);
        if (dup.length) throw new ApiError(409, 'A route with this title already exists.');
        const [b] = await conn.query('SELECT id FROM buildings WHERE id = ? LIMIT 1', [v.value.destination_building_id]);
        if (!b.length) throw new ApiError(404, 'Destination building not found.');
        const [result] = await conn.query(
          'INSERT INTO campus_routes (title, start_label, destination_building_id, estimated_walk_time) VALUES (?, ?, ?, ?)',
          [v.value.title, v.value.start_label, v.value.destination_building_id, v.value.estimated_walk_time]
        );
        const [rows] = await conn.query('SELECT ' + ROUTE_COLS_SQL + ' FROM campus_routes WHERE id = ?', [result.insertId]);
        return rows[0];
      });
    }
    auditMut(req, 'admin.route.create', 'route', route && route.id, 'Admin created a campus route.');
    return res.status(201).json({ success: true, message: 'Route created successfully.', route });
  } catch (e) { return handleErr(res, e, 'createRoute'); }
};

exports.updateRoute = async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ success: false, message: 'Invalid route id.' });
  const v = validateRoute(req.body);
  if (!v.ok) return res.status(400).json({ success: false, message: v.message });
  try {
    let route;
    if (isSupabase()) {
      if (!(await routeRepository.adminRouteExists(id))) throw new ApiError(404, 'Route not found.');
      if ((await routeRepository.adminFindRouteIdByTitle(v.value.title, id)) !== null) throw new ApiError(409, 'A route with this title already exists.');
      if (!(await routeRepository.adminBuildingExists(v.value.destination_building_id))) throw new ApiError(404, 'Destination building not found.');
      route = await routeRepository.adminUpdateRoute(id, v.value);
      if (!route) throw new ApiError(404, 'Route not found.');
    } else {
      route = await withTx(async (conn) => {
        const [exist] = await conn.query('SELECT id FROM campus_routes WHERE id = ? LIMIT 1', [id]);
        if (!exist.length) throw new ApiError(404, 'Route not found.');
        const [dup] = await conn.query('SELECT id FROM campus_routes WHERE title = ? AND id <> ? LIMIT 1', [v.value.title, id]);
        if (dup.length) throw new ApiError(409, 'A route with this title already exists.');
        const [b] = await conn.query('SELECT id FROM buildings WHERE id = ? LIMIT 1', [v.value.destination_building_id]);
        if (!b.length) throw new ApiError(404, 'Destination building not found.');
        await conn.query(
          'UPDATE campus_routes SET title = ?, start_label = ?, destination_building_id = ?, estimated_walk_time = ?, updated_at = NOW() WHERE id = ?',
          [v.value.title, v.value.start_label, v.value.destination_building_id, v.value.estimated_walk_time, id]
        );
        const [rows] = await conn.query('SELECT ' + ROUTE_COLS_SQL + ' FROM campus_routes WHERE id = ?', [id]);
        return rows[0];
      });
    }
    auditMut(req, 'admin.route.update', 'route', id, 'Admin updated a campus route.');
    return res.status(200).json({ success: true, message: 'Route updated successfully.', route });
  } catch (e) { return handleErr(res, e, 'updateRoute'); }
};

exports.deleteRoute = async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ success: false, message: 'Invalid route id.' });
  try {
    if (isSupabase()) {
      if (!(await routeRepository.adminRouteExists(id))) throw new ApiError(404, 'Route not found.');
      const deleted = await routeRepository.adminDeleteRoute(id); // cascades its own steps only
      if (deleted === null) throw new ApiError(404, 'Route not found.');
    } else {
      await withTx(async (conn) => {
        const [exist] = await conn.query('SELECT id FROM campus_routes WHERE id = ? LIMIT 1', [id]);
        if (!exist.length) throw new ApiError(404, 'Route not found.');
        await conn.query('DELETE FROM campus_routes WHERE id = ?', [id]); // FK cascades steps
      });
    }
    auditMut(req, 'admin.route.delete', 'route', id, 'Admin deleted a campus route.');
    return res.status(200).json({ success: true, message: 'Route deleted successfully.' });
  } catch (e) { return handleErr(res, e, 'deleteRoute'); }
};

/* ---- steps ---- */

exports.listSteps = async (req, res) => {
  const routeId = parseId(req.params.routeId);
  if (routeId === null) return res.status(400).json({ success: false, message: 'Invalid route id.' });
  try {
    let steps;
    if (isSupabase()) {
      if (!(await routeRepository.adminRouteExists(routeId))) return res.status(404).json({ success: false, message: 'Route not found.' });
      steps = await routeRepository.adminListSteps(routeId);
    } else {
      const [r] = await db.query('SELECT id FROM campus_routes WHERE id = ? LIMIT 1', [routeId]);
      if (!r.length) return res.status(404).json({ success: false, message: 'Route not found.' });
      const [rows] = await db.query('SELECT ' + STEP_COLS_SQL + ' FROM campus_route_steps WHERE route_id = ? ORDER BY step_order ASC', [routeId]);
      steps = rows;
    }
    return res.status(200).json({ success: true, steps, total: steps.length });
  } catch (e) { return handleErr(res, e, 'listSteps'); }
};

exports.replaceSteps = async (req, res) => {
  const routeId = parseId(req.params.routeId);
  if (routeId === null) return res.status(400).json({ success: false, message: 'Invalid route id.' });
  const v = validateSteps(req.body);
  if (!v.ok) return res.status(400).json({ success: false, message: v.message });
  try {
    let steps;
    if (isSupabase()) {
      if (!(await routeRepository.adminRouteExists(routeId))) throw new ApiError(404, 'Route not found.');
      await routeRepository.adminReplaceSteps(routeId, v.value); // atomic RPC
      steps = await routeRepository.adminListSteps(routeId);
    } else {
      steps = await withTx(async (conn) => {
        const [r] = await conn.query('SELECT id FROM campus_routes WHERE id = ? LIMIT 1', [routeId]);
        if (!r.length) throw new ApiError(404, 'Route not found.');
        await conn.query('DELETE FROM campus_route_steps WHERE route_id = ?', [routeId]);
        for (const s of v.value) {
          await conn.query(
            'INSERT INTO campus_route_steps (route_id, step_order, instruction, landmark, lat, lng) VALUES (?, ?, ?, ?, ?, ?)',
            [routeId, s.step_order, s.instruction, s.landmark, s.lat, s.lng]
          );
        }
        const [rows] = await conn.query('SELECT ' + STEP_COLS_SQL + ' FROM campus_route_steps WHERE route_id = ? ORDER BY step_order ASC', [routeId]);
        return rows;
      });
    }
    auditMut(req, 'admin.route.steps.update', 'route_steps', routeId, 'Admin updated route steps.');
    return res.status(200).json({ success: true, message: 'Route steps updated successfully.', steps });
  } catch (e) { return handleErr(res, e, 'replaceSteps'); }
};

/* ============================================================
   NODES
============================================================ */

exports.listNodes = async (req, res) => {
  try {
    let nodes;
    if (isSupabase()) nodes = await routeRepository.adminListNodes();
    else { const [rows] = await db.query('SELECT ' + NODE_COLS_SQL + ' FROM route_nodes ORDER BY display_order ASC, id ASC'); nodes = rows; }
    return res.status(200).json({ success: true, nodes, total: nodes.length });
  } catch (e) { return handleErr(res, e, 'listNodes'); }
};

exports.getNode = async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ success: false, message: 'Invalid node id.' });
  try {
    let node;
    if (isSupabase()) node = await routeRepository.adminGetNode(id);
    else { const [rows] = await db.query('SELECT ' + NODE_COLS_SQL + ' FROM route_nodes WHERE id = ?', [id]); node = rows[0] || null; }
    if (!node) return res.status(404).json({ success: false, message: 'Node not found.' });
    return res.status(200).json({ success: true, node });
  } catch (e) { return handleErr(res, e, 'getNode'); }
};

exports.createNode = async (req, res) => {
  const v = validateNode(req.body);
  if (!v.ok) return res.status(400).json({ success: false, message: v.message });
  try {
    let node;
    if (isSupabase()) {
      if ((await routeRepository.adminFindNodeIdByKey(v.value.node_key)) !== null) throw new ApiError(409, 'A node with this node key already exists.');
      if (v.value.building_id !== null && !(await routeRepository.adminBuildingExists(v.value.building_id))) throw new ApiError(404, 'Building not found.');
      node = await routeRepository.adminCreateNode(v.value);
    } else {
      node = await withTx(async (conn) => {
        const [dup] = await conn.query('SELECT id FROM route_nodes WHERE node_key = ? LIMIT 1', [v.value.node_key]);
        if (dup.length) throw new ApiError(409, 'A node with this node key already exists.');
        if (v.value.building_id !== null) {
          const [b] = await conn.query('SELECT id FROM buildings WHERE id = ? LIMIT 1', [v.value.building_id]);
          if (!b.length) throw new ApiError(404, 'Building not found.');
        }
        const [result] = await conn.query(
          'INSERT INTO route_nodes (node_key, label, node_type, building_id, lat, lng, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [v.value.node_key, v.value.label, v.value.node_type, v.value.building_id, v.value.lat, v.value.lng, v.value.display_order]
        );
        const [rows] = await conn.query('SELECT ' + NODE_COLS_SQL + ' FROM route_nodes WHERE id = ?', [result.insertId]);
        return rows[0];
      });
    }
    auditMut(req, 'admin.route_node.create', 'route_node', node && node.id, 'Admin created a route node.');
    return res.status(201).json({ success: true, message: 'Node created successfully.', node });
  } catch (e) { return handleErr(res, e, 'createNode'); }
};

exports.updateNode = async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ success: false, message: 'Invalid node id.' });
  const v = validateNode(req.body);
  if (!v.ok) return res.status(400).json({ success: false, message: v.message });
  try {
    let node;
    if (isSupabase()) {
      const existingNode = await routeRepository.adminGetNode(id);
      if (!existingNode) throw new ApiError(404, 'Node not found.');
      if ((await routeRepository.adminFindNodeIdByKey(v.value.node_key, id)) !== null) throw new ApiError(409, 'A node with this node key already exists.');
      if (v.value.building_id !== null && !(await routeRepository.adminBuildingExists(v.value.building_id))) throw new ApiError(404, 'Building not found.');
      // RF.4 node-move guard: reject a coordinate change while attached
      // geometry exists (metadata-only edits are allowed). The 0016 RPC is
      // the atomic backstop (raises NODE_GEOMETRY_ATTACHED -> 409).
      if (coordsChanged(existingNode.lat, existingNode.lng, v.value.lat, v.value.lng) &&
          await routeRepository.adminNodeHasAttachedGeometry(id)) {
        throw new ApiError(409, NODE_GEOMETRY_MSG);
      }
      node = await routeRepository.adminUpdateNode(id, v.value);
      if (!node) throw new ApiError(404, 'Node not found.');
    } else {
      node = await withTx(async (conn) => {
        const [exist] = await conn.query('SELECT id, lat, lng FROM route_nodes WHERE id = ? LIMIT 1', [id]);
        if (!exist.length) throw new ApiError(404, 'Node not found.');
        const [dup] = await conn.query('SELECT id FROM route_nodes WHERE node_key = ? AND id <> ? LIMIT 1', [v.value.node_key, id]);
        if (dup.length) throw new ApiError(409, 'A node with this node key already exists.');
        if (v.value.building_id !== null) {
          const [b] = await conn.query('SELECT id FROM buildings WHERE id = ? LIMIT 1', [v.value.building_id]);
          if (!b.length) throw new ApiError(404, 'Building not found.');
        }
        // RF.4 node-move guard (metadata-only edits allowed): a coordinate
        // change is rejected 409 while any attached edge stores geometry.
        if (coordsChanged(exist[0].lat, exist[0].lng, v.value.lat, v.value.lng)) {
          const [geo] = await conn.query(
            'SELECT id FROM route_edges WHERE (from_node_id = ? OR to_node_id = ?) AND path_geometry IS NOT NULL LIMIT 1', [id, id]);
          if (geo.length) throw new ApiError(409, NODE_GEOMETRY_MSG);
        }
        await conn.query(
          'UPDATE route_nodes SET node_key = ?, label = ?, node_type = ?, building_id = ?, lat = ?, lng = ?, display_order = ?, updated_at = NOW() WHERE id = ?',
          [v.value.node_key, v.value.label, v.value.node_type, v.value.building_id, v.value.lat, v.value.lng, v.value.display_order, id]
        );
        const [rows] = await conn.query('SELECT ' + NODE_COLS_SQL + ' FROM route_nodes WHERE id = ?', [id]);
        return rows[0];
      });
    }
    auditMut(req, 'admin.route_node.update', 'route_node', id, 'Admin updated a route node.');
    return res.status(200).json({ success: true, message: 'Node updated successfully.', node });
  } catch (e) { return handleErr(res, e, 'updateNode'); }
};

exports.deleteNode = async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ success: false, message: 'Invalid node id.' });
  const BLOCKED = 'This node is referenced by one or more edges or VR scenes. Remove those edges/scene links before deleting this node.';
  try {
    if (isSupabase()) {
      if (!(await routeRepository.adminNodeExists(id))) throw new ApiError(404, 'Node not found.');
      const refs = await routeRepository.adminNodeReferences(id);
      if (refs.edges > 0 || refs.scenes > 0) throw new ApiError(409, BLOCKED);
      const deleted = await routeRepository.adminDeleteNode(id); // RPC: atomic re-check + delete
      if (deleted === null) throw new ApiError(404, 'Node not found.');
    } else {
      await withTx(async (conn) => {
        const [exist] = await conn.query('SELECT id FROM route_nodes WHERE id = ? LIMIT 1', [id]);
        if (!exist.length) throw new ApiError(404, 'Node not found.');
        const [edges] = await conn.query('SELECT id FROM route_edges WHERE from_node_id = ? OR to_node_id = ? LIMIT 1', [id, id]);
        if (edges.length) throw new ApiError(409, BLOCKED);
        const [scenes] = await conn.query('SELECT id FROM vr_scenes WHERE node_id = ? LIMIT 1', [id]);
        if (scenes.length) throw new ApiError(409, BLOCKED);
        await conn.query('DELETE FROM route_nodes WHERE id = ?', [id]);
      });
    }
    auditMut(req, 'admin.route_node.delete', 'route_node', id, 'Admin deleted a route node.');
    return res.status(200).json({ success: true, message: 'Node deleted successfully.' });
  } catch (e) { return handleErr(res, e, 'deleteNode'); }
};

/* ============================================================
   EDGES
============================================================ */

exports.listEdges = async (req, res) => {
  try {
    let edges;
    if (isSupabase()) edges = await routeRepository.adminListEdges();
    else { const [rows] = await db.query(EDGE_SELECT_SQL + ' ORDER BY e.from_node_id ASC, e.to_node_id ASC'); edges = rows; }
    return res.status(200).json({ success: true, edges, total: edges.length });
  } catch (e) { return handleErr(res, e, 'listEdges'); }
};

exports.getEdge = async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ success: false, message: 'Invalid edge id.' });
  try {
    // RF.4: single-edge GET now carries path_geometry + endpoint node
    // coordinates for the geometry editor. LIST endpoints stay geometry-free.
    let row;
    if (isSupabase()) row = await routeRepository.adminGetEdgeWithGeometry(id);
    else { const [rows] = await db.query(EDGE_GEOMETRY_SELECT_SQL + ' WHERE e.id = ?', [id]); row = rows[0] || null; }
    if (!row) return res.status(404).json({ success: false, message: 'Edge not found.' });
    return res.status(200).json({ success: true, edge: shapeEditorEdge(row) });
  } catch (e) { return handleErr(res, e, 'getEdge'); }
};

/* RF.4: PUT /admin/api/route-edges/:id/geometry
   Strict allowlist { path_geometry }. null clears BOTH directed rows; a
   non-null value validates against the current from/to nodes (2-200 points,
   ranged lat/lng, exact keys, endpoint epsilon, snapEndpoints) and writes the
   forward + exact-reversed geometry to both rows atomically (MySQL tx locking
   both edges + endpoint nodes; Supabase one service-role RPC). Missing edge
   404; missing reverse 409; invalid 400; unexpected sanitized 500. Never
   returns or logs raw geometry. */
exports.updateEdgeGeometry = async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ success: false, message: 'Invalid edge id.' });
  if (!isPlainObject(req.body)) return res.status(400).json({ success: false, message: 'Request body must be a JSON object.' });
  const keys = Object.keys(req.body);
  if (keys.indexOf('path_geometry') === -1) return res.status(400).json({ success: false, message: 'path_geometry is required.' });
  if (keys.length !== 1) return res.status(400).json({ success: false, message: 'Only path_geometry may be provided.' });
  const rawGeom = req.body.path_geometry;
  const clearing = rawGeom === null;
  if (!clearing && !Array.isArray(rawGeom)) {
    return res.status(400).json({ success: false, message: 'path_geometry must be an array of points or null.' });
  }

  try {
    if (isSupabase()) {
      const edge = await routeRepository.adminGetEdgeWithGeometry(id);
      if (!edge) throw new ApiError(404, 'Edge not found.');
      let payload = null;
      if (!clearing) {
        const v = validatePathGeometry(rawGeom, {
          fromNode: { lat: edge.from_lat, lng: edge.from_lng },
          toNode: { lat: edge.to_lat, lng: edge.to_lng },
          allowNull: false, snapEndpoints: true
        });
        if (!v.ok) throw new ApiError(400, v.message);
        payload = v.value;
      }
      // One service-role RPC updates forward + exact reverse (or clears both).
      // Raises EDGE_PAIR_NOT_FOUND -> 409 when the reverse row is missing.
      await routeRepository.adminSetEdgeGeometryPair(edge.from_node_id, edge.to_node_id, payload);
    } else {
      await withTx(async (conn) => {
        const [sel] = await conn.query(
          'SELECT id, from_node_id, to_node_id FROM route_edges WHERE id = ? FOR UPDATE', [id]);
        if (!sel.length) throw new ApiError(404, 'Edge not found.');
        const fromId = sel[0].from_node_id, toId = sel[0].to_node_id;
        const [rev] = await conn.query(
          'SELECT id FROM route_edges WHERE from_node_id = ? AND to_node_id = ? FOR UPDATE', [toId, fromId]);
        if (!rev.length) throw new ApiError(409, 'The reverse direction of this edge is missing. Both directions must exist to store geometry.');
        const revId = rev[0].id;
        const [nodes] = await conn.query(
          'SELECT id, lat, lng FROM route_nodes WHERE id IN (?, ?) FOR UPDATE', [fromId, toId]);
        const byId = new Map(nodes.map((n) => [n.id, n]));
        const fromNode = byId.get(fromId), toNode = byId.get(toId);
        if (!fromNode || !toNode) throw new ApiError(404, 'Edge endpoint node not found.');
        let forwardJson = null, reverseJson = null;
        if (!clearing) {
          const v = validatePathGeometry(rawGeom, {
            fromNode: { lat: Number(fromNode.lat), lng: Number(fromNode.lng) },
            toNode: { lat: Number(toNode.lat), lng: Number(toNode.lng) },
            allowNull: false, snapEndpoints: true
          });
          if (!v.ok) throw new ApiError(400, v.message);
          forwardJson = JSON.stringify(v.value);
          reverseJson = JSON.stringify(reversePathGeometry(v.value));
        }
        // Both writes in one transaction: no partial pair update.
        await conn.query('UPDATE route_edges SET path_geometry = ? WHERE id = ?', [forwardJson, id]);
        await conn.query('UPDATE route_edges SET path_geometry = ? WHERE id = ?', [reverseJson, revId]);
      });
    }
    auditMut(req, clearing ? 'admin.route_edge.geometry.clear' : 'admin.route_edge.geometry.update',
      'route_edge', id, clearing ? 'Admin cleared route edge geometry.' : 'Admin updated route edge geometry.');
    return res.status(200).json({ success: true, message: clearing ? 'Edge geometry cleared.' : 'Edge geometry saved.' });
  } catch (e) { return handleErr(res, e, 'updateEdgeGeometry'); }
};

exports.createEdge = async (req, res) => {
  const v = validateEdge(req.body);
  if (!v.ok) return res.status(400).json({ success: false, message: v.message });
  try {
    let edge;
    if (isSupabase()) {
      if (!(await routeRepository.adminNodeExists(v.value.from_node_id))) throw new ApiError(404, 'From-node not found.');
      if (!(await routeRepository.adminNodeExists(v.value.to_node_id))) throw new ApiError(404, 'To-node not found.');
      if ((await routeRepository.adminFindEdgeIdByPair(v.value.from_node_id, v.value.to_node_id)) !== null) throw new ApiError(409, 'A directed edge between these nodes already exists.');
      edge = await routeRepository.adminCreateEdge(v.value);
    } else {
      edge = await withTx(async (conn) => {
        const [f] = await conn.query('SELECT id FROM route_nodes WHERE id = ? LIMIT 1', [v.value.from_node_id]);
        if (!f.length) throw new ApiError(404, 'From-node not found.');
        const [t] = await conn.query('SELECT id FROM route_nodes WHERE id = ? LIMIT 1', [v.value.to_node_id]);
        if (!t.length) throw new ApiError(404, 'To-node not found.');
        const [dup] = await conn.query('SELECT id FROM route_edges WHERE from_node_id = ? AND to_node_id = ? LIMIT 1', [v.value.from_node_id, v.value.to_node_id]);
        if (dup.length) throw new ApiError(409, 'A directed edge between these nodes already exists.');
        const [result] = await conn.query(
          'INSERT INTO route_edges (from_node_id, to_node_id, distance_meters, walk_time_seconds, path_label, is_accessible) VALUES (?, ?, ?, ?, ?, ?)',
          [v.value.from_node_id, v.value.to_node_id, v.value.distance_meters, v.value.walk_time_seconds, v.value.path_label, v.value.is_accessible ? 1 : 0]
        );
        const [rows] = await conn.query(EDGE_SELECT_SQL + ' WHERE e.id = ?', [result.insertId]);
        return rows[0];
      });
    }
    auditMut(req, 'admin.route_edge.create', 'route_edge', edge && edge.id, 'Admin created a route edge.');
    return res.status(201).json({ success: true, message: 'Edge created successfully.', edge });
  } catch (e) { return handleErr(res, e, 'createEdge'); }
};

exports.updateEdge = async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ success: false, message: 'Invalid edge id.' });
  const v = validateEdge(req.body);
  if (!v.ok) return res.status(400).json({ success: false, message: v.message });
  try {
    let edge;
    if (isSupabase()) {
      // RF.4 repair (Finding 1): endpoints are immutable. Compare against the
      // current stored edge BEFORE any update; scalar-only changes proceed.
      const existing = await routeRepository.adminGetEdge(id);
      if (!existing) throw new ApiError(404, 'Edge not found.');
      if (Number(existing.from_node_id) !== v.value.from_node_id ||
          Number(existing.to_node_id) !== v.value.to_node_id) {
        throw new ApiError(409, EDGE_ENDPOINTS_IMMUTABLE_MSG);
      }
      edge = await routeRepository.adminUpdateEdge(id, v.value);
      if (!edge) throw new ApiError(404, 'Edge not found.');
    } else {
      edge = await withTx(async (conn) => {
        // RF.4 repair (Finding 1): compare endpoints while the selected edge
        // is locked, then update scalars only (endpoints are unchanged).
        const [exist] = await conn.query('SELECT id, from_node_id, to_node_id FROM route_edges WHERE id = ? FOR UPDATE', [id]);
        if (!exist.length) throw new ApiError(404, 'Edge not found.');
        if (Number(exist[0].from_node_id) !== v.value.from_node_id ||
            Number(exist[0].to_node_id) !== v.value.to_node_id) {
          throw new ApiError(409, EDGE_ENDPOINTS_IMMUTABLE_MSG);
        }
        await conn.query(
          'UPDATE route_edges SET distance_meters = ?, walk_time_seconds = ?, path_label = ?, is_accessible = ? WHERE id = ?',
          [v.value.distance_meters, v.value.walk_time_seconds, v.value.path_label, v.value.is_accessible ? 1 : 0, id]
        );
        const [rows] = await conn.query(EDGE_SELECT_SQL + ' WHERE e.id = ?', [id]);
        return rows[0];
      });
    }
    auditMut(req, 'admin.route_edge.update', 'route_edge', id, 'Admin updated a route edge.');
    return res.status(200).json({ success: true, message: 'Edge updated successfully.', edge });
  } catch (e) { return handleErr(res, e, 'updateEdge'); }
};

exports.deleteEdge = async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ success: false, message: 'Invalid edge id.' });
  try {
    if (isSupabase()) {
      const deleted = await routeRepository.adminDeleteEdge(id);
      if (deleted === null) throw new ApiError(404, 'Edge not found.');
    } else {
      await withTx(async (conn) => {
        const [exist] = await conn.query('SELECT id FROM route_edges WHERE id = ? LIMIT 1', [id]);
        if (!exist.length) throw new ApiError(404, 'Edge not found.');
        await conn.query('DELETE FROM route_edges WHERE id = ?', [id]);
      });
    }
    auditMut(req, 'admin.route_edge.delete', 'route_edge', id, 'Admin deleted a route edge.');
    return res.status(200).json({ success: true, message: 'Edge deleted successfully.' });
  } catch (e) { return handleErr(res, e, 'deleteEdge'); }
};
