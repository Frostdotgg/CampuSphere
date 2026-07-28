-- =============================================================================
-- CampuSphere - Supabase Auth/Profile SQL Functions
-- File: database/supabase/0003_auth_profile_functions.sql
-- Milestone 2, Section 2.3
-- =============================================================================
--
-- Purpose
--   Provide atomic PL/pgSQL functions for the multi-table auth/profile writes
--   that the Supabase JS client cannot safely transaction-wrap on its own.
--   The Supabase user repository (added in Sections 2.4 / 2.5) calls these
--   via `.rpc(<function_name>, { ... })` from server-only Node code;
--   controllers never call them directly.
--
--   Tables targeted (all defined in 0001_initial_schema.sql section B.1):
--     - users
--     - student_profiles      (UNIQUE user_id, ON DELETE CASCADE)
--     - instructor_profiles   (UNIQUE user_id, ON DELETE CASCADE)
--     - guest_profiles        (UNIQUE user_id, ON DELETE CASCADE)
--
-- Apply order
--   This file is the third Supabase migration. Apply in order:
--     1. database/supabase/0001_initial_schema.sql
--     2. database/supabase/0002_seed_data.sql
--     3. database/supabase/0003_auth_profile_functions.sql   <-- this file
--   Re-applying is safe: every function is preceded by DROP FUNCTION IF
--   EXISTS so signature evolution between migration runs cannot leave a
--   stale overload behind. After dropping, every CREATE is the canonical
--   signature.
--
-- Scope and non-goals
--   - PL/pgSQL functions only. No table DDL, no seed data, no triggers,
--     no row-level-security policies, no Supabase Auth.
--   - No MySQL syntax. database/schema.sql and database/seed.js are NOT
--     touched by this section; node database/seed.js is NOT required.
--   - No runtime code change. Controllers, routes, middleware, repositories,
--     server.js, views, and public assets are unaffected.
--   - Apply this SQL manually in the dev Supabase project before later
--     write tests; the repo runtime does not call these functions yet.
--
-- Security stance
--   - All functions are SECURITY INVOKER (PostgreSQL default; declared
--     explicitly for documentation). They run with the caller's privileges,
--     which in CampuSphere's server-only Supabase usage is the service_role.
--     The schema already grants INSERT/UPDATE/DELETE on these tables to
--     service_role (0001 Section D), so SECURITY DEFINER is unnecessary and
--     would widen the blast radius if a function were ever accidentally
--     exposed.
--   - Every function pins `SET search_path = pg_catalog, public` so a
--     hostile caller cannot shadow built-in objects through a manipulated
--     search_path.
--   - All table references are schema-qualified (public.users, ...) so
--     resolution does not depend on search_path at all.
--   - EXECUTE is revoked from PUBLIC and granted only to service_role at the
--     bottom of this file. The anon and authenticated roles (which the
--     browser can reach through PostgREST) are deliberately NOT granted
--     EXECUTE on any function in this file.
--   - Supabase Auth is intentionally NOT used. The `users` row remains the
--     identity record. Local accounts use bcrypt hashes computed in Node;
--     Google OAuth rows use oauth_provider='google' + oauth_subject and
--     never store a real Google password (callers pass a non-usable
--     placeholder hash).
--   - Public registration MUST NOT create admin: enforced in
--     app_create_local_user with a CHECK on p_role. Google OAuth registration
--     MUST NOT create admin: enforced in app_create_oauth_user_with_profile.
--     Admin accounts can only be created through
--     app_create_admin_managed_user, intended for the admin user CRUD
--     repository methods (Section 2.10) that are themselves gated by
--     requireRole('admin') at the route layer.
--   - Error codes raised here (INVALID_ROLE_*, MISSING_NAME, MISSING_STUDENT,
--     MISSING_INSTRUCTOR, MISSING_GUEST, MISSING_OAUTH_SUBJECT) mirror the
--     existing controllers/authController.js error codes so the future
--     repository can translate them back to the current controller-facing
--     messages with no controller-visible behavior change.
--
-- Atomicity
--   PL/pgSQL functions execute inside the caller's transaction. Any
--   RAISE EXCEPTION rolls back every write performed inside the function,
--   so the users row + the matching role profile row are either both
--   committed or both rolled back. No partial OAuth completion can persist.
--
-- Upsert semantics (the three app_upsert_*_profile functions)
--   Each upsert uses an explicit UPDATE-first / INSERT-if-not-found pattern
--   rather than INSERT ... ON CONFLICT. The UPDATE runs first against the
--   existing row, then INSERT runs only when no row was updated.
--
--   On the UPDATE-first branch:
--     A NULL parameter means "leave the existing value untouched"
--     (COALESCE(p_col, existing_column)). The repository may pass NULL for
--     any field it does not intend to change when UPDATING an existing
--     profile, even for columns marked NOT NULL in 0001, because the UPDATE
--     never proposes a NULL for those columns - the existing non-NULL value
--     is preserved.
--
--   On the INSERT-if-not-found branch (no row for that user yet):
--     NULL parameter values are forwarded to the new row. Columns marked
--     NOT NULL in 0001 will reject NULL at this point, so the repository
--     must supply complete field sets when CREATING a new profile. The
--     documented exceptions are enrollment_status (defaults to 'Enrolled'
--     for student profiles) and status (defaults to 'Active' for instructor
--     profiles); the function COALESCEs those to their schema-aligned
--     default values when the parameter is NULL.
--
--   This mirrors the "fetch-then-merge-then-update OR
--   insert-with-required-fields" pattern in
--   controllers/profileController.js, executed entirely server-side in a
--   single function call so the two-statement window (UPDATE returns zero
--   rows, then INSERT) stays inside one transaction.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Cleanup: drop any previously installed versions
-- -----------------------------------------------------------------------------
-- Drop before create so signature evolution between migration runs cannot
-- leave a stale overload behind. IF EXISTS makes the first-time apply a
-- no-op for each line.

DROP FUNCTION IF EXISTS public.app_create_local_user(
    varchar, varchar, varchar, text, varchar, varchar,
    varchar, varchar, varchar, varchar,
    varchar, varchar, varchar,
    varchar, varchar
);
DROP FUNCTION IF EXISTS public.app_create_admin_managed_user(
    varchar, varchar, varchar, text, varchar, varchar,
    varchar, varchar, varchar, varchar,
    varchar, varchar, varchar,
    varchar, varchar
);
DROP FUNCTION IF EXISTS public.app_create_oauth_user_with_profile(
    varchar, varchar, varchar, text, varchar, varchar, varchar, varchar,
    varchar, varchar, varchar, varchar,
    varchar, varchar, varchar,
    varchar, varchar
);
DROP FUNCTION IF EXISTS public.app_upsert_student_profile(
    bigint, varchar, varchar, varchar, varchar, varchar
);
DROP FUNCTION IF EXISTS public.app_upsert_instructor_profile(
    bigint, varchar, varchar, varchar, varchar
);
DROP FUNCTION IF EXISTS public.app_upsert_guest_profile(
    bigint, varchar, varchar
);

-- The prior 0003 in this repo used `auth_` prefixed names. If that earlier
-- version was applied to the dev project, drop those legacy overloads too
-- so the project converges on the canonical `app_` names below.
DROP FUNCTION IF EXISTS public.auth_create_local_user(
    varchar, varchar, varchar, text, varchar, varchar
);
DROP FUNCTION IF EXISTS public.auth_create_admin_managed_user(
    varchar, varchar, varchar, text, varchar, varchar,
    varchar, varchar, varchar, varchar,
    varchar, varchar, varchar,
    varchar, varchar
);
DROP FUNCTION IF EXISTS public.auth_create_oauth_user_with_profile(
    varchar, varchar, varchar, text, varchar, varchar, varchar, varchar,
    varchar, varchar, varchar, varchar,
    varchar, varchar, varchar,
    varchar, varchar
);
DROP FUNCTION IF EXISTS public.auth_upsert_student_profile(
    bigint, varchar, varchar, varchar, varchar, varchar
);
DROP FUNCTION IF EXISTS public.auth_upsert_instructor_profile(
    bigint, varchar, varchar, varchar, varchar
);
DROP FUNCTION IF EXISTS public.auth_upsert_guest_profile(
    bigint, varchar, varchar
);


-- -----------------------------------------------------------------------------
-- Function: app_create_local_user
-- -----------------------------------------------------------------------------
-- Public/local registration. Inserts one users row with oauth_provider='local'
-- and OPTIONALLY a matching role profile row in the same transaction.
--
-- The role is restricted to the three public roles; admin is rejected at the
-- SQL boundary as defense in depth, in addition to the controller-level
-- check in authController.registerPost.
--
-- Role profile creation is optional and is driven by the role-specific
-- minimum field(s). Matching controllers/authController.js -> registerPost:
--   - role='student-cspc': profile inserted only if p_student_id_number is
--     non-NULL and non-blank.
--   - role='instructor':   profile inserted only if p_employee_id is
--     non-NULL and non-blank (the controller always passes a value here,
--     even if blank; the function treats blank as "skip" so a future caller
--     can opt out of profile creation explicitly).
--   - role='guest':        profile inserted only if BOTH p_address and
--     p_phone_number are non-NULL and non-blank.
-- The repository (Section 2.5) decides which fields to pass; this function
-- only enforces the schema-level NOT NULL columns when it does insert.
--
-- Returns the new users.id (bigint). The repository SELECTs the full row
-- separately to hydrate req.session.user.
--
-- Errors raised:
--   INVALID_ROLE_FOR_PUBLIC_REGISTRATION
--     p_role is not one of 'student-cspc', 'instructor', 'guest'.

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
    IF p_role NOT IN ('student-cspc', 'instructor', 'guest') THEN
        RAISE EXCEPTION 'INVALID_ROLE_FOR_PUBLIC_REGISTRATION'
            USING HINT = 'Public registration must use student-cspc, instructor, or guest.';
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

    ELSIF p_role = 'instructor'
          AND p_employee_id IS NOT NULL
          AND TRIM(p_employee_id) <> '' THEN
        INSERT INTO public.instructor_profiles (
            user_id, employee_id, department, position, status
        )
        VALUES (
            v_user_id,
            p_employee_id,
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


-- -----------------------------------------------------------------------------
-- Function: app_create_admin_managed_user
-- -----------------------------------------------------------------------------
-- Admin-managed user creation. Accepts any of the four canonical roles
-- (including 'admin') and optionally inserts the corresponding role profile
-- in the same transaction. Intended to be called only from the admin user
-- repository methods (Section 2.10) which are themselves reached only
-- through routes gated by requireRole('admin').
--
-- The role profile is created only when the role-specific minimums are
-- present, matching the existing adminUsersController behavior:
--   - role='student-cspc' requires p_student_id_number.
--     course / year_level / semester fall back to safe defaults.
--   - role='instructor'   requires p_employee_id.
--     department / position default to empty strings.
--   - role='guest'        requires p_address AND p_phone_number.
-- When the role-specific minimums are NULL/blank, only the users row is
-- created; the caller can call the appropriate upsert function afterwards.
-- Admin users never have a role profile row (no admin_profiles table).
--
-- Returns the new users.id (bigint).
--
-- Errors raised:
--   INVALID_ROLE - p_role is not one of the four canonical roles.

CREATE OR REPLACE FUNCTION public.app_create_admin_managed_user(
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

    ELSIF p_role = 'instructor'
          AND p_employee_id IS NOT NULL
          AND TRIM(p_employee_id) <> '' THEN
        INSERT INTO public.instructor_profiles (
            user_id, employee_id, department, position, status
        )
        VALUES (
            v_user_id,
            p_employee_id,
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


-- -----------------------------------------------------------------------------
-- Function: app_create_oauth_user_with_profile
-- -----------------------------------------------------------------------------
-- Atomic Google OAuth user + role-profile creation. Mirrors the multi-table
-- transaction currently inlined in
-- controllers/authController.js -> createOAuthUserWithProfile so a future
-- repository can call it with no behavior change.
--
-- The function:
--   - Forces oauth_provider='google' and stores p_oauth_subject (the Google
--     `sub` claim). p_oauth_subject is required; the partial unique index
--     users_oauth_provider_subject_uidx already prevents duplicate
--     (provider, subject) pairs at the schema level.
--   - Stores p_placeholder_password_hash as the password. The repository
--     MUST pass a freshly bcrypt-hashed random value here; the password
--     column is NOT NULL at the schema level. NO real Google password is
--     ever stored.
--   - REJECTS p_role='admin' even when called from the OAuth flow. Google
--     OAuth can never escalate to admin through this path.
--   - REQUIRES the role-specific minimum fields and raises a MISSING_*
--     error if absent, matching the controller's error codes.
--   - Returns the new users.id (bigint).
--
-- Errors raised:
--   INVALID_ROLE          - p_role not in (student-cspc, instructor, guest).
--   MISSING_NAME          - both p_first_name and p_last_name are blank.
--   MISSING_OAUTH_SUBJECT - p_oauth_subject is NULL or blank.
--   MISSING_STUDENT       - role='student-cspc' but p_student_id_number blank.
--   MISSING_INSTRUCTOR    - role='instructor'  but p_employee_id blank.
--   MISSING_GUEST         - role='guest'       but address or phone is blank.

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
        IF p_employee_id IS NULL OR TRIM(p_employee_id) = '' THEN
            RAISE EXCEPTION 'MISSING_INSTRUCTOR';
        END IF;
        INSERT INTO public.instructor_profiles (
            user_id, employee_id, department, position, status
        )
        VALUES (
            v_user_id,
            p_employee_id,
            COALESCE(p_department, ''),
            COALESCE(p_position, ''),
            'Active'
        );

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


-- -----------------------------------------------------------------------------
-- Function: app_upsert_student_profile
-- -----------------------------------------------------------------------------
-- INSERT or UPDATE one row in student_profiles for the given user_id.
-- Mirrors profileController.updateProfile's "fetch-then-merge-then-update OR
-- insert-with-required-fields" pattern in a single atomic statement.
--
-- Semantics:
--   - When no row exists for p_user_id, an INSERT runs with the supplied
--     values. The 0001 schema marks student_id_number, course, year_level,
--     and semester as NOT NULL, so the repository must supply non-NULL
--     values for those four when creating a new profile.
--   - When a row exists, an UPDATE runs. Any NULL parameter means
--     "leave the existing column value untouched"
--     (COALESCE(p_col, student_profiles.col)).
--   - enrollment_status defaults to 'Enrolled' on insert when not supplied.
--
-- Implementation note:
--   Uses explicit UPDATE-first / INSERT-if-not-found rather than
--   INSERT ... ON CONFLICT. The ON CONFLICT form evaluates NOT NULL on the
--   proposed INSERT row BEFORE the conflict resolution branch, so a partial
--   UPDATE that legitimately wants to pass NULL for an existing NOT NULL
--   column (student_id_number, course, year_level, semester) would fail
--   with a not_null_violation before the UPDATE branch can preserve the
--   existing value. The UPDATE-first form sidesteps that constraint
--   evaluation entirely on the partial-update path.

CREATE OR REPLACE FUNCTION public.app_upsert_student_profile(
    p_user_id           bigint,
    p_student_id_number varchar(50)  DEFAULT NULL,
    p_course            varchar(100) DEFAULT NULL,
    p_year_level        varchar(50)  DEFAULT NULL,
    p_enrollment_status varchar(50)  DEFAULT NULL,
    p_semester          varchar(100) DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
    UPDATE public.student_profiles
       SET student_id_number = COALESCE(p_student_id_number, student_id_number),
           course            = COALESCE(p_course,            course),
           year_level        = COALESCE(p_year_level,        year_level),
           enrollment_status = COALESCE(p_enrollment_status, enrollment_status),
           semester          = COALESCE(p_semester,          semester)
     WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        INSERT INTO public.student_profiles (
            user_id, student_id_number, course, year_level,
            enrollment_status, semester
        )
        VALUES (
            p_user_id,
            p_student_id_number,
            p_course,
            p_year_level,
            COALESCE(p_enrollment_status, 'Enrolled'),
            p_semester
        );
    END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- Function: app_upsert_instructor_profile
-- -----------------------------------------------------------------------------
-- INSERT or UPDATE one row in instructor_profiles for the given user_id.
-- Same NULL-means-leave-alone semantics as app_upsert_student_profile.
--
-- 0001 marks employee_id, department, and position as NOT NULL; on the
-- INSERT branch the repository must supply non-NULL values for those.
-- status defaults to 'Active' on insert when not supplied.

CREATE OR REPLACE FUNCTION public.app_upsert_instructor_profile(
    p_user_id     bigint,
    p_employee_id varchar(50)  DEFAULT NULL,
    p_department  varchar(100) DEFAULT NULL,
    p_position    varchar(100) DEFAULT NULL,
    p_status      varchar(50)  DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
    UPDATE public.instructor_profiles
       SET employee_id = COALESCE(p_employee_id, employee_id),
           department  = COALESCE(p_department,  department),
           position    = COALESCE(p_position,    position),
           status      = COALESCE(p_status,      status)
     WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        INSERT INTO public.instructor_profiles (
            user_id, employee_id, department, position, status
        )
        VALUES (
            p_user_id,
            p_employee_id,
            p_department,
            p_position,
            COALESCE(p_status, 'Active')
        );
    END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- Function: app_upsert_guest_profile
-- -----------------------------------------------------------------------------
-- INSERT or UPDATE one row in guest_profiles for the given user_id.
-- Same NULL-means-leave-alone semantics. guest_profiles carries updated_at
-- (the only role profile table that does), so the UPDATE branch refreshes
-- it explicitly to now(); the INSERT branch relies on the column DEFAULT.
--
-- 0001 marks address and phone_number as NOT NULL; on the INSERT branch
-- the repository must supply non-NULL values.

CREATE OR REPLACE FUNCTION public.app_upsert_guest_profile(
    p_user_id      bigint,
    p_address      varchar(255) DEFAULT NULL,
    p_phone_number varchar(50)  DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
    UPDATE public.guest_profiles
       SET address      = COALESCE(p_address,      address),
           phone_number = COALESCE(p_phone_number, phone_number),
           updated_at   = now()
     WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        INSERT INTO public.guest_profiles (user_id, address, phone_number)
        VALUES (p_user_id, p_address, p_phone_number);
    END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- Execute privileges
-- -----------------------------------------------------------------------------
-- By default PostgreSQL grants EXECUTE on new functions to PUBLIC. Revoke
-- that and grant EXECUTE only to service_role, the role used by the
-- server-only Supabase client in config/supabase.js. The anon and
-- authenticated roles (which the browser can reach via PostgREST) are
-- deliberately NOT granted EXECUTE on any function in this file.

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

REVOKE EXECUTE ON FUNCTION public.app_upsert_student_profile(
    bigint, varchar, varchar, varchar, varchar, varchar
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_upsert_student_profile(
    bigint, varchar, varchar, varchar, varchar, varchar
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.app_upsert_instructor_profile(
    bigint, varchar, varchar, varchar, varchar
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_upsert_instructor_profile(
    bigint, varchar, varchar, varchar, varchar
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.app_upsert_guest_profile(
    bigint, varchar, varchar
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_upsert_guest_profile(
    bigint, varchar, varchar
) TO service_role;


-- -----------------------------------------------------------------------------
-- Notes for reviewers and follow-up sections
-- -----------------------------------------------------------------------------
-- - Apply manually in the dev Supabase project before any write-path
--   migration section runs (Section 2.5 onward). Re-applying is safe.
-- - Section 2.4 (read methods) does NOT call these functions.
-- - Section 2.5 (write methods) calls them via .rpc(...) from
--   repositories/userRepository.js. Suggested mapping:
--     - createLocalUser              -> app_create_local_user
--     - createOAuthUserWithProfile   -> app_create_oauth_user_with_profile
--     - upsertStudentProfile         -> app_upsert_student_profile
--     - upsertInstructorProfile      -> app_upsert_instructor_profile
--     - upsertGuestProfile           -> app_upsert_guest_profile
-- - Section 2.6 (local register/login migration) flips its Supabase branch
--   to use app_create_local_user.
-- - Section 2.7 (Google OAuth flow migration) flips its Supabase branch
--   to use app_create_oauth_user_with_profile.
-- - Section 2.8 (profile update migration) flips its Supabase branch to use
--   the three app_upsert_*_profile functions plus a separate UPDATE for the
--   user's first/last name (no function provided here; a single-table
--   UPDATE on users does not need an atomic wrapper).
-- - Section 2.10 (admin user CRUD) calls app_create_admin_managed_user for
--   create; updates and deletes can use direct UPDATE/DELETE statements
--   from the repository or, if atomicity across users + profile is needed,
--   a follow-up 0004 migration can add admin update/delete functions.
-- - Function naming uses the app_ prefix to keep these grep-distinguishable
--   from any future Supabase-managed or extension-provided functions and
--   to converge away from the earlier auth_ prefix that an earlier draft
--   of this section used.
-- - These functions intentionally do NOT update users.updated_at on every
--   write. A later migration may add a BEFORE UPDATE trigger if the team
--   wants automatic refreshes (matches the open TODO at 0001 line 103).
-- =============================================================================
