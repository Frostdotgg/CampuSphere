#!/usr/bin/env node
'use strict';

/* ========================================
   CampuSphere - Supabase Connectivity Smoke Check
   Milestone 1, Phase 4, Section 4.3.

   What this is
   ------------
   A read-only command-line script that confirms the server can reach
   the configured Supabase project and query a known seeded table.

   Behavior
   --------
   - If SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing/empty:
     * SKIP (exit 0) in MySQL-only / local fallback mode; the app and the
       MySQL runtime are unaffected.
     * FAIL (exit 1) when a Supabase session or schedule runtime is selected;
       the chosen runtime cannot work without Supabase env.
   - If both are present: issues a read-only query
     (system_settings.select('setting_key').limit(1)) and prints PASS or
     FAIL with a safe error message. A selected Supabase session runtime also
     checks app_sessions (0011); a selected Supabase schedule runtime checks
     room_schedule_documents and vr_hotspots.schedule_document_id (0020).

   What this is NOT
   ----------------
   - NOT a write/mutation test. No INSERT/UPDATE/DELETE/UPSERT/DDL.
   - NOT a server. It runs once and exits.
   - NOT a substitute for the Phase 6 verification queries documented
     in database/supabase/SEED_VERIFICATION.md.

   Usage
   -----
     node scripts/supabase-smoke.js

   Safety
   ------
   - Uses the existing config/supabase.js (server-only client). It
     never logs or returns the service role key.
   - Does not expose Supabase config to EJS, public JS, browser globals,
     res.locals, or app.locals; this script never touches an Express
     server or template engine.
   - Run against a development / disposable Supabase project first.
   ======================================== */

const path = require('path');
const supabase = require(path.join(__dirname, '..', 'config', 'supabase'));

const TABLE = 'system_settings';
const COLUMN = 'setting_key';

// Sets process.exitCode and returns. We deliberately do NOT call
// process.exit(): forcing exit on Windows/Node 24 while the Supabase
// client / undici pool still has a pending close trips a libuv
// `UV_HANDLE_CLOSING` assertion (src\win\async.c) and the script ends
// with exit code 1 even on a successful PASS. Setting exitCode lets
// the event loop drain naturally; the process exits cleanly with the
// requested code once outstanding handles close themselves.
function fail(message, detail) {
  console.error('[supabase-smoke] FAIL: ' + message);
  if (detail) console.error('[supabase-smoke]        ' + detail);
  process.exitCode = 1;
}

function pass(message) {
  console.log('[supabase-smoke] PASS: ' + message);
  process.exitCode = 0;
}

function skip(message) {
  console.log('[supabase-smoke] SKIP: ' + message);
  process.exitCode = 0;
}

(async function main() {
  // A selected Supabase runtime makes its server-only env mandatory: skip
  // becomes fail. Keep the flags separate so only relevant schema probes run.
  const sessionSupabaseRequired =
    String(process.env.SESSION_STORE || '').trim().toLowerCase() === 'supabase';
  const scheduleSupabaseRequired =
    String(process.env.SCHEDULE_DATA_SOURCE || '').trim().toLowerCase() === 'supabase';
  const supabaseRequired = sessionSupabaseRequired || scheduleSupabaseRequired;
  if (!supabase.hasSupabaseConfig()) {
    if (supabaseRequired) {
      fail(
        'A Supabase session/schedule runtime is selected but SUPABASE_URL and/or ' +
        'SUPABASE_SERVICE_ROLE_KEY are not set. The selected runtime ' +
        'cannot initialize without them.'
      );
      return;
    }
    skip(
      'SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY are not set. ' +
      'The current MySQL runtime is unaffected. To enable this smoke ' +
      'check, set both variables in an untracked local .env (see ' +
      '.env.example and README.md > Supabase).'
    );
    return;
  }

  let client;
  try {
    client = supabase.getSupabaseClient();
  } catch (err) {
    // Defensive: hasSupabaseConfig() returned true but client construction
    // still failed (e.g. @supabase/supabase-js not installed). Report the
    // failure without leaking environment values.
    fail('Could not construct Supabase client.', safeMessage(err));
    return;
  }

  try {
    const { data, error } = await client
      .from(TABLE)
      .select(COLUMN)
      .limit(1);

    if (error) {
      fail(
        'Read query against "' + TABLE + '" failed.',
        safeMessage(error)
      );
      return;
    }

    // When Supabase is the selected session store, also confirm the session
    // table (migration 0011) is reachable so a missing migration is caught.
    if (sessionSupabaseRequired) {
      const { error: sessErr } = await client.from('app_sessions').select('sid').limit(1);
      if (sessErr) {
        fail(
          'Read query against "app_sessions" failed (SESSION_STORE=supabase; migration 0011 may not be applied).',
          safeMessage(sessErr)
        );
        return;
      }
    }

    // Migration 0020 is a separately applied operational boundary. In the
    // selected schedule mode, prove both new read surfaces without mutation.
    if (scheduleSupabaseRequired) {
      const { error: documentErr } = await client
        .from('room_schedule_documents')
        .select('id')
        .limit(1);
      if (documentErr) {
        fail(
          'Read query against "room_schedule_documents" failed ' +
          '(SCHEDULE_DATA_SOURCE=supabase; migration 0020 may not be applied).',
          safeMessage(documentErr)
        );
        return;
      }

      const { error: hotspotErr } = await client
        .from('vr_hotspots')
        .select('schedule_document_id')
        .limit(1);
      if (hotspotErr) {
        fail(
          'Read query for "vr_hotspots.schedule_document_id" failed ' +
          '(SCHEDULE_DATA_SOURCE=supabase; migration 0020 may not be applied).',
          safeMessage(hotspotErr)
        );
        return;
      }
    }

    const rowCount = Array.isArray(data) ? data.length : 0;
    pass(
      'Read query against "' + TABLE + '" returned ' + rowCount +
      ' row(s). Connectivity and read access verified.' +
      (sessionSupabaseRequired ? ' app_sessions (0011) reachable.' : '') +
      (scheduleSupabaseRequired
        ? ' room_schedule_documents and vr_hotspots.schedule_document_id (0020) reachable.'
        : '')
    );
  } catch (err) {
    fail('Unexpected error during smoke query.', safeMessage(err));
  }
})();

/**
 * Strip anything that could resemble the service role key or full URL
 * out of an error message before logging. We only log the message and
 * an optional Supabase error code; never the stack (stacks can include
 * resolved URLs / headers in some clients).
 */
function safeMessage(err) {
  if (!err) return '';
  const code = err.code ? '[' + String(err.code) + '] ' : '';
  let msg = '';
  if (typeof err === 'string') msg = err;
  else if (err.message) msg = String(err.message);
  else msg = 'Unknown error.';

  // Redact anything that looks like a JWT (service role keys are JWTs).
  msg = msg.replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[REDACTED_JWT]');
  // Redact any full Supabase URL.
  msg = msg.replace(/https?:\/\/[A-Za-z0-9-]+\.supabase\.co[^\s]*/g, '[REDACTED_SUPABASE_URL]');

  return code + msg;
}
