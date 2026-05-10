/* ========================================
   CampuSphere — Dashboard Routes
   Role-based dashboard
   ======================================== */

const express = require('express');
const router = express.Router();
const requireLogin = require('../middleware/requireLogin');
const dashboardController = require('../controllers/dashboardController');

// GET /dashboard — Main dashboard (authenticated)
router.get('/dashboard', requireLogin, dashboardController.index);

module.exports = router;
