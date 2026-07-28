/* ========================================
   CampuSphere — Error Handling Middleware
   Handles 404 (Not Found) and 500 (Server Error)
   ======================================== */

// Reuse the single content-negotiation helper so API/JSON callers are detected
// identically to the auth middleware. roleAuth does not require this module
// (errorHandler is only consumed by server.js), so there is no import cycle.
const { wantsJson } = require('./roleAuth');
// Centralized sanitized logging (Milestone 8, Section 8.7 / R11): the helper
// never receives the Error object, so no stack/message/SQL/body can reach logs.
const { logServerError } = require('../utils/serverLog');

/**
 * 404 — Not Found
 * Catches all unmatched routes. API/JSON callers (e.g. an unmatched
 * /admin/api/* or /api/* path reached while authenticated) get the standard
 * JSON envelope so the front-end never has to parse an HTML page; browser
 * callers keep the HTML error page.
 */
const notFound = (req, res, next) => {
  if (wantsJson(req)) {
    return res.status(404).json({
      success: false,
      message: 'The requested resource was not found.',
    });
  }

  res.status(404).render('error', {
    title: '404 — Page Not Found',
    statusCode: 404,
    message: 'The page you are looking for does not exist or has been moved.',
  });
};

/**
 * 500 — Server Error
 * Catches all thrown errors and renders a generic error page.
 */
const serverError = (err, req, res, next) => {
  // Malformed JSON request body. express.json() / body-parser throws an error
  // tagged `entity.parse.failed` (status 400). Detect it by that stable type,
  // not by message text. API/JSON clients get the standard JSON envelope
  // instead of an HTML error page; we log ONLY a fixed, non-sensitive line —
  // never the parser stack, message, or the (rejected) submitted body.
  if (err && err.type === 'entity.parse.failed') {
    console.error('[ERROR] Malformed JSON request body.');

    if (wantsJson(req)) {
      return res.status(400).json({
        success: false,
        message: 'Malformed JSON request body.',
      });
    }

    return res.status(400).render('error', {
      title: '400 — Bad Request',
      statusCode: 400,
      message: 'Your request could not be processed. Please check it and try again.',
    });
  }

  // Sanitized, fixed log line only — never err.stack / err.message / SQL / the
  // request body. The helper takes no Error object by design (R11).
  logServerError('unhandled', req);

  const statusCode = err && err.status ? err.status : 500;
  const message = 'Something went wrong on our end. Please try again later.';

  // API/JSON callers get the standard envelope; browsers keep the HTML error
  // page. The status code is preserved if an upstream handler tagged err.status,
  // but the message is always generic so no internal detail is exposed.
  if (wantsJson(req)) {
    return res.status(statusCode).json({ success: false, message });
  }

  res.status(statusCode).render('error', {
    title: '500 — Server Error',
    statusCode,
    message,
  });
};

module.exports = { notFound, serverError };
