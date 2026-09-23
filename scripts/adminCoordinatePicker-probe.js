'use strict';

/* Database-free contract checks for the Building and route Node map pickers. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const view = read('views/admin/campus-map.ejs');
const styles = read('public/css/admin-styles.css');
const campusMap = read('public/js/admin/admin-campus-map.js');
const buildings = read('public/js/admin/admin-buildings.js');
const graph = read('public/js/admin/admin-map-graph.js');
const routeController = read('controllers/adminRouteController.js');

let failures = 0;
function check(label, condition) {
  if (condition) console.log(`[PASS] ${label}`);
  else { failures += 1; console.error(`[FAIL] ${label}`); }
}

function createPickerFixture(options) {
  const settings = options || {};
  const scheduled = [];
  const mapInstances = [];
  const makeInput = () => ({
    value: '',
    validationMessage: '',
    listeners: {},
    addEventListener(name, listener) { this.listeners[name] = listener; },
    setCustomValidity(message) { this.validationMessage = message; },
    input(value) { this.value = value; if (this.listeners.input) this.listeners.input(); },
  });
  const latitudeInput = makeInput();
  const longitudeInput = makeInput();
  const status = { textContent: '' };
  const config = {
    basemap: {
      asset: '/maps/cspc-campus-' + 'a'.repeat(64) + '.pmtiles',
      bounds: [123.3, 13.3, 123.5, 13.5],
      attribution: 'Protomaps © OpenStreetMap contributors',
    },
  };
  const elements = {
    'admin-map-config': { textContent: JSON.stringify(config) },
    'map-container': {},
    'latitude': latitudeInput,
    'longitude': longitudeInput,
    'map-status': status,
  };
  class FakeMap {
    constructor(options) { this.options = options; this.listeners = {}; this.markers = []; this.jumps = []; this.resizeCount = 0; mapInstances.push(this); }
    addControl() {}
    on(name, listener) { this.listeners[name] = listener; }
    fire(name, event) { if (this.listeners[name]) this.listeners[name](event || {}); }
    jumpTo(point) { this.jumps.push(point); }
    resize() { this.resizeCount += 1; }
    remove() {}
  }
  class FakeMarker {
    constructor(options) { this.options = options; this.listeners = {}; this.coordinate = null; this.element = { setAttribute() {} }; }
    setLngLat(coordinate) { this.coordinate = coordinate.slice(); return this; }
    addTo(map) { this.map = map; map.markers.push(this); return this; }
    getElement() { return this.element; }
    getLngLat() { return { lng: this.coordinate[0], lat: this.coordinate[1] }; }
    on(name, listener) { this.listeners[name] = listener; }
    moveAndEnd(lng, lat) { this.coordinate = [lng, lat]; if (this.listeners.dragend) this.listeners.dragend(); }
    remove() { if (this.map) this.map.markers = this.map.markers.filter((marker) => marker !== this); }
  }
  class FakeProtocol { constructor() { this.tile = () => {}; } add() {} }
  class FakePmtiles {}
  class FakeFetchSource {}
  const window = {
    maplibregl: settings.noMap ? null : {
      Map: FakeMap,
      Marker: FakeMarker,
      NavigationControl: class {},
      AttributionControl: class {},
      addProtocol() {},
    },
    pmtiles: settings.noMap ? null : { Protocol: FakeProtocol, PMTiles: FakePmtiles, FetchSource: FakeFetchSource },
  };
  const document = { getElementById(id) { return elements[id] || null; } };
  vm.runInNewContext(campusMap, {
    window,
    document,
    setTimeout(callback, delay) { scheduled.push({ callback, delay }); return scheduled.length; },
  }, { filename: 'admin-campus-map.js' });
  const picker = window.CampuSphereAdminCampusMap.createCoordinatePicker({
    containerId: 'map-container', latitudeInputId: 'latitude', longitudeInputId: 'longitude', statusId: 'map-status',
  });
  return {
    picker,
    latitudeInput,
    longitudeInput,
    status,
    mapInstances,
    runScheduled(delay) {
      const ready = scheduled.filter((item) => item.delay === delay);
      for (let index = scheduled.length - 1; index >= 0; index -= 1) {
        if (scheduled[index].delay === delay) scheduled.splice(index, 1);
      }
      ready.forEach((item) => item.callback());
    },
  };
}

const sharedScript = view.indexOf('/js/admin/admin-campus-map.js');
const buildingsScript = view.indexOf('/js/admin/admin-buildings.js');
const graphScript = view.indexOf('/js/admin/admin-map-graph.js');
check('shared map module loads before both admin editors',
  sharedScript !== -1 && sharedScript < buildingsScript && sharedScript < graphScript);

check('Building and Node forms expose labeled maps, live status, and manual coordinate fields',
  ['building-location-map', 'node-location-map', 'building-location-map-status', 'node-location-map-status']
    .every((id) => view.includes(`id="${id}"`)) &&
  view.includes('id="building-lat"') && view.includes('id="building-lng"') &&
  view.includes('id="node-lat"') && view.includes('id="node-lng"') &&
  (view.match(/aria-live="polite"/g) || []).length >= 3 &&
  view.includes('Click the map to place the pin.') &&
  view.includes('You can also enter the coordinates below.'));

check('map clicks and draggable pins write latitude/longitude while MapLibre uses longitude/latitude',
  campusMap.includes("map.on('click'") &&
  campusMap.includes("marker.on('dragend'") &&
  campusMap.includes('setLngLat([point.lng, point.lat])') &&
  campusMap.includes('latitudeInput.value = formatCoordinate(point.lat)') &&
  campusMap.includes('longitudeInput.value = formatCoordinate(point.lng)'));

check('create mode clears the pin and edit mode starts from the saved point',
  buildings.includes('buildingLocationPicker.open(null)') &&
  buildings.includes('buildingLocationPicker.open({ lat: b.lat, lng: b.lng })') &&
  graph.includes('nodeLocationPicker.open(mode === \'edit\' && node ? { lat: node.lat, lng: node.lng } : null)') &&
  campusMap.includes('if (point === null)'));

check('manual coordinate entry validates ranges and keeps an invalid value from moving the pin',
  campusMap.includes('setCustomValidity') &&
  campusMap.includes('Latitude must be between -90 and 90.') &&
  campusMap.includes('Longitude must be between -180 and 180.') &&
  campusMap.includes('Enter a valid latitude and longitude to move the pin.') &&
  campusMap.includes('function coordinatePoint(latValue, lngValue)'));

check('map failures leave visible manual-entry guidance and do not submit or save data',
  campusMap.includes('Enter the coordinates in the fields below.') &&
  !campusMap.includes('fetch(') && !campusMap.includes('/admin/api/') &&
  !campusMap.includes('route-edges'));

check('map pickers fit small screens and give map controls and coordinate fields touch-sized targets',
  styles.includes('.admin-coordinate-map') &&
  styles.includes('height: 220px;') &&
  styles.includes('min-height: 44px;') &&
  styles.includes('min-width: 44px;') &&
  styles.includes('#node-modal .modal-box--coordinate'));

check('closing either modal deactivates its picker without changing the saved-data safeguards',
  buildings.includes('buildingLocationPicker.close()') &&
  graph.includes('nodeLocationPicker.close()') &&
  routeController.includes('This node has road geometry attached. Clear or redraw the attached edge geometry before moving this node.'));

const runtime = createPickerFixture();
runtime.picker.open(null);
runtime.runScheduled(60);
const runtimeMap = runtime.mapInstances[0];
runtimeMap.fire('click', { lngLat: { lat: 13.1234567, lng: 123.4567891 } });
const clickMarker = runtimeMap.markers[0];
check('runtime click places a pin and writes correctly ordered six-decimal coordinates',
  runtime.latitudeInput.value === '13.123457' && runtime.longitudeInput.value === '123.456789' &&
  !!clickMarker && clickMarker.coordinate[0] === 123.4567891 && clickMarker.coordinate[1] === 13.1234567);

clickMarker.moveAndEnd(123.25, 12.5);
check('runtime drag updates both coordinate fields',
  runtime.latitudeInput.value === '12.500000' && runtime.longitudeInput.value === '123.250000');

runtime.latitudeInput.input('12.75');
runtime.longitudeInput.input('123.5');
check('runtime manual coordinates move the pin using longitude then latitude',
  runtimeMap.markers[0].coordinate[0] === 123.5 && runtimeMap.markers[0].coordinate[1] === 12.75);

runtime.latitudeInput.input('-91');
check('runtime out-of-range input is marked invalid without moving the last valid pin',
  runtime.latitudeInput.validationMessage === 'Latitude must be between -90 and 90.' &&
  runtimeMap.markers[0].coordinate[0] === 123.5 && runtimeMap.markers[0].coordinate[1] === 12.75);

runtime.latitudeInput.input('');
runtime.longitudeInput.input('');
check('runtime clearing both fields removes the pin and returns the map to its default center',
  runtimeMap.markers.length === 0 && runtime.status.textContent === '' &&
  runtimeMap.jumps[runtimeMap.jumps.length - 1].center[0] === 123.374590 &&
  runtimeMap.jumps[runtimeMap.jumps.length - 1].center[1] === 13.405872);

runtime.picker.open({ lat: 13.405553, lng: 123.374675 });
runtime.runScheduled(60);
check('runtime edit mode loads the saved coordinates and displays the saved pin',
  runtime.latitudeInput.value === '13.405553' && runtime.longitudeInput.value === '123.374675' &&
  runtimeMap.markers.length === 1 && runtimeMap.markers[0].coordinate[0] === 123.374675 &&
  runtimeMap.markers[0].coordinate[1] === 13.405553);

runtime.picker.open({ lat: 13.405553, lng: 123.374675 });
runtime.picker.close();
runtime.picker.open(null);
runtime.runScheduled(60);
check('runtime close and immediate reopen cannot restore a stale edit pin in Add mode',
  runtime.latitudeInput.value === '' && runtime.longitudeInput.value === '' && runtimeMap.markers.length === 0);

const unavailable = createPickerFixture({ noMap: true });
unavailable.picker.open(null);
unavailable.latitudeInput.input('13.405');
unavailable.longitudeInput.input('123.374');
check('runtime map-unavailable fallback keeps manual coordinates usable and explains the failure',
  unavailable.latitudeInput.value === '13.405' && unavailable.longitudeInput.value === '123.374' &&
  unavailable.status.textContent.includes('Campus map is unavailable.'));

if (failures) {
  console.error(`ADMIN-COORDINATE-PICKER-PROBE FAILED: ${failures} check(s) did not pass.`);
  process.exitCode = 1;
} else {
  console.log('ADMIN-COORDINATE-PICKER-PROBE OK: all checks passed.');
}
