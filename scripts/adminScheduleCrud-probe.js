'use strict';

/* ========================================
   CampuSphere - Admin Schedule CRUD HTTP probe
   Milestone 11, Section 11.5 verification script.

   Boots the app through scripts/with-server.js (never a foreground server)
   once per runtime mode (mysql, then supabase) and drives the
   /admin/api/schedules JSON API end-to-end:

     - logged-out GET/POST -> 401 JSON
     - logged-in non-admin (seeded student) GET/POST -> 403 JSON
     - admin login + CSRF token from a rendered admin page
     - real building id parsed from /admin/campus-map (buildings-data-json)
     - mutation WITHOUT CSRF token -> 403
     - create (201), get (200), filtered list/count (200)
     - validation rejections -> sanitized 400 (inverted time range, bad
       date, unknown field, bad audience, bad location type, oversized
       title, missing title) with no attacker text echoed back
     - create against a non-existent building -> 404
     - update (200), status filter behavior, delete (200),
       get-after-delete (404), delete-missing (404)
     - finally-cleanup deletes every probe row via the admin API and
       reports the leftover count (expected 0)
     - leak scan over every captured response body: no JWT/Supabase
       host, SQL/driver/PostgREST text, stack traces, session cookie
       values, or Cloudinary credential names.

   Throwaway convention: title 'M11_5_PROBE_<run-id>' on fixed far-future
   dates (2099-02-*), so real data is never touched.

   Safety: prints fixed PASS/FAIL labels, counts, and booleans only —
   never raw rows, response bodies, secrets, cookies, or errors.

   Run:   node scripts/adminScheduleCrud-probe.js
   ======================================== */

require('dotenv').config();

const { withServer } = require('./with-server');
const { hasSupabaseConfig } = require('../config/supabase');

const runId = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
const PROBE_TITLE_PREFIX = 'M11_5_PROBE_';
const PROBE_TITLE = (PROBE_TITLE_PREFIX + runId).slice(0, 150);
const PROBE_DATE = '2099-02-10';
const PROBE_FROM = '2099-02-01';
const PROBE_TO = '2099-02-28';
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

/* ---------------- HTTP helpers (fixed-label output only) ---------------- */

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
  const bodies = []; // every captured response body, scanned at the end

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

  // Admin CSRF token: read /admin/campus-map until two consecutive reads agree
  // (the token is minted lazily on the first authenticated GET; the double
  // read is a stability wait, not a retry or bypass). Also captures the page
  // HTML so a real building id can be parsed from buildings-data-json.
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

  function payload(overrides) {
    return Object.assign({
      title: PROBE_TITLE,
      schedule_date: PROBE_DATE,
      start_time: '09:00',
      end_time: '10:30',
      audience: 'all',
      status: 'scheduled',
      building_id: 0, // caller sets the real id
      location_type: 'room',
      location_label: 'Probe Room 101',
      floor_label: 'Ground Floor',
      description: 'Section 11.5 CRUD probe entry.',
    }, overrides);
  }

  // One tracker per withServer/runMode invocation.
  const sessions = createProbeSessionTracker({
    base,
    record: (label, pass) => check(mode, label, pass),
  });

  let admin = null;
  let buildingId = null;
  let createdId = null;

  /* Outer try: session termination is the OUTERMOST finally, so it runs after
     the existing fixture cleanup, even if that cleanup throws, and even on the
     early `return bodies` below. The inner block is intentionally NOT
     re-indented so this stays a reviewable, minimal diff. */
  try {
  try {
    // 1. logged-out contracts
    let r = await jfetch('/admin/api/schedules');
    check(mode, 'logged-out GET list -> 401 JSON', r.status === 401 && !!r.json && r.json.success === false);
    r = await jfetch('/admin/api/schedules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload({ building_id: 1 })),
    });
    check(mode, 'logged-out POST create -> 401 JSON', r.status === 401 && !!r.json && r.json.success === false);

    // 2. non-admin contracts
    const student = await login(STUDENT_EMAIL, STUDENT_PASS);
    check(mode, 'student login -> 302', student.ok);
    if (student.ok) sessions.register('student', student.jar, '/dashboard');
    if (student.ok) {
      r = await jfetch('/admin/api/schedules', { headers: { Cookie: student.jar.header() } });
      check(mode, 'student GET list -> 403 JSON', r.status === 403 && !!r.json && r.json.success === false);
      r = await jfetch('/admin/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: student.jar.header() },
        body: JSON.stringify(payload({ building_id: 1 })),
      });
      check(mode, 'student POST create -> 403 JSON', r.status === 403 && !!r.json && r.json.success === false);
    }

    // 3. admin login + CSRF + real building id from /admin/campus-map
    admin = await login(ADMIN_EMAIL, ADMIN_PASS);
    check(mode, 'admin login -> 302', admin.ok);
    if (admin.ok) sessions.register('admin', admin.jar, '/admin/faqs');
    if (!admin.ok) return bodies;
    const page = await stableAdminPage(admin.jar);
    bodies.push(page.html);
    check(mode, 'admin CSRF token available', page.csrf.length > 0);
    buildingId = parseFirstBuildingId(page.html);
    check(mode, 'real building id parsed from campus-map', Number.isInteger(buildingId) && buildingId > 0);
    if (!Number.isInteger(buildingId) || buildingId <= 0) return bodies;

    const adminHeaders = (extra) => Object.assign({
      'Content-Type': 'application/json',
      Cookie: admin.jar.header(),
      'X-CSRF-Token': page.csrf,
    }, extra || {});

    // 4. mutation without CSRF token -> 403
    r = await jfetch('/admin/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: admin.jar.header() },
      body: JSON.stringify(payload({ building_id: buildingId })),
    });
    check(mode, 'admin POST without CSRF -> 403', r.status === 403 && !!r.json && r.json.success === false);

    // 5. create
    r = await jfetch('/admin/api/schedules', {
      method: 'POST', headers: adminHeaders(), body: JSON.stringify(payload({ building_id: buildingId })),
    });
    createdId = r.json && r.json.schedule && r.json.schedule.id;
    check(mode, 'create -> 201 with schedule id', r.status === 201 && Number.isInteger(createdId) && createdId > 0);
    check(mode, 'created schedule carries building_name', !!(r.json && r.json.schedule && typeof r.json.schedule.building_name === 'string' && r.json.schedule.building_name.length > 0));

    // 6. get
    r = await jfetch('/admin/api/schedules/' + createdId, { headers: { Cookie: admin.jar.header() } });
    check(mode, 'get by id -> 200 with matching title', r.status === 200 && !!r.json && !!r.json.schedule && r.json.schedule.title === PROBE_TITLE);

    // 7. filtered list + total
    const listUrl = `/admin/api/schedules?buildingId=${buildingId}&from=${PROBE_FROM}&to=${PROBE_TO}`;
    r = await jfetch(listUrl, { headers: { Cookie: admin.jar.header() } });
    check(mode, 'filtered list -> 200 includes the row',
      r.status === 200 && !!r.json && Array.isArray(r.json.schedules) && r.json.schedules.some((s) => s.id === createdId));
    check(mode, 'filtered list total >= 1', !!r.json && Number.isInteger(r.json.total) && r.json.total >= 1);

    /* ---- M12.P1-D4: the list API owns `q` and the additive appliedFilters
       metadata. Existing fields stay backward-compatible. ---- */
    check(mode, 'list response keeps schedules + total and adds appliedFilters',
      !!r.json && Array.isArray(r.json.schedules) && Number.isInteger(r.json.total) &&
      !!r.json.appliedFilters && typeof r.json.appliedFilters === 'object');
    const af = r.json.appliedFilters;
    check(mode, 'appliedFilters echoes the requested window and bounds',
      af.from === PROBE_FROM && af.to === PROBE_TO && Number(af.buildingId) === Number(buildingId) &&
      af.q === null && Number.isInteger(af.limit) && Number.isInteger(af.offset));

    const defaults = await jfetch('/admin/api/schedules', { headers: { Cookie: admin.jar.header() } });
    const manilaToday = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    check(mode, 'appliedFilters exposes the default Asia/Manila window',
      defaults.status === 200 && !!defaults.json.appliedFilters &&
      defaults.json.appliedFilters.from === manilaToday &&
      defaults.json.appliedFilters.limit === 50 && defaults.json.appliedFilters.offset === 0);

    const qUrl = (q) => `${listUrl}&q=${encodeURIComponent(q)}`;
    r = await jfetch(qUrl(PROBE_TITLE), { headers: { Cookie: admin.jar.header() } });
    check(mode, 'q narrows the list to the matching row and echoes back',
      r.status === 200 && r.json.schedules.some((s) => s.id === createdId) &&
      r.json.appliedFilters.q === PROBE_TITLE);
    check(mode, 'q keeps list length and total in agreement',
      r.json.schedules.length === r.json.total);
    r = await jfetch(qUrl('zzz-no-such-schedule-zzz'), { headers: { Cookie: admin.jar.header() } });
    check(mode, 'a non-matching q returns an empty list with total 0',
      r.status === 200 && r.json.schedules.length === 0 && r.json.total === 0);
    r = await jfetch(qUrl('   '), { headers: { Cookie: admin.jar.header() } });
    check(mode, 'a whitespace-only q applies no search',
      r.status === 200 && r.json.appliedFilters.q === null &&
      r.json.schedules.some((s) => s.id === createdId));
    r = await jfetch(qUrl('a'.repeat(101)), { headers: { Cookie: admin.jar.header() } });
    check(mode, 'an over-long q -> sanitized 400 that never echoes the value',
      r.status === 400 && !!r.json && r.json.success === false && !r.text.includes('a'.repeat(101)));
    r = await jfetch(`${listUrl}&q=a&q=b`, { headers: { Cookie: admin.jar.header() } });
    check(mode, 'a repeated q -> sanitized 400', r.status === 400 && !!r.json && r.json.success === false);
    r = await jfetch(qUrl('zzz",id.gte."0'), { headers: { Cookie: admin.jar.header() } });
    check(mode, 'a crafted filter-grammar breakout is contained (200, no rows)',
      r.status === 200 && r.json.total === 0);

    // 8. validation rejections (all sanitized 400; no echo of attacker text)
    const rejects = [
      ['inverted time range', payload({ building_id: buildingId, start_time: '10:30', end_time: '09:00' }), null],
      ['zero-length time range', payload({ building_id: buildingId, start_time: '09:00', end_time: '09:00' }), null],
      ['invalid date', payload({ building_id: buildingId, schedule_date: '2099-13-40' }), null],
      ['unknown field', Object.assign(payload({ building_id: buildingId }), { m11_5_forbidden_field: 'zzz_reflect_check' }), 'zzz_reflect_check'],
      ['invalid audience', payload({ building_id: buildingId, audience: 'everyone' }), null],
      ['invalid location type', payload({ building_id: buildingId, location_type: 'hallway' }), null],
      ['oversized title', payload({ building_id: buildingId, title: 'Z'.repeat(151) }), 'Z'.repeat(151)],
      ['missing title', payload({ building_id: buildingId, title: '' }), null],
      ['wide list range is rejected too', null, null], // handled below
    ];
    for (const [label, body, echoMarker] of rejects) {
      if (body === null) continue;
      r = await jfetch('/admin/api/schedules', { method: 'POST', headers: adminHeaders(), body: JSON.stringify(body) });
      let ok = r.status === 400 && !!r.json && r.json.success === false && typeof r.json.message === 'string';
      if (ok && echoMarker) ok = !r.text.includes(echoMarker);
      check(mode, `validation reject: ${label} -> sanitized 400`, ok);
    }
    r = await jfetch(`/admin/api/schedules?from=2099-01-01&to=2099-06-30`, { headers: { Cookie: admin.jar.header() } });
    check(mode, 'list range wider than 90 days -> 400', r.status === 400 && !!r.json && r.json.success === false);
    r = await jfetch(`/admin/api/schedules?from=2099-02-10&to=2099-02-01`, { headers: { Cookie: admin.jar.header() } });
    check(mode, 'list range with to < from -> 400', r.status === 400 && !!r.json && r.json.success === false);

    // 9. non-existent building -> 404
    r = await jfetch('/admin/api/schedules', {
      method: 'POST', headers: adminHeaders(), body: JSON.stringify(payload({ building_id: 999999999 })),
    });
    check(mode, 'create with missing building -> 404', r.status === 404 && !!r.json && r.json.success === false);

    // 10. update
    r = await jfetch('/admin/api/schedules/' + createdId, {
      method: 'PUT', headers: adminHeaders(),
      body: JSON.stringify(payload({ building_id: buildingId, status: 'cancelled', audience: 'student-cspc', location_type: 'facility', location_label: 'Probe Facility A', floor_label: '', description: '' })),
    });
    check(mode, 'update -> 200 with applied changes',
      r.status === 200 && !!r.json && !!r.json.schedule && r.json.schedule.status === 'cancelled' &&
      r.json.schedule.audience === 'student-cspc' && r.json.schedule.floor_label === null);

    // 11. status filter behavior
    r = await jfetch(listUrl + '&status=cancelled', { headers: { Cookie: admin.jar.header() } });
    check(mode, 'list status=cancelled includes the row',
      r.status === 200 && !!r.json && r.json.schedules.some((s) => s.id === createdId));
    r = await jfetch(listUrl + '&status=scheduled', { headers: { Cookie: admin.jar.header() } });
    check(mode, 'list status=scheduled excludes the row',
      r.status === 200 && !!r.json && !r.json.schedules.some((s) => s.id === createdId));

    // 12. delete + missing contracts
    r = await jfetch('/admin/api/schedules/' + createdId, { method: 'DELETE', headers: adminHeaders() });
    check(mode, 'delete -> 200', r.status === 200 && !!r.json && r.json.success === true);
    r = await jfetch('/admin/api/schedules/' + createdId, { headers: { Cookie: admin.jar.header() } });
    check(mode, 'get after delete -> 404', r.status === 404 && !!r.json && r.json.success === false);
    r = await jfetch('/admin/api/schedules/' + createdId, { method: 'DELETE', headers: adminHeaders() });
    check(mode, 'delete missing -> 404', r.status === 404 && !!r.json && r.json.success === false);
    createdId = null;
  } finally {
    // Cleanup: remove every probe row in the probe window via the admin API.
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
  console.log('=== CampuSphere Admin Schedule CRUD probe (Milestone 11, Section 11.5) ===');

  console.log('\nmysql mode:');
  const mysqlBodies = await withServer({ mode: 'mysql', port: 3351, sessionStore: 'mysql' }, (base) => runMode('mysql', base));
  leakScan('mysql', mysqlBodies || []);

  if (process.env.PROBE_SKIP_SUPABASE === '1' && !hasSupabaseConfig()) {
    // Quality-gates orchestration (Section 11.7): skip only when the caller
    // verified no Supabase runtime/session mode is selected. Standalone runs
    // without the flag still exercise (and fail on) the Supabase phase.
    console.log('\nsupabase mode: SKIP — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (MySQL fallback mode).');
  } else {
    console.log('\nsupabase mode:');
    const sbBodies = await withServer({ mode: 'supabase', port: 3352, sessionStore: 'supabase' }, (base) => runMode('supabase', base));
    leakScan('supabase', sbBodies || []);
  }

  console.log('');
  if (failures.length === 0) {
    console.log('ADMIN-SCHEDULE-CRUD-PROBE OK: all checks passed (mysql + supabase).');
    process.exitCode = 0;
  } else {
    console.error(`ADMIN-SCHEDULE-CRUD-PROBE FAILED: ${failures.length} check(s) did not pass:`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }
})();
