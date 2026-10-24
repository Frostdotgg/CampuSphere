# CampuSphere Session Handoff — 2026-10-24

Last updated: 2026-10-24 (Asia/Manila)

## Current Release Continuity (2026-10-24 documentation publication)

Read `docs/current-authority.md`, then `docs/session-handoff-2026-10-24.md`
and the current role prompt in `docs/new-session-grounding-prompts.md` first.
The owner authorized one reviewed documentation/static-check commit and a
normal push to main for this 19-file handoff. An automatic unpromoted staged
build is allowed; Production promotion is not authorized. No deployment
settings may be changed. This authorization is limited to this publication
task and does not carry forward to new sessions.
The preparation baseline is `2c0a1bfca4090aedbba38aa77a8d287aaa2bdeb8`:
local main, origin/main and remote main matched; the 19 reviewed paths were
pending, the real index was empty, stashes were zero and ahead/behind was 0/0.
The resulting documentation SHA and actual push/build outcome are recorded
afterward in the external publication receipt. Do not invent that SHA or
assume publication succeeded from this text. Recompute live Git truth.
The released runtime baseline remains 2c0a1bf; a documentation-only commit
does not change the live deployment or establish fresh application acceptance.

The Campus-wide Events product is
`509518f9fbbbd89edc49e98feb3582e635135c0f`, deployment
`dpl_HzhVWaEXzmDkdAWFTQrqWfykZxda`. Its identical-runtime documentation
successor is `2c0a1bfca4090aedbba38aa77a8d287aaa2bdeb8`, final deployment
`dpl_Dkjck5qX73P1jpZryiP7iT3hGkk4`, observed Ready / Production / Current
at https://campusphere-cspc.vercel.app on October 23. These are dated October
23 Production observations from the sanitized final receipt, not a fresh
October 24 vendor check. See `docs/campus-wide-events-release-2026-10-23.md`.
The release used normal pushes and staged Production promotion. Automatic
Production domain assignment was disabled; protection and secrets were
unchanged. Reverify settings and rollback eligibility for any future release.

Campus-wide is Events-only, displayed as Campus-wide and stored/API-coded
`university-wide`; the literal `campus-wide` API value is rejected. Existing
events display/edit with that label without rewriting records on read. News
and account assignments use seven departments only. The departments are
Graduate School, CEA, CCS, CHS, CTHBM, CTDE and CAS; full names and codes are in
`utils/departments.js`. Main Administrators explicitly select a department;
Department Administrators default to their assigned department and can edit
across departments. Events offer Campus-wide first. All departments remains
a filter; switching Campus-wide Events filtering to News resets it to All
departments. Article categories are General, Academic, Advisory, Maintenance
and Emergency; Events retain Academic, Sports and Cultural. Event/Events
article choices and Facilities content choices remain retired; building-map
Facilities remains available. Audience restrictions and draft privacy remain.

Department Administrator access is restricted to `/admin/news` and required
authentication, CSRF, heartbeat, assets and news/event operations. Other
application pages and unrelated APIs are denied server-side. Only the main
Administrator manages accounts, department assignments and credentials;
role/department/password changes revoke old sessions. Public registration
cannot create department admins. Do not claim seven permanent accounts were
created: the owner reported one, and no fresh account count was queried.

Walking 2D is released, using independently saved pedestrian paths. Its return
reverses the same path; Vehicle return geometry remains independently authored.
Walking 2D, Vehicle routing and Walking VR are separate. The dated 26/26 saved
paths, zero missing observation does not establish visual approval of every
walkway or exhaustive traversal. Walking Steps are generated automatically;
there is no editable ordered-instructions field. Custom instructions and the
displayed "1 minutes" wording were discussed only; no change was implemented
or approved. The next product task has not been selected. Ground and wait.

Room Scheduling / Room Plotting removal is released. Authorized retired APIs
return standard JSON 404 with authentication, role and CSRF checks retained.
Schedule types/metadata are omitted from VR responses and rejected on writes.
Floor/room descriptions remain. The dated conversion retained 73 private Info
markers across 65 scenes with names/positions preserved. Scene/exit hotspots
remain Guest-visible; Info requires explicit Administrator approval for Guests.
The recorded 69 schedule-image entries, two legacy entries and metadata were
retained, not deleted; this is not a fresh database count. Preserve audit history,
empty-compatible tables/fields, external hosted images and the legacy-reference
building-deletion guard. Schedule cleanup needs a separate focused owner task.

Retry-log pairing and request-lifetime fixes remain released. Preserve 2,000 ms
per attempt, two attempts and 200 ms retry delay. Each admitted retry warning
reserves its own recovered/failed outcome and opaque operation_id; admission
is one pair per operation, initial failure category and status per 60 seconds.
Standalone failures keep their limiter. Logger failure, termination or retention
can hide outcomes. `@vercel/functions` 3.10.1 waitUntil retains expiry refresh
through retry/callback settlement. Synchronous changed-session persistence,
expiry, scoped logout, cookies, privacy and completed-response protection stay;
expiry-only refresh is not a full-session save. Docker/MySQL work without a
Vercel request context. The local lifetime model does not prove every historical
provider/network cause or actual cloud freezing behavior.

The sign-in investigation reproduced browser/automation problems; a general
application login failure or Chrome-engine defect was not established. No
application login patch was made. Register observation before one submission;
wait for the original tab's role URL, ready DOM and visible heading under one
30-second deadline. Do not use global network idleness or automatically
resubmit. Missing POST/input delivery is inconclusive. A fresh-tab diagnostic
does not prove original-tab navigation. Unresolved input-dispatch cases,
cancelled-navigation spinner and the early fixture-cookie limitation remain
recorded in the October 24 handoff; do not claim complete browser-profile or
downloaded-guide preservation. Loading-state hardening remains separate.

Only temporary event 26 was removed in the October 23 release; its six audit
records remain. SELECT-only comparison preserved all original 9 articles and
12 events (5/5), with audit checks 3/3. Those are dated observations, not fresh
database counts. No account changes, migration, existing-post cleanup, schedule
cleanup or ICTU deployment ran. Normal authentication/session/presence writes
were permitted. Existing-post cleanup policy v2 selects articles with department
university-wide OR category Facilities, and events with category Facilities
only. Valid Campus-wide events survive. Older generated deletion plans are
obsolete; fresh preparation, external backup and owner review are required.

October 23 focused results: content/access/privacy 1,137/1,137; editor 32/32;
disposable PostgreSQL/MySQL cleanup/restore 35/35; session bootstrap/resilience/
lifetime 160/160, 73/73, 72/72; startup 116/116; rate limits 180/180;
notifications 26/26; audiences 13/13; offline 49/49; PWA 148/148; Walking
118/118; scheduling retirement 401/401; analytics 113/113; login timing 8/8;
package 76/76; documentation 942/942 (predecessor evidence); isolated cache
upgrade/reverse activation 6/6; product and final public smoke 22/22 each.
The browser record has 72 successful observations and four earlier inconclusive
attempts, not a combined QA total. Earlier missed actions, premature captures
and the audit checker's event_type/action mistake remain preserved.

October 23 UTC watches: staged 04:52:32.889–05:02:47.615 (614.726 seconds),
product live 05:03:26.882–05:13:39.050 (612.168 seconds), final live
05:18:54.232–05:29:32.612 (638.38 seconds). Loaded closing Runtime Logs views
showed 0 Warning / 0 Error / 0 Fatal; exact-deployment heartbeat messages were
expanded. No natural retry was observed to correlate and no failures were
manufactured. These finite windows do not promise future provider availability.
Keep earlier warnings, corrected counts, monitoring gaps, laptop interruption
and fresh October 21 closing watch as separate history. HTTP 200/204 does not
prove every refresh succeeded. No full npm test/QA pass, live MySQL parity,
physical-device acceptance, exhaustive route/VR traversal or complete immutable
deployed-byte equality is claimed.

Current runtime identity: 205 files / 8,611,691 bytes, SHA-256
`12fb08e21976a482a0a52a61ea4495287e1d50724fa7c3366f27ba52477a5eb6`.
Compare canonical Git bytes, not Windows checkout line endings. Cache v56;
stylesheet v13; migration sources through 0029. The owner applied additive
0029 during Department News release after backup; this handoff applies none.
Production data and Express sessions use Supabase/PostgreSQL; MySQL is
local/fallback/rehearsal. Authentication is Express sessions with bcrypt local
login and Google OAuth; Supabase Auth is not used. Docker localhost's selected
Supabase connection is shared, so localhost does not isolate saved data.
The ordinary checkout lacks ignored node_modules/@vercel/functions; do not
repair dependencies automatically. Prior focused checks used complete source
and matching locked external dependencies, fake providers and isolation.

IndexedDB stores the explicit user-downloaded guide and PMTiles; Cache Storage
is shell/static-only. Download/update needs a connected signed-in action on
each device. News/events, schedules, private/session data and VR/panoramas are
excluded from guides. The guide format is unchanged; ordinary logout removes
the owned guide under existing privacy behavior. ICTU source readiness is not
an actual ICTU deployment; saved paths reside in Supabase, not Git.

Preserve protected local documents, ignored output, .git/info/exclude and
external evidence. Credentials and private database snapshots never belong in
handoffs or prompts. Prior permissions do not carry forward; one writer owns
a scope. Inventory available MCP tools and skills without accessing services;
read applicable skill instructions, and do not assume identical integrations.
A new session's initial grounding turn is read-only and context-only: local
source and read-only Git including remote main, report and stop after grounding.
No automatic tests, servers, containers, browser/database/vendor access,
dependency repair, feature work, delegation, commit, push or deployment.
Availability does not expand authority. Wait for one focused owner request.

## Historical Release Continuity (2026-10-24 local authority synchronization; superseded by documentation publication)

Read `docs/current-authority.md`, then `docs/session-handoff-2026-10-24.md`
and the current role prompt in `docs/new-session-grounding-prompts.md` first.
The October 24 task updates documentation and documentation assertions locally
only. No commit, push or deployment is authorized. The preparation baseline is
`2c0a1bfca4090aedbba38aa77a8d287aaa2bdeb8`: local main, origin/main and remote
main matched with clean worktree, empty index, zero stashes and ahead/behind
0/0. After this update the documentation is intentionally uncommitted; do not
claim the entire working tree matches GitHub or deployed source. Recompute live
Git truth before later work. No new documentation commit identity exists yet.

The Campus-wide Events product is
`509518f9fbbbd89edc49e98feb3582e635135c0f`, deployment
`dpl_HzhVWaEXzmDkdAWFTQrqWfykZxda`. Its identical-runtime documentation
successor is `2c0a1bfca4090aedbba38aa77a8d287aaa2bdeb8`, final deployment
`dpl_Dkjck5qX73P1jpZryiP7iT3hGkk4`, observed Ready / Production / Current
at https://campusphere-cspc.vercel.app on October 23. These are dated October
23 Production observations from the sanitized final receipt, not a fresh
October 24 vendor check. See `docs/campus-wide-events-release-2026-10-23.md`.
The release used normal pushes and staged Production promotion. Automatic
Production domain assignment was disabled; protection and secrets were
unchanged. Reverify settings and rollback eligibility for any future release.

Campus-wide is Events-only, displayed as Campus-wide and stored/API-coded
`university-wide`; the literal `campus-wide` API value is rejected. Existing
events display/edit with that label without rewriting records on read. News
and account assignments use seven departments only. The departments are
Graduate School, CEA, CCS, CHS, CTHBM, CTDE and CAS; full names and codes are in
`utils/departments.js`. Main Administrators explicitly select a department;
Department Administrators default to their assigned department and can edit
across departments. Events offer Campus-wide first. All departments remains
a filter; switching Campus-wide Events filtering to News resets it to All
departments. Article categories are General, Academic, Advisory, Maintenance
and Emergency; Events retain Academic, Sports and Cultural. Event/Events
article choices and Facilities content choices remain retired; building-map
Facilities remains available. Audience restrictions and draft privacy remain.

Department Administrator access is restricted to `/admin/news` and required
authentication, CSRF, heartbeat, assets and news/event operations. Other
application pages and unrelated APIs are denied server-side. Only the main
Administrator manages accounts, department assignments and credentials;
role/department/password changes revoke old sessions. Public registration
cannot create department admins. Do not claim seven permanent accounts were
created: the owner reported one, and no fresh account count was queried.

Walking 2D is released, using independently saved pedestrian paths. Its return
reverses the same path; Vehicle return geometry remains independently authored.
Walking 2D, Vehicle routing and Walking VR are separate. The dated 26/26 saved
paths, zero missing observation does not establish visual approval of every
walkway or exhaustive traversal. Walking Steps are generated automatically;
there is no editable ordered-instructions field. Custom instructions and the
displayed "1 minutes" wording were discussed only; no change was implemented
or approved. The next product task has not been selected. Ground and wait.

Room Scheduling / Room Plotting removal is released. Authorized retired APIs
return standard JSON 404 with authentication, role and CSRF checks retained.
Schedule types/metadata are omitted from VR responses and rejected on writes.
Floor/room descriptions remain. The dated conversion retained 73 private Info
markers across 65 scenes with names/positions preserved. Scene/exit hotspots
remain Guest-visible; Info requires explicit Administrator approval for Guests.
The recorded 69 schedule-image entries, two legacy entries and metadata were
retained, not deleted; this is not a fresh database count. Preserve audit history,
empty-compatible tables/fields, external hosted images and the legacy-reference
building-deletion guard. Schedule cleanup needs a separate focused owner task.

Retry-log pairing and request-lifetime fixes remain released. Preserve 2,000 ms
per attempt, two attempts and 200 ms retry delay. Each admitted retry warning
reserves its own recovered/failed outcome and opaque operation_id; admission
is one pair per operation, initial failure category and status per 60 seconds.
Standalone failures keep their limiter. Logger failure, termination or retention
can hide outcomes. `@vercel/functions` 3.10.1 waitUntil retains expiry refresh
through retry/callback settlement. Synchronous changed-session persistence,
expiry, scoped logout, cookies, privacy and completed-response protection stay;
expiry-only refresh is not a full-session save. Docker/MySQL work without a
Vercel request context. The local lifetime model does not prove every historical
provider/network cause or actual cloud freezing behavior.

The sign-in investigation reproduced browser/automation problems; a general
application login failure or Chrome-engine defect was not established. No
application login patch was made. Register observation before one submission;
wait for the original tab's role URL, ready DOM and visible heading under one
30-second deadline. Do not use global network idleness or automatically
resubmit. Missing POST/input delivery is inconclusive. A fresh-tab diagnostic
does not prove original-tab navigation. Unresolved input-dispatch cases,
cancelled-navigation spinner and the early fixture-cookie limitation remain
recorded in the October 24 handoff; do not claim complete browser-profile or
downloaded-guide preservation. Loading-state hardening remains separate.

Only temporary event 26 was removed in the October 23 release; its six audit
records remain. SELECT-only comparison preserved all original 9 articles and
12 events (5/5), with audit checks 3/3. Those are dated observations, not fresh
database counts. No account changes, migration, existing-post cleanup, schedule
cleanup or ICTU deployment ran. Normal authentication/session/presence writes
were permitted. Existing-post cleanup policy v2 selects articles with department
university-wide OR category Facilities, and events with category Facilities
only. Valid Campus-wide events survive. Older generated deletion plans are
obsolete; fresh preparation, external backup and owner review are required.

October 23 focused results: content/access/privacy 1,137/1,137; editor 32/32;
disposable PostgreSQL/MySQL cleanup/restore 35/35; session bootstrap/resilience/
lifetime 160/160, 73/73, 72/72; startup 116/116; rate limits 180/180;
notifications 26/26; audiences 13/13; offline 49/49; PWA 148/148; Walking
118/118; scheduling retirement 401/401; analytics 113/113; login timing 8/8;
package 76/76; documentation 942/942 (predecessor evidence); isolated cache
upgrade/reverse activation 6/6; product and final public smoke 22/22 each.
The browser record has 72 successful observations and four earlier inconclusive
attempts, not a combined QA total. Earlier missed actions, premature captures
and the audit checker's event_type/action mistake remain preserved.

October 23 UTC watches: staged 04:52:32.889–05:02:47.615 (614.726 seconds),
product live 05:03:26.882–05:13:39.050 (612.168 seconds), final live
05:18:54.232–05:29:32.612 (638.38 seconds). Loaded closing Runtime Logs views
showed 0 Warning / 0 Error / 0 Fatal; exact-deployment heartbeat messages were
expanded. No natural retry was observed to correlate and no failures were
manufactured. These finite windows do not promise future provider availability.
Keep earlier warnings, corrected counts, monitoring gaps, laptop interruption
and fresh October 21 closing watch as separate history. HTTP 200/204 does not
prove every refresh succeeded. No full npm test/QA pass, live MySQL parity,
physical-device acceptance, exhaustive route/VR traversal or complete immutable
deployed-byte equality is claimed.

Current runtime identity: 205 files / 8,611,691 bytes, SHA-256
`12fb08e21976a482a0a52a61ea4495287e1d50724fa7c3366f27ba52477a5eb6`.
Compare canonical Git bytes, not Windows checkout line endings. Cache v56;
stylesheet v13; migration sources through 0029. The owner applied additive
0029 during Department News release after backup; this handoff applies none.
Production data and Express sessions use Supabase/PostgreSQL; MySQL is
local/fallback/rehearsal. Authentication is Express sessions with bcrypt local
login and Google OAuth; Supabase Auth is not used. Docker localhost's selected
Supabase connection is shared, so localhost does not isolate saved data.
The ordinary checkout lacks ignored node_modules/@vercel/functions; do not
repair dependencies automatically. Prior focused checks used complete source
and matching locked external dependencies, fake providers and isolation.

IndexedDB stores the explicit user-downloaded guide and PMTiles; Cache Storage
is shell/static-only. Download/update needs a connected signed-in action on
each device. News/events, schedules, private/session data and VR/panoramas are
excluded from guides. The guide format is unchanged; ordinary logout removes
the owned guide under existing privacy behavior. ICTU source readiness is not
an actual ICTU deployment; saved paths reside in Supabase, not Git.

Preserve protected local documents, ignored output, .git/info/exclude and
external evidence. Credentials and private database snapshots never belong in
handoffs or prompts. Prior permissions do not carry forward; one writer owns
a scope. Inventory available MCP tools and skills without accessing services;
read applicable skill instructions, and do not assume identical integrations.
A new session's initial grounding turn is read-only and context-only: local
source and read-only Git including remote main, report and stop after grounding.
No automatic tests, servers, containers, browser/database/vendor access,
dependency repair, feature work, delegation, commit, push or deployment.
Availability does not expand authority. Wait for one focused owner request.

## Decision record and possible next work

Supported department assignments (content labels do not expand reading access):

| Stored department code | Department |
|---|---|
| `graduate-school` | Graduate School |
| `cea` | College of Engineering and Architecture (CEA) |
| `ccs` | College of Computer Studies (CCS) |
| `chs` | College of Health Sciences (CHS) |
| `cthbm` | College of Tourism, Hospitality and Business Management (CTHBM) |
| `ctde` | College of Technological and Developmental Education (CTDE) |
| `cas` | College of Arts and Sciences (CAS) |

This is a documentation publication, not a new application release. The owner
authorized one reviewed commit and normal push after local review. An automatic
unpromoted staged build is allowed; Production promotion and settings changes
are excluded. Final publication and build identities belong in the external
receipt. No new panelist/client request is approved. Future sessions use their
current owner prompt, ground, report and wait for a focused task; this publication
authorization does not carry forward.

Potential later work, in no priority order:

- Plan editable Walking Steps if the owner chooses it. Currently the popup
  composes one line from segment names, optional path label and distance.
  Drawing Walking waypoints changes geometry and calculated metrics, not an
  ordered instruction list. Clarify desired instructions, ordering, directions,
  storage and offline compatibility before proposing an implementation. The
  singular/plural "1 minutes" wording is a separate small issue, still unchanged.
- Diagnose missed browser input in a synthetic fixture by capturing the driver
  input receipt, DOM submit/defaultPrevented and navigation during one no-POST
  case. Keep generated credentials and sanitized timings only. This does not
  require Production traffic or a speculative login patch.
- Prepare owner-reviewed cleanup only after a new focused authorization. Policy
  v2 preserves valid Campus-wide events; old v1 deletion plans must not execute.
- Let the main Administrator create remaining permanent department accounts
  with owner-chosen credentials through User Management. No credentials are
  included here and no account count is inferred from the seven supported departments.
- Plan an ICTU deployment separately. Git source and Supabase saved data are
  distinct; pointing Docker at a shared database does not create a safe sandbox.
- A locked dependency setup for this ordinary checkout is a separate repair;
  do not install automatically during grounding.

## Release reading order and identity ledger

1. `docs/current-authority.md` and this note: current decisions, scope and limits.
2. `docs/new-session-grounding-prompts.md`: use exactly one current owner prompt.
3. `AGENTS.md`, `CLAUDE.md`, `CODEX_HANDOFF.md`, `CLAUDE_HANDOFF.md`, `plan.md`
   and `ROADMAP.md`: current introductions and continuity, older sections as history.
4. `docs/campus-wide-events-release-2026-10-23.md`,
   `docs/news-options-release-2026-10-22.md`,
   `docs/department-news-release-2026-10-21.md`: dated product evidence.
5. `docs/session-handoff-2026-10-21.md`,
   `docs/room-scheduling-release-2026-10-20.md`,
   `docs/session-retry-log-pairing-release-2026-10-20.md`,
   `docs/session-refresh-timeouts-2026-10-20.md`: earlier release/investigation
   facts, warnings and limitations, not current execution instructions.
6. `README.md`, `docs/thesis-teammate-handoff.md`, `docs/test-evidence.md`,
   `docs/deployment.md`, `docs/security-checklist.md`, `docs/demo-script.md`,
   `docs/offline-map-refresh.md`, `docs/walking-2d-team-guide.md`,
   `database/supabase/README.md`, `database/supabase/REPOSITORY_BOUNDARIES.md`,
   `package.json`, `.vercelignore`, `.gitattributes` and `.gitignore` as relevant.

| Checkpoint | Product/source and deployment | Later completion |
|---|---|---|
| Walking 2D, October 18 | Feature `9a4a628`; published source `c533719`; `dpl_94jYqWkHoC19cLKnfooTVEG8SCyU` | October 19 saved coverage is dated; `docs/walking-2d-release-2026-10-18.md` |
| Scheduling removal, October 20 | `b39d08c`; `dpl_FKR7rgR6QPbsBJp1PXcdKrVroiha` | `59b61b8`; `dpl_5KW5rB3zwZT4SYpTCt9FJCYXzfgY` |
| Paired session logs | `6a5bbd8`; `dpl_AFoQhojBv2ha95QRHd944dJayw7w` | `9401df5`; `dpl_9Y7bXk1NQttAYU6LiCUaLgPd1T4E` |
| Session lifetime | `07120e4`; `dpl_HBd5t8p1hqXXgdQoiyBRY3RDQHPn` | `38fd296`; `dpl_86Lge98zAWnSKYbG7b14ef4uMpfF` |
| Department News, October 21 | `0968b5d`; `dpl_7wPtbzKtFUuGAENtYWHHxGz4DJZJ` | Owner-applied 0029; final successor recorded in that release's external receipt |
| News options, October 22 | `8176c9f`; `dpl_CVsYatbsH43RvcG5r3hQTf1nF4KC` | `da29b4f`; `dpl_G7Po4YVSvuAzp2Z9zgRWTfcT5NVc` |
| Campus-wide Events, October 23 | `509518f`; `dpl_HzhVWaEXzmDkdAWFTQrqWfykZxda` | `2c0a1bf`; `dpl_Dkjck5qX73P1jpZryiP7iT3hGkk4` |

These identities are dated observations, not permission or a guarantee of current
vendor state. The October 23 fallback rebuild of `da29b4f`,
`dpl_6YqoBim7f7zVeFZLP7aCFNN3kWDr`, was Ready/Staged and unpromoted. No rollback
was needed. Hobby Instant Rollback eligibility was limited to the immediately
previous Production deployment; recheck before a future release. Mutable branch
aliases can move to another build; immutable deployment URLs identify test targets.

## Source map for the next focused task

Read source without executing maintenance tools or application entry points.
The map narrows follow-up reading; it grants no implementation permission.

| Topic | Files |
|---|---|
| Bootstrap, policies and auth | `server.js`, `routes/auth.js`, `controllers/authController.js`, `middleware/roleAuth.js`, `middleware/departmentAccess.js`, `config/sessionConfig.js`, `config/vercelProductionProfile.js`, `repositories/userRepository.js` |
| Session persistence and revocation | `services/supabaseSessionStore.js`, `services/mysqlSessionStore.js`, `services/sessionReadiness.js`, `services/sessionRevocation.js`, `services/userPresenceService.js`, `utils/userPresence.js` |
| Department/content access | `utils/departments.js`, `routes/admin.js`, `controllers/adminController.js`, `repositories/contentRepository.js`, `routes/events.js`, `controllers/eventsController.js`, `views/admin/news.ejs`, `views/events.ejs`, `public/js/admin/admin-news.js`, `public/js/news-department-filter.js` |
| Account management | `views/admin/users.ejs`, `public/js/admin/admin-users.js`, `repositories/userRepository.js`, `database/supabase/0029_department_news_admin.sql`, `database/schema.sql` |
| Map and generated Steps | `routes/map.js`, `controllers/mapController.js`, `views/map.ejs` (`openComputedRoutePanel`), `utils/pathfinding.js`, `repositories/routeRepository.js`, `public/js/admin/admin-map-graph.js` |
| Walking 2D | `services/walkingRouteService.js`, `controllers/walkingRouteController.js`, `repositories/walkingRouteRepository.js`, `public/js/admin/admin-walking-routes.js`, `database/supabase/0028_walking_2d_routes.sql` |
| VR and Guest privacy | `routes/vr.js`, `controllers/vrController.js`, `controllers/adminVrController.js`, `repositories/vrRepository.js`, `public/js/admin/admin-vr.js`, `services/guidedVrResolution.js` |
| Offline acquisition/storage | `services/offlineGuideService.js`, `controllers/offlineGuideController.js`, `public/js/offline-guide-manager.js`, `public/sw.js`, `services/offlineMapReleaseService.js`, `docs/offline-map-refresh.md` |
| Notifications/audience | `services/notificationFeedService.js`, `controllers/notificationController.js`, `public/js/notification-panel.js`, `controllers/eventsController.js` |
| Geometry, media and browser protections | `utils/routeGeometry.js`, `controllers/adminRouteController.js`, `utils/mediaUrl.js`, `controllers/mediaController.js`, `middleware/securityHeaders.js`, `middleware/errorHandler.js`, `middleware/authenticatedHtmlNoStore.js` |
| Cleanup safeguards: read only | `scripts/prepareRetiredContentCleanup.js`, `scripts/retiredContentCleanup-probe.js`, `database/maintenance/remove-room-schedules.postgres.sql`, `database/maintenance/remove-room-schedules.mysql.sql`, `database/maintenance/prepare-room-schedule-restore.js` |
| Focused checks: inventory, not automatic execution | `scripts/quality-gates.js`, `scripts/departmentNewsAdmin-probe.js`, `scripts/campusWideEventsUi-probe.js`, `scripts/supabaseSessionResilience-probe.js`, `scripts/vercelRuntimeSessionBootstrap-probe.js`, `scripts/sessionRefreshLifetime-probe.js`, `scripts/vercelPackageBoundary-probe.js`, `scripts/with-server.js` |

## Sign-in investigation: proven results and unresolved cases

The external investigation ran October 22–23 with an interruption. Manual
synthetic Chrome sign-in reached News & Events 3/3 in the original tab; the
extension/debugger stayed enabled, so this was not an extension-free comparison.
The original automated sequence eventually succeeded 6/6 while early snapshots
showed Authenticating; pre-registered observation passed 6/6 at 378–756 ms.
Three fake five-second-provider controls completed in 5,398–5,404 ms despite
premature observer errors. One problematic POST /login completed 302 in 71 ms,
but its destination GET arrived 22,968 ms later. The gap's cause was not proven;
it was not time spent inside that completed POST.

Wrong password, Enter, delayed response and rapid duplicate-click cases each
passed 3/3; duplicate-click fixtures recorded one POST. Real-controller, CSRF,
bcrypt and memory-session HTTP controls passed 32/32. One fresh real Docker
department sign-in/logout cycle passed (3,385 ms / 643 ms). Subsequent tool
inputs produced no POST, so there is no claim of 3/3 fresh Docker cycles or a
fully reliable end-to-end automation gate. Protected-page redirect ultimately
confirmed the owned test browser signed out; session rows were not inspected.
Fresh tabs used in the later release do not explain every original-tab stall.

Corrected checking procedure:

1. Identify the original tab and expected role path/heading: Administrator
   `/admin` / Operations Command Center; Department Administrator `/admin/news`
   / News & Events; other roles `/dashboard` and their role-appropriate page.
2. Register sanitized request/navigation observation before exactly one click
   or Enter submission. Preserve only paths, statuses, timings and page state.
3. Follow POST /login → redirect → destination GET → committed DOM → heading.
   Continue observing under one 30-second deadline after premature tool errors.
4. Avoid global network-idle waits because heartbeat requests recur. Do not
   snapshot/reload/replace tabs while submission remains unresolved.
5. If no POST was sent, classify input delivery as inconclusive. Do not repeat
   credentials automatically. A fresh-tab authenticated check is a separate
   diagnostic, never proof the original tab navigated successfully.

Controlled navigation cancellation can retain the loading button; it is a
separate application hardening proposal, not the historical cause. A fake
never-settling presence provider can delay redirect after session save; that
does not establish a real incident cause either.

The early fixture's fake logout expired campusphere.sid on loopback despite
using another memory-session cookie name. A pre-existing local-app cookie could
therefore have expired; complete loopback cookie preservation is not claimed.
The corrected reusable fixture consistently uses signin.fixture.sid. Production
cookies are outside that scope. No profile reset, security/extension disable or
manual cookie/store clearing ran, but ordinary Docker logout performs the
application's guide cleanup. Preservation of pre-existing local guides was not
independently established. Old fixture copies are evidence, not runnable templates.

## Earlier warnings, corrections and interrupted evidence

- Walking October 18: 12 Warning rows / 0 Error / 0 Fatal, including touch retry
  warnings. Online automated tile captures were incomplete; owner-visible roads
  are owner evidence, not full online pixel verification.
- Removal October 20: staged 3 Warning rows / 0 Error / 0 Fatal; final recorded
  closing snapshot 1 Warning row / 0 Error / 0 Fatal. A 200/204 response did not
  establish session refresh settlement. The full R6 harness failed to reach its
  isolated MySQL listener; no full R6 pass is claimed.
- Pairing release: corrected Last 30 minutes snapshot 14 Warning rows / 6 Error /
  0 Fatal with a monitoring gap. The earlier zero-warning summary was corrected.
  Request-row counts are not console-message totals or independently classified
  session operations. Preserve operation/request correlation across displayed rows.
- Lifetime release: staged 638.107 seconds and product live 637.145 seconds.
  A laptop shutdown interrupted the first final-build watch at October 20
  15:42:36 UTC. Fresh October 21 watch ran 00:47:32–00:58:28 UTC (655.105 seconds);
  the loaded 08:27–08:57 Asia/Manila view showed 0 Warning / 0 Error / 0 Fatal
  request rows. No continuous overnight monitoring is claimed.
- Campus-wide release: all three exact October 23 windows are in current
  continuity. An external audit checker first used event_type instead of action;
  corrected checks passed 3/3 and the original failed output is preserved. One
  early offline screenshot preceded map rendering; a readiness-aware disconnected
  retest confirmed basemap and route. Four inconclusive browser attempts were
  retained separately from 72 successful observations.

## Evidence locations and portability

Sanitized reports and helper evidence are outside Git under the owner's
`C:/Users/FROST.GG/.codex/backups/` directory:

- `release-campus-wide-events-20261023/final-receipt.md`: final source/deployment,
  exact test totals, three watch windows, preserved originals and limitations.
- `signin-navigation-20261022-1045/findings-2026-10-23.md`: full classification;
  `browser-check-procedure.md`, `corrected-browser-check.js`,
  `diagnostic-browser-check.js` and corrected `reusable-fixture/` remain there.
- `authority-sync-20261024/`: this task's fixed manifest, original-document
  backup, preservation hashes, canonical temporary-index package and check receipt.

Private content snapshots, database backups, credentials, generated cleanup SQL
and screenshots are not part of this handoff. Do not open or copy them during
grounding. A clone/archive does not include owner-local receipts, ignored output
or checkout-local exclusions. This note deliberately contains the essential
sanitized conclusions; missing external evidence must be reported as unavailable,
not replaced with invented verification. Read sanitized external reports only
when present and relevant within the owner's task.

## Original October 24 synchronization validation

The October 23 documentation predecessor passed 942/942; that is not today's
result. This task runs isolated network-free documentation/static checks only,
with server, database, credentials, environment loading and networking blocked.
Canonical runtime verification uses a temporary index outside Git and leaves the
real index empty. Fresh results and preservation counts are recorded here after
validation and in the external local receipt. No full npm test/QA or fresh
Production/database smoke is implied.

October 24 fresh results:

- Isolated documentation contracts: **1,220/1,220**; zero attempted blocked
  server/database/credential/network operations. Earlier 942/942 remains dated.
- Canonical package boundary: **76/76**, using only a disposable loopback
  static-file server with environment loading and external networking blocked.
  No application or database server was started.
- Eleven current continuity sections match; their historical bodies remain
  preserved, including a pre-existing historical wording difference in the
  deployment guide. Two current owner prompts and two current portable variants
  pass independently; October 21 prompts remain historical fixtures.
- Syntax, UTF-8, NUL/BOM, whitespace, referenced paths and added-line secret
  patterns pass. Runtime remains 205 files / 8,611,691 bytes with the fingerprint
  above; all 205 runtime Git blobs match the released baseline.
- The fixed 19-path scope preserves 501 other tracked files, 53 protected-file
  fingerprints and 17 selected sanitized historical-evidence fingerprints.
  Secrets and private database backups were not read or copied. The real index
  stays empty; local HEAD and remote main still use 2c0a1bf at the closing check.

Initial documentation-check failures exposed line-wrap-sensitive test mutations
and historical-heading scoping; corrected checks passed without weakening their
historical rejection fixtures. An initial whole-block comparison found the
pre-existing historical wording difference; current-section equality and
per-file historical preservation were checked separately. These are local
documentation/checker corrections, not application failures. The documents are
intentionally uncommitted. No browser, Production, shared database, dependency
repair, commit, push or deployment operation belongs to this task.

## Historical follow-up local review — October 24, 2026

The owner subsequently authorized review and fixes within the same 19-path
documentation/checker manifest, focused isolated checks and an external review
receipt. This follow-up ends before staging, committing or pushing. The released
baseline remains `2c0a1bf`; the pending documents remain uncommitted. No product,
database, dependency or deployment work is included.

The review found that `runDocsCurrentGate()` read `.env.example` even for a
documentation-only review. It now accepts the explicit option
`{ includeEnvironmentTemplate: false }`, which avoids that read and excludes
only its two template migration assertions. The default behavior retains both
assertions. Synthetic positive and negative inputs verify that the default still
requires the historical migration evidence; the actual template was not read.

Fresh follow-up results, separate from the original 1,220/1,220 record above:

- Documentation contracts with environment-template reads excluded:
  **1,218/1,218**, zero attempted blocked operations and zero environment-file reads.
- Template-mode regression cases: **4/4**. These are separate from the
  documentation total and use synthetic strings rather than the actual template.
- Canonical package boundary: **76/76**, using only its disposable loopback
  static-file listener; no owned listener remained afterward.
- Canonical runtime still matches all **205/205** released Git blobs:
  **205 files / 8,611,691 bytes**, with the unchanged SHA-256 above.
- The candidate's matching external lockfile and **127 installed package
  versions** were verified. Workspace dependencies were untouched.
- Preservation/static review: **757/757**, including 92 referenced paths,
  eleven identical current continuity sections, per-file historical continuity,
  both archived owner prompts and both archived portable prompts. All 497 selected
  non-secret tracked files outside the manifest, 53 protected-file fingerprints,
  22 selected prior-evidence fingerprints and checkout exclusions remain intact.

An initial candidate helper stopped because its pending-path preflight selected
the not-yet-created temporary index. The corrected preflight reads the real
index before populating the disposable one. The package result summarizer also
needed to recognize indented PASS labels; the retained probe log already showed
76/76. These were review-helper issues, not application or package failures.

The fresh backup, fixed manifest, checks and closing Git facts are retained in
`C:/Users/FROST.GG/.codex/backups/authority-review-20261024-103903/`.
The detailed review receipt is `review-receipt.md` in that directory. No full
application QA or fresh Production/database observation is claimed. Commit/push
and the next product task still require the owner's separate decision.

## Documentation publication — October 24, 2026

The owner authorized publication of this reviewed 19-file handoff as one commit
and normal push to main. Publication preparation preserves the original
synchronization and local-review records above. The actual new documentation
SHA, fresh focused results, read-only GitHub/Vercel settings observations and
automatic build outcome belong in the external publication receipt under
`C:/Users/FROST.GG/.codex/backups/authority-publish-20261024-105429/`.

The application runtime, dependencies, schema, cache versions and live website
are outside this change. An automatic unpromoted staged deployment is permitted;
no manual build or Production promotion is authorized. No new product task has
been selected. Each new session must ground, report and wait.
