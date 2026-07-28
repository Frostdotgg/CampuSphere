/* ========================================
   CampuSphere — Map / Buildings / Routes Runtime Switches
   Milestone 3, Section 3.3
   ======================================== */

/**
 * Runtime switches that select which backend the building / route controllers
 * read from, and which map renderer the map views use, once the Milestone 3
 * migration sections wire them in. This module only normalises and exposes the
 * values; no controller, route, or view consumes them yet.
 *
 *   BUILDING_DATA_SOURCE=mysql    -> existing direct MySQL queries (default).
 *   BUILDING_DATA_SOURCE=supabase -> Supabase repository path (Section 3.5+).
 *   ROUTE_DATA_SOURCE=mysql       -> existing direct MySQL queries (default).
 *   ROUTE_DATA_SOURCE=supabase    -> Supabase repository path (Section 3.9+).
 *   MAP_RENDERER=leaflet          -> existing Leaflet map (default).
 *   MAP_RENDERER=maplibre         -> MapLibre GL map (Section 3.10+).
 *
 * Unset, empty, or unrecognised values fall back to the default with a single
 * non-secret warning per variable. The helper has no side effects beyond that
 * warning and reads only process.env — it imports no Supabase client, MySQL
 * pool, repository, controller, route, or middleware, so requiring it cannot
 * accidentally trigger a backend connection.
 */

const VALID_DATA_SOURCES = Object.freeze(['mysql', 'supabase']);
const VALID_MAP_RENDERERS = Object.freeze(['leaflet', 'maplibre']);

const DEFAULT_BUILDING_DATA_SOURCE = 'mysql';
const DEFAULT_ROUTE_DATA_SOURCE = 'mysql';
const DEFAULT_MAP_RENDERER = 'leaflet';

// Warn at most once per environment variable name, not once globally, so a
// single misconfigured switch does not silence warnings for the others.
const warnedVars = new Set();

function resolveMode(envName, validValues, defaultValue) {
  const raw = String(process.env[envName] || '').trim().toLowerCase();
  if (raw === '') return defaultValue;
  if (validValues.includes(raw)) return raw;

  if (!warnedVars.has(envName)) {
    // Do not echo any part of the raw value — a misconfigured env could
    // contain anything (including an accidentally-pasted secret).
    console.warn(
      `[map] Unrecognised ${envName} value. ` +
      `Valid values: ${validValues.join(', ')}. ` +
      `Falling back to "${defaultValue}".`
    );
    warnedVars.add(envName);
  }
  return defaultValue;
}

function getBuildingDataSource() {
  return resolveMode('BUILDING_DATA_SOURCE', VALID_DATA_SOURCES, DEFAULT_BUILDING_DATA_SOURCE);
}
function isBuildingSupabase() {
  return getBuildingDataSource() === 'supabase';
}
function isBuildingMysql() {
  return getBuildingDataSource() === 'mysql';
}

function getRouteDataSource() {
  return resolveMode('ROUTE_DATA_SOURCE', VALID_DATA_SOURCES, DEFAULT_ROUTE_DATA_SOURCE);
}
function isRouteSupabase() {
  return getRouteDataSource() === 'supabase';
}
function isRouteMysql() {
  return getRouteDataSource() === 'mysql';
}

function getMapRenderer() {
  return resolveMode('MAP_RENDERER', VALID_MAP_RENDERERS, DEFAULT_MAP_RENDERER);
}
function isMapLibre() {
  return getMapRenderer() === 'maplibre';
}
function isLeaflet() {
  return getMapRenderer() === 'leaflet';
}

module.exports = {
  getBuildingDataSource,
  isBuildingSupabase,
  isBuildingMysql,
  getRouteDataSource,
  isRouteSupabase,
  isRouteMysql,
  getMapRenderer,
  isMapLibre,
  isLeaflet,
  VALID_DATA_SOURCES,
  VALID_MAP_RENDERERS,
  DEFAULT_BUILDING_DATA_SOURCE,
  DEFAULT_ROUTE_DATA_SOURCE,
  DEFAULT_MAP_RENDERER,
};
