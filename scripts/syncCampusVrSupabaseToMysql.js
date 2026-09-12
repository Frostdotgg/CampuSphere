'use strict';

/*
 * Supabase -> local MySQL campus/VR merge.
 *
 * This is deliberately different from syncSupabaseContentToMysql.js: the
 * local rehearsal database can contain campus records that are not in the
 * selected Supabase project.  This utility upserts only the Supabase campus
 * and VR catalog by stable natural keys and never deletes a local row.
 * Users, profiles, sessions, schedules, announcements, events, FAQs,
 * settings, team members, and audit logs are protected by before/after
 * fingerprints.  room_schedule_documents are included only as references
 * required by VR schedule hotspots; room_schedules themselves are untouched.
 *
 * Default is a read-only preview. Apply requires the exact confirmation token:
 *   node scripts/syncCampusVrSupabaseToMysql.js --apply --confirm=SYNC_CAMPUS_VR_TO_MYSQL
 */

process.env.DOTENV_CONFIG_QUIET = 'true';
require('dotenv').config({ quiet: true });

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('../config/db');
const { getSupabaseClient, hasSupabaseConfig } = require('../config/supabase');
const { validatePathGeometry } = require('../utils/routeGeometry');

const APPLY_CONFIRMATION = 'SYNC_CAMPUS_VR_TO_MYSQL';
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
    const [rows] = await conn.query(`SELECT * FROM ${quoteIdentifier(table)}${suffix}`);
    target[table] = rows;
  }
  return target;
}

async function protectedFingerprint(conn) {
  const snapshot = {};
  for (const table of PROTECTED_TABLES) {
    const [rows] = await conn.query(`SELECT * FROM ${quoteIdentifier(table)}`);
    snapshot[table] = fingerprint(rows);
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
  const entries = {};
  for (const table of TABLES) {
    const sourceRows = source[table] || [];
    const targetRows = target[table] || [];
    const sourceKeyMap = keyed[table];
    const targetKeyMap = targetKeyMaps[table] || new Map();
    entries[table] = planTable(table, sourceRows, targetRows, sourceMaps, targetMaps, sourceKeyMap, targetKeyMap);
  }
  return { sourceMaps, targetMaps, entries, keyed };
}

function printPlan(plan, target, applyMode) {
  console.log('=== Supabase -> MySQL campus/VR merge ===');
  console.log(applyMode
    ? 'APPLY PREFLIGHT: the exact confirmation token was accepted; writes occur only after the checks below.'
    : 'READ ONLY: no MySQL or Supabase data was changed by this preview.');
  console.log('Natural-key upsert only; local-only rows are preserved and no row is deleted.');
  console.log('');
  console.log('Table                         Supabase  MySQL   add  change  present  local-only');
  console.log('-------------------------------------------------------------------------------');
  for (const table of TABLES) {
    const summary = summarize(plan.entries[table], target[table] || []);
    console.log(`${table.padEnd(29)} ${String(summary.source).padStart(8)} ${String(summary.target).padStart(6)} ${String(summary.insert).padStart(5)} ${String(summary.update).padStart(7)} ${String(summary.present).padStart(8)} ${String(summary.localOnly).padStart(10)}`);
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

async function writeBackup(snapshot, sourceFp, targetFp) {
  const filename = `campusphere-campus-vr-backup-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.json`;
  const file = path.join(os.tmpdir(), filename);
  const body = { created_at: new Date().toISOString(), source_fingerprint: sourceFp, target_fingerprint: targetFp, affected_rows: snapshot };
  try {
    await fs.promises.writeFile(file, `${JSON.stringify(body, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  } catch (_) {
    throw new SyncError('Unable to create the campus/VR pre-write backup.', 'Unable to create the pre-write campus/VR backup; no data was written.');
  }
  return file;
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

async function verifySourcePresent(conn, source, sourceFp) {
  const after = await readMysql(conn);
  const plan = buildPlan(source, after);
  for (const table of TABLES) {
    for (const entry of plan.entries[table]) {
      if (!entry.targetRow || !sameFields(entry.desired, entry.current)) {
        throw new SyncError(`Post-write parity failed for ${table}.`, `MySQL campus/VR parity failed after the transaction; the transaction was rolled back.`);
      }
    }
  }
  if (sourceFingerprint(source) !== sourceFp) throw new SyncError('Source changed during parity verification.', 'Supabase changed during campus/VR verification; the transaction was rolled back.');
  return after;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const apply = args.includes('--apply');
  const dryRun = args.includes('--dry-run');
  const confirmation = args.find((arg) => arg.startsWith('--confirm='));
  if (args.includes('--help') || args.includes('-h')) return { help: true, apply: false };
  if (apply && dryRun) throw new SyncError('Conflicting sync mode flags.', 'Use either --dry-run or --apply, not both.');
  if (args.some((arg) => !['--apply', '--dry-run'].includes(arg) && !arg.startsWith('--confirm='))) throw new SyncError('Unknown sync argument.', 'Unknown sync argument; no data was written.');
  if (apply && (!confirmation || confirmation.slice('--confirm='.length) !== APPLY_CONFIRMATION)) throw new SyncError('Missing apply confirmation.', `Apply is blocked. Use the exact confirmation token: ${APPLY_CONFIRMATION}`);
  if (!apply && confirmation) throw new SyncError('Confirmation requires apply.', 'The confirmation token is valid only with --apply; no data was written.');
  return { help: false, apply };
}

function usage() {
  console.log('Usage: node scripts/syncCampusVrSupabaseToMysql.js --dry-run');
  console.log(`Apply: node scripts/syncCampusVrSupabaseToMysql.js --apply --confirm=${APPLY_CONFIRMATION}`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { usage(); return; }
  if (!hasSupabaseConfig()) throw new SyncError('Supabase is not configured.', 'Supabase configuration is missing; no data was written.');
  const sb = getSupabaseClient();
  const conn = await db.getConnection();
  let committed = false;
  let backupPath = null;
  try {
    const source = await readSource(sb);
    const target = await readMysql(conn);
    const sourceFp = sourceFingerprint(source);
    const targetFp = targetFingerprint(target);
    const protectedBefore = await protectedFingerprint(conn);
    const previewPlan = buildPlan(source, target);
    printPlan(previewPlan, target, args.apply);
    console.log(`Source fingerprint: ${sourceFp}`);
    console.log(`MySQL fingerprint:  ${targetFp}`);
    if (!args.apply) { console.log('Preview complete. No data was written.'); return; }

    const freshSource = await readSource(sb);
    if (sourceFingerprint(freshSource) !== sourceFp) throw new SyncError('Supabase changed during preflight.', 'Supabase changed between preview and apply; sync stopped without writing.');
    await conn.beginTransaction();
    try {
      const lockedTarget = await readMysql(conn, TABLES, true);
      if (targetFingerprint(lockedTarget) !== targetFp) throw new SyncError('MySQL changed during preflight.', 'MySQL changed between preview and apply; sync stopped without writing.');
      const protectedLocked = await protectedFingerprint(conn);
      if (!protectedEqual(protectedBefore, protectedLocked)) throw new SyncError('Protected data changed during preflight.', 'Protected local data changed between preview and apply; sync stopped without writing.');
      const endpointRepairs = endpointRepairRows(lockedTarget);
      backupPath = await writeBackup(affectedRows(previewPlan, lockedTarget, endpointRepairs.map((row) => row.id)), sourceFp, targetFp);

      // Dependency order. Re-read target maps after each phase so all foreign
      // keys are translated by natural key, never by a Supabase numeric id.
      const phases = ['buildings', 'campus_routes', 'route_nodes', 'room_schedule_documents', 'route_edges', 'vr_scenes', 'campus_route_steps', 'vr_hotspots'];
      let phaseTarget = lockedTarget;
      for (const table of phases) {
        const phasePlan = buildPlan(freshSource, phaseTarget);
        await upsertTable(conn, table, phasePlan.entries[table]);
        phaseTarget = await readMysql(conn, TABLES, true);
      }
      const repairedEndpoints = await repairEndpointGeometry(conn);
      const verified = await verifySourcePresent(conn, freshSource, sourceFp);
      const protectedAfter = await protectedFingerprint(conn);
      if (!protectedEqual(protectedBefore, protectedAfter)) throw new SyncError('Protected data changed during sync.', 'Protected local data changed unexpectedly; all campus/VR changes were rolled back.');
      await conn.commit();
      committed = true;
      const postCommit = await readMysql(conn);
      const postPlan = buildPlan(freshSource, postCommit);
      for (const table of TABLES) {
        for (const entry of postPlan.entries[table]) {
          if (!entry.targetRow || !sameFields(entry.desired, entry.current)) throw new SyncError(`Post-commit parity failed for ${table}.`, `MySQL campus/VR parity failed after commit. Restore the tested backup before using local MySQL.`);
        }
      }
      console.log(`APPLY OK: campus/VR source rows merged into MySQL without deleting local-only rows.`);
      console.log(`Pre-write backup: ${backupPath}`);
      console.log(`Applied source fingerprint: ${sourceFp}`);
      console.log(`Route-edge endpoints normalized: ${repairedEndpoints}`);
      console.log('Protected local tables remained unchanged.');
    } catch (error) {
      if (!committed) await conn.rollback().catch(() => {});
      throw error;
    }
  } finally {
    conn.release();
    await db.end();
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
  TABLES,
  PROTECTED_TABLES,
  buildPlan,
  sourceFingerprint,
  targetFingerprint,
  sameFields,
  snapEdgeGeometry,
  endpointRepairRows
};
