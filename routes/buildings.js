/* ========================================
   CampuSphere — Buildings Routes
   Building explorer page
   ======================================== */

const express = require('express');
const router = express.Router();
const buildingsController = require('../controllers/buildingsController');
const roomScheduleDocumentController = require('../controllers/roomScheduleDocumentController');
const { requireLogin, requireRole } = require('../middleware/roleAuth');
const { SCHEDULE_VIEW_ROLES } = require('../utils/participantVisibility');

// GET /buildings — Buildings page
router.get('/buildings', requireLogin, buildingsController.index);

// GET /api/buildings — JSON building list (login required; campus data is not public)
router.get('/api/buildings', requireLogin, buildingsController.apiList);

// GET /api/buildings/:id/schedules — JSON room/facility schedule window for one
// building (Milestone 11, Section 11.6). Room schedules are participant data:
// guests may browse building details, but only students, instructors, and
// admins can discover schedule rows.
router.get('/api/buildings/:id/schedules', requireRole(...SCHEDULE_VIEW_ROLES), buildingsController.apiBuildingSchedules);

// Current semester room schedule images. Authentication protects discovery;
// the Cloudinary delivery URLs themselves remain public media URLs.
router.get('/api/buildings/:id/room-schedule-documents', requireRole(...SCHEDULE_VIEW_ROLES), roomScheduleDocumentController.listForBuilding);
router.get('/api/room-schedule-documents/:id', requireRole(...SCHEDULE_VIEW_ROLES), roomScheduleDocumentController.getDocument);

module.exports = router;
