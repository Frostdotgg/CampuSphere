'use strict';

/* Database-free contract checks for the admin road-geometry basemap. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const view = read('views/admin/campus-map.ejs');
const controller = read('controllers/adminController.js');
const graph = read('public/js/admin/admin-map-graph.js');
const online = read('views/map.ejs');
const offline = read('public/js/offline-guide-manager.js');
const manifest = JSON.parse(read('public/maps/manifest.json'));

let failures = 0;
function check(label, condition) {
  if (condition) console.log(`[PASS] ${label}`);
  else { failures += 1; console.error(`[FAIL] ${label}`); }
}

const styleTokens = [
  "source-layer': 'earth'", "source-layer': 'landuse'", "source-layer': 'water'",
  "source-layer': 'roads'", "source-layer': 'buildings'",
  "'background-color': '#edf1e8'", "'fill-color': '#f5f2e8'",
  "'fill-color': '#dfead9'", "'fill-color': '#b8dbe8'",
  "'line-color': '#c4c1b8'", "'line-color': '#ffffff'",
  "'fill-color': '#c9c5b8'", "'fill-outline-color': '#9d998f'"
];

check('admin page loads the self-hosted MapLibre/PMTiles renderer',
  view.includes('/vendor/maplibre/maplibre-gl.css') &&
  view.includes('/vendor/maplibre/maplibre-gl.js') &&
  view.includes('/vendor/pmtiles/pmtiles.js') &&
  !view.includes('/vendor/leaflet/leaflet.css') &&
  !view.includes('/vendor/leaflet/leaflet.js'));

check('admin controller and view expose only canonical public basemap metadata',
  controller.includes("mapController.getPublicBasemapConfig()") &&
  view.includes('id="admin-map-config"') &&
  view.includes('safeJson({ basemap: mapBasemap || null })'));

check('admin renderer rejects external or non-content-addressed tile assets',
  /cspc-campus-\[a-f0-9\]\{64\}\\\.pmtiles/.test(graph) &&
  graph.includes("url: 'pmtiles://' + asset") &&
  !graph.includes('tile.openstreetmap.org') &&
  !graph.includes('L.tileLayer') &&
  !graph.includes('L.map'));

check('admin basemap style matches the current online/offline campus layers',
  styleTokens.every((token) => graph.includes(token)) &&
  styleTokens.every((token) => online.includes(token) || offline.includes(token)));

check('admin basemap uses the current content-addressed release metadata',
  typeof manifest.asset === 'string' &&
  new RegExp('^/maps/cspc-campus-' + manifest.sha256 + '\\.pmtiles$').test(manifest.asset) &&
  graph.includes('adminBasemapBounds') && graph.includes('maxBounds'));

check('geometry payload stays latitude/longitude while MapLibre receives longitude/latitude',
  graph.includes('path_geometry: wasCleared ? null : geoFullPoints()') &&
  graph.includes('geoFullPoints().map((point) => [point.lng, point.lat])') &&
  graph.includes('.setLngLat([w.lng, w.lat])'));

check('endpoint locks and draggable waypoint editing remain explicit',
  graph.includes("new maplibregl.Marker({ draggable: false })") &&
  graph.includes("new maplibregl.Marker({ draggable: true })") &&
  graph.includes("dm.on('dragend'") &&
  graph.includes('geo.waypoints[i] = { lat: Number(ll.lat), lng: Number(ll.lng) }'));

check('editor line and controls survive MapLibre modal lifecycle',
  graph.includes("map.addSource(GEO_LINE_SOURCE") &&
  graph.includes("map.addLayer({") &&
  graph.includes('map.resize()') &&
  graph.includes('map.fitBounds(bounds') &&
  graph.includes("new maplibre.NavigationControl({ showCompass: false })"));

check('basemap failure preserves the ordered coordinate editor',
  view.includes('id="edge-geo-map-status"') &&
  graph.includes('geoMapUnavailable') &&
  graph.includes('The ordered coordinate list remains usable') &&
  graph.includes('geoRenderList()'));

if (failures) {
  console.error(`ADMIN-MAP-BASEMAP-PROBE FAILED: ${failures} check(s) did not pass.`);
  process.exitCode = 1;
} else {
  console.log('ADMIN-MAP-BASEMAP-PROBE OK: all checks passed.');
}
