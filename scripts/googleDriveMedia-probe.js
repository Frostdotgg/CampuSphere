'use strict';

/*
 * Focused Google Drive media contract probe.
 *
 * Database-free, server-free, session-free, and network-free. It exercises the
 * shared URL policy, the authenticated proxy's pure validation seams, the
 * guided-VR media predicate, and the room-schedule/public wiring. It never
 * calls the proxy controller itself, so no upstream request can be made.
 */

const fs = require('fs');
const path = require('path');

const mediaUrl = require('../utils/mediaUrl');
const mediaController = require('../controllers/mediaController');
const guidedVr = require('../services/guidedVrResolution');
const scheduleDocument = require('../utils/roomScheduleDocument');

const ROOT = path.join(__dirname, '..');
const DRIVE_FILE = 'https://drive.google.com/file/d/1AbC_def-123/view?usp=sharing';
const DRIVE_OPEN = 'https://drive.google.com/open?id=1AbC_def-123&resourcekey=resource-key_1';
const CLOUDINARY = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    passed += 1;
    console.log('PASS ' + label);
  } else {
    failed += 1;
    console.error('FAIL ' + label);
  }
}

function noThrow(label, fn) {
  try {
    check(label, fn() === true);
  } catch (error) {
    check(label, false);
  }
}

console.log('=== CampuSphere Google Drive media probe (database-free) ===');

const parsedFile = mediaUrl.parseGoogleDriveFileUrl(DRIVE_FILE);
const parsedOpen = mediaUrl.parseGoogleDriveFileUrl(DRIVE_OPEN);
check('canonical file share link is accepted', parsedFile && parsedFile.fileId === '1AbC_def-123');
check('open?id share link is accepted with resource key', parsedOpen && parsedOpen.resourceKey === 'resource-key_1');
check('normalization keeps the stored Drive link unchanged', mediaUrl.normalizeMediaUrl(DRIVE_FILE) === DRIVE_FILE);
check('browser resolution converts Drive to same-origin proxy',
  mediaUrl.resolveMediaUrlForBrowser(DRIVE_FILE) === '/api/media/google-drive/1AbC_def-123');
check('resource key is preserved in proxy path',
  mediaUrl.googleDriveProxyPath(DRIVE_OPEN) === '/api/media/google-drive/1AbC_def-123?resourcekey=resource-key_1');
check('Cloudinary resolution remains unchanged', mediaUrl.resolveMediaUrlForBrowser(CLOUDINARY) === CLOUDINARY);
check('local image paths remain safe for client previews', mediaUrl.resolveMediaUrlForBrowser('/img/example.jpg') === '/img/example.jpg');

[
  'http://drive.google.com/file/d/1AbC_def-123/view',
  'https://drive.google.com/drive/folders/1AbC_def-123',
  'https://drive.google.com/file/d/1AbC_def-123/view?foo=bar',
  'https://drive.google.com/file/d/1AbC_def-123/view?id=other',
  'https://drive.google.com/file/d/1AbC_def-123/view#fragment',
  'https://drive.google.com.evil.com/file/d/1AbC_def-123/view',
  'https://user@drive.google.com/file/d/1AbC_def-123/view',
  'https://drive.google.com/open?id=bad%2Fid',
].forEach((value) => check('unsafe Drive form is rejected: ' + value,
  mediaUrl.isGoogleDriveFileUrl(value) === false && mediaUrl.normalizeMediaUrl(value) === null));

const downloadUrl = mediaController._buildDriveDownloadUrl('1AbC_def-123', 'resource-key_1');
check('proxy download target is Drive HTTPS', downloadUrl && downloadUrl.protocol === 'https:' && downloadUrl.hostname === 'drive.google.com');
check('proxy download target carries only the file id and resource key',
  downloadUrl && downloadUrl.pathname === '/uc' &&
  downloadUrl.searchParams.get('export') === 'download' &&
  downloadUrl.searchParams.get('id') === '1AbC_def-123' &&
  downloadUrl.searchParams.get('resourcekey') === 'resource-key_1');
check('invalid proxy file id fails closed', mediaController._buildDriveDownloadUrl('../secret', '') === null);
check('invalid proxy resource key fails closed', mediaController._buildDriveDownloadUrl('1AbC_def-123', '../secret') === null);

const redirectBase = 'https://drive.google.com/uc?export=download&id=1AbC_def-123';
check('approved Drive redirect host is accepted', !!mediaController._safeRedirectUrl('https://drive.usercontent.google.com/download?id=1AbC_def-123', redirectBase));
[
  'http://drive.google.com/next',
  'https://drive.google.com.evil.com/next',
  'https://user@drive.google.com/next',
  'https://drive.google.com:444/next',
  'https://drive.google.com/next#fragment',
].forEach((value) => check('unsafe redirect is rejected: ' + value, mediaController._safeRedirectUrl(value, redirectBase) === null));

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const webp = Buffer.from('524946460000000057454250', 'hex');
check('JPEG signature is recognized', mediaController._sniffImage(jpeg).mime === 'image/jpeg');
check('PNG signature is recognized', mediaController._sniffImage(png).mime === 'image/png');
check('WebP signature is recognized', mediaController._sniffImage(webp).mime === 'image/webp');
check('HTML/empty bytes are rejected as media', mediaController._sniffImage(Buffer.from('<html>')) === null);
check('matching MIME is accepted', !!mediaController._imageTypeForResponse('image/jpeg', mediaController._sniffImage(jpeg)));
check('mismatched MIME is rejected', mediaController._imageTypeForResponse('text/html', mediaController._sniffImage(jpeg)) === null);
check('generic octet MIME is accepted only after signature sniffing',
  !!mediaController._imageTypeForResponse('application/octet-stream', mediaController._sniffImage(png)));

check('Drive metadata is accepted for guided VR without a Cloudinary id',
  guidedVr.hasApprovedGoogleDriveMetadata({ image_url: DRIVE_FILE, cloudinary_public_id: null }));
check('Drive metadata with a Cloudinary id is rejected',
  !guidedVr.hasApprovedGoogleDriveMetadata({ image_url: DRIVE_FILE, cloudinary_public_id: 'campus/scene' }));
check('Cloudinary metadata remains accepted',
  guidedVr.hasApprovedMediaMetadata({ image_url: CLOUDINARY, cloudinary_public_id: 'campus/scene' }));

const chain = guidedVr.verifyGuidedChain({
  keys: ['scene-a', 'scene-b'],
  arrivalKey: 'scene-b',
  startNodeKey: 'main-gate',
  destinationNodeKey: 'building-b',
  scenes: [
    { id: 1, scene_key: 'scene-a', image_url: DRIVE_FILE, cloudinary_public_id: null, node_key: 'main-gate' },
    { id: 2, scene_key: 'scene-b', image_url: DRIVE_OPEN, cloudinary_public_id: null, node_key: 'building-b' },
  ],
  links: [
    { fromKey: 'scene-a', toKey: 'scene-b' },
    { fromKey: 'scene-b', toKey: 'scene-a' },
  ]
});
check('guided chain can complete with Drive-backed scenes', chain.complete === true && chain.verified.length === 2);
check('public schedule shaping converts Drive to proxy',
  scheduleDocument.normalizeScheduleImageUrl(DRIVE_FILE) === '/api/media/google-drive/1AbC_def-123');

const source = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
noThrow('server mounts the authenticated Drive proxy', () =>
  /app\.get\(['"]\/api\/media\/google-drive\/:fileId['"],\s*requireLogin,\s*mediaController\.googleDrive\)/.test(source('server.js')));
noThrow('building admin UI includes the Drive provider and preview helper', () =>
  /Google Drive file link/.test(source('views/admin/campus-map.ejs')) && /media-url\.js/.test(source('views/admin/campus-map.ejs')));
noThrow('VR admin UI includes the Drive provider and preview helper', () =>
  /Google Drive file link/.test(source('views/admin/vr.ejs')) && /media-url\.js/.test(source('views/admin/vr.ejs')));
noThrow('schedule admin UI includes Drive sharing guidance', () =>
  /Anyone with the link/.test(source('views/admin/campus-map.ejs')) && /approved Google Drive/.test(source('controllers/adminRoomScheduleDocumentController.js')));
noThrow('browser helper emits only same-origin Drive proxy paths', () =>
  /googleDriveProxyUrl/.test(source('public/js/media-url.js')) && /\/api\/media\/google-drive\//.test(source('public/js/media-url.js')));

console.log(`GOOGLE-DRIVE-MEDIA-PROBE ${failed === 0 ? 'OK' : 'FAILED'}: ${passed}/${passed + failed}`);
if (failed > 0) process.exitCode = 1;
