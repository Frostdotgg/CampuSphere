'use strict';

const {
  downloadCurrentAsset,
  guideAssetPath,
  OfflineMapReleaseError
} = require('../services/offlineMapReleaseService');
const { logServerError } = require('../utils/serverLog');

function sendUnavailable(res, req, error) {
  logServerError('offlineMap.asset', req);
  if (error instanceof OfflineMapReleaseError &&
      (error.code === 'OFFLINE_MAP_ASSET_NOT_CURRENT' || error.code === 'OFFLINE_MAP_ASSET_INVALID')) {
    return res.status(404).send('Not found.');
  }
  return res.status(503).send('The offline campus map is temporarily unavailable.');
}

exports.download = async (req, res) => {
  const sha256 = String(req.params.sha256 || '').trim();
  try {
    const expectedPath = guideAssetPath(sha256);
    const result = await downloadCurrentAsset(sha256);
    if (expectedPath !== `/maps/${result.release.asset.name}`) {
      return res.status(404).send('Not found.');
    }
    res.set({
      // The URL contains the verified SHA-256, so this public OSM-derived
      // response is immutable and safe for an edge cache. The browser's
      // explicit `cache: no-store` fetch remains the consent boundary; the
      // service worker never caches this route.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': 'application/vnd.pmtiles',
      'Content-Length': String(result.bytes.length),
      ETag: `"${result.release.asset.sha256}"`,
      'Vercel-CDN-Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff'
    });
    return res.status(200).send(result.bytes);
  } catch (error) {
    return sendUnavailable(res, req, error);
  }
};
