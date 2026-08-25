'use strict';

/*
 * Supabase -> MySQL non-user content reconciliation.
 *
 * Supabase is the source of truth for the public/application content tables.
 * MySQL users, profiles, sessions, and audit logs are deliberately excluded.
 * The default mode is read-only. Apply requires the exact confirmation token.
 *
 * This utility keeps backend-local numeric identities for the copied content
 * by inserting the Supabase ids into the corresponding MySQL rows. User-owned
 * foreign keys are nulled rather than guessed across the two user stores.
 */

process.env.DOTENV_CONFIG_QUIET = 'true';
require('dotenv').config({ quiet: true });

const crypto = require('crypto');
const mysql = require('mysql2/promise');
const { getSupabaseClient, hasSupabaseConfig } = require('../config/supabase');

const APPLY_CONFIRMATION = 'SYNC_SUPABASE_CONTENT_TO_MYSQL';
const PAGE_SIZE = 500;
const MAX_PAGES = 1000;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const JSON_COLUMNS = new Set(['details', 'path_geometry']);
const IGNORED_SOURCE_COLUMNS = new Set(['location']);

// Delete order is the reverse of these dependency relationships. Insert order
// is the forward dependency order. All names are fixed constants, never input.
const TABLES = Object.freeze([
  { name: 'buildings', primaryKey: ['id'] },
  { name: 'room_schedules', primaryKey: ['id'], nullColumns: ['created_by_user_id'] },
  { name: 'room_schedule_documents', primaryKey: ['id'], nullColumns: ['created_by_user_id'] },
  { name: 'news_announcements', primaryKey: ['id'], nullColumns: ['author_id'] },
  { name: 'team_members', primaryKey: ['id'] },
  { name: 'events', primaryKey: ['id'] },
  { name: 'faqs', primaryKey: ['id'] },
  { name: 'system_settings', primaryKey: ['setting_key'] },
  { name: 'campus_routes', primaryKey: ['id'] },
  { name: 'campus_route_steps', primaryKey: ['id'] },
  { name: 'route_nodes', primaryKey: ['id'] },
  { name: 'route_edges', primaryKey: ['id'] },
  { name: 'vr_scenes', primaryKey: ['id'] },
  { name: 'vr_hotspots', primaryKey: ['id'] }
]);

const DELETE_ORDER = Object.freeze([
  'room_schedules',
  'vr_hotspots',
  'room_schedule_documents',
  'vr_scenes',
  'route_edges',
  'campus_route_steps',
  'campus_routes',
  'route_nodes',
  'news_announcements',
  'team_members',
  'events',
  'faqs',
  'system_settings',
  'buildings'
]);

const EXCLUDED_TABLES = Object.freeze([
  'users',
  'student_profiles',
  'instructor_profiles',
  'guest_profiles',
  'app_sessions',
  'system_logs'
]);

class SyncError extends Error {
  constructor(message, publicMessage = null) {
    super(message);
    this.name = 'SyncError';
    this.publicMessage = publicMessage || message;
  }
}

function quoteIdentifier(value) {
  if (!IDENTIFIER.test(value)) throw new SyncError('Unsafe SQL identifier.');
  return `\`${value}\``;
}

function canonicalize(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return value.toString();
  if (Buffer.isBuffer(value)) return { __buffer__: value.toString('base64') };
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonicalize(value[key]);
    return out;
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function primaryKeyValue(row, descriptor) {
  return descriptor.primaryKey.map((key) => String(row[key] === null || row[key] === undefined ? '' : row[key])).join('|');
}

function parseJsonValue(value, columnName) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (_) {
      throw new SyncError(`Invalid JSON in ${columnName}.`, `Supabase contains invalid JSON in ${columnName}.`);
    }
  }
  return value;
}

function canonicalJsonString(value, columnName) {
  return JSON.stringify(canonicalize(parseJsonValue(value, columnName)));
}

function canonicalNumeric(value, column) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return text;
  const scale = Number.isInteger(column.numericScale) ? column.numericScale : null;
  if (scale !== null && /^[-+]?\d+(?:\.\d+)?$/.test(text)) {
    const negative = text.startsWith('-');
    const unsigned = text.replace(/^[-+]/, '');
    const parts = unsigned.split('.');
    const integer = parts[0].replace(/^0+(?=\d)/, '') || '0';
    const fraction = (parts[1] || '').padEnd(scale, '0').slice(0, scale).replace(/0+$/, '');
    return `${negative ? '-' : ''}${integer}${fraction ? `.${fraction}` : ''}`;
  }
  if (column.dataType === 'float' || column.dataType === 'double') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return String(numeric);
  }
  return text;
}

function temporalValue(value, dataType, columnName, precision = 0) {
  if (value === null || value === undefined) return null;
  if (dataType === 'date') {
    const text = value instanceof Date ? value.toISOString() : String(value);
    const match = text.match(/^\d{4}-\d{2}-\d{2}/);
    if (!match) throw new SyncError(`Invalid date in ${columnName}.`, `Supabase contains an invalid date in ${columnName}.`);
    return match[0];
  }
  if (dataType === 'time') {
    const text = String(value).replace(/^T/, '');
    const match = text.match(/^(\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?)/);
    if (!match) throw new SyncError(`Invalid time in ${columnName}.`, `Supabase contains an invalid time in ${columnName}.`);
    return match[1];
  }
  if (dataType === 'timestamp' || dataType === 'datetime') {
    const parsed = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(parsed.getTime())) {
      throw new SyncError(`Invalid timestamp in ${columnName}.`, `Supabase contains an invalid timestamp in ${columnName}.`);
    }
    const base = parsed.toISOString().replace('T', ' ').replace('Z', '');
    const match = base.match(/^(.*?)(?:\.(\d{3}))?$/);
    if (!match) return base;
    if (!precision) return match[1];
    return `${match[1]}.${match[2] ? match[2].slice(0, precision).padEnd(precision, '0') : '0'.repeat(precision)}`;
  }
  return value;
}

function toMysqlValue(value, column) {
  if (value === undefined || value === null) return null;
  if (JSON_COLUMNS.has(column.name) || column.dataType === 'json') return canonicalJsonString(value, column.name);
  if (column.dataType === 'boolean' || column.dataType === 'tinyint') return value ? 1 : 0;
  if (['bigint', 'int', 'integer', 'mediumint', 'smallint', 'decimal', 'numeric', 'float', 'double', 'real'].includes(column.dataType)) {
    return value;
  }
  if (column.dataType === 'date' || column.dataType === 'time' || column.dataType === 'timestamp' || column.dataType === 'datetime') {
    return temporalValue(value, column.dataType, column.name, column.datetimePrecision || 0);
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'object') return JSON.stringify(canonicalize(value));
  return value;
}

function comparableValue(value, column) {
  if (value === undefined || value === null) return null;
  if (JSON_COLUMNS.has(column.name) || column.dataType === 'json') return canonicalize(parseJsonValue(value, column.name));
  if (column.dataType === 'boolean' || column.dataType === 'tinyint') return value ? 1 : 0;
  if (['bigint', 'int', 'integer', 'mediumint', 'smallint', 'decimal', 'numeric', 'float', 'double', 'real'].includes(column.dataType)) {
    return canonicalNumeric(value, column);
  }
  // `value` is already normalized by projectRow. Re-parsing a MySQL-formatted
  // timestamp as a local JavaScript date would apply the timezone conversion a
  // second time, so temporal values pass through unchanged here.
  return value;
}

function projectRow(row, descriptor, columns) {
  const nullColumns = new Set(descriptor.nullColumns || []);
  const projected = {};
  for (const column of columns) {
    const value = nullColumns.has(column.name) ? null : row[column.name];
    projected[column.name] = toMysqlValue(value, column);
  }
  return projected;
}

function comparableRow(row, descriptor, columns, sourceRow) {
  const projected = sourceRow ? projectRow(row, descriptor, columns) : row;
  const comparable = {};
  for (const column of columns) comparable[column.name] = comparableValue(projected[column.name], column);
  return comparable;
}

function normalizeRows(rows, descriptor, columns, sourceRows) {
  return rows
    .map((row) => comparableRow(row, descriptor, columns, sourceRows))
    .sort((a, b) => primaryKeyValue(a, descriptor).localeCompare(primaryKeyValue(b, descriptor)));
}

function tableFingerprint(rows, descriptor, columns, sourceRows) {
  return sha256(stableStringify(normalizeRows(rows, descriptor, columns, sourceRows)));
}

function assertSafePrimaryKeys(rows, descriptor, tableName) {
  const seen = new Set();
  for (const row of rows) {
    const key = primaryKeyValue(row, descriptor);
    if (descriptor.primaryKey.some((column) => row[column] === null || row[column] === undefined || row[column] === '')) {
      throw new SyncError(`${tableName} contains a row without its primary key.`, `Supabase contains an incomplete ${tableName} row.`);
    }
    if (seen.has(key)) throw new SyncError(`${tableName} contains duplicate primary keys.`, `Supabase contains duplicate ${tableName} records.`);
    seen.add(key);
  }
}

function assertSourceColumns(rows, columns, tableName) {
  const allowed = new Set(columns.map((column) => column.name));
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!allowed.has(key) && !IGNORED_SOURCE_COLUMNS.has(key)) {
        throw new SyncError(`${tableName} has unsupported source column ${key}.`, `Supabase has an unsupported column in ${tableName}; sync stopped.`);
      }
    }
  }
}

function assertColumnLengths(rows, descriptor, columns) {
  const nullColumns = new Set(descriptor.nullColumns || []);
  for (const row of rows) {
    for (const column of columns) {
      if (nullColumns.has(column.name) || row[column.name] === null || row[column.name] === undefined) continue;
      if (Number.isInteger(column.maxLength)) {
        const value = toMysqlValue(row[column.name], column);
        if (typeof value === 'string' && value.length > column.maxLength) {
          throw new SyncError(`${descriptor.name}.${column.name} exceeds MySQL length.`, `Supabase data is too long for MySQL column ${descriptor.name}.${column.name}.`);
        }
      }
    }
  }
}

function idSet(rows) {
  return new Set(rows.map((row) => String(row.id)));
}

function assertOptionalForeignKey(value, set, label) {
  if (value === null || value === undefined) return;
  if (!set.has(String(value))) throw new SyncError(`Invalid foreign key ${label}.`, `Supabase has a broken ${label} link.`);
}

function assertGeometry(value) {
  if (value === null || value === undefined) return;
  const points = parseJsonValue(value, 'route_edges.path_geometry');
  if (!Array.isArray(points) || points.length < 2 || points.length > 200) {
    throw new SyncError('Invalid route geometry shape.', 'Supabase contains an invalid route geometry.');
  }
  for (const point of points) {
    if (!point || !Number.isFinite(Number(point.lat)) || !Number.isFinite(Number(point.lng))) {
      throw new SyncError('Invalid route geometry point.', 'Supabase contains an invalid route geometry point.');
    }
  }
}

function validateRelationships(source, descriptors, schemas) {
  const byTable = new Map(descriptors.map((descriptor) => [descriptor.name, source[descriptor.name] || []]));
  const buildings = idSet(byTable.get('buildings'));
  const routes = idSet(byTable.get('campus_routes'));
  const nodes = idSet(byTable.get('route_nodes'));
  const scenes = idSet(byTable.get('vr_scenes'));
  const scheduleDocuments = idSet(byTable.get('room_schedule_documents'));

  for (const row of byTable.get('campus_routes')) assertOptionalForeignKey(row.destination_building_id, buildings, 'campus route building');
  for (const row of byTable.get('campus_route_steps')) assertOptionalForeignKey(row.route_id, routes, 'route step route');
  for (const row of byTable.get('route_nodes')) assertOptionalForeignKey(row.building_id, buildings, 'route node building');
  for (const row of byTable.get('route_edges')) {
    assertOptionalForeignKey(row.from_node_id, nodes, 'route edge source node');
    assertOptionalForeignKey(row.to_node_id, nodes, 'route edge target node');
    assertGeometry(row.path_geometry);
  }
  for (const row of byTable.get('vr_scenes')) {
    assertOptionalForeignKey(row.node_id, nodes, 'VR scene route node');
    assertOptionalForeignKey(row.building_id, buildings, 'VR scene building');
  }
  for (const row of byTable.get('vr_hotspots')) {
    assertOptionalForeignKey(row.scene_id, scenes, 'VR hotspot scene');
    assertOptionalForeignKey(row.target_scene_id, scenes, 'VR hotspot target scene');
    assertOptionalForeignKey(row.schedule_building_id, buildings, 'VR hotspot schedule building');
    assertOptionalForeignKey(row.schedule_document_id, scheduleDocuments, 'VR hotspot room schedule document');
  }
  for (const row of byTable.get('room_schedules')) assertOptionalForeignKey(row.building_id, buildings, 'room schedule building');
  for (const row of byTable.get('room_schedule_documents')) assertOptionalForeignKey(row.building_id, buildings, 'room schedule document building');

  // Force schema metadata to be consumed during validation so a missing target
  // table/column cannot be hidden by an empty source table.
  for (const descriptor of descriptors) {
    if (!schemas.has(descriptor.name)) throw new SyncError(`Missing MySQL schema for ${descriptor.name}.`);
  }
}

async function readTargetSchema(conn, tableName) {
  const [rows] = await conn.query(
    'SELECT COLUMN_NAME AS name, DATA_TYPE AS dataType, CHARACTER_MAXIMUM_LENGTH AS maxLength, ' +
    'DATETIME_PRECISION AS datetimePrecision, NUMERIC_SCALE AS numericScale, ORDINAL_POSITION AS ordinalPosition ' +
    'FROM information_schema.columns WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
    [tableName]
  );
  if (!rows.length) throw new SyncError(`Missing MySQL table ${tableName}.`, `MySQL is missing the required table ${tableName}.`);
  return rows.map((row) => ({
    name: row.name,
    dataType: String(row.dataType).toLowerCase(),
    maxLength: row.maxLength === null ? null : Number(row.maxLength),
    datetimePrecision: row.datetimePrecision === null ? 0 : Number(row.datetimePrecision),
    numericScale: row.numericScale === null ? null : Number(row.numericScale),
    ordinalPosition: Number(row.ordinalPosition)
  }));
}

async function readTargetRows(conn, tableName, primaryKey, forUpdate = false) {
  const order = primaryKey.map(quoteIdentifier).join(', ');
  const lock = forUpdate ? ' FOR UPDATE' : '';
  const [rows] = await conn.query(`SELECT * FROM ${quoteIdentifier(tableName)} ORDER BY ${order}${lock}`);
  return rows;
}

async function readSourceRows(sb, descriptor) {
  const rows = [];
  let offset = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, error } = await sb
      .from(descriptor.name)
      .select('*')
      .order(descriptor.primaryKey[0], { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new SyncError(`Supabase read failed for ${descriptor.name}.`, `Unable to read Supabase ${descriptor.name}.`);
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
    offset += PAGE_SIZE;
  }
  throw new SyncError(`Supabase pagination exceeded the safety limit for ${descriptor.name}.`, `Supabase ${descriptor.name} is too large for this bounded sync.`);
}

async function readSourceSnapshot(sb, descriptors, schemas) {
  const source = {};
  for (const descriptor of descriptors) {
    const rows = await readSourceRows(sb, descriptor);
    const columns = schemas.get(descriptor.name);
    assertSafePrimaryKeys(rows, descriptor, descriptor.name);
    assertSourceColumns(rows, columns, descriptor.name);
    assertColumnLengths(rows, descriptor, columns);
    source[descriptor.name] = rows;
  }
  validateRelationships(source, descriptors, schemas);
  return source;
}

function summarizeTable(sourceRows, targetRows, descriptor, columns) {
  const sourceMap = new Map(normalizeRows(sourceRows, descriptor, columns, true).map((row) => [primaryKeyValue(row, descriptor), row]));
  const targetMap = new Map(normalizeRows(targetRows, descriptor, columns, false).map((row) => [primaryKeyValue(row, descriptor), row]));
  let insert = 0;
  let update = 0;
  let present = 0;
  let remove = 0;
  for (const [key, row] of sourceMap) {
    if (!targetMap.has(key)) insert += 1;
    else if (stableStringify(targetMap.get(key)) !== stableStringify(row)) update += 1;
    else present += 1;
  }
  for (const key of targetMap.keys()) if (!sourceMap.has(key)) remove += 1;
  return { source: sourceMap.size, target: targetMap.size, insert, update, remove, present };
}

function combinedFingerprint(snapshot, descriptors, schemas, sourceRows) {
  return sha256(stableStringify(descriptors.map((descriptor) => ({
    table: descriptor.name,
    fingerprint: tableFingerprint(snapshot[descriptor.name] || [], descriptor, schemas.get(descriptor.name), sourceRows)
  }))));
}

function mismatchedTables(left, right, descriptors, schemas) {
  return descriptors
    .filter((descriptor) => tableFingerprint(left[descriptor.name] || [], descriptor, schemas.get(descriptor.name), true) !==
      tableFingerprint(right[descriptor.name] || [], descriptor, schemas.get(descriptor.name), false))
    .map((descriptor) => descriptor.name);
}

function mismatchDetails(left, right, descriptors, schemas) {
  const details = [];
  for (const descriptor of descriptors) {
    const columns = schemas.get(descriptor.name);
    const leftRows = normalizeRows(left[descriptor.name] || [], descriptor, columns, true);
    const rightRows = normalizeRows(right[descriptor.name] || [], descriptor, columns, false);
    const leftMap = new Map(leftRows.map((row) => [primaryKeyValue(row, descriptor), row]));
    const rightMap = new Map(rightRows.map((row) => [primaryKeyValue(row, descriptor), row]));
    const changedColumns = new Set();
    if (leftMap.size !== rightMap.size) changedColumns.add('row-count');
    for (const [key, leftRow] of leftMap) {
      const rightRow = rightMap.get(key);
      if (!rightRow) {
        changedColumns.add('row-set');
        continue;
      }
      for (const column of columns) {
        if (stableStringify(leftRow[column.name]) !== stableStringify(rightRow[column.name])) {
          changedColumns.add(column.name);
        }
      }
    }
    if (changedColumns.size) details.push(`${descriptor.name}[${[...changedColumns].sort().join('|')}]`);
  }
  return details;
}

async function readAllTarget(conn, descriptors, schemas, forUpdate = false) {
  const snapshot = {};
  for (const descriptor of descriptors) snapshot[descriptor.name] = await readTargetRows(conn, descriptor.name, descriptor.primaryKey, forUpdate);
  return snapshot;
}

async function readAllExcluded(conn) {
  const result = {};
  for (const name of EXCLUDED_TABLES) {
    const [rows] = await conn.query(`SELECT * FROM ${quoteIdentifier(name)}`);
    result[name] = sha256(stableStringify(rows));
  }
  return result;
}

function excludedEqual(before, after) {
  return EXCLUDED_TABLES.every((name) => before[name] === after[name]);
}

function printSummary(source, target, descriptors, schemas, applyMode) {
  console.log('=== Supabase -> MySQL non-user content sync ===');
  console.log(applyMode ? 'APPLY PREFLIGHT: the exact confirmation token was accepted; writes occur only after the checks below.' : 'READ ONLY: no MySQL or Supabase data was changed by this preview.');
  console.log('');
  console.log('Table                         Supabase  MySQL  add  change  remove');
  console.log('---------------------------------------------------------------');
  for (const descriptor of descriptors) {
    const s = summarizeTable(source[descriptor.name], target[descriptor.name], descriptor, schemas.get(descriptor.name));
    console.log(`${descriptor.name.padEnd(29)} ${String(s.source).padStart(8)} ${String(s.target).padStart(6)} ${String(s.insert).padStart(4)} ${String(s.update).padStart(7)} ${String(s.remove).padStart(7)}`);
  }
  console.log('');
  console.log('Excluded from sync: users, profiles, login sessions, and activity logs.');
}

async function insertRows(conn, descriptor, rows, columns) {
  if (!rows.length) return;
  const names = columns.map((column) => column.name);
  const columnSql = names.map(quoteIdentifier).join(', ');
  const rowPlaceholder = `(${names.map(() => '?').join(', ')})`;
  const chunkSize = 100;
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const values = [];
    for (const row of chunk) {
      const projected = projectRow(row, descriptor, columns);
      for (const name of names) values.push(projected[name]);
    }
    const sql = `INSERT INTO ${quoteIdentifier(descriptor.name)} (${columnSql}) VALUES ${chunk.map(() => rowPlaceholder).join(', ')}`;
    await conn.query(sql, values);
  }
}

async function applySnapshot(conn, source, descriptors, schemas) {
  for (const name of DELETE_ORDER) await conn.query(`DELETE FROM ${quoteIdentifier(name)}`);
  for (const descriptor of descriptors) await insertRows(conn, descriptor, source[descriptor.name], schemas.get(descriptor.name));
}

function parseArgs(argv) {
  const raw = argv.slice(2);
  const apply = raw.includes('--apply');
  const confirmation = raw.find((arg) => arg.startsWith('--confirm='));
  const help = raw.includes('--help') || raw.includes('-h');
  return { apply, help, confirmation: confirmation ? confirmation.slice('--confirm='.length) : null };
}

function usage() {
  console.log('Usage: node scripts/syncSupabaseContentToMysql.js --dry-run');
  console.log(`Apply: node scripts/syncSupabaseContentToMysql.js --apply --confirm=${APPLY_CONFIRMATION}`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }
  if (args.apply && args.confirmation !== APPLY_CONFIRMATION) {
    throw new SyncError('Apply confirmation token was not supplied.', `Apply is blocked. Use the exact confirmation token: ${APPLY_CONFIRMATION}`);
  }
  if (!hasSupabaseConfig()) throw new SyncError('Supabase is not configured.', 'Supabase configuration is missing.');

  const descriptors = TABLES;
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'campusphere_db',
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0,
    dateStrings: true
  });
  let conn;
  try {
    conn = await pool.getConnection();
    const schemas = new Map();
    for (const descriptor of descriptors) schemas.set(descriptor.name, await readTargetSchema(conn, descriptor.name));
    for (const descriptor of descriptors) {
      const columns = schemas.get(descriptor.name);
      if (!descriptor.primaryKey.every((key) => columns.some((column) => column.name === key))) {
        throw new SyncError(`Primary key is missing for ${descriptor.name}.`, `MySQL schema is incompatible for ${descriptor.name}.`);
      }
    }

    const sb = getSupabaseClient();
    const source = await readSourceSnapshot(sb, descriptors, schemas);
    const target = await readAllTarget(conn, descriptors, schemas);
    printSummary(source, target, descriptors, schemas, args.apply);
    const preflightSourceFingerprint = combinedFingerprint(source, descriptors, schemas, true);
    const preflightTargetFingerprint = combinedFingerprint(target, descriptors, schemas, false);
    const excludedBefore = await readAllExcluded(conn);

    if (!args.apply) {
      console.log(`Source fingerprint: ${preflightSourceFingerprint}`);
      console.log(`MySQL fingerprint:  ${preflightTargetFingerprint}`);
      console.log('Preview complete. No data was written.');
      return;
    }

    // Re-read Supabase immediately before the transaction. A changed source
    // fingerprint means an administrator edited content during the preview.
    const freshSource = await readSourceSnapshot(sb, descriptors, schemas);
    if (combinedFingerprint(freshSource, descriptors, schemas, true) !== preflightSourceFingerprint) {
      throw new SyncError('Supabase changed between preview and apply.', 'Supabase content changed during the preview; sync stopped without writing.');
    }

    await conn.beginTransaction();
    try {
      const lockedTarget = await readAllTarget(conn, descriptors, schemas, true);
      if (combinedFingerprint(lockedTarget, descriptors, schemas, false) !== preflightTargetFingerprint) {
        throw new SyncError('MySQL changed between preview and apply.', 'MySQL changed during the preview; sync stopped without writing.');
      }
      const lockedExcluded = await readAllExcluded(conn);
      if (!excludedEqual(excludedBefore, lockedExcluded)) {
        throw new SyncError('Excluded MySQL data changed before apply.', 'A protected MySQL table changed during the preview; sync stopped without writing.');
      }

      await applySnapshot(conn, freshSource, descriptors, schemas);
      const verifiedTarget = await readAllTarget(conn, descriptors, schemas, true);
      if (combinedFingerprint(verifiedTarget, descriptors, schemas, false) !== preflightSourceFingerprint) {
        const mismatches = mismatchedTables(freshSource, verifiedTarget, descriptors, schemas);
        const details = mismatchDetails(freshSource, verifiedTarget, descriptors, schemas);
        throw new SyncError(`MySQL parity verification failed inside the transaction: ${mismatches.join(',')} (${details.join(',')}).`, `The copied MySQL content did not match Supabase in ${details.join(', ')}; all changes were rolled back.`);
      }
      const verifiedExcluded = await readAllExcluded(conn);
      if (!excludedEqual(excludedBefore, verifiedExcluded)) {
        throw new SyncError('Protected MySQL data changed inside the transaction.', 'Protected MySQL data changed unexpectedly; all changes were rolled back.');
      }
      await conn.commit();
    } catch (error) {
      await conn.rollback().catch(() => {});
      throw error;
    }

    const postCommitTarget = await readAllTarget(conn, descriptors, schemas);
    const postCommitExcluded = await readAllExcluded(conn);
    if (combinedFingerprint(postCommitTarget, descriptors, schemas, false) !== preflightSourceFingerprint) {
      const mismatches = mismatchedTables(freshSource, postCommitTarget, descriptors, schemas);
      const details = mismatchDetails(freshSource, postCommitTarget, descriptors, schemas);
      throw new SyncError(`Post-commit parity verification failed: ${mismatches.join(',')} (${details.join(',')}).`, `MySQL parity failed after commit in ${details.join(', ')}. Restore the tested pre-sync backup before allowing MySQL use.`);
    }
    if (!excludedEqual(excludedBefore, postCommitExcluded)) {
      throw new SyncError('Post-commit protected-data verification failed.', 'Protected MySQL data changed after commit. Restore the tested pre-sync backup before allowing MySQL use.');
    }
    console.log('APPLY OK: MySQL non-user content now matches the Supabase snapshot.');
    console.log(`Applied source fingerprint: ${preflightSourceFingerprint}`);
    console.log('Protected MySQL tables remained unchanged.');
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

main().catch((error) => {
  const message = error instanceof SyncError ? error.publicMessage : 'Sync failed safely; no uncommitted database changes remain.';
  console.error(`SYNC FAILED: ${message}`);
  process.exitCode = 1;
});
