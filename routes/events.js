/* ========================================
   CampuSphere — Events Routes
   Events and news page
   ======================================== */

const express = require('express');
const router = express.Router();
const eventsController = require('../controllers/eventsController');

// GET /events — Events page
router.get('/events', eventsController.index);

module.exports = router;
