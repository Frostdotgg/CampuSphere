/* ========================================
   CampuSphere — Events Controller
   Handles the Events page
   ======================================== */

const db = require('../config/db');
const contentDataSource = require('../config/contentDataSource');
const contentRepository = require('../repositories/contentRepository');
const { logServerError } = require('../utils/serverLog');

const EVENT_AUDIENCE_ROLES = new Set(['student-cspc', 'instructor', 'admin', 'guest']);

function sessionAudienceRole(req) {
    const role = req && req.session && req.session.user && req.session.user.role;
    return EVENT_AUDIENCE_ROLES.has(role) ? role : '';
}

/**
 * GET /events — Events & News
 */
exports.index = async (req, res) => {
    try {
        const role = sessionAudienceRole(req);
        // The public events page presents the newest calendar date first.
        // Keep this direction explicit so the notification feed can continue
        // using listEvents' default nearest-upcoming ASC order.
        let rows;
        if (contentDataSource.isSupabase()) {
            rows = await contentRepository.listEventsForRole(role, { sortDirection: 'desc' });
        } else {
            const audienceSql = role ? '(audience = ? OR audience = ?)' : 'audience = ?';
            const audienceParams = role ? ['all', role] : ['all'];
            [rows] = await db.query(
                `SELECT * FROM events
                  WHERE ${audienceSql}
                  ORDER BY event_date DESC, id DESC`,
                audienceParams
            );
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
