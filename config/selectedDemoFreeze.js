'use strict';

/*
 * BE.6 expanded Guided-VR catalog freeze.
 *
 * This is a SELECT-only verification baseline, not a runtime write lock. It
 * stores natural identities, counts, and hashes only; backend-local numeric ids
 * and secrets are deliberately absent. MySQL and Supabase complete rosters are
 * pinned separately while the 25-route Guided VR catalog is shared.
 */

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

const SELECTED_DEMO_FREEZE = deepFreeze({
  schema_version: 2,
  frozen_on: '2026-08-25',
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
    ['0019_be5_selected_demo_parity.sql', '684685b8ab2218c13e244289f74af70273c8db0996ff02892e593a8580fc9ae8'],
    ['0020_room_schedule_documents.sql', '236d514d40c8af6d543ce815214039849c06e311f5fd954fc326c7e3cc301ac7']
  ],
  seed_roster: [
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
    active_routes: [
      ['Academic Building I', 'acad-1', 'scene-acad1-1st-floor-4', 6, 'e0db0db2234c166c80f2ffc07d83c1aac0bdfffd8f2ea622cc26a4e506218631'],
      ['Academic Building II', 'acad-2', 'scene-acad-2-1st-floor-17', 26, 'cdd85a378fe64ee4c7857fa035a17a923bced26d8a86af2c530792ac2653a585'],
      ['Academic Building III', 'acad-3', 'scene-cas-1st-floor', 26, '22c3a2c55acf17f47d64fa24da196e4401d3f5550a88a1eac21296bcb39e3958'],
      ['Academic Building V', 'acad-5', 'scene-acad-5-1st-floor-7', 35, 'c0d21e65140840398c107730a4880562609e85685dda7663d834df4497ac784b'],
      ['Academic Building VI', 'acad-6', 'scene-chs-1st-floor-001', 28, '5720fbd5e3cd559afcc731335e732df3649cf316bc6830c23aaac4f0c6671827'],
      ['Administration Building', 'admin-bldg', 'scene-admin-1st-floor-3', 31, '3eac16d4c51c1d9fe0bc190bbd1898618dca6d0a915b6b404235d75e6941c974'],
      ['Academic Building IV', 'ccs', 'scene-ccs-1st-floor', 25, '4e4dd5a8f8838c00298736b0596abff38b33d33a3aee7aac24b7fbb0e6a1192d'],
      ['CITD Building', 'citd', 'scene-citd-1st-floor-5', 18, '588ed89469937850bcecdbcb3e24cfcd2cf4611874f246ce3f816bcd6c8928cc'],
      ['Central Student Council', 'csc', 'scene-csc', 22, '1763aac0994e284d0298a54708e351bb5a2196f7a2ce8570918c2a89fb15f7fe'],
      ['College Dormitory', 'dorm', 'scene-dorm-build-001', 23, '150c855255f3e23b8c23d5fa13ce949c0dcd001ffcf19c63af9d511487873a11'],
      ['Duran Hall', 'duran', 'scene-duran-1st-floor-6', 10, '2ea62e990f2b263ebd26a2d3861bb7b7b0de7f795a4f99514b5065414d70595e'],
      ['FOOD LABORATORY BUILDING', 'food', 'scene-foodlab-1st-floor-1', 25, '8f405e75dc6d60e1f3344fa091a946286ca609016abe78c35ff261985248fee6'],
      ['Freedom Park', 'free-park', 'scene-freedom-park-3', 10, 'c735d23c7c8fb5a176c724df841b015b583573d38c51fdddda2ece9d27025cf3'],
      ['Graduate School Building', 'graduate', 'scene-graduate-school-1st-floor-4', 11, '47f101cc56f3d1d2341bd9c4bbcdb4bb240c16d7a6c9d2b04d4d3c74fb7d5596'],
      ['Green Building', 'green', 'scene-green-1st-floor-7', 23, '045c7ff5242ac78233c85dde01981df5a5117815c1758be3c90b618859357508'],
      ['Gymnasium', 'gym', 'scene-gym-1st-floor-bleacher-1', 16, '3f2a121423fbc7438ca4fa2983d796e9f523d47df90bfa37aa3a681434bde4d4'],
      ['Laboratory & Shop Building', 'lab-shop', 'scene-lab-and-shop-building-001', 12, '2787326271eb1d2ab66157c299e55b3063d7cbd63af0f732b12e9bdb3b285752'],
      ['Library Building', 'library', 'scene-library-1st-floor-4', 22, 'dfb4f3d9017b05835ec5d63338aeac5a48136277e35bbd03868c556c4c4909ec'],
      ['MULTI-PURPOSE-BUILDING I', 'multi-1', 'scene-audit-building-006', 30, 'dc395b88b40b21b1877ab924fdca8c821e10200315502310674950dfe6364802'],
      ['Multi-Purpose Building II', 'multi-2', 'scene-multi-2-1st-floor-3', 4, '44ea8016e54717bb3a19a179f9ae7d59533d45416032d47ed0e6681efe172e66'],
      ['Pearl Park', 'pearl-park', 'scene-pearl-park-2', 16, 'b59c04ebbe11bbf8624cfe673ef1dc828b15029038481a371d2d71e97d800016'],
      ['Staff House', 'staff-house', 'scene-staff-house-2nd-floor-1', 6, '9201996bad95ad403461b3f8e4a6270cc451d3a82e79ced4a2f560e5e71fbe56'],
      ['Supply & Property Building', 'supply-property-bldg', 'scene-supply-1st-floor-001', 20, '8e31c161467218e030fce4c49871b7b266099dff4f259e6f8d819c8200caf6fc'],
      ['Technohub Building', 'techno-bldg', 'scene-techno-1st-floor-1', 9, '8c577cb9d9450c1e5f1fa36fef2a7fe8129edc6b12dc30e2ff5f4186e0b4ad94'],
      ['Villafuerte Hall', 'villafuerte-hall', 'scene-vh-1', 18, '59f5091db551aaf8a4caac5d2f09b8549fce027fde4e0a95612cf62a451cda56']
    ].map(([destination_name, destination_node_key, arrival_scene_key, step_count, scene_keys_sha256]) => ({
      destination_name, destination_node_key, arrival_scene_key, step_count, scene_keys_sha256
    })),
    deferred_destinations: [],
    interior_scene_keys: ['scene-cas-1st-floor-2', 'scene-cas-1st-floor-3']
  },
  backends: {
    mysql: {
      counts: {
        buildings: 34,
        route_nodes: 44,
        building_nodes: 36,
        route_edges: 100,
        reverse_pairs: 50,
        valid_geometries: 100,
        exact_reverse_geometries: 50,
        routable_destinations: 33,
        total_vr_scenes: 671,
        total_vr_hotspots: 1397,
        selected_vr_scenes: 101,
        selected_source_hotspots: 288,
        selected_schedule_hotspots: 1,
        active_guided_destinations: 25,
        configured_guided_steps: 472,
        unique_guided_scenes: 99,
        interior_scenes: 2
      },
      roster: [
        'Academic Building I', 'Academic Building II', 'Academic Building III',
        'Academic Building IV', 'Academic Building V', 'Academic Building VI',
        'Administration Building', 'Auditorium', 'CITD Building', 'Canteen / Cafeteria',
        'Central Student Council', 'College Dormitory', 'College of Arts and Sciences',
        'College of Computer Studies (CCS)', 'College of Health Sciences (CHS)', 'Duran Hall',
        'Engineering Building', 'FOOD LABORATORY BUILDING', 'Freedom Park',
        'Graduate School Building', 'Green Building', 'Gymnasium',
        'Information and Communications Technology Unit (ICTU)', 'Laboratory & Shop Building',
        'Library Building', 'MULTI-PURPOSE BUILDING I', 'Main Academic Building',
        'Medical & Dental Clinic', 'Multi-Purpose Building II', 'Pearl Park', 'Staff House',
        'Supply & Property Building', 'Technohub Building', 'Villafuerte Hall'
      ],
      fingerprints: {
        building_route: '0dbb4c4ca38b375393c7ae2c842e1f799d429feda11d17cb29cee6ff0c2564ff',
        selected_vr: '371321de2af6be1ac87fb2f0d7c30a946c5538409022fd2968e21894b97caca2',
        guided_catalog: 'ed02ec95d5c642cd082f48c0b3c5b98d0707ffd5866f8f90b196793ecfe963d6'
      }
    },
    supabase: {
      counts: {
        buildings: 25,
        route_nodes: 26,
        building_nodes: 25,
        route_edges: 50,
        reverse_pairs: 25,
        valid_geometries: 50,
        exact_reverse_geometries: 25,
        routable_destinations: 25,
        total_vr_scenes: 664,
        total_vr_hotspots: 1373,
        selected_vr_scenes: 101,
        selected_source_hotspots: 280,
        selected_schedule_hotspots: 0,
        active_guided_destinations: 25,
        configured_guided_steps: 472,
        unique_guided_scenes: 99,
        interior_scenes: 2
      },
      roster: [
        'Academic Building I', 'Academic Building II', 'Academic Building III',
        'Academic Building IV', 'Academic Building V', 'Academic Building VI',
        'Administration Building', 'CITD Building', 'Central Student Council',
        'College Dormitory', 'Duran Hall', 'FOOD LABORATORY BUILDING', 'Freedom Park',
        'Graduate School Building', 'Green Building', 'Gymnasium',
        'Laboratory & Shop Building', 'Library Building', 'MULTI-PURPOSE BUILDING I',
        'Multi-Purpose Building II', 'Pearl Park', 'Staff House', 'Supply & Property Building',
        'Technohub Building', 'Villafuerte Hall'
      ],
      fingerprints: {
        building_route: '727605aa08c648ea645148087e937ea8f9723ca2fc201c3ece7f7c0229424625',
        selected_vr: '1ec674e497cbe8fd36234368f9c0a679c05bd68c8002c3f9724e7b3f0de0810c',
        guided_catalog: 'ed02ec95d5c642cd082f48c0b3c5b98d0707ffd5866f8f90b196793ecfe963d6'
      }
    }
  },
  fingerprints: {
    migrations: '904978d7acf081c6e2757ff78bbc8c27e71decfedc948326e34fb76ede614de7',
    guided_policy: '41935fcfcdbf4b653e9983d71208c481ab7fc510034df66b18a2f3a43035d81c',
    manifest: '17959fa6efa1194afcc3709b7334f7752616bc84fc47528f77b53c8aebaad969'
  }
});

module.exports = { SELECTED_DEMO_FREEZE };
