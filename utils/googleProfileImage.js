'use strict';

/*
 * Google profile-picture URL policy.
 *
 * Google returns the picture URL as part of the already-authenticated
 * userinfo response.  Keep the value bounded to the existing users column and
 * allow only HTTPS googleusercontent subdomains before it is stored or placed
 * in a session.  The browser still treats the value as an image-only URL via
 * CSP; this helper never fetches or proxies the image.
 */

const GOOGLE_PROFILE_IMAGE_MAX = 255;
const GOOGLEUSERCONTENT_HOST_SUFFIX = '.googleusercontent.com';

function isGoogleProfileImageUrl(value) {
  if (typeof value !== 'string') return false;
  const candidate = value.trim();
  if (!candidate || candidate.length > GOOGLE_PROFILE_IMAGE_MAX) return false;

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch (err) {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;
  if (parsed.username !== '' || parsed.password !== '') return false;
  if (parsed.port !== '') return false;

  const host = parsed.hostname.toLowerCase();
  if (!host.endsWith(GOOGLEUSERCONTENT_HOST_SUFFIX) || host === GOOGLEUSERCONTENT_HOST_SUFFIX.slice(1)) {
    return false;
  }

  // WHATWG URL normalizes :443 away. Reject an explicit port/userinfo in the
  // original authority as well, so the accepted form stays canonical.
  const schemeSeparator = candidate.indexOf('://');
  if (schemeSeparator === -1) return false;
  const authority = candidate.slice(schemeSeparator + 3).split(/[/?#]/, 1)[0];
  if (authority.indexOf(':') !== -1 || authority.indexOf('@') !== -1) return false;

  return true;
}

function normalizeGoogleProfileImageUrl(value) {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  return isGoogleProfileImageUrl(candidate) ? candidate : null;
}

module.exports = {
  GOOGLE_PROFILE_IMAGE_MAX,
  isGoogleProfileImageUrl,
  normalizeGoogleProfileImageUrl
};
