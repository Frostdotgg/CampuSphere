-- =============================================================================
-- 0023_directional_route_edge_geometry.sql
-- Direction-specific route geometry writes for independent campus entry/exit
-- paths.
-- =============================================================================
--
-- The RF.4 editor used the historical 0016 pair RPC, which intentionally wrote
-- the exact reverse geometry into both directed rows. That is correct for a
-- simple two-way path but prevents a campus from publishing a dedicated exit
-- route. This migration adds a one-row backstop without changing the
-- route_edges schema, indexes, scalar metrics, or existing data.
--
-- The Express controller still performs the full shape validation. This
-- service-role-only function repeats the endpoint/length checks under row
-- locks, so a concurrent route-node edit cannot leave a saved geometry whose
-- endpoints no longer match the selected directed edge.
--
-- Boundaries: owner-applied manually in Supabase after review. Codex must not
-- execute this file or infer that its function exists in a live database.

CREATE OR REPLACE FUNCTION public.app_set_route_edge_geometry_one_way(
    p_edge_id  bigint,
    p_geometry jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_from_node_id bigint;
    v_to_node_id   bigint;
    v_from_lat     numeric;
    v_from_lng     numeric;
    v_to_lat       numeric;
    v_to_lng       numeric;
    v_low_id       bigint;
    v_high_id      bigint;
    v_node_count   integer;
    v_len          integer;
    v_first_lat    double precision;
    v_first_lng    double precision;
    v_last_lat     double precision;
    v_last_lng     double precision;
BEGIN
    -- Lock the selected directed edge first, then both endpoint nodes in a
    -- deterministic order. The endpoint coordinates are therefore validated
    -- against the same row versions that the write uses.
    SELECT from_node_id, to_node_id
      INTO v_from_node_id, v_to_node_id
      FROM public.route_edges
     WHERE id = p_edge_id
       FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'EDGE_NOT_FOUND';
    END IF;

    v_low_id := least(v_from_node_id, v_to_node_id);
    v_high_id := greatest(v_from_node_id, v_to_node_id);
    PERFORM 1
       FROM public.route_nodes
      WHERE id IN (v_low_id, v_high_id)
      ORDER BY id
        FOR UPDATE;

    SELECT count(*) INTO v_node_count
      FROM public.route_nodes
     WHERE id IN (v_from_node_id, v_to_node_id);
    IF v_from_node_id = v_to_node_id OR v_node_count < 2 THEN
        RAISE EXCEPTION 'EDGE_NOT_FOUND';
    END IF;

    SELECT lat, lng INTO v_from_lat, v_from_lng
      FROM public.route_nodes WHERE id = v_from_node_id;
    SELECT lat, lng INTO v_to_lat, v_to_lng
      FROM public.route_nodes WHERE id = v_to_node_id;

    -- NULL clears only this directed row. Its reverse is intentionally left
    -- untouched so an entry and exit path can be maintained independently.
    IF p_geometry IS NULL THEN
        UPDATE public.route_edges
           SET path_geometry = NULL
         WHERE id = p_edge_id;
        RETURN 1;
    END IF;

    IF jsonb_typeof(p_geometry) <> 'array' THEN
        RAISE EXCEPTION 'INVALID_GEOMETRY';
    END IF;
    v_len := jsonb_array_length(p_geometry);
    IF v_len < 2 OR v_len > 200 THEN
        RAISE EXCEPTION 'INVALID_GEOMETRY';
    END IF;

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

    IF abs(v_first_lat - v_from_lat::double precision) > 0.000001
       OR abs(v_first_lng - v_from_lng::double precision) > 0.000001
       OR abs(v_last_lat  - v_to_lat::double precision)   > 0.000001
       OR abs(v_last_lng  - v_to_lng::double precision)   > 0.000001 THEN
        RAISE EXCEPTION 'INVALID_GEOMETRY';
    END IF;

    UPDATE public.route_edges
       SET path_geometry = p_geometry
     WHERE id = p_edge_id;
    RETURN 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.app_set_route_edge_geometry_one_way(bigint, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.app_set_route_edge_geometry_one_way(bigint, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.app_set_route_edge_geometry_one_way(bigint, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.app_set_route_edge_geometry_one_way(bigint, jsonb) TO service_role;
