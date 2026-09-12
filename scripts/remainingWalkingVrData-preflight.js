'use strict';

/* SELECT-only live preflight for the three former Walking VR blockers. */

require('dotenv').config({ quiet: true });

const { getSupabaseClient } = require('../config/supabase');
const { WALKING_GUIDED_VR_ROUTES } = require('../config/guidedVrRoutes');
const { hasApprovedMediaMetadata } = require('../services/guidedVrResolution');

const TARGETS = Object.freeze(['acad-5', 'free-park', 'duran']);

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const supabase = getSupabaseClient();
  const routes = TARGETS.map((nodeKey) =>
    WALKING_GUIDED_VR_ROUTES.find((route) => route.destination_node_key === nodeKey));
  check(routes.every(Boolean), 'catalog target missing');
  const sceneKeys = [...new Set(routes.flatMap((route) => route.scene_keys))];

  const [sceneResult, nodeResult] = await Promise.all([
    supabase.from('vr_scenes')
      .select('id,scene_key,node_id,image_url,cloudinary_public_id')
      .in('scene_key', sceneKeys),
    supabase.from('route_nodes').select('id,node_key')
  ]);
  check(!sceneResult.error && !nodeResult.error, 'scene/node read failed');

  const scenes = sceneResult.data || [];
  const nodes = nodeResult.data || [];
  const sceneById = new Map(scenes.map((scene) => [Number(scene.id), scene.scene_key]));
  const nodeById = new Map(nodes.map((node) => [Number(node.id), node.node_key]));
  const sceneIds = scenes.map((scene) => scene.id).filter((id) => id != null);
  const hotspotResult = sceneIds.length
    ? await supabase.from('vr_hotspots')
      .select('scene_id,target_scene_id,hotspot_type')
      .eq('hotspot_type', 'scene')
      .in('scene_id', sceneIds)
    : { data: [], error: null };
  check(!hotspotResult.error, 'hotspot read failed');

  const links = (hotspotResult.data || []).map((hotspot) => ({
    fromKey: sceneById.get(Number(hotspot.scene_id)),
    toKey: sceneById.get(Number(hotspot.target_scene_id))
  })).filter((link) => link.fromKey && link.toKey);

  const results = routes.map((route) => {
    const matches = route.scene_keys.map((key) =>
      scenes.filter((scene) => scene.scene_key === key));
    const resolved = matches.flatMap((rows) => rows.length === 1 ? rows : []);
    const missing = route.scene_keys.filter((key, index) => matches[index].length === 0);
    const duplicate = route.scene_keys.filter((key, index) => matches[index].length > 1);
    const mediaMissing = resolved
      .filter((scene) => !hasApprovedMediaMetadata(scene))
      .map((scene) => scene.scene_key);
    const transitionIssues = [];

    for (let index = 0; index < route.scene_keys.length - 1; index += 1) {
      const from = route.scene_keys[index];
      const to = route.scene_keys[index + 1];
      const forward = links.filter((link) => link.fromKey === from && link.toKey === to).length;
      const reverse = links.filter((link) => link.fromKey === to && link.toKey === from).length;
      if (forward !== 1 || reverse !== 1) transitionIssues.push({ from, to, forward, reverse });
    }

    const first = resolved.find((scene) => scene.scene_key === route.scene_keys[0]);
    const last = resolved.find((scene) => scene.scene_key === route.scene_keys[route.scene_keys.length - 1]);
    return {
      node: route.destination_node_key,
      expected: route.scene_keys.length,
      resolved: resolved.length,
      missing,
      duplicate,
      mediaMissing,
      startNode: first ? (nodeById.get(Number(first.node_id)) || null) : null,
      arrivalNode: last ? (nodeById.get(Number(last.node_id)) || null) : null,
      transitionIssues
    };
  });

  console.log(JSON.stringify({ readOnly: true, results }, null, 2));
}

if (require.main === module) {
  main().catch(() => {
    console.error('WALKING-VR-DATA-PREFLIGHT FAILED: sanitized read-only query failure');
    process.exitCode = 1;
  });
}

module.exports = { TARGETS };
