/* ========================================
   CampuSphere — Request Logger Middleware
   Logs every incoming request with timestamp
   ======================================== */

const logger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  // Log the path only — never the query string. OAuth flows carry sensitive
  // values such as ?code=…&state=… in the URL; logging req.originalUrl would
  // persist those to server output. Splitting on the first '?' drops them.
  const pathname = (req.originalUrl || req.url || '').split('?')[0];

  console.log(`[${timestamp}] ${method} ${pathname}`);

  next();
};

module.exports = logger;
