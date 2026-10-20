/* ========================================
   CampuSphere — Buildings Controller
   Handles the Buildings page
   ======================================== */

const db = require('../config/db');
const { normalizeBuildingRows } = require('../utils/buildingData');
const { withParticipantDetails } = require('../utils/buildingParticipantView');
const mapRuntime = require('../config/mapRuntime');
const buildingRepository = require('../repositories/buildingRepository');
const routeAvailability = require('../services/routeAvailability');
const { logServerError } = require('../utils/serverLog');

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
