'use strict';

const notificationFeedService = require('../services/notificationFeedService');
const { logServerError } = require('../utils/serverLog');

exports.index = async (req, res) => {
  res.set('Cache-Control', 'no-store, private');
  try {
    const role = req.session && req.session.user ? req.session.user.role : '';
    const feed = await notificationFeedService.loadNotificationFeed(role);
    return res.json({ success: true, ...feed });
  } catch (error) {
    logServerError('notifications.feed', req);
    return res.status(503).json({
      success: false,
      message: 'Notifications are temporarily unavailable.'
    });
  }
};
