-- =============================================================================
-- CampuSphere - Supabase Route / Graph Admin Write Functions
-- File: database/supabase/0007_route_graph_admin_write_functions.sql
-- Milestone 7, Section 7.9 (Route, Step, Node, and Edge Administration)
-- =============================================================================
--
-- Purpose
--   Provide service-role-only PostgreSQL functions for the route/graph admin
--   operations that need DB-enforced atomicity or PostGIS computation, which the
--   Supabase JS client cannot perform on its own:
--
--     1. app_replace_route_steps  - atomically replace ALL ordered steps of one
--                                   campus_route (delete-then-insert in a single
--                                   function/transaction).
--     2. app_create_route_node    - insert a route_node and compute its PostGIS
--                                   `location` geography from lat/lng.
--     3. app_update_route_node    - update a route_node and refresh `location`
--                                   + updated_at.
--     4. app_delete_route_node    - delete a route_node ONLY when no route_edge
--                                   (from_node_id/to_node_id) and no vr_scene
--                                   (node_id) reference it; otherwise raise
--                                   NODE_REFERENCED. This prevents the FK
--                                   ON DELETE CASCADE (edges) / SET NULL
--                                   (vr_scenes.node_id) from silently destroying
--                                   navigation data, atomically (race backstop;
--                                   the controller also pre-checks for a clean
--                                   HTTP 409 with an actionable message).
--
--   The Supabase route admin repository (repositories/routeRepository.js, the
--   Section 7.9 admin* methods) calls these via `.rpc(<fn>, { ... })` from
--   server-only Node code; controllers never call them directly. Routes and
--   edges are single-row writes and use direct PostgREST (no function needed).
--
--   Tables targeted (defined in 0001_initial_schema.sql section B.4):
--     - campus_route_steps (route_id, step_order, instruction, landmark, lat, lng)
--     - route_nodes (lat/lng numeric, location extensions.geography(Point,4326),
--                    node_key UNIQUE, building_id FK -> buildings SET NULL)
--     - route_edges (from/to FK -> route_nodes ON DELETE CASCADE, unique pair)
--     - vr_scenes (node_id FK -> route_nodes ON DELETE SET NULL)
--
-- Apply order
--   This file is the seventh Supabase migration. Apply in order, each once:
--     1. 0001_initial_schema.sql
--     2. 0002_seed_data.sql
--     3. 0003_auth_profile_functions.sql
--     4. 0004_building_backfill.sql
--     5. 0005_building_write_functions.sql
--     6. 0006_admin_content_and_logs.sql
--     7. 0007_route_graph_admin_write_functions.sql   <-- this file
--   Re-applying is safe: every function is preceded by DROP FUNCTION IF EXISTS,
--   so signature evolution cannot leave a stale overload behind. This file
--   contains FUNCTIONS ONLY - no table DDL, no seed data, no triggers, no RLS,
--   no Supabase Auth. database/schema.sql and database/seed.js are NOT touched.
--
-- HOW TO APPLY (manual)
--   Paste the contents of this file into the Supabase SQL Editor for the target
--   project and run it (or run via psql / the Supabase CLI). Apply against a
--   development / disposable project first. Until this migration is applied,
--   Supabase-mode route-step saves and route-node create/update/delete will
--   fail; MySQL mode is unaffected.
--
-- PostGIS
--   `location` is built from lat/lng with
--     extensions.ST_SetSRID(extensions.ST_MakePoint(lng, lat), 4326)::extensions.geography
--   Note the (lng, lat) argument order. All PostGIS functions and the geography
--   type are schema-qualified, so resolution does not depend on search_path.
--
-- Security stance (mirrors 0005_building_write_functions.sql)
--   - SECURITY INVOKER: functions run with the caller's privileges, which in
--     CampuSphere's server-only Supabase usage is service_role. 0001 already
--     grants the needed table privileges to service_role.
--   - SET search_path = pg_catalog, public pins resolution; all objects are
--     schema-qualified.
--   - EXECUTE is revoked from PUBLIC and granted only to service_role. anon and
--     authenticated (reachable from the browser via PostgREST) are NOT granted.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Cleanup: drop any previously installed versions
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.app_replace_route_steps(bigint, jsonb);
DROP FUNCTION IF EXISTS public.app_create_route_node(
    varchar, varchar, varchar, bigint, double precision, double precision, integer
);
DROP FUNCTION IF EXISTS public.app_update_route_node(
    bigint, varchar, varchar, varchar, bigint, double precision, double precision, integer
);
DROP FUNCTION IF EXISTS public.app_delete_route_node(bigint);


-- -----------------------------------------------------------------------------
-- Function: app_replace_route_steps
-- -----------------------------------------------------------------------------
-- Atomically replace every step of one route. p_steps is a JSON array of
-- objects shaped { step_order, instruction, landmark, lat, lng } that the
-- controller has already validated (sequential 1..N step_order, bounded
-- instruction/landmark, in-range lat/lng or null). Deletes all existing steps
-- for the route, then inserts the new ones, in a single function call (one
-- transaction). RETURNS the number of inserted steps.

CREATE OR REPLACE FUNCTION public.app_replace_route_steps(
    p_route_id bigint,
    p_steps    jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_count integer;
BEGIN
    DELETE FROM public.campus_route_steps WHERE route_id = p_route_id;

    INSERT INTO public.campus_route_steps (route_id, step_order, instruction, landmark, lat, lng)
    SELECT p_route_id,
           (s->>'step_order')::integer,
           s->>'instruction',
           s->>'landmark',
           (s->>'lat')::numeric,
           (s->>'lng')::numeric
      FROM jsonb_array_elements(COALESCE(p_steps, '[]'::jsonb)) AS s;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;


-- -----------------------------------------------------------------------------
-- Function: app_create_route_node
-- -----------------------------------------------------------------------------
-- Insert one route_nodes row, computing `location` from lat/lng. RETURNS the
-- inserted row's admin contract columns (no `location` geography in the result).

CREATE OR REPLACE FUNCTION public.app_create_route_node(
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
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
    INSERT INTO public.route_nodes (
        node_key, label, node_type, building_id, lat, lng, location, display_order
    )
    VALUES (
        p_node_key, p_label, p_node_type, p_building_id, p_lat, p_lng,
        extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography,
        p_display_order
    )
    RETURNING
        route_nodes.id, route_nodes.node_key, route_nodes.label, route_nodes.node_type,
        route_nodes.building_id, route_nodes.lat, route_nodes.lng, route_nodes.display_order;
$$;


-- -----------------------------------------------------------------------------
-- Function: app_update_route_node
-- -----------------------------------------------------------------------------
-- Overwrite the mutable route_node fields for one id and refresh location +
-- updated_at. RETURNS the updated row's admin columns, or no row when absent.

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
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
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
     WHERE id = p_id
    RETURNING
        route_nodes.id, route_nodes.node_key, route_nodes.label, route_nodes.node_type,
        route_nodes.building_id, route_nodes.lat, route_nodes.lng, route_nodes.display_order;
$$;


-- -----------------------------------------------------------------------------
-- Function: app_delete_route_node
-- -----------------------------------------------------------------------------
-- Delete one route_node ONLY when nothing navigation-critical references it.
-- Raises NODE_REFERENCED (which the repository surfaces and the controller maps
-- to HTTP 409) when a route_edge or vr_scene still points at the node, so the
-- FK ON DELETE CASCADE / SET NULL can never silently delete edges or null out a
-- scene's node link. RETURNS the deleted id, or NULL when the id does not exist.

CREATE OR REPLACE FUNCTION public.app_delete_route_node(p_id bigint)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_deleted bigint;
BEGIN
    IF EXISTS (SELECT 1 FROM public.route_edges WHERE from_node_id = p_id OR to_node_id = p_id) THEN
        RAISE EXCEPTION 'NODE_REFERENCED';
    END IF;
    IF EXISTS (SELECT 1 FROM public.vr_scenes WHERE node_id = p_id) THEN
        RAISE EXCEPTION 'NODE_REFERENCED';
    END IF;

    DELETE FROM public.route_nodes WHERE id = p_id
    RETURNING id INTO v_deleted;

    RETURN v_deleted; -- NULL when no row matched
END;
$$;


-- -----------------------------------------------------------------------------
-- Execute privileges: revoke PUBLIC, grant service_role only
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.app_replace_route_steps(bigint, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.app_replace_route_steps(bigint, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.app_create_route_node(
    varchar, varchar, varchar, bigint, double precision, double precision, integer
) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.app_create_route_node(
    varchar, varchar, varchar, bigint, double precision, double precision, integer
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.app_update_route_node(
    bigint, varchar, varchar, varchar, bigint, double precision, double precision, integer
) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.app_update_route_node(
    bigint, varchar, varchar, varchar, bigint, double precision, double precision, integer
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.app_delete_route_node(bigint) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.app_delete_route_node(bigint) TO service_role;


-- -----------------------------------------------------------------------------
-- Notes for reviewers and follow-up
-- -----------------------------------------------------------------------------
-- - Apply manually in the dev Supabase project before Supabase-mode route-step
--   and route-node write verification. Re-applying is safe.
-- - Repository mapping (repositories/routeRepository.js, Section 7.9):
--     - adminReplaceSteps -> app_replace_route_steps
--     - adminCreateNode   -> app_create_route_node
--     - adminUpdateNode   -> app_update_route_node
--     - adminDeleteNode   -> app_delete_route_node
--   Routes and edges are single-row writes handled directly via PostgREST.
-- =============================================================================
