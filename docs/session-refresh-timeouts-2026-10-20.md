# Session refresh lifetime correction — 2026-10-20

## Completed final publication and interrupted-watch closure (October 21)

The runtime-identical successor 38fd2962dccb096a8d45635790092e91c611952b was
verified Ready on the normal domain as dpl_86Lge98zAWnSKYbG7b14ef4uMpfF.
The first closing watch was interrupted by the owner shutting down the laptop;
last saved checkpoint was 2026-10-20 15:42:36 UTC. No continuous overnight watch
is claimed. A fresh watch ran 2026-10-21 00:47:32–00:58:28 UTC (655.105 seconds).
Its loaded 08:27–08:57 Asia/Manila view showed 0 Warning / 0 Error / 0 Fatal
request rows, and the final heartbeat completed 204. Public smoke passed 20/20;
protected reloads, retained owner sign-in, both route modes/directions and a
real panorama passed. No natural retry or blocking session error was observed.
Finite observation does not promise zero future timeouts. No shared content
was edited. Read docs/session-handoff-2026-10-21.md for the next-session route.

## Evidence and diagnosis

The reviewed baseline is `9401df5db59c829ec819d30c0e0081ddf3fd810b`.
Its Ready/Current Production deployment was rechecked as
`dpl_9Y7bXk1NQttAYU6LiCUaLgPd1T4E`; it is the rollback target for this work.
The owner authorized investigation, a proven local correction, tests and a
controlled release. This note records local and verified product evidence;
final successor identities and observations belong to the external release
receipt.

Expanded logs for one internally correlated heartbeat show its originating
invocation at 14:27:54 UTC finishing in 637 ms, a retry warning at 14:28:54,
and its matching failed outcome at 14:29:22 during a favicon invocation.
Application request/operation IDs match across those messages. Request-row
placement is not message ownership, and a displayed 204 is not refresh success.
The loaded 14:39 UTC Last 30 minutes view contained 8 Warning request rows,
4 Error rows and 0 Fatal rows. These are a bounded dashboard snapshot, not
console-message counts or a zero-warning monitoring claim.

The matching Supabase overview reported Healthy in Mumbai/ap-south-1, 100.0%
success for Last 60 minutes, CPU 3%, RAM 55% and 9/60 connections. Aggregate
health does not establish request latency or prove a provider cause. Detailed
per-provider latency was unavailable on the existing dashboard plan.

A real loopback client disconnect with the real locked SDK established an
application integration defect: a healthy 150 ms expiry update was pending
after HTTP close, but zero tasks belonged to the invocation lifetime. The
platform fixture models lifetime draining; it does not reproduce actual cloud
freezing. Under that documented lifetime contract, the invocation could retire
before persistence and its callback. With the correction, one registered task
settles persistence and the callback before retirement, without another request.

This establishes an avoidable lifetime gap and supports the production timing
hypothesis. It does not identify every historical timeout's provider/network
cause. Staged normal activity must separately validate the observed pattern.
The SDK's built-in read retries do not apply to PATCH expiry updates. Its
existing wrapped network-error classification remains unchanged by this task.

## Reviewed correction and invariants

`@vercel/functions` is pinned to **3.10.1**. Its official `waitUntil` helper owns
the complete refresh promise through retries, paired diagnostics and the store
callback. Registration happens before asynchronous provider dispatch. There is
no application-wide queue indexed by requests or sessions. Outside a Vercel
request context the helper is a no-op, preserving persistent Docker execution.

Defaults remain **2,000 ms per attempt, two attempts and 200 ms retry delay**.
Session creation, changed-session saves, scoped logout, readiness, cookies,
authorization, public APIs and schemas retain their previous contracts. Touch
still updates expiry only; it is not replaced by a full-session save. Completed
responses retain their original status/body and existing late-error safeguard.

A callback exception cannot trigger a second callback. Registration/callback
exceptions receive a fixed sanitized `operation=lifetime state=failed`
diagnostic, sampled once per 60 seconds per store instance. No raw errors,
cookies, session IDs/data, credentials, provider URLs or SQL enter diagnostics.
An inability to register lifetime does not start another provider attempt or
change the store callback result; it is a release-blocking diagnostic on Vercel.

## Fresh local verification

- Lifecycle regression: **72/72**, including real SDK fetches, HTTP
  200/204/304/302, HEAD, disconnects, concurrent invocations, late completion,
  real helper/no-context behavior, throwing callbacks/registration/loggers,
  expiry, concurrent logout and rejected reuse.
- Session resilience **73/73**; runtime/bootstrap **160/160**;
  Production profile **116/116**.
- Scheduling-removal authorization/CSRF/privacy fixtures **401/401**;
  Walking fixtures **118/118**; rate-limit fixtures **180/180**.
- Dependency audit: **0 vulnerabilities**. All 127 installed package versions
  match the lockfile. Existing locked package entries were unchanged; the
  official helper adds 25 packages including its transitive dependencies.
- The same lifetime probe passed **72/72** in a disposable, network-disabled
  Docker container with read-only source and no shared database access.
- Isolated documentation contracts **659/659**, CSP **5/5**, media URL policy
  **20/20** and canonical package boundary **75/75** passed.

Tests run from a complete source copy with environment loading and external
networking blocked, synthetic sessions/providers and loopback HTTP only.
The active-loop exhaustion test retains the approximately 4.2-second budget;
scheduler suspension is not a hard real-time guarantee. Focused results are not
a full npm test/QA pass or live MySQL/database parity.

The canonical Git-byte runtime package is **201 files / 8,591,700 bytes**,
SHA-256 `dfe57b2a9cc634f2a5f02758750be704ca02cff457388161fc282c0d21137890`.
Only the session store and dependency manifests differ from `9401df5`.
The previous 201-file / 8,580,207-byte fingerprint remains dated release
evidence. Final package, syntax, documentation and frozen-run results are
recorded in the external receipt after their checks finish. Service worker v53 and
stylesheet v13 remain unchanged; no guide-format change is required.

## Publication gate and handoff

Use staged Production settings with automatic domain assignment disabled.
After owner sign-in, check protected reloads, normal heartbeats, map/Walking/
Vehicle reads and a representative panorama, without saving shared content.
Observe ten minutes of normal staged activity. An unexplained exhausted refresh,
the reproduced lifecycle pattern, a lifetime-registration error or authentication
regression blocks promotion. Do not manufacture Production faults.

After promotion, repeat checks and ten-minute monitoring; roll back for a
blocking attributable regression. Genuine provider outages remain possible and
retain bounded failures. If only provider latency is established, deliver the
findings and owner action with no speculative patch or deployment.

There is no database maintenance, migration, provider upgrade, timeout increase,
schedule cleanup or ICTU deployment. Normal owner authentication/presence may
create or refresh its own application sessions. Protected documents and the
original investigations remain unchanged. Prior release permissions do not
authorize future work.

## Verified product publication

Product source `07120e4c3313429dc765d42bc5bec8d062c6e761` was built with
Production settings as `dpl_HBd5t8p1hqXXgdQoiyBRY3RDQHPn`. Automatic Production
domain assignment remained disabled and Standard Protection remained enabled.
The owner completed email/password sign-in on its temporary address. Protected
reloads, normal heartbeats, Vehicle entrance/return, Walking entrance/return
and the Main Entrance panorama passed without shared-content edits.

The staged observation ran from **15:12:05 to 15:22:43 UTC** (638 seconds).
Its closing loaded dashboard view covered **22:52–23:22 Asia/Manila** and showed
**0 Warning / 0 Error / 0 Fatal request rows** for this exact deployment.
No natural retry, exhausted refresh, lifetime-registration failure or old
cross-request timeout pattern was observed. The view is wider than the measured
watch; these are dashboard request-row counts, not success logs for every touch.
One expanded normal heartbeat showed its expiry PATCH, a 141 ms function
duration and a 363 ms response. Per-provider latency remained unavailable.

The validated product was promoted to
`https://campusphere-cspc.vercel.app`; the project overview then showed that
exact deployment/source Ready on the normal domain. Public smoke passed
**20/20**, including five exact committed asset matches. The existing owner
session, Vehicle/Walking reads and room descriptions passed live checks.
The live product observation ran from **15:23:23 to 15:34:00 UTC** (637 seconds).
Protected Administrator reloads, normal heartbeats, the existing signed-in
session, Walking entrance/return and the real panorama passed. Its loaded
closing view showed **0 Warning / 0 Error / 0 Fatal request rows** for this
deployment; no natural retry or post-response/lifetime error was observed.
Public smoke is not complete immutable deployed-byte equality. The
documentation-only successor must preserve the same canonical runtime package,
be verified Ready/Staged and be promoted before final smoke/monitoring. Its
self-referential source/deployment identities and final results belong to the
external receipt, avoiding another documentation commit solely to name itself.

The earlier release's corrected 14 Warning / 6 Error / 0 Fatal request-row
snapshot and its monitoring gap remain preserved history. They are not erased
by this release's quiet observed windows. Finite observation cannot prove that
all historical provider/network causes are resolved or promise zero future
timeouts. No saved session contents were inspected or failure traffic injected.

Detailed evidence and final source/deployment receipt:
`C:\Users\FROST.GG\.codex\backups\session-refresh-timeouts-20261020-2237`.

Primary references: [Vercel lifetime guidance](https://vercel.com/kb/guide/troubleshooting-inconsistent-logs-in-vercel-functions)
and [waitUntil API](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package).
