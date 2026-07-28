# Supabase Seed Verification

Verification queries for the Supabase / PostgreSQL / PostGIS migration
work in this folder. Milestone 1, Phase 3, Section 3.5.

## 1. Prerequisites

Run these queries only after applying, in order, on the target Supabase
project:

1. `database/supabase/0001_initial_schema.sql`
2. `database/supabase/0002_seed_data.sql`
3. `database/supabase/0004_building_backfill.sql`
4. `database/supabase/0006_admin_content_and_logs.sql`

`0004_building_backfill.sql` (Milestone 3 reconciliation) adds 6 real
campus buildings that existed in live MySQL but not in the 0002 demo
seed, bringing the canonical building set to **12**. The building counts
below assume `0004` has been applied. If you applied only `0001` + `0002`,
`buildings` is still 6; everything else is unchanged by `0004`.

`0006_admin_content_and_logs.sql` (Milestone 7, Section 7.2) adds the
`system_logs` audit table (seeded empty), seeds the **6 canonical FAQs**, and
refreshes the 10 `system_settings` values. The `faqs = 6`, `system_logs = 0`,
and corrected-settings checks below assume `0006` has been applied.

These files are SQL-only. Applying them does **not** touch the current
MySQL runtime (`database/schema.sql`, `database/seed.js`,
`config/db.js`); those continue to be the live source of truth until
later milestones explicitly migrate controllers.

The seed in `0002_seed_data.sql` is idempotent (`ON CONFLICT` or scoped
`DELETE` per table), so verification can be re-run after re-seeding the
same project.

## 2. Safety

- Run verification against a **development / disposable Supabase
  project** first. Do not run against a final / demo Supabase project,
  or any project containing data the team cannot afford to lose.
- These queries are read-only. They never `INSERT`, `UPDATE`, or
  `DELETE`. They are safe to paste and run repeatedly.

## 3. Reminders

- CampuSphere keeps **Express session auth** and the existing Google
  OAuth flow. Supabase Auth is intentionally not used. See
  `database/supabase/README.md` section 5.
- `SUPABASE_SERVICE_ROLE_KEY` (and any equivalent privileged key) must
  never be loaded by EJS templates, shipped into anything under
  `public/`, attached to a `window` global, or committed to the
  repository. Browser reads, if ever needed, must go through Express
  routes that authorize the request server-side.

## 4. How to run

Paste each query into the Supabase SQL Editor (or `psql` against the
target project) and compare the result with the **Expected** column /
comment next to it.

---

## 5. Count checks

Single combined check. Returns 17 rows; each row must have
`row_count = expected`.

```sql
SELECT 'users'                AS table_name, COUNT(*) AS row_count, 4  AS expected FROM users
UNION ALL SELECT 'student_profiles',         COUNT(*), 1  FROM student_profiles
UNION ALL SELECT 'instructor_profiles',      COUNT(*), 1  FROM instructor_profiles
UNION ALL SELECT 'guest_profiles',           COUNT(*), 1  FROM guest_profiles
UNION ALL SELECT 'system_settings',          COUNT(*), 10 FROM system_settings
UNION ALL SELECT 'news_announcements',       COUNT(*), 8  FROM news_announcements
UNION ALL SELECT 'events',                   COUNT(*), 5  FROM events
UNION ALL SELECT 'faqs',                     COUNT(*), 6  FROM faqs
UNION ALL SELECT 'system_logs',              COUNT(*), 0  FROM system_logs
UNION ALL SELECT 'team_members',             COUNT(*), 3  FROM team_members
UNION ALL SELECT 'buildings',                COUNT(*), 12 FROM buildings
UNION ALL SELECT 'campus_routes',            COUNT(*), 4  FROM campus_routes
UNION ALL SELECT 'campus_route_steps',       COUNT(*), 16 FROM campus_route_steps
UNION ALL SELECT 'route_nodes',              COUNT(*), 9  FROM route_nodes
UNION ALL SELECT 'route_edges',              COUNT(*), 20 FROM route_edges
UNION ALL SELECT 'vr_scenes',                COUNT(*), 6  FROM vr_scenes
UNION ALL SELECT 'vr_hotspots',              COUNT(*), 15 FROM vr_hotspots
ORDER BY table_name;
```

Per-table reference (copy individual lines if preferred):

| Table                  | Expected count | Source                  |
| ---------------------- | -------------- | ----------------------- |
| `users`                | 4              | Section 3.2 seed        |
| `student_profiles`     | 1              | Section 3.2 seed        |
| `instructor_profiles`  | 1              | Section 3.2 seed        |
| `guest_profiles`       | 1              | Section 3.2 seed        |
| `system_settings`      | 10             | Section 3.3 seed        |
| `news_announcements`   | 8              | Section 3.3 seed        |
| `events`               | 5              | Section 3.3 seed        |
| `faqs`                 | 6              | 0006 canonical FAQ seed |
| `system_logs`          | 0              | 0006 (audit; empty)     |
| `team_members`         | 3              | Section 3.3 seed        |
| `buildings`            | 12             | 6 (0002 seed) + 6 (0004 backfill) |
| `campus_routes`        | 4              | Section 3.4 seed        |
| `campus_route_steps`   | 16             | Section 3.4 seed (4 routes x 4 steps) |
| `route_nodes`          | 9              | Section 3.4 seed        |
| `route_edges`          | 20             | Section 3.4 seed (10 undirected pairs x 2) |
| `vr_scenes`            | 6              | Section 3.4 seed        |
| `vr_hotspots`          | 15             | Section 3.4 seed (10 nav + 1 info + 4 exit) |

`faqs` now holds the **6 canonical FAQ rows** seeded idempotently by
`database/seed.js` (MySQL) and `0006_admin_content_and_logs.sql` (Supabase).
`system_logs` is the Milestone 7 audit table from `0006`, seeded **empty
(0 rows)**.

### 5.1 Canonical FAQ questions (0006)

```sql
SELECT question, category, display_order
  FROM faqs
 ORDER BY display_order, question;
-- Expected: the 6 canonical rows below (any admin-added FAQs may follow).
--   1  Campus Map      How do I open the campus map?
--   2  Campus Map      How do I find a building, office, or service?
--   3  Navigation      How do I get walking directions to a building?
--   4  VR Tour         How do I start a guided VR route?
--   5  Offline Access  Can I use CampuSphere offline?
--   6  Account         How do I update my profile information?
```

### 5.2 Canonical settings values (0006 corrections)

```sql
SELECT setting_key, setting_value
  FROM system_settings
 WHERE setting_key IN ('school_founded', 'contact_phone', 'contact_email', 'contact_website')
 ORDER BY setting_key;
-- Expected (must match MySQL by natural key):
--   contact_email    mail@cspc.edu.ph
--   contact_phone    (054) 288 4421 to 23
--   contact_website  https://cspc.edu.ph
--   school_founded   1983
```

---

## 6. PostGIS spot checks

### 6.1 `buildings.location` populated for all 12 rows

```sql
SELECT COUNT(*)                                  AS buildings_total,
       COUNT(location)                           AS buildings_with_location,
       COUNT(*) FILTER (WHERE location IS NULL)  AS buildings_missing_location
  FROM buildings;
-- Expected (after 0004 backfill):
--   buildings_total            = 12
--   buildings_with_location    = 12
--   buildings_missing_location = 0
```

### 6.2 `route_nodes.location` populated for all 9 rows

```sql
SELECT COUNT(*)                                  AS nodes_total,
       COUNT(location)                           AS nodes_with_location,
       COUNT(*) FILTER (WHERE location IS NULL)  AS nodes_missing_location
  FROM route_nodes;
-- Expected:
--   nodes_total            = 9
--   nodes_with_location    = 9
--   nodes_missing_location = 0
```

### 6.3 Coordinates round-trip cleanly through PostGIS (optional)

Confirms each node's stored `lat` / `lng` matches the longitude /
latitude embedded in the PostGIS `location` point.

```sql
SELECT node_key,
       lat,
       lng,
       extensions.ST_Y(location::extensions.geometry) AS location_lat,
       extensions.ST_X(location::extensions.geometry) AS location_lng
  FROM route_nodes
 ORDER BY display_order;
-- Expected: lat = location_lat and lng = location_lng for all 9 rows.
```

The same query shape works for `buildings`; replace the table and
`ORDER BY` clause accordingly.

---

## 7. Route edges: directed graph with reverse pairs

`utils/pathfinding.js` reads `route_edges` as a plain directed graph
and never auto-reverses. Every undirected walkable connection must
therefore appear as TWO rows (A->B and B->A).

### 7.1 Every directed edge has its reverse counterpart

```sql
-- Expected: 0 rows. Each returned row is a missing reverse edge.
SELECT fn.node_key AS missing_reverse_from,
       tn.node_key AS missing_reverse_to
  FROM route_edges e
  JOIN route_nodes fn ON fn.id = e.from_node_id
  JOIN route_nodes tn ON tn.id = e.to_node_id
 WHERE NOT EXISTS (
    SELECT 1 FROM route_edges r
     WHERE r.from_node_id = e.to_node_id
       AND r.to_node_id   = e.from_node_id
 );
```

### 7.2 20 directed rows resolve to 10 unordered pairs

```sql
SELECT COUNT(*) AS unordered_pair_count
  FROM (
    SELECT LEAST(from_node_id, to_node_id)    AS a,
           GREATEST(from_node_id, to_node_id) AS b
      FROM route_edges
     GROUP BY 1, 2
  ) p;
-- Expected: unordered_pair_count = 10
```

### 7.3 No self-loops

```sql
-- Expected: 0 rows.
SELECT id, from_node_id, to_node_id
  FROM route_edges
 WHERE from_node_id = to_node_id;
```

---

## 8. Cloudinary placeholders stay NULL

`vr_scenes.cloudinary_public_id` must be `NULL` on every seeded row.
A later Cloudinary migration will populate it.

```sql
SELECT COUNT(*)                                                 AS scenes_total,
       COUNT(cloudinary_public_id)                              AS scenes_with_cloudinary_id,
       COUNT(*) FILTER (WHERE cloudinary_public_id IS NULL)     AS scenes_without_cloudinary_id
  FROM vr_scenes;
-- Expected:
--   scenes_total                 = 6
--   scenes_with_cloudinary_id    = 0
--   scenes_without_cloudinary_id = 6
```

`buildings.cloudinary_public_id` is similarly `NULL` at this phase:

```sql
SELECT COUNT(*) AS buildings_total,
       COUNT(*) FILTER (WHERE cloudinary_public_id IS NULL) AS buildings_without_cloudinary_id
  FROM buildings;
-- Expected (after 0004 backfill):
--   buildings_total                  = 12
--   buildings_without_cloudinary_id  = 12
```

---

## 9. Auth-related spot checks

### 9.1 No plaintext passwords

All four seeded local accounts must have a bcrypt hash (60 chars,
`$2[aby]$<cost>$<salt><hash>` format). Section 3.2 stores the seeded
demo passwords as pre-computed `bcrypt(10)` hashes.

```sql
-- Expected: 0 rows.
SELECT email
  FROM users
 WHERE password !~ '^\$2[aby]\$[0-9]{2}\$.{53}$';
```

The `password` column itself is intentionally not selected: avoid
displaying hashes in shared screenshots. Re-add `password` only when
deeply debugging a specific row.

### 9.2 Local demo seed rows are non-OAuth

Section 3.2 seeds only local accounts (`oauth_provider = 'local'`,
`oauth_subject IS NULL`). Google OAuth rows are added at runtime by
`controllers/authController.js`, so this check is scoped to the four
known demo emails to stay correct on projects that already have live
OAuth signups.

```sql
-- Expected: 0 rows.
SELECT email, oauth_provider, oauth_subject
  FROM users
 WHERE email IN (
        'admin@cspc.edu.ph',
        'aaron.lasprillas@cspc.edu.ph',
        'instructor.demo@cspc.edu.ph',
        'guest.demo@gmail.com'
       )
   AND (oauth_provider IS DISTINCT FROM 'local' OR oauth_subject IS NOT NULL);
```

The schema also guards this at the column level: `users.oauth_provider`
defaults to `'local'`, and the partial unique index
`users_oauth_provider_subject_uidx` only applies when
`oauth_subject IS NOT NULL`.

### 9.3 `users.role` values inside the CHECK allowed set

`0001_initial_schema.sql` declares
`CHECK (role IN ('student-cspc', 'instructor', 'admin', 'guest'))` on
`users.role`. The CHECK constraint blocks bad writes; the query below
verifies that the row data actually present after seeding is in range.

```sql
-- Expected: 0 rows.
SELECT email, role
  FROM users
 WHERE role NOT IN ('student-cspc', 'instructor', 'admin', 'guest');
```

### 9.4 `news_announcements.audience` values inside the CHECK allowed set

`0001_initial_schema.sql` declares
`CHECK (audience IN ('all', 'student-cspc', 'instructor', 'guest', 'admin'))`.

```sql
-- Expected: 0 rows.
SELECT title, audience
  FROM news_announcements
 WHERE audience NOT IN ('all', 'student-cspc', 'instructor', 'guest', 'admin');
```

---

## 10. Bonus structural checks (optional)

### 10.1 Each campus route has exactly 4 steps

```sql
SELECT cr.title, COUNT(s.id) AS step_count
  FROM campus_routes cr
  LEFT JOIN campus_route_steps s ON s.route_id = cr.id
 GROUP BY cr.title
 ORDER BY cr.title;
-- Expected: 4 rows, each with step_count = 4.
```

### 10.2 Each `campus_routes.destination_building_id` resolves to a building

```sql
-- Expected: 0 rows.
SELECT r.title
  FROM campus_routes r
  LEFT JOIN buildings b ON b.id = r.destination_building_id
 WHERE b.id IS NULL;
```

### 10.3 VR hotspot distribution per scene

```sql
SELECT vs.scene_key,
       COUNT(h.id)                                       AS hotspot_count,
       COUNT(*) FILTER (WHERE h.hotspot_type = 'scene')  AS nav_count,
       COUNT(*) FILTER (WHERE h.hotspot_type = 'info')   AS info_count,
       COUNT(*) FILTER (WHERE h.hotspot_type = 'exit')   AS exit_count
  FROM vr_scenes vs
  LEFT JOIN vr_hotspots h ON h.scene_id = vs.id
 GROUP BY vs.scene_key
 ORDER BY vs.scene_key;
```

Expected (15 hotspots total):

| `scene_key`        | `hotspot_count` | `nav_count` | `info_count` | `exit_count` |
| ------------------ | --------------- | ----------- | ------------ | ------------ |
| `scene-admin`      | 2               | 1           | 0            | 1            |
| `scene-ccs`        | 2               | 1           | 0            | 1            |
| `scene-flagpole`   | 5               | 5           | 0            | 0            |
| `scene-gym`        | 2               | 1           | 0            | 1            |
| `scene-library`    | 2               | 1           | 0            | 1            |
| `scene-main-gate`  | 2               | 1           | 1            | 0            |

### 10.4 Every navigation hotspot has a resolvable target scene

```sql
-- Expected: 0 rows.
SELECT h.id, h.scene_id, h.label
  FROM vr_hotspots h
 WHERE h.hotspot_type = 'scene'
   AND h.target_scene_id IS NULL;
```

---

## 11. What this document does NOT cover

This file is the data-side verification reference for Phase 3 of
Milestone 1. It does not replace:

- Plan Section 6.1 - Supabase SQL static verification (migration file
  shape: table count, index presence, qualified PostGIS type usage,
  parentheses balance, ASCII-only).
- Plan Section 6.2 - Supabase apply smoke test (actually applying
  `0001_initial_schema.sql` against a Supabase project and confirming
  the `extensions.postgis` extension and the full table set exist).
- Plan Section 6.3 - the live Supabase seed verification run (this
  document is the source of truth for the SQL used in that run).
- Plan Section 6.4 - server-side Supabase connectivity verification.

The current MySQL runtime remains the source of truth until later
milestones intentionally switch controllers. None of the queries above
require, or alter, that runtime.
