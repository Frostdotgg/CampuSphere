-- =============================================================================
-- 0011_supabase_session_store.sql
-- Milestone 9, Section 9.2 — Supabase session-store schema.
-- =============================================================================
-- Creates the server-only `public.app_sessions` table that backs the future
-- Supabase-backed express-session store (service implementation is Section 9.3;
-- runtime wiring of SESSION_STORE=supabase is Section 9.4). This file mirrors
-- the express-session semantics already used by the MySQL store
-- (services/mysqlSessionStore.js + the app_sessions table in
-- database/schema.sql): `sess` holds the serialized session and `expires_at`
-- is epoch milliseconds used for cleanup.
--
-- APPLY: run this file in the Supabase SQL editor. Supabase SQL under
-- database/supabase/ is applied MANUALLY by the project owner; this file being
-- present is the static declaration only. It is NOT applied automatically and
-- must be applied before any live Supabase session-runtime verification
-- (Sections 9.5 / 9.8). Every statement is idempotent (IF NOT EXISTS / safe
-- REVOKE+GRANT), so the file is safe to apply and re-apply.
--
-- Privacy / security
--   - Session payloads are server-only infrastructure data, not domain data,
--     and may exist for anonymous (pre-login) visitors. No foreign keys.
--   - CampuSphere does NOT use Supabase Auth for application login; it keeps
--     Express session auth and the existing Google OAuth flow.
--   - Browser roles `anon` and `authenticated` receive NO privileges and NO
--     RLS policies, so the Data API (PostgREST) cannot read or write sessions.
--   - `service_role` (used only by the server-only client in config/supabase.js)
--     is the sole role granted table access. As documented in 0001 Section D,
--     the project disables "Automatically expose new tables", so service_role
--     does not auto-inherit privileges on a newly created table; the explicit
--     GRANT below is required for server-side queries to work and keeps a fresh
--     Supabase setup repeatable from this file alone.
--   - The service-role key must never reach EJS templates, anything under
--     public/, browser globals, screenshots, logs, or any committed file.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Table
-- -----------------------------------------------------------------------------
-- sid        — session id (PRIMARY KEY); text, matching express-session ids.
-- sess       — serialized session payload as jsonb (NOT NULL).
-- expires_at — epoch MILLISECONDS (bigint, NOT NULL); indexed for cleanup,
--              mirroring the MySQL store's expires_at semantics.
-- created_at — UTC insert timestamp (audit/debug metadata only).
-- updated_at — UTC last-write timestamp; refreshed by application code on
--              set/touch (no AUTO-UPDATE trigger, matching the repo convention
--              in 0001 where updated_at columns have no trigger yet).
CREATE TABLE IF NOT EXISTS public.app_sessions (
    sid        text        PRIMARY KEY,
    sess       jsonb       NOT NULL,
    expires_at bigint      NOT NULL,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);


-- -----------------------------------------------------------------------------
-- Index (expired-row cleanup path)
-- -----------------------------------------------------------------------------
-- The store deletes rows where expires_at <= now()-in-ms; an index on
-- expires_at keeps that periodic cleanup cheap.
CREATE INDEX IF NOT EXISTS app_sessions_expires_at_idx
    ON public.app_sessions (expires_at);


-- -----------------------------------------------------------------------------
-- Row Level Security (no browser policies)
-- -----------------------------------------------------------------------------
-- Enable RLS with NO policies so anon/authenticated (which respect RLS) can
-- never read or write sessions through the Data API. service_role bypasses RLS
-- and is granted explicit table privileges below.
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- Privileges (service_role only)
-- -----------------------------------------------------------------------------
-- Strip any implicit/default privileges from PUBLIC and from the browser roles,
-- then grant table DML to service_role only. No grants are created for anon or
-- authenticated.
REVOKE ALL ON TABLE public.app_sessions FROM PUBLIC;
REVOKE ALL ON TABLE public.app_sessions FROM anon;
REVOKE ALL ON TABLE public.app_sessions FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_sessions TO service_role;

-- =============================================================================
-- End 0011_supabase_session_store.sql
-- =============================================================================
