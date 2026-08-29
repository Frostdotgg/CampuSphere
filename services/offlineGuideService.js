'use strict';

/* ========================================
   CampuSphere — OFF.3 offline guide package

   Server-only, read-only package assembly. The service reads the same active
   BUILDING_DATA_SOURCE / ROUTE_DATA_SOURCE used by the online map, computes
   every route from the canonical main-gate, and emits only participant-safe
   campus data. It never reads a request/session and never mutates a backend.
   ======================================== */

const crypto = require('crypto');
const db = require('../config/db');
const mapRuntime = require('../config/mapRuntime');
const buildingRepository = require('../repositories/buildingRepository');
const routeAvailability = require('./routeAvailability');
const { normalizeBuildingRows } = require('../utils/buildingData');
const { findShortestPath } = require('../utils/pathfinding');
const { assembleRouteGeometry } = require('../utils/routeGeometry');
const basemapManifest = require('../public/maps/manifest.json');
const {
  getCurrentRelease,
  guideBasemapFromRelease
} = require('./offlineMapReleaseService');

const SCHEMA = 'campusphere.offline-guide/1';
const MAX_PACKAGE_BYTES = 2 * 1024 * 1024;
const MAX_TEXT = 500;
const MAX_DESCRIPTION = 4000;
const MAX_LIST = 100;
const MAX_FLOORS = 40;
const MAX_ROOMS_PER_FLOOR = 150;
const ALLOWED_UNAVAILABLE_REASONS = new Set([
  'not_mapped',
  'unreachable',
  'invalid_geometry',
  'ambiguous_name',
  'route_data_unavailable'
]);

function safeText(value, max = MAX_TEXT) {
  if (typeof value === 'number' && Number.isFinite(value)) value = String(value);
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function finiteCoord(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function safeScalarList(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_LIST).map((item) => safeText(item)).filter(Boolean);
}

function safeInfoItem(item) {
  const scalar = safeText(item);
  if (scalar) return scalar;
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;

  const label = safeText(item.label);
  const value = safeText(item.value);
  if (label && value) return { label, value };

  const office = safeText(item.office);
  const floor = safeText(item.floor);
  if (office || floor) return { office, floor };
  return null;
}

function safeRoom(room) {
  const scalar = safeText(room);
  if (scalar) return scalar;
  if (!room || typeof room !== 'object' || Array.isArray(room)) return null;
  const number = safeText(room.room || room.number || room.num);
  const name = safeText(room.name || room.label);
  const use = safeText(room.use || room.purpose);
  if (!number && !name && !use) return null;
  return { room: number, name, use };
}

function safeFloor(floor, index) {
  const scalar = safeText(floor);
  if (scalar) return scalar;
  if (!floor || typeof floor !== 'object' || Array.isArray(floor)) return null;
  const label = safeText(floor.label || floor.name) || `Floor ${index + 1}`;
  const rooms = Array.isArray(floor.rooms)
    ? floor.rooms.slice(0, MAX_ROOMS_PER_FLOOR).map(safeRoom).filter(Boolean)
    : [];
  return { label, rooms };
}

function safeDetails(building) {
  return {
    walkTime: safeText(building && building.walkTime),
    info: Array.isArray(building && building.info)
      ? building.info.slice(0, MAX_LIST).map(safeInfoItem).filter(Boolean)
      : [],
    floors: Array.isArray(building && building.floors)
      ? building.floors.slice(0, MAX_FLOORS).map(safeFloor).filter(Boolean)
      : [],
    entrances: safeScalarList(building && building.entrances),
    landmarks: safeScalarList(building && building.landmarks)
  };
}

function destinationKey(name) {
  return routeAvailability.canonicalKey(name).replace(/\s+/g, '-');
}

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

function sha256Json(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function normalizeGraph(nodeRows, edgeRows) {
  const idToKey = new Map();
  const nodes = (nodeRows || []).map((row) => {
    const node = {
      key: safeText(row.node_key, 160),
      label: safeText(row.label, 300),
      node_type: safeText(row.node_type, 80),
      building_id: row.building_id == null ? null : Number(row.building_id),
      lat: finiteCoord(row.lat, -90, 90),
      lng: finiteCoord(row.lng, -180, 180)
    };
    idToKey.set(row.id, node.key);
    return node;
  }).filter((node) => node.key);

  const edgeGeometryByKey = new Map();
  const edges = (edgeRows || []).map((row) => {
    const from = idToKey.get(row.from_node_id);
    const to = idToKey.get(row.to_node_id);
    if (from && to) {
      edgeGeometryByKey.set(
        `${from}|${to}`,
        row.path_geometry !== undefined ? row.path_geometry : null
      );
    }
    return {
      from,
      to,
      distance_meters: Number(row.distance_meters) || 0,
      walk_time_seconds: Number(row.walk_time_seconds) || 0,
      path_label: safeText(row.path_label, 300) || null,
      is_accessible: Number(row.is_accessible)
    };
  }).filter((edge) => edge.from && edge.to);

  return { nodes, edges, edgeGeometryByKey };
}

function makeRoute(building, graph) {
  if (!building.route_available || !Number.isFinite(Number(building.route_destination_id))) return null;
  const destination = routeAvailability.resolveAvailabilityDestinationNode({
    destinationName: building.name,
    routeBuildingId: Number(building.route_destination_id),
    nodes: graph.nodes
  });
  if (!destination) return null;

  const result = findShortestPath({
    nodes: graph.nodes,
    edges: graph.edges,
    startKey: routeAvailability.START_NODE_KEY,
    endKey: destination.key
  });
  if (!result.success || !Array.isArray(result.nodes) || result.nodes.length < 2) return null;

  const assembled = assembleRouteGeometry({
    nodes: result.nodes,
    segments: result.segments,
    edgeGeometryByKey: graph.edgeGeometryByKey
  });
  if (assembled.incomplete || assembled.invalidEdges > 0 || assembled.geometry.length < 2) return null;

  const labelByKey = new Map(graph.nodes.map((node) => [node.key, node.label || node.key]));
  return {
    destinationKey: destinationKey(building.name),
    destinationName: safeText(building.name, 300),
    distanceMeters: Number(result.distance_meters) || 0,
    walkTimeSeconds: Number(result.walk_time_seconds) || 0,
    estimatedWalkTime: formatWalkTime(result.walk_time_seconds),
    geometry: assembled.geometry.map((point) => [point.lng, point.lat]),
    steps: result.segments.map((segment, index) => ({
      order: index + 1,
      instruction: `Follow ${safeText(segment.path_label, 300) || 'the campus walkway'} to ${labelByKey.get(segment.to) || 'the next point'}.`,
      distanceMeters: Number(segment.distance_meters) || 0
    }))
  };
}

/* Pure package builder used by the focused OFF.3-OFF.5 probe. */
function buildGuide({ buildings, nodeRows, edgeRows, basemap } = {}) {
  const graph = normalizeGraph(nodeRows, edgeRows);
  const origin = graph.nodes.find((node) => node.key === routeAvailability.START_NODE_KEY);
  if (!origin || origin.lat == null || origin.lng == null) {
    throw new Error('Offline guide origin is unavailable.');
  }

  const seenKeys = new Set();
  const safeBuildings = [];
  const routes = [];
  for (const building of (buildings || [])) {
    const key = destinationKey(building && building.name);
    if (!key || seenKeys.has(key)) throw new Error('Offline guide destination keys are not unique.');
    seenKeys.add(key);

    const route = makeRoute(building, graph);
    const reason = route
      ? null
      : (ALLOWED_UNAVAILABLE_REASONS.has(building.route_unavailable_reason)
        ? building.route_unavailable_reason
        : 'not_mapped');
    safeBuildings.push({
      key,
      name: safeText(building.name, 300) || 'Unnamed building',
      category: safeText(building.category, 160) || 'Uncategorized',
      description: safeText(building.description || building.desc, MAX_DESCRIPTION) || 'No description available.',
      lat: finiteCoord(building.lat, -90, 90),
      lng: finiteCoord(building.lng, -180, 180),
      routeAvailable: !!route,
      routeUnavailableReason: reason,
      details: safeDetails(building)
    });
    if (route) routes.push(route);
  }

  safeBuildings.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  routes.sort((a, b) => a.destinationName.localeCompare(b.destinationName, 'en'));

  const selectedBasemap = basemap || {
    asset: basemapManifest.asset,
    bytes: basemapManifest.bytes,
    sha256: basemapManifest.sha256,
    bounds: basemapManifest.bounds,
    center: basemapManifest.center,
    minzoom: basemapManifest.minzoom,
    maxzoom: basemapManifest.maxzoom,
    attribution: basemapManifest.attribution,
    version: basemapManifest.sha256,
    publishedAt: null,
    lastCheckedAt: null,
    osmSnapshotAt: null,
    sourceVersion: basemapManifest.source && basemapManifest.source.version
      ? basemapManifest.source.version
      : 'bundled'
  };

  return {
    origin: {
      key: routeAvailability.START_NODE_KEY,
      label: origin.label || 'Guard House / Main Gate',
      lat: origin.lat,
      lng: origin.lng
    },
    basemap: selectedBasemap,
    buildings: safeBuildings,
    routes
  };
}

function toNumOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function loadBuildingRows() {
  return mapRuntime.isBuildingSupabase()
    ? await buildingRepository.listAll()
    : (await db.query('SELECT * FROM buildings ORDER BY id ASC'))[0];
}

/* ONE read of each required dataset per download request.

   Previously a single download read the same data twice. loadBuildings() called
   routeAvailability.decorateBuildings(), which internally re-read the route
   graph AND the building roster, and a separate loadGraphRows() then read
   route_nodes and route_edges a SECOND time. That doubled the query cost of one
   download and — more importantly — produced two independent point-in-time
   views: an admin edit landing between them could decorate a building as
   available from one graph while its route was generated from another.

   Now the building rows and the route source are read exactly once and that
   immutable snapshot drives BOTH availability decoration and route generation,
   so the two can never disagree. The building roster used for canonical-name
   collision detection is a PROJECTION of the rows already read, not a third
   query, and it comes from the same BUILDING_DATA_SOURCE that
   loadBuildingSourceRoster() would have queried — so mixed
   BUILDING_DATA_SOURCE/ROUTE_DATA_SOURCE behaviour is unchanged. */
async function loadGuideSnapshot() {
  const [buildingRows, routeSource] = await Promise.all([
    loadBuildingRows(),
    routeAvailability.loadRouteSource()
  ]);
  const buildingRoster = (buildingRows || []).map((b) => ({
    id: toNumOrNull(b && b.id),
    name: b && b.name
  }));
  return { buildingRows, routeSource, buildingRoster };
}

async function createOfflineGuidePackage() {
  const snapshot = await loadGuideSnapshot();
  const release = await getCurrentRelease();

  const index = await routeAvailability.buildAvailabilityIndex({
    routeSource: snapshot.routeSource,
    buildingRoster: snapshot.buildingRoster
  });
  if (!index.ok) throw new Error('Offline guide route availability is unavailable.');

  const decorated = await routeAvailability.decorateBuildings(
    normalizeBuildingRows(snapshot.buildingRows),
    { index }
  );
  if (!decorated.ok) throw new Error('Offline guide route availability is unavailable.');

  // Same snapshot, same rows: the graph that decided availability is the graph
  // the routes are generated from.
  const guide = buildGuide({
    buildings: decorated.buildings,
    nodeRows: snapshot.routeSource.nodes,
    edgeRows: snapshot.routeSource.edges,
    basemap: guideBasemapFromRelease(release)
  });
  const fingerprint = sha256Json(guide);
  const response = {
    success: true,
    schema: SCHEMA,
    generatedAt: new Date().toISOString(),
    fingerprint,
    guide
  };
  const bytes = Buffer.byteLength(JSON.stringify(response), 'utf8');
  if (bytes > MAX_PACKAGE_BYTES) throw new Error('Offline guide package exceeds its size limit.');
  return response;
}

module.exports = {
  SCHEMA,
  MAX_PACKAGE_BYTES,
  safeDetails,
  destinationKey,
  formatWalkTime,
  sha256Json,
  normalizeGraph,
  buildGuide,
  createOfflineGuidePackage
};
