/* ========================================
   CampuSphere — Admin Buildings Controller
   CRUD API for the buildings table
   ======================================== */

const db = require('../config/db');
const mapRuntime = require('../config/mapRuntime');
const buildingRepository = require('../repositories/buildingRepository');
const routeRepository = require('../repositories/routeRepository');
const scheduleRepository = require('../repositories/scheduleRepository');
const auditService = require('../services/auditService');
const routeAvailability = require('../services/routeAvailability');
const V = require('../utils/adminValidation');
const { validateImageUrlField, validateCloudinaryPublicId } = require('../utils/mediaUrl');

// R7: building category allowlist mirrors the admin UI option set
// (views/admin/campus-map.ejs). Field caps mirror the schema / spec.
const BUILDING_CATEGORIES = ['Academic', 'Administrative', 'Student Services', 'Sports', 'Facilities'];
const BUILDING_KEYS = ['name', 'category', 'description', 'lat', 'lng', 'details', 'image_url', 'cloudinary_public_id'];
const BUILDING_MAX_NAME = 150;
const BUILDING_MAX_DESCRIPTION = 5000;
const BUILDING_MEDIA_MAX = 255; // mirrors buildings.image_url / cloudinary_public_id VARCHAR(255)
// Admin building CRUD response columns (explicit; Section 10.6 adds the media
// metadata fields so the admin response carries them on BOTH backends).
const BUILDING_ADMIN_COLS_SQL =
  'id, name, category, description, lat, lng, details, image_url, cloudinary_public_id, created_at, updated_at';

// Best-effort audit of a successful admin mutation. Fire-and-forget: it never
// throws, never blocks, and never changes the JSON response. The actor is the
// admin in session (the route is gated by requireRole('admin')).
function auditAdminMutation(req, action, targetType, targetId, message) {
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

// Run a MySQL mutation inside a transaction: begin -> fn(conn) -> commit, with
// rollback on any throw and a guaranteed release. Mirrors the helper in
// controllers/adminVrController.js. Never logs a raw error, SQL, payload,
// secret, or session/cookie value — the caller's catch maps a throw to a fixed
// sanitized 500.
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

/**
 * Validate + normalize a building create/update body. Returns { ok, value }
 * with exactly { name, category, description, lat, lng, details } (description
 * null when blank; details a canonical JSON string or null; lat/lng finite
 * numbers in range), or { ok:false, message }. No DB work, no extras.
 */
function validateBuildingPayload(body) {
  const shape = V.validateBody(body, BUILDING_KEYS);
  if (!shape.ok) return shape;

  const name = V.requiredString(body.name, 'Name', BUILDING_MAX_NAME);
  if (!name.ok) return name;
  const category = V.allowedValue(body.category, 'category', BUILDING_CATEGORIES);
  if (!category.ok) return category;
  const description = V.optionalString(body.description, 'Description', BUILDING_MAX_DESCRIPTION);
  if (!description.ok) return description;
  const lat = V.validateNumberInRange(body.lat, 'Latitude', -90, 90);
  if (!lat.ok) return lat;
  const lng = V.validateNumberInRange(body.lng, 'Longitude', -180, 180);
  if (!lng.ok) return lng;
  const details = V.validateDetails(body.details);
  if (!details.ok) return details;

  // Section 10.6: optional Cloudinary media metadata. image_url runs the shared
  // media URL policy (local /img/ or https://res.cloudinary.com only);
  // cloudinary_public_id runs the conservative public-id policy. Both are
  // optional (blank -> null). Fixed sanitized messages; never echo the value.
  const imageUrl = validateImageUrlField(body.image_url, BUILDING_MEDIA_MAX);
  if (!imageUrl.ok) return { ok: false, message: 'Image URL must be a local /img/ path or an https://res.cloudinary.com URL (max ' + BUILDING_MEDIA_MAX + ' chars).' };
  const publicId = validateCloudinaryPublicId(body.cloudinary_public_id);
  if (!publicId.ok) return { ok: false, message: 'Cloudinary public ID may use only letters, numbers, "/", ".", "_", "-", "~" (max ' + BUILDING_MEDIA_MAX + ' chars).' };

  return {
    ok: true,
    value: {
      name: name.value,
      category: category.value,
      description: description.value === '' ? null : description.value,
      lat: lat.value,
      lng: lng.value,
      details: details.value,
      image_url: imageUrl.value,
      cloudinary_public_id: publicId.value
    }
  };
}

/**
 * GET /admin/api/buildings — Admin building list (BE.3).
 *
 * Returns the explicit admin row shape (BUILDING_ADMIN_COLS_SQL) plus the
 * sanitized availability fields, so an admin can see at a glance which buildings
 * are staged-but-not-yet-routable. Availability is computed by the SAME shared
 * service the public surfaces use, so admin and public can never disagree.
 *
 * Admin-only (the whole /admin namespace is gated by requireRole('admin')).
 */
exports.listBuildings = async (req, res) => {
  try {
    // buildingRepository.listAll() already selects exactly BUILDING_ADMIN_COLS_SQL,
    // so both backends return the identical explicit admin row shape.
    let rows;
    if (mapRuntime.isBuildingSupabase()) {
      rows = await buildingRepository.listAll();
    } else {
      [rows] = await db.query(
        'SELECT ' + BUILDING_ADMIN_COLS_SQL + ' FROM buildings ORDER BY id ASC'
      );
    }
    const decorated = await routeAvailability.decorateBuildings(rows || []);
    return res.json({ success: true, buildings: decorated.buildings });
  } catch (error) {
    console.error('Error listing buildings: unexpected failure.');
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * POST /admin/api/buildings — Create a building
 */
exports.createBuilding = async (req, res) => {
  const check = validateBuildingPayload(req.body);
  if (!check.ok) {
    return res.status(400).json({ success: false, message: check.message });
  }
  const value = check.value; // { name, category, description, lat, lng, details }

  try {
    // BE.3 repair: two buildings sharing a canonical name cannot be told apart by
    // the name join that maps buildings to routes, so BOTH would become
    // `ambiguous_name` and lose their destination. Reject the collision up front
    // with a sanitized 409 instead. Checked against the ACTIVE building source.
    // (Friendly guard only — concurrent writes can still slip past it, which is
    // why buildAvailabilityIndex() stays fail-closed on collisions.)
    if (await routeAvailability.canonicalNameCollides(value.name, null)) {
      return res.status(409).json({
        success: false,
        message: 'Another building already uses this name. Building names must be unique.'
      });
    }

    // Persist through the repository when BUILDING_DATA_SOURCE=supabase
    // (location is computed server-side by the RPC); otherwise the existing
    // MySQL INSERT + SELECT path runs unchanged. Both return the same row shape.
    let building;
    if (mapRuntime.isBuildingSupabase()) {
      building = await buildingRepository.create({
        name: value.name,
        category: value.category,
        description: value.description,
        lat: value.lat,
        lng: value.lng,
        details: value.details,
        image_url: value.image_url,
        cloudinary_public_id: value.cloudinary_public_id
      });
    } else {
      const [result] = await db.query(
        'INSERT INTO buildings (name, category, description, lat, lng, details, image_url, cloudinary_public_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [value.name, value.category, value.description, value.lat, value.lng, value.details, value.image_url, value.cloudinary_public_id]
      );
      // Section 10.6: explicit admin CRUD shape (not SELECT *) including the media
      // metadata columns, identical to the Supabase write-row shape.
      const [[row]] = await db.query(
        'SELECT ' + BUILDING_ADMIN_COLS_SQL + ' FROM buildings WHERE id = ?',
        [result.insertId]
      );
      building = row;
    }

    // BE.3: the client replaces its local row with THIS response, so the created
    // row must already carry the availability fields — otherwise a freshly
    // created (and necessarily unrouted) building would render as if it were
    // route-ready until the next full reload.
    const dec = await routeAvailability.decorateBuilding(building);
    building = dec.building;

    auditAdminMutation(req, 'admin.building.create', 'building', building && building.id, 'Admin created a building.');
    return res.json({ success: true, message: 'Building created.', building });
  } catch (error) {
    console.error('Error creating building: unexpected failure.');
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PUT /admin/api/buildings/:id — Update a building
 */
exports.updateBuilding = async (req, res) => {
  const id = V.parseRouteId(req.params.id);
  if (id === null) {
    return res.status(400).json({ success: false, message: 'Invalid building id.' });
  }

  const check = validateBuildingPayload(req.body);
  if (!check.ok) {
    return res.status(400).json({ success: false, message: check.message });
  }
  const value = check.value; // { name, category, description, lat, lng, details }

  try {
    // BE.3 repair: a RENAME must not collide with another building's canonical
    // name (see createBuilding). The edited row is excluded, so a building may
    // always keep — or re-save — its own name.
    if (await routeAvailability.canonicalNameCollides(value.name, id)) {
      return res.status(409).json({
        success: false,
        message: 'Another building already uses this name. Building names must be unique.'
      });
    }

    // Existence-check then persist. Supabase branch when
    // BUILDING_DATA_SOURCE=supabase; otherwise the existing MySQL path.
    let building;
    if (mapRuntime.isBuildingSupabase()) {
      const existing = await buildingRepository.findById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Building not found.' });
      }
      building = await buildingRepository.update(id, {
        name: value.name,
        category: value.category,
        description: value.description,
        lat: value.lat,
        lng: value.lng,
        details: value.details,
        image_url: value.image_url,
        cloudinary_public_id: value.cloudinary_public_id
      });
    } else {
      const [existing] = await db.query('SELECT id FROM buildings WHERE id = ?', [id]);
      if (existing.length === 0) {
        return res.status(404).json({ success: false, message: 'Building not found.' });
      }

      await db.query(
        'UPDATE buildings SET name = ?, category = ?, description = ?, lat = ?, lng = ?, details = ?, image_url = ?, cloudinary_public_id = ? WHERE id = ?',
        [value.name, value.category, value.description, value.lat, value.lng, value.details, value.image_url, value.cloudinary_public_id, id]
      );

      // Section 10.6: explicit admin CRUD shape (not SELECT *) including the media
      // metadata columns, matching the Supabase write-row shape.
      const [[row]] = await db.query(
        'SELECT ' + BUILDING_ADMIN_COLS_SQL + ' FROM buildings WHERE id = ?',
        [id]
      );
      building = row;
    }

    // BE.3: decorate for the same reason as create — and because a RENAME can
    // change availability (the route-source join is by canonical name), so the
    // fresh row must reflect the post-rename truth.
    const dec = await routeAvailability.decorateBuilding(building);
    building = dec.building;

    auditAdminMutation(req, 'admin.building.update', 'building', id, 'Admin updated a building.');
    return res.json({ success: true, message: 'Building updated.', building });
  } catch (error) {
    console.error('Error updating building: unexpected failure.');
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * DELETE /admin/api/buildings/:id — Delete a building
 */
exports.deleteBuilding = async (req, res) => {
  const id = V.parseRouteId(req.params.id);
  if (id === null) {
    return res.status(400).json({ success: false, message: 'Invalid building id.' });
  }

  try {
    // R5 / Section 7.9 destructive-delete guard: a building referenced by a
    // campus route as its destination must NOT be deleted. The DB FK is
    // ON DELETE CASCADE (both MySQL and Supabase), so deleting the building
    // would silently take the route — and its ordered steps — with it. Block
    // with 409 in both runtime modes, after the 404 existence check and BEFORE
    // any delete, so no building/route/step/graph/VR/audit mutation occurs.
    const ROUTE_REF_MESSAGE = 'This building is used by one or more campus routes. Update or remove those routes before deleting this building.';
    // Milestone 11, Section 11.5: room_schedules also reference buildings
    // (FK ON DELETE RESTRICT in both backends), so a referenced building
    // must return a clean 409 instead of surfacing a raw FK failure as 500.
    const SCHEDULE_REF_MESSAGE = 'This building has room schedule entries. Delete those schedule entries before deleting this building.';

    // Existence-check, then route-dependency guard, then schedule-dependency
    // guard, then delete. Supabase branch when BUILDING_DATA_SOURCE=supabase;
    // otherwise the MySQL path. The schedule pre-check goes through
    // scheduleRepository so it always inspects the ACTIVE schedule backend
    // (SCHEDULE_DATA_SOURCE), which may differ from the building source.
    if (mapRuntime.isBuildingSupabase()) {
      const existing = await buildingRepository.findById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Building not found.' });
      }
      const routeRefs = await routeRepository.adminCountRoutesByBuilding(id);
      if (routeRefs > 0) {
        return res.status(409).json({ success: false, message: ROUTE_REF_MESSAGE });
      }
      const scheduleRefs = await scheduleRepository.countSchedulesByBuilding(id);
      if (scheduleRefs > 0) {
        return res.status(409).json({ success: false, message: SCHEDULE_REF_MESSAGE });
      }
      await buildingRepository.delete(id);
    } else {
      // Runtime-source schedule guard (see comment above); the tx re-check
      // below covers same-backend races, and the MySQL FK RESTRICT backstops.
      const scheduleRefs = await scheduleRepository.countSchedulesByBuilding(id);
      // L2 TOCTOU hardening: lock the target building row, re-check route
      // references, and delete inside ONE transaction. SELECT ... FOR UPDATE
      // holds the building row's lock, so a concurrent campus_routes insert
      // referencing it must acquire the FK parent lock and therefore blocks
      // until this transaction commits — by which point the building is gone,
      // so the insert fails cleanly instead of racing the guard and being
      // silently ON DELETE CASCADE-removed. Response contracts are unchanged:
      // the outcome status is mapped to 404 / 409 after the tx, and only a
      // committed delete falls through to the audit + 200 below.
      const outcome = await withTx(async (conn) => {
        const [existing] = await conn.query('SELECT id FROM buildings WHERE id = ? FOR UPDATE', [id]);
        if (existing.length === 0) return { status: 404 };

        const [routeRefs] = await conn.query(
          'SELECT id FROM campus_routes WHERE destination_building_id = ? LIMIT 1',
          [id]
        );
        if (routeRefs.length > 0) return { status: 409, reason: 'route' };

        // Schedule guard: the runtime-source count captured before the tx,
        // plus a same-backend re-check on the tx connection while the
        // building row is locked (mirrors the route re-check above).
        if (scheduleRefs > 0) return { status: 409, reason: 'schedule' };
        const [schedRefs] = await conn.query(
          'SELECT id FROM room_schedules WHERE building_id = ? LIMIT 1',
          [id]
        );
        if (schedRefs.length > 0) return { status: 409, reason: 'schedule' };

        await conn.query('DELETE FROM buildings WHERE id = ?', [id]);
        return { status: 200 };
      });

      if (outcome.status === 404) {
        return res.status(404).json({ success: false, message: 'Building not found.' });
      }
      if (outcome.status === 409) {
        return res.status(409).json({
          success: false,
          message: outcome.reason === 'schedule' ? SCHEDULE_REF_MESSAGE : ROUTE_REF_MESSAGE
        });
      }
    }

    auditAdminMutation(req, 'admin.building.delete', 'building', id, 'Admin deleted a building.');
    return res.json({ success: true, message: 'Building deleted.' });
  } catch (error) {
    console.error('Error deleting building: unexpected failure.');
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};
