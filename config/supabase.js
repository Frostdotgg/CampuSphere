'use strict';

/* ========================================
   CampuSphere - Supabase Server Client
   Milestone 1, Phase 4, Section 4.2.

   SERVER-ONLY. This module reads SUPABASE_URL and
   SUPABASE_SERVICE_ROLE_KEY from process.env to lazily
   create a Supabase client with elevated privileges.

   IMPORTANT
   ---------
   - This module must NEVER be required by anything that
     ships to the browser:
       - public/js/**
       - EJS templates under views/
       - anything attached to res.locals / app.locals /
         window / a script tag
     Server-side Express controllers/routes are the only
     allowed consumers (once the controller migration in
     Milestone 2+ begins).
   - SUPABASE_SERVICE_ROLE_KEY bypasses Row Level Security.
     Treat its value like a database root password.
   - Supabase Auth is NOT used. CampuSphere keeps Express
     session auth and the existing Google OAuth flow
     (controllers/authController.js). This client exists
     so future server-side code paths can query Supabase
     tables once the runtime migration begins.
   - Importing this module is SAFE even when the env vars
     are missing or @supabase/supabase-js is not yet
     installed: hasSupabaseConfig() returns false, the
     client is only created on the first getSupabaseClient()
     call, and require() of @supabase/supabase-js is also
     deferred until that point. Until controllers opt in,
     config/db.js (MySQL) remains the runtime source of
     truth.
   ======================================== */

// quiet: suppress dotenv's injected-env/tip log line. Milestone 9 Section 9.4
// wires this module into the server startup require graph (Supabase session
// store), so without this the startup output would gain a noise line. Values
// are never printed.
require('dotenv').config({ quiet: true });

const SUPABASE_URL_ENV = 'SUPABASE_URL';
const SUPABASE_SERVICE_KEY_ENV = 'SUPABASE_SERVICE_ROLE_KEY';

let cachedClient = null;

function readEnvString(name) {
  const v = process.env[name];
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

/**
 * True iff both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
 * present and non-empty in process.env. Cheap; safe to call from
 * any server-side code path.
 */
function hasSupabaseConfig() {
  return (
    readEnvString(SUPABASE_URL_ENV) !== null &&
    readEnvString(SUPABASE_SERVICE_KEY_ENV) !== null
  );
}

/**
 * Lazily create and return a process-singleton Supabase client
 * using the service role key. The client is created on first
 * call; subsequent calls return the cached instance.
 *
 * Throws an Error if required env vars are missing. Callers that
 * want to branch on availability should check hasSupabaseConfig()
 * first and fall back to MySQL via config/db.js.
 *
 * Returns a SupabaseClient instance from @supabase/supabase-js.
 */
function getSupabaseClient() {
  if (cachedClient) return cachedClient;

  const url = readEnvString(SUPABASE_URL_ENV);
  const key = readEnvString(SUPABASE_SERVICE_KEY_ENV);
  if (!url || !key) {
    throw new Error(
      'Supabase client is not configured. Set ' +
        SUPABASE_URL_ENV + ' and ' + SUPABASE_SERVICE_KEY_ENV +
        ' in the server environment before calling getSupabaseClient(). ' +
        'See README.md > Supabase (planned, later phases).'
    );
  }

  // Deferred require: the package may be absent on a partial install
  // and the rest of the app must still boot. Only the caller that
  // actually needs Supabase pays the require cost.
  const { createClient } = require('@supabase/supabase-js');

  cachedClient = createClient(url, key, {
    auth: {
      // Server-only context using the service role key directly. There
      // is no end-user identity bound to this client, so do not persist
      // sessions, auto-refresh tokens, or scan URLs for auth callbacks.
      // CampuSphere keeps Express session auth as the user identity
      // mechanism; see README.md > Supabase (planned, later phases).
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        'X-Client-Info': 'campusphere-server'
      }
    }
  });

  return cachedClient;
}

/**
 * Test-only hook to drop the cached client so a fresh
 * getSupabaseClient() call re-reads process.env. Not used by
 * runtime code; kept here to avoid having to reach into module
 * internals from a test harness later.
 */
function _resetSupabaseClientForTests() {
  cachedClient = null;
}

module.exports = {
  hasSupabaseConfig,
  getSupabaseClient,
  _resetSupabaseClientForTests
};
