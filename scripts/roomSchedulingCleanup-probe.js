'use strict';

// Explicit opt-in, disposable Docker containers only. No host ports, bind
// mounts, shared databases, environment files or existing containers are used.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),os=require('os');
const assert=require('assert/strict');
const {buildRestore,buildBackupQuery,convertedHotspot}=require('../database/maintenance/prepare-room-schedule-restore');
const ROOT=path.join(__dirname,'..');
const label='campusphere.room-scheduling-fixture';
const owned=[];let checks=0;
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'cs-schedule-rehearsal-'));
const docker=(...args)=>cp.execFileSync('docker',args,{encoding:'utf8',maxBuffer:12*1024*1024,stdio:['pipe','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function check(name,test){test();checks++;console.log('[PASS] '+name);}
async function boot(engine) {
  const name='cs-room-retirement-'+engine+'-'+crypto.randomBytes(4).toString('hex');
  const base=['run','-d','--name',name,'--network','none','--label',label+'=true'];
  if(engine==='mysql')docker(...base,'--tmpfs','/var/lib/mysql:rw,size=512m','-e','MYSQL_ALLOW_EMPTY_PASSWORD=yes','mysql:8');
  else docker(...base,'--user','postgres','--tmpfs','/tmp:rw,size=512m,mode=1777','--entrypoint','/bin/sh','public.ecr.aws/supabase/postgres:17.6.1.158','-c',
    "initdb -D /tmp/cs-db -A trust >/tmp/cs-init.log 2>&1 && exec postgres -D /tmp/cs-db -c unix_socket_directories=/tmp -c listen_addresses='' >/tmp/cs-postgres.log 2>&1");
  owned.push(name);
  function sql(text) {
    const args=engine==='mysql'?['exec','-i',name,'mysql','-uroot','--batch','--raw','--skip-column-names']:['exec','-i','--user','postgres',name,'psql','-h','/tmp','-U','postgres','-d','postgres','-X','-At','-v','ON_ERROR_STOP=1'];
    return cp.execFileSync('docker',args,{input:text,encoding:'utf8',maxBuffer:12*1024*1024,stdio:['pipe','pipe','pipe']});
  }
  for(let i=0;i<90;i++){
    try{
      // The MySQL image briefly starts a temporary initialization server.
      // Wait for PID 1 to be the final mysqld before considering it ready.
      if(engine==='mysql'&&!docker('exec',name,'cat','/proc/1/comm').trim().startsWith('mysqld'))throw new Error('initializing');
      sql('SELECT 1;');return{name,sql};
    }catch(_){}await sleep(500);
  }
  throw new Error('Disposable '+engine+' did not become ready.');
}
async function rehearse(engine) {
  const {sql}=await boot(engine);
  if(engine==='mysql')sql(fs.readFileSync(path.join(ROOT,'database/schema.sql'),'utf8'));
  else {
    sql('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
    for(const file of ['0001_initial_schema.sql','0006_admin_content_and_logs.sql','0011_supabase_session_store.sql','0012_room_schedules.sql','0013_vr_hotspot_schedule_metadata.sql','0020_room_schedule_documents.sql','0024_vr_hotspot_guest_visibility.sql','0028_walking_2d_routes.sql'])sql(fs.readFileSync(path.join(ROOT,'database/supabase',file),'utf8'));
  }
  const prefix=engine==='mysql'?'USE campusphere_db;\n':'';
  const query=text=>sql(prefix+text);
  const bool=engine==='mysql'?'1':'TRUE';
  query(`INSERT INTO users(id,username,email,password,role,first_name,last_name) VALUES(901,'fixture','fixture@example.invalid','not-a-live-password','admin','Local','Fixture');
    INSERT INTO buildings(id,name,category,description,lat,lng,details) VALUES(901,'Fixture Building','Academic','Preserved building',13.406,123.375,'{"floors":[{"label":"First Floor","rooms":[{"room":"101","name":"Room 101"}]}]}');
    INSERT INTO campus_routes(id,title,start_label,destination_building_id) VALUES(901,'Preserved route','Main Gate',901);
    INSERT INTO walking_routes(destination_building_id,path_geometry,distance_meters,walk_time_seconds) VALUES(901,'[{"lat":13.405710,"lng":123.374181},{"lat":13.4058,"lng":123.3745},{"lat":13.406,"lng":123.375}]',100,84);
    INSERT INTO vr_scenes(id,scene_key,title,building_id) VALUES(901,'scene-fixture','Preserved panorama',901);
    INSERT INTO room_schedules(id,title,schedule_date,start_time,end_time,audience,status,building_id,location_type,location_label,created_by_user_id) VALUES(901,'Retired legacy entry','2026-10-19','08:00:00','09:00:00','all','scheduled',901,'room','Room 101',901);
    INSERT INTO room_schedule_documents(id,building_id,location_type,location_label,floor_label,location_key,semester,school_year,image_url,created_by_user_id) VALUES(901,901,'room','Room 101','First Floor','${'a'.repeat(64)}','first-semester','2026-2027','https://example.invalid/schedule.png',901);
    INSERT INTO vr_hotspots(id,scene_id,hotspot_type,label,guest_visible,schedule_document_id,schedule_building_id,schedule_location_type,schedule_location_label) VALUES(901,901,'schedule','Retired schedule',${bool},901,901,'room','Room 101');
    INSERT INTO vr_hotspots(id,scene_id,hotspot_type,label,guest_visible,schedule_document_id,schedule_floor_label) VALUES(902,901,'info','Preserved information',${bool},901,'First Floor');
    INSERT INTO vr_hotspots(id,scene_id,hotspot_type,label,guest_visible) VALUES(903,901,'exit','Preserved exit',${bool});
    INSERT INTO vr_hotspots(id,scene_id,hotspot_type,label,guest_visible,schedule_location_label,schedule_floor_label,yaw,pitch,display_order) VALUES(904,901,'schedule','Old schedule prompt',${bool},'Room 202','Second Floor',45,-10,4);
    INSERT INTO vr_hotspots(id,scene_id,hotspot_type,label,guest_visible,yaw,pitch,display_order) VALUES(905,901,'schedule','Room O''Brien $cs_restore_gate$ 303',${bool},-35,10,5);
    INSERT INTO vr_hotspots(id,scene_id,hotspot_type,label,guest_visible,schedule_document_id) VALUES(906,901,'schedule','Image prompt',${bool},901);
    UPDATE vr_hotspots SET text='Old schedule image https://example.invalid/schedule.png' WHERE id IN (901,904,906);`);
  function rows(table) {
    if(engine==='postgres')return query('SELECT row_to_json(t)::text FROM (SELECT * FROM '+table+' ORDER BY 1) t;').trim().split('\n').filter(x=>x.startsWith('{')).map(JSON.parse).sort((a,b)=>Number(a.id)-Number(b.id));
    const columns=query("SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='"+table+"' ORDER BY ordinal_position;").trim().split('\n');
    return query('SELECT JSON_OBJECT('+columns.map(c=>"'"+c+"',`"+c+'`').join(',')+') FROM `'+table+'` ORDER BY 1;').trim().split('\n').filter(x=>x.startsWith('{')).map(JSON.parse).sort((a,b)=>Number(a.id)-Number(b.id));
  }
  const protectedNames=['users','buildings','campus_routes','walking_routes','vr_scenes','system_logs','app_sessions'];
  query(`INSERT INTO app_sessions(sid,sess,expires_at) VALUES('fixture-session','{"fixture":true}',9999999999999);
    INSERT INTO system_logs(event_type,action,outcome,actor_user_id,actor_role,message) VALUES('admin_mutation','fixture.preserved','success',901,'admin','Preserved audit');`);
  const protectedBefore=Object.fromEntries(protectedNames.map(t=>[t,rows(t)]));
  const snapshot=JSON.parse(query(buildBackupQuery(engine)).trim());
  const sortedRows=items=>items.slice().sort((a,b)=>Number(a.id)-Number(b.id));
  for(const table of ['room_schedules','room_schedule_documents','vr_hotspots'])snapshot[table]=sortedRows(snapshot[table]);
  check(engine+': owner backup query exports complete restore data',()=>{
    assert.equal(snapshot.engine,engine);
    assert.equal(snapshot.database,engine==='mysql'?'campusphere_db':'postgres');
    for(const table of ['room_schedules','room_schedule_documents','vr_hotspots'])assert.deepEqual(sortedRows(snapshot[table]),rows(table));
  });
  fs.writeFileSync(path.join(directory,engine+'-backup.json'),JSON.stringify(snapshot));
  const cleanup=fs.readFileSync(path.join(ROOT,'database/maintenance/remove-room-schedules.'+(engine==='mysql'?'mysql':'postgres')+'.sql'),'utf8');
  try{query(cleanup);throw new Error('unconfirmed cleanup unexpectedly succeeded');}catch(e){if(e.message==='unconfirmed cleanup unexpectedly succeeded')throw e;}
  check(engine+': missing confirmation fails before data changes',()=>{assert.deepEqual(rows('room_schedules'),snapshot.room_schedules);assert.deepEqual(rows('vr_hotspots'),snapshot.vr_hotspots);});
  const wrongTarget=engine==='mysql'?"SET @campusphere_cleanup_database='wrong_database'; SET @campusphere_cleanup_confirmation='BACKUP_VERIFIED_REMOVE_ROOM_SCHEDULES';\n":
    "SET campusphere.cleanup_database='wrong_database'; SET campusphere.cleanup_confirmation='BACKUP_VERIFIED_REMOVE_ROOM_SCHEDULES';\n";
  assert.throws(()=>query(wrongTarget+cleanup));
  check(engine+': wrong target refuses cleanup without changes',()=>{
    for(const table of ['room_schedules','room_schedule_documents','vr_hotspots'])assert.deepEqual(rows(table),sortedRows(snapshot[table]));
  });
  const confirm=engine==='mysql'?"SET @campusphere_cleanup_database='campusphere_db'; SET @campusphere_cleanup_confirmation='BACKUP_VERIFIED_REMOVE_ROOM_SCHEDULES';\n":
    "SET campusphere.cleanup_database='postgres'; SET campusphere.cleanup_confirmation='BACKUP_VERIFIED_REMOVE_ROOM_SCHEDULES';\n";
  query(confirm+cleanup);
  check(engine+': cleanup deletes both schedule formats',()=>{assert.equal(rows('room_schedules').length,0);assert.equal(rows('room_schedule_documents').length,0);});
  const kept=rows('vr_hotspots');
  check(engine+': every placed hotspot remains and schedule metadata is cleared',()=>{assert.deepEqual(kept.map(x=>Number(x.id)),[901,902,903,904,905,906]);assert(kept.every(x=>Object.entries(x).filter(([k])=>k.startsWith('schedule_')).every(([,v])=>v===null)));});
  check(engine+': document, legacy and label-only room markers become private Info',()=>{
    for(const before of snapshot.vr_hotspots.filter(h=>h.hotspot_type==='schedule'))assert.deepEqual(kept.find(h=>h.id===before.id),convertedHotspot(before,snapshot.room_schedule_documents,engine));
    assert.equal(kept.find(h=>Number(h.id)===904).label,'Room 202');
    assert.equal(kept.find(h=>Number(h.id)===905).label,"Room O'Brien $cs_restore_gate$ 303");
    assert.equal(kept.find(h=>Number(h.id)===906).text,'Room 101 - First Floor');
    assert(!JSON.stringify(kept).includes('schedule.png'));
  });
  check(engine+': ordinary hotspot labels, text, positions and Guest approvals remain',()=>{
    for(const before of snapshot.vr_hotspots.filter(h=>h.hotspot_type!=='schedule')){
      const expected={...before,...Object.fromEntries(Object.keys(before).filter(k=>k.startsWith('schedule_')).map(k=>[k,null]))};
      assert.deepEqual(kept.find(h=>h.id===before.id),expected);
    }
  });
  check(engine+': route, building, room, panorama, account, audit and session bytes preserved',()=>assert.deepEqual(Object.fromEntries(protectedNames.map(t=>[t,rows(t)])),protectedBefore));
  query(confirm+cleanup);
  check(engine+': repeated cleanup safely preserves empty state',()=>assert.equal(rows('room_schedules').length,0));
  const restore=buildRestore(snapshot);fs.writeFileSync(path.join(directory,engine+'-restore.sql'),restore);
  assert.throws(()=>query(buildRestore({...snapshot,database:'wrong_database'})));
  check(engine+': wrong target refuses restore without changes',()=>{assert.equal(rows('room_schedules').length,0);assert.deepEqual(rows('vr_hotspots'),kept);});
  query("UPDATE vr_hotspots SET label='Changed after cleanup', updated_at=updated_at WHERE id=901;");
  assert.throws(()=>query(restore));
  check(engine+': edited room marker refuses restore before schedule inserts',()=>{assert.equal(rows('room_schedules').length,0);assert.equal(rows('room_schedule_documents').length,0);assert.equal(rows('vr_hotspots')[0].label,'Changed after cleanup');});
  query("UPDATE vr_hotspots SET label='Room 101', updated_at=updated_at WHERE id=901;");
  query(restore);
  check(engine+': backed-up schedule rows and hotspot metadata restore exactly',()=>{for(const table of ['room_schedules','room_schedule_documents','vr_hotspots'])assert.deepEqual(rows(table),sortedRows(snapshot[table]));});
  check(engine+': restore preserves all unrelated data',()=>assert.deepEqual(Object.fromEntries(protectedNames.map(t=>[t,rows(t)])),protectedBefore));
  assert.throws(()=>query(restore));
  check(engine+': nonempty tables refuse repeated restore',()=>{for(const table of ['room_schedules','room_schedule_documents','vr_hotspots'])assert.deepEqual(rows(table),sortedRows(snapshot[table]));});
}
async function main(){
  if(!process.argv.includes('--disposable'))throw new Error('Use --disposable to explicitly authorize isolated Docker fixtures.');
  try {for(const engine of ['mysql','postgres'])await rehearse(engine);console.log('ROOM-SCHEDULING-CLEANUP OK: '+checks+'/'+checks);}
  finally {for(const name of owned){if(docker('inspect','--format','{{index .Config.Labels "'+label+'"}}',name).trim()!=='true')throw new Error('Container ownership check failed.');docker('rm','-f','-v',name);}}
}
if(require.main===module)main().catch(error=>{console.error('ROOM-SCHEDULING-CLEANUP FAIL: '+error.message);process.exitCode=1;});
