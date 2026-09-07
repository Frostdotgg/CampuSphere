-- 0025_event_audience.sql
-- Add role-targeted visibility to campus events. Existing events remain
-- visible to everyone. This source is prepared for the owner to apply; Codex
-- does not apply or reapply Supabase migrations automatically.

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS audience text;

UPDATE public.events
   SET audience = 'all'
 WHERE audience IS NULL;

ALTER TABLE public.events
  ALTER COLUMN audience SET DEFAULT 'all',
  ALTER COLUMN audience SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.events
    ADD CONSTRAINT events_audience_check
    CHECK (audience IN ('all', 'student-cspc', 'instructor', 'guest', 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE INDEX IF NOT EXISTS events_audience_event_date_idx
  ON public.events (audience, event_date DESC, id DESC);

COMMIT;
