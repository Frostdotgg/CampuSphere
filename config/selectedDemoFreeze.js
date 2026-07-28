'use strict';

/*
 * BE.6 selected-demo dataset freeze.
 *
 * This is a QA baseline, not a runtime write lock. Numeric database ids are
 * deliberately absent: every cross-backend identity is a stable natural key.
 * A later owner-approved building, route, or selected-VR change is allowed,
 * but it must replace this manifest and the associated review evidence.
 */

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

const SELECTED_DEMO_FREEZE = deepFreeze({
  schema_version: 1,
  frozen_on: '2026-07-18',
  migrations: [
    ['0001_initial_schema.sql', '4a3b751758caaf47795d35ff479ffbba5127b248e950d78db0afcdd811840e3e'],
    ['0002_seed_data.sql', '90b7635cd22cf011b018c6ae63e5c11877d5565cdea37886808cf369761bd9a0'],
    ['0003_auth_profile_functions.sql', 'b53679007350077ff387f93184d30c1c3c8cca0fb070ed04200afdb9c1f25fab'],
    ['0004_building_backfill.sql', '05ace2c4165ab5c3d1b1cc8289e6e644e9dd60ae46942e4b384c0302c1a9ee64'],
    ['0005_building_write_functions.sql', 'd2f9174dfd7d46616b49101dfa8b43100c0d8fe5b3a84862c24c313d8c28eb48'],
    ['0006_admin_content_and_logs.sql', '7eda51f72c06d2099025963d6f3757bf972ba7da5aaa19fbcf400c1bc9d78a58'],
    ['0007_route_graph_admin_write_functions.sql', '4d42758c1d552d6fc8cd85a7f47993d6c2368e2f9c089f0ae5c1de5c95c6dce5'],
    ['0008_profile_update_atomic_function.sql', '6003f71bc7ada1ae800b8641cbe72c431750a5209d6865fae3dc246fed0a3a71'],
    ['0009_public_registration_trust_policy.sql', 'de87cc6030fad57508613e2ffcfc671e63b30178dc687276e943bd1aed5bd73b'],
    ['0010_performance_indexes.sql', '21a28e42a9880e5b04d595448d9b0d0d5c5c8057e529558b5490e32dc7f751fd'],
    ['0011_supabase_session_store.sql', '58d143b826ea29f01fae7637d2bf3899ab396b37223c5d555627a4af2bd622eb'],
    ['0012_room_schedules.sql', '6cc79909a03f798b9e7892c5889868e249ba09a344766105ed1bbd33ebdf9309'],
    ['0013_vr_hotspot_schedule_metadata.sql', '6e9bb883470703aaee471041dfb7632dc078e32d1fee8496b3d4613919383204'],
    ['0014_route_graph_accuracy.sql', 'ad9179bd0def19567b512e495fd3133211288e253c872b260421a912cc44e6aa'],
    ['0015_route_edge_path_geometry.sql', 'e7c6d828faf07c53d923ed58651a0abb8a834273eefa38aa0c04fbf492f70c99'],
    ['0016_route_geometry_admin_writes.sql', 'e567239f81a6ae6190b8fa66a044126204ca0ef5f64bb80c7960a921ecad7dcf'],
    ['0017_route_topology_guard_house.sql', 'bc0b3f38a186b321b3c9c53e4c6f9b7abd8e440da12e1fe25e5400b823670997'],
    ['0018_cas_building_baseline.sql', '2f38221806b98c0aefa0575b180d65b8c3ec86682d83080b1d2aebac62399e48'],
    ['0019_be5_selected_demo_parity.sql', '684685b8ab2218c13e244289f74af70273c8db0996ff02892e593a8580fc9ae8']
  ],
  counts: {
    buildings: 13,
    route_nodes: 20,
    route_edges: 48,
    reverse_pairs: 24,
    valid_geometries: 48,
    exact_reverse_geometries: 24,
    routable_destinations: 13,
    total_vr_scenes: 85,
    total_vr_hotspots: 66,
    selected_vr_scenes: 26,
    selected_source_hotspots: 51,
    guided_scenes: 24,
    interior_scenes: 2,
    cas_schedule_targets: 1
  },
  roster: [
    'Administration Building',
    'Auditorium',
    'Canteen / Cafeteria',
    'College of Arts and Sciences',
    'College of Computer Studies (CCS)',
    'College of Health Sciences (CHS)',
    'Engineering Building',
    'Green Building',
    'Gymnasium',
    'Information and Communications Technology Unit (ICTU)',
    'Library Building',
    'Main Academic Building',
    'Medical & Dental Clinic'
  ],
  policy: {
    active_routes: [{
      destination_name: 'College of Arts and Sciences',
      destination_node_key: 'cas',
      arrival_scene_key: 'scene-cas-1st-floor',
      scene_keys: [
        'scene-guard-house',
        'scene-general-road-10',
        'scene-general-road-11',
        'scene-general-road-12',
        'scene-general-road-13',
        'scene-general-road-14',
        'scene-general-road-15',
        'scene-general-road-19',
        'scene-general-road-20',
        'scene-general-road-21',
        'scene-general-road-22',
        'scene-general-road-23',
        'scene-general-road-27',
        'scene-general-road-28',
        'scene-general-road-29',
        'scene-general-road-30',
        'scene-general-road-31',
        'scene-general-road-32',
        'scene-general-road-33',
        'scene-general-road-37',
        'scene-general-road-38',
        'scene-general-road-38-5',
        'scene-general-road-39',
        'scene-cas-1st-floor'
      ]
    }],
    deferred_destinations: [{
      destination_name: 'College of Computer Studies (CCS)',
      destination_node_key: 'ccs'
    }],
    interior_scene_keys: [
      'scene-cas-1st-floor-2',
      'scene-cas-1st-floor-3'
    ],
    schedule_target: {
      building_name: 'College of Arts and Sciences',
      location_type: 'room',
      location_label: 'CAS 101',
      floor_label: 'First Floor'
    }
  },
  fingerprints: {
    migrations: '2b916720838073de188a2df5c48d5bccfabc7b568939e2e668ae83843aa18172',
    building_route: 'eaafc6244a56df1be2d3ca9dd44690675efcf4582e7c32d226167aa6b9820ba5',
    selected_vr: 'ec66f04bf827bc9c8494a9007ff2e89d7990dd77cc7c5a9d629977ec583f6c6b',
    guided_policy: '550faf217236d729b726fa3df1ab3f08586d8812f4d69b290edcac863ed3d008',
    manifest: 'a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d'
  }
});

module.exports = { SELECTED_DEMO_FREEZE };
