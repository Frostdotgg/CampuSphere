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

// A fixed workspace creates a stacking context below the navigation. A larger
// child z-index cannot escape it; require the dialog to be a body-level sibling.
function assertOfflineDialogLayer(html) {
  const stack = [];
  const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  const markup = html.replace(/<!--[\s\S]*?-->/g, '').replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, '$1$2');
  let dialogs = 0;
  for (const token of markup.matchAll(/<(\/?)([a-z][\w:-]*)\b([^>]*)>/gi)) {
    const [,closing,name,attributes] = token, tag = name.toLowerCase();
    if (closing) {
      assert.equal(stack.pop(), tag, 'Unexpected offline HTML closing tag');
      continue;
    }
    if (/\bid\s*=\s*["']offlineRouteSummary["']/.test(attributes)) {
      dialogs++;
      assert.deepEqual(stack, ['html','body'], 'Offline route dialog must be a direct body child above the workspace');
      assert.match(attributes, /\brole="dialog"/);
      assert.match(attributes, /\baria-modal="true"/);
      assert.match(attributes, /\baria-labelledby="offlineRouteTitle"/);
      assert.match(attributes, /\baria-hidden="true"/);
      assert.match(attributes, /\bhidden(?:\s|$)/);
    }
    if (!voidTags.has(tag) && !/\/\s*$/.test(attributes)) stack.push(tag);
  }
  assert.equal(stack.length, 0, 'Unclosed offline HTML element');
  assert.equal(dialogs, 1, 'Exactly one offline route dialog is required');
}
check('offline route dialog is a body-level sibling above fixed map navigation',()=>assertOfflineDialogLayer(offline));
check('dialog-layer regression rejects moving the popup back into the workspace',()=>{
  const dialog = offline.match(/<section\b[^>]*id="offlineRouteSummary"[\s\S]*?<\/section>/);
  assert.ok(dialog, 'Missing route dialog fixture');
  const withoutDialog = offline.replace(dialog[0], '');
  const nested = withoutDialog.replace('</main>', dialog[0] + '\n</main>');
  assert.notEqual(nested, withoutDialog);
  assert.throws(()=>assertOfflineDialogLayer(nested), /direct body child/);
});

// Exercise the full successful handler, not only rendering and cancellation in isolation.
function clientFunction(text, name) {
  const start = text.indexOf('function ' + name + '(');
  const end = text.indexOf('\n        }', start);
  assert.ok(start >= 0 && end > start, 'Missing client function: ' + name);
  return text.slice(text.slice(start - 6, start) === 'async ' ? start - 6 : start, end + 10);
}
function predefinedFixture(text = source, fetchImpl) {
  let frame;
  function node() {
    const attributes = {}, classes = new Set();
    return {
      children: [], hidden: true, textContent: '',
      append(...items) { this.children.push(...items); },
      appendChild(item) { this.children.push(item); },
      replaceChildren(...items) { this.children = items; },
      set innerHTML(value) { this.children = []; },
      setAttribute(key, value) { attributes[key] = value; },
      removeAttribute(key) { delete attributes[key]; },
      getAttribute(key) { return attributes[key] ?? null; },
      classList: { add(key) { classes.add(key); }, remove(key) { classes.delete(key); } },
      focus() { frame.document.activeElement = this; }
    };
  }
  frame = {
    AbortController, routeMode: 'vehicle', routeRequestToken: 0, routeAbortController: null,
    destinationBuilding: null, currentBuildingId: null, routePanelInvoker: null,
    hints: [], requests: [], cleared: 0, navigator: { onLine: true },
    console: { error() {} },
    document: { activeElement: null, createElement: node, querySelectorAll() { return []; } },
    clearComputedPath() { frame.cleared++; },
    rememberRoutePanelInvoker() { frame.routePanelInvoker = frame.invoker; },
    selectRoutePanelReturnTarget(invoker) { return invoker; },
    setHint(message) { frame.hints.push(message); },
    selectedUnavailableLabel() { return 'Vehicle route unavailable'; },
    escapeHtml(value) { return String(value).replaceAll('<', '&lt;'); },
    bldgList: { querySelector() { return null; } },
    WALKING_ORIGIN: { lat: 13.405710, lng: 123.374181 }, MAP_START_NODE: null,
    mapStartMarker: null, mapStartMarkerElement: null, searchQuery: '', renderLocalList() {},
    fetch(url, options) {
      frame.requests.push({ url, options });
      return fetchImpl ? fetchImpl(url, options) : Promise.resolve({ ok: true, json: async () => ({ route: fixtureRoute() }) });
    }
  };
  for (const key of ['mapClearRoute', 'routePanelOverlay', 'routePanelClose', 'routePanelSteps',
    'routePanelStepsWrap', 'routePanelLandmarks', 'routePanelLandmarkWrap', 'routePanelTime',
    'routePanelEmpty', 'routePanelTitle', 'routePanelSubtitle', 'routePanelVrBtn', 'searchInput',
    'mobileListToggle', 'invoker']) frame[key] = node();
  for (const name of ['isRouteAvailable', 'isSelectedRouteAvailable', 'routeDestinationId', 'setDestination',
    'beginRouteLookup', 'isCurrentRouteLookup', 'cancelRouteLookup', 'resetRoutePanelTransient',
    'renderSavedRouteInstructions', 'showRoutePanelDialog', 'openRoutePanel', 'closeRoutePanel',
    'setRouteMode', 'openRouteById']) vm.runInNewContext(clientFunction(text, name), frame);
  frame.stepTexts = () => frame.routePanelSteps.children.map(row => row.children[1].textContent);
  return frame;
}
function fixtureRoute(name = 'Fixture Building I', steps = ['First fixture step', 'Second fixture step']) {
  return { id: 7, title: 'Guard House to ' + name, start_label: 'Guard House',
    estimated_walk_time: '2-3 minutes', destination: { id: 900, name },
    steps: steps.map((instruction, index) => ({ step_order: index + 1, instruction })), landmarks: [] };
}
async function checkAsync(name, run) { await run(); checks++; console.log('[PASS] ' + name); }
async function predefinedRegressions() {
  await checkAsync('complete predefined lookup retains steps for a basic destination without availability metadata', async () => {
    const f = predefinedFixture(); await f.openRouteById(7);
    assert.equal(f.stepTexts().join('|'), 'First fixture step|Second fixture step');
    assert.equal(f.routePanelOverlay.hidden, false); assert.equal(f.mapClearRoute.hidden, false);
    assert.equal(f.routePanelVrBtn.href, '/vr/routes/7');
    assert.equal(f.routePanelTime.textContent, 'Walk time: 2-3 minutes');
    assert.equal(f.document.activeElement, f.routePanelClose);
    assert.equal(f.requests.length, 1); assert.equal(f.requests[0].url, '/api/routes/7');
    f.closeRoutePanel(); assert.equal(f.document.activeElement, f.invoker);
    f.cancelRouteLookup(); assert.equal(f.stepTexts().length, 0); assert.equal(f.mapClearRoute.hidden, true);
  });
  await checkAsync('rejects restoration of the obsolete planner handoff after predefined rendering', async () => {
    const broken = source.replace('openRoutePanel(data.route);', 'openRoutePanel(data.route);\n                    setDestination(data.route.destination);');
    assert.notEqual(broken, source);
    await assert.rejects(async () => {
      const f = predefinedFixture(broken); await f.openRouteById(7);
      assert.equal(f.stepTexts().length, 2);
    });
  });
  await checkAsync('empty predefined instructions retain the honest empty state and clear action', async () => {
    const f = predefinedFixture(source, async () => ({ ok: true, json: async () => ({ route: fixtureRoute('Empty', []) }) }));
    await f.openRouteById(7); assert.equal(f.stepTexts().length, 0);
    assert.equal(f.routePanelEmpty.textContent, 'No instructions have been added for this route yet.');
    assert.equal(f.mapClearRoute.hidden, false);
  });
  await checkAsync('unavailable predefined response never restores prior instructions', async () => {
    const f = predefinedFixture(source, async () => ({ ok: false, status: 503 }));
    f.openRoutePanel(fixtureRoute()); f.closeRoutePanel(); await f.openRouteById(7);
    assert.equal(f.stepTexts().length, 0); assert.equal(f.routePanelOverlay.hidden, true);
    assert.ok(f.hints.includes('Connect to refresh route data.'));
  });
  await checkAsync('late predefined response cannot replace the newer destination', async () => {
    const pending = [], f = predefinedFixture(source, () => new Promise(resolve => pending.push(resolve)));
    const old = f.openRouteById(7), latest = f.openRouteById(8);
    assert.equal(f.requests[0].options.signal.aborted, true);
    pending[1]({ ok: true, json: async () => ({ route: fixtureRoute('Fixture Building II', ['Only II']) }) }); await latest;
    pending[0]({ ok: true, json: async () => ({ route: fixtureRoute() }) }); await old;
    assert.equal(f.stepTexts().join('|'), 'Only II'); assert.ok(f.routePanelTitle.textContent.endsWith('Fixture Building II'));
  });
  for (const action of ['clear', 'mode']) await checkAsync(action + ' during a pending predefined request prevents stale popup content', async () => {
    let resolve; const f = predefinedFixture(source, () => new Promise(done => { resolve = done; }));
    const request = f.openRouteById(7);
    if (action === 'mode') f.setRouteMode('walking'); else f.cancelRouteLookup();
    assert.equal(f.requests[0].options.signal.aborted, true);
    resolve({ ok: true, json: async () => ({ route: fixtureRoute() }) }); await request;
    assert.equal(f.stepTexts().length, 0); assert.equal(f.routePanelOverlay.hidden, true);
    assert.equal(f.mapClearRoute.hidden, true);
  });
}
predefinedRegressions().then(() => {
  console.log(`MAP-SIDEBAR-LAYOUT OK: ${checks}/${checks} checks passed (isolated fixtures).`);
}).catch(error => { console.error('MAP-SIDEBAR-LAYOUT FAILED: ' + error.message); process.exitCode = 1; });
