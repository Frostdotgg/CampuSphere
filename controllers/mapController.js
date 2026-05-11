/* ========================================
   CampuSphere — Map Controller
   Handles the Campus Map page
   ======================================== */

const db = require('../config/db');
const { normalizeBuildingRows } = require('../utils/buildingData');

/**
 * GET /map — Interactive Campus Map
 */
exports.index = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM buildings ORDER BY id ASC');
    const buildings = normalizeBuildingRows(rows);

    res.render('map', {
      title: 'CampuSphere | Campus Map',
      description: 'Navigate the CSPC campus with our interactive map.',
      activeTab: 'tabMap',
      buildings
    });
  } catch (err) {
    console.error('Error fetching buildings for map:', err);
    res.render('map', {
      title: 'CampuSphere | Campus Map',
      description: 'Navigate the CSPC campus with our interactive map.',
      activeTab: 'tabMap',
      buildings: []
    });
  }
};
