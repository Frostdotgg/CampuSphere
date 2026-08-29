'use strict';

/*
 * Automatic offline-basemap release boundary.
 *
 * The application never uploads to Google Drive and never receives a Drive
 * OAuth credential. A scheduled publisher writes a signed, public-read-only
 * manifest and immutable PMTiles files. This service reads the manifest,
 * verifies it, and exposes only the currently signed asset to the download
 * controller.
 */

const crypto = require('crypto');

const BASELINE_MANIFEST = require('../public/maps/manifest.json');

const RELEASE_SCHEMA = 'campusphere.offline-basemap-release/1';
const RELEASE_MODE_DRIVE = 'drive';
const RELEASE_MODE_BUNDLED = 'bundled';
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_ASSET_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const MANIFEST_CACHE_MS = 5 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const DRIVE_FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/;
const ASSET_NAME_PATTERN = /^cspc-campus-[a-f0-9]{64}\.pmtiles$/;
const GUIDE_ASSET_PATTERN = /^\/maps\/cspc-campus-[a-f0-9]{64}\.pmtiles$/;
const PMTILES_MAGIC = 'PMTiles';
const EXPECTED_BOUNDS = Object.freeze([123.373606, 13.404852, 123.378745, 13.406981]);
const EXPECTED_CENTER = Object.freeze([123.375604, 13.405885]);
const EXPECTED_MIN_ZOOM = 0;
const EXPECTED_MAX_ZOOM = 15;
const REQUIRED_LAYERS = Object.freeze(['earth', 'landuse', 'water', 'roads', 'buildings']);
const DRIVE_HOSTS = new Set([
  'drive.google.com',
  'drive.usercontent.google.com',
  'www.googleapis.com'
]);

function isApprovedDriveHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return DRIVE_HOSTS.has(host) || host.endsWith('.googleusercontent.com');
}

let cachedRelease = null;
let cachedReleaseExpiresAt = 0;

class OfflineMapReleaseError extends Error {
  constructor(message, code = 'OFFLINE_MAP_RELEASE_INVALID') {
    super(message);
    this.name = 'OfflineMapReleaseError';
    this.code = code;
  }
}

function configuredMode() {
  const mode = String(process.env.OFFLINE_MAP_RELEASE_MODE || RELEASE_MODE_BUNDLED)
    .trim()
    .toLowerCase();
  if (mode !== RELEASE_MODE_DRIVE && mode !== RELEASE_MODE_BUNDLED) {
    throw new OfflineMapReleaseError('Offline map release mode is invalid.', 'OFFLINE_MAP_CONFIG_INVALID');
  }
  return mode;
}

function configuredManifestUrl() {
  return String(process.env.OFFLINE_MAP_MANIFEST_URL || '').trim();
}

function configuredPublicKey() {
  const value = String(process.env.OFFLINE_MAP_SIGNING_PUBLIC_KEY || '').trim();
  return value ? value.replace(/\\n/g, '\n') : '';
}

function isSha256(value) {
  return typeof value === 'string' && SHA256_PATTERN.test(value);
}

function isDriveFileId(value) {
  return typeof value === 'string' && DRIVE_FILE_ID_PATTERN.test(value);
}

function isHttpsDriveUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch (error) {
    return false;
  }
  return parsed.protocol === 'https:' && isApprovedDriveHost(parsed.hostname) &&
    parsed.username === '' && parsed.password === '' &&
    (parsed.port === '' || parsed.port === '443');
}

function assertHttpsDriveUrl(value) {
  if (!isHttpsDriveUrl(value)) {
    throw new OfflineMapReleaseError('Offline map release URL is not an approved Google Drive URL.', 'OFFLINE_MAP_URL_INVALID');
  }
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function exactNumberArray(value, length) {
  return Array.isArray(value) && value.length === length && value.every(finiteNumber);
}

function sameNumbers(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function parseTimestamp(value, field, now) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new OfflineMapReleaseError(`Offline map release ${field} is missing.`, 'OFFLINE_MAP_MANIFEST_INVALID');
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new OfflineMapReleaseError(`Offline map release ${field} is invalid.`, 'OFFLINE_MAP_MANIFEST_INVALID');
  }
  if (parsed > now + MAX_CLOCK_SKEW_MS) {
    throw new OfflineMapReleaseError(`Offline map release ${field} is in the future.`, 'OFFLINE_MAP_MANIFEST_INVALID');
  }
  return new Date(parsed).toISOString();
}

/*
 * The publisher and verifier both construct this object in this exact field
 * order. It is intentionally dependency-free: the signing key protects the
 * Drive manifest from a coordinated public-file replacement, while the
 * browser and proxy independently verify the archive hash.
 */
function canonicalSigningPayload(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new OfflineMapReleaseError('Offline map release manifest is missing.', 'OFFLINE_MAP_MANIFEST_INVALID');
  }
  return JSON.stringify({
    schema: manifest.schema,
    version: manifest.version,
    publishedAt: manifest.publishedAt,
    lastCheckedAt: manifest.lastCheckedAt,
    osmSnapshotAt: manifest.osmSnapshotAt,
    asset: {
      fileId: manifest.asset && manifest.asset.fileId,
      name: manifest.asset && manifest.asset.name,
      bytes: manifest.asset && manifest.asset.bytes,
      sha256: manifest.asset && manifest.asset.sha256
    },
    map: {
      bounds: manifest.map && manifest.map.bounds,
      center: manifest.map && manifest.map.center,
      minzoom: manifest.map && manifest.map.minzoom,
      maxzoom: manifest.map && manifest.map.maxzoom,
      attribution: manifest.map && manifest.map.attribution,
      license: manifest.map && manifest.map.license,
      sourceVersion: manifest.map && manifest.map.sourceVersion,
      layers: manifest.map && manifest.map.layers
    }
  });
}

function verifySignature(manifest, publicKeyPem) {
  if (!publicKeyPem) {
    throw new OfflineMapReleaseError('Offline map signing key is not configured.', 'OFFLINE_MAP_CONFIG_INVALID');
  }
  const signature = manifest.signature && manifest.signature.value;
  if (!manifest.signature || manifest.signature.algorithm !== 'Ed25519' || typeof signature !== 'string' || !signature) {
    throw new OfflineMapReleaseError('Offline map release signature is invalid.', 'OFFLINE_MAP_SIGNATURE_INVALID');
  }
  let publicKey;
  let signatureBytes;
  try {
    publicKey = crypto.createPublicKey(publicKeyPem);
    signatureBytes = Buffer.from(signature, 'base64');
  } catch (error) {
    throw new OfflineMapReleaseError('Offline map release signature is invalid.', 'OFFLINE_MAP_SIGNATURE_INVALID');
  }
  if (!signatureBytes.length || !crypto.verify(null, Buffer.from(canonicalSigningPayload(manifest), 'utf8'), publicKey, signatureBytes)) {
    throw new OfflineMapReleaseError('Offline map release signature did not verify.', 'OFFLINE_MAP_SIGNATURE_INVALID');
  }
}

function validateReleaseManifest(input, options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.schema !== RELEASE_SCHEMA) {
    throw new OfflineMapReleaseError('Offline map release manifest schema is unsupported.', 'OFFLINE_MAP_MANIFEST_INVALID');
  }
  const asset = input.asset;
  const map = input.map;
  if (typeof input.version !== 'string' || !isSha256(input.version) ||
      !asset || typeof asset !== 'object' || Array.isArray(asset) ||
      !isDriveFileId(asset.fileId) || typeof asset.name !== 'string' ||
      !ASSET_NAME_PATTERN.test(asset.name) || asset.name !== `cspc-campus-${input.version}.pmtiles` ||
      !Number.isInteger(asset.bytes) || asset.bytes < 1 || asset.bytes > MAX_ASSET_BYTES ||
      !isSha256(asset.sha256) || asset.sha256 !== input.version ||
      !map || typeof map !== 'object' || Array.isArray(map)) {
    throw new OfflineMapReleaseError('Offline map release asset identity is invalid.', 'OFFLINE_MAP_MANIFEST_INVALID');
  }

  const publishedAt = parseTimestamp(input.publishedAt, 'publishedAt', now);
  const lastCheckedAt = parseTimestamp(input.lastCheckedAt, 'lastCheckedAt', now);
  const osmSnapshotAt = parseTimestamp(input.osmSnapshotAt, 'osmSnapshotAt', now);
  if (!exactNumberArray(map.bounds, 4) || !sameNumbers(map.bounds, EXPECTED_BOUNDS) ||
      !exactNumberArray(map.center, 2) || !sameNumbers(map.center, EXPECTED_CENTER) ||
      map.minzoom !== EXPECTED_MIN_ZOOM || map.maxzoom !== EXPECTED_MAX_ZOOM ||
      typeof map.attribution !== 'string' || !/OpenStreetMap/i.test(map.attribution) ||
      typeof map.license !== 'string' || !/ODbL/i.test(map.license) ||
      typeof map.sourceVersion !== 'string' || !map.sourceVersion.trim() ||
      !Array.isArray(map.layers) || REQUIRED_LAYERS.some((layer) => !map.layers.includes(layer))) {
    throw new OfflineMapReleaseError('Offline map release geometry or layer metadata is invalid.', 'OFFLINE_MAP_MANIFEST_INVALID');
  }

  verifySignature(input, options.publicKeyPem || configuredPublicKey());

  return {
    schema: RELEASE_SCHEMA,
    version: input.version,
    publishedAt,
    lastCheckedAt,
    osmSnapshotAt,
    asset: {
      fileId: asset.fileId,
      name: asset.name,
      bytes: asset.bytes,
      sha256: asset.sha256
    },
    map: {
      bounds: map.bounds.slice(),
      center: map.center.slice(),
      minzoom: map.minzoom,
      maxzoom: map.maxzoom,
      attribution: map.attribution,
      license: map.license,
      sourceVersion: map.sourceVersion,
      layers: map.layers.slice()
    },
    signature: {
      algorithm: 'Ed25519',
      value: input.signature.value
    }
  };
}

function baselineRelease() {
  const sha256 = BASELINE_MANIFEST.sha256;
  return {
    schema: RELEASE_SCHEMA,
    version: sha256,
    publishedAt: null,
    lastCheckedAt: null,
    osmSnapshotAt: null,
    asset: {
      fileId: null,
      name: BASELINE_MANIFEST.asset.split('/').pop(),
      bytes: BASELINE_MANIFEST.bytes,
      sha256
    },
    map: {
      bounds: BASELINE_MANIFEST.bounds.slice(),
      center: BASELINE_MANIFEST.center.slice(),
      minzoom: BASELINE_MANIFEST.minzoom,
      maxzoom: BASELINE_MANIFEST.maxzoom,
      attribution: BASELINE_MANIFEST.attribution,
      license: BASELINE_MANIFEST.license,
      sourceVersion: BASELINE_MANIFEST.source && BASELINE_MANIFEST.source.version
        ? BASELINE_MANIFEST.source.version
        : 'bundled',
      layers: REQUIRED_LAYERS.slice()
    },
    signature: null
  };
}

function guideBasemapFromRelease(release) {
  return {
    asset: `/maps/cspc-campus-${release.asset.sha256}.pmtiles`,
    bytes: release.asset.bytes,
    sha256: release.asset.sha256,
    bounds: release.map.bounds.slice(),
    center: release.map.center.slice(),
    minzoom: release.map.minzoom,
    maxzoom: release.map.maxzoom,
    attribution: release.map.attribution,
    version: release.version,
    publishedAt: release.publishedAt,
    lastCheckedAt: release.lastCheckedAt,
    osmSnapshotAt: release.osmSnapshotAt,
    sourceVersion: release.map.sourceVersion
  };
}

function clearReleaseCache() {
  cachedRelease = null;
  cachedReleaseExpiresAt = 0;
}

function responseHeader(response, name) {
  if (!response || !response.headers || typeof response.headers.get !== 'function') return null;
  return response.headers.get(name);
}

async function readResponseBytes(response, maxBytes) {
  const declaredLength = Number(responseHeader(response, 'content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new OfflineMapReleaseError('Offline map release response exceeds its size limit.', 'OFFLINE_MAP_RESPONSE_TOO_LARGE');
  }
  if (response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        const chunk = Buffer.from(part.value);
        total += chunk.length;
        if (total > maxBytes) {
          try { await reader.cancel(); } catch (error) { /* response is already rejected */ }
          throw new OfflineMapReleaseError('Offline map release response exceeds its size limit.', 'OFFLINE_MAP_RESPONSE_TOO_LARGE');
        }
        chunks.push(chunk);
      }
    } finally {
      try { reader.releaseLock(); } catch (error) { /* reader may already be closed */ }
    }
    return Buffer.concat(chunks, total);
  }
  if (!response || typeof response.arrayBuffer !== 'function') {
    throw new OfflineMapReleaseError('Offline map release response body is unavailable.', 'OFFLINE_MAP_RESPONSE_INVALID');
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) {
    throw new OfflineMapReleaseError('Offline map release response exceeds its size limit.', 'OFFLINE_MAP_RESPONSE_TOO_LARGE');
  }
  return bytes;
}

async function fetchDriveBytes(url, maxBytes, options = {}) {
  assertHttpsDriveUrl(url);
  const fetchImpl = options.fetchImpl || global.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new OfflineMapReleaseError('Offline map release networking is unavailable.', 'OFFLINE_MAP_NETWORK_UNAVAILABLE');
  }
  const timeoutMs = Number.isInteger(options.timeoutMs) ? options.timeoutMs : 15000;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  let current = new URL(url);
  try {
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      let response;
      try {
        response = await fetchImpl(current.toString(), {
          method: 'GET',
          redirect: 'manual',
          headers: Object.assign({ Accept: '*/*', 'Cache-Control': 'no-cache' }, options.headers || {}),
          signal: controller ? controller.signal : undefined
        });
      } catch (error) {
        throw new OfflineMapReleaseError('Offline map release download failed.', 'OFFLINE_MAP_NETWORK_UNAVAILABLE');
      }
      if (response.status >= 300 && response.status < 400) {
        const location = responseHeader(response, 'location');
        if (!location || redirectCount === MAX_REDIRECTS) {
          throw new OfflineMapReleaseError('Offline map release redirect chain is invalid.', 'OFFLINE_MAP_REDIRECT_INVALID');
        }
        let next;
        try { next = new URL(location, current); } catch (error) { next = null; }
        if (!next || !isHttpsDriveUrl(next.toString())) {
          throw new OfflineMapReleaseError('Offline map release redirect target is not approved.', 'OFFLINE_MAP_REDIRECT_INVALID');
        }
        current = next;
        continue;
      }
      if (response.status !== 200) {
        throw new OfflineMapReleaseError('Offline map release server returned an unavailable response.', 'OFFLINE_MAP_REMOTE_UNAVAILABLE');
      }
      return await readResponseBytes(response, maxBytes);
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
  throw new OfflineMapReleaseError('Offline map release redirect chain is invalid.', 'OFFLINE_MAP_REDIRECT_INVALID');
}

async function fetchDriveManifest(options = {}) {
  const url = configuredManifestUrl();
  if (!url) throw new OfflineMapReleaseError('Offline map release manifest is not configured.', 'OFFLINE_MAP_CONFIG_INVALID');
  const bytes = await fetchDriveBytes(url, MAX_MANIFEST_BYTES, {
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs || 10000
  });
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new OfflineMapReleaseError('Offline map release manifest is not valid JSON.', 'OFFLINE_MAP_MANIFEST_INVALID');
  }
  return validateReleaseManifest(parsed, {
    now: options.now,
    publicKeyPem: options.publicKeyPem || configuredPublicKey()
  });
}

async function getCurrentRelease(options = {}) {
  const mode = configuredMode();
  if (mode === RELEASE_MODE_BUNDLED) return baselineRelease();
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  if (!options.fetchImpl && cachedRelease && cachedReleaseExpiresAt > now) return cachedRelease;
  const release = await fetchDriveManifest(options);
  if (!options.fetchImpl) {
    cachedRelease = release;
    cachedReleaseExpiresAt = now + MANIFEST_CACHE_MS;
  }
  return release;
}

function publicDriveAssetUrl(fileId) {
  if (!isDriveFileId(fileId)) {
    throw new OfflineMapReleaseError('Offline map release file identity is invalid.', 'OFFLINE_MAP_MANIFEST_INVALID');
  }
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
}

function guideAssetPath(sha256) {
  if (!isSha256(sha256)) {
    throw new OfflineMapReleaseError('Offline map asset identity is invalid.', 'OFFLINE_MAP_ASSET_INVALID');
  }
  return `/maps/cspc-campus-${sha256}.pmtiles`;
}

async function downloadCurrentAsset(sha256, options = {}) {
  if (!isSha256(sha256)) {
    throw new OfflineMapReleaseError('Offline map asset identity is invalid.', 'OFFLINE_MAP_ASSET_INVALID');
  }
  const release = await getCurrentRelease(options);
  if (!release.asset.fileId || release.asset.sha256 !== sha256) {
    throw new OfflineMapReleaseError('Offline map asset is not the current release.', 'OFFLINE_MAP_ASSET_NOT_CURRENT');
  }
  const bytes = await fetchDriveBytes(publicDriveAssetUrl(release.asset.fileId), MAX_ASSET_BYTES, {
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs || 30000
  });
  if (bytes.length !== release.asset.bytes || crypto.createHash('sha256').update(bytes).digest('hex') !== release.asset.sha256 ||
      bytes.subarray(0, PMTILES_MAGIC.length).toString('ascii') !== PMTILES_MAGIC) {
    throw new OfflineMapReleaseError('Offline map release bytes failed validation.', 'OFFLINE_MAP_ASSET_INVALID');
  }
  return { release, bytes };
}

module.exports = {
  RELEASE_SCHEMA,
  RELEASE_MODE_DRIVE,
  RELEASE_MODE_BUNDLED,
  MAX_MANIFEST_BYTES,
  MAX_ASSET_BYTES,
  GUIDE_ASSET_PATTERN,
  REQUIRED_LAYERS,
  EXPECTED_BOUNDS,
  EXPECTED_CENTER,
  OfflineMapReleaseError,
  canonicalSigningPayload,
  validateReleaseManifest,
  baselineRelease,
  guideBasemapFromRelease,
  clearReleaseCache,
  fetchDriveBytes,
  fetchDriveManifest,
  getCurrentRelease,
  publicDriveAssetUrl,
  guideAssetPath,
  downloadCurrentAsset
};
