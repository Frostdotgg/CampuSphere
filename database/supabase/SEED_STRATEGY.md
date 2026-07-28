# Supabase Seed Strategy

Decision document for how Supabase seed data will be prepared in the
remaining Phase 3 sections of `plan.md`. This file does **not** contain
the seed data itself; it only fixes the approach so later sections can
move quickly.

## 1. Purpose

- Decide the seed approach for the Supabase / PostgreSQL / PostGIS
  target before any executable seed data is written.
- Keep the decision narrow and reversible: only Phase 3 of Milestone 1
  is in scope.
- Sections 3.2 - 3.4 will produce the actual seed content. Section 3.5
  will document verification queries.

## 2. Chosen approach

**SQL-first seed file** under `database/supabase/`.

- Proposed future filename: `database/supabase/0002_seed_data.sql`
  (numbered to follow the migration ordering) or
  `database/supabase/seed_data.sql` if the team prefers to keep seeds
  visually separate from migrations. The final filename is finalized
  in Section 3.2 when the first content lands.
- One file, grouped by table / domain, top-to-bottom in dependency
  order (users -> profiles -> content -> buildings -> routes -> VR).
- Plain SQL only. No PL/pgSQL functions, no DO-blocks, unless a
  specific seed row genuinely needs them.

## 3. Why not a Node / Supabase client seed script yet

- Avoids needing `SUPABASE_SERVICE_ROLE_KEY` in the repo workflow
  before Phase 4 (which is the phase that introduces server-side
  Supabase config).
- Avoids pulling `@supabase/supabase-js` into the dependency tree
  earlier than planned.
- Easier for the team to read, review, and paste into the Supabase
  SQL Editor manually.
- Easier to demonstrate and explain during defense ("here is the
  seed file, here are the rows").
- A Node-based seeder can be added later if SQL-only becomes hard
  to maintain (e.g., if bcrypt hashes start needing to be generated
  on the fly). For now, hashes will be pre-computed and pasted in.

## 4. Source of truth for seed content

- `database/seed.js` and `models/data.js` are the **migration
  references** for what content the Supabase seed must reproduce.
- Both files stay in place. They continue to seed MySQL for the
  current running app.
- Section 3.2 - 3.4 work copies values out of those files into the
  Supabase SQL seed; it does not modify them.
- Preserve existing seeded demo accounts from `database/seed.js`:
  - admin: `admin@cspc.edu.ph`
  - sample student: `aaron.lasprillas@cspc.edu.ph`
- Section 3.2 may add new Supabase-only instructor and guest demo
  accounts if needed for final defense coverage, but those should be
  documented as new Supabase seed rows, not as currently shipped
  MySQL seed rows.

## 5. Seed groups for later Phase 3 sections

| Section | Group                                                       |
| ------- | ----------------------------------------------------------- |
| 3.2     | Auth and role profiles: `users`, `student_profiles`,        |
|         | `instructor_profiles`, `guest_profiles`.                    |
| 3.3     | Content + settings + buildings: `news_announcements`,       |
|         | `events`, `faqs`, `system_settings`, `team_members`,        |
|         | `buildings`.                                                |
| 3.4     | Routes, graph, and VR: `campus_routes`,                     |
|         | `campus_route_steps`, `route_nodes`, `route_edges`,         |
|         | `vr_scenes`, `vr_hotspots`.                                 |
| 3.5     | Verification queries (counts, spot checks) and apply notes. |

## 6. Idempotency rules

The seed SQL should be safe to re-run where practical, so a developer
can iterate against a development Supabase project without dropping
the database every time.

- Prefer `INSERT ... ON CONFLICT (<natural key>) DO NOTHING` (or
  `DO UPDATE` only where an explicit refresh is desired) over blind
  `INSERT`s.
- For child rows that depend on a parent surrogate id (e.g.,
  `student_profiles.user_id`), look the parent up by its natural key
  inside the seed (e.g., `(SELECT id FROM users WHERE email = ...)`)
  rather than hard-coding ids.
- Avoid duplicate critical rows.

Natural keys to anchor conflict handling on:

| Table                | Natural key                                |
| -------------------- | ------------------------------------------ |
| `users`              | `email`                                    |
| `student_profiles`   | `user_id` (1:1) or `student_id_number`     |
| `instructor_profiles`| `user_id` (1:1) or `employee_id`           |
| `guest_profiles`     | `user_id` (1:1)                            |
| `news_announcements` | `title` (where titles are demo-stable)     |
| `events`             | `title` + `event_date` if needed           |
| `faqs`               | `question`                                 |
| `system_settings`    | `setting_key`                              |
| `team_members`       | `name` or `(name, role)`                   |
| `buildings`          | `name`                                     |
| `campus_routes`      | `title`                                    |
| `campus_route_steps` | `(route_id, step_order)`                   |
| `route_nodes`        | `node_key`                                 |
| `route_edges`        | `(from_node_id, to_node_id)`               |
| `vr_scenes`          | `scene_key`                                |
| `vr_hotspots`        | `(scene_id, hotspot_type, label)` or       |
|                      | `(scene_id, target_scene_id)` if stable    |

`vr_hotspots` has no unique constraint on these columns in the
current schema, so its idempotency will rely on a pre-check or a
deliberate `DELETE` + `INSERT` for that scene before reseeding.
Section 3.4 will decide which.

## 7. Password and auth notes

- Local demo account passwords in the Supabase seed must be
  **bcrypt hashes**, not plaintext. Pre-compute hashes (the same
  rounds the app uses) and paste them as bcrypt hash string
  literals into the SQL. Do not call any password-hashing function
  inside the seed SQL.
- Google OAuth demo accounts (if any) use `oauth_provider = 'google'`
  and `oauth_subject = '<google-subject-id>'`. The `password` column
  on those rows must hold a non-usable placeholder hash, never a
  real Google password.
- No Google passwords are stored anywhere in this repo.
- Express session auth and the existing Google OAuth flow remain the
  runtime auth path. Supabase Auth is not used. See
  `database/supabase/README.md` section 5.

## 8. PostGIS seed notes

For tables that carry both `lat`/`lng` and a PostGIS `location`
column (`buildings`, `route_nodes`):

- Seed `lat` and `lng` from the existing MySQL values (current UI
  reads these directly).
- Populate `location` from those same values using:

  ```
  ST_SetSRID(ST_MakePoint(lng, lat), 4326)::extensions.geography
  ```

  Note the `(lng, lat)` argument order: PostGIS `ST_MakePoint` takes
  longitude first.
- Either insert `location` inline on the initial `INSERT`, or do a
  one-shot `UPDATE ... SET location = ST_SetSRID(...)::extensions.geography
  WHERE location IS NULL` immediately after the inserts. Section 3.3
  and 3.4 will pick whichever reads cleaner.
- Do not drop `lat` / `lng`. They stay alongside `location`.

## 9. Cloudinary and VR notes

- Keep `image_url` on `buildings` and `vr_scenes`. The current app
  and `database/seed.js` use these.
- Leave `cloudinary_public_id` as `NULL` for now on every seeded
  row. A later Cloudinary migration (out of Milestone 1 scope) will
  populate it.
- VR panorama paths under `/img/vr/*.jpg` are still placeholders;
  no real panorama assets exist in the repo. The existing VR viewer
  already falls back to a placeholder panel when the image is
  missing (see `HANDOFF.md` section 7). The Supabase seed will
  carry the same placeholder URLs and inherit the same fallback
  behavior.

## 10. Current non-goals

This section explicitly does **not**:

- write executable Supabase seed SQL (that is Sections 3.2 - 3.4),
- apply any seed to Supabase,
- modify `database/schema.sql` or `database/seed.js`,
- modify `database/supabase/0001_initial_schema.sql`,
- modify `models/data.js` or any controller / route / view,
- introduce `SUPABASE_SERVICE_ROLE_KEY` handling, a Supabase client
  module, or any new npm dependency,
- migrate runtime controllers from MySQL to Supabase,
- introduce Supabase Auth,
- add MapLibre, Cloudinary runtime uploads, or PWA / Service Worker
  behavior.

All of the above are scoped to later sections / milestones.
