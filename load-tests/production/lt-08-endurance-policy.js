/*
 * Network-free LT-08 contract helpers. Keep the endurance profile and
 * degradation rule in one small module so the regression can prove the
 * runner policy without contacting Production.
 */
export const LT08_PROFILE = Object.freeze({
  totalClients: 50,
  httpPeakVUs: 49,
  browserCanaryVUs: 1,
  sessionPoolSize: 4,
  rampStages: Object.freeze([
    Object.freeze({ duration: '30s', target: 9 }),
    Object.freeze({ duration: '30s', target: 24 }),
    Object.freeze({ duration: '1m', target: 49 }),
    Object.freeze({ duration: '10m', target: 49 }),
    Object.freeze({ duration: '1m', target: 0 }),
  ]),
  holdStartMs: 2 * 60 * 1000,
  holdEndMs: 12 * 60 * 1000,
  canaryIntervalMs: 60 * 1000,
});

export function classifyEnduranceWindow(elapsedMs) {
  const elapsed = Number(elapsedMs);
  if (!Number.isFinite(elapsed)) return 'overall';
  if (elapsed >= LT08_PROFILE.holdStartMs && elapsed < LT08_PROFILE.holdStartMs + 120000) return 'early';
  if (elapsed >= LT08_PROFILE.holdStartMs + 240000 && elapsed < LT08_PROFILE.holdStartMs + 360000) return 'middle';
  if (elapsed >= LT08_PROFILE.holdEndMs - 120000 && elapsed < LT08_PROFILE.holdEndMs) return 'late';
  return 'overall';
}

export function lateLatencyLimit(earlyP95) {
  const value = Number(earlyP95);
  return Number.isFinite(value) && value >= 0 ? Math.max(value * 1.5, value + 500) : null;
}

export function passesLateLatencyGuard(earlyP95, lateP95) {
  const limit = lateLatencyLimit(earlyP95);
  const late = Number(lateP95);
  return limit !== null && Number.isFinite(late) && late <= limit;
}

export function isReadOnlyPhase(phase) {
  return new Set([
    'workload-map',
    'workload-buildings-page',
    'workload-directory',
    'workload-search',
    'workload-routes',
    'workload-pathfind',
    'workload-health',
    'browser-navigation',
    'browser-map-checks',
    'browser-map-inspection',
  ]).has(String(phase));
}

export function safeEvidenceText(text, email = '', password = '') {
  const value = String(text || '');
  const forbiddenMarkers = /setup_data|sessionCookie|__Host-campusphere\.sid|K6_TEST_PASSWORD|csrfToken|_csrf/i;
  return !forbiddenMarkers.test(value) &&
    (!email || !value.includes(String(email))) &&
    (!password || !value.includes(String(password)));
}
