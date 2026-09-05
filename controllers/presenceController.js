'use strict';

/* ========================================
   CampuSphere — User Presence Controller
   ======================================== */

const presenceService = require('../services/userPresenceService');

function jsonFailure(res, status, message) {
  return res.status(status).json({ success: false, message });
}

/** POST /api/presence/heartbeat — authenticated, CSRF-protected heartbeat. */
exports.heartbeat = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const user = req.session && req.session.user;
  if (!user) return jsonFailure(res, 401, 'Authentication required.');

  try {
    await presenceService.touchUserPresence(user.id);
    return res.status(204).end();
  } catch (error) {
    // Keep the response fixed and free of SQL, host, credential, or stack data.
    console.error('User presence heartbeat failed.');
    return jsonFailure(res, 503, 'Presence is temporarily unavailable.');
  }
};
/** GET /admin/api/users/presence — one batched, admin-only snapshot. */
exports.adminSnapshot = async (_req, res) => {
  res.set('Cache-Control', 'no-store, private');
  try {
    const snapshot = await presenceService.getAdminSnapshot(new Date());
    return res.status(200).json(snapshot);
  } catch (error) {
    console.error('User presence snapshot failed.');
    return jsonFailure(res, 503, 'Presence is temporarily unavailable.');
  }
};
