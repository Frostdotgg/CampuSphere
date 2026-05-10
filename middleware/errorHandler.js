/* ========================================
   CampuSphere — Error Handling Middleware
   Handles 404 (Not Found) and 500 (Server Error)
   ======================================== */

/**
 * 404 — Not Found
 * Catches all unmatched routes and renders the error page.
 */
const notFound = (req, res, next) => {
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
  console.error(`[ERROR] ${err.stack || err.message}`);

  res.status(err.status || 500).render('error', {
    title: '500 — Server Error',
    statusCode: err.status || 500,
    message: 'Something went wrong on our end. Please try again later.',
  });
};

module.exports = { notFound, serverError };
