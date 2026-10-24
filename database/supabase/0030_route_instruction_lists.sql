-- Additive only. Owner-applied after external backup and separate authorization.
-- Existing Vehicle entry instructions remain in campus_route_steps, unchanged.
BEGIN;
CREATE TABLE IF NOT EXISTS public.campus_route_instruction_lists (
    destination_building_id bigint NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
    mode varchar(7) NOT NULL CHECK (mode IN ('vehicle', 'walking')),
    direction varchar(5) NOT NULL CHECK (direction IN ('entry', 'exit')),
    steps jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(steps) = 'array' AND jsonb_array_length(steps) <= 200),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (destination_building_id, mode, direction),
    CHECK (mode = 'walking' OR direction = 'exit')
);
ALTER TABLE public.campus_route_instruction_lists ENABLE ROW LEVEL SECURITY;
-- Remove project default grants before restoring only server CRUD operations.
REVOKE ALL ON public.campus_route_instruction_lists FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campus_route_instruction_lists TO service_role;
COMMIT;
