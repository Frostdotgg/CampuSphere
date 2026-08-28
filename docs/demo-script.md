# CampuSphere Defense Demo Script

Milestone 8, Section 8.10. This script is for a controlled defense/demo using
seeded data. Do not use real secrets or private production data on screen.

<!-- M12 RELEASE CONTINUITY START -->
## Current Release Continuity (2026-08-28)

Live Git at the start of this synchronization is branch `main`, with local
`HEAD`, `origin/main`, and remote `main` all equal to pushed Git commit SHA-1
`0c906db0b33b93ff450b8de0b94a80a54c97d63a` (`0c906db`,
`docs: synchronize FAQ and settings release authority`). Its parent is pushed
product commit `38905b7b2b103caa9ed0575f1031b30344944970` (`38905b7`,
`feat: add public FAQ and institutional settings`), whose parent is
`e481d0343313e6356438393a783b48d838f01a36` (`e481d03`). The index and
worktree were clean, with zero dirty paths and zero stashes. Recompute live Git
truth in every new session; this start-of-sync snapshot never authorizes
normalization when live truth differs.

This synchronization is authority/static-contract work only. At its pre-commit
checkpoint, its exact delta is 12 modified tracked paths: the 11 authority
documents plus `scripts/quality-gates.js`, with an empty index, no untracked
paths, and zero stashes. That checkpoint is intentionally unstaged,
uncommitted, and unpushed for owner inspection. If the owner authorizes the
commit and push, the resulting successor must be a clean `main` state whose
local `HEAD`, `origin/main`, and remote `main` agree and whose diff from
`0c906db` contains exactly those 12 paths. Every new session must recompute
which state is live; neither state authorizes promotion or deployment.

The retained safety branch `backup-pre-trailer-strip` still points to Git
commit SHA-1 `d387c9151f1582cc4a8fc80002be52e11956335f`.

Accepted history remains separate and unchanged: Milestones 8-11, RF.1-RF.6,
BE.1-BE.6, OFF.1-OFF.6, M12.P1 R1-R7, D1-D7, dependency-security
remediation, the independently reviewed `bb17b9b` release authority, and the
owner-observed later Production/OAuth/course evidence retain their recorded
dispositions. The abbreviated operative lineage is
`d786bdc -> c00db76 -> bb17b9b -> dc961b1 -> 2b4f42d -> e481d03 ->
38905b7 -> 0c906db`.

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

The pushed product commit `38905b7` was independently reviewed in the order
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

Product commit `38905b7` and authority-only commit `0c906db` are committed
and pushed to `main`, but no owner-authorized promotion, Production
acceptance, or independent anonymous deployed-byte verification is recorded
for the current product lineage. Do not infer current Vercel deployment state
from older screenshots. The last independently post-deployment-verified
technical Production baseline
`fea3b2e11c6331eddc1ee091b165427d8e0218d7` remains; owner-observed
Production behavior for later commits remains a separate evidence class and is
not byte proof for `38905b7` or `0c906db`.

Production architecture remains Supabase/PostgreSQL for application data and
sessions, with MySQL for local development, fallback, and rehearsal. The stored
frozen verification baseline remains MySQL 34 buildings / 44 route nodes / 100
directed edges / 50 exact reverse pairs / 100 valid geometries; Supabase 25 /
26 / 50 / 25 / 50; and the shared Guided-VR catalog 25 active destinations /
472 configured steps / 99 unique scene keys. The accepted candidate's final
canonical-session postcondition was zero unexpired residue (`18/18`). The
supported local MySQL administrator-session revocation and the MySQL CCS
route-node/geometry correction are closed operational history. Do not repeat
the revocation or infer authorization for further data or session mutation.

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
committed and pushed in the current `main` lineage. Promotion and deployment
remain separate, unauthorized boundaries.

The same product commit completes the administrator-managed institutional
settings projection. The fixed ten-key allowlist reads from the selected
Supabase or MySQL backend and safely supplies the signed-in `/about` page plus
the shared public and signed-in footers. The existing Description field owns
both About narrative paragraphs: at most two blocks separated by one blank
line. A legacy single paragraph receives the safe default context paragraph at
read time without an automatic database write. The original About layout is
preserved, all settings render through escaped output and validated links, and
no schema or migration changed. Focused evidence is site settings `26/26` and
the bounded local MySQL runtime probe `20/20`, including exact restoration of
the original ten settings.

The accepted offline implementation remains an explicit user-requested
download stored in browser IndexedDB, with MapLibre rendering a bounded,
content-addressed CSPC PMTiles archive; the online map continues to use current
OSM/Leaflet data. The client's future requirement is that a connected Update
Offline Map action eventually obtain a newly prepared CSPC-scoped PMTiles
version when a new physical CSPC building footprint appears upstream in OSM,
so the footprint remains visible after disconnection. That refresh pipeline is
not implemented: the current user click does not convert live OSM data into
PMTiles, and no hosting, automation, deployment, or vendor design is selected
or authorized by this synchronization.

Keep evidence classes separate: accepted historical release/R8 evidence;
course-feature and owner-observed Production/OAuth evidence; live Git truth;
accepted `e481d03` source/package/review/push evidence; pushed product commit
`38905b7` source/package/verification/review evidence; pushed authority-only
commit `0c906db`; owner-applied migration 0020; the read-only sync preview;
the Android compatibility observation; the unimplemented offline-map refresh
request; missing promotion, Production acceptance, and deployed-byte proof for
the current product; and the external Final Milestone 12 disposition.
This synchronization changes only the 11 authority documents plus
`scripts/quality-gates.js`. At the pre-commit checkpoint these paths are
intentionally unstaged; after an authorized commit and push, the successor is
the clean `main` state described above. No new session may infer authority to
review, implement, test, commit, push, promote, deploy, alter SQL/data/sessions,
contact Cloudinary or another vendor, run Production smoke, or issue a
GO/NO-GO. Both fresh-session prompts must ground, report, and wait for the
owner. Deployment is not authorized by this synchronization.

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

## Pre-Demo Setup

1. Confirm MySQL is running and seeded:
   ```bash
   node database/seed.js
   ```
2. Confirm Supabase migrations `0001` through `0019` have been owner-applied if
   the demo uses Supabase mode. Migrations `0014` through `0019` provide the
   verified road graph, owner-managed geometry, atomic geometry writes,
   authoritative Guard House topology, CAS baseline, and selected-demo parity;
   `0011` remains required for
   `SESSION_STORE=supabase`.
3. Run the gates and record only final pass lines:
   ```bash
   npm run qa
   npm run qa:db
   npm run qa:identity
   npm run qa:audit
   ```
4. Start the app only with the approved local workflow. Do not run foreground
   long-lived server commands inside Codex. For a human-led demo, `npm start` is
   acceptable in a normal terminal.
5. Use the regression accounts. For a local MySQL rehearsal, the deterministic
   seed fixtures apply (local-only values in `database/seed.js` /
   `scripts/regressionCredentials.js` — deliberately not listed here). For a
   Supabase-backed demo, the four regression identities (admin, student,
   instructor, guest) use private owner-managed passwords available only
   through the test-only `SUPABASE_REGRESSION_*` variables in the ignored
   local `.env` (names in `.env.example`).

No credential value is recorded in this repository; former documented demo
passwords are dead and rejected by the live accounts. Change or remove seeded
local fixtures before any non-demo deployment.

## Talk Track

### 1. Product Overview

- CampuSphere is a role-based campus navigation and information portal for CSPC.
- It uses Express, EJS, server-side sessions, MySQL fallback, and Supabase cloud
  data paths selected by runtime switches.
- Supabase Auth is not used; authentication stays in the Express app with local
  credentials and Google OAuth.

### 2. Authentication And Roles

1. Open `/auth`.
2. Sign in as the seeded student.
3. Show the student dashboard and role-specific navigation.
4. Attempt an admin-only URL and show access is denied.
5. Sign out with the UI logout control.

Expected: logout is POST-only and session cleanup redirects to
`/auth?logged_out=1`.

### 3. Admin Workflow

1. Sign in as the seeded admin.
2. Open the admin dashboard.
3. Create, edit, list, and delete a demo FAQ/news/event item.
4. Show invalid input returns a clean validation error.

Expected: admin CRUD works, non-admin users cannot access admin APIs, and errors
do not expose stacks, SQL, or secrets.

### 4. Campus Navigation

1. Open the public map.
2. Choose a known seeded building and select **Set as Destination**.
3. Show that the line starts at the Guard House, follows the owner-managed road
   geometry, and keeps the route steps in graph order.
4. Open **Set VR Route**. Navigate mapped scenes and show that incomplete scene
   coverage ends with a coverage notice, not a false arrival message.

Expected: map search is capped and sanitized, road geometry renders in graph
order, and VR navigation uses admin-managed non-private data. MySQL freezes 34
buildings, 44 route nodes, 100 directed edges, 50 exact reverse pairs, 100 valid
geometries, and 33 routable destinations; Supabase freezes 25 buildings, 26
route nodes, 50 directed edges, 25 exact reverse pairs, 50 valid geometries,
and 25 routable destinations; Guided VR covers 25 active destinations, 472
configured steps, and 99 unique scene keys.

Arrival requires the configured natural destination node, stored start and
arrival scene mappings, an approved Cloudinary delivery URL and public ID, and
exactly one forward and one reverse scene link for every adjacent scene pair;
otherwise the route remains unavailable and no arrival is reported.

### 5. PWA And Offline Boundary

  OFF.2-OFF.6 are complete and Codex GO on local commit
  `cdbc863b779e5319c14dee21a31a5e78951e233c`. M12.P1-D6 is complete and Codex
  GO on local commit `691f0bef40e06b6ea9485e713d2fe3000a03bd83`. The exact
  19-file offline UI/accessibility/package implementation was independently fully
  verified, committed as `d786bdcb83a196c7263dceae668417d3ced3e95a`, and pushed
  to `origin/main`.

  Its exact committed implementation manifest SHA-256
  `92c689b884f52021f5545f331e8768ffc4768914cf9320c2d4b8fedee7020642` covers 19
  files and 2,072,400 bytes. Replacement full verification passed at
  `4998/4998` with `QUALITY-GATES OK`, five-stage QA at the same exact contract
  total, bounded Chrome acceptance in both supported backends, and ordered
  postconditions `24/24 -> 18/18 -> 46/46`. The package pin is 168 files,
  7,073,128 bytes, aggregate SHA-256
  `1d6cc68b7ef350b6a61eb8d84ea4fb7dd6862bd8548beb7595d3f2e6f4b10d6a`.

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

The independent read-only closeout review of exact 19-file predecessor manifest
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
Replacement full verification passed at `4998/4998` with `QUALITY-GATES OK`,
five-stage QA at the same exact contract total, bounded Chrome acceptance in
both supported backends, and ordered postconditions `24/24 -> 18/18 -> 46/46`.
The clean-commit independent R8 review returned NO-GO solely because stale
operative lifecycle authority still described this pushed, verified commit as
uncommitted and pending; it found no separate runtime, security, database, or
package blocker. This R8 result remains the current external disposition until
a later corrected review.

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
  2D `35/35`, and package boundary `74/74`; the unchanged package identity is
  168 files, 7,073,128 bytes, aggregate SHA-256
  `1d6cc68b7ef350b6a61eb8d84ea4fb7dd6862bd8548beb7595d3f2e6f4b10d6a`.
  Replacement verification of the committed implementation passed at
  `4998/4998` with `QUALITY-GATES OK`, five-stage QA, bounded Chrome acceptance
  in both supported backends, and ordered `24/24 -> 18/18 -> 46/46`. The
  implementation is committed and pushed as `d786bdcb83a196c7263dceae668417d3ced3e95a`;
  the clean-commit R8 review returned NO-GO solely for stale lifecycle authority.
  The `494010dd...` manifest is predecessor evidence, not a pin for the later
  documentation/static-assertion correction. Final Milestone 12 disposition
  remains external; no promotion or deployment is authorized here.

1. Show the manifest/offline support and explicitly download the local guide.
2. Demonstrate the accepted local normal campus map, Guard House/Main Gate routes,
   route directions, and the details window opened from a building node/list
   item. Explain that OFF.2-OFF.6 are Codex GO; promotion and deployment remain
   separately owner-authorized.
3. Explain that authenticated HTML, admin routes, auth routes, logout, and
   profile update APIs are never cached by the service worker.

Expected: current PWA behavior improves resilience without storing private
pages. BE.6, OFF.1-OFF.6, and D6 are Codex GO. Pilot review is complete by owner
acceptance. Offline scope contains only 2D Main Gate routing and text building
details—no 360/Guided VR/Free Roam, schedules, or building photos. Final
Milestone 12 disposition remains a separate independent closeout decision.

### 6. Security And Deployment Readiness

Show the accepted pre-offline baseline pass lines from:

```bash
npm run qa
npm run qa:db
npm run qa:identity
npm run qa:audit
```

Explain:

- CSRF protects unsafe requests and logout.
- Rate limiting covers login, OAuth, profile updates, and admin mutations.
- Helmet/CSP blocks inline/eval script execution except nonce-approved code.
- Production sessions use the Supabase session store by default (preferred); the
  server fails closed on unsafe session config, and MySQL remains the explicit
  fallback / local-rehearsal session store only.
- Supabase service-role key is server-only and runtime-env only.
- RF.6 road-following routing is Codex GO. CampuSphere computes routes from its
  own campus graph and owner-managed road geometry; it does not integrate Google
  Maps, Google Earth, Strava, SIS, or another external routing engine.
- Technical Production baseline
  `fea3b2e11c6331eddc1ee091b165427d8e0218d7` is accepted. The authorized push
  automatically triggered Production, and bounded anonymous read-only GET-only
  post-deployment verification passed. Vercel `Auto-assign Custom Production
  Domains` is disabled, so future `main` deployments require manual promotion.
  Documentation/static-assertion commit `db05b54` is `Ready` / `Production` /
  `Staged`, was not promoted, and did not replace the live alias. The human pilot
  occurred on 2026-08-05; the owner accepts it with zero reported findings,
  participant/Form evidence remains external, and its full source-commit
  identity was not independently verified. Pilot review is complete.
   OFF.2-OFF.6 and D6 are complete and Codex GO. The verified implementation
   `d786bdcb83a196c7263dceae668417d3ced3e95a` is committed and pushed; no
   promotion or deployment is authorized, and final Milestone 12 disposition
   remains external to this script.
- The first full verification of that offline candidate is
  historical/rejected at `4635/4641`: `npm test` exited 1 after 4,635 PASS
  lines and emitted no `QUALITY-GATES OK` because exactly six static
  documentation/authority checks failed. All executed runtime, database,
  catalog, BE.6, and final embedded `18/18` residue checks were green; QA and
  the standalone `24/24 -> 18/18 -> 46/46` postconditions did not run. Do not
  present that rejected run as current evidence; the later D6 and OFF.6
  definitive verification supersedes it.
- Docker packaging exists; Docker full deployment finalization is Milestone 13
  and must be verified on a Docker-enabled machine.

## Fallback Plan

- If Google OAuth is unavailable, show the documented fallback:
  `/auth/google` redirects to `/auth?error=oauth_failed`, while local login
  remains functional.
- If Supabase is unavailable, keep all `*_DATA_SOURCE=mysql` and demonstrate the
  MySQL fallback path.
- If internet access is unavailable, avoid CDN-dependent visual claims and focus
  on seeded local flows plus recorded sanitized evidence.
