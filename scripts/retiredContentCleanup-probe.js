'use strict';
// Opt-in only. SQL runs in owned disposable containers without network/volumes.
const assert = require('assert/strict');
const cp = require('child_process');
const crypto = require('crypto');
const {prepare, validateBackup} = require('./prepareRetiredContentCleanup');
const owned = [], label = 'campusphere.retired-content-fixture';
let checks = 0;
const check = (name, fn) => {fn(); checks++; console.log('[PASS] ' + name);};
const docker = (...args) => cp.execFileSync('docker', args, {encoding: 'utf8', stdio: ['pipe','pipe','pipe'], maxBuffer: 4 * 1024 * 1024});
async function boot(engine) {
  const name = 'cs-retired-content-' + engine + '-' + crypto.randomBytes(4).toString('hex');
  const base = ['run','-d','--name',name,'--network','none','--label',label+'=true'];
  if (engine === 'mysql') docker(...base,'--tmpfs','/var/lib/mysql:rw,size=512m','-e','MYSQL_ALLOW_EMPTY_PASSWORD=yes','mysql:8');
  else docker(...base,'--user','postgres','--tmpfs','/tmp:rw,size=512m,mode=1777','--entrypoint','/bin/sh','public.ecr.aws/supabase/postgres:17.6.1.158','-c',"initdb -D /tmp/cs-db -A trust >/tmp/init.log 2>&1 && exec postgres -D /tmp/cs-db -c unix_socket_directories=/tmp -c listen_addresses='' >/tmp/server.log 2>&1");
  owned.push(name);
  const query = sql => cp.execFileSync('docker', engine === 'mysql'
    ? ['exec','-i',name,'mysql','-uroot','--batch','--raw','--skip-column-names']
    : ['exec','-i','--user','postgres',name,'psql','-h','/tmp','-U','postgres','-d','postgres','-X','-At','-v','ON_ERROR_STOP=1'],
  {input: (engine === 'mysql' ? 'USE campusphere_fixture;\n' : '') + sql, encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
  for (let i = 0; i < 100; i++) {
    try {
      if (engine === 'mysql') {
        if (docker('exec',name,'cat','/proc/1/comm').trim() !== 'mysqld') throw Error('Initializing');
        docker('exec',name,'mysql','-uroot','-e','CREATE DATABASE IF NOT EXISTS campusphere_fixture;');
      }
      query('SELECT 1;'); return query;
    } catch { await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  throw Error('Disposable fixture did not become ready.');
}
function backup(engine) {
  const shared = {title:"Fixture ' \\ ; DROP TABLE users; -- Δ", category:'General',department_code:'university-wide',audience:'all',created_at:'2026-10-22T00:00:00Z',updated_at:'2026-10-22T00:00:00Z'};
  const article = { ...shared, id:1,excerpt:'Fixture excerpt',content:'Original fixture content',author_id:1,published_date:null};
  const event = {...shared,id:1,category:'Academic',event_date:'2026-11-01',description:'Fixture event',location:null,event_time:'10 AM'};
  return {format:'campusphere-retired-content-backup-v1',capturedAt:'2026-10-22T00:00:00Z',target:{backend:engine,database:engine==='mysql'?'campusphere_fixture':'postgres',projectRef:'fixture-project'},tables:{
    news_announcements:[article,{...article,id:2,department_code:'ccs',category:'Facilities'},{...article,id:3,department_code:'cas'},{...article,id:4,category:'Facilities'}],
    events:[event,{...event,id:2,department_code:'ccs'},{...event,id:3,department_code:'cas',category:'Facilities'},{...event,id:4,category:'Facilities'}]
  }};
}
async function rehearse(engine) {
  const q = await boot(engine), data = backup(engine), plan = prepare(data);
  const timestamp = engine === 'postgres' ? 'timestamptz' : 'timestamp';
  q(`CREATE TABLE users(id integer primary key, marker varchar(30)); INSERT INTO users VALUES(1,'preserve user');
CREATE TABLE audit_log(id integer primary key, marker varchar(30)); INSERT INTO audit_log VALUES(1,'preserve audit');
CREATE TABLE routes(id integer primary key, marker varchar(30)); INSERT INTO routes VALUES(1,'preserve route');
CREATE TABLE news_announcements(id integer primary key,title text,category varchar(50),department_code varchar(30),audience varchar(30),excerpt text,content text,author_id integer references users(id),published_date ${timestamp} null,created_at ${timestamp},updated_at ${timestamp});
CREATE TABLE events(id integer primary key,title text,category varchar(50),department_code varchar(30),audience varchar(30),event_date date,description text,location text,event_time varchar(100),created_at ${timestamp},updated_at ${timestamp});`);
  // Restore statements are generated with safe hex literals, including canaries.
  const allSelected = structuredClone(data);
  for (const table of Object.values(allSelected.tables)) for (const row of table) row.category='Facilities';
  const allInserts = prepare(allSelected).restoreSql.split('\n').filter(line=>line.startsWith('INSERT INTO')).join('\n');
  q(allInserts);
  for (const table of Object.keys(data.tables)) for (const row of data.tables[table]) q(`UPDATE ${table} SET category='${row.category}' WHERE id=${row.id};`);
  const count = () => q('SELECT COUNT(*) FROM news_announcements; SELECT COUNT(*) FROM events;');
  const unrelated = () => q('SELECT * FROM users; SELECT * FROM audit_log; SELECT * FROM routes; SELECT id,content FROM news_announcements WHERE id=3; SELECT * FROM events WHERE id IN (1,2) ORDER BY id;');
  const before = unrelated();
  const gate = engine === 'postgres' ? "SET campusphere.cleanup_target='fixture-project';\n" : "SET @campusphere_cleanup_target='campusphere_fixture';\n";
  const run = (sql, confirmed=true) => {
    try { return q((confirmed?gate:'')+sql); }
    finally { if(engine==='mysql')q('DROP PROCEDURE IF EXISTS cs_retired_content_delete; DROP PROCEDURE IF EXISTS cs_retired_content_restore;'); }
  };
  check(engine+' v2 policy excludes valid Campus-wide events and counts article overlap once',()=>{assert.equal(plan.manifest.format,'campusphere-retired-content-plan-v2');assert.equal(plan.manifest.policyVersion,2);assert.deepEqual(plan.manifest.affected.map(r=>[r.table,r.id]),[['news_announcements',1],['news_announcements',2],['news_announcements',4],['events',3],['events',4]]);assert.deepEqual(plan.manifest.affected.find(r=>r.table==='news_announcements'&&r.id===4).reasons,['department','category']);assert.deepEqual(plan.manifest.affected.find(r=>r.table==='events'&&r.id===4).reasons,['category']);});
  check(engine+' missing owner target fails closed',()=>assert.throws(()=>run(plan.deleteSql,false)));
  check(engine+' target failure changes no rows',()=>assert.equal(count(),'4\n4'));
  q("UPDATE news_announcements SET content='changed' WHERE id=1;");
  check(engine+' changed affected row blocks deletion',()=>assert.throws(()=>run(plan.deleteSql)));
  q("UPDATE news_announcements SET content='Original fixture content' WHERE id=1;");
  q("UPDATE news_announcements SET content='changed' WHERE id=3;");
  check(engine+' changed unrelated row blocks deletion',()=>assert.throws(()=>run(plan.deleteSql)));
  q("UPDATE news_announcements SET content='Original fixture content' WHERE id=3;");
  q("UPDATE events SET description='changed' WHERE id=1;");
  check(engine+' changed retained Campus-wide event blocks deletion',()=>assert.throws(()=>run(plan.deleteSql)));
  q("UPDATE events SET description='Fixture event' WHERE id=1;");
  q("INSERT INTO events(id,title,department_code,category) VALUES(99,'unexpected','university-wide','Academic');");
  check(engine+' unexpected new row blocks deletion',()=>assert.throws(()=>run(plan.deleteSql)));
  q('DELETE FROM events WHERE id=99;');
  run(plan.deleteSql);
  check(engine+' exact affected rows removed and Campus-wide event retained',()=>assert.equal(count(),'1\n2'));
  check(engine+' accounts audits routes and retained posts unchanged',()=>assert.equal(unrelated(),before));
  check(engine+' second deletion refuses changed snapshot',()=>assert.throws(()=>run(plan.deleteSql)));
  q("UPDATE events SET description='changed' WHERE id=2;");
  check(engine+' restore refuses changed retained post',()=>assert.throws(()=>run(plan.restoreSql)));
  q("UPDATE events SET description='Fixture event' WHERE id=2;");
  q("UPDATE events SET description='changed' WHERE id=1;");
  check(engine+' restore refuses changed retained Campus-wide event',()=>assert.throws(()=>run(plan.restoreSql)));
  q("UPDATE events SET description='Fixture event' WHERE id=1;");
  run(plan.restoreSql);
  check(engine+' restore returns original row counts',()=>assert.equal(count(),'4\n4'));
  check(engine+' restore preserves unrelated fixture state',()=>assert.equal(unrelated(),before));
  // Exact snapshot guards provide the independent equality assertion on restore.
  run(plan.deleteSql); run(plan.restoreSql);
  check(engine+' restored rows pass every original column guard',()=>assert.equal(count(),'4\n4'));
  check(engine+' UTF8 SQL canary never executes',()=>assert.equal(q('SELECT COUNT(*) FROM users;'),'1'));
}
async function main() {
  if(!process.argv.includes('--disposable'))throw Error('Use --disposable; no shared database is supported.');
  const sample=backup('postgres');
  check('malformed snapshot rejected',()=>assert.throws(()=>validateBackup({})));
  const truncated=structuredClone(sample);delete truncated.tables.events[0].description;
  check('incomplete row rejected',()=>assert.throws(()=>validateBackup(truncated)));
  const duplicate=structuredClone(sample);duplicate.tables.events.push(duplicate.tables.events[0]);
  check('duplicate ID rejected',()=>assert.throws(()=>validateBackup(duplicate)));
  try { for(const engine of ['postgres','mysql'])await rehearse(engine);console.log('RETIRED-CONTENT-CLEANUP OK: '+checks+'/'+checks); }
  finally {for(const name of owned){if(docker('inspect','--format','{{index .Config.Labels "'+label+'"}}',name).trim()!=='true')throw Error('Fixture ownership mismatch');docker('rm','-f','-v',name);}}
}
if(require.main===module)main().catch(error=>{console.error('RETIRED-CONTENT-CLEANUP FAIL: '+error.message+(error.stderr?'\n'+String(error.stderr).slice(-1600):''));process.exitCode=1;});
