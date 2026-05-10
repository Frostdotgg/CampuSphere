const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const data = require('../models/data');

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
        
        for (const [key, val] of settings) {
            await connection.query('INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES (?, ?)', [key, val]);
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
                    INSERT INTO news_announcements (title, category, excerpt, content, published_date)
                    VALUES (?, ?, ?, ?, ?)
                `, [newsItem.title, newsItem.category, newsItem.excerpt, newsItem.excerpt, parsedDate]);
            }
        }

        console.log('Seeding Buildings...');
        for (const bldg of data.buildings) {
             const [rows] = await connection.query('SELECT id FROM buildings WHERE name = ?', [bldg.name]);
             if (rows.length === 0) {
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
                 await connection.query(`
                    INSERT INTO buildings (name, category, description, lat, lng, details)
                    VALUES (?, ?, ?, ?, ?, ?)
                 `, [bldg.name, bldg.category, bldg.desc, bldg.lat, bldg.lng, JSON.stringify(details)]);
             }
        }

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
        console.error('Seeding failed:', error);
        process.exit(1);
    }
}

seed();
