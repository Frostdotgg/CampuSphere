'use strict';

/*
 * CampuSphere — bounded local MySQL repair for the expanded Guided-VR catalog.
 *
 * The current catalog names the legacy `ccs` node's destination "Academic
 * Building IV". Some local MySQL snapshots still link that node to the
 * minimal-seed "College of Computer Studies (CCS)" row. This utility changes
 * only that foreign-key link, after resolving both natural identities.
 *
 * Dry-run is the default. Apply requires the exact confirmation token and uses
 * a serializable transaction, a restrictive pre-image backup, locked
 * revalidation, an affected-row guard, and post-commit readback.
 *
 * Usage:
 *   node scripts/repairMysqlAcademicIvRouteNode.js --dry-run
 *   node scripts/repairMysqlAcademicIvRouteNode.js --apply \
 *     --confirm=APPLY_MYSQL_ACADEMIC_IV_ROUTE_MAPPING
 */

process.env.DOTENV_CONFIG_QUIET = 'true';
require('dotenv').config({ quiet: true });

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('../config/db');

const TARGET_NODE_KEY = 'ccs';
const TARGET_BUILDING_NAME = 'Academic Building IV';
const LEGACY_BUILDING_NAME = 'College of Computer Studies (CCS)';
const APPLY_CONFIRMATION = 'APPLY_MYSQL_ACADEMIC_IV_ROUTE_MAPPING';
const BACKUP_DIR_NAME = 'campusphere-academic-iv-route-node';

class SafeRepairError extends Error {}

function canonicalKey(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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

function fingerprint(value) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(stableValue(value)))
    .digest('hex');
}

function parseArgs(argv) {
  const flags = argv.slice(2).filter((arg) => !arg.startsWith('--confirm='));
  const confirmations = argv.slice(2)
    .filter((arg) => arg.startsWith('--confirm='))
    .map((arg) => arg.slice('--confirm='.length));
  const allowed = new Set(['--dry-run', '--apply', '--help']);

  for (const flag of flags) {
    if (!allowed.has(flag) || flags.filter((candidate) => candidate === flag).length > 1) {
      throw new SafeRepairError('Unknown or duplicate command flag. Use --dry-run, --apply, or --help.');
    }
  }
  if (confirmations.length > 1) {
    throw new SafeRepairError('Apply confirmation must be provided exactly once.');
  }
  if (flags.includes('--help')) {
    if (flags.length !== 1 || confirmations.length) {
      throw new SafeRepairError('--help cannot be combined with another argument.');
    }
    return { mode: 'help' };
  }
  if (flags.includes('--apply')) {
    if (flags.includes('--dry-run') || confirmations[0] !== APPLY_CONFIRMATION) {
      throw new SafeRepairError('Apply requires the exact confirmation token; no data was written.');
    }
    return { mode: 'apply' };
  }
  if (confirmations.length) {
    throw new SafeRepairError('--confirm is valid only with --apply.');
  }
  return { mode: 'dry-run' };
}

async function readState(queryable, lockRows = false) {
  const suffix = lockRows ? ' FOR UPDATE' : '';
  const [nodes] = await queryable.query(
    'SELECT id, node_key, label, node_type, building_id, lat, lng, display_order ' +
    'FROM route_nodes WHERE node_key = ? ORDER BY id' + suffix,
    [TARGET_NODE_KEY]
  );
  const [buildings] = await queryable.query(
    'SELECT id, name, category, description, lat, lng FROM buildings ' +
    'WHERE name IN (?, ?) ORDER BY name, id' + suffix,
    [TARGET_BUILDING_NAME, LEGACY_BUILDING_NAME]
  );
  return { nodes, buildings };
}

function planRepair(state) {
  const blockers = [];
  const nodes = Array.isArray(state && state.nodes) ? state.nodes : [];
  const buildings = Array.isArray(state && state.buildings) ? state.buildings : [];
  const targetRows = buildings.filter((row) => canonicalKey(row.name) === canonicalKey(TARGET_BUILDING_NAME));
  const legacyRows = buildings.filter((row) => canonicalKey(row.name) === canonicalKey(LEGACY_BUILDING_NAME));

  if (nodes.length !== 1) blockers.push('the ccs route-node identity is not unique');
  if (targetRows.length !== 1) blockers.push('the Academic Building IV identity is not unique');

  const node = nodes[0] || null;
  const target = targetRows[0] || null;
  const legacy = legacyRows.length === 1 ? legacyRows[0] : null;
  const before = { node, target, legacy };
  let action = null;

  if (node && target) {
    if (Number(node.building_id) === Number(target.id)) {
      // Already repaired; this is an idempotent no-op.
    } else if (legacy && Number(node.building_id) === Number(legacy.id)) {
      action = {
        nodeId: Number(node.id),
        expectedBuildingId: Number(legacy.id),
        targetBuildingId: Number(target.id)
      };
    } else {
      blockers.push('the ccs node points to an unexpected building; refusing to guess');
    }
  }

  return {
    blockers,
    action,
    before,
    preFingerprint: fingerprint(before),
    actionFingerprint: fingerprint({ before, action })
  };
}

async function writeBackup(state, preFingerprint) {
  const dir = path.join(os.tmpdir(), BACKUP_DIR_NAME);
  const file = path.join(
    dir,
    `mysql-before-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID()}.json`
  );
  const payload = {
    schema_version: 1,
    created_at: new Date().toISOString(),
    pre_fingerprint: preFingerprint,
    state
  };
  try {
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, {
      encoding: 'utf8', flag: 'wx', mode: 0o600
    });
    const verified = JSON.parse(await fs.promises.readFile(file, 'utf8'));
    if (verified.schema_version !== 1 || verified.pre_fingerprint !== preFingerprint ||
        fingerprint(verified.state) !== preFingerprint) {
      throw new Error('backup fingerprint mismatch');
    }
  } catch (_) {
    throw new SafeRepairError('Unable to create and verify the local MySQL repair backup.');
  }
  return file;
}

async function applyRepair(approvedPlan) {
  if (!approvedPlan || approvedPlan.blockers.length || !approvedPlan.action) {
    return { changed: false, backupPath: null };
  }

  let connection = null;
  let begun = false;
  let committed = false;
  let backupPath = null;
  let rollbackFailed = false;
  try {
    connection = await db.getConnection();
    await connection.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
    await connection.beginTransaction();
    begun = true;

    const locked = await readState(connection, true);
    const lockedPlan = planRepair(locked);
    if (lockedPlan.blockers.length || lockedPlan.actionFingerprint !== approvedPlan.actionFingerprint) {
      throw new SafeRepairError('Local MySQL state changed after preflight; no data was written.');
    }

    backupPath = await writeBackup(lockedPlan.before, lockedPlan.preFingerprint);
    const a = lockedPlan.action;
    const [result] = await connection.query(
      'UPDATE route_nodes SET building_id = ? WHERE id = ? AND building_id = ?',
      [a.targetBuildingId, a.nodeId, a.expectedBuildingId]
    );
    if (!result || result.affectedRows !== 1) {
      throw new SafeRepairError('The local MySQL route-node correction affected an unexpected number of rows.');
    }

    const inside = planRepair(await readState(connection, true));
    if (inside.blockers.length || inside.action !== null) {
      throw new SafeRepairError('Pre-commit local MySQL route-node verification failed.');
    }
    await connection.commit();
    committed = true;

    const after = planRepair(await readState(db, false));
    if (after.blockers.length || after.action !== null) {
      throw new SafeRepairError(`POST-COMMIT READBACK MISMATCH. Backup: ${backupPath}`);
    }
    return { changed: true, backupPath };
  } catch (error) {
    if (begun && !committed) {
      try {
        await connection.rollback();
      } catch (_) {
        rollbackFailed = true;
      }
    }
    if (rollbackFailed) {
      throw new SafeRepairError(
        `ROLLBACK FAILED. Manual recovery review is required${backupPath ? `; backup: ${backupPath}` : ''}.`
      );
    }
    if (committed && !(error instanceof SafeRepairError)) {
      throw new SafeRepairError(`POST-COMMIT READBACK FAILED. Backup: ${backupPath}`);
    }
    if (error instanceof SafeRepairError) throw error;
    throw new SafeRepairError('Local MySQL route-node repair failed; no data was written.');
  } finally {
    if (connection) {
      if (rollbackFailed) {
        try { connection.destroy(); } catch (_) {}
      } else {
        try {
          connection.release();
        } catch (_) {
          try { connection.destroy(); } catch (_2) {}
        }
      }
    }
  }
}

function printPlan(plan, mode) {
  console.log(`=== Academic IV route-node repair: ${mode === 'dry-run' ? 'DRY RUN' : 'CONFIRMED APPLY'} ===`);
  console.log('Scope: local MySQL route_nodes.ccs building_id only. Supabase and all other tables are untouched.');
  if (plan.blockers.length) {
    console.log(`BLOCKED (${plan.blockers.length}):`);
    plan.blockers.forEach((blocker) => console.log(`  - ${blocker}`));
    return;
  }
  if (!plan.action) {
    console.log('NO-OP: ccs already maps to Academic Building IV.');
    return;
  }
  console.log('READY: exactly one guarded route-node mapping update is planned.');
  console.log(`Preflight fingerprint: ${plan.preFingerprint}`);
  if (mode === 'dry-run') {
    console.log(`Apply requires: node scripts/repairMysqlAcademicIvRouteNode.js --apply --confirm=${APPLY_CONFIRMATION}`);
  }
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv);
    if (args.mode === 'help') {
      console.log('Usage: node scripts/repairMysqlAcademicIvRouteNode.js --dry-run');
      console.log(`Apply: node scripts/repairMysqlAcademicIvRouteNode.js --apply --confirm=${APPLY_CONFIRMATION}`);
      return;
    }
    const plan = planRepair(await readState(db, false));
    printPlan(plan, args.mode);
    if (plan.blockers.length) {
      process.exitCode = 2;
      return;
    }
    if (args.mode === 'apply' && plan.action) {
      const result = await applyRepair(plan);
      console.log(`APPLY OK: ${result.changed ? 'one mapping updated and verified.' : 'no change required.'}`);
      console.log(`Backup: ${result.backupPath}`);
    }
  } catch (error) {
    console.error(error instanceof SafeRepairError ? error.message : 'Local MySQL repair failed.');
    process.exitCode = 1;
  } finally {
    try { await db.end(); } catch (_) {}
  }
}

if (require.main === module) main();

module.exports = {
  APPLY_CONFIRMATION,
  TARGET_NODE_KEY,
  TARGET_BUILDING_NAME,
  LEGACY_BUILDING_NAME,
  canonicalKey,
  fingerprint,
  parseArgs,
  planRepair
};
