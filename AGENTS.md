# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

CampuSphere is an Express 5 + EJS server-rendered web app that delivers a virtual campus map tour for Camarines Sur Polytechnic Colleges (CSPC). Authentication uses session cookies (express-session) with bcrypt for local credentials and Google OAuth as a second sign-in path. Persistence is MySQL via `mysql2/promise` connection pool.

## Common Commands

```bash
npm start                  # Run server on PORT (default 3000) via node server.js
npm run dev                # Run with --watch for auto-restart on file changes
node database/seed.js      # Create DB, apply schema.sql, seed default users + content
```

There is no test framework, linter, or build step configured. `npm test` is a placeholder that exits 1.

The seed script creates a default admin (`admin@cspc.edu.ph` / `admin123`) and a sample student (`aaron.lasprillas@cspc.edu.ph` / `student123`). It connects without a database first and creates `campusphere_db` from `database/schema.sql`, so it can be re-run idempotently — every insert uses `INSERT IGNORE` or a pre-check on a natural key.

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

Two parallel auth-middleware modules exist and are both in active use:

- `middleware/requireLogin.js` — standalone function, used by `routes/dashboard.js`.
- `middleware/roleAuth.js` — exports `requireLogin`, `requireRole(...allowedRoles)`, and `attachUser`. `routes/admin.js` gates the entire `/admin` namespace with `router.use(requireRole('admin'))`.

If you add a role-restricted route, prefer `roleAuth.js` — it returns a 403 EJS render rather than a redirect when the user is logged in but lacks the role.

Roles: `student-cspc`, `instructor`, `admin`, `guest`. Each role has a different sidebar definition in `models/data.js` under `sidebarNav`.

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

## Conventions

- Route paths are defined inside each router file — `server.js` only handles mounts. The `/admin` prefix is the only non-trivial one.
- Admin JSON endpoints live alongside admin page renders in `routes/admin.js` under `/api/...` (so `/admin/api/users`, etc.).
- Controllers are split by feature, plus `adminUsersController` / `adminContentController` / `adminBuildingsController` for the admin CRUD APIs specifically.
- Profile data for each role lives in its own table (`student_profiles`, `instructor_profiles`, `guest_profiles`) keyed by `user_id` with `ON DELETE CASCADE`.
