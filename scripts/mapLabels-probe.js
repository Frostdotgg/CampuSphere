'use strict';

/* Focused, read-only contract checks for the online/offline map label release. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const map = read('views/map.ejs');
const controller = read('controllers/mapController.js');
const pageController = read('controllers/pageController.js');
const home = read('views/home.ejs');
const offline = read('public/js/offline-guide-manager.js');
const styles = read('public/css/styles.css');
const offlineCss = read('public/css/offline.css');
const sw = read('public/sw.js');

let failures = 0;
function check(label, condition) {
  if (condition) console.log(`[PASS] ${label}`);
  else { failures += 1; console.error(`[FAIL] ${label}`); }
}

check('online map sends canonical start-node metadata to the view',
  /startNode:\s*\(typeof mapStartNode/.test(map) &&
  /async function onlineStartNode\(\)/.test(controller) &&
  /node_key\s*===\s*'main-gate'/.test(controller));
check('online Leaflet and MapLibre markers create safe text labels',
  /createMapLabel\(b\.name, 'map-building-label--leaflet'\)/.test(map) &&
  /createMapLabel\(b\.name, 'map-building-label--maplibre'\)/.test(map) &&
  /label\.textContent\s*=\s*text/.test(map));
check('online map creates a readable start marker and fallback label',
  /Start · Guard House/.test(map) &&
  /map-fallback__origin/.test(map) &&
  /setMapRouteLabels\(isExit, b\)/.test(map) &&
  /originElement\.setAttribute\('aria-label', 'Start: Guard House \/ Main Gate'\)/.test(map));
check('online MapLibre start marker uses a centered geographic anchor',
  /mapStartMarker = new maplibregl\.Marker\(\{[\s\S]{0,160}anchor:\s*'center'/.test(map));
check('online label layout hides off-screen and overlapping labels',
  /getBoundingClientRect\(\)/.test(map) &&
  /overlaps\s*=\s*placed\.some/.test(map) &&
  /entry\.label\.hidden\s*=\s*true/.test(map));
check('offline MapLibre and simplified fallback reuse the same label contract',
  /createOfflineMapLabel\(building\.name, 'map-building-label--offline'\)/.test(offline) &&
  /createOfflineMapLabel\(building\.name, 'map-building-label--fallback'\)/.test(offline) &&
  /setOfflineRouteLabels\(isExit, key\)/.test(offline) &&
  /originEl\.setAttribute\('aria-label', 'Start: ' \+ OFFLINE_ORIGIN_MARKER_LABEL \+ ' \/ Main Gate'\)/.test(offline));
check('offline label layout keeps start and selected labels prioritized',
  /resetOfflineRouteLabels\(\)/.test(offline) &&
  /registerOfflineMapLabel\(originLabel,[\s\S]{0,120}, 100\)/.test(offline) &&
  /overlaps\s*=\s*placed\.some/.test(offline));
check('offline origin marker is centered and fallback has one origin marker',
  /new maplibregl\.Marker\(\{ element: originEl, anchor: 'center' \}\)/.test(offline) &&
  !/var origin = document\.createElementNS\(svgNamespace, 'circle'\)/.test(offline));
check('labels remain passive while existing 44px controls stay intact',
  /\.campus-map-label\s*\{[\s\S]*?pointer-events:\s*none/.test(styles) &&
  /\.map-building-marker--leaflet\s*\{[\s\S]*?width:\s*44px[\s\S]*?height:\s*44px/.test(styles) &&
  /\.offline-fallback-marker\s*\{[\s\S]*?width:\s*44px[\s\S]*?height:\s*44px/.test(offlineCss));
check('label text is readable in both themes',
  /font-size:\s*12px/.test(styles) &&
  /\[data-theme="dark"\] \.campus-map-label/.test(styles));
check('offline fallback centers one origin marker on the route coordinate',
  /\.map-fallback__origin\s*\{\s*transform:\s*translate\(-50%, -50%\)/.test(styles) &&
  /\.offline-map-marker--origin::before\s*\{[\s\S]*?top:\s*12px;[\s\S]*?left:\s*12px;[\s\S]*?width:\s*20px;[\s\S]*?height:\s*20px;/.test(offlineCss));
check('home preview uses the bundled MapLibre/PMTiles map without public OSM tiles',
  /\/vendor\/maplibre\/maplibre-gl\.js/.test(home) &&
  /\/vendor\/maplibre\/maplibre-gl\.css/.test(home) &&
  /\/vendor\/pmtiles\/pmtiles\.js/.test(home) &&
  /new maplibregl\.Map\(/.test(home) &&
  /new pmtiles\.PMTiles\(/.test(home) &&
  !/tile\.openstreetmap\.org/.test(home) &&
  /setDOMContent\(content\)/.test(home) &&
  /textContent\s*=\s*String\(building\.name/.test(home));
check('home preview receives the same public basemap and start-node contract as /map',
  /mapController\.getPublicBasemapConfig\(\)/.test(pageController) &&
  /mapController\.getPublicStartNode\(\)/.test(pageController) &&
  /mapBasemap:\s*mapController\.getPublicBasemapConfig\(\)/.test(pageController) &&
  /mapStartNode:\s*startNodeResult/.test(pageController));
check('service worker advances the offline shell for the new manager/CSS',
/CACHE_VERSION\s*=\s*'v45'/.test(sw) &&
  /'\/js\/offline-guide-manager\.js'/.test(sw) &&
  /'\/css\/offline\.css'/.test(sw));

if (failures) {
  console.error(`MAP-LABELS-PROBE FAILED: ${failures} check(s) did not pass.`);
  process.exitCode = 1;
} else {
  console.log('MAP-LABELS-PROBE OK: all checks passed.');
}
