'use strict';

const crypto = require('crypto');
const { normalizeMediaUrl } = require('./mediaUrl');

const SEMESTER_LABELS = Object.freeze({
  'first-semester': 'First Semester',
  'second-semester': 'Second Semester',
  midyear: 'Midyear'
});

function canonicalLocationPart(value) {
  return String(value == null ? '' : value)
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en');
}

function locationKey(locationType, locationLabel, floorLabel) {
  const canonical = [
    canonicalLocationPart(locationType),
    canonicalLocationPart(floorLabel),
    canonicalLocationPart(locationLabel)
  ].join('\u001f');
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function semesterLabel(value) {
  return SEMESTER_LABELS[value] || 'Semester';
}

function normalizeScheduleImageUrl(value) {
  const normalized = normalizeMediaUrl(value);
  return normalized && normalized.startsWith('https://') ? normalized : null;
}

function toPublicDocument(document) {
  if (!document) return null;
  const room = String(document.location_label || '').trim() || 'Room';
  const building = String(document.building_name || '').trim();
  const term = semesterLabel(document.semester);
  const year = String(document.school_year || '').trim();
  return {
    id: Number(document.id),
    building_id: Number(document.building_id),
    building_name: building || null,
    location_type: document.location_type,
    location_label: room,
    floor_label: document.floor_label == null ? null : document.floor_label,
    semester: document.semester,
    semester_label: term,
    school_year: year,
    image_url: normalizeScheduleImageUrl(document.image_url),
    alt_text: `${room}${building ? ` in ${building}` : ''} weekly room schedule for ${term}, school year ${year}.`
  };
}

module.exports = {
  SEMESTER_LABELS,
  locationKey,
  semesterLabel,
  normalizeScheduleImageUrl,
  toPublicDocument
};
