'use strict';

/* ========================================
   CampuSphere - Guided VR resolution PURE probe (BE.4 NO-GO repair)

   Read-only, no server, no database, no network. Exercises the pure
   services/guidedVrResolution.js helpers with in-memory fixtures so the
   fail-closed route-start identity, the media-aware configured-chain
   verification, and the per-hotspot navigation mapping are proven WITHOUT
   depending on the current (damaged) Supabase/MySQL data.

   These are pure code-behavior assertions and MUST all pass regardless of the
   live route-graph / VR parity defects.

   Run:  node scripts/guidedVrResolution-probe.js
   ======================================== */

const {
  resolveStartNode,
  resolveGuidedDestinationPolicy,
  isResolvedMediaArrival,
  verifyGuidedChain,
  deriveHotspotNav,
  isApprovedCloudinaryUrl
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

const CAS = GUIDED_VR_ROUTES.find((d) => d.destination_node_key === 'cas');
const CCS = GUIDED_VR_ROUTES.find((d) => d.destination_node_key === 'ccs');
const KEYS = CAS ? CAS.scene_keys : [];
const CCS_KEYS = CCS ? CCS.scene_keys : [];
const ARRIVAL = CAS ? CAS.arrival_scene_key : 'scene-cas-1st-floor';
const CCS_ARRIVAL = CCS ? CCS.arrival_scene_key : 'scene-ccs-1st-floor';
const CLOUD = 'https://res.cloudinary.com/demo/image/upload/';

// Build a fully-linked, Cloudinary-backed fixture for the whole configured
// chain: one scene per key + exact forward/reverse scene links between
// adjacent keys. Helpers below mutate copies to model each defect.
function fullScenesFor(keys) {
  return keys.map((k, i) => ({ scene_key: k, image_url: CLOUD + k + '.jpg', id: i + 1 }));
}
function fullLinksFor(keys) {
  const links = [];
  for (let i = 0; i < keys.length - 1; i++) {
    links.push({ fromKey: keys[i], toKey: keys[i + 1] });
    links.push({ fromKey: keys[i + 1], toKey: keys[i] });
  }
  return links;
}
function fullScenes() { return fullScenesFor(KEYS); }
function fullLinks() { return fullLinksFor(KEYS); }

function canonicalize(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/* ---- active selected-demo destination policy ---- */
console.log('=== Active selected-demo destination policy ===');
check('CAS resolves as an active guided route', (function () {
  const r = resolveGuidedDestinationPolicy({
    destinationName: 'College of Arts and Sciences',
    destinationNodeKey: 'cas',
    activeRoutes: GUIDED_VR_ROUTES,
    deferredDestinations: DEFERRED_GUIDED_VR_DESTINATIONS,
    canonicalize
  });
  return r.kind === 'active' && r.route === CAS;
})());
check('CCS resolves as an active guided route by canonical name and node key', (function () {
  const r = resolveGuidedDestinationPolicy({
    destinationName: 'College of Computer Studies (CCS)',
    destinationNodeKey: 'ccs',
    activeRoutes: GUIDED_VR_ROUTES,
    deferredDestinations: DEFERRED_GUIDED_VR_DESTINATIONS,
    canonicalize
  });
  return r.kind === 'active' && r.route === CCS;
})());
check('duplicate active CCS identity fails closed', (function () {
  const overlap = GUIDED_VR_ROUTES.concat([{
    destination_name: 'College of Computer Studies CCS',
    destination_node_key: 'ccs',
    arrival_scene_key: 'scene-ccs',
    scene_keys: ['scene-ccs']
  }]);
  return resolveGuidedDestinationPolicy({
    destinationName: 'College of Computer Studies (CCS)',
    destinationNodeKey: 'ccs',
    activeRoutes: overlap,
    deferredDestinations: DEFERRED_GUIDED_VR_DESTINATIONS,
    canonicalize
  }).kind === 'invalid';
})());
check('active/deferred CCS overlap fails closed', (function () {
  return resolveGuidedDestinationPolicy({
    destinationName: 'College of Computer Studies (CCS)',
    destinationNodeKey: 'ccs',
    activeRoutes: GUIDED_VR_ROUTES,
    deferredDestinations: [{
      destination_name: 'College of Computer Studies (CCS)',
      destination_node_key: 'ccs'
    }],
    canonicalize
  }).kind === 'invalid';
})());
check('policy node mismatch fails closed', (function () {
  return resolveGuidedDestinationPolicy({
    destinationName: 'College of Computer Studies (CCS)',
    destinationNodeKey: 'cas',
    activeRoutes: GUIDED_VR_ROUTES,
    deferredDestinations: DEFERRED_GUIDED_VR_DESTINATIONS,
    canonicalize
  }).kind === 'invalid';
})());
check('unlisted destination keeps the generic route policy', (function () {
  return resolveGuidedDestinationPolicy({
    destinationName: 'Engineering Building',
    destinationNodeKey: 'engineering',
    activeRoutes: GUIDED_VR_ROUTES,
    deferredDestinations: DEFERRED_GUIDED_VR_DESTINATIONS,
    canonicalize
  }).kind === 'none';
})());
check('generic mapped scene with missing media cannot count as arrival',
  isResolvedMediaArrival({ node_key: 'ccs', image_url: null }, 'ccs') === false);
check('generic mapped scene with resolved media can count as arrival',
  isResolvedMediaArrival({ node_key: 'library', image_url: '/img/library.jpg' }, 'library') === true);

/* ---- FIX 1: fail-closed route start ---- */
console.log('=== FIX 1: fail-closed route start ===');
check('missing main-gate fails closed (no start node)',
  resolveStartNode([{ key: 'flagpole', node_type: 'gate' }, { key: 'cas' }]).ok === false);
check('duplicate main-gate fails closed',
  resolveStartNode([{ key: 'main-gate' }, { key: 'main-gate' }]).ok === false);
check('no fallback to another gate node when main-gate is absent',
  resolveStartNode([{ key: 'welcome-arch', node_type: 'gate' }, { key: 'flagpole' }]).ok === false);
check('no fallback to the first node when main-gate is absent',
  resolveStartNode([{ key: 'flagpole' }, { key: 'cas' }]).ok === false);
check('exactly one main-gate resolves ok',
  (function () { const r = resolveStartNode([{ key: 'flagpole' }, { key: 'main-gate', id: 7 }]); return r.ok === true && r.node.id === 7; })());

/* ---- FIX 2: media-aware configured-chain verification ---- */
console.log('=== FIX 2: media-aware configured-chain verification ===');
check('media predicate: approved Cloudinary URL is usable', isApprovedCloudinaryUrl(CLOUD + 'a.jpg') === true);
check('media predicate: local /img fallback is NOT usable', isApprovedCloudinaryUrl('/img/vr/a.jpg') === false);
check('media predicate: null / missing is NOT usable', isApprovedCloudinaryUrl(null) === false);
check('media predicate: malformed / rejected is NOT usable', isApprovedCloudinaryUrl('http://evil.example/a.jpg') === false);

check('complete Cloudinary-backed 24-scene chain permits arrival', (function () {
  const r = verifyGuidedChain({ keys: KEYS, arrivalKey: ARRIVAL, scenes: fullScenes(), links: fullLinks() });
  return r.complete === true && r.verifiedKeys.length === KEYS.length &&
    r.verifiedKeys[r.verifiedKeys.length - 1] === ARRIVAL;
})());

check('complete Cloudinary-backed 23-scene CCS chain permits arrival', (function () {
  const r = verifyGuidedChain({
    keys: CCS_KEYS,
    arrivalKey: CCS_ARRIVAL,
    scenes: fullScenesFor(CCS_KEYS),
    links: fullLinksFor(CCS_KEYS)
  });
  return r.complete === true && r.verifiedKeys.length === CCS_KEYS.length &&
    r.verifiedKeys[r.verifiedKeys.length - 1] === CCS_ARRIVAL;
})());

check('missing Road 94 -> CCS reverse link stops before the CCS arrival', (function () {
  const road94 = CCS_KEYS[CCS_KEYS.length - 2];
  const links = fullLinksFor(CCS_KEYS).filter(
    (link) => !(link.fromKey === CCS_ARRIVAL && link.toKey === road94)
  );
  const r = verifyGuidedChain({
    keys: CCS_KEYS,
    arrivalKey: CCS_ARRIVAL,
    scenes: fullScenesFor(CCS_KEYS),
    links
  });
  return r.complete === false && r.stoppedBefore === CCS_ARRIVAL &&
    r.verifiedKeys.length === CCS_KEYS.length - 1;
})());

check('a null panorama on scene 5 stops the prefix before it (no arrival)', (function () {
  const scenes = fullScenes();
  scenes[4].image_url = null; // 5th configured scene
  const r = verifyGuidedChain({ keys: KEYS, arrivalKey: ARRIVAL, scenes, links: fullLinks() });
  return r.complete === false && r.verifiedKeys.length === 4 && r.stoppedBefore === KEYS[4];
})());

check('a local-only panorama on scene 3 stops the prefix before it (no arrival)', (function () {
  const scenes = fullScenes();
  scenes[2].image_url = '/img/vr/' + KEYS[2] + '.jpg';
  const r = verifyGuidedChain({ keys: KEYS, arrivalKey: ARRIVAL, scenes, links: fullLinks() });
  return r.complete === false && r.verifiedKeys.length === 2 && r.stoppedBefore === KEYS[2];
})());

check('a rejected (non-Cloudinary https) panorama on the first scene yields an empty prefix', (function () {
  const scenes = fullScenes();
  scenes[0].image_url = 'https://cdn.evil.example/' + KEYS[0] + '.jpg';
  const r = verifyGuidedChain({ keys: KEYS, arrivalKey: ARRIVAL, scenes, links: fullLinks() });
  return r.complete === false && r.verifiedKeys.length === 0 && r.stoppedBefore === KEYS[0];
})());

check('a missing forward/reverse link stops the prefix at that transition', (function () {
  const links = fullLinks().filter((l) => !(l.fromKey === KEYS[3] && l.toKey === KEYS[2]));
  const r = verifyGuidedChain({ keys: KEYS, arrivalKey: ARRIVAL, scenes: fullScenes(), links });
  return r.complete === false && r.verifiedKeys.length === 3 && r.stoppedBefore === KEYS[3];
})());

check('a duplicate scene key is ambiguous and stops the prefix before it', (function () {
  const scenes = fullScenes();
  scenes.push({ scene_key: KEYS[2], image_url: CLOUD + 'dup.jpg', id: 999 });
  const r = verifyGuidedChain({ keys: KEYS, arrivalKey: ARRIVAL, scenes, links: fullLinks() });
  return r.complete === false && r.verifiedKeys.length === 2 && r.stoppedBefore === KEYS[2];
})());

check('arrival is never claimed from scenes.length alone (last must equal arrival key)', (function () {
  // A chain that resolves every scene but whose last key is not the arrival key
  // (shorter catalog) must not report complete.
  const shortKeys = KEYS.slice(0, 5);
  const scenes = fullScenes();
  const links = fullLinks();
  const r = verifyGuidedChain({ keys: shortKeys, arrivalKey: ARRIVAL, scenes, links });
  return r.verifiedKeys.length === 5 && r.complete === false;
})());

/* ---- FIX 3: target-specific panorama navigation ---- */
console.log('=== FIX 3: target-specific panorama navigation ===');
// Model step 2 of the CAS route: current=Road 10, prev=Guard House (step 1),
// next=Road 11 (step 3). Note the configured order is guard-house, road-10,
// road-11 (keys[1]=road-10, keys[0]=guard-house, keys[2]=road-11).
const STEP2_PREV = KEYS[0]; // scene-guard-house
const STEP2_NEXT = KEYS[2]; // scene-general-road-11
check('Road 10 "Back" (target=Guard House) maps to guided step 1 (Previous URL)', (function () {
  const nav = deriveHotspotNav({
    targetKey: STEP2_PREV, prevSceneKey: STEP2_PREV, nextSceneKey: STEP2_NEXT,
    isFinalArrival: false, prevUrl: '/vr/to/153?step=1', nextUrl: '/vr/to/153?step=3'
  });
  return nav.kind === 'prev' && nav.url === '/vr/to/153?step=1';
})());
check('Road 10 "Forward" (target=Road 11) maps to guided step 3 (Next URL)', (function () {
  const nav = deriveHotspotNav({
    targetKey: STEP2_NEXT, prevSceneKey: STEP2_PREV, nextSceneKey: STEP2_NEXT,
    isFinalArrival: false, prevUrl: '/vr/to/153?step=1', nextUrl: '/vr/to/153?step=3'
  });
  return nav.kind === 'next' && nav.url === '/vr/to/153?step=3';
})());
// Model step 24 (arrival = scene-cas-1st-floor): prev=Road 39 (step 23), no next.
const FINAL_PREV = KEYS[KEYS.length - 2]; // scene-general-road-39
check('final CAS -> Road 39 hotspot maps to guided step 23 (Previous URL)', (function () {
  const nav = deriveHotspotNav({
    targetKey: FINAL_PREV, prevSceneKey: FINAL_PREV, nextSceneKey: null,
    isFinalArrival: true, prevUrl: '/vr/to/153?step=23', nextUrl: null
  });
  return nav.kind === 'prev' && nav.url === '/vr/to/153?step=23';
})());
check('final CAS -> CAS interior hotspot maps to its safe Free Roam URL', (function () {
  const nav = deriveHotspotNav({
    targetKey: 'scene-cas-1st-floor-2', prevSceneKey: FINAL_PREV, nextSceneKey: null,
    isFinalArrival: true, prevUrl: '/vr/to/153?step=23', nextUrl: null
  });
  return nav.kind === 'explore' && nav.url === '/vr/scene-cas-1st-floor-2';
})());
check('unrelated non-final branch has NO navigation URL', (function () {
  const nav = deriveHotspotNav({
    targetKey: 'scene-somewhere-else', prevSceneKey: STEP2_PREV, nextSceneKey: STEP2_NEXT,
    isFinalArrival: false, prevUrl: '/vr/to/153?step=1', nextUrl: '/vr/to/153?step=3'
  });
  return nav.kind === 'none' && nav.url === null;
})());
check('a non-final interior branch (not prev/next) has NO navigation URL', (function () {
  const nav = deriveHotspotNav({
    targetKey: 'scene-cas-1st-floor-2', prevSceneKey: STEP2_PREV, nextSceneKey: STEP2_NEXT,
    isFinalArrival: false, prevUrl: '/x', nextUrl: '/y'
  });
  return nav.kind === 'none' && nav.url === null;
})());
check('an empty/missing target yields NO navigation URL', (function () {
  const a = deriveHotspotNav({ targetKey: '', prevSceneKey: STEP2_PREV, nextSceneKey: STEP2_NEXT, isFinalArrival: true });
  const b = deriveHotspotNav({ targetKey: null, isFinalArrival: true });
  return a.kind === 'none' && a.url === null && b.kind === 'none' && b.url === null;
})());

console.log('');
if (failures.length === 0) {
  console.log('GUIDED-VR-RESOLUTION-PROBE OK: all pure-logic checks passed.');
  process.exitCode = 0;
} else {
  console.error(`GUIDED-VR-RESOLUTION-PROBE FAILED: ${failures.length} check(s) did not pass:`);
  failures.forEach((f) => console.error('  - ' + f));
  process.exitCode = 1;
}
