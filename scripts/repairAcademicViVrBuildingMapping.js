'use strict';

/*
 * Narrow, owner-authorized Supabase repair for Academic Building VI's
 * Guided-VR arrival scene. The default mode is a read-only preflight. Pass
 * --apply to update only vr_scenes.building_id for the natural-key target.
 * Existing scene hotspots are inspected and must remain unchanged.
 */

require('dotenv').config({ quiet: true });

const { getSupabaseClient, hasSupabaseConfig } = require('../config/supabase');
const {
  VEHICLE_GUIDED_VR_ROUTES,
  WALKING_GUIDED_VR_ROUTES
} = require('../config/guidedVrRoutes');
const { hasApprovedMediaMetadata } = require('../services/guidedVrResolution');

const TARGET = Object.freeze({
  destination_name: 'Academic Building VI',
  destination_node_key: 'acad-6',
  arrival_scene_key: 'scene-chs-1st-floor-001'
});

const CORRIDOR = Object.freeze([
  'scene-general-road-38',
  'scene-general-road-85',
  'scene-general-road-94'
]);

const APPLY = process.argv.includes('--apply');
const UNKNOWN_ARGS = process.argv.slice(2).filter((arg) => arg !== '--apply');

function safeMessage(error) {
  let message = error && error.message ? String(error.message) : 'Supabase request failed.';
  return message
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[redacted]')
    .replace(/https?:\/\/[^\s]+/gi, '[url]')
    .replace(/[A-Za-z]:\\[^\r\n]+/g, '[path]')
    .slice(0, 240);
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function routeFor(routes) {
  return routes.find((route) => route.destination_node_key === TARGET.destination_node_key) || null;
}

function routeContainsCorridor(route) {
  if (!route || !Array.isArray(route.scene_keys)) return false;
  const index = route.scene_keys.indexOf(CORRIDOR[0]);
  return index >= 0 &&
    JSON.stringify(route.scene_keys.slice(index, index + CORRIDOR.length)) === JSON.stringify(CORRIDOR);
}

function validateCatalog() {
  const vehicle = routeFor(VEHICLE_GUIDED_VR_ROUTES);
  const walking = routeFor(WALKING_GUIDED_VR_ROUTES);
  check(vehicle, `${TARGET.destination_node_key}: Vehicle catalog route is missing`);
  check(walking, `${TARGET.destination_node_key}: Walking catalog route is missing`);
  check(vehicle.arrival_scene_key === TARGET.arrival_scene_key,
    `${TARGET.destination_node_key}: Vehicle arrival scene does not match the repair target`);
  check(walking.arrival_scene_key === TARGET.arrival_scene_key,
    `${TARGET.destination_node_key}: Walking arrival scene does not match the repair target`);
  check(routeContainsCorridor(vehicle),
    `${TARGET.destination_node_key}: Vehicle catalog does not contain the 38 -> 85 -> 94 corridor`);
  check(routeContainsCorridor(walking),
    `${TARGET.destination_node_key}: Walking catalog does not contain the 38 -> 85 -> 94 corridor`);
}

async function readState(sb) {
  const [sceneResult, nodeResult, corridorResult] = await Promise.all([
    sb.from('vr_scenes')
      .select('id, scene_key, node_id, building_id, image_url, cloudinary_public_id')
      .eq('scene_key', TARGET.arrival_scene_key),
    sb.from('route_nodes')
      .select('id, node_key, building_id')
      .eq('node_key', TARGET.destination_node_key),
    sb.from('vr_scenes')
      .select('id, scene_key')
      .in('scene_key', CORRIDOR)
  ]);

  if (sceneResult.error) throw sceneResult.error;
  if (nodeResult.error) throw nodeResult.error;
  if (corridorResult.error) throw corridorResult.error;

  const corridorIds = (corridorResult.data || []).map((scene) => scene.id);
  check(corridorIds.length === CORRIDOR.length,
    `corridor: expected ${CORRIDOR.length} scene rows, found ${corridorIds.length}`);

  const hotspotResult = await sb.from('vr_hotspots')
    .select('id, scene_id, target_scene_id, hotspot_type, label, text, yaw, pitch, guest_visible, ' +
      'schedule_building_id, schedule_location_type, schedule_location_label, schedule_floor_label, ' +
      'schedule_document_id, display_order')
    .in('scene_id', corridorIds)
    .order('id', { ascending: true });
  if (hotspotResult.error) throw hotspotResult.error;

  return {
    scenes: sceneResult.data || [],
    nodes: nodeResult.data || [],
    corridorScenes: corridorResult.data || [],
    hotspots: hotspotResult.data || []
  };
}

function sceneByKey(state, sceneKey) {
  return state.corridorScenes.find((scene) => scene.scene_key === sceneKey) || null;
}

function hasSceneLink(state, fromKey, toKey) {
  const from = sceneByKey(state, fromKey);
  const to = sceneByKey(state, toKey);
  return !!from && !!to && state.hotspots.some((hotspot) =>
    hotspot.hotspot_type === 'scene' &&
    hotspot.scene_id === from.id &&
    hotspot.target_scene_id === to.id);
}

function buildPlan(state) {
  const scenes = state.scenes.filter((scene) => scene.scene_key === TARGET.arrival_scene_key);
  const nodes = state.nodes.filter((node) => node.node_key === TARGET.destination_node_key);
  check(scenes.length === 1,
    `${TARGET.destination_node_key}: expected exactly one arrival scene, found ${scenes.length}`);
  check(nodes.length === 1,
    `${TARGET.destination_node_key}: expected exactly one destination node, found ${nodes.length}`);

  const scene = scenes[0];
  const node = nodes[0];
  check(hasApprovedMediaMetadata(scene),
    `${TARGET.destination_node_key}: arrival scene has no approved media reference`);
  check(node.building_id != null,
    `${TARGET.destination_node_key}: destination node has no building association`);
  check(scene.node_id === node.id,
    `${TARGET.destination_node_key}: arrival scene node mapping is not already correct`);
  check(scene.building_id == null || scene.building_id === node.building_id,
    `${TARGET.destination_node_key}: arrival scene belongs to a different building`);

  check(hasSceneLink(state, CORRIDOR[0], CORRIDOR[1]),
    'corridor: existing 38 -> 85 hotspot is missing');
  check(hasSceneLink(state, CORRIDOR[1], CORRIDOR[0]),
    'corridor: existing 85 -> 38 hotspot is missing');
  check(hasSceneLink(state, CORRIDOR[1], CORRIDOR[2]),
    'corridor: existing 85 -> 94 hotspot is missing');
  check(hasSceneLink(state, CORRIDOR[2], CORRIDOR[1]),
    'corridor: existing 94 -> 85 hotspot is missing');

  return {
    target: TARGET,
    scene,
    node,
    current: scene.building_id == null ? 'unassigned' : 'already-correct'
  };
}

function snapshot(value) {
  return JSON.stringify(value, (_key, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return Object.keys(item).sort().reduce((out, key) => {
      out[key] = item[key];
      return out;
    }, {});
  });
}

function verifyPostflight(before, after, plan) {
  const beforeScene = before.scenes.find((scene) => scene.id === plan.scene.id);
  const afterScene = after.scenes.find((scene) => scene.id === plan.scene.id);
  check(afterScene && afterScene.building_id === plan.node.building_id,
    `${TARGET.destination_node_key}: postflight building association is incorrect`);

  const withoutBuilding = (scene) => {
    if (!scene) return null;
    const copy = { ...scene };
    delete copy.building_id;
    return copy;
  };
  check(snapshot(withoutBuilding(beforeScene)) === snapshot(withoutBuilding(afterScene)),
    `${TARGET.destination_node_key}: non-building arrival fields changed unexpectedly`);
  check(snapshot(before.hotspots) === snapshot(after.hotspots),
    'corridor: existing hotspot rows changed unexpectedly');
}

async function applyPlan(sb, plan) {
  if (plan.scene.building_id === plan.node.building_id) return 'already-correct';

  const result = await sb.from('vr_scenes')
    .update({ building_id: plan.node.building_id })
    .eq('id', plan.scene.id)
    .eq('scene_key', TARGET.arrival_scene_key)
    .eq('node_id', plan.node.id)
    .is('building_id', null)
    .select('id, scene_key, node_id, building_id')
    .maybeSingle();
  if (result.error) throw result.error;
  check(result.data && result.data.building_id === plan.node.building_id,
    `${TARGET.destination_node_key}: guarded update did not return the expected association`);
  return 'updated';
}

function printPlan(plan, heading) {
  console.log(heading);
  console.log(`  ${plan.target.destination_name}: ${plan.target.arrival_scene_key} -> ` +
    `${plan.target.destination_node_key} building association (${plan.current})`);
  console.log('  Existing corridor hotspots: 38 <-> 85 <-> 94 (preserved; no hotspot write planned).');
}

async function main() {
  check(UNKNOWN_ARGS.length === 0, `unknown argument: ${UNKNOWN_ARGS[0] || ''}`);
  validateCatalog();
  check(hasSupabaseConfig(), 'Supabase configuration is not available');

  const sb = getSupabaseClient();
  const before = await readState(sb);
  const plan = buildPlan(before);
  printPlan(plan, APPLY
    ? 'Supabase Academic VI VR building-association repair:'
    : 'Supabase Academic VI VR building-association preflight (read-only):');

  if (!APPLY) {
    console.log('DRY RUN: no rows changed. Re-run with --apply to perform only this guarded building association update.');
    return;
  }

  let result;
  try {
    result = await applyPlan(sb, plan);
  } catch (error) {
    console.error(`REPAIR STOPPED: ${safeMessage(error)}.`);
    console.error('No rollback or automatic retry was performed. Re-run the read-only preflight to inspect the current state.');
    process.exitCode = 1;
    return;
  }

  const after = await readState(sb);
  verifyPostflight(before, after, plan);
  console.log(`REPAIR OK: Academic VI building association ${result}; corridor hotspots preserved.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`REPAIR FAILED: ${safeMessage(error)}.`);
    process.exitCode = 1;
  });
}

module.exports = {
  TARGET,
  CORRIDOR,
  buildPlan,
  applyPlan,
  verifyPostflight,
  routeContainsCorridor
};
