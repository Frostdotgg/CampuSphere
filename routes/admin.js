/* ========================================
   CampuSphere — Admin Routes
   Admin panel pages (mounted at /admin)
   ======================================== */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminUsersController = require('../controllers/adminUsersController');
const adminContentController = require('../controllers/adminContentController');
const adminBuildingsController = require('../controllers/adminBuildingsController');
const adminVrController = require('../controllers/adminVrController');
const adminRouteController = require('../controllers/adminRouteController');
const adminScheduleController = require('../controllers/adminScheduleController');
const adminRoomScheduleDocumentController = require('../controllers/adminRoomScheduleDocumentController');
const presenceController = require('../controllers/presenceController');
const { requireRole } = require('../middleware/roleAuth');
const { verifyCsrf } = require('../middleware/csrfProtection');
const { adminMutationLimiter } = require('../middleware/rateLimit');

// All admin routes require the 'admin' role via session
router.use(requireRole('admin'));

// CSRF guard for admin mutations (Milestone 8, Section 8.2). Placed AFTER
// requireRole so anonymous callers keep their 401 JSON and non-admin callers
// keep their 403 role-denial JSON before any CSRF check. verifyCsrf is a no-op
// for safe methods, so admin GET pages and GET APIs are unaffected; only
// POST/PUT/DELETE admin mutations require a valid X-CSRF-Token / _csrf token.
router.use(verifyCsrf);

// Admin mutation rate limiting (Milestone 8, Section 8.3). After requireRole +
// verifyCsrf so 401/403/CSRF contracts are unchanged below the threshold; a
// no-op for safe (GET/HEAD/OPTIONS) admin reads, so read-only admin APIs and
// page renders are never rate-limited.
router.use(adminMutationLimiter);

// ---- Page Routes (render EJS views) ----

// GET /admin — Dashboard
router.get('/', adminController.index);

// GET /admin/users — User Management
router.get('/users', adminController.users);

// GET /admin/news — News & Events Editor
router.get('/news', adminController.news);

// GET /admin/faqs — FAQ Management
router.get('/faqs', adminController.faqs);

// GET /admin/logs — System Logs
router.get('/logs', adminController.logs);

// GET /admin/vr — VR Scene & Hotspot Administration (Milestone 7, Section 7.8)
router.get('/vr', adminController.vr);

// GET /admin/settings — Settings
router.get('/settings', adminController.settings);

// GET /admin/campus-map — Campus Map Management
router.get('/campus-map', adminController.campusMap);

// ---- API Routes (JSON responses for AJAX) ----

// Users CRUD
router.post('/api/users', adminUsersController.createUser);
router.put('/api/users/:id', adminUsersController.updateUser);
router.delete('/api/users/:id', adminUsersController.deleteUser);
// One batched presence snapshot for the Users page; never expose presence to
// non-administrator callers or accept a user id from the browser.
router.get('/api/users/presence', presenceController.adminSnapshot);

// News/Announcements CRUD
router.post('/api/news', adminContentController.createNews);
router.put('/api/news/:id', adminContentController.updateNews);
router.delete('/api/news/:id', adminContentController.deleteNews);

// Events CRUD
router.post('/api/events', adminContentController.createEvent);
router.put('/api/events/:id', adminContentController.updateEvent);
router.delete('/api/events/:id', adminContentController.deleteEvent);

// FAQs CRUD (Milestone 7, Section 7.5)
router.get('/api/faqs', adminContentController.listFaqs);
router.get('/api/faqs/:id', adminContentController.getFaq);
router.post('/api/faqs', adminContentController.createFaq);
router.put('/api/faqs/:id', adminContentController.updateFaq);
router.delete('/api/faqs/:id', adminContentController.deleteFaq);

// Institutional settings (Milestone 7, Section 7.6)
router.get('/api/settings', adminContentController.getSettings);
router.put('/api/settings', adminContentController.updateSettings);

// System logs — read-only audit view (Milestone 7, Section 7.7)
router.get('/api/logs', adminController.getLogs);

// VR Scene & Hotspot Administration (Milestone 7, Section 7.8)
router.get('/api/vr/scenes', adminVrController.listScenes);
router.post('/api/vr/scenes', adminVrController.createScene);
router.get('/api/vr/scenes/:id', adminVrController.getScene);
router.put('/api/vr/scenes/:id', adminVrController.updateScene);
router.delete('/api/vr/scenes/:id', adminVrController.deleteScene);
router.get('/api/vr/scenes/:sceneId/hotspots', adminVrController.listHotspots);
router.post('/api/vr/scenes/:sceneId/hotspots', adminVrController.createHotspot);
router.put('/api/vr/hotspots/:id', adminVrController.updateHotspot);
router.delete('/api/vr/hotspots/:id', adminVrController.deleteHotspot);

// Route / Step / Node / Edge Administration (Milestone 7, Section 7.9)
router.get('/api/routes', adminRouteController.listRoutes);
router.post('/api/routes', adminRouteController.createRoute);
router.get('/api/routes/:id', adminRouteController.getRoute);
router.put('/api/routes/:id', adminRouteController.updateRoute);
router.delete('/api/routes/:id', adminRouteController.deleteRoute);
router.get('/api/routes/:routeId/steps', adminRouteController.listSteps);
router.put('/api/routes/:routeId/steps', adminRouteController.replaceSteps);

router.get('/api/route-nodes', adminRouteController.listNodes);
router.post('/api/route-nodes', adminRouteController.createNode);
router.get('/api/route-nodes/:id', adminRouteController.getNode);
router.put('/api/route-nodes/:id', adminRouteController.updateNode);
router.delete('/api/route-nodes/:id', adminRouteController.deleteNode);

router.get('/api/route-edges', adminRouteController.listEdges);
router.post('/api/route-edges', adminRouteController.createEdge);
router.get('/api/route-edges/:id', adminRouteController.getEdge);
router.put('/api/route-edges/:id', adminRouteController.updateEdge);
// RF.4: dedicated road-geometry write (strict { path_geometry } allowlist;
// null clears both directed rows). Distinct path from the edge PUT above.
router.put('/api/route-edges/:id/geometry', adminRouteController.updateEdgeGeometry);
router.delete('/api/route-edges/:id', adminRouteController.deleteEdge);

// Buildings CRUD
// BE.3: admin building list carrying the explicit admin row shape plus the
// sanitized route-availability fields (route_available / route_unavailable_reason
// / route_destination_id), so admin cards can show Route ready vs Route setup
// required. Read-only GET — the existing admin role gate, CSRF ordering, and
// mutation rate limits on the write verbs below are untouched.
router.get('/api/buildings', adminBuildingsController.listBuildings);
router.post('/api/buildings', adminBuildingsController.createBuilding);
router.put('/api/buildings/:id', adminBuildingsController.updateBuilding);
router.delete('/api/buildings/:id', adminBuildingsController.deleteBuilding);

// Legacy time-row schedules remain readable during the image-flow transition,
// but their mutation endpoints are intentionally retired. Existing rows power
// the authenticated fallback viewer only.
router.get('/api/schedules', adminScheduleController.listSchedules);
router.get('/api/schedules/:id', adminScheduleController.getSchedule);

// Semester-long room schedule images replace legacy time-slot administration.
router.get('/api/room-schedule-documents', adminRoomScheduleDocumentController.listDocuments);
router.post('/api/room-schedule-documents', adminRoomScheduleDocumentController.createDocument);
router.get('/api/room-schedule-documents/:id', adminRoomScheduleDocumentController.getDocument);
router.put('/api/room-schedule-documents/:id', adminRoomScheduleDocumentController.updateDocument);
router.delete('/api/room-schedule-documents/:id', adminRoomScheduleDocumentController.deleteDocument);

module.exports = router;

