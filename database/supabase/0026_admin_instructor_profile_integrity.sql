-- =============================================================================
-- CampuSphere Supabase migration 0026
-- Admin-created instructor profile integrity
-- =============================================================================
-- PREPARED FOR OWNER REVIEW; NOT APPLIED BY CODEX.
--
-- The admin user form intentionally does not collect the retired instructor
-- employee/department/position fields.  The previous admin-create function
-- treated those fields as a prerequisite and therefore created only a users
-- row.  This migration keeps the existing RPC signature, creates a minimal
-- instructor profile whenever the role is instructor, and adds an atomic
-- admin-update function for role changes into instructor.
--
-- This migration is auth/profile-only.  It does not change campus content,
-- route data, VR data, or any selected freeze count/fingerprint.

BEGIN;

-- Backfill only instructor users that are missing their role profile. Existing
-- profile values are never overwritten. The UNIQUE(user_id) constraint makes
-- this safe to repeat if the owner needs to rerun the migration before the
-- migration ledger is recorded.
INSERT INTO public.instructor_profiles (
    user_id, employee_id, department, position, status
)
SELECT
    u.id, '', '', '', 'Active'
FROM public.users AS u
WHERE u.role = 'instructor'
  AND NOT EXISTS (
      SELECT 1
      FROM public.instructor_profiles AS ip
      WHERE ip.user_id = u.id
  )
ON CONFLICT (user_id) DO NOTHING;

-- Keep the deployed 15-argument identity unchanged. The instructor branch
-- now always inserts a profile; supplied non-null values remain supported,
-- while the current admin form's blank values become safe empty strings.
CREATE OR REPLACE FUNCTION public.app_create_admin_managed_user(
    p_username           varchar(50),
    p_email              varchar(100),
    p_password_hash      varchar(255),
    p_role               text,
    p_first_name         varchar(50),
    p_last_name          varchar(50),
    p_student_id_number  varchar(50)  DEFAULT NULL,
    p_course             varchar(100) DEFAULT NULL,
    p_year_level         varchar(50) DEFAULT NULL,
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
    IF p_role NOT IN ('student-cspc', 'instructor', 'admin', 'guest') THEN
        RAISE EXCEPTION 'INVALID_ROLE'
            USING HINT = 'Role must be one of student-cspc, instructor, admin, guest.';
    END IF;

    INSERT INTO public.users (
        username, email, password, role,
        first_name, last_name, oauth_provider
    )
    VALUES (
        p_username, p_email, p_password_hash, p_role,
        p_first_name, p_last_name, 'local'
    )
    RETURNING id INTO v_user_id;

    IF p_role = 'student-cspc'
       AND p_student_id_number IS NOT NULL
       AND TRIM(p_student_id_number) <> '' THEN
        INSERT INTO public.student_profiles (
            user_id, student_id_number, course, year_level,
            enrollment_status, semester
        )
        VALUES (
            v_user_id,
            p_student_id_number,
            COALESCE(p_course, ''),
            COALESCE(NULLIF(TRIM(COALESCE(p_year_level, '')), ''), '1st Year'),
            'Enrolled',
            COALESCE(NULLIF(TRIM(COALESCE(p_semester, '')), ''), '1st Semester 2026-2027')
        );

    ELSIF p_role = 'instructor' THEN
        INSERT INTO public.instructor_profiles (
            user_id, employee_id, department, position, status
        )
        VALUES (
            v_user_id,
            COALESCE(p_employee_id, ''),
            COALESCE(p_department, ''),
            COALESCE(p_position, ''),
            'Active'
        );

    ELSIF p_role = 'guest'
          AND p_address IS NOT NULL AND TRIM(p_address) <> ''
          AND p_phone_number IS NOT NULL AND TRIM(p_phone_number) <> '' THEN
        INSERT INTO public.guest_profiles (user_id, address, phone_number)
        VALUES (v_user_id, p_address, p_phone_number);
    END IF;

    RETURN v_user_id;
END;
$$;

-- Atomic admin update. The existing repository/controller interface remains
-- unchanged; the optional password hash is the final parameter so callers can
-- omit it or pass NULL when the password was not changed.
CREATE OR REPLACE FUNCTION public.app_update_admin_managed_user(
    p_user_id       bigint,
    p_username      varchar(50),
    p_email         varchar(100),
    p_role          text,
    p_first_name    varchar(50),
    p_last_name     varchar(50),
    p_password_hash varchar(255) DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF p_role NOT IN ('student-cspc', 'instructor', 'admin', 'guest') THEN
        RAISE EXCEPTION 'INVALID_ROLE'
            USING HINT = 'Role must be one of student-cspc, instructor, admin, guest.';
    END IF;

    UPDATE public.users
       SET username   = p_username,
           email      = p_email,
           role       = p_role,
           first_name = p_first_name,
           last_name  = p_last_name,
           password   = COALESCE(p_password_hash, password),
           updated_at = now()
     WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'USER_NOT_FOUND';
    END IF;

    -- Preserve an existing profile and its values. Create the minimal row only
    -- when the resulting role is instructor and no row exists yet.
    IF p_role = 'instructor' THEN
        INSERT INTO public.instructor_profiles (
            user_id, employee_id, department, position, status
        )
        VALUES (p_user_id, '', '', '', 'Active')
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
END;
$$;

-- Reassert the server-only execution boundary for both admin functions.
REVOKE EXECUTE ON FUNCTION public.app_create_admin_managed_user(
    varchar, varchar, varchar, text, varchar, varchar,
    varchar, varchar, varchar, varchar,
    varchar, varchar, varchar,
    varchar, varchar
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_create_admin_managed_user(
    varchar, varchar, varchar, text, varchar, varchar,
    varchar, varchar, varchar, varchar,
    varchar, varchar, varchar,
    varchar, varchar
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.app_update_admin_managed_user(
    bigint, varchar, varchar, text, varchar, varchar, varchar
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_update_admin_managed_user(
    bigint, varchar, varchar, text, varchar, varchar, varchar
) TO service_role;

COMMIT;
