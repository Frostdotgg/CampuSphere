-- =============================================================================
-- 0016_route_geometry_admin_writes.sql
-- Pre-Milestone-12 RF.4: Admin road-geometry write backstops
-- (revised by the RF.4 NO-GO repair — Finding 2: node/geometry concurrency race)
-- =============================================================================
--
-- Purpose
--   RF.4 adds an admin editor that maintains route_edges.path_geometry through
--   the authenticated /admin/api/route-edges/:id/geometry endpoint. This
--   migration supplies the two service-role-only Supabase backstops that
--   endpoint relies on. Both functions now take their row locks in a
--   deterministic order and validate under lock, so a concurrent node move and
--   geometry write can never store a line whose endpoints no longer match the
--   node coordinates:
--
--     1. app_set_route_edge_geometry_pair(from, to, geometry)
--        - Locks BOTH endpoint route_nodes FOR UPDATE in ascending-id order.
--        - Confirms both endpoint nodes exist (else EDGE_PAIR_NOT_FOUND).
--        - Locks BOTH directed route_edges FOR UPDATE in ascending-id order and
--          resolves which locked row is forward and which is reverse.
--        - NULL clears both rows atomically.
--        - A non-null value is validated INSIDE the function against the locked
--          node coordinates: it must be an array of 2-200 elements whose first
--          and last points carry numeric lat/lng matching the locked from/to
--          node coordinates within 1e-6. Any malformed or endpoint-mismatched
--          geometry raises ONLY INVALID_GEOMETRY. The reverse row receives the
--          exact reversed sequence.
--
--     2. app_update_route_node(...)
--        - Locks the target route_node FOR UPDATE before comparing coordinates.
--        - Rejects a lat/lng change (beyond the 1e-6 tolerance) with a fixed
--          NODE_GEOMETRY_ATTACHED error while any edge touching the node stores
--          non-null geometry. Metadata-only edits (label, type, building,
--          order, or unchanged coordinates) still succeed. Same signature,
--          return type, PostGIS location recompute, and privileges as 0007.
--
-- Security (unchanged from 0007/0015)
--   Both functions keep SECURITY INVOKER, pinned search_path, fixed error
--   identifiers, and service_role-only EXECUTE (revoked from PUBLIC / anon /
--   authenticated). The 0015 path_geometry column, its 2-200 array CHECK, and
--   all 0014/0015 data are preserved byte-for-byte and untouched here.
--
-- Application error mapping (controllers/adminRouteController.js handleErr)
--   INVALID_GEOMETRY        -> 400
--   EDGE_PAIR_NOT_FOUND     -> 409
--   NODE_GEOMETRY_ATTACHED  -> 409
--
-- Boundaries
--   Applied MANUALLY by the project owner in the Supabase SQL editor AFTER
--   Codex reviews the RF.4 repair. Idempotent and safe to rerun. Creates no
--   0017.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. app_set_route_edge_geometry_pair — deterministic locking + validate-under-
--    lock; NULL clears both directions, non-null stores forward + exact reverse.
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
    v_low_id     bigint := least(p_from_node_id, p_to_node_id);
    v_high_id    bigint := greatest(p_from_node_id, p_to_node_id);
    v_node_count integer;
    v_from_lat   numeric;
    v_from_lng   numeric;
    v_to_lat     numeric;
    v_to_lng     numeric;
    v_forward_id bigint;
    v_reverse_id bigint;
    v_reversed   jsonb;
    v_len        integer;
    v_first_lat  double precision;
    v_first_lng  double precision;
    v_last_lat   double precision;
    v_last_lng   double precision;
BEGIN
    -- Lock both endpoint nodes FOR UPDATE in deterministic ascending-id order.
    PERFORM 1
       FROM public.route_nodes
      WHERE id IN (v_low_id, v_high_id)
      ORDER BY id
        FOR UPDATE;

    -- Both endpoint nodes must exist and be distinct.
    SELECT count(*) INTO v_node_count
      FROM public.route_nodes
     WHERE id IN (p_from_node_id, p_to_node_id);
    IF p_from_node_id = p_to_node_id OR v_node_count < 2 THEN
        RAISE EXCEPTION 'EDGE_PAIR_NOT_FOUND';
    END IF;

    SELECT lat, lng INTO v_from_lat, v_from_lng FROM public.route_nodes WHERE id = p_from_node_id;
    SELECT lat, lng INTO v_to_lat,   v_to_lng   FROM public.route_nodes WHERE id = p_to_node_id;

    -- Lock both directed edges FOR UPDATE in deterministic ascending-id order.
    PERFORM 1
       FROM public.route_edges
      WHERE (from_node_id = p_from_node_id AND to_node_id = p_to_node_id)
         OR (from_node_id = p_to_node_id   AND to_node_id = p_from_node_id)
      ORDER BY id
        FOR UPDATE;

    -- Resolve forward + reverse ids from the locked rows.
    SELECT id INTO v_forward_id FROM public.route_edges WHERE from_node_id = p_from_node_id AND to_node_id = p_to_node_id;
    SELECT id INTO v_reverse_id FROM public.route_edges WHERE from_node_id = p_to_node_id   AND to_node_id = p_from_node_id;
    IF v_forward_id IS NULL OR v_reverse_id IS NULL THEN
        RAISE EXCEPTION 'EDGE_PAIR_NOT_FOUND';
    END IF;

    -- NULL clears both directions atomically.
    IF p_geometry IS NULL THEN
        UPDATE public.route_edges SET path_geometry = NULL WHERE id = v_forward_id;
        UPDATE public.route_edges SET path_geometry = NULL WHERE id = v_reverse_id;
        RETURN 2;
    END IF;

    -- Structural validation: array of 2-200 elements.
    IF jsonb_typeof(p_geometry) <> 'array' THEN
        RAISE EXCEPTION 'INVALID_GEOMETRY';
    END IF;
    v_len := jsonb_array_length(p_geometry);
    IF v_len < 2 OR v_len > 200 THEN
        RAISE EXCEPTION 'INVALID_GEOMETRY';
    END IF;

    -- First + last points must carry numeric lat/lng.
    IF jsonb_typeof(p_geometry->0->'lat') <> 'number'
       OR jsonb_typeof(p_geometry->0->'lng') <> 'number'
       OR jsonb_typeof(p_geometry->(v_len - 1)->'lat') <> 'number'
       OR jsonb_typeof(p_geometry->(v_len - 1)->'lng') <> 'number' THEN
        RAISE EXCEPTION 'INVALID_GEOMETRY';
    END IF;
    v_first_lat := (p_geometry->0->>'lat')::double precision;
    v_first_lng := (p_geometry->0->>'lng')::double precision;
    v_last_lat  := (p_geometry->(v_len - 1)->>'lat')::double precision;
    v_last_lng  := (p_geometry->(v_len - 1)->>'lng')::double precision;

    -- Endpoints must match the LOCKED node coordinates within 1e-6.
    IF abs(v_first_lat - v_from_lat::double precision) > 0.000001
       OR abs(v_first_lng - v_from_lng::double precision) > 0.000001
       OR abs(v_last_lat  - v_to_lat::double precision)   > 0.000001
       OR abs(v_last_lng  - v_to_lng::double precision)   > 0.000001 THEN
        RAISE EXCEPTION 'INVALID_GEOMETRY';
    END IF;

    -- Reverse row = the exact reversed forward sequence.
    SELECT jsonb_agg(t.elem ORDER BY t.ord DESC)
      INTO v_reversed
      FROM jsonb_array_elements(p_geometry) WITH ORDINALITY AS t(elem, ord);

    UPDATE public.route_edges SET path_geometry = p_geometry WHERE id = v_forward_id;
    UPDATE public.route_edges SET path_geometry = v_reversed WHERE id = v_reverse_id;
    RETURN 2;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.app_set_route_edge_geometry_pair(bigint, bigint, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.app_set_route_edge_geometry_pair(bigint, bigint, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.app_set_route_edge_geometry_pair(bigint, bigint, jsonb) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.app_set_route_edge_geometry_pair(bigint, bigint, jsonb) TO service_role;


-- -----------------------------------------------------------------------------
-- 2. app_update_route_node — lock the node FOR UPDATE, then coordinate-change
--    guard. Signature/return/location recompute/privileges match 0007.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_update_route_node(
    p_id            bigint,
    p_node_key      varchar(60),
    p_label         varchar(150),
    p_node_type     varchar(30),
    p_building_id   bigint,
    p_lat           double precision,
    p_lng           double precision,
    p_display_order integer
)
RETURNS TABLE (
    id            bigint,
    node_key      varchar,
    label         varchar,
    node_type     varchar,
    building_id   bigint,
    lat           numeric,
    lng           numeric,
    display_order integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_old_lat  numeric;
    v_old_lng  numeric;
    v_moved    boolean;
    v_attached boolean;
BEGIN
    -- Lock the target node row before comparing coordinates.
    SELECT rn.lat, rn.lng INTO v_old_lat, v_old_lng
      FROM public.route_nodes rn
     WHERE rn.id = p_id
       FOR UPDATE;

    -- No such node: return no rows (the app maps an empty result to 404).
    IF NOT FOUND THEN
        RETURN;
    END IF;

    v_moved := (v_old_lat IS NULL OR v_old_lng IS NULL)
               OR abs(v_old_lat - p_lat::numeric) > 0.000001
               OR abs(v_old_lng - p_lng::numeric) > 0.000001;

    IF v_moved THEN
        SELECT EXISTS (
            SELECT 1 FROM public.route_edges e
             WHERE (e.from_node_id = p_id OR e.to_node_id = p_id)
               AND e.path_geometry IS NOT NULL
        ) INTO v_attached;
        IF v_attached THEN
            RAISE EXCEPTION 'NODE_GEOMETRY_ATTACHED';
        END IF;
    END IF;

    RETURN QUERY
    UPDATE public.route_nodes
       SET node_key      = p_node_key,
           label         = p_label,
           node_type     = p_node_type,
           building_id   = p_building_id,
           lat           = p_lat,
           lng           = p_lng,
           location      = extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography,
           display_order = p_display_order,
           updated_at    = now()
     WHERE route_nodes.id = p_id
    RETURNING
        route_nodes.id, route_nodes.node_key, route_nodes.label, route_nodes.node_type,
        route_nodes.building_id, route_nodes.lat, route_nodes.lng, route_nodes.display_order;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.app_update_route_node(
    bigint, varchar, varchar, varchar, bigint, double precision, double precision, integer
) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.app_update_route_node(
    bigint, varchar, varchar, varchar, bigint, double precision, double precision, integer
) TO service_role;


-- -----------------------------------------------------------------------------
-- Notes for reviewers and follow-up
-- -----------------------------------------------------------------------------
-- - Apply manually in the Supabase SQL editor after Codex reviews the RF.4
--   repair. Re-applying is safe (CREATE OR REPLACE + idempotent grants).
-- - Repository mapping (repositories/routeRepository.js):
--     adminSetEdgeGeometryPair -> app_set_route_edge_geometry_pair
--     adminUpdateNode          -> app_update_route_node (locked + guarded)
-- - Live Supabase RF.4 mutation verification is deferred until this migration
--   is owner-applied. Until then, Supabase-mode geometry writes use the older
--   RPC, so the probe verifies Supabase via static migration/RPC checks only.
-- =============================================================================
