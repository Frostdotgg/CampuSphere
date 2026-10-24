'use strict';
// Run only inside the owned, disposable Docker fixture, never the ordinary
// localhost stack (which may use shared Supabase). No canonical credentials.
if (!process.argv.includes('--fixture') || process.env.DB_HOST !== 'cs-instructions-mysql' ||
    process.env.AUTH_DATA_SOURCE !== 'mysql' || process.env.ROUTE_DATA_SOURCE !== 'mysql') {
  throw new Error('This probe requires the isolated route-instructions Docker fixture.');
}
const assert = require('node:assert/strict'), fs = require('node:fs');
const db = require('../config/db');
const { createProbeSessionTracker, getStableCsrfToken } = require('./probeSessionLifecycle');
const info = JSON.parse(fs.readFileSync('/fixture/local-session.json', 'utf8'));
const base = 'http://127.0.0.1:3000';
let checks = 0, cookie = '';
function check(label, fn) { fn(); checks++; console.log('[PASS] ' + label); }
const jar = { header: () => cookie, apply(response) { for (const value of response.headers.getSetCookie()) if (value.startsWith('campusphere.sid=')) cookie = value.split(';')[0]; } };
const tracker = createProbeSessionTracker({ base, record(label, pass) { check(label, () => assert.equal(pass, true)); } });
async function request(url, { method = 'GET', body, token } = {}) {
  const response = await fetch(base + url, { method, redirect: 'manual', signal: AbortSignal.timeout(10000), headers: {
    Accept: 'application/json', Cookie: cookie, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { 'X-CSRF-Token': token } : {})
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  jar.apply(response); const text = await response.text(); let data; try { data = JSON.parse(text); } catch (_) { data = text; }
  return { response, data };
}
async function snapshot() {
  const result = {};
  for (const table of ['buildings', 'route_nodes', 'route_edges', 'walking_routes']) result[table] = (await db.query('SELECT * FROM ' + table + ' ORDER BY ' + (table === 'walking_routes' ? 'destination_building_id' : 'id')))[0];
  return JSON.stringify(result);
}
async function main() {
  try {
    const auth = await request('/auth'); const token = /name="_csrf"[^>]*value="([^"]+)"/.exec(auth.data)?.[1] || /name="csrf-token"[^>]*content="([^"]+)"/.exec(auth.data)?.[1];
    assert.ok(token); const login = await request('/login', { method: 'POST', body: { email: info.email, password: info.password, _csrf: token } });
    tracker.register('local synthetic administrator', jar, '/admin');
    check('fixture login succeeds', () => { assert.equal(login.response.status, 302); assert.equal(login.response.headers.get('location'), '/admin'); });
    const csrf = await getStableCsrfToken({ base, jar }), before = await snapshot();
    const expected = new Map();
    for (const [mode, direction] of [['vehicle', 'entry'], ['vehicle', 'exit'], ['walking', 'entry'], ['walking', 'exit']]) {
      const url = mode === 'vehicle' && direction === 'entry' ? '/admin/api/routes/42/steps' : '/admin/api/route-instructions/42?mode=' + mode + '&direction=' + direction;
      const read = await request(url); check(mode + ' ' + direction + ' editor reload', () => { assert.equal(read.response.status, 200); assert.ok(read.data.steps.length > 0); });
      expected.set(mode + '/' + direction, read.data.steps.map(s => s.instruction));
      const routeUrl = mode === 'walking' ? '/api/walking-routes/42?direction=' + direction : direction === 'entry' ? '/api/pathfind?start=main-gate&destinationBuildingId=42' : '/api/pathfind?direction=exit&startBuildingId=42';
      const result = await request(routeUrl); check(mode + ' ' + direction + ' computed route shows the selected list', () => {
        assert.equal(result.response.status, 200); assert.equal(result.data.route.instructionStatus, 'saved');
        assert.deepEqual(result.data.route.instructions.map(s => s.instruction), expected.get(mode + '/' + direction));
        assert.ok(result.data.route.geometry.length >= 3); assert.ok(result.data.route.distance_meters > 0); assert.ok(result.data.route.walk_time_seconds > 0);
      });
    }
    const predefined = await request('/api/routes/42');
    check('predefined route and pin navigation agree for Vehicle entry', () => assert.deepEqual(predefined.data.route.steps.map(s => s.instruction), expected.get('vehicle/entry')));
    const legacyUrl = '/admin/api/routes/43/steps', legacyRead = await request(legacyUrl);
    const originalSteps = legacyRead.data.steps.map(({ step_order, instruction, landmark, lat, lng }) => ({ step_order, instruction, landmark, lat, lng }));
    const clearLegacy = await request(legacyUrl, { method: 'PUT', token: csrf, body: { steps: [] } });
    const clearedLegacy = await request(legacyUrl);
    check('legacy Vehicle entry supports an empty-list clear', () => { assert.equal(clearLegacy.response.status, 200); assert.deepEqual(clearedLegacy.data.steps, []); });
    const restoredLegacy = await request(legacyUrl, { method: 'PUT', token: csrf, body: { steps: originalSteps } });
    check('legacy Vehicle entry restores its original optional fields', () => { assert.equal(restoredLegacy.response.status, 200); assert.deepEqual(restoredLegacy.data.steps.map(({ step_order, instruction, landmark, lat, lng }) => ({ step_order, instruction, landmark, lat, lng })), originalSteps); });
    await db.query("CREATE TRIGGER fixture_reject_instruction BEFORE INSERT ON campus_route_steps FOR EACH ROW SET NEW.instruction = IF(NEW.instruction = '__fixture_fail__', NULL, NEW.instruction)");
    try {
      const failedLegacy = await request(legacyUrl, { method: 'PUT', token: csrf, body: { steps: [{ instruction: 'First transient row' }, { instruction: '__fixture_fail__' }] } });
      const preserved = await request(legacyUrl);
      check('legacy multi-row save rolls back after an injected partial failure', () => { assert.equal(failedLegacy.response.status, 500); assert.deepEqual(preserved.data.steps.map(({ step_order, instruction, landmark, lat, lng }) => ({ step_order, instruction, landmark, lat, lng })), originalSteps); });
    } finally { await db.query('DROP TRIGGER fixture_reject_instruction'); }
    for (const id of [43, 44, 45]) {
      const result = await request('/api/pathfind?start=main-gate&destinationBuildingId=' + id);
      check('Academic I instructions never appear for destination ' + id, () => { assert.equal(result.data.route.instructionStatus, 'saved'); assert.ok(result.data.route.instructions.every(s => !expected.get('vehicle/entry').includes(s.instruction))); });
    }
    const packageResult = await request('/api/offline-guide'), guide = packageResult.data.guide;
    check('new downloaded guide uses explicit instruction format', () => { assert.equal(packageResult.response.status, 200); assert.equal(guide.instructionFormat, 1); });
    const find = rows => rows.find(r => r.destinationKey === 'academic-building-i' || r.buildingKey === 'academic-building-i');
    check('offline Vehicle entry equals online', () => assert.deepEqual(find(guide.routes).steps.map(s => s.instruction), expected.get('vehicle/entry')));
    check('offline Vehicle return equals online', () => assert.deepEqual(find(guide.exitRoutes).steps.map(s => s.instruction), expected.get('vehicle/exit')));
    check('offline Walking entry equals online', () => assert.deepEqual(find(guide.walkingRoutes).steps.map(s => s.instruction), expected.get('walking/entry')));
    check('offline Walking return is explicit and independent', () => assert.deepEqual(find(guide.walkingRoutes).returnSteps.map(s => s.instruction), expected.get('walking/exit')));
    const selectedUrl = '/admin/api/route-instructions/43?mode=walking&direction=exit';
    const badCsrf = await request(selectedUrl, { method: 'PUT', body: { steps: [] } }); check('real server rejects missing CSRF', () => assert.equal(badCsrf.response.status, 403));
    const blank = await request(selectedUrl, { method: 'PUT', body: { steps: [{ instruction: ' ' }] }, token: csrf }); check('real server rejects unfinished row', () => assert.equal(blank.response.status, 400));
    for (const instructions of [['FIXTURE second', 'FIXTURE first'], []]) {
      const saved = await request(selectedUrl, { method: 'PUT', body: { steps: instructions.map(instruction => ({ instruction })) }, token: csrf });
      const reloaded = await request(selectedUrl); check('atomic selected-list save/reload length ' + instructions.length, () => { assert.equal(saved.response.status, 200); assert.deepEqual(reloaded.data.steps.map(s => s.instruction), instructions); });
    }
    const empty = await request('/api/walking-routes/43?direction=exit'); check('cleared selected list has empty status', () => assert.equal(empty.data.route.instructionStatus, 'empty'));
    await db.query("INSERT INTO campus_routes(id,title,start_label,destination_building_id) VALUES(142,'Disposable ambiguous route','Main Gate',42)");
    try {
      const ambiguous = await request('/api/pathfind?start=main-gate&destinationBuildingId=42'); check('ambiguous configuration withholds text but retains geometry', () => { assert.equal(ambiguous.data.route.instructionStatus, 'unavailable'); assert.deepEqual(ambiguous.data.route.instructions, []); assert.ok(ambiguous.data.route.geometry.length >= 3); });
      const unavailable = await request('/api/offline-guide'); check('ambiguous offline snapshot refuses incomplete download', () => assert.equal(unavailable.response.status, 503));
    } finally { await db.query('DELETE FROM campus_routes WHERE id=142'); }
    await db.query('RENAME TABLE campus_route_instruction_lists TO fixture_unavailable_instruction_lists');
    try {
      const unavailable = await request('/api/walking-routes/42'); check('instruction read outage keeps Walking geometry and unavailable status', () => { assert.equal(unavailable.response.status, 200); assert.equal(unavailable.data.route.instructionStatus, 'unavailable'); assert.ok(unavailable.data.route.geometry.length >= 3); });
    } finally { await db.query('RENAME TABLE fixture_unavailable_instruction_lists TO campus_route_instruction_lists'); }
    const after = await snapshot();
    check('instruction edits preserve every building, node, edge and Walking path byte', () => assert.equal(after, before));
    console.log('LOCAL-ROUTE-INSTRUCTIONS checks complete.');
  } finally { await tracker.terminateAll(); await db.end(); }
  console.log('DOCKER-ROUTE-INSTRUCTIONS OK: ' + checks + '/' + checks + ' checks passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
