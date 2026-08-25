(function () {
  'use strict';

  function stringValue(value) { return value == null ? '' : String(value); }
  function positiveId(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : null;
  }

  function targetFromHotspot(hotspot) {
    if (!hotspot || hotspot.hotspot_type !== 'schedule') return null;
    const documentId = positiveId(hotspot.schedule_document_id);
    if (documentId !== null) return { documentId };

    // Transitional fallback for old hotspots that have not been relinked.
    const buildingId = positiveId(hotspot.schedule_building_id);
    const locationType = stringValue(hotspot.schedule_location_type).trim();
    const locationLabel = stringValue(hotspot.schedule_location_label).trim();
    const floorLabel = stringValue(hotspot.schedule_floor_label).trim();
    if (buildingId === null || !['room', 'facility'].includes(locationType) || !locationLabel) return null;
    return { documentId: null, buildingId, locationType, locationLabel, floorLabel };
  }

  function targetFromButton(button) {
    if (!button) return null;
    return targetFromHotspot({
      hotspot_type: 'schedule',
      schedule_document_id: button.getAttribute('data-schedule-document-id'),
      schedule_building_id: button.getAttribute('data-schedule-building-id'),
      schedule_location_type: button.getAttribute('data-schedule-location-type'),
      schedule_location_label: button.getAttribute('data-schedule-location-label'),
      schedule_floor_label: button.getAttribute('data-schedule-floor-label')
    });
  }

  function openTarget(target, trigger, label) {
    const viewer = window.CampuSphereRoomScheduleViewer;
    if (!viewer || !target) return;
    if (target.documentId !== null) viewer.openById(target.documentId, trigger);
    else viewer.openLegacy(target, trigger, label || 'Legacy room schedule');
  }

  function init() {
    function openFromHotspot(hotspot, trigger) {
      openTarget(targetFromHotspot(hotspot), trigger || null, stringValue(hotspot && hotspot.label));
    }

    document.querySelectorAll('[data-vr-schedule-hotspot]').forEach(function (button) {
      button.addEventListener('click', function () {
        openTarget(targetFromButton(button), button, button.getAttribute('data-schedule-title') || 'Room schedule');
      });
    });

    function makePannellumHotspot(hotspot) {
      const config = {
        pitch: Number(hotspot && hotspot.pitch) || 0,
        yaw: Number(hotspot && hotspot.yaw) || 0,
        type: 'info',
        text: stringValue(hotspot && hotspot.label) || 'Room schedule'
      };
      if (targetFromHotspot(hotspot)) {
        config.clickHandlerFunc = function (event) {
          openFromHotspot(hotspot, event && event.target ? event.target : null);
        };
      }
      return config;
    }

    return { openFromHotspot, makePannellumHotspot };
  }

  window.CampuSphereVrSchedule = { init, targetFromHotspot };
})();
