-- 0024_vr_hotspot_guest_visibility.sql
-- Guest building/VR access policy: guests may navigate all scenes and exits,
-- but schedule hotspots stay private and info hotspots require explicit admin
-- approval. The owner applied this migration in Supabase; Codex did not apply
-- or reapply it. Do not reapply an owner-applied migration without fresh
-- explicit database authorization.
BEGIN;

ALTER TABLE public.vr_hotspots
  ADD COLUMN IF NOT EXISTS guest_visible boolean NOT NULL DEFAULT false;

-- A scene or exit hotspot is navigation/arrival content and is always visible
-- to guests. The newly added column defaults existing info/schedule rows to
-- false. This update is safe to repeat and does not overwrite an approved info
-- hotspot if the migration source is accidentally inspected twice.
UPDATE public.vr_hotspots
   SET guest_visible = true
 WHERE hotspot_type IN ('scene', 'exit')
   AND guest_visible = false;

-- Schedule hotspots are never participant-visible. Keep this correction
-- explicit so a pre-existing column or a manually imported row cannot widen
-- schedule access when the migration is applied.
UPDATE public.vr_hotspots
   SET guest_visible = false
 WHERE hotspot_type = 'schedule'
   AND guest_visible = true;

COMMIT;
