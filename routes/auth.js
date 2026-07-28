/* ========================================
   CampuSphere — Auth Routes
   Authentication-related pages
   ======================================== */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireLogin } = require('../middleware/roleAuth');
const { verifyCsrf } = require('../middleware/csrfProtection');
const { loginAccountLimiter } = require('../middleware/rateLimit');

// GET /auth — Combined Sign In / Register
router.get('/auth', authController.auth);

// GET /login — Redirect to combined auth page (legacy URL)
router.get('/login', (req, res) => res.redirect('/auth'));

// GET /register — Redirect to combined auth page register tab (legacy URL)
router.get('/register', (req, res) => res.redirect('/auth#register'));

// POST /register — Create account (CSRF-protected; session-backed mutation)
router.post('/register', verifyCsrf, authController.registerPost);

// POST /login — Authenticate user (CSRF-protected; session-backed mutation).
// loginAccountLimiter (per hashed email + IP) runs after body parse + CSRF and
// before the controller, bounding password-guessing against a single account.
router.post('/login', verifyCsrf, loginAccountLimiter, authController.loginPost);

// GET /auth/csrf-token — authenticated, JSON-only, never cached (M12.P1-D1).
// The tiny pre-middleware applies the exact no-store policy BEFORE
// authentication so BOTH the 200 and the unauthenticated 401 carry
// `Cache-Control: no-store, private` (the global authenticatedHtmlNoStore
// middleware only marks authenticated responses). requireLogin stays the
// authentication authority: fetch callers (Accept: application/json) get the
// standard sanitized 401 JSON contract. The token is the CURRENT session
// token — attachCsrfToken minted it for this authenticated session — and is
// never rotated, logged, or cached here.
router.get(
  '/auth/csrf-token',
  (req, res, next) => { res.set('Cache-Control', 'no-store, private'); next(); },
  requireLogin,
  authController.csrfToken
);

// Google OAuth
router.get('/auth/google', authController.googleStart);
router.get('/auth/callback', authController.googleCallback);
router.get('/auth/complete-registration', authController.completeRegistration);
router.post('/auth/complete-registration', verifyCsrf, authController.completeRegistrationPost);

// POST /logout — Destroy session (Milestone 8, Section 8.2: state change via POST
// only, requires login + valid CSRF). Redirects to /auth?logged_out=1 so the PWA
// client (public/js/pwa.js) still runs its logout cache/catalog cleanup.
router.post('/logout', requireLogin, verifyCsrf, authController.logout);

// GET /logout — Non-mutating. Logout is POST-only now; a GET must never destroy
// the session. Returns a fixed 405 (Allow: POST) for browser and JSON callers.
router.get('/logout', authController.logoutGet);

module.exports = router;
