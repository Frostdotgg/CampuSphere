'use strict';

/* Pure contract checks for the campus/VR natural-key merge utility. */

const assert = require('node:assert/strict');
const fs = require('fs');
const {
  TABLES,
  PROTECTED_TABLES,
  buildPlan
} = require('./syncCampusVrSupabaseToMysql');

function base({ extraBuilding = false, duplicateTarget = false } = {}) {
  const source = {
    buildings: [{ id: 1, name: 'Academic Building IV', category: 'ACADEMIC', description: 'Source', lat: 13.4, lng: 123.3, details: {}, image_url: null, cloudinary_public_id: null }],
    campus_routes: [{ id: 1, title: 'Main Gate to Academic Building IV', start_label: 'Main Gate', destination_building_id: 1, estimated_walk_time: '5 min' }],
    campus_route_steps: [],
    route_nodes: [{ id: 1, node_key: 'acad-4', label: 'Academic Building IV', node_type: 'building', building_id: 1, lat: 13.4, lng: 123.3, display_order: 1 }],
    route_edges: [],
    room_schedule_documents: [],
    vr_scenes: [
      { id: 1, scene_key: 'scene-a', title: 'A', description: null, image_url: '/img/a.jpg', cloudinary_public_id: null, node_id: 1, building_id: 1, initial_yaw: 0, initial_pitch: 0, display_order: 1 },
      { id: 2, scene_key: 'scene-b', title: 'B', description: null, image_url: '/img/b.jpg', cloudinary_public_id: null, node_id: null, building_id: 1, initial_yaw: 0, initial_pitch: 0, display_order: 2 }
    ],
    vr_hotspots: [{ id: 1, scene_id: 1, target_scene_id: 2, hotspot_type: 'scene', label: 'Next', text: null, guest_visible: true, schedule_building_id: null, schedule_location_type: null, schedule_location_label: null, schedule_floor_label: null, schedule_document_id: null, yaw: 10, pitch: 0, display_order: 0 }]
  };
  const target = {
    buildings: [{ id: 10, name: 'Academic Building IV', category: 'ACADEMIC', description: 'Source', lat: '13.40000000', lng: '123.30000000', details: '{}', image_url: null, cloudinary_public_id: null }],
    campus_routes: [{ id: 20, title: 'Main Gate to Academic Building IV', start_label: 'Main Gate', destination_building_id: 10, estimated_walk_time: '5 min' }],
    campus_route_steps: [],
    route_nodes: [{ id: 30, node_key: 'acad-4', label: 'Academic Building IV', node_type: 'building', building_id: 10, lat: '13.4', lng: '123.3', display_order: '1' }],
    route_edges: [],
    room_schedule_documents: [],
    vr_scenes: [
      { id: 40, scene_key: 'scene-a', title: 'A', description: null, image_url: '/img/a.jpg', cloudinary_public_id: null, node_id: 30, building_id: 10, initial_yaw: '0.00', initial_pitch: '0.00', display_order: '1' },
      { id: 41, scene_key: 'scene-b', title: 'B', description: null, image_url: '/img/b.jpg', cloudinary_public_id: null, node_id: null, building_id: 10, initial_yaw: '0.00', initial_pitch: '0.00', display_order: '2' }
    ],
    vr_hotspots: [{ id: 50, scene_id: 40, target_scene_id: 41, hotspot_type: 'scene', label: 'Next', text: null, guest_visible: 1, schedule_building_id: null, schedule_location_type: null, schedule_location_label: null, schedule_floor_label: null, schedule_document_id: null, yaw: '10.00', pitch: '0.00', display_order: '0' }]
  };
  if (extraBuilding) target.buildings.push({ id: 11, name: 'Local-only Building', category: 'FACILITIES', description: null, lat: '13.5', lng: '123.4', details: '{}', image_url: null, cloudinary_public_id: null });
  if (duplicateTarget) target.buildings.push({ id: 12, name: 'academic-building-iv', category: 'ACADEMIC', description: null, lat: '13.4', lng: '123.3', details: '{}', image_url: null, cloudinary_public_id: null });
  return { source, target };
}

const { source, target } = base({ extraBuilding: true });
const plan = buildPlan(source, target);
assert.deepEqual(TABLES, ['buildings', 'campus_routes', 'campus_route_steps', 'route_nodes', 'route_edges', 'room_schedule_documents', 'vr_scenes', 'vr_hotspots']);
assert.deepEqual(PROTECTED_TABLES.includes('users'), true);
assert.equal(plan.entries.buildings[0].action, 'present');
assert.equal(plan.entries.campus_routes[0].action, 'present');
assert.equal(plan.entries.vr_scenes.every((entry) => entry.action === 'present'), true);
assert.equal(plan.entries.vr_hotspots[0].action, 'present');
assert.equal(target.buildings.length, 2, 'local-only building remains in the target snapshot');
assert.throws(() => buildPlan(source, base({ duplicateTarget: true }).target), /duplicate natural key/);
const sourceText = fs.readFileSync(require.resolve('./syncCampusVrSupabaseToMysql'), 'utf8');
assert.equal(/DELETE\s+FROM/i.test(sourceText), false, 'scoped merge contains no DELETE FROM operation');
console.log('SYNC-CAMPUS-VR-PROBE OK: natural-key parity, local-only preservation, duplicate guard, protected scope, and no-delete contract passed.');
