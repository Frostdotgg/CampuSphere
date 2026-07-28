# Migration Checklist

Order, per-group checks, security rules, and Milestone 2 entry
criteria for cutting CampuSphere's runtime persistence from MySQL
(`config/db.js`) over to Supabase / PostgreSQL / PostGIS, one
feature at a time.

Milestone 1, Phase 5, Section 5.3. Documentation only - no
controllers, routes, views, middleware, models, server.js,
config files, schema.sql, seed.js, or Supabase SQL/seed files
change in this section.

This document is a sibling of `REPOSITORY_BOUNDARIES.md` (Section
5.1) and the repository stubs under `repositories/` (Section 5.2).
It does not redefine the boundaries; it tells future migration
work in what order to consume them and what must be true after
each step.

## 0. Ground rules (apply to every migration group)

These hold for the entire MySQL -> Supabase cutover, not just one
group.

- Execute one migration group at a time. Stop after each group,
  verify, then move to the next group. Do not bundle two groups
  in a single change.
- Preserve the dirty git worktree. Do not stage, commit, stash,
  clean, reset, delete, or revert anything during a migration
  group unless the user explicitly asks.
- Keep `config/db.js` (the MySQL pool) importable and functional
  for the duration of the migration. Each group flips exactly
  one feature off MySQL and onto Supabase; nothing else.
- API response shapes, EJS locals, and `req.session.user` shape
  stay frozen. See `REPOSITORY_BOUNDARIES.md` section 4. If a
  field must change, that is a separate change with its own
  review, not part of a backend swap.
- Repositories accept pre-validated values. Validation
  (`adminContentController.js` category/audience allowlists,
  `adminBuildingsController.js` `validateDetails`/`validateCoord`,
  `profileController.js` `IMMUTABLE_FIELDS`) stays in the
  controller layer.
- Run `node --check` on every file edited in the group. Do not
  rely on `npm test` (placeholder; exits 1).
- The MySQL fallback path remains available throughout. A group
  is not "done" until both the new Supabase path and the old
  MySQL path can be reached by a documented switch (env flag or
  explicit feature toggle decided when the group starts).

## 1. Migration order

The order below matches `plan.md` Section 5.3 and is fixed; do
not reorder for convenience.

1. users / profiles
2. buildings / admin building CRUD
3. map / search / routes
4. announcements / events / dashboard
5. VR scenes / hotspots

Rationale (one line each):

- Users first because every other feature reads `req.session.user`;
  if hydration breaks, nothing else loads.
- Buildings next because `/buildings`, `/map`, the admin map page,
  and the VR route launch all decorate building rows.
- Map / search / routes after buildings, because route summaries
  join `campus_routes.destination_building_id` -> `buildings`.
- Announcements / events / dashboard after routes, because the
  dashboard already depends on a working user session AND on
  building/map shortcuts that earlier groups stabilise.
- VR last because it depends on routes (graph, route_nodes,
  campus_routes) and on buildings (scene `building_id`), and has
  the largest fallback surface (missing panoramas already
  expected).

## 2. Per-group checklist

Each group below lists the target repository module(s), the
current controller/route files involved, the API/EJS contract
that must not change, the role/access checks that must remain in
force, the minimum static checks, the minimum manual browser
checks, and the rollback/fallback expectation while the MySQL
pool still exists.

### 2.1 Users and profiles

- Target repository module(s):
  - `repositories/userRepository.js`
- Current controller / route files involved:
  - `controllers/authController.js` (registerPost, loginPost,
    googleCallback, completeRegistrationPost,
    hydrateSessionUser, loadRoleProfileIntoSession,
    createOAuthUserWithProfile, findUserByEmail)
  - `controllers/profileController.js` (updateProfile)
  - `controllers/dashboardController.js` (student/instructor
    profile fetch)
  - `controllers/adminController.js` (index recent users + total
    user/student counts; users page list + active/new stats)
  - `controllers/adminUsersController.js` (createUser, updateUser,
    deleteUser)
  - `routes/auth.js`, `routes/dashboard.js`, `routes/admin.js`
- API response shapes that must not change:
  - `/admin/api/users` create/update/delete responses
    (`{ success, message, ... }`).
  - `/auth/complete-registration` redirect behaviour and
    `pendingOAuthRegistration` session field clearing.
- EJS locals that must not change:
  - `user` (everywhere via `res.locals.user`), including
    role-specific fields merged in by
    `loadRoleProfileIntoSession` (student_id_number / course /
    year_level, employee_id / department / position,
    address / phone_number).
  - `studentProfile` / `instructorProfile` consumed by
    `views/dashboard.ejs`.
  - `views/admin/users.ejs` table rows and stat numbers.
- Role / access checks to preserve:
  - `middleware/roleAuth.js` `requireLogin` on dashboard /
    profile.
  - `routes/admin.js` `router.use(requireRole('admin'))` on the
    entire `/admin` namespace.
  - `IMMUTABLE_FIELDS` rule in `profileController.js` (role,
    email, id, password cannot be updated through the profile
    form).
  - OAuth domain-to-role mapping in
    `authController.getRoleFromEmail()` stays exact-match
    (`@my.cspc.edu.ph`, `@cspc.edu.ph`, `@gmail.com`); admin via
    OAuth remains rejected.
- Minimum syntax checks (run after the group's last edit):
  - `node --check controllers/authController.js`
  - `node --check controllers/profileController.js`
  - `node --check controllers/dashboardController.js`
  - `node --check controllers/adminController.js`
  - `node --check controllers/adminUsersController.js`
  - `node --check repositories/userRepository.js`
- Minimum manual browser checks:
  - Local login as the regression admin succeeds and lands on the
    admin dashboard (local MySQL: deterministic seed fixture in
    `database/seed.js`; Supabase: the test-only
    `SUPABASE_REGRESSION_ADMIN_*` env from the ignored local
    `.env` — values are never recorded in documentation).
  - Local login as the sample student succeeds and lands on the
    student dashboard with the merged role profile fields visible
    (same rule: seed fixture locally, test-only
    `SUPABASE_REGRESSION_STUDENT_*` env for Supabase).
  - Google OAuth path: with valid `.env`, the OAuth callback
    reaches `/auth/complete-registration` for a new account and
    successfully writes the `users` row + role profile row.
  - Profile update via `controllers/profileController.js`
    persists across logout/login.
  - `/admin/users` lists users; create / edit / delete a test
    user via `/admin/api/users` (admin only).
  - Non-admin direct hit on `/admin/api/users` returns JSON 401
    or 403 via `wantsJson` branch in `roleAuth`.
- Rollback / fallback expectation:
  - Keep the MySQL-backed code path reachable behind the
    group's feature toggle (env flag decided at group start).
    If Supabase responds with an error or the toggle is off, the
    request falls through to the existing `db.query(...)` path
    without exposing repository errors to the user.
  - Reverting the group is a single-file revert of
    `repositories/userRepository.js` plus its consumers in
    `authController.js` / `profileController.js` /
    `dashboardController.js` / `adminController.js` /
    `adminUsersController.js`. No schema change is required
    because Supabase tables match the existing MySQL shape (see
    `0001_initial_schema.sql` section B.1).

### 2.2 Buildings and admin building CRUD

- Target repository module(s):
  - `repositories/buildingRepository.js`
- Current controller / route files involved:
  - `controllers/buildingsController.js` (index, apiList)
  - `controllers/mapController.js` (index, apiSearch building
    decoration only)
  - `controllers/adminBuildingsController.js` (createBuilding,
    updateBuilding, deleteBuilding)
  - `controllers/adminController.js` (totalBuildings,
    campus-map page)
  - `controllers/vrController.js` (`resolveRouteScenes` reads
    building id / name only)
  - `routes/buildings.js`, `routes/map.js`, `routes/admin.js`
- API response shapes that must not change:
  - `/api/buildings` JSON shape.
  - `/admin/api/buildings*` create/update/delete responses.
  - Buildings decorated with `vr_route_id` keep that field name
    and integer / null typing on both `/buildings` and `/map`.
- EJS locals that must not change:
  - `buildings` on `views/buildings.ejs`, `views/map.ejs`, and
    `views/admin/campus-map.ejs` (or current equivalent admin
    map view).
  - `building.details` remains a parsed object (not a raw
    string) at the controller boundary;
    `utils/buildingData.normalizeBuildingRows` stays in place.
- Role / access checks to preserve:
  - Read paths gated by `requireLogin`.
  - Write paths gated by `requireRole('admin')` on
    `/admin/api/buildings*`.
  - Server-side `validateDetails` / `validateCoord` in
    `adminBuildingsController.js` continue to run before any
    repository write call.
- Minimum syntax checks:
  - `node --check controllers/buildingsController.js`
  - `node --check controllers/mapController.js`
  - `node --check controllers/adminBuildingsController.js`
  - `node --check controllers/adminController.js`
  - `node --check repositories/buildingRepository.js`
- Minimum manual browser checks:
  - `/buildings` and `/map` show the same building set after an
    admin edit; refresh both pages.
  - Admin create / edit / delete a test building, verify it
    appears / disappears on both `/buildings` and `/map`.
  - `vr_route_id` decoration is present for the four routed
    destinations (Administration Building, CCS, Library,
    Gymnasium) and absent for others; Start VR Route buttons
    render accordingly.
  - Invalid `details` JSON or out-of-range coordinates from the
    admin form are rejected before any DB write.
  - Mobile viewport (~390px) - building details panel docks to
    one side and does not cover the selected marker.
- Rollback / fallback expectation:
  - Feature toggle off -> existing MySQL queries continue to
    serve `/buildings`, `/map`, and the admin CRUD path. PostGIS
    `location` column is populated by the Supabase seed and is
    NOT read by the UI yet, so toggling does not require a
    schema change.
  - Reverting the group only touches building controllers and
    `repositories/buildingRepository.js`; routes, views, and
    `utils/buildingData.js` stay unchanged.

### 2.3 Map / search / routes

- Target repository module(s):
  - `repositories/routeRepository.js`
  - `repositories/buildingRepository.js`
    (`listVrRouteIdByBuilding` is shared between buildings and
    map; per `REPOSITORY_BOUNDARIES.md` section 8, the canonical
    implementation lives in `routeRepository` and
    `buildingRepository` delegates).
- Current controller / route files involved:
  - `controllers/mapController.js` (`fetchRouteSummaries`,
    `attachStepsToRoutes`, `apiPathfind`, vr_route_id helper,
    `apiSearch`)
  - `controllers/buildingsController.js` (vr_route_id helper
    consumer)
  - `controllers/vrController.js` (`resolveRouteScenes` graph
    load)
  - `routes/map.js`, `routes/buildings.js`, `routes/vr.js`
  - `utils/pathfinding.js` (pure; must not change)
- API response shapes that must not change:
  - `/api/search` result rows.
  - `/api/routes` and `/api/routes/:id` summary + steps shape.
  - `/api/pathfind` `{ path, totalDistance, totalWalkTimeSeconds, ... }`.
  - `/api/vr/routes/:routeId` JSON shape.
- EJS locals that must not change:
  - `views/map.ejs` route planner / route summary modal data.
  - `views/vr-route.ejs` `route`, `scene`, `scenes`, `hotspots`,
    `currentStep`, `totalSteps`, `isFinalStep`, `prevUrl`,
    `nextUrl`, `notice`.
- Role / access checks to preserve:
  - All `/api/*` routes behind `requireLogin`.
  - No admin CRUD for the graph today; do not add one in this
    group.
  - `route_edges` rows remain DIRECTED (the seed inserts both
    A->B and B->A); `utils/pathfinding.js` depends on this.
- Minimum syntax checks:
  - `node --check controllers/mapController.js`
  - `node --check controllers/buildingsController.js`
  - `node --check controllers/vrController.js`
  - `node --check utils/pathfinding.js`
  - `node --check repositories/routeRepository.js`
  - `node --check repositories/buildingRepository.js`
- Minimum manual browser checks:
  - `/map` search returns hits for a known building name, an
    office / service substring, and a route label.
  - Select start + destination on `/map`; route summary modal
    opens and lists ordered steps.
  - `/api/pathfind` returns a 4xx for unknown node keys / building
    ids and a valid path object for a known main-gate ->
    destination pair.
  - Start VR Route from `/map` and `/buildings` for the four
    routed destinations opens `/vr/routes/<id>` without console
    errors.
- Rollback / fallback expectation:
  - Feature toggle off -> MySQL pool serves
    `fetchRouteSummaries`, `attachStepsToRoutes`,
    `listAllNodes`, `listAllEdges` as today. Pathfinding is
    backend-agnostic because `utils/pathfinding.js` only sees
    arrays.
  - Reverting the group only touches the map / VR / buildings
    controllers plus `routeRepository` and the
    `listVrRouteIdByBuilding` consumer in
    `buildingRepository`.

### 2.4 Announcements / events / dashboard

- Target repository module(s):
  - `repositories/contentRepository.js`
- Current controller / route files involved:
  - `controllers/dashboardController.js` (audience-filtered
    announcements)
  - `controllers/eventsController.js` (`/events` index;
    ascending `event_date`)
  - `controllers/adminContentController.js` (news + events
    CRUD)
  - `controllers/adminController.js` (recent news + totalNews on
    admin dashboard; news page articles + events + stats)
  - `routes/dashboard.js`, `routes/events.js`, `routes/admin.js`
- API response shapes that must not change:
  - `/admin/api/news` and `/admin/api/events` create/update/delete
    responses (consumed by `public/js/admin/admin-news.js`).
  - Audience field values on announcements remain restricted to
    the allowlist (`all`, `student-cspc`, `instructor`, `guest`,
    `admin`).
- EJS locals that must not change:
  - `news`, `announcements`, or whichever name `views/dashboard.ejs`
    uses today for the audience-filtered list.
  - `events` on `views/events.ejs` keeps its reshaped
    `{ id, title, category, dateObj, desc, location, time }`
    fields (reshape stays in the controller).
  - `views/admin/news.ejs` articles + events + stats numbers.
- Role / access checks to preserve:
  - Dashboard reads only published announcements
    (`published_date IS NOT NULL`) matching `audience = 'all'
    OR audience = role`.
  - Admin write paths under `requireRole('admin')`.
  - Server-side category / audience allowlists in
    `adminContentController.js` keep gating writes before any
    repository call.
- Minimum syntax checks:
  - `node --check controllers/dashboardController.js`
  - `node --check controllers/eventsController.js`
  - `node --check controllers/adminContentController.js`
  - `node --check controllers/adminController.js`
  - `node --check repositories/contentRepository.js`
- Minimum manual browser checks:
  - Student dashboard shows announcements with `audience = 'all'`
    or `audience = 'student-cspc'`, and no drafts.
  - Instructor dashboard shows `'all'` + `'instructor'`; guest
    dashboard shows `'all'` + `'guest'`.
  - Admin creates / edits / deletes a news article and an event
    via `/admin/api/news` and `/admin/api/events`; the new row
    appears on the dashboard (after `published_date`) and
    `/events`.
  - Public `/events` orders events ascending by date.
- Rollback / fallback expectation:
  - Feature toggle off -> MySQL pool continues to serve the
    dashboard, `/events`, and admin news CRUD. Audience values
    are identical between MySQL ENUM (or CHECK) and Postgres
    CHECK, so toggling does not require a data migration.
  - Reverting the group only touches the four content-related
    controllers plus `repositories/contentRepository.js`.

### 2.5 VR scenes and hotspots

- Target repository module(s):
  - `repositories/vrRepository.js`
- Current controller / route files involved:
  - `controllers/vrController.js` (`viewer`, `routeViewer`,
    `apiRoute`, `loadSceneHotspots`, `resolveRouteScenes`)
  - `routes/vr.js`
- API response shapes that must not change:
  - `/api/vr/routes/:routeId` JSON shape, including hotspot
    fields and `target_scene_key` / `target_title` carried
    through the LEFT JOIN that `loadSceneHotspots` performs
    today.
- EJS locals that must not change:
  - `views/vr.ejs`: `scene`, `scenes`, `hotspots`, `sceneIndex`,
    `sceneCount`, `notice`.
  - `views/vr-route.ejs`: `route`, `scene`, `scenes`,
    `hotspots`, `currentStep`, `totalSteps`, `isFinalStep`,
    `prevUrl`, `nextUrl`, `notice`.
- Role / access checks to preserve:
  - `/vr`, `/vr/:sceneKey`, `/vr/routes/:routeId`, and
    `/api/vr/routes/:routeId` all behind `requireLogin`.
  - Anonymous visitors still redirect to `/auth`; authenticated
    `guest` accounts can open VR.
  - `routes/vr.js` order rule: `/vr/routes/:routeId` and
    `/api/vr/routes/:routeId` stay BEFORE `/vr/:sceneKey`
    (HANDOFF.md section 9).
- Minimum syntax checks:
  - `node --check controllers/vrController.js`
  - `node --check routes/vr.js`
  - `node --check repositories/vrRepository.js`
- Minimum manual browser checks:
  - `/vr` loads as logged-in student / instructor / guest.
  - `/vr/routes/<id>` Next / Previous / completion banner work
    for a seeded route.
  - Missing-panorama fallback still renders ("360 image not
    available yet") instead of a broken viewer.
  - Back to Map link remains clickable from
    `/vr/routes/<id>`.
- Rollback / fallback expectation:
  - Feature toggle off -> MySQL pool continues to serve VR
    scene + hotspot lookups. `vr_scenes.cloudinary_public_id`
    remains NULL on every row; no Cloudinary dependency is
    introduced by this group.
  - Reverting the group only touches `vrController.js` and
    `repositories/vrRepository.js`. The viewer (Pannellum CDN)
    and the fallback UI stay unchanged.

## 3. Security rules (apply to all groups)

These are non-negotiable and mirror `REPOSITORY_BOUNDARIES.md`
section 4 plus the project direction in `plan.md`.

- Supabase access is server-side only. The only Supabase client
  in the codebase is `config/supabase.js`; controllers obtain it
  through repository modules and never import it directly from
  EJS templates, anything under `public/`, browser globals,
  middleware that touches `res.locals`, or `app.locals`.
- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed through:
  - EJS templates (no `<%= ... %>` of the key or any object that
    contains it),
  - public JavaScript under `public/`,
  - browser globals (no `window.__SUPABASE_*`),
  - committed files (no values in `.env`, only the variable
    name in `.env.example` and docs),
  - `res.locals` (the middleware that copies session user is
    the only thing allowed to write `res.locals`),
  - `app.locals`,
  - screenshots, error pages, or log output.
- Do not switch to Supabase Auth. Express `express-session`
  cookies remain the session mechanism; bcrypt local login and
  the existing Google OAuth flow (`controllers/authController.js`)
  remain the only sign-in paths.
- The `users` table remains the identity record. No code path
  reads or writes Supabase Auth tables.
- Admin role creation stays seed-only / direct-DB-only. No
  controller, repository, or admin API exposes a "set role =
  admin" path through OAuth or the public form.
- Repositories never see `req` or `res`. They do not call
  `res.status()`, `res.json()`, or `res.render()`, and they do
  not read `req.session`. Role decisions and HTTP status codes
  stay in the controller layer.
- Validation stays in controllers: category / audience allowlist
  in `adminContentController.js`, `validateDetails` /
  `validateCoord` in `adminBuildingsController.js`,
  `IMMUTABLE_FIELDS` in `profileController.js`. Repositories
  accept pre-validated values and do not re-implement these
  checks loosely.

## 4. Milestone 2 entry criteria

Runtime persistence migration (Milestone 2) does NOT start until
all of the following are true. Each item is a hard gate, not a
recommendation.

1. Phase 6 verification (Sections 6.1 - 6.5 in `plan.md`) has
   finished, OR each unresolved blocker from Phase 6 has been
   explicitly accepted by the team with a written rationale.
2. The current MySQL app still runs end-to-end: `npm start`
   serves `/`, `/auth`, `/dashboard`, `/buildings`, `/map`,
   `/events`, `/vr`, and `/admin` (admin-only); seed via
   `node database/seed.js` is idempotent against a clean
   `campusphere_db`.
3. Repository stubs under `repositories/` remain unused by any
   controller. Grep evidence (no `require('../repositories/`
   import in `controllers/`, `routes/`, `middleware/`,
   `server.js`) must be recorded in the Milestone 1 go/no-go
   report.
4. `database/supabase/0001_initial_schema.sql` and
   `database/supabase/0002_seed_data.sql` apply cleanly to a
   disposable Supabase project, OR Phase 6 has accepted that
   gate as deferred with rationale.
5. `config/supabase.js` continues to NOT be imported by EJS,
   public JS, middleware that touches `res.locals`, or
   `app.locals`. A repository module is the only allowed
   caller, and only after that repository's group starts.
6. The five repository files
   (`userRepository.js`, `buildingRepository.js`,
   `contentRepository.js`, `routeRepository.js`,
   `vrRepository.js`) still throw `NotImplemented:
   <module>.<method>` for every exported function. Section 5.2
   stubs are intact.
7. `node --check` passes for every controller, route,
   middleware, and repository file listed in section 2 above.

When all seven are true, Milestone 2 begins with Section 2.1
(users / profiles) and proceeds in the order in section 1.
Each group ends with a checkpoint review before the next group
starts.

## 5. What this section does NOT change

- No controller behaviour.
- No route registrations or order.
- No EJS template or partial.
- No middleware logic.
- No static asset under `public/`.
- No `server.js`, `config/db.js`, `config/supabase.js`,
  `package.json`, or `package-lock.json`.
- No `database/schema.sql` or `database/seed.js`.
- No file under `database/supabase/` other than this new
  `MIGRATION_CHECKLIST.md`.
- No repository stub under `repositories/`.

Running `node database/seed.js` is NOT required for this
section. No Supabase SQL apply or seed run is required for this
section. The current MySQL runtime remains the only live
backend.

## 6. Cross-reference

- `REPOSITORY_BOUNDARIES.md` (Section 5.1) - module names,
  callers, table ownership, invariants.
- `repositories/*.js` (Section 5.2) - read-only stubs that throw
  `NotImplemented` until a migration group switches them on.
- `0001_initial_schema.sql` - Supabase / PostGIS schema target.
- `0002_seed_data.sql`, `SEED_STRATEGY.md`, `SEED_VERIFICATION.md`
  - Supabase seed data and verification queries.
- `README.md` (under `database/supabase/`) - how to apply the
  migration and seed in a Supabase project.
- `plan.md` Section 5.3 - the plan entry this checklist
  satisfies.
- `plan.md` Phase 6 - the verification gates referenced in
  section 4 above.
