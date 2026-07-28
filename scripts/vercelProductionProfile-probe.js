'use strict';

/* ========================================
   CampuSphere — M12.P1-R2 Vercel production-profile probe (corrective pass)

   Database-free, network-free, self-terminating. Verifies the PURE
   fail-closed preflight (config/vercelProductionProfile.js), the corrected
   server.js ordering (preflight against the PLATFORM env BEFORE dotenv,
   both before every side-effectful project import), the strict two-family
   server-key contract, the non-Vercel fallback getters, and two invalid
   VERCEL=1 server spawns that must refuse before dotenv could backfill.

   It deliberately does NOT spawn a VALID Vercel server: that would enter
   live session-store initialization, which belongs to M12.P1-R3.

   Output contract: fixed PASS/FAIL labels only. Canary values (including
   locally generated test-only JWT-shaped canaries with explicit roles) are
   asserted absent from every thrown message and captured child output; no
   canary, env value, URL, key, or decoded claim is ever printed.
   ======================================== */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  assertVercelProductionProfile,
  VercelProductionProfileError,
  VERCEL_PROFILE_ERROR_MESSAGE,
} = require('../config/vercelProductionProfile');

const ROOT = path.join(__dirname, '..');
const FIXED_REFUSAL = '[startup] Vercel production profile is invalid or incomplete. Refusing to start.';

const runId = Math.random().toString(36).slice(2, 10);

// Locally generated TEST-ONLY JWT-shaped canaries (never real keys). The
// encoder produces genuine base64url segments so shape validation is real.
function b64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
function makeJwt(header, payload) {
  return `${b64url(header)}.${b64url(payload)}.sig${runId}`;
}

const CANARY_HOST = `r2-canary-${runId}.supabase.co`;
const CANARY_URL = `https://${CANARY_HOST}`;
const CANARY_KEY_OPAQUE = `sb_secret_r2canary${runId}${runId}`; // >= 20 chars after prefix
const CANARY_KEY_JWT_SERVICE = makeJwt({ alg: 'HS256', typ: 'JWT' }, { role: 'service_role', ref: `r2c${runId}` });
const CANARY_KEY_JWT_ANON = makeJwt({ alg: 'HS256', typ: 'JWT' }, { role: 'anon', ref: `r2c${runId}` });

/* M12.P1-R4 shared rate-limit canaries (test-only; never real credentials). */
const CANARY_UPSTASH_HOST = `r4-canary-${runId}.upstash.io`;
const CANARY_UPSTASH_URL = `https://${CANARY_UPSTASH_HOST}`;
const CANARY_UPSTASH_TOKEN = `r4token${runId}${runId}${runId}`;
const CANARY_RATE_LIMIT_SECRET = `r4secret${runId}${runId}${runId}${runId}`; // >= 32 chars

const CANARIES = [
  CANARY_HOST, CANARY_URL, CANARY_KEY_OPAQUE, CANARY_KEY_JWT_SERVICE, CANARY_KEY_JWT_ANON,
  CANARY_UPSTASH_HOST, CANARY_UPSTASH_URL, CANARY_UPSTASH_TOKEN, CANARY_RATE_LIMIT_SECRET,
];

const failures = [];
let checks = 0;
function check(scope, label, ok) {
  checks += 1;
  const pass = ok === true;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!pass) failures.push(`${scope} :: ${label}`);
}

function hasCanary(text) {
  return CANARIES.some((c) => String(text || '').includes(c));
}

function validEnv(overrides) {
  const env = {
    VERCEL: '1',
    NODE_ENV: 'production',
    SESSION_STORE: 'supabase',
    AUTH_DATA_SOURCE: 'supabase',
    CONTENT_DATA_SOURCE: 'supabase',
    BUILDING_DATA_SOURCE: 'supabase',
    ROUTE_DATA_SOURCE: 'supabase',
    VR_DATA_SOURCE: 'supabase',
    SCHEDULE_DATA_SOURCE: 'supabase',
    MAP_RENDERER: 'maplibre',
    SUPABASE_URL: CANARY_URL,
    SUPABASE_SERVICE_ROLE_KEY: CANARY_KEY_OPAQUE,
    // M12.P1-R4: the shared rate-limit store is part of the valid Vercel matrix.
    UPSTASH_REDIS_REST_URL: CANARY_UPSTASH_URL,
    UPSTASH_REDIS_REST_TOKEN: CANARY_UPSTASH_TOKEN,
    RATE_LIMIT_KEY_SECRET: CANARY_RATE_LIMIT_SECRET,
  };
  for (const [k, v] of Object.entries(overrides || {})) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
  return env;
}

// Run one case; returns sanitized booleans without printing any value.
function attempt(env) {
  try {
    const result = assertVercelProductionProfile(env);
    return { threw: false, result };
  } catch (e) {
    return {
      threw: true,
      isTypedError: e instanceof VercelProductionProfileError,
      messageIsFixed: e.message === VERCEL_PROFILE_ERROR_MESSAGE,
      messageLeaks: hasCanary(e.message),
    };
  }
}

function expectRejected(scope, label, env) {
  const r = attempt(env);
  check(scope, `${label} -> fixed sanitized rejection`,
    r.threw === true && r.isTypedError === true && r.messageIsFixed === true && r.messageLeaks === false);
}

function expectKeyRejected(label, key) {
  expectRejected('key', label, validEnv({ SUPABASE_SERVICE_ROLE_KEY: key }));
}

/* ---------------- 1. valid matrix + accepted key families ---------------- */
console.log('=== CampuSphere M12.P1-R2 Vercel production-profile probe (database-free) ===');

{
  const r = attempt(validEnv());
  check('valid', 'complete Vercel matrix with an sb_secret_ opaque key passes', r.threw === false && r.result === true);
  const rJwt = attempt(validEnv({ SUPABASE_SERVICE_ROLE_KEY: CANARY_KEY_JWT_SERVICE }));
  check('valid', 'complete Vercel matrix with an HS256 role=service_role JWT passes', rJwt.threw === false && rJwt.result === true);
  check('valid', 'fixed error message constant carries no canary', !hasCanary(VERCEL_PROFILE_ERROR_MESSAGE));
}

/* ---------------- 2. every required variable independently ---------------- */
const EXACT_VARS = [
  ['NODE_ENV', 'Production', 'development'],
  ['SESSION_STORE', 'Supabase', 'mysql'],
  ['AUTH_DATA_SOURCE', 'supabase ', 'mysql'],
  ['CONTENT_DATA_SOURCE', ' supabase', 'mysql'],
  ['BUILDING_DATA_SOURCE', 'Supabase', 'mysql'],
  ['ROUTE_DATA_SOURCE', 'supabse', 'mysql'],
  ['VR_DATA_SOURCE', 'SUPABASE', 'mysql'],
  ['SCHEDULE_DATA_SOURCE', 'supabases', 'mysql'],
  ['MAP_RENDERER', 'Maplibre', 'leaflet'],
];
for (const [name, misspelled, conflicting] of EXACT_VARS) {
  expectRejected('matrix', `${name} missing`, validEnv({ [name]: undefined }));
  expectRejected('matrix', `${name} blank`, validEnv({ [name]: '   ' }));
  expectRejected('matrix', `${name} misspelled/cased variant`, validEnv({ [name]: misspelled }));
  expectRejected('matrix', `${name} conflicting valid-elsewhere value`, validEnv({ [name]: conflicting }));
}
expectRejected('matrix', 'SUPABASE_URL missing', validEnv({ SUPABASE_URL: undefined }));
expectRejected('matrix', 'SUPABASE_URL blank', validEnv({ SUPABASE_URL: '   ' }));
expectRejected('matrix', 'SUPABASE_SERVICE_ROLE_KEY missing', validEnv({ SUPABASE_SERVICE_ROLE_KEY: undefined }));
expectRejected('matrix', 'SUPABASE_SERVICE_ROLE_KEY blank', validEnv({ SUPABASE_SERVICE_ROLE_KEY: '   ' }));

/* ---------------- 3. URL shape cases ---------------- */
expectRejected('url', 'non-HTTPS URL', validEnv({ SUPABASE_URL: `http://${CANARY_HOST}` }));
expectRejected('url', 'malformed URL', validEnv({ SUPABASE_URL: 'not a url at all' }));
expectRejected('url', 'URL without a hostname', validEnv({ SUPABASE_URL: 'https://' }));
expectRejected('url', 'URL with embedded username/password', validEnv({ SUPABASE_URL: `https://user:secret${runId}@${CANARY_HOST}` }));
expectRejected('url', 'URL with embedded username only', validEnv({ SUPABASE_URL: `https://user@${CANARY_HOST}` }));

/* ---------------- 4. key shape contract ---------------- */
// Rejected generic/placeholder/browser shapes.
expectKeyRejected('one-character string', 'x');
expectKeyRejected('generic nonblank string', `just-a-random-string-${runId}`);
expectKeyRejected('documented service-role placeholder', 'replace-with-server-only-service-role-key');
expectKeyRejected('documented anon placeholder', 'replace-with-anon-key');
expectKeyRejected('sb_publishable_ browser key', `sb_publishable_${runId}${runId}${runId}`);
expectKeyRejected('SB_PUBLISHABLE_ browser key (uppercased)', `SB_PUBLISHABLE_${runId}${runId}${runId}`);
expectKeyRejected('sb_anon_ browser key', `sb_anon_${runId}${runId}${runId}`);
expectKeyRejected('SB_ANON_ browser key (uppercased)', `SB_ANON_${runId}${runId}${runId}`);
// Rejected opaque-family near-misses.
expectKeyRejected('bare sb_secret_ prefix with nothing after it', 'sb_secret_');
expectKeyRejected('sb_secret_ shorter than 20 opaque characters', 'sb_secret_short');
expectKeyRejected('sb_secret_ with a disallowed character', `sb_secret_${runId}${runId}$bad`);
// Rejected JWT-family near-misses (all locally generated; roles explicit).
expectKeyRejected('JWT with role anon', CANARY_KEY_JWT_ANON);
expectKeyRejected('JWT with role authenticated', makeJwt({ alg: 'HS256' }, { role: 'authenticated', ref: runId }));
expectKeyRejected('JWT with role missing', makeJwt({ alg: 'HS256' }, { ref: runId }));
expectKeyRejected('JWT with a non-string role', makeJwt({ alg: 'HS256' }, { role: 123, ref: runId }));
expectKeyRejected('JWT with role service_role but alg RS256', makeJwt({ alg: 'RS256' }, { role: 'service_role', ref: runId }));
expectKeyRejected('JWT with lowercased alg hs256', makeJwt({ alg: 'hs256' }, { role: 'service_role', ref: runId }));
expectKeyRejected('JWT with alg missing', makeJwt({ typ: 'JWT' }, { role: 'service_role', ref: runId }));
expectKeyRejected('two-segment JWT', `${b64url({ alg: 'HS256' })}.${b64url({ role: 'service_role' })}`);
expectKeyRejected('four-segment JWT', `${CANARY_KEY_JWT_SERVICE}.extra${runId}`);
expectKeyRejected('JWT with invalid base64url charset in header', `!!bad%%.${b64url({ role: 'service_role' })}.sig${runId}`);
expectKeyRejected('JWT with valid base64url but non-JSON header',
  `${Buffer.from('not-json-at-all').toString('base64url')}.${b64url({ role: 'service_role' })}.sig${runId}`);
expectKeyRejected('JWT whose header is a JSON array', `${b64url(['HS256'])}.${b64url({ role: 'service_role' })}.sig${runId}`);
expectKeyRejected('JWT whose payload is a JSON array', `${b64url({ alg: 'HS256' })}.${b64url(['service_role'])}.sig${runId}`);
expectKeyRejected('JWT with an empty signature segment', `${b64url({ alg: 'HS256' })}.${b64url({ role: 'service_role' })}.`);

/* -------- 4b. M12.P1-R4 shared rate-limit variables (Vercel-only) --------
   Same fixed sanitized refusal as every other case: which of the three is
   wrong is never disclosed, and no supplied value is echoed. */
{
  const R4_VARS = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'RATE_LIMIT_KEY_SECRET'];
  for (const name of R4_VARS) {
    expectRejected('r4', `${name} missing`, validEnv({ [name]: undefined }));
    expectRejected('r4', `${name} blank`, validEnv({ [name]: '   ' }));
  }

  // Shared-store URL: the same server-only HTTPS contract as SUPABASE_URL.
  expectRejected('r4', 'UPSTASH_REDIS_REST_URL non-HTTPS', validEnv({ UPSTASH_REDIS_REST_URL: `http://${CANARY_UPSTASH_HOST}` }));
  expectRejected('r4', 'UPSTASH_REDIS_REST_URL malformed', validEnv({ UPSTASH_REDIS_REST_URL: 'not a url at all' }));
  expectRejected('r4', 'UPSTASH_REDIS_REST_URL without a hostname', validEnv({ UPSTASH_REDIS_REST_URL: 'https://' }));
  expectRejected('r4', 'UPSTASH_REDIS_REST_URL with embedded username/password',
    validEnv({ UPSTASH_REDIS_REST_URL: `https://user:secret${runId}@${CANARY_UPSTASH_HOST}` }));
  expectRejected('r4', 'UPSTASH_REDIS_REST_URL with embedded username only',
    validEnv({ UPSTASH_REDIS_REST_URL: `https://user@${CANARY_UPSTASH_HOST}` }));

  // Shared-store token: nonblank and never a documented placeholder.
  expectRejected('r4', 'UPSTASH_REDIS_REST_TOKEN documented placeholder',
    validEnv({ UPSTASH_REDIS_REST_TOKEN: 'replace-with-upstash-rest-token' }));
  expectRejected('r4', 'UPSTASH_REDIS_REST_TOKEN documented placeholder (uppercased)',
    validEnv({ UPSTASH_REDIS_REST_TOKEN: 'REPLACE-WITH-UPSTASH-REST-TOKEN' }));
  expectRejected('r4', 'UPSTASH_REDIS_REST_TOKEN server-only placeholder variant',
    validEnv({ UPSTASH_REDIS_REST_TOKEN: 'replace-with-server-only-upstash-rest-token' }));

  // Bucket-key HMAC secret: >= 32 characters after trimming; never a placeholder.
  expectRejected('r4', 'RATE_LIMIT_KEY_SECRET one character', validEnv({ RATE_LIMIT_KEY_SECRET: 'x' }));
  expectRejected('r4', 'RATE_LIMIT_KEY_SECRET 31 characters', validEnv({ RATE_LIMIT_KEY_SECRET: 'a'.repeat(31) }));
  expectRejected('r4', 'RATE_LIMIT_KEY_SECRET 31 characters padded with spaces',
    validEnv({ RATE_LIMIT_KEY_SECRET: '  ' + 'a'.repeat(31) + '  ' }));
  expectRejected('r4', 'RATE_LIMIT_KEY_SECRET documented placeholder',
    validEnv({ RATE_LIMIT_KEY_SECRET: 'replace-with-a-long-random-server-only-rate-limit-key-secret' }));
  {
    const r = attempt(validEnv({ RATE_LIMIT_KEY_SECRET: 'a'.repeat(32) }));
    check('r4', 'RATE_LIMIT_KEY_SECRET of exactly 32 characters is accepted', r.threw === false && r.result === true);
    const rMin = attempt(validEnv({ RATE_LIMIT_KEY_SECRET: 'b'.repeat(64) }));
    check('r4', 'a longer RATE_LIMIT_KEY_SECRET is accepted', rMin.threw === false && rMin.result === true);
  }

  // The three are Vercel-only: they must never be required off Vercel.
  for (const name of R4_VARS) {
    const env = validEnv({ [name]: undefined });
    delete env.VERCEL;
    const r = attempt(env);
    check('r4', `non-Vercel does not require ${name}`, r.threw === false && r.result === false);
  }

  // Purity: the preflight still performs no network call or client construction.
  {
    const src = fs.readFileSync(path.join(ROOT, 'config', 'vercelProductionProfile.js'), 'utf8');
    check('r4', 'the R4 additions keep the preflight import-free and pure', !/\brequire\s*\(/.test(src));
    check('r4', 'the R4 additions introduce no network call or Redis client',
      !/fetch\s*\(|https?\.request|new Redis|@upstash\/redis/.test(src));
  }
}

/* ---------------- 5. non-Vercel bypass ---------------- */
{
  const broken = {
    NODE_ENV: 'development', SESSION_STORE: 'mysql', MAP_RENDERER: 'leaflet',
    SUPABASE_URL: 'not a url', SUPABASE_SERVICE_ROLE_KEY: 'x',
  };
  for (const [label, vercel] of [['unset', undefined], ['blank', ''], ['zero', '0'], ['word', 'true']]) {
    const env = { ...broken };
    if (vercel !== undefined) env.VERCEL = vercel;
    const r = attempt(env);
    check('bypass', `VERCEL ${label} -> returns false without validating`, r.threw === false && r.result === false);
  }
  const rGarbage = attempt(null);
  check('bypass', 'non-object env fails safe to non-Vercel (returns false)', rGarbage.threw === false && rGarbage.result === false);
}

/* ---------------- 6. non-Vercel getters keep their fallbacks ---------------- */
{
  const env = { ...process.env };
  for (const k of ['VERCEL', 'AUTH_DATA_SOURCE', 'CONTENT_DATA_SOURCE', 'BUILDING_DATA_SOURCE',
    'ROUTE_DATA_SOURCE', 'VR_DATA_SOURCE', 'SCHEDULE_DATA_SOURCE', 'MAP_RENDERER']) delete env[k];
  const code =
    "const a=require('./config/authDataSource').getAuthDataSource();" +
    "const c=require('./config/contentDataSource').getContentDataSource();" +
    "const v=require('./config/vrDataSource').getVrDataSource();" +
    "const s=require('./config/scheduleDataSource').getScheduleDataSource();" +
    "const m=require('./config/mapRuntime');" +
    "console.log(JSON.stringify({a,c,v,s,b:m.getBuildingDataSource(),r:m.getRouteDataSource(),map:m.getMapRenderer()}));";
  const r = spawnSync(process.execPath, ['-e', code], { cwd: ROOT, env, encoding: 'utf8', timeout: 30000 });
  let parsed = null;
  try { parsed = JSON.parse(String(r.stdout || '').trim().split(/\r?\n/).pop()); } catch (_) { /* fails below */ }
  check('fallback', 'non-Vercel getters resolve mysql/mysql/mysql/mysql/mysql/mysql/leaflet defaults',
    r.status === 0 && !!parsed &&
    parsed.a === 'mysql' && parsed.c === 'mysql' && parsed.v === 'mysql' && parsed.s === 'mysql' &&
    parsed.b === 'mysql' && parsed.r === 'mysql' && parsed.map === 'leaflet');
}

/* ---------------- 7. static server.js wiring order (corrected) ---------------- */
{
  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const iPreflightImport = src.indexOf("require('./config/vercelProductionProfile')");
  const iPreflightCall = src.indexOf('assertVercelProductionProfile(process.env)');
  const iDotenv = src.indexOf("require('dotenv').config");
  const iDotenvQuiet = src.indexOf("require('dotenv').config({ quiet: true })");
  const iRefusal = src.indexOf(FIXED_REFUSAL);
  const projectImports = [
    "require('./config/authDataSource')",
    "require('./config/mapRuntime')",
    "require('./utils/safeJson')",
    "require('./middleware/logger')",
    "require('./middleware/roleAuth')",
    "require('./config/db')",
    "require('./config/sessionConfig')",
    "require('./services/mysqlSessionStore')",
    "require('./services/supabaseSessionStore')",
    "require('./routes/index')",
    "require('./controllers/profileController')",
  ];
  const indexes = projectImports.map((s) => src.indexOf(s));
  check('wiring', 'preflight import + process.env call PRECEDE the dotenv load (no .env backfill window)',
    iPreflightImport !== -1 && iPreflightCall !== -1 && iDotenv !== -1 &&
    iPreflightImport < iPreflightCall && iPreflightCall < iDotenv);
  check('wiring', 'dotenv still loads quietly after the preflight', iDotenvQuiet === iDotenv);
  check('wiring', 'preflight and dotenv both precede every backend/session/middleware/controller/route import',
    indexes.every((i) => i !== -1 && iDotenv < i && iPreflightCall < i));
  check('wiring', 'server.js carries the fixed refusal message and a nonzero exit before those imports',
    iRefusal !== -1 && iRefusal < Math.min(...indexes) && /process\.exit\(1\);/.test(src.slice(iPreflightCall, Math.min(...indexes))));
}

/* ---------------- 8. invalid VERCEL=1 spawns (refusal before dotenv) ---------------- */
function spawnServer(envOverrides) {
  const env = { ...process.env, ...envOverrides, PORT: '3999' };
  const r = spawnSync(process.execPath, ['server.js'], {
    cwd: ROOT, env, encoding: 'utf8', timeout: 20000,
  });
  return { r, out: String(r.stdout || '') + String(r.stderr || '') };
}

{
  // 8a. One invalid value (NODE_ENV) with everything else valid.
  const { r, out } = spawnServer(validEnv({ NODE_ENV: 'development' }));
  check('spawn', 'invalid Vercel server exits promptly and nonzero (no timeout kill)',
    r.status !== null && r.status !== 0 && r.signal === null);
  check('spawn', 'refusal output is exactly the fixed sanitized message',
    out.includes(FIXED_REFUSAL) && !hasCanary(out));
  check('spawn', 'no server-started banner or listener output appears',
    !out.includes('CampuSphere server running') && !out.includes('[session] store='));
}

{
  // 8b. Regression: the platform env is missing SUPABASE_URL while the
  // repository .env (cwd=ROOT) COULD supply one. The corrected ordering must
  // reject the PLATFORM env before dotenv can backfill the gap.
  const env = validEnv({ SUPABASE_URL: undefined });
  const { r, out } = spawnServer({ ...env, SUPABASE_URL: '' });
  // Also cover the fully-deleted case (inherited value removed).
  const envDeleted = { ...process.env, ...validEnv(), PORT: '3999' };
  delete envDeleted.SUPABASE_URL;
  const rDel = spawnSync(process.execPath, ['server.js'], { cwd: ROOT, env: envDeleted, encoding: 'utf8', timeout: 20000 });
  const outDel = String(rDel.stdout || '') + String(rDel.stderr || '');
  check('spawn', 'missing platform SUPABASE_URL is refused even though a repository .env exists (blank form)',
    r.status !== null && r.status !== 0 && r.signal === null && out.includes(FIXED_REFUSAL) && !hasCanary(out));
  check('spawn', 'missing platform SUPABASE_URL is refused even though a repository .env exists (deleted form)',
    rDel.status !== null && rDel.status !== 0 && rDel.signal === null && outDel.includes(FIXED_REFUSAL) && !hasCanary(outDel));
}

{
  /* 8c. M12.P1-R4 regression: each shared rate-limit variable must be refused
     from the PLATFORM env before dotenv could backfill it from a packaged
     repository .env, and before any Upstash client could be constructed. */
  for (const name of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'RATE_LIMIT_KEY_SECRET']) {
    const envDeleted = { ...process.env, ...validEnv(), PORT: '3999' };
    delete envDeleted[name];
    const r = spawnSync(process.execPath, ['server.js'], {
      cwd: ROOT, env: envDeleted, encoding: 'utf8', timeout: 20000,
    });
    const out = String(r.stdout || '') + String(r.stderr || '');
    check('spawn', `missing platform ${name} refuses before dotenv backfill`,
      r.status !== null && r.status !== 0 && r.signal === null &&
      out.includes(FIXED_REFUSAL) && !hasCanary(out));
    check('spawn', `missing platform ${name} starts no listener and no session store`,
      !out.includes('CampuSphere server running') && !out.includes('[session] store='));
  }
}

/* ---------------- summary ---------------- */
if (failures.length) {
  console.error(`\nVERCEL-PRODUCTION-PROFILE-PROBE FAILED: ${failures.length} check(s) did not pass.`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exitCode = 1;
} else {
  console.log(`\nVERCEL-PRODUCTION-PROFILE-PROBE OK: ${checks}/${checks} checks passed.`);
}
