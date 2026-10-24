'use strict';

// Real handlers, middleware and adapters over disposable in-memory providers.
// No application login, shared database, credentials or external network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const express = require('express');
const rules = require('../utils/routeInstructions');
const { extractFunction } = require('./off2PwaLifecycle-probe');
const root = path.join(__dirname, '..');
let checks = 0;
const clone = value => JSON.parse(JSON.stringify(value));
function check(label, fn) { fn(); checks++; console.log('  [PASS] ' + label); }
function load(rel, mocks = {}) {
  const filename = path.join(root, rel), local = new Module(filename, module);
  local.filename = filename; local.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = local.require.bind(local);
  local.require = key => Object.hasOwn(mocks, key) ? mocks[key] : original(key);
  local._compile(fs.readFileSync(filename, 'utf8'), filename); return local.exports;
}
const step = instruction => ({ step_order: 1, instruction, landmark: null, lat: null, lng: null });
function pure() {
  for (const value of [null, true, [], {}, 0, -1, '042', '42x', '1e2', Number.MAX_SAFE_INTEGER + 1]) {
    check('reject invalid destination ' + JSON.stringify(value), () => assert.equal(rules.validId(value), null));
  }
  check('empty list is a valid selected-list clear', () => assert.deepEqual(rules.validateSteps({ steps: [] }).value, []));
  check('legacy sequential string order retains whitespace normalization', () => assert.equal(rules.validateSteps({ steps: [{ ...step('Existing'), step_order: ' 1 ' }] }).value[0].step_order, 1));
  for (const body of [{}, { steps: null }, { steps: [{}] }, { steps: [{ instruction: ' ' }] },
    { steps: [{ instruction: 'x'.repeat(5001) }] }, { steps: Array(201).fill(step('x')) },
    { steps: [{ ...step('x'), landmark: 'x'.repeat(256) }] }, { steps: [{ ...step('x'), lat: 91 }] },
    { steps: [{ ...step('x'), lng: 181 }] }, { steps: [{ ...step('x'), lat: true }] },
    { steps: [{ ...step('x'), step_order: 2 }] }, { steps: [step('x')], mode: 'walking' },
    { steps: [{ ...step('x'), destination_building_id: 43 }] }]) {
    check('reject invalid instruction payload ' + checks, () => assert.equal(rules.validateSteps(body, { strictFields: true }).ok, false));
  }
  check('trim text, retain optional fields and normalize order', () => assert.deepEqual(rules.validateSteps({ steps: [
    { instruction: '  A  ', landmark: '  L  ', lat: '13.4', lng: '123.3' }, { instruction: 'B' }
  ] }).value, [{ step_order: 1, instruction: 'A', landmark: 'L', lat: 13.4, lng: 123.3 }, { ...step('B'), step_order: 2 }]));
  for (const alias of ['Guard House', 'Guard House / Main Gate', 'Main Gate', ' GUARD HOUSE / MAIN GATE ']) {
    check('exact normalized gate alias ' + alias, () => assert.equal(rules.resolveVehicleRoute([{ id: 1, destination_building_id: 42, start_label: alias }], 42).route.id, 1));
  }
  check('titles and gate fragments cannot pick another route', () => assert.equal(rules.resolveVehicleRoute([
    { id: 1, destination_building_id: 43, start_label: 'Guard House', title: 'Academic Building I' },
    { id: 2, destination_building_id: 42, start_label: 'Near Guard House' }
  ], 42).route, null));
  check('duplicate matching routes fail closed', () => assert.equal(rules.resolveVehicleRoute([1, 2].map(id => ({ id, destination_building_id: 42, start_label: 'Main Gate' })), 42).ambiguous, true));
  check('corrupt, nonsequential saved rows are unavailable', () => assert.equal(rules.fromStored([{ ...step('x'), step_order: 2 }]).instructionStatus, 'unavailable'));
}
function fixture(mode) {
  const state = { lists: [], legacy: [step('Original administrator content')].map(s => ({ ...s, route_id: 7 })),
    routes: [{ id: 7, destination_building_id: 42, start_label: 'Guard House / Main Gate' }], fail: false, writes: 0, queries: [], audits: [] };
  const buildings = ['I', 'II', 'III', 'IV'].map((suffix, i) => ({ id: 42 + i, name: 'Academic Building ' + suffix, lat: 13.406 + i / 10000, lng: 123.373 }));
  function select(table, filters = {}) {
    const rows = table === 'buildings' ? buildings : table === 'campus_routes' ? state.routes : table === 'campus_route_steps' ? state.legacy : state.lists;
    return clone(rows.filter(row => Object.entries(filters).every(([key, value]) => row[key] === value)));
  }
  function write(payload) { state.writes++; const index = state.lists.findIndex(r => r.destination_building_id === payload.destination_building_id && r.mode === payload.mode && r.direction === payload.direction); if (index < 0) state.lists.push(clone(payload)); else state.lists[index] = clone(payload); }
  const db = { async query(sql, args = []) {
    if (state.fail) throw new Error('private provider detail'); state.queries.push({ sql, args });
    if (sql.startsWith('INSERT INTO campus_route_instruction_lists')) { write({ destination_building_id: args[0], mode: args[1], direction: args[2], steps: JSON.parse(args[3]) }); return [{}]; }
    const table = /FROM (\w+)/.exec(sql)?.[1]; assert.ok(table, 'unknown fixture query');
    const filters = {}; if (/WHERE destination_building_id =/.test(sql)) filters.destination_building_id = args[0];
    if (/AND mode =/.test(sql)) { filters.mode = args[1]; filters.direction = args[2]; }
    if (/WHERE id =/.test(sql)) filters.id = args[0]; if (/WHERE route_id =/.test(sql)) filters.route_id = args[0];
    return [select(table, filters)];
  } };
  const client = { from(table) {
    const filters = {}; let single = false, payload, range;
    const query = { select() { return query; }, order() { return query; }, eq(key, value) { filters[key] = value; return query; },
      maybeSingle() { single = true; return query; }, range(a, b) { range = [a, b]; return query; },
      upsert(value, options) { assert.equal(options.onConflict, 'destination_building_id,mode,direction'); payload = value; return query; },
      then(resolve, reject) { return Promise.resolve().then(() => {
        if (state.fail) return { data: null, error: { message: 'private provider detail' } };
        if (payload) { write(payload); return { data: null, error: null }; }
        let rows = select(table, filters); if (range) rows = rows.slice(range[0], range[1] + 1);
        return { data: single ? rows[0] || null : rows, error: null };
      }).then(resolve, reject); }
    }; return query;
  } };
  const repo = load('repositories/routeInstructionRepository.js', { '../config/supabase': { getSupabaseClient: () => client } });
  const routeRepo = { async findRouteSourceBuildingById(id) { return select('buildings', { id })[0] || null; },
    async adminListSteps(id) { if (state.fail) throw Error('private'); return select('campus_route_steps', { route_id: id }); } };
  const service = load('services/routeInstructionService.js', { '../config/db': db,
    '../config/mapRuntime': { isRouteSupabase: () => mode === 'supabase' }, '../repositories/routeInstructionRepository': repo, '../repositories/routeRepository': routeRepo });
  const controller = load('controllers/routeInstructionController.js', { '../services/routeInstructionService': service,
    '../services/auditService': { async record(record) { state.audits.push(record); } } });
  const stub = new Proxy({}, { get: () => (req, res, next) => next ? next() : res.status(501).end() });
  const mocks = { '../controllers/routeInstructionController': controller, '../middleware/rateLimit': { adminMutationLimiter: (req, res, next) => next() } };
  const authAudit = { async record() {} };
  const roleAuth = load('middleware/roleAuth.js', { '../services/auditService': authAudit });
  mocks['../middleware/departmentAccess'] = load('middleware/departmentAccess.js', { './roleAuth': roleAuth });
  for (const name of ['adminController', 'adminUsersController', 'adminContentController', 'adminBuildingsController', 'adminVrController', 'adminRouteController', 'presenceController', 'walkingRouteController']) mocks['../controllers/' + name] = stub;
  mocks['../controllers/walkingRouteController'] = { ...stub, noStore(req, res, next) { res.set('Cache-Control', 'no-store, private'); next(); }, adminList: stub.get, adminGet: stub.get, adminSave: stub.get, adminDelete: stub.get };
  return { state, service, repo, router: load('routes/admin.js', mocks) };
}
async function adapters(mode) {
  const { state, service, repo, router } = fixture(mode), app = express(); app.use(express.json());
  app.use((req, res, next) => { const role = req.get('X-Fixture-Role'); req.session = role ? { user: { id: 999, role, department_code: 'ccs' }, csrfToken: 'fixture-only' } : {}; next(); });
  app.use('/admin', router);
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  async function request(label, status, { id = '42', mode: selectedMode = 'walking', direction = 'entry', role = 'admin', token = 'fixture-only', method = 'GET', body, extra = '' } = {}, verify) {
    const response = await fetch(base + '/admin/api/route-instructions/' + id + '?mode=' + selectedMode + '&direction=' + direction + extra,
      { method, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(role ? { 'X-Fixture-Role': role } : {}), ...(token ? { 'X-CSRF-Token': token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(5000) });
    const data = await response.json(); check(mode + ': ' + label, () => { assert.equal(response.status, status); assert.equal(response.headers.get('Cache-Control'), 'no-store, private'); if (verify) verify(data); }); return data;
  }
  try {
    for (const method of ['GET', 'PUT']) for (const role of [null, 'guest', 'student-cspc', 'instructor', 'department-admin']) await request('deny ' + (role || 'anonymous') + ' ' + method, role ? 403 : 401, { role, method, body: method === 'PUT' ? { steps: [] } : undefined });
    for (const token of [null, 'wrong']) await request('deny invalid CSRF', 403, { method: 'PUT', token, body: { steps: [] } });
    check(mode + ': denied requests never write', () => assert.equal(state.writes, 0));
    for (const params of [{ id: '42x' }, { id: '042' }, { mode: 'car' }, { direction: 'reverse' }, { mode: 'vehicle' }, { extra: '&unknown=1' }, { extra: '&mode=vehicle' }]) await request('reject invalid selection ' + checks, 400, params);
    await request('unknown source destination rejected', 404, { id: '999' });
    await request('missing list is empty', 200, {}, data => assert.deepEqual(data.steps, []));
    const legacy = clone(state.legacy);
    for (const [selectedMode, direction, text] of [['vehicle', 'exit', 'Vehicle return independent'], ['walking', 'entry', 'Walking outward independent'], ['walking', 'exit', 'Walking return independent']]) {
      await request('save ' + selectedMode + ' ' + direction, 200, { mode: selectedMode, direction, method: 'PUT', body: { steps: [step(text), { instruction: text + ' second', landmark: 'Optional', lat: '13.4', lng: '123.3' }] } });
      await request('reload ' + selectedMode + ' ' + direction, 200, { mode: selectedMode, direction }, data => { assert.equal(data.steps.length, 2); assert.equal(data.steps[0].instruction, text); assert.equal(data.steps[1].step_order, 2); });
    }
    check(mode + ': preserve administrator Vehicle entry content', () => assert.deepEqual(state.legacy, legacy));
    for (const id of [43, 44, 45]) { const result = await service.readForDestination(id, 'walking', 'entry'); check(mode + ': distinct destination ' + id + ' is empty', () => assert.deepEqual(result, { instructions: [], instructionStatus: 'empty' })); }
    const oldLists = clone(state.lists);
    await request('clear only selected Walking return', 200, { method: 'PUT', direction: 'exit', body: { steps: [] } });
    check(mode + ': other two new lists are preserved', () => assert.deepEqual(state.lists.filter(r => !(r.mode === 'walking' && r.direction === 'exit')), oldLists.filter(r => !(r.mode === 'walking' && r.direction === 'exit'))));
    await request('unfinished blank row rejected', 400, { method: 'PUT', body: { steps: [{ instruction: '' }] } });
    await request('unknown field cannot change geometry', 400, { method: 'PUT', body: { steps: [step('x')], path_geometry: [] } });
    const entry = await service.readForDestination(42, 'vehicle', 'entry');
    check(mode + ': Vehicle entry resolves legacy unique gate route', () => assert.equal(entry.instructions[0].instruction, legacy[0].instruction));
    state.routes.push({ id: 8, destination_building_id: 42, start_label: 'Main Gate' });
    const ambiguous = await service.readForDestination(42, 'vehicle', 'entry');
    check(mode + ': ambiguous route does not guess', () => assert.equal(ambiguous.instructionStatus, 'unavailable')); state.routes.pop();
    const snapshot = await service.loadSnapshot();
    check(mode + ': shared snapshot agrees with online resolver', () => assert.deepEqual(rules.resolveSnapshot(snapshot, 42, 'vehicle', 'entry'), entry));
    for (const [selectedMode, direction] of [['vehicle', 'exit'], ['walking', 'entry'], ['walking', 'exit']]) {
      const online = await service.readForDestination(42, selectedMode, direction);
      check(mode + ': snapshot agrees for ' + selectedMode + ' ' + direction, () => assert.deepEqual(rules.resolveSnapshot(snapshot, 42, selectedMode, direction), online));
    }
    if (mode === 'supabase') {
      const original = clone(state.legacy); state.legacy = Array.from({ length: 1201 }, (_, i) => ({ ...step('fixture ' + i), route_id: i + 100 }));
      const paged = await repo.legacySnapshot(); check('Supabase: paginate beyond provider row cap', () => assert.equal(paged.steps.length, 1201)); state.legacy = original;
    }
    const beforeFailure = clone(state.lists); state.fail = true;
    await request('read failure is sanitized unavailable', 503, {}, data => assert.equal(data.message, rules.UNAVAILABLE_MESSAGE));
    await request('atomic write failure returns failure', 503, { method: 'PUT', body: { steps: [step('should not persist')] } });
    check(mode + ': failed save preserves all lists', () => assert.deepEqual(state.lists, beforeFailure));
    assert.equal((await service.readForDestination(42, 'walking', 'entry')).instructionStatus, 'unavailable');
    state.fail = false;
    check(mode + ': safe fixed audit metadata excludes instructions', () => { assert.equal(state.audits.length, 4); for (const audit of state.audits) { assert.equal(audit.action, 'admin.route.instructions.update'); assert.doesNotMatch(JSON.stringify(audit), /independent|csrf|geometry/); } });
    check(mode + ': instruction writes are single-row whole-list replacements', () => assert.equal(state.writes, 4));
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
function rendering() {
  const source = fs.readFileSync(path.join(root, 'views/map.ejs'), 'utf8');
  const createElement = tag => ({ tag, children: [], textContent: '', append(...children) { this.children.push(...children); }, appendChild(child) { this.children.push(child); }, replaceChildren() { this.children = []; } });
  const frame = { document: { createElement }, routePanelSteps: createElement('ol'), routePanelStepsWrap: {}, routePanelEmpty: {} };
  vm.runInNewContext(extractFunction(source, 'renderSavedRouteInstructions'), frame);
  check('saved instruction markup is displayed as literal text in order', () => { frame.renderSavedRouteInstructions([{ instruction: '<img src=x onerror=alert(1)>' }, { instruction: 'Second' }], 'saved'); assert.equal(frame.routePanelSteps.children[0].children[1].textContent, '<img src=x onerror=alert(1)>'); assert.equal(frame.routePanelSteps.children[1].children[0].textContent, '2'); assert.equal(frame.routePanelEmpty.hidden, true); });
  for (const [status, message] of [['empty', rules.EMPTY_MESSAGE], ['unavailable', rules.UNAVAILABLE_MESSAGE]]) {
    check('clear stale numbered content on ' + status, () => { frame.renderSavedRouteInstructions([], status); assert.equal(frame.routePanelSteps.children.length, 0); assert.equal(frame.routePanelEmpty.textContent, message); assert.equal(frame.routePanelEmpty.hidden, false); });
  }
  check('shared popup uses computed saved list', () => assert.match(extractFunction(source, 'openComputedRoutePanel'), /renderSavedRouteInstructions\(route\.instructions, route\.instructionStatus\)/));
  check('pin navigation keeps validated computed trips after removing the planner', () => { assert.doesNotMatch(source, /id="routeFindBtn"/); assert.match(source, /findComputedRoute\(\{[\s\S]*route_destination_id: b.route_destination_id/); });
}
async function offlineChecks() {
  const { buildGuide } = require('../services/offlineGuideService');
  const { calculateRouteMetrics } = require('../utils/routeGeometry');
  const walkingGeometry = [{ lat: 13.405710, lng: 123.374181 }, { lat: 13.4058, lng: 123.3749 }, { lat: 13.406, lng: 123.3756 }];
  const fixture = { buildings: [{ id: 999, name: 'Fixture Library', category: 'Academic', lat: 13.406, lng: 123.3756, route_available: true, route_destination_id: 42 }],
    nodeRows: [{ id: 1, node_key: 'main-gate', label: 'Main Gate', lat: 13.4057, lng: 123.3742 }, { id: 2, node_key: 'fixture-library', label: 'Fixture Library', node_type: 'building', building_id: 42, lat: 13.406, lng: 123.3756 }],
    edgeRows: [{ from_node_id: 1, to_node_id: 2, distance_meters: 150, walk_time_seconds: 120, is_accessible: 1, path_geometry: [{ lat: 13.4057, lng: 123.3742 }, { lat: 13.406, lng: 123.3756 }] },
      { from_node_id: 2, to_node_id: 1, distance_meters: 160, walk_time_seconds: 130, is_accessible: 1, path_geometry: [{ lat: 13.406, lng: 123.3756 }, { lat: 13.4059, lng: 123.3747 }, { lat: 13.4057, lng: 123.3742 }] }],
    walkingBuildings: [{ id: 42, lat: 13.406, lng: 123.3756 }], walkingRows: [{ destination_building_id: 42, path_geometry: walkingGeometry, ...calculateRouteMetrics(walkingGeometry) }] };
  const snapshot = { routes: [{ id: 7, destination_building_id: 42, start_label: 'Guard House' }], steps: [{ ...step('Vehicle to'), route_id: 7 }],
    lists: [['vehicle', 'exit', 'Vehicle back'], ['walking', 'entry', 'Walking to'], ['walking', 'exit', 'Walking back']].map(([mode, direction, text]) => ({ destination_building_id: 42, mode, direction, steps: [step(text)] })) };
  const guide = buildGuide({ ...fixture, instructionSnapshot: snapshot }), oldGuide = buildGuide(fixture);
  check('new offline package contains all four independent lists using route-source ID', () => {
    assert.equal(guide.instructionFormat, 1); assert.equal(guide.routes[0].steps[0].instruction, 'Vehicle to'); assert.equal(guide.exitRoutes[0].steps[0].instruction, 'Vehicle back');
    assert.equal(guide.walkingRoutes[0].steps[0].instruction, 'Walking to'); assert.equal(guide.walkingRoutes[0].returnSteps[0].instruction, 'Walking back');
  });
  check('adding instructions preserves all offline geometries and metrics', () => { for (const collection of ['routes', 'exitRoutes', 'walkingRoutes']) for (const key of ['geometry', 'distanceMeters', 'walkTimeSeconds']) assert.deepEqual(guide[collection][0][key], oldGuide[collection][0][key]); });
  const manager = fs.readFileSync(path.join(root, 'public/js/offline-guide-manager.js'), 'utf8');
  const frame = { GUIDE_SCHEMA: 'campusphere.offline-guide/1', MAX_BASEMAP_BYTES: 5 * 1024 * 1024, activeRecord: { guide } };
  for (const name of ['isHexHash', 'validateGuideEnvelope', 'walkingRouteFor']) vm.runInNewContext(extractFunction(manager, name), frame);
  const payload = { success: true, schema: frame.GUIDE_SCHEMA, fingerprint: 'a'.repeat(64), guide };
  check('new offline client validates ordered lists and explicit Walking return', () => { assert.equal(frame.validateGuideEnvelope(payload), guide); assert.equal(frame.walkingRouteFor('fixture-library', true).steps[0].instruction, 'Walking back'); });
  check('old downloaded guide remains usable without an instruction-format flag', () => { const prior = { ...payload, guide: oldGuide }; assert.equal(frame.validateGuideEnvelope(prior), oldGuide); frame.activeRecord = { guide: oldGuide }; assert.match(frame.walkingRouteFor('fixture-library', true).steps[0].instruction, /Walking Guard House/); });
  for (const mutate of [g => { delete g.walkingRoutes[0].returnSteps; }, g => { g.routes[0].steps[0].order = 2; }, g => { g.routes[0].steps[0].instruction = ''; }, g => { g.instructionFormat = 999; }]) {
    const invalid = clone(payload); mutate(invalid.guide); check('malformed new guide rejected ' + checks, () => assert.throws(() => frame.validateGuideEnvelope(invalid)));
  }
  const retained = { guide: oldGuide, fingerprint: 'b'.repeat(64) }; let writes = 0;
  const downloadFrame = { navigator: { onLine: true }, window: {}, logoutVersion: 0, downloadController: null, activeRecord: retained,
    setDownloadState() {}, setDownloadBusy() {}, fetch: async () => ({ ok: false, status: 503 }), writeActive() { writes++; } };
  vm.runInNewContext(extractFunction(manager, 'downloadGuide'), downloadFrame);
  const failed = await downloadFrame.downloadGuide();
  check('failed update retains the previous downloaded guide without writing', () => { assert.equal(failed, false); assert.equal(downloadFrame.activeRecord, retained); assert.equal(writes, 0); });
}
async function editorChecks() {
  // Minimal DOM fixture drives the real editor through user events and pending
  // reads. Layout/focus appearance is checked separately in the Docker browser.
  let document;
  class Element {
    constructor(tag = 'div') { this.tagName = tag; this.children = []; this.parentElement = null; this.events = {}; this.attrs = {}; this.style = {}; this.value = ''; this.textContent = ''; this.disabled = false; this.isConnected = true; this.className = ''; this.classes = new Set(); this.classList = { add: c => this.classes.add(c), remove: c => this.classes.delete(c), contains: c => this.classes.has(c) }; }
    addEventListener(name, callback) { (this.events[name] ||= []).push(callback); }
    async fire(name, event = {}) { for (const callback of this.events[name] || []) await callback({ target: this, preventDefault() {}, stopPropagation() {}, ...event }); }
    setAttribute(name, value) { this.attrs[name] = value; }
    appendChild(child) { child.remove(); child.parentElement = this; this.children.push(child); return child; }
    remove() { if (this.parentElement) { const siblings = this.parentElement.children; siblings.splice(siblings.indexOf(this), 1); this.parentElement = null; } }
    replaceChildren(...children) { this.children.forEach(child => { child.parentElement = null; }); this.children = []; children.forEach(child => this.appendChild(child)); }
    insertBefore(child, before) { child.remove(); child.parentElement = this; this.children.splice(this.children.indexOf(before), 0, child); }
    get previousElementSibling() { return this.parentElement?.children[this.parentElement.children.indexOf(this) - 1]; }
    get nextElementSibling() { return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1]; }
    focus() { document.activeElement = this; }
    querySelectorAll(selector) { const found = []; const matches = el => selector.split(',').some(part => { const s = part.trim(); return (s.startsWith('.') ? el.className.split(' ').includes(s.slice(1)) : el.tagName === s.split(':')[0]) && (!s.includes(':not(:disabled)') || !el.disabled); }); const walk = el => { for (const child of el.children) { if (matches(child)) found.push(child); walk(child); } }; walk(this); return found; }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  }
  const elements = {}, modal = elements['steps-modal'] = new Element(), requests = []; let confirmation = false, confirmations = 0;
  for (const [id, tag] of [['steps-editor', 'div'], ['steps-save', 'button'], ['add-step-btn', 'button'], ['steps-modal-title', 'h3'], ['steps-route-label', 'p'], ['steps-list-status', 'p'], ['steps-entry-tab', 'button'], ['steps-exit-tab', 'button']]) { elements[id] = new Element(tag); modal.appendChild(elements[id]); }
  const close = new Element('button'); close.className = 'modal-close-btn'; modal.appendChild(close);
  const error = new Element('p'); error.className = 'form-error'; modal.appendChild(error);
  const invoker = new Element('button');
  document = { activeElement: invoker, body: { style: {} }, getElementById: id => elements[id], createElement: tag => new Element(tag), querySelector: () => ({ content: 'fixture-csrf' }), addEventListener(name, cb) { if (name === 'DOMContentLoaded') cb(); } };
  const window = { confirm() { confirmations++; return confirmation; } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'public/js/admin/route-instructions-editor.js'), 'utf8'), { document, window, fetch: (url, options) => new Promise(resolve => requests.push({ url, options, resolve })) });
  const ui = window.CampuSphereRouteInstructionsEditor, settle = async (request, steps, ok = true) => { request.resolve({ ok, async json() { return { success: ok, steps }; } }); await new Promise(resolve => setImmediate(resolve)); };
  const instructions = () => elements['steps-editor'].querySelectorAll('.steps-instruction').map(el => el.value);
  ui.openVehicle({ id: 7, destination_name: 'Fixture I' }); check('editor rejects a missing route-source building ID', () => assert.equal(requests.length, 0));
  ui.openVehicle({ id: 7, destination_building_id: 42, destination_name: 'Fixture I' }); await settle(requests.shift(), [step('Existing'), { ...step('Second'), step_order: 2 }]);
  check('editor preserves legacy values and opens on To building', () => { assert.deepEqual(instructions(), ['Existing', 'Second']); assert.equal(elements['steps-entry-tab'].attrs['aria-selected'], 'true'); });
  await elements['steps-editor'].querySelectorAll('button')[3].fire('click');
  check('reorder changes instruction order', () => assert.deepEqual(instructions(), ['Second', 'Existing']));
  await elements['steps-exit-tab'].fire('click'); check('declined discard keeps dirty list and direction', () => { assert.equal(confirmations, 1); assert.equal(requests.length, 0); assert.equal(elements['steps-entry-tab'].attrs['aria-selected'], 'true'); });
  confirmation = true; await elements['steps-exit-tab'].fire('click'); await settle(requests.shift(), []);
  check('accepted discard selects independent Vehicle return endpoint', () => { assert.equal(elements['steps-exit-tab'].attrs['aria-selected'], 'true'); assert.deepEqual(instructions(), []); });
  await close.fire('click'); ui.openWalking({ id: 42, name: 'Fixture I' }); const late = requests.shift(); await elements['steps-exit-tab'].fire('click'); const latest = requests.shift();
  await settle(latest, [step('Latest Walking return')]); await settle(late, [step('Late entry must not appear')]);
  check('late editor response cannot overwrite the latest direction', () => assert.deepEqual(instructions(), ['Latest Walking return']));
  await elements['steps-editor'].querySelectorAll('button')[2].fire('click'); await elements['add-step-btn'].fire('click'); await elements['steps-save'].fire('click');
  check('unfinished blank row blocks saving', () => { assert.match(error.textContent, /Every step needs an instruction/); assert.equal(requests.length, 0); });
  await elements['steps-editor'].querySelectorAll('button')[2].fire('click'); const savePromise = elements['steps-save'].fire('click'), saveRequest = requests.shift();
  check('empty-list clear targets only selected mode/direction with CSRF', () => { assert.equal(saveRequest.url, '/admin/api/route-instructions/42?mode=walking&direction=exit'); assert.equal(saveRequest.options.method, 'PUT'); assert.equal(saveRequest.options.headers['X-CSRF-Token'], 'fixture-csrf'); assert.deepEqual(JSON.parse(saveRequest.options.body), { steps: [] }); });
  await elements['steps-entry-tab'].fire('click'); check('mode/direction remains frozen during save', () => assert.equal(requests.length, 0));
  await settle(saveRequest, []); await savePromise; await close.fire('click');
  check('closing editor restores its invoker focus', () => assert.equal(document.activeElement, invoker));
  ui.openWalking({ id: 43, name: 'Fixture II' }); await settle(requests.shift(), [], false);
  check('failed read disables Add and Save and cannot clear a saved list', () => { assert.equal(elements['steps-save'].disabled, true); assert.equal(elements['add-step-btn'].disabled, true); assert.match(error.textContent, /could not be loaded/); });
}
async function main() { pure(); await adapters('mysql'); await adapters('supabase'); rendering(); await offlineChecks(); await editorChecks(); console.log(`ROUTE-INSTRUCTIONS OK: ${checks}/${checks} checks passed (isolated fixtures).`); }
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
