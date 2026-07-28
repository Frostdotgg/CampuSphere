/* ========================================
   CampuSphere - Map Routes
   Interactive Campus Map
   ======================================== */

const express = require('express');
const router = express.Router();
const mapController = require('../controllers/mapController');
const { requireLogin } = require('../middleware/roleAuth');

// GET /map - Campus Map
router.get('/map', requireLogin, mapController.index);

// GET /api/search - Logged-in campus search across buildings and routes
router.get('/api/search', requireLogin, mapController.apiSearch);

// GET /api/routes - List predefined routes (optionally filtered by start/destination)
router.get('/api/routes', requireLogin, mapController.apiListRoutes);

// GET /api/routes/:id - Single predefined route with ordered steps + landmarks
router.get('/api/routes/:id', requireLogin, mapController.apiGetRoute);

// GET /api/pathfind - Dijkstra shortest path over the campus route graph
router.get('/api/pathfind', requireLogin, mapController.apiPathfind);

module.exports = router;
