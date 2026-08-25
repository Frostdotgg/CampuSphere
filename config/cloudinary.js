/* ========================================
   CampuSphere — Cloudinary delivery boundary

   Cloudinary is an optional media-delivery host for campus images and 360° VR
   panoramas. Administrators paste validated delivery URLs and public IDs; the
   application does not upload, delete, transform, or manage Cloudinary assets.

   This module exposes only the approved delivery host and origin. It never
   reads vendor credentials and is safe to require from server-only URL/CSP
   helpers. Local /img/* and /img/vr/* fallbacks remain valid when no remote
   asset is configured.
   ======================================== */

const CLOUDINARY_DELIVERY_HOST = 'res.cloudinary.com';
const CLOUDINARY_DELIVERY_ORIGIN = 'https://' + CLOUDINARY_DELIVERY_HOST;

module.exports = {
  CLOUDINARY_DELIVERY_HOST,
  CLOUDINARY_DELIVERY_ORIGIN,
};
