'use strict';

// Real application routers/controllers and EJS, fixture-only data and sessions.
// No environment file, database, production identity or external service used.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const vm = require('vm');
const express = require('express');
const ejs = require('ejs');
const policy = require('../utils/participantVisibility');
const { assertNoRetiredScheduling } = require('../utils/retiredScheduling');
const { convertedHotspot } = require('../database/maintenance/prepare-room-schedule-restore');
const ROOT = path.join(__dirname, '..');
let checks = 0;
function check(label, fn) { fn(); checks++; console.log('  [PASS] ' + label); }
function load(rel, mocks) {
  const filename = path.join(ROOT, rel), local = new Module(filename, module);
  local.filename = filename; local.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = local.require.bind(local);
  local.require = key => Object.hasOwn(mocks, key) ? mocks[key] : original(key);
  // Config helpers may import dotenv. The fixture never reads an environment
  // file, including through a transitive media/configuration helper.
  const savedLoad = Module._load;
  Module._load = function(key, ...args) {
    if (key === 'dotenv') return { config() { return { parsed: {} }; } };
    if (/(?:^|\/)config\/db(?:\.js)?$/.test(key)) return { query() { throw new Error('Fixture refused an unexpected database call.'); } };
    if (/(?:^|\/)config\/supabase(?:\.js)?$/.test(key)) return { hasSupabaseConfig: () => false, getSupabaseClient() { throw new Error('Fixture refused an unexpected service call.'); } };
    return savedLoad.call(this, key, ...args);
  };
  try { local._compile(fs.readFileSync(filename, 'utf8'), filename); }
  finally { Module._load = savedLoad; }
  return local.exports;
}
const clone = value => JSON.parse(JSON.stringify(value));
const building = { id: 1, name: 'Fixture Building', category: 'Academic', description: 'Campus fixture',
  lat: 13.406, lng: 123.375, details: { floors: [{ label: 'First Floor', rooms: [{ room: '101', name: 'Room 101', use: 'Lecture room' }] }] },
  route_available: true, route_destination_id: 1, exit_route_available: true };
const scene = { id: 1, scene_key: 'scene-guard-house', title: 'Fixture Panorama', image_url: null, initial_yaw: 0, initial_pitch: 0, display_order: 0 };
const hotspots = [
  { id: 1, scene_id: 1, hotspot_type: 'scene', label: 'Explore', target_scene_key: 'scene-room', target_scene_id: 2, guest_visible: true },
  { id: 2, scene_id: 1, hotspot_type: 'exit', label: 'Exit', guest_visible: true },
  { id: 3, scene_id: 1, hotspot_type: 'info', label: 'Approved info', guest_visible: true },
  { id: 4, scene_id: 1, hotspot_type: 'info', label: 'Private participant info', guest_visible: false, schedule_document_id: 11 },
  { id: 5, scene_id: 1, hotspot_type: 'schedule', label: 'SECRET RETIRED SCHEDULE', schedule_document_id: 11, guest_visible: true }
].map(h => ({ yaw: 0, pitch: 0, display_order: h.id, ...h }));

function makeFixtureApp(mode = 'mysql') {
  const state = { writes: 0, audits: [], errors: [], queries: [] };
  const audit = { async record(v) { state.audits.push(v); } };
  const roleAuth = load('middleware/roleAuth.js', { '../services/auditService': audit });
  const errors = load('middleware/errorHandler.js', { './roleAuth': roleAuth, '../utils/serverLog': { logServerError() { state.errors.push('server'); } } });
  const db = { async query(sql, values = []) {
    state.queries.push(sql);
    if (/^(INSERT|UPDATE)/.test(sql)) {
      assert.equal((sql.match(/\?/g) || []).length, values.length, 'SQL placeholders match values');
      assert.doesNotMatch(sql, /schedule_/); state.writes++;
      return [{ insertId: 20, affectedRows: 1 }];
    }
    if (/FROM vr_hotspots/.test(sql)) return [clone(sql.includes('WHERE h.id') ? [hotspots[0]] : hotspots)];
    if (/FROM vr_scenes/.test(sql)) return [[{ ...scene, id: values[0] || 1 }]];
    if (/FROM buildings/.test(sql)) return [[clone(building)]];
    throw new Error('Unexpected fixture SQL');
  } };
  db.getConnection = async () => ({ query: db.query.bind(db), async beginTransaction() {}, async commit() {}, async rollback() {}, release() {} });
  const vrRepo = { async sceneExists() { return true; }, async listHotspotsAdmin() { return clone(hotspots); },
    async listAllScenes() { return [scene]; }, async findSceneByKey() { return scene; }, async listHotspotsForScene() { return clone(hotspots); },
    async insertHotspot(v) { state.writes++; return { id: 20, ...v }; }, async findHotspotById() { return clone(hotspots[0]); },
    async updateHotspotById(id, v) { state.writes++; return { id, ...v }; } };
  const common = { '../config/db': db, '../repositories/vrRepository': vrRepo,
    '../config/vrDataSource': { isSupabase: () => mode === 'supabase' }, '../services/auditService': audit };
  const adminVr = load('controllers/adminVrController.js', common);
  const buildings = load('controllers/buildingsController.js', { '../config/db': db,
    '../config/mapRuntime': { isBuildingSupabase: () => mode === 'supabase' },
    '../repositories/buildingRepository': { async listAll() { return [clone(building)]; } },
    '../services/routeAvailability': { async decorateBuildings(b) { return { ok: true, buildings: b }; } } });
  const vr = load('controllers/vrController.js', { ...common, '../repositories/routeRepository': {},
    '../config/mapRuntime': {}, '../services/routeAvailability': { canonicalKey: s => s.toLowerCase() } });
  const stub = new Proxy({}, { get: () => (req, res) => res.status(501).json({ success: false }) });
  const mocks = { '../middleware/roleAuth': roleAuth, '../controllers/adminVrController': adminVr,
    '../controllers/buildingsController': buildings, '../middleware/errorHandler': errors,
    '../middleware/rateLimit': { adminMutationLimiter: (req, res, next) => next() } };
  const pageLocals = { title: 'Fixture', description: 'Local fixture', activePage: 'campus-map', buildings: [building],
    stats: { totalBuildings: 1, totalCategories: 1 }, mapBasemap: null };
  mocks['../controllers/adminController'] = new Proxy({}, { get: (_, key) => key === 'campusMap'
    ? (req, res) => res.render('admin/campus-map', pageLocals)
    : key === 'vr' ? (req, res) => res.render('admin/vr', { ...pageLocals, activePage: 'vr' }) : stub[key] });
  for (const name of ['adminUsersController','adminContentController','adminBuildingsController','adminRouteController','presenceController','walkingRouteController']) mocks['../controllers/' + name] = stub;
  // The noStore middleware is needed at router construction, not an endpoint.
  mocks['../controllers/walkingRouteController'] = new Proxy({ noStore: (req, res, next) => next() },
    { get: (target, key) => target[key] || stub[key] });
  const app = express(); app.set('view engine', 'ejs'); app.set('views', path.join(ROOT, 'views')); app.use(express.json());
  app.use((req, res, next) => {
    const cookie = String(req.headers.cookie || '').match(/(?:^|;\s*)cs_fixture_role=([a-z-]+)/);
    const role = req.get('X-Fixture-Role') || req.query.fixtureRole || (cookie && cookie[1]);
    if(req.query.fixtureRole)res.cookie('cs_fixture_role',role,{httpOnly:true,sameSite:'strict'});
    req.session = role ? { user: { id: 7, role, first_name: 'Local', last_name: 'Fixture', email: 'fixture@example.invalid' }, csrfToken: 'fixture-only' } : {};
    Object.assign(res.locals, { user: req.session.user || null, csrfToken: 'fixture-only', cspNonce: 'fixture', activeTab: 'tabBuildings',
      safeJson: value => JSON.stringify(value).replace(/</g, '\\u003c') }); next();
  });
  app.use('/admin', load('routes/admin.js', mocks));
  app.use(load('routes/buildings.js', mocks));
  app.get('/vr/:sceneKey', roleAuth.requireLogin, vr.viewer);
  app.get(['/fixture/guided','/vr/to/1'], roleAuth.requireLogin, (req, res) => res.render('vr-route', { ...pageLocals,
    activeTab: 'tabMap', scene, scenes: [scene], hotspots: policy.filterHotspotsForRole(hotspots, req.session.user) }));
  // Browser-only map/guide fixtures exercise the unchanged real client assets.
  const offline = load('services/offlineGuideService.js', {});
  const walking = load('services/walkingRouteService.js', {});
  const {calculateRouteMetrics} = require('../utils/routeGeometry');
  const geometry=[{lat:13.405710,lng:123.374181},{lat:13.4058,lng:123.3745},{lat:building.lat,lng:building.lng}];
  const walkingRow={destination_building_id:1,path_geometry:geometry,...calculateRouteMetrics(geometry)};
  const nodes=[{id:1,node_key:'main-gate',label:'Main Gate',lat:13.405, lng:123.374},
    {id:2,node_key:'fixture-building',label:building.name,node_type:'building',building_id:1,lat:building.lat,lng:building.lng}];
  const edges=[{from_node_id:1,to_node_id:2,distance_meters:150,walk_time_seconds:125,is_accessible:1,
    path_geometry:[{lat:nodes[0].lat,lng:nodes[0].lng},{lat:13.4055,lng:123.3748},geometry[2]]},
    {from_node_id:2,to_node_id:1,distance_meters:170,walk_time_seconds:142,is_accessible:1,
      path_geometry:[geometry[2],{lat:13.4056,lng:123.3742},{lat:nodes[0].lat,lng:nodes[0].lng}]}];
  const guide=offline.buildGuide({buildings:[building],nodeRows:nodes,edgeRows:edges,walkingRows:[walkingRow],walkingBuildings:[building]});
  const guidePayload={success:true,schema:offline.SCHEMA,guide,fingerprint:offline.sha256Json(guide),generatedAt:'2026-10-19T00:00:00.000Z'};
  const walkingPath=walking.shape(walkingRow,building);
  app.get('/api/offline-guide',roleAuth.requireLogin,(req,res)=>res.json(guidePayload));
  app.get('/api/walking-routes/:id',roleAuth.requireLogin,(req,res)=>res.json({success:true,route:walking.forDirection(walkingPath,building,req.query.direction||'entry')}));
  app.get('/map',roleAuth.requireLogin,(req,res)=>res.render('map',{...pageLocals,mapRenderer:'maplibre',mapBasemap:guide.basemap}));
  app.get('/api/routes',roleAuth.requireLogin,(req,res)=>res.json({success:true,routes:[]}));
  app.get('/api/search',roleAuth.requireLogin,(req,res)=>res.json({success:true,buildings:[building],routes:[]}));
  app.use(express.static(path.join(ROOT, 'public')));
  app.use(errors.notFound); app.use(errors.serverError);
  return { app, state, adminVr, buildings, vr };
}

async function run() {
  for (const role of ['admin','student-cspc','instructor','guest','unknown',null]) check('hotspot policy: ' + role, () => {
    const visible = policy.filterHotspotsForRole(hotspots, role);
    assert.equal(visible.length, ['admin','student-cspc','instructor'].includes(role) ? 4 : 3);
    assert(!visible.some(h => h.hotspot_type === 'schedule'));
    assert(!visible.some(h => Object.keys(h).some(k => k.startsWith('schedule_') || k === 'guest_visible')));
  });
  check('maintenance rejects schedule rows and stale hotspot metadata', () => {
    for (const v of [{ room_schedules: [{ id: 1 }] }, { room_schedule_documents: [{ id: 1 }] }, { hotspots }, { value: { schedule_floor_label: 'Floor 1' } }]) assert.throws(() => assertNoRetiredScheduling(v), /retired/);
    assert.doesNotThrow(() => assertNoRetiredScheduling({ room_schedules: [], hotspots: [{ hotspot_type: 'scene', schedule_document_id: null }] }));
  });
  check('converted room marker retains position and requires explicit Guest approval', () => {
    const marker=convertedHotspot(hotspots[4],[],'postgres');
    assert.equal(marker.hotspot_type,'info');assert.equal(marker.label,hotspots[4].label);
    assert.equal(marker.yaw,hotspots[4].yaw);assert.equal(marker.pitch,hotspots[4].pitch);
    for(const role of ['admin','student-cspc','instructor'])assert.equal(policy.filterHotspotsForRole([marker],role).length,1);
    assert.equal(policy.filterHotspotsForRole([marker],'guest').length,0);
    assert.equal(policy.filterHotspotsForRole([{...marker,guest_visible:true}],'guest').length,1);
  });
  {
    // Evaluate only the real marker function, never the seed program/DB setup.
    const seed=fs.readFileSync(path.join(ROOT,'database/seed.js'),'utf8');
    const first=seed.indexOf('async function upsertMarkerHotspot('),last=seed.indexOf('// Connected scenes',first);
    assert(first>0&&last>first);
    const context=vm.createContext({});
    const marker=new vm.Script('('+seed.slice(first,last).trim()+')').runInContext(context);
    await assert.rejects(()=>marker('fixture','schedule','Room 1','',0,0,0),/retired/);
    check('seed marker refuses retired type before any database access',()=>{});
  }
  for(const script of ['syncCampusVrSupabaseToMysql','syncSelectedCasVrSupabaseToMysql','syncVrMysqlToSupabase']) {
    const tool=load('scripts/'+script+'.js',{'../config/db':{},'../config/supabase':{hasSupabaseConfig:()=>false}});
    for(const side of ['source','target'])check(script+': rejects retired '+side+' before planning',()=>{
      const retired={hotspots:[{hotspot_type:'schedule',label:'Fixture'}]};
      assert.throws(()=>tool.buildPlan(side==='source'?retired:{},side==='target'?retired:{}),/retired/);
    });
  }
  {
    const tool=load('scripts/syncSupabaseContentToMysql.js',{'../config/supabase':{hasSupabaseConfig:()=>false}});
    const source=Object.fromEntries(tool.TABLES.map(t=>[t.name,[]]));
    const schemas=new Map(tool.TABLES.map(t=>[t.name,[]]));let writes=0;
    check('content sync excludes retired tables and validates a clean snapshot',()=>{
      assert(!tool.TABLES.some(t=>t.name.startsWith('room_schedule')));
      assert.doesNotThrow(()=>tool.validateRelationships(source,tool.TABLES,schemas));
    });
    await assert.rejects(()=>tool.applySnapshot({async query(){writes++;}}, {...source,vr_hotspots:[{hotspot_type:'schedule'}]},tool.TABLES,schemas),/retired/);
    check('content sync refuses stale snapshot before its first delete',()=>assert.equal(writes,0));
    await assert.rejects(()=>tool.insertRows({async query(){writes++;}},{name:'room_schedule_documents'},[{id:1}],[]),/retired/);
    check('content sync insertion boundary cannot restore retired entries',()=>assert.equal(writes,0));
  }
  check('EJS views compile after removal', () => {
    for (const rel of ['views/buildings.ejs','views/admin/campus-map.ejs','views/admin/vr.ejs','views/vr.ejs','views/vr-route.ejs']) ejs.compile(fs.readFileSync(path.join(ROOT, rel),'utf8'), { filename: path.join(ROOT,rel) });
  });
  for(const supabase of [false,true]){
    const calls=[];let refs=false,fail=false;
    const connection={async query(sql,params){calls.push({sql,params});if(fail)throw new Error('fixture failure');return[refs?[{id:1}]:[]];}};
    const sb={from(table){calls.push(table);const chain={select(){return chain;},eq(){return chain;},limit(){return Promise.resolve(fail?{error:{message:'private fixture failure'}}:{data:refs?[{id:1}]:[],error:null});}};return chain;}};
    const legacy=load('services/legacyScheduleReferences.js',{'../config/db':connection,'../config/supabase':{getSupabaseClient:()=>sb}});
    await assert.rejects(()=>legacy.hasBuildingReferences('1',{supabase,connection}));
    check('legacy guard rejects unsafe identity '+supabase,()=>{});
    const empty=await legacy.hasBuildingReferences(1,{supabase,connection});
    check('legacy guard permits cleared tables '+supabase,()=>{assert.equal(empty,false);assert.equal(calls.length,2);});
    refs=true;check('legacy guard blocks remaining references '+supabase,()=>{});
    assert.equal(await legacy.hasBuildingReferences(1,{supabase,connection}),true);
    fail=true;await assert.rejects(()=>legacy.hasBuildingReferences(1,{supabase,connection}));
    check('legacy backend failure never authorizes delete '+supabase,()=>{});
  }
  // Exercise the real Supabase repository projection/filter, not just the
  // controller's mock rows. No query can escape this in-memory adapter.
  {
    const calls=[];
    const client={from(table){let id,types;const chain={select(columns){calls.push(columns);return chain;},eq(key,value){if(key==='id')id=value;return chain;},in(key,value){assert.equal(key,'hotspot_type');types=value;return chain;},order(){return chain;},maybeSingle(){return chain;},
      then(resolve,reject){return Promise.resolve({data:id?hotspots.find(h=>h.id===id&&types.includes(h.hotspot_type))||null:hotspots.filter(h=>types.includes(h.hotspot_type)),error:null}).then(resolve,reject);}};return chain;}};
    const repo=load('repositories/vrRepository.js',{'../config/supabase':{getSupabaseClient:()=>client}});
    const rows=await repo.listHotspotsAdmin(1),retired=await repo.findHotspotById(5);
    check('Supabase repository hides retired rows and selects no schedule columns',()=>{assert.equal(rows.length,4);assert.equal(retired,null);assert(calls.every(c=>!c.includes('schedule_')));});
    await assert.rejects(()=>repo.insertHotspot({hotspot_type:'schedule'}));
    check('repository write boundary rejects retired hotspot types',()=>{});
  }
  const retirementPaths = ['/api/buildings/1/schedules','/api/buildings/1/room-schedule-documents','/api/room-schedule-documents','/api/room-schedule-documents/1',
    '/admin/api/schedules','/admin/api/schedules/1','/admin/api/room-schedule-documents','/admin/api/room-schedule-documents/1'];
  for (const mode of ['mysql','supabase']) {
    const { app, state } = makeFixtureApp(mode);
    const server = await new Promise(resolve => { const s=app.listen(0,'127.0.0.1',()=>resolve(s)); });
    const base='http://127.0.0.1:'+server.address().port;
    const request=(url,role='admin',method='GET',body,csrf='fixture-only')=>fetch(base+url,{method,redirect:'manual',
      headers:{Accept:'application/json',...(role?{'X-Fixture-Role':role}:{}),'X-CSRF-Token':csrf,'Content-Type':'application/json'},
      ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(5000)});
    try {
      for (const url of retirementPaths) for (const role of [null,'guest','student-cspc','instructor','admin']) {
        for (const method of ['GET','POST','PUT','DELETE']) {
          const r=await request(url,role,method);
          const expected=!role?401:url.startsWith('/admin')&&role!=='admin'?403:404;
          check(mode+': retired '+method+' '+url+' '+role,()=>assert.equal(r.status,expected));
          if(expected===404)assert.deepEqual(await r.json(),{success:false,message:'The requested resource was not found.'});
        }
      }
      const badCsrf=await request('/admin/api/room-schedule-documents','admin','POST',{},'wrong');
      check(mode+': retired admin write still enforces CSRF',()=>assert.equal(badCsrf.status,403));
      check(mode+': retired APIs access no data or write handler',()=>{assert.equal(state.queries.length,0);assert.equal(state.writes,0);});
      const payload={hotspot_type:'schedule',label:'Forbidden',yaw:0,pitch:0,display_order:0};
      for(const method of ['POST','PUT']) {
        const url=method==='POST'?'/admin/api/vr/scenes/1/hotspots':'/admin/api/vr/hotspots/1';
        for(const body of [payload,{...payload,hotspot_type:'info',schedule_document_id:11}]) {
          const r=await request(url,'admin',method,body);check(mode+': rejects retired hotspot '+method,()=>assert.equal(r.status,400));
        }
      }
      const r=await request('/admin/api/vr/scenes/1/hotspots');const body=await r.json();
      check(mode+': Admin hotspot list excludes schedules and metadata',()=>{assert.equal(r.status,200);assert.equal(body.hotspots.length,4);assert(!JSON.stringify(body).includes('schedule_'));});
      for(const type of ['scene','info','exit']){
        const result=await request('/admin/api/vr/scenes/1/hotspots','admin','POST',{...payload,hotspot_type:type,target_scene_id:2});
        check(mode+': supported '+type+' creation still works',()=>assert.equal(result.status,201));
      }
      const update=await request('/admin/api/vr/hotspots/1','admin','PUT',{...payload,hotspot_type:'info'});
      check(mode+': supported hotspot update still works',()=>assert.equal(update.status,200));
      for(const role of ['admin','student-cspc','instructor','guest'])for(const url of ['/buildings','/vr/scene-guard-house','/fixture/guided']){
        const r=await request(url,role);const html=await r.text();
        check(mode+': '+role+' '+url+' has no schedule feature',()=>{assert.equal(r.status,200);assert.doesNotMatch(html,/SECRET RETIRED|room-schedule-viewer|schedule_document_id|schedulePanel|View schedule/);});
        if(url==='/buildings')assert.match(html,/Room 101/);
        else assert.match(html,/Approved info/);
        for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(match[1].trim()&&!match[0].includes('application/json'))new vm.Script(match[1]);
      }
      for(const url of ['/admin/campus-map','/admin/vr']){
        const r=await request(url);const html=await r.text();
        check(mode+': editor '+url+' retains previews without scheduling',()=>{assert.equal(r.status,200);assert.doesNotMatch(html,/Room Schedule Images|id="schedule-card"|id="schedule-modal"|value="schedule"|admin-schedules.js/);assert.match(html,/schedule-image-preview/);});
      }
      check(mode+': safe audit messages contain no path or request payload',()=>assert(!JSON.stringify(state.audits).includes('Forbidden')));
    } finally { await new Promise(resolve=>server.close(resolve)); }
  }
  console.log('ROOM-SCHEDULING-REMOVAL OK: '+checks+'/'+checks);
}

if(require.main===module)run().catch(error=>{console.error('ROOM-SCHEDULING-REMOVAL FAIL: ' + error.message);process.exitCode=1;});
module.exports={run,makeFixtureApp,load};
