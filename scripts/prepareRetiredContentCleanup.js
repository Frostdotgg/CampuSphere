'use strict';

// OFFLINE ONLY: consumes a complete, privately stored snapshot. Never connects
// to a database or executes SQL. Generated files contain private post content.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const COLUMNS = Object.freeze({
  news_announcements: ['id', 'title', 'category', 'department_code', 'audience', 'excerpt', 'content', 'author_id', 'published_date', 'created_at', 'updated_at'],
  events: ['id', 'title', 'category', 'department_code', 'audience', 'event_date', 'description', 'location', 'event_time', 'created_at', 'updated_at']
});
const TABLES = Object.keys(COLUMNS);
const reasons = row => [row.department_code === 'university-wide' ? 'department' : '', row.category === 'Facilities' ? 'category' : ''].filter(Boolean);
const stable = value => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === 'object'
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const digest = value => crypto.createHash('sha256').update(stable(value)).digest('hex');

function validateBackup(backup) {
  if (backup?.format !== 'campusphere-retired-content-backup-v1' ||
      !['postgres', 'mysql'].includes(backup.target?.backend) ||
      !/^[a-zA-Z0-9_]+$/.test(backup.target.database || '') ||
      (backup.target.backend === 'postgres' && !/^[a-z0-9-]+$/.test(backup.target.projectRef || '')) ||
      !Number.isFinite(Date.parse(backup.capturedAt))) throw Error('Invalid backup identity.');
  for (const table of TABLES) {
    const rows = backup.tables?.[table];
    if (!Array.isArray(rows)) throw Error('Both complete content tables are required.');
    const seen = new Set();
    for (const row of rows) {
      if (!Number.isSafeInteger(row.id) || row.id <= 0 || seen.has(row.id) ||
          Object.keys(row).some(key => !COLUMNS[table].includes(key)) ||
          COLUMNS[table].some(key => !Object.hasOwn(row, key))) throw Error('Incomplete or unexpected backup row.');
      if (Object.values(row).some(value => value !== null && !['string', 'number'].includes(typeof value))) throw Error('Unsupported backup value.');
      seen.add(row.id);
    }
  }
  return backup;
}

function literal(value, engine) {
  if (value === null) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw Error('Invalid numeric backup value.');
    return String(value);
  }
  const hex = Buffer.from(value, 'utf8').toString('hex');
  // Hex literals avoid SQL quoting, backslash and SQL-mode ambiguities.
  if (engine === 'postgres') return `convert_from(decode('${hex}', 'hex'), 'UTF8')`;
  return hex ? `CONVERT(0x${hex} USING utf8mb4)` : "''";
}

function sqlFor(backup, engine, restore) {
  const quote = key => engine === 'postgres' ? `"${key}"` : '`' + key + '`';
  const name = table => engine === 'postgres' ? `public.${quote(table)}` : quote(table);
  const target = engine === 'postgres' ? backup.target.projectRef : backup.target.database;
  const signal = engine === 'postgres' ? "RAISE EXCEPTION 'Snapshot changed or target not confirmed';" : "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Snapshot changed or target not confirmed';";
  const guard = expression => engine === 'postgres'
    ? `IF NOT (${expression}) THEN ${signal} END IF;`
    : `IF NOT (${expression}) THEN ${signal} END IF;`;
  const sqlValue = (column, value) => {
    if (value === null) return 'NULL';
    const timestamp = ['published_date', 'created_at', 'updated_at'].includes(column);
    if (engine === 'postgres' && (timestamp || column === 'event_date')) {
      return literal(value, engine) + (timestamp ? '::timestamptz' : '::date');
    }
    if (engine === 'mysql' && timestamp) {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) throw Error('Invalid timestamp in backup.');
      return literal(date.toISOString().slice(0, 19).replace('T', ' '), engine);
    }
    return literal(value, engine);
  };
  const equal = (column, value) => {
    const col = quote(column), val = sqlValue(column, value);
    if (value === null) return `${col} IS NULL`;
    // Timestamps are compared as typed columns; text equality must remain exact.
    if (engine === 'mysql') return `BINARY ${col} <=> BINARY ${val}`;
    return `${col} IS NOT DISTINCT FROM ${val}`;
  };
  const matches = row => Object.entries(row).map(([col, value]) => equal(col, value)).join(' AND ');
  const assertTable = (table, rows) => [
    guard(`(SELECT COUNT(*) FROM ${name(table)}) = ${rows.length}`),
    ...rows.map(row => guard(`(SELECT COUNT(*) FROM ${name(table)} WHERE ${matches(row)}) = 1`))
  ].join('\n');
  const selected = Object.fromEntries(TABLES.map(table => [table, backup.tables[table].filter(row => reasons(row).length)]));
  const retained = Object.fromEntries(TABLES.map(table => [table, backup.tables[table].filter(row => !reasons(row).length)]));
  const statements = [];
  statements.push(guard(`current_database() = ${literal(backup.target.database, engine)}`));
  if (engine === 'mysql') statements[0] = guard(`DATABASE() = ${literal(backup.target.database, engine)}`);
  const review = engine === 'postgres' ? "current_setting('campusphere.cleanup_target', true)" : '@campusphere_cleanup_target';
  statements.push(guard(`COALESCE(${review}, '') = ${literal(target, engine)}`));
  for (const table of TABLES) statements.push(assertTable(table, restore ? retained[table] : backup.tables[table]));
  for (const table of TABLES) {
    if (restore) {
      for (const row of selected[table]) statements.push(`INSERT INTO ${name(table)} (${Object.keys(row).map(quote).join(',')}) VALUES (${Object.entries(row).map(([column, value]) => sqlValue(column, value)).join(',')});`);
    } else if (selected[table].length) {
      statements.push(`DELETE FROM ${name(table)} WHERE ${quote('id')} IN (${selected[table].map(row => row.id).join(',')});`);
    }
  }
  for (const table of TABLES) statements.push(assertTable(table, restore ? backup.tables[table] : retained[table]));
  const header = `-- PRIVATE generated ${restore ? 'RESTORE' : 'DELETE'}; snapshot SHA-256 ${digest(backup)}\n-- OWNER ONLY: verify target, pause all content writers, retain backup outside Git.\n-- Review and set ${engine === 'postgres' ? 'campusphere.cleanup_target' : '@campusphere_cleanup_target'} to ${target} in this connection.\n`;
  if (engine === 'postgres') return header + `BEGIN;\nLOCK TABLE public.news_announcements, public.events IN SHARE ROW EXCLUSIVE MODE;\nDO $cleanup$ BEGIN\n${statements.join('\n')}\nEND $cleanup$;\nCOMMIT;\n`;
  const procedure = `cs_retired_content_${restore ? 'restore' : 'delete'}`;
  // No DROP IF EXISTS: a previous failed helper must be inspected before retry.
  return header + `SET time_zone = '+00:00';\nDELIMITER //\nCREATE PROCEDURE ${procedure}()\nBEGIN\nDECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;\nSET TRANSACTION ISOLATION LEVEL SERIALIZABLE;\nSTART TRANSACTION;\n${statements.join('\n')}\nCOMMIT;\nEND//\nCALL ${procedure}()//\nDROP PROCEDURE ${procedure}//\nDELIMITER ;\n`;
}

function prepare(backup) {
  validateBackup(backup);
  const affected = TABLES.flatMap(table => backup.tables[table].filter(row => reasons(row).length)
    .map(row => ({table, id: row.id, title: row.title, reasons: reasons(row), rowSha256: digest(row)})));
  return {manifest: {format: 'campusphere-retired-content-plan-v1', snapshotSha256: digest(backup), capturedAt: backup.capturedAt,
    target: backup.target, counts: Object.fromEntries(TABLES.map(table => [table, {total: backup.tables[table].length, affected: affected.filter(row => row.table === table).length}])), affected},
    deleteSql: sqlFor(backup, backup.target.backend, false), restoreSql: sqlFor(backup, backup.target.backend, true)};
}

if (require.main === module) {
  try {
    const [input, destination] = process.argv.slice(2);
    if (!input || !destination) throw Error('Usage: node scripts/prepareRetiredContentCleanup.js PRIVATE_BACKUP_JSON NEW_EXTERNAL_DIRECTORY');
    const output = path.resolve(destination), repo = fs.realpathSync(path.resolve(__dirname, '..'));
    const parent = fs.realpathSync(path.dirname(output));
    const comparable = value => process.platform === 'win32' ? value.toLowerCase() : value;
    const repoKey = comparable(repo), parentKey = comparable(parent);
    if (parentKey === repoKey || parentKey.startsWith(repoKey + path.sep)) throw Error('Generated records must stay outside the repository.');
    const backup = JSON.parse(fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, ''));
    const result = prepare(backup);
    fs.mkdirSync(output, {recursive: false});
    fs.copyFileSync(input, path.join(output, 'backup.private.json'), fs.constants.COPYFILE_EXCL);
    fs.writeFileSync(path.join(output, 'affected-posts.private.json'), JSON.stringify(result.manifest, null, 2), {flag: 'wx'});
    fs.writeFileSync(path.join(output, 'DELETE-owner-review.sql'), result.deleteSql, {flag: 'wx'});
    fs.writeFileSync(path.join(output, 'RESTORE-owner-review.sql'), result.restoreSql, {flag: 'wx'});
    console.log(JSON.stringify({preparedOnly: true, executed: false, counts: result.manifest.counts, snapshotSha256: result.manifest.snapshotSha256}));
  } catch { console.error('Cleanup preparation failed. Check the backup and external destination privately; no SQL was executed.'); process.exitCode = 1; }
}
module.exports = {prepare, validateBackup, reasons, digest};
