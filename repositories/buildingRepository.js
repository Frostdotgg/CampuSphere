'use strict';

/* ========================================
   CampuSphere - Building Repository
   Milestone 3, Sections 3.4 (reads) + 3.6 (writes).

   Supabase-backed methods for the `buildings` table:
   - READ (Section 3.4): listAll, findById, search, countAll,
     listAllOrderedByName, plus the `vr_route_id` decoration helper
     listVrRouteIdByBuilding (which reads `campus_routes`).
   - WRITE (Section 3.6): create / update / delete, backed by the
     PostgreSQL functions in
     database/supabase/0005_building_write_functions.sql
     (app_create_building / app_update_building / app_delete_building)
     and called via Supabase `.rpc(...)`. Those functions populate and
     refresh the PostGIS `location` column from lat/lng.

   No controller calls the write methods yet: read consumers are wired
   behind BUILDING_DATA_SOURCE (Section 3.5); admin building CRUD writes
   are wired in Section 3.7.

   Boundary rules (see database/supabase/REPOSITORY_BOUNDARIES.md s6):
   - Imports `config/supabase.js` ONLY. It does NOT import
     `config/db.js`, any controller, route, view, or middleware.
   - Never reads req / res / sessions / res.locals / app.locals /
     browser globals. Access control and input validation
     (validateDetails / validateCoord) stay in controllers/routes; the
     write methods accept pre-validated values.
   - Read methods return plain row-like objects and do NOT shape the
     final API/EJS response; `utils/buildingData.normalizeBuildingRow`
     (called by controllers) still owns normalisation. `details` comes
     back as a parsed object (jsonb), which `parseBuildingDetails`
     already accepts. Write methods return the row in the admin CRUD
     shape with `details` as a JSON string, matching the MySQL admin row.
   - `lat` / `lng` are Postgres `numeric`; `toCoord(Number(...))` in
     normalizeBuildingRow handles either numeric or string form, so
     callers are unaffected.
   - Supabase errors are rethrown as plain Error objects prefixed with
     `buildingRepository.<method>:` and carry only the safe Supabase
     message (no keys, URLs, or credentials).

   `listVrRouteIdByBuilding` decorates buildings with vr_route_id for both
   /buildings and /map. REPOSITORY_BOUNDARIES.md s8 marks the canonical home
   as `routeRepository`; as of Section 3.8 that method ships there and this
   module delegates to it. No circular import: routeRepository imports only
   config/supabase, never buildingRepository.
   ======================================== */

const { getSupabaseClient } = require('../config/supabase');
const routeRepository = require('./routeRepository');

// Explicit column list: everything a controller could use, minus the
// PostGIS `location` geography blob (the UI reads lat/lng directly).
const BUILDING_COLUMNS =
  'id, name, category, description, lat, lng, details, image_url, cloudinary_public_id, created_at, updated_at';

// Defensive limit clamp for search. Default 25 (matches the current
// MySQL apiSearch MAX_RESULTS); hard ceiling 100 so a crafted/oversized
// limit can never request an unbounded scan.
const DEFAULT_SEARCH_LIMIT = 25;
const MAX_SEARCH_LIMIT = 100;

function clampLimit(limit) {
  const n = Number(limit);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SEARCH_LIMIT;
  return Math.min(Math.floor(n), MAX_SEARCH_LIMIT);
}

// Wrap a Supabase error as a plain Error with a fixed method prefix and
// only the safe message string. Never includes keys/URLs/credentials.
function fail(method, error) {
  const msg = error && error.message ? error.message : 'Supabase request failed.';
  return new Error('buildingRepository.' + method + ': ' + msg);
}

// Coerce a `details` value (the controller passes a validated JSON string, an
// object, or null/blank) into a jsonb-ready object or null for the RPC param.
function toDetailsParam(details) {
  if (details == null) return null;
  if (typeof details === 'object') return details;
  const s = String(details).trim();
  if (s === '') return null;
  try {
    return JSON.parse(s);
  } catch {
    throw new Error('buildingRepository: details must be valid JSON.');
  }
}

// Shape a write-RPC row back to the admin CRUD contract. `details` is returned
// as a JSON string (or null) to match the MySQL admin row shape (TEXT column)
// that adminBuildingsController + admin-buildings.js expect.
function shapeWriteRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    lat: row.lat,
    lng: row.lng,
    details: row.details == null
      ? null
      : (typeof row.details === 'string' ? row.details : JSON.stringify(row.details)),
    // Section 10.6: admin CRUD response carries the media metadata fields.
    image_url: row.image_url == null ? null : row.image_url,
    cloudinary_public_id: row.cloudinary_public_id == null ? null : row.cloudinary_public_id,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// Section 10.6: the building write RPCs (app_create_building / app_update_building)
// do NOT handle image_url / cloudinary_public_id, so persist those via a narrow
// server-only table UPDATE (service-role client; no SQL migration), then reselect
// the FULL row so the admin response carries every field. Never derives a
// delivery URL from cloudinary_public_id — it is stored metadata only.
async function persistBuildingMedia(sb, id, image_url, cloudinary_public_id) {
  const { data, error } = await sb
    .from('buildings')
    .update({
      image_url: image_url == null ? null : image_url,
      cloudinary_public_id: cloudinary_public_id == null ? null : cloudinary_public_id
    })
    .eq('id', id)
    .select(BUILDING_COLUMNS)
    .maybeSingle();
  if (error) throw fail('persistBuildingMedia', error);
  return data || null;
}

/**
 * All buildings ordered by id ASC (mirrors the public /buildings and
 * /map MySQL `ORDER BY id ASC`).
 */
async function listAll() {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('buildings')
    .select(BUILDING_COLUMNS)
    .order('id', { ascending: true });
  if (error) throw fail('listAll', error);
  return data || [];
}

/**
 * First buildings by canonical id order, with an exact bounded limit.
 * Used by small dashboard projections that must not fetch the full catalog.
 */
async function listFirstById(limit) {
  const parsedLimit = Number(limit);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > MAX_SEARCH_LIMIT) {
    throw new Error('buildingRepository.listFirstById: limit must be an integer from 1 to 100.');
  }
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('buildings')
    .select(BUILDING_COLUMNS)
    .order('id', { ascending: true })
    .limit(parsedLimit);
  if (error) throw fail('listFirstById', error);
  return data || [];
}

/**
 * Single building by id, or null when absent / id is not a positive
 * integer. Controllers still validate ids; this is a safe guard.
 */
async function findById(id) {
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId < 1) return null;
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('buildings')
    .select(BUILDING_COLUMNS)
    .eq('id', numId)
    .maybeSingle();
  if (error) throw fail('findById', error);
  return data || null;
}

/**
 * Substring search across name / category / description / details JSON.
 *
 * Mirrors the current MySQL apiSearch (name/category/description LIKE +
 * JSON_SEARCH over details). The campus building set is tiny, so the
 * rows are fetched (ordered by name ASC, as apiSearch expects) and
 * filtered in JS — this keeps the JSON-content match exact without
 * depending on PostgREST jsonb-text quirks. Returns row-like objects.
 *
 * - Blank term -> `[]` (matches the controller's early-return for an
 *   empty query).
 * - `limit` defaults to 25 and is clamped to a 100 ceiling.
 */
async function search(term, { limit } = {}) {
  const needle = String(term == null ? '' : term).trim().toLowerCase();
  if (needle === '') return [];
  const max = clampLimit(limit);

  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('buildings')
    .select(BUILDING_COLUMNS)
    .order('name', { ascending: true });
  if (error) throw fail('search', error);

  const matches = (data || []).filter((row) => {
    const detailsText = row.details != null ? JSON.stringify(row.details) : '';
    const haystacks = [row.name, row.category, row.description, detailsText];
    return haystacks.some((v) => String(v == null ? '' : v).toLowerCase().includes(needle));
  });

  return matches.slice(0, max);
}

/**
 * Total building count (admin dashboard `totalBuildings`).
 */
async function countAll() {
  const sb = getSupabaseClient();
  const { count, error } = await sb
    .from('buildings')
    .select('id', { count: 'exact', head: true });
  if (error) throw fail('countAll', error);
  return count || 0;
}

/**
 * All buildings ordered by name ASC (admin campus-map page list).
 */
async function listAllOrderedByName() {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from('buildings')
    .select(BUILDING_COLUMNS)
    .order('name', { ascending: true });
  if (error) throw fail('listAllOrderedByName', error);
  return data || [];
}

/**
 * Map<buildingId, routeId> for decorating buildings with `vr_route_id`.
 * Delegates to the canonical implementation in routeRepository
 * (REPOSITORY_BOUNDARIES.md s8) so a single SQL/read path backs the
 * decoration used by both /buildings and /map.
 */
async function listVrRouteIdByBuilding() {
  return routeRepository.listVrRouteIdByBuilding();
}

// ---- Write methods (Section 3.6): Supabase RPCs defined in 0005 ----
// Validation stays in adminBuildingsController (validateDetails / validateCoord);
// these accept pre-validated values. Section 3.7 wires the controller to them.

/**
 * Create a building. PostGIS `location` is computed server-side by
 * app_create_building. Returns the inserted row in the admin CRUD shape
 * (details as a JSON string), or null on an empty result.
 */
async function create({ name, category, description, lat, lng, details, image_url = null, cloudinary_public_id = null } = {}) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.rpc('app_create_building', {
    p_name: name,
    p_category: category,
    p_description: description == null ? null : description,
    p_lat: Number(lat),
    p_lng: Number(lng),
    p_details: toDetailsParam(details)
  });
  if (error) throw fail('create', error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  // Persist the media metadata the RPC does not handle, then reselect the row.
  const full = await persistBuildingMedia(sb, row.id, image_url, cloudinary_public_id);
  return shapeWriteRow(full || row);
}

/**
 * Update a building's mutable fields and refresh location/updated_at via
 * app_update_building, then persist the media metadata (image_url,
 * cloudinary_public_id) the RPC does not handle (Section 10.6). Returns the
 * updated row in the admin CRUD shape, or null when the id does not exist.
 */
async function update(id, { name, category, description, lat, lng, details, image_url = null, cloudinary_public_id = null } = {}) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.rpc('app_update_building', {
    p_id: Number(id),
    p_name: name,
    p_category: category,
    p_description: description == null ? null : description,
    p_lat: Number(lat),
    p_lng: Number(lng),
    p_details: toDetailsParam(details)
  });
  if (error) throw fail('update', error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  const full = await persistBuildingMedia(sb, Number(id), image_url, cloudinary_public_id);
  return shapeWriteRow(full || row);
}

/**
 * Delete a building via app_delete_building. Returns the deleted id, or null
 * when the id did not exist. `delete` is exported under its quoted key below
 * to preserve the method name documented in REPOSITORY_BOUNDARIES.md.
 */
async function deleteBuilding(id) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.rpc('app_delete_building', { p_id: Number(id) });
  if (error) throw fail('delete', error);
  return data == null ? null : data;
}

module.exports = {
  listAll,
  listFirstById,
  findById,
  create,
  update,
  delete: deleteBuilding,
  search,
  listVrRouteIdByBuilding,
  countAll,
  listAllOrderedByName,
};
