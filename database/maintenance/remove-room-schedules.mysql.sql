-- OWNER-CONTROLLED DATA CLEANUP. MySQL 8; no schema migration or startup hook.
-- Back up first, stop old writers, verify the target, then in THIS connection:
-- SET @campusphere_cleanup_database = 'the exact selected database name';
-- SET @campusphere_cleanup_confirmation = 'BACKUP_VERIFIED_REMOVE_ROOM_SCHEDULES';
-- Run with mysql batch mode WITHOUT --force. See docs/room-scheduling-removal.md.
SET NAMES utf8mb4;
DROP TEMPORARY TABLE IF EXISTS cs_schedule_cleanup_gate;
CREATE TEMPORARY TABLE cs_schedule_cleanup_gate (confirmed INT NOT NULL CHECK (confirmed = 1));
START TRANSACTION;
INSERT INTO cs_schedule_cleanup_gate VALUES (IF(
  @campusphere_cleanup_database = DATABASE() AND
  @campusphere_cleanup_confirmation = 'BACKUP_VERIFIED_REMOVE_ROOM_SCHEDULES', 1, 0));

-- The gate predicates also prevent writes if a client incorrectly continues
-- after a failed confirmation statement. Never disable FK checks or use CASCADE.
-- Reuse placed room markers with fresh Guest approval required. The Info text
-- contains room/floor identity only, never schedule images, dates or old prompts.
UPDATE vr_hotspots h LEFT JOIN room_schedule_documents d ON d.id = h.schedule_document_id
SET h.label = COALESCE(NULLIF(TRIM(d.location_label), ''), NULLIF(TRIM(h.schedule_location_label), ''), NULLIF(TRIM(h.label), ''), 'Room information'),
  h.`text` = NULLIF(CONCAT_WS(' - ',
    COALESCE(NULLIF(TRIM(d.location_label), ''), NULLIF(TRIM(h.schedule_location_label), '')),
    COALESCE(NULLIF(TRIM(d.floor_label), ''), NULLIF(TRIM(h.schedule_floor_label), ''))), ''),
  h.hotspot_type = 'info', h.guest_visible = 0, h.target_scene_id = NULL, h.updated_at = h.updated_at
WHERE LOWER(TRIM(h.hotspot_type)) = 'schedule'
  AND EXISTS (SELECT 1 FROM cs_schedule_cleanup_gate WHERE confirmed = 1);
UPDATE vr_hotspots SET schedule_building_id = NULL, schedule_location_type = NULL,
  schedule_location_label = NULL, schedule_floor_label = NULL, schedule_document_id = NULL,
  updated_at = updated_at
WHERE (schedule_building_id IS NOT NULL OR schedule_location_type IS NOT NULL
  OR schedule_location_label IS NOT NULL OR schedule_floor_label IS NOT NULL OR schedule_document_id IS NOT NULL)
  AND EXISTS (SELECT 1 FROM cs_schedule_cleanup_gate WHERE confirmed = 1);
DELETE FROM room_schedule_documents WHERE EXISTS (SELECT 1 FROM cs_schedule_cleanup_gate WHERE confirmed = 1);
DELETE FROM room_schedules WHERE EXISTS (SELECT 1 FROM cs_schedule_cleanup_gate WHERE confirmed = 1);
INSERT INTO cs_schedule_cleanup_gate VALUES (IF(
  (SELECT COUNT(*) FROM room_schedules) = 0 AND (SELECT COUNT(*) FROM room_schedule_documents) = 0 AND
  (SELECT COUNT(*) FROM vr_hotspots WHERE LOWER(TRIM(hotspot_type)) = 'schedule'
    OR schedule_building_id IS NOT NULL OR schedule_location_type IS NOT NULL
    OR schedule_location_label IS NOT NULL OR schedule_floor_label IS NOT NULL OR schedule_document_id IS NOT NULL) = 0, 1, 0));
COMMIT;
DROP TEMPORARY TABLE cs_schedule_cleanup_gate;
SELECT 'room schedule cleanup complete' AS result;
