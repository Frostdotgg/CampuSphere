-- =============================================================================
-- CampuSphere migration 0019: BE.5 selected 13-building demo parity correction
-- Supabase / PostgreSQL. PREPARED FOR OWNER REVIEW; NOT APPLIED BY CODEX.
-- =============================================================================
--
-- Scope:
--   * Standardize the canonical CAS public description.
--   * Standardize the stable main-gate node's public label.
--   * Set the CAS building and route node to the owner-approved full-precision
--     coordinate.
--   * Rebuild only east-walk -> cas and cas -> east-walk drawing geometries,
--     deriving the reverse mechanically.
--
-- The current 13 buildings are the selected orientation-demo roster, not a
-- permanent whole-campus lock. Normal admin editing remains supported. Future
-- additions or corrections require refreshed verification evidence.
--
-- Natural keys only. No backend-local numeric id is hardcoded.
-- Data-only. No schema, function, policy, grant, schedule, VR, media, session,
-- authentication, or authorization change is made.
-- =============================================================================

BEGIN;

-- Deterministic lock order shared by every operation in this migration.
LOCK TABLE public.buildings   IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.route_nodes IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.route_edges IN SHARE ROW EXCLUSIVE MODE;

-- Fail closed before the first write. Counts and identities are checked while
-- all three tables remain locked against concurrent admin mutations.
DO $$
DECLARE
    building_count integer;
    node_count     integer;
    edge_count     integer;
    graph_buildings integer;
    graph_nodes     integer;
    graph_edges     integer;
BEGIN
    SELECT count(*) INTO graph_buildings FROM public.buildings;
    SELECT count(*) INTO graph_nodes     FROM public.route_nodes;
    SELECT count(*) INTO graph_edges     FROM public.route_edges;

    IF graph_buildings <> 13 OR graph_nodes <> 20 OR graph_edges <> 48 THEN
        RAISE EXCEPTION
            'Migration 0019 preflight FAILED: selected-demo graph counts do not match the reviewed baseline. No changes applied.';
    END IF;

    SELECT count(*) INTO building_count
      FROM public.buildings
     WHERE name = 'College of Arts and Sciences';
    IF building_count <> 1 THEN
        RAISE EXCEPTION
            'Migration 0019 preflight FAILED: canonical CAS building identity is missing or ambiguous. No changes applied.';
    END IF;

    SELECT count(*) INTO node_count
      FROM public.route_nodes
     WHERE node_key IN ('main-gate', 'east-walk', 'cas');
    IF node_count <> 3 OR EXISTS (
        SELECT 1
          FROM public.route_nodes
         WHERE node_key IN ('main-gate', 'east-walk', 'cas')
         GROUP BY node_key
        HAVING count(*) <> 1
    ) THEN
        RAISE EXCEPTION
            'Migration 0019 preflight FAILED: required route-node identity is missing or ambiguous. No changes applied.';
    END IF;

    SELECT count(*) INTO edge_count
      FROM public.route_edges e
      JOIN public.route_nodes f ON f.id = e.from_node_id
      JOIN public.route_nodes t ON t.id = e.to_node_id
     WHERE (f.node_key = 'east-walk' AND t.node_key = 'cas')
        OR (f.node_key = 'cas' AND t.node_key = 'east-walk');
    IF edge_count <> 2 THEN
        RAISE EXCEPTION
            'Migration 0019 preflight FAILED: required CAS directed-edge identities are missing or ambiguous. No changes applied.';
    END IF;
END
$$;

-- Canonical CAS public metadata. Unknown details/media remain untouched.
UPDATE public.buildings
   SET category    = 'Academic',
       description = 'College of Arts and Sciences (CAS)',
       lat         = 13.40594916::numeric,
       lng         = 123.37704274::numeric,
       location    = extensions.ST_SetSRID(
                         extensions.ST_MakePoint(
                             123.37704274::double precision,
                             13.40594916::double precision
                         ),
                         4326
                     )::extensions.geography,
       updated_at  = now()
 WHERE name = 'College of Arts and Sciences';

-- Public node labels and the full-precision CAS endpoint.
UPDATE public.route_nodes
   SET label      = 'Guard House / Main Gate',
       updated_at = now()
 WHERE node_key = 'main-gate';

UPDATE public.route_nodes rn
   SET label       = 'College of Arts and Sciences',
       building_id = b.id,
       lat         = 13.40594916::numeric,
       lng         = 123.37704274::numeric,
       location    = extensions.ST_SetSRID(
                         extensions.ST_MakePoint(
                             123.37704274::double precision,
                             13.40594916::double precision
                         ),
                         4326
                     )::extensions.geography,
       updated_at  = now()
  FROM public.buildings b
 WHERE rn.node_key = 'cas'
   AND b.name = 'College of Arts and Sciences';

-- Define the forward geometry once from live natural-key endpoints, then derive
-- its reverse mechanically. Scalar routing fields remain unchanged.
WITH endpoint_ids AS (
    SELECT
        ew.id  AS east_walk_id,
        cas.id AS cas_id,
        ew.lat AS east_walk_lat,
        ew.lng AS east_walk_lng,
        cas.lat AS cas_lat,
        cas.lng AS cas_lng
      FROM public.route_nodes ew
      CROSS JOIN public.route_nodes cas
     WHERE ew.node_key = 'east-walk'
       AND cas.node_key = 'cas'
),
shaped AS (
    SELECT
        east_walk_id,
        cas_id,
        jsonb_build_array(
            jsonb_build_object('lat', east_walk_lat, 'lng', east_walk_lng),
            jsonb_build_object('lat', 13.40583::numeric, 'lng', 123.37675::numeric),
            jsonb_build_object('lat', 13.40592::numeric, 'lng', 123.37674::numeric),
            jsonb_build_object('lat', cas_lat, 'lng', cas_lng)
        ) AS forward_geometry
      FROM endpoint_ids
),
directed AS (
    SELECT east_walk_id AS from_id, cas_id AS to_id, forward_geometry AS geometry
      FROM shaped
    UNION ALL
    SELECT cas_id AS from_id,
           east_walk_id AS to_id,
           (
               SELECT jsonb_agg(p.elem ORDER BY p.ord DESC)
                 FROM jsonb_array_elements(shaped.forward_geometry)
                      WITH ORDINALITY AS p(elem, ord)
           ) AS geometry
      FROM shaped
)
UPDATE public.route_edges e
   SET path_geometry = d.geometry
  FROM directed d
 WHERE e.from_node_id = d.from_id
   AND e.to_node_id   = d.to_id;

-- Prove the exact public values and the complete pinned topology before COMMIT.
DO $$
DECLARE
    cas_public_count integer;
    gate_label_count integer;
    cas_node_count   integer;
    cas_edge_count   integer;
    graph_buildings  integer;
    graph_nodes      integer;
    graph_edges      integer;
    pair_count       integer;
    geometry_count   integer;
    reverse_count    integer;
    routable_count   integer;
    expected_forward jsonb;
    expected_reverse jsonb;
BEGIN
    SELECT count(*) INTO cas_public_count
      FROM public.buildings
     WHERE name = 'College of Arts and Sciences'
       AND category = 'Academic'
       AND description = 'College of Arts and Sciences (CAS)'
       AND lat = 13.40594916::numeric
       AND lng = 123.37704274::numeric;

    SELECT count(*) INTO gate_label_count
      FROM public.route_nodes
     WHERE node_key = 'main-gate'
       AND label = 'Guard House / Main Gate';

    SELECT count(*) INTO cas_node_count
      FROM public.route_nodes rn
      JOIN public.buildings b ON b.id = rn.building_id
     WHERE rn.node_key = 'cas'
       AND rn.label = 'College of Arts and Sciences'
       AND rn.lat = 13.40594916::numeric
       AND rn.lng = 123.37704274::numeric
       AND b.name = 'College of Arts and Sciences';

    IF cas_public_count <> 1 OR gate_label_count <> 1 OR cas_node_count <> 1 THEN
        RAISE EXCEPTION
            'Migration 0019 postcondition FAILED: selected-demo public metadata did not reach the reviewed state. Transaction rolled back.';
    END IF;

    SELECT jsonb_build_array(
               jsonb_build_object('lat', ew.lat, 'lng', ew.lng),
               jsonb_build_object('lat', 13.40583::numeric, 'lng', 123.37675::numeric),
               jsonb_build_object('lat', 13.40592::numeric, 'lng', 123.37674::numeric),
               jsonb_build_object('lat', cas.lat, 'lng', cas.lng)
           )
      INTO expected_forward
      FROM public.route_nodes ew
      CROSS JOIN public.route_nodes cas
     WHERE ew.node_key = 'east-walk'
       AND cas.node_key = 'cas';

    SELECT jsonb_agg(p.elem ORDER BY p.ord DESC)
      INTO expected_reverse
      FROM jsonb_array_elements(expected_forward)
           WITH ORDINALITY AS p(elem, ord);

    SELECT count(*) INTO cas_edge_count
      FROM public.route_edges e
      JOIN public.route_nodes f ON f.id = e.from_node_id
      JOIN public.route_nodes t ON t.id = e.to_node_id
     WHERE (f.node_key = 'east-walk' AND t.node_key = 'cas'
            AND e.path_geometry = expected_forward)
        OR (f.node_key = 'cas' AND t.node_key = 'east-walk'
            AND e.path_geometry = expected_reverse);
    IF cas_edge_count <> 2 THEN
        RAISE EXCEPTION
            'Migration 0019 postcondition FAILED: CAS geometry rows did not reach the reviewed state. Transaction rolled back.';
    END IF;

    SELECT count(*) INTO graph_buildings FROM public.buildings;
    SELECT count(*) INTO graph_nodes     FROM public.route_nodes;
    SELECT count(*) INTO graph_edges     FROM public.route_edges;

    SELECT count(*) INTO pair_count
      FROM public.route_edges e
      JOIN public.route_nodes f ON f.id = e.from_node_id
      JOIN public.route_nodes t ON t.id = e.to_node_id
      JOIN public.route_edges r
        ON r.from_node_id = e.to_node_id
       AND r.to_node_id   = e.from_node_id
     WHERE f.node_key < t.node_key;

    SELECT count(*) INTO geometry_count
      FROM public.route_edges e
      JOIN public.route_nodes f ON f.id = e.from_node_id
      JOIN public.route_nodes t ON t.id = e.to_node_id
     WHERE CASE
         WHEN jsonb_typeof(e.path_geometry) <> 'array' THEN false
         WHEN jsonb_array_length(e.path_geometry) NOT BETWEEN 2 AND 200 THEN false
         ELSE
             NOT EXISTS (
                 SELECT 1
                   FROM jsonb_array_elements(e.path_geometry) AS p(elem)
                  WHERE CASE
                      WHEN jsonb_typeof(p.elem) <> 'object' THEN true
                      WHEN jsonb_typeof(p.elem -> 'lat') <> 'number' THEN true
                      WHEN jsonb_typeof(p.elem -> 'lng') <> 'number' THEN true
                      ELSE
                          (p.elem ->> 'lat')::numeric NOT BETWEEN -90::numeric AND 90::numeric
                       OR (p.elem ->> 'lng')::numeric NOT BETWEEN -180::numeric AND 180::numeric
                  END
             )
         AND (e.path_geometry -> 0 ->> 'lat')::numeric = f.lat
         AND (e.path_geometry -> 0 ->> 'lng')::numeric = f.lng
         AND (e.path_geometry -> (jsonb_array_length(e.path_geometry) - 1) ->> 'lat')::numeric = t.lat
         AND (e.path_geometry -> (jsonb_array_length(e.path_geometry) - 1) ->> 'lng')::numeric = t.lng
     END;

    IF geometry_count <> 48 THEN
        RAISE EXCEPTION
            'Migration 0019 postcondition FAILED: route geometry validity or endpoint continuity changed. Transaction rolled back.';
    END IF;

    SELECT count(*) INTO reverse_count
      FROM public.route_edges e
      JOIN public.route_nodes f ON f.id = e.from_node_id
      JOIN public.route_nodes t ON t.id = e.to_node_id
      JOIN public.route_edges r
        ON r.from_node_id = e.to_node_id
       AND r.to_node_id   = e.from_node_id
     WHERE f.node_key < t.node_key
       AND r.path_geometry = (
           SELECT jsonb_agg(p.elem ORDER BY p.ord DESC)
             FROM jsonb_array_elements(e.path_geometry)
                  WITH ORDINALITY AS p(elem, ord)
       );

    WITH RECURSIVE reachable(node_id) AS (
        SELECT id
          FROM public.route_nodes
         WHERE node_key = 'main-gate'
        UNION
        SELECT e.to_node_id
          FROM public.route_edges e
          JOIN reachable r ON r.node_id = e.from_node_id
         WHERE e.is_accessible = true
    )
    SELECT count(DISTINCT rn.building_id) INTO routable_count
      FROM reachable r
      JOIN public.route_nodes rn ON rn.id = r.node_id
     WHERE rn.building_id IS NOT NULL;

    IF graph_buildings <> 13
       OR graph_nodes <> 20
       OR graph_edges <> 48
       OR pair_count <> 24
       OR geometry_count <> 48
       OR reverse_count <> 24
       OR routable_count <> 13 THEN
        RAISE EXCEPTION
            'Migration 0019 postcondition FAILED: pinned selected-demo topology was not preserved. Transaction rolled back.';
    END IF;
END
$$;

COMMIT;

-- Owner rollout remains separate:
--   1. Codex review and dry-run evidence.
--   2. Owner applies this SQL once.
--   3. Read-only probes verify 20/48/24/48/24/13 and backend parity.
