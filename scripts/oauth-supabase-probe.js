'use strict';

/* ========================================
   CampuSphere - OAuth complete-registration probe (Section 2.7)

   Exercises controllers/authController.completeRegistrationPost via a
   mocked req/res in AUTH_DATA_SOURCE=supabase mode. Real Google round-
   trip is not possible without live credentials, but this probe verifies
   the same controller code path (Supabase branch) used after a
   successful Google callback: pendingOAuthRegistration -> repository ->
   session hydration -> redirect.

   Safety:
     - Forces AUTH_DATA_SOURCE=supabase before requiring the controller.
     - Throwaway accounts use email prefix `probe-2.7-` and the
       @probe.invalid domain (cannot collide with real users or with
       Section 2.5 / 2.6 probes).
     - Cleans up every row it created in the finally block; reports any
       leftovers explicitly.
     - No password hashes, OAuth subjects, or service-role values are
       printed; OAuth subjects are reduced to a boolean flag.
   ======================================== */

process.env.AUTH_DATA_SOURCE = 'supabase';
require('dotenv').config();

const authController = require('../controllers/authController');
const { getSupabaseClient } = require('../config/supabase');
const { resolveAccountIdentityName } = require('../utils/accountIdentityName');

const PROBE_PREFIX = 'probe-2.7-';
const runId = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
const goodEmail = PROBE_PREFIX + 'oauth-' + runId + '@probe.invalid';
const oauthSubject = PROBE_PREFIX + 'sub-' + runId;
const noNameEmail = PROBE_PREFIX + 'noname-' + runId + '@probe.invalid';

function makeFakeReqRes(body, pending) {
  const req = {
    body,
    session: {
      pendingOAuthRegistration: pending,
      user: null,
      oauthState: null,
      oauthIntent: null,
      save(cb) { cb(); }
    },
    query: {}
  };
  const res = {
    statusCode: null,
    rendered: null,
    redirected: null,
    status(c) { this.statusCode = c; return this; },
    json(obj) { this.bodyJson = obj; return this; },
    render(view, args) { this.rendered = { view, args }; return this; },
    redirect(url) { this.redirected = url; return this; }
  };
  return { req, res };
}

function out(label, value) {
  // eslint-disable-next-line no-console
  console.log(label + ':', typeof value === 'string' ? value : JSON.stringify(value));
}

(async () => {
  let allOk = true;
  const fail = (label, extra) => {
    // eslint-disable-next-line no-console
    console.log('FAIL:', label, extra !== undefined ? extra : '');
    allOk = false;
  };

  const createdIds = [];
  const sb = getSupabaseClient();

  try {
    // ----- 1. Happy path: planted pending -> Supabase user + session hydration -----
    const pending = {
      email: goodEmail,
      role: 'guest',
      googleSub: oauthSubject,
      givenName: 'OAuth',
      familyName: 'Probe',
      fullName: 'OAuth Probe',
      picture: ''
    };
    const body = {
      fullName: 'OAuth Probe',
      address: 'OAuth probe address',
      phone: '09222222222'
    };
    const { req, res } = makeFakeReqRes(body, pending);
    await authController.completeRegistrationPost(req, res);

    out('1. redirected to', res.redirected || '(none)');
    if (res.redirected !== '/dashboard') fail('1. expected /dashboard redirect');

    if (!req.session.user) {
      fail('1. session.user not hydrated');
    } else {
      createdIds.push(req.session.user.id);
      out('1. session hydrated', {
        id: req.session.user.id,
        role: req.session.user.role,
        email: req.session.user.email,
        first_name: req.session.user.first_name,
        last_name: req.session.user.last_name,
        has_address: !!req.session.user.address,
        has_phone_number: !!req.session.user.phone_number,
        pending_deleted: req.session.pendingOAuthRegistration === undefined
      });
      if (req.session.user.role !== 'guest') fail('1. role mismatch');
      if (req.session.user.email !== goodEmail) fail('1. email mismatch');
      if (req.session.pendingOAuthRegistration !== undefined) fail('1. pendingOAuthRegistration not deleted');
      if (req.session.user.address !== 'OAuth probe address') fail('1. address not merged into session');
      if (req.session.user.phone_number !== '09222222222') fail('1. phone_number not merged into session');
    }

    // Verify the Supabase row carries oauth_provider='google' and a subject.
    if (req.session.user && req.session.user.id) {
      const { data: row, error: rowErr } = await sb
        .from('users')
        .select('id,email,role,oauth_provider,oauth_subject,password,first_name,last_name')
        .eq('id', req.session.user.id)
        .maybeSingle();
      if (rowErr || !row) {
        fail('1b. Supabase row not found', rowErr ? rowErr.message : null);
      } else {
        out('1b. supabase row (redacted)', {
          id: row.id,
          email: row.email,
          role: row.role,
          oauth_provider: row.oauth_provider,
          has_oauth_subject: !!row.oauth_subject,
          has_password_hash: typeof row.password === 'string' && row.password.length > 0,
          first_name: row.first_name,
          last_name: row.last_name
        });
        if (row.oauth_provider !== 'google') fail('1b. oauth_provider != google');
        if (!row.oauth_subject) fail('1b. oauth_subject not set');
        if (!row.password) fail('1b. password placeholder not set (column is NOT NULL)');
      }
    }

    // ----- 2. Name fallback path -----
    const pending2 = {
      email: noNameEmail,
      role: 'guest',
      googleSub: oauthSubject + '-noname',
      givenName: '',
      familyName: '',
      fullName: '',
      picture: ''
    };
    const body2 = { fullName: '', address: 'x', phone: 'y' };
    const fallbackIdentity = resolveAccountIdentityName({ email: noNameEmail });
    const r2 = makeFakeReqRes(body2, pending2);
    await authController.completeRegistrationPost(r2.req, r2.res);
    out('2. redirected to', r2.res.redirected || '(none)');
    if (r2.res.redirected !== '/dashboard' || !r2.req.session.user) {
      fail('2. expected email-prefix fallback registration and dashboard redirect');
    } else {
      createdIds.push(r2.req.session.user.id);
      if (r2.req.session.user.first_name !== fallbackIdentity.firstName ||
          r2.req.session.user.last_name !== fallbackIdentity.lastName) {
        fail('2. email-prefix fallback name was not normalized as expected');
      }
    }
    // Verify the fallback row carries the derived identity, not the submitted
    // (blank/tampered) form value.
    const { data: nameRows } = await sb
      .from('users')
      .select('id,email,first_name,last_name')
      .eq('email', noNameEmail);
    if (!nameRows || nameRows.length !== 1) {
      fail('2. expected one row for email-prefix fallback', nameRows ? nameRows.length : 0);
    } else {
      out('2. fallback identity (redacted)', {
        first_name: nameRows[0].first_name,
        last_name: nameRows[0].last_name
      });
      if (nameRows[0].first_name !== fallbackIdentity.firstName ||
          nameRows[0].last_name !== fallbackIdentity.lastName) {
        fail('2. stored fallback identity mismatch');
      }
    }

    // ----- 3. registration_expired path (no pending in session) -----
    const r3 = makeFakeReqRes({}, null);
    await authController.completeRegistrationPost(r3.req, r3.res);
    out('3. redirected to', r3.res.redirected || '(none)');
    if (r3.res.redirected !== '/auth?error=registration_expired') {
      fail('3. expected /auth?error=registration_expired');
    }

    // ----- 4. account_exists path (pending email collides with an existing row) -----
    // Use the seeded admin email; we expect the controller to short-circuit
    // with account_exists BEFORE attempting any insert, and to clear the
    // pending session.
    const r4 = makeFakeReqRes(
      { fullName: 'Will Collide', studentId: 'X' },
      { email: 'admin@cspc.edu.ph', role: 'student-cspc', googleSub: 'noop-' + runId,
        givenName: 'X', familyName: 'Y', fullName: 'Will Collide', picture: '' }
    );
    await authController.completeRegistrationPost(r4.req, r4.res);
    out('4. redirected to', r4.res.redirected || '(none)');
    out('4. pending cleared', r4.req.session.pendingOAuthRegistration === undefined);
    if (r4.res.redirected !== '/auth?error=account_exists') {
      fail('4. expected /auth?error=account_exists');
    }
    if (r4.req.session.pendingOAuthRegistration !== undefined) {
      fail('4. pending not cleared on duplicate');
    }

  } catch (e) {
    fail('top-level', e && e.message ? e.message : String(e));
  } finally {
    // Cleanup throwaways
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
    out('leftover probe-2.7 rows', leftovers || 'err');
    if (Array.isArray(leftovers) && leftovers.length > 0) fail('leftover rows present');
  }

  // eslint-disable-next-line no-console
  console.log(allOk ? 'PROBE DONE: ALL_OK' : 'PROBE DONE: WITH_ISSUES');
  process.exit(allOk ? 0 : 1);
})().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('PROBE FAILED:', e && e.stack ? e.stack : e);
  process.exit(1);
});
