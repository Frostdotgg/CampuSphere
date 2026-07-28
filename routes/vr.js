/* ========================================
   CampuSphere - VR / 360 Routes
   Milestone 5, Phase 4 Section 5.
   ======================================== */

const express = require('express');
const router = express.Router();
const vrController = require('../controllers/vrController');
const { requireLogin } = require('../middleware/roleAuth');

// --- Route-based guided VR viewer (Section 5 deliverable) ---
// Registered before /vr/:sceneKey so the multi-segment paths are
// unambiguous and never shadowed by the scene browser.
// GET /vr/routes/:routeId      - HTML guided route walkthrough
router.get('/vr/routes/:routeId', requireLogin, vrController.routeViewer);
// GET /api/vr/routes/:routeId  - JSON route + scene sequence
router.get('/api/vr/routes/:routeId', requireLogin, vrController.apiRoute);

// --- Destination-based guided VR viewer (Milestone 11, Section 11.8B) ---
// Synthesizes a Guard House / Main Gate -> building route from the graph, so
// the map's Set VR Route action works without a predefined campus_routes row.
// Registered before /vr/:sceneKey so the multi-segment path is unambiguous.
// GET /vr/to/:buildingId       - HTML guided walkthrough to a destination
router.get('/vr/to/:buildingId', requireLogin, vrController.destinationViewer);
// GET /api/vr/to/:buildingId   - JSON destination route + scene sequence
router.get('/api/vr/to/:buildingId', requireLogin, vrController.apiDestination);

// --- Scene browser (kept; harmless free navigation) ---
// GET /vr                - default VR scene
router.get('/vr', requireLogin, vrController.viewer);
// GET /vr/:sceneKey      - a specific VR scene by stable scene_key
router.get('/vr/:sceneKey', requireLogin, vrController.viewer);

module.exports = router;
