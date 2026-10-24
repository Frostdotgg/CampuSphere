'use strict';

/* Database-free/source-only contract for the bounded offline-map refresh. */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

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

function clientFunction(source, name) {
  const start = source.indexOf('function ' + name + '(');
  const end = source.indexOf('\n  }', start);
  assert.ok(start >= 0 && end > start, 'Missing offline client function: ' + name);
  return source.slice(start, end + 4);
}

// Run the real download promise chain, validation and hashes. Only transport,
// presentation and the atomic IndexedDB transaction boundary are disposable fakes.
function downloadFixture(source, scenario = {}) {
  const bytes = Buffer.from('PMTiles disposable download fixture');
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const guide = {
    instructionFormat: 1, origin: { key: 'main-gate' }, buildings: [], routes: [], exitRoutes: [],
    walkingRoutes: [], walkingOrigin: { key: 'walking-guard-house', lat: 13.405710, lng: 123.374181 },
    basemap: { asset: scenario.asset || '/maps/cspc-campus-' + sha256 + '.pmtiles', bytes: bytes.length, sha256 }
  };
  const payload = { success: true, schema: 'campusphere.offline-guide/1', generatedAt: '2026-10-24T00:00:00Z',
    guide, fingerprint: crypto.createHash('sha256').update(JSON.stringify(guide)).digest('hex') };
  if (scenario.badFingerprint) payload.fingerprint = '0'.repeat(64);
  const previous = { key: 'active', fingerprint: 'f'.repeat(64), guide: { origin: { key: 'main-gate' },
    buildings: [], routes: [], basemap: { sha256: 'e'.repeat(64) } }, basemap: new Blob(['previous guide map']) };
  const frame = {
    Blob, AbortController, TextEncoder, Uint8Array, GUIDE_SCHEMA: payload.schema,
    MAX_BASEMAP_BYTES: 5 * 1024 * 1024, ACTIVE_KEY: 'active', logoutVersion: 0,
    activeRecord: previous, downloadController: null, navigator: { onLine: true },
    window: { AbortController, crypto: crypto.webcrypto }, requests: [], writes: [], states: [],
    setDownloadBusy() {}, updatePackageSummary() {}, byId() { return null; },
    setDownloadState(message, kind) { frame.states.push({ message, kind }); },
    async writeActive(record) {
      if (scenario.writeFailure) throw new Error('Disposable transaction aborted.');
      frame.writes.push(record); return record;
    },
    async fetch(url, options) {
      frame.requests.push({ url, options });
      assert.strictEqual(options.cache, 'no-store');
      if (url === '/api/offline-guide') {
        if (scenario.guideFailure) throw new Error('Disposable guide read failed.');
        return { ok: true, status: 200, json: async () => payload };
      }
      assert.strictEqual(url, guide.basemap.asset);
      // A protected same-origin asset requires the existing browser sign-in.
      assert.strictEqual(options.credentials, 'same-origin');
      assert.strictEqual(options.redirect, 'error');
      if (scenario.mapFailure) throw new Error('Disposable asset read aborted.');
      if (scenario.logoutDuringMap) frame.logoutVersion++;
      let mapBytes = Buffer.from(bytes);
      if (scenario.badSize) mapBytes = mapBytes.subarray(1);
      if (scenario.badHash) mapBytes[mapBytes.length - 1] ^= 1;
      return { ok: true, status: 200, redirected: !!scenario.redirected,
        arrayBuffer: async () => Uint8Array.from(mapBytes).buffer };
    }
  };
  for (const name of ['bytesToHex', 'sha256Buffer', 'sha256Text', 'isHexHash', 'validateGuideEnvelope', 'downloadGuide']) {
    vm.runInNewContext(clientFunction(source, name), frame);
  }
  return { frame, previous, payload };
}

async function verifyClientDownloads() {
  const source = fs.readFileSync(path.join(ROOT, 'public', 'js', 'offline-guide-manager.js'), 'utf8');
  await checkAsync('protected same-origin download verifies content before one atomic guide replacement', async () => {
    const { frame, payload } = downloadFixture(source);
    assert.strictEqual(await frame.downloadGuide(), true);
    assert.strictEqual(frame.writes.length, 1);
    assert.strictEqual(frame.activeRecord.fingerprint, payload.fingerprint);
    assert.strictEqual(frame.requests.length, 2);
    assert.ok(frame.requests.every(request => request.options.signal instanceof AbortSignal));
    assert.strictEqual(frame.requests[1].url, payload.guide.basemap.asset);
  });
  for (const [name, before, after] of [
    ['anonymous protected-map request', "credentials: 'same-origin', redirect: 'error'", "credentials: 'omit', redirect: 'error'"],
    ['redirect-following map request', "redirect: 'error'", "redirect: 'follow'"]
  ]) await checkAsync('rejects regression to ' + name, async () => {
    const broken = source.replace(before, after); assert.notStrictEqual(broken, source);
    const { frame } = downloadFixture(broken);
    assert.strictEqual(await frame.downloadGuide(), false);
    assert.strictEqual(frame.writes.length, 0);
  });
  for (const [name, scenario] of [
    ['cross-origin asset', { asset: 'https://other.invalid/map.pmtiles' }],
    ['invalid asset path', { asset: '/maps/../private.pmtiles' }],
    ['guide fingerprint mismatch', { badFingerprint: true }],
    ['redirected asset', { redirected: true }], ['incorrect byte count', { badSize: true }],
    ['corrupted map hash', { badHash: true }], ['failed update request', { guideFailure: true }],
    ['interrupted map download', { mapFailure: true }], ['aborted storage transaction', { writeFailure: true }],
    ['logout during download', { logoutDuringMap: true }]
  ]) await checkAsync(name + ' cannot replace the previous downloaded guide', async () => {
    const { frame, previous } = downloadFixture(source, scenario);
    assert.strictEqual(await frame.downloadGuide(), false);
    assert.strictEqual(frame.activeRecord, previous); assert.strictEqual(frame.writes.length, 0);
    if (scenario.asset || scenario.badFingerprint) assert.strictEqual(frame.requests.length, 1);
  });
  await checkAsync('public basemap controller ignores incoming cookies and sets no session cookie', async () => {
    const calls = [], headers = {}, response = { code: null, set(values) { Object.assign(headers, values); return this; },
      status(code) { this.code = code; return this; }, send(bytes) { this.bytes = bytes; return this; } };
    const digest = 'a'.repeat(64), fixture = { exports: {}, require(name) {
      if (name === '../services/offlineMapReleaseService') return {
        guideAssetPath: service.guideAssetPath, OfflineMapReleaseError: service.OfflineMapReleaseError,
        async downloadCurrentAsset(...args) { calls.push(args); return { release: { asset: { name: 'cspc-campus-' + digest + '.pmtiles', sha256: digest } }, bytes: Buffer.from('fixture') }; }
      };
      if (name === '../utils/serverLog') return { logServerError() { throw new Error('Unexpected public map error'); } };
      throw new Error('Unexpected controller dependency');
    } };
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'controllers', 'offlineMapController.js'), 'utf8'), fixture);
    await fixture.exports.download({ params: { sha256: digest }, headers: { cookie: 'disposable-cookie-only' } }, response);
    assert.strictEqual(response.code, 200); assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].length, 1); assert.strictEqual(calls[0][0], digest);
    assert.ok(!Object.keys(headers).some(name => name.toLowerCase() === 'set-cookie'));
    assert.strictEqual(headers['Cache-Control'], 'public, max-age=31536000, immutable');
  });
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

  await verifyClientDownloads();
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
