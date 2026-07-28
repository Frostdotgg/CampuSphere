-- =============================================================================
-- 0014_route_graph_accuracy.sql
-- Pre-Milestone-12 repair: Map Route Graph Accuracy and Destination Coverage
-- =============================================================================
--
-- Purpose
--   /map "Set as Destination" lines cut across campus because the demo route
--   graph was sparse: a single long flagpole -> ccs edge (220 m straight line)
--   and no route-node mappings for most visible destination buildings (CAS,
--   CHS, Green Building, Canteen / Cafeteria, ICTU, Medical & Dental Clinic,
--   Auditorium, Main Academic Building, Engineering Building).
--
--   This migration mirrors the updated database/seed.js route graph exactly
--   (20 nodes, 26 undirected connections = 52 directed rows). Junction
--   placements follow the OSM-mapped campus service roads:
--     - 11 NEW route_nodes: building nodes for ICTU, Canteen / Cafeteria,
--       Auditorium, Green Building, College of Arts and Sciences, College of
--       Health Sciences (CHS), Main Academic Building, Engineering Building,
--       plus three road junctions ('mid-campus', 'east-walk', 'west-road')
--       placed on real road vertices.
--     - 1 REMAPPED node: 'clinic' now maps to the real Medical & Dental
--       Clinic building on the east side (it was an unmapped mid-campus
--       service point).
--     - 18 NEW undirected walkable connections (36 directed rows) forming
--       the south-corridor spine (flagpole -> ICTU/gymnasium -> mid-campus
--       -> east-walk -> Green Building / CAS -> CCS / Clinic -> CHS), the
--       north road (library/canteen/auditorium), and the west entrance road
--       (main-gate -> west-road -> Engineering / Main Academic -> flagpole).
--     - Kept original connections have distances refreshed to haversine
--       meters (the old demo values skewed Dijkstra toward detours).
--     - 3 RETIRED undirected pairs (deleted in both directions):
--       flagpole <-> ccs, flagpole <-> clinic, and the interim
--       mid-campus <-> green-building.
--
-- Idempotency
--   - route_nodes: ON CONFLICT (node_key) DO UPDATE (same idiom as 0002).
--   - route_edges: ON CONFLICT (from_node_id, to_node_id) DO UPDATE.
--   - Retired edges: DELETE by node_key pair; deleting an absent pair
--     affects 0 rows. Safe to re-run.
--
-- Building resolution
--   building_id resolves by buildings.name via LEFT JOIN (never by numeric
--   id — identities differ between environments). If a named building does
--   not exist in this Supabase project (e.g. 'College of Arts and Sciences'
--   was added through the admin UI in some environments), its node keeps
--   building_id NULL and /api/pathfind returns the existing clean sanitized
--   no-route state for that destination — nothing draws a wrong line.
--
-- Directionality
--   Every walkable connection is stored as TWO directed rows (A->B, B->A),
--   matching utils/pathfinding.js, which never auto-reverses an edge.
--
-- Boundaries
--   Data-only: no schema, grants, RLS, auth, session, schedule, VR-hotspot,
--   or Cloudinary changes. campus_routes / campus_route_steps are untouched.
--   Applied MANUALLY by the project owner in the Supabase SQL editor.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. route_nodes: full refreshed node set (19 rows; upsert by node_key)
-- -----------------------------------------------------------------------------
-- location uses the schema-qualified PostGIS expression from 0001/0002 so this
-- migration never depends on `extensions` being in search_path. ST_MakePoint
-- takes (lng, lat) — longitude first.
WITH n(node_key, label, node_type, building_name, lat, lng, display_order) AS (
    VALUES
        ('main-gate',      'Main Gate',                                'gate',     NULL::varchar, 13.40510::numeric, 123.37360::numeric, 1::integer),
        ('welcome-arch',   'CSPC Welcome Arch',                        'walkway',  NULL,          13.40540,          123.37400,          2),
        ('flagpole',       'Flagpole Quadrangle',                      'walkway',  NULL,          13.40575,          123.37455,          3),
        ('admin-building', 'Administration Building',                  'building', 'Administration Building',           13.40613, 123.37441, 4),
        ('registrar',      'Registrar''s Office',                      'service',  'Administration Building',           13.40613, 123.37441, 5),
        ('ccs',            'College of Computer Studies (CCS)',        'building', 'College of Computer Studies (CCS)', 13.40565, 123.37710, 6),
        ('library',        'Library Building',                         'building', 'Library Building',                  13.40630, 123.37525, 7),
        ('gymnasium',      'Gymnasium',                                'building', 'Gymnasium',                         13.40585, 123.37522, 8),
        ('clinic',         'Medical & Dental Clinic',                  'building', 'Medical & Dental Clinic',           13.40616, 123.37717, 9),
        ('ictu',           'ICT Unit (ICTU)',                          'building', 'Information and Communications Technology Unit (ICTU)', 13.40558, 123.37471, 10),
        ('canteen',        'Canteen / Cafeteria',                      'building', 'Canteen / Cafeteria',               13.40625, 123.37515, 11),
        ('auditorium',     'Auditorium',                               'building', 'Auditorium',                        13.40630, 123.37560, 12),
        ('mid-campus',     'Mid-Campus Road Junction',                 'walkway',  NULL,          13.40561,          123.37561,          13),
        ('east-walk',      'East Corridor Junction',                   'walkway',  NULL,          13.40577,          123.37645,          14),
        ('green-building', 'Green Building',                           'building', 'Green Building',                    13.40600, 123.37652, 15),
        ('cas',            'College of Arts and Sciences',             'building', 'College of Arts and Sciences',      13.40595, 123.37704, 16),
        ('chs',            'College of Health Sciences (CHS)',         'building', 'College of Health Sciences (CHS)',  13.40539, 123.37750, 17),
        ('west-road',      'West Campus Road Junction',                'walkway',  NULL,          13.40540,          123.37367,          18),
        ('main-academic',  'Main Academic Building',                   'building', 'Main Academic Building',            13.40580, 123.37370, 19),
        ('engineering',    'Engineering Building',                     'building', 'Engineering Building',              13.40560, 123.37340, 20)
)
INSERT INTO route_nodes (
    node_key,
    label,
    node_type,
    building_id,
    lat,
    lng,
    location,
    display_order
)
SELECT
    n.node_key,
    n.label,
    n.node_type,
    b.id,
    n.lat,
    n.lng,
    extensions.ST_SetSRID(extensions.ST_MakePoint(n.lng::double precision, n.lat::double precision), 4326)::extensions.geography,
    n.display_order
  FROM n
  LEFT JOIN buildings b ON b.name = n.building_name
ON CONFLICT (node_key) DO UPDATE
    SET label         = EXCLUDED.label,
        node_type     = EXCLUDED.node_type,
        building_id   = EXCLUDED.building_id,
        lat           = EXCLUDED.lat,
        lng           = EXCLUDED.lng,
        location      = EXCLUDED.location,
        display_order = EXCLUDED.display_order,
        updated_at    = now();


-- -----------------------------------------------------------------------------
-- 2. route_edges: full refreshed edge set (26 undirected pairs = 52 directed
--    rows; upsert by (from_node_id, to_node_id))
-- -----------------------------------------------------------------------------
-- Distances are haversine meters between the node coordinates (rounded);
-- walk times assume ~1.2 m/s, matching the original rows.
WITH e(from_key, to_key, distance_meters, walk_time_seconds, path_label) AS (
    VALUES
        -- Kept original connections (distances refreshed to haversine meters
        -- between the node coordinates; the old values were demo estimates
        -- that skewed Dijkstra toward unrealistic detours)
        ('main-gate',      'welcome-arch',    55::integer,  46::integer,  'Main pathway'),
        ('welcome-arch',   'main-gate',       55,           46,           'Main pathway'),
        ('welcome-arch',   'flagpole',        71,           59,           'Main pathway'),
        ('flagpole',       'welcome-arch',    71,           59,           'Main pathway'),
        ('flagpole',       'admin-building',  45,           38,           'Quadrangle to Administration'),
        ('admin-building', 'flagpole',        45,           38,           'Quadrangle to Administration'),
        ('admin-building', 'registrar',       15,           15,           'Ground floor - Registrar'),
        ('registrar',      'admin-building',  15,           15,           'Ground floor - Registrar'),
        ('flagpole',       'library',         97,           81,           'Central pathway to Library'),
        ('library',        'flagpole',        97,           81,           'Central pathway to Library'),
        ('flagpole',       'gymnasium',       73,           61,           'Pathway to Gymnasium'),
        ('gymnasium',      'flagpole',        73,           61,           'Pathway to Gymnasium'),
        ('library',        'gymnasium',       50,           42,           'Facilities walkway'),
        ('gymnasium',      'library',         50,           42,           'Facilities walkway'),
        ('admin-building', 'library',         93,           78,           'Admin to Library walkway'),
        ('library',        'admin-building',  93,           78,           'Admin to Library walkway'),
        -- East academic-complex spine following the OSM-mapped campus
        -- service roads (replaces the retired flagpole->ccs /
        -- flagpole->clinic straight-line shortcuts): the south corridor runs
        -- at ~lat 13.4056 from the ICTU side east to the Green Building,
        -- with junction nodes placed on real road vertices.
        ('flagpole',       'ictu',            26,           22,           'Quadrangle walkway'),
        ('ictu',           'flagpole',        26,           22,           'Quadrangle walkway'),
        ('gymnasium',      'canteen',         45,           38,           'Facilities walkway'),
        ('canteen',        'gymnasium',       45,           38,           'Facilities walkway'),
        ('library',        'canteen',         12,           10,           'Facilities walkway'),
        ('canteen',        'library',         12,           10,           'Facilities walkway'),
        ('library',        'auditorium',      38,           32,           'North campus road'),
        ('auditorium',     'library',         38,           32,           'North campus road'),
        ('ictu',           'mid-campus',      97,           81,           'South campus road'),
        ('mid-campus',     'ictu',            97,           81,           'South campus road'),
        ('gymnasium',      'mid-campus',      50,           42,           'South campus road'),
        ('mid-campus',     'gymnasium',       50,           42,           'South campus road'),
        ('mid-campus',     'auditorium',      77,           64,           'Mid-campus connector road'),
        ('auditorium',     'mid-campus',      77,           64,           'Mid-campus connector road'),
        ('mid-campus',     'east-walk',       93,           78,           'South campus road'),
        ('east-walk',      'mid-campus',      93,           78,           'South campus road'),
        ('east-walk',      'green-building',  27,           23,           'East corridor'),
        ('green-building', 'east-walk',       27,           23,           'East corridor'),
        ('east-walk',      'cas',             67,           56,           'East corridor'),
        ('cas',            'east-walk',       67,           56,           'East corridor'),
        ('green-building', 'cas',             57,           48,           'Academic complex walkway'),
        ('cas',            'green-building',  57,           48,           'Academic complex walkway'),
        ('cas',            'ccs',             34,           28,           'Academic complex walkway'),
        ('ccs',            'cas',             34,           28,           'Academic complex walkway'),
        ('cas',            'clinic',          27,           23,           'Clinic walkway'),
        ('clinic',         'cas',             27,           23,           'Clinic walkway'),
        ('ccs',            'chs',             52,           43,           'East campus walkway'),
        ('chs',            'ccs',             52,           43,           'East campus walkway'),
        -- West campus entrance road (Engineering / Main Academic side);
        -- the west-road junction sits on the mapped entrance-road vertex.
        ('main-gate',      'west-road',       34,           28,           'West campus road'),
        ('west-road',      'main-gate',       34,           28,           'West campus road'),
        ('west-road',      'engineering',     37,           31,           'West campus road'),
        ('engineering',    'west-road',       37,           31,           'West campus road'),
        ('west-road',      'main-academic',   45,           38,           'West campus road'),
        ('main-academic',  'west-road',       45,           38,           'West campus road'),
        ('main-academic',  'flagpole',        92,           77,           'Walkway to Quadrangle'),
        ('flagpole',       'main-academic',   92,           77,           'Walkway to Quadrangle')
)
INSERT INTO route_edges (
    from_node_id,
    to_node_id,
    distance_meters,
    walk_time_seconds,
    path_label,
    is_accessible
)
SELECT
    fn.id,
    tn.id,
    e.distance_meters,
    e.walk_time_seconds,
    e.path_label,
    true
  FROM e
  JOIN route_nodes fn ON fn.node_key = e.from_key
  JOIN route_nodes tn ON tn.node_key = e.to_key
ON CONFLICT (from_node_id, to_node_id) DO UPDATE
    SET distance_meters   = EXCLUDED.distance_meters,
        walk_time_seconds = EXCLUDED.walk_time_seconds,
        path_label        = EXCLUDED.path_label,
        is_accessible     = EXCLUDED.is_accessible;


-- -----------------------------------------------------------------------------
-- 3. Retire the straight-line shortcut edges (both directions)
-- -----------------------------------------------------------------------------
-- flagpole <-> ccs drew a ~220 m line across buildings/grass; flagpole <->
-- clinic would become an even longer diagonal now that the clinic node maps
-- to the real east-side building. Idempotent: absent pairs delete 0 rows.
DELETE FROM route_edges e
 USING route_nodes a, route_nodes b
 WHERE ((e.from_node_id = a.id AND e.to_node_id = b.id)
     OR (e.from_node_id = b.id AND e.to_node_id = a.id))
   AND a.node_key = 'flagpole'
   AND b.node_key IN ('ccs', 'clinic');

-- Also retire the interim mid-campus <-> green-building pair (an
-- intermediate iteration of this repair, superseded by the OSM-aligned
-- mid-campus -> east-walk -> green-building corridor). Absent pairs
-- delete 0 rows, so this is a no-op on databases that never had it.
DELETE FROM route_edges e
 USING route_nodes a, route_nodes b
 WHERE ((e.from_node_id = a.id AND e.to_node_id = b.id)
     OR (e.from_node_id = b.id AND e.to_node_id = a.id))
   AND a.node_key = 'mid-campus'
   AND b.node_key = 'green-building';
