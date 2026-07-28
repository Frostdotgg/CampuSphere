-- =============================================================================
-- CampuSphere - Supabase / PostgreSQL / PostGIS Migration Baseline
-- File: database/supabase/0001_initial_schema.sql
-- Milestone 1, Phase 2, Sections 2.1 - 2.4 (extensions + auth/profile +
-- content/settings + buildings tables; Section 2.5 still placeholder)
-- =============================================================================
--
-- Purpose
--   Establish the Supabase/PostgreSQL/PostGIS schema baseline for CampuSphere
--   without changing the current MySQL runtime. This file is the single
--   ordered migration entry point; later Section 2.x work fills in the actual
--   table definitions below the placeholders.
--
-- Status
--   SECTIONS 2.1 - 2.5 COMPLETE. PostGIS is enabled (Section 2.1); auth and
--   profile tables -- users, student_profiles, instructor_profiles,
--   guest_profiles -- are in place with their related index and
--   constraints (Section 2.2); content and settings tables --
--   news_announcements (with audience CHECK), events, faqs,
--   system_settings, team_members -- are in place with small indexes
--   (Section 2.3); the buildings table is in place with jsonb details,
--   PostGIS location, Cloudinary-ready media fields, and category / name /
--   GIST indexes (Section 2.4). Routes/graph tables -- campus_routes,
--   campus_route_steps, route_nodes (with PostGIS location and partial
--   GIST index), route_edges (directed rows, unique (from_node_id,
--   to_node_id)) -- and VR tables -- vr_scenes (with cloudinary_public_id),
--   vr_hotspots -- are in place (Section 2.5). Section 2.6 (README under
--   database/supabase/) is still pending.
--
-- Migration roadmap for this file
--   Section 2.2 - Auth and profile tables
--                 (users, student_profiles, instructor_profiles,
--                  guest_profiles)
--   Section 2.3 - Content and settings tables
--                 (news_announcements, events, faqs, system_settings,
--                  team_members)
--   Section 2.4 - Buildings and map tables
--                 (buildings with jsonb details, lat/lng, PostGIS location,
--                  Cloudinary fields)
--   Section 2.5 - Routes/graph and VR tables
--                 (campus_routes, campus_route_steps, route_nodes with
--                  PostGIS location, route_edges, vr_scenes with
--                  cloudinary_public_id, vr_hotspots)
--   Section 2.6 - README under database/supabase/ describing how to apply
--                 this migration in Supabase.
--
-- Non-goals for this file
--   - No seed data. Seed work is Phase 3 (Sections 3.1 - 3.5).
--   - No Supabase Auth migration. Express session auth and Google OAuth are
--     retained. See plan.md "Final stack decision".
--   - No browser-exposed Supabase keys. Server-side access only.
--   - No changes to MySQL runtime files (database/schema.sql,
--     database/seed.js, controllers, routes, views, public assets).
--
-- Ordering rules (apply top to bottom)
--   A. Extensions
--   B. Tables (grouped by feature area)
--   C. Indexes and constraints (added alongside their tables where useful)
--   D. Notes for reviewers and follow-up phases
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Section A. Extensions
-- -----------------------------------------------------------------------------
-- PostGIS is installed into the dedicated `extensions` schema (the Supabase
-- convention) rather than `public`. The migration references the PostGIS
-- geography type as extensions.geography(Point, 4326) on
-- buildings.location (Section 2.4) and route_nodes.location (Section 2.5);
-- creating the schema first and installing PostGIS into it keeps that
-- schema-qualified type resolution consistent when applying this SQL in
-- the Supabase SQL editor, via psql, or via the Supabase CLI, regardless
-- of the session search_path. Enabling PostGIS now also keeps the
-- migration linear so later sections can add geography columns without
-- re-ordering this file.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;


-- -----------------------------------------------------------------------------
-- Section B. Tables
-- -----------------------------------------------------------------------------
-- Each subsection is a placeholder. Actual table DDL is added by the section
-- noted in each header. Keep tables grouped by feature area so reviewers can
-- diff one feature at a time.

-- B.1 Auth and profile tables  (Section 2.2)
-- Mirrors the MySQL definitions in database/schema.sql so the current
-- Express session login, profile hydration, and Google OAuth flows keep
-- working when the live data layer is later switched to Supabase.
-- No Supabase Auth tables are introduced.

-- users
--   Single account table for both local (bcrypt) and Google OAuth users.
--   - password is NOT NULL to match MySQL; the OAuth path stores a non-
--     usable hash, never a real Google password.
--   - role: text + CHECK constraint replaces the MySQL ENUM. Values must
--     stay in sync with controllers/authController.js role checks and
--     models/data.js sidebarNav keys.
--   - oauth_provider defaults to 'local' so existing local inserts keep
--     working without code changes.
--   - updated_at has no AUTO-UPDATE trigger yet; application code (or a
--     later migration) is responsible for refreshing it.
CREATE TABLE IF NOT EXISTS users (
    id                bigint        GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    username          varchar(50)   NOT NULL,
    email             varchar(100)  NOT NULL UNIQUE,
    password          varchar(255)  NOT NULL,
    role              text          NOT NULL DEFAULT 'guest'
        CHECK (role IN ('student-cspc', 'instructor', 'admin', 'guest')),
    first_name        varchar(50)   NOT NULL,
    last_name         varchar(50)   NOT NULL,
    profile_image_url varchar(255),
    oauth_provider    varchar(50)   DEFAULT 'local',
    oauth_subject     varchar(255),
    created_at        timestamptz   NOT NULL DEFAULT now(),
    updated_at        timestamptz   NOT NULL DEFAULT now()
);

-- One Google account maps to at most one users row. Partial index so local
-- accounts (oauth_subject IS NULL) remain unconstrained on this pair.
CREATE UNIQUE INDEX IF NOT EXISTS users_oauth_provider_subject_uidx
    ON users (oauth_provider, oauth_subject)
    WHERE oauth_subject IS NOT NULL;

-- student_profiles
--   1:1 with users(id). UNIQUE(user_id) enforces one profile per user;
--   ON DELETE CASCADE matches current MySQL FK behavior.
CREATE TABLE IF NOT EXISTS student_profiles (
    id                bigint        GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id           bigint        NOT NULL UNIQUE
        REFERENCES users(id) ON DELETE CASCADE,
    student_id_number varchar(50)   NOT NULL,
    course            varchar(100)  NOT NULL,
    year_level        varchar(50)   NOT NULL,
    enrollment_status varchar(50)   DEFAULT 'Enrolled',
    semester          varchar(100)  NOT NULL
);

-- instructor_profiles
--   1:1 with users(id). Mirrors MySQL field shape; no timestamp columns.
CREATE TABLE IF NOT EXISTS instructor_profiles (
    id          bigint        GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id     bigint        NOT NULL UNIQUE
        REFERENCES users(id) ON DELETE CASCADE,
    employee_id varchar(50)   NOT NULL,
    department  varchar(100)  NOT NULL,
    position    varchar(100)  NOT NULL,
    status      varchar(50)   DEFAULT 'Active'
);

-- guest_profiles
--   1:1 with users(id). MySQL version carries created_at/updated_at, so
--   they are preserved here as timestamptz.
CREATE TABLE IF NOT EXISTS guest_profiles (
    id           bigint        GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id      bigint        NOT NULL UNIQUE
        REFERENCES users(id) ON DELETE CASCADE,
    address      varchar(255)  NOT NULL,
    phone_number varchar(50)   NOT NULL,
    created_at   timestamptz   NOT NULL DEFAULT now(),
    updated_at   timestamptz   NOT NULL DEFAULT now()
);

-- B.2 Content and settings tables  (Section 2.3)
-- Mirrors the MySQL definitions in database/schema.sql so admin CRUD,
-- dashboard announcements, events, FAQs, settings, and the About page team
-- list keep working when the data layer is later switched to Supabase.
-- MySQL TIMESTAMP becomes timestamptz; DATE stays date; updated_at columns
-- have no AUTO-UPDATE trigger yet (application or a later migration).

-- news_announcements
--   audience: text + CHECK; values match controller/seed usage. The seed
--   currently uses 'all', 'student-cspc', 'instructor', 'guest'; 'admin' is
--   reserved for admin-only announcements.
--   author_id is bigint to match users.id; ON DELETE SET NULL preserves
--   posts after the author's account is removed (matches current MySQL FK).
CREATE TABLE IF NOT EXISTS news_announcements (
    id             bigint        GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    title          varchar(255)  NOT NULL,
    category       varchar(50)   NOT NULL,
    audience       text          NOT NULL DEFAULT 'all'
        CHECK (audience IN ('all', 'student-cspc', 'instructor', 'guest', 'admin')),
    excerpt        text,
    content        text,
    author_id      bigint
        REFERENCES users(id) ON DELETE SET NULL,
    published_date timestamptz   DEFAULT now(),
    created_at     timestamptz   NOT NULL DEFAULT now(),
    updated_at     timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS news_announcements_published_date_idx
    ON news_announcements (published_date DESC);
CREATE INDEX IF NOT EXISTS news_announcements_audience_idx
    ON news_announcements (audience);

-- events
--   event_date stays as date (MySQL DATE); event_time stays as a free-text
--   varchar to mirror the current "9:00 AM - 11:00 AM" style values.
CREATE TABLE IF NOT EXISTS events (
    id          bigint        GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    title       varchar(255)  NOT NULL,
    category    varchar(50)   NOT NULL,
    event_date  date          NOT NULL,
    description text,
    location    varchar(255),
    event_time  varchar(100),
    created_at  timestamptz   NOT NULL DEFAULT now(),
    updated_at  timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_event_date_idx
    ON events (event_date);

-- faqs
--   No timestamps in MySQL; preserved.
CREATE TABLE IF NOT EXISTS faqs (
    id            bigint        GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    question      varchar(255)  NOT NULL,
    answer        text          NOT NULL,
    category      varchar(50),
    display_order integer       DEFAULT 0
);

CREATE INDEX IF NOT EXISTS faqs_display_order_idx
    ON faqs (display_order);

-- system_settings
--   setting_key is itself the primary key in MySQL; preserved (no surrogate
--   id column).
CREATE TABLE IF NOT EXISTS system_settings (
    setting_key   varchar(100)  PRIMARY KEY,
    setting_value text          NOT NULL
);

-- team_members
--   About-page team list. Required per plan.md Section 2.3.
CREATE TABLE IF NOT EXISTS team_members (
    id            bigint        GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    name          varchar(100)  NOT NULL,
    role          varchar(100)  NOT NULL,
    image_url     varchar(255)  NOT NULL,
    display_order integer       DEFAULT 0
);

CREATE INDEX IF NOT EXISTS team_members_display_order_idx
    ON team_members (display_order);

-- B.3 Buildings and map tables  (Section 2.4)
-- Mirrors the MySQL `buildings` definition in database/schema.sql plus the
-- final-stack additions: jsonb details, PostGIS location, and Cloudinary-
-- ready media fields. The current adminBuildingsController validates and
-- JSON.stringifies `details` already, so jsonb is the natural target type.

-- buildings
--   - lat/lng kept and NOT NULL to preserve current Leaflet UI behavior;
--     adminBuildingsController.validateCoord rejects missing values at
--     create/update time, so NOT NULL mirrors the runtime contract.
--   - details: jsonb. The runtime treats it as a JSON object today.
--   - location: PostGIS geography point, schema-qualified as
--     extensions.geography(Point, 4326). Supabase installs PostGIS into
--     the `extensions` schema; qualifying the type makes this migration
--     resolve correctly regardless of session search_path (e.g., when run
--     via the Supabase SQL editor, via psql with a non-default
--     search_path, or after a future migration narrows search_path).
--   - image_url / cloudinary_public_id: nullable; reserved for later
--     Cloudinary migration so existing seed rows do not need values yet.
CREATE TABLE IF NOT EXISTS buildings (
    id                   bigint         GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    name                 varchar(150)   NOT NULL,
    category             varchar(50)    NOT NULL,
    description          text,
    lat                  numeric(10, 8) NOT NULL,
    lng                  numeric(11, 8) NOT NULL,
    details              jsonb,
    location             extensions.geography(Point, 4326),
    image_url            varchar(255),
    cloudinary_public_id varchar(255),
    created_at           timestamptz    NOT NULL DEFAULT now(),
    updated_at           timestamptz    NOT NULL DEFAULT now()
);

-- Category filter (used by /buildings and /map filtering UIs).
CREATE INDEX IF NOT EXISTS buildings_category_idx
    ON buildings (category);

-- Case-insensitive name lookups: hits this index when the query side uses
-- lower(name) = lower($1) or lower(name) LIKE '...'. Plain `name` lookups
-- will not use it, so this is a deliberate, simple alternative to FTS.
CREATE INDEX IF NOT EXISTS buildings_name_lower_idx
    ON buildings (lower(name));

-- PostGIS spatial index for nearest/within queries on the geography column.
-- Partial: skip rows that don't yet have a location backfilled.
CREATE INDEX IF NOT EXISTS buildings_location_gix
    ON buildings USING GIST (location)
    WHERE location IS NOT NULL;

-- Full-text search across name + description (and similar cross-table
-- search the API exposes today via /api/search) is intentionally deferred
-- to a later milestone, when the search controller is migrated.

-- B.4 Routes and graph tables  (Section 2.5)
-- Mirrors the MySQL definitions in database/schema.sql so /map, /buildings,
-- the route summary modal, the /api/routes* and /api/pathfind endpoints,
-- and the existing Dijkstra helper in utils/pathfinding.js can be migrated
-- without changing API shapes. route_edges remain DIRECTED rows: the
-- current seed inserts both A->B and B->A for every walkable connection,
-- so Dijkstra walks route_edges as a plain directed graph with no
-- bidirectional special-casing.

-- campus_routes
--   One row per seeded campus route (e.g., Main Gate to Administration).
--   - title is UNIQUE in MySQL (uniq_route_title); preserved as a column-
--     level UNIQUE so the seed's title-based upsert can be migrated
--     idempotently.
--   - destination_building_id FK -> buildings(id) ON DELETE CASCADE matches
--     the current MySQL FK behavior, so route rows go away when an admin
--     removes the destination building.
CREATE TABLE IF NOT EXISTS campus_routes (
    id                      bigint        GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    title                   varchar(150)  NOT NULL UNIQUE,
    start_label             varchar(100)  NOT NULL,
    destination_building_id bigint        NOT NULL
        REFERENCES buildings(id) ON DELETE CASCADE,
    estimated_walk_time     varchar(50),
    created_at              timestamptz   NOT NULL DEFAULT now(),
    updated_at              timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campus_routes_destination_building_id_idx
    ON campus_routes (destination_building_id);

-- campus_route_steps
--   Ordered text steps for a campus_route. MySQL has no timestamp columns
--   on this child table; preserved.
CREATE TABLE IF NOT EXISTS campus_route_steps (
    id          bigint         GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    route_id    bigint         NOT NULL
        REFERENCES campus_routes(id) ON DELETE CASCADE,
    step_order  integer        NOT NULL,
    instruction text           NOT NULL,
    landmark    varchar(255),
    lat         numeric(10, 8),
    lng         numeric(11, 8)
);

CREATE INDEX IF NOT EXISTS campus_route_steps_route_id_step_order_idx
    ON campus_route_steps (route_id, step_order);

-- route_nodes
--   Graph nodes for Dijkstra-based pathfinding. node_key is the stable
--   identifier used in seeds and in /api/pathfind requests.
--   - lat/lng are NOT NULL: matches MySQL and the current pathfinding
--     helper, which reads numeric coordinates directly off node rows.
--   - location is extensions.geography(Point, 4326), schema-qualified for
--     the same search_path reason given on buildings.location in B.3.
--     Nullable so existing seeds without a backfilled location keep
--     loading.
--   - building_id FK -> buildings(id) ON DELETE SET NULL preserves the
--     MySQL behavior (the seeded 'clinic' node has no building row and
--     must remain valid).
CREATE TABLE IF NOT EXISTS route_nodes (
    id            bigint         GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    node_key      varchar(60)    NOT NULL UNIQUE,
    label         varchar(150)   NOT NULL,
    node_type     varchar(30)    NOT NULL DEFAULT 'walkway',
    building_id   bigint
        REFERENCES buildings(id) ON DELETE SET NULL,
    lat           numeric(10, 8) NOT NULL,
    lng           numeric(11, 8) NOT NULL,
    location      extensions.geography(Point, 4326),
    display_order integer        DEFAULT 0,
    created_at    timestamptz    NOT NULL DEFAULT now(),
    updated_at    timestamptz    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS route_nodes_building_id_idx
    ON route_nodes (building_id);

-- PostGIS spatial index for nearest/within queries on the route graph.
-- Partial: skip rows that don't yet have a location backfilled.
CREATE INDEX IF NOT EXISTS route_nodes_location_gix
    ON route_nodes USING GIST (location)
    WHERE location IS NOT NULL;

-- route_edges
--   Directed walkable connections between route_nodes. Bidirectional walks
--   are stored as two rows (A->B and B->A), so the Dijkstra helper in
--   utils/pathfinding.js never needs to treat any edge as symmetric.
--   - UNIQUE(from_node_id, to_node_id) preserves uniq_edge_pair so the
--     seed can upsert idempotently.
--   - is_accessible: MySQL TINYINT(1) NOT NULL DEFAULT 1 -> boolean NOT
--     NULL DEFAULT true. The application reads it as a flag, not 0/1.
--   - No updated_at in MySQL; preserved.
CREATE TABLE IF NOT EXISTS route_edges (
    id                bigint        GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    from_node_id      bigint        NOT NULL
        REFERENCES route_nodes(id) ON DELETE CASCADE,
    to_node_id        bigint        NOT NULL
        REFERENCES route_nodes(id) ON DELETE CASCADE,
    distance_meters   integer       NOT NULL DEFAULT 0,
    walk_time_seconds integer       NOT NULL DEFAULT 0,
    path_label        varchar(150),
    is_accessible     boolean       NOT NULL DEFAULT true,
    created_at        timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (from_node_id, to_node_id)
);

CREATE INDEX IF NOT EXISTS route_edges_from_node_id_idx
    ON route_edges (from_node_id);
CREATE INDEX IF NOT EXISTS route_edges_to_node_id_idx
    ON route_edges (to_node_id);

-- B.5 VR scene and hotspot tables  (Section 2.5)
-- Mirrors the MySQL vr_scenes and vr_hotspots definitions plus the final-
-- stack addition of cloudinary_public_id, so a later migration can swap
-- image_url for Cloudinary-delivered panoramas without a schema change.
-- Existing fallback behavior (missing panorama -> placeholder UI) is
-- unaffected because image_url and cloudinary_public_id are both nullable.

-- vr_scenes
--   One row per 360 panorama. node_id and building_id link a scene to the
--   graph node or building it represents; both nullable so demo scenes
--   without an associated node/building keep loading.
--   - initial_yaw / initial_pitch: numeric(6, 2) matches DECIMAL(6,2).
--   - cloudinary_public_id reserved for later Cloudinary integration; no
--     runtime consumer exists yet.
CREATE TABLE IF NOT EXISTS vr_scenes (
    id                   bigint        GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    scene_key            varchar(60)   NOT NULL UNIQUE,
    title                varchar(150)  NOT NULL,
    description          text,
    image_url            varchar(255),
    cloudinary_public_id varchar(255),
    node_id              bigint
        REFERENCES route_nodes(id) ON DELETE SET NULL,
    building_id          bigint
        REFERENCES buildings(id) ON DELETE SET NULL,
    initial_yaw          numeric(6, 2) NOT NULL DEFAULT 0,
    initial_pitch        numeric(6, 2) NOT NULL DEFAULT 0,
    display_order        integer       DEFAULT 0,
    created_at           timestamptz   NOT NULL DEFAULT now(),
    updated_at           timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vr_scenes_node_id_idx
    ON vr_scenes (node_id);
CREATE INDEX IF NOT EXISTS vr_scenes_building_id_idx
    ON vr_scenes (building_id);

-- vr_hotspots
--   Clickable points within a scene. hotspot_type values currently in use
--   are 'scene' (jump to target_scene_id), 'info' (show text), and 'exit'
--   (close VR / arrival marker). A CHECK constraint is intentionally NOT
--   added: MySQL stores hotspot_type as free text today, and adding a
--   CHECK here without a matching runtime allowlist would diverge from
--   current behavior.
--   - "text": quoted to keep the MySQL column name `text` verbatim. The
--     unquoted identifier also resolves in PostgreSQL, but quoting
--     documents intent and removes ambiguity with the type name.
--   - target_scene_id ON DELETE SET NULL matches MySQL: deleting a target
--     scene leaves the hotspot row in place but breaks its link.
CREATE TABLE IF NOT EXISTS vr_hotspots (
    id              bigint         GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    scene_id        bigint         NOT NULL
        REFERENCES vr_scenes(id) ON DELETE CASCADE,
    target_scene_id bigint
        REFERENCES vr_scenes(id) ON DELETE SET NULL,
    hotspot_type    varchar(20)    NOT NULL DEFAULT 'scene',
    label           varchar(150)   NOT NULL,
    "text"          text,
    yaw             numeric(6, 2)  NOT NULL DEFAULT 0,
    pitch           numeric(6, 2)  NOT NULL DEFAULT 0,
    display_order   integer        DEFAULT 0,
    created_at      timestamptz    NOT NULL DEFAULT now(),
    updated_at      timestamptz    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vr_hotspots_scene_id_idx
    ON vr_hotspots (scene_id);
CREATE INDEX IF NOT EXISTS vr_hotspots_target_scene_id_idx
    ON vr_hotspots (target_scene_id);


-- -----------------------------------------------------------------------------
-- Section C. Indexes and constraints
-- -----------------------------------------------------------------------------
-- Placeholder. Indexes (including GIST indexes on geography columns) and any
-- cross-table constraints will be added by Sections 2.2 - 2.5 alongside their
-- owning tables, so each section diff stays self-contained.


-- -----------------------------------------------------------------------------
-- Section D. Data API service-role grants
-- -----------------------------------------------------------------------------
-- The Supabase Data API (PostgREST) is enabled for this project, but the
-- "Automatically expose new tables" setting is intentionally disabled so
-- newly created tables are NOT auto-exposed to the public anon endpoint
-- without explicit review. As a side effect, the service_role role does
-- not inherit privileges on the tables/sequences created by this
-- migration; without the grants below, server-side queries from
-- config/supabase.js (the only caller that ever uses the service role
-- key) fail with errors such as
--   "permission denied for table system_settings".
--
-- These grants codify what was previously applied by hand after the
-- first apply, so a fresh Supabase setup is repeatable from this file
-- alone. They are scoped to service_role ONLY -- never to anon and
-- never to authenticated. The browser, EJS, and public JS never see
-- the service role key (see plan.md "Access decision" and
-- config/supabase.js header).

GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA extensions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;


-- -----------------------------------------------------------------------------
-- Section E. Notes for reviewers and follow-up phases
-- -----------------------------------------------------------------------------
-- - Apply order: this is migration file 0001. Later phases (3.x seed,
--   4.x server config, 5.x DAL skeleton) do not require additional
--   migration files unless they introduce new tables; if they do, add
--   numbered files (0002_*.sql, 0003_*.sql, ...) in this same folder.
-- - MySQL runtime is unchanged. database/schema.sql and database/seed.js
--   continue to be the live source of truth until controllers are migrated.
-- - Supabase service role key must never be loaded by EJS templates,
--   public JS, or any window-exposed global. See plan.md "Access decision".
-- - To apply this migration in Supabase:
--     Option 1: paste the contents into the Supabase SQL Editor and run.
--     Option 2: include this file in a Supabase CLI migrations pipeline
--               once the team adopts it (deferred to Section 2.6 README).
-- =============================================================================
