'use strict';

/* ========================================
   CampuSphere — M12.P1-R5 bounded anonymous access-denial probe (STANDALONE)

   Proves the R5 contract end-to-end in BOTH runtime backends through supported
   HTTP/application interfaces only:

     - routine ANONYMOUS requests to a login-gated route (GET /dashboard) keep
       their exact 302 -> /auth denial and create ZERO system_logs rows;
     - routine ANONYMOUS requests to a role-gated JSON route
       (GET /admin/api/logs) keep their exact fixed 401 JSON denial and create
       ZERO system_logs rows;
     - ONE authenticated wrong-role denial still creates EXACTLY ONE sanitized
       authorization / access.denied / denied row carrying the actor identity,
       target_type=route, the QUERY-FREE request path, the fixed message, and a
       null attempted_email;
     - a real authentication failure still creates EXACTLY ONE
       authentication / login.local / failure row.

   Harness: scripts/with-server.js only (self-terminating; never a foreground
   server). MySQL runs on dedicated port 3381, Supabase on 3382; the probe
   REFUSES to start a leg whose port is occupied and never kills any process.

   Session ownership: every canonical login is registered with
   scripts/probeSessionLifecycle.js and terminated through the real logout
   interface from the OUTERMOST finally.

   Audit rows produced here are immutable legitimate security evidence. This
   probe creates only the minimum events its verification requires and NEVER
   deletes, clears, truncates, repairs, or directly mutates system_logs. All
   log access is through the admin-only read API.

   Privacy: fixed sanitized PASS/FAIL labels only. No credential, canary
   password, email, cookie, token, session id, numeric identifier, audit-row
   payload, Supabase URL/key, or backend error is ever printed.
   ======================================== */

require('dotenv').config();

const crypto = require('crypto');
const net = require('net');
const { withServer } = require('./with-server');
const { hasSupabaseConfig } = require('../config/supabase');
const { getRegressionCredentials, requireIdentity } = require('./regressionCredentials');
const { createProbeSessionTracker } = require('./probeSessionLifecycle');

/* Dedicated ports; never shared with npm test (3371/3372) or another probe. */
const PORTS = Object.freeze({ mysql: 3381, supabase: 3382 });

/* Exact pre-R5 denial contracts that must remain byte/shape compatible. */
const ANON_JSON_DENIAL = Object.freeze({ success: false, message: 'Authentication required.' });
const ROLE_JSON_DENIAL = Object.freeze({
  success: false,
  message: 'You do not have permission to perform this action.',
});
const DENIAL_MESSAGE = 'Access to a protected route was denied.';
const LOGIN_FAILURE_MESSAGE = 'Local login failed: invalid credentials.';
const LOGIN_FAILURE_HTML = 'Invalid email or password.';
const ANON_REQUEST_COUNT = 10;

/* Bounded polling convention shared by every fire-and-forget wait below. */
const POLL_ATTEMPTS = 24;
const POLL_DELAY_MS = 250;
const GLOBAL_STABILITY_READS = 6;

/* Unfiltered read. `summary.total` on this response is the AUTHORITATIVE count
   of every system_logs row of any taxonomy — Supabase computes it as
   countLogs({}) and MySQL as the sum of an unfiltered GROUP BY outcome (see
   controllers/adminController.js). A filtered `total` can never substitute for
   it: a filtered count staying flat only proves that ONE taxonomy did not grow,
   which is exactly the gap this postcondition closes. */
const GLOBAL_TOTAL_QUERY = 'limit=1';

/* Exact allowlisted audit DTO shape (controllers/adminController.js logToDto). */
const AUDIT_DTO_KEYS = Object.freeze([
  'action', 'actor_role', 'actor_user_id', 'attempted_email', 'created_at',
  'event_type', 'id', 'message', 'outcome', 'target_id', 'target_type',
]);

/* Substrings that must NEVER appear in a persisted audit row. Proves no raw
   request material (IP, header, cookie, session id, token, body) leaked into
   a column. Compared in memory; the row itself is never printed. */
const PRIVATE_MATERIAL_MARKERS = Object.freeze([
  'campusphere.sid', 'cookie', 'set-cookie', 'authorization:', 'x-csrf-token',
  'csrf', 'user-agent', 'accept:', 'password', 'bearer', '127.0.0.1', '::1',
  'sess', 'connect.sid',
]);

const failures = [];
let checks = 0;

function check(scope, label, ok) {
  checks += 1;
  const pass = ok === true;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!pass) failures.push(`${scope} :: ${label}`);
}

const parseJson = (t) => { try { return JSON.parse(t); } catch (e) { return null; } };
const sameKeys = (obj, keys) =>
  !!obj && typeof obj === 'object' && Object.keys(obj).sort().join(',') === keys.slice().sort().join(',');

function portIsFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => tester.close(() => resolve(true)));
    tester.listen(port, '127.0.0.1');
  });
}

function cookieJar() {
  const store = {};
  return {
    apply(res) {
      const list = res.headers.getSetCookie
        ? res.headers.getSetCookie()
        : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
      for (const c of list) {
        const pair = c.split(';')[0];
        const i = pair.indexOf('=');
        if (i > 0) store[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
      }
    },
    header() { return Object.entries(store).map(([k, v]) => `${k}=${v}`).join('; '); },
  };
}

const metaCsrf = (html) => {
  const m = String(html).match(/name="csrf-token" content="([^"]+)"/);
  return m ? m[1] : '';
};

/**
 * Authenticate through the supported CSRF + POST /login flow.
 * Credential values stay in memory and are never returned or printed.
 * @returns {Promise<boolean>} true when the login redirect was issued
 */
async function login(base, jar, email, password) {
  let r = await fetch(base + '/auth', { headers: { Accept: 'text/html' } });
  jar.apply(r);
  const token = metaCsrf(await r.text());
  if (!token) return false;
  r = await fetch(base + '/login', {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.header() },
    body: 'email=' + encodeURIComponent(email) +
      '&password=' + encodeURIComponent(password) +
      '&_csrf=' + encodeURIComponent(token),
  });
  jar.apply(r);
  await r.text();
  return r.status === 302;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** FAILED read sentinel. Both counts are -1 so a caller can never mistake an
    unusable read for a real zero. */
const INVALID_READ = Object.freeze({ ok: false, total: -1, globalTotal: -1, top: null });

/**
 * PURE: a non-negative integer count, or null when the value is missing,
 * malformed, non-numeric, non-integer, or negative. Strings are rejected
 * outright rather than coerced, so a `"12"` regression cannot pass as a count.
 *
 * @param {*} value candidate count from the admin logs API
 * @returns {number|null}
 */
function toCount(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (!Number.isInteger(value)) return null;
  if (value < 0) return null;
  return value;
}

/**
 * PURE, FAIL-CLOSED validation of one GET /admin/api/logs response.
 *
 * Both counts must be present and well formed:
 *   total       — the FILTERED result count (body.total)
 *   globalTotal — the AUTHORITATIVE unfiltered system_logs count
 *                 (body.summary.total)
 *
 * The two are read from distinct fields and are never substituted for one
 * another. Any missing/!200/shape/count defect returns null.
 *
 * Exported so the in-suite gate can drive the REAL validator with negative
 * fixtures instead of a copy.
 *
 * @param {number} status HTTP status
 * @param {*} body parsed JSON body (never printed)
 * @returns {{ok: true, total: number, globalTotal: number, top: object|null}|null}
 */
function validateLogsBody(status, body) {
  if (status !== 200) return null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (body.success !== true) return null;
  if (!Array.isArray(body.logs)) return null;
  if (!body.summary || typeof body.summary !== 'object' || Array.isArray(body.summary)) return null;

  const total = toCount(body.total);
  const globalTotal = toCount(body.summary.total);
  if (total === null || globalTotal === null) return null;

  return { ok: true, total, globalTotal, top: body.logs.length ? body.logs[0] : null };
}

/**
 * Read the admin-only audit API. SAFE GET only — it never creates a denial, a
 * login, or any other audit event, and it never touches the database directly.
 *
 * @returns {Promise<{ok: boolean, total: number, globalTotal: number, top: object|null}>}
 */
async function readLogs(base, jar, query) {
  let res;
  try {
    res = await fetch(base + '/admin/api/logs?' + query, {
      headers: { Accept: 'application/json', Cookie: jar.header() },
    });
  } catch (e) {
    return INVALID_READ; // fail closed; never print the backend error
  }
  jar.apply(res); // absorb a rolled session cookie; the value is never read
  const body = parseJson(await res.text()); // never printed
  return validateLogsBody(res.status, body) || INVALID_READ;
}

const AUTHZ_DENIED_QUERY = 'event_type=authorization&outcome=denied&limit=1';
const AUTH_FAILURE_QUERY = 'event_type=authentication&outcome=failure&limit=1';

/** Default unfiltered reader; overridable so the gate can drive the bounded
    helpers below from a stub sequence with no server and no database. */
const defaultGlobalReader = (base, jar) => readLogs(base, jar, GLOBAL_TOTAL_QUERY);

/**
 * BOUNDED, condition-based polling for a fire-and-forget audit write. Safe-GET
 * repetition only: it issues no denial, no login, and no mutation, and it stops
 * as soon as the expected total is observed.
 *
 * @returns {Promise<{ok: boolean, total: number, globalTotal: number, top: object|null}>}
 */
async function pollForTotal(base, jar, query, expected, attempts = POLL_ATTEMPTS, delayMs = POLL_DELAY_MS) {
  let last = INVALID_READ;
  for (let i = 0; i < attempts; i++) {
    last = await readLogs(base, jar, query);
    if (last.ok && last.total === expected) return last;
    await sleep(delayMs);
  }
  return last;
}

/**
 * BOUNDED stability confirmation: the FILTERED total must equal `expected` on
 * every one of several consecutive safe reads, so a late fire-and-forget write
 * cannot be mistaken for "no row was ever created".
 */
async function totalStaysAt(base, jar, query, expected, reads = GLOBAL_STABILITY_READS, delayMs = POLL_DELAY_MS) {
  for (let i = 0; i < reads; i++) {
    const r = await readLogs(base, jar, query);
    if (!r.ok || r.total !== expected) return false;
    if (i < reads - 1) await sleep(delayMs);
  }
  return true;
}

/**
 * BOUNDED, condition-based AUTHORITATIVE baseline.
 *
 * The administrator's own successful login is audited fire-and-forget, so a
 * single immediate read can capture a total that is about to move on its own.
 * A baseline is therefore accepted only once TWO CONSECUTIVE valid reads report
 * the SAME globalTotal; an invalid read resets the run so a defect can never be
 * bridged. At most `attempts` reads at the shared bounded interval; a clean
 * failure is returned rather than an unproven number.
 *
 * @returns {Promise<{ok: boolean, globalTotal: number, reads: number}>}
 */
async function readStableGlobalTotal(base, jar, opts = {}) {
  const read = opts.read || defaultGlobalReader;
  const attempts = Number.isInteger(opts.attempts) && opts.attempts > 0 ? opts.attempts : POLL_ATTEMPTS;
  const delayMs = Number.isInteger(opts.delayMs) && opts.delayMs >= 0 ? opts.delayMs : POLL_DELAY_MS;

  let previous = null;
  for (let i = 0; i < attempts; i++) {
    const r = await read(base, jar);
    if (r && r.ok === true && toCount(r.globalTotal) !== null) {
      if (previous !== null && r.globalTotal === previous) {
        return { ok: true, globalTotal: r.globalTotal, reads: i + 1 };
      }
      previous = r.globalTotal;
    } else {
      previous = null; // an unusable read breaks the consecutive requirement
    }
    if (i < attempts - 1 && delayMs > 0) await sleep(delayMs);
  }
  return { ok: false, globalTotal: -1, reads: attempts };
}

/**
 * BOUNDED postcondition: the AUTHORITATIVE global system_logs count must equal
 * `expected` on every one of `reads` consecutive valid reads. Any unusable read
 * fails closed — absence of evidence is never treated as evidence of absence.
 *
 * @returns {Promise<boolean>}
 */
async function globalTotalStaysAt(base, jar, expected, opts = {}) {
  const read = opts.read || defaultGlobalReader;
  const reads = Number.isInteger(opts.reads) && opts.reads > 0 ? opts.reads : GLOBAL_STABILITY_READS;
  const delayMs = Number.isInteger(opts.delayMs) && opts.delayMs >= 0 ? opts.delayMs : POLL_DELAY_MS;

  if (toCount(expected) === null) return false;
  for (let i = 0; i < reads; i++) {
    const r = await read(base, jar);
    if (!r || r.ok !== true || r.globalTotal !== expected) return false;
    if (i < reads - 1 && delayMs > 0) await sleep(delayMs);
  }
  return true;
}

/** True when no serialized field of the row carries raw request material. */
function rowCarriesNoPrivateMaterial(row, forbiddenValues) {
  if (!row || typeof row !== 'object') return false;
  const serialized = JSON.stringify(row).toLowerCase();
  for (const marker of PRIVATE_MATERIAL_MARKERS) {
    if (serialized.includes(marker)) return false;
  }
  for (const value of forbiddenValues) {
    // Only distinctive values are searched, so a very short secret cannot
    // coincidentally match ordinary row text and mask a real leak check.
    const v = String(value == null ? '' : value).toLowerCase();
    if (v.length >= 8 && serialized.includes(v)) return false;
  }
  return true;
}

async function runMode(mode, base) {
  const scope = mode;
  const creds = getRegressionCredentials(mode);
  const admin = requireIdentity(creds, 'admin');
  const student = requireIdentity(creds, 'student');

  const adminJar = cookieJar();
  const studentJar = cookieJar();
  const sessions = createProbeSessionTracker({
    base,
    record: (label, pass) => check(scope, label, pass),
  });

  try {
    /* ---- A. authenticate the regression administrator + audit baselines ---- */
    const adminIn = await login(base, adminJar, admin.email, admin.password);
    check(scope, 'A: the canonical regression administrator authenticated', adminIn === true);
    if (!adminIn) return;
    sessions.register('admin', adminJar, '/dashboard');

    const deniedBase = await readLogs(base, adminJar, AUTHZ_DENIED_QUERY);
    const failureBase = await readLogs(base, adminJar, AUTH_FAILURE_QUERY);
    check(scope, 'A: the admin audit API answered the authorization/denied baseline read',
      deniedBase.ok === true && Number.isInteger(deniedBase.total) && deniedBase.total >= 0);
    check(scope, 'A: the admin audit API answered the authentication/failure baseline read',
      failureBase.ok === true && Number.isInteger(failureBase.total) && failureBase.total >= 0);
    if (!deniedBase.ok || !failureBase.ok) return;

    /* AUTHORITATIVE baseline, captured IMMEDIATELY before the anonymous batches
       and only after two consecutive reads agree — the administrator's own
       login row is written fire-and-forget, so a naive single read could
       otherwise pin a total that is still about to move. */
    const globalBaseline = await readStableGlobalTotal(base, adminJar);
    check(scope, 'A: a stable authoritative global system_logs baseline was obtained',
      globalBaseline.ok === true && Number.isInteger(globalBaseline.globalTotal) &&
      globalBaseline.globalTotal >= 0);

    /* ---- B. exactly ten anonymous browser-style login-gated requests ---- */
    const anonBrowserJar = cookieJar();
    let browserDenials = 0;
    for (let i = 0; i < ANON_REQUEST_COUNT; i++) {
      const res = await fetch(base + '/dashboard', {
        method: 'GET',
        redirect: 'manual',
        headers: { Accept: 'text/html', Cookie: anonBrowserJar.header() },
      });
      anonBrowserJar.apply(res);
      await res.text();
      if (res.status === 302 && (res.headers.get('location') || '') === '/auth') browserDenials += 1;
    }
    check(scope, `B: all ${ANON_REQUEST_COUNT} anonymous GET /dashboard requests kept the exact 302 -> /auth denial`,
      browserDenials === ANON_REQUEST_COUNT);

    /* ---- C. exactly ten anonymous JSON role-gated requests ---- */
    const anonJsonJar = cookieJar();
    let jsonDenials = 0;
    for (let i = 0; i < ANON_REQUEST_COUNT; i++) {
      const res = await fetch(base + '/admin/api/logs', {
        method: 'GET',
        headers: { Accept: 'application/json', Cookie: anonJsonJar.header() },
      });
      anonJsonJar.apply(res);
      const body = parseJson(await res.text()); // never printed
      if (res.status === 401 && !!body && body.success === ANON_JSON_DENIAL.success &&
        body.message === ANON_JSON_DENIAL.message &&
        sameKeys(body, Object.keys(ANON_JSON_DENIAL))) jsonDenials += 1;
    }
    check(scope, `C: all ${ANON_REQUEST_COUNT} anonymous JSON GET /admin/api/logs requests kept the exact fixed 401 denial`,
      jsonDenials === ANON_REQUEST_COUNT);

    /* ---- D. the twenty anonymous denials persisted nothing ----
       PRIMARY: the authoritative unfiltered system_logs count is unchanged, so
       the anonymous batches added no row of ANY taxonomy — not merely none of
       the one taxonomy the filter selects.
       DEFENCE IN DEPTH: the filtered authorization/access.denied/denied count
       is separately proven flat. */
    const globalHeld = await globalTotalStaysAt(base, adminJar, globalBaseline.globalTotal);
    check(scope,
      `D: the ${ANON_REQUEST_COUNT * 2} anonymous denials added zero system_logs rows of any taxonomy`,
      globalBaseline.ok === true && globalHeld === true);

    const stayedZero = await totalStaysAt(base, adminJar, AUTHZ_DENIED_QUERY, deniedBase.total);
    check(scope,
      `D: the ${ANON_REQUEST_COUNT * 2} anonymous denials added zero authorization/access.denied/denied rows`,
      stayedZero === true);

    /* ---- E. one authenticated wrong-role denial ---- */
    const studentIn = await login(base, studentJar, student.email, student.password);
    check(scope, 'E: the canonical regression student authenticated', studentIn === true);
    if (!studentIn) return;
    sessions.register('student', studentJar, '/dashboard');

    const roleRes = await fetch(base + '/admin/api/logs', {
      headers: { Accept: 'application/json', Cookie: studentJar.header() },
    });
    const roleBody = parseJson(await roleRes.text()); // never printed
    check(scope, 'E: the authenticated wrong-role request kept the exact fixed 403 JSON body',
      roleRes.status === 403 && !!roleBody &&
      roleBody.success === ROLE_JSON_DENIAL.success &&
      roleBody.message === ROLE_JSON_DENIAL.message &&
      sameKeys(roleBody, Object.keys(ROLE_JSON_DENIAL)));

    /* ---- F. exactly one sanitized authenticated denial row ---- */
    const expectedDenied = deniedBase.total + 1;
    const denied = await pollForTotal(base, adminJar, AUTHZ_DENIED_QUERY, expectedDenied);
    check(scope, 'F: the authenticated role denial added exactly one authorization row',
      denied.ok === true && denied.total === expectedDenied);

    const row = denied.top;
    const rowPresent = denied.ok && denied.total === expectedDenied && !!row;
    check(scope, 'F: the new row exposes only the allowlisted audit fields',
      rowPresent && sameKeys(row, AUDIT_DTO_KEYS));
    check(scope, 'F: the new row carries event_type=authorization',
      rowPresent && row.event_type === 'authorization');
    check(scope, 'F: the new row carries action=access.denied',
      rowPresent && row.action === 'access.denied');
    check(scope, 'F: the new row carries outcome=denied',
      rowPresent && row.outcome === 'denied');
    check(scope, 'F: the new row carries the intended actor role',
      rowPresent && row.actor_role === 'student-cspc');
    check(scope, 'F: the new row carries a positive integer actor id (uniform backend identity space)',
      rowPresent && Number.isInteger(Number(row.actor_user_id)) && Number(row.actor_user_id) >= 1);
    check(scope, 'F: the new row carries target_type=route',
      rowPresent && row.target_type === 'route');
    check(scope, 'F: the new row target is the query-free request path',
      rowPresent && row.target_id === '/admin/api/logs' && !String(row.target_id).includes('?'));
    check(scope, 'F: the new row carries the fixed sanitized message',
      rowPresent && row.message === DENIAL_MESSAGE);
    check(scope, 'F: the new row carries a null attempted_email',
      rowPresent && row.attempted_email === null);
    check(scope, 'F: the new row carries no raw request material',
      rowPresent && rowCarriesNoPrivateMaterial(row, [student.email, student.password]));

    const deniedHeld = await totalStaysAt(base, adminJar, AUTHZ_DENIED_QUERY, expectedDenied);
    check(scope, 'F: the authorization total stays at exactly one new row (no duplicate write)',
      deniedHeld === true);

    /* ---- G. one real authentication failure ---- */
    // In-memory canary only: cryptographically random, never printed, never
    // stored, and impossible to collide with the real replacement password.
    const canaryPassword = 'r5-canary-' + crypto.randomBytes(24).toString('hex');
    const canaryJar = cookieJar();
    let cr = await fetch(base + '/auth', { headers: { Accept: 'text/html' } });
    canaryJar.apply(cr);
    const canaryToken = metaCsrf(await cr.text());
    check(scope, 'G: the supported CSRF flow issued a token for the invalid-login attempt',
      canaryToken.length > 0);

    cr = await fetch(base + '/login', {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: canaryJar.header() },
      body: 'email=' + encodeURIComponent(student.email) +
        '&password=' + encodeURIComponent(canaryPassword) +
        '&_csrf=' + encodeURIComponent(canaryToken),
    });
    canaryJar.apply(cr);
    const canaryHtml = await cr.text(); // never printed
    check(scope, 'G: the invalid login kept the normal sanitized rejection response',
      cr.status === 200 && canaryHtml.includes(LOGIN_FAILURE_HTML));

    const canaryReplay = await fetch(base + '/dashboard', {
      redirect: 'manual',
      headers: { Accept: 'text/html', Cookie: canaryJar.header() },
    });
    await canaryReplay.text();
    check(scope, 'G: the rejected login established no authenticated session',
      canaryReplay.status === 302 && (canaryReplay.headers.get('location') || '') === '/auth');

    /* ---- H. exactly one authentication/login.local/failure row ---- */
    const expectedFailure = failureBase.total + 1;
    const failure = await pollForTotal(base, adminJar, AUTH_FAILURE_QUERY, expectedFailure);
    check(scope, 'H: the authentication failure added exactly one authentication row',
      failure.ok === true && failure.total === expectedFailure);

    const failRow = failure.top;
    const failPresent = failure.ok && failure.total === expectedFailure && !!failRow;
    check(scope, 'H: the failure row carries event_type=authentication',
      failPresent && failRow.event_type === 'authentication');
    check(scope, 'H: the failure row carries action=login.local',
      failPresent && failRow.action === 'login.local');
    check(scope, 'H: the failure row carries outcome=failure',
      failPresent && failRow.outcome === 'failure');
    check(scope, 'H: the failure row carries the fixed sanitized message',
      failPresent && failRow.message === LOGIN_FAILURE_MESSAGE);
    check(scope, 'H: the failure row carries no actor id (no authenticated actor existed)',
      failPresent && failRow.actor_user_id === null);
    // attempted_email is an INTENTIONAL existing audit column. It is verified
    // only through the admin-only interface and is never printed or returned.
    check(scope, 'H: the failure row records the normalized attempted identity (verified, never printed)',
      failPresent && typeof failRow.attempted_email === 'string' &&
      failRow.attempted_email === String(student.email).trim().toLowerCase());
    check(scope, 'H: the failure row never records the submitted password',
      failPresent && !JSON.stringify(failRow).toLowerCase().includes(canaryPassword.toLowerCase()));

    const failureHeld = await totalStaysAt(base, adminJar, AUTH_FAILURE_QUERY, expectedFailure);
    check(scope, 'H: the authentication-failure total stays at exactly one new row',
      failureHeld === true);

    check(scope, 'I: both canonical sessions were registered for owned termination',
      sessions.count() === 2);
  } finally {
    /* ---- I. OUTERMOST termination through the supported logout interface ----
       terminateAll() proves the fixed logout contract, the clearing cookie, and
       former-cookie denial for each owned session. No session row is touched
       directly and no audit row is removed. */
    await sessions.terminateAll();
  }
}

async function runLeg(mode) {
  const port = PORTS[mode];
  const free = await portIsFree(port);
  check(mode, 'the dedicated probe port is confirmed free before launch', free === true);
  if (!free) {
    // Fail closed. Never kill or inspect whatever owns the port.
    console.error(`  [SKIP] ${mode} :: leg not started — its dedicated port is occupied by another process.`);
    return;
  }
  await withServer({ mode, port, sessionStore: mode }, (base) => runMode(mode, base));
}

async function main() {
  console.log('=== CampuSphere M12.P1-R5 bounded anonymous access-denial probe (STANDALONE) ===');
  console.log('Supported HTTP/application interfaces only. Audit rows are immutable evidence and are never removed.');

  console.log('\nmysql mode:');
  await runLeg('mysql');

  // Supabase FAILS CLOSED: an unconfigured environment is a probe failure, not
  // a skip. The regression-credential loader fails closed independently.
  console.log('\nsupabase mode:');
  if (!hasSupabaseConfig()) {
    throw new Error('Supabase configuration is required for the R5 probe; the Supabase leg is never skipped.');
  }
  await runLeg('supabase');

  console.log('');
  if (failures.length === 0) {
    console.log(`BOUNDED-ANONYMOUS-ACCESS-DENIAL-PROBE OK: ${checks}/${checks} checks passed.`);
  } else {
    console.error(`BOUNDED-ANONYMOUS-ACCESS-DENIAL-PROBE FAILED: ${failures.length}/${checks} check(s) did not pass:`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    // Fixed sanitized message only — never a stack, value, or backend detail.
    console.error('BOUNDED-ANONYMOUS-ACCESS-DENIAL-PROBE FAILED:',
      error && error.message ? error.message : 'sanitized failure');
    process.exitCode = 1;
  });
}

module.exports = {
  PORTS,
  ANON_REQUEST_COUNT,
  AUDIT_DTO_KEYS,
  // Bounded-polling convention, pinned by the in-suite gate.
  POLL_ATTEMPTS,
  POLL_DELAY_MS,
  GLOBAL_STABILITY_READS,
  GLOBAL_TOTAL_QUERY,
  AUTHZ_DENIED_QUERY,
  // Production helpers exported as test surface so the in-suite gate drives the
  // REAL implementations with negative fixtures instead of a copy.
  toCount,
  validateLogsBody,
  readStableGlobalTotal,
  globalTotalStaysAt,
};
