/* ========================================
   CampuSphere — Auth Routes
   Authentication-related pages
   ======================================== */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// GET /auth — Combined Sign In / Register
router.get('/auth', authController.auth);

// GET /login — Standalone Login
router.get('/login', authController.login);

// GET /register — Standalone Register
router.get('/register', authController.register);

// POST /register — Create account
router.post('/register', authController.registerPost);

// POST /login — Authenticate user
router.post('/login', authController.loginPost);

// Google OAuth
router.get('/auth/google', authController.googleStart);
router.get('/auth/callback', authController.googleCallback);
router.get('/auth/complete-registration', authController.completeRegistration);
router.post('/auth/complete-registration', authController.completeRegistrationPost);

// GET /logout — Destroy session
router.get('/logout', authController.logout);

module.exports = router;
