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
const { requireRole } = require('../middleware/roleAuth');

// All admin routes require the 'admin' role via session
router.use(requireRole('admin'));

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

// GET /admin/settings — Settings
router.get('/settings', adminController.settings);

// GET /admin/campus-map — Campus Map Management
router.get('/campus-map', adminController.campusMap);

// ---- API Routes (JSON responses for AJAX) ----

// Users CRUD
router.post('/api/users', adminUsersController.createUser);
router.put('/api/users/:id', adminUsersController.updateUser);
router.delete('/api/users/:id', adminUsersController.deleteUser);

// News/Announcements CRUD
router.post('/api/news', adminContentController.createNews);
router.put('/api/news/:id', adminContentController.updateNews);
router.delete('/api/news/:id', adminContentController.deleteNews);

// Events CRUD
router.post('/api/events', adminContentController.createEvent);
router.put('/api/events/:id', adminContentController.updateEvent);
router.delete('/api/events/:id', adminContentController.deleteEvent);

// Buildings CRUD
router.post('/api/buildings', adminBuildingsController.createBuilding);
router.put('/api/buildings/:id', adminBuildingsController.updateBuilding);
router.delete('/api/buildings/:id', adminBuildingsController.deleteBuilding);

module.exports = router;

