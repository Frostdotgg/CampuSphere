'use strict';

/* ========================================
   CampuSphere — Route edge drawing geometry (Pre-Milestone-12 RF.2)

   Single server-side source of truth for the route_edges.path_geometry
   contract defined in RF.1 and plan.md:

     - an ordered JSON array of { lat, lng } points running from the
       directed edge's FROM node to its TO node;
     - 2-200 points, finite numbers, lat in [-90, 90], lng in [-180, 180];
     - each point is a plain object with EXACTLY the lat and lng keys;
     - the first/last points match the edge endpoint node coordinates
       within ENDPOINT_EPSILON (1e-6 degrees) and, when snapEndpoints is
       set, are normalized to the exact stored node values;
     - the reverse directed edge stores the exact reversed sequence.

   The geometry is authoritative ONLY for drawing the selected route;
   the graph (route_nodes / route_edges scalars) stays authoritative for
   route selection, distance, walk time, accessibility, and steps.

   Boundary: pure + server-only. No DB, no req/res, no network, no
   logging. Validation failures return FIXED sanitized messages and never
   echo the submitted geometry. Output arrays/points are freshly cloned;
   caller data is never mutated.
   ======================================== */

const MAX_PATH_GEOMETRY_POINTS = 200;
const MIN_PATH_GEOMETRY_POINTS = 2;
const ENDPOINT_EPSILON = 1e-6;

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function toFiniteNumber(v) {
  if (typeof v !== 'number') return null;
  return Number.isFinite(v) ? v : null;
}

// Coerce a node-like object ({ lat, lng } — numbers or DECIMAL strings from
// mysql2) into finite, IN-RANGE numeric coordinates, or null when unavailable.
// null/undefined/empty coordinates are UNAVAILABLE, never (0,0): Number(null)
// is 0, and silently snapping an edge to latitude/longitude zero would draw
// exactly the kind of wrong line this contract exists to prevent.
// Out-of-range values (lat outside [-90,90] or lng outside [-180,180]) are
// treated as unavailable too, so assembleRouteGeometry falls back to its safe
// incomplete state instead of exposing an impossible coordinate through
// route.geometry. The exact limits -90, 90, -180, 180 remain valid.
function nodePoint(node) {
  if (!isPlainObject(node)) return null;
  if (node.lat === null || node.lat === undefined || node.lat === '' ||
      node.lng === null || node.lng === undefined || node.lng === '') {
    return null;
  }
  const lat = Number(node.lat);
  const lng = Number(node.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * Validate (and optionally endpoint-snap) a stored/submitted path geometry.
 *
 * @param {*} value                 candidate geometry (parsed value, not a JSON string)
 * @param {Object}  [opts]
 * @param {Object}  [opts.fromNode]      { lat, lng } of the directed edge's from node
 * @param {Object}  [opts.toNode]        { lat, lng } of the directed edge's to node
 * @param {boolean} [opts.allowNull]     accept null/undefined as { ok:true, value:null }
 * @param {boolean} [opts.snapEndpoints] normalize accepted first/last points to the
 *                                       exact node coordinate values
 * @returns { ok:true, value:[{lat,lng},...]|null } or { ok:false, message } with a
 *          fixed sanitized message. Never throws on bad shapes; never logs.
 */
function validatePathGeometry(value, opts) {
  const o = opts || {};
  const allowNull = o.allowNull === true;
  const snapEndpoints = o.snapEndpoints === true;

  if (value === null || value === undefined) {
    if (allowNull) return { ok: true, value: null };
    return { ok: false, message: 'Path geometry is required.' };
  }
  if (!Array.isArray(value)) {
    return { ok: false, message: 'Path geometry must be an ordered array of points.' };
  }
  if (value.length < MIN_PATH_GEOMETRY_POINTS || value.length > MAX_PATH_GEOMETRY_POINTS) {
    return {
      ok: false,
      message: `Path geometry must contain between ${MIN_PATH_GEOMETRY_POINTS} and ${MAX_PATH_GEOMETRY_POINTS} points.`
    };
  }

  const out = [];
  for (const p of value) {
    if (!isPlainObject(p)) {
      return { ok: false, message: 'Each path point must be an object with lat and lng.' };
    }
    const keys = Object.keys(p);
    if (keys.length !== 2 ||
        !Object.prototype.hasOwnProperty.call(p, 'lat') ||
        !Object.prototype.hasOwnProperty.call(p, 'lng')) {
      return { ok: false, message: 'Each path point must have exactly the lat and lng keys.' };
    }
    const lat = toFiniteNumber(p.lat);
    const lng = toFiniteNumber(p.lng);
    if (lat === null || lng === null) {
      return { ok: false, message: 'Path point coordinates must be finite numbers.' };
    }
    if (lat < -90 || lat > 90) {
      return { ok: false, message: 'Path point latitude must be between -90 and 90.' };
    }
    if (lng < -180 || lng > 180) {
      return { ok: false, message: 'Path point longitude must be between -180 and 180.' };
    }
    out.push({ lat, lng });
  }

  const from = o.fromNode !== undefined && o.fromNode !== null ? nodePoint(o.fromNode) : undefined;
  const to = o.toNode !== undefined && o.toNode !== null ? nodePoint(o.toNode) : undefined;
  if (o.fromNode !== undefined && o.fromNode !== null && from === null) {
    return { ok: false, message: 'Edge endpoint coordinates are unavailable.' };
  }
  if (o.toNode !== undefined && o.toNode !== null && to === null) {
    return { ok: false, message: 'Edge endpoint coordinates are unavailable.' };
  }

  if (from) {
    const first = out[0];
    if (Math.abs(first.lat - from.lat) > ENDPOINT_EPSILON ||
        Math.abs(first.lng - from.lng) > ENDPOINT_EPSILON) {
      return { ok: false, message: 'The first path point must match the from-node coordinates.' };
    }
    if (snapEndpoints) out[0] = { lat: from.lat, lng: from.lng };
  }
  if (to) {
    const last = out[out.length - 1];
    if (Math.abs(last.lat - to.lat) > ENDPOINT_EPSILON ||
        Math.abs(last.lng - to.lng) > ENDPOINT_EPSILON) {
      return { ok: false, message: 'The last path point must match the to-node coordinates.' };
    }
    if (snapEndpoints) out[out.length - 1] = { lat: to.lat, lng: to.lng };
  }

  return { ok: true, value: out };
}

/**
 * Exact reversed point sequence for the reverse directed edge. Returns a new
 * array of new point objects; never mutates the input.
 */
function reversePathGeometry(points) {
  if (!Array.isArray(points)) return [];
  const out = [];
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i] || {};
    out.push({ lat: Number(p.lat), lng: Number(p.lng) });
  }
  return out;
}

/**
 * Seed-side builder: exact from-node coordinate + intermediate waypoints +
 * exact to-node coordinate, all cloned/coerced to plain numeric points.
 * Callers still run validatePathGeometry on the result before persisting.
 */
function buildPathGeometry(fromNode, waypoints, toNode) {
  const from = nodePoint(fromNode);
  const to = nodePoint(toNode);
  const mid = Array.isArray(waypoints)
    ? waypoints.map((p) => ({ lat: Number(p && p.lat), lng: Number(p && p.lng) }))
    : [];
  const head = from ? [{ lat: from.lat, lng: from.lng }] : [];
  const tail = to ? [{ lat: to.lat, lng: to.lng }] : [];
  return head.concat(mid, tail);
}

/**
 * RF.3: normalize a STORED path_geometry value into a fixed tri-state.
 * Accepts MySQL JSON strings or pre-parsed arrays (mysql2 parses JSON
 * columns) and Supabase parsed jsonb arrays.
 *
 *   null / undefined     -> { state: 'missing', value: null }
 *   unparseable/non-array -> { state: 'invalid', value: null }
 *   array                 -> { state: 'present', value: <parsed array> }
 *
 * The 'present' value is NOT yet contract-checked; callers validate it per
 * edge (with endpoints) via validatePathGeometry. Never throws; never logs.
 */
function normalizeStoredPathGeometry(raw) {
  if (raw === null || raw === undefined) return { state: 'missing', value: null };
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch (e) { return { state: 'invalid', value: null }; }
  }
  if (!Array.isArray(parsed)) return { state: 'invalid', value: null };
  return { state: 'present', value: parsed };
}

function samePoint(a, b) {
  return Math.abs(a.lat - b.lat) <= ENDPOINT_EPSILON &&
         Math.abs(a.lng - b.lng) <= ENDPOINT_EPSILON;
}

/**
 * RF.3: assemble the flattened drawing geometry for a SELECTED route.
 *
 * @param {Object} input
 * @param {Array}  input.nodes             ordered path node objects
 *                                         ({ key, lat, lng, ... }) exactly as
 *                                         returned by findShortestPath
 * @param {Array}  input.segments          ordered traversal segments
 *                                         ({ from, to, ... }) from the same
 *                                         result — geometry NEVER reorders them
 * @param {Map}    input.edgeGeometryByKey Map('fromKey|toKey' -> raw stored
 *                                         path_geometry value)
 *
 * Behavior (RF.1 contract + Codex RF.1 decisions):
 *   - each selected edge's stored geometry is normalized then validated
 *     against that edge's from/to nodes with endpoint snapping;
 *   - missing geometry falls back to the edge's two exact node endpoints
 *     (counted in fallbackEdges, no diagnostic expected);
 *   - malformed / endpoint-invalid geometry also falls back (counted in
 *     invalidEdges; the CALLER logs one fixed sanitized diagnostic);
 *   - shared consecutive endpoints are de-duplicated;
 *   - start-equals-destination returns exactly one coordinate;
 *   - if safe assembly is impossible because node coordinates are
 *     unavailable, returns an empty geometry with incomplete=true so the
 *     caller can keep the successful route contract and log once.
 *
 * Pure: no DB, no logging, no mutation of caller data.
 * @returns { geometry:[{lat,lng},...], fallbackEdges, invalidEdges, incomplete }
 */
function assembleRouteGeometry(input) {
  const nodes = Array.isArray(input && input.nodes) ? input.nodes : [];
  const segments = Array.isArray(input && input.segments) ? input.segments : [];
  const byKey = (input && input.edgeGeometryByKey instanceof Map)
    ? input.edgeGeometryByKey
    : new Map();

  const nodeByKey = new Map();
  for (const n of nodes) {
    if (n && n.key != null) nodeByKey.set(String(n.key), n);
  }

  const result = { geometry: [], fallbackEdges: 0, invalidEdges: 0, incomplete: false };

  // Trivial route: start equals destination -> one coordinate.
  if (segments.length === 0) {
    const only = nodes.length > 0 ? nodePoint(nodes[0]) : null;
    if (only) result.geometry.push({ lat: only.lat, lng: only.lng });
    else if (nodes.length > 0) result.incomplete = true;
    return result;
  }

  const appendPoints = (points) => {
    for (const p of points) {
      const last = result.geometry[result.geometry.length - 1];
      if (last && samePoint(last, p)) continue; // de-duplicate shared endpoints
      result.geometry.push({ lat: p.lat, lng: p.lng });
    }
  };

  for (const seg of segments) {
    const from = nodePoint(nodeByKey.get(String(seg && seg.from)));
    const to = nodePoint(nodeByKey.get(String(seg && seg.to)));
    if (!from || !to) {
      // Safe assembly impossible: an endpoint node has no usable coordinates.
      return { geometry: [], fallbackEdges: 0, invalidEdges: 0, incomplete: true };
    }

    const raw = byKey.get(String(seg.from) + '|' + String(seg.to));
    const normalized = normalizeStoredPathGeometry(raw);
    let points = null;
    if (normalized.state === 'present') {
      const v = validatePathGeometry(normalized.value, {
        fromNode: from, toNode: to, allowNull: false, snapEndpoints: true
      });
      if (v.ok) points = v.value;
      else result.invalidEdges += 1;
    } else if (normalized.state === 'invalid') {
      result.invalidEdges += 1;
    } else {
      result.fallbackEdges += 1;
    }
    if (!points) {
      points = [{ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }];
    }
    appendPoints(points);
  }

  return result;
}

module.exports = {
  MAX_PATH_GEOMETRY_POINTS,
  MIN_PATH_GEOMETRY_POINTS,
  ENDPOINT_EPSILON,
  validatePathGeometry,
  reversePathGeometry,
  buildPathGeometry,
  normalizeStoredPathGeometry,
  assembleRouteGeometry
};
