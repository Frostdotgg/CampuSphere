/* ========================================
   CampuSphere — Buildings Routes
   Building explorer page
   ======================================== */

const express = require('express');
const router = express.Router();
const buildingsController = require('../controllers/buildingsController');
const roomScheduleDocumentController = require('../controllers/roomScheduleDocumentController');
const { requireLogin } = require('../middleware/roleAuth');

// GET /buildings — Buildings page
router.get('/buildings', requireLogin, buildingsController.index);

// GET /api/buildings — JSON building list (login required; campus data is not public)
router.get('/api/buildings', requireLogin, buildingsController.apiList);

// GET /api/buildings/:id/schedules — JSON room/facility schedule window for one
// building (Milestone 11, Section 11.6). Same login gate as the other building
// reads; anonymous callers get the standard 401 JSON via wantsJson.
router.get('/api/buildings/:id/schedules', requireLogin, buildingsController.apiBuildingSchedules);

// Current semester room schedule images. Authentication protects discovery;
// the Cloudinary delivery URLs themselves remain public media URLs.
router.get('/api/buildings/:id/room-schedule-documents', requireLogin, roomScheduleDocumentController.listForBuilding);
router.get('/api/room-schedule-documents/:id', requireLogin, roomScheduleDocumentController.getDocument);

module.exports = router;
