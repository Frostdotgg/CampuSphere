-- =============================================================================
-- CampuSphere - Supabase Migration 0004: Building Backfill
-- Milestone 3 - Building Seed Reconciliation Fix
-- =============================================================================
--
-- Purpose
--   The canonical seed in 0002_seed_data.sql carries 6 route/VR-ready demo
--   buildings. Live MySQL had 6 additional REAL campus buildings that were
--   added through the admin building form after that seed was authored. This
--   migration backfills those 6 real buildings into Supabase so that switching
--   /buildings and /map to Supabase (Milestone 3, Section 3.5+) does not drop
--   real campus buildings. After 0002 + 0004, Supabase has 12 buildings.
--
--   The junk/test row 'CR ni Aaron' that also existed in live MySQL is
--   intentionally NOT promoted.
--
-- Source of truth
--   Values mirror the matching rows now present in models/data.js (ids 7-12)
--   and database/seed.js. These buildings carry sparse details (image only),
--   which is faithful to how they were created through the admin form:
--     details = {"img": "/img/Camarines-sur-polytechnic-colleges.png"}
--   - image_url: the same placeholder path (matches 0002's convention).
--   - cloudinary_public_id: NULL (Cloudinary migration is out of scope).
--   - location: extensions.geography(Point, 4326), built from
--     extensions.ST_SetSRID(extensions.ST_MakePoint(lng, lat), 4326)::extensions.geography.
--     PostGIS functions are schema-qualified to match the qualified type so this
--     migration does not depend on `extensions` being in search_path. Note the
--     (lng, lat) argument order: PostGIS ST_MakePoint takes longitude first.
--
-- Idempotency: UPSERT-BY-NAME, identical to 0002. The CTE `bld` lists the 6
--   backfilled rows. `upd` UPDATEs an existing row whose name matches and
--   RETURNs the matched names; the final INSERT writes a new row only when no
--   row with that name existed. buildings.id therefore never changes across
--   re-runs, so existing route/VR references remain valid.
--
-- Prerequisite: apply AFTER 0001_initial_schema.sql and 0002_seed_data.sql.
-- =============================================================================

WITH bld(name, category, description, lat, lng, details, image_url) AS (
    VALUES
        (
            'Canteen / Cafeteria',
            'Facilities',
            'The main campus dining facility offering affordable meals.',
            13.40625,
            123.37515,
            $BLDDETAILS${"img": "/img/Camarines-sur-polytechnic-colleges.png"}$BLDDETAILS$::jsonb,
            '/img/Camarines-sur-polytechnic-colleges.png'
        ),
        (
            'College of Health Sciences (CHS)',
            'Academic',
            'Houses the Bachelor of Science in Nursing and other health-related programs.',
            13.40539,
            123.37750,
            $BLDDETAILS${"img": "/img/Camarines-sur-polytechnic-colleges.png"}$BLDDETAILS$::jsonb,
            '/img/Camarines-sur-polytechnic-colleges.png'
        ),
        (
            'Green Building',
            'Academic',
            'Dedicated to engineering programs with drawing rooms, workshops, and labs.',
            13.40600,
            123.37652,
            $BLDDETAILS${"img": "/img/Camarines-sur-polytechnic-colleges.png"}$BLDDETAILS$::jsonb,
            '/img/Camarines-sur-polytechnic-colleges.png'
        ),
        (
            'Information and Communications Technology Unit (ICTU)',
            'Administrative',
            'Administers the technical and systems development of institutional processes involving information systems, network, technical services, and web development.',
            13.40558,
            123.37471,
            $BLDDETAILS${"img": "/img/Camarines-sur-polytechnic-colleges.png"}$BLDDETAILS$::jsonb,
            '/img/Camarines-sur-polytechnic-colleges.png'
        ),
        (
            'Medical & Dental Clinic',
            'Facilities',
            'Provides basic health and dental services to students.',
            13.40616,
            123.37717,
            $BLDDETAILS${"img": "/img/Camarines-sur-polytechnic-colleges.png"}$BLDDETAILS$::jsonb,
            '/img/Camarines-sur-polytechnic-colleges.png'
        ),
        (
            'Auditorium',
            'Facilities',
            'Large venue for public events, seminars, and ceremonies.',
            13.40630,
            123.37560,
            $BLDDETAILS${"img": "/img/Camarines-sur-polytechnic-colleges.png"}$BLDDETAILS$::jsonb,
            '/img/Camarines-sur-polytechnic-colleges.png'
        )
),
upd AS (
    UPDATE buildings b
       SET category    = s.category,
           description = s.description,
           lat         = s.lat,
           lng         = s.lng,
           details     = s.details,
           image_url   = s.image_url,
           location    = extensions.ST_SetSRID(extensions.ST_MakePoint(s.lng::double precision, s.lat::double precision), 4326)::extensions.geography,
           updated_at  = now()
      FROM bld s
     WHERE b.name = s.name
    RETURNING b.name
)
INSERT INTO buildings (
    name,
    category,
    description,
    lat,
    lng,
    details,
    image_url,
    cloudinary_public_id,
    location
)
SELECT
    s.name,
    s.category,
    s.description,
    s.lat,
    s.lng,
    s.details,
    s.image_url,
    NULL,
    extensions.ST_SetSRID(extensions.ST_MakePoint(s.lng::double precision, s.lat::double precision), 4326)::extensions.geography
  FROM bld s
 WHERE NOT EXISTS (SELECT 1 FROM upd u WHERE u.name = s.name);
