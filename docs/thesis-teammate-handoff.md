# CampuSphere Thesis Teammate Handoff

This guide is for a thesis teammate who receives the CampuSphere source code
and needs to understand it, discuss it in the paper, or ask Codex/Claude Code
specific questions. Start with `docs/current-authority.md`; it is the canonical
current-state summary. Older handoff and release blocks are retained for audit
history and may describe superseded states.

## What CampuSphere Is

CampuSphere is a CSPC virtual-campus web application built with Node.js,
Express 5, EJS, HTML, CSS, and browser JavaScript. Its main capabilities are:

- local and Google OAuth sign-in with four application roles;
- role-aware dashboards, profiles, announcements, and events;
- building discovery, room/facility information, and private room schedules;
- administrator-authored 2D campus graph routing with distinct entry and exit
  lines, geometry-derived distance/walk time, and offline route packages;
- Pannellum-based 360 scenes and Guided VR navigation;
- administrator-managed building, schedule, and panorama media references via
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
2. `docs/current-authority.md` and this guide.
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
`VR_DATA_SOURCE`, `SCHEDULE_DATA_SOURCE`, and `MAP_RENDERER`. Supabase paths
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
project uses migration files `0001` through `0027` once, in numeric order, as
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

The handoff next move is owner review and separate commit/push authorization
for the synchronized documentation; a later source archive, if wanted, must be
created from a clean committed SHA with `git archive`. The separate product-
quality sequence is owner-authorized independent verification of the reported
promoted `8e6053e` Vercel deployment, supported end/expiry of the one observed
Supabase administrator session and an authorized gate rerun, a bounded
Production smoke, and then another owner-selected bug fix or feature.
