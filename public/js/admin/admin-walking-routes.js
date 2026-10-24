(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    const $ = (id) => document.getElementById(id);
    if (!$('walking-routes-card')) return;
    const origin = { lat: 13.405710, lng: 123.374181, label: 'Walking Guard House' };
    const state = { id: null, destination: null, points: [], history: [], map: null, markers: [], ready: false, busy: false, token: 0, lastFocus: null };
    const csrf = document.querySelector('meta[name="csrf-token"]');
    const validId = (v) => Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : null;
    const validPoint = (p) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)) &&
      Number(p.lat) >= -90 && Number(p.lat) <= 90 && Number(p.lng) >= -180 && Number(p.lng) <= 180;
    const clone = (points) => points.map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
    function fullPath() {
      return [origin].concat(clone(state.points), [{ lat: Number(state.destination.lat), lng: Number(state.destination.lng) }]);
    }
    function message(text) { $('walking-error').textContent = text || ''; }
    function remember() { state.history.push(clone(state.points)); if (state.history.length > 30) state.history.shift(); }
    function addPoint(lat, lng) {
      if (!state.destination || state.busy) return;
      let p = { lat, lng };
      if (!validPoint(p)) {
        const path = fullPath(), a = path[path.length - 2], b = path[path.length - 1];
        p = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
      }
      if (state.points.length >= 198) return message('A path can have at most 198 intermediate waypoints.');
      remember(); state.points.push(p); render();
    }
    async function request(url, options) {
      const response = await fetch(url, Object.assign({ credentials: 'same-origin', headers: { Accept: 'application/json' } }, options || {}));
      const data = await response.json().catch(() => null);
      return { response, data };
    }
    function button(label, handler) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ui-button ui-button-outline ui-button-size-sm';
      b.textContent = label; b.addEventListener('click', handler); return b;
    }
    function renderList() {
      const list = $('walking-waypoints'); list.replaceChildren();
      state.points.forEach((p, index) => {
        const row = document.createElement('li'); row.style.cssText = 'display:flex;gap:0.3rem;align-items:center;flex-wrap:wrap;';
        const label = document.createElement('span'); label.textContent = 'Waypoint ' + (index + 1); row.appendChild(label);
        ['lat', 'lng'].forEach((field) => {
          const input = document.createElement('input'); input.type = 'number'; input.step = 'any'; input.className = 'ui-input';
          input.style.width = '8.5rem'; input.value = String(p[field]);
          input.setAttribute('aria-label', 'Waypoint ' + (index + 1) + ' ' + (field === 'lat' ? 'latitude' : 'longitude'));
          input.addEventListener('change', () => {
            const changed = { ...state.points[index], [field]: Number(input.value) };
            if (!validPoint(changed)) { input.value = String(state.points[index][field]); return message('Waypoint coordinates are invalid.'); }
            remember(); state.points[index] = changed; render();
          });
          row.appendChild(input);
        });
        row.appendChild(button('↑', () => { if (index < 1) return; remember(); [state.points[index - 1], state.points[index]] = [state.points[index], state.points[index - 1]]; render(); }));
        row.appendChild(button('↓', () => { if (index >= state.points.length - 1) return; remember(); [state.points[index + 1], state.points[index]] = [state.points[index], state.points[index + 1]]; render(); }));
        row.appendChild(button('Remove', () => { remember(); state.points.splice(index, 1); render(); }));
        list.appendChild(row);
      });
      $('walking-metrics').textContent = state.points.length
        ? state.points.length + ' intermediate waypoint' + (state.points.length === 1 ? '' : 's') + '. Distance and time are calculated when saved.'
        : 'Add at least one waypoint on a pedestrian path before saving.';
    }
    function fit() {
      if (!state.map || !state.ready || !window.maplibregl) return;
      const bounds = new maplibregl.LngLatBounds();
      fullPath().forEach((p) => bounds.extend([p.lng, p.lat]));
      if (!bounds.isEmpty()) state.map.fitBounds(bounds, { padding: 40, duration: 0, maxZoom: 18 });
    }
    function renderMap() {
      if (!state.map || !state.ready || !window.maplibregl) return;
      const coords = fullPath().map((p) => [p.lng, p.lat]);
      const source = state.map.getSource('walking-editor-line');
      if (source) source.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } });
      state.markers.forEach((m) => { try { m.remove(); } catch (_) {} }); state.markers = [];
      const endpoint = (p, label) => {
        const marker = new maplibregl.Marker({ draggable: false }).setLngLat([p.lng, p.lat]).addTo(state.map);
        marker.getElement().setAttribute('aria-label', label); marker.getElement().addEventListener('click', (event) => event.stopPropagation()); state.markers.push(marker);
      };
      endpoint(origin, 'Locked start: Walking Guard House');
      state.points.forEach((p, index) => {
        const marker = new maplibregl.Marker({ draggable: true }).setLngLat([p.lng, p.lat]).addTo(state.map);
        marker.getElement().setAttribute('aria-label', 'Draggable waypoint ' + (index + 1));
        marker.getElement().addEventListener('click', (event) => event.stopPropagation());
        marker.on('dragend', () => {
          const ll = marker.getLngLat(); if (!validPoint(ll)) return marker.setLngLat([p.lng, p.lat]);
          remember(); state.points[index] = { lat: ll.lat, lng: ll.lng }; render();
        });
        state.markers.push(marker);
      });
      endpoint(state.destination, 'Locked destination: ' + state.destination.name);
    }
    function render() { if (!state.destination) return; message(''); renderList(); renderMap(); }
    function close() {
      state.token++;
      $('walking-modal').classList.remove('modal--open'); $('walking-modal').setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      state.markers.forEach((m) => { try { m.remove(); } catch (_) {} }); state.markers = [];
      if (state.map) { try { state.map.remove(); } catch (_) {} state.map = null; }
      state.ready = false; state.destination = null; state.id = null;
      if (state.lastFocus && state.lastFocus.isConnected) state.lastFocus.focus();
    }
    function initMap() {
      const api = window.CampuSphereAdminCampusMap;
      const status = $('walking-map-status');
      if (!api || typeof api.createBaseMap !== 'function') { status.textContent = 'Map unavailable; use the waypoint coordinate list.'; return; }
      try {
        const createdMap = api.createBaseMap($('walking-editor-map'), { onUnavailable: () => { status.textContent = 'Map unavailable; use the waypoint coordinate list.'; } });
        state.map = createdMap;
        if (!createdMap) return;
        createdMap.on('load', () => {
          if (state.map !== createdMap) return;
          state.ready = true;
          createdMap.addSource('walking-editor-line', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
          createdMap.addLayer({ id: 'walking-editor-line', type: 'line', source: 'walking-editor-line',
            paint: { 'line-color': '#2563eb', 'line-width': 3, 'line-dasharray': [2, 2] } });
          renderMap(); fit();
        });
        createdMap.on('click', (event) => { if (state.map === createdMap) addPoint(Number(event.lngLat.lat), Number(event.lngLat.lng)); });
        setTimeout(() => { if (state.map === createdMap) { createdMap.resize(); fit(); } }, 80);
      } catch (_) { status.textContent = 'Map unavailable; use the waypoint coordinate list.'; }
    }
    async function open(id) {
      const buildingId = validId(id); if (!buildingId) return;
      state.lastFocus = document.activeElement; const token = ++state.token;
      message(''); $('walking-modal').classList.add('modal--open'); $('walking-modal').setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden'; $('walking-close-top').focus();
      try {
        const { response, data } = await request('/admin/api/walking-routes/' + buildingId);
        if (token !== state.token) return;
        if (!response.ok || !data || !data.success) throw new Error();
        state.id = buildingId; state.destination = data.destination;
        state.points = Array.isArray(data.path_geometry) ? clone(data.path_geometry.slice(1, -1)) : [];
        state.history = [];
        $('walking-modal-title').textContent = 'Walking route to ' + state.destination.name;
        $('walking-endpoints').textContent = 'Walking Guard House → ' + state.destination.name;
        render(); initMap();
      } catch (_) { message('Could not load this destination.'); }
    }
    async function load() {
      const list = $('walking-route-list'); list.replaceChildren(); $('walking-route-count').textContent = 'Loading walking routes…';
      try {
        const { response, data } = await request('/admin/api/walking-routes');
        if (!response.ok || !data || !data.success) throw new Error();
        const ready = data.destinations.filter((b) => b.routeReady);
        const complete = ready.filter((b) => b.walkingReady).length;
        $('walking-route-count').textContent = complete + ' of ' + ready.length + ' route-ready buildings have a walking 2D path. ' + (ready.length - complete) + ' still need drawing.';
        ready.forEach((building) => {
          const row = document.createElement('div'); row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;border:1px solid var(--border);border-radius:0.5rem;padding:0.7rem;';
          const label = document.createElement('span'); label.textContent = building.name + ' · ' + (building.walkingReady ? 'Walking route ready' : building.pinMismatch ? 'Check building map coordinates' : 'Walking route needed'); row.appendChild(label);
          const actions = document.createElement('span'); actions.style.cssText = 'display:flex;gap:0.35rem;';
          actions.appendChild(button('Walking Steps', () => {
            if (window.CampuSphereRouteInstructionsEditor) window.CampuSphereRouteInstructionsEditor.openWalking(building);
          }));
          actions.appendChild(button(building.walkingReady ? 'Edit path' : 'Draw path', () => open(building.id)));
          if (building.walkingReady) actions.appendChild(button('Remove', async () => {
            if (!window.confirm('Remove the walking route to ' + building.name + '?')) return;
            try {
              const result = await request('/admin/api/walking-routes/' + building.id, { method: 'DELETE', headers: { Accept: 'application/json', 'X-CSRF-Token': csrf ? csrf.content : '' } });
              if (!result.response.ok) throw new Error(); load();
            } catch (_) { $('walking-route-count').textContent = 'Could not remove the route. Try again.'; }
          }));
          row.appendChild(actions); list.appendChild(row);
        });
      } catch (_) { $('walking-route-count').textContent = 'Walking routes could not be loaded. Check that migration 0028 is applied, then reload.'; }
    }
    $('walking-add-point').addEventListener('click', () => addPoint());
    $('walking-undo').addEventListener('click', () => { if (!state.history.length) return; state.points = state.history.pop(); render(); });
    $('walking-fit').addEventListener('click', fit);
    $('walking-close').addEventListener('click', close);
    $('walking-close-top').addEventListener('click', close);
    $('walking-modal').addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      const focusable = Array.from($('walking-modal').querySelectorAll('button:not(:disabled), input:not(:disabled)'));
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    $('walking-save').addEventListener('click', async () => {
      if (!state.id || !state.destination || state.busy) return;
      if (state.points.length < 1) return message('Add at least one pedestrian waypoint before saving.');
      if (!state.points.every(validPoint)) return message('A waypoint has invalid coordinates.');
      state.busy = true; $('walking-save').disabled = true;
      const saveToken = state.token, saveId = state.id;
      try {
        const result = await request('/admin/api/walking-routes/' + state.id, {
          method: 'PUT', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrf ? csrf.content : '' },
          body: JSON.stringify({ path_geometry: fullPath().map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) })) })
        });
        if (saveToken !== state.token || saveId !== state.id) return;
        if (!result.response.ok || !result.data || !result.data.success) throw new Error(result.data && result.data.message);
        close(); load();
      } catch (error) { message(error.message || 'Could not save the walking route.'); }
      finally { state.busy = false; $('walking-save').disabled = false; }
    });
    load();
  });
}());
