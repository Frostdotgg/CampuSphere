# CampuSphere Current Authority

Last updated: 2026-09-14 (Asia/Manila)

This is the canonical current-state summary. Detailed historical evidence stays
in the handoffs, plan, roadmap, deployment, and test-evidence files. Recompute
live Git and external state before treating a recorded checkpoint as current.

## Git and release state

At the start of this documentation synchronization, branch `main` had local
`HEAD`, `origin/main`, and remote `main` equal at
`4e9d5798ec2230c861a088808c39abc8a2b59937` (`4e9d579`), with a clean index and
worktree and zero stashes. The owner separately authorized review of the exact
18-file authority/static-contract candidate, one commit, and a push to `main`.
Because the final authority commit contains this self-referential record, fresh
sessions must recompute its exact SHA and status.

Current lineage:

- `13ae67c`: Academic II, Multi-Purpose I, and Green destination-route fixes.
- `f9679f6`: full Walking catalog, travel-mode chooser, MapLibre/PMTiles maps,
  building/start labels, home preview, and aligned offline start marker.
- `4e9d579`: Walking exits, direction-aware navigation, Academic IV/VI shortcut
  preservation, and guarded Academic VI mapping diagnostics.

The owner promoted `4e9d579`. Vercel was observed signed-in with that `main`
deployment `Ready` in `Production`. The canonical alias is
`https://campusphere-cspc.vercel.app`. The corrected Production smoke and guest
UAT described below passed.

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

At `4e9d579` the source catalogs contain:

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

Current MySQL parity was deferred for `4e9d579`. Do not describe older MySQL
sync evidence as current dual-backend equality. The historical 484-step freeze
also predates the current 486/690 source catalogs and is not a current runtime
write lock.

## Verification and evidence

- **Current Git/source:** product release `4e9d579` is pushed. Its later
  authority-only successor is the live `HEAD` after this authorized push, so
  read its exact SHA from Git. Focused syntax, whitespace,
  Guided-VR resolution/navigation, public rendering, Supabase catalog/flow, and
  Academic VI read-only preflight checks passed.
- **Package:** the database/session/network-free Vercel boundary passed `74/74`:
  200 files, 7,449,738 bytes, SHA-256
  `297eedb119406de523a350cb1c2d41969894f99354a79e3b47f1d081296bf6c4`.
- **Deferred for this release:** full `npm test` and MySQL checks. The September
  10 `QUALITY-GATES OK`, five-stage QA, residue `18/18`, and BE.6 `46/46` are
  predecessor evidence.
- **Production:** corrected anonymous GET-only smoke passed `207/207`. It
  covered health, safe edge rejection, protected-route denial, security headers,
  no-cookie behavior, and sampled Git-blob equality. It excluded login, OAuth,
  schedules, administrator/vendor writes, and database mutation.
- **Guest UAT:** all 25 online and all 25 offline building panels opened. The
  offline guide reported 25 entry/25 exit routes. Academic VI entry rendered
  375 m / 5-6 minutes and exit 461 m / 6-7 minutes.
- **Limits:** the UAT did not traverse every Guided-VR scene, draw every route,
  prove disconnected cold reload, test administrator writes, schedules, OAuth,
  or real Drive media. Sampled assets do not prove immutable equality for the
  complete deployed package. Final client/panel acceptance remains external.

The first Production smoke attempt had three verifier-contract mismatches: a
stale expected health body, a `404`-only assertion where Vercel safely returned
`400`, and comparison against CRLF-normalized Windows working-copy bytes. The
corrected smoke compared deployed assets with committed Git blobs and passed.

## Current limitations and next move

No real CSPC instructor Gmail end-to-end OAuth observation is recorded. MySQL
parity and a current full dual-backend run remain deferred. External systems,
secrets, live data, sessions, and vendor dashboards require authority from the
owner's focused task and must never be inferred from repository access.

The current release has no blocker in the bounded Production smoke or guest
online/offline UAT. The next product move is an owner-selected bug fix or
add/change/remove feature. A later release should review and test its exact
scope, then use separate commit/push and deployment authorization. If a future
verification or smoke fails, stop and ask before rollback, patch, promotion, or
redeployment.
