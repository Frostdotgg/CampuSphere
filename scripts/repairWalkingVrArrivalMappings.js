'use strict';

/*
 * Narrow, owner-authorized Supabase repair for the five Walking Guided VR
 * arrival scenes that were present but not linked to their destination node.
 *
 * The default mode is a read-only preflight.  Pass --apply to update only the
 * five scene.node_id values.  Numeric ids are resolved from natural keys at
 * runtime and are never stored in source.  Vehicle arrival mappings, media,
 * hotspots, and all other scene fields are deliberately outside the write.
 */

require('dotenv').config({ quiet: true });

const { getSupabaseClient, hasSupabaseConfig } = require('../config/supabase');
const {
  VEHICLE_GUIDED_VR_ROUTES,
  WALKING_GUIDED_VR_ROUTES
} = require('../config/guidedVrRoutes');
const { hasApprovedMediaMetadata } = require('../services/guidedVrResolution');

const TARGETS = Object.freeze([
  Object.freeze({
    destination_name: 'CITD Building',
    destination_node_key: 'citd',
    arrival_scene_key: 'scene-citd-1st-floor-1'
  }),
  Object.freeze({
    destination_name: 'Graduate School Building',
    destination_node_key: 'graduate',
    arrival_scene_key: 'scene-graduate-school-1st-floor-1'
  }),
  Object.freeze({
    destination_name: 'Academic Building I',
    destination_node_key: 'acad-1',
    arrival_scene_key: 'scene-acad1-1st-floor-1'
  }),
  Object.freeze({
    destination_name: 'Multi-Purpose Building II',
    destination_node_key: 'multi-2',
    arrival_scene_key: 'scene-multi-2-2nd-floor-2'
  }),
  Object.freeze({
    destination_name: 'Green Building',
    destination_node_key: 'green',
    arrival_scene_key: 'scene-green-1st-floor-9'
  })
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

function routeFor(routes, nodeKey) {
  return routes.find((route) => route.destination_node_key === nodeKey) || null;
}

async function readState(sb) {
  const sceneKeys = TARGETS.map((target) => target.arrival_scene_key);
  const nodeKeys = TARGETS.map((target) => target.destination_node_key);
  const vehicleArrivalKeys = TARGETS
    .map((target) => routeFor(VEHICLE_GUIDED_VR_ROUTES, target.destination_node_key))
    .filter(Boolean)
    .map((route) => route.arrival_scene_key);

  const [sceneResult, nodeResult, vehicleResult] = await Promise.all([
    sb.from('vr_scenes')
      .select('id, scene_key, node_id, building_id, image_url, cloudinary_public_id')
      .in('scene_key', [...new Set(sceneKeys)]),
    sb.from('route_nodes')
      .select('id, node_key, building_id')
      .in('node_key', nodeKeys),
    sb.from('vr_scenes')
      .select('scene_key, node_id')
      .in('scene_key', [...new Set(vehicleArrivalKeys)])
  ]);

  if (sceneResult.error) throw sceneResult.error;
  if (nodeResult.error) throw nodeResult.error;
  if (vehicleResult.error) throw vehicleResult.error;

  return {
    scenes: sceneResult.data || [],
    nodes: nodeResult.data || [],
    vehicleScenes: vehicleResult.data || []
  };
}

function validateCatalog() {
  check(TARGETS.length === 5, 'repair target count is not five');
  for (const target of TARGETS) {
    const walking = routeFor(WALKING_GUIDED_VR_ROUTES, target.destination_node_key);
    check(walking !== null, `${target.destination_node_key}: Walking catalog route is missing`);
    check(walking.arrival_scene_key === target.arrival_scene_key,
      `${target.destination_node_key}: catalog arrival scene does not match repair target`);
    check(routeFor(VEHICLE_GUIDED_VR_ROUTES, target.destination_node_key) !== null,
      `${target.destination_node_key}: Vehicle catalog route is missing`);
  }
}

function buildPlan(state) {
  const plan = [];
  for (const target of TARGETS) {
    const scenes = state.scenes.filter((scene) => scene.scene_key === target.arrival_scene_key);
    const nodes = state.nodes.filter((node) => node.node_key === target.destination_node_key);
    check(scenes.length === 1,
      `${target.destination_node_key}: expected exactly one arrival scene, found ${scenes.length}`);
    check(nodes.length === 1,
      `${target.destination_node_key}: expected exactly one destination node, found ${nodes.length}`);

    const scene = scenes[0];
    const node = nodes[0];
    check(hasApprovedMediaMetadata(scene),
      `${target.destination_node_key}: arrival scene has no approved media reference`);
    check(node.building_id != null,
      `${target.destination_node_key}: destination node has no building association`);
    check(scene.building_id == null || scene.building_id === node.building_id,
      `${target.destination_node_key}: arrival scene belongs to a different building`);
    check(scene.node_id == null || scene.node_id === node.id,
      `${target.destination_node_key}: arrival scene already maps to a different node`);

    const vehicleRoute = routeFor(VEHICLE_GUIDED_VR_ROUTES, target.destination_node_key);
    const vehicleScenes = state.vehicleScenes.filter((row) => row.scene_key === vehicleRoute.arrival_scene_key);
    check(vehicleScenes.length === 1,
      `${target.destination_node_key}: expected exactly one Vehicle arrival scene, found ${vehicleScenes.length}`);
    check(vehicleScenes[0].node_id === node.id,
      `${target.destination_node_key}: existing Vehicle arrival mapping is not preserved/correct`);

    plan.push({ target, scene, node, vehicleArrivalSceneKey: vehicleRoute.arrival_scene_key,
      current: scene.node_id == null ? 'unassigned' : 'already-correct' });
  }
  return plan;
}

function printPlan(plan, heading) {
  console.log(heading);
  for (const item of plan) {
    console.log(`  ${item.target.destination_name}: ${item.target.arrival_scene_key} -> ` +
      `${item.target.destination_node_key} (${item.current})`);
  }
}

async function applyPlan(sb, plan) {
  const applied = [];
  for (const item of plan) {
    if (item.scene.node_id === item.node.id) {
      applied.push({ item, result: 'already-correct' });
      continue;
    }

    const result = await sb.from('vr_scenes')
      .update({ node_id: item.node.id })
      .eq('id', item.scene.id)
      .eq('scene_key', item.target.arrival_scene_key)
      .is('node_id', null)
      .select('scene_key, node_id')
      .maybeSingle();
    if (result.error) throw result.error;
    check(result.data && result.data.node_id === item.node.id,
      `${item.target.destination_node_key}: guarded update did not return the expected mapping`);
    applied.push({ item, result: 'updated' });
  }
  return applied;
}

function verifyPostflight(before, after) {
  const beforeByScene = new Map(before.scenes.map((scene) => [scene.scene_key, scene.node_id]));
  const afterByScene = new Map(after.scenes.map((scene) => [scene.scene_key, scene.node_id]));
  const beforeVehicle = new Map(before.vehicleScenes.map((scene) => [scene.scene_key, scene.node_id]));
  const afterVehicle = new Map(after.vehicleScenes.map((scene) => [scene.scene_key, scene.node_id]));

  for (const target of TARGETS) {
    const node = after.nodes.find((row) => row.node_key === target.destination_node_key);
    check(afterByScene.get(target.arrival_scene_key) === node.id,
      `${target.destination_node_key}: postflight arrival mapping is incorrect`);
  }
  for (const [sceneKey, nodeId] of beforeVehicle) {
    check(afterVehicle.get(sceneKey) === nodeId,
      `${sceneKey}: Vehicle arrival mapping changed unexpectedly`);
  }
  for (const target of TARGETS) {
    const oldValue = beforeByScene.get(target.arrival_scene_key);
    check(oldValue == null || oldValue === afterByScene.get(target.arrival_scene_key),
      `${target.destination_node_key}: pre-existing Walking mapping changed unexpectedly`);
  }
}

async function main() {
  check(UNKNOWN_ARGS.length === 0, `unknown argument: ${UNKNOWN_ARGS[0] || ''}`);
  validateCatalog();
  check(hasSupabaseConfig(), 'Supabase configuration is not available');
  const sb = getSupabaseClient();
  const before = await readState(sb);
  const plan = buildPlan(before);
  printPlan(plan, APPLY ? 'Supabase Walking arrival repair:' : 'Supabase Walking arrival preflight (read-only):');

  if (!APPLY) {
    console.log('DRY RUN: no rows changed. Re-run with --apply to perform only these guarded node mappings.');
    return;
  }

  let applied;
  try {
    applied = await applyPlan(sb, plan);
  } catch (error) {
    console.error(`REPAIR STOPPED: ${safeMessage(error)}.`);
    console.error('No rollback or automatic retry was performed. Re-run the read-only preflight to inspect the current state.');
    process.exitCode = 1;
    return;
  }

  const after = await readState(sb);
  verifyPostflight(before, after);
  const changed = applied.filter((entry) => entry.result === 'updated').length;
  console.log(`REPAIR OK: ${changed} Walking arrival mapping(s) updated; Vehicle mappings preserved.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`REPAIR FAILED: ${safeMessage(error)}.`);
    process.exitCode = 1;
  });
}

module.exports = {
  TARGETS,
  buildPlan,
  applyPlan,
  routeFor,
  verifyPostflight
};
