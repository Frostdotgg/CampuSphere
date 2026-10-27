'use strict';
// Real EJS, the real CSP-safe client renderer, and both isolated repository
// adapters. No environment files, shared credentials or shared stores.
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..');
const {fixture}=require('./departmentNewsAdmin-probe');
let checks=0;
const check=(label,fn)=>{fn();checks++;console.log('[PASS] '+label);};
function renderReader(page,templateId,mutate=x=>x){
 const json=page.match(/id="dbNewsData"[^>]*>([\s\S]*?)<\/script>/);assert.ok(json);
 const inline=[...page.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('function escapeHtml(value)'));
 assert.ok(inline);
 const preparation=inline.slice(inline.indexOf('function escapeHtml(value)'),inline.indexOf('// Sanitize any DB-derived profile'));
 const engine=inline.slice(inline.indexOf('var TPL_OPEN'),inline.indexOf('// ======= TEMPLATE MAPPING'));
 assert.ok(engine.includes('function ejsRender'));
 const template=page.slice(page.indexOf('id="'+templateId+'"')).split('</script>')[0].split('>').slice(1).join('>');
 const context={CampuSphereData:{news:[]},document:{getElementById:id=>id==='dbNewsData'?{textContent:json[1]}:null},Date,console};
 vm.createContext(context);vm.runInContext(mutate(preparation)+engine,context,{timeout:1000});
 context.template=mutate(template);vm.runInContext('result=ejsRender(template,CampuSphereData);',context,{timeout:1000});
 return {html:context.result,rows:JSON.parse(JSON.stringify(context.CampuSphereData.news))};
}
function assertBody(result,expected){assert.ok(result.html.includes(expected),'Full saved content must reach the rendered reader');}

// Run the complete, served dashboard bootstrap rather than rendering a chosen
// template directly. The old bug selected the right section but displayed a
// different template, so assertions must inspect the actual content and sidebar.
function renderDashboardStartup(page, href, options = {}) {
 const scripts = [...page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
 const byId = new Map(scripts.map(([, attrs, text]) => [attrs.match(/\bid="([^"]+)"/)?.[1], text]));
 const source = scripts.map(m => m[2]).find(s => s.includes('function escapeHtml(value)'));
 assert.ok(source, 'The served dashboard initialization script must exist');
 const nodes = new Map();
 function node(id) {
  const classes = new Set(), attrs = {}, listeners = {};
  return { id, style: {}, dataset: {}, textContent: '', innerHTML: '',
   classList: { add: x => classes.add(x), remove: x => classes.delete(x),
    toggle(x, force) { const value = force === undefined ? !classes.has(x) : force; value ? classes.add(x) : classes.delete(x); }, contains: x => classes.has(x) },
   setAttribute: (k,v) => { attrs[k] = String(v); }, getAttribute: k => attrs[k] ?? null,
   removeAttribute: k => { delete attrs[k]; }, contains: () => false,
   addEventListener: (name,fn) => { listeners[name] = fn; },
   querySelectorAll(selector) {
    if (selector !== '.sidebar__nav-item') return [];
    return [...this.innerHTML.matchAll(/<button[^>]*data-section="([^"]+)"/g)].map(m => ({ dataset: { section: m[1] }, addEventListener() {} }));
   }
  };
 }
 for (const id of ['roleTitle','roleBadge','sidebarNav','contentContainer','panelGreeting','panelRoleLabel','sidebarName','sidebarEmail','navUsername','sidebar','sidebarToggle','dashNav','themeToggle']) nodes.set(id,node(id));
 const document = { documentElement: node('html'), addEventListener() {},
  getElementById(id) { if (byId.has(id)) return { textContent: byId.get(id) }; return nodes.get(id) || null; }
 };
 const storage = new Map([['campusphere-role', options.storedRole || 'guest']]);
 const context = { document, location: new URL(href,'http://127.0.0.1'), URLSearchParams, Date, console,
  innerWidth: 1366, scrollY: 0, addEventListener() {},
  localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v) },
  fetch() { throw Error('Unexpected dashboard network operation in startup fixture'); },
  setTimeout() { throw Error('Unexpected dashboard timer in startup fixture'); },
  __SESSION_USER: JSON.parse(byId.get('sessionData'))
 };
 context.window = context;
 vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(ROOT,'public/js/data.js'),'utf8'),context,{timeout:1000});
 vm.runInContext((options.mutate || (s=>s))(source),context,{timeout:1000});
 return {
  state() { return { role: context.currentRole, section: context.currentSection,
   html: nodes.get('contentContainer').innerHTML, sidebar: nodes.get('sidebarNav').innerHTML }; },
  switchSection(section) { context.switchSection(section); return this.state(); },
  switchRole(role) { context.switchRole(role); return this.state(); }
 };
}
function assertStartup(result, role, section, text) {
 const actual = result.state ? result.state() : result;
 assert.equal(actual.role,role); assert.equal(actual.section,section);
 assert.ok(actual.html.includes(text),'Requested section must actually render its expected content');
 assert.match(actual.sidebar,new RegExp('sidebar__nav-item--active[^>]*data-section="'+section+'"'));
}
async function run(){
 const listeners={};vm.runInNewContext(fs.readFileSync(path.join(ROOT,'public/js/news-department-filter.js'),'utf8'),{document:{addEventListener:(name,fn,capture)=>{listeners[name]={fn,capture};}}});
 const disclosures=[{open:true},{open:true}],previews=[{hidden:false},{hidden:false}],count={textContent:''},empty={hidden:true};
 const rows=disclosures.map((d,i)=>({hidden:false,querySelectorAll:()=>[d],querySelector:()=>previews[i]}));
 const labels=rows.map((r,i)=>({dataset:{department:i?'cas':'ccs'},closest:()=>r}));
 const panel={querySelectorAll:()=>labels,querySelector:s=>s==='[data-news-result-count]'?count:empty};
 const select={value:'ccs',matches:()=>true,closest:()=>panel};
 listeners.change.fn({target:select});
 check('filter closes only hidden readers and reports one result',()=>{assert.equal(disclosures[0].open,true);assert.equal(disclosures[1].open,false);assert.equal(count.textContent,'1 announcement');assert.equal(rows[1].hidden,true);});
 select.value='ctde';listeners.change.fn({target:select});check('filtered empty status and count',()=>{assert.equal(empty.hidden,false);assert.equal(count.textContent,'0 announcements');});
 select.value='all';listeners.change.fn({target:select});check('all departments restores rows without reopening them',()=>{assert.ok(rows.every(r=>!r.hidden));assert.ok(disclosures.every(d=>!d.open));assert.equal(count.textContent,'2 announcements');});
 const detail={matches:()=>true,open:true,closest:()=>rows[0]};listeners.toggle.fn({target:detail});check('native toggle capture hides the preview while reading',()=>{assert.equal(listeners.toggle.capture,true);assert.equal(previews[0].hidden,true);});
 detail.open=false;listeners.toggle.fn({target:detail});check('collapse restores preview',()=>assert.equal(previews[0].hidden,false));
 const partial=fs.readFileSync(path.join(ROOT,'views/partials/dashboard-announcements.ejs'),'utf8'),css=fs.readFileSync(path.join(ROOT,'public/css/dashboard-news.css'),'utf8');
 check('native disclosures and labels use escaped output',()=>{assert.ok(partial.includes('<details'));assert.ok(partial.includes('Read announcement')&&partial.includes('Show less'));assert.ok(partial.includes('<%%= news[i].bodyText %%>'));assert.ok(!partial.includes('<%%- news[i].bodyText'));});
 check('reader is scoped, wrapping and free of nested body scrolling',()=>{assert.ok(css.includes('white-space: pre-wrap')&&css.includes('overflow-wrap: anywhere'));assert.ok(!/\.dashboard-news__body\s*\{[^}]*overflow\s*:\s*(?:auto|scroll)/.test(css));assert.ok(css.includes('min-height: 44px')&&css.includes('prefers-reduced-motion'));});
 for(const mode of ['mysql','supabase']){
  const f=fixture(mode),viewArg=process.argv.find(x=>x.startsWith('--baseline-views='));if(viewArg)f.app.set('views',path.join(viewArg.slice('--baseline-views='.length),'views'));
  const server=await new Promise(resolve=>{const s=f.app.listen(0,'127.0.0.1',()=>resolve(s));});const base='http://127.0.0.1:'+server.address().port;
  const request=async(p,jar={},method='GET',body)=>{const r=await fetch(base+p,{method,redirect:'manual',headers:{...(jar.cookie?{Cookie:jar.cookie}:{}),...(jar.token?{'X-CSRF-Token':jar.token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const text=await r.text();return{status:r.status,text,cookie:r.headers.get('set-cookie')?.split(';')[0]||jar.cookie,body:(()=>{try{return JSON.parse(text);}catch{return null;}})()};};
  const login=async id=>{const first=await request('/fixture/login/'+id);const jar={cookie:first.cookie};const csrf=await request('/auth/csrf-token',jar);jar.token=csrf.body.csrfToken;return jar;};
  try{
   const admin=await login(1),original={title:'Complete published announcement',category:'General',department_code:'ccs',audience:'all',status:'published',excerpt:'SHORT-EXCERPT-ONLY',content:'First paragraph.\n\nSecond paragraph — café ✓.\nFULL-BODY-END'};
   const created=await request('/admin/api/news',admin,'POST',original);check(mode+' real admin create persists distinct content',()=>{assert.equal(created.status,201);assert.equal(created.body.article.content,original.content);});
   const id=created.body.article.id;
   for(const [role,readerId,template]of [['student-cspc',2,'tmpl-shared-news'],['instructor',3,'tmpl-instructor-announcements']]){
    const reader=await login(readerId),page=await request('/dashboard',reader),rendered=renderReader(page.text,template);
    const feed=await request('/api/notifications',reader),href=feed.body.links.announcements;
    const linked=await request(href,reader),section=role==='instructor'?'announcements':'news';
    check(mode+' '+role+' bell link renders the reader on initial navigation',()=>{
     assert.equal(linked.status,200);assertStartup(renderDashboardStartup(linked.text,href,{storedRole:'guest'}),role,section,'FULL-BODY-END');
    });
    const reload=await request(href,reader);
    check(mode+' '+role+' ordinary reload retains the requested reader',()=>assertStartup(renderDashboardStartup(reload.text,href),role,section,'FULL-BODY-END'));
    check(mode+' '+role+' hardcoded Overview rejection catches the original failure',()=>assert.throws(()=>assertStartup(renderDashboardStartup(linked.text,href,{mutate:s=>s.replace('renderContent(role, currentSection);',"renderContent(role, 'overview');")}),role,section,'FULL-BODY-END')));
    for(const query of ['', '?section=', '?section=unknown', '?section=__proto__', '?section=%E0%A4%A', '?section=https%3A%2F%2Fexample.invalid', '?section='+ (role==='instructor'?'news':'announcements')]) {
     check(mode+' '+role+' unavailable initial section safely renders Overview '+query,()=>assertStartup(renderDashboardStartup(page.text,'/dashboard'+query),role,'overview','Quick Links'));
    }
    check(mode+' '+role+' profile deep link and subsequent section changes remain consistent',()=>{
     const boot=renderDashboardStartup(page.text,'/dashboard?section=profile');
     assertStartup(boot,role,'profile',role==='instructor'?'Instructor Profile':'Personal Information');
     assertStartup(boot.switchSection(section),role,section,'FULL-BODY-END');
     assertStartup(boot.switchSection('overview'),role,'overview','Quick Links');
     assertStartup(boot.switchRole(role),role,'overview','Quick Links');
    });
    check(mode+' '+role+' renders full content and paragraph text',()=>{assertBody(rendered,'FULL-BODY-END');assert.ok(rendered.html.includes('First paragraph.\n\nSecond paragraph'));assert.equal(rendered.rows[0].content,original.content);});
    check(mode+' '+role+' independent content-loss rejection fixture',()=>assert.throws(()=>assertBody(renderReader(page.text,template,s=>s.replace('bodyText: bodyText','bodyText: excerpt')),'FULL-BODY-END')));
   }
   if(viewArg)throw Error('Baseline unexpectedly passed missing-content regression');
   const guest=await login(4),guestPage=await request('/dashboard',guest);
   for(const query of ['news','announcements','news-events','unknown','__proto__']) {
    check(mode+' Guest unavailable announcement links render only Overview '+query,()=>assertStartup(renderDashboardStartup(guestPage.text,'/dashboard?section='+query,{storedRole:'instructor'}),'guest','overview','Welcome,'));
   }
   check(mode+' initial role allowlist rejection fixture is detected',()=>assert.throws(()=>assertStartup(renderDashboardStartup(guestPage.text,'/dashboard?section=announcements',{mutate:s=>s.replace('&& Object.prototype.hasOwnProperty.call(templateMap[role], requestedDashboardSection)','')}),'guest','overview','Welcome,')));
   const updated=await request('/admin/api/news/'+id,admin,'PUT',{...original,content:'EDITED-FULL-BODY-END'});check(mode+' update retains complete content',()=>assert.equal(updated.body.article.content,'EDITED-FULL-BODY-END'));
   const student=await login(2),editedPage=await request('/dashboard',student);
   check(mode+' reloaded dashboard reflects edited content',()=>assertBody(renderReader(editedPage.text,'tmpl-shared-news'),'EDITED-FULL-BODY-END'));
   const cases=[
    {id:501,title:'Legacy missing body',excerpt:'COMPLETE-LEGACY-EXCERPT',content:null},
    {id:502,title:'Legacy blank body',excerpt:'COMPLETE-WHITESPACE-FALLBACK',content:'  \n '},
    {id:503,title:'Identical content',excerpt:'IDENTICAL-TEXT-ONCE',content:'IDENTICAL-TEXT-ONCE'},
    {id:504,title:'No excerpt',excerpt:null,content:'FULL-CONTENT-WITHOUT-EXCERPT'},
    {id:505,title:'Unsafe text',excerpt:'Harmless summary',content:'</script><img src=x onerror="globalThis.executed=true"><script>globalThis.executed=true</script>'}
   ];
   for(const item of cases)f.state.tables.news_announcements.push({...original,published_date:'2026-10-25T00:00:00Z',...item});
   const casePage=await request('/dashboard',student),caseRender=renderReader(casePage.text,'tmpl-shared-news');
   for(const item of cases.slice(0,3)){
    const row=caseRender.rows.find(r=>r.id===item.id),fragment=caseRender.html.split('aria-labelledby="news-department-1-article-'+item.id+'"')[1].split('</article>')[0];
    check(mode+' legacy or identical text '+item.id+' appears once without dead disclosure',()=>{assert.equal(row.canExpand,false);assert.equal(fragment.split(item.excerpt).length-1,1);assert.ok(!fragment.includes('<details'));});
   }
   check(mode+' missing excerpt uses full-content preview',()=>{const row=caseRender.rows.find(r=>r.id===504);assert.equal(row.preview,'FULL-CONTENT-WITHOUT-EXCERPT');assert.equal(row.canExpand,true);});
   check(mode+' stored script and HTML characters remain encoded text',()=>{assert.ok(caseRender.html.includes('&lt;img'));assert.ok(!/<img\b|<script\b/.test(caseRender.html));});
   check(mode+' raw-body rejection fixture is independently detected',()=>assert.throws(()=>{const unsafe=renderReader(casePage.text,'tmpl-shared-news',s=>s.replace('<%= news[i].bodyText %>','<%- news[i].bodyText %>'));assert.ok(!/<img\b|<script\b/.test(unsafe.html));}));
   const maxBody='L'.repeat(10000-'MAX-BODY-END-10K'.length)+'MAX-BODY-END-10K';
   const maxSaved=await request('/admin/api/news',admin,'POST',{...original,title:'Maximum length',content:maxBody});
   check(mode+' existing 10000-character content limit persists',()=>{assert.equal(maxSaved.status,201);assert.equal(maxSaved.body.article.content.length,10000);});
   const maxPage=await request('/dashboard',student);check(mode+' full length survives mapping and rendering',()=>{const r=renderReader(maxPage.text,'tmpl-shared-news');assert.equal(r.rows.find(n=>n.id===maxSaved.body.article.id).bodyText.length,10000);assertBody(r,'MAX-BODY-END-10K');});
   const tooLong=await request('/admin/api/news',admin,'POST',{...original,content:maxBody+'X'});check(mode+' over-limit validation remains enforced',()=>assert.equal(tooLong.status,400));
   for(const role of ['all','student-cspc','instructor','guest','admin'])f.state.tables.news_announcements.push({...original,id:700+f.state.tables.news_announcements.length,title:'AUDIENCE-CANARY-'+role,audience:role,content:'PRIVATE-BODY-'+role,published_date:'2026-10-25T00:00:00Z'});
   f.state.tables.news_announcements.push({...original,id:999,title:'DRAFT-TITLE-CANARY',content:'DRAFT-BODY-CANARY',published_date:null});
   for(const [role,readerId,template]of [['student-cspc',2,'tmpl-shared-news'],['instructor',3,'tmpl-instructor-announcements']]){
    const reader=await login(readerId),page=await request('/dashboard',reader),result=renderReader(page.text,template);
    check(mode+' '+role+' published audience filtering is server authoritative',()=>{assert.equal(page.status,200);assert.ok(result.rows.every(r=>{const source=f.state.tables.news_announcements.find(s=>s.id===r.id);return source.published_date&&['all',role].includes(source.audience);}));assert.ok(!page.text.includes('DRAFT-TITLE-CANARY')&&!page.text.includes('DRAFT-BODY-CANARY'));for(const denied of ['student-cspc','instructor','guest','admin'].filter(x=>x!==role))assert.ok(!page.text.includes('PRIVATE-BODY-'+denied));});
    const denied=await request('/admin/api/news',reader,'POST',original);check(mode+' '+role+' cannot write articles',()=>assert.equal(denied.status,403));
   }
   f.state.tables.news_announcements=[];const emptyPage=await request('/dashboard',student);
   check(mode+' empty published feed stays empty without mock fallback',()=>{const r=renderReader(emptyPage.text,'tmpl-shared-news');assert.equal(r.rows.length,0);assert.ok(r.html.includes('No announcements at this time.'));assert.ok(!r.html.includes('<article'));});
  }finally{await new Promise(resolve=>f.store.clear(resolve));await new Promise(resolve=>server.close(resolve));}
 }
 console.log('DASHBOARD-ANNOUNCEMENTS OK: '+checks+'/'+checks);
}
module.exports={renderReader,assertBody,renderDashboardStartup,assertStartup};
if(require.main===module)run().catch(e=>{console.error('DASHBOARD-ANNOUNCEMENTS FAIL: '+e.stack);process.exitCode=1;});
