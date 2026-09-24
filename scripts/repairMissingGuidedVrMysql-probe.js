'use strict';

const {
  APPLY_CONFIRMATION,
  APPROVED_SCENE_KEYS,
  APPROVED_MISSING_LINKS,
  assertLocalMysqlConfiguration,
  buildRepairPlan,
  inTransaction,
  parseArgs,
  routePairs,
} = require('./repairMissingGuidedVrMysql');

let checks = 0;
let failures = 0;

function check(name, condition) {
  checks += 1;
  if (condition) console.log(`  PASS ${name}`);
  else {
    failures += 1;
    console.error(`  FAIL ${name}`);
  }
}

function expectThrow(fn, pattern = /approved repair scope|exactly one|conflicts|Ambiguous|missing/i) {
  try { fn(); return false; } catch (error) { return pattern.test(error.message); }
}

function fixtures() {
  const pairs = routePairs();
  const allKeys = [...new Set(pairs.flatMap((pair) => pair.split('>')))].sort();
  const sourceScenes = allKeys.map((scene_key, index) => ({
    id: index + 1,
    scene_key,
    title: `Scene ${scene_key}`,
    description: null,
    image_url: `/img/vr/${scene_key}.jpg`,
    cloudinary_public_id: null,
    node_id: scene_key === 'scene-general-road-85' ? 1 : null,
    building_id: scene_key === 'scene-general-road-85' ? 1 : null,
    initial_yaw: 0,
    initial_pitch: 0,
    display_order: index,
  }));
  const sourceSceneId = new Map(sourceScenes.map((scene) => [scene.scene_key, scene.id]));
  const missingScenes = new Set(APPROVED_SCENE_KEYS);
  const sourceNodes = [{ id: 1, node_key: 'road-node-85' }];
  const sourceBuildings = [{ id: 1, name: 'Campus Reference Building' }];
  const targetNodes = [{ id: 501, node_key: 'road-node-85' }];
  const targetBuildings = [{ id: 901, name: 'Campus Reference Building' }];
  const sourceHotspots = pairs.map((pair, index) => {
    const [from, to] = pair.split('>');
    return {
      id: index + 1,
      scene_id: sourceSceneId.get(from),
      target_scene_id: sourceSceneId.get(to),
      hotspot_type: 'scene',
      label: `${from} to ${to}`,
      text: null,
      guest_visible: true,
      yaw: 0,
      pitch: 0,
      display_order: index,
    };
  });
  const source = { scenes: sourceScenes, nodes: sourceNodes, buildings: sourceBuildings, hotspots: sourceHotspots };
  const targetScenes = sourceScenes.filter((scene) => !missingScenes.has(scene.scene_key)).map((scene) => ({
    ...scene,
    id: scene.id + 5000,
    node_id: scene.node_id == null ? null : 501,
    building_id: scene.building_id == null ? null : 901,
  }));
  const targetSceneId = new Map(targetScenes.map((scene) => [scene.scene_key, scene.id]));
  const approvedLinks = new Set(APPROVED_MISSING_LINKS);
  const targetHotspots = sourceHotspots.filter((hotspot) => {
    const from = sourceScenes.find((scene) => scene.id === hotspot.scene_id).scene_key;
    const to = sourceScenes.find((scene) => scene.id === hotspot.target_scene_id).scene_key;
    return !approvedLinks.has(`${from}>${to}`) && targetSceneId.has(from) && targetSceneId.has(to);
  }).map((hotspot) => {
    const from = sourceScenes.find((scene) => scene.id === hotspot.scene_id).scene_key;
    const to = sourceScenes.find((scene) => scene.id === hotspot.target_scene_id).scene_key;
    return { ...hotspot, id: hotspot.id + 10000, scene_id: targetSceneId.get(from), target_scene_id: targetSceneId.get(to) };
  });
  return {
    source,
    target: { scenes: targetScenes, nodes: targetNodes, buildings: targetBuildings, hotspots: targetHotspots },
    sourceScenes,
    sourceSceneId,
    sourceHotspots,
    targetSceneId,
  };
}

async function main() {
  console.log('=== Missing Guided-VR MySQL repair safety probe (database-free) ===');
  const fixture = fixtures();
  const plan = buildRepairPlan(fixture.source, fixture.target);
  check('repair scope is exactly six scenes and eleven approved directed links',
    plan.sceneInserts.length === 6 && plan.hotspotInserts.length === 11 &&
    plan.missingSceneKeys.length === 6 && plan.missingLinks.length === 11 &&
    plan.missingLinks.every((pair) => APPROVED_MISSING_LINKS.includes(pair)));
  check('scene foreign keys remap through node/building natural keys',
    plan.sceneInserts.find((scene) => scene.scene_key === 'scene-general-road-85')?.node_id === 501 &&
    plan.sceneInserts.find((scene) => scene.scene_key === 'scene-general-road-85')?.building_id === 901);
  check('unapproved local database targets are rejected',
    expectThrow(() => assertLocalMysqlConfiguration({ DB_HOST: 'remote.example', DB_NAME: 'campusphere_db' }), /local campusphere_db/));
  check('local Compose database target is accepted',
    (() => { try { assertLocalMysqlConfiguration({ DB_HOST: 'mysql', DB_NAME: 'campusphere_db' }); return true; } catch (_) { return false; } })());
  check('apply requires the dedicated confirmation token',
    expectThrow(() => parseArgs(['node', 'script', '--apply']), /confirm=/) &&
    parseArgs(['node', 'script', '--apply', `--confirm=${APPLY_CONFIRMATION}`]).apply === true);
  check('dry run is the default', parseArgs(['node', 'script']).apply === false);

  const after = {
    scenes: [...fixture.target.scenes],
    nodes: [...fixture.target.nodes],
    buildings: [...fixture.target.buildings],
    hotspots: [...fixture.target.hotspots],
  };
  let nextSceneId = 20000;
  for (const scene of plan.sceneInserts) {
    after.scenes.push({ ...scene, id: nextSceneId++ });
  }
  const afterSceneId = new Map(after.scenes.map((scene) => [scene.scene_key, Number(scene.id)]));
  let nextHotspotId = 30000;
  for (const link of plan.hotspotInserts) {
    after.hotspots.push({
      id: nextHotspotId++,
      scene_id: afterSceneId.get(link.from_key),
      target_scene_id: afterSceneId.get(link.to_key),
      hotspot_type: 'scene',
      label: link.label,
      text: link.text,
      guest_visible: link.guest_visible,
      yaw: link.yaw,
      pitch: link.pitch,
      display_order: link.display_order,
    });
  }
  const repeated = buildRepairPlan(fixture.source, after);
  check('matching records make a safe idempotent rerun',
    repeated.sceneInserts.length === 0 && repeated.hotspotInserts.length === 0);

  const sourceMissingScene = { ...fixture.source, scenes: fixture.source.scenes.filter((scene) => scene.scene_key !== 'scene-general-road-85') };
  check('missing source scenes fail closed', expectThrow(() => buildRepairPlan(sourceMissingScene, fixture.target)));
  const sourceDuplicateLink = { ...fixture.source, hotspots: [...fixture.source.hotspots, { ...fixture.source.hotspots[0], id: 999999 }] };
  check('duplicate source links fail closed', expectThrow(() => buildRepairPlan(sourceDuplicateLink, fixture.target)));
  const sourceDrift = {
    ...fixture.source,
    scenes: fixture.source.scenes.map((scene) => scene.scene_key === 'scene-general-road-85'
      ? { ...scene, title: 'changed source title' }
      : scene),
  };
  check('source changes alter the scoped fingerprint',
    buildRepairPlan(sourceDrift, fixture.target).sourceFingerprint !== plan.sourceFingerprint);
  const targetConflict = {
    ...after,
    hotspots: after.hotspots.map((hotspot) => hotspot.label === 'scene-general-road-38 to scene-general-road-85'
      ? { ...hotspot, label: 'conflicting label' }
      : hotspot),
  };
  check('conflicting existing records fail closed', expectThrow(() => buildRepairPlan(fixture.source, targetConflict), /conflicts/));
  const targetOutOfScope = { ...fixture.target, scenes: fixture.target.scenes.filter((scene) => scene.scene_key !== 'scene-general-road-38') };
  check('missing route scenes outside the approved list fail closed', expectThrow(() => buildRepairPlan(fixture.source, targetOutOfScope), /outside the approved repair scope/));
  const nonApprovedPair = routePairs().find((pair) => !APPROVED_MISSING_LINKS.includes(pair) &&
    pair.split('>').every((key) => !APPROVED_SCENE_KEYS.includes(key)));
  const [nonApprovedFrom, nonApprovedTo] = nonApprovedPair.split('>');
  const nonApprovedTargetLink = fixture.target.hotspots.find((hotspot) =>
    Number(hotspot.scene_id) === Number(fixture.targetSceneId.get(nonApprovedFrom)) &&
    Number(hotspot.target_scene_id) === Number(fixture.targetSceneId.get(nonApprovedTo)));
  const targetOutOfScopeLink = {
    ...fixture.target,
    hotspots: fixture.target.hotspots.filter((hotspot) => hotspot !== nonApprovedTargetLink),
  };
  check('missing route links outside the approved list fail closed',
    !!nonApprovedTargetLink && expectThrow(() => buildRepairPlan(fixture.source, targetOutOfScopeLink), /outside the approved repair scope/));

  const events = [];
  const connection = {
    async beginTransaction() { events.push('begin'); },
    async commit() { events.push('commit'); },
    async rollback() { events.push('rollback'); },
  };
  await inTransaction(connection, async () => 'ok');
  check('successful writes commit once', events.join(',') === 'begin,commit');
  events.length = 0;
  let rolledBack = false;
  try { await inTransaction(connection, async () => { throw new Error('fixture failure'); }); }
  catch (error) { rolledBack = error.message === 'fixture failure'; }
  check('write failure rolls back the transaction', rolledBack && events.join(',') === 'begin,rollback');
  events.length = 0;
  let commitOutcomeUnknown = false;
  const ambiguousCommitConnection = {
    async beginTransaction() { events.push('begin'); },
    async commit() { events.push('commit'); throw new Error('fixture commit acknowledgement lost'); },
    async rollback() { events.push('rollback'); },
  };
  try { await inTransaction(ambiguousCommitConnection, async () => 'ok'); }
  catch (error) { commitOutcomeUnknown = error.repairOutcomeUnknown === true; }
  check('commit acknowledgement failure is marked as an uncertain outcome',
    commitOutcomeUnknown && events.join(',') === 'begin,commit,rollback');

  if (failures) {
    console.error(`\nGUIDED-VR-MYSQL-REPAIR-PROBE FAILED: ${failures}/${checks} failed.`);
    process.exitCode = 1;
  } else {
    console.log(`\nGUIDED-VR-MYSQL-REPAIR-PROBE OK: ${checks}/${checks}.`);
  }
}

main().catch(() => {
  console.error('GUIDED-VR-MYSQL-REPAIR-PROBE FAILED: safe fixture execution error.');
  process.exitCode = 1;
});
