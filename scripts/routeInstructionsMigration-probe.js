'use strict';
// Disposable engines only; no ports, shared volumes, environment files or keys.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..'), label = 'campusphere.instructions-migration-fixture';
const owned = []; let checks = 0;
const docker = (...args) => cp.execFileSync('docker', args, { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
function check(name, fn) { fn(); checks++; console.log('[PASS] ' + name); }
async function run(engine) {
  const name = 'cs-instructions-ddl-' + crypto.randomBytes(5).toString('hex');
  const args = ['run', '-d', '--name', name, '--network', 'none', '--label', label + '=true'];
  if (engine === 'mysql') docker(...args, '--tmpfs', '/var/lib/mysql:rw,size=512m', '-e', 'MYSQL_ALLOW_EMPTY_PASSWORD=yes', 'mysql:8.0');
  else docker(...args, '--user', 'postgres', '--tmpfs', '/tmp:rw,size=512m,mode=1777', '--entrypoint', 'sh', 'public.ecr.aws/supabase/postgres:17.6.1.158', '-c', "initdb -D /tmp/fixture -A trust >/tmp/init.log 2>&1 && exec postgres -D /tmp/fixture -k /tmp -c listen_addresses='' >/tmp/server.log 2>&1");
  owned.push(name);
  const query = sql => cp.execFileSync('docker', engine === 'mysql' ? ['exec', '-i', name, 'mysql', '-uroot', '--batch', '--raw', '--skip-column-names'] : ['exec', '-i', name, 'psql', '-h', '/tmp', '-U', 'postgres', '-X', '-At', '-v', 'ON_ERROR_STOP=1'], {
    input: (engine === 'mysql' ? 'USE campusphere_db;\n' : '') + sql, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe']
  }).trim();
  for (let i = 0; i < 90; i++) {
    try {
      if (engine === 'mysql') {
        if (!docker('exec', name, 'cat', '/proc/1/comm').trim().startsWith('mysqld')) throw Error('Starting');
        docker('exec', name, 'mysql', '-uroot', '-e', 'CREATE DATABASE IF NOT EXISTS campusphere_db;');
      }
      query('SELECT 1;'); break;
    } catch (_) { if (i === 89) throw Error('Disposable engine did not start'); await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  if (engine === 'postgres') query('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  query("CREATE TABLE buildings(id INT PRIMARY KEY); INSERT INTO buildings VALUES(42),(43); CREATE TABLE campus_routes(id INT PRIMARY KEY,destination_building_id INT); INSERT INTO campus_routes VALUES(7,42); CREATE TABLE campus_route_steps(route_id INT,step_order INT,instruction VARCHAR(5000)); INSERT INTO campus_route_steps VALUES(7,1,'Preserved administrator text'); CREATE TABLE route_edges(id INT PRIMARY KEY,path_geometry VARCHAR(100)); INSERT INTO route_edges VALUES(1,'preserved fixture geometry');");
  const snapshot = () => query('SELECT * FROM buildings ORDER BY id; SELECT * FROM campus_routes; SELECT * FROM campus_route_steps; SELECT * FROM route_edges;');
  const before = snapshot(), file = engine === 'mysql' ? 'database/0030_route_instruction_lists.mysql.sql' : 'database/supabase/0030_route_instruction_lists.sql';
  // Match the observed hosted defaults: client maintenance grants and server
  // ALL must not leak into the new table's final, explicit permissions.
  if (engine === 'postgres') query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES TO anon, authenticated; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;');
  const migration = fs.readFileSync(path.join(root, file), 'utf8'); query(migration);
  check(engine + ' additive migration preserves every existing fixture field', () => assert.equal(snapshot(), before));
  check(engine + ' migration begins with no populated instruction lists', () => assert.equal(query('SELECT count(*) FROM campus_route_instruction_lists;'), '0'));
  for (const [mode, direction] of [['vehicle', 'exit'], ['walking', 'entry'], ['walking', 'exit']]) {
    query(`INSERT INTO campus_route_instruction_lists(destination_building_id,mode,direction,steps) VALUES(42,'${mode}','${direction}','[{"step_order":1,"instruction":"${mode} ${direction}"}]');`);
  }
  check(engine + ' three independent new lists coexist', () => assert.equal(query('SELECT count(*) FROM campus_route_instruction_lists;'), '3'));
  const originalLists = query('SELECT destination_building_id,mode,direction,steps FROM campus_route_instruction_lists ORDER BY mode,direction;'); query(migration);
  check(engine + ' repeated migration preserves saved lists', () => assert.equal(query('SELECT destination_building_id,mode,direction,steps FROM campus_route_instruction_lists ORDER BY mode,direction;'), originalLists));
  for (const [id, mode, direction, json] of [[42, 'vehicle', 'entry', '[]'], [42, 'boat', 'exit', '[]'], [42, 'walking', 'reverse', '[]'], [999, 'walking', 'entry', '[]'], [43, 'walking', 'entry', '{}'], [43, 'walking', 'entry', JSON.stringify(Array(201).fill({ instruction: 'x' }))]]) {
    check(engine + ' rejects invalid or reserved list ' + checks, () => assert.throws(() => query(`INSERT INTO campus_route_instruction_lists(destination_building_id,mode,direction,steps) VALUES(${id},'${mode}','${direction}','${json}');`)));
  }
  check(engine + ' failed writes preserve all previous lists', () => assert.equal(query('SELECT destination_building_id,mode,direction,steps FROM campus_route_instruction_lists ORDER BY mode,direction;'), originalLists));
  query("UPDATE campus_route_instruction_lists SET steps='[]' WHERE destination_building_id=42 AND mode='walking' AND direction='exit';");
  check(engine + ' clear affects only one list', () => assert.equal(query("SELECT count(*) FROM campus_route_instruction_lists WHERE steps=" + (engine === 'mysql' ? 'JSON_ARRAY()' : "'[]'::jsonb") + ';'), '1'));
  if (engine === 'postgres') {
    check('PostgreSQL RLS is enabled', () => assert.equal(query("SELECT relrowsecurity FROM pg_class WHERE oid='public.campus_route_instruction_lists'::regclass;"), 't'));
    for (const role of ['anon', 'authenticated']) for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) check(role + ' cannot ' + privilege + ' the new table', () => assert.equal(query(`SELECT has_table_privilege('${role}','public.campus_route_instruction_lists','${privilege}');`), 'f'));
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) check('server role can ' + privilege, () => assert.equal(query(`SELECT has_table_privilege('service_role','public.campus_route_instruction_lists','${privilege}');`), 't'));
    for (const privilege of ['TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']) check('server role cannot ' + privilege, () => assert.equal(query(`SELECT has_table_privilege('service_role','public.campus_route_instruction_lists','${privilege}');`), 'f'));
  }
  check(engine + ' original route text and geometry stay unchanged after all cases', () => assert.equal(snapshot(), before));
}
async function main() {
  if (!process.argv.includes('--disposable')) throw Error('Use --disposable for owned engine fixtures.');
  try { await run('mysql'); await run('postgres'); console.log('ROUTE-INSTRUCTIONS-MIGRATION OK: ' + checks + '/' + checks + ' checks passed.'); }
  finally { for (const name of owned) { if (docker('inspect', '--format', '{{index .Config.Labels "' + label + '"}}', name).trim() !== 'true') throw Error('Fixture ownership check failed'); docker('rm', '-f', '-v', name); } }
}
if (require.main === module) main().catch(error => { console.error('ROUTE-INSTRUCTIONS-MIGRATION FAILED: ' + error.message); process.exitCode = 1; });
