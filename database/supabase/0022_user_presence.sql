-- =============================================================================
-- CampuSphere migration 0022: five-minute user presence
-- Supabase / PostgreSQL. PREPARED FOR OWNER REVIEW; NOT APPLIED BY CODEX.
-- =============================================================================
--
-- Presence is intentionally isolated from public.users.updated_at. The latter
-- records account/profile changes; this table contains only one short-lived
-- last-seen signal per user. No existing users are backfilled.
--
-- Apply this file manually in the owner-controlled Supabase SQL Editor after
-- the application diff has passed its security/performance review. Re-running
-- it is idempotent and does not modify existing presence timestamps.

CREATE TABLE IF NOT EXISTS public.user_presence (
    user_id      bigint PRIMARY KEY
        REFERENCES public.users(id) ON DELETE CASCADE,
    last_seen_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS user_presence_last_seen_at_idx
    ON public.user_presence (last_seen_at);

-- Browser roles must never read or write this server-only table. The Express
-- server uses the service-role client, and the admin endpoint exposes only a
-- deliberately reduced snapshot.
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_presence FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_presence TO service_role;

-- One database-time write at most per user per 60 seconds. The user id comes
-- from the authenticated Express session; no timestamp or interval is caller
-- controlled. SECURITY INVOKER plus a fixed search path keeps this function
-- bounded to the explicitly granted service_role privileges.
CREATE OR REPLACE FUNCTION public.app_touch_user_presence(p_user_id bigint)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
    INSERT INTO public.user_presence (user_id, last_seen_at)
    VALUES (p_user_id, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id) DO UPDATE
       SET last_seen_at = EXCLUDED.last_seen_at
     WHERE public.user_presence.last_seen_at < EXCLUDED.last_seen_at - INTERVAL '60 seconds';
$$;

REVOKE ALL ON FUNCTION public.app_touch_user_presence(bigint)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_touch_user_presence(bigint)
    TO service_role;
