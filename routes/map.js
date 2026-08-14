/* ========================================
   CampuSphere - Map Routes
   Interactive Campus Map
   ======================================== */

const express = require('express');
const router = express.Router();
const mapController = require('../controllers/mapController');
const offlineGuideController = require('../controllers/offlineGuideController');
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

// GET /api/offline-guide - explicit, authenticated, read-only OFF.3 package.
// Network-only/no-store: the browser validates and atomically stores the safe
// payload only after the user selects Download Offline Guide.
router.get('/api/offline-guide', requireLogin, offlineGuideController.download);

module.exports = router;
