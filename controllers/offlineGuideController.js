'use strict';

const { createOfflineGuidePackage } = require('../services/offlineGuideService');
const { logServerError } = require('../utils/serverLog');

exports.download = async (req, res) => {
  res.set({
    'Cache-Control': 'no-store, private',
    Pragma: 'no-cache',
    Vary: 'Cookie',
    'X-Content-Type-Options': 'nosniff'
  });
  try {
    const payload = await createOfflineGuidePackage();
    return res.json(payload);
  } catch (err) {
    logServerError('offlineGuide.download', req);
    return res.status(503).json({
      success: false,
      message: 'The offline guide is temporarily unavailable. Please try again later.'
    });
  }
};
