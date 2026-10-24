'use strict';
// Database-free behavioral fixtures for shared viewport sizing and route cancellation.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const layout=read('public/js/map-sidebar-layout.js'),source=read('views/map.ejs'),offline=read('public/offline.html'),manager=read('public/js/offline-guide-manager.js'),css=read('public/css/map-sidebar.css');
let checks=0;const check=(name,fn)=>{fn();checks++;console.log('[PASS] '+name);};
function layoutFixture(script=layout,legacy=false){
  const styles={},classes=new Map(),events={},viewportEvents={},frames=[],observed=[];let bottom=64,dispatched=0;
  const header={offsetHeight:220},nav={getBoundingClientRect:()=>({bottom})},canvas={};
  const workspace={style:{setProperty:(key,value)=>{styles[key]=value;}},classList:{toggle:(key,value)=>classes.set(key,value)},querySelector:selector=>selector.includes('header')?header:canvas};
  const window={innerHeight:844,visualViewport:{height:844,addEventListener:(key,fn)=>{viewportEvents[key]=fn;}},addEventListener:(key,fn)=>{events[key]=fn;},requestAnimationFrame:fn=>frames.push(fn),dispatchEvent:()=>{dispatched++;}};
  const context={window,document:{readyState:'complete',querySelector:selector=>selector==='.map-page'?workspace:nav},Event:class {constructor(type){this.type=type;}},ResizeObserver:class {constructor(callback){this.callback=callback;}observe(element){observed.push(element);}}};
  if(legacy){window.visualViewport=undefined;context.ResizeObserver=undefined;}
  vm.runInNewContext(script,context,{timeout:1000});
  return {styles,classes,window,events,viewportEvents,frames,observed,header,setBottom:value=>{bottom=value;},dispatchCount:()=>dispatched,flush(){while(frames.length)frames.shift()();}};
}
check('shared layout subtracts the actual navigation height',()=>{const f=layoutFixture();assert.equal(f.styles['--map-nav-height'],'64px');assert.equal(f.styles['--map-workspace-height'],'780px');assert.equal(f.classes.get('is-short-viewport'),false);});
check('software-keyboard visual viewport shrink enables scrollable short layout',()=>{const f=layoutFixture();f.window.visualViewport.height=420;f.viewportEvents.resize();f.flush();assert.equal(f.styles['--map-workspace-height'],'356px');assert.equal(f.classes.get('is-short-viewport'),true);});
check('orientation and enlarged navigation update without negative heights',()=>{const f=layoutFixture();f.setBottom(96);f.window.visualViewport.height=390;f.events.resize();f.flush();assert.equal(f.styles['--map-workspace-height'],'294px');f.setBottom(500);f.events.resize();f.flush();assert.equal(f.styles['--map-workspace-height'],'0px');});
check('resize notifications are coalesced and observe nav header and map',()=>{const f=layoutFixture();f.events.resize();f.events.resize();f.viewportEvents.resize();assert.equal(f.frames.length,1);f.flush();assert.equal(f.dispatchCount(),2);assert.equal(f.observed.length,3);});
check('browsers without VisualViewport or ResizeObserver retain resize support',()=>{const f=layoutFixture(layout,true);assert.equal(f.styles['--map-workspace-height'],'780px');assert.equal(f.observed.length,0);f.window.innerHeight=400;f.events.resize();f.flush();assert.equal(f.styles['--map-workspace-height'],'336px');});
function cancellationFixture(text=source){
  const start=text.indexOf('        function beginRouteLookup()'),end=text.indexOf('        function clearComputedPath()',start);assert.ok(start>=0&&end>start);
  let cleared=0,reset=0;const frame={AbortController,routeAbortController:null,routeRequestToken:0,mapClearRoute:{hidden:true},rememberRoutePanelInvoker(){},clearComputedPath(){cleared++;},resetRoutePanelTransient(){reset++;}};
  vm.runInNewContext(text.slice(start,end),frame,{timeout:1000});
  const first=frame.beginRouteLookup(),controller=frame.routeAbortController;assert.equal(frame.mapClearRoute.hidden,false);
  const second=frame.beginRouteLookup();assert.equal(controller.signal.aborted,true);assert.equal(frame.isCurrentRouteLookup(first),false);assert.equal(frame.isCurrentRouteLookup(second),true);
  const latest=frame.routeAbortController;frame.cancelRouteLookup();assert.equal(latest.signal.aborted,true);assert.equal(frame.isCurrentRouteLookup(second),false);assert.equal(frame.mapClearRoute.hidden,true);assert.equal(cleared,3);assert.equal(reset,3);
}
check('real lookup lifecycle aborts old requests and clears stale instructions',()=>cancellationFixture());
for(const [name,before,after] of [
  ['missing request abort','if (routeAbortController) routeAbortController.abort();',''],
  ['missing cancellation token invalidation','function cancelRouteLookup() {\n            routeRequestToken += 1;','function cancelRouteLookup() {'],
  ['missing cancellation content reset','clearComputedPath();\n            resetRoutePanelTransient();\n            mapClearRoute.hidden = true;','clearComputedPath();\n            mapClearRoute.hidden = true;']
])check('rejects '+name,()=>{const changed=source.replace(before,after);assert.notEqual(changed,source);assert.throws(()=>cancellationFixture(changed));});
check('both maps remove the redundant form and load the shared assets',()=>{for(const html of [source,offline]){assert.doesNotMatch(html,/id="(?:offlineRouteFind|routeFindBtn|routeStartInput|offlineRouteStart)"/);assert.match(html,/\/css\/map-sidebar\.css/);assert.match(html,/\/js\/map-sidebar-layout\.js/);assert.match(html,/aria-label="(?:Offline route mode|Route mode)"/);}});
check('guide disclosure is collapsed by default and downloads remain explicit',()=>{assert.match(source,/<details class="map-offline-guide" aria-labelledby="offlineGuideTitle">/);assert.match(source,/data-offline-guide-download type="button"/);});
check('sidebar owns scrolling and phone height uses the complete workspace',()=>{assert.match(css,/\.map-sidebar\s*\{[\s\S]*?overflow: auto/);assert.match(css,/\.map-sidebar__list\s*\{[^}]*overflow: visible/);assert.match(css,/@media \(max-width: 768px\)[\s\S]*?height: 100%/);assert.match(css,/is-short-viewport \.map-sidebar__header \{ position: relative/);});
check('phone route actions hide the list and focus fallbacks use existing controls',()=>{assert.doesNotMatch(source,/mapSidebar\.classList\.add\('open'\)/);assert.match(source,/selectRoutePanelReturnTarget\(invoker, \[\s*mapClearRoute/);assert.match(manager,/setMobileSidebar\(false, \{ restoreFocus: false \}\)/);assert.match(manager,/byId\('offlineClearMapRoute'\)/);});
check('layout resize keeps both renderer cameras and reduced motion is honored',()=>{assert.match(source,/maplibreMap\.resize\(\)/);assert.match(source,/leafletMap\.invalidateSize\(\{ pan: false \}\)/);assert.match(manager,/campusphere:map-layout[\s\S]*?map\.resize\(\)/);assert.match(css,/prefers-reduced-motion: reduce/);});
console.log(`MAP-SIDEBAR-LAYOUT OK: ${checks}/${checks} checks passed (isolated fixtures).`);
