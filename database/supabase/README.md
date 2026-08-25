# database/supabase

Supabase / PostgreSQL / PostGIS migration baseline for CampuSphere.

## Current migration status (2026-08-25)

Migration sources are contiguous from `0001` through `0020`. Migrations
`0001`-`0020` are owner-applied. `0020_room_schedule_documents.sql` is the
semester room-schedule image migration; it creates
`room_schedule_documents` and adds the nullable indexed
`vr_hotspots.schedule_document_id` foreign key. It was applied by the owner
before dual-backend runtime verification; application acceptance remains a
separate evidence boundary.

The older milestone-by-milestone application notes below are retained as
historical setup guidance; this current-status block controls when their
migration counts differ.

## 1. Purpose

This folder holds the SQL that defines the Supabase / PostgreSQL / PostGIS
database target for the project. Migrations `0001` through `0006` have been
applied to the team's Supabase project.

The app runs against **either** MySQL (`config/db.js`, `database/schema.sql`)
**or** this Supabase schema, selected per feature at runtime by the data-source
switches (`AUTH_DATA_SOURCE`, `BUILDING_DATA_SOURCE`, `ROUTE_DATA_SOURCE`,
`CONTENT_DATA_SOURCE`, `VR_DATA_SOURCE`, and `MAP_RENDERER`). When a switch is
set to `supabase`, the matching server-only repository in `repositories/`
reads and writes through `config/supabase.js`, so controllers, routes, and
views do depend on this schema in Supabase mode. MySQL remains the default and
the rollback baseline.

## 2. Current migration file

`database/supabase/0001_initial_schema.sql` is the single ordered baseline
migration. It currently covers:

- PostGIS extension setup (Section A).
- Auth and role-profile tables: `users`, `student_profiles`,
  `instructor_profiles`, `guest_profiles` (Section B.1, plan Section 2.2).
- Content and settings tables: `news_announcements`, `events`, `faqs`,
  `system_settings`, `team_members` (Section B.2, plan Section 2.3).
- `buildings` with `jsonb` details, `lat`/`lng`, Cloudinary-ready fields
  (`image_url`, `cloudinary_public_id`), and PostGIS `location`
  (Section B.3, plan Section 2.4).
- Campus routes and graph: `campus_routes`, `campus_route_steps`,
  `route_nodes` (with PostGIS `location`), `route_edges` (directed rows,
  unique `(from_node_id, to_node_id)`) (Section B.4, plan Section 2.5).
- VR scenes and hotspots: `vr_scenes` (with `cloudinary_public_id`),
  `vr_hotspots` (Section B.5, plan Section 2.5).

If later phases need to add tables, add numbered follow-up files
(`0002_*.sql`, `0003_*.sql`, ...) in this same folder rather than editing
`0001_initial_schema.sql`.

The applied series is now `0001` through `0006`.
`0006_admin_content_and_logs.sql` (Milestone 7, Section 7.2) adds the
privacy-minimal `system_logs` audit table (seeded empty), a canonical 6-row
FAQ seed, and a canonical `system_settings` refresh that corrects the founding
year, contact phone, email, and website to truthful CSPC values. It grants
`SELECT` + `INSERT` on `system_logs` to `service_role` only and revokes
`UPDATE`/`DELETE`/`TRUNCATE` so audit rows stay immutable.

## 3. Supabase / PostGIS extension requirement

The migration installs PostGIS into the dedicated `extensions` schema,
matching the Supabase convention rather than placing the extension in
`public`:

```sql
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
```

Spatial columns use the schema-qualified type:

```
extensions.geography(Point, 4326)
```

This type is used for `buildings.location` and `route_nodes.location`.
Schema-qualifying the type avoids any `search_path` dependency when the
migration is applied via the Supabase SQL Editor, `psql`, or the Supabase
CLI.

Hosted Supabase projects typically already ship with PostGIS available;
both statements are idempotent (`IF NOT EXISTS`), so applying them on a
project that already has PostGIS installed in `extensions` is a no-op.

## 4. How to apply later

Migrations `0001` through `0006` have already been applied to the team's
working Supabase project. The instructions below are for bringing a **fresh**
or disposable Supabase project up to the current schema (for example, a clean
demo project or a new developer environment).

To apply against such a project, use any of:

- Supabase SQL Editor: paste the contents of
  `0001_initial_schema.sql` and run.
- `psql`: run the file against the project connection string.
- Supabase CLI: include the file in the project's migrations pipeline
  once the team adopts it.

Apply against a development or disposable Supabase project first. Do not
apply directly to a final demo project or to any project containing data
the team cannot afford to lose.

The formal first-apply step for Milestone 1 is plan.md
**Section 6.2: Supabase Apply Smoke Test** (confirms PostGIS is
available, all expected tables exist, both `location` columns are
PostGIS geography, and re-running is safe). Schema verification queries
themselves are listed in plan.md Section 6.1.

Apply order (each file once, in sequence, against the target project):

1. `0001_initial_schema.sql`
2. `0002_seed_data.sql`
3. `0003_auth_profile_functions.sql`
4. `0004_building_backfill.sql`
5. `0005_building_write_functions.sql`
6. `0006_admin_content_and_logs.sql` (Milestone 7 — `system_logs` table plus
   canonical FAQ and `system_settings` refresh)
7. `0007_route_graph_admin_write_functions.sql` (Milestone 7, Section 7.9 —
   service-role-only functions: atomic route-step replace, route-node
   create/update with PostGIS `location`, and a guarded route-node delete that
   raises `NODE_REFERENCED` instead of cascading away edges / nulling VR scene
   links). Functions only; apply manually before Supabase-mode route/graph
   write verification.
8. `0008_profile_update_atomic_function.sql` (Milestone 7 remediation R6 —
   service-role-only `app_update_user_profile`: updates `users` name and the
   role profile row in ONE transaction so a profile-write failure cannot leave
   a partial name update). Function only; apply manually before Supabase-mode
   profile-update verification.

## 5. Auth decision

CampuSphere keeps Express session auth and the existing Google OAuth
flow. Supabase Auth is intentionally not used by this migration.

- Local accounts continue to store bcrypt-hashed passwords in
  `users.password`.
- Google OAuth accounts are identified by `users.oauth_provider` and
  `users.oauth_subject`.
- No real Google passwords are stored.

If a future milestone decides to move auth into Supabase, it will be a
separate, explicit decision and a separate migration.

## 6. Server-side access decision

Supabase is accessed from server-side Express code only. The
`SUPABASE_SERVICE_ROLE_KEY` (and any equivalent privileged key) must
never be:

- read in EJS templates,
- bundled into anything under `public/`,
- attached to a `window` global,
- committed to the repository.

Reads from the browser, if ever needed, must go through Express routes
that authorize the request server-side.

## 7. Later phases

Roughly, the remaining Milestone 1 phases in `plan.md` are:

- Phase 3 (Sections 3.1 - 3.5): define / add the Supabase seed data
  equivalent to the current MySQL seed.
- Phase 4 (Sections 4.1 - 4.3): document Supabase env vars, add a
  server-only Supabase client, and provide a safe connectivity
  smoke-check.
- Phase 5 (Sections 5.1 - 5.3): introduce read-only repository stubs
  and the controller-migration checklist used by Milestone 2.
- Phase 6 (Sections 6.1 - 6.5): static SQL verification, Supabase apply
  smoke test, seed verification, server-side connectivity check, and
  the Milestone 1 go / no-go report.

## 8. Status and remaining non-goals

Current state (Milestones 2-7):

- Auth/profile, buildings/map, routes/graph, dashboard/content, and VR reads
  (plus building writes) are Supabase-capable behind the runtime switches; the
  server-only repositories in `repositories/` are the only Supabase callers.
- MapLibre, the custom Service Worker PWA, and the `system_logs` audit table
  (migration `0006`) have landed.

Still out of scope for this folder:

- Supabase Auth (Express sessions + bcrypt + Google OAuth remain the only
  sign-in paths),
- Cloudinary runtime uploads,
- replacing `database/schema.sql` / `database/seed.js` (MySQL stays the
  default and the rollback baseline).
