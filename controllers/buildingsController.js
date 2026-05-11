/* ========================================
   CampuSphere — Buildings Controller
   Handles the Buildings page
   ======================================== */

const db = require('../config/db');
const { normalizeBuildingRows } = require('../utils/buildingData');

/**
 * GET /buildings — Buildings Explorer
 */
exports.index = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM buildings ORDER BY id ASC');
    const buildings = normalizeBuildingRows(rows);

    res.render('buildings', {
      title: 'CampuSphere | Buildings',
      description: 'Explore all campus buildings at Camarines Sur Polytechnic Colleges.',
      activeTab: 'tabBuildings',
      buildings: buildings
    });
  } catch (err) {
    console.error('Error fetching buildings:', err);
    res.status(500).send('Server Error');
  }
};

/**
 * GET /api/buildings — Public JSON building list
 */
exports.apiList = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM buildings ORDER BY id ASC');
    const buildings = normalizeBuildingRows(rows);
    res.json({ success: true, buildings });
  } catch (err) {
    console.error('Error fetching buildings for API:', err);
    res.status(500).json({ success: false, message: 'Unable to load buildings' });
  }
};
