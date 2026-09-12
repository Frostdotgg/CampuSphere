'use strict';

/*
 * Catalog-wide Guided VR pure probe.
 *
 * Read-only: no server, database, network, or session. Exercises every active
 * route plus fail-closed malformed/partial fixtures using natural identities.
 */

const {
  resolveStartNode,
  resolveGuidedDestinationPolicyByName,
  resolveGuidedDestinationPolicy,
  isResolvedMediaArrival,
  verifyGuidedChain,
  deriveHotspotNav,
  isApprovedCloudinaryUrl,
  hasApprovedCloudinaryMetadata
} = require('../services/guidedVrResolution');
const {
  GUIDED_VR_ROUTES,
  VEHICLE_GUIDED_VR_ROUTES,
  WALKING_GUIDED_VR_ROUTES,
  GUIDED_VR_ROUTES_BY_MODE,
  DEFERRED_GUIDED_VR_DESTINATIONS
} = require('../config/guidedVrRoutes');

const failures = [];
function check(label, ok) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}`);
  if (!ok) failures.push(label);
}

function canonicalize(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function scenesFor(route) {
  return route.scene_keys.map((sceneKey, index) => ({
    id: index + 1,
    scene_key: sceneKey,
    image_url: `https://res.cloudinary.com/demo/image/upload/${sceneKey}.jpg`,
    cloudinary_public_id: `campusphere/vr/${sceneKey}`,
    node_key: index === 0
      ? 'main-gate'
      : (index === route.scene_keys.length - 1 ? route.destination_node_key : null)
  }));
}

function linksFor(keys) {
  const links = [];
  for (let index = 0; index < keys.length - 1; index += 1) {
    links.push({ fromKey: keys[index], toKey: keys[index + 1] });
    links.push({ fromKey: keys[index + 1], toKey: keys[index] });
  }
  return links;
}

function verifyRoute(route, scenes = scenesFor(route), links = linksFor(route.scene_keys)) {
  return verifyGuidedChain({
    keys: route.scene_keys,
    arrivalKey: route.arrival_scene_key,
    scenes,
    links,
    startNodeKey: 'main-gate',
    destinationNodeKey: route.destination_node_key
  });
}

// Independent source-contract manifest for the walking routes added in this
// release. The runtime catalog remains the application input; these arrays
// pin the owner-supplied order so a route cannot silently pass by only matching
// its count and endpoint.
const NEW_WALKING_PREFIX = Object.freeze([
  'scene-guard-house-walk-1st-floor-1',
  'scene-guard-staff-house-2nd-floor-1',
  'scene-guard-staff-house-2nd-floor-2',
  'scene-multi-2-2nd-floor-1',
  'scene-multi-2-2nd-floor-2',
  'scene-multi-2-2nd-floor-4',
  'scene-multi-2-2nd-floor-5',
  'scene-acad1-2nd-floor-1',
  'scene-acad1-2nd-floor-2',
  'scene-acad1-2nd-floor-3',
  'scene-acad1-2nd-floor-4',
  'scene-acad1-1st-floor-4',
  'scene-acad1-1st-floor-5',
  'scene-acad1-1st-floor-6',
  'scene-acad1-1st-floor-7',
  'scene-techno-1st-floor-1',
  'scene-techno-1st-floor-2',
  'scene-graduate-school-1st-floor-1',
  'scene-graduate-school-1st-floor-2',
  'scene-graduate-school-1st-floor-3',
  'scene-graduate-school-1st-floor-4',
  'scene-graduate-school-1st-floor-5',
  'scene-lab-and-shop-building-001',
  'scene-lab-and-shop-building-002',
  'scene-lab-and-shop-building-003',
  'scene-lab-and-shop-building-004',
  'scene-lab-and-shop-building-005',
  'scene-lab-and-shop-building-006',
  'scene-lab-and-shop-building-007',
  'scene-lab-and-shop-building-008',
  'scene-lab-and-shop-building-009',
  'scene-lab-and-shop-building-010',
  'scene-lab-and-shop-building-011',
  'scene-lab-and-shop-building-012',
  'scene-lab-and-shop-building-013'
]);
const NEW_WALKING_CITD = Object.freeze([
  'scene-citd-1st-floor-1',
  'scene-citd-1st-floor-2',
  'scene-citd-1st-floor-3',
  'scene-citd-1st-floor-4',
  'scene-citd-1st-floor-5',
  'scene-citd-1st-floor-6',
  'scene-citd-1st-floor-7',
  'scene-citd-1st-floor-8'
]);
const EXPECTED_NEW_WALKING_SEQUENCES = Object.freeze({
  'acad-6': Object.freeze([...NEW_WALKING_PREFIX, ...NEW_WALKING_CITD,
    'scene-general-road-32', 'scene-general-road-33', 'scene-general-road-33-5',
    'scene-general-road-37', 'scene-general-road-38', 'scene-general-road-94',
    'scene-general-road-93', 'scene-general-road-92', 'scene-general-road-91',
    'scene-chs-1st-floor-001']),
  'acad-3': Object.freeze([...NEW_WALKING_PREFIX, ...NEW_WALKING_CITD,
    'scene-general-road-32', 'scene-general-road-33', 'scene-general-road-33-5',
    'scene-general-road-37', 'scene-general-road-38', 'scene-general-road-38-5',
    'scene-general-road-39', 'scene-cas-1st-floor']),
  'supply-property-bldg': Object.freeze([...NEW_WALKING_PREFIX, ...NEW_WALKING_CITD,
    'scene-general-road-32', 'scene-supply-1st-floor-001']),
  citd: Object.freeze([...NEW_WALKING_PREFIX, 'scene-citd-1st-floor-1']),
  'lab-shop': Object.freeze([...NEW_WALKING_PREFIX.slice(0, 22), 'scene-lab-and-shop-building-001']),
  graduate: Object.freeze([...NEW_WALKING_PREFIX.slice(0, 17), 'scene-graduate-school-1st-floor-1']),
  'techno-bldg': Object.freeze([...NEW_WALKING_PREFIX.slice(0, 15), 'scene-techno-1st-floor-1']),
  'acad-1': Object.freeze([
    'scene-guard-house-walk-1st-floor-1', 'scene-guard-staff-house-2nd-floor-1',
    'scene-guard-staff-house-2nd-floor-2', 'scene-multi-2-2nd-floor-1',
    'scene-multi-2-2nd-floor-2', 'scene-multi-2-2nd-floor-3',
    'scene-multi-2-1st-floor-1', 'scene-multi-2-1st-floor-2',
    'scene-multi-2-1st-floor-3', 'scene-multi-2-1st-floor-4',
    'scene-acad1-1st-floor-1'
  ]),
  'multi-2': Object.freeze([
    'scene-guard-house-walk-1st-floor-1', 'scene-guard-staff-house-2nd-floor-1',
    'scene-guard-staff-house-2nd-floor-2', 'scene-multi-2-2nd-floor-1',
    'scene-multi-2-2nd-floor-2'
  ]),
  green: Object.freeze([...NEW_WALKING_PREFIX, ...NEW_WALKING_CITD,
    'scene-general-road-32', 'scene-general-road-33', 'scene-general-road-33-5',
    'scene-green-1st-floor-9']),
  'staff-house': Object.freeze([
    'scene-guard-house-walk-1st-floor-1', 'scene-guard-staff-house-2nd-floor-1',
    'scene-guard-staff-house-2nd-floor-2', 'scene-guard-staff-house-2nd-floor-3',
    'scene-guard-staff-house-2nd-floor-4', 'scene-staff-house-2nd-floor-1'
  ]),
  'villafuerte-hall': Object.freeze([
    'scene-guard-house-walk-1st-floor-1',
    'scene-guard-house-walk-1st-floor-2',
    'scene-staff-house-1st-floor-1',
    'scene-staff-house-1st-floor-2',
    'scene-admin-1st-floor-5',
    'scene-admin-1st-floor-4',
    'scene-admin-1st-floor-3',
    'scene-admin-1st-floor-2',
    'scene-admin-1st-floor-1',
    'scene-foodlab-1st-floor-5',
    'scene-foodlab-1st-floor-4',
    'scene-foodlab-1st-floor-3',
    'scene-foodlab-1st-floor-1',
    'scene-library-1st-floor-10',
    'scene-library-1st-floor-9',
    'scene-library-1st-floor-5',
    'scene-library-1st-floor-4',
    'scene-library-1st-floor-3',
    'scene-library-1st-floor-2',
    'scene-library-1st-floor-1',
    'scene-audit-building-019',
    'scene-audit-building-017',
    'scene-audit-building-016',
    'scene-audit-building-015',
    'scene-audit-building-014',
    'scene-audit-building-013',
    'scene-audit-building-012',
    'scene-audit-building-006',
    'scene-general-road-64',
    'scene-general-road-65',
    'scene-general-road-26',
    'scene-general-road-25',
    'scene-pearl-park-16',
    'scene-pearl-park-17',
    'scene-vh-1'
  ]),
  'pearl-park': Object.freeze([
    'scene-guard-house-walk-1st-floor-1',
    'scene-guard-house-walk-1st-floor-2',
    'scene-staff-house-1st-floor-1',
    'scene-staff-house-1st-floor-2',
    'scene-admin-1st-floor-5',
    'scene-admin-1st-floor-4',
    'scene-admin-1st-floor-3',
    'scene-admin-1st-floor-2',
    'scene-admin-1st-floor-1',
    'scene-foodlab-1st-floor-5',
    'scene-foodlab-1st-floor-4',
    'scene-foodlab-1st-floor-3',
    'scene-foodlab-1st-floor-1',
    'scene-library-1st-floor-10',
    'scene-library-1st-floor-9',
    'scene-library-1st-floor-5',
    'scene-library-1st-floor-4',
    'scene-library-1st-floor-3',
    'scene-library-1st-floor-2',
    'scene-library-1st-floor-1',
    'scene-audit-building-019',
    'scene-audit-building-017',
    'scene-audit-building-016',
    'scene-audit-building-015',
    'scene-audit-building-014',
    'scene-audit-building-013',
    'scene-audit-building-012',
    'scene-audit-building-006',
    'scene-general-road-64',
    'scene-general-road-65',
    'scene-general-road-26',
    'scene-general-road-25',
    'scene-pearl-park-2'
  ]),
  'free-park': Object.freeze([
    'scene-guard-house-walk-1st-floor-1',
    'scene-guard-house-walk-1st-floor-2',
    'scene-staff-house-1st-floor-1',
    'scene-staff-house-1st-floor-2',
    'scene-admin-1st-floor-5',
    'scene-admin-1st-floor-4',
    'scene-admin-1st-floor-3',
    'scene-general-road-78',
    'scene-freedom-park-1'
  ]),
  'acad-5': Object.freeze([
    'scene-guard-house-walk-1st-floor-1',
    'scene-guard-house-walk-1st-floor-2',
    'scene-staff-house-1st-floor-1',
    'scene-staff-house-1st-floor-2',
    'scene-admin-1st-floor-5',
    'scene-admin-1st-floor-4',
    'scene-admin-1st-floor-3',
    'scene-admin-1st-floor-2',
    'scene-admin-1st-floor-1',
    'scene-foodlab-1st-floor-5',
    'scene-foodlab-1st-floor-4',
    'scene-foodlab-1st-floor-3',
    'scene-foodlab-1st-floor-1',
    'scene-library-1st-floor-10',
    'scene-library-1st-floor-9',
    'scene-library-1st-floor-5',
    'scene-library-1st-floor-4',
    'scene-library-1st-floor-3',
    'scene-library-1st-floor-2',
    'scene-library-1st-floor-1',
    'scene-audit-building-019',
    'scene-audit-building-017',
    'scene-audit-building-016',
    'scene-audit-building-015',
    'scene-audit-building-014',
    'scene-audit-building-013',
    'scene-audit-building-012',
    'scene-audit-building-006',
    'scene-audit-building-005',
    'scene-audit-building-004',
    'scene-audit-building-003',
    'scene-audit-building-002',
    'scene-audit-building-001',
    'scene-acad-2-1st-floor-15',
    'scene-acad-2-1st-floor-20',
    'scene-acad-2-1st-floor-19',
    'scene-acad-2-1st-floor-18',
    'scene-acad-2-1st-floor-16',
    'scene-acad-2-1st-floor-17',
    'scene-general-road-60',
    'scene-general-road-59',
    'scene-general-road-58',
    'scene-general-road-57',
    'scene-general-road-53',
    'scene-general-road-52',
    'scene-general-road-51',
    'scene-general-road-50',
    'scene-general-road-49',
    'scene-acad-5-1st-floor-7'
  ]),
  duran: Object.freeze([
    'scene-guard-house-walk-1st-floor-1',
    'scene-guard-house-walk-1st-floor-2',
    'scene-staff-house-1st-floor-1',
    'scene-staff-house-1st-floor-2',
    'scene-admin-1st-floor-5',
    'scene-admin-1st-floor-4',
    'scene-admin-1st-floor-3',
    'scene-admin-1st-floor-2',
    'scene-admin-1st-floor-1',
    'scene-foodlab-1st-floor-5',
    'scene-foodlab-1st-floor-4',
    'scene-foodlab-1st-floor-3',
    'scene-foodlab-1st-floor-1',
    'scene-general-road-72',
    'scene-duran-1st-floor-1'
  ]),
  gym: Object.freeze([
    'scene-guard-house-walk-1st-floor-1',
    'scene-guard-house-walk-1st-floor-2',
    'scene-staff-house-1st-floor-1',
    'scene-staff-house-1st-floor-2',
    'scene-admin-1st-floor-5',
    'scene-admin-1st-floor-4',
    'scene-admin-1st-floor-3',
    'scene-admin-1st-floor-2',
    'scene-admin-1st-floor-1',
    'scene-foodlab-1st-floor-5',
    'scene-foodlab-1st-floor-4',
    'scene-foodlab-1st-floor-3',
    'scene-foodlab-1st-floor-1',
    'scene-library-1st-floor-10',
    'scene-library-1st-floor-9',
    'scene-library-1st-floor-5',
    'scene-library-1st-floor-4',
    'scene-library-1st-floor-3',
    'scene-library-1st-floor-2',
    'scene-library-1st-floor-1',
    'scene-audit-building-019',
    'scene-audit-building-017',
    'scene-audit-building-016',
    'scene-audit-building-015',
    'scene-audit-building-014',
    'scene-audit-building-013',
    'scene-audit-building-012',
    'scene-audit-building-006',
    'scene-general-road-64',
    'scene-general-road-65',
    'scene-general-road-26',
    'scene-general-road-25',
    'scene-gym-1st-floor-bleacher-1'
  ])
});

const EXPECTED_WALKING_ROUTES = Object.freeze([
  { name: 'Academic Building IV', node: 'ccs', count: 50, arrival: 'scene-ccs-1st-floor' },
  { name: 'Academic Building II', node: 'acad-2', count: 39, arrival: 'scene-acad-2-1st-floor-17' },
  { name: 'MULTI-PURPOSE-BUILDING I', node: 'multi-1', count: 28, arrival: 'scene-audit-building-006' },
  { name: 'Central Student Council', node: 'csc', count: 24, arrival: 'scene-csc' },
  { name: 'College Dormitory', node: 'dorm', count: 25, arrival: 'scene-dorm-build-001' },
  { name: 'Library Building', node: 'library', count: 17, arrival: 'scene-library-1st-floor-4' },
  { name: 'FOOD LABORATORY BUILDING', node: 'food', count: 13, arrival: 'scene-foodlab-1st-floor-1' },
  { name: 'Administration Building', node: 'admin-bldg', count: 7, arrival: 'scene-admin-1st-floor-3' },
  { name: 'Academic Building VI', node: 'acad-6', count: 53, arrival: 'scene-chs-1st-floor-001' },
  { name: 'Academic Building III', node: 'acad-3', count: 51, arrival: 'scene-cas-1st-floor' },
  { name: 'Supply & Property Building', node: 'supply-property-bldg', count: 45, arrival: 'scene-supply-1st-floor-001' },
  { name: 'CITD Building', node: 'citd', count: 36, arrival: 'scene-citd-1st-floor-1' },
  { name: 'Laboratory & Shop Building', node: 'lab-shop', count: 23, arrival: 'scene-lab-and-shop-building-001' },
  { name: 'Graduate School Building', node: 'graduate', count: 18, arrival: 'scene-graduate-school-1st-floor-1' },
  { name: 'Technohub Building', node: 'techno-bldg', count: 16, arrival: 'scene-techno-1st-floor-1' },
  { name: 'Academic Building I', node: 'acad-1', count: 11, arrival: 'scene-acad1-1st-floor-1' },
  { name: 'Multi-Purpose Building II', node: 'multi-2', count: 5, arrival: 'scene-multi-2-2nd-floor-2' },
  { name: 'Green Building', node: 'green', count: 47, arrival: 'scene-green-1st-floor-9' },
  { name: 'Staff House', node: 'staff-house', count: 6, arrival: 'scene-staff-house-2nd-floor-1' },
  { name: 'Villafuerte Hall', node: 'villafuerte-hall', count: 35, arrival: 'scene-vh-1' },
  { name: 'Pearl Park', node: 'pearl-park', count: 33, arrival: 'scene-pearl-park-2' },
  { name: 'Freedom Park', node: 'free-park', count: 9, arrival: 'scene-freedom-park-1' },
  { name: 'Academic Building V', node: 'acad-5', count: 49, arrival: 'scene-acad-5-1st-floor-7' },
  { name: 'Duran Hall', node: 'duran', count: 15, arrival: 'scene-duran-1st-floor-1' },
  { name: 'Gymnasium', node: 'gym', count: 33, arrival: 'scene-gym-1st-floor-bleacher-1' }
]);

console.log('=== Catalog authority ===');
check('exactly 25 active Guided VR destinations are configured', GUIDED_VR_ROUTES.length === 25);
check('no destination is deferred', DEFERRED_GUIDED_VR_DESTINATIONS.length === 0);
check('destination names are canonically unique',
  new Set(GUIDED_VR_ROUTES.map((route) => canonicalize(route.destination_name))).size === GUIDED_VR_ROUTES.length);
check('destination node keys are unique',
  new Set(GUIDED_VR_ROUTES.map((route) => route.destination_node_key)).size === GUIDED_VR_ROUTES.length);
check('legacy catalog alias remains the Vehicle catalog',
  GUIDED_VR_ROUTES === VEHICLE_GUIDED_VR_ROUTES && GUIDED_VR_ROUTES_BY_MODE.vehicle === GUIDED_VR_ROUTES);
check('twenty-five Walking routes are configured',
  WALKING_GUIDED_VR_ROUTES.length === EXPECTED_WALKING_ROUTES.length);
check('Walking catalog has 688 configured scene steps',
  WALKING_GUIDED_VR_ROUTES.reduce((total, route) => total + route.scene_keys.length, 0) === 688);
for (const expected of EXPECTED_WALKING_ROUTES) {
  const route = WALKING_GUIDED_VR_ROUTES.find((entry) =>
    canonicalize(entry.destination_name) === canonicalize(expected.name));
  const finalKey = route && route.scene_keys[route.scene_keys.length - 1];
  check(`${expected.node}: Walking manifest matches the configured route`,
    !!route && route.destination_node_key === expected.node &&
    route.scene_keys.length === expected.count &&
    route.scene_keys[0] === 'scene-guard-house-walk-1st-floor-1' &&
    finalKey === expected.arrival && route.arrival_scene_key === expected.arrival &&
    new Set(route.scene_keys).size === route.scene_keys.length);
  const expectedSequence = EXPECTED_NEW_WALKING_SEQUENCES[expected.node];
  if (expectedSequence) {
    check(`${expected.node}: Walking scene order matches the owner manifest`,
      !!route && JSON.stringify(route.scene_keys) === JSON.stringify(expectedSequence));
  }
  check(`${expected.node}: Walking chain passes the media/link/endpoint verifier`,
    !!route && verifyRoute(route).complete === true);
}

for (const route of GUIDED_VR_ROUTES) {
  const label = route.destination_node_key;
  const byName = resolveGuidedDestinationPolicyByName({
    destinationName: route.destination_name,
    activeRoutes: GUIDED_VR_ROUTES,
    deferredDestinations: DEFERRED_GUIDED_VR_DESTINATIONS,
    canonicalize
  });
  check(`${label}: canonical name resolves the configured natural node key`,
    byName.kind === 'active' && byName.route.destination_node_key === route.destination_node_key);

  const exact = resolveGuidedDestinationPolicy({
    destinationName: route.destination_name,
    destinationNodeKey: route.destination_node_key,
    activeRoutes: GUIDED_VR_ROUTES,
    deferredDestinations: DEFERRED_GUIDED_VR_DESTINATIONS,
    canonicalize
  });
  check(`${label}: exact name/node policy is active`, exact.kind === 'active' && exact.route === route);

  const chain = verifyRoute(route);
  check(`${label}: complete media/link/endpoint fixture reaches configured arrival`,
    chain.complete === true && chain.verifiedKeys.length === route.scene_keys.length &&
    chain.verifiedKeys[chain.verifiedKeys.length - 1] === route.arrival_scene_key);
}

console.log('=== Fail-closed policy fixtures ===');
const first = GUIDED_VR_ROUTES[0];
check('unknown destination remains outside the catalog',
  resolveGuidedDestinationPolicyByName({
    destinationName: 'Unlisted Building', activeRoutes: GUIDED_VR_ROUTES,
    deferredDestinations: [], canonicalize
  }).kind === 'none');
check('duplicate canonical destination name is invalid',
  resolveGuidedDestinationPolicyByName({
    destinationName: first.destination_name,
    activeRoutes: GUIDED_VR_ROUTES.concat([{ ...first }]),
    deferredDestinations: [], canonicalize
  }).kind === 'invalid');
check('active/deferred overlap is invalid',
  resolveGuidedDestinationPolicyByName({
    destinationName: first.destination_name,
    activeRoutes: GUIDED_VR_ROUTES,
    deferredDestinations: [{ destination_name: first.destination_name, destination_node_key: first.destination_node_key }],
    canonicalize
  }).kind === 'invalid');
check('resolved sibling node mismatch is invalid',
  resolveGuidedDestinationPolicy({
    destinationName: first.destination_name, destinationNodeKey: 'wrong-sibling',
    activeRoutes: GUIDED_VR_ROUTES, deferredDestinations: [], canonicalize
  }).kind === 'invalid');
check('malformed active route with duplicate scene keys is invalid', (function () {
  const malformed = { ...first, scene_keys: [first.scene_keys[0], first.scene_keys[0]], arrival_scene_key: first.scene_keys[0] };
  return resolveGuidedDestinationPolicyByName({
    destinationName: malformed.destination_name, activeRoutes: [malformed],
    deferredDestinations: [], canonicalize
  }).kind === 'invalid';
})());

console.log('=== Fail-closed start, media, endpoint, and link fixtures ===');
check('missing main-gate fails closed', resolveStartNode([{ key: 'other-gate' }]).ok === false);
check('duplicate main-gate fails closed', resolveStartNode([{ key: 'main-gate' }, { key: 'main-gate' }]).ok === false);
check('exactly one main-gate resolves', resolveStartNode([{ key: 'main-gate', id: 1 }]).ok === true);
check('approved Cloudinary URL is accepted', isApprovedCloudinaryUrl('https://res.cloudinary.com/demo/image/upload/a.jpg'));
check('local media is not approved Guided VR delivery', !isApprovedCloudinaryUrl('/img/vr/a.jpg'));
check('valid URL and public id are approved metadata', hasApprovedCloudinaryMetadata({
  image_url: 'https://res.cloudinary.com/demo/image/upload/a.jpg',
  cloudinary_public_id: 'campusphere/vr/a'
}));
check('missing public id fails delivery metadata', !hasApprovedCloudinaryMetadata({
  image_url: 'https://res.cloudinary.com/demo/image/upload/a.jpg', cloudinary_public_id: null
}));
check('generic mapped scene without media is not arrival',
  !isResolvedMediaArrival({ node_key: first.destination_node_key, image_url: null }, first.destination_node_key));

check('wrong stored start node stops before the first scene', (function () {
  const scenes = scenesFor(first);
  scenes[0].node_key = 'other-gate';
  const result = verifyRoute(first, scenes);
  return !result.complete && result.verifiedKeys.length === 0 && result.stoppedBefore === first.scene_keys[0];
})());
check('wrong stored arrival node stops before arrival', (function () {
  const scenes = scenesFor(first);
  scenes[scenes.length - 1].node_key = 'wrong-sibling';
  const result = verifyRoute(first, scenes);
  return !result.complete && result.verifiedKeys.length === first.scene_keys.length - 1 &&
    result.stoppedBefore === first.arrival_scene_key;
})());
check('missing panorama public id stops the verified prefix', (function () {
  const scenes = scenesFor(first);
  scenes[2].cloudinary_public_id = null;
  const result = verifyRoute(first, scenes);
  return !result.complete && result.verifiedKeys.length === 2 && result.stoppedBefore === first.scene_keys[2];
})());
check('duplicate scene row is ambiguous', (function () {
  const scenes = scenesFor(first);
  scenes.push({ ...scenes[2], id: 9999 });
  const result = verifyRoute(first, scenes);
  return !result.complete && result.verifiedKeys.length === 2 && result.stoppedBefore === first.scene_keys[2];
})());
check('duplicate forward link stops the chain', (function () {
  const links = linksFor(first.scene_keys);
  links.push({ fromKey: first.scene_keys[1], toKey: first.scene_keys[2] });
  const result = verifyRoute(first, scenesFor(first), links);
  return !result.complete && result.verifiedKeys.length === 2 && result.stoppedBefore === first.scene_keys[2];
})());
check('missing reverse link stops the chain', (function () {
  const from = first.scene_keys[1];
  const to = first.scene_keys[2];
  const links = linksFor(first.scene_keys).filter((link) => !(link.fromKey === to && link.toKey === from));
  const result = verifyRoute(first, scenesFor(first), links);
  return !result.complete && result.verifiedKeys.length === 2 && result.stoppedBefore === to;
})());

console.log('=== Target-specific navigation ===');
const keys = first.scene_keys;
check('previous target maps only to the guided previous URL', (function () {
  const nav = deriveHotspotNav({ targetKey: keys[0], prevSceneKey: keys[0], nextSceneKey: keys[2],
    isFinalArrival: false, prevUrl: '/prev', nextUrl: '/next' });
  return nav.kind === 'prev' && nav.url === '/prev';
})());
check('next target maps only to the guided next URL', (function () {
  const nav = deriveHotspotNav({ targetKey: keys[2], prevSceneKey: keys[0], nextSceneKey: keys[2],
    isFinalArrival: false, prevUrl: '/prev', nextUrl: '/next' });
  return nav.kind === 'next' && nav.url === '/next';
})());
check('safe final-scene branch maps to Free Roam', (function () {
  const nav = deriveHotspotNav({ targetKey: 'scene-interior-1', prevSceneKey: keys[keys.length - 2],
    nextSceneKey: null, isFinalArrival: true, prevUrl: '/prev' });
  return nav.kind === 'explore' && nav.url === '/vr/scene-interior-1';
})());
check('unrelated non-final branch does not navigate', (function () {
  const nav = deriveHotspotNav({ targetKey: 'scene-interior-1', prevSceneKey: keys[0],
    nextSceneKey: keys[2], isFinalArrival: false, prevUrl: '/prev', nextUrl: '/next' });
  return nav.kind === 'none' && nav.url === null;
})());

console.log('');
if (failures.length === 0) {
  console.log('GUIDED-VR-RESOLUTION-PROBE OK: catalog-wide pure contracts passed.');
} else {
  console.error(`GUIDED-VR-RESOLUTION-PROBE FAILED: ${failures.length} check(s) did not pass:`);
  failures.forEach((failure) => console.error('  - ' + failure));
  process.exitCode = 1;
}
