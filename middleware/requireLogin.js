/**
 * Require an authenticated session. Used for routes that must not be anonymous.
 */
module.exports = function requireLogin(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/auth');
};
