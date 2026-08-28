# CampuSphere Completion Roadmap

## Active Room Schedule Image Change (2026-08-25)

The current source candidate changes room scheduling to one semester-long image
record per room/facility and links VR schedule hotspots directly to that stable
record. Building details use the same accessible viewer. Admins paste an
approved Cloudinary delivery URL; the application performs no Cloudinary upload
or management call. Legacy time rows remain read-only fallback data and offline
packages continue to exclude schedules. Migration source `0020` exists but is
not applied; runtime verification and release work remain separately gated.

## Source Review Note

All requested files were readable: `AGENTS.md`, `CLAUDE.md`, `MANUSCRIPT_TEAMDUTCHESS.pdf`, and the first-party source files outside `node_modules`. The manuscript PDF was parsed from its text streams. A few extracted sections had formatting noise, especially the numbered objectives, but the project scope, modules, testing plan, and technical expectations were readable enough to compare against the codebase.

## Scope Revision Note

The team has revised the capstone scope to remove simulated academic records from the role dashboards. The final roadmap no longer includes fake student enrollment status, simulated enrollment information, fake instructor assigned-room widgets, fake instructor teaching schedules, or a fake instructor "all rooms" dashboard feature. Student and instructor dashboards should focus on role-appropriate campus navigation, announcements, profile information, room/facility schedule information where real data exists, and quick access to map/building/event features instead of pretending to integrate with enrollment systems.

Real room/facility scheduling is admin-managed semester image data, not hardcoded dashboard filler, SIS, enrollment, or instructor-load simulation.

## Final Product Stack Decision

The team has decided that the defended final product should align with the manuscript stack instead of stopping at the current prototype stack. The current codebase still uses Express/EJS, MySQL, Leaflet/OpenStreetMap, and local static assets, but the final target is:

- Express.js for server routes, authentication, and API endpoints.
- EJS or compatible server-rendered views for the web interface unless a later approved frontend migration changes this.
- Supabase with PostgreSQL/PostGIS for cloud-hosted relational and spatial campus data.
- MapLibre GL JS for the interactive campus map.
- Cloudinary for optimized delivery of campus images and VR panorama assets.
- Pannellum.js for 360-degree guided route scenes and hotspot navigation.
- Web App Manifest, custom Service Worker, and Cache Storage API for PWA installability and offline fallback.

This is now an approved migration target, not an undecided option. The roadmap should still call out migration risk because the current repository has not yet completed this stack transition.

## Post-Milestone 8 Manuscript Alignment Roadmap

Milestone 8 production hardening is complete. The next roadmap work aligns the hardened application with the manuscript while preserving the security posture already approved in Milestone 8.

Final architecture target:

- Supabase is the production data store and production session-store target.
- MySQL remains available for local development and fallback only.
- Cloudinary stores and delivers campus images and 360-degree VR panorama assets.
- Vercel is a demo/UAT hosting target for students, instructors, and guests.
- Docker remains the full deployment and institutional production-style hosting path.
- Guest access is authenticated guest-role access, not anonymous public browsing, due to school policy.

### Milestone 9: Supabase Session Store

Priority: P0

Goal: make production sessions manuscript-aligned by moving the production session store from MySQL to Supabase/PostgreSQL while preserving MySQL as a fallback.

Concrete tasks:

- Add a Supabase `app_sessions` table/migration compatible with `express-session` semantics.
- Add a Supabase-backed session-store service and support `SESSION_STORE=supabase`.
- Make `SESSION_STORE=supabase` the preferred production configuration after verification.
- Keep `SESSION_STORE=mysql` working for fallback and local rehearsal.
- Update deployment docs, README, and handoffs so production no longer requires MySQL once this milestone is complete.
- Verify login persistence across server restart, logout session deletion, expired-session cleanup, session secret rotation, and no session ID leakage in logs/responses.

Acceptance criteria:

- Supabase-mode production can run without MySQL for session persistence.
- Login, logout, CSRF, rate limiting, admin access, and role dashboards pass using `SESSION_STORE=supabase`.
- MySQL fallback session storage still passes the existing QA gates.

### Milestone 10: Cloudinary Media Support

Priority: P0

Goal: store real campus images and 360-degree VR panoramas in Cloudinary while keeping database rows as metadata and URL references.

Concrete tasks:

- Add server-only Cloudinary environment documentation for cloud name, API key, and API secret.
- Store `image_url` and `cloudinary_public_id` for VR scenes and campus media.
- Update CSP/security headers and PWA approved host logic for Cloudinary media delivery.
- Upload the final demo 360 panoramas to Cloudinary and replace `/img/vr/*.jpg` placeholder URLs.
- Keep missing-panorama fallback UI for incomplete scenes.

Acceptance criteria:

- Pannellum loads Cloudinary-hosted panorama URLs on `/vr`, `/vr/:sceneKey`, and guided VR routes.
- No Cloudinary API secret appears in EJS, public JavaScript, browser storage, logs, screenshots, or committed files.
- At least the final demo VR routes use real Cloudinary media.

### Milestone 11: Room Scheduling

Priority: P1

Goal: implement real admin-managed room/facility scheduling without bringing back fake enrollment or fake instructor dashboard widgets.

Concrete tasks:

- Add database support for room/facility schedule entries tied to buildings, floors, rooms, or facilities.
- Add admin CRUD for schedule entries with validation for date/time, room/facility, title/purpose, audience, and status.
- Display schedule/availability information in building or room detail views where it helps users navigate.
- Keep dashboards focused on role-relevant summaries and links; do not simulate enrollment, assigned classes, or instructor teaching loads.

Acceptance criteria:

- Admins can create, update, and remove real schedule entries.
- Users can view relevant room/facility schedule information without seeing fake academic records.
- Schedule data survives refresh and is served from the configured runtime data source.

### Pre-Milestone-12 Routing, Privacy, and Pilot Gates

The Road-Following Map Destination Routing Repair (RF.1-RF.6) and BE.5
selected 13-building parity/regression gate are complete and Codex GO.
Supabase migrations are exactly `0001` through `0019`, and `0014` through
`0019` are owner-applied. The current expanded freeze is backend-specific:
MySQL has 34 buildings, 44 route nodes, 100 directed edges, 50 exact reverse
pairs, and 100 valid geometries; Supabase has 25 buildings, 26 route nodes, 50
directed edges, 25 exact reverse pairs, and 50 valid geometries. The shared
Guided-VR catalog has 25 active destinations, 472 configured steps, and 99
unique scene keys. CampuSphere computes routes from its own campus graph;
Google Maps, Google Earth, Strava, SIS, and external routing engines are not
integrated, and CampuSphere renders owner-managed road geometry. Guided VR
reports arrival only after the stored start node, stored
destination node, approved media, and exact bidirectional scene chain verify.
BE.6 remains an accepted gate, while this expanded freeze and its fingerprints
are candidate evidence. The ordered matrix is complete; live Git and the latest
external review report control its later disposition. The
older CAS-only/deferred-CCS manifest is historical and
is not current authority.

The `M12.P1-R3` runtime/bootstrap work and all session-hygiene/ownership/
import-detector follow-ups are **complete and Codex GO**. The implementation mints the regenerated
session's CSRF token before the authenticated session is saved, stops the test
harness from inheriting an ambient `SESSION_STORE`, gives every canonical-login
probe an owned logout path, and adds a registered SELECT-only residue gate as
the authoritative zero-session postcondition. Accepted evidence: full suite
`2921/2921` with `QUALITY-GATES OK`; standalone R1
`24/24`, R2 `88/88`, R3 `86/86`, BE.6 `46/46`. R4 later received Codex GO
after focused `180/180`, R2 `119/119`, unchanged R3 `86/86`, R4 full suite
`3040/3040`, R1 `24/24`, residue `18/18`, and BE.6 `46/46`. The superseded
pre-R5 authority-sync suite was `3050/3050` with `QUALITY-GATES OK` (+10
`docs-current` checks); after the R5 follow-up the accepted R5 closeout suite
passed `3234/3234` with `QUALITY-GATES OK`, with focused R5 `90/90` standalone.
The accepted 2026-07-22 compatible dependency-security remediation remains
historical Codex GO evidence: at that closeout production resolved
`body-parser@2.3.0` and `brace-expansion@2.1.2` with zero audit vulnerabilities
and no `package.json` change.

OFF.1 Offline Baseline Audit and Domain Contract is complete and Codex GO. It
verified authenticated HTML is network-only and `no-store, private`, `/map`
logout carries a valid CSRF token, explicit API/static/session-neutral shell
caching remains available, and browser Back/reload after logout cannot replay
the authenticated map or retain CampuSphere dynamic caches/catalog records.

<!-- M12 RELEASE CONTINUITY START -->
## Current Release Continuity (2026-08-28)

Live Git at the start of this synchronization is branch `main`, with local
`HEAD`, `origin/main`, and remote `main` all equal to pushed Git commit SHA-1
`e481d0343313e6356438393a783b48d838f01a36` (`e481d03`,
`feat: add semester room schedule flow`). The index and worktree are clean,
there are zero dirty paths and zero stashes, and predecessor Git commits are
Git commit SHA-1 `2b4f42df3f79347c70af07f7b98f70be55b701bd` (the
non-Cloudinary stabilization) and Git commit SHA-1
`dc961b1eeba191d79b96998d96f0a49dac3ffcf8` (the searchable
course catalog). Recompute live Git truth in every new session; this snapshot
does not authorize normalization when live truth differs.

This synchronization itself now has an exact unstaged 12-path authority delta:
the 11 authority documents plus `scripts/quality-gates.js`. The index is empty,
there are no untracked paths, and zero stashes remain. These working-tree facts
supersede the clean-start snapshot for a new session until this authority delta
is separately accepted, committed, and pushed.

At the synchronization checkpoint, the product candidate was committed locally
as Git commit SHA-1 `38905b7b2b103caa9ed0575f1031b30344944970` (`feat: add
public FAQ and institutional settings`) on top of `e481d03`. At that
checkpoint, local `HEAD` was this product commit while `origin/main` and
remote `main` remained `e481d03`; the index was empty and exactly the 12
authority paths remained unstaged, with no untracked paths and zero stashes.
The product commit had not yet been pushed at that checkpoint; authority
synchronization and push were separate boundaries. Recompute live Git truth
before relying on this checkpoint.

The retained safety branch `backup-pre-trailer-strip` still points to Git
commit SHA-1 `d387c9151f1582cc4a8fc80002be52e11956335f`.

Accepted history remains separate and unchanged: Milestones 8-11, RF.1-RF.6,
BE.1-BE.6, OFF.1-OFF.6, M12.P1 R1-R7, D1-D7, dependency-security
remediation, the independently reviewed `bb17b9b` release authority, and the
owner-observed later Production/OAuth/course evidence retain their recorded
dispositions. The abbreviated operative lineage is
`d786bdc -> c00db76 -> bb17b9b -> dc961b1 -> 2b4f42d -> e481d03`.

The pushed `e481d03` candidate contains the completed non-Cloudinary campus
stabilization plus the semester room-schedule image flow. The stabilization
includes valid Guided-VR and Free Roam scene arrows, VR light/dark parity,
compact accessible online/offline building pins, the offline label `Guard
House`, the authenticated notification feed/panel and shared styling, the Paga
About card, admin category-dropdown styling and user role/status filters, safe
Google profile-image synchronization, and removal of the manual profile-photo
upload. Manual Cloudinary upload remains deferred and the application does not
call Cloudinary upload, delete, or management APIs for the schedule flow.

The room-schedule design is one semester-long image document per room/facility.
An administrator pastes an approved HTTPS Cloudinary delivery URL and optional
public ID; no image bytes are uploaded by CampuSphere. A schedule hotspot stores
`schedule_document_id`, and updating the linked document updates every viewer
without rewriting hotspot metadata. The shared accessible responsive viewer is
available from building details and VR; legacy time-row/hotspot metadata remains
read-only fallback, and schedules remain excluded from the offline package.
The owner applied `0020_room_schedule_documents.sql` to Supabase, local MySQL
schema parity was verified, and migration sources are contiguous through
`0020`. Do not reapply migration 0020 without a new explicit database
authorization.

Accepted `e481d03` verification remains a separate evidence class: its exact
source passed `npm test` at `4998/4998` with `QUALITY-GATES OK`; five-stage
`npm run qa` exited 0 with `QUALITY-GATES OK`, `DB-PERF-GATE OK`,
`[supabase-smoke] PASS`, `IDENTITY-CONSTRAINTS OK`, and `found 0
vulnerabilities`. Focused room-schedule verification passed `58/58`, the
package boundary passed `74/74`, BE.6 passed `46/46`, and the final session
residue contract passed `18/18`.

The product commit `38905b7` was independently reviewed in the order
Security -> Performance -> Correctness -> Maintainability with no critical,
high, medium, or low findings. Its current read-only verification exited 0 for
`npm test` with `QUALITY-GATES OK` and for `npm run qa` with
`QUALITY-GATES OK`, `DB-PERF-GATE OK`, `[supabase-smoke] PASS`,
`IDENTITY-CONSTRAINTS OK`, and zero audit vulnerabilities. Focused product
probes passed: public FAQ `38/38`, site settings `26/26`, settings runtime
`20/20`, package boundary `74/74`, BE.6 `46/46`, and final session residue
`18/18`. The current wrapper did not emit a standalone aggregate count, so the
accepted `4998/4998` total above is not relabeled as a new product total. This
records verification and review only; Final Milestone 12 remains external.

Authority-sync validation on 2026-08-26 is separate incomplete/rejected
evidence. After the documentation corrections, the exported source-only
`docs-current` gate passed. The full `npm test` rerun was not green because two
read-only live-state postconditions changed: Supabase now has 665 total VR
scenes against the 664-scene freeze, and exactly one intended-role canonical
Supabase administrator session was unexpired at classification time. The
newest additional scene is outside the selected 101-scene verification scope
and has zero outgoing hotspots and zero incoming scene links; all building and
route semantics, selected-VR and Guided-catalog fingerprints, and all 25
active Guided routes still passed. The session was due to expire at
2026-08-26 13:30:36 Asia/Manila. No scene, freeze, session, account, or other
data was changed. Recompute both conditions live; do not delete content,
refresh the freeze, or revoke a session without a separate explicit owner
authorization. No authority-sync `npm run qa` was run.

The accepted `e481d03` runtime package identity remains historical: 180 files,
7,189,621 bytes, aggregate SHA-256
`c07e34f43f859f3f4055c9a00f90b0a5967d323ef85e243227d95c8023195216`.
The current product commit package identity is 186 files, 7,220,073 bytes,
aggregate SHA-256
`c19b2bb9bcd328df56f0eb247077f48e0c3cc6f35bf919c0e22da0d3add1f621`.
Documentation and `scripts/` are outside the deployment package; this package
identity is source/package evidence, not deployed-byte proof.

Commit `e481d03` is committed and pushed to `main`, but no owner-authorized promotion,
Production acceptance, or independent anonymous deployed-byte verification is
recorded for it. Do not infer current Vercel deployment state from older
screenshots. The last independently post-deployment-verified technical
Production baseline
`fea3b2e11c6331eddc1ee091b165427d8e0218d7` remains; owner-observed
Production behavior for later commits remains a separate evidence class and is
not byte proof for `e481d03`.

Production architecture remains Supabase/PostgreSQL for application data and
sessions, with MySQL for local development, fallback, and rehearsal. The stored
frozen verification baseline remains MySQL 34 buildings / 44 route nodes / 100
directed edges / 50 exact reverse pairs / 100 valid geometries; Supabase 25 /
26 / 50 / 25 / 50; and the shared Guided-VR catalog 25 active destinations /
472 configured steps / 99 unique scene keys. The accepted candidate's final
canonical-session postcondition was zero unexpired residue (`18/18`). The supported MySQL CCS route
node/geometry correction and the exact previously authorized session
revocations are closed operational history, not authorization for further data
or session mutation.

The owner-run `scripts/syncSupabaseContentToMysql.js --dry-run` remains
read-only preview evidence: it reported no content differences and equal
fingerprints SHA-256
`2504a0474b0481964d447f5f538b9e4e1cd77ef0116c4299c12d0a81eae5bf05`.
No data was written, and this is not an applied sync, current database
verification, backup, or restore claim. Preserve the external backup/restore
record of 109/109 files and 86 referenced Cloudinary delivery assets without
putting credentials, signed URLs, database identifiers, backup paths,
participant PII, developer-contact emails, or verification artifacts in Git.

Google OAuth remains owner-observed `In production` and requests only `openid
email profile`; Google Data Access reported that sensitive or restricted-scope
verification is not required, and the owner confirmed account creation and
sign-in work. Branding/Search Console ownership remains deferred and unverified.
Do not describe OAuth as independently verified or unlimited. The owner-attested
2026-08-05 human pilot remains accepted with zero reported findings, while
participant/Form evidence and full source-commit identity remain external.

The owner-observed Android 8 installed-PWA behavior is now classified as an
unsupported Android/Chrome platform compatibility observation, not a confirmed
CampuSphere code defect and not a proven hardware failure. Chrome 138 was the
last release for Android 8/9, current Chrome requires Android 10+, and the exact
old-device crash cause was not reproduced with device logs. The supported
mobile presentation target is Android 10+ with a current Chrome release;
further Android 8 investigation requires a separate bounded authorization and
sanitized device evidence.

The participant-facing public FAQ is implemented and committed in product commit `38905b7` as a
public, server-rendered `/faq` page backed by the existing dual-backend
administrator-managed FAQ data. It is available to signed-out visitors and
signed-in users, with public and signed-in top navigation, a shared light/dark
theme control, accessible native accordions, search and category filters, and
escaped admin-authored text. Admin FAQ CRUD remains at `/admin/faqs` and
`/admin/api/faqs`; saving publishes a row immediately, with no schema or
migration change. The focused `publicFaq-probe.js` passed `38/38`; the FAQ is
standalone and is not embedded in the dashboard. The FAQ implementation is
committed locally and not pushed; the authority synchronization and push
remain separate boundaries. Promotion and deployment are not authorized.

Keep evidence classes separate: accepted historical release/R8 evidence;
course-feature and owner-observed Production/OAuth evidence; live Git truth;
accepted `e481d03` source/package/review/push evidence; current product commit
`38905b7` source/package/verification/review evidence; owner-applied migration
0020; the read-only sync preview; the Android compatibility observation;
missing promotion, Production acceptance, and deployed-byte proof for the
current product; and the external Final Milestone 12 disposition.
This synchronization changed the authority documents plus
`scripts/quality-gates.js`; the FAQ implementation is separately authorized as
a separately committed local product. No new session may infer authority to
promote, deploy, alter SQL/data/sessions, contact Cloudinary or another vendor,
or run Production smoke. Deployment is not authorized by this synchronization.

Every older section below that presents an earlier candidate or lifecycle as
"current" is retained only as an explicitly historical snapshot. This block and
fresh live repository/vendor evidence win when they conflict.

Final Milestone 12 disposition remains external.
<!-- M12 RELEASE CONTINUITY END -->

<!-- M12 HISTORICAL RELEASE CONTINUITY START -->
## Historical Release Continuity (2026-08-24; superseded)

Live Git at the start of this authority synchronization was branch `main`,
with local `HEAD`, `origin/main`, and remote `main` all equal to pushed Git
commit SHA-1 `dc961b1eeba191d79b96998d96f0a49dac3ffcf8`. The index was empty;
the worktree contained exactly 58 modified tracked paths and 12 untracked paths
(70 dirty paths total), with zero stashes. Eleven authority documents plus
`scripts/quality-gates.js` are the 12 tracked authority/static-assertion
surfaces; the other 46 tracked paths and all 12 untracked paths belong to the
current uncommitted implementation. The retained safety branch
`backup-pre-trailer-strip` points to
`d387c9151f1582cc4a8fc80002be52e11956335f`. Preserve this worktree exactly
and recompute live Git truth in every new session rather than reusing this
time-specific snapshot.

The release lineage is verified offline implementation
`d786bdcb83a196c7263dceae668417d3ced3e95a`, bounded readiness/session
maintenance `c00db76c5be0fe9c8dfdc8168a4c4303c6a0aa64`, independently reviewed
release authority `bb17b9b603583bcc2934e3ffab1cbdcb7d6b0ddd`, and searchable
course-catalog enhancement
`dc961b1eeba191d79b96998d96f0a49dac3ffcf8`.

The accepted `bb17b9b` release evidence remains unchanged. Its independently
reviewed authority delta covered 12 files and 1,854,481 bytes, with manifest
SHA-256
`1c5ed249dd21894a2cb0871a04fc650deebfe2fa790b7e260d123415a4aa45c7`.
Its release package pin was 168 files and 7,074,195 bytes, aggregate SHA-256
`13cd3c5e5d8259766e50b1136c8cc8a5672b2321c65962892358c62b45ef88f5`.
Replacement verification completed with `npm test` exit 0 and
`QUALITY-GATES OK`; `npm run qa` exited 0 with `QUALITY-GATES OK`,
`DB-PERF-GATE OK`, `[supabase-smoke] PASS`, `IDENTITY-CONSTRAINTS OK`, and
`found 0 vulnerabilities`; bounded Chrome acceptance completed in Supabase
and MySQL modes; final ordered postconditions passed at
`24/24 -> 18/18 -> 46/46`. The clean-commit independent R8 review returned
**GO** with no critical, high, medium, or low findings.

The owner separately authorized the `bb17b9b` push and manual Vercel promotion.
Owner-observed dashboard evidence showed `Ready`, blue `Production`, branch
`main`, and an 11-second build. No independent anonymous GET-only
post-promotion byte verification has been recorded for `bb17b9b` or
`dc961b1`. Git commit SHA-1
`fea3b2e11c6331eddc1ee091b165427d8e0218d7` remains the last independently
post-deployment-verified technical baseline; that historical smoke is not byte
proof for either later commit.

The owner supplied 29 official course titles for this application plus
`Other`. Commit `dc961b1` replaced the abbreviated selectors and added an
accessible, case-insensitive course search to new-student OAuth registration
completion and the existing student profile editor. Clearing the query or
pressing Escape restores the list; no matches retain `Other`; live status text
announces result counts. Existing saved legacy course values remain visible
until a student deliberately selects a new value. The submitted field remains
`course`; controllers, repositories, APIs, database schema, and migrations did
not change. The six-file commit recorded 433 insertions and 28 deletions.

Course-feature verification is a separate evidence class: the implementation
session recorded `npm test` exit 0 with `QUALITY-GATES OK` and five-stage
`npm run qa` exit 0 with `QUALITY-GATES OK`, `DB-PERF-GATE OK`,
`[supabase-smoke] PASS`, `IDENTITY-CONSTRAINTS OK`, and zero audit
vulnerabilities. The in-session package-boundary run passed `74/74` and
reported a then-current working-tree package of 168 files, 7,088,275 bytes,
aggregate SHA-256
`9849e3c18c70e54a3502217275724367945ff176be22ce4d20796b5c103dc9ec`.
Because unrelated authority/static-assertion edits were already unstaged, that
working-tree package identity is not clean-commit or deployed-byte proof. The
feature commit was pushed, separately promoted by the owner, and the owner
confirmed the registration and profile course flows work in Production. This
is owner-observed functional acceptance, not an independent review, byte
smoke, or new GO/NO-GO.

Production uses Supabase/PostgreSQL for application data and sessions; MySQL
remains local-development/fallback/rehearsal data. An offline-guide download is
a backend-specific immutable snapshot taken through the supported guide API.
Therefore a production download is built from the then-current Supabase
building and route data and should match the online production map for that
download point. The offline scope remains the normal 2D campus map, Main Gate
routes, text building details, the approved local placeholder, and required
2D map assets. It excludes 360/Guided-VR/Free-Roam content, schedules,
building photos, Cloudinary media, and private/admin/session data.

The local MySQL readiness residue incident is closed history: the readiness
poll now uses the pre-session `/favicon.ico` route, and the exact authorized
supported cleanup destroyed 309 harness-shaped anonymous sessions with
cleanup fingerprint SHA-256
`a50b800e370439e0257cb7667d3fdb567af9dab88b87c3aeca6f32593598d18d`,
leaving zero candidates and zero scanned residue. No cleanup is authorized by
this record. Migration sources are contiguous through `0020`; owner-applied
`0020_room_schedule_documents.sql` is recorded before this verification.
Preserve one-writer control and the external
backup/restore evidence: 109/109 manifest files verified, isolated Supabase and
MySQL restore proofs passed, and 86 referenced Cloudinary delivery assets were
exported and hashed without claiming a Cloudinary management/original-account
export.

The owner attests that the human pilot occurred on 2026-08-05 and accepts it
with zero reported findings. Participant/Form evidence remains external, no
participant PII is recorded in Git, and the tested build's full source-commit
identity was not independently verified. This is owner-attested pilot
acceptance, not independent current-build verification; pilot review is
complete for sequencing.

Google OAuth is now owner-observed `In production`. CampuSphere still requests
only `openid email profile`, and Google Data Access reported that sensitive or
restricted-scope verification is not required. The owner confirmed Google
account creation and sign-in work. Branding is not verified: Search Console
ownership for `campussphere-cspc.vercel.app` was not completed, the consent
branding remains unavailable, and the owner chose to defer that optional
branding work while sign-in functions. Do not describe OAuth as verified or
unlimited. Public local registration still creates guests only; trusted
student/instructor identity comes from CSPC Google OAuth.

The current uncommitted candidate is a stabilization candidate that includes the semester room-schedule image
flow, owner-applied `0020_room_schedule_documents.sql`, admin-pasted Cloudinary
delivery metadata, accessible image viewing, direct VR schedule-document links,
valid Guided-VR and Free Roam scene arrows, VR light/dark theme parity; smaller
accessible building pins online and offline; the offline display label `Guard
House`; the authenticated notification feed/panel and its cross-page stylesheet
ownership; the Paga About card; admin category-dropdown styling and user
role/status filters; safe Google profile-image synchronization; and removal of
the manual profile-photo upload. Do not record
or reuse any credential, account identifier, support contact, or secret.

The owner-run `scripts/syncSupabaseContentToMysql.js --dry-run` preview was
read-only and reported no content differences; the Supabase source and MySQL
target fingerprints both equalled
`2504a0474b0481964d447f5f538b9e4e1cd77ef0116c4299c12d0a81eae5bf05`.
No data was written, and users, role profiles, login sessions, and activity
logs remained excluded. This is preview evidence only, not an applied sync,
backup, restore proof, or current database verification. Existing instructor
OAuth completion collects full name, read-only email, employee ID, department,
and position. The owner-observed Android 8 installed-PWA crash remains
unresolved even though ordinary browser OAuth later worked; Docker/client-clone
deployment readiness also remains deferred.

The owner selected this next sequence: a fresh session grounds first; a later
separately authorized session verifies the non-Cloudinary changes; Cloudinary
support remains an external event-based dependency; and if no response has
arrived, work continues on verified non-Cloudinary findings one bounded issue
at a time. Manual Cloudinary upload stays deferred until the owner supplies a
sanitized support response and separately authorizes a bounded permission and
upload-acceptance plan. Grounding prompts do not themselves authorize tests,
fixes, browser/server work, database access, or vendor operations.

Evidence classes must remain separate: accepted historical release/R8
evidence; course-feature verification; live Git truth; the current uncommitted
implementation; previously reported focused/source checks; owner-observed
localhost visual acceptance; the Supabase-to-MySQL dry-run preview; the pending
Cloudinary blocker; the unresolved owner-observed Android installed-PWA
behavior; owner-observed Vercel/Production and OAuth facts; the missing
independent post-promotion byte verification for `dc961b1`; and the missing
current full QA, independent review, commit, push, deployment, and Production
acceptance for this worktree. This synchronization issues no new GO/NO-GO and
authorizes only these authority/static-contract edits plus bounded source-only
validation. It authorizes no product implementation, browser/server work,
database/session access, vendor mutation, Git-history mutation, push,
promotion, deployment, or production smoke. Final Milestone 12 disposition
remains an explicit owner/external closeout decision.

Every older section below that labels the pre-promotion maintenance state as
“current” is retained only as a historical snapshot. This continuity block and
live repository/vendor evidence win when they conflict.
<!-- M12 HISTORICAL RELEASE CONTINUITY END -->

<!-- M12.P1 CURRENT STATUS START -->
**HISTORICAL PRE-PROMOTION SNAPSHOT (2026-08-21; superseded by the current
release continuity block above).**

Accepted history remains unchanged: Milestones 8-11, RF.1-RF.6, BE.1-BE.6,
OFF.1, M12.P1 R1-R7, D1-D5, and expanded D7 are complete and Codex GO. The
limited human-pilot review is owner-accepted as described below. OFF.2-OFF.6
are complete and Codex GO on local commit
`cdbc863b779e5319c14dee21a31a5e78951e233c`; M12.P1-D6 is complete and Codex
GO on local commit `691f0bef40e06b6ea9485e713d2fe3000a03bd83`. The exact
19-file offline UI/accessibility/package implementation was independently fully
verified, committed as `d786bdcb83a196c7263dceae668417d3ced3e95a`, and pushed
to `origin/main`.

Historical/rejected: the independent read-only closeout review of exact 19-file predecessor manifest
SHA-256 `dd63b8a3b6e89294cb7b971c8fb8226c0098009ef9d3d7fa8c55f78d2a490a16`
(19 files, 2,042,891 bytes) returned NO-GO solely for a fallback
coordinate-frame defect: the decorative SVG's default aspect-preserving
`0 0 1000 700` viewBox did not align the full-box HTML marker overlay on
non-10:7 containers. The bounded correction adds
`preserveAspectRatio="none"` and rejecting fixtures for the missing and
`xMidYMid meet` coordinate-frame variants. The pre-authority-sync manifest
SHA-256 `30e4dea3ac61e7598037630bb4748a8ea100f02b71c3dd8d64109f6e8fec4087`
(19 files, 2,043,780 bytes) is predecessor evidence for this authority
synchronization; recompute the final live manifest after these authority edits.
The first replacement browser acceptance of the preceding exact 19-file
candidate is historical/rejected solely for a mobile overlap at 390x844: the
fixed `#offlineMobileListToggle` covered the visible `#offlineSetDestination`
action, so hit testing landed on Building List and destination activation
failed. Desktop route acceptance and the preceding static/full-suite checks
were green; the browser run stopped before MySQL and the final ordered
postconditions. The bounded correction hides the toggle only while
`#offlineDetailsPanel.visible` on max-width 768px and adds rejecting fixtures
for the wrong selector, state, media scope, and DOM order.
Replacement full verification of the committed implementation passed at
`4998/4998` with `QUALITY-GATES OK`, five-stage QA at the same exact contract
total, bounded Chrome acceptance in both supported backends, and ordered
postconditions `24/24 -> 18/18 -> 46/46`. The clean-commit independent R8
review then returned NO-GO solely because stale operative lifecycle authority
still described this pushed, verified commit as uncommitted and pending; it
found no separate runtime, security, database, or package blocker. This R8
result remains the current external disposition until a later corrected review.

It preserves the
rendered route when the summary closes, keeps the route-dialog Tab/Shift+Tab
and Escape/backdrop lifecycle, and reuses the visibility-aware focus selector
when building details close. Connected but off-screen controls are rejected;
the visible fallback order includes the mobile Building List toggle. The theme
  toggle now synchronizes its accessible pressed state and action label, and
  persists the shared `campussphere-theme` preference. On mobile, the closed
  building sheet is `inert` and `aria-hidden`; closing restores focus to a
  visible control before isolation, and viewport changes keep that state
  synchronized. Every named offline action and map control has an exact
  44-by-44-pixel minimum enforced by rejecting fixtures. The simplified-map
  fallback keeps its SVG basemap and route decorative and exposes each building
  as a labelled native HTML button in a named overlay with an exact 44-by-44
  CSS-pixel target. The service worker advances from v24 to v25 so stale v24
  caches are pruned. Exact 19-file manifest SHA-256
  `5ac682f53fcd2392ddec3c5cc288a3d1e194af52d2e7ea09f68bb2b5c485c37c`
  received independent read-only review NO-GO for undersized interactive SVG
  fallback markers nested beneath one image role. The earlier exact manifest
  `ec326965aba9b9daec87bb214d98b50ddedf2ad99e916864e79ad04ebafc556f`
  remains historical/rejected for the off-screen mobile accessibility state,
  fail-open generic touch-target assertion, and unpersisted theme preference.
  Both predecessors are historical/rejected. The corrected pre-authority-sync
  candidate is exact 19-file manifest SHA-256
  `494010dd9d1aadb43c2d124543c302d97bece118b8c687109ccd6e2624ed0610`
  (19 files, 2,020,639 bytes). Focused evidence only is OFF.2 `145/145`, offline
  2D `35/35`, and package boundary `74/74`; the accepted committed implementation package identity remains
  168 files, 7,073,128 bytes, aggregate SHA-256
  `1d6cc68b7ef350b6a61eb8d84ea4fb7dd6862bd8548beb7595d3f2e6f4b10d6a`.
The `494010dd...` manifest is predecessor evidence for the committed
implementation, not a pin for the later documentation/static-assertion
correction. The correction is a separate byte set: live Git and the latest
independent external review report control its lifecycle and disposition, and
this authority text does not claim that correction is reviewed, committed,
pushed, R8-approved, promoted, or deployed. Final Milestone 12 disposition
remains external. The accepted technical Production baseline remains
`fea3b2e11c6331eddc1ee091b165427d8e0218d7`; future `main` deployments require
explicit manual promotion, and no promotion or deployment is authorized here.

The current local maintenance correction is committed locally on `main` as
Git commit SHA-1
`c00db76c5be0fe9c8dfdc8168a4c4303c6a0aa64`; it has not been pushed to
`origin/main`. Its exact 16-file manifest SHA-256
`5bd2ba68fd442da73e36b53a3c1e4b1cfff30496e4ce50884382781ba9479a2d`
(16 files, 1,915,676 bytes). It changes the readiness poll to a pre-session
route and adds a fail-closed scripts-only operator plus a narrowly scoped
supported conditional session-store interface; that interface is deployable
runtime support and is included in the package. The current package identity
remains 168 files, 7,074,195 bytes, aggregate SHA-256
`13cd3c5e5d8259766e50b1136c8cc8a5672b2321c65962892358c62b45ef88f5`;
package identity does not authorize deployment. The `app_sessions` schema has
no provenance field: the exact anonymous cookie+csrfToken shape is an
operational scope selector, not proof that every row came from the historical
readiness request. The exact owner-authorized local cleanup found 309
harness-shaped candidates with cleanup fingerprint SHA-256
`a50b800e370439e0257cb7667d3fdb567af9dab88b87c3aeca6f32593598d18d`,
destroyed 309 through the supported conditional interface, and left zero
candidates and zero scanned residue. This is recorded execution evidence; no
new cleanup is authorized by this text. Replacement full verification remains
a separate boundary; push, promotion, and deployment remain separately gated,
and Final Milestone 12 disposition remains external.

Dependency-security remediation is complete and Codex GO. Following the
accepted 2026-07-22 dependency closeout, the subsequent 2026-07-26 npm advisory
drift remains remediated: production pins ejs@6.0.1, the
jake/filelist/minimatch/brace-expansion chain is absent, and accepted audit
evidence from npm audit --omit=dev records zero vulnerabilities. M12.P1-R7 is complete and
Codex GO. Accepted R7 evidence is focused 71/71, in-suite
vercel-package-boundary 70/70, full suite 3495/3495 with QUALITY-GATES OK, and
npm audit --omit=dev at zero vulnerabilities. The 3492/3492 and 3494/3494
candidates remain historical/superseded. M12.P1-D7 is complete and Codex GO.
Accepted D7 evidence remains the fresh-context role-isolation run with separate
Playwright BrowserContext objects, clean supported-interface teardown, npm test
3511/3511 with QUALITY-GATES OK, audit zero, and postconditions
24/24 -> 18/18 -> 46/46 with aggregate fingerprint
a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d
unchanged at that accepted historical baseline.

The Guided-VR runtime and catalog remediation remains recorded as commit
43627cf0a77741556f4e701711e55612a739799b, with Git tree
eb3e830f68d537c4a54d6dda6df7d52a61f9c87b. The final R8 authority
synchronization is committed and pushed as
fea3b2e11c6331eddc1ee091b165427d8e0218d7; live Git at the post-deployment
review confirmed branch `main`, local HEAD, and origin/main all matched that
commit. The separately authorized push automatically triggered Vercel
Production through the Git integration while automatic production-domain
assignment was still enabled. The owner accepts
https://campusphere-cspc.vercel.app on
fea3b2e11c6331eddc1ee091b165427d8e0218d7 as the current technical Production
baseline. Owner-observed Vercel evidence showed `Ready`, `Production`,
`Current`, branch `main`, and source commit `fea3b2e`; the build completed in
17 seconds with one advisory that `engines.node` is `>=22` and can advance to a
future major Node release.

Post-deployment verification passed within its bounded anonymous read-only
GET-only scope: the production alias served the expected public pages and
static assets, sampled deployed bytes matched the pushed source, protected
HTML routes redirected to `/auth`, protected JSON routes returned `401`, and
the checked responses set no session cookie. `/auth` was deliberately not
requested because it may create an anonymous identity-free session; no
authenticated flow or schedule auditing was exercised. The accepted source
package identity remains 158 files, 6,245,074 bytes, aggregate SHA-256
b3113c05daaa5d2e870f204083923434456580fa6499190421de062ce9cabbd4.
After this review, Vercel `Auto-assign Custom Production Domains` is disabled.
Future `main` pushes may create staged Production deployments, but
they require an explicit later `Promote to Production` action before replacing
the live alias. This control was confirmed from the saved dashboard state and
was not tested with a dummy push. The later documentation/static-assertion-only
authority synchronization is committed and pushed as
`db05b549807535840968bf28cdefac4154a6d59d`. Live Git then confirmed branch
`main`, local HEAD, and origin/main all matched that commit with a clean index
and worktree. Vercel built it as `Ready` / `Production` / `Staged`; custom-domain
assignment was `Skipped`, it was not promoted or made `Current`, and
`fea3b2e11c6331eddc1ee091b165427d8e0218d7` remained on the live alias.
Historical/superseded: before this deployment,
Production served 0627bf78228148e3f989275810c333c16a1f3356; its five-file
verification, anonymous smoke 31/31, and automated frozen-data rehearsal remain
accepted historical evidence.

The separately authorized backup and additive reconciliation were performed
under one-writer control. The external backup set contains provider-supported
Supabase roles/schema/public-data dumps, pre- and post-cutover restore bundles,
separate MySQL dumps, and a referenced-delivery Cloudinary export. All 86
referenced delivery URLs downloaded and were hashed; this is not a Cloudinary
management/original-account export. Isolated Supabase and MySQL restores
passed, and the external aggregate manifest recorded 109/109 files with zero
checksum mismatches. After the bounded duplicate-link correction, a fresh
MySQL dump was checksummed and proved by isolated canonical restore/redump
(6/6 manifest checks). Secrets, signed URLs, database identifiers, and backup
paths remain outside Git.

The data reconciliation used supported administrator interfaces only. It did
not use direct SQL, blanket deletion, syncSelectedCasVrSupabaseToMysql.js
--apply, or migration 0020. Additive catalog and scene-to-node reconciliation
completed without deleting buildings, schedules, routes, scenes, or users.
A later bounded preflight confirmed three MySQL Guided-VR directions each had
exactly two otherwise redundant links while each reverse direction had one.
After visual confirmation that the duplicates represented the same navigation
point, exactly one redundant hotspot was removed from each direction through
the supported administrator interface—three deletions total, no blanket
cleanup. The fresh post-correction MySQL backup and isolated restore proof
supersede the pre-correction MySQL copy for rollback purposes.

The 13-building models/data.js roster remains the reproducible seed baseline;
it is not asserted as the complete live catalog. Current MySQL truth is 34
buildings, 44 route nodes, 100 directed edges, 50 exact reverse pairs, 100 valid
endpoint-continuous geometries, 671 VR scenes, and 1,396 hotspots. Current
Supabase truth is 25 buildings, 26 route nodes, 50 directed edges, 25 exact
reverse pairs, 50 valid endpoint-continuous geometries, 664 VR scenes, and
1,372 hotspots. The shared active Guided VR catalog has 25 active Guided VR
destinations, 472 configured steps, and 99 unique scene keys; the expanded
freeze covers those keys plus two CAS interior scenes. Every configured
building/node identity is unique and reachable from main-gate in both route
backends. Backend-specific selected-VR fingerprints are
371321de2af6be1ac87fb2f0d7c30a946c5538409022fd2968e21894b97caca2
for MySQL and
1ec674e497cbe8fd36234368f9c0a679c05bd68c8002c3f9724e7b3f0de0810c
for Supabase; the shared Guided catalog fingerprint is
ed02ec95d5c642cd082f48c0b3c5b98d0707ffd5866f8f90b196793ecfe963d6.
Migrations remain exactly 0001-0019; no 0020 exists.

The current natural-key runtime and focused catalog probes are green:
pure resolution, topology, stored/API geometry, public rendering, map-to-VR,
catalog-wide Guided VR, Free Roam, building baseline/integration/editor, and
BE.6. All 25 Guided routes pass in MySQL, Supabase, and both supported mixed
route/VR source combinations. The refreshed BE.6 freeze remains exactly 46/46.

After the owner logged out the accessible administrator/student sessions, a
SELECT-only preflight found exactly one remaining MySQL administrator session,
one MySQL student session, and one Supabase administrator session. A first
bounded wrapper stopped before mutation on a role-label mismatch. The corrected
preflight then invoked `revokeUserSessions()` exactly once for each of those
three verified backend-local identities. It used no direct session-row delete,
no account/data change, and no broad cleanup. That pre-QA read-only
postcondition was green at `24/24 -> 18/18 -> 46/46`.

The read-only package-boundary probe is green at 72/72 and reports 158 files,
6,245,074 bytes, aggregate SHA-256
b3113c05daaa5d2e870f204083923434456580fa6499190421de062ce9cabbd4.
The registered in-suite package gate is green at 72/72.
scripts/quality-gates.js independently pins those candidate bytes. This
inventory is not deployment authorization. The failed `npm run qa` attempt
that stopped at 4,512 contract passes after a mixed-mode integration
`ECONNRESET` remains historical/rejected. Its incomplete student logout left
exactly one unexpired canonical Supabase student session and produced the
historical `17/18` residue reading. Under a separate bounded authorization, a
fail-closed preflight reverified exactly one intended-role student identity,
that one session, and zero sessions for the other three canonical Supabase
identities; `revokeUserSessions()` was then invoked exactly once for that
student. It used no direct SQL or direct session-row deletion, changed no
account/application data, and performed no broad cleanup. The ordered
precondition returned to `24/24 -> 18/18 -> 46/46`.

The independent read-only review of prior candidate manifest SHA-256
`b4c2c3c2a5766399b843c6e43f2f8cf347bcc04473e5ba6a0a808397c77a3d56`
returned commit-readiness NO-GO on four bounded findings: the legacy CAS sync
utility omitted the ordered scene-sequence hash, SEC-37 retained a contradictory
package claim, OFF.3 retained obsolete catalog scope, and the demo promoted the
pilot before the remaining review boundaries. The follow-up now pins the exact
CAS scene-array fingerprint before scope derivation, rejects replacement,
reorder, and hash-pin drift, validates SEC-37 against the independent package
pin, scopes OFF.3 to the selected supported backend and all 25 active Guided-VR
destinations, and restores review -> commit -> push -> R8 -> deployment -> pilot
ordering. The prior manifest and its NO-GO disposition are historical; at that
point the corrected bytes required a new independent read-only review and
claimed no GO.

A subsequent independent read-only review of exact 33-file manifest SHA-256
`2f78d9754094572ac2b6a2bec02786d66b35a651141cd8c0f5705ac85d1282a8`
returned commit-readiness NO-GO on two high findings and one low finding: the
exact package pin was documented but not enforced against the live manifest,
obsolete Guided-VR handoff sections were historical and not operative, but were
not marked away from current authority, and current dates were stale. This bounded correction
adds independent live package-pin enforcement and byte-drift fixtures, isolates
the obsolete handoff sections as explicit history, expands authority/date
fixtures, and synchronized the then-current dates. It changed no runtime or
data; at that historical point another independent read-only review was
required.

Under a separate bounded authorization, a fail-closed preflight reverified
exactly two unexpired sessions for the one intended-role canonical MySQL
student, zero for the canonical MySQL administrator and all four canonical
Supabase identities, and an explicitly selected MySQL session store.
`revokeUserSessions()` was invoked exactly once for that student and removed
both sessions. No direct session-row deletion, account/application-data change,
or broad cleanup occurred. The pre-QA ordered postcondition is green at
`24/24 -> 18/18 -> 46/46`.

The exact synchronized candidate passes a freshly counted `npm test` at
`4641/4641` with `QUALITY-GATES OK` and `npm run qa` at the same exact contract
total with all five stages green and all exact transcript markers present. Final ordered postconditions are
`24/24 -> 18/18 -> 46/46`. Historical/superseded: the preceding 4,637-check QA
command itself exited 0, but its enclosing scorer returned 97 because it
searched for nonexistent `SUPABASE-SMOKE OK` instead of the actual
`[supabase-smoke] PASS`; no application stage failed and no retry was caused. A
later freshly counted suite attempt timed out at its 20-minute wrapper bound
inside the catalog-wide Guided-VR probe; it produced no completion count, is
historical/rejected, and left no CampuSphere Node process or listener. Its one
orphaned canonical MySQL student session was exposed by the next bounded run,
which exited 1 at 4,628 PASS with nine current-authority wording failures and
the residue failure. A fail-closed preflight then proved exactly that one
session, zero for the canonical MySQL administrator and all four Supabase
identities, and the intended student role; `revokeUserSessions()` was invoked
exactly once for that student and restored the count from one to zero. No direct
session-row delete, account/application-data change, or broad cleanup occurred.
pre-remediation `4629/4629`, `4624/4624`, `4609/4609`, `4599/4599`, 615-pass,
`4608/4609`, `4623/4624`, and 4,512-pass executions remain historical,
superseded, or rejected. These results established candidate-review readiness;
the latest external review report controls every later disposition.

The independent read-only review of exact 34-file manifest SHA-256
`ebf1142c11e3c027c0b3339a6888bc19196936ae3323644d907c68def224c4b4`
returned commit-readiness NO-GO because the same rejected 4,628-PASS retry was
described once with the exact nine current-authority wording failures plus
residue and again with an incorrect lower failure count. This bounded correction
removes the stale duplicate account and adds one cross-document analyzer with accepting and
rejecting fixtures. It changes no runtime or data. The prior `4639/4639` matrix
and manifest are historical candidate evidence; the latest external review
report controls the corrected bytes' disposition, and this snapshot claims no GO.
The first verification execution of this correction is historical/rejected at
`4640/4641`: the new analyzer inspected only the evidence ledger's first 4,628
mention, so its one combined live assertion failed even though all runtime
probes and embedded residue were green. It now evaluates every bounded 4,628
scope and requires at least one exact transcript-faithful account; no session or
data correction was required.

The first execution of this authority follow-up is historical/rejected at
`4635/4641`: six static checks rejected the Git-tree long-hex label, the
canonical lifecycle fixture, the combined lifecycle/evidence check, both
reusable grounding prompts, and their combined accepting fixture. All
runtime, database, catalog, BE.6, and embedded session-residue probes were
green, including `18/18`. The labels, predicates, and prompt authority were
corrected before a fresh full rerun; no session or data correction was needed.

The first integrated read-only M12.P1-R8 review of clean commit 43627cf
reverified package inventory 158 files / 6,245,074 bytes / SHA-256
b3113c05daaa5d2e870f204083923434456580fa6499190421de062ce9cabbd4,
npm test 4641/4641 with QUALITY-GATES OK, five-stage QA at the same exact
contract total, and final 24/24 -> 18/18 -> 46/46. It returned R8 NO-GO solely
because operative authority falsely described the committed and pushed
candidate as dirty, uncommitted, and unpushed; it found no separate runtime,
security, database, or package blocker. This bounded follow-up corrects that
lifecycle authority, preserves the current 72/72 versus accepted historical
71/71 R7 classification, and adds accepting/rejecting fixtures. The follow-up's
commit, push, and R8 disposition are established only by live Git and the latest
external review report; this repository snapshot deliberately makes no
self-referential claim about those later events. The required lifecycle is
independent commit-readiness review -> local commit -> separately authorized
push -> clean-commit R8 re-review.

The first verification of this state-neutral lifecycle correction is
historical/rejected at `4639/4641`: one combined lifecycle/history assertion
still detected self-expiring review claims outside the primary current blocks,
and one evidence-row classifier required the obsolete word `candidate`.
Runtime, database, Guided-VR, BE.6, and embedded `18/18` residue checks were
green. Those static contracts were corrected; the definitive rerun passed
`4641/4641` with `QUALITY-GATES OK`, the five-stage QA rerun was green at the
same total, and final postconditions were `24/24 -> 18/18 -> 46/46`. No session
or data correction was required.

The independent read-only review of exact 11-file manifest SHA-256
`4d37507071089be4f6ce92404465a28334f9a03dbad82d02dfde2b013c3183ad`
returned R8 NO-GO solely because the current reusable Claude prompt retained
self-expiring review claims and the Git-lifecycle analyzer did not cover their
original open-before-review word order. This bounded correction makes both current copy-paste
prompts state-neutral and extends the existing reusable-prompt assertion with
accepting/rejecting lifecycle fixtures. It changes no runtime, database, session,
or package bytes; live Git and the latest external review report control its
disposition.

The first verification execution of that prompt-lifecycle correction is
historical/rejected at `4640/4641`: the new negative-fixture group exposed that
the lifecycle analyzer rejected qualified review phrases but not the generic
`independent review` equivalent. All application, backend, Guided-VR, BE.6,
and final embedded residue checks were green. The matcher now rejects qualified
and generic forms; no runtime, database, session, or package correction was
required.

The first verification of the exact original-phrase coverage is
historical/rejected at `4639/4641`: the reverse-order matcher was initially too
broad and treated clearly historical `pending`/`required` review prose as
operative. Every executed runtime/backend probe and the final embedded `18/18`
residue gate were green. The matcher is now confined to the original
`open independent ... review` word order plus the already covered forward
forms; no runtime, database, session, or package correction was required.

The subsequent independent read-only review of exact 11-file manifest SHA-256
`c4a4c2b5bd592c00126f06736e8f8587d0de3dde189b506177bd764fddf3a192`
returned R8 NO-GO solely because the guard did not yet reject that exact
open-before-review phrase; it found no other security, runtime, database,
package-boundary, or evidence blocker. The bounded correction added the exact
rejecting fixture and corrected the synchronized root-cause wording. Its first
over-broad execution is the historical `4639/4641` run above. The narrowed
definitive bytes passed `npm test` at exactly `4641/4641` with
`QUALITY-GATES OK`, full five-stage `npm run qa` with all five exact markers,
and final ordered postconditions `24/24 -> 18/18 -> 46/46`. That verified
pre-handoff manifest was
`bd9a68ea8b7d2094d9fad54b561ed773852e30686646fcb446e9a3febfba2499`.
It is predecessor evidence for this continuity synchronization, not a pin for
the later edited bytes. Live Git and a freshly computed manifest control the
new candidate; the latest external review report alone controls R8 disposition.

The first full verification of the fresh-session handoff synchronization is
historical/rejected at `4638/4641`: three static documentation checks failed
because the new manifest values were not all presented with the analyzer's
explicit `SHA-256` label and both reusable prompts omitted the literal
deployment-authorization denial required by the current prompt contract. All
executed runtime/backend probes and the final embedded `18/18` residue gate
were green. The labels and prompt denials are corrected; no runtime, database,
session, package, or vendor correction was required.

A subsequent full-suite attempt is historical/rejected because the temporary
server for `publicRoadRouteRendering-probe.js` did not become ready on its
dedicated port. All earlier checks in that run and the final embedded `18/18`
residue gate were green; no listener or CampuSphere Node process remained.
The focused probe then passed immediately in both runtime modes. No repository,
database, session, package, or vendor correction was required for that transient
harness-start failure.

The owner attests that a human pilot occurred on 2026-08-05 and accepts it with
zero reported findings. Participant/Form evidence remains external and no
participant PII is recorded in Git. The tested build's full source-commit
identity was not independently verified, so this is owner-attested pilot
acceptance rather than independent current-build verification. Pilot review is
complete for sequencing purposes. The accepted OFF.2-OFF.5 implementation is
committed locally as `cdbc863b779e5319c14dee21a31a5e78951e233c`; accepted D6
is committed locally as `691f0bef40e06b6ea9485e713d2fe3000a03bd83`.
OFF.2-OFF.6 and D6 are Codex GO. Neither local commit may be pushed, promoted,
or deployed before the presentation and a later explicit owner decision.

The first full verification of this offline candidate is historical/rejected at
`4635/4641`: `npm test` exited 1 after 4,635 PASS lines and emitted no
`QUALITY-GATES OK` because exactly six static documentation/authority assertions
failed. Every executed runtime, database, catalog, BE.6, and final embedded
`18/18` residue check was green. Fail-closed sequencing stopped before
`npm run qa` and before the standalone `24/24 -> 18/18 -> 46/46`
postconditions. At that historical point the bounded correction had focused
evidence only and claimed no Codex GO. It was superseded by the later
independent reviews and definitive verification: D6 passed `npm test` at
`4998/4998` with `QUALITY-GATES OK`, five-stage `npm run qa` at the same exact
contract total, and ordered postconditions `24/24 -> 18/18 -> 46/46`; OFF.6 browser acceptance passed
in MySQL and Supabase, and the unchanged 40-file candidate then passed
replacement `npm test` at `4998/4998` with `QUALITY-GATES OK`, D6 `266/266`,
BE.6 `46/46`, and embedded residue `18/18`. No session correction was required.
The first OFF.6 run at `4995/4998` is historical/rejected: it exposed Supabase
route-edge 198/199 geometry drift, which one separately authorized supported
atomic pair write restored before the green replacement run.

Fresh-session boundary: the current Codex and Claude Code prompts authorize
grounding only and then wait for the owner. Neither prompt authorizes further
implementation, Git mutation, a new deployment or promotion, another pilot, or
Milestone 12 GO.

At this 2026-08-21 correction boundary, the implementation is committed and
pushed as `d786bdcb83a196c7263dceae668417d3ced3e95a`. Its exact committed
implementation manifest SHA-256 `92c689b884f52021f5545f331e8768ffc4768914cf9320c2d4b8fedee7020642`
covers 19 files and 2,072,400 bytes. Replacement full verification passed at
`4998/4998` with `QUALITY-GATES OK`, five-stage QA at the same exact contract
total, bounded Chrome acceptance in both supported backends, and ordered
postconditions `24/24 -> 18/18 -> 46/46`. The package pin is 168 files,
7,073,128 bytes, aggregate SHA-256
`1d6cc68b7ef350b6a61eb8d84ea4fb7dd6862bd8548beb7595d3f2e6f4b10d6a`. The
clean-commit independent R8 review returned NO-GO solely for stale operative
lifecycle authority; no separate runtime, security, database, or package
blocker was found. The later documentation/static-assertion correction has its
own bytes; live Git and the latest independent external review report control
its disposition. No promotion or deployment is authorized by this
synchronization.
<!-- M12.P1 CURRENT STATUS END -->
<!-- M12.P1 HISTORICAL 2026-07-30 STATUS START -->
**HISTORICAL/SUPERSEDED (2026-07-30 continuity snapshot; retained for incident
traceability and never current authority).**

Accepted history is unchanged: Milestones 8-11, RF.1-RF.6, BE.1-BE.6, and
OFF.1 are Codex GO. M12.P1 R1-R7, D1-D5, and expanded D7 are complete and
Codex GO. OFF.2 through OFF.6 remain deferred until the limited-pilot review,
are not cancelled, and remain required before final Milestone 12 GO.

The dependency-security remediation is complete and Codex GO. A subsequent
2026-07-26 advisory drift was remediated: production pins `ejs@6.0.1`, the
`jake/filelist/minimatch/brace-expansion` chain is absent, and
`npm audit --omit=dev` reports zero vulnerabilities. `M12.P1-R7` is complete
and Codex GO. Accepted R7 evidence remains focused `71/71`, in-suite
`vercel-package-boundary` `70/70`, full suite `3495/3495` with
`QUALITY-GATES OK`, and `npm audit --omit=dev` at zero vulnerabilities; the
`3492/3492` and `3494/3494` candidates are historical/superseded. Expanded
D7 is complete and Codex GO. Accepted D7 evidence remains the fresh-context
role-isolation run with separate browser contexts, full suite `3511/3511`
with `QUALITY-GATES OK`, audit zero, and postconditions
`24/24 -> 18/18 -> 46/46` with the frozen aggregate fingerprint unchanged.

Historical/superseded: before the `0627bf7` deployment, production used runtime
baseline `d422b54393f659125912ec5c84ae7927c2533288`. The read-only SEC-51
production smoke for that exact baseline is independently Codex-accepted.
Repository HEAD is the later documentation-only commit
`db034e5581e6f409083a43dcb80fb82b473e0127`; it is not the deployed runtime.
The opening worktree intentionally contained only uncommitted changes in
`docs/security-checklist.md`, `docs/test-evidence.md`, and
`scripts/quality-gates.js`. The current local correction also adds the bounded
`services/auditService.js` schedule-action allowlist repair and synchronized
authority-document changes. These bytes remain uncommitted and unaccepted.

The latest independently verified database truth is GREEN: credential/session
safety is `24/24`, canonical session residue is `18/18`, and BE.6 is `46/46`.
The exact leaked Supabase hotspot and sibling schedule are absent; all four
canonical Supabase identities have zero unexpired sessions, and MySQL is clean.
Both backends and the frozen baseline have 51 selected-source hotspots, all 26
selected scenes match, and the selected-VR fingerprint is
`ec66f04bf827bc9c8494a9007ff2e89d7990dd77cc7c5a9d629977ec583f6c6b`.
Before the separately owner-authorized 2026-07-30 restoration, the historical
state was `22/24 -> 16/18 -> 41/46`: one canonical administrator session, one
canonical student session, the exact CCS hotspot on
`scene-general-road-38-5`, and its `2099-04-10` `M11_DOOR_PROBE_%` sibling
schedule remained in Supabase. That former state is superseded incident
evidence, not current database truth.

The frozen aggregate fingerprint remains
`a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d`.
The current local-candidate package boundary is 158 files, 6,201,747 bytes,
aggregate SHA-256
`acfb1696de0c8855e02aa82e243fec959aefec637f29bdf033bc34ffda42e8b1`.
Before the schedule-audit runtime repair, the prior local candidate was 158
files, 6,201,603 bytes with aggregate SHA-256
`28403afaca31b90849d8cc76c1ec0501f29444d138e865053337617b664d3636`.
Supabase migrations remain exactly `0001` through `0019`; no `0020` exists.
The owner-created Google Form is READY external evidence, but its responder URL
must remain outside Git and must not be copied into authority documents.

The `3752/3752`, `3755/3755`, `3760/3760`, and `3763/3763` suite candidates are
historical/superseded or rejected and are not current R8 acceptance evidence.
The first authority/audit/total-consistency execution remains rejected: it
finished with 3,742 passes and 30 static-contract failures out of 3,772 checks,
without `QUALITY-GATES OK`. The later 3,774/3,777 frozen-candidate execution
also remains rejected after three `docs-current` failures, exit 1, and no
`QUALITY-GATES OK`; its `75/75` logout result and clean embedded checks do not
promote that red run. An earlier frozen 12-file matrix was recorded as green
`3777/3777`; that record is superseded and rejected. A fresh execution against
those exact frozen bytes exited 1 at `3776/3777` with one static failure,
`cloudinary-docs :: docs contain no JWT/PEM/AWS/long-hex secret values`, raised
by an unlabeled 40-hex Repository HEAD value in `docs/deployment.md`.

A bounded documentation-only correction labelled that value as `Repository HEAD`
and preserved the truthful claim that
`db034e5581e6f409083a43dcb80fb82b473e0127` is a documentation-only commit and
gate-work candidate, not a runtime deployment. `scripts/quality-gates.js` was
not changed by that docs-secret-label correction, and the exact frozen 12-file
manifest is pinned in `docs/test-evidence.md`. A byte-consistent matrix was then
executed once against the corrected manifest: preflight and postflight matched
12/12 hashes with Git, migration, and process state unchanged; both
`node --check` runs and `git diff --check` exited 0 with only LF/CRLF
advisories; the logout probe passed `75/75` at exit 0 with zero FAIL/ERROR/SKIP
and zero escaped or literal logout-error lines; `npm test` exited 0 at
`3777/3777` with `QUALITY-GATES OK` present and `QUALITY-GATES FAILED` absent;
`npm run qa` exited 0 with exactly 3,777 contract PASS lines before
`QUALITY-GATES OK` and all five green markers exactly once; and final ordered
postconditions were `24/24 -> 18/18 -> 46/46` at exit 0 each.

The `3777` total is a transcript-wide PASS-line reconciliation across parent
quality-gate output plus inherited spawned-probe stdout. It is not an in-process
`makeRecorder` counter, and no new counter is claimed or introduced.
Wrapper-only interruptions were disclosed for both matrices and changed no
application result and caused no retry: on the earlier run the enclosing runner
incorrectly required numeric logout wording and a whole-line
`QUALITY-GATES OK`; on the byte-consistent run the detached wrapper reported the
status of its own trailing command, so every stage was scored on the exit code
captured inside each transcript.

This is unaccepted candidate verification evidence pending independent
read-only review; the rejected and fail-open histories remain rejected.

Historical restoration disclosure is corrected: at execution time the schedule
delete audit request was refused because `admin.schedule.delete` was absent from
the allowlist, and `POST /logout` emitted no audit-service event. The allowlist
repair creates no retroactive audit row and adds no logout-audit contract. The
restoration executor also exceeded its stated one-run evidence boundary through
extra read-only probe executions and a persistent Claude-memory write outside
the repository; those deviations did not alter the restored repository or data
postconditions and are retained rather than erased.

The separately authorized restoration and bounded candidate verification are
complete. `M12.P1-R8` is the next potential section. R8 is read-only and is not
authorized by this synchronization; it requires a separate independent review
of the exact final file set. Never run
`syncSelectedCasVrSupabaseToMysql.js --apply` for this incident, never use
direct SQL or direct session-row deletion, and never create migration `0020`.

`M12.P1` remains NO-GO for deployment and pilot readiness. Deployment is not
authorized and requires a separate owner decision after R8. Milestone 12
remains NO-GO. No staging, commit, push, Vercel action, or pilot activity is
authorized by this continuity snapshot.
<!-- M12.P1 HISTORICAL 2026-07-30 STATUS END -->
<!-- M12.P1 PRIOR STATUS START -->
The owner-authorized `M12.P1` deployment-readiness and exposure audit is
complete with Codex NO-GO after one critical and six high blockers. R1-R7,
D1-D5, and expanded D7 are complete and Codex GO, including all R3 follow-ups,
the R4 follow-up, both R5 follow-ups, dependency-security remediation, both R7
source-auditability corrections, and the expanded D7 cross-role
admin-to-participant regression gate. `M12.P1-R7` is complete and Codex GO.
Accepted R7 closeout evidence is focused `71/71`, in-suite
`vercel-package-boundary` `70/70`, full suite `3495/3495` with
`QUALITY-GATES OK`, and `npm audit --omit=dev` at zero vulnerabilities. The
`3492/3492` initial R7 candidate and `3494/3494` literal-NUL remediation
candidate are historical/superseded. Following the accepted 2026-07-22
dependency closeout, a subsequent 2026-07-26 npm advisory drift is remediated:
production pins `ejs@6.0.1`, the
`jake/filelist/minimatch/brace-expansion` chain is absent, and
`npm audit --omit=dev` reports zero vulnerabilities. `M12.P1-D7` is complete
and Codex GO. Accepted D7 evidence is the fresh-context role-isolation rerun:
separate Playwright `BrowserContext` objects with no storage carryover, both
MySQL and Supabase legs completed and cleaned up through supported application
interfaces, `npm test` `3511/3511` with `QUALITY-GATES OK`, `npm audit
--omit=dev` zero vulnerabilities, and postconditions `24/24 -> 18/18 -> 46/46`
with fingerprint
`a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d`
unchanged. The post-D7 logout-output hygiene remediation is independently
Codex-accepted as additive evidence: `3529/3529` with `QUALITY-GATES OK`, zero
escaped logout-error lines, `npm audit --omit=dev` zero vulnerabilities, and
postconditions `24/24 -> 18/18 -> 46/46`; it does not supersede D7. A first
independent read-only R8 review of the clean-snapshot candidate returned
CANDIDATE NO-GO on pilot-readiness grounds, and a separately owner-authorized
pilot-readiness correction was then applied in one follow-up commit: anonymous
`GET /privacy`, pilot indexing protection, zero dead footer placeholders, the
corrected neutral package-inventory label, the owner-approved
facilitator-mediated pilot model, `MANUSCRIPT_TEAMDUTCHESS.pdf` untracked, and a
new fail-closed `pilot-readiness` gate. Those corrections await another
independent read-only R8 review, and no R8 GO, Codex GO, deployment GO, or pilot
GO is claimed by that work. A separately owner-authorized bounded evidence
re-execution has since been completed as candidate evidence: the local
authenticated exposure matrix was re-run clean at MySQL `34/34` plus a `14/14`
supplement and Supabase `64/64` plus a `14/14` supplement, `126/126` with zero
failures, using a separate fresh browser context per role with zero
carried-over cookies and web storage before authentication, every authenticated
session registered immediately with `scripts/probeSessionLifecycle.js` and
terminated exactly once through `terminateAll()` and the real CSRF-protected
`POST /logout`, no `429`, no retried logout, no import or call of
`services/sessionRevocation.js`, no direct session-row deletion or database
cleanup, and final ordered postconditions `24/24 -> 18/18 -> 46/46`; `SEC-05`
was executed externally and passed with a sanitized
`/auth?error=unauthorized_domain` refusal, Supabase `users` at six rows before
and after, zero unsupported-domain rows, no user or role-profile row, and no
persisted pending OAuth registration; and the pilot feedback form is READY as
external owner evidence with its URL kept outside Git. The first execution of
that exposure matrix is historical/superseded and explicitly NOT accepted:
rate-limit `429`s disturbed it, and an orphaned session was cleared by a direct
`revokeUserSessions` call rather than through the supported logout interface.
The follow-up documentation commit recording that evidence awaits an
independent read-only R8 review; no R8 GO, Codex GO, deployment GO, pilot GO, or
Milestone 12 GO is claimed. Historical/superseded: before `0627bf7`, the
`SEC-51` production smoke ran against deployed baseline
`d422b54393f659125912ec5c84ae7927c2533288` on
`https://campusphere-cspc.vercel.app` is independently Codex-accepted,
OFF.2-OFF.6 remain deferred until
pilot
review and are not cancelled, and accepted `R1`-`R7` and `D1`-`D7` history is
unchanged.

The three pilot-surface corrections are DEPLOYED on that baseline: truthful
landing role-mapping copy matching `getRoleFromEmail()`, a shared accessible
anonymous navbar owned by `public/js/public-nav.js`, and an auth-scoped in-card
theme control. Each contract is pinned in the `pilot-readiness` gate with
mutated-source rejecting fixtures, and the read-only production smoke found
production `public/js/public-nav.js` and `public/css/styles.css` byte-identical
to that baseline. That smoke performed no authenticated production login, so the
accepted `R2` and `R3` session-store and bootstrap evidence stands unchanged.

Historical/superseded: before the current deployment, the earlier accepted
production baseline was `78d9053c8ce5c2cc7a9ede80326950cfd29a3a53`, and
`SEC-51` was originally deferred.

The subsequent `SEC-51` evidence and quality-gate synchronization at
`db034e5581e6f409083a43dcb80fb82b473e0127` is documentation-and-gate work only;
it is not a runtime deployment, does not change production, and remains
unaccepted pending independent read-only review. It is LATER than the deployed
runtime baseline, not earlier. The present local candidate additionally repairs
the schedule-audit allowlist and is likewise unaccepted.

`M12.P1-R8`
is the next potential section. R8 is read-only and is
not authorized by this synchronization; even R8 GO authorizes only a separate
owner deployment decision. `M12.P1` remains NO-GO for deployment and pilot
readiness; deployment is not authorized.
<!-- M12.P1 PRIOR STATUS END -->

Superseded, historical: the earlier post-synchronization full-suite candidate
was RED after Supabase logout/session-destroy failures left unexpired canonical
administrator and student sessions; the distinct post-run safety check was
`22/24`, the embedded residue check was red, and the embedded BE.6 check did not
establish its frozen postcondition. That blocker is closed. A separately
owner-authorized supported cleanup/restoration was performed and independently
reproduced, and the R6 session re-verified safety `24/24`, residue `18/18`, and
BE.6 `46/46` before editing and again after its full-suite run.

The owner attests that the human pilot occurred on 2026-08-05 and accepts it
with zero reported findings. Participant/Form evidence remains external, no
participant PII is recorded in Git, and the tested build's full source-commit
identity was not independently verified. Pilot review is complete for
sequencing purposes. No CampuSphere feedback table, API mutation, or migration
is added. OFF.2-OFF.6 and D6 are complete and Codex GO on the two clean local
commits. Final Milestone 12 disposition awaits the independent read-only
closeout review.

### Completed Offline Campus Navigation Package

OFF.2 through OFF.6 are complete and Codex GO. The accepted implementation and
verification evidence remain local; these bytes must not be pushed, promoted,
or deployed before the presentation and a later explicit owner decision.

**OFF.2 — Installability, Offline Shell, and Update Lifecycle**

- Complete and Codex GO: manifest/installability behavior and the session-neutral shell.
- Add visible online/offline and update-available states, safe activation,
  version cleanup, interrupted-install recovery, and reconnect handling.
- Keep authenticated HTML and sensitive routes network-only.

**OFF.3 — Privacy-Safe 2D Guide Data and Explicit Download**

- Complete and Codex GO: package the current active building/route backends,
  precomputed Main Gate route data/geometries, safe building details, and exact
  content-addressed basemap identity in one bounded, versioned, read-only
  IndexedDB record after explicit user download. The 13-building roster remains
  only the reproducible seed baseline, not the complete campus.
- Exclude sessions, CSRF, credentials, profiles, admin/private responses,
  mutations, raw errors, personalized HTML, backend identities, schedules,
  Cloudinary URLs, building photos, 360 media, Guided VR, and Free Roam.

**OFF.4 — Offline Map and Destination Routing**

- Complete and Codex GO: render the downloaded current-backend destinations,
  Main Gate route lines, steps, and unavailable states without network access.
- Use the bounded local PMTiles campus extract as the normal background; never
  mirror OpenStreetMap. If the renderer is unavailable, preserve the list,
  route directions, and a keyboard-operable simplified campus map.

**OFF.5 — Offline Building Details, Integrity, and Recovery**

- Complete and Codex GO: a node/list click opens current text details for the
  building (category, description, walk time, offices/services, floors/rooms,
  entrances, and landmarks) with a local generic placeholder, keyboard/Escape
  support, and focus restoration.
- Reverify guide and map hashes on every load; atomically retain the previous
  valid record on an interrupted update; delete only the exact guide database
  on explicit logout.

**OFF.6 — Offline Feature, Privacy, and Final GO/NO-GO**

- Completed clean-install and warmed-cache desktop/mobile matrices for restart,
  network loss, every current building and available Main Gate route, details
  windows, normal/fallback maps, unroutable nodes, interrupted/corrupt updates,
  storage errors, upgrades, reconnect, logout, and shared-device privacy.
- Require explicit proof that no 360/Guided-VR/Free-Roam, schedule, building
  photo, or Cloudinary payload enters the offline record or Cache Storage.
- Require zero private cache data, zero server mutations, green online
  regressions, and complete fixture/service-worker/listener cleanup.
- OFF.6 is Codex GO; final Milestone 12 disposition remains a separate review.

### Milestone 12: Vercel Demo Deployment

Priority: P1

Goal: support Vercel as a demo/UAT target, not as the full production deployment path.

#### M12.P1 — Limited Routing-Focused Pilot

Status: technical Production baseline
`fea3b2e11c6331eddc1ee091b165427d8e0218d7` is accepted. Its authorized push
automatically triggered Production, bounded anonymous read-only GET-only
post-deployment verification passed, and future `main` deployments require
manual promotion. The owner accepts the 2026-08-05 human pilot with zero
reported findings; its external evidence remains outside Git and its full
source-commit identity was not independently verified. Pilot review is complete.
Final M12 acceptance remains open.

- The completed audit covered the entire exposed authenticated surface, Vercel
  configuration, Supabase-only data operation, Supabase sessions, OAuth
  redirects, cookies, CSRF/CSP/rate limits, logs/errors, secrets, Cloudinary
  delivery, service-worker behavior, rollback, and tester accounts.
- R1-R7, D1-D5, expanded D7, and the final R8 lifecycle are complete. R3 (awaited Vercel runtime and
  session bootstrap), together with all session-hygiene/ownership/import-
  detector follow-ups, is complete and Codex GO. R4 (shared Upstash rate
  limiting) and the dependency-security remediation are complete and Codex GO.
  `M12.P1-R5` (bounded anonymous access-denial auditing), its authoritative
  global-total follow-up, and its documentation-gate final correction are
  complete and Codex GO. `M12.P1-R6` (self-hosted browser dependencies) is
  complete and Codex GO. `M12.P1-R7` (Vercel package and static-CDN boundary)
  and both source-auditability corrections are complete and Codex GO. The
  accepted technical Production baseline is not human-pilot evidence or final
  Milestone 12 GO.
- R7 adds an allowlist `.vercelignore` (`/*` first, then only `server.js`, the
  two package manifests, `vercel.json`, and the ten runtime directories, with
  `public/img/sample 360/**` denied after the `public` re-inclusion), a minimal
  `vercel.json` carrying exactly `$schema` and seven narrow static/PWA header
  rules with one fixed static-only CSP confined to `/offline.html`, a standalone
  read-only package-boundary probe, and an in-suite fail-closed gate. Express's
  per-response nonce CSP is untouched and remains the sole CSP authority for
  dynamic responses.
- R6 serves Leaflet `1.9.4`, MapLibre GL JS `4.7.1`, Pannellum `2.5.6`, Iconify
  Icon `1.0.7`, and Lucide `1.25.0` from `public/vendor` with a provenance
  manifest recording registry integrity, license, and SHA-256 per shipped file,
  and removes `unpkg.com`, `cdn.jsdelivr.net`, and `code.iconify.design` from
  every CSP directive. Google Fonts, OSM tiles, the Iconify data API, and
  Cloudinary media delivery remain the only approved external origins, none of
  them executable. Provenance is additionally pinned INDEPENDENTLY of the
  manifest in `EXPECTED_VENDOR_INVENTORY` (probe code), verified against official
  `npm view`/`npm pack`; the analyzer and gate fail closed on any divergence and
  re-verify disk/HTTP bytes against the pinned hashes. Accepted R6 Codex GO
  evidence: focused `230/230`, full suite `3415/3415` with `QUALITY-GATES OK`
  (pre-remediation `3375/3375`), and the complete independent desktop/mobile
  affected-page and missing-library browser matrix green.
- R5 stops routine anonymous protected-route denials from writing `system_logs`
  rows while preserving the exact `302 /auth`, fixed `401` JSON, and `403`
  HTML/JSON contracts. The one retained authorization-denial write is the
  authenticated wrong-role case, guarded by an authenticated-only helper that
  requires a positive integer actor id and a non-blank role. Real
  authentication failures remain audited. No anonymous-denial table, raw IP,
  Redis denial record, timer, aggregation job, dependency, or migration was
  added. The R5 follow-up strengthens the focused probe to prove the
  authoritative unfiltered `system_logs` total (`summary.total`) is unchanged
  across the twenty anonymous requests — not merely the filtered
  authorization/denied count — and makes both reusable session-grounding
  prompts in `docs/new-session-grounding-prompts.md` carry current authority
  under a dedicated documentation gate.
- R4 keeps every existing limiter scope, configurable limit, fixed `429` body,
  and `Retry-After` contract while moving Vercel counters to a shared
  `@upstash/redis@1.38.0` store incremented by one atomic server-side Lua
  `EVAL`. It requires server-only `UPSTASH_REDIS_REST_URL`,
  `UPSTASH_REDIS_REST_TOKEN`, and a `RATE_LIMIT_KEY_SECRET` of at least 32
  characters, persists only HMAC-SHA-256 bucket digests, keeps the in-memory
  adapter off Vercel, and fails closed with a fixed sanitized `503` rather than
  falling back to a process-local Map.
- R3 must use one shared single-flight session-readiness promise, make local
  startup await it, prevent the exported/Vercel app from reaching session
  middleware or routes before readiness, return a fixed sanitized `503` on
  initialization failure, and avoid duplicate stores, timers, listeners, logs,
  or initialization attempts.
- Expanded D7 is complete and Codex GO. It exercised a temporary building with
  structured details, linked node, forward/reverse geometry edge pair, and
  public schedule through supported interfaces in both MySQL and Supabase;
  verified student, guest, and instructor propagation, authorization, and
  all-reachable-page behavior with separate fresh browser/storage contexts; then
  cleaned up in reverse dependency order and restored BE.6 plus
  credential/session safety. Accepted evidence is `npm test` `3511/3511` with
  `QUALITY-GATES OK`, `npm audit --omit=dev` zero vulnerabilities, and
  postconditions `24/24 -> 18/18 -> 46/46` with the frozen fingerprint
  unchanged. The later logout-output hygiene remediation is accepted only as
  additive evidence at `3529/3529`; it does not replace the D7 closeout.
- The final R8 lifecycle completed. Vercel `Auto-assign Custom Production
  Domains` is disabled; a future `main` deployment cannot replace the live alias
  without explicit manual promotion and a separate owner decision.
- The owner-attested human pilot occurred on 2026-08-05 and is accepted with
  zero reported findings. Participant/Form evidence remains external and no
  participant PII is recorded in Git. Its tested build identity was not
  independently verified, so this is not independent current-build evidence.
- Pilot review is complete for sequencing purposes. The owner-authorized local
  OFF.2-OFF.6 and D6 are complete and Codex GO; no feedback table, API mutation,
  migration, or anonymous browsing was added.
- Final Milestone 12 disposition awaits the independent read-only closeout
  review. Push, staged verification, and manual Production promotion remain
  separately owner-authorized actions after the presentation.

#### M12.P2 — Final Demo/UAT Closeout

Status: pilot review, OFF.2-OFF.6, and D6 complete; ready for the independent
read-only Milestone 12 closeout review.

Concrete tasks:

- Add Vercel demo deployment docs/config after Supabase sessions are working.
- Document required environment variables, including Supabase data switches, `SESSION_STORE=supabase`, OAuth redirect URI, and Cloudinary media settings.
- Verify the demo URL supports student, instructor, and guest UAT flows.
- Document limitations of Vercel demo hosting versus Docker full deployment.
- Re-run final deployment, security, online/offline, and regression checks
  after OFF.6 GO.

Acceptance criteria:

- Vercel demo deployment can run without local MySQL.
- Google OAuth redirect URI variants are documented for Vercel preview and production URLs.
- UAT testers can access the demo through authenticated student, instructor, and guest flows.
- Pilot findings are resolved or formally accepted, and OFF.2–OFF.6 receive
  Codex GO before final Milestone 12 GO.

### Milestone 13: Docker Full Deployment Finalization

Priority: P1

Goal: keep Docker as the full deployment and institutional hosting path while updating it to the final Supabase-session architecture.

Concrete tasks:

- Update Docker deployment docs to default to Supabase data and Supabase sessions.
- Keep MySQL compose support only for fallback/local rehearsal.
- Verify the Docker image still excludes `.env`, database dumps, screenshots, secrets, `node_modules`, and local artifacts.
- Run the full QA gate against the final Docker deployment path.

Acceptance criteria:

- Docker deployment runs with Supabase app data, Supabase sessions, and Cloudinary media.
- MySQL is documented as local fallback only.
- Docker remains the recommended full deployment path after Vercel demo/UAT.

## Project Summary

CampuSphere is a role-based campus navigation and information portal for Camarines Sur Polytechnic Colleges. The manuscript defines the target as a Progressive Web Application with user roles, searchable campus map data, VR/360-degree guided navigation, announcements, real room/facility scheduling, admin content management, offline access, and black-box/usability/security testing before deployment. The revised team scope excludes simulated enrollment and fake classroom-schedule dashboard widgets, but keeps real admin-managed room/facility scheduling in the post-Milestone 8 roadmap.

The current repository already has a working Express/EJS/MySQL foundation with authentication, role dashboards, public map/building/event pages, VR route groundwork, and several admin CRUD screens. The largest remaining work is turning the prototype into the final manuscript-aligned capstone product: Supabase/PostGIS-backed campus data, MapLibre map rendering, Cloudinary-hosted media assets, VR route walkthroughs, PWA/offline support, complete admin tooling, security hardening, and test/demo evidence.

## Current Implementation Status

### Implemented

- Express 5 + EJS server-rendered MVC structure in `server.js`, `routes/`, `controllers/`, and `views/`.
- MySQL persistence through `config/db.js`, `database/schema.sql`, and `database/seed.js`.
- Local username/password authentication with bcrypt in `controllers/authController.js`.
- Google OAuth flow with domain-to-role mapping and complete-registration step in `controllers/authController.js`.
- Session-based role data exposed to EJS through `server.js`.
- Authenticated dashboard route in `routes/dashboard.js` and `controllers/dashboardController.js`.
- Admin route protection through `middleware/roleAuth.js` and `routes/admin.js`.
- Admin CRUD APIs for users, news/events, and buildings in `controllers/adminUsersController.js`, `controllers/adminContentController.js`, and `controllers/adminBuildingsController.js`.
- Database-backed building directory in `controllers/buildingsController.js` and `views/buildings.ejs`.
- Leaflet-based maps in `views/map.ejs`, `views/home.ejs`, and `views/dashboard.ejs`.
- Seeded default admin, sample student, buildings, news, events, team members, FAQs, and settings in `database/seed.js`.

### Partially Implemented

- Role dashboards exist in `views/dashboard.ejs`, but much of the role-specific data still comes from hardcoded browser-side data in `public/js/data.js`.
- Building details, floor layouts, route text, entrances, walk time, and landmarks exist as seeded JSON inside the `buildings.details` column, but they are not normalized or validated.
- Announcements/news can be managed by admins, but instructor-created announcements and role-targeted visibility are not implemented.
- Public `/map` uses static `public/js/data.js` building data, while `/buildings` uses MySQL. Admin building edits will not reliably appear on the main map.
- Admin FAQ, logs, and settings pages exist, but `views/admin/faqs.ejs`, `views/admin/logs.ejs`, and `views/admin/settings.ejs` are mostly static mockups without backing CRUD APIs.
- Route guidance exists as textual walking directions in `views/buildings.ejs`, but no graph/pathfinding or VR progression exists.

### Missing

- PWA manifest, service worker, offline cache strategy, IndexedDB/local cache, and installability.
- Final PWA implementation using Web App Manifest, custom Service Worker, and Cache Storage API.
- Final real VR panorama assets for the seeded scenes.
- Final Supabase/PostgreSQL/PostGIS migration for users, buildings, routes, announcements, and VR scene records.
- Final MapLibre GL JS map implementation to replace the current Leaflet/OpenStreetMap map views.
- Final Cloudinary integration for campus images and VR panorama delivery.
- Automated test framework. `package.json` has an `npm test` placeholder that exits with failure.
- Formal black-box test cases, SUS/usability survey materials, security test checklist evidence, and deployment checklist.
- Production session hardening, CSRF protection, strong input validation, audit logging, and authorization checks for every sensitive operation.
- Cleanup of dashboard mock data that no longer belongs in the revised scope, especially simulated enrollment information and fake instructor schedule/room widgets.

## Manuscript vs Existing App Gaps

| Manuscript requirement | Current implementation | Gap and impact |
| --- | --- | --- |
| Role-based PWA campus mapping portal with offline support | Express/EJS web app; no manifest or service worker in `public/` or `views/partials/head.ejs` | Not installable and not offline-capable, which is a core capstone claim. |
| VR/360-degree navigation using scenes and hotspots | No Pannellum, no VR routes, no panorama assets; only textual routes in `views/buildings.ejs` | The "VR-based campus mapping" requirement is not yet met. |
| Searchable building, office, and service directory | Building search exists in `views/map.ejs` and `views/buildings.ejs`; some office/service data is still stored inside building details JSON | Search should prioritize DB-backed buildings, offices, services, landmarks, and routes without depending on stale browser-side data. |
| Admin control over users, map data, announcements, VR scenes, and navigation routes | Admin can manage users, news/events, and buildings through `routes/admin.js` and admin controllers | Missing VR scene management, route management, FAQ CRUD, settings persistence, and logs. |
| Student and instructor dashboards with role-appropriate campus information | Dashboards exist, but some dashboard widgets still contain hardcoded academic/schedule-style mock data in `public/js/data.js` and `views/dashboard.ejs` | Remove simulated enrollment, fake assigned-room, fake teaching-schedule, and fake all-room dashboard sections; keep dashboards focused on navigation, announcements, events, profile, real room/facility schedule information where available, and quick actions. |
| Announcement dissemination | News/announcements table and admin CRUD exist | No role targeting, notification state, instructor posting, or dashboard-specific filtering. |
| MapLibre GL JS, Supabase/PostgreSQL/PostGIS, Cloudinary | Current stack is Leaflet/OpenStreetMap CDN, MySQL, local/static images | Final product decision now requires migration to the manuscript stack before defense. |
| Black-box, usability, security, and user satisfaction testing | No tests or testing artifacts in repo | Capstone validation evidence is missing. |
| Deployment within CSPC or cloud environment | `npm start` works by design, but no deployment config/checklist exists | Demo/deployment readiness is unproven. |

## Prioritized Milestones

### Milestone 1: Stabilize the Baseline and Single Source of Data

Priority: P0

Concrete tasks:

- Document the final technical narrative as a planned migration from the current MySQL/Leaflet prototype to Supabase/PostGIS, MapLibre GL JS, Cloudinary, Pannellum.js, and custom Service Worker PWA support.
- Make the database the single source for buildings used by `/buildings`, `/map`, dashboard map widgets, and admin map management.
- Add server JSON endpoints for public map/building data instead of relying on `public/js/data.js`.
- Keep `models/data.js` as seed-only data and remove runtime dependence where practical.
- Validate `buildings.details` JSON before saving through `adminBuildingsController`.
- Re-run `node database/seed.js` and verify default accounts still work.

Acceptance criteria:

- `/map`, `/buildings`, and admin campus map show the same building set after an admin creates, edits, or deletes a building.
- A clean database can be created and seeded with one command.
- No core screen depends on stale duplicate building data from `public/js/data.js`.
- The team can explain the final chosen stack consistently in defense.

### Milestones 2-5 Migration Rule

Milestones 2 through 5 are not a rewrite from scratch. They are the verified migration path from the already-built MySQL-era features to the final Supabase/PostgreSQL/PostGIS runtime. The old MySQL work remains the behavior baseline: every migrated feature must keep the same user-facing routes, EJS locals, API response shapes, role behavior, and demo flows unless a change is explicitly approved.

Do not jump to Milestone 6 PWA/offline work until these runtime slices are stable, because offline caching should target the final Supabase-backed APIs and assets, not a temporary MySQL/Leaflet state.

### Milestone 2: Migrate Authentication, Roles, and Profiles to Supabase Runtime

Priority: P0

Migration stance:

- Keep Express session authentication, local bcrypt passwords, and the existing Google OAuth domain-to-role flow.
- Do not move to Supabase Auth in this milestone.
- Use Supabase/PostgreSQL as the server-side data store through the repository boundary prepared in Milestone 1.
- Keep MySQL behavior available as the rollback/baseline until Supabase auth/profile flows pass verification.

Concrete tasks:

- Re-verify the current auth baseline before editing: local login, logout, Google OAuth missing-config behavior, role redirects, admin route protection, profile hydration, and profile update validation.
- Implement the Supabase-backed user/profile repository methods needed by `controllers/authController.js`, `controllers/profileController.js`, `controllers/dashboardController.js`, and admin user screens.
- Migrate local login, local registration, Google OAuth registration, complete-registration, profile hydration, and profile update paths from direct MySQL queries to the repository/Supabase path one group at a time.
- Preserve `req.session.user` shape and `res.locals.user` fields consumed by EJS, dashboard partials, `public/js/nav-role.js`, and controllers.
- Preserve admin creation as seed-only or admin-only; public registration must never create an admin.
- Preserve server-side authorization for `/admin` and `/admin/api/*`; client-side nav hiding is not security.
- Verify no Supabase service role key reaches EJS locals, public JavaScript, browser globals, logs, screenshots, or committed files.

Acceptance criteria:

- Students, instructors, admins, and guests can log in and land on the same role experience using Supabase-backed data.
- Non-admin users cannot access `/admin` pages or `/admin/api/*` endpoints by direct URL or crafted request.
- Public registration cannot create an admin.
- Profile changes persist in Supabase and reload correctly after logout/login.
- Google OAuth still maps domains to roles, stores `oauth_provider` / `oauth_subject`, and does not store Google passwords.
- API and EJS response shapes remain compatible with the current frontend.

### Milestone 3: Migrate Campus Map, Search, Routes, and Map Rendering to Supabase/PostGIS

Priority: P0

Migration stance:

- Keep the current MySQL/Leaflet map, building, search, route, and pathfinding behavior as the baseline until each route/API is migrated and verified.
- Move data access first, then map rendering. Do not replace the UI and the database source in one unchecked step.
- Use PostGIS where it helps final search/spatial work, but continue returning `lat` and `lng` in API responses while the frontend expects them.

Concrete tasks:

- Re-verify current `/buildings`, `/api/buildings`, `/map`, `/api/search`, `/api/routes`, `/api/routes/:id`, and `/api/pathfind` behavior before editing.
- Implement Supabase-backed `buildingRepository` and `routeRepository` read methods for buildings, search, campus routes, route steps, route nodes, and directed route edges.
- Migrate building directory, admin building reads, map markers, search, route summaries, and pathfinding reads from direct MySQL queries to repository/Supabase calls in small sections.
- Preserve the current Dijkstra directed-edge semantics in `utils/pathfinding.js`.
- Preserve existing JSON/API response shapes, especially building `details`, `vr_route_id`, route step lists, and pathfinding output.
- After Supabase-backed map/search/route APIs are stable, replace Leaflet map rendering with MapLibre GL JS while preserving the same user workflows.
- Keep mobile map behavior usable: search, filters, selected building details, route summary, and route path must not overlap or become unreachable.

Acceptance criteria:

- A user can search for a building, office/service, category, landmark, or route using Supabase-backed data and open the correct detail panel or route summary.
- A user can select a starting point and destination and receive a route/pathfinding result backed by Supabase route graph data.
- Admin building edits persist in Supabase and appear consistently on `/buildings`, `/map`, and related APIs after refresh.
- MapLibre renders the campus map without losing existing search, marker, route, and mobile behavior.
- At least the main gate to three important destinations are demo-ready.

### Milestone 4: Migrate Dashboards, Announcements, Events, and Role Content to Supabase Runtime

Priority: P1

Migration stance:

- Do not reintroduce removed fake academic dashboard scope. Student enrollment simulation, fake instructor assigned rooms, fake instructor schedules, and fake all-room widgets remain out of scope. Real room/facility scheduling belongs to the post-Milestone 8 scheduling milestone, not to dashboard filler.
- Preserve the cleaned dashboard behavior and move the remaining real content to Supabase-backed repositories.
- Keep role filtering server-side; do not rely on browser-only role checks for sensitive content.

Concrete tasks:

- Re-verify current student, instructor, admin, and guest dashboards before editing.
- Implement Supabase-backed `contentRepository` methods for news announcements, events, role-filtered dashboard reads, and admin content CRUD.
- Migrate `controllers/dashboardController.js` announcement/event reads to Supabase while preserving published-only and audience-filtered behavior.
- Migrate `controllers/adminContentController.js` news/events CRUD to Supabase with the same category and audience allowlists.
- Keep dashboard EJS locals and rendered sections stable unless the user approves a UI change.
- Confirm removed fake academic/schedule widgets do not return during migration.
- Decide separately whether instructor posting is in scope; do not add it just because announcements are being migrated.

Acceptance criteria:

- Student, instructor, admin, and guest dashboards load using Supabase-backed announcements/events where applicable.
- Announcements remain chronological, published-only for normal dashboards, and filtered by allowed role audience.
- Admin-created news/events appear on public/dashboard screens after refresh.
- Non-admin users cannot mutate content APIs.
- Dashboards remain demo-ready and do not rely on fake enrollment, fake schedule, or fake room data.

### Milestone 5: Migrate VR/360 Guided Navigation and Media References to Supabase Runtime

Priority: P1

Migration stance:

- Keep Pannellum.js and the existing VR route UX unless a later approved frontend change replaces it.
- Treat the current MySQL VR route flow as the behavior baseline.
- Move VR scenes, hotspots, and route graph reads to Supabase before Cloudinary media delivery is finalized.
- Missing real panorama assets must continue to fail gracefully.

Concrete tasks:

- Re-verify current `/vr`, `/vr/:sceneKey`, `/vr/routes/:routeId`, and `/api/vr/routes/:routeId` behavior before editing.
- Implement Supabase-backed `vrRepository` methods for `vr_scenes`, `vr_hotspots`, and route-scene lookups.
- Migrate VR scene browser, guided route viewer, hotspot loading, route-scene resolution, and API route reads to Supabase.
- Preserve current fallback UI for missing `/img/vr/*.jpg` or Cloudinary placeholders.
- Preserve current route progress, next/previous navigation, completion state, and Back to Map behavior.
- Wire Cloudinary-ready fields (`image_url`, `cloudinary_public_id`) without requiring final asset uploads before the flow can be tested.
- Verify desktop and mobile VR pages after migration, including dark/light theme readability if both themes are supported.

Acceptance criteria:

- A user can start a VR route from a building/map detail entry and load Supabase-backed scenes/hotspots.
- Each navigation hotspot moves to the expected scene without console errors.
- The user can reach a destination and see the route completion state.
- At least two campus destinations have complete demo route data.
- Missing or placeholder panorama assets show a useful fallback instead of a broken viewer.
- Cloudinary fields are ready for final media migration without blocking current demo fallback behavior.

### Milestone 6: Add PWA Installability and Offline Mode

Priority: P1

Concrete tasks:

- Add `manifest.webmanifest`, icons, theme colors, and app metadata.
- Add a custom Service Worker and register it in a shared partial such as `views/partials/head.ejs`.
- Cache the app shell, CSS, JS, logo, selected building data, and a small set of VR/demo route assets.
- Add an offline indicator and fallback page.
- Store last-loaded map/building/route data in IndexedDB or Cache Storage.
- Keep offline scope small: enough for the demo routes and essential map/building directory.

Acceptance criteria:

- Browser install prompt or "install app" behavior is available on supported devices.
- After one successful online load, the app shell and selected building/route data open while offline.
- Offline mode clearly tells the user what is cached and what still needs internet.
- Lighthouse PWA checks pass for manifest and service worker basics.

### Milestone 7: Complete Admin, Logs, Settings, and Content Management

Priority: P2

Concrete tasks:

- Back `views/admin/faqs.ejs` with the existing `faqs` table and CRUD API.
- Replace hardcoded logs in `views/admin/logs.ejs` with a `system_logs` table.
- Log important events: login success/failure, admin CRUD actions, profile updates, and authorization denials.
- Back `views/admin/settings.ejs` with `system_settings`.
- Remove misleading hardcoded values, especially the MongoDB URI shown on the settings page.
- Add required admin management for VR scenes and hotspots.
- Add required admin management for campus routes, ordered route steps, route nodes, and directed route edges.
- Keep all new admin writes behind the existing MySQL/Supabase runtime boundaries and record successful mutations in the audit log.

Acceptance criteria:

- FAQ, logs, and settings pages show database-backed data.
- Admin actions create audit log entries.
- Settings persist after refresh.
- Admins can create, update, and delete valid VR scenes/hotspots and route definitions in both MySQL and Supabase modes.
- VR and route mutations preserve referential integrity and do not break scene browsing, guided routes, or pathfinding.
- No admin page presents obviously fake operational data during the final demo.

### Milestone 8: Testing, Security Review, and Deployment Readiness

Priority: P0, started early and completed last

Concrete tasks:

- Create a manual black-box test checklist matching manuscript Table 9 functionality cases.
- Create a security checklist matching manuscript Table 11: RBAC bypass, domain bypass, guest boundary, injection payloads, unauthorized POST, expired/modified session.
- Add at least lightweight automated smoke tests if time allows, using Playwright or Node's built-in test runner.
- Prepare SUS and user satisfaction survey forms matching manuscript Tables 10 and 12.
- Prepare a demo script using default accounts from `database/seed.js`.
- Document environment setup, Supabase SQL apply order, MySQL fallback seed steps, OAuth limitations, and fallback local-login demo path.
- Add Docker packaging for the Express/EJS app: `Dockerfile`, `.dockerignore`, documented build/run commands, and a runtime-env-only secret model.
- Add an optional `docker-compose.yml` only if it helps local defense rehearsal, for example pairing the app with a MySQL fallback service. Supabase remains an external cloud service and should not be replaced by an in-container database.
- Verify the container can run the final Supabase mode with runtime environment variables: `AUTH_DATA_SOURCE=supabase`, `BUILDING_DATA_SOURCE=supabase`, `ROUTE_DATA_SOURCE=supabase`, `CONTENT_DATA_SOURCE=supabase`, later `VR_DATA_SOURCE=supabase`, and `MAP_RENDERER=maplibre`.
- If MySQL fallback is demonstrated through Docker, document that `DB_HOST` must point to the compose service name, not `localhost` inside the app container.
- Confirm `.env`, Supabase service-role keys, OAuth secrets, DB passwords, screenshots, local database dumps, and `node_modules` are not copied into the Docker image.
- Document OAuth redirect URI differences for local Node, Docker localhost, and any final hosted URL.
- Document the approved hosting split: Vercel for demo/UAT access and Docker for full deployment or institutional production-style hosting.

Acceptance criteria:

- Test checklist has pass/fail evidence for every core module.
- Demo can be reset from a clean database.
- App runs with `npm start` and all required `.env` values are documented.
- Docker image builds from a clean checkout and starts the app with runtime environment variables, without baking secrets into the image.
- Container smoke checks pass for the final Supabase-backed runtime. MySQL fallback is either verified through compose or clearly documented as a local/fallback path, not the manuscript-aligned production target after Supabase sessions are implemented.
- Deployment notes explain required ports, environment variables, OAuth redirect URLs, Supabase SQL prerequisites, and reset/demo steps.
- The team has screenshots or recordings for map search, admin CRUD, VR route, offline mode, and role-based access.

## Suggested Technical Improvements

- Treat the current Express/EJS/MySQL/Leaflet implementation as the prototype baseline, then migrate deliberately toward Supabase/PostGIS, MapLibre GL JS, and Cloudinary for the final defended system.
- Keep Express.js and EJS unless there is a separate approved reason to introduce a frontend build stack. Do not add Vite only to satisfy a package table.
- Use a custom Service Worker, Web App Manifest, and Cache Storage API for PWA/offline support. Do not add Workbox or `vite-plugin-pwa` unless the frontend architecture later justifies it.
- Add small, focused tables instead of overloading `buildings.details` where needed: `routes`, `route_steps`, `vr_scenes`, `vr_hotspots`, `announcement_targets`, `room_schedules`, `system_logs`, and Supabase-backed `app_sessions`.
- Use shared validation helpers for admin APIs, especially for JSON fields and numeric coordinates.
- Add CSRF protection for form/API mutations before deployment.
- Add input sanitization/output escaping review for admin-created content.
- Add `helmet` and production session cookie settings.
- Keep offline caching limited to demo-critical assets. Caching every map tile and panorama can exceed device storage quickly.
- Avoid building a complex pathfinding engine unless route data is stable. Predefined route chains are more realistic for a capstone timeline and match the manuscript limitation of preset paths.

## Testing and Demo-Readiness Checklist

- Environment: `.env` contains DB credentials, `SESSION_SECRET`, and OAuth values or a documented local-login fallback.
- Database: `node database/seed.js` completes successfully and creates default admin/student data.
- Auth: local login, logout, invalid password, Google OAuth missing-config behavior, and role dashboard redirects are verified.
- RBAC: student/instructor/guest direct access to `/admin` and `/admin/api/*` is denied.
- Admin users: create, edit, delete, duplicate email, invalid role, and self-delete protection are verified.
- Admin content: news/events CRUD appears on public/dashboard screens after refresh.
- Buildings: admin building edits appear on `/buildings` and `/map`.
- Search: building, office/service, landmark, route, and category searches produce correct results.
- Routes: at least three predefined routes from main gate are demo-ready.
- VR: at least two VR route walkthroughs load on desktop and mobile.
- PWA: manifest is valid, service worker registers, installability works, and offline fallback works.
- Mobile: map, dashboard, building details, route modal, and VR viewer are usable on a phone viewport.
- Security: SQL/XSS payloads do not bypass login/search/admin forms or render executable scripts.
- Performance: large images are compressed; initial page load is acceptable on mobile data.
- Defense artifacts: screenshots, test results, survey forms, and demo script are prepared.

## Risks, Blockers, and Assumptions

### Risks

- The current prototype stack and final manuscript stack do not yet fully match. This is a defense risk until Supabase sessions, Cloudinary media, Vercel demo docs, Docker full-deployment docs, real room scheduling, Supabase/PostGIS, MapLibre GL JS, and PWA support are actually implemented and verified.
- Migrating database, map, and media services late in the project can introduce regressions in authentication, admin CRUD, map search, route display, and VR launch flows.
- VR asset collection can consume more time than coding. Without actual campus panoramas, the VR requirement will look incomplete.
- Offline caching for 360-degree assets can become slow or storage-heavy on student phones.
- Google OAuth depends on correct Google Cloud credentials and redirect URI setup.
- The app has no automated tests, so late changes can break core demo flows.
- Admin pages currently mix real and mock data, which can undermine credibility during a demo.
- Campus building, office/service, and route accuracy depends on verified CSPC data.

### Blockers

- Final stack migration has not yet been implemented in the repository.
- No current real panorama/VR assets are present in the repository.
- No final VR panorama asset set exists yet.
- Deployment targets are now defined conceptually: Vercel for demo/UAT and Docker for full deployment. They still need final docs/config and runtime verification.

### Assumptions

- Real-time GPS, indoor positioning, automatic rerouting, CSPC SIS/enrollment integration, student enrollment-status simulation, fake instructor teaching schedules, fake assigned rooms, and fake all-room instructor dashboards are out of scope.
- The final demo should not include fake enrollment or fake schedule/room widgets just to fill dashboard space. Any schedule shown must come from the real room/facility scheduling module.
- A small number of polished VR routes is better than many incomplete routes.
- The team has limited time, so the roadmap prioritizes defense-critical features over broad refactoring.

## Recommended Order of Work

1. Document the final stack decision in the paper and technical plan.
2. Preserve the working prototype baseline before migration.
3. Complete Milestone 1 Supabase/PostGIS foundation: schema, seed, server client, smoke checks, and repository stubs.
4. Migrate authentication, roles, and profiles to Supabase runtime while keeping Express sessions, local bcrypt login, and Google OAuth.
5. Migrate buildings, map/search/routes, and pathfinding to Supabase/PostGIS; preserve API shapes first, then move the map UI from Leaflet to MapLibre GL JS.
6. Migrate dashboards, announcements, events, and role content to Supabase while keeping fake academic widgets out of scope.
7. Migrate VR scenes, hotspots, and guided routes to Supabase; wire Cloudinary-ready media fields and keep missing-panorama fallback behavior.
8. Add PWA manifest, custom Service Worker, offline shell, and offline indicator after Supabase-backed runtime flows are stable.
9. Finish admin FAQ/log/settings backing data if time remains.
10. Run the manuscript-aligned functional and security test checklist.
11. Complete post-Milestone 8 manuscript alignment: Supabase sessions, Cloudinary media, real room scheduling, Vercel demo support, and Docker full-deployment finalization.
12. Prepare the final demo database, accounts, screenshots, and deployment notes.

## Minimum Defense-Ready Cut

If time becomes tight, focus on this reduced but credible scope:

- Supabase-backed buildings, search, route text, and admin building edits.
- MapLibre campus map with working search, building selection, and route display.
- Cloudinary-hosted final campus images and VR panorama assets where available.
- Secure role login with admin-only backend.
- Student/instructor dashboards cleaned of fake enrollment, fake schedule, and fake room widgets while preserving useful role actions and real room/facility schedule links where available.
- Admin news/events plus role-visible announcements.
- Two polished VR routes with hotspot progression.
- Basic PWA installability and custom Service Worker offline shell with cached building/route data.
- Manual black-box, security, SUS, and user satisfaction test artifacts.
