# Session retry log pairing

Date: 2026-10-20 (Asia/Manila). Status: released product; original local evidence retained.

The owner approved the controlled release after the local verification below.
Product source `6a5bbd8` was verified on staged Production and the normal website.
See `session-retry-log-pairing-release-2026-10-20.md` for release identities,
real-session checks and warning evidence. The local-only statements below
describe the original implementation task, not the later release.

Branch: `codex/session-retry-log-pairing`, based on
`59b61b8217881e28f7ad8514e82b3d3ff19534da`. GitHub `main` matched that baseline
when preparation fetched and checked it. No commit, push or deployment was made.
The published October 20 release and its warning observations remain dated
evidence in `room-scheduling-release-2026-10-20.md`.

## Change and logging budget

The old independent retry/outcome limiters could emit A's retry warning and B's
recovery when B completed first. Sampling now reserves a complete pair for the
operation that emitted the warning. The decision and pair token live in that
operation's async state; there is no request/session-indexed global registry.

- Per store instance, admit one pair per operation (`get`, `set`, `touch`),
  initial failure category and initial numeric status (or no status) every
  60,000 ms. Claim the window before calling the warning writer. Zero is a
  valid clock value; 59,999 ms remains suppressed and 60,000 ms is admitted.
- An admitted operation emits one warning and reserves exactly one outcome:
  `recovered` at info level or `failed` at error level. Both lines retain the
  request ID captured at operation start and the same new opaque `operation_id`.
  Separate admitted operations within one request have separate operation IDs.
- Recovery describes the triggering failure. Failure describes the final
  failure, even when its category/status differs. The pair identity stays fixed.
- Unsampled successes produce no recovery line. Unsampled terminal failures
  retain the independent standalone error allowance per operation/final failure
  category/status every 60 seconds. A sampled failure emits no duplicate
  standalone error and does not consume another operation's error allowance.
- Each admitted pair permits at most two messages. A same-key burst of failed
  operations can also emit one standalone error: three messages in that case.
  A reserved outcome can arrive in the next minute without consuming another
  admission. This is an admission budget, not a strict wall-clock-window line
  ceiling, and it is not a fleet-wide limiter across serverless instances.
- Missing/throwing synchronous logger methods, invalid diagnostic IDs and
  diagnostic-clock failures cannot change store results or issue more provider
  requests. A warning that cannot be written leaves the operation unsampled;
  the claimed window stays consumed to keep output bounded.

Existing safe fields, classifications and coarse per-attempt timing buckets
remain. IDs are generated on the server, validated as 32 lowercase hexadecimal
characters and never returned in headers/cookies or written into session/query
data. Logs contain no session ID, session JSON, credentials or raw provider error.
Successful operations without a retry do not generate an operation ID.

## Unchanged behavior and scope

The production defaults remain a 2,000 ms attempt limit, at most two runtime
attempts and a 200 ms delay. Authorization failures still fail without retry.
Startup/readiness policy, query construction, abort handling, expiry updates,
scoped logout and Express response/error handling are unchanged. No public API,
schema, dependency, environment setting, browser cache or saved-data change is
included. No Production traffic, database or vendor operation was performed.

## Verification

The initial local tests used the installed dependency tree. Release preparation
found local `proxy-addr` 2.0.7 while the unchanged lockfile pins 2.0.8. The release
checks were therefore repeated in a complete source copy with a fresh locked
installation; the original checkout's dependencies were left untouched. No
dependency source/lockfile change was needed. Synthetic sessions and fake
providers were used, environment loading and external network access were
blocked, and only loopback HTTP was allowed. Rejections were strict; the tests
installed no unhandled-rejection absorber.

| Check | Result |
| --- | --- |
| Original concurrency regression against the old implementation | Failed as expected: two assertions exposed the mismatched/missing pair |
| Supabase session resilience | 73/73 |
| Runtime/session bootstrap | 160/160 |
| Production startup/profile contracts (isolated) | 116/116 |
| Package boundary on canonical Git bytes | 75/75 |
| Documentation contracts (server/database/credentials/network blocked) | 652/652 |

The resilience checks cover A/B completion ordering, same-request operations,
independent operation/status budgets, changed terminal categories, exact minute
boundaries, 100-operation recovery/failure bursts, late reserved outcomes,
reentrant/missing/throwing writers, invalid/throwing ID providers and privacy
canaries. They observe late provider resolution/rejection before asserting one
callback, including two exhausted timeouts with two aborts. Exact touch expiry,
expired-session rejection and scoped logout remain covered.

Real loopback Express/express-session requests exercise HTTP 200, 204 and 304,
each with immediate success, recovered refresh and exhausted refresh. Original
responses complete, paired outcomes match, terminal failures reach the existing
error handler once, and no second response write occurs. Short injected test
timings keep these deterministic; they are not Production latency measurements.

Syntax, whitespace and the preservation review are recorded with the final
local evidence. These focused checks are not a full
`npm test`/QA pass, live provider verification or deployed-byte evidence.

## Runtime package and evidence

The released product package contains **201 files / 8,580,207 bytes**, aggregate
SHA-256 `01966f8b17022c7d43d9976876ef19e2680dda1b8c7c473cf683453f3368dfd0`.
An external temporary Git index supplies canonical bytes without staging the
normal index. Exactly one included runtime file differs from the published
package: `services/supabaseSessionStore.js`. Tests/docs remain excluded.

The predecessor room-scheduling release package remains dated evidence:
**201 files / 8,577,707 bytes**, SHA-256
`6c20279df6b9297f7859d1b0d01f72f15d863937c7816695919cf269924fe709`.
The standalone package probe's pin describes the session-log pairing runtime;
the predecessor fingerprint remains unchanged in its dated release documents.

Sanitized logs, before/after evidence, fingerprints and canonical package
inventory are outside Git at
`C:\Users\FROST.GG\.codex\backups\session-retry-log-pairing-20261020`.
The original investigation directory
`C:\Users\FROST.GG\.codex\backups\session-timeout-investigation-20261020-1715`
is preserved unchanged as historical evidence. Protected local documents,
schema/migration files and the normal index's staged content are preserved.

## Remaining limits and next step

Pairing applies when the operation settles and the synchronous logger remains
available. A successful logger call does not prove downstream delivery.
Process termination, logger failure and provider log retention can still leave
an externally visible pair incomplete. Unsampled recoveries intentionally have
no message. This change cannot establish the outcome or provider cause of old
warnings, and it does not reduce session-refresh latency or change retry policy.

The original local implementation ended without commit, push or deployment.
The separately approved release subsequently verified the product on staged
Production and the normal website. The release handoff records that dated
evidence. The documentation successor retains identical runtime bytes; its
actual deployment identity and final ten-minute monitoring results belong in
the external receipt and owner report. No future deployment, database repair
or policy change is authorized by this completed release.
