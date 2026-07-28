-- =============================================================================
-- CampuSphere — Migration 0017: Guard House start + eastern route topology
-- Pre-RF.6 repair. Supabase / PostgreSQL.
-- =============================================================================
--
-- OWNER-APPLIED: run this once in the Supabase SQL editor. Agents never apply it.
--
-- WHY
-- ---
-- Four route-data defects blocked RF.6:
--
--   1. The `main-gate` node did not sit on the approved Guard House / Main Gate
--      position, so every computed route started from the wrong point.
--
--   2. The eastern academic buildings (CAS, CCS, Clinic, CHS, Green Building)
--      were wired to each other, so they acted as TRANSIT hops rather than
--      terminal destinations. The CCS route, for example, ran
--      east-walk -> CAS -> CCS, walking a user through a different college to
--      reach their destination.
--
--   3. GUARD HOUSE HAIRPIN. The authoritative gate sits only ~22 m due west of
--      the Flagpole Quadrangle, but the sole edge out of the gate toward campus
--      was main-gate -> welcome-arch. Reaching the flagpole therefore walked
--      ~125 m: 54 m SOUTH-WEST to the arch, then 71 m back NORTH-EAST — a
--      visible doubling-back at the head of every central/eastern route.
--
--   4. BUILDING-BACKED TRANSIT. ICTU, the Gymnasium and the Auditorium are
--      building DESTINATIONS, yet they carried the only edges into
--      `mid-campus`, so EVERY eastern route was forced to route THROUGH a
--      building (flagpole -> ictu -> mid-campus -> east-walk).
--
-- WHAT THIS MIGRATION DOES (all inside ONE transaction)
-- -----------------------------------------------------
--   0. Fail-closed preflight: every route-node natural key this migration
--      depends on must exist, or the whole transaction aborts (no silently
--      partial repair).
--   1. Moves `main-gate` to the authoritative coordinate and refreshes its
--      PostGIS `location` (same schema-qualified expression as 0014).
--   2. Retires BOTH directions of the four eastern transit pairs AND the three
--      building-to-mid-campus transit pairs.
--   3. Upserts the eight repaired pairs — 2 attached to the moved gate, 4
--      eastern terminal spurs, plus the direct main-gate <-> flagpole entrance
--      walkway and the flagpole <-> mid-campus spine — forward and
--      mechanically-reversed, with geometry.
--
-- ICTU, the Gymnasium and the Auditorium remain fully reachable as TERMINAL
-- destinations (flagpole<->ictu, flagpole<->gymnasium and library<->auditorium
-- are untouched); they simply stop being routing junctions.
--
-- Authoritative Guard House / Main Gate coordinate:
--     13.40575220764974, 123.37434735272177
-- `route_nodes.lat/lng` are numeric(10,8) / numeric(11,8), so the persisted
-- value is the 8-dp form 13.40575221 / 123.37434735 — within 2.4e-9 of the
-- authoritative value and far inside the 1e-6 endpoint epsilon that
-- utils/routeGeometry.js enforces. The MySQL seed persists the identical 8-dp
-- value, so the two backends stay in parity. The node_key stays `main-gate`;
-- user-facing "Guard House / Main Gate" labelling is unchanged.
--
-- 0016 INTERACTION (NODE_GEOMETRY_ATTACHED)
-- -----------------------------------------
-- 0016's `app_update_route_node` RPC deliberately REFUSES to move a route node
-- that still has non-null geometry attached to its edges (NODE_GEOMETRY_ATTACHED),
-- because moving a node under a stored line silently breaks endpoint continuity.
-- That runtime guard is correct and is NOT weakened here. This migration instead
-- performs the coordinated repair directly and atomically: the node move and the
-- rewrite of every geometry attached to it happen in the SAME transaction, so the
-- graph is never observable in a state where a node has moved away from its
-- attached line. 0016's functions, grants, and privileges are untouched.
--
-- SAFETY
-- ------
--   - Idempotent: re-running changes nothing (natural-key upsert, guarded delete).
--   - Natural keys only: every node is resolved by `node_key`. No numeric
--     node/building id is hardcoded anywhere.
--   - Geometry endpoints are built FROM THE LIVE node rows, so the first/last
--     points always match the stored node coordinates exactly — the shape cannot
--     drift out of endpoint continuity even if a node coordinate differs slightly
--     between backends.
--   - Reverse rows are derived MECHANICALLY from the forward shape (exact
--     reversed sequence), so forward/reverse can never diverge.
--   - Touches ONLY `route_nodes` (one row) and `route_edges`. RLS, grants,
--     policies, sessions, room schedules, VR scenes/hotspots, Cloudinary media
--     metadata, buildings, campus_routes, and every unrelated route row are
--     left exactly as they are.
--
-- Geometry provenance: owner-managed traces of the campus service roads and
-- walkways already displayed under the app's existing OpenStreetMap attribution.
-- No Google Maps / Google Earth / Strava / external routing service is used, and
-- no trace cuts a diagonal through a mapped building footprint.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Fail-closed preflight: every required natural key must exist
-- -----------------------------------------------------------------------------
-- Every statement below resolves nodes by `node_key`. If a prerequisite key is
-- missing, those JOINs would simply match zero rows and the migration would
-- "succeed" while applying only part of the repair. Abort instead: RAISE inside
-- this transaction rolls the whole migration back, so the graph is never left
-- half-corrected.
DO $$
DECLARE
    required_keys text[] := ARRAY[
        'main-gate', 'welcome-arch', 'flagpole', 'mid-campus', 'east-walk', 'west-road',
        'green-building', 'cas', 'ccs', 'clinic', 'chs',
        'ictu', 'gymnasium', 'auditorium'
    ];
    missing_keys text;
BEGIN
    -- `unnest(...) AS req(node_key)` names BOTH the table-function relation and
    -- its scalar output column. A bare `AS k` would alias only the relation and
    -- leave every `k` reference below resolving through an implicit column of the
    -- same name, so the scalar is referenced explicitly as `req.node_key`.
    SELECT string_agg(req.node_key, ', ' ORDER BY req.node_key)
      INTO missing_keys
      FROM unnest(required_keys) AS req(node_key)
     WHERE NOT EXISTS (
         SELECT 1 FROM public.route_nodes rn WHERE rn.node_key = req.node_key
     );

    IF missing_keys IS NOT NULL THEN
        RAISE EXCEPTION
            'Migration 0017 preflight FAILED: route_nodes is missing required node_key(s): %. Migration aborted; no changes applied.',
            missing_keys;
    END IF;
END
$$;


-- -----------------------------------------------------------------------------
-- 1. Authoritative Guard House / Main Gate coordinate
-- -----------------------------------------------------------------------------
-- ST_MakePoint takes (lng, lat) — longitude first. The schema-qualified
-- extensions.* calls mirror 0001/0002/0014 so this never depends on the
-- `extensions` schema being in search_path.
UPDATE public.route_nodes
   SET lat        = 13.40575221::numeric,
       lng        = 123.37434735::numeric,
       location   = extensions.ST_SetSRID(
                        extensions.ST_MakePoint(123.37434735::double precision,
                                                13.40575221::double precision),
                        4326)::extensions.geography,
       updated_at = now()
 WHERE node_key = 'main-gate';


-- -----------------------------------------------------------------------------
-- 2. Retire every TRANSIT pair (both directions)
-- -----------------------------------------------------------------------------
-- (a) Eastern buildings used as through-routes between other eastern buildings.
--     Replaced by the terminal spurs in step 3.
--       green-building <-> cas
--       cas            <-> ccs
--       cas            <-> clinic
--       ccs            <-> chs
--
-- (b) Building-backed junctions into mid-campus. ICTU, the Gymnasium and the
--     Auditorium are DESTINATIONS, not junctions, but they held the only edges
--     into mid-campus, forcing every eastern route THROUGH a building. Replaced
--     by the flagpole <-> mid-campus walkway spine in step 3. All three remain
--     reachable as terminal destinations via flagpole<->ictu,
--     flagpole<->gymnasium and library<->auditorium, which are NOT touched.
--       ictu       <-> mid-campus
--       gymnasium  <-> mid-campus
--       auditorium <-> mid-campus
DELETE FROM public.route_edges e
 USING public.route_nodes a,
       public.route_nodes b
 WHERE (a.node_key, b.node_key) IN (
           ('green-building', 'cas'),
           ('cas',            'ccs'),
           ('cas',            'clinic'),
           ('ccs',            'chs'),
           ('ictu',           'mid-campus'),
           ('gymnasium',      'mid-campus'),
           ('auditorium',     'mid-campus')
       )
   AND (   (e.from_node_id = a.id AND e.to_node_id = b.id)
        OR (e.from_node_id = b.id AND e.to_node_id = a.id));


-- -----------------------------------------------------------------------------
-- 3. Upsert the six repaired pairs (forward + exact mechanical reverse)
-- -----------------------------------------------------------------------------
-- `mid` holds ONLY the intermediate waypoints. The stored forward shape is
-- built as: exact live a-node coordinate + mid + exact live b-node coordinate.
-- The reverse row stores that same sequence reversed, element for element.
--
-- Distances are haversine metres along the COMPLETED traced shape (rounded) and
-- walk times use the project's ~1.2 m/s pace (rounded) — the same values the
-- MySQL seed derives from the identical geometry.
--
--   main-gate <-> welcome-arch   rebuilt for the moved gate
--   main-gate <-> flagpole       NEW direct entrance walkway (kills the hairpin)
--   main-gate <-> west-road      rebuilt for the moved gate
--   flagpole  <-> mid-campus     NEW walkway spine (kills the ICTU transit)
--   east-walk <-> cas            redrawn; CAS is now terminal
--   east-walk <-> ccs            NEW terminal spur (replaces east-walk->CAS->CCS)
--   east-walk <-> clinic         NEW terminal spur (replaces CAS->Clinic)
--   east-walk <-> chs            NEW terminal spur (replaces CCS->CHS)
--
-- The eastern corridor spine runs north-south at lng ~123.37675-123.37680,
-- between the Green Building (west) and the CAS / CCS / Clinic / CHS blocks
-- (east); each building spurs off it perpendicular, so no trace crosses a
-- building footprint. The flagpole <-> mid-campus spine runs east at
-- lat ~13.4057, passing NORTH of ICTU and SOUTH of the Gymnasium so it clears
-- both footprints. east-walk <-> green-building, flagpole <-> ictu,
-- flagpole <-> gymnasium and library <-> auditorium are unchanged and are
-- intentionally not touched.
WITH pair(a_key, b_key, meters, seconds, label, mid) AS (
    VALUES
        ('main-gate'::varchar, 'welcome-arch'::varchar, 54::integer, 45::integer,
         'Main pathway'::varchar,
         '[{"lat":13.40559,"lng":123.37419}]'::jsonb),

        -- Direct Guard House -> Flagpole Quadrangle entrance walkway (~22 m).
        -- This becomes the selected shortest path for every central/eastern
        -- destination, replacing the ~125 m welcome-arch doubling-back.
        ('main-gate', 'flagpole', 22, 18,
         'Main gate entrance walkway',
         '[{"lat":13.40576,"lng":123.37445}]'::jsonb),

        ('main-gate', 'west-road', 84, 70,
         'West campus road',
         '[{"lat":13.40556,"lng":123.3741},
           {"lat":13.40545,"lng":123.37385}]'::jsonb),

        -- Flagpole -> Mid-Campus walkway spine (~116 m). Runs north of ICTU and
        -- south of the Gymnasium, so mid-campus no longer depends on a building
        -- node as a routing junction.
        ('flagpole', 'mid-campus', 116, 97,
         'South campus road',
         '[{"lat":13.40573,"lng":123.3748},
           {"lat":13.40571,"lng":123.3751},
           {"lat":13.40567,"lng":123.37535}]'::jsonb),

        ('east-walk', 'cas', 76, 63,
         'East corridor',
         '[{"lat":13.40583,"lng":123.37675},
           {"lat":13.40592,"lng":123.37674}]'::jsonb),

        ('east-walk', 'ccs', 87, 73,
         'East corridor to CCS',
         '[{"lat":13.40583,"lng":123.37675},
           {"lat":13.40567,"lng":123.37677},
           {"lat":13.40566,"lng":123.37694}]'::jsonb),

        ('east-walk', 'clinic', 108, 90,
         'East corridor to Clinic',
         '[{"lat":13.40583,"lng":123.37675},
           {"lat":13.406,"lng":123.37678},
           {"lat":13.40614,"lng":123.3768},
           {"lat":13.40615,"lng":123.37701}]'::jsonb),

        ('east-walk', 'chs', 143, 119,
         'East corridor to CHS',
         '[{"lat":13.40583,"lng":123.37675},
           {"lat":13.40567,"lng":123.37677},
           {"lat":13.4055,"lng":123.37685},
           {"lat":13.40546,"lng":123.37722}]'::jsonb)
),
built AS (
    SELECT
        na.id AS a_id,
        nb.id AS b_id,
        p.meters,
        p.seconds,
        p.label,
        -- exact live a-node coordinate + intermediate waypoints + exact live
        -- b-node coordinate  =>  endpoint continuity holds by construction
        jsonb_build_array(
            jsonb_build_object('lat', na.lat::double precision,
                               'lng', na.lng::double precision))
        || p.mid
        || jsonb_build_array(
            jsonb_build_object('lat', nb.lat::double precision,
                               'lng', nb.lng::double precision)) AS fwd
      FROM pair p
      JOIN public.route_nodes na ON na.node_key = p.a_key
      JOIN public.route_nodes nb ON nb.node_key = p.b_key
),
dir AS (
    -- forward directed row
    SELECT a_id AS from_id, b_id AS to_id, meters, seconds, label, fwd AS geom
      FROM built
    UNION ALL
    -- reverse directed row: the EXACT reversed point sequence
    SELECT b_id, a_id, meters, seconds, label,
           (SELECT jsonb_agg(t.elem ORDER BY t.ord DESC)
              FROM jsonb_array_elements(built.fwd) WITH ORDINALITY AS t(elem, ord))
      FROM built
)
INSERT INTO public.route_edges (
    from_node_id,
    to_node_id,
    distance_meters,
    walk_time_seconds,
    path_label,
    is_accessible,
    path_geometry
)
SELECT from_id, to_id, meters, seconds, label, true, geom
  FROM dir
ON CONFLICT (from_node_id, to_node_id) DO UPDATE
    SET distance_meters   = EXCLUDED.distance_meters,
        walk_time_seconds = EXCLUDED.walk_time_seconds,
        path_label        = EXCLUDED.path_label,
        is_accessible     = EXCLUDED.is_accessible,
        path_geometry     = EXCLUDED.path_geometry;

COMMIT;

-- =============================================================================
-- Post-apply expectation (matches the MySQL seed exactly):
--   route_nodes : 20 rows; main-gate at 13.40575221, 123.37434735
--   route_edges : 48 directed rows = 24 undirected pairs, all with geometry
--   retired     : green-building<->cas, cas<->ccs, cas<->clinic, ccs<->chs,
--                 ictu<->mid-campus, gymnasium<->mid-campus,
--                 auditorium<->mid-campus  — all absent in BOTH directions
--   central spine (no hairpin, no building transit):
--                 main-gate -> flagpole -> mid-campus -> east-walk -> <dest>
--   eastern     : CAS, CCS, Clinic, CHS, Green Building are TERMINAL nodes,
--                 each reached directly from east-walk (East Corridor Junction)
--   terminals   : ICTU / Gymnasium reached from flagpole; Auditorium from library
-- Verify with:  node scripts/routeTopology-probe.js
-- =============================================================================
