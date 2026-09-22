import { check } from 'k6';
import {
  LT08_PROFILE,
  classifyEnduranceWindow,
  lateLatencyLimit,
  passesLateLatencyGuard,
  isReadOnlyPhase,
  safeEvidenceText,
} from './lt-08-endurance-policy.js';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ['rate==1.0'] },
};

export default function () {
  const stageTargets = LT08_PROFILE.rampStages.map((stage) => stage.target);
  const stageDurations = LT08_PROFILE.rampStages.map((stage) => stage.duration);
  const early = classifyEnduranceWindow(LT08_PROFILE.holdStartMs + 1000);
  const middle = classifyEnduranceWindow(LT08_PROFILE.holdStartMs + 240000 + 1000);
  const late = classifyEnduranceWindow(LT08_PROFILE.holdEndMs - 119000);
  const outside = classifyEnduranceWindow(0);
  const standardLimit = lateLatencyLimit(1000);
  const longEarlyLimit = lateLatencyLimit(2000);

  check({
    stageTargets,
    stageDurations,
    early,
    middle,
    late,
    outside,
    standardLimit,
    longEarlyLimit,
    passAtLimit: passesLateLatencyGuard(1000, standardLimit),
    failAboveLimit: passesLateLatencyGuard(1000, standardLimit + 1),
    readOnlyMap: isReadOnlyPhase('workload-map'),
    readOnlyHeartbeat: isReadOnlyPhase('presence-heartbeat'),
    safeAggregate: safeEvidenceText('LT-08 completed; 2500 journeys; p95=1000ms.', 'guest@example.invalid', 'secret'),
    rejectsCookie: safeEvidenceText('cookie=__Host-campusphere.sid', 'guest@example.invalid', 'secret'),
    rejectsPassword: safeEvidenceText('password=secret', 'guest@example.invalid', 'secret'),
  }, {
    'LT-08 profile has 49 HTTP plus one browser client': (value) =>
      value.stageTargets[2] === 49 && LT08_PROFILE.totalClients === 50 && LT08_PROFILE.browserCanaryVUs === 1,
    'LT-08 profile ramps, holds, and ramps down': (value) =>
      JSON.stringify(value.stageTargets) === JSON.stringify([9, 24, 49, 49, 0]) &&
      JSON.stringify(value.stageDurations) === JSON.stringify(['30s', '30s', '1m', '10m', '1m']),
    'LT-08 phases classify early middle late and overall': (value) =>
      value.early === 'early' && value.middle === 'middle' && value.late === 'late' && value.outside === 'overall',
    'LT-08 degradation limit uses the larger allowance': (value) =>
      value.standardLimit === 1500 && value.longEarlyLimit === 3000,
    'LT-08 accepts the exact late limit and rejects one millisecond above': (value) =>
      value.passAtLimit === true && value.failAboveLimit === false,
    'LT-08 workload phases are read-only and heartbeat is excluded': (value) =>
      value.readOnlyMap === true && value.readOnlyHeartbeat === false,
    'LT-08 aggregate evidence is safe': (value) => value.safeAggregate === true,
    'LT-08 evidence rejects session-cookie markers': (value) => value.rejectsCookie === false,
    'LT-08 evidence rejects credential text': (value) => value.rejectsPassword === false,
  });
}
