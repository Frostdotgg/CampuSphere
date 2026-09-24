'use strict';

/*
 * Supabase -> local MySQL campus/VR sync.
 *
 * Default mode merges by stable natural keys and preserves local-only rows.
 * An opt-in prune mode can make the eight scoped campus/VR tables match the
 * selected Supabase project after an exact preview, verified backup, and a
 * separate destructive confirmation.
 * Users, profiles, sessions, schedules, announcements, events, FAQs,
 * settings, team members, and audit logs are protected by before/after
 * fingerprints.  room_schedule_documents are included only as references
 * required by VR schedule hotspots; room_schedules themselves are untouched.
 *
 * Default is a read-only merge preview. Merge apply requires:
 *   node scripts/syncCampusVrSupabaseToMysql.js --apply --confirm=SYNC_CAMPUS_VR_TO_MYSQL
 * Prune preview:
 *   node scripts/syncCampusVrSupabaseToMysql.js --prune --dry-run
 * Prune apply additionally requires the preview token and backup folder:
 *   node scripts/syncCampusVrSupabaseToMysql.js --prune --apply --confirm=PRUNE_MYSQL_ONLY_CAMPUS_VR --preview-token=<token> --backup-dir=<absolute-folder>
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validatePathGeometry } = require('../utils/routeGeometry');

const APPLY_CONFIRMATION = 'SYNC_CAMPUS_VR_TO_MYSQL';
const PRUNE_CONFIRMATION = 'PRUNE_MYSQL_ONLY_CAMPUS_VR';
const BACKUP_SCHEMA_VERSION = 1;
const PRUNE_REQUIRES_SOURCE = Object.freeze([
  'buildings', 'campus_routes', 'route_nodes', 'route_edges', 'vr_scenes', 'vr_hotspots'
]);
const TABLES = Object.freeze([
  'buildings',
  'campus_routes',
  'campus_route_steps',
  'route_nodes',
  'route_edges',
  'room_schedule_documents',
  'vr_scenes',
  'vr_hotspots'
]);
const DELETE_ORDER = Object.freeze([
  'vr_hotspots', 'campus_route_steps', 'route_edges', 'vr_scenes',
  'campus_routes', 'room_schedule_documents', 'route_nodes', 'buildings'
]);
const PROTECTED_TABLES = Object.freeze([
  'users', 'student_profiles', 'instructor_profiles', 'guest_profiles',
  'app_sessions', 'room_schedules', 'news_announcements', 'team_members',
  'events', 'faqs', 'system_settings', 'system_logs'
]);
const HOTSPOT_TYPES = new Set(['scene', 'info', 'exit', 'schedule']);
const PAGE_SIZE = 500;
const MAX_PAGES = 1000;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SYNC_FIELDS = Object.freeze({
  buildings: ['name', 'category', 'description', 'lat', 'lng', 'details', 'image_url', 'cloudinary_public_id'],
  campus_routes: ['title', 'start_label', 'destination_building_id', 'estimated_walk_time'],
  campus_route_steps: ['route_id', 'step_order', 'instruction', 'landmark', 'lat', 'lng'],
  route_nodes: ['node_key', 'label', 'node_type', 'building_id', 'lat', 'lng', 'display_order'],
  route_edges: ['from_node_id', 'to_node_id', 'distance_meters', 'walk_time_seconds', 'path_label', 'is_accessible', 'path_geometry'],
  room_schedule_documents: ['building_id', 'location_type', 'location_label', 'floor_label', 'location_key', 'semester', 'school_year', 'image_url', 'cloudinary_public_id'],
  vr_scenes: ['scene_key', 'title', 'description', 'image_url', 'cloudinary_public_id', 'node_id', 'building_id', 'initial_yaw', 'initial_pitch', 'display_order'],
  vr_hotspots: ['scene_id', 'target_scene_id', 'hotspot_type', 'label', 'text', 'guest_visible', 'schedule_building_id', 'schedule_location_type', 'schedule_location_label', 'schedule_floor_label', 'schedule_document_id', 'yaw', 'pitch', 'display_order']
});
const NUMERIC_FIELDS = new Set([
  'destination_building_id', 'route_id', 'step_order', 'building_id',
  'from_node_id', 'to_node_id', 'distance_meters', 'walk_time_seconds',
  'node_id', 'scene_id', 'target_scene_id', 'schedule_building_id',
  'schedule_document_id', 'lat', 'lng', 'initial_yaw', 'initial_pitch',
  'yaw', 'pitch', 'display_order'
]);
const ID_FIELD = Object.freeze({
  buildings: 'id', campus_routes: 'id', campus_route_steps: 'id', route_nodes: 'id',
  route_edges: 'id', room_schedule_documents: 'id', vr_scenes: 'id', vr_hotspots: 'id'
});

class SyncError extends Error {
  constructor(internal, publicMessage = null) {
    super(internal);
    this.name = 'SyncError';
    this.publicMessage = publicMessage || internal;
  }
}

function loadRuntimeAdapters() {
  process.env.DOTENV_CONFIG_QUIET = 'true';
  require('dotenv').config({ quiet: true });
  return {
    db: require('../config/db'),
    supabase: require('../config/supabase')
  };
}

function quoteIdentifier(value) {
  if (!IDENTIFIER.test(value)) throw new SyncError('Unsafe SQL identifier.');
  return '`' + value + '`';
}

function optString(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function canonicalKey(value) {
  return String(value == null ? '' : value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return { type: 'Buffer', data: Array.from(value) };
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = stableValue(value[key]);
      return out;
    }, {});
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(stableJson(value)).digest('hex');
}

function jsonValue(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch (_) { return value; }
  }
  return value;
}

function mysqlJson(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') {
    try { return stableJson(JSON.parse(value)); } catch (_) { return value; }
  }
  return stableJson(value);
}

function boolValue(value) {
  if (value === true || value === 1 || value === '1') return 1;
  if (value === false || value === 0 || value === '0' || value === null || value === undefined || value === '') return 0;
  throw new SyncError('Invalid boolean value in scoped campus/VR source.', 'Supabase campus/VR data contains an invalid boolean value; sync stopped without writing.');
}

function numberValue(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new SyncError('Invalid numeric value in scoped campus/VR source.', 'Supabase campus/VR data contains an invalid numeric value; sync stopped without writing.');
  return number;
}

function requireNatural(value, label) {
  const key = optString(value);
  if (!key) throw new SyncError(`${label} is missing in scoped campus/VR source.`, `Supabase campus/VR data is missing a required ${label}; sync stopped without writing.`);
  return key;
}

function mapUnique(rows, keyFn, label) {
  const map = new Map();
  for (const row of rows || []) {
    const key = keyFn(row);
    if (!key) throw new SyncError(`${label} has a missing natural key.`, `Supabase/MySQL ${label} contains a missing natural key; sync stopped without writing.`);
    if (map.has(key)) throw new SyncError(`${label} has duplicate natural key.`, `Supabase/MySQL ${label} contains duplicate natural keys; sync stopped without writing.`);
    map.set(key, row);
  }
  return map;
}

function idMap(rows, label) {
  const map = new Map();
  for (const row of rows || []) {
    const id = Number(row.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new SyncError(`${label} contains an invalid id.`);
    if (map.has(id)) throw new SyncError(`${label} contains duplicate ids.`);
    map.set(id, row);
  }
  return map;
}

function sourceNaturalMaps(source) {
  const buildings = mapUnique(source.buildings, (row) => canonicalKey(requireNatural(row.name, 'building name')), 'source buildings');
  const nodes = mapUnique(source.route_nodes, (row) => requireNatural(row.node_key, 'route node key'), 'source route nodes');
  const routes = mapUnique(source.campus_routes, (row) => canonicalKey(requireNatural(row.title, 'route title')), 'source campus routes');
  const scenes = mapUnique(source.vr_scenes, (row) => requireNatural(row.scene_key, 'scene key'), 'source VR scenes');
  const buildingById = idMap(source.buildings, 'source buildings');
  const nodeById = idMap(source.route_nodes, 'source route nodes');
  const routeById = idMap(source.campus_routes, 'source campus routes');
  const sceneById = idMap(source.vr_scenes, 'source VR scenes');
  const documentById = idMap(source.room_schedule_documents, 'source schedule documents');
  const documents = mapUnique(source.room_schedule_documents, (row) => {
    const building = buildingById.get(Number(row.building_id));
    return building ? `${canonicalKey(building.name)}|${requireNatural(row.location_key, 'schedule document location key')}` : null;
  }, 'source schedule documents');
  return { buildings, nodes, routes, scenes, buildingById, nodeById, routeById, sceneById, documentById, documents };
}

function targetNaturalMaps(target) {
  const buildings = mapUnique(target.buildings, (row) => canonicalKey(requireNatural(row.name, 'building name')), 'target buildings');
  const nodes = mapUnique(target.route_nodes, (row) => requireNatural(row.node_key, 'route node key'), 'target route nodes');
  const routes = mapUnique(target.campus_routes, (row) => canonicalKey(requireNatural(row.title, 'route title')), 'target campus routes');
  const scenes = mapUnique(target.vr_scenes, (row) => requireNatural(row.scene_key, 'scene key'), 'target VR scenes');
  const buildingById = idMap(target.buildings, 'target buildings');
  const nodeById = idMap(target.route_nodes, 'target route nodes');
  const routeById = idMap(target.campus_routes, 'target campus routes');
  const sceneById = idMap(target.vr_scenes, 'target VR scenes');
  const documentById = idMap(target.room_schedule_documents, 'target schedule documents');
  const documents = mapUnique(target.room_schedule_documents, (row) => {
    const building = buildingById.get(Number(row.building_id));
    return building ? `${canonicalKey(building.name)}|${requireNatural(row.location_key, 'schedule document location key')}` : null;
  }, 'target schedule documents');
  return { buildings, nodes, routes, scenes, buildingById, nodeById, routeById, sceneById, documentById, documents };
}

function documentKey(row, maps) {
  const building = maps.buildingById.get(Number(row.building_id));
  return building ? `${canonicalKey(building.name)}|${requireNatural(row.location_key, 'schedule document location key')}` : null;
}

function routeKeyFor(row, maps) {
  const route = maps.routeById.get(Number(row.route_id));
  return route ? canonicalKey(requireNatural(route.title, 'route title')) : null;
}

function edgeKey(row, maps) {
  const from = maps.nodeById.get(Number(row.from_node_id));
  const to = maps.nodeById.get(Number(row.to_node_id));
  return from && to ? `${requireNatural(from.node_key, 'from route node key')}|${requireNatural(to.node_key, 'to route node key')}` : null;
}

function hotspotKey(row, maps) {
  const scene = maps.sceneById.get(Number(row.scene_id));
  const sourceKey = scene && requireNatural(scene.scene_key, 'scene key');
  const type = requireNatural(row.hotspot_type, 'hotspot type').toLowerCase();
  if (!sourceKey || !HOTSPOT_TYPES.has(type)) throw new SyncError('Invalid hotspot identity in scoped source.', 'Supabase/MySQL VR hotspots contain an unsupported or unresolved identity; sync stopped without writing.');
  const order = Number(row.display_order);
  if (!Number.isSafeInteger(order) || order < 0) throw new SyncError('VR hotspot display order is invalid.', 'Supabase/MySQL VR hotspots contain an invalid display order; sync stopped without writing.');
  const yaw = numberValue(row.yaw);
  const pitch = numberValue(row.pitch);
  const placement = `|order|${order}|yaw|${yaw}|pitch|${pitch}`;
  if (type === 'scene') {
    const target = maps.sceneById.get(Number(row.target_scene_id));
    if (!target) throw new SyncError('VR scene hotspot target is unresolved.', 'Supabase/MySQL VR hotspots contain an unresolved scene target; sync stopped without writing.');
    return `${sourceKey}|scene|${requireNatural(target.scene_key, 'target scene key')}${placement}`;
  }
  if (type === 'schedule') {
    if (row.schedule_document_id !== undefined && row.schedule_document_id !== null) {
      const document = maps.documentById.get(Number(row.schedule_document_id));
      if (!document) throw new SyncError('VR schedule document reference is unresolved.', 'Supabase/MySQL VR hotspots contain an unresolved schedule-document reference; sync stopped without writing.');
      return `${sourceKey}|schedule|document|${documentKey(document, maps)}${placement}`;
    }
    const building = maps.buildingById.get(Number(row.schedule_building_id));
    const label = canonicalKey(row.schedule_location_label);
    const locationType = optString(row.schedule_location_type);
    if (!building || !label || !locationType) throw new SyncError('VR schedule hotspot identity is incomplete.', 'Supabase/MySQL VR hotspots contain an incomplete schedule identity; sync stopped without writing.');
    return `${sourceKey}|schedule|legacy|${canonicalKey(building.name)}|${locationType}|${label}|${canonicalKey(row.schedule_floor_label)}${placement}`;
  }
  return `${sourceKey}|${type}|${canonicalKey(requireNatural(row.label, 'hotspot label'))}${placement}`;
}

function sourceAndTargetKeys(source, target, sourceMaps, targetMaps) {
  const keyed = {};
  keyed.buildings = mapUnique(source.buildings, (row) => canonicalKey(row.name), 'source buildings');
  keyed.targetBuildings = mapUnique(target.buildings, (row) => canonicalKey(row.name), 'target buildings');
  keyed.campus_routes = mapUnique(source.campus_routes, (row) => canonicalKey(row.title), 'source campus routes');
  keyed.targetCampusRoutes = mapUnique(target.campus_routes, (row) => canonicalKey(row.title), 'target campus routes');
  keyed.route_nodes = mapUnique(source.route_nodes, (row) => row.node_key, 'source route nodes');
  keyed.targetRouteNodes = mapUnique(target.route_nodes, (row) => row.node_key, 'target route nodes');
  keyed.room_schedule_documents = mapUnique(source.room_schedule_documents, (row) => documentKey(row, sourceMaps), 'source schedule documents');
  keyed.targetScheduleDocuments = mapUnique(target.room_schedule_documents, (row) => documentKey(row, targetMaps), 'target schedule documents');
  keyed.vr_scenes = mapUnique(source.vr_scenes, (row) => row.scene_key, 'source VR scenes');
  keyed.targetVrScenes = mapUnique(target.vr_scenes, (row) => row.scene_key, 'target VR scenes');
  keyed.campus_route_steps = mapUnique(source.campus_route_steps, (row) => `${routeKeyFor(row, sourceMaps)}|${Number(row.step_order)}`, 'source route steps');
  keyed.targetCampusRouteSteps = mapUnique(target.campus_route_steps, (row) => `${routeKeyFor(row, targetMaps)}|${Number(row.step_order)}`, 'target route steps');
  keyed.route_edges = mapUnique(source.route_edges, (row) => edgeKey(row, sourceMaps), 'source route edges');
  keyed.targetRouteEdges = mapUnique(target.route_edges, (row) => edgeKey(row, targetMaps), 'target route edges');
  keyed.vr_hotspots = mapUnique(source.vr_hotspots, (row) => hotspotKey(row, sourceMaps), 'source VR hotspots');
  keyed.targetVrHotspots = mapUnique(target.vr_hotspots, (row) => hotspotKey(row, targetMaps), 'target VR hotspots');
  return keyed;
}

function targetId(map, key) {
  const row = map.get(key);
  return row ? Number(row.id) : null;
}

function mappedFields(table, row, sourceMaps, targetMaps) {
  const out = {};
  if (table === 'buildings') {
    Object.assign(out, { name: optString(row.name), category: optString(row.category), description: row.description ?? null, lat: numberValue(row.lat), lng: numberValue(row.lng), details: mysqlJson(row.details), image_url: optString(row.image_url), cloudinary_public_id: optString(row.cloudinary_public_id) });
  } else if (table === 'campus_routes') {
    const building = sourceMaps.buildingById.get(Number(row.destination_building_id));
    out.title = optString(row.title); out.start_label = optString(row.start_label); out.destination_building_id = targetId(targetMaps.buildings, canonicalKey(building && building.name)); out.estimated_walk_time = optString(row.estimated_walk_time);
  } else if (table === 'campus_route_steps') {
    out.route_id = targetId(targetMaps.routes, routeKeyFor(row, sourceMaps)); out.step_order = Number(row.step_order); out.instruction = optString(row.instruction); out.landmark = optString(row.landmark); out.lat = numberValue(row.lat); out.lng = numberValue(row.lng);
  } else if (table === 'route_nodes') {
    const building = row.building_id == null ? null : sourceMaps.buildingById.get(Number(row.building_id));
    out.node_key = optString(row.node_key); out.label = optString(row.label); out.node_type = optString(row.node_type) || 'walkway'; out.building_id = building ? targetId(targetMaps.buildings, canonicalKey(building.name)) : null; out.lat = numberValue(row.lat); out.lng = numberValue(row.lng); out.display_order = numberValue(row.display_order);
  } else if (table === 'route_edges') {
    const key = edgeKey(row, sourceMaps); const parts = key ? key.split('|') : [];
    out.from_node_id = targetId(targetMaps.nodes, parts[0]); out.to_node_id = targetId(targetMaps.nodes, parts[1]); out.distance_meters = Number(row.distance_meters); out.walk_time_seconds = Number(row.walk_time_seconds); out.path_label = optString(row.path_label); out.is_accessible = boolValue(row.is_accessible); out.path_geometry = mysqlJson(row.path_geometry);
    const nodeMap = endpointNodeMaps(targetMaps);
    out.path_geometry = snapEdgeGeometry(out.path_geometry, nodeMap.get(parts[0]), nodeMap.get(parts[1])) || out.path_geometry;
  } else if (table === 'room_schedule_documents') {
    const building = sourceMaps.buildingById.get(Number(row.building_id));
    out.building_id = building ? targetId(targetMaps.buildings, canonicalKey(building.name)) : null; out.location_type = optString(row.location_type); out.location_label = optString(row.location_label); out.floor_label = optString(row.floor_label); out.location_key = optString(row.location_key); out.semester = optString(row.semester); out.school_year = optString(row.school_year); out.image_url = optString(row.image_url); out.cloudinary_public_id = optString(row.cloudinary_public_id);
  } else if (table === 'vr_scenes') {
    const node = row.node_id == null ? null : sourceMaps.nodeById.get(Number(row.node_id));
    const building = row.building_id == null ? null : sourceMaps.buildingById.get(Number(row.building_id));
    out.scene_key = optString(row.scene_key); out.title = optString(row.title); out.description = row.description ?? null; out.image_url = optString(row.image_url); out.cloudinary_public_id = optString(row.cloudinary_public_id); out.node_id = node ? targetId(targetMaps.nodes, node.node_key) : null; out.building_id = building ? targetId(targetMaps.buildings, canonicalKey(building.name)) : null; out.initial_yaw = numberValue(row.initial_yaw); out.initial_pitch = numberValue(row.initial_pitch); out.display_order = numberValue(row.display_order);
  } else if (table === 'vr_hotspots') {
    const scene = sourceMaps.sceneById.get(Number(row.scene_id));
    const targetScene = row.target_scene_id == null ? null : sourceMaps.sceneById.get(Number(row.target_scene_id));
    const scheduleBuilding = row.schedule_building_id == null ? null : sourceMaps.buildingById.get(Number(row.schedule_building_id));
    const scheduleDocument = row.schedule_document_id == null ? null : sourceMaps.documentById.get(Number(row.schedule_document_id));
    out.scene_id = scene ? targetId(targetMaps.scenes, scene.scene_key) : null; out.target_scene_id = targetScene ? targetId(targetMaps.scenes, targetScene.scene_key) : null; out.hotspot_type = optString(row.hotspot_type); out.label = optString(row.label); out.text = row.text ?? null; out.guest_visible = boolValue(row.guest_visible); out.schedule_building_id = scheduleBuilding ? targetId(targetMaps.buildings, canonicalKey(scheduleBuilding.name)) : null; out.schedule_location_type = optString(row.schedule_location_type); out.schedule_location_label = optString(row.schedule_location_label); out.schedule_floor_label = optString(row.schedule_floor_label); out.schedule_document_id = scheduleDocument ? targetId(targetMaps.documents, documentKey(scheduleDocument, sourceMaps)) : null; out.yaw = numberValue(row.yaw); out.pitch = numberValue(row.pitch); out.display_order = numberValue(row.display_order);
  }
  return out;
}

function targetFields(table, row) {
  const out = {};
  for (const field of SYNC_FIELDS[table]) {
    let value = row[field];
    if (field === 'details' || field === 'path_geometry') value = mysqlJson(value);
    else if (field === 'is_accessible' || field === 'guest_visible') value = boolValue(value);
    else if (NUMERIC_FIELDS.has(field)) value = numberValue(value);
    out[field] = value === undefined ? null : value;
  }
  return out;
}

// Route-node coordinates can legitimately be refreshed by the scoped merge
// while local-only edge rows remain in the rehearsal graph. Keep every local
// drawing endpoint anchored to the current node without changing its drawn
// interior path or its source-authoritative scalar metrics.
function snapEdgeGeometry(value, fromNode, toNode) {
  const parsed = jsonValue(value);
  const valid = validatePathGeometry(parsed, { allowNull: false });
  if (!valid.ok || !fromNode || !toNode) return null;
  const fromLat = Number(fromNode.lat);
  const fromLng = Number(fromNode.lng);
  const toLat = Number(toNode.lat);
  const toLng = Number(toNode.lng);
  if (![fromLat, fromLng, toLat, toLng].every(Number.isFinite)) return null;
  const points = valid.value.map((point) => ({ lat: point.lat, lng: point.lng }));
  points[0] = { lat: fromLat, lng: fromLng };
  points[points.length - 1] = { lat: toLat, lng: toLng };
  return stableJson(points);
}

function endpointNodeMaps(targetMaps) {
  return targetMaps && targetMaps.nodes instanceof Map ? targetMaps.nodes : new Map();
}

function endpointRepairRows(target) {
  const nodes = idMap(target.route_nodes || [], 'target route nodes');
  const repairs = [];
  for (const edge of target.route_edges || []) {
    const fromNode = nodes.get(Number(edge.from_node_id));
    const toNode = nodes.get(Number(edge.to_node_id));
    const snapped = snapEdgeGeometry(edge.path_geometry, fromNode, toNode);
    if (snapped && snapped !== mysqlJson(edge.path_geometry)) {
      repairs.push({ id: Number(edge.id), path_geometry: snapped });
    }
  }
  return repairs;
}

async function repairEndpointGeometry(conn) {
  const [rows] = await conn.query(`
    SELECT e.id, e.path_geometry,
           n1.lat AS from_lat, n1.lng AS from_lng,
           n2.lat AS to_lat, n2.lng AS to_lng
      FROM route_edges e
      JOIN route_nodes n1 ON n1.id = e.from_node_id
      JOIN route_nodes n2 ON n2.id = e.to_node_id
     FOR UPDATE`);
  let repaired = 0;
  for (const row of rows) {
    const snapped = snapEdgeGeometry(row.path_geometry,
      { lat: row.from_lat, lng: row.from_lng },
      { lat: row.to_lat, lng: row.to_lng });
    if (!snapped || snapped === mysqlJson(row.path_geometry)) continue;
    await conn.query('UPDATE route_edges SET path_geometry = ? WHERE id = ?', [snapped, Number(row.id)]);
    repaired += 1;
  }
  return repaired;
}

function sameFields(a, b) {
  return stableJson(a) === stableJson(b);
}

function planTable(table, sourceRows, targetRows, sourceMaps, targetMaps, sourceKeyMap, targetKeyMap) {
  const entries = [];
  for (const sourceRow of sourceRows) {
    let key;
    if (table === 'buildings') key = canonicalKey(sourceRow.name);
    else if (table === 'campus_routes') key = canonicalKey(sourceRow.title);
    else if (table === 'campus_route_steps') key = `${routeKeyFor(sourceRow, sourceMaps)}|${Number(sourceRow.step_order)}`;
    else if (table === 'route_nodes') key = sourceRow.node_key;
    else if (table === 'route_edges') key = edgeKey(sourceRow, sourceMaps);
    else if (table === 'room_schedule_documents') key = documentKey(sourceRow, sourceMaps);
    else if (table === 'vr_scenes') key = sourceRow.scene_key;
    else key = hotspotKey(sourceRow, sourceMaps);
    const targetRow = targetKeyMap.get(key) || null;
    const desired = mappedFields(table, sourceRow, sourceMaps, targetMaps);
    const current = targetRow ? targetFields(table, targetRow) : null;
    entries.push({ key, sourceRow, targetRow, desired, current, action: targetRow ? (sameFields(desired, current) ? 'present' : 'update') : 'insert' });
  }
  return entries;
}

function summarize(entries, targetRows) {
  const result = { source: entries.length, target: targetRows.length, insert: 0, update: 0, present: 0, localOnly: 0 };
  for (const entry of entries) result[entry.action] += 1;
  result.localOnly = targetRows.length - entries.filter((entry) => entry.targetRow).length;
  return result;
}

function sourceFingerprint(source) {
  return fingerprint(TABLES.reduce((out, table) => { out[table] = source[table]; return out; }, {}));
}

function targetFingerprint(target) {
  return fingerprint(TABLES.reduce((out, table) => { out[table] = target[table]; return out; }, {}));
}

async function readSupabaseTable(sb, table) {
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await sb.from(table).select('*').order('id', { ascending: true }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) throw new SyncError(`Supabase read failed for ${table}.`, `Unable to read Supabase ${table}; sync stopped without writing.`);
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
  throw new SyncError(`Supabase pagination exceeded for ${table}.`, `Supabase ${table} exceeded the bounded sync limit; sync stopped without writing.`);
}

async function readSource(sb) {
  const source = {};
  for (const table of TABLES) source[table] = await readSupabaseTable(sb, table);
  return source;
}

async function readMysql(conn, tables = TABLES, lock = false) {
  const target = {};
  for (const table of tables) {
    const suffix = lock ? ' FOR UPDATE' : '';
    const [rows] = await conn.query(`SELECT * FROM ${quoteIdentifier(table)} ORDER BY ${quoteIdentifier(ID_FIELD[table])}${suffix}`);
    target[table] = rows;
  }
  return target;
}

async function protectedFingerprint(conn) {
  const snapshot = {};
  for (const table of PROTECTED_TABLES) {
    const [rows] = await conn.query(`SELECT * FROM ${quoteIdentifier(table)}`);
    snapshot[table] = fingerprint(rows.map((row) => stableJson(row)).sort());
  }
  return snapshot;
}

function protectedEqual(a, b) {
  return PROTECTED_TABLES.every((table) => a[table] === b[table]);
}

function buildPlan(source, target) {
  const sourceMaps = sourceNaturalMaps(source);
  const targetMaps = targetNaturalMaps(target);
  const keyed = sourceAndTargetKeys(source, target, sourceMaps, targetMaps);
  const targetKeyMaps = {
    buildings: keyed.targetBuildings,
    campus_routes: keyed.targetCampusRoutes,
    campus_route_steps: keyed.targetCampusRouteSteps,
    route_nodes: keyed.targetRouteNodes,
    route_edges: keyed.targetRouteEdges,
    room_schedule_documents: keyed.targetScheduleDocuments,
    vr_scenes: keyed.targetVrScenes,
    vr_hotspots: keyed.targetVrHotspots
  };
  const sourceKeyMaps = {
    buildings: keyed.buildings,
    campus_routes: keyed.campus_routes,
    campus_route_steps: keyed.campus_route_steps,
    route_nodes: keyed.route_nodes,
    route_edges: keyed.route_edges,
    room_schedule_documents: keyed.room_schedule_documents,
    vr_scenes: keyed.vr_scenes,
    vr_hotspots: keyed.vr_hotspots
  };
  const entries = {};
  const removals = {};
  for (const table of TABLES) {
    const sourceRows = source[table] || [];
    const targetRows = target[table] || [];
    const sourceKeyMap = keyed[table];
    const targetKeyMap = targetKeyMaps[table] || new Map();
    entries[table] = planTable(table, sourceRows, targetRows, sourceMaps, targetMaps, sourceKeyMap, targetKeyMap);
    removals[table] = Array.from(targetKeyMap.entries())
      .filter(([key]) => !sourceKeyMaps[table].has(key))
      .map(([key, targetRow]) => ({ key, targetRow }));
  }
  return { sourceMaps, targetMaps, entries, removals, keyed };
}

function pruneManifest(plan) {
  return DELETE_ORDER.flatMap((table) => (plan.removals[table] || [])
    .map(({ key, targetRow }) => ({ table, key, id: Number(targetRow.id) })));
}

function previewToken(sourceFp, targetFp, plan, mysqlTargetFp = null) {
  return fingerprint({
    version: 1,
    source_fingerprint: sourceFp,
    target_fingerprint: targetFp,
    mysql_target_fingerprint: mysqlTargetFp,
    removals: pruneManifest(plan)
  });
}

function validatePruneSource(source) {
  for (const table of PRUNE_REQUIRES_SOURCE) {
    if (!Array.isArray(source[table]) || source[table].length === 0) {
      throw new SyncError(`Prune source is unexpectedly empty for ${table}.`, `Supabase ${table} is empty; pruning is blocked to prevent accidental deletion.`);
    }
  }
  const maps = sourceNaturalMaps(source);
  const validReference = (map, id) => id === null || id === undefined || map.has(Number(id));
  for (const row of source.campus_routes) {
    if (!maps.buildingById.has(Number(row.destination_building_id))) {
      throw new SyncError('Prune source has an unresolved campus-route building.', 'Supabase contains an unresolved campus-route building reference; pruning is blocked.');
    }
  }
  for (const row of source.campus_route_steps) {
    if (!maps.routeById.has(Number(row.route_id))) {
      throw new SyncError('Prune source has an unresolved route-step route.', 'Supabase contains an unresolved route-step reference; pruning is blocked.');
    }
  }
  for (const row of source.route_nodes) {
    if (!validReference(maps.buildingById, row.building_id)) {
      throw new SyncError('Prune source has an unresolved route-node building.', 'Supabase contains an unresolved route-node building reference; pruning is blocked.');
    }
  }
  for (const row of source.route_edges) {
    if (!maps.nodeById.has(Number(row.from_node_id)) || !maps.nodeById.has(Number(row.to_node_id))) {
      throw new SyncError('Prune source has an unresolved route edge.', 'Supabase contains an unresolved route-edge endpoint; pruning is blocked.');
    }
  }
  for (const row of source.vr_scenes) {
    if (!validReference(maps.nodeById, row.node_id) || !validReference(maps.buildingById, row.building_id)) {
      throw new SyncError('Prune source has an unresolved VR-scene reference.', 'Supabase contains an unresolved VR-scene reference; pruning is blocked.');
    }
  }
}

function printPlan(plan, target, options = {}) {
  const { applyMode = false, pruneMode = false, sourceFp = null, targetFp = null, mysqlTargetFp = null } = options;
  console.log(`=== Supabase -> MySQL campus/VR ${pruneMode ? 'strict sync' : 'merge'} ===`);
  console.log(applyMode
    ? 'APPLY PREFLIGHT: confirmation was accepted; writes occur only after the checks below.'
    : 'READ ONLY: no MySQL or Supabase data was changed by this preview.');
  console.log(pruneMode
    ? 'Prune mode: matched rows are upserted and MySQL-only rows are proposed for removal.'
    : 'Merge mode: natural-key upserts preserve MySQL-only rows.');
  console.log('');
  console.log('Table                         Supabase  MySQL   add  change  present  local-only');
  console.log('-------------------------------------------------------------------------------');
  for (const table of TABLES) {
    const summary = summarize(plan.entries[table], target[table] || []);
    console.log(`${table.padEnd(29)} ${String(summary.source).padStart(8)} ${String(summary.target).padStart(6)} ${String(summary.insert).padStart(5)} ${String(summary.update).padStart(7)} ${String(summary.present).padStart(8)} ${String(summary.localOnly).padStart(10)}`);
  }
  if (pruneMode) {
    console.log('');
    console.log('MySQL-only rows proposed for removal (natural keys):');
    let removalCount = 0;
    for (const table of DELETE_ORDER) {
      for (const item of plan.removals[table] || []) {
        console.log(`  ${table}: ${JSON.stringify(item.key)}`);
        removalCount += 1;
      }
    }
    if (removalCount === 0) console.log('  (none)');
    if (!applyMode && sourceFp && targetFp) {
      console.log(`Prune preview token: ${previewToken(sourceFp, targetFp, plan, mysqlTargetFp)}`);
    }
  }
  console.log('');
  console.log('Protected and untouched: users, profiles, app_sessions, room_schedules, announcements, team_members, events, FAQs, settings, and logs.');
}

function affectedRows(plan, target, extraRouteEdgeIds = []) {
  const backup = {};
  for (const table of TABLES) {
    const ids = new Set(plan.entries[table].filter((entry) => entry.targetRow).map((entry) => Number(entry.targetRow.id)));
    if (table === 'route_edges') {
      for (const id of extraRouteEdgeIds) ids.add(Number(id));
    }
    backup[table] = (target[table] || []).filter((row) => ids.has(Number(row.id)));
  }
  return backup;
}

function isWithinDirectory(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

async function validateBackupDirectory(directory) {
  if (typeof directory !== 'string' || !directory.trim() || !path.isAbsolute(directory)) {
    throw new SyncError('Prune backup directory must be absolute.', 'Choose an existing absolute backup folder outside the repository.');
  }
  let realDirectory;
  let repositoryRoot;
  try {
    [realDirectory, repositoryRoot] = await Promise.all([
      fs.promises.realpath(directory),
      fs.promises.realpath(path.resolve(__dirname, '..'))
    ]);
    const stats = await fs.promises.stat(realDirectory);
    if (!stats.isDirectory()) throw new Error('not a directory');
  } catch (_) {
    throw new SyncError('Prune backup directory is unavailable.', 'The chosen backup folder must already exist and be accessible.');
  }
  if (isWithinDirectory(repositoryRoot, realDirectory)) {
    throw new SyncError('Prune backup directory is inside the repository.', 'Choose a backup folder outside the repository.');
  }
  return realDirectory;
}

async function writeBackup(snapshot, sourceFp, targetFp, backupDirectory = os.tmpdir(), mysqlTargetFp = null) {
  const filename = `campusphere-campus-vr-backup-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.json`;
  const file = path.join(backupDirectory, filename);
  const tableCounts = Object.fromEntries(TABLES.map((table) => [table, (snapshot[table] || []).length]));
  const snapshotFp = fingerprint(snapshot);
  const body = {
    schema_version: BACKUP_SCHEMA_VERSION,
    created_at: new Date().toISOString(),
    source_fingerprint: sourceFp,
    target_fingerprint: targetFp,
    mysql_target_fingerprint: mysqlTargetFp,
    snapshot_fingerprint: snapshotFp,
    table_counts: tableCounts,
    tables: snapshot
  };
  let handle = null;
  let fileCreated = false;
  try {
    const bytes = Buffer.from(`${JSON.stringify(body, null, 2)}\n`, 'utf8');
    const writtenDigest = crypto.createHash('sha256').update(bytes).digest('hex');
    handle = await fs.promises.open(file, 'wx', 0o600);
    fileCreated = true;
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = null;

    const savedBytes = await fs.promises.readFile(file);
    const saved = JSON.parse(savedBytes.toString('utf8'));
    const savedDigest = crypto.createHash('sha256').update(savedBytes).digest('hex');
    if (savedDigest !== writtenDigest ||
        saved.schema_version !== BACKUP_SCHEMA_VERSION ||
        saved.source_fingerprint !== sourceFp ||
        saved.target_fingerprint !== targetFp ||
        saved.mysql_target_fingerprint !== mysqlTargetFp ||
        saved.snapshot_fingerprint !== snapshotFp ||
        fingerprint(saved.tables) !== snapshotFp ||
        stableJson(saved.table_counts) !== stableJson(tableCounts)) {
      throw new Error('backup verification failed');
    }
    return { path: file, sha256: savedDigest, snapshotFingerprint: snapshotFp, tableCounts };
  } catch (_) {
    let cleanupFailed = false;
    if (handle) {
      try { await handle.close(); } catch (_) { /* Preserve the original backup failure. */ }
      handle = null;
    }
    if (fileCreated) {
      try { await fs.promises.unlink(file); } catch (_) { cleanupFailed = true; }
    }
    const detail = cleanupFailed ? ` An incomplete backup may remain at ${file}.` : '';
    throw new SyncError('Unable to create the campus/VR pre-write backup.', `Unable to create and verify the pre-write campus/VR backup; no database changes were committed.${detail}`);
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}

function mysqlTargetIsLocal(host = process.env.DB_HOST || '127.0.0.1') {
  return new Set(['localhost', '127.0.0.1', '::1', '[::1]']).has(String(host).trim().toLowerCase());
}

async function mysqlTargetFingerprint(conn) {
  const [rows] = await conn.query('SELECT DATABASE() AS database_name, @@hostname AS server_name, @@port AS server_port');
  if (!rows[0] || !rows[0].database_name) {
    throw new SyncError('MySQL target identity is unavailable.', 'Unable to identify the selected MySQL database; sync stopped without writing.');
  }
  return fingerprint(rows[0]);
}

async function readDeleteMetadata(conn) {
  const placeholders = TABLES.map(() => '?').join(', ');
  const [foreignKeys] = await conn.query(`
    SELECT kcu.TABLE_NAME AS child_table,
           kcu.COLUMN_NAME AS child_column,
           kcu.REFERENCED_TABLE_NAME AS parent_table,
           kcu.REFERENCED_COLUMN_NAME AS parent_column,
           rc.DELETE_RULE AS delete_rule
      FROM information_schema.KEY_COLUMN_USAGE kcu
      JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
        ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
       AND rc.TABLE_NAME = kcu.TABLE_NAME
       AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
     WHERE kcu.CONSTRAINT_SCHEMA = DATABASE()
       AND kcu.REFERENCED_TABLE_NAME IN (${placeholders})
     ORDER BY kcu.REFERENCED_TABLE_NAME, kcu.TABLE_NAME, kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION`, TABLES);
  const [triggers] = await conn.query(`
    SELECT EVENT_OBJECT_TABLE AS table_name, TRIGGER_NAME AS trigger_name
      FROM information_schema.TRIGGERS
     WHERE TRIGGER_SCHEMA = DATABASE()
       AND EVENT_OBJECT_TABLE IN (${placeholders})
     ORDER BY EVENT_OBJECT_TABLE, TRIGGER_NAME`, TABLES);
  return { foreignKeys, triggers };
}

function assertNoScopedTriggers(metadata) {
  if (metadata.triggers.length) {
    throw new SyncError('Scoped MySQL trigger found.', 'Pruning is blocked because a MySQL trigger exists on a campus/VR table.');
  }
}

function deletionIds(plan, table) {
  return (plan.removals[table] || []).map(({ targetRow }) => Number(targetRow.id));
}

async function assertNoExternalReferences(conn, plan, metadata) {
  for (const foreignKey of metadata.foreignKeys) {
    const parentTable = String(foreignKey.parent_table || '').toLowerCase();
    const childTable = String(foreignKey.child_table || '').toLowerCase();
    const ids = deletionIds(plan, parentTable);
    if (!ids.length || TABLES.includes(childTable)) continue;
    if (String(foreignKey.parent_column || '').toLowerCase() !== 'id') {
      throw new SyncError('Unsupported campus/VR foreign key.', 'Pruning is blocked by an unsupported foreign-key reference.');
    }
    const childColumn = quoteIdentifier(String(foreignKey.child_column || ''));
    const childName = quoteIdentifier(String(foreignKey.child_table || ''));
    for (let offset = 0; offset < ids.length; offset += 400) {
      const batch = ids.slice(offset, offset + 400);
      const placeholders = batch.map(() => '?').join(', ');
      const [rows] = await conn.query(`SELECT 1 AS referenced FROM ${childName} WHERE ${childColumn} IN (${placeholders}) LIMIT 1`, batch);
      if (rows.length) {
        throw new SyncError('Scoped row has a protected reference.', `Pruning is blocked because ${foreignKey.child_table} refers to a MySQL-only ${foreignKey.parent_table} row.`);
      }
    }
  }
}

function assertNoRemainingScopedReferences(plan, target, metadata) {
  const removals = Object.fromEntries(TABLES.map((table) => [table, new Set(deletionIds(plan, table))]));
  for (const foreignKey of metadata.foreignKeys) {
    const parentTable = String(foreignKey.parent_table || '').toLowerCase();
    const childTable = String(foreignKey.child_table || '').toLowerCase();
    const parentIds = removals[parentTable];
    if (!parentIds || !parentIds.size || !TABLES.includes(childTable)) continue;
    if (String(foreignKey.parent_column || '').toLowerCase() !== 'id') {
      throw new SyncError('Unsupported campus/VR foreign key.', 'Pruning is blocked by an unsupported foreign-key reference.');
    }
    const childDeletes = removals[childTable];
    const hasRetainedReference = (target[childTable] || []).some((row) =>
      parentIds.has(Number(row[foreignKey.child_column])) && !childDeletes.has(Number(row.id)));
    if (hasRetainedReference) {
      throw new SyncError('Retained scoped row references a prune candidate.', `Pruning is blocked because a retained ${foreignKey.child_table} row refers to a MySQL-only ${foreignKey.parent_table} row.`);
    }
  }
}

async function deleteLocalOnlyRows(conn, plan) {
  let deleted = 0;
  for (const table of DELETE_ORDER) {
    const entries = plan.removals[table] || [];
    for (let offset = 0; offset < entries.length; offset += 400) {
      const batch = entries.slice(offset, offset + 400);
      const ids = batch.map(({ targetRow }) => Number(targetRow.id));
      const placeholders = ids.map(() => '?').join(', ');
      const [result] = await conn.query(`DELETE FROM ${quoteIdentifier(table)} WHERE ${quoteIdentifier(ID_FIELD[table])} IN (${placeholders})`, ids);
      if (!result || Number(result.affectedRows) !== ids.length) {
        throw new SyncError(`Delete count mismatch for ${table}.`, 'A campus/VR row changed during pruning; the transaction was rolled back.');
      }
      deleted += ids.length;
    }
  }
  return deleted;
}

async function upsertTable(conn, table, entries) {
  const fields = SYNC_FIELDS[table];
  const quotedFields = fields.map(quoteIdentifier).join(', ');
  for (const entry of entries) {
    if (entry.action === 'present') continue;
    const values = fields.map((field) => entry.desired[field] === undefined ? null : entry.desired[field]);
    if (entry.targetRow) {
      const setSql = fields.map((field) => `${quoteIdentifier(field)} = ?`).join(', ');
      await conn.query(`UPDATE ${quoteIdentifier(table)} SET ${setSql} WHERE ${quoteIdentifier(ID_FIELD[table])} = ?`, [...values, Number(entry.targetRow.id)]);
    } else {
      await conn.query(`INSERT INTO ${quoteIdentifier(table)} (${quotedFields}) VALUES (${fields.map(() => '?').join(', ')})`, values);
    }
  }
}

function remapPlanAfterUpserts(source, target) {
  // Rebuild all target natural maps after dependency rows have been inserted.
  return buildPlan(source, target);
}

async function verifySourcePresent(conn, source, sourceFp, requireExact = false) {
  const after = await readMysql(conn);
  const plan = buildPlan(source, after);
  for (const table of TABLES) {
    for (const entry of plan.entries[table]) {
      if (!entry.targetRow || !sameFields(entry.desired, entry.current)) {
        throw new SyncError(`Post-write parity failed for ${table}.`, `MySQL campus/VR parity failed after the transaction; the transaction was rolled back.`);
      }
    }
  }
  if (requireExact && TABLES.some((table) => plan.removals[table].length > 0)) {
    throw new SyncError('Strict parity still has local-only rows.', 'MySQL campus/VR parity failed; the transaction was rolled back.');
  }
  if (sourceFingerprint(source) !== sourceFp) throw new SyncError('Source changed during parity verification.', 'Supabase changed during campus/VR verification; the transaction was rolled back.');
  return { after, plan };
}

async function rollbackAndVerify(conn, expectedTargetFingerprint, expectedProtectedFingerprint = null) {
  try {
    await conn.rollback();
    const rolledBack = await readMysql(conn);
    if (targetFingerprint(rolledBack) !== expectedTargetFingerprint) return false;
    if (expectedProtectedFingerprint && !protectedEqual(expectedProtectedFingerprint, await protectedFingerprint(conn))) return false;
    return true;
  } catch (_) {
    return false;
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const apply = args.includes('--apply');
  const dryRun = args.includes('--dry-run');
  if (args.includes('--help') || args.includes('-h')) return { help: true, apply: false };
  const prune = args.includes('--prune');
  if (['--apply', '--dry-run', '--prune'].some((flag) => args.filter((arg) => arg === flag).length > 1)) {
    throw new SyncError('Repeated sync mode flag.', 'Use each sync mode flag once; no data was written.');
  }
  const values = (name) => args.filter((arg) => arg.startsWith(`${name}=`)).map((arg) => arg.slice(name.length + 1));
  const oneValue = (name) => {
    const found = values(name);
    if (found.length > 1 || found.some((value) => value.length === 0)) {
      throw new SyncError(`Invalid repeated or blank ${name} option.`, `Use ${name}= once with a non-empty value; no data was written.`);
    }
    return found[0] || null;
  };
  const confirmation = oneValue('--confirm');
  const suppliedPreviewToken = oneValue('--preview-token');
  const backupDirectory = oneValue('--backup-dir');
  if (apply && dryRun) throw new SyncError('Conflicting sync mode flags.', 'Use either --dry-run or --apply, not both.');
  const allowed = new Set(['--apply', '--dry-run', '--prune']);
  if (args.some((arg) => !allowed.has(arg) &&
      !arg.startsWith('--confirm=') && !arg.startsWith('--preview-token=') && !arg.startsWith('--backup-dir='))) {
    throw new SyncError('Unknown sync argument.', 'Unknown sync argument; no data was written.');
  }
  if (prune && !apply && !dryRun) throw new SyncError('Prune mode needs an explicit preview or apply mode.', 'Use --prune --dry-run to preview removals; no data was written.');
  if (apply && prune && (!confirmation || confirmation !== PRUNE_CONFIRMATION)) {
    throw new SyncError('Missing prune confirmation.', `Prune apply is blocked. Use the exact confirmation token: ${PRUNE_CONFIRMATION}`);
  }
  if (apply && !prune && confirmation === PRUNE_CONFIRMATION) {
    throw new SyncError('Prune confirmation used without prune mode.', 'The prune confirmation requires --prune; no data was written.');
  }
  if (apply && !prune && (!confirmation || confirmation !== APPLY_CONFIRMATION)) {
    throw new SyncError('Missing apply confirmation.', `Merge apply is blocked. Use the exact confirmation token: ${APPLY_CONFIRMATION}`);
  }
  if (apply && prune && (!suppliedPreviewToken || !/^[a-f0-9]{64}$/i.test(suppliedPreviewToken))) {
    throw new SyncError('Missing prune preview token.', 'Prune apply requires the 64-character token from a current --prune --dry-run preview.');
  }
  if (apply && prune && !backupDirectory) throw new SyncError('Missing prune backup directory.', 'Prune apply requires --backup-dir with an existing absolute folder outside the repository.');
  if (apply && !prune && (suppliedPreviewToken || backupDirectory)) {
    throw new SyncError('Prune options require prune mode.', 'Use --prune with the preview token and backup folder; no data was written.');
  }
  if (!apply && confirmation) throw new SyncError('Confirmation requires apply.', 'The confirmation token is valid only with --apply; no data was written.');
  if (!prune && (suppliedPreviewToken || backupDirectory)) throw new SyncError('Prune options require prune mode.', 'Use --prune with the preview token and backup folder; no data was written.');
  if (prune && !apply && (suppliedPreviewToken || backupDirectory)) throw new SyncError('Preview does not accept apply-only options.', 'Use only --prune --dry-run for a preview; no data was written.');
  return {
    help: false,
    apply,
    dryRun: dryRun || !apply,
    prune,
    previewToken: suppliedPreviewToken,
    backupDirectory
  };
}

function usage() {
  console.log('Usage: node scripts/syncCampusVrSupabaseToMysql.js --dry-run');
  console.log(`Apply: node scripts/syncCampusVrSupabaseToMysql.js --apply --confirm=${APPLY_CONFIRMATION}`);
  console.log('Prune preview: node scripts/syncCampusVrSupabaseToMysql.js --prune --dry-run');
  console.log(`Prune apply: node scripts/syncCampusVrSupabaseToMysql.js --prune --apply --confirm=${PRUNE_CONFIRMATION} --preview-token=<token> --backup-dir=<absolute-folder-outside-repository>`);
}

function samePruneManifest(leftPlan, rightPlan) {
  return stableJson(pruneManifest(leftPlan)) === stableJson(pruneManifest(rightPlan));
}

function appendBackupPath(message, backupPath) {
  if (!backupPath || /Pre-write backup:/.test(message)) return message;
  return `${message} Pre-write backup: ${backupPath}`;
}

async function main(argv = process.argv) {
  const args = parseArgs(argv);
  if (args.help) { usage(); return; }
  const runtime = loadRuntimeAdapters();
  if (!runtime.supabase.hasSupabaseConfig()) throw new SyncError('Supabase is not configured.', 'Supabase configuration is missing; no data was written.');
  if (args.prune && args.apply && !mysqlTargetIsLocal()) {
    throw new SyncError('Prune target is not local MySQL.', 'Pruning is allowed only when DB_HOST points to this computer.');
  }
  const backupDirectory = args.prune && args.apply ? await validateBackupDirectory(args.backupDirectory) : null;
  const sb = runtime.supabase.getSupabaseClient();
  const conn = await runtime.db.getConnection();
  let committed = false;
  let transactionStarted = false;
  let backupPath = null;
  let sourceFp = null;
  let targetFp = null;
  try {
    const source = await readSource(sb);
    const target = await readMysql(conn);
    sourceFp = sourceFingerprint(source);
    targetFp = targetFingerprint(target);
    const protectedBefore = await protectedFingerprint(conn);
    const previewPlan = buildPlan(source, target);
    const mysqlTargetFp = args.prune ? await mysqlTargetFingerprint(conn) : null;
    let metadata = null;
    if (args.prune) {
      validatePruneSource(source);
    }
    printPlan(previewPlan, target, {
      applyMode: args.apply,
      pruneMode: args.prune,
      sourceFp,
      targetFp,
      mysqlTargetFp
    });
    if (args.prune) {
      metadata = await readDeleteMetadata(conn);
      assertNoScopedTriggers(metadata);
      await assertNoExternalReferences(conn, previewPlan, metadata);
    }
    console.log(`Source fingerprint: ${sourceFp}`);
    console.log(`MySQL fingerprint:  ${targetFp}`);
    if (mysqlTargetFp) console.log(`MySQL instance fingerprint: ${mysqlTargetFp}`);
    if (!args.apply) {
      console.log(args.prune ? 'Prune preview complete. No data was written.' : 'Preview complete. No data was written.');
      return;
    }

    const approvedPreviewToken = args.prune ? previewToken(sourceFp, targetFp, previewPlan, mysqlTargetFp) : null;
    if (args.prune && approvedPreviewToken !== args.previewToken) {
      throw new SyncError('Prune preview token is stale.', 'The Supabase or MySQL data changed after preview. Run a new --prune --dry-run and review its token.');
    }

    const freshSource = await readSource(sb);
    if (sourceFingerprint(freshSource) !== sourceFp) throw new SyncError('Supabase changed during preflight.', 'Supabase changed between preview and apply; sync stopped without writing.');
    await conn.beginTransaction();
    transactionStarted = true;
    try {
      const lockedTarget = await readMysql(conn, TABLES, true);
      if (targetFingerprint(lockedTarget) !== targetFp) throw new SyncError('MySQL changed during preflight.', 'MySQL changed between preview and apply; sync stopped without writing.');
      if (args.prune && await mysqlTargetFingerprint(conn) !== mysqlTargetFp) {
        throw new SyncError('MySQL target changed during preflight.', 'The selected MySQL database changed after preview; pruning stopped without writing.');
      }
      const protectedLocked = await protectedFingerprint(conn);
      if (!protectedEqual(protectedBefore, protectedLocked)) throw new SyncError('Protected data changed during preflight.', 'Protected local data changed between preview and apply; sync stopped without writing.');
      if (args.prune) {
        validatePruneSource(freshSource);
        const lockedMetadata = await readDeleteMetadata(conn);
        assertNoScopedTriggers(lockedMetadata);
        if (fingerprint(lockedMetadata) !== fingerprint(metadata)) {
          throw new SyncError('MySQL delete metadata changed during preflight.', 'MySQL foreign-key or trigger metadata changed after preview; pruning stopped without writing.');
        }
      }
      const endpointRepairs = endpointRepairRows(lockedTarget);
      const backupSnapshot = args.prune
        ? lockedTarget
        : affectedRows(previewPlan, lockedTarget, endpointRepairs.map((row) => row.id));
      const backup = await writeBackup(backupSnapshot, sourceFp, targetFp, backupDirectory || os.tmpdir(), mysqlTargetFp);
      backupPath = backup.path;

      // Dependency order. Re-read target maps after each phase so all foreign
      // keys are translated by natural key, never by a Supabase numeric id.
      const phases = ['buildings', 'campus_routes', 'route_nodes', 'room_schedule_documents', 'route_edges', 'vr_scenes', 'campus_route_steps', 'vr_hotspots'];
      let phaseTarget = lockedTarget;
      for (const table of phases) {
        const phasePlan = buildPlan(freshSource, phaseTarget);
        await upsertTable(conn, table, phasePlan.entries[table]);
        phaseTarget = await readMysql(conn, TABLES, true);
      }
      let finalPlan = buildPlan(freshSource, phaseTarget);
      if (args.prune) {
        if (!samePruneManifest(previewPlan, finalPlan)) {
          throw new SyncError('Prune candidates changed during apply.', 'The MySQL-only row list changed after preview; all sync changes were rolled back.');
        }
        assertNoRemainingScopedReferences(finalPlan, phaseTarget, metadata);
        await assertNoExternalReferences(conn, finalPlan, metadata);
        const latestSource = await readSource(sb);
        if (sourceFingerprint(latestSource) !== sourceFp) {
          throw new SyncError('Supabase changed before prune.', 'Supabase changed during sync; all MySQL changes were rolled back.');
        }
        await deleteLocalOnlyRows(conn, finalPlan);
        phaseTarget = await readMysql(conn, TABLES, true);
        finalPlan = buildPlan(freshSource, phaseTarget);
      }
      const repairedEndpoints = await repairEndpointGeometry(conn);
      await verifySourcePresent(conn, freshSource, sourceFp, args.prune);
      const protectedAfter = await protectedFingerprint(conn);
      if (!protectedEqual(protectedBefore, protectedAfter)) throw new SyncError('Protected data changed during sync.', 'Protected local data changed unexpectedly; all campus/VR changes were rolled back.');
      const sourceBeforeCommit = await readSource(sb);
      if (sourceFingerprint(sourceBeforeCommit) !== sourceFp) {
        throw new SyncError('Supabase changed before commit.', 'Supabase changed during sync; all MySQL changes were rolled back.');
      }
      await conn.commit();
      committed = true;
      const postCommit = await readMysql(conn);
      const postPlan = buildPlan(freshSource, postCommit);
      if (args.prune && TABLES.some((table) => postPlan.removals[table].length > 0)) {
        throw new SyncError('Post-commit strict parity failed.', `MySQL campus/VR parity failed after commit. Review the verified backup before using local MySQL. Pre-write backup: ${backupPath}`);
      }
      for (const table of TABLES) {
        for (const entry of postPlan.entries[table]) {
          if (!entry.targetRow || !sameFields(entry.desired, entry.current)) {
            throw new SyncError(`Post-commit parity failed for ${table}.`, `MySQL campus/VR parity failed after commit. Review the verified backup before using local MySQL. Pre-write backup: ${backupPath}`);
          }
        }
      }
      console.log(args.prune
        ? 'PRUNE APPLY OK: the eight scoped MySQL campus/VR tables now match Supabase by natural key.'
        : 'APPLY OK: campus/VR source rows merged into MySQL without deleting local-only rows.');
      console.log(`Pre-write backup: ${backupPath}`);
      console.log(`Backup SHA-256: ${backup.sha256}`);
      console.log(`Applied source fingerprint: ${sourceFp}`);
      console.log(`Route-edge endpoints normalized: ${repairedEndpoints}`);
      console.log('Protected local tables remained unchanged.');
    } catch (error) {
      if (!committed && transactionStarted) {
        const rollbackVerified = await rollbackAndVerify(conn, targetFp, protectedBefore);
        if (!rollbackVerified) {
          throw new SyncError('Rollback verification failed.', appendBackupPath(
            'Sync failed and MySQL rollback could not be verified. Stop before using or retrying the local database.',
            backupPath
          ));
        }
        if (backupPath && error instanceof SyncError && !/Pre-write backup:/.test(error.publicMessage)) {
          error.publicMessage = appendBackupPath(error.publicMessage, backupPath);
        }
      }
      if (committed) {
        const postCommitMessage = error instanceof SyncError
          ? error.publicMessage
          : 'MySQL committed, but post-commit verification could not be completed.';
        throw new SyncError('Post-commit verification failed.', appendBackupPath(postCommitMessage, backupPath));
      }
      throw error;
    }
  } finally {
    conn.release();
    await runtime.db.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    const message = error instanceof SyncError ? error.publicMessage : 'Campus/VR sync failed safely; no uncommitted database changes remain.';
    console.error(`SYNC FAILED: ${message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  APPLY_CONFIRMATION,
  PRUNE_CONFIRMATION,
  TABLES,
  DELETE_ORDER,
  PROTECTED_TABLES,
  assertNoExternalReferences,
  assertNoRemainingScopedReferences,
  assertNoScopedTriggers,
  buildPlan,
  deleteLocalOnlyRows,
  mysqlTargetFingerprint,
  mysqlTargetIsLocal,
  parseArgs,
  previewToken,
  pruneManifest,
  readDeleteMetadata,
  rollbackAndVerify,
  sourceFingerprint,
  targetFingerprint,
  sameFields,
  snapEdgeGeometry,
  endpointRepairRows,
  validateBackupDirectory,
  validatePruneSource,
  writeBackup
};
