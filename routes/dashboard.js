/* ========================================
   CampuSphere — Dashboard Routes
   Role-based dashboard
   ======================================== */

const express = require('express');
const router = express.Router();
const { requireLogin } = require('../middleware/roleAuth');
const dashboardController = require('../controllers/dashboardController');
const notificationController = require('../controllers/notificationController');

// GET /dashboard — Main dashboard (authenticated)
router.get('/dashboard', requireLogin, dashboardController.index);
router.get('/api/notifications', requireLogin, notificationController.index);

module.exports = router;
