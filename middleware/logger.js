/* ========================================
   CampuSphere — Request Logger Middleware
   Logs every incoming request with timestamp
   ======================================== */

const logger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;

  console.log(`[${timestamp}] ${method} ${url}`);

  next();
};

module.exports = logger;
