/* ========================================
   CampuSphere — Events Controller
   Handles the Events page
   ======================================== */

const db = require('../config/db');
const contentDataSource = require('../config/contentDataSource');
const contentRepository = require('../repositories/contentRepository');
const { logServerError } = require('../utils/serverLog');

/**
 * GET /events — Events & News
 */
exports.index = async (req, res) => {
    try {
        // Supabase repository returns events ordered by event_date ASC,
        // matching the existing MySQL query; the reshape below is unchanged.
        let rows;
        if (contentDataSource.isSupabase()) {
            rows = await contentRepository.listEvents();
        } else {
            [rows] = await db.query('SELECT * FROM events ORDER BY event_date ASC');
        }

        // Map rows to match the expected format
        const eventsData = rows.map(r => ({
            id: r.id,
            title: r.title,
            category: r.category,
            dateObj: r.event_date,
            desc: r.description,
            location: r.location,
            time: r.event_time
        }));

        res.render('events', {
            title: 'CampuSphere | Events',
            description: 'Stay updated with campus events and news at CSPC.',
            activeTab: 'tabEvents',
            events: eventsData
        });
    } catch (error) {
        logServerError('events.index', req);
        // Fallback gracefully or handle error
        res.render('events', {
            title: 'CampuSphere | Events',
            description: 'Stay updated with campus events and news at CSPC.',
            activeTab: 'tabEvents',
            events: []
        });
    }
};
