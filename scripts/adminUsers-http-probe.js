'use strict';

/* ========================================
   CampuSphere - Admin Users HTTP probe (Section 2.10)

   Drives /admin/api/users (POST/PUT/DELETE) against a locally-running
   server (default base URL http://127.0.0.1:3210). The server is started
   by the caller; this script does not boot it.

   AUTH_DATA_SOURCE: the controller chooses its backend at request time
   from process.env on the server. Start the server with
   AUTH_DATA_SOURCE=supabase to exercise the Supabase branch.

   Coverage:
     1. Admin login (regression admin via the test-only credential loader)
     2. Create a throwaway user via POST /admin/api/users (201)
     3. Duplicate-email create returns 409
     4. Update the throwaway via PUT /admin/api/users/:id (200)
     5. Update WITHOUT password preserves the existing password column
     6. Self-delete returns 403 (admin tries to delete own account)
     7. Delete the throwaway via DELETE /admin/api/users/:id (200)
     8. Logged-out request gets JSON 401 (wantsJson via /api/ path)
     9. Logged-in non-admin (throwaway guest) gets JSON 403
    10. Final leftover sweep against probe-2.10-%@probe.invalid

   Safety:
     - Throwaway emails use the @probe.invalid domain and a probe-2.10-
       prefix so they cannot collide with real users or with earlier
       probe runs (2.5 / 2.6 / 2.7).
     - All throwaway rows are deleted via the Supabase admin client in
       the finally block, even on failure.
     - Password hashes are reduced to a boolean ("preserved: true|false");
       no raw hash, password, oauth_subject, or service-role value is
       printed.

   Usage:
     PROBE_BASE_URL=http://127.0.0.1:3210 node scripts/adminUsers-http-probe.js
   ======================================== */

require('dotenv').config();

const BASE_URL = process.env.PROBE_BASE_URL || 'http://127.0.0.1:3210';

// M12.P1-R1: the caller starts the target server, so this probe cannot infer
// its AUTH_DATA_SOURCE. Set PROBE_AUTH_SOURCE=mysql when the server uses the
// local MySQL auth backend; the default is 'supabase' (this probe verifies
// rows through the Supabase client — its designed target) which then REQUIRES
// the test-only SUPABASE_REGRESSION_* env and fails closed when incomplete.
// No hardcoded live-capable credential remains in this probe.
const { getRegressionCredentials } = require('./regressionCredentials');
// Shared probe session ownership (scripts/probeSessionLifecycle.js). This
// legacy probe logs the canonical administrator in, so it must terminate that
// session through the supported logout interface like every other probe.
const { createProbeSessionTracker } = require('./probeSessionLifecycle');
const AUTH_SOURCE =
  String(process.env.PROBE_AUTH_SOURCE || 'supabase').trim().toLowerCase() === 'mysql'
    ? 'mysql' : 'supabase';
const CREDS = getRegressionCredentials(AUTH_SOURCE);

const PROBE_PREFIX = 'probe-2.10-';
const runId = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
const throwawayEmail = PROBE_PREFIX + 'user-' + runId + '@probe.invalid';
const dupAttemptEmail = throwawayEmail; // intentionally identical
const nonAdminEmail = PROBE_PREFIX + 'nonadmin-' + runId + '@probe.invalid';

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
  const sc = headers.get('set-cookie');
  return sc ? [sc] : [];
}

/* Adapt this probe's existing Set-Cookie handling into the in-memory jar shape
   the shared session lifecycle expects: header() and apply(response). Cookie
   VALUES stay in memory and are never printed. The legacy HTTP semantics and
   the existing cookieJarFromSetCookies() string helper are left untouched. */
function makeJar(initialSetCookies) {
  const store = {};
  const ingest = (list) => {
    for (const c of list || []) {
      const pair = String(c).split(';')[0];
      const i = pair.indexOf('=');
      if (i > 0) store[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
    }
  };
  ingest(initialSetCookies);
  return {
    header() { return Object.entries(store).map(([k, v]) => `${k}=${v}`).join('; '); },
    apply(res) { if (res && res.headers) ingest(getSetCookies(res.headers)); },
  };
}

function cookieJarFromSetCookies(setCookies) {
  // Reduce a Set-Cookie array down to a single "name=value; name=value"
  // string for the Cookie header on follow-up requests. Strip attributes.
  const pairs = [];
  for (const sc of setCookies) {
    const head = String(sc).split(';')[0];
    if (head) pairs.push(head.trim());
  }
  return pairs.join('; ');
}

async function postForm(path, fields, cookie) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null) body.append(k, String(v));
  }
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(BASE_URL + path, {
    method: 'POST',
    headers,
    body: body.toString(),
    redirect: 'manual'
  });
  let text = '';
  if (res.status >= 200 && res.status < 300) text = await res.text();
  return {
    status: res.status,
    location: res.headers.get('location'),
    setCookies: getSetCookies(res.headers),
    body: text
  };
}

async function jsonRequest(method, path, body, cookie) {
  const headers = { Accept: 'application/json' };
  let payload;
  if (body !== undefined && body !== null) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(BASE_URL + path, {
    method,
    headers,
    body: payload,
    redirect: 'manual'
  });
  let json = null;
  let text = '';
  try {
    text = await res.text();
    if (text) json = JSON.parse(text);
  } catch (_) { /* non-JSON body */ }
  return { status: res.status, json, text };
}

(async () => {
  let allOk = true;
  const expect = (label, cond, extra) => {
    if (!cond) {
      // eslint-disable-next-line no-console
      console.log('FAIL:', label, extra !== undefined ? extra : '');
      allOk = false;
    }
  };

  const { getSupabaseClient } = require('../config/supabase');
  const sb = getSupabaseClient();
  const createdIds = [];

  let adminCookie = '';
  let throwawayUserId = null;
  let nonAdminCookie = '';
  let nonAdminUserId = null;

  // One tracker for this probe run; results flow through the existing recorder.
  const sessions = createProbeSessionTracker({
    base: BASE_URL,
    record: (label, pass) => expect(label, pass),
  });

  /* Outer try: session termination is the OUTERMOST cleanup action, so the
     existing throwaway-row cleanup (inner finally) runs FIRST and session
     logout still happens even if that cleanup throws. */
  try {
  try {
    // -- 1. admin login -------------------------------------------------
    const r1 = await postForm('/login', {
      email: CREDS.admin.email,
      password: CREDS.admin.password
    });
    out('1. admin login', {
      status: r1.status,
      location: r1.location,
      has_set_cookie: r1.setCookies.length > 0
    });
    expect('1. admin login 302 /admin + Set-Cookie',
      r1.status === 302 && r1.location === '/admin' && r1.setCookies.length > 0);
    adminCookie = cookieJarFromSetCookies(r1.setCookies);
    if (r1.status === 302 && r1.setCookies.length > 0) {
      sessions.register('admin', makeJar(r1.setCookies), '/admin/users');
    }

    // -- 2. logged-out request to /admin/api/users -> 401 JSON ----------
    const r2 = await jsonRequest('POST', '/admin/api/users', {
      first_name: 'Anon',
      last_name: 'Outsider',
      email: PROBE_PREFIX + 'anon-' + runId + '@probe.invalid',
      password: 'probe-password',
      role: 'guest'
    }); // no cookie
    out('2. logged-out POST /admin/api/users', {
      status: r2.status,
      success: r2.json && r2.json.success,
      has_message: !!(r2.json && r2.json.message)
    });
    expect('2. unauthenticated returns JSON 401',
      r2.status === 401 && r2.json && r2.json.success === false);

    // -- 3. create throwaway user via /admin/api/users (admin cookie) ---
    const r3 = await jsonRequest('POST', '/admin/api/users', {
      first_name: 'Probe',
      last_name: 'Throwaway',
      email: throwawayEmail,
      password: 'probe-password-do-not-use',
      role: 'guest'
    }, adminCookie);
    out('3. create throwaway user', {
      status: r3.status,
      success: r3.json && r3.json.success,
      user_role: r3.json && r3.json.user ? r3.json.user.role : null,
      user_email: r3.json && r3.json.user ? r3.json.user.email : null,
      user_has_password_field: r3.json && r3.json.user
        ? Object.prototype.hasOwnProperty.call(r3.json.user, 'password')
        : null
    });
    expect('3. create returned 201 with success:true',
      r3.status === 201 && r3.json && r3.json.success === true);
    expect('3. created user has correct role/email',
      r3.json && r3.json.user
      && r3.json.user.role === 'guest'
      && r3.json.user.email === throwawayEmail);
    expect('3. response.user does NOT leak password column',
      r3.json && r3.json.user
      && !Object.prototype.hasOwnProperty.call(r3.json.user, 'password'));
    if (r3.json && r3.json.user && r3.json.user.id) {
      throwawayUserId = r3.json.user.id;
      createdIds.push(throwawayUserId);
    }

    // -- 4. duplicate-email create -> 409 -------------------------------
    const r4 = await jsonRequest('POST', '/admin/api/users', {
      first_name: 'Probe',
      last_name: 'Duplicate',
      email: dupAttemptEmail,
      password: 'probe-password',
      role: 'guest'
    }, adminCookie);
    out('4. duplicate-email create', {
      status: r4.status,
      success: r4.json && r4.json.success,
      has_message: !!(r4.json && r4.json.message)
    });
    expect('4. duplicate-email returns 409',
      r4.status === 409 && r4.json && r4.json.success === false);

    // Capture the password hash BEFORE the password-preserving update.
    // We compare hashes only as a boolean (preserved: true/false).
    let beforePasswordHash = null;
    if (throwawayUserId) {
      const { data: beforeRow, error: beforeErr } = await sb
        .from('users')
        .select('password,role,first_name,last_name,email')
        .eq('id', throwawayUserId)
        .maybeSingle();
      if (beforeErr) {
        expect('4b. fetch row before update', false, beforeErr.message);
      } else if (beforeRow) {
        beforePasswordHash = beforeRow.password;
        out('4b. row before update (redacted)', {
          role: beforeRow.role,
          first_name: beforeRow.first_name,
          last_name: beforeRow.last_name,
          email: beforeRow.email,
          has_password_hash: typeof beforeRow.password === 'string' && beforeRow.password.length > 0
        });
      }
    }

    // -- 5. update WITHOUT password -> 200 and password unchanged ------
    if (throwawayUserId) {
      const r5 = await jsonRequest('PUT', '/admin/api/users/' + throwawayUserId, {
        first_name: 'Probe2',
        last_name: 'Renamed',
        email: throwawayEmail,
        role: 'guest'
        // password intentionally omitted
      }, adminCookie);
      out('5. update without password', {
        status: r5.status,
        success: r5.json && r5.json.success,
        updated_first_name: r5.json && r5.json.user ? r5.json.user.first_name : null,
        user_has_password_field: r5.json && r5.json.user
          ? Object.prototype.hasOwnProperty.call(r5.json.user, 'password')
          : null
      });
      expect('5. update returned 200 + success:true',
        r5.status === 200 && r5.json && r5.json.success === true);
      expect('5. response reflects new first_name',
        r5.json && r5.json.user && r5.json.user.first_name === 'Probe2');
      expect('5. response.user does NOT leak password column',
        r5.json && r5.json.user
        && !Object.prototype.hasOwnProperty.call(r5.json.user, 'password'));

      // Verify password column unchanged by direct Supabase read.
      const { data: afterRow, error: afterErr } = await sb
        .from('users')
        .select('password,first_name')
        .eq('id', throwawayUserId)
        .maybeSingle();
      if (afterErr) {
        expect('5b. fetch row after update', false, afterErr.message);
      } else if (afterRow) {
        const preserved = beforePasswordHash !== null
          && typeof afterRow.password === 'string'
          && afterRow.password === beforePasswordHash;
        out('5b. password preserved on blank update', preserved);
        expect('5b. password column unchanged when password omitted', preserved);
      }
    }

    // -- 6. update WITH password -> hash changes -----------------------
    if (throwawayUserId) {
      const r6 = await jsonRequest('PUT', '/admin/api/users/' + throwawayUserId, {
        first_name: 'Probe3',
        last_name: 'Renamed',
        email: throwawayEmail,
        role: 'guest',
        password: 'new-probe-password-do-not-use'
      }, adminCookie);
      out('6. update with new password', {
        status: r6.status,
        success: r6.json && r6.json.success
      });
      expect('6. update-with-password returns 200',
        r6.status === 200 && r6.json && r6.json.success === true);

      const { data: row6 } = await sb
        .from('users')
        .select('password')
        .eq('id', throwawayUserId)
        .maybeSingle();
      const changed = !!(row6 && typeof row6.password === 'string'
        && row6.password.length > 0
        && row6.password !== beforePasswordHash);
      out('6b. password hash changed on explicit update', changed);
      expect('6b. password hash changes when password supplied', changed);
    }

    // -- 7. self-delete -> 403 ------------------------------------------
    // Look up the regression admin id from Supabase to target it (same
    // loader-sourced canonical email the login above used).
    const { data: adminRow } = await sb
      .from('users')
      .select('id')
      .eq('email', CREDS.admin.email)
      .maybeSingle();
    const adminId = adminRow ? adminRow.id : null;
    if (adminId) {
      const r7 = await jsonRequest('DELETE', '/admin/api/users/' + adminId, null, adminCookie);
      out('7. admin self-delete attempt', {
        status: r7.status,
        success: r7.json && r7.json.success,
        message_present: !!(r7.json && r7.json.message)
      });
      expect('7. self-delete returns 403',
        r7.status === 403 && r7.json && r7.json.success === false);
    } else {
      expect('7. could not locate admin row to test self-delete', false);
    }

    // -- 8. delete throwaway -> 200 -------------------------------------
    if (throwawayUserId) {
      const r8 = await jsonRequest('DELETE', '/admin/api/users/' + throwawayUserId, null, adminCookie);
      out('8. delete throwaway', { status: r8.status, success: r8.json && r8.json.success });
      expect('8. delete returns 200 + success:true',
        r8.status === 200 && r8.json && r8.json.success === true);

      const { data: gone } = await sb
        .from('users')
        .select('id')
        .eq('id', throwawayUserId);
      const reallyGone = Array.isArray(gone) && gone.length === 0;
      out('8b. throwaway row removed from supabase', reallyGone);
      expect('8b. row physically removed', reallyGone);
      if (reallyGone) {
        // Drop from cleanup list now that it is gone.
        const idx = createdIds.indexOf(throwawayUserId);
        if (idx >= 0) createdIds.splice(idx, 1);
      }
    }

    // -- 9. non-admin gets JSON 403 -------------------------------------
    // Register a throwaway guest via the public form (works in both modes,
    // and in supabase mode it already exercises the Section 2.6 path).
    const rNonAdminReg = await postForm('/register', {
      fullName: 'NonAdmin Probe',
      email: nonAdminEmail,
      password: 'probe-password',
      role: 'guest',
      address: 'probe non-admin address',
      phone: '09333333333'
    });
    out('9a. register throwaway guest', {
      status: rNonAdminReg.status,
      location: rNonAdminReg.location,
      has_set_cookie: rNonAdminReg.setCookies.length > 0
    });
    if (rNonAdminReg.status === 302
        && rNonAdminReg.location === '/dashboard'
        && rNonAdminReg.setCookies.length > 0) {
      nonAdminCookie = cookieJarFromSetCookies(rNonAdminReg.setCookies);
      const { data: naRow } = await sb
        .from('users')
        .select('id')
        .eq('email', nonAdminEmail)
        .maybeSingle();
      if (naRow) {
        nonAdminUserId = naRow.id;
        createdIds.push(nonAdminUserId);
      }
    } else {
      expect('9a. throwaway non-admin registration succeeded', false);
    }

    if (nonAdminCookie) {
      const r9 = await jsonRequest('POST', '/admin/api/users', {
        first_name: 'Attempt',
        last_name: 'NonAdmin',
        email: PROBE_PREFIX + 'attempt-' + runId + '@probe.invalid',
        password: 'probe-password',
        role: 'guest'
      }, nonAdminCookie);
      out('9b. non-admin POST /admin/api/users', {
        status: r9.status,
        success: r9.json && r9.json.success,
        message_present: !!(r9.json && r9.json.message)
      });
      expect('9b. non-admin returns JSON 403',
        r9.status === 403 && r9.json && r9.json.success === false);
    }

  } catch (e) {
    allOk = false;
    // eslint-disable-next-line no-console
    console.error('PROBE FAILED:', e && e.stack ? e.stack : e);
  } finally {
    // ---- Cleanup throwaway rows ---------------------------------------
    // eslint-disable-next-line no-console
    console.log('cleanup: deleting', createdIds.length, 'throwaway user id(s)');
    for (const id of createdIds) {
      const { error } = await sb.from('users').delete().eq('id', id);
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('cleanup warn id=' + id + ':', error.message);
      }
    }
    const { data: leftovers } = await sb
      .from('users')
      .select('id,email')
      .like('email', PROBE_PREFIX + '%@probe.invalid');
    out('10. leftover probe-2.10 rows', leftovers || 'err');
    if (Array.isArray(leftovers) && leftovers.length > 0) {
      expect('10. no leftover probe-2.10 rows', false, leftovers.length);
    }
  }

  } finally {
    await sessions.terminateAll();
  }

  // eslint-disable-next-line no-console
  console.log(allOk ? 'PROBE DONE: ALL_OK' : 'PROBE DONE: WITH_ISSUES');
  process.exit(allOk ? 0 : 1);
})().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('PROBE FAILED (top-level):', e && e.stack ? e.stack : e);
  process.exit(1);
});
