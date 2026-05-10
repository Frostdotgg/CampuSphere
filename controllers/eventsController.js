/* ========================================
   CampuSphere — Events Controller
   Handles the Events page
   ======================================== */

const db = require('../config/db');

/**
 * GET /events — Events & News
 */
exports.index = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM events ORDER BY event_date ASC');
        
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
        console.error('Error fetching events:', error);
        // Fallback gracefully or handle error
        res.render('events', {
            title: 'CampuSphere | Events',
            description: 'Stay updated with campus events and news at CSPC.',
            activeTab: 'tabEvents',
            events: []
        });
    }
};
