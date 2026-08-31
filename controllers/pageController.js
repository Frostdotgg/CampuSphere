/* ========================================
   CampuSphere — Page Controller
   Handles Landing, Home, and About pages
   ======================================== */

const {
  DEFAULT_SCHOOL_DESCRIPTION,
  expandLegacySchoolDescription,
  splitSchoolDescription,
} = require('../utils/siteSettingsDescription');
const db = require('../config/db');
const contentDataSource = require('../config/contentDataSource');
const contentRepository = require('../repositories/contentRepository');
const mapRuntime = require('../config/mapRuntime');
const buildingRepository = require('../repositories/buildingRepository');
const { normalizeBuildingRows } = require('../utils/buildingData');
const { logServerError } = require('../utils/serverLog');

const HOME_FEATURED_BUILDING_LIMIT = 3;
const HOME_LATEST_EVENT_LIMIT = 2;

function dateOnly(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    // mysql2 represents DATE values as local-midnight Date objects unless
    // dateStrings is enabled. Reading the local calendar components preserves
    // the stored YYYY-MM-DD value instead of shifting it through UTC.
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const text = String(value == null ? '' : value).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : '';
}

function textValue(value, fallback = '') {
  const text = String(value == null ? '' : value).trim();
  return text || fallback;
}

function toHomeEvent(row) {
  const date = dateOnly(row && row.event_date);
  const title = textValue(row && row.title);
  if (!date || !title) return null;

  const [year, month, day] = date.split('-').map(Number);
  const dateObject = new Date(Date.UTC(year, month - 1, day));
  const monthLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short'
  }).format(dateObject);

  return {
    title: title.slice(0, 255),
    date,
    day: String(day).padStart(2, '0'),
    monthLabel,
    year: String(year),
    dateLabel: `${monthLabel} ${day}, ${year}`,
    time: textValue(row && row.event_time, 'Time to be announced').slice(0, 100)
  };
}

async function readHomeFeaturedLocations() {
  let rows;
  if (mapRuntime.isBuildingSupabase()) {
    rows = await buildingRepository.listFirstById(HOME_FEATURED_BUILDING_LIMIT);
  } else {
    [rows] = await db.query(
      `SELECT id, name, category, description, lat, lng, details,
              image_url, cloudinary_public_id, created_at, updated_at
         FROM buildings
        ORDER BY id ASC
        LIMIT ?`,
      [HOME_FEATURED_BUILDING_LIMIT]
    );
  }

  return normalizeBuildingRows(rows)
    .slice(0, HOME_FEATURED_BUILDING_LIMIT)
    .map((building) => ({
      name: textValue(building.name, 'Unnamed building').slice(0, 150),
      category: textValue(building.category, 'Campus location').slice(0, 50),
      img: building.img
    }));
}

async function readHomeLatestEvents() {
  let rows;
  if (contentDataSource.isSupabase()) {
    rows = await contentRepository.listEvents({
      limit: HOME_LATEST_EVENT_LIMIT,
      sortDirection: 'desc'
    });
  } else {
    [rows] = await db.query(
      `SELECT title, event_date, event_time
         FROM events
        ORDER BY event_date DESC, id DESC
        LIMIT ${HOME_LATEST_EVENT_LIMIT}`
    );
  }

  return rows.map(toHomeEvent).filter(Boolean).slice(0, HOME_LATEST_EVENT_LIMIT);
}

async function loadHomeSidebarData(req) {
  const [locationsResult, eventsResult] = await Promise.allSettled([
    readHomeFeaturedLocations(),
    readHomeLatestEvents()
  ]);

  const locationsUnavailable = locationsResult.status === 'rejected';
  const eventsUnavailable = eventsResult.status === 'rejected';
  if (locationsUnavailable) logServerError('home.featuredLocations', req);
  if (eventsUnavailable) logServerError('home.latestEvents', req);

  const featuredLocations = locationsUnavailable ? [] : locationsResult.value;
  const latestEvents = eventsUnavailable ? [] : eventsResult.value;
  return {
    featuredLocations,
    featuredLocationsState: locationsUnavailable
      ? 'unavailable'
      : (featuredLocations.length ? 'ready' : 'empty'),
    latestEvents,
    latestEventsState: eventsUnavailable
      ? 'unavailable'
      : (latestEvents.length ? 'ready' : 'empty')
  };
}



/**
 * GET / — Landing Page
 */
exports.landing = (req, res) => {
  res.render('landing', {
    title: 'CampuSphere | CSPC Virtual Map Tour',
    description: 'CampuSphere — Navigate CSPC with ease. An interactive virtual campus map tour for Camarines Sur Polytechnic Colleges.'
  });
};

/**
 * GET /privacy — Pilot privacy notice (M12.P1-R8).
 *
 * Deliberately ANONYMOUS: a privacy notice that only signed-in users can read
 * is useless to someone deciding whether to sign in at all. It renders no
 * session data and performs no database access.
 */
exports.privacy = (req, res) => {
  res.render('privacy', {
    title: 'CampuSphere | Privacy Notice',
    description: 'How the CampuSphere pilot at Camarines Sur Polytechnic Colleges collects and uses personal information.'
  });
};

/**
 * GET /home — Home Dashboard
 */
exports.home = async (req, res) => {
  const sidebar = await loadHomeSidebarData(req);
  res.render('home', {
    title: 'CampuSphere | Home Dashboard',
    description: 'CampuSphere Dashboard — Explore the CSPC campus interactively with maps, buildings, events, and more.',
    activeTab: 'tabHome',
    ...sidebar
  });
};

/**
 * GET /about — About Us
 */
exports.about = (req, res) => {
  const siteSettings = res.locals.siteSettings || {};
  const schoolDescription = expandLegacySchoolDescription(
    siteSettings.school_description || DEFAULT_SCHOOL_DESCRIPTION
  ) || DEFAULT_SCHOOL_DESCRIPTION;
  const schoolDescriptionParts = splitSchoolDescription(schoolDescription);
  res.render('about', {
    title: 'CampuSphere | About Us',
    description: schoolDescriptionParts[0] || 'Learn about the CampuSphere team and the CSPC virtual map tour project.',
    siteSettings: { ...siteSettings, school_description: schoolDescription },
    schoolDescriptionParts,
    activeTab: 'tabAbout'
  });
};
