-- CampuSphere Database Schema

CREATE DATABASE IF NOT EXISTS campusphere_db;
USE campusphere_db;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('student-cspc', 'instructor', 'admin', 'guest') NOT NULL DEFAULT 'guest',
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    profile_image_url VARCHAR(255),
    oauth_provider VARCHAR(50) DEFAULT 'local',
    oauth_subject VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    -- R8 parity with Supabase users_oauth_provider_subject_uidx: at most one
    -- users row per (oauth_provider, oauth_subject). MySQL treats NULLs as
    -- distinct in a UNIQUE index, so the many local accounts (oauth_subject
    -- NULL) stay unconstrained, matching Supabase's partial WHERE-NOT-NULL index.
    UNIQUE KEY uq_users_oauth_provider_subject (oauth_provider, oauth_subject),
    -- Section 8.8 follow-up: index the admin-list ordering/filter columns
    -- (recent users by created_at, role filter, updated_at) for Supabase parity.
    KEY idx_users_created_at (created_at),
    KEY idx_users_updated_at (updated_at),
    KEY idx_users_role (role)
);

-- Short-lived authenticated presence signal. This is intentionally separate
-- from users.updated_at, which describes account/profile changes and must not
-- be bumped by a recurring heartbeat. A row is created only after real app
-- activity; existing accounts are therefore Offline/Never until they use the
-- application. The MySQL migration helper keeps existing volumes in parity.
CREATE TABLE IF NOT EXISTS user_presence (
    user_id INT NOT NULL PRIMARY KEY,
    last_seen_at TIMESTAMP(3) NOT NULL,
    KEY idx_user_presence_last_seen_at (last_seen_at),
    CONSTRAINT fk_user_presence_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS student_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    student_id_number VARCHAR(50) NOT NULL,
    course VARCHAR(100) NOT NULL,
    year_level VARCHAR(50) NOT NULL,
    enrollment_status VARCHAR(50) DEFAULT 'Enrolled',
    semester VARCHAR(100) NOT NULL,
    UNIQUE KEY uq_student_profiles_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS instructor_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    employee_id VARCHAR(50) NOT NULL,
    department VARCHAR(100) NOT NULL,
    position VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'Active',
    UNIQUE KEY uq_instructor_profiles_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS guest_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    address VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_guest_profiles_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS buildings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    lat DECIMAL(10,8) NOT NULL,
    lng DECIMAL(11,8) NOT NULL,
    details TEXT,
    -- Milestone 10 (Cloudinary media metadata; nullable, additive). image_url
    -- mirrors the public building image (the seed backfills it from details.img);
    -- cloudinary_public_id is reserved for Cloudinary delivery and stays NULL
    -- until a later Milestone 10 section. Every building read tolerates NULL.
    image_url VARCHAR(255),
    cloudinary_public_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Milestone 11 (Room Scheduling): real admin-managed room/facility schedule
-- entries tied to a building (see docs/room-scheduling-domain-contract.md).
-- location_label/floor_label are free text because rooms exist only inside
-- buildings.details JSON, not as rows. building_id RESTRICTs building deletes
-- (no silent cascade of schedules); created_by_user_id mirrors the
-- news_announcements.author_id SET NULL convention. Supabase parity:
-- database/supabase/0012_room_schedules.sql.
CREATE TABLE IF NOT EXISTS room_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    schedule_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    audience ENUM('all','student-cspc','instructor','guest','admin') NOT NULL DEFAULT 'all',
    status ENUM('scheduled','cancelled','completed') NOT NULL DEFAULT 'scheduled',
    building_id INT NOT NULL,
    location_type ENUM('room','facility') NOT NULL,
    location_label VARCHAR(120) NOT NULL,
    floor_label VARCHAR(80) NULL,
    description VARCHAR(1000) NULL,
    created_by_user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_room_schedules_building_date (building_id, schedule_date),
    KEY idx_room_schedules_schedule_date (schedule_date),
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Semester-long room schedule images. One persistent record represents the
-- current schedule for one physical room/facility; updating its semester,
-- school year, or image keeps every linked VR hotspot current.
CREATE TABLE IF NOT EXISTS room_schedule_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    building_id INT NOT NULL,
    location_type ENUM('room','facility') NOT NULL,
    location_label VARCHAR(120) NOT NULL,
    floor_label VARCHAR(80) NULL,
    -- SHA-256 of the server-normalized type/floor/label identity. Keeping the
    -- key ASCII and fixed-width makes cross-backend uniqueness deterministic.
    location_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    semester ENUM('first-semester','second-semester','midyear') NOT NULL,
    school_year CHAR(9) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    image_url VARCHAR(1000) NOT NULL,
    cloudinary_public_id VARCHAR(255) NULL,
    created_by_user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_room_schedule_documents_location (building_id, location_key),
    KEY idx_room_schedule_documents_building_term (building_id, semester, school_year),
    CONSTRAINT fk_room_schedule_documents_building
        FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE RESTRICT,
    CONSTRAINT fk_room_schedule_documents_creator
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_room_schedule_documents_school_year
        CHECK (
            school_year REGEXP '^[0-9]{4}-[0-9]{4}$'
            AND CAST(SUBSTRING(school_year, 1, 4) AS UNSIGNED) BETWEEN 2000 AND 2199
            AND CAST(SUBSTRING(school_year, 6, 4) AS UNSIGNED) =
                CAST(SUBSTRING(school_year, 1, 4) AS UNSIGNED) + 1
        )
);

CREATE TABLE IF NOT EXISTS news_announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    audience VARCHAR(30) NOT NULL DEFAULT 'all',
    excerpt TEXT,
    content TEXT,
    author_id INT,
    published_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    -- Section 8.8 follow-up: dashboard filters by audience + orders by
    -- published_date; admin list orders by created_at. Supabase parity.
    KEY idx_news_audience_published (audience, published_date),
    KEY idx_news_published_date (published_date),
    KEY idx_news_created_at (created_at),
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS team_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(100) NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    display_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    event_date DATE NOT NULL,
    description TEXT,
    location VARCHAR(255),
    event_time VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    -- Section 8.8 follow-up: events lists order by event_date. Supabase parity.
    KEY idx_events_event_date (event_date)
);

CREATE TABLE IF NOT EXISTS faqs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question VARCHAR(255) NOT NULL,
    answer TEXT NOT NULL,
    category VARCHAR(50),
    display_order INT DEFAULT 0,
    -- Section 8.8 follow-up: FAQ lists order by display_order, id. Supabase parity.
    KEY idx_faqs_display_order (display_order, id)
);

CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campus_routes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    start_label VARCHAR(100) NOT NULL,
    destination_building_id INT NOT NULL,
    estimated_walk_time VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_route_title (title),
    FOREIGN KEY (destination_building_id) REFERENCES buildings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS campus_route_steps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    route_id INT NOT NULL,
    step_order INT NOT NULL,
    instruction TEXT NOT NULL,
    landmark VARCHAR(255),
    lat DECIMAL(10,8),
    lng DECIMAL(11,8),
    -- Section 8.8 follow-up: steps are read per route ordered by step_order.
    -- Supabase parity (campus_route_steps_route_id_step_order_idx).
    KEY idx_route_steps_route_order (route_id, step_order),
    FOREIGN KEY (route_id) REFERENCES campus_routes(id) ON DELETE CASCADE
);

-- ===== Route graph for Dijkstra-based campus pathfinding (Milestone 5) =====
-- Nodes are campus points (gates, walkway junctions, buildings, services).
-- Edges are walkable connections. Edges are stored as DIRECTED rows; the
-- seed inserts BOTH directions (A->B and B->A) for every connection, so the
-- future Dijkstra helper can treat route_edges as a plain directed graph
-- without any special bidirectional handling. These tables are additive and
-- do not affect campus_routes / campus_route_steps.
CREATE TABLE IF NOT EXISTS route_nodes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    node_key VARCHAR(60) NOT NULL UNIQUE,
    label VARCHAR(150) NOT NULL,
    node_type VARCHAR(30) NOT NULL DEFAULT 'walkway',
    building_id INT NULL,
    lat DECIMAL(10,8) NOT NULL,
    lng DECIMAL(11,8) NOT NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    -- Section 8.8 follow-up: admin route-node list orders by display_order, id.
    KEY idx_route_nodes_display_order (display_order, id),
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS route_edges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_node_id INT NOT NULL,
    to_node_id INT NOT NULL,
    distance_meters INT NOT NULL DEFAULT 0,
    walk_time_seconds INT NOT NULL DEFAULT 0,
    path_label VARCHAR(150),
    is_accessible TINYINT(1) NOT NULL DEFAULT 1,
    -- Pre-Milestone-12 RF.2: optional ordered [{lat,lng},...] drawing shape
    -- (2-200 points, from-node -> to-node). Seeded reverse rows may start as
    -- exact reversals, but admin edits can store an independent exit geometry.
    -- Authoritative for DRAWING the selected route only; routing stays on the
    -- scalar graph fields above. Contract + validation:
    -- utils/routeGeometry.js.
    path_geometry JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_edge_pair (from_node_id, to_node_id),
    FOREIGN KEY (from_node_id) REFERENCES route_nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (to_node_id) REFERENCES route_nodes(id) ON DELETE CASCADE
);

-- ===== VR / 360 scene data (Milestone 5) =====
-- Additive tables for guided 360 walkthroughs. A scene is one
-- panorama; hotspots are clickable points that either jump to
-- another scene ('scene'), show information ('info'), or mark
-- arrival / leave VR ('exit'). Scenes may link to a route_nodes
-- node and/or a building. These tables do not affect campus_routes,
-- campus_route_steps, route_nodes, or route_edges.
CREATE TABLE IF NOT EXISTS vr_scenes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    scene_key VARCHAR(60) NOT NULL UNIQUE,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    image_url VARCHAR(255),
    -- Milestone 10: Cloudinary delivery metadata for VR panoramas (nullable,
    -- additive; no runtime consumer yet). Scenes tolerate cloudinary_public_id
    -- = NULL and keep using image_url / the /img/vr/*.jpg placeholder fallback.
    cloudinary_public_id VARCHAR(255),
    node_id INT NULL,
    building_id INT NULL,
    initial_yaw DECIMAL(6,2) NOT NULL DEFAULT 0,
    initial_pitch DECIMAL(6,2) NOT NULL DEFAULT 0,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    -- Section 8.8 follow-up: scene browser/admin list orders by display_order, id.
    KEY idx_vr_scenes_display_order (display_order, id),
    FOREIGN KEY (node_id) REFERENCES route_nodes(id) ON DELETE SET NULL,
    FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS vr_hotspots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    scene_id INT NOT NULL,
    target_scene_id INT NULL,
    hotspot_type VARCHAR(20) NOT NULL DEFAULT 'scene',
    label VARCHAR(150) NOT NULL,
    `text` TEXT,
    -- Milestone 11.8A: optional room/facility schedule target metadata for
    -- VR "door" hotspots. Existing scene/info/exit hotspots keep these NULL.
    schedule_building_id INT NULL,
    schedule_location_type ENUM('room','facility') NULL,
    schedule_location_label VARCHAR(120) NULL,
    schedule_floor_label VARCHAR(80) NULL,
    -- Preferred schedule target. Legacy location metadata remains nullable for
    -- transitional read-only fallback until every old hotspot is relinked.
    schedule_document_id INT NULL,
    yaw DECIMAL(6,2) NOT NULL DEFAULT 0,
    pitch DECIMAL(6,2) NOT NULL DEFAULT 0,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    -- Section 8.8 follow-up: hotspots are read per scene ordered by display_order, id.
    KEY idx_vr_hotspots_scene_display (scene_id, display_order, id),
    KEY idx_vr_hotspots_schedule_target (schedule_building_id, schedule_location_type, schedule_location_label),
    KEY idx_vr_hotspots_schedule_document (schedule_document_id),
    FOREIGN KEY (scene_id) REFERENCES vr_scenes(id) ON DELETE CASCADE,
    FOREIGN KEY (target_scene_id) REFERENCES vr_scenes(id) ON DELETE SET NULL,
    FOREIGN KEY (schedule_building_id) REFERENCES buildings(id) ON DELETE SET NULL,
    CONSTRAINT fk_vr_hotspots_schedule_document
        FOREIGN KEY (schedule_document_id) REFERENCES room_schedule_documents(id) ON DELETE RESTRICT
);

-- ===== System audit logs (Milestone 7) =====
-- Privacy-minimal, append-only audit trail. Stores WHAT happened plus a safe
-- message only. It NEVER stores IP addresses, passwords, request bodies,
-- tokens, cookies, session IDs, OAuth subjects, secrets, or stack traces.
-- There is no updated_at column: rows are immutable through the application.
CREATE TABLE IF NOT EXISTS system_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    outcome VARCHAR(20) NOT NULL,
    actor_user_id INT NULL,
    attempted_email VARCHAR(100) NULL,
    actor_role VARCHAR(30) NULL,
    target_type VARCHAR(50) NULL,
    target_id VARCHAR(100) NULL,
    message VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_system_logs_created_at (created_at),
    INDEX idx_system_logs_event_outcome_created (event_type, outcome, created_at),
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Persistent express-session store (Milestone 8, Section 8.4). Backs the
-- MySQL session store (services/mysqlSessionStore.js), which also CREATEs this
-- table at startup if missing. `sess` holds JSON.stringify of the session;
-- `expires_at` is epoch milliseconds. No FKs: sessions are infrastructure, not
-- domain data, and may exist for anonymous (pre-login) visitors.
CREATE TABLE IF NOT EXISTS app_sessions (
    sid VARCHAR(128) NOT NULL PRIMARY KEY,
    sess LONGTEXT NOT NULL,
    expires_at BIGINT NOT NULL,
    INDEX idx_app_sessions_expires (expires_at)
);
