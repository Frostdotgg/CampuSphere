'use strict';

/*
 * Dual-backend repository for the current semester schedule image assigned to
 * each room or facility. HTTP/auth decisions stay in controllers. All MySQL
 * queries are parameterized and every Supabase read uses explicit columns.
 */

const db = require('../config/db');
const { getSupabaseClient } = require('../config/supabase');
const scheduleDataSource = require('../config/scheduleDataSource');

const DOCUMENT_COLUMNS =
  'id, building_id, location_type, location_label, floor_label, location_key, ' +
  'semester, school_year, image_url, cloudinary_public_id, created_by_user_id, created_at, updated_at';
const MAX_LIMIT = 200;
const MAX_OFFSET = 10000;
const SEARCH_SCAN_MAX = 500;
const SEARCH_LIMIT_CODE = 'ROOM_SCHEDULE_DOCUMENT_SEARCH_LIMIT';
const DUPLICATE_CODE = 'ROOM_SCHEDULE_DOCUMENT_DUPLICATE';
const LINKED_CODE = 'ROOM_SCHEDULE_DOCUMENT_LINKED';

function safeSupabaseMessage(error) {
  let message = error && error.message ? String(error.message) : 'Supabase request failed.';
  message = message
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[REDACTED_JWT]')
    .replace(/https?:\/\/[^\s]+/g, '[REDACTED_URL]')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b(?::\d+)?/g, '[REDACTED_IP]')
    .replace(/\s+/g, ' ')
    .trim();
  return message.length > 300 ? message.slice(0, 300) + '...' : message;
}

function repositoryError(method, error) {
  const wrapped = new Error('roomScheduleDocumentRepository.' + method + ': ' + safeSupabaseMessage(error));
  if (error && error.code === '23505') wrapped.code = DUPLICATE_CODE;
  if (error && error.code === '23503') wrapped.code = LINKED_CODE;
  return wrapped;
}

function normalizePositiveInt(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : NaN;
}

function normalizeFilters(input) {
  const filters = input && typeof input === 'object' ? input : {};
  const buildingId = normalizePositiveInt(filters.buildingId);
  const limitValue = Number(filters.limit);
  const offsetValue = Number(filters.offset);
  const q = typeof filters.q === 'string' ? filters.q.trim().toLocaleLowerCase('en') : '';
  return {
    impossible: Number.isNaN(buildingId),
    buildingId,
    semester: typeof filters.semester === 'string' && filters.semester.trim() ? filters.semester.trim() : null,
    schoolYear: typeof filters.schoolYear === 'string' && filters.schoolYear.trim() ? filters.schoolYear.trim() : null,
    q,
    limit: Number.isInteger(limitValue) ? Math.min(Math.max(limitValue, 1), MAX_LIMIT) : 50,
    offset: Number.isInteger(offsetValue) ? Math.min(Math.max(offsetValue, 0), MAX_OFFSET) : 0
  };
}

function normalizeTimestamp(value) {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function shapeDocument(row, buildingName, linkedHotspotCount) {
  if (!row) return null;
  return {
    id: Number(row.id),
    building_id: Number(row.building_id),
    building_name: buildingName === undefined ? (row.building_name || null) : buildingName,
    location_type: row.location_type,
    location_label: row.location_label,
    floor_label: row.floor_label == null ? null : row.floor_label,
    semester: row.semester,
    school_year: row.school_year,
    image_url: row.image_url,
    cloudinary_public_id: row.cloudinary_public_id == null ? null : row.cloudinary_public_id,
    linked_hotspot_count: Number(linkedHotspotCount === undefined ? row.linked_hotspot_count : linkedHotspotCount) || 0,
    created_by_user_id: row.created_by_user_id == null ? null : Number(row.created_by_user_id),
    created_at: normalizeTimestamp(row.created_at),
    updated_at: normalizeTimestamp(row.updated_at)
  };
}

async function hydrateSupabaseRows(sb, rows) {
  if (!rows.length) return [];
  const buildingIds = [...new Set(rows.map((row) => Number(row.building_id)).filter(Number.isInteger))];
  const documentIds = rows.map((row) => Number(row.id)).filter(Number.isInteger);
  const [buildingResult, hotspotResult] = await Promise.all([
    sb.from('buildings').select('id, name').in('id', buildingIds),
    sb.from('vr_hotspots').select('schedule_document_id').in('schedule_document_id', documentIds)
  ]);
  if (buildingResult.error) throw repositoryError('hydrateBuildings', buildingResult.error);
  if (hotspotResult.error) throw repositoryError('hydrateHotspots', hotspotResult.error);
  const names = new Map((buildingResult.data || []).map((row) => [Number(row.id), row.name]));
  const counts = new Map();
  for (const hotspot of hotspotResult.data || []) {
    const id = Number(hotspot.schedule_document_id);
    if (Number.isInteger(id)) counts.set(id, (counts.get(id) || 0) + 1);
  }
  return rows.map((row) => shapeDocument(row, names.get(Number(row.building_id)) || null, counts.get(Number(row.id)) || 0));
}

function matchesSearch(row, query) {
  if (!query) return true;
  return [row.building_name, row.location_type, row.location_label, row.floor_label, row.semester, row.school_year]
    .some((value) => String(value == null ? '' : value).toLocaleLowerCase('en').includes(query));
}

function applySupabaseFilters(query, filters) {
  let next = query;
  if (filters.buildingId !== null) next = next.eq('building_id', filters.buildingId);
  if (filters.semester !== null) next = next.eq('semester', filters.semester);
  if (filters.schoolYear !== null) next = next.eq('school_year', filters.schoolYear);
  return next;
}

async function listDocuments(filters = {}) {
  const normalized = normalizeFilters(filters);
  if (normalized.impossible) return { documents: [], total: 0 };

  if (scheduleDataSource.isSupabase()) {
    const sb = getSupabaseClient();
    if (normalized.q) {
      const { data, error, count } = await applySupabaseFilters(
        sb.from('room_schedule_documents').select(DOCUMENT_COLUMNS, { count: 'exact' }), normalized
      )
        .order('location_label', { ascending: true })
        .order('id', { ascending: true })
        .range(0, SEARCH_SCAN_MAX - 1);
      if (error) throw repositoryError('listDocuments', error);
      if (typeof count === 'number' && count > SEARCH_SCAN_MAX) {
        const refusal = new Error('Room schedule search is too broad. Narrow the filters and try again.');
        refusal.code = SEARCH_LIMIT_CODE;
        throw refusal;
      }
      const hydrated = await hydrateSupabaseRows(sb, data || []);
      const matching = hydrated.filter((row) => matchesSearch(row, normalized.q));
      return {
        documents: matching.slice(normalized.offset, normalized.offset + normalized.limit),
        total: matching.length
      };
    }

    const { data, error, count } = await applySupabaseFilters(
      sb.from('room_schedule_documents').select(DOCUMENT_COLUMNS, { count: 'exact' }), normalized
    )
      .order('location_label', { ascending: true })
      .order('id', { ascending: true })
      .range(normalized.offset, normalized.offset + normalized.limit - 1);
    if (error) throw repositoryError('listDocuments', error);
    return { documents: await hydrateSupabaseRows(sb, data || []), total: typeof count === 'number' ? count : 0 };
  }

  const parts = [];
  const params = [];
  if (normalized.buildingId !== null) { parts.push('d.building_id = ?'); params.push(normalized.buildingId); }
  if (normalized.semester !== null) { parts.push('d.semester = ?'); params.push(normalized.semester); }
  if (normalized.schoolYear !== null) { parts.push('d.school_year = ?'); params.push(normalized.schoolYear); }
  if (normalized.q) {
    const escaped = normalized.q.replace(/[\\%_]/g, '\\$&');
    const pattern = '%' + escaped + '%';
    parts.push('(LOWER(b.name) LIKE ? OR LOWER(d.location_type) LIKE ? OR LOWER(d.location_label) LIKE ? OR LOWER(COALESCE(d.floor_label, \'\')) LIKE ? OR LOWER(d.semester) LIKE ? OR LOWER(d.school_year) LIKE ?)');
    for (let index = 0; index < 6; index++) params.push(pattern);
  }
  const where = parts.length ? ' WHERE ' + parts.join(' AND ') : '';
  const selectSql =
    `SELECT d.id, d.building_id, b.name AS building_name, d.location_type, d.location_label,
            d.floor_label, d.semester, d.school_year, d.image_url, d.cloudinary_public_id,
            d.created_by_user_id, d.created_at, d.updated_at,
            (SELECT COUNT(*) FROM vr_hotspots h WHERE h.schedule_document_id = d.id) AS linked_hotspot_count
       FROM room_schedule_documents d
       LEFT JOIN buildings b ON b.id = d.building_id${where}
      ORDER BY d.location_label ASC, d.id ASC LIMIT ? OFFSET ?`;
  const [rows] = await db.query(selectSql, [...params, normalized.limit, normalized.offset]);
  const [counts] = await db.query(
    'SELECT COUNT(*) AS n FROM room_schedule_documents d LEFT JOIN buildings b ON b.id = d.building_id' + where,
    params
  );
  return { documents: rows.map((row) => shapeDocument(row)), total: Number(counts[0] && counts[0].n) || 0 };
}

async function findDocumentById(id) {
  const number = normalizePositiveInt(id);
  if (number === null || Number.isNaN(number)) return null;
  if (scheduleDataSource.isSupabase()) {
    const sb = getSupabaseClient();
    const { data, error } = await sb.from('room_schedule_documents').select(DOCUMENT_COLUMNS).eq('id', number).maybeSingle();
    if (error) throw repositoryError('findDocumentById', error);
    if (!data) return null;
    return (await hydrateSupabaseRows(sb, [data]))[0] || null;
  }
  const [rows] = await db.query(
    `SELECT d.id, d.building_id, b.name AS building_name, d.location_type, d.location_label,
            d.floor_label, d.semester, d.school_year, d.image_url, d.cloudinary_public_id,
            d.created_by_user_id, d.created_at, d.updated_at,
            (SELECT COUNT(*) FROM vr_hotspots h WHERE h.schedule_document_id = d.id) AS linked_hotspot_count
       FROM room_schedule_documents d LEFT JOIN buildings b ON b.id = d.building_id WHERE d.id = ? LIMIT 1`,
    [number]
  );
  return rows.length ? shapeDocument(rows[0]) : null;
}

async function buildingExists(id) {
  const number = normalizePositiveInt(id);
  if (number === null || Number.isNaN(number)) return false;
  if (scheduleDataSource.isSupabase()) {
    const sb = getSupabaseClient();
    const { data, error } = await sb.from('buildings').select('id').eq('id', number).maybeSingle();
    if (error) throw repositoryError('buildingExists', error);
    return !!data;
  }
  const [rows] = await db.query('SELECT id FROM buildings WHERE id = ? LIMIT 1', [number]);
  return rows.length > 0;
}

async function findLocationConflict(buildingId, locationKey, excludeId) {
  if (scheduleDataSource.isSupabase()) {
    const sb = getSupabaseClient();
    let query = sb.from('room_schedule_documents').select('id').eq('building_id', buildingId).eq('location_key', locationKey);
    if (excludeId) query = query.neq('id', excludeId);
    const { data, error } = await query.limit(1);
    if (error) throw repositoryError('findLocationConflict', error);
    return data && data.length ? Number(data[0].id) : null;
  }
  const params = [buildingId, locationKey];
  let sql = 'SELECT id FROM room_schedule_documents WHERE building_id = ? AND location_key = ?';
  if (excludeId) { sql += ' AND id <> ?'; params.push(excludeId); }
  sql += ' LIMIT 1';
  const [rows] = await db.query(sql, params);
  return rows.length ? Number(rows[0].id) : null;
}

async function createDocument(payload) {
  const row = {
    building_id: payload.building_id,
    location_type: payload.location_type,
    location_label: payload.location_label,
    floor_label: payload.floor_label,
    location_key: payload.location_key,
    semester: payload.semester,
    school_year: payload.school_year,
    image_url: payload.image_url,
    cloudinary_public_id: payload.cloudinary_public_id,
    created_by_user_id: payload.created_by_user_id
  };
  if (scheduleDataSource.isSupabase()) {
    const sb = getSupabaseClient();
    const { data, error } = await sb.from('room_schedule_documents').insert(row).select('id').single();
    if (error) throw repositoryError('createDocument', error);
    return findDocumentById(data.id);
  }
  try {
    const [result] = await db.query(
      `INSERT INTO room_schedule_documents
       (building_id, location_type, location_label, floor_label, location_key, semester, school_year,
        image_url, cloudinary_public_id, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.building_id, row.location_type, row.location_label, row.floor_label, row.location_key,
       row.semester, row.school_year, row.image_url, row.cloudinary_public_id, row.created_by_user_id]
    );
    return findDocumentById(result.insertId);
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') error.code = DUPLICATE_CODE;
    throw error;
  }
}

async function updateDocument(id, payload) {
  if (scheduleDataSource.isSupabase()) {
    const sb = getSupabaseClient();
    const { data, error } = await sb.from('room_schedule_documents').update({
      building_id: payload.building_id,
      location_type: payload.location_type,
      location_label: payload.location_label,
      floor_label: payload.floor_label,
      location_key: payload.location_key,
      semester: payload.semester,
      school_year: payload.school_year,
      image_url: payload.image_url,
      cloudinary_public_id: payload.cloudinary_public_id,
      updated_at: new Date().toISOString()
    }).eq('id', id).select('id').maybeSingle();
    if (error) throw repositoryError('updateDocument', error);
    return data ? findDocumentById(data.id) : null;
  }
  try {
    const [result] = await db.query(
      `UPDATE room_schedule_documents
          SET building_id = ?, location_type = ?, location_label = ?, floor_label = ?, location_key = ?,
              semester = ?, school_year = ?, image_url = ?, cloudinary_public_id = ?, updated_at = NOW()
        WHERE id = ?`,
      [payload.building_id, payload.location_type, payload.location_label, payload.floor_label,
       payload.location_key, payload.semester, payload.school_year, payload.image_url,
       payload.cloudinary_public_id, id]
    );
    return result.affectedRows ? findDocumentById(id) : null;
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') error.code = DUPLICATE_CODE;
    throw error;
  }
}

async function countLinkedHotspots(id) {
  const number = normalizePositiveInt(id);
  if (number === null || Number.isNaN(number)) return 0;
  if (scheduleDataSource.isSupabase()) {
    const sb = getSupabaseClient();
    const { count, error } = await sb.from('vr_hotspots').select('id', { count: 'exact', head: true }).eq('schedule_document_id', number);
    if (error) throw repositoryError('countLinkedHotspots', error);
    return typeof count === 'number' ? count : 0;
  }
  const [rows] = await db.query('SELECT COUNT(*) AS n FROM vr_hotspots WHERE schedule_document_id = ?', [number]);
  return Number(rows[0] && rows[0].n) || 0;
}

async function deleteDocument(id) {
  if (scheduleDataSource.isSupabase()) {
    const sb = getSupabaseClient();
    const { data, error } = await sb.from('room_schedule_documents').delete().eq('id', id).select('id').maybeSingle();
    if (error) throw repositoryError('deleteDocument', error);
    return data ? Number(data.id) : null;
  }
  try {
    const [result] = await db.query('DELETE FROM room_schedule_documents WHERE id = ?', [id]);
    return result.affectedRows ? Number(id) : null;
  } catch (error) {
    if (error && error.code === 'ER_ROW_IS_REFERENCED_2') error.code = LINKED_CODE;
    throw error;
  }
}

module.exports = {
  listDocuments,
  findDocumentById,
  buildingExists,
  findLocationConflict,
  createDocument,
  updateDocument,
  countLinkedHotspots,
  deleteDocument,
  SEARCH_LIMIT_CODE,
  DUPLICATE_CODE,
  LINKED_CODE
};
