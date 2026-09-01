/* ========================================
   CampuSphere - Map Controller
   Handles the Campus Map page
   ======================================== */

const db = require('../config/db');
const { normalizeBuildingRow, normalizeBuildingRows } = require('../utils/buildingData');
const { findShortestPath } = require('../utils/pathfinding');
const mapRuntime = require('../config/mapRuntime');
const buildingRepository = require('../repositories/buildingRepository');
const routeRepository = require('../repositories/routeRepository');
const { logServerError } = require('../utils/serverLog');
const { assembleRouteGeometry } = require('../utils/routeGeometry');
const routeAvailability = require('../services/routeAvailability');
const { GUIDED_VR_ROUTES, DEFERRED_GUIDED_VR_DESTINATIONS } = require('../config/guidedVrRoutes');
const { resolveGuidedDestinationPolicyByName } = require('../services/guidedVrResolution');

const MAX_QUERY_LEN = 100;
const MAX_RESULTS = 25;

function toNumOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function searchResultRank(result, needle) {
  const name = (result.building && result.building.name ? result.building.name : '').toLowerCase();
  const routeTitle = (result.route && result.route.title ? result.route.title : '').toLowerCase();

  if (result.type === 'building') {
    if (result.matchedOn === 'name') return name.startsWith(needle) ? 10 : 20;
    if (result.matchedOn === 'category') return 40;
    if (result.matchedOn === 'description') return 50;
    return 70;
  }

  if (result.type === 'route') {
    if (result.matchedOn === 'route_title') return routeTitle.startsWith(needle) ? 25 : 30;
    if (result.matchedOn === 'route_destination') return name.startsWith(needle) ? 35 : 45;
    if (result.matchedOn === 'route_start') return 55;
    return 60;
  }

  return 90;
}

function searchResultLabel(result) {
  if (result.type === 'route' && result.route) return result.route.title || '';
  return result.building && result.building.name ? result.building.name : '';
}

async function fetchRouteSummaries(filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.start) {
    clauses.push('r.start_label LIKE ?');
    params.push(`%${filters.start}%`);
  }
  if (filters.destinationId != null) {
    clauses.push('r.destination_building_id = ?');
    params.push(filters.destinationId);
  } else if (filters.destinationName) {
    clauses.push('b.name LIKE ?');
    params.push(`%${filters.destinationName}%`);
  }
  if (filters.id != null) {
    clauses.push('r.id = ?');
    params.push(filters.id);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT r.id            AS route_id,
            r.title         AS title,
            r.start_label   AS start_label,
            r.estimated_walk_time,
            b.id            AS destination_id,
            b.name          AS destination_name,
            b.category      AS destination_category,
            b.lat           AS destination_lat,
            b.lng           AS destination_lng
       FROM campus_routes r
       JOIN buildings b ON b.id = r.destination_building_id
       ${where}
      ORDER BY r.title ASC`,
    params
  );

  return rows.map(r => ({
    id: r.route_id,
    title: r.title,
    start_label: r.start_label,
    estimated_walk_time: r.estimated_walk_time,
    destination: {
      id: r.destination_id,
      name: r.destination_name,
      category: r.destination_category,
      lat: toNumOrNull(r.destination_lat),
      lng: toNumOrNull(r.destination_lng)
    }
  }));
}

async function attachStepsToRoutes(routes) {
  if (routes.length === 0) return routes;
  const ids = routes.map(r => r.id);
  const [stepRows] = await db.query(
    `SELECT route_id, step_order, instruction, landmark, lat, lng
       FROM campus_route_steps
      WHERE route_id IN (?)
      ORDER BY route_id ASC, step_order ASC`,
    [ids]
  );

  const byRoute = new Map();
  for (const s of stepRows) {
    if (!byRoute.has(s.route_id)) byRoute.set(s.route_id, []);
    byRoute.get(s.route_id).push({
      step_order: s.step_order,
      instruction: s.instruction,
      landmark: s.landmark,
      lat: toNumOrNull(s.lat),
      lng: toNumOrNull(s.lng)
    });
  }
  for (const r of routes) {
    r.steps = byRoute.get(r.id) || [];
    r.landmarks = Array.from(new Set(r.steps.map(s => s.landmark).filter(Boolean)));
  }
  return routes;
}

/**
 * GET /map - Interactive Campus Map
 */
exports.index = async (req, res) => {
  try {
    // Building preload routes through the repository only when
    // BUILDING_DATA_SOURCE=supabase; otherwise the existing MySQL path runs
    // unchanged. Route/search/pathfinding reads below stay on MySQL until the
    // dedicated route migration (Section 3.9).
    // Building rows come from BUILDING_DATA_SOURCE. Route availability + the VR
    // decoration come from ROUTE_DATA_SOURCE and are joined by canonical name
    // (BE.3): the switches are independent and their building ids do NOT match.
    const rows = mapRuntime.isBuildingSupabase()
      ? await buildingRepository.listAll()
      : (await db.query('SELECT * FROM buildings ORDER BY id ASC'))[0];
    const buildings = normalizeBuildingRows(rows);

    // Unavailable buildings remain on the map as campus information; the view
    // marks their pin/panel and disables Set as Destination / Set VR Route.
    const decorated = await routeAvailability.decorateBuildings(buildings);
    if (!decorated.ok) logServerError('map.index.routeAvailability', req);

    res.render('map', {
      title: 'CampuSphere | Campus Map',
      description: 'Navigate the CSPC campus with our interactive map.',
      activeTab: 'tabMap',
      buildings: decorated.buildings,
      mapRenderer: mapRuntime.getMapRenderer()
    });
  } catch (err) {
    logServerError('map.index', req);
    res.render('map', {
      title: 'CampuSphere | Campus Map',
      description: 'Navigate the CSPC campus with our interactive map.',
      activeTab: 'tabMap',
      buildings: [],
      mapRenderer: mapRuntime.getMapRenderer()
    });
  }
};

/**
 * GET /api/search?q=...
 * Logged-in campus search across buildings (name, category, description,
 * details JSON: info/floors/entrances/landmarks) and routes
 * (title, start label, destination, step landmarks/instructions).
 *
 * Returns normalized results carrying the building each hit maps to,
 * so the map page can open the correct building details panel.
 */
exports.apiSearch = async (req, res) => {
  const raw = String(req.query.q || '').trim();
  if (!raw) {
    return res.json({ success: true, query: '', results: [] });
  }
  if (raw.length > MAX_QUERY_LEN) {
    return res.status(400).json({ success: false, message: 'Query too long.' });
  }

  const term = `%${raw}%`;
  const needle = raw.toLowerCase();

  try {
    // BUILDING hits come from BUILDING_DATA_SOURCE; ROUTE hits come from
    // ROUTE_DATA_SOURCE. These switches are INDEPENDENT. Previously BOTH sides
    // were selected with isRouteSupabase(), so in a mixed configuration the
    // building hits were read from the route backend and their ids — which are
    // backend-local — were emitted as `building.id`. The browser then opened a
    // panel for whatever building happened to own that id in the OTHER backend.
    let rosterRows = null;
    let buildingRows;
    if (mapRuntime.isBuildingSupabase()) {
      // The Supabase building search is an in-memory filter over the same
      // roster needed below to remap route hits. Reuse that one active read
      // instead of fetching the full building list twice per search request.
      const buildingSearch = await buildingRepository.searchWithRoster(raw, { limit: MAX_RESULTS });
      buildingRows = buildingSearch.matches;
      rosterRows = buildingSearch.roster;
    } else {
      buildingRows = (await db.query(
        `SELECT *
           FROM buildings
          WHERE name LIKE ?
             OR category LIKE ?
             OR description LIKE ?
             OR JSON_SEARCH(details, 'one', ?) IS NOT NULL
          ORDER BY name ASC
          LIMIT ?`,
        [term, term, term, term, MAX_RESULTS]
      ))[0];
    }

    const routeRows = mapRuntime.isRouteSupabase()
      ? await routeRepository.searchRoutes(raw, { limit: MAX_RESULTS })
      : (await db.query(
        `SELECT r.id            AS route_id,
                r.title         AS route_title,
                r.start_label   AS route_start,
                r.estimated_walk_time,
                b.id            AS building_id,
                b.name          AS building_name,
                b.category      AS building_category,
                b.description   AS building_description,
                b.lat           AS building_lat,
                b.lng           AS building_lng,
                b.details       AS building_details
           FROM campus_routes r
           JOIN buildings b ON b.id = r.destination_building_id
          WHERE r.title LIKE ?
             OR r.start_label LIKE ?
             OR b.name LIKE ?
             OR EXISTS (
                SELECT 1 FROM campus_route_steps s
                 WHERE s.route_id = r.id
                   AND (s.landmark LIKE ? OR s.instruction LIKE ?)
             )
          ORDER BY r.title ASC
          LIMIT ?`,
        [term, term, term, term, term, MAX_RESULTS]
      ))[0];

    // A route hit's joined building row belongs to the ROUTE source. To hand the
    // browser an actionable result we must re-resolve it to the ONE building-source
    // row with the same canonical name. Load the active building-source roster once.
    if (rosterRows === null) {
      rosterRows = (await db.query('SELECT * FROM buildings'))[0];
    }
    const rosterByCanonical = new Map();
    for (const r of (rosterRows || [])) {
      const k = routeAvailability.canonicalKey(r.name);
      if (k === '') continue;
      if (!rosterByCanonical.has(k)) rosterByCanonical.set(k, []);
      rosterByCanonical.get(k).push(r);
    }

    const results = [];
    const seenRoutes = new Set();

    for (const row of buildingRows) {
      const b = normalizeBuildingRow(row);
      const matchedOn =
        b.name.toLowerCase().includes(needle)            ? 'name' :
        (b.category || '').toLowerCase().includes(needle) ? 'category' :
        (b.description || '').toLowerCase().includes(needle) ? 'description' :
        'details';
      results.push({ type: 'building', matchedOn, building: b });
    }

    for (const row of routeRows) {
      if (seenRoutes.has(row.route_id)) continue;
      seenRoutes.add(row.route_id);

      // Remap the route hit's destination onto the BUILDING source by canonical
      // name. Exactly one match is required: zero means the browser has no row to
      // open, and more than one is ambiguous. Either way the actionable route hit
      // is OMITTED rather than pointing at a guessed or foreign-backend row.
      const hits = rosterByCanonical.get(routeAvailability.canonicalKey(row.building_name)) || [];
      if (hits.length !== 1) continue;
      const b = normalizeBuildingRow(hits[0]);

      const matchedOn =
        (row.route_title || '').toLowerCase().includes(needle) ? 'route_title' :
        (row.route_start || '').toLowerCase().includes(needle) ? 'route_start' :
        b.name.toLowerCase().includes(needle)                  ? 'route_destination' :
        'route_landmark';

      results.push({
        type: 'route',
        matchedOn,
        // building.id is ALWAYS a BUILDING_DATA_SOURCE id.
        building: b,
        route: {
          id: row.route_id,
          title: row.route_title,
          start_label: row.route_start,
          estimated_walk_time: row.estimated_walk_time
          // destination_building_id intentionally NOT exposed: it is a route-source
          // id and must never be mistaken for a building-source id. The decorated
          // building carries route_destination_id for that purpose.
        }
      });
    }

    results.sort((a, b) => {
      const rankDelta = searchResultRank(a, needle) - searchResultRank(b, needle);
      if (rankDelta !== 0) return rankDelta;
      return searchResultLabel(a).localeCompare(searchResultLabel(b));
    });

    const top = results.slice(0, MAX_RESULTS);
    // BE.3: every search hit carries a building the map can open a panel for, so
    // each one gets the SAME decorated shape as /map and /api/buildings. Without
    // this, a search result could still offer a destination action for a building
    // whose route does not exist.
    const decorated = await routeAvailability.decorateBuildings(
      top.map((r) => r.building).filter(Boolean)
    );
    if (!decorated.ok) logServerError('map.search.routeAvailability', req);

    res.json({ success: true, query: raw, results: top });
  } catch (err) {
    logServerError('map.search', req);
    res.status(500).json({ success: false, message: 'Search failed' });
  }
};

/**
 * GET /api/routes
 * Without params: returns route summaries (no steps).
 * With `destination` (building id or name) and optional `start`:
 *   returns matching routes with ordered steps and landmark list.
 * Always returns `routes: []` shape; empty array + message when no match.
 */
exports.apiListRoutes = async (req, res) => {
  try {
    const filters = {};
    const start = String(req.query.start || '').trim();
    if (start) filters.start = start;

    const destinationRaw = String(req.query.destination || '').trim();
    if (destinationRaw) {
      if (/^\d+$/.test(destinationRaw)) {
        filters.destinationId = parseInt(destinationRaw, 10);
      } else {
        filters.destinationName = destinationRaw;
      }
    }

    const useSupabase = mapRuntime.isRouteSupabase();
    const routes = useSupabase
      ? await routeRepository.listRouteSummaries(filters)
      : await fetchRouteSummaries(filters);

    if (destinationRaw) {
      if (useSupabase) {
        await routeRepository.attachStepsToRoutes(routes);
      } else {
        await attachStepsToRoutes(routes);
      }
      const payload = { success: true, routes };
      if (routes.length === 0) {
        payload.message =
          `No predefined route available${start ? ` from "${start}"` : ''} ` +
          `to "${destinationRaw}" yet.`;
      }
      return res.json(payload);
    }

    res.json({ success: true, routes });
  } catch (err) {
    logServerError('map.routes', req);
    res.status(500).json({ success: false, message: 'Unable to load routes' });
  }
};

/**
 * GET /api/routes/:id - full route with ordered steps + landmarks.
 */
exports.apiGetRoute = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ success: false, message: 'Invalid route id' });
    }

    // The controller owns the parseInt compatibility contract (e.g.
    // /api/routes/1.5 resolves to id 1). The parsed integer is what reaches
    // either backend, so the repository never sees the raw float.
    if (mapRuntime.isRouteSupabase()) {
      const route = await routeRepository.getRouteWithSteps(id);
      if (!route) {
        return res.json({ success: true, route: null, message: 'Route not found.' });
      }
      return res.json({ success: true, route });
    }

    const routes = await fetchRouteSummaries({ id });
    if (routes.length === 0) {
      return res.json({ success: true, route: null, message: 'Route not found.' });
    }
    await attachStepsToRoutes(routes);
    res.json({ success: true, route: routes[0] });
  } catch (err) {
    logServerError('map.routeById', req);
    res.status(500).json({ success: false, message: 'Unable to load route' });
  }
};

/**
 * Format a total walk time (seconds) into a friendly range string.
 */
function formatWalkTime(seconds) {
  const secs = Number(seconds);
  if (!Number.isFinite(secs) || secs <= 0) return 'Less than a minute';
  const minutes = secs / 60;
  if (minutes < 1) return 'Less than a minute';
  const lo = Math.floor(minutes);
  const hi = Math.ceil(minutes);
  if (lo === hi) return `${lo} minute${lo === 1 ? '' : 's'}`;
  return `${lo}-${hi} minutes`;
}

/**
 * GET /api/pathfind
 *   ?start=<node_key>
 *   &destinationNodeKey=<node_key>      (resolved first if present)
 *   &destinationBuildingId=<building id> (fallback)
 *
 * Computes a Dijkstra shortest path over route_nodes/route_edges.
 * - Missing/invalid params -> 400 JSON.
 * - Unknown start/destination -> 404 JSON { success:false }.
 * - Graph not seeded or no path between known points ->
 *   200 JSON { success:true, route:null, message }.
 * Errors are logged server-side; no stack trace is sent to the client.
 */
exports.apiPathfind = async (req, res) => {
  try {
    const start = String(req.query.start || '').trim();
    const destinationNodeKey = String(req.query.destinationNodeKey || '').trim();
    const destinationBuildingIdRaw = String(req.query.destinationBuildingId || '').trim();

    if (!start) {
      return res.status(400).json({ success: false, message: 'Query parameter "start" is required.' });
    }
    if (!destinationNodeKey && !destinationBuildingIdRaw) {
      return res.status(400).json({
        success: false,
        message: 'Provide "destinationNodeKey" or "destinationBuildingId".'
      });
    }
    if (start.length > MAX_QUERY_LEN || destinationNodeKey.length > MAX_QUERY_LEN) {
      return res.status(400).json({ success: false, message: 'Parameter too long.' });
    }

    let destinationBuildingId = null;
    if (!destinationNodeKey) {
      if (!/^\d+$/.test(destinationBuildingIdRaw)) {
        return res.status(400).json({ success: false, message: 'Invalid "destinationBuildingId".' });
      }
      destinationBuildingId = parseInt(destinationBuildingIdRaw, 10);
      if (!Number.isFinite(destinationBuildingId) || destinationBuildingId < 1) {
        return res.status(400).json({ success: false, message: 'Invalid "destinationBuildingId".' });
      }
    }

    // Graph reads come from the route repository in ROUTE_DATA_SOURCE=supabase
    // mode; MySQL mode keeps the direct queries. Both yield the same row field
    // names, so the node/edge mapping below (and utils/pathfinding.js) is
    // unchanged. route_edges stay DIRECTED in both modes — no reverse synthesis.
    const useSupabase = mapRuntime.isRouteSupabase();

    let nodeRows;
    if (useSupabase) {
      nodeRows = await routeRepository.listAllNodes();
    } else {
      [nodeRows] = await db.query(
        'SELECT id, node_key, label, node_type, building_id, lat, lng FROM route_nodes'
      );
    }
    if (nodeRows.length === 0) {
      return res.json({
        success: true,
        route: null,
        message: 'Route graph is not available yet.'
      });
    }

    let edgeRows;
    if (useSupabase) {
      // RF.3: geometry-enabled read for the drawing assembly below. VR and
      // every other caller keep the geometry-free listAllEdges().
      edgeRows = await routeRepository.listAllEdgesWithGeometry();
    } else {
      [edgeRows] = await db.query(
        `SELECT from_node_id, to_node_id, distance_meters,
                walk_time_seconds, path_label, is_accessible, path_geometry
           FROM route_edges`
      );
    }

    const nodeByKey = new Map();
    const idToKey = new Map();
    const nodes = nodeRows.map((r) => {
      const node = {
        id: r.id,
        key: r.node_key,
        label: r.label,
        node_type: r.node_type,
        building_id: r.building_id != null ? Number(r.building_id) : null,
        lat: toNumOrNull(r.lat),
        lng: toNumOrNull(r.lng)
      };
      nodeByKey.set(node.key, node);
      idToKey.set(r.id, node.key);
      return node;
    });

    // RF.3: stash raw stored drawing geometry per directed edge key. The
    // pathfinding input below stays byte-compatible (no geometry field), so
    // Dijkstra weights, accessibility filtering, the winning path, distances,
    // walk times, and segment order are untouched.
    const edgeGeometryByKey = new Map();
    const edges = edgeRows.map((e) => {
      const fromKey = idToKey.get(e.from_node_id);
      const toKey = idToKey.get(e.to_node_id);
      if (fromKey && toKey) {
        edgeGeometryByKey.set(
          fromKey + '|' + toKey,
          e.path_geometry !== undefined ? e.path_geometry : null
        );
      }
      return {
        from: fromKey,
        to: toKey,
        distance_meters: Number(e.distance_meters) || 0,
        walk_time_seconds: Number(e.walk_time_seconds) || 0,
        path_label: e.path_label != null ? e.path_label : null,
        is_accessible: Number(e.is_accessible)
      };
    });

    // Resolve start node.
    const startNode = nodeByKey.get(start);
    if (!startNode) {
      return res.status(404).json({
        success: false,
        message: `Unknown start point "${start}".`
      });
    }

    // Resolve destination node: node key takes precedence, then building id.
    let destNode = null;
    if (destinationNodeKey) {
      destNode = nodeByKey.get(destinationNodeKey) || null;
      if (!destNode) {
        return res.status(404).json({
          success: false,
          message: `Unknown destination "${destinationNodeKey}".`
        });
      }
    } else {
      // Catalog destinations resolve through their configured natural node key,
      // never whichever sibling node happens to be returned first for a shared
      // building_id. Resolve the building name inside this same route backend;
      // backend-local numeric ids never cross sources.
      let destinationBuilding = null;
      if (useSupabase) {
        destinationBuilding = await routeRepository.findRouteSourceBuildingById(destinationBuildingId);
      } else {
        const [buildingRows] = await db.query(
          'SELECT id, name FROM buildings WHERE id = ? LIMIT 1',
          [destinationBuildingId]
        );
        destinationBuilding = buildingRows[0] || null;
      }
      const guidedPolicy = destinationBuilding
        ? resolveGuidedDestinationPolicyByName({
            destinationName: destinationBuilding.name,
            activeRoutes: GUIDED_VR_ROUTES,
            deferredDestinations: DEFERRED_GUIDED_VR_DESTINATIONS,
            canonicalize: routeAvailability.canonicalKey
          })
        : { kind: 'none' };
      if (guidedPolicy.kind === 'active') {
        const matches = nodes.filter((node) =>
          node.key === guidedPolicy.route.destination_node_key &&
          node.building_id === destinationBuildingId);
        destNode = matches.length === 1 ? matches[0] : null;
      } else if (guidedPolicy.kind === 'invalid') {
        destNode = null;
      } else {
        const matches = nodes.filter((n) => n.building_id === destinationBuildingId);
        // Generic/deferred routes retain the local graph mapping.
        destNode = matches.find((n) => n.node_type === 'building') || matches[0] || null;
      }
      if (!destNode) {
        return res.status(404).json({
          success: false,
          message: `No route node maps to building id ${destinationBuildingId}.`
        });
      }
    }

    const result = findShortestPath({
      nodes,
      edges,
      startKey: startNode.key,
      endKey: destNode.key
    });

    if (!result.success) {
      if (result.reason === 'start_not_found') {
        return res.status(404).json({ success: false, message: `Unknown start point "${start}".` });
      }
      if (result.reason === 'destination_not_found') {
        return res.status(404).json({ success: false, message: 'Unknown destination.' });
      }
      // no_route: known endpoints, but the graph has no connecting path.
      return res.json({
        success: true,
        route: null,
        message: 'No route available between the selected points.'
      });
    }

    // RF.3: flattened road-following drawing shape, assembled from the
    // SELECTED edges in traversal order (utils/routeGeometry.js). Missing
    // stored geometry silently falls back to that edge's two node endpoints;
    // malformed / endpoint-invalid stored geometry also falls back but logs
    // ONE fixed sanitized diagnostic per request. route.nodes and
    // route.segments stay byte-compatible; per-segment geometry, validation
    // state, and raw stored payloads are never exposed.
    const assembled = assembleRouteGeometry({
      nodes: result.nodes,
      segments: result.segments,
      edgeGeometryByKey
    });
    if (assembled.invalidEdges > 0 || assembled.incomplete) {
      logServerError('map.pathfind.geometry', req);
    }

    const route = {
      start: { key: startNode.key, label: startNode.label },
      destination: {
        key: destNode.key,
        label: destNode.label,
        buildingId: destNode.building_id
      },
      distance_meters: result.distance_meters,
      walk_time_seconds: result.walk_time_seconds,
      estimated_walk_time: formatWalkTime(result.walk_time_seconds),
      nodes: result.nodes.map((n) => ({
        key: n.key,
        label: n.label,
        lat: n.lat,
        lng: n.lng
      })),
      segments: result.segments,
      geometry: assembled.geometry
    };

    res.json({ success: true, route });
  } catch (err) {
    logServerError('map.pathfind', req);
    res.status(500).json({ success: false, message: 'Unable to compute route' });
  }
};
