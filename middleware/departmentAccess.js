'use strict';

const { requireRole } = require('./roleAuth');
const { DEPARTMENT_ADMIN, isDepartment } = require('../utils/departments');
const deny = requireRole('__no_department_access__');

// Match methods and complete paths, never a broad /admin or /api prefix.
function isEditorRequest(method, pathname) {
  if (['GET', 'HEAD'].includes(method) && /^\/admin\/news\/?$/i.test(pathname)) return true;
  if (method === 'POST' && /^\/admin\/api\/(news|events)\/?$/i.test(pathname)) return true;
  return ['PUT', 'DELETE'].includes(method) && /^\/admin\/api\/(news|events)\/[1-9]\d*\/?$/i.test(pathname);
}
function departmentAccess(req, res, next) {
  const user = req.session && req.session.user;
  if (!user || user.role !== DEPARTMENT_ADMIN) return next();
  res.set('Cache-Control', 'no-store, private');
  if (!isDepartment(user.department_code)) return deny(req, res, next);
  if (['GET', 'HEAD'].includes(req.method) && /^\/(auth(?:\/(?:google|callback|complete-registration))?|login|register)\/?$/i.test(req.path)) {
    return res.redirect('/admin/news');
  }
  if (isEditorRequest(req.method, req.path) ||
      (['GET', 'HEAD'].includes(req.method) && req.path === '/auth/csrf-token') ||
      (req.method === 'POST' && ['/logout', '/api/presence/heartbeat'].includes(req.path))) return next();
  return deny(req, res, next);
}
// This gate replaces only the admin router's role gate. All non-editor routes
// still require full Administrator, even when the router is mounted standalone.
function requireAdminArea(req, res, next) {
  const user = req.session && req.session.user;
  if (user && user.role === DEPARTMENT_ADMIN && isDepartment(user.department_code) &&
      isEditorRequest(req.method, req.baseUrl + req.path)) return next();
  return requireRole('admin')(req, res, next);
}
module.exports = { departmentAccess, requireAdminArea, isEditorRequest };
