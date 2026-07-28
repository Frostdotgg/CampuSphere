(function () {
  'use strict';

  function str(value) {
    return value == null ? '' : String(value);
  }

  function clear(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function targetFromHotspot(hotspot) {
    if (!hotspot || hotspot.hotspot_type !== 'schedule') return null;
    const buildingId = Number(hotspot.schedule_building_id);
    const locationType = str(hotspot.schedule_location_type).trim();
    const locationLabel = str(hotspot.schedule_location_label).trim();
    const floorLabel = str(hotspot.schedule_floor_label).trim();
    if (!Number.isInteger(buildingId) || buildingId < 1) return null;
    if (locationType !== 'room' && locationType !== 'facility') return null;
    if (!locationLabel) return null;
    return { buildingId, locationType, locationLabel, floorLabel };
  }

  function targetFromButton(btn) {
    if (!btn) return null;
    return targetFromHotspot({
      hotspot_type: 'schedule',
      schedule_building_id: btn.getAttribute('data-schedule-building-id'),
      schedule_location_type: btn.getAttribute('data-schedule-location-type'),
      schedule_location_label: btn.getAttribute('data-schedule-location-label'),
      schedule_floor_label: btn.getAttribute('data-schedule-floor-label')
    });
  }

  function titleFor(target, fallback) {
    if (fallback) return str(fallback);
    if (!target) return 'Room schedule';
    const prefix = target.locationType === 'facility' ? 'Facility schedule' : 'Room schedule';
    return prefix + ': ' + target.locationLabel;
  }

  function scheduleUrl(target) {
    const params = new URLSearchParams();
    params.set('location_type', target.locationType);
    params.set('location_label', target.locationLabel);
    if (target.floorLabel) params.set('floor_label', target.floorLabel);
    return '/api/buildings/' + encodeURIComponent(String(target.buildingId)) + '/schedules?' + params.toString();
  }

  function makeRow(row) {
    const item = document.createElement('li');
    item.className = 'vr-schedule-row';

    const title = document.createElement('p');
    title.className = 'vr-schedule-row__title';
    title.textContent = str(row.title) || 'Scheduled use';
    item.appendChild(title);

    const time = document.createElement('p');
    time.className = 'vr-schedule-row__time';
    const bits = [];
    if (row.schedule_date) bits.push(str(row.schedule_date));
    if (row.start_time || row.end_time) bits.push(str(row.start_time) + ' - ' + str(row.end_time));
    if (row.audience) bits.push(str(row.audience));
    time.textContent = bits.join(' - ');
    item.appendChild(time);

    if (row.description) {
      const desc = document.createElement('p');
      desc.className = 'vr-schedule-row__desc';
      desc.textContent = str(row.description);
      item.appendChild(desc);
    }
    return item;
  }

  function init() {
    const panel = document.getElementById('vrSchedulePanel');
    const closeBtn = document.getElementById('vrScheduleClose');
    const titleEl = document.getElementById('vrScheduleTitle');
    const metaEl = document.getElementById('vrScheduleMeta');
    const statusEl = document.getElementById('vrScheduleStatus');
    const listEl = document.getElementById('vrScheduleList');

    function setStatus(message) {
      if (!statusEl) return;
      statusEl.hidden = !message;
      statusEl.textContent = message || '';
    }

    function openPanel(target, label) {
      if (!panel || !target) return;
      panel.hidden = false;
      if (titleEl) titleEl.textContent = titleFor(target, label);
      if (metaEl) metaEl.textContent = target.floorLabel
        ? target.locationLabel + ' - ' + target.floorLabel
        : target.locationLabel;
      clear(listEl);
      setStatus('Loading schedule...');

      fetch(scheduleUrl(target), {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      })
        .then(function (res) {
          if (!res.ok) throw new Error('schedule request failed');
          return res.json();
        })
        .then(function (json) {
          clear(listEl);
          const rows = json && json.success === true && Array.isArray(json.schedules)
            ? json.schedules
            : [];
          if (!rows.length) {
            setStatus('No scheduled use for this ' + target.locationType + ' in the current window.');
            return;
          }
          setStatus('');
          rows.forEach(function (row) {
            if (listEl) listEl.appendChild(makeRow(row));
          });
        })
        .catch(function () {
          clear(listEl);
          setStatus('Unable to load schedules.');
        });
    }

    function openFromHotspot(hotspot) {
      const target = targetFromHotspot(hotspot);
      if (target) openPanel(target, hotspot.label);
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        if (panel) panel.hidden = true;
      });
    }

    document.querySelectorAll('[data-vr-schedule-hotspot]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const target = targetFromButton(btn);
        if (target) openPanel(target, btn.getAttribute('data-schedule-title') || '');
      });
    });

    function makePannellumHotspot(hotspot) {
      const hs = {
        pitch: Number(hotspot && hotspot.pitch) || 0,
        yaw: Number(hotspot && hotspot.yaw) || 0,
        type: 'info',
        text: str(hotspot && hotspot.label) || str(hotspot && hotspot.hotspot_type) || 'point'
      };
      if (targetFromHotspot(hotspot)) {
        hs.clickHandlerFunc = function () { openFromHotspot(hotspot); };
      }
      return hs;
    }

    return { openFromHotspot, makePannellumHotspot };
  }

  window.CampuSphereVrSchedule = { init, targetFromHotspot };
})();
