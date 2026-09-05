'use strict';

/* ========================================
   CampuSphere - Public Road-Following Route Rendering probe
   Pre-Milestone-12 Section RF.5 verification script.

   RF.5 makes the public /map draw the server-computed route along the stored
   road/walkway geometry (route.geometry) while keeping a reliable fallback to
   route.nodes, without changing route selection, distance, walk time, ordered
   nodes/segments, the route panel, Set VR Route, or Free Roam. This probe
   proves the client rendering contract three ways, with NO foreground server:

     1) Pure logic (extracted + sandboxed): the strict all-or-nothing point-list
        validator and the geometry-preferred / nodes-fallback selector from
        views/map.ejs are pulled out of the RF5-PURE sentinel block, evaluated
        in a vm context, and asserted directly — geometry preference, valid
        node fallback, and rejection of malformed / partial / non-finite /
        out-of-range shapes with NO point filtering (a dropped point could
        otherwise stitch a building-crossing diagonal).

     2) Static source invariants on views/map.ejs: Leaflet [lat,lng] vs MapLibre
        [lng,lat] coordinate ordering, preserved #2563eb / width / opacity /
        source+layer names, the single shared request-generation token used
        across findRoute + findComputedRoute (clear-on-begin, guard-after-await,
        destination-clear invalidation), no browser-side external routing
        dependency, and unchanged API / route-panel / Set VR Route / Free Roam.

     3) Live regression (both runtime modes via with-server): a real
        /api/pathfind route is validated with the SAME extracted selector,
        proving the API still returns a drawable route.geometry that is
        preferred over route.nodes in MySQL and Supabase — plus a leak scan.

     4) BE.5 keyboard accessibility (static, map.ejs + styles.css): native
        <button> result cards with preserved data attributes and button-reset +
        focus-visible styling, the route dialog's hidden/aria-hidden closed
        state, the single shared open/close focus lifecycle (invoker capture,
        close-button focus, focus restore), Tab/Shift+Tab containment, Escape
        through the one close path, and the canonical Guard House / Main Gate
        start label over the stable main-gate key.

     5) BE.5 focus-return validation (pure, vm-extracted from the
        BE5-FOCUS-PURE block): the REAL isUsableRoutePanelReturnTarget /
        selectRoutePanelReturnTarget helpers run against mocked elements and a
        mocked viewport/getComputedStyle — closed-.map-panel rejection even
        mid-transition, off-screen / zero-sized / no-rect rejection, disabled /
        aria-disabled / tabindex=-1 / hidden / aria-hidden / inert /
        display:none / visibility rejection, the exact invoker -> routeFindBtn
        -> result card -> search -> mobile-toggle fallback order, and a
        null-safe no-candidate result.

     6) BE.5 delegated result activation (pure, vm-extracted from the
        BE5-RESULT-ACTIVATION-PURE block): the REAL
        resolveResultActivationTarget / activateResultButton helpers run
        against a mocked 390x844 mobile DOM — the exact Main Academic Building
        search result activates from the button, image, name, category, and
        both badges; delegation survives repeated rerenders; one activation
        makes exactly one fail-closed selectBuildingFromResult call; route
        rows call openRouteById exactly once; malformed/stale/detached/
        outside-list identities fail closed; and the generated button markup
        nests no invalid div.

   READ-ONLY: creates no rows, so there is nothing to clean. Prints fixed
   PASS/FAIL labels only — never raw rows, cookies, secrets, request bodies,
   raw DB errors, geometry dumps, or stack traces.

   Run:   node scripts/publicRoadRouteRendering-probe.js
   ======================================== */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { withServer } = require('./with-server');
const { hasSupabaseConfig } = require('../config/supabase');

// M12.P1-R1: regression identities come from the shared TEST-ONLY loader —
// deterministic local fixtures for the MySQL leg, SUPABASE_REGRESSION_* env
// (fail-closed, never printed) for the Supabase leg. No hardcoded
// live-capable credential remains in this probe.
const { getRegressionCredentials } = require('./regressionCredentials');
// Shared probe session ownership (scripts/probeSessionLifecycle.js): every
// canonical identity authenticated here is terminated through the real logout
// interface so `npm test` leaves no persisted regression session behind.
const { createProbeSessionTracker } = require('./probeSessionLifecycle');

const MAP_EJS_PATH = path.join(__dirname, '..', 'views', 'map.ejs');
const STYLES_CSS_PATH = path.join(__dirname, '..', 'public', 'css', 'styles.css');

const failures = [];
function check(scope, label, ok) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!ok) failures.push(`${scope} :: ${label}`);
}

/* ------------------------------------------------------------------ *
 * 1) Pure logic: extract the RF5-PURE block and evaluate it in a vm  *
 * ------------------------------------------------------------------ */
const START_MARKER = '// RF5-PURE-START';
const END_MARKER = '// RF5-PURE-END';

function extractPureBlock(src) {
  const si = src.indexOf(START_MARKER);
  const ei = src.indexOf(END_MARKER);
  if (si === -1 || ei === -1 || ei < si) return null;
  const blockStart = src.indexOf('\n', si) + 1; // begin AFTER the start-marker line
  if (blockStart <= 0 || blockStart >= ei) return null;
  return src.slice(blockStart, ei);
}

function loadPureApi(src) {
  const block = extractPureBlock(src);
  if (!block) return null;
  const context = vm.createContext({});
  const wrapped = `${block}\nthis.__rf5 = { isValidRoutePointList: isValidRoutePointList, selectRoutePoints: selectRoutePoints };`;
  try {
    vm.runInContext(wrapped, context, { timeout: 2000 });
  } catch (e) {
    return null;
  }
  const api = context.__rf5;
  if (!api || typeof api.isValidRoutePointList !== 'function' || typeof api.selectRoutePoints !== 'function') {
    return null;
  }
  return api;
}

function runPureLogicGate(src) {
  const scope = 'pure-logic';
  const api = loadPureApi(src);
  check(scope, 'RF5-PURE block extracted + exposes isValidRoutePointList + selectRoutePoints', !!api);
  if (!api) return;
  const { isValidRoutePointList, selectRoutePoints } = api;

  // Fixtures. All coordinates are on-campus-ish / in-range unless testing rejection.
  const geom2 = [{ lat: 13.4059, lng: 123.3736 }, { lat: 13.4065, lng: 123.3742 }];
  const geom3 = [{ lat: 13.4059, lng: 123.3736 }, { lat: 13.4062, lng: 123.3739 }, { lat: 13.4065, lng: 123.3742 }];
  const nodes3 = [
    { key: 'a', label: 'A', lat: 13.4059, lng: 123.3736 },
    { key: 'b', label: 'B', lat: 13.4062, lng: 123.3739 },
    { key: 'c', label: 'C', lat: 13.4065, lng: 123.3742 },
  ];
  const partialGeom = [{ lat: 13.4059, lng: 123.3736 }, { lat: NaN, lng: 123.3739 }, { lat: 13.4065, lng: 123.3742 }];

  // ---- validator: acceptance ----
  check(scope, 'validator accepts a 2-point in-range list', isValidRoutePointList(geom2) === true);
  check(scope, 'validator accepts exact range limits (-90/90, -180/180)',
    isValidRoutePointList([{ lat: -90, lng: -180 }, { lat: 90, lng: 180 }]) === true);

  // ---- validator: rejection (never filters) ----
  check(scope, 'validator rejects non-array', isValidRoutePointList(null) === false
    && isValidRoutePointList('x') === false && isValidRoutePointList({ 0: { lat: 1, lng: 1 }, length: 2 }) === false);
  check(scope, 'validator rejects < 2 points', isValidRoutePointList([{ lat: 13.4, lng: 123.3 }]) === false
    && isValidRoutePointList([]) === false);
  check(scope, 'validator rejects a null / non-object point',
    isValidRoutePointList([{ lat: 13.4, lng: 123.3 }, null]) === false
    && isValidRoutePointList([{ lat: 13.4, lng: 123.3 }, 5]) === false);
  check(scope, 'validator rejects a point missing lat or lng',
    isValidRoutePointList([{ lat: 13.4, lng: 123.3 }, { lat: 13.5 }]) === false
    && isValidRoutePointList([{ lat: 13.4, lng: 123.3 }, { lng: 123.4 }]) === false);
  check(scope, 'validator rejects array-shaped points ([lat,lng])',
    isValidRoutePointList([[13.4, 123.3], [13.5, 123.4]]) === false);
  check(scope, 'validator rejects non-finite coordinates (NaN / Infinity)',
    isValidRoutePointList([{ lat: 13.4, lng: 123.3 }, { lat: NaN, lng: 123.4 }]) === false
    && isValidRoutePointList([{ lat: 13.4, lng: 123.3 }, { lat: Infinity, lng: 123.4 }]) === false);
  check(scope, 'validator rejects numeric-string coordinates',
    isValidRoutePointList([{ lat: '13.4', lng: '123.3' }, { lat: '13.5', lng: '123.4' }]) === false);
  check(scope, 'validator rejects out-of-range latitude',
    isValidRoutePointList([{ lat: 91, lng: 123.3 }, { lat: 13.5, lng: 123.4 }]) === false
    && isValidRoutePointList([{ lat: -90.5, lng: 123.3 }, { lat: 13.5, lng: 123.4 }]) === false);
  check(scope, 'validator rejects out-of-range longitude',
    isValidRoutePointList([{ lat: 13.4, lng: 181 }, { lat: 13.5, lng: 123.4 }]) === false
    && isValidRoutePointList([{ lat: 13.4, lng: -180.5 }, { lat: 13.5, lng: 123.4 }]) === false);
  check(scope, 'validator rejects a PARTIALLY-invalid list wholesale (no filtering)',
    isValidRoutePointList(partialGeom) === false);

  // ---- selector: geometry preference / node fallback / neither ----
  check(scope, 'selector prefers valid route.geometry over route.nodes',
    selectRoutePoints({ geometry: geom3, nodes: nodes3 }) === geom3);
  check(scope, 'selector falls back to route.nodes when geometry is absent',
    selectRoutePoints({ nodes: nodes3 }) === nodes3);
  check(scope, 'selector falls back to route.nodes when geometry is PARTIAL/invalid (no salvaged diagonal)',
    selectRoutePoints({ geometry: partialGeom, nodes: nodes3 }) === nodes3);
  check(scope, 'selector returns null when neither geometry nor nodes is valid',
    selectRoutePoints({ geometry: [{ lat: 0, lng: 0 }], nodes: [{ lat: 200, lng: 0 }, { lat: 13, lng: 123 }] }) === null);
  check(scope, 'selector returns null for a missing route', selectRoutePoints(null) === null);
  check(scope, 'selector uses geometry even when nodes are invalid',
    selectRoutePoints({ geometry: geom2, nodes: [{ lat: 999, lng: 0 }] }) === geom2);

  return api;
}

/* ------------------------------------------------------------------ *
 * 2) Static source invariants on views/map.ejs                       *
 * ------------------------------------------------------------------ */
function countOccurrences(hay, needle) {
  let n = 0;
  let i = hay.indexOf(needle);
  while (i !== -1) { n += 1; i = hay.indexOf(needle, i + needle.length); }
  return n;
}

function runStaticSourceGate(src) {
  const scope = 'static-source';

  // Selector wired into drawing; the old per-point node filter is gone.
  check(scope, 'drawComputedPath selects points via selectRoutePoints(route)',
    src.includes('const pts = selectRoutePoints(route);'));
  check(scope, 'no per-point node filtering remains (would allow a diagonal)',
    !src.includes('(route.nodes || []).filter'));

  // Renderer coordinate ordering.
  check(scope, 'MapLibre uses GeoJSON [lng, lat] ordering', src.includes('pts.map(p => [p.lng, p.lat])'));
  check(scope, 'Leaflet uses polyline [lat, lng] ordering', src.includes('pts.map(p => [p.lat, p.lng])'));

  // Preserved styling / source + layer names / fit behavior.
  check(scope, "MapLibre keeps blue #2563eb line-color", src.includes("'line-color': '#2563eb'"));
  check(scope, 'MapLibre keeps line-width 4 + line-opacity 0.85',
    src.includes("'line-width': 4") && src.includes("'line-opacity': 0.85"));
  check(scope, 'Leaflet keeps blue #2563eb weight 4 opacity 0.85',
    src.includes("color: '#2563eb', weight: 4, opacity: 0.85"));
  check(scope, 'computed-route source + computed-route-line layer names preserved',
    src.includes("'computed-route'") && src.includes("id: 'computed-route-line'"));
  check(scope, 'fitBounds is used on both renderers',
    src.includes('maplibreMap.fitBounds(') && src.includes('leafletMap.fitBounds('));

  // Single shared generation token + guards.
  check(scope, 'exactly one routeRequestToken generation counter declared',
    countOccurrences(src, 'let routeRequestToken = 0;') === 1);
  check(scope, 'beginRouteLookup clears the line + resets stale panel content',
    /function beginRouteLookup\(\)\s*{[\s\S]*?clearComputedPath\(\);[\s\S]*?resetRoutePanelTransient\(\);[\s\S]*?return routeRequestToken;/.test(src));
  // The invariant is that findRoute threads ITS OWN live token into the computed
  // fallback (one generation, no second line-clear). Asserted structurally rather
  // than as an exact source string: BE.3 additionally passes route_destination_id
  // in that object literal, and a formatting-sensitive check would flag a
  // behaviour-preserving edit. Dropping the token still fails this.
  check(scope, 'findRoute begins a lookup and passes its token to the computed fallback',
    /async function findRoute\(\)[\s\S]*?const token = beginRouteLookup\(\);/.test(src)
    && /await findComputedRoute\(\s*\{[\s\S]*?destinationBuilding\.name[\s\S]*?\}\s*,\s*token\s*\)/.test(src));
  check(scope, 'findComputedRoute accepts an inherited token and optional exit direction',
    /async function findComputedRoute\(b, inheritedToken(?:, options)?\)/.test(src)
    && src.includes("(typeof inheritedToken === 'number') ? inheritedToken : beginRouteLookup()"));
  check(scope, 'every awaited route response is guarded by isCurrentRouteLookup',
    countOccurrences(src, 'if (!isCurrentRouteLookup(token)) return;') >= 4);
  check(scope, 'clearing the destination invalidates pending requests (cancelRouteLookup)',
    /function cancelRouteLookup\(\)\s*{[\s\S]*?routeRequestToken \+= 1;[\s\S]*?clearComputedPath\(\);/.test(src)
    && /setHint\(PLANNER_HINT_EMPTY\);[\s\S]*?cancelRouteLookup\(\);/.test(src));

  // Sanitized logging: no raw error object logged from the route paths.
  check(scope, 'route lookups log fixed labels only (no raw error / body / geometry)',
    src.includes("console.error('findRoute failed')")
    && src.includes("console.error('findComputedRoute failed')")
    && !src.includes("console.error('findRoute failed', err)")
    && !src.includes("console.error('findComputedRoute failed', err)"));

  // No browser-side external routing dependency (OSM tiles are map tiles, allowed).
  check(scope, 'no browser-side external routing / directions provider',
    !/googleapis|google\.com\/maps|maps\.google|mapbox\.com\/directions|api\.mapbox\.com\/directions|project-osrm|router\.project|graphhopper|strava|earthengine/i.test(src));

  // Unchanged API endpoints.
  check(scope, 'unchanged API: /api/pathfind + /api/routes still queried',
    src.includes('/api/pathfind?start=') && src.includes('/api/routes?start='));
  check(scope, 'directional exit action uses startBuildingId and suppresses VR for exits',
    src.includes('id="panelExitBtn"') && src.includes('startBuildingId=') &&
    src.includes("if (isExit) {") && src.includes('Exit to Main Gate'));
  check(scope, 'route computation is not duplicated in the browser (no client Dijkstra/edges fetch)',
    !/dijkstra/i.test(src) && !src.includes('route_edges') && !src.includes('/api/route-edges'));

  // Set VR Route + Free Roam preserved.
  check(scope, 'Set VR Route preserved (panel + destination-based VR links)',
    src.includes('routePanelVrBtn') && src.includes('panelVrBtn')
    && src.includes('/vr/to/') && src.includes('/vr/routes/'));
  check(scope, 'Free Roam 360 entry preserved',
    src.includes('id="freeRoamBtn"') && src.includes('Free Roam 360'));

  // Building pins are deliberately smaller visually, while their geographic
  // anchor and keyboard/touch target remain stable in every renderer.
  check(scope, 'online building pins use the shared 70% scale and preserve the MapLibre offset anchor',
    src.includes('const MAP_BUILDING_PIN_SCALE = 0.7;')
    && src.includes('const MAP_BUILDING_PIN_HIT_SIZE = 44;')
    && src.includes('const MAP_BUILDING_PIN_OFFSET = Object.freeze([0, -14 * MAP_BUILDING_PIN_SCALE]);')
    && /new maplibregl\.Marker\(\{[\s\S]*?scale: MAP_BUILDING_PIN_SCALE,[\s\S]*?offset: MAP_BUILDING_PIN_OFFSET[\s\S]*?\}\)/.test(src));
  check(scope, 'Leaflet building pins use a 44px div-icon wrapper with the same geographic bottom anchor',
    /const buildingIcon = L\.divIcon\(\{[\s\S]*?className: 'map-building-marker map-building-marker--leaflet',[\s\S]*?iconSize: \[MAP_BUILDING_PIN_HIT_SIZE, MAP_BUILDING_PIN_HIT_SIZE\],[\s\S]*?iconAnchor: \[MAP_BUILDING_PIN_HIT_SIZE \/ 2, MAP_BUILDING_PIN_HIT_SIZE\]/.test(src));
  check(scope, 'static fallback keeps the building glyph inside a native button target',
    src.includes("marker.className = 'map-fallback__marker';")
    && src.includes("markerVisual.className = 'map-fallback__marker-icon';")
    && src.includes("marker.appendChild(markerVisual);"));
}

/* ------------------------------------------------------------------ *
 * 2b) RF.5 hardening: openRouteById joins the shared generation      *
 * ------------------------------------------------------------------ *
 * The predefined-route flow (GET /api/routes/:id) must run inside the SAME
 * routeRequestToken lifecycle as findRoute / findComputedRoute. Beginning the
 * lookup clears any drawn computed line (Leaflet polyline / MapLibre
 * computed-route layer) and resets stale panel content, so opening a
 * predefined route can never leave an older computed destination's line
 * visible, and a superseded response can never repaint stale state. Route
 * cards currently expose no data-route-id, so this is a forward-looking guard
 * rather than a presently user-reachable defect.
 * ------------------------------------------------------------------ */
function sliceFn(source, startMarker, endMarker) {
  const s = source.indexOf(startMarker);
  if (s === -1) return '';
  const e = source.indexOf(endMarker, s);
  return e === -1 ? source.slice(s) : source.slice(s, e);
}

// Assertions about what the function DOES must read code, not prose: an
// explanatory comment naming an endpoint it deliberately avoids must not
// register as a call to it.
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function runPredefinedRouteGate(src) {
  const scope = 'predefined-route';
  const fn = sliceFn(src, 'async function openRouteById(', 'function openRoutePanel(');
  check(scope, 'openRouteById(routeId) is present', fn.length > 0);
  if (!fn.length) return;
  const code = stripComments(fn); // behavioral assertions read code, not comments

  check(scope, 'keeps the existing finite route-id validation',
    fn.includes('if (!Number.isFinite(routeId)) return;'));
  check(scope, 'begins through beginRouteLookup() and retains its token',
    /const token = beginRouteLookup\(\);/.test(fn));
  check(scope, 'begins the lookup BEFORE the request starts (clears the line first)',
    fn.indexOf('const token = beginRouteLookup();') !== -1
    && fn.indexOf('await fetch(') !== -1
    && fn.indexOf('const token = beginRouteLookup();') < fn.indexOf('await fetch('));
  check(scope, 'guards after BOTH awaited operations (fetch + json)',
    countOccurrences(fn, 'if (!isCurrentRouteLookup(token)) return;') >= 2);
  check(scope, 'ignores stale failures in catch BEFORE the sanitized hint',
    /catch \(err\) \{\s*if \(!isCurrentRouteLookup\(token\)\) return;[\s\S]*?setHint\(/.test(fn));
  check(scope, 'preserves openRoutePanel + setDestination on a current success',
    fn.includes('openRoutePanel(data.route)') && fn.includes('setDestination(data.route.destination)'));
  check(scope, 'logs the fixed label only (no raw error / response / body / URL)',
    code.includes("console.error('openRouteById failed')")
    && !code.includes("console.error('openRouteById failed', err)")
    && !/console\.(log|warn|error)\([^)]*\b(err|data|res|routeId)\b[^)]*\)/
      .test(code.replace("console.error('openRouteById failed')", '')));
  check(scope, 'introduces NO second request counter (one routeRequestToken only)',
    countOccurrences(src, 'let routeRequestToken = 0;') === 1
    && !/let\s+\w+\s*=\s*0;/.test(code) && !/\+= 1/.test(code));
  check(scope, 'does NOT duplicate route computation (no /api/pathfind, no drawComputedPath)',
    !code.includes('/api/pathfind') && !code.includes('drawComputedPath') && !code.includes('findComputedRoute'));
  check(scope, 'still uses the existing predefined endpoint /api/routes/:id',
    code.includes('/api/routes/${routeId}'));
}

/* ------------------------------------------------------------------ *
 * 2c) BE.5 keyboard accessibility: native result buttons, dialog     *
 *     focus lifecycle, containment, canonical start label            *
 * ------------------------------------------------------------------ */
function cssRuleBlock(css, selector) {
  const i = css.indexOf(selector);
  if (i === -1) return '';
  const open = css.indexOf('{', i);
  if (open === -1) return '';
  const close = css.indexOf('}', open);
  if (close === -1) return '';
  return css.slice(open + 1, close);
}

function cssRuleBlockLast(css, selector) {
  const i = css.lastIndexOf(selector);
  if (i === -1) return '';
  const open = css.indexOf('{', i);
  if (open === -1) return '';
  const close = css.indexOf('}', open);
  if (close === -1) return '';
  return css.slice(open + 1, close);
}

function runKeyboardAccessGate(src, css) {
  const scope = 'keyboard-access';

  // Native result controls (no <div role="button"> emulation).
  const bFn = sliceFn(src, 'function buildingItemHtml(', 'function routeItemHtml(');
  const rFn = sliceFn(src, 'function routeItemHtml(', 'function categoryOfResult(');
  check(scope, 'buildingItemHtml renders a native <button type="button"> map-bldg-item',
    bFn.includes('<button type="button" class="map-bldg-item'));
  check(scope, 'routeItemHtml renders a native <button type="button"> map-bldg-item',
    rFn.includes('<button type="button" class="map-bldg-item map-bldg-item--route"'));
  check(scope, 'the old mouse-only <div class="map-bldg-item"> form is gone from both generators',
    bFn.length > 0 && rFn.length > 0
    && !bFn.includes('<div class="map-bldg-item') && !rFn.includes('<div class="map-bldg-item')
    && !src.includes('role="button"'));
  check(scope, 'native result controls keep data-id / data-name / data-route-id / unavailable marker',
    bFn.includes('data-id="${b.id}"') && bFn.includes('data-name="${escapeHtml(b.name)}"')
    && bFn.includes('data-route-unavailable="true"') && rFn.includes('data-route-id="${r.route.id}"'));
  check(scope, 'unroutable buildings stay enabled (no disabled result buttons)',
    !bFn.includes('disabled') && !rFn.includes('disabled'));

  // Button reset + visible focus styling.
  const cardRule = cssRuleBlock(css, '\n.map-bldg-item {');
  check(scope, 'map-bldg-item has explicit native-button reset styling',
    cardRule.includes('width: 100%') && cardRule.includes('appearance: none')
    && cardRule.includes('font: inherit') && cardRule.includes('color: inherit')
    && cardRule.includes('text-align: left'));
  check(scope, 'map-bldg-item has a visible :focus-visible outline (light + dark)',
    cssRuleBlock(css, '.map-bldg-item:focus-visible').includes('outline')
    && cssRuleBlock(css, '[data-theme="dark"] .map-bldg-item:focus-visible').includes('outline'));

  const leafletWrapper = cssRuleBlock(css, '.map-building-marker--leaflet {');
  const leafletPin = cssRuleBlockLast(css, '.map-building-marker--leaflet::after {');
  const leafletShadow = cssRuleBlockLast(css, '.map-building-marker--leaflet::before {');
  const mapLibreHit = cssRuleBlock(css, '.map-building-marker--maplibre::before {');
  const fallbackWrapper = cssRuleBlock(css, '.map-fallback__marker {');
  const fallbackGlyph = cssRuleBlock(css, '.map-fallback__marker-icon {');
  check(scope, 'online Leaflet and MapLibre marker wrappers keep exact 44px interaction targets',
    leafletWrapper.includes('width: 44px') && leafletWrapper.includes('height: 44px')
    && mapLibreHit.includes('width: 44px') && mapLibreHit.includes('height: 44px'));
  check(scope, 'online building glyphs are reduced to the reviewed 18x29 Leaflet pin and local assets',
    leafletPin.includes('width: 18px') && leafletPin.includes('height: 29px')
    && leafletPin.includes("url('/vendor/leaflet/images/marker-icon.png')")
    && leafletShadow.includes('width: 29px') && leafletShadow.includes('height: 29px')
    && !/https?:\/\//i.test(leafletPin + leafletShadow));
  check(scope, 'static fallback glyph is visually compact without shrinking its 44px button',
    fallbackWrapper.includes('width: 44px') && fallbackWrapper.includes('height: 44px')
    && fallbackGlyph.includes('width: 25px') && fallbackGlyph.includes('height: 25px'));

  // Dialog closed state: unreachable for keyboard + accessibility tree.
  check(scope, 'routePanelOverlay starts hidden + aria-hidden="true" with dialog semantics kept',
    /<div class="route-modal-overlay" id="routePanelOverlay" role="dialog" aria-modal="true"\s+aria-labelledby="routePanelTitle" aria-hidden="true" hidden>/.test(src));
  check(scope, 'CSS removes the hidden overlay from layout (display: none)',
    cssRuleBlock(css, '.route-modal-overlay[hidden]').includes('display: none'));

  // One shared open/close focus lifecycle.
  const showFn = sliceFn(src, 'function showRoutePanelDialog(', 'function openRoutePanel(');
  const openFn = sliceFn(src, 'function openRoutePanel(', 'function closeRoutePanel(');
  const openComputedFn = sliceFn(src, 'function openComputedRoutePanel(', 'async function findComputedRoute(');
  const closeFn = sliceFn(src, 'function closeRoutePanel(', 'const COMPUTED_START_KEY');
  check(scope, 'predefined + computed panels open through ONE shared showRoutePanelDialog()',
    openFn.includes('showRoutePanelDialog();') && openComputedFn.includes('showRoutePanelDialog();')
    && !openFn.includes("classList.add('open')") && !openComputedFn.includes("classList.add('open')"));
  check(scope, 'opening reveals the dialog (hidden=false, aria-hidden=false, open) and focuses the close button',
    showFn.includes('routePanelOverlay.hidden = false')
    && showFn.includes("setAttribute('aria-hidden', 'false')")
    && showFn.includes("classList.add('open')")
    && showFn.includes('routePanelClose.focus()'));
  check(scope, 'closing hides immediately, clears the saved invoker once, and focuses only a validated target',
    closeFn.includes("classList.remove('open')")
    && closeFn.includes("setAttribute('aria-hidden', 'true')")
    && closeFn.includes('routePanelOverlay.hidden = true')
    && closeFn.includes('const invoker = routePanelInvoker;')
    && countOccurrences(closeFn, 'routePanelInvoker = null') === 1
    && closeFn.includes('selectRoutePanelReturnTarget(invoker, [')
    && closeFn.includes('if (target) target.focus();')
    && !closeFn.includes('invoker.focus()'));
  check(scope, 'the invoking control is captured when the lookup begins (before any await)',
    /function beginRouteLookup\(\)\s*{[\s\S]*?rememberRoutePanelInvoker\(\);[\s\S]*?return routeRequestToken;/.test(src));

  // Focus containment + centralized Escape.
  const trap = sliceFn(src, "routePanelOverlay.addEventListener('keydown'", "document.addEventListener('keydown'");
  check(scope, 'Tab + Shift+Tab containment wraps within the open dialog',
    trap.includes("e.key !== 'Tab'") && trap.includes('e.shiftKey')
    && trap.includes('last.focus()') && trap.includes('first.focus()'));
  check(scope, 'containment ignores hidden / disabled / aria-disabled / tabindex=-1 controls',
    /function routePanelFocusables\(\)[\s\S]*?!el\.hidden[\s\S]*?!el\.disabled[\s\S]*?aria-disabled[\s\S]*?tabindex/.test(src));
  check(scope, 'Escape closes ONCE through the centralized closeRoutePanel lifecycle',
    trap.includes("e.key === 'Escape'") && trap.includes('e.stopPropagation()')
    && trap.includes('closeRoutePanel()')
    && countOccurrences(src, 'function closeRoutePanel(') === 1);

  // Canonical start label over the stable main-gate key.
  check(scope, 'readonly start input visibly shows the canonical label before JS runs',
    src.includes('value="Guard House / Main Gate" readonly'));
  const findFn = sliceFn(src, 'async function findRoute(', 'async function openRouteById(');
  check(scope, 'findRoute falls back to COMPUTED_START_LABEL (stale Main Gate literal gone)',
    findFn.includes('(routeStartInput.value || COMPUTED_START_LABEL)')
    && !/\|\|\s*'Main Gate'/.test(src));
  check(scope, 'main-gate stays the stable pathfinding key behind the canonical public label',
    src.includes("const COMPUTED_START_KEY = 'main-gate';")
    && src.includes("const COMPUTED_START_LABEL = 'Guard House / Main Gate';")
    && src.includes('/api/pathfind?start=${encodeURIComponent(COMPUTED_START_KEY)}'));
}

/* ------------------------------------------------------------------ *
 * 2d) BE.5 focus-return validation: the REAL extracted helpers run   *
 *     against mocked elements + a mocked viewport/getComputedStyle   *
 * ------------------------------------------------------------------ */
const FOCUS_START_MARKER = '// BE5-FOCUS-PURE-START';
const FOCUS_END_MARKER = '// BE5-FOCUS-PURE-END';

function loadFocusApi(src) {
  const si = src.indexOf(FOCUS_START_MARKER);
  const ei = src.indexOf(FOCUS_END_MARKER);
  if (si === -1 || ei === -1 || ei < si) return null;
  const blockStart = src.indexOf('\n', si) + 1;
  if (blockStart <= 0 || blockStart >= ei) return null;
  const block = src.slice(blockStart, ei);
  const context = vm.createContext({});
  const wrapped = `${block}\nthis.__be5focus = { isUsableRoutePanelReturnTarget: isUsableRoutePanelReturnTarget, selectRoutePanelReturnTarget: selectRoutePanelReturnTarget };`;
  try {
    vm.runInContext(wrapped, context, { timeout: 2000 });
  } catch (e) {
    return null;
  }
  const api = context.__be5focus;
  if (!api || typeof api.isUsableRoutePanelReturnTarget !== 'function'
      || typeof api.selectRoutePanelReturnTarget !== 'function') {
    return null;
  }
  return api;
}

function runFocusReturnGate(src) {
  const scope = 'focus-return';
  const api = loadFocusApi(src);
  check(scope, 'BE5-FOCUS-PURE block extracted + exposes both focus-target helpers', !!api);
  if (!api) return;
  const usable = api.isUsableRoutePanelReturnTarget;
  const select = api.selectRoutePanelReturnTarget;

  // Mocked 390px mobile viewport + style resolution; each element carries its
  // own rects/style/ancestor flags so the REAL helper code drives every branch.
  const VIEW_W = 390;
  const VIEW_H = 844;
  function makeWin() {
    return {
      innerWidth: VIEW_W,
      innerHeight: VIEW_H,
      getComputedStyle(el) { return el.__style; },
    };
  }
  function makeEl(opts) {
    opts = opts || {};
    const rect = opts.rect || { left: 20, top: 300, right: 170, bottom: 344, width: 150, height: 44 };
    const el = {
      isConnected: opts.isConnected !== false,
      disabled: !!opts.disabled,
      __style: { display: opts.display || 'block', visibility: opts.visibility || 'visible' },
      __attrs: opts.attrs || {},
      __inClosedMapPanel: !!opts.inClosedMapPanel,
      __hiddenAncestor: !!opts.hiddenAncestor,
      focusCalls: 0,
      ownerDocument: { defaultView: makeWin() },
      focus() { this.focusCalls += 1; },
      getAttribute(name) {
        return Object.prototype.hasOwnProperty.call(this.__attrs, name) ? this.__attrs[name] : null;
      },
      closest(sel) {
        // Mirrors self-or-ancestor matching for the selectors the helper uses.
        if (sel.indexOf('.map-panel') !== -1) return this.__inClosedMapPanel ? {} : null;
        if (sel.indexOf('hidden') !== -1 || sel.indexOf('inert') !== -1) return this.__hiddenAncestor ? {} : null;
        return null;
      },
      getClientRects() { return opts.rectCount === 0 ? [] : [rect]; },
      getBoundingClientRect() { return rect; },
    };
    if (opts.noFocus) el.focus = undefined;
    return el;
  }

  // Priority 1: a connected, visible original invoker wins.
  const invoker = makeEl();
  const findBtn = makeEl();
  check(scope, 'connected visible original invoker wins', select(invoker, [findBtn]) === invoker);

  // Mobile Set-as-Destination: the saved panelSetDestBtn sits inside
  // .map-panel:not(.visible) after the flow hides the info panel. Its
  // rectangle still intersects the viewport mid-transition — reject anyway.
  const setDestBtn = makeEl({ inClosedMapPanel: true });
  check(scope, 'invoker inside .map-panel:not(.visible) is rejected even while its rect still intersects',
    usable(setDestBtn) === false && select(setDestBtn, [findBtn]) === findBtn);

  // Entirely outside the current viewport -> rejected.
  check(scope, 'completely off-screen invoker is rejected',
    usable(makeEl({ rect: { left: VIEW_W + 10, top: 300, right: VIEW_W + 160, bottom: 344, width: 150, height: 44 } })) === false
    && usable(makeEl({ rect: { left: -160, top: 300, right: 0, bottom: 344, width: 160, height: 44 } })) === false);

  // A result button removed by an innerHTML re-render is disconnected ->
  // rejected, and the SAME fallback chain takes over (routeFindBtn next).
  const staleResult = makeEl({ isConnected: false });
  check(scope, 'disconnected re-rendered result invoker falls back to routeFindBtn',
    usable(staleResult) === false && select(staleResult, [findBtn]) === findBtn);

  // Exact fallback order behind the invoker.
  const resultCard = makeEl();
  const searchBox = makeEl();
  const listToggle = makeEl();
  const deadInvoker = makeEl({ isConnected: false });
  const deadFind = makeEl({ disabled: true });
  const deadCard = makeEl({ rectCount: 0 });
  const deadSearch = makeEl({ display: 'none' });
  check(scope, 'fallback order: routeFindBtn before the selected result card',
    select(deadInvoker, [findBtn, resultCard, searchBox, listToggle]) === findBtn);
  check(scope, 'fallback order: selected result card before searchInput',
    select(deadInvoker, [deadFind, resultCard, searchBox, listToggle]) === resultCard);
  check(scope, 'fallback order: searchInput before mobileListToggle',
    select(deadInvoker, [deadFind, deadCard, searchBox, listToggle]) === searchBox);
  check(scope, 'fallback order: mobileListToggle is the last resort',
    select(deadInvoker, [deadFind, deadCard, deadSearch, listToggle]) === listToggle);

  // Rejection matrix.
  check(scope, 'rejects disabled', usable(makeEl({ disabled: true })) === false);
  check(scope, 'rejects aria-disabled="true"', usable(makeEl({ attrs: { 'aria-disabled': 'true' } })) === false);
  check(scope, 'rejects tabindex="-1"', usable(makeEl({ attrs: { tabindex: '-1' } })) === false);
  check(scope, 'rejects hidden / aria-hidden / inert on self or ancestor',
    usable(makeEl({ hiddenAncestor: true })) === false);
  check(scope, 'rejects display:none', usable(makeEl({ display: 'none' })) === false);
  check(scope, 'rejects visibility:hidden and visibility:collapse',
    usable(makeEl({ visibility: 'hidden' })) === false
    && usable(makeEl({ visibility: 'collapse' })) === false);
  check(scope, 'rejects zero-sized rectangles',
    usable(makeEl({ rect: { left: 10, top: 10, right: 10, bottom: 10, width: 0, height: 0 } })) === false);
  check(scope, 'rejects an element with no client rectangles', usable(makeEl({ rectCount: 0 })) === false);
  check(scope, 'rejects null / disconnected / missing focus()',
    usable(null) === false && usable(undefined) === false && usable(makeEl({ noFocus: true })) === false);

  // No usable candidate: null result, never a throw.
  let out = 'unset';
  let threw = false;
  try {
    out = select(deadInvoker, [deadFind, deadCard, deadSearch, null]);
  } catch (e) {
    threw = true;
  }
  check(scope, 'no usable candidate returns null without throwing', threw === false && out === null);

  // Selection itself never focused anything; rejected mocks were untouched.
  check(scope, 'rejected candidates are never focus targets',
    setDestBtn.focusCalls === 0 && staleResult.focusCalls === 0 && deadInvoker.focusCalls === 0
    && deadFind.focusCalls === 0 && deadCard.focusCalls === 0 && deadSearch.focusCalls === 0);

  // Static wiring: closeRoutePanel selects through the shared helper in the
  // exact required order and never focuses the raw invoker directly.
  const closeFn = sliceFn(src, 'function closeRoutePanel(', 'const COMPUTED_START_KEY');
  check(scope, 'closeRoutePanel selects via the shared helper in the exact fallback order',
    /selectRoutePanelReturnTarget\(invoker, \[\s*routeFindBtn,[\s\S]*?\.map-bldg-item\[data-id[\s\S]*?searchInput,\s*mobileListToggle\s*\]\s*\)/.test(closeFn));
  check(scope, 'closeRoutePanel clears the invoker exactly once and focuses only the validated target',
    countOccurrences(closeFn, 'routePanelInvoker = null') === 1
    && closeFn.includes('if (target) target.focus();')
    && !closeFn.includes('invoker.focus()'));
}

/* ------------------------------------------------------------------ *
 * 2e) BE.5 delegated result activation: the REAL extracted helpers   *
 *     run against a mocked mobile DOM (390x844)                      *
 * ------------------------------------------------------------------ */
const ACTIVATION_START_MARKER = '// BE5-RESULT-ACTIVATION-PURE-START';
const ACTIVATION_END_MARKER = '// BE5-RESULT-ACTIVATION-PURE-END';

function loadActivationApi(src) {
  const si = src.indexOf(ACTIVATION_START_MARKER);
  const ei = src.indexOf(ACTIVATION_END_MARKER);
  if (si === -1 || ei === -1 || ei < si) return null;
  const blockStart = src.indexOf('\n', si) + 1;
  if (blockStart <= 0 || blockStart >= ei) return null;
  const block = src.slice(blockStart, ei);
  const context = vm.createContext({});
  const wrapped = `${block}\nthis.__be5activate = { resolveResultActivationTarget: resolveResultActivationTarget, activateResultButton: activateResultButton, parseResultPositiveId: parseResultPositiveId };`;
  try {
    vm.runInContext(wrapped, context, { timeout: 2000 });
  } catch (e) {
    return null;
  }
  const api = context.__be5activate;
  if (!api || typeof api.resolveResultActivationTarget !== 'function'
      || typeof api.activateResultButton !== 'function'
      || typeof api.parseResultPositiveId !== 'function') {
    return null;
  }
  return api;
}

function runResultActivationGate(src) {
  const scope = 'result-activation';
  const api = loadActivationApi(src);
  check(scope, 'BE5-RESULT-ACTIVATION-PURE block extracted + exposes both activation helpers', !!api);
  if (!api) return;

  // Mocked node graph with REAL closest/contains semantics (parent walking),
  // so the extracted helpers are exercised the same way a browser would.
  function makeResultNode(className, parent, dataset) {
    return {
      className: className || '',
      parentNode: parent || null,
      dataset,
      closest(sel) {
        const cls = sel.charAt(0) === '.' ? sel.slice(1) : sel;
        let cur = this;
        while (cur) {
          if (typeof cur.className === 'string'
              && cur.className.split(/\s+/).indexOf(cls) !== -1) return cur;
          cur = cur.parentNode;
        }
        return null;
      },
      contains(other) {
        let cur = other;
        while (cur) {
          if (cur === this) return true;
          cur = cur.parentNode;
        }
        return false;
      },
    };
  }

  // The exact failing case: the single "Main Academic Building" search result
  // on a true-mobile 390x844 viewport. buildContents simulates one complete
  // innerHTML render into the SAME stable container.
  const MOBILE_VIEWPORT = { innerWidth: 390, innerHeight: 844 };
  const MAIN_ACADEMIC = { id: '7', name: 'Main Academic Building' };
  function buildContents(container) {
    const btn = makeResultNode('map-bldg-item', container,
      { id: MAIN_ACADEMIC.id, name: MAIN_ACADEMIC.name });
    const img = makeResultNode('map-bldg-item__img', btn);
    const info = makeResultNode('map-bldg-item__info', btn);
    const nameEl = makeResultNode('map-bldg-item__name', info);
    const catEl = makeResultNode('map-bldg-item__cat', info);
    const badges = makeResultNode('map-bldg-item__badges', info);
    const buildingBadge = makeResultNode('map-bldg-item__badge map-bldg-item__badge--building', badges);
    const matchBadge = makeResultNode('map-bldg-item__badge map-bldg-item__badge--match', badges);
    return { btn, img, nameEl, catEl, buildingBadge, matchBadge };
  }

  function makeSpies() {
    const calls = { select: [], route: [] };
    return {
      calls,
      actions: {
        openRouteById(id) { calls.route.push(id); },
        selectBuildingFromResult(id, name) { calls.select.push([id, name]); },
      },
    };
  }

  // Mirrors the real delegated listener body: resolve, then activate.
  function dispatch(target, container, spies) {
    const btn = api.resolveResultActivationTarget(target, container);
    if (!btn) return false;
    return api.activateResultButton(btn, spies.actions);
  }

  const container = makeResultNode('map-sidebar__list', null);
  container.__viewport = MOBILE_VIEWPORT; // fixture context: true-mobile 390x844
  let tree = buildContents(container);

  // Activation from the button itself: exactly one fail-closed select call
  // carrying the exact backend-local id + name pair.
  let spies = makeSpies();
  check(scope, 'Main Academic (390x844): button target selects exactly once with the exact identity',
    dispatch(tree.btn, container, spies) === true
    && spies.calls.select.length === 1
    && spies.calls.select[0][0] === 7
    && spies.calls.select[0][1] === 'Main Academic Building'
    && spies.calls.route.length === 0);

  // Activation from every inner target the finger can land on.
  const innerTargets = [
    ['image', tree.img],
    ['name text', tree.nameEl],
    ['category text', tree.catEl],
    ['building badge', tree.buildingBadge],
    ['match badge', tree.matchBadge],
  ];
  for (const [label, target] of innerTargets) {
    spies = makeSpies();
    check(scope, `Main Academic (390x844): ${label} target selects exactly once with the exact identity`,
      dispatch(target, container, spies) === true
      && spies.calls.select.length === 1
      && spies.calls.select[0][0] === 7
      && spies.calls.select[0][1] === 'Main Academic Building'
      && spies.calls.route.length === 0);
  }

  // Two complete rerenders into the same container: the old subtree detaches,
  // fresh nodes render, and delegation keeps working with no re-wiring.
  const staleBtn = tree.btn;
  staleBtn.parentNode = null; // innerHTML replacement detaches the old row
  tree = buildContents(container); // rerender 1
  spies = makeSpies();
  const rerender1Ok = dispatch(tree.nameEl, container, spies) === true && spies.calls.select.length === 1;
  tree = buildContents(container); // rerender 2
  spies = makeSpies();
  const rerender2Ok = dispatch(tree.matchBadge, container, spies) === true && spies.calls.select.length === 1;
  check(scope, 'delegation still activates after two complete search-result rerenders', rerender1Ok && rerender2Ok);
  spies = makeSpies();
  check(scope, 'a stale row detached by the rerender fails closed (no call)',
    dispatch(staleBtn, container, spies) === false
    && spies.calls.select.length === 0 && spies.calls.route.length === 0);

  // Fail-closed identity handling.
  spies = makeSpies();
  const malformedId = makeResultNode('map-bldg-item', container, { id: 'abc', name: 'X' });
  const missingId = makeResultNode('map-bldg-item', container, { name: 'X' });
  check(scope, 'malformed or missing building ids do nothing',
    dispatch(malformedId, container, spies) === false
    && dispatch(missingId, container, spies) === false
    && spies.calls.select.length === 0 && spies.calls.route.length === 0);
  spies = makeSpies();
  const otherContainer = makeResultNode('map-sidebar__list', null);
  const outsideBtn = makeResultNode('map-bldg-item', otherContainer, { id: '7', name: 'Main Academic Building' });
  check(scope, 'a button outside the building-list container fails closed',
    dispatch(outsideBtn, container, spies) === false && spies.calls.select.length === 0);
  spies = makeSpies();
  check(scope, 'a click on the container itself (no result ancestor) does nothing',
    dispatch(container, container, spies) === false
    && spies.calls.select.length === 0 && spies.calls.route.length === 0);

  // Route rows: exactly one openRouteById, never a building select.
  spies = makeSpies();
  const routeBtn = makeResultNode('map-bldg-item map-bldg-item--route', container, { routeId: '3' });
  const badRouteBtn = makeResultNode('map-bldg-item map-bldg-item--route', container, { routeId: 'x' });
  check(scope, 'route-result activation calls openRouteById exactly once (and never select)',
    dispatch(routeBtn, container, spies) === true
    && spies.calls.route.length === 1 && spies.calls.route[0] === 3
    && spies.calls.select.length === 0);
  spies = makeSpies();
  check(scope, 'a malformed route id does nothing',
    dispatch(badRouteBtn, container, spies) === false
    && spies.calls.route.length === 0 && spies.calls.select.length === 0);

  // Strict non-coercive id grammar (P1: parseInt coerced "7abc" -> 7, "3x" -> 3).
  const parseId = api.parseResultPositiveId;
  check(scope, 'grammar: canonical positive ids parse (numbers + exact decimal strings)',
    parseId(1) === 1 && parseId(7) === 7
    && parseId(Number.MAX_SAFE_INTEGER) === Number.MAX_SAFE_INTEGER
    && parseId('1') === 1 && parseId('7') === 7
    && parseId(String(Number.MAX_SAFE_INTEGER)) === Number.MAX_SAFE_INTEGER);
  check(scope, 'grammar: numeric suffixes are rejected ("7abc", "3x")',
    parseId('7abc') === null && parseId('3x') === null);
  check(scope, 'grammar: untrimmed whitespace and empty strings are rejected',
    parseId(' 7') === null && parseId('7 ') === null && parseId('\t7') === null
    && parseId('') === null && parseId(' ') === null);
  check(scope, 'grammar: signs and leading zeroes are rejected ("+7", "-7", "01")',
    parseId('+7') === null && parseId('-7') === null && parseId('01') === null);
  check(scope, 'grammar: decimal / exponent / hex forms are rejected ("7.0", "7e0", "0x7")',
    parseId('7.0') === null && parseId('7e0') === null && parseId('0x7') === null);
  check(scope, 'grammar: zero, negatives, fractions, non-finite and unsafe magnitudes are rejected',
    parseId(0) === null && parseId(-7) === null && parseId(7.5) === null
    && parseId(NaN) === null && parseId(Infinity) === null && parseId(-Infinity) === null
    && parseId(Number.MAX_SAFE_INTEGER + 1) === null
    && parseId('9007199254740993') === null);
  check(scope, 'grammar: booleans, arrays, objects, boxed numbers, null and undefined are rejected',
    parseId(true) === null && parseId(false) === null
    && parseId([]) === null && parseId([1]) === null
    && parseId({}) === null && parseId(Object(7)) === null
    && parseId(null) === null && parseId(undefined) === null);

  // Action level: the exact reported defects fail closed with zero calls.
  spies = makeSpies();
  const suffixIdBtn = makeResultNode('map-bldg-item', container, { id: '7abc', name: 'Main Academic Building' });
  check(scope, 'data-id="7abc" fails closed (building 7 is NOT activated)',
    dispatch(suffixIdBtn, container, spies) === false
    && spies.calls.select.length === 0 && spies.calls.route.length === 0);
  spies = makeSpies();
  const suffixRouteBtn = makeResultNode('map-bldg-item map-bldg-item--route', container,
    { routeId: '3x', id: '7', name: 'Main Academic Building' });
  check(scope, 'data-route-id="3x" fails closed and NEVER falls through to data-id',
    dispatch(suffixRouteBtn, container, spies) === false
    && spies.calls.route.length === 0 && spies.calls.select.length === 0);
  spies = makeSpies();
  const validIdBtn = makeResultNode('map-bldg-item', container, { id: '7', name: 'Main Academic Building' });
  const validRouteBtn = makeResultNode('map-bldg-item map-bldg-item--route', container, { routeId: '3' });
  const validSelectOk = dispatch(validIdBtn, container, spies) === true
    && spies.calls.select.length === 1 && spies.calls.select[0][0] === 7
    && spies.calls.route.length === 0;
  spies = makeSpies();
  const validRouteOk = dispatch(validRouteBtn, container, spies) === true
    && spies.calls.route.length === 1 && spies.calls.route[0] === 3
    && spies.calls.select.length === 0;
  check(scope, 'strictly valid "7" and "3" still invoke exactly one correct action each',
    validSelectOk && validRouteOk);
  // Code, not prose: the block's comment may NAME the old coercive parser it
  // replaced, but no executable parseInt call may remain.
  const activationBlock = stripComments(
    src.slice(src.indexOf(ACTIVATION_START_MARKER), src.indexOf(ACTIVATION_END_MARKER)));
  check(scope, 'pure activation block uses the strict grammar (no parseInt remains)',
    activationBlock.length > 0 && !activationBlock.includes('parseInt')
    && activationBlock.includes('parseResultPositiveId('));

  // Static wiring + valid markup invariants.
  const bFn = sliceFn(src, 'function buildingItemHtml(', 'function routeItemHtml(');
  const rFn = sliceFn(src, 'function routeItemHtml(', 'function categoryOfResult(');
  const badgesFn = sliceFn(src, 'function badgesHtml(', 'function isRouteAvailable(');
  check(scope, 'generated result-button markup nests no div (badges wrapper included)',
    bFn.length > 0 && rFn.length > 0 && badgesFn.length > 0
    && !bFn.includes('<div') && !rFn.includes('<div') && !badgesFn.includes('<div'));
  check(scope, 'ONE delegated click handler on bldgList; per-render wiring is gone',
    countOccurrences(src, 'bldgList.addEventListener(') === 1
    && countOccurrences(src, "bldgList.addEventListener('click'") === 1
    && !src.includes('wireSidebarClicks'));
  check(scope, 'render paths no longer attach per-row listeners',
    !sliceFn(src, 'function renderLocalList(', 'function renderSearchResults(').includes('addEventListener')
    && !sliceFn(src, 'function renderSearchResults(', 'function canonicalName(').includes('addEventListener'));
  check(scope, 'the real listener routes through the extracted resolver + activator',
    /bldgList\.addEventListener\('click', \(e\) => \{\s*const btn = resolveResultActivationTarget\(e\.target, bldgList\);\s*if \(!btn\) return;\s*activateResultButton\(btn, \{\s*openRouteById: openRouteById,\s*selectBuildingFromResult: selectBuildingFromResult\s*\}\);/.test(src));
  check(scope, 'selectBuildingFromResult keeps the authoritative-index + canonical-name fail-closed validation',
    src.includes('buildingIndex.get(id)')
    && src.includes('canonicalName(authoritative.name) !== canonicalName(expectedName)'));
  check(scope, 'no synthetic keyboard emulation was added (native buttons stay the contract)',
    !src.includes("bldgList.addEventListener('keydown'")
    && !src.includes("bldgList.addEventListener('keyup'")
    && !src.includes("bldgList.addEventListener('keypress'"));
}

/* ------------------------------------------------------------------ *
 * 3) Live regression: /api/pathfind carries a drawable geometry      *
 * ------------------------------------------------------------------ */
function cookieJar() {
  const cookies = new Map();
  return {
    apply(res) {
      let list = [];
      if (typeof res.headers.getSetCookie === 'function') list = res.headers.getSetCookie() || [];
      else { const sc = res.headers.get('set-cookie'); if (sc) list = [sc]; }
      for (const sc of list) {
        const pair = String(sc).split(';')[0];
        const eq = pair.indexOf('=');
        if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    },
    header() { return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; '); },
  };
}

function metaCsrf(html) {
  const m = /<meta name="csrf-token" content="([^"]*)"/.exec(html || '');
  return m ? m[1] : '';
}

const LEAK_PATTERNS = [
  ['JWT-like token', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['Supabase host', /[a-z0-9-]+\.supabase\.(co|com|in)/i],
  ['stack frame', /\bat [\w.$<>[\] ]+ \((?:file:\/\/|\/|[A-Za-z]:\\)[^)]*:\d+:\d+\)/],
  ['SQL/driver/PostgREST text', /sqlMessage|ER_[A-Z_]{3,}|SQLSTATE|PostgREST|relation "[^"]+" does not exist|syntax error at or near/i],
  ['session cookie value', /campusphere\.sid=/],
  ['Supabase/Cloudinary credential name', /SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|CLOUDINARY_API_KEY|CLOUDINARY_API_SECRET/],
];

async function runMode(mode, base, api) {
  // M12.P1-R1: this leg's server has AUTH_DATA_SOURCE === mode (with-server
  // forces all six switches), so resolve matching regression credentials.
  const creds = getRegressionCredentials(mode);
  const STUDENT_EMAIL = creds.student.email;
  const STUDENT_PASS = creds.student.password;
  const bodies = [];

  async function jfetch(url, options) {
    const res = await fetch(base + url, options);
    const text = await res.text();
    bodies.push(text);
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* HTML or empty */ }
    return { status: res.status, text, json };
  }

  async function login(email, pass) {
    const jar = cookieJar();
    const pre = await fetch(base + '/auth', { headers: { Accept: 'text/html' } });
    jar.apply(pre);
    const csrf0 = metaCsrf(await pre.text());
    const r = await fetch(base + '/login', {
      method: 'POST', redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.header() },
      body: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(pass)}&_csrf=${encodeURIComponent(csrf0)}`,
    });
    jar.apply(r);
    return { ok: r.status === 302, jar };
  }

  const sessions = createProbeSessionTracker({
    base,
    record: (label, pass) => check(mode, label, pass),
  });

  const student = await login(STUDENT_EMAIL, STUDENT_PASS);
  check(mode, 'student login -> 302', student.ok);
  if (student.ok) sessions.register('student', student.jar, '/dashboard');
  if (!student.ok) return bodies;

  /* Everything below runs inside a try whose finally terminates the session,
     so any early return still passes through cleanup. Intentionally NOT
     re-indented (minimal diff). */
  try {
  const H = { Cookie: student.jar.header(), Accept: 'application/json' };

  // Pick a destination from the complete computed building catalog. Supabase
  // may intentionally have no predefined campus_routes rows.
  let r = await jfetch('/api/buildings', { headers: H });
  const buildings = (r.json && (r.json.buildings || r.json.data)) || [];
  const mapped = buildings.find((b) => b.route_available === true &&
    Number.isInteger(Number(b.route_destination_id)) && Number(b.route_destination_id) > 0);
  const destId = mapped ? Number(mapped.id) : null;
  check(mode, 'fixture: destination building id available', Number.isInteger(destId) && destId > 0);
  if (!Number.isInteger(destId) || destId <= 0) return bodies;

  // Live computed route must carry a drawable, road-following geometry.
  r = await jfetch(`/api/pathfind?start=main-gate&destinationBuildingId=${destId}`, { headers: H });
  const route = r.json && r.json.route;
  check(mode, 'pathfind valid -> 200 computed route', r.status === 200 && !!r.json && r.json.success === true && !!route);
  check(mode, 'route still carries ordered nodes + segments (unchanged API)',
    !!route && Array.isArray(route.nodes) && route.nodes.length >= 2
    && Array.isArray(route.segments) && route.segments.length >= 1);
  check(mode, 'route carries a flattened route.geometry array (>= 2 points)',
    !!route && Array.isArray(route.geometry) && route.geometry.length >= 2);

  // Validate the LIVE geometry with the SAME client selector.
  check(mode, 'live route.geometry passes the client drawable-list validator',
    !!route && api.isValidRoutePointList(route.geometry) === true);
  check(mode, 'live route.nodes passes the client drawable-list validator',
    !!route && api.isValidRoutePointList(route.nodes) === true);
  check(mode, 'client selector prefers live route.geometry over route.nodes',
    !!route && api.selectRoutePoints(route) === route.geometry);

  // Endpoint continuity: first geometry point == main-gate start node coords,
  // last == destination node coords (drawn line matches the selected graph path).
  if (route && Array.isArray(route.geometry) && route.geometry.length >= 2
      && Array.isArray(route.nodes) && route.nodes.length >= 2) {
    const g0 = route.geometry[0];
    const gN = route.geometry[route.geometry.length - 1];
    const n0 = route.nodes[0];
    const nN = route.nodes[route.nodes.length - 1];
    const near = (a, b) => Math.abs(Number(a) - Number(b)) <= 1e-6;
    check(mode, 'geometry endpoints match the selected path start/destination nodes',
      near(g0.lat, n0.lat) && near(g0.lng, n0.lng) && near(gN.lat, nN.lat) && near(gN.lng, nN.lng));
  }

  } finally {
    await sessions.terminateAll();
  }

  return bodies;
}

function leakScan(mode, bodies) {
  const blob = bodies.join('\n');
  for (const [label, re] of LEAK_PATTERNS) {
    check(mode, `leak scan: no ${label}`, !re.test(blob));
  }
}

/* ------------------------------------------------------------------ */
(async () => {
  console.log('=== CampuSphere Public Road-Following Route Rendering probe (Pre-Milestone-12 RF.5) ===');

  const src = fs.readFileSync(MAP_EJS_PATH, 'utf8');

  console.log('\nclient rendering logic (extracted from views/map.ejs):');
  const api = runPureLogicGate(src);

  console.log('\nstatic source invariants (views/map.ejs):');
  runStaticSourceGate(src);

  console.log('\npredefined-route stale-line + request-generation invariants (views/map.ejs):');
  runPredefinedRouteGate(src);

  console.log('\nBE.5 keyboard accessibility invariants (views/map.ejs + public/css/styles.css):');
  const css = fs.readFileSync(STYLES_CSS_PATH, 'utf8');
  runKeyboardAccessGate(src, css);

  console.log('\nBE.5 focus-return target validation (extracted helpers + mocked viewport):');
  runFocusReturnGate(src);

  console.log('\nBE.5 delegated result activation (extracted helpers + mocked 390x844 mobile DOM):');
  runResultActivationGate(src);

  if (!api) {
    console.error('\nPUBLIC-ROAD-ROUTE-RENDERING-PROBE FAILED: could not load the RF5-PURE client helpers; skipping live regression.');
    process.exitCode = 1;
    return;
  }

  console.log('\nmysql mode:');
  const mysqlBodies = await withServer({ mode: 'mysql', port: 3384, sessionStore: 'mysql' }, (base) => runMode('mysql', base, api));
  leakScan('mysql', mysqlBodies || []);

  if (process.env.PROBE_SKIP_SUPABASE === '1' && !hasSupabaseConfig()) {
    console.log('\nsupabase mode: SKIP — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (MySQL fallback mode).');
  } else {
    console.log('\nsupabase mode:');
    const sbBodies = await withServer({ mode: 'supabase', port: 3385, sessionStore: 'supabase' }, (base) => runMode('supabase', base, api));
    leakScan('supabase', sbBodies || []);
  }

  console.log('');
  console.log('NOTE read-only probe: no rows were created, so no cleanup is required.');
  if (failures.length === 0) {
    console.log('PUBLIC-ROAD-ROUTE-RENDERING-PROBE OK: all checks passed.');
    process.exitCode = 0;
  } else {
    console.error(`PUBLIC-ROAD-ROUTE-RENDERING-PROBE FAILED: ${failures.length} check(s) did not pass:`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }
})().catch((e) => {
  console.error('[publicRoadRouteRendering-probe] FATAL:', e && e.message ? e.message : 'unknown error');
  process.exitCode = 1;
});
