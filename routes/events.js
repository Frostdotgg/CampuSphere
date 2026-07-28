/* ========================================
   CampuSphere — Events Routes
   Events and news page
   ======================================== */

const express = require('express');
const router = express.Router();
const eventsController = require('../controllers/eventsController');
const { requireLogin } = require('../middleware/roleAuth');

// GET /events — Events page
router.get('/events', requireLogin, eventsController.index);

module.exports = router;
