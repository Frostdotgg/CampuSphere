-- =============================================================================
-- 0009_public_registration_trust_policy.sql
-- Milestone 8, Section 8.6 — Production Registration Trust Policy
-- =============================================================================
-- Local public email/password registration may create GUEST accounts ONLY.
--
-- This redefines public.app_create_local_user (same signature as 0003) so the
-- SQL boundary now rejects ANY role other than 'guest' — defense in depth behind
-- the controller-level guard in controllers/authController.js -> registerPost
-- (which already rejects non-guest local public registration).
--
-- Trusted institutional roles are created ONLY by:
--   1. verified Google OAuth domain mapping
--        @my.cspc.edu.ph -> student-cspc, @cspc.edu.ph -> instructor,
--        @gmail.com -> guest
--      via public.app_create_oauth_user_with_profile (NOT restricted here);
--   2. seed data;
--   3. admin-managed creation via public.app_create_admin_managed_user
--      (NOT restricted here; gated by requireRole('admin') at the route layer).
--
-- Admin self-registration remains impossible: neither the local path nor the
-- OAuth path can create an admin.
--
-- Idempotent: CREATE OR REPLACE preserves the existing service_role grant; the
-- grant is re-affirmed at the end for clarity. Apply in the Supabase SQL editor
-- after 0008.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.app_create_local_user(
    p_username           varchar(50),
    p_email              varchar(100),
    p_password_hash      varchar(255),
    p_role               text,
    p_first_name         varchar(50),
    p_last_name          varchar(50),
    p_student_id_number  varchar(50)  DEFAULT NULL,
    p_course             varchar(100) DEFAULT NULL,
    p_year_level         varchar(50)  DEFAULT NULL,
    p_semester           varchar(100) DEFAULT NULL,
    p_employee_id        varchar(50)  DEFAULT NULL,
    p_department         varchar(100) DEFAULT NULL,
    p_position           varchar(100) DEFAULT NULL,
    p_address            varchar(255) DEFAULT NULL,
    p_phone_number       varchar(50)  DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_user_id bigint;
BEGIN
    -- Section 8.6: local public registration is GUEST-ONLY. Any other role
    -- (student-cspc, instructor, admin, unknown, blank, NULL) is rejected.
    IF p_role IS DISTINCT FROM 'guest' THEN
        RAISE EXCEPTION 'INVALID_ROLE_FOR_PUBLIC_REGISTRATION'
            USING HINT = 'Local public registration may create guest accounts only.';
    END IF;

    INSERT INTO public.users (
        username, email, password, role,
        first_name, last_name, oauth_provider
    )
    VALUES (
        p_username, p_email, p_password_hash, 'guest',
        p_first_name, p_last_name, 'local'
    )
    RETURNING id INTO v_user_id;

    -- Guest profile inserted only when BOTH address and phone are provided
    -- (unchanged from the prior guest behavior in 0003).
    IF p_address IS NOT NULL AND TRIM(p_address) <> ''
       AND p_phone_number IS NOT NULL AND TRIM(p_phone_number) <> '' THEN
        INSERT INTO public.guest_profiles (user_id, address, phone_number)
        VALUES (v_user_id, p_address, p_phone_number);
    END IF;

    RETURN v_user_id;
END;
$$;

-- Re-affirm least-privilege execution (CREATE OR REPLACE keeps existing grants;
-- this is explicit for a clean re-apply).
REVOKE EXECUTE ON FUNCTION public.app_create_local_user(
    varchar, varchar, varchar, text, varchar, varchar,
    varchar, varchar, varchar, varchar,
    varchar, varchar, varchar,
    varchar, varchar
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_create_local_user(
    varchar, varchar, varchar, text, varchar, varchar,
    varchar, varchar, varchar, varchar,
    varchar, varchar, varchar,
    varchar, varchar
) TO service_role;
