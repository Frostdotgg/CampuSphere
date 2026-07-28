/* ========================================
   CampuSphere — Role-Based Auth Middleware
   Validates user role from session data
   ======================================== */

const auditService = require('../services/auditService');

/**
 * Detect whether the caller wants a JSON response.
 * Used so API requests get 401/403 JSON instead of an HTML redirect.
 */
function wantsJson(req) {
  if (req.originalUrl && req.originalUrl.includes('/api/')) return true;
  if (req.xhr) return true;
  const accept = req.get('Accept') || '';
  if (accept.includes('application/json') && !accept.includes('text/html')) return true;
  const contentType = req.get('Content-Type') || '';
  if (contentType.includes('application/json')) return true;
  return false;
}

/**
 * PURE: is this an actor whose authorization denial may be persisted?
 *
 * M12.P1-R5. An auditable actor is an AUTHENTICATED one: a positive integer
 * user id AND a non-blank role. Anonymous callers (null/undefined session
 * user), partially hydrated sessions, and malformed/roleless actors are
 * refused, so a null-actor row can never be written by accident.
 *
 * Exported as test surface so the in-suite gate can assert the refusal
 * contract against the REAL predicate without a database or a stubbed
 * audit service.
 *
 * @param {*} actor candidate session user
 * @returns {boolean} true only for a positive-integer id plus a non-blank role
 */
function isAuditableActor(actor) {
  if (!actor || typeof actor !== 'object') return false;
  const id = Number(actor.id);
  if (!Number.isInteger(id) || id < 1) return false;
  return typeof actor.role === 'string' && actor.role.trim() !== '';
}

/**
 * Best-effort audit of an AUTHENTICATED authorization denial (M12.P1-R5).
 *
 * Routine anonymous traffic to a login-gated or role-gated route is ordinary
 * unauthenticated behaviour, not a security event, and previously amplified
 * every logged-out request into an immutable system_logs row. Only an
 * authenticated user acting outside their allowed role is recorded here, and
 * only when isAuditableActor() accepts the session actor.
 *
 * Fire-and-forget: it never throws, never blocks or alters the denial
 * response, and never leaks. The target is the query-free request path only
 * (no query string, header, body, cookie, session id, or IP address).
 *
 * @returns {boolean} true when a record was dispatched, false when refused
 */
function auditAuthenticatedAccessDenied(req, actor) {
  if (!isAuditableActor(actor)) return false;
  auditService.record({
    event_type: 'authorization',
    action: 'access.denied',
    outcome: 'denied',
    actor_user_id: Number(actor.id),
    actor_role: actor.role.trim(),
    target_type: 'route',
    target_id: ((req && req.originalUrl) || '').split('?')[0],
    message: 'Access to a protected route was denied.'
  }).catch(() => {});
  return true;
}

/**
 * Middleware: Require the user to be logged in.
 * Browser requests redirect to /auth; API requests get a 401 JSON response.
 *
 * M12.P1-R5: the anonymous branch records NO audit event. The 302 /auth
 * browser redirect and the fixed 401 JSON denial are unchanged.
 */
const requireLogin = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  if (wantsJson(req)) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  return res.redirect('/auth');
};

/**
 * Factory: Require the logged-in user to have one of the allowed roles.
 * @param {...string} allowedRoles
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      // Anonymous caller hitting a role-gated route: routine unauthenticated
      // traffic. M12.P1-R5 records no audit event here; the responses below
      // are byte-identical to the pre-R5 contract.
      if (wantsJson(req)) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
      }
      return res.redirect('/auth');
    }

    const userRole = req.session.user.role;
    if (allowedRoles.length === 0 || allowedRoles.includes(userRole)) {
      return next();
    }

    // Authenticated but lacking the required role: the ONE retained
    // authorization-denial audit write, with the session actor's identity.
    // Best-effort; never blocks or changes the 403 below.
    auditAuthenticatedAccessDenied(req, req.session.user);

    if (wantsJson(req)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
    }
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

module.exports = { requireLogin, requireRole, attachUser, wantsJson, isAuditableActor };
