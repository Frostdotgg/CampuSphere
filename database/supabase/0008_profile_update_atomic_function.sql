-- =============================================================================
-- CampuSphere - Supabase Atomic Profile Update Function
-- File: database/supabase/0008_profile_update_atomic_function.sql
-- Milestone 7 remediation R6 (Codex follow-up)
-- =============================================================================
--
-- Purpose
--   R6 requires profile updates to be atomic across `users` and the role
--   profile table. The Supabase profile-update path previously ran two
--   separate writes from Node (a direct users-name UPDATE, then an
--   app_upsert_*_profile RPC); if the name write succeeded and the profile
--   write failed, the database was left partially updated.
--
--   This migration adds ONE PL/pgSQL function that performs the optional
--   users-name update AND the role-profile upsert inside a single function
--   body. A PL/pgSQL function executes in the caller's transaction, so any
--   RAISE/constraint error rolls back EVERY write the function made -- the
--   name change and the profile change either both commit or both roll back.
--   No partial name update can persist.
--
--   The profile upsert reuses the existing, already-verified
--   app_upsert_student_profile / app_upsert_instructor_profile /
--   app_upsert_guest_profile functions (0003) via PERFORM, so their
--   NULL-means-leave-alone / UPDATE-first-then-INSERT semantics are unchanged.
--
--   Tables targeted (defined in 0001_initial_schema.sql section B.1):
--     - users
--     - student_profiles / instructor_profiles / guest_profiles
--
-- Apply order
--   This is the eighth Supabase migration. Apply in order:
--     1. database/supabase/0001_initial_schema.sql
--     2. database/supabase/0002_seed_data.sql
--     3. database/supabase/0003_auth_profile_functions.sql
--     4. database/supabase/0004_building_backfill.sql
--     5. database/supabase/0005_building_write_functions.sql
--     6. database/supabase/0006_admin_content_and_logs.sql
--     7. database/supabase/0007_route_graph_admin_write_functions.sql
--     8. database/supabase/0008_profile_update_atomic_function.sql   <-- this file
--   Re-applying is safe: DROP FUNCTION IF EXISTS precedes CREATE.
--
-- Scope and non-goals
--   - One function only. No table DDL, no seed data, no triggers, no RLS.
--   - No MySQL syntax. database/schema.sql and database/seed.js are NOT
--     touched; node database/seed.js is NOT required. The MySQL profile-update
--     path already runs in one mysql2 transaction in the controller.
--   - Depends on the three app_upsert_*_profile functions from 0003 existing.
--
-- Contract (mirrors controllers/profileController.js, Supabase branch)
--   - p_update_name = true  -> overwrite users.first_name / last_name and
--     refresh updated_at (matches the prior direct users UPDATE, which also
--     bumped updated_at).
--   - p_update_profile = true -> upsert the role profile for p_role using the
--     same parameters the controller previously passed to the per-role
--     app_upsert_*_profile RPC (NULL = leave existing column alone on UPDATE;
--     explicit values, incl. '' = set; insert-only enrollment_status/semester/
--     status supplied by the controller on the create path).
--   - Either flag may be false (name-only or profile-only update). When both
--     are false the function is a no-op (the controller does not call it then).
--   - Returns void. Validation stays in the controller; this function accepts
--     pre-validated values.
--
-- Security stance (mirrors 0003)
--   - SECURITY INVOKER: runs with the caller's privileges, which in
--     CampuSphere's server-only Supabase usage is service_role. 0001 grants
--     UPDATE/INSERT on these tables to service_role, and 0003 grants EXECUTE
--     on the app_upsert_*_profile functions to service_role, so this function
--     (and its PERFORM calls) resolve under service_role.
--   - `SET search_path = pg_catalog, public` pins resolution; all object
--     references are schema-qualified (public.users, public.app_upsert_*).
--   - EXECUTE revoked from PUBLIC and granted only to service_role. anon and
--     authenticated (reachable from the browser via PostgREST) are NOT granted.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Cleanup: drop any previously installed version
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.app_update_user_profile(
    bigint, boolean, varchar, varchar, boolean, text,
    varchar, varchar, varchar, varchar, varchar,
    varchar, varchar, varchar, varchar,
    varchar, varchar
);


-- -----------------------------------------------------------------------------
-- Function: app_update_user_profile
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_update_user_profile(
    p_user_id           bigint,
    p_update_name       boolean,
    p_first_name        varchar(50),
    p_last_name         varchar(50),
    p_update_profile    boolean,
    p_role              text,
    p_student_id_number varchar(50)  DEFAULT NULL,
    p_course            varchar(100) DEFAULT NULL,
    p_year_level        varchar(50)  DEFAULT NULL,
    p_enrollment_status varchar(50)  DEFAULT NULL,
    p_semester          varchar(100) DEFAULT NULL,
    p_employee_id       varchar(50)  DEFAULT NULL,
    p_department        varchar(100) DEFAULT NULL,
    p_position          varchar(100) DEFAULT NULL,
    p_status            varchar(50)  DEFAULT NULL,
    p_address           varchar(255) DEFAULT NULL,
    p_phone_number      varchar(50)  DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF p_update_name THEN
        UPDATE public.users
           SET first_name = p_first_name,
               last_name  = p_last_name,
               updated_at = now()
         WHERE id = p_user_id;
    END IF;

    IF p_update_profile THEN
        IF p_role = 'student-cspc' THEN
            PERFORM public.app_upsert_student_profile(
                p_user_id, p_student_id_number, p_course, p_year_level,
                p_enrollment_status, p_semester
            );
        ELSIF p_role = 'instructor' THEN
            PERFORM public.app_upsert_instructor_profile(
                p_user_id, p_employee_id, p_department, p_position, p_status
            );
        ELSIF p_role = 'guest' THEN
            PERFORM public.app_upsert_guest_profile(
                p_user_id, p_address, p_phone_number
            );
        END IF;
    END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- Execute privileges
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.app_update_user_profile(
    bigint, boolean, varchar, varchar, boolean, text,
    varchar, varchar, varchar, varchar, varchar,
    varchar, varchar, varchar, varchar,
    varchar, varchar
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_update_user_profile(
    bigint, boolean, varchar, varchar, boolean, text,
    varchar, varchar, varchar, varchar, varchar,
    varchar, varchar, varchar, varchar,
    varchar, varchar
) TO service_role;


-- -----------------------------------------------------------------------------
-- Notes for reviewers
-- -----------------------------------------------------------------------------
-- - Apply manually in the dev Supabase project (SQL Editor) before exercising
--   the Supabase profile-update path. Re-applying is safe.
-- - Repository mapping (repositories/userRepository.js):
--     updateUserProfileAtomic -> app_update_user_profile
-- - controllers/profileController.js Supabase branch now performs a single
--   call to updateUserProfileAtomic (name + role profile) instead of a
--   separate users UPDATE followed by an app_upsert_*_profile RPC.
-- =============================================================================
