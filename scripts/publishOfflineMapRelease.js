'use strict';

/*
 * Scheduled offline-basemap publisher.
 *
 * This script is intended for a GitHub Actions runner, never for the CampuSphere
 * web runtime. It extracts the CSPC rectangle from an official Protomaps daily
 * build, validates the bounded PMTiles archive, uploads an immutable archive to
 * the owner's Google Drive, and moves one small signed manifest pointer only
 * after the public archive has been anonymously verified. All Drive credentials
 * are read from CI secrets and are deliberately never printed.
 */

const crypto = require('crypto');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const {
  RELEASE_SCHEMA,
  MAX_ASSET_BYTES,
  REQUIRED_LAYERS,
  EXPECTED_BOUNDS,
  EXPECTED_CENTER,
  OfflineMapReleaseError,
  canonicalSigningPayload,
  validateReleaseManifest,
  fetchDriveBytes,
  publicDriveAssetUrl
} = require('../services/offlineMapReleaseService');

const PMTILES_VERSION = '1.31.2';
const DEFAULT_SOURCE_BASE = 'https://build.protomaps.com';
const DEFAULT_SOURCE_VERSION = '4.15.2';
const DEFAULT_LOOKBACK_DAYS = 7;
const KEEP_RELEASES = 7;
const BBOX = EXPECTED_BOUNDS.slice();
const MAX_COMMAND_OUTPUT = 512 * 1024;
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const PMTILES_MAGIC = Buffer.from('PMTiles', 'ascii');
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DRIVE_ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/;

class PublisherError extends Error {
  constructor(message, code = 'OFFLINE_MAP_PUBLISH_FAILED', status = null) {
    super(message);
    this.name = 'PublisherError';
    this.code = code;
    this.status = status;
  }
}

function env(name, { required = true, fallback = '' } = {}) {
  const value = String(process.env[name] || fallback).trim();
  if (required && !value) throw new PublisherError('Offline map publisher configuration is incomplete.', 'OFFLINE_MAP_CONFIG_INVALID');
  return value;
}

function pemEnv(name) {
  const value = env(name);
  return value.replace(/\\n/g, '\n');
}

function isSha256(value) {
  return typeof value === 'string' && SHA256_PATTERN.test(value);
}

function assertSha256(value) {
  if (!isSha256(value)) throw new PublisherError('Offline map release version is invalid.', 'OFFLINE_MAP_VERSION_INVALID');
  return value;
}

function assertDriveId(value) {
  if (typeof value !== 'string' || !DRIVE_ID_PATTERN.test(value)) {
    throw new PublisherError('Offline map Drive identity is invalid.', 'OFFLINE_MAP_CONFIG_INVALID');
  }
  return value;
}

function configured() {
  const bootstrap = String(process.env.OFFLINE_MAP_BOOTSTRAP || '').trim().toLowerCase() === 'true' ||
    String(process.env.OFFLINE_MAP_BOOTSTRAP || '').trim() === '1';
  const base = {
    clientId: env('OFFLINE_MAP_GOOGLE_CLIENT_ID'),
    clientSecret: env('OFFLINE_MAP_GOOGLE_CLIENT_SECRET'),
    refreshToken: env('OFFLINE_MAP_GOOGLE_REFRESH_TOKEN')
  };
  if (bootstrap) {
    const parentId = env('OFFLINE_MAP_DRIVE_PARENT_ID', { required: false });
    return Object.assign(base, {
      bootstrap: true,
      parentId: parentId ? assertDriveId(parentId) : '',
      folderId: '',
      manifestFileId: '',
      publicManifestUrl: '',
      signingPrivateKey: '',
      pmtilesBinary: '',
      sourceBase: '',
      sourceVersion: '',
      lookbackDays: 0,
      requestedDate: '',
      rollbackVersion: ''
    });
  }
  const folderId = assertDriveId(env('OFFLINE_MAP_DRIVE_FOLDER_ID'));
  const manifestFileId = assertDriveId(env('OFFLINE_MAP_DRIVE_MANIFEST_FILE_ID'));
  return Object.assign(base, {
    folderId,
    manifestFileId,
    publicManifestUrl: env('OFFLINE_MAP_PUBLIC_MANIFEST_URL'),
    signingPrivateKey: pemEnv('OFFLINE_MAP_SIGNING_PRIVATE_KEY'),
    pmtilesBinary: env('PMTILES_BIN', { required: false, fallback: 'pmtiles' }),
    sourceBase: env('PROTOMAPS_SOURCE_BASE', { required: false, fallback: DEFAULT_SOURCE_BASE }).replace(/\/$/, ''),
    sourceVersion: env('PROTOMAPS_SOURCE_VERSION', { required: false, fallback: DEFAULT_SOURCE_VERSION }),
    lookbackDays: Math.min(14, Math.max(1, Number.parseInt(env('PROTOMAPS_LOOKBACK_DAYS', { required: false, fallback: String(DEFAULT_LOOKBACK_DAYS) }), 10) || DEFAULT_LOOKBACK_DAYS)),
    requestedDate: env('PROTOMAPS_BUILD_DATE', { required: false }),
    rollbackVersion: env('OFFLINE_MAP_ROLLBACK_VERSION', { required: false })
  });
}

function publicKeyFromPrivate(privatePem) {
  try {
    return crypto.createPublicKey(crypto.createPrivateKey(privatePem)).export({ type: 'spki', format: 'pem' }).toString();
  } catch (error) {
    throw new PublisherError('Offline map signing key is invalid.', 'OFFLINE_MAP_CONFIG_INVALID');
  }
}

function responseHeader(response, name) {
  return response && response.headers && typeof response.headers.get === 'function'
    ? response.headers.get(name)
    : null;
}

async function readResponseBytes(response, maxBytes) {
  const declaredLength = Number(responseHeader(response, 'content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new PublisherError('Remote response exceeded its size limit.', 'OFFLINE_MAP_RESPONSE_TOO_LARGE');
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
          try { await reader.cancel(); } catch (error) { /* already rejected */ }
          throw new PublisherError('Remote response exceeded its size limit.', 'OFFLINE_MAP_RESPONSE_TOO_LARGE');
        }
        chunks.push(chunk);
      }
    } finally {
      try { reader.releaseLock(); } catch (error) { /* reader may already be closed */ }
    }
    return Buffer.concat(chunks, total);
  }
  if (!response || typeof response.arrayBuffer !== 'function') {
    throw new PublisherError('Remote response body was unavailable.', 'OFFLINE_MAP_RESPONSE_INVALID');
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxBytes) throw new PublisherError('Remote response exceeded its size limit.', 'OFFLINE_MAP_RESPONSE_TOO_LARGE');
  return bytes;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, Object.assign({}, options, {
      redirect: options.redirect || 'manual',
      signal: controller.signal
    }));
  } catch (error) {
    throw new PublisherError('Remote map release request failed.', 'OFFLINE_MAP_NETWORK_UNAVAILABLE');
  } finally {
    clearTimeout(timer);
  }
}

function parseJsonObject(text, label) {
  const source = String(text || '').trim();
  const first = source.indexOf('{');
  const last = source.lastIndexOf('}');
  if (first < 0 || last <= first) throw new PublisherError(`${label} metadata was invalid.`, 'OFFLINE_MAP_SOURCE_INVALID');
  try {
    const value = JSON.parse(source.slice(first, last + 1));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object');
    return value;
  } catch (error) {
    throw new PublisherError(`${label} metadata was invalid.`, 'OFFLINE_MAP_SOURCE_INVALID');
  }
}

function commandOutputLimit(value) {
  const text = String(value || '');
  return text.length > MAX_COMMAND_OUTPUT ? `${text.slice(0, MAX_COMMAND_OUTPUT)}…` : text;
}

function runCommand(binary, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    child.stdout.on('data', (chunk) => {
      if (stdoutBytes < MAX_COMMAND_OUTPUT) {
        stdout.push(chunk);
        stdoutBytes += chunk.length;
      }
    });
    child.stderr.on('data', (chunk) => {
      if (stderrBytes < MAX_COMMAND_OUTPUT) {
        stderr.push(chunk);
        stderrBytes += chunk.length;
      }
    });
    child.once('error', () => reject(new PublisherError('The PMTiles tool could not be started.', 'OFFLINE_MAP_TOOL_UNAVAILABLE')));
    child.once('close', (code) => {
      const result = {
        code,
        stdout: commandOutputLimit(Buffer.concat(stdout).toString('utf8')),
        stderr: commandOutputLimit(Buffer.concat(stderr).toString('utf8'))
      };
      if (code !== 0) reject(new PublisherError('The PMTiles command failed.', 'OFFLINE_MAP_TOOL_FAILED'));
      else resolve(result);
    });
  });
}

function formatSourceDate(date) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString();
  return value;
}

function dateFromYyyyMmDd(value) {
  if (!DATE_PATTERN.test(value)) throw new PublisherError('The Protomaps build date is invalid.', 'OFFLINE_MAP_SOURCE_INVALID');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new PublisherError('The Protomaps build date is invalid.', 'OFFLINE_MAP_SOURCE_INVALID');
  }
  return date;
}

function sourceFileUrl(sourceBase, date) {
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `${sourceBase}/${stamp}.pmtiles`;
}

async function sourceExists(url) {
  let response = await fetchWithTimeout(url, { method: 'HEAD', headers: { Accept: '*/*' } }, 20000);
  if (response.status === 405) {
    response = await fetchWithTimeout(url, { method: 'GET', headers: { Range: 'bytes=0-0', Accept: '*/*' } }, 20000);
    try { if (response.body && typeof response.body.cancel === 'function') await response.body.cancel(); } catch (error) { /* best effort */ }
  }
  if (response.status === 200 || response.status === 206) return true;
  if (response.status === 404) return false;
  throw new PublisherError('The latest Protomaps source could not be checked.', 'OFFLINE_MAP_SOURCE_UNAVAILABLE');
}

async function findLatestSource(config) {
  const start = config.requestedDate
    ? dateFromYyyyMmDd(config.requestedDate)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);
  for (let offset = 0; offset <= config.lookbackDays; offset += 1) {
    const date = new Date(start.getTime() - offset * 24 * 60 * 60 * 1000);
    const url = sourceFileUrl(config.sourceBase, date);
    if (await sourceExists(url)) return { url, date };
  }
  throw new PublisherError('No recent Protomaps daily build was available.', 'OFFLINE_MAP_SOURCE_UNAVAILABLE');
}

function metadataLayerIds(metadata) {
  const values = Array.isArray(metadata.vector_layers)
    ? metadata.vector_layers
    : (Array.isArray(metadata.layers) ? metadata.layers : []);
  return values.map((entry) => {
    if (typeof entry === 'string') return entry;
    return entry && (entry.id || entry.name);
  }).filter((value) => typeof value === 'string');
}

async function extractAndValidate(config, source, outputPath, tempDir) {
  await runCommand(config.pmtilesBinary, [
    'extract', source.url, outputPath,
    `--bbox=${BBOX.join(',')}`,
    '--maxzoom=15'
  ], tempDir);
  await runCommand(config.pmtilesBinary, ['verify', outputPath], tempDir);
  const stat = await fsp.stat(outputPath);
  if (!Number.isInteger(stat.size) || stat.size < PMTILES_MAGIC.length || stat.size > MAX_ASSET_BYTES) {
    throw new PublisherError('The extracted offline map exceeded its size boundary.', 'OFFLINE_MAP_ASSET_INVALID');
  }
  const handle = await fsp.open(outputPath, 'r');
  const magic = Buffer.alloc(PMTILES_MAGIC.length);
  try { await handle.read(magic, 0, magic.length, 0); } finally { await handle.close(); }
  if (!magic.equals(PMTILES_MAGIC)) throw new PublisherError('The extracted archive was not PMTiles.', 'OFFLINE_MAP_ASSET_INVALID');
  const bytes = await fsp.readFile(outputPath);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const metadataResult = await runCommand(config.pmtilesBinary, ['show', outputPath, '--metadata'], tempDir);
  const metadata = parseJsonObject(metadataResult.stdout, 'PMTiles');
  const layers = metadataLayerIds(metadata);
  if (REQUIRED_LAYERS.some((layer) => !layers.includes(layer))) {
    throw new PublisherError('The extracted archive is missing a required map layer.', 'OFFLINE_MAP_ASSET_INVALID');
  }
  return { bytes, sha256, layers };
}

function driveFileId(value) {
  return assertDriveId(String(value || '').trim());
}

async function getAccessToken(config) {
  const response = await fetchWithTimeout(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token'
    })
  }, 20000);
  if (!response.ok) throw new PublisherError('The Google Drive publisher could not obtain an access token.', 'OFFLINE_MAP_DRIVE_AUTH_FAILED', response.status);
  const body = await readResponseBytes(response, 32 * 1024);
  let parsed;
  try { parsed = JSON.parse(body.toString('utf8')); } catch (error) { parsed = null; }
  if (!parsed || typeof parsed.access_token !== 'string' || !parsed.access_token) {
    throw new PublisherError('The Google Drive publisher could not obtain an access token.', 'OFFLINE_MAP_DRIVE_AUTH_FAILED');
  }
  return parsed.access_token;
}

function createDriveClient(config) {
  let tokenPromise = null;
  async function token() {
    if (!tokenPromise) tokenPromise = getAccessToken(config);
    return tokenPromise;
  }
  async function requestAt(base, apiPath, options = {}) {
    const accessToken = await token();
    const headers = Object.assign({}, options.headers || {}, {
      Authorization: `Bearer ${accessToken}`
    });
    const response = await fetchWithTimeout(`${base}${apiPath}`, Object.assign({}, options, { headers }), 30000);
    if (!response.ok) throw new PublisherError('The Google Drive request failed.', 'OFFLINE_MAP_DRIVE_REQUEST_FAILED', response.status);
    return response;
  }
  return {
    request: (apiPath, options) => requestAt(DRIVE_API_BASE, apiPath, options),
    uploadRequest: (apiPath, options) => requestAt(DRIVE_UPLOAD_BASE, apiPath, options)
  };
}

async function driveJson(client, apiPath, options = {}, requestMethod = 'request') {
  const request = client && client[requestMethod];
  if (typeof request !== 'function') {
    throw new PublisherError('The Google Drive request client is unavailable.', 'OFFLINE_MAP_DRIVE_REQUEST_FAILED');
  }
  const response = await request.call(client, apiPath, options);
  const body = await readResponseBytes(response, 512 * 1024);
  try { return JSON.parse(body.toString('utf8')); } catch (error) {
    throw new PublisherError('The Google Drive response was invalid.', 'OFFLINE_MAP_DRIVE_RESPONSE_INVALID');
  }
}

async function driveMedia(client, fileId, maxBytes) {
  const response = await client.request(`/files/${encodeURIComponent(fileId)}?alt=media`, {
    method: 'GET',
    headers: { Accept: '*/*' }
  });
  return readResponseBytes(response, maxBytes);
}

async function driveList(client, folderId) {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    spaces: 'drive',
    pageSize: '1000',
    fields: 'files(id,name,size,createdTime,modifiedTime,appProperties,mimeType)'
  });
  const body = await driveJson(client, `/files?${params.toString()}`, { method: 'GET', headers: { Accept: 'application/json' } });
  return Array.isArray(body.files) ? body.files : [];
}

function multipartBody(metadata, bytes) {
  const boundary = `campusphere_${crypto.randomBytes(12).toString('hex')}`;
  const prefix = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`, 'utf8');
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  return { body: Buffer.concat([prefix, bytes, suffix]), contentType: `multipart/related; boundary=${boundary}` };
}

async function uploadMultipart(client, metadata, bytes) {
  const multipart = multipartBody(metadata, bytes);
  const params = new URLSearchParams({ uploadType: 'multipart', fields: 'id,name,size,createdTime,modifiedTime' });
  return driveJson(client, `/files?${params.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': multipart.contentType, Accept: 'application/json' },
    body: multipart.body
  }, 'uploadRequest');
}

async function updateMedia(client, fileId, bytes, contentType) {
  const params = new URLSearchParams({ uploadType: 'media', fields: 'id,name,size,modifiedTime' });
  return driveJson(client, `/files/${encodeURIComponent(fileId)}?${params.toString()}`, {
    method: 'PATCH',
    headers: { 'Content-Type': contentType, Accept: 'application/json' },
    body: bytes
  }, 'uploadRequest');
}

async function makePublic(client, fileId) {
  const params = new URLSearchParams({ fields: 'permissions(id,type,role)', pageSize: '100' });
  const existing = await driveJson(client, `/files/${encodeURIComponent(fileId)}/permissions?${params.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });
  if (Array.isArray(existing.permissions) && existing.permissions.some((permission) =>
    permission && permission.type === 'anyone' && permission.role === 'reader')) return;
  const createParams = new URLSearchParams({ sendNotificationEmail: 'false' });
  await driveJson(client, `/files/${encodeURIComponent(fileId)}/permissions?${createParams.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ type: 'anyone', role: 'reader' })
  });
}

async function deleteFile(client, fileId) {
  await client.request(`/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
}

async function bootstrapDrive(config) {
  const client = createDriveClient(config);
  const folderMetadata = {
    name: 'CampuSphere Offline Map Releases',
    mimeType: 'application/vnd.google-apps.folder',
    appProperties: { campusphereOfflineMapFolder: '1' }
  };
  if (config.parentId) folderMetadata.parents = [config.parentId];
  const folderParams = new URLSearchParams({ fields: 'id,name' });
  const folder = await driveJson(client, `/files?${folderParams.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(folderMetadata)
  });
  if (!folder || !folder.id) throw new PublisherError('The Drive release folder could not be created.', 'OFFLINE_MAP_DRIVE_REQUEST_FAILED');
  const manifest = await uploadMultipart(client, {
    name: 'campusphere-offline-map-manifest.json',
    parents: [folder.id],
    mimeType: 'application/json',
    appProperties: { campusphereOfflineMapManifestPointer: '1' }
  }, Buffer.alloc(0));
  if (!manifest || !manifest.id) throw new PublisherError('The Drive manifest file could not be created.', 'OFFLINE_MAP_DRIVE_REQUEST_FAILED');
  await makePublic(client, manifest.id);
  return { folderId: folder.id, manifestFileId: manifest.id };
}

function signManifest(unsigned, privateKeyPem, publicKeyPem) {
  let signature;
  try {
    signature = crypto.sign(null, Buffer.from(canonicalSigningPayload(unsigned), 'utf8'), crypto.createPrivateKey(privateKeyPem)).toString('base64');
  } catch (error) {
    throw new PublisherError('Offline map signing failed.', 'OFFLINE_MAP_SIGNING_FAILED');
  }
  const manifest = Object.assign({}, unsigned, { signature: { algorithm: 'Ed25519', value: signature } });
  return validateReleaseManifest(manifest, { publicKeyPem, now: Date.now() });
}

function releaseManifest({ source, archive, fileId, config, publishedAt }) {
  const timestamp = publishedAt || new Date().toISOString();
  const unsigned = {
    schema: RELEASE_SCHEMA,
    version: archive.sha256,
    publishedAt: timestamp,
    lastCheckedAt: timestamp,
    osmSnapshotAt: formatSourceDate(source.date),
    asset: {
      fileId: driveFileId(fileId),
      name: `cspc-campus-${archive.sha256}.pmtiles`,
      bytes: archive.bytes.length,
      sha256: archive.sha256
    },
    map: {
      bounds: EXPECTED_BOUNDS.slice(),
      center: EXPECTED_CENTER.slice(),
      minzoom: 0,
      maxzoom: 15,
      attribution: 'Protomaps © OpenStreetMap contributors',
      license: 'ODbL Produced Work; OpenStreetMap attribution required',
      sourceVersion: config.sourceVersion,
      layers: archive.layers.slice()
    }
  };
  return signManifest(unsigned, config.signingPrivateKey, publicKeyFromPrivate(config.signingPrivateKey));
}

async function readCurrentManifest(client, config, publicKeyPem) {
  const bytes = await driveMedia(client, config.manifestFileId, 64 * 1024);
  if (bytes.length === 0) return { bytes: null, manifest: null };
  let parsed;
  try { parsed = JSON.parse(bytes.toString('utf8')); } catch (error) {
    throw new PublisherError('The current Drive manifest is invalid.', 'OFFLINE_MAP_MANIFEST_INVALID');
  }
  let manifest;
  // Permit the one known, signed pre-alignment pointer to be read so this
  // publish can replace it with a manifest using the current center. The
  // application path does not pass this migration option and stays strict.
  try { manifest = validateReleaseManifest(parsed, { publicKeyPem, allowLegacyCenter: true }); } catch (error) {
    throw new PublisherError('The current Drive manifest is invalid.', 'OFFLINE_MAP_MANIFEST_INVALID');
  }
  return { bytes, manifest };
}

async function verifyPublicAsset(fileId, expectedBytes, expectedHash) {
  const bytes = await fetchDriveBytes(publicDriveAssetUrl(fileId), MAX_ASSET_BYTES);
  if (!archiveBytesMatch(bytes, expectedBytes, expectedHash)) {
    throw new PublisherError('The public Drive archive failed anonymous verification.', 'OFFLINE_MAP_PUBLIC_VERIFY_FAILED');
  }
}

function archiveBytesMatch(bytes, expectedBytes, expectedHash) {
  return Buffer.isBuffer(bytes) &&
    bytes.length === expectedBytes &&
    crypto.createHash('sha256').update(bytes).digest('hex') === expectedHash &&
    bytes.subarray(0, PMTILES_MAGIC.length).equals(PMTILES_MAGIC);
}

async function verifyPublicManifest(config, expected, publicKeyPem) {
  const bytes = await fetchDriveBytes(config.publicManifestUrl, 64 * 1024);
  let parsed;
  try { parsed = JSON.parse(bytes.toString('utf8')); } catch (error) { parsed = null; }
  if (!parsed) throw new PublisherError('The public Drive manifest was invalid.', 'OFFLINE_MAP_PUBLIC_VERIFY_FAILED');
  let manifest;
  try { manifest = validateReleaseManifest(parsed, { publicKeyPem }); } catch (error) {
    throw new PublisherError('The public Drive manifest failed signature verification.', 'OFFLINE_MAP_PUBLIC_VERIFY_FAILED');
  }
  if (manifest.version !== expected.version || manifest.asset.fileId !== expected.asset.fileId) {
    throw new PublisherError('The public Drive manifest did not expose the new release.', 'OFFLINE_MAP_PUBLIC_VERIFY_FAILED');
  }
}

async function ensureArchive(client, config, archive) {
  const files = await driveList(client, config.folderId);
  const name = `cspc-campus-${archive.sha256}.pmtiles`;
  const existing = files.find((file) => file.name === name && file.appProperties && file.appProperties.campusphereOfflineMapRelease === '1');
  if (existing) {
    let existingBytes = null;
    try {
      existingBytes = await driveMedia(client, existing.id, MAX_ASSET_BYTES);
    } catch (error) {
      // A transient read failure must not make a known content-addressed file
      // permanently unrepairable; the authenticated PATCH below is still
      // bounded and the read-back check remains mandatory.
    }
    if (archiveBytesMatch(existingBytes, archive.bytes.length, archive.sha256)) return existing.id;
    try {
      await updateMedia(client, existing.id, archive.bytes, 'application/vnd.pmtiles');
      const repairedBytes = await driveMedia(client, existing.id, MAX_ASSET_BYTES);
      if (!archiveBytesMatch(repairedBytes, archive.bytes.length, archive.sha256)) {
        throw new PublisherError('The repaired Drive archive failed verification.', 'OFFLINE_MAP_DRIVE_REQUEST_FAILED');
      }
    } catch (error) {
      if (error instanceof PublisherError) throw error;
      throw new PublisherError('The existing Drive archive could not be repaired.', 'OFFLINE_MAP_DRIVE_REQUEST_FAILED');
    }
    return existing.id;
  }
  const uploaded = await uploadMultipart(client, {
    name,
    parents: [config.folderId],
    mimeType: 'application/vnd.pmtiles',
    appProperties: { campusphereOfflineMapRelease: '1', version: archive.sha256 }
  }, archive.bytes);
  if (!uploaded || !uploaded.id) throw new PublisherError('The Drive archive upload did not return a file.', 'OFFLINE_MAP_DRIVE_REQUEST_FAILED');
  return uploaded.id;
}

async function ensureSidecar(client, config, manifest) {
  const files = await driveList(client, config.folderId);
  const name = `cspc-campus-${manifest.version}.manifest.json`;
  const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  const existing = files.find((file) => file.name === name && file.appProperties && file.appProperties.campusphereOfflineMapManifest === '1');
  if (existing) return existing.id;
  const uploaded = await uploadMultipart(client, {
    name,
    parents: [config.folderId],
    mimeType: 'application/json',
    appProperties: { campusphereOfflineMapManifest: '1', version: manifest.version }
  }, bytes);
  if (!uploaded || !uploaded.id) throw new PublisherError('The Drive release record upload did not return a file.', 'OFFLINE_MAP_DRIVE_REQUEST_FAILED');
  return uploaded.id;
}

async function pruneReleases(client, config, currentVersion) {
  const files = await driveList(client, config.folderId);
  const groups = new Map();
  for (const file of files) {
    const version = file.appProperties && file.appProperties.version;
    const kind = file.appProperties && (file.appProperties.campusphereOfflineMapRelease === '1'
      ? 'archive'
      : (file.appProperties.campusphereOfflineMapManifest === '1' ? 'manifest' : null));
    if (!kind || !isSha256(version)) continue;
    if (!groups.has(version)) groups.set(version, {});
    groups.get(version)[kind] = file;
  }
  const ordered = Array.from(groups.entries()).sort((a, b) => {
    const aTime = Date.parse((a[1].archive || a[1].manifest || {}).createdTime || '') || 0;
    const bTime = Date.parse((b[1].archive || b[1].manifest || {}).createdTime || '') || 0;
    return bTime - aTime;
  });
  const keep = new Set(ordered.slice(0, KEEP_RELEASES).map(([version]) => version));
  keep.add(currentVersion);
  for (const [version, filesForVersion] of ordered) {
    if (keep.has(version)) continue;
    for (const file of [filesForVersion.archive, filesForVersion.manifest]) {
      if (file && file.id) await deleteFile(client, file.id);
    }
  }
}

async function publish(config) {
  const publicKeyPem = publicKeyFromPrivate(config.signingPrivateKey);
  const client = createDriveClient(config);
  const current = await readCurrentManifest(client, config, publicKeyPem);
  const source = await findLatestSource(config);
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'campusphere-offline-map-'));
  const outputPath = path.join(tempDir, 'cspc-campus.pmtiles');
  try {
    const archive = await extractAndValidate(config, source, outputPath, tempDir);
    if (current.manifest && current.manifest.version === archive.sha256) {
      try {
        await verifyPublicAsset(current.manifest.asset.fileId, current.manifest.asset.bytes, current.manifest.version);
        return { status: 'unchanged', version: archive.sha256, sourceDate: source.date.toISOString().slice(0, 10) };
      } catch (error) {
        // A matching hash with a broken public permission or file is repaired
        // through the normal upload/verify/pointer sequence below.
      }
    }
    const fileId = await ensureArchive(client, config, archive);
    await makePublic(client, fileId);
    await verifyPublicAsset(fileId, archive.bytes.length, archive.sha256);
    const manifest = releaseManifest({ source, archive, fileId, config });
    await ensureSidecar(client, config, manifest);
    const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    try {
      await makePublic(client, config.manifestFileId);
      await updateMedia(client, config.manifestFileId, manifestBytes, 'application/json');
      await verifyPublicManifest(config, manifest, publicKeyPem);
    } catch (error) {
      if (current.bytes) {
        try { await updateMedia(client, config.manifestFileId, current.bytes, 'application/json'); } catch (restoreError) { /* preserve original failure */ }
      }
      throw error;
    }
    await pruneReleases(client, config, manifest.version);
    return { status: 'published', version: manifest.version, sourceDate: source.date.toISOString().slice(0, 10) };
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

async function rollback(config, version) {
  assertSha256(version);
  const publicKeyPem = publicKeyFromPrivate(config.signingPrivateKey);
  const client = createDriveClient(config);
  const files = await driveList(client, config.folderId);
  const archive = files.find((file) => file.name === `cspc-campus-${version}.pmtiles` && file.appProperties && file.appProperties.campusphereOfflineMapRelease === '1');
  const sidecar = files.find((file) => file.name === `cspc-campus-${version}.manifest.json` && file.appProperties && file.appProperties.campusphereOfflineMapManifest === '1');
  if (!archive || !sidecar) throw new PublisherError('The requested offline map rollback is unavailable.', 'OFFLINE_MAP_ROLLBACK_INVALID');
  const archiveBytes = await fetchDriveBytes(publicDriveAssetUrl(archive.id), MAX_ASSET_BYTES);
  const archiveHash = crypto.createHash('sha256').update(archiveBytes).digest('hex');
  if (archiveHash !== version || !archiveBytes.subarray(0, PMTILES_MAGIC.length).equals(PMTILES_MAGIC)) {
    throw new PublisherError('The requested rollback archive failed verification.', 'OFFLINE_MAP_ROLLBACK_INVALID');
  }
  let saved;
  try { saved = JSON.parse((await driveMedia(client, sidecar.id, 64 * 1024)).toString('utf8')); } catch (error) { saved = null; }
  if (!saved) throw new PublisherError('The requested rollback record is invalid.', 'OFFLINE_MAP_ROLLBACK_INVALID');
  const base = Object.assign({}, saved, {
    publishedAt: new Date().toISOString(),
    lastCheckedAt: new Date().toISOString(),
    asset: Object.assign({}, saved.asset, { fileId: archive.id, name: archive.name, bytes: archiveBytes.length, sha256: version })
  });
  delete base.signature;
  const manifest = signManifest(base, config.signingPrivateKey, publicKeyPem);
  const current = await readCurrentManifest(client, config, publicKeyPem);
  await makePublic(client, archive.id);
  await makePublic(client, config.manifestFileId);
  await updateMedia(client, config.manifestFileId, Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8'), 'application/json');
  try {
    await verifyPublicManifest(config, manifest, publicKeyPem);
  } catch (error) {
    if (current.bytes) {
      try { await updateMedia(client, config.manifestFileId, current.bytes, 'application/json'); } catch (restoreError) { /* preserve original failure */ }
    }
    throw error;
  }
  return { status: 'rolled-back', version };
}

async function main() {
  const config = configured();
  if (config.bootstrap) {
    const result = await bootstrapDrive(config);
    console.log('OFFLINE MAP DRIVE BOOTSTRAP COMPLETE. Save the returned file IDs as GitHub Actions secrets.');
    console.log(`OFFLINE_MAP_DRIVE_FOLDER_ID=${result.folderId}`);
    console.log(`OFFLINE_MAP_DRIVE_MANIFEST_FILE_ID=${result.manifestFileId}`);
    return;
  }
  const result = config.rollbackVersion ? await rollback(config, config.rollbackVersion) : await publish(config);
  console.log(`OFFLINE MAP RELEASE ${result.status.toUpperCase()}: ${result.version}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof PublisherError ? error.message : 'Offline map release failed.');
    process.exitCode = 1;
  });
}

module.exports = {
  PublisherError,
  KEEP_RELEASES,
  PMTILES_VERSION,
  BBOX,
  sourceFileUrl,
  dateFromYyyyMmDd,
  metadataLayerIds,
  archiveBytesMatch,
  ensureArchive,
  signManifest,
  releaseManifest,
  bootstrapDrive,
  pruneReleases
};
