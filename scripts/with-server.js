'use strict';
/* Self-terminating dev-server harness (Windows-safe). Spawns server.js, waits until it
   answers, runs a probe, and ALWAYS kills the server before this process exits — so the
   agent command returns cleanly. For API/HTTP probes only; browser/visual checks use the
   agent runner's native background execution instead.

   Programmatic:
     const { withServer } = require('./scripts/with-server');
     await withServer({ mode: 'mysql', port: 3199 }, async (baseUrl) => { ... });
     // Optional sessionStore forces the child's SESSION_STORE (Milestone 9):
     await withServer({ mode: 'supabase', port: 3199, sessionStore: 'supabase' }, fn);
   CLI:
     node scripts/with-server.js <mode> <port> <probeModule> [sessionStore]
     (probeModule exports async (baseUrl) => {...}; throw to fail) */
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SOURCES = ['AUTH_DATA_SOURCE', 'CONTENT_DATA_SOURCE', 'BUILDING_DATA_SOURCE', 'ROUTE_DATA_SOURCE', 'VR_DATA_SOURCE', 'SCHEDULE_DATA_SOURCE'];

const VALID_SOURCE_VALUES = ['mysql', 'supabase'];

/* Session stores this harness may select for a LOCAL test child. 'memory' is the
   development-only store (config/sessionConfig.js rejects it in production); it
   is listed here because a database-free probe may legitimately ask for it. */
const VALID_SESSION_STORES = ['mysql', 'supabase', 'memory'];

function normalizeMode(mode) {
  const normalized = String(mode == null ? '' : mode).trim().toLowerCase();
  if (!VALID_SOURCE_VALUES.includes(normalized)) {
    throw new Error(`with-server: mode must be one of ${VALID_SOURCE_VALUES.join(' | ')}.`);
  }
  return normalized;
}

/* Resolve the child's EFFECTIVE session store.

   The ambient environment sets SESSION_STORE=supabase. Previously this harness
   only assigned env.SESSION_STORE when a caller passed `sessionStore`, so an
   omitted value let that ambient supabase store survive into a nominal MySQL
   data leg — nine authenticating probes were running MySQL data against the
   Supabase session store, persisting canonical sessions where the caller never
   intended them.

   Now: omitted => the store FOLLOWS THE NORMALIZED DATA MODE. An explicitly
   supplied value is normalized and validated; blank or unrecognized FAILS
   CLOSED rather than falling back to process.env. buildEnv always assigns
   env.SESSION_STORE, so ambient SESSION_STORE can never silently survive. */
function resolveSessionStore(sessionStore, normalizedMode) {
  if (sessionStore === undefined || sessionStore === null) return normalizedMode;
  const normalized = String(sessionStore).trim().toLowerCase();
  if (!VALID_SESSION_STORES.includes(normalized)) {
    throw new Error(`with-server: sessionStore must be one of ${VALID_SESSION_STORES.join(' | ')}.`);
  }
  return normalized;
}

/* BE.3: optional per-switch overrides so a probe can exercise MIXED data sources
   (e.g. BUILDING_DATA_SOURCE=mysql with ROUTE_DATA_SOURCE=supabase) — the exact
   configuration where backend-local numeric ids diverge.

   Validated, fail-closed: only the six known *_DATA_SOURCE keys may be overridden,
   and only to 'mysql' or 'supabase'. Anything else throws rather than silently
   shipping a bogus env to the child. Omitting it leaves every existing caller
   byte-for-byte unchanged. */
function validateSourceOverrides(sourceOverrides) {
  if (sourceOverrides === undefined || sourceOverrides === null) return null;
  if (typeof sourceOverrides !== 'object' || Array.isArray(sourceOverrides)) {
    throw new Error('with-server: sourceOverrides must be an object.');
  }
  const out = {};
  for (const [k, v] of Object.entries(sourceOverrides)) {
    if (!SOURCES.includes(k)) {
      throw new Error(`with-server: unknown sourceOverrides key "${k}". Allowed: ${SOURCES.join(', ')}.`);
    }
    const val = String(v).trim().toLowerCase();
    if (!VALID_SOURCE_VALUES.includes(val)) {
      throw new Error(`with-server: sourceOverrides.${k} must be one of ${VALID_SOURCE_VALUES.join(' | ')}.`);
    }
    out[k] = val;
  }
  return out;
}

function buildEnv(mode, port, sessionStore, sourceOverrides) {
  // Validate BEFORE constructing the child environment so an invalid mode or
  // store never reaches a spawned server.
  const normalizedMode = normalizeMode(mode);
  const effectiveSessionStore = resolveSessionStore(sessionStore, normalizedMode);

  const env = { ...process.env, PORT: String(port) }; // full inherited env; never cleared
  for (const k of SOURCES) env[k] = normalizedMode;
  // Per-switch overrides applied AFTER the uniform mode, so `mode` remains the
  // baseline and only the named switches diverge.
  const overrides = validateSourceOverrides(sourceOverrides);
  if (overrides) for (const [k, v] of Object.entries(overrides)) env[k] = v;
  // ALWAYS assigned (never conditional): ambient SESSION_STORE must not survive.
  env.SESSION_STORE = effectiveSessionStore;
  return env;
}

async function waitForReady(base, attempts = 60, delayMs = 400) {
  for (let i = 0; i < attempts; i++) {
    // `/auth` intentionally mints an anonymous CSRF-backed session. Readiness
    // must use the existing favicon route, which is mounted before
    // express-session, so a harness poll cannot persist identity-free rows.
    try { const r = await fetch(base + '/favicon.ico'); if (r.status === 200) return true; } catch (e) {}
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

async function withServer({ mode = 'mysql', port = 3199, sessionStore, sourceOverrides } = {}, probe) {
  const base = 'http://127.0.0.1:' + port;
  const server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: buildEnv(mode, port, sessionStore, sourceOverrides), stdio: 'ignore' });

  let killed = false;
  const kill = () => { if (killed) return; killed = true; try { server.kill('SIGTERM'); } catch (e) {} };
  const onSig = () => { kill(); process.exit(130); };
  process.once('exit', kill);
  process.once('SIGINT', onSig);
  process.once('SIGTERM', onSig);

  try {
    if (!(await waitForReady(base))) throw new Error('server did not become ready on ' + base);
    return await probe(base);
  } finally {
    kill();
    await new Promise((r) => setTimeout(r, 300)); // let the port release
  }
}

/* `buildEnv` is exported ONLY so database-free quality-gate checks can assert the
   environment-resolution contract (default-follows-mode, explicit override,
   fail-closed validation) against the real implementation instead of a copy. It
   is internal test surface, not a production API, and spawns nothing. */
module.exports = { withServer, buildEnv };

if (require.main === module) {
  const [, , mode = 'mysql', port = '3199', probeModule, sessionStore] = process.argv;
  if (!probeModule) { console.error('usage: node scripts/with-server.js <mode> <port> <probeModule> [sessionStore]'); process.exit(2); }
  const probe = require(path.resolve(probeModule));
  withServer({ mode, port: Number(port), sessionStore }, probe)
    .then(() => console.log('[with-server] done'))
    .catch((e) => { console.error('[with-server] FAIL:', e && e.message); process.exitCode = 1; });
}
