'use strict';

/* ========================================
   CampuSphere — five-minute user-presence contract probe

   DATABASE-FREE and NETWORK-FREE. This focused probe validates the pure
   five-minute policy and the source contracts around authentication, CSRF,
   rate limiting, atomic dual-backend writes, admin-only batched reads, and
   visible-page heartbeat behavior. It never starts the app or opens a DB.
   ======================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const failures = [];
let checks = 0;

function check(scope, label, condition) {
  checks += 1;
  const passed = Boolean(condition);
  console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!passed) failures.push(`${scope} :: ${label}`);
}

const policy = require(path.join(ROOT, 'utils', 'userPresence'));
const service = read('services/userPresenceService.js');
const repository = read('repositories/userRepository.js');
const controller = read('controllers/presenceController.js');
const server = read('server.js');
const auth = read('controllers/authController.js');
const routes = read('routes/admin.js') + '\n' + read('routes/auth.js');
const limiter = read('middleware/rateLimit.js');
const mysqlSchema = read('database/schema.sql');
const mysqlMigration = read('scripts/applyUserPresenceMysqlMigration.js');
const supabaseMigration = read('database/supabase/0022_user_presence.sql');
const client = read('public/js/user-presence.js');
const adminClient = read('public/js/admin/admin-users.js');
const adminController = read('controllers/adminController.js');
const adminView = read('views/admin/users.ejs');
const privacy = read('views/privacy.ejs');
const serviceWorker = read('public/sw.js');

const NOW = new Date('2026-09-03T00:00:00.000Z');
const exactlyFiveMinutes = new Date(NOW.getTime() - policy.ONLINE_WINDOW_MS);

console.log('\n[user presence] pure five-minute policy');
check('policy', 'online window is exactly 300 seconds', policy.ONLINE_WINDOW_MS === 300000);
check('policy', 'database touch interval is exactly 60 seconds', policy.TOUCH_MIN_INTERVAL_SECONDS === 60);
check('policy', 'missing presence is Offline', policy.isUserOnline(null, NOW) === false);
check('policy', 'Never/invalid presence is Offline', policy.isUserOnline('not-a-time', NOW) === false);
check('policy', 'exactly five minutes is Online (inclusive boundary)',
  policy.isUserOnline(exactlyFiveMinutes, NOW) === true);
check('policy', 'one millisecond older than five minutes is Offline',
  policy.isUserOnline(new Date(exactlyFiveMinutes.getTime() - 1), NOW) === false);
check('policy', 'a recent timestamp is Online',
  policy.isUserOnline(new Date(NOW.getTime() - 1000), NOW) === true);
check('policy', 'a future timestamp is not treated as Online',
  policy.isUserOnline(new Date(NOW.getTime() + 1), NOW) === false);
const rows = policy.presenceSnapshot([
  { user_id: 1, last_seen_at: exactlyFiveMinutes.toISOString() },
  { id: 2, lastSeenAt: null },
  { id: 3, last_seen_at: new Date(NOW.getTime() - policy.ONLINE_WINDOW_MS - 1).toISOString() },
  { id: 'bad', last_seen_at: NOW.toISOString() }
], NOW);
check('policy', 'snapshot returns safe ids, ISO timestamps, and boundary state',
  rows.length === 3 && rows[0].id === 1 && rows[0].isOnline === true &&
  rows[0].lastSeenAt === exactlyFiveMinutes.toISOString() &&
  rows[1].id === 2 && rows[1].lastSeenAt === null && rows[1].isOnline === false &&
  rows[2].id === 3 && rows[2].isOnline === false);

console.log('\n[user presence] server/database contracts');
check('schema', 'MySQL has a separate one-row-per-user table with FK cascade',
  /CREATE TABLE IF NOT EXISTS user_presence/i.test(mysqlSchema) &&
  /user_id INT NOT NULL PRIMARY KEY/i.test(mysqlSchema) &&
  /FOREIGN KEY \(user_id\) REFERENCES users\(id\) ON DELETE CASCADE/i.test(mysqlSchema));
check('schema', 'MySQL indexes last_seen_at and does not backfill users',
  /idx_user_presence_last_seen_at \(last_seen_at\)/i.test(mysqlSchema) &&
  !/INSERT\s+INTO\s+user_presence[\s\S]{0,240}SELECT/i.test(mysqlSchema) &&
  !/updated_at\s*=\s*.*presence/i.test(mysqlSchema));
check('schema', 'the standalone MySQL migration is additive and idempotent',
  /CREATE TABLE IF NOT EXISTS user_presence/i.test(mysqlMigration) &&
  /module\.exports\s*=/.test(mysqlMigration) &&
  !/UPDATE\s+users|INSERT\s+INTO\s+users|DELETE\s+FROM\s+users/i.test(mysqlMigration));
check('write', 'MySQL touch is parameterized and atomically throttled at 60 seconds',
  /db\.query\(MYSQL_TOUCH_SQL, \[id\]\)/.test(service) &&
  /ON DUPLICATE KEY UPDATE/i.test(service) &&
  /INTERVAL\s*['"]?\s*\+\s*TOUCH_MIN_INTERVAL_SECONDS/i.test(service) &&
  /TOUCH_MIN_INTERVAL_SECONDS/.test(service) &&
  !/updated_at/i.test(service));
check('write', 'Supabase touch uses one server-clock RPC and no client timestamp',
  /\.rpc\('app_touch_user_presence'/.test(repository) &&
  /p_user_id:\s*userId/.test(repository) &&
  !/Date\.now|req\.body/i.test(repository));
check('supabase', 'migration declares indexed table, RLS, and no backfill',
  /CREATE TABLE IF NOT EXISTS public\.user_presence/i.test(supabaseMigration) &&
  /CREATE INDEX IF NOT EXISTS user_presence_last_seen_at_idx/i.test(supabaseMigration) &&
  /ALTER TABLE public\.user_presence ENABLE ROW LEVEL SECURITY/i.test(supabaseMigration) &&
  !/INSERT\s+INTO\s+public\.user_presence[\s\S]{0,120}SELECT/i.test(supabaseMigration));
check('supabase', 'RPC is SECURITY INVOKER with fixed search path and DB throttle',
  /CREATE OR REPLACE FUNCTION public\.app_touch_user_presence\(p_user_id bigint\)/i.test(supabaseMigration) &&
  /SECURITY INVOKER/i.test(supabaseMigration) &&
  /SET search_path = pg_catalog, public/i.test(supabaseMigration) &&
  /ON CONFLICT \(user_id\) DO UPDATE/i.test(supabaseMigration) &&
  /INTERVAL '60 seconds'/i.test(supabaseMigration) &&
  /CURRENT_TIMESTAMP/i.test(supabaseMigration));
check('supabase', 'browser roles cannot read/write table or execute RPC',
  /REVOKE ALL ON TABLE public\.user_presence FROM PUBLIC, anon, authenticated/i.test(supabaseMigration) &&
  /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.user_presence TO service_role/i.test(supabaseMigration) &&
  /REVOKE ALL ON FUNCTION public\.app_touch_user_presence\(bigint\)\s+FROM PUBLIC, anon, authenticated/i.test(supabaseMigration) &&
  /GRANT EXECUTE ON FUNCTION public\.app_touch_user_presence\(bigint\)\s+TO service_role/i.test(supabaseMigration));
check('route', 'heartbeat is authenticated, CSRF-protected, rate-limited, and session-bound',
  /app\.post\(\s*['"]\/api\/presence\/heartbeat['"],\s*requireLogin,\s*verifyCsrf,\s*presenceHeartbeatLimiter,/s.test(server) &&
  /req\.session\.user/.test(controller) &&
  !/req\.body|req\.query|req\.params/.test(controller));
check('route', 'heartbeat returns no-store 204 and sanitized 503 on store failure',
  /res\.set\('Cache-Control', 'no-store'\)/.test(controller) &&
  /res\.status\(204\)\.end\(\)/.test(controller) &&
  /Presence is temporarily unavailable\./.test(controller) &&
  !/error\.message|error\.stack|String\(error\)/.test(controller));
check('rate-limit', 'presence has a dedicated user-only budget',
  /presence:\s*\{[\s\S]*?max:.*?30[\s\S]*?windowMs:.*?5 \* MIN/.test(limiter) &&
  /scope:\s*'presence'/.test(limiter) &&
  /return \[String\(uid\)\]/.test(limiter) &&
  /presenceHeartbeatLimiter/.test(limiter));
check('auth', 'successful registration, email login, and Google login all touch presence',
  /async function establishAuthenticatedSession/.test(auth) &&
  /await touchUserPresenceBestEffort\(/.test(auth) &&
  (auth.match(/await establishAuthenticatedSession\(/g) || []).length >= 4);
check('failure', 'login remains non-blocking and warnings disclose no backend details',
  /touchUserPresenceBestEffort/.test(auth) &&
  /Presence is intentionally best-effort/.test(auth) &&
  /console\.warn\('User presence update skipped\.'\)/.test(service));

console.log('\n[user presence] admin read contracts');
check('admin route', 'presence snapshot is behind the existing admin role guard',
  /router\.use\(requireRole\('admin'\)\)/.test(routes) &&
  /router\.get\(['"]\/api\/users\/presence['"],\s*presenceController\.adminSnapshot\)/.test(routes));
check('admin response', 'snapshot exposes only serverNow, window, and reduced records',
  /serverNow/.test(service) && /onlineWindowSeconds/.test(service) &&
  /presenceSnapshot\(rows, now\)/.test(service) &&
  /res\.status\(200\)\.json\(snapshot\)/.test(controller) &&
  !/password|oauth_subject|profile_image_url|ip_address|session_id/.test(controller));
check('admin query', 'Supabase and MySQL admin paths use one batched presence read',
  /listUserPresence\(\)/.test(adminController) &&
  /Promise\.all\(\[[\s\S]*listAllUsersForAdmin\(\)[\s\S]*listUserPresence\(\)/.test(adminController) &&
  /LEFT JOIN user_presence/.test(adminController) &&
  !/forEach[\s\S]{0,300}listUserPresence/.test(adminController));
check('admin query', 'user-list projection excludes password and other sensitive fields',
  /\.select\('id, username, email, role, first_name, last_name, created_at'\)/.test(repository) &&
  /SELECT u\.id, u\.username, u\.email, u\.role, u\.first_name, u\.last_name/.test(adminController) &&
  !/SELECT u\.\*/.test(adminController));
check('admin UI', 'labels, filters, and missing timestamps use Online/Offline/Never',
  /Online/.test(adminView) && /Offline/.test(adminView) && /Last seen/.test(adminView) &&
  /data-value="online"/.test(adminView) && /data-value="offline"/.test(adminView) &&
  /if \(!dateStr\) return 'Never'/.test(adminClient) &&
  !/Last Active|stat-active|stat-inactive|data-value="active"|data-value="inactive"/.test(adminView + adminClient));
check('admin UI', 'browser polls one batched endpoint every 30 seconds only while visible',
  /fetch\('\/admin\/api\/users\/presence'/.test(adminClient) &&
  /setInterval\(\(\) => \{[\s\S]*?30 \* 1000/.test(adminClient) &&
  /document\.visibilityState === 'hidden'/.test(adminClient) &&
  /visibilitychange/.test(adminClient) &&
  !/users\/presence\/'? \+/.test(adminClient));

console.log('\n[user presence] authenticated browser contracts');
check('client', 'visible pages heartbeat immediately and every 60 seconds',
  /HEARTBEAT_INTERVAL_MS = 60 \* 1000/.test(client) &&
  /sendHeartbeat\(\);[\s\S]{0,120}startTimer\(\)/.test(client) &&
  /set\(sendHeartbeat, HEARTBEAT_INTERVAL_MS\)/.test(client));
check('client', 'hidden/pagehide stops the timer and visibility resume sends immediately',
  /visibilitychange/.test(client) &&
  /stopTimer\(\)/.test(client) &&
  /pageshow/.test(client) &&
  /if \(isVisible\(\)\) \{[\s\S]{0,100}sendHeartbeat\(\)/.test(client));
check('client', 'overlapping requests are prevented and authentication loss stops future sends',
  /if \(stopped \|\| !isVisible\(\) \|\| inFlight\) return/.test(client) &&
  /inFlight = true/.test(client) && /response\.status === 401/.test(client) &&
  /stopped = true/.test(client));
check('client', 'heartbeat sends CSRF and no-store without user id or client timestamp',
  /X-CSRF-Token/.test(client) && /cache: 'no-store'/.test(client) &&
  !/user[_-]?id|last[_-]?seen|Date\.now|new Date/.test(client));
check('client', 'presence client is not in the service-worker precache',
  !serviceWorker.includes('/js/user-presence.js') &&
  !serviceWorker.includes('user-presence.js'));
check('privacy', 'privacy notice discloses one admin-only last-seen timestamp',
  /last-seen timestamp/i.test(privacy) && /admin-only/i.test(privacy) &&
  /five minutes|5 minutes/i.test(privacy) && /visible/i.test(privacy));

console.log(`\n${failures.length ? 'USER PRESENCE PROBE FAILED' : 'USER PRESENCE PROBE PASSED'} (${checks - failures.length}/${checks})`);
if (failures.length) process.exitCode = 1;
