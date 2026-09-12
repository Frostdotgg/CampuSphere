'use strict';

/*
 * Reconcile only MySQL scene-link duplicates that block a configured Guided-VR
 * transition. Supabase is read-only authority for the expected natural-key
 * link; no Supabase row is changed. A target row is removable only when the
 * same directed pair has exactly one source-authorized link and the extra
 * MySQL row's natural identity is absent from that source pair.
 */

process.env.DOTENV_CONFIG_QUIET = 'true';
require('dotenv').config({ quiet: true });

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('../config/db');
const { getSupabaseClient, hasSupabaseConfig } = require('../config/supabase');
const { GUIDED_VR_ROUTES, WALKING_GUIDED_VR_ROUTES } = require('../config/guidedVrRoutes');

const APPLY_CONFIRMATION = 'REPAIR_MYSQL_GUIDED_VR_DUPLICATE_LINKS';

class RepairError extends Error {
  constructor(internal, publicMessage = null) {
    super(internal);
    this.name = 'RepairError';
    this.publicMessage = publicMessage || internal;
  }
}

function canonicalKey(value) {
  return String(value == null ? '' : value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function safeNumber(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new RepairError(`${label} is invalid.`, 'Guided-VR duplicate repair encountered invalid placement data; no rows were changed.');
  return n;
}

function sceneLinkKey(sourceKey, row, sceneKeyById) {
  const targetKey = sceneKeyById.get(Number(row.target_scene_id));
  if (!sourceKey || !targetKey || String(row.hotspot_type || '').toLowerCase() !== 'scene') return null;
  return `${sourceKey}|scene|${targetKey}|order|${safeNumber(row.display_order, 'display order')}|yaw|${safeNumber(row.yaw, 'yaw')}|pitch|${safeNumber(row.pitch, 'pitch')}`;
}

function routePairs() {
  const pairs = new Map();
  for (const route of [...GUIDED_VR_ROUTES, ...WALKING_GUIDED_VR_ROUTES]) {
    for (let i = 0; i < route.scene_keys.length - 1; i += 1) {
      const from = route.scene_keys[i];
      const to = route.scene_keys[i + 1];
      pairs.set(`${from}>${to}`, { from, to });
      pairs.set(`${to}>${from}`, { from: to, to: from });
    }
  }
  return [...pairs.values()];
}

async function readSupabase(sb) {
  const scenes = [];
  for (let offset = 0; ; offset += 500) {
    const result = await sb.from('vr_scenes').select('id,scene_key').order('id').range(offset, offset + 499);
    if (result.error) throw new RepairError('Supabase scene read failed.', 'Unable to read Supabase Guided-VR authority; no rows were changed.');
    scenes.push(...(result.data || []));
    if ((result.data || []).length < 500) break;
  }
  const hotspots = [];
  for (let offset = 0; ; offset += 500) {
    const result = await sb.from('vr_hotspots').select('id,scene_id,target_scene_id,hotspot_type,label,yaw,pitch,display_order').order('id').range(offset, offset + 499);
    if (result.error) throw new RepairError('Supabase hotspot read failed.', 'Unable to read Supabase Guided-VR authority; no rows were changed.');
    hotspots.push(...(result.data || []));
    if ((result.data || []).length < 500) break;
  }
  return { scenes, hotspots };
}

async function readMysql(conn) {
  const [scenes] = await conn.query('SELECT id, scene_key FROM vr_scenes');
  const [hotspots] = await conn.query('SELECT id, scene_id, target_scene_id, hotspot_type, label, yaw, pitch, display_order FROM vr_hotspots WHERE hotspot_type = ?', ['scene']);
  return { scenes, hotspots };
}

function sourceAllowedPairs(source) {
  const sceneKeyById = new Map(source.scenes.map((row) => [Number(row.id), row.scene_key]));
  const byPair = new Map();
  for (const row of source.hotspots) {
    const from = sceneKeyById.get(Number(row.scene_id));
    const to = sceneKeyById.get(Number(row.target_scene_id));
    if (!from || !to || String(row.hotspot_type).toLowerCase() !== 'scene') continue;
    const pair = `${from}>${to}`;
    const key = sceneLinkKey(from, row, sceneKeyById);
    if (!key) continue;
    const values = byPair.get(pair) || [];
    values.push(key);
    byPair.set(pair, values);
  }
  return { sceneKeyById, byPair };
}

function buildRepairPlan(source, target) {
  const sourcePlan = sourceAllowedPairs(source);
  const targetSceneById = new Map(target.scenes.map((row) => [Number(row.id), row.scene_key]));
  const sourceSceneKeys = new Set(source.scenes.map((row) => row.scene_key));
  const targetByPair = new Map();
  for (const row of target.hotspots) {
    const from = targetSceneById.get(Number(row.scene_id));
    const to = targetSceneById.get(Number(row.target_scene_id));
    if (!from || !to || !sourceSceneKeys.has(from) || !sourceSceneKeys.has(to)) continue;
    const pair = `${from}>${to}`;
    const key = sceneLinkKey(from, row, targetSceneById);
    if (!key) continue;
    const rows = targetByPair.get(pair) || [];
    rows.push({ row, key });
    targetByPair.set(pair, rows);
  }

  const repairs = [];
  for (const pair of routePairs()) {
    const pairKey = `${pair.from}>${pair.to}`;
    const allowed = sourcePlan.byPair.get(pairKey) || [];
    if (allowed.length !== 1) continue; // source has no unambiguous authority
    const targetRows = targetByPair.get(pairKey) || [];
    if (targetRows.length <= 1) continue;
    const canonical = targetRows.filter((entry) => entry.key === allowed[0]);
    const stale = targetRows.filter((entry) => entry.key !== allowed[0]);
    if (canonical.length !== 1 || stale.length === 0) {
      throw new RepairError(`Ambiguous Guided-VR duplicate repair for ${pairKey}.`, 'A Guided-VR duplicate is ambiguous; no rows were changed.');
    }
    for (const entry of stale) repairs.push({ pair: pairKey, id: Number(entry.row.id), key: entry.key });
  }
  return repairs;
}

async function writeBackup(rows) {
  const file = path.join(os.tmpdir(), `campusphere-guided-vr-link-backup-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.json`);
  try {
    await fs.promises.writeFile(file, `${JSON.stringify({ created_at: new Date().toISOString(), rows }, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  } catch (_) {
    throw new RepairError('Unable to create Guided-VR duplicate backup.', 'Unable to create the Guided-VR duplicate backup; no rows were changed.');
  }
  return file;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const apply = args.includes('--apply');
  const confirmation = args.find((arg) => arg.startsWith('--confirm='));
  if (args.includes('--help') || args.includes('-h')) return { help: true, apply: false };
  if (args.some((arg) => !['--apply'].includes(arg) && !arg.startsWith('--confirm='))) throw new RepairError('Unknown argument.', 'Unknown repair argument; no rows were changed.');
  if (apply && (!confirmation || confirmation.slice('--confirm='.length) !== APPLY_CONFIRMATION)) throw new RepairError('Missing confirmation.', `Apply is blocked. Use the exact confirmation token: ${APPLY_CONFIRMATION}`);
  if (!apply && confirmation) throw new RepairError('Confirmation requires apply.', 'The confirmation token is valid only with --apply; no rows were changed.');
  return { help: false, apply };
}

function usage() {
  console.log('Usage: node scripts/repairMySqlGuidedVrDuplicateLinks.js');
  console.log(`Apply: node scripts/repairMySqlGuidedVrDuplicateLinks.js --apply --confirm=${APPLY_CONFIRMATION}`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { usage(); return; }
  if (!hasSupabaseConfig()) throw new RepairError('Supabase is not configured.', 'Supabase Guided-VR authority is unavailable; no rows were changed.');
  const sb = getSupabaseClient();
  const conn = await db.getConnection();
  try {
    const source = await readSupabase(sb);
    const target = await readMysql(conn);
    const plan = buildRepairPlan(source, target);
    console.log(args.apply ? 'APPLY PREFLIGHT: exact duplicate-repair confirmation accepted.' : 'READ ONLY: no MySQL or Supabase row was changed.');
    console.log(`Guided-VR stale duplicate rows selected: ${plan.length}`);
    if (!plan.length) { console.log('No stale duplicate transition rows require repair.'); return; }
    for (const item of plan) console.log(`  ${item.pair}: one stale MySQL link selected`);
    if (!args.apply) { console.log('Preview complete. No rows were changed.'); return; }
    const backupRows = target.hotspots.filter((row) => plan.some((item) => item.id === Number(row.id)));
    const backupPath = await writeBackup(backupRows);
    await conn.beginTransaction();
    try {
      for (const item of plan) {
        const [result] = await conn.query('DELETE FROM vr_hotspots WHERE id = ? AND hotspot_type = ?', [item.id, 'scene']);
        if (result.affectedRows !== 1) throw new RepairError('Guarded Guided-VR duplicate delete did not affect one row.', 'A Guided-VR duplicate changed during repair; the transaction was rolled back.');
      }
      const after = await readMysql(conn);
      const remaining = buildRepairPlan(source, after);
      if (remaining.length !== 0) throw new RepairError('Guided-VR duplicate postflight failed.', 'Guided-VR duplicate postflight failed; the transaction was rolled back.');
      await conn.commit();
      console.log(`REPAIR OK: ${plan.length} stale MySQL Guided-VR link(s) removed.`);
      console.log(`Pre-write backup: ${backupPath}`);
    } catch (error) {
      await conn.rollback().catch(() => {});
      throw error;
    }
  } finally {
    conn.release();
    await db.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    const message = error instanceof RepairError ? error.publicMessage : 'Guided-VR duplicate repair failed safely; no uncommitted changes remain.';
    console.error(`REPAIR FAILED: ${message}`);
    process.exitCode = 1;
  });
}

module.exports = { APPLY_CONFIRMATION, buildRepairPlan, routePairs, sceneLinkKey };
