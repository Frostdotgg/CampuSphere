'use strict';

/* Pure and disposable-file safety checks for campus/VR merge and prune modes. */

const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const mysql = require('mysql2/promise');
const {
  APPLY_CONFIRMATION,
  DELETE_ORDER,
  PRUNE_CONFIRMATION,
  TABLES,
  PROTECTED_TABLES,
  assertNoExternalReferences,
  assertNoRemainingScopedReferences,
  assertNoScopedTriggers,
  buildPlan,
  deleteLocalOnlyRows,
  mysqlTargetFingerprint,
  mysqlTargetIsLocal,
  parseArgs,
  previewToken,
  pruneManifest,
  readDeleteMetadata,
  rollbackAndVerify,
  targetFingerprint,
  validateBackupDirectory,
  validatePruneSource,
  writeBackup
} = require('./syncCampusVrSupabaseToMysql');

function base() {
  const source = {
    buildings: [{ id: 1, name: 'Academic Building IV', category: 'ACADEMIC', description: 'Source', lat: 13.4, lng: 123.3, details: {}, image_url: null, cloudinary_public_id: null }],
    campus_routes: [{ id: 1, title: 'Main Gate to Academic Building IV', start_label: 'Main Gate', destination_building_id: 1, estimated_walk_time: '5 min' }],
    campus_route_steps: [],
    route_nodes: [
      { id: 1, node_key: 'acad-4', label: 'Academic Building IV', node_type: 'building', building_id: 1, lat: 13.4, lng: 123.3, display_order: 1 },
      { id: 2, node_key: 'main-gate', label: 'Main Gate', node_type: 'gate', building_id: null, lat: 13.401, lng: 123.301, display_order: 0 }
    ],
    route_edges: [{ id: 1, from_node_id: 2, to_node_id: 1, distance_meters: 100, walk_time_seconds: 60, path_label: 'Walkway', is_accessible: true, path_geometry: null }],
    room_schedule_documents: [],
    vr_scenes: [
      { id: 1, scene_key: 'scene-a', title: 'A', description: null, image_url: '/img/a.jpg', cloudinary_public_id: null, node_id: 1, building_id: 1, initial_yaw: 0, initial_pitch: 0, display_order: 1 },
      { id: 2, scene_key: 'scene-b', title: 'B', description: null, image_url: '/img/b.jpg', cloudinary_public_id: null, node_id: null, building_id: 1, initial_yaw: 0, initial_pitch: 0, display_order: 2 }
    ],
    vr_hotspots: [{ id: 1, scene_id: 1, target_scene_id: 2, hotspot_type: 'scene', label: 'Next', text: null, guest_visible: true, schedule_building_id: null, schedule_location_type: null, schedule_location_label: null, schedule_floor_label: null, schedule_document_id: null, yaw: 10, pitch: 0, display_order: 0 }]
  };
  const target = {
    buildings: [
      { id: 10, name: 'Academic Building IV', category: 'ACADEMIC', description: 'Source', lat: '13.40000000', lng: '123.30000000', details: '{}', image_url: null, cloudinary_public_id: null },
      { id: 11, name: 'Local-only Building', category: 'FACILITIES', description: null, lat: '13.5', lng: '123.4', details: '{}', image_url: null, cloudinary_public_id: null }
    ],
    campus_routes: [
      { id: 20, title: 'Main Gate to Academic Building IV', start_label: 'Main Gate', destination_building_id: 10, estimated_walk_time: '5 min' },
      { id: 21, title: 'Local-only Route', start_label: 'Local Gate', destination_building_id: 11, estimated_walk_time: '3 min' }
    ],
    campus_route_steps: [{ id: 22, route_id: 21, step_order: 1, instruction: 'Local step', landmark: null, lat: '13.5', lng: '123.4' }],
    route_nodes: [
      { id: 30, node_key: 'acad-4', label: 'Academic Building IV', node_type: 'building', building_id: 10, lat: '13.4', lng: '123.3', display_order: '1' },
      { id: 31, node_key: 'main-gate', label: 'Main Gate', node_type: 'gate', building_id: null, lat: '13.401', lng: '123.301', display_order: '0' },
      { id: 32, node_key: 'local-node', label: 'Local Node', node_type: 'building', building_id: 11, lat: '13.5', lng: '123.4', display_order: '9' }
    ],
    route_edges: [
      { id: 40, from_node_id: 31, to_node_id: 30, distance_meters: 100, walk_time_seconds: 60, path_label: 'Walkway', is_accessible: 1, path_geometry: null },
      { id: 41, from_node_id: 30, to_node_id: 32, distance_meters: 50, walk_time_seconds: 30, path_label: 'Local path', is_accessible: 1, path_geometry: null }
    ],
    room_schedule_documents: [{ id: 60, building_id: 11, location_type: 'room', location_label: 'Local Room', floor_label: null, location_key: 'local-room-key', semester: 'first-semester', school_year: '2026-2027', image_url: 'https://example.invalid/schedule.png', cloudinary_public_id: null }],
    vr_scenes: [
      { id: 40, scene_key: 'scene-a', title: 'A', description: null, image_url: '/img/a.jpg', cloudinary_public_id: null, node_id: 30, building_id: 10, initial_yaw: '0.00', initial_pitch: '0.00', display_order: '1' },
      { id: 41, scene_key: 'scene-b', title: 'B', description: null, image_url: '/img/b.jpg', cloudinary_public_id: null, node_id: null, building_id: 10, initial_yaw: '0.00', initial_pitch: '0.00', display_order: '2' },
      { id: 42, scene_key: 'local-scene', title: 'Local Scene', description: null, image_url: '/img/local.jpg', cloudinary_public_id: null, node_id: 32, building_id: 11, initial_yaw: '0.00', initial_pitch: '0.00', display_order: '9' }
    ],
    vr_hotspots: [
      { id: 50, scene_id: 40, target_scene_id: 41, hotspot_type: 'scene', label: 'Next', text: null, guest_visible: 1, schedule_building_id: null, schedule_location_type: null, schedule_location_label: null, schedule_floor_label: null, schedule_document_id: null, yaw: '10.00', pitch: '0.00', display_order: '0' },
      { id: 51, scene_id: 42, target_scene_id: null, hotspot_type: 'info', label: 'Local info', text: 'Local-only', guest_visible: 0, schedule_building_id: null, schedule_location_type: null, schedule_location_label: null, schedule_floor_label: null, schedule_document_id: null, yaw: '0.00', pitch: '0.00', display_order: '1' }
    ]
  };
  return { source, target };
}

async function readFixtureSnapshot(connection) {
  const target = {};
  for (const table of TABLES) {
    const [rows] = await connection.query(`SELECT * FROM \`${table}\` ORDER BY id`);
    target[table] = rows;
  }
  return target;
}

async function runMysqlForeignKeyFixture() {
  const host = process.env.CAMPUS_VR_SYNC_TEST_HOST;
  const user = process.env.CAMPUS_VR_SYNC_TEST_USER;
  const password = process.env.CAMPUS_VR_SYNC_TEST_PASSWORD;
  const port = Number(process.env.CAMPUS_VR_SYNC_TEST_PORT || 3306);
  if (!host && !user && !password) return false;
  assert.ok(host && user && password, 'all disposable MySQL fixture settings must be supplied together');
  assert.equal(mysqlTargetIsLocal(host), true, 'the integration fixture must use loopback MySQL');

  let admin = null;
  let connection = null;
  let databaseCreated = false;
  const databaseName = `campusphere_sync_probe_${process.pid}_${crypto.randomBytes(4).toString('hex')}`;
  assert.match(databaseName, /^campusphere_sync_probe_[0-9]+_[a-f0-9]+$/);
  try {
    for (let attempt = 0; attempt < 60 && !admin; attempt += 1) {
      try {
        admin = await mysql.createConnection({ host, port, user, password, connectTimeout: 1500, multipleStatements: true });
      } catch (_) {
        if (attempt === 59) throw new Error('Unable to connect to the disposable local MySQL fixture.');
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    await admin.query(`CREATE DATABASE \`${databaseName}\``);
    databaseCreated = true;
    connection = await mysql.createConnection({ host, port, user, password, database: databaseName, multipleStatements: true });

    const schemaPath = path.resolve(__dirname, '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8').replace(
      /^CREATE DATABASE IF NOT EXISTS campusphere_db;\r?\nUSE campusphere_db;\r?\n/m,
      `USE \`${databaseName}\`;\n`
    );
    assert.equal(schema.includes('CREATE DATABASE IF NOT EXISTS campusphere_db;'), false, 'fixture schema must not select the application database');
    await connection.query(schema);

    const { source, target: fixtureRows } = base();
    for (const table of TABLES) {
      for (const row of fixtureRows[table]) {
        const columns = Object.keys(row);
        const quoted = columns.map((column) => `\`${column}\``).join(', ');
        const placeholders = columns.map(() => '?').join(', ');
        await connection.query(`INSERT INTO \`${table}\` (${quoted}) VALUES (${placeholders})`, columns.map((column) => row[column]));
      }
    }

    const initial = await readFixtureSnapshot(connection);
    const plan = buildPlan(source, initial);
    const metadata = await readDeleteMetadata(connection);
    assertNoScopedTriggers(metadata);

    await connection.query(`INSERT INTO room_schedules (title, schedule_date, start_time, end_time, building_id, location_type, location_label) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
      'Protected reference fixture', '2026-09-24', '09:00:00', '10:00:00', 11, 'room', 'Local Room'
    ]);
    await assert.rejects(assertNoExternalReferences(connection, plan, metadata), (error) => /room_schedules refers/.test(error.publicMessage));
    await connection.query('DELETE FROM room_schedules WHERE title = ?', ['Protected reference fixture']);

    const initialFingerprint = targetFingerprint(initial);
    await connection.beginTransaction();
    const deleted = await deleteLocalOnlyRows(connection, plan);
    assert.equal(deleted, 8);
    const afterDelete = await readFixtureSnapshot(connection);
    const afterPlan = buildPlan(source, afterDelete);
    assert.equal(TABLES.every((table) => afterPlan.removals[table].length === 0), true);
    assert.equal(TABLES.every((table) => afterPlan.entries[table].every((entry) => entry.action === 'present')), true);
    assertNoRemainingScopedReferences(afterPlan, afterDelete, metadata);
    await connection.rollback();
    const afterRollback = await readFixtureSnapshot(connection);
    assert.equal(targetFingerprint(afterRollback), initialFingerprint);
    return true;
  } finally {
    if (connection) {
      await connection.rollback().catch(() => {});
      await connection.end();
    }
    if (admin) {
      try {
        if (databaseCreated) await admin.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
      } finally {
        await admin.end();
      }
    }
  }
}

async function main() {
  const { source, target } = base();
  const plan = buildPlan(source, target);
  assert.deepEqual(TABLES, ['buildings', 'campus_routes', 'campus_route_steps', 'route_nodes', 'route_edges', 'room_schedule_documents', 'vr_scenes', 'vr_hotspots']);
  assert.equal(PROTECTED_TABLES.includes('users'), true);
  assert.deepEqual(Object.fromEntries(TABLES.map((table) => [table, plan.removals[table].length])), Object.fromEntries(TABLES.map((table) => [table, 1])));
  assert.deepEqual(pruneManifest(plan).map((entry) => entry.table), DELETE_ORDER);
  assert.deepEqual(pruneManifest(plan).map((entry) => entry.id), [51, 22, 41, 42, 21, 60, 32, 11]);
  assert.throws(() => validatePruneSource({ ...source, route_edges: [] }), (error) => /is empty/.test(error.publicMessage));
  assert.throws(() => validatePruneSource({ ...source, vr_hotspots: [] }), (error) => /vr_hotspots is empty/.test(error.publicMessage));
  assert.throws(() => validatePruneSource({ ...source, campus_routes: source.campus_routes.map((row) => ({ ...row, destination_building_id: 999 })) }), (error) => /unresolved campus-route/.test(error.publicMessage));
  assert.doesNotThrow(() => validatePruneSource(source));

  const sourceFp = 'a'.repeat(64);
  const targetFp = 'b'.repeat(64);
  const token = previewToken(sourceFp, targetFp, plan);
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.notEqual(previewToken('c'.repeat(64), targetFp, plan), token);
  assert.notEqual(previewToken(sourceFp, 'c'.repeat(64), plan), token);
  assert.notEqual(previewToken(sourceFp, targetFp, plan, 'c'.repeat(64)), token);
  assert.equal(mysqlTargetIsLocal('127.0.0.1'), true);
  assert.equal(mysqlTargetIsLocal('localhost'), true);
  assert.equal(mysqlTargetIsLocal('db.example.invalid'), false);
  assert.equal(await mysqlTargetFingerprint({
    async query() { return [[{ database_name: 'campusphere_db', server_name: 'mysql', server_port: 3306 }], []]; }
  }), crypto.createHash('sha256').update(JSON.stringify({ database_name: 'campusphere_db', server_name: 'mysql', server_port: 3306 })).digest('hex'));

  assert.deepEqual(parseArgs(['node', 'sync.js']), { help: false, apply: false, dryRun: true, prune: false, previewToken: null, backupDirectory: null });
  assert.equal(parseArgs(['node', 'sync.js', '--prune', '--dry-run']).prune, true);
  assert.equal(parseArgs(['node', 'sync.js', '--apply', `--confirm=${APPLY_CONFIRMATION}`]).apply, true);
  const pruneArgs = parseArgs(['node', 'sync.js', '--prune', '--apply', `--confirm=${PRUNE_CONFIRMATION}`, `--preview-token=${token}`, '--backup-dir=C:\\backups']);
  assert.equal(pruneArgs.previewToken, token);
  assert.throws(() => parseArgs(['node', 'sync.js', '--prune']), (error) => /Use --prune --dry-run/.test(error.publicMessage));
  assert.throws(() => parseArgs(['node', 'sync.js', '--apply', `--confirm=${PRUNE_CONFIRMATION}`]), (error) => /requires --prune/.test(error.publicMessage));
  assert.throws(() => parseArgs(['node', 'sync.js', '--prune', '--apply', `--confirm=${PRUNE_CONFIRMATION}`, `--preview-token=${token}`]), (error) => /requires --backup-dir/.test(error.publicMessage));
  assert.throws(() => parseArgs(['node', 'sync.js', '--prune', '--apply', `--confirm=${PRUNE_CONFIRMATION}`, '--preview-token=bad', '--backup-dir=C:\\backups']), (error) => /64-character/.test(error.publicMessage));
  assert.throws(() => parseArgs(['node', 'sync.js', '--dry-run', `--confirm=${APPLY_CONFIRMATION}`]), (error) => /only with --apply/.test(error.publicMessage));

  const scopedForeignKeys = [
    { parent_table: 'route_nodes', parent_column: 'id', child_table: 'route_edges', child_column: 'from_node_id' },
    { parent_table: 'route_nodes', parent_column: 'id', child_table: 'route_edges', child_column: 'to_node_id' },
    { parent_table: 'route_nodes', parent_column: 'id', child_table: 'vr_scenes', child_column: 'node_id' },
    { parent_table: 'buildings', parent_column: 'id', child_table: 'room_schedule_documents', child_column: 'building_id' },
    { parent_table: 'vr_scenes', parent_column: 'id', child_table: 'vr_hotspots', child_column: 'scene_id' }
  ];
  assert.doesNotThrow(() => assertNoRemainingScopedReferences(plan, target, { foreignKeys: scopedForeignKeys }));
  const retainedTarget = { ...target, route_edges: [...target.route_edges, { id: 90, from_node_id: 32, to_node_id: 30 }] };
  assert.throws(() => assertNoRemainingScopedReferences(plan, retainedTarget, { foreignKeys: scopedForeignKeys }), (error) => /retained.*refers/i.test(error.publicMessage));
  assert.throws(() => assertNoScopedTriggers({ triggers: [{ table_name: 'buildings', trigger_name: 'unexpected' }] }), (error) => /trigger exists/.test(error.publicMessage));
  assert.doesNotThrow(() => assertNoScopedTriggers({ triggers: [] }));

  let externalQueryCount = 0;
  const referencingConnection = {
    async query(sql, values) {
      externalQueryCount += 1;
      assert.match(sql, /SELECT 1 AS referenced/);
      assert.deepEqual(values, [11]);
      return [[{ referenced: 1 }], []];
    }
  };
  await assert.rejects(
    assertNoExternalReferences(referencingConnection, plan, {
      foreignKeys: [{ parent_table: 'buildings', parent_column: 'id', child_table: 'room_schedules', child_column: 'building_id' }]
    }), (error) => /room_schedules refers/.test(error.publicMessage));
  assert.equal(externalQueryCount, 1);
  const clearConnection = { async query() { return [[], []]; } };
  await assert.doesNotReject(assertNoExternalReferences(clearConnection, plan, {
    foreignKeys: [{ parent_table: 'buildings', parent_column: 'id', child_table: 'room_schedules', child_column: 'building_id' }]
  }));

  const deleteCalls = [];
  const deleteConnection = {
    async query(sql, values) {
      deleteCalls.push({ sql, values });
      return [{ affectedRows: 1 }, []];
    }
  };
  assert.equal(await deleteLocalOnlyRows(deleteConnection, plan), 8);
  assert.deepEqual(deleteCalls.map(({ values }) => values[0]), [51, 22, 41, 42, 21, 60, 32, 11]);
  assert.equal(deleteCalls.every(({ sql }) => /^DELETE FROM `(?:vr_hotspots|campus_route_steps|route_edges|vr_scenes|campus_routes|room_schedule_documents|route_nodes|buildings)` WHERE `id` IN \(\?\)$/i.test(sql)), true);
  let deleteAttempt = 0;
  await assert.rejects(deleteLocalOnlyRows({ async query() { deleteAttempt += 1; return [{ affectedRows: deleteAttempt === 1 ? 1 : 0 }, []]; } }, plan), (error) => /transaction was rolled back/.test(error.publicMessage));

  const rollbackRows = Object.fromEntries(TABLES.map((table) => [table, target[table]]));
  let rollbackCount = 0;
  const rollbackConnection = {
    async rollback() { rollbackCount += 1; },
    async query(sql) {
      const tableMatch = sql.match(/FROM `([A-Za-z_][A-Za-z0-9_]*)`/i);
      assert.ok(tableMatch);
      return [rollbackRows[tableMatch[1]], []];
    }
  };
  assert.equal(await rollbackAndVerify(rollbackConnection, targetFingerprint(target)), true);
  assert.equal(rollbackCount, 1);

  const backupDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'campusphere-sync-probe-'));
  try {
    assert.equal(await validateBackupDirectory(backupDirectory), await fs.promises.realpath(backupDirectory));
    await assert.rejects(validateBackupDirectory(path.resolve(__dirname, '..')), (error) => /outside the repository/.test(error.publicMessage));
    await assert.rejects(validateBackupDirectory('relative-backup-folder'), (error) => /absolute/.test(error.publicMessage));
    const backupTarget = { ...target, buildings: target.buildings.map((row) => ({ ...row, created_at: new Date('2026-09-24T00:00:00.000Z') })) };
    const mysqlFp = 'd'.repeat(64);
    const backup = await writeBackup(backupTarget, sourceFp, targetFp, backupDirectory, mysqlFp);
    const backupBytes = await fs.promises.readFile(backup.path);
    const saved = JSON.parse(backupBytes.toString('utf8'));
    assert.equal(crypto.createHash('sha256').update(backupBytes).digest('hex'), backup.sha256);
    assert.equal(saved.schema_version, 1);
    assert.equal(saved.mysql_target_fingerprint, mysqlFp);
    assert.equal(saved.snapshot_fingerprint, backup.snapshotFingerprint);
    assert.equal(saved.table_counts.buildings, 2);
    assert.equal(saved.tables.buildings[0].created_at, '2026-09-24T00:00:00.000Z');
    await assert.rejects(writeBackup(target, sourceFp, targetFp, path.join(backupDirectory, 'missing')));
  } finally {
    fs.rmSync(backupDirectory, { recursive: true, force: true });
  }

  const mysqlFixtureRan = await runMysqlForeignKeyFixture();

  const sourceText = fs.readFileSync(require.resolve('./syncCampusVrSupabaseToMysql'), 'utf8');
  assert.equal(/TRUNCATE\s+TABLE|DROP\s+TABLE/i.test(sourceText), false);
  assert.match(sourceText, /DELETE FROM \$\{quoteIdentifier\(table\)\} WHERE \$\{quoteIdentifier\(ID_FIELD\[table\]\)\} IN \(/);
  console.log(`SYNC-CAMPUS-VR-PROBE OK: merge compatibility, exact prune preview, stale-token guards, FK safety, verified backup, ordered deletion, and rollback checks passed${mysqlFixtureRan ? ' with the disposable MySQL fixture' : ''}.`);
}

main().catch((error) => {
  console.error(`SYNC-CAMPUS-VR-PROBE FAILED: ${error.message}`);
  process.exitCode = 1;
});
