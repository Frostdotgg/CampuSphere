-- =============================================================================
-- CampuSphere - Supabase Building Write Functions
-- File: database/supabase/0005_building_write_functions.sql
-- Milestone 3, Section 3.6
-- =============================================================================
--
-- Purpose
--   Provide PostgreSQL functions for building create / update / delete that
--   populate (and refresh) the PostGIS `location` geography column from
--   lat/lng, which the Supabase JS client cannot compute on its own. The
--   Supabase building repository (repositories/buildingRepository.js) calls
--   these via `.rpc(<function_name>, { ... })` from server-only Node code;
--   controllers never call them directly.
--
--   Table targeted (defined in 0001_initial_schema.sql section B.3):
--     - buildings (lat numeric, lng numeric, details jsonb,
--                  location extensions.geography(Point, 4326))
--
-- Apply order
--   This file is the fifth Supabase migration. Apply in order:
--     1. database/supabase/0001_initial_schema.sql
--     2. database/supabase/0002_seed_data.sql
--     3. database/supabase/0003_auth_profile_functions.sql
--     4. database/supabase/0004_building_backfill.sql
--     5. database/supabase/0005_building_write_functions.sql   <-- this file
--   Re-applying is safe: every function is preceded by DROP FUNCTION IF
--   EXISTS so signature evolution between migration runs cannot leave a
--   stale overload behind.
--
-- Scope and non-goals
--   - Functions only. No table DDL, no seed data, no triggers, no RLS,
--     no Supabase Auth.
--   - No MySQL syntax. database/schema.sql and database/seed.js are NOT
--     touched; node database/seed.js is NOT required.
--   - No controller change. Section 3.7 wires adminBuildingsController to the
--     repository write methods that call these functions; until then the repo
--     runtime does not invoke them and the MySQL admin CRUD path is unchanged.
--
-- Contract preserved (mirrors controllers/adminBuildingsController.js)
--   - create accepts the same fields the admin form sends
--     (name, category, description, lat, lng, details) plus an optional
--     image_url, and RETURNS the inserted row's
--     id/name/category/description/lat/lng/details/created_at/updated_at.
--   - update overwrites name/category/description/lat/lng/details and refreshes
--     location + updated_at; it does NOT touch image_url (matching the MySQL
--     UPDATE which leaves image_url alone), and RETURNS the same column set.
--   - delete removes the building row and RETURNS the deleted id (or no row
--     when the id does not exist; the controller checks existence first).
--   - Validation stays in the controller (validateDetails / validateCoord).
--     These functions accept pre-validated values.
--
-- PostGIS
--   `location` is built from lat/lng with
--     extensions.ST_SetSRID(extensions.ST_MakePoint(lng, lat), 4326)::extensions.geography
--   Note the (lng, lat) argument order: PostGIS ST_MakePoint takes longitude
--   first. All PostGIS functions and the geography type are schema-qualified,
--   so resolution does not depend on search_path.
--
-- Security stance (mirrors 0003_auth_profile_functions.sql)
--   - SECURITY INVOKER: functions run with the caller's privileges, which in
--     CampuSphere's server-only Supabase usage is service_role. 0001 already
--     grants INSERT/UPDATE/DELETE on buildings to service_role, so
--     SECURITY DEFINER is unnecessary and would widen the blast radius.
--   - `SET search_path = pg_catalog, public` pins resolution so a hostile
--     caller cannot shadow built-ins; all object references are qualified.
--   - EXECUTE is revoked from PUBLIC and granted only to service_role. The
--     anon and authenticated roles (reachable from the browser via PostgREST)
--     are deliberately NOT granted EXECUTE.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Cleanup: drop any previously installed versions
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.app_create_building(
    varchar, varchar, text, double precision, double precision, jsonb, varchar
);
DROP FUNCTION IF EXISTS public.app_update_building(
    bigint, varchar, varchar, text, double precision, double precision, jsonb
);
DROP FUNCTION IF EXISTS public.app_delete_building(bigint);


-- -----------------------------------------------------------------------------
-- Function: app_create_building
-- -----------------------------------------------------------------------------
-- Insert one buildings row, computing `location` from lat/lng. image_url is
-- optional (the admin form does not send one; img lives inside details.img).
-- RETURNS the inserted row's contract columns.

CREATE OR REPLACE FUNCTION public.app_create_building(
    p_name        varchar(150),
    p_category    varchar(50),
    p_description text,
    p_lat         double precision,
    p_lng         double precision,
    p_details     jsonb        DEFAULT NULL,
    p_image_url   varchar(255) DEFAULT NULL
)
RETURNS TABLE (
    id          bigint,
    name        varchar,
    category    varchar,
    description text,
    lat         numeric,
    lng         numeric,
    details     jsonb,
    created_at  timestamptz,
    updated_at  timestamptz
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
    INSERT INTO public.buildings (
        name, category, description, lat, lng, details, image_url, location
    )
    VALUES (
        p_name, p_category, p_description, p_lat, p_lng, p_details, p_image_url,
        extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography
    )
    RETURNING
        buildings.id, buildings.name, buildings.category, buildings.description,
        buildings.lat, buildings.lng, buildings.details,
        buildings.created_at, buildings.updated_at;
$$;


-- -----------------------------------------------------------------------------
-- Function: app_update_building
-- -----------------------------------------------------------------------------
-- Overwrite the mutable building fields for one id and refresh location +
-- updated_at. Does NOT touch image_url (matches the MySQL admin UPDATE).
-- RETURNS the updated row's contract columns, or no row when the id is absent.

CREATE OR REPLACE FUNCTION public.app_update_building(
    p_id          bigint,
    p_name        varchar(150),
    p_category    varchar(50),
    p_description text,
    p_lat         double precision,
    p_lng         double precision,
    p_details     jsonb DEFAULT NULL
)
RETURNS TABLE (
    id          bigint,
    name        varchar,
    category    varchar,
    description text,
    lat         numeric,
    lng         numeric,
    details     jsonb,
    created_at  timestamptz,
    updated_at  timestamptz
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
    UPDATE public.buildings
       SET name        = p_name,
           category    = p_category,
           description = p_description,
           lat         = p_lat,
           lng         = p_lng,
           details     = p_details,
           location    = extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography,
           updated_at  = now()
     WHERE id = p_id
    RETURNING
        buildings.id, buildings.name, buildings.category, buildings.description,
        buildings.lat, buildings.lng, buildings.details,
        buildings.created_at, buildings.updated_at;
$$;


-- -----------------------------------------------------------------------------
-- Function: app_delete_building
-- -----------------------------------------------------------------------------
-- Delete one buildings row. RETURNS the deleted id, or no row (NULL scalar via
-- rpc) when the id does not exist. The controller checks existence first.

CREATE OR REPLACE FUNCTION public.app_delete_building(p_id bigint)
RETURNS bigint
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
    DELETE FROM public.buildings
     WHERE id = p_id
    RETURNING buildings.id;
$$;


-- -----------------------------------------------------------------------------
-- Execute privileges
-- -----------------------------------------------------------------------------
-- Revoke the default PUBLIC EXECUTE grant and grant EXECUTE only to
-- service_role (the role used by the server-only Supabase client in
-- config/supabase.js). anon and authenticated are deliberately NOT granted.

REVOKE EXECUTE ON FUNCTION public.app_create_building(
    varchar, varchar, text, double precision, double precision, jsonb, varchar
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_create_building(
    varchar, varchar, text, double precision, double precision, jsonb, varchar
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.app_update_building(
    bigint, varchar, varchar, text, double precision, double precision, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_update_building(
    bigint, varchar, varchar, text, double precision, double precision, jsonb
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.app_delete_building(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_delete_building(bigint) TO service_role;


-- -----------------------------------------------------------------------------
-- Notes for reviewers and follow-up sections
-- -----------------------------------------------------------------------------
-- - Apply manually in the dev Supabase project before the Section 3.7 admin
--   building CRUD migration runs. Re-applying is safe.
-- - Repository mapping (repositories/buildingRepository.js, Section 3.6):
--     - create -> app_create_building
--     - update -> app_update_building
--     - delete -> app_delete_building
-- - Section 3.7 flips adminBuildingsController's Supabase branch to call these
--   repository write methods; validation (validateDetails / validateCoord)
--   stays in the controller.
-- =============================================================================
