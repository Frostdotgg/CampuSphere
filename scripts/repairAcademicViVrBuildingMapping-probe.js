'use strict';

/* Pure safety tests for the narrow Academic VI building-association repair. */

const assert = require('node:assert/strict');
const {
  TARGET,
  CORRIDOR,
  buildPlan,
  applyPlan,
  verifyPostflight,
  routeContainsCorridor
} = require('./repairAcademicViVrBuildingMapping');

const MEDIA = 'https://res.cloudinary.com/example/image/upload/pano.jpg';
const PUBLIC_ID = 'campusphere/vr/scene-chs-1st-floor-001';

function validState({ buildingId = null } = {}) {
  const corridorScenes = [
    { id: 248, scene_key: CORRIDOR[0] },
    { id: 1505, scene_key: CORRIDOR[1] },
    { id: 556, scene_key: CORRIDOR[2] }
  ];
  const hotspots = [
    [248, 1505],
    [1505, 248],
    [1505, 556],
    [556, 1505]
  ].map(([scene_id, target_scene_id], index) => ({
    id: index + 1,
    scene_id,
    target_scene_id,
    hotspot_type: 'scene',
    label: 'Go to road',
    text: null,
    yaw: 0,
    pitch: 0,
    guest_visible: true,
    schedule_building_id: null,
    schedule_location_type: null,
    schedule_location_label: null,
    schedule_floor_label: null,
    schedule_document_id: null,
    display_order: 0
  }));
  return {
    scenes: [{
      id: 555,
      scene_key: TARGET.arrival_scene_key,
      node_id: 69,
      building_id: buildingId,
      image_url: MEDIA,
      cloudinary_public_id: PUBLIC_ID
    }],
    nodes: [{ id: 69, node_key: TARGET.destination_node_key, building_id: 8 }],
    corridorScenes,
    hotspots
  };
}

function fakeSupabase({ returnNull = false } = {}) {
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
              return returnNull
                ? { data: null, error: null }
                : { data: { id: 555, scene_key: TARGET.arrival_scene_key, node_id: 69, building_id: 8 }, error: null };
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
  const unassigned = validState();
  const plan = buildPlan(unassigned);
  assert.equal(plan.current, 'unassigned');
  assert.equal(routeContainsCorridor({ scene_keys: CORRIDOR }), true);

  const alreadyCorrect = validState({ buildingId: 8 });
  const alreadyPlan = buildPlan(alreadyCorrect);
  const noWriteClient = fakeSupabase();
  assert.equal(await applyPlan(noWriteClient, alreadyPlan), 'already-correct');
  assert.equal(noWriteClient.calls, 0);

  const updateClient = fakeSupabase();
  assert.equal(await applyPlan(updateClient, plan), 'updated');
  assert.equal(updateClient.calls, 1);

  const wrongNode = validState();
  wrongNode.scenes[0].node_id = 999;
  expectFailure('wrong arrival node mapping must stop preflight', () => buildPlan(wrongNode));

  const conflictingBuilding = validState({ buildingId: 7 });
  expectFailure('conflicting building association must stop preflight', () => buildPlan(conflictingBuilding));

  const missingHotspot = validState();
  missingHotspot.hotspots.pop();
  expectFailure('missing corridor hotspot must stop preflight', () => buildPlan(missingHotspot));

  const concurrent = fakeSupabase({ returnNull: true });
  await assert.rejects(() => applyPlan(concurrent, plan), /guarded update/);
  assert.equal(concurrent.calls, 1);

  const after = validState({ buildingId: 8 });
  verifyPostflight(unassigned, after, plan);
  const changedHotspot = validState({ buildingId: 8 });
  changedHotspot.hotspots[0].yaw = 42;
  expectFailure('hotspot mutation must fail postflight', () =>
    verifyPostflight(unassigned, changedHotspot, plan));

  console.log('REPAIR-ACADEMIC-VI-BUILDING-PROBE OK: corridor, guard, skip, conflict, concurrency, and hotspot-preservation cases passed.');
})().catch((error) => {
  console.error(`REPAIR-ACADEMIC-VI-BUILDING-PROBE FAILED: ${error.message || 'synthetic check failed'}`);
  process.exitCode = 1;
});
