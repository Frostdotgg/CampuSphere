(function () {
  'use strict';
  let requestSequence = 0;
  let requestController = null;

  function text(value) { return value == null ? '' : String(value); }
  function clear(element) { if (element) element.replaceChildren(); }
  function safeCloudinaryUrl(value) {
    const candidate = text(value).trim();
    try {
      const parsed = new URL(candidate);
      return parsed.protocol === 'https:' && parsed.hostname === 'res.cloudinary.com' &&
        !parsed.username && !parsed.password && !parsed.port ? candidate : null;
    } catch (error) { return null; }
  }

  function setState(name) {
    const loading = document.getElementById('scheduleLoading');
    const empty = document.getElementById('scheduleEmpty');
    const error = document.getElementById('scheduleError');
    const list = document.getElementById('scheduleList');
    if (loading) loading.hidden = name !== 'loading';
    if (empty) empty.hidden = name !== 'empty';
    if (error) error.hidden = name !== 'error';
    if (list) list.hidden = name !== 'ready';
  }

  function renderDocument(documentRow) {
    const item = document.createElement('li');
    item.className = 'building-schedule-card';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'building-schedule-card__button';
    const thumbnail = document.createElement('img');
    thumbnail.alt = '';
    thumbnail.loading = 'lazy';
    thumbnail.decoding = 'async';
    thumbnail.referrerPolicy = 'no-referrer';
    const thumbnailError = document.createElement('span');
    thumbnailError.className = 'building-schedule-card__thumbnail-error';
    thumbnailError.textContent = 'Preview unavailable';
    thumbnailError.hidden = true;
    thumbnail.addEventListener('error', function () {
      thumbnail.hidden = true;
      thumbnailError.hidden = false;
    });
    const thumbnailUrl = safeCloudinaryUrl(documentRow.image_url);
    if (thumbnailUrl) thumbnail.src = thumbnailUrl;
    else {
      thumbnail.hidden = true;
      thumbnailError.hidden = false;
    }
    const copy = document.createElement('span');
    copy.className = 'building-schedule-card__copy';
    const heading = document.createElement('strong');
    heading.textContent = text(documentRow.location_label) || 'Room schedule';
    const term = document.createElement('span');
    term.textContent = [documentRow.floor_label, documentRow.semester_label, documentRow.school_year].filter(Boolean).join(' · ');
    copy.append(heading, term);
    button.append(thumbnail, thumbnailError, copy);
    button.addEventListener('click', function () {
      const viewer = window.CampuSphereRoomScheduleViewer;
      if (viewer) viewer.openDocument(documentRow, button);
    });
    item.appendChild(button);
    return item;
  }

  function renderLegacy(row) {
    const item = document.createElement('li');
    const when = document.createElement('strong');
    when.textContent = [row.schedule_date, row.start_time && row.end_time ? `${row.start_time}–${row.end_time}` : ''].filter(Boolean).join(' · ');
    const title = document.createElement('span');
    title.textContent = text(row.title);
    item.append(when, title);
    return item;
  }

  async function readJson(url, signal) {
    const response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' }, signal });
    const json = await response.json().catch(() => null);
    return { response, json };
  }

  async function load(buildingId) {
    const sequence = ++requestSequence;
    if (requestController) requestController.abort();
    requestController = new AbortController();
    const list = document.getElementById('scheduleList');
    if (!list) return;
    clear(list);
    setState('loading');
    try {
      const current = await readJson(`/api/buildings/${encodeURIComponent(String(buildingId))}/room-schedule-documents`, requestController.signal);
      if (sequence !== requestSequence) return;
      if (!current.response.ok || !current.json || current.json.success !== true || !Array.isArray(current.json.documents)) {
        throw new Error('current schedules unavailable');
      }
      if (current.json.documents.length) {
        current.json.documents.forEach((documentRow) => list.appendChild(renderDocument(documentRow)));
        setState('ready');
        return;
      }

      // Transitional read-only fallback for buildings that have not received
      // image documents yet. No legacy write controls remain in the admin UI.
      const legacy = await readJson(`/api/buildings/${encodeURIComponent(String(buildingId))}/schedules`, requestController.signal);
      if (sequence !== requestSequence) return;
      const rows = legacy.response.ok && legacy.json && legacy.json.success === true && Array.isArray(legacy.json.schedules)
        ? legacy.json.schedules : [];
      if (!rows.length) { setState('empty'); return; }
      rows.forEach((row) => list.appendChild(renderLegacy(row)));
      setState('ready');
    } catch (error) {
      if (error && error.name === 'AbortError') return;
      if (sequence === requestSequence) setState('error');
    }
  }

  window.CampuSphereBuildingSchedules = { load };
})();
