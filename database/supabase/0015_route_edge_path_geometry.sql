-- =============================================================================
-- 0015_route_edge_path_geometry.sql
-- Pre-Milestone-12 RF.2: Route edge drawing geometry (road-following lines)
-- =============================================================================
--
-- Purpose
--   The 0014 route graph selects correct destinations, but the public /map
--   line is drawn by connecting route-node coordinates, so longer edges cut
--   corners between nodes. This migration adds OPTIONAL per-edge drawing
--   geometry so a later section (RF.3/RF.5) can draw the selected route along
--   the actual campus roads/walkways:
--
--     route_edges.path_geometry jsonb NULL
--       - ordered JSON array of { "lat": number, "lng": number } points
--       - runs FROM the directed edge's from-node TO its to-node
--       - 2-200 points; reverse directed edges store the exact reversed
--         sequence of the forward edge
--       - authoritative for DRAWING only; route selection, distance, walk
--         time, accessibility, and ordered steps stay on the scalar fields
--
--   It also populates all 52 active directed edges (26 undirected pairs,
--   each geometry defined ONCE in forward orientation and the reverse row
--   derived mechanically) and installs the service-role-only atomic
--   forward/reverse write function for the future RF.4 admin editor.
--
-- Source and attribution
--   The waypoint dataset is owner-managed geometry traced from the
--   OpenStreetMap campus service roads/walkways that the application already
--   renders under its existing "(c) OpenStreetMap contributors" attribution
--   on both map renderers. No Google Maps, Google Earth, Strava, or other
--   restricted third-party route geometry is copied or persisted, and no
--   third-party routing API becomes a runtime dependency. Short genuinely
--   straight connections carry only their two endpoints; no waypoint crosses
--   mapped buildings, grass, or restricted areas.
--
-- Idempotency
--   - ADD COLUMN IF NOT EXISTS; constraint added only when absent.
--   - Geometry UPDATEs resolve edges/endpoints by route_nodes.node_key
--     (never hardcoded numeric ids) and simply re-set the same values on
--     re-run. Safe to apply repeatedly.
--
-- Boundaries
--   - Updates path_geometry ONLY. 0014 scalar fields (distance, walk time,
--     labels, accessibility), nodes, buildings, grants, RLS, sessions,
--     schedules, VR data, and Cloudinary metadata are untouched. 0014 is
--     owner-applied and immutable.
--   - Applied MANUALLY by the project owner in the Supabase SQL editor.
--   - No 0016 migration is created by this work.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Column (additive, nullable)
-- -----------------------------------------------------------------------------
ALTER TABLE public.route_edges
    ADD COLUMN IF NOT EXISTS path_geometry jsonb;


-- -----------------------------------------------------------------------------
-- 2. Shape constraint (idempotent): NULL, or a JSON array of 2-200 elements.
--    Per-point key/range validation lives in the application contract
--    (utils/routeGeometry.js) and the RF.4 admin write path.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname  = 'route_edges_path_geometry_shape'
           AND conrelid = 'public.route_edges'::regclass
    ) THEN
        ALTER TABLE public.route_edges
            ADD CONSTRAINT route_edges_path_geometry_shape
            CHECK (
                path_geometry IS NULL
                OR (
                    jsonb_typeof(path_geometry) = 'array'
                    AND jsonb_array_length(path_geometry) BETWEEN 2 AND 200
                )
            );
    END IF;
END
$$;


-- -----------------------------------------------------------------------------
-- 3. Geometry data: 26 undirected pairs -> 52 directed rows in ONE statement.
--    Each pair lists its INTERMEDIATE forward (a -> b) waypoints once; the
--    full forward shape is built as
--      exact live a-node coordinate + waypoints + exact live b-node coordinate
--    and the reverse row receives the mechanically reversed sequence
--    (jsonb_array_elements WITH ORDINALITY, descending). Endpoints therefore
--    always match the live route_nodes lat/lng values by construction.
--    Empty waypoint lists mark short genuinely straight connections.
-- -----------------------------------------------------------------------------
WITH pair_geometry(a_key, b_key, waypoints) AS (
    VALUES
        ('main-gate'::varchar, 'welcome-arch'::varchar, '[{"lat":13.40525,"lng":123.37380}]'::jsonb),
        ('welcome-arch',   'flagpole',       '[{"lat":13.40557,"lng":123.37430}]'),
        ('flagpole',       'admin-building', '[]'),
        ('admin-building', 'registrar',      '[]'),
        ('flagpole',       'library',        '[{"lat":13.40590,"lng":123.37478},{"lat":13.40617,"lng":123.37482},{"lat":13.40620,"lng":123.37492},{"lat":13.40621,"lng":123.37498}]'),
        ('flagpole',       'gymnasium',      '[{"lat":13.40572,"lng":123.37490}]'),
        ('library',        'gymnasium',      '[]'),
        ('admin-building', 'library',        '[{"lat":13.40617,"lng":123.37482},{"lat":13.40619,"lng":123.37487},{"lat":13.40620,"lng":123.37492},{"lat":13.40621,"lng":123.37498}]'),
        ('flagpole',       'ictu',           '[]'),
        ('gymnasium',      'canteen',        '[]'),
        ('library',        'canteen',        '[]'),
        ('library',        'auditorium',     '[]'),
        ('ictu',           'mid-campus',     '[{"lat":13.40562,"lng":123.37486},{"lat":13.40560,"lng":123.37505}]'),
        ('gymnasium',      'mid-campus',     '[{"lat":13.40561,"lng":123.37525}]'),
        ('mid-campus',     'auditorium',     '[{"lat":13.40620,"lng":123.37559}]'),
        ('mid-campus',     'east-walk',      '[{"lat":13.40562,"lng":123.37586},{"lat":13.40565,"lng":123.37608}]'),
        ('east-walk',      'green-building', '[]'),
        ('east-walk',      'cas',            '[{"lat":13.40583,"lng":123.37675},{"lat":13.40592,"lng":123.37674}]'),
        ('green-building', 'cas',            '[{"lat":13.40596,"lng":123.37673}]'),
        ('cas',            'ccs',            '[]'),
        ('cas',            'clinic',         '[]'),
        ('ccs',            'chs',            '[{"lat":13.40548,"lng":123.37722}]'),
        ('main-gate',      'west-road',      '[]'),
        ('west-road',      'engineering',    '[]'),
        ('west-road',      'main-academic',  '[]'),
        ('main-academic',  'flagpole',       '[{"lat":13.40578,"lng":123.37420},{"lat":13.40575,"lng":123.37441}]')
),
shaped AS (
    SELECT an.id AS a_id,
           bn.id AS b_id,
           jsonb_build_array(jsonb_build_object('lat', an.lat, 'lng', an.lng))
             || p.waypoints
             || jsonb_build_array(jsonb_build_object('lat', bn.lat, 'lng', bn.lng)) AS forward_geometry
      FROM pair_geometry p
      JOIN public.route_nodes an ON an.node_key = p.a_key
      JOIN public.route_nodes bn ON bn.node_key = p.b_key
),
directed AS (
    -- forward rows: geometry as defined
    SELECT s.a_id AS from_id, s.b_id AS to_id, s.forward_geometry AS geometry
      FROM shaped s
    UNION ALL
    -- reverse rows: the exact reversed forward sequence, derived mechanically
    SELECT s.b_id,
           s.a_id,
           (SELECT jsonb_agg(t.elem ORDER BY t.ord DESC)
              FROM jsonb_array_elements(s.forward_geometry) WITH ORDINALITY AS t(elem, ord))
      FROM shaped s
)
UPDATE public.route_edges e
   SET path_geometry = d.geometry
  FROM directed d
 WHERE e.from_node_id = d.from_id
   AND e.to_node_id   = d.to_id;


-- -----------------------------------------------------------------------------
-- 4. Atomic forward/reverse geometry write for the future RF.4 admin editor.
--    One call updates BOTH directed rows of an undirected campus connection
--    (forward geometry as submitted, reverse as the exact reversed sequence)
--    inside a single function transaction, or raises a FIXED error without a
--    partial pair update. The application validates the per-point contract
--    (utils/routeGeometry.js) BEFORE calling; this function re-checks only
--    the structural array/length shape as defense in depth.
--    Same security idiom as 0007: SECURITY INVOKER + pinned search_path,
--    EXECUTE revoked from PUBLIC/anon/authenticated, granted to service_role
--    only (the server-side client; this key never reaches a browser).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_set_route_edge_geometry_pair(
    p_from_node_id bigint,
    p_to_node_id   bigint,
    p_geometry     jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_forward_id bigint;
    v_reverse_id bigint;
    v_reversed   jsonb;
    v_count      integer := 0;
BEGIN
    IF p_geometry IS NULL
       OR jsonb_typeof(p_geometry) <> 'array'
       OR jsonb_array_length(p_geometry) < 2
       OR jsonb_array_length(p_geometry) > 200 THEN
        RAISE EXCEPTION 'INVALID_GEOMETRY';
    END IF;

    SELECT id INTO v_forward_id
      FROM public.route_edges
     WHERE from_node_id = p_from_node_id
       AND to_node_id   = p_to_node_id;

    SELECT id INTO v_reverse_id
      FROM public.route_edges
     WHERE from_node_id = p_to_node_id
       AND to_node_id   = p_from_node_id;

    IF v_forward_id IS NULL OR v_reverse_id IS NULL THEN
        RAISE EXCEPTION 'EDGE_PAIR_NOT_FOUND';
    END IF;

    SELECT jsonb_agg(t.elem ORDER BY t.ord DESC)
      INTO v_reversed
      FROM jsonb_array_elements(p_geometry) WITH ORDINALITY AS t(elem, ord);

    UPDATE public.route_edges SET path_geometry = p_geometry  WHERE id = v_forward_id;
    v_count := v_count + 1;

    UPDATE public.route_edges SET path_geometry = v_reversed WHERE id = v_reverse_id;
    v_count := v_count + 1;

    RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.app_set_route_edge_geometry_pair(bigint, bigint, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.app_set_route_edge_geometry_pair(bigint, bigint, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.app_set_route_edge_geometry_pair(bigint, bigint, jsonb) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.app_set_route_edge_geometry_pair(bigint, bigint, jsonb) TO service_role;


-- -----------------------------------------------------------------------------
-- Notes for reviewers and follow-up
-- -----------------------------------------------------------------------------
-- - Apply manually in the Supabase SQL editor after Codex reviews RF.2.
--   Re-applying is safe (idempotent column/constraint; geometry re-set).
-- - Live Supabase path_geometry verification (column, 52/52 coverage,
--   forward/reverse parity) is deferred until AFTER owner application.
-- - RF.3 will read this column through repositories/routeRepository.js
--   (explicit column list) and assemble the flattened route.geometry in
--   controllers/mapController.js. RF.4 will call
--   app_set_route_edge_geometry_pair for admin edits.
-- =============================================================================
