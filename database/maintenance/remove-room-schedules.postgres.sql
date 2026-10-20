-- OWNER-CONTROLLED DATA CLEANUP, not a schema migration or application startup task.
-- Back up first, stop every old schedule writer, verify the target project.
-- In this SAME connection set campusphere.cleanup_database to its exact database
-- name and campusphere.cleanup_confirmation to BACKUP_VERIFIED_REMOVE_ROOM_SCHEDULES.
-- Run with psql ON_ERROR_STOP=1. See docs/room-scheduling-removal.md.
BEGIN;
DO $$
BEGIN
  IF current_setting('campusphere.cleanup_database', true) IS DISTINCT FROM current_database()
     OR current_setting('campusphere.cleanup_confirmation', true) IS DISTINCT FROM 'BACKUP_VERIFIED_REMOVE_ROOM_SCHEDULES' THEN
    RAISE EXCEPTION 'Cleanup refused: verify target and backup confirmation in this connection.';
  END IF;
END $$;

LOCK TABLE public.room_schedules, public.room_schedule_documents, public.vr_hotspots IN EXCLUSIVE MODE;
-- Reuse the placed room markers. Do not carry schedule images, dates, URLs or
-- old schedule prompts into Info text. Guest approval must be explicit later.
UPDATE public.vr_hotspots h SET
  label = coalesce(nullif(trim(d.location_label), ''), nullif(trim(h.schedule_location_label), ''), nullif(trim(h.label), ''), 'Room information'),
  text = nullif(concat_ws(' - ',
    coalesce(nullif(trim(d.location_label), ''), nullif(trim(h.schedule_location_label), '')),
    coalesce(nullif(trim(d.floor_label), ''), nullif(trim(h.schedule_floor_label), ''))), ''),
  hotspot_type = 'info', guest_visible = false, target_scene_id = NULL
FROM (SELECT s.id, doc.location_label, doc.floor_label
      FROM public.vr_hotspots s LEFT JOIN public.room_schedule_documents doc ON doc.id = s.schedule_document_id
      WHERE lower(trim(s.hotspot_type)) = 'schedule') d
WHERE h.id = d.id;
UPDATE public.vr_hotspots SET schedule_building_id = NULL, schedule_location_type = NULL,
  schedule_location_label = NULL, schedule_floor_label = NULL, schedule_document_id = NULL
WHERE schedule_building_id IS NOT NULL OR schedule_location_type IS NOT NULL
  OR schedule_location_label IS NOT NULL OR schedule_floor_label IS NOT NULL OR schedule_document_id IS NOT NULL;
DELETE FROM public.room_schedule_documents;
DELETE FROM public.room_schedules;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.room_schedules) OR EXISTS (SELECT 1 FROM public.room_schedule_documents)
     OR EXISTS (SELECT 1 FROM public.vr_hotspots WHERE lower(trim(hotspot_type)) = 'schedule'
       OR schedule_building_id IS NOT NULL OR schedule_location_type IS NOT NULL
       OR schedule_location_label IS NOT NULL OR schedule_floor_label IS NOT NULL OR schedule_document_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Cleanup postcondition failed; transaction will not commit.';
  END IF;
END $$;
COMMIT;
SELECT 'room schedule cleanup complete' AS result;
