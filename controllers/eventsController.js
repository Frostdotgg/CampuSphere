/* ========================================
   CampuSphere — Events Controller
   Handles the Events page
   ======================================== */

const db = require('../config/db');
const { eventDepartmentLabel } = require('../utils/departments');
const contentDataSource = require('../config/contentDataSource');
const contentRepository = require('../repositories/contentRepository');
const { logServerError } = require('../utils/serverLog');
const { normalizeContentRole, eventReadSql } = require('../utils/contentVisibility');

function sessionAudienceRole(req) {
    const role = req && req.session && req.session.user && req.session.user.role;
    return normalizeContentRole(role);
}

/**
 * GET /events — Events & News
 */
exports.index = async (req, res) => {
    const role = sessionAudienceRole(req);
    try {
        // The public events page presents the newest calendar date first.
        // Keep this direction explicit so the notification feed can continue
        // using listEvents' default nearest-upcoming ASC order.
        let rows;
        if (contentDataSource.isSupabase()) {
            rows = await contentRepository.listEventsForRole(role, { sortDirection: 'desc' });
        } else {
            const visibility = eventReadSql(role);
            [rows] = await db.query(
                `SELECT * FROM events
                  WHERE ${visibility.sql}
                  ORDER BY event_date DESC, id DESC`,
                visibility.params
            );
        }

        // Map rows to match the expected format
        const eventsData = rows.map(r => ({
            id: r.id,
            title: r.title,
            category: r.category,
            department_code: r.department_code || '',
            department_label: eventDepartmentLabel(r.department_code),
            dateObj: r.event_date,
            desc: r.description,
            location: r.location,
            time: r.event_time
        }));

        res.render('events', {
            title: 'CampuSphere | Events',
            description: 'Stay updated with campus events and news at CSPC.',
            activeTab: 'tabEvents',
            events: eventsData,
            guestEventsOnly: role === 'guest'
        });
    } catch (error) {
        logServerError('events.index', req);
        // Fallback gracefully or handle error
        res.render('events', {
            title: 'CampuSphere | Events',
            description: 'Stay updated with campus events and news at CSPC.',
            activeTab: 'tabEvents',
            events: [],
            guestEventsOnly: role === 'guest'
        });
    }
};
