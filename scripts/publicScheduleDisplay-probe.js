'use strict';

/* ========================================
   CampuSphere - Public Schedule Display probe
   Milestone 11, Section 11.6 verification script.

   Boots the app through scripts/with-server.js (never a foreground server)
   once per runtime mode (mysql, then supabase) and verifies the
   authenticated public schedule read GET /api/buildings/:id/schedules:

     - anonymous -> clean 401 JSON
     - as the seeded student: scheduled+all visible, scheduled+student-cspc
       visible, scheduled+instructor NOT visible, cancelled/completed NOT
       visible, guest-audience NOT visible
     - as a throwaway guest: scheduled+guest visible, scheduled+student-cspc
       NOT visible
     - rows carry the PUBLIC shape only (no id / building_id /
       created_by_user_id / created_at / updated_at keys)
     - rows ordered by schedule_date ASC, start_time ASC
     - invalid id -> 400; missing building -> 404; invalid date, inverted
       range, and >90-day range -> sanitized 400
     - a valid window with no visible rows returns the empty state ([])
     - finally-cleanup deletes every M11_6_PROBE_* row and the throwaway
       guest user through the admin API; leftover count expected 0
     - leak scan over every captured response body (SQL/PostgREST text,
       stack traces, session cookie values, Supabase hosts/JWTs,
       Cloudinary credential names, echoed attacker text).

   Fixture rows live on fixed far-future dates (2099-03-*) so real data is
   never touched. Prints fixed PASS/FAIL labels, counts, and booleans only.

   Run:   node scripts/publicScheduleDisplay-probe.js
   ======================================== */

require('dotenv').config();

const { withServer } = require('./with-server');
const { hasSupabaseConfig } = require('../config/supabase');

const runId = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
const PROBE_TITLE_PREFIX = 'M11_6_PROBE_';
const T = (tag) => (PROBE_TITLE_PREFIX + tag + '_' + runId).slice(0, 150);
const PROBE_DATE = '2099-03-10';
const PROBE_FROM = '2099-03-01';
const PROBE_TO = '2099-03-20';
const EMPTY_FROM = '2099-06-01';
const EMPTY_TO = '2099-06-10';
// M12.P1-R1: regression identities come from the shared TEST-ONLY loader —
// deterministic local fixtures for the MySQL leg, SUPABASE_REGRESSION_* env
// (fail-closed, never printed) for the Supabase leg. No hardcoded
// live-capable credential remains in this probe.
const { getRegressionCredentials } = require('./regressionCredentials');
// Shared probe session ownership (scripts/probeSessionLifecycle.js): every
// canonical identity authenticated here is terminated through the real logout
// interface so `npm test` leaves no persisted regression session behind.
const { createProbeSessionTracker } = require('./probeSessionLifecycle');
const GUEST_EMAIL = `m11-6-probe-guest-${runId}@probe.invalid`;
const GUEST_PASS = 'M11-6-Probe-Pass1';

const PUBLIC_KEYS_FORBIDDEN = ['id', 'building_id', 'building_name', 'created_by_user_id', 'created_at', 'updated_at'];

const failures = [];
function check(scope, label, ok) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!ok) failures.push(`${scope} :: ${label}`);
}

/* ---------------- HTTP helpers ---------------- */

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

function parseFirstBuildingId(html) {
  const m = /<script id="buildings-data-json"[^>]*>([\s\S]*?)<\/script>/.exec(html || '');
  if (!m) return null;
  try {
    const arr = JSON.parse(m[1]);
    if (Array.isArray(arr) && arr.length > 0 && Number.isInteger(arr[0].id)) return arr[0].id;
  } catch (e) { /* fall through */ }
  return null;
}

/* ---------------- leak scan ---------------- */

const LEAK_PATTERNS = [
  ['JWT-like token', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['Supabase host', /[a-z0-9-]+\.supabase\.(co|com|in)/i],
  ['stack frame', /\bat [\w.$<>[\] ]+ \((?:file:\/\/|\/|[A-Za-z]:\\)[^)]*:\d+:\d+\)/],
  ['SQL/driver/PostgREST text', /sqlMessage|ER_[A-Z_]{3,}|SQLSTATE|PostgREST|relation "[^"]+" does not exist|syntax error at or near/i],
  ['session cookie value', /campusphere\.sid=/],
  ['Supabase/Cloudinary credential name', /SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|CLOUDINARY_API_KEY|CLOUDINARY_API_SECRET/],
];

/* ---------------- probe body ---------------- */

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
      const r = await fetch(base + '/admin/campus-map', { headers: { Accept: 'text/html', Cookie: jar.header() } });
      jar.apply(r);
      html = await r.text();
      const tok = metaCsrf(html);
      if (tok && tok === prevTok) return { csrf: tok, html };
      prevTok = tok;
    }
    return { csrf: prevTok || '', html };
  }

  const titlesOf = (r) => (r.json && Array.isArray(r.json.schedules) ? r.json.schedules : [])
    .map((s) => s.title).filter((t) => typeof t === 'string');

  // One tracker per withServer/runMode invocation. Only CANONICAL regression
  // identities are registered here; the throwaway guest below is terminated by
  // its verified user deletion instead, and that path is proven explicitly.
  const sessions = createProbeSessionTracker({
    base,
    record: (label, pass) => check(mode, label, pass),
  });
  let guestJar = null;

  let admin = null;
  let adminCsrf = '';
  let buildingId = null;
  let guestId = null;

  /* Outer try: session termination is the OUTERMOST finally — after fixture
     cleanup, even if that cleanup throws, and on every early return below. The
     inner block is intentionally NOT re-indented (minimal diff). */
  try {
  try {
    // ---- fixture setup via the verified admin API ----
    admin = await login(ADMIN_EMAIL, ADMIN_PASS);
    check(mode, 'admin login -> 302', admin.ok);
    if (admin.ok) sessions.register('admin', admin.jar, '/admin/faqs');
    if (!admin.ok) return bodies;
    const page = await stableAdminPage(admin.jar);
    bodies.push(page.html);
    adminCsrf = page.csrf;
    buildingId = parseFirstBuildingId(page.html);
    check(mode, 'fixture: real building id parsed', Number.isInteger(buildingId) && buildingId > 0);
    if (!Number.isInteger(buildingId) || buildingId <= 0) return bodies;

    const adminHeaders = { 'Content-Type': 'application/json', Cookie: admin.jar.header(), 'X-CSRF-Token': adminCsrf };
    const mkRow = (tag, overrides) => Object.assign({
      title: T(tag), schedule_date: PROBE_DATE, start_time: '08:00', end_time: '09:00',
      audience: 'all', status: 'scheduled', building_id: buildingId,
      location_type: 'room', location_label: 'Probe Room ' + tag, floor_label: '', description: '',
    }, overrides);

    const fixtures = [
      mkRow('A', { start_time: '08:00', end_time: '09:00', audience: 'all', status: 'scheduled', location_label: 'Probe Door Room A', floor_label: 'Ground Floor' }),
      mkRow('B', { start_time: '10:00', end_time: '11:00', audience: 'student-cspc', status: 'scheduled', location_label: 'Probe Door Room B', floor_label: 'Ground Floor' }),
      mkRow('C', { start_time: '09:00', end_time: '09:30', audience: 'instructor', status: 'scheduled' }),
      mkRow('D', { start_time: '12:00', end_time: '13:00', audience: 'all', status: 'cancelled' }),
      mkRow('E', { start_time: '13:00', end_time: '14:00', audience: 'all', status: 'completed' }),
      mkRow('F', { start_time: '11:00', end_time: '12:00', audience: 'guest', status: 'scheduled' }),
    ];
    let created = 0;
    for (const f of fixtures) {
      const r = await jfetch('/admin/api/schedules', { method: 'POST', headers: adminHeaders, body: JSON.stringify(f) });
      if (r.status === 201 && r.json && r.json.success === true) created++;
    }
    check(mode, 'fixture: 6 schedule rows created', created === 6);

    const gu = await jfetch('/admin/api/users', {
      method: 'POST', headers: adminHeaders,
      body: JSON.stringify({ first_name: 'Probe', last_name: 'Guest', email: GUEST_EMAIL, password: GUEST_PASS, role: 'guest' }),
    });
    guestId = gu.json && gu.json.user && gu.json.user.id;
    check(mode, 'fixture: throwaway guest user created', gu.status === 201 && !!guestId);

    const windowQs = `?from=${PROBE_FROM}&to=${PROBE_TO}`;
    const url = `/api/buildings/${buildingId}/schedules`;

    // ---- anonymous contract ----
    let r = await jfetch(url + windowQs);
    check(mode, 'anonymous GET -> 401 JSON', r.status === 401 && !!r.json && r.json.success === false);

    // ---- student visibility ----
    const student = await login(STUDENT_EMAIL, STUDENT_PASS);
    check(mode, 'student login -> 302', student.ok);
    if (student.ok) sessions.register('student', student.jar, '/dashboard');
    const sh = { Cookie: student.jar.header(), Accept: 'application/json' };
    r = await jfetch(url + windowQs, { headers: sh });
    check(mode, 'student GET -> 200', r.status === 200 && !!r.json && r.json.success === true);
    const stTitles = titlesOf(r);
    check(mode, 'student sees scheduled + audience all', stTitles.includes(T('A')));
    check(mode, 'student sees scheduled + audience student-cspc', stTitles.includes(T('B')));
    check(mode, 'student does NOT see audience instructor', !stTitles.includes(T('C')));
    check(mode, 'student does NOT see cancelled row', !stTitles.includes(T('D')));
    check(mode, 'student does NOT see completed row', !stTitles.includes(T('E')));
    check(mode, 'student does NOT see audience guest', !stTitles.includes(T('F')));

    // public shape: no internal/admin keys on any returned row
    const rows = (r.json && r.json.schedules) || [];
    const leakedKey = rows.some((row) => PUBLIC_KEYS_FORBIDDEN.some((k) => Object.prototype.hasOwnProperty.call(row, k)));
    check(mode, 'rows carry public shape only (no internal ids/metadata)', rows.length > 0 && !leakedKey);

    // order: A (08:00) must precede B (10:00) on the same date
    const ia = stTitles.indexOf(T('A'));
    const ib = stTitles.indexOf(T('B'));
    check(mode, 'rows ordered by date + start_time', ia !== -1 && ib !== -1 && ia < ib);

    // ---- exact room-door filters ----
    const exactDoorQs = windowQs + '&location_type=room&location_label=' +
      encodeURIComponent('Probe Door Room A') + '&floor_label=' + encodeURIComponent('Ground Floor');
    r = await jfetch(url + exactDoorQs, { headers: sh });
    const exactTitles = titlesOf(r);
    check(mode, 'exact room/floor filter returns matching room row',
      r.status === 200 && exactTitles.includes(T('A')) && !exactTitles.includes(T('B')));
    r = await jfetch(url + windowQs + '&location_type=room&location_label=' +
      encodeURIComponent('Probe Door Room A') + '&floor_label=' + encodeURIComponent('Second Floor'), { headers: sh });
    check(mode, 'wrong floor filter returns empty list',
      r.status === 200 && !!r.json && Array.isArray(r.json.schedules) && r.json.schedules.length === 0);
    r = await jfetch(url + windowQs + '&location_type=room', { headers: sh });
    check(mode, 'location type without label -> 400', r.status === 400 && !!r.json && r.json.success === false);
    r = await jfetch(url + windowQs + '&location_type=hallway&location_label=x', { headers: sh });
    check(mode, 'invalid location type -> 400', r.status === 400 && !!r.json && r.json.success === false);

    // ---- guest visibility ----
    const guest = await login(GUEST_EMAIL, GUEST_PASS);
    check(mode, 'guest login -> 302', guest.ok);
    // NOT registered with the tracker: this is a THROWAWAY probe-created guest
    // (not a canonical regression identity). Its session is terminated by the
    // verified user deletion in cleanup; the jar is retained so that path can
    // be PROVEN after the delete rather than assumed.
    if (guest.ok) guestJar = guest.jar;
    if (guest.ok) {
      r = await jfetch(url + windowQs, { headers: { Cookie: guest.jar.header(), Accept: 'application/json' } });
      const gTitles = titlesOf(r);
      check(mode, 'guest sees scheduled + audience guest', r.status === 200 && gTitles.includes(T('F')));
      check(mode, 'guest sees scheduled + audience all', gTitles.includes(T('A')));
      check(mode, 'guest does NOT see audience student-cspc', !gTitles.includes(T('B')));
    }

    // ---- invalid inputs (as the logged-in student) ----
    r = await jfetch('/api/buildings/abc/schedules', { headers: sh });
    check(mode, 'invalid id -> 400', r.status === 400 && !!r.json && r.json.success === false);
    r = await jfetch('/api/buildings/999999999/schedules', { headers: sh });
    check(mode, 'missing building -> 404', r.status === 404 && !!r.json && r.json.success === false);
    r = await jfetch(url + '?from=2099-13-01', { headers: sh });
    check(mode, 'invalid from date -> 400', r.status === 400 && !!r.json && r.json.success === false);
    r = await jfetch(url + '?from=2099-03-10&to=2099-03-01', { headers: sh });
    check(mode, 'inverted range -> 400', r.status === 400 && !!r.json && r.json.success === false);
    r = await jfetch(url + '?from=2099-01-01&to=2099-06-30', { headers: sh });
    check(mode, 'range wider than 90 days -> 400', r.status === 400 && !!r.json && r.json.success === false);

    // ---- empty state ----
    r = await jfetch(url + `?from=${EMPTY_FROM}&to=${EMPTY_TO}`, { headers: sh });
    check(mode, 'empty window -> 200 with zero rows',
      r.status === 200 && !!r.json && Array.isArray(r.json.schedules) && r.json.schedules.length === 0);
  } finally {
    // ---- cleanup via the admin API ----
    try {
      if (admin && admin.ok && Number.isInteger(buildingId) && buildingId > 0) {
        const page = await stableAdminPage(admin.jar);
        const del = { Cookie: admin.jar.header(), 'X-CSRF-Token': page.csrf };
        const list = await jfetch(`/admin/api/schedules?buildingId=${buildingId}&from=${PROBE_FROM}&to=${PROBE_TO}&limit=100`, { headers: { Cookie: admin.jar.header() } });
        const probeRows = (list.json && Array.isArray(list.json.schedules) ? list.json.schedules : [])
          .filter((s) => typeof s.title === 'string' && s.title.startsWith(PROBE_TITLE_PREFIX));
        for (const row of probeRows) {
          await jfetch('/admin/api/schedules/' + row.id, { method: 'DELETE', headers: del });
        }
        if (guestId) {
          await jfetch('/admin/api/users/' + guestId, { method: 'DELETE', headers: del });
          // PROVE the deletion-based termination path for the throwaway guest
          // (the M1 hardening revokes a deleted user's persisted sessions), so
          // excluding it from the tracker is evidence-backed, not an assumption.
          if (guestJar) {
            const gr = await fetch(base + '/dashboard', {
              redirect: 'manual', headers: { Accept: 'text/html', Cookie: guestJar.header() },
            });
            await gr.text();
            check(mode, 'throwaway guest session invalidated by user deletion (former cookie denied)',
              gr.status === 302 && /\/auth/.test(gr.headers.get('location') || ''));
          }
        }
        const after = await jfetch(`/admin/api/schedules?buildingId=${buildingId}&from=${PROBE_FROM}&to=${PROBE_TO}&limit=100`, { headers: { Cookie: admin.jar.header() } });
        const leftovers = (after.json && Array.isArray(after.json.schedules) ? after.json.schedules : [])
          .filter((s) => typeof s.title === 'string' && s.title.startsWith(PROBE_TITLE_PREFIX)).length;
        check(mode, 'cleanup leftover probe rows = 0', leftovers === 0);
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
  console.log('=== CampuSphere Public Schedule Display probe (Milestone 11, Section 11.6) ===');

  console.log('\nmysql mode:');
  const mysqlBodies = await withServer({ mode: 'mysql', port: 3361, sessionStore: 'mysql' }, (base) => runMode('mysql', base));
  leakScan('mysql', mysqlBodies || []);

  if (process.env.PROBE_SKIP_SUPABASE === '1' && !hasSupabaseConfig()) {
    // Quality-gates orchestration (Section 11.7): skip only when the caller
    // verified no Supabase runtime/session mode is selected. Standalone runs
    // without the flag still exercise (and fail on) the Supabase phase.
    console.log('\nsupabase mode: SKIP — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (MySQL fallback mode).');
  } else {
    console.log('\nsupabase mode:');
    const sbBodies = await withServer({ mode: 'supabase', port: 3362, sessionStore: 'supabase' }, (base) => runMode('supabase', base));
    leakScan('supabase', sbBodies || []);
  }

  console.log('');
  if (failures.length === 0) {
    console.log('PUBLIC-SCHEDULE-DISPLAY-PROBE OK: all checks passed (mysql + supabase).');
    process.exitCode = 0;
  } else {
    console.error(`PUBLIC-SCHEDULE-DISPLAY-PROBE FAILED: ${failures.length} check(s) did not pass:`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }
})();
