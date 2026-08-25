'use strict';

/*
 * M12.P1-D4 transition probe.
 *
 * The former D4 schedule editor managed legacy time rows. That editor was
 * intentionally replaced by semester-long room-schedule image documents;
 * keeping the old mock-DOM assertions would test a removed product surface.
 * This bounded probe covers the surviving graph search client, the new
 * document-management UI contracts, and a self-cleaning dual-backend HTTP
 * CRUD/rejection path. It never calls Cloudinary or prints credentials,
 * cookies, tokens, identifiers, or backend errors.
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { withServer } = require('./with-server');
const { hasSupabaseConfig } = require('../config/supabase');
const { getRegressionCredentials } = require('./regressionCredentials');
const { createProbeSessionTracker, getStableCsrfToken } = require('./probeSessionLifecycle');
const S = require('../utils/scheduleSearch');

const ROOT = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const RUN_ID = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
const PREFIX = ('D4_ROOM_' + RUN_ID).slice(0, 50);
const failures = [];

function check(scope, label, condition) {
  const ok = Boolean(condition);
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!ok) failures.push(`${scope} :: ${label}`);
}

function cookieJar() {
  const jar = {};
  return {
    apply(response) {
      const cookies = response.headers.getSetCookie
        ? response.headers.getSetCookie()
        : (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')] : []);
      for (const cookie of cookies) {
        const first = cookie.split(';')[0];
        const index = first.indexOf('=');
        if (index > 0) jar[first.slice(0, index).trim()] = first.slice(index + 1).trim();
      }
    },
    header() { return Object.entries(jar).map(([key, value]) => `${key}=${value}`).join('; '); },
  };
}

function csrfFromHtml(html) {
  const match = String(html).match(/name="csrf-token" content="([^"]+)"/);
  return match ? match[1] : '';
}

function runPureChecks() {
  console.log('\n[pure] retained search safety helpers');
  check('pure', 'blank and whitespace-only search means no filter',
    S.normalizeSearchQuery('').value === null && S.normalizeSearchQuery('  ').value === null);
  check('pure', 'bounded search accepts exactly the configured maximum',
    S.normalizeSearchQuery('a'.repeat(S.SEARCH_MAX)).ok === true);
  check('pure', 'overlong search is rejected without echoing input',
    S.normalizeSearchQuery('SECRET'.repeat(40)).ok === false &&
    S.normalizeSearchQuery('SECRET'.repeat(40)).message.indexOf('SECRET') === -1);
  check('pure', 'MySQL LIKE metacharacters are escaped',
    S.mysqlLikePattern('A%B_C') === '%a\\%b\\_c%');
  check('pure', 'PostgREST wildcard encoding cannot add a disjunct',
    S.supabaseScheduleOrExpression('x",id.gte."0', []).split('.ilike.').length - 1 === 4);
  check('pure', 'exact search is case-insensitive and substring-based',
    S.matchesScheduleSearch({ title: 'Room 204', location_label: 'CS Lab' }, 'ROOM') &&
    !S.matchesScheduleSearch({ title: 'Room 204' }, 'Gym'));
}

function runStaticChecks() {
  console.log('\n[static] graph search and semester image-management contracts');
  const view = read('views/admin/campus-map.ejs');
  const schedules = read('public/js/admin/admin-schedules.js');
  const graph = read('public/js/admin/admin-map-graph.js');
  const css = read('public/css/admin-styles.css');
  const adminController = read('controllers/adminRoomScheduleDocumentController.js');
  const migration = read('database/supabase/0020_room_schedule_documents.sql');
  const adminRoutes = read('routes/admin.js');

  check('static', 'new admin form accepts delivery metadata and no file upload',
    view.includes('id="schedule-image-url"') && view.includes('name="cloudinary_public_id"') &&
    !/<input[^>]+type="file"[^>]+schedule/i.test(view));
  check('static', 'admin client uses the room-schedule-document API',
    schedules.includes('/admin/api/room-schedule-documents') && schedules.includes('MAX_LOADED_DOCUMENTS = 2000'));
  check('static', 'admin client has distinct loading, empty, filtered-empty, and retry states',
    ['schedule-loading', 'schedule-empty', 'schedule-filtered-empty', 'schedule-retry']
      .every((id) => view.includes(`id="${id}"`)));
  check('static', 'admin client never calls Cloudinary management or upload APIs',
    !/api\.cloudinary\.com|upload_preset|unsigned_upload|destroy/i.test(schedules));
  check('static', 'admin client uses safe DOM text rendering and validates delivery host',
    schedules.includes('.textContent') && !/innerHTML|insertAdjacentHTML|document\.write/.test(schedules) &&
    schedules.includes("parsed.hostname === 'res.cloudinary.com'"));
  check('static', 'school year and delivery URL validation are server-side',
    adminController.includes('validateSchoolYear') && adminController.includes('validateCloudinaryImage') &&
    adminController.includes('validateCloudinaryPublicId'));
  check('static', 'migration 0020 adds the document table and direct hotspot link',
    migration.includes('room_schedule_documents') && migration.includes('schedule_document_id') &&
    /ADD COLUMN IF NOT EXISTS schedule_document_id/i.test(migration));
  check('static', 'legacy time-row mutations are retired',
    !/router\.(?:post|put|delete)\('\/api\/schedules/.test(adminRoutes));
  check('static', 'route, node, and edge searches remain labelled graph controls',
    ['route-search', 'node-search', 'edge-search'].every((id) => view.includes(`id="${id}"`)) &&
    graph.includes('fieldsForRoute') && graph.includes('fieldsForNode') && graph.includes('fieldsForEdge'));
  check('static', 'graph client renders backend values through text APIs',
    !/\binnerHTML\s*=|insertAdjacentHTML|document\.write/.test(graph));
  check('static', 'graph controls and schedule controls retain keyboard-sized targets',
    /min-height:\s*44px/.test(css) && /:focus-visible[\s\S]{0,220}outline:/.test(css));
}

/* Database-free graph-client smoke. It deliberately avoids the removed
 * legacy schedule form and only exercises the still-live Routes/Nodes/Edges
 * panel contracts. */
async function runGraphClientChecks() {
  console.log('\n[client-graph] graph panel search smoke');
  const graph = read('public/js/admin/admin-map-graph.js');
  check('client-graph', 'route search covers destination and walk-time fields',
    /estimated_walk_time/.test(graph) && /destination_name/.test(graph));
  check('client-graph', 'node search covers key, label, type, and building name',
    /node_key/.test(graph) && /node_type/.test(graph) && /buildingNameForId/.test(graph));
  check('client-graph', 'edge search covers endpoint labels and geometry metadata',
    /from_label/.test(graph) && /to_label/.test(graph) && /walk_time_seconds/.test(graph));
  check('client-graph', 'same-node edge validation remains fail-closed',
    graph.includes('An edge cannot connect a node to itself.'));
}

async function runLiveMode(mode, base) {
  console.log(`\n${mode} mode:`);
  const creds = getRegressionCredentials(mode);
  const jar = cookieJar();
  const bodies = [];
  let response = await fetch(base + '/auth', { headers: { Accept: 'text/html' } });
  jar.apply(response);
  const csrf = csrfFromHtml(await response.text());
  response = await fetch(base + '/login', {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.header() },
    body: `email=${encodeURIComponent(creds.admin.email)}&password=${encodeURIComponent(creds.admin.password)}&_csrf=${encodeURIComponent(csrf)}`,
  });
  jar.apply(response);
  check(mode, 'admin login succeeds', response.status === 302);
  const sessions = createProbeSessionTracker({ base, record: (label, ok) => check(mode, label, ok) });
  if (response.status === 302) sessions.register('admin', jar, '/admin/campus-map');
  if (response.status !== 302) return;

  let token = '';
  const created = [];
  const getJson = async (url, options = {}) => {
    const result = await fetch(base + url, {
      ...options,
      headers: { Accept: 'application/json', Cookie: jar.header(), ...(options.headers || {}) },
    });
    const text = await result.text();
    bodies.push(text);
    let json = null; try { json = JSON.parse(text); } catch (error) {}
    return { status: result.status, json };
  };

  try {
    try {
      token = await getStableCsrfToken({ base, jar });
    check(mode, 'stable CSRF token available', token.length > 0);
    const buildings = await getJson('/api/buildings');
    const buildingId = Number(buildings.json && buildings.json.buildings && buildings.json.buildings[0] && buildings.json.buildings[0].id);
    check(mode, 'fixture building is available', Number.isInteger(buildingId) && buildingId > 0);
    if (!Number.isInteger(buildingId) || buildingId <= 0 || !token) return;

    const payload = {
      building_id: buildingId,
      location_type: 'room',
      location_label: PREFIX + ' CSLAB',
      floor_label: 'Third Floor',
      semester: 'first-semester',
      school_year: '2098-2099',
      image_url: 'https://res.cloudinary.com/demo/image/upload/sample.png',
      cloudinary_public_id: 'CampuSphere/room-schedules/' + PREFIX.toLowerCase(),
    };
    const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': token };
    const createdResult = await getJson('/admin/api/room-schedule-documents', {
      method: 'POST', headers, body: JSON.stringify(payload),
    });
    const documentId = Number(createdResult.json && createdResult.json.document && createdResult.json.document.id);
    if (Number.isInteger(documentId) && documentId > 0) created.push(documentId);
    check(mode, 'room schedule image document creates through admin API',
      createdResult.status === 201 && Number.isInteger(documentId) && documentId > 0);

    const listed = await getJson('/admin/api/room-schedule-documents?q=' + encodeURIComponent(PREFIX));
    check(mode, 'admin search returns exactly the prefixed document',
      listed.status === 200 && listed.json && listed.json.total === 1 && listed.json.documents.length === 1);

    const duplicate = await getJson('/admin/api/room-schedule-documents', {
      method: 'POST', headers, body: JSON.stringify(payload),
    });
    check(mode, 'duplicate room identity is rejected with conflict', duplicate.status === 409);

    const legacyWrite = await getJson('/admin/api/schedules', {
      method: 'POST', headers, body: JSON.stringify({ title: PREFIX }),
    });
    check(mode, 'legacy time-row mutation is unavailable', legacyWrite.status === 404 || legacyWrite.status === 405);

    const updated = await getJson('/admin/api/room-schedule-documents/' + documentId, {
      method: 'PUT', headers,
      body: JSON.stringify({ ...payload, cloudinary_public_id: payload.cloudinary_public_id + '-updated' }),
    });
    check(mode, 'room schedule metadata updates without uploading a file',
      updated.status === 200 && updated.json && updated.json.document &&
      updated.json.document.cloudinary_public_id.endsWith('-updated'));

    const publicRead = await getJson('/api/room-schedule-documents/' + documentId);
    check(mode, 'authenticated viewer endpoint returns a private document shape',
      publicRead.status === 200 && publicRead.json && publicRead.json.document &&
      !('cloudinary_public_id' in publicRead.json.document));
    } finally {
      for (const id of created) {
        await getJson('/admin/api/room-schedule-documents/' + id, {
          method: 'DELETE', headers: { 'X-CSRF-Token': token },
        }).catch(() => {});
      }
      const after = await getJson('/admin/api/room-schedule-documents?q=' + encodeURIComponent(PREFIX));
      check(mode, 'zero prefixed room schedule fixtures remain after cleanup',
        after.status === 200 && after.json && after.json.total === 0);
    }
  } finally {
    await sessions.terminateAll();
  }

  const leak = bodies.join('\n');
  check(mode, 'response bodies contain no credential or session-cookie markers',
    !/SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|CLOUDINARY_API_SECRET|campusphere\.sid=|eyJ[A-Za-z0-9_-]{10,}\./i.test(leak));
}

(async () => {
  console.log('=== CampuSphere Admin Campus-Map transition probe (M12.P1-D4) ===');
  runPureChecks();
  await runGraphClientChecks();
  runStaticChecks();
  await withServer({ mode: 'mysql', port: 3486, sessionStore: 'mysql' }, (base) => runLiveMode('mysql', base));
  if (process.env.PROBE_SKIP_SUPABASE === '1' && !hasSupabaseConfig()) {
    console.log('\nsupabase mode: SKIP — Supabase environment is not configured.');
  } else {
    await withServer({ mode: 'supabase', port: 3487, sessionStore: 'supabase' }, (base) => runLiveMode('supabase', base));
  }
  if (failures.length === 0) {
    console.log('\nADMIN-CAMPUS-MAP-SEARCH-FILTER-PROBE OK: all checks passed.');
    process.exitCode = 0;
  } else {
    console.error(`ADMIN-CAMPUS-MAP-SEARCH-FILTER-PROBE FAILED: ${failures.length} check(s) did not pass:`);
    failures.forEach((failure) => console.error('  - ' + failure));
    process.exitCode = 1;
  }
})().catch(() => {
  console.error('ADMIN-CAMPUS-MAP-SEARCH-FILTER-PROBE FAILED: sanitized harness failure.');
  process.exitCode = 1;
});
