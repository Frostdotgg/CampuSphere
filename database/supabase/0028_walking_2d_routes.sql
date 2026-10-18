-- Dedicated administrator-drawn pedestrian paths. Apply only with owner database authorization.
CREATE TABLE IF NOT EXISTS public.walking_routes (
    destination_building_id bigint PRIMARY KEY REFERENCES public.buildings(id) ON DELETE CASCADE,
    path_geometry jsonb NOT NULL CHECK (jsonb_typeof(path_geometry) = 'array'),
    distance_meters integer NOT NULL CHECK (distance_meters > 0),
    walk_time_seconds integer NOT NULL CHECK (walk_time_seconds > 0),
    updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.walking_routes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.walking_routes TO service_role;
