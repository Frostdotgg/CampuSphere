'use strict';

/* ========================================
   CampuSphere - Auth HTTP probe (Section 2.6)
   Drives POST /login and POST /register against a locally-running
   server (default base URL http://127.0.0.1:3199). The server is
   started by the caller; this script does not boot it.

   Safety:
     - Throwaway emails are prefixed `probe-2.6-` and use the
       @probe.invalid domain so they cannot collide with real users.
     - The probe deletes its own created Supabase row in a finally
       block. Seeded demo accounts are never touched.
     - No password hashes, OAuth subjects, or service-role values are
       printed.

   Usage:
     PROBE_BASE_URL=http://127.0.0.1:3199 node scripts/auth-http-probe.js
   ======================================== */

require('dotenv').config();

const BASE_URL = process.env.PROBE_BASE_URL || 'http://127.0.0.1:3199';

// M12.P1-R1: the caller starts the target server, so this probe cannot infer
// its AUTH_DATA_SOURCE. Set PROBE_AUTH_SOURCE=mysql when the server uses the
// local MySQL auth backend; the default is 'supabase' (this probe verifies
// rows through the Supabase client — its designed target) which then REQUIRES
// the test-only SUPABASE_REGRESSION_* env and fails closed when incomplete.
// No hardcoded live-capable credential remains in this probe.
const { getRegressionCredentials } = require('./regressionCredentials');
// Shared probe session ownership (scripts/probeSessionLifecycle.js). This
// legacy probe logs canonical identities in, so it must terminate those
// sessions through the supported logout interface like every other probe.
const { createProbeSessionTracker } = require('./probeSessionLifecycle');
const AUTH_SOURCE =
  String(process.env.PROBE_AUTH_SOURCE || 'supabase').trim().toLowerCase() === 'mysql'
    ? 'mysql' : 'supabase';
const CREDS = getRegressionCredentials(AUTH_SOURCE);

const PROBE_PREFIX = 'probe-2.6-';
const runId = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
const throwawayEmail = PROBE_PREFIX + 'reg-' + runId + '@probe.invalid';
const adminAttemptEmail = PROBE_PREFIX + 'admin-attempt-' + runId + '@probe.invalid';

function out(label, value) {
  // eslint-disable-next-line no-console
  console.log(label + ':', typeof value === 'string' ? value : JSON.stringify(value));
}

function getSetCookies(headers) {
  if (typeof headers.getSetCookie === 'function') {
    const c = headers.getSetCookie();
    if (Array.isArray(c)) return c;
  }
  if (typeof headers.raw === 'function') {
    const raw = headers.raw();
    if (raw && raw['set-cookie']) return raw['set-cookie'];
  }
  // Fallback: single 'set-cookie' header value
  const sc = headers.get('set-cookie');
  return sc ? [sc] : [];
}

/* Adapt this probe's existing Set-Cookie handling into the in-memory jar shape
   the shared session lifecycle expects: header() and apply(response). Cookie
   VALUES stay in memory and are never printed. The legacy HTTP/login/register
   semantics above and below are untouched. */
function makeJar() {
  const store = {};
  const ingest = (list) => {
    for (const c of list || []) {
      const pair = String(c).split(';')[0];
      const i = pair.indexOf('=');
      if (i > 0) store[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
    }
  };
  return {
    header() { return Object.entries(store).map(([k, v]) => `${k}=${v}`).join('; '); },
    apply(res) { if (res && res.headers) ingest(getSetCookies(res.headers)); },
    ingestList(list) { ingest(list); },
  };
}

async function postForm(path, fields) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null) body.append(k, String(v));
  }
  const res = await fetch(BASE_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    redirect: 'manual'
  });
  let text = '';
  // Only read body for non-redirect responses (render-with-error cases).
  if (res.status >= 200 && res.status < 300) {
    text = await res.text();
  }
  return {
    status: res.status,
    location: res.headers.get('location'),
    setCookies: getSetCookies(res.headers),
    body: text
  };
}

(async () => {
  let allOk = true;
  const expect = (label, cond) => {
    if (!cond) {
      // eslint-disable-next-line no-console
      console.log('FAIL:', label);
      allOk = false;
    }
  };

  // One tracker for this probe run; results flow through the existing recorder.
  const sessions = createProbeSessionTracker({
    base: BASE_URL,
    record: (label, pass) => expect(label, pass),
  });

  /* Outer try: session termination is the OUTERMOST cleanup action, so it runs
     even if the throwaway-user cleanup below throws. Intentionally NOT
     re-indented (minimal diff). */
  try {

  // -- 1. admin login -----------------------------------------------------
  const r1 = await postForm('/login', { email: CREDS.admin.email, password: CREDS.admin.password });
  out('1. admin login', { status: r1.status, location: r1.location, has_set_cookie: r1.setCookies.length > 0 });
  expect('admin login is 302 /admin with Set-Cookie',
    r1.status === 302 && r1.location === '/admin' && r1.setCookies.length > 0);
  if (r1.status === 302 && r1.setCookies.length > 0) {
    const adminJar = makeJar();
    adminJar.ingestList(r1.setCookies);
    sessions.register('admin', adminJar, '/admin');
  }

  // -- 2. student login --------------------------------------------------
  const r2 = await postForm('/login', { email: CREDS.student.email, password: CREDS.student.password });
  out('2. student login', { status: r2.status, location: r2.location, has_set_cookie: r2.setCookies.length > 0 });
  expect('student login is 302 /dashboard with Set-Cookie',
    r2.status === 302 && r2.location === '/dashboard' && r2.setCookies.length > 0);
  if (r2.status === 302 && r2.setCookies.length > 0) {
    const studentJar = makeJar();
    studentJar.ingestList(r2.setCookies);
    sessions.register('student', studentJar, '/dashboard');
  }

  // -- 3. bad password ---------------------------------------------------
  const r3 = await postForm('/login', { email: CREDS.admin.email, password: 'wrong-password-' + runId });
  out('3. bad password', { status: r3.status, has_error_message: r3.body.includes('Invalid email or password.') });
  expect('bad password renders 200 with error',
    r3.status === 200 && r3.body.includes('Invalid email or password.'));

  // -- 4. register with role=admin (must be blocked) ---------------------
  const r4 = await postForm('/register', {
    fullName: 'Probe AdminAttempt',
    email: adminAttemptEmail,
    password: 'probe-password',
    role: 'admin'
  });
  out('4. register role=admin blocked', {
    status: r4.status,
    has_invalid_role_msg: r4.body.includes('Invalid role')
  });
  expect('register admin renders 200 with invalid-role error',
    r4.status === 200 && r4.body.includes('Invalid role'));

  // -- 5. register a throwaway non-admin guest ---------------------------
  const r5 = await postForm('/register', {
    fullName: 'Probe Throwaway',
    email: throwawayEmail,
    password: 'probe-password',
    role: 'guest',
    address: 'probe address',
    phone: '09000000000'
  });
  out('5. register throwaway guest', {
    status: r5.status, location: r5.location, has_set_cookie: r5.setCookies.length > 0
  });
  expect('throwaway register is 302 /dashboard with Set-Cookie',
    r5.status === 302 && r5.location === '/dashboard' && r5.setCookies.length > 0);

  // Direct Supabase verification (server-side; service-role key is local-only).
  const { getSupabaseClient } = require('../config/supabase');
  const sb = getSupabaseClient();

  // -- 6. admin-attempt did NOT create a row -----------------------------
  const { data: adminRows, error: adminErr } = await sb
    .from('users').select('id,email,role').eq('email', adminAttemptEmail);
  out('6. admin-attempt row NOT created', {
    count: adminRows ? adminRows.length : 'err',
    error: adminErr ? adminErr.message : null
  });
  expect('admin-attempt left no row',
    !adminErr && Array.isArray(adminRows) && adminRows.length === 0);

  // -- 7. throwaway row WAS created with role=guest ----------------------
  const { data: throwawayRows, error: thrErr } = await sb
    .from('users').select('id,email,role').eq('email', throwawayEmail);
  out('7. throwaway row created', {
    count: throwawayRows ? throwawayRows.length : 'err',
    role: throwawayRows && throwawayRows[0] ? throwawayRows[0].role : null,
    error: thrErr ? thrErr.message : null
  });
  expect('throwaway row exists with role=guest',
    !thrErr && Array.isArray(throwawayRows) && throwawayRows.length === 1 && throwawayRows[0].role === 'guest');

  // -- 8. cleanup throwaway ---------------------------------------------
  if (throwawayRows && throwawayRows.length === 1) {
    const id = throwawayRows[0].id;
    const { error: delErr } = await sb.from('users').delete().eq('id', id);
    out('8. cleanup throwaway delete', { ok: !delErr, error: delErr ? delErr.message : null });
    expect('cleanup deleted the throwaway', !delErr);
  }

  // -- 9. final leftover check ------------------------------------------
  const { data: leftovers } = await sb
    .from('users').select('id,email').like('email', PROBE_PREFIX + '%@probe.invalid');
  out('9. leftover probe rows', leftovers || 'err');
  expect('no leftover probe rows', Array.isArray(leftovers) && leftovers.length === 0);

  } finally {
    // Throwaway-user cleanup above runs first; session termination is last and
    // runs even if that cleanup threw.
    await sessions.terminateAll();
  }

  // eslint-disable-next-line no-console
  console.log(allOk ? 'PROBE DONE: ALL_OK' : 'PROBE DONE: WITH_ISSUES');
  process.exit(allOk ? 0 : 1);
})().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('PROBE FAILED:', e && e.stack ? e.stack : e);
  process.exit(1);
});
