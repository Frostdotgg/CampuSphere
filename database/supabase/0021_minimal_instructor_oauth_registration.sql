-- =============================================================================
-- CampuSphere migration 0021: minimal instructor OAuth registration
-- Supabase / PostgreSQL. PREPARED FOR OWNER REVIEW; NOT APPLIED BY CODEX.
-- =============================================================================
--
-- Scope:
--   * Keep the existing app_create_oauth_user_with_profile signature stable.
--   * Require only the verified Google name and OAuth subject for instructors.
--   * Create an Active instructor profile row with blank legacy metadata so
--     the existing one-to-one role-profile relationship remains intact.
--   * Student and guest minimum fields remain unchanged.
--
-- The application must not be promoted until the owner has applied this
-- migration to the selected Supabase project. No existing rows are changed.

CREATE OR REPLACE FUNCTION public.app_create_oauth_user_with_profile(
    p_username                  varchar(50),
    p_email                     varchar(100),
    p_placeholder_password_hash varchar(255),
    p_role                      text,
    p_first_name                varchar(50),
    p_last_name                 varchar(50),
    p_profile_image_url         varchar(255),
    p_oauth_subject             varchar(255),
    p_student_id_number         varchar(50)  DEFAULT NULL,
    p_course                    varchar(100) DEFAULT NULL,
    p_year_level                varchar(50)  DEFAULT NULL,
    p_semester                  varchar(100) DEFAULT NULL,
    p_employee_id               varchar(50)  DEFAULT NULL,
    p_department                varchar(100) DEFAULT NULL,
    p_position                  varchar(100) DEFAULT NULL,
    p_address                   varchar(255) DEFAULT NULL,
    p_phone_number              varchar(50)  DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_user_id bigint;
BEGIN
    IF p_role NOT IN ('student-cspc', 'instructor', 'guest') THEN
        RAISE EXCEPTION 'INVALID_ROLE'
            USING HINT = 'Google OAuth registration must use student-cspc, instructor, or guest. Admin via OAuth is rejected.';
    END IF;

    IF COALESCE(NULLIF(TRIM(COALESCE(p_first_name, '')), ''),
                NULLIF(TRIM(COALESCE(p_last_name,  '')), '')) IS NULL THEN
        RAISE EXCEPTION 'MISSING_NAME';
    END IF;

    IF p_oauth_subject IS NULL OR TRIM(p_oauth_subject) = '' THEN
        RAISE EXCEPTION 'MISSING_OAUTH_SUBJECT';
    END IF;

    INSERT INTO public.users (
        username, email, password, role,
        first_name, last_name, profile_image_url,
        oauth_provider, oauth_subject
    )
    VALUES (
        p_username, p_email, p_placeholder_password_hash, p_role,
        p_first_name, p_last_name, p_profile_image_url,
        'google', p_oauth_subject
    )
    RETURNING id INTO v_user_id;

    IF p_role = 'student-cspc' THEN
        IF p_student_id_number IS NULL OR TRIM(p_student_id_number) = '' THEN
            RAISE EXCEPTION 'MISSING_STUDENT';
        END IF;
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
        -- Employee ID, department, and position are no longer collected from
        -- instructors. Empty strings satisfy the existing NOT NULL columns;
        -- the application never forwards request values for this branch.
        INSERT INTO public.instructor_profiles (
            user_id, employee_id, department, position, status
        )
        VALUES (v_user_id, '', '', '', 'Active');

    ELSIF p_role = 'guest' THEN
        IF p_address IS NULL OR TRIM(p_address) = ''
           OR p_phone_number IS NULL OR TRIM(p_phone_number) = '' THEN
            RAISE EXCEPTION 'MISSING_GUEST';
        END IF;
        INSERT INTO public.guest_profiles (user_id, address, phone_number)
        VALUES (v_user_id, p_address, p_phone_number);
    END IF;

    RETURN v_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.app_create_oauth_user_with_profile(
    varchar, varchar, varchar, text, varchar, varchar, varchar, varchar,
    varchar, varchar, varchar, varchar,
    varchar, varchar, varchar,
    varchar, varchar
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_create_oauth_user_with_profile(
    varchar, varchar, varchar, text, varchar, varchar, varchar, varchar,
    varchar, varchar, varchar, varchar,
    varchar, varchar, varchar,
    varchar, varchar
) TO service_role;
