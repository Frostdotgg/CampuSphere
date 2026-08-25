'use strict';

const repository = require('../repositories/roomScheduleDocumentRepository');
const scheduleDataSource = require('../config/scheduleDataSource');
const mapRuntime = require('../config/mapRuntime');
const auditService = require('../services/auditService');
const V = require('../utils/adminValidation');
const { validateImageUrlField, validateCloudinaryPublicId } = require('../utils/mediaUrl');
const { SEMESTER_LABELS, locationKey } = require('../utils/roomScheduleDocument');
const { normalizeSearchQuery } = require('../utils/scheduleSearch');
const { logServerError } = require('../utils/serverLog');

const BODY_KEYS = [
  'building_id', 'location_type', 'location_label', 'floor_label',
  'semester', 'school_year', 'image_url', 'cloudinary_public_id'
];
const LOCATION_TYPES = ['room', 'facility'];
const SEMESTERS = Object.keys(SEMESTER_LABELS);
const LOCATION_LABEL_MAX = 120;
const FLOOR_LABEL_MAX = 80;
const IMAGE_URL_MAX = 1000;
const PUBLIC_ID_MAX = 255;

function sourcesAligned() {
  return scheduleDataSource.isSupabase() === mapRuntime.isBuildingSupabase();
}

function rejectSourceMismatch(res) {
  return res.status(409).json({
    success: false,
    message: 'Room schedule and building data sources must match before schedules can be managed.'
  });
}

function auditMutation(req, action, targetId, message) {
  const actor = (req.session && req.session.user) || {};
  auditService.record({
    event_type: 'admin_mutation',
    action,
    outcome: 'success',
    actor_user_id: actor.id,
    actor_role: actor.role,
    target_type: 'room_schedule_document',
    target_id: targetId,
    message
  }).catch(() => {});
}

function parsePositiveInt(raw) {
  if (typeof raw === 'number') return Number.isSafeInteger(raw) && raw > 0 ? raw : null;
  return V.parseRouteId(raw);
}

function validateSchoolYear(raw) {
  if (typeof raw !== 'string') return { ok: false, message: 'School year is required.' };
  const value = raw.trim();
  const match = /^(\d{4})-(\d{4})$/.exec(value);
  if (!match) return { ok: false, message: 'School year must use YYYY-YYYY format.' };
  const first = Number(match[1]);
  const second = Number(match[2]);
  if (first < 2000 || first > 2199 || second !== first + 1) {
    return { ok: false, message: 'School year must contain consecutive years.' };
  }
  return { ok: true, value };
}

function validateCloudinaryImage(raw) {
  const result = validateImageUrlField(raw, IMAGE_URL_MAX);
  if (!result.ok || !result.value || !result.value.startsWith('https://')) {
    return { ok: false, message: 'Schedule image URL must be an HTTPS Cloudinary delivery URL.' };
  }
  return result;
}

function validatePayload(body) {
  const shape = V.validateBody(body, BODY_KEYS);
  if (!shape.ok) return shape;
  const buildingId = parsePositiveInt(body.building_id);
  if (buildingId === null) return { ok: false, message: 'Invalid building id.' };
  const locationType = V.allowedValue(body.location_type, 'location type', LOCATION_TYPES);
  if (!locationType.ok) return locationType;
  const locationLabel = V.requiredString(body.location_label, 'Location label', LOCATION_LABEL_MAX);
  if (!locationLabel.ok) return locationLabel;
  const floorLabel = V.optionalString(body.floor_label, 'Floor label', FLOOR_LABEL_MAX);
  if (!floorLabel.ok) return floorLabel;
  const semester = V.allowedValue(body.semester, 'semester', SEMESTERS);
  if (!semester.ok) return semester;
  const schoolYear = validateSchoolYear(body.school_year);
  if (!schoolYear.ok) return schoolYear;
  const image = validateCloudinaryImage(body.image_url);
  if (!image.ok) return image;
  const publicId = validateCloudinaryPublicId(body.cloudinary_public_id);
  if (!publicId.ok) {
    return { ok: false, message: `Cloudinary public ID contains unsupported characters or exceeds ${PUBLIC_ID_MAX} characters.` };
  }
  const floor = floorLabel.value === '' ? null : floorLabel.value;
  return {
    ok: true,
    value: {
      building_id: buildingId,
      location_type: locationType.value,
      location_label: locationLabel.value,
      floor_label: floor,
      location_key: locationKey(locationType.value, locationLabel.value, floor),
      semester: semester.value,
      school_year: schoolYear.value,
      image_url: image.value,
      cloudinary_public_id: publicId.value
    }
  };
}

function validateListQuery(query) {
  const source = query || {};
  const search = normalizeSearchQuery(source.q);
  if (!search.ok) return search;
  const filters = { q: search.value, limit: 100, offset: 0 };
  if (source.buildingId !== undefined && String(source.buildingId).trim() !== '') {
    const buildingId = parsePositiveInt(source.buildingId);
    if (buildingId === null) return { ok: false, message: 'Invalid building id.' };
    filters.buildingId = buildingId;
  }
  if (source.semester !== undefined && String(source.semester).trim() !== '') {
    const semester = V.allowedValue(source.semester, 'semester', SEMESTERS);
    if (!semester.ok) return semester;
    filters.semester = semester.value;
  }
  if (source.schoolYear !== undefined && String(source.schoolYear).trim() !== '') {
    const year = validateSchoolYear(source.schoolYear);
    if (!year.ok) return year;
    filters.schoolYear = year.value;
  }
  if (source.limit !== undefined && String(source.limit).trim() !== '') {
    const value = Number(source.limit);
    if (!Number.isInteger(value) || value < 1 || value > 200) return { ok: false, message: 'Invalid limit.' };
    filters.limit = value;
  }
  if (source.offset !== undefined && String(source.offset).trim() !== '') {
    const value = Number(source.offset);
    if (!Number.isInteger(value) || value < 0 || value > 10000) return { ok: false, message: 'Invalid offset.' };
    filters.offset = value;
  }
  return { ok: true, value: filters };
}

function conflictResponse(res) {
  return res.status(409).json({
    success: false,
    message: 'A current schedule already exists for this room. Edit the existing schedule instead.'
  });
}

exports.listDocuments = async (req, res) => {
  if (!sourcesAligned()) return rejectSourceMismatch(res);
  const validation = validateListQuery(req.query);
  if (!validation.ok) return res.status(400).json({ success: false, message: validation.message });
  try {
    const result = await repository.listDocuments(validation.value);
    return res.json({ success: true, documents: result.documents, total: result.total, appliedFilters: validation.value });
  } catch (error) {
    if (error && error.code === repository.SEARCH_LIMIT_CODE) {
      return res.status(422).json({ success: false, message: 'Room schedule search is too broad. Narrow the filters and try again.' });
    }
    logServerError('admin.roomScheduleDocuments.list', req);
    return res.status(500).json({ success: false, message: 'Unable to load room schedules.' });
  }
};

exports.getDocument = async (req, res) => {
  if (!sourcesAligned()) return rejectSourceMismatch(res);
  const id = V.parseRouteId(req.params.id);
  if (id === null) return res.status(400).json({ success: false, message: 'Invalid schedule id.' });
  try {
    const document = await repository.findDocumentById(id);
    if (!document) return res.status(404).json({ success: false, message: 'Room schedule not found.' });
    return res.json({ success: true, document });
  } catch (error) {
    logServerError('admin.roomScheduleDocuments.get', req);
    return res.status(500).json({ success: false, message: 'Unable to load the room schedule.' });
  }
};

exports.createDocument = async (req, res) => {
  if (!sourcesAligned()) return rejectSourceMismatch(res);
  const validation = validatePayload(req.body);
  if (!validation.ok) return res.status(400).json({ success: false, message: validation.message });
  try {
    if (!(await repository.buildingExists(validation.value.building_id))) {
      return res.status(404).json({ success: false, message: 'Building not found.' });
    }
    if (await repository.findLocationConflict(validation.value.building_id, validation.value.location_key)) {
      return conflictResponse(res);
    }
    const actor = (req.session && req.session.user) || {};
    const document = await repository.createDocument({ ...validation.value, created_by_user_id: actor.id || null });
    auditMutation(req, 'admin.room_schedule_document.create', document.id, 'Admin created a room schedule image record.');
    return res.status(201).json({ success: true, message: 'Room schedule created.', document });
  } catch (error) {
    if (error && error.code === repository.DUPLICATE_CODE) return conflictResponse(res);
    logServerError('admin.roomScheduleDocuments.create', req);
    return res.status(500).json({ success: false, message: 'Unable to create the room schedule.' });
  }
};

exports.updateDocument = async (req, res) => {
  if (!sourcesAligned()) return rejectSourceMismatch(res);
  const id = V.parseRouteId(req.params.id);
  if (id === null) return res.status(400).json({ success: false, message: 'Invalid schedule id.' });
  const validation = validatePayload(req.body);
  if (!validation.ok) return res.status(400).json({ success: false, message: validation.message });
  try {
    const existing = await repository.findDocumentById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Room schedule not found.' });
    }
    const identityChanged = Number(existing.building_id) !== validation.value.building_id ||
      locationKey(existing.location_type, existing.location_label, existing.floor_label) !== validation.value.location_key;
    if (identityChanged && (await repository.countLinkedHotspots(id)) > 0) {
      return res.status(409).json({
        success: false,
        message: 'This schedule is linked to a VR hotspot. Unlink it before changing its building or room identity.'
      });
    }
    if (!(await repository.buildingExists(validation.value.building_id))) {
      return res.status(404).json({ success: false, message: 'Building not found.' });
    }
    if (await repository.findLocationConflict(validation.value.building_id, validation.value.location_key, id)) {
      return conflictResponse(res);
    }
    const document = await repository.updateDocument(id, validation.value);
    if (!document) return res.status(404).json({ success: false, message: 'Room schedule not found.' });
    auditMutation(req, 'admin.room_schedule_document.update', id, 'Admin updated a room schedule image record.');
    return res.json({ success: true, message: 'Room schedule updated.', document });
  } catch (error) {
    if (error && error.code === repository.DUPLICATE_CODE) return conflictResponse(res);
    logServerError('admin.roomScheduleDocuments.update', req);
    return res.status(500).json({ success: false, message: 'Unable to update the room schedule.' });
  }
};

exports.deleteDocument = async (req, res) => {
  if (!sourcesAligned()) return rejectSourceMismatch(res);
  const id = V.parseRouteId(req.params.id);
  if (id === null) return res.status(400).json({ success: false, message: 'Invalid schedule id.' });
  try {
    if (!(await repository.findDocumentById(id))) {
      return res.status(404).json({ success: false, message: 'Room schedule not found.' });
    }
    if ((await repository.countLinkedHotspots(id)) > 0) {
      return res.status(409).json({
        success: false,
        message: 'This room schedule is linked to one or more VR hotspots. Relink or remove those hotspots before deleting it.'
      });
    }
    const removed = await repository.deleteDocument(id);
    if (!removed) return res.status(404).json({ success: false, message: 'Room schedule not found.' });
    auditMutation(req, 'admin.room_schedule_document.delete', id, 'Admin deleted a room schedule image record.');
    return res.json({ success: true, message: 'Room schedule deleted.' });
  } catch (error) {
    if (error && error.code === repository.LINKED_CODE) {
      return res.status(409).json({ success: false, message: 'This room schedule is still linked to a VR hotspot.' });
    }
    logServerError('admin.roomScheduleDocuments.delete', req);
    return res.status(500).json({ success: false, message: 'Unable to delete the room schedule.' });
  }
};

exports._validatePayload = validatePayload;
exports._validateSchoolYear = validateSchoolYear;
