# CampuSphere Current Authority

Last updated: 2026-09-22 (Asia/Manila)

This is the canonical current-state summary. Historical detail remains in the
handoffs, plan, roadmap, deployment, incident, and test-evidence records.
Recompute live Git and external state before treating this checkpoint as
current.

## Git and release state

At the start of this checkpoint, branch `main` had local `HEAD`, `origin/main`,
and remote `main` equal at Git commit SHA-1
`0e7fe8bb50708bbcfaa4297f6ca133a547da4d76` (`0e7fe8b`). The worktree carried
the reviewed authority synchronization and retained LT-01 through LT-08
candidate. Superseded and failed load-test runs were moved to a recoverable
archive outside the repository. The owner authorized validation, two dedicated
commits, and a normal push to `main` for this checkpoint. No deployment,
promotion, database, migration, or vendor mutation is authorized.

The resulting documentation commits are self-referential. Fresh sessions must
recompute the exact local `HEAD`, `origin/main`, remote `main`, ahead/behind
count, worktree, index, and stash status instead of copying an old SHA.

Current product lineage includes:

- `13adb9d`: recoverable, fail-closed Production session readiness.
- `b8d2bf2`: completed-response guard for late session-store errors.
- `ab4ae61`: fixed, sanitized session timeout diagnostics.
- `0e7fe8b`: explicit Vehicle exit Guided-VR routes and aligned campus maps.

The owner-observed current Vercel Production deployment is
`dpl_HbJRojVKtJUeUr2KMY6XhcRv6RCS` for exact product commit `0e7fe8b`, on
`main`, with canonical alias `https://campusphere-cspc.vercel.app`. This is a
recorded dashboard observation, not complete immutable deployed-byte equality
and not authority to redeploy.

## Architecture and security

CampuSphere is a Node.js `>=22`, Express 5, EJS application. Production
application data and Express sessions target Supabase/PostgreSQL. MySQL remains
local development, fallback, and rehearsal. Supabase Auth is not used; bcrypt
local login, Google OAuth, `express-session`, CSRF, role middleware, and
server-side validation enforce application access. Server repositories use the
Supabase service role, so RLS and revoked browser grants are defense in depth,
not per-user authorization. Upstash Redis is the Vercel shared rate-limit
store.

Signed-in guests may browse all buildings, 2D routes, and 360 scenes. Room
schedules remain limited to CSPC students, instructors, and administrators.
Scene and exit hotspots are guest-visible; information hotspots require
explicit administrator approval; schedule hotspots are hidden from guests.
Google Drive support is a validated reference plus authenticated same-origin
proxy. CampuSphere does not manage vendor uploads or accounts.

## Session-resilience boundary

The September 14 `Service temporarily unavailable` incident was triggered when
the fail-closed readiness query received Supabase HTTP `401`; the retained row
does not prove why the provider issued that temporary response. `13adb9d`
replaced the warm-function sticky initialization failure with bounded
single-flight recovery waves and bounded transient session-store retries.

The later `ERR_HTTP_HEADERS_SENT` observation was a separate response-lifecycle
defect. `b8d2bf2` prevents a late `express-session` store error from writing a
second response after an already-completed request. `ab4ae61` adds fixed,
sanitized session timeout diagnostics. These diagnostics omit credentials,
keys, cookies, session identifiers/data, URLs, raw provider errors, bodies, and
stacks. The full evidence boundary is in
`docs/session-readiness-incident-2026-09-14.md`.

The September 21 LT-08 monitoring window contained three session-store
timeout-retry warnings on `GET /api/pathfind`, `GET /api/routes`, and
`GET /api/search`. Each associated request row displayed `200`, but the
captured rows show only the first retry starting and do not prove the later
retry outcome. This is an operational follow-up, not proof of a defect or
permanent provider availability.

## Current map, route, and Guided-VR behavior

Online `/map` and the home preview use the bundled MapLibre/PMTiles campus
basemap. GitHub Actions publishes signed OSM-derived PMTiles to the configured
public Drive delivery location. A signed-in user explicitly downloads or
updates `/api/offline-guide`; validated guide JSON and the PMTiles Blob are
stored atomically in IndexedDB. The service worker caches only the reviewed
shell/static allowlist. The current cache key is `v48`.

Current source counts are:

| Mode | Destinations | Steps | Unique scenes |
| --- | ---: | ---: | ---: |
| Vehicle entry | 25 | 486 | 101 |
| Vehicle exit | 25 | 545 | 105 |
| Walking | 25 | 690 | 133 |

Vehicle exit routes are explicit approved sequences, not reversed entry routes.
Walking entry and exit retain their established direction-aware behavior.
Runtime still verifies unique scene keys, approved media, exact navigation
links, and direction-specific arrival before reporting completion.

## Database and migration boundary

Migration sources remain contiguous through `0027` and are owner-reported
applied. This checkpoint changes no schema, migration, application row, session
row, approved route data, Guided-VR data, Production setting, or vendor state.
Do not apply or reapply migrations, modify approved routes/VR data, or mutate
sessions/application data without a fresh focused owner task. Current MySQL
parity remains unestablished.

## Production load-test closeout

The retained suite closes LT-01 through LT-08 with explicit limitations:

- LT-01 baseline browser, LT-02 concurrent login, LT-03 peak enrollment,
  LT-04 VR asset delivery, LT-05 building-name search, and LT-06 route playback
  passed their bounded criteria.
- LT-07 passed in the owner's already authenticated Chrome profile at phone,
  tablet, and desktop viewport sizes. The preceding k6 offline-browser attempt
  is rejected harness evidence: k6 lost the browser process after switching it
  offline, and the same behavior was reproduced against a minimal local fixture.
- LT-08 passed all 26 configured thresholds and is recorded **PASS WITH
  WARNING** because the matching read-only Vercel window contained three
  session-store timeout-retry warnings.

Exact workloads, counts, timings, screenshots, summaries, and scope limits are
in `docs/test-evidence.md` and `artifacts/production-load/`.

For LT-08, the matching September 21 Production window showed approximately
5.6K function invocations, 0% function errors, 0% function timeouts, no
displayed `5xx`, and memory at 341 MB average / 352 MB P75 / 356 MB P95 against
the displayed 2.05 GB limit. The dashboard TTFB chart was labeled demo data and
was excluded; memory P99 was not exposed.

A fresh local `npm test` was attempted during checkpoint review but is rejected
as acceptance evidence and did not emit `QUALITY-GATES OK`. Its documentation
hash-label finding was corrected afterward and the focused documentation
secret scanner is green, but the run also exposed a Staff House Vehicle-exit
exact scene-order assertion in the Supabase/Supabase leg, additional Staff
House mixed/local failures, and stale or incomplete MySQL VR parity for CCS and
Academic VI. A subsequent SELECT-only residue audit found zero unexpired
canonical Supabase sessions but could not resolve the canonical MySQL
administrator and student identities. The owner explicitly directed that
MySQL synchronization be skipped for this checkpoint; no MySQL seed, data,
route, VR, session, schema, or migration repair was performed. This checkpoint
therefore makes no full-suite or current MySQL parity claim and relies only on
its bounded checkpoint-specific validations.

## Evidence limits and next move

Evidence classes remain separate: Git/source truth, local validation, retained
k6 summaries, owner-controlled Chrome observations, read-only Vercel dashboard
observations, historical Supabase evidence, predecessor UAT, and external
client/panel acceptance.

The suite does not prove 50 distinct accounts, 50 simultaneous Chromium/WebGL
sessions, write capacity, current MySQL parity, complete OAuth/admin coverage,
exhaustive route/VR traversal, three physical offline devices, a zero-warning
Production window, permanent provider availability, or complete immutable
deployed-byte equality. Final client/panel acceptance remains external.

After this checkpoint is validated and pushed, the next move is an
owner-selected focused add/change/remove feature or bug fix on a fresh branch.
That future task requires its own scope and authority. If any bounded
checkpoint-specific validation or the pre-push remote recheck fails, stop and
ask; the explicitly rejected full-suite/MySQL-parity result is deferred by
owner decision and must not be rewritten as a pass. Do not weaken a test,
rewrite evidence, force-push, deploy, promote, roll back, or patch around the
failure.
