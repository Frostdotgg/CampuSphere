/* ========================================
   CampuSphere — Buildings Routes
   Building explorer page
   ======================================== */

const express = require('express');
const router = express.Router();
const buildingsController = require('../controllers/buildingsController');

// GET /buildings — Buildings page
router.get('/buildings', buildingsController.index);

module.exports = router;
