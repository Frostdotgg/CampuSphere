'use strict';

/*
 * CampuSphere selected CAS VR parity — Supabase -> MySQL (BE.4 NO-GO repair, v3).
 *
 * Supabase is authoritative for the SELECTED Guard House -> CAS demonstration
 * dataset. This utility reconciles ONLY that selected scope into MySQL so both
 * backends carry semantically identical CAS scenes/hotspots (matched by natural
 * keys, never numeric ids). Unrelated MySQL VR inventory — including out-of-scope
 * Free Roam branch hotspots that leave a selected source scene — is preserved
 * unchanged. Dry-run is the default and the ONLY authorized mode in this phase.
 *
 * Fail-closed identity: unique natural identity is validated BEFORE any index is
 * trusted. Identity selects which logical row is compared; every semantic
 * attribute is compared separately to classify insert / update / present /
 * delete truthfully, and writes are action-specific (never delete-all).
 *
 * Apply flow (real MySQL transaction):
 *   1 begin; 2 lock the complete selected-source scope; 3 read Supabase
 *   authority; 4 build tx-local natural-key plan; 5 verify action + complete
 *   authority semantic fingerprint vs approved preflight; 6 build the locked
 *   baseline semantic fingerprint; 7 create the backup from that exact locked
 *   snapshot; 8 await + verify its returned path/fingerprint; 9 selective scene
 *   + hotspot mutations; 10 in-tx parity proof + out-of-scope-branch preservation
 *   proof; 11 commit only after the proof; 12 distinct post-commit readback.
 *
 * Usage:
 *   node scripts/syncSelectedCasVrSupabaseToMysql.js --dry-run
 *   node scripts/syncSelectedCasVrSupabaseToMysql.js --apply --confirm=SYNC_SELECTED_CAS_VR_TO_MYSQL
 */

process.env.DOTENV_CONFIG_QUIET = 'true';
require('dotenv').config({ quiet: true });

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('../config/db');
const { getSupabaseClient, hasSupabaseConfig } = require('../config/supabase');
const { normalizeMediaUrl, validateCloudinaryPublicId } = require('../utils/mediaUrl');
const { CLOUDINARY_DELIVERY_ORIGIN } = require('../config/cloudinary');
const { GUIDED_VR_ROUTES } = require('../config/guidedVrRoutes');

const APPLY_CONFIRMATION = 'SYNC_SELECTED_CAS_VR_TO_MYSQL';
const HOTSPOT_TYPES = new Set(['scene', 'info', 'exit', 'schedule']);
const SCHEDULE_LOCATION_TYPES = new Set(['room', 'facility']);

const CAS = GUIDED_VR_ROUTES.find((d) => d.destination_node_key === 'cas');
const GUIDED_KEYS = CAS ? [...CAS.scene_keys] : [];
const INTERIOR_KEYS = ['scene-cas-1st-floor-2', 'scene-cas-1st-floor-3'];
const SELECTED_KEYS = [...new Set([...GUIDED_KEYS, ...INTERIOR_KEYS])];
const SELECTED_SET = new Set(SELECTED_KEYS);
const GUIDED_SET = new Set(GUIDED_KEYS);

const CAS_SCHEDULE = Object.freeze({
  building_name: 'College of Arts and Sciences',
  location_type: 'room',
  location_label: 'CAS 101',
  floor_label: 'First Floor'
});

class SafeSyncError extends Error {}

/* ---------- normalization helpers ---------- */
function canonicalKey(value) {
  return String(value == null ? '' : value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
// CORRECTION #6 (P1): NON-COERCIVE positive-integer id parser. Accepts ONLY a
// JS number that is a safe integer >= 1, or a string whose TRIMMED form matches
// /^[1-9][0-9]*$/ and converts to a safe integer >= 1. Number(value) is never
// called until the raw type and string syntax have passed, so true, false, [],
// [1], objects, boxed numbers, empty/whitespace strings, 0/negative/fractional
// values, NaN, +/-Infinity, hex/exponent/signed/decimal-point strings, and values
// above MAX_SAFE_INTEGER all reject. This is the SINGLE shared parser for every
// backend-local id in the selected-CAS sync utility, so equivalent coercion cannot
// survive elsewhere. Canonical decimal strings stay accepted for driver compat.
function positiveInt(value) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 1 ? value : null;
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (!/^[1-9][0-9]*$/.test(t)) return null;
    const n = Number(t);
    return Number.isSafeInteger(n) && n >= 1 ? n : null;
  }
  return null;
}
function optStr(value) {
  if (value === undefined || value === null) return null;
  const out = String(value).trim();
  return out === '' ? null : out;
}
// Finite number or null — NEVER silently coerces invalid to 0; preserves 0.
// Reached only AFTER isRawNumericValid has accepted the raw value, so it maps a
// genuine null/undefined/'' to semantic NULL and a valid numeric to its number.
function numOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// CORRECTION #4 (Finding 2): the SINGLE strict raw-numeric validator, applied
// BEFORE any semantic tuple or fingerprint is trusted. It only REPORTS
// acceptability — it never converts a rejected value to NULL or 0. Acceptable:
// a real null/undefined (means semantic NULL), a finite JS number (including 0),
// or a non-empty numeric string whose Number() is finite. Rejected: empty/
// whitespace strings, booleans, arrays, objects, NaN, +/-Infinity, and any
// non-numeric string.
function isRawNumericValid(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') {
    if (value.trim() === '') return false;
    return Number.isFinite(Number(value));
  }
  return false;
}

// CORRECTION #4 (Finding 1): required schedule-hotspot identity. Returns
// { ok:true, key } when every required part is valid, else { ok:false, reason }
// with a SANITIZED reason (field names only — never row values). The floor label
// is optional system-wide: a genuine NULL/undefined means "no floor qualifier";
// a SUPPLIED floor must normalize to a non-empty string.
function scheduleIdentity(row, buildingNameById) {
  const buildingId = positiveInt(row.schedule_building_id);
  if (buildingId === null) return { ok: false, reason: 'missing or invalid schedule building id' };
  const bName = buildingNameById.get(buildingId) || null;
  const bCanon = canonicalKey(bName);
  if (!bName || !bCanon) return { ok: false, reason: 'schedule building id resolves to no canonical building' };
  const locType = optStr(row.schedule_location_type);
  if (!SCHEDULE_LOCATION_TYPES.has(locType)) return { ok: false, reason: 'invalid schedule location type' };
  const locLabel = canonicalKey(row.schedule_location_label);
  if (!locLabel) return { ok: false, reason: 'missing schedule location label' };
  let floorPart = '';
  if (row.schedule_floor_label !== undefined && row.schedule_floor_label !== null) {
    const floor = canonicalKey(row.schedule_floor_label);
    if (!floor) return { ok: false, reason: 'blank schedule floor label' };
    floorPart = floor;
  }
  return { ok: true, key: `${bCanon}|${locType}|${locLabel}|${floorPart}` };
}
function isApprovedCloudinaryUrl(raw) {
  const safe = normalizeMediaUrl(raw);
  return safe !== null && safe.indexOf(CLOUDINARY_DELIVERY_ORIGIN + '/') === 0;
}
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((o, k) => { o[k] = stableValue(value[k]); return o; }, {});
  }
  return value;
}
function fingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

// Semantic hotspot identity (no numeric ids). `sceneKeyById` resolves target
// scene ids to keys, INCLUDING targets outside the selected 26-scene set so an
// external Free Roam branch keeps a stable identity.
function hotspotIdentity(sourceKey, row, sceneKeyById, buildingNameById) {
  const type = optStr(row.hotspot_type);
  if (type === 'scene') {
    const targetKey = row.target_scene_id != null ? (sceneKeyById.get(positiveInt(row.target_scene_id)) || null) : null;
    return targetKey ? `${sourceKey}|scene|${targetKey}` : null;
  }
  if (type === 'schedule') {
    // Fail closed on any unresolved/invalid required schedule identity.
    const s = scheduleIdentity(row, buildingNameById);
    return s.ok ? `${sourceKey}|schedule|${s.key}` : null;
  }
  // info / exit: require a non-empty NORMALIZED label.
  const label = canonicalKey(row.label);
  return label ? `${sourceKey}|${type}|${label}` : null;
}

// Full semantic attribute tuples (compared separately from identity). Target is
// resolved via the ALL-scene id->key map so external targets are represented.
function sceneTuple(row, nodeKeyById, buildingNameById) {
  return {
    title: optStr(row.title),
    description: optStr(row.description),
    image_url: normalizeMediaUrl(row.image_url),
    cloudinary_public_id: optStr(row.cloudinary_public_id),
    node_key: row.node_id != null ? (nodeKeyById.get(positiveInt(row.node_id)) || null) : null,
    building_canonical: row.building_id != null
      ? canonicalKey(buildingNameById.get(positiveInt(row.building_id)) || '') || null
      : null,
    initial_yaw: numOrNull(row.initial_yaw),
    initial_pitch: numOrNull(row.initial_pitch),
    display_order: numOrNull(row.display_order)
  };
}
function hotspotTuple(row, allSceneKeyById, buildingNameById) {
  return {
    type: optStr(row.hotspot_type),
    target_key: row.target_scene_id != null ? (allSceneKeyById.get(positiveInt(row.target_scene_id)) || null) : null,
    schedule_building_canonical: row.schedule_building_id != null
      ? canonicalKey(buildingNameById.get(positiveInt(row.schedule_building_id)) || '') || null
      : null,
    schedule_location_type: optStr(row.schedule_location_type),
    schedule_location_label: optStr(row.schedule_location_label),
    schedule_floor_label: optStr(row.schedule_floor_label),
    label: optStr(row.label),
    text: optStr(row.text),
    yaw: numOrNull(row.yaw),
    pitch: numOrNull(row.pitch),
    display_order: numOrNull(row.display_order)
  };
}
function sameTuple(a, b) { return JSON.stringify(stableValue(a)) === JSON.stringify(stableValue(b)); }

/* ---------- unique-identity validation BEFORE indexing ---------- */
function buildBackendIndex(backend, label, blockers, selectedSet = SELECTED_SET) {
  // scene_key unique (selected scope)
  const sceneByKey = new Map();
  for (const s of backend.scenes) {
    const key = optStr(s.scene_key);
    if (key === null) { blockers.push(`${label} scene: null scene_key.`); continue; }
    if (sceneByKey.has(key)) blockers.push(`${label} scene: duplicate scene_key ${key}.`);
    else sceneByKey.set(key, s);
    // CORRECTION #4 (Finding 2): strict raw-numeric validation so malformed values
    // block the fingerprint instead of silently normalizing to NULL/0.
    for (const f of ['initial_yaw', 'initial_pitch', 'display_order']) {
      if (!isRawNumericValid(s[f])) blockers.push(`${label} scene ${key}: malformed ${f}.`);
    }
  }
  // node id->key unique
  const nodeKeyById = new Map();
  const nodeKeys = new Set();
  for (const n of backend.nodes) {
    const id = positiveInt(n.id);
    const key = optStr(n.node_key);
    if (id === null || key === null) { blockers.push(`${label} node: invalid id or node_key.`); continue; }
    if (nodeKeyById.has(id)) blockers.push(`${label} node: duplicate id.`);
    if (nodeKeys.has(key)) blockers.push(`${label} node: duplicate node_key ${key}.`);
    nodeKeyById.set(id, key);
    nodeKeys.add(key);
  }
  // building id->canonical name unique canonical
  const buildingNameById = new Map();
  const buildingCanon = new Set();
  for (const b of backend.buildings) {
    const id = positiveInt(b.id);
    const name = optStr(b.name);
    if (id === null || name === null) { blockers.push(`${label} building: invalid id or name.`); continue; }
    const canon = canonicalKey(name);
    if (buildingNameById.has(id)) blockers.push(`${label} building: duplicate id.`);
    if (buildingCanon.has(canon)) blockers.push(`${label} building: duplicate canonical name ${canon}.`);
    buildingNameById.set(id, name);
    buildingCanon.add(canon);
  }
  // CORRECTION #5 (P1): a SUPPLIED scene node/building reference must resolve, in
  // THIS backend's own maps, to exactly one non-empty node_key / canonical building
  // name. A genuine NULL/undefined stays a valid NULL relationship; a dangling id is
  // NEVER silently normalized to null (which would collide with a genuine-NULL
  // fingerprint). Numeric ids stay backend-local; cross-backend comparison keeps
  // using node_key / canonical building name only. Sanitized: scene_key only, no ids.
  for (const [key, s] of sceneByKey) {
    if (s.node_id !== undefined && s.node_id !== null) {
      const id = positiveInt(s.node_id);
      if (id === null) blockers.push(`${label} scene ${key}: malformed node reference.`);
      else if (!nodeKeyById.has(id) || optStr(nodeKeyById.get(id)) === null) {
        blockers.push(`${label} scene ${key}: node reference resolves to no node.`);
      }
    }
    if (s.building_id !== undefined && s.building_id !== null) {
      const id = positiveInt(s.building_id);
      if (id === null) blockers.push(`${label} scene ${key}: malformed building reference.`);
      else {
        const name = buildingNameById.get(id);
        if (!name || canonicalKey(name) === '') blockers.push(`${label} scene ${key}: building reference resolves to no canonical building.`);
      }
    }
  }
  // ALL-scene id->key reference (minimum needed to resolve external targets).
  const allSceneKeyById = new Map();
  const allById = new Set();
  for (const s of (backend.allScenes || [])) {
    const id = positiveInt(s.id);
    const key = optStr(s.scene_key);
    if (id === null || key === null) { blockers.push(`${label} all-scene ref: invalid id or scene_key.`); continue; }
    if (allById.has(id)) blockers.push(`${label} all-scene ref: duplicate id.`);
    allById.add(id);
    allSceneKeyById.set(id, key);
  }

  // Selected-source hotspots: classify in-scope (parity) vs external (preserved),
  // with unique semantic identity across BOTH classes. Fail closed on an
  // orphaned scene-hotspot target that resolves to no scene at all.
  const hotspotInScopeById = new Map();
  const externalBranches = [];
  const seenIdentity = new Set();
  for (const h of backend.hotspots) {
    const sourceKey = allSceneKeyById.get(positiveInt(h.scene_id));
    if (!sourceKey || !selectedSet.has(sourceKey)) continue;
    const type = optStr(h.hotspot_type);
    if (!HOTSPOT_TYPES.has(type)) { blockers.push(`${label} hotspot on ${sourceKey}: invalid type.`); continue; }

    // CORRECTION #4 (Finding 2): strict raw-numeric validation for hotspot fields.
    for (const f of ['yaw', 'pitch', 'display_order']) {
      if (!isRawNumericValid(h[f])) blockers.push(`${label} hotspot on ${sourceKey}: malformed ${f}.`);
    }

    // CORRECTION #4 (Finding 1): per-type required-identity validation with a
    // sanitized blocker BEFORE the identity enters any Map/Set. An invalid
    // target-side identity (e.g. unknown schedule building) blocks the plan; it is
    // never silently planned for deletion or replacement.
    let external = false;
    if (type === 'scene') {
      const targetKey = h.target_scene_id != null ? allSceneKeyById.get(positiveInt(h.target_scene_id)) : null;
      if (!targetKey) { blockers.push(`${label} hotspot on ${sourceKey}: orphaned scene target.`); continue; }
      external = !selectedSet.has(targetKey);
    } else if (type === 'schedule') {
      const s = scheduleIdentity(h, buildingNameById);
      if (!s.ok) { blockers.push(`${label} schedule hotspot on ${sourceKey}: ${s.reason}.`); continue; }
    } else { // info / exit
      if (!canonicalKey(h.label)) { blockers.push(`${label} ${type} hotspot on ${sourceKey}: missing label.`); continue; }
    }
    const identity = hotspotIdentity(sourceKey, h, allSceneKeyById, buildingNameById);
    if (identity == null) { blockers.push(`${label} hotspot on ${sourceKey}: unresolved semantic identity.`); continue; }
    if (seenIdentity.has(identity)) { blockers.push(`${label} hotspot: duplicate semantic identity in selected scope.`); continue; }
    seenIdentity.add(identity);
    if (external) externalBranches.push({ identity, sourceKey, row: h });
    else hotspotInScopeById.set(identity, { sourceKey, row: h });
  }

  return { sceneByKey, nodeKeyById, buildingNameById, allSceneKeyById, hotspotInScopeById, externalBranches };
}

/* ---------- FINDING 1: one reusable order-independent semantic snapshot ----------
   Uses natural identities only (never cross-backend numeric ids). Includes every
   selected scene's full tuple and every selected-source hotspot's full tuple
   (in-scope AND external branch, with target scene_key resolved across all
   scenes). Used for the authority fingerprint, the locked MySQL baseline, the
   rollback verification, and the post-commit verification. */
function semanticScopeSnapshotFromIndex(idx) {
  const scenes = [...idx.sceneByKey.keys()].sort().map((key) => ({
    scene_key: key, ...sceneTuple(idx.sceneByKey.get(key), idx.nodeKeyById, idx.buildingNameById)
  }));
  const inScope = [...idx.hotspotInScopeById.entries()].map(([identity, x]) => ({
    identity, source: x.sourceKey, scope: 'in', ...hotspotTuple(x.row, idx.allSceneKeyById, idx.buildingNameById)
  }));
  const external = idx.externalBranches.map((x) => ({
    identity: x.identity, source: x.sourceKey, scope: 'external', ...hotspotTuple(x.row, idx.allSceneKeyById, idx.buildingNameById)
  }));
  const byIdentity = (a, b) => (a.identity < b.identity ? -1 : a.identity > b.identity ? 1 : 0);
  inScope.sort(byIdentity);
  external.sort(byIdentity);
  return { scenes, hotspots_in_scope: inScope, hotspots_external: external };
}
// FINDING 3: never fingerprint an ambiguous/invalid semantic snapshot. This
// shared validated path collects EVERY buildBackendIndex blocker and throws a
// sanitized SafeSyncError BEFORE a fingerprint can be produced, so a duplicate or
// invalid identity (scene key, node key, canonical building, hotspot semantic
// identity, orphaned target, invalid schedule identity, or non-finite field) can
// never collapse into a matching hash during authority, preflight, rollback, or
// post-commit verification.
function selectedKeySet(selectedKeys) {
  if (selectedKeys === undefined) return SELECTED_SET;
  if (!Array.isArray(selectedKeys) || selectedKeys.length === 0) {
    throw new SafeSyncError('Selected scene-key scope is missing or invalid.');
  }
  const normalized = selectedKeys.map(optStr);
  if (normalized.some((key) => key === null) || new Set(normalized).size !== normalized.length) {
    throw new SafeSyncError('Selected scene-key scope is missing or ambiguous.');
  }
  return new Set(normalized);
}
function validatedIndex(backend, selectedKeys) {
  const blockers = [];
  const idx = buildBackendIndex(backend, 'fingerprint', blockers, selectedKeySet(selectedKeys));
  if (blockers.length) throw new SafeSyncError('Semantic identity is ambiguous or invalid; refusing to fingerprint the selected scope.');
  return idx;
}
function semanticScopeFingerprint(backend, selectedKeys) {
  return fingerprint(semanticScopeSnapshotFromIndex(validatedIndex(backend, selectedKeys)));
}
function externalBranchFingerprint(backend, selectedKeys) {
  return fingerprint(semanticScopeSnapshotFromIndex(validatedIndex(backend, selectedKeys)).hotspots_external);
}

/* ---------- pure plan (full semantic comparison; parity over in-scope only) ---------- */
function buildPlan(supabase, mysql) {
  const blockers = [];
  const notes = [];

  const sIdx = buildBackendIndex(supabase, 'Supabase', blockers);
  const mIdx = buildBackendIndex(mysql, 'MySQL', blockers);

  for (const key of SELECTED_KEYS) {
    if (!sIdx.sceneByKey.has(key)) blockers.push(`Supabase is missing selected scene ${key}.`);
  }

  const identityClean = blockers.length === 0;
  const scenePlan = [];
  const hotspotPlan = [];
  let scheduleTargets = 0;

  if (identityClean) {
    for (const key of SELECTED_KEYS) {
      const src = sIdx.sceneByKey.get(key);
      const expected = sceneTuple(src, sIdx.nodeKeyById, sIdx.buildingNameById);

      if (GUIDED_SET.has(key)) {
        if (!isApprovedCloudinaryUrl(src.image_url)) blockers.push(`Guided scene ${key}: no approved Cloudinary delivery URL.`);
        const pid = validateCloudinaryPublicId(src.cloudinary_public_id);
        if (!pid.ok || optStr(src.cloudinary_public_id) === null) blockers.push(`Guided scene ${key}: missing/invalid cloudinary_public_id.`);
      }
      if (expected.node_key != null && ![...mIdx.nodeKeyById.values()].includes(expected.node_key)) {
        blockers.push(`Scene ${key}: node_key ${expected.node_key} not present in MySQL.`);
      }
      if (expected.building_canonical != null && ![...mIdx.buildingNameById.values()].some((n) => canonicalKey(n) === expected.building_canonical)) {
        blockers.push(`Scene ${key}: building does not translate to a canonical MySQL building.`);
      }
      for (const f of ['initial_yaw', 'initial_pitch', 'display_order']) {
        if (expected[f] === null) blockers.push(`Scene ${key}: invalid non-finite ${f} in Supabase.`);
      }

      const existing = mIdx.sceneByKey.get(key) || null;
      let action;
      if (!existing) action = 'insert';
      else action = sameTuple(expected, sceneTuple(existing, mIdx.nodeKeyById, mIdx.buildingNameById)) ? 'present' : 'update';
      scenePlan.push({ scene_key: key, guided: GUIDED_SET.has(key), action, expected });
    }

    // In-scope hotspot parity (external branches are preserved, never planned).
    for (const [identity, x] of sIdx.hotspotInScopeById) {
      const expected = hotspotTuple(x.row, sIdx.allSceneKeyById, sIdx.buildingNameById);
      const type = expected.type;
      if (type === 'scene' && (!expected.target_key || !SELECTED_SET.has(expected.target_key))) {
        blockers.push(`Scene hotspot on ${x.sourceKey}: in-scope target expected.`); continue;
      }
      if (type === 'schedule') {
        if (!SCHEDULE_LOCATION_TYPES.has(expected.schedule_location_type)) blockers.push(`Schedule hotspot on ${x.sourceKey}: invalid location type.`);
        if (expected.schedule_location_label === null) blockers.push(`Schedule hotspot on ${x.sourceKey}: missing location label.`);
        if (expected.schedule_building_canonical === null) blockers.push(`Schedule hotspot on ${x.sourceKey}: unresolved building.`);
        else if (![...mIdx.buildingNameById.values()].some((n) => canonicalKey(n) === expected.schedule_building_canonical)) {
          blockers.push(`Schedule hotspot on ${x.sourceKey}: building does not translate to MySQL.`);
        }
        if (expected.schedule_building_canonical === canonicalKey(CAS_SCHEDULE.building_name) &&
            expected.schedule_location_type === CAS_SCHEDULE.location_type &&
            canonicalKey(expected.schedule_location_label) === canonicalKey(CAS_SCHEDULE.location_label) &&
            canonicalKey(expected.schedule_floor_label) === canonicalKey(CAS_SCHEDULE.floor_label)) {
          scheduleTargets += 1;
        }
      }
      for (const f of ['yaw', 'pitch', 'display_order']) {
        if (expected[f] === null) blockers.push(`Hotspot on ${x.sourceKey}: invalid non-finite ${f} in Supabase.`);
      }

      const existing = mIdx.hotspotInScopeById.get(identity) || null;
      let action;
      if (!existing) action = 'insert';
      else action = sameTuple(expected, hotspotTuple(existing.row, mIdx.allSceneKeyById, mIdx.buildingNameById)) ? 'present' : 'update';
      hotspotPlan.push({ identity, source_scene_key: x.sourceKey, action, expected });
    }

    // MySQL-only IN-SCOPE hotspots -> planned delete (never external branches).
    for (const [identity, x] of mIdx.hotspotInScopeById) {
      if (!sIdx.hotspotInScopeById.has(identity)) {
        hotspotPlan.push({ identity, source_scene_key: x.sourceKey, action: 'delete', expected: null });
      }
    }

    if (scheduleTargets !== 1) blockers.push(`Expected exactly one CAS 101 / room / First Floor schedule target; found ${scheduleTargets}.`);
  }

  const counts = {
    scene_insert: scenePlan.filter((r) => r.action === 'insert').length,
    scene_update: scenePlan.filter((r) => r.action === 'update').length,
    scene_present: scenePlan.filter((r) => r.action === 'present').length,
    hotspot_insert: hotspotPlan.filter((r) => r.action === 'insert').length,
    hotspot_update: hotspotPlan.filter((r) => r.action === 'update').length,
    hotspot_present: hotspotPlan.filter((r) => r.action === 'present').length,
    hotspot_delete: hotspotPlan.filter((r) => r.action === 'delete').length,
    external_branches_preserved: mIdx.externalBranches.length
  };

  return {
    blockers: [...new Set(blockers)],
    notes,
    scope: { scenes: SELECTED_KEYS.length, guided: GUIDED_KEYS.length, interior: INTERIOR_KEYS.length },
    supabase: { scenes: supabase.scenes.length, hotspots: supabase.hotspots.length, external: sIdx.externalBranches.length },
    mysql: { scenes: mysql.scenes.length, hotspots: mysql.hotspots.length, external: mIdx.externalBranches.length },
    scenePlan,
    hotspotPlan,
    schedule_targets: scheduleTargets,
    counts,
    actionFingerprint: fingerprint({
      scenes: scenePlan.map((r) => ({ k: r.scene_key, a: r.action, e: r.expected })),
      hotspots: hotspotPlan.map((r) => ({ i: r.identity, a: r.action, e: r.expected }))
    })
  };
}

// True only when the plan is fully reconciled (all present, no writes).
function planIsFullyPresent(plan) {
  return plan.blockers.length === 0 &&
    plan.counts.scene_insert === 0 && plan.counts.scene_update === 0 &&
    plan.counts.hotspot_insert === 0 && plan.counts.hotspot_update === 0 &&
    plan.counts.hotspot_delete === 0 &&
    plan.schedule_targets === 1;
}

/* ---------- reads (add ALL-scene id->key reference) ---------- */
async function readSupabase(sb) {
  async function selIn(table, columns, col, values) {
    const { data, error } = await sb.from(table).select(columns).in(col, values);
    if (error) throw new SafeSyncError(`Unable to read Supabase ${table}.`);
    return data || [];
  }
  async function selAll(table, columns) {
    const { data, error } = await sb.from(table).select(columns);
    if (error) throw new SafeSyncError(`Unable to read Supabase ${table}.`);
    return data || [];
  }
  const scenes = await selIn('vr_scenes',
    'id,scene_key,title,description,image_url,cloudinary_public_id,node_id,building_id,initial_yaw,initial_pitch,display_order',
    'scene_key', SELECTED_KEYS);
  const sceneIds = scenes.map((s) => positiveInt(s.id)).filter((n) => n !== null);
  const hotspots = sceneIds.length ? await selIn('vr_hotspots',
    'id,scene_id,target_scene_id,hotspot_type,label,text,schedule_building_id,schedule_location_type,schedule_location_label,schedule_floor_label,yaw,pitch,display_order',
    'scene_id', sceneIds) : [];
  const nodes = await selAll('route_nodes', 'id,node_key');
  const buildings = await selAll('buildings', 'id,name');
  const allScenes = await selAll('vr_scenes', 'id,scene_key');
  return { scenes, hotspots, nodes, buildings, allScenes };
}

async function readMysqlSelected(conn) {
  const q = conn || db;
  const [scenes] = await q.query(
    'SELECT id, scene_key, title, description, image_url, cloudinary_public_id, node_id, building_id, ' +
    'initial_yaw, initial_pitch, display_order FROM vr_scenes WHERE scene_key IN (?)' + (conn ? ' FOR UPDATE' : ''),
    [SELECTED_KEYS]);
  const sceneIds = scenes.map((s) => positiveInt(s.id)).filter((n) => n !== null);
  let hotspots = [];
  if (sceneIds.length) {
    const [rows] = await q.query(
      'SELECT id, scene_id, target_scene_id, hotspot_type, label, `text` AS text, schedule_building_id, ' +
      'schedule_location_type, schedule_location_label, schedule_floor_label, yaw, pitch, display_order ' +
      'FROM vr_hotspots WHERE scene_id IN (?)' + (conn ? ' FOR UPDATE' : ''), [sceneIds]);
    hotspots = rows;
  }
  const [nodes] = await q.query('SELECT id, node_key FROM route_nodes');
  const [buildings] = await q.query('SELECT id, name FROM buildings');
  const [allScenes] = await q.query('SELECT id, scene_key FROM vr_scenes');
  return { scenes, hotspots, nodes, buildings, allScenes };
}

/* ---------- backup (from the locked snapshot) ---------- */
async function writeBackup(lockedScope, lockedFingerprint) {
  const dir = path.join(os.tmpdir(), 'campusphere-cas-vr-sync');
  const file = path.join(dir,
    `mysql-selected-cas-vr-before-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID()}.json`);
  const backup = {
    schema_version: 3, created_at: new Date().toISOString(),
    selected_keys: SELECTED_KEYS, semantic_fingerprint: lockedFingerprint, mysql_selected: lockedScope
  };
  try {
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(file, `${JSON.stringify(backup, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  } catch (_) {
    throw new SafeSyncError('Unable to create the pre-write MySQL selected-scope backup.');
  }
  return { backupPath: file, fingerprint: lockedFingerprint };
}

/* ---------- FINDING 4: post-commit failures never claim rollback ----------
   After commit succeeds, every failure path — an unexpected error OR an existing
   SafeSyncError — is wrapped in a sanitized SafeSyncError that carries the usable
   recovery backup path EXACTLY once (no duplicate "Backup:" suffix). */
function withBackupSuffix(message, backupPath) {
  if (!backupPath) return message;
  return /Backup:\s/.test(message) ? message : `${message} Backup: ${backupPath}`;
}
function wrapPostCommit(err, backupPath) {
  const raw = (err instanceof SafeSyncError && err.message) ? err.message : 'Post-commit verification failed.';
  return new SafeSyncError(withBackupSuffix(raw, backupPath));
}

/* ---------- adapter-driven apply + pre-commit verification ----------
   The adapter isolates the MySQL transaction + Supabase authority so the pure
   safety probe can drive apply, backup ordering, pre-commit verification, and
   rollback with an in-memory mock. Every step is checked; nothing swallowed.
   adapter: {
     begin(), readLockedScope(), readAuthority(),
     createBackup(lockedScope, fingerprint) -> { backupPath, fingerprint } | throws,
     applyScenes(scenePlan) -> { ok },
     applyHotspots(hotspotPlan) -> { ok },
     commit() -> { ok }, rollback() -> { ok },
     readFreshScope() -> scope,     // fresh connection re-read for rollback verify
   }

   FINDING 2: transaction state is tracked explicitly. Once begin() succeeds,
   EVERY failure before a successful commit rolls back EXACTLY once (centralized;
   no local rollback that could double-release or swallow a rollback failure).
   Before a locked baseline / usable backup exists, the failure is reported as
   "rolled back, no data written" WITHOUT inventing a backup path; once they
   exist, the fresh scope must equal the locked baseline to claim "verified". A
   rollback that throws or fails is reported as ROLLBACK FAILED and never claimed
   as successful. */
async function applyPlanWithAdapter(adapter, approvedPlan, approvedAuthorityFingerprint) {
  let begun = false;
  let committed = false;
  let backupPath = null;
  let lockedBaselineFp = null;

  try {
    await adapter.begin();
    begun = true;

    const lockedMysql = await adapter.readLockedScope();
    const authority = await adapter.readAuthority();

    // Re-verify the tx-local plan and the complete authority semantic fingerprint
    // against the approved preflight before any write.
    const txPlan = buildPlan(authority, lockedMysql);
    if (txPlan.blockers.length) throw new SafeSyncError('Transaction-local preflight found blockers; no data was written.');
    if (txPlan.actionFingerprint !== approvedPlan.actionFingerprint) throw new SafeSyncError('Plan changed after preflight; no data was written.');
    if (semanticScopeFingerprint(authority) !== approvedAuthorityFingerprint) throw new SafeSyncError('Supabase authority changed after preflight; no data was written.');

    // Complete locked-baseline semantic fingerprint + external-branch fingerprint.
    lockedBaselineFp = semanticScopeFingerprint(lockedMysql);
    const lockedExternalFp = externalBranchFingerprint(lockedMysql);

    // FINDING 5: create the backup from the EXACT locked snapshot, await it, and
    // verify its returned fingerprint/path BEFORE the first mutation. A throw or a
    // bad result propagates to the single centralized rollback below — there is no
    // local rollback here that could double-release or hide a rollback failure.
    const backup = await adapter.createBackup(lockedMysql, lockedBaselineFp);
    if (!backup || !backup.backupPath || backup.fingerprint !== lockedBaselineFp) {
      throw new SafeSyncError('No usable backup was created from the locked snapshot; no data was written.');
    }
    backupPath = backup.backupPath;

    // FINDING 4-adjacent: selective, action-specific writes (never delete-all).
    const rScenes = await adapter.applyScenes(txPlan.scenePlan);
    if (!rScenes || rScenes.ok !== true) throw new SafeSyncError('Scene apply failed inside the transaction.');
    const rHot = await adapter.applyHotspots(txPlan.hotspotPlan);
    if (!rHot || rHot.ok !== true) throw new SafeSyncError('Hotspot apply failed inside the transaction.');

    // Pre-commit proof: re-read the locked scope, rebuild parity against the
    // UNCHANGED authority (full present), and prove out-of-scope branches
    // survived byte-for-byte via their fingerprint.
    const afterMysql = await adapter.readLockedScope();
    const authorityAfter = await adapter.readAuthority();
    if (semanticScopeFingerprint(authorityAfter) !== approvedAuthorityFingerprint) {
      throw new SafeSyncError('Supabase authority changed during apply; no commit.');
    }
    if (!planIsFullyPresent(buildPlan(authorityAfter, afterMysql))) {
      throw new SafeSyncError('Pre-commit parity verification did not reach full present state; no commit.');
    }
    if (externalBranchFingerprint(afterMysql) !== lockedExternalFp) {
      throw new SafeSyncError('Pre-commit check found a changed out-of-scope Free Roam branch; no commit.');
    }

    await adapter.commit();
    committed = true;

    // FINDING 4: distinct post-commit readback. ANY failure here is wrapped with
    // the backup path and NEVER triggers rollback (the data is already committed).
    const postMysql = await adapter.readFreshScope();
    const postAuthority = await adapter.readAuthority();
    if (!planIsFullyPresent(buildPlan(postAuthority, postMysql))) {
      throw new SafeSyncError('POST-COMMIT READBACK MISMATCH: data was committed but a concurrent change broke selected-scope parity.');
    }
    return { committed: true, backupPath };
  } catch (err) {
    // FINDING 4: post-commit failures never claim rollback; always carry the path.
    if (committed) throw wrapPostCommit(err, backupPath);

    // FINDING 2: a failure before begin() succeeded -> there is nothing to roll back.
    if (!begun) throw err instanceof SafeSyncError ? err : new SafeSyncError('Apply failed before the transaction began; no data was written.');

    // FINDING 2: every failure after a successful begin rolls back EXACTLY once.
    const base = err instanceof SafeSyncError ? err.message : 'apply failed';
    let rolledBack = false;
    try { const r = await adapter.rollback(); rolledBack = !!(r && r.ok); }
    catch (_) { rolledBack = false; }

    // No locked baseline or usable backup yet -> cannot verify against a baseline
    // and must NOT invent a backup path. Report the rollback outcome truthfully.
    if (backupPath === null || lockedBaselineFp === null) {
      if (rolledBack) throw new SafeSyncError(`Apply failed (${base}); the transaction was rolled back and no data was written.`);
      throw new SafeSyncError(`ROLLBACK FAILED after: ${base}. Manual transaction cleanup required; no usable backup exists.`);
    }

    // Baseline + backup exist -> require the fresh scope to equal the locked baseline.
    let restoredOk = false;
    if (rolledBack) {
      try { restoredOk = semanticScopeFingerprint(await adapter.readFreshScope()) === lockedBaselineFp; }
      catch (_) { restoredOk = false; }
    }
    if (rolledBack && restoredOk) throw new SafeSyncError(`Apply failed (${base}); the MySQL selected scope was rolled back and verified. Backup: ${backupPath}`);
    throw new SafeSyncError(`ROLLBACK VERIFICATION FAILED after: ${base}. Manual restore required. Backup: ${backupPath}`);
  }
}

// Real MySQL-transaction + Supabase-authority adapter. `pool` is injectable so
// the pure safety probe can prove connection-release behavior without a database.
function makeLiveAdapter(sb, pool) {
  const connPool = pool || db;
  let conn = null;

  // CORRECTION #4 (Finding 3): explicit connection ownership. mysql2's pool has no
  // resetOnRelease, so an UNCERTAIN transaction connection must be destroyed (never
  // returned to the pool). `takeConn` clears the internal reference EXACTLY once and
  // hands back the connection so exactly one disposal runs per operation.
  function takeConn() { const c = conn; conn = null; return c; }
  // Confirmed-safe disposal: release once; if release itself throws, destroy — never
  // a second release, never return it to the pool.
  function releaseSafe(c) {
    try { c.release(); }
    catch (_) { try { c.destroy(); } catch (_2) { /* already gone */ } }
  }
  // Uncertain disposal: destroy once; never release.
  function destroyUncertain(c) { try { c.destroy(); } catch (_) { /* already gone */ } }

  return {
    _hasConn() { return conn !== null; },
    async begin() {
      // getConnection failure: nothing was acquired -> no cleanup call.
      const c = await connPool.getConnection();
      conn = c;
      try {
        await c.beginTransaction();
      } catch (err) {
        // Ambiguous begin: destroy (never release), clear, rethrow for sanitized
        // outer handling.
        takeConn();
        destroyUncertain(c);
        throw err;
      }
    },
    async readLockedScope() { return readMysqlSelected(conn); },
    async readAuthority() { return readSupabase(sb); },
    async readFreshScope() { return readMysqlSelected(null); },
    async createBackup(lockedScope, fingerprintValue) { return writeBackup(lockedScope, fingerprintValue); },
    async applyScenes(scenePlan) {
      const [mBuildings] = await conn.query('SELECT id, name FROM buildings');
      const buildingIdByCanonical = new Map(mBuildings.map((b) => [canonicalKey(b.name), positiveInt(b.id)]));
      const [mNodes] = await conn.query('SELECT id, node_key FROM route_nodes');
      const nodeIdByKey = new Map(mNodes.map((n) => [optStr(n.node_key), positiveInt(n.id)]));
      for (const s of scenePlan) {
        if (s.action === 'present') continue; // selective: never touch present rows
        const e = s.expected;
        const nodeId = e.node_key ? (nodeIdByKey.get(e.node_key) || null) : null;
        const buildingId = e.building_canonical ? (buildingIdByCanonical.get(e.building_canonical) || null) : null;
        if (s.action === 'update') {
          const [res] = await conn.query('UPDATE vr_scenes SET title=?, description=?, image_url=?, cloudinary_public_id=?, node_id=?, building_id=?, initial_yaw=?, initial_pitch=?, display_order=? WHERE scene_key=?',
            [e.title, e.description, e.image_url, e.cloudinary_public_id, nodeId, buildingId, e.initial_yaw, e.initial_pitch, e.display_order, s.scene_key]);
          if (res.affectedRows !== 1) throw new SafeSyncError('Scene update affected an unexpected number of rows.');
        } else { // insert
          const [res] = await conn.query('INSERT INTO vr_scenes (scene_key, title, description, image_url, cloudinary_public_id, node_id, building_id, initial_yaw, initial_pitch, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [s.scene_key, e.title, e.description, e.image_url, e.cloudinary_public_id, nodeId, buildingId, e.initial_yaw, e.initial_pitch, e.display_order]);
          if (res.affectedRows !== 1) throw new SafeSyncError('Scene insert affected an unexpected number of rows.');
        }
      }
      return { ok: true };
    },
    async applyHotspots(hotspotPlan) {
      const [mScenes] = await conn.query('SELECT id, scene_key FROM vr_scenes WHERE scene_key IN (?)', [SELECTED_KEYS]);
      const sceneIdByKey = new Map(mScenes.map((s) => [s.scene_key, positiveInt(s.id)]));
      const [allScenes] = await conn.query('SELECT id, scene_key FROM vr_scenes');
      const allKeyById = new Map(allScenes.map((s) => [positiveInt(s.id), optStr(s.scene_key)]));
      const [mBuildings] = await conn.query('SELECT id, name FROM buildings');
      const buildingIdByCanonical = new Map(mBuildings.map((b) => [canonicalKey(b.name), positiveInt(b.id)]));
      const buildingNameById = new Map(mBuildings.map((b) => [positiveInt(b.id), optStr(b.name)]));

      // tx-local IN-SCOPE hotspot identity -> MySQL row id (external branches excluded).
      const selectedIds = [...sceneIdByKey.values()].filter((n) => n !== null);
      let mHot = [];
      if (selectedIds.length) {
        const [rows] = await conn.query(
          'SELECT id, scene_id, target_scene_id, hotspot_type, label, `text` AS text, schedule_building_id, ' +
          'schedule_location_type, schedule_location_label, schedule_floor_label, yaw, pitch, display_order ' +
          'FROM vr_hotspots WHERE scene_id IN (?)', [selectedIds]);
        mHot = rows;
      }
      const idByIdentity = new Map();
      for (const h of mHot) {
        const sourceKey = allKeyById.get(positiveInt(h.scene_id));
        if (!sourceKey || !SELECTED_SET.has(sourceKey)) continue;
        if (optStr(h.hotspot_type) === 'scene') {
          const tk = h.target_scene_id != null ? allKeyById.get(positiveInt(h.target_scene_id)) : null;
          if (!tk || !SELECTED_SET.has(tk)) continue; // external branch -> never touched
        }
        const identity = hotspotIdentity(sourceKey, h, allKeyById, buildingNameById);
        if (identity) idByIdentity.set(identity, positiveInt(h.id));
      }

      for (const h of hotspotPlan) {
        if (h.action === 'present') continue;
        if (h.action === 'delete') {
          const id = idByIdentity.get(h.identity);
          if (id == null) throw new SafeSyncError('Planned hotspot delete identity not found in transaction.');
          const [res] = await conn.query('DELETE FROM vr_hotspots WHERE id=?', [id]);
          if (res.affectedRows !== 1) throw new SafeSyncError('Hotspot delete affected an unexpected number of rows.');
          continue;
        }
        const e = h.expected;
        const sceneId = sceneIdByKey.get(h.source_scene_key);
        const targetId = e.target_key ? sceneIdByKey.get(e.target_key) : null; // in-scope target
        const scheduleBuildingId = e.schedule_building_canonical ? (buildingIdByCanonical.get(e.schedule_building_canonical) || null) : null;
        if (sceneId == null || (e.type === 'scene' && targetId == null) || (e.type === 'schedule' && scheduleBuildingId == null)) {
          throw new SafeSyncError('Unable to resolve a planned hotspot identity inside the transaction.');
        }
        if (h.action === 'update') {
          const id = idByIdentity.get(h.identity);
          if (id == null) throw new SafeSyncError('Planned hotspot update identity not found in transaction.');
          const [res] = await conn.query('UPDATE vr_hotspots SET target_scene_id=?, hotspot_type=?, label=?, `text`=?, schedule_building_id=?, schedule_location_type=?, schedule_location_label=?, schedule_floor_label=?, yaw=?, pitch=?, display_order=? WHERE id=?',
            [targetId, e.type, e.label, e.text, scheduleBuildingId, e.schedule_location_type, e.schedule_location_label, e.schedule_floor_label, e.yaw, e.pitch, e.display_order, id]);
          if (res.affectedRows !== 1) throw new SafeSyncError('Hotspot update affected an unexpected number of rows.');
        } else { // insert
          const [res] = await conn.query('INSERT INTO vr_hotspots (scene_id, target_scene_id, hotspot_type, label, `text`, schedule_building_id, schedule_location_type, schedule_location_label, schedule_floor_label, yaw, pitch, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [sceneId, targetId, e.type, e.label, e.text, scheduleBuildingId, e.schedule_location_type, e.schedule_location_label, e.schedule_floor_label, e.yaw, e.pitch, e.display_order]);
          if (res.affectedRows !== 1) throw new SafeSyncError('Hotspot insert affected an unexpected number of rows.');
        }
      }
      return { ok: true };
    },
    async commit() {
      const c = conn;
      // A commit throw BEFORE confirmation leaves `conn` set so the outer handler
      // can attempt its existing rollback path (which will release or destroy).
      await c.commit();
      // Confirmed commit: release once, never destroy, clear exactly once.
      takeConn();
      releaseSafe(c);
      return { ok: true };
    },
    async rollback() {
      const c = conn;
      try {
        await c.rollback();
      } catch (err) {
        // Uncertain rollback: destroy once, never release, clear, propagate so the
        // caller reports ROLLBACK FAILED / ROLLBACK VERIFICATION FAILED.
        takeConn();
        destroyUncertain(c);
        throw err;
      }
      // Confirmed rollback: release once, never destroy, clear exactly once.
      takeConn();
      releaseSafe(c);
      return { ok: true };
    }
  };
}

/* ---------- reporting + CLI ---------- */
function printPlan(plan, mode) {
  const dryRun = mode === 'dry-run';
  console.log(`=== CampuSphere selected CAS VR parity (Supabase -> MySQL): ${dryRun ? 'DRY RUN' : 'CONFIRMED APPLY PREFLIGHT'} ===`);
  console.log(dryRun ? 'READ ONLY: this invocation cannot issue any Supabase or MySQL mutation.' : 'WRITE MODE: the exact apply confirmation token was accepted.');
  console.log('');
  console.log(`Selected scope:  ${plan.scope.scenes} scenes (${plan.scope.guided} guided + ${plan.scope.interior} interior)`);
  console.log(`Supabase (authority): ${plan.supabase.scenes} selected scenes, ${plan.supabase.hotspots} selected-source hotspots (${plan.supabase.external} external branch)`);
  console.log(`MySQL (target):       ${plan.mysql.scenes} selected scenes, ${plan.mysql.hotspots} selected-source hotspots (${plan.mysql.external} external branch preserved)`);
  console.log(`Scene plan:   ${plan.counts.scene_insert} insert, ${plan.counts.scene_update} update, ${plan.counts.scene_present} present`);
  console.log(`Hotspot plan: ${plan.counts.hotspot_insert} insert, ${plan.counts.hotspot_update} update, ${plan.counts.hotspot_present} present, ${plan.counts.hotspot_delete} delete (in scope); ${plan.counts.external_branches_preserved} external preserved`);
  console.log(`CAS schedule targets found: ${plan.schedule_targets}`);
  console.log('');
  if (plan.blockers.length) {
    console.log(`BLOCKERS (${plan.blockers.length}):`);
    for (const b of plan.blockers.slice(0, 50)) console.log(`  - ${b}`);
    console.log('');
    console.log('SYNC BLOCKED: fail-closed checks must pass before any apply.');
  } else {
    console.log(`${dryRun ? 'DRY RUN' : 'PREFLIGHT'} OK: the selected CAS VR scope resolves by natural identity and full semantic comparison.`);
    if (dryRun) {
      console.log('No data was written. Apply is available only with:');
      console.log(`  node scripts/syncSelectedCasVrSupabaseToMysql.js --apply --confirm=${APPLY_CONFIRMATION}`);
    }
  }
}

function parseArgs(argv) {
  const raw = argv.slice(2);
  const flags = new Set(raw.filter((a) => !a.startsWith('--confirm=')));
  const confirmations = raw.filter((a) => a.startsWith('--confirm=')).map((a) => a.slice('--confirm='.length));
  const allowed = new Set(['--dry-run', '--apply', '--help']);
  for (const f of flags) { if (!allowed.has(f)) throw new SafeSyncError('Unknown argument. Use --dry-run, --apply, or --help.'); }
  if (confirmations.length > 1) throw new SafeSyncError('Apply confirmation must be provided exactly once.');
  if (flags.has('--help')) return { help: true, mode: 'dry-run' };
  if (flags.has('--apply')) {
    if (flags.has('--dry-run')) throw new SafeSyncError('--apply cannot be combined with --dry-run.');
    if (confirmations[0] !== APPLY_CONFIRMATION) throw new SafeSyncError('Apply requires the exact confirmation token; no data was written.');
    return { help: false, mode: 'apply' };
  }
  if (confirmations.length) throw new SafeSyncError('--confirm is valid only with --apply.');
  return { help: false, mode: 'dry-run' };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log('Usage: node scripts/syncSelectedCasVrSupabaseToMysql.js --dry-run');
    console.log(`Apply: node scripts/syncSelectedCasVrSupabaseToMysql.js --apply --confirm=${APPLY_CONFIRMATION}`);
    console.log('Dry-run is the default. Apply writes only after its exact confirmation token.');
    return;
  }
  if (!hasSupabaseConfig()) throw new SafeSyncError('Supabase server credentials are not configured.');
  if (!CAS || GUIDED_KEYS.length !== 24) throw new SafeSyncError('Guided CAS catalog is not the expected 24-scene sequence.');

  const sb = getSupabaseClient();
  const [supabase, mysql] = await Promise.all([readSupabase(sb), readMysqlSelected(null)]);
  const plan = buildPlan(supabase, mysql);
  printPlan(plan, args.mode);
  if (plan.blockers.length) { process.exitCode = 2; return; }
  if (args.mode === 'dry-run') return;

  // Apply path (never reached in this authorization phase). The backup is created
  // INSIDE the transaction flow from the locked snapshot — no pre-transaction
  // backup call here (FINDING 5).
  const approvedAuthorityFingerprint = semanticScopeFingerprint(supabase);
  const result = await applyPlanWithAdapter(makeLiveAdapter(sb), plan, approvedAuthorityFingerprint);
  console.log('');
  console.log('APPLY OK: MySQL selected CAS VR scope matches the Supabase authority (post-commit readback proven).');
  console.log(`Pre-write backup: ${result.backupPath}`);
}

if (require.main === module) {
  main()
    .catch((error) => {
      const message = error instanceof SafeSyncError ? error.message : 'Unexpected selected CAS VR sync failure.';
      console.error(`Selected CAS VR sync failed: ${message}`);
      process.exitCode = 1;
    })
    .finally(async () => { try { await db.end(); } catch (_) { /* no-op */ } });
}

module.exports = {
  APPLY_CONFIRMATION,
  SELECTED_KEYS,
  GUIDED_KEYS,
  INTERIOR_KEYS,
  CAS_SCHEDULE,
  buildPlan,
  planIsFullyPresent,
  applyPlanWithAdapter,
  makeLiveAdapter,
  parseArgs,
  fingerprint,
  canonicalKey,
  optStr,
  positiveInt,
  hotspotIdentity,
  semanticScopeFingerprint,
  externalBranchFingerprint
};
