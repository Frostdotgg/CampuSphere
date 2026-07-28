-- =============================================================================
-- 0013_vr_hotspot_schedule_metadata.sql
-- Milestone 11, Section 11.8A - VR room-door schedule interaction metadata.
-- =============================================================================
-- Adds nullable schedule-target metadata to public.vr_hotspots so admins can
-- mark a panorama hotspot as a real room/facility "door" and the runtime can
-- load matching public room_schedules rows by exact building/location labels.
--
-- APPLY: run this file manually in the Supabase SQL editor. Supabase SQL under
-- database/supabase/ is owner-applied only; this migration is a static
-- declaration until the owner applies it. Every statement is idempotent and
-- safe to re-run.
--
-- Scope:
--   - No schedule seed rows.
--   - No fake SIS/enrollment/instructor-load data.
--   - No Supabase Auth or browser-role grants.
--   - Existing scene/info/exit hotspots keep all schedule columns NULL.
-- =============================================================================

ALTER TABLE public.vr_hotspots
    ADD COLUMN IF NOT EXISTS schedule_building_id bigint
        REFERENCES public.buildings(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS schedule_location_type text
        CONSTRAINT vr_hotspots_schedule_location_type_check
        CHECK (schedule_location_type IS NULL OR schedule_location_type IN ('room', 'facility')),
    ADD COLUMN IF NOT EXISTS schedule_location_label varchar(120),
    ADD COLUMN IF NOT EXISTS schedule_floor_label varchar(80);

CREATE INDEX IF NOT EXISTS vr_hotspots_schedule_target_idx
    ON public.vr_hotspots (schedule_building_id, schedule_location_type, schedule_location_label);

-- =============================================================================
-- End 0013_vr_hotspot_schedule_metadata.sql
-- =============================================================================
