-- Department news editors. Owner-applied only; no accounts are created.
BEGIN;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department_code varchar(30);
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('student-cspc', 'instructor', 'admin', 'guest', 'department-admin'));
ALTER TABLE public.users ADD CONSTRAINT users_department_code_check CHECK ((role = 'department-admin' AND department_code IS NOT NULL AND department_code IN ('graduate-school','cea','ccs','chs','cthbm','ctde','cas')) OR (role <> 'department-admin' AND department_code IS NULL));
ALTER TABLE public.news_announcements ADD COLUMN IF NOT EXISTS department_code varchar(30) NOT NULL DEFAULT 'university-wide';
ALTER TABLE public.news_announcements ADD CONSTRAINT news_announcements_department_code_check CHECK (department_code IN ('university-wide','graduate-school','cea','ccs','chs','cthbm','ctde','cas'));
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS department_code varchar(30) NOT NULL DEFAULT 'university-wide';
ALTER TABLE public.events ADD CONSTRAINT events_department_code_check CHECK (department_code IN ('university-wide','graduate-school','cea','ccs','chs','cthbm','ctde','cas'));

-- Versioned RPC keeps the original signatures and their permissions intact.
CREATE OR REPLACE FUNCTION public.app_create_admin_managed_user_v2(
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
    p_phone_number       varchar(50)  DEFAULT NULL,
    p_department_code varchar(30) DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_user_id bigint;
BEGIN
    IF (p_role = 'department-admin' AND (p_department_code IS NULL OR p_department_code NOT IN ('graduate-school','cea','ccs','chs','cthbm','ctde','cas')))
       OR (p_role <> 'department-admin' AND p_department_code IS NOT NULL) THEN
        RAISE EXCEPTION 'INVALID_DEPARTMENT';
    END IF;

    IF p_role NOT IN ('student-cspc', 'instructor', 'admin', 'guest', 'department-admin') THEN
        RAISE EXCEPTION 'INVALID_ROLE'
            USING HINT = 'Role must be one of student-cspc, instructor, admin, guest, department-admin.';
    END IF;

    INSERT INTO public.users (
        username, email, password, role,
        first_name, last_name, oauth_provider, department_code
    )
    VALUES (
        p_username, p_email, p_password_hash, p_role,
        p_first_name, p_last_name, 'local', p_department_code
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
REVOKE ALL ON FUNCTION public.app_create_admin_managed_user_v2(varchar, varchar, varchar, text, varchar, varchar, varchar, varchar, varchar, varchar, varchar, varchar, varchar, varchar, varchar, varchar) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_create_admin_managed_user_v2(varchar, varchar, varchar, text, varchar, varchar, varchar, varchar, varchar, varchar, varchar, varchar, varchar, varchar, varchar, varchar) TO service_role;

-- Versioned RPC keeps the original signatures and their permissions intact.
CREATE OR REPLACE FUNCTION public.app_update_admin_managed_user_v2(
    p_user_id       bigint,
    p_username      varchar(50),
    p_email         varchar(100),
    p_role          text,
    p_first_name    varchar(50),
    p_last_name     varchar(50),
    p_password_hash varchar(255) DEFAULT NULL,
    p_department_code varchar(30) DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF (p_role = 'department-admin' AND (p_department_code IS NULL OR p_department_code NOT IN ('graduate-school','cea','ccs','chs','cthbm','ctde','cas')))
       OR (p_role <> 'department-admin' AND p_department_code IS NOT NULL) THEN
        RAISE EXCEPTION 'INVALID_DEPARTMENT';
    END IF;

    IF p_role NOT IN ('student-cspc', 'instructor', 'admin', 'guest', 'department-admin') THEN
        RAISE EXCEPTION 'INVALID_ROLE'
            USING HINT = 'Role must be one of student-cspc, instructor, admin, guest, department-admin.';
    END IF;

    UPDATE public.users
       SET username   = p_username,
           email      = p_email,
           role       = p_role,
           department_code = p_department_code,
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
REVOKE ALL ON FUNCTION public.app_update_admin_managed_user_v2(bigint, varchar, varchar, text, varchar, varchar, varchar, varchar) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_update_admin_managed_user_v2(bigint, varchar, varchar, text, varchar, varchar, varchar, varchar) TO service_role;
COMMIT;
