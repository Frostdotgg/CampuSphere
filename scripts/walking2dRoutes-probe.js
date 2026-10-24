'use strict';

// Full-source fixture test. Real routers, auth, CSRF, controller and adapters;
// database doubles and test-owned sessions only. Never connects to a database.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const vm = require('vm');
const { extractFunction } = require('./off2PwaLifecycle-probe');
const express = require('express');
const walking = require('../services/walkingRouteService');
const offline = require('../services/offlineGuideService');
const { calculateRouteMetrics, validatePathGeometry } = require('../utils/routeGeometry');
const ROOT = path.join(__dirname, '..');
let checks = 0;
function check(label, fn) { fn(); checks++; console.log('  [PASS] ' + label); }
const clone = value => JSON.parse(JSON.stringify(value));
const destination = { id: 42, name: 'Fixture Library', lat: 13.406, lng: 123.373 };
const geometry = [{ lat: 13.405710, lng: 123.374181 }, { lat: 13.4058, lng: 123.3738 }, { lat: destination.lat, lng: destination.lng }];
const metrics = calculateRouteMetrics(geometry);
const row = { destination_building_id: 42, path_geometry: geometry, ...metrics };

function load(rel, mocks) {
  const filename = path.join(ROOT, rel), local = new Module(filename, module);
  local.filename = filename; local.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = local.require.bind(local);
  local.require = key => Object.hasOwn(mocks, key) ? mocks[key] : original(key);
  local._compile(fs.readFileSync(filename, 'utf8'), filename);
  return local.exports;
}

function pureChecks() {
  check('fixed origin and independently calculated fixture metrics', () => {
    assert.equal(walking.ORIGIN.lat, 13.405710); assert.equal(walking.ORIGIN.lng, 123.374181);
    assert.equal(metrics.distance_meters, 132); assert.equal(metrics.walk_time_seconds, 110);
  });
  check('strict destination IDs reject coercion and unsafe values', () => {
    for (const id of [0, -1, '', '042', '42x', '1e2', [], {}, null, true, Number.MAX_SAFE_INTEGER + 1]) assert.equal(walking.validId(id), null);
    assert.equal(walking.validId('42'), 42);
  });
  check('missing, cross-destination, wrong-endpoint and stale paths fail closed', () => {
    for (const candidate of [null, { ...row, destination_building_id: 99 },
      { ...row, path_geometry: [geometry[0], geometry[2]] },
      { ...row, path_geometry: [...geometry.slice(0, 2), { lat: 13.4062, lng: destination.lng }] },
      { ...row, distance_meters: 1 }, { ...row, walk_time_seconds: 1 }]) assert.equal(walking.shape(candidate, destination), null);
  });
  check('return reverses geometry without modifying entry or metrics', () => {
    const shaped = walking.shape(row, destination), entry = walking.forDirection(shaped, destination, 'entry'), exit = walking.forDirection(shaped, destination, 'exit');
    assert.deepEqual(entry.geometry, geometry); assert.deepEqual(exit.geometry, geometry.slice().reverse());
    assert.equal(entry.start.key, 'walking-guard-house'); assert.equal(exit.destination.key, 'walking-guard-house');
    assert.equal(entry.distance_meters, exit.distance_meters); assert.equal(entry.walk_time_seconds, exit.walk_time_seconds);
    exit.geometry[0].lat = 0; assert.deepEqual(shaped.geometry, geometry);
  });
  check('waypoints enforce numeric coordinates, bounds, field allowlist and count', () => {
    for (const p of [{ lat: '13', lng: 123 }, { lat: NaN, lng: 123 }, { lat: 91, lng: 123 }, { lat: 13, lng: 181 }, { lat: 13, lng: 123, secret: 'x' }, null]) {
      assert.equal(validatePathGeometry([geometry[0], p, geometry[2]], { fromNode: walking.ORIGIN, toNode: destination }).ok, false);
    }
    assert.equal(validatePathGeometry(Array(201).fill(geometry[0]), { fromNode: walking.ORIGIN, toNode: destination }).ok, false);
    const near = clone(geometry); near[0].lat += 0.0000001;
    assert.deepEqual(validatePathGeometry(near, { fromNode: walking.ORIGIN, toNode: destination, snapEndpoints: true }).value[0], geometry[0]);
  });
  const fixture = {
    buildings: [{ ...destination, id: 999, category: 'Academic', route_available: true, route_destination_id: 42 }],
    nodeRows: [{ id: 1, node_key: 'main-gate', label: 'Main Gate', lat: 13.404, lng: 123.371 },
      { id: 2, node_key: 'fixture-library', label: destination.name, node_type: 'building', building_id: 42, lat: destination.lat, lng: destination.lng }],
    edgeRows: [{ from_node_id: 1, to_node_id: 2, distance_meters: 220, walk_time_seconds: 180, is_accessible: 1,
      path_geometry: [{ lat: 13.404, lng: 123.371 }, { lat: destination.lat, lng: destination.lng }] }], walkingRows: [row], walkingBuildings: [destination]
  };
  check('offline package uses route-source identity and the authored path', () => {
    const guide = offline.buildGuide(fixture);
    assert.equal(guide.walkingOrigin.key, 'walking-guard-house'); assert.equal(guide.walkingRoutes.length, 1);
    assert.equal(guide.buildings[0].walkingRouteAvailable, true);
    assert.deepEqual(guide.walkingRoutes[0].geometry, geometry.map(p => [p.lng, p.lat]));
  });
  check('offline pin mismatch and missing path create no substitute', () => {
    const changed = clone(fixture); changed.buildings[0].lat += 0.001;
    assert.equal(offline.buildGuide(changed).walkingRoutes.length, 0);
    changed.buildings[0].lat = destination.lat; changed.walkingRows = [];
    assert.equal(offline.buildGuide(changed).walkingRoutes.length, 0);
  });
  const manager = fs.readFileSync(path.join(ROOT, 'public/js/offline-guide-manager.js'), 'utf8');
  const context = { GUIDE_SCHEMA: offline.GUIDE_SCHEMA || 'campusphere.offline-guide/1', MAX_BASEMAP_BYTES: 5 * 1024 * 1024,
    activeRecord: { guide: offline.buildGuide(fixture) } };
  for (const name of ['isHexHash', 'validateGuideEnvelope', 'walkingRouteFor', 'walkingUnavailableMessage']) {
    vm.runInNewContext(extractFunction(manager, name), context, { timeout: 1000 });
  }
  check('offline client accepts old vehicle-only guides and requests a walking update', () => {
    const guide = clone(context.activeRecord.guide); delete guide.walkingRoutes; delete guide.walkingOrigin;
    const payload = { success: true, schema: context.GUIDE_SCHEMA, fingerprint: 'a'.repeat(64), guide };
    assert.equal(context.validateGuideEnvelope(payload), guide);
    context.activeRecord = { guide };
    assert.equal(context.walkingRouteFor('fixture-library', false), null);
    assert.match(context.walkingUnavailableMessage(), /Update Offline Map while connected/);
    assert.equal(guide.routes.length, 1);
  });
  check('offline client validates refreshed endpoints and reverses the same route', () => {
    const guide = offline.buildGuide(fixture); context.activeRecord = { guide };
    const payload = { success: true, schema: context.GUIDE_SCHEMA, fingerprint: 'a'.repeat(64), guide };
    context.validateGuideEnvelope(payload);
    const entry = context.walkingRouteFor('fixture-library', false), exit = context.walkingRouteFor('fixture-library', true);
    assert.deepEqual(clone(exit.geometry), clone(entry.geometry).reverse()); assert.equal(exit.walkTimeSeconds, entry.walkTimeSeconds);
    const bad = clone(payload); bad.guide.walkingRoutes[0].geometry[0][0] += 0.01;
    assert.throws(() => context.validateGuideEnvelope(bad), /walking route geometry is invalid/);
  });
  const source = fs.readFileSync(path.join(ROOT, 'views/map.ejs'), 'utf8');
  for (const renderer of ['maplibre', 'leaflet']) for (const mode of ['vehicle', 'walking']) for (const isExit of [false, true]) {
    check(`${renderer} draws ${mode} ${isExit ? 'return' : 'entrance'} with its own style`, () => {
      const seen = {};
      const map = { getSource: () => null, getLayer: () => true, addSource: (key, data) => { seen.coords = data.data.geometry.coordinates; },
        addLayer: layer => { seen.paint = layer.paint; }, setPaintProperty: () => {}, fitBounds: () => {} };
      const frame = { MAP_RENDERER: renderer, maplibreMap: renderer === 'maplibre' ? map : null,
        leafletMap: renderer === 'leaflet' ? { fitBounds() {}, removeLayer() {} } : null, leafletRouteLayer: null,
        routeMode: mode, ENTRY_ROUTE_COLOR: '#2563eb', EXIT_ROUTE_COLOR: '#dc2626',
        L: { polyline(coords, style) { seen.coords = coords; seen.style = style; return { addTo() { return this; }, getBounds() { return []; } }; } } };
      for (const name of ['isValidRoutePointList', 'selectRoutePoints', 'drawComputedPath']) vm.runInNewContext(extractFunction(source, name), frame, { timeout: 1000 });
      assert.equal(frame.drawComputedPath({ geometry }, { isExit }), true);
      const color = isExit ? '#dc2626' : '#2563eb';
      if (renderer === 'maplibre') {
        assert.equal(seen.paint['line-color'], color); assert.equal(seen.paint['line-width'], mode === 'walking' ? 3 : 4);
        assert.deepEqual(clone(seen.paint['line-dasharray'] || []), mode === 'walking' ? [2, 2] : []);
        assert.deepEqual(clone(seen.coords), geometry.map(p => [p.lng, p.lat]));
      } else {
        assert.equal(seen.style.color, color); assert.equal(seen.style.weight, mode === 'walking' ? 3 : 4);
        assert.equal(seen.style.dashArray, mode === 'walking' ? '6 6' : undefined);
        assert.deepEqual(clone(seen.coords), geometry.map(p => [p.lat, p.lng]));
      }
    });
  }
  check('new lookups and cancellations clear old lines and reject late responses', () => {
    let cleared = 0;
    const frame = { routeRequestToken: 0, clearComputedPath() { cleared++; }, resetRoutePanelTransient() {}, rememberRoutePanelInvoker() {} };
    for (const name of ['beginRouteLookup', 'isCurrentRouteLookup', 'cancelRouteLookup']) vm.runInNewContext(extractFunction(source, name), frame, { timeout: 1000 });
    const first = frame.beginRouteLookup(), second = frame.beginRouteLookup();
    assert.equal(frame.isCurrentRouteLookup(first), false); assert.equal(frame.isCurrentRouteLookup(second), true);
    frame.cancelRouteLookup(); assert.equal(frame.isCurrentRouteLookup(second), false); assert.equal(cleared, 3);
  });
  check('migration sources are contiguous and both schemas have a separate walking table', () => {
    const files = fs.readdirSync(path.join(ROOT, 'database/supabase')).filter(f => f.endsWith('.sql')).sort();
    assert.equal(files.length, 30); files.forEach((file, index) => assert.equal(Number(file.slice(0, 4)), index + 1));
    const pg = fs.readFileSync(path.join(ROOT, 'database/supabase/0028_walking_2d_routes.sql'), 'utf8');
    assert.match(pg, /REVOKE ALL ON public\.walking_routes FROM PUBLIC, anon, authenticated/);
    assert.match(pg, /GRANT SELECT, INSERT, UPDATE, DELETE ON public\.walking_routes TO service_role/);
    assert.match(fs.readFileSync(path.join(ROOT, 'database/0028_walking_2d_routes.mysql.sql'), 'utf8'), /CREATE TABLE IF NOT EXISTS walking_routes/);
  });
}

function fixtures(mode) {
  const state = { rows: new Map(), fail: false, availability: true, ready: true, mismatch: false, duplicate: false, writes: 0, audits: [], queries: [] };
  const buildings = [destination, { id: 999, name: 'Different Building', lat: 13.407, lng: 123.375 }];
  const sql = { async query(text, params = []) {
    if (state.fail) throw new Error('private backend body');
    state.queries.push({ text, params });
    if (text.startsWith('SELECT')) {
      const rows = text.includes('FROM buildings') ? buildings : [...state.rows.values()];
      return [clone(text.includes('WHERE') ? rows.filter(r => (text.includes('FROM buildings') ? r.id : r.destination_building_id) === params[0]) : rows)];
    }
    if (text.startsWith('INSERT INTO walking_routes')) {
      state.writes++; state.rows.set(params[0], { destination_building_id: params[0], path_geometry: JSON.parse(params[1]), distance_meters: params[2], walk_time_seconds: params[3] }); return [{}];
    }
    if (text.startsWith('DELETE FROM walking_routes')) { state.writes++; state.rows.delete(params[0]); return [{}]; }
    throw new Error('Unknown fixture query');
  } };
  const client = { from(table) {
    let id, operation = 'select', payload, single = false;
    const chain = {
      select() { return chain; }, order() { return chain; },
      eq(key, value) { assert.equal(key, table === 'buildings' ? 'id' : 'destination_building_id'); id = value; return chain; },
      maybeSingle() { single = true; return chain; }, single() { single = true; return chain; },
      upsert(value, options) { assert.equal(options.onConflict, 'destination_building_id'); operation = 'save'; payload = clone(value); return chain; },
      delete() { operation = 'delete'; return chain; },
      then(resolve, reject) { return Promise.resolve().then(() => {
        if (state.fail) return { data: null, error: { message: 'private provider body' } };
        if (operation === 'save') { state.writes++; state.rows.set(payload.destination_building_id, payload); return { data: clone(payload), error: null }; }
        if (operation === 'delete') { state.writes++; state.rows.delete(id); return { data: null, error: null }; }
        const rows = (table === 'buildings' ? buildings : [...state.rows.values()]).filter(r => id === undefined || (table === 'buildings' ? r.id : r.destination_building_id) === id);
        return { data: clone(single ? rows[0] || null : rows), error: null };
      }).then(resolve, reject); }
    }; return chain;
  } };
  const repo = load('repositories/walkingRouteRepository.js', { '../config/supabase': { getSupabaseClient: () => client } });
  const service = load('services/walkingRouteService.js', {
    '../config/db': sql, '../config/mapRuntime': { isRouteSupabase: () => mode === 'supabase', isBuildingSupabase: () => true },
    '../repositories/walkingRouteRepository': repo, '../repositories/buildingRepository': { async listAll() {
      if (state.fail) throw new Error('private display backend body');
      const rows = [{ ...destination, id: 999, lat: destination.lat + (state.mismatch ? 0.001 : 0) }];
      if (state.duplicate) rows.push({ ...rows[0], id: 1000 }); return rows;
    } }
  });
  const audit = { async record(value) { state.audits.push(clone(value)); } };
  const canonicalKey = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const controller = load('controllers/walkingRouteController.js', {
    '../services/routeInstructionService': { async readForDestination() { return { instructions: [], instructionStatus: 'empty' }; } },
    '../services/walkingRouteService': service, '../services/auditService': audit,
    '../services/routeAvailability': { canonicalKey, async buildAvailabilityIndex() { return { ok: state.availability,
      byName: new Map([[canonicalKey(destination.name), { route_available: state.ready, route_destination_id: 42 }]]) }; } }
  });
  const mocks = { '../controllers/walkingRouteController': controller,
    '../middleware/roleAuth': load('middleware/roleAuth.js', { '../services/auditService': audit }),
    '../middleware/rateLimit': { adminMutationLimiter: (req, res, next) => next() } };
  mocks['../middleware/departmentAccess'] = load('middleware/departmentAccess.js', { './roleAuth': mocks['../middleware/roleAuth'] });
  const stub = new Proxy({}, { get: () => (req, res) => res.status(501).end() });
  for (const c of ['adminController', 'adminUsersController', 'adminContentController', 'adminBuildingsController', 'adminVrController', 'adminRouteController', 'adminScheduleController', 'adminRoomScheduleDocumentController', 'presenceController', 'mapController', 'offlineGuideController']) mocks['../controllers/' + c] = stub;
  return { state, service, admin: load('routes/admin.js', mocks), map: load('routes/map.js', mocks) };
}

async function backendChecks(mode) {
  const { state, service, admin: adminRouter, map } = fixtures(mode), app = express(); app.use(express.json());
  // Fixture-only session middleware: no application login or persistent store.
  app.use((req, res, next) => { const role = req.get('X-Fixture-Role'); req.session = role ? { user: { id: 7, role }, csrfToken: 'fixture-csrf-only' } : {}; next(); });
  app.use('/admin', adminRouter); app.use(map);
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = 'http://127.0.0.1:' + server.address().port, publicUrl = '/api/walking-routes/42', adminUrl = '/admin/api/walking-routes/42';
  const admin = { role: 'admin', method: 'PUT', token: 'fixture-csrf-only', body: { path_geometry: geometry } };
  async function expect(label, status, url = publicUrl, options = { role: 'guest' }, verify) {
    const response = await fetch(base + url, { method: options.method || 'GET', headers: { Accept: 'application/json',
      ...(options.role ? { 'X-Fixture-Role': options.role } : {}), ...(options.token ? { 'X-CSRF-Token': options.token } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}), signal: AbortSignal.timeout(5000) });
    const body = await response.json();
    check(mode + ': ' + label, () => { assert.equal(response.status, status); assert.equal(response.headers.get('cache-control'), 'no-store, private'); if (verify) verify(body); });
  }
  try {
    await expect('anonymous read denied', 401, publicUrl, {});
    for (const method of ['GET', 'PUT', 'DELETE']) for (const role of [null, 'guest', 'student-cspc', 'instructor']) {
      await expect((role || 'anonymous') + ' admin ' + method + ' denied', role ? 403 : 401, adminUrl, { role, method, token: admin.token, body: method === 'PUT' ? admin.body : undefined });
    }
    await expect('missing CSRF rejected', 403, adminUrl, { ...admin, token: null });
    await expect('invalid CSRF rejected', 403, adminUrl, { ...admin, token: 'wrong' });
    check(mode + ': denied requests cannot write', () => assert.equal(state.writes, 0));
    await expect('missing path remains unavailable', 200, publicUrl, { role: 'guest' }, b => assert.equal(b.route, null));
    await expect('invalid destination rejected', 400, '/api/walking-routes/42x');
    await expect('unknown destination rejected', 404, '/api/walking-routes/12345');
    await expect('invalid direction rejected', 400, publicUrl + '?direction=reverse');
    await expect('identity and metrics payload override rejected', 400, adminUrl, { ...admin, body: { ...admin.body, distance_meters: 1 } });
    await expect('straight-line substitute rejected', 400, adminUrl, { ...admin, body: { path_geometry: [geometry[0], geometry[2]] } });
    const wrong = clone(geometry); wrong[0].lat += 0.001;
    await expect('incorrect starting pin rejected', 400, adminUrl, { ...admin, body: { path_geometry: wrong } });
    const bad = clone(geometry); bad[1].lng = '123.3738';
    await expect('coordinate coercion rejected', 400, adminUrl, { ...admin, body: { path_geometry: bad } });
    await expect('mixed-source display ID cannot select another building', 409, '/admin/api/walking-routes/999', admin);
    state.mismatch = true; await expect('mixed-source pin mismatch prevents save', 409, adminUrl, admin); state.mismatch = false;
    state.duplicate = true; await expect('ambiguous display identity prevents save', 409, adminUrl, admin); state.duplicate = false;
    state.ready = false; await expect('route setup required before drawing', 409, adminUrl, admin); state.ready = true;
    await expect('save calculates distance and time', 200, adminUrl, admin, b => { assert.equal(b.distance_meters, 132); assert.equal(b.walk_time_seconds, 110); });
    await expect('reload returns persisted geometry', 200, adminUrl, { role: 'admin' }, b => assert.deepEqual(b.path_geometry, geometry));
    for (const role of ['guest', 'student-cspc', 'instructor', 'admin']) await expect(role + ' can read walking route', 200, publicUrl, { role }, b => assert.deepEqual(b.route.geometry, geometry));
    await expect('exit reverses path with equal metrics', 200, publicUrl + '?direction=exit', { role: 'guest' }, b => { assert.deepEqual(b.route.geometry, geometry.slice().reverse()); assert.equal(b.route.distance_meters, metrics.distance_meters); });
    const updated = clone(geometry); updated.splice(1, 0, { lat: 13.40575, lng: 123.3740 });
    await expect('update replaces selected path', 200, adminUrl, { ...admin, body: { path_geometry: updated } });
    await expect('updated geometry survives reload', 200, adminUrl, { role: 'admin' }, b => assert.deepEqual(b.path_geometry, updated));
    await expect('list reports one saved path by route ID', 200, '/admin/api/walking-routes', { role: 'admin' }, b => { assert.equal(b.destinations.filter(d => d.walkingReady).length, 1); assert.equal(b.destinations.find(d => d.walkingReady).id, 42); });
    const display = [{ ...destination, id: 999, route_destination_id: 42, route_available: true }];
    const decorated = await service.decorate(clone(display));
    check(mode + ': display and route IDs may differ safely', () => assert.equal(decorated.buildings[0].walking_available, true));
    state.mismatch = true; await expect('changed display pin withholds route', 200, publicUrl, { role: 'guest' }, b => assert.equal(b.route, null)); state.mismatch = false;
    state.availability = false; await expect('availability error returns sanitized 503', 503, publicUrl, { role: 'guest' }, b => assert.equal(b.message, 'Walking routes are temporarily unavailable.'));
    await expect('availability failure prevents save', 503, adminUrl, admin); state.availability = true;
    state.fail = true; await expect('read backend failure is sanitized', 503, publicUrl, { role: 'guest' }, b => assert.equal(b.message, 'Walking routes are temporarily unavailable.'));
    await expect('write backend failure is sanitized', 503, adminUrl, admin);
    await expect('delete backend failure is sanitized', 503, adminUrl, { ...admin, method: 'DELETE', body: undefined });
    const unavailable = await service.decorate(clone(display));
    check(mode + ': backend error fails availability closed', () => { assert.equal(unavailable.ok, false); assert.equal(unavailable.buildings[0].walking_available, false); }); state.fail = false;
    await expect('remove selected fixture path', 200, adminUrl, { ...admin, method: 'DELETE', body: undefined });
    await expect('removed path reloads as unavailable', 200, publicUrl, { role: 'guest' }, b => assert.equal(b.route, null));
    check(mode + ': audit records use only approved metadata', () => {
      const records = state.audits.filter(a => a.event_type === 'admin_mutation'); assert.equal(records.length, 3); assert.equal(state.writes, 3);
      for (const audit of records) {
        assert.deepEqual(Object.keys(audit).sort(), ['event_type', 'action', 'outcome', 'actor_user_id', 'actor_role', 'target_type', 'target_id', 'message'].sort());
        assert.equal(audit.actor_user_id, 7); assert.equal(audit.target_id, 42);
        assert.ok(['admin.walking_route.update', 'admin.walking_route.delete'].includes(audit.action)); assert.doesNotMatch(JSON.stringify(audit), /path_geometry|13\.405|private|csrf|token/);
      }
    });
    if (mode === 'mysql') check('MySQL writes bind values as parameters', () => { assert.ok(state.queries.some(q => q.text.includes('VALUES (?, ?, ?, ?)') && q.params[0] === 42)); assert.ok(state.queries.every(q => !q.text.includes('13.405'))); });
  } finally { server.closeAllConnections(); await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
}
async function main() {
  pureChecks(); await backendChecks('mysql'); await backendChecks('supabase');
  console.log(`WALKING-2D-ROUTES OK: ${checks}/${checks} checks passed (isolated fixtures; no live database writes).`);
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
