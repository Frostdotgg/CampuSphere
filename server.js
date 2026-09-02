/* ========================================
   CampuSphere — Express Server
   MVC Architecture Entry Point
   ======================================== */

/* ---- M12.P1-R2 fail-closed Vercel production profile, THEN dotenv ----
   The PURE preflight (config/vercelProductionProfile.js — it imports no
   dotenv, backend client, session configuration/store, middleware,
   controller, or route) validates the PLATFORM-INJECTED process.env FIRST,
   BEFORE dotenv runs, so an accidentally packaged repository .env can never
   backfill a missing or misspelled Vercel Project variable. On Vercel
   (VERCEL=1) an invalid or incomplete Supabase-only profile prints exactly
   one fixed sanitized refusal and exits nonzero, so Vercel can never fall
   back to MySQL, Leaflet, or memory sessions. Outside Vercel the preflight
   is a no-op and the quiet dotenv load below keeps every documented
   MySQL/Leaflet/local-development fallback unchanged. */
const { assertVercelProductionProfile } = require('./config/vercelProductionProfile');
try {
  assertVercelProductionProfile(process.env);
} catch (e) {
  // Fixed message — never the setting name, supplied value, URL, key, or stack.
  console.error('[startup] Vercel production profile is invalid or incomplete. Refusing to start.');
  process.exit(1);
}
require('dotenv').config({ quiet: true });

const express = require('express');
const path = require('path');
const session = require('express-session');

// Import config (Milestone 2, Section 2.2 — runtime data-source switch)
const { getAuthDataSource } = require('./config/authDataSource');
const { getBuildingDataSource, getRouteDataSource, getMapRenderer } = require('./config/mapRuntime');

// Safe JSON serialization for embedding server data in <script> contexts (XSS hardening)
const safeJson = require('./utils/safeJson');

// Import middleware
const logger = require('./middleware/logger');
const authenticatedHtmlNoStore = require('./middleware/authenticatedHtmlNoStore');
const { notFound, serverError } = require('./middleware/errorHandler');
const { requireLogin } = require('./middleware/roleAuth');
const { attachCsrfToken, verifyCsrf } = require('./middleware/csrfProtection');
const { preParseAuthLimiter, profileUpdateLimiter } = require('./middleware/rateLimit');
const { cspNonce, securityHeaders, pilotNoIndex } = require('./middleware/securityHeaders');

// Session runtime (Milestone 8, Section 8.4; Milestone 9, Section 9.4):
// persistent session store (Supabase preferred in production, MySQL fallback)
// + validated cookie/proxy policy with production fail-closed behavior.
const db = require('./config/db');
const { resolveSessionConfig } = require('./config/sessionConfig');
const { createMysqlSessionStore } = require('./services/mysqlSessionStore');
const { createSupabaseSessionStore } = require('./services/supabaseSessionStore');
// M12.P1-R3: the ONE single-flight session-readiness coordinator shared by
// local startup and the request gate (see services/sessionReadiness.js).
const { createSessionReadiness } = require('./services/sessionReadiness');

// Import route modules
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const buildingsRoutes = require('./routes/buildings');
const eventsRoutes = require('./routes/events');
const mapRoutes = require('./routes/map');
const vrRoutes = require('./routes/vr');
const adminRoutes = require('./routes/admin');
const profileController = require('./controllers/profileController');
const offlineMapController = require('./controllers/offlineMapController');

const app = express();
const PORT = process.env.PORT || 3000;

/* ---- View Engine Setup ---- */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/* ---- Template Helpers ---- */
// Expose safeJson to every EJS view so JSON embedded in <script> blocks is
// escaped against </script> breakout / XSS. Use as <%- safeJson(value) %>.
app.locals.safeJson = safeJson;

/* ---- Session runtime + readiness coordinator (M12.P1-R3) ----
   Resolved ONCE, before any middleware is mounted, because the readiness gate
   below has to exist before it can be placed at the top of the chain.

   resolveSessionConfig() FAILS CLOSED in production for a missing/placeholder/
   short secret, SESSION_STORE=memory, an invalid store, an invalid
   SESSION_COOKIE_MAX_AGE_MS, or an invalid TRUST_PROXY; non-production issues
   degrade to a documented in-memory fallback with a warn. Messages are
   fixed/sanitized (no secret value is ever printed). */
let sessionRuntime;
try {
  sessionRuntime = resolveSessionConfig();
} catch (err) {
  console.error('[session] Refusing to start: ' + err.message);
  process.exit(1);
}
sessionRuntime.warnings.forEach((w) => console.warn('[session] ' + w));

// Proxy trust (production default 1, overridable via TRUST_PROXY). Production
// behind TLS termination must forward X-Forwarded-Proto=https for Secure cookies.
app.set('trust proxy', sessionRuntime.trustProxy);

// AT MOST ONE store instance for the process. undefined => express-session's
// default MemoryStore (non-production only, per resolveSessionConfig).
// 'supabase' (preferred in production) and 'mysql' (fallback) are the
// persistent paths.
let sessionStore;
if (sessionRuntime.storeKind === 'supabase') {
  sessionStore = createSupabaseSessionStore({ ttlMs: sessionRuntime.cookie.maxAge });
} else if (sessionRuntime.storeKind === 'mysql') {
  sessionStore = createMysqlSessionStore({ pool: db, ttlMs: sessionRuntime.cookie.maxAge });
}

/* THE single-flight readiness attempt. Constructing the coordinator starts
   exactly one eager store init(); the same promise instance gates every
   request AND is awaited by start() below, so a local listener and an
   imported (Vercel) app can never disagree about readiness and can never run
   two initializations, stores, timers, or listeners. */
const sessionReadiness = createSessionReadiness(sessionStore);

/* ---- Security headers + per-request CSP nonce (Milestone 8, Section 8.5) ----
   Mounted first so every response — including the readiness 503 below,
   rate-limit 429s, malformed-JSON 400s, and error pages — carries the
   CSP/security headers and has res.locals.cspNonce available for inline
   <script>/<style> nonces. */
app.use(cspNonce);
app.use(securityHeaders);

/* ---- Pilot indexing protection (M12.P1-R8) ----
   Mounted with the security headers so EVERY response this app produces — the
   anonymous landing/auth/privacy pages, authenticated HTML, JSON APIs, the
   readiness 503, rate-limit 429s, and error pages — carries the exact pilot
   X-Robots-Tag. Paired with public/robots.txt.

   NOT ACCESS CONTROL: these are voluntary crawler directives, not an
   authorization boundary. See middleware/securityHeaders.js. */
app.use(pilotNoIndex);

/* ---- Session readiness gate (M12.P1-R3) ----
   Immediately after the security headers and BEFORE rate limiting, the body
   parsers, static serving, express-session, the authenticated middleware,
   CSRF, the logger, the routes, and the error handlers.

   `module.exports = app` means Vercel imports this app and dispatches requests
   into it without ever calling app.listen(), so there is no startup await on
   that path. This gate is that await: a request arriving while the Supabase
   session store is still initializing is HELD, not served; if initialization
   failed, it receives one fixed sanitized 503 instead of a partially-wired
   application. Mounting it this high is deliberate — nothing below it can run
   against a half-ready runtime. */
app.use(sessionReadiness.middleware);

/* ---- Container health endpoint ----
   Anonymous and intentionally mounted after the persistent-session readiness
   gate but before rate limiting, parsers, static files, and express-session.
   A healthy response therefore proves startup/session-store readiness without
   creating a session or disclosing backend, host, version, or credential data.
   When readiness fails, the shared gate above retains ownership of the fixed,
   sanitized 503 response. */
app.get('/healthz', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  return res.status(200).json({ status: 'ok' });
});

/* ---- Pre-body-parser rate limiting (Milestone 8, Section 8.3) ----
   Mounted BEFORE the body parsers so abuse of sensitive auth/OAuth/admin/profile
   endpoints (including malformed-body floods that would make express.json throw)
   is counted first. IP-keyed only at this stage; identity-aware buckets are
   applied per-route after auth/CSRF. Non-sensitive paths pass straight through. */
app.use(preParseAuthLimiter);

/* ---- Built-in Middleware ---- */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* ---- Block the local scratch VR panorama dir (L5) ----
   `public/img/sample 360/` holds owner-only local test panoramas that must NOT
   be publicly served (they are also kept out of the Docker build context and
   git). This narrow guard runs BEFORE express.static (and before the session
   middleware, so a denied hit sets no session cookie) and matches ONLY that
   directory — both the encoded (/img/sample%20360/) and decoded (/img/sample
   360/) forms, case-insensitively. Every other static asset (/img/*, /img/vr/*,
   /img/icons/*, CSS, JS, PWA assets) is untouched. Returns a sanitized 404. */
app.use((req, res, next) => {
  const raw = (req.path || '').toLowerCase();
  let dec;
  try { dec = decodeURIComponent(raw); } catch (e) { dec = raw; }
  const blocked =
    dec.indexOf('/img/sample 360/') === 0 || dec === '/img/sample 360' ||
    raw.indexOf('/img/sample%20360/') === 0 || raw === '/img/sample%20360';
  if (blocked) {
    return res.status(404).send('Not found.');
  }
  return next();
});

/* ---- Browser favicon compatibility ----
   Keep the conventional /favicon.ico request on a real shipped asset and
   ABOVE both static/session middleware. This removes the otherwise harmless
   404 from every authenticated page load without creating an anonymous
   session or duplicating an image in the package. */
app.get('/favicon.ico', (_req, res) => {
  res.type('png');
  return res.sendFile(path.join(__dirname, 'public', 'img', 'cspc-logo.png'));
});

/* ---- Static Files ---- */
app.use(express.static(path.join(__dirname, 'public')));

/* ---- Dynamic content-addressed offline map releases ----
   The bundled PMTiles archive remains served by express.static for the
   transition release. A newly published Google Drive archive is exposed at
   the same hash-shaped path so existing offline-guide clients can consume it
   without a schema or service-worker migration. This route is deliberately
   before express-session: the map is public OSM-derived data, must not create
   a session cookie, and can be cached at Vercel's edge while the browser keeps
   its explicit IndexedDB-only offline boundary. */
app.get('/maps/cspc-campus-:sha256.pmtiles', offlineMapController.download);

/* ---- Session Middleware (Milestone 8, Section 8.4) ----
   The policy, the store, and the readiness coordinator were all resolved once
   above, before any middleware was mounted. Mounting order is unchanged:
   express.static stays ABOVE this, so approved static/offline-shell caching is
   untouched, and the authenticated no-store policy stays BELOW it. */
app.use(session({
  name: sessionRuntime.cookieName,
  secret: sessionRuntime.secrets, // [current, ...previous]: current signs, previous only verify
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: sessionRuntime.cookie,
}));

/* ---- Make session user available to all views ---- */
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

/* ---- Authenticated-HTML no-store policy (OFF.1) ----
   After express-session (it needs req.session.user) and BEFORE every dynamic
   route: every authenticated response outside the explicit API namespaces —
   HTML pages, their redirects (e.g. the POST /logout 302), errors, HEAD — is
   marked `Cache-Control: no-store, private` so the HTTP cache never retains
   personalized pages. The exemption is anchored on req.path (only /api/ and
   /admin/api/), never on Accept/XHR/Content-Type, so spoofed request headers
   cannot bypass it; a malformed path fails closed to no-store. express.static
   is mounted ABOVE the session middleware, so approved static/offline-shell
   caching is untouched. */
app.use(authenticatedHtmlNoStore);

/* ---- CSRF token attachment (Milestone 8, Section 8.2) ----
   Runs after express-session and before routes so every rendered view can read
   res.locals.csrfToken. Validation is applied per-route (see verifyCsrf usage
   in routes/auth.js, routes/admin.js, and the /api/update-profile mount), never
   globally before auth/role middleware, so unauthenticated/role-denied API
   contracts (401/403 JSON) are preserved. */
app.use(attachCsrfToken);

/* ---- Custom Middleware ---- */
app.use(logger);

/* ---- Routes ---- */
app.use('/', indexRoutes);
app.use('/', authRoutes);
app.use('/', dashboardRoutes);
app.use('/', buildingsRoutes);
app.use('/', eventsRoutes);
app.use('/', mapRoutes);
app.use('/', vrRoutes);
app.use('/admin', adminRoutes);

// API routes
// requireLogin first so anonymous callers keep the established 401 JSON contract
// (verifyCsrf would otherwise mask it with a 403); verifyCsrf then guards the
// authenticated state-changing write; profileUpdateLimiter (per user+IP) bounds
// authenticated abuse after both checks pass.
app.post('/api/update-profile', requireLogin, verifyCsrf, profileUpdateLimiter, profileController.updateProfile);

/* ---- Error Handling Middleware ---- */
app.use(notFound);
app.use(serverError);

/* ---- Start Server ---- */
// Await the SAME readiness promise the request gate awaits — not a second
// init() call — so the persistent session store is verified/created before the
// listener opens and production never serves a request without its session
// backend. A rejection here is the identical failure the gate reports as 503.
async function start() {
  await sessionReadiness.whenReady();
  app.listen(PORT, () => {
    console.log(`✅ CampuSphere server running at http://localhost:${PORT}`);
    console.log(`[session] store=${sessionRuntime.storeKind} cookie=${sessionRuntime.cookieName} secure=${sessionRuntime.cookie.secure} trustProxy=${sessionRuntime.trustProxy}`);
    console.log(`[auth] Active AUTH_DATA_SOURCE=${getAuthDataSource()}`);
    console.log(`[map] Active BUILDING_DATA_SOURCE=${getBuildingDataSource()} ROUTE_DATA_SOURCE=${getRouteDataSource()} MAP_RENDERER=${getMapRenderer()}`);
  });
}

/* Only the LOCAL/container entry point opens a listener. When this module is
   imported instead — Vercel's serverless handler, or a probe that inspects the
   exported app — requiring it must never bind a port; readiness is then
   enforced per request by the gate mounted above. */
if (require.main === module) {
  start().catch(() => {
    // Fail closed: never start without a working persistent session store.
    // Fixed message, logged exactly once — no DB credential, host, or stack
    // detail, and no listener was opened.
    console.error('[startup] Session store initialization failed. Refusing to start.');
    process.exit(1);
  });
}

module.exports = app;
