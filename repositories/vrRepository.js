'use strict';

/* ========================================
   CampuSphere - VR Repository (Supabase reads)
   Milestone 5, Section 5.3.

   Supabase-backed READ methods for the `vr_scenes` and `vr_hotspots`
   tables. No write methods and no admin VR CRUD exist yet (see
   database/supabase/REPOSITORY_BOUNDARIES.md Boundary 5); add them
   only when an admin VR UI ships. No controller consumes this module
   until Sections 5.4/5.5.

   Boundary rules (REPOSITORY_BOUNDARIES.md Boundary 5):
   - Imports `config/supabase.js` ONLY (getSupabaseClient). It does NOT
     import config/db.js, config/vrDataSource.js, any repository,
     controller, route, middleware, or public/browser file.
   - Never reads req / res / sessions / res.locals / app.locals /
     browser globals. Inputs are plain values; role/HTTP decisions stay
     in the controller.
   - Returns plain row-like objects in the MySQL-era shapes the
     controllers/views already consume; the controllers keep owning
     response/EJS shaping and path-walk de-duplication:
       scene browser : id, scene_key, title, description, image_url,
                       initial_yaw, initial_pitch, display_order
       graph scene   : id, scene_key, title, description, image_url,
                       node_id, building_id, initial_yaw, initial_pitch,
                       display_order
       hotspot       : hotspot_type, label, text, yaw, pitch,
                       target_scene_id, target_scene_key, target_title,
                       schedule_building_id, schedule_location_type,
                       schedule_location_label, schedule_floor_label
   - Explicit column lists only (never select('*')), so reserved columns
     (cloudinary_public_id, created_at, updated_at) and the nested target
     embed never leak into returned shapes.
   - Supabase failures are rethrown as plain Error objects prefixed with
     `vrRepository.<method>:`, carrying only a redacted Supabase message
     (never keys, URLs, headers, or other secret-like values).
   ======================================== */

const { getSupabaseClient } = require('../config/supabase');

// Explicit column lists pin the MySQL-era row shapes and keep reserved
// columns (cloudinary_public_id, created_at, updated_at) out of results.
const SCENE_BROWSER_COLUMNS =
  'id, scene_key, title, description, image_url, initial_yaw, initial_pitch, display_order';
const GRAPH_SCENE_COLUMNS =
  'id, scene_key, title, description, image_url, node_id, building_id, initial_yaw, initial_pitch, display_order';
// Hotspot columns plus the to-one target scene embedded via the
// target_scene_id FK. The embed is flattened into target_scene_key /
// target_title below; the nested object itself is never returned.
const HOTSPOT_SELECT =
  'hotspot_type, label, text, yaw, pitch, target_scene_id, ' +
  'schedule_building_id, schedule_location_type, schedule_location_label, schedule_floor_label, ' +
  'target:vr_scenes!vr_hotspots_target_scene_id_fkey(scene_key, title)';

// Redact anything that could resemble the service role key (a JWT) or a
// full Supabase URL before it reaches an Error message / log. Mirrors the
// defensive scrub in repositories/contentRepository.js and
// scripts/supabase-smoke.js.
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

// Wrap a Supabase error as a plain Error with a fixed method prefix and
// only the redacted message. Never includes keys/URLs/credentials.
function fail(method, error) {
  return new Error('vrRepository.' + method + ': ' + safeSupabaseMessage(error));
}

// Sanitize an arbitrary input into a list of unique positive integer ids.
// Non-arrays, non-integers, zero, negatives, and duplicates are dropped so
// PostgREST `in.(...)` filters are built only from verified integers.
function sanitizeIds(arr) {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    const n = Number(v);
    if (Number.isInteger(n) && n > 0 && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

/**
 * All scenes for the scene browser (vrController.viewer), ordered by
 * display_order ASC then id ASC. Returns the scene-browser row shape.
 */
async function listAllScenes() {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('vr_scenes')
    .select(SCENE_BROWSER_COLUMNS)
    .order('display_order', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw fail('listAllScenes', error);
  return data || [];
}

/**
 * One scene by its stable scene_key (exact, case-sensitive match after
 * trimming), or null. Non-string / blank keys return null WITHOUT querying.
 * Returns the same scene-browser row shape as listAllScenes.
 */
async function findSceneByKey(sceneKey) {
  const key = typeof sceneKey === 'string' ? sceneKey.trim() : '';
  if (key === '') return null;

  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('vr_scenes')
    .select(SCENE_BROWSER_COLUMNS)
    .eq('scene_key', key)
    .maybeSingle();
  if (error) throw fail('findSceneByKey', error);
  return data || null;
}

/**
 * Hotspots for a scene, ordered by display_order ASC then id ASC. Invalid
 * / non-positive ids return [] without querying. The to-one target scene
 * (LEFT JOIN equivalent via the FK embed) is flattened into
 * target_scene_key / target_title; a missing target yields null for both,
 * and the nested target object is never leaked.
 */
async function listHotspotsForScene(sceneId) {
  const numId = Number(sceneId);
  if (!Number.isInteger(numId) || numId < 1) return [];

  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('vr_hotspots')
    .select(HOTSPOT_SELECT)
    .eq('scene_id', numId)
    .order('display_order', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw fail('listHotspotsForScene', error);

  return (data || []).map((h) => {
    // PostgREST returns a to-one embed as an object (null when unmatched);
    // guard against an array shape defensively, then drop the nested object.
    const t = Array.isArray(h.target) ? (h.target[0] || null) : (h.target || null);
    return {
      hotspot_type: h.hotspot_type,
      label: h.label,
      text: h.text,
      yaw: h.yaw,
      pitch: h.pitch,
      target_scene_id: h.target_scene_id,
      target_scene_key: t ? t.scene_key : null,
      target_title: t ? t.title : null,
      schedule_building_id: h.schedule_building_id == null ? null : h.schedule_building_id,
      schedule_location_type: h.schedule_location_type == null ? null : h.schedule_location_type,
      schedule_location_label: h.schedule_location_label == null ? null : h.schedule_location_label,
      schedule_floor_label: h.schedule_floor_label == null ? null : h.schedule_floor_label
    };
  });
}

/**
 * Scenes whose node_id OR building_id is in the supplied id lists, for the
 * guided-route scene mapping (vrController.resolveRouteScenes). Both inputs
 * are sanitized to unique positive integers; if both are empty this returns
 * [] WITHOUT querying (never "all scenes"). Returns the graph-scene row
 * shape ordered by display_order ASC then id ASC. The controller still owns
 * the ordered path walk and per-path de-duplication.
 */
async function listScenesForGraphPath({ nodeIds, buildingIds } = {}) {
  const nodes = sanitizeIds(nodeIds);
  const buildings = sanitizeIds(buildingIds);
  if (nodes.length === 0 && buildings.length === 0) return [];

  const sb = getSupabaseClient();
  let query = sb.from('vr_scenes').select(GRAPH_SCENE_COLUMNS);

  if (nodes.length > 0 && buildings.length > 0) {
    // Both filters built only from sanitized integers, so the .or() string
    // cannot carry arbitrary input.
    query = query.or(
      'node_id.in.(' + nodes.join(',') + '),building_id.in.(' + buildings.join(',') + ')'
    );
  } else if (nodes.length > 0) {
    query = query.in('node_id', nodes);
  } else {
    query = query.in('building_id', buildings);
  }

  query = query
    .order('display_order', { ascending: true })
    .order('id', { ascending: true });

  const { data, error } = await query;
  if (error) throw fail('listScenesForGraphPath', error);
  return data || [];
}

/* ---------------------------------------------------------------------------
   BE.4 natural-key guided-walkthrough reads. Batched and bounded — one scene
   read for the whole configured key list and one link read for the resolved
   scene ids (never one query per scene). Explicit columns only, so
   cloudinary_public_id / timestamps can never leak into guided responses.
--------------------------------------------------------------------------- */

// Bound + sanitize a natural scene-key list: strings only, trimmed,
// non-empty, de-duplicated, conservative charset, hard cap. Anything else is
// dropped so the PostgREST in() filter is built only from verified keys.
const SCENE_KEYS_MAX = 100;
function sanitizeSceneKeys(arr) {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    if (typeof v !== 'string') continue;
    const key = v.trim();
    if (key === '' || key.length > 60) continue;
    if (!/^[A-Za-z0-9_-]+$/.test(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= SCENE_KEYS_MAX) break;
  }
  return out;
}

/**
 * Scenes matching a bounded list of natural scene keys, in the graph-scene
 * row shape, ordered by display_order ASC then id ASC. An empty/invalid key
 * list returns [] WITHOUT querying (never "all scenes").
 */
async function listScenesByKeys(sceneKeys) {
  const keys = sanitizeSceneKeys(sceneKeys);
  if (keys.length === 0) return [];

  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('vr_scenes')
    .select(GRAPH_SCENE_COLUMNS)
    .in('scene_key', keys)
    .order('display_order', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw fail('listScenesByKeys', error);
  return data || [];
}

/**
 * Directional scene->scene link rows (hotspot_type='scene' only) for a
 * bounded list of source scene ids. Returns ONLY
 * { scene_id, target_scene_id, hotspot_type } — no labels, text, angles, or
 * schedule metadata — because the guided verifier needs link existence, not
 * presentation. Invalid/empty id lists return [] without querying.
 */
async function listSceneLinkHotspots(sceneIds) {
  const ids = sanitizeIds(sceneIds);
  if (ids.length === 0) return [];

  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('vr_hotspots')
    .select('scene_id, target_scene_id, hotspot_type')
    .eq('hotspot_type', 'scene')
    .in('scene_id', ids);
  if (error) throw fail('listSceneLinkHotspots', error);
  return data || [];
}

/* ===========================================================================
   Admin VR write / admin-read methods (Milestone 7, Section 7.8).

   Server-only, used exclusively by controllers/adminVrController.js behind the
   /admin requireRole('admin') gate. Validation, HTTP status decisions, the
   inbound-reference delete guard, and audit logging all stay in the controller;
   these methods are thin, parameterised data access. Explicit column lists pin
   the admin row shapes (cloudinary_public_id, created_at, updated_at are never
   returned). Single-row writes are atomic in Postgres; the scene-delete guard
   is enforced controller-side (check inbound refs, then delete).
=========================================================================== */

// Admin scene shape: full editable column set incl. cloudinary_public_id
// (Section 10.6; admin-only — the public/runtime scene shapes above never carry it).
const SCENE_ADMIN_COLUMNS =
  'id, scene_key, title, description, image_url, cloudinary_public_id, node_id, building_id, ' +
  'initial_yaw, initial_pitch, display_order';
// Admin hotspot shape: editable columns plus the embedded target scene_key for
// display. The nested target object is flattened and never returned raw.
const HOTSPOT_ADMIN_SELECT =
  'id, scene_id, target_scene_id, hotspot_type, label, text, yaw, pitch, ' +
  'display_order, schedule_building_id, schedule_location_type, schedule_location_label, ' +
  'schedule_floor_label, target:vr_scenes!vr_hotspots_target_scene_id_fkey(scene_key, title)';

function flattenHotspot(h) {
  if (!h) return null;
  const t = Array.isArray(h.target) ? (h.target[0] || null) : (h.target || null);
  return {
    id: h.id,
    scene_id: h.scene_id,
    target_scene_id: h.target_scene_id,
    hotspot_type: h.hotspot_type,
    label: h.label,
    text: h.text,
    yaw: h.yaw,
    pitch: h.pitch,
    display_order: h.display_order,
    schedule_building_id: h.schedule_building_id == null ? null : h.schedule_building_id,
    schedule_location_type: h.schedule_location_type == null ? null : h.schedule_location_type,
    schedule_location_label: h.schedule_location_label == null ? null : h.schedule_location_label,
    schedule_floor_label: h.schedule_floor_label == null ? null : h.schedule_floor_label,
    target_scene_key: t ? t.scene_key : null,
    target_title: t ? t.title : null
  };
}

/** All scenes for the admin list, display_order ASC then id ASC. */
async function listScenesAdmin() {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('vr_scenes')
    .select(SCENE_ADMIN_COLUMNS)
    .order('display_order', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw fail('listScenesAdmin', error);
  return data || [];
}

/** One scene by id in the admin shape, or null. */
async function findSceneById(id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) return null;
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('vr_scenes')
    .select(SCENE_ADMIN_COLUMNS)
    .eq('id', n)
    .maybeSingle();
  if (error) throw fail('findSceneById', error);
  return data || null;
}

/** The id of a scene with this scene_key (optionally excluding one id), or null. */
async function findSceneIdByKey(sceneKey, excludeId) {
  const key = typeof sceneKey === 'string' ? sceneKey.trim() : '';
  if (key === '') return null;
  const sb = getSupabaseClient();
  let q = sb.from('vr_scenes').select('id').eq('scene_key', key);
  const ex = Number(excludeId);
  if (Number.isInteger(ex) && ex > 0) q = q.neq('id', ex);
  const { data, error } = await q.maybeSingle();
  if (error) throw fail('findSceneIdByKey', error);
  return data ? data.id : null;
}

async function rowExists(table, method, id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) return false;
  const sb = getSupabaseClient();
  const { data, error } = await sb.from(table).select('id').eq('id', n).maybeSingle();
  if (error) throw fail(method, error);
  return !!data;
}
function sceneExists(id) { return rowExists('vr_scenes', 'sceneExists', id); }
function nodeExists(id) { return rowExists('route_nodes', 'nodeExists', id); }
function buildingExists(id) { return rowExists('buildings', 'buildingExists', id); }

/** Count of hotspots whose target_scene_id points at this scene (delete guard). */
async function countHotspotsTargetingScene(sceneId) {
  const n = Number(sceneId);
  if (!Number.isInteger(n) || n < 1) return 0;
  const sb = getSupabaseClient();
  const { count, error } = await sb
    .from('vr_hotspots')
    .select('id', { count: 'exact', head: true })
    .eq('target_scene_id', n);
  if (error) throw fail('countHotspotsTargetingScene', error);
  return typeof count === 'number' ? count : 0;
}

/** Insert a scene from a controller-validated payload; returns the admin shape. */
async function insertScene(payload) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('vr_scenes')
    .insert({
      scene_key: payload.scene_key,
      title: payload.title,
      description: payload.description,
      image_url: payload.image_url,
      cloudinary_public_id: payload.cloudinary_public_id == null ? null : payload.cloudinary_public_id,
      node_id: payload.node_id,
      building_id: payload.building_id,
      initial_yaw: payload.initial_yaw,
      initial_pitch: payload.initial_pitch,
      display_order: payload.display_order
    })
    .select(SCENE_ADMIN_COLUMNS)
    .single();
  if (error) throw fail('insertScene', error);
  return data;
}

/** Update a scene by id; returns the admin shape, or null when no row matched. */
async function updateSceneById(id, payload) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('vr_scenes')
    .update({
      scene_key: payload.scene_key,
      title: payload.title,
      description: payload.description,
      image_url: payload.image_url,
      cloudinary_public_id: payload.cloudinary_public_id == null ? null : payload.cloudinary_public_id,
      node_id: payload.node_id,
      building_id: payload.building_id,
      initial_yaw: payload.initial_yaw,
      initial_pitch: payload.initial_pitch,
      display_order: payload.display_order,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select(SCENE_ADMIN_COLUMNS)
    .maybeSingle();
  if (error) throw fail('updateSceneById', error);
  return data || null;
}

/** Delete a scene by id; returns the deleted id, or null when no row matched. */
async function deleteSceneById(id) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('vr_scenes')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) throw fail('deleteSceneById', error);
  return data ? data.id : null;
}

/** Hotspots for a scene in the admin shape, display_order ASC then id ASC. */
async function listHotspotsAdmin(sceneId) {
  const n = Number(sceneId);
  if (!Number.isInteger(n) || n < 1) return [];
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('vr_hotspots')
    .select(HOTSPOT_ADMIN_SELECT)
    .eq('scene_id', n)
    .order('display_order', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw fail('listHotspotsAdmin', error);
  return (data || []).map(flattenHotspot);
}

/** One hotspot by id in the admin shape, or null. */
async function findHotspotById(id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) return null;
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('vr_hotspots')
    .select(HOTSPOT_ADMIN_SELECT)
    .eq('id', n)
    .maybeSingle();
  if (error) throw fail('findHotspotById', error);
  return flattenHotspot(data);
}

/** Insert a hotspot from a controller-validated payload; returns the admin shape. */
async function insertHotspot(payload) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('vr_hotspots')
    .insert({
      scene_id: payload.scene_id,
      target_scene_id: payload.target_scene_id,
      hotspot_type: payload.hotspot_type,
      label: payload.label,
      text: payload.text,
      schedule_building_id: payload.schedule_building_id,
      schedule_location_type: payload.schedule_location_type,
      schedule_location_label: payload.schedule_location_label,
      schedule_floor_label: payload.schedule_floor_label,
      yaw: payload.yaw,
      pitch: payload.pitch,
      display_order: payload.display_order
    })
    .select(HOTSPOT_ADMIN_SELECT)
    .single();
  if (error) throw fail('insertHotspot', error);
  return flattenHotspot(data);
}

/** Update a hotspot by id; returns the admin shape, or null when no row matched. */
async function updateHotspotById(id, payload) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('vr_hotspots')
    .update({
      target_scene_id: payload.target_scene_id,
      hotspot_type: payload.hotspot_type,
      label: payload.label,
      text: payload.text,
      schedule_building_id: payload.schedule_building_id,
      schedule_location_type: payload.schedule_location_type,
      schedule_location_label: payload.schedule_location_label,
      schedule_floor_label: payload.schedule_floor_label,
      yaw: payload.yaw,
      pitch: payload.pitch,
      display_order: payload.display_order,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select(HOTSPOT_ADMIN_SELECT)
    .maybeSingle();
  if (error) throw fail('updateHotspotById', error);
  return flattenHotspot(data);
}

/** Delete a hotspot by id; returns the deleted id, or null when no row matched. */
async function deleteHotspotById(id) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('vr_hotspots')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) throw fail('deleteHotspotById', error);
  return data ? data.id : null;
}

module.exports = {
  listAllScenes,
  findSceneByKey,
  listHotspotsForScene,
  listScenesForGraphPath,
  // BE.4 natural-key guided walkthrough reads
  listScenesByKeys,
  listSceneLinkHotspots,
  // admin VR (Section 7.8)
  listScenesAdmin,
  findSceneById,
  findSceneIdByKey,
  sceneExists,
  nodeExists,
  buildingExists,
  countHotspotsTargetingScene,
  insertScene,
  updateSceneById,
  deleteSceneById,
  listHotspotsAdmin,
  findHotspotById,
  insertHotspot,
  updateHotspotById,
  deleteHotspotById
};
