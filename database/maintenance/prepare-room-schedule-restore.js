'use strict';

// Offline file conversion only. Never imports database clients or environment
// configuration. Backups and generated SQL must stay outside the repository.
const fs = require('fs');
const path = require('path');
const COLUMNS = Object.freeze({
  room_schedules: 'id title schedule_date start_time end_time audience status building_id location_type location_label floor_label description created_by_user_id created_at updated_at'.split(' '),
  room_schedule_documents: 'id building_id location_type location_label floor_label location_key semester school_year image_url cloudinary_public_id created_by_user_id created_at updated_at'.split(' '),
  vr_hotspots: 'id scene_id target_scene_id hotspot_type label text guest_visible yaw pitch display_order schedule_building_id schedule_location_type schedule_location_label schedule_floor_label schedule_document_id created_at updated_at'.split(' ')
});
const META = ['schedule_building_id','schedule_location_type','schedule_location_label','schedule_floor_label','schedule_document_id'];
function convertedHotspot(row, documents, engine) {
  const document = documents.find(d => String(d.id) === String(row.schedule_document_id));
  const nonblank = value => typeof value === 'string' ? value.replace(/^ +| +$/g, '') || null : null;
  const room = nonblank(document && document.location_label) || nonblank(row.schedule_location_label);
  const floor = nonblank(document && document.floor_label) || nonblank(row.schedule_floor_label);
  return { ...row, hotspot_type: 'info', label: room || nonblank(row.label) || 'Room information',
    text: [room, floor].filter(Boolean).join(' - ') || null, guest_visible: engine === 'postgres' ? false : 0,
    target_scene_id: null, ...Object.fromEntries(META.map(key => [key, null])) };
}
function buildBackupQuery(engine) {
  if(!['mysql','postgres'].includes(engine))throw new Error('Invalid backup engine.');
  const pg=engine==='postgres';
  const pairs=["'engine'", "'"+engine+"'", "'database'", pg?'current_database()':'DATABASE()'];
  for(const [table,columns] of Object.entries(COLUMNS)){
    pairs.push("'"+table+"'");
    const row=pg?'to_jsonb(t)':'JSON_OBJECT('+columns.flatMap(c=>["'"+c+"'",'`'+c+'`']).join(',')+')';
    pairs.push(pg?"(SELECT coalesce(jsonb_agg("+row+"), '[]'::jsonb) FROM public."+table+' t)':
      '(SELECT coalesce(JSON_ARRAYAGG('+row+'),JSON_ARRAY()) FROM `'+table+'`)');
  }
  return 'SELECT '+(pg?'jsonb_build_object':'JSON_OBJECT')+'('+pairs.join(',\n  ')+') AS schedule_backup;\n';
}
function buildRestore(snapshot) {
  if (!snapshot || !['postgres','mysql'].includes(snapshot.engine) || typeof snapshot.database !== 'string' || !snapshot.database) throw new Error('Invalid backup identity.');
  const pg = snapshot.engine === 'postgres';
  const quote = name => pg ? '"'+name+'"' : '`'+name+'`';
  const literal = v => {
    if (v === null) return 'NULL';
    if (typeof v === 'boolean') return pg ? (v?'TRUE':'FALSE') : (v?'1':'0');
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    if (typeof v !== 'string') throw new Error('Invalid backup scalar.');
    return pg ? "'"+v.replace(/'/g,"''")+"'" : v.length ? 'CONVERT(0x'+Buffer.from(v,'utf8').toString('hex')+' USING utf8mb4)' : "''";
  };
  for (const [table,columns] of Object.entries(COLUMNS)) {
    if (!Array.isArray(snapshot[table])) throw new Error('Incomplete backup tables.');
    const ids = new Set();
    for (const row of snapshot[table]) {
      if (!row || !/^[1-9][0-9]*$/.test(String(row.id)) || ids.has(String(row.id)) || columns.some(k=>!Object.hasOwn(row,k)) || Object.keys(row).some(k=>!columns.includes(k))) throw new Error('Incomplete or invalid backup row.');
      if(Object.entries(row).some(([k,v])=>(k==='id'||k.endsWith('_id'))&&typeof v==='number'&&!Number.isSafeInteger(v))) throw new Error('Export large identifiers as strings.');
      ids.add(String(row.id));
    }
  }
  const lines = ['-- OWNER-REVIEWED restore; stop all writers and verify target first.', pg?'SET standard_conforming_strings = on;':'SET NAMES utf8mb4;', 'BEGIN;'];
  function pgAssert(condition, message) {
    const body = ' BEGIN IF '+condition+' THEN RAISE EXCEPTION '+literal(message)+'; END IF; END ';
    let tag = '$cs_restore_gate$';
    while(body.includes(tag)) tag = tag.slice(0,-1)+'x$';
    return 'DO '+tag+body+tag+';';
  }
  if (pg) lines.push('LOCK TABLE room_schedules, room_schedule_documents, vr_hotspots IN EXCLUSIVE MODE;',
    pgAssert(`current_database() <> ${literal(snapshot.database)} OR EXISTS (SELECT 1 FROM room_schedules) OR EXISTS (SELECT 1 FROM room_schedule_documents)`, 'Restore refused: wrong target or schedule tables not empty.'));
  else lines.push('CREATE TEMPORARY TABLE cs_restore_gate (confirmed INT NOT NULL CHECK (confirmed = 1));',
    `INSERT INTO cs_restore_gate VALUES(IF(DATABASE() = ${literal(snapshot.database)} AND (SELECT COUNT(*) FROM room_schedules) = 0 AND (SELECT COUNT(*) FROM room_schedule_documents) = 0, 1, 0));`);
  // Former schedule markers now exist as Info markers. Refuse to overwrite a
  // missing/edited marker; the owner must reconcile it before restoring.
  for (const row of snapshot.vr_hotspots.filter(h => String(h.hotspot_type).trim().toLowerCase() === 'schedule')) {
    const expected = convertedHotspot(row, snapshot.room_schedule_documents, snapshot.engine);
    const matches = COLUMNS.vr_hotspots.map(key => quote(key) + (pg ? ' IS NOT DISTINCT FROM ' : ' <=> ') + literal(expected[key])).join(' AND ');
    if (pg) lines.push(pgAssert(`NOT EXISTS (SELECT 1 FROM vr_hotspots WHERE ${matches})`, 'Restore refused: converted room marker is missing or changed.'));
    else lines.push(`INSERT INTO cs_restore_gate VALUES(IF(EXISTS (SELECT 1 FROM vr_hotspots WHERE ${matches}), 1, 0));`);
  }
  function insert(table,row) {
    const cols=COLUMNS[table];
    lines.push('INSERT INTO '+quote(table)+' ('+cols.map(quote).join(', ')+') '+
      (pg?'VALUES (':'SELECT ')+cols.map(k=>literal(row[k])).join(', ')+(pg?');':' WHERE EXISTS (SELECT 1 FROM cs_restore_gate WHERE confirmed = 1);'));
  }
  for(const table of ['room_schedules','room_schedule_documents']) for(const row of snapshot[table]) insert(table,row);
  for(const row of snapshot.vr_hotspots) {
    if(String(row.hotspot_type).trim().toLowerCase()==='schedule') lines.push('UPDATE '+quote('vr_hotspots')+' SET '+COLUMNS.vr_hotspots.filter(k=>k!=='id').map(k=>quote(k)+' = '+literal(row[k])).join(', ')+' WHERE id = '+literal(row.id)+(pg?'':' AND EXISTS (SELECT 1 FROM cs_restore_gate WHERE confirmed = 1)')+';');
    else if(META.some(k=>row[k]!==null)) lines.push('UPDATE '+quote('vr_hotspots')+' SET '+[...META,'updated_at'].map(k=>quote(k)+' = '+literal(row[k])).join(', ')+' WHERE id = '+literal(row.id)+(pg?'':' AND EXISTS (SELECT 1 FROM cs_restore_gate WHERE confirmed = 1)')+';');
  }
  lines.push('COMMIT;');
  return lines.join('\n')+'\n';
}
if(require.main===module) {
  try {
    if(process.argv[2]==='--backup-query'){process.stdout.write(buildBackupQuery(process.argv[3]));return;}
    const [input,output]=process.argv.slice(2); const root=fs.realpathSync(path.resolve(__dirname,'../..'));
    if(!input||!output||!path.isAbsolute(input)||!path.isAbsolute(output)||[input,output].some(p=>path.resolve(p).toLowerCase().startsWith(root.toLowerCase()+path.sep)||/^\.env/i.test(path.basename(p)))) throw new Error('Use absolute backup/output paths outside the repository.');
    const insideRoot=p=>p.toLowerCase()===root.toLowerCase()||p.toLowerCase().startsWith(root.toLowerCase()+path.sep);
    if(insideRoot(fs.realpathSync(input))||insideRoot(path.join(fs.realpathSync(path.dirname(output)),path.basename(output))))throw new Error('Resolved backup paths must stay outside the repository.');
    const sql=buildRestore(JSON.parse(fs.readFileSync(input,'utf8')));
    fs.writeFileSync(output,sql,{flag:'wx',mode:0o600}); console.log('Restore SQL prepared outside the repository; review before owner-controlled application.');
  }catch(_){console.error('Restore preparation refused: invalid backup, paths, or existing output.');process.exitCode=1;}
}
module.exports={buildRestore,buildBackupQuery,convertedHotspot,COLUMNS,META};
