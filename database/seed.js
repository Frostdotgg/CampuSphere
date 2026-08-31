const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const data = require('../models/data');
const {
    validatePathGeometry,
    reversePathGeometry,
    buildPathGeometry
} = require('../utils/routeGeometry');

async function seed() {
    try {
        console.log('Connecting to MySQL...');
        // Connect without database first to create it
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASS || '',
            multipleStatements: true
        });

        console.log('Reading schema...');
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('Executing schema...');
        await connection.query(schema);

        // Switch to the newly created database
        await connection.query('USE campusphere_db');

        // ---- Idempotent migrations (for existing databases) ----
        // CREATE TABLE IF NOT EXISTS does not add new columns to a table that
        // already exists, so add news_announcements.audience if it is missing.
        // Existing rows safely default to 'all'.
        console.log('Running migrations...');
        const [audienceCol] = await connection.query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'news_announcements'
               AND COLUMN_NAME = 'audience'`
        );
        if (audienceCol.length === 0) {
            await connection.query(
                `ALTER TABLE news_announcements
                 ADD COLUMN audience VARCHAR(30) NOT NULL DEFAULT 'all' AFTER category`
            );
            console.log('  Added news_announcements.audience column (existing rows default to "all").');
        } else {
            console.log('  news_announcements.audience already present.');
        }

        // R8: MySQL identity/profile uniqueness parity with Supabase. Existing
        // databases predate these constraints (CREATE TABLE IF NOT EXISTS won't
        // add them), so add each missing UNIQUE key idempotently. The helper
        // checks INFORMATION_SCHEMA.STATISTICS for the named index and, before
        // adding it, re-checks for duplicate rows. table/index/column names
        // below are fixed literals (no user input), so interpolating them into
        // the DDL is safe.
        //
        // Strict mode (NODE_ENV=production, or SEED_STRICT_CONSTRAINTS=true/1):
        // a duplicate that would block a constraint is a HARD STOP — the helper
        // throws a sanitized error so the seed exits nonzero, forcing duplicate
        // identity data to be resolved before a deployment. When strict mode is
        // OFF (the local/dev default) the helper preserves the non-destructive
        // warning-and-skip behavior so seeding stays idempotent for developers.
        const STRICT_CONSTRAINTS =
            process.env.NODE_ENV === 'production'
            || process.env.SEED_STRICT_CONSTRAINTS === 'true'
            || process.env.SEED_STRICT_CONSTRAINTS === '1';
        console.log(`  Constraint mode: ${STRICT_CONSTRAINTS ? 'STRICT (duplicates fail the seed)' : 'lenient (duplicates skip with a warning)'}.`);

        async function ensureUniqueKey(table, indexName, columnsSql, dupCheckSql) {
            const [idx] = await connection.query(
                `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
                  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
                [table, indexName]
            );
            if (idx.length > 0) {
                console.log(`  Unique key ${indexName} on ${table} already present.`);
                return;
            }
            const [dups] = await connection.query(dupCheckSql);
            if (dups.length > 0) {
                if (STRICT_CONSTRAINTS) {
                    // Sanitized hard stop: name the table/index only — never the
                    // duplicate row values, emails, OAuth subjects, or raw SQL.
                    const err = new Error(
                        `Strict constraint check failed: duplicate rows block unique key ${indexName} on ${table}. ` +
                        'Resolve the duplicate identity/profile rows before deploying, then re-run.'
                    );
                    err.sanitized = true;
                    throw err;
                }
                console.warn(`  SKIPPED ${indexName} on ${table}: ${dups.length} duplicate group(s) exist. Resolve manually, then re-run seed.`);
                return;
            }
            await connection.query(`ALTER TABLE ${table} ADD UNIQUE KEY ${indexName} (${columnsSql})`);
            console.log(`  Added unique key ${indexName} on ${table}.`);
        }

        await ensureUniqueKey(
            'student_profiles', 'uq_student_profiles_user_id', 'user_id',
            'SELECT user_id FROM student_profiles GROUP BY user_id HAVING COUNT(*) > 1'
        );
        await ensureUniqueKey(
            'instructor_profiles', 'uq_instructor_profiles_user_id', 'user_id',
            'SELECT user_id FROM instructor_profiles GROUP BY user_id HAVING COUNT(*) > 1'
        );
        await ensureUniqueKey(
            'guest_profiles', 'uq_guest_profiles_user_id', 'user_id',
            'SELECT user_id FROM guest_profiles GROUP BY user_id HAVING COUNT(*) > 1'
        );
        await ensureUniqueKey(
            'users', 'uq_users_oauth_provider_subject', 'oauth_provider, oauth_subject',
            "SELECT oauth_provider, oauth_subject FROM users WHERE oauth_subject IS NOT NULL " +
            'GROUP BY oauth_provider, oauth_subject HAVING COUNT(*) > 1'
        );

        // ---- Performance indexes (Milestone 8, Section 8.8 follow-up) ----
        // Bring existing MySQL databases up to the schema.sql / Supabase index
        // parity for the order/filter read paths surfaced by the DB perf gate.
        // CREATE TABLE IF NOT EXISTS does not add new KEYs to a table that
        // already exists, so add each missing NON-UNIQUE index idempotently.
        // Additive, non-destructive, and safe to re-run. table/index/column
        // names are fixed literals (no user input), so interpolating them into
        // the DDL is safe.
        const perfIndexAdded = [];
        const perfIndexPresent = [];
        async function ensureIndex(table, indexName, columnsSql) {
            const [idx] = await connection.query(
                `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
                  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
                [table, indexName]
            );
            if (idx.length > 0) { perfIndexPresent.push(indexName); return; }
            await connection.query(`ALTER TABLE ${table} ADD INDEX ${indexName} (${columnsSql})`);
            perfIndexAdded.push(indexName);
        }

        const PERF_INDEXES = [
            ['users', 'idx_users_created_at', 'created_at'],
            ['users', 'idx_users_updated_at', 'updated_at'],
            ['users', 'idx_users_role', 'role'],
            ['news_announcements', 'idx_news_audience_published', 'audience, published_date'],
            ['news_announcements', 'idx_news_published_date', 'published_date'],
            ['news_announcements', 'idx_news_created_at', 'created_at'],
            ['events', 'idx_events_event_date', 'event_date'],
            ['faqs', 'idx_faqs_display_order', 'display_order, id'],
            ['campus_route_steps', 'idx_route_steps_route_order', 'route_id, step_order'],
            ['route_nodes', 'idx_route_nodes_display_order', 'display_order, id'],
            ['vr_scenes', 'idx_vr_scenes_display_order', 'display_order, id'],
            ['vr_hotspots', 'idx_vr_hotspots_scene_display', 'scene_id, display_order, id'],
            // Milestone 11 (room scheduling): fresh installs get these from the
            // CREATE TABLE in schema.sql; the ensure covers pre-existing DBs.
            ['room_schedules', 'idx_room_schedules_building_date', 'building_id, schedule_date'],
            ['room_schedules', 'idx_room_schedules_schedule_date', 'schedule_date'],
            ['room_schedule_documents', 'idx_room_schedule_documents_building_term', 'building_id, semester, school_year'],
        ];
        for (const [t, i, c] of PERF_INDEXES) {
            await ensureIndex(t, i, c);
        }
        console.log(
            `  Performance indexes: ${perfIndexAdded.length} added` +
            (perfIndexAdded.length ? ` (${perfIndexAdded.join(', ')})` : '') +
            `, ${perfIndexPresent.length} already present.`
        );

        // ---- Cloudinary media metadata parity (Milestone 10, Section 10.3) ----
        // Add the nullable media-metadata columns to MySQL so buildings and VR
        // scenes can carry Cloudinary delivery references consistently with
        // Supabase (0001 already defines these columns). CREATE TABLE IF NOT
        // EXISTS does not add columns to a table that already exists, so add each
        // missing column idempotently. Additive and non-destructive: existing
        // rows get NULL, and every read path already tolerates a NULL
        // cloudinary_public_id. table/column/definition are fixed literals (no
        // user input), so interpolating them into the DDL is safe.
        async function ensureColumn(table, column, definition) {
            const [col] = await connection.query(
                `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
                [table, column]
            );
            if (col.length > 0) {
                console.log(`  Column ${table}.${column} already present.`);
                return;
            }
            await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
            console.log(`  Added column ${table}.${column}.`);
        }

        async function ensureForeignKey(table, constraintName, ddl) {
            const [fk] = await connection.query(
                `SELECT 1 FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                  WHERE CONSTRAINT_SCHEMA = DATABASE()
                    AND TABLE_NAME = ?
                    AND CONSTRAINT_NAME = ?
                    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
                  LIMIT 1`,
                [table, constraintName]
            );
            if (fk.length > 0) {
                console.log(`  Foreign key ${constraintName} already present.`);
                return;
            }
            await connection.query(`ALTER TABLE ${table} ADD CONSTRAINT ${constraintName} ${ddl}`);
            console.log(`  Added foreign key ${constraintName}.`);
        }

        await ensureColumn('buildings', 'image_url', 'VARCHAR(255) NULL AFTER details');
        await ensureColumn('buildings', 'cloudinary_public_id', 'VARCHAR(255) NULL AFTER image_url');
        await ensureColumn('vr_scenes', 'cloudinary_public_id', 'VARCHAR(255) NULL AFTER image_url');

        // ---- VR hotspot schedule metadata parity (Milestone 11, Section 11.8A) ----
        // Existing MySQL databases need the nullable schedule-target columns for
        // VR room-door hotspots. Fresh installs get them from schema.sql; these
        // idempotent ALTERs keep reseed safe and do not alter existing hotspots.
        await ensureColumn('vr_hotspots', 'schedule_building_id', 'INT NULL AFTER `text`');
        await ensureColumn('vr_hotspots', 'schedule_location_type', "ENUM('room','facility') NULL AFTER schedule_building_id");
        await ensureColumn('vr_hotspots', 'schedule_location_label', 'VARCHAR(120) NULL AFTER schedule_location_type');
        await ensureColumn('vr_hotspots', 'schedule_floor_label', 'VARCHAR(80) NULL AFTER schedule_location_label');
        await ensureColumn('vr_hotspots', 'schedule_document_id', 'INT NULL AFTER schedule_floor_label');

        // ---- Route edge drawing geometry (Pre-Milestone-12 RF.2) ----
        // Existing MySQL databases need the nullable path_geometry column for
        // road-following route drawing. Fresh installs get it from schema.sql.
        await ensureColumn('route_edges', 'path_geometry', 'JSON NULL AFTER is_accessible');
        await ensureIndex(
            'vr_hotspots',
            'idx_vr_hotspots_schedule_target',
            'schedule_building_id, schedule_location_type, schedule_location_label'
        );
        await ensureIndex(
            'vr_hotspots',
            'idx_vr_hotspots_schedule_document',
            'schedule_document_id'
        );
        await ensureForeignKey(
            'vr_hotspots',
            'fk_vr_hotspots_schedule_building',
            'FOREIGN KEY (schedule_building_id) REFERENCES buildings(id) ON DELETE SET NULL'
        );
        await ensureForeignKey(
            'vr_hotspots',
            'fk_vr_hotspots_schedule_document',
            'FOREIGN KEY (schedule_document_id) REFERENCES room_schedule_documents(id) ON DELETE RESTRICT'
        );

        console.log('Seeding System Settings...');
        const settings = [
            ['school_name', data.school.name],
            ['school_acronym', data.school.acronym],
            ['school_address', data.school.address],
            ['school_founded', data.school.founded.toString()],
            ['school_description', data.school.description],
            ['contact_address', data.contact.address],
            ['contact_phone', data.contact.phone],
            ['contact_email', data.contact.email],
            ['contact_website', data.contact.website],
            ['contact_hours', data.contact.hours]
        ];
        
        // Canonical upsert: setting_key is the PRIMARY KEY, so re-running
        // refreshes the value for seeded keys (correcting stale values from an
        // earlier seed) while leaving any admin-added keys untouched.
        for (const [key, val] of settings) {
            await connection.query(
                'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
                [key, val]
            );
        }

        console.log('Seeding FAQs...');
        // Canonical FAQ set describing functionality the app actually provides.
        // Upsert by exact question text (faqs has no UNIQUE on question): refresh
        // canonical rows, insert missing ones, never duplicate on re-run, and
        // leave any admin-created / unrelated FAQs untouched.
        const canonicalFaqs = [
            {
                question: 'How do I open the campus map?',
                answer: 'Sign in to CampuSphere, then choose Campus Map from the navigation. The interactive map opens for signed-in students, instructors, guests, and admins.',
                category: 'Campus Map',
                display_order: 1
            },
            {
                question: 'How do I find a building, office, or service?',
                answer: 'Use Campus Map search to find buildings, offices, services, categories, landmarks, or routes. On the Buildings page, search by building name or description and use the category filters. Select a result to open its details.',
                category: 'Campus Map',
                display_order: 2
            },
            {
                question: 'How do I get walking directions to a building?',
                answer: 'Open a building on the Campus Map and set it as your destination. If a predefined route is available, CampuSphere shows its ordered walking directions from the Main Gate; otherwise it clearly reports that no predefined route is available yet.',
                category: 'Navigation',
                display_order: 3
            },
            {
                question: 'How do I start a guided VR route?',
                answer: 'Buildings linked to an available guided VR route show a Start VR Route button on the Campus Map and Buildings pages. Select it to open the guided VR tour, then use the on-screen points to move between scenes. Scenes without an uploaded panorama display a readable fallback instead of a broken viewer.',
                category: 'VR Tour',
                display_order: 4
            },
            {
                question: 'Can I use CampuSphere offline?',
                answer: 'Download the Offline Campus Guide from the signed-in Campus Map while you are online. The package contains the 2D campus map, Main Gate routes, and text building details. It does not include Guided VR, Free Roam, schedules, or building photos. Sign-in and live updates still require internet.',
                category: 'Offline Access',
                display_order: 5
            },
            {
                question: 'How do I update my profile information?',
                answer: 'Open Update Profile from your dashboard to edit your name and role-specific details. For security, your email address and account role cannot be changed from this form.',
                category: 'Account',
                display_order: 6
            }
        ];
        for (const faq of canonicalFaqs) {
            const [faqRows] = await connection.query('SELECT id FROM faqs WHERE question = ?', [faq.question]);
            if (faqRows.length === 0) {
                await connection.query(
                    'INSERT INTO faqs (question, answer, category, display_order) VALUES (?, ?, ?, ?)',
                    [faq.question, faq.answer, faq.category, faq.display_order]
                );
            } else {
                await connection.query(
                    'UPDATE faqs SET answer = ?, category = ?, display_order = ? WHERE question = ?',
                    [faq.answer, faq.category, faq.display_order, faq.question]
                );
            }
        }

        console.log('Seeding Default Admin User...');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const [userResult] = await connection.query(`
            INSERT IGNORE INTO users (username, email, password, role, first_name, last_name)
            VALUES ('admin', 'admin@cspc.edu.ph', ?, 'admin', 'System', 'Admin')
        `, [hashedPassword]);

        console.log('Seeding Sample Student Profile...');
        const studentHashedPass = await bcrypt.hash('student123', 10);
        const [studentResult] = await connection.query(`
            INSERT IGNORE INTO users (username, email, password, role, first_name, last_name)
            VALUES ('aaron.lasprillas', 'aaron.lasprillas@cspc.edu.ph', ?, 'student-cspc', 'Aaron', 'Lasprillas')
        `, [studentHashedPass]);

        // If a new student was inserted, add the profile
        if (studentResult.insertId) {
            await connection.query(`
                INSERT INTO student_profiles 
                (user_id, student_id_number, course, year_level, enrollment_status, semester)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                studentResult.insertId,
                data.studentProfile.studentId,
                data.studentProfile.course,
                data.studentProfile.yearLevel,
                data.studentProfile.enrollmentStatus,
                data.studentProfile.semester
            ]);
        }

        console.log('Seeding News/Announcements...');
        for (const newsItem of data.news) {
            // Check if exists first to avoid duplicates since no unique constraint on title
            const [rows] = await connection.query('SELECT id FROM news_announcements WHERE title = ?', [newsItem.title]);
            if (rows.length === 0) {
                // We format the date string to a proper datetime or pass it to DATE() function in mysql if valid
                const parsedDate = new Date(newsItem.date);
                await connection.query(`
                    INSERT INTO news_announcements (title, category, excerpt, content, published_date, audience)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [newsItem.title, newsItem.category, newsItem.excerpt, newsItem.excerpt, parsedDate, newsItem.audience || 'all']);
            }
        }

        // Role-targeted demo announcements (Milestone 4 - audience targeting).
        // Categories use the standardized set: General/Academic/Event/Advisory/Maintenance/Emergency.
        console.log('Seeding Role-Targeted Announcements...');
        const targetedAnnouncements = [
            {
                title: 'Faculty General Assembly - Curriculum Review',
                category: 'Advisory',
                excerpt: 'All instructors are requested to attend the General Assembly for the semester curriculum review and updated academic policies.',
                date: 'May 5, 2026',
                audience: 'instructor'
            },
            {
                title: 'Faculty Development Workshop: Outcomes-Based Teaching',
                category: 'Academic',
                excerpt: 'A workshop on outcomes-based teaching strategies will be held at the SAC Conference Room. Slots are limited, please confirm attendance early.',
                date: 'May 12, 2026',
                audience: 'instructor'
            },
            {
                title: 'Student Organization Accreditation Renewal',
                category: 'Advisory',
                excerpt: 'Recognized student organizations must renew their accreditation at the Office of Student Affairs before the posted deadline.',
                date: 'May 8, 2026',
                audience: 'student-cspc'
            },
            {
                title: 'Campus Visitor Guidelines for Guests',
                category: 'General',
                excerpt: 'Visitors and guests must present a valid ID at the Main Gate and secure a visitor pass from the guard on duty.',
                date: 'May 3, 2026',
                audience: 'guest'
            }
        ];

        for (const ann of targetedAnnouncements) {
            const [rows] = await connection.query('SELECT id FROM news_announcements WHERE title = ?', [ann.title]);
            if (rows.length === 0) {
                const parsedDate = new Date(ann.date);
                await connection.query(`
                    INSERT INTO news_announcements (title, category, excerpt, content, published_date, audience)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [ann.title, ann.category, ann.excerpt, ann.excerpt, parsedDate, ann.audience]);
            }
        }

        console.log('Seeding Buildings...');
        for (const bldg of data.buildings) {
            const details = {
                guestAccess: bldg.guestAccess,
                img: bldg.img,
                routes: bldg.routes,
                walkTime: bldg.walkTime,
                landmarks: bldg.landmarks,
                floors: bldg.floors,
                entrances: bldg.entrances,
                info: bldg.info
            };
            const detailsJson = JSON.stringify(details);

            const [rows] = await connection.query('SELECT id FROM buildings WHERE name = ?', [bldg.name]);
            if (rows.length === 0) {
                // New row: seed coordinates from models/data.js.
                await connection.query(`
                    INSERT INTO buildings (name, category, description, lat, lng, details)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [bldg.name, bldg.category, bldg.desc, bldg.lat, bldg.lng, detailsJson]);
            } else {
                // Existing row: refresh category/description/details only.
                // lat/lng are preserved because admins may nudge map marker positions
                // directly in the database; reseeding must not stomp those adjustments.
                await connection.query(`
                    UPDATE buildings
                       SET category = ?, description = ?, details = ?
                     WHERE id = ?
                `, [bldg.category, bldg.desc, detailsJson, rows[0].id]);
            }
        }

        // Cloudinary media parity (Milestone 10, Section 10.3): backfill
        // buildings.image_url from details.img where it is still empty, matching
        // Supabase 0002/0004 (which seed image_url from each building's img).
        // Runs AFTER the building upserts so freshly seeded rows are covered too.
        // Idempotent: only fills NULL/blank image_url, never overwrites an
        // existing value, and leaves details intact. cloudinary_public_id stays
        // NULL by default (no admin/runtime writer until later Milestone 10 work).
        const [imageBackfill] = await connection.query(
            `UPDATE buildings
                SET image_url = JSON_UNQUOTE(JSON_EXTRACT(details, '$.img'))
              WHERE (image_url IS NULL OR image_url = '')
                AND details IS NOT NULL
                AND JSON_VALID(details)
                AND JSON_UNQUOTE(JSON_EXTRACT(details, '$.img')) IS NOT NULL
                AND JSON_UNQUOTE(JSON_EXTRACT(details, '$.img')) <> ''`
        );
        console.log(`  Backfilled buildings.image_url from details.img: ${imageBackfill.affectedRows} row(s) updated.`);

        console.log('Seeding Campus Routes...');
        const routeDefinitions = [
            {
                title: 'Main Gate to Administration Building',
                startLabel: 'Main Gate',
                destinationName: 'Administration Building',
                walkTime: '5-7 minutes',
                steps: [
                    { instruction: 'Enter through the Main Gate and walk straight along the main pathway.', landmark: 'CSPC Welcome Arch' },
                    { instruction: 'Continue past the flagpole quadrangle on your left.', landmark: 'Flagpole Quadrangle' },
                    { instruction: 'Turn right at the intersection near the central bulletin board.', landmark: 'Central Bulletin Board' },
                    { instruction: 'The Administration Building entrance is on your left. The Registrar is on the ground floor.', landmark: 'Administration Building Lobby' }
                ]
            },
            {
                title: 'Main Gate to CCS Building',
                startLabel: 'Main Gate',
                destinationName: 'College of Computer Studies (CCS)',
                walkTime: '6-8 minutes',
                steps: [
                    { instruction: 'Enter through the Main Gate and follow the main pathway forward.', landmark: 'CSPC Welcome Arch' },
                    { instruction: 'At the first intersection, turn left toward the academic complex.', landmark: 'Flagpole Quadrangle' },
                    { instruction: 'Pass the Main Academic Building on your right.', landmark: 'Main Academic Building' },
                    { instruction: 'The College of Computer Studies (CCS) is the next structure on your left.', landmark: 'CCS Building Entrance' }
                ]
            },
            {
                title: 'Main Gate to Library Building',
                startLabel: 'Main Gate',
                destinationName: 'Library Building',
                walkTime: '5-7 minutes',
                steps: [
                    { instruction: 'Enter through the Main Gate and walk straight along the main pathway.', landmark: 'CSPC Welcome Arch' },
                    { instruction: 'Continue past the flagpole quadrangle.', landmark: 'Flagpole Quadrangle' },
                    { instruction: 'Take the left fork at the central pathway split.', landmark: 'Central Pathway Split' },
                    { instruction: 'The Library Building entrance is straight ahead.', landmark: 'Library Entrance' }
                ]
            },
            {
                title: 'Main Gate to Gymnasium',
                startLabel: 'Main Gate',
                destinationName: 'Gymnasium',
                walkTime: '7-10 minutes',
                steps: [
                    { instruction: 'Enter through the Main Gate and walk straight along the main pathway.', landmark: 'CSPC Welcome Arch' },
                    { instruction: 'Pass the flagpole quadrangle on your right.', landmark: 'Flagpole Quadrangle' },
                    { instruction: 'Continue past the Engineering Building.', landmark: 'Engineering Building' },
                    { instruction: 'The Gymnasium is the large open structure at the end of the pathway.', landmark: 'Gymnasium Main Entrance' }
                ]
            }
        ];

        for (const route of routeDefinitions) {
            const [bldgRows] = await connection.query('SELECT id FROM buildings WHERE name = ?', [route.destinationName]);
            if (bldgRows.length === 0) {
                console.warn(`  Skipping route "${route.title}": destination building "${route.destinationName}" not found.`);
                continue;
            }
            const destinationId = bldgRows[0].id;

            const [existing] = await connection.query('SELECT id FROM campus_routes WHERE title = ?', [route.title]);
            if (existing.length > 0) continue;

            const [insertResult] = await connection.query(`
                INSERT INTO campus_routes (title, start_label, destination_building_id, estimated_walk_time)
                VALUES (?, ?, ?, ?)
            `, [route.title, route.startLabel, destinationId, route.walkTime]);

            const routeId = insertResult.insertId;
            for (let i = 0; i < route.steps.length; i++) {
                const step = route.steps[i];
                await connection.query(`
                    INSERT INTO campus_route_steps (route_id, step_order, instruction, landmark, lat, lng)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [routeId, i + 1, step.instruction, step.landmark || null, step.lat || null, step.lng || null]);
            }
        }

        // ---- Route graph for Dijkstra pathfinding (Milestone 5) ----
        // Idempotent UPSERT: nodes are keyed by node_key, edges by the
        // (from_node_id, to_node_id) pair. Re-running seed.js INSERTs missing
        // rows and REFRESHES existing ones, so changes to labels, node types,
        // building links, coordinates, distances, walk times, path labels,
        // and accessibility take effect on every re-seed. Building-backed
        // nodes re-read buildings.lat/lng on each run, so the graph stays
        // aligned with admin marker adjustments on every re-seed (not only
        // on first insert).
        // BIDIRECTIONAL DECISION: every walkable connection is inserted as
        // TWO directed rows (A->B and B->A). The future Dijkstra helper can
        // therefore read route_edges as a plain directed graph with no
        // special-casing. This does not touch campus_routes/campus_route_steps.
        console.log('Seeding Route Graph (nodes + edges)...');

        // Pull live building coordinates so building-backed nodes stay in
        // sync with any admin-adjusted marker positions. buildings.lat/lng
        // is only READ here, never modified.
        const [graphBldgRows] = await connection.query(
            'SELECT id, name, lat, lng FROM buildings'
        );
        // BE.2 FAIL-CLOSED CANONICAL NAME RESOLUTION.
        //
        // Every building-backed route node must map to EXACTLY ONE buildings row.
        // The previous `bldgByName.get(name) || null` was silently lossy in two
        // ways, and both produced a graph that looked fine but was wrong:
        //
        //   * MISSING name  -> node seeded with building_id NULL. That building
        //     then has no destination node, so pathfind reports "no route node
        //     maps to building id N" and the destination is silently unroutable.
        //     This is exactly how the College of Arts and Sciences regressed.
        //   * DUPLICATE name -> Map.set kept only the LAST row, so the node could
        //     bind to an arbitrary duplicate.
        //
        // Both now abort the seed with a FIXED, SANITIZED message. Only canonical
        // names from this repository's own static roster are echoed — never a row
        // value, id, coordinate, connection string, or driver/SQL error text.
        const bldgRowsByName = new Map();
        for (const r of graphBldgRows) {
            if (!bldgRowsByName.has(r.name)) bldgRowsByName.set(r.name, []);
            bldgRowsByName.get(r.name).push(r);
        }

        const CANONICAL_BUILDING_NAMES = [
            'Administration Building',
            'College of Computer Studies (CCS)',
            'Library Building',
            'Gymnasium',
            'College of Arts and Sciences',
            'College of Health Sciences (CHS)',
            'Green Building',
            'Canteen / Cafeteria',
            'Information and Communications Technology Unit (ICTU)',
            'Medical & Dental Clinic',
            'Auditorium',
            'Main Academic Building',
            'Engineering Building'
        ];

        // The expanded Guided-VR catalog identifies the legacy `ccs` route
        // node as Academic Building IV. Keep the minimal 13-building seed
        // usable by falling back to the original CCS row when that optional
        // expanded-catalog building is absent, but fail closed if the
        // optional natural identity is duplicated.
        const EXPANDED_CCS_BUILDING_NAME = 'Academic Building IV';
        const expandedCcsRows = bldgRowsByName.get(EXPANDED_CCS_BUILDING_NAME) || [];

        // Preflight the WHOLE canonical set so one run reports every problem,
        // rather than aborting on the first missing name and hiding the rest.
        const missingNames = [];
        const duplicateNames = [];
        for (const name of CANONICAL_BUILDING_NAMES) {
            const n = (bldgRowsByName.get(name) || []).length;
            if (n === 0) missingNames.push(name);
            else if (n > 1) duplicateNames.push(name);
        }
        if (expandedCcsRows.length > 1) duplicateNames.push(EXPANDED_CCS_BUILDING_NAME);
        if (missingNames.length > 0 || duplicateNames.length > 0) {
            const parts = [];
            if (missingNames.length > 0) {
                parts.push(`missing from the buildings table: ${missingNames.join(', ')}`);
            }
            if (duplicateNames.length > 0) {
                parts.push(`duplicated in the buildings table: ${duplicateNames.join(', ')}`);
            }
            throw new Error(
                'Seed aborted before seeding the route graph. Every building-backed route node ' +
                'must resolve to exactly one canonical building, but the following canonical ' +
                `building name(s) did not — ${parts.join('; ')}. ` +
                'No route node was created with a NULL building_id. Fix the buildings table (or ' +
                'models/data.js) and re-run; nothing in the route graph was modified.'
            );
        }

        function requireBuilding(name) {
            const rows = bldgRowsByName.get(name) || [];
            // Unreachable after the preflight above; kept as a hard backstop so a
            // future edit cannot reintroduce a silent NULL building_id.
            if (rows.length !== 1) {
                throw new Error(
                    `Seed aborted: canonical building "${name}" must resolve to exactly one ` +
                    'buildings row. Refusing to seed a building-backed route node with a NULL building_id.'
                );
            }
            return rows[0];
        }

        const adminBldg    = requireBuilding('Administration Building');
        const ccsBldg      = expandedCcsRows.length === 1
            ? expandedCcsRows[0]
            : requireBuilding('College of Computer Studies (CCS)');
        const libraryBldg  = requireBuilding('Library Building');
        const gymBldg      = requireBuilding('Gymnasium');
        const casBldg      = requireBuilding('College of Arts and Sciences');
        const chsBldg      = requireBuilding('College of Health Sciences (CHS)');
        const greenBldg    = requireBuilding('Green Building');
        const canteenBldg  = requireBuilding('Canteen / Cafeteria');
        const ictuBldg     = requireBuilding('Information and Communications Technology Unit (ICTU)');
        const clinicBldg   = requireBuilding('Medical & Dental Clinic');
        const audBldg      = requireBuilding('Auditorium');
        const mainAcadBldg = requireBuilding('Main Academic Building');
        const engBldg      = requireBuilding('Engineering Building');

        // Non-building nodes (gate / arch / flagpole and the walkway
        // junctions) use reasonable ESTIMATED campus coordinates near the
        // seeded route landmarks. These are demo placements, not survey
        // data, and can be refined later. Building-backed nodes resolve by
        // name so they survive id drift; a missing or duplicated canonical
        // name now ABORTS the seed (see the fail-closed preflight above)
        // instead of quietly seeding a node with a NULL building_id.
        //
        // Pre-Milestone-12 route accuracy repair: the graph now follows the
        // campus walkway spine east (flagpole -> gymnasium -> mid-campus
        // junction -> Green Building -> CAS -> CCS/Clinic -> CHS) and the
        // west campus road (main-gate -> west-road junction -> Engineering /
        // Main Academic), instead of long straight-line shortcut edges. The
        // 'clinic' node now maps to the real Medical & Dental Clinic
        // building on the east side; the old mid-campus coordinate it used
        // to sit on became the 'mid-campus' walkway junction.
        const routeNodes = [
            // Authoritative Guard House / Main Gate position (owner-approved).
            // Full-precision value 13.40575220764974, 123.37434735272177; both
            // backends store lat/lng as 8-dp DECIMAL/numeric, so the persisted
            // value is the 8-dp form below (within 2.4e-9 of the authoritative
            // coordinate — far inside the 1e-6 endpoint epsilon). Seeding the
            // 8-dp form keeps MySQL and Supabase migration 0017 bit-identical.
            // The stable node_key stays 'main-gate'; the owner-approved public
            // label names both the physical Guard House and the route role.
            { key: 'main-gate',      label: 'Guard House / Main Gate',          type: 'gate',     b: null,        lat: 13.40575221, lng: 123.37434735, order: 1 },
            { key: 'welcome-arch',   label: 'CSPC Welcome Arch',                type: 'walkway',  b: null,        lat: 13.40540, lng: 123.37400, order: 2 },
            { key: 'flagpole',       label: 'Flagpole Quadrangle',              type: 'walkway',  b: null,        lat: 13.40575, lng: 123.37455, order: 3 },
            { key: 'admin-building', label: 'Administration Building',          type: 'building', b: adminBldg,   lat: 13.40613, lng: 123.37441, order: 4 },
            { key: 'registrar',      label: "Registrar's Office",               type: 'service',  b: adminBldg,   lat: 13.40613, lng: 123.37441, order: 5 },
            { key: 'ccs',            label: 'College of Computer Studies (CCS)',type: 'building', b: ccsBldg,     lat: 13.40565, lng: 123.37710, order: 6 },
            { key: 'library',        label: 'Library Building',                 type: 'building', b: libraryBldg, lat: 13.40630, lng: 123.37525, order: 7 },
            { key: 'gymnasium',      label: 'Gymnasium',                        type: 'building', b: gymBldg,     lat: 13.40585, lng: 123.37522, order: 8 },
            { key: 'clinic',         label: 'Medical & Dental Clinic',          type: 'building', b: clinicBldg,  lat: 13.40616, lng: 123.37717, order: 9 },
            { key: 'ictu',           label: 'ICT Unit (ICTU)',                  type: 'building', b: ictuBldg,    lat: 13.40558, lng: 123.37471, order: 10 },
            { key: 'canteen',        label: 'Canteen / Cafeteria',              type: 'building', b: canteenBldg, lat: 13.40625, lng: 123.37515, order: 11 },
            { key: 'auditorium',     label: 'Auditorium',                       type: 'building', b: audBldg,     lat: 13.40630, lng: 123.37560, order: 12 },
            { key: 'mid-campus',     label: 'Mid-Campus Road Junction',         type: 'walkway',  b: null,        lat: 13.40561, lng: 123.37561, order: 13 },
            { key: 'east-walk',      label: 'East Corridor Junction',           type: 'walkway',  b: null,        lat: 13.40577, lng: 123.37645, order: 14 },
            { key: 'green-building', label: 'Green Building',                   type: 'building', b: greenBldg,   lat: 13.40600, lng: 123.37652, order: 15 },
            { key: 'cas',            label: 'College of Arts and Sciences',     type: 'building', b: casBldg,     lat: 13.40594916, lng: 123.37704274, order: 16 },
            { key: 'chs',            label: 'College of Health Sciences (CHS)', type: 'building', b: chsBldg,     lat: 13.40539, lng: 123.37750, order: 17 },
            { key: 'west-road',      label: 'West Campus Road Junction',        type: 'walkway',  b: null,        lat: 13.40540, lng: 123.37367, order: 18 },
            { key: 'main-academic',  label: 'Main Academic Building',           type: 'building', b: mainAcadBldg,lat: 13.40580, lng: 123.37370, order: 19 },
            { key: 'engineering',    label: 'Engineering Building',             type: 'building', b: engBldg,     lat: 13.40560, lng: 123.37340, order: 20 }
        ];

        for (const n of routeNodes) {
            // When a node maps to a building, prefer the building's live
            // coordinates so the graph follows admin marker adjustments.
            const lat = n.b ? n.b.lat : n.lat;
            const lng = n.b ? n.b.lng : n.lng;
            const buildingId = n.b ? n.b.id : null;
            const [existsNode] = await connection.query(
                'SELECT id FROM route_nodes WHERE node_key = ?', [n.key]
            );
            if (existsNode.length === 0) {
                await connection.query(`
                    INSERT INTO route_nodes
                    (node_key, label, node_type, building_id, lat, lng, display_order)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [n.key, n.label, n.type, buildingId, lat, lng, n.order]);
            } else {
                // Refresh existing node so label, type, building link,
                // coordinates, and order track the latest definitions.
                await connection.query(`
                    UPDATE route_nodes
                       SET label = ?, node_type = ?, building_id = ?,
                           lat = ?, lng = ?, display_order = ?
                     WHERE node_key = ?
                `, [n.label, n.type, buildingId, lat, lng, n.order, n.key]);
            }
        }

        // Re-read node ids AND stored coordinates by key for edge wiring
        // (avoids hardcoded ids; geometry endpoints use the exact stored
        // node values, so endpoint continuity holds by construction).
        const [graphNodeRows] = await connection.query(
            'SELECT id, node_key, lat, lng FROM route_nodes'
        );
        const nodeIdByKey = new Map(graphNodeRows.map(r => [r.node_key, r.id]));
        const nodeGeoByKey = new Map(graphNodeRows.map(r => [r.node_key, { lat: r.lat, lng: r.lng }]));

        // Undirected walkable connections. Each becomes TWO directed rows.
        // Distances are haversine meters between the node coordinates
        // (rounded); walk times assume ~1.2 m/s, matching the original rows.
        //
        // RF.2 drawing geometry: `w` lists the INTERMEDIATE forward (a -> b)
        // waypoints only — the full stored path_geometry is built as
        // exact live a-node coordinate + w + exact live b-node coordinate,
        // and the reverse row mechanically stores the exact reversed
        // sequence (utils/routeGeometry.js). Waypoints are owner-managed
        // traces of the OpenStreetMap campus service roads/walkways already
        // displayed under the app's existing OSM attribution; short
        // genuinely straight connections carry only their endpoints
        // (w: []). No waypoint crosses mapped buildings, grass, or
        // restricted areas.
        // Pre-RF.6 scalar convention for edges this repair rebuilds (`d: true`):
        // distance = haversine metres summed along the COMPLETED traced shape
        // (rounded), walk time = distance / 1.2 m/s (rounded) — the project's
        // established haversine + ~1.2 m/s convention, applied to the polyline
        // the map actually draws rather than the straight node-to-node chord.
        // Edges untouched by this repair keep their existing hand-set values.
        const EARTH_RADIUS_M = 6371000;
        function haversineMeters(p, q) {
            const toRad = (d) => (d * Math.PI) / 180;
            const dLat = toRad(q.lat - p.lat);
            const dLng = toRad(q.lng - p.lng);
            const h = Math.sin(dLat / 2) ** 2 +
                Math.cos(toRad(p.lat)) * Math.cos(toRad(q.lat)) * Math.sin(dLng / 2) ** 2;
            return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
        }
        function polylineMeters(points) {
            let total = 0;
            for (let i = 1; i < points.length; i++) total += haversineMeters(points[i - 1], points[i]);
            return Math.round(total);
        }
        function walkSeconds(meters) {
            return Math.round(meters / 1.2);
        }

        const edgeDefs = [
            // Guard House / Main Gate approach, rebuilt for the authoritative
            // gate coordinate: the forward shape starts at the exact new
            // main-gate node value and the reverse row stores its exact
            // reversal. Scalars are derived from the completed geometry
            // (d: true — see polylineMeters below).
            { a: 'main-gate',      b: 'welcome-arch',   m: 0,   s: 0,   label: 'Main pathway', d: true,
              w: [{ lat: 13.40559, lng: 123.37419 }] },
            // NO-GO V2 fix 1 (Guard House hairpin): the authoritative gate sits
            // ~22 m due west of the Flagpole Quadrangle, but the only way in was
            // main-gate -> welcome-arch -> flagpole, which walked ~125 m
            // SOUTH-WEST and then doubled back NORTH-EAST. This direct gate
            // entrance walkway is now the selected shortest path for every
            // central/eastern destination; welcome-arch stays a reachable node.
            { a: 'main-gate',      b: 'flagpole',       m: 0,   s: 0,   label: 'Main gate entrance walkway', d: true,
              w: [{ lat: 13.40576, lng: 123.37445 }] },
            { a: 'welcome-arch',   b: 'flagpole',       m: 71,  s: 59,  label: 'Main pathway',
              w: [{ lat: 13.40557, lng: 123.37430 }] },
            { a: 'flagpole',       b: 'admin-building', m: 45,  s: 38,  label: 'Quadrangle to Administration', w: [] },
            { a: 'admin-building', b: 'registrar',      m: 15,  s: 15,  label: 'Ground floor - Registrar',     w: [] },
            { a: 'flagpole',       b: 'library',        m: 97,  s: 81,  label: 'Central pathway to Library',
              w: [{ lat: 13.40590, lng: 123.37478 }, { lat: 13.40617, lng: 123.37482 },
                  { lat: 13.40620, lng: 123.37492 }, { lat: 13.40621, lng: 123.37498 }] },
            { a: 'flagpole',       b: 'gymnasium',      m: 73,  s: 61,  label: 'Pathway to Gymnasium',
              w: [{ lat: 13.40572, lng: 123.37490 }] },
            { a: 'library',        b: 'gymnasium',      m: 50,  s: 42,  label: 'Facilities walkway',           w: [] },
            { a: 'admin-building', b: 'library',        m: 93,  s: 78,  label: 'Admin to Library walkway',
              w: [{ lat: 13.40617, lng: 123.37482 }, { lat: 13.40619, lng: 123.37487 },
                  { lat: 13.40620, lng: 123.37492 }, { lat: 13.40621, lng: 123.37498 }] },
            // East academic-complex spine following the OSM-mapped campus
            // service roads (replaces the retired flagpole->ccs /
            // flagpole->clinic straight-line shortcuts): the south corridor
            // runs at ~lat 13.4056 from the ICTU side east to the Green
            // Building, with junction nodes placed on real road vertices.
            { a: 'flagpole',       b: 'ictu',           m: 26,  s: 22,  label: 'Quadrangle walkway',           w: [] },
            { a: 'gymnasium',      b: 'canteen',        m: 45,  s: 38,  label: 'Facilities walkway',           w: [] },
            { a: 'library',        b: 'canteen',        m: 12,  s: 10,  label: 'Facilities walkway',           w: [] },
            { a: 'library',        b: 'auditorium',     m: 38,  s: 32,  label: 'North campus road',            w: [] },
            // NO-GO V2 fix 2 (building-backed transit): ICTU, the Gymnasium and
            // the Auditorium are DESTINATIONS, not routing junctions, yet every
            // eastern route had to pass through one of them because they were
            // the only edges into mid-campus. Those three transit pairs are
            // retired below and replaced by this single walkway spine, which
            // runs east from the Flagpole Quadrangle to the Mid-Campus Road
            // Junction, passing NORTH of ICTU and SOUTH of the Gymnasium so it
            // clears both footprints. ICTU / Gymnasium / Auditorium stay
            // reachable as terminal destinations (flagpole<->ictu,
            // flagpole<->gymnasium, library<->auditorium are all kept).
            { a: 'flagpole',       b: 'mid-campus',     m: 0,   s: 0,   label: 'South campus road', d: true,
              w: [{ lat: 13.40573, lng: 123.37480 }, { lat: 13.40571, lng: 123.37510 },
                  { lat: 13.40567, lng: 123.37535 }] },
            { a: 'mid-campus',     b: 'east-walk',      m: 93,  s: 78,  label: 'South campus road',
              w: [{ lat: 13.40562, lng: 123.37586 }, { lat: 13.40565, lng: 123.37608 }] },
            // Eastern academic complex (Pre-RF.6 topology correction): every
            // eastern building is a TERMINAL destination reached from the East
            // Corridor Junction, never a transit hop. The corridor spine runs
            // north-south at lng ~123.37675-123.37680, between the Green
            // Building (west) and the CAS / CCS / Clinic / CHS blocks (east);
            // each building spurs off that spine perpendicular, so no trace
            // cuts a diagonal through a mapped building footprint. The old
            // green-building->cas / cas->ccs / cas->clinic / ccs->chs transit
            // hops are retired below. Scalars derive from the completed
            // geometry (d: true).
            { a: 'east-walk',      b: 'green-building', m: 27,  s: 23,  label: 'East corridor',                w: [] },
            { a: 'east-walk',      b: 'cas',            m: 0,   s: 0,   label: 'East corridor', d: true,
              w: [{ lat: 13.40583, lng: 123.37675 }, { lat: 13.40592, lng: 123.37674 }] },
            { a: 'east-walk',      b: 'ccs',            m: 0,   s: 0,   label: 'East corridor to CCS', d: true,
              w: [{ lat: 13.40583, lng: 123.37675 }, { lat: 13.40567, lng: 123.37677 },
                  { lat: 13.40566, lng: 123.37694 }] },
            { a: 'east-walk',      b: 'clinic',         m: 0,   s: 0,   label: 'East corridor to Clinic', d: true,
              w: [{ lat: 13.40583, lng: 123.37675 }, { lat: 13.40600, lng: 123.37678 },
                  { lat: 13.40614, lng: 123.37680 }, { lat: 13.40615, lng: 123.37701 }] },
            { a: 'east-walk',      b: 'chs',            m: 0,   s: 0,   label: 'East corridor to CHS', d: true,
              w: [{ lat: 13.40583, lng: 123.37675 }, { lat: 13.40567, lng: 123.37677 },
                  { lat: 13.40550, lng: 123.37685 }, { lat: 13.40546, lng: 123.37722 }] },
            // West campus entrance road (Engineering / Main Academic side);
            // the west-road junction sits on the mapped entrance-road vertex.
            { a: 'main-gate',      b: 'west-road',      m: 0,   s: 0,   label: 'West campus road', d: true,
              w: [{ lat: 13.40556, lng: 123.37410 }, { lat: 13.40545, lng: 123.37385 }] },
            { a: 'west-road',      b: 'engineering',    m: 37,  s: 31,  label: 'West campus road',             w: [] },
            { a: 'west-road',      b: 'main-academic',  m: 45,  s: 38,  label: 'West campus road',             w: [] },
            { a: 'main-academic',  b: 'flagpole',       m: 92,  s: 77,  label: 'Walkway to Quadrangle',
              w: [{ lat: 13.40578, lng: 123.37420 }, { lat: 13.40575, lng: 123.37441 }] }
        ];

        // ---- RF.2: build + validate ALL drawing geometry BEFORE any write ----
        // Forward shape = exact stored a-node coordinate + intermediate
        // waypoints + exact stored b-node coordinate; the reverse row is the
        // mechanically reversed sequence. A single invalid shape aborts the
        // seed before any geometry row is written. Raw geometry is never
        // logged — failures name only the edge pair and the fixed message.
        const edgeGeometryJsonByPair = new Map(); // 'from|to' -> JSON string
        for (const e of edgeDefs) {
            const fromGeo = nodeGeoByKey.get(e.a);
            const toGeo = nodeGeoByKey.get(e.b);
            if (!fromGeo || !toGeo) continue; // matching edge upsert skips too
            const forward = buildPathGeometry(fromGeo, e.w || [], toGeo);
            const fv = validatePathGeometry(forward, {
                fromNode: fromGeo, toNode: toGeo, allowNull: false, snapEndpoints: true
            });
            if (!fv.ok) {
                throw new Error(`Route edge geometry rejected for ${e.a} -> ${e.b}: ${fv.message}`);
            }
            // Edges rebuilt by the Pre-RF.6 repair take their distance/walk-time
            // scalars from the completed geometry (both directions share them).
            if (e.d) {
                e.m = polylineMeters(fv.value);
                e.s = walkSeconds(e.m);
            }
            const reverse = reversePathGeometry(fv.value);
            const rv = validatePathGeometry(reverse, {
                fromNode: toGeo, toNode: fromGeo, allowNull: false, snapEndpoints: true
            });
            if (!rv.ok) {
                throw new Error(`Route edge geometry rejected for ${e.b} -> ${e.a}: ${rv.message}`);
            }
            edgeGeometryJsonByPair.set(e.a + '|' + e.b, JSON.stringify(fv.value));
            edgeGeometryJsonByPair.set(e.b + '|' + e.a, JSON.stringify(rv.value));
        }

        let routeEdgesInserted = 0;
        let routeEdgesUpdated = 0;
        async function upsertDirectedEdge(fromKey, toKey, meters, seconds, label, geometryJson) {
            const fromId = nodeIdByKey.get(fromKey);
            const toId = nodeIdByKey.get(toKey);
            if (!fromId || !toId) {
                console.warn(`  Skipping edge ${fromKey} -> ${toKey}: node not found.`);
                return;
            }
            const geometry = geometryJson !== undefined ? geometryJson : null;
            const [existsEdge] = await connection.query(
                'SELECT id FROM route_edges WHERE from_node_id = ? AND to_node_id = ?',
                [fromId, toId]
            );
            if (existsEdge.length === 0) {
                await connection.query(`
                    INSERT INTO route_edges
                    (from_node_id, to_node_id, distance_meters, walk_time_seconds, path_label, is_accessible, path_geometry)
                    VALUES (?, ?, ?, ?, ?, 1, ?)
                `, [fromId, toId, meters, seconds, label, geometry]);
                routeEdgesInserted++;
            } else {
                // Refresh existing edge so distance, walk time, path label,
                // accessibility, and drawing geometry track the latest
                // definitions.
                await connection.query(`
                    UPDATE route_edges
                       SET distance_meters = ?, walk_time_seconds = ?,
                           path_label = ?, is_accessible = 1, path_geometry = ?
                     WHERE from_node_id = ? AND to_node_id = ?
                `, [meters, seconds, label, geometry, fromId, toId]);
                routeEdgesUpdated++;
            }
        }

        for (const e of edgeDefs) {
            // Bidirectional: store both directions as directed rows, each with
            // its pre-validated directed drawing geometry.
            await upsertDirectedEdge(e.a, e.b, e.m, e.s, e.label, edgeGeometryJsonByPair.get(e.a + '|' + e.b) || null);
            await upsertDirectedEdge(e.b, e.a, e.m, e.s, e.label, edgeGeometryJsonByPair.get(e.b + '|' + e.a) || null);
        }

        // Retired demo shortcuts (pre-Milestone-12 route accuracy repair):
        // flagpole->ccs and flagpole->clinic were long straight-line edges
        // that drew across buildings/grass instead of following walkways.
        // Their replacements are the walkway-spine edges above. Idempotent:
        // deleting an already-absent pair affects 0 rows.
        const retiredEdgePairs = [
            ['flagpole', 'ccs'],
            ['flagpole', 'clinic'],
            // Superseded by the OSM-aligned mid-campus -> east-walk -> green
            // corridor (an intermediate iteration of this repair).
            ['mid-campus', 'green-building'],
            // Pre-RF.6 eastern topology correction: these hops made CAS, CCS
            // and Green Building act as TRANSIT connections between eastern
            // buildings (e.g. CCS was reached as east-walk -> CAS -> CCS).
            // Every eastern building is now a terminal destination spurring
            // off the East Corridor Junction instead.
            ['green-building', 'cas'],
            ['cas', 'ccs'],
            ['cas', 'clinic'],
            ['ccs', 'chs'],
            // Pre-RF.6 NO-GO V2: ICTU, the Gymnasium and the Auditorium are
            // building DESTINATIONS and must never be intermediate routing
            // junctions. These were the only edges into mid-campus, so every
            // eastern route was forced through a building. Superseded by the
            // flagpole <-> mid-campus walkway spine above.
            ['ictu', 'mid-campus'],
            ['gymnasium', 'mid-campus'],
            ['auditorium', 'mid-campus']
        ];
        let retiredEdgeRows = 0;
        for (const [aKey, bKey] of retiredEdgePairs) {
            const aId = nodeIdByKey.get(aKey);
            const bId = nodeIdByKey.get(bKey);
            if (!aId || !bId) continue;
            const [delRes] = await connection.query(
                `DELETE FROM route_edges
                  WHERE (from_node_id = ? AND to_node_id = ?)
                     OR (from_node_id = ? AND to_node_id = ?)`,
                [aId, bId, bId, aId]
            );
            retiredEdgeRows += delRes.affectedRows || 0;
        }
        console.log(`  Route graph: ${routeNodes.length} nodes ensured, ${routeEdgesInserted} edge rows inserted, ${routeEdgesUpdated} edge rows refreshed, ${retiredEdgeRows} retired shortcut row(s) removed.`);

        // ---- VR / 360 scenes + hotspots (Milestone 5) ----
        // Idempotent UPSERT. Scenes are keyed by scene_key. Navigation
        // hotspots are keyed by (scene_id, target_scene_id); info/exit
        // hotspots by (scene_id, hotspot_type, label) since they have no
        // target. Re-running INSERTs missing rows and REFRESHES existing
        // ones; it never duplicates.
        //
        // IMAGE PLACEHOLDERS: no real 360 / equirectangular campus photos
        // exist yet. image_url values point at /img/vr/*.jpg which are NOT
        // present in public/img/vr. The upcoming VR viewer section must
        // detect missing/placeholder images and show a graceful fallback
        // instead of a broken panorama. Do not treat these as real 360s.
        console.log('Seeding VR Scenes + Hotspots...');

        // Resolve node ids by node_key (route graph seeded above) and
        // building ids by exact name. Missing links resolve to NULL.
        const [vrNodeRows] = await connection.query('SELECT id, node_key FROM route_nodes');
        const vrNodeIdByKey = new Map(vrNodeRows.map(r => [r.node_key, r.id]));
        const [vrBldgRows] = await connection.query('SELECT id, name FROM buildings');
        const vrBldgIdByName = new Map(vrBldgRows.map(r => [r.name, r.id]));

        const vrScenes = [
            { key: 'scene-main-gate', title: 'Main Gate',                         desc: 'Campus main entrance. Placeholder 360 image.',           img: '/img/vr/main-gate.jpg', nodeKey: 'main-gate',      bldgName: null,                                  yaw: 0, pitch: 0, order: 1 },
            { key: 'scene-flagpole',  title: 'Flagpole Quadrangle',                desc: 'Central quadrangle hub. Placeholder 360 image.',         img: '/img/vr/flagpole.jpg',  nodeKey: 'flagpole',       bldgName: null,                                  yaw: 0, pitch: 0, order: 2 },
            { key: 'scene-admin',     title: 'Administration Building',            desc: 'Administration Building and Registrar. Placeholder 360 image.', img: '/img/vr/admin.jpg', nodeKey: 'admin-building', bldgName: 'Administration Building',              yaw: 0, pitch: 0, order: 3 },
            { key: 'scene-ccs',       title: 'College of Computer Studies (CCS)',  desc: 'CCS Building. Placeholder 360 image.',                   img: '/img/vr/ccs.jpg',       nodeKey: 'ccs',            bldgName: 'College of Computer Studies (CCS)',   yaw: 0, pitch: 0, order: 4 },
            { key: 'scene-library',   title: 'Library Building',                   desc: 'Library Building. Placeholder 360 image.',               img: '/img/vr/library.jpg',   nodeKey: 'library',        bldgName: 'Library Building',                    yaw: 0, pitch: 0, order: 5 },
            { key: 'scene-gym',       title: 'Gymnasium',                          desc: 'Gymnasium. Placeholder 360 image.',                      img: '/img/vr/gym.jpg',       nodeKey: 'gymnasium',      bldgName: 'Gymnasium',                           yaw: 0, pitch: 0, order: 6 }
        ];

        for (const sc of vrScenes) {
            const nodeId = sc.nodeKey ? (vrNodeIdByKey.get(sc.nodeKey) || null) : null;
            const buildingId = sc.bldgName ? (vrBldgIdByName.get(sc.bldgName) || null) : null;
            const [existsScene] = await connection.query(
                'SELECT id FROM vr_scenes WHERE scene_key = ?', [sc.key]
            );
            if (existsScene.length === 0) {
                await connection.query(`
                    INSERT INTO vr_scenes
                    (scene_key, title, description, image_url, node_id, building_id, initial_yaw, initial_pitch, display_order)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [sc.key, sc.title, sc.desc, sc.img, nodeId, buildingId, sc.yaw, sc.pitch, sc.order]);
            } else {
                await connection.query(`
                    UPDATE vr_scenes
                       SET title = ?, description = ?, image_url = ?, node_id = ?,
                           building_id = ?, initial_yaw = ?, initial_pitch = ?, display_order = ?
                     WHERE scene_key = ?
                `, [sc.title, sc.desc, sc.img, nodeId, buildingId, sc.yaw, sc.pitch, sc.order, sc.key]);
            }
        }

        // Re-read scene ids by scene_key for hotspot wiring.
        const [vrSceneRows] = await connection.query('SELECT id, scene_key FROM vr_scenes');
        const vrSceneIdByKey = new Map(vrSceneRows.map(r => [r.scene_key, r.id]));

        let vrHotspotsInserted = 0;
        let vrHotspotsUpdated = 0;

        // Navigation hotspot: keyed by (scene_id, target_scene_id).
        async function upsertSceneHotspot(sceneKey, targetKey, label, yaw, pitch, order) {
            const sceneId = vrSceneIdByKey.get(sceneKey);
            const targetId = vrSceneIdByKey.get(targetKey);
            if (!sceneId || !targetId) {
                console.warn(`  Skipping hotspot ${sceneKey} -> ${targetKey}: scene not found.`);
                return;
            }
            const [ex] = await connection.query(
                'SELECT id FROM vr_hotspots WHERE scene_id = ? AND target_scene_id = ?',
                [sceneId, targetId]
            );
            if (ex.length === 0) {
                await connection.query(`
                    INSERT INTO vr_hotspots
                    (scene_id, target_scene_id, hotspot_type, label, \`text\`, yaw, pitch, display_order)
                    VALUES (?, ?, 'scene', ?, NULL, ?, ?, ?)
                `, [sceneId, targetId, label, yaw, pitch, order]);
                vrHotspotsInserted++;
            } else {
                await connection.query(`
                    UPDATE vr_hotspots
                       SET label = ?, \`text\` = NULL, yaw = ?, pitch = ?, display_order = ?
                     WHERE scene_id = ? AND target_scene_id = ?
                `, [label, yaw, pitch, order, sceneId, targetId]);
                vrHotspotsUpdated++;
            }
        }

        // Info / exit hotspot: keyed by (scene_id, hotspot_type, label),
        // target_scene_id IS NULL.
        async function upsertMarkerHotspot(sceneKey, type, label, text, yaw, pitch, order) {
            const sceneId = vrSceneIdByKey.get(sceneKey);
            if (!sceneId) {
                console.warn(`  Skipping ${type} hotspot on ${sceneKey}: scene not found.`);
                return;
            }
            const [ex] = await connection.query(
                'SELECT id FROM vr_hotspots WHERE scene_id = ? AND hotspot_type = ? AND target_scene_id IS NULL AND label = ?',
                [sceneId, type, label]
            );
            if (ex.length === 0) {
                await connection.query(`
                    INSERT INTO vr_hotspots
                    (scene_id, target_scene_id, hotspot_type, label, \`text\`, yaw, pitch, display_order)
                    VALUES (?, NULL, ?, ?, ?, ?, ?, ?)
                `, [sceneId, type, label, text, yaw, pitch, order]);
                vrHotspotsInserted++;
            } else {
                await connection.query(`
                    UPDATE vr_hotspots
                       SET \`text\` = ?, yaw = ?, pitch = ?, display_order = ?
                     WHERE scene_id = ? AND hotspot_type = ? AND target_scene_id IS NULL AND label = ?
                `, [text, yaw, pitch, order, sceneId, type, label]);
                vrHotspotsUpdated++;
            }
        }

        // Connected scenes (both directions). Trunk: Main Gate <-> Flagpole;
        // hub: Flagpole <-> Admin / CCS / Library / Gym.
        const vrNavPairs = [
            ['scene-main-gate', 'scene-flagpole', 'Go to Flagpole Quadrangle',  'Back to Main Gate'],
            ['scene-flagpole',  'scene-admin',    'Go to Administration Building', 'Back to Flagpole Quadrangle'],
            ['scene-flagpole',  'scene-ccs',      'Go to CCS Building',          'Back to Flagpole Quadrangle'],
            ['scene-flagpole',  'scene-library',  'Go to Library Building',      'Back to Flagpole Quadrangle'],
            ['scene-flagpole',  'scene-gym',      'Go to Gymnasium',             'Back to Flagpole Quadrangle']
        ];

        let vrNavOrder = 1;
        for (const [a, b, fwdLabel, backLabel] of vrNavPairs) {
            await upsertSceneHotspot(a, b, fwdLabel, 0, 0, vrNavOrder++);
            await upsertSceneHotspot(b, a, backLabel, 180, 0, vrNavOrder++);
        }

        // One info hotspot at the entrance.
        await upsertMarkerHotspot('scene-main-gate', 'info', 'Welcome to CSPC',
            'You are at the Main Gate. Follow the hotspots to reach your destination.', 30, 0, 99);

        // Exit / route-complete hotspots at destinations.
        await upsertMarkerHotspot('scene-admin',   'exit', 'You have arrived', 'Administration Building reached.', 0, -10, 99);
        await upsertMarkerHotspot('scene-ccs',     'exit', 'You have arrived', 'CCS Building reached.',            0, -10, 99);
        await upsertMarkerHotspot('scene-library', 'exit', 'You have arrived', 'Library Building reached.',        0, -10, 99);
        await upsertMarkerHotspot('scene-gym',     'exit', 'You have arrived', 'Gymnasium reached.',               0, -10, 99);

        console.log(`  VR: ${vrScenes.length} scenes ensured, ${vrHotspotsInserted} hotspots inserted, ${vrHotspotsUpdated} hotspots refreshed.`);

        console.log('Seeding Team Members...');
        const teamMembers = [
            { name: 'Paga', role: 'UI/UX Designer', image_url: '/img/Paga.jpg', order: 1 },
            { name: 'DIlamitas', role: 'Documenter', image_url: '/img/Dilamitas.jpg', order: 2 },
            { name: 'MAAT', role: 'Documenter', image_url: '/img/maat.jpg', order: 3 }
        ];

        for (const member of teamMembers) {
            const [rows] = await connection.query('SELECT id FROM team_members WHERE name = ?', [member.name]);
            if (rows.length === 0) {
                await connection.query(`
                    INSERT INTO team_members (name, role, image_url, display_order)
                    VALUES (?, ?, ?, ?)
                `, [member.name, member.role, member.image_url, member.order]);
            }
        }

        console.log('Seeding Events...');
        const eventsData = [
            {
                title: 'Annual Research Symposium',
                category: 'Academic',
                event_date: '2026-03-25',
                description: 'Join us for the annual gathering of minds where graduating students present their final year projects. Keynote by Dr. Aris B. Santos.',
                location: 'Main Function Hall, Academic Bldg',
                event_time: '8:00 AM - 4:00 PM'
            },
            {
                title: 'Inter-College Basketball Finals',
                category: 'Sports',
                event_date: '2026-04-02',
                description: 'The climax of the sports fest! Come and support the Engineering vs. Business teams as they battle it out for the championship.',
                location: 'CSPC Gymnasium',
                event_time: '3:00 PM - 6:00 PM'
            },
            {
                title: 'CSPC Arts & Music Fest 2026',
                category: 'Cultural',
                event_date: '2026-04-10',
                description: 'A vibrant celebration of campus talent featuring live bands, theater performances, and an open gallery of student artwork.',
                location: 'Campus Quadrangle / Grandstand',
                event_time: '5:00 PM onwards'
            },
            {
                title: 'Tech Talk: AI in Engineering',
                category: 'Academic',
                event_date: '2026-04-15',
                description: 'An interactive seminar discussing the latest trends in artificial intelligence and its applications in civil and mechanical engineering.',
                location: 'Room 201, Engineering Bldg',
                event_time: '1:00 PM - 3:30 PM'
            },
            {
                title: 'Intramurals Opening Ceremony',
                category: 'Sports',
                event_date: '2026-05-01',
                description: 'The grand opening of the 2026 Intramurals. Cheer dance competitions, parade of athletes, and the lighting of the torch.',
                location: 'CSPC Track & Field Oval',
                event_time: '7:00 AM - 12:00 NN'
            }
        ];

        for (const ev of eventsData) {
            const [rows] = await connection.query('SELECT id FROM events WHERE title = ?', [ev.title]);
            if (rows.length === 0) {
                await connection.query(`
                    INSERT INTO events (title, category, event_date, description, location, event_time)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [ev.title, ev.category, ev.event_date, ev.description, ev.location, ev.event_time]);
            }
        }

        console.log('Database successfully seeded!');
        await connection.end();
        process.exit(0);

    } catch (error) {
        if (error && error.sanitized) {
            // Strict-mode constraint failure: print ONLY the fixed sanitized
            // message — never the error object, stack, SQL, or row values.
            console.error(error.message);
        } else {
            console.error('Seeding failed:', error);
        }
        process.exit(1);
    }
}

seed();
