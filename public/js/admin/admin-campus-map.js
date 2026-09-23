/* Shared self-hosted campus map and point picker for admin editors. */
(function () {
  'use strict';

  const OPENING_CENTER = [123.374590, 13.405872];
  const FALLBACK_ZOOM = 16.5;
  const SELECTED_ZOOM = 18;
  let protocol = null;
  const registeredArchives = new Set();

  function readConfig() {
    try {
      const el = document.getElementById('admin-map-config');
      const parsed = el ? JSON.parse(el.textContent || '{}') : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) { return {}; }
  }

  function basemapConfig() {
    const config = readConfig();
    return config.basemap && typeof config.basemap === 'object' ? config.basemap : null;
  }

  function basemapAsset() {
    const config = basemapConfig();
    const asset = config && typeof config.asset === 'string' ? config.asset : '';
    return /^\/maps\/cspc-campus-[a-f0-9]{64}\.pmtiles$/i.test(asset) ? asset : null;
  }

  function basemapBounds() {
    const config = basemapConfig();
    const bounds = config && Array.isArray(config.bounds) ? config.bounds : null;
    return bounds && bounds.length === 4 && bounds.every((value) => Number.isFinite(Number(value)))
      ? bounds.map((value) => Number(value)) : null;
  }

  function buildBasemapStyle(asset) {
    const config = basemapConfig();
    const attribution = config && typeof config.attribution === 'string' && config.attribution.trim()
      ? config.attribution : 'Protomaps © OpenStreetMap contributors';
    return {
      version: 8,
      sources: {
        campus: {
          type: 'vector',
          url: 'pmtiles://' + asset,
          attribution
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

  function ensureProtocol(maplibre, pmtilesApi, asset) {
    if (!protocol) {
      const nextProtocol = new pmtilesApi.Protocol();
      maplibre.addProtocol('pmtiles', nextProtocol.tile);
      protocol = nextProtocol;
    }
    if (!registeredArchives.has(asset)) {
      const archive = new pmtilesApi.PMTiles(new pmtilesApi.FetchSource(asset));
      protocol.add(archive);
      registeredArchives.add(asset);
    }
  }

  function createBaseMap(container, handlers) {
    const callbacks = handlers || {};
    const maplibre = window.maplibregl;
    const pmtilesApi = window.pmtiles;
    const asset = basemapAsset();
    if (!maplibre || !pmtilesApi || !container || !asset) {
      if (typeof callbacks.onUnavailable === 'function') {
        callbacks.onUnavailable('Campus map is unavailable. Enter the coordinates in the fields below.');
      }
      return null;
    }

    let map = null;
    try {
      ensureProtocol(maplibre, pmtilesApi, asset);
      const bounds = basemapBounds();
      map = new maplibre.Map({
        container,
        style: buildBasemapStyle(asset),
        center: OPENING_CENTER,
        zoom: FALLBACK_ZOOM,
        bearing: 0,
        pitch: 0,
        minZoom: 12,
        maxZoom: 19,
        maxBounds: bounds ? [[bounds[0], bounds[1]], [bounds[2], bounds[3]]] : undefined,
        attributionControl: false
      });
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-left');
      map.addControl(new maplibre.AttributionControl({ compact: true }), 'bottom-right');

      let sourceLoaded = false;
      let failed = false;
      let tileErrors = 0;
      const markUnavailable = (message) => {
        if (failed || sourceLoaded) return;
        failed = true;
        if (typeof callbacks.onUnavailable === 'function') callbacks.onUnavailable(message);
      };

      map.on('sourcedata', (event) => {
        if (!event || event.sourceId !== 'campus' || !event.isSourceLoaded) return;
        sourceLoaded = true;
        failed = false;
        if (typeof callbacks.onSourceLoaded === 'function') callbacks.onSourceLoaded();
      });
      map.on('error', () => {
        if (sourceLoaded) return;
        tileErrors += 1;
        if (tileErrors >= 2) markUnavailable('Campus map tiles could not be loaded. Enter the coordinates in the fields below.');
      });
      setTimeout(() => {
        if (!sourceLoaded && !failed) {
          markUnavailable('Campus map is taking too long to load. Enter the coordinates in the fields below.');
        }
      }, 5000);
      return map;
    } catch (e) {
      if (map && typeof map.remove === 'function') {
        try { map.remove(); } catch (removeError) {}
      }
      if (typeof callbacks.onUnavailable === 'function') {
        callbacks.onUnavailable('Campus map could not be opened. Enter the coordinates in the fields below.');
      }
      return null;
    }
  }

  function coordinatePoint(latValue, lngValue) {
    const latText = String(latValue == null ? '' : latValue).trim();
    const lngText = String(lngValue == null ? '' : lngValue).trim();
    if (!latText || !lngText) return null;
    const lat = Number(latText);
    const lng = Number(lngText);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  }

  function formatCoordinate(value) {
    return Number(value).toFixed(6);
  }

  function createCoordinatePicker(options) {
    const settings = options || {};
    const container = document.getElementById(settings.containerId);
    const latitudeInput = document.getElementById(settings.latitudeInputId);
    const longitudeInput = document.getElementById(settings.longitudeInputId);
    const status = document.getElementById(settings.statusId);
    let map = null;
    let mapAttempted = false;
    let marker = null;
    let active = false;
    let openGeneration = 0;
    let unavailableMessage = '';

    function setStatus(message) {
      if (status) status.textContent = message || '';
    }

    function setFieldValidity(point) {
      if (!latitudeInput || !longitudeInput) return;
      const latText = latitudeInput.value.trim();
      const lngText = longitudeInput.value.trim();
      latitudeInput.setCustomValidity('');
      longitudeInput.setCustomValidity('');
      if (latText && !Number.isFinite(Number(latText))) {
        latitudeInput.setCustomValidity('Enter a valid latitude.');
      } else if (latText && (Number(latText) < -90 || Number(latText) > 90)) {
        latitudeInput.setCustomValidity('Latitude must be between -90 and 90.');
      }
      if (lngText && !Number.isFinite(Number(lngText))) {
        longitudeInput.setCustomValidity('Enter a valid longitude.');
      } else if (lngText && (Number(lngText) < -180 || Number(lngText) > 180)) {
        longitudeInput.setCustomValidity('Longitude must be between -180 and 180.');
      }
      if (!point && latText && !lngText) longitudeInput.setCustomValidity('Enter a longitude to place the pin.');
      if (!point && lngText && !latText) latitudeInput.setCustomValidity('Enter a latitude to place the pin.');
    }

    function ensureMap() {
      if (map || mapAttempted) return map;
      mapAttempted = true;
      map = createBaseMap(container, {
        onSourceLoaded: () => {
          unavailableMessage = '';
          if (active) setStatus('');
        },
        onUnavailable: (message) => {
          unavailableMessage = message;
          if (active) setStatus(message);
        }
      });
      if (map) {
        map.on('click', (event) => {
          if (!active || !event || !event.lngLat) return;
          selectPoint(Number(event.lngLat.lat), Number(event.lngLat.lng), 'Pin placed. The coordinates are ready to save.');
        });
      }
      return map;
    }

    function placeMarker(point) {
      if (!map || !window.maplibregl || !point) return;
      if (!marker) {
        marker = new window.maplibregl.Marker({ color: '#1ca6bb', draggable: true })
          .setLngLat([point.lng, point.lat])
          .addTo(map);
        const element = marker.getElement();
        element.setAttribute('aria-label', 'Location pin. Drag to adjust it, or enter coordinates in the fields.');
        element.setAttribute('title', 'Drag to adjust the location pin');
        marker.on('dragend', () => {
          if (!active || !marker) return;
          const position = marker.getLngLat();
          selectPoint(Number(position.lat), Number(position.lng), 'Pin moved. The coordinates are ready to save.');
        });
      } else {
        marker.setLngLat([point.lng, point.lat]);
      }
    }

    function removeMarker() {
      if (marker) {
        try { marker.remove(); } catch (e) {}
        marker = null;
      }
    }

    function centerOn(point) {
      if (!map) return;
      try {
        map.jumpTo({
          center: point ? [point.lng, point.lat] : OPENING_CENTER,
          zoom: point ? SELECTED_ZOOM : FALLBACK_ZOOM
        });
      } catch (e) {}
    }

    function selectPoint(lat, lng, announcement) {
      const point = coordinatePoint(lat, lng);
      if (!point) {
        setStatus('The map returned an invalid location. Choose another point or enter valid coordinates.');
        return false;
      }
      if (!latitudeInput || !longitudeInput) return false;
      latitudeInput.value = formatCoordinate(point.lat);
      longitudeInput.value = formatCoordinate(point.lng);
      setFieldValidity(point);
      placeMarker(point);
      if (announcement) setStatus(announcement);
      return true;
    }

    function syncFromFields() {
      if (!active || !latitudeInput || !longitudeInput) return;
      const point = coordinatePoint(latitudeInput.value, longitudeInput.value);
      setFieldValidity(point);
      if (!point) {
        const hasAnyValue = latitudeInput.value.trim() || longitudeInput.value.trim();
        if (hasAnyValue) {
          setStatus('Enter a valid latitude and longitude to move the pin.');
        } else {
          removeMarker();
          centerOn(null);
          setStatus('');
        }
        return;
      }
      const activeMap = ensureMap();
      if (activeMap) {
        placeMarker(point);
        centerOn(point);
        setStatus('Pin updated from the coordinate fields.');
      } else if (unavailableMessage) {
        setStatus(unavailableMessage);
      }
    }

    if (latitudeInput) latitudeInput.addEventListener('input', syncFromFields);
    if (longitudeInput) longitudeInput.addEventListener('input', syncFromFields);

    return {
      open(point) {
        active = true;
        const generation = ++openGeneration;
        removeMarker();
        if (point === null) {
          if (latitudeInput) latitudeInput.value = '';
          if (longitudeInput) longitudeInput.value = '';
          setFieldValidity(null);
        } else if (point && coordinatePoint(point.lat, point.lng)) {
          const valid = coordinatePoint(point.lat, point.lng);
          if (latitudeInput) latitudeInput.value = String(point.lat);
          if (longitudeInput) longitudeInput.value = String(point.lng);
          setFieldValidity(valid);
        } else {
          setFieldValidity(coordinatePoint(latitudeInput && latitudeInput.value, longitudeInput && longitudeInput.value));
        }
        const currentPoint = coordinatePoint(latitudeInput && latitudeInput.value, longitudeInput && longitudeInput.value);
        setStatus(unavailableMessage);
        const activeMap = ensureMap();
        if (!activeMap) return;
        setTimeout(() => {
          if (!active || generation !== openGeneration) return;
          try { activeMap.resize(); } catch (e) {}
          if (currentPoint) {
            placeMarker(currentPoint);
            centerOn(currentPoint);
          } else {
            centerOn(null);
          }
          if (unavailableMessage) setStatus(unavailableMessage);
        }, 60);
      },
      close() {
        active = false;
        openGeneration += 1;
        removeMarker();
      }
    };
  }

  window.CampuSphereAdminCampusMap = Object.freeze({
    createBaseMap,
    createCoordinatePicker,
    openingCenter: OPENING_CENTER.slice()
  });
})();
