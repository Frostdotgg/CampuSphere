'use strict';

/* Database-free/source-only contract for the bounded offline-map refresh. */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const service = require(path.join(ROOT, 'services', 'offlineMapReleaseService'));
const publisher = require(path.join(ROOT, 'scripts', 'publishOfflineMapRelease'));

let checks = 0;
const failures = [];

function check(label, fn) {
  checks += 1;
  try {
    fn();
    console.log(`  [PASS] ${label}`);
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
    console.log(`  [FAIL] ${label}`);
  }
}

async function checkAsync(label, fn) {
  checks += 1;
  try {
    await fn();
    console.log(`  [PASS] ${label}`);
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
    console.log(`  [FAIL] ${label}`);
  }
}

function expectReleaseError(fn, code) {
  assert.throws(fn, (error) => error instanceof service.OfflineMapReleaseError && error.code === code);
}

function validManifest(keyPair) {
  const unsigned = {
    schema: service.RELEASE_SCHEMA,
    version: 'a'.repeat(64),
    publishedAt: '2026-08-28T00:00:00.000Z',
    lastCheckedAt: '2026-08-28T00:05:00.000Z',
    osmSnapshotAt: '2026-08-27T00:00:00.000Z',
    asset: {
      fileId: 'drive-file-' + 'a'.repeat(25),
      name: 'cspc-campus-' + 'a'.repeat(64) + '.pmtiles',
      bytes: 614046,
      sha256: 'a'.repeat(64)
    },
    map: {
      bounds: service.EXPECTED_BOUNDS.slice(),
      center: service.EXPECTED_CENTER.slice(),
      minzoom: 0,
      maxzoom: 15,
      attribution: 'Protomaps © OpenStreetMap contributors',
      license: 'ODbL Produced Work; OpenStreetMap attribution required',
      sourceVersion: '4.15.2',
      layers: service.REQUIRED_LAYERS.slice()
    }
  };
  const signature = crypto.sign(null, Buffer.from(service.canonicalSigningPayload(unsigned), 'utf8'), keyPair.privateKey).toString('base64');
  return Object.assign(unsigned, { signature: { algorithm: 'Ed25519', value: signature } });
}

async function main() {
  const keyPair = crypto.generateKeyPairSync('ed25519');
  const publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const manifest = validManifest(keyPair);

  check('valid signed manifest is accepted', () => {
    const result = service.validateReleaseManifest(manifest, { publicKeyPem, now: Date.parse('2026-08-28T12:00:00.000Z') });
    assert.strictEqual(result.version, manifest.version);
    assert.strictEqual(result.asset.fileId, manifest.asset.fileId);
  });
  check('missing signature fails closed without a TypeError', () => {
    const copy = Object.assign({}, manifest);
    delete copy.signature;
    expectReleaseError(() => service.validateReleaseManifest(copy, { publicKeyPem, now: Date.parse('2026-08-28T12:00:00.000Z') }), 'OFFLINE_MAP_SIGNATURE_INVALID');
  });
  check('tampered manifest fails signature verification', () => {
    const copy = JSON.parse(JSON.stringify(manifest));
    copy.map.sourceVersion = '4.15.3';
    expectReleaseError(() => service.validateReleaseManifest(copy, { publicKeyPem, now: Date.parse('2026-08-28T12:00:00.000Z') }), 'OFFLINE_MAP_SIGNATURE_INVALID');
  });
  check('wrong bounds and missing layer are rejected', () => {
    const wrong = JSON.parse(JSON.stringify(manifest));
    wrong.map.bounds[0] += 0.001;
    expectReleaseError(() => service.validateReleaseManifest(wrong, { publicKeyPem, now: Date.parse('2026-08-28T12:00:00.000Z') }), 'OFFLINE_MAP_MANIFEST_INVALID');
    const missing = JSON.parse(JSON.stringify(manifest));
    missing.map.layers = ['earth'];
    expectReleaseError(() => service.validateReleaseManifest(missing, { publicKeyPem, now: Date.parse('2026-08-28T12:00:00.000Z') }), 'OFFLINE_MAP_MANIFEST_INVALID');
  });
  check('guide projection is content-addressed and preserves map metadata', () => {
    const release = service.validateReleaseManifest(manifest, { publicKeyPem, now: Date.parse('2026-08-28T12:00:00.000Z') });
    const guide = service.guideBasemapFromRelease(release);
    assert.strictEqual(guide.asset, '/maps/cspc-campus-' + manifest.version + '.pmtiles');
    assert.strictEqual(guide.osmSnapshotAt, manifest.osmSnapshotAt);
    assert.strictEqual(guide.sourceVersion, manifest.map.sourceVersion);
  });
  check('bundled mode remains the default-compatible baseline', () => {
    const previous = process.env.OFFLINE_MAP_RELEASE_MODE;
    delete process.env.OFFLINE_MAP_RELEASE_MODE;
    const release = service.baselineRelease();
    assert.strictEqual(release.asset.fileId, null);
    assert.ok(/^cspc-campus-[a-f0-9]{64}\.pmtiles$/.test(release.asset.name));
    if (previous === undefined) delete process.env.OFFLINE_MAP_RELEASE_MODE;
    else process.env.OFFLINE_MAP_RELEASE_MODE = previous;
  });
  await checkAsync('approved Drive URL can be read with a bounded response', async () => {
    const response = await service.fetchDriveBytes('https://drive.google.com/uc?export=download&id=drive-file-aaaaaaaaaaaaaaaaaaaaaaaaa', 10, {
      fetchImpl: async () => new Response('ok', { status: 200, headers: { 'content-length': '2' } })
    });
    assert.strictEqual(response.toString('utf8'), 'ok');
  });
  await checkAsync('foreign host is rejected before fetch', async () => {
    await assert.rejects(() => service.fetchDriveBytes('https://example.com/map.pmtiles', 10, { fetchImpl: async () => { throw new Error('must not fetch'); } }),
      (error) => error.code === 'OFFLINE_MAP_URL_INVALID');
  });
  await checkAsync('foreign redirect is rejected', async () => {
    await assert.rejects(() => service.fetchDriveBytes('https://drive.google.com/uc?id=drive-file-aaaaaaaaaaaaaaaaaaaaaaaaa', 10, {
      fetchImpl: async () => new Response(null, { status: 302, headers: { location: 'https://example.com/escape' } })
    }), (error) => error.code === 'OFFLINE_MAP_REDIRECT_INVALID');
  });
  await checkAsync('oversized response is rejected before buffering', async () => {
    await assert.rejects(() => service.fetchDriveBytes('https://drive.google.com/uc?id=drive-file-aaaaaaaaaaaaaaaaaaaaaaaaa', 2, {
      fetchImpl: async () => new Response('too-large', { status: 200, headers: { 'content-length': '9' } })
    }), (error) => error.code === 'OFFLINE_MAP_RESPONSE_TOO_LARGE');
  });
  await checkAsync('Drive mode selects and validates the signed current archive', async () => {
    const archiveBytes = Buffer.concat([Buffer.from('PMTiles', 'ascii'), Buffer.alloc(32, 7)]);
    const hash = crypto.createHash('sha256').update(archiveBytes).digest('hex');
    const driveManifest = JSON.parse(JSON.stringify(manifest));
    driveManifest.version = hash;
    driveManifest.asset.sha256 = hash;
    driveManifest.asset.name = 'cspc-campus-' + hash + '.pmtiles';
    driveManifest.asset.bytes = archiveBytes.length;
    delete driveManifest.signature;
    driveManifest.signature = {
      algorithm: 'Ed25519',
      value: crypto.sign(null, Buffer.from(service.canonicalSigningPayload(driveManifest), 'utf8'), keyPair.privateKey).toString('base64')
    };
    const oldMode = process.env.OFFLINE_MAP_RELEASE_MODE;
    const oldUrl = process.env.OFFLINE_MAP_MANIFEST_URL;
    const oldKey = process.env.OFFLINE_MAP_SIGNING_PUBLIC_KEY;
    process.env.OFFLINE_MAP_RELEASE_MODE = 'drive';
    process.env.OFFLINE_MAP_MANIFEST_URL = 'https://drive.google.com/uc?export=download&id=manifest-file-aaaaaaaaaaaaaaaaaaaa';
    process.env.OFFLINE_MAP_SIGNING_PUBLIC_KEY = publicKeyPem;
    service.clearReleaseCache();
    const fakeFetch = async (url) => url.includes('manifest-file-')
      ? new Response(JSON.stringify(driveManifest), { status: 200 })
      : new Response(archiveBytes, { status: 200, headers: { 'content-length': String(archiveBytes.length) } });
    try {
      const release = await service.getCurrentRelease({ fetchImpl: fakeFetch, now: Date.parse('2026-08-28T12:00:00.000Z') });
      assert.strictEqual(release.version, hash);
      const downloaded = await service.downloadCurrentAsset(hash, { fetchImpl: fakeFetch, now: Date.parse('2026-08-28T12:00:00.000Z') });
      assert.deepStrictEqual(downloaded.bytes, archiveBytes);
    } finally {
      service.clearReleaseCache();
      if (oldMode === undefined) delete process.env.OFFLINE_MAP_RELEASE_MODE; else process.env.OFFLINE_MAP_RELEASE_MODE = oldMode;
      if (oldUrl === undefined) delete process.env.OFFLINE_MAP_MANIFEST_URL; else process.env.OFFLINE_MAP_MANIFEST_URL = oldUrl;
      if (oldKey === undefined) delete process.env.OFFLINE_MAP_SIGNING_PUBLIC_KEY; else process.env.OFFLINE_MAP_SIGNING_PUBLIC_KEY = oldKey;
    }
  });
  const repairArchiveBytes = Buffer.concat([Buffer.from('PMTiles', 'ascii'), Buffer.alloc(32, 7)]);
  const repairArchiveHash = crypto.createHash('sha256').update(repairArchiveBytes).digest('hex');
  const repairArchive = { bytes: repairArchiveBytes, sha256: repairArchiveHash };
  const repairConfig = { folderId: 'drive-folder-' + 'c'.repeat(25) };
  function fakeArchiveClient(initialBytes, replacementBytes = repairArchiveBytes) {
    let media = Buffer.from(initialBytes);
    let patchCount = 0;
    const fileId = 'drive-file-' + 'd'.repeat(25);
    const name = `cspc-campus-${repairArchiveHash}.pmtiles`;
    const request = async (apiPath, options = {}) => {
      if (apiPath.startsWith('/files?')) {
        return new Response(JSON.stringify({ files: [{
          id: fileId,
          name,
          size: String(media.length),
          appProperties: { campusphereOfflineMapRelease: '1' }
        }] }), { status: 200 });
      }
      if (apiPath.includes('?alt=media')) return new Response(media, { status: 200 });
      if (apiPath.includes('?uploadType=media')) {
        patchCount += 1;
        media = Buffer.from(replacementBytes);
        return new Response(JSON.stringify({ id: fileId, name, size: String(media.length) }), { status: 200 });
      }
      throw new Error('unexpected fake Drive request');
    };
    return {
      get patchCount() { return patchCount; },
      request,
      uploadRequest: request
    };
  }
  await checkAsync('matching Drive archive is reused without a write', async () => {
    const client = fakeArchiveClient(repairArchiveBytes);
    const fileId = await publisher.ensureArchive(client, repairConfig, repairArchive);
    assert.strictEqual(fileId, 'drive-file-' + 'd'.repeat(25));
    assert.strictEqual(client.patchCount, 0);
  });
  await checkAsync('same-size corrupted Drive archive is repaired and reread', async () => {
    const corrupted = Buffer.concat([Buffer.from('PMTiles', 'ascii'), Buffer.alloc(32, 8)]);
    const client = fakeArchiveClient(corrupted);
    const fileId = await publisher.ensureArchive(client, repairConfig, repairArchive);
    assert.strictEqual(fileId, 'drive-file-' + 'd'.repeat(25));
    assert.strictEqual(client.patchCount, 1);
  });
  await checkAsync('wrong-size corrupted Drive archive is repaired', async () => {
    const client = fakeArchiveClient(Buffer.from('PMTiles', 'ascii'));
    const fileId = await publisher.ensureArchive(client, repairConfig, repairArchive);
    assert.strictEqual(fileId, 'drive-file-' + 'd'.repeat(25));
    assert.strictEqual(client.patchCount, 1);
  });
  await checkAsync('failed Drive archive readback remains fail-closed', async () => {
    const corrupted = Buffer.concat([Buffer.from('PMTiles', 'ascii'), Buffer.alloc(32, 8)]);
    await assert.rejects(
      () => publisher.ensureArchive(fakeArchiveClient(corrupted, corrupted), repairConfig, repairArchive),
      (error) => error instanceof publisher.PublisherError && error.code === 'OFFLINE_MAP_DRIVE_REQUEST_FAILED'
    );
  });
  check('publisher signs and validates a release manifest', () => {
    const privatePem = keyPair.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    const result = publisher.releaseManifest({
      source: { date: new Date('2026-08-27T00:00:00.000Z') },
      archive: { bytes: Buffer.from('PMTiles test archive'), sha256: 'b'.repeat(64), layers: service.REQUIRED_LAYERS.slice() },
      fileId: 'drive-file-' + 'b'.repeat(25),
      config: { signingPrivateKey: privatePem, sourceVersion: '4.15.2' },
      publishedAt: '2026-08-28T01:00:00.000Z'
    });
    assert.strictEqual(result.version, 'b'.repeat(64));
    assert.strictEqual(result.signature.algorithm, 'Ed25519');
  });
  check('publisher source/date and layer helpers are bounded', () => {
    assert.strictEqual(publisher.sourceFileUrl('https://build.protomaps.com', new Date('2026-08-27T00:00:00Z')), 'https://build.protomaps.com/20260827.pmtiles');
    assert.deepStrictEqual(publisher.metadataLayerIds({ vector_layers: [{ id: 'earth' }, { id: 'buildings' }] }), ['earth', 'buildings']);
    assert.throws(() => publisher.dateFromYyyyMmDd('2026-02-30'), /invalid/i);
  });
  check('server wiring keeps the public proxy before session middleware', () => {
    const source = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    const controller = fs.readFileSync(path.join(ROOT, 'controllers', 'offlineMapController.js'), 'utf8');
    const staticIndex = source.indexOf("app.use(express.static(path.join(__dirname, 'public')));");
    const routeIndex = source.indexOf("app.get('/maps/cspc-campus-:sha256.pmtiles'");
    const sessionIndex = source.indexOf("app.use(session({");
    assert.ok(staticIndex >= 0 && routeIndex > staticIndex && sessionIndex > routeIndex);
    assert.ok(controller.includes("'Cache-Control': 'public, max-age=31536000, immutable'"));
  });
  check('publisher uses the Drive upload endpoint for multipart and media writes', () => {
    const source = fs.readFileSync(path.join(ROOT, 'scripts', 'publishOfflineMapRelease.js'), 'utf8');
    assert.ok(source.includes("const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';"));
    assert.ok(source.includes('uploadRequest: (apiPath, options) => requestAt(DRIVE_UPLOAD_BASE, apiPath, options)'));
    assert.strictEqual((source.match(/\}, 'uploadRequest'\);/g) || []).length, 2);
  });
  check('client compares the manifest fingerprint and reuses an unchanged map Blob', () => {
    const source = fs.readFileSync(path.join(ROOT, 'public', 'js', 'offline-guide-manager.js'), 'utf8');
    assert.ok(source.includes('activeRecord.fingerprint === payload.fingerprint'));
    assert.ok(source.includes('activeRecord.guide.basemap.sha256 === guide.basemap.sha256'));
    assert.ok(source.includes('var MAX_BASEMAP_BYTES = 5 * 1024 * 1024;'));
    assert.ok(source.includes('Offline map is already up to date.'));
  });
  check('workflow pins the PMTiles release and runs the daily publisher', () => {
    const source = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'offline-map-refresh.yml'), 'utf8');
    assert.ok(source.includes("cron: '30 18 * * *'"));
    assert.ok(source.includes('actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1'));
    assert.ok(source.includes('actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0'));
    assert.ok(!/uses:\s*actions\/(checkout|setup-node)@v\d/.test(source));
    assert.ok(source.includes('3ed7dbf4ec2e6dfe5e25b6f70d1ffc932729f93c86db353bf514dd71010a312f'));
    assert.ok(source.includes('scripts/publishOfflineMapRelease.js'));
  });

  if (failures.length) {
    console.error(`OFFLINE-MAP-RELEASE-PROBE FAILED: ${failures.length}/${checks} checks failed.`);
    process.exitCode = 1;
  } else {
    console.log(`OFFLINE-MAP-RELEASE-PROBE OK: ${checks}/${checks} checks passed.`);
  }
}

main().catch((error) => {
  console.error(`OFFLINE-MAP-RELEASE-PROBE FAILED: ${error.message}`);
  process.exitCode = 1;
});
