-- =============================================================================
-- 0027_route_edge_geometry_metrics.sql
-- Atomic directional geometry + distance/walk-time writes for the admin graph.
-- =============================================================================
--
-- The application measures the administrator-drawn polyline with the shared
-- Haversine/1.2 m/s convention. This service-role-only function repeats the
-- positive-metric, endpoint, length, and row-lock checks inside Supabase so a
-- concurrent node edit cannot split geometry from the scalar route weights.
-- NULL geometry clears only the selected directed row; its metrics still
-- describe the exact endpoint fallback line supplied by the application.
--
-- Boundary: source-only until the owner explicitly applies this migration in
-- Supabase. Codex must not execute or reapply it, and existing migrations
-- 0020-0026 remain immutable owner-applied history.

CREATE OR REPLACE FUNCTION public.app_set_route_edge_geometry_metrics_one_way(
    p_edge_id           bigint,
    p_geometry          jsonb,
    p_distance_meters   integer,
    p_walk_time_seconds integer
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
    IF p_distance_meters IS NULL OR p_distance_meters < 1
       OR p_walk_time_seconds IS NULL OR p_walk_time_seconds < 1 THEN
        RAISE EXCEPTION 'INVALID_METRICS';
    END IF;

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
    IF v_from_lat IS NULL OR v_from_lng IS NULL OR v_to_lat IS NULL OR v_to_lng IS NULL THEN
        RAISE EXCEPTION 'INVALID_GEOMETRY';
    END IF;

    IF p_geometry IS NOT NULL THEN
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
           OR abs(v_last_lat - v_to_lat::double precision) > 0.000001
           OR abs(v_last_lng - v_to_lng::double precision) > 0.000001 THEN
            RAISE EXCEPTION 'INVALID_GEOMETRY';
        END IF;
    END IF;

    UPDATE public.route_edges
       SET path_geometry = p_geometry,
           distance_meters = p_distance_meters,
           walk_time_seconds = p_walk_time_seconds
     WHERE id = p_edge_id;
    RETURN 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.app_set_route_edge_geometry_metrics_one_way(bigint, jsonb, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.app_set_route_edge_geometry_metrics_one_way(bigint, jsonb, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.app_set_route_edge_geometry_metrics_one_way(bigint, jsonb, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.app_set_route_edge_geometry_metrics_one_way(bigint, jsonb, integer, integer) TO service_role;
