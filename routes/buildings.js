/* ========================================
   CampuSphere — Buildings Routes
   Building explorer page
   ======================================== */

const express = require('express');
const router = express.Router();
const buildingsController = require('../controllers/buildingsController');
const { requireLogin } = require('../middleware/roleAuth');
const { notFound } = require('../middleware/errorHandler');

// GET /buildings — Buildings page
router.get('/buildings', requireLogin, buildingsController.index);

// GET /api/buildings — JSON building list (login required; campus data is not public)
router.get('/api/buildings', requireLogin, buildingsController.apiList);

// Retired APIs keep the login boundary, but never access schedule storage.
router.all(['/api/buildings/:id/schedules', '/api/buildings/:id/room-schedule-documents',
  '/api/room-schedule-documents', '/api/room-schedule-documents/:id'], requireLogin, notFound);

module.exports = router;
