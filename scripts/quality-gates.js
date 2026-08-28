'use strict';
/* =============================================================================
   CampuSphere — Automated Quality Gates (Milestone 8, Section 8.8 / first R12)
   =============================================================================
   Lightweight, dependency-free critical-flow gate. It boots the real app with
   scripts/with-server.js (Windows-safe, self-terminating), then asserts the
   security/error contracts for both MySQL and Supabase runtime modes, plus a
   static PWA-privacy analysis of public/sw.js.

   Covered:
     - auth/session basics (login -> session, wrong password rejected)
     - authorization (401 unauthenticated API, 403 role denial)
     - malformed JSON -> 400
     - CSRF -> 403
     - rate limiting -> 429 (+ Retry-After)
     - API 404 JSON / browser 404 HTML contracts
     - representative admin CRUD + validation (FAQ create/list/delete + 400)
     - PWA privacy boundaries (sw.js never caches authenticated HTML/APIs;
       Cloudinary media is bounded/capped, /img/vr/ never mirrored)
     - media URL policy (utils/mediaUrl: local /img/ or res.cloudinary.com only)
     - CSP media policy (res.cloudinary.com in img/media/connect directives —
       Pannellum XHR-loads panoramas — never script-src)
     - VR runtime sanitizer (vrController routes image_url through normalizeMediaUrl;
       /vr, /vr/:sceneKey, /vr/routes/:id, /api/vr/routes/:id reachable + sanitized)
     - Cloudinary docs/env alignment (.env.example/README/deployment match the live
       10.4-10.6 implementation, no stale "future-only" wording, no real secret values)
     - sanitized response leak scan (no stack/SQL/secret/cookie in error bodies)
     - room scheduling: runs the database-free semester-image contract probe
       covering schema/source, admin/auth/privacy, direct VR linkage, accessible
       viewer, legacy read-only fallback, sync, and indexes. Runtime CRUD parity
       waits for separately authorized migration 0020 application.

   Runtime modes (each forces the child SESSION_STORE so this gate verifies the
   session-store runtime, not just the data-source switches — Milestone 9, 9.6):
     - MySQL session fallback: SESSION_STORE=mysql + data-source=mysql. Always runs.
     - Supabase session store: SESSION_STORE=supabase + data-source=supabase. Runs
       when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set; SKIPs cleanly in
       MySQL-only setups. BUT if top-level SESSION_STORE=supabase is selected and
       Supabase env is missing, it FAILS (fail-closed) instead of skipping.

   Hygiene:
     - All created rows use the unique prefix below and are deleted in `finally`.
     - No secrets, cookies, session ids, SQL, or stack traces are ever printed.

   Usage:
     node scripts/quality-gates.js
   ============================================================================= */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { withServer } = require('./with-server');
const { hasSupabaseConfig } = require('../config/supabase');

// M12.P1-R1: no hardcoded live-capable credentials. Each suite leg resolves
// its regression identities through the shared TEST-ONLY loader — the MySQL
// leg keeps the deterministic local seed fixtures, while the Supabase leg
// reads the SUPABASE_REGRESSION_* environment and FAILS CLOSED (fixed
// sanitized message) when any value is missing or blank. Values are never
// printed, and Supabase mode never falls back to a documented credential.
const { getRegressionCredentials } = require('./regressionCredentials');

// Deterministic 429 without starving the functional auth POSTs above it. This is
// a TEST-FIXTURE ceiling only (the app's rate-limit middleware/defaults are
// unchanged); it is set high enough that every functional auth POST in a suite
// run reaches its handler, while the section-10 flood (up to 50 POSTs) still
// crosses it and returns 429.
//
// Accounting (middleware/rateLimit.js increments then rejects on count > max, so
// exactly `max` auth-bucket POSTs pass per IP window). One runSuite pass issues,
// before the section-10 flood: 4 x POST /login in section 4, the student login
// (5) and admin login (6), the two M1 victim logins (7-8), six POST /register in
// section 9d (9-14), and the OFF.1 login + logout (15-16). The R3 follow-up adds
// the two primary-session cleanup logouts (17-18), so the previous ceiling of 16
// left ZERO headroom and would have 429'd the cleanup itself. 18 is the exact
// required count — still well under the app's own default of 20, and the
// section-10 flood (up to 50 POSTs) continues to cross it immediately.
process.env.RATE_LIMIT_AUTH_MAX = process.env.RATE_LIMIT_AUTH_MAX || '18';

const PORTS = { mysql: 3371, supabase: 3372 };

/* ---------------- tiny assertion harness ---------------- */
function makeRecorder(scope) {
  const failures = [];
  return {
    ok(name, cond) {
      if (!cond) failures.push(name);
      console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${scope} :: ${name}`);
    },
    failures,
  };
}

/* ---------------- http helpers ---------------- */
const parseJson = (t) => { try { return JSON.parse(t); } catch (e) { return null; } };

function cookieJar() {
  const jar = {};
  return {
    apply(res) {
      const list = res.headers.getSetCookie ? res.headers.getSetCookie()
        : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
      for (const c of list) {
        const pair = c.split(';')[0];
        const i = pair.indexOf('=');
        if (i > 0) jar[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
      }
    },
    header() { return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '); },
    values() { return Object.values(jar); },
  };
}
const metaCsrf = (html) => {
  const m = html.match(/name="csrf-token" content="([^"]+)"/) || html.match(/name="_csrf" value="([^"]+)"/);
  return m ? m[1] : '';
};

/* ---------------- primary-session lifecycle ----------------
   The suite's two PRIMARY logins (student, admin) previously outlived runSuite,
   leaving unexpired persisted rows for the canonical regression identities and
   dropping the read-only credential/session-safety probe to 22/24. Termination
   now goes through the SAME shared helper every spawned probe uses, so there is
   exactly one supported logout path across the whole npm-test fleet. */
const { createProbeSessionTracker } = require('./probeSessionLifecycle');

// Establish an authenticated session: GET /auth (cookie+csrf) then POST /login.
// Returns { ok, jar, csrf } where csrf is a token valid for the post-login
// (R3-regenerated) session, fetched from a page after login.
async function login(base, email, pass, landingPath) {
  const jar = cookieJar();
  let r = await fetch(base + '/auth', { headers: { Accept: 'text/html' } });
  jar.apply(r);
  const csrf0 = metaCsrf(await r.text());
  r = await fetch(base + '/login', {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.header() },
    body: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(pass)}&_csrf=${encodeURIComponent(csrf0)}`,
  });
  jar.apply(r);
  const loc = r.headers.get('location') || '';
  const ok = r.status === 302;
  let csrf = '';
  if (ok) {
    const pr = await fetch(base + (landingPath || '/dashboard'), { headers: { Accept: 'text/html', Cookie: jar.header() } });
    jar.apply(pr);
    csrf = metaCsrf(await pr.text());
  }
  return { ok, loc, jar, csrf };
}

// Re-read the admin synchronizer CSRF token from a fresh page render immediately
// before each admin state-changing request. The token is a STABLE per-session
// value (middleware/csrfProtection.js generates it lazily ONCE), but it is first
// generated on the initial authenticated GET after login; reusing the single
// token captured at login races that lazy write under the async Supabase session
// store, which can surface as a 403 "Invalid request token" when an earlier
// server phase shifts the timing. Re-fetching reads the now-persisted token (a
// real browser likewise re-reads the token from the current page before each
// submit) and applies any rolled session cookie. It does NOT bypass CSRF and
// adds no retry — fresh-token-before-mutation is the intended contract alignment.
async function refreshAdminCsrf(base, admin, path = '/admin/faqs') {
  // Read the admin CSRF token until two consecutive reads AGREE. The token is a
  // stable per-session value (middleware/csrfProtection.js), but it is GENERATED
  // lazily on the first authenticated GET after the login session-regenerate;
  // under the async Supabase session store that generating write can briefly lag
  // the next request's session read, so a single read can return a token the
  // server has not yet durably persisted -> 403 on the following mutation. Two
  // equal reads confirm the token is persisted and stable. This is a
  // condition-based wait on token stability — NOT a blind mutation retry and NOT
  // a CSRF bypass (the mutation still presents and the server still validates a
  // real token). Also applies any rolled session cookie back to the jar.
  let prev = null;
  for (let i = 0; i < 6; i++) {
    const pr = await fetch(base + path, { headers: { Accept: 'text/html', Cookie: admin.jar.header() } });
    admin.jar.apply(pr);
    const tok = metaCsrf(await pr.text());
    if (tok && tok === prev) return tok;
    prev = tok;
  }
  return prev || '';
}

/* ---------------- the per-mode contract suite ---------------- */
async function runSuite(base, mode) {
  const rec = makeRecorder(mode);
  const { ok } = rec;
  const errorBodies = [];
  const allCookieValues = [];

  // M12.P1-R1: per-mode regression identities (see loader header). The child
  // server's AUTH_DATA_SOURCE equals this suite's mode (with-server sets all
  // six *_DATA_SOURCE switches from it), so the credential source must match.
  const creds = getRegressionCredentials(mode === 'supabase' ? 'supabase' : 'mysql');
  const ADMIN_EMAIL = creds.admin.email;
  const ADMIN_PASS = creds.admin.password;
  const STUDENT_EMAIL = creds.student.email;
  const STUDENT_PASS = creds.student.password;

  /* The two PRIMARY sessions this suite authenticates. The tracker is declared
     out here so the try/finally safeguard below can still terminate them if an
     unexpected exception escapes mid-suite. The block below is intentionally
     NOT re-indented: wrapping ~750 unchanged lines in a try would otherwise
     produce a whitespace-only diff over the entire suite and bury the real
     change. */
  const sessions = createProbeSessionTracker({
    base,
    record: (label, pass) => ok(label, pass),
  });
  try {

  // 1. API 404 -> JSON ; browser 404 -> HTML
  let r = await fetch(base + '/api/__nope__', { headers: { Accept: 'application/json' } });
  let body = await r.text(); errorBodies.push(body); let o = parseJson(body);
  ok('API 404 -> 404 JSON {success:false}', r.status === 404 && !!o && o.success === false && !/<!DOCTYPE|<html/i.test(body));

  r = await fetch(base + '/__nope_page__', { headers: { Accept: 'text/html' } });
  body = await r.text(); errorBodies.push(body);
  ok('Browser 404 -> 404 HTML', r.status === 404 && /<!DOCTYPE|<html/i.test(body));

  // 2. Malformed JSON -> 400 JSON
  r = await fetch(base + '/api/__malformed__', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: '{ broken : json',
  });
  body = await r.text(); errorBodies.push(body); o = parseJson(body);
  ok('Malformed JSON -> 400 JSON {success:false}', r.status === 400 && !!o && o.success === false && /Malformed/i.test(o.message || ''));

  // 3. Unauthenticated admin API -> 401 JSON
  r = await fetch(base + '/admin/api/users', { headers: { Accept: 'application/json' } });
  body = await r.text(); errorBodies.push(body); o = parseJson(body);
  ok('Unauth admin API -> 401 JSON {success:false}', r.status === 401 && !!o && o.success === false);

  // 3b. L3: anonymous safe requests must NOT persist a session. With
  //     saveUninitialized:false, the CSRF middleware must not mint a token (and
  //     thereby dirty + Set-Cookie the session) for an otherwise-clean anonymous
  //     request. Fresh no-cookie requests only; we assert PRESENCE/ABSENCE of the
  //     session Set-Cookie by cookie NAME, never reading a cookie value. /auth is
  //     the one anonymous route that legitimately issues a token (login/register
  //     form) and so MAY set a cookie.
  {
    const setsSessionCookie = (resp) => {
      const list = resp.headers.getSetCookie ? resp.headers.getSetCookie()
        : (resp.headers.get('set-cookie') ? [resp.headers.get('set-cookie')] : []);
      return list.some((c) => /(^|[\s;])(campusphere\.sid|__Host-campusphere\.sid)=/.test(c));
    };

    const home = await fetch(base + '/home', { headers: { Accept: 'text/html' } });
    const homeBody = await home.text();
    ok('L3 anon GET /home -> 200 HTML', home.status === 200 && /<!DOCTYPE|<html/i.test(homeBody));
    ok('L3 anon GET /home sets no session cookie', !setsSessionCookie(home));

    /* Public FAQ is intentionally readable before sign-in. Keep this runtime
       check beside the other fresh no-cookie public surfaces: it proves the
       route is SSR HTML, uncached, pilot-index protected, and does not create
       an anonymous session. */
    const faq = await fetch(base + '/faq', { redirect: 'manual', headers: { Accept: 'text/html' } });
    const faqBody = await faq.text();
    ok('FAQ anon GET /faq -> 200 HTML (no redirect, no login required)',
      faq.status === 200 && /<!DOCTYPE|<html/i.test(faqBody));
    ok('FAQ anon GET /faq sets no session cookie', !setsSessionCookie(faq));
    ok('FAQ anon GET /faq is explicitly uncached', faq.headers.get('cache-control') === 'no-store');
    ok('FAQ anon GET /faq carries the exact pilot X-Robots-Tag',
      faq.headers.get('x-robots-tag') === 'noindex, nofollow, noarchive');
    ok('FAQ anon GET /faq renders the seeded public question and no admin controls',
      /How do I open the campus map\?/i.test(faqBody) && !/Add FAQ|\/admin\/api\/faqs/i.test(faqBody));

    const bld = await fetch(base + '/buildings', { redirect: 'manual', headers: { Accept: 'text/html' } });
    await bld.text();
    ok('L3 anon GET /buildings -> 302 /auth', bld.status === 302 && /\/auth/.test(bld.headers.get('location') || ''));
    ok('L3 anon GET /buildings sets no session cookie', !setsSessionCookie(bld));

    const apiB = await fetch(base + '/api/buildings', { headers: { Accept: 'application/json' } });
    const apiBody = await apiB.text(); errorBodies.push(apiBody); const apiJson = parseJson(apiBody);
    ok('L3 anon GET /api/buildings -> 401 JSON', apiB.status === 401 && !!apiJson && apiJson.success === false);
    ok('L3 anon GET /api/buildings sets no session cookie', !setsSessionCookie(apiB));

    const authPage = await fetch(base + '/auth', { headers: { Accept: 'text/html' } });
    const authBody = await authPage.text();
    const authTok = metaCsrf(authBody);
    ok('L3 anon GET /auth -> 200 HTML with non-empty CSRF token', authPage.status === 200 && !!authTok && authTok.length > 0);

    /* ---- M12.P1-R8: anonymous privacy notice + pilot indexing protection ----
       The privacy notice must be readable BEFORE an account exists, so it is
       asserted with a fresh no-cookie GET. The X-Robots-Tag assertions are
       EXACT-value, not substring, so a weakened directive fails.

       Indexing control is NOT access control: these headers only ask compliant
       crawlers to stay out. /buildings below is still a 302 to /auth. */
    const ROBOTS_TAG = 'noindex, nofollow, noarchive';

    const priv = await fetch(base + '/privacy', { redirect: 'manual', headers: { Accept: 'text/html' } });
    const privBody = await priv.text();
    ok('R8 anon GET /privacy -> 200 HTML (no redirect, no login required)',
      priv.status === 200 && /<!DOCTYPE|<html/i.test(privBody));
    ok('R8 anon GET /privacy sets no session cookie', !setsSessionCookie(priv));
    ok('R8 /privacy names the operator and the capstone-pilot nature',
      /Team Dutchess/i.test(privBody) && /capstone/i.test(privBody));
    ok('R8 /privacy discloses every required processor',
      /Vercel/i.test(privBody) && /Supabase/i.test(privBody) && /Upstash/i.test(privBody) &&
      /Google/i.test(privBody) && /Cloudinary/i.test(privBody));
    ok('R8 /privacy states the exact requested Google scopes',
      /openid/i.test(privBody) && /\bemail\b/i.test(privBody) && /\bprofile\b/i.test(privBody));
    ok('R8 /privacy states 30-day-post-defense retention and owner-managed deletion',
      /30 days/i.test(privBody) && /defense/i.test(privBody) &&
      /manual/i.test(privBody) && /delet/i.test(privBody));
    ok('R8 /privacy states data-subject rights and the CSPC DPO route',
      /10173|Data Privacy Act/i.test(privBody) && /Data Protection Officer/i.test(privBody));
    ok('R8 /privacy links the official CSPC policy',
      privBody.includes('https://cspc.edu.ph/governance/privacy-policy/'));
    ok('R8 /privacy states feedback is a separate Google Form CampuSphere does not store',
      /Google Form/i.test(privBody) && /does not (?:receive|store)/i.test(privBody));
    ok('R8 /privacy claims no consent basis, legal basis, or automatic deletion',
      !/\blegal basis\b/i.test(privBody) &&
      !/\bautomatically deleted\b/i.test(privBody) &&
      !/\byou consent\b/i.test(privBody) &&
      !/\bby using this (?:site|application|service) you agree\b/i.test(privBody));

    /* M12.P1-R8 re-review, asserted on the RENDERED body (not just the source):
       the anonymous-denial claim must be scoped to authorization-denial audit
       events, must not reappear as a blanket "not recorded/logged" promise, and
       the separate method/path request-log disclosure must still be present. */
    ok('R8 /privacy scopes the anonymous-denial claim to authorization-denial audit events',
      /not\s+written\s+as\s+authorization-denial\s+audit\s+events/i.test(privBody));
    ok('R8 /privacy does not claim anonymous traffic is unlogged',
      !/signed-out\s+visitors\s+are\s+not\s+recorded/i.test(privBody) &&
      !/signed-out\s+visitors\s+are\s+never\s+recorded/i.test(privBody) &&
      !/anonymous\s+(?:requests|traffic|visitors)\s+are\s+(?:not|never)\s+(?:recorded|logged)/i.test(privBody));
    // \s+ between words: the rendered markup wraps these sentences across
    // lines, so a literal single space does not match the served HTML.
    ok('R8 /privacy still discloses the separate method/path request logging',
      /HTTP\s+method\s+and\s+the\s+path/i.test(privBody) &&
      /Query\s+strings\s+are\s+deliberately\s+stripped/i.test(privBody));

    ok('R8 anon GET / carries the exact pilot X-Robots-Tag',
      (await fetch(base + '/', { headers: { Accept: 'text/html' } })).headers.get('x-robots-tag') === ROBOTS_TAG);
    ok('R8 anon GET /auth carries the exact pilot X-Robots-Tag',
      authPage.headers.get('x-robots-tag') === ROBOTS_TAG);
    ok('R8 anon GET /privacy carries the exact pilot X-Robots-Tag',
      priv.headers.get('x-robots-tag') === ROBOTS_TAG);
    ok('R8 the authenticated-HTML denial path carries the exact pilot X-Robots-Tag',
      (await fetch(base + '/dashboard', { redirect: 'manual', headers: { Accept: 'text/html' } }))
        .headers.get('x-robots-tag') === ROBOTS_TAG);

    const robots = await fetch(base + '/robots.txt');
    const robotsBody = (await robots.text()).replace(/\r\n/g, '\n').trim();
    ok('R8 GET /robots.txt -> 200 disallowing every crawler',
      robots.status === 200 && robotsBody === 'User-agent: *\nDisallow: /');
  }

  // 3c. L5: the local "sample 360" scratch panorama dir must NOT be publicly
  //     served (returns 404, no session cookie), while a normal public image is
  //     still served. Fresh no-cookie GETs; asserts cookie presence by name only.
  {
    const setsSessionCookie = (resp) => {
      const list = resp.headers.getSetCookie ? resp.headers.getSetCookie()
        : (resp.headers.get('set-cookie') ? [resp.headers.get('set-cookie')] : []);
      return list.some((c) => /(^|[\s;])(campusphere\.sid|__Host-campusphere\.sid)=/.test(c));
    };

    // Pick a real file under the sample dir if this checkout has one.
    const sampleDir = path.join(__dirname, '..', 'public', 'img', 'sample 360');
    let sampleFile = null;
    try {
      if (fs.existsSync(sampleDir)) {
        sampleFile = (fs.readdirSync(sampleDir).find((x) => /\.(jpe?g|png|webp|gif)$/i.test(x))) || null;
      }
    } catch (e) { /* ignore */ }

    if (sampleFile) {
      const s = await fetch(base + '/img/sample%20360/' + encodeURIComponent(sampleFile), { headers: { Accept: 'image/*' } });
      await s.text();
      ok('L5 /img/sample%20360/* -> 404 (not publicly served)', s.status === 404);
      ok('L5 /img/sample%20360/* sets no session cookie', !setsSessionCookie(s));
    } else {
      ok('L5 sample-360 dir absent -> nothing to serve (skip)', true);
    }

    // A normal public image must still be served (200) if present in this checkout.
    const logoPath = path.join(__dirname, '..', 'public', 'img', 'cspc-logo.png');
    if (fs.existsSync(logoPath)) {
      const logo = await fetch(base + '/img/cspc-logo.png', { headers: { Accept: 'image/*' } });
      await logo.text();
      ok('L5 normal public image /img/cspc-logo.png still served (200)', logo.status === 200);
    } else {
      ok('L5 normal public image absent -> skip', true);
    }
  }

  // 4. Auth basics: wrong password rejected (no session granted)
  {
    const jar = cookieJar();
    let a = await fetch(base + '/auth', { headers: { Accept: 'text/html' } });
    jar.apply(a);
    const c = metaCsrf(await a.text());
    a = await fetch(base + '/login', {
      method: 'POST', redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.header() },
      body: `email=${encodeURIComponent(ADMIN_EMAIL)}&password=wrong-password-xyz&_csrf=${encodeURIComponent(c)}`,
    });
    jar.apply(a);
    // Wrong creds must NOT redirect to an authed area; a follow-up /admin stays gated.
    const probe = await fetch(base + '/admin/api/users', { headers: { Accept: 'application/json', Cookie: jar.header() } });
    ok('Wrong password -> not authenticated (admin API 401)', probe.status === 401);
    // L4 (login user-enumeration): a KNOWN email with a WRONG password stays
    // rejected with NO session. The dummy-hash timing fix must not change this
    // functional contract (reuses the attempt above — no extra login POST).
    ok('L4 known email + wrong password -> not authenticated', a.status !== 302 && probe.status === 401);

    // L4: an UNKNOWN email is likewise rejected with no session. Post-fix the
    // no-user path also runs bcrypt.compare (against a fixed dummy hash), but the
    // functional result is unchanged. One extra login POST (kept within the
    // auth-preflight budget so the section-10 rate-limit flood still reaches 429).
    const ujar = cookieJar();
    let ua = await fetch(base + '/auth', { headers: { Accept: 'text/html' } });
    ujar.apply(ua);
    const uc = metaCsrf(await ua.text());
    ua = await fetch(base + '/login', {
      method: 'POST', redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: ujar.header() },
      body: `email=${encodeURIComponent(`qg-nouser-${mode}-${Date.now()}@example.com`)}&password=whatever-Pass123&_csrf=${encodeURIComponent(uc)}`,
    });
    ujar.apply(ua);
    const uprobe = await fetch(base + '/admin/api/users', { headers: { Accept: 'application/json', Cookie: ujar.header() } });
    ok('L4 unknown email -> not authenticated', ua.status !== 302 && uprobe.status === 401);

    // L4 NO-GO: a JSON POST /login carrying a NON-STRING field must be a clean
    // rejection, never a 500 (the guard must not call .trim() / bcrypt.compare on
    // a non-string). Modeled on the JSON /register helper. CSRF via header.
    const postLoginJson = async (jar, csrf, obj) => {
      const r = await fetch(base + '/login', {
        method: 'POST', redirect: 'manual',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrf, Cookie: jar.header() },
        body: JSON.stringify(obj),
      });
      jar.apply(r);
      return r;
    };
    {
      const jj = cookieJar();
      let p = await fetch(base + '/auth', { headers: { Accept: 'text/html' } });
      jj.apply(p);
      const tt = metaCsrf(await p.text());
      const r1 = await postLoginJson(jj, tt, { email: { nested: 'bad' }, password: 'ProbePass123' });
      const pr1 = await fetch(base + '/admin/api/users', { headers: { Accept: 'application/json', Cookie: jj.header() } });
      ok('L4 JSON non-string email -> not 500', r1.status !== 500);
      ok('L4 JSON non-string email -> no auth redirect + not authenticated', r1.status !== 302 && pr1.status === 401);
    }
    {
      const jj = cookieJar();
      let p = await fetch(base + '/auth', { headers: { Accept: 'text/html' } });
      jj.apply(p);
      const tt = metaCsrf(await p.text());
      const r2 = await postLoginJson(jj, tt, { email: `qg-jsonpw-${mode}-${Date.now()}@example.com`, password: { nested: 'bad' } });
      const pr2 = await fetch(base + '/admin/api/users', { headers: { Accept: 'application/json', Cookie: jj.header() } });
      ok('L4 JSON non-string password -> not 500', r2.status !== 500);
      ok('L4 JSON non-string password -> no auth redirect + not authenticated', r2.status !== 302 && pr2.status === 401);
    }
  }

  // 5. Auth basics: valid student login -> 302 /dashboard
  const student = await login(base, STUDENT_EMAIL, STUDENT_PASS, '/dashboard');
  // Tracked immediately after the login attempt so it is terminated even if a
  // later section throws before the normal cleanup point.
  if (student.ok) sessions.register('student', student.jar, '/dashboard');
  allCookieValues.push(...student.jar.values());
  ok('Student login -> 302 /dashboard', student.ok && /\/dashboard/.test(student.loc));
  // L4: valid credentials still authenticate (the always-compare refactor must
  // not break the success path). Admin's valid login is asserted in section 9.
  ok('L4 valid login still authenticates (student)', student.ok && /\/dashboard/.test(student.loc));

  const signedFaq = await fetch(base + '/faq', {
    headers: { Accept: 'text/html', Cookie: student.jar.header() },
  });
  const signedFaqBody = await signedFaq.text();
  ok('FAQ signed-in GET /faq -> 200 with dashboard chrome',
    signedFaq.status === 200 && /id="dashNav"/.test(signedFaqBody));
  ok('FAQ signed-in navigation marks the FAQ link active',
    /class="[^"]*dash-nav__tab--active[^"]*"[^>]*id="tabFaq"/.test(signedFaqBody));

  // 6. Authorization: student hitting admin API -> 403 JSON
  r = await fetch(base + '/admin/api/users', { headers: { Accept: 'application/json', Cookie: student.jar.header() } });
  body = await r.text(); errorBodies.push(body); o = parseJson(body);
  ok('Student -> admin API 403 JSON {success:false}', r.status === 403 && !!o && o.success === false);

  // 7. Validation 400: logged-in search query over the cap
  r = await fetch(base + '/api/search?q=' + 'a'.repeat(300), { headers: { Accept: 'application/json', Cookie: student.jar.header() } });
  body = await r.text(); errorBodies.push(body); o = parseJson(body);
  ok('Search over cap -> 400 JSON {success:false}', r.status === 400 && !!o && o.success === false);

  // 7b. VR runtime reachable for an authenticated session (Section 10.5). All
  //     four endpoints are requireLogin; the controller routes every scene
  //     image_url through normalizeMediaUrl before output, and never exposes
  //     cloudinary_public_id.
  {
    const vrHtml = await fetch(base + '/vr', { headers: { Accept: 'text/html', Cookie: student.jar.header() } });
    ok('VR /vr -> 200 HTML', vrHtml.status === 200);
    const vrScene = await fetch(base + '/vr/scene-main-gate', { headers: { Accept: 'text/html', Cookie: student.jar.header() } });
    ok('VR /vr/:sceneKey -> 200 HTML', vrScene.status === 200);
    const vrRoute = await fetch(base + '/vr/routes/1', { headers: { Accept: 'text/html', Cookie: student.jar.header() } });
    ok('VR /vr/routes/:routeId -> 200 HTML', vrRoute.status === 200);
    const vrApi = await fetch(base + '/api/vr/routes/1', { headers: { Accept: 'application/json', Cookie: student.jar.header() } });
    const vrApiBody = await vrApi.text(); errorBodies.push(vrApiBody);
    const vrApiJson = parseJson(vrApiBody);
    ok('VR /api/vr/routes/:routeId reachable (200|404 JSON)', (vrApi.status === 200 || vrApi.status === 404) && !!vrApiJson && typeof vrApiJson.success === 'boolean');
    ok('VR API never exposes cloudinary_public_id', !/cloudinary_public_id/i.test(vrApiBody));
    const vrScenes = (vrApiJson && Array.isArray(vrApiJson.scenes)) ? vrApiJson.scenes : [];
    const imgsSafe = vrScenes.every((s) => s.image_url == null
      || /^\/img\//.test(s.image_url)
      || /^https:\/\/res\.cloudinary\.com\//.test(s.image_url));
    ok('VR API scene image_url values are sanitized (local /img or res.cloudinary.com)', imgsSafe);
  }

  // 8. CSRF: state-changing POST without a token -> 403
  r = await fetch(base + '/api/update-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Cookie: student.jar.header() },
    body: JSON.stringify({ first_name: 'x' }),
  });
  body = await r.text(); errorBodies.push(body); o = parseJson(body);
  ok('CSRF missing -> 403 JSON "Invalid request token"', r.status === 403 && !!o && /Invalid request token/i.test(o.message || ''));

  // 9. Admin CRUD + validation (FAQ), self-cleaning
  const admin = await login(base, ADMIN_EMAIL, ADMIN_PASS, '/admin/faqs');
  // Tracked immediately after the login attempt (see the student note above).
  if (admin.ok) sessions.register('admin', admin.jar, '/admin/faqs');
  allCookieValues.push(...admin.jar.values());
  ok('Admin login -> 302 /admin*', admin.ok);
  const PREFIX = `__qg_${mode}_${Date.now()}__`;
  let createdId = null;
  try {
    // valid create -> 201 (fresh CSRF token immediately before the mutation)
    let csrf = await refreshAdminCsrf(base, admin);
    r = await fetch(base + '/admin/api/faqs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrf, Cookie: admin.jar.header() },
      body: JSON.stringify({ question: `${PREFIX} <b>What time does the library open?</b>`, answer: '<script>faq-probe</script><img src=x onerror=faqProbe>', category: 'general', display_order: 999 }),
    });
    body = await r.text(); o = parseJson(body);
    createdId = o && o.faq && o.faq.id;
    ok('Admin CRUD: create FAQ -> 201 {success:true}', r.status === 201 && !!o && o.success === true && !!createdId);

    // validation: missing display_order -> 400 (fresh CSRF token)
    csrf = await refreshAdminCsrf(base, admin);
    r = await fetch(base + '/admin/api/faqs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrf, Cookie: admin.jar.header() },
      body: JSON.stringify({ question: `${PREFIX} missing order`, answer: 'x', category: 'general' }),
    });
    body = await r.text(); errorBodies.push(body); o = parseJson(body);
    ok('Admin CRUD: invalid FAQ -> 400 {success:false}', r.status === 400 && !!o && o.success === false);

    // read back -> created row present
    r = await fetch(base + '/admin/api/faqs', { headers: { Accept: 'application/json', Cookie: admin.jar.header() } });
    o = parseJson(await r.text());
    const list = o && (o.faqs || o.data || []);
    ok('Admin CRUD: list includes created FAQ', Array.isArray(list) && list.some((f) => f.id === createdId));

    // The public page must escape admin-authored text. This request is read-only
    // and uses the same temporary row that the finally block removes below.
    const publicWithProbeFaq = await fetch(base + '/faq', { headers: { Accept: 'text/html' } });
    const publicWithProbeFaqBody = await publicWithProbeFaq.text();
    ok('Public FAQ escapes temporary admin-authored HTML',
      publicWithProbeFaq.status === 200 &&
      publicWithProbeFaqBody.includes('&lt;script&gt;faq-probe&lt;/script&gt;') &&
      publicWithProbeFaqBody.includes('&lt;img src=x onerror=faqProbe&gt;') &&
      !publicWithProbeFaqBody.includes('<script>faq-probe</script>') &&
      !/<img[^>]*onerror=faqProbe/i.test(publicWithProbeFaqBody));

    // delete -> 200
    if (createdId) {
      csrf = await refreshAdminCsrf(base, admin);
      r = await fetch(base + `/admin/api/faqs/${createdId}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json', 'X-CSRF-Token': csrf, Cookie: admin.jar.header() },
      });
      o = parseJson(await r.text());
      ok('Admin CRUD: delete FAQ -> 200 {success:true}', r.status === 200 && !!o && o.success === true);
      createdId = null;
    }
  } finally {
    // Guaranteed cleanup: remove ANY FAQ left over with our prefix.
    try {
      const lr = await fetch(base + '/admin/api/faqs', { headers: { Accept: 'application/json', Cookie: admin.jar.header() } });
      const lo = parseJson(await lr.text());
      const leftovers = ((lo && (lo.faqs || lo.data)) || []).filter((f) => typeof f.question === 'string' && f.question.includes(PREFIX));
      for (const f of leftovers) {
        // Fresh token per cleanup delete; fall back to the login token if a
        // refresh GET fails (cleanup is best-effort and must not throw).
        const csrf = await refreshAdminCsrf(base, admin).catch(() => admin.csrf);
        await fetch(base + `/admin/api/faqs/${f.id}`, {
          method: 'DELETE',
          headers: { Accept: 'application/json', 'X-CSRF-Token': csrf, Cookie: admin.jar.header() },
        }).catch(() => {});
      }
      console.log(`  [cleanup] ${mode} :: removed ${leftovers.length} leftover probe FAQ(s)`);
    } catch (e) {
      console.log(`  [cleanup] ${mode} :: FAQ cleanup skipped (non-fatal)`);
    }
  }

  // 9b. Section 10.6: admin media metadata (buildings + VR scenes), self-cleaning.
  //     Fresh admin CSRF token before every mutation (10.5 pattern). Asserts the
  //     admin response carries both media fields, invalid media URL / public id
  //     are rejected 400, and public/runtime output never exposes
  //     cloudinary_public_id or the raw public-id value.
  {
    const CLD_URL = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
    const PUB_ID = 'campus/qg-' + mode + '-pid';

    // ---- Building media metadata ----
    let bId = null;
    try {
      let mcsrf = await refreshAdminCsrf(base, admin);
      let mr = await fetch(base + '/admin/api/buildings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': mcsrf, Cookie: admin.jar.header() },
        body: JSON.stringify({ name: `${PREFIX} Media Bldg`, category: 'Academic', description: 'probe', lat: 13.4, lng: 123.4, image_url: CLD_URL, cloudinary_public_id: PUB_ID }),
      });
      let bo = parseJson(await mr.text());
      bId = bo && bo.building && bo.building.id;
      ok('M10.6 building create returns image_url + cloudinary_public_id',
        mr.status === 200 && !!bo && bo.success === true && !!bo.building
        && bo.building.image_url === CLD_URL && bo.building.cloudinary_public_id === PUB_ID);

      mcsrf = await refreshAdminCsrf(base, admin);
      mr = await fetch(base + '/admin/api/buildings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': mcsrf, Cookie: admin.jar.header() },
        body: JSON.stringify({ name: `${PREFIX} Bad URL`, category: 'Academic', lat: 13.4, lng: 123.4, image_url: 'https://example.com/x.jpg' }),
      });
      { const t = await mr.text(); errorBodies.push(t); const j = parseJson(t);
        ok('M10.6 building invalid image_url -> 400', mr.status === 400 && !!j && j.success === false); }

      mcsrf = await refreshAdminCsrf(base, admin);
      mr = await fetch(base + '/admin/api/buildings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': mcsrf, Cookie: admin.jar.header() },
        body: JSON.stringify({ name: `${PREFIX} Bad PID`, category: 'Academic', lat: 13.4, lng: 123.4, cloudinary_public_id: 'bad id!' }),
      });
      { const t = await mr.text(); errorBodies.push(t); const j = parseJson(t);
        ok('M10.6 building invalid cloudinary_public_id -> 400', mr.status === 400 && !!j && j.success === false); }

      mr = await fetch(base + '/api/buildings', { headers: { Accept: 'application/json', Cookie: admin.jar.header() } });
      const pubBody = await mr.text();
      ok('M10.6 public /api/buildings hides cloudinary_public_id + raw id',
        mr.status === 200 && !/cloudinary_public_id/i.test(pubBody) && !pubBody.includes(PUB_ID));

      // NO-GO regression: the admin campus-map bootstrap JSON must carry the media
      // metadata, else an edit-after-reload submits blanks and silently clears it.
      mr = await fetch(base + '/admin/campus-map', { headers: { Accept: 'text/html', Cookie: admin.jar.header() } });
      const cmHtml = await mr.text();
      const bm = cmHtml.match(/<script id="buildings-data-json"[^>]*>([\s\S]*?)<\/script>/);
      const bootstrap = bm ? parseJson(bm[1]) : null;
      const brow = Array.isArray(bootstrap) ? bootstrap.find((x) => Number(x.id) === Number(bId)) : null;
      ok('M10.6 building bootstrap JSON carries image_url + cloudinary_public_id',
        mr.status === 200 && !!brow && brow.image_url === CLD_URL && brow.cloudinary_public_id === PUB_ID);

      if (brow) {
        // Simulate reload -> open -> save using ONLY the bootstrap row values
        // (unchanged media). Without the bootstrap fix the media would be blank
        // here and get cleared; with it, the update must preserve the metadata.
        const pcsrf = await refreshAdminCsrf(base, admin);
        const pr2 = await fetch(base + `/admin/api/buildings/${bId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': pcsrf, Cookie: admin.jar.header() },
          body: JSON.stringify({ name: brow.name, category: brow.category, description: brow.description, lat: String(brow.lat), lng: String(brow.lng), details: brow.details, image_url: brow.image_url, cloudinary_public_id: brow.cloudinary_public_id }),
        });
        const po = parseJson(await pr2.text());
        ok('M10.6 building edit-after-reload preserves media metadata',
          pr2.status === 200 && !!po && po.success === true && !!po.building
          && po.building.image_url === CLD_URL && po.building.cloudinary_public_id === PUB_ID);
      }
    } finally {
      if (bId) {
        const dcsrf = await refreshAdminCsrf(base, admin).catch(() => admin.csrf);
        await fetch(base + `/admin/api/buildings/${bId}`, { method: 'DELETE', headers: { Accept: 'application/json', 'X-CSRF-Token': dcsrf, Cookie: admin.jar.header() } }).catch(() => {});
      }
    }

    // ---- VR scene media metadata ----
    let sId = null;
    const sceneKey = `qg-${mode}-${Date.now()}`;
    try {
      let mcsrf = await refreshAdminCsrf(base, admin);
      let mr = await fetch(base + '/admin/api/vr/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': mcsrf, Cookie: admin.jar.header() },
        body: JSON.stringify({ scene_key: sceneKey, title: 'QG Media Scene', description: 'probe', image_url: CLD_URL, cloudinary_public_id: PUB_ID, initial_yaw: 0, initial_pitch: 0, display_order: 990 }),
      });
      let so = parseJson(await mr.text());
      sId = so && so.scene && so.scene.id;
      ok('M10.6 VR scene create returns image_url + cloudinary_public_id',
        mr.status === 201 && !!so && so.success === true && !!so.scene
        && so.scene.image_url === CLD_URL && so.scene.cloudinary_public_id === PUB_ID);

      if (sId) {
        mr = await fetch(base + `/admin/api/vr/scenes/${sId}`, { headers: { Accept: 'application/json', Cookie: admin.jar.header() } });
        const go = parseJson(await mr.text());
        ok('M10.6 VR scene get returns cloudinary_public_id', mr.status === 200 && !!go && !!go.scene && go.scene.cloudinary_public_id === PUB_ID);
      }

      mcsrf = await refreshAdminCsrf(base, admin);
      mr = await fetch(base + '/admin/api/vr/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': mcsrf, Cookie: admin.jar.header() },
        body: JSON.stringify({ scene_key: `${sceneKey}-b`, title: 'Bad URL', image_url: 'http://res.cloudinary.com/x.jpg', initial_yaw: 0, initial_pitch: 0, display_order: 1 }),
      });
      { const t = await mr.text(); errorBodies.push(t); const j = parseJson(t);
        ok('M10.6 VR scene invalid image_url -> 400', mr.status === 400 && !!j && j.success === false); }

      mcsrf = await refreshAdminCsrf(base, admin);
      mr = await fetch(base + '/admin/api/vr/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': mcsrf, Cookie: admin.jar.header() },
        body: JSON.stringify({ scene_key: `${sceneKey}-c`, title: 'Bad PID', cloudinary_public_id: 'a b', initial_yaw: 0, initial_pitch: 0, display_order: 1 }),
      });
      { const t = await mr.text(); errorBodies.push(t); const j = parseJson(t);
        ok('M10.6 VR scene invalid cloudinary_public_id -> 400', mr.status === 400 && !!j && j.success === false); }

      mr = await fetch(base + `/vr/${encodeURIComponent(sceneKey)}`, { headers: { Accept: 'text/html', Cookie: admin.jar.header() } });
      const vrHtml = await mr.text();
      ok('M10.6 public VR /vr/:sceneKey hides cloudinary_public_id + raw id',
        mr.status === 200 && !/cloudinary_public_id/i.test(vrHtml) && !vrHtml.includes(PUB_ID));
    } finally {
      if (sId) {
        const dcsrf = await refreshAdminCsrf(base, admin).catch(() => admin.csrf);
        await fetch(base + `/admin/api/vr/scenes/${sId}`, { method: 'DELETE', headers: { Accept: 'application/json', 'X-CSRF-Token': dcsrf, Cookie: admin.jar.header() } }).catch(() => {});
      }
    }

    // Admin edit pages render the new optional media inputs (EJS render smoke).
    {
      let pr = await fetch(base + '/admin/campus-map', { headers: { Accept: 'text/html', Cookie: admin.jar.header() } });
      const cm = await pr.text();
      ok('M10.6 admin campus-map renders building media inputs', pr.status === 200 && cm.includes('name="image_url"') && cm.includes('name="cloudinary_public_id"'));
      pr = await fetch(base + '/admin/vr', { headers: { Accept: 'text/html', Cookie: admin.jar.header() } });
      const vp = await pr.text();
      ok('M10.6 admin vr renders cloudinary_public_id input', pr.status === 200 && vp.includes('name="cloudinary_public_id"'));
    }
  }

  // 9c. M1 stale-session revocation: an admin role change / user deletion must
  //     invalidate the target user's LIVE persisted session, so a stale cookie
  //     can no longer reach admin surfaces. Runs against whichever persistent
  //     store this mode booted (SESSION_STORE=mysql | supabase). Self-cleaning.
  {
    const TMP_PASS = 'ProbePass123!';
    const mkEmail = (tag) => `qg-stale-${tag}-${mode}-${Date.now()}@example.com`;

    // ---- (a) demotion revokes the target's live admin session ----
    let demoteId = null;
    const demoteEmail = mkEmail('demote');
    try {
      let ccsrf = await refreshAdminCsrf(base, admin);
      let cr = await fetch(base + '/admin/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': ccsrf, Cookie: admin.jar.header() },
        body: JSON.stringify({ first_name: 'QG', last_name: 'Demote', email: demoteEmail, password: TMP_PASS, role: 'admin' }),
      });
      const co = parseJson(await cr.text());
      demoteId = co && co.user && co.user.id;
      ok('M1 demote: temp admin created (201)', cr.status === 201 && !!demoteId);

      // Temp admin logs in on its OWN cookie jar and can reach the admin API.
      const victim = await login(base, demoteEmail, TMP_PASS, '/admin/users');
      allCookieValues.push(...victim.jar.values());
      const before = await fetch(base + '/admin/api/faqs', { headers: { Accept: 'application/json', Cookie: victim.jar.header() } });
      ok('M1 demote: temp admin live session reaches admin API (200)', victim.ok && before.status === 200);

      // Original admin demotes the temp admin to guest (role change).
      const ucsrf = await refreshAdminCsrf(base, admin);
      const ur = await fetch(base + `/admin/api/users/${demoteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': ucsrf, Cookie: admin.jar.header() },
        body: JSON.stringify({ first_name: 'QG', last_name: 'Demote', email: demoteEmail, role: 'guest' }),
      });
      const uo = parseJson(await ur.text());
      ok('M1 demote: role change -> 200 {success:true}', ur.status === 200 && !!uo && uo.success === true);

      // The temp admin's OLD session must no longer be a valid admin session.
      const after = await fetch(base + '/admin/api/faqs', { headers: { Accept: 'application/json', Cookie: victim.jar.header() } });
      ok('M1 demote: stale session revoked (admin API no longer 200)', after.status !== 200);
    } finally {
      if (demoteId) {
        const dcsrf = await refreshAdminCsrf(base, admin).catch(() => admin.csrf);
        await fetch(base + `/admin/api/users/${demoteId}`, { method: 'DELETE', headers: { Accept: 'application/json', 'X-CSRF-Token': dcsrf, Cookie: admin.jar.header() } }).catch(() => {});
      }
    }

    // ---- (b) deletion revokes the target's live admin session ----
    let deleteId = null;
    const deleteEmail = mkEmail('delete');
    try {
      const ccsrf = await refreshAdminCsrf(base, admin);
      const cr = await fetch(base + '/admin/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': ccsrf, Cookie: admin.jar.header() },
        body: JSON.stringify({ first_name: 'QG', last_name: 'Delete', email: deleteEmail, password: TMP_PASS, role: 'admin' }),
      });
      const co = parseJson(await cr.text());
      deleteId = co && co.user && co.user.id;
      ok('M1 delete: temp admin created (201)', cr.status === 201 && !!deleteId);

      const victim = await login(base, deleteEmail, TMP_PASS, '/admin/users');
      allCookieValues.push(...victim.jar.values());
      const before = await fetch(base + '/admin/api/faqs', { headers: { Accept: 'application/json', Cookie: victim.jar.header() } });
      ok('M1 delete: temp admin live session reaches admin API (200)', victim.ok && before.status === 200);

      const dcsrf = await refreshAdminCsrf(base, admin);
      const dr = await fetch(base + `/admin/api/users/${deleteId}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json', 'X-CSRF-Token': dcsrf, Cookie: admin.jar.header() },
      });
      const delJson = parseJson(await dr.text());
      ok('M1 delete: user deleted -> 200 {success:true}', dr.status === 200 && !!delJson && delJson.success === true);
      if (dr.status === 200) deleteId = null; // deleted; nothing left to clean up

      const after = await fetch(base + '/admin/api/faqs', { headers: { Accept: 'application/json', Cookie: victim.jar.header() } });
      ok('M1 delete: stale session revoked (admin API no longer 200)', after.status !== 200);
    } finally {
      if (deleteId) {
        const dcsrf2 = await refreshAdminCsrf(base, admin).catch(() => admin.csrf);
        await fetch(base + `/admin/api/users/${deleteId}`, { method: 'DELETE', headers: { Accept: 'application/json', 'X-CSRF-Token': dcsrf2, Cookie: admin.jar.header() } }).catch(() => {});
      }
    }
  }

  // 9d. M2 public registration validation: local POST /register must apply a
  //     server-side email format + password policy BEFORE any DB work, so a
  //     malformed email or a too-short password is rejected and grants NO
  //     authenticated session. A valid guest registration still authenticates
  //     (no regression) and is cleaned up. Each case fetches /auth first for a
  //     fresh cookie + CSRF token, then submits a form-encoded /register.
  {
    // Fresh anonymous jar + CSRF token from /auth (as a real browser would).
    const regBase = async () => {
      const jar = cookieJar();
      const a = await fetch(base + '/auth', { headers: { Accept: 'text/html' } });
      jar.apply(a);
      const csrf = metaCsrf(await a.text());
      return { jar, csrf };
    };
    const postRegister = async (jar, csrf, fields) => {
      const body = Object.entries(fields).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
        + `&_csrf=${encodeURIComponent(csrf)}`;
      const r = await fetch(base + '/register', {
        method: 'POST', redirect: 'manual',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.header() },
        body,
      });
      jar.apply(r);
      return r;
    };
    // JSON /register (CSRF token via X-CSRF-Token header). Lets us submit a
    // non-string field (e.g. email: { nested }) exactly as a JSON API client
    // would — the presence guard must NOT crash (500) on such values.
    const postRegisterJson = async (jar, csrf, obj) => {
      const r = await fetch(base + '/register', {
        method: 'POST', redirect: 'manual',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrf, Cookie: jar.header() },
        body: JSON.stringify(obj),
      });
      jar.apply(r);
      return r;
    };
    // A jar is "not authenticated" iff it cannot reach an admin-only JSON API
    // (anonymous -> 401). Used to prove a rejected registration granted no session.
    const notAuthenticated = async (jar) => {
      const p = await fetch(base + '/admin/api/faqs', { headers: { Accept: 'application/json', Cookie: jar.header() } });
      return p.status === 401;
    };

    // (a) malformed email -> rejected (no redirect) and not authenticated.
    {
      const { jar, csrf } = await regBase();
      const r = await postRegister(jar, csrf, { fullName: 'QG Reg', email: 'not-an-email', password: 'ProbePass123!', role: 'guest' });
      ok('M2 register: malformed email -> no auth redirect', r.status !== 302);
      ok('M2 register: malformed email -> not authenticated', await notAuthenticated(jar));
    }

    // (b) 1-character password (with a valid email) -> rejected, not authenticated.
    {
      const { jar, csrf } = await regBase();
      const r = await postRegister(jar, csrf, { fullName: 'QG Reg', email: `qg-reg-shortpw-${mode}-${Date.now()}@gmail.com`, password: 'x', role: 'guest' });
      ok('M2 register: 1-char password -> no auth redirect', r.status !== 302);
      ok('M2 register: 1-char password -> not authenticated', await notAuthenticated(jar));
    }

    // (b2) NON-STRING JSON email -> must NOT 500 (Codex NO-GO repro), no redirect,
    //      not authenticated. Reaches validateEmail (rejects non-strings cleanly).
    {
      const { jar, csrf } = await regBase();
      const r = await postRegisterJson(jar, csrf, { fullName: 'QG Reg', email: { nested: 'bad' }, password: 'ProbePass123!', role: 'guest' });
      ok('M2 register: JSON non-string email -> not 500', r.status !== 500);
      ok('M2 register: JSON non-string email -> no auth redirect', r.status !== 302);
      ok('M2 register: JSON non-string email -> not authenticated', await notAuthenticated(jar));
    }

    // (b3) NON-STRING JSON fullName -> must NOT 500 (the other .trim() call site),
    //      no redirect, not authenticated. A non-string fullName is treated as missing.
    {
      const { jar, csrf } = await regBase();
      const r = await postRegisterJson(jar, csrf, { fullName: { nested: 'bad' }, email: `qg-reg-jsonfn-${mode}-${Date.now()}@gmail.com`, password: 'ProbePass123!', role: 'guest' });
      ok('M2 register: JSON non-string fullName -> not 500', r.status !== 500);
      ok('M2 register: JSON non-string fullName -> no auth redirect', r.status !== 302);
      ok('M2 register: JSON non-string fullName -> not authenticated', await notAuthenticated(jar));
    }

    // (b4) NON-STRING JSON password (valid email) -> must NOT 500, no redirect,
    //      not authenticated. Reaches validatePassword (rejects non-strings cleanly).
    {
      const { jar, csrf } = await regBase();
      const r = await postRegisterJson(jar, csrf, { fullName: 'QG Reg', email: `qg-reg-jsonpw-${mode}-${Date.now()}@gmail.com`, password: { nested: 'bad' }, role: 'guest' });
      ok('M2 register: JSON non-string password -> not 500', r.status !== 500);
      ok('M2 register: JSON non-string password -> no auth redirect', r.status !== 302);
      ok('M2 register: JSON non-string password -> not authenticated', await notAuthenticated(jar));
    }

    // (c) valid guest registration still authenticates (no regression), then cleanup.
    const regEmail = `qg-reg-valid-${mode}-${Date.now()}@gmail.com`;
    try {
      const { jar, csrf } = await regBase();
      const r = await postRegister(jar, csrf, { fullName: 'QG Valid Guest', email: regEmail, password: 'ProbePass123!', role: 'guest' });
      allCookieValues.push(...jar.values());
      ok('M2 register: valid guest registration -> 302 /dashboard',
        r.status === 302 && /\/dashboard/.test(r.headers.get('location') || ''));
    } finally {
      // Best-effort cleanup: locate the created guest via the admin users page
      // bootstrap JSON (there is no GET /admin/api/users) and delete it.
      try {
        const lp = await fetch(base + '/admin/users', { headers: { Accept: 'text/html', Cookie: admin.jar.header() } });
        const html = await lp.text();
        const m = html.match(/<script id="users-data-json"[^>]*>([\s\S]*?)<\/script>/);
        const list = m ? parseJson(m[1]) : null;
        const row = Array.isArray(list) ? list.find((u) => u.email === regEmail) : null;
        if (row && row.id) {
          const dcsrf = await refreshAdminCsrf(base, admin).catch(() => admin.csrf);
          await fetch(base + `/admin/api/users/${row.id}`, { method: 'DELETE', headers: { Accept: 'application/json', 'X-CSRF-Token': dcsrf, Cookie: admin.jar.header() } }).catch(() => {});
        }
        console.log(`  [cleanup] ${mode} :: removed ${row && row.id ? 1 : 0} probe registration user(s)`);
      } catch (e) {
        console.log(`  [cleanup] ${mode} :: registration cleanup skipped (non-fatal)`);
      }
    }
  }

  // 9b. OFF.1 privacy: /map CSRF meta, authenticated-HTML no-store policy, and
  // the /map-token logout contract. Uses a FRESH session so the logout here
  // never disturbs any other section's state. Runs BEFORE section 10 so its
  // two auth-bucket POSTs (login + logout) stay inside the functional budget.
  // No token, cookie value, session id, credential, host, or raw error is
  // ever printed — assertions log fixed labels only.
  {
    const off1 = await login(base, STUDENT_EMAIL, STUDENT_PASS, '/map');
    allCookieValues.push(...off1.jar.values());
    ok('OFF.1: fresh student login for the privacy contract -> 302', off1.ok);
    if (off1.ok) {
      const normCc = (res) => (res.headers.get('cache-control') || '')
        .toLowerCase().split(',').map((s) => s.trim()).filter(Boolean).sort().join(',');

      const mr = await fetch(base + '/map', { headers: { Accept: 'text/html', Cookie: off1.jar.header() } });
      off1.jar.apply(mr);
      const mapHtml = await mr.text();
      ok('OFF.1: authenticated GET /map -> 200 HTML', mr.status === 200 && /<!DOCTYPE|<html/i.test(mapHtml));
      // Count META ELEMENTS, not attribute prose: the explanatory HTML comment
      // (same style as views/partials/head.ejs) also names the attribute.
      const mapMetaCount = (mapHtml.match(/<meta name="csrf-token"/g) || []).length;
      ok('OFF.1: /map carries exactly one nonempty csrf-token meta',
        mapMetaCount === 1 && metaCsrf(mapHtml).length > 0);
      ok('OFF.1: /map Cache-Control is exactly no-store, private', normCc(mr) === 'no-store,private');

      // Header-spoofing bypass attempts: the caching decision is anchored on
      // req.path, so a misleading Accept / XHR / Content-Type header still
      // receives the personalized HTML WITH the exact no-store policy.
      const bypassAttempts = [
        ['Accept: application/json', { Accept: 'application/json' }],
        ['X-Requested-With: XMLHttpRequest', { Accept: 'text/html', 'X-Requested-With': 'XMLHttpRequest' }],
        ['Content-Type: application/json', { Accept: 'text/html', 'Content-Type': 'application/json' }],
      ];
      for (const [label, hdrs] of bypassAttempts) {
        const br = await fetch(base + '/map', { headers: Object.assign({ Cookie: off1.jar.header() }, hdrs) });
        const bBody = await br.text();
        const bCt = (br.headers.get('content-type') || '').toLowerCase();
        ok(`OFF.1: /map with ${label} still returns 200 text/html with exact no-store, private`,
          br.status === 200 && bCt.includes('text/html') && /<!DOCTYPE|<html/i.test(bBody)
          && normCc(br) === 'no-store,private');
      }

      // Counter-case: the API exemption is PATH-scoped, so a misleading
      // Accept: text/html on /api/buildings changes nothing either.
      const ah = await fetch(base + '/api/buildings', { headers: { Accept: 'text/html', Cookie: off1.jar.header() } });
      const aho = parseJson(await ah.text());
      const ahCc = (ah.headers.get('cache-control') || '').toLowerCase();
      ok('OFF.1: /api/buildings with Accept: text/html stays JSON without no-store/private',
        ah.status === 200 && !!aho && !ahCc.includes('no-store') && !ahCc.includes('private'));

      const dr = await fetch(base + '/dashboard', { headers: { Accept: 'text/html', Cookie: off1.jar.header() } });
      await dr.text();
      ok('OFF.1: authenticated /dashboard Cache-Control is exactly no-store, private',
        dr.status === 200 && normCc(dr) === 'no-store,private');
      // M12.P1-R8: authenticated HTML (200, real session) must also carry the
      // exact pilot indexing directive, not just the anonymous surfaces.
      ok('R8: authenticated /dashboard HTML carries the exact pilot X-Robots-Tag',
        dr.status === 200 && dr.headers.get('x-robots-tag') === 'noindex, nofollow, noarchive');

      const ar = await fetch(base + '/api/buildings', { headers: { Accept: 'application/json', Cookie: off1.jar.header() } });
      const ao = parseJson(await ar.text());
      const aCc = (ar.headers.get('cache-control') || '').toLowerCase();
      ok('OFF.1: authenticated /api/buildings -> 200 JSON without no-store/private',
        ar.status === 200 && !!ao && !aCc.includes('no-store') && !aCc.includes('private'));

      const cssR = await fetch(base + '/css/offline.css', { headers: { Cookie: off1.jar.header() } });
      await cssR.text();
      const cssCc = (cssR.headers.get('cache-control') || '').toLowerCase();
      ok('OFF.1: /css/offline.css with the auth cookie -> 200 without no-store/private',
        cssR.status === 200 && !cssCc.includes('no-store') && !cssCc.includes('private'));

      const shellR = await fetch(base + '/offline.html', { headers: { Cookie: off1.jar.header() } });
      const shellBody = await shellR.text();
      const shellCc = (shellR.headers.get('cache-control') || '').toLowerCase();
      ok('OFF.1: /offline.html stays session-neutral without no-store/private',
        shellR.status === 200 && /offline/i.test(shellBody)
        && !shellBody.includes(STUDENT_EMAIL)
        && !off1.jar.values().some((v) => v && v.length > 8 && shellBody.includes(v))
        && !shellCc.includes('no-store') && !shellCc.includes('private'));

      // Logout with the token read SPECIFICALLY from /map (stable two-read
      // contract, same as the admin flows — not a bypass, not a retry).
      const mapTok = await refreshAdminCsrf(base, off1, '/map');
      const lr = await fetch(base + '/logout', {
        method: 'POST', redirect: 'manual',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: off1.jar.header() },
        body: `_csrf=${encodeURIComponent(mapTok)}`,
      });
      await lr.text();
      off1.jar.apply(lr); // pick up the expired/rolled session cookie
      ok('OFF.1: POST /logout with the /map token -> 302 /auth?logged_out=1',
        lr.status === 302 && (lr.headers.get('location') || '') === '/auth?logged_out=1');
      ok('OFF.1: the logout 302 itself carries exact no-store, private',
        normCc(lr) === 'no-store,private');

      const postLogout = await fetch(base + '/map', {
        redirect: 'manual', headers: { Accept: 'text/html', Cookie: off1.jar.header() },
      });
      await postLogout.text();
      ok('OFF.1: GET /map after logout redirects to /auth',
        postLogout.status === 302 && /\/auth/.test(postLogout.headers.get('location') || ''));
    }
  }

  /* 9e. Primary-session termination (M12.P1-R3 follow-up). Runs AFTER the OFF.1
     block (which owns its own fresh session and logs it out itself) and BEFORE
     the section-10 flood, so the flood remains the last auth-bucket operation
     of the run. Nothing below this point uses the student or admin jar. */
  await sessions.terminateAll();

  // 10. Rate limit -> 429 (+ Retry-After). Run LAST. IP-keyed pre-parse bucket.
  let got429 = false, last = null;
  for (let i = 0; i < 50; i++) {
    last = await fetch(base + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: 'email=flood@example.com&password=x',
    });
    if (last.status === 429) { got429 = true; break; }
    await last.text();
  }
  const b429 = got429 ? await last.text() : ''; if (got429) errorBodies.push(b429);
  o = got429 ? parseJson(b429) : null;
  ok('Rate limit -> 429 reached', got429);
  ok('Rate limit -> JSON {success:false} + Retry-After', !got429 || (!!o && o.success === false && !!last.headers.get('retry-after')));

  // 11. Leak scan across every error body collected this run
  const blob = errorBodies.join('\n');
  ok('Leak scan: no stack frames', !/\bat\s+\S+\s+\(.*:\d+:\d+\)/.test(blob) && !/\.js:\d+:\d+/.test(blob));
  ok('Leak scan: no SQL text', !/\b(SELECT|INSERT|UPDATE|DELETE)\b[\s\S]{0,40}\b(FROM|INTO|SET|WHERE)\b/i.test(blob));
  ok('Leak scan: no DB/driver internals', !/(ECONNREFUSED|ER_[A-Z_]+|ENOTFOUND|getaddrinfo|Sequelize)/.test(blob));
  ok('Leak scan: no supabase host/key/JWT', !/supabase\.co|service_role|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(blob));
  ok('Leak scan: no session cookie value', !allCookieValues.some((v) => v && v.length > 8 && blob.includes(v)));

  } finally {
    /* Safeguard: if an unexpected exception escaped before the normal cleanup
       point above, still attempt each NOT-YET-ATTEMPTED primary session exactly
       once. The tracker's `attempted` flag makes this a no-op on the normal
       path, so a session can never be logged out twice. Failures are recorded,
       not thrown, so the original exception (if any) still propagates. */
    await sessions.terminateAll();
  }

  return rec.failures;
}

/* ---------------- OFF.1 no-store middleware unit cases (database-free) ---------------- */
function runNoStoreUnitGate() {
  const rec = makeRecorder('no-store-unit');
  const { ok } = rec;
  const mw = require(path.join(__dirname, '..', 'middleware', 'authenticatedHtmlNoStore.js'));

  // Drive the REAL middleware with mocked req/res — no server, no database.
  function runCase(reqProps) {
    const headers = {};
    const req = Object.assign(
      { path: '/map', session: { user: { id: 1 } }, headers: {} },
      reqProps
    );
    const res = { set(k, v) { headers[k] = v; } };
    let nextCalls = 0;
    mw(req, res, () => { nextCalls += 1; });
    return { cc: headers['Cache-Control'], nextCalls };
  }
  const PROTECTED = 'no-store, private';

  let r = runCase({});
  ok('authenticated /map gets exactly no-store, private (next once)', r.cc === PROTECTED && r.nextCalls === 1);
  r = runCase({ headers: { accept: 'application/json' } });
  ok('Accept: application/json cannot bypass the policy', r.cc === PROTECTED && r.nextCalls === 1);
  r = runCase({ xhr: true });
  ok('XHR cannot bypass the policy', r.cc === PROTECTED && r.nextCalls === 1);
  r = runCase({ headers: { 'content-type': 'application/json' } });
  ok('Content-Type: application/json cannot bypass the policy', r.cc === PROTECTED && r.nextCalls === 1);
  r = runCase({ path: undefined });
  ok('undefined req.path fails closed to no-store (next once)', r.cc === PROTECTED && r.nextCalls === 1);
  r = runCase({ path: 42 });
  ok('non-string req.path fails closed to no-store (next once)', r.cc === PROTECTED && r.nextCalls === 1);
  r = runCase({ path: '/api/buildings' });
  ok('/api/buildings stays exempt (next once)', r.cc === undefined && r.nextCalls === 1);
  r = runCase({ path: '/admin/api/faqs' });
  ok('/admin/api/faqs stays exempt (next once)', r.cc === undefined && r.nextCalls === 1);
  r = runCase({ path: '/apiary' });
  ok('/apiary is protected (anchored prefix, no confusion)', r.cc === PROTECTED && r.nextCalls === 1);
  r = runCase({ path: '/admin/apiary' });
  ok('/admin/apiary is protected', r.cc === PROTECTED && r.nextCalls === 1);
  r = runCase({ path: '/foo/api/bar' });
  ok('/foo/api/bar is protected (no substring matching)', r.cc === PROTECTED && r.nextCalls === 1);
  r = runCase({ session: {} });
  ok('anonymous request (no session user) remains untouched (next once)', r.cc === undefined && r.nextCalls === 1);
  r = runCase({ session: undefined });
  ok('missing session remains untouched (next once)', r.cc === undefined && r.nextCalls === 1);
  return rec.failures;
}

/* ---------------- OFF.1 no-store middleware placement (static) ---------------- */
function runNoStorePlacementGate() {
  const rec = makeRecorder('no-store-placement');
  const { ok } = rec;
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const iStatic = server.indexOf('express.static(');
  const iSession = server.indexOf('app.use(session(');
  const iNoStore = server.indexOf('app.use(authenticatedHtmlNoStore)');
  const iRoutes = server.indexOf("app.use('/', indexRoutes)");
  ok('express.static is mounted before the session middleware',
    iStatic !== -1 && iSession !== -1 && iStatic < iSession);
  ok('authenticatedHtmlNoStore mounts after session setup and before dynamic routes',
    iNoStore !== -1 && iSession < iNoStore && iRoutes !== -1 && iNoStore < iRoutes);
  let mw = '';
  try {
    mw = fs.readFileSync(path.join(__dirname, '..', 'middleware', 'authenticatedHtmlNoStore.js'), 'utf8');
  } catch (e) { /* missing file fails the check below */ }
  ok('middleware anchors the exemption on req.path, fails closed, and never calls wantsJson',
    mw.includes("'/api/'") && mw.includes("'/admin/api/'")
    && mw.includes("typeof p !== 'string'") && mw.includes('indexOf(prefix) === 0')
    && mw.includes("res.set('Cache-Control', 'no-store, private')")
    && mw.includes('req.session.user')
    && !mw.includes('wantsJson('));
  return rec.failures;
}

const OFFLINE_TOUCH_TARGET_SELECTORS = [
  '.offline-page [data-offline-guide-download]',
  '.offline-page .dash-nav__tab',
  '.offline-page #offlineNavToggle',
  '.offline-page #offlineSidebarHandle',
  '.offline-page #offlineSidebarClose',
  '.offline-page #offlineSearchClear',
  '.offline-page [data-offline-filter]',
  '.offline-page #offlineRoutePlannerToggle',
  '.offline-page #offlineRouteDestClear',
  '.offline-page #offlineRouteFind',
  '.offline-page #offlineRecenterMap',
  '.offline-page #offlineClearMapRoute',
  '.offline-page #offlineDetailsClose',
  '.offline-page #offlineSetDestination',
  '.offline-page #offlineRouteClose',
  '.offline-page #offlineRouteClear',
  '.offline-page #offlineMobileListToggle',
  '.offline-page #offlineThemeToggle',
  '.offline-page .offline-building',
  '.offline-page .offline-building-marker',
  '.offline-page .offline-fallback-marker',
  '.offline-page .offline-map .maplibregl-ctrl-group button'
];

function offlineTouchTargetProblems(css) {
  const problems = [];
  const bounded = (String(css).match(/\/\* OFFLINE_TOUCH_TARGETS_START[\s\S]*?OFFLINE_TOUCH_TARGETS_END \*\//) || [])[0] || '';
  const rule = bounded.match(/([\s\S]*?)\{([\s\S]*?)\}/);
  if (!rule) return ['bounded offline touch-target rule is missing'];
  const selectors = new Set(rule[1]
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(',')
    .map((selector) => selector.trim())
    .filter(Boolean));
  for (const selector of OFFLINE_TOUCH_TARGET_SELECTORS) {
    if (!selectors.has(selector)) problems.push(`missing exact touch target: ${selector}`);
  }
  if (!/(?:^|;)\s*min-width\s*:\s*44px\s*;/.test(`;${rule[2]}`)) problems.push('touch targets lack exact 44px width');
  if (!/(?:^|;)\s*min-height\s*:\s*44px\s*;/.test(`;${rule[2]}`)) problems.push('touch targets lack exact 44px height');
  const fallbackRule = (String(css).match(/\.offline-fallback-marker\s*\{([\s\S]*?)\}/) || [])[1] || '';
  if (!/(?:^|;)\s*width\s*:\s*44px\s*;/.test(`;${fallbackRule}`)) problems.push('fallback markers lack an exact 44px width');
  if (!/(?:^|;)\s*height\s*:\s*44px\s*;/.test(`;${fallbackRule}`)) problems.push('fallback markers lack an exact 44px height');
  return problems;
}

function offlineTouchTargetMutationsAreRejected(css) {
  const cases = [
    css.replace('  min-width: 44px;', '  min-width: 34px;') + '\n.unrelated-fixture { min-width: 44px; }',
    css.replace('  min-height: 44px;', '  min-height: 34px;') + '\n.unrelated-fixture { min-height: 44px; }',
    css.replace('.offline-page #offlineSearchClear,', '.offline-page .unrelated-search-clear,'),
    css.replace('.offline-page #offlineMobileListToggle,', '.offline-page .offscreen-list-button,'),
    css.replace('.offline-page .offline-fallback-marker,', '.offline-page .undersized-fallback-marker,'),
    css.replace('  width: 44px;\n  height: 44px;\n  padding: 0;\n  appearance: none;',
      '  width: 18px;\n  height: 18px;\n  padding: 0;\n  appearance: none;')
  ];
  return cases.every((mutated) => mutated !== css && offlineTouchTargetProblems(mutated).length > 0);
}

function offlineMobileDetailsOverlapProblems(css, shell) {
  const problems = [];
  const mobile = String(css).match(/@media\s*\(max-width:\s*768px\)\s*\{([\s\S]*?)\n\}\s*\n\n@media\s*\(max-width:\s*420px\)/);
  const bounded = mobile
    ? (mobile[1].match(/\/\* OFFLINE_MOBILE_DETAILS_OVERLAP_START \*\/([\s\S]*?)\/\* OFFLINE_MOBILE_DETAILS_OVERLAP_END \*\//) || [])[1] || ''
    : '';
  if (!mobile) problems.push('mobile details-overlap rule is outside the 768px media boundary');
  if (!bounded) problems.push('bounded mobile details-overlap rule is missing');
  if (bounded && !/\.offline-page\s+#offlineDetailsPanel\.visible\s+~\s+#offlineMobileListToggle\s*\{\s*display:\s*none\s*;\s*\}/.test(bounded)) {
    problems.push('details overlap guard does not hide only the mobile toggle while details are visible');
  }
  const source = String(shell);
  const detailsIndex = source.indexOf('id="offlineDetailsPanel"');
  const toggleIndex = source.indexOf('id="offlineMobileListToggle"');
  if (detailsIndex === -1 || toggleIndex === -1 || detailsIndex >= toggleIndex) {
    problems.push('details panel must precede the mobile toggle for the sibling guard');
  }
  return problems;
}

function offlineMobileDetailsOverlapMutationsAreRejected(css, shell) {
  const source = String(css);
  const selector = '.offline-page #offlineDetailsPanel.visible ~ #offlineMobileListToggle';
  const swappedShell = String(shell)
    .replace('id="offlineDetailsPanel"', 'id="__offlineDetailsPanel"')
    .replace('id="offlineMobileListToggle"', 'id="offlineDetailsPanel"')
    .replace('id="__offlineDetailsPanel"', 'id="offlineMobileListToggle"');
  const cases = [
    { css: source.replace(selector, '.offline-page #offlineDetailsPanel ~ #offlineMobileListToggle'), shell },
    { css: source.replace(`  ${selector} {\n    display: none;\n  }\n`,
      `  ${selector} {\n    display: flex;\n  }\n`), shell },
    { css: source.replace('@media (max-width: 768px)', '@media (min-width: 769px)'), shell },
    { css: source.replace(`  ${selector} {\n    display: none;\n  }\n`, ''), shell },
    { css: source, shell: swappedShell }
  ];
  return cases.every((fixture) =>
    (fixture.css !== source || fixture.shell !== shell) &&
    offlineMobileDetailsOverlapProblems(fixture.css, fixture.shell).length > 0);
}

function offlineFallbackMarkerProblems(source, shell) {
  const problems = [];
  const render = (String(source).match(/function renderFallbackMap\(record\) \{([\s\S]*?)\n  \}\n\n  function drawFallbackRoute/) || [])[1] || '';
  if (!render) return ['fallback renderer is missing'];
  if (!/svg\.setAttribute\('aria-hidden', 'true'\)/.test(render) ||
      !/svg\.setAttribute\('focusable', 'false'\)/.test(render) ||
      /svg\.setAttribute\('role', 'img'\)/.test(render)) {
    problems.push('fallback SVG is not strictly decorative');
  }
  if (!/svg\.setAttribute\('preserveAspectRatio', 'none'\)/.test(render)) {
    problems.push('fallback SVG coordinate frame does not match the HTML marker overlay');
  }
  if (!/var markerLayer = document\.createElement\('div'\)/.test(render) ||
      !/markerLayer\.className = 'offline-map-fallback__markers'/.test(render) ||
      !/markerLayer\.setAttribute\('role', 'group'\)/.test(render)) {
    problems.push('fallback marker layer lacks valid accessible grouping');
  }
  if (!/var button = document\.createElement\('button'\)/.test(render) ||
      !/button\.type = 'button'/.test(render) ||
      !/button\.className = 'offline-building-marker offline-fallback-marker'/.test(render) ||
      !/button\.setAttribute\('aria-label', 'Open details for ' \+ building\.name\)/.test(render) ||
      !/button\.setAttribute\('aria-pressed', 'false'\)/.test(render) ||
      !/button\.setAttribute\('data-building-key', building\.key\)/.test(render)) {
    problems.push('fallback marker is not a labelled native button with selected state');
  }
  if (!/button\.style\.left = \(point\[0\] \/ 10\) \+ '%'/.test(render) ||
      !/button\.style\.top = \(point\[1\] \/ 7\) \+ '%'/.test(render) ||
      !/markerLayer\.appendChild\(button\)/.test(render)) {
    problems.push('fallback marker is not positioned in the HTML overlay');
  }
  if (!/button\.addEventListener\('click'[\s\S]*openDetails\(building\.key, button\)/.test(render) ||
      /button\.addEventListener\('keydown'/.test(render) ||
      /createElementNS\(svgNamespace, 'g'\)[\s\S]*setAttribute\('role', 'button'\)/.test(render)) {
    problems.push('fallback activation does not rely on native button semantics');
  }
  if (!/<div class="offline-map-fallback" id="offlineMapFallback" role="group" aria-label="Simplified CSPC campus map" hidden><\/div>/.test(String(shell))) {
    problems.push('fallback container lacks its accessible group name');
  }
  return problems;
}

function offlineFallbackMarkerMutationsAreRejected(source, shell) {
  const cases = [
    { source: source.replace("var button = document.createElement('button');", "var button = document.createElement('div');"), shell },
    { source: source.replace('offline-building-marker offline-fallback-marker', 'offline-building-marker'), shell },
    { source: source.replace("svg.setAttribute('aria-hidden', 'true');", "svg.setAttribute('role', 'img');"), shell },
    { source: source.replace("svg.setAttribute('preserveAspectRatio', 'none');", ''), shell },
    { source: source.replace("svg.setAttribute('preserveAspectRatio', 'none');", "svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');"), shell },
    { source: source.replace('markerLayer.appendChild(button);', 'svg.appendChild(button);'), shell },
    { source, shell: shell.replace(' role="group" aria-label="Simplified CSPC campus map"', '') }
  ];
  return cases.every((fixture) =>
    (fixture.source !== source || fixture.shell !== shell) &&
    offlineFallbackMarkerProblems(fixture.source, fixture.shell).length > 0);
}

function offlineFocusReturnBehaviorProblems(source) {
  const problems = [];
  const usableSource = (source.match(/function isUsableFocusReturnTarget\(element\) \{[\s\S]*?\n  \}/) || [])[0] || '';
  const selectSource = (source.match(/function selectFocusReturnTarget\(invoker, fallbackCandidates\) \{[\s\S]*?\n  \}/) || [])[0] || '';
  if (!usableSource || !selectSource) return ['shared focus-return helpers are missing'];

  const sandbox = {
    document: { contains: (element) => element && element.contained !== false },
    window: {
      innerWidth: 390,
      innerHeight: 844,
      getComputedStyle: (element) => element.style
    }
  };
  try {
    const vm = require('vm');
    vm.runInNewContext(`${usableSource}\n${selectSource}\nthis.focusContract = { isUsableFocusReturnTarget, selectFocusReturnTarget };`, sandbox, {
      timeout: 1000
    });
  } catch (error) {
    return ['shared focus-return helpers cannot be evaluated safely'];
  }

  function element(options = {}) {
    const rect = Object.assign({ left: 10, top: 10, right: 54, bottom: 54, width: 44, height: 44 }, options.rect || {});
    return {
      contained: options.contained !== false,
      isConnected: options.connected !== false,
      disabled: options.disabled === true,
      style: Object.assign({ display: 'block', visibility: 'visible' }, options.style || {}),
      focus() {},
      getAttribute(name) { return (options.attributes || {})[name] || null; },
      closest() { return options.hiddenAncestor ? {} : null; },
      getClientRects() { return options.noRects ? [] : [rect]; },
      getBoundingClientRect() { return rect; }
    };
  }

  const visibleInvoker = element();
  const offscreenConnectedListButton = element({
    rect: { left: 12, top: 900, right: 200, bottom: 944, width: 188, height: 44 }
  });
  const visibleMobileToggle = element({
    rect: { left: 16, top: 780, right: 180, bottom: 824, width: 164, height: 44 }
  });
  const hiddenCandidate = element({ hiddenAncestor: true });
  const contract = sandbox.focusContract;
  if (contract.isUsableFocusReturnTarget(offscreenConnectedListButton) !== false) {
    problems.push('connected off-screen list button is accepted');
  }
  if (contract.selectFocusReturnTarget(offscreenConnectedListButton, [hiddenCandidate, visibleMobileToggle]) !== visibleMobileToggle) {
    problems.push('mobile Building List fallback is not selected');
  }
  if (contract.selectFocusReturnTarget(visibleInvoker, [visibleMobileToggle]) !== visibleInvoker) {
    problems.push('visible invoker is not preserved');
  }
  return problems;
}

function offlineInteractionLifecycleProblems(source, shell) {
  const problems = [];
  const detailsCloseBody = (source.match(/function closeDetails\(\) \{([\s\S]*?)\n  \}\n\n  function highlightSelection/) || [])[1] || '';
  const closeBody = (source.match(/function closeRouteSummary\(\) \{([\s\S]*?)\n  \}\n\n  function clearRoute/) || [])[1] || '';
  const setDestinationBody = (source.match(/function setDestination\(key\) \{([\s\S]*?)\n  \}\n\n  function clearDestination/) || [])[1] || '';
  const mobileSidebarBody = (source.match(/function setMobileSidebar\(open, options\) \{([\s\S]*?)\n  \}\n\n  function syncMobileSidebarViewport/) || [])[1] || '';
  if (!/var routeSummaryInvoker = null;/.test(source)) problems.push('missing invoker state');
  if (!/function rememberRouteSummaryInvoker\(\)[\s\S]*summary\.contains\(active\)[\s\S]*document\.activeElement/.test(source)) {
    problems.push('missing invoker capture');
  }
  if (!/function isUsableFocusReturnTarget\(element\)[\s\S]*document\.contains\(element\)[\s\S]*closest\('\[hidden\], \[aria-hidden="true"\], \[inert\]'\)[\s\S]*getClientRects\(\)[\s\S]*getBoundingClientRect\(\)[\s\S]*window\.innerWidth[\s\S]*window\.innerHeight/.test(source)) {
    problems.push('return target is not visibility-checked');
  }
  problems.push(...offlineFocusReturnBehaviorProblems(source));
  if (!/function routeSummaryFocusables\(\)[\s\S]*querySelectorAll\([\s\S]*a\[href\], button, input, select, textarea, \[tabindex\][\s\S]*aria-disabled[\s\S]*tabindex/.test(source)) {
    problems.push('missing focusable filter');
  }
  if (!/rememberRouteSummaryInvoker\(\);[\s\S]*destinationKey = key/.test(setDestinationBody)) {
    problems.push('Set as Destination does not capture before closing details');
  }
  if (!/findRoute\.addEventListener\('click'[\s\S]*rememberRouteSummaryInvoker\(\);[\s\S]*showRoute\(destinationKey\)/.test(source)) {
    problems.push('Find Route does not capture its invoker');
  }
  if (!/var invoker = lastInvoker;[\s\S]*lastInvoker = null;[\s\S]*selectFocusReturnTarget\(invoker, \[[\s\S]*buildingListButtonForKey\(selectedKey\)[\s\S]*offlineBuildingSearch[\s\S]*offlineMobileListToggle[\s\S]*offlineRecenterMap/.test(detailsCloseBody)) {
    problems.push('details close does not restore by the required visible fallback order');
  }
  if (!/var wasOpen =[\s\S]*routeSummaryInvoker = null;[\s\S]*selectFocusReturnTarget\(invoker, \[[\s\S]*offlineRouteFind[\s\S]*buildingListButtonForKey\(destinationKey\)[\s\S]*offlineBuildingSearch[\s\S]*offlineMobileListToggle/.test(closeBody)) {
    problems.push('close does not restore by the required fallback order');
  }
  if (/setData\(|drawFallbackRoute\(/.test(closeBody)) problems.push('close clears the rendered route');
  if (!/routeSummary\.addEventListener\('click'[\s\S]*event\.target === routeSummary[\s\S]*closeRouteSummary\(\)/.test(source)) {
    problems.push('backdrop does not share the close lifecycle');
  }
  if (!/routeSummary\.addEventListener\('keydown'[\s\S]*event\.key === 'Escape'[\s\S]*stopPropagation\(\)[\s\S]*preventDefault\(\)[\s\S]*closeRouteSummary\(\)[\s\S]*event\.key !== 'Tab'[\s\S]*event\.shiftKey[\s\S]*!routeSummary\.contains\(active\)/.test(source)) {
    problems.push('missing Escape or Tab containment');
  }
  if (!/<aside class="map-sidebar offline-sidebar" id="offlineMapSidebar" aria-hidden="true" inert>/.test(shell)) {
    problems.push('mobile sheet is not fail-closed before script initialization');
  }
  if (!/var mobile = isMobileMapLayout\(\);[\s\S]*var shouldOpen = mobile && !!open/.test(mobileSidebarBody) ||
      !/if \(!mobile\)[\s\S]*removeAttribute\('inert'\)[\s\S]*removeAttribute\('aria-hidden'\)/.test(mobileSidebarBody)) {
    problems.push('desktop sidebar availability is not restored');
  }
  if (!/if \(shouldOpen\)[\s\S]*removeAttribute\('inert'\)[\s\S]*setAttribute\('aria-hidden', 'false'\)[\s\S]*focusMobileSidebarSearch\(\)/.test(mobileSidebarBody)) {
    problems.push('opening the mobile sheet does not expose and focus it');
  }
  if (!/selectFocusReturnTarget\(toggle, \[[\s\S]*offlineRecenterMap[\s\S]*offlineThemeToggle[\s\S]*offlineNavToggle[\s\S]*focusTarget\.focus\(\)[\s\S]*setAttribute\('inert', ''\)[\s\S]*setAttribute\('aria-hidden', 'true'\)/.test(mobileSidebarBody)) {
    problems.push('closing the mobile sheet does not restore focus before isolation');
  }
  if (!/matchMedia\(MOBILE_MAP_MEDIA\)[\s\S]*syncMobileSidebarViewport\(mobileSidebarMedia\)[\s\S]*(?:addEventListener\('change'|addListener\()/.test(source) ||
      !/offlineMobileListToggle'[\s\S]*setMobileSidebar\(true, \{ focus: true \}\)[\s\S]*offlineSidebarClose[\s\S]*setMobileSidebar\(false, \{ restoreFocus: true \}\)/.test(source) ||
      !/sidebar && sidebar\.classList\.contains\('is-open'\)[\s\S]*setMobileSidebar\(false, \{ restoreFocus: true \}\)/.test(source)) {
    problems.push('mobile sheet controls, Escape, or viewport lifecycle is incomplete');
  }
  if (!/var THEME_STORAGE_KEY = 'campussphere-theme';/.test(source) ||
      !/function readThemePreference\(\)[\s\S]*try[\s\S]*localStorage\.getItem\(THEME_STORAGE_KEY\)[\s\S]*stored === 'dark' \|\| stored === 'light'[\s\S]*catch/.test(source) ||
      !/function persistThemePreference\(value\)[\s\S]*try[\s\S]*localStorage\.setItem\(THEME_STORAGE_KEY, value\)[\s\S]*catch/.test(source) ||
      !/function applyThemePreference\(value, persist\)[\s\S]*persistThemePreference[\s\S]*updateThemeToggleState\(\)/.test(source) ||
      !/preferredTheme = readThemePreference\(\)[\s\S]*applyThemePreference\(preferredTheme, false\)[\s\S]*theme\.addEventListener\('click'[\s\S]*applyThemePreference\(dark \? 'light' : 'dark', true\)/.test(source) ||
      !/function updateThemeToggleState\(\)[\s\S]*aria-pressed[\s\S]*Switch to light mode[\s\S]*Switch to dark mode/.test(source)) {
    problems.push('theme preference or accessible toggle state is not synchronized');
  }
  if (!/<button class="theme-toggle" id="offlineThemeToggle"[^>]*aria-label="Switch to dark mode"[^>]*aria-pressed="false"/.test(shell)) {
    problems.push('theme toggle lacks an initial accessible state');
  }
  return problems;
}

function offlineInteractionMutationsAreRejected(source, shell) {
  const cases = [
    { source: source.replace('    rememberRouteSummaryInvoker();\n    destinationKey = key;', '    destinationKey = key;'), shell },
    { source: source.replace("    if (element.closest('[hidden], [aria-hidden=\"true\"], [inert]')) return false;", ''), shell },
    { source: source.replace('    if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= window.innerWidth || rect.top >= window.innerHeight) return false;', ''), shell },
    { source: source.replace("        if (event.key !== 'Tab') return;", '        return;'), shell },
    { source: source.replace('    routeSummaryInvoker = null;\n    var target = selectFocusReturnTarget(invoker, [', "    routeSummaryInvoker = null;\n    map.getSource('offline-route').setData({});\n    var target = selectFocusReturnTarget(invoker, ["), shell },
    { source: source.replace("      byId('offlineMobileListToggle'),\n      byId('offlineRecenterMap')", "      byId('offlineRecenterMap')"), shell },
    { source: source.replace("    theme.setAttribute('aria-pressed', dark ? 'true' : 'false');", ''), shell },
    { source: source.replace("  var THEME_STORAGE_KEY = 'campussphere-theme';", "  var THEME_STORAGE_KEY = 'offline-theme';"), shell },
    { source: source.replace('window.localStorage.getItem(THEME_STORAGE_KEY)', "window.localStorage.getItem('wrong-key')"), shell },
    { source: source.replace('window.localStorage.setItem(THEME_STORAGE_KEY, value)', "window.localStorage.setItem('wrong-key', value)"), shell },
    { source: source.replace("    sidebar.setAttribute('inert', '');", ''), shell },
    { source: source.replace('      focusTarget.focus();', ''), shell },
    { source: source.replace("      byId('offlineRecenterMap'),", ''), shell },
    { source: source.replace('      if (options.focus !== false) focusMobileSidebarSearch();', ''), shell },
    {
      source: source
        .replace("mobileSidebarMedia.addEventListener('change', syncMobileSidebarViewport);", '')
        .replace('mobileSidebarMedia.addListener(syncMobileSidebarViewport);', ''),
      shell
    },
    { source, shell: shell.replace(' aria-hidden="true" inert', '') },
    { source, shell: shell.replace(' aria-pressed="false"', '') }
  ];
  return cases.every((fixture) =>
    (fixture.source !== source || fixture.shell !== shell) &&
    offlineInteractionLifecycleProblems(fixture.source, fixture.shell).length > 0);
}

/* ---------------- static PWA privacy analysis (no server) ---------------- */
function runPwaPrivacyGate() {
  const rec = makeRecorder('pwa');
  const { ok } = rec;
  const sw = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');
  const offlineManager = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'offline-guide-manager.js'), 'utf8');
  const offlineShell = fs.readFileSync(path.join(__dirname, '..', 'public', 'offline.html'), 'utf8');
  const offlineCss = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'offline.css'), 'utf8');

  // Forbidden (never intercepted/cached) prefixes for authenticated surfaces.
  for (const p of ['/auth', '/login', '/register', '/logout', '/admin', '/api/update-profile']) {
    ok(`sw.js forbids ${p}`, sw.includes(`'${p}'`));
  }
  // Precache must contain NO authenticated/personalized HTML pages.
  const precache = (sw.match(/PRECACHE_URLS\s*=\s*\[([\s\S]*?)\]/) || [])[1] || '';
  ok('sw.js precache has no /dashboard', !/['"]\/dashboard/.test(precache));
  ok('sw.js precache has no /admin', !/['"]\/admin/.test(precache));
  ok('sw.js precache has no /profile', !/['"]\/profile/.test(precache));
  ok('sw.js precache has no bare HTML page route', !/['"]\/(?:home|map|buildings|events|vr|about)['"]/.test(precache));
  // Navigations are network-only; no personalized page cache exists. (Check the
  // navigation strategy fetches the network and that NO page-cache variable is
  // declared / no pageStrategy function exists — not the doc comment that names
  // PAGE_CACHE to record its removal.)
  ok('sw.js navigations are network-only (no page cache)',
    /function navigationFallbackStrategy[\s\S]*?fetch\(event\.request\)/.test(sw)
    && !/\bvar\s+PAGE_CACHE\s*=/.test(sw)
    && !/function\s+pageStrategy/.test(sw));
  /* Consent-boundary correction: there is NO approved-API list any more,
     because no API response is cached at all. /api/buildings and /api/routes*
     returned building rows carrying Cloudinary image URLs and local
     building-photo references, so caching them retained media the user never
     consented to download. The explicit /api/offline-guide download into
     IndexedDB is the only owner of offline campus data.

     Scanned on CODE (comments stripped) so the prose recording the removal
     cannot satisfy — or falsely break — these contracts. */
  const swCode = sw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok('sw.js caches no API response at all (no classifier, strategy, or cache constants)',
    !/function isApprovedApi/.test(sw) && !/function apiStrategy/.test(sw) &&
    !/API_CACHE/.test(swCode) && !/API_MAX/.test(swCode) &&
    sw.includes("'/api/offline-guide'"));
  /* Mirrors the OFF.2 probe's exact guard: EXACTLY ONE '/api' network-only
     prefix, the complete classifier truth table evaluated behaviourally in an
     isolated vm, CURRENT_CACHES tokenizing to exactly [SHELL_CACHE,
     STATIC_CACHE], and the guard running before every remaining same-origin
     strategy. Fails closed on any extraction or evaluation error. */
  ok('sw.js treats the ENTIRE /api surface as network-only with the exact classifier behaviour and exactly two caches',
    (() => {
      try {
        const fnMatch = sw.match(/function isNetworkOnlyPath[\s\S]*?\n}/);
        const listMatch = swCode.match(/NETWORK_ONLY_PREFIXES\s*=\s*\[([\s\S]*?)\]/);
        const fetchListener = (sw.match(/addEventListener\('fetch'[\s\S]*$/) || [''])[0];
        if (!fnMatch || !listMatch || fetchListener === '') return false;
        const prefixes = (listMatch[1].match(/'([^']*)'/g) || []).map((s) => s.slice(1, -1));
        if (prefixes.length !== 1 || prefixes[0] !== '/api') return false;
        const vm = require('vm');
        const box = Object.create(null);
        vm.createContext(box);
        vm.runInContext('var NETWORK_ONLY_PREFIXES = ' + JSON.stringify(prefixes) + ';\n' +
          fnMatch[0] + '\n__f = isNetworkOnlyPath;', box, { timeout: 1000 });
        const f = box.__f;
        if (typeof f !== 'function') return false;
        const yes = ['/api', '/api/buildings', '/api/routes', '/api/routes/1',
          '/api/vr/routes/1', '/api/search', '/api/pathfind'];
        const no = ['/apiary', '/apis', '/auth', '/map', '/'];
        if (!yes.every((p) => f(p) === true) || !no.every((p) => f(p) === false)) return false;
        const cc = swCode.match(/CURRENT_CACHES\s*=\s*\[([^\]]*)\]/);
        if (!cc) return false;
        const tok = cc[1].split(',').map((t) => t.trim()).filter(Boolean);
        if (tok.length !== 2 || tok[0] !== 'SHELL_CACHE' || tok[1] !== 'STATIC_CACHE') return false;
        const guard = fetchListener.search(/isNetworkOnlyPath\(\s*url\.pathname\s*\)/);
        const strategies = ['navigationFallbackStrategy(', 'staticStrategy(']
          .map((n) => fetchListener.indexOf(n));
        return guard !== -1 && strategies.every((i) => i !== -1) && strategies.every((i) => guard < i);
      } catch (e) { return false; }
    })());
  ok('sw.js never intercepts admin APIs and retains no API cache/classifier/strategy machinery',
    /FORBIDDEN_PREFIXES/.test(sw) && /'\/admin'/.test(swCode) &&
    !/respondWith\([^)]*apiStrategy/.test(swCode) &&
    !/function isApprovedApi/.test(sw) && !/function apiStrategy/.test(sw) &&
    !/API_CACHE/.test(swCode) && !/API_MAX/.test(swCode));
  // VR media is never mirrored.
  ok('sw.js never caches /img/vr/ media', /\/img\/vr\//.test(sw));
  /* 2D-only correction. This supersedes the Milestone 10.4 bounded-Cloudinary
     cache AND the 11.8 bounded OSM tile cache: NO cross-origin request is cache
     eligible any more, and the machinery that made it possible is removed
     rather than disabled. Online delivery is unchanged — an unhandled request
     stays on the browser's normal network path, and CSP still permits OSM,
     Cloudinary and the Iconify data API (asserted separately below). */
  ok('sw.js declares no approved cross-origin host (Cloudinary and OSM are never cached)',
    !/function isApprovedExternalHost/.test(sw) && !/function externalStrategy/.test(sw));
  ok('sw.js removed the external cache constants rather than leaving them dormant',
    !/EXTERNAL_CACHE/.test(sw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')) &&
    !/EXTERNAL_MAX/.test(sw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')) &&
    /trimCache\s*\(/.test(sw));
  {
    // No CDN can be SW-intercepted at all now, so the old jsdelivr-specific
    // carve-out is subsumed: the cross-origin branch must return bare.
    const fetchListener = (sw.match(/addEventListener\('fetch'[\s\S]*$/) || [''])[0];
    const crossOriginBranch = fetchListener.slice(
      fetchListener.indexOf('url.origin !== self.location.origin'),
      fetchListener.indexOf('isForbiddenPath')
    );
    ok('sw.js leaves EVERY cross-origin host to the network (no jsdelivr, CDN, or tile interception)',
      crossOriginBranch !== '' && !/respondWith/.test(crossOriginBranch) && /return;/.test(crossOriginBranch));
    const ver = (sw.match(/CACHE_VERSION\s*=\s*'v(\d+)'/) || [])[1];
    ok('sw.js is v32 and the offline origin marker label plus marker scale, dialogs, sheet, and fallback markers preserve state, isolate hidden focus, persist theme, and enforce exact touch targets',
      Number(ver) === 32 &&
      /var OFFLINE_ORIGIN_MARKER_LABEL = 'Guard House';/.test(offlineManager) &&
      /originEl\.textContent = OFFLINE_ORIGIN_MARKER_LABEL;/.test(offlineManager) &&
      /originEl\.setAttribute\('aria-label', OFFLINE_ORIGIN_MARKER_LABEL\);/.test(offlineManager) &&
      !/originEl\.textContent = 'Main Gate'/.test(offlineManager) &&
      /var OFFLINE_BUILDING_PIN_SCALE = 0\.7;/.test(offlineManager) &&
      /var OFFLINE_BUILDING_PIN_OFFSET = \[0, -14 \* OFFLINE_BUILDING_PIN_SCALE\];/.test(offlineManager) &&
      /new maplibregl\.Marker\(\{\s*scale: OFFLINE_BUILDING_PIN_SCALE,\s*offset: OFFLINE_BUILDING_PIN_OFFSET\s*\}\)/.test(offlineManager) &&
      /\.offline-fallback-marker\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/.test(offlineCss) &&
      /\.offline-fallback-marker::before\s*\{[\s\S]*?width:\s*12px;[\s\S]*?height:\s*12px;[\s\S]*?border:\s*3px solid #fff;/.test(offlineCss) &&
      offlineInteractionLifecycleProblems(offlineManager, offlineShell).length === 0 &&
      offlineInteractionMutationsAreRejected(offlineManager, offlineShell) &&
      offlineTouchTargetProblems(offlineCss).length === 0 && offlineTouchTargetMutationsAreRejected(offlineCss) &&
      offlineMobileDetailsOverlapProblems(offlineCss, offlineShell).length === 0 &&
      offlineMobileDetailsOverlapMutationsAreRejected(offlineCss, offlineShell) &&
      offlineFallbackMarkerProblems(offlineManager, offlineShell).length === 0 &&
      offlineFallbackMarkerMutationsAreRejected(offlineManager, offlineShell));
    /* Same-origin eligibility is now an EXACT allowlist derived from the
       reviewed PRECACHE_URLS and matched on pathname + query, replacing the
       extension-wide rule that silently admitted local building photos. */
    const shellFn = (sw.match(/function isExactShellAsset[\s\S]*?\n}/) || [''])[0];
    ok('sw.js gates same-origin caching on an exact shell allowlist derived from PRECACHE_URLS',
      shellFn !== '' && /SHELL_ASSET_SET\[pathWithQuery\] === true/.test(shellFn) &&
      /SHELL_ASSET_SET[\s\S]{0,400}PRECACHE_URLS/.test(sw));
    ok('sw.js no longer classifies same-origin assets by file extension',
      !/function isCacheableStatic/.test(sw) &&
      /isExactShellAsset\(url\.pathname \+ url\.search\)/.test(sw));
  }

  return rec.failures;
}

/* ---------------- static PWA app-capable meta hygiene (no server) ---------------- */
function runPwaMetaGate() {
  const rec = makeRecorder('pwa-meta');
  const { ok } = rec;
  const root = path.join(__dirname, '..');
  const offenders = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) walk(p);
      else if (name.endsWith('.ejs')) {
        const src = fs.readFileSync(p, 'utf8');
        if (src.includes('apple-mobile-web-app-capable') && !src.includes('mobile-web-app-capable')) {
          offenders.push(path.relative(root, p).replace(/\\/g, '/'));
        }
      }
    }
  };
  walk(path.join(root, 'views'));
  ok('views with apple-mobile-web-app-capable also include mobile-web-app-capable', offenders.length === 0);
  return rec.failures;
}

/* ---------------- static media URL policy gate (no server) ---------------- */
function runMediaUrlPolicyGate() {
  const rec = makeRecorder('media-url');
  const { ok } = rec;
  const { normalizeMediaUrl, isSafeMediaUrl } = require('../utils/mediaUrl');
  const accept = [
    '/img/Camarines-sur-polytechnic-colleges.png',
    '/img/vr/main-gate.jpg',
    'https://res.cloudinary.com/demo/image/upload/sample.jpg',
  ];
  const reject = [
    'http://res.cloudinary.com/demo/image/upload/sample.jpg',
    'https://example.com/sample.jpg',
    '//res.cloudinary.com/demo/image/upload/sample.jpg',
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    'https://res.cloudinary.com.evil.com/x.jpg',            // look-alike host
    'https://user@res.cloudinary.com/x.jpg',                // userinfo trick
    'https://res.cloudinary.com:443/demo/image/upload/sample.jpg', // explicit default port
    'https://res.cloudinary.com:444/demo/image/upload/sample.jpg', // explicit non-default port
    '/img/../admin/secret.png',                             // traversal
  ];
  for (const u of accept) ok(`accept ${u}`, isSafeMediaUrl(u) && normalizeMediaUrl(u) === u);
  for (const u of reject) ok(`reject ${u}`, !isSafeMediaUrl(u) && normalizeMediaUrl(u) === null);
  return rec.failures;
}

/* ---------------- static CSP media policy gate (no server) ---------------- */
function runCspMediaPolicyGate() {
  const rec = makeRecorder('csp');
  const { ok } = rec;
  const src = fs.readFileSync(path.join(__dirname, '..', 'middleware', 'securityHeaders.js'), 'utf8');
  const directive = (name) => {
    const m = src.match(new RegExp('\\b' + name + '\\s*:\\s*\\[([^\\]]*)\\]'));
    return m ? m[1] : '';
  };
  const scriptSrc = directive('scriptSrc');
  const imgSrc = directive('imgSrc');
  const mediaSrc = directive('mediaSrc');
  const connectSrc = directive('connectSrc');
  const CLD = /res\.cloudinary\.com/;
  ok('CSP scriptSrc excludes res.cloudinary.com', scriptSrc !== '' && !CLD.test(scriptSrc));
  ok('CSP imgSrc includes res.cloudinary.com', CLD.test(imgSrc));
  ok('CSP mediaSrc includes res.cloudinary.com', CLD.test(mediaSrc));
  // 10.8 pre-gate: Pannellum XHR-fetches the panorama JPG, so connect-src MUST
  // carry the Cloudinary delivery host (verified live: without it the browser
  // blocks the request with a connect-src violation). Media-only remains the
  // rule — script-src must still exclude Cloudinary (asserted above).
  ok('CSP connectSrc includes res.cloudinary.com', CLD.test(connectSrc));
  ok('CSP scriptSrc keeps no unsafe-inline/unsafe-eval', !/'unsafe-inline'|'unsafe-eval'/.test(scriptSrc));
  return rec.failures;
}

/* ---------------- static Leaflet vendor gate (no server) ---------------- */
// Narrow post-11.8B cleanup: Leaflet JS is self-hosted (exact 1.9.4 dist with
// only the trailing sourceMappingURL comment removed) so DevTools never
// requests the CDN source map that connect-src correctly blocks. The fix must
// never be re-done by widening connect-src to unpkg.com.
function runLeafletVendorGate() {
  const rec = makeRecorder('leaflet-vendor');
  const { ok } = rec;
  const root = path.join(__dirname, '..');
  const CDN_LEAFLET_JS = /unpkg\.com\/leaflet@[^"']*\/leaflet\.js\b/;
  for (const view of ['views/map.ejs', 'views/home.ejs', 'views/dashboard.ejs']) {
    const src = fs.readFileSync(path.join(root, view), 'utf8');
    ok(view + ' no longer loads CDN Leaflet JS', !CDN_LEAFLET_JS.test(src));
    ok(view + ' loads /vendor/leaflet/leaflet.js', src.includes('/vendor/leaflet/leaflet.js'));
  }
  const vendorPath = path.join(root, 'public', 'vendor', 'leaflet', 'leaflet.js');
  const vendorExists = fs.existsSync(vendorPath);
  ok('public/vendor/leaflet/leaflet.js exists', vendorExists);
  if (vendorExists) {
    const vendor = fs.readFileSync(vendorPath, 'utf8');
    ok('vendored Leaflet keeps the @preserve license header', vendor.startsWith('/* @preserve'));
    ok('vendored Leaflet contains no sourceMappingURL', !/sourceMappingURL/.test(vendor));
  }
  const csp = fs.readFileSync(path.join(root, 'middleware', 'securityHeaders.js'), 'utf8');
  const connectMatch = csp.match(/\bconnectSrc\s*:\s*\[([^\]]*)\]/);
  ok('CSP connectSrc still excludes unpkg.com', !!connectMatch && !/unpkg\.com/.test(connectMatch[1]));
  return rec.failures;
}

/* =============================================================================
   M12.P1-R6 — self-hosted browser dependencies (in-suite static + HTTP gate)
   =============================================================================
   Proves that every browser vendor library is served from THIS origin, at the
   exact reviewed version, with a license notice and a byte-exact provenance
   record — and that no executable remote script or stylesheet survives outside
   the single documented Google Fonts exception.

   Every structural assertion runs through the REAL analyzers exported by
   scripts/selfHostedBrowserDependencies-probe.js, so the negative fixtures at
   the end drive the same code path the live assertions use. A mutation that
   downgrades a version, corrupts a hash, drops a license, removes a view's
   vendor reference, re-widens the CSP, registers the standalone probe inside
   npm test, or loosens the approved-origin allowlist is caught here.

   IMPORTANT (learned from the R5 red run): every scan is a CODE SHAPE — a real
   `src=`/`href=` attribute value or a real `@import url(...)` — never a bare
   substring search. These files legitimately DOCUMENT which CDN origins were
   removed, and prose naming `unpkg.com` or `lucide@latest` must never be able
   to fail the contract it describes. The analyzer strips HTML and EJS comments
   before extracting anything. */

const R6_PROBE_SCRIPT = 'selfHostedBrowserDependencies-probe.js';

/* Dedicated, unshared port for this gate's HTTP leg (npm test uses 3371/3372,
   R5 uses 3381/3382, the standalone R6 probe uses 3383/3384). */
const R6_HTTP_PORT = 3373;

/* Standalone M12.P1 readiness probes R1-R6. None may be spawned by npm test:
   their totals are reported separately and must never inflate the suite total. */
const R6_STANDALONE_PROBES = Object.freeze([
  'pilotCredentialSafety-probe.js',         // R1
  'vercelProductionProfile-probe.js',       // R2
  'vercelRuntimeSessionBootstrap-probe.js', // R3
  'sharedRateLimit-probe.js',               // R4
  'boundedAnonymousAccessDenial-probe.js',  // R5
  R6_PROBE_SCRIPT,                          // R6
]);

/* Each affected view and the EXACT same-origin vendor assets it must load. */
const R6_VIEW_EXPECTATIONS = Object.freeze([
  ['views/admin/index.ejs', ['/vendor/lucide/lucide.min.js']],
  ['views/admin/faqs.ejs', ['/vendor/lucide/lucide.min.js']],
  ['views/admin/logs.ejs', ['/vendor/lucide/lucide.min.js']],
  ['views/admin/news.ejs', ['/vendor/lucide/lucide.min.js']],
  ['views/admin/settings.ejs', ['/vendor/lucide/lucide.min.js']],
  ['views/admin/users.ejs', ['/vendor/lucide/lucide.min.js']],
  ['views/admin/vr.ejs', ['/vendor/lucide/lucide.min.js']],
  ['views/admin/campus-map.ejs', ['/vendor/lucide/lucide.min.js', '/vendor/leaflet/leaflet.js', '/vendor/leaflet/leaflet.css']],
  ['views/about.ejs', ['/vendor/iconify-icon/iconify-icon.min.js']],
  ['views/dashboard.ejs', ['/vendor/iconify-icon/iconify-icon.min.js', '/vendor/leaflet/leaflet.js', '/vendor/leaflet/leaflet.css']],
  ['views/events.ejs', ['/vendor/iconify-icon/iconify-icon.min.js']],
  ['views/home.ejs', ['/vendor/iconify-icon/iconify-icon.min.js', '/vendor/leaflet/leaflet.js', '/vendor/leaflet/leaflet.css']],
  ['views/map.ejs', ['/vendor/leaflet/leaflet.js', '/vendor/leaflet/leaflet.css', '/vendor/maplibre/maplibre-gl.js', '/vendor/maplibre/maplibre-gl.css']],
  ['views/vr.ejs', ['/vendor/pannellum/pannellum.js', '/vendor/pannellum/pannellum.css']],
  ['views/vr-route.ejs', ['/vendor/pannellum/pannellum.js', '/vendor/pannellum/pannellum.css']],
]);

/* Reviewed package-manifest bytes after the July 26 dependency-security
   remediation.  The package manifest pins EJS 6.0.1 and the lockfile removes
   the vulnerable jake/filelist/minimatch/brace-expansion production chain. */
const REVIEWED_PACKAGE_JSON_SHA256 = '7bd8e67c000e7ef35677a0919be122ff5708f0b7a5f15cbb903ddc65b9733548';
const REVIEWED_PACKAGE_LOCK_SHA256 = '59a77a5601af97692bd79b92bd3d268fe547dcaa513b775bab6fd27fb4a5a437';

/** PURE: do the manifest's recorded versions equal the expected pinned set? */
function r6VersionsMatch(versions, expected) {
  const v = versions && typeof versions === 'object' ? versions : {};
  const e = expected && typeof expected === 'object' ? expected : {};
  const names = Object.keys(e);
  if (names.length === 0) return false;
  return names.every((n) => v[n] === e[n]);
}

/**
 * PURE-ish: verify each recorded file exists on disk with its recorded SHA-256.
 * Filesystem read only; no network, no mutation.
 *
 * @param {object[]} files manifest file entries
 * @param {string} publicRoot absolute path of the public/ directory
 * @returns {{total: number, verified: number, missing: string[], mismatched: string[]}}
 */
function r6VerifyFilesOnDisk(files, publicRoot) {
  const crypto = require('crypto');
  const list = Array.isArray(files) ? files : [];
  const missing = [];
  const mismatched = [];
  let verified = 0;
  for (const f of list) {
    const dest = f && typeof f.destination === 'string' ? f.destination : '';
    const abs = path.join(publicRoot, dest.replace(/^\/+/, ''));
    if (!fs.existsSync(abs)) { missing.push(dest); continue; }
    const actual = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
    if (actual === f.sha256) verified += 1; else mismatched.push(dest);
  }
  return { total: list.length, verified, missing, mismatched };
}

/**
 * PURE: locate UNGUARDED lucide.createIcons invocations, as a CODE SHAPE.
 *
 * These files legitimately DOCUMENT the guard they implement — the helper
 * headers in admin-news.js / admin-users.js explain that every call site used
 * to invoke `lucide.createIcons()` directly. A bare pattern scan therefore
 * failed the very files that had been fixed (the same class of defect disclosed
 * during R5, where prose describing a guarantee tripped its own gate).
 *
 * A comment-stripping lexer is deliberately NOT used: this repository contains
 * regex literals holding an odd number of quote characters, which flip a
 * non-parsing lexer into a string state. Instead a line is treated as
 * commentary only when it STARTS a comment (`//`, `/*`, or a `*` continuation).
 * That cannot hide a real invocation — a statement never begins with `//` — so
 * it removes false positives without creating a false negative.
 *
 * @param {string} source file text (HTML/EJS comments already stripped)
 * @returns {number[]} 1-indexed lines carrying an unguarded invocation
 */
function r6FindUnguardedCreateIcons(source) {
  const GUARD = /typeof\s+window\.lucide\.createIcons\s*===\s*'function'/;
  const CALL = /\blucide\s*\.\s*createIcons\s*\(/;
  const isCommentary = (line) => /^\s*(\/\/|\/\*|\*)/.test(line);
  const lines = String(source == null ? '' : source).split(/\r?\n/);
  const out = [];
  lines.forEach((line, i) => {
    if (isCommentary(line)) return;
    if (!CALL.test(line)) return;
    const guardedHere = GUARD.test(line);
    let guardedAbove = false;
    for (let k = i - 1; k >= 0 && k >= i - 2; k--) {
      if (isCommentary(lines[k])) continue;
      guardedAbove = GUARD.test(lines[k]);
      break;
    }
    if (!guardedHere && !guardedAbove) out.push(i + 1);
  });
  return out;
}

/**
 * PURE: every non-data url() inside a stylesheet must resolve to a file that
 * exists next to it. Proves Leaflet's images/ siblings and Pannellum's inlined
 * data: URIs both keep valid relative paths.
 *
 * @param {string} cssSource stylesheet text
 * @param {string} cssDir absolute directory holding the stylesheet
 * @returns {{relative: string[], unresolved: string[]}}
 */
function r6ResolveCssAssetPaths(cssSource, cssDir) {
  const relative = [];
  const unresolved = [];
  const re = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  for (let m = re.exec(String(cssSource == null ? '' : cssSource)); m; m = re.exec(String(cssSource))) {
    const raw = m[1].trim();
    if (/^(data:|https?:|\/\/|#)/i.test(raw)) continue; // inline/absolute/VML
    relative.push(raw);
    const abs = path.join(cssDir, raw.split('?')[0].split('#')[0]);
    if (!fs.existsSync(abs)) unresolved.push(raw);
  }
  return { relative, unresolved };
}

async function runSelfHostedVendorGate() {
  const rec = makeRecorder('self-hosted-vendor');
  const { ok } = rec;
  const crypto = require('crypto');
  const root = path.join(__dirname, '..');
  const publicRoot = path.join(root, 'public');
  const readIf = (rel) => { const p = path.join(root, rel); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; };

  // The REAL analyzers — the standalone probe and this gate share one code path.
  const R6 = require('./' + R6_PROBE_SCRIPT);

  /* ---- 1. manifest provenance, versions, licenses, hashes ---- */
  const manifestRaw = readIf(path.join('public', 'vendor', 'manifest.json'));
  ok('public/vendor/manifest.json exists', manifestRaw !== '');
  let manifest = null;
  try { manifest = JSON.parse(manifestRaw); } catch (e) { manifest = null; }
  ok('public/vendor/manifest.json parses as JSON', manifest !== null);

  const analysis = R6.analyzeVendorManifest(manifest);
  ok('the vendor manifest passes fail-closed structural validation', analysis.ok === true);
  if (!analysis.ok) analysis.problems.forEach((p) => console.error('    - manifest: ' + p));

  ok('the manifest pins EXACTLY the six reviewed package versions',
    r6VersionsMatch(analysis.versions, R6.EXPECTED_PACKAGES) &&
    Object.keys(analysis.versions).length === Object.keys(R6.EXPECTED_PACKAGES).length);

  /* EXACT reviewed provenance, not shape-only. The manifest must reproduce
     EXPECTED_VENDOR_INVENTORY (name/version/license/tarball/sha512/globalInterface/
     source/destination/bytes/sha256/transformations) — the record verified
     against official npm metadata and the exact official tarballs, living in
     probe code OUTSIDE the manifest. This replaces the former assertion that
     merely checked a registry URL prefix and a sha512- prefix, which a
     coordinated data swap could satisfy. */
  {
    const invMismatch = R6.compareManifestToInventory(manifest);
    ok('the manifest matches the independently pinned reviewed inventory EXACTLY',
      invMismatch.length === 0);
    if (invMismatch.length) invMismatch.forEach((m) => console.error('    - inventory: ' + m));
    ok('the independently pinned inventory records exactly 20 files across 6 packages',
      R6.EXPECTED_VENDOR_INVENTORY.length === 6 &&
      R6.flattenExpectedInventory().length === R6.EXPECTED_VENDOR_FILE_TOTAL &&
      R6.EXPECTED_VENDOR_FILE_TOTAL === 20);
  }

  /* Disk verification against BOTH the manifest AND the independently pinned
     SHA-256, so changing vendor bytes and the manifest hash together still
     fails (the pinned inventory hash would not match the new disk bytes). */
  const disk = r6VerifyFilesOnDisk(analysis.files, publicRoot);
  ok('every manifest file exists on disk', disk.missing.length === 0 && disk.total > 0);
  ok('every shipped file matches its recorded SHA-256',
    disk.mismatched.length === 0 && disk.verified === disk.total && disk.total > 0);
  const invDisk = r6VerifyFilesOnDisk(R6.flattenExpectedInventory(), publicRoot);
  ok('every shipped file matches the INDEPENDENTLY PINNED SHA-256 on disk',
    invDisk.missing.length === 0 && invDisk.mismatched.length === 0 &&
    invDisk.verified === R6.EXPECTED_VENDOR_FILE_TOTAL && invDisk.total === R6.EXPECTED_VENDOR_FILE_TOTAL);

  const licensedPackages = new Set(analysis.files
    .filter((f) => /^(LICENSE|LICENSE\.txt|COPYING|license\.txt)$/i.test(path.basename(f.destination)))
    .map((f) => f.pkg));
  ok('every self-hosted package ships its license notice',
    Object.keys(R6.EXPECTED_PACKAGES).every((p) => licensedPackages.has(p)));

  /* ---- 2. the preserved Leaflet JS bytes + its documented transformation ---- */
  {
    const leafletEntry = analysis.files.find((f) => f.destination === '/vendor/leaflet/leaflet.js');
    ok('the manifest records the preserved Leaflet JavaScript', !!leafletEntry);
    const leafletPath = path.join(publicRoot, 'vendor', 'leaflet', 'leaflet.js');
    const exists = fs.existsSync(leafletPath);
    ok('public/vendor/leaflet/leaflet.js still exists', exists);
    if (exists && leafletEntry) {
      const bytes = fs.readFileSync(leafletPath);
      ok('the preserved Leaflet bytes still hash to the recorded SHA-256',
        crypto.createHash('sha256').update(bytes).digest('hex') === leafletEntry.sha256);
      const text = bytes.toString('utf8');
      ok('the preserved Leaflet keeps its @preserve license header', text.startsWith('/* @preserve'));
      ok('the preserved Leaflet still carries no sourceMappingURL', !/sourceMappingURL/.test(text));
      ok('the Leaflet sourceMappingURL-only transformation is documented in the manifest',
        Array.isArray(leafletEntry.transformations) &&
        leafletEntry.transformations.length === 1 &&
        /sourceMappingURL/.test(leafletEntry.transformations[0]));
    }
    const transformed = analysis.files.filter((f) => Array.isArray(f.transformations) && f.transformations.length > 0);
    ok('Leaflet JS is the ONLY shipped file declaring a transformation',
      transformed.length === 1 && transformed[0].destination === '/vendor/leaflet/leaflet.js');
  }

  /* ---- 3. every affected view loads the exact intended same-origin asset ---- */
  for (const [view, required] of R6_VIEW_EXPECTATIONS) {
    const src = readIf(view);
    const refs = R6.extractDocumentAssetRefs(src);
    const flat = refs.scripts.concat(refs.stylesheets, refs.imports);
    ok(`${view} loads exactly its intended same-origin vendor assets`,
      src !== '' && required.every((r) => flat.includes(r)));
  }

  /* ---- 4. no remote executable script/stylesheet survives anywhere ---- */
  {
    const scanned = [];
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        const stat = fs.statSync(p);
        // public/vendor holds the self-hosted third-party bundles themselves;
        // their own contents are provenance-verified by hash above, not scanned
        // for authoring style.
        if (stat.isDirectory()) { if (name !== 'vendor') walk(p); continue; }
        if (/\.(ejs|js|css|html)$/i.test(name)) scanned.push(p);
      }
    };
    walk(path.join(root, 'views'));
    walk(publicRoot);

    const offenders = [];
    const externalScriptOffenders = [];
    for (const file of scanned) {
      const refs = R6.extractDocumentAssetRefs(fs.readFileSync(file, 'utf8'));
      const cls = R6.classifyExternalRefs(refs);
      const rel = path.relative(root, file).replace(/\\/g, '/');
      if (cls.forbidden.length) offenders.push(rel);
      if (cls.externalScripts.length) externalScriptOffenders.push(rel);
    }
    ok('no view or client asset loads an external executable script',
      scanned.length > 0 && externalScriptOffenders.length === 0);
    if (externalScriptOffenders.length) externalScriptOffenders.forEach((f) => console.error('    - external script in ' + f));
    ok('no view or client asset loads a remote asset outside the Google Fonts exception',
      offenders.length === 0);
    if (offenders.length) offenders.forEach((f) => console.error('    - forbidden remote reference in ' + f));

    // The floating tag must not return in a fetched reference (attribute shapes
    // only — a comment recording its removal is deliberately not a match).
    const floating = [];
    for (const file of scanned) {
      const refs = R6.extractDocumentAssetRefs(fs.readFileSync(file, 'utf8'));
      if (refs.scripts.concat(refs.stylesheets, refs.imports).some((r) => /@latest\b/.test(r))) {
        floating.push(path.relative(root, file).replace(/\\/g, '/'));
      }
    }
    ok('no fetched reference uses a floating @latest version', floating.length === 0);
  }

  /* ---- 5. the CSP contraction, proven from the real middleware source ---- */
  {
    const src = readIf(path.join('middleware', 'securityHeaders.js'));
    const directive = (name) => {
      const m = src.match(new RegExp('\\b' + name + '\\s*:\\s*\\[([^\\]]*)\\]'));
      return m ? m[1] : '';
    };
    for (const origin of R6.REMOVED_EXECUTABLE_ORIGINS) {
      const host = origin.replace(/^https?:\/\//, '');
      const hostRe = new RegExp(host.replace(/\./g, '\\.'));
      const inAnyDirective = ['scriptSrc', 'styleSrcElem', 'imgSrc', 'mediaSrc', 'connectSrc', 'fontSrc', 'workerSrc', 'defaultSrc']
        .some((d) => hostRe.test(directive(d)));
      ok(`CSP no longer allows ${host} in ANY directive`, directive('scriptSrc') !== '' && !inAnyDirective);
    }
    ok('CSP scriptSrc is exactly self + the per-request nonce',
      /^\s*"'self'"\s*,\s*nonce\s*$/.test(directive('scriptSrc')));
    ok('CSP styleSrcElem keeps self + nonce + Google Fonts only',
      /fonts\.googleapis\.com/.test(directive('styleSrcElem')) &&
      /'self'/.test(directive('styleSrcElem')) && /nonce/.test(directive('styleSrcElem')));
    ok('CSP scriptSrcAttr still blocks inline event handlers', /'none'/.test(directive('scriptSrcAttr')));
    ok('CSP keeps no unsafe-inline/unsafe-eval in scriptSrc',
      !/'unsafe-inline'|'unsafe-eval'/.test(directive('scriptSrc')));
    ok('CSP retains the approved data/media/font origins',
      /tile\.openstreetmap\.org/.test(directive('imgSrc')) &&
      /res\.cloudinary\.com/.test(directive('imgSrc')) &&
      /res\.cloudinary\.com/.test(directive('mediaSrc')) &&
      /api\.iconify\.design/.test(directive('connectSrc')) &&
      /fonts\.gstatic\.com/.test(directive('fontSrc')));
    ok('CSP retains the self/blob worker boundary MapLibre requires',
      /'self'/.test(directive('workerSrc')) && /blob:/.test(directive('workerSrc')));
    ok('CSP retains data: in imgSrc for the vendor stylesheets’ inline images',
      /data:/.test(directive('imgSrc')));
  }

  /* ---- 6. stylesheet asset paths resolve locally ---- */
  for (const cssRel of ['vendor/leaflet/leaflet.css', 'vendor/pannellum/pannellum.css', 'vendor/maplibre/maplibre-gl.css']) {
    const abs = path.join(publicRoot, cssRel);
    if (!fs.existsSync(abs)) { ok(`${cssRel} exists`, false); continue; }
    const res = r6ResolveCssAssetPaths(fs.readFileSync(abs, 'utf8'), path.dirname(abs));
    ok(`${cssRel} resolves every relative asset path locally`, res.unresolved.length === 0);
  }
  ok('all five Leaflet distribution images are present next to leaflet.css',
    R6.LEAFLET_IMAGES.every((img) => fs.existsSync(path.join(publicRoot, img.replace(/^\/+/, '')))));

  /* ---- 7. every lucide.createIcons invocation is guarded ---- */
  {
    const unguarded = [];
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        const stat = fs.statSync(p);
        if (stat.isDirectory()) { if (name !== 'vendor') walk(p); continue; }
        if (!/\.(ejs|js)$/i.test(name)) continue;
        const rel = path.relative(root, p).replace(/\\/g, '/');
        for (const line of r6FindUnguardedCreateIcons(R6.stripComments(fs.readFileSync(p, 'utf8')))) {
          unguarded.push(rel + ':' + line);
        }
      }
    };
    walk(path.join(root, 'views'));
    walk(path.join(root, 'public', 'js'));
    ok('every lucide.createIcons invocation is guarded against a missing bundle', unguarded.length === 0);
    if (unguarded.length) unguarded.forEach((u) => console.error('    - unguarded createIcons at ' + u));

    /* Fixtures pin BOTH directions of the code-shape scan. */
    ok('fixture: a real unguarded lucide.createIcons call is flagged',
      r6FindUnguardedCreateIcons('function r() {\n  lucide.createIcons();\n}').length === 1);
    ok('fixture: a same-line guarded call is not flagged',
      r6FindUnguardedCreateIcons("if (window.lucide && typeof window.lucide.createIcons === 'function') { window.lucide.createIcons(); }").length === 0);
    ok('fixture: a guard on the preceding line is honoured',
      r6FindUnguardedCreateIcons("if (window.lucide && typeof window.lucide.createIcons === 'function') {\n  window.lucide.createIcons();\n}").length === 0);
    ok('fixture: prose documenting the guard does not trip the scan',
      r6FindUnguardedCreateIcons('// Every call site below used to invoke `lucide.createIcons()` directly.\n/* lucide.createIcons() was unguarded */\n * lucide.createIcons()').length === 0);
    ok('fixture: an unguarded call is still flagged when it follows a comment block',
      r6FindUnguardedCreateIcons('// documented guarantee about lucide.createIcons()\nlucide.createIcons();').length === 1);
  }

  /* ---- 8. the map/VR missing-library states remain truthful ---- */
  {
    const map = readIf(path.join('views', 'map.ejs'));
    ok('/map still fails closed to the fixed unavailable state without Leaflet',
      /typeof L === 'undefined'[\s\S]{0,200}renderStaticMapFallback\('Live map engine is unavailable/.test(map));
    ok('/map still fails closed to the fixed unavailable state without MapLibre',
      /typeof maplibregl === 'undefined'[\s\S]{0,200}renderStaticMapFallback\('Live map engine is unavailable/.test(map));
    ok('/map no longer hard-codes any Leaflet marker image URL',
      !/iconUrl\s*:/.test(map) && !/shadowUrl\s*:/.test(map));
    for (const view of ['views/vr.ejs', 'views/vr-route.ejs']) {
      const src = readIf(view);
      ok(`${view} still reports a truthful VR-unavailable state without Pannellum`,
        /if \(!window\.pannellum\)/.test(src) && /could not be loaded/.test(src));
      ok(`${view} never claims arrival when the viewer is missing`,
        /if \(!window\.pannellum\)[\s\S]{0,300}showFallback\(\)/.test(src));
    }
    for (const view of ['views/home.ejs', 'views/dashboard.ejs']) {
      ok(`${view} fails closed to a truthful message without Leaflet`,
        /typeof L === 'undefined'/.test(readIf(view)) &&
        /Live map engine is unavailable\./.test(readIf(view)));
    }
  }

  /* ---- 9. package manifests match the reviewed dependency baseline ---- */
  {
    const hashOf = (rel) => {
      const p = path.join(root, rel);
      return fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') : '';
    };
    ok('package.json matches the reviewed dependency-remediation bytes',
      hashOf('package.json') === REVIEWED_PACKAGE_JSON_SHA256);
    ok('package-lock.json matches the reviewed dependency-remediation bytes',
      hashOf('package-lock.json') === REVIEWED_PACKAGE_LOCK_SHA256);
    const pkg = JSON.parse(readIf('package.json') || '{}');
    ok('no browser vendor library was added as an npm dependency',
      !Object.keys(pkg.dependencies || {}).some((d) => Object.keys(R6.EXPECTED_PACKAGES).includes(d)));
  }

  /* ---- 10. the service-worker privacy boundary stays intact as OFF.3 adds
     only the session-neutral UI/runtime; guide JSON + PMTiles stay explicit
     download data in IndexedDB, outside Cache Storage. ---- */
  {
    const sw = readIf(path.join('public', 'sw.js'));
    /* 2D-only correction: there is NO cache-eligible cross-origin host at all.
       OSM tiles are no longer mirrored (OFF.4 renders the offline map from the
       bundled PMTiles archive) and Cloudinary media is never stored, so
       360/Guided-VR/Free-Roam media and building photos cannot enter Cache
       Storage. Both online paths remain CSP-permitted and network-served. */
    ok('sw.js declares no cache-eligible external host at all (OSM and Cloudinary are network-only)',
      !/function isApprovedExternalHost/.test(sw) && !/function externalStrategy/.test(sw) &&
      !/tile\.openstreetmap\.org/.test(sw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')));
    ok('sw.js still never caches an HTML navigation',
      /function navigationFallbackStrategy/.test(sw) && !/\bvar\s+PAGE_CACHE\s*=/.test(sw) &&
      !/function\s+pageStrategy/.test(sw));
    ok('sw.js still refuses the authenticated/forbidden prefixes',
      /FORBIDDEN_PREFIXES/.test(sw) && /'\/admin'/.test(sw) && /'\/auth'/.test(sw));
    ok('sw.js still never mirrors /img/vr/ media', /\/img\/vr\//.test(sw));
    const precache = (sw.match(/PRECACHE_URLS\s*=\s*\[([\s\S]*?)\]/) || [])[1] || '';
    ok('sw.js precaches only the approved offline renderer libraries, never the guide API or map archive',
      /\/vendor\/maplibre\/maplibre-gl\.js/.test(precache) &&
      /\/vendor\/pmtiles\/pmtiles\.js/.test(precache) &&
      !/\/api\/offline-guide/.test(precache) && !/\.pmtiles/.test(precache));
    ok('sw.js adds explicit-download offline navigation while keeping every HTML navigation network-only',
      /OFF\.3 adds the guide only after explicit user consent/i.test(sw) &&
      /function navigationFallbackStrategy[\s\S]*?fetch\(event\.request\)/.test(sw) &&
      !/\bvar\s+PAGE_CACHE\s*=/.test(sw));
  }

  /* ---- 11. standalone accounting + residue registration ---- */
  for (const script of R6_STANDALONE_PROBES) {
    ok(`${script} exists on disk`, fs.existsSync(path.join(__dirname, script)));
    ok(`${script} stays OUT of the npm-test registration (standalone accounting)`,
      r5IsStandaloneProbe(SPAWNED_PROBE_STAGES, script));
  }
  {
    const residue = evaluateResidueRegistration(SPAWNED_PROBE_STAGES, RESIDUE_PROBE_SCRIPT);
    ok('the canonical residue gate remains registered exactly once', residue.exactlyOnce);
    ok('the canonical residue gate remains the FINAL registered spawned probe', residue.isFinalScript);
    ok('the canonical residue gate remains in the FINAL stage, alone',
      residue.isFinalStage && residue.finalStageIsResidueOnly);
  }

  /* ---- 12. the focused R6 probe honours its own boundaries ---- */
  {
    const probe = readIf(path.join('scripts', R6_PROBE_SCRIPT));
    ok('the R6 probe uses the self-terminating with-server harness',
      /require\('\.\/with-server'\)/.test(probe) && !/app\.listen\(/.test(probe));
    ok('the R6 probe uses dedicated ports 3383/3384 and confirms they are free',
      /3383/.test(probe) && /3384/.test(probe) && /portIsFree/.test(probe));
    ok('the R6 probe never kills or spawns a process itself',
      !/\.kill\s*\(/.test(probe) && !/process\.kill/.test(probe) &&
      !/require\(\s*['"]child_process['"]\s*\)/.test(probe));
    ok('the R6 probe uses the shared regression credential loader',
      /require\('\.\/regressionCredentials'\)/.test(probe));
    ok('the R6 probe owns and terminates its sessions from a finally',
      /require\('\.\/probeSessionLifecycle'\)/.test(probe) &&
      /finally\s*\{[\s\S]{0,600}terminateAll\(\)/.test(probe));
    ok('the R6 probe fails closed instead of skipping the Supabase leg',
      /hasSupabaseConfig\(\)/.test(probe) && /Supabase leg is never skipped/.test(probe));
    ok('the R6 probe opens no direct database or repository handle',
      !/require\(\s*['"][^'"]*(?:config\/db|repositories\/)[^'"]*['"]\s*\)/.test(probe) &&
      !/db\.query\s*\(/.test(probe));
    ok('the R6 probe performs no application mutation beyond login/logout',
      !/method:\s*['"](?:PUT|PATCH|DELETE)['"]/i.test(probe));
  }

  /* ---- 13. NEGATIVE FIXTURES — same analyzers, mutated inputs ---- */
  {
    const clone = (o) => JSON.parse(JSON.stringify(o));

    // (a) a downgraded/altered version is rejected
    const badVersion = clone(manifest);
    badVersion.packages[0].version = '1.9.3';
    ok('fixture: an altered package version is rejected',
      r6VersionsMatch(R6.analyzeVendorManifest(badVersion).versions, R6.EXPECTED_PACKAGES) === false);

    // (b) a malformed hash is rejected by the manifest validator...
    const badHashShape = clone(manifest);
    badHashShape.packages[0].files[0].sha256 = 'not-a-hash';
    ok('fixture: a malformed SHA-256 is rejected',
      R6.analyzeVendorManifest(badHashShape).ok === false);

    // ...and a well-formed but WRONG hash is caught against the real bytes
    const wrongHash = clone(manifest);
    wrongHash.packages[0].files[0].sha256 = 'f'.repeat(64);
    ok('fixture: a well-formed but incorrect SHA-256 fails byte verification',
      r6VerifyFilesOnDisk(R6.analyzeVendorManifest(wrongHash).files, publicRoot).mismatched.length === 1);

    // (c) a removed license is rejected
    const noLicense = clone(manifest);
    delete noLicense.packages[0].license;
    ok('fixture: a package with no recorded license is rejected',
      R6.analyzeVendorManifest(noLicense).ok === false);

    /* (c2) INDEPENDENT-INVENTORY negative fixtures. EXACTLY 17 rejecting
       mutations, each individually SHAPE-VALID (so the old shape-only checks
       would have accepted it) but divergent from the reviewed inventory. They
       are declared as ONE explicit collection so the count is auditable in
       source: 17 NEGATIVE mutations, plus the single POSITIVE live-manifest
       anchor below (c3) — never "18 negative". The coordinated-hash entry is the
       fail-open closer: exactly what a bytes+manifest-hash swap looks like. */
    const inventoryMutationFixtures = [
      // A different but syntactically valid npm registry tarball URL.
      { label: 'a different but valid-looking tarball URL',
        mut: (c) => { c.packages[0].tarball = 'https://registry.npmjs.org/leaflet/-/leaflet-1.9.5.tgz'; } },
      // A different but syntactically valid sha512 integrity.
      { label: 'a different but valid-looking sha512 integrity',
        mut: (c) => { c.packages[0].integrity = 'sha512-AAAAynzJOmOlHp+iL3FyWqK89GtNL8U8rvlMOsQdTTssxZwCXh8N2NB3GDQOL+YR3XnWyZAxwQixURb+FA74PA=='; } },
      // A different nonblank license (the empty-license case is covered above).
      { label: 'a different nonblank license', mut: (c) => { c.packages[0].license = 'MIT'; } },
      // A different nonblank tarball source path.
      { label: 'a different nonblank tarball source path',
        mut: (c) => { c.packages[0].files[0].source = 'package/dist/leaflet-src.js'; } },
      // A different but valid /vendor destination.
      { label: 'a different valid /vendor destination',
        mut: (c) => { c.packages[0].files[1].destination = '/vendor/leaflet/leaflet-styles.css'; } },
      // A different byte count.
      { label: 'a different byte count', mut: (c) => { c.packages[0].files[1].bytes = 14807; } },
      // A different but valid-looking SHA-256.
      { label: 'a different valid-looking SHA-256', mut: (c) => { c.packages[0].files[0].sha256 = 'a'.repeat(64); } },
      // A DIFFERENT globalInterface.
      { label: 'a different globalInterface', mut: (c) => { c.packages[0].globalInterface = 'Leaflet'; } },
      // A missing package entry.
      { label: 'a missing package entry', mut: (c) => { c.packages.splice(4, 1); } },
      // An EXTRA package entry with a genuinely new, unique name.
      { label: 'an extra package entry (unique name)',
        mut: (c) => { const extra = clone(c.packages[0]); extra.name = 'jquery'; c.packages.push(extra); } },
      // A missing file entry.
      { label: 'a missing file entry', mut: (c) => { c.packages[0].files.pop(); } },
      // An EXTRA file entry with a genuinely new, unique destination.
      { label: 'an extra file entry (unique destination)',
        mut: (c) => { const extra = clone(c.packages[0].files[1]); extra.destination = '/vendor/leaflet/extra.css'; c.packages[0].files.push(extra); } },
      // Duplicate package names.
      { label: 'a duplicate package name', mut: (c) => { c.packages[1].name = 'leaflet'; } },
      // Duplicate destinations.
      { label: 'a duplicate destination', mut: (c) => { c.packages[0].files[2].destination = '/vendor/leaflet/leaflet.css'; } },
      // Undeclared/altered transformation on a byte-identical file.
      { label: 'an undeclared transformation on a byte-identical file',
        mut: (c) => { c.packages[0].files[1].transformations = ['sneaky edit']; } },
      // Altered transformation on the one legitimately transformed file.
      { label: 'an altered transformation on the Leaflet JS file',
        mut: (c) => { c.packages[0].files[0].transformations = ['removed something else']; } },
      // THE fail-open closer: a coordinated mutation that updates a file hash
      // (as a bytes+manifest swap would) still differs from the pinned hash.
      { label: 'a coordinated hash update that still differs from the pinned hash',
        mut: (c) => { c.packages[0].files[0].sha256 = 'b'.repeat(64); } },
    ];
    for (const { label, mut } of inventoryMutationFixtures) {
      const c = clone(manifest);
      mut(c);
      ok('fixture: ' + label + ' is rejected by the independent inventory',
        R6.compareManifestToInventory(c).length > 0 && R6.analyzeVendorManifest(c).ok === false);
    }

    /* (c3) THE positive anchor (NOT a negative mutation): the collection holds
       exactly 17 rejecting mutations AND the live manifest passes the inventory
       exactly. This 17-plus-1 composition is the true fixture accounting. */
    ok('fixture: exactly 17 rejecting mutations plus one positive live-manifest anchor',
      inventoryMutationFixtures.length === 17 &&
      R6.compareManifestToInventory(manifest).length === 0);

    // (d) a removed view reference is detected
    {
      const src = readIf('views/admin/campus-map.ejs');
      const mutated = src.replace('/vendor/lucide/lucide.min.js', '/vendor/lucide/REMOVED.js');
      const refs = R6.extractDocumentAssetRefs(mutated);
      const flat = refs.scripts.concat(refs.stylesheets, refs.imports);
      ok('fixture: a removed view vendor reference is detected',
        src !== mutated && !flat.includes('/vendor/lucide/lucide.min.js'));
    }

    // (e) a reverted CSP contraction is rejected
    {
      const good = "default-src 'self';script-src 'self' 'nonce-x';style-src-elem 'self' 'nonce-x' https://fonts.googleapis.com;font-src 'self' https://fonts.gstatic.com data:;img-src 'self' data: blob: https://*.tile.openstreetmap.org https://res.cloudinary.com;media-src 'self' blob: https://res.cloudinary.com;connect-src 'self' https://*.tile.openstreetmap.org https://api.iconify.design https://res.cloudinary.com;worker-src 'self' blob:;object-src 'none';frame-ancestors 'none'";
      ok('fixture: the reference contracted CSP is accepted',
        R6.evaluateCspContract(R6.parseCsp(good)).ok === true);
      for (const origin of R6.REMOVED_EXECUTABLE_ORIGINS) {
        const reverted = good.replace("script-src 'self' 'nonce-x'", `script-src 'self' 'nonce-x' ${origin}`);
        ok(`fixture: a CSP that re-allows ${origin.replace(/^https?:\/\//, '')} is rejected`,
          R6.evaluateCspContract(R6.parseCsp(reverted)).ok === false);
      }
      ok('fixture: a CSP that loses its per-request nonce is rejected',
        R6.evaluateCspContract(R6.parseCsp(good.replace(" 'nonce-x'", ''))).ok === false);
      ok('fixture: a CSP that loses the self/blob worker boundary is rejected',
        R6.evaluateCspContract(R6.parseCsp(good.replace("worker-src 'self' blob:", "worker-src 'self'"))).ok === false);
      ok('fixture: a CSP that drops the Iconify data API is rejected',
        R6.evaluateCspContract(R6.parseCsp(good.replace(' https://api.iconify.design', ''))).ok === false);
    }

    // (f) registering the standalone probe inside npm test is flagged
    ok('fixture: registering the R6 probe inside npm test is flagged',
      r5IsStandaloneProbe(
        [...SPAWNED_PROBE_STAGES,
          { key: 'r6', prefix: 'r6', heading: '[r6]', probes: [['r6 probe', R6_PROBE_SCRIPT]] }],
        R6_PROBE_SCRIPT) === false);

    // (g) the approved-origin allowlist is pinned in BOTH directions
    {
      const remoteScript = R6.extractDocumentAssetRefs('<script src="https://unpkg.com/lucide@latest"></script>');
      ok('fixture: a real remote executable script is forbidden',
        R6.classifyExternalRefs(remoteScript).forbidden.length === 1);
      const remoteCss = R6.extractDocumentAssetRefs('<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css">');
      ok('fixture: a real remote stylesheet is forbidden',
        R6.classifyExternalRefs(remoteCss).forbidden.length === 1);
      // Google Fonts is approved for STYLESHEETS ONLY — never for a script.
      const fontsScript = R6.extractDocumentAssetRefs('<script src="https://fonts.googleapis.com/evil.js"></script>');
      ok('fixture: the Google Fonts exception never extends to executable scripts',
        R6.classifyExternalRefs(fontsScript).forbidden.length === 1);
      const fontsCss = R6.extractDocumentAssetRefs('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">');
      ok('fixture: the Google Fonts stylesheet exception is still accepted',
        R6.classifyExternalRefs(fontsCss).forbidden.length === 0);
      // Prose naming a removed origin must NOT be able to fail the contract.
      const prose = '<!-- formerly https://unpkg.com/lucide@latest --><%# unpkg lucide@latest %><script src="/vendor/lucide/lucide.min.js"></script>';
      ok('fixture: commentary naming a removed CDN does not trip the scan',
        R6.classifyExternalRefs(R6.extractDocumentAssetRefs(prose)).forbidden.length === 0);
      // A non-stylesheet <link> must never be classified as a stylesheet.
      const preconnect = R6.extractDocumentAssetRefs('<link rel="preconnect" href="https://fonts.gstatic.com">');
      ok('fixture: a preconnect link is not treated as a stylesheet',
        preconnect.stylesheets.length === 0);
    }
  }

  /* ---- 14. HTTP evidence: assets served, 404 fails closed, live CSP ---- */
  {
    const httpFailures = await withServer(
      { mode: 'mysql', port: R6_HTTP_PORT, sessionStore: 'memory' },
      async (base) => {
        const local = [];
        const hok = (name, cond) => {
          if (!cond) local.push(name);
          console.log(`  [${cond ? 'PASS' : 'FAIL'}] self-hosted-vendor :: ${name}`);
        };

        // Every destination is served byte-exact from this origin, verified
        // against the INDEPENDENTLY PINNED inventory SHA-256 (not the manifest's
        // own value), so a coordinated bytes+manifest swap still fails here.
        const invFiles = R6.flattenExpectedInventory();
        let served = 0; let bad = 0;
        for (const file of invFiles) {
          const r = await fetch(base + file.destination);
          if (r.status !== 200) { bad += 1; await r.arrayBuffer(); continue; }
          const bytes = Buffer.from(await r.arrayBuffer());
          if (bytes.length === file.bytes &&
              crypto.createHash('sha256').update(bytes).digest('hex') === file.sha256) served += 1;
          else bad += 1;
        }
        hok('every pinned destination is served 200 with the independently pinned byte-exact SHA-256',
          invFiles.length === R6.EXPECTED_VENDOR_FILE_TOTAL && bad === 0 && served === invFiles.length);

        // Leaflet marker/control images resolve over HTTP.
        let imgOk = 0;
        for (const img of R6.LEAFLET_IMAGES) {
          const r = await fetch(base + img);
          await r.arrayBuffer();
          if (r.status === 200) imgOk += 1;
        }
        hok('all five Leaflet distribution images resolve over HTTP',
          imgOk === R6.LEAFLET_IMAGES.length);

        // A missing vendor path fails closed with no CDN fallback.
        const missing = await fetch(base + '/vendor/leaflet/this-asset-does-not-exist.js', { redirect: 'manual' });
        const missingBody = await missing.text();
        hok('a missing /vendor path returns 404', missing.status === 404);
        hok('the missing-asset response issues no cross-origin redirect', !missing.headers.get('location'));
        hok('the missing-asset response advertises no CDN fallback',
          !R6.REMOVED_EXECUTABLE_ORIGINS.some((o) => missingBody.includes(o.replace(/^https?:\/\//, ''))));

        // The LIVE response CSP satisfies the whole contract.
        const page = await fetch(base + '/auth', { headers: { Accept: 'text/html' } });
        await page.text();
        const contract = R6.evaluateCspContract(R6.parseCsp(page.headers.get('content-security-policy')));
        hok('the live response CSP satisfies the complete R6 contract', contract.ok === true);
        if (!contract.ok) contract.violations.forEach((v) => console.error('    - CSP: ' + v));

        return local;
      });
    rec.failures.push(...httpFailures);
  }

  return rec.failures;
}

/* ---------------- static VR runtime sanitizer gate (no server) ---------------- */
function runVrRuntimeGate() {
  const rec = makeRecorder('vr-runtime');
  const { ok } = rec;
  const src = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'vrController.js'), 'utf8');
  // The VR runtime imports + applies the shared media URL policy (Section 10.5).
  ok('vrController imports normalizeMediaUrl', /require\(['"]\.\.\/utils\/mediaUrl['"]\)/.test(src) && /\bnormalizeMediaUrl\b/.test(src));
  // Pre-11.8C cleanup: the scene-image helper runs normalizeMediaUrl FIRST and
  // then nulls sanitized local /img/ paths whose file does not exist under
  // public/ (the seeded /img/vr/*.jpg placeholders are intentionally absent),
  // so VR surfaces never emit a loadable URL that is known to 404.
  ok('vrController has missing-local-image guard (resolveSceneImageUrl)',
    /function resolveSceneImageUrl/.test(src) &&
    /normalizeMediaUrl\(raw\)/.test(src) &&
    /fs\.existsSync\(/.test(src));
  // Both image_url surface points (guided-route source + scene browser) pass
  // through the guarded helper before reaching EJS / JSON output.
  ok('vrController guards guided-route image_url', /image_url:\s*resolveSceneImageUrl\(s\.image_url\)/.test(src));
  ok('vrController guards scene-browser image_url', /image_url:\s*resolveSceneImageUrl\(current\.image_url\)/.test(src));
  // Guided verification reads the stored public ID internally so arrival can
  // fail closed on incomplete delivery metadata. Public response construction
  // must remain explicit and must never expose that field.
  ok('vrController uses cloudinary_public_id only as internal guided metadata',
    /SELECT id, scene_key, title, description, image_url, cloudinary_public_id, node_id/.test(src) &&
    !/cloudinary_public_id\s*:/.test(src));
  return rec.failures;
}

/* ---------------- static admin VR schedule-UX gate (no server) ---------------- */
// Semester-image flow: admins search and select an existing room schedule
// document. The saved hotspot stores only schedule_document_id; its room,
// semester, school year, and image update automatically with that record.
function runAdminVrScheduleUxGate() {
  const rec = makeRecorder('admin-vr-ux');
  const { ok } = rec;
  const root = path.join(__dirname, '..');
  const view = fs.readFileSync(path.join(root, 'views', 'admin', 'vr.ejs'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'public', 'js', 'admin', 'admin-vr.js'), 'utf8');
  const ctrl = fs.readFileSync(path.join(root, 'controllers', 'adminVrController.js'), 'utf8');
  ok('vr.ejs has a native schedule document select named schedule_document_id',
    /<select name="schedule_document_id" id="vr-hotspot-schedule-document">/.test(view));
  ok('vr.ejs has no legacy editable schedule metadata inputs',
    !/<(?:input|select)[^>]*name="schedule_(?:building_id|location_type|location_label|floor_label)"/.test(view));
  ok('vr.ejs has a labelled schedule search with live result status',
    /<label for="vr-hotspot-schedule-search">Search room schedules<\/label>/.test(view) &&
    /id="vr-hotspot-schedule-search"[^>]*type="search"|type="search"[^>]*id="vr-hotspot-schedule-search"/.test(view) &&
    /id="vr-hotspot-schedule-status"[^>]*aria-live="polite"/.test(view));
  ok('admin-vr.js loads bounded room schedule documents from the admin API',
    /apiRequest\('\/admin\/api\/room-schedule-documents\?limit=200'/.test(js) &&
    /SCHEDULE_MAX_ROWS\s*=\s*2000/.test(js) && /&offset=/.test(js));
  ok('admin-vr.js filters schedule documents locally and creates options safely',
    /function renderScheduleDocumentOptions\(/.test(js) &&
    /scheduleDocumentLabel\(documentRow\)\.toLocaleLowerCase\('en'\)\.includes\(query\)/.test(js) &&
    /document\.createElement\('option'\)/.test(js));
  ok('admin-vr.js schedule payload sends only schedule_document_id',
    /payload\.schedule_document_id = documentId;/.test(js) &&
    !/payload\.schedule_(?:building_id|location_type|location_label|floor_label)\s*=/.test(js));
  ok('adminVrController requires the selected document and fails closed on backend mismatch',
    ctrl.includes('A schedule hotspot requires a room schedule selection.') &&
    ctrl.includes('scheduleDataSource.getScheduleDataSource() !== vrDataSource.getVrDataSource()'));

  // Searchable Target-scene selector (Add/Edit Hotspot modal):
  ok('vr.ejs has the labeled type="search" target search input with autocomplete off',
    /<label for="vr-hotspot-target-search">Search target scenes<\/label>/.test(view) &&
    /<input type="search" id="vr-hotspot-target-search"[^>]*autocomplete="off"/.test(view) &&
    /placeholder="Search by scene key or title…"/.test(view));
  ok('vr.ejs target search input has no name attribute (never form-submitted)',
    !/<input[^>]*id="vr-hotspot-target-search"[^>]*\sname=/.test(view) &&
    !/<input[^>]*\sname=[^>]*id="vr-hotspot-target-search"/.test(view));
  ok('vr.ejs has the aria-live="polite" target search status element',
    /id="vr-hotspot-target-status"[^>]*aria-live="polite"/.test(view));
  ok('vr.ejs keeps the native target_scene_id select contract (no combobox/datalist)',
    /<select name="target_scene_id" id="vr-hotspot-target">/.test(view) &&
    !/<datalist/.test(view) && !/role="combobox"/.test(view));
  ok('admin-vr.js filters the existing allScenes collection locally on input',
    /hotspotTargetSearch\.addEventListener\('input'/.test(js) &&
    /function renderTargetOptions\(/.test(js) &&
    /sortScenes\(allScenes\)/.test(js));
  ok('admin-vr.js matches scene_key and title case-insensitively',
    /str\(s\.scene_key\)\.toLowerCase\(\)\.includes\(q\)/.test(js) &&
    /str\(s\.title\)\.toLowerCase\(\)\.includes\(q\)/.test(js));
  ok('admin-vr.js still excludes the owner scene from target options',
    /sid !== hotspotTargetExcludeId/.test(js));
  ok('admin-vr.js builds options safely (createElement/textContent, no HTML sinks)',
    /document\.createElement\('option'\)/.test(js) &&
    !/\.innerHTML\s*=/.test(js) && !/insertAdjacentHTML/.test(js) &&
    !/document\.write/.test(js));
  ok('admin-vr.js preserves a non-matching current selection and announces no-match state',
    js.includes('(current selection)') && js.includes('No matching scenes'));
  ok('admin-vr.js resets the target search when (re)initializing the modal',
    /hotspotTargetSearch\.value = ''/.test(js));
  ok('admin-vr.js hotspot payload still sends target_scene_id unchanged',
    /payload\.target_scene_id = t;/.test(js));
  return rec.failures;
}

/* ---------------- static Cloudinary docs/env gate (no server) ---------------- */
// Section 10.7: keep .env.example / README.md / docs/deployment.md aligned with
// the live 10.4-10.6 Cloudinary implementation, free of stale "future-only"
// wording, and free of real secret values.
function containsLikelyDocumentationSecret(value) {
  const text = String(value == null ? '' : value);
  const withoutLabeledNonSecrets = text
    // Integrity evidence is safe only when its algorithm and exact 64-hex
    // shape are explicit. The label may wrap onto the preceding line.
    .replace(/\b(?:aggregate\s+)?SHA-256\s*(?:\r?\n[ \t]*)?`[0-9a-f]{64}`/gi,
      'SHA-256 `[recognized-integrity-digest]`')
    // Production Git evidence is safe only when the 40-hex value is bound to
    // an explicit deployed/runtime baseline label.
    .replace(/\b(?:SEC-51\s+runtime|deployed(?:\s+(?:runtime|production))?|production\s+runtime|(?:current|accepted)\s+technical\s+Production|technical\s+Production)\s+baseline\s*(?:\r?\n[ \t]*)?`[0-9a-f]{40}`/gi,
      'deployed runtime baseline `[recognized-git-commit]`')
    // A repository identifier is safe only when the same claim identifies it
    // as the later documentation-only commit.
    .replace(/\bRepository HEAD\s+`[0-9a-f]{40}`(?=[^.]{0,160}\bdocumentation-only commit\b)/gi,
      'Repository HEAD `[recognized-documentation-commit]`')
    // Explicit Git SHA-1 evidence is a repository identifier, not a secret.
    .replace(/\bGit[\r\n \t]+commit[\r\n \t]+SHA-1(?:\s+is)?\s*(?:\r?\n[ \t]*)?`[0-9a-f]{40}`/gi,
      'Git commit SHA-1 `[recognized-git-commit]`')
    // Git tree objects are safe only with the same explicit SHA-1 binding.
    .replace(/\bGit[\r\n \t]+tree SHA-1(?:\s+is)?\s*(?:\r?\n[ \t]*)?`[0-9a-f]{40}`/gi,
      'Git tree SHA-1 `[recognized-git-tree]`');

  return /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|-----BEGIN [A-Z]|AKIA[0-9A-Z]{16}|[0-9a-f]{40,}/i.test(withoutLabeledNonSecrets);
}

function runCloudinaryDocsGate() {
  const rec = makeRecorder('cloudinary-docs');
  const { ok } = rec;
  const root = path.join(__dirname, '..');
  const envEx = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const deploy = fs.readFileSync(path.join(root, 'docs', 'deployment.md'), 'utf8');
  const all = envEx + '\n' + readme + '\n' + deploy;

  // (a) Stale 10.2-era "future-only" wording is absent from all three docs.
  const stale = [
    'runtime media path yet',
    'in later Milestone 10 section',
    'env + secret boundary',
    'secret boundary only',
    'Cloudinary env vars are deferred',
  ];
  for (const s of stale) ok('docs free of stale wording: "' + s + '"', !all.includes(s));

  // (b) Current 10.4-10.6 truth is documented in each file.
  ok('.env.example: server-only + owner-controlled + local fallback + host',
    /server-only/i.test(envEx) && /owner-controlled/i.test(envEx) && envEx.includes('/img/vr/') && envEx.includes('res.cloudinary.com'));
  ok('README: live media path + owner-controlled + no browser/Admin-API',
    readme.includes('res.cloudinary.com') && /owner-controlled/i.test(readme) && /browser direct-upload/i.test(readme) && /Admin API/.test(readme));
  ok('deployment.md: server-only media + owner-controlled + host',
    deploy.includes('res.cloudinary.com') && /owner-controlled/i.test(deploy) && /server-side|server-only/i.test(deploy));

  // (c) cloudinary_public_id documented as admin/server-only metadata.
  ok('docs: cloudinary_public_id is admin/server metadata only (not public/runtime)',
    all.includes('admin/server metadata only') && /never appears in public/i.test(all));

  // (d) Cloudinary documented as media-only (never script-src).
  ok('docs: Cloudinary never in script-src', all.includes('script-src') && /never[^.\n]{0,16}script-src/i.test(all));

  // (e) Docs carry no likely real secret VALUES (JWT/PEM/AWS/long hex).
  ok('docs contain no JWT/PEM/AWS/long-hex secret values',
    !containsLikelyDocumentationSecret(all));
  ok('fixture: explicitly labeled Git commits and SHA-256 integrity digests are accepted',
    !containsLikelyDocumentationSecret(
      'Production is on deployed runtime baseline `0123456789abcdef0123456789abcdef01234567`.\n' +
      'The current technical Production baseline `1357902468abcdef1357902468abcdef13579024` is accepted.\n' +
      'Repository HEAD `89abcdef0123456789abcdef0123456789abcdef` is a later documentation-only commit.\n' +
      'Git commit\nSHA-1 `fedcba9876543210fedcba9876543210fedcba98`.\n' +
      'Git tree SHA-1 `1234567890abcdef1234567890abcdef12345678`.\n' +
      'Package aggregate SHA-256\n`0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`.\n' +
      'Historical candidate manifest SHA-256 `abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789`.\n' +
      'Local maintenance Git commit SHA-1\n`fedcba9876543210fedcba9876543210fedcba98`.\n' +
      'Local maintenance manifest SHA-256\n`abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789`.\n' +
      'Cleanup fingerprint SHA-256\n`0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`.'));
  ok('fixture: an unlabeled long-hex value is rejected',
    containsLikelyDocumentationSecret('value `0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`') &&
    containsLikelyDocumentationSecret('value `ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789`'));
  ok('fixture: a JWT-shaped value is rejected',
    containsLikelyDocumentationSecret('eyJabcdefghijklmnopqrstuv.abcdefghijklmnopqrstuvwxyz012345.abcdefghijklmno'));
  ok('fixture: a PEM marker is rejected',
    containsLikelyDocumentationSecret('-----BEGIN PRIVATE KEY-----'));
  ok('fixture: an AWS access-key-shaped value is rejected',
    containsLikelyDocumentationSecret('AKIAABCDEFGHIJKLMNOP'));

  return rec.failures;
}

/* ---------------- orchestrator ---------------- */
/* ---------------- static admin-users XSS hardening gate (L1) ---------------- */
function runAdminUsersXssGate() {
  const rec = makeRecorder('admin-users-xss');
  const { ok } = rec;
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'admin', 'admin-users.js'), 'utf8');

  // L1: the avatar-fallback initials must be HTML-escaped before entering the
  // renderTable() innerHTML template. The RAW interpolation `${getInitials(`
  // must not appear anywhere; only the escaped `${escapeHtml(getInitials(`
  // form is allowed. (The raw substring cannot occur inside the escaped form,
  // so these two checks are exact.)
  ok('initials are never interpolated raw (no ${getInitials( )', src.indexOf('${getInitials(') === -1);
  ok('initials are escaped (${escapeHtml(getInitials( present)', src.indexOf('${escapeHtml(getInitials(') !== -1);

  // Regression guards: the neighboring DB-derived fields stay escaped.
  ok('full-name interpolation stays escaped', src.indexOf("${escapeHtml(u.first_name + ' ' + u.last_name)}") !== -1);
  ok('email interpolation stays escaped', src.indexOf('${escapeHtml(u.email)}') !== -1);

  // Type-safety: getInitials must treat non-string inputs as blank so an
  // unusual value can never throw mid-render.
  ok('getInitials guards non-string inputs', /function getInitials\([\s\S]{0,200}typeof firstName === 'string'/.test(src));

  return rec.failures;
}

/* ------------- static building-delete TOCTOU hardening gate (L2) ------------- */
function runBuildingDeleteTxGate() {
  const rec = makeRecorder('building-delete-tx');
  const { ok } = rec;
  const src = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'adminBuildingsController.js'), 'utf8');

  // L2: the MySQL building-delete guard (existence + route-reference check +
  // DELETE) must run inside ONE transaction with the target building row locked,
  // so a campus route inserted between the guard and the delete cannot be
  // silently ON DELETE CASCADE-removed.
  ok('uses a transaction (beginTransaction)', src.includes('beginTransaction'));
  ok('commits the transaction', /\.commit\(\)/.test(src));
  ok('rolls back on throw', /\.rollback\(\)/.test(src));
  ok('releases the connection', /\.release\(\)/.test(src));

  // Target building row is locked before the route-reference re-check.
  ok('locks the target building row (SELECT ... FOR UPDATE)',
    /SELECT id FROM buildings WHERE id = \? FOR UPDATE/.test(src));

  // Route-reference check + building DELETE run on the transaction connection,
  // not the shared pool.
  ok('route-reference check uses the tx connection',
    /conn\.query\(\s*['"`]SELECT id FROM campus_routes WHERE destination_building_id = \? LIMIT 1/.test(src));
  ok('building DELETE uses the tx connection',
    src.includes("conn.query('DELETE FROM buildings WHERE id = ?'"));

  // The old unsafe direct-pool patterns for the guarded delete must be gone.
  ok('no direct-pool building DELETE',
    !src.includes("db.query('DELETE FROM buildings WHERE id = ?'"));
  ok('no direct-pool route-reference check',
    !/db\.query\(\s*['"`]SELECT id FROM campus_routes WHERE destination_building_id = \? LIMIT 1/.test(src));

  return rec.failures;
}

/* ---------- static login timing / user-enumeration hardening gate (L4) ---------- */
function runLoginTimingGate() {
  const rec = makeRecorder('login-timing');
  const { ok } = rec;
  const src = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'authController.js'), 'utf8');
  // Scope the no-user / compare assertions to the loginPost function body only,
  // so unrelated no-user guards elsewhere (e.g. the OAuth completeRegistration
  // findUserById check) don't produce false results.
  const lStart = src.indexOf('exports.loginPost');
  const lEnd = src.indexOf('exports.logout');
  const loginSrc = (lStart !== -1 && lEnd > lStart) ? src.slice(lStart, lEnd) : '';

  // L4: local login must ALWAYS run a bcrypt.compare (against the user's hash or
  // a FIXED dummy hash) so an unknown email costs the same as a wrong password,
  // removing the user-enumeration timing oracle.
  ok('defines a fixed cost-10 dummy bcrypt hash constant',
    /const DUMMY_LOGIN_HASH = '\$2[aby]\$10\$[./A-Za-z0-9]{53}'/.test(src));
  ok('dummy hash referenced by declaration + both login branches',
    (src.match(/DUMMY_LOGIN_HASH/g) || []).length >= 3);
  ok('loginPost bcrypt.compares against the dummy fallback in both branches',
    (loginSrc.match(/\|\|\s*DUMMY_LOGIN_HASH/g) || []).length >= 2);

  // The no-user path must NOT short-circuit before bcrypt.compare (those early
  // returns were the timing oracle) — checked within loginPost only.
  ok('no early no-user return in loginPost Supabase branch', !!loginSrc && !loginSrc.includes('if (!sbUser) {'));
  ok('no early no-user return in loginPost MySQL branch', !!loginSrc && !loginSrc.includes('if (users.length === 0) {'));

  // L4 NO-GO: the guard must be type-safe — no .trim() on an unconfirmed string,
  // and explicit typeof checks for both email and password.
  ok('loginPost guard has no unsafe !email.trim()', !!loginSrc && !loginSrc.includes('!email.trim()'));
  ok('loginPost type-checks email', !!loginSrc && loginSrc.includes("typeof email === 'string'"));
  ok('loginPost type-checks password', !!loginSrc && loginSrc.includes("typeof password === 'string'"));

  return rec.failures;
}

/* ---------- static logout-probe output-hygiene gate ----------
   The failed-destroy unit cases in scripts/logoutSessionTermination-probe.js
   drive the REAL controller, which correctly emits one FIXED sanitized line
   per failure. Production behavior must not change — a genuine logout failure
   has to stay audited — but in the probe those lines are EXPECTED output and
   must be captured, never printed into an otherwise green npm-test transcript
   where a reviewer cannot tell them apart from a real logout failure.

   The expected line is pinned HERE, independently of the probe: a gate that
   reads its expectation out of the artifact it audits proves nothing. Every
   assertion is a CODE SHAPE, and every detector is exercised against a
   rejecting fixture so the gate cannot pass vacuously. */
const EXPECTED_LOGOUT_DESTROY_LOG = 'Logout error: session destroy failed.';

/** PURE: the probe never drives the real controller outside a capture wrapper. */
function probeCapturesEveryLogoutDrive(src) {
  const wrapped = (src.match(/captureConsoleError\(\(\)\s*=>\s*authController\.logout\(/g) || []).length;
  const total = (src.match(/authController\.logout\(/g) || []).length;
  // All four drives exist, each is wrapped, and none begins a statement line.
  return wrapped === 4 && total === wrapped && !/^\s*authController\.logout\(/m.test(src);
}

/** PURE: the capture helper restores console.error even if the callee throws. */
function probeRestoresConsoleError(src) {
  const i = src.indexOf('function captureConsoleError(');
  if (i === -1) return false;
  const body = src.slice(i, i + 600);
  return /const original = console\.error;/.test(body) &&
    /\bfinally\s*\{[\s\S]{0,120}console\.error = original;/.test(body);
}

/** PURE: exports.logout logs ONE string literal and interpolates no raw error. */
function controllerLogsFixedSanitizedLine(src) {
  const start = src.indexOf('exports.logout =');
  if (start === -1) return false;
  const end = src.indexOf('exports.logoutGet', start);
  const body = end > start ? src.slice(start, end) : '';
  const calls = body.match(/console\.error\([^)]*\)/g) || [];
  return calls.length === 1 &&
    calls[0] === "console.error('" + EXPECTED_LOGOUT_DESTROY_LOG + "')";
}

function runLogoutOutputHygieneGate() {
  const rec = makeRecorder('logout-output-hygiene');
  const { ok } = rec;
  const root = path.join(__dirname, '..');
  const probe = fs.readFileSync(path.join(root, 'scripts', 'logoutSessionTermination-probe.js'), 'utf8');
  const ctrl = fs.readFileSync(path.join(root, 'controllers', 'authController.js'), 'utf8');

  ok('the probe pins the same sanitized destroy-failure line this gate pins',
    probe.includes("const EXPECTED_DESTROY_LOG = '" + EXPECTED_LOGOUT_DESTROY_LOG + "';"));
  ok('the capture helper restores console.error in a finally',
    probeRestoresConsoleError(probe));
  ok('every unit logout drive runs inside the capture wrapper',
    probeCapturesEveryLogoutDrive(probe));
  ok('the probe asserts each captured line equals the pinned sanitized line',
    /failJsonLogs\[0\] === EXPECTED_DESTROY_LOG/.test(probe) &&
    /failHtmlLogs\[0\] === EXPECTED_DESTROY_LOG/.test(probe));
  ok('the probe asserts the captured logs carry no raw store detail',
    (probe.match(/Logs\.join\('\\n'\)\.indexOf\(rawMarker\) === -1/g) || []).length === 2);
  ok('the probe asserts the success branches log nothing at all',
    /okJsonLogs\.length === 0/.test(probe) && /okHtmlLogs\.length === 0/.test(probe));

  // Production behavior is UNCHANGED: a real logout failure still logs once,
  // sanitized, with no raw store error interpolated.
  ok('exports.logout still logs exactly one fixed sanitized line with no raw error',
    controllerLogsFixedSanitizedLine(ctrl));

  /* ---- negative fixtures: each detector must reject a broken source ---- */
  const bareDrive = probe.replace(
    "captureConsoleError(() => authController.logout(makeReq('text/html', new Error(rawMarker)), res))",
    "authController.logout(makeReq('text/html', new Error(rawMarker)), res)");
  ok('fixture: an unwrapped failed-destroy drive is flagged',
    bareDrive !== probe && !probeCapturesEveryLogoutDrive(bareDrive));

  const noRestore = probe.replace('console.error = original; // restored even if the controller throws', '');
  ok('fixture: a capture helper that never restores console.error is flagged',
    noRestore !== probe && !probeRestoresConsoleError(noRestore));

  const leakyCtrl = ctrl.replace(
    "console.error('" + EXPECTED_LOGOUT_DESTROY_LOG + "');",
    "console.error('" + EXPECTED_LOGOUT_DESTROY_LOG + "', err);");
  ok('fixture: interpolating the raw error into the controller log is flagged',
    leakyCtrl !== ctrl && !controllerLogsFixedSanitizedLine(leakyCtrl));

  const extraLog = ctrl.replace(
    "console.error('" + EXPECTED_LOGOUT_DESTROY_LOG + "');",
    "console.error('" + EXPECTED_LOGOUT_DESTROY_LOG + "'); console.error('extra');");
  ok('fixture: a second console.error inside exports.logout is flagged',
    extraLog !== ctrl && !controllerLogsFixedSanitizedLine(extraLog));

  return rec.failures;
}

/* ------------- admin dashboard analytics truthfulness gate (M12.P1-D6) -------

   REPLACES the R8 sample-data disclosure gate. That gate existed because the
   dashboard drew two charts from hard-coded illustrative arrays and the only
   protection available was an on-page notice. D6 removed the arrays, so the
   notice is gone with them and the obligation moved: the numbers must now BE
   real, and must never be faked back.

   Everything this gate expects is pinned HERE, independently of the service,
   the repository, the view, and the focused probe, so no single edit can
   redefine what "truthful" means. The behavioural checks drive the REAL
   service with mocked adapters — no database, no server, no browser — and each
   static detector is exercised against a mutated copy of the real source so a
   silent regression cannot pass.

   What it rejects: a re-fabricated chart array; the mapViews/totalMapViews
   misnomer; any page-view/visit tracking or analytics persistence; a missing or
   extra role category; a month count other than 12 or months out of order; UTC
   or host-local month boundaries instead of Asia/Manila; an inclusive end
   boundary or a double-counted boundary row; an error path that substitutes
   zero for unavailable data; a missing accessible table/description; a chart
   that cannot redraw on resize or theme change; a new public analytics
   endpoint; analytics SQL inside the controller; and any weakening of the
   admin-only or authenticated-no-store behaviour of GET /admin. */

const EXPECTED_D6_TIMEZONE = 'Asia/Manila';
const EXPECTED_D6_MANILA_OFFSET_MINUTES = 480; // UTC+08:00, no DST
const EXPECTED_D6_MONTH_COUNT = 12;
const EXPECTED_D6_ROLE_KEYS = Object.freeze(['student-cspc', 'instructor', 'admin', 'guest']);
const EXPECTED_D6_UNAVAILABLE_MESSAGE = 'Analytics data is unavailable right now.';
const EXPECTED_D6_CLIENT_SCRIPT = '/js/admin/dashboard-analytics.js';
const EXPECTED_D6_THEME_ATTRIBUTE = 'data-theme';
const EXPECTED_D6_PROBE_SCRIPT = 'adminDashboardAnalytics-probe.js';

/* The probe's two markers, pinned here so a static-only run can never be
   mistaken for the ordinary fail-closed run in a transcript. */
const EXPECTED_D6_NORMAL_MARKER = 'ADMIN-DASHBOARD-ANALYTICS-PROBE OK';
const EXPECTED_D6_STATIC_ONLY_MARKER = 'D6-STATIC-ONLY-PROBE OK';
const FORBIDDEN_D6_STATIC_ONLY_FLAG = '--static-only';

/* The four non-colour encodings, and the verified data palette. Both are
   pinned INDEPENDENTLY of the client module and the view, so a coordinated
   edit to those two files cannot redefine what "accessible" means here. */
const EXPECTED_D6_ROLE_PATTERNS = Object.freeze(['solid', 'diagonal', 'crosshatch', 'dots']);
const EXPECTED_D6_PALETTE = Object.freeze({
  light: Object.freeze({
    surface: '#ffffff',
    users: '#1a3a6b',
    buildings: '#8a5a00',
    roles: Object.freeze(['#1a3a6b', '#2563a8', '#8a5a00', '#4b5563']),
  }),
  dark: Object.freeze({
    surface: '#0b1220',
    users: '#8ab4f8',
    buildings: '#f2c14e',
    roles: Object.freeze(['#8ab4f8', '#5eead4', '#f2c14e', '#d1d5db']),
  }),
});
// WCAG minimum for a graphical object / non-text contrast.
const EXPECTED_D6_MIN_CONTRAST = 3;
// A fixed instant so every behavioural D6 assertion is reproducible.
const D6_NOW = Date.UTC(2026, 7, 14, 4, 0, 0);

/** PURE: WCAG 2.x relative luminance of an #rrggbb colour. */
function d6RelativeLuminance(hex) {
  const value = String(hex).trim().replace('#', '');
  const channels = [0, 2, 4].map((i) => {
    const c = parseInt(value.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** PURE: WCAG contrast ratio between two #rrggbb colours. */
function d6ContrastRatio(foreground, background) {
  const a = d6RelativeLuminance(foreground);
  const b = d6RelativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/* Tokens that must not exist anywhere in the dashboard surface. The first two
   are the fabricated series and the KPI misnomer; the last two are the removed
   sample-data furniture, whose return would mean the fabricated charts came
   back with it. */
const FORBIDDEN_D6_TOKENS = Object.freeze([
  'mapViews', 'totalMapViews', 'Sample data', 'admin-chart-sample-note', 'Live preview',
]);

/* Identifier-shaped tracking/persistence tokens. Deliberately identifier-shaped
   so the truthful prose sentence that DENIES tracking cannot trip it. */
const FORBIDDEN_D6_TRACKING =
  /\b(page_?views?|pageview|visit_?count|visit_?log|analytics_events?|analytics_table|trackEvent|trackPageView|sendBeacon)\b/i;

/* Each chart surface and the accessible apparatus it must carry. */
const EXPECTED_D6_CHART_SURFACES = Object.freeze([
  Object.freeze({
    elementId: 'additionsChart', tag: 'canvas',
    headingId: 'additionsChartHeading', descriptionId: 'additionsChartDescription',
    tableId: 'additionsTable', rowAttribute: 'data-month-key', expectedRows: 12,
  }),
  Object.freeze({
    elementId: 'roleChart', tag: 'svg',
    headingId: 'roleChartHeading', descriptionId: 'roleChartDescription',
    tableId: 'roleTable', rowAttribute: 'data-role-key', expectedRows: 4,
  }),
]);

/** PURE: drop JS comments so a detector matches CODE, never its own prose. */
function d6StripJsComments(source) {
  return String(source == null ? '' : source)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** PURE: drop EJS and HTML comments from a template. */
function d6StripViewComments(source) {
  return String(source == null ? '' : source)
    .replace(/<%#[\s\S]*?%>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

/**
 * PURE: does `source` carry a hard-coded chart data series?
 *
 * Shape-based, not word-based: an array of objects that pairs a label with a
 * magnitude, or a value/colour pair — the two forms the removed dashboard
 * arrays actually took.
 */
function d6ContainsFabricatedSeries(source) {
  const code = d6StripJsComments(d6StripViewComments(source));
  return (
    /\{\s*date\s*:\s*['"][A-Za-z]{3}['"]\s*,\s*\w+\s*:\s*\d+/.test(code) ||
    /\{\s*value\s*:\s*\d+\s*,\s*color\s*:\s*['"]#/.test(code) ||
    /\b(?:const|let|var)\s+\w*(?:data|series|roles|activity)\w*\s*=\s*\[\s*\{[\s\S]{0,240}?\d{2,}/i.test(code)
  );
}

/**
 * PURE: is `surface` rendered as an accessible chart with a real table
 * equivalent? Requires the graphic to be programmatically named AND described,
 * and requires a semantic table with a caption, column headers, row headers,
 * and the exact number of keyed data rows.
 */
function d6SurfaceIsAccessible(view, surface) {
  const markup = d6StripViewComments(view);

  const tag = markup.match(new RegExp(
    '<' + surface.tag + '\\b[^>]*\\bid=["\']' + surface.elementId + '["\'][^>]*>', 'i'));
  if (!tag) return false;
  const openTag = tag[0];
  if (!/\brole=["']img["']/i.test(openTag)) return false;
  if (!new RegExp('\\baria-labelledby=["\']' + surface.headingId + '["\']', 'i').test(openTag)) return false;
  if (!new RegExp('\\baria-describedby=["\']' + surface.descriptionId + '["\']', 'i').test(openTag)) return false;

  // The referenced heading and description must actually exist.
  if (!new RegExp('\\bid=["\']' + surface.headingId + '["\']', 'i').test(markup)) return false;
  if (!new RegExp('\\bid=["\']' + surface.descriptionId + '["\']', 'i').test(markup)) return false;

  // The table equivalent, matched as a whole element.
  const table = markup.match(new RegExp(
    '<table\\b[^>]*\\bid=["\']' + surface.tableId + '["\'][^>]*>([\\s\\S]*?)</table>', 'i'));
  if (!table) return false;
  const body = table[1];
  if (!/<caption>/i.test(body)) return false;
  if (!/<th scope="col">/i.test(body)) return false;
  if (!/<th scope="row">/i.test(body)) return false;
  return new RegExp('\\b' + surface.rowAttribute + '=', 'g').test(body);
}

/** PURE: does the client module honour BOTH redraw triggers? */
function d6ClientRedrawProblems(client) {
  const code = d6StripJsComments(client);
  const problems = [];
  if (!/ResizeObserver/.test(code)) problems.push('no ResizeObserver');
  if (!/addEventListener\(\s*['"]resize['"]/.test(code)) problems.push('no resize fallback');
  if (!/MutationObserver/.test(code)) problems.push('no MutationObserver');
  if (!new RegExp("attributeFilter\\s*:\\s*\\[\\s*['\"]" + EXPECTED_D6_THEME_ATTRIBUTE + "['\"]\\s*\\]")
    .test(code)) problems.push('theme attribute is not the observed filter');
  if (!/attributes\s*:\s*true/.test(code)) problems.push('attribute mutations are not observed');
  return problems;
}

/** PURE: does the client module avoid every unsafe DOM/eval construct? */
function d6ClientIsSafe(client) {
  const code = d6StripJsComments(client);
  return !/\binnerHTML\b|\bouterHTML\b|insertAdjacentHTML|\beval\s*\(|document\.write|new Function\(/.test(code);
}

/**
 * PURE: does the dashboard action carry ANALYTICS SQL of its own?
 *
 * Scoped deliberately. The action legitimately still runs the pre-existing
 * recent-user and news-panel reads, so a blanket "no SQL" rule would be false.
 * What must not exist is aggregate or time-bucketed SQL over `users` /
 * `buildings` — the queries D6 moved into the repository layer.
 */
function d6ControllerHasAnalyticsSql(controllerSource) {
  const start = controllerSource.indexOf('exports.index');
  const end = controllerSource.indexOf('exports.users');
  if (start < 0 || end <= start) return true; // unreadable shape fails closed
  const action = d6StripJsComments(controllerSource.slice(start, end));
  return (
    /COUNT\([\s\S]{0,20}\)[\s\S]{0,120}?\bFROM\s+(?:users|buildings)\b/i.test(action) ||
    /\bGROUP\s+BY\b/i.test(action) ||
    /UNIX_TIMESTAMP|FROM_UNIXTIME/i.test(action) ||
    /\bFROM\s+(?:users|buildings)\b[\s\S]{0,160}?\bcreated_at\s*>=/i.test(action)
  );
}

/** PURE: does any route file expose a public analytics endpoint? */
function d6DeclaresAnalyticsEndpoint(routeSource) {
  return /router\.(?:get|post|put|patch|delete)\(\s*['"][^'"]*(analytics|metrics|pageviews|telemetry)/i
    .test(d6StripJsComments(routeSource));
}

/** A repository stand-in whose every method throws. */
function d6ThrowingRepository() {
  const boom = async () => { throw new Error('backend down at db.internal key=SECRET'); };
  return {
    MAX_WINDOW_ROWS: 20000,
    readUserAdditionTimestamps: boom,
    readBuildingAdditionTimestamps: boom,
    countUsersByRole: boom,
    countUsersTotal: boom,
    countBuildingsTotal: boom,
  };
}

/** A repository stand-in that returns a genuine, successful empty backend. */
function d6EmptyRepository() {
  return {
    MAX_WINDOW_ROWS: 20000,
    readUserAdditionTimestamps: async () => ({ timestampsMs: [], capped: false }),
    readBuildingAdditionTimestamps: async () => ({ timestampsMs: [], capped: false }),
    countUsersByRole: async () => ({ 'student-cspc': 0, instructor: 0, admin: 0, guest: 0 }),
    countUsersTotal: async () => 0,
    countBuildingsTotal: async () => 0,
  };
}

/**
 * A repository stand-in that answers correctly EXCEPT for one deliberately
 * malformed value, so the strict acceptance path can be driven case by case.
 */
function d6MalformedRepository(overrides) {
  const spec = overrides || {};
  const roleCounts = spec.roleCounts || { 'student-cspc': 1, instructor: 1, admin: 1, guest: 1 };
  const userTotal = spec.userTotal === undefined ? 4 : spec.userTotal;
  return {
    MAX_WINDOW_ROWS: 20000,
    readUserAdditionTimestamps: async (range) => (spec.userWindow === 'outside'
      ? { timestampsMs: [range.endMs], capped: false }
      : { timestampsMs: [], capped: false }),
    readBuildingAdditionTimestamps: async (range) => (spec.buildingWindow === 'outside'
      ? { timestampsMs: [range.endMs], capped: false }
      : { timestampsMs: [], capped: false }),
    countUsersByRole: async () => roleCounts,
    countUsersTotal: async () => userTotal,
    countBuildingsTotal: async () => (spec.buildingTotal === undefined ? 0 : spec.buildingTotal),
  };
}

async function runAdminDashboardAnalyticsGate() {
  const rec = makeRecorder('admin-dashboard-analytics');
  const { ok } = rec;
  const root = path.join(__dirname, '..');

  const paths = {
    view: path.join(root, 'views', 'admin', 'index.ejs'),
    controller: path.join(root, 'controllers', 'adminController.js'),
    service: path.join(root, 'services', 'adminAnalyticsService.js'),
    repository: path.join(root, 'repositories', 'analyticsRepository.js'),
    client: path.join(root, 'public', 'js', 'admin', 'dashboard-analytics.js'),
    adminRoutes: path.join(root, 'routes', 'admin.js'),
    probe: path.join(root, 'scripts', EXPECTED_D6_PROBE_SCRIPT),
  };
  for (const [label, file] of Object.entries(paths)) {
    ok(`D6 source is present: ${label}`, fs.existsSync(file));
  }
  if (!Object.values(paths).every((file) => fs.existsSync(file))) return rec.failures;

  const view = fs.readFileSync(paths.view, 'utf8');
  const controller = fs.readFileSync(paths.controller, 'utf8');
  const service = fs.readFileSync(paths.service, 'utf8');
  const repository = fs.readFileSync(paths.repository, 'utf8');
  const client = fs.readFileSync(paths.client, 'utf8');
  const adminRoutes = fs.readFileSync(paths.adminRoutes, 'utf8');

  /* ---- 1. behavioural: the REAL service, driven with mocked adapters ---- */
  const analytics = require('../services/adminAnalyticsService');

  ok(`the service reports the ${EXPECTED_D6_TIMEZONE} timezone and its fixed offset`,
    analytics.TIMEZONE === EXPECTED_D6_TIMEZONE &&
    analytics.MANILA_UTC_OFFSET_MINUTES === EXPECTED_D6_MANILA_OFFSET_MINUTES);
  ok(`the service reports exactly the ${EXPECTED_D6_ROLE_KEYS.length} pinned roles, in order`,
    Array.isArray(analytics.ROLE_KEYS) &&
    analytics.ROLE_KEYS.length === EXPECTED_D6_ROLE_KEYS.length &&
    analytics.ROLE_KEYS.every((r, i) => r === EXPECTED_D6_ROLE_KEYS[i]));

  const windows = analytics.buildMonthWindows(Date.UTC(2026, 7, 14, 4, 0, 0));
  ok(`exactly ${EXPECTED_D6_MONTH_COUNT} month windows are produced, strictly ordered`,
    windows.length === EXPECTED_D6_MONTH_COUNT &&
    windows.every((w, i) => i === 0 || w.startMs > windows[i - 1].startMs));
  ok('month windows are Asia/Manila, not UTC and not host-local',
    windows.every((w) => {
      // A Manila month begins at 16:00 UTC on the last day of the previous month.
      const start = new Date(w.startMs);
      return start.getUTCHours() === 16 && start.getUTCMinutes() === 0;
    }) &&
    windows[EXPECTED_D6_MONTH_COUNT - 1].key === '2026-08');
  ok('windows tile exactly: each end is the next start (no gap, no overlap)',
    windows.every((w, i) => i === 0 || w.startMs === windows[i - 1].endMs));
  ok('year rollover and leap-year February are exact',
    (() => {
      const jan = analytics.buildMonthWindows(Date.UTC(2026, 0, 15, 4, 0, 0));
      const leap = analytics.buildMonthWindows(Date.UTC(2024, 1, 20, 4, 0, 0));
      const day = 24 * 60 * 60 * 1000;
      return jan[0].key === '2025-02' && jan[11].key === '2026-01' &&
        leap[11].key === '2024-02' && (leap[11].endMs - leap[11].startMs) === 29 * day;
    })());

  ok('the month boundary is HALF-OPEN: start included, end excluded, counted once',
    (() => {
      const onStart = analytics.bucketByMonth([windows[5].startMs], windows);
      const onEnd = analytics.bucketByMonth([windows[5].endMs], windows);
      return onStart.counts[5] === 1 && onStart.counts[4] === 0 &&
        onEnd.counts[5] === 0 && onEnd.counts[6] === 1 &&
        onEnd.counts.reduce((s, n) => s + n, 0) === 1;
    })());
  ok('an invalid stored timestamp is reported, never silently dropped',
    (() => {
      const r = analytics.bucketByMonth(['not-a-date'], windows);
      return r.invalid === 1 && r.counts.every((n) => n === 0);
    })());

  const emptyModel = await analytics.loadAdminDashboardAnalytics({
    now: Date.UTC(2026, 7, 14, 4, 0, 0), repository: d6EmptyRepository(),
  });
  ok('a genuine empty backend reports real zeroes with state "ready"',
    emptyModel.state === 'ready' && emptyModel.isZero === true && emptyModel.message === null &&
    emptyModel.months.length === EXPECTED_D6_MONTH_COUNT &&
    emptyModel.months.every((m) => m.userAdditions === 0 && m.buildingAdditions === 0) &&
    emptyModel.totals.users === 0 && emptyModel.totals.buildings === 0);

  const brokenModel = await analytics.loadAdminDashboardAnalytics({
    now: Date.UTC(2026, 7, 14, 4, 0, 0), repository: d6ThrowingRepository(),
  });
  ok('a failed read NEVER becomes zero — every value is null and state is "unavailable"',
    brokenModel.state === 'unavailable' && brokenModel.isZero === false &&
    brokenModel.months.length === EXPECTED_D6_MONTH_COUNT &&
    brokenModel.months.every((m) => m.userAdditions === null && m.buildingAdditions === null) &&
    brokenModel.totals.users === null && brokenModel.totals.buildings === null &&
    EXPECTED_D6_ROLE_KEYS.every((r) => brokenModel.roleCounts[r] === null));
  ok('the unavailable message is exactly the pinned sanitized string',
    brokenModel.message === EXPECTED_D6_UNAVAILABLE_MESSAGE);
  ok('no raw error, host, key, or SQL reaches the failed model',
    !/db\.internal|SECRET|backend down|Error:|SELECT /i.test(JSON.stringify(brokenModel)));
  ok('the model always carries exactly the four role keys, ready or not',
    Object.keys(emptyModel.roleCounts).length === EXPECTED_D6_ROLE_KEYS.length &&
    Object.keys(brokenModel.roleCounts).length === EXPECTED_D6_ROLE_KEYS.length &&
    EXPECTED_D6_ROLE_KEYS.every((r) =>
      Object.prototype.hasOwnProperty.call(emptyModel.roleCounts, r) &&
      Object.prototype.hasOwnProperty.call(brokenModel.roleCounts, r)));

  /* ---- 1b. strict count acceptance: nothing malformed may become a zero ---- */
  const parseCount = analytics.parseExactCount;
  ok('the service and repository share ONE exact count parser',
    typeof parseCount === 'function' &&
    parseCount === require('../repositories/analyticsRepository').parseExactCount);
  ok('the exact count parser accepts only nonnegative safe integers and digit strings',
    parseCount(0) === 0 && parseCount(21) === 21 && parseCount('21') === 21 &&
    parseCount(Number.MAX_SAFE_INTEGER) === Number.MAX_SAFE_INTEGER);
  ok('the exact count parser rejects every malformed shape, and never returns 0 for one',
    [null, undefined, true, false, '', '  ', -1, '-1', 1.5, '1.5', NaN, Infinity,
      'twelve', '1e3', '0x10', ' 12 ', Number.MAX_SAFE_INTEGER + 1,
      String(Number.MAX_SAFE_INTEGER + 2), {}, []]
      .every((value) => parseCount(value) === null));
  ok('the strict role parser requires EXACTLY the four keys with exact values',
    (() => {
      const good = analytics.parseRoleCounts({ 'student-cspc': 1, instructor: 2, admin: 3, guest: 4 });
      return good !== null && Object.keys(good).length === 4 && good.guest === 4;
    })());
  ok('the strict role parser rejects a missing key, an extra key, and every bad value',
    [
      { 'student-cspc': 1, instructor: 1, admin: 1 },
      { 'student-cspc': 1, instructor: 1, admin: 1, guest: 1, 'student-guest': 1 },
      { 'student-cspc': -1, instructor: 1, admin: 1, guest: 1 },
      { 'student-cspc': 1.5, instructor: 1, admin: 1, guest: 1 },
      { 'student-cspc': 'x', instructor: 1, admin: 1, guest: 1 },
      { 'student-cspc': Number.MAX_SAFE_INTEGER + 1, instructor: 1, admin: 1, guest: 1 },
      null, 'nope', [],
    ].every((value) => analytics.parseRoleCounts(value) === null));
  ok('the four role counts must SUM to the total user count',
    analytics.roleCountsMatchTotal({ 'student-cspc': 1, instructor: 1, admin: 1, guest: 1 }, 4) === true &&
    analytics.roleCountsMatchTotal({ 'student-cspc': 1, instructor: 1, admin: 1, guest: 1 }, 5) === false &&
    analytics.roleCountsMatchTotal({ 'student-cspc': 1, instructor: 1, admin: 1, guest: 1 }, 3) === false);
  ok('a bucket result with any invalid OR any out-of-window row is unusable',
    (() => {
      const windows = analytics.buildMonthWindows(D6_NOW);
      return analytics.bucketResultIsUsable(analytics.bucketByMonth([windows[2].startMs], windows)) === true &&
        analytics.bucketResultIsUsable(analytics.bucketByMonth(['bad'], windows)) === false &&
        analytics.bucketResultIsUsable(analytics.bucketByMonth([windows[11].endMs], windows)) === false;
    })());

  const malformedCases = [
    ['a MISSING role key', { roleCounts: { 'student-cspc': 1, instructor: 1, admin: 1 }, userTotal: 3 }],
    ['an ADDITIONAL role key', { roleCounts: { 'student-cspc': 1, instructor: 1, admin: 1, guest: 1, 'student-guest': 2 }, userTotal: 6 }],
    ['a NEGATIVE role count', { roleCounts: { 'student-cspc': -1, instructor: 1, admin: 1, guest: 1 }, userTotal: 2 }],
    ['a FRACTIONAL role count', { roleCounts: { 'student-cspc': 1.5, instructor: 1, admin: 1, guest: 1 }, userTotal: 5 }],
    ['a NON-NUMERIC role count', { roleCounts: { 'student-cspc': 'x', instructor: 1, admin: 1, guest: 1 }, userTotal: 4 }],
    ['an UNSAFE role count', { roleCounts: { 'student-cspc': Number.MAX_SAFE_INTEGER + 1, instructor: 0, admin: 0, guest: 0 }, userTotal: 1 }],
    ['an INVALID user total', { userTotal: -4 }],
    ['a role/total MISMATCH', { userTotal: 99 }],
    ['a row OUTSIDE the requested window', { userWindow: 'outside' }],
  ];
  for (const [label, spec] of malformedCases) {
    /* eslint-disable no-await-in-loop */
    const model = await analytics.loadAdminDashboardAnalytics({
      now: D6_NOW, repository: d6MalformedRepository(spec),
    });
    ok(`${label} makes the users side unavailable with nulls, never zeroes`,
      model.status.users === 'unavailable' && model.state !== 'ready' &&
      model.totals.users === null &&
      model.months.every((m) => m.userAdditions === null) &&
      EXPECTED_D6_ROLE_KEYS.every((r) => model.roleCounts[r] === null));
    /* eslint-enable no-await-in-loop */
  }
  {
    const badBuildings = await analytics.loadAdminDashboardAnalytics({
      now: D6_NOW, repository: d6MalformedRepository({ buildingTotal: 'many' }),
    });
    ok('an INVALID building total makes the buildings side unavailable',
      badBuildings.status.buildings === 'unavailable' &&
      badBuildings.totals.buildings === null && badBuildings.state !== 'ready');
    const outsideBuildings = await analytics.loadAdminDashboardAnalytics({
      now: D6_NOW, repository: d6MalformedRepository({ buildingWindow: 'outside' }),
    });
    ok('an out-of-window BUILDING row makes the buildings side unavailable',
      outsideBuildings.status.buildings === 'unavailable' && outsideBuildings.state !== 'ready');
  }
  ok('no permissive `Number(...) || 0` coercion remains in the D6 repository or service',
    !/Number\s*\([^)]*\)\s*\|\|\s*0/.test(d6StripJsComments(repository)) &&
    !/Number\s*\([^)]*\)\s*\|\|\s*0/.test(d6StripJsComments(service)));
  ok('the repository rejects an unreported role instead of discarding it',
    /an unreported role was returned/.test(repository));
  ok('the repository builds no backend at import time (deferred pool and client)',
    !/^const\s+db\s*=\s*require\(/m.test(d6StripJsComments(repository)) &&
    /function mysqlPool\(\)/.test(repository) && /function supabaseClient\(\)/.test(repository));

  /* ---- 2. static: nothing fabricated survives ---- */
  for (const token of FORBIDDEN_D6_TOKENS) {
    ok(`the forbidden token "${token}" appears in neither the controller nor the view`,
      !controller.includes(token) && !view.includes(token));
  }
  ok('no hard-coded chart series survives in the view, controller, or client module',
    !d6ContainsFabricatedSeries(view) && !d6ContainsFabricatedSeries(controller) &&
    !d6ContainsFabricatedSeries(client));
  ok('no page-view/visit tracking or analytics persistence exists in the D6 source',
    ![service, repository, client].some((src) => FORBIDDEN_D6_TRACKING.test(d6StripJsComments(src))) &&
    !FORBIDDEN_D6_TRACKING.test(d6StripJsComments(controller)));
  ok('the analytics repository is SELECT-only (no write verb, DDL, or RPC)',
    (() => {
      const code = d6StripJsComments(repository);
      return !/\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|TRUNCATE|DROP\s+TABLE)\b/i.test(code) &&
        !/\.rpc\(|\.insert\(|\.upsert\(|\.delete\(/.test(code);
    })());
  ok('the repository pins the same four roles independently of the service',
    (() => {
      const repoKeys = require('../repositories/analyticsRepository').ANALYTICS_ROLE_KEYS;
      return Array.isArray(repoKeys) && repoKeys.length === EXPECTED_D6_ROLE_KEYS.length &&
        repoKeys.every((r, i) => r === EXPECTED_D6_ROLE_KEYS[i]);
    })());
  ok('the two data sources are selected independently (AUTH vs BUILDING)',
    /authDataSource\.isSupabase\(\)/.test(repository) &&
    /mapRuntime\.isBuildingSupabase\(\)/.test(repository));

  /* ---- 3. static: the dashboard stays admin-only, no-store, and SQL-free ---- */
  ok('the dashboard action contains no analytics SQL', !d6ControllerHasAnalyticsSql(controller));
  ok('GET /admin stays behind requireRole(\'admin\') declared before the route',
    (() => {
      const guard = adminRoutes.indexOf("router.use(requireRole('admin'))");
      const route = adminRoutes.search(/router\.get\('\/',\s*adminController\.index\)/);
      return guard >= 0 && route > guard;
    })());
  ok('the authenticated-HTML no-store policy is still applied',
    (() => {
      const middleware = path.join(root, 'middleware', 'authenticatedHtmlNoStore.js');
      const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
      return fs.existsSync(middleware) &&
        /no-store,\s*private/.test(fs.readFileSync(middleware, 'utf8')) &&
        /authenticatedHtmlNoStore/.test(server);
    })());
  ok('no route file declares a public analytics/metrics/telemetry endpoint',
    fs.readdirSync(path.join(root, 'routes')).filter((f) => f.endsWith('.js'))
      .every((f) => !d6DeclaresAnalyticsEndpoint(fs.readFileSync(path.join(root, 'routes', f), 'utf8'))));

  /* ---- 4. static: accessibility and the table equivalents ---- */
  for (const surface of EXPECTED_D6_CHART_SURFACES) {
    ok(`#${surface.elementId} is an accessible chart with a semantic table equivalent`,
      d6SurfaceIsAccessible(view, surface));
  }
  ok('the view renders the SERVER-supplied timezone and unavailable message, not literals',
    /analytics\.timezone/.test(view) && /analytics\.message/.test(view) &&
    !view.includes("'" + EXPECTED_D6_TIMEZONE + "'") &&
    !view.includes('"' + EXPECTED_D6_UNAVAILABLE_MESSAGE + '"'));
  ok('the KPI tiles no longer coerce a missing value to zero',
    !/stats\.total\w+\s*\|\|\s*0/.test(view));
  ok('the chart module is loaded as a deferred same-origin script, exactly once',
    (view.match(new RegExp('<script src="' + EXPECTED_D6_CLIENT_SCRIPT + '"', 'g')) || []).length === 1 &&
    new RegExp('<script src="' + EXPECTED_D6_CLIENT_SCRIPT + '" defer>').test(view));
  ok('no inline script body carries a server interpolation (no executable inline data)',
    (() => {
      const markup = d6StripViewComments(view);
      const blocks = markup.match(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi) || [];
      let inline = 0;
      for (const block of blocks) {
        const open = block.slice(0, block.indexOf('>') + 1);
        if (/\bsrc=/i.test(open)) continue;
        inline += 1;
        if (/<%/.test(block.slice(open.length, block.lastIndexOf('</script')))) return false;
      }
      return inline >= 1;
    })());

  /* ---- 5. static: the client redraw and safety contracts ---- */
  ok('the client module redraws on container resize and on data-theme change',
    d6ClientRedrawProblems(client).length === 0);
  ok('the client module uses no innerHTML, eval, document.write, or Function',
    d6ClientIsSafe(client));
  ok('the client module reads its values from the rendered table, not from injected data',
    /getAttribute\(['"]data-value['"]\)/.test(client) && !/JSON\.parse\(/.test(d6StripJsComments(client)));

  /* ---- 6. the focused probe is registered, and is FAIL-CLOSED ---- */
  const probeSource = fs.readFileSync(paths.probe, 'utf8');
  const probeModule = require('./' + EXPECTED_D6_PROBE_SCRIPT);

  ok('the D6 focused probe is registered in the executed spawned-probe plan',
    flattenStagePlan(SPAWNED_PROBE_STAGES).includes(EXPECTED_D6_PROBE_SCRIPT));
  ok('the D6 focused probe authenticates nobody (no canonical login path)',
    !/require\(['"]\.\/regressionCredentials['"]\)/.test(probeSource) &&
    !/['"]\/login['"]/.test(probeSource));

  /* The registered stage must spawn the ORDINARY fail-closed mode. A stage that
     passed --static-only would run the pure sections only and still exit 0,
     which is exactly the false-green this gate exists to prevent. */
  ok('the registered stage spawns the ORDINARY probe, never the static-only path',
    (() => {
      const stage = SPAWNED_PROBE_STAGES.find((s) =>
        (s.probes || []).some((entry) => Array.isArray(entry) && entry[1] === EXPECTED_D6_PROBE_SCRIPT));
      if (!stage) return false;
      return stage.probes.every((entry) =>
        !String(entry[1]).includes(FORBIDDEN_D6_STATIC_ONLY_FLAG) &&
        !String(entry[0]).includes(FORBIDDEN_D6_STATIC_ONLY_FLAG));
    })() && !new RegExp(EXPECTED_D6_PROBE_SCRIPT + "[^\\n]*" + FORBIDDEN_D6_STATIC_ONLY_FLAG)
      .test(fs.readFileSync(__filename, 'utf8')));

  ok('the static-only marker is distinct from the ordinary success marker',
    probeModule.STATIC_ONLY_SUCCESS_MARKER === EXPECTED_D6_STATIC_ONLY_MARKER &&
    probeModule.NORMAL_SUCCESS_MARKER === EXPECTED_D6_NORMAL_MARKER &&
    !EXPECTED_D6_STATIC_ONLY_MARKER.includes(EXPECTED_D6_NORMAL_MARKER) &&
    !EXPECTED_D6_NORMAL_MARKER.includes(EXPECTED_D6_STATIC_ONLY_MARKER));

  // The pure disposition contract: BOTH backends are required in normal mode.
  const disposition = (extra) => probeModule.resolveBackendDisposition(
    Object.assign({ mode: probeModule.MODE_NORMAL, backend: 'mysql' }, extra));
  ok('a required, configured, reachable backend leg EXECUTES',
    disposition({ configured: true, reachable: true }).action === 'execute');
  ok('an UNREACHABLE required backend leg is REJECTED, not skipped',
    disposition({ configured: true, reachable: false }).action === 'reject');
  ok('an UNCONFIGURED required backend leg is REJECTED',
    disposition({ configured: false, reachable: true }).action === 'reject');
  ok('a SKIP REQUEST in normal mode is REJECTED (PROBE_SKIP_* cannot buy a pass)',
    disposition({ configured: true, reachable: true, skipRequested: true }).action === 'reject');
  ok('a missing reachability or configuration flag fails closed',
    disposition({}).action === 'reject' &&
    disposition({ configured: true }).action === 'reject');
  ok('only BOTH distinct backends executing makes the ordinary run successful',
    probeModule.normalSuccessAllowed([
      { backend: 'mysql', action: 'execute', executed: true },
      { backend: 'supabase', action: 'execute', executed: true },
    ]) === true &&
    probeModule.normalSuccessAllowed([
      { backend: 'mysql', action: 'execute', executed: true },
      { backend: 'supabase', action: 'reject', executed: false },
    ]) === false &&
    probeModule.normalSuccessAllowed([
      { backend: 'mysql', action: 'execute', executed: true },
      { backend: 'mysql', action: 'execute', executed: true },
    ]) === false &&
    probeModule.normalSuccessAllowed([]) === false);
  ok('the probe wires those helpers into its real run and treats a skip as a request',
    /normalSuccessAllowed\(legs\)/.test(probeSource) &&
    /skipRequested:\s*String\(process\.env\.PROBE_SKIP_SUPABASE/.test(probeSource) &&
    /This is a FAILURE, not a skip/.test(probeSource));

  /* ---- 7. deterministic Supabase pagination ---- */
  const repoCode = d6StripJsComments(repository);
  const d6HasCompositeOrder = (src) =>
    /\.order\('created_at',\s*\{\s*ascending:\s*true\s*\}\)[\s\S]{0,80}\.order\('id',\s*\{\s*ascending:\s*true\s*\}\)/.test(src);
  const d6HasPagination = (src) => /\.range\(offset,\s*offset \+ pageSize - 1\)/.test(src);
  const d6HasCeiling = (src) => /while \(offset < range\.limit\)/.test(src) && /SUPABASE_PAGE_SIZE/.test(src);

  ok('Supabase timestamp reads select id alongside created_at',
    /\.select\('id, created_at'\)/.test(repoCode));
  ok('Supabase paging orders by created_at ASC then id ASC (stable total order)',
    d6HasCompositeOrder(repoCode));
  ok('Supabase paging is bounded and page-wise, not one large limit',
    d6HasPagination(repoCode) && d6HasCeiling(repoCode) && !/\.limit\(/.test(repoCode));
  ok('the id is internal: the public reader returns only timestamps and the cap flag',
    (() => {
      const parts = [...repoCode.matchAll(/return \{ timestampsMs, capped[^}]*\}/g)];
      return parts.length >= 2 && parts.every((m) => !/\bids?\b/.test(m[0]));
    })());
  ok('fixture: removing the secondary id ordering is detected',
    !d6HasCompositeOrder(repoCode.replace(/\.order\('id',\s*\{\s*ascending:\s*true\s*\}\)/, '')));
  ok('fixture: replacing pagination with one large limit is detected',
    !d6HasPagination(repoCode.replace(/\.range\(offset,\s*offset \+ pageSize - 1\)/, '.limit(20000)')));
  ok('fixture: removing the page ceiling is detected',
    !d6HasCeiling(repoCode.replace(/while \(offset < range\.limit\)/, 'while (true)')));
  ok('the independent comparison also pages with the same composite ordering',
    /independentSupabasePage/.test(probeSource) &&
    d6HasCompositeOrder(d6StripJsComments(probeSource)) &&
    /\.range\(offset,\s*offset \+ size - 1\)/.test(probeSource));

  /* ---- 8. chart colour contrast and non-colour encoding ---- */
  const clientPalette = require('../public/js/admin/dashboard-analytics.js').ANALYTICS_PALETTE;
  const clientPatterns = require('../public/js/admin/dashboard-analytics.js').ROLE_PATTERNS;

  ok('the client palette matches this gate\'s independent pin for BOTH themes',
    ['light', 'dark'].every((theme) => {
      const expected = EXPECTED_D6_PALETTE[theme];
      const actual = clientPalette[theme];
      return actual && actual.surface === expected.surface &&
        actual.users === expected.users && actual.buildings === expected.buildings &&
        actual.roles.length === 4 &&
        actual.roles.every((c, i) => c === expected.roles[i]);
    }));
  ok(`every pinned data colour clears ${EXPECTED_D6_MIN_CONTRAST}:1 against its own surface`,
    ['light', 'dark'].every((theme) => {
      const set = EXPECTED_D6_PALETTE[theme];
      return [set.users, set.buildings].concat(set.roles)
        .every((color) => d6ContrastRatio(color, set.surface) >= EXPECTED_D6_MIN_CONTRAST);
    }));
  ok('the four role colours are distinct within each theme',
    new Set(EXPECTED_D6_PALETTE.light.roles).size === 4 &&
    new Set(EXPECTED_D6_PALETTE.dark.roles).size === 4);
  ok('fixture: a low-contrast colour would be rejected by the same measurement',
    d6ContrastRatio('#d4a843', '#ffffff') < EXPECTED_D6_MIN_CONTRAST &&
    d6ContrastRatio('#ffffff', '#ffffff') < EXPECTED_D6_MIN_CONTRAST);

  ok('the view declares the analytics tokens for both themes, matching the pin',
    (() => {
      const tokenValue = (block, name) => {
        const match = block.match(new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{6})'));
        return match ? match[1].toLowerCase() : null;
      };
      const blocks = {
        light: (view.match(/:root\s*\{[\s\S]*?\}/) || [''])[0],
        dark: (view.match(/\[data-theme="dark"\]\s*\{[\s\S]*?\}/) || [''])[0],
      };
      return ['light', 'dark'].every((theme) => {
        const set = EXPECTED_D6_PALETTE[theme];
        const block = blocks[theme];
        return tokenValue(block, 'analytics-surface') === set.surface &&
          tokenValue(block, 'analytics-users') === set.users &&
          tokenValue(block, 'analytics-buildings') === set.buildings &&
          set.roles.every((color, i) => tokenValue(block, 'analytics-role-' + (i + 1)) === color);
      });
    })());
  ok('the client prefers those page tokens over its built-in copy',
    /getComputedStyle/.test(client) && /--analytics-role-/.test(client));

  ok('exactly four distinct non-colour encodings are declared and pinned',
    Array.isArray(clientPatterns) && clientPatterns.length === 4 &&
    clientPatterns.join(',') === EXPECTED_D6_ROLE_PATTERNS.join(','));
  ok('the donut fills every segment from its own pattern, not a flat colour',
    /fill', 'url\(#' \+ rolePatternId\(i\) \+ '\)'/.test(client) &&
    !/setAttribute\('fill',\s*palette\.roles\[/.test(client));
  ok('the legend renders four swatches carrying the same four pattern kinds',
    (() => {
      const kinds = [...view.matchAll(/rolePatternKinds\s*=\s*\[([^\]]*)\]/g)]
        .map((m) => m[1].replace(/['\s]/g, ''));
      return kinds.length === 1 && kinds[0] === EXPECTED_D6_ROLE_PATTERNS.join(',') &&
        /fill="url\(#<%= pid %>\)"/.test(view) &&
        /var\(--analytics-role-<%= i \+ 1 %>\)/.test(view);
    })());
  ok('legend label text is neutral: no gold tint and no inlined data hex',
    !/#d4a843/.test(view) &&
    !/admin-analytics-shape/.test(view) &&
    !/class="admin-analytics-legend-text"[^>]*style="[^"]*color/i.test(view));
  ok('the semantic role table remains the non-JavaScript, screen-reader alternative',
    /<table class="admin-analytics-table" id="roleTable">/.test(view) &&
    /data-role-key="/.test(view));
  ok('the monthly series keeps its line/marker distinction, named in legend text',
    /stroke-dasharray="6 4"/.test(view) &&
    /solid line, round marker/.test(view) && /dashed line, square marker/.test(view));

  /* ---- 7. rejecting fixtures: every detector must flag a mutated real source -- */
  const fabricated = view.replace('<tbody>',
    "<tbody><script>const activityData = [{ date: 'Jan', users: 400 }];</script>");
  ok('fixture: a reintroduced { date, users } chart array is flagged',
    fabricated !== view && d6ContainsFabricatedSeries(fabricated));
  ok('fixture: a reintroduced { value, color } donut array is flagged',
    d6ContainsFabricatedSeries("const roles = [{ value: 1845, color: '#1a3a6b' }];"));
  ok('fixture: the untouched real view carries no fabricated series (accepting control)',
    !d6ContainsFabricatedSeries(view));

  ok('fixture: a chart that loses its aria-describedby is flagged',
    (() => {
      const surface = EXPECTED_D6_CHART_SURFACES[0];
      const mutated = view.replace(
        new RegExp('\\s*aria-describedby="' + surface.descriptionId + '"'), '');
      return mutated !== view && !d6SurfaceIsAccessible(mutated, surface);
    })());
  ok('fixture: a chart whose table equivalent is removed is flagged',
    (() => {
      const surface = EXPECTED_D6_CHART_SURFACES[1];
      const mutated = view.replace('id="' + surface.tableId + '"', 'id="' + surface.tableId + '-gone"');
      return mutated !== view && !d6SurfaceIsAccessible(mutated, surface);
    })());
  ok('fixture: a table that loses its caption or row headers is flagged',
    (() => {
      const surface = EXPECTED_D6_CHART_SURFACES[0];
      const noCaption = view.replace(/<caption>/g, '<div>').replace(/<\/caption>/g, '</div>');
      const noRowHeaders = view.replace(/<th scope="row">/g, '<td>');
      return !d6SurfaceIsAccessible(noCaption, surface) && !d6SurfaceIsAccessible(noRowHeaders, surface);
    })());
  ok('fixture: the untouched real view passes both accessibility detectors (accepting control)',
    EXPECTED_D6_CHART_SURFACES.every((s) => d6SurfaceIsAccessible(view, s)));

  ok('fixture: a client module without a ResizeObserver is flagged',
    d6ClientRedrawProblems(client.replace(/ResizeObserver/g, 'IdleObserver')).length > 0);
  ok('fixture: a client module that stops watching data-theme is flagged',
    d6ClientRedrawProblems(client.replace(/attributeFilter: \['data-theme'\]/, "attributeFilter: ['class']"))
      .length > 0);
  ok('fixture: a client module using innerHTML is flagged',
    !d6ClientIsSafe(client + '\nnode.innerHTML = value;'));
  ok('fixture: the untouched real client module passes both detectors (accepting control)',
    d6ClientRedrawProblems(client).length === 0 && d6ClientIsSafe(client));

  ok('fixture: analytics SQL moved back into the dashboard action is flagged',
    d6ControllerHasAnalyticsSql(controller.replace(
      'const analytics = await adminAnalyticsService.loadAdminDashboardAnalytics',
      "await db.query('SELECT COUNT(*) FROM users');\n  const analytics = await adminAnalyticsService.loadAdminDashboardAnalytics")));
  ok('fixture: a public analytics endpoint is flagged',
    d6DeclaresAnalyticsEndpoint("router.get('/api/analytics', handler);") &&
    !d6DeclaresAnalyticsEndpoint("router.get('/api/buildings', handler);"));
  ok('fixture: an error path that substitutes zero would be flagged',
    (() => {
      // The real contract: unavailable means null. A model that reported 0 for a
      // failed read must be recognisably different from the genuine-zero model.
      const fabricatedZero = JSON.parse(JSON.stringify(brokenModel));
      fabricatedZero.months.forEach((m) => { m.userAdditions = 0; m.buildingAdditions = 0; });
      return brokenModel.months.every((m) => m.userAdditions === null) &&
        fabricatedZero.months.every((m) => m.userAdditions === 0) &&
        emptyModel.state === 'ready' && brokenModel.state === 'unavailable';
    })());
  ok('fixture: an extra or missing role category is flagged',
    (() => {
      const extra = EXPECTED_D6_ROLE_KEYS.concat('student-guest');
      const missing = EXPECTED_D6_ROLE_KEYS.slice(0, 3);
      const matches = (keys) => keys.length === EXPECTED_D6_ROLE_KEYS.length &&
        keys.every((r, i) => r === EXPECTED_D6_ROLE_KEYS[i]);
      return !matches(extra) && !matches(missing) && matches(analytics.ROLE_KEYS);
    })());
  ok('fixture: a month count other than 12 is flagged',
    (() => {
      const six = analytics.buildMonthWindows(Date.UTC(2026, 7, 14, 4, 0, 0), 6);
      return six.length === 6 && six.length !== EXPECTED_D6_MONTH_COUNT &&
        windows.length === EXPECTED_D6_MONTH_COUNT;
    })());
  ok('fixture: UTC month boundaries are recognisably different from Manila ones',
    (() => {
      // A UTC implementation would place the boundary at 00:00 UTC.
      const utcStart = Date.UTC(2026, 7, 1, 0, 0, 0);
      return windows[EXPECTED_D6_MONTH_COUNT - 1].startMs !== utcStart &&
        (utcStart - windows[EXPECTED_D6_MONTH_COUNT - 1].startMs) ===
          EXPECTED_D6_MANILA_OFFSET_MINUTES * 60000;
    })());
  ok('fixture: an inclusive end boundary would double-count, and does not',
    (() => {
      const boundary = windows[3].endMs;
      const counts = analytics.bucketByMonth([boundary], windows).counts;
      return counts.reduce((s, n) => s + n, 0) === 1 && counts[4] === 1 && counts[3] === 0;
    })());

  return rec.failures;
}

/* ------- static "sample 360" scratch-dir exposure hardening gate (L5) ------- */
function runSample360Gate() {
  const rec = makeRecorder('sample-360');
  const { ok } = rec;
  const root = path.join(__dirname, '..');
  const readIf = (rel) => { const p = path.join(root, rel); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; };
  const dockerignore = readIf('.dockerignore');
  const gitignore = readIf('.gitignore');
  const serverSrc = readIf('server.js');

  // L5: the local scratch panorama dir must be excluded from the Docker build
  // context AND from git, and must not be publicly served.
  ok('.dockerignore excludes public/img/sample 360/', /public\/img\/sample 360\//.test(dockerignore));
  ok('.gitignore excludes public/img/sample 360/', /public\/img\/sample 360\//.test(gitignore));

  const denyIdx = serverSrc.indexOf('/img/sample 360/');
  const staticIdx = serverSrc.indexOf("express.static(path.join(__dirname, 'public')");
  ok('server.js has a sample-360 deny check', denyIdx !== -1);
  ok('sample-360 deny runs BEFORE express.static', denyIdx !== -1 && staticIdx !== -1 && denyIdx < staticIdx);

  return rec.failures;
}

/* ------------- static local DB-dump exposure hardening gate (L6) ------------- */
function runDbDumpGate() {
  const rec = makeRecorder('db-dump');
  const { ok } = rec;
  const root = path.join(__dirname, '..');
  const readIf = (rel) => { const p = path.join(root, rel); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; };
  const gLines = readIf('.gitignore').split(/\r?\n/).map((l) => l.trim());
  const dLines = readIf('.dockerignore').split(/\r?\n/).map((l) => l.trim());

  // L6: the local DB dump (real users/bcrypt hashes/OAuth subjects) must be
  // git-ignored so a broad `git add` cannot commit it...
  ok('.gitignore ignores database/campusphere_db.sql', gLines.includes('database/campusphere_db.sql'));

  // ...via a NARROW rule only. A broad SQL glob would make schema.sql or the
  // Supabase migrations untrackable, so those must be absent from .gitignore.
  const gitBroad = ['database/*.sql', '*.sql', 'database/**/*.sql', 'database/', 'database/supabase/', 'database/supabase'];
  ok('.gitignore has no broad database SQL ignore', !gLines.some((l) => gitBroad.includes(l)));

  // .dockerignore must still exclude local DB dumps while re-including schema.sql
  // and leaving the Supabase migrations available for the explicit Dockerfile copy.
  ok('.dockerignore excludes database dumps (database/*.sql)', dLines.includes('database/*.sql'));
  ok('.dockerignore re-includes database/schema.sql', dLines.includes('!database/schema.sql'));
  ok('.dockerignore does not drop the Supabase migrations',
    !dLines.some((l) => ['*.sql', 'database/', 'database/supabase/', 'database/supabase'].includes(l)));

  return rec.failures;
}

/* =================== M12.P1-R8 pilot readiness gate ===========================

   The R8 read-only review found pilot-readiness blockers that no existing gate
   covered, because every prior gate audited behaviour that EXISTS. These audit
   things that must NOT exist (dead placeholder links, an unindexed-by-accident
   public pilot) and things that must exist but had no owner (a privacy notice).

   Every expectation is pinned HERE, independently of the views and routes being
   audited, and every detector is exercised against a rejecting fixture built at
   runtime from the real source. Static and database-free; the live HTTP
   behaviour is asserted separately in the runtime contract section.

   Scope note: this gate proves SOURCE SHAPE and DOCUMENTATION TRUTH. It cannot
   and does not prove access control — /privacy is deliberately anonymous, and
   the indexing directives it checks are voluntary crawler hints, not a
   security boundary. */

const EXPECTED_PRIVACY_ROUTE = '/privacy';
const EXPECTED_ROBOTS_TAG_VALUE = 'noindex, nofollow, noarchive';
const EXPECTED_ROBOTS_TXT = 'User-agent: *\nDisallow: /';
const EXPECTED_CSPC_POLICY_URL = 'https://cspc.edu.ph/governance/privacy-policy/';
const EXPECTED_CSPC_SITE_URL = 'https://cspc.edu.ph/';

// Views that must expose a working link to the privacy notice. The anonymous
// footer covers the landing page; the two auth surfaces cover the moment a
// participant is actually asked for personal data.
const PRIVACY_LINK_VIEWS = Object.freeze([
  'views/partials/footer.ejs',
  'views/auth.ejs',
  'views/complete-registration.ejs',
]);

/** PURE: does this EJS source link to /privacy with a real href? */
function linksToPrivacy(src) {
  return typeof src === 'string' &&
    new RegExp('href\\s*=\\s*"' + EXPECTED_PRIVACY_ROUTE + '"').test(src);
}

/* The owner-supplied student catalog is a display/input contract, not a
   database enum. Keep this pin in the static gate so registration and profile
   cannot silently drift apart while the submitted `course` string remains
   backward-compatible. */
const EXPECTED_CSPC_COURSE_CATALOG = Object.freeze([
  'Bachelor in Human Services',
  'Bachelor of Arts in English Language Studies',
  'Bachelor of Science in Development Communication',
  'Bachelor of Public Administration',
  'Bachelor of Science in Mathematics',
  'Bachelor of Science in Applied Mathematics',
  'Bachelor of Science in Information Technology',
  'Bachelor of Science in Computer Science',
  'Bachelor of Science in Information Systems',
  'Bachelor of Library and Information Science',
  'Bachelor of Science in Civil Engineering',
  'Bachelor of Science in Electrical Engineering',
  'Bachelor of Science in Electronics Engineering',
  'Bachelor of Science in Mechanical Engineering',
  'Bachelor of Science in Architecture',
  'Bachelor of Science in Computer Engineering',
  'Bachelor of Science in Nursing',
  'Bachelor of Science in Midwifery',
  'Bachelor of Special Needs Education',
  'Bachelor of Physical Education',
  'Bachelor of Culture and Arts Education',
  'Bachelor of Technical-Vocational Teacher Education \u2013 Major in Food Service Management',
  'Bachelor of Technical-Vocational Teacher Education \u2013 Major in Electronics Technology',
  'Bachelor of Technical-Vocational Teacher Education \u2013 Major in Fish Processing',
  'Bachelor of Science in Office Administration',
  'Bachelor of Science in Hospitality Management',
  'Bachelor of Science in Entrepreneurship',
  'Bachelor of Science in Tourism Management',
  'Bachelor of Science in Business Administration \u2013 Major in Financial Management',
  'Other',
]);

function extractCourseOptionValues(source) {
  if (typeof source !== 'string' || source === '') return null;
  const match = source.match(/<select[^>]*id="oauthCourse"[\s\S]*?<\/select>/i);
  if (!match) return null;
  return [...match[0].matchAll(/<option\s+value="([^"]*)"[^>]*>([^<]*)<\/option>/gi)]
    .map((m) => m[1])
    .filter((value) => value !== '');
}

function extractPinnedCourseValues(source) {
  if (typeof source !== 'string' || source === '') return null;
  const match = source.match(/const CSPC_STUDENT_COURSES = Object\.freeze\(\[([\s\S]*?)\]\);/);
  if (!match) return null;
  return [...match[1].matchAll(/^\s*'((?:[^'\\]|\\.)*)',?\s*$/gm)]
    .map((m) => m[1].replace(/\\u2013/g, '\u2013'));
}

/** PURE: validate the exact catalog and its accessible, searchable surfaces. */
function courseCatalogProblems(registrationView, profileJs, siteCss, sampleData) {
  const problems = [];
  const expected = EXPECTED_CSPC_COURSE_CATALOG;
  const registration = extractCourseOptionValues(registrationView);
  const profile = extractPinnedCourseValues(profileJs);
  const same = (a, b) => Array.isArray(a) && Array.isArray(b) &&
    a.length === b.length && a.every((value, index) => value === b[index]);

  if (!same(registration, expected)) problems.push('registration catalog is not exact');
  if (!same(profile, expected)) problems.push('profile catalog is not exact');
  if (!same(registration, profile)) problems.push('registration/profile catalog parity is broken');
  if (new Set(expected).size !== expected.length || expected[expected.length - 1] !== 'Other') {
    problems.push('catalog is not unique or Other is not last');
  }
  if (expected.some((course) => course.length > 100)) problems.push('catalog exceeds course field compatibility');

  const requiredRegistrationShape = registrationView &&
    /<input[^>]+type="search"[^>]+id="oauthCourseSearch"[^>]+aria-controls="oauthCourse"/i.test(registrationView) &&
    /id="oauthCourseSearchHint"[^>]*>Type to filter the list/i.test(registrationView) &&
    /id="oauthCourseSearchStatus"[^>]+role="status"[^>]+aria-live="polite"/i.test(registrationView) &&
    /<select[^>]+id="oauthCourse"[^>]+name="course"[^>]+required/i.test(registrationView) &&
    /<option[^>]+value=""[^>]+selected[^>]+disabled>\s*Select your course\s*<\/option>/i.test(registrationView);
  if (!requiredRegistrationShape) problems.push('registration search accessibility/placeholder contract is missing');

  const requiredProfileShape = profileJs &&
    /<input[^>]+type="search"[^>]+id="editCourseSearch"[^>]+aria-controls="editCourse"/i.test(profileJs) &&
    /id="editCourseSearchHint"[^>]*>Type to filter the list/i.test(profileJs) &&
    /id="editCourseSearchStatus"[^>]+role="status"[^>]+aria-live="polite"/i.test(profileJs) &&
    /<select[^>]+id="editCourse"[^>]+aria-describedby="editCourseSearchHint editCourseSearchStatus"/i.test(profileJs);
  if (!requiredProfileShape) problems.push('profile search accessibility contract is missing');

  const searchBehavior = profileJs &&
    /function normalizeCourseSearch\(/.test(profileJs) &&
    /\.normalize\('NFKD'\)/.test(profileJs) &&
    /search\.addEventListener\('input', renderOptions\)/.test(profileJs) &&
    /event\.key === 'Escape'/.test(profileJs) &&
    /option\.value === 'Other' \|\| !query/.test(profileJs) &&
    /No matching course\. Choose Other if your course is not listed\./.test(profileJs) &&
    /let preservedValue = select\.value/.test(profileJs) &&
    /select\.dataset\.preservedCourseValue/.test(profileJs) &&
    /select\.addEventListener\('change',/.test(profileJs) &&
    /currentCourse && !CSPC_STUDENT_COURSES\.includes\(currentCourse\)/.test(profileJs) &&
    /newData\.course = courseEl\.value \|\| courseEl\.dataset\.preservedCourseValue \|\| ''/.test(profileJs);
  if (!searchBehavior) problems.push('search filtering or legacy-value preservation behavior is missing');

  const registrationBehavior = registrationView &&
    /\.normalize\('NFKD'\)/.test(registrationView) &&
    /search\.addEventListener\('input', renderOptions\)/.test(registrationView) &&
    /event\.key === 'Escape'/.test(registrationView) &&
    /option\.value === 'Other' \|\| !query/.test(registrationView) &&
    /No matching course\. Choose Other if your course is not listed\./.test(registrationView) &&
    /var preservedValue = select\.value/.test(registrationView) &&
    /select\.addEventListener\('change',/.test(registrationView);
  if (!registrationBehavior) problems.push('registration search filtering behavior is missing');

  if (typeof siteCss !== 'string' ||
      !/\.course-search-input\s*\{[\s\S]{0,180}?min-height:\s*44px/i.test(siteCss) ||
      !/\.auth-select\s*\{[\s\S]{0,180}?min-height:\s*44px/i.test(siteCss) ||
      !/select\.edit-form-input\s*\{[\s\S]{0,180}?min-height:\s*44px/i.test(siteCss)) {
    problems.push('course controls do not retain the 44px interaction target');
  }
  if (typeof sampleData === 'string' && /course:\s*['"]Bachelor of Science in Information Technology['"]/.test(sampleData) === false) {
    problems.push('the public sample profile does not use an official title');
  }
  return problems;
}

/** PURE: does this EJS source contain a dead placeholder anchor? */
function hasDeadPlaceholderAnchor(src) {
  return typeof src !== 'string' || /href\s*=\s*"#"/.test(src) || /href\s*=\s*'#'/.test(src);
}

/* M12.P1-R8 re-review finding: the notice claimed "Requests from signed-out
   visitors are not recorded". Unscoped, that reads as a promise that anonymous
   traffic is never logged, which contradicts the adjacent — and truthful —
   disclosure that every request's method and path IS logged. What
   middleware/roleAuth.js actually guarantees after R5 is narrower: an anonymous
   denial writes no authorization-denial audit ROW.

   The required scoped phrasing and the forbidden ambiguous phrasings are pinned
   here, independently of the view. */
const REQUIRED_ANON_AUDIT_SCOPE = /not\s+written\s+as\s+authorization-denial\s+audit\s+events/i;

const AMBIGUOUS_ANON_AUDIT_CLAIMS = Object.freeze([
  /signed-out\s+visitors\s+are\s+<strong>\s*not\s*<\/strong>\s*recorded/i,
  /signed-out\s+visitors\s+are\s+not\s+recorded/i,
  /signed-out\s+visitors\s+are\s+never\s+recorded/i,
  // "traffic IS not logged" and "requests ARE not logged" both appear naturally;
  // accept either copula so a singular rephrasing cannot slip past.
  /anonymous\s+(?:requests|traffic|visitors)\s+(?:is|are)\s+(?:not|never)\s+(?:recorded|logged|kept|stored)/i,
  /we\s+(?:do\s+not|never)\s+(?:log|record|store)\s+anonymous/i,
]);

/**
 * PURE: is the anonymous-denial claim correctly SCOPED to authorization-denial
 * audit events, without any unscoped "not recorded/logged" phrasing, while the
 * separate method/path request-log disclosure survives? Fails closed.
 */
function anonAuditClaimIsScoped(src) {
  if (typeof src !== 'string' || src === '') return false;
  if (!REQUIRED_ANON_AUDIT_SCOPE.test(src)) return false;
  if (AMBIGUOUS_ANON_AUDIT_CLAIMS.some((re) => re.test(src))) return false;
  // The separate, truthful request-log disclosure must remain.
  return /HTTP method and the path/i.test(src) &&
    /Query\s+strings are deliberately stripped/i.test(src);
}

/**
 * PURE: does the privacy view make every disclosure the owner required, and
 * none of the claims the owner forbade? Shape-based: each clause is a distinct
 * required concept, so deleting a section fails even if the file stays long.
 */
function privacyViewIsTruthful(src) {
  if (typeof src !== 'string' || src === '') return false;
  const required = [
    /Team Dutchess/i,                                   // operator
    /capstone/i,                                        // nature of the project
    /student ID|student_id|student ID number/i,         // role/profile data
    /bcrypt/i,                                          // authentication data
    /session/i,                                         // session data
    /Vercel/i, /Supabase/i, /Upstash/i, /Cloudinary/i,  // processors
    /openid/i,                                          // exact Google scopes
    /Google Form/i,                                     // separate feedback
    /30 days/i,                                         // retention window
    /manual/i,                                          // owner-managed deletion
    /10173/,                                            // data-subject rights
    /Data Protection Officer/i,                         // DPO route
  ];
  if (!required.every((re) => re.test(src))) return false;
  if (!src.includes(EXPECTED_CSPC_POLICY_URL)) return false;

  // Forbidden invented claims.
  const forbidden = [
    /\blegal basis\b/i,
    /\bautomatically deleted\b/i,
    /\bautomatic deletion\b/i,
    /\byou consent\b/i,
    /\bby using this (?:site|application|service) you agree\b/i,
    /\bwe (?:do not|never) share\b/i,
  ];
  return !forbidden.some((re) => re.test(src));
}

/**
 * PURE: does documentation describe the facilitator-mediated pilot truthfully?
 * Requires the owner's model and REJECTS the superseded invitation-only /
 * allowlist / 100-participant framings that conflict with it.
 */
function describesFacilitatorMediatedPilot(text) {
  if (typeof text !== 'string' || text === '') return false;
  const t = text.replace(/\s+/g, ' ');
  const carriesModel =
    /facilitator-mediated/i.test(t) &&
    /\bTesting\b/.test(t) &&
    // Tolerates the Markdown code-span backticks the deployment guide uses
    // around each scope name, e.g. `openid`, `email` and `profile`.
    /openid[\s,`'"]*(?:and[\s,`'"]*)?email[\s,`'"]*(?:and[\s,`'"]*)?profile/i.test(t) &&
    /basic[- ]identity exception/i.test(t);
  const carriesConflict =
    /invitation-only/i.test(t) ||
    /\bOAuth (?:test[- ]user )?allowlist\b/i.test(t) ||
    /pre-added as (?:OAuth )?test users/i.test(t) ||
    /\b100[- ]participant\b/i.test(t) ||
    /\b100 test users\b/i.test(t);
  return carriesModel && !carriesConflict;
}

/* ---- M12.P1 SEC-51 pilot-surface correction contracts (pure, text-in only) ----
   Three independently reviewed findings. Every analyzer below reads ONLY the
   markup/JS/CSS text it is handed, so this gate's own commentary and fixture
   strings can never satisfy a detector. */

/* The landing page must state the ACTUAL mapping enforced by getRoleFromEmail()
   in controllers/authController.js. Note `@cspc.edu.ph` is NOT a substring of
   `@my.cspc.edu.ph` (the `@` anchors it), so the two domains are unambiguous. */
const EXPECTED_LANDING_REFUSAL = 'Other email domains are not accepted';

/**
 * PURE: does the landing copy name all three supported account classes, state
 * the refusal of other domains, and avoid the superseded exclusive claim?
 * @returns {boolean}
 */
function landingStatesTruthfulRoleMapping(html) {
  if (typeof html !== 'string' || html === '') return false;
  const t = html.replace(/\s+/g, ' ');
  const student = /@my\.cspc\.edu\.ph/.test(t);
  const instructor = /@cspc\.edu\.ph/.test(t);
  const guest = /\bgmail\b/i.test(t);
  const refusal = new RegExp(EXPECTED_LANDING_REFUSAL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(t);
  // The false exclusive framing must be gone in every phrasing seen so far.
  const exclusive =
    /restricted to @cspc\.edu\.ph/i.test(t) ||
    /only @cspc\.edu\.ph/i.test(t) ||
    /@cspc\.edu\.ph accounts only/i.test(t) ||
    /limited to @cspc\.edu\.ph/i.test(t);
  return student && instructor && guest && refusal && !exclusive;
}

/** PURE: the anonymous hamburger button must expose the full ARIA contract. */
function publicNavbarExposesAriaContract(navbarHtml) {
  if (typeof navbarHtml !== 'string' || navbarHtml === '') return false;
  const btn = (navbarHtml.match(/<button[^>]*id="hamburger"[^>]*>/) || [])[0] || '';
  if (!btn) return false;
  return /aria-controls="navLinks"/.test(btn) &&
    /aria-expanded="false"/.test(btn) &&
    /aria-label="Open navigation menu"/.test(btn);
}

/** PURE: the partial must load the shared client once, deferred. */
function publicNavbarLoadsSharedClient(navbarHtml) {
  if (typeof navbarHtml !== 'string' || navbarHtml === '') return false;
  const tags = navbarHtml.match(/<script[^>]*src="\/js\/public-nav\.js"[^>]*>/g) || [];
  return tags.length === 1 && /\sdefer(?:\s|>|=)/.test(tags[0]);
}

/**
 * PURE: the shared client must route ALL menu state through ONE setter.
 * Counting occurrences is the checkable form of that: if `setOpen` is the only
 * such function and aria-expanded / aria-label / the open class are each written
 * in exactly one place, no caller can move them independently.
 * @returns {boolean}
 */
function publicNavClientHasSharedStateSetter(js) {
  if (typeof js !== 'string' || js === '') return false;
  const count = (re) => (js.match(re) || []).length;
  const oneSetter = count(/function setOpen\s*\(/g) === 1;
  const oneAriaExpanded = count(/setAttribute\('aria-expanded'/g) === 1;
  const oneAriaLabel = count(/setAttribute\('aria-label'/g) === 1;
  const oneOpenAdd = count(/classList\.add\('open'\)/g) === 1;
  const oneOpenRemove = count(/classList\.remove\('open'\)/g) === 1;
  /* These must match CODE SHAPES, not bare strings. This file documents its own
     contract in a JSDoc header, so `navbar__link` and the media-query literal
     each appear in a comment too — a bare-substring scan stayed true after the
     real handler was deleted, which is fail-open. */
  const closesOnNavigation = /classList\.contains\('navbar__link'\)/.test(js) &&
    /\},\s*true\s*\)/.test(js);
  const closesOnEscape = /'Escape'/.test(js);
  const closesOnOutside = /'pointerdown'/.test(js);
  const closesOnDesktop = /win\.matchMedia\('\(max-width: 768px\)'\)/.test(js);
  const idempotent = /data-cs-nav-owned/.test(js);
  return oneSetter && oneAriaExpanded && oneAriaLabel && oneOpenAdd && oneOpenRemove &&
    closesOnNavigation && closesOnEscape && closesOnOutside && closesOnDesktop && idempotent;
}

/** PURE: an anonymous view must carry NO page-local hamburger/menu handler. */
function anonymousViewHasNoLocalNavHandler(viewHtml) {
  if (typeof viewHtml !== 'string') return false;
  return !/getElementById\(\s*['"]hamburger['"]\s*\)/.test(viewHtml) &&
    !/getElementById\(\s*['"]navLinks['"]\s*\)/.test(viewHtml);
}

/**
 * PURE: an auth surface must carry the auth body class and render EXACTLY one
 * theme-toggle include positioned inside the card, before the card header.
 * Requiring it before the header is what distinguishes "inside the card" from
 * the superseded placement after the card's closing tag, which also sat at a
 * larger string index.
 * @returns {boolean}
 */
function authViewPlacesThemeToggleInCard(viewHtml) {
  if (typeof viewHtml !== 'string' || viewHtml === '') return false;
  if (!/<body class="auth-body">/.test(viewHtml)) return false;
  const includes = viewHtml.match(/include\('partials\/theme-toggle'\)/g) || [];
  if (includes.length !== 1) return false;
  const cardIdx = viewHtml.indexOf('<div class="auth-card">');
  const headerIdx = viewHtml.indexOf('class="auth-header"');
  const includeIdx = viewHtml.indexOf("include('partials/theme-toggle')");
  if (cardIdx === -1 || headerIdx === -1 || includeIdx === -1) return false;
  return includeIdx > cardIdx && includeIdx < headerIdx;
}

/**
 * PURE: the auth-scoped CSS must make the card the containing block and pin a
 * full-size 44x44 control to its top-right, WITHOUT hiding it and WITHOUT
 * disturbing the global fixed placement used by every other surface.
 * @returns {boolean}
 */
function authScopedThemeToggleCssIsCorrect(css) {
  if (typeof css !== 'string' || css === '') return false;
  const cardBlock = (css.match(/body\.auth-body\s+\.auth-card\s*\{[^}]*\}/) || [])[0] || '';
  const toggleBlock = (css.match(/body\.auth-body\s+\.auth-card\s+\.theme-toggle\s*\{[^}]*\}/) || [])[0] || '';
  if (!cardBlock || !toggleBlock) return false;
  const containingBlock = /position:\s*relative/.test(cardBlock);
  const absolute = /position:\s*absolute/.test(toggleBlock);
  const bottomAuto = /bottom:\s*auto/.test(toggleBlock);
  const topRight = /top:\s*\d+px/.test(toggleBlock) && /right:\s*\d+px/.test(toggleBlock);
  const fullTarget = /width:\s*44px/.test(toggleBlock) && /height:\s*44px/.test(toggleBlock);
  const notHidden = !/display:\s*none/.test(toggleBlock) &&
    !/visibility:\s*hidden/.test(toggleBlock) &&
    !/opacity:\s*0\b/.test(toggleBlock);
  // Scope proof: the GLOBAL control keeps its fixed placement.
  const globalStillFixed = /\n\.theme-toggle\s*\{[^}]*position:\s*fixed/.test(css);
  return containingBlock && absolute && bottomAuto && topRight && fullTarget &&
    notHidden && globalStillFixed;
}

/** PURE: /favicon.ico must resolve to the shipped logo before session state. */
function serverProvidesPreSessionFavicon(serverSource) {
  if (typeof serverSource !== 'string' || serverSource === '') return false;
  const routeAt = serverSource.indexOf("app.get('/favicon.ico'");
  const staticAt = serverSource.indexOf('app.use(express.static(');
  const sessionAt = serverSource.indexOf('app.use(session(');
  if (routeAt < 0 || staticAt < 0 || sessionAt < 0) return false;
  const route = serverSource.slice(routeAt, staticAt);
  return routeAt < staticAt && routeAt < sessionAt &&
    /res\.type\('png'\)/.test(route) &&
    /res\.sendFile\(path\.join\(__dirname,\s*'public',\s*'img',\s*'cspc-logo\.png'\)\)/.test(route);
}

/** PURE: the self-terminating harness must poll a pre-session route. */
function withServerReadinessUsesPreSessionProbe(withServerSource) {
  if (typeof withServerSource !== 'string' || withServerSource === '') return false;
  const start = withServerSource.indexOf('async function waitForReady');
  const end = withServerSource.indexOf('\nasync function withServer', start);
  if (start < 0 || end <= start) return false;
  const body = withServerSource.slice(start, end);
  return /fetch\(base \+ '\/favicon\.ico'\)/.test(body) &&
    !/fetch\(base \+ '\/auth'\)/.test(body) &&
    /r\.status === 200/.test(body);
}

/** PURE: the edit-profile overlay must be non-interactive while hidden and
 * expose a bounded, reduced-motion-friendly dialog when shown. */
function profileModalCssIsAccessible(css) {
  if (typeof css !== 'string' || css === '') return false;
  const hidden = (css.match(/\.edit-modal-overlay\s*\{[^}]*\}/) || [])[0] || '';
  const shown = (css.match(/\.edit-modal-overlay\.show\s*\{[^}]*\}/) || [])[0] || '';
  const modal = (css.match(/\.edit-modal\s*\{[^}]*\}/) || [])[0] || '';
  const close = (css.match(/\.edit-modal__close\s*\{[^}]*\}/) || [])[0] || '';
  const body = (css.match(/\.edit-modal__body\s*\{[^}]*\}/) || [])[0] || '';
  const reduced = (css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.edit-modal[\s\S]*?transition:\s*none;[\s\S]*?\}/) || [])[0] || '';
  return /opacity:\s*0\b/.test(hidden) && /visibility:\s*hidden/.test(hidden) &&
    /pointer-events:\s*none/.test(hidden) && !/transition:\s*all\b/.test(hidden) &&
    /opacity:\s*1\b/.test(shown) && /visibility:\s*visible/.test(shown) &&
    /pointer-events:\s*auto/.test(shown) &&
    /max-height:\s*calc\(100dvh/.test(modal) && /display:\s*flex/.test(modal) &&
    /flex-direction:\s*column/.test(modal) && !/transition:\s*all\b/.test(modal) &&
    /width:\s*44px/.test(close) && /height:\s*44px/.test(close) &&
    /min-height:\s*0/.test(body) && /overflow-y:\s*auto/.test(body) && Boolean(reduced);
}

/** PURE: modal markup, state, keyboard, focus, and backdrop behaviour must all
 * be owned by the single setEditModalOpen state transition. */
function profileModalClientIsAccessible(js) {
  if (typeof js !== 'string' || js === '') return false;
  const count = (re) => (js.match(re) || []).length;
  const labels = js.match(/<label\b[^>]*class="edit-form-label"[^>]*>/g) || [];
  const labelledFields = labels.length > 0 && labels.every((label) => /\sfor="[^"]+"/.test(label));
  const dialogMarkup = /id="editModalOverlay"\s+aria-hidden="true"\s+inert/.test(js) &&
    /id="editModalDialog"\s+role="dialog"\s+aria-modal="true"\s+aria-labelledby="editModalTitle"\s+tabindex="-1"/.test(js) &&
    /id="editModalTitle">Edit Profile<\/h2>/.test(js) &&
    /id="closeEditModal"\s+aria-label="Close edit profile dialog"/.test(js);
  const oneStateOwner = count(/const setEditModalOpen\s*=/g) === 1 &&
    count(/overlay\.classList\.add\('show'\)/g) === 1 &&
    count(/overlay\.classList\.remove\('show'\)/g) === 1 &&
    count(/setEditModalOpen\(true,/g) === 2;
  const stateIsComplete = /overlay\.removeAttribute\('inert'\)/.test(js) &&
    /overlay\.setAttribute\('aria-hidden',\s*'false'\)/.test(js) &&
    /overlay\.setAttribute\('aria-hidden',\s*'true'\)/.test(js) &&
    /overlay\.setAttribute\('inert',\s*''\)/.test(js);
  const focusContract = /window\.requestAnimationFrame/.test(js) &&
    /\(focusable\[0\]\s*\|\|\s*modalDialog\)\.focus\(\)/.test(js) &&
    /focusTarget[\s\S]{0,180}?focusTarget\.focus\(\)/.test(js) &&
    /userContainer\.tabIndex\s*=\s*-1/.test(js) &&
    /lastModalTrigger\s*=\s*trigger\s*===\s*editBtn\s*\?\s*userContainer/.test(js) &&
    /e\.key\s*===\s*'Escape'/.test(js) && /e\.key\s*!==\s*'Tab'/.test(js) &&
    /e\.shiftKey/.test(js) && /modalDialog\.contains\(document\.activeElement\)/.test(js);
  /* An overlay-scoped keydown listener only fires once focus is ALREADY inside
     the overlay. While focus sat on <body> the trap never ran and Tab walked
     into the page behind the open dialog, so the trap must be document-scoped,
     capture-phase, attached on open and removed on close. Matching on the
     handler identifier keeps prose in comments from satisfying these checks. */
  const documentCaptureTrap =
    !/overlay\.addEventListener\(\s*'keydown'/.test(js) &&
    count(/document\.addEventListener\('keydown',\s*handleModalKeydown,\s*true\)/g) === 1 &&
    count(/document\.removeEventListener\('keydown',\s*handleModalKeydown,\s*true\)/g) === 1 &&
    /overlay\.classList\.add\('show'\)[\s\S]{0,400}?document\.addEventListener\('keydown',\s*handleModalKeydown,\s*true\)/.test(js) &&
    /document\.removeEventListener\('keydown',\s*handleModalKeydown,\s*true\);[\s\S]{0,200}?overlay\.classList\.remove\('show'\)/.test(js);
  /* Focus outside the dialog must be recaptured rather than allowed to advance,
     and open-time placement must be verified instead of assumed: the overlay
     starts at `visibility: hidden`, where .focus() is silently ignored. */
  const outsideDialogRecapture =
    /if \(!modalDialog\.contains\(document\.activeElement\)\)\s*\{\s*e\.preventDefault\(\)/.test(js) &&
    /if \(!modalDialog\.contains\(document\.activeElement\)\)\s*\{[\s\S]{0,220}?\.focus\(\)/.test(js);
  const verifiedOpenFocus = count(/window\.requestAnimationFrame/g) >= 2 &&
    /const focusInitialModalElement\s*=/.test(js) &&
    /if \(!modalDialog\.contains\(document\.activeElement\)\) modalDialog\.focus\(\)/.test(js);
  /* Close-time restoration must survive a hidden owner — the mobile trigger sits
     in the menu that closes behind the modal, and the desktop profile menu is
     hidden at narrow widths — otherwise focus is stranded on <body>. A single
     fallback is not enough; the chain must be tried until one accepts focus.
     The menu owner must be derived STRUCTURALLY (ancestor walk + aria-controls),
     never by naming a navigation id: the M12.P1-D2 single-nav-owner contract
     bans the dashHamburger/dashTabs literals from this file outright. */
  const restoreFocusFallback =
    !/dashHamburger|dashTabs/.test(js) &&
    /const findMenuControllerFor\s*=/.test(js) &&
    /node\.parentElement/.test(js) &&
    /querySelector\('\[aria-controls="'\s*\+\s*node\.id\s*\+\s*'"\]'\)/.test(js) &&
    /!node\.contains\(controller\)\) return controller;/.test(js) &&
    /restoreCandidates\s*=\s*\[userContainer,\s*findMenuControllerFor\(focusTarget\)\]/.test(js) &&
    /if \(active && active !== document\.body && !overlay\.contains\(active\)\) return;/.test(js) &&
    /candidate\.focus\(\);/.test(js) &&
    /if \(document\.activeElement === candidate\) break;/.test(js) &&
    /window\.requestAnimationFrame\(restoreFocusToOwner\);/.test(js) &&
    /* Focus must leave the overlay BEFORE it is marked inert, or the browser
       blurs it to <body> and a hidden trigger leaves nothing focused. */
    /restoreFocusToOwner\(\);\s*(?:\/\/[^\n]*\n\s*)*overlay\.setAttribute\('aria-hidden', 'true'\);\s*(?:\/\/[^\n]*\n\s*)*overlay\.inert = true;/.test(js);
  const backdropOnly = /overlay\.addEventListener\('click',[\s\S]{0,140}?e\.target\s*===\s*overlay/.test(js);
  const explicitButtons = ['closeEditModal', 'cancelEditBtn', 'saveEditBtn']
    .every((id) => new RegExp('<button type="button"[^>]*id="' + id + '"').test(js));
  return labelledFields && dialogMarkup && oneStateOwner && stateIsComplete &&
    focusContract && documentCaptureTrap && outsideDialogRecapture &&
    verifiedOpenFocus && restoreFocusFallback && backdropOnly && explicitButtons &&
    !/\sonclick=/.test(js);
}

/** PURE: the deployment guide must constrain isolated browser evidence so a
 * rehearsal cannot leak PII, reuse auth state, mutate frozen data, or write
 * browser artifacts into the repository. */
function describesSafePilotRehearsalProtocol(text) {
  if (typeof text !== 'string' || text === '') return false;
  const t = text.replace(/\s+/g, ' ');
  const required = [
    /three user-scoped, isolated Playwright MCP servers/i,
    /temporary output director(?:y|ies) outside the repository/i,
    /zero CampuSphere cookies/i,
    /empty `?localStorage`? and `?sessionStorage`?/i,
    /fresh accessibility snapshot/i,
    /semantic selector/i,
    /stale element reference/i,
    /browser_evaluate[\s\S]*?must not return[\s\S]*?document\.body[\s\S]*?innerHTML/i,
    /hidden profile fields/i,
    /personally identifiable information \(PII\)/i,
    /origin and pathname/i,
    /strip query strings and fragments/i,
    /git status --porcelain/i,
    /repository artifact/i,
    /fresh `?@my\.cspc\.edu\.ph`? identity/i,
    /`?student-cspc`? role is verified/i,
    /Sparse CAS content[\s\S]*?must not be fabricated/i,
    /supported administrator interface/i,
    /real logout interface/i,
    /earlier automated rehearsal disclosed/i,
  ];
  return required.every((re) => re.test(t));
}

/** PURE: a rejecting fixture is evidence only when it changes the supplied
 * source and the real analyzer rejects those changed bytes. */
function sourceMutationIsRejected(source, pattern, replacement, analyzer) {
  if (typeof source !== 'string' || typeof analyzer !== 'function') return false;
  const mutated = source.replace(pattern, replacement);
  return mutated !== source && analyzer(mutated) === false;
}

function runPilotReadinessGate() {
  const rec = makeRecorder('pilot-readiness');
  const { ok } = rec;

  const ROOT_DIR = path.join(__dirname, '..');
  const read = (rel) => {
    const p = path.join(ROOT_DIR, ...rel.split('/'));
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  };
  /* Is `rel` tracked by Git? spawnSync is used rather than `spawn` so this stays
     synchronous like the rest of this static gate. Exit 0 means tracked. If Git
     is unavailable the check cannot run, so it reports "not tracked" only when
     Git actually answers — see the guarded assertion below. */
  const gitAnswered = { ok: false };
  const gitTracks = (rel) => {
    try {
      const r = require('child_process').spawnSync(
        'git', ['ls-files', '--error-unmatch', '--', rel],
        { cwd: ROOT_DIR, encoding: 'utf8', windowsHide: true }
      );
      if (r.error || typeof r.status !== 'number') return false;
      gitAnswered.ok = true;
      return r.status === 0;
    } catch (e) {
      return false;
    }
  };

  /* ---- 1. anonymous privacy route + notice content ---- */
  const routes = read('routes/index.js');
  const ctrl = read('controllers/pageController.js');
  const view = read('views/privacy.ejs');

  ok('routes/index.js registers GET /privacy',
    /router\.get\(\s*'\/privacy'\s*,[\s\S]*?pageController\.privacy\s*\)/.test(routes));
  ok('GET /privacy is anonymous (no requireLogin on the privacy route)',
    !/router\.get\(\s*'\/privacy'[^)]*requireLogin/.test(routes));
  ok('pageController exports a privacy handler that renders the privacy view',
    /exports\.privacy\s*=/.test(ctrl) && /res\.render\('privacy'/.test(ctrl));
  ok('the privacy handler touches no session and no database',
    /exports\.privacy[\s\S]{0,400}?\n\};/.test(ctrl) &&
    !/exports\.privacy[\s\S]{0,400}?req\.session/.test(ctrl) &&
    !/exports\.privacy[\s\S]{0,400}?(?:db\.query|Repository)/.test(ctrl));
  ok('views/privacy.ejs exists and makes every required disclosure',
    privacyViewIsTruthful(view));
  ok('views/privacy.ejs nonces its inline style element (CSP)',
    /<style nonce="<%= cspNonce %>">/.test(view));

  /* M12.P1-R8 re-review: the anonymous-denial claim must be SCOPED to
     authorization-denial audit events, and the separate method/path request-log
     disclosure must survive alongside it. */
  ok('views/privacy.ejs scopes the anonymous-denial claim to authorization-denial audit events',
    anonAuditClaimIsScoped(view));
  ok('views/privacy.ejs keeps the separate truthful method/path request-log disclosure',
    /HTTP method and the path/i.test(view) &&
    /Query\s+strings are deliberately stripped/i.test(view));

  /* ---- 2. working privacy links, zero dead placeholders ---- */
  for (const rel of PRIVACY_LINK_VIEWS) {
    const src = read(rel);
    ok(rel + ' links to the privacy notice', linksToPrivacy(src));
    ok(rel + ' contains zero dead href="#" placeholders', !hasDeadPlaceholderAnchor(src));
  }
  const footer = read('views/partials/footer.ejs');
  ok('the anonymous footer points at the real CSPC website, not a placeholder',
    footer.includes(EXPECTED_CSPC_SITE_URL));
  ok('the anonymous footer links the official CSPC privacy policy',
    footer.includes(EXPECTED_CSPC_POLICY_URL));
  ok('the anonymous footer links the real public FAQ page and keeps other placeholders out',
    /href=["']\/faq["']/.test(footer) &&
    !/>\s*Student Portal\s*</.test(footer) &&
    !/>\s*Contact Us\s*</.test(footer) &&
    !/>\s*Terms of Use\s*</.test(footer));

  /* ---- 3. indexing protection ---- */
  const headers = read('middleware/securityHeaders.js');
  const server = read('server.js');
  const withServerSource = read('scripts/with-server.js');
  const robotsTxt = read('public/robots.txt').replace(/\r\n/g, '\n').trim();

  ok('securityHeaders pins the exact pilot X-Robots-Tag value',
    headers.includes("'" + EXPECTED_ROBOTS_TAG_VALUE + "'"));
  ok('securityHeaders exports a pilotNoIndex middleware that sets X-Robots-Tag',
    /function pilotNoIndex\(/.test(headers) &&
    /res\.set\('X-Robots-Tag',\s*PILOT_ROBOTS_TAG\)/.test(headers) &&
    /module\.exports\s*=\s*\{[^}]*pilotNoIndex/.test(headers));
  ok('server.js mounts pilotNoIndex and the favicon compatibility route before session state',
    server.indexOf('app.use(pilotNoIndex)') > -1 &&
    server.indexOf('app.use(pilotNoIndex)') < server.indexOf('app.use(express.static(') &&
    server.indexOf('app.use(pilotNoIndex)') < server.indexOf("app.use('/', indexRoutes)") &&
    serverProvidesPreSessionFavicon(server));
  ok('scripts/with-server.js waits on the pre-session favicon route, not /auth',
    withServerReadinessUsesPreSessionProbe(withServerSource));
  ok('public/robots.txt disallows every crawler', robotsTxt === EXPECTED_ROBOTS_TXT);
  ok('the indexing control is documented as NOT access control',
    /NOT ACCESS CONTROL|not access control/i.test(headers) &&
    /NOT ACCESS CONTROL|not access control/i.test(server));

  /* ---- 4. truthful OAuth / pilot documentation ---- */
  const deployDoc = read('docs/deployment.md');
  ok('docs/deployment.md records the facilitator model and the safe isolated rehearsal protocol',
    describesFacilitatorMediatedPilot(deployDoc) &&
    describesSafePilotRehearsalProtocol(deployDoc));
  ok('no tracked documentation still claims an invitation-only pilot',
    !/invitation-only/i.test(deployDoc) &&
    !/invitation-only/i.test(read('plan.md')) &&
    !/invitation-only/i.test(read('ROADMAP.md')));
  ok('the shipped OAuth scope request still matches the documented scopes',
    /scope:\s*'openid email profile'/.test(read('controllers/authController.js')));

  /* ---- 5. current documentation consistency ---- */
  /* The superseded label may still APPEAR in the deployment guide — the R7
     closeout is accepted history and must be preserved. What must not happen is
     the guide presenting it as the CURRENT label. So: the corrected label must
     be recorded, and any surviving mention of the old one must be explicitly
     framed as superseded. */
  ok('docs/deployment.md records the corrected neutral inventory label',
    deployDoc.includes(EXPECTED_PACKAGE_INVENTORY_LABEL));
  ok('docs/deployment.md frames the dirty-worktree label only as superseded history',
    !/dirty[- ]worktree/i.test(deployDoc) ||
    /\b(?:superseded|previously|became false)\b/i.test(deployDoc));
  {
    // Fails CLOSED on a real answer: if Git says the manuscript is tracked, this
    // fails. It is skipped as "not applicable" only when Git itself could not
    // answer (no repository / no git binary), which is stated explicitly.
    const tracked = gitTracks('MANUSCRIPT_TEAMDUTCHESS.pdf');
    ok('MANUSCRIPT_TEAMDUTCHESS.pdf is not tracked in the deployment snapshot' +
      (gitAnswered.ok ? '' : ' (git unavailable — not asserted)'),
      gitAnswered.ok ? !tracked : true);
  }
  ok('the root .gitignore still excludes root-level document exports',
    read('.gitignore').includes('/*.pdf'));

  /* ---- rejecting fixtures: every detector must reject a broken source ---- */
  ok('fixture: a view with href="#" is flagged',
    hasDeadPlaceholderAnchor('<a href="#">x</a>') &&
    hasDeadPlaceholderAnchor("<a href='#'>x</a>"));
  ok('fixture: a view without a /privacy link is flagged',
    !linksToPrivacy('<a href="/about">About</a>') && !linksToPrivacy(null));
  ok('fixture: a privacy notice missing the CSPC policy URL is rejected',
    !privacyViewIsTruthful(view.split(EXPECTED_CSPC_POLICY_URL).join('https://example.invalid/')));
  ok('fixture: a privacy notice missing the retention window is rejected',
    !privacyViewIsTruthful(view.replace(/30 days/g, 'some time')));
  ok('fixture: a privacy notice missing the DPO route is rejected',
    !privacyViewIsTruthful(view.replace(/Data Protection Officer/g, 'someone')));
  ok('fixture: a privacy notice that invents a legal basis is rejected',
    !privacyViewIsTruthful(view + '<p>Our legal basis is legitimate interest.</p>'));
  ok('fixture: a privacy notice that promises automatic deletion is rejected',
    !privacyViewIsTruthful(view + '<p>Your data is automatically deleted.</p>'));
  ok('fixture: a privacy notice that invents a no-sharing guarantee is rejected',
    !privacyViewIsTruthful(view + '<p>We never share your data.</p>'));
  ok('fixture: empty / non-string privacy source is rejected',
    !privacyViewIsTruthful('') && !privacyViewIsTruthful(null) && !privacyViewIsTruthful({}));

  /* Positive + ambiguity-reintroduction fixtures for the scoped anonymous-denial
     claim. Each ambiguous phrasing is driven separately against the REAL view so
     a partial revert cannot pass. */
  ok('fixture: the real view satisfies the scoped anonymous-denial contract',
    anonAuditClaimIsScoped(view));
  ok('fixture: restoring the unscoped "signed-out visitors are not recorded" is rejected',
    !anonAuditClaimIsScoped(
      view.replace(REQUIRED_ANON_AUDIT_SCOPE, 'not recorded')
        .replace(/signed-out visitors are\s+<strong>[\s\S]{0,80}?<\/strong>/i,
          'signed-out visitors are not recorded')));
  ok('fixture: an unscoped "never recorded" variant is rejected',
    !anonAuditClaimIsScoped(view + '<p>Requests from signed-out visitors are never recorded.</p>'));
  ok('fixture: a blanket "anonymous traffic is not logged" claim is rejected',
    !anonAuditClaimIsScoped(view + '<p>Anonymous traffic is not logged.</p>') &&
    !anonAuditClaimIsScoped(view + '<p>We do not log anonymous requests at all.</p>'));
  ok('fixture: dropping the scoped phrasing entirely is rejected',
    !anonAuditClaimIsScoped(view.replace(REQUIRED_ANON_AUDIT_SCOPE, 'handled differently')));
  ok('fixture: dropping the separate method/path request-log disclosure is rejected',
    !anonAuditClaimIsScoped(view.replace(/HTTP method and the path/gi, 'some details')));
  ok('fixture: empty / non-string input fails the scoped-claim check closed',
    !anonAuditClaimIsScoped('') && !anonAuditClaimIsScoped(null) && !anonAuditClaimIsScoped(['x']));
  ok('fixture: invitation-only framing or removal of isolated contexts is rejected',
    !describesFacilitatorMediatedPilot(deployDoc + ' The pilot is invitation-only.') &&
    sourceMutationIsRejected(
      deployDoc,
      /three\s+user-scoped,\s+isolated\s+Playwright\s+MCP\s+servers/gi,
      'browser tabs',
      describesSafePilotRehearsalProtocol));
  ok('fixture: an OAuth allowlist or broad page evaluation is rejected',
    !describesFacilitatorMediatedPilot(deployDoc + ' Participants are pre-added as OAuth test users.') &&
    sourceMutationIsRejected(deployDoc, /browser_evaluate/gi, 'browser helper',
      describesSafePilotRehearsalProtocol));
  ok('fixture: a participant cap or raw OAuth query capture is rejected',
    !describesFacilitatorMediatedPilot(deployDoc + ' The pilot is limited to 100 test users.') &&
    sourceMutationIsRejected(deployDoc, /strip query strings and fragments/gi, 'retain full URLs',
      describesSafePilotRehearsalProtocol));
  ok('fixture: removing identity or repository-artifact safeguards is rejected',
    !describesFacilitatorMediatedPilot(deployDoc.replace(/basic[- ]identity exception/gi, 'rule')) &&
    sourceMutationIsRejected(deployDoc, /fresh `@my\.cspc\.edu\.ph` identity/gi, 'existing account',
      describesSafePilotRehearsalProtocol) &&
    sourceMutationIsRejected(deployDoc, /git status --porcelain/gi, 'status check',
      describesSafePilotRehearsalProtocol));
  ok('fixture: a robots.txt that allows crawling is rejected',
    'User-agent: *\nAllow: /' !== EXPECTED_ROBOTS_TXT);
  ok('fixture: a weakened X-Robots-Tag value or missing favicon route is rejected',
    'noindex' !== EXPECTED_ROBOTS_TAG_VALUE &&
    'noindex, nofollow' !== EXPECTED_ROBOTS_TAG_VALUE &&
    sourceMutationIsRejected(server, /app\.get\('\/favicon\.ico'/, "app.get('/missing.ico'",
      serverProvidesPreSessionFavicon));
  ok('fixture: a with-server readiness probe that polls /auth is rejected',
    sourceMutationIsRejected(
      withServerSource,
      /base \+ '\/favicon\.ico'/,
      "base + '/auth'",
      withServerReadinessUsesPreSessionProbe));

  /* ---- SEC-51 pilot-surface correction: three findings ---- */
  const landingView = read('views/landing.ejs');
  const navbarPartial = read('views/partials/navbar.ejs');
  const publicNavJs = read('public/js/public-nav.js');
  const privacyView = read('views/privacy.ejs');
  const authView = read('views/auth.ejs');
  const completeRegView = read('views/complete-registration.ejs');
  const siteCss = read('public/css/styles.css');
  const profileJs = read('public/js/profile-script.js');
  const sampleData = read('public/js/data.js');

  // Finding 1 — truthful landing role mapping.
  ok('views/landing.ejs states the real three-domain Google sign-in mapping',
    landingStatesTruthfulRoleMapping(landingView));
  ok('views/landing.ejs no longer claims Google sign-in is restricted to @cspc.edu.ph',
    !/restricted to @cspc\.edu\.ph/i.test(landingView));
  /* The controller compares BARE domains (no leading '@'), so this asserts the
     real code shape rather than the address form used in the landing copy. */
  const authCtrl = read('controllers/authController.js');
  ok('controllers/authController.js still enforces the three mapped domains',
    /domain === 'my\.cspc\.edu\.ph'\s*\)\s*return 'student-cspc'/.test(authCtrl) &&
    /domain === 'cspc\.edu\.ph'\s*\)\s*return 'instructor'/.test(authCtrl) &&
    /domain === 'gmail\.com'\s*\)\s*return 'guest'/.test(authCtrl));

  // Finding 2 — shared, accessible anonymous navbar.
  ok('views/partials/navbar.ejs exposes the hamburger ARIA contract',
    publicNavbarExposesAriaContract(navbarPartial));
  ok('views/partials/navbar.ejs loads the shared public-nav client exactly once, deferred',
    publicNavbarLoadsSharedClient(navbarPartial));
  ok('public/js/public-nav.js routes all menu state through ONE setter and closes on every required trigger',
    publicNavClientHasSharedStateSetter(publicNavJs));
  ok('neither anonymous view reintroduces a page-local hamburger handler',
    anonymousViewHasNoLocalNavHandler(landingView) &&
    anonymousViewHasNoLocalNavHandler(privacyView));
  ok('both anonymous views render the shared navbar partial',
    /include\('partials\/navbar'\)/.test(landingView) &&
    /include\('partials\/navbar'\)/.test(privacyView));

  // Finding 3 — auth-scoped, in-card theme control.
  ok('views/auth.ejs places the theme control inside the auth card',
    authViewPlacesThemeToggleInCard(authView));
  ok('views/complete-registration.ejs places the theme control inside the auth card',
    authViewPlacesThemeToggleInCard(completeRegView));
  ok('auth theme CSS and the edit-profile modal preserve accessible interaction state',
    authScopedThemeToggleCssIsCorrect(siteCss) &&
    profileModalCssIsAccessible(siteCss) &&
    profileModalClientIsAccessible(profileJs));

  /* ---- owner-supplied searchable course catalog ---- */
  const courseCatalogPasses = (registration, profile, css) =>
    courseCatalogProblems(registration, profile, css, sampleData).length === 0;
  ok('registration and profile expose the exact searchable CSPC course catalog',
    courseCatalogPasses(completeRegView, profileJs, siteCss));
  ok('course catalog fixture rejects a changed registration title, profile title, search behavior, or touch target',
    sourceMutationIsRejected(
      completeRegView,
      /Bachelor of Science in Information Technology/g,
      'Bachelor of Science in Information Systems',
      (mutated) => courseCatalogPasses(mutated, profileJs, siteCss)) &&
    sourceMutationIsRejected(
      profileJs,
      /Bachelor of Science in Information Technology/g,
      'Bachelor of Science in Information Systems',
      (mutated) => courseCatalogPasses(completeRegView, mutated, siteCss)) &&
    sourceMutationIsRejected(
      profileJs,
      /search\.addEventListener\('input', renderOptions\);/,
      '',
      (mutated) => courseCatalogPasses(completeRegView, mutated, siteCss)) &&
    sourceMutationIsRejected(
      siteCss,
      /(\.course-search-input\s*\{[\s\S]{0,180}?)min-height:\s*44px;/,
      '$1',
      (mutated) => courseCatalogPasses(completeRegView, profileJs, mutated)));

  /* ---- rejecting fixtures: each mutates the REAL source ---- */
  ok('fixture: the superseded exclusive @cspc.edu.ph-only landing claim is rejected',
    !landingStatesTruthfulRoleMapping(landingView.replace(
      /Google sign-in supports[\s\S]*?are not accepted\./,
      'Google OAuth integration restricted to @cspc.edu.ph accounts ensures secure access.')));
  /* The refusal sentence is line-wrapped in the real view, so the mutation must
     tolerate whitespace; an exact-text replace silently matched nothing and let
     the fixture pass without mutating anything. */
  ok('fixture: landing copy dropping the student, guest, or refusal clause is rejected',
    !landingStatesTruthfulRoleMapping(landingView.replace(/@my\.cspc\.edu\.ph/g, '@example.edu')) &&
    !landingStatesTruthfulRoleMapping(landingView.replace(/Gmail/gi, 'other')) &&
    !landingStatesTruthfulRoleMapping(landingView.replace(/Other\s+email\s+domains\s+are\s+not\s+accepted/i, 'All domains welcome')));
  ok('fixture: empty / non-string landing input fails the mapping check closed',
    !landingStatesTruthfulRoleMapping('') && !landingStatesTruthfulRoleMapping(null) &&
    !landingStatesTruthfulRoleMapping(['x']));

  ok('fixture: a hamburger button missing aria-controls, aria-expanded, or the label is rejected',
    !publicNavbarExposesAriaContract(navbarPartial.replace(/aria-controls="navLinks"\s*/, '')) &&
    !publicNavbarExposesAriaContract(navbarPartial.replace(/aria-expanded="false"\s*/, '')) &&
    !publicNavbarExposesAriaContract(navbarPartial.replace(/aria-label="Open navigation menu"/, 'aria-label="Toggle menu"')));
  ok('fixture: a missing, non-deferred, or duplicated shared-client tag is rejected',
    !publicNavbarLoadsSharedClient(navbarPartial.replace(/<script[^>]*public-nav\.js[^>]*>/, '')) &&
    !publicNavbarLoadsSharedClient(navbarPartial.replace(/\sdefer/, '')) &&
    !publicNavbarLoadsSharedClient(navbarPartial + '\n<script src="/js/public-nav.js" defer></script>'));
  ok('fixture: a client that updates aria-expanded outside the single setter is rejected',
    !publicNavClientHasSharedStateSetter(publicNavJs +
      "\nhamburger.setAttribute('aria-expanded', 'true');\n"));
  /* Each mutation targets the CODE occurrence. The media-query literal and
     `navbar__link` also appear in the client's JSDoc header, so a first-match
     replace hit the comment and left the real handler intact. */
  ok('fixture: a client dropping Escape, outside-click, the desktop reset, or the nav-selection close is rejected',
    !publicNavClientHasSharedStateSetter(publicNavJs.replace(/'Escape'/, "'Enter'")) &&
    !publicNavClientHasSharedStateSetter(publicNavJs.replace(/'pointerdown'/, "'mouseover'")) &&
    !publicNavClientHasSharedStateSetter(
      publicNavJs.replace(/win\.matchMedia\('\(max-width: 768px\)'\)/, 'win.matchMedia()')) &&
    !publicNavClientHasSharedStateSetter(
      publicNavJs.replace(/classList\.contains\('navbar__link'\)/, "classList.contains('nope')")));
  ok('fixture: a reintroduced page-local hamburger handler is rejected',
    !anonymousViewHasNoLocalNavHandler(landingView +
      "\n<script>const h = document.getElementById('hamburger');</script>\n"));

  ok('fixture: a theme-toggle left outside the auth card is rejected',
    !authViewPlacesThemeToggleInCard(
      authView.replace(/\s*<%- include\('partials\/theme-toggle'\) %>/, '') +
      "\n<%- include('partials/theme-toggle') %>\n"));
  ok('fixture: a missing auth body class or a duplicated include is rejected',
    !authViewPlacesThemeToggleInCard(authView.replace('<body class="auth-body">', '<body>')) &&
    !authViewPlacesThemeToggleInCard(authView + "\n<%- include('partials/theme-toggle') %>\n"));
  ok('fixture: hidden auth controls or pointer-intercepting hidden modals are rejected',
    !authScopedThemeToggleCssIsCorrect(siteCss.replace(/(body\.auth-body \.auth-card \.theme-toggle \{)/, '$1\n    display: none;')) &&
    !authScopedThemeToggleCssIsCorrect(siteCss.replace(/(body\.auth-body \.auth-card \.theme-toggle \{[^}]*?)width:\s*44px/, '$1width: 24px')) &&
    !authScopedThemeToggleCssIsCorrect(siteCss.replace(/(body\.auth-body \.auth-card \.theme-toggle \{[^}]*?)bottom:\s*auto/, '$1bottom: 28px')) &&
    sourceMutationIsRejected(siteCss,
      /(\.edit-modal-overlay\s*\{[^}]*?)pointer-events:\s*none/, '$1pointer-events: auto',
      profileModalCssIsAccessible) &&
    sourceMutationIsRejected(siteCss,
      /(\.edit-modal-overlay\.show\s*\{[^}]*?)pointer-events:\s*auto/, '$1pointer-events: none',
      profileModalCssIsAccessible));
  ok('fixture: dropping containing blocks or modal accessibility state is rejected',
    !authScopedThemeToggleCssIsCorrect(siteCss.replace(/(body\.auth-body \.auth-card \{[^}]*?)position:\s*relative/, '$1position: static')) &&
    !authScopedThemeToggleCssIsCorrect(siteCss.replace(/body\.auth-body \.auth-card \.theme-toggle \{[^}]*\}/, '')) &&
    sourceMutationIsRejected(profileJs, 'aria-hidden="true" inert', 'aria-hidden="true"',
      profileModalClientIsAccessible) &&
    sourceMutationIsRejected(profileJs, "if (e.key === 'Escape')", "if (e.key === 'Enter')",
      profileModalClientIsAccessible) &&
    sourceMutationIsRejected(profileJs, 'if (e.target === overlay) closeModal();', 'closeModal();',
      profileModalClientIsAccessible) &&
    /* The focus trap must stay document-scoped and capture-phase. Rebinding it
       to the overlay reproduces the exact blocker: with focus on <body> the
       listener never fires and Tab escapes behind the open dialog. */
    sourceMutationIsRejected(profileJs,
      /document\.addEventListener\('keydown', handleModalKeydown, true\);/,
      "overlay.addEventListener('keydown', handleModalKeydown);",
      profileModalClientIsAccessible) &&
    sourceMutationIsRejected(profileJs,
      /document\.addEventListener\('keydown', handleModalKeydown, true\);/,
      "document.addEventListener('keydown', handleModalKeydown, false);",
      profileModalClientIsAccessible) &&
    !profileModalClientIsAccessible(
      profileJs.replace(/document\.addEventListener\('keydown', handleModalKeydown, true\);/, '') +
      "\noverlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });\n") &&
    /* A trap that is never detached keeps swallowing keys after close. */
    sourceMutationIsRejected(profileJs,
      /document\.removeEventListener\('keydown', handleModalKeydown, true\);\n/, '',
      profileModalClientIsAccessible) &&
    /* Without the recapture branch, Tab from outside the dialog advances into
       the page behind the modal instead of returning to it. */
    sourceMutationIsRejected(profileJs,
      /if \(!modalDialog\.contains\(document\.activeElement\)\) \{/, 'if (false) {',
      profileModalClientIsAccessible) &&
    /* M12.P1-D2: naming a navigation id in this file re-breaks the single-nav-
       owner contract, so the menu owner must stay a structural lookup. */
    !profileModalClientIsAccessible(
      profileJs.replace(/findMenuControllerFor\(focusTarget\)/,
        "document.getElementById('dashHamburger')")) &&
    !profileModalClientIsAccessible(
      profileJs + "\nconst strayMenu = document.getElementById('dashTabs');\n") &&
    sourceMutationIsRejected(profileJs,
      /querySelector\('\[aria-controls="' \+ node\.id \+ '"\]'\)/,
      "querySelector('[data-menu]')", profileModalClientIsAccessible) &&
    sourceMutationIsRejected(profileJs, /const findMenuControllerFor\s*=/,
      'const unusedLookup =', profileModalClientIsAccessible));
  ok('fixture: empty inputs and missing focus restoration fail all UI checks closed',
    !authViewPlacesThemeToggleInCard('') && !authViewPlacesThemeToggleInCard(null) &&
    !authScopedThemeToggleCssIsCorrect('') && !authScopedThemeToggleCssIsCorrect(null) &&
    !profileModalCssIsAccessible('') && !profileModalCssIsAccessible(null) &&
    !profileModalClientIsAccessible('') && !profileModalClientIsAccessible(null) &&
    sourceMutationIsRejected(
      profileJs,
      /if \(focusTarget && document\.contains\(focusTarget\)\) focusTarget\.focus\(\);/,
      '',
      profileModalClientIsAccessible) &&
    /* Tab wrapping alone is not enough: without open-time placement (and its
       verified retry past the overlay's `visibility: hidden` frame) focus never
       enters the dialog, which is the state the trap has to prevent. */
    sourceMutationIsRejected(profileJs,
      /\(focusable\[0\] \|\| modalDialog\)\.focus\(\);/, '',
      profileModalClientIsAccessible) &&
    sourceMutationIsRejected(profileJs,
      /if \(!modalDialog\.contains\(document\.activeElement\)\) modalDialog\.focus\(\);/, '',
      profileModalClientIsAccessible) &&
    /* A hidden owner swallows .focus(); without the candidate chain, closing the
       modal strands focus on <body>. */
    sourceMutationIsRejected(profileJs,
      /restoreCandidates = \[userContainer, findMenuControllerFor\(focusTarget\)\]/,
      'restoreCandidates = []', profileModalClientIsAccessible) &&
    sourceMutationIsRejected(profileJs,
      /if \(active && active !== document\.body && !overlay\.contains\(active\)\) return;/,
      'if (false) return;', profileModalClientIsAccessible) &&
    /* Restoring focus only AFTER the overlay is inert is the defect itself. */
    sourceMutationIsRejected(profileJs, /\n\s*restoreFocusToOwner\(\);\n/, '\n',
      profileModalClientIsAccessible) &&
    sourceMutationIsRejected(profileJs,
      /if \(document\.activeElement === candidate\) break;/, 'break;',
      profileModalClientIsAccessible) &&
    /* Setting `inert` blurs the dialog asynchronously, so a sync-only chain
       silently leaves focus on <body> at mobile widths. */
    sourceMutationIsRejected(profileJs,
      /\n\s*window\.requestAnimationFrame\(restoreFocusToOwner\);/, '',
      profileModalClientIsAccessible) &&
    !describesSafePilotRehearsalProtocol('') && !describesSafePilotRehearsalProtocol(null));

  return rec.failures;
}

/* ============ M12.P1-R7 Vercel package / static-CDN boundary gate ============
   Drives the SAME real analyzers the standalone probe exports, so the gate and
   the probe can never disagree, and adds negative fixtures that are independent
   of the live `.vercelignore` / `vercel.json`. Because the expected contract
   lives in probe CODE, a coordinated configuration-plus-preview edit still
   fails here unless that reviewed contract is explicitly changed.

   Static and database-free: no server, no listener, no network. The HTTP
   static-boundary evidence stays in the standalone probe. */
const R7_PROBE_SCRIPT = 'vercelPackageBoundary-probe.js';

/* The exact set of files whose SOURCE must stay auditable with ordinary text
   tooling, pinned INDEPENDENTLY of the probe. The live assertion below trusted
   `R7.R7_AUDITABLE_SOURCE_FILES` wholesale, so swapping `scripts/quality-gates.js`
   in that exported array for another existing NUL-free file (e.g. `package.json`)
   still satisfied a "4 existing NUL-free paths" check while silently dropping
   this very gate file from the audited set. This reviewed pin is compared for
   EXACT ORDERED EQUALITY against the exported list, so that substitution now
   fails. It is deliberately NOT imported, copied, aliased, spread, or derived
   from the probe. */
const EXPECTED_R7_AUDITABLE_SOURCE_FILES = Object.freeze([
  '.vercelignore',
  'vercel.json',
  'scripts/vercelPackageBoundary-probe.js',
  'scripts/quality-gates.js',
]);

/* M12.P1-R8. The exact label the focused probe must stamp on its package
   inventory, pinned INDEPENDENTLY of the probe for the same reason as the
   audited-source list above: a gate that reads the expected label out of the
   artifact it audits proves nothing.

   The superseded label asserted the inventory was a DIRTY-WORKTREE preview.
   That was true while the deployable application was uncommitted, but it
   contradicted docs/deployment.md once the clean snapshot was committed. The
   replacement is neutral about worktree state and keeps the disclaimer that
   matters: enumerating the package is not authorization to upload it.
   Deliberately plain ASCII (hyphen, not an em dash) so the string survives
   grep/diff across shells without encoding ambiguity. */
const EXPECTED_PACKAGE_INVENTORY_LABEL =
  'CURRENT VERCEL PACKAGE BOUNDARY INVENTORY - NOT DEPLOYMENT AUTHORIZATION';

/* The superseded label, pinned here so the gate can forbid it without the probe
   ever having to contain it. Built from an escape for the em dash so this
   constant stays pure ASCII on disk and survives grep/diff across shells. */
const SUPERSEDED_PACKAGE_INVENTORY_LABEL =
  'CURRENT DIRTY-WORKTREE BOUNDARY PREVIEW — NOT AN IMMUTABLE DEPLOYMENT MANIFEST';

/* M12.P1-R8 re-review finding: correcting the LABEL alone was not enough. The
   probe's header prose still asserted that "the worktree is intentionally
   dirty" and that the output was "a snapshot of the CURRENT worktree" — claims
   the probe cannot support, because it never inspects Git state, and which
   contradict the committed clean snapshot.

   These patterns are pinned INDEPENDENTLY of the probe and are checked against
   the probe SOURCE, not just its label, so equivalent wording cannot reappear
   in a comment while the label stays neutral. */
const STALE_WORKTREE_WORDING = Object.freeze([
  /worktree\s+is\s+intentionally\s+dirty/i,
  /intentionally\s+dirty\s+worktree/i,
  /snapshot\s+of\s+the\s+current\s+worktree/i,
  /current[-\s]worktree\s+(?:preview|snapshot|boundary|inventory)/i,
  /dirty[-\s]worktree/i,
  /dirty\s+(?:preview|snapshot)/i,
  /DIRTY-WORKTREE BOUNDARY PREVIEW/i,
]);

/**
 * PURE: does `value` carry stale worktree/dirty-preview wording, or the
 * superseded label? Fails CLOSED — a missing or non-string source is reported
 * as stale so an unreadable file can never silently satisfy the check.
 */
function containsStaleWorktreeWording(value) {
  if (typeof value !== 'string' || value === '') return true;
  if (value.includes(SUPERSEDED_PACKAGE_INVENTORY_LABEL)) return true;
  return STALE_WORKTREE_WORDING.some((re) => re.test(value));
}

/**
 * PURE: does `candidate` equal EXPECTED_R7_AUDITABLE_SOURCE_FILES exactly and in
 * order? True only for an array of the same length whose every entry is a string
 * identical to the pinned value at the same index. False for null, undefined,
 * any non-array, a wrong length (missing/extra), a substitution, a reorder, or a
 * same-length duplicate-plus-omission.
 */
function r7AuditableListMatchesExpected(candidate) {
  if (!Array.isArray(candidate)) return false;
  if (candidate.length !== EXPECTED_R7_AUDITABLE_SOURCE_FILES.length) return false;
  for (let i = 0; i < EXPECTED_R7_AUDITABLE_SOURCE_FILES.length; i++) {
    if (typeof candidate[i] !== 'string') return false;
    if (candidate[i] !== EXPECTED_R7_AUDITABLE_SOURCE_FILES[i]) return false;
  }
  return true;
}

function runVercelPackageBoundaryGate() {
  const rec = makeRecorder('vercel-package-boundary');
  const { ok } = rec;
  const crypto = require('crypto');
  const root = path.join(__dirname, '..');
  const readIf = (rel) => { const p = path.join(root, rel); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; };

  const R7 = require('./' + R7_PROBE_SCRIPT);

  /* ---- 1. the live allowlist ---- */
  const liveIgnore = readIf('.vercelignore');
  ok('.vercelignore exists and is non-empty', liveIgnore.trim() !== '');
  const liveParsed = R7.parseVercelIgnore(liveIgnore);
  ok('.vercelignore parses with no structural defect', liveParsed.ok === true);
  if (!liveParsed.ok) liveParsed.problems.forEach((p) => console.error('    - ignore: ' + p));
  ok('.vercelignore begins with the /* allowlist root',
    liveParsed.rules.length > 0 && liveParsed.rules[0].pattern === R7.ROOT_IGNORE_TOKEN &&
    liveParsed.rules[0].negated === false);
  const liveIgnoreProblems = R7.evaluateIgnoreContract(liveParsed);
  ok('.vercelignore satisfies the independently pinned allowlist contract',
    liveIgnoreProblems.length === 0);
  liveIgnoreProblems.forEach((p) => console.error('    - ignore-contract: ' + p));

  /* ---- 2. the live header configuration ---- */
  const liveVercelJson = readIf('vercel.json');
  ok('vercel.json exists and is non-empty', liveVercelJson.trim() !== '');
  const liveVj = R7.analyzeVercelJson(liveVercelJson);
  ok('vercel.json exposes exactly $schema and headers', liveVj.ok === true);
  if (!liveVj.ok) liveVj.problems.forEach((p) => console.error('    - vercel.json: ' + p));
  const liveHeaderProblems = R7.evaluateHeaderContract(liveVj.config);
  ok('the live header rules match the reviewed static/PWA contract exactly',
    liveHeaderProblems.length === 0);
  liveHeaderProblems.forEach((p) => console.error('    - headers: ' + p));

  /* Express keeps sole authority over dynamic CSP: the only static CSP is the
     session-neutral offline shell, and no rule uses a broad matcher. */
  ok('only /offline.html declares a static Content-Security-Policy',
    liveVj.config !== null && Array.isArray(liveVj.config.headers) &&
    liveVj.config.headers.every((r) => r && (r.source === R7.CSP_ALLOWED_SOURCE ||
      !(Array.isArray(r.headers) && r.headers.some((h) => h && /^content-security-policy$/i.test(String(h.key)))))));
  ok('no live header rule uses a broad or dynamic matcher',
    liveVj.config !== null && Array.isArray(liveVj.config.headers) &&
    liveVj.config.headers.every((r) => r && !R7.isBroadHeaderSource(r.source)));
  /* Express remains the sole CSP authority for dynamic responses: the
     per-request nonce is still generated and still the only script-src value
     beside 'self', and the middleware neither imports nor reproduces the
     static offline-shell policy that lives in vercel.json. */
  {
    const headersSrc = readIf(path.join('middleware', 'securityHeaders.js'));
    ok('middleware/securityHeaders.js still generates a per-request CSP nonce',
      /res\.locals\.cspNonce\s*=\s*crypto\.randomBytes\(/.test(headersSrc) &&
      /`'nonce-\$\{res\.locals\.cspNonce\}'`/.test(headersSrc));
    ok('middleware/securityHeaders.js still restricts script-src to self plus the nonce',
      /scriptSrc:\s*\["'self'",\s*nonce\]/.test(headersSrc));
    ok('R7 added no vercel.json coupling to the dynamic CSP middleware',
      !/require\([^)]*vercel/i.test(headersSrc) &&
      !headersSrc.includes(R7.EXPECTED_OFFLINE_CSP));
  }

  /* ---- 3. the exported Express entrypoint contract ---- */
  {
    const serverSrc = readIf('server.js');
    ok('server.js still exports the Express app', /module\.exports\s*=\s*app\s*;/.test(serverSrc));
    ok('server.js still listens only as the main module',
      /if\s*\(\s*require\.main\s*===\s*module\s*\)/.test(serverSrc));
    ok('no duplicate api/ entrypoint was added', !fs.existsSync(path.join(root, 'api')));
    ok('no .vercel project metadata was created', !fs.existsSync(path.join(root, '.vercel')));
  }

  /* ---- 4. the enumerated live package ---- */
  const liveManifest = R7.buildPackageManifest(root, liveParsed.rules);
  const liveFiles = liveManifest.files.map((entry) => entry.path);
  const livePackageProblems = R7.evaluatePackageContract(liveFiles);
  ok('the enumerated package satisfies the independently pinned contract',
    livePackageProblems.length === 0);
  livePackageProblems.forEach((p) => console.error('    - package: ' + p));
  const liveManifestProblems = R7.verifyManifestSelfConsistency(liveManifest);
  ok('the live package manifest is internally consistent', liveManifestProblems.length === 0);
  liveManifestProblems.forEach((p) => console.error('    - manifest: ' + p));
  const livePinProblems = currentPackageInventoryProblems(liveManifest, EXPECTED_LIVE_PACKAGE_INVENTORY);
  ok('the live package manifest matches the quality gate independent file-count, byte-total, and SHA-256 pin',
    livePinProblems.length === 0 && R7.evaluatePinnedPackageManifest(liveManifest).length === 0);
  livePinProblems.forEach((p) => console.error('    - package-pin: ' + p));
  ok('the enumerated package contains no path inside the denied panorama subtree',
    liveFiles.every((p) => !/^public\/img\/sample 360(\/|$)/i.test(p)));
  ok('every enumerated path is normalized, relative, and traversal-free',
    liveFiles.every((p) => p === R7.toPosix(p) && !p.startsWith('/') &&
      !/^[A-Za-z]:/.test(p) && !p.split('/').includes('..')));
  ok('no package manifest or deployment archive was written into the repository',
    !fs.existsSync(path.join(root, 'vercel-package-manifest.json')) &&
    !fs.existsSync(path.join(root, '.vercel-package')) &&
    !fs.readdirSync(root).some((n) => /\.(zip|tar|tgz|tar\.gz)$/i.test(n)));

  /* =========================== NEGATIVE FIXTURES ===========================
     Pinned independently of the live files: a canonical compliant body is
     mutated one defect at a time and driven through the REAL analyzers. */
  const DIRS = R7.EXPECTED_RUNTIME_DIRS;
  const FIXTURE_LINES = [
    '/*',
    ...R7.EXPECTED_ROOT_FILES.map((f) => '!' + f),
    ...DIRS.flatMap((d) => ['!' + d, '!' + d + '/**']),
    ...R7.EXPECTED_DENIED_SUBTREES.flatMap((s) => [s + '/', s + '/**']),
  ];
  const fixture = (mutate) => {
    const lines = mutate ? mutate([...FIXTURE_LINES]) : [...FIXTURE_LINES];
    return lines.join('\n') + '\n';
  };
  /** A fixture is REJECTED when parsing fails or the contract reports a problem. */
  const ignoreRejected = (text) => {
    const parsed = R7.parseVercelIgnore(text);
    if (!parsed.ok) return true;
    return R7.evaluateIgnoreContract(parsed).length > 0;
  };
  const withLine = (line) => fixture((l) => { l.push(line); return l; });
  const withoutLine = (needle) => fixture((l) => l.filter((x) => x !== needle));

  ok('fixture: the canonical allowlist body passes the real analyzers',
    ignoreRejected(fixture()) === false);

  ok('fixture: a missing or altered root /* is rejected',
    ignoreRejected(withoutLine('/*')) === true &&
    ignoreRejected(fixture((l) => { l[0] = '/**'; return l; })) === true &&
    ignoreRejected(fixture((l) => { l[0] = '*'; return l; })) === true &&
    ignoreRejected(fixture((l) => { l.splice(1, 0, '/*'); l[0] = '!server.js'; return l; })) === true);

  ok('fixture: re-including an .env, docs/handoff, scripts/tests, or database path is rejected',
    ignoreRejected(withLine('!.env')) === true &&
    ignoreRejected(withLine('!.env.example')) === true &&
    ignoreRejected(withLine('!docs')) === true &&
    ignoreRejected(withLine('!plan.md')) === true &&
    ignoreRejected(withLine('!scripts')) === true &&
    ignoreRejected(withLine('!scripts/**')) === true &&
    ignoreRejected(withLine('!database')) === true &&
    ignoreRejected(withLine('!database/supabase/**')) === true);

  ok('fixture: re-including screenshots, Docker, local-tool, temporary, or node_modules paths is rejected',
    ignoreRejected(withLine('!layout bug.png')) === true &&
    ignoreRejected(withLine('!Dockerfile')) === true &&
    ignoreRejected(withLine('!docker-compose.yml')) === true &&
    ignoreRejected(withLine('!.claude')) === true &&
    ignoreRejected(withLine('!.playwright-mcp')) === true &&
    ignoreRejected(withLine('!node_modules')) === true &&
    ignoreRejected(withLine('!tmp')) === true &&
    ignoreRejected(withLine('!.git')) === true);

  ok('fixture: re-including the sample-360 subtree after its denial is rejected',
    ignoreRejected(withLine('!public/img/sample 360/**')) === true &&
    ignoreRejected(withLine('!public/img/sample 360')) === true);

  ok('fixture: dropping the sample-360 denial is rejected',
    ignoreRejected(withoutLine('public/img/sample 360/')) === true &&
    ignoreRejected(withoutLine('public/img/sample 360/**')) === true);

  ok('fixture: a missing required root file or runtime directory is rejected',
    ignoreRejected(withoutLine('!server.js')) === true &&
    ignoreRejected(withoutLine('!package-lock.json')) === true &&
    ignoreRejected(withoutLine('!vercel.json')) === true &&
    ignoreRejected(withoutLine('!repositories')) === true &&
    ignoreRejected(withoutLine('!repositories/**')) === true &&
    ignoreRejected(withoutLine('!public')) === true);

  ok('fixture: reordering the denial before the public re-inclusion is rejected',
    ignoreRejected(fixture((l) => {
      const kept = l.filter((x) => !x.startsWith('public/img/sample 360'));
      const at = kept.indexOf('!public');
      kept.splice(at, 0, 'public/img/sample 360/', 'public/img/sample 360/**');
      return kept;
    })) === true);

  ok('fixture: a duplicate or case-fold-colliding rule is rejected',
    ignoreRejected(withLine('!config')) === true &&
    ignoreRejected(withLine('!Config')) === true &&
    ignoreRejected(withLine('public/img/Sample 360/')) === true);

  ok('fixture: traversal, absolute-path, and separator ambiguity are rejected',
    ignoreRejected(withLine('!config/..')) === true &&
    ignoreRejected(withLine('!../secrets')) === true &&
    ignoreRejected(withLine('!/config')) === true &&
    ignoreRejected(withLine('C:/config')) === true &&
    ignoreRejected(withLine('!config//**')) === true &&
    ignoreRejected(withLine('!config\\**')) === true);

  ok('fixture: encoded or malformed space variants are rejected',
    ignoreRejected(withLine('public/img/sample%20360/**')) === true &&
    ignoreRejected(withLine('public/img/sample  360/')) === true &&
    ignoreRejected(withLine('!views ')) === true &&
    ignoreRejected(withLine(' !views')) === true &&
    ignoreRejected(withLine('!views\t')) === true);

  ok('fixture: an empty or rule-free ignore file fails closed',
    R7.parseVercelIgnore('').ok === false &&
    R7.parseVercelIgnore('   \n\n').ok === false &&
    R7.parseVercelIgnore('# only a comment\n').ok === false);

  /* ---- path-resolution fixtures (ancestor-aware inclusion) ---- */
  {
    const rules = R7.parseVercelIgnore(fixture()).rules;
    ok('fixture: allowlisted runtime paths resolve as included',
      R7.pathIsIncluded(rules, 'server.js') === true &&
      R7.pathIsIncluded(rules, 'config/db.js') === true &&
      R7.pathIsIncluded(rules, 'views/partials/head.ejs') === true &&
      R7.pathIsIncluded(rules, 'public/vendor/leaflet/leaflet.js') === true);
    ok('fixture: excluded classes resolve as excluded, including nested paths',
      R7.pathIsIncluded(rules, '.env') === false &&
      R7.pathIsIncluded(rules, '.env.example') === false &&
      R7.pathIsIncluded(rules, 'docs/deployment.md') === false &&
      R7.pathIsIncluded(rules, 'scripts/quality-gates.js') === false &&
      R7.pathIsIncluded(rules, 'database/supabase/0019_be5_selected_demo_parity.sql') === false &&
      R7.pathIsIncluded(rules, 'node_modules/express/index.js') === false &&
      R7.pathIsIncluded(rules, 'plan.md') === false &&
      R7.pathIsIncluded(rules, 'Dockerfile') === false &&
      R7.pathIsIncluded(rules, '.git/config') === false);
    ok('fixture: the denied panorama subtree and its contents resolve as excluded',
      R7.pathIsIncluded(rules, 'public/img/sample 360') === false &&
      R7.pathIsIncluded(rules, 'public/img/sample 360/anything.jpg') === false &&
      R7.pathIsIncluded(rules, 'public/img/cspc-logo.png') === true);
  }

  /* ---- package-contract fixtures ---- */
  {
    const base = R7.EXPECTED_ROOT_FILES.concat(
      DIRS.map((d) => d + '/placeholder.js'),
      R7.EXPECTED_VENDOR_RUNTIME_FILES,
      R7.EXPECTED_OFFLINE_MAP_RUNTIME_FILES,
      [R7.EXPECTED_VENDOR_MANIFEST_FILE,
        'public/css/styles.css', 'public/js/pwa.js', 'public/img/cspc-logo.png',
        'public/img/icons/icon-192.png', 'public/manifest.webmanifest',
        'public/offline.html', 'public/sw.js']);
    ok('fixture: a compliant package file list is accepted',
      R7.evaluatePackageContract(base).length === 0);
    ok('fixture: a missing root file, runtime directory, or public asset class is rejected',
      R7.evaluatePackageContract(base.filter((p) => p !== 'server.js')).length > 0 &&
      R7.evaluatePackageContract(base.filter((p) => p !== 'repositories/placeholder.js')).length > 0 &&
      R7.evaluatePackageContract(base.filter((p) => p !== 'public/sw.js')).length > 0 &&
      R7.evaluatePackageContract(base.filter((p) => p !== 'public/offline.html')).length > 0 &&
      R7.evaluatePackageContract(base.filter((p) => p !== 'public/manifest.webmanifest')).length > 0);
    ok('fixture: a missing vendored runtime file or vendor manifest is rejected',
      R7.evaluatePackageContract(base.filter((p) => p !== 'public/vendor/leaflet/leaflet.js')).length > 0 &&
      R7.evaluatePackageContract(base.filter((p) => p !== 'public/vendor/pannellum/pannellum.js')).length > 0 &&
      R7.evaluatePackageContract(base.filter((p) => p !== R7.EXPECTED_OFFLINE_MAP_RUNTIME_FILES[0])).length > 0 &&
      R7.evaluatePackageContract(base.filter((p) => p !== R7.EXPECTED_VENDOR_MANIFEST_FILE)).length > 0);
    const forbidden = [
      '.env', '.env.example', 'plan.md', 'docs/deployment.md',
      'scripts/quality-gates.js', 'database/schema.sql',
      'database/supabase/0019_be5_selected_demo_parity.sql',
      'layout bug.png', 'MANUSCRIPT_TEAMDUTCHESS.pdf',
      'CampuSphere_Presentation_Script.html', 'Dockerfile', '.dockerignore',
      'docker-compose.yml', '.claude/settings.json', '.codex/notes.md',
      '.playwright-mcp/trace.zip', 'node_modules/express/index.js',
      'logs/app.log', 'tmp/scratch.tmp', '.gitignore', '.git/config',
      'public/img/sample 360/panorama.jpg',
    ];
    ok('fixture: every forbidden path class is rejected when added to the package',
      forbidden.every((p) => R7.evaluatePackageContract(base.concat([p])).length > 0));
    ok('fixture: a forbidden-class report names the class and count, never a filename',
      R7.evaluatePackageContract(base.concat(['public/img/sample 360/panorama.jpg']))
        .every((m) => !m.includes('panorama.jpg')));
  }

  /* ---- header-contract fixtures ---- */
  {
    const canonical = () => ({
      $schema: R7.EXPECTED_SCHEMA,
      headers: JSON.parse(JSON.stringify(R7.EXPECTED_HEADER_RULES)),
    });
    const json = (obj) => JSON.stringify(obj);
    const rejectedJson = (obj) => {
      const a = R7.analyzeVercelJson(json(obj));
      return !a.ok || R7.evaluateHeaderContract(a.config).length > 0;
    };
    ok('fixture: the canonical header configuration is accepted',
      rejectedJson(canonical()) === false);
    ok('fixture: malformed or non-object vercel.json fails closed',
      R7.analyzeVercelJson('').ok === false &&
      R7.analyzeVercelJson('{').ok === false &&
      R7.analyzeVercelJson('[]').ok === false &&
      R7.analyzeVercelJson('null').ok === false);
    ok('fixture: an extra or missing top-level key is rejected',
      rejectedJson(Object.assign(canonical(), { version: 2 })) === true &&
      rejectedJson(Object.assign(canonical(), { name: 'campusphere' })) === true &&
      rejectedJson({ headers: canonical().headers }) === true &&
      rejectedJson({ $schema: R7.EXPECTED_SCHEMA }) === true);
    ok('fixture: builds/functions/routes/rewrites/redirects are rejected',
      rejectedJson(Object.assign(canonical(), { builds: [] })) === true &&
      rejectedJson(Object.assign(canonical(), { functions: {} })) === true &&
      rejectedJson(Object.assign(canonical(), { routes: [] })) === true &&
      rejectedJson(Object.assign(canonical(), { rewrites: [] })) === true &&
      rejectedJson(Object.assign(canonical(), { redirects: [] })) === true);
    ok('fixture: framework, build, install, and output overrides are rejected',
      rejectedJson(Object.assign(canonical(), { framework: 'express' })) === true &&
      rejectedJson(Object.assign(canonical(), { buildCommand: 'npm run build' })) === true &&
      rejectedJson(Object.assign(canonical(), { installCommand: 'npm ci' })) === true &&
      rejectedJson(Object.assign(canonical(), { outputDirectory: 'public' })) === true &&
      rejectedJson(Object.assign(canonical(), { devCommand: 'npm run dev' })) === true);
    ok('fixture: a wrong $schema is rejected',
      rejectedJson(Object.assign(canonical(), { $schema: 'https://example.invalid/vercel.json' })) === true);
    ok('fixture: a missing, duplicated, or reordered header rule is rejected',
      rejectedJson({ $schema: R7.EXPECTED_SCHEMA, headers: canonical().headers.slice(1) }) === true &&
      rejectedJson({ $schema: R7.EXPECTED_SCHEMA, headers: canonical().headers.concat([canonical().headers[0]]) }) === true &&
      rejectedJson({ $schema: R7.EXPECTED_SCHEMA, headers: canonical().headers.slice().reverse() }) === true);
    ok('fixture: a broadened header source is rejected',
      rejectedJson({
        $schema: R7.EXPECTED_SCHEMA,
        headers: canonical().headers.map((r, i) => (i === 0 ? Object.assign({}, r, { source: '/:path*' }) : r)),
      }) === true &&
      rejectedJson({
        $schema: R7.EXPECTED_SCHEMA,
        headers: canonical().headers.concat([{ source: '/(.*)', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }] }]),
      }) === true);
    ok('fixture: an altered, added, or dropped header key/value is rejected',
      rejectedJson({
        $schema: R7.EXPECTED_SCHEMA,
        headers: canonical().headers.map((r, i) => (i === 0
          ? { source: r.source, headers: [{ key: 'X-Content-Type-Options', value: 'sniff' }] } : r)),
      }) === true &&
      rejectedJson({
        $schema: R7.EXPECTED_SCHEMA,
        headers: canonical().headers.map((r) => (r.source === '/sw.js'
          ? { source: r.source, headers: r.headers.filter((h) => h.key !== 'Service-Worker-Allowed') } : r)),
      }) === true &&
      rejectedJson({
        $schema: R7.EXPECTED_SCHEMA,
        headers: canonical().headers.map((r) => (r.source === '/offline.html'
          ? { source: r.source, headers: r.headers.map((h) => (h.key === 'Content-Security-Policy'
            ? { key: h.key, value: h.value.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'") } : h)) } : r)),
      }) === true);
    ok('fixture: a catch-all or dynamic-route CSP is rejected',
      rejectedJson({
        $schema: R7.EXPECTED_SCHEMA,
        headers: canonical().headers.concat([{ source: '/(.*)', headers: [{ key: 'Content-Security-Policy', value: "default-src 'self'" }] }]),
      }) === true &&
      rejectedJson({
        $schema: R7.EXPECTED_SCHEMA,
        headers: canonical().headers.concat([{ source: '/dashboard', headers: [{ key: 'Content-Security-Policy', value: "default-src 'self'" }] }]),
      }) === true);
    ok('fixture: long-lived immutable caching on a non-hashed asset URL is rejected',
      rejectedJson({
        $schema: R7.EXPECTED_SCHEMA,
        headers: canonical().headers.map((r, i) => (i === 0
          ? { source: r.source, headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] } : r)),
      }) === true &&
      R7.isContentHashedAssetSource('/maps/cspc-campus-' + 'a'.repeat(64) + '.pmtiles') === true &&
      R7.isContentHashedAssetSource('/maps/cspc-campus.pmtiles') === false);
    ok('fixture: the broad-source detector accepts narrow sources and flags wildcards',
      R7.isBroadHeaderSource('/css/:path*') === false &&
      R7.isBroadHeaderSource('/sw.js') === false &&
      R7.isBroadHeaderSource('/offline.html') === false &&
      R7.isBroadHeaderSource('/manifest.webmanifest') === false &&
      R7.isBroadHeaderSource('/') === true &&
      R7.isBroadHeaderSource('/:path*') === true &&
      R7.isBroadHeaderSource('/(.*)') === true &&
      R7.isBroadHeaderSource('/**') === true &&
      R7.isBroadHeaderSource('') === true);
  }

  /* ---- preview-manifest falsification fixtures ---- */
  {
    const files = [
      { path: 'server.js', bytes: 3, sha256: crypto.createHash('sha256').update('abc').digest('hex') },
      { path: 'config/db.js', bytes: 2, sha256: crypto.createHash('sha256').update('de').digest('hex') },
    ];
    const good = {
      label: R7.PREVIEW_LABEL,
      files,
      fileCount: 2,
      byteTotal: 5,
      aggregateSha256: R7.computeAggregateSha256(files),
      skippedNonRegularEntries: 0,
    };
    const clone = () => JSON.parse(JSON.stringify(good));
    const syntheticPin = { files: 2, bytes: '5', sha256: good.aggregateSha256 };
    ok('fixture: a consistent preview manifest is accepted',
      R7.verifyManifestSelfConsistency(good).length === 0 &&
      currentPackageInventoryProblems(good, syntheticPin).length === 0 &&
      R7.evaluatePinnedPackageManifest(liveManifest).length === 0);
    ok('fixture: a falsified file count, byte total, or aggregate hash is rejected',
      R7.verifyManifestSelfConsistency(Object.assign(clone(), { fileCount: 3 })).length > 0 &&
      R7.verifyManifestSelfConsistency(Object.assign(clone(), { byteTotal: 9999 })).length > 0 &&
      R7.verifyManifestSelfConsistency(Object.assign(clone(), { aggregateSha256: 'f'.repeat(64) })).length > 0 &&
      currentPackageInventoryProblems(Object.assign(clone(), { fileCount: 3 }), syntheticPin).length > 0 &&
      currentPackageInventoryProblems(Object.assign(clone(), { byteTotal: 9999 }), syntheticPin).length > 0 &&
      currentPackageInventoryProblems(Object.assign(clone(), { aggregateSha256: 'f'.repeat(64) }), syntheticPin).length > 0);
    ok('fixture: a falsified per-file size or hash is rejected',
      R7.verifyManifestSelfConsistency((() => { const m = clone(); m.files[0].bytes = 99; return m; })()).length > 0 &&
      R7.verifyManifestSelfConsistency((() => { const m = clone(); m.files[0].sha256 = 'a'.repeat(64); return m; })()).length > 0 &&
      R7.verifyManifestSelfConsistency((() => { const m = clone(); m.files[0].sha256 = 'not-a-hash'; return m; })()).length > 0 &&
      (() => {
        const changed = JSON.parse(JSON.stringify(liveManifest));
        changed.files[0].bytes += 1;
        changed.files[0].sha256 = changed.files[0].sha256 === 'a'.repeat(64)
          ? 'f'.repeat(64) : 'a'.repeat(64);
        changed.byteTotal = changed.files.reduce((sum, entry) => sum + entry.bytes, 0);
        changed.aggregateSha256 = R7.computeAggregateSha256(changed.files);
        return R7.verifyManifestSelfConsistency(changed).length === 0 &&
          R7.evaluatePinnedPackageManifest(changed).length > 0 &&
          currentPackageInventoryProblems(changed).length > 0;
      })());
    ok('fixture: a missing preview label, duplicated path, or backslash path is rejected',
      R7.verifyManifestSelfConsistency(Object.assign(clone(), { label: 'deployment manifest' })).length > 0 &&
      R7.verifyManifestSelfConsistency((() => { const m = clone(); m.files[1].path = 'server.js'; m.aggregateSha256 = R7.computeAggregateSha256(m.files); m.byteTotal = 5; return m; })()).length > 0 &&
      R7.verifyManifestSelfConsistency((() => { const m = clone(); m.files[1].path = 'config\\db.js'; m.aggregateSha256 = R7.computeAggregateSha256(m.files); return m; })()).length > 0);
    ok('fixture: the aggregate hash is order-independent but content-sensitive',
      R7.computeAggregateSha256(files) === R7.computeAggregateSha256([...files].reverse()) &&
      R7.computeAggregateSha256(files) !== R7.computeAggregateSha256(
        files.map((f, i) => (i === 0 ? Object.assign({}, f, { sha256: 'b'.repeat(64) }) : f))));
    ok('fixture: a missing manifest fails closed',
      R7.verifyManifestSelfConsistency(null).length > 0 &&
      R7.verifyManifestSelfConsistency({}).length > 0);
  }

  /* ---- the focused R7 probe stays standalone ---- */
  {
    const src = readIf(path.join('scripts', R7_PROBE_SCRIPT));
    ok('the R7 focused probe exists', src !== '');
    /* Real require-detection, not a substring scan: the probe's own header
       comment legitimately NAMES these modules while explaining that it does
       not use them, and a naive `src.includes(...)` would flag that prose. */
    ok('the R7 focused probe imports no database, Supabase, or server-harness module',
      !requiresModule(src, '../config/db') &&
      !requiresModule(src, '../config/supabase') &&
      !requiresModule(src, './with-server'));
    ok('the R7 focused probe imports no regression credential or session lifecycle module',
      !requiresModule(src, './regressionCredentials') &&
      !requiresModule(src, './probeSessionLifecycle'));
    ok('the R7 focused probe performs no application login',
      !/['"`]\/login['"`]/.test(src) && !/\/logout/.test(src));
    ok('the R7 focused probe writes no manifest or archive into the repository',
      !/fs\.writeFileSync\(\s*path\.join\(\s*ROOT/.test(src) &&
      !/fs\.createWriteStream\(\s*path\.join\(\s*ROOT/.test(src) &&
      !/fs\.mkdtempSync\(\s*path\.join\(\s*ROOT/.test(src));
    ok('the R7 focused probe builds its temporary static root outside the repository',
      /fs\.mkdtempSync\(\s*path\.join\(os\.tmpdir\(\)/.test(src) &&
      /fs\.rmSync\(staticRoot,\s*\{\s*recursive:\s*true/.test(src));
    /* M12.P1-R8 neutral package-inventory label.
       Pinned HERE, independently of the probe, exactly like
       EXPECTED_R7_AUDITABLE_SOURCE_FILES: the gate must not learn the expected
       label from the artifact it is auditing. The former dirty-worktree label
       became false once the clean snapshot was committed, so it is now
       forbidden outright — a revert to it fails this gate. */
    ok('the R7 focused probe carries the exact independently pinned neutral inventory label',
      src.includes(EXPECTED_PACKAGE_INVENTORY_LABEL));
    /* Scans the whole probe SOURCE, not just the label: the R8 re-review found
       the header prose still claiming an intentionally dirty worktree and a
       "snapshot of the CURRENT worktree" while the label itself was already
       neutral. Fails closed on an unreadable source. */
    ok('the R7 focused probe source carries no stale worktree or dirty-preview wording',
      !containsStaleWorktreeWording(src));
    ok('the R7 focused probe source does not carry the superseded inventory label',
      !src.includes(SUPERSEDED_PACKAGE_INVENTORY_LABEL));
    ok('the R7 focused probe states its inventory does not establish Git cleanliness or authorize deployment',
      /does NOT itself establish/i.test(src) &&
      /committed, clean, or immutable/i.test(src) &&
      /not deployment authorization/i.test(src));
    ok('the R7 focused probe still rejects a manifest whose label does not match',
      /manifest\.label\s*!==\s*PREVIEW_LABEL/.test(src));

    /* Positive-neutral and negative stale-wording fixtures for the wording
       predicate. Each stale phrase is exercised individually so a partial
       revert cannot pass. */
    {
      const NEUTRAL =
        'OUTPUT. The package inventory is CONSOLE-ONLY. It reflects the bytes currently ' +
        'present in the repository at the moment it runs. It does NOT itself establish ' +
        'that those bytes are committed, clean, or immutable, and it is NOT deployment ' +
        'authorization.';
      ok('wording fixture :: neutral inventory wording is accepted',
        !containsStaleWorktreeWording(NEUTRAL));
      ok('wording fixture :: "the worktree is intentionally dirty" is rejected',
        containsStaleWorktreeWording(NEUTRAL + ' Because the worktree is intentionally dirty, ...'));
      ok('wording fixture :: an "intentionally dirty worktree" variant is rejected',
        containsStaleWorktreeWording(NEUTRAL + ' Preserve the intentionally dirty worktree.'));
      ok('wording fixture :: "a snapshot of the CURRENT worktree" is rejected',
        containsStaleWorktreeWording(NEUTRAL + ' It is a snapshot of the CURRENT worktree.'));
      ok('wording fixture :: a current-worktree preview variant is rejected',
        containsStaleWorktreeWording(NEUTRAL + ' See the current-worktree preview above.'));
      ok('wording fixture :: a dirty-worktree variant is rejected',
        containsStaleWorktreeWording(NEUTRAL + ' This is the dirty-worktree boundary output.'));
      ok('wording fixture :: a dirty-preview variant is rejected',
        containsStaleWorktreeWording(NEUTRAL + ' Emitted as a dirty preview only.'));
      ok('wording fixture :: the superseded label embedded in prose is rejected',
        containsStaleWorktreeWording(NEUTRAL + ' ' + SUPERSEDED_PACKAGE_INVENTORY_LABEL));
      ok('wording fixture :: empty and non-string sources fail closed',
        containsStaleWorktreeWording('') && containsStaleWorktreeWording(null) &&
        containsStaleWorktreeWording(undefined) && containsStaleWorktreeWording(['x']));
    }

    /* Rejecting fixtures for the label predicate itself. Built here so the gate
       proves the contract rather than trusting the probe's own wording. */
    {
      const labelOk = (candidate) => candidate === EXPECTED_PACKAGE_INVENTORY_LABEL;
      ok('label fixture :: the exact neutral label is accepted',
        labelOk('CURRENT VERCEL PACKAGE BOUNDARY INVENTORY - NOT DEPLOYMENT AUTHORIZATION'));
      ok('label fixture :: the superseded dirty-worktree label is rejected',
        !labelOk(SUPERSEDED_PACKAGE_INVENTORY_LABEL));
      ok('label fixture :: a label that drops the authorization disclaimer is rejected',
        !labelOk('CURRENT VERCEL PACKAGE BOUNDARY INVENTORY'));
      ok('label fixture :: a label that claims deployment authorization is rejected',
        !labelOk('CURRENT VERCEL PACKAGE BOUNDARY INVENTORY - DEPLOYMENT AUTHORIZATION'));
      ok('label fixture :: case and whitespace variants are rejected',
        !labelOk('current vercel package boundary inventory - not deployment authorization') &&
        !labelOk(' CURRENT VERCEL PACKAGE BOUNDARY INVENTORY - NOT DEPLOYMENT AUTHORIZATION'));
      ok('label fixture :: empty and non-string input is rejected',
        !labelOk('') && !labelOk(null) && !labelOk(undefined) && !labelOk(['x']));
    }
    ok('the R7 focused probe binds only its own dedicated port',
      /STATIC_PORT\s*=\s*3385\b/.test(src) &&
      /\.listen\(STATIC_PORT,\s*'127\.0\.0\.1'/.test(src) &&
      !/\.listen\(\s*3\d{3}/.test(src) &&
      !/net\.connect\(\s*3\d{3}/.test(src));
    ok('the R7 focused probe never kills a process',
      !/process\.kill\(/.test(src) && !/taskkill/i.test(src) && !/child_process/.test(src));
  }

  /* ---- source auditability: no literal NUL byte in any R7 source file ----
     A single literal 0x00 byte makes rg/grep/git-diff classify a UTF-8 source
     file as binary and print "binary file matches" instead of the matching
     line, silently removing the file from human and automated source review.
     The aggregate separator must therefore be the TEXTUAL `\0` escape, never a
     literal byte. Files are read as RAW BUFFERS: a utf8 decode would erase the
     distinction the check exists to enforce. */
  {
    /* Establish EXACT ORDERED EQUALITY between the probe's exported list and the
       independent reviewed pin FIRST. Only then does a clean byte scan mean the
       reviewed files are clean — otherwise the probe could silently drop this
       gate file from the audited set and still pass. The scan runs over the
       independently pinned list, never solely the untrusted exported one. */
    const listMatches = r7AuditableListMatchesExpected(R7.R7_AUDITABLE_SOURCE_FILES);
    const offenders = EXPECTED_R7_AUDITABLE_SOURCE_FILES.filter((rel) => {
      let bytes = null;
      try { bytes = fs.readFileSync(path.join(root, rel)); } catch (e) { bytes = null; }
      return R7.containsLiteralNulByte(bytes); // missing/unreadable fails closed
    });
    ok('every R7 source file exists and contains no literal NUL byte',
      listMatches &&
      offenders.length === 0 &&
      EXPECTED_R7_AUDITABLE_SOURCE_FILES.every((rel) => fs.existsSync(path.join(root, rel))));
    if (!listMatches) console.error('    - source: exported R7 auditable list does not match the independently pinned list');
    offenders.forEach((rel) => console.error('    - source: literal NUL byte or unreadable file: ' + rel));

    /* Every NUL-bearing fixture is BUILT AT RUNTIME from byte arrays. Writing
       one as a literal source string would put the very byte this gate forbids
       into this file — which is exactly how the original defect was authored,
       and it recurred here until this gate caught it. */
    ok('fixture: the NUL detector rejects a literal byte, accepts textual \\0, and fails closed',
      // [a, NUL, b] — a real literal NUL byte is rejected.
      R7.containsLiteralNulByte(Buffer.from([0x61, 0x00, 0x62])) === true &&
      // [a, \, 0, b] — the TEXTUAL two-character `\0` escape is accepted.
      R7.containsLiteralNulByte(Buffer.from([0x61, 0x5c, 0x30, 0x62])) === false &&
      // Non-Buffer input fails closed, including a DECODED string that still
      // carries the NUL character: decoding is what erases the distinction.
      R7.containsLiteralNulByte(null) === true &&
      R7.containsLiteralNulByte(undefined) === true &&
      R7.containsLiteralNulByte(Buffer.from([0x61, 0x00, 0x62]).toString('latin1')) === true &&
      R7.containsLiteralNulByte([0x61, 0x00]) === true &&
      R7.containsLiteralNulByte({ length: 1 }) === true);

    /* The exact-ordered-equality pin: a probe that swaps this gate file out of
       its exported audited set (or reorders/duplicates/pads it) must fail, so a
       fail-open substitution can never masquerade as four clean NUL-free files.
       Fixture arrays are built at runtime; no repository file is touched. */
    const E = EXPECTED_R7_AUDITABLE_SOURCE_FILES;
    ok('fixture: the audited-source list is pinned by exact ordered equality',
      // canonical passes
      r7AuditableListMatchesExpected(E.slice()) === true &&
      // final path substituted with package.json fails
      r7AuditableListMatchesExpected([E[0], E[1], E[2], 'package.json']) === false &&
      // reordered list fails
      r7AuditableListMatchesExpected([E[1], E[0], E[2], E[3]]) === false &&
      // same length, duplicate one required path and omit another, fails
      r7AuditableListMatchesExpected([E[0], E[1], E[2], E[2]]) === false &&
      // canonical plus one extra path fails
      r7AuditableListMatchesExpected(E.concat(['README.md'])) === false &&
      // a missing entry (short list) fails
      r7AuditableListMatchesExpected([E[0], E[1], E[2]]) === false &&
      // non-array / null / undefined / non-string entries fail closed
      r7AuditableListMatchesExpected(null) === false &&
      r7AuditableListMatchesExpected(undefined) === false &&
      r7AuditableListMatchesExpected('scripts/quality-gates.js') === false &&
      r7AuditableListMatchesExpected([E[0], E[1], E[2], 1234]) === false);
  }

  return rec.failures;
}

/* ------------------ static docs-current hardening gate (L7) ------------------ */
/* =============================================================================
   Reusable grounding-prompt validation (M12.P1-R5 follow-up)
   =============================================================================
   docs/new-session-grounding-prompts.md is NOT an archive: every fenced block in
   it is meant to be copied into a fresh session, so a stale body actively
   misinforms the next Codex/Claude run. The authority documents are different —
   their fenced blocks legitimately archive historical prompts — so the existing
   stripFencedBlocks() behaviour used there is deliberately left unchanged and
   this file gets its own dedicated extractor instead.

   Extraction is structural and fail-closed: exactly one heading each, exactly
   one complete fenced block per section, non-empty bodies. Each body is then
   validated INDEPENDENTLY, so a current Codex prompt can never mask a stale
   Claude prompt. */

const REUSABLE_PROMPT_HEADINGS = Object.freeze({
  codex: '## Codex Grounding Prompt',
  claude: '## Claude Code Grounding Prompt',
});

/**
 * PURE: extract the two reusable prompt bodies.
 *
 * @param {string} doc file contents
 * @returns {{codex: string, claude: string}|null} null on ANY structural defect:
 *   missing or duplicated heading; a missing, unclosed, duplicated, bare, or
 *   non-text-language fence; or an empty prompt body. The opening fence must be
 *   EXACTLY ```text and the closing fence EXACTLY a bare ```.
 */
function extractReusablePrompts(doc) {
  const lines = String(doc == null ? '' : doc).split(/\r?\n/);
  const out = {};

  for (const [key, heading] of Object.entries(REUSABLE_PROMPT_HEADINGS)) {
    // Exactly one occurrence of the heading, as its own line.
    const found = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === heading) found.push(i);
    }
    if (found.length !== 1) return null;

    // Section runs to the next `## ` heading (or EOF).
    let end = lines.length;
    for (let i = found[0] + 1; i < lines.length; i++) {
      if (/^##\s+\S/.test(lines[i])) { end = i; break; }
    }
    const section = lines.slice(found[0] + 1, end);

    // Exactly two fence lines => exactly one complete block. Zero is missing,
    // one is unclosed, four is a duplicated block.
    const fences = [];
    for (let i = 0; i < section.length; i++) {
      if (/^```/.test(section[i].trim())) fences.push(i);
    }
    if (fences.length !== 2) return null;
    // These prompts are copy-paste TEXT, not code: the opening fence must be
    // EXACTLY ```text and the closing fence EXACTLY a bare ```. A bare opening
    // (```), or a non-text language tag (```javascript, ```json, ```markdown,
    // ...), is a structural defect and is rejected.
    if (section[fences[0]].trim() !== '```text') return null; // opening must be exactly ```text
    if (section[fences[1]].trim() !== '```') return null;     // closing must be a bare ```

    const body = section.slice(fences[0] + 1, fences[1]).join('\n').trim();
    if (body === '') return null;
    out[key] = body;
  }
  return out;
}

/**
 * PURE: does a context-only body contain stale pre-D7-GO authority or a
 * promotion into R8 execution?
 *
 * RETARGETED for accepted D7 Codex GO. Current authority is R1-R7/D1-D5 plus
 * expanded D7 complete and Codex GO, with R8 next as a read-only section that
 * still requires separate owner authorization. Candidate/no-GO D7 wording is
 * now STALE. A reusable grounding prompt cannot execute R7/D7 again or promote
 * R8 from read-only-next status into authorization.
 */
function declaresStaleOrPrematureAuthority(value) {
  const t = String(value == null ? '' : value).replace(/\s+/g, ' ');
  return (
    // Stale R5 authority.
    /\bR5\b[^.;]{0,160}\b(?:next|not started|unimplemented|awaiting independent Codex (?:re-)?review|no (?:R5 )?(?:Codex )?GO)\b/i.test(t) ||
    /\bnext\b[^.;]{0,80}\bsection\b[^.;]{0,40}\b(?:is|will be)\s+R5\b/i.test(t) ||
    // Stale R6 authority: next/not-started/candidate/no-GO wording.
    /\bR6\b[^.;]{0,180}\b(?:next|not started|unimplemented|awaiting independent Codex (?:re-)?review)\b/i.test(t) ||
    /\bno\s+R6\s+(?:Codex\s+)?GO\s+is\s+claimed\b/i.test(t) ||
    /\bnext\b[^.;]{0,80}\bsection\b[^.;]{0,40}\b(?:is|will be)\s+R6\b/i.test(t) ||
    // Stale R7 pre-implementation authority.
    /\bR7\b[^.;]{0,180}\bnext owner-authorized code section\b/i.test(t) ||
    /\bR7\b[^.;]{0,180}\b(?:is not started|is unimplemented|has not started)\b/i.test(t) ||
    /\bnext\b[^.;]{0,80}\bsection\b[^.;]{0,40}\b(?:is|will be)\s+R7\b/i.test(t) ||
    // R7 is closed; candidate/no-GO wording and any replay instruction are stale.
    /\bR7\b[^.;]{0,180}\b(?:implemented|correction candidate)\b[^.;]{0,180}\bawaiting independent Codex (?:re-)?review\b/i.test(t) ||
    /\bno\s+R7\s+(?:Codex\s+)?GO\s+is\s+claimed\b/i.test(t) ||
    /\b(?:expanded\s+)?D7\b[^.;]{0,160}\bblocked by R7 Codex GO\b/i.test(t) ||
    /\b(?:begin|start|implement|execute|commence)\s+(?:M12\.P1-)?R7\b/i.test(t) ||
    /\bproceed\s+to\s+(?:M12\.P1-)?R7\b/i.test(t) ||
    /\bR7\b\s+(?:may|can|could|is\s+allowed\s+to)\s+(?:begin|start|proceed|commence)\b/i.test(t) ||
    /\bR7\b[^.;]{0,100}\bauthorized\s+to\s+(?:begin|start|proceed|execute|implement)\b/i.test(t) ||
    // Stale D7 pre-GO or replay wording.
    /\b(?:expanded\s+)?D7\b[^.;]{0,180}\b(?:next potential section|not started|unimplemented|awaiting independent Codex (?:re-)?review|no (?:D7 )?(?:Codex )?GO|blocked by R7 Codex GO)\b/i.test(t) ||
    /\bno\s+(?:expanded\s+)?D7\s+(?:Codex\s+)?GO\s+is\s+claimed\b/i.test(t) ||
    /\b(?:expanded\s+)?D7\b[^.;]{0,120}\b(?:is\s+authorized|may\s+begin|has\s+started)\b/i.test(t) ||
    /\b(?:begin|start|implement|execute|commence)\s+(?:expanded\s+)?D7\b/i.test(t) ||
    // Completed verification and independent-review boundaries must not be
    // rewritten as pending current work in a reusable grounding prompt.
    /\bfinal\s+ordered\s+postconditions\b[^.;]{0,100}\b(?:remain|are)\s+pending\b/i.test(t) ||
    /\bnext\s+boundary\b[^.;]{0,160}\bsession[- ]residue\b/i.test(t) ||
    /\b(?:independent\s+commit-readiness\s+review\s+remains\s+open|next\s+boundary\s+is\s+an\s+open\s+independent\s+commit-readiness\s+review|independent\s+review\s+is\s+still\s+required|new\s+independent\s+review\s+remains\s+pending)\b/i.test(t) ||
    // R8 can be named as the next read-only section, but not authorized or executed here.
    /\bR8\b(?:\s+is)?\s+(?:authorized|may\s+begin|has\s+started|complete|completed)\b/i.test(t) ||
    /\b(?:begin|start|implement|execute|commence)\s+R8\b/i.test(t)
  );
}

/** PURE: current prose must distinguish the accepted July 22 dependency
 * closeout from the later advisory drift and its reviewed July 26 fix.
 */
function recordsCurrentDependencyRemediation(value) {
  const t = String(value == null ? '' : value).replace(/\s+/g, ' ');
  return (
    /\bsubsequent\b[\s\S]{0,80}\b2026-07-26\b[\s\S]{0,100}\b(?:advisory|audit)\b[\s\S]{0,80}\b(?:drift|finding)\b/i.test(t) &&
    /\bejs@6\.0\.1\b/i.test(t) &&
    /\bjake\/filelist\/minimatch\/brace-expansion\b[\s\S]{0,80}\b(?:absent|removed|no longer resolves)\b/i.test(t) &&
    /\bnpm audit --omit=dev\b[\s\S]{0,80}\b(?:zero vulnerabilities|0 vulnerabilities)\b/i.test(t)
  );
}

/** PURE: text records the accepted R7 closeout and superseded R7 candidates. */
function recordsAcceptedR7EvidenceText(value) {
  const t = String(value == null ? '' : value).replace(/\s+/g, ' ');
  const r7Go =
    /\b(?:M12\.P1-)?R7\b[\s\S]{0,180}\b(?:complete|completed)\b[\s\S]{0,100}\bCodex GO\b/i.test(t) ||
    /\baccepted\b[\s\S]{0,80}\b(?:M12\.P1-)?R7\b[\s\S]{0,80}\bCodex GO\b/i.test(t);
  const acceptedEvidence =
    /\baccepted\b[\s\S]{0,120}\b(?:M12\.P1-)?R7\b[\s\S]{0,120}\bevidence\b/i.test(t) ||
    /\bAccepted R7\b[\s\S]{0,80}\bevidence\b/i.test(t);
  const acceptedTotal =
    /\b3495\/3495\b[\s\S]{0,100}\b(?:QUALITY-GATES OK|PASS)\b/i.test(t) ||
    /\bQUALITY-GATES OK\b[\s\S]{0,120}\b3495\/3495\b/i.test(t);
  const focusedAndInSuite =
    /\b71\/71\b/i.test(t) && /\b(?:vercel-package-boundary\b[\s\S]{0,40})?70\/70\b/i.test(t);
  const auditZero =
    /\bnpm audit --omit=dev\b[\s\S]{0,100}\b(?:zero vulnerabilities|0 vulnerabilities)\b/i.test(t);
  const superseded3492 =
    /\b3492\/3492\b[\s\S]{0,180}\b(?:historical|superseded)\b/i.test(t) ||
    /\b(?:historical|superseded)\b[\s\S]{0,180}\b3492\/3492\b/i.test(t);
  const superseded3494 =
    /\b3494\/3494\b[\s\S]{0,180}\b(?:historical|superseded)\b/i.test(t) ||
    /\b(?:historical|superseded)\b[\s\S]{0,180}\b3494\/3494\b/i.test(t);
  return r7Go && acceptedEvidence && acceptedTotal && focusedAndInSuite &&
    auditZero && superseded3492 && superseded3494;
}

/** PURE: text records the accepted D7 closeout and postconditions. */
function recordsAcceptedD7EvidenceText(value) {
  const t = String(value == null ? '' : value).replace(/\s+/g, ' ');
  const d7Go =
    /\b(?:M12\.P1-)?D7\b[\s\S]{0,180}\b(?:complete|completed)\b[\s\S]{0,100}\bCodex GO\b/i.test(t) ||
    /\bexpanded\s+D7\b[\s\S]{0,120}\b(?:complete|completed)\b[\s\S]{0,100}\bCodex GO\b/i.test(t) ||
    /\baccepted\s+(?:M12\.P1-)?D7\s+Codex GO\b/i.test(t);
  const acceptedEvidence =
    /\baccepted\b[\s\S]{0,120}\b(?:M12\.P1-)?D7\b[\s\S]{0,120}\bevidence\b/i.test(t) ||
    /\b(?:M12\.P1-)?D7\b[\s\S]{0,120}\baccepted\b[\s\S]{0,120}\bevidence\b/i.test(t) ||
    /\bAccepted D7 evidence\b/i.test(t) ||
    /\baccepted M12\.P1-D7 Codex GO evidence\b/i.test(t);
  const freshContexts =
    /\bfresh-context\b/i.test(t) ||
    /\bBrowserContext\b/i.test(t) ||
    /\bstorage carryover\b/i.test(t);
  const fullSuite =
    /\b3511\/3511\b[\s\S]{0,100}\b(?:QUALITY-GATES OK|PASS)\b/i.test(t) ||
    /\bQUALITY-GATES OK\b[\s\S]{0,120}\b3511\/3511\b/i.test(t);
  const auditZero =
    /\bnpm audit --omit=dev\b[\s\S]{0,120}\b(?:zero vulnerabilities|0 vulnerabilities)\b/i.test(t) ||
    /\baudit zero\b/i.test(t);
  const postconditions =
    /\b24\/24\b[\s\S]{0,100}\b18\/18\b[\s\S]{0,100}\b46\/46\b/i.test(t) &&
    /\b(?:a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d|a1e11ac0[.\u2026]{3}92591d)\b/i.test(t);
  return d7Go && acceptedEvidence && freshContexts && fullSuite && auditZero && postconditions;
}

/**
 * PURE: require the completed candidate matrix in one live authority scope and
 * reject the exact pending/session-remediation regressions found by independent
 * review. Historical failures may remain when clearly framed. Lifecycle state
 * comes from live Git and the latest external review report, never a repository
 * sentence that expires as soon as it is committed or reviewed.
 * @returns {string[]} problems (empty = compliant)
 */
function currentCandidateVerificationProblems(value, expectedTotal) {
  const t = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  const problems = [];
  const total = Number(expectedTotal);
  const exact = Number.isInteger(total) ? String(total) + '/' + String(total) : '';

  if (t === '' || exact === '') return ['missing candidate verification scope or invalid total'];

  const candidateScopes = [];
  let exactAt = t.indexOf(exact);
  while (exactAt >= 0) {
    candidateScopes.push(t.slice(Math.max(0, exactAt - 220), exactAt + 700));
    exactAt = t.indexOf(exact, exactAt + exact.length);
  }
  const verifiedScope = candidateScopes.find((scope) =>
    /npm test/i.test(scope) && /QUALITY-GATES OK/i.test(scope) &&
    /npm run qa/i.test(scope) && /(?:five[- ]stage|five stages|five green stages)/i.test(scope) &&
    /24\/24[\s\S]{0,100}18\/18[\s\S]{0,100}46\/46/i.test(scope));
  if (!verifiedScope) {
    problems.push('current scope does not bind npm test to the exact total and QUALITY-GATES OK');
  }
  if (!verifiedScope ||
      !(verifiedScope.includes(exact) || /same (?:exact )?contract total/i.test(verifiedScope))) {
    problems.push('current scope does not bind full five-stage QA to the exact candidate total');
  }

  if (!/24\/24[\s\S]{0,100}18\/18[\s\S]{0,100}46\/46/i.test(t)) {
    problems.push('current scope does not record the final ordered postconditions');
  }
  if (!/live Git[\s\S]{0,180}latest external review report|latest external review report[\s\S]{0,180}live Git/i.test(t)) {
    problems.push('current scope does not defer mutable lifecycle state to live Git and the latest external review report');
  }
  if (/(?:matrix|contract\/QA total|ordered postconditions?)[^.]{0,140}\b(?:remain|remains|are|is) pending\b/i.test(t)) {
    problems.push('current scope still declares completed verification pending');
  }
  if (/next boundary[^.]{0,180}(?:resolution|natural expiry)[^.]{0,80}session-residue findings/i.test(t)) {
    problems.push('current scope still instructs session-residue remediation');
  }
  return problems;
}

/* Historical runtime provenance remains pinned, but the operative lifecycle is
 * now the accepted technical Production source commit plus a manual-promotion
 * boundary for every future main deployment. */
/**
 * PURE: reject a contradictory CURRENT claim even when the required truthful
 * claim also appears elsewhere. Properly past-bounded history remains allowed.
 * @returns {string[]} problems (empty = compliant)
 */
function currentDeploymentAuthorityContradictionProblems(value) {
  const text = String(value == null ? '' : value);
  const problems = [];
  const rules = [
    {
      message: 'a current claim denies that the authorized push automatically triggered Production',
      pattern: /\b(?:authorized|separately authorized) push\b[^]{0,160}\b(?:did not|didn't|failed to|never)\b[^]{0,80}\b(?:automatically\s+)?trigger(?:ed)?\b[^]{0,60}\b(?:Vercel\s+)?Production\b/i,
    },
    {
      message: 'a current claim contradicts the passed post-deployment verification',
      pattern: /\bpost-deployment verification\b[^]{0,120}\b(?:failed|did not pass|has not passed|was not (?:performed|run|executed|completed)|remains? (?:pending|open|unverified)|is (?:pending|open|unverified))\b/i,
    },
    {
      message: 'a current claim says Auto-assign Custom Production Domains is enabled',
      pattern: /\bAuto-assign Custom Production Domains\b[^]{0,80}\b(?:(?:is|was|remains?|stays?)\s+(?:still\s+)?enabled|is not disabled)\b/i,
    },
    {
      message: 'a current claim denies the manual-promotion boundary for future main deployments',
      pattern: /(?:\bfuture\s+\bmain\b[^]{0,160}\b(?:do not|does not|don't|need not|no longer)\s+(?:require|need)\b[^]{0,60}\bmanual promotion\b|\bmanual promotion\b[^]{0,100}\b(?:is|remains)\s+not required\b[^]{0,100}\bfuture\s+\bmain\b|\bfuture\s+\bmain\b[^]{0,160}\b(?:automatically|directly)\s+(?:replace|updates?|take over)\b[^]{0,60}\b(?:the\s+)?live alias\b)/i,
    },
  ];

  for (const claim of splitEvidenceClaims(text)) {
    const properlyHistorical = CLAIM_HISTORY_RE.test(claim) &&
      CLAIM_PAST_BOUND_RE.test(claim) && !CLAIM_PRESENT_DEPLOYED_RE.test(claim);
    if (properlyHistorical) continue;
    for (const rule of rules) {
      if (rule.pattern.test(claim) && !problems.includes(rule.message)) {
        problems.push(rule.message);
      }
    }
  }
  return problems;
}

/** PURE: preserve the owner-controlled post-push release boundary. */
function hasPrePresentationReleaseDenial(value) {
  const t = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  const beforePresentation = /\bbefore the presentation\b/i.test(t);
  if (beforePresentation && (
    /\b(?:local candidate|local commits?)\b[\s\S]{0,180}\bmust not be pushed, promoted, or deployed\b/i.test(t) ||
    /\bneither local commit\b[\s\S]{0,120}\bmay be pushed, promoted, or deployed\b/i.test(t) ||
    /\bno push, deployment, promotion, rollback, or Production change is authorized\b/i.test(t))) return true;
  const pushedImplementation =
    /\bd786bdcb83a196c7263dceae668417d3ced3e95a\b[\s\S]{0,220}\b(?:committed|pushed)\b/i.test(t) ||
    /\b(?:committed|pushed)\b[\s\S]{0,220}\bd786bdcb83a196c7263dceae668417d3ced3e95a\b/i.test(t);
  return pushedImplementation &&
    /\b(?:no|not|remains?\s+not)\b[^.]{0,100}\b(?:promotion|deployment)\b[^.]{0,100}\bauthori[sz]ed\b/i.test(t);
}

/**
 * PURE: validate the owner-attested pilot disposition without upgrading it to
 * independently verified current-build evidence. Historical pilot-open claims
 * remain allowed only when the same claim is explicitly historical and
 * past-bounded.
 * @returns {string[]} problems (empty = compliant)
 */
function currentPilotAuthorityProblems(value) {
  const text = String(value == null ? '' : value);
  const t = text.replace(/\s+/g, ' ').trim();
  const problems = [];

  if (currentReleaseContinuityProblems(text, { requireMarkers: false }).length === 0) {
    return [];
  }

  if (!/\bhuman pilot\b[\s\S]{0,180}\b2026-08-05\b|\b2026-08-05\b[\s\S]{0,180}\bhuman pilot\b/i.test(t)) {
    problems.push('owner-attested 2026-08-05 human pilot is missing');
  }
  if (!/(?:\bowner(?:-attested)?\b[\s\S]{0,100}\baccept(?:s|ed|ance)\b|\bOWNER-ACCEPTED\b)[\s\S]{0,160}\bzero reported findings\b/i.test(t)) {
    problems.push('owner acceptance with zero reported findings is missing');
  }
  if (!/(?:Participant\/Form evidence|participant\/Form evidence|pilot evidence)[\s\S]{0,120}\b(?:remains?|retained)\s+external\b|\bevidence\b[\s\S]{0,100}\boutside Git\b/i.test(t)) {
    problems.push('external pilot-evidence boundary is missing');
  }
  if (!/(?:tested build(?:'s)? full source-commit identity|full source-commit identity|tested build identity)[\s\S]{0,100}\bwas not independently verified\b/i.test(t)) {
    problems.push('unverified pilot build-identity disclosure is missing');
  }
  if (!/\bpilot review\b[\s\S]{0,80}\bcomplete\b/i.test(t)) {
    problems.push('pilot review is not complete for sequencing');
  }
  if (!/\b(?:OFF\.2-OFF\.6|OFF\.2\s*(?:through|-)\s*OFF\.6)\b[\s\S]{0,180}\b(?:complete|completed)\b[\s\S]{0,80}\bCodex GO\b/i.test(t)) {
    problems.push('OFF.2-OFF.6 Codex GO is missing');
  }
  if (!/\b(?:M12\.P1-)?D6\b[\s\S]{0,180}\b(?:complete|completed|commit-readiness is)\b[\s\S]{0,80}\bCodex GO\b/i.test(t)) {
    problems.push('D6 Codex GO is missing');
  }
  if (!/\bfinal Milestone 12\b[\s\S]{0,180}\b(?:not self-issued|remains external|awaits? (?:one )?independent|latest independent external closeout report controls)\b/i.test(t)) {
    problems.push('independent final Milestone 12 closeout boundary is missing');
  }
  if (!hasPrePresentationReleaseDenial(t)) {
    problems.push('pre-presentation push/promotion/deployment denial is missing');
  }

  const contradictoryRules = [
    /\bhuman pilot(?: evidence|\/Form responses)?\b[^]{0,140}\bremains?\s+open\b/i,
    /\bpilot(?: evaluation| review)?\b[^]{0,140}\bremains?\s+(?:unopened|open|pending|incomplete)\b/i,
    /\bpilot review\b[^]{0,100}\b(?:is\s+not complete|has not completed|must still occur)\b/i,
    /\b(?:tested build(?:'s)? full source-commit identity|full source-commit identity|tested build identity)\b[^]{0,100}\b(?:was|is)\s+independently verified\b/i,
    /\b2026-08-05\b[^]{0,200}\bhuman pilot\b[^]{0,180}\b(?:reported|found)\s+(?:one|[1-9]\d*)\s+(?:problem|finding|issue)s?\b/i,
    /\b(?:OFF\.2-OFF\.6|OFF\.2\s*(?:through|-)\s*OFF\.6)\b[^]{0,180}\b(?:remain|remains|are|is)\s+(?:open|pending|unaccepted)\b/i,
    /\b(?:OFF\.2-OFF\.6|OFF\.2\s*(?:through|-)\s*OFF\.6)\b[^]{0,220}\b(?:no Codex GO|without Codex GO|awaiting independent (?:Codex )?review)\b/i,
    /\b(?:M12\.P1-)?D6\b[^]{0,180}\b(?:remain|remains|is)\s+(?:open|pending|unaccepted)\b/i,
    /\bfinal Milestone 12(?: GO| disposition)?\b[^]{0,120}\b(?:is|has been)\s+(?:issued|granted|complete|completed|Codex GO)\b/i,
    /\b(?:local candidate|local commits?)\b[^]{0,180}\b(?:may|can|is authorized to)\b[^]{0,80}\b(?:be )?(?:pushed|promoted|deployed)\b[^]{0,120}\bbefore the presentation\b/i,
  ];
  for (const claim of splitEvidenceClaims(text)) {
    if (CLAIM_HISTORY_RE.test(claim) && CLAIM_PAST_BOUND_RE.test(claim)) continue;
    if (hasPrePresentationReleaseDenial(claim)) continue;
    if (contradictoryRules.some((rule) => rule.test(claim))) {
      problems.push('contradictory current pilot disposition remains');
      break;
    }
  }
  return problems;
}

/** PURE: validate current Git/deployment/promotion/pilot authority. */
function currentGitLifecycleProblems(value) {
  if (currentReleaseContinuityProblems(value, { requireMarkers: false }).length === 0) {
    return [];
  }
  const t = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  const problems = [];
  if (!t.includes(EXPECTED_SEC51_DEPLOYED_BASELINE) ||
      claimsBindingCurrentDeployedBaseline(t).length === 0) {
    problems.push('missing exact accepted technical Production baseline binding');
  }
  if (!/(?:authorized|separately authorized) push[\s\S]{0,120}automatically triggered[\s\S]{0,80}(?:Vercel )?Production/i.test(t)) {
    problems.push('automatic Production trigger disclosure is missing');
  }
  if (!/post-deployment verification[\s\S]{0,140}(?:passed|PASS)/i.test(t) ||
      !/anonymous[\s\S]{0,80}read-only[\s\S]{0,80}GET-only/i.test(t)) {
    problems.push('bounded anonymous GET-only post-deployment PASS is missing');
  }
  if (!/Auto-assign Custom Production Domains[\s\S]{0,80}(?:disabled|Disabled)/i.test(t) ||
      !/(?:future )?`?main`?[\s\S]{0,160}(?:manual promotion|Promote to Production)/i.test(t)) {
    problems.push('future main deployments are not bound to manual promotion');
  }
  if (!t.includes(EXPECTED_CURRENT_AUTHORITY_COMMIT) ||
      !/documentation\/static-assertion(?:-only)?(?: authority)? (?:synchronization|commit)[\s\S]{0,160}\b(?:committed and pushed|is committed and pushed)\b/i.test(t) ||
      !/\bReady\b[\s\S]{0,80}\bProduction\b[\s\S]{0,80}\bStaged\b/i.test(t) ||
      !/custom-domain assignment[\s\S]{0,60}\bSkipped\b/i.test(t) ||
      !/(?:not promoted|was not promoted)[\s\S]{0,100}\b(?:not |made )?Current\b/i.test(t)) {
    problems.push('pushed db05b54 staged/unpromoted authority is missing');
  }
  for (const problem of currentPilotAuthorityProblems(t)) {
    problems.push(problem);
  }
  for (const problem of currentDeploymentAuthorityContradictionProblems(t)) {
    problems.push(problem);
  }
  const stale = [
    /current worktree is intentionally dirty/i,
    /worktree is now intentionally dirty/i,
    /nothing from (?:this|the) candidate[^.]{0,120}(?:committed|pushed)/i,
    /(?:Guided-VR|remediation) candidate[^.]{0,120}uncommitted[^.]{0,80}unpushed/i,
    /(?:\bopen\s+independent(?: commit-readiness| read-only)? review|(?:new )?independent(?: commit-readiness| read-only)? review[^.]{0,180}(?:remain|remains|is|stays)(?: still)? (?:open|pending|required))/i,
    /review itself remains open/i,
    /next boundary is independent commit-readiness review/i,
    /(?:present|current) \d+-file working tree[^.]{0,120}(?:unstaged|uncommitted)/i,
    /clean starting Git baseline[^.]{0,180}5076e1316cf68e9d05c78a61b2362d1727873a09[^.]{0,120}(?:HEAD|origin\/main)/i,
    /neither 43627cf[^.]{0,180}(?:is|are) deployed/i,
    /Production remains[^.]{0,180}0627bf7/i,
  ];
  const liveClaims = splitEvidenceClaims(t).filter((claim) =>
    !(CLAIM_HISTORY_RE.test(claim) && CLAIM_PAST_BOUND_RE.test(claim)));
  if (liveClaims.some((claim) => stale.some((re) => re.test(claim)))) {
    problems.push('obsolete dirty/uncommitted/unpushed lifecycle authority remains');
  }
  return problems;
}

/** PURE: keep the old db034e R8 narrative fenced as history, never authority. */
function operativePlanLifecycleProblems(value) {
  const t = String(value == null ? '' : value);
  const startMarker = '<!-- M12.P1-R8 HISTORICAL EXECUTION RECORD START -->';
  const endMarker = '<!-- M12.P1-R8 HISTORICAL EXECUTION RECORD END -->';
  const starts = t.split(startMarker).length - 1;
  const ends = t.split(endMarker).length - 1;
  const start = t.indexOf(startMarker);
  const end = t.indexOf(endMarker);
  if (starts !== 1 || ends !== 1 || start < 0 || end <= start) {
    return ['missing or malformed historical R8 execution record'];
  }
  const history = t.slice(start + startMarker.length, end);
  const operative = (t.slice(0, start) + t.slice(end + endMarker.length)).replace(/\s+/g, ' ');
  const problems = [];
  if (!/HISTORICAL\/SUPERSEDED[\s\S]{0,100}not current authority/i.test(history) ||
      !/db034e5581e6f409083a43dcb80fb82b473e0127/i.test(history)) {
    problems.push('db034e R8 record is not explicitly historical');
  }
  if (/(?:\*\*Current correction candidate\.\*\*|(?:present|current) \d+-file working tree[^.]{0,120}(?:unstaged|uncommitted)|independent commit-readiness review[^.]{0,180}(?:remain|remains|is|stays)(?: still)? open|next boundary is independent commit-readiness review)/i.test(operative)) {
    problems.push('operative long-form plan retains self-expiring lifecycle authority');
  }
  return problems;
}

/**
 * PURE: preserve one transcript-faithful account of the two rejected
 * verification anomalies that immediately precede the current implementation
 * evidence.
 *
 * The first run stopped at the wrapper's 20-minute bound without a completion
 * count. The bounded retry emitted 4,628 PASS lines, nine current-authority
 * wording failures, and the canonical MySQL student-session residue failure.
 * A separate earlier QA command was green internally, while its external
 * scorer alone returned 97 after looking for the invented SUPABASE-SMOKE OK
 * marker instead of the real [supabase-smoke] PASS marker.
 *
 * This analyzer intentionally rejects the stale "seven documentation
 * failures" wording found by independent review. It is applied to every
 * current authority block and to the evidence ledger so one corrected document
 * cannot mask drift in another.
 * @returns {string[]} problems (empty = transcript-faithful)
 */
function rejectedVerificationHistoryProblems(value) {
  const t = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  const problems = [];

  const timeoutRecorded =
    /20-minute wrapper bound[\s\S]{0,220}no completion count/i.test(t) ||
    /wrapper timeout at 20 minutes[\s\S]{0,220}no completion count/i.test(t);
  if (!timeoutRecorded) {
    problems.push('missing rejected 20-minute wrapper timeout and no-completion disclosure');
  }

  const retryRe = /\b4,?628\b/g;
  const retryScopes = [];
  let retryMatch;
  while ((retryMatch = retryRe.exec(t)) !== null) {
    retryScopes.push(t.slice(retryMatch.index, retryMatch.index + 1200));
  }
  if (retryScopes.length === 0) problems.push('missing rejected 4,628-PASS retry disclosure');
  const exactRetryScope = retryScopes.find((scope) =>
    /\bnine\b[\s\S]{0,100}\bcurrent-authority wording (?:failures|mismatches)\b/i.test(scope) &&
    /\b(?:residue failure|orphaned canonical MySQL student session)\b/i.test(scope));
  if (!exactRetryScope) {
    problems.push('rejected retry does not record nine current-authority wording failures');
    problems.push('rejected retry does not record the canonical student-session residue failure');
  }
  if (/\b(?:seven|7)\s+(?:current-authority wording|documentation) failures\b/i.test(t)) {
    problems.push('stale seven-documentation-failure account remains');
  }

  const scorerRe = /\b(?:returned|exit(?:ed)?)\s+97\b/ig;
  const scorerScopes = [];
  let scorerMatch;
  while ((scorerMatch = scorerRe.exec(t)) !== null) {
    scorerScopes.push(t.slice(Math.max(0, scorerMatch.index - 180), scorerMatch.index + 700));
  }
  if (!scorerScopes.some((scope) =>
    scope.includes('SUPABASE-SMOKE OK') && scope.includes('[supabase-smoke] PASS'))) {
    problems.push('scorer-only exit 97 is not bound to the invented and actual smoke markers');
  }

  return problems;
}

const CURRENT_OFFLINE_COMMITTED_MANIFEST_SHA256 =
  '92c689b884f52021f5545f331e8768ffc4768914cf9320c2d4b8fedee7020642';
const CURRENT_OFFLINE_PACKAGE_SHA256 =
  '13cd3c5e5d8259766e50b1136c8cc8a5672b2321c65962892358c62b45ef88f5';
const CURRENT_MAINTENANCE_COMMIT_SHA =
  'c00db76c5be0fe9c8dfdc8168a4c4303c6a0aa64';
const CURRENT_MAINTENANCE_MANIFEST_SHA256 =
  '5bd2ba68fd442da73e36b53a3c1e4b1cfff30496e4ce50884382781ba9479a2d';
const CURRENT_MAINTENANCE_PACKAGE_SHA256 =
  '13cd3c5e5d8259766e50b1136c8cc8a5672b2321c65962892358c62b45ef88f5';
const CURRENT_RELEASE_AUTHORITY_COMMIT_SHA =
  'bb17b9b603583bcc2934e3ffab1cbdcb7d6b0ddd';
const CURRENT_RELEASE_COMMIT_SHA =
  'dc961b1eeba191d79b96998d96f0a49dac3ffcf8';
const CURRENT_PUSHED_CANDIDATE_COMMIT_SHA =
  'e481d0343313e6356438393a783b48d838f01a36';
const CURRENT_PUSHED_CANDIDATE_PREDECESSOR_SHA =
  '2b4f42df3f79347c70af07f7b98f70be55b701bd';
const CURRENT_PUSHED_CANDIDATE_PACKAGE_SHA256 =
  'c07e34f43f859f3f4055c9a00f90b0a5967d323ef85e243227d95c8023195216';
const CURRENT_RELEASE_REVIEW_MANIFEST_SHA256 =
  '1c5ed249dd21894a2cb0871a04fc650deebfe2fa790b7e260d123415a4aa45c7';
const CURRENT_RELEASE_PACKAGE_SHA256 =
  '13cd3c5e5d8259766e50b1136c8cc8a5672b2321c65962892358c62b45ef88f5';
const CURRENT_COURSE_WORKTREE_PACKAGE_SHA256 =
  '9849e3c18c70e54a3502217275724367945ff176be22ce4d20796b5c103dc9ec';
const CURRENT_RELEASE_LAST_VERIFIED_BASELINE_SHA =
  'fea3b2e11c6331eddc1ee091b165427d8e0218d7';
const CURRENT_RELEASE_CONTINUITY_START = '<!-- M12 RELEASE CONTINUITY START -->';
const CURRENT_RELEASE_CONTINUITY_END = '<!-- M12 RELEASE CONTINUITY END -->';

/**
 * PURE: validate the post-course release handoff without converting the
 * owner's Vercel/OAuth/local observations into independent production
 * evidence or promoting the current dirty worktree into accepted evidence.
 *
 * With requireMarkers=true, exactly one bounded continuity block is required.
 * Reusable prompt bodies carry the same facts without the HTML markers, so the
 * caller may explicitly validate the entire body instead.
 * @returns {string[]} problems (empty = current and bounded)
 */
function currentReleaseContinuityProblems(value, { requireMarkers = true } = {}) {
  const raw = String(value == null ? '' : value);
  let scope = raw;
  const problems = [];

  if (requireMarkers) {
    const starts = raw.split(CURRENT_RELEASE_CONTINUITY_START).length - 1;
    const ends = raw.split(CURRENT_RELEASE_CONTINUITY_END).length - 1;
    const start = raw.indexOf(CURRENT_RELEASE_CONTINUITY_START);
    const end = raw.indexOf(CURRENT_RELEASE_CONTINUITY_END);
    if (starts !== 1 || ends !== 1 || start < 0 || end <= start) {
      return ['current release continuity markers are missing, duplicated, or inverted'];
    }
    scope = raw.slice(start + CURRENT_RELEASE_CONTINUITY_START.length, end);
  }

  const t = scope.replace(/\s+/g, ' ').trim();

  /* Current post-schedule authority. Older fixtures intentionally continue
     through the historical analyzer below so accepted release evidence stays
     testable without allowing those lifecycle claims back into live docs. */
  if (t.includes(CURRENT_PUSHED_CANDIDATE_COMMIT_SHA)) {
    if (!t.includes(CURRENT_PUSHED_CANDIDATE_PREDECESSOR_SHA) ||
        !t.includes(CURRENT_RELEASE_COMMIT_SHA) ||
        !/HEAD[\s\S]{0,140}origin\/main[\s\S]{0,140}remote `?main`?[\s\S]{0,180}e481d03/i.test(t) ||
        !/(?:index and worktree are clean|clean index\/worktree|index\/worktree were clean)/i.test(t) ||
        !/zero dirty paths[\s\S]{0,100}zero stashes/i.test(t)) {
      problems.push('e481d03 Git identity or clean pushed lifecycle is missing');
    }
    if (!/semester room-schedule (?:image|document) flow/i.test(t) ||
        !/schedule_document_id/i.test(t) ||
        !/(?:no image bytes are uploaded|no upload\/delete\/management|no upload, delete, or management)/i.test(t) ||
        !/legacy[\s\S]{0,120}read-only fallback/i.test(t) ||
        !/(?:schedules remain|schedules stay)[\s\S]{0,80}(?:excluded|offline-excluded)/i.test(t)) {
      problems.push('current room-schedule behavior or Cloudinary boundary is missing');
    }
    if (!/(?:owner (?:applied|applied `?)0020_room_schedule_documents\.sql|0020_room_schedule_documents\.sql[\s\S]{0,80}owner-applied)/i.test(t) ||
        !/(?:MySQL schema (?:parity )?was verified|matching MySQL schema is verified|local MySQL[\s\S]{0,80}verified)/i.test(t) ||
        !/(?:Do not reapply|do not apply SQL|do not apply or reapply SQL)/i.test(t)) {
      problems.push('owner-applied 0020 and no-reapply boundary is missing');
    }
    if (!/npm test[\s\S]{0,80}4998\/4998/i.test(t) ||
        !/(?:schedule|room-schedule)[\s\S]{0,80}58\/58/i.test(t) ||
        !/package[\s\S]{0,80}74\/74/i.test(t) ||
        !/BE\.6[\s\S]{0,60}46\/46/i.test(t) ||
        !/residue[\s\S]{0,80}18\/18/i.test(t)) {
      problems.push('current verification totals are incomplete');
    }
    if (!t.includes(CURRENT_PUSHED_CANDIDATE_PACKAGE_SHA256) ||
        !/180 files[\s\S]{0,80}7,189,621 bytes/i.test(t)) {
      problems.push('current runtime package identity is missing');
    }
    if (!/(?:no critical, high, medium, or low findings|no critical\/high\/medium\/low findings|independently reviewed with no findings)/i.test(t) ||
        !/(?:committed,? and pushed|commit,? and push)/i.test(t)) {
      problems.push('current independent review or push evidence is missing');
    }
    if (!/(?:no owner-authorized promotion|No promotion|no promotion)/i.test(t) ||
        !/Production acceptance/i.test(t) ||
        !/(?:deployed-byte verification|deployed-byte proof)/i.test(t) ||
        /e481d03[^.]{0,160}(?:is|was|has been) (?:promoted|deployed|Production current)/i.test(t)) {
      problems.push('e481d03 deployment evidence boundary is missing or contradicted');
    }
    if (!/Android 8[\s\S]{0,120}unsupported[\s\S]{0,120}(?:compatibility|platform)/i.test(t) ||
        !/not a confirmed[\s\S]{0,80}(?:CampuSphere|app|code) (?:defect|bug)/i.test(t) ||
        !/(?:not a proven hardware failure|not a confirmed[\s\S]{0,80}(?:defect|bug)[\s\S]{0,60}or proven hardware failure)/i.test(t) ||
        !/Android 10\+[\s\S]{0,100}(?:current )?Chrome/i.test(t)) {
      problems.push('Android 8 unsupported-platform classification is missing');
    }
    const publicFaqCandidate =
      /participant-facing public FAQ(?: page)?[\s\S]{0,220}(?:implemented|available|candidate)/i.test(t) &&
      /(?:GET\s+)?\/faq/i.test(t) &&
      /publicFaq-probe\.js/i.test(t);
    const publicFaqBoundary =
      /(?:separate|independent)[^.]{0,100}(?:review|commit|push|promotion|deployment)[^.]{0,100}(?:boundary|authorization|gated|not authorized)/i.test(t) ||
      /implementation[^.]{0,120}(?:unstaged|uncommitted|not committed|not pushed)/i.test(t);
    if (!/admin FAQ CRUD/i.test(t) || !publicFaqCandidate || !publicFaqBoundary) {
      problems.push('public FAQ implementation evidence or lifecycle boundary is missing');
    }
    const implementationBoundary =
      /(?:authorizes no product implementation|does not authorize implementation|does not authorize planning or implementation)/i.test(t) ||
      /FAQ implementation[^.]{0,180}(?:local candidate|unstaged|uncommitted|not pushed|separate(?:ly)? authorized)/i.test(t) ||
      /participant-facing public FAQ[^.]{0,220}(?:commit|push|promotion|deployment)[^.]{0,120}(?:separate|independent|not|remain|require)/i.test(t);
    if (!/Final Milestone 12 disposition remains external/i.test(t) ||
        !implementationBoundary ||
        !/(?:Deployment is not authorized|no[\s\S]{0,100}promotion, deployment)/i.test(t)) {
      problems.push('final closeout or no-implementation/deployment boundary is missing');
    }
    const staleCurrentClaims = [
      /current uncommitted candidate/i,
      /authorized, uncommitted candidate/i,
      /migration 0020[\s\S]{0,80}(?:does not exist|pending|not applied)/i,
      /Android 8 installed-PWA crash remains unresolved/i,
      /missing current full QA, independent review, commit, push/i,
      /next boundary[\s\S]{0,100}verify the non-Cloudinary changes/i,
      /already implemented public FAQ page/i,
    ];
    if (staleCurrentClaims.some((rule) => rule.test(t))) {
      problems.push('stale pre-e481d03 operative lifecycle claim remains');
    }
    return problems;
  }

  const exactLineage =
    t.includes('d786bdcb83a196c7263dceae668417d3ced3e95a') &&
    t.includes('c00db76c5be0fe9c8dfdc8168a4c4303c6a0aa64') &&
    t.includes(CURRENT_RELEASE_AUTHORITY_COMMIT_SHA) &&
    t.includes(CURRENT_RELEASE_COMMIT_SHA);
  if (!exactLineage ||
      !/HEAD[\s\S]{0,100}origin\/main[\s\S]{0,100}remote `?main`?[\s\S]{0,180}\bdc961b1/i.test(t) ||
      !/index was empty[\s\S]{0,140}exactly 58 modified tracked paths[\s\S]{0,100}12 untracked paths[\s\S]{0,100}70 dirty paths total[\s\S]{0,100}zero stashes/i.test(t) ||
      !/eleven authority documents[\s\S]{0,100}scripts\/quality-gates\.js[\s\S]{0,100}12 tracked authority\/static-assertion surfaces/i.test(t) ||
      !/other 46 tracked paths[\s\S]{0,100}all 12 untracked paths[\s\S]{0,100}current uncommitted implementation/i.test(t) ||
      !/Preserve this worktree exactly/i.test(t)) {
    problems.push('release lineage or pre-sync/live-worktree boundary is missing');
  }

  if (!t.includes(CURRENT_RELEASE_REVIEW_MANIFEST_SHA256) ||
      !/12(?:-file| files)[\s\S]{0,80}1,854,481 bytes[\s\S]{0,100}manifest SHA-256/i.test(t) &&
      !/12(?:-file| files)[\s\S]{0,160}manifest SHA-256[\s\S]{0,100}1,854,481 bytes/i.test(t)) {
    problems.push('reviewed 12-file authority manifest is missing');
  }
  if (!t.includes(CURRENT_RELEASE_PACKAGE_SHA256) ||
      !/168 files[\s\S]{0,80}7,074,195 bytes[\s\S]{0,100}(?:aggregate )?SHA-256/i.test(t)) {
    problems.push('release package identity is missing');
  }

  if (!/npm test[\s\S]{0,100}exit 0[\s\S]{0,100}QUALITY-GATES OK/i.test(t) ||
      !/npm run qa[\s\S]{0,120}exit(?:ed)? 0/i.test(t) ||
      !/DB-PERF-GATE OK/i.test(t) ||
      !/\[supabase-smoke\] PASS/i.test(t) ||
      !/IDENTITY-CONSTRAINTS OK/i.test(t) ||
      !/found 0 vulnerabilities/i.test(t) ||
      !/Chrome acceptance[\s\S]{0,100}Supabase[\s\S]{0,80}MySQL/i.test(t) ||
      !/24\/24\s*->\s*18\/18\s*->\s*46\/46/i.test(t)) {
    problems.push('replacement verification evidence is incomplete');
  }
  if (!/(?:clean-commit independent|independent clean-commit) R8 review[\s\S]{0,160}\bGO\b/i.test(t) ||
      !/no (?:critical, high, medium, or low|critical\/high\/medium\/low) findings/i.test(t)) {
    problems.push('independent clean-commit R8 GO evidence is missing');
  }

  if (!/owner[\s\S]{0,120}authorized the `?bb17b9b`? push/i.test(t) ||
      !/manual Vercel promotion/i.test(t) ||
      !/Owner-observed[\s\S]{0,180}\bReady\b[\s\S]{0,100}\bProduction\b[\s\S]{0,100}\bmain\b[\s\S]{0,100}11-second build/i.test(t)) {
    problems.push('owner-authorized push or owner-observed promotion evidence is missing');
  }
  if (!/No independent anonymous GET-only post-promotion byte verification[\s\S]{0,180}(?:bb17b9b|dc961b1)/i.test(t) ||
      !t.includes(CURRENT_RELEASE_LAST_VERIFIED_BASELINE_SHA) ||
      !/last independently post-deployment-verified technical baseline/i.test(t) ||
      !/not byte proof for either later commit/i.test(t)) {
    problems.push('promotion evidence is not separated from independent deployment verification');
  }

  if (!/Production uses Supabase\/PostgreSQL for application data and sessions/i.test(t) ||
      !/MySQL remains local-development\/fallback\/rehearsal data/i.test(t) ||
      !/backend-specific immutable snapshot/i.test(t) ||
      !/excludes 360\/Guided-VR\/Free-Roam content, schedules,[\s\S]{0,100}Cloudinary media[\s\S]{0,100}private\/admin\/session data/i.test(t)) {
    problems.push('backend-specific offline scope is missing');
  }

  if (!/readiness poll[\s\S]{0,100}\/favicon\.ico/i.test(t) ||
      !/destroyed 309 harness-shaped anonymous (?:MySQL )?sessions/i.test(t) ||
      !t.includes('a50b800e370439e0257cb7667d3fdb567af9dab88b87c3aeca6f32593598d18d') ||
      !/zero candidates[\s\S]{0,80}zero scanned residue/i.test(t) ||
      !/migration sources (?:remain|are) contiguous through `?0020`?/i.test(t) ||
      !/owner[- ]applied `?0020_room_schedule_documents\.sql`?/i.test(t) ||
      !/109\/109 (?:manifest files verified|verified backup\/restore files)/i.test(t) ||
      !/86 referenced Cloudinary (?:delivery )?assets/i.test(t)) {
    problems.push('cleanup, migration, or backup boundary is missing');
  }

  if (!/(?:human pilot[\s\S]{0,120}2026-08-05|2026-08-05[\s\S]{0,120}human pilot)/i.test(t) ||
      !/zero reported findings/i.test(t) ||
      !/Participant\/Form evidence remains external/i.test(t) ||
      !/full source-commit identity was not independently verified/i.test(t) ||
      !/pilot review is complete for sequencing/i.test(t)) {
    problems.push('owner-attested pilot evidence boundary is missing');
  }

  if (!/owner supplied 29 official course titles[\s\S]{0,80}Other/i.test(t) ||
      !/\bdc961b1\b[\s\S]{0,160}accessible, case-insensitive course search/i.test(t) ||
      !/OAuth registration completion[\s\S]{0,100}student profile editor/i.test(t) ||
      !/legacy course values remain visible[\s\S]{0,100}deliberately (?:selects|changed)/i.test(t) ||
      !/submitted field remains `?course`?[\s\S]{0,180}controllers, repositories, APIs, database schema, and migrations did not change/i.test(t) ||
      !/six-file commit[\s\S]{0,80}433 insertions[\s\S]{0,80}28 deletions/i.test(t) ||
      !/package-boundary run passed `?74\/74`?/i.test(t) ||
      !t.includes(CURRENT_COURSE_WORKTREE_PACKAGE_SHA256) ||
      !/working-tree package identity is not clean-commit or deployed-byte proof/i.test(t) ||
      !/owner confirmed[\s\S]{0,140}course flows work in Production/i.test(t)) {
    problems.push('course-catalog implementation or evidence boundary is missing');
  }

  if (!/Google OAuth is now owner-observed `?In production`?/i.test(t) ||
      !/only `?openid email profile`?/i.test(t) ||
      !/sensitive or restricted-scope verification is not required/i.test(t) ||
      !/owner confirmed Google account creation and sign-in work/i.test(t) ||
      !/Branding is not verified/i.test(t) ||
      !/Search Console ownership[\s\S]{0,120}was not completed/i.test(t) ||
      !/owner chose to defer/i.test(t) ||
      !/Do not describe OAuth as verified or unlimited/i.test(t) ||
      !/Public local registration still creates guests only/i.test(t)) {
    problems.push('OAuth production, basic-scope, or unverified-branding boundary is missing');
  }

  if (!/current uncommitted candidate[\s\S]{0,180}stabilization candidate/i.test(t) ||
      !/semester room-schedule image flow/i.test(t) ||
      !/owner-applied `?0020_room_schedule_documents\.sql`?/i.test(t) ||
      !/admin-pasted Cloudinary delivery metadata/i.test(t) ||
      !/direct VR schedule-document links/i.test(t) ||
      !/valid Guided-VR and Free Roam scene arrows/i.test(t) ||
      !/VR light\/dark theme parity/i.test(t) ||
      !/offline display label `?Guard House`?/i.test(t) ||
      !/authenticated notification feed\/panel/i.test(t) ||
      !/Paga About card/i.test(t) ||
      !/admin category-dropdown styling and user role\/status filters/i.test(t) ||
      !/safe Google profile-image synchronization/i.test(t) ||
      !/(?:removal|removed) of (?:the )?manual profile-photo upload/i.test(t) ||
      !/syncSupabaseContentToMysql\.js --dry-run/i.test(t) ||
      !t.includes('2504a0474b0481964d447f5f538b9e4e1cd77ef0116c4299c12d0a81eae5bf05') ||
      !/No data was written/i.test(t) ||
      !/Android 8 installed-PWA crash remains unresolved/i.test(t) ||
      !/Docker\/client-clone deployment readiness also remains deferred/i.test(t) ||
      !/fresh session grounds first[\s\S]{0,180}separately authorized session verifies the non-Cloudinary changes/i.test(t) ||
      !/Cloudinary support remains an external event-based dependency/i.test(t) ||
      !/if no response has arrived[\s\S]{0,180}verified non-Cloudinary findings one bounded issue at a time/i.test(t) ||
      !/Manual Cloudinary upload stays deferred/i.test(t) ||
      !/Grounding prompts do not themselves authorize tests/i.test(t) ||
      !/missing current full QA, independent review, commit, push, deployment, and Production acceptance/i.test(t) ||
      !/(?:authorizes no product implementation|It authorizes no product implementation)/i.test(t) ||
      !/Final Milestone 12 disposition remains (?:an explicit owner\/external closeout decision|external)/i.test(t)) {
    problems.push('next owner boundary or no-authorization rule is missing');
  }

  const forbiddenClaims = [
    /independent(?:ly)?[\s\S]{0,80}(?:GET-only|post-promotion)[\s\S]{0,80}(?:passed|PASS)[\s\S]{0,100}(?:bb17b9b|dc961b1)/i,
    /Google OAuth[\s\S]{0,100}(?:is|was|has been)[\s\S]{0,60}(?:verified|unlimited)/i,
    /(?:branding|Search Console ownership)[\s\S]{0,80}(?:is|was|has been) (?:verified|completed)/i,
    /manual (?:profile-)?photo (?:flow|upload)[^.;]{0,100}(?:is|was|has been) (?:accepted|complete|verified|production-ready)/i,
    /Cloudinary[\s\S]{0,120}(?:folder permission|Manager access)[\s\S]{0,80}(?:is|was|has been) (?:granted|confirmed|verified)/i,
    /support response[\s\S]{0,80}(?:was|has been) received/i,
    /current 70-path worktree[\s\S]{0,180}(?:full QA passed|Codex GO|deployed|Production acceptance)/i,
    /\bpassword\s*[:=]\s*\S+/i,
  ];
  if (forbiddenClaims.some((rule) => rule.test(t))) {
    problems.push('continuity scope contains a premature, conflicting, or secret-bearing claim');
  }
  return problems;
}

/** PURE: require the exact committed implementation and R8 lifecycle boundary. */
function currentOfflineCorrectionEvidenceProblems(value) {
  if (currentReleaseContinuityProblems(value, { requireMarkers: false }).length === 0) {
    return [];
  }
  const t = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  const problems = [];
  const committedManifestShape =
    /\bmanifest SHA-256\b.{0,100}\b19 files\b.{0,100}\b2,072,400 bytes\b/i.test(t) ||
    /\b19-file(?:s)?\b.{0,100}\bmanifest SHA-256\b.{0,100}\b2,072,400 bytes\b/i.test(t);
  if (!t.includes(CURRENT_OFFLINE_COMMITTED_MANIFEST_SHA256) ||
      !committedManifestShape ||
      !/\bd786bdcb83a196c7263dceae668417d3ced3e95a\b[\s\S]{0,160}\b(?:committed|pushed)\b/i.test(t)) {
    problems.push('committed 19-file manifest and pushed implementation evidence is missing');
  }
  if (!/\b(?:replacement )?full verification\b.{0,120}\b4998\/4998\b.{0,80}\bQUALITY-GATES OK\b/i.test(t) ||
      !/\bfive-stage (?:npm run )?qa\b/i.test(t) ||
      !/\b24\/24\s*->\s*18\/18\s*->\s*46\/46\b/i.test(t) ||
      !/\b(?:bounded )?Chrome acceptance\b.{0,120}\bboth supported backends\b/i.test(t)) {
    problems.push('replacement verification evidence is missing');
  }
  if (!t.includes(CURRENT_OFFLINE_PACKAGE_SHA256) ||
      !/\bpackage (?:pin|identity)\b.{0,100}\b168 files\b.{0,80}\b7,074,195 bytes\b.{0,100}\baggregate SHA-256\b/i.test(t)) {
    problems.push('current package identity is missing');
  }
  if (!/\bclean-commit (?:independent )?R8\s+review\b.{0,180}\bNO-GO\b.{0,240}\bstale operative lifecycle authority\b/i.test(t)) {
    problems.push('clean-commit R8 stale-authority NO-GO evidence is missing');
  }
  if (!/\bFinal Milestone 12 disposition\b.{0,160}\b(?:remains external|not self-issued|external)\b/i.test(t) ||
      !/\b(?:no|not)\s+(?:promotion|deployment)\b.{0,100}\bauthori[sz]ed\b/i.test(t)) {
    problems.push('final-closeout and release boundaries are missing');
  }
  if (/\bcurrent uncommitted 19-file offline UI\/accessibility\/package correction candidate\b/i.test(t) ||
      /\bNo full suite, QA, ordered postconditions, browser acceptance\b/i.test(t)) {
    problems.push('obsolete uncommitted or pre-verification current claim remains');
  }
  return problems;
}

/** PURE: does ONE reusable prompt body carry the current M12.P1 authority? */
function reusablePromptIsCurrent(body) {
  const t = String(body == null ? '' : body).replace(/\s+/g, ' ').trim();
  if (t === '') return false;

  const carriesPromotedReleaseAuthority =
    currentReleaseContinuityProblems(t, { requireMarkers: false }).length === 0;

  if (t.includes(CURRENT_PUSHED_CANDIDATE_COMMIT_SHA)) {
    return carriesPromotedReleaseAuthority &&
      /fresh context-only grounding session/i.test(t) &&
      /load and follow the installed code-reviewer skill/i.test(t) &&
      /public FAQ page/i.test(t) &&
      /Deployment is not authorized by this prompt/i.test(t) &&
      /context-only prompt authorizes none/i.test(t);
  }

  const carriesCurrentAuthority =
    /\bR1-R7\b[\s\S]{0,180}\b(?:and\s+)?D1-D5\b[\s\S]{0,160}\b(?:and\s+)?(?:expanded\s+)?D7\b[\s\S]{0,160}\b(complete|completed)\b[\s\S]{0,80}\bCodex GO\b/i.test(t) &&
    /\bdependency-security remediation\b[\s\S]{0,140}\b(complete|completed)\b[\s\S]{0,80}\bCodex GO\b/i.test(t) &&
    recordsCurrentDependencyRemediation(t) &&
    /\bR6\b[\s\S]{0,140}\b(?:complete|completed)\b[\s\S]{0,80}\bCodex GO\b/i.test(t) &&
    /\bcontext-only\b[\s\S]{0,200}\bdoes not authorize\b[\s\S]{0,80}\bimplementation\b/i.test(t) &&
    /\bR7\b[\s\S]{0,180}\b(?:complete|completed)\b[\s\S]{0,80}\bCodex GO\b/i.test(t) &&
    recordsAcceptedR7EvidenceText(t) &&
    recordsAcceptedD7EvidenceText(t) &&
    /\bcontext-only\b[\s\S]{0,160}\bauthorizes none\b/i.test(t) &&
    /\bfinal Milestone 12\b[\s\S]{0,220}\b(?:not self-issued|remains external|awaits? (?:one )?independent|latest independent external closeout report controls)\b/i.test(t) &&
    /\bdeployment is not authorized\b/i.test(t);

  /* A reusable prompt is a live authority surface: it seeds a new session with
     continuity claims. Requiring the deployed-baseline analyzer here closes the
     gap where a prompt body could assert a stale or conflicting production
     baseline that every other authority document is already checked against. */
  if (!carriesCurrentAuthority || !carriesPromotedReleaseAuthority ||
      declaresStaleOrPrematureAuthority(t)) return false;

  /* The promoted-release prompt deliberately distinguishes owner-observed
     promotion from the older independently verified fea3b2e smoke. The legacy
     lifecycle predicates model the pre-promotion state and remain active only
     for historical fixtures that do not carry the new release authority. */
  return true;
}

/** PURE: both reusable prompts extract cleanly AND are independently current. */
function reusablePromptsAreCurrent(doc) {
  const prompts = extractReusablePrompts(doc);
  if (!prompts) return false;
  return reusablePromptIsCurrent(prompts.codex) && reusablePromptIsCurrent(prompts.claude);
}

/* A grounding prompt may record the local offline candidate without
   authorizing more work. Require either Claude's direct "do not infer" construction
   or Codex's bounded "Never use direct SQL ... or infer" construction, and
   reject an additive permission that would contradict an otherwise valid
   denial. The two OFF.2 forms match the current prompt word orders; the older
   state-neutral forms remain accepted for historical fixture coverage. */
const REUSABLE_PROMPT_WAIT_DENIAL_RE =
  /\b(?:do not infer that|never use direct SQL[\s\S]{0,400}\bor infer that) (?:OFF\.2 implementation, another pilot, offline work, or deployment is authorized|OFF\.2 implementation, offline mode, deployment, or another pilot is authorized|further implementation, another pilot, Git mutation, or deployment is authorized|further implementation, deployment, Git mutation, or another pilot is authorized|implementation, Git mutation, vendor work, or deployment is authorized|pilot, offline, or deployment work is next|offline mode, deployment, or pilot work is automatically next)\b/i;

function reusablePromptHasExplicitWaitBoundary(value) {
  const t = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  const denial = REUSABLE_PROMPT_WAIT_DENIAL_RE.exec(t);
  if (!denial) return false;

  const remainder = t.slice(0, denial.index) + t.slice(denial.index + denial[0].length);
  const contradictoryRules = [
    /\b(?:OFF\.2 implementation|another pilot|offline (?:work|mode)|deployment)\b[\s\S]{0,80}\b(?:is|are)\s+(?!not\b)(?:now\s+)?authorized\b/i,
    /\b(?:this (?:context-only )?prompt\s+)?authorizes(?!\s+none\b)[\s\S]{0,80}\b(?:OFF\.2 implementation|another pilot|offline (?:work|mode)|deployment)\b/i,
    /\b(?:begin|start|implement|execute)\s+OFF\.2(?:\s+implementation)?\b/i,
    /\b(?:another pilot|offline (?:work|mode)|deployment)\b[\s\S]{0,60}\b(?:is|are)\s+(?:automatically\s+)?next\b/i,
  ];
  return !contradictoryRules.some((rule) => rule.test(remainder));
}

/** PURE: Codex grounds current truth and waits without performing a review. */
function reusableCodexPromptHasWaitBoundary(body) {
  const t = String(body == null ? '' : body).replace(/\s+/g, ' ').trim();
  return reusablePromptIsCurrent(t) &&
    /fresh context-only grounding session that does not authorize implementation or review/i.test(t) &&
    /load and follow the installed code-reviewer skill/i.test(t) &&
    /Do not perform a code review/i.test(t) &&
    /Stop and wait for the owner/i.test(t) &&
    /Deployment is not authorized by this prompt/i.test(t) &&
    reusablePromptHasExplicitWaitBoundary(t);
}

/** PURE: Claude grounds the exact state, performs no review, and waits. */
function reusableClaudePromptHasWaitBoundary(body) {
  const t = String(body == null ? '' : body).replace(/\s+/g, ' ').trim();
  return reusablePromptIsCurrent(t) &&
    /fresh context-only grounding session that does not authorize implementation/i.test(t) &&
    /load and follow the installed code-reviewer skill/i.test(t) &&
    /Do not review, edit, test, implement, stage, commit, push, deploy(?:, promote)?, or perform (?:an R8|a closeout) review/i.test(t) &&
    /After the grounding report, stop and wait for the owner/i.test(t) &&
    /Deployment is not authorized by this prompt/i.test(t) &&
    reusablePromptHasExplicitWaitBoundary(t);
}

/* The R7 execution prompt is SPENT: R7 later received independent Codex GO,
   but the prompt must never again present itself as current executable
   authority. It is retained verbatim under the historical
   heading — exactly as the R6 prompt was — so a reviewer can still check the
   delivered work against the authority it ran under. */
const SPENT_R7_EXECUTION_PROMPT_HEADING =
  '## Historical Spent One-Shot R7 Execution Prompt';
const SUPERSEDED_CURRENT_R7_PROMPT_HEADING =
  '## Current Owner-Authorized One-Shot R7 Execution Prompt';

/**
 * PURE: extract the one archived R7 execution prompt from CLAUDE_HANDOFF.md.
 * The section must occur exactly once and contain exactly one non-empty
 * ~~~text block. A prompt under any other heading cannot satisfy it.
 */
function extractSpentR7ExecutionPrompt(doc) {
  const lines = String(doc == null ? '' : doc).split(/\r?\n/);
  const headings = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === SPENT_R7_EXECUTION_PROMPT_HEADING) headings.push(i);
  }
  if (headings.length !== 1) return null;

  let end = lines.length;
  for (let i = headings[0] + 1; i < lines.length; i++) {
    if (/^##\s+\S/.test(lines[i])) {
      end = i;
      break;
    }
  }
  const section = lines.slice(headings[0] + 1, end);
  const fences = [];
  for (let i = 0; i < section.length; i++) {
    if (/^~~~/.test(section[i].trim())) fences.push(i);
  }
  if (fences.length !== 2) return null;
  if (section[fences[0]].trim() !== '~~~text') return null;
  if (section[fences[1]].trim() !== '~~~') return null;

  const body = section.slice(fences[0] + 1, fences[1]).join('\n').trim();
  return body === '' ? null : body;
}

/** PURE: validate the decision-complete R7 execution authorization body. */
function r7ExecutionPromptIsValid(body) {
  const raw = String(body == null ? '' : body);
  const t = raw.replace(/\s+/g, ' ').trim();
  if (t === '') return false;

  const requiredRuntimeDirs = [
    'config', 'controllers', 'middleware', 'models', 'repositories',
    'routes', 'services', 'utils', 'views', 'public',
  ];

  return (
    /M12\.P1-R7\s+(?:-|—)\s+Vercel Package and Static-CDN Boundary/i.test(t) &&
    /C:\\Users\\FROST\.GG\\Desktop\\CampuSphere v1/i.test(raw) &&
    /\bexplicitly authorizes only (?:M12\.P1-)?R7\b/i.test(t) &&
    /\bR6\b[\s\S]{0,160}\bcomplete\b[\s\S]{0,100}\bCodex GO\b/i.test(t) &&
    /\bDo not begin expanded D7 or R8\b/i.test(t) &&
    /\bDo not deploy\b/i.test(t) &&
    /\bclaim R7 GO\b/i.test(t) &&
    /\bStop after the final R7 candidate report\b/i.test(t) &&
    /\bDo not spawn subagents\b/i.test(t) &&
    /\bUse Context7\b[\s\S]{0,160}\bVercel documentation\b/i.test(t) &&
    /\bCURRENT EXECUTION PRECONDITION\b/i.test(t) &&
    /\b24\/24\b[\s\S]{0,160}\b18\/18\b[\s\S]{0,160}\b46\/46\b/i.test(t) &&
    /\bIf any precondition is not green\b[\s\S]{0,100}\bstop without editing\b/i.test(t) &&
    /\bdoes not authorize session cleanup\b/i.test(t) &&
    /\bpackage\.json\b[\s\S]{0,120}\b8291bcba01370e529bc756dc122a4166d2b9ade1a9c1f0a81f5af2a00b5e5c4e\b/i.test(t) &&
    /\bpackage-lock\.json\b[\s\S]{0,120}\b88bd470464bf0fc4fb5dc5c371588db3a655c4b67cf8d82a0e0dea5e81f33d61\b/i.test(t) &&
    /\bCreate a root `?\.vercelignore`?/i.test(t) &&
    /\bbegin with `?\/\*`?/i.test(t) &&
    requiredRuntimeDirs.every((name) => new RegExp('`?' + name + '`?', 'i').test(t)) &&
    /\bpublic\/img\/sample 360\/\*\*/i.test(t) &&
    /\bCreate a minimal root `?vercel\.json`?/i.test(t) &&
    /\bX-Content-Type-Options\b[\s\S]{0,80}\bnosniff\b/i.test(t) &&
    /\bService-Worker-Allowed\b[\s\S]{0,40}\/(?:\s|`|,|\.)/i.test(t) &&
    /\bExpress\b[\s\S]{0,120}\bnonce CSP\b/i.test(t) &&
    /\bscripts\/vercelPackageBoundary-probe\.js\b/i.test(t) &&
    /\bvercel-package-boundary\b/i.test(t) &&
    /\bCURRENT DIRTY-WORKTREE BOUNDARY PREVIEW\b/i.test(t) &&
    /\bstandalone\b[\s\S]{0,100}\bnot\b[\s\S]{0,60}\bnpm test\b/i.test(t) &&
    /\bNo migration 0020 exists or is authorized\b/i.test(t) &&
    /\bDo not change package\.json or package-lock\.json\b/i.test(t) &&
    /\bDo not stage, commit, stash, reset, checkout, clean,\s*revert\b/i.test(t) &&
    /\bR7 becomes `?implemented and awaiting independent Codex review`?\b/i.test(t) &&
    /\bno R7 GO is claimed\b/i.test(t) &&
    /\bExpanded D7\b[\s\S]{0,120}\bblocked by R7 Codex GO\b/i.test(t) &&
    /\bStop after the report\b/i.test(t) &&
    !/\bR7\b[^.]{0,120}\b(?:is|has been)\s+(?:complete|completed)\b/i.test(t) &&
    !/\bexpanded D7\b[^.]{0,120}\b(?:is|has been)\s+(?:authorized|complete|completed)\b/i.test(t)
  );
}

/* =============================================================================
   M12.P1-R6 provenance-remediation — pure markdown-table evidence predicates.
   =============================================================================
   These operate ONLY on GitHub-flavoured markdown TABLE ROWS (lines starting
   with '|'). The spent R6 execution prompt and archived historical prose never
   start with '|', so they are naturally out of scope and are never flagged for
   recording the real old 22/24 event. */

/** PURE: parse markdown table rows; skip separator and non-table lines. */
function markdownTableRows(md) {
  const rows = [];
  for (const line of String(md == null ? '' : md).split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const cells = t.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
    if (cells.length && cells.every((c) => /^:?-{3,}:?$/.test(c))) continue; // separator row
    rows.push({ cells, raw: t });
  }
  return rows;
}

/** PURE: is a table row explicitly marked historical or superseded? */
function evidenceRowIsHistorical(raw) {
  return /\bhistorical\b|\bsuperseded\b/i.test(String(raw == null ? '' : raw));
}

/**
 * PURE: audit the CURRENT safety-evidence row. Requires exactly one current
 * (non-historical) row that references the pilot credential/session-safety
 * probe, that it states 24/24, and that it does NOT describe a current 22/24.
 * @returns {string[]} problems (empty = compliant)
 */
function analyzeCurrentSafetyRow(md) {
  const rows = markdownTableRows(md);
  const problems = [];
  const safety = rows.filter((r) => /pilotCredentialSafety-probe|credential\/session safety/i.test(r.raw));
  const current = safety.filter((r) => !evidenceRowIsHistorical(r.raw));
  if (current.length === 0) problems.push('no current safety evidence row');
  if (current.length > 1) problems.push('duplicate current safety evidence rows');
  for (const r of current) {
    if (!/\b24\/24\b/.test(r.raw)) problems.push('current safety row does not state 24/24');
    if (/\b22\/24\b/.test(r.raw)) problems.push('current safety row still describes 22/24');
  }
  return problems;
}

/**
 * PURE: every markdown TABLE ROW that mentions 22/24 must be explicitly
 * historical/superseded AND state that restoration closed it.
 * @returns {string[]} problems (empty = compliant)
 */
function every22_24RowHistorical(md) {
  const problems = [];
  for (const r of markdownTableRows(md)) {
    if (!/\b22\/24\b/.test(r.raw)) continue;
    if (!evidenceRowIsHistorical(r.raw)) problems.push('a 22/24 evidence row is not marked historical/superseded');
    else if (!/\brestor/i.test(r.raw)) problems.push('a historical 22/24 row does not state restoration closed it');
  }
  return problems;
}

/**
 * PURE: the CURRENT provenance evidence row (located by a label regex over the
 * whole row) must describe INDEPENDENT exact pinning, not shape-only validation.
 * Fails closed on missing or duplicate targeted rows.
 * @returns {string[]} problems (empty = compliant)
 */
function analyzeCurrentProvenanceRow(md, labelRe) {
  const rows = markdownTableRows(md).filter((r) => labelRe.test(r.raw));
  const current = rows.filter((r) => !evidenceRowIsHistorical(r.raw));
  const problems = [];
  if (current.length === 0) problems.push('no current provenance evidence row');
  if (current.length > 1) problems.push('duplicate current provenance evidence rows');
  const pins = (raw) => /EXPECTED_VENDOR_INVENTORY|independently pinned|pinned independently|independent(?:ly)?\s+(?:reviewed\s+)?inventory|outside\b[^|]{0,60}\bmanifest/i.test(raw);
  const shapeOnly = (raw) => /shape-only|registry-URL prefix|sha512-?\s*prefix|prefix check/i.test(raw);
  for (const r of current) {
    if (!pins(r.raw)) problems.push('current provenance row does not describe independent exact pinning');
    if (shapeOnly(r.raw) && !pins(r.raw)) problems.push('current provenance row describes shape-only validation');
  }
  return problems;
}

/** PURE: require exactly one post-synchronization RED table row, marked
    historical/superseded and stating restoration closed it. */
function analyzePostSyncRow(md) {
  const rows = markdownTableRows(md).filter((r) => /post-synchronization/i.test(r.raw));
  if (rows.length === 0) return ['no post-synchronization row'];
  if (rows.length > 1) return ['duplicate post-synchronization rows'];
  const problems = [];
  if (!evidenceRowIsHistorical(rows[0].raw)) problems.push('post-synchronization RED row is not marked historical/superseded');
  if (!/\brestor/i.test(rows[0].raw)) problems.push('post-synchronization row does not state restoration closed it');
  return problems;
}

/**
 * PURE: audit the accepted "Full contract suite (M12.P1-R6 provenance-
 * remediation closeout)" markdown table row. Fails closed on a missing or
 * duplicate row.
 * Requires TRUTHFUL fixture accounting for the +20 self-hosted-vendor increase
 * (119 -> 139 = the exact-inventory replacement of the former shape-only
 * assertion [no net], +1 inventory-cardinality, +1 disk-hash, +17 rejecting
 * inventory mutations, +1 positive live-manifest anchor) and REJECTS the earlier
 * false "18 negative provenance fixtures" phrasing.
 * @returns {string[]} problems (empty = compliant)
 */
function analyzeProvenanceRemediationRow(md) {
  const rows = markdownTableRows(md).filter((r) => /full contract suite \(m12\.p1-r6 provenance-remediation closeout\)/i.test(r.raw));
  if (rows.length === 0) return ['no provenance-remediation full-suite row'];
  if (rows.length > 1) return ['duplicate provenance-remediation full-suite rows'];
  const raw = rows[0].raw;
  const problems = [];
  // The +20 self-hosted-vendor 119 -> 139 increase must be stated.
  if (!/119\s*(?:->|to)\s*139/i.test(raw)) problems.push('does not state the self-hosted-vendor 119 -> 139 increase');
  if (!/\+20\b/.test(raw)) problems.push('does not state the +20 total');
  // The true 17-rejecting-plus-1-positive-anchor composition must be stated.
  if (!/\b17\b[^|]{0,40}\brejecting\b/i.test(raw)) problems.push('does not state 17 rejecting inventory mutations');
  if (!/\bpositive\b[^|]{0,40}\b(?:live-manifest|anchor)\b/i.test(raw)) problems.push('does not state the positive live-manifest anchor');
  // The false "18 ... negative" claim must NOT appear.
  if (/\b18\b[^|]{0,40}\bnegative\b/i.test(raw)) problems.push('falsely claims 18 negative fixtures');
  return problems;
}

/* ---- M12.P1-R8 evidence-consistency analyzers (structural, text-in only) ----
   Every function below reads ONLY the markdown text it is handed. None of them
   reads a file, and none scans this gate's own source, so the fixture strings
   and commentary in scripts/quality-gates.js can never collide with a detector.
   Row targeting is done on PARSED CELLS rather than whole-row substrings: a
   superseded figure quoted inside an evidence cell as historical context is a
   legitimate citation, while the same figure sitting in a STATUS cell is a
   current disposition. Only the latter is a defect. */

  /* The committed implementation package, pinned HERE independently of the
   probe and both evidence documents. The accepted local predecessor and
   technical Production baseline remain historical authority and are not
   silently relabelled by this implementation. */
const EXPECTED_CURRENT_PACKAGE_INVENTORY = Object.freeze({
  files: 186,
  bytes: '7,220,073',
  sha256: 'c19b2bb9bcd328df56f0eb247077f48e0c3cc6f35bf919c0e22da0d3add1f621',
});

/* The deployable bytes now include the room-schedule image candidate and the
   deferred profile-upload removal. Keep this live-worktree pin separate from
   accepted historical release evidence until a clean commit is reviewed. */
const EXPECTED_LIVE_PACKAGE_INVENTORY = Object.freeze({
  files: 186,
  bytes: '7,220,073',
  sha256: 'c19b2bb9bcd328df56f0eb247077f48e0c3cc6f35bf919c0e22da0d3add1f621',
});

/** PURE: compare a manifest with this gate's independent exact-byte pin. */
function currentPackageInventoryProblems(manifest, expected = EXPECTED_CURRENT_PACKAGE_INVENTORY) {
  const problems = [];
  if (!manifest || typeof manifest !== 'object') return ['manifest is missing'];
  const expectedBytes = Number(String(expected && expected.bytes == null ? '' : expected.bytes).replace(/,/g, ''));
  if (manifest.fileCount !== Number(expected && expected.files)) {
    problems.push('live package file count differs from the quality-gate pin');
  }
  if (manifest.byteTotal !== expectedBytes) {
    problems.push('live package byte total differs from the quality-gate pin');
  }
  if (manifest.aggregateSha256 !== String(expected && expected.sha256 || '')) {
    problems.push('live package aggregate SHA-256 differs from the quality-gate pin');
  }
  return problems;
}

/* Current expanded BE.6 evidence, pinned independently of both the freeze
   configuration and the evidence document. A coordinated config+docs edit
   therefore cannot silently redefine the reviewed backend/catalog truth. */
const EXPECTED_CURRENT_BE6_EVIDENCE = Object.freeze({
  mysql: 'MySQL has 34 buildings, 44 route nodes, 100 directed edges, 50 exact reverse pairs, 100 valid geometries, and 33 routable destinations',
  supabase: 'Supabase has 25 buildings, 26 route nodes, 50 directed edges, 25 exact reverse pairs, 50 valid geometries, and 25 routable destinations',
  guidedCatalog: 'the shared Guided-VR catalog has 25 active destinations, 472 configured steps, and 99 unique scene keys',
  be6Result: 'BE.6 freeze remains 46/46',
});

/* The facilitator demo must state the same backend/catalog authority and the
   complete fail-closed arrival contract. This pin is independent of the demo
   document and the runtime resolver. */
const EXPECTED_CURRENT_DEMO_ROUTING = Object.freeze({
  mysql: 'MySQL freezes 34 buildings, 44 route nodes, 100 directed edges, 50 exact reverse pairs, 100 valid geometries, and 33 routable destinations',
  supabase: 'Supabase freezes 25 buildings, 26 route nodes, 50 directed edges, 25 exact reverse pairs, 50 valid geometries, and 25 routable destinations',
  guidedCatalog: 'Guided VR covers 25 active destinations, 472 configured steps, and 99 unique scene keys',
  naturalEndpoint: 'the configured natural destination node',
  storedMappings: 'stored start and arrival scene mappings',
  approvedMedia: 'an approved Cloudinary delivery URL and public ID',
  bidirectionalLinks: 'exactly one forward and one reverse scene link for every adjacent scene pair',
  failClosed: 'otherwise the route remains unavailable and no arrival is reported',
});

const EXPECTED_CURRENT_DEMO_SEQUENCE = Object.freeze([
  'technical production baseline',
  'authorized push automatically triggered production',
  'bounded anonymous read-only get-only post-deployment verification passed',
  'future main deployments require manual promotion',
  'db05b54',
  'staged',
  'human pilot occurred on 2026-08-05',
  'owner accepts it with zero reported findings',
  'participant/form evidence remains external',
  'full source-commit identity was not independently verified',
  'pilot review is complete',
  'off.2-off.6 and d6 are complete and codex go',
  'd786bdcb83a196c7263dceae668417d3ced3e95a is committed and pushed',
  'no promotion or deployment is authorized',
  'final milestone 12 disposition remains external',
]);

/* The exact current candidate total is pinned independently of both evidence
   documents. Adding a check without synchronizing both current npm-test and QA
   dispositions must fail closed instead of leaving neighbouring stale totals. */
// The definitive D6 and OFF.6 verification transcript emitted 4,998 checks.
// This authority synchronization changes existing compound assertions only;
// it adds no top-level ok() call and therefore preserves that registered total.
const EXPECTED_CURRENT_QUALITY_TOTAL = 4998;

const REQUIRED_CURRENT_QA_EVIDENCE_MARKERS = Object.freeze([
  'QUALITY-GATES OK',
  'DB-PERF-GATE OK',
  '[supabase-smoke] PASS',
  'IDENTITY-CONSTRAINTS OK',
  'found 0 vulnerabilities',
]);

/** PURE: the STATUS cell of an evidence row (always second-to-last column). */
function evidenceStatusCell(cells) {
  if (!Array.isArray(cells) || cells.length < 3) return '';
  return String(cells[cells.length - 2] == null ? '' : cells[cells.length - 2]);
}

/** PURE: the EVIDENCE/disposition cell of an evidence row (last column). */
function evidenceReferenceCell(cells) {
  if (!Array.isArray(cells) || cells.length < 3) return '';
  return String(cells[cells.length - 1] == null ? '' : cells[cells.length - 1]);
}

/**
 * PURE: a row is HISTORICAL only when its OWN label or disposition says so.
 * The whole-row predicate (evidenceRowIsHistorical) cannot be used to decide
 * "is this row current?", because a perfectly current row routinely CITES older
 * evidence as historical inside its evidence cell — that citation is a virtue,
 * not a self-demotion. Deliberately scoped to the label and status cells, and
 * kept separate from evidenceRowIsHistorical so no existing gate changes.
 * @returns {boolean}
 */
function evidenceRowSelfMarkedHistorical(cells) {
  const label = Array.isArray(cells) && cells.length ? String(cells[0] == null ? '' : cells[0]) : '';
  return /\bhistorical\b|\bsuperseded\b/i.test(label + ' ' + evidenceStatusCell(cells));
}

/**
 * PURE: extract one `## <heading>` section's body from a markdown document.
 * Stops at the next `## ` heading (a deeper `###` heading does not terminate it).
 * @returns {string} the section body, or '' when the heading is absent
 */
function markdownSection(md, headingRe) {
  const out = [];
  let inSection = false;
  for (const line of String(md == null ? '' : md).split(/\r?\n/)) {
    if (/^##\s+/.test(line)) {
      if (inSection) break;
      if (headingRe.test(line.trim())) { inSection = true; continue; }
    }
    if (inSection) out.push(line);
  }
  return out.join('\n');
}

/**
 * PURE: there must be exactly ONE current "Full QA aggregate" disposition, it
 * must not be Pending or blank, and it must reference verified QA evidence.
 * @returns {string[]} problems (empty = compliant)
 */
function analyzeFullQaAggregateRows(md) {
  const rows = markdownTableRows(md).filter((r) => /full qa aggregate/i.test(r.cells[0] || ''));
  const problems = [];
  if (rows.length === 0) problems.push('no Full QA aggregate row');
  const current = rows.filter((r) => !evidenceRowSelfMarkedHistorical(r.cells));
  if (current.length === 0) problems.push('no current Full QA aggregate disposition');
  if (current.length > 1) problems.push('duplicate current Full QA aggregate dispositions');
  for (const r of current) {
    const status = evidenceStatusCell(r.cells);
    if (/\bpending\b/i.test(status)) problems.push('current Full QA aggregate row is still Pending');
    if (status.trim() === '') problems.push('current Full QA aggregate row has a blank status');
    else if (!/\bPASS\b/i.test(status)) problems.push('current Full QA aggregate row records no PASS disposition');
    if (!/QUALITY-GATES OK|\b\d{4}\/\d{4}\b/i.test(r.raw)) {
      problems.push('current Full QA aggregate row references no verified QA evidence');
    }
  }
  return problems;
}

/**
 * PURE: every Manual Black-Box Checklist row must carry a nonblank status and a
 * nonblank evidence/disposition, and none may be Pending. Fails closed when the
 * section is missing or empty.
 * @returns {string[]} problems (empty = compliant)
 */
function analyzeManualBlackBoxRows(md) {
  const section = markdownSection(md, /^##\s+Manual Black-Box Checklist\s*$/);
  if (section.trim() === '') return ['no Manual Black-Box Checklist section'];
  const rows = markdownTableRows(section).filter((r) => !/^area$/i.test(r.cells[0] || ''));
  const problems = [];
  if (rows.length === 0) problems.push('Manual Black-Box Checklist has no rows');
  for (const r of rows) {
    const label = String(r.cells[0] || '') + ' / ' + String(r.cells[1] || '');
    if (r.cells.length < 6) { problems.push('malformed manual row: ' + label); continue; }
    const status = evidenceStatusCell(r.cells);
    if (/\bpending\b/i.test(status)) problems.push('Pending manual status: ' + label);
    if (status.trim() === '') problems.push('blank manual status: ' + label);
    if (evidenceReferenceCell(r.cells).trim() === '') problems.push('blank manual evidence/disposition: ' + label);
  }
  return problems;
}

/**
 * PURE: exactly one current route/pathfinding manual row must bind its PASS
 * disposition to the independently pinned expanded BE.6 backend and Guided-VR
 * catalog truth. Historical rows elsewhere remain legal.
 * @returns {string[]} problems (empty = compliant)
 */
function analyzeCurrentRoutePathfindingEvidence(md, expected) {
  const section = markdownSection(md, /^##\s+Manual Black-Box Checklist\s*$/);
  if (section.trim() === '') return ['no Manual Black-Box Checklist section'];

  const rows = markdownTableRows(section).filter((row) =>
    /^route\/pathfinding$/i.test(String(row.cells[0] || '').trim()) &&
    /^road-following destination route$/i.test(String(row.cells[1] || '').trim()));
  const current = rows.filter((row) => !evidenceRowSelfMarkedHistorical(row.cells));
  const problems = [];

  if (current.length === 0) problems.push('no current route/pathfinding evidence row');
  if (current.length > 1) problems.push('duplicate current route/pathfinding evidence rows');

  for (const row of current) {
    const status = evidenceStatusCell(row.cells);
    const evidence = evidenceReferenceCell(row.cells).replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim();
    const normalizedEvidence = evidence.toLowerCase();
    const requiredClaims = [expected.mysql, expected.supabase, expected.guidedCatalog, expected.be6Result];

    if (!/\bPASS\b/i.test(status)) problems.push('current route/pathfinding row is not PASS');
    for (const claim of requiredClaims) {
      if (!normalizedEvidence.includes(String(claim).toLowerCase())) {
        problems.push('current route/pathfinding row does not bind the pinned claim: ' + claim);
      }
    }
    if (normalizedEvidence.includes(
      '21 nodes, 50 directed edges, 25 exact reverse pairs, 50 valid geometries, and 13 routable destinations in both backends')) {
      problems.push('current route/pathfinding row restores the superseded shared 21/50/25/50/13 topology');
    }
  }

  return problems;
}

/** PURE: extract the body of one exact level-three markdown subsection. */
function markdownSubsection(md, headingRe) {
  const lines = String(md == null ? '' : md).split(/\r?\n/);
  const start = lines.findIndex((line) => headingRe.test(line.trim()));
  if (start < 0) return '';
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^###\s+/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join('\n');
}

/**
 * PURE: the facilitator's Campus Navigation section must bind its expected
 * result to the backend-specific freeze and complete arrival authority.
 * @returns {string[]} problems (empty = compliant)
 */
function analyzeDemoRoutingContract(md, expected) {
  const section = markdownSubsection(md, /^###\s+4\.\s+Campus Navigation\s*$/i);
  if (!section.trim()) return ['Campus Navigation subsection is missing'];
  const normalized = section.replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const required = [
    expected.mysql,
    expected.supabase,
    expected.guidedCatalog,
    expected.naturalEndpoint,
    expected.storedMappings,
    expected.approvedMedia,
    expected.bidirectionalLinks,
    expected.failClosed,
  ];
  const problems = [];
  for (const claim of required) {
    if (!normalized.includes(String(claim).toLowerCase())) {
      problems.push('Campus Navigation omits the pinned claim: ' + claim);
    }
  }
  if (/20-node\s*\/\s*48-edge|24-pair graph|all 13 current destinations/i.test(section)) {
    problems.push('Campus Navigation restores the superseded shared demo topology');
  }
  return problems;
}

/**
 * PURE: the facilitator's readiness section must preserve the accepted
 * Production result, staged-authority commit, owner-attested pilot boundary,
 * accepted local D6/OFF.2-OFF.6 state, and independent final closeout.
 * @returns {string[]} problems (empty = compliant)
 */
function analyzeDemoReadinessSequence(md, expectedSteps) {
  const section = markdownSubsection(md, /^###\s+6\.\s+Security And Deployment Readiness\s*$/i);
  if (!section.trim()) return ['Security And Deployment Readiness subsection is missing'];
  const normalized = section.replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const problems = [];
  let cursor = -1;
  for (const step of expectedSteps) {
    const index = normalized.indexOf(String(step).toLowerCase(), cursor + 1);
    if (index < 0) {
      problems.push('readiness sequence omits or reorders: ' + step);
      continue;
    }
    cursor = index;
  }
  if (/m12\.p1\s+limited-pilot readiness is next/i.test(section)) {
    problems.push('limited-pilot readiness is incorrectly promoted as the immediate next step');
  }
  if (/human pilot evidence remains open|pilot (?:evaluation|review) remains (?:unopened|open|pending)/i.test(section)) {
    problems.push('readiness section retains a stale pilot-open disposition');
  }
  if (/(?:full source-commit identity|tested build identity)[^]{0,100}(?:was|is) independently verified/i.test(section)) {
    problems.push('readiness section overstates the pilot build identity');
  }
  return problems;
}

/**
 * PURE: the deployment-smoke manual row must remain explicitly DEFERRED, must
 * name SEC-51, and must never claim PASS.
 * @returns {string[]} problems (empty = compliant)
 */
/* Production identity is pinned independently of both evidence documents. The
   post-deployment check is external to the local harness, so every current row
   must bind the production host to the exact accepted technical baseline. */
const EXPECTED_SEC51_PRODUCTION_HOST = 'campusphere-cspc.vercel.app';
const EXPECTED_SEC51_DEPLOYED_BASELINE =
  'fea3b2e11c6331eddc1ee091b165427d8e0218d7';
const EXPECTED_CURRENT_AUTHORITY_COMMIT =
  'db05b549807535840968bf28cdefac4154a6d59d';
const EXPECTED_SEC51_PREVIOUS_BASELINE =
  '0627bf78228148e3f989275810c333c16a1f3356';
const EXPECTED_SEC51_LEGACY_BASELINE =
  'd422b54393f659125912ec5c84ae7927c2533288';
const EXPECTED_SEC51_SUPERSEDED_BASELINES = Object.freeze([
  EXPECTED_SEC51_PREVIOUS_BASELINE,
  EXPECTED_SEC51_LEGACY_BASELINE,
]);

/* ---- claim-scoped SEC-51 analysis ------------------------------------------
   A row-wide or paragraph-wide "historical/superseded" test is FAIL-OPEN: one
   marker anywhere licenses every other statement in the same scope. That let a
   semantic swap through — the OLD SHA presented as the current deployed
   baseline while the NEW SHA carried the historical label, with both SHAs and
   the host present so every substring check was satisfied.

   Everything below therefore reasons over INDEPENDENT CLAIMS. A marker only
   ever applies to the claim it actually sits in. Pure, deterministic, and
   database/network free. */

/**
 * PURE: split text into independent EVIDENCE SCOPES. A markdown table row is one
 * scope; a prose paragraph is one scope. Topic detection (SEC-51 / SEC-52 /
 * pilot-surface) applies to the whole scope, so a following claim cannot escape
 * merely by not repeating the topic — but topic context never crosses into
 * another row or paragraph.
 * @returns {string[]}
 */
/* Blockquote markers are markdown syntax, not content. The handoff documents
   wrap their status block in `> `, and leaving those markers in place split a
   perfectly bound "deployed baseline <SHA>" phrase across a stray `>`. */
function stripQuoteMarker(line) {
  return String(line == null ? '' : line).replace(/^\s*(?:>\s?)+/, '');
}

function splitEvidenceScopes(text) {
  if (typeof text !== 'string' || text === '') return [];
  const scopes = [];
  let buf = [];
  const flush = () => {
    const s = buf.join('\n').trim();
    if (s !== '') scopes.push(s);
    buf = [];
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = stripQuoteMarker(raw);
    const t = line.trim();
    if (t.startsWith('|')) { flush(); scopes.push(t); continue; } // one row = one scope
    if (t === '') { flush(); continue; }                          // paragraph boundary
    buf.push(line);
  }
  flush();
  return scopes;
}

/**
 * PURE: does this claim bind `expectedSha` to the deployed production baseline?
 * Co-occurrence is deliberately NOT enough — a deployment phrase naming some
 * other SHA plus an unrelated mention of the expected SHA must fail, which is
 * exactly the comparison attack this closes.
 * @returns {boolean}
 */
function claimBindsShaToDeployedBaseline(claim, expectedSha) {
  if (typeof claim !== 'string' || claim === '') return false;
  if (typeof expectedSha !== 'string' || !/^[0-9a-f]{40}$/i.test(expectedSha)) return false;
  if (CLAIM_HISTORY_RE.test(claim)) return false;
  // Exactly one full SHA: a claim juggling two SHAs can never be the current
  // binding claim, however it is phrased.
  const shas = claim.match(/\b[0-9a-f]{40}\b/gi) || [];
  if (shas.length !== 1) return false;
  if (shas[0].toLowerCase() !== expectedSha.toLowerCase()) return false;
  // Grammatical attachment to the deployed production baseline.
  const S = '[`\'"(\\s]*' + expectedSha;
  const patterns = [
    new RegExp('(?:deployed|current(?:ly)?[- ]deployed|production(?:\\s+runtime)?|deployed\\s+runtime)\\s+(?:technical\\s+production\\s+)?baseline(?:\\s+(?:is|was|of))?\\s*:?' + S, 'i'),
    new RegExp('production(?:\\s+at\\s+[`\'"(]*\\S{1,180}[`\'")]*?)?\\s+(?:(?:currently|now)\\s+)?serves' + S, 'i'),
    new RegExp('deployed\\s+(?:on|at)' + S, 'i'),
    new RegExp(expectedSha + '[`\'")\\s]*(?:is|as)\\s+the\\s+(?:current(?:ly)?\\s+)?(?:technical\\s+)?(?:deployed|production)(?:\\s+runtime)?\\s+baseline', 'i'),
  ];
  return patterns.some((re) => re.test(claim));
}

/**
 * PURE: audit EVERY deployment-bearing claim in ONE scope for a contradictory
 * deployed SHA. Requiring merely that *some* claim binds the expected SHA is
 * fail-open: a neighbouring sentence, semicolon clause, or table cell could
 * still say production serves a different SHA, and the scope was accepted. One
 * valid claim must never neutralize a contradictory one beside it.
 *
 * A historical deployed-SHA claim is exempt only when that SAME claim carries
 * history framing, is explicitly past-bounded, and uses no present-tense
 * deployment semantics.
 * @returns {string[]} problems (empty = compliant)
 */
function conflictingDeployedShaProblems(scopeText) {
  if (typeof scopeText !== 'string' || scopeText === '') return [];
  const problems = [];
  for (const c of splitEvidenceClaims(scopeText)) {
    const shas = c.match(/\b[0-9a-f]{40}\b/gi) || [];
    if (shas.length === 0) continue;

    // A claim-scoped disclaimer for the independently pinned preceding
    // evidence commit is not a competing production-baseline assertion.
    if (shas.length === 1 &&
        shas[0].toLowerCase() === EXPECTED_SEC51_DOC_COMMIT.toLowerCase() &&
        CLAIM_NON_RUNTIME_RE.test(c)) {
      continue;
    }

    const historical = CLAIM_HISTORY_RE.test(c);
    const pastBound = CLAIM_PAST_BOUND_RE.test(c);
    const presentDeployed = CLAIM_PRESENT_DEPLOYED_RE.test(c);

    // Properly framed history is exempt.
    if (historical && pastBound && !presentDeployed) continue;

    // Only claims that actually assert current/deployed production state are
    // in scope; a bare mention of a SHA is not a deployment claim.
    if (!presentDeployed && !CLAIM_DEPLOYED_BINDING_RE.test(c)) continue;

    /* The former secondary exemption (`historical && !presentDeployed`) is
       DELIBERATELY GONE. It let any claim that merely LOOKED historical bind a
       wrong SHA to the deployed baseline without ever stating when that was
       true — e.g. "the historical deployed baseline <other SHA> is recorded
       here" passed while asserting a false deployment fact. History is exempt
       only through the single test above, which requires history framing AND an
       explicit past boundary AND no present-tense deployment semantics in the
       SAME claim. */

    if (shas.length > 1) {
      problems.push('a current deployment claim names multiple full SHAs');
      continue;
    }
    if (shas[0].toLowerCase() !== EXPECTED_SEC51_DEPLOYED_BASELINE.toLowerCase()) {
      problems.push('a current deployment claim names a SHA other than the expected deployed baseline');
      continue;
    }
    if (!claimBindsShaToDeployedBaseline(c, EXPECTED_SEC51_DEPLOYED_BASELINE)) {
      problems.push('the expected SHA appears in a deployment claim without being grammatically bound to the deployed production baseline');
    }
  }
  return problems;
}

/**
 * PURE: run the scope-level conflict audit across EVERY scope of a document.
 *
 * The former SEC-51/SEC-52/pilot-surface topic filter was fail-open: a false
 * deployment claim only had to omit those words — for example by sitting in its
 * own blank-line-separated paragraph — and the whole scope was skipped without
 * ever being audited. A claim asserting what production currently serves is
 * wrong wherever it appears, so topic is no longer a precondition here.
 *
 * Selectivity is preserved at the CLAIM level instead: bare SHAs, integrity
 * digests, repository HEAD references, and any other SHA mention that does not
 * assert deployed/current production state are still ignored by
 * conflictingDeployedShaProblems().
 * @returns {string[]} problems (empty = compliant)
 */
function documentConflictingDeployedShaProblems(text) {
  if (typeof text !== 'string' || text === '') return [];
  const problems = [];
  for (const scope of splitEvidenceScopes(text)) {
    for (const p of conflictingDeployedShaProblems(scope)) problems.push(p);
  }
  return problems;
}

/** PURE: split text into independent claims at cell, line, sentence, and
 *  semicolon boundaries, with whitespace normalized.
 *  @returns {string[]} */
function splitEvidenceClaims(text) {
  if (typeof text !== 'string' || text === '') return [];
  return text
    /* Blank lines end a paragraph. A SOFT WRAP does not end a claim — markdown
       prose wraps mid-sentence, so treating every newline as a boundary would
       strand a history marker on the line above its SHA and reject truthful
       text. Table rows still separate correctly because every cell boundary is
       a pipe, which is split below. */
    .split(/\n\s*\n/)
    .flatMap((para) => para
      .split(/\r?\n/).map(stripQuoteMarker).join('\n')
      .replace(/\s*\r?\n\s*/g, ' ')
      .split(/\||(?<=[.!?])\s+|;/))
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s !== '');
}

/** History framing, evaluated per claim. */
const CLAIM_HISTORY_RE =
  /\bhistorical\b|\bsuperseded\b|\bearlier\b|\bprevious(?:ly)?\b|\boriginally\b|\bfirst[- ]accepted\b|\bformer(?:ly)?\b|\bprior\b/i;
/** Explicit past-bounding, required before a stale claim counts as history. */
const CLAIM_PAST_BOUND_RE =
  /\bat that time\b|\bat the time\b|\bpreviously\b|\boriginally\b|\bthen\b|\bbefore\b|\bprior(?: to)?\b|\bformerly\b|\bused to\b|\bfirst[- ]accepted\b|\bearlier(?: accepted)?\b/i;
/** Present-tense deployment semantics: what the OLD SHA must never carry. */
const CLAIM_PRESENT_DEPLOYED_RE =
  /\bcurrent(?:ly)?[- ]deployed\b|\bcurrent deployed baseline\b|\bproduction (?:currently )?serves\b|\bnow serves\b|\bright now\b|\bis live\b|\b(?:is|are|remains?)\b[^]{0,40}\b(?:deployed|currently served|live)\b/i;
/** A claim that actually binds a SHA to the deployed production baseline. */
const CLAIM_DEPLOYED_BINDING_RE =
  /\bdeployed baseline\b|\bcurrent(?:ly)?[- ]deployed\b|\bdeployed\b[^]{0,40}\bbaseline\b|\bbaseline\b[^]{0,40}\bdeployed\b|\bproduction (?:currently )?serves\b|\bdeployed (?:on|at)\b/i;

/**
 * PURE: claims that bind the CURRENT deployed SHA to the production baseline
 * without being framed as history. The SHA merely appearing somewhere in the
 * text is deliberately insufficient.
 * @returns {string[]} the qualifying claims
 */
function claimsBindingCurrentDeployedBaseline(text) {
  return splitEvidenceClaims(text).filter((c) =>
    claimBindsShaToDeployedBaseline(c, EXPECTED_SEC51_DEPLOYED_BASELINE));
}

/**
 * PURE: audit every claim that cites the superseded baseline. Each such claim
 * must carry history framing IN THAT SAME CLAIM and must not attach present
 * deployment semantics to the old SHA.
 * @returns {string[]} problems (empty = compliant)
 */
function supersededBaselineClaimProblems(text) {
  if (typeof text !== 'string') return ['superseded-baseline input is not text'];
  const problems = [];
  for (const c of splitEvidenceClaims(text)) {
    const citesSuperseded = EXPECTED_SEC51_SUPERSEDED_BASELINES.some((sha) =>
      c.includes(sha)) || /\b(?:0627bf7|d422b54)\b/i.test(c);
    if (!citesSuperseded) continue;
    if (!CLAIM_HISTORY_RE.test(c)) {
      problems.push('a claim cites the superseded baseline without history framing in that same claim');
    }
    if (!CLAIM_PAST_BOUND_RE.test(c)) {
      problems.push('a claim cites the superseded baseline without an explicit past boundary in that same claim');
    }
    if (CLAIM_PRESENT_DEPLOYED_RE.test(c)) {
      problems.push('a claim presents the superseded baseline as current/deployed');
    }
  }
  return problems;
}

function analyzeDeploymentSmokeRow(md) {
  const section = markdownSection(md, /^##\s+Manual Black-Box Checklist\s*$/);
  const rows = markdownTableRows(section).filter((r) => /deployment smoke/i.test(r.cells[0] || ''));
  if (rows.length === 0) return ['no deployment smoke row'];
  if (rows.length > 1) return ['duplicate deployment smoke rows'];
  const status = evidenceStatusCell(rows[0].cells);
  const raw = rows[0].raw;
  const problems = [];
  if (!/\bPASS\b/i.test(status)) problems.push('deployment smoke row does not record the accepted PASS');
  if (/\bDEFERRED\b/i.test(status)) problems.push('deployment smoke row is still marked DEFERRED');
  if (/\bpending\b/i.test(status)) problems.push('deployment smoke row is Pending');
  if (!/\bSEC-51\b/.test(raw)) problems.push('deployment smoke row does not reference SEC-51');
  if (!raw.includes(EXPECTED_SEC51_PRODUCTION_HOST)) {
    problems.push('deployment smoke row does not name the production host');
  }
  if (!raw.includes(EXPECTED_SEC51_DEPLOYED_BASELINE)) {
    problems.push('deployment smoke row does not name the exact deployed baseline');
  }
  /* Claim-scoped: the current SHA must be BOUND to the deployed baseline by a
     non-historical claim that also names the host. A swap that labels the
     current SHA historical and the old SHA current fails here. */
  const bound = claimsBindingCurrentDeployedBaseline(raw);
  if (bound.length === 0) {
    problems.push('no non-historical claim binds the current SHA to the deployed production baseline');
  } else if (!bound.some((c) => c.includes(EXPECTED_SEC51_PRODUCTION_HOST))) {
    problems.push('no claim binds the production host to the current deployed baseline');
  }
  for (const p of supersededBaselineClaimProblems(raw)) problems.push('deployment smoke row: ' + p);
  /* The row is one scope: EVERY deployment claim in it must agree. */
  for (const p of conflictingDeployedShaProblems(raw)) problems.push('deployment smoke row: ' + p);
  return problems;
}

/**
 * PURE: the CURRENT `SEC-51` checklist row must record the accepted production
 * result, name the host and the exact deployed baseline, and never present the
 * superseded baseline as current. Fails closed on a missing/duplicate row.
 * @returns {string[]} problems (empty = compliant)
 */
function analyzeSec51ChecklistRow(md) {
  const rows = markdownTableRows(md).filter((r) => /^SEC-51$/i.test(String(r.cells[0] || '').trim()));
  if (rows.length === 0) return ['no SEC-51 row'];
  if (rows.length > 1) return ['duplicate SEC-51 rows'];
  const raw = rows[0].raw;
  const status = evidenceStatusCell(rows[0].cells);
  const problems = [];
  if (!/\bPASS\b/i.test(status)) problems.push('SEC-51 row does not record the accepted PASS');
  if (/\bDEFERRED\b/i.test(status)) problems.push('SEC-51 status cell is still DEFERRED');
  if (!raw.includes(EXPECTED_SEC51_PRODUCTION_HOST)) problems.push('SEC-51 row omits the production host');
  if (!raw.includes(EXPECTED_SEC51_DEPLOYED_BASELINE)) {
    problems.push('SEC-51 row omits the exact deployed baseline');
  }
  const bound = claimsBindingCurrentDeployedBaseline(raw);
  if (bound.length === 0) {
    problems.push('no non-historical claim binds the current SHA to the deployed production baseline');
  } else if (!bound.some((c) => c.includes(EXPECTED_SEC51_PRODUCTION_HOST))) {
    problems.push('no claim binds the production host to the current deployed baseline');
  }
  for (const p of supersededBaselineClaimProblems(raw)) problems.push('SEC-51 row: ' + p);
  for (const p of conflictingDeployedShaProblems(raw)) problems.push('SEC-51 row: ' + p);
  return problems;
}

/**
 * PURE: does the text make a STALE claim about the pilot-surface correction —
 * that it is undeployed, still an unreviewed candidate, or absent from
 * production? Scoped two ways so it cannot over-fire: a paragraph is considered
 * only when it actually mentions the correction (so unrelated archived R5/R6/R7
 * "awaiting independent Codex review" prose is never flagged), and any paragraph
 * explicitly marked historical/superseded is exempt.
 * @returns {boolean} true when a stale claim is present
 */
function declaresStalePilotSurfaceDeploymentClaim(text) {
  if (typeof text !== 'string' || text === '') return false;
  /* Topic is detected on the containing SCOPE (one table row, or one prose
     paragraph), so a stale claim cannot escape by sitting after a semicolon or
     in the next sentence without repeating the topic. Scope boundaries stop the
     context spreading into unrelated rows/paragraphs, which is what keeps
     archived R5/R6/R7 "awaiting independent Codex review" prose out of range. */
  for (const scope of splitEvidenceScopes(text)) {
    if (!/pilot[- ]surface|SEC-5[12]/i.test(scope)) continue;
    if (scopeDeclaresStaleClaim(scope)) return true;
    /* A contradictory deployed SHA inside the scope is itself a false current
       deployment claim, so it fails the same check across every audited
       document. */
    if (conflictingDeployedShaProblems(scope).length > 0) return true;
  }
  return false;
}

/**
 * PURE: one live authority/deployment document is acceptable only when it has
 * neither a stale pilot-surface claim nor a conflicting current/deployed SHA in
 * ANY evidence scope. Keeping this composition in one predicate prevents a
 * live-document caller from accidentally retaining the old topic-filtered gap.
 * @returns {boolean}
 */
function deploymentDocumentClaimsAreCurrent(text) {
  return typeof text === 'string' && text !== '' &&
    !declaresStalePilotSurfaceDeploymentClaim(text) &&
    documentConflictingDeployedShaProblems(text).length === 0;
}

/** PURE: per-claim staleness inside one already-topic-matched scope. */
function scopeDeclaresStaleClaim(scope) {
  for (const c of splitEvidenceClaims(scope)) {
    const stale =
      /\b(?:is|are|were|was)\s+not\s+deployed\b/i.test(c) ||
      /\bNOT\s+deployed\b/.test(c) ||
      /production\s+(?:still\s+)?(?:continues?\s+to\s+)?serves?\s+the\s+(?:accepted|older|old|previous)\s+baseline/i.test(c) ||
      /correction candidate[^]{0,160}\bawait/i.test(c) ||
      /\bawait[^]{0,80}\bcorrection[- ]candidate\b/i.test(c);
    if (!stale) continue;
    /* A stale claim survives ONLY as history, and only when THIS claim is both
       marked historical and explicitly past-bounded. A marker on a neighbouring
       sentence no longer licenses it. */
    if (CLAIM_HISTORY_RE.test(c) && CLAIM_PAST_BOUND_RE.test(c)) continue;
    return true;
  }
  return false;
}

/**
 * PURE: wherever the superseded production baseline appears, it must be framed
 * as history. Paragraph-scoped so one historical mention cannot license another.
 * @returns {boolean}
 */
function supersededBaselineAlwaysMarkedHistorical(text) {
  if (typeof text !== 'string') return false;
  return supersededBaselineClaimProblems(text).length === 0;
}

/* The preceding SEC-51 evidence commit, pinned independently of every
   document. The current deployed baseline is its child, so documents must not
   mistake this evidence-only parent for the deployed runtime. */
const EXPECTED_SEC51_DOC_COMMIT = 'bbb25d0dee5917e4704da35784421c840f825afb';

/** Explicit non-runtime / non-deployed disclaimer wording, evaluated PER CLAIM. */
const CLAIM_NON_RUNTIME_RE =
  /\bnot a runtime deployment\b|\bnot the deployed runtime\b|\bis not deployed\b|\bdoes not change production\b/i;

/**
 * PURE: current evidence binds the accepted technical Production baseline to
 * the bounded post-deployment result and future manual-promotion boundary.
 * @returns {boolean}
 */
function recordsPostDeploymentAuthority(text) {
  if (typeof text !== 'string' || text === '') return false;
  /* Claim-scoped: the current SHA must be BOUND to the deployed result by a
     non-historical claim. Naming it only inside a historical label — while the
     old SHA is presented as current — no longer satisfies this. */
  const bindsCurrent = claimsBindingCurrentDeployedBaseline(text).length > 0;
  const oldStaysHistorical = supersededBaselineClaimProblems(text).length === 0;
  /* A valid binding elsewhere must not excuse a contradictory deployment claim
     in the same scope. */
  const noConflict = documentConflictingDeployedShaProblems(text).length === 0;
  return bindsCurrent && oldStaysHistorical && noConflict &&
    currentGitLifecycleProblems(text).length === 0;
}

/**
 * PURE: a superseded R8 candidate figure (the 3659/3659 suite total or the
 * 6,192,992-byte inventory) must never occupy a CURRENT row's STATUS cell.
 * Quoting either in an evidence cell as historical context stays legitimate.
 * @returns {string[]} problems (empty = compliant)
 */
function analyzeSupersededCandidateRows(md) {
  const problems = [];
  for (const r of markdownTableRows(md)) {
    const status = evidenceStatusCell(r.cells);
    if (!/\b3659\/3659\b/.test(status) && !/6,192,992/.test(status)) continue;
    if (!evidenceRowSelfMarkedHistorical(r.cells)) {
      problems.push('a superseded R8 candidate figure is presented as current: ' + String(r.cells[0] || ''));
    }
  }
  return problems;
}

/**
 * PURE: exactly ONE current package inventory row, stating the independently
 * pinned file count, byte count, and aggregate SHA-256 in its STATUS cell.
 * @returns {string[]} problems (empty = compliant)
 */
function analyzeCurrentPackageInventoryRow(md, expected) {
  const rows = markdownTableRows(md).filter((r) => /package inventory/i.test(r.cells[0] || ''));
  const current = rows.filter((r) => !evidenceRowSelfMarkedHistorical(r.cells));
  const problems = [];
  if (current.length === 0) problems.push('no current package inventory row');
  if (current.length > 1) problems.push('duplicate current package inventory rows');
  for (const r of current) {
    const status = evidenceStatusCell(r.cells);
    if (!new RegExp('\\b' + String(expected.files) + '\\b').test(status)) {
      problems.push('current inventory row does not state the pinned file count');
    }
    if (!status.includes(expected.bytes)) problems.push('current inventory row does not state the pinned byte count');
    if (!status.includes(expected.sha256)) problems.push('current inventory row does not state the pinned aggregate SHA-256');
  }
  return problems;
}

/**
 * PURE: SEC-37 must carry exactly one explicitly CURRENT package claim and it
 * must equal the independent package pin. Historical figures may remain in the
 * same evidence cell only when they are not labelled current.
 * @returns {string[]} problems (empty = compliant)
 */
function analyzeSecurityChecklistPackageBoundaryRow(md, expected) {
  const rows = markdownTableRows(md).filter((r) => /^SEC-37$/i.test(String(r.cells[0] || '').trim()));
  const problems = [];
  if (rows.length === 0) return ['SEC-37 package-boundary row is missing'];
  if (rows.length > 1) return ['SEC-37 package-boundary row is duplicated'];
  const evidence = evidenceReferenceCell(rows[0].cells);
  const currentClaims = [...evidence.matchAll(
    /\*\*Current\b[^:\n|]{0,120}:\*\*\s*(\d+)\s+files,\s*([\d,]+)\s+bytes,\s*aggregate SHA-256\s+`([a-f0-9]{64})`/gi
  )];
  if (currentClaims.length === 0) return ['SEC-37 has no explicit current package claim'];
  if (currentClaims.length > 1) return ['SEC-37 has duplicate current package claims'];
  const [, files, bytes, sha256] = currentClaims[0];
  if (Number(files) !== expected.files) problems.push('SEC-37 current file count differs from the package pin');
  if (bytes !== expected.bytes) problems.push('SEC-37 current byte count differs from the package pin');
  if (sha256.toLowerCase() !== expected.sha256) problems.push('SEC-37 current SHA-256 differs from the package pin');
  return problems;
}

/**
 * PURE: exactly ONE current full-suite evidence-snapshot row once the final
 * totals are recorded. The status must explicitly identify a candidate or
 * evidence snapshot and carry a four-digit suite total.
 * @returns {string[]} problems (empty = compliant)
 */
function analyzeCurrentCandidateSuiteRow(md) {
  const rows = markdownTableRows(md).filter((r) => {
    const label = String(r.cells[0] || '').trim();
    const status = evidenceStatusCell(r.cells);
    return /^Full contract suite\b/i.test(label) &&
      /\b(?:candidate|evidence snapshot|accepted local evidence)\b/i.test(status) &&
      /\b\d{4}\/\d{4}\b/.test(status);
  });
  const current = rows.filter((r) => !evidenceRowSelfMarkedHistorical(r.cells));
  const problems = [];
  if (current.length === 0) problems.push('no current full-suite evidence-snapshot row');
  if (current.length > 1) problems.push('duplicate current full-suite evidence-snapshot rows');
  for (const r of current) {
    if (/\bpending\b/i.test(evidenceStatusCell(r.cells))) problems.push('current full-suite evidence-snapshot row is Pending');
  }
  return problems;
}

/** PURE: remove markdown code ticks from one command-label cell. */
function normalizedEvidenceCommand(value) {
  return String(value == null ? '' : value).replace(/`/g, '').trim().toLowerCase();
}

/** PURE: return the one exact N/N total carried by a STATUS cell. */
function exactStatusTotal(status) {
  const matches = String(status == null ? '' : status).match(/\b(\d{4})\/(\d{4})\b/g) || [];
  if (matches.length !== 1) return null;
  const parts = matches[0].split('/').map(Number);
  if (parts.length !== 2 || parts[0] !== parts[1]) return null;
  return parts[0];
}

/**
 * PURE: the current suite and full-QA rows in BOTH evidence documents must put
 * one identical exact total in their own STATUS cells. A number in a nearby
 * row, evidence paragraph, or historical citation cannot satisfy this rule.
 * @returns {string[]} problems (empty = compliant)
 */
function analyzeExactCurrentQualityTotals(testEvidenceMd, securityChecklistMd, expectedTotal) {
  const specs = [
    {
      label: 'test-evidence current full contract suite',
      md: testEvidenceMd,
      match: (r) => /^full contract suite \(M12\.P1-D6\/OFF\.6 accepted local candidate\)$/i
        .test(String(r.cells[0] || '').trim()),
    },
    {
      label: 'test-evidence current Full QA aggregate',
      md: testEvidenceMd,
      match: (r) => /^full QA aggregate \(M12\.P1-D6 accepted local candidate\)$/i
        .test(String(r.cells[0] || '').trim()),
    },
    {
      label: 'security-checklist current npm test',
      md: securityChecklistMd,
      match: (r) => normalizedEvidenceCommand(r.cells[0]) === 'npm test',
    },
    {
      label: 'security-checklist current npm run qa',
      md: securityChecklistMd,
      match: (r) => normalizedEvidenceCommand(r.cells[0]) === 'npm run qa',
    },
  ];
  const problems = [];
  if (!Number.isInteger(expectedTotal) || expectedTotal < 1000 || expectedTotal > 9999) {
    return ['expected current quality total is not one four-digit integer'];
  }
  for (const spec of specs) {
    const rows = markdownTableRows(spec.md).filter(spec.match);
    const current = rows.filter((r) => !evidenceRowSelfMarkedHistorical(r.cells));
    if (current.length === 0) {
      problems.push(spec.label + ': no current row');
      continue;
    }
    if (current.length > 1) {
      problems.push(spec.label + ': duplicate current rows');
      continue;
    }
    const row = current[0];
    const total = exactStatusTotal(evidenceStatusCell(row.cells));
    if (total == null) problems.push(spec.label + ': status does not carry one exact equal N/N total');
    else if (total !== expectedTotal) problems.push(spec.label + ': status total does not match the pinned current total');
    if (!/QUALITY-GATES OK/.test(row.raw)) problems.push(spec.label + ': row does not bind QUALITY-GATES OK to its current disposition');
  }
  return problems;
}

/**
 * PURE: the current npm-run-qa rows in BOTH evidence documents must bind every
 * actual stage marker to the row's own evidence cell. A neighbouring row, an
 * invented normalized marker, or a generic "all green" claim cannot satisfy
 * this contract.
 * @returns {string[]} problems (empty = compliant)
 */
function analyzeCurrentQaStageMarkers(testEvidenceMd, securityChecklistMd,
  requiredMarkers = REQUIRED_CURRENT_QA_EVIDENCE_MARKERS) {
  const specs = [
    {
      label: 'test-evidence current Full QA aggregate',
      md: testEvidenceMd,
      match: (r) => /^full QA aggregate \(M12\.P1-D6 accepted local candidate\)$/i
        .test(String(r.cells[0] || '').trim()),
    },
    {
      label: 'security-checklist current npm run qa',
      md: securityChecklistMd,
      match: (r) => normalizedEvidenceCommand(r.cells[0]) === 'npm run qa',
    },
  ];
  const problems = [];
  if (!Array.isArray(requiredMarkers) || requiredMarkers.length !== 5 ||
      requiredMarkers.some((marker) => typeof marker !== 'string' || marker === '')) {
    return ['required QA-stage marker pin is malformed'];
  }
  for (const spec of specs) {
    const rows = markdownTableRows(spec.md).filter(spec.match);
    const current = rows.filter((r) => !evidenceRowSelfMarkedHistorical(r.cells));
    if (current.length !== 1) {
      problems.push(spec.label + ': expected exactly one current row');
      continue;
    }
    const evidence = evidenceReferenceCell(current[0].cells);
    for (const marker of requiredMarkers) {
      if (!evidence.includes(marker)) {
        problems.push(spec.label + ': missing exact stage marker ' + marker);
      }
    }
  }
  return problems;
}

const REQUIRED_SCHEDULE_AUDIT_ACTIONS = Object.freeze([
  'admin.schedule.create',
  'admin.schedule.update',
  'admin.schedule.delete',
]);

/* Handler -> (audit action, repository mutation) mapping, pinned HERE in the
   gate rather than derived from the controller it audits. */
const SCHEDULE_AUDIT_HANDLERS = Object.freeze([
  Object.freeze({
    handler: 'createSchedule', action: 'admin.schedule.create', repoMethod: 'createSchedule',
    mutationPrefix: 'const schedule = await scheduleRepository.createSchedule(',
    successPrefix: 'return res.status(201).json(',
  }),
  Object.freeze({
    handler: 'updateSchedule', action: 'admin.schedule.update', repoMethod: 'updateSchedule',
    mutationPrefix: 'const schedule = await scheduleRepository.updateSchedule(',
    successPrefix: 'return res.json(',
  }),
  Object.freeze({
    handler: 'deleteSchedule', action: 'admin.schedule.delete', repoMethod: 'deleteScheduleById',
    mutationPrefix: 'const removed = await scheduleRepository.deleteScheduleById(',
    successPrefix: 'return res.json(',
  }),
]);
const SCHEDULE_AUDIT_STATEMENT_PREFIX = 'auditAdminMutation(';
const SCHEDULE_AUDIT_TARGET_TYPE = 'room_schedule';

/**
 * PURE lexical pass. Returns a SAME-LENGTH copy of `src` in which every line
 * comment, block comment, and string/template literal (delimiters included) is
 * blanked to spaces, plus the offsets and decoded values of the single- and
 * double-quoted string literals.
 *
 * Blanking preserves offsets and newlines, so any match against `.code` points
 * at REAL executable source. This is what stops a comment, a documentation
 * sentence, or a string payload from satisfying a structural contract — the
 * exact fail-open class this replaces.
 *
 * Regex literals are deliberately NOT modelled: the two audited files contain a
 * single quote-free regex. A future quote-bearing regex would desync the scan,
 * which surfaces as `ok:false` and FAILS THE GATE CLOSED rather than silently
 * passing.
 * @returns {{code: string, strings: Array<{start:number,end:number,value:string}>, ok: boolean}}
 */
function lexJsSource(src) {
  const s = typeof src === 'string' ? src : '';
  const out = s.split('');
  const strings = [];
  const templates = [];
  const blank = (a, b) => {
    for (let k = a; k < b && k < out.length; k++) {
      if (out[k] !== '\n' && out[k] !== '\r') out[k] = ' ';
    }
  };
  let i = 0;
  let ok = true;
  while (i < s.length) {
    const c = s[i];
    const d = s[i + 1];
    if (c === '/' && d === '/') {
      let j = i;
      while (j < s.length && s[j] !== '\n') j++;
      blank(i, j);
      i = j;
      continue;
    }
    if (c === '/' && d === '*') {
      const j = s.indexOf('*/', i + 2);
      if (j < 0) { ok = false; blank(i, s.length); break; }
      blank(i, j + 2);
      i = j + 2;
      continue;
    }
    if (c === '\'' || c === '"') {
      let j = i + 1;
      let value = '';
      let closed = false;
      while (j < s.length) {
        if (s[j] === '\\') { value += s[j + 1] === undefined ? '' : s[j + 1]; j += 2; continue; }
        if (s[j] === c) { closed = true; break; }
        if (s[j] === '\n') break; // unterminated literal
        value += s[j];
        j++;
      }
      if (!closed) { ok = false; blank(i, s.length); break; }
      strings.push({ start: i, end: j + 1, value });
      blank(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === '`') {
      let j = i + 1;
      let closed = false;
      while (j < s.length) {
        if (s[j] === '\\') { j += 2; continue; }
        if (s[j] === '`') { closed = true; break; }
        j++;
      }
      if (!closed) { ok = false; blank(i, s.length); break; }
      /* A template literal can never be an accepted action/target literal, but
         its span is recorded so an element or argument made of one is REJECTED
         rather than mistaken for blank filler. */
      templates.push({ start: i, end: j + 1 });
      blank(i, j + 1);
      i = j + 1;
      continue;
    }
    i++;
  }
  return { code: out.join(''), strings, templates, ok };
}

/** PURE: net depth of one bracket pair across `code[from..to)`. */
function netBracketDepth(code, from, to, openCh, closeCh) {
  let d = 0;
  for (let k = from; k < to && k < code.length; k++) {
    if (code[k] === openCh) d++;
    else if (code[k] === closeCh) d--;
  }
  return d;
}

/** PURE: index of the bracket closing the one at `open`, or -1 when unbalanced. */
function matchBracketIndex(code, open, openCh, closeCh) {
  let d = 0;
  for (let k = open; k < code.length; k++) {
    if (code[k] === openCh) d++;
    else if (code[k] === closeCh) { d--; if (d === 0) return k; }
  }
  return -1;
}

/**
 * PURE: split the interior of an array/argument list into TOP-LEVEL
 * comma-delimited spans, tracking `()`, `[]`, and `{}` relative depth.
 * Returns null on a negative, mismatched, or unbalanced delimiter.
 * @returns {Array<{start:number,end:number}>|null}
 */
function topLevelCommaSpans(code, interiorStart, interiorEnd) {
  const spans = [];
  let paren = 0;
  let square = 0;
  let curly = 0;
  let start = interiorStart;
  for (let k = interiorStart; k < interiorEnd; k++) {
    const ch = code[k];
    if (ch === '(') paren++;
    else if (ch === ')') paren--;
    else if (ch === '[') square++;
    else if (ch === ']') square--;
    else if (ch === '{') curly++;
    else if (ch === '}') curly--;
    else if (ch === ',' && paren === 0 && square === 0 && curly === 0) {
      spans.push({ start, end: k });
      start = k + 1;
      continue;
    }
    if (paren < 0 || square < 0 || curly < 0) return null;
  }
  if (paren !== 0 || square !== 0 || curly !== 0) return null;
  spans.push({ start, end: interiorEnd });
  return spans;
}

/**
 * PURE: does `span` consist of EXACTLY ONE direct single- or double-quoted
 * string literal and nothing else executable?
 *
 * Returns { kind: 'literal', value } for a direct literal, { kind: 'empty' }
 * for a span that is only whitespace and comments (a legal trailing comma or
 * blank filler), or { kind: 'invalid' } for anything else — concatenation, a
 * call wrapper, a ternary, an object/array wrapper, a template literal, or
 * multiple literals.
 * @returns {{kind: string, value?: string}}
 */
function directStringSpan(code, lex, span) {
  const masked = code.slice(span.start, span.end);
  const inside = lex.strings.filter((st) => st.start >= span.start && st.end <= span.end);
  const tpl = (lex.templates || []).filter((t) => t.start >= span.start && t.end <= span.end);
  const maskedClean = !/\S/.test(masked);
  if (inside.length === 0) {
    // A template literal is NOT blank filler: it must fail, not be skipped.
    if (tpl.length > 0 || !maskedClean) return { kind: 'invalid' };
    return { kind: 'empty' };
  }
  if (inside.length !== 1 || tpl.length > 0 || !maskedClean) return { kind: 'invalid' };
  return { kind: 'literal', value: inside[0].value };
}

/**
 * PURE: the DIRECT string elements of the ONE executable
 * `const ACTIONS = Object.freeze([ ... ]);` declaration.
 *
 * Every nonempty top-level element span must be EXACTLY ONE literal. A string
 * that merely appears inside an element expression is not that element's
 * runtime value, so `prefix + 'x'`, `'x' + suffix`, `choose('x')`,
 * `cond ? 'x' : other`, `{ action: 'x' }`, and `['x']` all fail closed.
 * Comments around a direct literal stay legal because comments are masked.
 * @returns {string[]|null}
 */
function frozenActionsArrayElements(serviceSrc) {
  const lex = lexJsSource(serviceSrc);
  if (!lex.ok) return null;
  const re = /\bconst\s+ACTIONS\s*=\s*Object\s*\.\s*freeze\s*\(\s*\[/g;
  const declarations = [];
  let m;
  while ((m = re.exec(lex.code)) !== null) {
    declarations.push({ start: m.index, open: m.index + m[0].length - 1 });
  }
  if (declarations.length !== 1) return null;
  const declaration = declarations[0];
  // The real audit taxonomy is a module-level constant. A declaration that
  // exists only in a dead/nested block is not the runtime allowlist.
  if (netBracketDepth(lex.code, 0, declaration.start, '{', '}') !== 0) return null;
  const open = declaration.open;
  const close = matchBracketIndex(lex.code, open, '[', ']');
  if (close < 0) return null;
  // The frozen array must actually terminate the declaration.
  if (!/^\s*\)\s*;/.test(lex.code.slice(close + 1))) return null;
  const spans = topLevelCommaSpans(lex.code, open + 1, close);
  if (spans === null) return null;
  const elements = [];
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    const verdict = directStringSpan(lex.code, lex, span);
    if (verdict.kind === 'empty') {
      // Only the final empty span created by a legal trailing comma is filler.
      // An interior empty span is an array hole and fails the taxonomy closed.
      if (i !== spans.length - 1 || spans.length === 1) return null;
      continue;
    }
    if (verdict.kind !== 'literal') return null;
    elements.push(verdict.value);
  }
  return elements;
}

/**
 * PURE: the sole `exports.<name> = async (req, res) => { ... }` body, which
 * must be the ONE executable declaration for that handler AND be its own
 * module-level assignment statement. Merely sitting at curly-brace depth zero
 * is insufficient: brace-less `if`, short-circuit, ternary, parenthesized,
 * labelled, or assignment-wrapped exports must fail closed too.
 * @returns {{lex: object, open: number, close: number}|null}
 */
function soleExportedHandler(controllerSrc, name) {
  const lex = lexJsSource(controllerSrc);
  if (!lex.ok) return null;
  const re = new RegExp('\\bexports\\s*\\.\\s*' + name +
    '\\s*=\\s*async\\s*\\(\\s*req\\s*,\\s*res\\s*\\)\\s*=>\\s*\\{', 'g');
  const decls = [];
  let m;
  while ((m = re.exec(lex.code)) !== null) {
    decls.push({ declStart: m.index, brace: m.index + m[0].length - 1 });
  }
  if (decls.length !== 1) return null;
  const decl = decls[0];
  const close = matchBracketIndex(lex.code, decl.brace, '{', '}');
  if (close < 0) return null;

  /* Prove the assignment starts a standalone module statement. The lexer has
     already blanked comments and strings while preserving offsets, so only
     executable tokens remain visible here. Track all delimiter families: a
     short-circuit `(exports.x = async ...)` is at curly depth zero but paren
     depth one and must not count. */
  let paren = 0;
  let square = 0;
  let curly = 0;
  let boundary = 0;
  for (let k = 0; k < decl.declStart; k++) {
    const ch = lex.code[k];
    if (ch === '(') paren++;
    else if (ch === ')') paren--;
    else if (ch === '[') square++;
    else if (ch === ']') square--;
    else if (ch === '{') curly++;
    else if (ch === '}') curly--;
    if (paren < 0 || square < 0 || curly < 0) return null;
    if (paren === 0 && square === 0 && curly === 0 && (ch === ';' || ch === '}')) {
      boundary = k + 1;
    }
  }
  if (paren !== 0 || square !== 0 || curly !== 0) return null;
  if (/\S/.test(lex.code.slice(boundary, decl.declStart))) return null;

  // The completed async-function assignment must end directly in its own `;`.
  let statementEnd = close + 1;
  while (statementEnd < lex.code.length && /\s/.test(lex.code[statementEnd])) statementEnd++;
  if (lex.code[statementEnd] !== ';') return null;
  return { lex, open: decl.brace, close };
}

/** PURE: top-level argument spans of the call whose '(' sits at `openParen`. */
function callArgumentSpans(code, openParen) {
  const close = matchBracketIndex(code, openParen, '(', ')');
  if (close < 0) return null;
  return topLevelCommaSpans(code, openParen + 1, close);
}

/**
 * PURE: the value of the argument that IS exactly one direct single- or
 * double-quoted string literal, else null.
 *
 * Containing a matching literal is not enough — the whole argument span must be
 * that literal, so `resolve('x')`, `'x' + suffix`, `cond ? 'x' : fallback`,
 * `'room_' + 'schedule'`, and a template literal all return null.
 * @returns {string|null}
 */
function soleDirectStringArgument(code, lex, span) {
  const verdict = directStringSpan(code, lex, span);
  return verdict.kind === 'literal' ? verdict.value : null;
}

/** PURE: does one argument consist only of the expected executable identifier? */
function isSoleDirectIdentifierArgument(code, lex, span, expected) {
  const strings = lex.strings.filter((st) => st.start >= span.start && st.end <= span.end);
  const templates = (lex.templates || []).filter((t) => t.start >= span.start && t.end <= span.end);
  if (strings.length > 0 || templates.length > 0) return false;
  return code.slice(span.start, span.end).trim() === expected;
}

/**
 * PURE: complete statement spans at the TOP executable level of one block.
 *
 * `end` is exclusive. `terminated` records whether the statement ended with its
 * OWN semicolon at that level; a statement closed by a brace (a nested block, a
 * control statement, or the enclosing block) is reported unterminated so a
 * brace-less decoy can never be mistaken for a standalone call statement.
 * Statements inside a nested block are deliberately NOT enumerated.
 * Returns null on unbalanced delimiters.
 * @returns {Array<{start:number,end:number,terminated:boolean}>|null}
 */
function blockStatementSpans(code, blockOpen, blockClose) {
  const spans = [];
  let paren = 0;
  let square = 0;
  let curly = 0;
  let start = -1;
  for (let k = blockOpen + 1; k < blockClose; k++) {
    const ch = code[k];
    if (ch === '(') { if (start < 0) start = k; paren++; continue; }
    if (ch === ')') { paren--; if (paren < 0) return null; continue; }
    if (ch === '[') { if (start < 0) start = k; square++; continue; }
    if (ch === ']') { square--; if (square < 0) return null; continue; }
    if (ch === '{') { if (start < 0) start = k; curly++; continue; }
    if (ch === '}') {
      curly--;
      if (curly < 0) return null;
      if (curly === 0 && paren === 0 && square === 0 && start >= 0) {
        spans.push({ start, end: k + 1, terminated: false });
        start = -1;
      }
      continue;
    }
    if (ch === ';' && paren === 0 && square === 0 && curly === 0) {
      if (start >= 0) spans.push({ start, end: k + 1, terminated: true });
      start = -1;
      continue;
    }
    if (/\S/.test(ch) && start < 0) start = k;
  }
  if (paren !== 0 || square !== 0 || curly !== 0) return null;
  if (start >= 0) spans.push({ start, end: blockClose, terminated: false });
  return spans;
}

/**
 * PURE: structural proof that ONE controller handler performs its repository
 * mutation, then EXACTLY ONE matching auditAdminMutation() call, then its
 * success response — all at the same executable depth of the handler's
 * successful try path, in that order.
 *
 * Rejects an audit call that exists only in a comment, only inside an ordinary
 * or template string, in another handler, inside a nested decoy block such as
 * `if (false) { ... }`, before the mutation, after the success return, or more
 * than once.
 * @returns {string[]} problems (empty = compliant)
 */
function scheduleHandlerAuditProblems(controllerSrc, spec) {
  const label = spec.handler;
  const h = soleExportedHandler(controllerSrc, label);
  if (h === null) {
    return [label + ': exactly one exported async (req, res) handler body must be resolvable'];
  }
  const code = h.lex.code;
  const problems = [];

  // The single `try {` directly inside the handler body.
  const tryOpens = [];
  const tryRe = /\btry\s*\{/g;
  let m;
  while ((m = tryRe.exec(code)) !== null) {
    const abs = m.index + m[0].length - 1;
    if (abs < h.open || abs > h.close) continue;
    if (netBracketDepth(code, h.open, abs, '{', '}') === 1) tryOpens.push(abs);
  }
  if (tryOpens.length !== 1) {
    return [label + ': exactly one top-level try block must be resolvable in the handler'];
  }
  const tryOpen = tryOpens[0];
  const tryClose = matchBracketIndex(code, tryOpen, '{', '}');
  if (tryClose < 0) return [label + ': the handler try block is unbalanced'];

  /* Statement-level, not merely depth-level. Each accepted step must be a
     COMPLETE standalone statement of the try path whose FIRST executable token
     is the expected prefix and which ends with its own semicolon — so a
     brace-less `if (false) x();`, a `false && x()` short circuit, a ternary, an
     assignment, a `return`-wrapped call, or a nested block can never qualify. */
  const stmts = blockStatementSpans(code, tryOpen, tryClose);
  if (stmts === null) return [label + ': the handler try-path statements are unbalanced'];
  const norm = (sp) => code.slice(sp.start, sp.end).replace(/\s+/g, ' ').trim();
  const pick = (prefix) => stmts.filter((sp) => sp.terminated === true && norm(sp).startsWith(prefix));

  // 1. the repository mutation, as its own complete try-path statement
  const mutStmts = pick(spec.mutationPrefix);
  if (mutStmts.length !== 1) {
    problems.push(label + ': exactly one standalone try-path statement beginning "' +
      spec.mutationPrefix + '" is required');
  }

  // 2. exactly one auditAdminMutation() token in the handler, and it must BE the
  //    one complete try-path audit statement.
  const auditTokens = [];
  const auditRe = /\bauditAdminMutation\s*\(/g;
  let a;
  while ((a = auditRe.exec(code)) !== null) {
    if (a.index >= h.open && a.index <= h.close) auditTokens.push(a.index);
  }
  const auditStmts = pick(SCHEDULE_AUDIT_STATEMENT_PREFIX);
  let auditIdx = -1;
  if (auditTokens.length !== 1 || auditStmts.length !== 1) {
    problems.push(label + ': exactly one standalone try-path auditAdminMutation() statement is required in the handler');
  } else {
    const sp = auditStmts[0];
    auditIdx = sp.start;
    const openParen = code.indexOf('(', sp.start);
    const closeParen = openParen < 0 ? -1 : matchBracketIndex(code, openParen, '(', ')');
    if (closeParen < 0) {
      problems.push(label + ': the auditAdminMutation() call is unbalanced');
    } else {
      // Nothing but the terminating semicolon may follow the completed call.
      if (/\S/.test(code.slice(closeParen + 1, sp.end - 1))) {
        problems.push(label + ': no executable token may follow the completed auditAdminMutation() call before its semicolon');
      }
      const spans = callArgumentSpans(code, openParen);
      if (spans === null || spans.length < 3) {
        problems.push(label + ': auditAdminMutation() must pass req, the action, and the target type');
      } else {
        if (!isSoleDirectIdentifierArgument(code, h.lex, spans[0], 'req')) {
          problems.push(label + ': auditAdminMutation() must receive req as its direct first argument');
        }
        if (soleDirectStringArgument(code, h.lex, spans[1]) !== spec.action) {
          problems.push(label + ': must audit exactly the ' + spec.action + ' action as a direct string argument');
        }
        if (soleDirectStringArgument(code, h.lex, spans[2]) !== SCHEDULE_AUDIT_TARGET_TYPE) {
          problems.push(label + ': must record target type ' + SCHEDULE_AUDIT_TARGET_TYPE + ' as a direct string argument');
        }
      }
    }
  }

  // 3. the successful response, as its own complete try-path statement
  const successStmts = pick(spec.successPrefix)
    .filter((sp) => /success\s*:\s*true/.test(code.slice(sp.start, sp.end)));
  if (successStmts.length !== 1) {
    problems.push(label + ': exactly one standalone try-path statement beginning "' +
      spec.successPrefix + '" with success: true is required');
  }

  /* A syntactically present sequence is not evidence when a direct top-level
     `return` or `throw` has already made it unreachable. Conditional guard
     blocks begin with `if` and remain valid; only unconditional terminating
     statements at the try path's executable level are rejected here. */
  if (successStmts.length === 1) {
    const successStart = successStmts[0].start;
    const prematureTerminator = stmts.some((sp) =>
      sp.terminated === true && sp.start < successStart &&
      /^(?:return|throw)\b/.test(norm(sp)));
    if (prematureTerminator) {
      problems.push(label + ': the mutation/audit/success sequence must not follow an unconditional return or throw');
    }
  }

  // 4. mutation -> audit -> success, in that order
  if (mutStmts.length === 1 && auditIdx >= 0 && successStmts.length === 1) {
    if (!(mutStmts[0].start < auditIdx && auditIdx < successStmts[0].start)) {
      problems.push(label + ': the order must be repository mutation, then the audit call, then the success response');
    }
  }
  return problems;
}

/**
 * PURE: validate the fixed schedule-audit allowlist and controller mapping by
 * STRUCTURE. Literal occurrences anywhere in the file are deliberately not
 * evidence: only direct elements of the frozen ACTIONS array and statement-level
 * calls inside the expected handler count.
 * @returns {{allowlist: string[], controller: string[]}}
 */
function analyzeScheduleAuditContract(serviceSrc, controllerSrc) {
  const problems = { allowlist: [], controller: [] };
  const elements = frozenActionsArrayElements(serviceSrc);
  if (elements === null) {
    problems.allowlist.push('exactly one balanced executable const ACTIONS = Object.freeze([...]) declaration is required');
  } else {
    for (const action of REQUIRED_SCHEDULE_AUDIT_ACTIONS) {
      const n = elements.filter((v) => v === action).length;
      if (n !== 1) {
        problems.allowlist.push(action + ' must occur exactly once as a direct string element of the audit allowlist array');
      }
    }
  }
  for (const spec of SCHEDULE_AUDIT_HANDLERS) {
    for (const p of scheduleHandlerAuditProblems(controllerSrc, spec)) problems.controller.push(p);
  }
  return problems;
}

function runDocsCurrentGate() {
  const rec = makeRecorder('docs-current');
  const { ok } = rec;
  const root = path.join(__dirname, '..');
  const readIf = (rel) => { const p = path.join(root, rel); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; };
  const docs = {
    'AGENTS.md': readIf('AGENTS.md'),
    'CLAUDE.md': readIf('CLAUDE.md'),
    'CODEX_HANDOFF.md': readIf('CODEX_HANDOFF.md'),
    'CLAUDE_HANDOFF.md': readIf('CLAUDE_HANDOFF.md'),
    'plan.md': readIf('plan.md'),
    'ROADMAP.md': readIf('ROADMAP.md'),
    'README.md': readIf('README.md'),
    '.env.example': readIf('.env.example'),
    'docs/deployment.md': readIf(path.join('docs', 'deployment.md')),
    'docs/new-session-grounding-prompts.md': readIf(path.join('docs', 'new-session-grounding-prompts.md')),
    'docs/demo-script.md': readIf(path.join('docs', 'demo-script.md')),
    'docs/test-evidence.md': readIf(path.join('docs', 'test-evidence.md')),
    'docs/security-checklist.md': readIf(path.join('docs', 'security-checklist.md')),
  };
  const agents = docs['AGENTS.md'];
  const claude = docs['CLAUDE.md'];
  const codexH = docs['CODEX_HANDOFF.md'];
  const claudeH = docs['CLAUDE_HANDOFF.md'];

  const EXPECTED_RELEASE_CONTINUITY_DATE = '2026-08-28';
  const EXPECTED_LAST_UPDATED_DATE = '2026-08-28';
  /** PURE: all current authority surfaces must carry synchronized dates. */
  function currentCandidateDateProblems(
    sourceMap,
    releaseDate = EXPECTED_RELEASE_CONTINUITY_DATE,
    lastUpdatedDate = EXPECTED_LAST_UPDATED_DATE
  ) {
    const problems = [];
    for (const name of ['AGENTS.md', 'CLAUDE.md', 'CODEX_HANDOFF.md', 'CLAUDE_HANDOFF.md', 'plan.md', 'ROADMAP.md']) {
      const value = String(sourceMap && sourceMap[name] || '');
      const pattern = new RegExp('^## Current Release Continuity \\(' + releaseDate.replace(/\./g, '\\.') + '\\)\\s*$', 'm');
      if (!pattern.test(value)) problems.push(name + ' does not carry the synchronized release-continuity date');
    }
    for (const name of ['CODEX_HANDOFF.md', 'CLAUDE_HANDOFF.md', 'docs/new-session-grounding-prompts.md']) {
      const value = String(sourceMap && sourceMap[name] || '');
      const pattern = new RegExp('^Last updated:\\s*' + lastUpdatedDate.replace(/\./g, '\\.') + '\\s*\\(Asia/Manila\\)\\s*$', 'm');
      if (!pattern.test(value)) problems.push(name + ' does not carry the synchronized Last updated date');
    }
    const headings = {
      'docs/deployment.md': 'Current Release Continuity',
      'docs/security-checklist.md': 'Current Release Continuity',
      'docs/test-evidence.md': 'Current Release Continuity',
      'docs/demo-script.md': 'Current Release Continuity',
      'docs/new-session-grounding-prompts.md': 'Current Release Continuity',
    };
    for (const [name, heading] of Object.entries(headings)) {
      const value = String(sourceMap && sourceMap[name] || '');
      const pattern = new RegExp('^## ' + heading + ' \\(' + releaseDate.replace(/\./g, '\\.') + '\\)\\s*$', 'm');
      if (!pattern.test(value)) problems.push(name + ' does not carry the synchronized current heading date');
    }
    return problems;
  }

  const liveDateProblems = currentCandidateDateProblems(docs);
  ok('accepted continuity headings and feature-candidate update dates remain explicit',
    liveDateProblems.length === 0);
  liveDateProblems.forEach((problem) => console.error('    - current-date: ' + problem));

  const DATE_FIXTURE = {
    'AGENTS.md': '## Current Release Continuity (2026-08-28)',
    'CLAUDE.md': '## Current Release Continuity (2026-08-28)',
    'CODEX_HANDOFF.md': 'Last updated: 2026-08-28 (Asia/Manila)\n## Current Release Continuity (2026-08-28)',
    'CLAUDE_HANDOFF.md': 'Last updated: 2026-08-28 (Asia/Manila)\n## Current Release Continuity (2026-08-28)',
    'plan.md': '## Current Release Continuity (2026-08-28)',
    'ROADMAP.md': '## Current Release Continuity (2026-08-28)',
    'docs/new-session-grounding-prompts.md': 'Last updated: 2026-08-28 (Asia/Manila)\n## Current Release Continuity (2026-08-28)',
    'docs/demo-script.md': '## Current Release Continuity (2026-08-28)',
    'docs/deployment.md': '## Current Release Continuity (2026-08-28)',
    'docs/security-checklist.md': '## Current Release Continuity (2026-08-28)',
    'docs/test-evidence.md': '## Current Release Continuity (2026-08-28)',
  };
  ok('fixture: accepted continuity and candidate-update dates are accepted while stale dates are rejected',
    currentCandidateDateProblems(DATE_FIXTURE).length === 0 &&
    currentCandidateDateProblems(Object.assign({}, DATE_FIXTURE, {
      'docs/security-checklist.md': '## Current Release Continuity (2026-08-10)',
    })).length > 0 &&
    currentCandidateDateProblems(Object.assign({}, DATE_FIXTURE, {
      'ROADMAP.md': '## Current Release Continuity (2026-08-10)',
    })).length > 0);

  // L7: AGENTS.md + CLAUDE.md must not carry the stale claims and must document
  // the live test/auth/persistence/Cloudinary architecture.
  for (const [name, doc] of [['AGENTS.md', agents], ['CLAUDE.md', claude]]) {
    ok(`${name} drops stale "npm test placeholder/exits 1"`,
      !/`npm test` is a placeholder/.test(doc) && !/exits 1/.test(doc));
    ok(`${name} drops stale "two parallel auth-middleware modules"`,
      !doc.includes('Two parallel auth-middleware modules exist and are both in active use'));
    ok(`${name} documents npm test -> scripts/quality-gates.js`, doc.includes('scripts/quality-gates.js'));
    ok(`${name} documents roleAuth single source of truth + requireLogin compat re-export`,
      doc.includes('single source of truth') && doc.includes('roleAuth.js') &&
      doc.includes('requireLogin.js') && /compatibility re-export/i.test(doc));
    ok(`${name} documents Supabase production/session-store + MySQL fallback`,
      /Supabase[\s\S]{0,80}production/i.test(doc) && doc.includes('SESSION_STORE=supabase') && /MySQL[\s\S]{0,40}fallback/i.test(doc));
    ok(`${name} documents repositories/services layers`,
      doc.includes('repositories/') && doc.includes('services/'));
    ok(`${name} documents Cloudinary media-only + server-only + /img fallback`,
      /Cloudinary is media delivery only/i.test(doc) && doc.includes('server-only') && doc.includes('/img/vr/'));
  }

  // Handoffs carry the authoritative completion banner and the owner-approved
  // limited-pilot sequencing. Readiness is not deployment permission, and the
  // deferred offline package remains mandatory before final M12 GO.
  for (const [name, doc] of [['CODEX_HANDOFF.md', codexH], ['CLAUDE_HANDOFF.md', claudeH]]) {
    const flatDoc = doc.replace(/^>\s?/gm, '').replace(/\s+/g, ' ');
    ok(`${name} no longer names Section 10.1 as the current active section`,
      !doc.includes('Milestone 10, Section 10.1: Cloudinary Media Baseline Audit'));
    ok(`${name} carries the durable CURRENT STATUS banner`,
      /CURRENT STATUS \(authoritative/i.test(flatDoc) &&
      /Milestone 10 Cloudinary Media Support is complete and Codex GO/i.test(flatDoc) &&
      /10\.8.{0,60}passed/i.test(flatDoc));
    ok(`${name} records Milestone 11 final GO and the limited-pilot boundary`,
      flatDoc.includes('Milestone 11: Room Scheduling') &&
      /Milestone 11.{0,120}complete.{0,80}Codex GO/i.test(flatDoc) &&
      /Section 11\.8.{0,80}(passed|GO\/NO-GO)/i.test(flatDoc) &&
      /OFF\.1.{0,160}complete.{0,80}Codex GO/i.test(flatDoc) &&
      /M12\.P1.{0,180}(next|readiness)/i.test(flatDoc) &&
      /(deployment.{0,80}not (yet )?authorized|not.{0,80}permission to deploy)/i.test(flatDoc));
  }

  const currentStatusDocs = [
    'CODEX_HANDOFF.md',
    'CLAUDE_HANDOFF.md',
    'plan.md',
    'ROADMAP.md',
    'docs/new-session-grounding-prompts.md',
  ];
  const architectureDocs = [
    'CODEX_HANDOFF.md',
    'CLAUDE_HANDOFF.md',
    'plan.md',
    'ROADMAP.md',
    'README.md',
    'AGENTS.md',
    'CLAUDE.md',
    'docs/deployment.md',
    'docs/new-session-grounding-prompts.md',
  ];
  const migrationDocs = [...architectureDocs, '.env.example'];
  const sequenceDocs = [
    'CODEX_HANDOFF.md',
    'CLAUDE_HANDOFF.md',
    'plan.md',
    'ROADMAP.md',
    'docs/deployment.md',
    'docs/new-session-grounding-prompts.md',
  ];

  for (const name of currentStatusDocs) {
    const doc = docs[name].replace(/\s+/g, ' ');
    ok(`${name} records RF.1-RF.6 complete and Codex GO`,
      /RF\.1[\s\S]{0,80}RF\.6[\s\S]{0,100}(complete|completed)[\s\S]{0,80}Codex GO/i.test(doc));
    ok(`${name} records OFF.1 GO and M12.P1 as the next gated step`,
      /OFF\.1[\s\S]{0,220}(complete|completed)[\s\S]{0,100}Codex GO/i.test(doc) &&
      /M12\.P1[\s\S]{0,220}(next|readiness)/i.test(doc));
  }

  for (const name of migrationDocs) {
    const doc = docs[name].replace(/\s+/g, ' ');
    ok(`${name} records migrations through 0019`, /0001[\s\S]{0,2000}0019/.test(doc));
    ok(`${name} records 0014-0019 owner-applied`,
      /0014[\s\S]{0,80}0019[\s\S]{0,120}owner-applied|owner-applied[\s\S]{0,240}0014[\s\S]{0,80}0019|0001[\s\S]{0,80}0019[^\n]{0,80}all owner-applied/i.test(doc));
  }

  for (const name of architectureDocs) {
    const doc = docs[name].replace(/\s+/g, ' ');
    ok(`${name} records the expanded backend-specific route and Guided-VR catalog truth`,
      /MySQL.{0,160}34.{0,40}buildings.{0,100}44.{0,40}(nodes|route nodes).{0,100}100.{0,40}(directed edges|edges).{0,100}50.{0,40}(reverse pairs|pairs).{0,100}100.{0,80}geometr/i.test(doc) &&
      /Supabase.{0,160}25.{0,40}buildings.{0,100}26.{0,40}(nodes|route nodes).{0,100}50.{0,40}(directed edges|edges).{0,100}25.{0,40}(reverse pairs|pairs).{0,100}50.{0,80}geometr/i.test(doc) &&
      /25.{0,80}(active|configured).{0,80}(Guided VR|destinations)/i.test(doc) &&
      /472.{0,80}(configured )?(steps|scene steps)/i.test(doc) &&
      /99.{0,80}unique.{0,40}(scene|scene keys)/i.test(doc));
    ok(`${name} states routing uses the campus graph and owner-managed geometry`,
      /(own|its own|internal).{0,40}campus graph/i.test(doc) &&
      /owner-managed.{0,80}(geometr(y|ies)|path_geometry)/i.test(doc));
    ok(`${name} rejects Google/Earth/Strava/SIS/external routing integration`,
      /Google Maps/i.test(doc) && /Google Earth/i.test(doc) && /Strava/i.test(doc) && /SIS/i.test(doc) &&
      /(not integrated|does not integrate|no .{0,160}dependency|not Google Maps)/i.test(doc));
    ok(`${name} records guided-VR destination-coverage truth`,
      /Guided VR[\s\S]{0,180}(arrival|arrive)[\s\S]{0,220}(destination|partial|coverage)/i.test(doc));
  }

  const GUIDED_VR_HISTORY_START = '<!-- GUIDED-VR HISTORICAL POLICY START -->';
  const GUIDED_VR_HISTORY_END = '<!-- GUIDED-VR HISTORICAL POLICY END -->';
  const M12_HISTORY_START = '<!-- M12.P1 HISTORICAL 2026-07-30 STATUS START -->';
  const M12_HISTORY_END = '<!-- M12.P1 HISTORICAL 2026-07-30 STATUS END -->';
  const M12_PRIOR_START = '<!-- M12.P1 PRIOR STATUS START -->';
  const M12_PRIOR_END = '<!-- M12.P1 PRIOR STATUS END -->';

  /** PURE: remove exactly one ordered marker block, or fail closed. */
  function stripSingleAuthorityBlock(value, startMarker, endMarker) {
    const text = String(value == null ? '' : value);
    const starts = text.split(startMarker).length - 1;
    const ends = text.split(endMarker).length - 1;
    const start = text.indexOf(startMarker);
    const end = text.indexOf(endMarker);
    if (starts !== 1 || ends !== 1 || start < 0 || end <= start) {
      return { valid: false, current: text };
    }
    return {
      valid: true,
      current: text.slice(0, start) + text.slice(end + endMarker.length),
    };
  }

  /** PURE: expose only current repository authority, excluding marked history. */
  function currentRepositoryGuidedVrAuthority(value, includeGuidedHistory) {
    let current = String(value == null ? '' : value);
    const pairs = [
      [M12_HISTORY_START, M12_HISTORY_END],
      [M12_PRIOR_START, M12_PRIOR_END],
    ];
    if (includeGuidedHistory) pairs.push([GUIDED_VR_HISTORY_START, GUIDED_VR_HISTORY_END]);
    for (const [startMarker, endMarker] of pairs) {
      const stripped = stripSingleAuthorityBlock(current, startMarker, endMarker);
      if (!stripped.valid) return { valid: false, current };
      current = stripped.current;
    }
    return { valid: true, current };
  }

  /** PURE: isolate the one permitted historical Guided-VR policy block. */
  function guidedVrHistoricalPolicy(value) {
    const text = String(value == null ? '' : value);
    const starts = text.split(GUIDED_VR_HISTORY_START).length - 1;
    const ends = text.split(GUIDED_VR_HISTORY_END).length - 1;
    const start = text.indexOf(GUIDED_VR_HISTORY_START);
    const end = text.indexOf(GUIDED_VR_HISTORY_END);
    if (starts !== 1 || ends !== 1 || start < 0 || end <= start) {
      return { valid: false, history: '', current: text };
    }
    const history = text.slice(start + GUIDED_VR_HISTORY_START.length, end);
    const current = text.slice(0, start) + text.slice(end + GUIDED_VR_HISTORY_END.length);
    const compactHistory = history.replace(/\s+/g, ' ');
    return {
      valid: (
        /### Building Expansion/i.test(history) &&
        /\bBE\.1\b/i.test(compactHistory) &&
        /\bBE\.4\b/i.test(compactHistory) &&
        /\bBE\.6\b/i.test(compactHistory) &&
        !/### Offline Campus Navigation Package/i.test(history) &&
        /### Offline Campus Navigation Package/i.test(current)
      ),
      history,
      current,
    };
  }

  /** PURE: find obsolete Guided-VR policy presented as current authority. */
  function guidedVrAuthorityProblems(value) {
    const blocks = stripFencedBlocks(value)
      .split(/\r?\n\s*\r?\n/)
      .map((block) => block.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    return blocks.filter((block) => {
      const stale = (
        /\bCAS-only\b/i.test(block) ||
        /\b(?:deferred[- ]CCS|CCS[- ]deferred|CCS[- ]unavailable)\b/i.test(block) ||
        /\bCCS\b[^.]{0,180}\b(?:Guided[- ]?VR|route)\b[^.]{0,180}\b(?:deferred|unavailable)\b/i.test(block) ||
        /\bmissing CCS\b[^.]{0,120}\b(?:placeholder|media|panorama)\b/i.test(block) ||
        /\bCAS\b[^.]{0,100}\b(?:required|only)\b[^.]{0,100}\bGuided[- ]?VR\b/i.test(block) ||
        /\bCAS guided[- ]?VR\b[^.]{0,160}\bdeferred CCS\b/i.test(block) ||
        /\b24[- ]scene\b[^.]{0,120}\bCAS\b[^.]{0,160}\b23[- ]scene\b[^.]{0,120}\bCCS\b/i.test(block) ||
        /\bfrozen\s+13-building\s+catalog\b/i.test(block) ||
        /\brequired\s+CAS\s+VR\s+metadata\b/i.test(block)
      );
      if (!stale) return false;
      const historical = /\b(?:historical|superseded|older|former)\b/i.test(block);
      const disclaimsCurrent = /\b(?:not current|does not describe current|no longer current|not operative)\b/i.test(block);
      return !(historical && disclaimsCurrent);
    });
  }

  const liveGuidedVrHistory = guidedVrHistoricalPolicy(docs['plan.md']);
  ok('plan.md carries exactly one ordered historical Guided-VR policy block around completed BE history',
    liveGuidedVrHistory.valid);
  ok('plan.md current authority contains no operative CAS-only or deferred-CCS Guided-VR policy',
    guidedVrAuthorityProblems(liveGuidedVrHistory.current).length === 0);
  ok('ROADMAP.md current authority contains no operative CAS-only or deferred-CCS Guided-VR policy',
    guidedVrAuthorityProblems(docs['ROADMAP.md']).length === 0);

  for (const [name, includeGuidedHistory] of [
    ['CODEX_HANDOFF.md', true],
    ['CLAUDE_HANDOFF.md', true],
    ['AGENTS.md', false],
    ['CLAUDE.md', false],
  ]) {
    const authority = currentRepositoryGuidedVrAuthority(docs[name], includeGuidedHistory);
    const problems = authority.valid ? guidedVrAuthorityProblems(authority.current) : ['authority markers are invalid'];
    ok(`${name} marked history is isolated and current Guided-VR authority rejects obsolete CAS-only/deferred-CCS policy`,
      authority.valid && problems.length === 0);
    problems.forEach((problem) => console.error(`    - ${name} Guided-VR authority: ${problem}`));
  }

  const CURRENT_GUIDED_VR_FIXTURE = 'All 25 configured Guided-VR destinations remain active online. OFF.3 packages the current BE.6-frozen public catalog for the selected supported backend and Guided-VR metadata for all 25 active destinations. The 13-building roster is only the reproducible seed baseline.';
  const EXPLICIT_GUIDED_VR_HISTORY_FIXTURE = 'Historical and superseded: the older CAS-only/deferred-CCS policy is not current and does not describe current runtime truth.';
  const MARKED_GUIDED_VR_HISTORY_FIXTURE = [
    GUIDED_VR_HISTORY_START,
    '### Building Expansion',
    'BE.1 through BE.6 are completed history. BE.4 required deferred CCS behavior.',
    GUIDED_VR_HISTORY_END,
    '### Offline Campus Navigation Package',
    CURRENT_GUIDED_VR_FIXTURE,
  ].join('\n\n');
  const GENERIC_MARKED_GUIDED_VR_FIXTURE = [
    GUIDED_VR_HISTORY_START,
    'BE.4 required deferred CCS behavior.',
    GUIDED_VR_HISTORY_END,
    CURRENT_GUIDED_VR_FIXTURE,
  ].join('\n\n');
  ok('fixture: the current 25-destination Guided-VR policy is accepted',
    guidedVrAuthorityProblems(CURRENT_GUIDED_VR_FIXTURE).length === 0);
  ok('fixture: explicitly historical obsolete Guided-VR policy is accepted',
    guidedVrAuthorityProblems(EXPLICIT_GUIDED_VR_HISTORY_FIXTURE).length === 0);
  ok('fixture: a single marker-wrapped obsolete BE policy is isolated and accepted as history',
    guidedVrHistoricalPolicy(MARKED_GUIDED_VR_HISTORY_FIXTURE).valid &&
    guidedVrAuthorityProblems(guidedVrHistoricalPolicy(MARKED_GUIDED_VR_HISTORY_FIXTURE).current).length === 0 &&
    stripSingleAuthorityBlock(
      GENERIC_MARKED_GUIDED_VR_FIXTURE, GUIDED_VR_HISTORY_START, GUIDED_VR_HISTORY_END).valid &&
    guidedVrAuthorityProblems(stripSingleAuthorityBlock(
      GENERIC_MARKED_GUIDED_VR_FIXTURE, GUIDED_VR_HISTORY_START, GUIDED_VR_HISTORY_END).current).length === 0);
  ok('fixture: a current catalog followed by operative deferred-CCS authority is rejected',
    guidedVrAuthorityProblems(CURRENT_GUIDED_VR_FIXTURE + '\n\nCCS Guided VR remains deferred until a later release.').length > 0);
  ok('fixture: future CCS-unavailable, frozen-13-building, and CAS-only offline scopes are rejected',
    guidedVrAuthorityProblems('OFF.5 must preserve the current CCS-unavailable Guided-VR state.').length > 0 &&
    guidedVrAuthorityProblems('OFF.3 packages the frozen 13-building catalog for public use.').length > 0 &&
    guidedVrAuthorityProblems('OFF.3 packages required CAS VR metadata for public use.').length > 0);
  ok('fixture: the obsolete exact 24-scene CAS and 23-scene CCS policy is rejected',
    guidedVrAuthorityProblems('Current policy requires a 24-scene CAS route and a 23-scene CCS route.').length > 0);
  ok('fixture: missing, duplicated, or inverted Guided-VR history markers fail closed',
    !guidedVrHistoricalPolicy(MARKED_GUIDED_VR_HISTORY_FIXTURE.replace(GUIDED_VR_HISTORY_START, '')).valid &&
    !guidedVrHistoricalPolicy(GUIDED_VR_HISTORY_START + '\n' + MARKED_GUIDED_VR_HISTORY_FIXTURE).valid &&
    !guidedVrHistoricalPolicy(GUIDED_VR_HISTORY_END + '\nold\n' + GUIDED_VR_HISTORY_START).valid);

  /** PURE: require accepted D6/OFF.2-OFF.6 history, the committed verified
   * implementation, and independent final-closeout/release boundaries. */
  function offlineCandidateAuthorityProblems(value) {
    const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    /* Once a document carries the marked current-release block, evaluate that
       block in isolation. Historical sections intentionally retain the old
       "current uncommitted candidate" wording; allowing those archived claims
       to contaminate the live e481d03 block makes this helper fail even when
       current authority is correct. Marker-free fixtures still use the
       unscoped analyzer below. */
    const hasCurrentMarkers = text.includes(CURRENT_RELEASE_CONTINUITY_START) &&
      text.includes(CURRENT_RELEASE_CONTINUITY_END);
    if (currentReleaseContinuityProblems(value, { requireMarkers: hasCurrentMarkers }).length === 0) {
      return [];
    }
    const anchors = [...text.matchAll(/\b(?:OFF\.2-OFF\.6|OFF\.2\s*(?:through|-)\s*OFF\.6)\b/ig)].map((match) => match.index);
    const scopes = anchors.map((index) => {
      const candidates = [index + 25000];
      for (const delimiter of ['<!-- M12.P1 CURRENT STATUS END -->', '```']) {
        const at = text.indexOf(delimiter, index);
        if (at >= 0) candidates.push(at);
      }
      return text.slice(Math.max(0, index - 260), Math.min(...candidates));
    });
    const hasExactCommits = text.includes('cdbc863b779e5319c14dee21a31a5e78951e233c') &&
      text.includes('691f0bef40e06b6ea9485e713d2fe3000a03bd83') &&
      text.includes('d786bdcb83a196c7263dceae668417d3ced3e95a');
    const hasReleaseDenial = hasPrePresentationReleaseDenial(text);
    const hasPilotReview = /\bpilot review\b.{0,100}\bcomplete\b/i.test(text);
    const hasCurrentCorrectionEvidence = currentOfflineCorrectionEvidenceProblems(text).length === 0;
    const currentCorrectionContradiction = splitEvidenceClaims(text).some((claim) => {
      const historical = /\b(?:historical|superseded|previously|at that time|earlier|prior)\b/i.test(claim) &&
        /\b(?:before|previously|at that time|earlier|former|then)\b/i.test(claim);
      if (historical) return false;
      const currentIdentity = /\b(?:d786bdcb83a196c7263dceae668417d3ced3e95a|d786|19-file offline UI\/(?:accessibility\/package )?(?:implementation|correction candidate))\b/i.test(claim);
      const identityContradiction = currentIdentity &&
        /\b(?:uncommitted|pending independent read-only review and full verification|not pushed|deployed|promoted|\bCurrent\b|R8 GO)\b/i.test(claim);
      const genericPending = /\b(?:pushed )?implementation\b[^.]{0,180}\b(?:uncommitted|pending independent read-only review and full verification)\b/i.test(claim);
      const genericR8Go = /\bR8\s+GO\s+(?:has been|is|was)\s+(?:issued|granted|approved|returned)\b/i.test(claim);
      return identityContradiction || genericPending || genericR8Go;
    });
    const valid = hasExactCommits && hasReleaseDenial && hasPilotReview && hasCurrentCorrectionEvidence &&
      !currentCorrectionContradiction && scopes.some((scope) => {
      const contradiction = splitEvidenceClaims(scope).some((claim) => {
        const historical = /\b(?:historical|superseded|previously|at that time)\b/i.test(claim) &&
          /\b(?:before|previously|at that time|earlier|former|then)\b/i.test(claim);
        if (historical) return false;
        if (hasPrePresentationReleaseDenial(claim) || /\bfinal Milestone 12 GO is (?:deliberately )?not self-issued\b/i.test(claim)) {
          return false;
        }
        return /\b(?:OFF\.2-OFF\.6|OFF\.2\s*(?:through|-)\s*OFF\.6)\b[^.]{0,180}\b(?:remain|remains|are|is)\s+(?:open|pending|unaccepted)\b/i.test(claim) ||
          /\b(?:OFF\.2-OFF\.6|OFF\.2\s*(?:through|-)\s*OFF\.6)\b[^.]{0,220}\b(?:no Codex GO|without Codex GO|awaiting independent (?:Codex )?review)\b/i.test(claim) ||
          /\b(?:M12\.P1-)?D6\b[^.]{0,180}\b(?:remain|remains|is)\s+(?:open|pending|unaccepted)\b/i.test(claim) ||
          /\blocal (?:candidate|commits?)\b[^.]{0,180}\b(?:may|can|is authorized to|will)\b[^.]{0,80}\b(?:be )?(?:promoted|deployed)\b/i.test(claim) ||
          /\bfinal Milestone 12 GO\b[^.]{0,100}\b(?:is|has been)\b[^.]{0,40}\b(?:issued|granted|complete)\b/i.test(claim);
      });
      return !contradiction &&
        /\b(?:OFF\.2-OFF\.6|OFF\.2\s*(?:through|-)\s*OFF\.6)\b.{0,180}\b(?:complete|completed)\b.{0,80}\bCodex GO\b/i.test(scope) &&
        /\b(?:M12\.P1-)?D6\b.{0,180}\b(?:complete|completed|commit-readiness is)\b.{0,80}\bCodex GO\b/i.test(scope) &&
        /\bfinal Milestone 12\b.{0,180}\b(?:not self-issued|remains external|awaits? (?:one )?independent|latest independent external closeout report controls)\b/i.test(scope);
    });
    return valid ? [] : ['accepted D6/OFF history or committed 19-file correction lifecycle boundary is missing'];
  }

  /** PURE: require the current local maintenance lifecycle to match live Git
   * and the recorded supported cleanup evidence. This is evaluated only on
   * the current maintenance paragraph so historical/rejected evidence remains
   * explicitly historical rather than becoming operative authority. */
  function currentMaintenanceAuthorityProblems(value) {
    const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    const problems = [];
    const manifestShape = /\bmanifest SHA-256\b.{0,120}\b16 files\b.{0,80}\b1,915,676 bytes\b/i.test(text) ||
      /\b16-file(?:s)?\b.{0,120}\bmanifest SHA-256\b.{0,80}\b1,915,676 bytes\b/i.test(text);
    const packageShape = /\bpackage identity\b.{0,120}\b168 files\b.{0,80}\b7,074,195 bytes\b.{0,100}\baggregate SHA-256\b/i.test(text);
    const cleanupEvidence = /\b(?:owner-authorized|authorized) local cleanup\b.{0,260}\b309\b[\s\S]{0,260}\ba50b800e370439e0257cb7667d3fdb567af9dab88b87c3aeca6f32593598d18d\b[\s\S]{0,260}\bdestroyed 309\b[\s\S]{0,220}\bzero candidates\b[\s\S]{0,100}\bzero scanned residue\b/i.test(text);
    if (!text.includes(CURRENT_MAINTENANCE_COMMIT_SHA) ||
        !/\bcommitted locally on `?main`?\b/i.test(text) ||
        !/\bhas not been pushed to `?origin\/main`?\b/i.test(text)) {
      problems.push('current local maintenance commit/lifecycle identity is missing');
    }
    if (!text.includes(CURRENT_MAINTENANCE_MANIFEST_SHA256) || !manifestShape) {
      problems.push('current 16-file maintenance manifest identity is missing');
    }
    if (!text.includes(CURRENT_MAINTENANCE_PACKAGE_SHA256) || !packageShape ||
        !/\bpackage identity does not authorize deployment\b/i.test(text)) {
      problems.push('current maintenance package identity or deployment boundary is missing');
    }
    if (!cleanupEvidence) problems.push('exact supported 309-row cleanup evidence is missing');
    if (!/\breplacement full verification remains a separate boundary\b/i.test(text) ||
        !/\bpush, promotion, and deployment remain separately gated\b/i.test(text) ||
        !/\bFinal Milestone 12 disposition remains external\b/i.test(text)) {
      problems.push('replacement-verification and release boundaries are missing');
    }
    if (/\bNo cleanup has run\b|\bcleanup requires a fresh read-only preflight\b|\breplacement full verification, commit, push, promotion, and deployment remain separately gated\b/i.test(text)) {
      problems.push('stale pre-cleanup or pre-commit lifecycle authority remains');
    }
    if (/\b(?:candidate evidence only|correction is a separate local-session byte set)\b/i.test(text) ||
        /\b(?:uncommitted|pending independent read-only review and full verification)\b/i.test(text) ||
        /\b(?:has|have|was|were|is|are|already|now)\s+(?:been\s+)?(?:pushed|promoted|deployed)\b/i.test(text)) {
      problems.push('current paragraph contains an operative candidate or deployed-state claim');
    }
    return problems;
  }

  function currentMaintenanceAuthorityBlocks(value) {
    const text = String(value == null ? '' : value);
    const historicalStart = text.indexOf('## Historical Codex Grounding Prompt');
    const operative = historicalStart >= 0 ? text.slice(0, historicalStart) : text;
    const blocks = [];
    let cursor = 0;
    while (cursor < operative.length) {
      const start = operative.indexOf('The current local maintenance correction is', cursor);
      if (start < 0) break;
      const tail = operative.slice(start);
      const delimiters = [
        'Dependency-security remediation',
        'The independent read-only closeout review',
        '- The Guided-VR runtime/catalog remediation',
        '## Codex Grounding Prompt',
        '## Claude Code Grounding Prompt',
        '| Evidence class',
      ].map((marker) => {
        const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const match = new RegExp('\\r?\\n\\r?\\n' + escapedMarker).exec(tail);
        return match ? match.index : -1;
      }).filter((index) => index >= 0);
      blocks.push(tail.slice(0, delimiters.length ? Math.min(...delimiters) : tail.length));
      cursor = start + 'The current local maintenance correction is'.length;
    }
    return blocks;
  }

  const maintenanceAuthorityDocs = [
    'AGENTS.md',
    'CLAUDE.md',
    'CODEX_HANDOFF.md',
    'CLAUDE_HANDOFF.md',
    'plan.md',
    'ROADMAP.md',
    'docs/demo-script.md',
    'docs/deployment.md',
    'docs/security-checklist.md',
    'docs/test-evidence.md',
  ];

  for (const name of maintenanceAuthorityDocs) {
    const problems = currentReleaseContinuityProblems(docs[name]);
    ok(`${name} records e481d03 continuity and the current verification/deployment boundary`,
      problems.length === 0);
    problems.forEach((problem) => console.error(`    - ${name} release continuity: ${problem}`));
  }

  const releaseFixtureSource = docs['CODEX_HANDOFF.md'];
  const releaseStart = releaseFixtureSource.indexOf(CURRENT_RELEASE_CONTINUITY_START);
  const releaseEnd = releaseFixtureSource.indexOf(CURRENT_RELEASE_CONTINUITY_END);
  const CURRENT_RELEASE_CONTINUITY_FIXTURE = releaseStart >= 0 && releaseEnd > releaseStart
    ? releaseFixtureSource.slice(releaseStart, releaseEnd + CURRENT_RELEASE_CONTINUITY_END.length)
    : '';
  const replaceAllLiteral = (value, from, to) => String(value).split(from).join(to);
  const replaceWrapped = (value, pattern, replacement) => String(value).replace(pattern, replacement);
  ok('fixture: current post-e481d03 continuity is accepted and stale/false variants fail closed',
    currentReleaseContinuityProblems(CURRENT_RELEASE_CONTINUITY_FIXTURE).length === 0 &&
    currentReleaseContinuityProblems(replaceAllLiteral(
      CURRENT_RELEASE_CONTINUITY_FIXTURE,
      CURRENT_PUSHED_CANDIDATE_COMMIT_SHA,
      'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')).length > 0 &&
    currentReleaseContinuityProblems(replaceAllLiteral(
      CURRENT_RELEASE_CONTINUITY_FIXTURE,
      CURRENT_PUSHED_CANDIDATE_PACKAGE_SHA256,
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).length > 0 &&
    currentReleaseContinuityProblems(replaceWrapped(
      CURRENT_RELEASE_CONTINUITY_FIXTURE,
      /no owner-authorized promotion/i,
      'owner-authorized promotion')).length > 0 &&
    currentReleaseContinuityProblems(replaceWrapped(
      CURRENT_RELEASE_CONTINUITY_FIXTURE,
      /unsupported Android\/Chrome platform compatibility observation/i,
      'confirmed CampuSphere Android code bug')).length > 0 &&
    currentReleaseContinuityProblems(replaceWrapped(
      CURRENT_RELEASE_CONTINUITY_FIXTURE,
      /participant-facing public FAQ(?: page)?/i,
      'already implemented public FAQ page')).length > 0 &&
    currentReleaseContinuityProblems(replaceWrapped(
      CURRENT_RELEASE_CONTINUITY_FIXTURE,
      /Do not reapply migration 0020 without a new explicit database\s+authorization\./,
      'Reapply migration 0020 in every new session.')).length > 0 &&
    currentReleaseContinuityProblems(
      CURRENT_RELEASE_CONTINUITY_FIXTURE + '\n' + CURRENT_RELEASE_CONTINUITY_START).length > 0);

  for (const name of maintenanceAuthorityDocs) {
    const blocks = currentMaintenanceAuthorityBlocks(docs[name]);
    const problems = blocks.length === 0
      ? ['current maintenance authority paragraph is missing']
      : blocks.flatMap((block) => currentMaintenanceAuthorityProblems(block));
    ok(`${name} records the committed local maintenance lifecycle and exact cleanup boundary`,
      problems.length === 0);
    problems.forEach((problem) => console.error(`    - ${name} maintenance authority: ${problem}`));
  }

  const CURRENT_MAINTENANCE_AUTHORITY_FIXTURE = [
    'The current local maintenance correction is committed locally on `main` as Git commit SHA-1 ' + CURRENT_MAINTENANCE_COMMIT_SHA + ' and has not been pushed to `origin/main`.',
    'Its exact 16-file manifest SHA-256 ' + CURRENT_MAINTENANCE_MANIFEST_SHA256 + ' (16 files, 1,915,676 bytes).',
    'The current package identity remains 168 files, 7,074,195 bytes, aggregate SHA-256 ' + CURRENT_MAINTENANCE_PACKAGE_SHA256 + '; package identity does not authorize deployment.',
    'The exact owner-authorized local cleanup found 309 harness-shaped candidates with cleanup fingerprint SHA-256 a50b800e370439e0257cb7667d3fdb567af9dab88b87c3aeca6f32593598d18d, destroyed 309 through the supported conditional interface, and left zero candidates and zero scanned residue.',
    'Replacement full verification remains a separate boundary; push, promotion, and deployment remain separately gated, and Final Milestone 12 disposition remains external.',
  ].join(' ');
  ok('fixture: current maintenance lifecycle is accepted and stale variants fail closed',
    currentMaintenanceAuthorityProblems(CURRENT_MAINTENANCE_AUTHORITY_FIXTURE).length === 0 &&
    currentMaintenanceAuthorityProblems(CURRENT_MAINTENANCE_AUTHORITY_FIXTURE.replace(CURRENT_MAINTENANCE_COMMIT_SHA, 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')).length > 0 &&
    currentMaintenanceAuthorityProblems(CURRENT_MAINTENANCE_AUTHORITY_FIXTURE.replace(CURRENT_MAINTENANCE_MANIFEST_SHA256, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).length > 0 &&
    currentMaintenanceAuthorityProblems(CURRENT_MAINTENANCE_AUTHORITY_FIXTURE.replace('a50b800e370439e0257cb7667d3fdb567af9dab88b87c3aeca6f32593598d18d', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')).length > 0 &&
    currentMaintenanceAuthorityProblems(CURRENT_MAINTENANCE_AUTHORITY_FIXTURE.replace('a50b800e370439e0257cb7667d3fdb567af9dab88b87c3aeca6f32593598d18d', 'a50b800e370439e0257cb7667d3fdb567af9dab88b87c3aeca6f32593598d')).length > 0 &&
    currentMaintenanceAuthorityProblems(CURRENT_MAINTENANCE_AUTHORITY_FIXTURE.replace('destroyed 309', 'destroyed 308')).length > 0 &&
    currentMaintenanceAuthorityProblems(CURRENT_MAINTENANCE_AUTHORITY_FIXTURE + ' No cleanup has run.').length > 0 &&
    currentMaintenanceAuthorityProblems(CURRENT_MAINTENANCE_AUTHORITY_FIXTURE.replace('Replacement full verification remains a separate boundary', 'replacement full verification, commit, push, promotion, and deployment remain separately gated')).length > 0 &&
    currentMaintenanceAuthorityProblems(CURRENT_MAINTENANCE_AUTHORITY_FIXTURE + ' The correction is uncommitted and pending independent read-only review and full verification.').length > 0 &&
    currentMaintenanceAuthorityProblems(CURRENT_MAINTENANCE_AUTHORITY_FIXTURE + ' The maintenance correction has been pushed and deployed.').length > 0);

  for (const name of sequenceDocs) {
    ok(`${name} records accepted local D6/OFF.2-OFF.6 authority and preserves final-closeout/release boundaries`,
      offlineCandidateAuthorityProblems(docs[name]).length === 0);
  }

  const CURRENT_OFFLINE_AUTHORITY_FIXTURE =
    'Pilot review is complete. OFF.2-OFF.6 are complete and Codex GO on local commit cdbc863b779e5319c14dee21a31a5e78951e233c. ' +
    'D6 is complete and Codex GO on local commit 691f0bef40e06b6ea9485e713d2fe3000a03bd83. ' +
    'Replacement full verification of the exact 19-file offline UI/accessibility/package implementation passed at 4998/4998 with QUALITY-GATES OK, five-stage npm run qa at the same exact contract total, bounded Chrome acceptance in both supported backends, and ordered postconditions 24/24 -> 18/18 -> 46/46. ' +
    'It was committed as d786bdcb83a196c7263dceae668417d3ced3e95a and pushed to origin/main. ' +
    'The committed implementation manifest SHA-256 92c689b884f52021f5545f331e8768ffc4768914cf9320c2d4b8fedee7020642 covered 19 files and 2,072,400 bytes. ' +
    'The package pin is 168 files, 7,074,195 bytes, aggregate SHA-256 13cd3c5e5d8259766e50b1136c8cc8a5672b2321c65962892358c62b45ef88f5. ' +
    'The clean-commit independent R8 review returned NO-GO solely because stale operative lifecycle authority described the pushed, verified commit as uncommitted and pending; no separate runtime, security, database, or package blocker was found. ' +
    'Final Milestone 12 disposition remains external. The documentation/static-assertion correction is a separate byte set whose lifecycle and disposition are controlled by live Git and the latest independent external review report. No promotion or deployment is authorized.';
  ok('authoritative docs contain no stale OFF.1-next rule and the current closeout boundary fails closed',
    !/OFF\.1(?: Offline Baseline Audit and Domain Contract)? is (?:the )?next authorized section|OFF\.1 through OFF\.6 have not started/i.test(
      currentStatusDocs.map((name) => docs[name]).join('\n')
    ) &&
    offlineCandidateAuthorityProblems(CURRENT_OFFLINE_AUTHORITY_FIXTURE).length === 0 &&
    offlineCandidateAuthorityProblems(
      CURRENT_OFFLINE_AUTHORITY_FIXTURE.replace('OFF.2-OFF.6 are complete and Codex GO', 'OFF.2-OFF.6 remain open with no Codex GO')).length > 0 &&
    offlineCandidateAuthorityProblems(
      CURRENT_OFFLINE_AUTHORITY_FIXTURE + ' Final Milestone 12 GO has been issued.').length > 0 &&
    offlineCandidateAuthorityProblems(
      CURRENT_OFFLINE_AUTHORITY_FIXTURE + ' The local commits may be pushed, promoted, or deployed before the presentation.').length > 0 &&
    offlineCandidateAuthorityProblems(
      CURRENT_OFFLINE_AUTHORITY_FIXTURE + ' The current 19-file offline UI/accessibility/package correction candidate is accepted and commit-readiness GO.').length > 0 &&
    offlineCandidateAuthorityProblems(
      CURRENT_OFFLINE_AUTHORITY_FIXTURE.replace(CURRENT_OFFLINE_COMMITTED_MANIFEST_SHA256, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).length > 0 &&
    offlineCandidateAuthorityProblems(
      CURRENT_OFFLINE_AUTHORITY_FIXTURE.replace('d786bdcb83a196c7263dceae668417d3ced3e95a', 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')).length > 0 &&
    offlineCandidateAuthorityProblems(
      CURRENT_OFFLINE_AUTHORITY_FIXTURE.replace('4998/4998', '4997/4998')).length > 0 &&
    offlineCandidateAuthorityProblems(
      CURRENT_OFFLINE_AUTHORITY_FIXTURE.replace(CURRENT_OFFLINE_PACKAGE_SHA256, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')).length > 0 &&
    offlineCandidateAuthorityProblems(
      CURRENT_OFFLINE_AUTHORITY_FIXTURE + ' The pushed implementation is uncommitted and pending independent read-only review and full verification.').length > 0 &&
    offlineCandidateAuthorityProblems(
      CURRENT_OFFLINE_AUTHORITY_FIXTURE + ' R8 GO has been issued for the pushed implementation.').length > 0 &&
    offlineCandidateAuthorityProblems(
      CURRENT_OFFLINE_AUTHORITY_FIXTURE + ' The d786 implementation is deployed and Current.').length > 0);

  const antiStaleDocs = [
    ...currentStatusDocs,
    'README.md',
    'AGENTS.md',
    'CLAUDE.md',
    'docs/deployment.md',
    'docs/demo-script.md',
    'docs/security-checklist.md',
    'docs/test-evidence.md',
  ];
  const authoritativeText = antiStaleDocs.map((name) => docs[name]).join('\n');
  ok('authoritative docs contain no pre-0019 migration-current claims',
    !/(0014|0015|0016|0017|0018|0019) should not exist|STATE 001[7-9] PENDING|(?:migration\s+001[7-9]|001[7-9]\s+migration)[^\n]{0,50}(pending|unapplied)/i.test(authoritativeText));
  ok('authoritative docs contain no obsolete topology, additive-CCS label, or August 1 current-pointer',
    !/(52[^\n]{0,30}(directed )?edges|26[^\n]{0,30}(reverse )?pairs|20-node\s*\/\s*48-edge|24-pair graph|present additive CCS candidate|override the August 1 status above)/i.test(authoritativeText));

  // Narrow stale-status predicate (M12.P1-D5 corrective). The previous broad
  // proximity regex `RF\.1[^\n]{0,80}(active|current)` falsely matched the
  // truthful sentence "RF.1 through RF.6 are complete and Codex GO. The current
  // BE.6-frozen selected-demo graph ...", where "current" modifies the graph,
  // not RF.1. This predicate flags ONLY explicit stale status DECLARATIONS:
  // RF.1 declared the active/current section, or Milestone 12 named as the next
  // section. Neutral/historical RF.1 mentions and "the current <thing>" phrases
  // are accepted.
  function declaresStaleStatus(value) {
    const t = String(value == null ? '' : value);
    return (
      // "RF.1 is/remains/stays [the] [currently] active/current"
      /RF\.1\s+(?:is|remains|stays)\s+(?:the\s+)?(?:currently\s+)?(?:active|current)\b/i.test(t) ||
      // "RF.1: active" / "RF.1: current"
      /RF\.1\s*:\s*(?:the\s+)?(?:active|current)\b/i.test(t) ||
      // "the active/current section is RF.1"
      /\b(?:the\s+)?(?:active|current)\s+section\s+is\s+RF\.1\b/i.test(t) ||
      // "Milestone 12 [is] [the] next"
      /\bMilestone\s+12\s+(?:is\s+)?(?:the\s+)?next\b/i.test(t)
    );
  }

  // Named fixtures: deliberately stale declarations MUST be detected; truthful
  // and neutral wording MUST NOT be. These pin the predicate boundary so a
  // future broadening/narrowing is caught here, independent of live docs.
  const STALE_STATUS_STALE_FIXTURES = [
    ['RF.1 is active.', 'RF.1 is active.'],
    ['RF.1: current.', 'RF.1: current.'],
    ['RF.1 remains the active section.', 'RF.1 remains the active section.'],
    ['The active section is RF.1.', 'The active section is RF.1.'],
    ['Milestone 12 is next.', 'Milestone 12 is next.'],
    ['Milestone 12 next.', 'Milestone 12 next.'],
  ];
  const STALE_STATUS_OK_FIXTURES = [
    ['truthful RF.1-RF.6 complete + "The current BE.6-frozen"',
      'RF.1 through RF.6 are complete and Codex GO. The current BE.6-frozen selected-demo graph has 20 route nodes.'],
    ['RF.1-RF.6 complete; M12.P1 is the next gated section',
      'RF.1-RF.6 are complete; M12.P1 is the next gated pilot-readiness section.'],
    ['neutral historical RF.1 reference',
      'RF.1 defined the road-geometry contract and is complete and Codex GO.'],
  ];
  for (const [name, text] of STALE_STATUS_STALE_FIXTURES) {
    ok('docs-current predicate flags stale declaration fixture: ' + name, declaresStaleStatus(text) === true);
  }
  for (const [name, text] of STALE_STATUS_OK_FIXTURES) {
    ok('docs-current predicate accepts truthful fixture: ' + name, declaresStaleStatus(text) === false);
  }

  // Real-document scan over the same authoritative doc set (per-document to
  // avoid cross-file boundary matches); same failure label as before.
  const staleStatusDoc = antiStaleDocs.find((name) => declaresStaleStatus(docs[name]));
  ok('authoritative docs do not reactivate RF.1 or name Milestone 12 as next', !staleStatusDoc);

  /* ---- R3 status consistency ----
     R3 and its session-hygiene/ownership/import-detector follow-ups are
     complete and Codex GO. Documentation must not retain pre-GO wording, claim
     R3 is still next/unimplemented, imply that R4 has started, or imply that
     R3 GO authorizes deployment/pilot readiness. */
  function declaresStaleR3(value) {
    const t = String(value == null ? '' : value).replace(/\s+/g, ' ');
    return (
      // "R3 is NEXT" / "R3 ... is NEXT" / "why R3 is NEXT"
      /\bR3\b[^.]{0,60}\bis\s+(the\s+)?NEXT\b/i.test(t) ||
      /\bR3\b[^.]{0,60}\bis the next (code-edit|implementation|executable)\b/i.test(t) ||
      // INVERSE phrasing: "The next implementation section is R3"
      /\bthe next (implementation|code-edit|executable)\s+section\s+is\s+R3\b/i.test(t) ||
      /\bnext (potential )?section\s+is\s+R3\b/i.test(t) ||
      // "R3 as the exact next potential section"
      /\bR3\b\s+as\s+the\s+(exact\s+)?next\b/i.test(t) ||
      // Still awaiting a first implementation
      /\bR3\b[^.]{0,80}\b(remains unimplemented|is not yet implemented|awaiting its first (execution|implementation))\b/i.test(t) ||
      /\bR3\b[^.]{0,80}\brequires (its own|a separate) execution prompt\b/i.test(t) ||
      /* Pre-GO R3 status that is now stale. TEMPERED so a later section marker
         ends the span: "the current R3 status (complete and Codex GO), the
         current R4 status (implemented and awaiting independent Codex review)"
         describes R4, not R3, and must not be flagged. */
      /\bR3\b(?:(?!\bR[4-8]\b)[^.]){0,200}?\bawaiting independent Codex review\b/i.test(t) ||
      /\bR3\b(?:(?!\bR[4-8]\b)[^.]){0,200}?\bno (?:Codex )?GO is claimed\b/i.test(t) ||
      /\bR3\b(?:(?!\bR[4-8]\b)[^.]){0,100}?\b(has not received|has not yet received|lacks)\b[^.]{0,40}\bGO\b/i.test(t) ||
      /\bR4\b[^.]{0,120}\b(blocked|unauthorized)\b[^.]{0,120}\b(pending|until)\b[^.]{0,120}\b(R3|review)\b/i.test(t) ||
      // R4 may not begin without its separate execution authorization
      /\bR4\b[^.]{0,80}\b(may|can)\s+begin\b[^.]{0,100}\bwithout\b[^.]{0,100}\b(prompt|authorization)\b/i.test(t) ||
      /* FORWARD-LOOKING plans that still START the remaining work at R3. R3 is
         complete and Codex GO, so any "remaining sequence/order" or execution
         instruction beginning at R3 is a false-green: the per-document status
         banner can be correct while the plan section below it still tells the
         next session to execute R3. Deliberately narrow — it matches only
         forward-looking sequence/order statements and execution instructions,
         never a historical description of the completed R3 work. */
      /\bremaining\b[^.]{0,40}\b(sequence|order)\b[^.]{0,40}\bR3\b/i.test(t) ||
      /\b(sequence|order)\s+is:?\s*R3\b/i.test(t) ||
      /\b(execute|run|implement)\s+only\s+R3\b/i.test(t) ||
      /\b(execute|run|implement)\s+R3\b[^.]{0,60}\b(and stop|and then|first|next)\b/i.test(t) ||
      /\bcontinue\b[^.]{0,30}\bR3\b[^.]{0,30}\bthrough\b[^.]{0,20}\bR[4-7]\b/i.test(t)
    );
  }
  /* R3 closure is now proven by the R3 clause ALONE. The former R4
     "next / not started / separate execution prompt" clauses moved into the
     dedicated R4 predicates below, because R4 has since been implemented and
     that wording is now itself the stale claim. */
  function declaresClosedR3(value) {
    const t = String(value == null ? '' : value).replace(/\s+/g, ' ');
    return /\bR3\b[\s\S]{0,300}\b(complete|completed)\b[\s\S]{0,100}\bCodex GO\b/i.test(t);
  }

  /* ---- current M12.P1 authority consistency ----
     R1-R7, D1-D7, OFF.1-OFF.6, and the final R8 lifecycle are complete. The
     accepted technical Production baseline is deployed and pilot review is
     owner-accepted. Final Milestone 12 acceptance remains an independent
     closeout decision, the verified implementation is pushed, and promotion or
     deployment remains separately owner-authorized.

     Each authority document carries one delimited CURRENT block. Validating
     only that block prevents historical candidate evidence and the future-state
     instructions inside the canonical R5 prompt from masquerading as current
     status, while a separate forward-looking scan still catches stale
     superseded R5 and premature R7 instructions elsewhere. */
  const CURRENT_M12_STATUS_START = '<!-- M12.P1 CURRENT STATUS START -->';
  const CURRENT_M12_STATUS_END = '<!-- M12.P1 CURRENT STATUS END -->';

  function currentM12Status(value) {
    const text = String(value == null ? '' : value);
    const starts = text.split(CURRENT_M12_STATUS_START).length - 1;
    const ends = text.split(CURRENT_M12_STATUS_END).length - 1;
    if (starts !== 1 || ends !== 1) return null;
    const start = text.indexOf(CURRENT_M12_STATUS_START) + CURRENT_M12_STATUS_START.length;
    const end = text.indexOf(CURRENT_M12_STATUS_END, start);
    if (end < start) return null;
    return text.slice(start, end).replace(/^>\s?/gm, '').replace(/\s+/g, ' ').trim();
  }

  /* RETARGETED FOR ACCEPTED TECHNICAL PRODUCTION AUTHORITY.
     R1-R7, D1-D5, and expanded D7 must remain complete and Codex GO; accepted
     R7/D7 evidence, the completed R8 lifecycle, current Production baseline,
     and future manual-promotion boundary must all remain explicit. */
  function declaresR7GoAuthority(value) {
    const t = String(value == null ? '' : value).replace(/\s+/g, ' ');
    return (
      /\bR1-R7\b[\s\S]{0,180}\b(?:and\s+)?D1-D5\b[\s\S]{0,160}\b(?:and\s+)?(?:expanded\s+)?D7\b[\s\S]{0,160}\b(complete|completed)\b[\s\S]{0,100}\bCodex GO\b/i.test(t) &&
      /\bdependency-security remediation\b/i.test(t) &&
      recordsCurrentDependencyRemediation(t) &&
      /\bM12\.P1-R7\b[\s\S]{0,180}\b(?:complete|completed)\b[\s\S]{0,100}\bCodex GO\b/i.test(t) &&
      recordsAcceptedR7Evidence(t) &&
      recordsAcceptedD7Evidence(t) &&
      currentGitLifecycleProblems(t).length === 0 &&
      !/\bR5\b[^.]{0,180}\b(?:next|not started|unimplemented|awaiting independent Codex (?:re-)?review|no (?:R5 )?(?:Codex )?GO)\b/i.test(t) &&
      !/\bR6\b[^.]{0,180}\b(?:next|not started|unimplemented|awaiting independent Codex (?:re-)?review)\b/i.test(t) &&
      !/\bno\s+R6\s+(?:Codex\s+)?GO\s+is\s+claimed\b/i.test(t) &&
      !/\bR7\b[^.]{0,180}\bnext owner-authorized code section\b/i.test(t) &&
      !/\bR7\b[^.]{0,180}\b(?:implemented|correction candidate)\b[^.]{0,180}\bawaiting independent Codex (?:re-)?review\b/i.test(t) &&
      !/\bno\s+R7\s+(?:Codex\s+)?GO\s+is\s+claimed\b/i.test(t) &&
      !/\bR7\b\s+(?:may|can)\s+begin\b/i.test(t) &&
      !/\b(?:expanded\s+)?D7\b[^.]{0,180}\bblocked by R7 Codex GO\b/i.test(t) &&
      !/\b(?:expanded\s+)?D7\b[^.]{0,160}\b(?:next potential section|not started|awaiting independent Codex (?:re-)?review|no (?:D7 )?(?:Codex )?GO|is authorized|may begin|has started)\b/i.test(t) &&
      !/\bno\s+(?:expanded\s+)?D7\s+(?:Codex\s+)?GO\s+is\s+claimed\b/i.test(t) &&
      !/\bR8\b(?:\s+is)?\s+(?:authorized|may\s+begin|has\s+started|complete|completed)\b/i.test(t)
    );
  }

  /* Fenced blocks quote prompts and commands verbatim; they are transcript, not
     live authority prose. The delimited CURRENT STATUS block is never fenced,
     so stripping fences keeps the stale-instruction scan aimed at the document's
     own statements instead of the historical prompt it archives. */
  function stripFencedBlocks(value) {
    return String(value == null ? '' : value)
      .replace(/^~~~[\s\S]*?^~~~/gm, '\n')
      .replace(/^```[\s\S]*?^```/gm, '\n');
  }

  /* Forward-looking instructions that are stale after accepted D7 Codex GO, or
     that prematurely authorize R8. Candidate/no-GO D7 wording, D7 blocked by
     R7, and "D7 is next/not started" are now stale. */
  function declaresStalePostR7GoInstruction(value) {
    const blocks = stripFencedBlocks(value)
      .split(/\r?\n\s*\r?\n/)
      .map((block) => block.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    return blocks.some((block) => {
      // Explicitly historical/superseded evidence is a record, not authority.
      if (/\b(historical|superseded|candidate evidence|at that candidate stage)\b/i.test(block)) {
        return false;
      }
      return (
        /\bR5\b[^.]{0,180}\b(?:next|not started|unimplemented|awaiting independent Codex (?:re-)?review|no (?:R5 )?(?:Codex )?GO)\b/i.test(block) ||
        /\bnext\b[^.]{0,80}\bsection\b[^.]{0,40}\b(?:is|will be)\s+R5\b/i.test(block) ||
        /\bR6\b[^.]{0,180}\bblocked\b[^.]{0,140}\b(?:R4|R5)\b/i.test(block) ||
        /\bR6\b[^.]{0,180}\b(?:next|not started|unimplemented|awaiting independent Codex (?:re-)?review)\b/i.test(block) ||
        /\bno\s+R6\s+(?:Codex\s+)?GO\s+is\s+claimed\b/i.test(block) ||
        /\bnext\b[^.]{0,80}\bsection\b[^.]{0,40}\b(?:is|will be)\s+R6\b/i.test(block) ||
        /\bR7\b[^.]{0,180}\bblocked\b[^.]{0,100}\bR6(?:\s+Codex)?\s+GO\b/i.test(block) ||
        /\bR7\b[^.]{0,180}\bnext owner-authorized code section\b/i.test(block) ||
        /\bR7\b[^.]{0,180}\b(?:is|remains)\s+(?:the\s+)?next\b/i.test(block) ||
        /\bR7\b[^.]{0,180}\b(?:is not started|is unimplemented|has not started)\b/i.test(block) ||
        /\bnext\b[^.]{0,80}\bsection\b[^.]{0,40}\b(?:is|will be)\s+R7\b/i.test(block) ||
        /\bR7\b[^.]{0,180}\b(?:implemented|correction candidate)\b[^.]{0,180}\bawaiting independent Codex (?:re-)?review\b/i.test(block) ||
        /\bno\s+R7\s+(?:Codex\s+)?GO\s+is\s+claimed\b/i.test(block) ||
        /\b(?:expanded\s+)?D7\b[^.]{0,180}\b(?:next potential section|not started|unimplemented|awaiting independent Codex (?:re-)?review|no (?:D7 )?(?:Codex )?GO|blocked by R7 Codex GO)\b/i.test(block) ||
        /\bno\s+(?:expanded\s+)?D7\s+(?:Codex\s+)?GO\s+is\s+claimed\b/i.test(block) ||
        /\b(?:expanded\s+)?D7\b[^.]{0,120}\b(?:is\s+authorized|may\s+begin|has\s+started)\b/i.test(block) ||
        /\bR8\b(?:\s+is)?\s+(?:authorized|may\s+begin|has\s+started|complete|completed)\b/i.test(block) ||
        /\b(?:execute|run|implement)\s+only\s+R5\b/i.test(block)
      );
    });
  }

  function declaresStalePostR4Instruction(value) {
    const blocks = String(value == null ? '' : value)
      .split(/\r?\n\s*\r?\n/)
      .map((block) => block.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    return blocks.some((block) => {
      /* Historical/candidate blocks are evidence, not authority. The delimited
         current block above is still validated independently and cannot use
         this exemption. */
      if (/\b(historical|superseded|first R4 submission|candidate evidence|at that candidate stage)\b/i.test(block)) {
        return false;
      }
      return (
        /\bR4\b[^.]{0,180}\bimplemented\b[^.]{0,180}\bawaiting independent Codex (re-)?review\b/i.test(block) ||
        /\bR5\b[^.]{0,180}\bblocked\b[^.]{0,120}\bR4\b/i.test(block) ||
        /\bafter R4 (Codex )?GO\b/i.test(block) ||
        /\bremaining\b[^.]{0,60}\b(sequence|order)\b[^.]{0,40}\bR4\b/i.test(block) ||
        /\b(sequence|order)\s+is:?\s*R4\b/i.test(block)
      );
    });
  }
  /* M12.P1-R8. THREE stale-authority forms passed every predicate above while
     naming an already-completed section as live authority. Each is matched here
     as a precise shape, because a word scan for "prompt" or "sequence" would
     also match the corrected prose that explicitly REVOKES spent-prompt
     authority — the exact false positive that has cost this gate two red runs.

     Form 1 — a spent, NAMED prompt asserted as a current grant of authority
       ("the canonical R7 prompt in CLAUDE_HANDOFF.md grants exactly that
        limited exception"; "Only the canonical current R6 execution prompt ...
        authorizes R6 work"). The shape is: canonical + R<n> + prompt, followed
        within one sentence by an affirmative grants/authorizes verb. Prose that
        says a spent or archived prompt authorizes NOTHING does not match,
        because it never names "canonical R<n> prompt".

     Form 2 — a remaining-sequence statement anchored on a section at or before
       R7, which is stale now that R3-R7 and expanded D7 are complete. R8 is
       deliberately excluded so the correct statement stays green.

     Form 3 — an "R<a> through R<b> are complete" roll-up whose upper bound
       stops at or before R6, which understates the accepted state and reads as
       authority that the next section is the one after R<b>. */
  function declaresSpentPromptAuthority(value) {
    return stripFencedBlocks(value)
      .split(/\r?\n\s*\r?\n/)
      .map((block) => block.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .some((block) => (
        /* `(?:[^.]|\.(?=\S)){0,N}` instead of `[^.]{0,N}`: the live stale prose
           reads "the canonical R7 prompt in `CLAUDE_HANDOFF.md` grants …", and a
           plain [^.] window stops dead at the period inside `.md`, so the
           original predicate silently matched nothing. This form still refuses
           to cross a real sentence boundary (". " or a trailing "."), because
           only a period followed by a NON-space is allowed through. */
        /\bcanonical\s+(?:current\s+)?R[0-9]+\s+(?:execution\s+)?prompt\b(?:[^.]|\.(?=\S)){0,140}\b(?:grants|authorizes|authorises)\b/i.test(block) ||
        /\bremaining\s+(?:sequence|order)\b(?:[^.]|\.(?=\S)){0,60}\b(?:is|begins\s+(?:at|with))\s+R[1-7]\b/i.test(block) ||
        /\bR[1-9]\s+through\s+R[1-6]\b(?:[^.]|\.(?=\S)){0,80}\b(?:are|is)\s+complete\b/i.test(block)
      ));
  }

  function keepsM12P1NoGo(value) {
    const t = String(value == null ? '' : value).replace(/\s+/g, ' ');
    const legacyNoGo = /\bM12\.P1\b[\s\S]{0,240}\bNO-GO\b/i.test(t);
    const closeoutPending = /\bfinal Milestone 12\b[\s\S]{0,220}\b(?:not self-issued|remains external|awaits? (?:one )?independent|latest independent external closeout report controls)\b/i.test(t);
    return (legacyNoGo || closeoutPending) &&
      (/\b(?:deployment|push|promotion)\b[\s\S]{0,260}\b(?:not authorized|must not|requires?[^.]{0,120}separate owner)\b/i.test(t) ||
       hasPrePresentationReleaseDenial(t));
  }

  /* M12.P1-R8: the Vercel checklist must name EVERY fail-closed profile entry.
     An operator following an incomplete list gets a fixed sanitized refusal —
     safe, but it burns a deploy cycle, and the list silently drifted once the
     R4 shared-store variables were added. Pinned here, independently of the
     document, so the doc alone cannot redefine "complete". */
  const REQUIRED_VERCEL_PROFILE_KEYS = Object.freeze([
    'NODE_ENV', 'SESSION_STORE', 'AUTH_DATA_SOURCE', 'CONTENT_DATA_SOURCE',
    'BUILDING_DATA_SOURCE', 'ROUTE_DATA_SOURCE', 'VR_DATA_SOURCE',
    'SCHEDULE_DATA_SOURCE', 'MAP_RENDERER', 'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY', 'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN', 'RATE_LIMIT_KEY_SECRET',
  ]);
  const REQUIRED_VERCEL_SEPARATE_KEYS = Object.freeze([
    'SESSION_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI',
  ]);

  function vercelChecklistIsComplete(doc) {
    const t = String(doc == null ? '' : doc);
    return REQUIRED_VERCEL_PROFILE_KEYS.every((k) => new RegExp('`' + k + '`').test(t)) &&
      REQUIRED_VERCEL_SEPARATE_KEYS.every((k) => new RegExp('`' + k + '`').test(t)) &&
      /\/auth\/callback\b/.test(t) &&
      /\bGoogle Form\b/i.test(t);
  }

  /* M12.P1-R8: superseded audits stay in the repository as history, but each
     must open with an explicit banner so a fresh session cannot ground on its
     stale status lines. */
  const HISTORICAL_AUDIT_BANNER = 'HISTORICAL AUDIT — NOT CURRENT AUTHORITY';
  function carriesHistoricalAuditBanner(doc) {
    // Must appear in the opening region, not buried in an appendix.
    return String(doc == null ? '' : doc).slice(0, 2000).includes(HISTORICAL_AUDIT_BANNER);
  }

  /* PURE: evidence documents must publish the accepted R7 closeout and keep
     both earlier full-suite candidates explicitly historical/superseded. */
  function recordsAcceptedR7Evidence(value) {
    return recordsAcceptedR7EvidenceText(value);
  }

  /* PURE: evidence/status prose must publish accepted D7 closeout evidence. */
  function recordsAcceptedD7Evidence(value) {
    return recordsAcceptedD7EvidenceText(value);
  }

  // Named fixtures pin the predicate boundary independently of live prose.
  /* The first four fixtures are the EXACT phrasings that were live in the
     handoffs and slipped past the earlier predicate — each is pinned so the
     inverse/recap wording can never regress unnoticed. */
  const STALE_R3_FIXTURES = [
    ['R3 awaits independent review', 'M12.P1-R3 is implemented and awaiting independent Codex review.'],
    ['R3 has no GO claim', 'M12.P1-R3 is implemented; no Codex GO is claimed.'],
    ['R3 has not received GO', 'M12.P1-R3 has not received GO.'],
    ['R4 blocked by the old R3 review', 'R4 is unauthorized until the independent review of R3 issues GO.'],
    ['the next implementation section is R3 (CODEX_HANDOFF recap)',
      '- The next implementation section is R3. Expanded D7 is intentionally deferred until R3-R7 have received Codex GO.'],
    ['R3 as the exact next potential section',
      '6. R3 as the exact next potential section, explicitly labelled as not authorized by this context-only prompt.'],
    ['R3 is the next code-edit section', 'R3: Awaited Vercel Runtime is the next code-edit section.'],
    ['R3 remains unimplemented', 'R3 remains unimplemented pending scheduling.'],
    ['R4 may begin without a prompt', 'R4 may begin without a separate execution prompt.'],
    /* Forward-looking plans that still start the remaining work at R3. These
       are the EXACT stale forms that were live in CODEX_HANDOFF.md,
       CLAUDE_HANDOFF.md, AGENTS.md, and CLAUDE.md while every per-document
       status banner already read as correct. */
    ['remaining sequence starts at R3 (CODEX_HANDOFF form)',
      '- The remaining sequence is: R3, R4, R5, R6, and R7 one section at a time; expanded D7 and Codex GO; read-only R8.'],
    ['remaining pre-pilot sequence starts at R3 (AGENTS/CLAUDE form)',
      'The remaining pre-pilot sequence is R3, R4, R5, R6, R7, expanded D7, then R8.'],
    ['Remaining Sequence heading instructs executing only R3 (CLAUDE_HANDOFF form)',
      '## Remaining Sequence\n1. Under a separate execution prompt, execute only R3 and stop for independent Codex review.'],
    ['continue R3 through R7 one at a time',
      'Continue R3 through R7 one section at a time after each preceding Codex GO.'],
    ['remaining order starts at R3', 'The remaining implementation order is R3, R4, R5.'],
  ];
  /* Canonical CURRENT authority: accepted milestones and deployment baseline,
     the verified/pushed d786 implementation, the clean-commit R8 NO-GO solely
     for stale authority, and the later correction/release boundaries. */
  const CANONICAL_R7_GO_STATUS =
    'M12.P1-R3 and all follow-ups are complete and Codex GO. ' +
    'M12.P1 R1-R7, D1-D5, and expanded D7 are complete and Codex GO. ' +
    'Dependency-security remediation is complete and Codex GO. ' +
    'Following the accepted 2026-07-22 dependency closeout, a subsequent 2026-07-26 npm advisory drift is remediated: production pins ejs@6.0.1, the jake/filelist/minimatch/brace-expansion chain is absent, and npm audit --omit=dev reports zero vulnerabilities. ' +
    'M12.P1-R6 is complete and Codex GO. ' +
    'M12.P1-R7 is complete and Codex GO. ' +
    'Accepted R7 evidence is focused 71/71, in-suite vercel-package-boundary 70/70, full suite 3495/3495 with QUALITY-GATES OK, and npm audit --omit=dev at zero vulnerabilities. ' +
    'The 3492/3492 initial candidate and 3494/3494 literal-NUL remediation are historical/superseded. ' +
    'M12.P1-D7 is complete and Codex GO. Accepted D7 evidence is the fresh-context role-isolation rerun: separate Playwright BrowserContext objects with no storage carryover, both MySQL and Supabase legs completed and cleaned up through supported application interfaces, npm test 3511/3511 with QUALITY-GATES OK, npm audit --omit=dev zero vulnerabilities, and postconditions 24/24 -> 18/18 -> 46/46 with fingerprint a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d unchanged. ' +
    'The Guided-VR runtime/catalog remediation remains recorded as 43627cf0a77741556f4e701711e55612a739799b, tree eb3e830f68d537c4a54d6dda6df7d52a61f9c87b. The final R8 authority synchronization is committed and pushed as fea3b2e11c6331eddc1ee091b165427d8e0218d7. Production serves fea3b2e11c6331eddc1ee091b165427d8e0218d7 as the current technical Production baseline. ' +
    'The separately authorized push automatically triggered Vercel Production. Post-deployment verification passed within bounded anonymous read-only GET-only scope. Auto-assign Custom Production Domains is disabled; future main deployments require manual promotion. Historical/superseded: before this deployment, Production served 0627bf78228148e3f989275810c333c16a1f3356. ' +
    'The documentation/static-assertion-only authority synchronization db05b549807535840968bf28cdefac4154a6d59d is committed and pushed. Owner-observed Vercel evidence shows it Ready, Production, Staged, with custom-domain assignment Skipped. It was not promoted or made Current, and fea3b2e11c6331eddc1ee091b165427d8e0218d7 remained on the live alias. ' +
    'The owner attests that a human pilot occurred on 2026-08-05 and accepts it with zero reported findings. Participant/Form evidence remains external. The tested build full source-commit identity was not independently verified. Pilot review is complete for sequencing purposes. OFF.2-OFF.6 are complete and Codex GO on local commit cdbc863b779e5319c14dee21a31a5e78951e233c. D6 is complete and Codex GO on local commit 691f0bef40e06b6ea9485e713d2fe3000a03bd83. The service worker is v25. The simplified fallback keeps the route decorative and exposes buildings as labelled native HTML buttons with exact 44-by-44 targets. The exact 19-file implementation was independently fully verified at 4998/4998 with QUALITY-GATES OK, five-stage QA, bounded Chrome acceptance in both supported backends, and ordered postconditions 24/24 -> 18/18 -> 46/46. It was committed as d786bdcb83a196c7263dceae668417d3ced3e95a and pushed to origin/main. The committed implementation manifest SHA-256 92c689b884f52021f5545f331e8768ffc4768914cf9320c2d4b8fedee7020642 covered 19 files and 2,072,400 bytes. The package pin is 168 files, 7,073,128 bytes, aggregate SHA-256 1d6cc68b7ef350b6a61eb8d84ea4fb7dd6862bd8548beb7595d3f2e6f4b10d6a. The clean-commit independent R8 review returned NO-GO solely because stale operative lifecycle authority described the pushed, verified commit as uncommitted and pending; no separate runtime, security, database, or package blocker was found. The documentation/static-assertion correction is a separate byte set whose lifecycle and disposition are controlled by live Git and the latest independent external review report. Final Milestone 12 disposition remains external. No promotion or deployment is authorized.';
  /* Superseded states retained only as negative fixtures. */
  const SUPERSEDED_R7_CANDIDATE_STATUS =
    'M12.P1-R3 and all follow-ups are complete and Codex GO. ' +
    'M12.P1 R1-R6 and D1-D5 are complete and Codex GO. ' +
    'Dependency-security remediation is complete and Codex GO. ' +
    'M12.P1-R6 is complete and Codex GO. ' +
    'M12.P1-R7 is implemented and awaiting independent Codex review. No R7 GO is claimed. ' +
    'Expanded D7 is not started and remains blocked by R7 Codex GO. ' +
    'M12.P1 remains NO-GO for deployment and pilot readiness; deployment is not authorized.';
  const SUPERSEDED_R7_READY_STATUS =
    'M12.P1-R3 and all follow-ups are complete and Codex GO. ' +
    'M12.P1 R1-R5 and D1-D5 are complete and Codex GO. ' +
    'Dependency-security remediation is complete and Codex GO. ' +
    'M12.P1-R6 is complete and Codex GO. ' +
    'R7 is the next owner-authorized code section and is not started. ' +
    'M12.P1 remains NO-GO for deployment and pilot readiness; deployment is not authorized.';
  const SUPERSEDED_R6_CANDIDATE_STATUS =
    'M12.P1-R3 and all follow-ups are complete and Codex GO. ' +
    'M12.P1 R1-R5 and D1-D5 are complete and Codex GO. ' +
    'Dependency-security remediation is complete and Codex GO. ' +
    'M12.P1-R6 is implemented and awaiting independent Codex review. No R6 GO is claimed. ' +
    'R7 is not started and remains blocked by R6 Codex GO. ' +
    'M12.P1 remains NO-GO for deployment and pilot readiness; deployment is not authorized.';
  const SUPERSEDED_R6_NEXT_STATUS =
    'M12.P1-R3 and all follow-ups are complete and Codex GO. ' +
    'M12.P1 R1-R5 and D1-D5 are complete and Codex GO. ' +
    'Dependency-security remediation is complete and Codex GO. ' +
    'R6 is the next owner-authorized code section and is not started. ' +
    'R7 remains blocked by R6 Codex GO. ' +
    'M12.P1 remains NO-GO for deployment and pilot readiness; deployment is not authorized.';
  /* The exact R5-candidate authority wording, retained only as a stale
     fixture: it was true before independent R5 GO and must now be rejected. */
  const SUPERSEDED_R5_CANDIDATE_STATUS =
    'M12.P1-R4 and dependency-security remediation are complete and Codex GO. ' +
    'M12.P1-R5 is implemented and awaiting independent Codex review. No R5 GO is claimed. ' +
    'R6 is not started and remains blocked by R5 Codex GO. ' +
    'M12.P1 remains NO-GO for deployment and pilot readiness; deployment is not authorized.';
  const TRUTHFUL_R3_FIXTURES = [
    ['R1-R7/D1-D5/D7 complete + accepted R7 and D7 Codex GO', CANONICAL_R7_GO_STATUS],
    /* Historical descriptions of the COMPLETED R3 work, and a forward-looking
       sequence that correctly stops at the read-only R8 review, must all stay
       accepted. */
    ['historical R3 contract description',
      'R3 established one shared single-flight session-readiness promise and is complete and Codex GO. R4, R5, R6, R7, expanded D7, and dependency-security remediation are complete and Codex GO. M12.P1-R8 is the next potential section and is read-only. M12.P1 remains NO-GO; deployment is not authorized.'],
    ['remaining sequence correctly starts at read-only R8',
      'R3 through R7 and expanded D7 are complete and Codex GO. Dependency-security remediation is complete and Codex GO. M12.P1-R8 is the next potential section and is read-only; R8 is not authorized by this synchronization. M12.P1 remains NO-GO; deployment is not authorized.'],
    ['historical note that R3 was executed and closed',
      'The session that executed R3 is complete and Codex GO. R4, R5, R6, R7, expanded D7, and dependency-security remediation are complete and Codex GO. R8 is the next read-only review. M12.P1 remains NO-GO; deployment is not authorized.'],
  ];
  for (const [name, text] of STALE_R3_FIXTURES) {
    ok('docs-current R3 predicate flags stale fixture: ' + name, declaresStaleR3(text) === true);
  }
  for (const [name, text] of TRUTHFUL_R3_FIXTURES) {
    ok('docs-current R3 predicate accepts truthful fixture: ' + name,
      declaresStaleR3(text) === false && declaresClosedR3(text) === true && keepsM12P1NoGo(text) === true);
  }

  // Post-R4 boundaries, pinned independently of live prose.
  const STALE_POST_R4_FIXTURES = [
    ['R4 still awaiting review',
      'R4 is implemented and awaiting independent Codex review.'],
    ['R5 still blocked by R4',
      'R5 is not started and remains blocked by R4 Codex GO.'],
    ['forward-looking after R4 GO',
      'After R4 Codex GO, continue with R5.'],
    ['remaining sequence still begins at R4',
      'The remaining sequence is R4, R5, R6, R7, expanded D7, then R8.'],
  ];
  for (const [name, text] of STALE_POST_R4_FIXTURES) {
    ok('docs-current post-R4 predicate flags stale instruction fixture: ' + name,
      declaresStalePostR4Instruction(text) === true);
  }
  ok('docs-current post-R4 scan accepts explicitly historical candidate evidence',
    declaresStalePostR4Instruction(
      'Historical candidate evidence: R4 was implemented and awaiting independent Codex review.'
    ) === false);

  const canonicalDelimitedStatus =
    CURRENT_M12_STATUS_START + '\n' + CANONICAL_R7_GO_STATUS + '\n' + CURRENT_M12_STATUS_END;
  ok('docs-current status extractor accepts exactly one ordered marker pair',
    currentM12Status(canonicalDelimitedStatus) === CANONICAL_R7_GO_STATUS);
  ok('docs-current status extractor rejects missing markers',
    currentM12Status(CANONICAL_R7_GO_STATUS) === null);
  ok('docs-current status extractor rejects duplicate markers',
    currentM12Status(canonicalDelimitedStatus + '\n' + canonicalDelimitedStatus) === null);
  ok('docs-current status extractor rejects inverse marker order',
    currentM12Status(CURRENT_M12_STATUS_END + '\n' + CANONICAL_R7_GO_STATUS + '\n' + CURRENT_M12_STATUS_START) === null);

  /* ---- accepted D7-GO authority boundaries, pinned independently ---- */
  ok('docs-current D7-GO predicate accepts the canonical status',
    declaresR7GoAuthority(CANONICAL_R7_GO_STATUS) === true);
  ok('docs-current D7-GO predicate rejects superseded R7-next and candidate states',
    declaresR7GoAuthority(SUPERSEDED_R7_READY_STATUS) === false &&
    declaresR7GoAuthority(SUPERSEDED_R7_CANDIDATE_STATUS) === false);
  ok('docs-current D7-GO predicate rejects the superseded R6-candidate status',
    declaresR7GoAuthority(SUPERSEDED_R6_CANDIDATE_STATUS) === false &&
    declaresR7GoAuthority(SUPERSEDED_R6_NEXT_STATUS) === false);
  ok('docs-current D7-GO predicate rejects the superseded R5 candidate status',
    declaresR7GoAuthority(SUPERSEDED_R5_CANDIDATE_STATUS) === false);
  ok('docs-current D7-GO predicate rejects the former R4 candidate state',
    declaresR7GoAuthority(
      'R4 is implemented and awaiting independent Codex review. R5 is blocked by R4.'
    ) === false);
  ok('docs-current D7-GO predicate rejects stale R7 candidate/no-GO wording',
    declaresR7GoAuthority(CANONICAL_R7_GO_STATUS + ' M12.P1-R7 is implemented and awaiting independent Codex review.') === false &&
    declaresR7GoAuthority(CANONICAL_R7_GO_STATUS + ' No R7 GO is claimed.') === false);
  ok('docs-current D7-GO predicate rejects stale D7 or premature R8 promotion',
    declaresR7GoAuthority(CANONICAL_R7_GO_STATUS + ' Expanded D7 is the next potential section and is not started.') === false &&
    declaresR7GoAuthority(CANONICAL_R7_GO_STATUS + ' No D7 GO is claimed.') === false &&
    declaresR7GoAuthority(CANONICAL_R7_GO_STATUS + ' R8 may begin.') === false);
  ok('docs-current D7-GO predicate rejects a status that drops the R1-R7/D7 aggregate GO',
    declaresR7GoAuthority(
      CANONICAL_R7_GO_STATUS.replace('M12.P1 R1-R7, D1-D5, and expanded D7 are complete and Codex GO. ', '')
    ) === false);
  ok('docs-current D7-GO predicate rejects a status that drops R7 GO',
    declaresR7GoAuthority(
      CANONICAL_R7_GO_STATUS.replace('M12.P1-R7 is complete and Codex GO. ', '')
    ) === false);
  ok('docs-current D7-GO predicate rejects a status that drops accepted R7/D7 evidence or the R8 lifecycle clause',
    declaresR7GoAuthority(
      CANONICAL_R7_GO_STATUS.replace('Accepted R7 evidence is focused 71/71, in-suite vercel-package-boundary 70/70, full suite 3495/3495 with QUALITY-GATES OK, and npm audit --omit=dev at zero vulnerabilities. ', '')
    ) === false &&
    declaresR7GoAuthority(
      CANONICAL_R7_GO_STATUS.replace('M12.P1-D7 is complete and Codex GO. Accepted D7 evidence is the fresh-context role-isolation rerun: separate Playwright BrowserContext objects with no storage carryover, both MySQL and Supabase legs completed and cleaned up through supported application interfaces, npm test 3511/3511 with QUALITY-GATES OK, npm audit --omit=dev zero vulnerabilities, and postconditions 24/24 -> 18/18 -> 46/46 with fingerprint a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d unchanged. ', '')
    ) === false &&
    declaresR7GoAuthority(
      CANONICAL_R7_GO_STATUS.replace('The separately authorized push automatically triggered Vercel Production. Post-deployment verification passed within bounded anonymous read-only GET-only scope. Auto-assign Custom Production Domains is disabled; future main deployments require manual promotion. Historical/superseded: before this deployment, Production served 0627bf78228148e3f989275810c333c16a1f3356. ', '')
    ) === false);

  const STALE_POST_R6_FIXTURES = [
    ['R5 candidate awaiting review', SUPERSEDED_R5_CANDIDATE_STATUS],
    ['pre-R5 "R5 is the next owner-authorized section"', 'R5 is the next owner-authorized section.'],
    ['pre-R5 "R5 is not started"', 'M12.P1-R5 is not started at this handoff.'],
    ['R6 still blocked by R5', 'R6 is not started and remains blocked by R5 Codex GO.'],
    ['superseded "R6 is the next owner-authorized code section"',
      'R6 is the next owner-authorized code section and is not started.'],
    ['superseded "the next section is R6"', 'The next implementation section is R6.'],
    ['superseded R6 candidate', SUPERSEDED_R6_CANDIDATE_STATUS],
    ['superseded R7 blocked-by-R6 wording', 'R7 is not started and remains blocked by R6 Codex GO.'],
    ['superseded R7-next authority', SUPERSEDED_R7_READY_STATUS],
    ['superseded "R7 is the next owner-authorized code section"',
      'R7 is the next owner-authorized code section and is not started.'],
    ['superseded "the next section is R7"', 'The next implementation section is R7.'],
    ['superseded "R7 is not started"', 'M12.P1-R7 is not started at this handoff.'],
    ['superseded R7 candidate awaiting review', SUPERSEDED_R7_CANDIDATE_STATUS],
    ['superseded D7 pre-GO wording', 'M12.P1-D7 is implemented and awaiting independent Codex review. No D7 GO is claimed. Expanded D7 is the next potential section, is not started, and remains blocked by R7 Codex GO.'],
    ['stale execution instruction', 'Execute only R5 and stop for independent Codex review.'],
  ];
  for (const [name, text] of STALE_POST_R6_FIXTURES) {
    ok('docs-current post-R6 predicate flags stale fixture: ' + name,
      declaresStalePostR7GoInstruction(text) === true);
  }
  ok('docs-current post-D7-GO predicate accepts the canonical status',
    declaresStalePostR7GoInstruction(CANONICAL_R7_GO_STATUS) === false);
  ok('docs-current post-D7-GO predicate accepts truthful R7/D7 GO and R8 read-only-next wording',
    declaresStalePostR7GoInstruction(
      'M12.P1-R7 is complete and Codex GO.'
    ) === false &&
    declaresStalePostR7GoInstruction(
      'M12.P1-D7 is complete and Codex GO.'
    ) === false &&
    declaresStalePostR7GoInstruction(
      'M12.P1-R8 is the next potential section and is read-only; R8 is not authorized by this synchronization.'
    ) === false);
  ok('docs-current post-R7 predicate accepts explicitly historical evidence',
    declaresStalePostR7GoInstruction(
      'Historical pre-R5 authority: R5 was the next owner-authorized section and was not started.'
    ) === false &&
    declaresStalePostR7GoInstruction(
      'Superseded R6 candidate evidence: R6 was implemented and awaiting independent Codex review.'
    ) === false &&
    declaresStalePostR7GoInstruction(
      'Superseded pre-R7 authority: R7 was the next owner-authorized code section and was not started.'
    ) === false);
  ok('docs-current fenced-block stripper removes archived prompt text from the scan',
    declaresStalePostR7GoInstruction(
      '~~~text\nM12.P1-R6 is the next owner-authorized code section; it is not started.\n~~~\n'
    ) === false &&
    declaresStalePostR7GoInstruction(
      '~~~text\nR7 is the next owner-authorized code section and is not started.\n~~~\n'
    ) === false &&
    declaresStalePostR7GoInstruction(
      'M12.P1-R5 is the next owner-authorized code section; it is not started.'
    ) === true);

  /* ---- M12.P1-R8 spent-prompt / stale-roll-up fixtures ----
     The first three are the EXACT phrasings that were live in plan.md and
     CODEX_HANDOFF.md and passed every earlier predicate. The rejecting cases
     below them pin the corrected prose so the new predicate can never be
     "fixed" by weakening it back into a word scan. */
  const SPENT_PROMPT_AUTHORITY_FIXTURES = [
    ['spent R7 prompt grants plan.md authority',
      'Claude must not revise `plan.md` unless the current explicit execution prompt grants a narrow status-only synchronization; the canonical R7 prompt in `CLAUDE_HANDOFF.md` grants exactly that limited exception.'],
    ['spent R6 prompt authorizes current work',
      'Only the canonical current R6 execution prompt in `CLAUDE_HANDOFF.md` authorizes R6 work.'],
    ['spent R5 prompt grants the narrow exception',
      'The canonical R5 prompt grants that narrow exception only after green verification.'],
    ['remaining sequence anchored on the completed R7',
      'R3 through R6 are complete and Codex GO. The remaining sequence is R7, one section at a time after each independent GO.'],
    ['remaining sequence anchored on R5',
      'The remaining sequence is R5, then R6, then R7.'],
    ['stale R3-through-R6 completion roll-up',
      'R3 through R6 are complete and Codex GO.'],
  ];
  for (const [name, text] of SPENT_PROMPT_AUTHORITY_FIXTURES) {
    ok('docs-current spent-prompt predicate flags stale fixture: ' + name,
      declaresSpentPromptAuthority(text) === true);
  }
  const SPENT_PROMPT_ACCEPTED_FIXTURES = [
    ['corrected plan.md revocation prose',
      'Only the current owner prompt can grant that exception, and it grants it for that one execution: an archived or spent prompt reproduced anywhere in this repository, including under a historical heading in either handoff, confers no authority to edit `plan.md` or to begin any section.'],
    ['corrected anti-scope revocation prose',
      'Only the current explicit owner execution prompt authorizes work; an archived or spent prompt reproduced under a historical heading in either handoff authorizes nothing.'],
    ['correct R8-anchored remaining sequence',
      'The remaining sequence is R8 read-only review -> separate owner deployment decision -> pilot review -> OFF.2-OFF.5 -> D6 -> OFF.6 -> M12.P2 final closeout.'],
    ['correct R8-anchored sequence, "begins at" form',
      'R3 through R7 and expanded D7 are complete and Codex GO. The remaining sequence begins at the read-only R8 review.'],
    ['accepted R1-R7 roll-up using a hyphen range',
      'R1-R7, D1-D5, and expanded D7 are complete and Codex GO.'],
  ];
  for (const [name, text] of SPENT_PROMPT_ACCEPTED_FIXTURES) {
    ok('docs-current spent-prompt predicate accepts current fixture: ' + name,
      declaresSpentPromptAuthority(text) === false);
  }
  // A spent prompt reproduced INSIDE an archived fenced block is history, not
  // authority, so fence stripping must keep it out of the scan.
  ok('docs-current spent-prompt predicate ignores an archived fenced prompt',
    declaresSpentPromptAuthority(
      '~~~text\nOnly the canonical current R6 execution prompt authorizes R6 work.\n~~~\n') === false);

  const m12StatusDocs = [
    'CODEX_HANDOFF.md', 'CLAUDE_HANDOFF.md', 'plan.md', 'ROADMAP.md',
    'AGENTS.md', 'CLAUDE.md',
  ];
  const currentM12Statuses = [];
  /* PER-DOCUMENT validation. Joining the documents would let one truthful
     banner mask a stale declaration elsewhere — exactly the false green that
     let four live stale phrasings survive. Each status document must
     independently be free of stale declarations AND carry the truthful
     status. */
  for (const name of m12StatusDocs) {
    ok(`${name} contains no stale pre-GO or "R3 is next/unimplemented" declaration`,
      !declaresStaleR3(docs[name]));
    ok(`${name} records R3 complete and Codex GO`,
      declaresClosedR3(docs[name]));
    const status = currentM12Status(docs[name]);
    currentM12Statuses.push(status);
    ok(`${name} carries exactly one ordered M12.P1 current-status block`,
      status !== null);
    ok(`${name} current status records R1-R7/D1-D5/D7 GO, accepted evidence, and completed Production lifecycle`,
      status !== null && declaresR7GoAuthority(status));
    ok(`${name} current status keeps final closeout external and deployment/promotion separately authorized`,
      status !== null && keepsM12P1NoGo(status));
    ok(`${name} current status records the exact matrix and post-deployment Git/promotion lifecycle`,
      status !== null &&
      currentCandidateVerificationProblems(status, EXPECTED_CURRENT_QUALITY_TOTAL).length === 0 &&
      currentGitLifecycleProblems(status).length === 0);
    ok(`${name} contains no stale forward-looking post-R4 instruction`,
      !declaresStalePostR4Instruction(docs[name]));
    ok(`${name} contains no stale pre-D7-GO authority or premature lifecycle promotion`,
      !declaresStalePostR7GoInstruction(docs[name]));
    ok(`${name} names no spent prompt as current authority and no stale lifecycle sequence`,
      !declaresSpentPromptAuthority(docs[name]));
  }
  ok('all current authority blocks and the evidence ledger preserve one transcript-faithful rejected-run account',
    currentM12Statuses.every((status) =>
      status !== null && rejectedVerificationHistoryProblems(status).length === 0) &&
    rejectedVerificationHistoryProblems(docs['docs/test-evidence.md']).length === 0 &&
    ['docs/deployment.md', 'docs/security-checklist.md', 'docs/test-evidence.md']
      .every((name) => currentGitLifecycleProblems(docs[name]).length === 0) &&
    operativePlanLifecycleProblems(docs['plan.md']).length === 0);

  /* Post-deployment authority: the guide must retain the COMPLETE Vercel checklist. */
  ok('docs/deployment.md lists all 14 fail-closed profile entries plus SESSION_SECRET, the OAuth trio, the /auth/callback URI, and the Google Form',
    vercelChecklistIsComplete(docs['docs/deployment.md']));
  ok('fixture: a checklist missing RATE_LIMIT_KEY_SECRET is flagged',
    vercelChecklistIsComplete(
      docs['docs/deployment.md'].split('`RATE_LIMIT_KEY_SECRET`').join('`RATE_LIMIT_REDACTED`')) === false);
  ok('fixture: a checklist missing the /auth/callback URI is flagged',
    vercelChecklistIsComplete(
      docs['docs/deployment.md'].split('/auth/callback').join('/auth/redacted')) === false);
  ok('docs/deployment.md records completed verification and post-deployment authority',
    currentCandidateVerificationProblems(
      docs['docs/deployment.md'], EXPECTED_CURRENT_QUALITY_TOTAL).length === 0);
  /* Historical pre-push lifecycle body retained only for negative fixtures. */
  const LEGACY_LIFECYCLE_OK =
    'Production serves ' + EXPECTED_SEC51_DEPLOYED_BASELINE +
    ' as the current technical Production baseline. ' +
    'The separately authorized push automatically triggered Vercel Production. ' +
    'Post-deployment verification passed within bounded anonymous read-only GET-only scope. ' +
    'Auto-assign Custom Production Domains is disabled; future main deployments require manual promotion. ' +
    'The documentation/static-assertion-only authority synchronization ' + EXPECTED_CURRENT_AUTHORITY_COMMIT +
    ' is committed and pushed. Owner-observed Vercel evidence shows it Ready, Production, Staged, with custom-domain assignment Skipped. ' +
    'It was not promoted or made Current, and ' + EXPECTED_SEC51_DEPLOYED_BASELINE + ' remained on the live alias. ' +
    'The owner attests that a human pilot occurred on 2026-08-05 and accepts it with zero reported findings. ' +
    'Participant/Form evidence remains external. The tested build full source-commit identity was not independently verified. ' +
    'Pilot review is complete for sequencing purposes. OFF.2-OFF.6 are complete and Codex GO on local commit cdbc863b779e5319c14dee21a31a5e78951e233c. D6 is complete and Codex GO on local commit 691f0bef40e06b6ea9485e713d2fe3000a03bd83. The service worker is v25. The simplified fallback keeps the route decorative and exposes buildings as labelled native HTML buttons with exact 44-by-44 targets. The pre-authority-sync manifest SHA-256 494010dd9d1aadb43c2d124543c302d97bece118b8c687109ccd6e2624ed0610 covered 19 files and 2,020,639 bytes. Focused evidence only is OFF.2 145/145, offline 2D 35/35, and package boundary 74/74. The unchanged package identity is 168 files, 7,073,128 bytes, aggregate SHA-256 1d6cc68b7ef350b6a61eb8d84ea4fb7dd6862bd8548beb7595d3f2e6f4b10d6a. No npm test, npm run qa, ordered 24/24 -> 18/18 -> 46/46 postconditions, or browser acceptance was run for those exact bytes. That manifest is predecessor evidence; recompute the live manifest instead of reusing it. The current uncommitted 19-file offline UI/accessibility/package correction candidate is pending independent read-only review and full verification. The current uncommitted 19-file offline UI/accessibility/package correction candidate claims no new Codex GO, commit readiness, deployment readiness, or final Milestone 12 GO. Final Milestone 12 disposition remains external. The local commits and current candidate must not be pushed, promoted, or deployed before the presentation and a later explicit owner decision. ' +
    'Historical/superseded: before this deployment, Production served ' +
    EXPECTED_SEC51_PREVIOUS_BASELINE + '.';
  const LIFECYCLE_OK =
    'Production serves ' + EXPECTED_SEC51_DEPLOYED_BASELINE + ' as the current technical Production baseline. ' +
    'The separately authorized push automatically triggered Vercel Production. Post-deployment verification passed within bounded anonymous read-only GET-only scope. ' +
    'Auto-assign Custom Production Domains is disabled; future main deployments require manual promotion. ' +
    'The documentation/static-assertion-only authority synchronization ' + EXPECTED_CURRENT_AUTHORITY_COMMIT + ' is committed and pushed. Owner-observed Vercel evidence shows it Ready, Production, Staged, with custom-domain assignment Skipped. It was not promoted or made Current, and ' + EXPECTED_SEC51_DEPLOYED_BASELINE + ' remained on the live alias. ' +
    'The owner attests that a human pilot occurred on 2026-08-05 and accepts it with zero reported findings. Participant/Form evidence remains external. The tested build full source-commit identity was not independently verified. Pilot review is complete for sequencing purposes. OFF.2-OFF.6 are complete and Codex GO on local commit cdbc863b779e5319c14dee21a31a5e78951e233c. D6 is complete and Codex GO on local commit 691f0bef40e06b6ea9485e713d2fe3000a03bd83. ' +
    'The exact 19-file offline UI/accessibility/package implementation was independently fully verified at 4998/4998 with QUALITY-GATES OK, five-stage QA, bounded Chrome acceptance in both supported backends, and ordered postconditions 24/24 -> 18/18 -> 46/46. The implementation d786bdcb83a196c7263dceae668417d3ced3e95a is committed and pushed to origin/main. ' +
    'The clean-commit independent R8 review returned NO-GO solely for stale operative lifecycle authority; no separate runtime, security, database, or package blocker was found. Final Milestone 12 disposition remains external and no promotion or deployment is authorized.';
  ok('fixture: verification, staged authority, and pilot lifecycle accept current authority and reject stale, missing, or contradictory authority',
    currentCandidateVerificationProblems(
      'The exact synchronized candidate passes npm test at 4641/4641 with QUALITY-GATES OK and npm run qa at the same exact contract total with all five stages green. Final ordered postconditions are 24/24 -> 18/18 -> 46/46. Live Git and the latest external review report control the later commit/push/R8 disposition.',
      4641).length === 0 &&
    currentCandidateVerificationProblems(
      'The exact synchronized candidate passes npm test at 4641/4641 with QUALITY-GATES OK and npm run qa at the same exact contract total with all five stages green. Final ordered postconditions remain pending. Live Git and the latest external review report control the later commit/push/R8 disposition.',
      4641).length > 0 &&
    currentCandidateVerificationProblems(
      'The exact synchronized candidate passes npm test at 4641/4641 with QUALITY-GATES OK and npm run qa at the same exact contract total with all five stages green. Final ordered postconditions are 24/24 -> 18/18 -> 46/46. Live Git and the latest external review report control the later commit/push/R8 disposition. The next boundary is owner-directed resolution of session-residue findings.',
      4641).length > 0 &&
    currentGitLifecycleProblems(LIFECYCLE_OK).length === 0 &&
    currentGitLifecycleProblems(
      LIFECYCLE_OK + ' The current worktree is intentionally dirty and unstaged.').length > 0 &&
    currentGitLifecycleProblems(
      LIFECYCLE_OK + ' Nothing from this candidate has been committed or pushed.').length > 0 &&
    currentGitLifecycleProblems(
      LIFECYCLE_OK + ' The Guided-VR candidate is uncommitted and unpushed.').length > 0 &&
    currentGitLifecycleProblems(
      LIFECYCLE_OK.replace('automatically triggered Vercel Production', 'was pushed')).length > 0 &&
    operativePlanLifecycleProblems(
      '<!-- M12.P1-R8 HISTORICAL EXECUTION RECORD START -->\n**HISTORICAL/SUPERSEDED snapshot; not current authority.** db034e5581e6f409083a43dcb80fb82b473e0127\n<!-- M12.P1-R8 HISTORICAL EXECUTION RECORD END -->\nCurrent requirements only.').length === 0 &&
    operativePlanLifecycleProblems(
      '<!-- M12.P1-R8 HISTORICAL EXECUTION RECORD START -->\n**HISTORICAL/SUPERSEDED snapshot; not current authority.** db034e5581e6f409083a43dcb80fb82b473e0127\n<!-- M12.P1-R8 HISTORICAL EXECUTION RECORD END -->\n**Current correction candidate.** The present 12-file working tree remains unstaged and uncommitted.').length > 0 &&
    currentGitLifecycleProblems(
      LIFECYCLE_OK.replace('Auto-assign Custom Production Domains is disabled; future main deployments require manual promotion.', 'Auto-assign Custom Production Domains is enabled.')).length > 0 &&
    currentGitLifecycleProblems(
      LIFECYCLE_OK.replace(EXPECTED_SEC51_DEPLOYED_BASELINE, EXPECTED_SEC51_PREVIOUS_BASELINE)).length > 0 &&
    currentGitLifecycleProblems(
      LIFECYCLE_OK + ' The separately authorized push did not automatically trigger Vercel Production.').length > 0 &&
    currentGitLifecycleProblems(
      LIFECYCLE_OK + ' Post-deployment verification failed.').length > 0 &&
    currentGitLifecycleProblems(
      LIFECYCLE_OK + ' Auto-assign Custom Production Domains is enabled.').length > 0 &&
    currentGitLifecycleProblems(
      LIFECYCLE_OK + ' Future main deployments do not require manual promotion.').length > 0 &&
    currentGitLifecycleProblems(
      LIFECYCLE_OK + ' Human pilot evidence remains open.').length > 0 &&
    currentGitLifecycleProblems(
      LIFECYCLE_OK + ' The tested build identity was independently verified.').length > 0 &&
    currentGitLifecycleProblems(
      LIFECYCLE_OK.replace('zero reported findings', 'one reported finding')).length > 0 &&
    currentGitLifecycleProblems(
      LIFECYCLE_OK.replace('It was not promoted or made Current', 'It was promoted and made Current')).length > 0 &&
    currentGitLifecycleProblems(
      LIFECYCLE_OK + ' Historical/superseded: before the setting change, Auto-assign Custom Production Domains was enabled.').length === 0);
  const REJECTED_HISTORY_OK =
    'Historical/rejected: a freshly counted suite attempt stopped at its 20-minute wrapper bound and produced no completion count. ' +
    'The bounded retry exited 1 at 4,628 PASS with nine current-authority wording failures and the residue failure from one orphaned canonical MySQL student session. ' +
    'Separately, an earlier green QA command had an enclosing scorer that returned 97 because it searched for nonexistent SUPABASE-SMOKE OK instead of the actual [supabase-smoke] PASS marker.';
  ok('fixture: transcript-faithful rejected-run history is accepted while stale counts and marker/timeout drift are rejected',
    rejectedVerificationHistoryProblems(REJECTED_HISTORY_OK).length === 0 &&
    rejectedVerificationHistoryProblems(
      REJECTED_HISTORY_OK.replace('nine current-authority wording failures', 'seven documentation failures')).length > 0 &&
    rejectedVerificationHistoryProblems(
      REJECTED_HISTORY_OK.replace('[supabase-smoke] PASS', 'SUPABASE-SMOKE OK')).length > 0 &&
    rejectedVerificationHistoryProblems(
      REJECTED_HISTORY_OK.replace('produced no completion count', 'completed successfully')).length > 0);

  /* M12.P1-R8: superseded audits must announce themselves as history. */
  for (const name of ['CODEBASE_REMEDIATION_PLAN.md', 'fable5_security_bugs_report.md']) {
    const body = readIf(name);
    ok(`${name} is present and opens with the historical-audit banner`,
      body.length > 0 && carriesHistoricalAuditBanner(body));
  }
  ok('fixture: a historical audit without the banner is flagged',
    carriesHistoricalAuditBanner('# Some Audit\n\nStatus: NEXT - NOT STARTED\n') === false);
  ok('fixture: a banner buried past the opening region is flagged',
    carriesHistoricalAuditBanner('x'.repeat(2100) + HISTORICAL_AUDIT_BANNER) === false);

  /* Evidence-only documents must stay CONSISTENT (no stale declaration) but are
     not required to repeat every milestone-status sentence. */
  for (const name of ['docs/deployment.md', 'docs/security-checklist.md', 'docs/test-evidence.md']) {
    // A missing/unreadable evidence document must FAIL rather than pass a
    // vacuous "contains no stale declaration" scan over an empty string.
    ok(`${name} is present, readable, and records accepted/superseded R7 evidence plus accepted D7 evidence`,
      docs[name].length > 0 &&
      recordsAcceptedR7Evidence(docs[name]) &&
      recordsAcceptedD7Evidence(docs[name]) &&
      recordsCurrentDependencyRemediation(docs[name]));
    ok(`${name} contains no stale R3 declaration`, !declaresStaleR3(docs[name]));
    ok(`${name} contains no stale forward-looking post-R4 instruction`,
      !declaresStalePostR4Instruction(docs[name]));
    ok(`${name} contains no stale pre-D7-GO authority or premature R8 promotion`,
      !declaresStalePostR7GoInstruction(docs[name]));
  }

  const m12StatusText = m12StatusDocs.map((name) => currentM12Status(docs[name]) || '').join('\n');
  ok('authoritative current-status blocks keep final closeout and release authority external',
    currentM12Statuses.every((status) => status !== null && keepsM12P1NoGo(status)));

  /* ---- the SPENT R7 execution prompt ----
     R7 later received independent Codex GO, but this fenced block remains
     non-executable historical authority. It must be archived under
     the historical heading exactly once, the "current" heading must be gone so
     the prompt cannot be replayed, and the archived body must still be the
     decision-complete authority the delivered work can be reviewed against. */
  {
    const liveR7Prompt = extractSpentR7ExecutionPrompt(claudeH);
    ok('CLAUDE_HANDOFF.md archives exactly one complete spent R7 execution prompt',
      liveR7Prompt !== null);
    ok('the archived R7 execution prompt is decision-complete and scope-bounded',
      liveR7Prompt !== null && r7ExecutionPromptIsValid(liveR7Prompt));
    ok('CLAUDE_HANDOFF.md no longer presents the R7 prompt as current authority',
      !claudeH.includes(SUPERSEDED_CURRENT_R7_PROMPT_HEADING));
    ok('CLAUDE_HANDOFF.md still archives the spent R6 execution prompt exactly once',
      claudeH.split('## Historical Spent One-Shot R6 Execution Prompt').length === 2);

    const F = '~~~';
    const R7_PROMPT_FIXTURE_BODY =
      'M12.P1-R7 — Vercel Package and Static-CDN Boundary\n' +
      'Work in C:\\Users\\FROST.GG\\Desktop\\CampuSphere v1.\n' +
      'This prompt explicitly authorizes only R7. R6 is complete and Codex GO. ' +
      'Do not begin expanded D7 or R8. Do not deploy or claim R7 GO. ' +
      'Stop after the final R7 candidate report. Do not spawn subagents. ' +
      'Use Context7 to verify current Vercel documentation. ' +
      'CURRENT EXECUTION PRECONDITION. Require safety 24/24, residue 18/18, and BE.6 46/46. ' +
      'If any precondition is not green, stop without editing. ' +
      'This prompt does not authorize session cleanup. ' +
      'package.json 8291bcba01370e529bc756dc122a4166d2b9ade1a9c1f0a81f5af2a00b5e5c4e. ' +
      'package-lock.json 88bd470464bf0fc4fb5dc5c371588db3a655c4b67cf8d82a0e0dea5e81f33d61. ' +
      'Create a root .vercelignore and begin with /*. Allow only server.js, package manifests, vercel.json, ' +
      'config, controllers, middleware, models, repositories, routes, services, utils, views, and public. ' +
      'Deny public/img/sample 360/**. Create a minimal root vercel.json. ' +
      'Use X-Content-Type-Options nosniff and Service-Worker-Allowed /. ' +
      'Preserve the Express nonce CSP. Add scripts/vercelPackageBoundary-probe.js and the ' +
      'vercel-package-boundary gate. Emit CURRENT DIRTY-WORKTREE BOUNDARY PREVIEW. ' +
      'Keep the probe standalone and not counted in npm test. ' +
      'No migration 0020 exists or is authorized. Do not change package.json or package-lock.json. ' +
      'Do not stage, commit, stash, reset, checkout, clean, revert. ' +
      'After green verification R7 becomes implemented and awaiting independent Codex review; ' +
      'no R7 GO is claimed. Expanded D7 remains blocked by R7 Codex GO. Stop after the report.';
    const r7Section = (body, kind) => {
      const block = F + 'text\n' + body + '\n' + F;
      if (kind === 'missing-heading') return '# Handoff\n\n' + block;
      if (kind === 'duplicate-heading') {
        return SPENT_R7_EXECUTION_PROMPT_HEADING + '\n\n' + block + '\n\n' +
          SPENT_R7_EXECUTION_PROMPT_HEADING + '\n\n' + block;
      }
      if (kind === 'unclosed') {
        return SPENT_R7_EXECUTION_PROMPT_HEADING + '\n\n' + F + 'text\n' + body;
      }
      if (kind === 'bare-open') {
        return SPENT_R7_EXECUTION_PROMPT_HEADING + '\n\n' + F + '\n' + body + '\n' + F;
      }
      if (kind === 'duplicate-block') {
        return SPENT_R7_EXECUTION_PROMPT_HEADING + '\n\n' + block + '\n\n' + block;
      }
      return SPENT_R7_EXECUTION_PROMPT_HEADING + '\n\n' + block;
    };

    ok('fixture: the archived R7 execution prompt extracts and validates',
      r7ExecutionPromptIsValid(
        extractSpentR7ExecutionPrompt(r7Section(R7_PROMPT_FIXTURE_BODY))
      ) === true);
    ok('fixture: missing/duplicate R7 heading fails extraction',
      extractSpentR7ExecutionPrompt(r7Section(R7_PROMPT_FIXTURE_BODY, 'missing-heading')) === null &&
      extractSpentR7ExecutionPrompt(r7Section(R7_PROMPT_FIXTURE_BODY, 'duplicate-heading')) === null);
    ok('fixture: unclosed/wrong/duplicate R7 fence fails extraction',
      extractSpentR7ExecutionPrompt(r7Section(R7_PROMPT_FIXTURE_BODY, 'unclosed')) === null &&
      extractSpentR7ExecutionPrompt(r7Section(R7_PROMPT_FIXTURE_BODY, 'bare-open')) === null &&
      extractSpentR7ExecutionPrompt(r7Section(R7_PROMPT_FIXTURE_BODY, 'duplicate-block')) === null);
    ok('fixture: an altered allowlist or sample-360 boundary fails validation',
      r7ExecutionPromptIsValid(R7_PROMPT_FIXTURE_BODY.replace('begin with /*', 'begin with *')) === false &&
      r7ExecutionPromptIsValid(R7_PROMPT_FIXTURE_BODY.replace('public/img/sample 360/**', 'public/img/**')) === false);
    ok('fixture: missing static-header proof or standalone R7 probe fails validation',
      r7ExecutionPromptIsValid(R7_PROMPT_FIXTURE_BODY.replace('Service-Worker-Allowed /', 'service worker header')) === false &&
      r7ExecutionPromptIsValid(R7_PROMPT_FIXTURE_BODY.replace('scripts/vercelPackageBoundary-probe.js', 'the focused probe')) === false);
    ok('fixture: missing clean-baseline precondition or cleanup boundary fails validation',
      r7ExecutionPromptIsValid(R7_PROMPT_FIXTURE_BODY.replace('Require safety 24/24, residue 18/18, and BE.6 46/46.', 'Assume the baseline is clean.')) === false &&
      r7ExecutionPromptIsValid(R7_PROMPT_FIXTURE_BODY.replace('This prompt does not authorize session cleanup.', 'Clear sessions if needed.')) === false &&
      r7ExecutionPromptIsValid(R7_PROMPT_FIXTURE_BODY.replace('If any precondition is not green, stop without editing.', 'Continue anyway.')) === false);
    ok('fixture: D7 promotion or a missing stop/deployment boundary fails validation',
      r7ExecutionPromptIsValid(R7_PROMPT_FIXTURE_BODY.replace('Expanded D7 remains blocked by R7 Codex GO.', 'Expanded D7 is authorized.')) === false &&
      r7ExecutionPromptIsValid(R7_PROMPT_FIXTURE_BODY.replace('Stop after the report.', 'Continue to D7.')) === false &&
      r7ExecutionPromptIsValid(R7_PROMPT_FIXTURE_BODY.replace('Do not deploy', 'Deploy after verification')) === false);
  }

  /* ---- reusable grounding prompts (post-deployment; grounding only) ----
     These fenced blocks are copy-paste guidance for the NEXT session, so unlike
     the archived prompts inside the handoffs they must always be current. They
     are validated by content, never skipped as fenced text. */
  {
    const promptsDoc = docs['docs/new-session-grounding-prompts.md'];
    ok('docs/new-session-grounding-prompts.md is present and readable', promptsDoc.length > 0);

    const livePrompts = extractReusablePrompts(promptsDoc);
    ok('docs/new-session-grounding-prompts.md exposes exactly one Codex and one Claude prompt block',
      livePrompts !== null);
    ok('the reusable Codex grounding prompt carries current grounding-only authority',
      livePrompts !== null && reusablePromptIsCurrent(livePrompts.codex) &&
      reusableCodexPromptHasWaitBoundary(livePrompts.codex));
    ok('the reusable Claude grounding prompt carries current grounding-only authority',
      livePrompts !== null && reusablePromptIsCurrent(livePrompts.claude) &&
      reusableClaudePromptHasWaitBoundary(livePrompts.claude));
    ok('docs/new-session-grounding-prompts.md records an Asia/Manila last-updated date',
      /^Last updated:\s*\d{4}-\d{2}-\d{2}\s*\(Asia\/Manila\)\s*$/m.test(promptsDoc));

    /* ---- fixtures: structure and content, pinned independently of the file ---- */
    const FENCE = '```';
    const H = REUSABLE_PROMPT_HEADINGS;
    /* Historical pre-correction body retained only as a rejecting fixture. It
       must never be used as current reusable-prompt authority. */
    const LEGACY_BODY =
      'Final Milestone 12 disposition remains external. R1-R7, D1-D5, and expanded D7 are complete and Codex GO. ' +
      'Dependency-security remediation is complete and Codex GO. ' +
      'Following the accepted 2026-07-22 dependency closeout, a subsequent 2026-07-26 npm advisory drift is remediated: production pins ejs@6.0.1, the jake/filelist/minimatch/brace-expansion chain is absent, and npm audit --omit=dev reports zero vulnerabilities. ' +
      'M12.P1-R6 is complete and Codex GO. ' +
      'This context-only prompt does not authorize implementation. ' +
      'M12.P1-R7 is complete and Codex GO. ' +
      'Accepted R7 evidence is focused 71/71, in-suite vercel-package-boundary 70/70, full suite 3495/3495 with QUALITY-GATES OK, and npm audit --omit=dev at zero vulnerabilities. ' +
      'The 3492/3492 initial candidate and 3494/3494 literal-NUL remediation are historical/superseded. ' +
      'M12.P1-D7 is complete and Codex GO. Accepted D7 evidence is the fresh-context role-isolation rerun: separate Playwright BrowserContext objects with no storage carryover, both MySQL and Supabase legs completed and cleaned up through supported application interfaces, npm test 3511/3511 with QUALITY-GATES OK, npm audit --omit=dev zero vulnerabilities, and postconditions 24/24 -> 18/18 -> 46/46 with fingerprint a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d unchanged. ' +
      'The Guided-VR runtime/catalog remediation remains recorded as 43627cf0a77741556f4e701711e55612a739799b, tree eb3e830f68d537c4a54d6dda6df7d52a61f9c87b. The final R8 authority synchronization is committed and pushed as fea3b2e11c6331eddc1ee091b165427d8e0218d7. Production at https://campusphere-cspc.vercel.app serves deployed technical Production baseline fea3b2e11c6331eddc1ee091b165427d8e0218d7. The separately authorized push automatically triggered Vercel Production. Post-deployment verification passed within bounded anonymous read-only GET-only scope. Auto-assign Custom Production Domains is disabled; future main deployments require manual promotion. The documentation/static-assertion-only authority synchronization db05b549807535840968bf28cdefac4154a6d59d is committed and pushed. Owner-observed Vercel evidence shows it Ready, Production, Staged, with custom-domain assignment Skipped. It was not promoted or made Current, and fea3b2e11c6331eddc1ee091b165427d8e0218d7 remained on the live alias. Historical/superseded: before this deployment, Production served 0627bf78228148e3f989275810c333c16a1f3356. ' +
      'The exact synchronized candidate passes npm test at 4998/4998 with QUALITY-GATES OK and npm run qa at the same exact contract total with all five stages green. Final ordered postconditions are 24/24 -> 18/18 -> 46/46. The first integrated read-only M12.P1-R8 review returned R8 NO-GO solely for stale operative Git-lifecycle wording. The follow-up commit, push, and R8 disposition are established only by live Git and the latest external review report; this repository snapshot makes no self-referential claim about those later events. ' +
      'The owner attests that a human pilot occurred on 2026-08-05 and accepts it with zero reported findings. Participant/Form evidence remains external. The tested build full source-commit identity was not independently verified. Pilot review is complete for sequencing purposes. OFF.2-OFF.6 are complete and Codex GO on local commit cdbc863b779e5319c14dee21a31a5e78951e233c. D6 is complete and Codex GO on local commit 691f0bef40e06b6ea9485e713d2fe3000a03bd83. The service worker is v25. The simplified fallback keeps the route decorative and exposes buildings as labelled native HTML buttons with exact 44-by-44 targets. The pre-authority-sync manifest SHA-256 494010dd9d1aadb43c2d124543c302d97bece118b8c687109ccd6e2624ed0610 covered 19 files and 2,020,639 bytes. Focused evidence only is OFF.2 145/145, offline 2D 35/35, and package boundary 74/74. The unchanged package identity is 168 files, 7,073,128 bytes, aggregate SHA-256 1d6cc68b7ef350b6a61eb8d84ea4fb7dd6862bd8548beb7595d3f2e6f4b10d6a. No npm test, npm run qa, ordered 24/24 -> 18/18 -> 46/46 postconditions, or browser acceptance was run for those exact bytes. That manifest is predecessor evidence; recompute the live manifest instead of reusing it. The current uncommitted 19-file offline UI/accessibility/package correction candidate is pending independent read-only review and full verification. The current uncommitted 19-file offline UI/accessibility/package correction candidate claims no new Codex GO, commit readiness, deployment readiness, or final Milestone 12 GO. Final Milestone 12 disposition remains external. The local commits and current candidate must not be pushed, promoted, or deployed before the presentation and a later explicit owner decision. This context-only prompt authorizes none of those actions. ' +
      'Deployment is not authorized by this prompt.';
    const CURRENT_AUTHORITY_SUPPLEMENT =
      'The release lineage is d786bdcb83a196c7263dceae668417d3ced3e95a -> c00db76c5be0fe9c8dfdc8168a4c4303c6a0aa64 -> bb17b9b603583bcc2934e3ffab1cbdcb7d6b0ddd -> dc961b1eeba191d79b96998d96f0a49dac3ffcf8. ' +
      'At the start of this authority synchronization, local HEAD, origin/main, and remote main matched dc961b1eeba191d79b96998d96f0a49dac3ffcf8. The index was empty; the worktree contained exactly 58 modified tracked paths and 12 untracked paths (70 dirty paths total), with zero stashes. Eleven authority documents plus scripts/quality-gates.js are the 12 tracked authority/static-assertion surfaces; the other 46 tracked paths and all 12 untracked paths belong to the current uncommitted implementation. Preserve this worktree exactly and recompute live Git truth. ' +
      'The independently reviewed bb17b9b authority delta covered 12 files and 1,854,481 bytes with manifest SHA-256 1c5ed249dd21894a2cb0871a04fc650deebfe2fa790b7e260d123415a4aa45c7. The release package pin is 168 files, 7,074,195 bytes, aggregate SHA-256 13cd3c5e5d8259766e50b1136c8cc8a5672b2321c65962892358c62b45ef88f5. ' +
      'Replacement verification completed with npm test exit 0 and QUALITY-GATES OK; npm run qa exited 0 with DB-PERF-GATE OK, [supabase-smoke] PASS, IDENTITY-CONSTRAINTS OK, and found 0 vulnerabilities; bounded Chrome acceptance completed in Supabase and MySQL modes; final ordered postconditions were 24/24 -> 18/18 -> 46/46. ' +
      'The clean-commit independent R8 review of bb17b9b603583bcc2934e3ffab1cbdcb7d6b0ddd returned GO with no critical, high, medium, or low findings. The owner authorized the bb17b9b push and manual Vercel promotion. Owner-observed Vercel evidence showed Ready, Production, main, and an 11-second build. Auto-assign Custom Production Domains is disabled; future main deployments require manual promotion. ' +
      'No independent anonymous GET-only post-promotion byte verification has been recorded for bb17b9b or dc961b1. fea3b2e11c6331eddc1ee091b165427d8e0218d7 is the last independently post-deployment-verified technical baseline; its smoke is not byte proof for either later commit. ' +
      'Production uses Supabase/PostgreSQL for application data and sessions; MySQL remains local-development/fallback/rehearsal data. A production offline-guide download is a backend-specific immutable snapshot of current Supabase building and route data and excludes 360/Guided-VR/Free-Roam content, schedules, building photos, Cloudinary media, and private/admin/session data. ' +
      'The readiness poll now uses /favicon.ico. The local cleanup destroyed 309 harness-shaped anonymous MySQL sessions with cleanup fingerprint SHA-256 a50b800e370439e0257cb7667d3fdb567af9dab88b87c3aeca6f32593598d18d and left zero candidates and zero scanned residue. Migration sources are contiguous through 0020; owner-applied 0020_room_schedule_documents.sql is recorded before this verification. Preserve one-writer control and external backup evidence: 109/109 manifest files verified and 86 referenced Cloudinary delivery assets hashed. ' +
      'The owner-attested human pilot occurred on 2026-08-05 with zero reported findings. Participant/Form evidence remains external, the tested build full source-commit identity was not independently verified, and pilot review is complete for sequencing. ' +
      'The owner supplied 29 official course titles for this application plus Other. Commit dc961b1 replaced the abbreviated selectors and added an accessible, case-insensitive course search to new-student OAuth registration completion and the existing student profile editor. Existing saved legacy course values remain visible until a student deliberately selects a new value. The submitted field remains course; controllers, repositories, APIs, database schema, and migrations did not change. The six-file commit recorded 433 insertions and 28 deletions. ' +
      'Course-feature verification recorded npm test exit 0 with QUALITY-GATES OK and five-stage npm run qa exit 0 with QUALITY-GATES OK, DB-PERF-GATE OK, [supabase-smoke] PASS, IDENTITY-CONSTRAINTS OK, and zero audit vulnerabilities. The package-boundary run passed 74/74 and reported a then-current working-tree package of 168 files, 7,088,275 bytes, aggregate SHA-256 9849e3c18c70e54a3502217275724367945ff176be22ce4d20796b5c103dc9ec. The working-tree package identity is not clean-commit or deployed-byte proof. The owner confirmed the registration and profile course flows work in Production; this is owner-observed functional acceptance, not independent review or byte smoke. ' +
      'Google OAuth is now owner-observed In production and requests only openid email profile. Google Data Access reported that sensitive or restricted-scope verification is not required, and the owner confirmed Google account creation and sign-in work. Branding is not verified; Search Console ownership for campussphere-cspc.vercel.app was not completed, and the owner chose to defer branding. Do not describe OAuth as verified or unlimited. Public local registration still creates guests only. ' +
      'The current 70-path worktree contains an uncommitted multi-feature stabilization candidate with valid Guided-VR and Free Roam scene arrows, VR light/dark theme parity, the offline display label Guard House, the authenticated notification feed/panel, the Paga About card, admin category-dropdown styling and user role/status filters, safe Google profile-image synchronization, and authenticated POST and DELETE /api/profile/photo. The manual flow targets CampuSphere/profile-images but is not accepted: the dedicated limited key lacks the required folder permission, the support response remains external and pending, and the temporary setup key is disabled. The owner-run scripts/syncSupabaseContentToMysql.js --dry-run preview reported no differences, No data was written, and both fingerprints were 2504a0474b0481964d447f5f538b9e4e1cd77ef0116c4299c12d0a81eae5bf05. The Android 8 installed-PWA crash remains unresolved and Docker/client-clone deployment readiness also remains deferred. A fresh session grounds first; a later separately authorized session verifies the non-Cloudinary changes. Cloudinary support remains an external event-based dependency; if no response has arrived, continue with verified non-Cloudinary findings one bounded issue at a time. Manual Cloudinary upload stays deferred. Grounding prompts do not themselves authorize tests. Missing current full QA, independent review, commit, push, deployment, and Production acceptance remain explicit. This authority authorizes no product implementation. Final Milestone 12 disposition remains external. ';
    const CURRENT_BODY =
      CURRENT_AUTHORITY_SUPPLEMENT
        .replace('The current 70-path worktree', 'The current uncommitted candidate is a stabilization candidate that includes the semester room-schedule image flow,')
        .replace('and authenticated POST and DELETE /api/profile/photo.', 'and removal of the manual profile-photo upload.')
        .replace(/ The manual flow targets[\s\S]*?temporary setup key is disabled\./, ' The candidate never calls Cloudinary management or upload APIs.') +
      'The current uncommitted candidate includes the semester room-schedule image flow, owner-applied 0020_room_schedule_documents.sql, admin-pasted Cloudinary delivery metadata, accessible image viewing, direct VR schedule-document links, valid Guided-VR and Free Roam scene arrows, VR light/dark theme parity, the offline display label Guard House, the authenticated notification feed/panel, the Paga About card, admin category-dropdown styling and user role/status filters, safe Google profile-image synchronization, and removal of the manual profile-photo upload. ' +
      'R1-R7, D1-D5, and expanded D7 are complete and Codex GO. Dependency-security remediation is complete and Codex GO: following the accepted 2026-07-22 dependency closeout, the subsequent 2026-07-26 npm advisory drift was remediated, production pins ejs@6.0.1, the jake/filelist/minimatch/brace-expansion chain is absent, and npm audit --omit=dev reports zero vulnerabilities. ' +
      'M12.P1-R6 is complete and Codex GO. This context-only prompt does not authorize implementation. M12.P1-R7 is complete and Codex GO. Accepted R7 evidence is focused 71/71, in-suite vercel-package-boundary 70/70, and full suite 3495/3495 with QUALITY-GATES OK; npm audit --omit=dev reports zero vulnerabilities, while 3492/3492 and 3494/3494 are historical/superseded. ' +
      'M12.P1-D7 is complete and Codex GO. Accepted D7 evidence is the fresh-context BrowserContext run at 3511/3511 with QUALITY-GATES OK, audit zero, and postconditions 24/24 -> 18/18 -> 46/46 with fingerprint a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d. ' +
      'The documentation/static-assertion correction is a separate byte set whose lifecycle and disposition are controlled by live Git and the latest independent external review report. Final ordered postconditions are 24/24 -> 18/18 -> 46/46. Final Milestone 12 disposition remains external. This context-only prompt authorizes none of those actions. Deployment is not authorized by this prompt.';

    // Stale in the PREVIOUS direction: R5 still described as awaiting review.
    const STALE_BODY = CURRENT_BODY.replace(
      'M12.P1-R6 is complete and Codex GO.',
      'R5 is implemented and awaiting independent Codex review; no R5 GO is claimed. R6 is blocked by R5 Codex GO.');
    // Stale R6 pre-implementation and candidate states.
    const R6_NEXT_BODY = CURRENT_BODY.replace(
      'M12.P1-R6 is complete and Codex GO.',
      'R6 is the next owner-authorized code section and is not started.');
    const R6_CANDIDATE_BODY = CURRENT_BODY.replace(
      'M12.P1-R6 is complete and Codex GO.',
      'M12.P1-R6 is implemented and awaiting independent Codex review; no R6 GO is claimed.');
    // Stale R7 pre-implementation and candidate states, now superseded by GO.
    const R7_NEXT_BODY = CURRENT_BODY.replace(
      'M12.P1-R7 is complete and Codex GO.',
      'R7 is the next owner-authorized code section and is not started.');
    const R7_CANDIDATE_BODY = CURRENT_BODY.replace(
      'M12.P1-R7 is complete and Codex GO.',
      'M12.P1-R7 is implemented and awaiting independent Codex review; no R7 GO is claimed.');
    // Stale D7 pre-GO and candidate states, now superseded by GO.
    const D7_NEXT_BODY = CURRENT_BODY.replace(
      'M12.P1-D7 is complete and Codex GO.',
      'Expanded D7 is the next potential section and is not started.');
    const D7_CANDIDATE_BODY = CURRENT_BODY.replace(
      'M12.P1-D7 is complete and Codex GO.',
      'M12.P1-D7 is implemented and awaiting independent Codex review; no D7 GO is claimed.');

    /* A SYNTHETIC deployed-baseline SHA, written as a literal here so no live
       file can supply it. It is neither the accepted production baseline nor
       the superseded one, so substituting it for the deployed-runtime SHA turns
       a truthful body into a false current deployment claim. Only that SHA is
       replaced; the repository-HEAD SHA is left intact. */
    const FAKE_DEPLOYED_SHA = '0f1e2d3c4b5a69788796a5b4c3d2e1f009182736';
    const WRONG_BASELINE_BODY = CURRENT_BODY.split(
      'fea3b2e11c6331eddc1ee091b165427d8e0218d7').join(FAKE_DEPLOYED_SHA);

    // kind: 'ok' | 'missing-heading' | 'duplicate-heading' | 'no-fence' |
    //       'unclosed' | 'duplicate-block' | 'empty' | 'bare-open' | 'js-open' |
    //       'json-open'
    const section = (heading, body, kind) => {
      if (kind === 'missing-heading') return '';
      const block = FENCE + 'text\n' + body + '\n' + FENCE;
      if (kind === 'duplicate-heading') return heading + '\n\n' + block + '\n\n' + heading + '\n\n' + block;
      if (kind === 'no-fence') return heading + '\n\n' + body;
      if (kind === 'unclosed') return heading + '\n\n' + FENCE + 'text\n' + body;
      if (kind === 'duplicate-block') return heading + '\n\n' + block + '\n\n' + block;
      if (kind === 'empty') return heading + '\n\n' + FENCE + 'text\n' + FENCE;
      // Invalid opening fences (two fence lines, but the opener is not ```text):
      if (kind === 'bare-open') return heading + '\n\n' + FENCE + '\n' + body + '\n' + FENCE;
      if (kind === 'js-open') return heading + '\n\n' + FENCE + 'javascript\n' + body + '\n' + FENCE;
      if (kind === 'json-open') return heading + '\n\n' + FENCE + 'json\n' + body + '\n' + FENCE;
      return heading + '\n\n' + block;
    };
    const buildDoc = (codexBody, claudeBody, codexKind, claudeKind) =>
      '# CampuSphere New Session Grounding Prompts\n\n' +
      'Last updated: 2026-08-21 (Asia/Manila)\n\n' +
      section(H.codex, codexBody, codexKind || 'ok') + '\n\n' +
      section(H.claude, claudeBody, claudeKind || 'ok') + '\n';

    ok('fixture: two current reusable prompts pass with production-baseline and manual-promotion authority',
      reusablePromptsAreCurrent(buildDoc(CURRENT_BODY, CURRENT_BODY)) === true &&
      /Auto-assign Custom Production Domains is disabled/.test(CURRENT_BODY) &&
      reusablePromptIsCurrent(CURRENT_BODY) === true &&
      declaresStaleOrPrematureAuthority(CURRENT_BODY) === false &&
      deploymentDocumentClaimsAreCurrent(CURRENT_BODY.replace(/\s+/g, ' ').trim()) === true &&
      FAKE_DEPLOYED_SHA !== EXPECTED_SEC51_DEPLOYED_BASELINE &&
      !EXPECTED_SEC51_SUPERSEDED_BASELINES.includes(FAKE_DEPLOYED_SHA) &&
      reusablePromptIsCurrent(WRONG_BASELINE_BODY) === false &&
      reusablePromptsAreCurrent(buildDoc(WRONG_BASELINE_BODY, CURRENT_BODY)) === false &&
      reusablePromptsAreCurrent(buildDoc(CURRENT_BODY, WRONG_BASELINE_BODY)) === false &&
      reusablePromptIsCurrent(LEGACY_BODY) === false);
    const CODEX_ROLE_OK = CURRENT_BODY + ' This is a fresh context-only grounding session that does not authorize implementation or review. Load and follow the installed code-reviewer skill. ' +
      'Do not perform a code review. Stop and wait for the owner. Never use direct SQL or infer that OFF.2 implementation, another pilot, offline work, or deployment is authorized.';
    const CLAUDE_ROLE_OK = CURRENT_BODY + ' This is a fresh context-only grounding session that does not authorize implementation. Load and follow the installed code-reviewer skill. ' +
      'Do not review, edit, test, implement, stage, commit, push, deploy, or perform an R8 review. After the grounding report, stop and wait for the owner. ' +
      'Do not infer that OFF.2 implementation, offline mode, deployment, or another pilot is authorized.';
    ok('fixture: reusable prompts reject completed-verification pending wording and stale session/remediation/role sequencing',
      reusablePromptIsCurrent(CURRENT_BODY.replace(
        'Final ordered postconditions are 24/24 -> 18/18 -> 46/46.',
        'Final ordered postconditions remain pending.')) === false &&
      reusablePromptIsCurrent(CURRENT_BODY +
        ' The next boundary is owner-directed resolution of session-residue findings.') === false &&
      reusablePromptIsCurrent(CURRENT_BODY.replace(
        'The documentation/static-assertion correction is a separate byte set whose lifecycle and disposition are controlled by live Git and the latest independent external review report.',
        'The independent commit-readiness review remains open.')) === false &&
      reusablePromptIsCurrent(CURRENT_BODY +
        ' The next boundary is an open independent commit-readiness review.') === false &&
      reusablePromptIsCurrent(CURRENT_BODY +
        ' The independent review is still required.') === false &&
      reusablePromptIsCurrent(CURRENT_BODY +
        ' The new independent review remains pending.') === false &&
      reusableCodexPromptHasWaitBoundary(CODEX_ROLE_OK) === true &&
      reusableClaudePromptHasWaitBoundary(CLAUDE_ROLE_OK) === true &&
      reusableCodexPromptHasWaitBoundary(CLAUDE_ROLE_OK) === false &&
      reusableClaudePromptHasWaitBoundary(CODEX_ROLE_OK) === false &&
      reusableCodexPromptHasWaitBoundary(CODEX_ROLE_OK.replace('Do not perform a code review.', 'Perform a code review.')) === false &&
      reusableCodexPromptHasWaitBoundary(CODEX_ROLE_OK.replace('Stop and wait for the owner.', 'Continue to implementation.')) === false &&
      reusableClaudePromptHasWaitBoundary(CLAUDE_ROLE_OK.replace('stop and wait for the owner', 'begin offline implementation')) === false &&
      reusableCodexPromptHasWaitBoundary(CODEX_ROLE_OK.replace('Never use direct SQL or infer that', 'Infer that')) === false &&
      reusableClaudePromptHasWaitBoundary(CLAUDE_ROLE_OK.replace('Do not infer that', 'Infer that')) === false &&
      reusableCodexPromptHasWaitBoundary(CODEX_ROLE_OK + ' OFF.2 implementation is authorized.') === false &&
      reusableClaudePromptHasWaitBoundary(CLAUDE_ROLE_OK + ' This prompt authorizes offline work.') === false &&
      reusableCodexPromptHasWaitBoundary(CODEX_ROLE_OK + ' Begin OFF.2 implementation now.') === false &&
      reusableClaudePromptHasWaitBoundary(CLAUDE_ROLE_OK + ' Deployment is automatically next.') === false);
    ok('fixture: a stale Codex prompt body fails (direct + inverse + qualified R5-next)',
      reusablePromptsAreCurrent(buildDoc(STALE_BODY, CURRENT_BODY)) === false &&
      reusablePromptsAreCurrent(buildDoc(CURRENT_BODY + ' The next implementation section is R5.', CURRENT_BODY)) === false &&
      reusablePromptsAreCurrent(buildDoc(CURRENT_BODY + ' R5 is the exact next potential section.', CURRENT_BODY)) === false &&
      reusablePromptsAreCurrent(buildDoc(CURRENT_BODY + ' The next owner-authorized section is R5.', CURRENT_BODY)) === false);
    ok('fixture: a stale Claude prompt body fails',
      reusablePromptsAreCurrent(buildDoc(CURRENT_BODY, STALE_BODY)) === false);
    ok('fixture: one current and one stale prompt fails (bodies are never joined)',
      reusablePromptsAreCurrent(buildDoc(CURRENT_BODY, STALE_BODY)) === false &&
      reusablePromptsAreCurrent(buildDoc(STALE_BODY, CURRENT_BODY)) === false);
    ok('fixture: leftover R6-next / not-started wording fails',
      reusablePromptIsCurrent(R6_NEXT_BODY) === false &&
      declaresStaleOrPrematureAuthority(R6_NEXT_BODY) === true &&
      reusablePromptsAreCurrent(buildDoc(R6_NEXT_BODY, CURRENT_BODY)) === false &&
      reusablePromptsAreCurrent(buildDoc(CURRENT_BODY, CURRENT_BODY + ' The next implementation section is R6.')) === false &&
      reusablePromptsAreCurrent(buildDoc(CURRENT_BODY, CURRENT_BODY + ' R6 is the exact next potential section.')) === false);
    ok('fixture: a leftover R6 candidate/no-GO state fails',
      reusablePromptIsCurrent(R6_CANDIDATE_BODY) === false &&
      declaresStaleOrPrematureAuthority(R6_CANDIDATE_BODY) === true &&
      reusablePromptsAreCurrent(buildDoc(R6_CANDIDATE_BODY, CURRENT_BODY)) === false &&
      reusablePromptsAreCurrent(buildDoc(CURRENT_BODY, CURRENT_BODY.replace('M12.P1-R6 is complete and Codex GO.', 'No R6 GO is claimed.'))) === false);
    ok('fixture: the required positive R6, R7, and D7 GO wording is accepted',
      declaresStaleOrPrematureAuthority('M12.P1-R6 is complete and Codex GO.') === false &&
      declaresStaleOrPrematureAuthority('M12.P1-R7 is complete and Codex GO.') === false &&
      declaresStaleOrPrematureAuthority('M12.P1-D7 is complete and Codex GO.') === false);
    ok('fixture: leftover R7-next / not-started wording now fails',
      reusablePromptIsCurrent(R7_NEXT_BODY) === false &&
      declaresStaleOrPrematureAuthority(R7_NEXT_BODY) === true &&
      reusablePromptsAreCurrent(buildDoc(R7_NEXT_BODY, CURRENT_BODY)) === false &&
      reusablePromptsAreCurrent(buildDoc(CURRENT_BODY, R7_NEXT_BODY)) === false &&
      reusablePromptsAreCurrent(buildDoc(CURRENT_BODY, CURRENT_BODY + ' The next implementation section is R7.')) === false);
    ok('fixture: a context-only body that directly authorizes R7 execution fails',
      reusablePromptsAreCurrent(buildDoc(CURRENT_BODY, CURRENT_BODY + ' Begin R7 now.')) === false &&
      reusablePromptsAreCurrent(buildDoc(CURRENT_BODY, CURRENT_BODY + ' Proceed to R7.')) === false &&
      reusablePromptsAreCurrent(buildDoc(CURRENT_BODY, CURRENT_BODY + ' R7 may begin now.')) === false);
    ok('fixture: stale R7/D7 candidate wording or R8 promotion fails',
      reusablePromptIsCurrent(R7_CANDIDATE_BODY) === false &&
      declaresStaleOrPrematureAuthority(R7_CANDIDATE_BODY) === true &&
      reusablePromptsAreCurrent(buildDoc(CURRENT_BODY, R7_CANDIDATE_BODY)) === false &&
      reusablePromptsAreCurrent(buildDoc(CURRENT_BODY, CURRENT_BODY + ' No R7 GO is claimed.')) === false &&
      reusablePromptIsCurrent(D7_NEXT_BODY) === false &&
      declaresStaleOrPrematureAuthority(D7_NEXT_BODY) === true &&
      reusablePromptIsCurrent(D7_CANDIDATE_BODY) === false &&
      declaresStaleOrPrematureAuthority(D7_CANDIDATE_BODY) === true &&
      reusablePromptsAreCurrent(buildDoc(CURRENT_BODY, CURRENT_BODY + ' No D7 GO is claimed.')) === false &&
      reusablePromptsAreCurrent(buildDoc(CURRENT_BODY, CURRENT_BODY + ' Expanded D7 is authorized.')) === false &&
      reusablePromptsAreCurrent(buildDoc(CURRENT_BODY, CURRENT_BODY + ' R8 may begin.')) === false);
    ok('fixture: a missing prompt heading fails extraction',
      extractReusablePrompts(buildDoc(CURRENT_BODY, CURRENT_BODY, 'missing-heading')) === null &&
      extractReusablePrompts(buildDoc(CURRENT_BODY, CURRENT_BODY, 'ok', 'missing-heading')) === null);
    ok('fixture: a duplicated prompt heading fails extraction',
      extractReusablePrompts(buildDoc(CURRENT_BODY, CURRENT_BODY, 'duplicate-heading')) === null);
    ok('fixture: a missing, bare, or non-text opening fence fails extraction',
      extractReusablePrompts(buildDoc(CURRENT_BODY, CURRENT_BODY, 'no-fence')) === null &&
      extractReusablePrompts(buildDoc(CURRENT_BODY, CURRENT_BODY, 'bare-open')) === null &&
      extractReusablePrompts(buildDoc(CURRENT_BODY, CURRENT_BODY, 'js-open')) === null &&
      extractReusablePrompts(buildDoc(CURRENT_BODY, CURRENT_BODY, 'json-open')) === null);
    ok('fixture: an unclosed fence fails extraction',
      extractReusablePrompts(buildDoc(CURRENT_BODY, CURRENT_BODY, 'unclosed')) === null);
    ok('fixture: a duplicated prompt block fails extraction',
      extractReusablePrompts(buildDoc(CURRENT_BODY, CURRENT_BODY, 'duplicate-block')) === null);
    ok('fixture: an empty prompt body fails extraction',
      extractReusablePrompts(buildDoc(CURRENT_BODY, CURRENT_BODY, 'empty')) === null &&
      extractReusablePrompts(buildDoc(CURRENT_BODY, CURRENT_BODY, 'ok', 'empty')) === null);
    ok('fixture: a structurally broken file can never pass the content gate',
      reusablePromptsAreCurrent(buildDoc(CURRENT_BODY, CURRENT_BODY, 'unclosed')) === false);
  }

  /* ---- R6 provenance-remediation evidence truth (test-evidence + checklist) ----
     Scoped to markdown TABLE ROWS in the two evidence documents, so the spent R6
     execution prompt and archived prose that record the real old 22/24 event are
     never flagged. */
  {
    const te = docs['docs/test-evidence.md'];
    const sc = docs['docs/security-checklist.md'];
    const demo = docs['docs/demo-script.md'];

    ok('docs/test-evidence.md exposes exactly one current safety row stating 24/24',
      analyzeCurrentSafetyRow(te).length === 0);
    ok('docs/test-evidence.md: every 22/24 evidence row is historical/superseded + restoration',
      every22_24RowHistorical(te).length === 0);
    ok('docs/security-checklist.md: every 22/24 evidence row is historical/superseded + restoration',
      every22_24RowHistorical(sc).length === 0);
    ok('docs/security-checklist.md post-synchronization RED row is historical/superseded',
      analyzePostSyncRow(sc).length === 0);
    ok('docs/security-checklist.md SEC-33 provenance row describes independent exact pinning',
      analyzeCurrentProvenanceRow(sc, /vendor provenance and license integrity/i).length === 0);
    ok('docs/test-evidence.md vendor rows describe independent pinning AND truthful +20 (17+1) accounting',
      analyzeCurrentProvenanceRow(te, /self-hosted browser dependencies, static \+ http/i).length === 0 &&
      analyzeProvenanceRemediationRow(te).length === 0);

    /* ---- fixtures: pinned independently of the live docs ---- */
    const HDR = '| A | B | C | D | E |\n| --- | --- | --- | --- | --- |\n';
    const CURR24 = '| Pilot credential/session safety (standalone, R1) | `x` | zero unexpired | **24/24 — current; verified before and after the R6 run** | standalone |';
    const HIST22 = '| Pilot credential/session safety (standalone, R1) — historical/superseded | `x` | zero unexpired | **Historical/superseded: 22/24 RED** | closed by a separately owner-authorized restoration |';
    const CURRENT_BAD_22 = '| Pilot credential/session safety (standalone, R1) | `x` | zero unexpired | **current post-run: 22/24 RED** | standalone |';
    const NON_SAFETY_24 = '| Some other gate | `x` | y | **24/24** | z |';

    ok('fixture: a current 24/24 safety row is accepted',
      analyzeCurrentSafetyRow(HDR + CURR24).length === 0);
    ok('fixture: a current 24/24 row plus a historical 22/24 row is accepted',
      analyzeCurrentSafetyRow(HDR + CURR24 + '\n' + HIST22).length === 0 &&
      every22_24RowHistorical(HDR + CURR24 + '\n' + HIST22).length === 0);
    ok('fixture: a stale CURRENT 22/24 safety row is rejected even if 24/24 appears elsewhere',
      analyzeCurrentSafetyRow(HDR + CURRENT_BAD_22 + '\n' + NON_SAFETY_24).length > 0);
    ok('fixture: a historical/superseded 22/24 row (with restoration) is accepted',
      every22_24RowHistorical(HDR + HIST22).length === 0);
    ok('fixture: an unlabeled old RED 22/24 evidence row is rejected',
      every22_24RowHistorical(HDR + '| Post-synchronization candidate | `x` | y | **RED 22/24** | no marker |').length > 0);
    ok('fixture: the same 22/24 row with an explicit historical marker + restoration is accepted',
      every22_24RowHistorical(HDR + '| Post-synchronization candidate (historical/superseded) | `x` | y | **RED 22/24** | closed by a supported restoration |').length === 0);
    ok('fixture: a historical 22/24 row WITHOUT restoration wording is rejected',
      every22_24RowHistorical(HDR + '| X (superseded) | `x` | y | **22/24 RED** | no closure note |').length > 0);

    const PROV_SHAPE = '| SEC-33 | Vendor provenance and license integrity | validate the manifest | PASS | Exact versions and SHA-256 hashes match the manifest by a registry-URL prefix + sha512- prefix check |';
    const PROV_INDEP = '| SEC-33 | Vendor provenance and license integrity | validate against the reviewed inventory | PASS | pinned in EXPECTED_VENDOR_INVENTORY outside the manifest; disk and HTTP bytes verified against the independently pinned SHA-256 |';
    /* Fixture accounting rows for the provenance-remediation full-suite row: one
       TRUTHFUL (17 rejecting mutations + 1 positive anchor) and one FALSE (all 18
       called "negative"). These prove analyzeProvenanceRemediationRow rejects the
       "18 negative" regression and accepts the 17+1 composition. */
    const PROV_ROW_OK = '| Full contract suite (M12.P1-R6 provenance-remediation closeout) | `npm test` | zero fail | **3415/3415 PASS** | +20 versus 3375: self-hosted-vendor 119 -> 139 from the exact-inventory replacement of the former shape-only assertion (no net), +1 inventory-cardinality assertion, +1 disk-hash assertion, +17 rejecting inventory mutations, and +1 positive live-manifest anchor |';
    const PROV_ROW_18NEG = '| Full contract suite (M12.P1-R6 provenance-remediation closeout) | `npm test` | zero fail | **3415/3415 PASS** | +20: self-hosted-vendor 119 -> 139 from 18 new provenance negative fixtures |';
    ok('fixture: shape-only provenance wording is rejected',
      analyzeCurrentProvenanceRow(HDR + PROV_SHAPE, /vendor provenance and license integrity/i).length > 0);
    ok('fixture: independently pinned exact-provenance wording is accepted',
      analyzeCurrentProvenanceRow(HDR + PROV_INDEP, /vendor provenance and license integrity/i).length === 0);
    ok('fixture: a missing provenance row fails closed AND a truthful 17+1 accounting row is accepted',
      analyzeCurrentProvenanceRow(HDR + NON_SAFETY_24, /vendor provenance and license integrity/i).length > 0 &&
      analyzeProvenanceRemediationRow(HDR + PROV_ROW_OK).length === 0);
    ok('fixture: duplicate provenance rows fail closed AND an "18 negative" accounting row is rejected',
      analyzeCurrentProvenanceRow(HDR + PROV_INDEP + '\n' + PROV_INDEP, /vendor provenance and license integrity/i).length > 0 &&
      analyzeProvenanceRemediationRow(HDR + PROV_ROW_18NEG).length > 0 &&
      analyzeProvenanceRemediationRow(HDR + NON_SAFETY_24).length > 0);

    ok('fixture: an unlabeled post-synchronization RED row is rejected',
      analyzePostSyncRow(HDR + '| Post-synchronization candidate | `x` | y | RED | 22-24 |').length > 0);
    ok('fixture: a historical/superseded post-synchronization row with restoration is accepted',
      analyzePostSyncRow(HDR + '| Post-synchronization candidate (historical/superseded) | `x` | y | RED | closed by a supported restoration |').length === 0);
    ok('fixture: a missing post-synchronization row fails closed',
      analyzePostSyncRow(HDR + NON_SAFETY_24).length > 0);

    /* ---- M12.P1-R8 evidence-consistency corrections (live documents) ---- */
    ok('docs/test-evidence.md exposes exactly one current, non-Pending Full QA aggregate disposition',
      analyzeFullQaAggregateRows(te).length === 0);
    ok('docs/test-evidence.md Manual Black-Box Checklist is fully dispositioned and binds current route/pathfinding evidence to the expanded BE.6 truth',
      analyzeManualBlackBoxRows(te).length === 0 &&
      analyzeCurrentRoutePathfindingEvidence(te, EXPECTED_CURRENT_BE6_EVIDENCE).length === 0);
    ok('docs/demo-script.md binds routing to the backend freeze and preserves post-deployment authorization boundaries',
      analyzeDemoRoutingContract(demo, EXPECTED_CURRENT_DEMO_ROUTING).length === 0 &&
      analyzeDemoReadinessSequence(demo, EXPECTED_CURRENT_DEMO_SEQUENCE).length === 0);
    ok('docs/test-evidence.md deployment smoke records the accepted SEC-51 result with its host and deployed baseline',
      analyzeDeploymentSmokeRow(te).length === 0);
    ok('docs/test-evidence.md presents no superseded R8 candidate figure as a current status',
      analyzeSupersededCandidateRows(te).length === 0);
    ok('docs/security-checklist.md presents no superseded R8 status and exactly one independently pinned current package claim',
      analyzeSupersededCandidateRows(sc).length === 0 &&
      analyzeSecurityChecklistPackageBoundaryRow(sc, EXPECTED_CURRENT_PACKAGE_INVENTORY).length === 0);
    ok('docs/test-evidence.md exposes exactly one current source-package inventory row with the pinned figures',
      analyzeCurrentPackageInventoryRow(te, EXPECTED_CURRENT_PACKAGE_INVENTORY).length === 0);
    ok('docs/test-evidence.md exposes exactly one current full-suite evidence-snapshot row',
      analyzeCurrentCandidateSuiteRow(te).length === 0);
    ok('current npm-test and full-QA dispositions bind one exact pinned total across both evidence documents',
      analyzeExactCurrentQualityTotals(te, sc, EXPECTED_CURRENT_QUALITY_TOTAL).length === 0);
    ok('current full-QA dispositions bind all five exact transcript stage markers in both evidence documents',
      analyzeCurrentQaStageMarkers(te, sc).length === 0);

    const scheduleAuditService = readIf(path.join('services', 'auditService.js'));
    const scheduleAuditController = readIf(path.join('controllers', 'adminScheduleController.js'));
    const liveScheduleAudit = analyzeScheduleAuditContract(scheduleAuditService, scheduleAuditController);
    ok('auditService allowlists exactly the three contracted schedule mutation actions',
      liveScheduleAudit.allowlist.length === 0);
    ok('adminScheduleController maps create, update, and delete to the exact schedule audit actions',
      liveScheduleAudit.controller.length === 0);

    /* ---- fixtures for the R8 evidence-consistency rules, pinned independently
       of the live documents. Each rule gets an accepting AND a rejecting case. ---- */
    const Q_HDR = '| Gate | Command | Expected result | Status | Evidence reference |\n| --- | --- | --- | --- | --- |\n';
    const M_HDR = '## Manual Black-Box Checklist\n\n| Area | Scenario | Steps | Expected result | Status | Evidence reference |\n| --- | --- | --- | --- | --- | --- |\n';
    const M_TAIL = '\n\n## Screenshot And Recording Checklist\n\n| Area | Scenario | Steps | Expected result | Status | Evidence reference |\n| x | y | z | w | Pending | |\n';

    const QA_STAGE_EVIDENCE = '`QUALITY-GATES OK`, `DB-PERF-GATE OK`, `[supabase-smoke] PASS`, `IDENTITY-CONSTRAINTS OK`, and `found 0 vulnerabilities`';
    const Q_QA_CURRENT = '| Full QA aggregate (M12.P1-D6 accepted implementation evidence) | `npm run qa` | all five stages green | **4998/4998 PASS - all five stages, exit 0** | ' + QA_STAGE_EVIDENCE + ' |';
    const Q_QA_PENDING = '| Full QA aggregate | `npm run qa` | all five stages green | Pending | |';
    const Q_QA_HISTORICAL = '| Full QA aggregate (RF.6-era placeholder) - historical/superseded | `npm run qa` | all five stages green | **Historical/superseded - replaced by the current row above** | see the current M12.P1-R8 row; `QUALITY-GATES OK` |';

    const M_OK = '| Local login | Student login | sign in through the real form | dashboard renders | **PASS (clean bounded matrix)** | 126/126 clean bounded matrix, both runtime modes |';
    const M_PENDING = '| Local login | Student login | sign in through the real form | dashboard renders | Pending | |';
    const M_BLANK_EVIDENCE = '| Local login | Student login | sign in through the real form | dashboard renders | **PASS (clean bounded matrix)** |  |';
    const M_ROUTE_CURRENT = '| Route/pathfinding | Road-following destination route | select a destination | route follows roads | **PASS (current expanded freeze)** | The expanded BE.6 freeze remains 46/46: MySQL has 34 buildings, 44 route nodes, 100 directed edges, 50 exact reverse pairs, 100 valid geometries, and 33 routable destinations; Supabase has 25 buildings, 26 route nodes, 50 directed edges, 25 exact reverse pairs, 50 valid geometries, and 25 routable destinations; the shared Guided-VR catalog has 25 active destinations, 472 configured steps, and 99 unique scene keys |';
    const M_ROUTE_STALE = '| Route/pathfinding | Road-following destination route | select a destination | route follows roads | **PASS (current expanded freeze)** | The refreshed BE.6 selected-demo candidate holds at 46/46 with 21 nodes, 50 directed edges, 25 exact reverse pairs, 50 valid geometries, and 13 routable destinations in both backends |';
    const M_ROUTE_WRONG_MYSQL_COUNT = M_ROUTE_CURRENT.replace('44 route nodes', '43 route nodes');
    const DEMO_OK = [
      '### 4. Campus Navigation',
      '',
      'Expected: ' + EXPECTED_CURRENT_DEMO_ROUTING.mysql + '; ' +
        EXPECTED_CURRENT_DEMO_ROUTING.supabase + '; ' + EXPECTED_CURRENT_DEMO_ROUTING.guidedCatalog + '.',
      'Arrival requires ' + EXPECTED_CURRENT_DEMO_ROUTING.naturalEndpoint + ', ' +
        EXPECTED_CURRENT_DEMO_ROUTING.storedMappings + ', ' + EXPECTED_CURRENT_DEMO_ROUTING.approvedMedia + ', and ' +
        EXPECTED_CURRENT_DEMO_ROUTING.bidirectionalLinks + '; ' + EXPECTED_CURRENT_DEMO_ROUTING.failClosed + '.',
      '',
      '### 5. Next Section',
      '',
      '### 6. Security And Deployment Readiness',
      '',
      'Remaining sequence: ' + EXPECTED_CURRENT_DEMO_SEQUENCE.join(' -> ') + '.',
    ].join('\n');
    const M_SMOKE_OK = '| Deployment smoke | Production hostname | exercise production read-only | boots fail-closed | **PASS (externally executed)** | SEC-51 against https://campusphere-cspc.vercel.app on deployed technical Production baseline fea3b2e11c6331eddc1ee091b165427d8e0218d7 |';
    const M_SMOKE_OK_WITH_HISTORY = '| Deployment smoke | Production hostname | exercise production read-only | boots fail-closed | **PASS (externally executed)** | SEC-51 against https://campusphere-cspc.vercel.app on deployed technical Production baseline fea3b2e11c6331eddc1ee091b165427d8e0218d7; historical/superseded: before that deployment, the earlier baseline was 0627bf78228148e3f989275810c333c16a1f3356 |';
    const M_SMOKE_STALE_BASELINE = '| Deployment smoke | Production hostname | exercise production read-only | boots fail-closed | **PASS (externally executed)** | SEC-51 against https://campusphere-cspc.vercel.app on deployed baseline 0627bf78228148e3f989275810c333c16a1f3356 |';
    const M_SMOKE_DEFERRED = '| Deployment smoke | Production hostname | deploy and exercise | boots fail-closed | **DEFERRED - SEC-51, separate owner deployment decision; not counted as passing** | tracked as SEC-51 |';
    const M_SMOKE_NO_CASE = '| Deployment smoke | Production hostname | deploy and exercise | boots fail-closed | **PASS (externally executed)** | no case reference, no host, no baseline |';
    const M_SMOKE_NO_BASELINE = '| Deployment smoke | Production hostname | deploy and exercise | boots fail-closed | **PASS (externally executed)** | SEC-51 against https://campusphere-cspc.vercel.app, baseline not recorded |';

    const SUITE_CURRENT = '| Full contract suite (M12.P1-D6/OFF.6 implementation evidence) | `npm test` | zero fail | **4998/4998 PASS - accepted local evidence** | `QUALITY-GATES OK`; replacement verification and separate clean-commit R8 review control release disposition |';
    const SUITE_STALE_CURRENT = '| Full contract suite (M12.P1-R8 pilot-readiness correction candidate) | `npm test` | zero fail | **3659/3659 PASS - correction candidate, awaiting an independent read-only R8 review** | delta reconciliation |';
    const SUITE_STALE_HIST = '| Full contract suite (M12.P1-R8 pilot-readiness correction candidate) - historical/superseded | `npm test` | zero fail | **Historical/superseded: `3659/3659` PASS - superseded by the current correction-candidate row above** | delta reconciliation |';

    const INV_CURRENT = '| M12.P1-D6/OFF local package inventory | `node scripts/vercelPackageBoundary-probe.js` | recomputed | **186 files, 7,220,073 bytes, aggregate SHA-256 `c19b2bb9bcd328df56f0eb247077f48e0c3cc6f35bf919c0e22da0d3add1f621`; focused package gate `74/74`** | current product package evidence; accepted e481d03 package remains historical |';
    const INV_CURRENT_CITES_OLD = '| M12.P1-D6/OFF local package inventory | `x` | recomputed | **186 files, 7,220,073 bytes, aggregate SHA-256 `c19b2bb9bcd328df56f0eb247077f48e0c3cc6f35bf919c0e22da0d3add1f621`** | current product package evidence; accepted e481d03 package is historical: 180 files, 7,189,621 bytes, aggregate SHA-256 `c07e34f43f859f3f4055c9a00f90b0a5967d323ef85e243227d95c8023195216` |';
    const INV_STALE_CURRENT = '| M12.P1-R8 package inventory (correction candidate) | `x` | recomputed | **157 files, 6,192,992 bytes, aggregate SHA-256 `0ae9f57debf8009235e7bef2160e8320b958e6e873d91d0ffb011a74ab999a1c`; focused probe `71/71`** | candidate evidence only |';
    const INV_STALE_HIST = '| M12.P1-R8 package inventory (pilot-readiness correction candidate) - historical/superseded | `x` | recomputed | **Historical/superseded: 157 files, 6,192,992 bytes, aggregate SHA-256 `0ae9f57debf8009235e7bef2160e8320b958e6e873d91d0ffb011a74ab999a1c`** | retained as history |';
    const SEC37_HDR = '| ID | Area | Test | Expected | Status | Evidence |\n| --- | --- | --- | --- | --- | --- |\n';
    const SEC37_CURRENT = '| SEC-37 | Deployment package boundary | enumerate | exact pin | **PASS — current maintenance-correction package evidence 74/74** | **Accepted technical Production predecessor:** 158 files, 6,245,074 bytes, aggregate SHA-256 `b3113c05daaa5d2e870f204083923434456580fa6499190421de062ce9cabbd4`. **Current maintenance-correction package:** 168 files, 7,074,195 bytes, aggregate SHA-256 `13cd3c5e5d8259766e50b1136c8cc8a5672b2321c65962892358c62b45ef88f5` |';
    const SEC37_CURRENT_PRODUCT = '| SEC-37 | Deployment package boundary | enumerate | exact pin | **PASS - current product package evidence 74/74** | **Accepted technical Production predecessor:** 158 files, 6,245,074 bytes, aggregate SHA-256 `b3113c05daaa5d2e870f204083923434456580fa6499190421de062ce9cabbd4`. **Current product package:** 186 files, 7,220,073 bytes, aggregate SHA-256 `c19b2bb9bcd328df56f0eb247077f48e0c3cc6f35bf919c0e22da0d3add1f621` |';
    const SEC37_STALE_CURRENT = SEC37_CURRENT.replace('168 files, 7,074,195 bytes', '158 files, 6,245,074 bytes');
    const SEC37_DUPLICATE_CURRENT = SEC37_CURRENT.replace(/ \|$/, '. **Current duplicate:** 168 files, 7,074,195 bytes, aggregate SHA-256 `13cd3c5e5d8259766e50b1136c8cc8a5672b2321c65962892358c62b45ef88f5` |');
    const SEC37_HISTORICAL_ONLY = SEC37_CURRENT.replace('**Current maintenance-correction package:**', '**Historical/superseded maintenance-correction package:**');

    const EXACT_SUITE_OK = '| Full contract suite (M12.P1-D6/OFF.6 accepted local candidate) | `npm test` | zero fail | **4998/4998 PASS - accepted local evidence** | `QUALITY-GATES OK` |';
    const EXACT_QA_OK = '| Full QA aggregate (M12.P1-D6 accepted local candidate) | `npm run qa` | all green | **4998/4998 PASS - exit 0** | ' + QA_STAGE_EVIDENCE + ' |';
    const EXACT_QA_MISMATCH = '| Full QA aggregate (M12.P1-D6 accepted local candidate) | `npm run qa` | all green | **4997/4997 PASS - exit 0** | ' + QA_STAGE_EVIDENCE + '; 4998/4998 appears only in neighbouring prose |';
    const SEC_COMMAND_HDR = '| Command | Expected result | Status | Evidence reference |\n| --- | --- | --- | --- |\n';
    const SEC_NPM_TEST_OK = '| `npm test` | contracts pass | **4998/4998 PASS (automated)** | `QUALITY-GATES OK` |';
    const SEC_NPM_QA_OK = '| `npm run qa` | aggregate passes | **4998/4998 PASS (automated)** | ' + QA_STAGE_EVIDENCE + ' |';
    const SEC_NPM_QA_BARE = '| `npm run qa` | aggregate passes | **PASS (automated)** | `QUALITY-GATES OK`; a neighbouring historical note says 4998/4998 |';

    /* Schedule-audit fixtures are REAL SOURCE SHAPES, because the analyzer is
       now structural. Each rejecting fixture below keeps every required action
       literal present exactly once SOMEWHERE in the file, so the superseded
       literal-counting analyzer accepted it — only structure separates them. */
    const S_ACTIONS = (rows) => ['const ACTIONS = Object.freeze([', "  'login.local',"]
      .concat(rows).concat([']);']).join('\n');
    const SCHEDULE_SERVICE_OK = S_ACTIONS([
      "  'admin.schedule.create',",
      "  'admin.schedule.update',",
      "  'admin.schedule.delete',",
    ]);
    // delete dropped from the array, still present once as an unrelated constant
    const SCHEDULE_SERVICE_MISSING = S_ACTIONS([
      "  'admin.schedule.create',",
      "  'admin.schedule.update',",
    ]) + "\nconst DOC_ONLY = 'admin.schedule.delete';";
    // delete present once, but only inside a comment
    const SCHEDULE_SERVICE_COMMENT_ONLY = S_ACTIONS([
      "  'admin.schedule.create',",
      "  'admin.schedule.update',",
      "  // 'admin.schedule.delete',",
    ]);
    const SCHEDULE_SERVICE_DUPLICATE = S_ACTIONS([
      "  'admin.schedule.create',",
      "  'admin.schedule.update',",
      "  'admin.schedule.delete',",
      "  'admin.schedule.delete',",
    ]);
    const SCHEDULE_SERVICE_TWO_DECLS = SCHEDULE_SERVICE_OK + '\n' + SCHEDULE_SERVICE_OK;
    // the literal is present, but it is not the element's runtime value
    const SCHEDULE_SERVICE_CONCAT = S_ACTIONS([
      "  'admin.schedule.create',",
      "  'admin.schedule.update',",
      "  prefix + 'admin.schedule.delete',",
    ]);
    const SCHEDULE_SERVICE_CALL = S_ACTIONS([
      "  'admin.schedule.create',",
      "  'admin.schedule.update',",
      "  choose('admin.schedule.delete'),",
    ]);
    const SCHEDULE_SERVICE_TERNARY = S_ACTIONS([
      "  'admin.schedule.create',",
      "  'admin.schedule.update',",
      "  flag ? 'admin.schedule.delete' : other,",
    ]);
    // a syntactically real declaration that never establishes the module allowlist
    const SCHEDULE_SERVICE_NESTED_DECL = 'if (false) {\n' + SCHEDULE_SERVICE_OK + '\n}';
    // every required literal is direct, but the interior comma creates an array hole
    const SCHEDULE_SERVICE_INTERIOR_HOLE = S_ACTIONS([
      "  'admin.schedule.create',",
      '  ,',
      "  'admin.schedule.update',",
      "  'admin.schedule.delete',",
    ]);

    const A_CREATE = "    auditAdminMutation(req, 'admin.schedule.create', 'room_schedule', schedule.id, 'created');";
    const A_UPDATE = "    auditAdminMutation(req, 'admin.schedule.update', 'room_schedule', schedule.id, 'updated');";
    const A_DELETE = "    auditAdminMutation(req, 'admin.schedule.delete', 'room_schedule', removed.id, 'deleted');";
    const A_DELETE_BARE = A_DELETE.trim().replace(/;$/, '');
    /* Fixture handlers reproduce the EXACT pinned statement prefixes, so a decoy
       differs from the real thing only in statement structure. */
    const MUT_OF = {
      createSchedule: '    const schedule = await scheduleRepository.createSchedule(req.body);',
      updateSchedule: '    const schedule = await scheduleRepository.updateSchedule(req.body);',
      deleteSchedule: '    const removed = await scheduleRepository.deleteScheduleById(req.body);',
    };
    const AUD_OF = { createSchedule: A_CREATE, updateSchedule: A_UPDATE, deleteSchedule: A_DELETE };
    const OK_OF = {
      createSchedule: "    return res.status(201).json({ success: true, message: 'ok' });",
      updateSchedule: "    return res.json({ success: true, message: 'ok' });",
      deleteSchedule: "    return res.json({ success: true, message: 'ok' });",
    };
    const mkHandler = (name, over) => {
      const o = over || {};
      return [
        'exports.' + name + ' = async (req, res) => {',
        '  try {',
        o.mutation === undefined ? MUT_OF[name] : o.mutation,
        o.audit === undefined ? AUD_OF[name] : o.audit,
        o.success === undefined ? OK_OF[name] : o.success,
        '  } catch (error) {',
        "    return res.status(500).json({ success: false, message: 'Server error.' });",
        '  }',
        '};',
      ].filter((line) => line !== '').join('\n');
    };
    const mkController = (over) => {
      const o = over || {};
      return ['createSchedule', 'updateSchedule', 'deleteSchedule']
        .map((n) => (o[n] && o[n].raw !== undefined ? o[n].raw : mkHandler(n, o[n])))
        .join('\n\n');
    };

    const SCHEDULE_CONTROLLER_OK = mkController();
    const SCHEDULE_CONTROLLER_COMMENTED = mkController({ deleteSchedule: { audit: '    // ' + A_DELETE.trim() } });
    const SCHEDULE_CONTROLLER_STRING_ONLY = mkController({
      deleteSchedule: { audit: '    const doc = "' + A_DELETE.trim() + '";' } });
    const SCHEDULE_CONTROLLER_NESTED = mkController({
      deleteSchedule: { audit: '    if (false) {\n  ' + A_DELETE + '\n    }' } });
    // every literal still appears once, but delete/update are audited by the wrong handler
    const SCHEDULE_CONTROLLER_WRONG = mkController({
      updateSchedule: { audit: A_DELETE }, deleteSchedule: { audit: A_UPDATE } });
    const SCHEDULE_CONTROLLER_DUPLICATE = mkController({
      deleteSchedule: { audit: A_DELETE + '\n' + A_DELETE } });
    const SCHEDULE_CONTROLLER_ORDER = mkController({
      deleteSchedule: { raw: mkHandler('deleteSchedule', { mutation: A_DELETE, audit: MUT_OF.deleteSchedule }) } });
    // argument wrappers: the literal is present but is not the argument itself
    const SCHEDULE_CONTROLLER_ACTION_CALL = mkController({
      deleteSchedule: { audit: "    auditAdminMutation(req, resolve('admin.schedule.delete'), 'room_schedule', removed.id, 'deleted');" } });
    const SCHEDULE_CONTROLLER_TARGET_CALL = mkController({
      deleteSchedule: { audit: "    auditAdminMutation(req, 'admin.schedule.delete', targetType('room_schedule'), removed.id, 'deleted');" } });
    const SCHEDULE_CONTROLLER_TARGET_CONCAT = mkController({
      deleteSchedule: { audit: "    auditAdminMutation(req, 'admin.schedule.delete', 'room_' + 'schedule', removed.id, 'deleted');" } });
    // the action and target are correct, but the actor request argument is not
    const SCHEDULE_CONTROLLER_REQ_CALL = mkController({
      deleteSchedule: { audit: "    auditAdminMutation(resolveReq(), 'admin.schedule.delete', 'room_schedule', removed.id, 'deleted');" } });
    const SCHEDULE_CONTROLLER_REQ_NULL = mkController({
      deleteSchedule: { audit: "    auditAdminMutation(null, 'admin.schedule.delete', 'room_schedule', removed.id, 'deleted');" } });
    const SCHEDULE_CONTROLLER_REQ_OTHER = mkController({
      deleteSchedule: { audit: "    auditAdminMutation(otherReq, 'admin.schedule.delete', 'room_schedule', removed.id, 'deleted');" } });
    // the handler is exported only inside a dead block, so it is not module top level
    const SCHEDULE_CONTROLLER_NESTED_EXPORT = mkController({
      deleteSchedule: { raw: 'if (false) {\n' + mkHandler('deleteSchedule') + '\n}' } });
    const SCHEDULE_CONTROLLER_BRACELESS_EXPORT = mkController({
      deleteSchedule: { raw: 'if (false) ' + mkHandler('deleteSchedule') } });
    const SCHEDULE_CONTROLLER_SHORTCIRCUIT_EXPORT = mkController({
      deleteSchedule: { raw: 'false && (' + mkHandler('deleteSchedule').replace(/;\s*$/, '') + ');' } });
    // expression-level decoys that carry no braces at all
    const SCHEDULE_CONTROLLER_BRACELESS_IF = mkController({
      deleteSchedule: { audit: '    if (false) ' + A_DELETE.trim() } });
    const SCHEDULE_CONTROLLER_SHORTCIRCUIT = mkController({
      deleteSchedule: { audit: '    false && ' + A_DELETE.trim() } });
    const SCHEDULE_CONTROLLER_TERNARY = mkController({
      deleteSchedule: { audit: '    req.body ? ' + A_DELETE_BARE + ' : null;' } });
    const SCHEDULE_CONTROLLER_ASSIGNED = mkController({
      deleteSchedule: { audit: '    const logged = ' + A_DELETE.trim() } });
    const SCHEDULE_CONTROLLER_TRAILING_TOKEN = mkController({
      deleteSchedule: { audit: '    ' + A_DELETE_BARE + ' || fallback();' } });
    const SCHEDULE_CONTROLLER_MUT_SHORTCIRCUIT = mkController({
      deleteSchedule: { mutation: '    false && await scheduleRepository.deleteScheduleById(req.body);' } });
    const SCHEDULE_CONTROLLER_AUDIT_AFTER_RETURN = mkController({
      deleteSchedule: { raw: mkHandler('deleteSchedule', { audit: OK_OF.deleteSchedule, success: A_DELETE }) } });
    const SCHEDULE_CONTROLLER_REQUIRED_AFTER_RETURN = mkController({
      deleteSchedule: { mutation: "    return res.status(409).json({ success: false, message: 'stop' });\n" + MUT_OF.deleteSchedule } });
    const SCHEDULE_CONTROLLER_REQUIRED_AFTER_THROW = mkController({
      deleteSchedule: { mutation: "    throw new Error('stop');\n" + MUT_OF.deleteSchedule } });

    ok('fixture: one current Full QA aggregate row plus a historical placeholder is accepted',
      analyzeFullQaAggregateRows(Q_HDR + Q_QA_CURRENT + '\n' + Q_QA_HISTORICAL).length === 0);
    ok('fixture: a Pending, duplicated, or history-only Full QA aggregate disposition is rejected',
      analyzeFullQaAggregateRows(Q_HDR + Q_QA_PENDING).length > 0 &&
      analyzeFullQaAggregateRows(Q_HDR + Q_QA_CURRENT + '\n' + Q_QA_CURRENT).length > 0 &&
      analyzeFullQaAggregateRows(Q_HDR + Q_QA_HISTORICAL).length > 0);

    ok('fixture: a fully dispositioned manual checklist with exact current route/pathfinding BE.6 evidence is accepted',
      analyzeManualBlackBoxRows(M_HDR + M_OK + '\n' + M_ROUTE_CURRENT + '\n' + M_SMOKE_OK + M_TAIL).length === 0 &&
      analyzeCurrentRoutePathfindingEvidence(
        M_HDR + M_OK + '\n' + M_ROUTE_CURRENT + '\n' + M_SMOKE_OK + M_TAIL,
        EXPECTED_CURRENT_BE6_EVIDENCE).length === 0);
    ok('fixture: Pending, blank, missing, stale, or single-count-mutated manual evidence fails closed',
      analyzeManualBlackBoxRows(M_HDR + M_PENDING + M_TAIL).length > 0 &&
      analyzeManualBlackBoxRows(M_HDR + M_BLANK_EVIDENCE + M_TAIL).length > 0 &&
      analyzeManualBlackBoxRows('## Some Other Section\n\n| a | b | c | d | e | f |\n').length > 0 &&
      analyzeCurrentRoutePathfindingEvidence(
        M_HDR + M_ROUTE_STALE + M_TAIL, EXPECTED_CURRENT_BE6_EVIDENCE).length > 0 &&
      analyzeCurrentRoutePathfindingEvidence(
        M_HDR + M_ROUTE_WRONG_MYSQL_COUNT + M_TAIL, EXPECTED_CURRENT_BE6_EVIDENCE).length > 0);
    ok('fixture: an exact backend/catalog demo with complete arrival authority and ordered readiness sequence is accepted',
      analyzeDemoRoutingContract(DEMO_OK, EXPECTED_CURRENT_DEMO_ROUTING).length === 0 &&
      analyzeDemoReadinessSequence(DEMO_OK, EXPECTED_CURRENT_DEMO_SEQUENCE).length === 0);
    ok('fixture: stale topology, missing arrival authority, or a missing/reordered readiness boundary fails closed', [
      DEMO_OK.replace(EXPECTED_CURRENT_DEMO_ROUTING.mysql, 'the verified 20-node / 48-edge / 24-pair graph routes all 13 current destinations'),
      DEMO_OK.replace(EXPECTED_CURRENT_DEMO_ROUTING.guidedCatalog, 'Guided VR covers 24 active destinations'),
      DEMO_OK.replace(EXPECTED_CURRENT_DEMO_ROUTING.naturalEndpoint, 'the selected destination'),
      DEMO_OK.replace(EXPECTED_CURRENT_DEMO_ROUTING.storedMappings, 'scene coverage'),
      DEMO_OK.replace(EXPECTED_CURRENT_DEMO_ROUTING.approvedMedia, 'available images'),
      DEMO_OK.replace(EXPECTED_CURRENT_DEMO_ROUTING.bidirectionalLinks, 'navigation links'),
      DEMO_OK.replace(EXPECTED_CURRENT_DEMO_ROUTING.failClosed, 'arrival is reported')
    ].every((fixture) => analyzeDemoRoutingContract(fixture, EXPECTED_CURRENT_DEMO_ROUTING).length > 0) &&
      analyzeDemoReadinessSequence(
        DEMO_OK.replace(EXPECTED_CURRENT_DEMO_SEQUENCE[0], 'limited-pilot readiness is next'),
        EXPECTED_CURRENT_DEMO_SEQUENCE).length > 0 &&
      analyzeDemoReadinessSequence(
        DEMO_OK.replace('off.2-off.6 and d6 are complete and codex go', 'off.2 is next'),
        EXPECTED_CURRENT_DEMO_SEQUENCE).length > 0 &&
      analyzeDemoReadinessSequence(
        DEMO_OK.replace(
          EXPECTED_CURRENT_DEMO_SEQUENCE.join(' -> '),
          [...EXPECTED_CURRENT_DEMO_SEQUENCE].reverse().join(' -> ')),
        EXPECTED_CURRENT_DEMO_SEQUENCE).length > 0);

    ok('fixture: a SEC-51 deployment-smoke row naming the host and the CURRENT deployed baseline is accepted, with or without a marked historical baseline',
      analyzeDeploymentSmokeRow(M_HDR + M_OK + '\n' + M_SMOKE_OK + M_TAIL).length === 0 &&
      analyzeDeploymentSmokeRow(M_HDR + M_OK + '\n' + M_SMOKE_OK_WITH_HISTORY + M_TAIL).length === 0);
    ok('fixture: a still-DEFERRED, evidence-less, baseline-less, stale-baseline, duplicated, or missing deployment-smoke row is rejected',
      analyzeDeploymentSmokeRow(M_HDR + M_SMOKE_DEFERRED + M_TAIL).length > 0 &&
      analyzeDeploymentSmokeRow(M_HDR + M_SMOKE_NO_CASE + M_TAIL).length > 0 &&
      analyzeDeploymentSmokeRow(M_HDR + M_SMOKE_NO_BASELINE + M_TAIL).length > 0 &&
      analyzeDeploymentSmokeRow(M_HDR + M_SMOKE_STALE_BASELINE + M_TAIL).length > 0 &&
      analyzeDeploymentSmokeRow(M_HDR + M_SMOKE_OK + '\n' + M_SMOKE_OK + M_TAIL).length > 0 &&
      analyzeDeploymentSmokeRow(M_HDR + M_OK + M_TAIL).length > 0);

    ok('fixture: superseded figures are accepted once historical and SEC-37 accepts one pinned current package claim',
      analyzeSupersededCandidateRows(Q_HDR + SUITE_STALE_HIST + '\n' + INV_STALE_HIST).length === 0 &&
      analyzeSupersededCandidateRows(Q_HDR + INV_CURRENT_CITES_OLD).length === 0 &&
      analyzeSecurityChecklistPackageBoundaryRow(
        SEC37_HDR + SEC37_CURRENT_PRODUCT, EXPECTED_CURRENT_PACKAGE_INVENTORY).length === 0);
    ok('fixture: stale current status or stale, duplicated, and missing SEC-37 current package claims are rejected',
      analyzeSupersededCandidateRows(Q_HDR + SUITE_STALE_CURRENT).length > 0 &&
      analyzeSupersededCandidateRows(Q_HDR + INV_STALE_CURRENT).length > 0 &&
      analyzeSecurityChecklistPackageBoundaryRow(
        SEC37_HDR + SEC37_STALE_CURRENT, EXPECTED_CURRENT_PACKAGE_INVENTORY).length > 0 &&
      analyzeSecurityChecklistPackageBoundaryRow(
        SEC37_HDR + SEC37_DUPLICATE_CURRENT, EXPECTED_CURRENT_PACKAGE_INVENTORY).length > 0 &&
      analyzeSecurityChecklistPackageBoundaryRow(
        SEC37_HDR + SEC37_HISTORICAL_ONLY, EXPECTED_CURRENT_PACKAGE_INVENTORY).length > 0);

    /* The second clause pins the scoping regression directly: a CURRENT row that
       cites older evidence as historical inside its EVIDENCE cell must stay
       current. Judging "historical" from the whole row demoted the live current
       inventory row and left zero current rows. */
    ok('fixture: exactly one current inventory row carrying the pinned figures is accepted, including one that cites older evidence as historical',
      analyzeCurrentPackageInventoryRow(Q_HDR + INV_CURRENT + '\n' + INV_STALE_HIST, EXPECTED_CURRENT_PACKAGE_INVENTORY).length === 0 &&
      analyzeCurrentPackageInventoryRow(Q_HDR + INV_CURRENT_CITES_OLD + '\n' + INV_STALE_HIST, EXPECTED_CURRENT_PACKAGE_INVENTORY).length === 0);
    ok('fixture: a stale-figure, duplicated, or absent current inventory row is rejected',
      analyzeCurrentPackageInventoryRow(Q_HDR + INV_STALE_CURRENT, EXPECTED_CURRENT_PACKAGE_INVENTORY).length > 0 &&
      analyzeCurrentPackageInventoryRow(Q_HDR + INV_CURRENT + '\n' + INV_CURRENT, EXPECTED_CURRENT_PACKAGE_INVENTORY).length > 0 &&
      analyzeCurrentPackageInventoryRow(Q_HDR + Q_QA_CURRENT, EXPECTED_CURRENT_PACKAGE_INVENTORY).length > 0);

    ok('fixture: one current full-suite candidate row plus a historical one is accepted',
      analyzeCurrentCandidateSuiteRow(Q_HDR + SUITE_CURRENT + '\n' + SUITE_STALE_HIST).length === 0);
    ok('fixture: two current full-suite candidate rows, or none at all, are rejected',
      analyzeCurrentCandidateSuiteRow(Q_HDR + SUITE_CURRENT + '\n' + SUITE_STALE_CURRENT).length > 0 &&
      analyzeCurrentCandidateSuiteRow(Q_HDR + Q_QA_CURRENT).length > 0);

    ok('fixture: one exact current suite/QA total in every required status cell is accepted',
      analyzeExactCurrentQualityTotals(
        Q_HDR + EXACT_SUITE_OK + '\n' + EXACT_QA_OK,
        SEC_COMMAND_HDR + SEC_NPM_TEST_OK + '\n' + SEC_NPM_QA_OK,
        4998).length === 0);
    ok('fixture: a mismatched QA total or a total appearing only in neighbouring evidence is rejected',
      analyzeExactCurrentQualityTotals(
        Q_HDR + EXACT_SUITE_OK + '\n' + EXACT_QA_MISMATCH,
        SEC_COMMAND_HDR + SEC_NPM_TEST_OK + '\n' + SEC_NPM_QA_BARE,
        4998).length > 0);
    ok('fixture: missing, duplicated, or historical-only current total rows fail closed',
      analyzeExactCurrentQualityTotals(
        Q_HDR + EXACT_SUITE_OK + '\n' + EXACT_QA_OK + '\n' + EXACT_QA_OK,
        SEC_COMMAND_HDR + SEC_NPM_TEST_OK,
        4998).length > 0 &&
      analyzeExactCurrentQualityTotals(
        Q_HDR + EXACT_SUITE_OK + '\n' + Q_QA_HISTORICAL,
        SEC_COMMAND_HDR + SEC_NPM_TEST_OK + '\n' + SEC_NPM_QA_OK,
        4998).length > 0);
    ok('fixture: all five exact QA-stage markers are accepted and every missing or invented marker is rejected',
      analyzeCurrentQaStageMarkers(
        Q_HDR + EXACT_QA_OK,
        SEC_COMMAND_HDR + SEC_NPM_QA_OK).length === 0 &&
      REQUIRED_CURRENT_QA_EVIDENCE_MARKERS.every((marker) =>
        analyzeCurrentQaStageMarkers(
          Q_HDR + EXACT_QA_OK.replace(marker, 'missing-stage-marker'),
          SEC_COMMAND_HDR + SEC_NPM_QA_OK).length > 0 &&
        analyzeCurrentQaStageMarkers(
          Q_HDR + EXACT_QA_OK,
          SEC_COMMAND_HDR + SEC_NPM_QA_OK.replace(marker, 'missing-stage-marker')).length > 0) &&
      analyzeCurrentQaStageMarkers(
        Q_HDR + EXACT_QA_OK.replace('[supabase-smoke] PASS', 'SUPABASE-SMOKE OK'),
        SEC_COMMAND_HDR + SEC_NPM_QA_OK).length > 0);

    ok('fixture: the exact three-action schedule audit contract is accepted only from a real frozen allowlist array and real handler structure',
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_OK).allowlist.length === 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_OK).controller.length === 0);
    ok('fixture: every structural decoy is rejected even though the required literal is still present — including braced, brace-less, and short-circuit dead exports; wrapped audit calls; unreachable required sequences after return or throw; and the retained allowlist, argument, mapping, ordering, and statement-shape attacks',
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_MISSING, SCHEDULE_CONTROLLER_OK).allowlist.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_COMMENT_ONLY, SCHEDULE_CONTROLLER_OK).allowlist.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_DUPLICATE, SCHEDULE_CONTROLLER_OK).allowlist.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_TWO_DECLS, SCHEDULE_CONTROLLER_OK).allowlist.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_CONCAT, SCHEDULE_CONTROLLER_OK).allowlist.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_CALL, SCHEDULE_CONTROLLER_OK).allowlist.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_TERNARY, SCHEDULE_CONTROLLER_OK).allowlist.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_NESTED_DECL, SCHEDULE_CONTROLLER_OK).allowlist.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_INTERIOR_HOLE, SCHEDULE_CONTROLLER_OK).allowlist.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_COMMENTED).controller.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_STRING_ONLY).controller.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_NESTED).controller.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_NESTED_EXPORT).controller.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_BRACELESS_EXPORT).controller.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_SHORTCIRCUIT_EXPORT).controller.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_WRONG).controller.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_DUPLICATE).controller.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_ORDER).controller.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_ACTION_CALL).controller.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_TARGET_CALL).controller.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_TARGET_CONCAT).controller.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_REQ_CALL).controller.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_REQ_NULL).controller.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_REQ_OTHER).controller.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_BRACELESS_IF).controller.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_SHORTCIRCUIT).controller.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_TERNARY).controller.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_ASSIGNED).controller.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_TRAILING_TOKEN).controller.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_MUT_SHORTCIRCUIT).controller.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_AUDIT_AFTER_RETURN).controller.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_REQUIRED_AFTER_RETURN).controller.length > 0 &&
      analyzeScheduleAuditContract(SCHEDULE_SERVICE_OK, SCHEDULE_CONTROLLER_REQUIRED_AFTER_THROW).controller.length > 0);

    /* ---- SEC-51 deployed-evidence synchronization (live documents) ---- */
    const deployDocText = docs['docs/deployment.md'];
    ok('docs/security-checklist.md SEC-51 row records the accepted production result with host and deployed baseline',
      analyzeSec51ChecklistRow(sc).length === 0);
    ok('docs/test-evidence.md keeps every superseded-baseline mention framed as history',
      supersededBaselineAlwaysMarkedHistorical(te));
    ok('docs/security-checklist.md keeps every superseded-baseline mention framed as history',
      supersededBaselineAlwaysMarkedHistorical(sc));
    ok('docs/test-evidence.md records the accepted Production baseline and manual-promotion boundary',
      recordsPostDeploymentAuthority(te));
    ok('docs/security-checklist.md records the accepted Production baseline and manual-promotion boundary',
      recordsPostDeploymentAuthority(sc));
    ok('docs/test-evidence.md makes no stale undeployed pilot-surface claim',
      !declaresStalePilotSurfaceDeploymentClaim(te));
    ok('docs/security-checklist.md makes no stale undeployed pilot-surface claim',
      !declaresStalePilotSurfaceDeploymentClaim(sc));
    ok('docs/deployment.md makes no stale or conflicting current deployment claim',
      deploymentDocumentClaimsAreCurrent(deployDocText));
    for (const authorityDoc of ['AGENTS.md', 'CLAUDE.md', 'CODEX_HANDOFF.md',
      'CLAUDE_HANDOFF.md', 'plan.md', 'ROADMAP.md']) {
      ok(`${authorityDoc} makes no stale or conflicting current deployment claim`,
        deploymentDocumentClaimsAreCurrent(docs[authorityDoc]));
    }

    /* ---- fixtures: pinned independently of the live documents ---- */
    const SEC51_HDR = '| Case | Title | Steps | Expected | Status | Evidence |\n| --- | --- | --- | --- | --- | --- |\n';
    const SEC51_OK = '| SEC-51 | Vercel production smoke | exercise production | boots fail-closed | **PASS (externally executed)** | against https://campusphere-cspc.vercel.app on deployed technical Production baseline fea3b2e11c6331eddc1ee091b165427d8e0218d7 |';
    const SEC51_WITH_HISTORY = '| SEC-51 | Vercel production smoke | exercise production | boots fail-closed | **PASS (externally executed)** | against https://campusphere-cspc.vercel.app on deployed technical Production baseline fea3b2e11c6331eddc1ee091b165427d8e0218d7; historical/superseded: before that deployment, the earlier baseline was 0627bf78228148e3f989275810c333c16a1f3356 |';
    const SEC51_ONLY_OLD = '| SEC-51 | Vercel production smoke | exercise production | boots fail-closed | **PASS (externally executed)** | against https://campusphere-cspc.vercel.app on deployed baseline 0627bf78228148e3f989275810c333c16a1f3356 |';
    const SEC51_NO_HOST = '| SEC-51 | Vercel production smoke | exercise production | boots fail-closed | **PASS (externally executed)** | on deployed technical Production baseline fea3b2e11c6331eddc1ee091b165427d8e0218d7 |';
    const SEC51_NO_SHA = '| SEC-51 | Vercel production smoke | exercise production | boots fail-closed | **PASS (externally executed)** | against https://campusphere-cspc.vercel.app |';
    const SEC51_DEFERRED = '| SEC-51 | Vercel production smoke | exercise production | boots fail-closed | **DEFERRED - separate owner deployment decision** | not executed |';

    ok('fixture: a current SEC-51 row naming the host and the deployed baseline is accepted, with or without a marked historical baseline',
      analyzeSec51ChecklistRow(SEC51_HDR + SEC51_OK).length === 0 &&
      analyzeSec51ChecklistRow(SEC51_HDR + SEC51_WITH_HISTORY).length === 0);
    ok('fixture: a SEC-51 row presenting only the superseded baseline as current is rejected',
      analyzeSec51ChecklistRow(SEC51_HDR + SEC51_ONLY_OLD).length > 0);
    ok('fixture: a SEC-51 row omitting the host, omitting the deployed SHA, still DEFERRED, duplicated, or absent is rejected',
      analyzeSec51ChecklistRow(SEC51_HDR + SEC51_NO_HOST).length > 0 &&
      analyzeSec51ChecklistRow(SEC51_HDR + SEC51_NO_SHA).length > 0 &&
      analyzeSec51ChecklistRow(SEC51_HDR + SEC51_DEFERRED).length > 0 &&
      analyzeSec51ChecklistRow(SEC51_HDR + SEC51_OK + '\n' + SEC51_OK).length > 0 &&
      analyzeSec51ChecklistRow(SEC51_HDR).length > 0);

    /* Historical pre-correction post-deployment prose retained only for
       negative-fixture coverage. */
    const LEGACY_PROSE_OK =
      'Production at https://campusphere-cspc.vercel.app serves deployed technical Production baseline fea3b2e11c6331eddc1ee091b165427d8e0218d7. ' +
      'The separately authorized push automatically triggered Vercel Production. ' +
      'Post-deployment verification passed within bounded anonymous read-only GET-only scope. ' +
      'Auto-assign Custom Production Domains is disabled; future main deployments require manual promotion. ' +
      'The documentation/static-assertion-only authority synchronization db05b549807535840968bf28cdefac4154a6d59d is committed and pushed. ' +
      'Owner-observed Vercel evidence shows it Ready, Production, Staged, with custom-domain assignment Skipped. ' +
      'It was not promoted or made Current, and fea3b2e11c6331eddc1ee091b165427d8e0218d7 remained on the live alias. ' +
      'The owner attests that a human pilot occurred on 2026-08-05 and accepts it with zero reported findings. ' +
      'Participant/Form evidence remains external. The tested build full source-commit identity was not independently verified. ' +
      'Pilot review is complete for sequencing purposes. OFF.2-OFF.6 are complete and Codex GO on local commit cdbc863b779e5319c14dee21a31a5e78951e233c. D6 is complete and Codex GO on local commit 691f0bef40e06b6ea9485e713d2fe3000a03bd83. The service worker is v25. The simplified fallback keeps the route decorative and exposes buildings as labelled native HTML buttons with exact 44-by-44 targets. The pre-authority-sync manifest SHA-256 494010dd9d1aadb43c2d124543c302d97bece118b8c687109ccd6e2624ed0610 covered 19 files and 2,020,639 bytes. Focused evidence only is OFF.2 145/145, offline 2D 35/35, and package boundary 74/74. The unchanged package identity is 168 files, 7,073,128 bytes, aggregate SHA-256 1d6cc68b7ef350b6a61eb8d84ea4fb7dd6862bd8548beb7595d3f2e6f4b10d6a. No npm test, npm run qa, ordered 24/24 -> 18/18 -> 46/46 postconditions, or browser acceptance was run for those exact bytes. That manifest is predecessor evidence; recompute the live manifest instead of reusing it. The current uncommitted 19-file offline UI/accessibility/package correction candidate is pending independent read-only review and full verification. The current uncommitted 19-file offline UI/accessibility/package correction candidate claims no new Codex GO, commit readiness, deployment readiness, or final Milestone 12 GO. Final Milestone 12 disposition remains external. The local commits and current candidate must not be pushed, promoted, or deployed before the presentation and a later explicit owner decision. ' +
      'Historical/superseded: before this deployment, Production served 0627bf78228148e3f989275810c333c16a1f3356.';
    const PROSE_OK =
      'Production at https://campusphere-cspc.vercel.app serves deployed technical Production baseline fea3b2e11c6331eddc1ee091b165427d8e0218d7. ' +
      'The separately authorized push automatically triggered Vercel Production. Post-deployment verification passed within bounded anonymous read-only GET-only scope. ' +
      'Auto-assign Custom Production Domains is disabled; future main deployments require manual promotion. ' +
      'The documentation/static-assertion-only authority synchronization db05b549807535840968bf28cdefac4154a6d59d is committed and pushed. Owner-observed Vercel evidence shows it Ready, Production, Staged, with custom-domain assignment Skipped. It was not promoted or made Current, and fea3b2e11c6331eddc1ee091b165427d8e0218d7 remained on the live alias. ' +
      'The owner attests that a human pilot occurred on 2026-08-05 and accepts it with zero reported findings. Participant/Form evidence remains external. The tested build full source-commit identity was not independently verified. Pilot review is complete for sequencing purposes. OFF.2-OFF.6 are complete and Codex GO on local commit cdbc863b779e5319c14dee21a31a5e78951e233c. D6 is complete and Codex GO on local commit 691f0bef40e06b6ea9485e713d2fe3000a03bd83. ' +
      'The exact 19-file implementation d786bdcb83a196c7263dceae668417d3ced3e95a is committed and pushed. Its manifest SHA-256 92c689b884f52021f5545f331e8768ffc4768914cf9320c2d4b8fedee7020642 covers 19 files and 2,072,400 bytes; replacement verification passed at 4998/4998 with QUALITY-GATES OK, five-stage QA, bounded Chrome acceptance in both supported backends, and ordered postconditions 24/24 -> 18/18 -> 46/46. The package pin is 168 files, 7,073,128 bytes, aggregate SHA-256 1d6cc68b7ef350b6a61eb8d84ea4fb7dd6862bd8548beb7595d3f2e6f4b10d6a. ' +
      'The clean-commit independent R8 review returned NO-GO solely for stale operative lifecycle authority; final Milestone 12 disposition remains external and no promotion or deployment is authorized. Historical/superseded: before this deployment, Production served 0627bf78228148e3f989275810c333c16a1f3356.';
    const PROSE_HISTORICAL_OLD = 'Historical/superseded: before the current deployment, the earlier SEC-51 production baseline was 0627bf78228148e3f989275810c333c16a1f3356.';
    ok('fixture: the superseded baseline is accepted only with same-claim history and past-bounding, and rejected when unbounded or current',
      supersededBaselineAlwaysMarkedHistorical(PROSE_HISTORICAL_OLD) === true &&
      supersededBaselineAlwaysMarkedHistorical(
        'Historical/superseded: production baseline 0627bf78228148e3f989275810c333c16a1f3356.') === false &&
      supersededBaselineAlwaysMarkedHistorical(
        'Production serves 0627bf78228148e3f989275810c333c16a1f3356 right now.') === false);
    ok('fixture: prose naming the deployed baseline, staged authority, pilot acceptance, and manual-promotion boundary is accepted',
      recordsPostDeploymentAuthority(PROSE_OK) === true);
    ok('fixture: post-deployment authority missing or contradicting the SHA, staged state, pilot, trigger, verification, or promotion control is rejected',
      recordsPostDeploymentAuthority(
        PROSE_OK.replace('fea3b2e11c6331eddc1ee091b165427d8e0218d7', 'baseline-redacted')) === false &&
      recordsPostDeploymentAuthority(
        PROSE_OK.replace('automatically triggered Vercel Production', 'was pushed')) === false &&
      recordsPostDeploymentAuthority(
        PROSE_OK.replace('Post-deployment verification passed within bounded anonymous read-only GET-only scope.', 'Verification was discussed.')) === false &&
      recordsPostDeploymentAuthority(
        PROSE_OK.replace('Auto-assign Custom Production Domains is disabled; future main deployments require manual promotion.', 'Git settings were reviewed.')) === false &&
      recordsPostDeploymentAuthority(
        PROSE_OK + ' The separately authorized push did not automatically trigger Vercel Production.') === false &&
      recordsPostDeploymentAuthority(
        PROSE_OK + ' Post-deployment verification remains pending.') === false &&
      recordsPostDeploymentAuthority(
        PROSE_OK + ' Auto-assign Custom Production Domains is enabled.') === false &&
      recordsPostDeploymentAuthority(
        PROSE_OK + ' Future main deployments automatically replace the live alias.') === false &&
      recordsPostDeploymentAuthority(
        PROSE_OK.replace('db05b549807535840968bf28cdefac4154a6d59d', 'authority-commit-redacted')) === false &&
      recordsPostDeploymentAuthority(
        PROSE_OK + ' Human pilot evidence remains open.') === false &&
      recordsPostDeploymentAuthority(
        PROSE_OK + ' The tested build identity was independently verified.') === false);
    ok('fixture: each stale undeployed pilot-surface claim is rejected',
      declaresStalePilotSurfaceDeploymentClaim(
        'The SEC-51 pilot-surface correction is not deployed.') === true &&
      declaresStalePilotSurfaceDeploymentClaim(
        'The pilot-surface corrections are NOT deployed.') === true &&
      declaresStalePilotSurfaceDeploymentClaim(
        'SEC-51 stands; production continues to serve the accepted baseline.') === true &&
      declaresStalePilotSurfaceDeploymentClaim(
        'The SEC-51 pilot-surface correction candidate awaits an independent Codex review.') === true);
    ok('fixture: current SEC-51 prose and explicitly historical paragraphs are both accepted',
      declaresStalePilotSurfaceDeploymentClaim(PROSE_OK) === false &&
      declaresStalePilotSurfaceDeploymentClaim(
        'Historical/superseded: the SEC-51 pilot-surface correction was not deployed at that time.') === false);
    ok('fixture: unrelated archived "awaiting review" prose is not flagged as a stale pilot-surface claim',
      declaresStalePilotSurfaceDeploymentClaim(
        'M12.P1-R6 is implemented and awaiting independent Codex review. No GO is claimed.') === false &&
      declaresStalePilotSurfaceDeploymentClaim(
        'R7 becomes implemented and awaiting independent Codex review.') === false);
    /* ---- adversarial: a history marker must never license a FALSE current
       deployment claim elsewhere in the same row or paragraph. Each case below
       satisfies every substring check (both SHAs and the host are present) and
       was accepted before the analyzers became claim-scoped. ---- */
    const SWAP_SMOKE_ROW = '| Deployment smoke | Production hostname | exercise | boots | **PASS (externally executed)** | SEC-51 against https://campusphere-cspc.vercel.app on the current deployed baseline d422b54393f659125912ec5c84ae7927c2533288; historical/superseded: fea3b2e11c6331eddc1ee091b165427d8e0218d7 |';
    const SWAP_SEC51_ROW = '| SEC-51 | Vercel production smoke | exercise | boots | **PASS (externally executed)** | against https://campusphere-cspc.vercel.app on the current deployed baseline d422b54393f659125912ec5c84ae7927c2533288; historical/superseded: fea3b2e11c6331eddc1ee091b165427d8e0218d7 |';
    const MIXED_STALE_PARAGRAPH = 'Historical/superseded: the earlier accepted baseline was d422b54393f659125912ec5c84ae7927c2533288. The SEC-51 pilot-surface correction is not deployed.';
    const SWAP_PROSE = 'Production currently serves d422b54393f659125912ec5c84ae7927c2533288. Historical/superseded: fea3b2e11c6331eddc1ee091b165427d8e0218d7. The evidence synchronization is not a runtime deployment.';

    ok('fixture: a semantic baseline swap inside a row is rejected even though both SHAs, the host, and a historical marker are present',
      analyzeDeploymentSmokeRow(M_HDR + SWAP_SMOKE_ROW + M_TAIL).length > 0 &&
      analyzeSec51ChecklistRow(SEC51_HDR + SWAP_SEC51_ROW).length > 0);
    ok('fixture: a stale undeployed claim is rejected when a NEIGHBOURING sentence carries the historical marker',
      declaresStalePilotSurfaceDeploymentClaim(MIXED_STALE_PARAGRAPH) === true);
    ok('fixture: combined prose presenting the superseded baseline as current is rejected despite a historical label on the current SHA',
      supersededBaselineAlwaysMarkedHistorical(SWAP_PROSE) === false &&
      recordsPostDeploymentAuthority(SWAP_PROSE) === false);

    /* ---- five adversarial cases from the independent re-review. The first two
       escaped topic detection by not repeating the topic after a semicolon or
       sentence break; the last three defeated SHA co-occurrence by naming a
       DIFFERENT SHA as the deployed baseline while mentioning the expected SHA
       for comparison. Each is asserted separately. ---- */
    const FAKE_SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
    const CMP_SEC51_ROW = '| SEC-51 | Vercel production smoke | exercise | boots | **PASS (externally executed)** | against https://campusphere-cspc.vercel.app on deployed baseline ' + FAKE_SHA + ', compared with fea3b2e11c6331eddc1ee091b165427d8e0218d7 for reference |';
    const CMP_SMOKE_ROW = '| Deployment smoke | Production hostname | exercise | boots | **PASS (externally executed)** | SEC-51 against https://campusphere-cspc.vercel.app on deployed baseline ' + FAKE_SHA + ', compared with fea3b2e11c6331eddc1ee091b165427d8e0218d7 for reference |';
    const CMP_PROSE = 'Production currently serves ' + FAKE_SHA + ' rather than fea3b2e11c6331eddc1ee091b165427d8e0218d7. The evidence synchronization is not a runtime deployment.';

    ok('fixture: a stale claim after a semicolon is rejected even though only the FIRST clause names the topic',
      declaresStalePilotSurfaceDeploymentClaim(
        'SEC-51 stands; production continues to serve the accepted baseline.') === true);
    ok('fixture: a stale candidate claim in the NEXT sentence is rejected even though only the first sentence names the topic',
      declaresStalePilotSurfaceDeploymentClaim(
        'SEC-51 pilot-surface correction status follows. The correction candidate awaits independent Codex review.') === true);
    ok('fixture: a SEC-51 row naming a DIFFERENT SHA as the deployed baseline is rejected despite mentioning the expected SHA for comparison',
      analyzeSec51ChecklistRow(SEC51_HDR + CMP_SEC51_ROW).length > 0);
    ok('fixture: a deployment-smoke row naming a DIFFERENT SHA as the deployed baseline is rejected despite mentioning the expected SHA for comparison',
      analyzeDeploymentSmokeRow(M_HDR + CMP_SMOKE_ROW + M_TAIL).length > 0);
    ok('fixture: prose stating production serves a DIFFERENT SHA is rejected despite an unrelated mention of the expected SHA and a truthful documentation-commit disclaimer',
      recordsPostDeploymentAuthority(CMP_PROSE) === false);

    /* ---- contradictory-deployed-SHA scope attacks. Each scope contains a
       PERFECTLY VALID binding claim for the expected SHA, alongside a
       neighbouring claim asserting production serves a different SHA. Requiring
       only "at least one valid binding" accepted all three. ---- */
    const CONFLICT_SEC51_ROW = '| SEC-51 | Vercel production smoke | exercise | boots | **PASS (externally executed)** | SEC-51 against https://campusphere-cspc.vercel.app on deployed baseline fea3b2e11c6331eddc1ee091b165427d8e0218d7; production currently serves ' + FAKE_SHA + ' |';
    const CONFLICT_SMOKE_ROW = '| Deployment smoke | Production hostname | exercise | boots | **PASS (externally executed)** | SEC-51 against https://campusphere-cspc.vercel.app on deployed baseline fea3b2e11c6331eddc1ee091b165427d8e0218d7. Production currently serves ' + FAKE_SHA + ' |';
    const CONFLICT_PROSE = 'SEC-51 ran against deployed baseline fea3b2e11c6331eddc1ee091b165427d8e0218d7. Production currently serves ' + FAKE_SHA + '. This evidence synchronization is not a runtime deployment.';
    /* Scope-skipping attack: the contradictory claim sits in its OWN paragraph
       with no SEC-51 / pilot-surface wording, so a topic-gated document scan
       never audited it. Every scope is audited now. */
    const CONFLICT_SEPARATE_PARAGRAPH =
      'SEC-51 ran against deployed baseline fea3b2e11c6331eddc1ee091b165427d8e0218d7. This evidence synchronization is not a runtime deployment.' +
      '\n\nProduction currently serves ' + FAKE_SHA + '.';
    /* History framing WITHOUT an explicit past boundary must not license a
       wrong deployed SHA; the same claim, properly past-bounded, still may. */
    const HIST_DEPLOYED_NO_PAST_BOUND = 'The historical deployed baseline ' + FAKE_SHA + ' is recorded for provenance.';
    const HIST_DEPLOYED_PAST_BOUNDED = 'Previously, at that time, the superseded deployed baseline was ' + FAKE_SHA + '.';
    const UNRELATED_BARE_SHA = 'A local commit 0f1e2d3c4b5a69788796a5b4c3d2e1f001234567 is referenced here for provenance only.';

    ok('fixture: a SEC-51 row is rejected when a neighbouring claim says production serves a different SHA, despite a valid expected-SHA binding in the same row',
      analyzeSec51ChecklistRow(SEC51_HDR + CONFLICT_SEC51_ROW).length > 0);
    ok('fixture: a deployment-smoke row is rejected when a neighbouring claim says production serves a different SHA, despite a valid expected-SHA binding in the same row',
      analyzeDeploymentSmokeRow(M_HDR + CONFLICT_SMOKE_ROW + M_TAIL).length > 0);
    ok('fixture: prose is rejected when a contradictory current-serves claim follows a valid expected-SHA binding, including when it sits in its own paragraph carrying no SEC-51 or pilot-surface wording',
      recordsPostDeploymentAuthority(CONFLICT_PROSE) === false &&
      declaresStalePilotSurfaceDeploymentClaim(CONFLICT_PROSE) === true &&
      documentConflictingDeployedShaProblems(CONFLICT_SEPARATE_PARAGRAPH).length > 0 &&
      deploymentDocumentClaimsAreCurrent(CONFLICT_SEPARATE_PARAGRAPH) === false &&
      recordsPostDeploymentAuthority(CONFLICT_SEPARATE_PARAGRAPH) === false);
    ok('fixture: a neighbouring wrong-baseline claim is rejected in the inverse order, a history-framed deployed SHA without an explicit same-claim past boundary is rejected, the past-bounded equivalent is accepted, and an unrelated bare commit SHA stays accepted',
      recordsPostDeploymentAuthority(
        'SEC-51 status: production currently serves ' + FAKE_SHA + '. The deployed baseline is fea3b2e11c6331eddc1ee091b165427d8e0218d7. This evidence synchronization is not a runtime deployment.') === false &&
      documentConflictingDeployedShaProblems(HIST_DEPLOYED_NO_PAST_BOUND).length > 0 &&
      documentConflictingDeployedShaProblems(HIST_DEPLOYED_PAST_BOUNDED).length === 0 &&
      deploymentDocumentClaimsAreCurrent(PROSE_OK) === true &&
      documentConflictingDeployedShaProblems(UNRELATED_BARE_SHA).length === 0);

    ok('fixture: empty / non-string input fails every SEC-51 synchronization check closed',
      declaresStalePilotSurfaceDeploymentClaim('') === false &&
      declaresStalePilotSurfaceDeploymentClaim(null) === false &&
      supersededBaselineAlwaysMarkedHistorical(null) === false &&
      recordsPostDeploymentAuthority('') === false &&
      recordsPostDeploymentAuthority(null) === false);
  }

  return rec.failures;
}

/* -------- static shared rate-limit gate (M12.P1-R4) --------
   Database-free, network-free. Verifies the dependency pin, the preserved
   limiter scopes/defaults/response contracts, the fail-closed shared-store
   boundary, HMAC-only key privacy, the absence of any browser-exposed Upstash
   variable, and the R4 documentation contract. The focused runtime behaviour
   lives in the standalone scripts/sharedRateLimit-probe.js. */
function runSharedRateLimitGate() {
  const rec = makeRecorder('shared-rate-limit');
  const { ok } = rec;
  const root = path.join(__dirname, '..');
  const readIf = (rel) => {
    const p = path.join(root, rel);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  };

  /* ---- dependency pinning ---- */
  const pkg = JSON.parse(readIf('package.json') || '{}');
  const deps = pkg.dependencies || {};
  ok('package.json pins @upstash/redis to EXACTLY 1.38.0',
    deps['@upstash/redis'] === '1.38.0');
  ok('the @upstash/redis pin uses no caret, tilde, or range',
    typeof deps['@upstash/redis'] === 'string' && /^\d+\.\d+\.\d+$/.test(deps['@upstash/redis']));
  ok('no alternative rate-limit dependency was added',
    !deps['@upstash/ratelimit'] && !deps['express-rate-limit'] &&
    !deps['rate-limit-redis'] && !deps.ioredis && !deps.redis);
  let lockPinned = false;
  try {
    const lock = JSON.parse(readIf('package-lock.json') || '{}');
    const entry = (lock.packages || {})['node_modules/@upstash/redis'];
    lockPinned = !!entry && entry.version === '1.38.0';
  } catch (_) { lockPinned = false; }
  ok('package-lock.json records @upstash/redis 1.38.0', lockPinned);

  /* ---- preserved limiter scopes, defaults and response contracts ---- */
  const mw = readIf('middleware/rateLimit.js');
  const DEFAULTS = [
    ['RATE_LIMIT_AUTH_MAX', 20], ['RATE_LIMIT_AUTH_WINDOW_MS', 15],
    ['RATE_LIMIT_LOGIN_ACCOUNT_MAX', 8], ['RATE_LIMIT_LOGIN_ACCOUNT_WINDOW_MS', 15],
    ['RATE_LIMIT_OAUTH_MAX', 20], ['RATE_LIMIT_OAUTH_WINDOW_MS', 10],
    ['RATE_LIMIT_PROFILE_MAX', 20], ['RATE_LIMIT_PROFILE_WINDOW_MS', 10],
    ['RATE_LIMIT_ADMIN_MUTATION_MAX', 80], ['RATE_LIMIT_ADMIN_MUTATION_WINDOW_MS', 5],
  ];
  for (const [name, value] of DEFAULTS) {
    ok(`rate-limit override ${name} is still supported with its documented default`,
      new RegExp(`intFromEnv\\('${name}',\\s*${value}\\b`).test(mw));
  }
  const { _config: liveConfig } = require('../middleware/rateLimit');
  ok('live limiter configuration keeps the five documented buckets',
    !!liveConfig && ['authPreflight', 'loginAccount', 'oauth', 'profile', 'adminMutation']
      .every((k) => liveConfig[k] && liveConfig[k].max > 0 && liveConfig[k].windowMs > 0));
  for (const scope of ['auth', 'oauth', 'profileip', 'adminip', 'login', 'profile', 'adminmut']) {
    ok(`limiter scope '${scope}' is still declared`, new RegExp(`scope: '${scope}'`).test(mw));
  }
  ok('the fixed 429 JSON message is unchanged',
    mw.includes("message: 'Too many requests. Please try again later.'"));
  ok('the 429 error view keeps its fixed title and status code',
    mw.includes("title: '429 — Too Many Requests'") && mw.includes('statusCode: 429'));
  ok('Retry-After is an integer number of seconds, at least 1',
    /Math\.max\(1,\s*Math\.ceil\(result\.resetMs\s*\/\s*1000\)\)/.test(mw) &&
    /res\.set\('Retry-After',\s*String\(retryAfter\)\)/.test(mw));
  ok('the count boundary still rejects only above max',
    /result\.count\s*>\s*max/.test(mw));
  ok('safe methods remain exempt from admin mutation limiting',
    /SAFE_METHODS\.has\(req\.method\)\)\s*return null/.test(mw));
  ok('the pre-body dispatcher still classifies auth/OAuth/profile/admin paths',
    /'\/auth\/google'/.test(mw) && /'\/auth\/callback'/.test(mw) &&
    /'\/api\/update-profile'/.test(mw) && /'\/admin\/api\/'/.test(mw));
  ok('a skipped request still calls next() exactly once',
    /if \(components == null\) return next\(\);/.test(mw));

  /* ---- fail-closed shared-store boundary ---- */
  const store = readIf('services/rateLimitStore.js');
  ok('the shared adapter uses an atomic server-side EVAL script',
    /client\.eval\(/.test(store) && /INCREMENT_SCRIPT/.test(store));
  ok('the atomic script performs INCR, PTTL and conditional PEXPIRE',
    /INCR/.test(store) && /PTTL/.test(store) && /PEXPIRE/.test(store));
  ok('no non-atomic pipeline or multi is used for the shared counter',
    !/\.pipeline\(/.test(store) && !/\.multi\(/.test(store));
  const vercelBranch = store.slice(store.indexOf('if (onVercel) {'), store.indexOf('} else {'));
  ok('the Vercel branch never constructs a process-local Map fallback',
    vercelBranch.length > 0 && !vercelBranch.includes('createMemoryCounterStore'));
  ok('the middleware returns a fixed sanitized 503 with Cache-Control: no-store',
    /res\.status\(503\)/.test(mw) && /res\.set\('Cache-Control',\s*'no-store'\)/.test(mw) &&
    /RATE_LIMIT_UNAVAILABLE_BODY/.test(mw));
  ok('the 503 body is the pinned sanitized literal',
    /RATE_LIMIT_UNAVAILABLE_BODY\s*=\s*'\{"success":false,"message":"Service temporarily unavailable\."\}'/.test(store));
  ok('a store failure never calls next()',
    /function onStoreFailure\(\)\s*\{\s*return sendUnavailable\(res\);/.test(mw));
  ok('the store creates no timers, intervals, listeners, or workers',
    !/setInterval|setTimeout|addListener|\.on\(/.test(store));
  ok('the store logs nothing (an outage cannot amplify log volume)',
    !/console\.(log|error|warn|info)/.test(store));
  /* Constructor-scoped assertions. Scanning the whole module would match its
     own explanatory prose about why `retry: false` and a custom backoff are
     wrong, so these read the actual `new Redis({...})` call. */
  const ctorStart = store.indexOf('new Redis({');
  const ctorSrc = ctorStart === -1 ? '' : store.slice(ctorStart, store.indexOf('});', ctorStart) + 3);
  ok('anonymous @upstash/redis telemetry is disabled',
    /enableTelemetry:\s*false/.test(ctorSrc));
  /* Zero retries. Verified against the installed 1.38.0 request loop
     `for (i = 0; i <= attempts; i++)`: omitted -> 6 attempts;
     `retry: false` -> attempts 1 -> 2 attempts; `{ retries: 0 }` -> 1 attempt.
     The focused probe proves the real SDK call count; this is defense in depth. */
  ok('the production Redis constructor declares retry: { retries: 0 }',
    /retry:\s*\{\s*retries:\s*0\s*\}/.test(ctorSrc));
  ok('the production Redis constructor never uses retry: false (still 2 attempts)',
    ctorSrc.length > 0 && !/retry:\s*false/.test(ctorSrc));
  ok('no custom retry backoff is configured (no retry timer)',
    ctorSrc.length > 0 && !/backoff/.test(ctorSrc));

  /* Key-level Lua locking: without the shebang Upstash takes the GLOBAL
     database lock for every rate-limit check. */
  const scriptMatch = store.match(/const INCREMENT_SCRIPT = \[([\s\S]*?)\]\.join\('\\n'\)/);
  const scriptBody = scriptMatch ? scriptMatch[1] : '';
  ok('the Lua script declares the allow-key-locking shebang as its first line',
    /^\s*'#!lua flags=allow-key-locking',/.test(scriptBody));
  {
    const { INCREMENT_SCRIPT: liveScript } = require('../services/rateLimitStore');
    const scriptLines = String(liveScript).split('\n');
    ok('the live script\'s exact first line is the allow-key-locking shebang',
      scriptLines[0] === '#!lua flags=allow-key-locking');
    ok('the live script declares exactly one shebang line',
      scriptLines.filter((l) => l.startsWith('#!')).length === 1);
    const keyIdx = [...new Set([...String(liveScript).matchAll(/KEYS\[(\d+)\]/g)].map((m) => m[1]))];
    ok('the live Lua body accesses only KEYS[1]', keyIdx.length === 1 && keyIdx[0] === '1');
    const luaCalls = [...String(liveScript).matchAll(/redis\.call\(([^)]*)\)/g)].map((m) => m[1]);
    ok('every redis.call targets only KEYS[1] with no second or computed key',
      luaCalls.length === 3 &&
      luaCalls.every((a) => /^\s*'[A-Z]+'\s*,\s*KEYS\[1\](\s*,\s*ARGV\[\d+\])?\s*$/.test(a)));
    ok('the script performs no database-wide write under allow-key-locking',
      !/FLUSH(DB|ALL)|\bSCAN\b/i.test(String(liveScript)));
  }

  /* Authoritative TTL: Retry-After must never understate the real PTTL. */
  ok('the shared adapter returns the authoritative Redis TTL unclamped',
    /return \{ count, resetMs: ttl \}/.test(store));
  ok('no Math.min clamp against the configured window is reintroduced',
    !/Math\.min\(\s*ttl\s*,\s*windowMs\s*\)/.test(store) &&
    !/resetMs:\s*Math\.min\(/.test(store));
  ok('the Upstash client is created once per runtime, not per request',
    /EXACTLY ONE client/.test(store) && !/consume[\s\S]{0,400}new Redis/.test(store));
  ok('R4 does not import or couple to the R3 readiness module',
    !/require\(\s*['"][^'"]*sessionReadiness[^'"]*['"]\s*\)/.test(store) &&
    !/require\(\s*['"][^'"]*sessionReadiness[^'"]*['"]\s*\)/.test(mw));

  /* ---- HMAC-only key privacy ---- */
  ok('bucket identifiers are HMAC-SHA-256 derived', /createHmac\('sha256'/.test(store));
  ok('component framing is length-prefixed and unambiguous',
    /Buffer\.byteLength\(value, 'utf8'\)\s*\+\s*':'/.test(store));
  ok('the storage key exposes only namespace, version, scope and digest',
    /KEY_NAMESPACE \+ ':' \+ KEY_VERSION \+ ':' \+ scope \+ ':' \+ bucketId/.test(store));
  ok('identity components are hashed before reaching any adapter',
    /deriveBucketId\(scope, components, secret \|\| null\)/.test(store));
  ok('no raw IP, email, or user id is written to a storage key or value',
    !/storageKey\([^)]*ipOf|store\.set\([^)]*email|store\.set\([^)]*req\./.test(store));

  /* ---- Vercel preflight requires the three server-only variables ---- */
  const profile = readIf('config/vercelProductionProfile.js');
  for (const name of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'RATE_LIMIT_KEY_SECRET']) {
    ok(`the Vercel preflight requires ${name}`, profile.includes(`source.${name}`));
  }
  ok('RATE_LIMIT_KEY_SECRET requires at least 32 characters',
    /RATE_LIMIT_KEY_SECRET_MIN_LENGTH = 32/.test(profile) &&
    /secret\.length >= RATE_LIMIT_KEY_SECRET_MIN_LENGTH/.test(profile));
  ok('the shared-store URL rejects embedded URL credentials',
    /parsed\.username !== ''\s*\|\|\s*parsed\.password !== ''/.test(profile));
  ok('documented placeholders are rejected for the token and key secret',
    /REJECTED_UPSTASH_TOKEN_VALUES/.test(profile) && /REJECTED_RATE_LIMIT_SECRET_VALUES/.test(profile));
  ok('the preflight stays pure (no require) and performs no network call',
    !/\brequire\s*\(/.test(profile) && !/fetch\s*\(|new Redis|@upstash\/redis/.test(profile));
  ok('the R4 failure reuses the ONE fixed sanitized refusal',
    (profile.match(/new VercelProductionProfileError\(\)/g) || []).length >= 5 &&
    (profile.match(/VERCEL_PROFILE_ERROR_MESSAGE =/g) || []).length === 1);

  /* ---- no browser exposure ---- */
  const R4_SECRET_NAMES = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'RATE_LIMIT_KEY_SECRET'];
  function scanTree(rel, exts) {
    const base = path.join(root, rel);
    const hits = [];
    const walk = (dir) => {
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { walk(full); continue; }
        if (!exts.some((x) => e.name.endsWith(x))) continue;
        let text = '';
        try { text = fs.readFileSync(full, 'utf8'); } catch (_) { continue; }
        if (R4_SECRET_NAMES.some((n) => text.includes(n))) hits.push(path.relative(root, full));
      }
    };
    walk(base);
    return hits;
  }
  const publicHits = scanTree('public', ['.js', '.html', '.css', '.json', '.webmanifest']);
  const viewHits = scanTree('views', ['.ejs', '.html']);
  ok('no Upstash/rate-limit secret name is referenced anywhere under public/',
    publicHits.length === 0);
  ok('no Upstash/rate-limit secret name is referenced in any EJS view',
    viewHits.length === 0);
  ok('the shared-store variables are read only on the server',
    /env, 'UPSTASH_REDIS_REST_URL'/.test(store) || /readTrimmed\(env, 'UPSTASH_REDIS_REST_URL'\)/.test(store));

  /* ---- no live credential committed ---- */
  const r4Sources = [store, mw, profile, readIf('.env.example'), readIf('docs/deployment.md')].join('\n');
  ok('no live Upstash endpoint or token literal appears in R4 sources or docs',
    !/https:\/\/[a-z0-9-]+\.upstash\.io(?!["'`\s]*[>|)])/i.test(r4Sources.replace(/YOUR-DATABASE\.upstash\.io/g, '')) &&
    !/UPSTASH_REDIS_REST_TOKEN\s*=\s*["'][A-Za-z0-9_-]{20,}["']/.test(r4Sources));
  ok('no RATE_LIMIT_KEY_SECRET literal is assigned in source or documentation',
    !/RATE_LIMIT_KEY_SECRET\s*=\s*["'][A-Za-z0-9_-]{20,}["']/.test(r4Sources));

  /* ---- documentation contract ---- */
  const envExample = readIf('.env.example');
  const deployDoc = readIf('docs/deployment.md');
  for (const [label, doc] of [['.env.example', envExample], ['docs/deployment.md', deployDoc]]) {
    const flat = doc.replace(/\s+/g, ' ');
    /* Phrase checks run against PROSE: strip the markdown emphasis and comment
       markers that legitimately interrupt a sentence ("**never** falls back",
       a `#`-prefixed continuation line) so the assertion tests the wording, not
       the formatting. */
    const prose = doc.replace(/[*`#>|]/g, ' ').replace(/\s+/g, ' ');
    ok(`${label} documents the exact @upstash/redis 1.38.0 pin`,
      /@upstash\/redis[^.]{0,80}1\.38\.0/.test(flat));
    ok(`${label} names all three Vercel-only shared-store variables`,
      R4_SECRET_NAMES.every((n) => doc.includes(n)));
    ok(`${label} documents the 32-character RATE_LIMIT_KEY_SECRET minimum`,
      /(at least|>=)\s*32\s*characters/i.test(flat));
    ok(`${label} documents HMAC-only Redis key privacy`,
      /HMAC/i.test(flat) && /csrl:v1/.test(flat));
    ok(`${label} documents the atomic shared-counter behaviour`,
      /atomic/i.test(flat));
    ok(`${label} documents the local in-memory behaviour and no Vercel fallback`,
      /in-memory/i.test(prose) &&
      /never\s+(silently\s+)?falls?\s+back\s+to\s+a\s+process-local\s+map/i.test(prose));
    ok(`${label} documents the fixed sanitized 503`,
      /503/.test(flat) && /no-store/i.test(flat));
    ok(`${label} states the values are never exposed to the browser`,
      /(server-only|never .{0,60}(browser|client))/i.test(flat));
  }
  ok('docs/deployment.md preserves the existing 429 and Retry-After contract',
    /429/.test(deployDoc) && /Retry-After/.test(deployDoc));
  ok('docs/security-checklist.md adds shared rate-limit security cases',
    /SEC-19/.test(readIf('docs/security-checklist.md')) &&
    /SEC-2[012]/.test(readIf('docs/security-checklist.md')));

  return rec.failures;
}

/* =============================================================================
   M12.P1-R5 — bounded anonymous access-denial auditing (in-suite static gate)
   =============================================================================
   Database-free and network-free. Proves, from the REAL sources, that routine
   anonymous denials persist nothing while the authenticated wrong-role denial
   still writes exactly one sanitized row. The focused runtime evidence lives in
   the STANDALONE scripts/boundedAnonymousAccessDenial-probe.js, which this gate
   asserts is NOT registered inside npm test.

   Every structural assertion runs through ONE pure analyzer, so the negative
   fixtures below drive the same code path the live-source assertions use: a
   mutation that reintroduces an anonymous audit write, drops the actor guard,
   audits twice, or restores a query-bearing target is caught here rather than
   silently accepted. */

const R5_HELPER = 'auditAuthenticatedAccessDenied';
const R5_PREDICATE = 'isAuditableActor';
const R5_RECORD = 'auditService.record';
const R5_PROBE_SCRIPT = 'boundedAnonymousAccessDenial-probe.js';

/* Standalone M12.P1 readiness probes. None may be spawned by npm test: their
   totals are reported separately and must never inflate the suite total. */
const R5_STANDALONE_PROBES = Object.freeze([
  'pilotCredentialSafety-probe.js',        // R1
  'vercelProductionProfile-probe.js',      // R2
  'vercelRuntimeSessionBootstrap-probe.js',// R3
  'sharedRateLimit-probe.js',              // R4
  R5_PROBE_SCRIPT,                         // R5
]);

/* Raw request material that must never be readable inside the audit helper.
   wantsJson() legitimately negotiates on Accept / Content-Type, so this scan is
   deliberately scoped to the HELPER BODY — what actually reaches a column. */
const R5_RAW_REQUEST_PATTERNS = Object.freeze([
  /\breq\s*\.\s*ips?\b/, /\breq\s*\.\s*headers\b/, /\breq\s*\.\s*rawHeaders\b/,
  /\breq\s*\.\s*get\s*\(/, /\breq\s*\.\s*body\b/, /\breq\s*\.\s*(signed)?[Cc]ookies\b/,
  /\breq\s*\.\s*query\b/, /\breq\s*\.\s*sessionID\b/, /\breq\s*\.\s*session\b/,
  /\bremoteAddress\b/, /x-forwarded-for/i, /\bsocket\s*\.\s*remote/,
]);

/* Persistence/scheduling machinery R5 must not introduce anywhere in the
   middleware: no denial counters in Redis, no timers, no retries, no batching. */
const R5_FORBIDDEN_MACHINERY = Object.freeze([
  /\bsetInterval\s*\(/, /\bsetTimeout\s*\(/, /\bsetImmediate\s*\(/,
  /\bretry\b/i, /\bbackoff\b/i, /\baggregat/i, /\bflush\s*\(/,
  /@upstash/i, /\bredis\b/i, /rateLimitStore/, /\bCREATE TABLE\b/i, /\bINSERT INTO\b/i,
]);

/* NOTE on forbidden-pattern scanning. These files DOCUMENT the guarantees they
   are asserted against — the audit repository's header records that
   "UPDATE/DELETE/TRUNCATE" were revoked, and the R5 probe's header records that
   it never kills a process and never deletes audit rows. A bare prose scan
   therefore made correct files fail their own contract.

   A comment stripper was tried and REJECTED: this repository contains regex
   literals holding an odd number of quote characters (for example the
   csrf-token matcher), and a non-parsing lexer flips into a string state on
   them and stops recognising later comments. Rather than ship a subtly wrong
   lexer, every scan below is written as a precise CODE SHAPE — a real SQL
   statement against `system_logs`, a real `.kill(`/`.delete(`/`.update(` call
   — which prose describing the guarantee cannot match. */

/** PURE: the `{...}` block that starts at the first brace at/after `fromIndex`. */
function r5BraceBlock(src, fromIndex) {
  const s = String(src == null ? '' : src);
  const open = s.indexOf('{', fromIndex);
  if (open === -1) return '';
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '{') depth += 1;
    else if (s[i] === '}') { depth -= 1; if (depth === 0) return s.slice(open, i + 1); }
  }
  return '';
}

const r5Count = (haystack, needle) => String(haystack).split(needle).length - 1;

/**
 * PURE structural analysis of middleware/roleAuth.js.
 *
 * Splits the three decision branches (anonymous requireLogin, anonymous
 * requireRole, authenticated wrong-role) plus the audit helper, and reports the
 * audit-invocation counts, the actor guard, the fixed taxonomy, the query-free
 * target, and the preserved HTML/JSON denial contracts.
 *
 * @param {string} src middleware/roleAuth.js source
 * @returns {object} structural report consumed by both live and fixture checks
 */
function analyzeAnonymousDenialAudit(src) {
  const s = String(src == null ? '' : src);

  const helperBody = s.indexOf('function ' + R5_HELPER) === -1
    ? '' : r5BraceBlock(s, s.indexOf('function ' + R5_HELPER));
  const loginBody = s.indexOf('const requireLogin =') === -1
    ? '' : r5BraceBlock(s, s.indexOf('const requireLogin ='));
  const roleBody = s.indexOf('const requireRole =') === -1
    ? '' : r5BraceBlock(s, s.indexOf('const requireRole ='));

  const anonMarker = roleBody.indexOf('if (!req.session || !req.session.user)');
  const anonRoleBody = anonMarker === -1 ? '' : r5BraceBlock(roleBody, anonMarker);
  const wrongRoleBody = anonRoleBody === '' ? roleBody : roleBody.replace(anonRoleBody, '');

  // ANY audit invocation — direct service call OR the authenticated helper.
  const auditRefs = (text) =>
    r5Count(text, R5_RECORD + '(') + r5Count(text, R5_HELPER + '(');

  const guardIdx = helperBody.indexOf(R5_PREDICATE + '(');
  const recordIdx = helperBody.indexOf(R5_RECORD + '(');

  return {
    helperFound: helperBody !== '',
    requireLoginFound: loginBody !== '',
    requireRoleFound: roleBody !== '',
    anonRoleBranchFound: anonRoleBody !== '',

    // R5 core: anonymous branches must not audit at all.
    anonLoginAuditRefs: auditRefs(loginBody),
    anonRoleAuditRefs: auditRefs(anonRoleBody),

    // Exactly one authenticated write, through the helper, never direct.
    wrongRoleHelperCalls: r5Count(wrongRoleBody, R5_HELPER + '('),
    wrongRoleDirectRecordCalls: r5Count(wrongRoleBody, R5_RECORD + '('),
    fileRecordCalls: r5Count(s, R5_RECORD + '('),

    // The helper refuses a null/malformed/roleless actor BEFORE recording.
    helperGuardsBeforeRecord:
      guardIdx !== -1 && recordIdx !== -1 && guardIdx < recordIdx &&
      new RegExp('if\\s*\\(\\s*!\\s*' + R5_PREDICATE + '\\s*\\([^)]*\\)\\s*\\)\\s*return\\s+false\\s*;')
        .test(helperBody),

    // Fixed taxonomy + query-free route target.
    taxonomyIntact:
      helperBody.includes("event_type: 'authorization'") &&
      helperBody.includes("action: 'access.denied'") &&
      helperBody.includes("outcome: 'denied'") &&
      helperBody.includes("target_type: 'route'") &&
      helperBody.includes("message: 'Access to a protected route was denied.'"),
    queryFreeTarget:
      /originalUrl[\s\S]{0,60}\.split\('\?'\)\[0\]/.test(helperBody) &&
      !/req\s*\.\s*query/.test(helperBody),
    helperReadsNoRawRequestMaterial:
      helperBody !== '' && !R5_RAW_REQUEST_PATTERNS.some((re) => re.test(helperBody)),

    // Preserved denial responses.
    anonLoginKeeps401Json:
      /res\.status\(401\)\.json\(\{ success: false, message: 'Authentication required\.' \}\)/.test(loginBody),
    anonLoginKeepsRedirect: /return res\.redirect\('\/auth'\);/.test(loginBody),
    anonRoleKeeps401Json:
      /res\.status\(401\)\.json\(\{ success: false, message: 'Authentication required\.' \}\)/.test(anonRoleBody),
    anonRoleKeepsRedirect: /return res\.redirect\('\/auth'\);/.test(anonRoleBody),
    wrongRoleKeeps403Json:
      /res\.status\(403\)\.json\(\{ success: false, message: 'You do not have permission to perform this action\.' \}\)/
        .test(wrongRoleBody),
    wrongRoleKeeps403Html:
      /res\.status\(403\)\.render\('error'/.test(wrongRoleBody) &&
      /statusCode: 403/.test(wrongRoleBody),
    wantsJsonPreserved:
      /function wantsJson\(req\)/.test(s) &&
      r5Count(loginBody, 'wantsJson(req)') === 1 &&
      r5Count(roleBody, 'wantsJson(req)') === 2,
  };
}

/** PURE: is `script` absent from everything the stage plan spawns? */
function r5IsStandaloneProbe(stages, script) {
  return !flattenStagePlan(stages).includes(script);
}

/**
 * PURE structural analysis of the AUTHORITATIVE global-total contract inside
 * scripts/boundedAnonymousAccessDenial-probe.js (R5 follow-up).
 *
 * Codex found that proving a FILTERED authorization/denied count stayed flat
 * only shows one taxonomy did not grow. The probe must additionally pin the
 * unfiltered `summary.total`. Everything here is a CODE SHAPE — a real
 * assignment, a real call, or a relative source position — so explanatory prose
 * naming the same identifiers cannot satisfy any assertion. Behaviour is
 * separately proven by driving the probe's REAL exported helpers.
 *
 * @param {string} src probe source
 * @returns {object} structural report consumed by live checks and fixtures
 */
function analyzeGlobalTotalContract(src) {
  const s = String(src == null ? '' : src);

  const at = (needle) => (s.indexOf(needle) === -1 ? '' : r5BraceBlock(s, s.indexOf(needle)));
  const validatorBody = at('function validateLogsBody(');
  const readLogsBody = at('async function readLogs(');
  const runModeBody = at('async function runMode(');

  // Distinct assignments: the authoritative count and the filtered count are
  // resolved from different fields and can never be silently swapped.
  const GLOBAL_ASSIGN = /const\s+globalTotal\s*=\s*toCount\(\s*body\.summary\.total\s*\)/;
  const FILTERED_ASSIGN = /const\s+total\s*=\s*toCount\(\s*body\.total\s*\)/;

  const BASELINE_CALL = /const\s+globalBaseline\s*=\s*await\s+readStableGlobalTotal\s*\(/;
  const POSTCONDITION_CALL = /await\s+globalTotalStaysAt\s*\(/;

  const iBaseline = runModeBody.search(BASELINE_CALL);
  const iPost = runModeBody.search(POSTCONDITION_CALL);
  const iHtml = runModeBody.indexOf("base + '/dashboard'");
  const iJson = runModeBody.indexOf("base + '/admin/api/logs'");
  const countOf = (text, re) => (text.match(re) || []).length;

  const readsSummary = GLOBAL_ASSIGN.test(validatorBody);
  const readsFiltered = FILTERED_ASSIGN.test(validatorBody);

  return {
    validatorReadsSummaryTotal: readsSummary,
    validatorReadsFilteredTotal: readsFiltered,
    validatorSeparatesCounts: readsSummary && readsFiltered,

    // readLogs must delegate shape/count validation, not re-implement it.
    readLogsUsesValidator:
      /return\s+validateLogsBody\(\s*res\.status\s*,\s*body\s*\)/.test(readLogsBody),
    readLogsHasNoAdHocShapeCheck:
      !/body\.success\s*!==\s*true/.test(readLogsBody) &&
      !/Array\.isArray\(\s*body\.logs\s*\)/.test(readLogsBody),

    baselineAssignments: countOf(runModeBody, new RegExp(BASELINE_CALL.source, 'g')),
    postconditionCalls: countOf(runModeBody, new RegExp(POSTCONDITION_CALL.source, 'g')),

    // Ordering is what makes the postcondition meaningful.
    baselineBeforeHtmlBatch: iBaseline !== -1 && iHtml !== -1 && iBaseline < iHtml,
    baselineBeforeJsonBatch: iBaseline !== -1 && iJson !== -1 && iBaseline < iJson,
    postconditionAfterHtmlBatch: iPost !== -1 && iHtml !== -1 && iPost > iHtml,
    postconditionAfterJsonBatch: iPost !== -1 && iJson !== -1 && iPost > iJson,

    // Defence in depth: the original filtered assertion must survive, anchored
    // on its own D-section baseline so the F-section call cannot satisfy it.
    retainsFilteredDeniedAssertion:
      /totalStaysAt\(\s*base\s*,\s*adminJar\s*,\s*AUTHZ_DENIED_QUERY\s*,\s*deniedBase\.total\s*\)/
        .test(runModeBody),

    usesUnfilteredGlobalQuery:
      /const\s+GLOBAL_TOTAL_QUERY\s*=\s*'limit=1'/.test(s) &&
      /readLogs\(\s*base\s*,\s*jar\s*,\s*GLOBAL_TOTAL_QUERY\s*\)/.test(s),
  };
}

async function runBoundedAnonymousDenialGate() {
  const rec = makeRecorder('bounded-anon-denial');
  const { ok } = rec;
  const root = path.join(__dirname, '..');
  const readIf = (rel) => {
    const p = path.join(root, rel);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  };

  const roleAuthSrc = readIf(path.join('middleware', 'roleAuth.js'));
  const live = analyzeAnonymousDenialAudit(roleAuthSrc);

  /* ---- structure resolved (a failed split must never look like a pass) ---- */
  ok('roleAuth exposes the authenticated-only denial helper', live.helperFound);
  ok('roleAuth requireLogin body resolved', live.requireLoginFound);
  ok('roleAuth requireRole body resolved', live.requireRoleFound);
  ok('roleAuth requireRole anonymous branch resolved', live.anonRoleBranchFound);

  /* ---- R5 core contract ---- */
  ok('anonymous requireLogin performs NO audit invocation', live.anonLoginAuditRefs === 0);
  ok('anonymous requireRole performs NO audit invocation', live.anonRoleAuditRefs === 0);
  ok('the authenticated wrong-role branch invokes the helper exactly once',
    live.wrongRoleHelperCalls === 1);
  ok('the authenticated wrong-role branch never calls the audit service directly',
    live.wrongRoleDirectRecordCalls === 0);
  ok('roleAuth contains exactly one auditService.record call site in total',
    live.fileRecordCalls === 1);
  ok('the helper refuses a null/malformed/roleless actor before recording',
    live.helperGuardsBeforeRecord);

  /* ---- fixed taxonomy, query-free target, no raw request material ---- */
  ok('the fixed authorization taxonomy and sanitized message are intact', live.taxonomyIntact);
  ok('the audit target is the query-free request path', live.queryFreeTarget);
  ok('the helper reads no raw IP/header/body/cookie/session material',
    live.helperReadsNoRawRequestMaterial);

  /* ---- denial responses remain byte/shape compatible ---- */
  ok('anonymous requireLogin keeps the exact fixed 401 JSON denial', live.anonLoginKeeps401Json);
  ok('anonymous requireLogin keeps the exact 302 /auth redirect', live.anonLoginKeepsRedirect);
  ok('anonymous requireRole keeps the exact fixed 401 JSON denial', live.anonRoleKeeps401Json);
  ok('anonymous requireRole keeps the exact 302 /auth redirect', live.anonRoleKeepsRedirect);
  ok('the wrong-role branch keeps the exact fixed 403 JSON denial', live.wrongRoleKeeps403Json);
  ok('the wrong-role branch keeps the 403 error.ejs HTML denial', live.wrongRoleKeeps403Html);
  ok('wantsJson negotiation is preserved on all three denial branches', live.wantsJsonPreserved);

  /* ---- the REAL predicate refuses every non-authenticated actor ---- */
  {
    // Required lazily: the gate must stay database-free, and roleAuth pulls in
    // the (lazy, never queried) MySQL pool through the audit service.
    const { isAuditableActor } = require('../middleware/roleAuth');
    const REFUSED = [
      ['null actor', null],
      ['undefined actor', undefined],
      ['empty object actor', {}],
      ['string actor', 'admin'],
      ['numeric actor', 7],
      ['array actor', []],
      ['missing id', { role: 'admin' }],
      ['null id', { id: null, role: 'admin' }],
      ['zero id', { id: 0, role: 'admin' }],
      ['negative id', { id: -1, role: 'admin' }],
      ['fractional id', { id: 1.5, role: 'admin' }],
      ['non-numeric id', { id: 'abc', role: 'admin' }],
      ['NaN id', { id: NaN, role: 'admin' }],
      ['roleless actor', { id: 1 }],
      ['null role', { id: 1, role: null }],
      ['empty role', { id: 1, role: '' }],
      ['blank role', { id: 1, role: '   ' }],
      ['non-string role', { id: 1, role: 7 }],
    ];
    for (const [label, actor] of REFUSED) {
      ok('the actor guard refuses: ' + label, isAuditableActor(actor) === false);
    }
    ok('the actor guard accepts a positive integer id with a non-blank role',
      isAuditableActor({ id: 1, role: 'student-cspc' }) === true &&
      isAuditableActor({ id: 42, role: 'guest' }) === true);
  }

  /* ---- negative fixtures: mutations of the REAL source must be caught ---- */
  {
    const baseline = analyzeAnonymousDenialAudit(roleAuthSrc);
    ok('fixture: the live source satisfies the analyzer contract',
      baseline.anonLoginAuditRefs === 0 && baseline.anonRoleAuditRefs === 0 &&
      baseline.wrongRoleHelperCalls === 1 && baseline.helperGuardsBeforeRecord === true &&
      baseline.queryFreeTarget === true);

    // 1/2. Either anonymous branch calling auditService.record DIRECTLY.
    const loginDirect = roleAuthSrc.replace(
      "  if (wantsJson(req)) {\n    return res.status(401).json({ success: false, message: 'Authentication required.' });",
      "  " + R5_RECORD + "({});\n  if (wantsJson(req)) {\n    return res.status(401).json({ success: false, message: 'Authentication required.' });");
    ok('fixture: an anonymous requireLogin auditService.record call is flagged',
      loginDirect !== roleAuthSrc && analyzeAnonymousDenialAudit(loginDirect).anonLoginAuditRefs > 0);

    const roleDirect = roleAuthSrc.replace(
      '      // Anonymous caller hitting a role-gated route:',
      '      ' + R5_RECORD + '({});\n      // Anonymous caller hitting a role-gated route:');
    ok('fixture: an anonymous requireRole auditService.record call is flagged',
      roleDirect !== roleAuthSrc && analyzeAnonymousDenialAudit(roleDirect).anonRoleAuditRefs > 0);

    // 3/4. Either anonymous branch calling the AUTHENTICATED helper.
    const loginHelper = roleAuthSrc.replace(
      '  if (req.session && req.session.user) {\n    return next();\n  }',
      '  if (req.session && req.session.user) {\n    return next();\n  }\n  ' + R5_HELPER + '(req, null);');
    ok('fixture: an anonymous requireLogin call to the authenticated helper is flagged',
      loginHelper !== roleAuthSrc && analyzeAnonymousDenialAudit(loginHelper).anonLoginAuditRefs > 0);

    const roleHelper = roleAuthSrc.replace(
      '      // Anonymous caller hitting a role-gated route:',
      '      ' + R5_HELPER + '(req, null);\n      // Anonymous caller hitting a role-gated route:');
    ok('fixture: an anonymous requireRole call to the authenticated helper is flagged',
      roleHelper !== roleAuthSrc && analyzeAnonymousDenialAudit(roleHelper).anonRoleAuditRefs > 0);

    // 5. A null actor reaching the audit service (guard removed).
    const guardless = roleAuthSrc.replace(
      '  if (!' + R5_PREDICATE + '(actor)) return false;\n', '');
    ok('fixture: removing the actor guard lets a null actor reach the audit service and is flagged',
      guardless !== roleAuthSrc && analyzeAnonymousDenialAudit(guardless).helperGuardsBeforeRecord === false);

    // 6. The authenticated branch auditing twice.
    const doubleAudit = roleAuthSrc.replace(
      '    ' + R5_HELPER + '(req, req.session.user);',
      '    ' + R5_HELPER + '(req, req.session.user);\n    ' + R5_HELPER + '(req, req.session.user);');
    ok('fixture: a duplicated authenticated audit write is flagged',
      doubleAudit !== roleAuthSrc && analyzeAnonymousDenialAudit(doubleAudit).wrongRoleHelperCalls === 2);

    // 7. An audit target that includes the query string.
    const queryTarget = roleAuthSrc.replace(
      "target_id: ((req && req.originalUrl) || '').split('?')[0],",
      "target_id: ((req && req.originalUrl) || ''),");
    ok('fixture: a query-bearing audit target is flagged',
      queryTarget !== roleAuthSrc && analyzeAnonymousDenialAudit(queryTarget).queryFreeTarget === false);

    // 8. Raw request material read inside the helper. Anchored on a unique
    //    substring rather than an indented line, so the fixture cannot silently
    //    become a no-op if the helper is reformatted.
    const rawIp = roleAuthSrc.replace(
      "target_type: 'route',", "target_type: 'route', actor_ip: req.ip,");
    ok('fixture: raw request material inside the helper is flagged',
      rawIp !== roleAuthSrc &&
      analyzeAnonymousDenialAudit(rawIp).helperReadsNoRawRequestMaterial === false);

    // 9. A weakened denial response.
    const weakened = roleAuthSrc.replace(
      "return res.status(401).json({ success: false, message: 'Authentication required.' });",
      "return res.status(200).json({ success: true });");
    ok('fixture: a changed anonymous denial response is flagged',
      weakened !== roleAuthSrc && analyzeAnonymousDenialAudit(weakened).anonLoginKeeps401Json === false);
  }

  /* ---- no new persistence/scheduling machinery ---- */
  ok('roleAuth introduces no timer, retry, aggregation, or Redis denial path',
    !R5_FORBIDDEN_MACHINERY.some((re) => re.test(roleAuthSrc)));
  {
    const requires = (roleAuthSrc.match(/require\(\s*['"]([^'"]+)['"]\s*\)/g) || [])
      .map((m) => (m.match(/['"]([^'"]+)['"]/) || [])[1]);
    ok('roleAuth still imports exactly one module (the audit service)',
      requires.length === 1 && requires[0] === '../services/auditService');
  }

  /* ---- migration inventory and no anonymous-denial persistence ---- */
  {
    let migrations = [];
    try {
      migrations = fs.readdirSync(path.join(root, 'database', 'supabase'))
        .filter((n) => n.endsWith('.sql')).sort();
    } catch (e) { /* empty list fails below */ }
    const numbers = migrations.map((n) => (n.match(/^(\d{4})/) || [])[1]).filter(Boolean);
    ok('Supabase migration sources are contiguous through 0020 (R5 added no denial table)',
      numbers.length === 20 && numbers.every((n, index) => n === String(index + 1).padStart(4, '0')) &&
      migrations.includes('0020_room_schedule_documents.sql'));

    const schema = readIf(path.join('database', 'schema.sql'));
    ok('no anonymous-denial table was added to the MySQL schema',
      !/CREATE TABLE[^;]{0,200}(anonymous|anon_)[^;]{0,80}deni/i.test(schema) &&
      !/CREATE TABLE[^;]{0,120}access_denied/i.test(schema));
  }

  /* ---- the audit service/repository keep their append-only contract ---- */
  {
    const service = readIf(path.join('services', 'auditService.js'));
    const repo = readIf(path.join('repositories', 'auditRepository.js'));
    ok('the audit service still declares the authorization/access.denied taxonomy',
      service.includes("'authorization'") && service.includes("'access.denied'") &&
      service.includes("'denied'"));
    /* Real statements/calls only. auditRepository's header sentence
       "UPDATE/DELETE/TRUNCATE revoked" documents the guarantee and must not be
       mistaken for a violation, so each pattern requires a genuine target. */
    ok('the audit service and repository remain append-only (no update/delete/truncate path)',
      !/\b(?:DELETE\s+FROM|UPDATE|TRUNCATE(?:\s+TABLE)?)\s+system_logs\b/i.test(service + repo) &&
      !/\.delete\s*\(/.test(repo) && !/\.update\s*\(/.test(repo) &&
      !/\.delete\s*\(/.test(service) && !/\.update\s*\(/.test(service));
    ok('the audit service still performs exactly one INSERT into system_logs',
      (service.match(/INSERT INTO system_logs/gi) || []).length === 1 &&
      /\.insert\(/.test(repo));
  }

  /* ---- standalone versus npm-test accounting ---- */
  for (const script of R5_STANDALONE_PROBES) {
    ok(`${script} exists on disk`, fs.existsSync(path.join(__dirname, script)));
    ok(`${script} stays OUT of the npm-test registration (standalone accounting)`,
      r5IsStandaloneProbe(SPAWNED_PROBE_STAGES, script));
  }
  ok('fixture: registering the R5 probe inside npm test is flagged',
    r5IsStandaloneProbe(
      [...SPAWNED_PROBE_STAGES,
        { key: 'r5', prefix: 'r5', heading: '[r5]', probes: [['r5 probe', R5_PROBE_SCRIPT]] }],
      R5_PROBE_SCRIPT) === false);
  ok('the R5 gate consumes the executed stage plan by identity',
    flattenStagePlan(SPAWNED_PROBE_STAGES).length > 0);

  /* ---- the final residue gate is still registered exactly once, and last ---- */
  {
    const residue = evaluateResidueRegistration(SPAWNED_PROBE_STAGES, RESIDUE_PROBE_SCRIPT);
    ok('the canonical residue gate remains registered exactly once', residue.exactlyOnce);
    ok('the canonical residue gate remains the FINAL registered spawned probe', residue.isFinalScript);
    ok('the canonical residue gate remains in the FINAL stage, alone',
      residue.isFinalStage && residue.finalStageIsResidueOnly);
  }

  /* ---- the focused probe honours its own R5 boundaries ---- */
  {
    const probe = readIf(path.join('scripts', R5_PROBE_SCRIPT));
    ok('the R5 probe uses the self-terminating with-server harness',
      /require\('\.\/with-server'\)/.test(probe) && !/app\.listen\(/.test(probe));
    ok('the R5 probe uses the dedicated ports 3381/3382 and confirms they are free',
      /3381/.test(probe) && /3382/.test(probe) && /portIsFree/.test(probe));
    /* Code shapes, not prose: the probe's header states that it never kills a
       process, so only a real kill/spawn call may fail this. */
    ok('the R5 probe never kills or spawns a process itself',
      !/\.kill\s*\(/.test(probe) && !/process\.kill/.test(probe) &&
      !/require\(\s*['"]child_process['"]\s*\)/.test(probe));
    ok('the R5 probe uses the shared regression credential loader',
      /require\('\.\/regressionCredentials'\)/.test(probe));
    ok('the R5 probe owns and terminates its sessions from a finally',
      /require\('\.\/probeSessionLifecycle'\)/.test(probe) &&
      /finally\s*\{[\s\S]{0,600}terminateAll\(\)/.test(probe));
    ok('the R5 probe fails closed instead of skipping the Supabase leg',
      /hasSupabaseConfig\(\)/.test(probe) && /Supabase leg is never skipped/.test(probe));
    ok('the R5 probe never deletes, truncates, or repairs audit rows',
      !/\b(?:DELETE\s+FROM|TRUNCATE(?:\s+TABLE)?|UPDATE)\s+system_logs\b/i.test(probe) &&
      !/\.delete\s*\(/.test(probe) && !/\.update\s*\(/.test(probe));
    ok('the R5 probe reads audit state only through the admin-only log API',
      /\/admin\/api\/logs/.test(probe) &&
      !/require\(\s*['"]\.\.\/config\/db['"]\s*\)/.test(probe) &&
      !/require\(\s*['"]\.\.\/repositories\/auditRepository['"]\s*\)/.test(probe));
    ok('the R5 probe opens no direct database or repository handle at all',
      !/require\(\s*['"][^'"]*(?:config\/db|repositories\/)[^'"]*['"]\s*\)/.test(probe) &&
      !/db\.query\s*\(/.test(probe) && !/getSupabaseClient\s*\(/.test(probe));

    /* ---- authoritative global-total contract (R5 follow-up) ---- */
    const g = analyzeGlobalTotalContract(probe);
    ok('the R5 probe resolves the authoritative count from body.summary.total',
      g.validatorReadsSummaryTotal);
    ok('the R5 probe reads the FILTERED count from a distinct field (body.total)',
      g.validatorReadsFilteredTotal && g.validatorSeparatesCounts);
    ok('the R5 probe routes every log read through the fail-closed validator',
      g.readLogsUsesValidator && g.readLogsHasNoAdHocShapeCheck);
    ok('the R5 probe establishes a stable global baseline exactly once',
      g.baselineAssignments === 1);
    ok('the R5 probe asserts the global postcondition exactly once',
      g.postconditionCalls === 1);
    ok('the R5 global baseline is captured BEFORE both anonymous batches',
      g.baselineBeforeHtmlBatch && g.baselineBeforeJsonBatch);
    ok('the R5 global postcondition runs AFTER both anonymous batches',
      g.postconditionAfterHtmlBatch && g.postconditionAfterJsonBatch);
    ok('the R5 probe retains the filtered AUTHZ_DENIED_QUERY assertion',
      g.retainsFilteredDeniedAssertion);
    ok('the R5 probe uses the unfiltered query for the authoritative reads',
      g.usesUnfilteredGlobalQuery);
  }

  /* ---- the REAL exported helpers, driven database-free ---- */
  {
    const r5 = require('./boundedAnonymousAccessDenial-probe');

    // Bounded-polling convention is pinned, not merely described.
    ok('the R5 probe pins the bounded polling convention (24 reads / 250 ms / 6)',
      r5.POLL_ATTEMPTS === 24 && r5.POLL_DELAY_MS === 250 && r5.GLOBAL_STABILITY_READS === 6);
    ok('the R5 authoritative read is unfiltered and the denied read is filtered',
      r5.GLOBAL_TOTAL_QUERY === 'limit=1' &&
      /event_type=authorization/.test(r5.AUTHZ_DENIED_QUERY) &&
      /outcome=denied/.test(r5.AUTHZ_DENIED_QUERY));

    /* toCount: only a non-negative integer NUMBER is a count. */
    for (const [label, value] of [
      ['undefined', undefined], ['null', null], ['numeric string', '12'],
      ['empty string', ''], ['NaN', NaN], ['Infinity', Infinity],
      ['fractional', 1.5], ['negative', -1], ['boolean', true],
      ['object', {}], ['array', []],
    ]) {
      ok('R5 toCount rejects ' + label, r5.toCount(value) === null);
    }
    ok('R5 toCount accepts zero and positive integers',
      r5.toCount(0) === 0 && r5.toCount(7) === 7);

    /* validateLogsBody: the authoritative count comes from summary.total and is
       NEVER substituted by the filtered body.total. */
    const goodBody = { success: true, logs: [{ id: 9 }], total: 3, summary: { total: 41 } };
    const good = r5.validateLogsBody(200, goodBody);
    ok('R5 validateLogsBody accepts a well-formed body',
      !!good && good.ok === true && good.top !== null);
    ok('R5 validateLogsBody reads globalTotal from summary.total, not body.total',
      !!good && good.globalTotal === 41 && good.total === 3);

    for (const [label, status, body] of [
      ['a non-200 status', 500, goodBody],
      ['success !== true', 200, { ...goodBody, success: false }],
      ['a missing logs array', 200, { success: true, total: 3, summary: { total: 41 } }],
      ['a missing summary object', 200, { success: true, logs: [], total: 3 }],
      ['a summary without total (global count removed)', 200,
        { success: true, logs: [], total: 3, summary: { success: 1 } }],
      ['a null summary.total', 200,
        { success: true, logs: [], total: 3, summary: { total: null } }],
      ['a stringified summary.total', 200,
        { success: true, logs: [], total: 3, summary: { total: '41' } }],
      ['a negative summary.total', 200,
        { success: true, logs: [], total: 3, summary: { total: -1 } }],
      ['a fractional summary.total', 200,
        { success: true, logs: [], total: 3, summary: { total: 1.5 } }],
      ['a missing filtered total', 200, { success: true, logs: [], summary: { total: 41 } }],
      ['a non-object body', 200, 'nope'],
      ['a null body', 200, null],
      ['an array body', 200, []],
    ]) {
      ok('R5 validateLogsBody fails closed on ' + label,
        r5.validateLogsBody(status, body) === null);
    }

    /* Bounded helpers driven from stub read sequences: no server, no database,
       no network, no sleeping (delayMs 0). */
    const seq = (values) => {
      let i = 0;
      return async () => {
        const v = values[Math.min(i, values.length - 1)];
        i += 1;
        return v;
      };
    };
    const R = (globalTotal) => ({ ok: true, total: 0, globalTotal, top: null });
    const BAD = { ok: false, total: -1, globalTotal: -1, top: null };

    const stable = await r5.readStableGlobalTotal('', {}, {
      read: seq([R(10), R(10)]), delayMs: 0,
    });
    ok('R5 readStableGlobalTotal accepts two consecutive equal reads',
      stable.ok === true && stable.globalTotal === 10 && stable.reads === 2);

    const settles = await r5.readStableGlobalTotal('', {}, {
      read: seq([R(10), R(11), R(12), R(12)]), delayMs: 0,
    });
    ok('R5 readStableGlobalTotal waits through a moving total and settles',
      settles.ok === true && settles.globalTotal === 12 && settles.reads === 4);

    const neverStable = await r5.readStableGlobalTotal('', {}, {
      read: (() => { let n = 0; return async () => R(n++); })(), attempts: 5, delayMs: 0,
    });
    ok('R5 readStableGlobalTotal fails closed when no two reads agree',
      neverStable.ok === false && neverStable.globalTotal === -1);

    const bridged = await r5.readStableGlobalTotal('', {}, {
      read: seq([R(10), BAD, R(10), BAD]), attempts: 4, delayMs: 0,
    });
    ok('R5 readStableGlobalTotal refuses to bridge an invalid read',
      bridged.ok === false);

    ok('R5 globalTotalStaysAt holds across six consecutive equal reads',
      (await r5.globalTotalStaysAt('', {}, 10, { read: seq([R(10)]), delayMs: 0 })) === true);
    ok('R5 globalTotalStaysAt fails when the authoritative total grows',
      (await r5.globalTotalStaysAt('', {}, 10,
        { read: seq([R(10), R(10), R(11), R(11), R(11), R(11)]), delayMs: 0 })) === false);
    ok('R5 globalTotalStaysAt fails closed on an unusable read',
      (await r5.globalTotalStaysAt('', {}, 10,
        { read: seq([R(10), BAD]), delayMs: 0 })) === false);
    ok('R5 globalTotalStaysAt refuses a malformed expected baseline',
      (await r5.globalTotalStaysAt('', {}, -1, { read: seq([R(-1)]), delayMs: 0 })) === false);
  }

  /* ---- negative fixtures: mutations of the REAL probe source ---- */
  {
    const probe = readIf(path.join('scripts', R5_PROBE_SCRIPT));
    const base = analyzeGlobalTotalContract(probe);
    ok('fixture: the live probe satisfies the global-total contract',
      base.validatorReadsSummaryTotal && base.baselineAssignments === 1 &&
      base.postconditionCalls === 1 && base.postconditionAfterJsonBatch &&
      base.retainsFilteredDeniedAssertion);

    // 1. The authoritative global count is removed from the validator.
    const noGlobal = probe.replace('toCount(body.summary.total)', 'null');
    ok('fixture: removing the authoritative summary.total read is flagged',
      noGlobal !== probe && analyzeGlobalTotalContract(noGlobal).validatorReadsSummaryTotal === false);

    // 2. The global count is replaced by the FILTERED count.
    const substituted = probe.replace('toCount(body.summary.total)', 'toCount(body.total)');
    ok('fixture: substituting body.total for the authoritative count is flagged',
      substituted !== probe &&
      analyzeGlobalTotalContract(substituted).validatorSeparatesCounts === false);

    // 3. The postcondition is omitted entirely.
    const noPostcondition = probe.replace(
      'const globalHeld = await globalTotalStaysAt(', 'const globalHeld = true || (');
    ok('fixture: omitting the global postcondition is flagged',
      noPostcondition !== probe &&
      analyzeGlobalTotalContract(noPostcondition).postconditionCalls === 0);

    // 4. The baseline is captured AFTER the anonymous batches (too late).
    const lateBaseline = probe.replace(
      'const globalBaseline = await readStableGlobalTotal(base, adminJar);', '')
      .replace('    const globalHeld = await globalTotalStaysAt(',
        '    const globalBaseline = await readStableGlobalTotal(base, adminJar);\n    const globalHeld = await globalTotalStaysAt(');
    ok('fixture: capturing the baseline after the anonymous batches is flagged',
      lateBaseline !== probe &&
      analyzeGlobalTotalContract(lateBaseline).baselineBeforeHtmlBatch === false);

    // 5. The filtered defence-in-depth assertion is dropped.
    const noFiltered = probe.replace('AUTHZ_DENIED_QUERY, deniedBase.total', 'GLOBAL_TOTAL_QUERY, 0');
    ok('fixture: dropping the filtered authorization assertion is flagged',
      noFiltered !== probe &&
      analyzeGlobalTotalContract(noFiltered).retainsFilteredDeniedAssertion === false);

    // 6. The validator is bypassed by an ad-hoc shape check.
    const adHoc = probe.replace('return validateLogsBody(res.status, body) || INVALID_READ;',
      'return { ok: res.status === 200, total: Number(body.total), globalTotal: 0, top: null };');
    ok('fixture: bypassing the fail-closed validator in readLogs is flagged',
      adHoc !== probe && analyzeGlobalTotalContract(adHoc).readLogsUsesValidator === false);
  }

  return rec.failures;
}

/* -------- static service-worker precache stylesheet hygiene gate (L8) -------- */
function runSwPrecacheGate() {
  const rec = makeRecorder('sw-precache');
  const { ok } = rec;
  const root = path.join(__dirname, '..');
  const sw = fs.readFileSync(path.join(root, 'public', 'sw.js'), 'utf8');
  const precache = (sw.match(/PRECACHE_URLS\s*=\s*\[([\s\S]*?)\]/) || [])[1] || '';

  // L8: assert the exact canonical stylesheet / cache-version contract — a v7+
  // cache version (so removing the stale variant actually evicts the prior
  // same-named shell cache), exactly one precached /css/styles.css entry, and
  // that every shared-navbar consumer uses the same query key.
  const cacheVersionMatch = sw.match(/CACHE_VERSION\s*=\s*'v(\d+)'/);
  const cacheVersion = cacheVersionMatch ? Number(cacheVersionMatch[1]) : 0;
  const stylesheetEntries = precache.match(/\/css\/styles\.css\?v=\d+/g) || [];

  ok('sw.js cache version is v7 or higher for stale-shell eviction', cacheVersion >= 7);
  ok('sw.js precache drops /css/styles.css?v=2', !/\/css\/styles\.css\?v=2/.test(precache));
  ok('sw.js precache has exactly one /css/styles.css entry', stylesheetEntries.length === 1);
  const canonicalStylesheet = stylesheetEntries[0] || '';
  ok('sw.js precache stylesheet is canonical /css/styles.css?v=7',
    canonicalStylesheet === '/css/styles.css?v=7');

  // No EJS view may reference the stale ?v=2 stylesheet, and every view that
  // references the versioned shared stylesheet must match the precache key.
  const stale = [];
  const stylesheetConsumers = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.ejs')) {
        const source = fs.readFileSync(p, 'utf8');
        if (/\/css\/styles\.css\?v=2/.test(source)) stale.push(name);
        const refs = source.match(/\/css\/styles\.css\?v=\d+/g) || [];
        if (refs.length > 0) stylesheetConsumers.push({ name, refs });
      }
    }
  };
  walk(path.join(root, 'views'));
  ok('no EJS view references /css/styles.css?v=2', stale.length === 0);
  const offlineSource = fs.readFileSync(path.join(root, 'public', 'offline.html'), 'utf8');
  const offlineRefs = offlineSource.match(/\/css\/styles\.css\?v=\d+/g) || [];
  stylesheetConsumers.push({ name: 'public/offline.html', refs: offlineRefs });
  ok('all versioned shared stylesheet consumers match the service-worker precache key',
    stylesheetConsumers.length > 0 && stylesheetConsumers.every(({ refs }) =>
      refs.length === 1 && refs[0] === canonicalStylesheet));

  return rec.failures;
}

/* -------- static room-scheduling docs/deployment wording gate (semester images) -------- */
function runScheduleDocsGate() {
  const rec = makeRecorder('schedule-docs');
  const { ok } = rec;
  const root = path.join(__dirname, '..');
  const readIf = (rel) => { const p = path.join(root, rel); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; };
  const envEx = readIf('.env.example');
  const readme = readIf('README.md');
  const deploy = readIf(path.join('docs', 'deployment.md'));
  const agents = readIf('AGENTS.md');
  const claude = readIf('CLAUDE.md');
  const grounding = readIf(path.join('docs', 'new-session-grounding-prompts.md'));
  const dbPerfGate = readIf(path.join('scripts', 'db-perf-gate.js'));

  ok('.env.example documents SCHEDULE_DATA_SOURCE', envEx.includes('SCHEDULE_DATA_SOURCE'));
  ok('.env.example names legacy schedule migrations plus owner-applied 0020 for the image runtime',
    envEx.includes('0012_room_schedules') && envEx.includes('0013_vr_hotspot_schedule_metadata') &&
    envEx.includes('0020_room_schedule_documents'));
  ok('README documents schedule migrations and the current owner-applied 0001-0020 span',
    readme.includes('0012_room_schedules') &&
    readme.includes('0013_vr_hotspot_schedule_metadata') &&
    readme.includes('0020_room_schedule_documents') &&
    /0001[\s\S]{0,80}0020/.test(readme));
  ok('README drops stale 0001-0011-as-current migration span', !/0001.{1,3}0011/.test(readme));
  ok('deployment.md lists 0012, 0013, and 0020 in the apply order',
    deploy.includes('0012_room_schedules') && deploy.includes('0013_vr_hotspot_schedule_metadata') &&
    deploy.includes('0020_room_schedule_documents'));
  ok('deployment.md documents SCHEDULE_DATA_SOURCE', deploy.includes('SCHEDULE_DATA_SOURCE'));
  ok('deployment.md production GO gate covers 0012, 0013, and owner-applied 0020',
    /GO gate[\s\S]{0,900}0012_room_schedules[\s\S]{0,900}0013_vr_hotspot_schedule_metadata[\s\S]{0,900}0020_room_schedule_documents/i.test(deploy) &&
    /0020[\s\S]{0,180}separate owner operational authorization/i.test(deploy));
  for (const [name, doc] of [['AGENTS.md', agents], ['CLAUDE.md', claude]]) {
    ok(`${name} documents SCHEDULE_DATA_SOURCE + roomScheduleDocumentRepository`,
      doc.includes('SCHEDULE_DATA_SOURCE') && doc.includes('roomScheduleDocumentRepository'));
    ok(`${name} documents the owner-applied 0020 direct-link boundary`,
      doc.includes('0020_room_schedule_documents') && doc.includes('schedule_document_id') &&
      /0020[\s\S]{0,180}owner-applied/i.test(doc));
  }
  // Anti-scope wording: schedules are real admin-managed data, never
  // SIS/enrollment/instructor-load simulation.
  for (const [name, doc] of [['README.md', readme], ['deployment.md', deploy], ['AGENTS.md', agents], ['CLAUDE.md', claude]]) {
    ok(`${name} states schedules are admin-managed, not SIS/enrollment simulation`,
      /admin-managed[\s\S]{0,400}(SIS|enrollment)/i.test(doc));
  }
  ok('grounding prompts no longer claim 0013 should not exist', !/0013 should not exist/i.test(grounding));
  ok('grounding prompts preserve the accepted historical 0001-0019 boundary', /0001[\s\S]{0,40}0019/.test(grounding));
  ok('db-perf gate no longer claims 0013 owner apply is pending',
    !/(0013[\s\S]{0,160}owner apply is required|owner apply is required[\s\S]{0,160}0013)/i.test(dbPerfGate));

  return rec.failures;
}

/* -------- semester room-schedule image probe gate --------
   Database-free and network-free. Runtime CRUD parity stays a separate gate
   until migration 0020 is explicitly authorized and applied to the selected
   verification backends. The old time-row probes remain in source as legacy
   transition evidence but are no longer registered in the active flow. */
const SCHEDULE_PROBES = [
  ['semester room schedule image contracts', 'roomScheduleDocument-probe.js'],
];

// Milestone 11, Section 11.8C (+ BE.4): Free Roam 360 (map entry ->
// /vr/scene-guard-house scene browser at the Guard House, routeless; /vr
// stays a compatible fallback). Kept separate from SCHEDULE_PROBES because it
// exercises the Free Roam domain rather than schedule-document behavior.
const FREE_ROAM_PROBES = [
  ['free-roam VR scene browser contracts', 'freeRoamVr-probe.js'],
];

// M12.P1-D1: truthful logout/session termination — the authenticated
// no-store GET /auth/csrf-token endpoint, invalid-token 403 without cookie
// clearing, JSON + HTML form logout contracts, former-cookie replay
// isolation, and the mocked destroy-failure unit gate (no clear, no
// redirect, sanitized 500).
const LOGOUT_PROBES = [
  ['logout/session-termination contracts', 'logoutSessionTermination-probe.js'],
];

// M12.P1-D2: one shared authenticated-navigation owner (markup/ARIA/behavior
// via mock DOM), removed page-local hamburger handlers, 44px/focus-visible/
// reduced-motion CSS contracts, and rendered-brand correctness.
const SHARED_NAV_PROBES = [
  ['shared mobile navigation + brand contracts', 'sharedMobileNavigation-probe.js'],
];

// Public participant-facing FAQ: dual-backend SSR route, escaped admin content,
// anonymous/signed-in discovery, progressive-enhancement search/filter UX, and
// explicit exclusion from the offline/service-worker package.
const PUBLIC_FAQ_PROBES = [
  ['public FAQ contracts', 'publicFaq-probe.js'],
];

// Administrator-managed institutional settings are projected into the
// signed-in About page and shared public footers. Database-free focused probe.
const SITE_SETTINGS_PROBES = [
  ['site settings projection contracts', 'siteSettings-probe.js'],
];

// Authenticated navbar notifications: role-safe announcements + upcoming
// events, accessible disclosure behavior, browser-seen revision state, and
// network-only API handling. Database-free focused probe.
const NOTIFICATION_PANEL_PROBES = [
  ['notification panel contracts', 'notificationPanel-probe.js'],
];

// M12.P1-D4: admin campus-map search/filter — bounded `q` text search with
// backend-parity metacharacter encoding, additive appliedFilters metadata,
// stale-response protection, and the repaired route/node/edge and
// building/endpoint selector searches.
const ADMIN_SEARCH_FILTER_PROBES = [
  ['admin campus-map search + filter contracts', 'adminCampusMapSearchFilter-probe.js'],
];

// M12.P1-D5: friendly building additional-details editor — structured
// replacement for the raw details JSON textarea. Covers the pure
// parse/serialize contract (supported keys, legacy {num,use} rooms, string
// and {office,floor} info items, unknown top-level/nested preservation,
// mixed and unsupported-shape preservation, malformed roots failing closed,
// server-mirrored bounds, prototype-pollution safety), the view/script/CSS
// contracts, and dual-backend admin-API create/edit/null-details coverage
// with self-cleaning prefixed fixtures.
const BUILDING_DETAILS_EDITOR_PROBES = [
  ['building additional-details editor contracts', 'buildingDetailsEditor-probe.js'],
];

// M12.P1-D6: real admin dashboard analytics — Asia/Manila calendar-month
// arithmetic, half-open boundary semantics, exact four-role normalisation,
// composition over mocked MySQL/Supabase/mixed adapters, truthful zero and
// sanitized-unavailable states, accessible rendering, non-admin denial, the
// mock-DOM resize/theme redraw contracts, and an independent SELECT-only
// comparison against whichever configured backends are reachable. The probe
// authenticates nobody and owns no session.
const ADMIN_ANALYTICS_PROBES = [
  ['admin dashboard analytics contracts', 'adminDashboardAnalytics-probe.js'],
];

// M12.P1-D3: shared VR hotspot-navigation helper — strict same-origin /vr/
// URL acceptance (exact guided nav_url passthrough + validated Free Roam
// scene-key construction), native Pannellum URL + target="_self" decoration
// with no scene clickHandlerFunc, one helper include per VR view before
// viewer init, preserved accessible fallback links, separate schedule
// integration, and controller target-key normalization via isSafeSceneKey.
const VR_HOTSPOT_NAV_PROBES = [
  ['VR hotspot navigation contracts', 'vrHotspotNavigation-probe.js'],
];

// VR light/dark page chrome, saved-theme initialization, and the shared
// accessible theme-control contract. Database-free source assertions.
const VR_THEME_PROBES = [
  ['VR theme contracts', 'vrTheme-probe.js'],
];

// Catalog-wide resolver/helper logic: fail-closed natural destination policy,
// stored endpoint mapping, media metadata, and per-hotspot navigation. Pure
// fixtures; no server or database.
const GUIDED_VR_RESOLUTION_PROBES = [
  ['guided VR resolution pure-logic contracts', 'guidedVrResolution-probe.js'],
];

// BE.4 NO-GO repair: pure repair-utility safety logic (order-independent
// fingerprints, simulated projections, final-state validation, verified
// rollback, VR full-semantic parity + transaction pre-commit gating) with
// in-memory fixtures and mocked adapters. No server, no DB.
const BE4_REPAIR_SAFETY_PROBES = [
  ['BE.4 repair-utility safety contracts', 'be4RepairSafety-probe.js'],
];

// BE.5 selected 13-building demo parity: database-free transaction,
// backup/fingerprint/rollback guards for the MySQL correction utility plus
// static safety checks for owner-applied data-only migration 0019.
const BE5_SELECTED_DEMO_PARITY_PROBES = [
  ['BE.5 selected-demo parity correction safety contracts', 'be5SelectedDemoParity-probe.js'],
];

// BE.6 expanded freeze: immutable migration hashes, reproducible seed source,
// backend-specific current catalogs/graphs, and all 25 Guided-VR chains. The
// probe is SELECT-only and fails closed on any live or source drift.
const BE6_DATASET_FREEZE_PROBES = [
  ['BE.6 selected-demo dataset freeze contracts', 'be6DatasetFreeze-probe.js'],
];

// Catalog-wide Guided VR across uniform and mixed source configurations. Every
// active destination resolves its configured natural node and exact scene chain.
const GUIDED_VR_PROBES = [
  ['catalog-wide Guided-VR runtime contracts', 'guidedCasVr-probe.js'],
];

// Pre-Milestone-12 RF.3: additive route.geometry on /api/pathfind (helpers +
// both-modes API contract + reverse/fallback/malformed cases + leak scans).
const ROUTE_GEOMETRY_PROBES = [
  ['road-following route geometry API contracts', 'routeGeometryApi-probe.js'],
];

// Pre-Milestone-12 RF.5: public /map draws route.geometry (fallback to
// route.nodes) — extracted client validator/selector logic, static source
// invariants, and a both-modes live /api/pathfind drawable-geometry check.
const PUBLIC_ROUTE_RENDER_PROBES = [
  ['public road-following route rendering contracts', 'publicRoadRouteRendering-probe.js'],
];

// Post-RF.6 truth: authoritative Guard House / Main Gate start + eastern
// buildings as TERMINAL destinations (not transit hops). Asserts the repaired
// MySQL topology, the gate-attached geometry, building-footprint clearance,
// and 0017's owner-applied shape with fail-closed MySQL/Supabase parity.
const ROUTE_TOPOLOGY_PROBES = [
  ['route topology (Guard House start + eastern terminal destinations)', 'routeTopology-probe.js'],
];

// Preserve the reproducible 13-building source roster while freezing each
// backend's complete current catalog and graph. Live names are unique, every
// building node maps exactly once, and all configured destinations are reachable.
const BUILDING_BASELINE_PROBES = [
  ['seed baseline plus expanded live building catalogs', 'buildingBaseline-probe.js'],
];

// BE.3: public + admin surfaces share ONE server-computed route-availability
// truth (services/routeAvailability.js). Proves every active catalog destination
// resolves through its exact natural node key in every supported source mode,
// and that a staged-but-unrouted
// building (created and deleted through the ADMIN HTTP API only) stays visible as
// campus information while its destination/VR actions are withdrawn and no
// /api/pathfind is issued for it.
const BUILDING_INTEGRATION_PROBES = [
  ['building dataset integration (route availability across public + admin)', 'buildingDatasetIntegration-probe.js'],
];

/* FINAL gate: after every other spawned probe has run and cleaned up, assert the
   POSTCONDITION directly in the stores — zero unexpired persisted sessions for
   any canonical regression identity. Per-request logout/cookie/replay checks
   cannot prove the final global state; this can. SELECT-only.

   This is NOT scripts/pilotCredentialSafety-probe.js (R1), which stays
   standalone and is deliberately never registered here. */
const SESSION_RESIDUE_PROBES = [
  ['canonical session residue (zero unexpired sessions in both stores)', 'probeSessionResidue-probe.js'],
];

/* ---------------- THE spawned-probe stage plan (single source of truth) ----------------
   main() executes exactly this constant, in this order, and the ownership gate
   derives its inventory from this same object identity. There is no second,
   manually maintained list to drift: reordering execution necessarily reorders
   what the gate validates, so "the residue stage runs last" cannot silently
   become false while the assertion stays green.

   Each stage: { key, heading, prefix, probes } — heading and prefix are the
   exact strings previously used inline, so console output is unchanged. */
const SPAWNED_PROBE_STAGES = [
  { key: 'schedule', prefix: 'schedule', probes: SCHEDULE_PROBES,
    heading: '[Room scheduling QA] (semester image source contracts + direct VR linkage + legacy fallback)' },
  { key: 'free-roam', prefix: 'free-roam', probes: FREE_ROAM_PROBES,
    heading: '[Free Roam 360 QA] (map entry + /vr scene browser + routeless-contract probe)' },
  { key: 'logout', prefix: 'logout', probes: LOGOUT_PROBES,
    heading: '[Logout/session-termination QA] (M12.P1-D1 fresh-token endpoint + truthful logout probe)' },
  { key: 'shared-nav', prefix: 'shared-nav', probes: SHARED_NAV_PROBES,
    heading: '[Shared mobile navigation QA] (M12.P1-D2 single nav owner + ARIA + brand probe)' },
  { key: 'public-faq', prefix: 'public-faq', probes: PUBLIC_FAQ_PROBES,
    heading: '[Public FAQ QA] (dual-backend SSR + escaped content + accessible search/filter + online-only boundary)' },
  { key: 'site-settings', prefix: 'site-settings', probes: SITE_SETTINGS_PROBES,
    heading: '[Site settings QA] (admin-managed About/footer projection + allowlist + safe fallbacks)' },
  { key: 'notifications', prefix: 'notifications', probes: NOTIFICATION_PANEL_PROBES,
    heading: '[Notification panel QA] (role-safe announcements + upcoming events + accessible disclosure)' },
  { key: 'vr-hotspot-nav', prefix: 'vr-hotspot-nav', probes: VR_HOTSPOT_NAV_PROBES,
    heading: '[VR hotspot navigation QA] (M12.P1-D3 shared helper + native Pannellum link contract)' },
  { key: 'vr-theme', prefix: 'vr-theme', probes: VR_THEME_PROBES,
    heading: '[VR theme QA] (light/dark page chrome + saved preference + accessible toggle)' },
  { key: 'admin-search-filter', prefix: 'admin-search-filter', probes: ADMIN_SEARCH_FILTER_PROBES,
    heading: '[Admin campus-map search/filter QA] (M12.P1-D4 bounded q + appliedFilters + graph/selector searches)' },
  { key: 'building-details-editor', prefix: 'building-details-editor', probes: BUILDING_DETAILS_EDITOR_PROBES,
    heading: '[Building details editor QA] (M12.P1-D5 structured details editor + preservation contracts)' },
  { key: 'admin-analytics', prefix: 'admin-analytics', probes: ADMIN_ANALYTICS_PROBES,
    heading: '[Admin dashboard analytics QA] (M12.P1-D6 Asia/Manila months + exact roles + truthful zero/unavailable + independent backend comparison)' },
  { key: 'guided-vr-resolution', prefix: 'guided-vr-resolution', probes: GUIDED_VR_RESOLUTION_PROBES,
    heading: '[Guided VR resolution QA] (catalog policy + stored endpoints + media-aware chain + hotspot nav)' },
  { key: 'be4-repair-safety', prefix: 'be4-repair-safety', probes: BE4_REPAIR_SAFETY_PROBES,
    heading: '[BE.4 repair-utility safety QA] (pure fingerprints/simulation/validation/rollback + VR parity/transaction)' },
  { key: 'be5-selected-demo-parity', prefix: 'be5-selected-demo-parity', probes: BE5_SELECTED_DEMO_PARITY_PROBES,
    heading: '[BE.5 selected-demo parity safety QA] (pure MySQL transaction guards + migration 0019 static review)' },
  { key: 'be6-dataset-freeze', prefix: 'be6-dataset-freeze', probes: BE6_DATASET_FREEZE_PROBES,
    heading: '[BE.6 expanded freeze QA] (seed baseline + backend catalogs + all Guided-VR natural-key fingerprints)' },
  { key: 'guided-cas', prefix: 'guided-cas', probes: GUIDED_VR_PROBES,
    heading: '[Guided-VR catalog QA] (25 natural-key chains + stored endpoints + mixed-source combos)' },
  { key: 'route-geometry', prefix: 'route-geometry', probes: ROUTE_GEOMETRY_PROBES,
    heading: '[Road-following route geometry QA] (RF.3 route.geometry API + helper probe)' },
  { key: 'public-route-render', prefix: 'public-route-render', probes: PUBLIC_ROUTE_RENDER_PROBES,
    heading: '[Public road-following route rendering QA] (RF.5 client selector + static invariants + live geometry)' },
  { key: 'route-topology', prefix: 'route-topology', probes: ROUTE_TOPOLOGY_PROBES,
    heading: '[Route topology QA] (Guard House start + eastern terminal destinations + 0017 static shape)' },
  { key: 'building-baseline', prefix: 'building-baseline', probes: BUILDING_BASELINE_PROBES,
    heading: '[Building baseline QA] (13-building seed source + backend-specific expanded catalogs + reachability)' },
  { key: 'building-integration', prefix: 'building-integration', probes: BUILDING_INTEGRATION_PROBES,
    heading: '[Building dataset integration QA] (BE.3 shared route availability across public + admin)' },
  /* LAST by construction: every session-creating probe above has finished, so
     the store-level postcondition is meaningful. */
  { key: 'session-residue', prefix: 'session-residue', probes: SESSION_RESIDUE_PROBES,
    heading: '[Canonical session residue] (SELECT-only postcondition: zero unexpired canonical sessions)' },
];

/**
 * PURE: flatten a stage plan to the ordered registered script inventory.
 * Takes only the plan, so the gate and the runner cannot disagree.
 */
function flattenStagePlan(stages) {
  const out = [];
  for (const stage of (Array.isArray(stages) ? stages : [])) {
    for (const entry of (stage && Array.isArray(stage.probes) ? stage.probes : [])) {
      if (Array.isArray(entry) && typeof entry[1] === 'string') out.push(entry[1]);
    }
  }
  return out;
}

/* -------- with-server environment resolution (database-free) --------
   The ambient environment sets SESSION_STORE=supabase. scripts/with-server.js
   previously assigned env.SESSION_STORE only when a caller passed
   `sessionStore`, so an omitted value let that ambient supabase store survive
   into a nominal MySQL data leg — nine authenticating probes were persisting
   canonical sessions into Supabase while running MySQL data.

   These checks drive the REAL resolver (buildEnv) with a temporarily
   overridden ambient value. No server is spawned, no port is opened, and no
   inherited environment value or secret is ever printed. */
function runWithServerEnvGate() {
  const rec = makeRecorder('with-server-env');
  const { ok } = rec;
  const { buildEnv } = require('./with-server');

  const SOURCE_KEYS = ['AUTH_DATA_SOURCE', 'CONTENT_DATA_SOURCE', 'BUILDING_DATA_SOURCE',
    'ROUTE_DATA_SOURCE', 'VR_DATA_SOURCE', 'SCHEDULE_DATA_SOURCE'];

  /* Baseline captured ONCE, before any case runs: both whether the property
     existed and its exact value. The final assertion compares against these,
     so a gate that silently dropped or rewrote the ambient value is caught.
     The value itself is never printed. */
  const AMBIENT_HAD = Object.prototype.hasOwnProperty.call(process.env, 'SESSION_STORE');
  const AMBIENT_VALUE = process.env.SESSION_STORE;

  // Run `fn` with SESSION_STORE forced to `ambient`, always restoring after.
  const withAmbientStore = (ambient, fn) => {
    const had = Object.prototype.hasOwnProperty.call(process.env, 'SESSION_STORE');
    const previous = process.env.SESSION_STORE;
    if (ambient === undefined) delete process.env.SESSION_STORE;
    else process.env.SESSION_STORE = ambient;
    try { return fn(); } finally {
      if (had) process.env.SESSION_STORE = previous;
      else delete process.env.SESSION_STORE;
    }
  };

  // 1. Ambient supabase + omitted store + mysql mode -> mysql (the regression).
  ok('ambient supabase + omitted store + mysql mode resolves SESSION_STORE=mysql',
    withAmbientStore('supabase', () => buildEnv('mysql', 3999, undefined, undefined).SESSION_STORE) === 'mysql');

  // 2. The mirror case: ambient mysql must not leak into a supabase leg.
  ok('ambient mysql + omitted store + supabase mode resolves SESSION_STORE=supabase',
    withAmbientStore('mysql', () => buildEnv('supabase', 3999, undefined, undefined).SESSION_STORE) === 'supabase');

  // 3. An explicit valid override is honored over both ambient and mode.
  ok('explicit sessionStore override is honored',
    withAmbientStore('supabase', () => buildEnv('supabase', 3999, 'mysql', undefined).SESSION_STORE) === 'mysql' &&
    withAmbientStore('mysql', () => buildEnv('mysql', 3999, 'supabase', undefined).SESSION_STORE) === 'supabase');

  // 4. Explicit values are normalized (case/whitespace) before validation.
  ok('explicit sessionStore is normalized before use',
    withAmbientStore('supabase', () => buildEnv('mysql', 3999, '  MySQL ', undefined).SESSION_STORE) === 'mysql');

  // 5. All six data-source switches still follow the normalized mode.
  {
    const env = withAmbientStore('supabase', () => buildEnv('  SUPABASE ', 3999, undefined, undefined));
    ok('all six data-source switches follow the normalized mode',
      SOURCE_KEYS.every((k) => env[k] === 'supabase') && env.SESSION_STORE === 'supabase');
  }

  // 6. sourceOverrides still apply AFTER the uniform mode.
  {
    const env = withAmbientStore('supabase', () => buildEnv('mysql', 3999, 'mysql', { VR_DATA_SOURCE: 'supabase' }));
    ok('sourceOverrides still apply after the uniform mode',
      env.VR_DATA_SOURCE === 'supabase' && env.AUTH_DATA_SOURCE === 'mysql' && env.SESSION_STORE === 'mysql');
  }

  // 7. The inherited environment is preserved and PORT is set.
  {
    const env = withAmbientStore('supabase', () => buildEnv('mysql', 3456, 'mysql', undefined));
    ok('inherited environment is preserved and PORT is assigned',
      env.PORT === '3456' && Object.keys(env).length > SOURCE_KEYS.length + 2);
  }

  // 8. Fail-closed matrix. A blank explicit store must NOT inherit ambient.
  const rejects = (label, fn) => {
    let threw = false;
    try { fn(); } catch (e) { threw = true; }
    ok(label, threw === true);
  };
  rejects('invalid mode fails closed',
    () => withAmbientStore('supabase', () => buildEnv('postgres', 3999, undefined, undefined)));
  rejects('blank mode fails closed',
    () => withAmbientStore('supabase', () => buildEnv('   ', 3999, undefined, undefined)));
  rejects('invalid explicit sessionStore fails closed',
    () => withAmbientStore('supabase', () => buildEnv('mysql', 3999, 'redis', undefined)));
  rejects('blank explicit sessionStore fails closed (never inherits ambient)',
    () => withAmbientStore('supabase', () => buildEnv('mysql', 3999, '   ', undefined)));
  rejects('unknown sourceOverrides key fails closed',
    () => withAmbientStore('supabase', () => buildEnv('mysql', 3999, 'mysql', { NOPE_DATA_SOURCE: 'mysql' })));
  rejects('invalid sourceOverrides value fails closed',
    () => withAmbientStore('supabase', () => buildEnv('mysql', 3999, 'mysql', { VR_DATA_SOURCE: 'mongo' })));

  /* 9. EXACT restoration: the same property-presence state, and — when it was
     originally present — the identical value. "undefined or any string" would
     accept a silently rewritten ambient store, which is the very class of bug
     this gate exists to catch. Neither value is printed. */
  {
    const hasNow = Object.prototype.hasOwnProperty.call(process.env, 'SESSION_STORE');
    const restored = hasNow === AMBIENT_HAD &&
      (AMBIENT_HAD ? process.env.SESSION_STORE === AMBIENT_VALUE : true);
    ok('ambient SESSION_STORE is restored exactly (same presence and value)', restored);
  }

  return rec.failures;
}

/* -------- local anonymous-session maintenance gate (database-free) --------
   The historical readiness poll used GET /auth and left identity-free rows in
   the explicit local MySQL fallback. The operator path is deliberately
   operator-only and must remain fail-closed: it can inspect only the exact
   cookie+csrfToken shape, refuses every other session shape, and mutates only
   through the conditional MysqlSessionStore interface. These fixtures use
   fake stores/pools and never contact either database. */
async function runLocalSessionMaintenanceGate() {
  const rec = makeRecorder('local-session-maintenance');
  const { ok } = rec;
  const root = path.join(__dirname, '..');
  const read = (rel) => {
    const p = path.join(root, ...rel.split('/'));
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  };
  const source = read('scripts/cleanupHarnessReadinessMysqlSessions.js');
  const storeSource = read('services/mysqlSessionStore.js');
  const maintenance = require('./cleanupHarnessReadinessMysqlSessions');

  ok('local maintenance operator exists outside the runtime package surface',
    source.includes('cleanupHarnessReadinessMysqlSessions') &&
    source.includes('Local-only operator') &&
    read('.vercelignore').includes('scripts/'));
  ok('operator has no direct DML or bulk-delete SQL',
    !/\b(?:DELETE|UPDATE|INSERT)\s+(?:FROM|INTO|`)/i.test(source) &&
    !/store\.destroy\(sid/.test(source) &&
    /store\.destroyIfUnchanged\(/.test(source));
  ok('operator defaults to dry-run and requires explicit apply evidence',
    /let apply = false/.test(source) && /mode: 'dry-run'/.test(source) &&
    /expected-count/.test(source) && /expected-sha256/.test(source) &&
    /if \(apply && \(expectedCount === null \|\| expectedSha256 === null\)\)/.test(source));
  ok('operator refuses production, Vercel, non-MySQL, and non-local database values',
    /store !== 'mysql'/.test(source) && /nodeEnv === 'production'/.test(source) &&
    /VERCEL_ENV/.test(source) && /LOCAL_HOSTS/.test(source) &&
    /EXPECTED_DB_NAME/.test(source));
  ok('operator never prints SIDs, cookies, tokens, payloads, SQL, or raw errors',
    !/console\.(?:log|error)\([^\n]*(?:sid|cookie|csrfToken|sess|SQL|raw)/i.test(source) &&
    /sanitizedError/.test(source));
  ok('operator performs only a read-only parameterized maintenance snapshot',
    /async function inspectHarnessReadinessSessions\(/.test(source) &&
    /SELECT sid, sess, expires_at FROM/.test(source) &&
    /WHERE expires_at > \? ORDER BY sid ASC/.test(source) &&
    /\[nowMs\]/.test(source) &&
    !/inspectHarnessReadinessSessions[\s\S]{0,1800}\b(?:DELETE|UPDATE|INSERT)\b/i.test(source));
  ok('operator recognizes only the exact cookie + csrfToken readiness shape',
    /keys\.length === 2/.test(source) &&
    /keys\[0\] === 'cookie'/.test(source) &&
    /keys\[1\] === 'csrfToken'/.test(source) &&
    /typeof parsed\.csrfToken === 'string'/.test(source) &&
    /candidateRecords/.test(source) &&
    /destroyIfUnchanged\(sid, expectedSess, expectedExpiresAt, cb\)/.test(storeSource) &&
    /BINARY\s+sess\s*=\s*BINARY\s+\?\s+AND\s+expires_at\s*=\s*\?/.test(storeSource));
  const conditionalPredicateProblems = (value) =>
    /BINARY\s+sess\s*=\s*BINARY\s+\?\s+AND\s+expires_at\s*=\s*\?/i.test(value)
      ? [] : ['session comparison is not byte-exact'];
  ok('fixture: a collation-drift conditional predicate is rejected',
    conditionalPredicateProblems(storeSource).length === 0 &&
    conditionalPredicateProblems(
      storeSource.replace(/BINARY\s+sess\s*=\s*BINARY\s+\?/i, 'sess = ?')).length > 0);
  ok('operator discloses shape-only provenance and requires explicit bounded scope',
    /not proof that every row/.test(source) &&
    /--scope-confirmed-local-only/.test(source) &&
    /scopeConfirmed/.test(source));
  ok('operator rejects malformed conditional-store results instead of treating them as success',
    /affectedRows !== 1/.test(storeSource));

  const localEnv = {
    SESSION_STORE: 'mysql', NODE_ENV: 'development', DB_HOST: '127.0.0.1',
    DB_NAME: 'campusphere_db', VERCEL: '', VERCEL_ENV: ''
  };
  const rejects = async (label, fn) => {
    let rejected = false;
    try { await fn(); } catch (e) { rejected = true; }
    ok(label, rejected);
  };
  await rejects('fixture: Supabase store is rejected by the local operator',
    () => maintenance.assertLocalTestEnvironment({ ...localEnv, SESSION_STORE: 'supabase' }));
  await rejects('fixture: production/Vercel execution is rejected',
    () => maintenance.assertLocalTestEnvironment({ ...localEnv, NODE_ENV: 'production' }));
  await rejects('fixture: remote database host is rejected',
    () => maintenance.assertLocalTestEnvironment({ ...localEnv, DB_HOST: 'db.example.invalid' }));
  await rejects('fixture: apply without an exact fingerprint is rejected',
    () => maintenance.parseArgs([
      '--apply', '--exclusive-local-test-db', '--scope-confirmed-local-only',
      '--expected-count', '1'
    ]));
  await rejects('fixture: unknown arguments are rejected',
    () => maintenance.parseArgs(['--exclusive-local-test-db', '--scope-confirmed-local-only', '--bogus']));
  await rejects('fixture: duplicate arguments are rejected',
    () => maintenance.parseArgs(['--exclusive-local-test-db', '--scope-confirmed-local-only', '--check', '--check']));
  await rejects('fixture: positional arguments are rejected',
    () => maintenance.parseArgs(['--exclusive-local-test-db', '--scope-confirmed-local-only', 'extra']));
  await rejects('fixture: missing argument values are rejected',
    () => maintenance.parseArgs(['--exclusive-local-test-db', '--scope-confirmed-local-only', '--expected-count']));
  await rejects('fixture: scope confirmation is required even for a dry run',
    () => maintenance.parseArgs(['--exclusive-local-test-db']));
  await rejects('fixture: ambiguous session snapshot is rejected',
    () => maintenance.assertCleanSnapshot({
      scannedCount: 1, candidateCount: 0, userBearingCount: 1,
      statefulAnonymousCount: 0, malformedCount: 0
    }));

  const futureExpiry = Date.now() + 60000;
  const fakeRows = [
    { sid: 'sid-a', sess: JSON.stringify({ cookie: {}, csrfToken: 'token-a' }), expires_at: futureExpiry },
    { sid: 'sid-b', sess: JSON.stringify({ cookie: {}, csrfToken: 'token-b' }), expires_at: futureExpiry },
    { sid: 'sid-user', sess: JSON.stringify({ cookie: {}, csrfToken: 'token-u', user: { id: 7 } }), expires_at: futureExpiry },
  ];
  const queryLog = [];
  const fakePool = {
    query: async (sql, params) => {
      queryLog.push({ sql, params });
      return [[...fakeRows]];
    }
  };
  const inspected = await maintenance.inspectHarnessReadinessSessions(fakePool, 1000);
  ok('fixture: snapshot separates exact candidates from user-bearing residue',
    inspected.scannedCount === 3 && inspected.candidateSids.join(',') === 'sid-a,sid-b' &&
    inspected.candidateRecords.length === 2 && inspected.candidateRecords[0].sess.includes('token-a') &&
    inspected.userBearingCount === 1 && inspected.statefulAnonymousCount === 0 &&
    inspected.malformedCount === 0);
  ok('fixture: snapshot query is parameterized and read-only',
    queryLog.length === 1 && queryLog[0].params.length === 1 && queryLog[0].params[0] === 1000 &&
    /^\s*SELECT\b/i.test(queryLog[0].sql) && !/\b(?:DELETE|UPDATE|INSERT)\b/i.test(queryLog[0].sql));
  await rejects('fixture: non-array database rows are rejected closed',
    () => maintenance.inspectHarnessReadinessSessions({ query: async () => [null] }, 1000));
  const malformedRows = await maintenance.inspectHarnessReadinessSessions({
    query: async () => [[null, { sid: 'bad-row', sess: null, expires_at: 2000 }]]
  }, 1000);
  ok('fixture: null and malformed rows are counted and skipped fail-closed',
    malformedRows.scannedCount === 2 && malformedRows.malformedCount === 2 &&
    malformedRows.candidateSids.length === 0 && malformedRows.candidateRecords.length === 0);

  const sids = ['sid-a', 'sid-b'];
  const expectedSha256 = maintenance.candidateFingerprint(sids);
  let applyQueryCalls = 0;
  const destroyed = [];
  const applyPool = {
    query: async () => {
      applyQueryCalls += 1;
      return applyQueryCalls === 1
        ? [[
          { sid: 'sid-a', sess: JSON.stringify({ cookie: {}, csrfToken: 'token-a' }), expires_at: futureExpiry },
          { sid: 'sid-b', sess: JSON.stringify({ cookie: {}, csrfToken: 'token-b' }), expires_at: futureExpiry },
        ]]
        : [[]];
    }
  };
  const applyingStore = {
    destroyIfUnchanged: (sid, sess, expiresAt, cb) => {
      destroyed.push(`${sid}:${sess}:${expiresAt}`);
      cb(null);
    }
  };
  const applied = await maintenance.run([
    '--apply', '--exclusive-local-test-db', '--scope-confirmed-local-only',
    '--expected-count', '2',
    '--expected-sha256', expectedSha256
  ], { env: localEnv, store: applyingStore, pool: applyPool });
  ok('fixture: apply destroys each frozen SID exactly once and verifies zero residue',
    applied.mode === 'apply' && destroyed.length === 2 && destroyed[0].startsWith('sid-a:') &&
    destroyed[1].startsWith('sid-b:') &&
    applied.destroyedCount === 2 && applied.after.candidateCount === 0);

  let raceCalls = 0;
  await rejects('fixture: a concurrent replacement aborts without retry',
    () => maintenance.run([
      '--apply', '--exclusive-local-test-db', '--scope-confirmed-local-only',
      '--expected-count', '2', '--expected-sha256', expectedSha256
    ], {
      env: localEnv,
      pool: { query: async () => [[
        { sid: 'sid-a', sess: JSON.stringify({ cookie: {}, csrfToken: 'token-a' }), expires_at: futureExpiry },
        { sid: 'sid-b', sess: JSON.stringify({ cookie: {}, csrfToken: 'token-b' }), expires_at: futureExpiry },
      ]] },
      store: { destroyIfUnchanged: (sid, sess, expiresAt, cb) => {
        raceCalls += 1;
        cb(new Error('replacement')); // the real store sanitizes this race as a fixed failure
      } }
    }).then(() => { if (raceCalls !== 1) throw new Error('retry'); }));
  ok('fixture: concurrent replacement invokes the conditional interface once', raceCalls === 1);

  return rec.failures;
}

/* -------- static probe session-ownership inventory --------
   Every probe REGISTERED in this file that authenticates a canonical
   regression identity must own that session. Without this gate a future probe
   can silently reintroduce the leak that dropped the read-only credential/
   session-safety probe to 22/24.

   The probe list is derived from the live arrays below, so it cannot drift out
   of sync with what npm test actually spawns. A probe qualifies by either:
     (a) using the shared lifecycle (scripts/probeSessionLifecycle.js); or
     (b) appearing in EQUIVALENT_TERMINATION with a documented, separately
         asserted termination contract.
   Purely static: no server, no database. */
const EQUIVALENT_TERMINATION = Object.freeze({
  // The logout probe's SUBJECT is the logout contract itself: it terminates the
  // sessions it creates as part of the assertions under test, and additionally
  // uses the shared tracker to own any session whose contract-valid logout was
  // never attempted. Listed for documentation; it also satisfies (a).
  'logoutSessionTermination-probe.js':
    'terminates its sessions as the contract under test, plus shared-tracker ownership for unattempted sessions',
});

const RESIDUE_PROBE_SCRIPT = 'probeSessionResidue-probe.js';

/**
 * PURE evaluation of the residue gate's registration state directly from the
 * STAGE PLAN that main() actually executes. No filesystem or environment
 * input, so a probe merely EXISTING on disk can never satisfy registration or
 * final order — only real registration in the executed plan can.
 *
 * Production assertions and the negative fixtures below call this identical
 * function, so the fixtures genuinely pin the production logic.
 *
 * @param {Array} stages the stage plan (same object identity main() runs)
 * @param {string} residueScript the residue gate's filename
 */
function evaluateResidueRegistration(stages, residueScript) {
  const plan = Array.isArray(stages) ? stages : [];
  const flat = flattenStagePlan(plan);
  let count = 0;
  for (const entry of flat) if (entry === residueScript) count += 1;

  const lastStage = plan.length ? plan[plan.length - 1] : null;
  const lastStageScripts = lastStage && Array.isArray(lastStage.probes)
    ? lastStage.probes.map((e) => (Array.isArray(e) ? e[1] : null))
    : [];

  return {
    count,
    flat,
    registered: count > 0,
    exactlyOnce: count === 1,
    isFinalScript: flat.length > 0 && flat[flat.length - 1] === residueScript,
    isFinalStage: lastStageScripts.includes(residueScript),
    finalStageIsResidueOnly:
      lastStageScripts.length === 1 && lastStageScripts[0] === residueScript,
  };
}

/* Lexical-state line scanner for THIS repository's import convention.

   It is NOT a JavaScript parser and does not claim to be one. It tracks only
   the states needed to decide whether each PHYSICAL LINE BEGINS in executable
   code: line comment, block comment, single-quoted string, double-quoted
   string, and template literal — honouring backslash escapes and carrying
   block-comment / string / template state across physical lines.

   The previous implementation stripped comment-looking sequences globally,
   without respecting string boundaries, so a multiline template containing a
   require declaration was reported as an active import. Deciding per line, from
   real lexical state, removes that whole class of false positive.

   Deliberately out of scope (and therefore NOT recognized as imports):
   template interpolation `${...}` is treated as ordinary template text, and a
   declaration preceded on the same physical line by an inline block comment is
   not matched. Imports in this repository are ordinary standalone declaration
   lines, so neither shape is a real import here.

   @returns {boolean[]} index i is true when physical line i begins in code
*/
function executableLineStarts(src) {
  const s = String(src == null ? '' : src);
  const starts = [];
  let state = 'code'; // code | line | block | sq | dq | tpl
  starts.push(true);  // line 0 always begins in executable code

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const next = s[i + 1];

    if (c === '\n') {
      if (state === 'line') state = 'code'; // a line comment ends at the newline
      starts.push(state === 'code');
      continue;
    }

    switch (state) {
      case 'code':
        if (c === '/' && next === '/') { state = 'line'; i++; }
        else if (c === '/' && next === '*') { state = 'block'; i++; }
        else if (c === "'") state = 'sq';
        else if (c === '"') state = 'dq';
        else if (c === '`') state = 'tpl';
        break;
      case 'line':
        break; // consumed until the newline handled above
      case 'block':
        if (c === '*' && next === '/') { state = 'code'; i++; }
        break;
      /* ONE shared path for all three quoted states, so their escape handling
         cannot drift apart. Escapes are resolved BEFORE the closing-delimiter
         test, and a backslash-continued newline still appends exactly one
         physical-line entry — previously the LF was swallowed by `i++`, so
         starts[] fell out of step with src.split('\n') and later lines were
         judged against the wrong index. */
      case 'sq':
      case 'dq':
      case 'tpl': {
        if (c === '\\') {
          const escaped = s[i + 1];
          if (escaped === '\r' && s[i + 2] === '\n') {
            starts.push(false); // CRLF continuation: still inside the value
            i += 2;             // consume CR and LF
          } else if (escaped === '\n') {
            starts.push(false); // LF continuation: still inside the value
            i += 1;             // consume the LF
          } else {
            i += 1;             // ordinary escape: consume only that character
          }
          break;               // quoted state deliberately preserved
        }
        if ((state === 'sq' && c === "'") ||
            (state === 'dq' && c === '"') ||
            (state === 'tpl' && c === '`')) {
          state = 'code';
        }
        break;
      }
      default:
        break;
    }
  }
  return starts;
}

/**
 * Detect an ACTIVE, uncommented project-convention import of `moduleName`:
 *
 *     const|let|var <binding> = require('<module>')
 *
 * A candidate line is tested ONLY when that physical line begins in executable
 * code, and the declaration must be the FIRST executable statement on the line.
 * Together those two rules reject: commented-out declarations (line, single-line
 * block, multiline block), declaration-like text inside single-, double-, or
 * backtick-quoted strings (including multiline templates), and a second
 * declaration embedded later in an unrelated string-bearing statement.
 *
 * Accepts destructured or simple bindings, single/double/static-backtick module
 * literals, and harmless whitespace. No parser or package dependency is added.
 */
function requiresModule(src, moduleName) {
  const s = String(src == null ? '' : src);
  const lines = s.split('\n');
  const starts = executableLineStarts(s);
  const escaped = String(moduleName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    '^\\s*(?:const|let|var)\\s+[^=;]+?=\\s*require\\s*\\(\\s*([\'"`])' +
    escaped + '\\1\\s*\\)'
  );
  for (let i = 0; i < lines.length; i++) {
    if (!starts[i]) continue; // line does not begin in executable code
    if (re.test(lines[i])) return true;
  }
  return false;
}

function runProbeSessionOwnershipGate(stagePlan) {
  const rec = makeRecorder('probe-session-ownership');
  const { ok } = rec;
  const dir = __dirname;

  /* Three DISTINCT inventories, deliberately kept apart:

       orderedRegistered — exactly what npm test spawns, IN EXECUTION ORDER.
                           Registration and final-order assertions use ONLY
                           this; discovery can never satisfy them.
       registeredSet     — unique/sorted registered names, for membership
                           comparisons (standalone/forbidden checks).
       scripts           — registeredSet UNION filesystem discovery, used ONLY
                           for ownership analysis.

     Registered-only ownership analysis was a blind spot: a probe outside npm
     test could authenticate a canonical identity and never terminate its
     session. Discovery is by filename so a future probe is picked up
     automatically — the count is deliberately NOT pinned. Discovery never adds
     a standalone probe to what npm test spawns. */
  const orderedRegistered = flattenStagePlan(stagePlan);
  const registered = Array.from(new Set(orderedRegistered)).sort();
  let discovered = [];
  try {
    discovered = fs.readdirSync(dir)
      .filter((name) => name.endsWith('-probe.js'))
      .filter((name) => {
        try { return fs.statSync(path.join(dir, name)).isFile(); } catch (e) { return false; }
      });
  } catch (e) { /* empty discovery fails the assertions below */ }

  const scripts = Array.from(new Set([...registered, ...discovered])).sort();
  ok('registered probe inventory is non-empty', registered.length > 0);
  ok('filesystem probe discovery found probes beyond the registered inventory',
    discovered.length > 0 && scripts.length >= registered.length);

  // Every canonical-login probe found in the union inventory.
  const canonicalLoginProbes = [];

  for (const script of scripts) {
    const abs = path.join(dir, script);
    if (!fs.existsSync(abs)) {
      ok(`${script}: registered probe file exists`, false);
      continue;
    }
    const src = fs.readFileSync(abs, 'utf8');

    // Does it authenticate a canonical regression identity? (test-only loader
    // + a real /login request through the application). The require detector
    // tolerates quote style and whitespace; the /login boundary is unchanged.
    const authenticates =
      requiresModule(src, './regressionCredentials') &&
      /['"`]\/login['"`]|\/login['"`]|\+\s*'\/login'/.test(src);
    if (!authenticates) continue;

    canonicalLoginProbes.push(script);

    // Full lifecycle contract: import, tracker construction, at least one
    // session registration, termination, and termination from a finally.
    const hasImport = requiresModule(src, './probeSessionLifecycle');
    const hasTracker = src.includes('createProbeSessionTracker(');
    const hasRegister = /sessions\.register\(|\.register\(\s*['"`]/.test(src);
    const hasTerminate = src.includes('terminateAll(');
    const terminatesInFinally = /finally\s*\{[\s\S]{0,400}terminateAll\(\)/.test(src);
    const documentedEquivalent = Object.prototype.hasOwnProperty.call(EQUIVALENT_TERMINATION, script);

    ok(`${script}: imports the shared session lifecycle`, hasImport || documentedEquivalent);
    ok(`${script}: constructs a session tracker`, hasTracker || documentedEquivalent);
    ok(`${script}: registers at least one authenticated session`, hasRegister || documentedEquivalent);
    ok(`${script}: terminates its sessions`, hasTerminate || documentedEquivalent);
    ok(`${script}: session termination runs from a finally block`,
      terminatesInFinally || documentedEquivalent);
  }

  /* Regression: the four probes that live OUTSIDE npm test but still perform a
     canonical login must appear in the discovered inventory. If discovery ever
     stops seeing them, the ownership rule silently stops applying to them —
     the exact blind spot this gate replaced. The total is deliberately not
     pinned; only these known-standalone names are asserted. */
  for (const standalone of ['adminRouteGeometryEditor-probe.js', 'mapVrDestinationFlow-probe.js',
    'auth-http-probe.js', 'adminUsers-http-probe.js']) {
    ok(`${standalone} is discovered as a canonical-login probe (outside npm test)`,
      canonicalLoginProbes.includes(standalone) && !registered.includes(standalone));
  }

  // The standalone readiness/profile/safety probes must NEVER be registered.
  // pilotCredentialSafety (R1) in particular is standalone: the registered
  // residue gate below asserts session residue only, never credential state.
  for (const forbidden of ['pilotCredentialSafety-probe.js', 'vercelProductionProfile-probe.js',
    'vercelRuntimeSessionBootstrap-probe.js', R7_PROBE_SCRIPT]) {
    // Compare against the REGISTERED inventory only. `scripts` is the union
    // with filesystem discovery, which legitimately sees these files on disk;
    // what must stay false is that npm test SPAWNS them.
    ok(`${forbidden} stays OUT of the npm-test registration (standalone accounting)`,
      !registered.includes(forbidden));
  }

  /* The store-level postcondition gate must actually be SPAWNED by npm test,
     exactly once, and LAST — it only means anything if every session-creating
     probe has already finished. Evaluated against the ORDERED REGISTERED
     inventory only: a file sitting on disk must never satisfy these. */
  const residueState = evaluateResidueRegistration(stagePlan, RESIDUE_PROBE_SCRIPT);
  ok('the canonical session residue gate is registered inside npm test', residueState.registered);
  ok('the canonical session residue gate is registered exactly once', residueState.exactlyOnce);
  ok('the canonical session residue gate is the FINAL registered spawned probe', residueState.isFinalScript);
  ok('the canonical session residue gate is in the FINAL stage of the executed plan',
    residueState.isFinalStage);
  ok('the final stage contains only the residue probe', residueState.finalStageIsResidueOnly);
  // The gate must analyse the SAME object main() executes, not a copy.
  ok('the ownership gate consumes the executed stage plan by identity',
    stagePlan === SPAWNED_PROBE_STAGES);

  /* Negative fixtures for the SAME pure evaluator the assertions above use, so
     a future refactor that weakens registration/exact-once/final-order is
     caught here rather than silently accepted. */
  {
    const R = RESIDUE_PROBE_SCRIPT;
    const stage = (key, ...scripts) => ({
      key, prefix: key, heading: '[' + key + ']',
      probes: scripts.map((s) => [key + ' probe', s]),
    });
    const residueStage = stage('session-residue', R);

    const good = evaluateResidueRegistration(
      [stage('a', 'a-probe.js'), stage('b', 'b-probe.js'), residueStage], R);
    ok('fixture: correct stage plan satisfies registered + exactly-once + final script/stage',
      good.registered && good.exactlyOnce && good.isFinalScript && good.isFinalStage &&
      good.finalStageIsResidueOnly && good.count === 1);

    const removed = evaluateResidueRegistration(
      [stage('a', 'a-probe.js'), stage('b', 'b-probe.js')], R);
    ok('fixture: removing the residue STAGE fails registration',
      removed.registered === false && removed.isFinalScript === false && removed.isFinalStage === false);

    const duplicated = evaluateResidueRegistration(
      [stage('a', 'a-probe.js'), residueStage, stage('b', 'b-probe.js'), residueStage], R);
    ok('fixture: duplicating the residue STAGE fails exact-once',
      duplicated.registered === true && duplicated.exactlyOnce === false && duplicated.count === 2);

    const stageAfter = evaluateResidueRegistration(
      [stage('a', 'a-probe.js'), residueStage, stage('z', 'z-probe.js')], R);
    ok('fixture: appending a STAGE after the residue stage fails final-order',
      stageAfter.exactlyOnce === true && stageAfter.isFinalScript === false &&
      stageAfter.isFinalStage === false);

    const probeAfterInFinalStage = evaluateResidueRegistration(
      [stage('a', 'a-probe.js'), stage('session-residue', R, 'z-probe.js')], R);
    ok('fixture: appending a probe AFTER the residue probe within the final stage fails final-order',
      probeAfterInFinalStage.exactlyOnce === true &&
      probeAfterInFinalStage.isFinalScript === false &&
      probeAfterInFinalStage.finalStageIsResidueOnly === false);

    // Filesystem presence must never stand in for registration.
    const discoveryOnly = evaluateResidueRegistration([], R);
    ok('fixture: filesystem presence with no registered residue stage fails registration',
      discoveryOnly.registered === false && discoveryOnly.isFinalScript === false &&
      discoveryOnly.isFinalStage === false && fs.existsSync(path.join(dir, R)));
  }

  /* Fixtures for the require detector: accepted quote/whitespace forms, and
     rejected near-misses (different module, merely similar path, no real
     require form). */
  {
    const M = './regressionCredentials';
    const L = './probeSessionLifecycle';
    const BT = '`';
    const IMPORT = "const x = require('" + M + "');";

    // ---- ACTIVE declarations must be detected ----
    ok('fixture: active single-quoted const declaration is detected',
      requiresModule("const x = require('" + M + "');", M));
    ok('fixture: active double-quoted let declaration is detected',
      requiresModule('let x = require("' + M + '");', M));
    ok('fixture: active static-backtick var declaration is detected',
      requiresModule('var x = require(' + BT + M + BT + ');', M));
    ok('fixture: a destructured binding is detected',
      requiresModule("const { getRegressionCredentials } = require('" + M + "');", M));
    ok('fixture: whitespace variants are tolerated',
      requiresModule("let   x   =   require(  '" + M + "'  ) ;", M));

    // ---- A real import AFTER string content that merely looks like a comment ----
    ok('fixture: real import after a single-quoted string containing //',
      requiresModule("const s = 'protocol // inside';\n" + IMPORT + "\n", M));
    ok('fixture: real import after a double-quoted string containing /* or */',
      requiresModule('const s = "block /* and */ inside";\n' + IMPORT + '\n', M));
    ok('fixture: real import after a completed single-line template with comment-looking text',
      requiresModule('const t = ' + BT + 'has // and /* inside' + BT + ';\n' + IMPORT + '\n', M));

    // ---- THE multiline-template false positive (independent Codex finding) ----
    const MULTILINE_TEMPLATE_FALSE_POSITIVE_FIXTURE =
      'const note = ' + BT + '\n' + IMPORT + '\n' + BT + ';\n';
    ok('fixture: the exact multiline-template false positive is REJECTED',
      requiresModule(MULTILINE_TEMPLATE_FALSE_POSITIVE_FIXTURE, M) === false);
    ok('fixture: a multiline template containing a destructured require is rejected',
      !requiresModule('const t = ' + BT + '\nconst { a } = require(\'' + M + '\');\n' + BT + ';\n', M));

    // ---- COMMENTED declarations must be rejected ----
    ok('fixture: a line-commented declaration is rejected',
      !requiresModule('// ' + IMPORT, M));
    ok('fixture: a single-line block-commented declaration is rejected',
      !requiresModule('/* ' + IMPORT + ' */', M));
    ok('fixture: a multiline block-commented declaration is rejected',
      !requiresModule('/*\n  legacy:\n  ' + IMPORT + '\n*/\n', M));

    // ---- Declaration-like text inside strings must be rejected ----
    ok('fixture: a double-quoted string containing the declaration is rejected',
      !requiresModule('const note = "' + IMPORT + '";', M));
    ok('fixture: a single-quoted string containing require-like text is rejected',
      !requiresModule('const note = \'require("' + M + '")\';', M));
    ok('fixture: a second declaration embedded later in a string-bearing statement is rejected',
      !requiresModule('const note = "text"; ' + IMPORT, M));

    // ---- Wrong module identity must be rejected ----
    ok('fixture: a different module name is rejected',
      !requiresModule("const x = require('./regressionCredentialsExtra');", M));
    ok('fixture: a merely similar path is rejected',
      !requiresModule("const x = require('../scripts/regressionCredentials');", M));
    ok('fixture: a bare module-name string is rejected',
      !requiresModule("const p = '" + M + "';", M));

    /* ---- escaped-newline continuation matrix: {sq, dq, tpl} x {LF, CRLF} ----
       A backslash-continued newline must still advance the physical-line
       accounting by exactly one, or starts[] falls out of step with
       src.split('\n') and later lines get judged against the wrong index —
       which produced BOTH a missed real import and a false positive on an
       embedded declaration. Constants are explicit so the fixtures do not rely
       on visually ambiguous line continuations in this source file. */
    const BS = '\\';
    const LF = '\n';
    const CRLF = '\r\n';
    const SQ = "'";
    const DQ = '"';
    for (const [qName, q, innerQ] of [
      ['single-quoted', SQ, DQ], ['double-quoted', DQ, SQ], ['template', BT, SQ],
    ]) {
      for (const [nlName, nl] of [['LF', LF], ['CRLF', CRLF]]) {
        const tag = qName + ' + ' + nlName;
        const continued = 'const s = ' + q + 'x' + BS + nl + 'still string' + q + ';' + nl + IMPORT + nl;
        ok('fixture: ' + tag + ' continuation keeps one starts[] entry per physical line',
          executableLineStarts(continued).length === continued.split(LF).length);
        const embedded = 'const s = ' + q + 'x' + BS + nl +
          'const x = require(' + innerQ + M + innerQ + ');' + q + ';' + nl;
        ok('fixture: ' + tag + ' declaration inside the continued value is rejected',
          requiresModule(embedded, M) === false);
        ok('fixture: ' + tag + ' later real import is detected',
          requiresModule(continued, M) === true);
      }
    }
    ok('fixture: the exact reported single-quoted LF reproduction is detected',
      requiresModule('const s = ' + SQ + 'x' + BS + LF + 'still string' + SQ + ';' + LF + IMPORT + LF, M) === true);
    ok('fixture: an ordinary escape creates no physical-line entry',
      requiresModule('const s = ' + SQ + 'it' + BS + SQ + 's fine' + SQ + ';' + LF + IMPORT + LF, M) === true);

    // ---- Same detector applies to the lifecycle import ----
    ok('fixture: the lifecycle import detector accepts alternate quote styles',
      requiresModule('const a = require("' + L + '");', L) &&
      requiresModule("const b = require('" + L + "');", L));
    ok('fixture: the lifecycle import detector rejects a commented declaration',
      !requiresModule("// const c = require('" + L + "');", L));
    ok('fixture: the lifecycle import detector rejects a multiline-template declaration',
      !requiresModule('const t = ' + BT + '\nconst c = require(\'' + L + '\');\n' + BT + ';\n', L));
  }

  // Static ownership is defense in depth only: it proves source-pattern
  // presence, NOT runtime store selection or the zero-session postcondition.
  // Those are proven by the with-server env gate and the residue gate.
  ok('the residue gate performs no authentication of its own',
    fs.existsSync(path.join(dir, 'probeSessionResidue-probe.js')) &&
    !/['"`]\/login['"`]/.test(fs.readFileSync(path.join(dir, 'probeSessionResidue-probe.js'), 'utf8')));

  return rec.failures;
}

function supabaseModeSelected() {
  const keys = ['SESSION_STORE', 'AUTH_DATA_SOURCE', 'CONTENT_DATA_SOURCE',
    'BUILDING_DATA_SOURCE', 'ROUTE_DATA_SOURCE', 'VR_DATA_SOURCE', 'SCHEDULE_DATA_SOURCE'];
  return keys.some((k) => String(process.env[k] || '').trim().toLowerCase() === 'supabase');
}

function runProbeScript(script, extraEnv) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, script)], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, ...extraEnv }, // full inherited env; never cleared
      stdio: 'inherit',
    });
    child.on('error', () => resolve(1));
    child.on('exit', (code) => resolve(code === null ? 1 : code));
  });
}

async function runSpawnedProbeGates(probes) {
  const failures = [];
  let extraEnv = {};
  if (!hasSupabaseConfig()) {
    if (supabaseModeSelected()) {
      console.error('  FAIL a Supabase runtime/session mode is selected but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set (fail-closed).');
      failures.push('Supabase mode selected but Supabase env is not configured (fail-closed)');
      return failures;
    }
    console.log('  NOTE Supabase phases will SKIP — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (MySQL fallback mode).');
    extraEnv = { PROBE_SKIP_SUPABASE: '1' };
  }
  for (const [label, script] of probes) {
    console.log(`  --> ${label} (scripts/${script})`);
    const code = await runProbeScript(script, extraEnv);
    const okRun = code === 0;
    console.log(`  [${okRun ? 'PASS' : 'FAIL'}] ${label} probe exited ${code}`);
    if (!okRun) failures.push(`${label} probe failed (exit ${code})`);
  }
  return failures;
}

async function main() {
  console.log('=== CampuSphere Quality Gates (Section 8.8 / R12) ===\n');
  const allFailures = [];

  console.log('[PWA privacy boundaries] (static sw.js analysis)');
  allFailures.push(...runPwaPrivacyGate().map((f) => 'pwa :: ' + f));
  console.log('');

  console.log('[PWA app-capable meta hygiene] (static views analysis)');
  allFailures.push(...runPwaMetaGate().map((f) => 'pwa-meta :: ' + f));
  console.log('');

  console.log('[Media URL policy] (static utils/mediaUrl analysis)');
  allFailures.push(...runMediaUrlPolicyGate().map((f) => 'media-url :: ' + f));
  console.log('');

  console.log('[CSP media policy] (static securityHeaders analysis)');
  allFailures.push(...runCspMediaPolicyGate().map((f) => 'csp :: ' + f));
  console.log('');

  console.log('[VR runtime sanitizer] (static vrController analysis)');
  allFailures.push(...runVrRuntimeGate().map((f) => 'vr-runtime :: ' + f));
  console.log('');

  console.log('[Admin VR schedule UX] (static vr.ejs/admin-vr.js/adminController analysis)');
  allFailures.push(...runAdminVrScheduleUxGate().map((f) => 'admin-vr-ux :: ' + f));
  console.log('');

  console.log('[Cloudinary docs/env] (static docs analysis)');
  allFailures.push(...runCloudinaryDocsGate().map((f) => 'cloudinary-docs :: ' + f));
  console.log('');

  console.log('[Admin users XSS hardening] (static admin-users.js analysis)');
  allFailures.push(...runAdminUsersXssGate().map((f) => 'admin-users-xss :: ' + f));
  console.log('');

  console.log('[Building delete transaction hardening] (static adminBuildingsController.js analysis)');
  allFailures.push(...runBuildingDeleteTxGate().map((f) => 'building-delete-tx :: ' + f));
  console.log('');

  console.log('[Login timing / user-enumeration hardening] (static authController.js analysis)');
  allFailures.push(...runLoginTimingGate().map((f) => 'login-timing :: ' + f));
  console.log('');

  console.log('[Logout probe output hygiene] (static logout-probe/authController.js analysis + rejecting fixtures)');
  allFailures.push(...runLogoutOutputHygieneGate().map((f) => 'logout-output-hygiene :: ' + f));
  console.log('');

  console.log('[Admin dashboard analytics truthfulness] (M12.P1-D6 real-data contract: Asia/Manila months, exact roles, no fabricated or zeroed values + mutated-source rejecting fixtures)');
  allFailures.push(...(await runAdminDashboardAnalyticsGate()).map((f) => 'admin-dashboard-analytics :: ' + f));
  console.log('');

  console.log('[Pilot readiness] (M12.P1-R8 privacy notice, footer links, indexing protection, pilot-doc truth + rejecting fixtures)');
  allFailures.push(...runPilotReadinessGate().map((f) => 'pilot-readiness :: ' + f));
  console.log('');

  console.log('[Sample-360 scratch-dir exposure] (static .dockerignore/.gitignore/server.js analysis)');
  allFailures.push(...runSample360Gate().map((f) => 'sample-360 :: ' + f));
  console.log('');

  console.log('[Local DB-dump exposure] (static .gitignore/.dockerignore analysis)');
  allFailures.push(...runDbDumpGate().map((f) => 'db-dump :: ' + f));
  console.log('');

  console.log('[Vercel package/static-CDN boundary] (M12.P1-R7 static .vercelignore/vercel.json/entrypoint analysis + real-analyzer negative fixtures)');
  allFailures.push(...runVercelPackageBoundaryGate().map((f) => 'vercel-package-boundary :: ' + f));
  console.log('');

  console.log('[Shared rate limiting] (M12.P1-R4 static dependency/limiter/store/docs analysis)');
  allFailures.push(...runSharedRateLimitGate().map((f) => 'shared-rate-limit :: ' + f));
  console.log('');

  console.log('[Bounded anonymous access-denial] (M12.P1-R5 static roleAuth/audit/standalone analysis + database-free helper drives)');
  allFailures.push(...(await runBoundedAnonymousDenialGate()).map((f) => 'bounded-anon-denial :: ' + f));
  console.log('');

  console.log('[Docs current] (static AGENTS.md/CLAUDE.md/handoffs analysis)');
  allFailures.push(...runDocsCurrentGate().map((f) => 'docs-current :: ' + f));
  console.log('');

  console.log('[SW precache stylesheet hygiene] (static public/sw.js + views analysis)');
  allFailures.push(...runSwPrecacheGate().map((f) => 'sw-precache :: ' + f));
  console.log('');

  console.log('[Room scheduling docs/deployment wording] (static docs analysis)');
  allFailures.push(...runScheduleDocsGate().map((f) => 'schedule-docs :: ' + f));
  console.log('');

  console.log('[Leaflet vendor hygiene] (static views/vendor/CSP analysis)');
  allFailures.push(...runLeafletVendorGate().map((f) => 'leaflet-vendor :: ' + f));
  console.log('');

  console.log('[Self-hosted browser dependencies] (M12.P1-R6 manifest/provenance/view/CSP/SW static analysis + served-asset HTTP evidence)');
  allFailures.push(...(await runSelfHostedVendorGate()).map((f) => 'self-hosted-vendor :: ' + f));
  console.log('');

  console.log('[OFF.1 authenticated-HTML no-store placement] (static server.js analysis)');
  allFailures.push(...runNoStorePlacementGate().map((f) => 'no-store-placement :: ' + f));
  console.log('');

  console.log('[OFF.1 no-store middleware unit cases] (database-free, real middleware + mocked req/res)');
  allFailures.push(...runNoStoreUnitGate().map((f) => 'no-store-unit :: ' + f));
  console.log('');

  console.log('[with-server environment resolution] (database-free; ambient SESSION_STORE must never leak)');
  allFailures.push(...runWithServerEnvGate().map((f) => 'with-server-env :: ' + f));
  console.log('');

  console.log('[Local anonymous-session maintenance] (database-free store/operator safety and rejecting fixtures)');
  allFailures.push(...(await runLocalSessionMaintenanceGate()).map((f) => 'local-session-maintenance :: ' + f));
  console.log('');

  console.log('[Probe session ownership] (registered + filesystem-discovered ownership analysis; defense in depth — the residue gate is authoritative)');
  // Passes THE executed stage plan by identity — no manually assembled copy.
  allFailures.push(...runProbeSessionOwnershipGate(SPAWNED_PROBE_STAGES)
    .map((f) => 'probe-session-ownership :: ' + f));
  console.log('');

  console.log('[Critical-flow contracts: MySQL session fallback]');
  const mysqlFails = await withServer({ mode: 'mysql', port: PORTS.mysql, sessionStore: 'mysql' }, (base) => runSuite(base, 'mysql'));
  allFailures.push(...mysqlFails.map((f) => 'mysql :: ' + f));
  console.log('');

  // Skip Supabase only when its env is truly unconfigured AND the session store
  // is not explicitly supabase. If SESSION_STORE=supabase is selected but the
  // env is missing, fail closed instead of skipping (Milestone 9, Section 9.6).
  const supabaseRequired = String(process.env.SESSION_STORE || '').trim().toLowerCase() === 'supabase';
  if (hasSupabaseConfig()) {
    console.log('[Critical-flow contracts: Supabase session store]');
    const sbFails = await withServer({ mode: 'supabase', port: PORTS.supabase, sessionStore: 'supabase' }, (base) => runSuite(base, 'supabase'));
    allFailures.push(...sbFails.map((f) => 'supabase :: ' + f));
  } else if (supabaseRequired) {
    console.error('[Critical-flow contracts: Supabase session store] FAIL — SESSION_STORE=supabase selected but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.');
    allFailures.push('supabase :: SESSION_STORE=supabase selected but Supabase env is not configured (fail-closed)');
  } else {
    console.log('[Critical-flow contracts: Supabase session store] SKIP — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (MySQL fallback mode).');
  }
  console.log('');

  /* ONE runner over the single-source stage plan. main() no longer repeats
     per-group calls, so the ACTUAL execution order IS the plan the ownership
     gate validated. Headings, failure prefixes, sequential execution,
     blank-line spacing, fail-closed Supabase handling, and cleanup ordering
     are unchanged. runSpawnedProbeGates() is invoked ONLY from here. */
  for (const stage of SPAWNED_PROBE_STAGES) {
    console.log(stage.heading);
    allFailures.push(...(await runSpawnedProbeGates(stage.probes)).map((f) => stage.prefix + " :: " + f));
    console.log('');
  }

  if (allFailures.length === 0) {
    console.log('QUALITY-GATES OK: all checks passed.');
    process.exitCode = 0;
  } else {
    console.error(`QUALITY-GATES FAILED: ${allFailures.length} check(s) did not pass:`);
    allFailures.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error('[quality-gates] FATAL:', e && e.message ? e.message : 'unknown error');
    process.exitCode = 1;
  });
}

// Export selected database-free analyzers so a migration-source candidate can
// verify its static gate changes without starting the server or touching a DB.
module.exports = {
  runAdminVrScheduleUxGate,
  runBuildingDeleteTxGate,
  runDocsCurrentGate,
  runScheduleDocsGate,
};
