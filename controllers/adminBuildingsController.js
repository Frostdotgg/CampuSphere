/* ========================================
   CampuSphere — Admin Buildings Controller
   CRUD API for the buildings table
   ======================================== */

const db = require('../config/db');

/**
 * POST /admin/api/buildings — Create a building
 */
exports.createBuilding = async (req, res) => {
  try {
    const { name, category, description, lat, lng, details } = req.body;

    if (!name || !category || lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, message: 'Name, category, latitude, and longitude are required.' });
    }

    const [result] = await db.query(
      'INSERT INTO buildings (name, category, description, lat, lng, details) VALUES (?, ?, ?, ?, ?, ?)',
      [name, category, description || null, parseFloat(lat), parseFloat(lng), details || null]
    );

    const [[building]] = await db.query('SELECT * FROM buildings WHERE id = ?', [result.insertId]);

    return res.json({ success: true, message: 'Building created.', building });
  } catch (error) {
    console.error('Error creating building:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PUT /admin/api/buildings/:id — Update a building
 */
exports.updateBuilding = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, description, lat, lng, details } = req.body;

    if (!name || !category || lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, message: 'Name, category, latitude, and longitude are required.' });
    }

    const [existing] = await db.query('SELECT id FROM buildings WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Building not found.' });
    }

    await db.query(
      'UPDATE buildings SET name = ?, category = ?, description = ?, lat = ?, lng = ?, details = ? WHERE id = ?',
      [name, category, description || null, parseFloat(lat), parseFloat(lng), details || null, id]
    );

    const [[building]] = await db.query('SELECT * FROM buildings WHERE id = ?', [id]);

    return res.json({ success: true, message: 'Building updated.', building });
  } catch (error) {
    console.error('Error updating building:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * DELETE /admin/api/buildings/:id — Delete a building
 */
exports.deleteBuilding = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.query('SELECT id FROM buildings WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Building not found.' });
    }

    await db.query('DELETE FROM buildings WHERE id = ?', [id]);

    return res.json({ success: true, message: 'Building deleted.' });
  } catch (error) {
    console.error('Error deleting building:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};
