const GUIDE_SCHEMA = 'campusphere.offline-guide/1';
const MAX_BASEMAP_BYTES = 5 * 1024 * 1024;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const FORBIDDEN_PATTERN = /(?:cloudinary|panorama|360|scene|\bvr\b|image_url|\/img\/vr\/|\/api\/vr\/|res\.cloudinary\.com)/i;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function containsForbidden(value, seen) {
  if (typeof value === 'string') return FORBIDDEN_PATTERN.test(value);
  if (!value || typeof value !== 'object') return false;
  const objects = seen || [];
  if (objects.indexOf(value) !== -1) return false;
  objects.push(value);
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_PATTERN.test(key) || containsForbidden(value[key], objects)) return true;
  }
  return false;
}

function routeKey(route, preferred) {
  if (!route || typeof route !== 'object') return '';
  return String(route[preferred] || route.destinationKey || route.buildingKey || '').trim();
}

export function validateGuideEnvelope(payload) {
  const guide = payload && payload.guide;
  let reason = 'accepted';
  if (!payload || payload.success !== true || payload.schema !== GUIDE_SCHEMA) reason = 'invalid-schema';
  else if (!HASH_PATTERN.test(String(payload.fingerprint || ''))) reason = 'invalid-fingerprint';
  else if (!isObject(guide) || !isObject(guide.origin) || guide.origin.key !== 'main-gate') reason = 'missing-origin';
  else if (!Array.isArray(guide.buildings) || !Array.isArray(guide.routes) || !Array.isArray(guide.exitRoutes)) reason = 'invalid-collections';
  else if (!isObject(guide.basemap) || !HASH_PATTERN.test(String(guide.basemap.sha256 || '')) ||
    !Number.isInteger(guide.basemap.bytes) || guide.basemap.bytes < 1 || guide.basemap.bytes > MAX_BASEMAP_BYTES ||
    guide.basemap.asset !== `/maps/cspc-campus-${guide.basemap.sha256}.pmtiles`) reason = 'invalid-basemap';
  else if (guide.buildings.length === 0 || guide.routes.length === 0 || guide.exitRoutes.length === 0) reason = 'empty-guide';
  else if (containsForbidden(guide)) reason = 'forbidden-vr-data';

  const buildings = isObject(guide) && Array.isArray(guide.buildings) ? guide.buildings : [];
  const entryKeys = new Set(isObject(guide) && Array.isArray(guide.routes)
    ? guide.routes.map((route) => routeKey(route, 'destinationKey')).filter(Boolean)
    : []);
  const exitKeys = new Set(isObject(guide) && Array.isArray(guide.exitRoutes)
    ? guide.exitRoutes.map((route) => routeKey(route, 'buildingKey')).filter(Boolean)
    : []);
  const buildingWithBothRoutes = buildings.some((building) => {
    const key = String(building && building.key || '').trim();
    return key && entryKeys.has(key) && exitKeys.has(key);
  });

  if (reason === 'accepted' && !buildingWithBothRoutes) reason = 'missing-entry-exit-pair';
  return {
    accepted: reason === 'accepted',
    reason,
    buildingCount: buildings.length,
    entryRouteCount: isObject(guide) && Array.isArray(guide.routes) ? guide.routes.length : 0,
    exitRouteCount: isObject(guide) && Array.isArray(guide.exitRoutes) ? guide.exitRoutes.length : 0,
    buildingWithBothRoutes,
    basemapBytes: isObject(guide) && isObject(guide.basemap) ? Number(guide.basemap.bytes) || 0 : 0,
    forbiddenData: containsForbidden(guide),
  };
}

export function validateStoredSnapshot(snapshot) {
  const value = snapshot || {};
  let reason = 'accepted';
  if (value.schema !== GUIDE_SCHEMA) reason = 'invalid-schema';
  else if (!HASH_PATTERN.test(String(value.fingerprint || ''))) reason = 'invalid-fingerprint';
  else if (!Number.isInteger(value.basemapBytes) || value.basemapBytes < 1 ||
    value.basemapBytes !== Number(value.expectedBasemapBytes)) reason = 'invalid-stored-map';
  else if (Number(value.buildingCount) < 1 || Number(value.entryRouteCount) < 1 || Number(value.exitRouteCount) < 1) reason = 'empty-stored-guide';
  else if (value.buildingWithBothRoutes !== true) reason = 'missing-entry-exit-pair';
  else if (value.forbiddenData === true) reason = 'forbidden-vr-data';
  return { accepted: reason === 'accepted', reason };
}

export function summarizeStoredRecord(record) {
  const value = record || {};
  const guide = value.guide || {};
  const buildings = Array.isArray(guide.buildings) ? guide.buildings : [];
  const routes = Array.isArray(guide.routes) ? guide.routes : [];
  const exitRoutes = Array.isArray(guide.exitRoutes) ? guide.exitRoutes : [];
  const entryKeys = new Set(routes.map((route) => routeKey(route, 'destinationKey')).filter(Boolean));
  const exitKeys = new Set(exitRoutes.map((route) => routeKey(route, 'buildingKey')).filter(Boolean));
  const buildingWithBothRoutes = buildings.some((building) => {
    const key = String(building && building.key || '').trim();
    return key && entryKeys.has(key) && exitKeys.has(key);
  });
  return {
    schema: String(value.schema || ''),
    fingerprint: String(value.fingerprint || ''),
    basemapBytes: value.basemap && Number(value.basemap.size) || 0,
    expectedBasemapBytes: guide.basemap && Number(guide.basemap.bytes) || 0,
    buildingCount: buildings.length,
    entryRouteCount: routes.length,
    exitRouteCount: exitRoutes.length,
    buildingWithBothRoutes,
    forbiddenData: containsForbidden(guide),
    buildingIndex: buildings.findIndex((building) => {
      const key = String(building && building.key || '').trim();
      return key && entryKeys.has(key) && exitKeys.has(key);
    }),
  };
}
