/* ========================================
   CampuSphere — Admin VR API Controller
   Milestone 7, Section 7.8: VR Scene & Hotspot Administration.

   Admin-only JSON CRUD for vr_scenes and vr_hotspots, gated by
   routes/admin.js -> router.use(requireRole('admin')). Validation, HTTP
   status decisions, the scene-delete inbound-reference guard, and audit
   logging live here; data access is parameterised SQL (MySQL) or
   repositories/vrRepository.js (Supabase), chosen by VR_DATA_SOURCE.

   Backends are equivalent:
     VR_DATA_SOURCE=mysql    -> parameterised queries via config/db.js, with
                               every mutation wrapped in a transaction so its
                               checks and write commit or roll back together.
     VR_DATA_SOURCE=supabase -> vrRepository admin methods. Single-row writes
                               are atomic in Postgres; the scene-delete guard
                               is enforced here (count inbound refs, then delete).

   Privacy: never logs request bodies, payload values, SQL, raw errors, stacks,
   Supabase URLs/keys, cookies, sessions, or OAuth subjects. Failures emit one
   fixed sanitized warning and a generic 500.
   ======================================== */

const db = require('../config/db');
const vrDataSource = require('../config/vrDataSource');
const vrRepository = require('../repositories/vrRepository');
const auditService = require('../services/auditService');
const { normalizeMediaUrl, validateCloudinaryPublicId } = require('../utils/mediaUrl');

/* ---------- field limits / allowed values (mirror the schema) ---------- */

const SCENE_KEY_MAX = 60;
const TITLE_MAX = 150;
const DESC_MAX = 5000;
const IMG_MAX = 255;
const LABEL_MAX = 150;
const TEXT_MAX = 5000;
const SCHEDULE_LOCATION_LABEL_MAX = 120;
const SCHEDULE_FLOOR_LABEL_MAX = 80;
const ORDER_MAX = 2147483647; // signed 32-bit INT ceiling in both schemas
const YAW_MIN = -180, YAW_MAX = 180;   // panorama yaw range
const PITCH_MIN = -90, PITCH_MAX = 90; // panorama pitch range
const HOTSPOT_TYPES = ['scene', 'info', 'exit', 'schedule'];
const SCHEDULE_LOCATION_TYPES = ['room', 'facility'];

// Section 10.6: admin scene shape adds cloudinary_public_id (admin-only — the
// public/runtime scene shapes in vrController never carry it).
const SCENE_ADMIN_COLS_SQL =
  'id, scene_key, title, description, image_url, cloudinary_public_id, node_id, building_id, ' +
  'initial_yaw, initial_pitch, display_order';

// MySQL hotspot read-back: editable columns + the target scene_key for display.
const HOTSPOT_SELECT_SQL =
  'SELECT h.id, h.scene_id, h.target_scene_id, h.hotspot_type, h.label, ' +
  'h.`text` AS text, h.yaw, h.pitch, h.display_order, ' +
  'h.schedule_building_id, h.schedule_location_type, h.schedule_location_label, h.schedule_floor_label, ' +
  't.scene_key AS target_scene_key, t.title AS target_title ' +
  'FROM vr_hotspots h LEFT JOIN vr_scenes t ON t.id = h.target_scene_id';

/* ---------- error + transaction plumbing ---------- */

// Carries an intended HTTP status + safe message out of a validation/lookup
// step (including from inside a MySQL transaction) to the handler's catch.
class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; this.expose = true; }
}

function handleErr(res, e, label) {
  if (e && e.expose) {
    return res.status(e.status).json({ success: false, message: e.message });
  }
  console.error('adminVrController.' + label + ': unexpected failure.');
  return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
}

// Run a MySQL mutation inside a transaction: begin -> fn(conn) -> commit, with
// rollback on any throw (ApiError or otherwise) and a guaranteed release.
async function withTx(fn) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) {
    try { await conn.rollback(); } catch (_) { /* ignore */ }
    throw e;
  } finally {
    conn.release();
  }
}

// Best-effort audit of a successful VR mutation. Fire-and-forget: never throws,
// never blocks, never changes the JSON response, never stores payload values.
function auditVr(req, action, targetType, targetId, message) {
  const actor = (req.session && req.session.user) || {};
  auditService.record({
    event_type: 'admin_mutation',
    action,
    outcome: 'success',
    actor_user_id: actor.id,
    actor_role: actor.role,
    target_type: targetType,
    target_id: targetId,
    message
  }).catch(() => {});
}

/* ---------- shared value parsing / validation ---------- */

function isPlainObject(b) { return b !== null && typeof b === 'object' && !Array.isArray(b); }

function reqStr(raw, max) {
  if (typeof raw !== 'string') return { ok: false };
  const v = raw.trim();
  if (v === '' || v.length > max) return { ok: false };
  return { ok: true, value: v };
}

function optStr(raw, max) {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false };
  const v = raw.trim();
  if (v === '') return { ok: true, value: null };
  if (v.length > max) return { ok: false };
  return { ok: true, value: v };
}

// Canonical positive integer (no signs, leading zeros, fractions, exponent), or null.
function parseId(raw) {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const s = String(raw).trim();
  if (!/^(0|[1-9][0-9]*)$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n < 1) return null;
  return n;
}

// Optional foreign-key id: blank/null -> null; otherwise a canonical positive int.
function optId(raw) {
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
    return { ok: true, value: null };
  }
  const n = parseId(raw);
  if (n === null) return { ok: false };
  return { ok: true, value: n };
}

// display_order: blank -> 0; otherwise an integer 0..ORDER_MAX.
function parseOrder(raw) {
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
    return { ok: true, value: 0 };
  }
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw) || raw < 0 || raw > ORDER_MAX) return { ok: false };
    return { ok: true, value: raw };
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!/^(0|[1-9][0-9]*)$/.test(s)) return { ok: false };
    const n = Number(s);
    if (!Number.isSafeInteger(n) || n > ORDER_MAX) return { ok: false };
    return { ok: true, value: n };
  }
  return { ok: false };
}

// yaw/pitch: blank -> 0; otherwise a finite number within [min, max]. Accepts
// ONLY finite JS numbers and trimmed decimal numeric strings (optional sign,
// integer and/or fractional part). Booleans, arrays, objects, NaN, Infinity,
// and malformed/scientific strings are rejected — Number() coercion of those
// (e.g. Number(true)===1, Number([1])===1) must never reach a valid angle.
function parseAngle(raw, min, max) {
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
    return { ok: true, value: 0 };
  }
  let n;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return { ok: false }; // rejects NaN / Infinity
    n = raw;
  } else if (typeof raw === 'string') {
    const s = raw.trim();
    if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(s)) return { ok: false };
    n = Number(s);
    if (!Number.isFinite(n)) return { ok: false };
  } else {
    return { ok: false }; // booleans, arrays, objects, etc.
  }
  if (n < min || n > max) return { ok: false };
  return { ok: true, value: n };
}

// scene_key: lowercase canonical slug (alnum groups joined by single hyphens).
function validateSceneKey(raw) {
  if (typeof raw !== 'string') return { ok: false };
  const v = raw.trim().toLowerCase();
  if (v === '' || v.length > SCENE_KEY_MAX) return { ok: false };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v)) return { ok: false };
  return { ok: true, value: v };
}

// image_url: optional. Delegates to the shared media URL policy
// (utils/mediaUrl.js): accepts a safe local /img/ path (covers the
// /img/vr/*.jpg placeholders) or an https://res.cloudinary.com delivery URL,
// and rejects http:, javascript:, data:, protocol-relative, traversal,
// arbitrary HTTPS hosts, and malformed URLs. Length is bounded by IMG_MAX
// (the VARCHAR(255) column) so the 400 message stays accurate.
function validateImageUrl(raw) {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false };
  const v = raw.trim();
  if (v === '') return { ok: true, value: null };
  if (v.length > IMG_MAX) return { ok: false };
  const safe = normalizeMediaUrl(v);
  if (safe === null) return { ok: false };
  return { ok: true, value: safe };
}

function validateScene(body) {
  if (!isPlainObject(body)) return { ok: false, message: 'Request body must be a JSON object.' };

  const key = validateSceneKey(body.scene_key);
  if (!key.ok) return { ok: false, message: 'Scene key must be a lowercase slug (letters, numbers, hyphens) up to ' + SCENE_KEY_MAX + ' characters.' };

  const title = reqStr(body.title, TITLE_MAX);
  if (!title.ok) return { ok: false, message: 'Title is required and must be ' + TITLE_MAX + ' characters or fewer.' };

  const description = optStr(body.description, DESC_MAX);
  if (!description.ok) return { ok: false, message: 'Description must be ' + DESC_MAX + ' characters or fewer.' };

  const image = validateImageUrl(body.image_url);
  if (!image.ok) return { ok: false, message: 'Image URL must be a local /img/ path or an https://res.cloudinary.com URL (max ' + IMG_MAX + ' chars).' };

  // Section 10.6: optional Cloudinary public id (delivery metadata only).
  const publicId = validateCloudinaryPublicId(body.cloudinary_public_id);
  if (!publicId.ok) return { ok: false, message: 'Cloudinary public ID may use only letters, numbers, "/", ".", "_", "-", "~" (max ' + IMG_MAX + ' chars).' };

  const node = optId(body.node_id);
  if (!node.ok) return { ok: false, message: 'Route node id must be a positive integer or empty.' };

  const building = optId(body.building_id);
  if (!building.ok) return { ok: false, message: 'Building id must be a positive integer or empty.' };

  const yaw = parseAngle(body.initial_yaw, YAW_MIN, YAW_MAX);
  if (!yaw.ok) return { ok: false, message: 'Initial yaw must be a number between ' + YAW_MIN + ' and ' + YAW_MAX + '.' };

  const pitch = parseAngle(body.initial_pitch, PITCH_MIN, PITCH_MAX);
  if (!pitch.ok) return { ok: false, message: 'Initial pitch must be a number between ' + PITCH_MIN + ' and ' + PITCH_MAX + '.' };

  const order = parseOrder(body.display_order);
  if (!order.ok) return { ok: false, message: 'Display order must be a whole number between 0 and ' + ORDER_MAX + '.' };

  return {
    ok: true,
    value: {
      scene_key: key.value,
      title: title.value,
      description: description.value,
      image_url: image.value,
      cloudinary_public_id: publicId.value,
      node_id: node.value,
      building_id: building.value,
      initial_yaw: yaw.value,
      initial_pitch: pitch.value,
      display_order: order.value
    }
  };
}

function validateHotspot(body) {
  if (!isPlainObject(body)) return { ok: false, message: 'Request body must be a JSON object.' };

  const type = typeof body.hotspot_type === 'string' ? body.hotspot_type.trim() : '';
  if (!HOTSPOT_TYPES.includes(type)) return { ok: false, message: 'Hotspot type must be one of: scene, info, exit, schedule.' };

  const label = reqStr(body.label, LABEL_MAX);
  if (!label.ok) return { ok: false, message: 'Label is required and must be ' + LABEL_MAX + ' characters or fewer.' };

  const text = optStr(body.text, TEXT_MAX);
  if (!text.ok) return { ok: false, message: 'Text must be ' + TEXT_MAX + ' characters or fewer.' };

  const yaw = parseAngle(body.yaw, YAW_MIN, YAW_MAX);
  if (!yaw.ok) return { ok: false, message: 'Yaw must be a number between ' + YAW_MIN + ' and ' + YAW_MAX + '.' };

  const pitch = parseAngle(body.pitch, PITCH_MIN, PITCH_MAX);
  if (!pitch.ok) return { ok: false, message: 'Pitch must be a number between ' + PITCH_MIN + ' and ' + PITCH_MAX + '.' };

  const order = parseOrder(body.display_order);
  if (!order.ok) return { ok: false, message: 'Display order must be a whole number between 0 and ' + ORDER_MAX + '.' };

  // 'scene' hotspots require a valid target; other types store NULL.
  let target_scene_id = null;
  if (type === 'scene') {
    const t = optId(body.target_scene_id);
    if (!t.ok || t.value === null) return { ok: false, message: 'A scene hotspot requires a valid target scene.' };
    target_scene_id = t.value;
  }

  let schedule_building_id = null;
  let schedule_location_type = null;
  let schedule_location_label = null;
  let schedule_floor_label = null;
  if (type === 'schedule') {
    const b = optId(body.schedule_building_id);
    if (!b.ok || b.value === null) return { ok: false, message: 'A schedule hotspot requires a valid building id.' };
    const locType = typeof body.schedule_location_type === 'string' ? body.schedule_location_type.trim() : '';
    if (!SCHEDULE_LOCATION_TYPES.includes(locType)) return { ok: false, message: 'Invalid schedule location type.' };
    const locLabel = reqStr(body.schedule_location_label, SCHEDULE_LOCATION_LABEL_MAX);
    if (!locLabel.ok) return { ok: false, message: 'Schedule location label is required and must be ' + SCHEDULE_LOCATION_LABEL_MAX + ' characters or fewer.' };
    const floorLabel = optStr(body.schedule_floor_label, SCHEDULE_FLOOR_LABEL_MAX);
    if (!floorLabel.ok) return { ok: false, message: 'Schedule floor label must be ' + SCHEDULE_FLOOR_LABEL_MAX + ' characters or fewer.' };
    schedule_building_id = b.value;
    schedule_location_type = locType;
    schedule_location_label = locLabel.value;
    schedule_floor_label = floorLabel.value;
  }

  return {
    ok: true,
    value: {
      hotspot_type: type,
      label: label.value,
      text: text.value,
      yaw: yaw.value,
      pitch: pitch.value,
      display_order: order.value,
      target_scene_id,
      schedule_building_id,
      schedule_location_type,
      schedule_location_label,
      schedule_floor_label
    }
  };
}

async function assertScheduleHotspotBuilding(v, conn) {
  if (!v || v.hotspot_type !== 'schedule') return;
  if (vrDataSource.isSupabase()) {
    if (!(await vrRepository.buildingExists(v.schedule_building_id))) {
      throw new ApiError(404, 'Building not found.');
    }
    return;
  }
  const q = conn || db;
  const [b] = await q.query('SELECT id FROM buildings WHERE id = ? LIMIT 1', [v.schedule_building_id]);
  if (!b.length) throw new ApiError(404, 'Building not found.');
}

/* ============================================================
   SCENES
============================================================ */

exports.listScenes = async (req, res) => {
  try {
    let scenes;
    if (vrDataSource.isSupabase()) {
      scenes = await vrRepository.listScenesAdmin();
    } else {
      const [rows] = await db.query(
        'SELECT ' + SCENE_ADMIN_COLS_SQL + ' FROM vr_scenes ORDER BY display_order ASC, id ASC'
      );
      scenes = rows;
    }
    return res.status(200).json({ success: true, scenes, total: scenes.length });
  } catch (e) {
    return handleErr(res, e, 'listScenes');
  }
};

exports.getScene = async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ success: false, message: 'Invalid scene id.' });
  try {
    let scene;
    if (vrDataSource.isSupabase()) {
      scene = await vrRepository.findSceneById(id);
    } else {
      const [rows] = await db.query('SELECT ' + SCENE_ADMIN_COLS_SQL + ' FROM vr_scenes WHERE id = ?', [id]);
      scene = rows[0] || null;
    }
    if (!scene) return res.status(404).json({ success: false, message: 'Scene not found.' });
    return res.status(200).json({ success: true, scene });
  } catch (e) {
    return handleErr(res, e, 'getScene');
  }
};

exports.createScene = async (req, res) => {
  const v = validateScene(req.body);
  if (!v.ok) return res.status(400).json({ success: false, message: v.message });

  try {
    let scene;
    if (vrDataSource.isSupabase()) {
      if ((await vrRepository.findSceneIdByKey(v.value.scene_key)) !== null) {
        throw new ApiError(409, 'A scene with this scene key already exists.');
      }
      if (v.value.node_id !== null && !(await vrRepository.nodeExists(v.value.node_id))) {
        throw new ApiError(404, 'Route node not found.');
      }
      if (v.value.building_id !== null && !(await vrRepository.buildingExists(v.value.building_id))) {
        throw new ApiError(404, 'Building not found.');
      }
      scene = await vrRepository.insertScene(v.value);
    } else {
      scene = await withTx(async (conn) => {
        const [dup] = await conn.query('SELECT id FROM vr_scenes WHERE scene_key = ? LIMIT 1', [v.value.scene_key]);
        if (dup.length) throw new ApiError(409, 'A scene with this scene key already exists.');
        if (v.value.node_id !== null) {
          const [n] = await conn.query('SELECT id FROM route_nodes WHERE id = ? LIMIT 1', [v.value.node_id]);
          if (!n.length) throw new ApiError(404, 'Route node not found.');
        }
        if (v.value.building_id !== null) {
          const [b] = await conn.query('SELECT id FROM buildings WHERE id = ? LIMIT 1', [v.value.building_id]);
          if (!b.length) throw new ApiError(404, 'Building not found.');
        }
        const [result] = await conn.query(
          'INSERT INTO vr_scenes (scene_key, title, description, image_url, cloudinary_public_id, node_id, building_id, initial_yaw, initial_pitch, display_order) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [v.value.scene_key, v.value.title, v.value.description, v.value.image_url, v.value.cloudinary_public_id,
           v.value.node_id, v.value.building_id, v.value.initial_yaw, v.value.initial_pitch, v.value.display_order]
        );
        const [rows] = await conn.query('SELECT ' + SCENE_ADMIN_COLS_SQL + ' FROM vr_scenes WHERE id = ?', [result.insertId]);
        return rows[0];
      });
    }

    auditVr(req, 'admin.vr.scene.create', 'vr_scene', scene && scene.id, 'Admin created a VR scene.');
    return res.status(201).json({ success: true, message: 'Scene created successfully.', scene });
  } catch (e) {
    return handleErr(res, e, 'createScene');
  }
};

exports.updateScene = async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ success: false, message: 'Invalid scene id.' });

  const v = validateScene(req.body);
  if (!v.ok) return res.status(400).json({ success: false, message: v.message });

  try {
    let scene;
    if (vrDataSource.isSupabase()) {
      if (!(await vrRepository.sceneExists(id))) throw new ApiError(404, 'Scene not found.');
      if ((await vrRepository.findSceneIdByKey(v.value.scene_key, id)) !== null) {
        throw new ApiError(409, 'A scene with this scene key already exists.');
      }
      if (v.value.node_id !== null && !(await vrRepository.nodeExists(v.value.node_id))) {
        throw new ApiError(404, 'Route node not found.');
      }
      if (v.value.building_id !== null && !(await vrRepository.buildingExists(v.value.building_id))) {
        throw new ApiError(404, 'Building not found.');
      }
      scene = await vrRepository.updateSceneById(id, v.value);
      if (!scene) throw new ApiError(404, 'Scene not found.');
    } else {
      scene = await withTx(async (conn) => {
        const [exist] = await conn.query('SELECT id FROM vr_scenes WHERE id = ? LIMIT 1', [id]);
        if (!exist.length) throw new ApiError(404, 'Scene not found.');
        const [dup] = await conn.query('SELECT id FROM vr_scenes WHERE scene_key = ? AND id <> ? LIMIT 1', [v.value.scene_key, id]);
        if (dup.length) throw new ApiError(409, 'A scene with this scene key already exists.');
        if (v.value.node_id !== null) {
          const [n] = await conn.query('SELECT id FROM route_nodes WHERE id = ? LIMIT 1', [v.value.node_id]);
          if (!n.length) throw new ApiError(404, 'Route node not found.');
        }
        if (v.value.building_id !== null) {
          const [b] = await conn.query('SELECT id FROM buildings WHERE id = ? LIMIT 1', [v.value.building_id]);
          if (!b.length) throw new ApiError(404, 'Building not found.');
        }
        await conn.query(
          'UPDATE vr_scenes SET scene_key = ?, title = ?, description = ?, image_url = ?, cloudinary_public_id = ?, node_id = ?, building_id = ?, ' +
          'initial_yaw = ?, initial_pitch = ?, display_order = ?, updated_at = NOW() WHERE id = ?',
          [v.value.scene_key, v.value.title, v.value.description, v.value.image_url, v.value.cloudinary_public_id,
           v.value.node_id, v.value.building_id, v.value.initial_yaw, v.value.initial_pitch, v.value.display_order, id]
        );
        const [rows] = await conn.query('SELECT ' + SCENE_ADMIN_COLS_SQL + ' FROM vr_scenes WHERE id = ?', [id]);
        return rows[0];
      });
    }

    auditVr(req, 'admin.vr.scene.update', 'vr_scene', id, 'Admin updated a VR scene.');
    return res.status(200).json({ success: true, message: 'Scene updated successfully.', scene });
  } catch (e) {
    return handleErr(res, e, 'updateScene');
  }
};

exports.deleteScene = async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ success: false, message: 'Invalid scene id.' });

  const BLOCKED_MSG = 'This scene is targeted by one or more hotspots. Update or remove those hotspots before deleting this scene.';

  try {
    if (vrDataSource.isSupabase()) {
      if (!(await vrRepository.sceneExists(id))) throw new ApiError(404, 'Scene not found.');
      if ((await vrRepository.countHotspotsTargetingScene(id)) > 0) throw new ApiError(409, BLOCKED_MSG);
      const deleted = await vrRepository.deleteSceneById(id);
      if (deleted === null) throw new ApiError(404, 'Scene not found.');
    } else {
      await withTx(async (conn) => {
        const [exist] = await conn.query('SELECT id FROM vr_scenes WHERE id = ? LIMIT 1', [id]);
        if (!exist.length) throw new ApiError(404, 'Scene not found.');
        const [refs] = await conn.query('SELECT id FROM vr_hotspots WHERE target_scene_id = ? LIMIT 1', [id]);
        if (refs.length) throw new ApiError(409, BLOCKED_MSG);
        await conn.query('DELETE FROM vr_scenes WHERE id = ?', [id]);
      });
    }

    auditVr(req, 'admin.vr.scene.delete', 'vr_scene', id, 'Admin deleted a VR scene.');
    return res.status(200).json({ success: true, message: 'Scene deleted successfully.' });
  } catch (e) {
    return handleErr(res, e, 'deleteScene');
  }
};

/* ============================================================
   HOTSPOTS
============================================================ */

exports.listHotspots = async (req, res) => {
  const sceneId = parseId(req.params.sceneId);
  if (sceneId === null) return res.status(400).json({ success: false, message: 'Invalid scene id.' });

  try {
    let hotspots;
    if (vrDataSource.isSupabase()) {
      if (!(await vrRepository.sceneExists(sceneId))) return res.status(404).json({ success: false, message: 'Scene not found.' });
      hotspots = await vrRepository.listHotspotsAdmin(sceneId);
    } else {
      const [s] = await db.query('SELECT id FROM vr_scenes WHERE id = ? LIMIT 1', [sceneId]);
      if (!s.length) return res.status(404).json({ success: false, message: 'Scene not found.' });
      const [rows] = await db.query(
        HOTSPOT_SELECT_SQL + ' WHERE h.scene_id = ? ORDER BY h.display_order ASC, h.id ASC',
        [sceneId]
      );
      hotspots = rows;
    }
    return res.status(200).json({ success: true, hotspots, total: hotspots.length });
  } catch (e) {
    return handleErr(res, e, 'listHotspots');
  }
};

exports.createHotspot = async (req, res) => {
  const sceneId = parseId(req.params.sceneId);
  if (sceneId === null) return res.status(400).json({ success: false, message: 'Invalid scene id.' });

  const v = validateHotspot(req.body);
  if (!v.ok) return res.status(400).json({ success: false, message: v.message });

  try {
    let hotspot;
    if (vrDataSource.isSupabase()) {
      if (!(await vrRepository.sceneExists(sceneId))) throw new ApiError(404, 'Scene not found.');
      if (v.value.hotspot_type === 'scene') {
        if (Number(v.value.target_scene_id) === Number(sceneId)) throw new ApiError(400, 'A scene hotspot cannot target its own scene.');
        if (!(await vrRepository.sceneExists(v.value.target_scene_id))) throw new ApiError(404, 'Target scene not found.');
      }
      await assertScheduleHotspotBuilding(v.value);
      hotspot = await vrRepository.insertHotspot(Object.assign({ scene_id: sceneId }, v.value));
    } else {
      hotspot = await withTx(async (conn) => {
        const [s] = await conn.query('SELECT id FROM vr_scenes WHERE id = ? LIMIT 1', [sceneId]);
        if (!s.length) throw new ApiError(404, 'Scene not found.');
        if (v.value.hotspot_type === 'scene') {
          if (Number(v.value.target_scene_id) === Number(sceneId)) throw new ApiError(400, 'A scene hotspot cannot target its own scene.');
          const [t] = await conn.query('SELECT id FROM vr_scenes WHERE id = ? LIMIT 1', [v.value.target_scene_id]);
          if (!t.length) throw new ApiError(404, 'Target scene not found.');
        }
        await assertScheduleHotspotBuilding(v.value, conn);
        const [result] = await conn.query(
          'INSERT INTO vr_hotspots (scene_id, target_scene_id, hotspot_type, label, `text`, schedule_building_id, schedule_location_type, schedule_location_label, schedule_floor_label, yaw, pitch, display_order) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [sceneId, v.value.target_scene_id, v.value.hotspot_type, v.value.label, v.value.text,
           v.value.schedule_building_id, v.value.schedule_location_type, v.value.schedule_location_label, v.value.schedule_floor_label,
           v.value.yaw, v.value.pitch, v.value.display_order]
        );
        const [rows] = await conn.query(HOTSPOT_SELECT_SQL + ' WHERE h.id = ?', [result.insertId]);
        return rows[0];
      });
    }

    auditVr(req, 'admin.vr.hotspot.create', 'vr_hotspot', hotspot && hotspot.id, 'Admin created a VR hotspot.');
    return res.status(201).json({ success: true, message: 'Hotspot created successfully.', hotspot });
  } catch (e) {
    return handleErr(res, e, 'createHotspot');
  }
};

exports.updateHotspot = async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ success: false, message: 'Invalid hotspot id.' });

  const v = validateHotspot(req.body);
  if (!v.ok) return res.status(400).json({ success: false, message: v.message });

  try {
    let hotspot;
    if (vrDataSource.isSupabase()) {
      const existing = await vrRepository.findHotspotById(id);
      if (!existing) throw new ApiError(404, 'Hotspot not found.');
      if (v.value.hotspot_type === 'scene') {
        if (Number(v.value.target_scene_id) === Number(existing.scene_id)) throw new ApiError(400, 'A scene hotspot cannot target its own scene.');
        if (!(await vrRepository.sceneExists(v.value.target_scene_id))) throw new ApiError(404, 'Target scene not found.');
      }
      await assertScheduleHotspotBuilding(v.value);
      hotspot = await vrRepository.updateHotspotById(id, v.value);
      if (!hotspot) throw new ApiError(404, 'Hotspot not found.');
    } else {
      hotspot = await withTx(async (conn) => {
        const [h] = await conn.query('SELECT id, scene_id FROM vr_hotspots WHERE id = ? LIMIT 1', [id]);
        if (!h.length) throw new ApiError(404, 'Hotspot not found.');
        const sceneId = h[0].scene_id;
        if (v.value.hotspot_type === 'scene') {
          if (Number(v.value.target_scene_id) === Number(sceneId)) throw new ApiError(400, 'A scene hotspot cannot target its own scene.');
          const [t] = await conn.query('SELECT id FROM vr_scenes WHERE id = ? LIMIT 1', [v.value.target_scene_id]);
          if (!t.length) throw new ApiError(404, 'Target scene not found.');
        }
        await assertScheduleHotspotBuilding(v.value, conn);
        await conn.query(
          'UPDATE vr_hotspots SET target_scene_id = ?, hotspot_type = ?, label = ?, `text` = ?, schedule_building_id = ?, schedule_location_type = ?, schedule_location_label = ?, schedule_floor_label = ?, yaw = ?, pitch = ?, display_order = ?, updated_at = NOW() WHERE id = ?',
          [v.value.target_scene_id, v.value.hotspot_type, v.value.label, v.value.text,
           v.value.schedule_building_id, v.value.schedule_location_type, v.value.schedule_location_label, v.value.schedule_floor_label,
           v.value.yaw, v.value.pitch, v.value.display_order, id]
        );
        const [rows] = await conn.query(HOTSPOT_SELECT_SQL + ' WHERE h.id = ?', [id]);
        return rows[0];
      });
    }

    auditVr(req, 'admin.vr.hotspot.update', 'vr_hotspot', id, 'Admin updated a VR hotspot.');
    return res.status(200).json({ success: true, message: 'Hotspot updated successfully.', hotspot });
  } catch (e) {
    return handleErr(res, e, 'updateHotspot');
  }
};

exports.deleteHotspot = async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ success: false, message: 'Invalid hotspot id.' });

  try {
    if (vrDataSource.isSupabase()) {
      const deleted = await vrRepository.deleteHotspotById(id);
      if (deleted === null) throw new ApiError(404, 'Hotspot not found.');
    } else {
      await withTx(async (conn) => {
        const [h] = await conn.query('SELECT id FROM vr_hotspots WHERE id = ? LIMIT 1', [id]);
        if (!h.length) throw new ApiError(404, 'Hotspot not found.');
        await conn.query('DELETE FROM vr_hotspots WHERE id = ?', [id]);
      });
    }

    auditVr(req, 'admin.vr.hotspot.delete', 'vr_hotspot', id, 'Admin deleted a VR hotspot.');
    return res.status(200).json({ success: true, message: 'Hotspot deleted successfully.' });
  } catch (e) {
    return handleErr(res, e, 'deleteHotspot');
  }
};
