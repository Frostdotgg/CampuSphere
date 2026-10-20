# CampuSphere Session Handoff — 2026-10-19

Last updated: 2026-10-19 (Asia/Manila)

## Purpose and scope

This handoff now describes the local room-scheduling removal candidate.
The completed Walking release and its earlier publication permissions are
history below. Read `docs/room-scheduling-removal.md` for final local evidence
and the later owner-controlled conversion/cleanup/restore steps. No commit,
push, deployment or live cleanup is authorized by this candidate.

## Current Release Continuity (2026-10-19 room-scheduling removal candidate)

Read `docs/current-authority.md`, `docs/room-scheduling-removal.md` and
`docs/session-handoff-2026-10-19.md` before history. This is the uncommitted,
not deployed candidate on `codex/remove-room-scheduling`, based on
`0af76f161443f8259858f4fa67116bc12f51321e`. Recompute live Git truth.
The owner authorized local implementation and focused tests only: no commit,
push, deployment, vendor changes or live data cleanup. Prior permissions do
not carry forward; one writer owns a scope at a time.

A separate owner-approved data operation completed on October 19 at 20:23
Asia/Manila: 73 saved Schedule hotspots became private Info markers in the
Docker app's configured Supabase database. Recorded read-back found zero
Schedule types among 1,469 hotspots. Room names, text, positions and unrelated
hotspots were unchanged; 69 image entries and 2 legacy entries remain intact.
Only hotspot_type and guest_visible were written; existing Guest flags were
already false. Schedule metadata remains for the later full cleanup. External
backups and restore SQL are retained outside Git. This one-time conversion
authorization is complete and grants no further database writes or deployment.

Room scheduling is retired for every role: no schedule editor, schedule image
viewer, legacy schedule read API or schedule hotspots in participant/Admin VR.
Authorized retired-API requests return the standard JSON 404; login, role and
CSRF checks remain. Scene, exit and information hotspots retain their previous
Guest visibility rules. Floor and room descriptions remain available. Building
and panorama image previews, Walking/Vehicle routes and Guided VR are preserved.

The owner chose deletion of saved entries with empty tables/fields retained.
No live rows have been deleted. PostgreSQL/MySQL cleanup scripts under
`database/maintenance/` require owner-controlled target verification, stopped
old writers, an external backup and explicit confirmation. Cleanup converts
schedule hotspots to private Info markers with room names/positions preserved,
clears schedule metadata, then deletes both schedule formats. Restore preparation is offline; records/URLs never belong in
Git. External hosted images and audit history remain untouched. A narrow
same-backend legacy-reference guard protects building deletion until cleanup.
Synchronization tools reject retired schedule content before writing.

Migration sources remain contiguous through 0028; owner-applied 0001 through
0028 is dated prior evidence, not a new database check. No migration is added,
changed or applied. Production uses Supabase/PostgreSQL and Express sessions;
MySQL remains local/fallback/rehearsal. Supabase Auth is not used. The unused
SCHEDULE_DATA_SOURCE switch is removed from source templates, never live env.
Current candidate service worker is v53; shared stylesheet remains v13.
Offline guides already exclude schedules: no guide schema change or forced
redownload is needed for retirement. Walking path updates still require each
device to refresh its downloaded guide. PWA Cache Storage is shell/static-only;
IndexedDB contains the explicit user-downloaded guide and PMTiles Blob.

The October 18 published Walking 2D source remains c533719, feature 9a4a628,
verified deployment dpl_94jYqWkHoC19cLKnfooTVEG8SCyU. October 19's observed
26/26 saved paths, zero missing, does not establish visual walkway approval.
The historical 16/16 Production smoke, 12 Warning rows / 0 Error / 0 Fatal,
session retry uncertainty and online visual-capture limitations remain dated
evidence, not verification of this local candidate. Current full-suite/MySQL
parity, physical-device acceptance and exhaustive route/VR coverage remain
unestablished. ICTU code readiness is separate from actual deployment; saved
walking paths reside in Supabase, not Git. No Vercel/ICTU deployment claim advances.

Focused removal checks and disposable cleanup/restore rehearsals are recorded
in `docs/room-scheduling-removal.md`. These are not a full npm test/qa pass.
The current source package inventory is recorded there after canonical Git-byte
verification; the Walking release's 213-file package pin is historical.
Preserve protected local documents, ignored output and the local exclude file.
A new session's initial turn is read-only and context-only: inventory tools,
read current source, report and stop after grounding, then wait for an explicit
focused owner task. Availability does not expand authority. No automatic
database repair, cleanup, commit, push or deployment follows this candidate.

## Local candidate verification and handoff

The owner subsequently chose to convert schedule hotspots to private Info
markers, retaining room names and positions, instead of deleting those markers.
The prepared PostgreSQL/MySQL cleanup and restore scripts reflect that choice;
the full cleanup has not run against shared data. The separately approved
73-marker type conversion has completed, with schedule entries retained. See
`docs/room-scheduling-removal.md`.

Local evidence: removal fixtures 401/401; disposable cleanup/restore 28/28;
Walking 118/118; offline navigation 49/49; PWA 148/148; VR hotspot navigation
140/140; Vercel startup profile 116/116; documentation 595/595; package 75/75.
Other focused checks and the incomplete legacy Supabase harness attempts are
recorded in the runbook. No full-suite or physical-device acceptance is claimed.
The candidate package is 201 files / 8,577,707 bytes, aggregate SHA-256
`6c20279df6b9297f7859d1b0d01f72f15d863937c7816695919cf269924fe709`.
Protected local documents and original SQL sources remain byte-identical.
The index is empty; no commit, push, deployment or full schedule cleanup has
occurred. The separately authorized 73-marker type conversion is complete.

Next-session order: current authority, removal runbook, this candidate section,
current role grounding prompt, then the relevant source. A later publication
or owner database operation requires its own focused request.

## Historical Release Continuity (2026-10-19 Walking 2D release handoff; superseded by local removal candidate)

Read `docs/current-authority.md`, then `docs/session-handoff-2026-10-19.md`
and the current owner prompts in `docs/new-session-grounding-prompts.md`.
Older continuity sections, test totals and task permissions are historical.

The application release baseline on GitHub main is published source
`c5337195a02d358c71c5a421aaf64268755b5d6f` (`c533719`), containing Walking 2D
feature commit `9a4a628a84f3333071d4d45ad548d98c4d8223d5` (`9a4a628`).
At the October 19 documentation review start, local HEAD, origin/main and
remote main matched that baseline, with ahead/behind 0/0, an empty index and
zero stashes. There were 15 modified tracked files and one untracked October 17
handoff draft. They were review inputs, not an accepted checkpoint. The owner
authorized reviewing/updating the 21 documentation/static-check paths, one
commit and a normal push to main. The resulting documentation commit is
self-referential: recompute live Git truth; do not treat c533719 as the future
documentation HEAD. Preserve any pending delta and protected local documents.

The October 18 verified Production release is
`dpl_94jYqWkHoC19cLKnfooTVEG8SCyU`, source `c533719`, on main, observed Ready,
Production and Current at `https://campusphere-cspc.vercel.app`. This is dated
release evidence, not a fresh October 19 vendor check. The empty Preview
configuration built Ready but returned FUNCTION_INVOCATION_FAILED. The owner
approved a staged Production build using existing Production settings, then
approved checking offline immediately after promotion because temporary-host
protection blocked the basemap download. Both approved checks completed; no
Production secrets were copied to Preview and protection was not disabled.
The recorded rollback target is deployment `2mEQ7Z67TcvfSkNoEjh3Lg9KwmZF`
for `87980c5fe03c68b8f59f0b8fbdc263299c2acbce`. Current Vercel settings are
not reverified. A push may trigger an automatic build; manual promotion,
ICTU deployment and database changes are excluded from this documentation task.

The October 19 Administrator counter showed **26/26 saved walking paths, zero
missing** across route-ready buildings. The owner reports the group finished
drawing. The approved plan's 1/26 and October 18 release's 2/26 (test building
and Academic Building I) are historical snapshots. Saved coverage does not
establish visual approval of every walkway or exhaustive route traversal.
Keep drawing/review instructions in `docs/walking-2d-team-guide.md`; each
device must refresh its downloaded guide after additional paths are saved.

Vehicle is the default online/offline mode. Walking 2D starts at latitude
13.405710, longitude 123.374181 and ends at the existing building pin. One
Administrator-authored path per route-source building has locked, validated
endpoints and intermediate waypoints; the return reverses that same walking
path with equal distance/time. Blue entrance and red return use thin dashed
lines; only the selected route is drawn. Vehicle return geometry remains
independently authored. Mode/destination changes clear stale lines and ignore
late responses. Missing or inconsistent paths remain unavailable, with no
straight-line substitute. Mixed-source IDs require route-source identity,
unique canonical-name and matching-pin checks. Walking VR is a separate catalog.
Signed-in reads and Administrator-only edits retain CSRF, mutation-rate limits,
private/no-store responses and fixed audit messages without path/request data.

Current service worker is `v52`; shared stylesheet is `v13`. Supabase migration
sources are contiguous from `0001` through `0028`. The owner applied 0028;
Codex did not apply/reapply it. October 18 SELECT-only permission evidence
showed anon/authenticated denied SELECT/INSERT/UPDATE/DELETE and service_role
granted all four. The additive MySQL migration and fresh-install table exist
in source; current MySQL migration state and live parity are not verified.
Production application data and Express sessions target Supabase/PostgreSQL;
MySQL remains local development/fallback/rehearsal. Supabase Auth is not used.
Guests may browse buildings/routes/360 scenes, not room schedules; Guest
information hotspots still require explicit Administrator approval.

Walking 2D's 26 saved paths are separate from the Guided-VR source catalog:
25 Vehicle entry destinations / 486 steps / 101 unique scenes, 25 Vehicle exit
destinations / 545 steps / 105 unique scenes, and 25 Walking destinations /
690 steps / 133 unique scenes. The September 24 recorded freeze (670 scenes,
1,465 hotspots) is not fresh live MySQL parity or permission to prune/repair.
Map pins retain no persistent building-name labels. Routing uses stored campus
geometry, not live GPS or automatic rerouting.

The downloaded guide and installed PWA shell are separate. A connected,
signed-in user explicitly downloads/updates guide data and the PMTiles Blob in
IndexedDB; service-worker Cache Storage is shell/static-only. Older saved
guides retain Vehicle navigation and request an update for Walking. GitHub
Actions publishes the basemap, not device guides. Disconnected users retain
their saved copy until a successful explicit refresh. Offline excludes accounts,
sessions, private/Admin data, schedules/images, current announcements/events,
building photos/external media and all 360/Guided-VR/Free-Roam panoramas.
Notifications are the authenticated in-app bell feed, not SMS/email or closed-app
phone push.

October 18 focused results are retained evidence, not fresh tests: Walking
118/118, offline navigation 49/49, PWA lifecycle 148/148, vehicle source-only
131 passed/0 failed, coordinate picker 16, admin basemap 9, map labels 20,
shared buttons 19/19, offline release 21/21, package boundary 75/75, and
dependency audit 0 vulnerabilities after the proxy-addr 2.0.8 patch. The
Production smoke passed 16/16, including five sampled committed asset matches.
Administrator editor/pilot Walking entrance and return, Vehicle routes, a
refreshed guide, disconnected reload, 390 px phone layout and an isolated
older-guide fixture passed their recorded checks. The release guide contained
2 walking paths at that time; this does not test all 26 subsequently saved paths.

The final recorded Production log window had **12 Warning rows, 0 Error,
0 Fatal**, including session-store touch timeout retries. Displayed 200/204
responses do not prove each retry's later outcome; this was not a zero-warning
window. Leaflet's live external tiles were unavailable and its helper was
fixture-tested. Some automated online visual captures showed a blank canvas
after diagnostic/browser changes; fresh loads and the owner confirmed visible
buildings/roads. Complete online pixel verification is not claimed. See
`docs/walking-2d-release-2026-10-18.md` for the detailed release record.
Earlier rejected full-suite/MySQL results and September LT-08's three retry
warnings remain historical. No full npm test/qa pass, live MySQL parity,
physical-device offline acceptance, exhaustive route/VR traversal, complete
OAuth/Admin coverage, write capacity, permanent provider availability, complete
immutable deployed-byte equality or institutional adoption is established.

The unchanged Vercel source package is 213 files, 8,755,240 bytes, aggregate
SHA-256 `55bd59fb311569ef55a137f1d6bcbe9e56844dc4cf607555af12f54740a49990`.
Compare staged Git bytes with c533719 to avoid Windows line-ending false alarms.
This is source-package evidence, not complete immutable deployed-byte proof.
ICTU Docker code is on GitHub, including Walking 2D; saved routes reside in
Supabase, not Git. The tracked Docker profile uses external Supabase for data
and sessions. A rebuild configured for that same project can read its saved
paths; a different database needs separately authorized schema/data transfer.
Source readiness is not proof of an actual ICTU deployment.

The local-only output documents/backups and .git/info/exclude are preserved;
ignored files are not disposable and are not part of a clone. No application,
API, schema, saved route, environment or deployment changes belong in this task.
After the reviewed commit/push, a new owner session's initial turn is read-only
and context-only: inventory actual capabilities, read current authority/source,
recompute Git truth, report and stop after grounding, then wait. Availability
does not expand authority. Prior permissions do not carry forward. The next
panelist change is not yet specified; obtain one focused feature or bug fix,
its roles/data/offline effects and acceptance checks before implementation on
a fresh branch from then-current clean main. One writer owns a scope at a time.
Do not automatically resume MySQL remediation, deploy or reapply migrations.

## Historical Walking release: preservation and documentation validation

The 16 pending handoff paths were backed up before editing with raw SHA-256
fingerprints. The protection manifest also covers tracked files outside the
21-path scope, local output documents/backups, academic files and the checkout's
local exclude file. Backup files are outside Git. Historical continuity text
and prior standalone prompt bodies are retained with superseded headings.
No actual environment/credential file is included in the review package.

The current validation scope is JavaScript syntax, the isolated network-free
documentation gate, independent rejection fixtures, synchronized blocks,
standalone role prompts, referenced paths, UTF-8/whitespace, added-line secret
patterns and staged-Git runtime inventory equality against c533719. The isolated
loader blocks server, database, credential and network operations. These checks
prove bounded documentation/static consistency only; they do not rerun the
October 18 application probes or establish a full-suite pass.

The retained anonymous smoke's 16 named results and deployment observations
were reviewed from the local release record; screenshots/raw diagnostic
artifacts stay outside the Git/Vercel package. The portable release guide
records their safe summaries and limitations. Do not treat screenshots of a
blank online canvas as successful line-render proof or relabel pilot evidence
as exhaustive 26-path validation.

## Historical Walking release: Source map for the next focused task

| Area | Local source to read; do not execute during grounding |
| --- | --- |
| Walking read/edit and permissions | controllers/walkingRouteController.js; routes/map.js; routes/admin.js |
| Validation, metrics and return | services/walkingRouteService.js |
| MySQL / Supabase storage | services/walkingRouteService.js; repositories/walkingRouteRepository.js |
| Route-source identity/availability | services/routeAvailability.js |
| Administrator editor | views/admin/campus-map.ejs; public/js/admin/admin-walking-routes.js |
| Online route display | views/map.ejs |
| Offline guide and map | services/offlineGuideService.js; public/js/offline-guide-manager.js; public/offline.html |
| Cache/style versions | public/sw.js; public/css/styles.css |
| Migration sources | database/supabase/0028_walking_2d_routes.sql; database/0028_walking_2d_routes.mysql.sql; database/schema.sql |
| Docker source readiness | Dockerfile; docker-compose.yml; docs/deployment.md |
| Focused retained probes | scripts/walking2dRoutes-probe.js; scripts/offline2dNavigation-probe.js; scripts/off2PwaLifecycle-probe.js; scripts/vercelPackageBoundary-probe.js |
| Separate Guided-VR catalog | config/guidedVrRoutes.js; config/selectedDemoFreeze.js |

## Historical Walking release: remaining work and next-session reading order

### October 19 documentation validation

- JavaScript syntax and the isolated documentation gate passed **564/564**
  assertions, with no attempted server/database/credential/network operation.
- All eleven current continuity blocks match after line-ending normalization.
  Eleven archived October 17 blocks and all 24 prior fenced prompt bodies are
  preserved. Both new standalone role prompts pass their own checks.
- All 508 protected file fingerprints match the pre-edit backup. The 193
  unrelated top-level checker functions are unchanged from c533719; runtime
  and security checks were not altered or executed.
- The 68 newly referenced concrete source/document paths resolve. UTF-8,
  added-line secret-pattern, approved-scope and whitespace checks passed.
- The staged-Git runtime inventory matches c533719 entry-for-entry: 213 files,
  8,755,240 bytes, aggregate SHA-256
  `55bd59fb311569ef55a137f1d6bcbe9e56844dc4cf607555af12f54740a49990`.
  All 21 approved paths are excluded by the unchanged Vercel allowlist.

These are documentation/source checks, not a fresh application or Production
test. The resulting documentation commit and remote equality are reported
after the authorized commit/push; use live Git for its actual SHA.

### Reading and next task

1. Read docs/current-authority.md, this note, then AGENTS.md/CLAUDE.md and the
   current Codex or Claude Code prompt in docs/new-session-grounding-prompts.md.
2. Read docs/walking-2d-release-2026-10-18.md and docs/walking-2d-team-guide.md.
3. Read current summaries in the handoffs, plan/roadmap, README and deployment,
   security, demo and test-evidence guides; follow the focused source map above.
4. Read docs/session-handoff-2026-10-17.md as history for local research artifacts,
   academic qualifications and older work. Preserve those files. The 472 survey
   versus 467 complete SUS records, SUS 65.16/100 (not percent), five evaluators
   versus seven form sets and executed 200-user versus planned 300-user evidence
   remain separate. Further Sprint paragraphs were chat-only, not inserted into
   DOCX. Do not silently change manuscripts/slides from later repo evidence.
5. Recompute Git root, branch, full HEAD, origin/main, remote main, ahead/behind,
   index/worktree/untracked and stash status. First-turn grounding reports and
   stops. It does not review a pending diff, run tests or access services.

All current buildings have saved walking paths. Visual walkway approval,
physical-device acceptance, deferred full-suite/MySQL checks and any actual
ICTU deployment remain separate work requiring the owner's focused scope.
The next panelist change is not yet specified. Agree one feature's behavior,
roles/data/offline impact and acceptance checks before implementation; use a
fresh branch from then-current clean main and one writer per scope.
