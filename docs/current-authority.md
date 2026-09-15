# CampuSphere Current Authority

Last updated: 2026-09-15 (Asia/Manila)

This is the canonical current-state summary. Detailed historical evidence stays
in the handoffs, plan, roadmap, deployment, and test-evidence files. Recompute
live Git and external state before treating a recorded checkpoint as current.

## Git and release state

At the start of this documentation synchronization, branch `main` had local
`HEAD`, `origin/main`, and remote `main` equal at
`b8d2bf26a73d25cff2c53af695396d2f695ae631` (`b8d2bf2`), with a clean index and
worktree and zero stashes. The owner authorized the bounded Production smoke,
deployment-specific log inspection, and—if green—the established 19-file
authority/static-contract synchronization. A later commit and push remain a
separate owner decision. Because any resulting authority commit contains this
self-referential record, fresh sessions must recompute its exact SHA and status.

Current lineage:

- `13ae67c`: Academic II, Multi-Purpose I, and Green destination-route fixes.
- `f9679f6`: full Walking catalog, travel-mode chooser, MapLibre/PMTiles maps,
  building/start labels, home preview, and aligned offline start marker.
- `4e9d579`: Walking exits, direction-aware navigation, Academic IV/VI shortcut
  preservation, and guarded Academic VI mapping diagnostics.
- `173efef`: authority-only synchronization for the Walking release.
- `13adb9da0e3ff01b6ed853ed1f993c3d2a12a207` (`13adb9d`): recoverable session
  readiness and bounded Supabase session-store retries for transient Production
  failures.
- `58298c9`: authority-only synchronization for the promoted `13adb9d`
  checkpoint; it changed no product runtime.
- `55d634a`: authority-only incident-evidence synchronization; it changed no
  product runtime.
- `b8d2bf26a73d25cff2c53af695396d2f695ae631` (`b8d2bf2`): prevents a late
  session-store error from writing a second response after a completed request
  and adds a real `express-session` regression probe.

The owner promoted exact commit `b8d2bf2` as Vercel deployment
`dpl_5aBjCeWeBj1ZcST2LJCqZhSv7Tct`. A signed-in dashboard observation showed it
`Ready`, `Latest`, in `Production`, with canonical alias
`https://campusphere-cspc.vercel.app`. The bounded Production smoke described
below passed. The signed-in guest UAT remains predecessor evidence for
`4e9d579`, not a post-`b8d2bf2` rerun.

## Architecture and security

CampuSphere is a Node.js `>=22`, Express 5, EJS application. Supabase/PostgreSQL
is the Production application-data and Express-session target. MySQL remains
local development, fallback, and rehearsal. Supabase Auth is unused: bcrypt
local login, Google OAuth, `express-session`, CSRF, role middleware, and
server-side validation enforce per-user access. Server repositories use the
Supabase service role, so RLS and revoked browser grants provide defense in
depth rather than per-user authorization. Upstash Redis is the Vercel shared
rate-limit store.

Signed-in guests may browse all buildings, 2D routes, and 360 scenes. Room
schedules remain limited to CSPC students, instructors, and administrators.
Scene and exit hotspots are guest-visible; information hotspots require explicit
administrator approval; schedule hotspots are hidden from guests. Google Drive
support is a validated reference plus authenticated same-origin proxy. Only
JPEG, PNG, and WebP are served; HEIC/HEIF requires conversion. CampuSphere does
not manage vendor uploads or accounts.

## Production session incidents and resilience

The intermittent fixed `Service temporarily unavailable` response came from
the fail-closed session-readiness gate. A September 15 read-only review of the
retained Supabase 24-hour log found the exact readiness query receiving HTTP
`401` at `2026-09-14 21:29:01` Asia/Manila, within the owner-reported 9:30 PM
incident window. A session write received `502` at 21:28:30 and a settings read
received `401` at 21:28:09. This confirms that Supabase's API/gateway rejected
the readiness verification that activated the gate. The retained row has no
provider response body or diagnostic, so the reason Supabase temporarily
issued the `401` remains unproven. The Vercel dashboard no longer retained the
requested invocation window.

The corrected application defect was that one failed eager initialization
could remain cached for the lifetime of a warm Vercel function. The complete
source/evidence distinction and panel-ready explanation are recorded in
`docs/session-readiness-incident-2026-09-14.md`.

`13adb9d` preserves fail-closed startup while allowing bounded recovery through
single-flight waves: three attempts, a two-second timeout per attempt, 250/750
ms retry delays, transient cooldowns of 5/15/30/60 seconds, and a 60-second
authorization cooldown. HTML requests receive a readable reconnecting page;
health/API requests retain the fixed sanitized JSON. Both use `503`,
`Cache-Control: no-store`, and `Retry-After`.

Supabase session `get`, `set`, and `touch` use at most two attempts with a 200
ms delay only for timeout, network, `408`, `429`, or `5xx` failures. `401`/`403`
authorization failures are not retried. Session destroy remains scoped to one
exact session id and permits only one bounded retry after an absence check.
Diagnostics expose fixed categories only. Vercel functions are pinned to
region `bom1`.

The later `ERR_HTTP_HEADERS_SENT` observation had a different cause. A route
could complete `POST /api/presence/heartbeat` with `204`, after which
`express-session` could report a failed store `touch` through `next(err)`. The
global error handler then attempted a second error response even though the
original response had ended. `b8d2bf2` checks `res.headersSent` before any
write: an unfinished committed stream delegates to Express's default handler;
an already-finished response is preserved, receives one fixed sanitized
`post-response` diagnostic, and returns without JSON or rendering. Unsent
ordinary errors retain the fixed generic response. This defect did not cause
the September 14 readiness incident.

## Current map, route, and Guided-VR behavior

Online `/map` and the home preview use the bundled MapLibre/PMTiles campus
basemap. The GitHub Actions publisher produces a signed OSM-derived PMTiles
release in the configured public Drive delivery location. A signed-in user
explicitly downloads or updates `/api/offline-guide`; validated guide JSON and
the PMTiles Blob are stored atomically in IndexedDB. The service worker caches
only the reviewed shell/static allowlist and remains `v45`. Offline data excludes
VR panoramas, schedules, photos, private/admin data, and sessions.

2D route distances sum the Haversine length of each administrator-drawn directed
polyline and round to positive whole metres; walk time uses 1.2 m/s. Entry and
exit geometries remain independently authored. Entry lines are blue (`#2563eb`),
exit lines red (`#dc2626`), and written direction labels remain primary.

The route catalogs are unchanged at `b8d2bf2`:

| Mode | Destinations | Steps | Unique scenes |
| --- | ---: | ---: | ---: |
| Vehicle | 25 | 486 | 101 |
| Walking | 25 | 690 | 133 |

`direction=entry` is the default. `direction=exit` requires `mode=walking` and
reverses a copied approved Walking sequence. Vehicle exits fail closed. Runtime
still requires unique scenes, approved media, exact bidirectional navigation,
and the correct arrival scene.

Academic IV and VI intentionally use `38 -> 85 -> 94`. Academic VI continues
`94 -> 93 -> 92 -> 91 -> scene-chs-1st-floor-001`. SELECT-only Supabase checks
confirmed 670 scenes, all 11 scenes and approved media for the road 85-94 loop,
the intentional `85 <-> 94` shortcut, and 22/22 expected directed links. The
owner confirmed scenes 86-90 are loop/Free-Roam content and stay outside the
Academic VI guided sequence. Green Vehicle arrives at
`scene-green-1st-floor-1`; Green Walking arrives at
`scene-green-1st-floor-9`. Staff House Walking starts at
`scene-guard-house-walk-1st-floor-1`.

## Database and migration boundary

Migration sources are contiguous through `0027` and are owner-reported applied
on the selected Supabase project. Do not reapply an owner-applied migration.
Migration `0027`, final 2D routes, Guided-VR sequences, mappings, hotspots,
sessions, or application data require a fresh focused owner task before change.
Earlier mapping repairs and session revocations are completed history.

Current MySQL parity was deferred for `b8d2bf2`. Do not describe older MySQL
sync evidence as current dual-backend equality. The historical 484-step freeze
also predates the current 486/690 source catalogs and is not a current runtime
write lock.

## Verification and evidence

- **Current Git/source:** product release `b8d2bf2` is pushed and promoted.
  Authority-only predecessors `58298c9` and `55d634a` are pushed; any later
  documentation commit remains self-referential, so always read exact Git
  truth. Final focused checks passed: user presence `34/34`, Vercel runtime/
  session bootstrap `117/117`, Supabase session-store resilience `15/15`, plus
  syntax and whitespace checks. The regression uses a real in-process Express
  app, `express-session`, and a disposable failing-touch store; it uses no MySQL
  and performs no Supabase mutation.
- **Predecessor package evidence:** the `13adb9d` database/session/network-free
  Vercel boundary passed `74/74`: 200 files, 7,461,052 bytes, SHA-256
  `3b6076dcdbdaf10bc6b4e11698e717ca31c2c1024d6494e6bb08bc8316369c9f`.
  It was not rerun for `b8d2bf2` and is not a current package claim.
- **Deferred for this release:** full `npm test`, current MySQL parity,
  `qa:db`, and complete identity verification. Older full-suite results are
  predecessor evidence, not current dual-backend proof.
- **Production:** bounded anonymous GET-only smoke passed `301/301`. Ten
  consecutive `/healthz` requests returned exact `{"status":"ok"}` responses;
  public pages returned `200`; protected HTML redirected `302` to `/auth`;
  protected JSON returned `401`; security headers, no-cookie behavior, safe
  `400`/`404` rejection, and four committed Git-blob comparisons passed. The
  deployment-filtered smoke log window showed Warning `0`, Error `0`, Fatal
  `0`, no `ERR_HTTP_HEADERS_SENT`, and no `5xx`. Its only displayed statuses
  were `200` (16), `302` (7), `401` (8), and `404` (3); the `401`, `404`, and
  `302` rows were intentional negative checks.
- **Guest UAT:** the earlier 25/25 online and 25/25 offline building-panel result
  remains bounded predecessor evidence for `4e9d579`. It was not rerun after
  `b8d2bf2`.
- **Limits:** Production did not undergo a deliberately induced Supabase outage,
  post-`b8d2bf2` authenticated UAT, an authenticated Production presence
  heartbeat, OAuth, administrator writes, exhaustive VR/route traversal,
  disconnected cold reload, real Drive media, or complete immutable-package
  comparison. Final client/panel acceptance remains external.

The `401`, `404`, and `302` rows visible in the current Vercel log screenshot
were created intentionally by the accepted negative security checks; they do
not represent a failed smoke.

The predecessor September 15 Vercel observation found two
`ERR_HTTP_HEADERS_SENT` entries for `POST /api/presence/heartbeat` after `204`
responses, near one session-store `touch` timeout/retry diagnostic. This is not
the cause of the September 14 readiness incident. It is now diagnosed and
addressed by `b8d2bf2`; focused local regression coverage passed, and the new
deployment's inspected log window contained no recurrence. The anonymous
Production smoke did not POST an authenticated heartbeat, so it is not a live
exercise of that exact endpoint path.

## Current limitations and next move

No real CSPC instructor Gmail end-to-end OAuth observation is recorded. MySQL
parity and a current full dual-backend run remain deferred. External systems,
secrets, live data, sessions, and vendor dashboards require authority from the
owner's focused task and must never be inferred from repository access.

The current release has no blocker in its bounded anonymous Production smoke.
The next release-closeout move is review of the exact authority/static-contract
diff and checks, followed by a separately authorized commit and push if green.
Any other add/change/remove feature, data action, broader testing, or deployment
needs its own focused owner task. If a future verification or smoke fails, stop
and ask before rollback, patch, promotion, or redeployment.
