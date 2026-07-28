# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CampuSphere is an Express 5 + EJS server-rendered web app that delivers a virtual campus map tour for Camarines Sur Polytechnic Colleges (CSPC). Authentication uses session cookies (express-session) with bcrypt for local credentials and Google OAuth as a second sign-in path. Persistence spans two backends selected at runtime: **Supabase/PostgreSQL is the production data store and production session-store target**, while **MySQL (via the `mysql2/promise` pool) remains the local-development / fallback / local-rehearsal store**. Supabase Auth is not used — CampuSphere keeps Express sessions, bcrypt local login, and Google OAuth. Server-side data access goes through the `repositories/` and `services/` layers (the session stores also live in `services/`).

## Common Commands

```bash
npm start                  # Run server on PORT (default 3000) via node server.js
npm run dev                # Run with --watch for auto-restart on file changes
node database/seed.js      # Create DB, apply schema.sql, seed default users + content
```

`npm test` runs `node scripts/quality-gates.js` — a self-terminating contract/security gate that boots the app through `scripts/with-server.js` (never a foreground server) and asserts the auth/authz/CSRF/CSP/PWA/media contracts in both MySQL and Supabase session modes. It also spawns the four room-scheduling probes (`scripts/scheduleRepository-probe.js`, `scripts/adminScheduleCrud-probe.js`, `scripts/publicScheduleDisplay-probe.js`, `scripts/vrScheduleHotspot-probe.js`) covering schedule backend parity, admin-only schedule CRUD/validation, public building schedule display, and VR room-door schedule interaction (empty states, leak boundaries, cleanup) in both runtime modes. Related scripts (see `package.json`): `npm run qa` (contracts + db-perf + supabase-smoke + identity + audit), and the individual gates `qa:contracts`, `qa:db`, `qa:smoke`, `qa:identity`, `qa:audit`. Do not run `node server.js`, `npm start`, or `npm run dev` in the foreground (Windows job-object hang) — use the `scripts/with-server.js` harness for runtime probes.

Seven M12.P1 probes remain standalone rather than registered inside the
`npm test` total: `scripts/pilotCredentialSafety-probe.js` (R1, `24/24`),
`scripts/vercelProductionProfile-probe.js` (R2, `119/119`),
`scripts/vercelRuntimeSessionBootstrap-probe.js` (R3, `86/86`),
`scripts/sharedRateLimit-probe.js` (R4, `180/180`), and
`scripts/boundedAnonymousAccessDenial-probe.js` (R5, `90/90`, dedicated ports
`3381`/`3382`), `scripts/selfHostedBrowserDependencies-probe.js` (R6,
`230/230`, dedicated ports `3383`/`3384`), and
`scripts/vercelPackageBoundary-probe.js` (R7, `71/71`, dedicated port `3385`).
Never describe any of them as part
of the accepted R4
`3040/3040` full-suite total, the superseded pre-R5 `3050/3050` total, the
accepted R5 `3234/3234` full-suite total, the accepted R6 `3415/3415`
full-suite total, the superseded M12.P1-R7 candidate `3492/3492` and literal-NUL
remediation `3494/3494` totals, or the M12.P1-R7 audited-source list pinning
accepted closeout `3495/3495` total. A context-only grounding prompt must
not run them.

**Probe session hygiene.** Every probe that authenticates a canonical
regression identity must own that session: register each jar with
`scripts/probeSessionLifecycle.js` immediately after login and terminate it
from a `finally` through the real logout interface. `scripts/with-server.js`
resolves the child's `SESSION_STORE` from the normalized data mode when
`sessionStore` is omitted and fails closed on a blank/invalid explicit value,
so an ambient `SESSION_STORE` can never leak into a probe leg. The registered
final gate `scripts/probeSessionResidue-probe.js` is the authoritative
postcondition (SELECT-only, zero unexpired canonical sessions in both stores);
the static ownership inventory in `scripts/quality-gates.js` discovers probes
from the filesystem as well as the registered list, but proves source patterns
only — never runtime store cleanliness.

The same contract suite also runs the road-routing probes for topology, stored geometry, API assembly, public Leaflet/MapLibre rendering, admin geometry editing, map-to-guided-VR flow, Free Roam, VR schedule hotspots, and the BE.6 selected-demo freeze. BE.6 and OFF.1 are complete and Codex GO. The verified post-`0019` graph has 20 nodes, 48 directed edges, 24 exact reverse pairs, 48 valid geometries, and 13 routable building destinations in both backends. The 13 buildings are the selected demo roster, not the complete campus; admin edits and later additions remain supported but invalidate freeze evidence until it is refreshed.

<!-- M12.P1 CURRENT STATUS START -->
The owner-authorized `M12.P1` deployment-readiness and exposure audit is
complete with Codex NO-GO after one critical and six high blockers. R1-R7,
D1-D5, and expanded D7 are complete and Codex GO, including all R3
session-hygiene/ownership/import-detector follow-ups, the R4 shared-rate-limit
follow-up, both R5 follow-ups, dependency-security remediation, both R7
source-auditability corrections, and the expanded D7 cross-role
admin-to-participant regression gate. `M12.P1-R7` is complete and Codex GO.
Accepted R7 closeout
evidence is focused `71/71`, in-suite
`vercel-package-boundary` `70/70`, full suite `3495/3495` with
`QUALITY-GATES OK`, and `npm audit --omit=dev` at zero vulnerabilities. The
`3492/3492` initial R7 candidate and `3494/3494` literal-NUL remediation
candidate are historical/superseded. Following the accepted 2026-07-22
dependency closeout, a subsequent 2026-07-26 npm advisory drift is remediated:
production pins `ejs@6.0.1`, the
`jake/filelist/minimatch/brace-expansion` chain is absent, and
`npm audit --omit=dev` reports zero vulnerabilities. `M12.P1-D7` is complete
and Codex GO. Accepted D7 evidence is the fresh-context role-isolation rerun:
separate Playwright `BrowserContext` objects with no storage carryover, both
MySQL and Supabase legs completed and cleaned up through supported application
interfaces, `npm test` `3511/3511` with `QUALITY-GATES OK`, `npm audit
--omit=dev` zero vulnerabilities, and postconditions `24/24 -> 18/18 -> 46/46`
with fingerprint
`a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d`
unchanged. Earlier D7 blocked/partial attempts are historical/superseded.
The post-D7 logout-probe output-hygiene remediation is independently
Codex-accepted as additive evidence: focused `75/75`, full suite `3529/3529`
with `QUALITY-GATES OK`, zero escaped `Logout error:` lines, `npm audit
--omit=dev` zero vulnerabilities, and postconditions
`24/24 -> 18/18 -> 46/46`. It does not supersede or replace the accepted D7
`3511/3511` evidence and authorizes no new section.
`M12.P1-R8` is the next potential section. R8 is read-only and is not
authorized by this synchronization; even R8 GO authorizes only a separate owner
deployment decision.
`M12.P1` remains NO-GO for deployment and pilot readiness; deployment is not
authorized.
<!-- M12.P1 CURRENT STATUS END -->

A narrow logout-probe output-hygiene remediation is independently
Codex-accepted as additive evidence. The mocked failed-destroy unit cases in
`scripts/logoutSessionTermination-probe.js` now capture the controller's
expected fixed sanitized line instead of letting it print, so an otherwise
green `npm test` transcript no longer shows `Logout error: session destroy
failed.` twice, where a reviewer could not distinguish it from a real logout
failure. `controllers/authController.js` is UNCHANGED: a genuine logout failure
is still logged, once, sanitized, and still returns a sanitized 500 without
clearing the cookie.

The remediation adds the `logout-output-hygiene` static gate, whose expected
line is pinned in `scripts/quality-gates.js` independently of the probe and
whose detectors are each exercised against a rejecting fixture. Its evidence is
focused `75/75` (baseline `68/68`), full suite `3529/3529` with
`QUALITY-GATES OK` and zero escaped `Logout error:` lines in the captured
transcript, `npm audit --omit=dev` zero vulnerabilities, and postconditions
`24/24 -> 18/18 -> 46/46`. The `+18` is `+7` probe capture assertions and `+11`
new gate checks.

This remediation is accepted as additive test/output-hygiene evidence only. It
authorizes no new section, does not replace D7 evidence, and does not authorize
R8 or deployment.

This remediation does not supersede or replace the accepted D7 `3511/3511`
full-suite evidence recorded above, which stands unchanged.

Superseded, historical: an earlier post-synchronization verification run is
preserved as RED and is not accepted evidence — `npm test` ended with nine
failures after Supabase logout/session-destroy failures left unexpired
administrator and student sessions; that post-run safety check was `22/24`, the
embedded residue gate was red, and the embedded BE.6 check did not establish its
frozen postcondition. That blocker is closed: a separately owner-authorized
supported cleanup/restoration was performed and independently reproduced, and
the R6 session re-verified safety `24/24`, residue `18/18`, and BE.6 `46/46`
before editing and again after its own full-suite run.

R6 self-hosts every browser vendor library under `public/vendor` — Leaflet
`1.9.4`, MapLibre GL JS `4.7.1`, Pannellum `2.5.6`, Iconify Icon `1.0.7`, and
Lucide `1.25.0` — with `public/vendor/manifest.json` recording registry
provenance, sha512 integrity, license, and the SHA-256 of every shipped file.
Provenance is also pinned INDEPENDENTLY of the manifest in
`EXPECTED_VENDOR_INVENTORY` (probe code), verified against official
`npm view`/`npm pack`; the analyzer and gate fail closed on any divergence and
re-verify disk/HTTP bytes against the pinned hashes, so a coordinated
bytes+manifest-hash swap fails without a reviewed code change.
`script-src` is now exactly `'self'` plus the per-request nonce, and
`unpkg.com`, `cdn.jsdelivr.net`, and `code.iconify.design` are gone from every
directive. `package.json` and `package-lock.json` are byte-identical, and
`public/sw.js` changed in commentary only. Accepted R6 Codex GO evidence:
focused
`230/230`, full suite `3415/3415` with `QUALITY-GATES OK` (pre-remediation
`3375/3375`), safety `24/24`,
residue `18/18`, BE.6 `46/46`, audit zero, and independent browser verification
of all affected admin/public/map/VR surfaces at `1440x900` and `390x844`.
Missing-family interception for Lucide, Iconify, Leaflet, Pannellum, and
MapLibre failed closed truthfully with no executable CDN fallback, CSP
violation, stale route/arrival claim, unexpected exception, or horizontal
overflow.

R4 moves the Vercel rate-limit counters to a shared `@upstash/redis@1.38.0`
store (`services/rateLimitStore.js`) incremented by one atomic server-side Lua
`EVAL`; only HMAC-SHA-256 bucket digests are persisted. Local development keeps
the in-memory adapter, and on Vercel an unusable shared store fails closed with
a fixed sanitized `503` rather than falling back to a process-local Map.

R4 is complete and Codex GO after its focused probe passed `180/180`, R2 stayed
green at `119/119`, R3 stayed green at `86/86`, and the R4 full suite passed
`3040/3040` with `QUALITY-GATES OK`. The superseded pre-R5 authority-sync suite
was `3050/3050`; after the R5 follow-up (authoritative global-total probe check
plus the reusable-grounding-prompt gate) the accepted R5 closeout suite passed
`3234/3234` with `QUALITY-GATES OK` and focused R5 `90/90` standalone. Credential/session safety stayed `24/24`,
canonical residue stayed `18/18`, and BE.6 stayed `46/46`. The accepted
2026-07-22 compatible dependency-security remediation is historical Codex GO
evidence: at that closeout production resolved `body-parser@2.3.0` and
`brace-expansion@2.1.2`, `package.json` was unchanged, and
`npm audit --omit=dev` reported zero vulnerabilities.

R3 established one shared single-flight session-readiness promise, made local
startup await it, prevented the exported/Vercel app from reaching session
middleware or routes before readiness, returned one fixed sanitized `503` on
initialization failure, and avoided duplicate stores, timers, listeners, logs,
or initialization attempts. Grounding remains no authority to run probes,
clear sessions, implement the next section, or deploy.

R5 confines its production change to `middleware/roleAuth.js`: routine
anonymous denials on login-gated and role-gated routes now write zero
`system_logs` rows while keeping the exact `302 /auth`, fixed `401` JSON, and
`403` HTML/JSON contracts. The single retained authorization-denial write is
the authenticated wrong-role case, dispatched through an authenticated-only
helper that requires a positive integer actor id and a non-blank role. Real
authentication failures stay audited. The R5 follow-up additionally proves the
authoritative unfiltered `system_logs` total (`summary.total`) is unchanged
across the anonymous requests via a bounded baseline/postcondition, and makes
both reusable prompts in `docs/new-session-grounding-prompts.md` current under a
dedicated documentation gate. Focused R5 `90/90`; accepted closeout suite
`3234/3234` with `QUALITY-GATES OK`. R5 and its documentation-gate correction
are complete and Codex GO.

R3 through R7 and expanded D7 are complete and Codex GO. `M12.P1-R8` is the
next potential section and is read-only. It requires a separate
owner-authorized read-only review prompt, and even R8 GO authorizes only a
separate owner deployment decision. R7 adds an allowlist `.vercelignore`, a
minimal `vercel.json` with seven narrow static/PWA header rules and one fixed
static-only CSP confined to `/offline.html`, the standalone
`scripts/vercelPackageBoundary-probe.js`, and the in-suite
`vercel-package-boundary` gate; Express's per-response nonce CSP is untouched
and remains the sole CSP authority for dynamic responses.
D7 exercised the temporary building/details/node/reverse-geometry-edge/
public-schedule lifecycle through supported application interfaces in both
MySQL and Supabase, verified propagation and all-reachable-page behavior for
student, guest, and instructor with separate fresh browser/storage contexts,
cleaned up in reverse dependency order, and restored BE.6 plus
credential/session safety. The eventual pilot exposes the entire authenticated
application while facilitators direct students and guests to evaluate building
routing. Feedback uses an owner-created Google Form. No anonymous browsing is
added. OFF.2 through OFF.6 are deferred until pilot review, not cancelled, and
remain mandatory before final Milestone 12 GO. D6 remains post-pilot after
OFF.2-OFF.5 and before OFF.6.

The seed script creates a default admin and a sample student for **local MySQL development only** — their deterministic local-only values live in `database/seed.js` and the shared test-only loader (`scripts/regressionCredentials.js`), not in documentation, and are not valid live credentials. Live/Supabase regression sign-ins use the test-only `SUPABASE_REGRESSION_*` variables from the ignored local `.env` (names in `.env.example`; Supabase-capable probes fail closed when they are missing). The seed connects without a database first and creates `campusphere_db` from `database/schema.sql`, so it can be re-run idempotently — every insert uses `INSERT IGNORE` or a pre-check on a natural key.

## Local server for verification (Windows) — avoid command hangs

`server.js` is a long-running process. Launching it as a foreground command (or with
hand-rolled detachment) hangs the agent command runner: on Windows the runner waits on the
entire job-object process tree, and the server never exits.

Rules:
- Never run `node server.js`, `npm start`, or `npm run dev` as a foreground command, and
  never use `detached`/`unref` or `ProcessStartInfo` + `WaitForExit`/`ReadToEnd`
  "background" workarounds — they do not escape the job object.
- API/HTTP/contract checks: use `scripts/with-server.js`, a self-terminating harness that
  spawns the server, waits for readiness, runs a probe, and kills the server in `finally`
  before exiting.
- Browser/visual checks: start the server with the agent runner's NATIVE background/async
  execution facility, record the PID and a dedicated port, drive the browser, then stop that
  exact PID and confirm the port is free.
- Always pass the full inherited environment and override only what's needed (PORT,
  *_DATA_SOURCE). Never clear the environment.
- Confirm the chosen port is free before launch; stop the exact PID you started afterward;
  never blanket-kill `node.exe` (MCP/session processes share that image name).
- Do not start a server before every task — only when runtime testing requires one.

## Required Environment Variables (`.env`)

- `SESSION_SECRET` — falls back to a hardcoded dev string if absent (don't ship without it).
- `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` — MySQL pool config (`config/db.js`); defaults assume local root access to `campusphere_db`.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` — required for the `/auth/google` flow; OAuth is silently disabled (redirects to `/auth?error=oauth_failed`) if either ID/secret is missing.
- `PORT` — optional, defaults to 3000.

## Architecture

### Request flow

`server.js` wires middleware in this order: body parsers → static files → `express-session` → a small middleware that copies `req.session.user` to `res.locals.user` (so every EJS template can read `user` without being passed it explicitly) → request logger → route modules → 404/500 error handlers.

Routes are mounted flat at `/` (except `/admin` which is namespaced). Several route files all mount at `/` — the actual URL paths are defined inside each router file, not via the mount prefix. Don't assume a route lives in `routes/<name>.js` based on its URL — check `server.js` for the mount, then the router for the path.

Controllers render EJS views directly in most cases. The admin section additionally exposes JSON CRUD endpoints under `/admin/api/*` (users, news, events, buildings) consumed by client-side JS in `public/js/`.

### Auth model

`middleware/roleAuth.js` is the **single source of truth** for auth middleware. It exports:

- `requireLogin` — gate any authenticated route.
- `requireRole(...allowedRoles)` — gate a route by role; `routes/admin.js` uses `router.use(requireRole('admin'))` to gate the entire `/admin` namespace.
- `attachUser` — non-blocking; copies session user onto `req.currentUser`.
- `wantsJson(req)` — content-negotiation helper used internally.

`middleware/requireLogin.js` still exists as a compatibility re-export of `roleAuth.requireLogin` so older imports keep working — prefer `require('../middleware/roleAuth')` in new code.

**HTML vs. JSON responses.** `requireLogin` and `requireRole` both call `wantsJson(req)` and branch on the result:

- Browser requests → `302` redirect to `/auth` (unauthenticated) or `403` EJS `error.ejs` render (forbidden).
- API requests → `401`/`403` JSON `{ success, message }`.

`wantsJson` returns true if the URL contains `/api/`, the request is XHR, the `Accept` header prefers JSON over HTML, or `Content-Type` is JSON. When adding new admin JSON endpoints under `/admin/api/*`, this means a logged-out fetch gets a clean 401 — front-end code can react without parsing an HTML redirect.

Roles: `student-cspc`, `instructor`, `admin`, `guest`. Each role has a different sidebar definition in `models/data.js` under `sidebarNav`.

### Runtime data source, session store & Cloudinary

CampuSphere runs against two backends chosen at request time by the `*_DATA_SOURCE` switches (read by `config/authDataSource.js`, `config/contentDataSource.js`, `config/vrDataSource.js`, `config/scheduleDataSource.js`, `config/mapRuntime.js`): **Supabase/PostgreSQL is the production target**, **MySQL is the local-development / fallback store**. Server-side Supabase access is through the **server-only** client (`config/supabase.js`, service role) and the `repositories/` + `services/` layers; MySQL uses the shared pool (`config/db.js`). **Supabase Auth is not used.**

Room scheduling (Milestone 11) stores **real admin-managed room/facility schedule data** in the `room_schedules` table (MySQL `database/schema.sql`; Supabase migration `0012_room_schedules.sql`, owner-applied) accessed only through the dual-backend `repositories/scheduleRepository.js`, switched by `SCHEDULE_DATA_SOURCE=mysql|supabase` — it is **not** SIS, enrollment, assigned-class, or instructor-teaching-load simulation. VR room-door schedule hotspots use nullable schedule-target metadata on `vr_hotspots` from Supabase migration `0013_vr_hotspot_schedule_metadata.sql` (owner-applied before Supabase VR schedule verification).

Road-following destination routing uses CampuSphere's own dual-backend campus graph and owner-managed `route_edges.path_geometry`; it has no Google Maps, Google Earth, Strava, SIS, or external routing-engine dependency. Supabase migrations are exactly `0001` through `0019`, and `0014` through `0019` are owner-applied. `config/selectedDemoFreeze.js` is the immutable BE.6 QA baseline; it is not a runtime/admin write lock. Guided VR is truthful about incomplete panorama coverage: arrival is shown only when the last mapped scene belongs to the selected destination; otherwise the viewer displays an explicit coverage-ended notice.

Sessions (`express-session`; policy validated in `config/sessionConfig.js`): `SESSION_STORE=supabase` is the **preferred/default production & demo** store (`services/supabaseSessionStore.js`, table `public.app_sessions`); `SESSION_STORE=mysql` is the **explicit fallback / local-rehearsal** store (`services/mysqlSessionStore.js`); `SESSION_STORE=memory` is **local-development only and fails closed in production**.

**Cloudinary is media delivery only** (campus images + 360° VR panoramas) — not auth, not data persistence. Its credentials are **server-only** (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, read by `config/cloudinary.js`); delivery URLs are validated by `utils/mediaUrl.js`. The local `/img/*` and `/img/vr/*` fallbacks are preserved when Cloudinary is unconfigured.

### Google OAuth domain-to-role mapping

`controllers/authController.js` → `getRoleFromEmail()` assigns roles by **exact email domain** at OAuth registration time:

- `@my.cspc.edu.ph` → `student-cspc`
- `@cspc.edu.ph` → `instructor`
- `@gmail.com` → `guest`
- anything else → rejected with `unauthorized_domain`

Admin accounts cannot be created via OAuth — only through the seed script or direct DB insert. The OAuth flow is two-step: callback redirects to `/auth/complete-registration` to collect role-specific profile fields (student ID, employee ID, or address+phone) before the `users` row is actually inserted. Pending state lives in `req.session.pendingOAuthRegistration`.

### Session shape

After login, `req.session.user` is hydrated with the row from `users` plus role-specific fields merged in from `student_profiles` / `instructor_profiles` / `guest_profiles` (see `loadRoleProfileIntoSession` in `authController.js`). Controllers reading e.g. `user.course` or `user.employee_id` rely on this merge having already happened. The local-login path (`loginPost`) duplicates this hydration inline rather than calling the helper — keep both paths in sync if you change the session shape.

### Data layer

`models/data.js` is **not** a runtime data source — it's a static module used by `database/seed.js` to populate MySQL on first run, and by a small number of legacy template paths that still read from it directly. Live data (users, buildings, news, events, FAQs) comes from MySQL via `config/db.js` (a shared pool exported as `db`). When adding a new entity, follow the existing pattern: add a table in `database/schema.sql`, an optional seed in `database/seed.js`, controller methods that call `db.query(...)`, and an admin CRUD pair under `/admin/api/...` if it needs editing.

The `buildings` table stores extended fields (floors, entrances, walk time, landmarks) inside a single `details` JSON column populated by the seed; the `users` table carries `oauth_provider` / `oauth_subject` columns to distinguish local from Google-linked accounts.

### Views

EJS templates in `views/`, with admin pages under `views/admin/` and shared fragments in `views/partials/` (`head`, `navbar`, `dash-navbar`, `footer`, `dash-footer`, `theme-toggle`). Because of the `res.locals.user` middleware, partials can assume `user` is in scope.

Sign-in and registration live on a single combined page at **`/auth`** (`views/auth.ejs`). The standalone `/login` and `/register` URLs are legacy and now just `302` to `/auth` (and `/auth#register`); there is no separate `login.ejs` / `register.ejs`.

## Conventions

- Route paths are defined inside each router file — `server.js` only handles mounts. The `/admin` prefix is the only non-trivial one.
- Admin JSON endpoints live alongside admin page renders in `routes/admin.js` under `/api/...` (so `/admin/api/users`, etc.). These rely on `wantsJson` in `roleAuth` returning true for `/api/` paths, so unauthenticated fetches get JSON instead of an HTML redirect.
- Controllers are split by feature, plus `adminUsersController` / `adminContentController` / `adminBuildingsController` for the admin CRUD APIs specifically.
- Profile data for each role lives in its own table (`student_profiles`, `instructor_profiles`, `guest_profiles`) keyed by `user_id` with `ON DELETE CASCADE`.
