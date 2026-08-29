/* ========================================
   CampuSphere — Index Routes
   Landing, Home, and About pages
   ======================================== */

const express = require('express');
const router = express.Router();
const pageController = require('../controllers/pageController');
const faqController = require('../controllers/faqController');
const { requireLogin } = require('../middleware/roleAuth');
const { loadPublicSettings } = require('../services/siteSettingsService');

// GET / — Landing page
router.get('/', loadPublicSettings, pageController.landing);

// GET /home — Home dashboard
router.get('/home', requireLogin, loadPublicSettings, pageController.home);

// GET /privacy — Pilot privacy notice (M12.P1-R8). Intentionally anonymous:
// a prospective participant must be able to read it BEFORE creating an account.
router.get('/privacy', loadPublicSettings, pageController.privacy);

// GET /faq - Public FAQ page. FAQ content is readable before sign-in and is
// also rendered with the signed-in dashboard chrome when a session exists.
router.get('/faq', loadPublicSettings, faqController.index);

// GET /about — About Us
router.get('/about', requireLogin, loadPublicSettings, pageController.about);

module.exports = router;
