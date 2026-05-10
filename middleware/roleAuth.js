/* ========================================
   CampuSphere — Role-Based Auth Middleware
   Validates user role from session data
   ======================================== */

/**
 * Middleware: Require the user to be logged in.
 * Redirects to /auth if no session exists.
 */
const requireLogin = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  return res.redirect('/auth');
};

/**
 * Factory: Require the logged-in user to have one of the allowed roles.
 * @param {...string} allowedRoles
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    // Must be logged in first
    if (!req.session || !req.session.user) {
      return res.redirect('/auth');
    }

    const userRole = req.session.user.role;
    if (allowedRoles.length === 0 || allowedRoles.includes(userRole)) {
      return next();
    }

    // Forbidden
    return res.status(403).render('error', {
      title: '403 — Access Denied',
      statusCode: 403,
      message: 'You do not have permission to access this page.',
    });
  };
};

/**
 * Middleware: Attach the user object to req for convenience.
 * Always passes through (does not block).
 */
const attachUser = (req, res, next) => {
  req.currentUser = req.session ? req.session.user || null : null;
  next();
};

module.exports = { requireLogin, requireRole, attachUser };
