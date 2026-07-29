/* ========================================
   CampuSphere — Index Routes
   Landing, Home, and About pages
   ======================================== */

const express = require('express');
const router = express.Router();
const pageController = require('../controllers/pageController');
const { requireLogin } = require('../middleware/roleAuth');

// GET / — Landing page
router.get('/', pageController.landing);

// GET /home — Home dashboard
router.get('/home', pageController.home);

// GET /privacy — Pilot privacy notice (M12.P1-R8). Intentionally anonymous:
// a prospective participant must be able to read it BEFORE creating an account.
router.get('/privacy', pageController.privacy);

// GET /about — About Us
router.get('/about', requireLogin, pageController.about);

module.exports = router;
