-- =============================================================================
-- CampuSphere — Migration 0018: canonical College of Arts and Sciences baseline
-- BE.2 correction-only batch. Supabase / PostgreSQL.
-- =============================================================================
--
-- OWNER-APPLIED: run this once in the Supabase SQL editor. Agents never apply it.
--
-- WHY
-- ---
-- The College of Arts and Sciences (CAS) was originally created through the
-- admin UI rather than through the seed, so it was never part of the canonical
-- static roster. Migration 0014 already created the `cas` ROUTE NODE and noted
-- that the CAS building "was added through the admin UI in some environments".
-- The result is that the 13-destination baseline is not reproducible from source
-- control: a clean rebuild yields 12 buildings and a `cas` node whose
-- building_id is NULL, which makes CAS silently unroutable.
--
-- BE.2 makes CAS canonical in models/data.js (MySQL side) and makes the SAME
-- guarantee here for Supabase.
--
-- WHAT THIS MIGRATION DOES (all inside ONE transaction)
-- -----------------------------------------------------
--   0a. CONCURRENCY LOCKS, taken immediately after BEGIN and BEFORE any read:
--          LOCK TABLE public.buildings   IN SHARE ROW EXCLUSIVE MODE;
--          LOCK TABLE public.route_nodes IN SHARE ROW EXCLUSIVE MODE;
--       `buildings.name` has NO unique constraint and the admin building
--       create/update RPCs write `name`, so an unlocked preflight is a TOCTOU
--       race: a concurrent admin insert/rename could add a SECOND CAS row after
--       the check, making the update-or-insert multi-row and the route-node link
--       ambiguous. The locks block concurrent writers (reads still work) and are
--       held through preflight, writes, postcondition, and COMMIT. Lock order is
--       fixed (buildings, then route_nodes) so concurrent transactions cannot
--       deadlock. An advisory lock would be useless: admin writes do not take one.
--   0b. Fail-closed preflight (under those locks):
--        - at most ONE buildings row may carry the canonical CAS name
--          (a duplicate is ambiguous -> abort rather than pick one);
--        - EXACTLY ONE route_nodes row with node_key = 'cas' must exist
--          (0014 created it; a missing or duplicated node -> abort).
--   1. Update-or-insert the canonical CAS building row (resolved BY NAME) and
--      refresh its PostGIS `location` using the same schema-qualified
--      expression as 0001/0002/0014.
--   2. Link ONLY the `cas` route node to the resolved CAS building.
--   3. Fail-closed POSTCONDITION before COMMIT: exactly one canonical CAS
--      building, exactly one `cas` node, and exactly one joined row proving the
--      node is linked to that building. Any failure rolls the WHOLE transaction
--      back — the migration is all-or-nothing.
--
-- OWNER-CONFIRMED CANONICAL VALUES (the approved minimum — nothing else):
--     name        College of Arts and Sciences
--     category    Academic
--     description College of Arts and Sciences
--     lat         13.40594916
--     lng         123.37704274
--
-- Every unknown attribute stays EMPTY. This migration does NOT write details,
-- entrances, floors, rooms, landmarks, walk time, image_url, or
-- cloudinary_public_id, and it invents no coordinate or entrance.
--
-- SAFETY / SCOPE
-- -------------
--   - Idempotent: re-running changes nothing (resolve by name, update-or-insert,
--     guarded node link).
--   - Natural keys only: the building is resolved by NAME and the node by
--     node_key = 'cas'. No numeric building/node id is hardcoded anywhere.
--   - `buildings.name` has NO unique constraint, so this deliberately does an
--     explicit UPDATE-then-INSERT-if-absent rather than ON CONFLICT.
--   - DATA-ONLY. Touches ONLY `buildings` (one row) and `route_nodes`
--     (the one `cas` row's building_id). It does NOT alter route_edges,
--     path_geometry, the route topology/counts, VR scenes/hotspots, room
--     schedules, media, RLS, policies, grants, privileges, functions, sessions,
--     or authentication.
--   - Migrations 0014-0017 are owner-applied and remain byte-for-byte untouched.
--
-- Post-apply expectation:
--     buildings          : 13 rows; exactly one named 'College of Arts and Sciences'
--     route_nodes        : still 20 rows; `cas` node building_id -> that CAS row
--     route_edges        : UNCHANGED (48 directed rows / 24 reverse pairs / 48 geometries)
--     routable           : 13/13 destinations from main-gate
-- Verify with:  node scripts/buildingBaseline-probe.js
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0a. CONCURRENCY LOCKS — taken FIRST, before any preflight read
-- -----------------------------------------------------------------------------
-- `buildings.name` has NO unique constraint, and the admin building
-- create/update RPCs write `name` at runtime. Without locking, this migration
-- has a TOCTOU race: the preflight below could observe exactly one (or zero)
-- CAS rows, and a concurrent admin insert or rename could then add a SECOND row
-- named 'College of Arts and Sciences' before the UPDATE/INSERT runs. The
-- update-or-insert would then hit multiple rows, and the `UPDATE ... FROM` that
-- links the `cas` route node would join ambiguously and bind the node to an
-- arbitrary duplicate.
--
-- SHARE ROW EXCLUSIVE blocks concurrent writers (INSERT/UPDATE/DELETE) and other
-- SHARE ROW EXCLUSIVE holders, while still permitting plain reads — so the admin
-- UI keeps rendering, but no admin write can interleave with this migration.
--
-- These locks are held for the REST of the transaction: they cover the preflight,
-- the CAS update-or-insert, the route-node link, the final postcondition, and
-- COMMIT. Postgres releases them only at COMMIT/ROLLBACK.
--
-- LOCK ORDER IS DETERMINISTIC: buildings, then route_nodes. Always acquire in
-- this order (here and in any future migration touching both) so two concurrent
-- transactions cannot deadlock by grabbing them in opposite orders.
--
-- An advisory lock would NOT work here: the existing admin write paths do not
-- take advisory locks, so they would simply ignore it and race anyway. Only a
-- real table lock actually blocks them.
LOCK TABLE public.buildings   IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.route_nodes IN SHARE ROW EXCLUSIVE MODE;


-- -----------------------------------------------------------------------------
-- 0b. Fail-closed preflight (runs under the locks above)
-- -----------------------------------------------------------------------------
-- Abort rather than guess. RAISE inside this transaction rolls the whole
-- migration back, so the dataset is never left half-corrected. Messages carry
-- only fixed text and counts — never row values, ids, or coordinates.
DO $$
DECLARE
    building_count integer;
    node_count     integer;
BEGIN
    SELECT count(*) INTO building_count
      FROM public.buildings b
     WHERE b.name = 'College of Arts and Sciences';

    IF building_count > 1 THEN
        RAISE EXCEPTION
            'Migration 0018 preflight FAILED: found % buildings rows named "College of Arts and Sciences"; expected at most 1. Ambiguous target; migration aborted, no changes applied.',
            building_count;
    END IF;

    SELECT count(*) INTO node_count
      FROM public.route_nodes rn
     WHERE rn.node_key = 'cas';

    IF node_count <> 1 THEN
        RAISE EXCEPTION
            'Migration 0018 preflight FAILED: found % route_nodes rows with node_key = ''cas''; expected exactly 1 (migration 0014 creates it). Migration aborted; no changes applied.',
            node_count;
    END IF;
END
$$;


-- -----------------------------------------------------------------------------
-- 1. Canonical CAS building: update-or-insert, resolved BY NAME
-- -----------------------------------------------------------------------------
-- ST_MakePoint takes (lng, lat) — longitude first. The schema-qualified
-- extensions.* calls mirror 0001/0002/0014 so this never depends on the
-- `extensions` schema being in search_path.
--
-- Only the owner-confirmed canonical columns are written. details, image_url and
-- cloudinary_public_id are intentionally NOT touched on the UPDATE path, so any
-- value an admin already entered is preserved and no media is assigned here.
UPDATE public.buildings
   SET category    = 'Academic',
       description = 'College of Arts and Sciences',
       lat         = 13.40594916::numeric,
       lng         = 123.37704274::numeric,
       location    = extensions.ST_SetSRID(
                         extensions.ST_MakePoint(123.37704274::double precision,
                                                 13.40594916::double precision),
                         4326)::extensions.geography,
       updated_at  = now()
 WHERE name = 'College of Arts and Sciences';

-- Insert only when absent (idempotent; no unique constraint on name to rely on).
INSERT INTO public.buildings (name, category, description, lat, lng, location)
SELECT 'College of Arts and Sciences',
       'Academic',
       'College of Arts and Sciences',
       13.40594916::numeric,
       123.37704274::numeric,
       extensions.ST_SetSRID(
           extensions.ST_MakePoint(123.37704274::double precision,
                                   13.40594916::double precision),
           4326)::extensions.geography
 WHERE NOT EXISTS (
     SELECT 1 FROM public.buildings b
      WHERE b.name = 'College of Arts and Sciences'
 );


-- -----------------------------------------------------------------------------
-- 2. Link ONLY the `cas` route node to the resolved CAS building
-- -----------------------------------------------------------------------------
-- The node's coordinates, key, label, type and display_order are NOT changed —
-- 0014 already owns those. This sets building_id (and nothing else) so the node
-- becomes a real destination instead of an unmapped one. No other node is touched.
UPDATE public.route_nodes rn
   SET building_id = b.id,
       updated_at  = now()
  FROM public.buildings b
 WHERE rn.node_key = 'cas'
   AND b.name = 'College of Arts and Sciences'
   AND rn.building_id IS DISTINCT FROM b.id;


-- -----------------------------------------------------------------------------
-- 3. Fail-closed POSTCONDITION — proves the end state before COMMIT
-- -----------------------------------------------------------------------------
-- Still under the SHARE ROW EXCLUSIVE locks from step 0a, so what this observes
-- is exactly what COMMIT will publish; no writer can slip in between this check
-- and the COMMIT.
--
-- The preflight proves the STARTING state was sane. This proves the FINAL state
-- is correct: exactly one canonical CAS building, exactly one `cas` route node,
-- and exactly one joined row where that node is linked to that building. Any
-- failure raises and rolls the ENTIRE transaction back — the migration is
-- all-or-nothing, and can never leave a half-linked or ambiguous baseline.
--
-- Messages carry fixed text and counts ONLY — never row values, ids,
-- coordinates, stored data, SQL text, hosts, keys, or raw error output.
DO $$
DECLARE
    building_count integer;
    node_count     integer;
    linked_count   integer;
BEGIN
    SELECT count(*) INTO building_count
      FROM public.buildings b
     WHERE b.name = 'College of Arts and Sciences';

    IF building_count <> 1 THEN
        RAISE EXCEPTION
            'Migration 0018 postcondition FAILED: expected exactly 1 buildings row named "College of Arts and Sciences", found %. Transaction rolled back; no changes applied.',
            building_count;
    END IF;

    SELECT count(*) INTO node_count
      FROM public.route_nodes rn
     WHERE rn.node_key = 'cas';

    IF node_count <> 1 THEN
        RAISE EXCEPTION
            'Migration 0018 postcondition FAILED: expected exactly 1 route_nodes row with node_key = ''cas'', found %. Transaction rolled back; no changes applied.',
            node_count;
    END IF;

    SELECT count(*) INTO linked_count
      FROM public.route_nodes rn
      JOIN public.buildings b
        ON b.id = rn.building_id
     WHERE rn.node_key = 'cas'
       AND b.name = 'College of Arts and Sciences';

    IF linked_count <> 1 THEN
        RAISE EXCEPTION
            'Migration 0018 postcondition FAILED: the ''cas'' route node is not linked to the canonical CAS building (expected exactly 1 joined row, found %). Transaction rolled back; no changes applied.',
            linked_count;
    END IF;
END
$$;

COMMIT;

-- =============================================================================
-- Post-apply verification (read-only):
--   node scripts/buildingBaseline-probe.js
--   node scripts/routeTopology-probe.js
-- Expect: 13 buildings, exactly one CAS, `cas` node linked to it, and the route
-- graph UNCHANGED at 20 nodes / 48 directed edges / 24 reverse pairs /
-- 48 valid geometries / 13 routable destinations.
-- =============================================================================
