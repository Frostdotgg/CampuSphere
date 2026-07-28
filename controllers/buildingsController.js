/* ========================================
   CampuSphere — Buildings Controller
   Handles the Buildings page
   ======================================== */

const db = require('../config/db');
const { normalizeBuildingRows } = require('../utils/buildingData');
const { withParticipantDetails } = require('../utils/buildingParticipantView');
const mapRuntime = require('../config/mapRuntime');
const buildingRepository = require('../repositories/buildingRepository');
const scheduleRepository = require('../repositories/scheduleRepository');
const routeAvailability = require('../services/routeAvailability');
const V = require('../utils/adminValidation');
const { logServerError } = require('../utils/serverLog');

// Public schedule window bounds (Milestone 11, Section 11.6; domain contract):
// default Asia/Manila today through the next 14 days inclusive, max 90 days.
// The date helpers mirror controllers/adminScheduleController.js.
const SCHEDULE_DEFAULT_WINDOW_DAYS = 14;
const SCHEDULE_MAX_WINDOW_DAYS = 90;
const SCHEDULE_ROW_CAP = 100;
const SCHEDULE_LOCATION_LABEL_MAX = 120;
const SCHEDULE_FLOOR_LABEL_MAX = 80;
const SCHEDULE_LOCATION_TYPES = ['room', 'facility'];

function manilaTodayYmd() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function addDaysYmd(ymd, days) {
  const dt = new Date(Date.UTC(
    Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10))
  ));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function ymdDiffDays(from, to) {
  const f = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const t = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((t - f) / 86400000);
}

// Public row shape: display fields only. Internal ids, creator metadata, and
// timestamps never leave the server on this endpoint.
function toPublicScheduleRow(s) {
  return {
    title: s.title,
    schedule_date: s.schedule_date,
    start_time: s.start_time,
    end_time: s.end_time,
    audience: s.audience,
    location_type: s.location_type,
    location_label: s.location_label,
    floor_label: s.floor_label,
    description: s.description,
  };
}

/**
 * GET /buildings — Buildings Explorer
 */
exports.index = async (req, res, next) => {
  try {
    // Building rows come from BUILDING_DATA_SOURCE. Route availability and the
    // VR decoration come from ROUTE_DATA_SOURCE and are joined by canonical name
    // (BE.3) — the two switches are independent and their numeric building ids
    // are NOT interchangeable, so the old `routeIdByBuilding.get(b.id)` lookup
    // was wrong whenever the switches differed.
    const rows = mapRuntime.isBuildingSupabase()
      ? await buildingRepository.listAll()
      : (await db.query('SELECT * FROM buildings ORDER BY id ASC'))[0];
    const buildings = normalizeBuildingRows(rows);

    // Unavailable buildings stay VISIBLE (campus information); the view marks
    // them and disables their destination / VR actions.
    const decorated = await routeAvailability.decorateBuildings(buildings);
    if (!decorated.ok) logServerError('buildings.index.routeAvailability', req);

    res.render('buildings', {
      title: 'CampuSphere | Buildings',
      description: 'Explore all campus buildings at Camarines Sur Polytechnic Colleges.',
      activeTab: 'tabBuildings',
      buildings: decorated.buildings.map(withParticipantDetails)
    });
  } catch (err) {
    // Delegate to the centralized error handler so this browser page returns the
    // standard sanitized HTML error page (not a bare plain-text "Server Error"),
    // with logging handled in one place. (Milestone 8, Section 8.7 / R11)
    next(err);
  }
};

/**
 * GET /api/buildings — Public JSON building list
 */
exports.apiList = async (req, res) => {
  try {
    let rows;
    if (mapRuntime.isBuildingSupabase()) {
      rows = await buildingRepository.listAll();
    } else {
      [rows] = await db.query('SELECT * FROM buildings ORDER BY id ASC');
    }
    const buildings = normalizeBuildingRows(rows);
    // BE.3: same decorated shape as /buildings, /map and /api/search.
    const decorated = await routeAvailability.decorateBuildings(buildings);
    if (!decorated.ok) logServerError('buildings.api.routeAvailability', req);
    res.json({ success: true, buildings: decorated.buildings });
  } catch (err) {
    logServerError('buildings.api', req);
    res.status(500).json({ success: false, message: 'Unable to load buildings' });
  }
};

/**
 * GET /api/buildings/:id/schedules — public (authenticated) room/facility
 * schedule window for one building (Milestone 11, Section 11.6).
 *
 * Visibility rule: status 'scheduled' only, audience 'all' OR the session
 * user's role (the dashboard announcement convention). Rows come exclusively
 * from repositories/scheduleRepository.js (SCHEDULE_DATA_SOURCE), ordered by
 * schedule_date ASC, start_time ASC, and are mapped to the public shape.
 */
exports.apiBuildingSchedules = async (req, res) => {
  const id = V.parseRouteId(req.params.id);
  if (id === null) {
    return res.status(400).json({ success: false, message: 'Invalid building id.' });
  }

  let from;
  if (req.query.from !== undefined && String(req.query.from).trim() !== '') {
    const v = V.validateYmdDate(String(req.query.from), 'From date');
    if (!v.ok) return res.status(400).json({ success: false, message: v.message });
    from = v.value;
  } else {
    from = manilaTodayYmd();
  }
  let to;
  if (req.query.to !== undefined && String(req.query.to).trim() !== '') {
    const v = V.validateYmdDate(String(req.query.to), 'To date');
    if (!v.ok) return res.status(400).json({ success: false, message: v.message });
    to = v.value;
  } else {
    to = addDaysYmd(from, SCHEDULE_DEFAULT_WINDOW_DAYS);
  }
  const span = ymdDiffDays(from, to);
  if (span < 0) {
    return res.status(400).json({ success: false, message: 'Invalid date range: the end date is before the start date.' });
  }
  if (span + 1 > SCHEDULE_MAX_WINDOW_DAYS) {
    return res.status(400).json({ success: false, message: `Date range is too wide (maximum ${SCHEDULE_MAX_WINDOW_DAYS} days).` });
  }

  const hasLocationFilter =
    (req.query.location_type !== undefined && String(req.query.location_type).trim() !== '') ||
    (req.query.location_label !== undefined && String(req.query.location_label).trim() !== '') ||
    (req.query.floor_label !== undefined && String(req.query.floor_label).trim() !== '');
  let locationType;
  let locationLabel;
  let floorLabel;
  if (hasLocationFilter) {
    const lt = V.allowedValue(req.query.location_type, 'location type', SCHEDULE_LOCATION_TYPES);
    if (!lt.ok) return res.status(400).json({ success: false, message: lt.message });
    const ll = V.requiredString(req.query.location_label, 'Location label', SCHEDULE_LOCATION_LABEL_MAX);
    if (!ll.ok) return res.status(400).json({ success: false, message: ll.message });
    const fl = V.optionalString(req.query.floor_label, 'Floor label', SCHEDULE_FLOOR_LABEL_MAX);
    if (!fl.ok) return res.status(400).json({ success: false, message: fl.message });
    locationType = lt.value;
    locationLabel = ll.value;
    floorLabel = fl.value === '' ? undefined : fl.value;
  }

  try {
    // Building existence in the ACTIVE building source (this controller's
    // convention), so the 404 contract matches /buildings and /api/buildings.
    let exists;
    if (mapRuntime.isBuildingSupabase()) {
      exists = !!(await buildingRepository.findById(id));
    } else {
      const [rows] = await db.query('SELECT id FROM buildings WHERE id = ? LIMIT 1', [id]);
      exists = rows.length > 0;
    }
    if (!exists) {
      return res.status(404).json({ success: false, message: 'Building not found.' });
    }

    const user = (req.session && req.session.user) || {};
    const role = typeof user.role === 'string' ? user.role.trim() : '';

    // Two bounded repository reads ('all' + the user's role bucket) keep the
    // audience rule exact without a post-limit filter dropping visible rows.
    const baseFilters = {
      buildingId: id,
      from,
      to,
      status: 'scheduled',
      locationType,
      locationLabel,
      floorLabel,
      limit: SCHEDULE_ROW_CAP,
    };
    const allRows = await scheduleRepository.listSchedules({ ...baseFilters, audience: 'all' });
    const roleRows = role && role !== 'all'
      ? await scheduleRepository.listSchedules({ ...baseFilters, audience: role })
      : [];

    const merged = [...allRows, ...roleRows].sort((a, b) => {
      if (a.schedule_date !== b.schedule_date) return a.schedule_date < b.schedule_date ? -1 : 1;
      if (a.start_time !== b.start_time) return a.start_time < b.start_time ? -1 : 1;
      return (a.id || 0) - (b.id || 0);
    });

    return res.json({ success: true, schedules: merged.map(toPublicScheduleRow) });
  } catch (err) {
    logServerError('buildings.schedules', req);
    return res.status(500).json({ success: false, message: 'Unable to load schedules.' });
  }
};
