/* ========================================
   CampuSphere — Admin Buildings Controller
   CRUD API for the buildings table
   ======================================== */

const db = require('../config/db');

/**
 * Validate the `details` field. Returns `{ ok: true, value }` where `value`
 * is either a canonical JSON string or `null`, or `{ ok: false, message }`.
 *
 * Rules:
 *   - undefined / null / blank string  -> stored as NULL.
 *   - already-parsed plain object      -> re-stringified (canonical form).
 *   - string                           -> must JSON.parse to a plain object.
 *   - arrays / strings / numbers /
 *     booleans / null parsed JSON      -> rejected.
 */
function validateDetails(raw) {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }

  if (typeof raw === 'object') {
    if (Array.isArray(raw)) {
      return { ok: false, message: 'Details must be a JSON object, not an array.' };
    }
    return { ok: true, value: JSON.stringify(raw) };
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') return { ok: true, value: null };

    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { ok: false, message: 'Details must be valid JSON.' };
    }

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, message: 'Details must be a JSON object (not an array, string, number, or boolean).' };
    }

    return { ok: true, value: JSON.stringify(parsed) };
  }

  return { ok: false, message: 'Details must be a JSON object or blank.' };
}

/**
 * Validate a coordinate field. Returns `{ ok: true, value }` with a finite
 * `Number`, or `{ ok: false, message }`.
 */
function validateCoord(value, label) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return { ok: false, message: `${label} must be a finite number.` };
    }
    return { ok: true, value };
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return { ok: false, message: `${label} must be a finite number.` };
    }
    const num = Number(trimmed);
    if (!Number.isFinite(num)) {
      return { ok: false, message: `${label} must be a finite number.` };
    }
    return { ok: true, value: num };
  }

  return { ok: false, message: `${label} must be a finite number.` };
}

/**
 * POST /admin/api/buildings — Create a building
 */
exports.createBuilding = async (req, res) => {
  try {
    const { name, category, description, lat, lng, details } = req.body;

    if (!name || !category || lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, message: 'Name, category, latitude, and longitude are required.' });
    }

    const latCheck = validateCoord(lat, 'Latitude');
    if (!latCheck.ok) return res.status(400).json({ success: false, message: latCheck.message });

    const lngCheck = validateCoord(lng, 'Longitude');
    if (!lngCheck.ok) return res.status(400).json({ success: false, message: lngCheck.message });

    const detailsCheck = validateDetails(details);
    if (!detailsCheck.ok) return res.status(400).json({ success: false, message: detailsCheck.message });

    const [result] = await db.query(
      'INSERT INTO buildings (name, category, description, lat, lng, details) VALUES (?, ?, ?, ?, ?, ?)',
      [name, category, description || null, latCheck.value, lngCheck.value, detailsCheck.value]
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

    const latCheck = validateCoord(lat, 'Latitude');
    if (!latCheck.ok) return res.status(400).json({ success: false, message: latCheck.message });

    const lngCheck = validateCoord(lng, 'Longitude');
    if (!lngCheck.ok) return res.status(400).json({ success: false, message: lngCheck.message });

    const detailsCheck = validateDetails(details);
    if (!detailsCheck.ok) return res.status(400).json({ success: false, message: detailsCheck.message });

    const [existing] = await db.query('SELECT id FROM buildings WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Building not found.' });
    }

    await db.query(
      'UPDATE buildings SET name = ?, category = ?, description = ?, lat = ?, lng = ?, details = ? WHERE id = ?',
      [name, category, description || null, latCheck.value, lngCheck.value, detailsCheck.value, id]
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
