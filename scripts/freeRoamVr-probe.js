'use strict';

/* ========================================
   CampuSphere - Free Roam 360 Campus Mode probe
   Milestone 11, Section 11.8C verification script.

   Boots through scripts/with-server.js (never a foreground server) in both
   runtime modes and verifies the Free Roam contract:

     - /map (authenticated) carries the Free Roam 360 entry linking to
       /vr/scene-guard-house (BE.4: Free Roam starts at the Guard House)
     - anonymous /vr -> 302 redirect to /auth (browser contract)
     - /vr/scene-guard-house renders the Guard House scene, and the /vr
       fallback (no scene key) renders the SAME Guard House scene
     - Free Roam is ROUTELESS: the page carries no route-completion or
       destination-selection markers ("Route complete", "You have arrived",
       "Set as Destination")
     - scene hotspot / accessible fallback links (/vr/<scene_key>) exist and
       navigating one loads the target scene browser page
     - an unknown scene key still renders a usable page with the
       starting-scene notice
     - the page never emits a known-missing /img/vr/ placeholder URL
       (missing-panorama fallback cleanup invariant)
     - backward compatibility: /api/routes, /vr/routes/:routeId and
       /vr/to/:buildingId (11.8B flows) still render
     - leak scan over every captured body (JWT/Supabase host/SQL/stack/
       cookie/credential-name patterns)

   The probe is READ-ONLY: it creates no rows, so there is nothing to clean.
   Prints fixed PASS/FAIL labels only — never raw rows, cookies, secrets,
   raw request bodies, raw DB errors, or stack traces.

   Run:   node scripts/freeRoamVr-probe.js
   ======================================== */

require('dotenv').config();

const { withServer } = require('./with-server');
const { hasSupabaseConfig } = require('../config/supabase');

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

function hasCaptureDate(html) {
  return String(html || '').includes('360° scenes captured on') &&
    /<time datetime="2026-05-28">May 28, 2026<\/time>/.test(String(html || ''));
}

const LEAK_PATTERNS = [
  ['JWT-like token', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['Supabase host', /[a-z0-9-]+\.supabase\.(co|com|in)/i],
  ['stack frame', /\bat [\w.$<>[\] ]+ \((?:file:\/\/|\/|[A-Za-z]:\\)[^)]*:\d+:\d+\)/],
  ['SQL/driver/PostgREST text', /sqlMessage|SQLSTATE|PostgREST|relation "[^"]+" does not exist|syntax error at or near/i],
  // MySQL driver codes are UPPERCASE standalone tokens (e.g. ER_DUP_ENTRY).
  // This probe scans /map HTML, whose BEM class names (…er__toggle) and
  // client constants (BANNER_DEFAULT_BOTTOM) false-positive a case-insensitive
  // ER_ pattern — so this variant is case-sensitive and word-bounded.
  ['MySQL driver error code', /\bER_[A-Z_]{3,}\b/],
  ['session cookie value', /campusphere\.sid=/],
  ['Supabase/Cloudinary credential name', /SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|CLOUDINARY_API_KEY|CLOUDINARY_API_SECRET/],
];

async function runMode(mode, base) {
  // M12.P1-R1: this leg's server has AUTH_DATA_SOURCE === mode (with-server
  // forces all six switches), so resolve matching regression credentials.
  const creds = getRegressionCredentials(mode);
  const STUDENT_EMAIL = creds.student.email;
  const STUDENT_PASS = creds.student.password;
  const bodies = [];

  async function hfetch(url, options) {
    const res = await fetch(base + url, { redirect: 'manual', ...options });
    const text = await res.text();
    bodies.push(text);
    return { status: res.status, location: res.headers.get('location') || '', text };
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

  // ---- anonymous contract: Free Roam stays behind login ----
  let r = await hfetch('/vr', { headers: { Accept: 'text/html' } });
  check(mode, 'anonymous /vr -> 302 redirect to /auth',
    r.status === 302 && r.location.startsWith('/auth'));

  const sessions = createProbeSessionTracker({
    base,
    record: (label, pass) => check(mode, label, pass),
  });

  const student = await login(STUDENT_EMAIL, STUDENT_PASS);
  check(mode, 'student login -> 302', student.ok);
  if (student.ok) sessions.register('student', student.jar, '/dashboard');
  if (!student.ok) return bodies;

  /* Everything below runs inside a try whose finally terminates the session,
     so any early return still passes through cleanup. Intentionally NOT
     re-indented (minimal diff). */
  try {
  const HTMLH = { Cookie: student.jar.header(), Accept: 'text/html' };
  const JSONH = { Cookie: student.jar.header(), Accept: 'application/json' };

  // ---- map entry point ----
  r = await hfetch('/map', { headers: HTMLH });
  check(mode, '/map -> 200', r.status === 200);
  check(mode, '/map carries the Free Roam 360 entry (id + label)',
    r.text.includes('id="freeRoamBtn"') && r.text.includes('Free Roam 360'));
  const freeRoamHref = /id="freeRoamBtn"[^>]*/.test(r.text)
    ? (/(?:href="([^"]+)"[^>]*id="freeRoamBtn"|id="freeRoamBtn"[^>]*href="([^"]+)")/.exec(r.text) || [])
    : [];
  const href = freeRoamHref[1] || freeRoamHref[2] || null;
  check(mode, 'Free Roam entry links to /vr/scene-guard-house', href === '/vr/scene-guard-house');

  // ---- free roam start: the Guard House (BE.4) ----
  r = await hfetch('/vr/scene-guard-house', { headers: HTMLH });
  check(mode, '/vr/scene-guard-house -> 200 scene browser',
    r.status === 200 && r.text.includes('Back to Map'));
  check(mode, '/vr/scene-guard-house renders the Guard House as the CURRENT scene',
    r.text.includes('"scene_key":"scene-guard-house"'));
  check(mode, '/vr/scene-guard-house renders the approved capture date', hasCaptureDate(r.text));
  check(mode, 'Free Roam start is routeless (no completion/destination markers)',
    !r.text.includes('Route complete') &&
    !r.text.includes('You have arrived') &&
    !r.text.includes('Set as Destination'));
  check(mode, 'Free Roam start emits no missing /img/vr/ placeholder URL', !r.text.includes('/img/vr/'));

  // ---- backward-compatible fallback: /vr renders the SAME Guard House scene ----
  const fallbackPage = await hfetch('/vr', { headers: HTMLH });
  check(mode, '/vr fallback -> 200 and starts at the Guard House scene',
    fallbackPage.status === 200 &&
    fallbackPage.text.includes('Back to Map') &&
    fallbackPage.text.includes('"scene_key":"scene-guard-house"'));
  check(mode, '/vr fallback renders the approved capture date', hasCaptureDate(fallbackPage.text));

  // ---- scene hotspot / fallback link navigation ----
  const linkMatch = /href="\/vr\/(scene-[A-Za-z0-9_-]+)"/.exec(r.text);
  const targetKey = linkMatch ? linkMatch[1] : null;
  check(mode, '/vr offers a scene hotspot/fallback link', !!targetKey);
  if (targetKey) {
    r = await hfetch('/vr/' + targetKey, { headers: HTMLH });
    check(mode, `scene link navigation -> 200 scene browser`,
      r.status === 200 && r.text.includes('Back to Map') && r.text.includes('vr-title'));
    check(mode, 'navigated scene renders the approved capture date', hasCaptureDate(r.text));
    check(mode, 'navigated scene is also routeless',
      !r.text.includes('Route complete') && !r.text.includes('You have arrived'));
  }

  // ---- unknown scene key stays usable ----
  r = await hfetch('/vr/no-such-scene-xyz', { headers: HTMLH });
  check(mode, 'unknown scene key -> 200 usable page with starting-scene notice',
    r.status === 200 && r.text.includes('Showing the starting scene instead'));

  // ---- backward compatibility: 11.8B route flows untouched ----
  r = await hfetch('/api/routes', { headers: JSONH });
  let routeId = null;
  let destId = null;
  try {
    const parsed = JSON.parse(r.text);
    const routes = (parsed && parsed.routes) || [];
    if (routes.length) {
      routeId = routes[0].id;
      destId = routes[0].destination ? routes[0].destination.id : null;
    }
  } catch (e) { /* handled by the check below */ }
  check(mode, 'backward-compat: /api/routes -> 200 (an empty predefined catalog is valid)', r.status === 200);
  if (routeId) {
    r = await hfetch('/vr/routes/' + routeId, { headers: HTMLH });
    check(mode, 'backward-compat: /vr/routes/:routeId -> 200 guided route',
      r.status === 200 && r.text.includes('Guided VR Route'));
    if (r.text.includes('id="vrPano"')) {
      check(mode, 'guided route scene renders the approved capture date', hasCaptureDate(r.text));
    }
  }
  if (destId) {
    r = await hfetch('/vr/to/' + destId, { headers: HTMLH });
    check(mode, 'backward-compat: /vr/to/:buildingId -> 200 destination route',
      r.status === 200 && r.text.includes('Guard House / Main Gate'));
    if (r.text.includes('id="vrPano"')) {
      check(mode, 'destination route scene renders the approved capture date', hasCaptureDate(r.text));
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
  console.log('=== CampuSphere Free Roam 360 Campus Mode probe (Milestone 11, Section 11.8C) ===');

  console.log('\nmysql mode:');
  const mysqlBodies = await withServer({ mode: 'mysql', port: 3368, sessionStore: 'mysql' }, (base) => runMode('mysql', base));
  leakScan('mysql', mysqlBodies || []);

  if (process.env.PROBE_SKIP_SUPABASE === '1' && !hasSupabaseConfig()) {
    console.log('\nsupabase mode: SKIP — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (MySQL fallback mode).');
  } else {
    console.log('\nsupabase mode:');
    const sbBodies = await withServer({ mode: 'supabase', port: 3369, sessionStore: 'supabase' }, (base) => runMode('supabase', base));
    leakScan('supabase', sbBodies || []);
  }

  console.log('');
  console.log('NOTE read-only probe: no rows were created, so no cleanup is required.');
  if (failures.length === 0) {
    console.log('FREE-ROAM-VR-PROBE OK: all checks passed.');
    process.exitCode = 0;
  } else {
    console.error(`FREE-ROAM-VR-PROBE FAILED: ${failures.length} check(s) did not pass:`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }
})();
