<!-- DEPARTMENT NEWS RELEASE START -->
## Department News controlled release (October 21, 2026; in progress)

Read `docs/department-news-release-2026-10-21.md` first for the active release.
The owner authorized reviewed commit/push, staged Production checks, promotion
and scoped temporary fixtures. The owner completed additive Supabase migration
0029 after external backup validation; read-only checks preserved original data
and verified constraints and server-only RPC permissions. The normal website
still serves the dated 38fd296 release until staged acceptance and promotion.
The earlier local-only candidate notices and grounding prompts below are
historical implementation instructions, superseded for this explicit release.
Seven permanent accounts remain owner-created after release closure. No shared
MySQL migration, schedule cleanup or ICTU deployment is authorized.
<!-- DEPARTMENT NEWS RELEASE END -->

# CampuSphere Thesis Teammate Handoff

<!-- DEPARTMENT NEWS CANDIDATE START -->
## Local Department News candidate (2026-10-21; not deployed)

Read `docs/department-news-admin.md` first for the current local work on
`codex/department-news-admin`, based on `71946ab`. Department Administrators
are editor-only accounts, with shared editing across all seven departments and
University-wide posts. The candidate prepares migration 0029 and cache v54;
the published application below remains source 38fd296, cache v53 and prior
owner-applied migrations through 0028. This task authorizes local implementation
and isolated tests only: no commit, push, deployment, shared-database migration
or live account creation. Preserve protected files and dated release evidence.
<!-- DEPARTMENT NEWS CANDIDATE END -->


This guide is for a thesis teammate who receives the CampuSphere source code
and needs to understand it, discuss it in the paper, or ask Codex/Claude Code
specific questions. Start with `docs/current-authority.md`; it is the canonical
current-state summary. Older handoff and release blocks are retained for audit
history and may describe superseded states.

## Current source and handoff (2026-10-21)

Read docs/current-authority.md and docs/session-handoff-2026-10-21.md first.
Room Scheduling / Room Plotting removal and the later session fixes are released.
The last verified application baseline is 38fd296, deployment
dpl_86Lge98zAWnSKYbG7b14ef4uMpfF. These are dated release observations;
recompute live Git truth. Room descriptions and 73 private Info markers remain.
Cleanup, new features and deployment require their own focused owner task.

## What CampuSphere Is

CampuSphere is a CSPC virtual-campus web application built with Node.js,
Express 5, EJS, HTML, CSS, and browser JavaScript. Its main capabilities are:

- local and Google OAuth sign-in with four application roles;
- role-aware dashboards, profiles, announcements, and events;
- building discovery, room/facility information, and floor/room descriptions;
- administrator-authored 2D campus graph routing with distinct entry and exit
  lines, geometry-derived distance/walk time, and offline route packages;
- Pannellum-based 360 scenes and Guided VR navigation;
- administrator-managed building and panorama media references via
  Cloudinary or Google Drive;
- administrative content, user, building, route, and VR management.

Routes are selected from CampuSphere's stored graph and drawn from
administrator-authored `route_edges.path_geometry`. Google Maps, Google Earth,
Strava, SIS, and external routing engines are not integrated.

## Technology and Security Model

- **Runtime/UI:** Node.js `>=22`, Express 5, EJS, HTML5, CSS, and JavaScript.
- **Maps/VR:** Leaflet or MapLibre GL JS, OpenStreetMap/PMTiles, and Pannellum.
- **Data:** Supabase/PostgreSQL/PostGIS in Production; MySQL for local
  development, fallback, and rehearsal.
- **Authentication:** bcrypt local passwords, verified Google OAuth identities,
  and server-side `express-session`. Supabase Auth is not used.
- **Authorization:** Express login/role middleware and CSRF protection enforce
  per-user actions. Selected Supabase tables also use RLS and revoked browser
  grants; server repositories use the privileged service role, so RLS does not
  replace application authorization.
- **Browser protection:** Helmet applies a nonce-based Content Security Policy
  and related security headers. Rate limits use local memory outside Vercel and
  shared Upstash Redis on Vercel.
- **Media:** administrators paste validated Cloudinary or Drive links. The app
  performs no vendor upload or deletion. Drive media is proxied through the
  authenticated app and supports JPEG, PNG, and WebP—not HEIC/HEIF.

## Repository Map

```text
config/                 Runtime selection, database, sessions, and platform policy
controllers/            HTTP request and page/API behavior
database/schema.sql     MySQL schema
database/seed.js        Reproducible local MySQL seed
database/supabase/      Ordered PostgreSQL/PostGIS migrations and DB guidance
middleware/             Login, roles, CSRF, rate limiting, CSP/security headers
models/                 Reproducible seed/reference content
repositories/           MySQL/Supabase data-access boundaries
routes/                  Express route declarations
services/                Presence, sessions, routing/offline, and domain services
utils/                   Pure validation, geometry, media, and mapping helpers
views/                   EJS pages and partials
public/                  Browser JavaScript, CSS, images, vendor assets, PWA files
scripts/                 Quality gates and focused probes
server.js                Application entry point
```

Read current decisions in this order:

1. `AGENTS.md` and `CLAUDE.md` for repository working rules.
2. `docs/current-authority.md`,
   `docs/session-readiness-incident-2026-09-14.md`, and this guide.
3. `CODEX_HANDOFF.md`, `CLAUDE_HANDOFF.md`, `plan.md`, `ROADMAP.md`, and
   `README.md` for detailed history and sequencing.
4. `docs/deployment.md`, `docs/security-checklist.md`,
   `docs/test-evidence.md`, `docs/demo-script.md`, and
   `docs/offline-map-refresh.md` for domain-specific evidence and operations.
5. `database/supabase/README.md` and
   `database/supabase/REPOSITORY_BOUNDARIES.md` for data boundaries.

## Safe Local Setup

Prerequisites are Git, Node.js `>=22`, and npm. MySQL is optional unless the
teammate needs to run the local/fallback data path. A separately provided empty
Supabase project may also be used, but the team's live Supabase project is not
part of this handoff.

```bash
git clone <repository-url>
cd <repository-directory>
npm ci
```

Create a local `.env` only on the teammate's machine and never commit or share
it. The complete documented template is `.env.example`. Minimum local MySQL
names are `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, `PORT`, and
`SESSION_SECRET`. Google sign-in additionally uses `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`.

Runtime selection names include `SESSION_STORE`, `AUTH_DATA_SOURCE`,
`CONTENT_DATA_SOURCE`, `BUILDING_DATA_SOURCE`, `ROUTE_DATA_SOURCE`,
`VR_DATA_SOURCE`, and `MAP_RENDERER`. Supabase paths
also require server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
Production-only shared rate limiting uses `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN`, and `RATE_LIMIT_KEY_SECRET`. These are names only;
no real value is supplied with the handoff.

For a disposable local MySQL database, review `database/seed.js` before using:

```bash
node database/seed.js
npm start
```

Do not run the seed against a database containing data that must be preserved.
Do not apply any migration to the team's Supabase project. A new empty Supabase
project uses migration files `0001` through `0028` once, in numeric order, as
described in `database/supabase/README.md`.

Approved repository checks are documented in `package.json` and
`docs/test-evidence.md`. Some probes start bounded local servers or require
configured databases, so read their source and prerequisites before running
them. Never start `npm start`/`npm run dev` in an unattended foreground agent
session; repository automation uses the bounded server harness where required.

## What Is Not Included

The source handoff intentionally excludes:

- every `.env` file and all credentials, tokens, signing keys, cookies, and
  session data;
- the live Supabase database, private MySQL dumps, Production user/account
  data, and owner-managed regression credentials;
- Vercel, Supabase, Cloudinary, Google Drive, Google OAuth, Upstash, or GitHub
  organization/project access;
- vendor-managed media bytes that are referenced by URL;
- local screenshots, browser profiles, caches, `node_modules`, generated test
  artifacts, and owner-only offline-map publishing material.

The repository includes schemas, migrations, seed/reference content, and
application code. It does not reproduce the current live Production dataset.

## Current Work to Understand First

- `utils/routeGeometry.js`, `controllers/adminRouteController.js`, and
  `database/supabase/0027_route_edge_geometry_metrics.sql` implement automatic
  route distance/walk-time calculation and atomic directed-edge writes.
- `utils/mediaUrl.js`, `controllers/mediaController.js`, and `server.js`
  implement the validated Google Drive reference and authenticated proxy.
- `middleware/securityHeaders.js`, `middleware/roleAuth.js`, and
  `config/sessionConfig.js` show the browser, authorization, and session
  controls.
- `services/supabaseSessionStore.js`, `middleware/errorHandler.js`, and
  `scripts/vercelRuntimeSessionBootstrap-probe.js` show bounded session-touch
  retries and the completed-response guard.
- `services/offlineGuideService.js`, `public/js/offline-guide-manager.js`, and
  `public/sw.js` show offline package and PWA behavior.

## Asking Codex or Claude Code

Use the `## Portable Teammate Codex Grounding Prompt (source-only)` or
`## Portable Teammate Claude Code Grounding Prompt (source-only)` in
`docs/new-session-grounding-prompts.md`. The owner-continuity prompts in that
file are for the project owner, not an archive recipient. The teammate's first
turn is intentionally read-only so the assistant learns the repository before
answering.

Useful follow-up requests include:

- "Trace how an administrator-drawn route edge becomes a displayed route and
  cite the exact source files."
- "Explain the Supabase service-role/RLS boundary in thesis-friendly language."
- "Compare online routing, offline routing, and Guided VR without claiming an
  external routing API."
- "Explain how Google Drive media is validated and why HEIC is rejected."
- "Review this thesis paragraph against current source and identify inaccurate
  claims without editing files."

Ask the assistant to distinguish implementation facts from recorded tests,
owner observations, live database state, and independently verified Production
evidence. Tool availability never grants permission to access external systems.

## Handoff and Product Next Moves

Read `docs/current-authority.md`, `docs/session-handoff-2026-10-19.md`, and
`docs/walking-2d-release-2026-10-18.md` for the completed Walking 2D release.
Application baseline c533719 is on GitHub; the documentation commit advances
main separately. October 19 coverage is 26/26 saved paths, zero missing, without
claiming visual approval of every walkway. Editing/review instructions are in
`docs/walking-2d-team-guide.md`. Every device needs a connected guide refresh.

ICTU's Docker source includes the feature; its saved paths live in Supabase.
Using the same project reads those paths. A separate database needs an approved
schema/data transfer. No actual ICTU deployment is established by this handoff.
Keep source readiness, local tests, Production observations and client acceptance
separate. A fresh AI session uses the current role prompt, grounds read-only,
reports and waits for one owner-selected task. New panelist details are not yet
specified. Preserve local documents and never package credentials or live data.

Create a portable archive only from an approved committed SHA. `git archive`
excludes local output documents and checkout-local ignore rules. It cannot
verify live database, vendor, deployment or acceptance state.
