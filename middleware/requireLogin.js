/**
 * Compatibility re-export. `roleAuth.js` is the single source of truth for
 * auth middleware — this file remains so legacy `require('../middleware/requireLogin')`
 * imports keep working.
 */
const { requireLogin } = require('./roleAuth');
module.exports = requireLogin;
