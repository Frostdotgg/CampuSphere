/* ========================================
   CampuSphere — Map Routes
   Interactive Campus Map
   ======================================== */

const express = require('express');
const router = express.Router();
const mapController = require('../controllers/mapController');

// GET /map — Campus Map
router.get('/map', mapController.index);

module.exports = router;
