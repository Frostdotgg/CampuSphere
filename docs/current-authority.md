# CampuSphere Current Authority

Last updated: 2026-09-10 (Asia/Manila)

This file is the canonical current-state summary for the repository. Detailed
historical records remain in the handoffs, plan, roadmap, and evidence files,
but a historical block must not override this file. Recompute live Git truth
before relying on any recorded checkpoint.

## Current Git and Source Lineage

At the start of this Guided-VR release, branch `main` had local `HEAD`,
`origin/main`, and remote `main` equal at Git commit SHA-1
`05b0545ccefbf282c365244c7f9edf8f2be5810c` (`05b0545`). The index was
empty, the worktree contained only the owner-requested
`config/guidedVrRoutes.js` change, and there were zero stashes. The final
release commit that contains this edit is necessarily later, so a fresh session
must recompute its full SHA rather than infer it from this record.

Important current lineage:

- `5d505e97e990ad82df6c858e28d48542deb8bf2c` (`5d505e9`) — role-aware
  guest/event/VR access and admin instructor-profile integrity.
- `23c55365198198276f17364f15523da2eb233df2` (`23c5536`) — directional
  online/offline entry and exit routing.
- `d294cfd40a4b4a3b49e5768df1ca594a662184a0` (`d294cfd`) and
  `217f077102561404f8a7c7b8f77fc094b3ecc72f` (`217f077`) — the preceding
  pushed authority synchronizations.
- `918f721e6daba92357f83db22e4b1741195f8526` (`918f721`) — automatic route
  edge distance and walk-time calculation from administrator-drawn geometry.
- `83f247a6228d7e115e12803d00e1f88da60ee966` (`83f247a`) — validated Google
  Drive media references alongside Cloudinary delivery references.
- `86b92eb83ec4f4d3c8bc13ba4b987d7a79fc0853` (`86b92eb`) — portable thesis-
  teammate handoff authority and source-grounding documentation.
- `3d0a2b6226accaaf95fc58a03338093f721ce501` (`3d0a2b6`) — entry routes blue
  and exit routes red in the online and offline route renderers.
- `8e6053e52b5e1feaa643f4f0ec1931d68d9bd550` (`8e6053e`) — pushed authority
  successor recording the route-color release.
- `7b4e818e7a84c60cb49b4a14889a98c3c7c528a2` (`7b4e818`) — pushed owner-
  continuity authority deployed and independently verified in Production.

- `05b0545ccefbf282c365244c7f9edf8f2be5810c` (`05b0545`) is the pushed
  post-deployment authority successor and starting point for this Guided-VR
  route release.

Earlier dashboard-image, presence, campus-UI, and dependency-security commits
remain `fdb0c8c`, `621d72e`, `b8e7ffb`, and `a5a6cee` respectively.

Commit `3d0a2b6` keeps entry routes blue (`#2563eb`) and renders exit routes red
(`#dc2626`) in online and offline route views. Written Entry/Exit labels remain
the primary direction cue, and the service-worker cache key is `v45`.

The current release adds the completed walking Guided-VR catalog and the
walking/vehicle choice page, MapLibre/PMTiles rendering for online and offline
maps, readable building/start labels, the corrected home map preview, and the
offline start-marker alignment. The owner-authorized local MySQL campus/VR sync
used natural-key upserts, preserved local-only and protected records, repaired
ten retained route-edge endpoints after the shared library node refresh, and
removed one stale duplicate Guided-VR link. Supabase was not changed by those
local repairs.

## Architecture and Runtime Boundaries

CampuSphere is a server-rendered Node.js `>=22`, Express 5, and EJS application.
Production application data and Production Express-session storage target
Supabase/PostgreSQL. MySQL remains the local-development, fallback, and local
rehearsal backend. Runtime data-source switches select the repository path by
domain; Supabase Auth is not used.

Identity and authorization remain application-controlled: bcrypt local
credentials, Google OAuth, `express-session`, CSRF protection, role checks, and
server-side validation. Supabase is reached only from server-side repositories
with the service-role key. RLS and revoked browser-role grants protect selected
server-only tables, but the service role bypasses RLS; Express authentication
and authorization therefore remain the per-user enforcement layer. Helmet
provides nonce-based CSP and related HTTP security headers. Upstash Redis is a
Vercel-only shared rate-limit store, while GitHub Actions is offline-map
publishing automation rather than an application runtime dependency.

Roles are `guest`, `student-cspc`, `instructor`, and `admin`. Signed-in guests
may browse all buildings, 2D routes, and 360 scenes, but schedules stay limited
to CSPC students, instructors, and administrators. Scene and exit hotspots are
guest-visible, information hotspots require explicit administrator approval,
and schedule hotspots are never guest-visible. Events are filtered by their
administrator-selected audience. Admin creation or promotion of an instructor
guarantees one minimal `instructor_profiles` row without overwriting existing
profile values.

## Guided-VR Route Release

Academic Building II now follows the owner-selected corridor and completes in
31 steps at `scene-acad-2-1st-floor-17`. MULTI-PURPOSE-BUILDING I follows the
same corridor through road scenes 33, 33-5, 37, 38, 38-5, 54, 53, and 57-60,
then continues through 61-64 to `scene-audit-building-006`, completing in 35
steps. Green Building follows road scenes 33, 33-5, 37, 38, and 38-5 and now
completes in 25 steps at `scene-green-1st-floor-1`.

The owner-authorized Supabase mapping and matching local MySQL rehearsal
mapping assign `scene-green-1st-floor-1` to natural destination node `green`
and leave former arrival `scene-green-1st-floor-7` unmapped. The owner also
confirmed four intentional Supabase hotspots: the bidirectional Guard House
walk pair and the bidirectional road-32/CITD-floor-8 pair. No schema or
migration changed.

The refreshed shared catalog has 25 active destinations, 484 configured steps,
and 100 unique scene keys. MySQL remains at 671 scenes and 1,410 hotspots;
Supabase remains at 664 scenes and now records the four confirmed rows for
1,378 hotspots. Both backends verify all 25 configured media/link/endpoint
chains.

## Route Geometry and Metrics

Commit `918f721` replaced the earlier cancelled proposal with an implemented
route-metric workflow. For each directed edge, the shared server helper sums
the Haversine length of every segment in the administrator-drawn polyline,
rounds to a positive whole metre, and derives a positive whole-second walk time
at 1.2 metres per second. Entry and exit directions remain independently drawn
and independently saved.

Supabase migration `0027_route_edge_geometry_metrics.sql` is owner-applied. Its
`SECURITY INVOKER`, fixed-search-path RPC locks the selected edge and endpoint
nodes, validates positive metrics and endpoint-connected geometry, and grants
execution only to `service_role`. The owner-supplied postflight showed the
expected single function/signature, no `PUBLIC`, `anon`, or `authenticated`
execution, `service_role` execution, 26 route nodes, 50 directed edges, 50
stored geometries, zero null geometries, zero invalid geometry shapes, and zero
invalid metrics, with `postflight_pass = true`.

The 50 existing directed-edge metrics were recalculated and updated in place;
routes were not deleted or recreated. The owner subsequently redrew multiple
entry/exit edges, a read-only correction pass was repeated, and the owner
confirmed the resulting route drawings as final and visually correct. This is
owner-accepted data/UAT evidence, not an immutable database snapshot.

The selected 2026-09-06 Supabase building/route fingerprint
`8143e5d1bf3f5e4b4acb1c39253950dc60b737e4aa7d21422356ff288ce9ca64` predates
those intentional route/metric changes and remains historical evidence. This
historical fingerprint must not be described as the current live Supabase route fingerprint. A
separately authorized SELECT-only double-read on 2026-09-09 found stable final
route data: 25 buildings, 26 route nodes (including `main-gate`, the Guard
House / Main Gate start), 50 directed edges, 25 reverse pairs, and 50 valid
geometries. The refreshed current Supabase route fingerprint SHA-256 is
`a59b44716e67260b1be1ed398039784a576d42802e3db2ac5d8291f88c0700d1`, and the
expanded-freeze manifest SHA-256 is
`32563b6f725c2bd41f3b409c1779d51d9db36ea293d80c32aacb7a204cd34e38`.
`config/selectedDemoFreeze.js` remains a QA record, not a runtime write lock;
the refresh did not change any 2D route or migration.

## Media Delivery

Commit `83f247a` allows administrators to store either an approved Cloudinary
delivery URL or an exact Google Drive single-file share URL for building
pictures, room-schedule images, and 360 panoramas. CampuSphere does not upload,
delete, transform, share, or manage files in either vendor.

Drive references render through authenticated same-origin endpoint
`/api/media/google-drive/:fileId`. The proxy follows only approved Google HTTPS
redirects, limits responses to 50 MiB, verifies the declared type against file
signatures, and serves only JPEG, PNG, or WebP. HEIC/HEIF is not supported and
must be converted before use. Drive-backed media and schedule images remain
online-only and are excluded from offline-guide packages. The owner reports the
feature working and removed the temporary content used for manual testing.

## Migration Authority

Supabase migration sources are contiguous from `0001` through `0027`. For the
owner-selected Supabase project, migrations `0001`-`0027` are owner-applied.
Migrations 0001-0027 are owner-applied on that selected project.
Codex did not apply or reapply the owner-managed migrations. Do not reapply an
owner-applied migration without fresh explicit database authorization. On a
new, empty Supabase project, apply each migration once in numeric order and
verify that environment separately.

## Evidence Classes

- **Current source/Git:** commits `918f721`, `83f247a`, `86b92eb`, `3d0a2b6`,
  `8e6053e`, `7b4e818`, and `05b0545` are pushed predecessors. The final
  Guided-VR release commit contains this self-referential file, so its exact SHA
  must be read from live Git.
- **Recorded source/local QA:** the earlier route-color checks remain recorded.
  On 2026-09-10 a fresh full `npm test` exited `0` with
  `QUALITY-GATES OK`; its MySQL and Supabase session-store legs completed and
  the final canonical session-residue check passed `18/18`. All five
  `npm run qa` stages were green, the package boundary passed `74/74`, and the
  final BE.6 double-read passed `46/46`. This is source/local evidence, not
  Production evidence.
- **Owner-observed database/UAT:** migration `0027`, its postflight, the in-place
  50-edge metric correction, later route edits, final route approval, Drive
  testing, the Green endpoint transfer, four intentional hotspots, cleanup,
  and manual promotions are owner-supplied, owner-authorized, or owner-accepted
  evidence.
- **Independently verified vendor/deployment:** Vercel deployment
  `dpl_CG3M2Wp4hdMUR1abBFJdv5mqgtNs` was independently observed bound to branch
  `main` and full source commit `7b4e818e7a84c60cb49b4a14889a98c3c7c528a2`,
  with state `Ready`, environment `Production`, and assignment `Current` for
  canonical alias `https://campusphere-cspc.vercel.app`.
- **Independently verified Production:** a corrected bounded anonymous,
  read-only, GET-only smoke passed `127/127` against the canonical alias. Public
  routes and health responded as expected; protected HTML redirected to
  `/auth`; protected JSON returned fixed `401` JSON; checked application
  responses set no cookie and retained the expected security headers. Remote
  bytes exactly matched the Git `7b4e818` blobs for
  `public/js/offline-guide-manager.js`, `public/sw.js`,
  `public/css/styles.css`, and `public/js/public-nav.js`. The sample also
confirmed entry blue `#2563eb`, exit red `#dc2626`, and service-worker `v45`.
  This establishes `7b4e818` as the current independently post-deployment-
  verified technical Production baseline, but the four sampled assets do not prove immutable equality for the entire deployed package. The earlier
  `fea3b2e11c6331eddc1ee091b165427d8e0218d7` baseline is historical.
- **External disposition:** final thesis/client acceptance and any final
  milestone disposition remain owner/client decisions.

The first ad hoc Production checker exited nonzero because its assertions
incorrectly required `X-Frame-Options: DENY` instead of the established CSP
`frame-ancestors 'none'` control, expected dynamic Helmet headers on Vercel-
served static files, and searched `public/sw.js` for color literals owned by
`public/js/offline-guide-manager.js`. Those were verifier-scope false negatives,
not application failures; the corrected bounded contract is the `127/127`
result above.

The current source package after the Guided-VR, MapLibre, and offline UI refresh
is 200 files, 7,437,974 bytes, aggregate SHA-256
`375a6f26dcd375837621fc9fc2fe07f1bc1ee5886255cbe9c56f05a7c1907bc6`.
This is source/package evidence, not deployed-byte proof. The earlier 197-file
package pin belongs to an older source set and remains historical only.

## Known Limitations and Next Moves

- No real CSPC instructor Gmail end-to-end OAuth observation is recorded.
- Temporary regression accounts and owner-managed UAT content must be handled
  according to the owner's client-handoff policy; credentials and account
  identifiers must never be placed in documentation or a source archive.
- Possessing this repository does not grant access to Supabase, Vercel,
  Cloudinary, Google Drive, Google OAuth, Upstash, GitHub Actions secrets, live
  sessions, or Production data.

The owner authorized this synchronized release commit and push to `main` and
retains sole control of Vercel promotion. Deployment identity verification and
any bounded Production smoke for the new commit require separate authorization
after the owner promotes it. Until then, `7b4e818` remains the current
independently post-deployment-verified technical Production baseline. Migration
`0027` and the owner-confirmed final 2D routes must remain untouched unless
separately authorized. If any future deployment verification or smoke fails,
stop and ask the owner rather than automatically rolling back, patching,
promoting, or redeploying.

The immediate authority track is the owner-controlled commit/push and promotion
boundary; the next product move is an owner-selected bug fix or feature after
separate authorization.
