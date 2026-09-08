'use strict';

/*
 * CampuSphere media delivery controller.
 *
 * Administrators store a validated Google Drive share URL in the existing
 * image_url column. Browser consumers receive a same-origin URL instead, and
 * this endpoint fetches only the file id/resource key extracted by the shared
 * media policy. No Drive OAuth credentials or management API are used.
 */

const {
  GOOGLE_DRIVE_FILE_ID_RE,
  GOOGLE_DRIVE_RESOURCE_KEY_RE
} = require('../utils/mediaUrl');

const MAX_BYTES = 50 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 4;
const DRIVE_HOST = 'drive.google.com';
const DRIVE_USERCONTENT_HOST = 'drive.usercontent.google.com';

function scalarQuery(value, pattern) {
  if (value === undefined) return { ok: true, value: '' };
  if (Array.isArray(value) || typeof value !== 'string') return { ok: false, value: '' };
  const trimmed = value.trim();
  if (trimmed === '') return { ok: true, value: '' };
  return { ok: pattern.test(trimmed), value: trimmed };
}

function safeGoogleHost(hostname) {
  if (hostname === DRIVE_HOST || hostname === DRIVE_USERCONTENT_HOST) return true;
  // Google may redirect a public blob to a signed googleusercontent host. The
  // suffix check requires a label boundary and never accepts look-alike hosts.
  return hostname.endsWith('.googleusercontent.com') && hostname.length > '.googleusercontent.com'.length;
}

function safeRedirectUrl(raw, base) {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  let url;
  try { url = new URL(raw, base); } catch (error) { return null; }
  if (url.protocol !== 'https:' || !safeGoogleHost(url.hostname) ||
      url.username !== '' || url.password !== '' || url.port !== '' || url.hash !== '') {
    return null;
  }
  return url;
}

function buildDriveDownloadUrl(fileId, resourceKey) {
  if (typeof fileId !== 'string' || !GOOGLE_DRIVE_FILE_ID_RE.test(fileId)) return null;
  if (resourceKey !== '' && !GOOGLE_DRIVE_RESOURCE_KEY_RE.test(resourceKey)) return null;
  const url = new URL('https://' + DRIVE_HOST + '/uc');
  url.searchParams.set('export', 'download');
  url.searchParams.set('id', fileId);
  if (resourceKey) url.searchParams.set('resourcekey', resourceKey);
  return url;
}

function timeoutSignal(ms) {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms).unref?.();
  return controller.signal;
}

async function fetchFollowingApprovedRedirects(startUrl) {
  let current = startUrl;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(current.href, {
      method: 'GET',
      redirect: 'manual',
      signal: timeoutSignal(FETCH_TIMEOUT_MS),
      headers: { Accept: 'image/jpeg,image/png,image/webp,application/octet-stream;q=0.8' }
    });
    if (response.status < 300 || response.status >= 400) return response;
    if (redirects === MAX_REDIRECTS) return null;
    const location = response.headers.get('location');
    const next = safeRedirectUrl(location, current.href);
    if (!next) return null;
    if (response.body && typeof response.body.cancel === 'function') {
      response.body.cancel().catch(() => {});
    }
    current = next;
  }
  return null;
}

async function readBodyWithLimit(response) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    const error = new Error('oversize');
    error.code = 'MEDIA_TOO_LARGE';
    throw error;
  }
  if (!response.body) return Buffer.alloc(0);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BYTES) {
      const error = new Error('oversize');
      error.code = 'MEDIA_TOO_LARGE';
      throw error;
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, size);
}

function sniffImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', extension: 'png' };
  }
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { mime: 'image/webp', extension: 'webp' };
  }
  return null;
}

function imageTypeForResponse(header, signature) {
  if (!signature) return null;
  const value = String(header || '').split(';', 1)[0].trim().toLowerCase();
  if (value === '' || value === 'application/octet-stream' || value === 'binary/octet-stream' || value === 'image/*') {
    return signature;
  }
  if (value === signature.mime || (signature.mime === 'image/jpeg' && value === 'image/jpg')) {
    return signature;
  }
  return null;
}

function unavailable(res, status = 404) {
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  return res.status(status).send('Media unavailable.');
}

exports.googleDrive = async (req, res) => {
  const fileId = typeof req.params.fileId === 'string' ? req.params.fileId.trim() : '';
  const key = scalarQuery(req.query && req.query.resourcekey, GOOGLE_DRIVE_RESOURCE_KEY_RE);
  if (!GOOGLE_DRIVE_FILE_ID_RE.test(fileId) || !key.ok) return unavailable(res, 404);

  const target = buildDriveDownloadUrl(fileId, key.value);
  if (!target) return unavailable(res, 404);

  try {
    const upstream = await fetchFollowingApprovedRedirects(target);
    if (!upstream || !upstream.ok) return unavailable(res, upstream && upstream.status === 404 ? 404 : 502);
    const bytes = await readBodyWithLimit(upstream);
    const type = imageTypeForResponse(upstream.headers.get('content-type'), sniffImage(bytes));
    if (!type) return unavailable(res, 415);

    res.status(200);
    res.set('Content-Type', type.mime);
    res.set('Content-Length', String(bytes.length));
    res.set('Content-Disposition', 'inline');
    res.set('Cache-Control', 'private, max-age=300');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cross-Origin-Resource-Policy', 'same-origin');
    return res.send(bytes);
  } catch (error) {
    if (error && error.code === 'MEDIA_TOO_LARGE') return unavailable(res, 413);
    return unavailable(res, 502);
  }
};

// Pure seams for the focused media policy probe. They do not expose secrets or
// perform a network request unless googleDrive() itself is invoked.
exports._buildDriveDownloadUrl = buildDriveDownloadUrl;
exports._safeRedirectUrl = safeRedirectUrl;
exports._sniffImage = sniffImage;
exports._imageTypeForResponse = imageTypeForResponse;
exports._MAX_BYTES = MAX_BYTES;
