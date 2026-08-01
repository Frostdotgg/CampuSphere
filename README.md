# CampuSphere

CampuSphere is an Express 5 + EJS server-rendered web app that delivers a virtual campus map tour for **Camarines Sur Polytechnic Colleges (CSPC)**. It provides authenticated access for students, instructors, guests, and admins, with role-aware navigation, profile management, an interactive campus map, and an admin CRUD dashboard for users, news, events, and buildings.

## Features

- Server-rendered EJS views with shared partials (`head`, `navbar`, `dash-navbar`, `footer`).
- Session-based authentication (`express-session` + `bcrypt`) with Google OAuth as a second sign-in path.
- Role-based access control (`student-cspc`, `instructor`, `admin`, `guest`) via `middleware/roleAuth.js`.
- Domain-to-role mapping at OAuth registration (`@my.cspc.edu.ph` → student, `@cspc.edu.ph` → instructor, `@gmail.com` → guest).
- Admin namespace at `/admin` with JSON CRUD endpoints under `/admin/api/*` for users, news, events, and buildings.
- MySQL persistence via a shared `mysql2/promise` pool (`config/db.js`).
- Idempotent seed script that creates the database, applies the schema, and inserts default content.

## Tech Stack

- **Runtime:** Node.js
- **Server:** Express 5
- **Views:** EJS
- **Database:** MySQL (`mysql2/promise`)
- **Auth:** `express-session`, `bcrypt`, Google OAuth 2.0
- **Config:** `dotenv`

## Project Structure

```
.
├── config/              # DB pool and other config
├── controllers/         # Feature controllers (auth, profile, map, admin*)
├── database/            # schema.sql + seed.js
├── middleware/          # roleAuth, requireLogin
├── models/              # Static data used by the seed script
├── public/              # Static assets (css, js, images)
├── routes/              # Route modules mounted in server.js
├── views/               # EJS templates (admin/, partials/)
└── server.js            # App entrypoint
```

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- MySQL running locally (or reachable via env vars)

### Installation

```bash
git clone <repo-url>
cd "CampuSphere v1"
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```
SESSION_SECRET=replace-with-a-long-random-string
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=campusphere_db
PORT=3000

# Optional — required for Google sign-in
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
```

If `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` is missing, the OAuth flow is silently disabled and `/auth/google` redirects back to `/auth?error=oauth_failed`.

#### Supabase (cloud data target)

CampuSphere runs against **MySQL** (default and fallback) and/or **Supabase/PostgreSQL**, selected per domain at runtime by the `*_DATA_SOURCE` switches (read by `config/authDataSource.js`, `config/contentDataSource.js`, `config/vrDataSource.js`, `config/scheduleDataSource.js`, and `config/mapRuntime.js`). When a switch is set to `supabase`, the matching controllers read through the **server-only** Supabase client (`config/supabase.js`) and the `repositories/` layer; otherwise the MySQL path runs unchanged. The schema + migrations under `database/supabase/` (`0001` through `0019`, all owner-applied) are the migration source of truth - see **[docs/deployment.md](docs/deployment.md)** for env vars and apply order. Migrations `0011_supabase_session_store.sql`, `0012_room_schedules.sql`, and `0013_vr_hotspot_schedule_metadata.sql` provide Supabase sessions and real admin-managed room scheduling; migrations `0014`-`0019` provide the verified road graph, owner-managed edge geometry, atomic admin geometry writes, the authoritative Guard House topology, the CAS baseline, and selected-demo parity. The refreshed additive candidate graph has 21 nodes, 50 directed edges, 25 reverse pairs, 50 valid geometries, and 13 routable building destinations in both backends. The 13 buildings are the selected demo roster, not the complete campus; `config/selectedDemoFreeze.js` freezes their QA evidence without disabling normal admin edits or future reviewed additions.

Destination routes are computed from CampuSphere's own campus graph and drawn from owner-managed road geometry. Google Maps, Google Earth, Strava, SIS, and external routing engines are not integrated. Guided VR only reports arrival when mapped scene coverage reaches the selected destination; incomplete coverage ends with an explicit notice. Room schedules remain real admin-managed data, not enrollment or instructor-load simulation.

```
# Supabase (server-only; enable per-domain via *_DATA_SOURCE switches)
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-with-server-only-service-role-key

# Optional - only if a future browser-safe read path is explicitly approved
# SUPABASE_ANON_KEY=replace-with-anon-key
```

Rules:

- MySQL is the default and fallback. Supabase is enabled **per domain at runtime** via the `*_DATA_SOURCE` switches; the `supabase` modes require `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
- Supabase access is **server-side only**. Express code may read these via `process.env`; browser code must never see them.
- The **value** of `SUPABASE_SERVICE_ROLE_KEY` must never appear in EJS templates, anything under `public/`, a `window` global, screenshots, or any committed file. The variable name itself can appear in docs (including this README) and in `.env.example` with a placeholder; the real key value belongs only in an untracked local `.env` and in the deployment environment. Treat the value like a database root password.
- **Supabase Auth is not used.** CampuSphere keeps Express session auth and the existing Google OAuth flow (see `controllers/authController.js`).
- **Cloudinary** media-delivery variables are **server-only** and documented in the **Cloudinary** subsection below.

Connectivity smoke check (read-only, safe to run repeatedly):

```bash
node scripts/supabase-smoke.js
```

The script SKIPs cleanly and exits 0 if the Supabase env vars are unset **and** Supabase is not the selected session store, so it is also safe to run on a developer machine that has not yet configured Supabase. When the env vars are set, it issues a single `system_settings.select('setting_key').limit(1)` query and prints PASS or FAIL. When `SESSION_STORE=supabase` is selected, missing Supabase env makes it **fail closed** (not skip) and it additionally checks that the `app_sessions` table (migration `0011`) is reachable. It never logs the service role key or the project URL.

#### Cloudinary (media delivery target)

CampuSphere delivers campus images and 360° VR panoramas through **Cloudinary** (Milestone 10). Only delivery **metadata** is stored in the database (e.g. `image_url`, `cloudinary_public_id`); the credentials are **server-only** and read by server code (`config/cloudinary.js`) — never by the browser. Cloudinary is **optional**: when the variables are unset the app falls back to the local `/img/*` and `/img/vr/*` placeholders and keeps working (local dev, the MySQL fallback, and the Supabase runtime are unaffected).

```
# Cloudinary (server-only; media delivery)
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=replace-with-server-only-api-key
CLOUDINARY_API_SECRET=replace-with-server-only-api-secret
```

Rules:

- `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` are **secrets** — treat them like `SUPABASE_SERVICE_ROLE_KEY`. Their **values** (and any signed-upload data) must never appear in EJS templates, anything under `public/`, a `window` global, `res.locals`/`app.locals`, response JSON, logs, screenshots, or any committed file; the variable **names** may appear in docs and in `.env.example` with placeholders only. The real values belong only in an untracked local `.env` and in the deployment environment.
- `CLOUDINARY_CLOUD_NAME` is **public** delivery metadata (it appears in every `https://res.cloudinary.com/<cloud_name>/…` URL); it is kept with the server-only config for convenience.
- **Asset upload and credential entry are owner-controlled** and done outside the app (the Cloudinary dashboard). CampuSphere has **no** browser direct-upload, unsigned-upload preset, or Cloudinary Admin API flow.
- **The Cloudinary media path is live (Sections 10.4–10.6):** `image_url` is validated server-side (`utils/mediaUrl.js` — a safe local `/img/` path or an `https://res.cloudinary.com/…` URL only; everything else rejected); the CSP allows `res.cloudinary.com` for **media delivery only** (`img-src`/`media-src`, plus `connect-src` because Pannellum XHR-loads the panorama — **never** `script-src`); the service worker may bounded-cache approved Cloudinary media but **never** caches authenticated HTML or mirrors `/img/vr/*`; the VR viewer renders a sanitized Cloudinary panorama where configured and otherwise falls back to the placeholder/offline message; and admins can store/update `image_url` + `cloudinary_public_id` on buildings and VR scenes.
- `cloudinary_public_id` is **admin/server metadata only** — it never appears in public or runtime responses (e.g. `/api/buildings`, `/vr`, `/api/vr/routes/*`).
- Uploading the final 360 panoramas is **owner-controlled** asset work (validated at the Milestone 10 end-to-end gate), **not** an app feature.

### Database Setup

The seed script creates `campusphere_db`, applies `database/schema.sql`, and inserts default users and content. It is safe to re-run.

```bash
node database/seed.js
```

Default accounts after seeding (**local MySQL development only**): the seed
creates a deterministic admin and sample-student fixture whose local-only
values live in `database/seed.js` and the shared test-only loader
(`scripts/regressionCredentials.js`). They are deliberately **not** listed in
documentation and are **not** valid live credentials — the live regression
accounts use private owner-managed replacement passwords.

Live/Supabase regression sign-ins never use documented or hardcoded values.
Authorized probes read the test-only variables
`SUPABASE_REGRESSION_ADMIN_EMAIL` / `SUPABASE_REGRESSION_ADMIN_PASSWORD`,
`SUPABASE_REGRESSION_STUDENT_EMAIL` / `SUPABASE_REGRESSION_STUDENT_PASSWORD`,
`SUPABASE_REGRESSION_INSTRUCTOR_EMAIL` /
`SUPABASE_REGRESSION_INSTRUCTOR_PASSWORD`, and
`SUPABASE_REGRESSION_GUEST_EMAIL` / `SUPABASE_REGRESSION_GUEST_PASSWORD` from
the ignored local `.env` (names documented in `.env.example`; values are never
committed, printed, or recorded anywhere in the repository). Missing or blank
values make Supabase-mode probes fail closed instead of falling back.

#### Deployment: identity-constraint checks (R8)

The seed adds MySQL UNIQUE keys for one role-profile row per user and for unique
non-null `(oauth_provider, oauth_subject)` pairs, matching the Supabase schema.
On a database that already holds duplicate identity rows, the seed normally
skips the affected key with a warning so local seeding stays non-destructive.

For deployment, run the seed in **strict mode** so a duplicate that would block a
constraint fails the seed instead of skipping (strict mode is also implied when
`NODE_ENV=production`):

```bash
SEED_STRICT_CONSTRAINTS=true node database/seed.js
```

Then run the read-only verifier as a deployment gate. It confirms the four
MySQL unique indexes exist with zero duplicate groups and that Supabase enforces
the equivalent constraints. It exits `0` only when every check passes:

```bash
node scripts/verify-identity-constraints.js
```

### Running

```bash
npm start        # Production-style run
npm run dev      # node --watch for auto-restart
```

The server listens on `PORT` (default `3000`).

## Deployment

See **[docs/deployment.md](docs/deployment.md)** for the full deployment and
environment guide: every required env var, server-only secret handling, the
Supabase SQL apply order (`0001`–`0019`), MySQL fallback seed steps, production
session/cookie/proxy policy, CSRF/rate-limit/Helmet/PWA boundaries, OAuth
redirect-URI variants, the QA gates, and troubleshooting. Container packaging is
provided by `Dockerfile`, `.dockerignore`, and a local-rehearsal
`docker-compose.yml` (app + MySQL); secrets are supplied at **runtime only** and
are never baked into the image.

Defense/test artifacts live in `docs/`: [test evidence checklist](docs/test-evidence.md),
[demo script](docs/demo-script.md), [security checklist](docs/security-checklist.md),
[usability survey](docs/usability-survey.md), and [reset notes](docs/reset-demo.md).
These files are templates only; do not commit real screenshots, cookies, session
IDs, service-role keys, OAuth secrets, database passwords, raw logs, or private
production data.

## Authentication

Sign-in and registration live on a single combined page at `/auth`. The standalone `/login` and `/register` URLs are legacy and `302` redirect to `/auth` (and `/auth#register`).

Admin accounts cannot be created through OAuth — they must be inserted via the seed script or directly in the database.

### Registration trust policy (Milestone 8, Section 8.6)

- **Local email/password sign-up (`POST /register`) is guest-only.** A requested
  `student-cspc`, `instructor`, `admin`, unknown, or blank role is rejected — never
  silently downgraded to guest.
- **`student-cspc` and `instructor` roles require verified Google OAuth** domain
  mapping (`@my.cspc.edu.ph` → student, `@cspc.edu.ph` → instructor, `@gmail.com`
  → guest), seed data, or admin-managed user creation.
- **Admin creation remains seed/admin-only** and is never self-registerable via
  local sign-up or OAuth.
- Defense in depth: in Supabase mode the SQL function `app_create_local_user`
  (migration `0009`) also rejects any non-guest role.

## Production session, cookies & secret rotation (Milestone 8)

Sessions use `express-session`. The runtime policy is resolved and validated at
startup by `config/sessionConfig.js`, which **fails closed in production**:

- **Store** — `SESSION_STORE` defaults to `supabase` in production (the preferred
  persistent store in `services/supabaseSessionStore.js`, table
  `public.app_sessions`, created by migration `0011_supabase_session_store.sql`)
  and `memory` outside production. `mysql` (`services/mysqlSessionStore.js`, table
  `app_sessions`, created at startup if missing) remains the explicit
  fallback / local-rehearsal persistent store. `SESSION_STORE=memory` in
  production refuses to start (as does any unknown value); the in-memory store is a
  documented local-dev fallback only (single-process, lost on restart). The
  Supabase session store is **server-only** (`SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY`); **Supabase Auth is still not used** — only the
  `app_sessions` table backs Express sessions.
- **Secret** — production requires `SESSION_SECRET` to be set, ≥32 chars, and not
  a known placeholder, or the server exits. Rotate by moving the old value into
  `SESSION_SECRET_PREVIOUS` (comma-separated) and setting a new `SESSION_SECRET`:
  the current secret signs new cookies; previous values only verify old ones. In
  production every `SESSION_SECRET_PREVIOUS` value must also be non-placeholder and
  ≥32 chars, or the server exits.
- **Cookie** — `httpOnly`, `SameSite=Lax`, `Path=/`, no `Domain`; name/secure by
  environment: production `__Host-campusphere.sid` + `Secure`, development
  `campusphere.sid` (not secure). Lifetime defaults to 24h
  (`SESSION_COOKIE_MAX_AGE_MS` to override).
- **Proxy** — `TRUST_PROXY` (non-negative integer; production default 1). Behind
  TLS termination, the proxy must forward `X-Forwarded-Proto=https` so the Secure
  `__Host-` cookie is issued. An invalid value fails production startup.

The Supabase session store lives in Postgres, so it is shared across instances and
supports multi-instance / serverless hosting (e.g. the Vercel demo/UAT target); the
MySQL store is single-process oriented and is the fallback / local-rehearsal path.
See `.env.example` and `docs/deployment.md` for every variable and the apply order.

## Admin

The `/admin` namespace is gated by `requireRole('admin')`. Page renders live alongside JSON CRUD endpoints under `/admin/api/*`, which return clean `401`/`403` JSON responses to unauthenticated fetches (HTML routes redirect to `/auth` instead).

## License

ISC — see `package.json`.

## Author

Team Dutchess
