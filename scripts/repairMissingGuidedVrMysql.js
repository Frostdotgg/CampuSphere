'use strict';

/*
 * Fill only the owner-approved missing Guided-VR records in local MySQL.
 * Supabase is a read-only source. The route definitions are never written.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  VEHICLE_GUIDED_VR_ROUTES,
  VEHICLE_EXIT_GUIDED_VR_ROUTES,
  WALKING_GUIDED_VR_ROUTES,
} = require('../config/guidedVrRoutes');

const APPLY_CONFIRMATION = 'REPAIR_MISSING_GUIDED_VR_MYSQL_PARITY';
const EXPECTED_DATABASE = 'campusphere_db';
const APPROVED_SCENE_KEYS = Object.freeze([
  'scene-general-road-85',
  'scene-general-road-86',
  'scene-general-road-87',
  'scene-general-road-88',
  'scene-general-road-89',
  'scene-general-road-90',
]);
const APPROVED_MISSING_LINKS = Object.freeze([
  'scene-general-road-38>scene-general-road-85',
  'scene-general-road-85>scene-general-road-94',
  'scene-general-road-91>scene-general-road-90',
  'scene-general-road-90>scene-general-road-89',
  'scene-general-road-89>scene-general-road-88',
  'scene-general-road-88>scene-general-road-87',
  'scene-general-road-87>scene-general-road-86',
  'scene-general-road-86>scene-general-road-85',
  'scene-general-road-85>scene-general-road-38',
  'scene-staff-house-1st-floor-2>scene-general-road-83',
  'scene-general-road-94>scene-general-road-85',
]);

class RepairError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RepairError';
    this.publicMessage = message;
  }
}

function canonicalName(value) {
  return String(value == null ? '' : value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function routePairs() {
  const pairs = new Set();
  const routes = [
    ...VEHICLE_GUIDED_VR_ROUTES,
    ...VEHICLE_EXIT_GUIDED_VR_ROUTES,
    ...WALKING_GUIDED_VR_ROUTES,
  ];
  for (const route of routes) {
    if (!route || !Array.isArray(route.scene_keys)) throw new RepairError('Approved Guided-VR route source is invalid.');
    for (let index = 1; index < route.scene_keys.length; index += 1) {
      pairs.add(`${route.scene_keys[index - 1]}>${route.scene_keys[index]}`);
    }
  }
  for (const route of WALKING_GUIDED_VR_ROUTES) {
    for (let index = 1; index < route.scene_keys.length; index += 1) {
      pairs.add(`${route.scene_keys[index]}>${route.scene_keys[index - 1]}`);
    }
  }
  return [...pairs].sort();
}

function uniqueIndex(rows, keyOf, label) {
  const result = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = keyOf(row);
    if (key == null || key === '') continue;
    if (result.has(key)) throw new RepairError(`Ambiguous ${label} identity in the repair scope.`);
    result.set(key, row);
  }
  return result;
}

function numberOrNull(value) {
  if (value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new RepairError('A Guided-VR source value is not numeric.');
  return number;
}

function boolValue(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(stableJson(value), 'utf8').digest('hex');
}

function sceneSemantic(row, nodeKey, buildingName) {
  return {
    scene_key: String(row.scene_key),
    title: row.title == null ? null : String(row.title),
    description: row.description == null ? null : String(row.description),
    image_url: row.image_url == null ? null : String(row.image_url),
    cloudinary_public_id: row.cloudinary_public_id == null ? null : String(row.cloudinary_public_id),
    node_key: row.node_id == null ? null : nodeKey(row.node_id),
    building_name: row.building_id == null ? null : buildingName(row.building_id),
    initial_yaw: numberOrNull(row.initial_yaw),
    initial_pitch: numberOrNull(row.initial_pitch),
    display_order: numberOrNull(row.display_order),
  };
}

function hotspotSemantic(row, fromKey, toKey) {
  return {
    from_key: fromKey,
    to_key: toKey,
    hotspot_type: String(row.hotspot_type || '').toLowerCase(),
    label: row.label == null ? null : String(row.label),
    text: row.text == null ? null : String(row.text),
    guest_visible: boolValue(row.guest_visible),
    yaw: numberOrNull(row.yaw),
    pitch: numberOrNull(row.pitch),
    display_order: numberOrNull(row.display_order),
  };
}

function buildRepairPlan(source, target) {
  const sourceScenes = uniqueIndex(source.scenes, (row) => row.scene_key, 'Supabase scene');
  const targetScenes = uniqueIndex(target.scenes, (row) => row.scene_key, 'MySQL scene');
  const sourceNodes = uniqueIndex(source.nodes, (row) => Number(row.id), 'Supabase node id');
  const targetNodes = uniqueIndex(target.nodes, (row) => Number(row.id), 'MySQL node id');
  const sourceBuildings = uniqueIndex(source.buildings, (row) => Number(row.id), 'Supabase building id');
  const targetBuildings = uniqueIndex(target.buildings, (row) => Number(row.id), 'MySQL building id');
  const targetNodesByKey = uniqueIndex(target.nodes, (row) => row.node_key, 'MySQL node key');
  const targetBuildingsByName = new Map();
  for (const building of target.buildings || []) {
    const key = canonicalName(building.name);
    if (!key) continue;
    const rows = targetBuildingsByName.get(key) || [];
    rows.push(building);
    targetBuildingsByName.set(key, rows);
  }

  const requiredPairs = routePairs();
  const requiredSceneKeys = new Set(requiredPairs.flatMap((pair) => pair.split('>')));
  for (const sceneKey of requiredSceneKeys) {
    if (!sourceScenes.has(sceneKey)) throw new RepairError(`Supabase is missing an approved route scene: ${sceneKey}.`);
  }

  const missingSceneKeys = [...requiredSceneKeys].filter((key) => !targetScenes.has(key)).sort();
  const approvedSceneKeys = new Set(APPROVED_SCENE_KEYS);
  if (missingSceneKeys.some((key) => !approvedSceneKeys.has(key))) {
    throw new RepairError('MySQL is missing a route scene outside the approved repair scope.');
  }

  const sourceSceneKeyById = uniqueIndex(source.scenes, (row) => Number(row.id), 'Supabase scene id');
  const targetSceneKeyById = uniqueIndex(target.scenes, (row) => Number(row.id), 'MySQL scene id');
  const sourceNodeKeyById = sourceNodes;
  const targetNodeKeyById = targetNodes;
  const sourceBuildingById = sourceBuildings;
  const targetBuildingById = targetBuildings;

  const sourceNodeKey = (id) => {
    const row = sourceNodeKeyById.get(Number(id));
    if (!row || !row.node_key) throw new RepairError('A source scene has an unresolved node reference.');
    return String(row.node_key);
  };
  const targetNodeKey = (id) => {
    const row = targetNodeKeyById.get(Number(id));
    if (!row || !row.node_key) throw new RepairError('A local scene has an unresolved node reference.');
    return String(row.node_key);
  };
  const sourceBuildingName = (id) => {
    const row = sourceBuildingById.get(Number(id));
    if (!row || !row.name) throw new RepairError('A source scene has an unresolved building reference.');
    return String(row.name);
  };
  const targetBuildingName = (id) => {
    const row = targetBuildingById.get(Number(id));
    if (!row || !row.name) throw new RepairError('A local scene has an unresolved building reference.');
    return String(row.name);
  };

  const sceneInserts = [];
  for (const sceneKey of missingSceneKeys) {
    const scene = sourceScenes.get(sceneKey);
    const sourceNode = scene.node_id == null ? null : sourceNodes.get(Number(scene.node_id));
    const sourceBuilding = scene.building_id == null ? null : sourceBuildings.get(Number(scene.building_id));
    if (scene.node_id != null && !sourceNode) throw new RepairError(`Supabase scene ${sceneKey} has an unresolved node reference.`);
    if (scene.building_id != null && !sourceBuilding) throw new RepairError(`Supabase scene ${sceneKey} has an unresolved building reference.`);

    let nodeId = null;
    if (sourceNode) {
      const targetNode = targetNodesByKey.get(sourceNode.node_key);
      if (!targetNode) throw new RepairError(`MySQL is missing the referenced node for ${sceneKey}.`);
      nodeId = Number(targetNode.id);
    }

    let buildingId = null;
    if (sourceBuilding) {
      const matches = targetBuildingsByName.get(canonicalName(sourceBuilding.name)) || [];
      if (matches.length !== 1) throw new RepairError(`MySQL has no unique matching building for ${sceneKey}.`);
      buildingId = Number(matches[0].id);
    }
    sceneInserts.push({
      scene_key: scene.scene_key,
      title: scene.title,
      description: scene.description,
      image_url: scene.image_url,
      cloudinary_public_id: scene.cloudinary_public_id,
      node_id: nodeId,
      building_id: buildingId,
      initial_yaw: numberOrNull(scene.initial_yaw),
      initial_pitch: numberOrNull(scene.initial_pitch),
      display_order: numberOrNull(scene.display_order),
      fingerprint: fingerprint(sceneSemantic(scene, sourceNodeKey, sourceBuildingName)),
    });
  }

  for (const sceneKey of [...requiredSceneKeys].filter((key) => targetScenes.has(key) && approvedSceneKeys.has(key))) {
    const sourceScene = sourceScenes.get(sceneKey);
    const targetScene = targetScenes.get(sceneKey);
    if (stableJson(sceneSemantic(sourceScene, sourceNodeKey, sourceBuildingName)) !==
        stableJson(sceneSemantic(targetScene, targetNodeKey, targetBuildingName))) {
      throw new RepairError(`The existing MySQL scene conflicts with the approved source: ${sceneKey}.`);
    }
  }

  const sourceHotspotsByPair = new Map();
  const targetHotspotsByPair = new Map();
  const keyForPair = (fromKey, toKey) => `${fromKey}>${toKey}`;
  for (const hotspot of source.hotspots || []) {
    if (String(hotspot.hotspot_type || '').toLowerCase() !== 'scene') continue;
    const from = sourceSceneKeyById.get(Number(hotspot.scene_id))?.scene_key;
    const to = sourceSceneKeyById.get(Number(hotspot.target_scene_id))?.scene_key;
    const pair = keyForPair(from, to);
    if (!requiredPairs.includes(pair)) continue;
    const rows = sourceHotspotsByPair.get(pair) || [];
    rows.push(hotspot);
    sourceHotspotsByPair.set(pair, rows);
  }
  for (const hotspot of target.hotspots || []) {
    if (String(hotspot.hotspot_type || '').toLowerCase() !== 'scene') continue;
    const from = targetSceneKeyById.get(Number(hotspot.scene_id))?.scene_key;
    const to = targetSceneKeyById.get(Number(hotspot.target_scene_id))?.scene_key;
    const pair = keyForPair(from, to);
    if (!requiredPairs.includes(pair)) continue;
    const rows = targetHotspotsByPair.get(pair) || [];
    rows.push(hotspot);
    targetHotspotsByPair.set(pair, rows);
  }

  const approvedLinks = new Set(APPROVED_MISSING_LINKS);
  const hotspotInserts = [];
  const missingLinks = [];
  for (const pair of requiredPairs) {
    const sourceRows = sourceHotspotsByPair.get(pair) || [];
    const targetRows = targetHotspotsByPair.get(pair) || [];
    if (sourceRows.length !== 1) throw new RepairError(`Supabase does not have exactly one approved link for ${pair}.`);
    if (targetRows.length > 1) throw new RepairError(`MySQL has duplicate links for ${pair}.`);
    if (targetRows.length === 1) {
      if (approvedLinks.has(pair)) {
        const [fromKey, toKey] = pair.split('>');
        if (stableJson(hotspotSemantic(sourceRows[0], fromKey, toKey)) !==
            stableJson(hotspotSemantic(targetRows[0], fromKey, toKey))) {
          throw new RepairError(`The existing MySQL link conflicts with the approved source: ${pair}.`);
        }
      }
      continue;
    }
    if (!approvedLinks.has(pair)) throw new RepairError(`MySQL is missing a route link outside the approved repair scope: ${pair}.`);
    const [fromKey, toKey] = pair.split('>');
    const sourceRow = sourceRows[0];
    missingLinks.push(pair);
    hotspotInserts.push({
      from_key: fromKey,
      to_key: toKey,
      label: sourceRow.label,
      text: sourceRow.text,
      guest_visible: boolValue(sourceRow.guest_visible) ? 1 : 0,
      yaw: numberOrNull(sourceRow.yaw),
      pitch: numberOrNull(sourceRow.pitch),
      display_order: numberOrNull(sourceRow.display_order),
      fingerprint: fingerprint(hotspotSemantic(sourceRow, fromKey, toKey)),
    });
  }

  return {
    sceneInserts,
    hotspotInserts,
    missingSceneKeys,
    missingLinks,
    sourceFingerprint: fingerprint({
      scenes: APPROVED_SCENE_KEYS.map((key) => {
        const scene = sourceScenes.get(key);
        if (!scene) throw new RepairError(`Supabase is missing approved scene ${key}.`);
        return sceneSemantic(scene, sourceNodeKey, sourceBuildingName);
      }),
      links: APPROVED_MISSING_LINKS.map((pair) => {
        const row = sourceHotspotsByPair.get(pair)?.[0];
        if (!row) throw new RepairError(`Supabase is missing approved link ${pair}.`);
        return hotspotSemantic(row, ...pair.split('>'));
      }),
    }),
  };
}

function assertLocalMysqlConfiguration(environment) {
  const host = String(environment.DB_HOST || '127.0.0.1').trim().toLowerCase();
  const database = String(environment.DB_NAME || EXPECTED_DATABASE).trim();
  if (!['localhost', '127.0.0.1', '::1', 'mysql'].includes(host) || database !== EXPECTED_DATABASE) {
    throw new RepairError('Repair is restricted to the local campusphere_db MySQL target.');
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) return { help: true, apply: false };
  const apply = args.includes('--apply');
  const confirmation = args.find((argument) => argument.startsWith('--confirm='));
  if (args.some((argument) => !['--apply'].includes(argument) && !argument.startsWith('--confirm='))) {
    throw new RepairError('Unknown repair argument.');
  }
  if (apply && (!confirmation || confirmation.slice('--confirm='.length) !== APPLY_CONFIRMATION)) {
    throw new RepairError(`Apply requires --confirm=${APPLY_CONFIRMATION}.`);
  }
  if (!apply && confirmation) throw new RepairError('The confirmation token requires --apply.');
  return { help: false, apply };
}

async function inTransaction(connection, operation) {
  await connection.beginTransaction();
  try {
    const result = await operation();
    try {
      await connection.commit();
    } catch (_) {
      const error = new RepairError('MySQL commit outcome is uncertain; inspect the local database before retrying the repair.');
      error.repairOutcomeUnknown = true;
      throw error;
    }
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_) {
      const rollbackError = new RepairError('MySQL rollback could not be confirmed; stop and inspect the local database before continuing.');
      rollbackError.repairOutcomeUnknown = true;
      throw rollbackError;
    }
    throw error;
  }
}

async function readSupabase(sb) {
  async function readAll(table, columns) {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const result = await sb.from(table).select(columns).order('id').range(offset, offset + 499);
      if (result.error) throw new RepairError('Supabase read failed; no MySQL rows were changed.');
      rows.push(...(result.data || []));
      if ((result.data || []).length < 500) return rows;
    }
  }
  const [scenes, nodes, buildings, hotspots] = await Promise.all([
    readAll('vr_scenes', 'id,scene_key,title,description,image_url,cloudinary_public_id,node_id,building_id,initial_yaw,initial_pitch,display_order'),
    readAll('route_nodes', 'id,node_key'),
    readAll('buildings', 'id,name'),
    readAll('vr_hotspots', 'id,scene_id,target_scene_id,hotspot_type,label,text,guest_visible,yaw,pitch,display_order'),
  ]);
  return { scenes, nodes, buildings, hotspots };
}

async function readMysql(connection) {
  const [[scenes], [nodes], [buildings], [hotspots]] = await Promise.all([
    connection.query('SELECT id,scene_key,title,description,image_url,cloudinary_public_id,node_id,building_id,initial_yaw,initial_pitch,display_order FROM vr_scenes'),
    connection.query('SELECT id,node_key FROM route_nodes'),
    connection.query('SELECT id,name FROM buildings'),
    connection.query("SELECT id,scene_id,target_scene_id,hotspot_type,label,`text` AS text,guest_visible,yaw,pitch,display_order FROM vr_hotspots WHERE hotspot_type = ?", ['scene']),
  ]);
  return { scenes, nodes, buildings, hotspots };
}

function createJournal(plan) {
  const filename = `campusphere-guided-vr-mysql-repair-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.json`;
  return {
    path: path.join(os.tmpdir(), filename),
    data: {
      format_version: 1,
      created_at: new Date().toISOString(),
      status: 'prepared',
      source_sha256: plan.sourceFingerprint,
      requested_scene_keys: plan.sceneInserts.map((row) => row.scene_key),
      requested_links: plan.hotspotInserts.map((row) => `${row.from_key}>${row.to_key}`),
      inserted_scenes: [],
      inserted_links: [],
    },
  };
}

async function writeJournal(journal) {
  await fs.promises.writeFile(journal.path, `${JSON.stringify(journal.data, null, 2)}\n`, {
    encoding: 'utf8',
    flag: journal.data.status === 'prepared' ? 'wx' : 'w',
    mode: 0o600,
  });
}

function usage() {
  console.log('Preview: node scripts/repairMissingGuidedVrMysql.js');
  console.log(`Apply:   node scripts/repairMissingGuidedVrMysql.js --apply --confirm=${APPLY_CONFIRMATION}`);
}

async function main() {
  process.env.DOTENV_CONFIG_QUIET = 'true';
  require('dotenv').config({ quiet: true });
  const args = parseArgs(process.argv);
  if (args.help) return usage();
  assertLocalMysqlConfiguration(process.env);
  const db = require('../config/db');
  const { getSupabaseClient, hasSupabaseConfig } = require('../config/supabase');
  if (!hasSupabaseConfig()) throw new RepairError('Supabase read-only source is unavailable; no MySQL rows were changed.');
  const connection = await db.getConnection();
  let journal = null;
  try {
    const [identityRows] = await connection.query('SELECT DATABASE() AS database_name, @@port AS port');
    const identity = identityRows && identityRows[0];
    if (!identity || identity.database_name !== EXPECTED_DATABASE || Number(identity.port) !== 3306) {
      throw new RepairError('Connected MySQL identity is outside the approved local test target.');
    }
    const source = await readSupabase(getSupabaseClient());
    const target = await readMysql(connection);
    const plan = buildRepairPlan(source, target);
    console.log(args.apply ? 'APPLY PREFLIGHT: local MySQL target confirmed.' : 'READ ONLY: preview only; neither database was changed.');
    console.log(`Approved missing scenes: ${plan.sceneInserts.length}; approved missing links: ${plan.hotspotInserts.length}.`);
    if (plan.sceneInserts.length) console.log(`Scenes: ${plan.sceneInserts.map((row) => row.scene_key).join(', ')}.`);
    if (plan.hotspotInserts.length) console.log(`Links: ${plan.missingLinks.join(', ')}.`);
    if (!plan.sceneInserts.length && !plan.hotspotInserts.length) {
      console.log('The approved Guided-VR records already match; no repair is needed.');
      return;
    }
    if (!args.apply) {
      console.log('Preview complete. Add the exact confirmation flag to apply these inserts.');
      return;
    }

    journal = createJournal(plan);
    await writeJournal(journal);
    const insertedScenes = [];
    const insertedLinks = [];
    await inTransaction(connection, async () => {
      const freshTarget = await readMysql(connection);
      const freshPlan = buildRepairPlan(source, freshTarget);
      if (freshPlan.sourceFingerprint !== plan.sourceFingerprint ||
          stableJson(freshPlan.missingSceneKeys) !== stableJson(plan.missingSceneKeys) ||
          stableJson(freshPlan.missingLinks) !== stableJson(plan.missingLinks)) {
        throw new RepairError('MySQL changed after preflight; transaction rolled back.');
      }
      for (const scene of plan.sceneInserts) {
        const [result] = await connection.execute(
          'INSERT INTO vr_scenes (scene_key,title,description,image_url,cloudinary_public_id,node_id,building_id,initial_yaw,initial_pitch,display_order) VALUES (?,?,?,?,?,?,?,?,?,?)',
          [scene.scene_key,scene.title,scene.description,scene.image_url,scene.cloudinary_public_id,scene.node_id,scene.building_id,scene.initial_yaw,scene.initial_pitch,scene.display_order]);
        insertedScenes.push({ scene_key: scene.scene_key, id: Number(result.insertId), sha256: scene.fingerprint });
      }
      const postSceneRows = await readMysql(connection);
      const sceneIdByKey = uniqueIndex(postSceneRows.scenes, (row) => row.scene_key, 'MySQL scene key');
      for (const link of plan.hotspotInserts) {
        const from = sceneIdByKey.get(link.from_key);
        const to = sceneIdByKey.get(link.to_key);
        if (!from || !to) throw new RepairError('A repaired link endpoint could not be resolved; transaction rolled back.');
        const [result] = await connection.execute(
          'INSERT INTO vr_hotspots (scene_id,target_scene_id,hotspot_type,label,`text`,guest_visible,yaw,pitch,display_order) VALUES (?,?,?,?,?,?,?,?,?)',
          [Number(from.id),Number(to.id),'scene',link.label,link.text,link.guest_visible,link.yaw,link.pitch,link.display_order]);
        insertedLinks.push({ from_key: link.from_key, to_key: link.to_key, id: Number(result.insertId), sha256: link.fingerprint });
      }
      const verificationSource = await readSupabase(getSupabaseClient());
      const verificationTarget = await readMysql(connection);
      const verified = buildRepairPlan(verificationSource, verificationTarget);
      if (verified.sceneInserts.length || verified.hotspotInserts.length ||
          verified.sourceFingerprint !== plan.sourceFingerprint) {
        throw new RepairError('Post-insert verification failed; transaction rolled back.');
      }
      journal.data = {
        ...journal.data,
        status: 'commit-ready',
        inserted_scenes: insertedScenes,
        inserted_links: insertedLinks,
      };
      await writeJournal(journal);
    });
    journal.data.status = 'committed';
    try {
      await writeJournal(journal);
    } catch (_) {
      throw new RepairError(`Repair committed and verified, but its recovery journal needs attention at ${journal.path}.`);
    }
    console.log(`REPAIR OK: inserted ${insertedScenes.length} scene(s) and ${insertedLinks.length} link(s).`);
    console.log(`Recovery journal: ${journal.path}`);
  } catch (error) {
    if (journal && journal.data.status !== 'committed') {
      journal.data.status = error && error.repairOutcomeUnknown
        ? 'outcome-unknown'
        : 'rolled-back-or-not-applied';
      try { await writeJournal(journal); } catch (_) { /* retain the original safe failure */ }
    }
    if (error instanceof RepairError) throw error;
    throw new RepairError('Guided-VR MySQL repair failed safely; inspect the local test database before continuing.');
  } finally {
    connection.release();
    await db.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    const message = error instanceof RepairError ? error.publicMessage : 'Guided-VR MySQL repair failed safely.';
    console.error(`REPAIR FAILED: ${message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  APPLY_CONFIRMATION,
  APPROVED_SCENE_KEYS,
  APPROVED_MISSING_LINKS,
  assertLocalMysqlConfiguration,
  buildRepairPlan,
  inTransaction,
  parseArgs,
  routePairs,
};
