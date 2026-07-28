'use strict';

/*
 * Build the display-only additional-details shape consumed by the participant
 * Buildings page. Stored details and the public JSON API keep their existing
 * raw contract; this helper only prevents the EJS client from coercing stored
 * objects (for example { office, floor }) into "[object Object]".
 */

function scalarText(value) {
  if (typeof value === 'string') {
    const text = value.trim();
    return text || '';
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return '';
}

function titleFromKey(key) {
  return String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function infoItem(item) {
  const text = scalarText(item);
  if (text) return { label: '', value: text };
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;

  const label = scalarText(item.label);
  const value = scalarText(item.value);
  if (label && value) return { label, value };

  const office = scalarText(item.office);
  const floor = scalarText(item.floor);
  if (office && floor) return { label: 'Office', value: `${office} — ${floor}` };
  if (office) return { label: 'Office', value: office };
  if (floor) return { label: 'Floor', value: floor };

  for (const [key, candidate] of Object.entries(item)) {
    const fallback = scalarText(candidate);
    if (fallback) return { label: titleFromKey(key), value: fallback };
  }
  return null;
}

function roomItem(room) {
  if (!room || typeof room !== 'object' || Array.isArray(room)) return null;
  const identifier = scalarText(room.room) || scalarText(room.num);
  const name = scalarText(room.name);
  const use = scalarText(room.use);
  if (!identifier && !name && !use) return null;

  return {
    heading: identifier && name ? `${identifier} — ${name}` : (identifier || name || 'Room'),
    use,
  };
}

function floorItem(floor, index) {
  if (!floor || typeof floor !== 'object' || Array.isArray(floor)) return null;
  const rooms = Array.isArray(floor.rooms) ? floor.rooms.map(roomItem).filter(Boolean) : [];
  if (rooms.length === 0) return null;
  return {
    label: scalarText(floor.label) || `Floor ${index + 1}`,
    rooms,
  };
}

function buildParticipantDetails(building) {
  const source = building && typeof building === 'object' ? building : {};
  const keyInformation = [];

  const walkTime = scalarText(source.walkTime);
  if (walkTime) keyInformation.push({ label: 'Walking time', value: walkTime });

  if (Array.isArray(source.landmarks)) {
    for (const landmark of source.landmarks) {
      const value = scalarText(landmark);
      if (value) keyInformation.push({ label: 'Landmark', value });
    }
  }

  if (Array.isArray(source.info)) {
    for (const item of source.info) {
      const formatted = infoItem(item);
      if (formatted) keyInformation.push(formatted);
    }
  }

  return {
    keyInformation,
    entrances: Array.isArray(source.entrances)
      ? source.entrances.map(scalarText).filter(Boolean)
      : [],
    floors: Array.isArray(source.floors)
      ? source.floors.map(floorItem).filter(Boolean)
      : [],
  };
}

function withParticipantDetails(building) {
  return {
    ...building,
    participantDetails: buildParticipantDetails(building),
  };
}

module.exports = {
  buildParticipantDetails,
  withParticipantDetails,
};
