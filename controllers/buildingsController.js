/* ========================================
   CampuSphere — Buildings Controller
   Handles the Buildings page
   ======================================== */

const db = require('../config/db');

/**
 * GET /buildings — Buildings Explorer
 */
exports.index = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM buildings ORDER BY id ASC');
    
    const buildings = rows.map(b => {
      let details = {};
      try {
        if (b.details) details = JSON.parse(b.details);
      } catch (e) {
        console.error('Error parsing building details', e);
      }
      return {
        id: b.id,
        name: b.name,
        category: b.category,
        desc: b.description,
        lat: b.lat,
        lng: b.lng,
        ...details
      };
    });

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
