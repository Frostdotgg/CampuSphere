# LT-07 k6 offline-navigation regression

- Command: `node scripts/lt07OfflineNavigation-probe.js`
- Date: 2026-09-21 (Asia/Manila)
- Scope: localhost-only minimal service-worker fixture; no Production request,
  credentials, application data, or account session
- k6: v2.2.0

## Result

Expected diagnostic failure, exit code `1`:

- fixture page is service-worker controlled: PASS
- fixture offline shell is precached: PASS
- scheduled browser navigation reaches the offline shell: FAIL
- checks: 2/3 (`66.66%`)

This independently reproduces the same boundary seen in the Production LT-07
k6 prototype. It demonstrates that the k6 offline navigation result cannot be
used as the CampuSphere application verdict. Final LT-07 evidence uses real
Chrome network-offline control instead.
