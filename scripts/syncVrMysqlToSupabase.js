'use strict';

/*
 * CampuSphere MySQL -> Supabase VR metadata sync.
 *
 * Dry-run is the default. Apply mode requires an exact confirmation token,
 * repeats the full fail-closed preflight immediately before the first write,
 * creates a durable target backup, and verifies the finished dataset. Because
 * PostgREST mutations are not one cross-request transaction, failed applies
 * attempt a compensating rollback and verify the target against the backup.
 *
 * Natural identity rules:
 *   - buildings: canonical name (case/punctuation/spacing folded)
 *   - route nodes: node_key
 *   - scenes: scene_key
 *   - hotspots: source scene_key + display_order
 *
 * Numeric IDs are backend-local. MySQL IDs are used only to resolve the source
 * row; every Supabase foreign key is planned from the natural identity above.
 * Missing, duplicate, orphaned, or ambiguous identities are blockers.
 *
 * Usage:
 *   node scripts/syncVrMysqlToSupabase.js --dry-run
 *   node scripts/syncVrMysqlToSupabase.js --apply --confirm=SYNC_VR_MYSQL_TO_SUPABASE
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

const PAGE_SIZE = 500;
const ORDER_MAX = 2147483647;
const APPLY_CONFIRMATION = 'SYNC_VR_MYSQL_TO_SUPABASE';
const HOTSPOT_TYPES = new Set(['scene', 'info', 'exit', 'schedule']);
const SCHEDULE_LOCATION_TYPES = new Set(['room', 'facility']);

const SCENE_FIELDS = [
  'title', 'description', 'image_url', 'cloudinary_public_id', 'node_id',
  'building_id', 'initial_yaw', 'initial_pitch', 'display_order'
];

const HOTSPOT_FIELDS = [
  'scene_id', 'target_scene_id', 'hotspot_type', 'label', 'text',
  'schedule_building_id', 'schedule_location_type',
  'schedule_location_label', 'schedule_floor_label',
  'yaw', 'pitch', 'display_order'
];

class SafeSyncError extends Error {}

function canonicalKey(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function positiveInt(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

function orderInt(value) {
  const n = Number(value == null ? 0 : value);
  return Number.isSafeInteger(n) && n >= 0 && n <= ORDER_MAX ? n : null;
}

function angle(value, min, max) {
  const n = Number(value == null ? 0 : value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function optionalString(value) {
  if (value === undefined || value === null) return null;
  const out = String(value).trim();
  return out === '' ? null : out;
}

function requiredString(value, max) {
  const out = optionalString(value);
  return out !== null && out.length <= max ? out : null;
}

function sceneKey(value) {
  const out = optionalString(value);
  if (out === null || out.length > 60) return null;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(out) ? out : null;
}

function hotspotSlot(sceneKeyValue, displayOrder) {
  return `${sceneKeyValue}::${displayOrder}`;
}

function groupBy(rows, keyFn) {
  const out = new Map();
  for (const row of rows || []) {
    const key = keyFn(row);
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(row);
  }
  return out;
}

function uniqueById(rows, label, blockers) {
  const groups = groupBy(rows, (row) => positiveInt(row.id));
  const out = new Map();
  for (const [id, matches] of groups) {
    if (id === null || matches.length !== 1) {
      blockers.push(`${label}: invalid or duplicate numeric source identity.`);
      continue;
    }
    out.set(id, matches[0]);
  }
  return out;
}

function oneNaturalMatch(groups, key, context, blockers) {
  if (!key) {
    blockers.push(`${context}: natural identity is empty.`);
    return null;
  }
  const matches = groups.get(key) || [];
  if (matches.length === 0) {
    blockers.push(`${context}: no Supabase natural-identity match.`);
    return null;
  }
  if (matches.length > 1) {
    blockers.push(`${context}: ambiguous Supabase natural-identity match.`);
    return null;
  }
  return matches[0];
}

function comparable(value) {
  if (value === undefined || value === null || value === '') return null;
  return value;
}

function sameField(field, left, right) {
  const a = comparable(left);
  const b = comparable(right);
  if (['node_id', 'building_id', 'scene_id', 'target_scene_id',
    'schedule_building_id', 'display_order'].includes(field)) {
    return a === null && b === null ? true : Number(a) === Number(b);
  }
  if (['initial_yaw', 'initial_pitch', 'yaw', 'pitch'].includes(field)) {
    return a === null && b === null ? true : Number(a) === Number(b);
  }
  return a === b;
}

function changedFields(expected, actual, fields) {
  return fields.filter((field) => !sameField(field, expected[field], actual[field]));
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const value = item[key];
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function validateSceneRow(row, context, blockers, media) {
  const key = sceneKey(row.scene_key);
  if (key === null) blockers.push(`${context}: invalid scene_key.`);
  if (requiredString(row.title, 150) === null) blockers.push(`${context}: invalid title.`);

  const description = optionalString(row.description);
  if (description !== null && description.length > 5000) {
    blockers.push(`${context}: description exceeds 5000 characters.`);
  }

  const imageUrl = optionalString(row.image_url);
  if (imageUrl !== null) {
    if (imageUrl.length > 255 || normalizeMediaUrl(imageUrl) === null) {
      blockers.push(`${context}: unsafe or oversized image_url.`);
    } else if (imageUrl.startsWith('https://res.cloudinary.com/')) {
      media.cloudinary += 1;
    } else {
      media.local += 1;
    }
  } else {
    media.missing += 1;
  }

  const publicId = validateCloudinaryPublicId(row.cloudinary_public_id);
  if (!publicId.ok) blockers.push(`${context}: invalid cloudinary_public_id.`);
  if (angle(row.initial_yaw, -180, 180) === null) blockers.push(`${context}: invalid initial_yaw.`);
  if (angle(row.initial_pitch, -90, 90) === null) blockers.push(`${context}: invalid initial_pitch.`);
  if (orderInt(row.display_order) === null) blockers.push(`${context}: invalid display_order.`);
  return key;
}

function validateHotspotRow(row, sourceSceneKey, context, blockers) {
  const type = optionalString(row.hotspot_type);
  const label = requiredString(row.label, 150);
  const displayOrder = orderInt(row.display_order);

  if (!HOTSPOT_TYPES.has(type)) blockers.push(`${context}: invalid hotspot_type.`);
  if (label === null) blockers.push(`${context}: invalid label.`);
  if (displayOrder === null) blockers.push(`${context}: invalid display_order.`);
  if (angle(row.yaw, -180, 180) === null) blockers.push(`${context}: invalid yaw.`);
  if (angle(row.pitch, -90, 90) === null) blockers.push(`${context}: invalid pitch.`);

  const text = optionalString(row.text);
  if (text !== null && text.length > 5000) blockers.push(`${context}: text exceeds 5000 characters.`);

  if (type === 'scene') {
    if (positiveInt(row.target_scene_id) === null) {
      blockers.push(`${context}: scene hotspot has no valid target scene.`);
    }
  } else if (row.target_scene_id !== null && row.target_scene_id !== undefined) {
    blockers.push(`${context}: non-scene hotspot carries a target scene.`);
  }

  if (type === 'schedule') {
    if (positiveInt(row.schedule_building_id) === null) {
      blockers.push(`${context}: schedule hotspot has no valid building.`);
    }
    if (!SCHEDULE_LOCATION_TYPES.has(optionalString(row.schedule_location_type))) {
      blockers.push(`${context}: schedule hotspot has an invalid location type.`);
    }
    if (requiredString(row.schedule_location_label, 120) === null) {
      blockers.push(`${context}: schedule hotspot has an invalid location label.`);
    }
    const floor = optionalString(row.schedule_floor_label);
    if (floor !== null && floor.length > 80) {
      blockers.push(`${context}: schedule floor label exceeds 80 characters.`);
    }
  } else if ([row.schedule_building_id, row.schedule_location_type,
    row.schedule_location_label, row.schedule_floor_label]
    .some((value) => value !== null && value !== undefined && value !== '')) {
    blockers.push(`${context}: non-schedule hotspot carries schedule metadata.`);
  }

  return displayOrder === null || sourceSceneKey === null
    ? null
    : hotspotSlot(sourceSceneKey, displayOrder);
}

async function readMysql() {
  try {
    const results = await Promise.all([
      db.query(
        'SELECT id, scene_key, title, description, image_url, cloudinary_public_id, ' +
        'node_id, building_id, initial_yaw, initial_pitch, display_order ' +
        'FROM vr_scenes ORDER BY id ASC'
      ),
      db.query(
        'SELECT id, scene_id, target_scene_id, hotspot_type, label, `text` AS text, ' +
        'schedule_building_id, schedule_location_type, schedule_location_label, ' +
        'schedule_floor_label, yaw, pitch, display_order ' +
        'FROM vr_hotspots ORDER BY id ASC'
      ),
      db.query('SELECT id, name FROM buildings ORDER BY id ASC'),
      db.query('SELECT id, node_key FROM route_nodes ORDER BY id ASC')
    ]);
    return {
      scenes: results[0][0],
      hotspots: results[1][0],
      buildings: results[2][0],
      nodes: results[3][0]
    };
  } catch (_) {
    throw new SafeSyncError('Unable to read MySQL VR metadata.');
  }
}

async function readAllSupabase(sb, table, columns) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await sb
      .from(table)
      .select(columns)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new SafeSyncError(`Unable to read Supabase ${table}.`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function readSupabase(client = null) {
  if (!hasSupabaseConfig()) {
    throw new SafeSyncError('Supabase server credentials are not configured.');
  }
  const sb = client || getSupabaseClient();
  const [scenes, hotspots, buildings, nodes] = await Promise.all([
    readAllSupabase(sb, 'vr_scenes',
      'id,scene_key,title,description,image_url,cloudinary_public_id,node_id,building_id,initial_yaw,initial_pitch,display_order,created_at,updated_at'),
    readAllSupabase(sb, 'vr_hotspots',
      'id,scene_id,target_scene_id,hotspot_type,label,text,schedule_building_id,schedule_location_type,schedule_location_label,schedule_floor_label,yaw,pitch,display_order,created_at,updated_at'),
    readAllSupabase(sb, 'buildings', 'id,name'),
    readAllSupabase(sb, 'route_nodes', 'id,node_key')
  ]);
  return { scenes, hotspots, buildings, nodes };
}

function buildPlan(source, target) {
  const blockers = [];
  const warnings = [];
  const media = { cloudinary: 0, local: 0, missing: 0 };

  const sourceSceneById = uniqueById(source.scenes, 'MySQL scenes', blockers);
  const sourceBuildingById = uniqueById(source.buildings, 'MySQL buildings', blockers);
  const sourceNodeById = uniqueById(source.nodes, 'MySQL route nodes', blockers);

  const sourceSceneGroups = groupBy(source.scenes, (row) => sceneKey(row.scene_key));
  const targetSceneGroups = groupBy(target.scenes, (row) => sceneKey(row.scene_key));
  const targetBuildingGroups = groupBy(target.buildings, (row) => canonicalKey(row.name));
  const targetNodeGroups = groupBy(target.nodes, (row) => optionalString(row.node_key));
  const targetScenesByPublicId = groupBy(
    target.scenes.filter((row) => optionalString(row.cloudinary_public_id) !== null),
    (row) => optionalString(row.cloudinary_public_id)
  );

  for (const [key, rows] of sourceSceneGroups) {
    if (key === null || rows.length !== 1) blockers.push('MySQL scenes: invalid or duplicate scene_key.');
  }
  for (const [key, rows] of targetSceneGroups) {
    if (key === null || rows.length !== 1) blockers.push('Supabase scenes: invalid or duplicate scene_key.');
  }

  const targetSceneByKey = new Map();
  for (const [key, rows] of targetSceneGroups) {
    if (key !== null && rows.length === 1) targetSceneByKey.set(key, rows[0]);
  }

  const validSourceSceneKeys = new Set(
    [...sourceSceneGroups.entries()]
      .filter(([key, rows]) => key !== null && rows.length === 1)
      .map(([key]) => key)
  );
  const claimedTargetSceneIds = new Set();
  const plannedTargetSceneBySourceKey = new Map();

  const scenePlan = [];
  for (const row of source.scenes) {
    const context = `scene ${row.scene_key || '<invalid>'}`;
    const key = validateSceneRow(row, context, blockers, media);
    if (key === null) {
      scenePlan.push({ scene_key: '<invalid>', action: 'blocked', changed_fields: [] });
      continue;
    }

    let mappedNodeId = null;
    if (row.node_id !== null && row.node_id !== undefined) {
      const sourceNode = sourceNodeById.get(positiveInt(row.node_id));
      if (!sourceNode) {
        blockers.push(`${context}: orphaned MySQL route node reference.`);
      } else {
        const targetNode = oneNaturalMatch(
          targetNodeGroups,
          optionalString(sourceNode.node_key),
          `${context} route node`,
          blockers
        );
        mappedNodeId = targetNode ? positiveInt(targetNode.id) : null;
      }
    }

    let mappedBuildingId = null;
    if (row.building_id !== null && row.building_id !== undefined) {
      const sourceBuilding = sourceBuildingById.get(positiveInt(row.building_id));
      if (!sourceBuilding) {
        blockers.push(`${context}: orphaned MySQL building reference.`);
      } else {
        const targetBuilding = oneNaturalMatch(
          targetBuildingGroups,
          canonicalKey(sourceBuilding.name),
          `${context} building`,
          blockers
        );
        mappedBuildingId = targetBuilding ? positiveInt(targetBuilding.id) : null;
      }
    }

    const expected = {
      title: requiredString(row.title, 150),
      description: optionalString(row.description),
      image_url: optionalString(row.image_url),
      cloudinary_public_id: optionalString(row.cloudinary_public_id),
      node_id: mappedNodeId,
      building_id: mappedBuildingId,
      initial_yaw: angle(row.initial_yaw, -180, 180),
      initial_pitch: angle(row.initial_pitch, -90, 90),
      display_order: orderInt(row.display_order)
    };

    let existing = targetSceneByKey.get(key) || null;
    let renamedFrom = null;
    if (!existing) {
      const publicId = optionalString(row.cloudinary_public_id);
      const mediaMatches = publicId === null ? [] : (targetScenesByPublicId.get(publicId) || []);
      if (mediaMatches.length > 1) {
        blockers.push(`${context}: ambiguous Supabase Cloudinary media match.`);
      } else if (mediaMatches.length === 1) {
        const candidate = mediaMatches[0];
        const candidateId = positiveInt(candidate.id);
        const candidateKey = sceneKey(candidate.scene_key);
        if (candidateId === null || candidateKey === null) {
          blockers.push(`${context}: invalid Supabase Cloudinary media match.`);
        } else if (validSourceSceneKeys.has(candidateKey)) {
          blockers.push(`${context}: Cloudinary media is already owned by another source scene key.`);
        } else if (claimedTargetSceneIds.has(candidateId)) {
          blockers.push(`${context}: Supabase Cloudinary media match is already claimed.`);
        } else {
          existing = candidate;
          renamedFrom = candidateKey;
        }
      }
    }

    const changes = existing ? changedFields(expected, existing, SCENE_FIELDS) : [];
    const action = existing
      ? (renamedFrom !== null ? 'rename' : (changes.length ? 'update' : 'unchanged'))
      : 'insert';
    if (existing) {
      const existingId = positiveInt(existing.id);
      if (existingId === null) blockers.push(`${context}: invalid Supabase scene id.`);
      else {
        claimedTargetSceneIds.add(existingId);
        plannedTargetSceneBySourceKey.set(key, existing);
      }
    }
    scenePlan.push({
      scene_key: key,
      action,
      changed_fields: renamedFrom !== null ? ['scene_key', ...changes] : changes,
      expected,
      existing_id: existing ? positiveInt(existing.id) : null,
      renamed_from: renamedFrom
    });
  }

  const sourceKeys = new Set(scenePlan.filter((row) => row.scene_key !== '<invalid>').map((row) => row.scene_key));
  const targetOnlyScenes = target.scenes
    .filter((row) => !claimedTargetSceneIds.has(positiveInt(row.id)))
    .map((row) => sceneKey(row.scene_key))
    .filter((key) => key !== null)
    .sort();
  if (targetOnlyScenes.length) {
    warnings.push(`${targetOnlyScenes.length} Supabase-only scene(s) will be preserved.`);
  }

  const sourceHotspotSlots = new Map();
  const targetSceneById = uniqueById(target.scenes, 'Supabase scenes', blockers);
  const targetHotspotSlotGroups = new Map();
  const plannedSourceKeyByTargetId = new Map();
  for (const row of scenePlan) {
    if (row.existing_id !== null && row.scene_key !== '<invalid>') {
      plannedSourceKeyByTargetId.set(row.existing_id, row.scene_key);
    }
  }

  for (const row of target.hotspots) {
    const targetSourceScene = targetSceneById.get(positiveInt(row.scene_id));
    if (!targetSourceScene) {
      blockers.push('Supabase hotspot: orphaned source scene reference.');
      continue;
    }
    const order = orderInt(row.display_order);
    if (order === null) {
      blockers.push(`Supabase hotspot in ${targetSourceScene.scene_key}: invalid display_order.`);
      continue;
    }
    const plannedSceneKey = plannedSourceKeyByTargetId.get(positiveInt(targetSourceScene.id))
      || targetSourceScene.scene_key;
    const slot = hotspotSlot(plannedSceneKey, order);
    if (!targetHotspotSlotGroups.has(slot)) targetHotspotSlotGroups.set(slot, []);
    targetHotspotSlotGroups.get(slot).push(row);
  }
  for (const [slot, rows] of targetHotspotSlotGroups) {
    if (rows.length > 1) blockers.push(`${slot}: ambiguous Supabase hotspot slot.`);
  }

  const hotspotPlan = [];
  for (const row of source.hotspots) {
    const sourceScene = sourceSceneById.get(positiveInt(row.scene_id));
    const sourceSceneKey = sourceScene ? sceneKey(sourceScene.scene_key) : null;
    const context = `hotspot ${sourceSceneKey || '<orphan>'}/${row.display_order}`;
    if (!sourceScene) blockers.push(`${context}: orphaned MySQL source scene reference.`);

    const slot = validateHotspotRow(row, sourceSceneKey, context, blockers);
    if (slot !== null) {
      if (sourceHotspotSlots.has(slot)) blockers.push(`${slot}: ambiguous MySQL hotspot slot.`);
      sourceHotspotSlots.set(slot, row);
    }

    let targetSceneKey = null;
    if (row.target_scene_id !== null && row.target_scene_id !== undefined) {
      const sourceTarget = sourceSceneById.get(positiveInt(row.target_scene_id));
      if (!sourceTarget) {
        blockers.push(`${context}: orphaned MySQL target scene reference.`);
      } else {
        targetSceneKey = sceneKey(sourceTarget.scene_key);
        if (targetSceneKey === null || !sourceKeys.has(targetSceneKey)) {
          blockers.push(`${context}: target scene has no planned natural identity.`);
        }
        if (sourceSceneKey !== null && targetSceneKey === sourceSceneKey) {
          blockers.push(`${context}: scene hotspot targets its own scene.`);
        }
      }
    }

    let scheduleBuildingId = null;
    if (row.schedule_building_id !== null && row.schedule_building_id !== undefined) {
      const sourceBuilding = sourceBuildingById.get(positiveInt(row.schedule_building_id));
      if (!sourceBuilding) {
        blockers.push(`${context}: orphaned MySQL schedule building reference.`);
      } else {
        const targetBuilding = oneNaturalMatch(
          targetBuildingGroups,
          canonicalKey(sourceBuilding.name),
          `${context} schedule building`,
          blockers
        );
        scheduleBuildingId = targetBuilding ? positiveInt(targetBuilding.id) : null;
      }
    }

    if (slot === null || sourceSceneKey === null) {
      hotspotPlan.push({ slot: '<invalid>', action: 'blocked', changed_fields: [] });
      continue;
    }

    const plannedSourceScene = plannedTargetSceneBySourceKey.get(sourceSceneKey) || null;
    const plannedTargetScene = targetSceneKey
      ? (plannedTargetSceneBySourceKey.get(targetSceneKey) || null)
      : null;
    const expected = {
      scene_id: plannedSourceScene ? positiveInt(plannedSourceScene.id) : `@scene:${sourceSceneKey}`,
      target_scene_id: targetSceneKey
        ? (plannedTargetScene ? positiveInt(plannedTargetScene.id) : `@scene:${targetSceneKey}`)
        : null,
      hotspot_type: optionalString(row.hotspot_type),
      label: requiredString(row.label, 150),
      text: optionalString(row.text),
      schedule_building_id: scheduleBuildingId,
      schedule_location_type: optionalString(row.schedule_location_type),
      schedule_location_label: optionalString(row.schedule_location_label),
      schedule_floor_label: optionalString(row.schedule_floor_label),
      yaw: angle(row.yaw, -180, 180),
      pitch: angle(row.pitch, -90, 90),
      display_order: orderInt(row.display_order)
    };
    const matches = targetHotspotSlotGroups.get(slot) || [];
    const existing = matches.length === 1 ? matches[0] : null;
    const changes = existing ? changedFields(expected, existing, HOTSPOT_FIELDS) : [];
    hotspotPlan.push({
      slot,
      action: existing ? (changes.length ? 'update' : 'unchanged') : 'insert',
      changed_fields: changes,
      source_scene_key: sourceSceneKey,
      target_scene_key: targetSceneKey,
      expected,
      existing_id: existing ? positiveInt(existing.id) : null
    });
  }

  const targetOnlyHotspots = [...targetHotspotSlotGroups.keys()]
    .filter((slot) => !sourceHotspotSlots.has(slot))
    .sort();
  if (targetOnlyHotspots.length) {
    warnings.push(`${targetOnlyHotspots.length} Supabase-only hotspot(s) will be preserved.`);
  }

  return {
    blockers: [...new Set(blockers)],
    warnings,
    media,
    source: { scenes: source.scenes.length, hotspots: source.hotspots.length },
    target: { scenes: target.scenes.length, hotspots: target.hotspots.length },
    scenes: scenePlan,
    hotspots: hotspotPlan,
    target_only_scenes: targetOnlyScenes,
    target_only_hotspots: targetOnlyHotspots,
    scene_renames: scenePlan
      .filter((row) => row.action === 'rename')
      .map((row) => `${row.renamed_from} -> ${row.scene_key}`),
    projected: {
      scenes: target.scenes.length + scenePlan.filter((row) => row.action === 'insert').length,
      hotspots: target.hotspots.length + hotspotPlan.filter((row) => row.action === 'insert').length
    }
  };
}

function printList(label, values, limit = 20) {
  if (!values.length) return;
  console.log(`${label} (${values.length}):`);
  for (const value of values.slice(0, limit)) console.log(`  - ${value}`);
  if (values.length > limit) console.log(`  - ... ${values.length - limit} more`);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = stableValue(value[key]);
      return out;
    }, {});
  }
  return value;
}

function datasetFingerprint(dataset) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(stableValue(dataset)))
    .digest('hex');
}

function vrFingerprint(target) {
  return datasetFingerprint({ scenes: target.scenes, hotspots: target.hotspots });
}

function sceneMutationPayload(row, updatedAt) {
  const payload = { scene_key: row.scene_key };
  for (const field of SCENE_FIELDS) payload[field] = row.expected[field];
  payload.updated_at = updatedAt;
  return payload;
}

function materializeHotspotPlans(hotspotPlans, targetScenes, updatedAt) {
  const sceneGroups = groupBy(targetScenes, (row) => sceneKey(row.scene_key));
  const sceneIds = new Map();
  for (const [key, rows] of sceneGroups) {
    if (key === null || rows.length !== 1 || positiveInt(rows[0].id) === null) {
      throw new SafeSyncError('Unable to materialize unique Supabase scene identities.');
    }
    sceneIds.set(key, positiveInt(rows[0].id));
  }

  return hotspotPlans.map((row) => {
    if (!row.expected || !row.source_scene_key) {
      throw new SafeSyncError('Unable to materialize a blocked hotspot plan.');
    }
    const sourceSceneId = sceneIds.get(row.source_scene_key) || null;
    const targetSceneId = row.target_scene_key
      ? (sceneIds.get(row.target_scene_key) || null)
      : null;
    if (sourceSceneId === null || (row.target_scene_key && targetSceneId === null)) {
      throw new SafeSyncError('Unable to resolve a planned hotspot scene identity.');
    }

    const payload = {};
    for (const field of HOTSPOT_FIELDS) payload[field] = row.expected[field];
    payload.scene_id = sourceSceneId;
    payload.target_scene_id = targetSceneId;
    payload.updated_at = updatedAt;
    return { ...row, payload };
  });
}

async function mutationRows(query, label) {
  let result;
  try {
    result = await query;
  } catch (_) {
    throw new SafeSyncError(`${label} request failed.`);
  }
  if (result.error) throw new SafeSyncError(`${label} was rejected.`);
  return result.data || [];
}

function requireMutationCount(rows, expected, label) {
  if (rows.length !== expected) {
    throw new SafeSyncError(`${label} affected an unexpected number of rows.`);
  }
}

async function writeBackup(target, sourceFingerprint, targetFingerprint) {
  const backupDirectory = path.join(os.tmpdir(), 'campusphere-vr-sync');
  const backupPath = path.join(
    backupDirectory,
    `supabase-vr-before-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID()}.json`
  );
  const backup = {
    schema_version: 1,
    created_at: new Date().toISOString(),
    source_fingerprint: sourceFingerprint,
    target_fingerprint: targetFingerprint,
    target: { scenes: target.scenes, hotspots: target.hotspots }
  };

  try {
    await fs.promises.mkdir(backupDirectory, { recursive: true });
    await fs.promises.writeFile(
      backupPath,
      `${JSON.stringify(backup, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx', mode: 0o600 }
    );
  } catch (_) {
    throw new SafeSyncError('Unable to create the pre-write VR metadata backup.');
  }
  return { backup, backupPath };
}

function findBackupRows(targetRows, planRows, actionSet, label) {
  const rowsById = groupBy(targetRows, (row) => positiveInt(row.id));
  return planRows
    .filter((row) => actionSet.has(row.action))
    .map((row) => {
      const matches = rowsById.get(row.existing_id) || [];
      if (matches.length !== 1) {
        throw new SafeSyncError(`Unable to prepare the ${label} rollback set.`);
      }
      return matches[0];
    });
}

async function applySceneMutations(sb, scenePlans, updatedAt, rollback) {
  const changed = scenePlans.filter((row) => row.action === 'rename' || row.action === 'update');
  for (const row of changed) {
    const expectedCurrentKey = row.action === 'rename' ? row.renamed_from : row.scene_key;
    const rows = await mutationRows(
      sb.from('vr_scenes')
        .update(sceneMutationPayload(row, updatedAt))
        .eq('id', row.existing_id)
        .eq('scene_key', expectedCurrentKey)
        .select('id,scene_key'),
      'Supabase scene update'
    );
    requireMutationCount(rows, 1, 'Supabase scene update');
  }

  const inserts = scenePlans.filter((row) => row.action === 'insert');
  if (inserts.length) {
    const rows = await mutationRows(
      sb.from('vr_scenes')
        .insert(inserts.map((row) => sceneMutationPayload(row, updatedAt)))
        .select('id,scene_key'),
      'Supabase scene insert'
    );
    rollback.sceneInsertTargets = rows.map((row) => ({
      id: positiveInt(row.id),
      scene_key: sceneKey(row.scene_key)
    }));
    if (rollback.sceneInsertTargets.some((row) => row.id === null || row.scene_key === null)) {
      throw new SafeSyncError('Supabase scene insert returned an invalid identity.');
    }
    requireMutationCount(rows, inserts.length, 'Supabase scene insert');
  }
  return { updated: changed.length, inserted: inserts.length };
}

async function applyHotspotMutations(sb, hotspotPlans, rollback) {
  const changed = hotspotPlans.filter((row) => row.action === 'update');
  for (const row of changed) {
    const rows = await mutationRows(
      sb.from('vr_hotspots')
        .update(row.payload)
        .eq('id', row.existing_id)
        .eq('scene_id', row.payload.scene_id)
        .eq('display_order', row.payload.display_order)
        .select('id'),
      'Supabase hotspot update'
    );
    requireMutationCount(rows, 1, 'Supabase hotspot update');
  }

  const inserts = hotspotPlans.filter((row) => row.action === 'insert');
  if (inserts.length) {
    const rows = await mutationRows(
      sb.from('vr_hotspots')
        .insert(inserts.map((row) => row.payload))
        .select('id,scene_id,display_order'),
      'Supabase hotspot insert'
    );
    rollback.hotspotInsertTargets = rows.map((row) => ({
      id: positiveInt(row.id),
      scene_id: positiveInt(row.scene_id),
      display_order: orderInt(row.display_order)
    }));
    if (rollback.hotspotInsertTargets.some((row) =>
      row.id === null || row.scene_id === null || row.display_order === null)) {
      throw new SafeSyncError('Supabase hotspot insert returned an invalid identity.');
    }
    requireMutationCount(rows, inserts.length, 'Supabase hotspot insert');
  }
  return { updated: changed.length, inserted: inserts.length };
}

async function rollbackApply(sb, rollback, backupFingerprint) {
  const errors = [];
  async function attempt(label, operation) {
    try {
      await operation();
    } catch (_) {
      errors.push(label);
    }
  }

  for (const slot of rollback.hotspotInsertTargets) {
    await attempt('inserted hotspot cleanup', async () => {
      const result = await sb.from('vr_hotspots')
        .delete()
        .eq('id', slot.id)
        .eq('scene_id', slot.scene_id)
        .eq('display_order', slot.display_order);
      if (result.error) throw new Error('rollback rejected');
    });
  }

  if (rollback.hotspotBackups.length) {
    await attempt('hotspot restore', async () => {
      const rows = await mutationRows(
        sb.from('vr_hotspots')
          .upsert(rollback.hotspotBackups, { onConflict: 'id' })
          .select('id'),
        'Supabase hotspot rollback'
      );
      requireMutationCount(rows, rollback.hotspotBackups.length, 'Supabase hotspot rollback');
    });
  }

  for (const scene of rollback.sceneInsertTargets) {
    await attempt('inserted scene cleanup', async () => {
      const result = await sb.from('vr_scenes')
        .delete()
        .eq('id', scene.id)
        .eq('scene_key', scene.scene_key);
      if (result.error) throw new Error('rollback rejected');
    });
  }

  if (rollback.sceneBackups.length) {
    await attempt('scene restore', async () => {
      const rows = await mutationRows(
        sb.from('vr_scenes')
          .upsert(rollback.sceneBackups, { onConflict: 'id' })
          .select('id'),
        'Supabase scene rollback'
      );
      requireMutationCount(rows, rollback.sceneBackups.length, 'Supabase scene rollback');
    });
  }

  await attempt('rollback verification', async () => {
    const restored = await readSupabase(sb);
    if (vrFingerprint(restored) !== backupFingerprint) {
      throw new Error('rollback fingerprint mismatch');
    }
  });
  return { ok: errors.length === 0, errors };
}

function verifyAppliedPlan(source, target, expectedCounts) {
  const verified = buildPlan(source, target);
  const incompleteScenes = verified.scenes.filter((row) => row.action !== 'unchanged');
  const incompleteHotspots = verified.hotspots.filter((row) => row.action !== 'unchanged');
  if (verified.blockers.length || incompleteScenes.length || incompleteHotspots.length) {
    throw new SafeSyncError('Post-apply natural-identity parity verification failed.');
  }
  if (target.scenes.length !== expectedCounts.scenes ||
      target.hotspots.length !== expectedCounts.hotspots) {
    throw new SafeSyncError('Post-apply row-count verification failed.');
  }
  return verified;
}

async function applyPlan(sb, initialSource, initialTarget, initialPlan) {
  const initialSourceFingerprint = datasetFingerprint(initialSource);
  const initialTargetFingerprint = datasetFingerprint(initialTarget);
  const [source, target] = await Promise.all([readMysql(), readSupabase(sb)]);
  if (datasetFingerprint(source) !== initialSourceFingerprint ||
      datasetFingerprint(target) !== initialTargetFingerprint) {
    throw new SafeSyncError('Source or target drifted after preflight; no data was written.');
  }

  const plan = buildPlan(source, target);
  if (plan.blockers.length ||
      datasetFingerprint(plan) !== datasetFingerprint(initialPlan)) {
    throw new SafeSyncError('The approved plan changed after preflight; no data was written.');
  }

  const { backup, backupPath } = await writeBackup(
    target,
    initialSourceFingerprint,
    vrFingerprint(target)
  );
  const rollback = {
    sceneInsertTargets: [],
    sceneBackups: findBackupRows(
      target.scenes,
      plan.scenes,
      new Set(['rename', 'update']),
      'scene'
    ),
    hotspotBackups: findBackupRows(
      target.hotspots,
      plan.hotspots,
      new Set(['update']),
      'hotspot'
    ),
    hotspotInsertTargets: []
  };

  let mutationAttempted = false;
  try {
    const updatedAt = new Date().toISOString();
    mutationAttempted = true;
    const sceneResult = await applySceneMutations(sb, plan.scenes, updatedAt, rollback);
    const targetAfterScenes = await readSupabase(sb);
    const materializedHotspots = materializeHotspotPlans(
      plan.hotspots,
      targetAfterScenes.scenes,
      updatedAt
    );
    const hotspotResult = await applyHotspotMutations(sb, materializedHotspots, rollback);
    const finalTarget = await readSupabase(sb);
    verifyAppliedPlan(source, finalTarget, plan.projected);
    return {
      backupPath,
      scenes: sceneResult,
      hotspots: hotspotResult,
      final: { scenes: finalTarget.scenes.length, hotspots: finalTarget.hotspots.length }
    };
  } catch (_) {
    if (!mutationAttempted) throw new SafeSyncError('Apply failed before any mutation was attempted.');
    const rolledBack = await rollbackApply(sb, rollback, backup.target_fingerprint);
    if (!rolledBack.ok) {
      throw new SafeSyncError(
        `Apply failed and automatic rollback could not be verified; restore from ${backupPath}.`
      );
    }
    throw new SafeSyncError(`Apply failed; the original target was restored and verified. Backup: ${backupPath}`);
  }
}

function printPlan(plan, mode = 'dry-run') {
  const dryRun = mode === 'dry-run';
  console.log(`=== CampuSphere VR metadata sync: ${dryRun ? 'DRY RUN' : 'CONFIRMED APPLY PREFLIGHT'} ===`);
  console.log(dryRun
    ? 'READ ONLY: this invocation cannot issue MySQL or Supabase mutations.'
    : 'WRITE MODE: the exact apply confirmation token was accepted.');
  console.log('');
  console.log(`MySQL source:      ${plan.source.scenes} scenes, ${plan.source.hotspots} hotspots`);
  console.log(`Supabase target:   ${plan.target.scenes} scenes, ${plan.target.hotspots} hotspots`);
  console.log(`Scene plan:        ${JSON.stringify(countBy(plan.scenes, 'action'))}`);
  console.log(`Hotspot plan:      ${JSON.stringify(countBy(plan.hotspots, 'action'))}`);
  console.log(`Projected target:  ${plan.projected.scenes} scenes, ${plan.projected.hotspots} hotspots`);
  console.log(`Media inventory:   ${plan.media.cloudinary} Cloudinary, ${plan.media.local} local, ${plan.media.missing} missing`);
  console.log('');

  printList('Supabase-only scenes preserved for owner review', plan.target_only_scenes);
  printList('Supabase-only hotspot slots preserved for owner review', plan.target_only_hotspots);
  printList('Exact Cloudinary-media scene renames proposed', plan.scene_renames);
  printList('Warnings', plan.warnings);
  printList('BLOCKERS', plan.blockers, 50);
  console.log('');

  if (plan.blockers.length) {
    console.log(`SYNC BLOCKED: ${plan.blockers.length} fail-closed issue(s) must be resolved before any apply.`);
  } else {
    console.log(`${dryRun ? 'DRY RUN' : 'PREFLIGHT'} OK: all source references resolve by natural identity.`);
    if (dryRun) console.log('No data was written. Apply mode is available only with its exact confirmation token.');
  }
}

function parseArgs(argv) {
  const raw = argv.slice(2);
  const flags = new Set(raw.filter((arg) => !arg.startsWith('--confirm=')));
  const confirmations = raw
    .filter((arg) => arg.startsWith('--confirm='))
    .map((arg) => arg.slice('--confirm='.length));
  const allowed = new Set(['--dry-run', '--apply', '--help']);
  for (const flag of flags) {
    if (!allowed.has(flag)) {
      throw new SafeSyncError('Unknown argument. Use --dry-run, --apply, or --help.');
    }
  }
  if (confirmations.length > 1) {
    throw new SafeSyncError('Apply confirmation must be provided exactly once.');
  }
  if (flags.has('--help')) {
    if (raw.length !== 1) throw new SafeSyncError('--help cannot be combined with other arguments.');
    return { help: true, mode: 'dry-run' };
  }
  if (flags.has('--apply')) {
    if (flags.has('--dry-run')) {
      throw new SafeSyncError('--apply cannot be combined with --dry-run.');
    }
    if (confirmations[0] !== APPLY_CONFIRMATION) {
      throw new SafeSyncError('Apply requires the exact confirmation token; no data was written.');
    }
    return { help: false, mode: 'apply' };
  }
  if (confirmations.length) {
    throw new SafeSyncError('--confirm is valid only with --apply.');
  }
  return { help: false, mode: 'dry-run' };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log('Usage: node scripts/syncVrMysqlToSupabase.js --dry-run');
    console.log(`Apply: node scripts/syncVrMysqlToSupabase.js --apply --confirm=${APPLY_CONFIRMATION}`);
    console.log('Dry-run is the default. Apply writes only after its exact confirmation token.');
    return;
  }

  if (!hasSupabaseConfig()) {
    throw new SafeSyncError('Supabase server credentials are not configured.');
  }
  const sb = getSupabaseClient();
  const [source, target] = await Promise.all([readMysql(), readSupabase(sb)]);
  const plan = buildPlan(source, target);
  printPlan(plan, args.mode);
  if (plan.blockers.length) {
    process.exitCode = 2;
    return;
  }
  if (args.mode === 'dry-run') return;

  const result = await applyPlan(sb, source, target, plan);
  console.log('');
  console.log('APPLY OK: Supabase VR metadata matches the approved MySQL source plan.');
  console.log(`Scenes: ${result.final.scenes}; hotspots: ${result.final.hotspots}.`);
  console.log(`Pre-write backup: ${result.backupPath}`);
}

if (require.main === module) {
  main()
    .catch((error) => {
      const message = error instanceof SafeSyncError
        ? error.message
        : 'Unexpected VR metadata sync failure.';
      console.error(`VR metadata sync failed: ${message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      try { await db.end(); } catch (_) { /* no-op */ }
    });
}

module.exports = {
  APPLY_CONFIRMATION,
  buildPlan,
  canonicalKey,
  datasetFingerprint,
  hotspotSlot,
  materializeHotspotPlans,
  parseArgs
};
