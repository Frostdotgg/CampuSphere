/* ========================================
   CampuSphere - VR / 360 Viewer Controller
   Milestone 5, Phase 4 Section 5.

   Two viewers, both DB-backed (vr_scenes /
   vr_hotspots, seeded in Section 4):

   1. Route-based guided viewer (the Section 5
      deliverable): /vr/routes/:routeId and
      /api/vr/routes/:routeId. Resolves a
      campus_routes row to a destination building
      node, runs Dijkstra (utils/pathfinding.js)
      over route_nodes/route_edges from main-gate,
      then produces the guided scene sequence:
      catalog destinations (config/guidedVrRoutes)
      resolve by NATURAL SCENE KEYS in the VR
      source (BE.4); others keep the node/building
      graph mapping when ROUTE and VR sources match.

   2. Scene browser (Free Roam): /vr and
      /vr/:sceneKey. Free navigation by scene_key,
      starting at the Guard House (BE.4).

   Robustness model: scene navigation is always
   rendered server-side as plain links. The seeded
   /img/vr/*.jpg placeholders are intentionally NOT
   shipped in public/img/vr, so resolveSceneImageUrl
   nulls missing local panorama paths server-side -
   the views render their readable fallback directly
   and the browser never requests a known-404 image.
   The views keep their own runtime load-failure
   fallback for images that exist but fail to load.
   ======================================== */

const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { findShortestPath } = require('../utils/pathfinding');
const vrDataSource = require('../config/vrDataSource');
const mapRuntime = require('../config/mapRuntime');
const vrRepository = require('../repositories/vrRepository');
const routeRepository = require('../repositories/routeRepository');
const { logServerError } = require('../utils/serverLog');
const { normalizeMediaUrl } = require('../utils/mediaUrl');
const {
  GUIDED_VR_ROUTES,
  DEFERRED_GUIDED_VR_DESTINATIONS
} = require('../config/guidedVrRoutes');
const { canonicalKey } = require('../services/routeAvailability');
const {
  resolveStartNode,
  resolveGuidedDestinationPolicy,
  isResolvedMediaArrival,
  isSafeSceneKey,
  verifyGuidedChain,
  deriveHotspotNav
} = require('../services/guidedVrResolution');

// Free Roam default (BE.4): /vr with no scene key starts at the Guard House —
// the authoritative campus entry — and /vr/scene-guard-house is the canonical
// Free Roam entry URL the map links to. /vr stays as a compatible fallback.
const DEFAULT_SCENE_KEY = 'scene-guard-house';
const START_NODE_KEY = 'main-gate';

/* ---------------------------------------------------------
   BE.4 source separation: ONE decision per switch per request.
   Route ids, campus_routes, route-source buildings, graph nodes/edges, and
   path metrics follow ROUTE_DATA_SOURCE; VR scenes and hotspots follow
   VR_DATA_SOURCE. Numeric ids from the two sources are never compared —
   cross-source guided walkthroughs use the natural-key catalog below.
--------------------------------------------------------- */
function requestSources() {
  return {
    routeSupabase: mapRuntime.isRouteSupabase(),
    vrSupabase: vrDataSource.isSupabase()
  };
}

/* ---------------------------------------------------------
   VR scene image output guard (pre-11.8C cleanup).
   normalizeMediaUrl (Section 10.4 policy) runs FIRST; a safe
   local same-origin /img/... path is then resolved under the
   repo public/ directory and becomes null when the file does
   not exist (the seeded /img/vr/*.jpg placeholders are
   intentionally absent). A valid Cloudinary delivery URL
   passes through unchanged. Filesystem existence check only —
   no network, no HEAD requests. The policy guarantees the
   local path has no scheme, no '//', and no '..' traversal,
   so the public/ join cannot escape the directory.
--------------------------------------------------------- */
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function resolveSceneImageUrl(raw) {
  const safe = normalizeMediaUrl(raw);
  if (safe === null) return null;
  if (safe.charAt(0) === '/') {
    return fs.existsSync(path.join(PUBLIC_DIR, safe)) ? safe : null;
  }
  return safe;
}

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/* ---------------------------------------------------------
   Shared: resolve a campus route to an ordered VR scene
   sequence using the route graph + pathfinding.
   Returns one of:
     { ok:false, status, reason, message }
     { ok:true, route, path, scenes, distance_meters,
       walk_time_seconds }
   `scenes` may be [] when the path has no VR scenes yet;
   that is still ok:true so callers can show a fallback.
--------------------------------------------------------- */
async function resolveRouteScenes(routeIdRaw, sources) {
  if (!/^\d+$/.test(String(routeIdRaw))) {
    return { ok: false, status: 400, reason: 'invalid_id',
      message: 'Invalid route id.' };
  }
  const routeId = parseInt(routeIdRaw, 10);
  if (!Number.isFinite(routeId) || routeId < 1) {
    return { ok: false, status: 400, reason: 'invalid_id',
      message: 'Invalid route id.' };
  }

  // Resolve the route + its destination building from ROUTE_DATA_SOURCE
  // (campus_routes ids are route-source ids — BE.4). Supabase via
  // routeRepository (INNER-JOIN parity: a route whose destination building is
  // missing is dropped -> treated as not found, exactly like the MySQL JOIN);
  // MySQL via the existing query. destination is reshaped to
  // { id, name, category } only so the guided-route API never exposes
  // destination lat/lng.
  let route;
  if (sources.routeSupabase) {
    const summaries = await routeRepository.listRouteSummaries({ id: routeId });
    const found = summaries.find((s) => Number(s.id) === routeId) || null;
    if (!found) {
      return { ok: false, status: 404, reason: 'route_not_found',
        message: 'That campus route was not found.' };
    }
    const dest = found.destination || {};
    route = {
      id: found.id,
      title: found.title,
      start_label: found.start_label,
      estimated_walk_time: found.estimated_walk_time,
      destination: {
        id: dest.id != null ? dest.id : null,
        name: dest.name != null ? dest.name : null,
        category: dest.category != null ? dest.category : null
      }
    };
  } else {
    const [routeRows] = await db.query(
      `SELECT r.id, r.title, r.start_label, r.estimated_walk_time,
              b.id AS dest_id, b.name AS dest_name, b.category AS dest_category
         FROM campus_routes r
         JOIN buildings b ON b.id = r.destination_building_id
        WHERE r.id = ?`,
      [routeId]
    );
    if (routeRows.length === 0) {
      return { ok: false, status: 404, reason: 'route_not_found',
        message: 'That campus route was not found.' };
    }
    const r = routeRows[0];
    route = {
      id: r.id,
      title: r.title,
      start_label: r.start_label,
      estimated_walk_time: r.estimated_walk_time,
      destination: {
        id: r.dest_id,
        name: r.dest_name,
        category: r.dest_category
      }
    };
  }

  return resolveGraphScenes(route, sources);
}

/* ---------------------------------------------------------
   Shared graph resolver (extracted in Milestone 11, 11.8B):
   takes an already-shaped `route`
   ({ id, title, start_label, estimated_walk_time,
      destination: { id, name, category } }) and resolves the
   main-gate -> destination path + ordered VR scene sequence.
   Used by BOTH the predefined campus_routes flow above and
   the destination-based flow below; the body is unchanged
   from the original resolveRouteScenes graph section.
--------------------------------------------------------- */
async function resolveGraphScenes(route, sources) {
  // Load the route graph (nodes + directed edges) from ROUTE_DATA_SOURCE
  // (BE.4: graph, path, and metrics never come from the VR source).
  // utils/pathfinding.js consumes plain arrays and remains untouched.
  let nodeRows;
  let edgeRows;
  if (sources.routeSupabase) {
    nodeRows = await routeRepository.listAllNodes();
  } else {
    const [rows] = await db.query(
      'SELECT id, node_key, label, node_type, building_id, lat, lng FROM route_nodes'
    );
    nodeRows = rows;
  }
  if (nodeRows.length === 0) {
    return { ok: true, route, path: [], scenes: [],
      distance_meters: 0, walk_time_seconds: 0,
      destination_reached: false };
  }
  if (sources.routeSupabase) {
    edgeRows = await routeRepository.listAllEdges();
  } else {
    const [rows] = await db.query(
      `SELECT from_node_id, to_node_id, distance_meters,
              walk_time_seconds, path_label, is_accessible
         FROM route_edges`
    );
    edgeRows = rows;
  }

  const idToKey = new Map();
  const nodes = nodeRows.map((n) => {
    const node = {
      id: n.id,
      key: n.node_key,
      label: n.label,
      node_type: n.node_type,
      building_id: n.building_id != null ? Number(n.building_id) : null,
      lat: toNum(n.lat, 0),
      lng: toNum(n.lng, 0)
    };
    idToKey.set(n.id, node.key);
    return node;
  });
  const nodeByKey = new Map(nodes.map((n) => [n.key, n]));
  const edges = edgeRows.map((e) => ({
    from: idToKey.get(e.from_node_id),
    to: idToKey.get(e.to_node_id),
    distance_meters: Number(e.distance_meters) || 0,
    walk_time_seconds: Number(e.walk_time_seconds) || 0,
    path_label: e.path_label != null ? e.path_label : null,
    is_accessible: Number(e.is_accessible)
  }));

  // FIX 1 (BE.4 NO-GO repair): fail closed on the route start. The guided
  // walkthrough MUST begin at exactly one node whose node_key is `main-gate`.
  // There is no fallback to another gate node or the first node — a missing or
  // ambiguous start returns an empty, not-arrived result that truthfully
  // reports the Guard House / Main Gate start is unavailable. (Free Roam's
  // /vr/scene-guard-house start is a separate scene-browser concern and is
  // unaffected.)
  const start = resolveStartNode(nodes);
  if (!start.ok) {
    return { ok: true, route, path: [], scenes: [],
      distance_meters: 0, walk_time_seconds: 0,
      reason: 'no_start_node', destination_reached: false };
  }
  const startNode = start.node;

  // Destination node: a node mapped to the route's destination building;
  // prefer the building-type node over service nodes sharing the building.
  const destMatches = nodes.filter((n) => n.building_id === route.destination.id);
  const destNode =
    destMatches.find((n) => n.node_type === 'building') ||
    destMatches[0] ||
    null;

  if (!destNode) {
    return { ok: true, route, path: [], scenes: [],
      distance_meters: 0, walk_time_seconds: 0,
      reason: 'no_dest_node', destination_reached: false };
  }

  const result = findShortestPath({
    nodes,
    edges,
    startKey: startNode.key,
    endKey: destNode.key
  });
  if (!result.success) {
    return { ok: true, route, path: [], scenes: [],
      distance_meters: 0, walk_time_seconds: 0,
      reason: 'no_path', destination_reached: false };
  }

  const pathNodes = result.nodes; // ordered node objects (carry .id/.building_id)

  // BE.4: owner-approved natural-key guided walkthrough. When the catalog
  // (config/guidedVrRoutes.js) defines this destination BY CANONICAL NAME and
  // the route-source destination node matches the catalog's node key, the
  // scene sequence is resolved by stable scene keys in VR_DATA_SOURCE —
  // valid across ANY route/VR source combination because no numeric id ever
  // crosses a backend.
  const guidedPolicy = findGuidedVrPolicy(route.destination.name, destNode.key);
  if (guidedPolicy.kind === 'active') {
    return buildGuidedNaturalKeyScenes({
      route, guided: guidedPolicy.route, pathNodes, result, vrSupabase: sources.vrSupabase
    });
  }
  if (guidedPolicy.kind === 'deferred' || guidedPolicy.kind === 'invalid') {
    return {
      ok: true,
      route,
      path: pathNodes.map((n) => n.key),
      scenes: [],
      distance_meters: result.distance_meters,
      walk_time_seconds: result.walk_time_seconds,
      reason: guidedPolicy.kind === 'deferred' ? 'guided_vr_deferred' : 'guided_policy_invalid',
      destination_reached: false,
      coverage_notice: deferredGuidedVrNotice(route),
      coverage_message: deferredGuidedVrMessage(route)
    };
  }

  // BE.4 fail-closed rule: the legacy numeric graph->scene mapping below
  // compares ROUTE-source node/building ids against VR-source scene rows,
  // which is only meaningful when both switches point at the SAME backend.
  // A mixed configuration without a natural-key definition returns an empty
  // scene list (truthful "no scenes yet" state) instead of comparing
  // backend-local numeric ids.
  if (sources.routeSupabase !== sources.vrSupabase) {
    return { ok: true, route, path: pathNodes.map((n) => n.key), scenes: [],
      distance_meters: result.distance_meters,
      walk_time_seconds: result.walk_time_seconds,
      reason: 'mixed_sources_unmapped', destination_reached: false };
  }

  // Map path nodes to VR scenes by node_id, then by building_id (matched
  // route/VR sources only — see the fail-closed rule above).
  const nodeIds = pathNodes.map((n) => n.id);
  const buildingIds = pathNodes
    .map((n) => n.building_id)
    .filter((v) => v != null);

  // Graph-matched scenes: Supabase via vrRepository (node_id OR building_id IN
  // the sanitized id lists); MySQL via the existing IN-clause query. Both
  // return the same row shape, so the scene mapping + de-duplication below is
  // shared and unchanged.
  let sceneRows = [];
  if (sources.vrSupabase) {
    sceneRows = await vrRepository.listScenesForGraphPath({ nodeIds, buildingIds });
  } else if (nodeIds.length > 0) {
    const params = [nodeIds];
    let where = 'node_id IN (?)';
    if (buildingIds.length > 0) {
      where += ' OR building_id IN (?)';
      params.push(buildingIds);
    }
    const [rows] = await db.query(
      `SELECT id, scene_key, title, description, image_url, node_id,
              building_id, initial_yaw, initial_pitch, display_order
         FROM vr_scenes
        WHERE ${where}`,
      params
    );
    sceneRows = rows;
  }

  const sceneByNodeId = new Map();
  const sceneByBuildingId = new Map();
  for (const s of sceneRows) {
    if (s.node_id != null && !sceneByNodeId.has(s.node_id)) {
      sceneByNodeId.set(s.node_id, s);
    }
    if (s.building_id != null && !sceneByBuildingId.has(s.building_id)) {
      sceneByBuildingId.set(s.building_id, s);
    }
  }

  // Walk the path in order; collect scenes, de-duplicating repeats so a
  // scene shared by adjacent nodes is not shown twice in a row.
  const orderedScenes = [];
  const usedSceneIds = new Set();
  for (const n of pathNodes) {
    let s = sceneByNodeId.get(n.id);
    if (!s && n.building_id != null) s = sceneByBuildingId.get(n.building_id);
    if (s && !usedSceneIds.has(s.id)) {
      usedSceneIds.add(s.id);
      orderedScenes.push({
        id: s.id,
        scene_key: s.scene_key,
        title: s.title,
        description: s.description || '',
        // Section 10.5 + pre-11.8C guard: sanitize the panorama URL at the
        // guided-route source (feeds /vr/routes/:routeId, /api/vr/routes/:routeId,
        // /vr/to/:buildingId, /api/vr/to/:buildingId) so only a safe local /img/
        // path THAT EXISTS under public/ or an https://res.cloudinary.com URL is
        // emitted; unsafe/malformed/missing-file values become null -> readable
        // fallback with no browser request.
        image_url: resolveSceneImageUrl(s.image_url),
        node_key: n.key,
        initial_yaw: toNum(s.initial_yaw, 0),
        initial_pitch: toNum(s.initial_pitch, 0)
      });
    }
  }

  // RF.6 arrival contract. Collecting SOME scenes along the path does not mean
  // the walkthrough reaches the destination: a building with no mapped 360
  // scene (e.g. Engineering) yields a sequence that stops early — historically
  // the viewers then reported "Route complete / You have arrived", which was a
  // lie. Arrival is true ONLY when the LAST collected scene is the scene bound
  // to the destination node itself. Any other state (no destination node, no
  // path, zero scenes, or partial coverage that ends short) is false.
  //
  // This is purely additive: pathfinding, scene ordering, de-duplication,
  // metrics, and the existing reason/error shapes are untouched.
  const lastScene = orderedScenes.length > 0
    ? orderedScenes[orderedScenes.length - 1]
    : null;
  const destinationReached = isResolvedMediaArrival(lastScene, destNode.key);

  return {
    ok: true,
    route,
    path: pathNodes.map((n) => n.key),
    scenes: orderedScenes,
    distance_meters: result.distance_meters,
    walk_time_seconds: result.walk_time_seconds,
    destination_reached: destinationReached
  };
}

/* ---------------------------------------------------------
   RF.6: fixed, sanitized coverage messages for the state where
   VR scenes exist along the path but none is mapped to the
   destination. Only the destination's display name (already
   public in `route.destination.name`) is interpolated — never
   ids, hosts, payloads, or error text.
--------------------------------------------------------- */
function destinationLabel(route) {
  const name = route && route.destination ? route.destination.name : null;
  const trimmed = name != null ? String(name).trim() : '';
  return trimmed !== '' ? trimmed : 'the destination';
}
// Shown on the last AVAILABLE scene in the HTML viewers.
function coverageEndsNotice(route) {
  return `VR coverage ends here. No 360 scene is mapped to ${destinationLabel(route)} yet.`;
}
// Returned alongside a partial (non-empty, not-arrived) JSON payload.
function coverageEndsApiMessage(route) {
  return `VR coverage ends before the destination. No 360 scene is mapped to ${destinationLabel(route)} yet.`;
}

/* ---------------------------------------------------------
   BE.4: fixed sanitized messages for an INCOMPLETE configured panorama
   chain — a natural-key guided walkthrough whose verified prefix stops
   before the approved arrival scene. Only the public destination display
   name is interpolated — never scene keys, ids, backend names, missing-row
   details, or error text.
--------------------------------------------------------- */
function configuredCoverageEndsNotice(route) {
  return `VR coverage ends here before ${destinationLabel(route)}. The remaining panorama sequence is unavailable.`;
}
function configuredCoverageEndsApiMessage(route) {
  return `VR coverage ends before ${destinationLabel(route)}. The remaining panorama sequence is unavailable.`;
}

function deferredGuidedVrNotice(route) {
  return `360-degree guided VR for ${destinationLabel(route)} is not available yet. Campus map directions remain available.`;
}
function deferredGuidedVrMessage(route) {
  return deferredGuidedVrNotice(route);
}

/* ---------------------------------------------------------
   FIX 1 (BE.4 NO-GO repair): fixed sanitized copy for the fail-closed route
   start. Never exposes node keys, ids, or backend details.
--------------------------------------------------------- */
const START_UNAVAILABLE_NOTICE =
  'The Guard House / Main Gate route start is unavailable, so this guided walkthrough cannot begin.';

/* ---------------------------------------------------------
   FIX 3 (BE.4 NO-GO repair): attach a per-hotspot navigation URL derived from
   the hotspot's OWN target_scene_key relative to the current step's
   neighbours. The client viewer and the accessible list both consume each
   hotspot's own nav_url/nav_kind instead of one shared route Next URL.
     - `orderedScenes` is the ordered [{ scene_key, ... }] step list;
     - `step` is 1-based; prev/next scene keys come from adjacent steps;
     - `isFinal` marks the truthful arrival scene (interior explore links).
   Non-scene hotspots (info/exit/schedule) are passed through unchanged with a
   'none' nav so schedule buttons and info tooltips keep working.
--------------------------------------------------------- */
function attachHotspotNav(hotspots, orderedScenes, step, isFinal, prevUrl, nextUrl) {
  const prevSceneKey = step > 1 ? orderedScenes[step - 2].scene_key : null;
  const nextSceneKey = step < orderedScenes.length ? orderedScenes[step].scene_key : null;
  return (hotspots || []).map((h) => {
    if (h.hotspot_type !== 'scene') {
      return { ...h, nav_kind: 'none', nav_url: null };
    }
    const nav = deriveHotspotNav({
      targetKey: h.target_scene_key,
      prevSceneKey,
      nextSceneKey,
      isFinalArrival: isFinal === true,
      prevUrl,
      nextUrl
    });
    return { ...h, nav_kind: nav.kind, nav_url: nav.url };
  });
}

/* ---------------------------------------------------------
   BE.4: natural-key guided walkthrough resolution.

   The owner-approved catalog (config/guidedVrRoutes.js) names an ordered
   panorama chain by STABLE scene keys. Scenes and their directional links
   are read from VR_DATA_SOURCE in two bounded, batched reads (never one
   query per scene) and verified IN CONFIGURED ORDER:

     - every expected scene key must resolve to exactly ONE scene row;
     - every adjacent pair must have exactly ONE forward and ONE reverse
       scene hotspot between the two resolved scenes;
     - links to scenes OUTSIDE the configured chain are Free Roam branches
       and are ignored — the configured order disambiguates the guided path;
     - the first missing/duplicate/unlinked identity stops the sequence
       BEFORE that transition, leaving the verified prefix usable with the
       truthful configured-chain coverage state.

   Arrival is true ONLY when EVERY configured scene was verified and the
   final scene is the catalog's arrival_scene_key — never scenes.length.
   node_key is presentation-only: START_NODE_KEY for the first scene and the
   catalog's destination node key for the verified arrival scene;
   intermediate road panoramas stay null. Nothing here writes node/building
   mappings to database rows.
--------------------------------------------------------- */
function findGuidedVrPolicy(destinationName, destinationNodeKey) {
  return resolveGuidedDestinationPolicy({
    destinationName,
    destinationNodeKey,
    activeRoutes: GUIDED_VR_ROUTES,
    deferredDestinations: DEFERRED_GUIDED_VR_DESTINATIONS,
    canonicalize: canonicalKey
  });
}

async function buildGuidedNaturalKeyScenes({ route, guided, pathNodes, result, vrSupabase }) {
  const keys = guided.scene_keys;

  // Batched scene read by natural keys from VR_DATA_SOURCE.
  let sceneRows;
  if (vrSupabase) {
    sceneRows = await vrRepository.listScenesByKeys(keys);
  } else {
    const [rows] = await db.query(
      `SELECT id, scene_key, title, description, image_url, node_id,
              building_id, initial_yaw, initial_pitch, display_order
         FROM vr_scenes
        WHERE scene_key IN (?)`,
      [Array.from(keys)]
    );
    sceneRows = rows;
  }

  // Unique VR-source scene rows, keyed for the batched link read. A duplicated
  // key is ambiguous; the pure verifier drops it, so it must not be used to
  // build the id list either.
  const sceneByKey = new Map();
  const duplicateKeys = new Set();
  for (const s of sceneRows) {
    if (sceneByKey.has(s.scene_key)) duplicateKeys.add(s.scene_key);
    else sceneByKey.set(s.scene_key, s);
  }

  // Batched directional-link read for the resolved VR-source scene ids.
  const resolvedIds = [...sceneByKey.entries()]
    .filter(([k]) => !duplicateKeys.has(k))
    .map(([, s]) => s.id);
  let linkRows = [];
  if (resolvedIds.length > 0) {
    if (vrSupabase) {
      linkRows = await vrRepository.listSceneLinkHotspots(resolvedIds);
    } else {
      const [rows] = await db.query(
        `SELECT scene_id, target_scene_id, hotspot_type
           FROM vr_hotspots
          WHERE hotspot_type = 'scene' AND scene_id IN (?)`,
        [resolvedIds]
      );
      linkRows = rows;
    }
  }

  // Translate link rows to NATURAL-KEY pairs within this one VR backend (ids
  // are VR-source-local and never cross a backend). Links to scenes outside
  // the configured set resolve to no key and are dropped as Free Roam branches.
  const idToKey = new Map([...sceneByKey.values()].map((s) => [Number(s.id), s.scene_key]));
  const links = [];
  for (const l of linkRows) {
    if (l.target_scene_id == null) continue;
    const fromKey = idToKey.get(Number(l.scene_id));
    const toKey = idToKey.get(Number(l.target_scene_id));
    if (!fromKey || !toKey) continue;
    links.push({ fromKey, toKey });
  }

  // FIX 2 (BE.4 NO-GO repair): the pure, media-aware verifier admits a scene
  // to the prefix only when it resolves uniquely, carries an approved
  // Cloudinary delivery URL, and both directional links to the previous scene
  // resolve exactly once. `complete` requires ALL configured scenes verified
  // and the last verified key to equal the configured arrival scene key.
  const chain = verifyGuidedChain({
    keys,
    arrivalKey: guided.arrival_scene_key,
    scenes: sceneRows,
    links
  });
  const verified = chain.verified;
  const complete = chain.complete;

  const scenes = verified.map((s, idx) => ({
    id: s.id,
    scene_key: s.scene_key,
    title: s.title,
    description: s.description || '',
    // Same output guard as the graph mapping (Section 10.5 + pre-11.8C).
    image_url: resolveSceneImageUrl(s.image_url),
    // Presentation-only derivation (never persisted): the chain starts at
    // the Guard House / Main Gate node and the VERIFIED arrival scene ends
    // at the destination node; intermediate panoramas carry no node mapping.
    node_key: idx === 0
      ? START_NODE_KEY
      : (complete && idx === verified.length - 1 ? guided.destination_node_key : null),
    initial_yaw: toNum(s.initial_yaw, 0),
    initial_pitch: toNum(s.initial_pitch, 0)
  }));

  const resolved = {
    ok: true,
    route,
    path: pathNodes.map((n) => n.key),
    scenes,
    distance_meters: result.distance_meters,
    walk_time_seconds: result.walk_time_seconds,
    destination_reached: complete === true
  };
  if (!complete && scenes.length > 0) {
    resolved.coverage_notice = configuredCoverageEndsNotice(route);
    resolved.coverage_message = configuredCoverageEndsApiMessage(route);
  }
  return resolved;
}

/* ---------------------------------------------------------
   Destination-based guided VR resolution (Milestone 11,
   Section 11.8B): same graph/scene pipeline, but the "route"
   is synthesized from a destination building instead of a
   campus_routes row, so the map's Set VR Route action works
   for any building pin/list/search result without requiring
   a predefined route.
--------------------------------------------------------- */

const START_LABEL = 'Guard House / Main Gate';

// Mirrors formatWalkTime in controllers/mapController.js (returns null instead
// of a "Less than a minute" default when the graph gave no walk time).
function formatWalkTime(seconds) {
  const secs = Number(seconds);
  if (!Number.isFinite(secs) || secs <= 0) return null;
  const minutes = secs / 60;
  if (minutes < 1) return 'Less than a minute';
  const lo = Math.floor(minutes);
  const hi = Math.ceil(minutes);
  if (lo === hi) return `${lo} minute${lo === 1 ? '' : 's'}`;
  return `${lo}-${hi} minutes`;
}

async function resolveDestinationScenes(buildingIdRaw, sources) {
  if (!/^\d+$/.test(String(buildingIdRaw))) {
    return { ok: false, status: 400, reason: 'invalid_id',
      message: 'Invalid building id.' };
  }
  const buildingId = parseInt(buildingIdRaw, 10);
  if (!Number.isFinite(buildingId) || buildingId < 1) {
    return { ok: false, status: 400, reason: 'invalid_id',
      message: 'Invalid building id.' };
  }

  // Destination building from ROUTE_DATA_SOURCE (BE.4): /vr/to/:id accepts
  // the route-source building id the map emits (route_destination_id) —
  // never a BUILDING_DATA_SOURCE id. Only { id, name, category } leave this
  // read; the synthesized route never exposes coordinates or other columns.
  let building = null;
  if (sources.routeSupabase) {
    const row = await routeRepository.findRouteSourceBuildingById(buildingId);
    if (row) {
      building = {
        id: Number(row.id),
        name: row.name,
        category: row.category != null ? row.category : null
      };
    }
  } else {
    const [rows] = await db.query(
      'SELECT id, name, category FROM buildings WHERE id = ? LIMIT 1',
      [buildingId]
    );
    if (rows.length > 0) {
      building = { id: rows[0].id, name: rows[0].name, category: rows[0].category };
    }
  }
  if (!building) {
    return { ok: false, status: 404, reason: 'building_not_found',
      message: 'Building not found.' };
  }

  // Synthesized route: id stays null (no campus_routes row backs this flow);
  // the walk time is filled from the computed graph result below.
  const route = {
    id: null,
    title: `${START_LABEL} to ${building.name}`,
    start_label: START_LABEL,
    estimated_walk_time: null,
    destination: building
  };
  const resolved = await resolveGraphScenes(route, sources);
  if (resolved.ok && resolved.walk_time_seconds > 0) {
    resolved.route.estimated_walk_time = formatWalkTime(resolved.walk_time_seconds);
  }
  return resolved;
}

// Normalise raw hotspot rows (MySQL SQL rows OR vrRepository rows) into the
// exact shape views/vr.ejs and views/vr-route.ejs consume. Shared by the
// MySQL loader below and the Supabase scene-browser branch so both backends
// produce byte-identical hotspot locals. target_scene_id is intentionally
// dropped (the views use target_scene_key / target_title only).
function normalizeHotspots(rows) {
  return (rows || []).map((h) => ({
    hotspot_type: h.hotspot_type || 'info',
    label: h.label || '',
    text: h.text != null ? h.text : null,
    yaw: toNum(h.yaw, 0),
    pitch: toNum(h.pitch, 0),
    // M12.P1-D3: an unsafe/malformed stored target key becomes null BEFORE
    // JSON serialization or fallback-href rendering (same isSafeSceneKey
    // contract the guided resolver enforces); valid keys pass unchanged.
    target_scene_key: isSafeSceneKey(h.target_scene_key) ? h.target_scene_key : null,
    target_title: h.target_title || null,
    schedule_building_id: h.schedule_building_id == null ? null : h.schedule_building_id,
    schedule_location_type: h.schedule_location_type == null ? null : h.schedule_location_type,
    schedule_location_label: h.schedule_location_label == null ? null : h.schedule_location_label,
    schedule_floor_label: h.schedule_floor_label == null ? null : h.schedule_floor_label
  }));
}

// MySQL-backed hotspot loader. It is NOT auto-switched on VR_DATA_SOURCE;
// callers choose the backend explicitly. Both the scene browser
// (exports.viewer) and the guided-route viewer (exports.routeViewer) call this
// on their MySQL branch and use vrRepository.listHotspotsForScene +
// normalizeHotspots on their Supabase branch (Section 5.5).
async function loadSceneHotspots(sceneId) {
  const [rows] = await db.query(
    `SELECT h.hotspot_type, h.label, h.\`text\` AS text, h.yaw, h.pitch,
            h.target_scene_id, t.scene_key AS target_scene_key,
            t.title AS target_title,
            h.schedule_building_id, h.schedule_location_type,
            h.schedule_location_label, h.schedule_floor_label
       FROM vr_hotspots h
       LEFT JOIN vr_scenes t ON t.id = h.target_scene_id
      WHERE h.scene_id = ?
      ORDER BY h.display_order ASC, h.id ASC`,
    [sceneId]
  );
  return normalizeHotspots(rows);
}

/* =========================================================
   Route-based guided VR viewer (Section 5 deliverable).
   GET /vr/routes/:routeId           -> HTML
   GET /api/vr/routes/:routeId       -> JSON
========================================================= */

exports.routeViewer = async (req, res) => {
  const baseLocals = {
    title: 'CampuSphere | VR Route',
    description: 'Guided 360-degree campus route walkthrough for CSPC.',
    activeTab: 'tabMap'
  };

  try {
    // One decision per SOURCE per request (BE.4): route/graph/path reads
    // follow ROUTE_DATA_SOURCE, scene/hotspot reads follow VR_DATA_SOURCE;
    // neither switch is re-read mid-request.
    const sources = requestSources();
    const resolved = await resolveRouteScenes(req.params.routeId, sources);

    if (!resolved.ok) {
      // Invalid id / route not found: still render a usable page.
      return res.status(200).render('vr-route', {
        ...baseLocals,
        route: { id: 0, title: 'VR Route', start_label: '',
          estimated_walk_time: '', destination: { name: 'Unknown' } },
        scene: null,
        scenes: [],
        hotspots: [],
        stepIndex: 0,
        stepCount: 0,
        isFinal: false,
        prevUrl: null,
        nextUrl: null,
        notice: resolved.message || 'This VR route is not available.'
      });
    }

    const { route, scenes } = resolved;

    if (scenes.length === 0) {
      let notice = resolved.coverage_notice || `No VR scenes are available yet for "${route.title}".`;
      if (resolved.reason === 'no_start_node') {
        notice = START_UNAVAILABLE_NOTICE;
      } else if (resolved.reason === 'no_dest_node') {
        notice = `No campus route node maps to ${route.destination.name} yet.`;
      } else if (resolved.reason === 'no_path') {
        notice = `No walkable route to ${route.destination.name} was found.`;
      }
      return res.status(200).render('vr-route', {
        ...baseLocals,
        title: `CampuSphere | ${route.title}`,
        route,
        scene: null,
        scenes: [],
        hotspots: [],
        stepIndex: 0,
        stepCount: 0,
        isFinal: false,
        prevUrl: null,
        nextUrl: null,
        notice
      });
    }

    // Step navigation via ?step (1-based), clamped to the sequence.
    let step = parseInt(String(req.query.step || '1'), 10);
    if (!Number.isFinite(step) || step < 1) step = 1;
    if (step > scenes.length) step = scenes.length;

    const current = scenes[step - 1];
    // Hotspots follow VR_DATA_SOURCE (the scenes' own source): Supabase via
    // vrRepository (normalised to the view shape), MySQL via the existing
    // loader. The VR switch is the one resolved at request start.
    const rawHotspots = sources.vrSupabase
      ? normalizeHotspots(await vrRepository.listHotspotsForScene(current.id))
      : await loadSceneHotspots(current.id);

    // RF.6: being on the last AVAILABLE scene is not the same as having
    // ARRIVED. `isFinal` (which drives "Route complete / You have arrived")
    // now additionally requires that the sequence actually reaches the
    // destination. Next-step navigation is bounded by the scene list, so it
    // keys off isLastScene — never off isFinal — and there is no bogus Next
    // link past the last available scene.
    const isLastScene = step === scenes.length;
    const isFinal = isLastScene && resolved.destination_reached === true;
    const coverageEnds = isLastScene && resolved.destination_reached !== true;

    const base = `/vr/routes/${route.id}`;
    const prevUrl = step > 1 ? `${base}?step=${step - 1}` : null;
    const nextUrl = !isLastScene ? `${base}?step=${step + 1}` : null;

    // FIX 3: derive each scene hotspot's own navigation from its target_scene_key.
    const hotspots = attachHotspotNav(rawHotspots, scenes, step, isFinal, prevUrl, nextUrl);

    res.status(200).render('vr-route', {
      ...baseLocals,
      title: `CampuSphere | ${route.title}`,
      route,
      scene: {
        scene_key: current.scene_key,
        title: current.title,
        description: current.description,
        image_url: current.image_url,
        initial_yaw: current.initial_yaw,
        initial_pitch: current.initial_pitch
      },
      scenes: scenes.map((s) => ({ scene_key: s.scene_key, title: s.title })),
      hotspots,
      stepIndex: step,
      stepCount: scenes.length,
      isFinal,
      prevUrl,
      nextUrl,
      notice: coverageEnds ? (resolved.coverage_notice || coverageEndsNotice(route)) : null
    });
  } catch (err) {
    logServerError('vr.routeViewer', req);
    res.status(200).render('vr-route', {
      ...baseLocals,
      route: { id: 0, title: 'VR Route', start_label: '',
        estimated_walk_time: '', destination: { name: 'Unknown' } },
      scene: null,
      scenes: [],
      hotspots: [],
      stepIndex: 0,
      stepCount: 0,
      isFinal: false,
      prevUrl: null,
      nextUrl: null,
      notice: 'VR data is temporarily unavailable. Please try again later.'
    });
  }
};

exports.apiRoute = async (req, res) => {
  try {
    const sources = requestSources();
    const resolved = await resolveRouteScenes(req.params.routeId, sources);
    if (!resolved.ok) {
      return res
        .status(resolved.status || 400)
        .json({ success: false, message: resolved.message || 'Invalid route.' });
    }
    const payload = {
      success: true,
      route: {
        ...resolved.route,
        distance_meters: resolved.distance_meters,
        walk_time_seconds: resolved.walk_time_seconds
      },
      scenes: resolved.scenes.map((s) => ({
        scene_key: s.scene_key,
        title: s.title,
        description: s.description,
        image_url: s.image_url,
        node_key: s.node_key,
        initial_yaw: s.initial_yaw,
        initial_pitch: s.initial_pitch
      })),
      path: resolved.path,
      // RF.6 additive arrival flag: true only when the last scene in `scenes`
      // is the destination's own scene. Consumers must not infer arrival from
      // scenes.length alone.
      destination_reached: resolved.destination_reached === true
    };
    if (resolved.scenes.length === 0) {
      payload.message = resolved.reason === 'no_start_node'
        ? START_UNAVAILABLE_NOTICE
        : (resolved.coverage_message || 'No VR scenes are available for this route yet.');
    } else if (payload.destination_reached !== true) {
      // Partial coverage: scenes exist, but the walkthrough ends short. A
      // natural-key guided chain supplies its own configured-chain message.
      payload.message = resolved.coverage_message || coverageEndsApiMessage(resolved.route);
    }
    res.json(payload);
  } catch (err) {
    logServerError('vr.routeApi', req);
    res.status(500).json({ success: false, message: 'Unable to load VR route' });
  }
};

/* =========================================================
   Destination-based guided VR viewer (Milestone 11, 11.8B).
   GET /vr/to/:buildingId       -> HTML (same view + locals
                                   as the predefined flow)
   GET /api/vr/to/:buildingId   -> JSON
   Prev/next step links stay on /vr/to/:buildingId?step=N;
   the predefined /vr/routes/:routeId flow is untouched.
========================================================= */

exports.destinationViewer = async (req, res) => {
  const baseLocals = {
    title: 'CampuSphere | VR Route',
    description: 'Guided 360-degree campus route walkthrough for CSPC.',
    activeTab: 'tabMap'
  };

  try {
    // Per-source decisions, matching routeViewer (BE.4).
    const sources = requestSources();
    const resolved = await resolveDestinationScenes(req.params.buildingId, sources);

    if (!resolved.ok) {
      // Invalid/unknown building: still render a usable page (matching the
      // predefined-route viewer's HTML convention).
      return res.status(200).render('vr-route', {
        ...baseLocals,
        route: { id: 0, title: 'VR Route', start_label: '',
          estimated_walk_time: '', destination: { name: 'Unknown' } },
        scene: null,
        scenes: [],
        hotspots: [],
        stepIndex: 0,
        stepCount: 0,
        isFinal: false,
        prevUrl: null,
        nextUrl: null,
        notice: resolved.message || 'This VR route is not available.'
      });
    }

    const { route, scenes } = resolved;

    if (scenes.length === 0) {
      let notice = resolved.coverage_notice || `No VR scenes are available yet for "${route.title}".`;
      if (resolved.reason === 'no_start_node') {
        notice = START_UNAVAILABLE_NOTICE;
      } else if (resolved.reason === 'no_dest_node') {
        notice = `No campus route node maps to ${route.destination.name} yet.`;
      } else if (resolved.reason === 'no_path') {
        notice = `No walkable route to ${route.destination.name} was found.`;
      }
      return res.status(200).render('vr-route', {
        ...baseLocals,
        title: `CampuSphere | ${route.title}`,
        route,
        scene: null,
        scenes: [],
        hotspots: [],
        stepIndex: 0,
        stepCount: 0,
        isFinal: false,
        prevUrl: null,
        nextUrl: null,
        notice
      });
    }

    let step = parseInt(String(req.query.step || '1'), 10);
    if (!Number.isFinite(step) || step < 1) step = 1;
    if (step > scenes.length) step = scenes.length;

    const current = scenes[step - 1];
    const rawHotspots = sources.vrSupabase
      ? normalizeHotspots(await vrRepository.listHotspotsForScene(current.id))
      : await loadSceneHotspots(current.id);

    // RF.6: identical arrival contract to routeViewer. A destination with no
    // mapped 360 scene (e.g. Engineering, whose path yields only the Main Gate
    // scene) must NOT claim completion at step 1 of 1 — it states that VR
    // coverage ends here and offers no Next link.
    const isLastScene = step === scenes.length;
    const isFinal = isLastScene && resolved.destination_reached === true;
    const coverageEnds = isLastScene && resolved.destination_reached !== true;

    const base = `/vr/to/${route.destination.id}`;
    const prevUrl = step > 1 ? `${base}?step=${step - 1}` : null;
    const nextUrl = !isLastScene ? `${base}?step=${step + 1}` : null;

    // FIX 3: derive each scene hotspot's own navigation from its target_scene_key.
    const hotspots = attachHotspotNav(rawHotspots, scenes, step, isFinal, prevUrl, nextUrl);

    res.status(200).render('vr-route', {
      ...baseLocals,
      title: `CampuSphere | ${route.title}`,
      route,
      scene: {
        scene_key: current.scene_key,
        title: current.title,
        description: current.description,
        image_url: current.image_url,
        initial_yaw: current.initial_yaw,
        initial_pitch: current.initial_pitch
      },
      scenes: scenes.map((s) => ({ scene_key: s.scene_key, title: s.title })),
      hotspots,
      stepIndex: step,
      stepCount: scenes.length,
      isFinal,
      prevUrl,
      nextUrl,
      notice: coverageEnds ? (resolved.coverage_notice || coverageEndsNotice(route)) : null
    });
  } catch (err) {
    logServerError('vr.destinationViewer', req);
    res.status(200).render('vr-route', {
      ...baseLocals,
      route: { id: 0, title: 'VR Route', start_label: '',
        estimated_walk_time: '', destination: { name: 'Unknown' } },
      scene: null,
      scenes: [],
      hotspots: [],
      stepIndex: 0,
      stepCount: 0,
      isFinal: false,
      prevUrl: null,
      nextUrl: null,
      notice: 'VR data is temporarily unavailable. Please try again later.'
    });
  }
};

exports.apiDestination = async (req, res) => {
  try {
    const sources = requestSources();
    const resolved = await resolveDestinationScenes(req.params.buildingId, sources);
    if (!resolved.ok) {
      return res
        .status(resolved.status || 400)
        .json({ success: false, message: resolved.message || 'Invalid building id.' });
    }
    const payload = {
      success: true,
      route: {
        ...resolved.route,
        distance_meters: resolved.distance_meters,
        walk_time_seconds: resolved.walk_time_seconds
      },
      scenes: resolved.scenes.map((s) => ({
        scene_key: s.scene_key,
        title: s.title,
        description: s.description,
        image_url: s.image_url,
        node_key: s.node_key,
        initial_yaw: s.initial_yaw,
        initial_pitch: s.initial_pitch
      })),
      path: resolved.path,
      // RF.6 additive arrival flag (see apiRoute).
      destination_reached: resolved.destination_reached === true
    };
    if (resolved.scenes.length === 0) {
      payload.message = resolved.reason === 'no_start_node'
        ? START_UNAVAILABLE_NOTICE
        : (resolved.coverage_message || 'No VR scenes are available for this route yet.');
    } else if (payload.destination_reached !== true) {
      payload.message = resolved.coverage_message || coverageEndsApiMessage(resolved.route);
    }
    res.json(payload);
  } catch (err) {
    logServerError('vr.destinationApi', req);
    res.status(500).json({ success: false, message: 'Unable to load VR route' });
  }
};

/* =========================================================
   Scene browser (kept). GET /vr and GET /vr/:sceneKey.
========================================================= */

exports.viewer = async (req, res) => {
  const baseLocals = {
    title: 'CampuSphere | VR Campus Tour',
    description: 'Browse 360-degree campus scenes for CSPC.',
    activeTab: 'tabMap'
  };

  try {
    // Scene-browser backend selected explicitly per request: Supabase only
    // when VR_DATA_SOURCE=supabase; unset/empty/invalid/mysql stay on MySQL.
    const useSupabase = vrDataSource.isSupabase();

    // Ordered scene list (display_order ASC, id ASC) from the chosen backend.
    // Both shapes carry: id, scene_key, title, description, image_url,
    // initial_yaw, initial_pitch, display_order.
    let sceneRows;
    if (useSupabase) {
      sceneRows = await vrRepository.listAllScenes();
    } else {
      const [rows] = await db.query(
        `SELECT id, scene_key, title, description, image_url,
                initial_yaw, initial_pitch, display_order
           FROM vr_scenes
          ORDER BY display_order ASC, id ASC`
      );
      sceneRows = rows;
    }

    if (sceneRows.length === 0) {
      return res.status(200).render('vr', {
        ...baseLocals,
        scene: null,
        scenes: [],
        hotspots: [],
        sceneIndex: 0,
        sceneCount: 0,
        notice: 'No VR scenes are available yet.'
      });
    }

    const scenes = sceneRows.map((s) => ({
      scene_key: s.scene_key,
      title: s.title
    }));

    const requestedKey = String(req.params.sceneKey || '').trim();
    let current = null;
    let notice = null;

    if (requestedKey) {
      // Supabase: targeted lookup; MySQL: in-memory find over the loaded list.
      current = useSupabase
        ? await vrRepository.findSceneByKey(requestedKey)
        : (sceneRows.find((s) => s.scene_key === requestedKey) || null);
      if (!current) {
        notice = `Scene "${requestedKey}" was not found. Showing the starting scene instead.`;
      }
    }
    if (!current) {
      current =
        sceneRows.find((s) => s.scene_key === DEFAULT_SCENE_KEY) ||
        sceneRows[0];
    }

    // Hotspots: Supabase repo (normalised to the view shape) or the MySQL
    // loader, chosen by this request's resolved backend.
    const hotspots = useSupabase
      ? normalizeHotspots(await vrRepository.listHotspotsForScene(current.id))
      : await loadSceneHotspots(current.id);
    const sceneIndex =
      sceneRows.findIndex((s) => s.scene_key === current.scene_key) + 1;

    res.status(200).render('vr', {
      ...baseLocals,
      scene: {
        scene_key: current.scene_key,
        title: current.title,
        description: current.description || '',
        // Section 10.5 + pre-11.8C guard: only a sanitized panorama URL (safe
        // local /img/ path that exists under public/, or an
        // https://res.cloudinary.com URL) or null reaches the scene browser.
        image_url: resolveSceneImageUrl(current.image_url),
        initial_yaw: toNum(current.initial_yaw, 0),
        initial_pitch: toNum(current.initial_pitch, 0)
      },
      scenes,
      hotspots,
      sceneIndex,
      sceneCount: sceneRows.length,
      notice
    });
  } catch (err) {
    logServerError('vr.sceneViewer', req);
    res.status(200).render('vr', {
      ...baseLocals,
      scene: null,
      scenes: [],
      hotspots: [],
      sceneIndex: 0,
      sceneCount: 0,
      notice: 'VR data is temporarily unavailable. Please try again later.'
    });
  }
};
