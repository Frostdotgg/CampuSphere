(function () {
  'use strict';

  var DB_NAME = 'campusphere-offline-guide';
  var DB_VERSION = 1;
  var STORE = 'packages';
  var ACTIVE_KEY = 'active';
  var GUIDE_SCHEMA = 'campusphere.offline-guide/1';
  var MAX_BASEMAP_BYTES = 5 * 1024 * 1024;
  var CONTROL_CHANNEL = 'campusphere-offline-guide-control';
  var LOGOUT_STORAGE_KEY = 'campusphere-offline-guide-logout';
  var THEME_STORAGE_KEY = 'campussphere-theme';
  var MOBILE_MAP_MEDIA = '(max-width: 768px)';
  var PLACEHOLDER_IMAGE = '/img/Camarines-sur-polytechnic-colleges.png';
  var OFFLINE_ORIGIN_MARKER_LABEL = 'Guard House';
  // Initial camera target selected for the offline map (code order: [lng, lat]).
  // This is intentionally independent of the release manifest center.
  var OFFLINE_START_CENTER = Object.freeze([123.374590, 13.405872]);
  var OFFLINE_BUILDING_PIN_SCALE = 0.7;
  var OFFLINE_BUILDING_PIN_OFFSET = [0, -14 * OFFLINE_BUILDING_PIN_SCALE];
  var activeRecord = null;
  var map = null;
  var protocol = null;
  var markers = [];
  var selectedKey = null;
  var destinationKey = null;
  var activeFilter = 'all';
  var lastInvoker = null;
  var routeSummaryInvoker = null;
  var logoutVersion = 0;
  var downloadController = null;
  var mobileSidebarMedia = null;

  function byId(id) { return document.getElementById(id); }

  function openDb() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('Offline storage is unavailable.'));
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function () {
        var database = request.result;
        if (!database.objectStoreNames.contains(STORE)) {
          database.createObjectStore(STORE, { keyPath: 'key' });
        }
      };
      request.onsuccess = function () {
        request.result.onversionchange = function () { request.result.close(); };
        resolve(request.result);
      };
      request.onerror = function () { reject(new Error('Offline storage could not be opened.')); };
      request.onblocked = function () { reject(new Error('Close other CampuSphere tabs and try again.')); };
    });
  }

  function readActiveRecord() {
    return openDb().then(function (database) {
      return new Promise(function (resolve, reject) {
        var tx = database.transaction(STORE, 'readonly');
        var record = null;
        var request = tx.objectStore(STORE).get(ACTIVE_KEY);
        request.onsuccess = function () { record = request.result || null; };
        tx.oncomplete = function () { database.close(); resolve(record); };
        tx.onerror = function () { database.close(); reject(new Error('The downloaded guide could not be read.')); };
        tx.onabort = function () { database.close(); reject(new Error('The downloaded guide could not be read.')); };
      });
    });
  }

  function verifyStoredRecord(record) {
    if (!record) return Promise.resolve(null);
    if (record.key !== ACTIVE_KEY || record.schema !== GUIDE_SCHEMA || !(record.basemap instanceof Blob)) {
      return Promise.reject(new Error('The downloaded guide is incomplete. Download it again while connected.'));
    }
    var guide;
    try {
      guide = validateGuideEnvelope({
        success: true,
        schema: record.schema,
        fingerprint: record.fingerprint,
        guide: record.guide
      });
    } catch (error) {
      return Promise.reject(error);
    }
    return Promise.all([
      sha256Text(JSON.stringify(guide)),
      record.basemap.arrayBuffer()
    ]).then(function (verified) {
      var guideHash = verified[0];
      var mapBytes = verified[1];
      if (guideHash !== record.fingerprint || mapBytes.byteLength !== guide.basemap.bytes) {
        throw new Error('The downloaded guide failed its integrity check. Download it again while connected.');
      }
      return sha256Buffer(mapBytes).then(function (mapHash) {
        if (mapHash !== guide.basemap.sha256) {
          throw new Error('The downloaded campus map failed its integrity check. Download it again while connected.');
        }
        return record;
      });
    });
  }

  function readActive() {
    return readActiveRecord().then(verifyStoredRecord);
  }

  function writeActive(record) {
    return openDb().then(function (database) {
      return new Promise(function (resolve, reject) {
        var tx = database.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(record);
        tx.oncomplete = function () { database.close(); resolve(record); };
        tx.onerror = function () { database.close(); reject(new Error('The offline guide could not be saved.')); };
        tx.onabort = function () { database.close(); reject(new Error('The offline guide download was interrupted.')); };
      });
    });
  }

  function bytesToHex(buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), function (byte) {
      return byte.toString(16).padStart(2, '0');
    }).join('');
  }

  function sha256Buffer(buffer) {
    if (!window.crypto || !window.crypto.subtle) {
      return Promise.reject(new Error('This browser cannot verify offline files.'));
    }
    return window.crypto.subtle.digest('SHA-256', buffer).then(bytesToHex);
  }

  function sha256Text(value) {
    return sha256Buffer(new TextEncoder().encode(value));
  }

  function isHexHash(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value); }

  function validateGuideEnvelope(payload) {
    if (!payload || payload.success !== true || payload.schema !== GUIDE_SCHEMA) {
      throw new Error('The server returned an unsupported offline guide.');
    }
    if (!isHexHash(payload.fingerprint) || !payload.guide || typeof payload.guide !== 'object') {
      throw new Error('The offline guide is incomplete.');
    }
    var guide = payload.guide;
    if (!guide.origin || guide.origin.key !== 'main-gate') throw new Error('The Main Gate origin is missing.');
    if (!Array.isArray(guide.buildings) || !Array.isArray(guide.routes) || !guide.basemap) {
      throw new Error('The offline guide is incomplete.');
    }
    if (!isHexHash(guide.basemap.sha256) || !Number.isInteger(guide.basemap.bytes) ||
        guide.basemap.bytes < 1 || guide.basemap.bytes > MAX_BASEMAP_BYTES) {
      throw new Error('The offline map identity is invalid.');
    }
    if (typeof guide.basemap.asset !== 'string' ||
        !/^\/maps\/cspc-campus-[a-f0-9]{64}\.pmtiles$/.test(guide.basemap.asset) ||
        guide.basemap.asset !== '/maps/cspc-campus-' + guide.basemap.sha256 + '.pmtiles') {
      throw new Error('The offline map location is invalid.');
    }
    return guide;
  }

  function setDownloadState(message, kind) {
    document.querySelectorAll('[data-offline-guide-status]').forEach(function (status) {
      status.textContent = message || '';
      status.dataset.state = kind || 'idle';
    });
  }

  function setDownloadBusy(busy) {
    document.querySelectorAll('[data-offline-guide-download]').forEach(function (button) {
      button.disabled = !!busy;
      var label = button.querySelector('[data-offline-guide-download-label]') || button;
      label.textContent = busy ? 'Preparing…' : (activeRecord ? 'Update Offline Map' : 'Download Offline Map');
    });
  }

  function mapSnapshotLabel(record) {
    var snapshot = record && record.guide && record.guide.basemap && record.guide.basemap.osmSnapshotAt;
    if (!snapshot || typeof snapshot !== 'string') return '';
    var timestamp = Date.parse(snapshot);
    if (!Number.isFinite(timestamp)) return '';
    return ' · OSM snapshot ' + new Date(timestamp).toLocaleDateString();
  }

  function updatePackageSummary(record) {
    var openLink = byId('offlineGuideOpen');
    var summary = byId('offlineGuidePackageSummary');
    if (openLink) openLink.hidden = !record;
    if (!summary) return;
    if (!record) {
      summary.textContent = 'No guide has been downloaded on this device.';
      return;
    }
    var buildings = record.guide && Array.isArray(record.guide.buildings) ? record.guide.buildings.length : 0;
    var routes = record.guide && Array.isArray(record.guide.routes) ? record.guide.routes.length : 0;
    summary.textContent = buildings + ' buildings · ' + routes + ' Main Gate routes · downloaded ' +
      new Date(record.downloadedAt).toLocaleString() + mapSnapshotLabel(record);
  }

  function downloadGuide() {
    if (navigator.onLine === false) {
      setDownloadState('Reconnect before downloading or updating the guide.', 'error');
      return Promise.resolve(false);
    }
    setDownloadBusy(true);
    setDownloadState('Checking for the latest offline map…', 'working');
    var startedAtLogoutVersion = logoutVersion;
    downloadController = 'AbortController' in window ? new AbortController() : null;
    var signal = downloadController ? downloadController.signal : undefined;

    return fetch('/api/offline-guide', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: signal
    }).then(function (response) {
      if (response.status === 401) throw new Error('Sign in before downloading the offline guide.');
      if (!response.ok) throw new Error('The offline guide is temporarily unavailable.');
      return response.json();
    }).then(function (payload) {
      var guide = validateGuideEnvelope(payload);
      return sha256Text(JSON.stringify(guide)).then(function (guideHash) {
        if (guideHash !== payload.fingerprint) throw new Error('The offline guide failed its integrity check.');
        if (activeRecord && activeRecord.fingerprint === payload.fingerprint) {
          return { record: activeRecord, unchanged: true };
        }
        setDownloadState('Downloading the campus map…', 'working');
        var reusableMap = activeRecord && activeRecord.guide && activeRecord.guide.basemap &&
          activeRecord.guide.basemap.sha256 === guide.basemap.sha256 &&
          activeRecord.basemap instanceof Blob ? activeRecord.basemap : null;
        var mapPromise = reusableMap ? Promise.resolve(reusableMap) :
          fetch(guide.basemap.asset, { cache: 'no-store', credentials: 'omit', signal: signal }).then(function (response) {
            if (!response.ok || response.redirected) throw new Error('The campus map could not be downloaded.');
            return response.arrayBuffer();
          }).then(function (mapBytes) {
            if (mapBytes.byteLength !== guide.basemap.bytes) throw new Error('The campus map size did not match.');
            return sha256Buffer(mapBytes).then(function (mapHash) {
              if (mapHash !== guide.basemap.sha256) throw new Error('The campus map failed its integrity check.');
              return new Blob([mapBytes], { type: 'application/vnd.pmtiles' });
            });
          });
        return mapPromise.then(function (mapBlob) {
          var record = {
            key: ACTIVE_KEY,
            schema: payload.schema,
            fingerprint: payload.fingerprint,
            generatedAt: payload.generatedAt,
            downloadedAt: new Date().toISOString(),
            guide: guide,
            basemap: mapBlob
          };
          if (startedAtLogoutVersion !== logoutVersion) {
            throw new Error('The download stopped because this device signed out.');
          }
          // One IndexedDB transaction replaces the active JSON + map Blob.
          // Until it completes, the previously valid record remains active.
          return writeActive(record).then(function (saved) {
            return { record: saved, unchanged: false };
          });
        });
      });
    }).then(function (record) {
      downloadController = null;
      if (startedAtLogoutVersion !== logoutVersion) {
        throw new Error('The download stopped because this device signed out.');
      }
      activeRecord = record.record;
      setDownloadState(record.unchanged ? 'Offline map is already up to date.' : 'Offline map ready on this device.', 'ready');
      updatePackageSummary(record.record);
      setDownloadBusy(false);
      if (!record.unchanged && byId('offlineMap')) renderOfflineGuide(record.record);
      return true;
    }).catch(function (error) {
      downloadController = null;
      if (startedAtLogoutVersion !== logoutVersion) {
        setDownloadState('The downloaded guide was removed after logout.', 'ready');
        setDownloadBusy(false);
        return false;
      }
      setDownloadState(error && error.message ? error.message : 'The offline guide could not be downloaded.', 'error');
      setDownloadBusy(false);
      return false;
    });
  }

  function clearNode(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function appendText(parent, tag, text, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text;
    parent.appendChild(node);
    return node;
  }

  function renderKeyValue(parent, item) {
    var li = document.createElement('li');
    if (typeof item === 'string') {
      li.textContent = item;
    } else if (item && typeof item === 'object') {
      var label = item.label || item.office || '';
      var value = item.value || item.floor || '';
      if (label) appendText(li, 'strong', label);
      if (label && value) li.appendChild(document.createTextNode(' — '));
      if (value) li.appendChild(document.createTextNode(value));
    }
    if (li.textContent.trim()) parent.appendChild(li);
  }

  function renderFloor(parent, floor, index) {
    var li = document.createElement('li');
    if (typeof floor === 'string') {
      li.textContent = floor;
    } else if (floor && typeof floor === 'object') {
      appendText(li, 'strong', floor.label || ('Floor ' + (index + 1)));
      if (Array.isArray(floor.rooms) && floor.rooms.length) {
        var rooms = document.createElement('ul');
        rooms.className = 'map-panel__rooms';
        floor.rooms.forEach(function (room) {
          var roomLi = document.createElement('li');
          if (typeof room === 'string') roomLi.textContent = room;
          else if (room && typeof room === 'object') {
            var heading = [room.room, room.name].filter(Boolean).join(' — ');
            if (heading) appendText(roomLi, 'span', heading);
            if (room.use) appendText(roomLi, 'small', room.use, 'map-panel__list-sub');
          }
          if (roomLi.textContent.trim()) rooms.appendChild(roomLi);
        });
        if (rooms.children.length) li.appendChild(rooms);
      }
    }
    if (li.textContent.trim()) parent.appendChild(li);
  }

  function renderStaticList(sectionId, listId, items, renderer) {
    var section = byId(sectionId);
    var list = byId(listId);
    if (!section || !list) return;
    clearNode(list);
    if (Array.isArray(items)) {
      items.forEach(function (item, index) { renderer(list, item, index); });
    }
    section.hidden = list.children.length === 0;
  }

  function renderTextItem(parent, value) {
    var li = document.createElement('li');
    li.textContent = value;
    if (li.textContent.trim()) parent.appendChild(li);
  }

  function routeFor(key) {
    if (!activeRecord || !activeRecord.guide) return null;
    return activeRecord.guide.routes.find(function (route) { return route.destinationKey === key; }) || null;
  }

  function buildingFor(key) {
    if (!activeRecord || !activeRecord.guide) return null;
    return activeRecord.guide.buildings.find(function (building) { return building.key === key; }) || null;
  }

  function unavailableMessage(reason) {
    if (reason === 'unreachable') return 'No walkable route from the Main Gate is available.';
    if (reason === 'invalid_geometry') return 'This route cannot be drawn safely.';
    if (reason === 'route_data_unavailable') return 'Route data was unavailable when this guide was downloaded.';
    if (reason === 'ambiguous_name') return 'This destination could not be matched safely.';
    return 'This building is not connected to a route node yet.';
  }

  function openDetails(key, invoker) {
    var building = buildingFor(key);
    var panel = byId('offlineDetailsPanel');
    if (!building || !panel) return;
    selectedKey = key;
    lastInvoker = invoker || document.activeElement;

    var details = building.details || {};
    byId('offlineDetailsImage').src = PLACEHOLDER_IMAGE;
    byId('offlineDetailsCategory').textContent = building.category;
    byId('offline-details-title').textContent = building.name;
    byId('offlineDetailsDescription').textContent = building.description;

    var walk = byId('offlineWalkTime');
    var meta = byId('offlineDetailsMeta');
    if (walk && meta) {
      walk.hidden = !details.walkTime;
      meta.hidden = !details.walkTime;
      byId('offlineWalkTimeText').textContent = details.walkTime ? 'Approx. ' + details.walkTime : '';
    }

    renderStaticList('offlineInfoSection', 'offlineInfoList', details.info, renderKeyValue);
    renderStaticList('offlineFloorsSection', 'offlineFloorsList', details.floors, renderFloor);
    renderStaticList('offlineEntrancesSection', 'offlineEntrancesList', details.entrances, renderTextItem);
    renderStaticList('offlineLandmarksSection', 'offlineLandmarksList', details.landmarks, renderTextItem);

    var action = byId('offlineSetDestination');
    var notice = byId('offlineRouteNotice');
    if (action) {
      action.disabled = !building.routeAvailable;
      action.setAttribute('aria-disabled', building.routeAvailable ? 'false' : 'true');
    }
    if (notice) {
      notice.hidden = !!building.routeAvailable;
      notice.textContent = building.routeAvailable ? '' : unavailableMessage(building.routeUnavailableReason);
    }

    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    panel.classList.add('visible');
    var close = byId('offlineDetailsClose');
    if (close) close.focus();
    highlightSelection(key);
    focusMapOnBuilding(building);
    if (isMobileMapLayout()) setMobileSidebar(false, { restoreFocus: false });
  }

  function closeDetails() {
    var panel = byId('offlineDetailsPanel');
    if (!panel || panel.hidden) return;
    panel.classList.remove('visible');
    panel.setAttribute('aria-hidden', 'true');
    panel.hidden = true;
    var invoker = lastInvoker;
    lastInvoker = null;
    var target = selectFocusReturnTarget(invoker, [
      buildingListButtonForKey(selectedKey),
      byId('offlineBuildingSearch'),
      byId('offlineMobileListToggle'),
      byId('offlineRecenterMap')
    ]);
    if (target) target.focus();
  }

  function highlightSelection(key) {
    document.querySelectorAll('[data-building-key]').forEach(function (node) {
      var selected = node.getAttribute('data-building-key') === key;
      node.classList.toggle('is-selected', selected);
      node.classList.toggle('active', selected);
      if (node.classList.contains('offline-building-marker')) node.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }

  function focusMapOnBuilding(building) {
    if (!map || building.lng == null || building.lat == null) return;
    map.easeTo({ center: [building.lng, building.lat], zoom: Math.max(map.getZoom(), 17), duration: 450 });
  }

  function rememberRouteSummaryInvoker() {
    var summary = byId('offlineRouteSummary');
    var active = document.activeElement;
    if (summary && active && summary.contains(active)) return;
    routeSummaryInvoker = active && active !== document.body && active !== document.documentElement ? active : null;
  }

  function isUsableFocusReturnTarget(element) {
    if (!element || typeof element.focus !== 'function') return false;
    if (element.isConnected === false || !document.contains(element) || element.disabled) return false;
    if (typeof element.getAttribute !== 'function' || typeof element.closest !== 'function') return false;
    if (element.getAttribute('aria-disabled') === 'true' || element.getAttribute('tabindex') === '-1') return false;
    if (element.closest('[hidden], [aria-hidden="true"], [inert]')) return false;
    if (!window.getComputedStyle || typeof element.getClientRects !== 'function' ||
        typeof element.getBoundingClientRect !== 'function') return false;
    var style = window.getComputedStyle(element);
    if (!style || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    var rects = element.getClientRects();
    if (!rects || rects.length === 0) return false;
    var rect = element.getBoundingClientRect();
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) return false;
    if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= window.innerWidth || rect.top >= window.innerHeight) return false;
    return true;
  }

  function buildingListButtonForKey(key) {
    var buttons = document.querySelectorAll('#offlineBuildingList .offline-building[data-building-key]');
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].getAttribute('data-building-key') === key) return buttons[i];
    }
    return null;
  }

  function selectFocusReturnTarget(invoker, fallbackCandidates) {
    var candidates = [invoker].concat(fallbackCandidates || []);
    for (var i = 0; i < candidates.length; i++) {
      if (isUsableFocusReturnTarget(candidates[i])) return candidates[i];
    }
    return null;
  }

  function routeSummaryFocusables() {
    var summary = byId('offlineRouteSummary');
    if (!summary) return [];
    return Array.prototype.filter.call(summary.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex]'
    ), function (element) {
      return !element.hidden && !element.closest('[hidden]') && !element.disabled &&
        element.getAttribute('aria-disabled') !== 'true' && element.getAttribute('tabindex') !== '-1' &&
        (element.offsetWidth > 0 || element.offsetHeight > 0 || element === document.activeElement);
    });
  }

  function closeRouteSummary() {
    var summary = byId('offlineRouteSummary');
    if (!summary) return;
    var wasOpen = !summary.hidden && summary.getAttribute('aria-hidden') !== 'true';
    summary.classList.remove('open');
    summary.setAttribute('aria-hidden', 'true');
    summary.hidden = true;
    if (!wasOpen) return;
    var invoker = routeSummaryInvoker;
    routeSummaryInvoker = null;
    var target = selectFocusReturnTarget(invoker, [
      byId('offlineRouteFind'),
      buildingListButtonForKey(destinationKey),
      byId('offlineBuildingSearch'),
      byId('offlineMobileListToggle')
    ]);
    if (target) target.focus();
  }

  function clearRoute() {
    if (map && map.getSource('offline-route')) {
      map.getSource('offline-route').setData({ type: 'FeatureCollection', features: [] });
    }
    closeRouteSummary();
    drawFallbackRoute(null);
  }

  function updateRoutePlanner() {
    var building = destinationKey ? buildingFor(destinationKey) : null;
    var text = byId('offlineRouteDestText');
    var clear = byId('offlineRouteDestClear');
    var find = byId('offlineRouteFind');
    var hint = byId('offlineRouteHint');
    var compact = byId('offlineRouteToggleStatus');
    if (text) {
      text.textContent = building ? building.name : 'Pick a building';
      text.classList.toggle('map-route-planner__dest-text--empty', !building);
    }
    if (clear) clear.hidden = !building;
    if (find) find.disabled = !building;
    if (compact) compact.textContent = building ? building.name : 'Pick a destination';
    if (hint) hint.textContent = building ? 'Ready to draw the saved Main Gate route.' : 'Select a building, then choose Set as Destination.';
  }

  function setDestination(key) {
    var building = buildingFor(key);
    if (!building || !building.routeAvailable) return;
    rememberRouteSummaryInvoker();
    destinationKey = key;
    updateRoutePlanner();
    closeDetails();
    // Match the online map: Set as Destination immediately draws the route.
    // The planner's Find Route button remains available for an explicit redraw.
    showRoute(key);
  }

  function clearDestination() {
    destinationKey = null;
    updateRoutePlanner();
    clearRoute();
  }

  function resetMapRuntime() {
    markers.forEach(function (marker) {
      try { marker.remove(); } catch (error) { /* already detached */ }
    });
    markers = [];

    if (map) {
      try { map.remove(); } catch (error) { /* failed/partial WebGL setup */ }
      map = null;
    }
    if (protocol && window.maplibregl && typeof window.maplibregl.removeProtocol === 'function') {
      try { window.maplibregl.removeProtocol('pmtiles'); } catch (error) { /* not registered */ }
    }
    protocol = null;
    selectedKey = null;
    destinationKey = null;
    lastInvoker = null;
    routeSummaryInvoker = null;

    var container = byId('offlineMap');
    if (container) container.hidden = false;
    var fallback = byId('offlineMapFallback');
    if (fallback) {
      clearNode(fallback);
      fallback.hidden = true;
    }
    var summary = byId('offlineRouteSummary');
    if (summary) {
      summary.classList.remove('open');
      summary.setAttribute('aria-hidden', 'true');
      summary.hidden = true;
    }
    updateRoutePlanner();
  }

  function showRoute(key) {
    var route = routeFor(key);
    var building = buildingFor(key);
    var summary = byId('offlineRouteSummary');
    if (!route || !building || !summary) {
      routeSummaryInvoker = null;
      return;
    }
    byId('offlineRouteTitle').textContent = 'Route to ' + building.name;
    byId('offlineRouteSubtitle').textContent = 'From Guard House / Main Gate';
    byId('offlineRouteTime').textContent = route.estimatedWalkTime + ' \u00b7 ' + Math.round(route.distanceMeters) + ' m';
    var steps = byId('offlineRouteSteps');
    clearNode(steps);
    (Array.isArray(route.steps) ? route.steps : []).forEach(function (step) {
      appendText(steps, 'li', step.instruction);
    });
    summary.hidden = false;
    summary.setAttribute('aria-hidden', 'false');
    summary.classList.add('open');

    var feature = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: route.geometry }
    };
    if (map && map.getSource('offline-route')) {
      map.getSource('offline-route').setData(feature);
      var bounds = route.geometry.reduce(function (box, point) { return box.extend(point); }, new maplibregl.LngLatBounds());
      map.fitBounds(bounds, { padding: { top: 80, right: 80, bottom: 180, left: 80 }, duration: 500, maxZoom: 18 });
    }
    drawFallbackRoute(route);
    closeDetails();
    var close = byId('offlineRouteClose');
    if (close) close.focus();
  }

  function buildBasemapStyle(url) {
    return {
      version: 8,
      sources: {
        campus: {
          type: 'vector',
          url: url,
          attribution: 'Protomaps © OpenStreetMap contributors'
        }
      },
      layers: [
        { id: 'background', type: 'background', paint: { 'background-color': '#edf1e8' } },
        { id: 'earth', type: 'fill', source: 'campus', 'source-layer': 'earth', paint: { 'fill-color': '#f5f2e8' } },
        { id: 'landuse', type: 'fill', source: 'campus', 'source-layer': 'landuse', paint: { 'fill-color': '#dfead9', 'fill-opacity': 0.7 } },
        { id: 'water', type: 'fill', source: 'campus', 'source-layer': 'water', paint: { 'fill-color': '#b8dbe8' } },
        { id: 'roads-casing', type: 'line', source: 'campus', 'source-layer': 'roads', paint: { 'line-color': '#c4c1b8', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 2, 18, 8] } },
        { id: 'roads', type: 'line', source: 'campus', 'source-layer': 'roads', paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1, 18, 5] } },
        { id: 'buildings', type: 'fill', source: 'campus', 'source-layer': 'buildings', paint: { 'fill-color': '#c9c5b8', 'fill-outline-color': '#9d998f', 'fill-opacity': 0.88 } }
      ]
    };
  }

  function addMapMarkers(record) {
    markers.forEach(function (marker) { marker.remove(); });
    markers = [];
    var originEl = document.createElement('button');
    originEl.type = 'button';
    originEl.className = 'offline-map-marker offline-map-marker--origin';
    originEl.textContent = OFFLINE_ORIGIN_MARKER_LABEL;
    originEl.setAttribute('aria-label', OFFLINE_ORIGIN_MARKER_LABEL);
    originEl.disabled = true;
    markers.push(new maplibregl.Marker({ element: originEl, anchor: 'bottom' })
      .setLngLat([record.guide.origin.lng, record.guide.origin.lat]).addTo(map));

    record.guide.buildings.forEach(function (building) {
      if (building.lat == null || building.lng == null) return;
      // Use the same scaled default MapLibre marker as the online map. The
      // existing offline-building-marker wrapper keeps the 44px interaction
      // target while MapLibre scales only the visible pin.
      var marker = new maplibregl.Marker({
        scale: OFFLINE_BUILDING_PIN_SCALE,
        offset: OFFLINE_BUILDING_PIN_OFFSET
      })
        .setLngLat([building.lng, building.lat])
        .addTo(map);
      var markerElement = marker.getElement();
      markerElement.classList.add('offline-building-marker');
      markerElement.setAttribute('role', 'button');
      markerElement.setAttribute('tabindex', '0');
      markerElement.setAttribute('title', building.name);
      markerElement.setAttribute('aria-label', 'Open details for ' + building.name);
      markerElement.setAttribute('aria-pressed', 'false');
      markerElement.setAttribute('data-building-key', building.key);
      markerElement.style.cursor = 'pointer';
      markerElement.addEventListener('click', function (event) {
        event.stopPropagation();
        openDetails(building.key, markerElement);
      });
      markerElement.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openDetails(building.key, markerElement);
      });
      markers.push(marker);
    });
  }

  function initMap(record) {
    var container = byId('offlineMap');
    if (!container) return;
    if (!window.maplibregl || !window.pmtiles || !record.basemap) {
      renderFallbackMap(record);
      return;
    }
    try {
      var archiveName = record.guide.basemap.asset.split('/').pop();
      var file = new File([record.basemap], archiveName, { type: 'application/vnd.pmtiles' });
      var archive = new pmtiles.PMTiles(new pmtiles.FileSource(file));
      protocol = new pmtiles.Protocol();
      protocol.add(archive);
      maplibregl.addProtocol('pmtiles', protocol.tile);
      var nextMap = new maplibregl.Map({
        container: container,
        style: buildBasemapStyle('pmtiles://' + file.name),
        center: OFFLINE_START_CENTER,
        zoom: 16.5,
        bearing: 0,
        pitch: 0,
        minZoom: 12,
        maxZoom: 19,
        maxBounds: [
          [record.guide.basemap.bounds[0], record.guide.basemap.bounds[1]],
          [record.guide.basemap.bounds[2], record.guide.basemap.bounds[3]]
        ],
        attributionControl: true
      });
      map = nextMap;
      nextMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
      nextMap.on('load', function () {
        if (map !== nextMap) return;
        nextMap.addSource('offline-route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        nextMap.addLayer({
          id: 'offline-route-casing',
          type: 'line',
          source: 'offline-route',
          paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.95 }
        });
        nextMap.addLayer({
          id: 'offline-route-line',
          type: 'line',
          source: 'offline-route',
          paint: { 'line-color': '#2563eb', 'line-width': 4, 'line-opacity': 0.85 }
        });
        addMapMarkers(record);
      });
      nextMap.on('error', function () {
        if (map !== nextMap) return;
        var canvas = container.querySelector('.maplibregl-canvas');
        if (!canvas) renderFallbackMap(record);
      });
    } catch (error) {
      resetMapRuntime();
      renderFallbackMap(record);
    }
  }

  function normalizedPoint(point, bounds) {
    return [
      ((point[0] - bounds[0]) / (bounds[2] - bounds[0])) * 1000,
      700 - (((point[1] - bounds[1]) / (bounds[3] - bounds[1])) * 700)
    ];
  }

  function renderFallbackMap(record) {
    var fallback = byId('offlineMapFallback');
    var container = byId('offlineMap');
    if (container) container.hidden = true;
    if (!fallback) return;
    fallback.hidden = false;
    clearNode(fallback);
    var note = appendText(fallback, 'p', 'Map graphics are simplified on this device. The building list and all route directions remain available.');
    note.className = 'offline-map-fallback__note';
    var svgNamespace = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNamespace, 'svg');
    svg.setAttribute('viewBox', '0 0 1000 700');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var background = document.createElementNS(svgNamespace, 'rect');
    background.setAttribute('width', '1000'); background.setAttribute('height', '700');
    background.setAttribute('fill', '#edf1e8');
    svg.appendChild(background);
    [['#ffffff', '38'], ['#b9b6ab', '4']].forEach(function (roadStyle) {
      var road = document.createElementNS(svgNamespace, 'path');
      road.setAttribute('d', 'M70 520 C250 430 430 360 930 220');
      road.setAttribute('fill', 'none'); road.setAttribute('stroke', roadStyle[0]);
      road.setAttribute('stroke-width', roadStyle[1]);
      svg.appendChild(road);
    });
    var routeGroup = document.createElementNS(svgNamespace, 'g');
    routeGroup.setAttribute('id', 'offlineFallbackRoute');
    svg.appendChild(routeGroup);
    fallback.appendChild(svg);
    var markerLayer = document.createElement('div');
    markerLayer.className = 'offline-map-fallback__markers';
    markerLayer.setAttribute('aria-label', 'Downloaded campus buildings');
    markerLayer.setAttribute('role', 'group');
    fallback.appendChild(markerLayer);
    var bounds = record.guide.basemap.bounds;
    var originPoint = normalizedPoint([record.guide.origin.lng, record.guide.origin.lat], bounds);
    var origin = document.createElementNS(svgNamespace, 'circle');
    origin.setAttribute('cx', originPoint[0]); origin.setAttribute('cy', originPoint[1]);
    origin.setAttribute('r', '12'); origin.setAttribute('fill', '#d4a843');
    origin.setAttribute('stroke', '#fff'); origin.setAttribute('stroke-width', '4');
    svg.appendChild(origin);
    record.guide.buildings.forEach(function (building) {
      if (building.lng == null || building.lat == null) return;
      var point = normalizedPoint([building.lng, building.lat], bounds);
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'offline-building-marker offline-fallback-marker';
      button.setAttribute('aria-label', 'Open details for ' + building.name);
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('data-building-key', building.key);
      button.style.left = (point[0] / 10) + '%';
      button.style.top = (point[1] / 7) + '%';
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        openDetails(building.key, button);
      });
      markerLayer.appendChild(button);
    });
  }

  function drawFallbackRoute(route) {
    var group = byId('offlineFallbackRoute');
    if (!group || !activeRecord) return;
    clearNode(group);
    if (!route) return;
    var bounds = activeRecord.guide.basemap.bounds;
    var points = route.geometry.map(function (point) { return normalizedPoint(point, bounds).join(','); }).join(' ');
    var line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.setAttribute('points', points);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', '#2563eb');
    line.setAttribute('stroke-width', '6');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('stroke-linejoin', 'round');
    group.appendChild(line);
  }

  function renderBuildingList(record) {
    var list = byId('offlineBuildingList');
    if (!list) return;
    clearNode(list);
    record.guide.buildings.forEach(function (building) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'map-bldg-item offline-building';
      button.setAttribute('data-building-key', building.key);
      button.setAttribute('data-building-category', building.category || '');
      button.setAttribute('aria-label', 'Open details for ' + building.name);

      var image = document.createElement('img');
      image.src = PLACEHOLDER_IMAGE;
      image.alt = '';
      image.className = 'map-bldg-item__img';
      button.appendChild(image);

      var info = document.createElement('span');
      info.className = 'map-bldg-item__info';
      appendText(info, 'span', building.name, 'map-bldg-item__name');
      appendText(info, 'span', building.category, 'map-bldg-item__cat');
      if (!building.routeAvailable) appendText(info, 'span', 'Route unavailable', 'offline-building__availability');
      button.appendChild(info);
      button.addEventListener('click', function () { openDetails(building.key, button); });
      list.appendChild(button);
    });
    filterBuildings(byId('offlineBuildingSearch') ? byId('offlineBuildingSearch').value : '');
  }

  function filterBuildings(value) {
    var needle = String(value || '').trim().toLowerCase();
    document.querySelectorAll('#offlineBuildingList .offline-building').forEach(function (button) {
      var matchesText = !needle || button.textContent.toLowerCase().indexOf(needle) !== -1;
      var category = String(button.getAttribute('data-building-category') || '').toLowerCase();
      var matchesCategory = activeFilter === 'all' || category === activeFilter.toLowerCase();
      button.hidden = !(matchesText && matchesCategory);
    });
    var clear = byId('offlineSearchClear');
    if (clear) clear.classList.toggle('is-visible', !!needle);
  }

  function setFilter(filter) {
    activeFilter = filter || 'all';
    document.querySelectorAll('[data-offline-filter]').forEach(function (button) {
      var active = button.getAttribute('data-offline-filter') === activeFilter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    filterBuildings(byId('offlineBuildingSearch') ? byId('offlineBuildingSearch').value : '');
  }

  function isMobileMapLayout() {
    if (mobileSidebarMedia) return mobileSidebarMedia.matches;
    if (typeof window.matchMedia === 'function') return window.matchMedia(MOBILE_MAP_MEDIA).matches;
    return window.innerWidth <= 768;
  }

  function focusMobileSidebarSearch() {
    var search = byId('offlineBuildingSearch');
    var close = byId('offlineSidebarClose');
    var target = search && !search.disabled ? search : close;
    if (target && typeof target.focus === 'function') target.focus();
  }

  function setMobileSidebar(open, options) {
    options = options || {};
    var sidebar = byId('offlineMapSidebar');
    var toggle = byId('offlineMobileListToggle');
    if (!sidebar || !toggle) return;
    var mobile = isMobileMapLayout();
    var shouldOpen = mobile && !!open;
    var wasOpen = sidebar.classList.contains('is-open');
    var focusedInside = sidebar.contains(document.activeElement);

    sidebar.classList.toggle('is-open', shouldOpen);
    document.body.classList.toggle('map-sheet-open', shouldOpen);
    toggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');

    if (!mobile) {
      sidebar.removeAttribute('inert');
      sidebar.removeAttribute('aria-hidden');
      return;
    }

    if (shouldOpen) {
      sidebar.removeAttribute('inert');
      sidebar.setAttribute('aria-hidden', 'false');
      if (options.focus !== false) focusMobileSidebarSearch();
      return;
    }

    var focusTarget = selectFocusReturnTarget(toggle, [
      byId('offlineRecenterMap'),
      byId('offlineThemeToggle'),
      byId('offlineNavToggle')
    ]);
    if (options.restoreFocus !== false && (wasOpen || focusedInside) && focusTarget) {
      focusTarget.focus();
    } else if (focusedInside && document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    sidebar.setAttribute('inert', '');
    sidebar.setAttribute('aria-hidden', 'true');
  }

  function syncMobileSidebarViewport(event) {
    var mobile = event && typeof event.matches === 'boolean' ? event.matches : isMobileMapLayout();
    if (mobile) setMobileSidebar(false, { restoreFocus: true });
    else setMobileSidebar(false, { restoreFocus: false });
  }

  function readThemePreference() {
    try {
      var stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      return stored === 'dark' || stored === 'light' ? stored : null;
    } catch (error) {
      return null;
    }
  }

  function persistThemePreference(value) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch (error) {
      /* Theme switching remains available when storage is blocked. */
    }
  }

  function applyThemePreference(value, persist) {
    var root = document.documentElement;
    if (value === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    if (persist) persistThemePreference(value === 'dark' ? 'dark' : 'light');
    updateThemeToggleState();
  }

  function updateThemeToggleState() {
    var theme = byId('offlineThemeToggle');
    if (!theme) return;
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    theme.setAttribute('aria-pressed', dark ? 'true' : 'false');
    theme.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  }

  function recenterMap() {
    if (!activeRecord || !activeRecord.guide || !map) return;
    map.easeTo({
      center: [activeRecord.guide.origin.lng, activeRecord.guide.origin.lat],
      zoom: 16.5,
      duration: 450
    });
  }

  function renderOfflineGuide(record) {
    closeDetails();
    resetMapRuntime();
    activeRecord = record;
    var empty = byId('offlineGuideEmpty');
    var workspace = byId('offlineGuideWorkspace');
    if (empty) empty.hidden = true;
    if (workspace) workspace.hidden = false;
    updatePackageSummary(record);
    renderBuildingList(record);
    initMap(record);
  }

  function handleExplicitLogout() {
    logoutVersion += 1;
    if (downloadController) {
      try { downloadController.abort(); } catch (error) { /* already complete */ }
      downloadController = null;
    }
    closeDetails();
    resetMapRuntime();
    activeRecord = null;
    var workspace = byId('offlineGuideWorkspace');
    var empty = byId('offlineGuideEmpty');
    if (workspace) workspace.hidden = true;
    if (empty) empty.hidden = false;
    updatePackageSummary(null);
    setDownloadBusy(false);
    setDownloadState('The downloaded guide was removed after logout.', 'ready');
  }

  function bindLogoutSignal() {
    if ('BroadcastChannel' in window) {
      try {
        var channel = new BroadcastChannel(CONTROL_CHANNEL);
        channel.addEventListener('message', function (event) {
          if (event && event.data && event.data.type === 'LOGOUT') handleExplicitLogout();
        });
      } catch (error) { /* storage-event fallback remains active */ }
    }
    window.addEventListener('storage', function (event) {
      if (event.key === LOGOUT_STORAGE_KEY && event.newValue) handleExplicitLogout();
    });
  }

  function bindUi() {
    document.querySelectorAll('[data-offline-guide-download]').forEach(function (download) {
      download.addEventListener('click', downloadGuide);
    });
    var close = byId('offlineDetailsClose');
    if (close) close.addEventListener('click', closeDetails);
    var search = byId('offlineBuildingSearch');
    if (search) search.addEventListener('input', function () { filterBuildings(search.value); });
    var searchClear = byId('offlineSearchClear');
    if (searchClear) searchClear.addEventListener('click', function () {
      if (!search) return;
      search.value = '';
      filterBuildings('');
      search.focus();
    });
    document.querySelectorAll('[data-offline-filter]').forEach(function (filter) {
      filter.addEventListener('click', function () { setFilter(filter.getAttribute('data-offline-filter')); });
    });
    var setDest = byId('offlineSetDestination');
    if (setDest) setDest.addEventListener('click', function () { if (selectedKey) setDestination(selectedKey); });
    var clearDest = byId('offlineRouteDestClear');
    if (clearDest) clearDest.addEventListener('click', clearDestination);
    var findRoute = byId('offlineRouteFind');
    if (findRoute) findRoute.addEventListener('click', function () {
      if (!destinationKey) return;
      rememberRouteSummaryInvoker();
      showRoute(destinationKey);
    });
    var routeClose = byId('offlineRouteClose');
    if (routeClose) routeClose.addEventListener('click', closeRouteSummary);
    var routeSummary = byId('offlineRouteSummary');
    if (routeSummary) {
      routeSummary.addEventListener('click', function (event) {
        if (event.target === routeSummary) closeRouteSummary();
      });
      routeSummary.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          event.stopPropagation();
          event.preventDefault();
          closeRouteSummary();
          return;
        }
        if (event.key !== 'Tab') return;
        var focusables = routeSummaryFocusables();
        var first = focusables[0] || routeClose;
        var last = focusables[focusables.length - 1] || routeClose;
        var active = document.activeElement;
        if (event.shiftKey) {
          if (active === first || !routeSummary.contains(active)) {
            event.preventDefault();
            if (last) last.focus();
          }
        } else if (active === last || !routeSummary.contains(active)) {
          event.preventDefault();
          if (first) first.focus();
        }
      });
    }
    var routeClear = byId('offlineRouteClear');
    if (routeClear) routeClear.addEventListener('click', clearRoute);
    var mapClear = byId('offlineClearMapRoute');
    if (mapClear) mapClear.addEventListener('click', clearRoute);
    var recenter = byId('offlineRecenterMap');
    if (recenter) recenter.addEventListener('click', recenterMap);

    var plannerToggle = byId('offlineRoutePlannerToggle');
    var planner = byId('offlineRoutePlanner');
    if (plannerToggle && planner) plannerToggle.addEventListener('click', function () {
      var collapsed = planner.classList.toggle('is-collapsed');
      plannerToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    });

    mobileSidebarMedia = typeof window.matchMedia === 'function' ? window.matchMedia(MOBILE_MAP_MEDIA) : null;
    syncMobileSidebarViewport(mobileSidebarMedia);
    if (mobileSidebarMedia) {
      if (typeof mobileSidebarMedia.addEventListener === 'function') {
        mobileSidebarMedia.addEventListener('change', syncMobileSidebarViewport);
      } else if (typeof mobileSidebarMedia.addListener === 'function') {
        mobileSidebarMedia.addListener(syncMobileSidebarViewport);
      }
    }

    var mobileToggle = byId('offlineMobileListToggle');
    if (mobileToggle) mobileToggle.addEventListener('click', function () { setMobileSidebar(true, { focus: true }); });
    ['offlineSidebarClose', 'offlineSidebarHandle'].forEach(function (id) {
      var control = byId(id);
      if (control) control.addEventListener('click', function () { setMobileSidebar(false, { restoreFocus: true }); });
    });

    var navToggle = byId('offlineNavToggle');
    var navTabs = byId('offlineDashTabs');
    if (navToggle && navTabs) navToggle.addEventListener('click', function () {
      var open = navTabs.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      navToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    });

    var theme = byId('offlineThemeToggle');
    if (theme) {
      var preferredTheme = readThemePreference();
      if (preferredTheme) applyThemePreference(preferredTheme, false);
      else updateThemeToggleState();
      theme.addEventListener('click', function () {
        var dark = document.documentElement.getAttribute('data-theme') === 'dark';
        applyThemePreference(dark ? 'light' : 'dark', true);
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        var routePanel = byId('offlineRouteSummary');
        if (routePanel && !routePanel.hidden) {
          closeRouteSummary();
        }
        else {
          var detailsPanel = byId('offlineDetailsPanel');
          var sidebar = byId('offlineMapSidebar');
          if (detailsPanel && !detailsPanel.hidden) closeDetails();
          else if (sidebar && sidebar.classList.contains('is-open')) {
            setMobileSidebar(false, { restoreFocus: true });
          }
        }
      }
    });
  }

  function init() {
    bindUi();
    bindLogoutSignal();
    setFilter('all');
    updateRoutePlanner();
    setDownloadBusy(false);
    var startedAtLogoutVersion = logoutVersion;
    readActive().then(function (record) {
      if (startedAtLogoutVersion !== logoutVersion) return;
      activeRecord = record;
      updatePackageSummary(record);
      setDownloadBusy(false);
      if (record && byId('offlineMap')) renderOfflineGuide(record);
      else if (byId('offlineGuideEmpty')) byId('offlineGuideEmpty').hidden = false;
    }).catch(function (error) {
      if (startedAtLogoutVersion !== logoutVersion) return;
      setDownloadState(error.message, 'error');
      if (byId('offlineGuideEmpty')) byId('offlineGuideEmpty').hidden = false;
    });
  }

  window.CampuSphereOfflineGuide = {
    download: downloadGuide,
    read: readActive,
    schema: GUIDE_SCHEMA
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
