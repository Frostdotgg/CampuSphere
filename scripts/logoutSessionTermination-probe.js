'use strict';

/* ========================================
   CampuSphere - Logout & Session-Termination probe
   M12.P1-D1 verification script.

   Boots through scripts/with-server.js (never a foreground server) in BOTH
   runtime modes (MySQL always; Supabase/Supabase when configured) and
   verifies the truthful logout contract:

     - unauthenticated GET /auth/csrf-token -> 401 JSON with EXACT
       `Cache-Control: no-store, private`;
     - authenticated GET /auth/csrf-token -> 200, fixed two-key schema
       { success:true, csrfToken:<nonempty> }, exact no-store;
     - POST /logout with an invalid token -> 403 JSON, NO clearing
       Set-Cookie, and the protected /dashboard still answers 200;
     - refreshed token -> JSON logout 200 with the fixed
       { success:true, redirect:'/auth?logged_out=1' } body and a clearing
       Set-Cookie for the configured session cookie (success only);
     - replaying the former cookie can no longer reach /dashboard or /map;
     - HTML form POST compatibility -> 302 /auth?logged_out=1.

   A database-free unit gate drives the REAL controller with a mocked
   req/res pair to prove: successful destroy clears the cookie exactly once
   and returns the correct per-caller response; failed destroy clears
   nothing, redirects nowhere, and never exposes the raw store error.

   Regression identities come from the shared TEST-ONLY loader
   (scripts/regressionCredentials.js). Tokens and cookie values are compared
   ONLY in memory; no token, cookie value, credential, raw DB error, or
   stack trace is ever printed. Prints fixed PASS/FAIL labels only.
   ======================================== */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { withServer } = require('./with-server');
const { hasSupabaseConfig } = require('../config/supabase');
const { getRegressionCredentials } = require('./regressionCredentials');
const { SupabaseSessionStore } = require('../services/supabaseSessionStore');
// Shared probe session ownership. This probe's SUBJECT is the logout contract,
// so it performs its own contract-valid logouts; the tracker only owns sessions
// that were ABANDONED before their contract logout was attempted (see
// markAttempted). It never retries an attempted-and-failed logout.
const { createProbeSessionTracker } = require('./probeSessionLifecycle');
const { ensureCsrfToken } = require('../middleware/csrfProtection');

const runId = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
const LOGOUT_REDIRECT = '/auth?logged_out=1';
// Non-production probe servers use the dev cookie name; accept prod too so a
// deliberate NODE_ENV=production rehearsal does not misreport.
const SESSION_COOKIE_NAMES = ['campusphere.sid', '__Host-campusphere.sid'];

const failures = [];
function check(scope, label, ok) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!ok) failures.push(`${scope} :: ${label}`);
}

const parseJson = (t) => { try { return JSON.parse(t); } catch (e) { return null; } };
const normCc = (res) => (res.headers.get('cache-control') || '')
  .toLowerCase().split(',').map((s) => s.trim()).filter(Boolean).sort().join(',');
const metaCsrf = (html) => {
  const m = html.match(/name="csrf-token" content="([^"]+)"/);
  return m ? m[1] : '';
};

function cookieJar() {
  const store = {};
  return {
    apply(res) {
      const list = res.headers.getSetCookie ? res.headers.getSetCookie()
        : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
      for (const c of list) {
        const pair = c.split(';')[0];
        const i = pair.indexOf('=');
        if (i > 0) store[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
      }
    },
    header() { return Object.entries(store).map(([k, v]) => `${k}=${v}`).join('; '); },
    values() { return Object.values(store); },
  };
}

// True when a Set-Cookie list contains an EXPIRING entry for the session
// cookie (an empty/cleared value with an epoch-or-past expiry) — the clearing
// signature res.clearCookie emits. Values are inspected in memory only.
function hasClearingSessionCookie(res) {
  const list = res.headers.getSetCookie ? res.headers.getSetCookie()
    : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
  return list.some((c) => {
    const name = c.split('=')[0].trim();
    if (!SESSION_COOKIE_NAMES.includes(name)) return false;
    return /expires=thu, 01 jan 1970/i.test(c) || /max-age=0/i.test(c);
  });
}
function hasAnySessionSetCookie(res) {
  const list = res.headers.getSetCookie ? res.headers.getSetCookie()
    : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
  return list.some((c) => SESSION_COOKIE_NAMES.includes(c.split('=')[0].trim()));
}

async function login(base, jar, email, password) {
  let r = await fetch(base + '/auth', { headers: { Accept: 'text/html' } });
  jar.apply(r);
  const t = metaCsrf(await r.text());
  r = await fetch(base + '/login', {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.header() },
    body: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&_csrf=${encodeURIComponent(t)}`,
  });
  jar.apply(r);
  return r.status === 302;
}

async function runMode(mode, base) {
  const creds = getRegressionCredentials(mode);
  const bodies = [];
  const seenTokens = [];
  // Owns only sessions abandoned before their contract logout was attempted.
  const sessions = createProbeSessionTracker({
    base,
    record: (label, pass) => check(mode, label, pass),
  });

  try {

  // 1. Unauthenticated token endpoint: 401 JSON + exact no-store.
  let r = await fetch(base + '/auth/csrf-token', { headers: { Accept: 'application/json' } });
  let body = await r.text(); bodies.push(body);
  let o = parseJson(body);
  check(mode, 'unauthenticated GET /auth/csrf-token -> 401 JSON {success:false}',
    r.status === 401 && !!o && o.success === false && typeof o.message === 'string');
  check(mode, 'unauthenticated token response carries exact no-store, private',
    normCc(r) === 'no-store,private');

  // Authenticate the regression student.
  const jar = cookieJar();
  const jsonLoginOk = await login(base, jar, creds.student.email, creds.student.password);
  check(mode, 'student login -> 302', jsonLoginOk);
  // Owned until its own contract logout is attempted below.
  if (jsonLoginOk) sessions.register('student (json-logout session)', jar, '/dashboard');

  // 2. Authenticated token endpoint: 200, fixed schema, nonempty, no-store.
  r = await fetch(base + '/auth/csrf-token', {
    headers: { Accept: 'application/json', Cookie: jar.header() },
  });
  body = await r.text(); // NOT pushed to bodies: it legitimately carries the token
  o = parseJson(body);
  const tokenOk = !!o && o.success === true &&
    typeof o.csrfToken === 'string' && o.csrfToken.length > 0 &&
    Object.keys(o).sort().join(',') === 'csrfToken,success';
  if (o && typeof o.csrfToken === 'string') seenTokens.push(o.csrfToken);
  check(mode, 'authenticated GET /auth/csrf-token -> 200 fixed {success,csrfToken} schema with nonempty token',
    r.status === 200 && tokenOk);
  check(mode, 'authenticated token response carries exact no-store, private', normCc(r) === 'no-store,private');

  // 3. Invalid-token logout: 403, no clearing cookie, session stays live.
  r = await fetch(base + '/logout', {
    method: 'POST', redirect: 'manual',
    headers: { Accept: 'application/json', 'X-CSRF-Token': 'invalid-' + runId, Cookie: jar.header() },
  });
  body = await r.text(); bodies.push(body);
  o = parseJson(body);
  check(mode, 'invalid-token POST /logout -> 403 JSON {success:false}',
    r.status === 403 && !!o && o.success === false);
  check(mode, 'invalid-token rejection emits NO session Set-Cookie', !hasAnySessionSetCookie(r));
  r = await fetch(base + '/dashboard', {
    redirect: 'manual', headers: { Accept: 'text/html', Cookie: jar.header() },
  });
  await r.text();
  check(mode, 'protected /dashboard still answers 200 after the rejected logout', r.status === 200);

  // 4. Refreshed token -> truthful JSON logout.
  r = await fetch(base + '/auth/csrf-token', {
    headers: { Accept: 'application/json', Cookie: jar.header() },
  });
  o = parseJson(await r.text());
  const fresh = o && typeof o.csrfToken === 'string' ? o.csrfToken : '';
  if (fresh) seenTokens.push(fresh);
  check(mode, 'refreshed token retrieved for the retry contract', fresh.length > 0);
  const preLogoutCookie = jar.header();
  // From here the contract-valid logout has been ATTEMPTED: its outcome is
  // evidence, so the tracker must never retry it.
  sessions.markAttempted(jar);
  r = await fetch(base + '/logout', {
    method: 'POST', redirect: 'manual',
    headers: { Accept: 'application/json', 'X-CSRF-Token': fresh, Cookie: preLogoutCookie },
  });
  body = await r.text(); bodies.push(body);
  o = parseJson(body);
  check(mode, 'refreshed-token JSON logout -> 200 fixed {success:true, redirect} body',
    r.status === 200 && !!o && o.success === true && o.redirect === LOGOUT_REDIRECT &&
    Object.keys(o).sort().join(',') === 'redirect,success');
  // 5. Clearing Set-Cookie emitted on success (and only on success — the 403
  // above emitted none).
  check(mode, 'successful logout emits the clearing session Set-Cookie', hasClearingSessionCookie(r));

  // 6. The former cookie can no longer reach protected pages.
  for (const p of ['/dashboard', '/map']) {
    r = await fetch(base + p, {
      redirect: 'manual', headers: { Accept: 'text/html', Cookie: preLogoutCookie },
    });
    await r.text();
    check(mode, `replayed former cookie on ${p} -> 302 to /auth`,
      r.status === 302 && /\/auth/.test(r.headers.get('location') || ''));
  }

  /* 7. HTML form POST compatibility (second fresh session).
     THE REGRESSION CONTRACT: fresh login -> ONE authenticated GET /dashboard ->
     take the token that page rendered -> IMMEDIATELY submit the form. This is
     exactly what a real admin HTML logout form does. There is deliberately NO
     second page read, NO sleep, and NO retry of this POST: the establishment-
     time token mint (authController.establishAuthenticatedSession ->
     ensureCsrfToken before saveSession) is what makes the rendered token
     already durable under the Supabase session store. If this goes red, the
     runtime correction is wrong — it must not be papered over here. */
  const jar2 = cookieJar();
  const formLoginOk = await login(base, jar2, creds.student.email, creds.student.password);
  check(mode, 'second student login for the HTML form contract -> 302', formLoginOk);
  if (formLoginOk) sessions.register('student (html-form session)', jar2, '/dashboard');
  r = await fetch(base + '/dashboard', { headers: { Accept: 'text/html', Cookie: jar2.header() } });
  const formTok = metaCsrf(await r.text());
  if (formTok) seenTokens.push(formTok);
  // Contract logout attempted from here — outcome is evidence, never retried.
  sessions.markAttempted(jar2);
  r = await fetch(base + '/logout', {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/html', Cookie: jar2.header() },
    body: `_csrf=${encodeURIComponent(formTok)}`,
  });
  body = await r.text(); bodies.push(body);
  check(mode, 'HTML form POST /logout -> 302 ' + LOGOUT_REDIRECT,
    r.status === 302 && (r.headers.get('location') || '') === LOGOUT_REDIRECT);
  check(mode, 'HTML form logout also emits the clearing session Set-Cookie', hasClearingSessionCookie(r));

  // GET /logout stays a non-mutating 405.
  r = await fetch(base + '/logout', { redirect: 'manual', headers: { Accept: 'application/json' } });
  body = await r.text(); bodies.push(body);
  check(mode, 'GET /logout stays 405 with Allow: POST',
    r.status === 405 && (r.headers.get('allow') || '') === 'POST');

  // In-memory leak boundary: no captured non-token body may carry a token or
  // a session cookie value; standard sanitized-output patterns hold.
  const blob = bodies.join('\n');
  check(mode, 'leak scan: no CSRF token value in any non-token response body',
    !seenTokens.some((t) => t && blob.includes(t)));
  check(mode, 'leak scan: no session cookie value in any response body',
    ![...jar.values(), ...jar2.values()].some((v) => v && v.length > 8 && blob.includes(v)));
  check(mode, 'leak scan: no stack frames', !/\bat\s+\S+\s+\(.*:\d+:\d+\)/.test(blob) && !/\.js:\d+:\d+/.test(blob));
  check(mode, 'leak scan: no SQL/driver/PostgREST text',
    !/(sqlMessage|ER_[A-Z_]{3,}|SQLSTATE|PostgREST|ECONNREFUSED)/i.test(blob));
  check(mode, 'leak scan: no Supabase host/key/JWT',
    !/supabase\.co|service_role|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(blob));

  } finally {
    // Owns ONLY sessions abandoned before their contract logout was attempted
    // (e.g. an early failure above). markAttempted() has already excluded the
    // two contract sessions, so a failed contract logout is preserved as
    // evidence and never retried.
    await sessions.terminateAll();
  }
}

/* ---------- database-free controller unit gate (mocked req/res) ---------- */
function makeReq(accept, destroyErr) {
  return {
    originalUrl: '/logout',
    xhr: false,
    session: {
      csrfToken: 'unit-token-' + runId,
      destroy(cb) { cb(destroyErr || null); },
    },
    get(name) {
      if (String(name).toLowerCase() === 'accept') return accept;
      return '';
    },
  };
}
function makeRes() {
  const out = {
    statusCode: 200, jsonBody: null, redirectTo: null,
    rendered: null, clearCookieCalls: 0, setHeaders: {},
  };
  return {
    out,
    status(c) { out.statusCode = c; return this; },
    json(b) { out.jsonBody = b; return this; },
    redirect(loc) { out.redirectTo = loc; },
    render(view, locals) { out.rendered = { view, locals }; },
    clearCookie() { out.clearCookieCalls += 1; },
    set(k, v) { out.setHeaders[k] = v; },
    cookie() {},
  };
}

/* ---- expected-output capture for the mocked failed-destroy cases ----
   The failed-destroy unit cases drive the REAL controller, which emits one
   FIXED sanitized line per failure. That production behavior is correct and
   must not change: a genuine logout failure has to stay audited. Here the
   line is EXPECTED test output, so it is captured rather than allowed to
   escape — an otherwise green `npm test` transcript must never show what
   looks like a real logout failure. Capturing it also lets the probe assert
   the line is exactly the fixed sanitized string and carries no raw store
   detail. The mocked destroy invokes its callback SYNCHRONOUSLY, so this
   synchronous window covers the whole emission. check() writes to
   console.log, not console.error, so PASS/FAIL labels are never swallowed. */
const EXPECTED_DESTROY_LOG = 'Logout error: session destroy failed.';

function captureConsoleError(fn) {
  const original = console.error;
  const captured = [];
  console.error = (...args) => { captured.push(args.map((a) => String(a)).join(' ')); };
  try {
    fn();
  } finally {
    console.error = original; // restored even if the controller throws
  }
  return captured;
}

function makeScriptedSupabaseClient({ deletes, reads }) {
  const state = {
    deleteCalls: 0,
    readCalls: 0,
  };
  const next = (items, index, fallback) =>
    index < items.length ? items[index] : fallback;
  const settle = (outcome) => {
    if (outcome && Object.prototype.hasOwnProperty.call(outcome, 'reject')) {
      return Promise.reject(outcome.reject);
    }
    return Promise.resolve(outcome);
  };

  return {
    state,
    from() {
      return {
        delete() {
          return {
            eq() {
              const outcome = next(
                deletes,
                state.deleteCalls,
                { error: new Error('unexpected delete') }
              );
              state.deleteCalls += 1;
              return settle(outcome);
            },
          };
        },
        select() {
          return {
            eq() {
              return {
                maybeSingle() {
                  const outcome = next(
                    reads,
                    state.readCalls,
                    { data: null, error: new Error('unexpected read') }
                  );
                  state.readCalls += 1;
                  return settle(outcome);
                },
              };
            },
          };
        },
      };
    },
  };
}

async function destroyWithScript(script) {
  const client = makeScriptedSupabaseClient(script);
  const store = new SupabaseSessionStore({ client });
  const result = { callbackCalls: 0, error: null, client };
  await new Promise((resolve) => {
    store.destroy('unit-session-' + runId, (error) => {
      result.callbackCalls += 1;
      result.error = error || null;
      setImmediate(resolve);
    });
  });
  return result;
}

async function runUnitGate(authController) {
  const scope = 'unit';

  // Successful destroy: JSON caller. EVERY unit invocation of the real
  // controller goes through captureConsoleError, so no expected sanitized
  // failure line can reach the suite transcript.
  let res = makeRes();
  const okJsonLogs = captureConsoleError(() => authController.logout(makeReq('application/json', null), res));
  check(scope, 'successful destroy (JSON) -> 200 {success:true, redirect} and exactly one cookie clear',
    res.out.statusCode === 200 && !!res.out.jsonBody && res.out.jsonBody.success === true &&
    res.out.jsonBody.redirect === LOGOUT_REDIRECT && res.out.clearCookieCalls === 1 &&
    res.out.redirectTo === null && res.out.rendered === null);
  check(scope, 'successful destroy (JSON) writes nothing to console.error', okJsonLogs.length === 0);

  // Successful destroy: HTML caller.
  res = makeRes();
  const okHtmlLogs = captureConsoleError(() => authController.logout(makeReq('text/html', null), res));
  check(scope, 'successful destroy (HTML) -> 302 redirect and exactly one cookie clear',
    res.out.redirectTo === LOGOUT_REDIRECT && res.out.clearCookieCalls === 1 &&
    res.out.jsonBody === null && res.out.rendered === null);
  check(scope, 'successful destroy (HTML) writes nothing to console.error', okHtmlLogs.length === 0);

  // Failed destroy: JSON caller — no clear, no redirect, sanitized 500.
  const rawMarker = 'raw-store-detail-' + runId;
  res = makeRes();
  const failJsonLogs = captureConsoleError(() => authController.logout(makeReq('application/json', new Error(rawMarker)), res));
  check(scope, 'failed destroy (JSON) -> 500 fixed sanitized message',
    res.out.statusCode === 500 && !!res.out.jsonBody && res.out.jsonBody.success === false &&
    res.out.jsonBody.message === 'Unable to sign out. Please try again.');
  check(scope, 'failed destroy (JSON) clears nothing and redirects nowhere',
    res.out.clearCookieCalls === 0 && res.out.redirectTo === null && res.out.rendered === null);
  check(scope, 'failed destroy (JSON) never exposes the raw store error',
    JSON.stringify(res.out.jsonBody).indexOf(rawMarker) === -1);
  check(scope, 'failed destroy (JSON) logs exactly one fixed sanitized line',
    failJsonLogs.length === 1 && failJsonLogs[0] === EXPECTED_DESTROY_LOG);
  check(scope, 'failed destroy (JSON) log carries no raw store detail',
    failJsonLogs.join('\n').indexOf(rawMarker) === -1);

  // Failed destroy: HTML caller — sanitized 500 error view, no clear/redirect.
  res = makeRes();
  const failHtmlLogs = captureConsoleError(() => authController.logout(makeReq('text/html', new Error(rawMarker)), res));
  check(scope, 'failed destroy (HTML) -> 500 sanitized error view, no clear, no redirect',
    res.out.statusCode === 500 && !!res.out.rendered && res.out.rendered.view === 'error' &&
    res.out.rendered.locals.statusCode === 500 &&
    JSON.stringify(res.out.rendered.locals).indexOf(rawMarker) === -1 &&
    res.out.clearCookieCalls === 0 && res.out.redirectTo === null);
  check(scope, 'failed destroy (HTML) logs exactly one fixed sanitized line',
    failHtmlLogs.length === 1 && failHtmlLogs[0] === EXPECTED_DESTROY_LOG);
  check(scope, 'failed destroy (HTML) log carries no raw store detail',
    failHtmlLogs.join('\n').indexOf(rawMarker) === -1);

  // Output hygiene: the log fires ONLY on the failure branch, and both
  // expected lines were captured here — a green transcript carries none.
  check(scope, 'exactly two expected destroy-failure lines were captured and none escaped',
    okJsonLogs.length + okHtmlLogs.length === 0 &&
    failJsonLogs.length + failHtmlLogs.length === 2 &&
    failJsonLogs.concat(failHtmlLogs).every((line) => line === EXPECTED_DESTROY_LOG));

  // Token endpoint: present vs missing session token.
  res = makeRes();
  authController.csrfToken(makeReq('application/json', null), res);
  check(scope, 'csrfToken handler returns the current session token with the fixed schema',
    res.out.statusCode === 200 && !!res.out.jsonBody && res.out.jsonBody.success === true &&
    res.out.jsonBody.csrfToken === 'unit-token-' + runId);
  res = makeRes();
  const emptyReq = makeReq('application/json', null);
  emptyReq.session.csrfToken = '';
  authController.csrfToken(emptyReq, res);
  check(scope, 'csrfToken handler fails closed (500 fixed JSON) without a nonempty token',
    res.out.statusCode === 500 && !!res.out.jsonBody && res.out.jsonBody.success === false);

  // Static wiring: the token route applies no-store BEFORE requireLogin.
  const routeSrc = fs.readFileSync(path.join(__dirname, '..', 'routes', 'auth.js'), 'utf8');
  const block = routeSrc.slice(routeSrc.indexOf("'/auth/csrf-token'"));
  const iNoStore = block.indexOf('no-store, private');
  const iRequire = block.indexOf('requireLogin');
  check(scope, 'route applies exact no-store before requireLogin on /auth/csrf-token',
    iNoStore !== -1 && iRequire !== -1 && iNoStore < iRequire);

  /* ---- ensureCsrfToken contract (database-free) ----
     The single token-issuance primitive. Values are compared in memory only;
     no token is ever printed. */
  const blank = {};
  const first = ensureCsrfToken(blank);
  check(scope, 'ensureCsrfToken generates a nonempty canonical token', typeof first === 'string' && first.length > 0);
  check(scope, 'ensureCsrfToken shape matches the existing 32-byte hex contract', /^[0-9a-f]{64}$/.test(first));
  check(scope, 'ensureCsrfToken stores the token on the session', blank.csrfToken === first);
  check(scope, 'repeated ensureCsrfToken calls preserve the same token', ensureCsrfToken(blank) === first);

  const preexisting = { csrfToken: 'preexisting-token-' + runId };
  check(scope, 'an existing valid token is never replaced',
    ensureCsrfToken(preexisting) === 'preexisting-token-' + runId &&
    preexisting.csrfToken === 'preexisting-token-' + runId);

  let malformedReplaced = true;
  for (const bad of [12345, {}, [], null, true, '']) {
    const s = { csrfToken: bad };
    const t = ensureCsrfToken(s);
    if (!(typeof s.csrfToken === 'string' && /^[0-9a-f]{64}$/.test(s.csrfToken) && t === s.csrfToken)) {
      malformedReplaced = false;
    }
  }
  check(scope, 'malformed stored token state is replaced with a valid token', malformedReplaced);

  check(scope, 'missing / non-object session fails safely without minting',
    ensureCsrfToken(null) === '' && ensureCsrfToken(undefined) === '' &&
    ensureCsrfToken('x') === '' && ensureCsrfToken(7) === '' && ensureCsrfToken([]) === '');

  /* ---- static ordering: mint AFTER assignSessionUser, BEFORE saveSession ----
     This is the whole point of the Supabase logout correction: the regenerated
     authenticated session must be persisted ALREADY carrying its token. */
  const authSrc = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'authController.js'), 'utf8');
  const fnStart = authSrc.indexOf('async function establishAuthenticatedSession');
  const fnBody = fnStart === -1 ? '' : authSrc.slice(fnStart, fnStart + 1200);
  const iRegen = fnBody.indexOf('await regenerateSession(req)');
  const iAssign = fnBody.indexOf('await assignSessionUser()');
  const iEnsure = fnBody.indexOf('ensureCsrfToken(req.session)');
  const iSave = fnBody.indexOf('await saveSession(req)');
  check(scope, 'establishAuthenticatedSession mints the token after assignSessionUser and before saveSession',
    fnStart !== -1 && iRegen !== -1 && iAssign !== -1 && iEnsure !== -1 && iSave !== -1 &&
    iRegen < iAssign && iAssign < iEnsure && iEnsure < iSave);
  check(scope, 'authController imports the shared ensureCsrfToken primitive',
    /const\s*\{\s*ensureCsrfToken\s*\}\s*=\s*require\('\.\.\/middleware\/csrfProtection'\)/.test(authSrc));
  check(scope, 'the pre-regeneration anonymous token is never reused',
    !/csrfToken\s*=\s*(preAuth|anonymous|oldToken|previousToken)/i.test(fnBody));

  /* ---- Supabase exact-SID destroy retry contract (database-free) ---- */
  const normalDelete = await destroyWithScript({
    deletes: [{ error: null }],
    reads: [],
  });
  check(scope, 'Supabase destroy normal success uses one delete, no readback, and one callback',
    normalDelete.error === null &&
    normalDelete.callbackCalls === 1 &&
    normalDelete.client.state.deleteCalls === 1 &&
    normalDelete.client.state.readCalls === 0);

  const ambiguousCommitted = await destroyWithScript({
    deletes: [{ error: new Error('raw-first-delete-' + runId) }],
    reads: [{ data: null, error: null }],
  });
  check(scope, 'Supabase destroy accepts an absent exact SID after an ambiguous first delete',
    ambiguousCommitted.error === null &&
    ambiguousCommitted.callbackCalls === 1 &&
    ambiguousCommitted.client.state.deleteCalls === 1 &&
    ambiguousCommitted.client.state.readCalls === 1);

  const retrySuccess = await destroyWithScript({
    deletes: [
      { error: new Error('raw-first-delete-' + runId) },
      { error: null },
    ],
    reads: [{ data: { sid: 'present' }, error: null }],
  });
  check(scope, 'Supabase destroy retries the exact SID once when readback still finds it',
    retrySuccess.error === null &&
    retrySuccess.callbackCalls === 1 &&
    retrySuccess.client.state.deleteCalls === 2 &&
    retrySuccess.client.state.readCalls === 1);

  const rejectedThenAbsent = await destroyWithScript({
    deletes: [{ reject: new Error('raw-rejection-' + runId) }],
    reads: [{ data: null, error: null }],
  });
  check(scope, 'Supabase destroy handles a rejected delete promise through exact-SID readback',
    rejectedThenAbsent.error === null &&
    rejectedThenAbsent.callbackCalls === 1 &&
    rejectedThenAbsent.client.state.deleteCalls === 1 &&
    rejectedThenAbsent.client.state.readCalls === 1);

  const terminalMarker = 'raw-terminal-detail-' + runId;
  const terminalFailure = await destroyWithScript({
    deletes: [
      { error: new Error(terminalMarker) },
      { reject: new Error(terminalMarker) },
    ],
    reads: [
      { data: { sid: 'present' }, error: null },
      { data: { sid: 'present' }, error: null },
    ],
  });
  check(scope, 'Supabase destroy fails closed after at most two deletes when the exact SID remains',
    !!terminalFailure.error &&
    terminalFailure.error.message === 'Session store operation failed.' &&
    terminalFailure.error.message.indexOf(terminalMarker) === -1 &&
    terminalFailure.callbackCalls === 1 &&
    terminalFailure.client.state.deleteCalls === 2 &&
    terminalFailure.client.state.readCalls === 2);
}

(async () => {
  console.log('=== CampuSphere M12.P1-D1 logout/session-termination probe ===');

  const authController = require('../controllers/authController');
  console.log('\nDatabase-free controller unit gate:');
  await runUnitGate(authController);

  console.log('\nmysql mode:');
  await withServer({ mode: 'mysql', port: 3357, sessionStore: 'mysql' }, (base) => runMode('mysql', base));

  if (hasSupabaseConfig()) {
    console.log('\nsupabase mode:');
    await withServer({ mode: 'supabase', port: 3358, sessionStore: 'supabase' }, (base) => runMode('supabase', base));
  } else if (process.env.PROBE_SKIP_SUPABASE === '1') {
    console.log('\nsupabase mode: SKIP - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (MySQL fallback mode).');
  } else {
    console.log('\nsupabase mode: SKIP - Supabase env not configured.');
  }

  console.log('');
  console.log('NOTE probe sessions were terminated by the logout under test; no rows, users, or fixtures were created.');
  if (failures.length === 0) {
    console.log('LOGOUT-SESSION-TERMINATION-PROBE OK: all checks passed.');
    process.exitCode = 0;
  } else {
    console.error(`LOGOUT-SESSION-TERMINATION-PROBE FAILED: ${failures.length} check(s) did not pass:`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }
})().catch((e) => {
  console.error('LOGOUT-SESSION-TERMINATION-PROBE FAILED:', e && e.message ? e.message : 'sanitized failure');
  process.exitCode = 1;
});
