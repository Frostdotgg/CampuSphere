'use strict';
// Complete real routers/controllers/repositories, synthetic sessions and stores.
// No environment loading, shared database or external network is permitted.
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),Module=require('module');
const ROOT=path.join(__dirname,'..');
const originalLoad=Module._load;
const blocked=()=>{throw Error('Unexpected external fixture operation');};
Module._load=function(key,...args){
  if(key==='dotenv')return {config:()=>({parsed:{}})};
  if(/(?:^|\/)config\/db(?:\.js)?$/.test(key))return {query:blocked,getConnection:blocked};
  if(/(?:^|\/)config\/supabase(?:\.js)?$/.test(key))return {getSupabaseClient:blocked,hasSupabaseConfig:()=>false};
  return originalLoad.call(this,key,...args);
};
const net=require('net'),originalConnect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){const o=args[0];const host=typeof o==='object'&&!Array.isArray(o)?o.host:undefined;if(host&&!['127.0.0.1','::1','localhost'].includes(host))throw Error('External network blocked');return originalConnect.apply(this,args);};
const express=require('express'),session=require('express-session'),bcrypt=require('bcrypt');
const departments=require('../utils/departments');
let checks=0;function check(label,fn){fn();checks++;console.log('[PASS] '+label);}
function load(rel,mocks={}){const filename=path.join(ROOT,rel),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));const actual=m.require.bind(m);m.require=key=>Object.hasOwn(mocks,key)?mocks[key]:actual(key);m._compile(fs.readFileSync(filename,'utf8'),filename);return m.exports;}
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(mode='mysql'){
 const state={tables:{users:[],news_announcements:[],events:[],student_profiles:[],instructor_profiles:[],guest_profiles:[]},audits:[],queries:[],revocations:[],writes:0,fail:false,rateChecks:0};let nextId=100;
 const password=bcrypt.hashSync('Fixture-pass-7!',4);
 for(const [i,role] of ['admin','student-cspc','instructor','guest',...departments.DEPARTMENTS.map(()=>departments.DEPARTMENT_ADMIN)].entries())state.tables.users.push({id:i+1,username:'fixture'+i,email:'fixture'+i+'@example.invalid',password,role,department_code:i>=4?departments.DEPARTMENTS[i-4].code:null,first_name:'Fixture',last_name:String(i),created_at:'2026-10-21T00:00:00Z'});
 const audit={async record(value){state.audits.push(value);}};
 const query=async(sql,args=[])=>{
  state.queries.push(sql);if(state.fail)throw Error('PRIVATE PROVIDER CANARY');
  assert.equal((sql.match(/\?/g)||[]).length,args.length,'SQL parameter count');
  if(/FROM (student|instructor|guest)_profiles/i.test(sql))return [[]];
  const table=(sql.match(/(?:FROM|INTO|UPDATE)\s+`?(users|news_announcements|events)`?/i)||[])[1];if(!table)throw Error('Unsupported fixture SQL');
  let rows=state.tables[table];
  if(/COUNT\(\*\)/i.test(sql))return [[{newThisMonth:rows.length,total:rows.length}]];
  if(/^INSERT/i.test(sql)){const cols=sql.match(/\(([^)]+)\)/)[1].split(',').map(s=>s.trim());const row={id:nextId++,created_at:new Date().toISOString(),...Object.fromEntries(cols.map((c,i)=>[c,args[i]]))};rows.push(row);state.writes++;return [{insertId:row.id}];}
  if(/^UPDATE/i.test(sql)){const row=rows.find(r=>r.id===Number(args.at(-1)));let i=0;for(const chunk of sql.split(/\bSET\b/i)[1].split(/\bWHERE\b/i)[0].split(',')){if(chunk.includes('?'))row[chunk.trim().split(/\s*=/)[0]]=args[i++];}state.writes++;return [{affectedRows:row?1:0}];}
  if(/^DELETE/i.test(sql)){state.tables[table]=rows.filter(r=>r.id!==Number(args[0]));state.writes++;return [{affectedRows:1}];}
  if(/WHERE email = \? AND id != \?/i.test(sql))rows=rows.filter(r=>r.email===args[0]&&r.id!==Number(args[1]));
  else if(/WHERE email = \?/i.test(sql))rows=rows.filter(r=>r.email===args[0]);
  else if(/WHERE id = \?/i.test(sql))rows=rows.filter(r=>r.id===Number(args[0]));
  if(/published_date IS NOT NULL/i.test(sql))rows=rows.filter(r=>r.published_date!=null);
  if(/audience = \?/i.test(sql))rows=rows.filter(r=>r.audience==='all'||args.includes(r.audience));
  const selected=(sql.match(/^SELECT\s+(.+?)\s+FROM/is)||[])[1];
  if(selected&&selected!=='*'&&!selected.includes('COUNT('))rows=rows.map(row=>Object.fromEntries(selected.split(',').map(c=>c.trim().replace(/^u\./,'')).map(c=>[c,row[c]])));
  return [clone(rows)];
 };
 const db={query,getConnection:async()=>({query,beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){}})};
 const client={from(table){let filters=[],action='select',value,columns='*',single=false,limit=Infinity;const q={select(c){columns=c;return q;},insert(v){action='insert';value=v;return q;},update(v){action='update';value=v;return q;},delete(){action='delete';return q;},eq(k,v){filters.push(r=>String(r[k])===String(v));return q;},ilike(k,v){filters.push(r=>String(r[k]).toLowerCase()===String(v).toLowerCase());return q;},in(k,v){filters.push(r=>v.includes(r[k]));return q;},not(k,op,v){filters.push(r=>r[k]!=null);return q;},order(){return q;},limit(n){limit=n;return q;},gte(){return q;},lte(){return q;},lt(){return q;},single(){single=true;return q;},maybeSingle(){single=true;return q;},then(resolve,reject){try{if(state.fail)return resolve({error:{message:'PRIVATE PROVIDER CANARY'}});let rows=state.tables[table].filter(r=>filters.every(f=>f(r)));if(action==='insert'){const row={id:nextId++,created_at:new Date().toISOString(),...clone(value)};state.tables[table].push(row);rows=[row];state.writes++;}if(action==='update'){rows.forEach(r=>Object.assign(r,clone(value)));state.writes++;}if(action==='delete'){state.tables[table]=state.tables[table].filter(r=>!rows.includes(r));state.writes++;}const out=rows.slice(0,limit).map(r=>columns==='*'?clone(r):Object.fromEntries(columns.split(',').map(k=>[k.trim(),r[k.trim()]])));return resolve({data:single?out[0]||null:out,count:out.length,error:null});}catch(e){return reject(e);}}};return q;},async rpc(name,p){if(state.fail)return {error:{message:'PRIVATE PROVIDER CANARY'}};assert.match(name,/_admin_managed_user_v2$/);const fields={username:p.p_username,email:p.p_email,role:p.p_role,first_name:p.p_first_name,last_name:p.p_last_name,department_code:p.p_department_code};if(name.includes('create')){const row={id:nextId++,password:p.p_password_hash,...fields};state.tables.users.push(row);return {data:row.id};}const row=state.tables.users.find(r=>r.id===Number(p.p_user_id));Object.assign(row,fields,p.p_password_hash?{password:p.p_password_hash}:{});return {data:null};}};
 const config={'../config/db':db,'../config/authDataSource':{isSupabase:()=>mode==='supabase'},'../config/contentDataSource':{isSupabase:()=>mode==='supabase'},'../services/auditService':audit};
 const userRepo=load('repositories/userRepository.js',{'../config/supabase':{getSupabaseClient:()=>client,hasSupabaseConfig:()=>true}});
 const contentRepo=load('repositories/contentRepository.js',{'../config/supabase':{getSupabaseClient:()=>client}});
 const store=new session.MemoryStore();
 const revoke={async revokeUserSessions(id){state.revocations.push(Number(id));const all=await new Promise((yes,no)=>store.all((e,s)=>e?no(e):yes(s)));for(const [sid,s] of Object.entries(all))if(s.user&&Number(s.user.id)===Number(id))await new Promise((yes,no)=>store.destroy(sid,e=>e?no(e):yes()));}};
 const common={...config,'../repositories/userRepository':userRepo,'../repositories/contentRepository':contentRepo,'../services/sessionRevocation':revoke};
 const role=load('middleware/roleAuth.js',{'../services/auditService':audit});
 const access=load('middleware/departmentAccess.js',{'./roleAuth':role});
 const csrf=load('middleware/csrfProtection.js',{'./roleAuth':role});
 const users=load('controllers/adminUsersController.js',common),content=load('controllers/adminContentController.js',common);
 const admin=load('controllers/adminController.js',{...common,'../services/userPresenceService':{listUserPresence:async()=>[]},'../services/adminAnalyticsService':{},'../controllers/mapController':{},'../services/routeAvailability':{},'../repositories/auditRepository':{},'../repositories/buildingRepository':{},'../config/mapRuntime':{}});
 const auth=load('controllers/authController.js',{...common,'../middleware/roleAuth':role,'../middleware/csrfProtection':csrf,'../config/sessionConfig':{clearSessionCookie:r=>r.clearCookie('fixture.sid')},'../services/userPresenceService':{touchUserPresenceBestEffort:async()=>{}}});
 const events=load('controllers/eventsController.js',common);
 const dashboard=load('controllers/dashboardController.js',{...common,'../config/mapRuntime':{isBuildingSupabase:()=>true},'../repositories/buildingRepository':{countAll:async()=>1}});
 const stub=new Proxy({},{get:()=>((_req,res)=>res.json({success:true}))});
 const routeMocks={'../middleware/roleAuth':role,'../middleware/departmentAccess':access,'../middleware/csrfProtection':csrf,'../middleware/rateLimit':{adminMutationLimiter:(_q,_r,n)=>{state.rateChecks++;n();}},'../controllers/adminUsersController':users,'../controllers/adminContentController':content,'../controllers/adminController':new Proxy(admin,{get:(target,key)=>['news','users'].includes(key)?target[key]:stub[key]})};
 for(const name of ['adminBuildingsController','adminVrController','adminRouteController','presenceController','walkingRouteController'])routeMocks['../controllers/'+name]=stub;
 const app=express();app.set('view engine','ejs');app.set('views',path.join(ROOT,'views'));app.use(express.json());app.use(express.urlencoded({extended:false}));app.use(express.static(path.join(ROOT,'public')));app.use(session({name:'fixture.sid',secret:'synthetic-department-probe-only-secret',store,resave:false,saveUninitialized:false}));
 app.use(csrf.attachCsrfToken);app.use((req,res,next)=>{Object.assign(res.locals,{user:req.session.user||null,csrfToken:req.session.csrfToken,cspNonce:'fixture',activeTab:'',departmentOptions:departments.CONTENT_DEPARTMENTS,departmentLabel:departments.departmentLabel,eventDepartmentOptions:departments.EVENT_DEPARTMENTS,eventDepartmentLabel:departments.eventDepartmentLabel,safeJson:v=>JSON.stringify(v).replace(/</g,'\\u003c')});next();});
 // These fixture-only helpers precede the real access guard and bind loopback.
 app.get('/fixture/csrf',(req,res)=>res.json({token:csrf.ensureCsrfToken(req.session)}));
 app.get('/fixture/login/:id',(req,res)=>{const u=state.tables.users.find(u=>u.id===Number(req.params.id));req.session.user={id:u.id,role:u.role,department_code:u.department_code,first_name:u.first_name,last_name:u.last_name,email:u.email};res.redirect('/admin/news');});
 app.use(access.departmentAccess);
 app.get('/auth',auth.auth);app.post('/login',csrf.verifyCsrf,auth.loginPost);app.post('/register',csrf.verifyCsrf,auth.registerPost);app.get('/auth/csrf-token',role.requireLogin,auth.csrfToken);app.post('/logout',role.requireLogin,csrf.verifyCsrf,auth.logout);app.post('/api/presence/heartbeat',role.requireLogin,csrf.verifyCsrf,(_q,r)=>r.sendStatus(204));
 app.use('/admin',load('routes/admin.js',routeMocks));app.get('/events',role.requireLogin,events.index);
 app.get('/dashboard',role.requireLogin,dashboard.index);
 app.use((_q,r)=>r.status(404).json({success:false,message:'Not found.'}));app.use((_e,_q,r,_n)=>r.status(500).json({success:false,message:'Server error.'}));
 return {app,state,store,auth,userRepo,contentRepo};
}
async function run(){
 check('event choices retain one compatible Campus-wide code first',()=>{assert.deepEqual(departments.EVENT_DEPARTMENTS.map(d=>d.code),['university-wide',...departments.DEPARTMENTS.map(d=>d.code)]);assert.equal(departments.eventDepartmentLabel('university-wide'),'Campus-wide');assert.equal(departments.isEventDepartment('campus-wide'),false);assert.equal(departments.isDepartment('university-wide'),false);});
 check('content choices contain exactly the seven departments',()=>assert.deepEqual(departments.CONTENT_DEPARTMENTS.map(d=>d.code),['graduate-school','cea','ccs','chs','cthbm','ctde','cas']));
 for(const code of ['university-wide','',undefined,'invalid'])check('retired and missing department labels are not reassigned '+String(code),()=>{assert.equal(departments.departmentLabel(code),'');assert.equal(departments.isContentDepartment(code),false);});
 // Drive the real delegated browser script with card and table-row fixtures.
 // The legacy main-admin table must not throw or hide another panel's rows.
 let changeHandler;
 require('vm').runInNewContext(fs.readFileSync(path.join(ROOT,'public/js/news-department-filter.js'),'utf8'),{
  document:{addEventListener:(event,handler)=>{assert.equal(event,'change');changeHandler=handler;}}
 });
 for(const kind of ['.news-item','tr']){
  const rows=[{hidden:false},{hidden:false}],empty={hidden:true};
  const labels=['ccs','cea'].map((department,i)=>({dataset:{department},closest:selector=>selector.split(',').includes(kind)?rows[i]:null}));
  labels.push({dataset:{department:'ccs'},closest:()=>null});
  const panel={querySelectorAll:()=>labels,querySelector:()=>empty};
  const select={value:'ccs',matches:()=>true,closest:()=>panel};
  changeHandler({target:select});
  check('browser department filter '+kind+' selects only matching rows',()=>assert.deepEqual(rows.map(r=>r.hidden),[false,true]));
  select.value='cas';changeHandler({target:select});
  check('browser department filter '+kind+' announces an empty selection',()=>{assert(rows.every(r=>r.hidden));assert.equal(empty.hidden,false);});
  select.value='all';changeHandler({target:select});
  check('browser department filter '+kind+' restores all authorized rows',()=>{assert(rows.every(r=>!r.hidden));assert.equal(empty.hidden,true);});
 }
 const dashboardSource=fs.readFileSync(path.join(ROOT,'views/dashboard.ejs'),'utf8');
 const tableTemplate=dashboardSource.split('id="tmpl-admin-news-editor"')[1].split('</script>')[0];
 check('main-admin department control is outside the news table',()=>assert(tableTemplate.indexOf('news-department-3')<tableTemplate.indexOf('<table')));
 for(const mode of ['mysql','supabase']){
  const f=fixture(mode),server=await new Promise(yes=>{const s=f.app.listen(0,'127.0.0.1',()=>yes(s));});const base='http://127.0.0.1:'+server.address().port;
  const request=async(p,{cookie='',method='GET',body,token}={})=>{const r=await fetch(base+p,{method,redirect:'manual',headers:{Accept:'application/json',...(cookie?{Cookie:cookie}:{}),...(token?{'X-CSRF-Token':token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const text=await r.text();return {status:r.status,text,body:(()=>{try{return JSON.parse(text);}catch{return null;}})(),cookie:r.headers.get('set-cookie')?.split(';')[0]||cookie,location:r.headers.get('location')};};
  const login=async(id,real=false)=>{let r=await request('/fixture/csrf');const token=r.body.token,cookie=r.cookie;const u=f.state.tables.users.find(u=>u.id===id);r=real?await request('/login',{cookie,token,method:'POST',body:{email:u.email,password:'Fixture-pass-7!'}}):await request('/fixture/login/'+id,{cookie});const jar={cookie:r.cookie};const tokenResponse=await request('/auth/csrf-token',jar);jar.token=tokenResponse.body.csrfToken;return {jar,redirect:r.location};};
  try{
   for(const id of [5,6,7,8,9,10,11]){
    const {jar,redirect}=await login(id,true);check(mode+' login/hydration '+id,()=>assert.equal(redirect,'/admin/news'));
    const page=await request('/admin/news',jar);check(mode+' editor '+id,()=>{assert.equal(page.status,200);assert(page.text.includes('news-department'));assert(!page.text.includes('href="/admin/users"'));assert(!page.text.includes('href="/admin/campus-map"'));assert(!/<option value="Events?">/.test(page.text));});
    const stamp=f.state.queries.length;
    for(const path of ['/','/home','/dashboard','/map','/vr/room','/buildings','/events','/admin','/admin/users','/admin/faqs','/admin/logs','/admin/settings','/admin/vr','/admin/campus-map','/admin/api/users/presence','/admin/api/vr/scenes','/api/notifications','/api/offline-guide','/api/routes','/api/walking-routes/1','/api/media/google-drive/file','/admin/news/extra']){const r=await request(path,jar);check(mode+' blocked '+id+' '+path,()=>assert.equal(r.status,403));}
    check(mode+' blocked before protected reads '+id,()=>assert.equal(f.state.queries.length,stamp));
    for(const path of ['/auth','/login','/register','/auth/google','/auth/callback','/auth/complete-registration']){const r=await request(path,jar);check(mode+' signed-in entry redirect '+path,()=>assert.equal(r.location,'/admin/news'));}
    const heartbeat=await request('/api/presence/heartbeat',{...jar,method:'POST'});check(mode+' heartbeat '+id,()=>assert.equal(heartbeat.status,204));
    const bad=await request('/admin/api/news',{...jar,method:'POST',token:'wrong',body:{}});check(mode+' CSRF '+id,()=>assert.equal(bad.status,403));
    const logout=await request('/logout',{...jar,method:'POST'}),after=await request('/admin/news',jar);check(mode+' logout '+id,()=>{assert.equal(logout.status,200);assert.equal(after.status,401);});
   }
   for(const id of [2,3,4]){const {jar}=await login(id);const denied=await request('/admin/news',jar);check(mode+' participant editor denial '+id,()=>assert.equal(denied.status,403));const events=await request('/events',jar);check(mode+' participant browse retained '+id,()=>assert.equal(events.status,200));}
   const anonymous=await request('/admin/news');check(mode+' anonymous editor denial',()=>assert.equal(anonymous.status,401));
   const {jar}=await login(5);
   for(const [method,url] of [['HEAD','/admin/news'],['POST','/admin/news'],['GET','/admin/api/news'],['PATCH','/admin/api/events/1'],['POST','/admin/api/users'],['PUT','/api/update-profile']]){
    const response=await request(url,{...jar,method});check(mode+' exact access method '+method+' '+url,()=>assert.equal(response.status,method==='HEAD'?200:403));
   }
   const assigned=f.state.tables.users.find(u=>u.id===6);assigned.department_code=null;
   const malformed=await request('/fixture/login/6');const malformedPage=await request('/admin/news',{cookie:malformed.cookie});
   check(mode+' missing department fails closed',()=>assert.equal(malformedPage.status,403));assigned.department_code='cea';
   for(const role of ['all','student-cspc','instructor','guest','admin']){
    f.state.tables.news_announcements.push({id:900+f.state.tables.news_announcements.length,title:'AUDIENCE-'+role,category:'General',department_code:'ccs',audience:role,excerpt:'Visible fixture',published_date:'2026-10-21T00:00:00Z'});
    f.state.tables.events.push({id:900+f.state.tables.events.length,title:'AUDIENCE-'+role,category:'Academic',department_code:'cas',audience:role,event_date:'2026-11-01'});
   }
   f.state.tables.news_announcements.push({id:999,title:'DRAFT-PRIVATE-CANARY',category:'General',department_code:'ccs',audience:'all',excerpt:'Draft',published_date:null});
   for(const [id,role] of [[2,'student-cspc'],[3,'instructor'],[4,'guest']]){
    const {jar:reader}=await login(id);const page=await request('/dashboard',reader),eventsPage=await request('/events',reader);
    const match=page.text.match(/id="dbNewsData"[^>]*>([\s\S]*?)<\/script>/);const rows=match?JSON.parse(match[1]):[];
    check(mode+' participant audience and draft privacy '+role,()=>{assert.equal(page.status,200);assert.equal(rows.length,2);assert(rows.every(r=>['all',role].includes(r.audience)));assert(!page.text.includes('DRAFT-PRIVATE-CANARY'));assert(page.text.includes('data-news-department-filter'));});
    const eventMatch=eventsPage.text.match(/id="eventsData"[^>]*>([\s\S]*?)<\/script>/);const eventRows=eventMatch?JSON.parse(eventMatch[1]):[];
    check(mode+' participant events keep audience filtering '+role,()=>{assert.equal(eventRows.length,2);assert(eventRows.some(r=>r.department_code==='cas'));assert(eventsPage.text.includes('events-department'));});
   }
   for(const roleId of [null,2,3,4]){
    const actor=roleId?(await login(roleId)).jar:{};const before=f.state.writes;
    for(const type of ['news','events'])for(const method of ['POST','PUT','DELETE']){const response=await request('/admin/api/'+type+(method==='POST'?'':'/1'),{...actor,method,body:method==='DELETE'?undefined:{}});check(mode+' API role denial '+roleId+'/'+type+'/'+method,()=>assert.equal(response.status,roleId?403:401));}
    check(mode+' role denial performs no writes '+roleId,()=>assert.equal(f.state.writes,before));
   }
   for(const code of departments.CONTENT_DEPARTMENTS.map(d=>d.code)){
    for(const type of ['news','events']){
     const payload=type==='news'?{title:'Fixture '+code,category:'General',excerpt:'Fixture text',content:'Content',status:'draft',audience:'guest',department_code:code}:{title:'Fixture '+code,category:'Academic',event_date:'2026-11-01',description:'Event text',audience:'student-cspc',department_code:code};
     const created=await request('/admin/api/'+type,{...jar,method:'POST',body:payload});const key=type==='news'?'article':'event',id=created.body?.[key]?.id;
     check(mode+' create '+type+' '+code,()=>{assert.equal(created.status,201,created.text);assert.equal(created.body[key].department_code,code);});
     const updated=await request('/admin/api/'+type+'/'+id,{...jar,method:'PUT',body:{...payload,title:'Updated',department_code:'cas'}});check(mode+' cross-department update '+type+' '+code,()=>{assert.equal(updated.status,200);assert.equal(updated.body[key].department_code,'cas');if(type==='news')assert.equal(updated.body.article.published_date,null);});
     const page=await request('/admin/news',jar);check(mode+' reload '+type+' '+code,()=>assert(page.text.includes('"department_code":"cas"')));
     const removed=await request('/admin/api/'+type+'/'+id,{...jar,method:'DELETE'});check(mode+' delete '+type+' '+code,()=>assert.equal(removed.status,200));
    }
   }
   for(const type of ['news','events'])for(const code of [undefined,'',...(type==='news'?['university-wide']:[]),'campus-wide','unknown',null,{},['ccs'],'CCS','university-wide<script>']){const before=f.state.writes;for(const method of ['POST','PUT']){const r=await request('/admin/api/'+type+(method==='PUT'?'/1':''),{...jar,method,body:{title:'Fixture',department_code:code,...(type==='news'?{category:'General',excerpt:'Text'}:{category:'Academic',event_date:'2026-11-01'})}});check(mode+' invalid department '+type+'/'+method+'/'+String(code),()=>{assert.equal(r.status,400);assert.equal(f.state.writes,before);});}}
   for(const category of ['Event','Events','Facilities'])for(const method of ['POST','PUT']){const before=f.state.writes;const r=await request('/admin/api/news'+(method==='PUT'?'/1':''),{...jar,method,body:{title:'Old',category,excerpt:'Text',department_code:'ccs'}});check(mode+' retired article category '+category+'/'+method,()=>{assert.equal(r.status,400);assert.equal(f.state.writes,before);});}
   for(const method of ['POST','PUT']){const r=await request('/admin/api/events'+(method==='PUT'?'/1':''),{...jar,method,body:{title:'Old event',category:'Facilities',event_date:'2026-11-01',department_code:'ccs'}});check(mode+' retired event category/'+method,()=>assert.equal(r.status,400));}
   const escalation=await request('/admin/api/users',{...jar,method:'POST',body:{role:'admin'}});check(mode+' no account escalation',()=>assert.equal(escalation.status,403));
   f.state.fail=true;const failed=await request('/admin/api/events',{...jar,method:'POST',body:{title:'Failure',category:'Academic',event_date:'2026-11-01',department_code:'ccs'}});check(mode+' sanitized provider failure',()=>{assert.equal(failed.status,500);assert(!failed.text.includes('PRIVATE'));});f.state.fail=false;
   const {jar:admin}=await login(1);
   const anonymousSession=await request('/fixture/csrf'),beforeRegistration=f.state.tables.users.length;
   const registration=await request('/register',{cookie:anonymousSession.cookie,token:anonymousSession.body.token,method:'POST',body:{fullName:'Synthetic Department',email:'synthetic-department@example.invalid',password:'Fixture-pass-7!',role:'department-admin',department_code:'ccs'}});
   check(mode+' public registration cannot create department administrators',()=>{assert.equal(f.state.tables.users.length,beforeRegistration);assert(registration.text.includes('guest account only'));});
   const legacy={id:9999,title:'Legacy preserved',category:'Events',department_code:'university-wide',audience:'all',excerpt:'Legacy',content:'Legacy text',author_id:2,published_date:'2026-10-20T00:00:00Z'};f.state.tables.news_announcements.push(legacy);
   const invalidLegacy=await request('/admin/api/news/9999',{...jar,method:'PUT',body:{title:legacy.title,category:'Events',excerpt:'Legacy'}});
   check(mode+' legacy Event category must be changed on edit',()=>assert.equal(invalidLegacy.status,400));
   const legacyRead=await request('/admin/news',jar);check(mode+' legacy content readable without retired choices',()=>{assert(legacyRead.text.includes('Legacy preserved'));assert(!legacyRead.text.match(/<select id="news-department"[\s\S]*?<\/select>/)[0].includes('university-wide'));assert(!legacyRead.text.includes('<option value="Facilities">'));});
   const savedLegacy=await request('/admin/api/news/9999',{...jar,method:'PUT',body:{title:legacy.title,category:'Academic',excerpt:'Legacy',content:'Legacy text',status:'published',department_code:'ccs'}});
   check(mode+' legacy edit retains content author and publication',()=>{assert.equal(savedLegacy.status,200);assert.equal(savedLegacy.body.article.department_code,'ccs');assert.equal(savedLegacy.body.article.author_id,2);assert.equal(new Date(savedLegacy.body.article.published_date).toISOString(),'2026-10-20T00:00:00.000Z');assert.equal(savedLegacy.body.article.content,'Legacy text');});
   const mainEditor=await request('/admin/news',admin);check(mode+' main admin explicitly selects department',()=>{assert(mainEditor.text.includes('"defaultCode":""'));assert(mainEditor.text.includes('value="">Select department...'));});
   const selectHtml=(html,id)=>html.match(new RegExp('<select id="'+id+'"[\\s\\S]*?</select>'))[0];
   for(const [actor,actorName] of [[admin,'admin'],[jar,'department-admin']]){
    const page=await request('/admin/news',actor);
    check(mode+' event-only form choices '+actorName,()=>{
     assert(selectHtml(page.text,'event-department').includes('<option value="university-wide">Campus-wide</option>'));
     assert(!selectHtml(page.text,'news-department').includes('university-wide'));
     assert(!selectHtml(page.text,'department-filter').includes('university-wide'));
     assert(!page.text.includes('<option value="Facilities">'));
    });
    for(const code of departments.EVENT_DEPARTMENTS.map(d=>d.code)){
     const payload={title:'CAMPUS-FIXTURE '+actorName+' '+code,category:'Academic',department_code:code,audience:'admin',event_date:'2026-11-01',description:'Private event canary'};
     const made=await request('/admin/api/events',{...actor,method:'POST',body:payload}),id=made.body?.event?.id;
     check(mode+' eight-choice event create '+actorName+'/'+code,()=>{assert.equal(made.status,201,made.text);assert.equal(made.body.event.department_code,code);assert.equal(made.body.event.audience,'admin');});
     const before=JSON.stringify(f.state.tables.events.find(e=>e.id===id)),writeCount=f.state.writes;
     const reloaded=await request('/admin/news',actor);
     check(mode+' event reload never rewrites '+actorName+'/'+code,()=>{assert.equal(reloaded.status,200);assert(reloaded.text.includes(payload.title));assert.equal(f.state.writes,writeCount);assert.equal(JSON.stringify(f.state.tables.events.find(e=>e.id===id)),before);});
     for(const readerId of [2,3,4]){
      const {jar:reader}=await login(readerId),visible=await request('/events',reader);
      check(mode+' Campus-wide does not widen private audience '+actorName+'/'+code+'/'+readerId,()=>assert(!visible.text.includes(payload.title)));
     }
     const changed=await request('/admin/api/events/'+id,{...actor,method:'PUT',body:{...payload,department_code:code==='university-wide'?'cas':'university-wide'}});
     check(mode+' event department update '+actorName+'/'+code,()=>{assert.equal(changed.status,200,changed.text);assert.equal(changed.body.event.department_code,code==='university-wide'?'cas':'university-wide');assert.equal(changed.body.event.audience,'admin');});
     const removed=await request('/admin/api/events/'+id,{...actor,method:'DELETE'});
     check(mode+' event delete '+actorName+'/'+code,()=>{assert.equal(removed.status,200);assert(!f.state.tables.events.some(e=>e.id===id));});
    }
   }
   const oldEvent={id:8888,title:'EXISTING-CAMPUS-EVENT',category:'Cultural',department_code:'university-wide',audience:'all',event_date:'2026-11-01',description:'Original event text'};
   f.state.tables.events.push(oldEvent);
   const oldBytes=JSON.stringify(oldEvent),beforeReads=f.state.writes;
   for(const readerId of [1,2,3,4]){
    const reader=readerId===1?admin:(await login(readerId)).jar,page=await request('/events',reader);
    check(mode+' existing event Campus-wide label/filter '+readerId,()=>{const data=JSON.parse(page.text.match(/id="eventsData"[^>]*>([\s\S]*?)<\/script>/)[1]);assert.equal(data.find(e=>e.id===8888).department_label,'Campus-wide');assert(selectHtml(page.text,'events-department').includes('value="university-wide">Campus-wide'));assert(selectHtml(page.text,'events-department').includes('All departments'));});
   }
   check(mode+' old event read-only preservation',()=>{assert.equal(JSON.stringify(oldEvent),oldBytes);assert.equal(f.state.writes,beforeReads);});
   const missingCsrf=await request('/admin/api/events',{...jar,method:'POST',token:'wrong',body:{title:'CSRF',category:'Academic',event_date:'2026-11-01',department_code:'university-wide'}});
   check(mode+' Campus-wide CSRF unchanged',()=>{assert.equal(missingCsrf.status,403);assert.equal(f.state.writes,beforeReads);});
   for(const name of ['createAnnouncement','createEvent'])for(const code of [undefined,...(name==='createAnnouncement'?['university-wide']:[]),'campus-wide']){await assert.rejects(()=>f.contentRepo[name]({department_code:code}),/Invalid department/);check(mode+' repository prevents default department '+name+'/'+String(code),()=>{});}
   for(const name of ['updateAnnouncement','updateEvent']){await assert.rejects(()=>f.contentRepo[name](9999,{department_code:name==='updateEvent'?'campus-wide':'university-wide'}),/Invalid department/);check(mode+' repository rejects retired update department '+name,()=>{});const result=await f.contentRepo[name](-1,{department_code:'university-wide'});check(mode+' repository retains invalid-ID null result '+name,()=>assert.equal(result,null));}
   for(const code of departments.DEPARTMENTS.map(d=>d.code)){
    const payload={first_name:'Department',last_name:'Fixture',email:code+'@example.invalid',password:'Fixture-pass-7!',role:'department-admin',department_code:code};
    const created=await request('/admin/api/users',{...admin,method:'POST',body:payload});check(mode+' main admin creates '+code,()=>{assert.equal(created.status,201,created.text);assert.equal(created.body.user.department_code,code);assert(!('password'in created.body.user));});
    const id=created.body.user.id;const signed=await login(id,true);
    const changed=await request('/admin/api/users/'+id,{...admin,method:'PUT',body:{...payload,password:'',department_code:code==='cas'?'ccs':'cas'}});check(mode+' department change revokes '+code,()=>{assert.equal(changed.status,200,changed.text);assert(f.state.revocations.includes(id));});
    const stale=await request('/admin/news',signed.jar);check(mode+' stale session denied '+code,()=>assert.equal(stale.status,401));
   }
   for(const payload of [{role:'department-admin'},{role:'department-admin',department_code:'university-wide'},{role:'department-admin',department_code:'campus-wide'},{role:'admin',department_code:'ccs'}]){const r=await request('/admin/api/users',{...admin,method:'POST',body:{first_name:'Invalid',last_name:'Fixture',email:'bad@example.invalid',password:'Fixture-pass-7!',...payload}});check(mode+' rejects invalid role/department pair',()=>assert.equal(r.status,400));}
   const account=f.state.tables.users.find(u=>u.email==='ccs@example.invalid');
   const passwordSession=await login(account.id,true);
   const userFields={first_name:account.first_name,last_name:account.last_name,email:account.email,role:account.role,department_code:account.department_code};
   for(const code of ['university-wide','campus-wide']){const changed=await request('/admin/api/users/'+account.id,{...admin,method:'PUT',body:{...userFields,department_code:code,password:''}});check(mode+' forged Campus-wide account update rejected '+code,()=>assert.equal(changed.status,400));}
   const passwordUpdate=await request('/admin/api/users/'+account.id,{...admin,method:'PUT',body:{...userFields,password:'Changed-fixture-pass-8!'}});
   check(mode+' password change revokes department session',()=>{assert.equal(passwordUpdate.status,200);assert(f.state.revocations.includes(account.id));});
   const oldPasswordSession=await request('/admin/news',passwordSession.jar);
   check(mode+' old password session cannot reach editor',()=>assert.equal(oldPasswordSession.status,401));
   const roleSession=await login(account.id);
   const roleUpdate=await request('/admin/api/users/'+account.id,{...admin,method:'PUT',body:{...userFields,role:'guest',department_code:null,password:''}});
   check(mode+' role change clears department and revokes session',()=>{assert.equal(roleUpdate.status,200);assert.equal(roleUpdate.body.user.role,'guest');assert.equal(roleUpdate.body.user.department_code,null);});
   const oldRoleSession=await request('/admin/news',roleSession.jar);
   check(mode+' old role session cannot reach editor',()=>assert.equal(oldRoleSession.status,401));
   const deniedPages=['/admin/users','/admin/faqs','/admin/logs','/admin/settings','/admin/vr','/admin/campus-map'];for(const p of deniedPages){const response=await request(p,admin);check(mode+' full admin retains '+p,()=>assert.equal(response.status,200));}
   check(mode+' fixed mutation audit/privacy',()=>{assert(f.state.audits.some(a=>a.actor_role==='department-admin'&&a.action==='admin.news.create'));assert(f.state.audits.filter(a=>a.event_type==='admin_mutation').every(a=>!['Fixture text','Private event canary','CAMPUS-FIXTURE'].some(canary=>JSON.stringify(a).includes(canary))));});
  }finally{await new Promise(r=>storeClear(f.store,r));await new Promise(r=>server.close(r));}
 }
 console.log('DEPARTMENT-NEWS-ADMIN OK: '+checks+'/'+checks);
}
function storeClear(store,done){store.clear(done);}
module.exports={fixture,load};
if(require.main===module)run().catch(e=>{console.error('DEPARTMENT-NEWS-ADMIN FAIL: '+e.stack);process.exitCode=1;});
