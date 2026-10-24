<!-- OCTOBER 24 AUTHORITY START -->
## Current handoff authority — October 24, 2026

Read `docs/current-authority.md` and `docs/session-handoff-2026-10-24.md`
first; copy the current role prompt from `docs/new-session-grounding-prompts.md`.
Reviewed documentation publication: one scoped commit and normal push to main.
Automatic unpromoted builds are allowed; Production promotion is not authorized.
Released runtime source is `2c0a1bf`; final deployment
`dpl_Dkjck5qX73P1jpZryiP7iT3hGkk4` is dated October 23 evidence.
Campus-wide is Events-only; cache v56, stylesheet v13, migration sources through
0029. Older releases, candidates and instructions below are historical when
they conflict with current authority. A new session grounds read-only, reports
and stops; editable Walking Steps is discussed, not approved.
<!-- OCTOBER 24 AUTHORITY END -->

# CampuSphere Current Authority

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

## Current reading route and architecture

Read docs/current-authority.md and docs/session-handoff-2026-10-24.md first.
The released runtime baseline is 2c0a1bf; final October 23 deployment is
dpl_Dkjck5qX73P1jpZryiP7iT3hGkk4. The owner authorized this documentation
publication as one reviewed commit and normal push; the resulting SHA and
push/build outcome belong in the external publication receipt. Recompute live
Git truth. Automatic unpromoted builds are allowed; Production promotion and
cleanup are not authorized. Campus-wide is Events-only; News/accounts retain
seven departments. New sessions ground, report and wait for a focused task.

The complete decision record, source map, investigation summary and external
evidence locations are in the October 24 handoff. Express 5/EJS and server-only
repositories remain. Department-only access is enforced independently of content
labels. Saved geometry and offline download lifecycle remain separate from VR.
The historical authority below is retained for auditability and grants no work.

<!-- CAMPUS WIDE EVENTS RELEASE START -->
## Historical Campus-wide Events product release — October 23, 2026 (verified)

Read `docs/campus-wide-events-release-2026-10-23.md` first. Product source
`509518f9fbbbd89edc49e98feb3582e635135c0f`, deployment
`dpl_HzhVWaEXzmDkdAWFTQrqWfykZxda`, passed staged and normal-website checks.
Campus-wide is event-only, stored as `university-wide`; News and account
assignments keep seven departments. Source cache v56, stylesheet v13 and guide
format are unchanged by the documentation successor. Five existing roles were
checked. Only temporary event 26 was removed; its audit history remains.
SELECT-only comparison preserved all original 9 articles and 12 events.
No account changes, migration, shared cleanup or ICTU deployment ran. Older
local-only notices below are history. Chrome missed actions remain inconclusive;
fresh-tab retests passed without an application login change. Dated watches and
limits belong in the focused note. The identical-runtime documentation
successor's final identity and closing watch belong in the external receipt.
Recompute live truth before later work; no future cleanup permission is granted.
<!-- CAMPUS WIDE EVENTS RELEASE END -->

<!-- CAMPUS WIDE EVENTS LOCAL START -->
## Historical Campus-wide Events local candidate — October 23, 2026 — superseded; do not execute

Read `docs/campus-wide-events-2026-10-23.md` first. This uncommitted,
not deployed work on `codex/campus-wide-events` restores Campus-wide only
for Events, using stored/API code `university-wide`. News and account
assignments keep seven departments. Audience/privacy/access rules remain.
Candidate cache v56; stylesheet v13 and downloaded-guide format stay.
Cleanup policy v2 retains valid Campus-wide events; all earlier generated
deletion plans are obsolete. Prepare fresh and obtain owner review later.
Docker checks are read-only except normal sign-in/logout session activity;
content writes and cleanup rehearsals use isolated fixtures only.
No commit, push, deployment, shared cleanup, account or environment changes
belong to this task. The dated October 22 release below remains history.
<!-- CAMPUS WIDE EVENTS LOCAL END -->

<!-- NEWS OPTIONS RELEASE START -->
## Historical News options product release — October 22, 2026 (verified)

Read `docs/news-options-release-2026-10-22.md` first. Product source
`8176c9f1bec4d3b584fecbec4482c4be09f863ad`, deployment
`dpl_CVsYatbsH43RvcG5r3hQTf1nF4KC`, passed staged and normal-website
verification. Seven departments and valid content categories are required;
University-wide and Facilities are retired write choices. Existing posts stay
readable; their edit forms require valid replacements without reassignment.
The two tracked release posts were removed; their audit history remains.
SELECT-only comparison preserved all original 9 articles and 12 events.
Source cache v55; stylesheet v13; downloaded-guide format and access rules stay.
No accounts, migration, shared cleanup, secrets or protection were changed.
Existing-post review/deletion remains deferred. Earlier local notices are
historical. The interrupted staged watch and fresh closing watch are recorded
separately; the sign-in-tab loading issue remains postponed, not claimed fixed.
The documentation successor has identical runtime; its final source/deployment
and ten-minute closing watch belong in the external receipt. Recompute live
truth before later work; this release grants no future cleanup permission.
<!-- NEWS OPTIONS RELEASE END -->

<!-- NEWS OPTIONS LOCAL START -->
## Historical Local news-option removal candidate — October 22, 2026 — superseded; do not execute

Read `docs/news-department-options-2026-10-22.md` first for the uncommitted,
not deployed work on `codex/news-department-options`, based on `ba7dd2c`.
Only seven departments are selectable; University-wide and Facilities are
retired content choices. Candidate cache v55; published cache v54 remains dated
release evidence. Existing shared posts remain until a separate owner-reviewed
cleanup. Docker localhost uses shared Supabase: only the tracked disposable
draft/event may be changed and removed. No commit, push or deployment belongs
to this implementation. Account editing remains shared across departments;
audience/draft privacy and building Facilities remain. Historical notices below
are preserved and do not override this focused local task.
<!-- NEWS OPTIONS LOCAL END -->

<!-- DEPARTMENT NEWS RELEASE START -->
## Historical Department News product release (October 21, 2026; verified)

Read `docs/department-news-release-2026-10-21.md` first. Product source
`0968b5d107b69166301e9c80350d3f7c6a7ffcbb`, deployment
`dpl_7wPtbzKtFUuGAENtYWHHxGz4DJZJ`, was verified Ready / Production /
Current on https://campusphere-cspc.vercel.app. The documentation successor
uses the same runtime; its final identity and closing watch belong in the
external receipt. Recompute live Git/deployment truth before future work.

The owner completed additive Supabase migration 0029 after a validated external
backup; read-only checks preserved original data and verified constraints,
defaults and server-only RPCs. Cache v54 and stylesheet v13 are current source.
Department Administrators use only /admin/news and its required operations;
editing is shared across departments, with audience and draft privacy retained.
The three tracked test records were removed and both former sessions denied.
Seven permanent accounts remain owner-created after release closure.

The earlier local-only candidate notices and grounding prompts below are
historical implementation instructions, superseded for this explicit release.
Preserve the later session fixes and dated warning/monitoring limitations.
No shared MySQL migration, schedule cleanup or ICTU deployment is authorized.
This completed release grants no future data, account or deployment permission.
<!-- DEPARTMENT NEWS RELEASE END -->

# Historical authority snapshot — October 21, 2026

<!-- DEPARTMENT NEWS CANDIDATE START -->
## Historical Local Department News candidate (2026-10-21; not deployed) — superseded; do not execute

Read `docs/department-news-admin.md` first for the current local work on
`codex/department-news-admin`, based on `71946ab`. Department Administrators
are editor-only accounts, with shared editing across all seven departments and
University-wide posts. The candidate prepares migration 0029 and cache v54;
the published application below remains source 38fd296, cache v53 and prior
owner-applied migrations through 0028. This task authorizes local implementation
and isolated tests only: no commit, push, deployment, shared-database migration
or live account creation. Preserve protected files and dated release evidence.
<!-- DEPARTMENT NEWS CANDIDATE END -->


Last updated: 2026-10-21 (Asia/Manila)

## Historical Release Continuity (2026-10-21 completed removal and session releases; superseded by October 24 handoff)

Read `docs/current-authority.md` and `docs/session-handoff-2026-10-21.md`
first, then the dated room-removal and session-release notes. Room Scheduling /
Room Plotting removal is complete; the later session reliability releases are
also complete. The next panelist objective has not been selected. Recompute
live Git truth before a new task; a dated release is not a future Git HEAD.

The documentation-review baseline is
38fd2962dccb096a8d45635790092e91c611952b. At preparation, local main,
origin/main and remote main matched, with a clean working tree, empty index,
zero stashes and ahead/behind 0/0. The owner authorized this documentation and
static-assertion review, one commit and a normal push. The new documentation
SHA is determined afterward and recorded in the external receipt. This task
does not promote a deployment or refresh application/database evidence.

The October 20 removal product is
b39d08cf2536cafc5d965adba0803e743425a698, initially verified as
dpl_FKR7rgR6QPbsBJp1PXcdKrVroiha. Its completed documentation successor is
59b61b8217881e28f7ad8514e82b3d3ff19534da, deployment
dpl_5KW5rB3zwZT4SYpTCt9FJCYXzfgY. The earlier rollback target was
dpl_94jYqWkHoC19cLKnfooTVEG8SCyU, source c533719. These are dated removal
release identities, not the latest application/deployment identity.

Room scheduling is retired for every role. Authorized retired API requests
return the standard JSON 404; login, role and CSRF protections remain. New
schedule hotspots and schedule metadata writes are rejected; participant and
Administrator responses omit schedule types/metadata. Floor and room
descriptions remain. Scene and exit hotspots remain Guest-visible; ordinary
Info hotspots need explicit Administrator approval for Guests. Building and
panorama previews, Walking/Vehicle routes, Free Roam and Guided VR remain.

The October 19 conversion changed 73 saved Schedule hotspots to private Info
markers across 65 scenes, with room names/positions preserved. October 20
read-back found zero Schedule types among 1,469 hotspots; all seven application
checks passed. The 69 image entries and 2 legacy entries remain intact in that
record; schedule metadata remains for later cleanup. No live rows have been
deleted. These are dated observations, not a fresh database count. Empty
tables/fields, external hosted images and audit history are retained. Future
cleanup requires owner-controlled target verification, stopped old writers,
an external backup and explicit confirmation. Cleanup reuses remaining room
markers as private Info; the legacy-reference guard protects building deletion
and synchronization tools reject retired content before writes.

The later retry-log product is 6a5bbd8b81fd0ff874f3de0bc2ec38ac47c68d21,
initial deployment dpl_AFoQhojBv2ha95QRHd944dJayw7w; its completed successor is
9401df5db59c829ec819d30c0e0081ddf3fd810b, deployment
dpl_9Y7bXk1NQttAYU6LiCUaLgPd1T4E. Each sampled warning reserves its own
recovered/failed outcome and opaque operation ID. Privacy and bounded sampling
remain; process termination, logger failure and retention can obscure a pair.

The lifetime-correction product is
07120e4c3313429dc765d42bc5bec8d062c6e761, initial deployment
dpl_HBd5t8p1hqXXgdQoiyBRY3RDQHPn. Its final published source is
38fd2962dccb096a8d45635790092e91c611952b, deployment
dpl_86Lge98zAWnSKYbG7b14ef4uMpfF, observed Ready on the normal website
https://campusphere-cspc.vercel.app during October 21 completion. This is
dated Production evidence, not a fresh vendor check during this handoff.
Official @vercel/functions 3.10.1 waitUntil retains the full expiry refresh
through retries, paired diagnostics and callback settlement. Defaults remain
2,000 ms per attempt, two attempts and 200 ms retry delay. Session creation,
changed-session saves, scoped logout, cookies and completed-response protection
retain their guarantees; expiry-only touch is not a full-session save. The
local fixture models lifetime draining; it does not reproduce actual cloud
freezing or establish every historical provider/network cause. Docker/MySQL
continue without a Vercel request context.

Keep warning windows separate. Removal's staged snapshot had 3 Warning rows,
0 Error, 0 Fatal; its final recorded closing snapshots had 1 Warning row,
0 Error, 0 Fatal. The later logging release's corrected Last 30 minutes
snapshot had 14 Warning rows, 6 Error, 0 Fatal, with a monitoring gap. These
are request-row counts, not console-message totals; displayed 200/204 responses
do not prove every refresh outcome. The old zero-warning summary was corrected.
The October 18 12 Warning rows / 0 Error / 0 Fatal snapshot remains history.

Lifetime-correction staged monitoring lasted 638.107 seconds and product-live
monitoring 637.145 seconds. Its first final-build watch was interrupted by a
laptop shutdown: last saved checkpoint 2026-10-20 15:42:36 UTC; fresh watch
resumed 2026-10-21 00:47:32 UTC. No continuous overnight monitoring is claimed.
The fresh October 21 watch ran 00:47:32–00:58:28 UTC (655.105 seconds); its
loaded 08:27–08:57 Asia/Manila view showed 0 Warning / 0 Error / 0 Fatal request
rows. No natural retry or blocking session error was observed in that watch.
These finite windows do not promise zero future timeouts or provider outages.

Dated removal checks include 401/401 retirement, 118/118 Walking, 49/49 offline,
148/148 PWA, 140/140 VR/Guest policy, 28/28 disposable cleanup/restore, 75/75
package and 20/20 Production smoke. Representative rooms, private CSLAB Info,
panoramas, routes, 390 px layout, downloaded-guide reload and older-guide
fixtures passed. The full R6 harness did not reach its isolated MySQL listener;
no full R6 pass is claimed. Later lifetime checks passed 72/72 lifetime,
73/73 resilience, 160/160 bootstrap, 116/116 Production profile, 401/401
retirement, 118/118 Walking and 180/180 rate limits; isolated documentation
659/659 and package 75/75 passed. The network-disabled Docker lifetime check
passed 72/72; the dependency audit recorded 0 vulnerabilities. Public smoke
passed 20/20, including five exact committed asset matches. This handoff runs
only isolated documentation/static/package checks and reports its actual new
totals. It is not a full npm test/qa pass, fresh live MySQL parity, exhaustive
route/VR traversal, physical-device acceptance or complete immutable deployed-byte
equality. Original investigations, warnings and failed/incomplete harness
evidence remain preserved.

The current source runtime package is 201 files, 8,591,700 bytes, aggregate
SHA-256 dfe57b2a9cc634f2a5f02758750be704ca02cff457388161fc282c0d21137890.
Compare canonical staged Git bytes with 38fd296; Windows checkout line endings
are not package identity. Older 201-file removal/pairing fingerprints are dated
predecessor evidence. Migration sources remain contiguous through 0028 and
unchanged; no migration was applied by these releases. Current service worker
is v53; shared stylesheet remains v13. Production data and Express sessions
use Supabase/PostgreSQL; MySQL is local/fallback/rehearsal. Supabase Auth is not
used. No secret, provider setting, public API, schema or browser cache change
belongs in this documentation task.

Schedules were already excluded from downloaded guides; retirement required
no guide-format change or forced redownload. IndexedDB holds the explicit
user-downloaded guide and PMTiles; Cache Storage is shell/static-only. Walking
updates require a connected refresh on each device. The October 20 observation
was 26/26 saved paths, zero missing; saved coverage does not establish visual
approval of every walkway. Walking 2D and Walking VR remain separate catalogs.
ICTU code readiness is not an actual ICTU deployment; saved routes reside in
Supabase, not Git. No ICTU deployment or live cleanup ran.

Preserve protected local documents, ignored output, the local exclude file and
external evidence. Prior permissions do not carry forward; one writer owns a
scope. A new session's initial grounding turn is read-only and context-only:
inventory available capabilities, read current authority/source, report and
stop after grounding, then wait for an explicit focused owner task. Availability
does not expand authority. No automatic test run, server/browser/database/vendor
access, repair, cleanup, migration, commit, push or deployment follows a new
grounding turn. The completed release and this handoff grant no future work.

## October 21 handoff validation

The documentation/static-only synchronization passed isolated documentation
761/761 and canonical staged-Git package boundary 75/75. The eleven current
continuity copies and two reusable prompts are synchronized. Archived prompts,
dated removal bodies, protected files and original evidence were preserved.
The runtime package remains identical to 38fd296. These checks are not fresh
application QA, database verification or Production acceptance. The final
documentation SHA and normal-push receipt are recorded outside Git after the
reviewed commit; this handoff does not promote its Vercel build.

## Historical session refresh lifetime product release (2026-10-20)

Read `docs/session-refresh-timeouts-2026-10-20.md` before the dated releases
below. It records a reproduced invocation-lifetime gap, the reviewed correction
and focused checks, based on `9401df5`. Product source
`07120e4c3313429dc765d42bc5bec8d062c6e761` was verified Ready on the normal
Production domain as `dpl_HBd5t8p1hqXXgdQoiyBRY3RDQHPn` after a 638-second
staged observation and representative authenticated checks. Public live smoke
passed 20/20; the live product observation lasted 637 seconds with no new
timeout, lifetime or post-response error observed. The original local/Production
evidence classes remain distinct.
The external receipt records the final documentation successor, complete live
monitoring and final deployed identity; recompute live truth.

The complete expiry-refresh promise is retained with the official Vercel
helper through retry and callback settlement. The 2,000 ms/two-attempt/200 ms
policy, authentication, cookies, schemas and browser caches are unchanged.
The local lifetime fixture is not actual cloud-freezing proof or an attribution
of every timeout to the provider. Promotion requires normal staged verification;
unexplained exhausted refreshes and lifetime-registration errors block it.
Protected documents, application data and original investigations are preserved.
The staged closing dashboard showed 0 Warning / 0 Error / 0 Fatal request rows
in its dated 22:52–23:22 Asia/Manila view. That finite observation does not
establish permanent provider availability or erase the prior release's corrected
warning/error counts and recorded monitoring gap. Runtime package identity is
201 files / 8,591,700 bytes, SHA-256
`dfe57b2a9cc634f2a5f02758750be704ca02cff457388161fc282c0d21137890`.

## Historical session retry logging product release (2026-10-20)

Read `docs/session-retry-log-pairing-release-2026-10-20.md` and
`docs/session-retry-log-pairing.md` before the predecessor release blocks below.
The initial verified product source is
`6a5bbd8b81fd0ff874f3de0bc2ec38ac47c68d21`, deployment
`dpl_AFoQhojBv2ha95QRHd944dJayw7w`, observed Ready and serving the normal
Production domain on October 20. This is the product-release observation, not
the identity of a later documentation successor. Its final source/deployment
identities and monitoring receipt are recorded outside Git and in the owner
report after verification. Recompute live Git truth.

Each admitted session retry reserves its own recovered/failed outcome and
opaque operation ID. Sampling remains one pair per store instance, operation
and initial failure category/status every 60 seconds, plus the existing
standalone-failure allowance. Timeout/retry defaults remain 2,000 ms per attempt,
two attempts and 200 ms delay. Authentication, expiry, logout, response handling,
public APIs, dependencies, schemas, saved content and cache versions are unchanged.

Fresh locked-copy gates passed session resilience 73/73, runtime bootstrap
160/160 and startup/profile 116/116; documentation 652/652 and canonical package
boundary 75/75 also passed. Public live smoke passed 20/20, including five exact
committed asset matches. Owner sign-in, retained sessions, map administration,
Vehicle/Walking reads, room descriptions and a real panorama passed representative
checks. Natural timeout diagnostics included a verified warning/failed pair and
a verified warning/recovered pair. A post-response error also occurred; this
was not a zero-warning/error release. No provider cause is established.

The new runtime package is 201 files / 8,580,207 bytes, aggregate SHA-256
`01966f8b17022c7d43d9976876ef19e2680dda1b8c7c473cf683453f3368dfd0`.
Only `services/supabaseSessionStore.js` differs from the predecessor runtime.
The older fingerprint below remains dated predecessor evidence. These focused
checks do not establish full QA, exhaustive role/route/VR coverage, permanent
provider availability or complete immutable deployed-byte equality. The owner
approved this controlled release only; future deployments, repairs, migrations
or cleanup require a new focused task. The original investigation, protected
local files, previous release evidence and application data remain preserved.

## Historical Release Continuity (2026-10-20 room-scheduling removal release; superseded by October 21 handoff)

Read `docs/current-authority.md`, `docs/room-scheduling-release-2026-10-20.md`
and `docs/room-scheduling-removal.md` before history. The room-scheduling removal
release was owner-authorized on October 20, including review, release tests,
commit/push, staged Production checks and promotion. Its verified product source
is b39d08cf2536cafc5d965adba0803e743425a698, from
codex/remove-room-scheduling and baseline 0af76f161443f8259858f4fa67116bc12f51321e.
The initial verified Production deployment is dpl_FKR7rgR6QPbsBJp1PXcdKrVroiha
at https://campusphere-cspc.vercel.app. This is a dated October 20 product-release
observation, not a claim about a later documentation HEAD or deployment.
Recompute live Git truth. Documentation-only successors retain the same runtime
package; record their actual source/deployment identity in the final release
evidence. Ready alone is not acceptance. The rollback target recorded before
promotion is dpl_94jYqWkHoC19cLKnfooTVEG8SCyU, source c533719.

Room scheduling is retired for every role. Authorized retired API requests
return the standard JSON 404; login, role and CSRF protections remain. New
schedule hotspots and schedule metadata writes are rejected. Participant and
Administrator VR responses omit schedule types/metadata. Floor and room
descriptions remain. Scene, exit and information hotspots retain the previous
Guest visibility rules. Building/panorama image previews, Walking/Vehicle
routes, Free Roam and Guided VR remain available.

The October 19 one-time conversion is completed history: 73 saved Schedule
hotspots became private Info markers across 65 scenes, with room names/positions
preserved. October 20 read-back again found zero Schedule types among 1,469
hotspots. All seven application checks passed. The 69 image entries and 2
legacy entries remain intact; schedule metadata remains for the later full
cleanup. No live rows have been deleted. External hosted images and audit
history remain untouched. Empty tables/fields are retained. Future cleanup
requires owner-controlled target verification, stopped old writers, an external
backup and explicit confirmation. The prepared cleanup converts any remaining
schedule markers to private Info before clearing metadata/deleting schedule
entries. A same-backend legacy-reference guard protects building deletion;
synchronization tools reject retired schedule content before writes.

Migration sources remain contiguous through 0028 and unchanged. No migration
was applied. Production data and Express sessions use Supabase/PostgreSQL;
MySQL remains local/fallback/rehearsal. Supabase Auth is not used. The retired
SCHEDULE_DATA_SOURCE switch is absent from source templates; live environment
settings and secrets were not changed. Current service worker is v53; shared
stylesheet remains v13. No guide schema change or forced redownload is needed
for retirement. IndexedDB holds the explicit user-downloaded guide/PMTiles;
PWA Cache Storage is shell/static-only. Walking updates require a connected
refresh on each device. October 20 observed 26/26 saved paths, zero missing;
saved coverage does not establish visual approval of every walkway.

Fresh focused results include removal 401/401, Walking 118/118, offline
navigation 49/49, PWA lifecycle 148/148, shared VR navigation/Guest policy
140/140, session bootstrap 121/121, session resilience 21/21, shared rate limits
180/180, disposable PostgreSQL/MySQL cleanup/restore 28/28 and package boundary
75/75. Production smoke passed 20/20, including five exact committed asset
matches. Local/staged/live representative browser checks cover retained rooms,
CSLAB Info/privacy, panoramas, routes and a refreshed guide with 26 walking
paths; disconnected reload and 390 px layout passed. An existing local saved
guide and isolated older vehicle-only fixtures passed separately. Temporary
host protection redirected the basemap download to Vercel sign-in; the normal
website download passed immediately after promotion. Protection was unchanged.

The staged warning snapshot had 3 Warning rows, 0 Error, 0 Fatal, including
session-store touch timeout retries; displayed responses do not establish every
retry outcome. The October 18 12 Warning rows / 0 Error / 0 Fatal snapshot and
online visual-capture limitations remain dated history. Current monitoring is
recorded separately; do not claim a zero-warning window. This is not a full npm
test/qa pass, live MySQL parity, physical-device acceptance or exhaustive
route/VR traversal. An additional full R6 harness attempt stopped before its
isolated MySQL listener was ready; its vendor inventory checks passed, but no
full R6 pass is claimed. Focused checks do not erase historical failures.

The staged-Git runtime package is 201 files, 8,577,707 bytes, aggregate SHA-256
6c20279df6b9297f7859d1b0d01f72f15d863937c7816695919cf269924fe709.
The Leaflet CSS Git copy was corrected to its independently pinned original
bytes. Package identity and five sampled deployed assets are not complete
immutable deployed-byte equality. Backups/screenshots/private records remain
outside Git. Preserve protected local documents, ignored output and the local
exclude file. ICTU source readiness is separate from an actual ICTU deployment;
saved routes live in Supabase, not Git. No ICTU deployment or live cleanup ran.

The release authorization and the earlier 73-marker authorization do not carry
forward. Prior permissions do not carry forward; one writer owns a scope.
A new session's initial grounding turn is read-only and context-only: inventory
tools, read current source, report and stop after grounding, then wait for the
owner's explicit focused task. Availability does not expand authority. No
automatic commit, push, deployment, migration, cleanup, repair or data write
follows this completed release.

## Historical Release Continuity (2026-10-19 room-scheduling removal candidate; superseded)

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

## Historical Release Continuity (2026-10-17 panel-feature handoff; superseded)

The canonical current snapshot is `docs/current-authority.md`; the detailed
transition record is `docs/session-handoff-2026-10-17.md`. Copy the current
owner prompts from `docs/new-session-grounding-prompts.md`. Older continuity
sections and old permissions are historical, not instructions to resume work.

At the earlier pre-draft source checkpoint, Git branch `main` had an empty
index, a clean worktree, zero stashes, and ahead/behind `0/0`. Local `HEAD`,
`origin/main`, and remote `main` (checked with `git ls-remote`) all matched
`87980c5fe03c68b8f59f0b8fbdc263299c2acbce` (`87980c5`). This is the
pre-synchronization baseline, not a claim about a future documentation commit.
The owner authorized updating authority documents, grounding prompts, and their
network-free static checks. Commit/push is not authorized by this handoff task.
Because authority is self-referential, every new session must recompute Git
truth, preserve any pending documentation delta, and never clean it away.

At the start of the approved finalization, the worktree already contained
15 modified tracked files and one untracked handoff draft; nothing was staged,
source HEAD was still `87980c5`, and there were zero stashes. Those earlier
assistant drafts were review inputs, not an accepted checkpoint. The owner
subsequently approved the review-and-finalize plan. Do not describe this
draft-filled starting state as clean or relabel earlier checks as fresh results.

Source commits after the September 22 handoff are `b502c80` (Staff House
Vehicle-exit assertion alignment), `a3a0bfa` (Administrator map coordinate
pickers), `e275abe` (CampuSphere branding/PWA icons and Guided-VR parity
tooling/freeze refresh), `f695585` (guarded strict MySQL parity pruning), and
`87980c5` (remove building-name labels from map pins). Source presence is not
proof that a repair ran, that full QA passed, or that a feature is deployed.
The current service-worker cache key is `v50`, not the older `v48` checkpoint.

The pure source catalog contains 25 Vehicle entry destinations / 486 steps /
101 unique scenes, 25 Vehicle exit destinations / 545 steps / 105 unique
scenes, and 25 Walking destinations / 690 steps / 133 unique scenes. Vehicle
exits use explicit approved sequences; Walking exits retain direction-aware
handling. `config/selectedDemoFreeze.js` is dated 2026-09-24 and records
matching natural-key fingerprints and counts for the two backends (including
670 scenes and 1,465 hotspots). This is a recorded source verification baseline,
not fresh live MySQL parity. Neither parity tool may be run from grounding:
even its preview reads live systems, and apply/prune modes require separate
focused authority, exact preview/backup safeguards, and independent review.

Production application data and Express sessions target Supabase/PostgreSQL;
MySQL remains local development/fallback/rehearsal. Supabase Auth is not used.
Google OAuth and local Administrator credentials feed application-owned
sessions and server-side permissions. Guests may view buildings, routes and
360 scenes, but not room schedules; information hotspots need explicit
Administrator approval for Guests. Migration sources remain contiguous
through `0027`, owner-reported applied in the earlier record. Do not
apply/reapply migrations or change
approved route/VR data, sessions, or application rows without fresh authority.

Online and offline map pins intentionally have no persistent building-name
labels after `87980c5`; inspect the current selection controls and route-start
cue before proposing a label change. Navigation uses stored campus geometry,
not live GPS or automatic rerouting. PWA installation, the app shell/interface,
and the downloaded guide are separate. A connected, signed-in user explicitly
downloads or refreshes the guide: IndexedDB stores validated guide data and the
PMTiles Blob; service-worker Cache Storage is shell/static-only. The guide
excludes accounts/sessions, private/Admin data, schedules/images, current
announcements/events, building photos/external media, and all 360/Guided-VR/
Free-Roam panoramas. GitHub Actions publishes the basemap; it does not update
each device's saved guide. Disconnected users keep their saved copy until a
successful user-initiated refresh. Notification means the authenticated in-app
bell feed of audience-filtered announcements/upcoming events, not SMS/email
or operating-system push while the application is closed.

The last recorded owner-observed Production deployment is
`dpl_HbJRojVKtJUeUr2KMY6XhcRv6RCS` for exact product commit `0e7fe8b`, with
alias `https://campusphere-cspc.vercel.app`. Its status was not refreshed in
this handoff. Deployment/promotion of later source commits from September
23-24 is unverified here; do not call them deployed or undeployed without evidence.
Historical documentation/test commits `26f8cc6` and `3d43650` were recorded as
not promoted at the September checkpoint. These observations are not complete
immutable deployed-byte equality. The runtime upload allowlist remains
`.vercelignore`; this handoff grants no deployment or vendor access.
Production promotion remains an owner decision. Current Vercel settings have
not been reverified; do not assume a push is harmless or that a completed build
means promotion.

Retained September evidence reports LT-01 through LT-06 passed; LT-07 passed
through the owner's authenticated Chrome profile, while the preceding k6
offline-browser result remains rejected harness evidence. LT-08 passed all 26
configured thresholds with PASS WITH WARNING because three session-store
timeout-retry warnings occurred. The matching window showed about 5.6K
function invocations, 0% function errors, 0% function timeouts, no displayed
5xx, and 341 MB average / 352 MB P75 / 356 MB P95 against 2.05 GB. Rows for
GET /api/pathfind, GET /api/routes, and GET /api/search displayed 200 but do
not prove the later retry outcomes; it was not a zero-warning window. The
earlier rejected full-suite/MySQL result remains historical; later assertion
and parity-tool source changes do not turn it into a pass. This handoff runs
no full npm test/qa, browser, database, session, vendor or Production checks.
Evidence classes remain separate: source/Git, bounded static checks, recorded
local tests, owner observations, retained Production tests, sampled bytes, and
external acceptance. Current full-suite acceptance, live MySQL parity, complete
OAuth/Admin coverage, write capacity, exhaustive route/VR traversal, physical
offline-device acceptance, permanent provider availability, complete immutable
deployed-byte equality and CSPC institutional adoption are not established.

The completed local Git-marker cleanup preserved all 17 `output/` files
(documents/backups and five Word temporary files) and both affected source
files byte-for-byte. `/output/` is excluded only in this checkout's
`.git/info/exclude`; `.gitignore` and Git history were not changed. The two
line-ending-only markers were cleared with scoped Git re-normalization. No
files were deleted or moved, and no commit, push, test or deployment occurred.
These local-only documents/exclusions are not part of a clone or source archive.
Preserve them; a clean Git status does not mean ignored material is disposable.

The owner reports that panelists requested additional features, but their
exact requests and priority have not been supplied in this thread. No panel
feature is implemented, approved for development, or assigned by this handoff.
Open a new Codex or Claude Code session with the current prompt. Its first
turn is read-only and context-only: inventory actual tools/MCP/skills, read the
authority and source map, report discrepancies, then stop and wait. Tool
availability does not expand authority; do not install missing tools or invoke
browser/database/vendor tools merely to ground. Prior permissions do not carry
forward, and no delegated task may exceed the same boundary.

The next move after grounding is for the owner to provide the panelists' exact
requests, select one focused feature or bug fix, and agree its behavior,
affected roles/data/offline paths and acceptance checks. Implementation needs
its own scoped authorization. Resolve the handoff delta through a separately
authorized commit or other explicit isolation before a fresh feature branch
from then-current clean `main`; do not discard it or mix it into feature work.
Do not automatically resume MySQL remediation. One writer owns a scope at a
time; Codex/Claude coordination, review, tests, database writes, commit/push and
deployment/promotion each stay within their separately authorized boundaries.
Report and stop after grounding; wait for the owner's explicit focused task.

## Historical Architecture and rules to preserve

- Node.js >=22, Express 5 and EJS serve the browser/PWA interface. The data
  access boundary is `repositories/` and `services/`.
- Supabase/PostgreSQL/PostGIS is the Production data and Express session-store
  target. MySQL is local/fallback/rehearsal. Supabase Auth is not used.
- `middleware/roleAuth.js` is the authorization source of truth;
  `middleware/requireLogin.js` is a compatibility re-export. Keep server-side
  login/role checks, CSRF, nonce-based CSP/Helmet, input validation, and shared
  Upstash rate limiting intact. Server service-role access is not per-user RLS.
- OAuth registration maps supported institutional domains to Student/Faculty
  and supported personal Gmail to Guest; local public registration cannot
  create privileged roles. Administrator local login is separate.
- Room scheduling is retired for every role. Guest information hotspots
  require explicit Administrator approval. Authorized online content
  management does not give a user unrestricted database or vendor access.
- Directed route edges carry Administrator-authored geometry; Dijkstra selects
  stored graph connections. Building coordinates, route nodes, directed edges,
  and ordered VR scene sequences are distinct. Vehicle reverse travel uses
  independently authored geometry; Walking 2D return reverses its saved path.
- Cloudinary and approved Google Drive references deliver media. CampuSphere
  does not manage vendor uploads/accounts. The Drive proxy is authenticated;
  JPEG/PNG/WebP are supported, not HEIC/HEIF.
- Never read/disclose `.env`, credentials, signing keys, session/cookie data,
  live private records or secret values. Documentation is not external access.
- Do not run servers in the foreground on Windows; later authorized runtime
  probes use `scripts/with-server.js` and own/logout their sessions. A fresh
  grounding turn runs no probes, QA, server, browser or database commands.

## Historical evidence and reading route

Start with the October 21 handoff and current Codex/Claude prompts. The historical
October 19 transition record identifies the Walking 2D source entrypoints
and release. The historical October 17 transition record identifies academic
artifacts, source entrypoints, manuscript/deck disagreements, cleanup, missing
evidence and the first report expected from a new session. Historical test
results remain in `docs/test-evidence.md`; session incident details remain in
`docs/session-readiness-incident-2026-09-14.md`. The old readiness-query 401 and
late session-touch double-response defect are separate. `13adb9d` addressed
recoverable readiness; `b8d2bf2` guarded completed responses; `ab4ae61` added
sanitized diagnostics. Do not replay old fixes or claim provider reliability.

Authoring and inspecting this handoff proves documentation consistency only.
It is not fresh application QA, security certification, current database parity,
Production verification, immutable-byte proof or institutional acceptance.
