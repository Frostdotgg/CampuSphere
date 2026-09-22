import { check } from 'k6';
import { validateGuideEnvelope, validateStoredSnapshot } from './lt-07-offline-policy.js';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ['rate==1.0'] },
};

const HASH = 'a'.repeat(64);
const validGuide = {
  origin: { key: 'main-gate', label: 'Guard House / Main Gate' },
  basemap: {
    asset: `/maps/cspc-campus-${HASH}.pmtiles`,
    bytes: 128,
    sha256: HASH,
  },
  buildings: [
    { key: 'building-a', name: 'Building A', routeAvailable: true, exitRouteAvailable: true },
  ],
  routes: [{ destinationKey: 'building-a', geometry: [[1, 1], [2, 2]], steps: [{ instruction: 'Walk' }] }],
  exitRoutes: [{ buildingKey: 'building-a', destinationKey: 'main-gate', geometry: [[2, 2], [1, 1]], steps: [{ instruction: 'Return' }] }],
};

function envelope(overrides = {}) {
  return {
    success: true,
    schema: 'campusphere.offline-guide/1',
    fingerprint: HASH,
    guide: validGuide,
    ...overrides,
  };
}

export default function () {
  const accepted = validateGuideEnvelope(envelope());
  const wrongSchema = validateGuideEnvelope(envelope({ schema: 'other/1' }));
  const wrongFingerprint = validateGuideEnvelope(envelope({ fingerprint: 'not-a-hash' }));
  const missingMap = validateGuideEnvelope(envelope({ guide: { ...validGuide, basemap: null } }));
  const missingExit = validateGuideEnvelope(envelope({ guide: { ...validGuide, exitRoutes: [] } }));
  const vrLeak = validateGuideEnvelope(envelope({ guide: { ...validGuide, panoramaUrl: 'https://res.cloudinary.com/example/pano.jpg' } }));
  const stored = validateStoredSnapshot({
    schema: 'campusphere.offline-guide/1',
    fingerprint: HASH,
    basemapBytes: 128,
    expectedBasemapBytes: 128,
    buildingCount: 1,
    entryRouteCount: 1,
    exitRouteCount: 1,
    buildingWithBothRoutes: true,
    forbiddenData: false,
  });
  const storedVrLeak = validateStoredSnapshot({
    schema: 'campusphere.offline-guide/1',
    fingerprint: HASH,
    basemapBytes: 128,
    expectedBasemapBytes: 128,
    buildingCount: 1,
    entryRouteCount: 1,
    exitRouteCount: 1,
    buildingWithBothRoutes: true,
    forbiddenData: true,
  });

  check({ accepted, wrongSchema, wrongFingerprint, missingMap, missingExit, vrLeak, stored, storedVrLeak }, {
    'valid offline guide is accepted': (value) => value.accepted.accepted === true,
    'unsupported guide schema is rejected': (value) => value.wrongSchema.reason === 'invalid-schema',
    'invalid guide fingerprint is rejected': (value) => value.wrongFingerprint.reason === 'invalid-fingerprint',
    'missing basemap identity is rejected': (value) => value.missingMap.reason === 'invalid-basemap',
    'missing exit routes are rejected': (value) => value.missingExit.reason === 'empty-guide',
    'VR or panorama data is rejected': (value) => value.vrLeak.reason === 'forbidden-vr-data',
    'verified stored guide snapshot is accepted': (value) => value.stored.accepted === true,
    'stored guide VR leakage is rejected': (value) => value.storedVrLeak.reason === 'forbidden-vr-data',
  });
}
