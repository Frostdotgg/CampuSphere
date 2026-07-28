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

// GET /about — About Us
router.get('/about', requireLogin, pageController.about);

module.exports = router;
