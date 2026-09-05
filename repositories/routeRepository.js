'use strict';

/* ========================================
   CampuSphere - Route Repository (reads)
   Milestone 3, Section 3.8.

   Supabase-backed READ methods for the campus route graph:
   - listRouteSummaries(filters)  route summary rows + destination building
   - attachStepsToRoutes(routes)  attach ordered steps + derived landmarks
   - getRouteWithSteps(id)        one summary + steps, or null
   - listAllNodes()               route_nodes rows for /api/pathfind
   - listAllEdges()               directed route_edges rows for /api/pathfind
   - searchRoutes(term, opts)     route half of /api/search
   - listVrRouteIdByBuilding()    Map<buildingId, routeId> (canonical home,
                                  per REPOSITORY_BOUNDARIES.md s8)

   No controller calls these yet. Section 3.9 wires /api/search,
   /api/routes, /api/routes/:id, and /api/pathfind behind ROUTE_DATA_SOURCE.
   utils/pathfinding.js is NOT touched and stays pure.

   Boundary rules (REPOSITORY_BOUNDARIES.md s4 + s8):
   - Imports `config/supabase.js` ONLY. It does NOT import `config/db.js`,
     any controller, route, view, or middleware.
   - Never reads req / res / sessions / res.locals / app.locals / browser
     globals. HTTP status + role decisions stay in controllers.
   - Returns plain row-like objects; controllers own the final API/EJS
     shape. Return shapes here mirror what mapController already consumes
     today so Section 3.9 is a drop-in source swap.
   - `route_edges` rows are DIRECTED. The seed inserts both A->B and B->A;
     this module returns them verbatim and never synthesizes reverse edges.
   - Supabase errors are rethrown as plain Error objects prefixed with
     `routeRepository.<method>:` carrying only the safe Supabase message
     (no keys, URLs, OAuth subjects, or credentials).
   ======================================== */

const { getSupabaseClient } = require('../config/supabase');
const { createSingleFlight } = require('../utils/singleFlight');

// Column lists kept explicit so a schema addition can never silently widen a
// response. The PostGIS `location` geography is deliberately excluded (the UI
// reads lat/lng directly).
const ROUTE_COLUMNS = 'id, title, start_label, estimated_walk_time, destination_building_id';
const STEP_COLUMNS = 'route_id, step_order, instruction, landmark, lat, lng';
const NODE_COLUMNS = 'id, node_key, label, node_type, building_id, lat, lng';
const EDGE_COLUMNS =
  'from_node_id, to_node_id, distance_meters, walk_time_seconds, path_label, is_accessible';
// RF.3: geometry-enabled edge read for the /api/pathfind drawing assembly
// ONLY. listAllEdges() stays geometry-free for VR and every other caller,
// and admin list/get shapes never include geometry (RF.4 has not started).
const EDGE_GEOMETRY_COLUMNS = EDGE_COLUMNS + ', path_geometry';

// Building columns needed per consumer. Summaries need only the marker fields;
// search additionally needs description + details (jsonb) for the building hit
// the route decorates.
const SUMMARY_BUILDING_COLUMNS = 'id, name, category, lat, lng';
const SEARCH_BUILDING_COLUMNS = 'id, name, category, description, lat, lng, details';

// Defensive limit clamp for search. Default 25 (matches mapController's
// MAX_RESULTS); hard ceiling 100 so a crafted limit can never request an
// unbounded scan.
const DEFAULT_SEARCH_LIMIT = 25;
const MAX_SEARCH_LIMIT = 100;

function clampLimit(limit) {
  const n = Number(limit);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SEARCH_LIMIT;
  return Math.min(Math.floor(n), MAX_SEARCH_LIMIT);
}

// Redact anything that could resemble the service role key (a JWT) or a full
// Supabase URL before it reaches an Error message / log. Mirrors the defensive
// scrub in repositories/vrRepository.js and repositories/contentRepository.js.
function safeSupabaseMessage(error) {
  let msg;
  if (!error) msg = 'Supabase request failed.';
  else if (typeof error === 'string') msg = error;
  else if (error.message) msg = String(error.message);
  else msg = 'Supabase request failed.';

  msg = msg.replace(
    /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    '[REDACTED_JWT]'
  );
  msg = msg.replace(
    /https?:\/\/[A-Za-z0-9-]+\.supabase\.co[^\s]*/g,
    '[REDACTED_SUPABASE_URL]'
  );
  return msg;
}

// Wrap a Supabase error as a plain Error with a fixed method prefix and only
// the redacted message. Never includes keys/URLs/headers/credentials.
function fail(method, error) {
  return new Error('routeRepository.' + method + ': ' + safeSupabaseMessage(error));
}

// Coerce a coordinate-like value to a finite Number or null. Mirrors the
// `toNumOrNull` helper in mapController so callers get identical lat/lng types.
function toNumOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Coerce an id-like value to a finite integer or null.
function toIdOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : (Number.isFinite(n) ? Math.trunc(n) : null);
}

// Case-insensitive substring match mirroring MySQL `col LIKE %needle%`
// (MySQL's default collation is case-insensitive).
function includesCI(haystack, needle) {
  return String(haystack == null ? '' : haystack).toLowerCase().includes(needle);
}

// Fetch buildings by id into a Map<id, row>. Used to emulate the INNER JOIN
// that joins routes to their destination building. ids is a small set.
async function loadBuildingsByIds(sb, ids, columns, method) {
  if (!ids || ids.length === 0) return new Map();
  const { data, error } = await sb.from('buildings').select(columns).in('id', ids);
  if (error) throw fail(method, error);
  const map = new Map();
  for (const row of (data || [])) map.set(toIdOrNull(row.id), row);
  return map;
}

// Group raw step rows (route_id, step_order, instruction, landmark[, lat, lng])
// by route id, preserving the step_order ASC order the query returns.
async function loadStepsByRoute(sb, routeIds, columns, method) {
  if (!routeIds || routeIds.length === 0) return new Map();
  const { data, error } = await sb
    .from('campus_route_steps')
    .select(columns)
    .in('route_id', routeIds)
    .order('route_id', { ascending: true })
    .order('step_order', { ascending: true });
  if (error) throw fail(method, error);

  const byRoute = new Map();
  for (const s of (data || [])) {
    const rid = toIdOrNull(s.route_id);
    if (!byRoute.has(rid)) byRoute.set(rid, []);
    byRoute.get(rid).push(s);
  }
  return byRoute;
}

// The search corpus is small but expensive to assemble over the remote
// PostgREST connection: routes, destination buildings, and ordered steps are
// three reads. Share only the active corpus load across concurrent search
// terms; the source is discarded immediately after it settles, so later calls
// always read fresh data.
async function loadSearchSource() {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('campus_routes')
    .select(ROUTE_COLUMNS)
    .order('title', { ascending: true });
  if (error) throw fail('searchRoutes', error);

  const routes = data || [];
  if (routes.length === 0) {
    return {
      routes,
      buildingById: new Map(),
      stepsByRoute: new Map()
    };
  }

  const destIds = [...new Set(
    routes.map((r) => toIdOrNull(r.destination_building_id)).filter((v) => v != null)
  )];
  const routeIds = routes.map((r) => toIdOrNull(r.id)).filter((v) => v != null);
  const [buildingById, stepsByRoute] = await Promise.all([
    loadBuildingsByIds(sb, destIds, SEARCH_BUILDING_COLUMNS, 'searchRoutes'),
    loadStepsByRoute(sb, routeIds, 'route_id, landmark, instruction', 'searchRoutes')
  ]);

  return { routes, buildingById, stepsByRoute };
}

const searchSourceFlight = createSingleFlight(loadSearchSource);

function invalidateSearchRead() {
  searchSourceFlight.invalidate();
}

// Shape one campus_routes row + its destination building into the summary
// object mapController.fetchRouteSummaries returns today.
function mapSummary(routeRow, buildingRow) {
  return {
    id: toIdOrNull(routeRow.id),
    title: routeRow.title,
    start_label: routeRow.start_label,
    estimated_walk_time: routeRow.estimated_walk_time,
    destination: {
      id: toIdOrNull(buildingRow.id),
      name: buildingRow.name,
      category: buildingRow.category,
      lat: toNumOrNull(buildingRow.lat),
      lng: toNumOrNull(buildingRow.lng)
    }
  };
}

/**
 * Route summaries joined to their destination building, ordered by title ASC.
 *
 * Mirrors mapController.fetchRouteSummaries: returns
 *   { id, title, start_label, estimated_walk_time,
 *     destination: { id, name, category, lat, lng } }.
 *
 * Supported filters (all optional):
 *   - id              exact campus_routes.id
 *   - start           case-insensitive substring of start_label
 *   - destinationId   exact destination_building_id
 *   - destinationName case-insensitive substring of the destination name
 *
 * The campus route set is tiny (4 rows), so rows are fetched title-sorted and
 * filtered in JS, which preserves the exact MySQL LIKE semantics without
 * depending on PostgREST filter-encoding quirks. Routes whose destination
 * building is absent are dropped (INNER JOIN parity).
 */
async function listRouteSummaries(filters = {}) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('campus_routes')
    .select(ROUTE_COLUMNS)
    .order('title', { ascending: true });
  if (error) throw fail('listRouteSummaries', error);

  let routes = data || [];

  if (filters.id != null) {
    const idNum = toIdOrNull(filters.id);
    routes = routes.filter((r) => toIdOrNull(r.id) === idNum);
  }
  if (filters.start) {
    const needle = String(filters.start).toLowerCase();
    routes = routes.filter((r) => includesCI(r.start_label, needle));
  }
  if (filters.destinationId != null) {
    const destNum = toIdOrNull(filters.destinationId);
    routes = routes.filter((r) => toIdOrNull(r.destination_building_id) === destNum);
  }
  if (routes.length === 0) return [];

  const destIds = [...new Set(
    routes.map((r) => toIdOrNull(r.destination_building_id)).filter((v) => v != null)
  )];
  const buildingById = await loadBuildingsByIds(
    sb, destIds, SUMMARY_BUILDING_COLUMNS, 'listRouteSummaries'
  );

  let summaries = [];
  for (const r of routes) {
    const b = buildingById.get(toIdOrNull(r.destination_building_id));
    if (!b) continue; // INNER JOIN parity: no destination building -> drop route
    summaries.push(mapSummary(r, b));
  }

  if (filters.destinationName) {
    const needle = String(filters.destinationName).toLowerCase();
    summaries = summaries.filter((s) => includesCI(s.destination.name, needle));
  }

  return summaries;
}

/**
 * Attach ordered steps + derived landmarks onto the passed route summary
 * array, mutating and returning it (mirrors mapController.attachStepsToRoutes).
 *
 * Each step: { step_order, instruction, landmark, lat, lng }.
 * landmarks: unique, non-empty step landmarks in step order.
 */
async function attachStepsToRoutes(routes) {
  if (!Array.isArray(routes) || routes.length === 0) return routes;

  const ids = routes.map((r) => toIdOrNull(r.id)).filter((v) => v != null);
  const sb = getSupabaseClient();
  const byRoute = await loadStepsByRoute(sb, ids, STEP_COLUMNS, 'attachStepsToRoutes');

  for (const r of routes) {
    const rows = byRoute.get(toIdOrNull(r.id)) || [];
    r.steps = rows.map((s) => ({
      step_order: toIdOrNull(s.step_order),
      instruction: s.instruction,
      landmark: s.landmark,
      lat: toNumOrNull(s.lat),
      lng: toNumOrNull(s.lng)
    }));
    r.landmarks = Array.from(new Set(r.steps.map((s) => s.landmark).filter(Boolean)));
  }
  return routes;
}

/**
 * A single route summary plus its ordered steps, or null when the id is
 * invalid or no route matches. Mirrors mapController.apiGetRoute's
 * fetchRouteSummaries({ id }) + attachStepsToRoutes path.
 */
async function getRouteWithSteps(id) {
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId < 1) return null;

  const summaries = await listRouteSummaries({ id: numId });
  if (summaries.length === 0) return null;

  await attachStepsToRoutes(summaries);
  return summaries[0];
}

/**
 * All route_nodes rows shaped for the /api/pathfind node mapping:
 *   { id, node_key, label, node_type, building_id, lat, lng }.
 * Ordered by id ASC for deterministic output (MySQL had no ORDER BY; order is
 * irrelevant to pathfinding, which indexes nodes by key).
 */
async function listAllNodes() {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('route_nodes')
    .select(NODE_COLUMNS)
    .order('id', { ascending: true });
  if (error) throw fail('listAllNodes', error);

  return (data || []).map((r) => ({
    id: toIdOrNull(r.id),
    node_key: r.node_key,
    label: r.label,
    node_type: r.node_type,
    building_id: r.building_id != null ? toIdOrNull(r.building_id) : null,
    lat: toNumOrNull(r.lat),
    lng: toNumOrNull(r.lng)
  }));
}

/**
 * All route_edges rows shaped for the /api/pathfind edge mapping:
 *   { from_node_id, to_node_id, distance_meters, walk_time_seconds,
 *     path_label, is_accessible }.
 *
 * Rows are returned verbatim and DIRECTED — no reverse edges are synthesized
 * (the seed already stores both directions). `is_accessible` is normalized to
 * 1/0 to match the MySQL TINYINT shape the controller's `Number(...)` mapping
 * expects.
 */
async function listAllEdges() {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('route_edges')
    .select(EDGE_COLUMNS)
    .order('id', { ascending: true });
  if (error) throw fail('listAllEdges', error);

  return (data || []).map((e) => ({
    from_node_id: toIdOrNull(e.from_node_id),
    to_node_id: toIdOrNull(e.to_node_id),
    distance_meters: Number(e.distance_meters) || 0,
    walk_time_seconds: Number(e.walk_time_seconds) || 0,
    path_label: e.path_label != null ? e.path_label : null,
    is_accessible: e.is_accessible ? 1 : 0
  }));
}

/**
 * RF.3: listAllEdges plus the raw stored path_geometry (Supabase returns
 * parsed jsonb; passed through verbatim for utils/routeGeometry
 * normalization). Used ONLY by mapController.apiPathfind to assemble the
 * flattened route.geometry — VR graph reads and admin CRUD keep the
 * geometry-free listAllEdges()/admin shapes.
 */
async function listAllEdgesWithGeometry() {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('route_edges')
    .select(EDGE_GEOMETRY_COLUMNS)
    .order('id', { ascending: true });
  if (error) throw fail('listAllEdgesWithGeometry', error);

  return (data || []).map((e) => ({
    from_node_id: toIdOrNull(e.from_node_id),
    to_node_id: toIdOrNull(e.to_node_id),
    distance_meters: Number(e.distance_meters) || 0,
    walk_time_seconds: Number(e.walk_time_seconds) || 0,
    path_label: e.path_label != null ? e.path_label : null,
    is_accessible: e.is_accessible ? 1 : 0,
    path_geometry: e.path_geometry !== undefined ? e.path_geometry : null
  }));
}

/**
 * Route half of /api/search. Returns row-like objects matching the current
 * MySQL route-search query in mapController.apiSearch:
 *   { route_id, route_title, route_start, estimated_walk_time,
 *     building_id, building_name, building_category, building_description,
 *     building_lat, building_lng, building_details }.
 *
 * A route matches when the needle appears (case-insensitively) in the route
 * title, start label, destination building name, or any step's landmark or
 * instruction. Blank term -> []. Results are title-sorted, limit default 25,
 * clamped to 100. `building_details` is returned as the jsonb object Supabase
 * provides; normalizeBuildingRow (controller-side) already accepts an object.
 */
async function searchRoutes(term, { limit } = {}) {
  const needle = String(term == null ? '' : term).trim().toLowerCase();
  if (needle === '') return [];
  const max = clampLimit(limit);

  const { routes, buildingById, stepsByRoute } = await searchSourceFlight();

  const out = [];
  for (const r of routes) {
    const b = buildingById.get(toIdOrNull(r.destination_building_id));
    if (!b) continue; // INNER JOIN parity

    const steps = stepsByRoute.get(toIdOrNull(r.id)) || [];
    const stepMatch = steps.some(
      (s) => includesCI(s.landmark, needle) || includesCI(s.instruction, needle)
    );

    if (
      includesCI(r.title, needle) ||
      includesCI(r.start_label, needle) ||
      includesCI(b.name, needle) ||
      stepMatch
    ) {
      out.push({
        route_id: toIdOrNull(r.id),
        route_title: r.title,
        route_start: r.start_label,
        estimated_walk_time: r.estimated_walk_time,
        building_id: toIdOrNull(b.id),
        building_name: b.name,
        building_category: b.category,
        building_description: b.description,
        building_lat: toNumOrNull(b.lat),
        building_lng: toNumOrNull(b.lng),
        building_details: b.details != null ? b.details : null
      });
    }
  }

  return out.slice(0, max);
}

/**
 * BE.3: the ROUTE SOURCE's own building roster — id + name only.
 *
 * services/routeAvailability.js joins building rows (which come from
 * BUILDING_DATA_SOURCE) to the route graph (which comes from ROUTE_DATA_SOURCE)
 * by NORMALIZED CANONICAL NAME. The two backends' numeric building ids are NOT
 * interchangeable, so the route side must expose its own id/name pairs rather
 * than have the caller assume the building row's id is meaningful here.
 *
 * Deliberately narrow: no coordinates, description, details, or media leave
 * through this read.
 */
async function listRouteSourceBuildings() {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('buildings')
    .select('id, name')
    .order('id', { ascending: true });
  if (error) throw fail('listRouteSourceBuildings', error);

  return (data || []).map((b) => ({
    id: toIdOrNull(b.id),
    name: b.name
  }));
}

/**
 * One ROUTE-source building by its route-source id (BE.4): the destination
 * lookup behind /vr/to/:id, whose id is the map's route_destination_id.
 * Deliberately narrow — only { id, name, category } leave this read (no
 * coordinates, description, details, or media). Invalid ids return null
 * without querying.
 */
async function findRouteSourceBuildingById(id) {
  const n = toIdOrNull(id);
  if (n === null) return null;

  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('buildings')
    .select('id, name, category')
    .eq('id', n)
    .maybeSingle();
  if (error) throw fail('findRouteSourceBuildingById', error);
  if (!data) return null;
  return {
    id: toIdOrNull(data.id),
    name: data.name,
    category: data.category != null ? data.category : null
  };
}

/**
 * Map<buildingId, routeId> for decorating buildings with `vr_route_id`.
 * Lowest route id wins when several routes target the same building (rows are
 * read ordered by id ASC, so the first seen is the lowest). This is the
 * canonical home of the helper (REPOSITORY_BOUNDARIES.md s8);
 * buildingRepository.listVrRouteIdByBuilding delegates here.
 */
async function listVrRouteIdByBuilding() {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('campus_routes')
    .select('id, destination_building_id')
    .order('id', { ascending: true });
  if (error) throw fail('listVrRouteIdByBuilding', error);

  const map = new Map();
  for (const row of (data || [])) {
    const buildingId = toIdOrNull(row.destination_building_id);
    if (buildingId == null) continue;
    if (!map.has(buildingId)) map.set(buildingId, toIdOrNull(row.id));
  }
  return map;
}

/* ===========================================================================
   Admin route/graph write + admin-read methods (Milestone 7, Section 7.9).

   Server-only, used exclusively by controllers/adminRouteController.js behind
   the /admin requireRole('admin') gate. Validation, HTTP status, dependency
   guards, and audit stay in the controller. Routes/edges/step-reads use direct
   PostgREST (single-row writes are atomic). The route+steps replace and the
   route_node create/update/delete go through the service-role-only SQL
   functions in 0007_route_graph_admin_write_functions.sql (node writes compute
   the PostGIS `location`; the node-delete function re-checks references and
   raises NODE_REFERENCED atomically as a race backstop). Existing public read
   methods above are untouched.
=========================================================================== */

const ADMIN_EDGE_COLUMNS =
  'id, from_node_id, to_node_id, distance_meters, walk_time_seconds, path_label, is_accessible';

async function rowExists(table, method, id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) return false;
  const sb = getSupabaseClient();
  const { data, error } = await sb.from(table).select('id').eq('id', n).maybeSingle();
  if (error) throw fail(method, error);
  return !!data;
}
function adminBuildingExists(id) { return rowExists('buildings', 'adminBuildingExists', id); }
function adminRouteExists(id) { return rowExists('campus_routes', 'adminRouteExists', id); }
function adminNodeExists(id) { return rowExists('route_nodes', 'adminNodeExists', id); }
function adminEdgeExists(id) { return rowExists('route_edges', 'adminEdgeExists', id); }

async function shapeRouteWithName(sb, row) {
  if (!row) return null;
  const bid = toIdOrNull(row.destination_building_id);
  let destination_name = null;
  if (bid != null) {
    const m = await loadBuildingsByIds(sb, [bid], 'id, name', 'shapeRouteWithName');
    destination_name = (m.get(bid) || {}).name || null;
  }
  return {
    id: toIdOrNull(row.id), title: row.title, start_label: row.start_label,
    destination_building_id: bid, estimated_walk_time: row.estimated_walk_time,
    destination_name
  };
}
function shapeNode(row) {
  if (!row) return null;
  return {
    id: toIdOrNull(row.id), node_key: row.node_key, label: row.label, node_type: row.node_type,
    building_id: row.building_id != null ? toIdOrNull(row.building_id) : null,
    lat: toNumOrNull(row.lat), lng: toNumOrNull(row.lng), display_order: toIdOrNull(row.display_order)
  };
}
function shapeStep(row) {
  return {
    route_id: toIdOrNull(row.route_id), step_order: toIdOrNull(row.step_order),
    instruction: row.instruction, landmark: row.landmark,
    lat: toNumOrNull(row.lat), lng: toNumOrNull(row.lng)
  };
}
async function loadNodeMap(sb, method) {
  const { data, error } = await sb.from('route_nodes').select('id, node_key, label');
  if (error) throw fail(method, error);
  const m = new Map();
  for (const n of (data || [])) m.set(toIdOrNull(n.id), { node_key: n.node_key, label: n.label });
  return m;
}
function shapeEdge(e, nodeMap) {
  if (!e) return null;
  const f = nodeMap.get(toIdOrNull(e.from_node_id)) || {};
  const t = nodeMap.get(toIdOrNull(e.to_node_id)) || {};
  return {
    id: toIdOrNull(e.id), from_node_id: toIdOrNull(e.from_node_id), to_node_id: toIdOrNull(e.to_node_id),
    distance_meters: Number(e.distance_meters) || 0, walk_time_seconds: Number(e.walk_time_seconds) || 0,
    path_label: e.path_label != null ? e.path_label : null,
    is_accessible: (e.is_accessible === true || e.is_accessible === 1 || e.is_accessible === '1'),
    from_node_key: f.node_key || null, from_label: f.label || null,
    to_node_key: t.node_key || null, to_label: t.label || null
  };
}

/* ---- routes ---- */
async function adminListRoutes() {
  const sb = getSupabaseClient();
  const { data, error } = await sb.from('campus_routes').select(ROUTE_COLUMNS).order('title', { ascending: true });
  if (error) throw fail('adminListRoutes', error);
  const routes = data || [];
  const destIds = [...new Set(routes.map((r) => toIdOrNull(r.destination_building_id)).filter((v) => v != null))];
  const byId = await loadBuildingsByIds(sb, destIds, 'id, name', 'adminListRoutes');
  return routes.map((r) => ({
    id: toIdOrNull(r.id), title: r.title, start_label: r.start_label,
    destination_building_id: toIdOrNull(r.destination_building_id),
    estimated_walk_time: r.estimated_walk_time,
    destination_name: (byId.get(toIdOrNull(r.destination_building_id)) || {}).name || null
  }));
}
async function adminGetRoute(id) {
  const n = Number(id); if (!Number.isInteger(n) || n < 1) return null;
  const sb = getSupabaseClient();
  const { data, error } = await sb.from('campus_routes').select(ROUTE_COLUMNS).eq('id', n).maybeSingle();
  if (error) throw fail('adminGetRoute', error);
  return shapeRouteWithName(sb, data);
}
async function adminFindRouteIdByTitle(title, excludeId) {
  const t = String(title == null ? '' : title).trim().toLowerCase();
  if (t === '') return null;
  const sb = getSupabaseClient();
  const { data, error } = await sb.from('campus_routes').select('id, title');
  if (error) throw fail('adminFindRouteIdByTitle', error);
  const ex = Number(excludeId);
  for (const r of (data || [])) {
    if (Number.isInteger(ex) && ex > 0 && toIdOrNull(r.id) === ex) continue;
    if (String(r.title == null ? '' : r.title).trim().toLowerCase() === t) return toIdOrNull(r.id);
  }
  return null;
}
async function adminCreateRoute(p) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.from('campus_routes').insert({
    title: p.title, start_label: p.start_label,
    destination_building_id: p.destination_building_id, estimated_walk_time: p.estimated_walk_time
  }).select(ROUTE_COLUMNS).single();
  if (error) throw fail('adminCreateRoute', error);
  return shapeRouteWithName(sb, data);
}
async function adminUpdateRoute(id, p) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.from('campus_routes').update({
    title: p.title, start_label: p.start_label,
    destination_building_id: p.destination_building_id, estimated_walk_time: p.estimated_walk_time,
    updated_at: new Date().toISOString()
  }).eq('id', id).select(ROUTE_COLUMNS).maybeSingle();
  if (error) throw fail('adminUpdateRoute', error);
  return data ? shapeRouteWithName(sb, data) : null;
}
async function adminDeleteRoute(id) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.from('campus_routes').delete().eq('id', id).select('id').maybeSingle();
  if (error) throw fail('adminDeleteRoute', error);
  return data ? toIdOrNull(data.id) : null;
}

// R5 destructive-delete guard helper: how many campus routes use this building
// as their destination. Used by adminBuildingsController.deleteBuilding to
// return 409 before a building delete would cascade routes away. Server-only.
async function adminCountRoutesByBuilding(buildingId) {
  const n = Number(buildingId);
  if (!Number.isInteger(n) || n < 1) return 0;
  const sb = getSupabaseClient();
  const { count, error } = await sb
    .from('campus_routes')
    .select('id', { count: 'exact', head: true })
    .eq('destination_building_id', n);
  if (error) throw fail('adminCountRoutesByBuilding', error);
  return count || 0;
}

/* ---- steps ---- */
async function adminListSteps(routeId) {
  const n = Number(routeId); if (!Number.isInteger(n) || n < 1) return [];
  const sb = getSupabaseClient();
  const { data, error } = await sb.from('campus_route_steps').select(STEP_COLUMNS)
    .eq('route_id', n).order('step_order', { ascending: true });
  if (error) throw fail('adminListSteps', error);
  return (data || []).map(shapeStep);
}
async function adminReplaceSteps(routeId, steps) {
  const sb = getSupabaseClient();
  const p_steps = (steps || []).map((s) => ({
    step_order: s.step_order, instruction: s.instruction, landmark: s.landmark, lat: s.lat, lng: s.lng
  }));
  const { data, error } = await sb.rpc('app_replace_route_steps', { p_route_id: Number(routeId), p_steps });
  if (error) throw fail('adminReplaceSteps', error);
  const val = Array.isArray(data) ? (data[0] != null ? data[0] : 0) : (data != null ? data : 0);
  return Number(val) || 0;
}

/* ---- nodes ---- */
async function adminListNodes() {
  const sb = getSupabaseClient();
  const { data, error } = await sb.from('route_nodes').select(NODE_COLUMNS + ', display_order')
    .order('display_order', { ascending: true }).order('id', { ascending: true });
  if (error) throw fail('adminListNodes', error);
  return (data || []).map(shapeNode);
}
async function adminGetNode(id) {
  const n = Number(id); if (!Number.isInteger(n) || n < 1) return null;
  const sb = getSupabaseClient();
  const { data, error } = await sb.from('route_nodes').select(NODE_COLUMNS + ', display_order').eq('id', n).maybeSingle();
  if (error) throw fail('adminGetNode', error);
  return shapeNode(data);
}
async function adminFindNodeIdByKey(nodeKey, excludeId) {
  const k = String(nodeKey == null ? '' : nodeKey).trim();
  if (k === '') return null;
  const sb = getSupabaseClient();
  let q = sb.from('route_nodes').select('id').eq('node_key', k);
  const ex = Number(excludeId);
  if (Number.isInteger(ex) && ex > 0) q = q.neq('id', ex);
  const { data, error } = await q.maybeSingle();
  if (error) throw fail('adminFindNodeIdByKey', error);
  return data ? toIdOrNull(data.id) : null;
}
async function adminNodeReferences(id) {
  const sb = getSupabaseClient();
  const n = Number(id);
  const r1 = await sb.from('route_edges').select('id', { count: 'exact', head: true }).eq('from_node_id', n);
  if (r1.error) throw fail('adminNodeReferences', r1.error);
  const r2 = await sb.from('route_edges').select('id', { count: 'exact', head: true }).eq('to_node_id', n);
  if (r2.error) throw fail('adminNodeReferences', r2.error);
  const r3 = await sb.from('vr_scenes').select('id', { count: 'exact', head: true }).eq('node_id', n);
  if (r3.error) throw fail('adminNodeReferences', r3.error);
  return { edges: (r1.count || 0) + (r2.count || 0), scenes: r3.count || 0 };
}
async function adminCreateNode(p) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.rpc('app_create_route_node', {
    p_node_key: p.node_key, p_label: p.label, p_node_type: p.node_type,
    p_building_id: p.building_id, p_lat: p.lat, p_lng: p.lng, p_display_order: p.display_order
  });
  if (error) throw fail('adminCreateNode', error);
  return shapeNode(Array.isArray(data) ? data[0] : data);
}
async function adminUpdateNode(id, p) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.rpc('app_update_route_node', {
    p_id: Number(id), p_node_key: p.node_key, p_label: p.label, p_node_type: p.node_type,
    p_building_id: p.building_id, p_lat: p.lat, p_lng: p.lng, p_display_order: p.display_order
  });
  if (error) throw fail('adminUpdateNode', error);
  const row = Array.isArray(data) ? (data[0] || null) : (data || null);
  return shapeNode(row);
}
async function adminDeleteNode(id) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.rpc('app_delete_route_node', { p_id: Number(id) });
  if (error) throw fail('adminDeleteNode', error); // raises NODE_REFERENCED -> mapped to 409
  const val = Array.isArray(data) ? (data[0] != null ? data[0] : null) : (data != null ? data : null);
  return val == null ? null : toIdOrNull(val);
}

/* ---- edges ---- */
async function adminListEdges() {
  const sb = getSupabaseClient();
  const { data, error } = await sb.from('route_edges').select(ADMIN_EDGE_COLUMNS)
    .order('from_node_id', { ascending: true }).order('to_node_id', { ascending: true });
  if (error) throw fail('adminListEdges', error);
  const nodeMap = await loadNodeMap(sb, 'adminListEdges');
  return (data || []).map((e) => shapeEdge(e, nodeMap));
}
async function adminGetEdge(id) {
  const n = Number(id); if (!Number.isInteger(n) || n < 1) return null;
  const sb = getSupabaseClient();
  const { data, error } = await sb.from('route_edges').select(ADMIN_EDGE_COLUMNS).eq('id', n).maybeSingle();
  if (error) throw fail('adminGetEdge', error);
  if (!data) return null;
  const nodeMap = await loadNodeMap(sb, 'adminGetEdge');
  return shapeEdge(data, nodeMap);
}
async function adminFindEdgeIdByPair(fromId, toId, excludeId) {
  const f = Number(fromId), t = Number(toId);
  if (!Number.isInteger(f) || !Number.isInteger(t)) return null;
  const sb = getSupabaseClient();
  let q = sb.from('route_edges').select('id').eq('from_node_id', f).eq('to_node_id', t);
  const ex = Number(excludeId);
  if (Number.isInteger(ex) && ex > 0) q = q.neq('id', ex);
  const { data, error } = await q.maybeSingle();
  if (error) throw fail('adminFindEdgeIdByPair', error);
  return data ? toIdOrNull(data.id) : null;
}
async function adminCreateEdge(p) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.from('route_edges').insert({
    from_node_id: p.from_node_id, to_node_id: p.to_node_id,
    distance_meters: p.distance_meters, walk_time_seconds: p.walk_time_seconds,
    path_label: p.path_label, is_accessible: !!p.is_accessible
  }).select(ADMIN_EDGE_COLUMNS).single();
  if (error) throw fail('adminCreateEdge', error);
  const nodeMap = await loadNodeMap(sb, 'adminCreateEdge');
  return shapeEdge(data, nodeMap);
}
async function adminUpdateEdge(id, p) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.from('route_edges').update({
    from_node_id: p.from_node_id, to_node_id: p.to_node_id,
    distance_meters: p.distance_meters, walk_time_seconds: p.walk_time_seconds,
    path_label: p.path_label, is_accessible: !!p.is_accessible
  }).eq('id', id).select(ADMIN_EDGE_COLUMNS).maybeSingle();
  if (error) throw fail('adminUpdateEdge', error);
  if (!data) return null;
  const nodeMap = await loadNodeMap(sb, 'adminUpdateEdge');
  return shapeEdge(data, nodeMap);
}
async function adminDeleteEdge(id) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.from('route_edges').delete().eq('id', id).select('id').maybeSingle();
  if (error) throw fail('adminDeleteEdge', error);
  return data ? toIdOrNull(data.id) : null;
}

/* ---- RF.4: admin geometry editor (Supabase) ---- */

// Single edge PLUS its stored path_geometry and endpoint node coordinates,
// shaped for the geometry editor (RF.4 decision 2). path_geometry is passed
// through verbatim (parsed jsonb array or null) for utils/routeGeometry
// normalization in the controller. The geometry-free adminListEdges/adminGetEdge
// and ADMIN_EDGE_COLUMNS are untouched, so list responses stay geometry-free.
async function adminGetEdgeWithGeometry(id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) return null;
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('route_edges')
    .select('id, from_node_id, to_node_id, distance_meters, walk_time_seconds, path_label, is_accessible, path_geometry')
    .eq('id', n)
    .maybeSingle();
  if (error) throw fail('adminGetEdgeWithGeometry', error);
  if (!data) return null;
  const fromId = toIdOrNull(data.from_node_id);
  const toId = toIdOrNull(data.to_node_id);
  const { data: nodeRows, error: nErr } = await sb
    .from('route_nodes')
    .select('id, node_key, label, lat, lng')
    .in('id', [fromId, toId]);
  if (nErr) throw fail('adminGetEdgeWithGeometry', nErr);
  const byId = new Map((nodeRows || []).map((r) => [toIdOrNull(r.id), r]));
  const f = byId.get(fromId) || {};
  const t = byId.get(toId) || {};
  return {
    id: toIdOrNull(data.id),
    from_node_id: fromId, to_node_id: toId,
    distance_meters: Number(data.distance_meters) || 0,
    walk_time_seconds: Number(data.walk_time_seconds) || 0,
    path_label: data.path_label != null ? data.path_label : null,
    is_accessible: (data.is_accessible === true || data.is_accessible === 1 || data.is_accessible === '1'),
    from_node_key: f.node_key || null, from_label: f.label || null,
    from_lat: toNumOrNull(f.lat), from_lng: toNumOrNull(f.lng),
    to_node_key: t.node_key || null, to_label: t.label || null,
    to_lat: toNumOrNull(t.lat), to_lng: toNumOrNull(t.lng),
    path_geometry: data.path_geometry !== undefined ? data.path_geometry : null
  };
}

// Historical atomic forward+reverse geometry write via the service-role RPC
// from migration 0016. Kept for compatibility with old migration tooling; the
// admin editor now uses adminSetEdgeGeometry() below so each direction is
// independently editable.
async function adminSetEdgeGeometryPair(fromNodeId, toNodeId, geometryOrNull) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.rpc('app_set_route_edge_geometry_pair', {
    p_from_node_id: Number(fromNodeId),
    p_to_node_id: Number(toNodeId),
    p_geometry: geometryOrNull
  });
  if (error) throw fail('adminSetEdgeGeometryPair', error);
  const val = Array.isArray(data) ? (data[0] != null ? data[0] : 0) : (data != null ? data : 0);
  return Number(val) || 0;
}

// Directional geometry write for the exit-route editor. Unlike the historical
// pair RPC above, this updates only the selected directed route_edges row, so
// an administrator can draw a different path and enter different metrics for
// the reverse journey. The function is service-role-only and is supplied by
// Supabase migration 0023.
async function adminSetEdgeGeometry(edgeId, geometryOrNull) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.rpc('app_set_route_edge_geometry_one_way', {
    p_edge_id: Number(edgeId),
    p_geometry: geometryOrNull
  });
  if (error) throw fail('adminSetEdgeGeometry', error);
  const val = Array.isArray(data) ? (data[0] != null ? data[0] : 0) : (data != null ? data : 0);
  return Number(val) || 0;
}

// True when any directed edge touching this node stores non-null geometry.
// Backs the node-move guard (RF.4 decision 12): a coordinate change is
// rejected 409 while attached geometry exists. Server-only, read-only.
async function adminNodeHasAttachedGeometry(id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) return false;
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('route_edges')
    .select('id, from_node_id, to_node_id, path_geometry')
    .or(`from_node_id.eq.${n},to_node_id.eq.${n}`)
    .not('path_geometry', 'is', null)
    .limit(1);
  if (error) throw fail('adminNodeHasAttachedGeometry', error);
  return Array.isArray(data) && data.length > 0;
}

module.exports = {
  listRouteSummaries,
  attachStepsToRoutes,
  getRouteWithSteps,
  listAllNodes,
  listAllEdges,
  listAllEdgesWithGeometry,
  listRouteSourceBuildings,
  findRouteSourceBuildingById,
  searchRoutes,
  listVrRouteIdByBuilding,
  invalidateSearchRead,
  // admin route/graph (Section 7.9)
  adminBuildingExists,
  adminRouteExists,
  adminNodeExists,
  adminEdgeExists,
  adminListRoutes,
  adminGetRoute,
  adminFindRouteIdByTitle,
  adminCreateRoute,
  adminUpdateRoute,
  adminDeleteRoute,
  adminCountRoutesByBuilding,
  adminListSteps,
  adminReplaceSteps,
  adminListNodes,
  adminGetNode,
  adminFindNodeIdByKey,
  adminNodeReferences,
  adminCreateNode,
  adminUpdateNode,
  adminDeleteNode,
  adminListEdges,
  adminGetEdge,
  adminGetEdgeWithGeometry,
  adminSetEdgeGeometry,
  adminSetEdgeGeometryPair,
  adminNodeHasAttachedGeometry,
  adminFindEdgeIdByPair,
  adminCreateEdge,
  adminUpdateEdge,
  adminDeleteEdge
};
