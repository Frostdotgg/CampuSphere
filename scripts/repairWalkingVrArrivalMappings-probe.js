'use strict';

/* Pure safety tests for the narrow Walking arrival repair helper. */

const assert = require('node:assert/strict');
const {
  TARGETS,
  buildPlan,
  applyPlan,
  verifyPostflight
} = require('./repairWalkingVrArrivalMappings');
const {
  VEHICLE_GUIDED_VR_ROUTES,
  WALKING_GUIDED_VR_ROUTES
} = require('../config/guidedVrRoutes');

function route(routes, nodeKey) {
  return routes.find((entry) => entry.destination_node_key === nodeKey);
}

function validState({ current = 'unassigned' } = {}) {
  const scenes = TARGETS.map((target, index) => ({
    id: index + 1,
    scene_key: target.arrival_scene_key,
    node_id: current === 'already-correct' ? index + 101 : null,
    building_id: 201,
    image_url: 'https://res.cloudinary.com/example/image/upload/pano.jpg',
    cloudinary_public_id: 'example/pano'
  }));
  const nodes = TARGETS.map((target, index) => ({
    id: index + 101,
    node_key: target.destination_node_key,
    building_id: 201
  }));
  const vehicleScenes = TARGETS.map((target, index) => ({
    scene_key: route(VEHICLE_GUIDED_VR_ROUTES, target.destination_node_key).arrival_scene_key,
    node_id: index + 101
  }));
  return { scenes, nodes, vehicleScenes };
}

function fakeSupabase({ failAt = null, concurrentMissAt = null } = {}) {
  let calls = 0;
  return {
    get calls() { return calls; },
    from() {
      return {
        update() {
          const chain = {
            eq() { return chain; },
            is() { return chain; },
            select() { return chain; },
            async maybeSingle() {
              calls += 1;
              if (calls === failAt) throw new Error('synthetic update failure');
              if (calls === concurrentMissAt) return { data: null, error: null };
              return { data: { scene_key: 'synthetic', node_id: 101 }, error: null };
            }
          };
          return chain;
        }
      };
    }
  };
}

function expectFailure(label, fn) {
  assert.throws(fn, /:/, label);
}

(async () => {
  assert.equal(TARGETS.length, 5);
  const unassigned = validState();
  const plan = buildPlan(unassigned);
  assert.equal(plan.length, 5);
  assert.equal(plan.filter((item) => item.current === 'unassigned').length, 5);

  const alreadyCorrect = validState({ current: 'already-correct' });
  const alreadyPlan = buildPlan(alreadyCorrect);
  const noWriteClient = fakeSupabase();
  const skipped = await applyPlan(noWriteClient, alreadyPlan);
  assert.equal(noWriteClient.calls, 0);
  assert.equal(skipped.filter((item) => item.result === 'already-correct').length, 5);

  const missingScene = validState();
  missingScene.scenes.pop();
  expectFailure('missing scene must stop preflight', () => buildPlan(missingScene));

  const conflictingScene = validState();
  conflictingScene.scenes[0].node_id = 999;
  expectFailure('conflicting scene mapping must stop preflight', () => buildPlan(conflictingScene));

  const duplicateNode = validState();
  duplicateNode.nodes.push({ ...duplicateNode.nodes[0] });
  expectFailure('duplicate destination node must stop preflight', () => buildPlan(duplicateNode));

  const concurrent = fakeSupabase({ concurrentMissAt: 1 });
  await assert.rejects(() => applyPlan(concurrent, plan), /guarded update/);
  assert.equal(concurrent.calls, 1);

  const partial = fakeSupabase({ failAt: 2 });
  await assert.rejects(() => applyPlan(partial, plan), /synthetic update failure/);
  assert.equal(partial.calls, 2);

  const after = validState({ current: 'already-correct' });
  verifyPostflight(after, after);
  console.log('REPAIR-WALKING-ARRIVAL-PROBE OK: guard, conflict, concurrency, skip, and stop-on-error cases passed.');
})().catch((error) => {
  console.error(`REPAIR-WALKING-ARRIVAL-PROBE FAILED: ${error.message || 'synthetic check failed'}`);
  process.exitCode = 1;
});
