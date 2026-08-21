'use strict';

/* Focused, database-free OFF.3-OFF.6 candidate probe.
   It exercises pure package assembly and static privacy/runtime contracts only.
   It starts no server, authenticates nobody, and mutates no repository, data,
   session, browser, or vendor state. */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const offlineGuide = require('../services/offlineGuideService');
const {
  offlineFallbackMarkerProblems,
  offlineFallbackMarkerMutationsAreRejected,
  offlineMobileDetailsOverlapProblems,
  offlineMobileDetailsOverlapMutationsAreRejected
} = require('./off2PwaLifecycle-probe');

let checks = 0;
const failures = [];

function ok(label, value) {
  checks += 1;
  const passed = value === true;
  console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${label}`);
  if (!passed) failures.push(label);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function focusReturnBehaviorProblems(source) {
  const problems = [];
  const usableSource = (source.match(/function isUsableFocusReturnTarget\(element\) \{[\s\S]*?\n  \}/) || [])[0] || '';
  const selectSource = (source.match(/function selectFocusReturnTarget\(invoker, fallbackCandidates\) \{[\s\S]*?\n  \}/) || [])[0] || '';
  if (!usableSource || !selectSource) return ['shared focus-return helpers are missing'];

  const sandbox = {
    document: { contains: (element) => element && element.contained !== false },
    window: {
      innerWidth: 390,
      innerHeight: 844,
      getComputedStyle: (element) => element.style
    }
  };
  try {
    vm.runInNewContext(`${usableSource}\n${selectSource}\nthis.focusContract = { isUsableFocusReturnTarget, selectFocusReturnTarget };`, sandbox, {
      timeout: 1000
    });
  } catch (error) {
    return ['shared focus-return helpers cannot be evaluated safely'];
  }

  function element(options = {}) {
    const rect = Object.assign({ left: 10, top: 10, right: 54, bottom: 54, width: 44, height: 44 }, options.rect || {});
    return {
      contained: options.contained !== false,
      isConnected: options.connected !== false,
      disabled: options.disabled === true,
      style: Object.assign({ display: 'block', visibility: 'visible' }, options.style || {}),
      focus() {},
      getAttribute(name) { return (options.attributes || {})[name] || null; },
      closest() { return options.hiddenAncestor ? {} : null; },
      getClientRects() { return options.noRects ? [] : [rect]; },
      getBoundingClientRect() { return rect; }
    };
  }

  const visibleInvoker = element();
  const offscreenConnectedListButton = element({
    rect: { left: 12, top: 900, right: 200, bottom: 944, width: 188, height: 44 }
  });
  const visibleMobileToggle = element({
    rect: { left: 16, top: 780, right: 180, bottom: 824, width: 164, height: 44 }
  });
  const hiddenCandidate = element({ hiddenAncestor: true });
  const contract = sandbox.focusContract;
  if (contract.isUsableFocusReturnTarget(offscreenConnectedListButton) !== false) {
    problems.push('connected off-screen list button is accepted');
  }
  if (contract.selectFocusReturnTarget(offscreenConnectedListButton, [hiddenCandidate, visibleMobileToggle]) !== visibleMobileToggle) {
    problems.push('mobile Building List fallback is not selected');
  }
  if (contract.selectFocusReturnTarget(visibleInvoker, [visibleMobileToggle]) !== visibleInvoker) {
    problems.push('visible invoker is not preserved');
  }
  return problems;
}

function offlineInteractionLifecycleProblems(source, shell) {
  const problems = [];
  const detailsCloseBody = (source.match(/function closeDetails\(\) \{([\s\S]*?)\n  \}\n\n  function highlightSelection/) || [])[1] || '';
  const closeBody = (source.match(/function closeRouteSummary\(\) \{([\s\S]*?)\n  \}\n\n  function clearRoute/) || [])[1] || '';
  const setDestinationBody = (source.match(/function setDestination\(key\) \{([\s\S]*?)\n  \}\n\n  function clearDestination/) || [])[1] || '';
  const mobileSidebarBody = (source.match(/function setMobileSidebar\(open, options\) \{([\s\S]*?)\n  \}\n\n  function syncMobileSidebarViewport/) || [])[1] || '';
  if (!/var routeSummaryInvoker = null;/.test(source)) problems.push('missing invoker state');
  if (!/function rememberRouteSummaryInvoker\(\)[\s\S]*summary\.contains\(active\)[\s\S]*document\.activeElement/.test(source)) {
    problems.push('missing invoker capture');
  }
  if (!/function isUsableFocusReturnTarget\(element\)[\s\S]*document\.contains\(element\)[\s\S]*closest\('\[hidden\], \[aria-hidden="true"\], \[inert\]'\)[\s\S]*getClientRects\(\)[\s\S]*getBoundingClientRect\(\)[\s\S]*window\.innerWidth[\s\S]*window\.innerHeight/.test(source)) {
    problems.push('return target is not visibility-checked');
  }
  problems.push(...focusReturnBehaviorProblems(source));
  if (!/function routeSummaryFocusables\(\)[\s\S]*querySelectorAll\([\s\S]*a\[href\], button, input, select, textarea, \[tabindex\][\s\S]*aria-disabled[\s\S]*tabindex/.test(source)) {
    problems.push('missing focusable filter');
  }
  if (!/rememberRouteSummaryInvoker\(\);[\s\S]*destinationKey = key/.test(setDestinationBody)) {
    problems.push('Set as Destination does not capture before closing details');
  }
  if (!/findRoute\.addEventListener\('click'[\s\S]*rememberRouteSummaryInvoker\(\);[\s\S]*showRoute\(destinationKey\)/.test(source)) {
    problems.push('Find Route does not capture its invoker');
  }
  if (!/var invoker = lastInvoker;[\s\S]*lastInvoker = null;[\s\S]*selectFocusReturnTarget\(invoker, \[[\s\S]*buildingListButtonForKey\(selectedKey\)[\s\S]*offlineBuildingSearch[\s\S]*offlineMobileListToggle[\s\S]*offlineRecenterMap/.test(detailsCloseBody)) {
    problems.push('details close does not restore by the required visible fallback order');
  }
  if (!/var wasOpen =[\s\S]*routeSummaryInvoker = null;[\s\S]*selectFocusReturnTarget\(invoker, \[[\s\S]*offlineRouteFind[\s\S]*buildingListButtonForKey\(destinationKey\)[\s\S]*offlineBuildingSearch[\s\S]*offlineMobileListToggle/.test(closeBody)) {
    problems.push('close does not restore by the required fallback order');
  }
  if (/setData\(|drawFallbackRoute\(/.test(closeBody)) problems.push('close clears the rendered route');
  if (!/routeSummary\.addEventListener\('click'[\s\S]*event\.target === routeSummary[\s\S]*closeRouteSummary\(\)/.test(source)) {
    problems.push('backdrop does not share the close lifecycle');
  }
  if (!/routeSummary\.addEventListener\('keydown'[\s\S]*event\.key === 'Escape'[\s\S]*stopPropagation\(\)[\s\S]*preventDefault\(\)[\s\S]*closeRouteSummary\(\)[\s\S]*event\.key !== 'Tab'[\s\S]*event\.shiftKey[\s\S]*!routeSummary\.contains\(active\)/.test(source)) {
    problems.push('missing Escape or Tab containment');
  }
  if (!/<aside class="map-sidebar offline-sidebar" id="offlineMapSidebar" aria-hidden="true" inert>/.test(shell)) {
    problems.push('mobile sheet is not fail-closed before script initialization');
  }
  if (!/var mobile = isMobileMapLayout\(\);[\s\S]*var shouldOpen = mobile && !!open/.test(mobileSidebarBody) ||
      !/if \(!mobile\)[\s\S]*removeAttribute\('inert'\)[\s\S]*removeAttribute\('aria-hidden'\)/.test(mobileSidebarBody)) {
    problems.push('desktop sidebar availability is not restored');
  }
  if (!/if \(shouldOpen\)[\s\S]*removeAttribute\('inert'\)[\s\S]*setAttribute\('aria-hidden', 'false'\)[\s\S]*focusMobileSidebarSearch\(\)/.test(mobileSidebarBody)) {
    problems.push('opening the mobile sheet does not expose and focus it');
  }
  if (!/selectFocusReturnTarget\(toggle, \[[\s\S]*offlineRecenterMap[\s\S]*offlineThemeToggle[\s\S]*offlineNavToggle[\s\S]*focusTarget\.focus\(\)[\s\S]*setAttribute\('inert', ''\)[\s\S]*setAttribute\('aria-hidden', 'true'\)/.test(mobileSidebarBody)) {
    problems.push('closing the mobile sheet does not restore focus before isolation');
  }
  if (!/matchMedia\(MOBILE_MAP_MEDIA\)[\s\S]*syncMobileSidebarViewport\(mobileSidebarMedia\)[\s\S]*(?:addEventListener\('change'|addListener\()/.test(source) ||
      !/offlineMobileListToggle'[\s\S]*setMobileSidebar\(true, \{ focus: true \}\)[\s\S]*offlineSidebarClose[\s\S]*setMobileSidebar\(false, \{ restoreFocus: true \}\)/.test(source) ||
      !/sidebar && sidebar\.classList\.contains\('is-open'\)[\s\S]*setMobileSidebar\(false, \{ restoreFocus: true \}\)/.test(source)) {
    problems.push('mobile sheet controls, Escape, or viewport lifecycle is incomplete');
  }
  if (!/var THEME_STORAGE_KEY = 'campussphere-theme';/.test(source) ||
      !/function readThemePreference\(\)[\s\S]*try[\s\S]*localStorage\.getItem\(THEME_STORAGE_KEY\)[\s\S]*stored === 'dark' \|\| stored === 'light'[\s\S]*catch/.test(source) ||
      !/function persistThemePreference\(value\)[\s\S]*try[\s\S]*localStorage\.setItem\(THEME_STORAGE_KEY, value\)[\s\S]*catch/.test(source) ||
      !/function applyThemePreference\(value, persist\)[\s\S]*persistThemePreference[\s\S]*updateThemeToggleState\(\)/.test(source) ||
      !/preferredTheme = readThemePreference\(\)[\s\S]*applyThemePreference\(preferredTheme, false\)[\s\S]*theme\.addEventListener\('click'[\s\S]*applyThemePreference\(dark \? 'light' : 'dark', true\)/.test(source) ||
      !/function updateThemeToggleState\(\)[\s\S]*aria-pressed[\s\S]*Switch to light mode[\s\S]*Switch to dark mode/.test(source)) {
    problems.push('theme preference or accessible toggle state is not synchronized');
  }
  if (!/<button class="theme-toggle" id="offlineThemeToggle"[^>]*aria-label="Switch to dark mode"[^>]*aria-pressed="false"/.test(shell)) {
    problems.push('theme toggle lacks an initial accessible state');
  }
  return problems;
}

function offlineInteractionMutationsAreRejected(source, shell) {
  const cases = [
    { source: source.replace('    rememberRouteSummaryInvoker();\n    destinationKey = key;', '    destinationKey = key;'), shell },
    { source: source.replace("    if (element.closest('[hidden], [aria-hidden=\"true\"], [inert]')) return false;", ''), shell },
    { source: source.replace('    if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= window.innerWidth || rect.top >= window.innerHeight) return false;', ''), shell },
    { source: source.replace("        if (event.key !== 'Tab') return;", '        return;'), shell },
    { source: source.replace('    routeSummaryInvoker = null;\n    var target = selectFocusReturnTarget(invoker, [', "    routeSummaryInvoker = null;\n    map.getSource('offline-route').setData({});\n    var target = selectFocusReturnTarget(invoker, ["), shell },
    { source: source.replace("      byId('offlineMobileListToggle'),\n      byId('offlineRecenterMap')", "      byId('offlineRecenterMap')"), shell },
    { source: source.replace("    theme.setAttribute('aria-pressed', dark ? 'true' : 'false');", ''), shell },
    { source: source.replace("  var THEME_STORAGE_KEY = 'campussphere-theme';", "  var THEME_STORAGE_KEY = 'offline-theme';"), shell },
    { source: source.replace('window.localStorage.getItem(THEME_STORAGE_KEY)', "window.localStorage.getItem('wrong-key')"), shell },
    { source: source.replace('window.localStorage.setItem(THEME_STORAGE_KEY, value)', "window.localStorage.setItem('wrong-key', value)"), shell },
    { source: source.replace("    sidebar.setAttribute('inert', '');", ''), shell },
    { source: source.replace('      focusTarget.focus();', ''), shell },
    { source: source.replace("      byId('offlineRecenterMap'),", ''), shell },
    { source: source.replace('      if (options.focus !== false) focusMobileSidebarSearch();', ''), shell },
    {
      source: source
        .replace("mobileSidebarMedia.addEventListener('change', syncMobileSidebarViewport);", '')
        .replace('mobileSidebarMedia.addListener(syncMobileSidebarViewport);', ''),
      shell
    },
    { source, shell: shell.replace(' aria-hidden="true" inert', '') },
    { source, shell: shell.replace(' aria-pressed="false"', '') }
  ];
  return cases.every((fixture) =>
    (fixture.source !== source || fixture.shell !== shell) &&
    offlineInteractionLifecycleProblems(fixture.source, fixture.shell).length > 0);
}

function buildFixture() {
  const nodes = [
    { id: 1, node_key: 'main-gate', label: 'Guard House / Main Gate', node_type: 'entrance', building_id: null, lat: 13.404, lng: 123.371 },
    { id: 2, node_key: 'junction-a', label: 'Central Walk', node_type: 'junction', building_id: null, lat: 13.405, lng: 123.372 },
    { id: 3, node_key: 'fixture-library', label: 'Fixture Library', node_type: 'building', building_id: 42, lat: 13.406, lng: 123.373 }
  ];
  const edges = [
    {
      from_node_id: 1, to_node_id: 2, distance_meters: 120, walk_time_seconds: 90,
      path_label: 'Main Walk', is_accessible: 1,
      path_geometry: [{ lat: 13.404, lng: 123.371 }, { lat: 13.405, lng: 123.372 }]
    },
    {
      from_node_id: 2, to_node_id: 3, distance_meters: 80, walk_time_seconds: 60,
      path_label: 'Library Walk', is_accessible: 1,
      path_geometry: [{ lat: 13.405, lng: 123.372 }, { lat: 13.406, lng: 123.373 }]
    }
  ];
  const buildings = [
    {
      id: 999, name: 'Fixture Library', category: 'Academic', description: '<b>Study</b>',
      lat: 13.406, lng: 123.373, route_available: true, route_destination_id: 42,
      walkTime: '3 minutes', info: [{ label: 'Service', value: 'Reading room' }],
      floors: [{ label: 'Ground Floor', rooms: [{ room: '101', name: 'Reading Room', use: 'Study' }] }],
      entrances: ['East entrance'], landmarks: ['Central Walk'],
      img: 'https://example.invalid/private.jpg', schedules: [{ title: 'Private' }],
      vr_route_id: 7, session: 'never-emit', adminOnly: true
    },
    {
      id: 1000, name: 'Unmapped Annex', category: 'Academic', description: 'Details remain readable.',
      lat: 13.4055, lng: 123.3725, route_available: false,
      route_unavailable_reason: 'not_mapped'
    }
  ];
  return offlineGuide.buildGuide({ buildings, nodeRows: nodes, edgeRows: edges });
}

function runPurePackageChecks() {
  const guide = buildFixture();
  const serialized = JSON.stringify(guide);
  const route = guide.routes[0];
  const library = guide.buildings.find((building) => building.key === 'fixture-library');
  const annex = guide.buildings.find((building) => building.key === 'unmapped-annex');

  ok('package has the canonical Main Gate origin', guide.origin.key === 'main-gate');
  ok('package includes every fixture building but only the routable path', guide.buildings.length === 2 && guide.routes.length === 1);
  ok('route uses the route-source natural destination rather than the building-row id', route && route.destinationKey === 'fixture-library');
  ok('route preserves ordered stored geometry in [lng, lat] form',
    JSON.stringify(route.geometry) === JSON.stringify([[123.371, 13.404], [123.372, 13.405], [123.373, 13.406]]));
  ok('route preserves bounded steps, distance, and walk time',
    route.steps.length === 2 && route.distanceMeters === 200 && route.walkTimeSeconds === 150);
  ok('building details retain text, offices, floors, rooms, entrances, and landmarks',
    library.details.info.length === 1 && library.details.floors[0].rooms.length === 1 &&
    library.details.entrances[0] === 'East entrance' && library.details.landmarks[0] === 'Central Walk');
  ok('HTML-like database text remains inert data rather than markup', library.description === '<b>Study</b>');
  ok('an unmapped building remains visible with a truthful unavailable state',
    annex.routeAvailable === false && annex.routeUnavailableReason === 'not_mapped');
  ok('package emits no backend selector, database id, image, schedule, VR, session, or admin field',
    !/"sources"|"id"|"img"|"schedule|"vr_|"session"|"admin/i.test(serialized));
  ok('package fingerprint is deterministic and content-sensitive',
    offlineGuide.sha256Json(guide) === offlineGuide.sha256Json(buildFixture()) &&
    offlineGuide.sha256Json(guide) !== offlineGuide.sha256Json(Object.assign({}, guide, { origin: Object.assign({}, guide.origin, { label: 'Changed' }) })));
  ok('duplicate canonical destination keys fail closed', (() => {
    try {
      offlineGuide.buildGuide({
        buildings: [
          { name: 'Same Building', route_available: false },
          { name: ' same   building ', route_available: false }
        ],
        nodeRows: [{ id: 1, node_key: 'main-gate', label: 'Main Gate', node_type: 'entrance', lat: 13.4, lng: 123.37 }],
        edgeRows: []
      });
      return false;
    } catch (error) { return true; }
  })());
}

function runStaticBoundaryChecks() {
  const routes = read('routes/map.js');
  const controller = read('controllers/offlineGuideController.js');
  const service = read('services/offlineGuideService.js');
  const manager = read('public/js/offline-guide-manager.js');
  const shell = read('public/offline.html');
  const css = read('public/css/offline.css');
  const sw = read('public/sw.js');
  const pwa = read('public/js/pwa.js');
  const vercel = JSON.parse(read('vercel.json'));
  const mapManifest = JSON.parse(read('public/maps/manifest.json'));
  const vendorManifest = JSON.parse(read('public/vendor/manifest.json'));

  ok('download route is GET-only and protected by requireLogin',
    /router\.get\('\/api\/offline-guide',\s*requireLogin,\s*offlineGuideController\.download\)/.test(routes));
  ok('success and failure responses are no-store/private and vary on Cookie',
    controller.indexOf("'Cache-Control': 'no-store, private'") < controller.indexOf('try {') &&
    /Vary:\s*'Cookie'/.test(controller));
  ok('failure response is a fixed sanitized 503',
    /res\.status\(503\)\.json/.test(controller) && !/err\.message|String\(err/.test(controller));
  ok('package service performs only SELECT repository/database reads', (() => {
    const queries = [...service.matchAll(/db\.query\(\s*(?:'([^']*)'|`([^`]*)`)/g)]
      .map((match) => String(match[1] || match[2] || '').trim());
    // ONE direct read per download (the building rows). The route graph is no
    // longer read a second time here: it arrives with the single immutable
    // snapshot from routeAvailability.loadRouteSource(), which also feeds
    // availability decoration, so the two can never diverge.
    return queries.length === 1 && queries.every((query) => /^SELECT\b/i.test(query)) &&
      !/FROM route_(?:nodes|edges)/i.test(service) &&
      /routeAvailability\.loadRouteSource\(\)/.test(service) &&
      !/(?:buildingRepository|routeRepository)\.(?:create|update|remove|delete|upsert)\(/.test(service);
  })());
  ok('package service applies an explicit two-megabyte response bound',
    /MAX_PACKAGE_BYTES\s*=\s*2\s*\*\s*1024\s*\*\s*1024/.test(service));
  ok('download is explicit and never starts during initialization',
    /addEventListener\('click',\s*downloadGuide\)/.test(manager) &&
    !/DOMContentLoaded[^;]*downloadGuide\(/.test(manager));
  ok('guide JSON and PMTiles fetches bypass HTTP caches',
    /fetch\('\/api\/offline-guide',[\s\S]{0,180}cache:\s*'no-store'/.test(manager) &&
    /fetch\(guide\.basemap\.asset,\s*\{\s*cache:\s*'no-store'/.test(manager));
  ok('JSON and basemap hashes are verified before one atomic IndexedDB write and map replacement',
    /guideHash\s*!==\s*payload\.fingerprint/.test(manager) &&
    /mapHash\s*!==\s*guide\.basemap\.sha256/.test(manager) &&
    /transaction\(STORE,\s*'readwrite'\)/.test(manager) &&
    /function resetMapRuntime/.test(manager) &&
    /removeProtocol\('pmtiles'\)/.test(manager) &&
    /if \(map !== nextMap\) return/.test(manager));
  ok('stored guide and map bytes are reverified on every load',
    /function verifyStoredRecord/.test(manager) && /record\.basemap\.arrayBuffer\(\)/.test(manager));
  ok('database text is rendered through textContent and no innerHTML sink exists',
    /node\.textContent\s*=\s*text/.test(manager) && !/\.innerHTML\s*=/.test(manager));
  ok('map nodes use the online MapLibre marker anchor, fallback markers use reviewed native overlays, and Set as Destination draws immediately',
    /var marker = new maplibregl\.Marker\(\)[\s\S]{0,180}\.setLngLat\(\[building\.lng, building\.lat\]\)/.test(manager) &&
    /markerElement\.classList\.add\('offline-building-marker'\)/.test(manager) &&
    /markerElement\.addEventListener\('click'[\s\S]{0,180}openDetails/.test(manager) &&
    /markerElement\.addEventListener\('keydown'[\s\S]{0,180}event\.key !== 'Enter'[\s\S]{0,120}openDetails/.test(manager) &&
    /function setDestination\(key\)[\s\S]{0,500}showRoute\(key\)/.test(manager) &&
    offlineFallbackMarkerProblems(manager, shell).length === 0 &&
    offlineFallbackMarkerMutationsAreRejected(manager, shell));
  ok('fallback nodes inherit Enter and Space activation from native buttons without interactive SVG descendants',
    /var button = document\.createElement\('button'\)/.test(manager) &&
    /button\.type = 'button'/.test(manager) &&
    !/createElementNS\(svgNamespace, 'g'\)[\s\S]{0,180}setAttribute\('role', 'button'\)/.test(manager) &&
    !/button\.addEventListener\('keydown'/.test(manager));
  ok('details and route dialogs have safe focus placement, containment, route-preserving close, visible-target restoration, and announced theme state', (() => {
    return offlineInteractionLifecycleProblems(manager, shell).length === 0 &&
      offlineInteractionMutationsAreRejected(manager, shell) &&
      offlineMobileDetailsOverlapProblems(css, shell).length === 0 &&
      offlineMobileDetailsOverlapMutationsAreRejected(css, shell) &&
    /close\.focus\(\)/.test(manager) && /event\.key\s*===\s*'Escape'/.test(manager) &&
    /function closeDetails\(\)[\s\S]{0,520}if \(target\) target\.focus\(\)/.test(manager) &&
    /function closeRouteSummary\(\)[\s\S]{0,260}summary\.hidden = true/.test(manager) &&
    /routeClose\.addEventListener\('click', closeRouteSummary\)/.test(manager) &&
    /routeClear\.addEventListener\('click', clearRoute\)/.test(manager) &&
    /mapClear\.addEventListener\('click', clearRoute\)/.test(manager);
  })());
  ok('offline shell loads only the three reviewed same-origin scripts', (() => {
    const scripts = [...shell.matchAll(/<script\s+src="([^"]+)"\s+defer><\/script>/g)].map((match) => match[1]);
    return JSON.stringify(scripts) === JSON.stringify([
      '/vendor/maplibre/maplibre-gl.js', '/vendor/pmtiles/pmtiles.js', '/js/offline-guide-manager.js'
    ]) && !/\son[a-z]+\s*=|javascript:/i.test(shell);
  })());
  ok('offline shell excludes 360, Guided VR, Free Roam, schedules, and photos',
    !/href="[^"]*\/vr|src="[^"]*pannellum|panorama|schedule(s)?\s*:/i.test(shell) &&
    /no account, session, schedule, admin, photo, or 360 data/i.test(shell));
  ok('service worker forbids the package API and never precaches guide JSON or the PMTiles archive', (() => {
    const precache = (sw.match(/PRECACHE_URLS\s*=\s*\[([\s\S]*?)\]/) || [])[1] || '';
    return sw.includes("'/api/offline-guide'") && !/\/api\/offline-guide/.test(precache) && !/\.pmtiles/.test(precache);
  })());
  ok('service worker still keeps every HTML navigation network-only',
    /function navigationFallbackStrategy[\s\S]*?fetch\(event\.request\)/.test(sw) &&
    !/\bvar\s+PAGE_CACHE\s*=/.test(sw));
  ok('explicit logout closes bounded handles, signals open tabs, and durably deletes only the exact guide database', (() => {
    // Exactly one database name is ever passed to deleteDatabase(), and it is
    // the exact guide database — pinned through its named constant.
    const dbNameConst = (pwa.match(/OFFLINE_GUIDE_DB_NAME\s*=\s*'([^']+)'/) || [])[1];
    const deletes = [...pwa.matchAll(/indexedDB\.deleteDatabase\(([^)]*)\)/g)].map((m) => m[1].trim());
    const exactSingleTarget = dbNameConst === 'campusphere-offline-guide' &&
      deletes.length === 1 && deletes[0] === 'OFFLINE_GUIDE_DB_NAME' &&
      !/deleteDatabase\([^)]*(?:\*|RegExp)/.test(pwa);
    // Durable intent: the pending marker is written BEFORE the logged_out marker
    // is stripped, cleared ONLY on a confirmed deletion, and retried on later
    // page loads. Blocked/error attempts resolve false and stay pending.
    const durable =
      /markOfflineGuideDeletionPending\(\);\s*\n\s*stripLoggedOutParam\(\);/.test(pwa) &&
      /if \(deleted\) clearOfflineGuideDeletionPending\(\);/.test(pwa) &&
      /req\.onblocked = function \(\) \{ settle\(false\); \};/.test(pwa) &&
      /retryPendingOfflineGuideDeletion\(\)/.test(pwa) &&
      /if \(offlineGuideDeletionInFlight\) return offlineGuideDeletionInFlight;/.test(pwa);
    // Only this one namespaced localStorage key is ever removed.
    const removals = [...pwa.matchAll(/localStorage\.removeItem\(([^)]*)\)/g)].map((m) => m[1].trim());
    const narrowStorage = removals.every((r) => r === 'OFFLINE_GUIDE_PENDING_KEY' || r === 'OFFLINE_GUIDE_LOGOUT_KEY') &&
      !/localStorage\.clear\(\)/.test(pwa);
    return exactSingleTarget && durable && narrowStorage &&
      /database\.close\(\)/.test(manager) &&
      /new BroadcastChannel\(CONTROL_CHANNEL\)/.test(manager) &&
      /event\.data\.type === 'LOGOUT'/.test(manager) &&
      /startedAtLogoutVersion !== logoutVersion/.test(manager) &&
      /downloadController\.abort\(\)/.test(manager);
  })());
  ok('offline shell CSP permits only the required same-origin runtime and blob worker boundary', (() => {
    const rule = vercel.headers.find((entry) => entry.source === '/offline.html');
    const csp = rule && rule.headers.find((header) => header.key === 'Content-Security-Policy');
    return !!csp && /script-src 'self'/.test(csp.value) && /script-src-attr 'none'/.test(csp.value) &&
      /frame-src 'none'/.test(csp.value) && /worker-src 'self' blob:/.test(csp.value) &&
      !/https?:/.test(csp.value);
  })());
  ok('basemap URL is an exact full-hash content-addressed PMTiles path',
    /^\/maps\/cspc-campus-[0-9a-f]{64}\.pmtiles$/.test(mapManifest.asset));
  const mapPath = path.join(ROOT, 'public', mapManifest.asset.replace(/^\//, ''));
  const mapBytes = fs.readFileSync(mapPath);
  ok('basemap byte count and SHA-256 reproduce its manifest',
    mapBytes.length === mapManifest.bytes && sha256(mapBytes) === mapManifest.sha256);
  ok('basemap is a valid PMTiles v3 archive bounded to the CSPC extract',
    mapBytes[0] === 0x50 && mapBytes[1] === 0x4d && mapBytes[7] === 3 && mapBytes[101] === 15 &&
    Array.isArray(mapManifest.bounds) && mapManifest.bounds.length === 4);
  const pmtiles = vendorManifest.packages.find((pkg) => pkg.name === 'pmtiles');
  ok('PMTiles reader provenance is exact-version, exact-integrity, and gitHead pinned',
    pmtiles && pmtiles.version === '4.4.1' && /^sha512-/.test(pmtiles.integrity) && /^[0-9a-f]{40}$/.test(pmtiles.gitHead));
  ok('PMTiles JavaScript and license reproduce their independent manifest hashes',
    pmtiles.files.every((file) => {
      const bytes = fs.readFileSync(path.join(ROOT, 'public', file.destination.replace(/^\//, '')));
      return bytes.length === file.bytes && sha256(bytes) === file.sha256;
    }));
}

function main() {
  console.log('OFF.3-OFF.6 focused 2D offline navigation candidate probe');
  console.log('Database-free, server-free, browser-free, and state-neutral.');
  runPurePackageChecks();
  runStaticBoundaryChecks();
  console.log('');
  if (failures.length === 0) {
    console.log(`OFFLINE-2D-NAVIGATION-PROBE OK: ${checks}/${checks} checks passed.`);
    return;
  }
  console.error(`OFFLINE-2D-NAVIGATION-PROBE FAILED: ${failures.length}/${checks} check(s) failed.`);
  failures.forEach((failure) => console.error('  - ' + failure));
  process.exitCode = 1;
}

if (require.main === module) main();
