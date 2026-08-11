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

console.log('=== Catalog authority ===');
check('exactly 25 active Guided VR destinations are configured', GUIDED_VR_ROUTES.length === 25);
check('no destination is deferred', DEFERRED_GUIDED_VR_DESTINATIONS.length === 0);
check('destination names are canonically unique',
  new Set(GUIDED_VR_ROUTES.map((route) => canonicalize(route.destination_name))).size === GUIDED_VR_ROUTES.length);
check('destination node keys are unique',
  new Set(GUIDED_VR_ROUTES.map((route) => route.destination_node_key)).size === GUIDED_VR_ROUTES.length);

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
