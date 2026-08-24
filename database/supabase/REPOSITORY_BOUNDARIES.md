# Repository Boundary Design

Design document for the data-access boundary that will be introduced
between CampuSphere's controllers and the database.

Milestone 1, Phase 5, Section 5.1.

## 1. Purpose

Today every controller speaks raw SQL through `config/db.js` (the
MySQL pool). To swap the runtime from MySQL to Supabase / PostgreSQL
one feature at a time (Milestone 2+), each feature needs a thin
repository module that the controller calls instead of `db.query(...)`.

This document **only fixes the boundaries** - file names, the methods
each module exposes, the tables each module owns, and the invariants
the migration must preserve. It does **not** add code. Section 5.2
will add minimal read-only stubs. The runtime continues to use MySQL
through `config/db.js` until later milestones intentionally cut over.

## 2. Scope (this section)

In scope:

- Naming the five repository modules required by `plan.md` Section 5.1.
- Listing the controller functions, MySQL tables, Supabase tables, and
  method responsibilities for each module.
- Stating the cross-module invariants the migration must preserve.

Out of scope (do not start in this section):

- Writing repository code.
- Switching any controller to a repository.
- Importing `config/supabase.js` from any controller, route, view, or
  middleware.
- Changing `database/schema.sql`, `database/seed.js`,
  `0001_initial_schema.sql`, or `0002_seed_data.sql`.
- Adding dependencies.

## 3. Module location

Proposed directory: `repositories/` at the repo root, sibling of
`controllers/`, `routes/`, `middleware/`, `utils/`.

Reasons over `models/`:

- `models/data.js` already exists as static seed reference data and
  must not be conflated with a runtime data-access layer.
- A new top-level `repositories/` directory keeps the boundary
  recognisable in code review and grep ("which file talks to the
  database?").

Each module is a CommonJS file exporting a flat object of async
functions. No classes, no DI containers - this is a capstone-scoped
project, not an enterprise app.

## 4. Migration invariants (must hold throughout the cutover)

These rules apply to every repository module below. They are the
reason the boundary exists in the first place.

- **API response shapes must not change.** Public JSON endpoints
  (`/api/buildings`, `/api/search`, `/api/routes`, `/api/routes/:id`,
  `/api/pathfind`, `/api/vr/routes/:routeId`, every `/admin/api/*`)
  must return the exact same JSON shape and field names before and
  after the MySQL -> Supabase swap. Controllers, not repositories,
  own the response shape; repositories return plain row-like objects
  that the controller maps into the response.
- **EJS locals must not change.** Every `res.render(...)` call passes
  locals that templates already consume (`user`, `buildings`, `news`,
  `studentProfile`, `instructorProfile`, `route`, `scene`,
  `hotspots`, etc.). Field names and types stay the same; the
  repository is responsible for normalising any Postgres-specific
  return shape back into what the templates already expect.
- **Session shape must not change.** `controllers/authController.js`
  hydrates `req.session.user` with a fixed shape (id, username, email,
  role, first_name, last_name, plus role-specific fields merged in).
  Anything that mutates the session continues to produce that exact
  shape.
- **Server-only Supabase.** Repositories that later switch to
  Supabase obtain the client via `config/supabase.js`
  (`getSupabaseClient()` / `hasSupabaseConfig()`). The service role
  key is **never** read from EJS templates, anything under `public/`,
  a `window` global, `res.locals`, or `app.locals`. Repository
  modules themselves must not attach the client to any of these.
  See `database/supabase/README.md` section 6 and
  `config/supabase.js` header.
- **Supabase Auth is not used.** Express session auth and the
  existing Google OAuth flow stay. Repositories never read or write
  Supabase Auth tables; the `users` row remains the identity record.
- **No SUPABASE_SERVICE_ROLE_KEY value** appears in this document or
  any code; only the variable name (which is fine in docs and
  `.env.example`). See README.md > Supabase.

## 5. Boundary 1 - users and profiles

| Item | Value |
| ---- | ----- |
| Proposed file | `repositories/userRepository.js` |
| Current callers | `controllers/authController.js` (registerPost, loginPost, googleCallback, completeRegistrationPost, hydrateSessionUser, loadRoleProfileIntoSession, createOAuthUserWithProfile, findUserByEmail), `controllers/profileController.js` (updateProfile), `controllers/dashboardController.js` (student/instructor profile fetch), `controllers/adminController.js` (index - recent users `LIMIT 5` + `COUNT(*)` total users / total students where `role='student-cspc'`; users page - full list ordered by `created_at DESC` plus active-since-30-days, inactive (derived), and new-this-month counts), `controllers/adminUsersController.js` (admin API CRUD cleanup: createUser, updateUser, deleteUser). |
| MySQL tables | `users`, `student_profiles`, `instructor_profiles`, `guest_profiles` |
| Supabase tables | `users`, `student_profiles`, `instructor_profiles`, `guest_profiles` (defined in `0001_initial_schema.sql` section B.1) |
| Role/security | Local accounts use bcrypt hashes; OAuth accounts carry `oauth_provider='google'` + `oauth_subject`. Admin role creation stays seed-only / direct-DB-only (no public path). The `IMMUTABLE_FIELDS` rule in `profileController.js` (role/email/id/password) must continue to be enforced by the controller; the repository must not provide a way to update those four fields. |

Method responsibilities (no implementation; signatures only):

- `findUserByEmail(email)` -> normalised user row or `null`.
- `findUserById(id)` -> user row or `null`.
- `createLocalUser({ username, email, passwordHash, role, first_name, last_name })` -> inserted id.
- `createOAuthUserWithProfile(pending, body)` -> inserted id. Wraps the
  multi-table insert currently in `authController.js`; must run in a
  transaction or equivalent atomic operation so a half-created user
  is never persisted.
- `updateUserName(userId, { first_name, last_name })` -> void.
- `updateUserProfileImage(userId, pictureUrl)` -> void. Stores only a
  validated HTTPS Google-hosted profile-picture URL and bumps `updated_at`.
- `loadRoleProfile(userId, role)` -> object with the role-specific
  fields (`student_id_number/course/year_level/...`,
  `employee_id/department/position/...`, `address/phone_number`) or
  `null` if no profile row exists yet.
- `upsertStudentProfile(userId, fields)` /
  `upsertInstructorProfile(userId, fields)` /
  `upsertGuestProfile(userId, fields)` -> void. Mirror the existing
  INSERT-if-missing / UPDATE-if-existing pattern in
  `profileController.js`.

Admin read-only helpers (consumed by `adminController.js`):

- `listRecentUsers(limit)` -> users ordered by `created_at DESC`,
  capped at `limit`. Used by the admin dashboard's "recent users"
  panel (`LIMIT 5` today).
- `listAllUsersForAdmin()` -> full user list ordered by
  `created_at DESC`. Used by the admin users page.
- `countAll()` -> total user count (admin dashboard + admin users
  page total stat).
- `countByRole(role)` -> count of users with the given role.
  Today the admin dashboard uses this for `totalStudents` (role
  `'student-cspc'`); generalising lets the same helper power any
  future per-role stat.
- `countUpdatedSince(date)` -> number of users with `updated_at >=`
  the given timestamp. Backs the admin users page "active" stat
  (currently a 30-day proxy in `adminController.users`). The
  controller continues to decide what "active" means; the
  repository only answers the count question.
- `countCreatedInMonth({ year, month })` -> count of users whose
  `created_at` falls inside the given `(year, month)`. Backs the
  admin users page "new this month" stat. Controller passes
  the current calendar month; repository does not read clocks.

Migration notes:

- The MySQL pool exposes `db.getConnection()` for transactions; the
  Supabase JS client does not. The Supabase implementation will use
  a single Postgres function or a sequenced `from(...).insert()` chain
  inside a try/rollback emulation. Hide that choice behind the
  repository so controllers never branch on backend.
- Email lookup must remain case-insensitive (current MySQL uses
  `LOWER(TRIM(email)) = ?`). Supabase implementation should mirror
  this, e.g. `.ilike('email', email.trim())` with strict equality.

## 6. Boundary 2 - buildings

| Item | Value |
| ---- | ----- |
| Proposed file | `repositories/buildingRepository.js` |
| Current callers | `controllers/buildingsController.js` (index, apiList), `controllers/mapController.js` (index, apiSearch), `controllers/adminBuildingsController.js` (createBuilding, updateBuilding, deleteBuilding), `controllers/adminController.js` (index - `COUNT(*)` totalBuildings on the admin dashboard; campusMap page - full list ordered by `name ASC` plus a distinct-category count derived in the controller), `controllers/vrController.js` (resolveRouteScenes - reads building id/name only). |
| MySQL tables | `buildings`, plus a small read of `campus_routes(id, destination_building_id)` for the `vr_route_id` attachment helper consumed by buildings + map. |
| Supabase tables | `buildings` with `jsonb` details, `lat`/`lng`, `location extensions.geography(Point, 4326)`, `image_url`, `cloudinary_public_id` (defined in `0001_initial_schema.sql` section B.3). |
| Role/security | Read access is gated upstream by `middleware/roleAuth.js`. Writes (create/update/delete) are gated by `requireRole('admin')` on `/admin/api/buildings*`. Repository writers must not silently bypass the existing `validateDetails` / `validateCoord` checks in `adminBuildingsController.js`; validation stays in the controller, repository accepts pre-validated values. |

Method responsibilities:

- `listAll()` -> ordered array of building rows.
- `findById(id)` -> row or `null`.
- `create({ name, category, description, lat, lng, details })` -> inserted row.
- `update(id, { name, category, description, lat, lng, details })` -> updated row.
- `delete(id)` -> void; controller checks existence first.
- `search(term, { limit })` -> rows matching name / category /
  description / `details` JSON, ordered as `mapController.apiSearch`
  expects. Implementation can swap MySQL `JSON_SEARCH` for Postgres
  `jsonb` operators (`@>` / `?` / `to_tsquery`) without changing the
  return shape.
- `listVrRouteIdByBuilding()` -> `Map<buildingId, routeId>` used by
  buildings + map controllers to decorate buildings with
  `vr_route_id`. Joins `campus_routes` (lowest route id wins). This
  is a read of a routes table from the buildings repository; in
  practice both controllers want the decoration in one shot, so the
  helper lives here for callsite convenience and crosses the
  boundary by reading only `campus_routes(id, destination_building_id)`.

Admin read-only helpers (consumed by `adminController.js`):

- `countAll()` -> total building count. Backs the admin dashboard
  `totalBuildings` stat.
- `listAllOrderedByName()` -> full buildings list ordered by
  `name ASC`. Backs the admin campus-map page list. `listAll()`
  (above) keeps its existing `id ASC` ordering for the public
  pages; the distinct-category count consumed by the campus-map
  page stat is derived from this list in the controller, so no
  separate `listDistinctCategories()` method is required.

Migration notes:

- `details` is `text` in MySQL and `jsonb` in Postgres. The
  repository's read path returns a JavaScript object on both
  backends; `utils/buildingData.normalizeBuildingRows` already
  performs that normalisation today and stays in place.
- PostGIS `location` is populated by the seed and by any future
  Supabase-side upsert; the current UI reads `lat`/`lng` directly
  and does not need `location`. Repository writes should populate
  `location` from `lat`/`lng` using the schema-qualified PostGIS
  expression documented in `database/supabase/SEED_STRATEGY.md`
  section 8.

## 7. Boundary 3 - announcements and events

| Item | Value |
| ---- | ----- |
| Proposed file | `repositories/contentRepository.js` |
| Current callers | `controllers/dashboardController.js` (audience-filtered announcements), `controllers/eventsController.js` (index - public `/events` page; orders by `event_date ASC` and reshapes rows into `{id, title, category, dateObj, desc, location, time}` for the EJS template), `controllers/adminContentController.js` (CRUD for news + events), `controllers/adminController.js` (index - recent news `LIMIT 4` ordered by `published_date DESC` + `COUNT(*)` total news on the admin dashboard; news page - full articles list ordered by `created_at DESC`, full events list ordered by `event_date DESC`, plus totalArticles / published / drafts / totalEvents stats). |
| MySQL tables | `news_announcements`, `events` |
| Supabase tables | `news_announcements` (with `audience` CHECK), `events` (defined in `0001_initial_schema.sql` section B.2) |
| Role/security | Read of announcements respects `audience` ('all' or session role). Drafts (`published_date IS NULL`) are never returned to dashboards. Writes are admin-only at the route layer; category/audience allowlists in `adminContentController.js` stay in the controller. |

Method responsibilities:

- `listAnnouncementsForRole(role)` -> ordered array of published
  announcements where `audience = 'all' OR audience = role`. Anonymous
  callers (role = null) get the `'all'` subset only.
- `listAllAnnouncements()` -> for admin listing pages.
- `createAnnouncement(payload)`, `updateAnnouncement(id, payload)`,
  `deleteAnnouncement(id)`.
- `listEvents({ from, to } = {})` -> events ordered by
  `event_date ASC`; default returns the full set. Backs
  `controllers/eventsController.js` (public `/events` page); that
  controller continues to reshape rows for its EJS template
  (`dateObj`/`desc`/`time`), so the repository returns DB row
  shapes unchanged.
- `createEvent(payload)`, `updateEvent(id, payload)`, `deleteEvent(id)`.

Admin read-only helpers (consumed by `adminController.js`):

- `listRecentAnnouncements(limit)` -> announcements ordered by
  `published_date DESC`, capped at `limit`. Backs the admin
  dashboard "recent news" panel (`LIMIT 4` today). Unlike
  `listAnnouncementsForRole`, this helper returns drafts too
  because admins need visibility into unpublished articles.
- `countAnnouncements()` -> total announcement count
  (admin dashboard `totalNews` stat).
- `listAllAnnouncementsForAdmin()` -> full article list ordered by
  `created_at DESC`. Backs the admin news page. The published /
  drafts split (controller-side `filter(a => a.published_date !== null)`)
  stays in the controller; the repository returns rows.
- `listEventsForAdmin()` -> full events list ordered by
  `event_date DESC`. Backs the admin news page events table.
  (Public consumers continue to use `listEvents({...})` for the
  ascending order they expect.)
- `countEvents()` -> total event count (admin news page
  `totalEvents` stat).

Migration notes:

- `published_date` is `TIMESTAMP` in MySQL and `timestamptz` in
  Postgres. The repository returns either a JS `Date` or a string
  depending on driver behaviour; the controller already serialises
  for JSON and EJS, so the contract is "valid input to `new Date(...)`".

## 8. Boundary 4 - campus routes, graph, and pathfinding

| Item | Value |
| ---- | ----- |
| Proposed file | `repositories/routeRepository.js` |
| Current callers | `controllers/mapController.js` (`fetchRouteSummaries`, `attachStepsToRoutes`, `apiPathfind`, vr_route_id helper), `controllers/buildingsController.js` (vr_route_id helper - see Boundary 2 note), `controllers/vrController.js` (`resolveRouteScenes` graph load). |
| MySQL tables | `campus_routes`, `campus_route_steps`, `route_nodes`, `route_edges` |
| Supabase tables | Same names, defined in `0001_initial_schema.sql` section B.4. `route_nodes.location` is `extensions.geography(Point, 4326)`; current callers read `lat`/`lng` directly and do not need `location` yet. `route_edges` rows remain DIRECTED (the seed inserts both A->B and B->A); `utils/pathfinding.js` depends on this and must not be changed. |
| Role/security | All reads are behind `requireLogin`. There is no admin CRUD for the graph today, so the repository exposes reads first. Any future admin write paths must continue to validate input in the route/controller layer. |

Method responsibilities:

- `listRouteSummaries(filters = {})` -> route summary rows joined to
  destination building (`destination.{id,name,category,lat,lng}`).
  Replaces the current private `fetchRouteSummaries` helper in
  `mapController.js`.
- `attachStepsToRoutes(routes)` -> mutates the passed routes by
  attaching their ordered `steps` array and derived `landmarks`.
  Mirrors the current helper's contract.
- `getRouteWithSteps(id)` -> a single route summary plus steps, or
  `null`.
- `listAllNodes()` -> array of `{ id, node_key, label, node_type,
  building_id, lat, lng }` rows.
- `listAllEdges()` -> array of `{ from_node_id, to_node_id,
  distance_meters, walk_time_seconds, path_label, is_accessible }` rows.

Migration notes:

- `utils/pathfinding.js` is pure; it stays unchanged. The repository
  hands it plain row arrays, exactly as the controller does today.
- The vr_route_id decoration helper in Boundary 2 reads
  `campus_routes(id, destination_building_id)`. Keep one implementation
  in `routeRepository`, with `buildingRepository.listVrRouteIdByBuilding()`
  thinly delegating, to avoid two divergent SQLs.

## 9. Boundary 5 - VR scenes and hotspots

| Item | Value |
| ---- | ----- |
| Proposed file | `repositories/vrRepository.js` |
| Current callers | `controllers/vrController.js` (`viewer`, `routeViewer`, `apiRoute`, `loadSceneHotspots`, `resolveRouteScenes`). |
| MySQL tables | `vr_scenes`, `vr_hotspots` |
| Supabase tables | `vr_scenes` (with `cloudinary_public_id` reserved NULL until later) and `vr_hotspots` (defined in `0001_initial_schema.sql` section B.5). |
| Role/security | All reads behind `requireLogin`; no admin CRUD for VR scenes / hotspots exists today (HANDOFF.md section 7). Write methods are deliberately omitted from the initial repository surface; add them when an admin VR-CRUD ships. |

Method responsibilities:

- `listAllScenes()` -> ordered scenes for the scene browser
  (`vrController.viewer`).
- `findSceneByKey(sceneKey)` -> one scene row or `null`.
- `listHotspotsForScene(sceneId)` -> ordered hotspots with the LEFT
  JOIN onto target scenes that `loadSceneHotspots` performs today,
  preserving the `target_scene_key` / `target_title` fields the
  views consume.
- `listScenesForGraphPath({ nodeIds, buildingIds })` -> scenes whose
  `node_id IN (...)` OR `building_id IN (...)`. Replaces the dynamic
  `WHERE` builder in `resolveRouteScenes`. Returns rows; the
  controller continues to do the path-walk de-duplication.

Migration notes:

- `vr_scenes.image_url` keeps current `/img/vr/*.jpg` placeholder
  paths; the existing fallback UI handles the 404. The repository
  must not infer or fabricate URLs.
- `vr_scenes.cloudinary_public_id` stays NULL on every row until a
  later Cloudinary milestone; repository write methods (when added)
  must accept NULL and not require a public id.

## 10. Cross-cutting concerns

### 10.1 Transactions

Two flows today need atomicity:

- `controllers/authController.js -> createOAuthUserWithProfile`
  inserts a `users` row plus one of the role-specific profile rows.
- `controllers/profileController.js -> updateProfile` performs
  multiple writes per request (user name + role profile upsert) but
  currently runs them sequentially; the contract today is "best
  effort, last write wins."

Repositories must preserve the existing atomicity guarantees - no
weaker, no stronger. The MySQL implementation uses
`db.getConnection() + beginTransaction()`; the Supabase
implementation will need an equivalent (a Postgres function, a
single multi-statement RPC, or careful ordering with manual
rollback). Either way, the controller signature does not change.

### 10.2 Error contract

Repositories throw plain `Error` instances on unexpected failure;
controllers continue to translate to HTTP. Repositories do **not**
take an `(req, res)` pair, do **not** call `res.status()` /
`res.json()` / `res.render()`, and do **not** read `req.session`.
The session is read in the controller, role decisions stay in the
controller, and the repository only sees pre-validated values.

### 10.3 What must NOT change yet

- No controller currently imports a repository module. That stays
  true until Section 5.2 (read-only stubs) and the controller
  migration in Milestone 2+.
- `config/db.js` (the MySQL pool) remains the live runtime data
  source. Do not remove it.
- `utils/pathfinding.js` and `utils/buildingData.js` stay pure
  helpers; they are independent of which database is in use.
- `models/data.js` stays as static seed reference data; it is not
  promoted to a runtime data-access layer.
- API response shapes, EJS locals, and `req.session.user` shape are
  frozen for the duration of the migration (see section 4).

## 11. Optional future boundaries (out of scope for Section 5.1)

These do not appear in the five boundaries the plan calls out, but
they live on the same code path and will likely need siblings later:

- `repositories/siteContentRepository.js` for `system_settings`,
  `team_members`, and `faqs` (currently consumed by the About page
  and admin settings/FAQ pages). Adding this module is a one-line
  delta to the boundary list; flagging it so reviewers expect it.
- Audit logging (`system_logs`, Milestone 7) - separate boundary;
  out of scope here.

## 12. Next steps

- Section 5.2 - Read-Only Repository Stubs: add the five repository
  files under `repositories/` exporting empty / read-only function
  stubs that throw `NotImplemented`. No controller is switched.
- Section 5.3 - Migration Checklist: order in which controllers
  adopt the repositories (users -> buildings -> map/routes ->
  content -> VR), per `plan.md` Section 5.3.
- Milestone 2+ then begins the actual MySQL -> Supabase cutover, one
  repository at a time, behind the invariants in section 4.
