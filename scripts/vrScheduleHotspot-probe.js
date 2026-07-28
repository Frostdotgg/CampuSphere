'use strict';

/* ========================================
   CampuSphere - VR Schedule Hotspot probe
   Milestone 11, Section 11.8A verification script.

   Boots through scripts/with-server.js (never a foreground server) in both
   runtime modes and verifies the room-door schedule interaction contract:
     - admin creates a real room schedule row through /admin/api/schedules
     - admin creates a VR hotspot of type "schedule" with exact schedule
       metadata through /admin/api/vr/scenes/:sceneId/hotspots
     - validation rejects missing location label and non-existent building
     - authenticated student can load the VR page and see the schedule hotspot
       fallback button markup
     - authenticated student can fetch the exact room/floor schedule through
       /api/buildings/:id/schedules with the new location filters
     - wrong floor returns an empty list
     - cleanup removes every probe schedule/hotspot row through admin APIs
     - leak scan checks captured bodies for secrets/raw DB text/stacks.

   Prints fixed PASS/FAIL labels only. No raw rows, cookies, secrets, raw
   request bodies, raw DB errors, or stack traces are printed.
   ======================================== */

require('dotenv').config();

const { withServer } = require('./with-server');
const { hasSupabaseConfig } = require('../config/supabase');

const runId = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
const PROBE_PREFIX = 'M11_DOOR_PROBE_';
const PROBE_TITLE = (PROBE_PREFIX + runId).slice(0, 150);
const PROBE_LABEL = ('Door Lab ' + runId).slice(0, 120);
const PROBE_FLOOR = 'Ground Floor';
const PROBE_DATE = '2099-04-10';
const PROBE_FROM = '2099-04-01';
const PROBE_TO = '2099-04-20';
// M12.P1-R1: regression identities come from the shared TEST-ONLY loader —
// deterministic local fixtures for the MySQL leg, SUPABASE_REGRESSION_* env
// (fail-closed, never printed) for the Supabase leg. No hardcoded
// live-capable credential remains in this probe.
const { getRegressionCredentials } = require('./regressionCredentials');
// Shared probe session ownership (scripts/probeSessionLifecycle.js): every
// canonical identity authenticated here is terminated through the real logout
// interface so `npm test` leaves no persisted regression session behind.
const { createProbeSessionTracker } = require('./probeSessionLifecycle');

const failures = [];
function check(scope, label, ok) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!ok) failures.push(`${scope} :: ${label}`);
}

function cookieJar() {
  const cookies = new Map();
  return {
    apply(res) {
      let list = [];
      if (typeof res.headers.getSetCookie === 'function') list = res.headers.getSetCookie() || [];
      else { const sc = res.headers.get('set-cookie'); if (sc) list = [sc]; }
      for (const sc of list) {
        const pair = String(sc).split(';')[0];
        const eq = pair.indexOf('=');
        if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    },
    header() {
      return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    },
  };
}

function metaCsrf(html) {
  const m = /<meta name="csrf-token" content="([^"]*)"/.exec(html || '');
  return m ? m[1] : '';
}

const LEAK_PATTERNS = [
  ['JWT-like token', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['Supabase host', /[a-z0-9-]+\.supabase\.(co|com|in)/i],
  ['stack frame', /\bat [\w.$<>[\] ]+ \((?:file:\/\/|\/|[A-Za-z]:\\)[^)]*:\d+:\d+\)/],
  ['SQL/driver/PostgREST text', /sqlMessage|ER_[A-Z_]{3,}|SQLSTATE|PostgREST|relation "[^"]+" does not exist|syntax error at or near/i],
  ['session cookie value', /campusphere\.sid=/],
  ['Supabase/Cloudinary credential name', /SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|CLOUDINARY_API_KEY|CLOUDINARY_API_SECRET/],
];

async function runMode(mode, base) {
  // M12.P1-R1: this leg's server has AUTH_DATA_SOURCE === mode (with-server
  // forces all six switches), so resolve matching regression credentials.
  const creds = getRegressionCredentials(mode);
  const ADMIN_EMAIL = creds.admin.email;
  const ADMIN_PASS = creds.admin.password;
  const STUDENT_EMAIL = creds.student.email;
  const STUDENT_PASS = creds.student.password;
  const bodies = [];

  async function jfetch(url, options) {
    const res = await fetch(base + url, options);
    const text = await res.text();
    bodies.push(text);
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* HTML or empty */ }
    return { status: res.status, text, json };
  }

  async function login(email, pass) {
    const jar = cookieJar();
    const pre = await fetch(base + '/auth', { headers: { Accept: 'text/html' } });
    jar.apply(pre);
    const csrf0 = metaCsrf(await pre.text());
    const r = await fetch(base + '/login', {
      method: 'POST', redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.header() },
      body: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(pass)}&_csrf=${encodeURIComponent(csrf0)}`,
    });
    jar.apply(r);
    return { ok: r.status === 302, jar };
  }

  async function stableAdminPage(jar) {
    let prevTok = null;
    let html = '';
    for (let i = 0; i < 6; i++) {
      const r = await fetch(base + '/admin/vr', { headers: { Accept: 'text/html', Cookie: jar.header() } });
      jar.apply(r);
      html = await r.text();
      const tok = metaCsrf(html);
      if (tok && tok === prevTok) return { csrf: tok, html };
      prevTok = tok;
    }
    return { csrf: prevTok || '', html };
  }

  let admin = null;
  let csrf = '';
  let sceneId = null;
  let sceneKey = '';
  // One tracker per withServer/runMode invocation.
  const sessions = createProbeSessionTracker({
    base,
    record: (label, pass) => check(mode, label, pass),
  });

  let buildingId = null;
  let scheduleId = null;
  let hotspotId = null;

  /* Outer try: session termination is the OUTERMOST finally — after fixture
     cleanup, even if that cleanup throws, and on every early return below. The
     inner block is intentionally NOT re-indented (minimal diff). */
  try {
  try {
    admin = await login(ADMIN_EMAIL, ADMIN_PASS);
    check(mode, 'admin login -> 302', admin.ok);
    if (admin.ok) sessions.register('admin', admin.jar, '/admin/faqs');
    if (!admin.ok) return bodies;
    const page = await stableAdminPage(admin.jar);
    bodies.push(page.html);
    csrf = page.csrf;
    check(mode, 'admin CSRF token available', csrf.length > 0);
    // Pre-Milestone-12 UX repair: the schedule-hotspot form offers a building
    // dropdown (a <select> still named schedule_building_id, options provided
    // server-side via #vr-admin-buildings-json) instead of a numeric-id input.
    check(mode, '/admin/vr schedule form uses a building dropdown (no numeric id input)',
      /<select name="schedule_building_id" id="vr-hotspot-schedule-building">/.test(page.html) &&
      !/<input[^>]*name="schedule_building_id"/.test(page.html) &&
      page.html.includes('id="vr-admin-buildings-json"'));
    const adminHeaders = { 'Content-Type': 'application/json', Cookie: admin.jar.header(), 'X-CSRF-Token': csrf };

    let r = await jfetch('/admin/api/vr/scenes', { headers: { Cookie: admin.jar.header() } });
    const scenes = r.json && Array.isArray(r.json.scenes) ? r.json.scenes : [];
    const scene = scenes.find((s) => Number.isInteger(Number(s.id)) && s.scene_key) || null;
    sceneId = scene ? Number(scene.id) : null;
    sceneKey = scene ? String(scene.scene_key) : '';
    check(mode, 'fixture: VR scene available', r.status === 200 && Number.isInteger(sceneId) && sceneId > 0 && sceneKey.length > 0);
    if (!sceneId) return bodies;

    r = await jfetch('/api/buildings', { headers: { Cookie: admin.jar.header(), Accept: 'application/json' } });
    const buildings = r.json && Array.isArray(r.json.buildings) ? r.json.buildings : [];
    const building = buildings.find((b) => Number.isInteger(Number(b.id))) || null;
    buildingId = building ? Number(building.id) : null;
    check(mode, 'fixture: building id available', r.status === 200 && Number.isInteger(buildingId) && buildingId > 0);
    if (!buildingId) return bodies;

    const schedulePayload = {
      title: PROBE_TITLE,
      schedule_date: PROBE_DATE,
      start_time: '08:30',
      end_time: '10:00',
      audience: 'all',
      status: 'scheduled',
      building_id: buildingId,
      location_type: 'room',
      location_label: PROBE_LABEL,
      floor_label: PROBE_FLOOR,
      description: 'VR room-door schedule probe entry.',
    };
    r = await jfetch('/admin/api/schedules', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(schedulePayload),
    });
    scheduleId = r.json && r.json.schedule && r.json.schedule.id;
    check(mode, 'fixture: schedule row created', r.status === 201 && Number.isInteger(scheduleId) && scheduleId > 0);

    const hotspotPayload = {
      hotspot_type: 'schedule',
      label: PROBE_LABEL,
      text: 'Open the current room schedule.',
      yaw: '0',
      pitch: '0',
      display_order: '2099',
      schedule_building_id: String(buildingId),
      schedule_location_type: 'room',
      schedule_location_label: PROBE_LABEL,
      schedule_floor_label: PROBE_FLOOR,
    };
    r = await jfetch('/admin/api/vr/scenes/' + sceneId + '/hotspots', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(hotspotPayload),
    });
    hotspotId = r.json && r.json.hotspot && r.json.hotspot.id;
    check(mode, 'schedule hotspot create -> 201', r.status === 201 && Number.isInteger(hotspotId) && hotspotId > 0);
    check(mode, 'schedule hotspot echoes fixed metadata',
      !!(r.json && r.json.hotspot) &&
      r.json.hotspot.hotspot_type === 'schedule' &&
      Number(r.json.hotspot.schedule_building_id) === buildingId &&
      r.json.hotspot.schedule_location_label === PROBE_LABEL);

    r = await jfetch('/admin/api/vr/scenes/' + sceneId + '/hotspots', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(Object.assign({}, hotspotPayload, { label: PROBE_PREFIX + 'missing_label', schedule_location_label: '' })),
    });
    check(mode, 'missing schedule location label -> 400', r.status === 400 && !!r.json && r.json.success === false);

    r = await jfetch('/admin/api/vr/scenes/' + sceneId + '/hotspots', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify(Object.assign({}, hotspotPayload, { label: PROBE_PREFIX + 'missing_building', schedule_building_id: '999999999' })),
    });
    check(mode, 'non-existent schedule building -> 404', r.status === 404 && !!r.json && r.json.success === false);

    const student = await login(STUDENT_EMAIL, STUDENT_PASS);
    check(mode, 'student login -> 302', student.ok);
    if (student.ok) sessions.register('student', student.jar, '/dashboard');
    if (student.ok) {
      r = await jfetch('/vr/' + encodeURIComponent(sceneKey), { headers: { Cookie: student.jar.header(), Accept: 'text/html' } });
      check(mode, 'VR page renders schedule hotspot button',
        r.status === 200 && r.text.includes('data-vr-schedule-hotspot') && r.text.includes(PROBE_LABEL));
      check(mode, 'VR page does not expose schedule row internals',
        !/created_by_user_id|created_at|updated_at|room_schedules/i.test(r.text));

      const exact = '/api/buildings/' + buildingId + '/schedules?from=' + PROBE_FROM + '&to=' + PROBE_TO +
        '&location_type=room&location_label=' + encodeURIComponent(PROBE_LABEL) +
        '&floor_label=' + encodeURIComponent(PROBE_FLOOR);
      r = await jfetch(exact, { headers: { Cookie: student.jar.header(), Accept: 'application/json' } });
      const titles = r.json && Array.isArray(r.json.schedules) ? r.json.schedules.map((s) => s.title) : [];
      check(mode, 'student exact room-door schedule fetch includes probe row',
        r.status === 200 && titles.includes(PROBE_TITLE));
      r = await jfetch(exact.replace(encodeURIComponent(PROBE_FLOOR), encodeURIComponent('Second Floor')),
        { headers: { Cookie: student.jar.header(), Accept: 'application/json' } });
      check(mode, 'student wrong floor fetch returns empty',
        r.status === 200 && !!r.json && Array.isArray(r.json.schedules) && r.json.schedules.length === 0);
    }
  } finally {
    try {
      if (admin && admin.ok) {
        const page = await stableAdminPage(admin.jar);
        const delHeaders = { Cookie: admin.jar.header(), 'X-CSRF-Token': page.csrf };
        if (sceneId) {
          const list = await jfetch('/admin/api/vr/scenes/' + sceneId + '/hotspots', { headers: { Cookie: admin.jar.header() } });
          const hotspots = list.json && Array.isArray(list.json.hotspots) ? list.json.hotspots : [];
          for (const h of hotspots.filter((x) => String(x.label || '').startsWith(PROBE_PREFIX) || String(x.label || '') === PROBE_LABEL)) {
            await jfetch('/admin/api/vr/hotspots/' + h.id, { method: 'DELETE', headers: delHeaders });
          }
        }
        if (scheduleId) {
          await jfetch('/admin/api/schedules/' + scheduleId, { method: 'DELETE', headers: delHeaders });
        }
        if (buildingId) {
          const after = await jfetch(`/admin/api/schedules?buildingId=${buildingId}&from=${PROBE_FROM}&to=${PROBE_TO}&limit=100`, { headers: { Cookie: admin.jar.header() } });
          const leftovers = (after.json && Array.isArray(after.json.schedules) ? after.json.schedules : [])
            .filter((s) => typeof s.title === 'string' && s.title.startsWith(PROBE_PREFIX)).length;
          check(mode, 'cleanup leftover probe schedules = 0', leftovers === 0);
        }
      }
    } catch (e) {
      check(mode, 'cleanup completed', false);
    }
  }

  } finally {
    await sessions.terminateAll();
  }

  return bodies;
}

function leakScan(mode, bodies) {
  const blob = bodies.join('\n');
  for (const [label, re] of LEAK_PATTERNS) {
    check(mode, `leak scan: no ${label}`, !re.test(blob));
  }
}

(async () => {
  console.log('=== CampuSphere VR Schedule Hotspot probe (Milestone 11, Section 11.8A) ===');

  console.log('\nmysql mode:');
  const mysqlBodies = await withServer({ mode: 'mysql', port: 3371, sessionStore: 'mysql' }, (base) => runMode('mysql', base));
  leakScan('mysql', mysqlBodies || []);

  let supabaseSkipped = false;
  if (process.env.PROBE_SKIP_SUPABASE === '1' && !hasSupabaseConfig()) {
    supabaseSkipped = true;
    console.log('\nsupabase mode: SKIP - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (MySQL fallback mode).');
  } else {
    console.log('\nsupabase mode:');
    const sbBodies = await withServer({ mode: 'supabase', port: 3372, sessionStore: 'supabase' }, (base) => runMode('supabase', base));
    leakScan('supabase', sbBodies || []);
  }

  console.log('');
  if (failures.length === 0) {
    console.log('VR-SCHEDULE-HOTSPOT-PROBE OK: all checks passed (' + (supabaseSkipped ? 'mysql; supabase skipped' : 'mysql + supabase') + ').');
    process.exitCode = 0;
  } else {
    console.error(`VR-SCHEDULE-HOTSPOT-PROBE FAILED: ${failures.length} check(s) did not pass:`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }
})();
