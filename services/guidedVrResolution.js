'use strict';

/* ========================================
   CampuSphere — Guided VR resolution helpers (BE.4 NO-GO repair)

   Pure, server-side, dependency-light logic extracted from the VR controller
   so the fail-closed route-start identity, the media-aware configured-chain
   verification, and the per-hotspot navigation mapping can be unit-tested with
   in-memory fixtures — no database, no req/res, no network.

   Identity rules (authoritative):
   - route identities translate through node_key;
   - VR identities translate through scene_key;
   - numeric ids are backend-local and are NEVER compared here.

   All three concerns fail closed: a missing/duplicate/ambiguous identity, an
   unapproved panorama, or an unresolved hotspot target yields the safe
   (non-navigating / not-arrived) result rather than a guessed one.
   ======================================== */

const { normalizeMediaUrl } = require('../utils/mediaUrl');
const { CLOUDINARY_DELIVERY_ORIGIN } = require('../config/cloudinary');

const START_NODE_KEY = 'main-gate';
// Conservative scene-key charset for building a Free Roam explore URL. Stored
// scene keys are lowercase-alphanumeric-with-hyphens (e.g. scene-general-road-38-5).
const SAFE_SCENE_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isSafeSceneKey(key) {
  return typeof key === 'string' && key.length > 0 && key.length <= 60 && SAFE_SCENE_KEY.test(key);
}

/* ---------------------------------------------------------
   FIX 1 — fail-closed route start.
   The guided route MUST start at exactly one node whose node_key is
   `main-gate`. A missing or duplicated start node returns { ok:false } with a
   sanitized reason; there is NO fallback to another gate node or the first
   node. Callers translate { ok:false } into an empty path/scene result that
   truthfully reports the Guard House / Main Gate start is unavailable.

   `nodes` is the array of graph nodes already shaped as { key, ... }.
--------------------------------------------------------- */
function resolveStartNode(nodes) {
  const list = Array.isArray(nodes) ? nodes : [];
  const matches = list.filter((n) => n && n.key === START_NODE_KEY);
  if (matches.length !== 1) {
    return { ok: false, reason: 'no_start_node' };
  }
  return { ok: true, node: matches[0] };
}

/* ---------------------------------------------------------
   CAS-only selected-demo policy resolution.

   Active and deferred destinations are compared only through the caller's
   canonical-name function and their stable route node key. An overlap,
   duplicate, malformed entry, or node mismatch is an invalid policy and must
   never fall through to legacy numeric scene mapping.
--------------------------------------------------------- */
function resolveGuidedDestinationPolicy({
  destinationName,
  destinationNodeKey,
  activeRoutes,
  deferredDestinations,
  canonicalize
}) {
  if (typeof canonicalize !== 'function') return { kind: 'invalid' };
  const requestedName = canonicalize(destinationName);
  const requestedNode = typeof destinationNodeKey === 'string'
    ? destinationNodeKey.trim()
    : '';
  if (requestedName === '' || requestedNode === '') return { kind: 'invalid' };

  const matches = [];
  const collect = (entries, kind) => {
    for (const entry of (Array.isArray(entries) ? entries : [])) {
      if (!entry || canonicalize(entry.destination_name) !== requestedName) continue;
      matches.push({ kind, entry });
    }
  };
  collect(activeRoutes, 'active');
  collect(deferredDestinations, 'deferred');

  if (matches.length === 0) return { kind: 'none' };
  if (matches.length !== 1) return { kind: 'invalid' };

  const match = matches[0];
  const policyNode = typeof match.entry.destination_node_key === 'string'
    ? match.entry.destination_node_key.trim()
    : '';
  if (policyNode === '' || policyNode !== requestedNode) return { kind: 'invalid' };
  return match.kind === 'active'
    ? { kind: 'active', route: match.entry }
    : { kind: 'deferred', destination: match.entry };
}

// Generic (non-catalog) routes may use an existing local panorama, but only
// after resolveSceneImageUrl has produced a non-null renderable URL. A mapped
// scene whose media was rejected or whose local file is missing cannot count
// as arrival.
function isResolvedMediaArrival(lastScene, destinationNodeKey) {
  return !!(
    lastScene &&
    typeof lastScene.image_url === 'string' &&
    lastScene.image_url.trim() !== '' &&
    lastScene.node_key != null &&
    String(lastScene.node_key) === String(destinationNodeKey)
  );
}

/* ---------------------------------------------------------
   FIX 2 — media-aware guided coverage.
   A guided scene is usable only when its STORED image_url normalizes to an
   approved HTTPS Cloudinary delivery URL. A null, rejected, malformed,
   missing-local, or local-fallback URL is NOT usable. This is stored delivery
   metadata validation only — no Cloudinary network/API request is made, and
   cloudinary_public_id is never read here.
--------------------------------------------------------- */
function isApprovedCloudinaryUrl(raw) {
  const safe = normalizeMediaUrl(raw);
  if (safe === null) return false;
  // normalizeMediaUrl accepts BOTH local /img paths and Cloudinary delivery
  // URLs; the guided contract requires the Cloudinary delivery form only.
  return safe.indexOf(CLOUDINARY_DELIVERY_ORIGIN + '/') === 0;
}

/**
 * Verify a configured guided chain against the ACTIVE VR-source scenes and
 * scene->scene links, all expressed by natural keys.
 *
 * @param {Object} input
 * @param {Array}  input.keys        ordered configured scene_keys
 * @param {string} input.arrivalKey  the configured arrival scene_key
 * @param {Array}  input.scenes      VR-source scene rows: { scene_key, image_url, ... }
 * @param {Array}  input.links       scene->scene links: { fromKey, toKey }
 *                                   (hotspot_type='scene' only; ids already
 *                                   translated to keys within the VR backend)
 * @param {Function} [input.mediaOk] override the media predicate (test hook);
 *                                   defaults to isApprovedCloudinaryUrl(row.image_url)
 *
 * @returns {Object} { verified: [sceneRow,...], verifiedKeys: [key,...],
 *                     complete: boolean, stoppedBefore: string|null }
 *
 * Rules (all fail closed):
 *   - every expected key must resolve to exactly ONE scene row;
 *   - every scene admitted must have an approved Cloudinary delivery URL;
 *   - every adjacent pair needs exactly ONE forward and ONE reverse link;
 *   - the first failing condition stops the prefix BEFORE that scene;
 *   - complete requires ALL keys verified AND the last verified key equals
 *     arrivalKey (never scenes.length).
 */
function verifyGuidedChain(input) {
  const keys = Array.isArray(input && input.keys) ? input.keys : [];
  const arrivalKey = input && input.arrivalKey;
  const scenes = Array.isArray(input && input.scenes) ? input.scenes : [];
  const links = Array.isArray(input && input.links) ? input.links : [];
  const mediaOk = typeof (input && input.mediaOk) === 'function'
    ? input.mediaOk
    : (row) => isApprovedCloudinaryUrl(row.image_url);

  // Unique scene resolution by key; a duplicated key is ambiguous -> excluded.
  const byKey = new Map();
  const duplicate = new Set();
  for (const s of scenes) {
    if (!s || s.scene_key == null) continue;
    if (byKey.has(s.scene_key)) duplicate.add(s.scene_key);
    else byKey.set(s.scene_key, s);
  }

  // Directed link counts between configured scenes (keyed naturally).
  const linkCount = new Map();
  for (const l of links) {
    if (!l || l.fromKey == null || l.toKey == null) continue;
    const k = l.fromKey + '>' + l.toKey;
    linkCount.set(k, (linkCount.get(k) || 0) + 1);
  }

  const resolvable = (key) => byKey.has(key) && !duplicate.has(key) && mediaOk(byKey.get(key));

  const verified = [];
  let stoppedBefore = null;

  if (keys.length === 0) {
    return { verified, verifiedKeys: [], complete: false, stoppedBefore: null };
  }
  if (!resolvable(keys[0])) {
    return { verified, verifiedKeys: [], complete: false, stoppedBefore: keys[0] };
  }
  verified.push(byKey.get(keys[0]));

  for (let i = 0; i < keys.length - 1; i++) {
    const fromKey = keys[i];
    const toKey = keys[i + 1];
    if (!resolvable(toKey)) { stoppedBefore = toKey; break; }
    if ((linkCount.get(fromKey + '>' + toKey) || 0) !== 1) { stoppedBefore = toKey; break; }
    if ((linkCount.get(toKey + '>' + fromKey) || 0) !== 1) { stoppedBefore = toKey; break; }
    verified.push(byKey.get(toKey));
  }

  const verifiedKeys = verified.map((s) => s.scene_key);
  const complete =
    verified.length === keys.length &&
    verifiedKeys[verifiedKeys.length - 1] === arrivalKey;

  return { verified, verifiedKeys, complete, stoppedBefore };
}

/* ---------------------------------------------------------
   FIX 3 — target-specific panorama navigation.
   Each guided-view scene hotspot derives its navigation ONLY from its exact
   target_scene_key relative to the current step's neighbours:

     - target == preceding configured scene  -> guided Previous URL
     - target == following configured scene   -> guided Next URL
     - on the truthful final arrival scene, any OTHER valid scene target
       -> a safe Free Roam explore URL (/vr/<scene_key>)
     - anything else (unrelated branch on a non-final step, or a
       missing/ambiguous target) -> no navigation URL

   Never returns the shared route Next URL for an arbitrary scene hotspot.
--------------------------------------------------------- */
function deriveHotspotNav(params) {
  const p = params || {};
  const targetKey = typeof p.targetKey === 'string' ? p.targetKey.trim() : '';
  if (targetKey === '') return { kind: 'none', url: null };

  if (p.prevSceneKey && targetKey === p.prevSceneKey) {
    return { kind: 'prev', url: p.prevUrl || null };
  }
  if (p.nextSceneKey && targetKey === p.nextSceneKey) {
    return { kind: 'next', url: p.nextUrl || null };
  }
  if (p.isFinalArrival === true && isSafeSceneKey(targetKey)) {
    return { kind: 'explore', url: '/vr/' + targetKey };
  }
  return { kind: 'none', url: null };
}

module.exports = {
  START_NODE_KEY,
  isSafeSceneKey,
  resolveStartNode,
  resolveGuidedDestinationPolicy,
  isResolvedMediaArrival,
  isApprovedCloudinaryUrl,
  verifyGuidedChain,
  deriveHotspotNav
};
