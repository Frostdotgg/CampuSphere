'use strict';

/* ========================================
   CampuSphere — Route Availability Service (BE.3)

   ONE shared server-side answer to "can this building actually be used as a
   navigation destination right now?", consumed by every public and admin
   surface so they can never disagree.

   WHY THIS EXISTS
   ---------------
   Admins can create a building before its route node exists (building CREATE
   does not create a route node). Such a building is legitimate campus
   information, but it is NOT a usable destination: /api/pathfind answers 404
   ("no route node maps to building id N"). Before BE.3 the public map still
   offered "Set as Destination" for it, so the user's only feedback was a failed
   request. This service computes availability ONCE, server-side, and every
   surface renders the same truth.

   BACKEND INDEPENDENCE (the subtle part)
   --------------------------------------
   BUILDING_DATA_SOURCE and ROUTE_DATA_SOURCE are INDEPENDENT switches. The
   building rows may come from one backend while the route graph comes from the
   other, and their numeric ids are NOT interchangeable (e.g. the College of Arts
   and Sciences is id 154 in MySQL and id 3 in Supabase). So:

     * the route graph, the route-source building roster, and the campus_routes
       VR decoration are ALL read from ROUTE_DATA_SOURCE;
     * building rows are read from BUILDING_DATA_SOURCE by the caller;
     * the two are joined by NORMALIZED CANONICAL NAME — never by numeric id.

   `route_destination_id` is therefore the ROUTE-SOURCE building id (the id
   /api/pathfind expects), which may legitimately differ from the building row's
   own id.

   AVAILABILITY CONTRACT
   ---------------------
   A building is available ONLY when all of the following hold:
     1. it has a route-source destination node (the exact configured natural
        node key for an active Guided-VR destination; otherwise the generic
        building-node mapping);
     2. that node is reachable from `main-gate`;
     3. the path has finite, ordered nodes;
     4. it assembles complete, valid road geometry.

   Exit availability is an additive companion contract. It evaluates the
   directed path from the building's natural node back to `main-gate`, and is
   true only when that path is reachable, drawable, and not merely the exact
   reverse of the entry geometry. This keeps legacy mirrored pairs safe while
   allowing an admin to publish a separately drawn exit route.

   Reasons (fixed, sanitized — never a graph payload or a backend error):
     null                     available
     'not_mapped'             no route node maps to this building
     'unreachable'            node exists but no path from main-gate
     'invalid_geometry'       path found, but the drawing geometry is unusable
     'route_data_unavailable' the route source itself failed (FAIL CLOSED)
     'exit_not_drawn'          exit path still relies on missing edge geometry
     'same_as_entry'          exit geometry is only the mirrored entry path

   On a route-source failure every building is marked unavailable with
   'route_data_unavailable'. Failing OPEN here would re-offer a destination
   action that cannot work.

   Geometry note: a MISSING stored geometry on an edge is not a defect — RF.3/RF.5
   deliberately fall back to that edge's two node endpoints, and the route still
   draws. Only MALFORMED/endpoint-invalid geometry (invalidEdges) or an
   un-assemblable path (incomplete) makes a building 'invalid_geometry'. The
   exit companion is stricter: every selected exit edge must have explicitly
   stored valid geometry, otherwise it remains 'exit_not_drawn' rather than
   publishing an inferred straight-line exit.

   Boundary: server-only. Reads config/db (MySQL) and repositories/routeRepository
   (Supabase). No req/res, no session, no rendering, no mutation. Never throws to
   the caller; never logs a raw backend error.
   ======================================== */

const db = require('../config/db');
const mapRuntime = require('../config/mapRuntime');
const routeRepository = require('../repositories/routeRepository');
const buildingRepository = require('../repositories/buildingRepository');
const { createSingleFlight } = require('../utils/singleFlight');
const { findShortestPath } = require('../utils/pathfinding');
const {
  assembleRouteGeometry,
  normalizeStoredPathGeometry,
  isReversePathGeometry
} = require('../utils/routeGeometry');
const {
  GUIDED_VR_ROUTES,
  DEFERRED_GUIDED_VR_DESTINATIONS
} = require('../config/guidedVrRoutes');
const { resolveGuidedDestinationPolicyByName } = require('./guidedVrResolution');

const START_NODE_KEY = 'main-gate';

const REASON = Object.freeze({
  NOT_MAPPED: 'not_mapped',
  UNREACHABLE: 'unreachable',
  INVALID_GEOMETRY: 'invalid_geometry',
  EXIT_NOT_DRAWN: 'exit_not_drawn',
  SAME_AS_ENTRY: 'same_as_entry',
  AMBIGUOUS_NAME: 'ambiguous_name',
  ROUTE_DATA_UNAVAILABLE: 'route_data_unavailable'
});

// Canonical join key. Case/punctuation-insensitive so "College of Computer
// Studies (CCS)" matches across backends regardless of id.
function canonicalKey(name) {
  return String(name == null ? '' : name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function toNumOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// The fixed shape every building carries after decoration.
function unavailable(reason) {
  return {
    route_available: false,
    route_destination_id: null,
    route_unavailable_reason: reason,
    exit_route_available: false,
    exit_route_unavailable_reason: reason,
    vr_route_id: null
  };
}

/* ---------------------------------------------------------------------------
   Load the route graph + route-source building roster + VR route decoration,
   ALL from ROUTE_DATA_SOURCE. One read per request.
--------------------------------------------------------------------------- */
async function loadRouteSource() {
  if (mapRuntime.isRouteSupabase()) {
    // When both graph and building data use Supabase, share the active
    // building-roster read with loadBuildingSourceRoster(). Mixed-source
    // deployments keep the route backend's own roster independent.
    const routeBuildings = mapRuntime.isBuildingSupabase()
      ? buildingRepository.listAll().then((rows) => (rows || []).map((b) => ({
        id: toNumOrNull(b.id),
        name: b.name
      })))
      : routeRepository.listRouteSourceBuildings();
    const [nodes, edges, buildings, vrByBuildingId] = await Promise.all([
      routeRepository.listAllNodes(),
      routeRepository.listAllEdgesWithGeometry(),
      routeBuildings,
      routeRepository.listVrRouteIdByBuilding()
    ]);
    return { nodes, edges, buildings, vrByBuildingId };
  }

  // ORDER BY id ASC on every read so ONE snapshot is deterministic and matches
  // the ordering the Supabase repositories already guarantee. Callers that share
  // this snapshot for both availability and route generation then see identical
  // node/edge sequences on either backend.
  const [[nodes], [edges], [buildings], [routes]] = await Promise.all([
    db.query('SELECT id, node_key, label, node_type, building_id, lat, lng FROM route_nodes ORDER BY id ASC'),
    db.query(
      `SELECT from_node_id, to_node_id, distance_meters, walk_time_seconds,
              path_label, is_accessible, path_geometry
         FROM route_edges ORDER BY id ASC`
    ),
    db.query('SELECT id, name FROM buildings ORDER BY id ASC'),
    db.query('SELECT id, destination_building_id FROM campus_routes ORDER BY id ASC')
  ]);

  // Lowest route id wins when several routes target the same building — the same
  // rule routeRepository.listVrRouteIdByBuilding() applies on Supabase.
  const vrByBuildingId = new Map();
  for (const r of routes) {
    const bid = toNumOrNull(r.destination_building_id);
    if (bid == null) continue;
    if (!vrByBuildingId.has(bid)) vrByBuildingId.set(bid, toNumOrNull(r.id));
  }
  return { nodes, edges, buildings, vrByBuildingId };
}

/* ---------------------------------------------------------------------------
   The COMPLETE active building-source roster (id + name only).

   Duplicate detection must consider the whole roster, not just the rows a caller
   happens to pass in: decorateBuildings() is called with subsets (search hits, a
   single admin row), and a collision between two rows is invisible from inside a
   one-row subset. Read from BUILDING_DATA_SOURCE — deliberately narrow.
--------------------------------------------------------------------------- */
async function loadBuildingSourceRoster() {
  if (mapRuntime.isBuildingSupabase()) {
    const rows = await buildingRepository.listAll();
    return (rows || []).map((b) => ({ id: toNumOrNull(b.id), name: b.name }));
  }
  const [rows] = await db.query('SELECT id, name FROM buildings');
  return (rows || []).map((b) => ({ id: toNumOrNull(b.id), name: b.name }));
}

/* ---------------------------------------------------------------------------
   PURE canonical-join verdict for ONE canonical name.

   Given the building-source rows and route-source rows that share a canonical
   name, decide whether the join is safe. Route-ready requires EXACTLY ONE row on
   EACH side — anything else fails closed.

     buildings | routes | verdict
     ----------+--------+-------------------------------------------------------
         1     |   1    -> ok, with the ROUTE-source building id
                          (unless that id is null/non-numeric -> not_mapped)
         1     |   0    -> not_mapped     (nothing to route to; NULL ids)
         0     |  any   -> ambiguous_name (no building row owns this name)
        >1     |  any   -> ambiguous_name (two buildings share a name)
        any    |  >1    -> ambiguous_name (two route rows share a name)

   A collision means two rows cannot be told apart by name, so neither may inherit
   the other's route — otherwise "Set as Destination" could silently navigate to
   the wrong building. Fail closed instead.

   The ZERO-building case is a collision too, not a success: a route-source row
   with no counterpart in the active building source has no building to attach to.
   Accepting it (as an earlier `bs.length > 1` check did, because 0 is not > 1)
   would hand out a route-source destination id for a name the building source
   does not actually have — the exact cross-source confusion this join exists to
   prevent.

   Pure and exported so the cardinality contract can be tested directly with
   fixtures, without writing rows to a database.
--------------------------------------------------------------------------- */
function canonicalJoinVerdict(buildingHits, routeHits) {
  const bs = Array.isArray(buildingHits) ? buildingHits : [];
  const rs = Array.isArray(routeHits) ? routeHits : [];

  // EXACTLY ONE building-source row is required; more than one route row is a
  // collision. (Zero route rows is handled below and is NOT ambiguous.)
  if (bs.length !== 1 || rs.length > 1) {
    return { ok: false, decoration: unavailable(REASON.AMBIGUOUS_NAME) };
  }
  // Exactly one building, no route counterpart: a real building that simply has
  // no route yet.
  if (rs.length === 0) {
    return { ok: false, decoration: unavailable(REASON.NOT_MAPPED) };
  }
  const routeBuildingId = toNumOrNull(rs[0].id);
  if (routeBuildingId == null) {
    return { ok: false, decoration: unavailable(REASON.NOT_MAPPED) };
  }
  return { ok: true, routeBuildingId };
}

// canonical key -> count, over a whole roster.
function groupByCanonical(rows) {
  const m = new Map();
  for (const r of (rows || [])) {
    const k = canonicalKey(r.name);
    if (k === '') continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

/* ---------------------------------------------------------------------------
   PURE destination-node resolution for route availability.

   Active Guided-VR destinations are governed by their configured natural
   destination_node_key. A sibling node that happens to share building_id must
   never make the building look routable when that configured endpoint is
   missing, duplicated, or attached to a different building. Non-catalog and
   deferred destinations retain the generic building-node fallback used by the
   public campus graph.
--------------------------------------------------------------------------- */
function resolveAvailabilityDestinationNode({
  destinationName,
  routeBuildingId,
  nodes,
  activeRoutes = GUIDED_VR_ROUTES,
  deferredDestinations = DEFERRED_GUIDED_VR_DESTINATIONS
}) {
  const list = Array.isArray(nodes) ? nodes : [];
  const policy = resolveGuidedDestinationPolicyByName({
    destinationName,
    activeRoutes,
    deferredDestinations,
    canonicalize: canonicalKey
  });

  if (policy.kind === 'invalid') return null;
  if (policy.kind === 'active') {
    const configuredKey = policy.route.destination_node_key;
    const matches = list.filter((node) =>
      node && node.key === configuredKey && node.building_id === routeBuildingId);
    return matches.length === 1 ? matches[0] : null;
  }

  const matches = list.filter((node) => node && node.building_id === routeBuildingId);
  return matches.find((node) => node.node_type === 'building') || matches[0] || null;
}

/* ---------------------------------------------------------------------------
   PURE directed route evaluation shared by availability decoration and the
   public pathfinding controller.

   Entry routes retain the legacy geometry fallback. Exit routes call the same
   evaluator with requireExplicitGeometry=true so a missing edge shape can
   never be published as an inferred straight-line exit.
--------------------------------------------------------------------------- */
function evaluateDirectedPath({
  nodes,
  edges,
  edgeGeometryByKey,
  startKey,
  endKey,
  requireExplicitGeometry = false
}) {
  const graphNodes = Array.isArray(nodes) ? nodes : [];
  const graphEdges = Array.isArray(edges) ? edges : [];
  const geometryByKey = edgeGeometryByKey instanceof Map ? edgeGeometryByKey : new Map();
  const result = findShortestPath({
    nodes: graphNodes,
    edges: graphEdges,
    startKey,
    endKey
  });
  const reachable =
    result.success &&
    Array.isArray(result.nodes) && result.nodes.length >= 2 &&
    Number.isFinite(Number(result.distance_meters)) &&
    Number.isFinite(Number(result.walk_time_seconds));
  if (!reachable) return { ok: false, reason: REASON.UNREACHABLE, result: null, geometry: null };

  const assembled = assembleRouteGeometry({
    nodes: result.nodes,
    segments: result.segments,
    edgeGeometryByKey: geometryByKey
  });
  const geometryOk =
    !assembled.incomplete &&
    assembled.invalidEdges === 0 &&
    Array.isArray(assembled.geometry) &&
    assembled.geometry.length >= 2;
  if (!geometryOk) return { ok: false, reason: REASON.INVALID_GEOMETRY, result, geometry: null };

  if (requireExplicitGeometry) {
    const explicitlyDrawn = result.segments.every((segment) => {
      const raw = geometryByKey.get(String(segment.from) + '|' + String(segment.to));
      return normalizeStoredPathGeometry(raw).state === 'present';
    });
    if (!explicitlyDrawn) {
      return { ok: false, reason: REASON.EXIT_NOT_DRAWN, result, geometry: null };
    }
  }

  return { ok: true, reason: null, result, geometry: assembled.geometry };
}

/*
 * Evaluate a building's complete two-way contract. The optional entryEvaluation
 * lets availability decoration reuse the entry result it already computed,
 * while the controller can call this helper directly for a stale/direct caller.
 */
function evaluateExitRoute({
  nodes,
  edges,
  edgeGeometryByKey,
  buildingNodeKey,
  mainGateKey = START_NODE_KEY,
  entryEvaluation = null
}) {
  const entry = entryEvaluation || evaluateDirectedPath({
    nodes,
    edges,
    edgeGeometryByKey,
    startKey: mainGateKey,
    endKey: buildingNodeKey
  });
  if (!entry.ok) return { ok: false, reason: entry.reason, entry, exit: null, geometry: null };

  const exit = evaluateDirectedPath({
    nodes,
    edges,
    edgeGeometryByKey,
    startKey: buildingNodeKey,
    endKey: mainGateKey,
    requireExplicitGeometry: true
  });
  if (!exit.ok) return { ok: false, reason: exit.reason, entry, exit, geometry: null };

  const sameAsEntry = isReversePathGeometry(entry.geometry, exit.geometry);
  if (sameAsEntry) {
    return { ok: false, reason: REASON.SAME_AS_ENTRY, entry, exit, geometry: null, sameAsEntry: true };
  }

  return { ok: true, reason: null, entry, exit, geometry: exit.geometry, sameAsEntry: false };
}

/* PURE per-destination availability calculation, exported for rejecting
   fixtures. Database/repository reads remain in buildAvailabilityIndex(). */
function availabilityDecorationForDestination({
  destinationName,
  routeBuildingId,
  nodes,
  edges,
  edgeGeometryByKey,
  vrRouteId,
  activeRoutes = GUIDED_VR_ROUTES,
  deferredDestinations = DEFERRED_GUIDED_VR_DESTINATIONS
}) {
  const vr = vrRouteId || null;
  const dest = resolveAvailabilityDestinationNode({
    destinationName,
    routeBuildingId,
    nodes,
    activeRoutes,
    deferredDestinations
  });

  if (!dest) {
    return {
      route_available: false,
      route_destination_id: routeBuildingId,
      route_unavailable_reason: REASON.NOT_MAPPED,
      exit_route_available: false,
      exit_route_unavailable_reason: REASON.NOT_MAPPED,
      vr_route_id: vr
    };
  }

  const entry = evaluateDirectedPath({
    nodes,
    edges,
    edgeGeometryByKey,
    startKey: START_NODE_KEY,
    endKey: dest.key
  });
  if (!entry.ok) {
    return {
      route_available: false,
      route_destination_id: routeBuildingId,
      route_unavailable_reason: entry.reason,
      exit_route_available: false,
      exit_route_unavailable_reason: entry.reason,
      vr_route_id: vr
    };
  }

  const exit = evaluateExitRoute({
    nodes,
    edges,
    edgeGeometryByKey,
    buildingNodeKey: dest.key,
    mainGateKey: START_NODE_KEY,
    entryEvaluation: entry
  });
  if (!exit.ok) {
    return {
      route_available: true,
      route_destination_id: routeBuildingId,
      route_unavailable_reason: null,
      exit_route_available: false,
      exit_route_unavailable_reason: exit.reason,
      vr_route_id: vr
    };
  }

  // A legacy mirrored pair is not an exit route. The admin must draw and save
  // a distinct directed geometry (and may enter distinct scalar metrics) before
  // the public Exit action is offered.
  return {
    route_available: true,
    route_destination_id: routeBuildingId,
    route_unavailable_reason: null,
    exit_route_available: true,
    exit_route_unavailable_reason: null,
    vr_route_id: vr
  };
}

/* ---------------------------------------------------------------------------
   Build the canonical-name -> availability index.

   Joins the BUILDING source and the ROUTE source by canonical name, and refuses
   to guess when that join is not 1:1. A name is route-ready ONLY when it resolves
   to EXACTLY ONE building-source row AND EXACTLY ONE route-source row. Any
   collision on either side yields `ambiguous_name` with NULL destination/VR ids —
   otherwise two same-named buildings would silently inherit one another's route,
   and "Set as Destination" could navigate to the wrong building.

   Computed once per request; never throws.
--------------------------------------------------------------------------- */
async function buildAvailabilityIndex(preloaded) {
  let src;
  let buildingRoster;
  const pre = (preloaded && typeof preloaded === 'object') ? preloaded : null;
  try {
    if (pre && pre.routeSource && Array.isArray(pre.buildingRoster)) {
      // A caller that already read BOTH datasets for this request passes its
      // immutable snapshot in, so one request never reads them twice. Omitting
      // it keeps every existing caller byte-for-byte unchanged.
      src = pre.routeSource;
      buildingRoster = pre.buildingRoster;
    } else {
      // Both rosters are needed before any verdict: the collision check spans them.
      [src, buildingRoster] = await Promise.all([loadRouteSource(), loadBuildingSourceRoster()]);
    }
  } catch (e) {
    // FAIL CLOSED. The caller logs one fixed sanitized diagnostic; the raw
    // backend error never leaves this module.
    return { ok: false, byName: new Map() };
  }

  const nodes = (src.nodes || []).map((n) => ({
    id: toNumOrNull(n.id),
    key: n.node_key,
    label: n.label,
    node_type: n.node_type,
    building_id: n.building_id != null ? toNumOrNull(n.building_id) : null,
    lat: toNumOrNull(n.lat),
    lng: toNumOrNull(n.lng)
  }));

  const idToKey = new Map(nodes.map((n) => [n.id, n.key]));

  // Directed edges + per-edge stored drawing geometry, exactly as
  // controllers/mapController.apiPathfind assembles them.
  const edgeGeometryByKey = new Map();
  const edges = (src.edges || []).map((e) => {
    const from = idToKey.get(toNumOrNull(e.from_node_id));
    const to = idToKey.get(toNumOrNull(e.to_node_id));
    if (from && to) {
      edgeGeometryByKey.set(from + '|' + to, e.path_geometry !== undefined ? e.path_geometry : null);
    }
    return {
      from,
      to,
      distance_meters: Number(e.distance_meters) || 0,
      walk_time_seconds: Number(e.walk_time_seconds) || 0,
      path_label: e.path_label != null ? e.path_label : null,
      is_accessible: Number(e.is_accessible)
    };
  });

  const byName = new Map();

  // Canonical groups on BOTH sides. The union is every name either side knows.
  const buildingGroups = groupByCanonical(buildingRoster);
  const routeGroups = groupByCanonical(src.buildings || []);
  const allKeys = new Set([...buildingGroups.keys(), ...routeGroups.keys()]);

  for (const key of allKeys) {
    const join = canonicalJoinVerdict(buildingGroups.get(key) || [], routeGroups.get(key) || []);
    if (!join.ok) {
      byName.set(key, join.decoration);
      continue;
    }
    const routeBuildingId = join.routeBuildingId;

    byName.set(key, availabilityDecorationForDestination({
      destinationName: routeGroups.get(key)[0].name,
      routeBuildingId,
      nodes,
      edges,
      edgeGeometryByKey,
      vrRouteId: src.vrByBuildingId.get(routeBuildingId) || null
    }));
  }

  return { ok: true, byName };
}

// Share only an active availability-index build across concurrent map,
// building, and search requests. The completed value is discarded as soon as
// the promise settles; every later call starts a fresh read of both sources.
const availabilityIndexFlight = createSingleFlight(() => buildAvailabilityIndex());

function invalidateAvailabilityRead() {
  availabilityIndexFlight.invalidate();
}

async function getAvailabilityIndex() {
  return availabilityIndexFlight();
}

/* ---------------------------------------------------------------------------
   Decorate building rows (from BUILDING_DATA_SOURCE) with the additive contract.

   Additive ONLY: no existing field is removed or renamed. `vr_route_id` is now
   sourced from ROUTE_DATA_SOURCE and matched by canonical name — previously it
   was looked up by numeric id against whichever backend the BUILDING switch
   selected, which silently produced wrong/absent VR links whenever the two
   switches differed.

   Mutates and returns the same array (callers already rely on that pattern).
--------------------------------------------------------------------------- */
async function decorateBuildings(buildings, options) {
  const list = Array.isArray(buildings) ? buildings : [];
  const opts = (options && typeof options === 'object') ? options : null;
  // An already-built index (from this request's single snapshot) is reused as-is;
  // omitting it preserves the existing read-per-call behaviour exactly.
  const index = (opts && opts.index) ? opts.index : await getAvailabilityIndex();

  if (!index.ok) {
    for (const b of list) Object.assign(b, unavailable(REASON.ROUTE_DATA_UNAVAILABLE));
    return { buildings: list, ok: false };
  }

  for (const b of list) {
    const hit = index.byName.get(canonicalKey(b && b.name));
    // A building with no counterpart in the route source is simply not mapped.
    Object.assign(b, hit || unavailable(REASON.NOT_MAPPED));
  }
  return { buildings: list, ok: true };
}

// Single-row convenience for the admin create/update responses.
async function decorateBuilding(building) {
  if (!building) return { building, ok: true };
  const out = await decorateBuildings([building]);
  return { building: out.buildings[0], ok: out.ok };
}

/* ---------------------------------------------------------------------------
   Admin friendly pre-check: would this canonical name collide with an EXISTING
   building in the ACTIVE building source?

   `excludeId` lets an update keep its own name (the edited row is not its own
   duplicate). Returns true when a DIFFERENT row already owns the canonical name.

   This is a UX guard that turns a would-be silent `ambiguous_name` into an
   immediate sanitized 409. It is NOT the safety net: two concurrent admin writes
   can still both pass it, so the fail-closed collision handling in
   buildAvailabilityIndex() above remains authoritative. No schema constraint or
   migration is added here.

   Throws only if the building source is unreadable; the caller maps that to its
   existing sanitized 500. Never logs or echoes a row, id, or name.
--------------------------------------------------------------------------- */
async function canonicalNameCollides(name, excludeId) {
  const key = canonicalKey(name);
  if (key === '') return false;
  const roster = await loadBuildingSourceRoster();
  const ex = toNumOrNull(excludeId);
  return roster.some((r) => canonicalKey(r.name) === key && toNumOrNull(r.id) !== ex);
}

module.exports = {
  REASON,
  START_NODE_KEY,
  canonicalKey,
  canonicalJoinVerdict,
  groupByCanonical,
  resolveAvailabilityDestinationNode,
  evaluateDirectedPath,
  evaluateExitRoute,
  availabilityDecorationForDestination,
  loadRouteSource,
  loadBuildingSourceRoster,
  canonicalNameCollides,
  buildAvailabilityIndex,
  invalidateAvailabilityRead,
  decorateBuildings,
  decorateBuilding
};
