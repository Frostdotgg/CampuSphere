(function () {
  'use strict';

  var DB_NAME = 'campusphere-offline-guide';
  var DB_VERSION = 1;
  var STORE = 'packages';
  var ACTIVE_KEY = 'active';
  var GUIDE_SCHEMA = 'campusphere.offline-guide/1';
  var CONTROL_CHANNEL = 'campusphere-offline-guide-control';
  var LOGOUT_STORAGE_KEY = 'campusphere-offline-guide-logout';
  var PLACEHOLDER_IMAGE = '/img/Camarines-sur-polytechnic-colleges.png';
  var activeRecord = null;
  var map = null;
  var protocol = null;
  var markers = [];
  var selectedKey = null;
  var lastInvoker = null;
  var logoutVersion = 0;
  var downloadController = null;

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
    if (!isHexHash(guide.basemap.sha256) || !Number.isInteger(guide.basemap.bytes) || guide.basemap.bytes < 1) {
      throw new Error('The offline map identity is invalid.');
    }
    if (typeof guide.basemap.asset !== 'string' ||
        !/^\/maps\/cspc-campus-[a-f0-9]{64}\.pmtiles$/.test(guide.basemap.asset)) {
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
      button.textContent = busy ? 'Preparing offline guide…' : (activeRecord ? 'Update Offline Guide' : 'Download Offline Guide');
    });
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
      new Date(record.downloadedAt).toLocaleString();
  }

  function downloadGuide() {
    if (navigator.onLine === false) {
      setDownloadState('Reconnect before downloading or updating the guide.', 'error');
      return Promise.resolve(false);
    }
    setDownloadBusy(true);
    setDownloadState('Preparing the current buildings and routes…', 'working');
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
        setDownloadState('Downloading the campus map…', 'working');
        return fetch(guide.basemap.asset, { cache: 'no-store', credentials: 'omit', signal: signal }).then(function (response) {
          if (!response.ok || response.redirected) throw new Error('The campus map could not be downloaded.');
          return response.arrayBuffer();
        }).then(function (mapBytes) {
          if (mapBytes.byteLength !== guide.basemap.bytes) throw new Error('The campus map size did not match.');
          return sha256Buffer(mapBytes).then(function (mapHash) {
            if (mapHash !== guide.basemap.sha256) throw new Error('The campus map failed its integrity check.');
            var record = {
              key: ACTIVE_KEY,
              schema: payload.schema,
              fingerprint: payload.fingerprint,
              generatedAt: payload.generatedAt,
              downloadedAt: new Date().toISOString(),
              guide: guide,
              basemap: new Blob([mapBytes], { type: 'application/vnd.pmtiles' })
            };
            if (startedAtLogoutVersion !== logoutVersion) {
              throw new Error('The download stopped because this device signed out.');
            }
            // One IndexedDB transaction replaces the active JSON + map Blob.
            // Until it completes, the previously valid record remains active.
            return writeActive(record);
          });
        });
      });
    }).then(function (record) {
      downloadController = null;
      if (startedAtLogoutVersion !== logoutVersion) {
        throw new Error('The download stopped because this device signed out.');
      }
      activeRecord = record;
      setDownloadState('Offline guide ready on this device.', 'ready');
      updatePackageSummary(record);
      setDownloadBusy(false);
      if (byId('offlineMap')) renderOfflineGuide(record);
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

  function renderDetailsSection(root, title, items, renderer) {
    if (!Array.isArray(items) || !items.length) return;
    var section = document.createElement('section');
    section.className = 'offline-details__section';
    appendText(section, 'h3', title);
    var list = document.createElement('ul');
    items.forEach(function (item, index) { renderer(list, item, index); });
    if (list.children.length) {
      section.appendChild(list);
      root.appendChild(section);
    }
  }

  function renderFloor(parent, floor, index) {
    var li = document.createElement('li');
    if (typeof floor === 'string') {
      li.textContent = floor;
    } else if (floor && typeof floor === 'object') {
      appendText(li, 'strong', floor.label || ('Floor ' + (index + 1)));
      if (Array.isArray(floor.rooms) && floor.rooms.length) {
        var rooms = document.createElement('ul');
        rooms.className = 'offline-details__rooms';
        floor.rooms.forEach(function (room) {
          var roomLi = document.createElement('li');
          if (typeof room === 'string') roomLi.textContent = room;
          else if (room && typeof room === 'object') {
            var heading = [room.room, room.name].filter(Boolean).join(' — ');
            if (heading) appendText(roomLi, 'span', heading);
            if (room.use) appendText(roomLi, 'small', room.use);
          }
          if (roomLi.textContent.trim()) rooms.appendChild(roomLi);
        });
        if (rooms.children.length) li.appendChild(rooms);
      }
    }
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
    var body = byId('offlineDetailsBody');
    if (!building || !panel || !body) return;
    selectedKey = key;
    lastInvoker = invoker || document.activeElement;
    clearNode(body);

    var image = document.createElement('img');
    image.src = PLACEHOLDER_IMAGE;
    image.alt = '';
    image.className = 'offline-details__image';
    body.appendChild(image);
    appendText(body, 'p', building.category, 'offline-details__category');
    var title = appendText(body, 'h2', building.name, 'offline-details__title');
    title.id = 'offline-details-title';
    appendText(body, 'p', building.description, 'offline-details__description');

    var details = building.details || {};
    if (details.walkTime) appendText(body, 'p', 'Approximate walk: ' + details.walkTime, 'offline-details__walk');
    renderDetailsSection(body, 'Offices & services', details.info, renderKeyValue);
    renderDetailsSection(body, 'Floors & rooms', details.floors, renderFloor);
    renderDetailsSection(body, 'Entrances', details.entrances, function (list, value) {
      var li = document.createElement('li'); li.textContent = value; list.appendChild(li);
    });
    renderDetailsSection(body, 'Landmarks', details.landmarks, function (list, value) {
      var li = document.createElement('li'); li.textContent = value; list.appendChild(li);
    });

    var action = document.createElement('button');
    action.type = 'button';
    action.className = 'offline-button offline-button--primary offline-details__route';
    action.textContent = 'Set as Destination';
    action.disabled = !building.routeAvailable;
    action.setAttribute('aria-disabled', building.routeAvailable ? 'false' : 'true');
    action.addEventListener('click', function () { showRoute(key); });
    body.appendChild(action);
    if (!building.routeAvailable) {
      appendText(body, 'p', unavailableMessage(building.routeUnavailableReason), 'offline-details__notice');
    }

    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    panel.classList.add('is-open');
    var close = byId('offlineDetailsClose');
    if (close) close.focus();
    highlightSelection(key);
    focusMapOnBuilding(building);
  }

  function closeDetails() {
    var panel = byId('offlineDetailsPanel');
    if (!panel || panel.hidden) return;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    panel.hidden = true;
    var target = lastInvoker;
    lastInvoker = null;
    if (target && typeof target.focus === 'function' && document.contains(target)) target.focus();
  }

  function highlightSelection(key) {
    document.querySelectorAll('[data-building-key]').forEach(function (node) {
      var selected = node.getAttribute('data-building-key') === key;
      node.classList.toggle('is-selected', selected);
      if (node.classList.contains('offline-map-marker')) node.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }

  function focusMapOnBuilding(building) {
    if (!map || building.lng == null || building.lat == null) return;
    map.easeTo({ center: [building.lng, building.lat], zoom: Math.max(map.getZoom(), 17), duration: 450 });
  }

  function clearRoute() {
    if (map && map.getSource('offline-route')) {
      map.getSource('offline-route').setData({ type: 'FeatureCollection', features: [] });
    }
    var summary = byId('offlineRouteSummary');
    if (summary) {
      clearNode(summary);
      summary.hidden = true;
    }
    drawFallbackRoute(null);
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
    lastInvoker = null;

    var container = byId('offlineMap');
    if (container) container.hidden = false;
    var fallback = byId('offlineMapFallback');
    if (fallback) {
      clearNode(fallback);
      fallback.hidden = true;
    }
    var summary = byId('offlineRouteSummary');
    if (summary) {
      clearNode(summary);
      summary.hidden = true;
    }
  }

  function showRoute(key) {
    var route = routeFor(key);
    var building = buildingFor(key);
    var summary = byId('offlineRouteSummary');
    if (!route || !building || !summary) return;
    clearNode(summary);
    appendText(summary, 'p', 'Guard House / Main Gate to', 'offline-route__eyebrow');
    appendText(summary, 'h2', building.name);
    appendText(summary, 'p', route.estimatedWalkTime + ' · ' + Math.round(route.distanceMeters) + ' m', 'offline-route__meta');
    if (route.steps.length) {
      var list = document.createElement('ol');
      route.steps.forEach(function (step) {
        var li = document.createElement('li');
        li.textContent = step.instruction;
        list.appendChild(li);
      });
      summary.appendChild(list);
    }
    var clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'offline-button offline-button--quiet';
    clear.textContent = 'Clear route';
    clear.addEventListener('click', clearRoute);
    summary.appendChild(clear);
    summary.hidden = false;

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
    originEl.textContent = 'Main Gate';
    originEl.setAttribute('aria-label', record.guide.origin.label);
    originEl.disabled = true;
    markers.push(new maplibregl.Marker({ element: originEl, anchor: 'bottom' })
      .setLngLat([record.guide.origin.lng, record.guide.origin.lat]).addTo(map));

    record.guide.buildings.forEach(function (building) {
      if (building.lat == null || building.lng == null) return;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'offline-map-marker';
      button.textContent = building.name.split(/\s+/).slice(0, 2).map(function (word) { return word.charAt(0); }).join('').slice(0, 3);
      button.title = building.name;
      button.setAttribute('aria-label', 'Open details for ' + building.name);
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('data-building-key', building.key);
      button.addEventListener('click', function () { openDetails(building.key, button); });
      markers.push(new maplibregl.Marker({ element: button, anchor: 'center' })
        .setLngLat([building.lng, building.lat]).addTo(map));
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
        center: record.guide.basemap.center,
        zoom: 16.5,
        minZoom: 14,
        maxZoom: 19,
        maxBounds: [
          [record.guide.basemap.bounds[0], record.guide.basemap.bounds[1]],
          [record.guide.basemap.bounds[2], record.guide.basemap.bounds[3]]
        ],
        attributionControl: true
      });
      map = nextMap;
      nextMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
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
          paint: { 'line-color': '#0f5b43', 'line-width': 5, 'line-opacity': 0.98 }
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
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Simplified CSPC campus map');
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
    var bounds = record.guide.basemap.bounds;
    var originPoint = normalizedPoint([record.guide.origin.lng, record.guide.origin.lat], bounds);
    var origin = document.createElementNS(svgNamespace, 'circle');
    origin.setAttribute('cx', originPoint[0]); origin.setAttribute('cy', originPoint[1]);
    origin.setAttribute('r', '12'); origin.setAttribute('fill', '#0f5b43');
    origin.setAttribute('stroke', '#fff'); origin.setAttribute('stroke-width', '4');
    svg.appendChild(origin);
    record.guide.buildings.forEach(function (building) {
      if (building.lng == null || building.lat == null) return;
      var point = normalizedPoint([building.lng, building.lat], bounds);
      var node = document.createElementNS(svgNamespace, 'g');
      node.setAttribute('role', 'button'); node.setAttribute('tabindex', '0');
      node.setAttribute('aria-label', 'Open details for ' + building.name);
      node.setAttribute('data-building-key', building.key);
      var circle = document.createElementNS(svgNamespace, 'circle');
      circle.setAttribute('cx', point[0]); circle.setAttribute('cy', point[1]); circle.setAttribute('r', '9');
      circle.setAttribute('fill', '#0f2a44'); circle.setAttribute('stroke', '#fff'); circle.setAttribute('stroke-width', '4');
      node.appendChild(circle);
      node.addEventListener('click', function () { openDetails(building.key, node); });
      node.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openDetails(building.key, node);
      });
      svg.appendChild(node);
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
    line.setAttribute('stroke', '#0f5b43');
    line.setAttribute('stroke-width', '8');
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
      button.className = 'offline-building';
      button.setAttribute('data-building-key', building.key);
      appendText(button, 'strong', building.name);
      appendText(button, 'span', building.category);
      if (!building.routeAvailable) appendText(button, 'small', 'Details only · route unavailable');
      button.addEventListener('click', function () { openDetails(building.key, button); });
      list.appendChild(button);
    });
  }

  function filterBuildings(value) {
    var needle = String(value || '').trim().toLowerCase();
    document.querySelectorAll('#offlineBuildingList .offline-building').forEach(function (button) {
      button.hidden = needle && button.textContent.toLowerCase().indexOf(needle) === -1;
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
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeDetails();
    });
  }

  function init() {
    bindUi();
    bindLogoutSignal();
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
