-- =============================================================================
-- CampuSphere Supabase seed data
-- File: database/supabase/0002_seed_data.sql
-- Milestone 1, Phase 3, Section 3.2
-- =============================================================================
--
-- Scope (this file, this section)
--   Auth and profile seed data only. Populates:
--     - users
--     - student_profiles
--     - instructor_profiles
--     - guest_profiles
--
--   Sections 3.3 and 3.4 will add the remaining seed groups by appending
--   to this same file (or by adding a follow-up numbered seed file,
--   decided in 3.3):
--     3.3 - news_announcements, events, faqs, system_settings,
--           team_members, buildings
--     3.4 - campus_routes, campus_route_steps, route_nodes,
--           route_edges, vr_scenes, vr_hotspots
--
-- Approach
--   SQL-first seed file (see database/supabase/SEED_STRATEGY.md).
--   - Plain SQL only. No Supabase client script.
--   - No SUPABASE_SERVICE_ROLE_KEY handling in this file.
--   - No pgcrypto / crypt() password generation inside the SQL.
--   - bcrypt hashes were pre-computed locally with the project's own
--     bcrypt dependency at rounds = 10 (matching database/seed.js) and
--     pasted in as string literals.
--
-- Idempotency
--   - users:               ON CONFLICT (email) DO NOTHING
--                          (email is UNIQUE in 0001_initial_schema.sql)
--   - student_profiles:    ON CONFLICT (user_id) DO NOTHING
--   - instructor_profiles: ON CONFLICT (user_id) DO NOTHING
--   - guest_profiles:      ON CONFLICT (user_id) DO NOTHING
--   The schema's only UNIQUE constraint on each profile table is
--   UNIQUE(user_id) (the 1:1 link to users). student_id_number and
--   employee_id are NOT unique in 0001_initial_schema.sql, so
--   user_id is the only safe conflict target for profiles here.
--   Schema changes are out of scope for Section 3.2.
--
-- Auth model for these rows
--   All four rows below are LOCAL login accounts:
--     oauth_provider = 'local'
--     oauth_subject  = NULL
--   No Google OAuth rows are seeded here. Google accounts are created
--   at runtime through the existing Express OAuth flow in
--   controllers/authController.js. No Supabase Auth is used.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- users
-- -----------------------------------------------------------------------------
-- admin@cspc.edu.ph and aaron.lasprillas@cspc.edu.ph mirror the two demo
-- accounts that database/seed.js currently creates for MySQL.
--
-- instructor.demo@cspc.edu.ph and guest.demo@gmail.com are NEW
-- Supabase-only demo seed rows added here for final-defense coverage of
-- the 'instructor' and 'guest' roles. They are NOT shipped by the
-- current database/seed.js -- they exist only in this Supabase seed.
--
-- The four demo plaintext passwords are intentionally NOT listed
-- here. The bcrypt(10) hashes below correspond to the documented
-- sample-account credentials in HANDOFF.md section 6 ("Known
-- sample accounts") and AGENTS.md "Common Commands". Only the
-- hashes are written to the database; never paste cleartext
-- passwords into committed SQL files.
INSERT INTO users (
    username,
    email,
    password,
    role,
    first_name,
    last_name,
    profile_image_url,
    oauth_provider,
    oauth_subject
) VALUES
    (
        'admin',
        'admin@cspc.edu.ph',
        '$2b$10$4qO4gAeLn1Vzxd57EzyJuefmye8plQPoivnamBbZh/E9PfBa544SC',
        'admin',
        'System',
        'Admin',
        NULL,
        'local',
        NULL
    ),
    (
        'aaron.lasprillas',
        'aaron.lasprillas@cspc.edu.ph',
        '$2b$10$Wzoo1w.EO.je2MSQ6V32MuspGC9/rLRZS6ao.W7sAp.O5ZVw1FgRC',
        'student-cspc',
        'Aaron',
        'Lasprillas',
        NULL,
        'local',
        NULL
    ),
    (
        'instructor.demo',
        'instructor.demo@cspc.edu.ph',
        '$2b$10$3Tn3je70P9BUGnM1cX77HOELXlGVpb7c0dPfNGQEcNvS98tR8bln.',
        'instructor',
        'Demo',
        'Instructor',
        NULL,
        'local',
        NULL
    ),
    (
        'guest.demo',
        'guest.demo@gmail.com',
        '$2b$10$0Ci2/7nNy.lMp.jNBCd8aO8I/CnaHV8smWIkj/7Dcx4jAECJv.3j6',
        'guest',
        'Demo',
        'Guest',
        NULL,
        'local',
        NULL
    )
ON CONFLICT (email) DO NOTHING;


-- -----------------------------------------------------------------------------
-- student_profiles -- aaron.lasprillas@cspc.edu.ph
-- -----------------------------------------------------------------------------
-- Values pulled from models/data.js (student profile block):
--   studentId        -> student_id_number = 'CSPC-2024-001234'
--   course           -> 'BS Information Technology'
--   yearLevel        -> '3rd Year'
--   enrollmentStatus -> 'Enrolled'
--   semester         -> '2nd Semester, A.Y. 2025-2026'
--
-- Parent user is looked up by email rather than a hardcoded id so the
-- seed remains correct regardless of identity sequence values on the
-- target Supabase project.
INSERT INTO student_profiles (
    user_id,
    student_id_number,
    course,
    year_level,
    enrollment_status,
    semester
)
SELECT
    u.id,
    'CSPC-2024-001234',
    'BS Information Technology',
    '3rd Year',
    'Enrolled',
    '2nd Semester, A.Y. 2025-2026'
FROM users u
WHERE u.email = 'aaron.lasprillas@cspc.edu.ph'
ON CONFLICT (user_id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- instructor_profiles -- instructor.demo@cspc.edu.ph
-- -----------------------------------------------------------------------------
-- Supabase-only demo row. Simple CSPC-appropriate values chosen for
-- defense coverage of the 'instructor' role; not shipped by the
-- current database/seed.js.
INSERT INTO instructor_profiles (
    user_id,
    employee_id,
    department,
    position,
    status
)
SELECT
    u.id,
    'CSPC-EMP-DEMO-001',
    'College of Computer Studies',
    'Instructor I',
    'Active'
FROM users u
WHERE u.email = 'instructor.demo@cspc.edu.ph'
ON CONFLICT (user_id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- guest_profiles -- guest.demo@gmail.com
-- -----------------------------------------------------------------------------
-- Supabase-only demo row. Simple demo address + phone for defense
-- coverage of the 'guest' role; not shipped by the current
-- database/seed.js.
INSERT INTO guest_profiles (
    user_id,
    address,
    phone_number
)
SELECT
    u.id,
    'Naga City, Camarines Sur, Philippines',
    '09000000000'
FROM users u
WHERE u.email = 'guest.demo@gmail.com'
ON CONFLICT (user_id) DO NOTHING;


-- =============================================================================
-- Milestone 1, Phase 3, Section 3.3 - Content, Settings, And Building Seed Data
-- =============================================================================
--
-- Scope (this section, appended below the Section 3.2 auth/profile rows above)
--   Populates the content + settings + buildings layer:
--     - system_settings
--     - news_announcements
--     - events
--     - faqs (no rows seeded; see note below)
--     - team_members
--     - buildings (including PostGIS location)
--
--   Section 3.4 will later append seed data for:
--     - campus_routes, campus_route_steps
--     - route_nodes, route_edges
--     - vr_scenes, vr_hotspots
--   No 3.4 rows are written here.
--
-- Source of truth
--   Values mirror database/seed.js and models/data.js (the current MySQL
--   seed). Those files are NOT modified by this section.
--
-- Idempotency strategy
--   The schema in 0001_initial_schema.sql gives only system_settings a usable
--   natural-key UNIQUE/PRIMARY KEY (setting_key). For the other tables in
--   this section, no UNIQUE constraint exists on a natural key. To stay
--   idempotent without editing 0001, this section uses scoped DELETE +
--   INSERT, restricted to the exact identifier list seeded immediately
--   below it. That way it can never remove rows that an admin added later
--   or rows produced by Section 3.2 or Section 3.4.
--
--   buildings is an exception. buildings.id is referenced by Section 3.4
--   tables (campus_routes.destination_building_id and route_nodes.building_id
--   with ON DELETE CASCADE / SET NULL, plus vr_scenes.building_id with
--   ON DELETE SET NULL), so a DELETE on buildings would cascade-remove or
--   unlink those Section 3.4 rows on every re-seed. To prevent that,
--   buildings uses an UPSERT-by-name pattern (UPDATE first, INSERT only
--   when no row with that name exists). buildings.id is therefore stable
--   across re-seeds.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- system_settings
-- -----------------------------------------------------------------------------
-- Mirrors database/seed.js -> 'Seeding System Settings'. setting_key is the
-- table PRIMARY KEY, so ON CONFLICT (setting_key) DO UPDATE is the natural
-- idempotent path: re-running refreshes setting_value while leaving any
-- non-seeded keys an admin may add through the UI untouched.
INSERT INTO system_settings (setting_key, setting_value) VALUES
    ('school_name',        'Camarines Sur Polytechnic Colleges'),
    ('school_acronym',     'CSPC'),
    ('school_address',     'Nabua, Camarines Sur, Philippines'),
    ('school_founded',     '2026'),
    ('school_description', 'Camarines Sur Polytechnic Colleges is a state-funded institution of higher learning in Nabua, Camarines Sur providing quality education in engineering, technology, and other disciplines.'),
    ('contact_address',    'San Miguel, Nabua, Camarines Sur 4434'),
    ('contact_phone',      '(054) 473-1234'),
    ('contact_email',      'info@cspc.edu.ph'),
    ('contact_website',    'www.cspc.edu.ph'),
    ('contact_hours',      'Monday - Friday, 8:00 AM - 5:00 PM')
ON CONFLICT (setting_key) DO UPDATE
    SET setting_value = EXCLUDED.setting_value;


-- -----------------------------------------------------------------------------
-- news_announcements
-- -----------------------------------------------------------------------------
-- Combines two sources from database/seed.js:
--   (a) models/data.js news[] -- 4 audience='all' announcements; the MySQL
--       seed inserts these via the 'Seeding News/Announcements' block.
--   (b) targetedAnnouncements -- 4 role-targeted announcements (Milestone 4
--       audience targeting). Audience values stay within the CHECK
--       constraint on news_announcements.audience: 'all', 'student-cspc',
--       'instructor', 'guest'. 'admin' is allowed by the constraint but is
--       not used here, matching the MySQL seed.
--
-- The MySQL seed sets content = excerpt; preserved here.
-- published_date is rendered as an ISO date literal cast to timestamptz so
-- ordering by published_date DESC stays well-defined regardless of the
-- session timezone.
-- author_id stays NULL: the MySQL seed inserts the same way; the column
-- already has ON DELETE SET NULL, so admin attribution can be backfilled
-- later without breaking anything.
--
-- Idempotency: scoped DELETE by the exact seeded title list, then INSERT.
-- Admin-created announcements with other titles are never touched.
DELETE FROM news_announcements
 WHERE title IN (
    'Enrollment for 2nd Semester Now Open',
    'CSPC Foundation Day Celebration',
    'New CCS Building Facilities',
    'Scholarship Application Deadline',
    'Faculty General Assembly - Curriculum Review',
    'Faculty Development Workshop: Outcomes-Based Teaching',
    'Student Organization Accreditation Renewal',
    'Campus Visitor Guidelines for Guests'
 );

INSERT INTO news_announcements (
    title,
    category,
    audience,
    excerpt,
    content,
    author_id,
    published_date
) VALUES
    (
        'Enrollment for 2nd Semester Now Open',
        'Academic',
        'all',
        'Online enrollment for the second semester of A.Y. 2025-2026 is now open.',
        'Online enrollment for the second semester of A.Y. 2025-2026 is now open.',
        NULL,
        '2026-03-05'::timestamptz
    ),
    (
        'CSPC Foundation Day Celebration',
        'Events',
        'all',
        'Join us in celebrating the 43rd Foundation Anniversary of CSPC.',
        'Join us in celebrating the 43rd Foundation Anniversary of CSPC.',
        NULL,
        '2026-03-12'::timestamptz
    ),
    (
        'New CCS Building Facilities',
        'Facilities',
        'all',
        'The College of Computer Studies now has upgraded computer laboratories.',
        'The College of Computer Studies now has upgraded computer laboratories.',
        NULL,
        '2026-03-08'::timestamptz
    ),
    (
        'Scholarship Application Deadline',
        'Academic',
        'all',
        'Deadline for scholarship applications for the upcoming semester.',
        'Deadline for scholarship applications for the upcoming semester.',
        NULL,
        '2026-03-15'::timestamptz
    ),
    (
        'Faculty General Assembly - Curriculum Review',
        'Advisory',
        'instructor',
        'All instructors are requested to attend the General Assembly for the semester curriculum review and updated academic policies.',
        'All instructors are requested to attend the General Assembly for the semester curriculum review and updated academic policies.',
        NULL,
        '2026-05-05'::timestamptz
    ),
    (
        'Faculty Development Workshop: Outcomes-Based Teaching',
        'Academic',
        'instructor',
        'A workshop on outcomes-based teaching strategies will be held at the SAC Conference Room. Slots are limited, please confirm attendance early.',
        'A workshop on outcomes-based teaching strategies will be held at the SAC Conference Room. Slots are limited, please confirm attendance early.',
        NULL,
        '2026-05-12'::timestamptz
    ),
    (
        'Student Organization Accreditation Renewal',
        'Advisory',
        'student-cspc',
        'Recognized student organizations must renew their accreditation at the Office of Student Affairs before the posted deadline.',
        'Recognized student organizations must renew their accreditation at the Office of Student Affairs before the posted deadline.',
        NULL,
        '2026-05-08'::timestamptz
    ),
    (
        'Campus Visitor Guidelines for Guests',
        'General',
        'guest',
        'Visitors and guests must present a valid ID at the Main Gate and secure a visitor pass from the guard on duty.',
        'Visitors and guests must present a valid ID at the Main Gate and secure a visitor pass from the guard on duty.',
        NULL,
        '2026-05-03'::timestamptz
    );


-- -----------------------------------------------------------------------------
-- events
-- -----------------------------------------------------------------------------
-- Mirrors the 5 rows in database/seed.js -> eventsData. event_date stays as
-- DATE (no timezone). event_time is preserved as free text to match the
-- MySQL VARCHAR(100) column and current admin/event UI.
--
-- Idempotency: scoped DELETE by (title, event_date), then INSERT. Both
-- fields are required by the delete predicate, so an admin-created event
-- sharing only a title (or only a date) with a seeded row is safe.
DELETE FROM events
 WHERE (title, event_date) IN (
    ('Annual Research Symposium',       DATE '2026-03-25'),
    ('Inter-College Basketball Finals', DATE '2026-04-02'),
    ('CSPC Arts & Music Fest 2026',     DATE '2026-04-10'),
    ('Tech Talk: AI in Engineering',    DATE '2026-04-15'),
    ('Intramurals Opening Ceremony',    DATE '2026-05-01')
 );

INSERT INTO events (
    title,
    category,
    event_date,
    description,
    location,
    event_time
) VALUES
    (
        'Annual Research Symposium',
        'Academic',
        DATE '2026-03-25',
        'Join us for the annual gathering of minds where graduating students present their final year projects. Keynote by Dr. Aris B. Santos.',
        'Main Function Hall, Academic Bldg',
        '8:00 AM - 4:00 PM'
    ),
    (
        'Inter-College Basketball Finals',
        'Sports',
        DATE '2026-04-02',
        'The climax of the sports fest! Come and support the Engineering vs. Business teams as they battle it out for the championship.',
        'CSPC Gymnasium',
        '3:00 PM - 6:00 PM'
    ),
    (
        'CSPC Arts & Music Fest 2026',
        'Cultural',
        DATE '2026-04-10',
        'A vibrant celebration of campus talent featuring live bands, theater performances, and an open gallery of student artwork.',
        'Campus Quadrangle / Grandstand',
        '5:00 PM onwards'
    ),
    (
        'Tech Talk: AI in Engineering',
        'Academic',
        DATE '2026-04-15',
        'An interactive seminar discussing the latest trends in artificial intelligence and its applications in civil and mechanical engineering.',
        'Room 201, Engineering Bldg',
        '1:00 PM - 3:30 PM'
    ),
    (
        'Intramurals Opening Ceremony',
        'Sports',
        DATE '2026-05-01',
        'The grand opening of the 2026 Intramurals. Cheer dance competitions, parade of athletes, and the lighting of the torch.',
        'CSPC Track & Field Oval',
        '7:00 AM - 12:00 NN'
    );


-- -----------------------------------------------------------------------------
-- faqs
-- -----------------------------------------------------------------------------
-- The current MySQL seed (database/seed.js) does NOT seed any FAQ rows, and
-- models/data.js has no `faqs` block. To match the MySQL baseline exactly,
-- no rows are inserted here -- Section 3.3 leaves the faqs table empty.
-- When the project decides on its initial FAQ content, append it here using
-- the same scoped DELETE-by-question + INSERT pattern other 3.3 tables use.


-- -----------------------------------------------------------------------------
-- team_members
-- -----------------------------------------------------------------------------
-- Mirrors database/seed.js -> 'Seeding Team Members' (3 rows). image_url
-- paths are kept verbatim from the MySQL seed; not all of those files exist
-- in public/img yet (see HANDOFF.md section 7), and the About page already
-- tolerates missing image files. Cloudinary migration is out of Milestone 1
-- scope.
--
-- Idempotency: scoped DELETE by the exact seeded name list, then INSERT.
DELETE FROM team_members
 WHERE name IN ('Paga', 'DIlamitas', 'MAAT');

INSERT INTO team_members (
    name,
    role,
    image_url,
    display_order
) VALUES
    ('Paga',      'UI/UX Designer', '/img/Paga.jpg',      1),
    ('DIlamitas', 'Documenter',     '/img/Dilamitas.jpg', 2),
    ('MAAT',      'Documenter',     '/img/maat.jpg',      3);


-- -----------------------------------------------------------------------------
-- buildings
-- -----------------------------------------------------------------------------
-- Mirrors the 6 rows defined in models/data.js (and inserted by
-- database/seed.js). Each row populates:
--   - name, category, description (sourced from `desc`)
--   - lat / lng (kept verbatim; current Leaflet UI reads them directly)
--   - details: jsonb object with keys guestAccess, img, routes, walkTime,
--     landmarks, floors, entrances, info -- the same shape that
--     database/seed.js currently writes as JSON.stringify(details).
--     Dollar-quoted JSON literals are used so the JSON content can contain
--     unescaped apostrophes (e.g., "Dean's Office") without SQL-level
--     escaping. Each literal is cast to jsonb so PostgreSQL validates JSON
--     at apply time.
--   - image_url: populated from each building's `img` (which is the same
--     value stored inside details.img). The two intentionally hold the
--     same path for now; a later Cloudinary migration will replace
--     details.img usage with image_url + cloudinary_public_id.
--   - cloudinary_public_id: NULL (Cloudinary migration is out of scope).
--   - location: extensions.geography(Point, 4326), built from
--     extensions.ST_SetSRID(extensions.ST_MakePoint(lng, lat), 4326)::extensions.geography.
--     PostGIS functions are schema-qualified to match the qualified type
--     so this seed does not depend on `extensions` being in search_path.
--     Note the (lng, lat) argument order: PostGIS ST_MakePoint takes
--     longitude first.
--
-- Idempotency: UPSERT-BY-NAME. The CTE `bld` lists the 6 seeded rows.
-- `upd` UPDATEs an existing row whose name matches and RETURNs the matched
-- names; the final INSERT writes a new row only when no row with that name
-- existed. buildings.id therefore never changes across re-seeds, so
-- Section 3.4 references (campus_routes.destination_building_id,
-- route_nodes.building_id, vr_scenes.building_id) remain valid.
WITH bld(name, category, description, lat, lng, details, image_url) AS (
    VALUES
        (
            'College of Computer Studies (CCS)',
            'Academic',
            'Home of the BSIT and BSCS programs, with computer labs and faculty offices.',
            13.40565,
            123.37710,
            $BLDDETAILS$
{
  "guestAccess": false,
  "img": "/img/Camarines-sur-polytechnic-colleges.png",
  "routes": [],
  "walkTime": "6-8 minutes from Main Gate",
  "landmarks": [
    "Beside the Main Academic Building",
    "Across from the campus canteen",
    "Near the Flagpole Quadrangle"
  ],
  "floors": [
    {
      "label": "Ground Floor",
      "rooms": [
        {"room": "GF-101", "name": "Programming Lab 1", "use": "Computer Lab"},
        {"room": "GF-102", "name": "Programming Lab 2", "use": "Computer Lab"},
        {"room": "GF-103", "name": "Networking Lab", "use": "Computer Lab"},
        {"room": "GF-104", "name": "Lecture Room", "use": "Classroom"}
      ]
    },
    {
      "label": "2nd Floor",
      "rooms": [
        {"room": "201", "name": "Dean's Office", "use": "Administrative"},
        {"room": "202", "name": "IT Faculty Room", "use": "Faculty"},
        {"room": "203", "name": "Multimedia Lab", "use": "Computer Lab"},
        {"room": "204", "name": "Lecture Hall", "use": "Classroom"}
      ]
    }
  ],
  "entrances": [
    "Main entrance (front, facing the quadrangle)",
    "Side entrance (left of building)",
    "Rear emergency exit"
  ],
  "info": [
    {"office": "Dean of CCS", "floor": "2nd Floor"},
    {"office": "IT Faculty Room", "floor": "2nd Floor"},
    {"office": "Programming Laboratory", "floor": "Ground Floor"},
    "Wi-Fi available throughout the building",
    "Student lounge near the rear staircase"
  ]
}
$BLDDETAILS$::jsonb,
            '/img/Camarines-sur-polytechnic-colleges.png'
        ),
        (
            'Main Academic Building',
            'Academic',
            'Central academic hub with general-education classrooms and faculty offices.',
            13.4058,
            123.3737,
            $BLDDETAILS$
{
  "guestAccess": false,
  "img": "/img/Camarines-sur-polytechnic-colleges.png",
  "routes": [],
  "walkTime": "4-6 minutes from Main Gate",
  "landmarks": [
    "Central campus pathway",
    "Adjacent to the CCS Building",
    "Near the Administration Building"
  ],
  "floors": [
    {
      "label": "1st Floor",
      "rooms": [
        {"room": "101", "name": "Lecture Hall A", "use": "Classroom"},
        {"room": "102", "name": "GE Department Office", "use": "Administrative"},
        {"room": "103", "name": "Classroom", "use": "Classroom"}
      ]
    },
    {
      "label": "2nd Floor",
      "rooms": [
        {"room": "201", "name": "Faculty Lounge", "use": "Faculty"},
        {"room": "202", "name": "Classroom", "use": "Classroom"},
        {"room": "203", "name": "Classroom", "use": "Classroom"}
      ]
    },
    {
      "label": "3rd Floor",
      "rooms": [
        {"room": "301", "name": "Lecture Hall B", "use": "Classroom"},
        {"room": "302", "name": "Seminar Room", "use": "Meeting"}
      ]
    }
  ],
  "entrances": [
    "Front entrance (quadrangle side)",
    "Side entrance (next to the bulletin board)"
  ],
  "info": [
    {"office": "General Education Department", "floor": "1st Floor"},
    {"office": "Faculty Lounge", "floor": "2nd Floor"},
    "Lecture halls on every floor",
    "Public restrooms each floor"
  ]
}
$BLDDETAILS$::jsonb,
            '/img/Camarines-sur-polytechnic-colleges.png'
        ),
        (
            'Engineering Building',
            'Academic',
            'Houses Civil, Mechanical, and Electronics Engineering programs with labs and workshops.',
            13.4056,
            123.3734,
            $BLDDETAILS$
{
  "guestAccess": false,
  "img": "/img/Camarines-sur-polytechnic-colleges.png",
  "routes": [],
  "walkTime": "7-9 minutes from Main Gate",
  "landmarks": [
    "Near the campus motor pool",
    "Adjacent to the parking area",
    "Across from the Gymnasium"
  ],
  "floors": [
    {
      "label": "Ground Floor",
      "rooms": [
        {"room": "EG-01", "name": "Civil Engineering Workshop", "use": "Workshop"},
        {"room": "EG-02", "name": "Materials Testing Lab", "use": "Laboratory"},
        {"room": "EG-03", "name": "Lecture Room", "use": "Classroom"}
      ]
    },
    {
      "label": "2nd Floor",
      "rooms": [
        {"room": "E-201", "name": "Dean's Office", "use": "Administrative"},
        {"room": "E-202", "name": "Electronics Lab", "use": "Laboratory"},
        {"room": "E-203", "name": "Lecture Hall", "use": "Classroom"}
      ]
    }
  ],
  "entrances": [
    "Main entrance (front)",
    "Workshop bay entrance (rear)",
    "Emergency exit (side)"
  ],
  "info": [
    {"office": "Dean of Engineering", "floor": "2nd Floor"},
    {"office": "Civil Engineering Workshop", "floor": "Ground Floor"},
    {"office": "Electronics Lab", "floor": "2nd Floor"},
    "Heavy-equipment storage at the rear yard"
  ]
}
$BLDDETAILS$::jsonb,
            '/img/Camarines-sur-polytechnic-colleges.png'
        ),
        (
            'Administration Building',
            'Administrative',
            'Central administrative headquarters housing the Registrar, Cashier, and Office of the President.',
            13.40613,
            123.37441,
            $BLDDETAILS$
{
  "guestAccess": true,
  "img": "/img/Camarines-sur-polytechnic-colleges.png",
  "routes": [],
  "walkTime": "5-7 minutes from Main Gate",
  "landmarks": [
    "Across from the Flagpole Quadrangle",
    "Near the central bulletin board",
    "Adjacent to the Library Building"
  ],
  "floors": [
    {
      "label": "Ground Floor",
      "rooms": [
        {"room": "A-101", "name": "Registrar's Office", "use": "Student Services"},
        {"room": "A-102", "name": "Cashier", "use": "Payments"},
        {"room": "A-103", "name": "Admissions Office", "use": "Student Services"},
        {"room": "A-104", "name": "Information Desk", "use": "Reception"}
      ]
    },
    {
      "label": "2nd Floor",
      "rooms": [
        {"room": "A-201", "name": "Office of the President", "use": "Executive"},
        {"room": "A-202", "name": "VP for Academic Affairs", "use": "Executive"},
        {"room": "A-203", "name": "Human Resources", "use": "Administrative"},
        {"room": "A-204", "name": "Conference Room", "use": "Meeting"}
      ]
    }
  ],
  "entrances": [
    "Main lobby entrance (front)",
    "Side entrance (Registrar queue line)",
    "Staff-only entrance (rear)"
  ],
  "info": [
    {"office": "Registrar's Office", "floor": "Ground Floor"},
    {"office": "Cashier", "floor": "Ground Floor"},
    {"office": "Admissions Office", "floor": "Ground Floor"},
    {"office": "Office of the President", "floor": "2nd Floor"},
    {"office": "VP for Academic Affairs", "floor": "2nd Floor"},
    {"office": "Human Resources", "floor": "2nd Floor"},
    "Public-facing service counters on the ground floor"
  ]
}
$BLDDETAILS$::jsonb,
            '/img/Camarines-sur-polytechnic-colleges.png'
        ),
        (
            'Library Building',
            'Facilities',
            'Academic library with reading rooms, OPAC stations, and reference collections.',
            13.40630,
            123.37525,
            $BLDDETAILS$
{
  "guestAccess": true,
  "img": "/img/Camarines-sur-polytechnic-colleges.png",
  "routes": [],
  "walkTime": "5-7 minutes from Main Gate",
  "landmarks": [
    "Adjacent to the Administration Building",
    "Near the central pathway split",
    "Facing the Flagpole Quadrangle"
  ],
  "floors": [
    {
      "label": "Ground Floor",
      "rooms": [
        {"room": "L-101", "name": "Information Desk", "use": "Reception"},
        {"room": "L-102", "name": "Reference Section", "use": "Reading Room"},
        {"room": "L-103", "name": "Circulation Section", "use": "Book Loans"},
        {"room": "L-104", "name": "OPAC Workstations", "use": "Computer Access"}
      ]
    },
    {
      "label": "2nd Floor",
      "rooms": [
        {"room": "L-201", "name": "Periodicals Section", "use": "Reading Room"},
        {"room": "L-202", "name": "Thesis & Special Collections", "use": "Archive"},
        {"room": "L-203", "name": "Quiet Study Room", "use": "Reading Room"}
      ]
    }
  ],
  "entrances": [
    "Main entrance (security check)",
    "Emergency exit (rear)"
  ],
  "info": [
    {"office": "Library Information Desk", "floor": "Ground Floor"},
    {"office": "Reference Section", "floor": "Ground Floor"},
    {"office": "Periodicals & Thesis Section", "floor": "2nd Floor"},
    "Quiet-study areas on the 2nd floor",
    "Open Mon-Fri 8:00 AM - 5:00 PM"
  ]
}
$BLDDETAILS$::jsonb,
            '/img/Camarines-sur-polytechnic-colleges.png'
        ),
        (
            'Gymnasium',
            'Facilities',
            'Multi-purpose gymnasium hosting sports events, assemblies, and large gatherings.',
            13.40585,
            123.37522,
            $BLDDETAILS$
{
  "guestAccess": true,
  "img": "/img/Camarines-sur-polytechnic-colleges.png",
  "routes": [],
  "walkTime": "7-10 minutes from Main Gate",
  "landmarks": [
    "At the end of the main pathway",
    "Across from the Engineering Building",
    "Near the track and field oval"
  ],
  "floors": [
    {
      "label": "Ground Floor",
      "rooms": [
        {"room": "G-01", "name": "Main Court", "use": "Sports / Events"},
        {"room": "G-02", "name": "Sports Office", "use": "Administrative"},
        {"room": "G-03", "name": "Equipment Storage", "use": "Storage"},
        {"room": "G-04", "name": "Locker Rooms", "use": "Athlete Facilities"}
      ]
    }
  ],
  "entrances": [
    "Main double-door entrance (front)",
    "Side entrance (athlete entry)",
    "Emergency exits (rear and sides)"
  ],
  "info": [
    {"office": "Sports Office", "floor": "Ground Floor"},
    {"office": "Equipment Room", "floor": "Ground Floor"},
    "Basketball / volleyball courts",
    "Bleacher seating on both sides",
    "Open courts for intramurals and ceremonies"
  ]
}
$BLDDETAILS$::jsonb,
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


-- =============================================================================
-- Milestone 1, Phase 3, Section 3.4 - Routes, Graph, And VR Seed Data
-- =============================================================================
--
-- Scope (this section, appended below the Section 3.3 content above)
--   Populates the route / graph / VR layer:
--     - campus_routes
--     - campus_route_steps
--     - route_nodes (with PostGIS location)
--     - route_edges (directed rows: each undirected walkable connection
--       is stored as TWO rows so utils/pathfinding.js treats route_edges
--       as a plain directed graph and never auto-reverses an edge)
--     - vr_scenes (cloudinary_public_id intentionally NULL)
--     - vr_hotspots
--
-- Source of truth
--   Values mirror database/seed.js (routeDefinitions, routeNodes, edgeDefs,
--   vrScenes, vrNavPairs, and the upsertMarkerHotspot calls for the
--   info/exit hotspots) and utils/pathfinding.js. controllers/vrController.js,
--   views/vr.ejs, and views/vr-route.ejs were consulted only to confirm
--   the expected graph + scene + hotspot shape; no runtime files are
--   modified by this section.
--
-- Counts produced
--   - campus_routes:       4   rows
--   - campus_route_steps: 16   rows (4 routes x 4 steps)
--   - route_nodes:         9   rows
--   - route_edges:        20   rows (10 undirected pairs x 2 directed rows)
--   - vr_scenes:           6   rows
--   - vr_hotspots:        15   rows (10 navigation + 1 info + 4 exit)
--
-- Idempotency strategy (per table)
--   - campus_routes:       ON CONFLICT (title) DO UPDATE
--                          (title is UNIQUE in 0001_initial_schema.sql)
--   - campus_route_steps:  no usable natural-key UNIQUE in 0001; use a
--                          scoped DELETE limited to the four seeded route
--                          titles, then INSERT. Cannot touch admin-added
--                          steps for any other route.
--   - route_nodes:         ON CONFLICT (node_key) DO UPDATE
--                          (node_key is UNIQUE)
--   - route_edges:         ON CONFLICT (from_node_id, to_node_id) DO UPDATE
--                          (the pair is UNIQUE)
--   - vr_scenes:           ON CONFLICT (scene_key) DO UPDATE
--                          (scene_key is UNIQUE)
--   - vr_hotspots:         no UNIQUE in 0001; use a scoped DELETE limited
--                          to the six seeded scene_keys, then INSERT.
--                          No admin UI for vr_hotspots exists today
--                          (HANDOFF.md), so this only refreshes the
--                          seeded hotspot set.
--
-- FK / apply order (matches the dependency chain in 0001_initial_schema.sql)
--   1. campus_routes        depends on buildings        (Section 3.3)
--   2. campus_route_steps   depends on campus_routes
--   3. route_nodes          depends on buildings        (Section 3.3)
--   4. route_edges          depends on route_nodes
--   5. vr_scenes            depends on route_nodes, buildings
--   6. vr_hotspots          depends on vr_scenes
--
-- PostGIS expression used for route_nodes.location (per SEED_STRATEGY.md
-- section 8 and 0001 section A):
--   extensions.ST_SetSRID(extensions.ST_MakePoint(lng, lat), 4326)::extensions.geography
-- The PostGIS functions are schema-qualified so this seed does not depend
-- on `extensions` being in search_path. Note the (lng, lat) argument
-- order: PostGIS ST_MakePoint takes longitude first.
--
-- Cloudinary
--   vr_scenes.cloudinary_public_id is NULL for every row; the Cloudinary
--   migration is out of Milestone 1 scope. image_url keeps the existing
--   /img/vr/*.jpg placeholder paths so the existing VR fallback UI
--   (missing panorama -> placeholder panel) keeps working.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- campus_routes
-- -----------------------------------------------------------------------------
-- Mirrors database/seed.js -> routeDefinitions (4 rows). destination is
-- resolved by building name through the JOIN, so destination_building_id
-- tracks whichever buildings.id Section 3.3 produced on this Supabase
-- project. ON CONFLICT (title) keeps campus_routes.id stable across
-- re-seeds, which is critical because campus_route_steps.route_id and
-- the /vr/routes/:routeId controller both reference these ids.
WITH r(title, start_label, dest_name, walk_time) AS (
    VALUES
        ('Main Gate to Administration Building', 'Main Gate', 'Administration Building',              '5-7 minutes'),
        ('Main Gate to CCS Building',            'Main Gate', 'College of Computer Studies (CCS)',    '6-8 minutes'),
        ('Main Gate to Library Building',        'Main Gate', 'Library Building',                     '5-7 minutes'),
        ('Main Gate to Gymnasium',               'Main Gate', 'Gymnasium',                            '7-10 minutes')
)
INSERT INTO campus_routes (
    title,
    start_label,
    destination_building_id,
    estimated_walk_time
)
SELECT
    r.title,
    r.start_label,
    b.id,
    r.walk_time
  FROM r
  JOIN buildings b ON b.name = r.dest_name
ON CONFLICT (title) DO UPDATE
    SET start_label             = EXCLUDED.start_label,
        destination_building_id = EXCLUDED.destination_building_id,
        estimated_walk_time     = EXCLUDED.estimated_walk_time,
        updated_at              = now();


-- -----------------------------------------------------------------------------
-- campus_route_steps
-- -----------------------------------------------------------------------------
-- Mirrors database/seed.js -> routeDefinitions[*].steps (4 ordered steps
-- per route, 16 rows total). step_order is 1-based and lat/lng are NULL
-- to match the MySQL seed (which passes step.lat || null, step.lng || null
-- for all 16 steps).
--
-- Idempotency: scoped DELETE by the four seeded route titles, then INSERT.
-- Resolves route_id via campus_routes.title -> id, not a hardcoded id, so
-- the seed stays correct regardless of identity sequence values on the
-- target Supabase project.
DELETE FROM campus_route_steps
 WHERE route_id IN (
    SELECT id FROM campus_routes
     WHERE title IN (
        'Main Gate to Administration Building',
        'Main Gate to CCS Building',
        'Main Gate to Library Building',
        'Main Gate to Gymnasium'
     )
 );

WITH s(route_title, step_order, instruction, landmark) AS (
    VALUES
        -- Main Gate to Administration Building
        ('Main Gate to Administration Building', 1::integer, 'Enter through the Main Gate and walk straight along the main pathway.',                                'CSPC Welcome Arch'),
        ('Main Gate to Administration Building', 2,          'Continue past the flagpole quadrangle on your left.',                                                  'Flagpole Quadrangle'),
        ('Main Gate to Administration Building', 3,          'Turn right at the intersection near the central bulletin board.',                                      'Central Bulletin Board'),
        ('Main Gate to Administration Building', 4,          'The Administration Building entrance is on your left. The Registrar is on the ground floor.',          'Administration Building Lobby'),
        -- Main Gate to CCS Building
        ('Main Gate to CCS Building',            1,          'Enter through the Main Gate and follow the main pathway forward.',                                     'CSPC Welcome Arch'),
        ('Main Gate to CCS Building',            2,          'At the first intersection, turn left toward the academic complex.',                                    'Flagpole Quadrangle'),
        ('Main Gate to CCS Building',            3,          'Pass the Main Academic Building on your right.',                                                       'Main Academic Building'),
        ('Main Gate to CCS Building',            4,          'The College of Computer Studies (CCS) is the next structure on your left.',                            'CCS Building Entrance'),
        -- Main Gate to Library Building
        ('Main Gate to Library Building',        1,          'Enter through the Main Gate and walk straight along the main pathway.',                                'CSPC Welcome Arch'),
        ('Main Gate to Library Building',        2,          'Continue past the flagpole quadrangle.',                                                               'Flagpole Quadrangle'),
        ('Main Gate to Library Building',        3,          'Take the left fork at the central pathway split.',                                                     'Central Pathway Split'),
        ('Main Gate to Library Building',        4,          'The Library Building entrance is straight ahead.',                                                     'Library Entrance'),
        -- Main Gate to Gymnasium
        ('Main Gate to Gymnasium',               1,          'Enter through the Main Gate and walk straight along the main pathway.',                                'CSPC Welcome Arch'),
        ('Main Gate to Gymnasium',               2,          'Pass the flagpole quadrangle on your right.',                                                          'Flagpole Quadrangle'),
        ('Main Gate to Gymnasium',               3,          'Continue past the Engineering Building.',                                                              'Engineering Building'),
        ('Main Gate to Gymnasium',               4,          'The Gymnasium is the large open structure at the end of the pathway.',                                 'Gymnasium Main Entrance')
)
INSERT INTO campus_route_steps (
    route_id,
    step_order,
    instruction,
    landmark,
    lat,
    lng
)
SELECT
    cr.id,
    s.step_order,
    s.instruction,
    s.landmark,
    NULL::numeric,
    NULL::numeric
  FROM s
  JOIN campus_routes cr ON cr.title = s.route_title;


-- -----------------------------------------------------------------------------
-- route_nodes
-- -----------------------------------------------------------------------------
-- Mirrors database/seed.js -> routeNodes (9 rows). Each row resolves its
-- optional building_id by name; the 'clinic' service node deliberately has
-- no associated building row in the seed, so its building_name is NULL and
-- the LEFT JOIN keeps building_id NULL on that row (matching the
-- ON DELETE SET NULL semantics in 0001).
--
-- Building-backed nodes (admin-building, registrar, ccs, library,
-- gymnasium) use the same coordinates that database/seed.js writes when a
-- buildings row exists with those coordinates, which is the case after
-- Section 3.3 (which seeds buildings with the values from models/data.js).
-- The MySQL seed re-reads buildings.lat/lng at runtime to follow admin
-- nudges; the Supabase seed is a static snapshot of those source values.
--
-- location is built inline with the schema-qualified PostGIS expression so
-- this seed never depends on `extensions` being in search_path. Note the
-- (lng, lat) argument order: PostGIS ST_MakePoint takes longitude first.
--
-- "Registrar's Office" is written with a doubled single-quote (SQL escape).
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
        ('clinic',         'Medical & Dental Clinic',                  'service',  NULL,          13.40600,          123.37580,          9)
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
-- route_edges
-- -----------------------------------------------------------------------------
-- Mirrors database/seed.js -> edgeDefs (10 undirected pairs) expanded to
-- 20 directed rows. The bidirectional decision is identical to the MySQL
-- seed and is required by utils/pathfinding.js, which builds a plain
-- directed adjacency list and never auto-reverses an edge.
--
-- is_accessible is set to true (the boolean equivalent of MySQL's 1) on
-- every row, matching the MySQL seed.
--
-- Idempotency: ON CONFLICT on the (from_node_id, to_node_id) pair. Node
-- ids are resolved by node_key, not hardcoded, so the seed stays correct
-- regardless of identity sequence values.
WITH e(from_key, to_key, distance_meters, walk_time_seconds, path_label) AS (
    VALUES
        -- main-gate <-> welcome-arch
        ('main-gate',      'welcome-arch',    60::integer,  50::integer,  'Main pathway'),
        ('welcome-arch',   'main-gate',       60,           50,           'Main pathway'),
        -- welcome-arch <-> flagpole
        ('welcome-arch',   'flagpole',        90,           75,           'Main pathway'),
        ('flagpole',       'welcome-arch',    90,           75,           'Main pathway'),
        -- flagpole <-> admin-building
        ('flagpole',       'admin-building',  120,          100,          'Quadrangle to Administration'),
        ('admin-building', 'flagpole',        120,          100,          'Quadrangle to Administration'),
        -- admin-building <-> registrar
        ('admin-building', 'registrar',       15,           15,           'Ground floor - Registrar'),
        ('registrar',      'admin-building',  15,           15,           'Ground floor - Registrar'),
        -- flagpole <-> ccs
        ('flagpole',       'ccs',             220,          185,          'Academic complex pathway'),
        ('ccs',            'flagpole',        220,          185,          'Academic complex pathway'),
        -- flagpole <-> library
        ('flagpole',       'library',         110,          95,           'Central pathway to Library'),
        ('library',        'flagpole',        110,          95,           'Central pathway to Library'),
        -- flagpole <-> gymnasium
        ('flagpole',       'gymnasium',       130,          110,          'Pathway to Gymnasium'),
        ('gymnasium',      'flagpole',        130,          110,          'Pathway to Gymnasium'),
        -- flagpole <-> clinic
        ('flagpole',       'clinic',          125,          105,          'Pathway to Clinic'),
        ('clinic',         'flagpole',        125,          105,          'Pathway to Clinic'),
        -- library <-> gymnasium
        ('library',        'gymnasium',       55,           50,           'Facilities walkway'),
        ('gymnasium',      'library',         55,           50,           'Facilities walkway'),
        -- admin-building <-> library
        ('admin-building', 'library',         95,           80,           'Admin to Library walkway'),
        ('library',        'admin-building',  95,           80,           'Admin to Library walkway')
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
-- vr_scenes
-- -----------------------------------------------------------------------------
-- Mirrors database/seed.js -> vrScenes (6 rows). node_id resolves through
-- route_nodes.node_key; building_id resolves through buildings.name. Both
-- are LEFT JOIN so a missing target stays NULL (matching the MySQL seed,
-- which assigns null when the lookup misses).
--
-- image_url keeps the existing /img/vr/*.jpg placeholders. No real
-- panorama assets exist in the repo today; the existing viewer detects
-- the 404 and shows a graceful fallback panel, and the Supabase seed
-- inherits that same fallback behavior. cloudinary_public_id is NULL for
-- every row because Cloudinary migration is out of Milestone 1 scope.
--
-- initial_yaw and initial_pitch default to 0 for every scene, matching
-- the MySQL seed. Casts in the first VALUES row pin column types so
-- subsequent rows can use bare integer literals without ambiguity.
WITH vs(scene_key, title, description, image_url, node_key, building_name, initial_yaw, initial_pitch, display_order) AS (
    VALUES
        ('scene-main-gate', 'Main Gate',                          'Campus main entrance. Placeholder 360 image.',                       '/img/vr/main-gate.jpg', 'main-gate',      NULL::varchar,                       0::numeric, 0::numeric, 1::integer),
        ('scene-flagpole',  'Flagpole Quadrangle',                'Central quadrangle hub. Placeholder 360 image.',                     '/img/vr/flagpole.jpg',  'flagpole',       NULL,                                0,          0,          2),
        ('scene-admin',     'Administration Building',            'Administration Building and Registrar. Placeholder 360 image.',      '/img/vr/admin.jpg',     'admin-building', 'Administration Building',           0,          0,          3),
        ('scene-ccs',       'College of Computer Studies (CCS)',  'CCS Building. Placeholder 360 image.',                               '/img/vr/ccs.jpg',       'ccs',            'College of Computer Studies (CCS)', 0,          0,          4),
        ('scene-library',   'Library Building',                   'Library Building. Placeholder 360 image.',                           '/img/vr/library.jpg',   'library',        'Library Building',                  0,          0,          5),
        ('scene-gym',       'Gymnasium',                          'Gymnasium. Placeholder 360 image.',                                  '/img/vr/gym.jpg',       'gymnasium',      'Gymnasium',                         0,          0,          6)
)
INSERT INTO vr_scenes (
    scene_key,
    title,
    description,
    image_url,
    cloudinary_public_id,
    node_id,
    building_id,
    initial_yaw,
    initial_pitch,
    display_order
)
SELECT
    vs.scene_key,
    vs.title,
    vs.description,
    vs.image_url,
    NULL,
    rn.id,
    b.id,
    vs.initial_yaw,
    vs.initial_pitch,
    vs.display_order
  FROM vs
  LEFT JOIN route_nodes rn ON rn.node_key = vs.node_key
  LEFT JOIN buildings   b  ON b.name      = vs.building_name
ON CONFLICT (scene_key) DO UPDATE
    SET title         = EXCLUDED.title,
        description   = EXCLUDED.description,
        image_url     = EXCLUDED.image_url,
        node_id       = EXCLUDED.node_id,
        building_id   = EXCLUDED.building_id,
        initial_yaw   = EXCLUDED.initial_yaw,
        initial_pitch = EXCLUDED.initial_pitch,
        display_order = EXCLUDED.display_order,
        updated_at    = now();


-- -----------------------------------------------------------------------------
-- vr_hotspots
-- -----------------------------------------------------------------------------
-- Mirrors database/seed.js -> vrNavPairs (5 pairs expanded to 10 navigation
-- hotspots) plus the four upsertMarkerHotspot calls (1 info + 4 exit),
-- producing 15 rows total.
--
-- Idempotency: scoped DELETE limited to the six seeded vr_scenes by
-- scene_key. The schema has no UNIQUE on vr_hotspots and no admin UI
-- currently writes to this table (HANDOFF.md section 7), so re-running
-- this section refreshes only the seeded hotspot set and leaves any other
-- scene's hotspots untouched. If/when an admin VR-hotspot CRUD lands, this
-- DELETE will need a narrower predicate.
--
-- Hotspot identity layout
--   - 10 navigation hotspots: hotspot_type='scene', target_scene_id set
--     via target_scene_key lookup, text is NULL.
--   - 1  info hotspot:        hotspot_type='info' on scene-main-gate,
--     target_scene_id NULL.
--   - 4  exit hotspots:       hotspot_type='exit' on the four destination
--     scenes (admin, ccs, library, gym), target_scene_id NULL.
--
-- The "text" column is double-quoted in the INSERT column list because
-- 0001_initial_schema.sql preserves the MySQL column name verbatim. The
-- CTE uses an unquoted alias (text_) to avoid the type-name collision.
DELETE FROM vr_hotspots
 WHERE scene_id IN (
    SELECT id FROM vr_scenes
     WHERE scene_key IN (
        'scene-main-gate',
        'scene-flagpole',
        'scene-admin',
        'scene-ccs',
        'scene-library',
        'scene-gym'
     )
 );

WITH h(scene_key, target_scene_key, hotspot_type, label, text_, yaw, pitch, display_order) AS (
    VALUES
        -- Navigation pair: Main Gate <-> Flagpole
        ('scene-main-gate', 'scene-flagpole',  'scene', 'Go to Flagpole Quadrangle',     NULL::text, 0::numeric,   0::numeric, 1::integer),
        ('scene-flagpole',  'scene-main-gate', 'scene', 'Back to Main Gate',             NULL,       180,          0,          2),
        -- Navigation pair: Flagpole <-> Administration Building
        ('scene-flagpole',  'scene-admin',     'scene', 'Go to Administration Building', NULL,       0,            0,          3),
        ('scene-admin',     'scene-flagpole',  'scene', 'Back to Flagpole Quadrangle',   NULL,       180,          0,          4),
        -- Navigation pair: Flagpole <-> CCS Building
        ('scene-flagpole',  'scene-ccs',       'scene', 'Go to CCS Building',            NULL,       0,            0,          5),
        ('scene-ccs',       'scene-flagpole',  'scene', 'Back to Flagpole Quadrangle',   NULL,       180,          0,          6),
        -- Navigation pair: Flagpole <-> Library Building
        ('scene-flagpole',  'scene-library',   'scene', 'Go to Library Building',        NULL,       0,            0,          7),
        ('scene-library',   'scene-flagpole',  'scene', 'Back to Flagpole Quadrangle',   NULL,       180,          0,          8),
        -- Navigation pair: Flagpole <-> Gymnasium
        ('scene-flagpole',  'scene-gym',       'scene', 'Go to Gymnasium',               NULL,       0,            0,          9),
        ('scene-gym',       'scene-flagpole',  'scene', 'Back to Flagpole Quadrangle',   NULL,       180,          0,         10),
        -- Info hotspot at Main Gate
        ('scene-main-gate', NULL,              'info',  'Welcome to CSPC',               'You are at the Main Gate. Follow the hotspots to reach your destination.', 30, 0, 99),
        -- Exit / arrival hotspots at destination scenes
        ('scene-admin',     NULL,              'exit',  'You have arrived',              'Administration Building reached.', 0, -10, 99),
        ('scene-ccs',       NULL,              'exit',  'You have arrived',              'CCS Building reached.',            0, -10, 99),
        ('scene-library',   NULL,              'exit',  'You have arrived',              'Library Building reached.',        0, -10, 99),
        ('scene-gym',       NULL,              'exit',  'You have arrived',              'Gymnasium reached.',               0, -10, 99)
)
INSERT INTO vr_hotspots (
    scene_id,
    target_scene_id,
    hotspot_type,
    label,
    "text",
    yaw,
    pitch,
    display_order
)
SELECT
    sc.id,
    tsc.id,
    h.hotspot_type,
    h.label,
    h.text_,
    h.yaw,
    h.pitch,
    h.display_order
  FROM h
  JOIN vr_scenes      sc  ON sc.scene_key  = h.scene_key
  LEFT JOIN vr_scenes tsc ON tsc.scene_key = h.target_scene_key;
