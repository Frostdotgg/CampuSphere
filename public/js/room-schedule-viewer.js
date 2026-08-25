(function () {
  'use strict';

  function text(value) { return value == null ? '' : String(value); }
  function positiveId(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : null;
  }
  function clear(element) { if (element) element.replaceChildren(); }
  function safeCloudinaryUrl(value) {
    const candidate = text(value).trim();
    try {
      const parsed = new URL(candidate);
      return parsed.protocol === 'https:' && parsed.hostname === 'res.cloudinary.com' && !parsed.username && !parsed.password && !parsed.port
        ? candidate : null;
    } catch (error) { return null; }
  }

  function init() {
    const overlay = document.getElementById('roomScheduleViewer');
    if (!overlay) return null;
    /* Keep the fixed modal outside page stacking contexts (the VR and building
       shells intentionally create their own z-index layers). */
    if (overlay.parentElement !== document.body) document.body.appendChild(overlay);
    const dialog = overlay.querySelector('.room-schedule-viewer__dialog');
    const closeButton = document.getElementById('roomScheduleViewerClose');
    const doneButton = document.getElementById('roomScheduleViewerDone');
    const title = document.getElementById('roomScheduleViewerTitle');
    const meta = document.getElementById('roomScheduleViewerMeta');
    const status = document.getElementById('roomScheduleViewerStatus');
    const toolbar = document.getElementById('roomScheduleViewerToolbar');
    const zoomButton = document.getElementById('roomScheduleViewerZoom');
    const frame = document.getElementById('roomScheduleViewerFrame');
    const image = document.getElementById('roomScheduleViewerImage');
    const original = document.getElementById('roomScheduleViewerOriginal');
    const legacyList = document.getElementById('roomScheduleViewerLegacyList');
    let returnFocus = null;
    let requestController = null;

    function setZoomed(zoomed) {
      frame.classList.toggle('is-zoomed', zoomed);
      zoomButton.setAttribute('aria-pressed', zoomed ? 'true' : 'false');
      zoomButton.textContent = zoomed ? 'Fit whole schedule' : 'Zoom to read';
      if (!zoomed) frame.scrollTo(0, 0);
    }

    function resetZoom() {
      setZoomed(false);
      toolbar.hidden = true;
    }

    function setStatus(message) {
      status.hidden = !message;
      status.textContent = message || '';
    }

    function resetContent() {
      if (requestController) requestController.abort();
      requestController = null;
      resetZoom();
      frame.hidden = true;
      image.hidden = true;
      image.removeAttribute('src');
      image.alt = '';
      original.hidden = true;
      original.removeAttribute('href');
      legacyList.hidden = true;
      clear(legacyList);
    }

    function show(trigger) {
      returnFocus = trigger || document.activeElement;
      overlay.hidden = false;
      document.body.classList.add('room-schedule-viewer-open');
      document.documentElement.classList.add('room-schedule-viewer-open');
      closeButton.focus();
    }

    function close() {
      resetContent();
      overlay.hidden = true;
      document.body.classList.remove('room-schedule-viewer-open');
      document.documentElement.classList.remove('room-schedule-viewer-open');
      if (returnFocus && document.contains(returnFocus) && typeof returnFocus.focus === 'function') returnFocus.focus();
      returnFocus = null;
    }

    function openDocument(documentRow, trigger) {
      resetContent();
      const url = safeCloudinaryUrl(documentRow && documentRow.image_url);
      title.textContent = text(documentRow && documentRow.location_label) || 'Room schedule';
      meta.textContent = [
        text(documentRow && documentRow.building_name),
        text(documentRow && documentRow.floor_label),
        text(documentRow && documentRow.semester_label),
        text(documentRow && documentRow.school_year)
      ].filter(Boolean).join(' · ');
      show(trigger);
      if (!url) { setStatus('This schedule image is unavailable. Ask an administrator to verify its Cloudinary URL.'); return; }
      setStatus('Loading schedule image…');
      frame.hidden = false;
      image.hidden = false;
      image.alt = text(documentRow.alt_text) || `${title.textContent} weekly schedule.`;
      image.onload = function () {
        setStatus('');
        toolbar.hidden = false;
      };
      image.onerror = function () {
        resetZoom();
        frame.hidden = true;
        image.hidden = true;
        setStatus('The schedule image could not be loaded. Use the full-size link or try again later.');
      };
      image.src = url;
      original.href = url;
      original.hidden = false;
    }

    async function openById(id, trigger) {
      const documentId = positiveId(id);
      if (documentId === null) return;
      resetContent();
      title.textContent = 'Room schedule';
      meta.textContent = '';
      setStatus('Loading room schedule…');
      show(trigger);
      requestController = new AbortController();
      try {
        const response = await fetch('/api/room-schedule-documents/' + encodeURIComponent(String(documentId)), {
          credentials: 'same-origin', headers: { Accept: 'application/json' }, signal: requestController.signal
        });
        const json = await response.json().catch(() => null);
        if (!response.ok || !json || json.success !== true || !json.document) throw new Error('schedule request failed');
        openDocument(json.document, returnFocus);
      } catch (error) {
        if (error && error.name === 'AbortError') return;
        resetContent();
        setStatus('Unable to load this room schedule. Check your connection and try again.');
      }
    }

    async function openLegacy(target, trigger, fallbackTitle) {
      if (!target || positiveId(target.buildingId) === null) return;
      resetContent();
      title.textContent = fallbackTitle || 'Legacy room schedule';
      meta.textContent = [target.locationLabel, target.floorLabel].filter(Boolean).join(' · ');
      setStatus('Loading legacy schedule entries…');
      show(trigger);
      const params = new URLSearchParams({ location_type: target.locationType, location_label: target.locationLabel });
      if (target.floorLabel) params.set('floor_label', target.floorLabel);
      requestController = new AbortController();
      try {
        const response = await fetch(`/api/buildings/${encodeURIComponent(String(target.buildingId))}/schedules?${params}`, {
          credentials: 'same-origin', headers: { Accept: 'application/json' }, signal: requestController.signal
        });
        const json = await response.json().catch(() => null);
        const rows = response.ok && json && json.success === true && Array.isArray(json.schedules) ? json.schedules : [];
        if (!rows.length) { setStatus('No legacy schedule entries are available for this room.'); return; }
        clear(legacyList);
        rows.forEach((row) => {
          const item = document.createElement('li');
          const heading = document.createElement('strong');
          heading.textContent = text(row.title) || 'Scheduled use';
          const timing = document.createElement('span');
          timing.textContent = [row.schedule_date, row.start_time && row.end_time ? `${row.start_time}–${row.end_time}` : ''].filter(Boolean).join(' · ');
          item.append(heading, timing);
          if (row.description) {
            const description = document.createElement('span');
            description.textContent = text(row.description);
            item.appendChild(description);
          }
          legacyList.appendChild(item);
        });
        setStatus('');
        legacyList.hidden = false;
      } catch (error) {
        if (error && error.name === 'AbortError') return;
        setStatus('Unable to load legacy schedule entries.');
      }
    }

    [closeButton, doneButton].forEach((button) => button.addEventListener('click', close));
    zoomButton.addEventListener('click', function () {
      setZoomed(!frame.classList.contains('is-zoomed'));
    });
    overlay.addEventListener('mousedown', (event) => { if (event.target === overlay) close(); });
    document.addEventListener('keydown', (event) => {
      if (overlay.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialog.querySelectorAll('a[href]:not([hidden]), button:not([disabled]):not([hidden])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    return { openDocument, openById, openLegacy, close };
  }

  document.addEventListener('DOMContentLoaded', function () {
    window.CampuSphereRoomScheduleViewer = init();
  });
})();
