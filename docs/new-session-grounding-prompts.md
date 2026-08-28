# CampuSphere New Session Grounding Prompts

Last updated: 2026-08-28 (Asia/Manila)

## Current Pushed-Candidate Override

The public FAQ and institutional-settings product is verified, reviewed,
committed, and pushed through product commit `38905b7`; its authority-only
successor `0c906db` is also pushed. The earlier room-schedule implementation
remains pushed through `e481d03`, and migration
`0020_room_schedule_documents.sql` is owner-applied in Supabase with matching
verified MySQL schema. No promotion, Production acceptance, or deployed-byte
proof is recorded for the current product lineage. Any older prompt below that
describes the product or authority commits as unpushed, the FAQ as a future
task, or the current offline-map refresh request as implemented is historical.
A fresh session must not touch either database, call a vendor, run runtime
verification, mutate Git, promote, or deploy unless the owner separately
authorizes that exact boundary.

The two sections titled `Codex Grounding Prompt` and
`Claude Code Grounding Prompt` below are the only current copy-paste prompts.
Both authorize grounding only and then wait for the owner. They do not
authorize review, implementation, testing, Git mutation, database/session
access, vendor mutation, another deployment/promotion, OAuth publishing,
course-catalog work, pilot work, or a new GO/NO-GO. Every older prompt and
pre-promotion snapshot below is historical and must not be used as current
authority.

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

The current uncommitted candidate is a stabilization candidate that includes
the semester room-schedule image flow, owner-applied
`0020_room_schedule_documents.sql`, admin-pasted Cloudinary delivery metadata,
accessible image viewing, direct VR schedule-document links, valid Guided-VR
and Free Roam scene arrows, VR light/dark theme parity, smaller accessible
building pins online and offline, the offline display label `Guard House`, the
authenticated notification feed/panel and its cross-page stylesheet ownership,
the Paga About card, admin category-dropdown styling and user role/status
filters, safe Google profile-image synchronization, and removal of the manual
profile-photo upload. Do not record
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
## Codex Grounding Prompt

```text
Repository: C:\Users\FROST.GG\Desktop\CampuSphere v1

You are Codex for CampuSphere: senior reviewer, security/DB/UI quality gate,
handoff owner, and delivery coordinator.

This is a fresh context-only grounding session that does not authorize
implementation or review. Change nothing. Do not edit, format, create, delete,
move, stage, commit, amend, stash, reset, clean, tag, push, promote, deploy,
link Vercel, alter Google OAuth, apply or reapply SQL, access or mutate either
database, clear sessions, invoke Cloudinary/Upstash management APIs, start a
server, use a browser, or run tests, QA, probes, audits, manifests, or smoke
checks. Do not copy credentials, participant PII, developer-contact emails,
database identifiers, backup paths, Search Console verification artifacts,
signed URLs, or secrets into Git or the report.

Capability grounding:
- Inventory the skills, plugins, apps, MCP servers, and tools actually
  available. Availability is not authorization.
- Load and follow the installed code-reviewer skill completely before any later
  code, security, database, UI, quality, deployment, or GO/NO-GO finding.
- Use context-mode (`ctx_execute_file` or `ctx_batch_execute`) or an equivalent
  read-only large-file tool for long files when available. If unavailable,
  report that and use bounded read-only file reads. Browser/Chrome/Playwright
  availability is not authorization. Context7 may be used only for official
  library documentation in a later, separately authorized task.
- Report missing named capabilities and use only a safe read-only fallback.

Read completely and in this order:
1. CODEX_HANDOFF.md
2. CLAUDE_HANDOFF.md
3. plan.md, especially Current Release Continuity, M12 interfaces, anti-scope,
   assumptions, backup/restore, data-cutover, and offline-map notes
4. ROADMAP.md, especially privacy/pilot/release gates, OFF.2-OFF.6,
   Milestones 12-13, blockers, and recommended order
5. AGENTS.md
6. CLAUDE.md
7. docs/deployment.md, docs/security-checklist.md, docs/test-evidence.md,
   docs/demo-script.md, and docs/new-session-grounding-prompts.md
8. package.json, package-lock.json, .env.example, docker-compose.yml,
   .vercelignore, vercel.json, config/selectedDemoFreeze.js, and the package
   and deployment-boundary probe sources
9. controllers/faqController.js, controllers/pageController.js,
   controllers/adminContentController.js, controllers/adminController.js,
   services/siteSettingsService.js, repositories/siteContentRepository.js,
   utils/siteSettingsDescription.js, routes/index.js, views/faq.ejs,
   views/about.ejs, views/admin/settings.ejs, views/admin/faqs.ejs, the shared
   navigation/footer partials, public/js/public-faq.js,
   public/js/admin/admin-settings.js, public/css/faq.css,
   public/css/admin-styles.css, scripts/publicFaq-probe.js,
   scripts/siteSettings-probe.js, and scripts/siteSettingsRuntime-probe.js
10. controllers/scheduleController.js,
    controllers/adminScheduleController.js,
    repositories/scheduleRepository.js, both
    0020_room_schedule_documents.sql migration sources, the admin schedule and
    shared viewer surfaces, controllers/vrController.js, routes/vr.js,
    routes/buildings.js, views/vr.ejs, views/building-details.ejs,
    public/js/vr-hotspot-navigation.js, the VR/building schedule-link surfaces,
    and scripts/roomScheduleDocument-probe.js
11. controllers/notificationController.js,
    services/notificationFeedService.js, public/js/notification-panel.js,
    views/partials/dash-navbar.ejs, admin category/user-filter surfaces,
    profile/Google-image synchronization surfaces, and relevant probes
12. public/offline.html, public/css/offline.css,
    public/js/offline-guide-manager.js, public/js/pwa.js, public/sw.js,
    controllers/offlineGuideController.js, services/offlineGuideService.js,
    and relevant source-only map/offline/PWA probes
13. scripts/syncSupabaseContentToMysql.js only to understand its fail-closed
    dry-run/apply boundary and protected-table exclusions; do not run it
14. scripts/quality-gates.js and the docs-current, FAQ/settings, schedule,
    notification, admin, VR, map/offline, auth/profile, package, routing,
    course, and legacy-preservation assertions
15. every database and Supabase migration filename, then read-only Git truth:
    branch, HEAD, origin/main, remote main, status, staged/unstaged/untracked
    paths, stashes, safety refs, and recent graph

The former manual-upload files middleware/profilePhotoUpload.js,
services/profileImageService.js, and scripts/profilePhotoUpload-probe.js were
removed. Their absence is expected; do not recreate them or report them as
missing required inputs.

Recorded release authority (recompute it against live truth, which wins):
- At this synchronization's start, branch main, HEAD, origin/main, and remote
  main matched pushed commit 0c906db0b33b93ff450b8de0b94a80a54c97d63a.
  The index/worktree were clean, with zero dirty paths and zero stashes. After
  this authority sync, the pre-commit checkpoint is exactly 12 modified
  tracked paths: the 11 authority documents plus scripts/quality-gates.js,
  with an empty index, no untracked paths, and zero stashes. That checkpoint
  is intentionally unstaged, uncommitted, and unpushed. If the owner authorizes
  the commit and push, the resulting successor must be a clean main state whose
  local HEAD, origin/main, and remote main agree and whose diff from 0c906db
  contains exactly those 12 paths. Any other live difference is an
  inconsistency to report, not permission to normalize it. The safety branch
  backup-pre-trailer-strip points to
  d387c9151f1582cc4a8fc80002be52e11956335f.
- The current pushed lineage is dc961b1eeba191d79b96998d96f0a49dac3ffcf8
  -> 2b4f42df3f79347c70af07f7b98f70be55b701bd
  -> e481d0343313e6356438393a783b48d838f01a36
  -> 38905b7b2b103caa9ed0575f1031b30344944970
  -> 0c906db0b33b93ff450b8de0b94a80a54c97d63a. Accepted earlier
  release/R8 history remains separate.
- e481d03 contains the verified non-Cloudinary stabilization and semester
  room-schedule image flow. One schedule document serves each room/facility;
  schedule_document_id links viewers; no image bytes are uploaded by
  CampuSphere; legacy rows remain a read-only fallback; schedules remain
  excluded from the offline package.
- The owner applied 0020_room_schedule_documents.sql; matching MySQL schema
  parity was verified. Do not reapply SQL or access either database.
- Accepted e481d03 evidence is npm test 4998/4998 with QUALITY-GATES OK;
  five-stage npm run qa green; schedule 58/58; package 74/74; BE.6 46/46;
  residue 18/18. Its historical runtime package identity is 180 files,
  7,189,621 bytes, SHA-256
  c07e34f43f859f3f4055c9a00f90b0a5967d323ef85e243227d95c8023195216.
- Pushed product commit 38905b7 was independently reviewed in the order
  Security -> Performance -> Correctness -> Maintainability with no critical,
  high, medium, or low findings. Its read-only npm test and five-stage npm run
  qa exited 0 with QUALITY-GATES OK, DB-PERF-GATE OK, [supabase-smoke] PASS,
  IDENTITY-CONSTRAINTS OK, and zero audit vulnerabilities. Focused evidence is
  FAQ 38/38, site settings 26/26, settings runtime 20/20, package 74/74,
  BE.6 46/46, and residue 18/18. The wrapper emitted no standalone aggregate
  count, so do not relabel 4998/4998 as the product total.
- The current product package identity is 186 files, 7,220,073 bytes,
  SHA-256 c19b2bb9bcd328df56f0eb247077f48e0c3cc6f35bf919c0e22da0d3add1f621.
  This is source/package evidence, not deployed-byte proof.
- Product commit 38905b7 and authority-only commit 0c906db are committed and
  pushed. No owner-authorized promotion, Production acceptance, or independent
  deployed-byte verification is recorded for the current product lineage. Do
  not infer current Vercel state from older screenshots.
- Android 8 is an unsupported Android/Chrome platform compatibility observation,
  not a confirmed CampuSphere code defect and not a proven hardware failure;
  Android 10+ current Chrome is the supported presentation target.
- Production application data and sessions use Supabase/PostgreSQL; MySQL is
  local-development/fallback/rehearsal. The stored freeze remains MySQL
  34/44/100/50/100, Supabase 25/26/50/25/50, and Guided VR 25 active
  destinations / 472 steps / 99 scene keys.
- The owner-run syncSupabaseContentToMysql.js --dry-run was read-only, reported
  no differences and fingerprint
  2504a0474b0481964d447f5f538b9e4e1cd77ef0116c4299c12d0a81eae5bf05;
  it is not apply, backup, restore, or current database proof.
- The rejected/incomplete 2026-08-26 authority-sync rerun remains historical:
  it observed 665 total Supabase VR scenes versus frozen 664 and one unexpired
  canonical administrator session. Nothing was mutated in that rerun. Keep it
  separate from later product evidence BE.6 46/46 and residue 18/18; the
  supported local MySQL administrator-session revocation is now closed history.
- Manual profile-photo upload remains removed/deferred and safe Google image
  synchronization remains. Google OAuth Production behavior is owner-observed,
  not independent deployed-byte proof. Do not contact Cloudinary or create a
  privileged key.

The participant-facing public FAQ is implemented and pushed in product commit
38905b7 as a public server-rendered /faq page backed by existing dual-backend
administrator-managed FAQ data. It supports signed-out and signed-in users,
public and signed-in navigation, native accordions, search, category filters,
the shared theme control, and escaped admin-authored text. Admin FAQ CRUD stays
at /admin/faqs and /admin/api/faqs; saving publishes immediately with no schema
or migration change. The FAQ is standalone, not embedded in /dashboard.

The same product commit completes the institutional settings projection through a fixed
ten-key allowlist in the selected Supabase/MySQL backend. Settings safely feed
the signed-in /about page and shared public/signed-in footers. The existing
Description field owns at most two About narrative blocks separated by one
blank line; a legacy single paragraph receives the safe default context at
read time without an automatic write. The original About layout is preserved,
output is escaped, links are validated, and no schema or migration changed.
The supported local MySQL administrator-session revocation is closed history;
do not repeat it or mutate any session.

Offline truth must remain precise: Update Offline Map explicitly downloads an
immutable CSPC package to browser IndexedDB. MapLibre reads the bounded,
content-addressed PMTiles archive offline; the online map uses OSM/Leaflet. The
client's future requirement is for the connected action to obtain a newly
prepared CSPC-scoped PMTiles version after a new physical CSPC building
footprint appears upstream in OSM, so it remains visible offline. This refresh
pipeline is not implemented. The user click does not convert live OSM into
PMTiles, and no hosting, automation, deployment, or vendor design has been
selected or authorized.

Keep evidence classes separate: accepted historical release/R8 evidence;
owner-observed Production/OAuth facts; live Git; accepted e481d03 evidence;
pushed 38905b7 verification/review/package evidence; pushed authority-only
0c906db; owner-applied migration 0020; read-only sync preview; Android
compatibility; the unimplemented offline refresh; missing current promotion,
Production acceptance, and deployed-byte proof; and external Milestone 12.

Return only: capabilities and files inspected; exact live Git truth versus the
record; evidence classification; authority inconsistencies; and the next
authorization boundary. The next move is to wait for a separate owner
authorization; do not automatically start deployment or offline-map work. Do
not perform a code review, compute a manifest, run verification, issue a
GO/NO-GO, contact a vendor, plan or implement a feature, or infer
implementation. Final Milestone 12 disposition remains external. Stop and wait
for the owner. Deployment is not authorized by this prompt. This context-only
prompt authorizes none of those actions. Do not infer that implementation, Git
mutation, vendor work, or deployment is authorized.
```

## Historical Codex Grounding Prompt (2026-08-26 pre-FAQ; superseded; do not use)

```text
Repository: C:\Users\FROST.GG\Desktop\CampuSphere v1

You are Codex for CampuSphere: senior reviewer, security/DB/UI quality gate,
handoff owner, and delivery coordinator.

This is a fresh context-only grounding session that does not authorize
implementation or review. Change nothing. Do not edit, format, create, delete,
move, stage, commit, amend, stash, reset, clean, tag, push, promote, deploy,
link Vercel, alter Google OAuth, apply or reapply SQL, access or mutate either
database, clear sessions, invoke Cloudinary/Upstash management APIs, start a
server, use a browser, or run tests, QA, probes, audits, manifests, or smoke
checks. Do not copy credentials, participant PII, developer-contact emails,
database identifiers, backup paths, Search Console verification artifacts,
signed URLs, or secrets into Git or the report.

Capability grounding:
- Inventory the skills, plugins, apps, MCP servers, and tools actually
  available in this session. Availability is not authorization.
- Load and follow the installed code-reviewer skill completely before any later
  code, security, database, UI, quality, deployment, or GO/NO-GO finding.
- Use context-mode or an equivalent read-only large-file tool for long files
  when available. If it is unavailable, report that and use bounded read-only
  file reads. Browser/Chrome/Playwright availability is not authorization.
- Report missing named capabilities and use only a safe read-only fallback.

Read completely and in this order:
1. CODEX_HANDOFF.md
2. CLAUDE_HANDOFF.md
3. plan.md, especially Current Release Continuity, M12 interfaces, anti-scope,
   assumptions, backup/restore, and data-cutover notes
4. ROADMAP.md, especially privacy/pilot/release gates, OFF.2-OFF.6,
   Milestones 12-13, blockers, and recommended order
5. AGENTS.md
6. CLAUDE.md
7. docs/deployment.md, docs/security-checklist.md, docs/test-evidence.md,
   docs/demo-script.md, and docs/new-session-grounding-prompts.md
8. package.json, package-lock.json, .env.example, docker-compose.yml,
   .vercelignore, vercel.json, config/selectedDemoFreeze.js, and the package
   and deployment-boundary probes
9. controllers/scheduleController.js, controllers/adminScheduleController.js,
   repositories/scheduleRepository.js,
   database/migrations/0020_room_schedule_documents.sql,
   database/supabase/migrations/0020_room_schedule_documents.sql,
   views/admin/schedules.ejs, views/partials/room-schedule-viewer.ejs,
   public/js/room-schedule-viewer.js,
   public/js/admin/admin-schedules.js, and
   scripts/roomScheduleDocument-probe.js
10. controllers/vrController.js, routes/vr.js, routes/buildings.js,
    views/vr.ejs, views/building-details.ejs,
    public/js/vr-hotspot-navigation.js, and the VR/building schedule-link
    surfaces
11. controllers/notificationController.js,
    services/notificationFeedService.js, public/js/notification-panel.js,
    views/partials/dash-navbar.ejs, admin category/user-filter surfaces,
    profile/Google-image synchronization surfaces, and relevant probes
12. public/offline.html, public/css/offline.css,
    public/js/offline-guide-manager.js, public/js/pwa.js, public/sw.js,
    controllers/offlineGuideController.js, services/offlineGuideService.js,
    and relevant source-only map/offline/PWA probes
13. scripts/syncSupabaseContentToMysql.js, only to understand its fail-closed
    dry-run/apply boundary and protected-table exclusions; do not run it
14. scripts/quality-gates.js and the docs-current, schedule, notification,
    admin, VR, map/offline, auth/profile, package, routing, course, and
    legacy-preservation assertions
15. every database and Supabase migration filename, then read-only Git truth:
    branch, HEAD, origin/main, remote main, status, staged/unstaged/untracked
    paths, stashes, safety refs, and recent graph

The former manual-upload files middleware/profilePhotoUpload.js,
services/profileImageService.js, and scripts/profilePhotoUpload-probe.js were
removed. Their absence is expected; do not recreate them or report them as
missing required inputs.

Reconcile these recorded facts against live truth, which wins:
- At this synchronization's start, branch main, HEAD, origin/main, and remote
  main matched e481d0343313e6356438393a783b48d838f01a36. The index/worktree
  were clean, with zero dirty paths and zero stashes. After the authority edits,
  the expected live tree is exactly 12 modified tracked paths: the 11 authority
  documents plus scripts/quality-gates.js, with an empty index, no untracked
  paths, and zero stashes. Any other live difference is an inconsistency to
  report, not permission to normalize it. The recorded safety branch
  backup-pre-trailer-strip points to Git commit SHA-1
  d387c9151f1582cc4a8fc80002be52e11956335f.
- The lineage through the current candidate is Git commit SHA-1
  dc961b1eeba191d79b96998d96f0a49dac3ffcf8 -> Git commit SHA-1
  2b4f42df3f79347c70af07f7b98f70be55b701bd -> e481d03. Accepted earlier
  release/R8 history remains separate.
- e481d03 contains the verified non-Cloudinary stabilization and semester
  room-schedule image flow. The schedule is one document per room/facility;
  admins paste an approved HTTPS Cloudinary delivery URL and optional public
  ID; CampuSphere performs no upload/delete/management API call. Building and
  VR viewers share the record, hotspots store schedule_document_id, legacy
  rows/metadata remain read-only fallback, and schedules stay offline-excluded.
- The owner applied 0020_room_schedule_documents.sql to Supabase and the local
  MySQL schema was verified. Migrations are contiguous through 0020. Do not
  reapply it, create another migration, or access either database.
- Current candidate evidence is npm test 4998/4998 with QUALITY-GATES OK;
  five-stage npm run qa green with DB-PERF-GATE OK, [supabase-smoke] PASS,
  IDENTITY-CONSTRAINTS OK, and zero audit vulnerabilities; schedule 58/58;
  package 74/74; BE.6 46/46; residue 18/18; and an ordered independent review
  with no critical/high/medium/low findings.
- Keep that accepted exact-source evidence separate from the rejected/incomplete
  2026-08-26 authority-sync rerun. The source-only docs-current gate is green,
  but full npm test stopped on two read-only live-state postconditions:
  Supabase has 665 total VR scenes versus the frozen 664, with the newest extra
  scene outside the selected 101-scene scope and carrying zero incoming or
  outgoing links; and one intended-role canonical Supabase admin session was
  unexpired at classification time, due to expire at 2026-08-26 13:30:36
  Asia/Manila. All selected-VR/Guided fingerprints and all 25 active routes
  passed. Nothing was mutated and authority-sync npm run qa was not run.
- The runtime package identity is 180 files, 7,189,621 bytes, SHA-256
  c07e34f43f859f3f4055c9a00f90b0a5967d323ef85e243227d95c8023195216.
  This is source/package evidence, not deployed-byte proof.
- e481d03 is committed and pushed. No owner-authorized promotion, Production
  acceptance, or independent deployed-byte verification is recorded for it.
  Do not infer current Vercel state from older screenshots.
- Production uses Supabase/PostgreSQL for application data and sessions;
  MySQL remains local development/fallback/rehearsal. The stored freeze baseline remains
  MySQL 34/44/100/50/100, Supabase 25/26/50/25/50, and shared Guided VR
  25 active destinations / 472 steps / 99 scene keys.
- The owner-run syncSupabaseContentToMysql.js --dry-run was read-only, reported
  no differences, and recorded equal fingerprints
  2504a0474b0481964d447f5f538b9e4e1cd77ef0116c4299c12d0a81eae5bf05.
  It wrote no data and is not current database, backup, restore, or apply proof.
- Manual profile-photo upload is removed/deferred; safe Google profile-image
  synchronization remains. Do not contact Cloudinary or create privileged keys.
- Android 8 is an unsupported Android/Chrome compatibility observation, not a
  confirmed CampuSphere bug or proven hardware failure. Chrome 138 was the last
  Android 8/9 release; Android 10+ current Chrome is the supported presentation
  target. Exact old-device causality lacks sanitized device logs.
- Admin FAQ CRUD exists at /admin/faqs and /admin/api/faqs, but no participant
  FAQ route/page exists. A public FAQ page is the selected next product task,
  but it follows resolution or explicit acceptance of the live verification
  drift and is not authorized by this grounding prompt.
- Final Milestone 12 disposition remains external.

Keep evidence classes separate: accepted historical release/R8 evidence;
course and owner-observed Production/OAuth facts; live Git; current e481d03
verification/review/package/commit/push; owner-applied migration 0020; the
read-only sync preview; Android compatibility; missing e481d03 promotion,
Production acceptance, and deployed-byte proof; and the external Milestone 12
disposition.

Return only: capabilities and files inspected; exact live Git truth versus this
record; evidence classification; authority inconsistencies; and the next
authorization boundary. The immediate next boundary is a separate owner
authorization for a bounded read-only recheck and decision on the extra
Supabase scene/freeze and canonical session state. Only after that gate is
green or explicitly accepted is the later boundary a separate authorization
to plan and implement the participant-facing public FAQ page. Do not perform a
code review, compute a manifest, run verification, issue a GO/NO-GO, contact a
vendor, plan the feature, or infer implementation. Stop and wait for the owner.
Final Milestone 12 disposition remains external. Deployment is not authorized
by this prompt. This context-only prompt authorizes none of those actions. Do
not infer that implementation, Git mutation, vendor work, or deployment is
authorized.
```

## Claude Code Grounding Prompt

```text
Repository: C:\Users\FROST.GG\Desktop\CampuSphere v1

You are Claude Code acting as CampuSphere's implementation partner and
evidence recorder. Codex remains the independent review/quality gate, and the
owner controls Git, database, vendor, OAuth, and deployment decisions.

This is a fresh context-only grounding session that does not authorize
implementation. Do not review, edit, test, implement, stage, commit, push,
deploy, promote, or perform a closeout review. Change nothing. Do not format,
create, delete, move, amend, stash, reset, clean, tag, link Vercel, alter Google
OAuth, apply or reapply SQL, access or mutate either database, clear sessions,
invoke Cloudinary/Upstash management APIs, start a server, use a browser, or
run tests, QA, probes, audits, manifests, or smoke checks. Do not record
credentials, participant PII, developer-contact emails, database identifiers,
backup paths, Search Console verification artifacts, signed URLs, or secrets.

Capability grounding:
- Inventory the skills, plugins, apps, MCP servers, and tools actually
  available. Availability is not authorization.
- Load and follow the installed code-reviewer skill completely before any later
  code, security, database, UI, quality, deployment, or GO/NO-GO finding.
- Use context-mode (`ctx_execute_file` or `ctx_batch_execute`) or an equivalent
  read-only large-file tool for long files when available. If unavailable,
  report that and use bounded read-only file reads. Browser/Chrome/Playwright
  availability is not authorization. Context7 may be used only for official
  library documentation in a later, separately authorized task.
- Report missing named capabilities and use only a safe read-only fallback.

Read completely and in this order:
1. CODEX_HANDOFF.md
2. CLAUDE_HANDOFF.md
3. plan.md, especially Current Release Continuity, M12 interfaces, anti-scope,
   assumptions, backup/restore, data-cutover, and offline-map notes
4. ROADMAP.md, especially privacy/pilot/release gates, OFF.2-OFF.6,
   Milestones 12-13, blockers, and recommended order
5. AGENTS.md
6. CLAUDE.md
7. docs/deployment.md, docs/security-checklist.md, docs/test-evidence.md,
   docs/demo-script.md, and docs/new-session-grounding-prompts.md
8. package.json, package-lock.json, .env.example, docker-compose.yml,
   .vercelignore, vercel.json, config/selectedDemoFreeze.js, and the package
   and deployment-boundary probe sources
9. controllers/faqController.js, controllers/pageController.js,
   controllers/adminContentController.js, controllers/adminController.js,
   services/siteSettingsService.js, repositories/siteContentRepository.js,
   utils/siteSettingsDescription.js, routes/index.js, views/faq.ejs,
   views/about.ejs, views/admin/settings.ejs, views/admin/faqs.ejs, the shared
   navigation/footer partials, public/js/public-faq.js,
   public/js/admin/admin-settings.js, public/css/faq.css,
   public/css/admin-styles.css, scripts/publicFaq-probe.js,
   scripts/siteSettings-probe.js, and scripts/siteSettingsRuntime-probe.js
10. the room-schedule controllers/repository, both 0020 migration sources,
    admin schedule and shared viewer surfaces, controllers/vrController.js,
    routes/vr.js, routes/buildings.js, views/vr.ejs,
    views/building-details.ejs, public/js/vr-hotspot-navigation.js, the
    VR/building schedule-link surfaces, and
    scripts/roomScheduleDocument-probe.js
11. the notification controller/service/panel/navbar, admin category and user
    filters, profile/Google-image synchronization surfaces, and relevant probes
12. public/offline.html, public/css/offline.css,
    public/js/offline-guide-manager.js, public/js/pwa.js, public/sw.js,
    controllers/offlineGuideController.js, services/offlineGuideService.js,
    and relevant source-only map/offline/PWA probes
13. scripts/syncSupabaseContentToMysql.js only for its fail-closed dry-run/apply
    and protected-table boundaries; do not run it
14. scripts/quality-gates.js and the docs-current, FAQ/settings, schedule,
    notification, admin, VR, map/offline, auth/profile, package, routing,
    course, and legacy-preservation assertions
15. every database and Supabase migration filename, then read-only Git truth:
    branch, HEAD, origin/main, remote main, status, staged/unstaged/untracked
    paths, stashes, safety refs, and recent graph

The former manual-upload files middleware/profilePhotoUpload.js,
services/profileImageService.js, and scripts/profilePhotoUpload-probe.js were
removed. Their absence is expected; do not recreate them or classify them as
missing inputs.

Recorded release authority (recompute it against live truth, which wins):
- At this synchronization's start branch main, HEAD, origin/main, and remote
  main matched pushed commit 0c906db0b33b93ff450b8de0b94a80a54c97d63a,
  with a clean index/worktree, zero dirty paths, and zero stashes. The
  pre-commit checkpoint is exactly 12 modified tracked paths: the 11 authority
  documents plus scripts/quality-gates.js, nothing staged or untracked, and
  zero stashes. That checkpoint is intentionally unstaged, uncommitted, and
  unpushed. If the owner authorizes the commit and push, the resulting
  successor must be a clean main state whose local HEAD, origin/main, and
  remote main agree and whose diff from 0c906db contains exactly those 12
  paths. Any other live difference is an inconsistency, not permission to
  normalize it. Safety branch backup-pre-trailer-strip points to
  d387c9151f1582cc4a8fc80002be52e11956335f.
- Current pushed lineage is dc961b1eeba191d79b96998d96f0a49dac3ffcf8
  -> 2b4f42df3f79347c70af07f7b98f70be55b701bd
  -> e481d0343313e6356438393a783b48d838f01a36
  -> 38905b7b2b103caa9ed0575f1031b30344944970
  -> 0c906db0b33b93ff450b8de0b94a80a54c97d63a.
- e481d03 contains the verified non-Cloudinary stabilization and semester
  room-schedule image flow. One schedule document serves each room/facility;
  schedule_document_id links viewers; no image bytes are uploaded by
  CampuSphere; legacy rows remain a read-only fallback; schedules remain
  excluded from the offline package.
- The owner applied 0020_room_schedule_documents.sql; matching MySQL schema
  parity was verified. Do not reapply SQL or access either database.
- Accepted e481d03 evidence is npm test 4998/4998 with QUALITY-GATES OK;
  five-stage QA green; schedule 58/58; package 74/74; BE.6 46/46; residue
  18/18. Historical package: 180 files, 7,189,621 bytes, SHA-256
  c07e34f43f859f3f4055c9a00f90b0a5967d323ef85e243227d95c8023195216.
- Pushed product commit 38905b7 was independently reviewed Security ->
  Performance -> Correctness -> Maintainability with no findings. npm test and
  five-stage npm run qa exited 0; focused evidence is FAQ 38/38, site settings
  26/26, settings runtime 20/20, package 74/74, BE.6 46/46, and residue 18/18.
  The wrapper emitted no standalone aggregate count. Product package: 186
  files, 7,220,073 bytes, SHA-256
  c19b2bb9bcd328df56f0eb247077f48e0c3cc6f35bf919c0e22da0d3add1f621.
- Product commit 38905b7 and authority-only commit 0c906db are pushed. No
  current promotion, Production acceptance, or deployed-byte proof is
  recorded; do not infer Vercel state from older screenshots.
- Android 8 is an unsupported Android/Chrome platform compatibility observation,
  not a confirmed CampuSphere code defect and not a proven hardware failure;
  Android 10+ current Chrome is the supported presentation target.
- Production application data and sessions use Supabase/PostgreSQL; MySQL is
  local-development/fallback/rehearsal. The stored freeze remains MySQL
  34/44/100/50/100, Supabase 25/26/50/25/50, and Guided VR 25 active
  destinations / 472 steps / 99 scene keys.
- The owner-run syncSupabaseContentToMysql.js --dry-run was read-only, reported
  no differences and fingerprint
  2504a0474b0481964d447f5f538b9e4e1cd77ef0116c4299c12d0a81eae5bf05;
  it is not apply, backup, restore, or current database proof.
- The rejected/incomplete 2026-08-26 authority-sync rerun remains historical:
  it observed 665 total Supabase VR scenes versus frozen 664 and one unexpired
  canonical administrator session. Nothing was mutated in that rerun. Keep it
  separate from later product evidence BE.6 46/46 and residue 18/18; the
  supported local MySQL administrator-session revocation is now closed history.
- Manual profile-photo upload remains removed/deferred and safe Google image
  synchronization remains. Google OAuth Production behavior is owner-observed,
  not independent deployed-byte proof. Do not contact Cloudinary or create a
  privileged key.

The participant-facing public FAQ is pushed in 38905b7 as public server-rendered /faq
with signed-out/signed-in navigation, native accordions, search/category
filters, shared theme, and escaped admin text. Admin CRUD remains at
/admin/faqs and /admin/api/faqs. It is standalone, not in /dashboard.

The same commit completes the fixed ten-key institutional-settings projection
from selected Supabase/MySQL to signed-in /about and shared footers. Description
owns at most two About blocks separated by one blank line; legacy one-paragraph
data receives safe default context at read time without automatic write. The
original layout remains; output is escaped, links validated, and no migration
changed. The supported local MySQL administrator-session revocation is closed;
do not repeat it.

Offline truth: Update Offline Map downloads an immutable CSPC package to
IndexedDB. MapLibre reads bounded content-addressed PMTiles offline; online uses
OSM/Leaflet. The future client request is to obtain a newly prepared CSPC-scoped
PMTiles version after a new physical CSPC building footprint appears upstream
in OSM. This is not implemented; the click does not convert live OSM to
PMTiles, and no hosting,
automation, deployment, or vendor design is selected or authorized.

Keep historical releases, owner observations, live Git, e481d03, pushed
38905b7 verification/review/package evidence, pushed 0c906db authority,
owner-applied migration, dry-run preview, Android compatibility, unimplemented
offline refresh, missing deployment evidence, and external closeout separate.

Return only a grounding report containing capabilities/files inspected, exact
live Git versus the record, evidence classes, authority inconsistencies, and
the next authorization boundary. Wait for a separate owner authorization; do
not automatically begin deployment or offline-map work. Final Milestone 12
disposition remains external. Do not infer that implementation, Git mutation,
vendor work, or deployment is authorized. After the grounding report, stop and
wait for the owner. Deployment is not authorized by this prompt. This
context-only prompt authorizes none of those actions.
```

## Historical Claude Code Grounding Prompt (2026-08-26 pre-FAQ; superseded; do not use)

```text
Repository: C:\Users\FROST.GG\Desktop\CampuSphere v1

You are Claude Code acting as CampuSphere's implementation partner and evidence
recorder. Codex remains the independent review/quality gate, and the owner
controls Git, database, vendor, OAuth, and deployment decisions.

This is a fresh context-only grounding session that does not authorize
implementation. Do not review, edit, test, implement, stage, commit, push,
deploy, promote, or perform a closeout review. Change nothing. Do not format,
create, delete, move, amend, stash, reset, clean, tag, link Vercel, alter Google
OAuth, apply or reapply SQL, access or mutate either database, clear sessions,
invoke Cloudinary/Upstash management APIs, start a server, use a browser, or
run tests, QA, probes, audits, manifests, or smoke checks. Do not record
credentials, participant PII, developer-contact emails, database identifiers,
backup paths, Search Console verification artifacts, signed URLs, or secrets.

Capability grounding:
- Inventory the skills, plugins, apps, MCP servers, and tools actually
  available. Availability is not authorization.
- Load and follow the installed code-reviewer skill completely before any later
  code, security, database, UI, quality, deployment, or GO/NO-GO finding.
- Prefer context-mode or an equivalent read-only large-file tool. If absent,
  report it and use bounded read-only reads. Browser/Chrome/Playwright
  availability is not authorization.
- Report missing named capabilities and use only a safe read-only fallback.

Read completely and in this order:
1. CLAUDE_HANDOFF.md
2. CODEX_HANDOFF.md
3. plan.md and ROADMAP.md, especially Current Release Continuity, M12
   interfaces, privacy/release gates, anti-scope, assumptions, backup/restore,
   data cutover, blockers, and recommended order
4. CLAUDE.md and AGENTS.md
5. docs/deployment.md, docs/security-checklist.md, docs/test-evidence.md,
   docs/demo-script.md, and docs/new-session-grounding-prompts.md
6. package.json, package-lock.json, .env.example, docker-compose.yml,
   .vercelignore, vercel.json, config/selectedDemoFreeze.js, and package/
   deployment-boundary probes
7. the room-schedule controllers/repository, both 0020 migration sources,
   admin schedule view/script, shared viewer partial/script, building and VR
   linkage, and scripts/roomScheduleDocument-probe.js
8. relevant notification, admin category/user-filter, Google profile-image,
   Guided-VR/Free-Roam, map, offline, PWA, and source-only probe surfaces
9. scripts/syncSupabaseContentToMysql.js for its fail-closed dry-run/apply and
   protected-table boundaries only; do not run it
10. scripts/quality-gates.js, every database/Supabase migration filename, and
    read-only Git truth: branch, HEAD, origin/main, remote main, status,
    staged/unstaged/untracked paths, stashes, safety refs, and recent graph

The former manual-upload files middleware/profilePhotoUpload.js,
services/profileImageService.js, and scripts/profilePhotoUpload-probe.js were
removed. Their absence is expected. Do not recreate them or classify them as
missing inputs.

Reconcile these facts against live truth, which wins:
- At synchronization start main/HEAD/origin/main/remote main matched
  e481d0343313e6356438393a783b48d838f01a36, with a clean index/worktree,
  zero dirty paths, and zero stashes. After this sync's edits, the expected
  live state is exactly 12 modified tracked authority/static-assertion paths,
  nothing staged or untracked, and zero stashes. Safety branch
  backup-pre-trailer-strip points to Git commit SHA-1
  d387c9151f1582cc4a8fc80002be52e11956335f. Lineage is Git commit SHA-1
  dc961b1eeba191d79b96998d96f0a49dac3ffcf8 -> Git commit SHA-1
  2b4f42df3f79347c70af07f7b98f70be55b701bd -> e481d03.
- e481d03 is verified, independently reviewed with no findings, committed, and
  pushed. Evidence is npm test 4998/4998; five-stage QA green and audit zero;
  schedule 58/58; package 74/74; BE.6 46/46; residue 18/18. Runtime package:
  180 files, 7,189,621 bytes, SHA-256
  c07e34f43f859f3f4055c9a00f90b0a5967d323ef85e243227d95c8023195216.
- The later 2026-08-26 authority-sync rerun is separate incomplete/rejected
  evidence. Source-only docs-current is green, while full npm test stopped on
  Supabase total VR scenes 665 versus frozen 664 and one unexpired canonical
  administrator session. The newest extra scene is outside the selected
  101-scene scope with zero incoming/outgoing links; selected fingerprints and
  all 25 Guided routes passed. Nothing was mutated, and no authority-sync QA
  was run. Recompute live before any conclusion.
- The candidate includes the non-Cloudinary stabilization and semester
  room-schedule document flow. Admins paste approved HTTPS Cloudinary delivery
  metadata; CampuSphere performs no upload/delete/management call. Building and
  VR viewers share schedule_document_id; legacy data is read-only fallback;
  schedules remain offline-excluded.
- 0020_room_schedule_documents.sql is owner-applied in Supabase and local MySQL
  parity is verified. Do not apply SQL or create another migration.
- Production data/sessions use Supabase; MySQL is local fallback/rehearsal.
  The stored freeze baseline is MySQL 34/44/100/50/100, Supabase
  25/26/50/25/50, and Guided
  VR 25 destinations / 472 steps / 99 scene keys.
- The sync-to-MySQL dry-run reported no differences and equal fingerprint
  2504a0474b0481964d447f5f538b9e4e1cd77ef0116c4299c12d0a81eae5bf05;
  it wrote nothing and is not current database or apply evidence.
- No promotion, Production acceptance, or deployed-byte proof is recorded for
  e481d03. Current Vercel state is unknown. Owner-observed older Production and
  OAuth evidence remains separate.
- Manual profile upload is removed/deferred; safe Google image sync remains.
  Android 8 is an unsupported Chrome/platform observation, not a confirmed app
  bug or proven hardware failure; Android 10+ current Chrome is supported.
- Existing admin FAQ CRUD has no participant-facing route/page. The selected
  next task is a public FAQ page backed by the existing dual-backend FAQ data,
  after the operational verification state is resolved or explicitly accepted;
  this prompt does not authorize planning or implementation.
- Final Milestone 12 disposition remains external.

Keep accepted history, owner observations, current source verification/review,
Git/package truth, owner-applied migration evidence, dry-run preview, Android
compatibility, missing deployment evidence, and external closeout separate.

Return only a grounding report containing capabilities/files inspected, exact
live Git versus the recorded snapshot, evidence classes, authority
inconsistencies, and the next authorization boundary. The immediate boundary
is a separate owner authorization for a bounded read-only operational recheck
and decision on the extra Supabase scene/freeze and canonical session state.
Only after that gate is green or explicitly accepted is the later boundary a
separate owner authorization to plan and implement the participant-facing
public FAQ page. Do not plan fixes, run verification, contact a vendor, or
implement anything during grounding. After the grounding report, stop and wait
for the owner. Final Milestone 12 disposition remains external. Deployment is
not authorized by this prompt. This context-only prompt authorizes none of
those actions. Do not infer that implementation, Git mutation, vendor work, or
deployment is authorized.
```

## Historical Codex Grounding Prompt (2026-08-24 pre-e481d03; superseded; do not use)

```text
Repository: C:\Users\FROST.GG\Desktop\CampuSphere v1

You are Codex for CampuSphere: senior reviewer, security/DB/UI quality gate,
handoff owner, and delivery coordinator.

This is a fresh context-only grounding session that does not authorize
implementation or review. Change nothing. Do not edit, format, create, delete, move, stage,
commit, amend, stash, reset, clean, tag, push, promote, deploy, link Vercel,
alter Google OAuth, apply SQL, access or mutate either database, clear sessions,
invoke Cloudinary/Upstash management APIs, create migration 0020, start a
server, use a browser, or run tests, QA, probes, audits, manifests, or smoke
checks. Do not copy credentials, participant PII, developer-contact emails,
database identifiers, backup paths, Search Console verification artifacts,
signed URLs, or secrets into Git or the report.

Capability grounding:
- Inventory the skills, plugins, apps, MCP servers, and tools actually
  available in this session.
- Load and follow the installed code-reviewer skill completely before any
  later code, security, database, UI, quality, deployment, or GO/NO-GO finding.
- Use context-mode or an equivalent read-only large-file tool for long files
  when available. Browser/Chrome/Playwright availability is not authorization.
- Report missing named capabilities and use only a safe read-only fallback.

Read completely and in this order:
1. CODEX_HANDOFF.md
2. CLAUDE_HANDOFF.md
3. plan.md, especially Current Release Continuity, M12 interfaces, anti-scope,
   assumptions, backup/restore, and data-cutover notes
4. ROADMAP.md, especially privacy/pilot/release gates, OFF.2-OFF.6,
   Milestones 12-13, blockers, and recommended order
5. AGENTS.md
6. CLAUDE.md
7. docs/deployment.md, docs/security-checklist.md, docs/test-evidence.md,
   docs/demo-script.md, and docs/new-session-grounding-prompts.md
8. package.json, package-lock.json, .env.example, docker-compose.yml,
   .vercelignore, vercel.json, config/selectedDemoFreeze.js, and the package
   and deployment-boundary probes
9. controllers/authController.js, controllers/profileController.js,
   middleware/profilePhotoUpload.js, services/profileImageService.js,
   utils/googleProfileImage.js, config/cloudinary.js, routes/auth.js,
   views/auth.ejs, views/complete-registration.ejs,
   public/js/profile-script.js, repositories/userRepository.js,
   scripts/googleProfileImage-probe.js, and
   scripts/profilePhotoUpload-probe.js
10. controllers/notificationController.js,
    services/notificationFeedService.js, routes/dashboard.js,
    public/js/notification-panel.js, views/partials/dash-navbar.ejs,
    the shared notification CSS, views/admin/news.ejs,
    views/admin/campus-map.ejs, views/admin/users.ejs, their admin scripts,
    scripts/notificationPanel-probe.js, and
    scripts/adminCategoryDropdown-probe.js
11. views/vr.ejs, views/vr-route.ejs,
    public/js/vr-hotspot-navigation.js, views/partials/theme-toggle.ejs,
    scripts/vrHotspotNavigation-probe.js, scripts/vrTheme-probe.js,
    views/map.ejs, routes/map.js, controllers/mapController.js,
    services/routeAvailability.js, config/mapRuntime.js,
    repositories/routeRepository.js, and route-geometry/admin helpers
12. public/offline.html, public/css/offline.css,
    public/js/offline-guide-manager.js, public/sw.js,
    controllers/offlineGuideController.js, services/offlineGuideService.js,
    views/about.ejs, scripts/with-server.js, and relevant source-only
    offline/map probes
13. scripts/syncSupabaseContentToMysql.js, its fail-closed apply boundary,
    its protected-table exclusions, and the recorded dry-run evidence only
14. scripts/quality-gates.js and the docs-current, notification, admin,
    VR, map/offline, auth/profile, package, routing, course, and
    legacy-course-preservation assertions
15. every database/supabase migration filename and read-only Git truth:
    branch, HEAD, origin/main, remote main, status, staged/unstaged/untracked
    paths, stashes, safety refs, and recent graph

Reconcile these operative facts against live truth, which wins:
- Accepted history remains Milestones 8-11, RF.1-RF.6, BE.1-BE.6, OFF.1,
  M12.P1 R1-R7, D1-D5, expanded D7, D6, and OFF.2-OFF.6 complete and Codex GO.
  R6 and R7 are complete and Codex GO. Following the accepted 2026-07-22
  dependency closeout, the subsequent 2026-07-26 advisory drift was
  remediated; dependency-security remediation is complete and Codex GO:
  production pins ejs@6.0.1, the
  jake/filelist/minimatch/brace-expansion chain is absent, and npm audit
  --omit=dev records zero vulnerabilities. Accepted R7 evidence is focused
  71/71, in-suite 70/70,
  and 3495/3495 with QUALITY-GATES OK and audit zero; 3492/3492 and 3494/3494
  are superseded. Accepted D7 evidence is the fresh-context BrowserContext run
  at 3511/3511 with QUALITY-GATES OK, audit zero, and
  24/24 -> 18/18 -> 46/46 with fingerprint
  a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d.
- Release lineage is
  d786bdcb83a196c7263dceae668417d3ced3e95a ->
  c00db76c5be0fe9c8dfdc8168a4c4303c6a0aa64 ->
  bb17b9b603583bcc2934e3ffab1cbdcb7d6b0ddd ->
  dc961b1eeba191d79b96998d96f0a49dac3ffcf8.
- At this synchronization's start, main/HEAD/origin/main/remote main matched
  dc961b1. The index was empty; exactly 58 modified tracked paths and exactly
  12 untracked paths made 70 dirty paths total, with zero stashes. Eleven
  authority documents plus scripts/quality-gates.js are the 12 tracked
  authority/static-assertion surfaces; the other 46 tracked paths and all 12
  untracked paths belong to the current uncommitted implementation. The safety
  branch backup-pre-trailer-strip pointed to
  d387c9151f1582cc4a8fc80002be52e11956335f. Preserve this worktree exactly
  and recompute all of this live.
- The exact untracked paths at synchronization were
  controllers/notificationController.js, middleware/profilePhotoUpload.js,
  public/js/notification-panel.js, scripts/adminCategoryDropdown-probe.js,
  scripts/googleProfileImage-probe.js, scripts/notificationPanel-probe.js,
  scripts/profilePhotoUpload-probe.js,
  scripts/syncSupabaseContentToMysql.js, scripts/vrTheme-probe.js,
  services/notificationFeedService.js, services/profileImageService.js, and
  utils/googleProfileImage.js. Treat any live difference as an inconsistency,
  not permission to delete, stage, or normalize it.
- Accepted bb17b9b release evidence remains the independently reviewed 12
  files and 1,854,481 bytes authority manifest SHA-256
  1c5ed249dd21894a2cb0871a04fc650deebfe2fa790b7e260d123415a4aa45c7,
  release package 168 files and 7,074,195 bytes, aggregate SHA-256
  13cd3c5e5d8259766e50b1136c8cc8a5672b2321c65962892358c62b45ef88f5,
  npm test exit 0 with QUALITY-GATES OK, npm run qa exit 0 with
  DB-PERF-GATE OK, [supabase-smoke] PASS, IDENTITY-CONSTRAINTS OK, and found
  0 vulnerabilities, bounded Chrome acceptance in Supabase and MySQL modes,
  final 24/24 -> 18/18 -> 46/46 postconditions, and an independent clean-commit
  R8 review that returned GO with no critical/high/medium/low findings.
- The owner authorized the bb17b9b push and manual Vercel promotion.
  Owner-observed Vercel evidence showed Ready, blue Production, main, and an
  11-second build.
- The owner supplied 29 official course titles plus Other. dc961b1 added an
  accessible, case-insensitive course search to OAuth registration completion
  and the student profile editor. Existing saved legacy course values remain
  visible until deliberately changed. The submitted field remains course;
  controllers, repositories, APIs, database schema, and migrations did not
  change. The six-file commit recorded 433 insertions and 28 deletions.
- Course-feature verification recorded npm test exit 0 with QUALITY-GATES OK
  and five-stage npm run qa exit 0 with QUALITY-GATES OK, DB-PERF-GATE OK,
  [supabase-smoke] PASS, IDENTITY-CONSTRAINTS OK, and zero audit
  vulnerabilities. The package-boundary run passed 74/74 and reported a
  then-current working-tree package of 168 files,
  7,088,275 bytes, SHA-256
  9849e3c18c70e54a3502217275724367945ff176be22ce4d20796b5c103dc9ec.
  The working-tree package identity is not clean-commit or deployed-byte proof.
- dc961b1 was pushed and separately promoted by the owner. The owner confirmed
  the registration and profile course flows work in Production. This is
  owner-observed functional acceptance, not independent review, byte smoke, or
  a new GO/NO-GO.
- No independent anonymous GET-only post-promotion byte verification has been
  recorded for bb17b9b or dc961b1. fea3b2e11c6331eddc1ee091b165427d8e0218d7
  remains the last independently post-deployment-verified technical baseline;
  its smoke is not byte proof for either later commit.
- Google OAuth is now owner-observed In production and still requests only
  openid email profile. Data Access reported that sensitive or
  restricted-scope verification is not required, and the owner confirmed
  Google account creation and sign-in work. Branding is not verified; Search
  Console ownership was not completed, and the owner chose to defer branding.
  Do not describe OAuth as verified or unlimited. Public local registration
  still creates guests only.
- Production uses Supabase/PostgreSQL for application data and sessions; MySQL
  remains local-development/fallback/rehearsal data. The production offline guide
  is a backend-specific immutable snapshot of Supabase building/route data and
  excludes 360/Guided-VR/Free-Roam content, schedules, building photos,
  Cloudinary media, and private/admin/session data.
- The readiness poll uses /favicon.ico. The supported cleanup destroyed 309
  harness-shaped anonymous MySQL sessions with fingerprint
  a50b800e370439e0257cb7667d3fdb567af9dab88b87c3aeca6f32593598d18d and
  left zero candidates and zero scanned residue. Migration sources are
  contiguous through 0020; owner-applied 0020_room_schedule_documents.sql is
  recorded before this verification. Preserve 109/109 verified backup/restore
  files and 86 referenced Cloudinary assets.
  The owner-attested 2026-08-05 human pilot had zero reported findings;
  Participant/Form evidence remains external, full source-commit identity was
  not independently verified, and pilot review is complete for sequencing.
- The current uncommitted candidate is a stabilization candidate that includes
  the semester room-schedule image flow, owner-applied
  0020_room_schedule_documents.sql, admin-pasted Cloudinary delivery metadata,
  accessible image viewing, direct VR schedule-document links, valid Guided-VR
  and Free Roam scene arrows, VR light/dark theme parity, compact
  online/offline building pins, the offline display label Guard House, the
  authenticated notification feed/panel, cross-page styling, the Paga About
  card, admin category-dropdown styling and user role/status filters, safe
  Google profile-image synchronization, and removal of the manual
  profile-photo upload. The candidate never calls Cloudinary management or
  upload APIs.
- The owner-run scripts/syncSupabaseContentToMysql.js --dry-run was read-only,
  reported no differences, and recorded equal fingerprints
  2504a0474b0481964d447f5f538b9e4e1cd77ef0116c4299c12d0a81eae5bf05.
  No data was written; no sync apply, backup, restore, or current database
  verification is claimed. The Android 8 installed-PWA crash remains
  unresolved and Docker/client-clone deployment readiness also remains
  deferred.
- A fresh session grounds first; a later separately authorized session
  verifies the non-Cloudinary changes. Cloudinary support remains an external
  event-based dependency. If no response has arrived, continue with verified
  non-Cloudinary findings one bounded issue at a time. Manual Cloudinary upload
  stays deferred. Grounding prompts do not themselves authorize tests. Do not
  create or enable privileged keys, retry vendor role changes, perform a live
  upload, or fix findings under this grounding prompt. Missing current full
  QA, independent review, commit, push, deployment, and Production acceptance
  remain explicit. This authority authorizes no product implementation.

Keep accepted historical release/R8 evidence, course-feature verification,
live Git, the uncommitted candidate, previously reported focused/source
checks, owner-observed localhost acceptance, the read-only sync preview,
the pending Cloudinary blocker, the unresolved Android installed-PWA
observation, owner-observed Vercel/Production and OAuth facts, missing
independent dc961b1 byte verification, and missing current full
QA/review/commit/deployment evidence as separate evidence classes.

Return only: capabilities and files inspected; exact live Git truth versus this
record; evidence classification; authority inconsistencies; and the next
authorization boundary. The next boundary is a separate owner authorization
to verify the non-Cloudinary changes. Do not perform a code review, compute a
manifest, run verification, issue a GO/NO-GO, contact Cloudinary, or infer
implementation. Stop and wait for the owner.
Final Milestone 12 disposition remains external. Deployment is not authorized
by this prompt. This context-only prompt authorizes none of those actions. Do
not infer that implementation, Git mutation, vendor work, or deployment is
authorized.
```

## Historical Claude Code Grounding Prompt (2026-08-24 pre-e481d03; superseded; do not use)

```text
Repository: C:\Users\FROST.GG\Desktop\CampuSphere v1

You are Claude Code acting as CampuSphere's implementation partner and evidence
recorder. Codex remains the independent review/quality gate, and the owner
controls Git, database, vendor, OAuth, and deployment decisions.

This is a fresh context-only grounding session that does not authorize
implementation. Do not review, edit, test, implement, stage, commit, push,
deploy, promote, or perform a closeout review. Change nothing. Do not review,
edit, format, create, delete, move, implement, stage, commit, amend, stash,
reset, clean, tag, push, deploy, promote, link Vercel, alter Google OAuth,
apply SQL, access or mutate either database, clear sessions, invoke
Cloudinary/Upstash management APIs, create migration 0020, start a server, use
a browser, or run tests, QA, probes, audits, manifests, or smoke checks. Do not
record credentials, participant PII, developer-contact emails, database
identifiers, backup paths, Search Console verification artifacts, signed URLs,
or secrets.

Inventory the skills, plugins, apps, MCP servers, and tools actually available.
Load and follow the installed code-reviewer skill completely before any later
code, security, database, UI, quality, deployment, or GO/NO-GO finding.
Use context-mode or an equivalent read-only large-file tool when available.
Report missing named capabilities and use a read-only fallback. Browser,
Chrome, or Playwright availability is not authorization.

Read completely and in this order:
1. CLAUDE_HANDOFF.md
2. CODEX_HANDOFF.md
3. plan.md
4. ROADMAP.md
5. CLAUDE.md
6. AGENTS.md
7. docs/deployment.md, docs/security-checklist.md, docs/test-evidence.md,
   docs/demo-script.md, and docs/new-session-grounding-prompts.md
8. package.json, package-lock.json, .env.example, docker-compose.yml,
   .vercelignore, vercel.json, config/selectedDemoFreeze.js, and the package
   and deployment-boundary probes
9. controllers/authController.js, controllers/profileController.js,
   middleware/profilePhotoUpload.js, services/profileImageService.js,
   utils/googleProfileImage.js, config/cloudinary.js, routes/auth.js,
   views/auth.ejs, views/complete-registration.ejs,
   public/js/profile-script.js, repositories/userRepository.js,
   scripts/googleProfileImage-probe.js, and
   scripts/profilePhotoUpload-probe.js
10. controllers/notificationController.js,
    services/notificationFeedService.js, routes/dashboard.js,
    public/js/notification-panel.js, views/partials/dash-navbar.ejs,
    the shared notification CSS, views/admin/news.ejs,
    views/admin/campus-map.ejs, views/admin/users.ejs, their admin scripts,
    scripts/notificationPanel-probe.js, and
    scripts/adminCategoryDropdown-probe.js
11. views/vr.ejs, views/vr-route.ejs,
    public/js/vr-hotspot-navigation.js, views/partials/theme-toggle.ejs,
    scripts/vrHotspotNavigation-probe.js, scripts/vrTheme-probe.js,
    views/map.ejs, routes/map.js, controllers/mapController.js,
    services/routeAvailability.js, config/mapRuntime.js,
    repositories/routeRepository.js, and route-geometry/admin helpers
12. public/offline.html, public/css/offline.css,
    public/js/offline-guide-manager.js, public/sw.js,
    controllers/offlineGuideController.js, services/offlineGuideService.js,
    views/about.ejs, scripts/with-server.js, and relevant source-only
    offline/map probes
13. scripts/syncSupabaseContentToMysql.js, its fail-closed apply boundary,
    its protected-table exclusions, and the recorded dry-run evidence only
14. scripts/quality-gates.js and the docs-current, notification, admin,
    VR, map/offline, auth/profile, package, routing, course, and
    legacy-course-preservation assertions
15. every database/supabase migration filename and read-only Git truth:
    branch, HEAD, origin/main, remote main, status, staged/unstaged/untracked
    paths, stashes, safety refs, and recent graph

Reconcile these facts against live truth:
- Accepted history remains Milestones 8-11, RF.1-RF.6, BE.1-BE.6, OFF.1,
  M12.P1 R1-R7, D1-D5, expanded D7, D6, and OFF.2-OFF.6 complete and Codex GO.
  R6 and R7 are complete and Codex GO. Following the accepted 2026-07-22
  dependency closeout, the subsequent 2026-07-26 advisory drift was
  remediated; dependency-security remediation is complete and Codex GO:
  production pins ejs@6.0.1, the
  jake/filelist/minimatch/brace-expansion chain is absent, and npm audit
  --omit=dev records zero vulnerabilities. Accepted R7 evidence is 71/71,
  70/70, and 3495/3495
  with QUALITY-GATES OK and audit zero; 3492/3492 and 3494/3494 are
  historical/superseded. Accepted D7 evidence is the
  fresh-context BrowserContext run at 3511/3511 with QUALITY-GATES OK, audit
  zero, and
  24/24 -> 18/18 -> 46/46 with fingerprint
  a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d.
- Release lineage is
  d786bdcb83a196c7263dceae668417d3ced3e95a ->
  c00db76c5be0fe9c8dfdc8168a4c4303c6a0aa64 ->
  bb17b9b603583bcc2934e3ffab1cbdcb7d6b0ddd ->
  dc961b1eeba191d79b96998d96f0a49dac3ffcf8.
- At this synchronization's start, main/HEAD/origin/main/remote main matched
  dc961b1. The index was empty; exactly 58 modified tracked paths and exactly
  12 untracked paths made 70 dirty paths total, with zero stashes. Eleven
  authority documents plus scripts/quality-gates.js are the 12 tracked
  authority/static-assertion surfaces; the other 46 tracked paths and all 12
  untracked paths belong to the current uncommitted implementation. The safety
  branch backup-pre-trailer-strip pointed to
  d387c9151f1582cc4a8fc80002be52e11956335f. Preserve this worktree exactly
  and recompute all of this live.
- The exact untracked paths at synchronization were
  controllers/notificationController.js, middleware/profilePhotoUpload.js,
  public/js/notification-panel.js, scripts/adminCategoryDropdown-probe.js,
  scripts/googleProfileImage-probe.js, scripts/notificationPanel-probe.js,
  scripts/profilePhotoUpload-probe.js,
  scripts/syncSupabaseContentToMysql.js, scripts/vrTheme-probe.js,
  services/notificationFeedService.js, services/profileImageService.js, and
  utils/googleProfileImage.js. Treat any live difference as an inconsistency,
  not permission to delete, stage, or normalize it.
- Accepted bb17b9b evidence remains its reviewed 12 files and 1,854,481 bytes
  manifest SHA-256
  1c5ed249dd21894a2cb0871a04fc650deebfe2fa790b7e260d123415a4aa45c7,
  release package 168 files and 7,074,195 bytes, aggregate SHA-256
  13cd3c5e5d8259766e50b1136c8cc8a5672b2321c65962892358c62b45ef88f5,
  npm test exit 0 with QUALITY-GATES OK, npm run qa exit 0 with
  DB-PERF-GATE OK, [supabase-smoke] PASS, IDENTITY-CONSTRAINTS OK, found 0
  vulnerabilities, bounded Chrome acceptance in Supabase and MySQL modes,
  24/24 -> 18/18 -> 46/46, and an independent clean-commit R8 review that
  returned GO with no critical/high/medium/low findings.
- The owner authorized the bb17b9b push and manual Vercel promotion.
  Owner-observed Vercel evidence showed Ready, Production, main, and an
  11-second build.
- The owner supplied 29 official course titles plus Other. dc961b1 added an
  accessible, case-insensitive course search to OAuth registration completion
  and the student profile editor. Existing saved legacy course values remain
  visible until deliberately changed. The submitted field remains course;
  controllers, repositories, APIs, database schema, and migrations did not
  change. The six-file commit recorded 433 insertions and 28 deletions.
- Course-feature verification recorded npm test exit 0 with QUALITY-GATES OK
  and five-stage npm run qa exit 0 with QUALITY-GATES OK, DB-PERF-GATE OK,
  [supabase-smoke] PASS, IDENTITY-CONSTRAINTS OK, and zero audit
  vulnerabilities. The package-boundary run passed 74/74 and reported a
  then-current working-tree package of 168 files, 7,088,275 bytes, SHA-256
  9849e3c18c70e54a3502217275724367945ff176be22ce4d20796b5c103dc9ec.
  The working-tree package identity is not clean-commit or deployed-byte proof.
- dc961b1 was pushed and separately promoted by the owner. The owner confirmed
  the registration and profile course flows work in Production. Treat this as
  owner-observed functional acceptance only.
- No independent anonymous GET-only post-promotion byte verification has been
  recorded for bb17b9b or dc961b1. fea3b2e11c6331eddc1ee091b165427d8e0218d7
  remains the last independently post-deployment-verified technical baseline;
  its smoke is not byte proof for either later commit.
- Google OAuth is now owner-observed In production and requests only
  openid email profile. Data Access reported that sensitive or
  restricted-scope verification is not required, and the owner confirmed
  Google account creation and sign-in work. Branding is not verified; Search
  Console ownership was not completed, and the owner chose to defer branding.
  Do not describe OAuth as verified or unlimited. Public local registration
  still creates guests only.
- Production uses Supabase/PostgreSQL for application data and sessions; MySQL
  remains local-development/fallback/rehearsal data. The production offline guide
  is a backend-specific immutable snapshot of Supabase building/route data and
  excludes 360/Guided-VR/Free-Roam content, schedules, building photos,
  Cloudinary media, and private/admin/session data.
- The readiness poll uses /favicon.ico. The supported cleanup destroyed 309
  harness-shaped anonymous MySQL sessions with fingerprint
  a50b800e370439e0257cb7667d3fdb567af9dab88b87c3aeca6f32593598d18d and
  left zero candidates and zero scanned residue. Migration sources are
  contiguous through 0020; owner-applied 0020_room_schedule_documents.sql is
  recorded before this verification. Preserve 109/109 verified backup/restore
  files and 86 referenced Cloudinary assets.
  The owner-attested 2026-08-05 human pilot had zero reported findings;
  Participant/Form evidence remains external, full source-commit identity was
  not independently verified, and pilot review is complete for sequencing.
- The current uncommitted candidate is a stabilization candidate that includes
  the semester room-schedule image flow, owner-applied
  0020_room_schedule_documents.sql, admin-pasted Cloudinary delivery metadata,
  accessible image viewing, direct VR schedule-document links, valid Guided-VR
  and Free Roam scene arrows, VR light/dark theme parity, compact
  online/offline building pins, the offline display label Guard House, the
  authenticated notification feed/panel, cross-page styling, the Paga About
  card, admin category-dropdown styling and user role/status filters, safe
  Google profile-image synchronization, and removal of the manual
  profile-photo upload. The candidate never calls Cloudinary management or
  upload APIs.
- The owner-run scripts/syncSupabaseContentToMysql.js --dry-run was read-only,
  reported no differences, and recorded equal fingerprints
  2504a0474b0481964d447f5f538b9e4e1cd77ef0116c4299c12d0a81eae5bf05.
  No data was written; no sync apply, backup, restore, or current database
  verification is claimed. The Android 8 installed-PWA crash remains
  unresolved and Docker/client-clone deployment readiness also remains
  deferred.
- A fresh session grounds first; a later separately authorized session
  verifies the non-Cloudinary changes. Cloudinary support remains an external
  event-based dependency. If no response has arrived, continue with verified
  non-Cloudinary findings one bounded issue at a time. Manual Cloudinary upload
  stays deferred. Grounding prompts do not themselves authorize tests. Do not
  create or enable privileged keys, retry vendor role changes, perform a live
  upload, or fix findings under this grounding prompt. Missing current full
  QA, independent review, commit, push, deployment, and Production acceptance
  remain explicit. This authority authorizes no product implementation.

Return only a grounding report containing capabilities/files, exact live Git,
evidence classes, inconsistencies, blockers, and the next authorization. The
next boundary is a separate owner authorization to verify the non-Cloudinary
changes. Do not plan fixes, run verification, contact Cloudinary, or implement
anything during grounding. After the grounding report, stop and wait for the
owner.
Final Milestone 12 disposition remains external. Deployment is not authorized
by this prompt. This context-only prompt authorizes none of those actions. Do
not infer that implementation, Git mutation, vendor work, or deployment is
authorized.
```

## Historical Codex Grounding Prompt (2026-08-22 pre-course, superseded; do not use)

```text
Repository: C:\Users\FROST.GG\Desktop\CampuSphere v1

You are Codex for CampuSphere: senior reviewer, security/DB/UI quality gate,
handoff owner, and delivery coordinator.

This is a fresh context-only grounding session that does not authorize
implementation or review. Change nothing. Do not edit, format, create, delete,
move, stage, commit, amend, stash, reset, clean, tag, push, promote, deploy,
link Vercel, alter Google OAuth, apply SQL, access or mutate either database,
clear sessions, invoke Cloudinary/Upstash management APIs, create migration
0020, start a server, use a browser, or run tests, QA, probes, audits, or smoke
checks. Do not copy credentials, participant PII, database identifiers, backup
paths, signed URLs, or secrets into Git or the report.

Capability grounding:
- Inventory the skills, plugins, apps, MCP servers, and tools actually available
  in this new session; do not assume the authoring session's capabilities still
  exist.
- Load and follow the installed code-reviewer skill completely before any code,
  security, database, UI, quality, deployment, or GO/NO-GO finding.
- Use context-mode or an equivalent read-only large-file tool for long authority
  files when available. Chrome DevTools/Browser/Playwright availability is not
  authorization to use a browser.
- Report missing named capabilities and use only a safe read-only fallback.

Read completely and in this order:
1. CODEX_HANDOFF.md
2. CLAUDE_HANDOFF.md
3. plan.md, especially the Current Release Continuity block, M12 interfaces,
   anti-scope, assumptions, backup/restore, and data-cutover notes
4. ROADMAP.md, especially privacy/pilot/release gates, OFF.2-OFF.6,
   Milestones 12-13, blockers, and recommended order
5. AGENTS.md
6. CLAUDE.md
7. docs/deployment.md, docs/security-checklist.md, docs/test-evidence.md,
   docs/demo-script.md, and docs/new-session-grounding-prompts.md
8. package.json, package-lock.json, .vercelignore, vercel.json,
   config/selectedDemoFreeze.js, and scripts/vercelPackageBoundary-probe.js
9. public/offline.html, public/css/offline.css,
   public/js/offline-guide-manager.js, public/sw.js, views/map.ejs,
   routes/map.js, controllers/offlineGuideController.js,
   services/offlineGuideService.js, and scripts/with-server.js
10. scripts/off2PwaLifecycle-probe.js, scripts/offline2dNavigation-probe.js,
    scripts/quality-gates.js, services/auditService.js, server.js,
    public/css/styles.css, and public/js/profile-script.js
11. controllers/authController.js, routes/auth.js, views/auth.ejs,
    views/complete-registration.ejs, repositories/userRepository.js, and the
    profile controller/repository surfaces before discussing course work
12. services/routeAvailability.js, config/mapRuntime.js, the building/route/VR/
    schedule repositories, and supported admin controllers/routes
13. every database/supabase migration filename and read-only Git truth:
    branch, HEAD, origin/main, remote main, status, staged/unstaged/untracked
    paths, stashes, safety refs, and recent graph

Reconcile these operative facts against live truth, which wins:
- Accepted history remains Milestones 8-11, RF.1-RF.6, BE.1-BE.6, OFF.1,
  M12.P1 R1-R7, D1-D5, and expanded D7 complete and Codex GO; D6 and
  OFF.2-OFF.6 are also complete and Codex GO. R6 is complete and Codex GO; R7
  is complete and Codex GO. Dependency-security remediation is complete and
  Codex GO: the subsequent 2026-07-26 advisory drift was remediated, production pins ejs@6.0.1, the
  jake/filelist/minimatch/brace-expansion chain is absent, and the accepted
  npm audit --omit=dev result is zero vulnerabilities. Accepted R7 evidence is
  focused 71/71, in-suite package boundary 70/70, and 3495/3495 with
  QUALITY-GATES OK with npm audit --omit=dev at zero vulnerabilities; 3492/3492
  and 3494/3494 are historical/superseded. Accepted D7 evidence is the
  fresh-context BrowserContext run at 3511/3511 with QUALITY-GATES OK, audit
  zero, and 24/24 -> 18/18 -> 46/46 with fingerprint
  a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d.
- Release lineage: d786bdcb83a196c7263dceae668417d3ced3e95a ->
  c00db76c5be0fe9c8dfdc8168a4c4303c6a0aa64 ->
  bb17b9b603583bcc2934e3ffab1cbdcb7d6b0ddd.
- Pre-handoff-sync Git was clean main with HEAD/origin/main/remote main at
  bb17b9b603583bcc2934e3ffab1cbdcb7d6b0ddd, a clean index/worktree, zero
  untracked paths, and zero stashes. The handoff synchronization itself is
  later uncommitted documentation/static-assertion synchronization, so
  recompute current status and do not assume clean state.
- The reviewed bb17b9b authority delta was 12 files, 1,854,481 bytes, manifest
  SHA-256 1c5ed249dd21894a2cb0871a04fc650deebfe2fa790b7e260d123415a4aa45c7.
  The release package pin was 168 files, 7,074,195 bytes, aggregate SHA-256
  13cd3c5e5d8259766e50b1136c8cc8a5672b2321c65962892358c62b45ef88f5.
- Replacement verification passed: npm test exit 0 with QUALITY-GATES OK;
  five-stage npm run qa exit 0 with QUALITY-GATES OK, DB-PERF-GATE OK,
  [supabase-smoke] PASS, IDENTITY-CONSTRAINTS OK, and found 0 vulnerabilities;
  bounded Chrome
  acceptance passed in Supabase and MySQL modes; final postconditions were
  24/24 -> 18/18 -> 46/46.
- The independent clean-commit R8 review of bb17b9b returned GO with no
  critical/high/medium/low findings. The owner separately authorized the push;
  it completed and Git remote parity was confirmed.
- The owner completed the manual Vercel promotion of bb17b9b. Owner-observed Vercel evidence showed
  Ready, blue Production, main, and an 11-second build. This is owner-observed
  vendor evidence, not an independent byte/status smoke.
- No independent anonymous GET-only post-promotion verification of bb17b9b is
  recorded. The fea3b2e11c6331eddc1ee091b165427d8e0218d7 smoke is the last
  independently post-deployment-verified technical baseline and applies only
  to that earlier source; it is not byte proof for bb17b9b.
- Production uses Supabase/PostgreSQL for application data and sessions;
  MySQL remains local-development/fallback/rehearsal data.
  A production offline-guide download is a backend-specific immutable snapshot
  of current Supabase building/route data. Offline is
  2D/Main-Gate/text-details only and excludes 360/Guided-VR/Free-Roam content,
  schedules, building photos, Cloudinary media, and private/admin/session data.
- The readiness poll now uses /favicon.ico. The local cleanup destroyed 309
  harness-shaped anonymous MySQL sessions with cleanup fingerprint SHA-256
  a50b800e370439e0257cb7667d3fdb567af9dab88b87c3aeca6f32593598d18d and
  left zero candidates and zero scanned residue. Do not infer another cleanup.
  Migrations remain exactly 0001-0019; migration 0020 does not exist and is not
  authorized.
- Preserve one-writer control and external backup evidence: 109/109 manifest files verified,
  successful isolated Supabase/MySQL restores, and 86 referenced Cloudinary
  delivery assets hashed; this was not a management/original-account export.
- The owner-attested 2026-08-05 human pilot is accepted with zero reported
  findings. Participant/Form evidence remains external and the tested build's
  full source-commit identity was not independently verified; pilot review is
  complete for sequencing only.
- Google OAuth remains owner-observed Testing with the 100-user test cap.
  Publishing or verification has not been performed or authorized by this
  prompt; it is a separate Google Cloud action.
- Student course selection currently lists BS Information Technology,
  BS Computer Science, BS Civil Engineering, BS Electrical Engineering,
  BS Industrial Technology, BS Entrepreneurship, and Other. The list is
  duplicated in views/complete-registration.ejs and
  public/js/profile-script.js. Public local registration creates guests only;
  student/instructor trust comes from CSPC Google OAuth. No authoritative full
  CSPC course catalog has been supplied, so do not invent or implement one.

Evidence classes must remain separate: accepted historical evidence,
replacement-verification evidence, independent R8 evidence, live Git truth,
owner-observed Vercel promotion evidence, and the missing new post-promotion
smoke. Do not upgrade one class into another.

After grounding, return only: capabilities and files inspected; exact live Git
truth versus the pre-sync record; evidence classification; any authority
inconsistency; and the next authorization boundary. The immediate boundary is
a separately authorized bounded anonymous read-only GET-only production check
against bb17b9b, avoiding /auth, authentication, cookies/sessions, schedules,
and mutation. OAuth publishing and course-catalog work are later separate
owner-authorized workstreams.

Do not perform a code review, compute a candidate manifest, run verification,
or issue a new GO/NO-GO. Do not infer that further implementation, another
pilot, Git mutation, or deployment is authorized. Vendor mutation is not
authorized. Deployment is not authorized by this prompt. Final Milestone 12 disposition remains
external. This context-only prompt authorizes none of those actions. Stop and
wait for the owner.
```

## Historical Claude Code Grounding Prompt (2026-08-22 pre-course, superseded; do not use)

```text
Repository: C:\Users\FROST.GG\Desktop\CampuSphere v1

You are Claude Code acting as CampuSphere's implementation partner and evidence
recorder. Codex remains the independent quality/review gate, and the owner
controls every Git, database, vendor, OAuth, and deployment decision.

This is a fresh context-only grounding session that does not authorize
implementation. Change nothing. Do not review, edit, test, implement, stage,
commit, push, deploy, promote, or perform a closeout review. Do not format,
create, delete, move, amend, stash, reset, clean, tag, link Vercel, alter Google
OAuth, apply SQL, access or mutate either database, clear sessions, invoke
Cloudinary/Upstash management APIs, create migration 0020, start a server, use
a browser, or run tests, QA, probes, audits, or smoke checks. Do not record
credentials, participant PII, database identifiers, backup paths, signed URLs,
or secrets.

Inventory the skills, plugins, apps, MCP servers, and tools actually available.
Use context-mode or an equivalent read-only large-file tool when available.
Do not assume Chrome/Playwright/browser access exists, and availability would
not authorize its use. If an installed reviewer capability would write files or
run forbidden commands, disclose that and do not invoke it.

Read completely in this order:
1. CLAUDE_HANDOFF.md
2. CODEX_HANDOFF.md
3. plan.md
4. ROADMAP.md
5. CLAUDE.md
6. AGENTS.md
7. docs/deployment.md, docs/security-checklist.md, docs/test-evidence.md,
   docs/demo-script.md, and docs/new-session-grounding-prompts.md
8. package.json, package-lock.json, .vercelignore, vercel.json,
   config/selectedDemoFreeze.js, and scripts/vercelPackageBoundary-probe.js
9. public/offline.html, public/css/offline.css,
   public/js/offline-guide-manager.js, public/sw.js, views/map.ejs,
   routes/map.js, controllers/offlineGuideController.js,
   services/offlineGuideService.js, scripts/with-server.js, and their focused
   offline/package probes, source-read only
10. controllers/authController.js, routes/auth.js, views/auth.ejs,
    views/complete-registration.ejs, public/js/profile-script.js,
    controllers/profileController.js, and repositories/userRepository.js
11. services/routeAvailability.js, config/mapRuntime.js, building/route/VR/
    schedule repositories, supported admin surfaces, and every migration
    filename
12. read-only Git truth: branch, HEAD, origin/main, remote main, status,
    staged/unstaged/untracked paths, stashes, safety refs, and recent graph

Reconcile the following with live truth:
- Accepted history remains Milestones 8-11, RF.1-RF.6, BE.1-BE.6, OFF.1,
  M12.P1 R1-R7, D1-D5, and expanded D7 complete and Codex GO; D6 and
  OFF.2-OFF.6 are also complete and Codex GO. R6 is complete and Codex GO; R7
  is complete and Codex GO. Dependency-security remediation is complete and
  Codex GO: the subsequent 2026-07-26 advisory drift was remediated, production pins ejs@6.0.1, the
  jake/filelist/minimatch/brace-expansion chain is absent, and npm audit
  --omit=dev records zero vulnerabilities. Accepted R7 evidence is 71/71
  focused, 70/70 in-suite, and 3495/3495 with QUALITY-GATES OK and npm audit
  --omit=dev at zero vulnerabilities; 3492/3492 and 3494/3494 are
  historical/superseded. Accepted D7 evidence is the fresh-context
  BrowserContext run at 3511/3511 with QUALITY-GATES OK, audit zero, and
  24/24 -> 18/18 -> 46/46 with fingerprint
  a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d.
- d786bdcb83a196c7263dceae668417d3ced3e95a is the verified offline
  implementation, c00db76c5be0fe9c8dfdc8168a4c4303c6a0aa64 is the bounded
  readiness/session-maintenance correction, and
  bb17b9b603583bcc2934e3ffab1cbdcb7d6b0ddd is the final reviewed authority
  synchronization.
- Immediately before the new handoff edits, main/HEAD/origin/main/remote main
  matched bb17b9b with a clean index/worktree, zero untracked paths, and zero
  stashes. These handoff edits are a later uncommitted
  documentation/static-assertion synchronization; recompute live status.
- The reviewed 12-file bb17b9b delta was 1,854,481 bytes, manifest SHA-256
  1c5ed249dd21894a2cb0871a04fc650deebfe2fa790b7e260d123415a4aa45c7.
  Package identity was 168 files, 7,074,195 bytes, aggregate SHA-256
  13cd3c5e5d8259766e50b1136c8cc8a5672b2321c65962892358c62b45ef88f5.
- npm test exit 0 with QUALITY-GATES OK; five-stage npm run qa exited 0 with
  QUALITY-GATES OK, DB-PERF-GATE OK, [supabase-smoke] PASS,
  IDENTITY-CONSTRAINTS OK, and found 0 vulnerabilities; bounded Chrome
  acceptance completed in Supabase and MySQL modes; final
  24/24 -> 18/18 -> 46/46 postconditions passed. Independent clean-commit R8
  review returned GO with no critical/high/medium/low findings. The owner separately
  authorized the push, and push parity was confirmed.
- The owner completed the manual Vercel promotion of bb17b9b. Owner-observed
  dashboard evidence showed Ready, blue Production, main, and an 11-second build.
  No independent anonymous
  GET-only post-promotion verification for bb17b9b has been recorded.
- fea3b2e11c6331eddc1ee091b165427d8e0218d7 is only the last independently
  post-deployment-verified technical baseline; its smoke is not byte proof for
  bb17b9b.
- Production uses Supabase/PostgreSQL for application data and sessions;
  MySQL remains local-development/fallback/rehearsal data. A production
  offline-guide download is a backend-specific immutable snapshot of Supabase
  2D building/route data. It excludes 360/Guided-VR/Free-Roam content,
  schedules, building photos, Cloudinary media, and private/admin/session data.
- The readiness poll now uses /favicon.ico. The supported local cleanup
  destroyed 309 harness-shaped anonymous MySQL sessions with cleanup
  fingerprint SHA-256
  a50b800e370439e0257cb7667d3fdb567af9dab88b87c3aeca6f32593598d18d and left
  zero candidates and zero scanned residue. No cleanup, direct SQL, or
  mutation is authorized. Migrations remain exactly 0001-0019; migration 0020
  does not exist and is not authorized.
- Preserve one-writer control and external backup/restore evidence: 109/109
  manifest files verified, successful isolated Supabase/MySQL restores, and 86
  referenced Cloudinary delivery assets hashed without claiming a
  management/original-account export.
- The owner-attested 2026-08-05 human pilot is accepted with zero reported
  findings. Participant/Form evidence remains external and the tested
  build's full source-commit identity was not independently verified. Pilot
  review is complete for sequencing only.
- Google OAuth is still owner-observed in Testing with the 100-user test cap.
  Publishing or verification has not been performed or authorized by this
  prompt; it is a separate owner-controlled Google Cloud change.
- Student course selection currently lists BS Information Technology,
  BS Computer Science, BS Civil Engineering, BS Electrical Engineering,
  BS Industrial Technology, BS Entrepreneurship, and Other. The list is
  duplicated in views/complete-registration.ejs and
  public/js/profile-script.js. Public local registration creates guests only;
  trusted students/instructors use CSPC Google OAuth. No authoritative full
  CSPC course catalog has been supplied, so do not invent courses or implement
  the request.

Classify accepted history, replacement verification, independent R8, live Git,
owner-observed promotion, and missing post-promotion smoke separately. Older
pre-promotion sections retained below the Current Release Continuity blocks are
historical and lose to live truth plus the current block.

Return only a grounding report with capabilities/files, live Git truth,
evidence classes, inconsistencies, blockers, and next authorization. The next
boundary is a separately authorized anonymous read-only GET-only production
check of bb17b9b, avoiding /auth, login, cookies/sessions, schedules, and
mutation. OAuth publishing and the course-catalog implementation are later
separate workstreams.

After the grounding report, stop and wait for the owner; do not infer that
further implementation, deployment, Git mutation, or another pilot is
authorized. Vendor mutation is not authorized. Deployment is not authorized by this prompt. Final
Milestone 12 disposition remains external. This context-only prompt authorizes
none of those actions.
```

## Historical Pre-Promotion Authority Snapshot (superseded; do not use)

OFF.2-OFF.6 are complete and Codex GO on local commit
`cdbc863b779e5319c14dee21a31a5e78951e233c`. M12.P1-D6 is complete and Codex
GO on local commit `691f0bef40e06b6ea9485e713d2fe3000a03bd83`. The exact
19-file offline UI/accessibility/package implementation was independently fully
verified, committed as `d786bdcb83a196c7263dceae668417d3ced3e95a`, and pushed
to `origin/main`.

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
  2D `35/35`, and package boundary `74/74`; the unchanged package identity is
  168 files, 7,073,128 bytes, aggregate SHA-256
  `1d6cc68b7ef350b6a61eb8d84ea4fb7dd6862bd8548beb7595d3f2e6f4b10d6a`.
The `494010dd...` manifest is predecessor evidence for the committed
implementation, not a pin for the later documentation/static-assertion
correction. The correction is a separate byte set: live Git and the latest
independent external review report control its lifecycle and disposition, and
these grounding prompts do not claim that correction is reviewed, committed,
pushed, R8-approved, promoted, or deployed. Final Milestone 12 disposition
remains external. The accepted technical Production baseline remains
`fea3b2e11c6331eddc1ee091b165427d8e0218d7`; future `main` deployments require
explicit manual promotion, and deployment is not authorized by these prompts.

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

## Historical Codex Grounding Prompt (2026-08-21 pre-promotion, superseded; do not use)

```text
Repository: C:\Users\FROST.GG\Desktop\CampuSphere v1

You are Codex for CampuSphere: senior reviewer, security/DB/UI quality gate,
handoff owner, and delivery coordinator.

This is a fresh context-only grounding session that does not authorize
implementation or review. Change nothing. Do not edit,
format, create, delete, move, stage, commit, amend, stash, reset, clean, tag,
push, deploy, link Vercel, apply SQL, access or mutate either database, invoke
Cloudinary/Upstash management APIs, clear sessions, create migration 0020,
start a server, use a browser, or run tests, QA, probes, audits, or smoke checks.

Before reviewing, inventory the skills, plugins, apps, MCP servers, and tools
actually available. Load and follow the installed code-reviewer skill before
any code, security, database, UI, quality, deployment, or GO/NO-GO finding. Use
context-mode or an equivalent read-only large-file tool when helpful. Do not
assume a named capability exists; report missing capabilities and use only a
safe read-only fallback.

Read completely and in this order:
1. CODEX_HANDOFF.md
2. CLAUDE_HANDOFF.md
3. plan.md, especially current M12 status, interfaces/contracts, anti-scope,
   assumptions, backup/restore, and real-data cutover notes
4. ROADMAP.md, especially routing/privacy/pilot gates, OFF.2-OFF.6,
   Milestones 12-13, blockers, and recommended order
5. AGENTS.md
6. CLAUDE.md
7. docs/deployment.md, docs/security-checklist.md, docs/test-evidence.md, and
   docs/new-session-grounding-prompts.md
8. package.json, package-lock.json, .vercelignore, vercel.json,
   config/selectedDemoFreeze.js, and scripts/vercelPackageBoundary-probe.js
9. public/offline.html, public/css/offline.css,
   public/js/offline-guide-manager.js, public/sw.js, views/map.ejs,
   routes/map.js, controllers/offlineGuideController.js, and
   services/offlineGuideService.js
10. scripts/off2PwaLifecycle-probe.js, scripts/offline2dNavigation-probe.js,
    scripts/quality-gates.js, services/auditService.js, server.js,
    public/css/styles.css, and public/js/profile-script.js
11. services/routeAvailability.js, config/mapRuntime.js, the building/route/VR/
    schedule repositories, and supported admin controllers/routes
12. the credential-safety, residue, and BE.6 probes plus focused topology,
    geometry, map-to-VR, guided-VR, Free-Roam, and building probes named in
    plan.md, source-read only
13. every database/supabase migration filename and read-only Git truth: branch,
    HEAD, origin/main, status, staged/unstaged/untracked paths, stashes, safety
    refs, and recent graph

Reconcile these current recorded facts against live repository truth, which
wins:
- Accepted history remains M8-M11, RF.1-RF.6, BE.1-BE.6, OFF.1, M12.P1 R1-R7,
  D1-D5, and expanded D7. OFF.2-OFF.6 and D6 are separately accepted local
  history on the exact commits recorded below; neither local commit is deployed.
- R1-R7, D1-D5, and expanded D7 are complete and Codex GO. The
  dependency-security remediation is complete and Codex GO: after the accepted
  2026-07-22 closeout, the subsequent 2026-07-26 npm advisory drift was
  remediated; production pins ejs@6.0.1, the
  jake/filelist/minimatch/brace-expansion chain is absent, and npm audit
  --omit=dev records zero vulnerabilities. R6 and M12.P1-R7 are complete and
  Codex GO. Accepted R7 evidence is 71/71 focused, vercel-package-boundary
  70/70 in-suite, and 3495/3495 with QUALITY-GATES OK; 3492/3492 and 3494/3494
  are historical/superseded. M12.P1-D7 is complete and Codex GO. Accepted D7
  evidence is the fresh-context BrowserContext run, 3511/3511 with
  QUALITY-GATES OK, audit zero, and 24/24 -> 18/18 -> 46/46 with historical
  aggregate a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d.
- The Guided-VR runtime/catalog remediation remains recorded as
  43627cf0a77741556f4e701711e55612a739799b, tree
  eb3e830f68d537c4a54d6dda6df7d52a61f9c87b. The final R8 authority
  synchronization is committed and pushed as
  fea3b2e11c6331eddc1ee091b165427d8e0218d7. Live Git at post-deployment review
  confirmed branch main, local HEAD, and origin/main matched that commit.
- The separately authorized push automatically triggered Vercel Production
  while automatic production-domain assignment was enabled. The owner accepts
  https://campusphere-cspc.vercel.app on deployed technical Production baseline
  fea3b2e11c6331eddc1ee091b165427d8e0218d7. Owner-observed Vercel evidence
  showed Ready, Production, Current, main, source fea3b2e, and a completed
  17-second build. Its one disclosed warning was the open-ended node >=22 engine.
- Bounded anonymous read-only GET-only post-deployment verification passed:
  public pages/assets returned expected responses, sampled deployed bytes
  matched pushed source, protected HTML routes redirected to /auth, protected
  JSON routes returned 401, and checked responses set no cookie. /auth was
  deliberately avoided; no authentication or schedule auditing was exercised.
  The accepted source package identity is 158 files, 6,245,074 bytes, aggregate
  SHA-256 b3113c05daaa5d2e870f204083923434456580fa6499190421de062ce9cabbd4.
- Owner-observed Vercel settings now show Auto-assign Custom Production Domains
  disabled. Future main pushes may create staged Production deployments but
  require explicit manual promotion before replacing the live alias. This was
  not tested with a dummy push.
- Documentation/static-assertion-only authority commit
  db05b549807535840968bf28cdefac4154a6d59d is committed and pushed on main;
  live Git confirmed local HEAD and origin/main matched with a clean index and
  worktree. Owner-observed Vercel evidence showed it Ready, Production, Staged,
  with custom-domain assignment Skipped. It was not promoted or made Current, and
  fea3b2e11c6331eddc1ee091b165427d8e0218d7 remained on the live alias.
- Historical/superseded: before fea3b2e became Current, Production served
  0627bf78228148e3f989275810c333c16a1f3356. Its 75/75, 3777/3777, five-stage
  QA, 24/24 -> 18/18 -> 46/46, anonymous 31/31, and same-author/self-review
  caveat remain accepted history. GET /auth may create an anonymous
  identity-free session.
- An automated frozen-data production rehearsal PASSed with separate isolated
  admin/student/guest Playwright MCP contexts. It created and deleted one
  temporary @my.cspc.edu.ph student and one fresh Gmail guest through supported
  UI, restored seven users, closed sessions, and finished green. It is automated
  rehearsal, not human-pilot evidence. Preserve disclosures: pilot PII reached
  the executor transcript, three temporary repository files were removed, one
  read-only misclick was corrected, and human sign-in sequencing interrupted
  the flow.
- The expanded candidate is backend-specific. MySQL has 34 buildings, 44 route
  nodes, 100 directed edges, 50 exact reverse pairs, 100 valid geometries, 671
  scenes, and 1,396 hotspots. Supabase has 25 buildings, 26 route nodes, 50
  directed edges, 25 exact reverse pairs, 50 valid geometries, 664 scenes, and
  1,372 hotspots. The shared catalog has 25 active Guided-VR destinations, 472
  configured steps, and 99 unique scene keys. MySQL selected-VR fingerprint is
  371321de2af6be1ac87fb2f0d7c30a946c5538409022fd2968e21894b97caca2;
  Supabase selected-VR fingerprint is
  1ec674e497cbe8fd36234368f9c0a679c05bd68c8002c3f9724e7b3f0de0810c;
  shared catalog fingerprint is
  ed02ec95d5c642cd082f48c0b3c5b98d0707ffd5866f8f90b196793ecfe963d6.
- Migrations are exactly 0001-0019; no 0020. External backup and final-delta
  restore proofs passed for Supabase and MySQL; the manifest verifies 109/109
  files, and 86 referenced Cloudinary delivery assets were exported and hashed.
  This is not a Cloudinary management/original-account export.
- After the owner logged out accessible administrator/student sessions, exact
  preflight found one MySQL administrator, one MySQL student, and one Supabase
  administrator session. A first bounded wrapper stopped before mutation on a
  role-label mismatch. The corrected wrapper invoked supported
  `revokeUserSessions()` exactly once for each verified backend-local identity;
  it used no direct session-row deletion and changed no account or application
  data. That pre-QA read-only postcondition was 24/24 -> 18/18 -> 46/46.
- Current read-only Vercel package enumeration is 158 files, 6,245,074 bytes,
  SHA-256 b3113c05daaa5d2e870f204083923434456580fa6499190421de062ce9cabbd4;
  the focused and registered in-suite package gates both passed 72/72 and
  scripts/quality-gates.js pins those bytes.
- The independent read-only review of prior candidate manifest SHA-256
  b4c2c3c2a5766399b843c6e43f2f8cf347bcc04473e5ba6a0a808397c77a3d56
  returned commit-readiness NO-GO for the incomplete ordered CAS sequence guard,
  contradictory SEC-37 package evidence, obsolete OFF.3 catalog scope, and
  premature pilot sequencing. The bounded follow-up pins the ordered hash,
  expands rejection coverage, validates the package claim, and restores the
  review-to-pilot authorization order. The prior manifest and its then-required
  independent review are historical; the corresponding external report controls
  the corrected bytes' disposition.
- The next independent read-only review of exact 33-file manifest SHA-256
  2f78d9754094572ac2b6a2bec02786d66b35a651141cd8c0f5705ac85d1282a8
  returned commit-readiness NO-GO because the exact package pin was not enforced
  live, obsolete handoff policy was not isolated from current authority, and
  current dates were stale. This bounded correction added independent live pins,
  byte-drift/authority/date fixtures, and explicit historical boundaries. It
  changed no runtime or data; that candidate's later disposition is historical.
- The independent read-only review of exact 34-file manifest SHA-256
  ebf1142c11e3c027c0b3339a6888bc19196936ae3323644d907c68def224c4b4
  returned commit-readiness NO-GO because six current-authority documents
  repeated the rejected 4,628-PASS retry with an incorrect lower failure count
  after recording the transcript-faithful nine wording failures plus residue.
  The bounded correction removed the duplicate account and added a
  cross-document analyzer with accepting/rejecting fixtures. It changed no
  runtime or data; the corresponding external report controls its disposition.
- The first verification of that correction is historical/rejected at
  4640/4641: one documentation assertion failed because the analyzer stopped at
  the evidence ledger's first 4,628 mention. Runtime probes and embedded 18/18
  residue were green. The analyzer now evaluates every bounded 4,628 scope; no
  session or data correction was required.
- Focused catalog/runtime/BE.6/package probes are green. The failed QA attempt
  that stopped at 4,512 contract passes after mixed-mode `ECONNRESET` and left
  one canonical Supabase student session is historical/rejected. Under a
  separate bounded authorization, a fail-closed preflight reverified the one
  intended-role identity and one session, verified zero for the other three
  canonical Supabase identities, then called `revokeUserSessions()` exactly
  once for that student. No direct SQL, direct session-row deletion, account or
  application-data change, or broad cleanup occurred. A later separately
  authorized fail-closed preflight reverified exactly two unexpired sessions
  for the one intended-role canonical MySQL student, zero for the canonical
  MySQL administrator and all four canonical Supabase identities, and the
  explicitly selected MySQL session store. One supported
  `revokeUserSessions()` call removed both student sessions; no direct
  session-row deletion, account/application-data change, or broad cleanup
  occurred. The exact synchronized candidate passes a freshly counted
  `npm test` at `4641/4641` with `QUALITY-GATES OK` and `npm run qa` at the same
  exact contract total with all five stages green and all exact transcript
  markers present. Final ordered
  postconditions are `24/24 -> 18/18 -> 46/46`. Historical/superseded: the
  preceding 4,637-check QA command itself exited 0, but its enclosing scorer
  returned 97 because it searched for nonexistent `SUPABASE-SMOKE OK` instead
  of the actual `[supabase-smoke] PASS`; no application stage failed and no
  retry was caused. A later freshly counted suite attempt timed out at its
  20-minute wrapper bound inside the catalog-wide Guided-VR probe; it produced
  no completion count, is historical/rejected, and left no CampuSphere Node
  process or listener. Its one orphaned canonical MySQL student session was
  exposed by the next bounded run, which exited 1 at 4,628 PASS with nine
  current-authority wording failures and the residue failure. A fail-closed
  preflight then proved exactly that one session, zero for the canonical MySQL
  administrator and all four Supabase identities, and the intended student
  role; one supported `revokeUserSessions()` call restored the count to zero.
  No direct session-row delete, account/application-data change, or broad
  cleanup occurred. The wrapper timeout and bounded red rerun remain
  historical/rejected. The pre-remediation 4629/4629 and 4624/4624 matrices
  and the prior 4609/4609, 4599/4599, 615-pass, 4608/4609, 4623/4624,
  4,512-pass QA, and 3792/3792 evidence remain
  historical/superseded or rejected. The first integrated read-only M12.P1-R8
  review of clean commit 43627cf reverified the package pin, 4641/4641 test,
  five-stage QA, and 24/24 -> 18/18 -> 46/46, but returned R8 NO-GO solely for
  stale operative Git-lifecycle wording. It found no separate runtime,
  security, database, or package blocker. The authority follow-up's commit,
  push, and R8 disposition are established only by live Git and the latest
  external review report. The owner attests that a human pilot occurred on
  2026-08-05 and accepts it with zero reported findings. Participant/Form
  evidence remains external and no participant PII is recorded in Git. The
  tested build's full source-commit identity was not independently verified, so
  this is owner-attested pilot acceptance rather than independent current-build
  verification. Pilot review is complete for sequencing purposes. OFF.2-OFF.6
  and D6 are complete and Codex GO. The accepted OFF.2-OFF.5 implementation is
  committed locally as cdbc863b779e5319c14dee21a31a5e78951e233c and begins
  from clean main
  7ec8cc6e82c3a8e1824697696311675c1d23a572 and is strictly a normal 2D
  campus map with current-backend Main Gate routes and text building-details
  windows; it excludes 360/Guided-VR/Free-Roam, schedules, building photos, and
  Cloudinary media. Focused evidence is 145/145, 35/35, and package 74/74. D6
  is committed locally as 691f0bef40e06b6ea9485e713d2fe3000a03bd83 and passed
  npm test at 4998/4998 with QUALITY-GATES OK, five-stage npm run qa at the
  same exact contract total, and ordered postconditions 24/24 -> 18/18 -> 46/46. OFF.6 browser
  acceptance passed in both backends; after supported restoration of detected
  Supabase route-edge 198/199 drift, the unchanged 40-file manifest SHA-256
  e4436faba637bf592e220859469ca59fcf62870be731bc1d915f133c254e79a2
  passed replacement npm test 4998/4998 with D6 266/266, BE.6 46/46, and
  embedded residue 18/18. Final Milestone 12 disposition remains external to
  repository text. The implementation was later committed and pushed as
  `d786bdcb83a196c7263dceae668417d3ced3e95a`; No promotion is authorized;
  deployment is not authorized by this prompt.
  Replacement full verification of that committed implementation passed at
  `4998/4998` with `QUALITY-GATES OK`, five-stage `npm run qa` at the same
  exact contract total, bounded Chrome acceptance in both supported backends,
  and ordered postconditions `24/24 -> 18/18 -> 46/46`. The clean-commit
  independent R8 review returned NO-GO solely because stale operative lifecycle
  authority described the pushed, verified commit as uncommitted and pending;
  no separate runtime, security, database, or package blocker was found.
  After those accepted local commits, the committed 19-file offline
  UI/accessibility/package correction preserves the rendered route after the
  summary closes, online/offline data and layout parity, stable markers,
  building-detail image coverage, dialog focus containment/restoration, an
  inert and aria-hidden closed mobile sheet, a persistent shared theme, and
  exact 44-by-44 targets. Its simplified fallback keeps the SVG basemap and
  route decorative and represents buildings as labelled native HTML buttons in
  a named overlay. The service worker is v25. Authority-sync preflight recorded
  branch main, HEAD and origin/main at `d786bdcb83a196c7263dceae668417d3ced3e95a`,
  a clean index/worktree, zero untracked files and stashes, and migrations
  0001-0019 only. The committed implementation manifest SHA-256
  `92c689b884f52021f5545f331e8768ffc4768914cf9320c2d4b8fedee7020642` covered
  19 files and 2,072,400 bytes. Replacement verification passed at 4998/4998,
  five-stage QA, bounded Chrome acceptance in both backends, and
  24/24 -> 18/18 -> 46/46. The package pin is 168 files, 7,073,128 bytes,
  aggregate SHA-256 `1d6cc68b7ef350b6a61eb8d84ea4fb7dd6862bd8548beb7595d3f2e6f4b10d6a`.
  The current clean-commit R8 review returned NO-GO solely for stale lifecycle
  authority; live Git and the latest external report control any later correction.
  The exact predecessor manifest SHA-256
  `dd63b8a3b6e89294cb7b971c8fb8226c0098009ef9d3d7fa8c55f78d2a490a16` received
  independent NO-GO solely for the fallback SVG coordinate-frame defect. The
  bounded correction adds `preserveAspectRatio="none"` and rejecting fixtures
  for missing and `xMidYMid meet` variants. Its pre-authority-sync manifest
  SHA-256 `30e4dea3ac61e7598037630bb4748a8ea100f02b71c3dd8d64109f6e8fec4087`
  is predecessor evidence; recompute the final live manifest after authority
  edits. The current local maintenance correction is committed locally on
  `main` as Git commit SHA-1
  `c00db76c5be0fe9c8dfdc8168a4c4303c6a0aa64`; it has not been pushed
  to `origin/main`. Its exact 16-file manifest SHA-256
  `5bd2ba68fd442da73e36b53a3c1e4b1cfff30496e4ce50884382781ba9479a2d`
  (16 files, 1,915,676 bytes). It adds a scripts-only operator plus a narrowly
  scoped supported conditional session-store interface; that interface is
  deployable runtime support included in the package. The current package
  identity remains 168 files, 7,074,195 bytes, aggregate SHA-256
  `13cd3c5e5d8259766e50b1136c8cc8a5672b2321c65962892358c62b45ef88f5`;
  package identity does not authorize deployment. The app_sessions schema has
  no provenance field, so the anonymous cookie+csrfToken shape is an
  operational scope selector, not proof of origin. The exact owner-authorized
  local cleanup found 309 harness-shaped candidates with cleanup fingerprint SHA-256
  `a50b800e370439e0257cb7667d3fdb567af9dab88b87c3aeca6f32593598d18d`,
  destroyed 309 through the supported conditional interface, and left zero
  candidates and zero scanned residue. Replacement full verification remains
  a separate boundary; push, promotion, and deployment remain separately
  gated by this prompt. Final Milestone 12 disposition remains external.
  The first replacement browser acceptance of the preceding exact 19-file
  candidate is historical/rejected solely for a mobile overlap at 390x844:
  the fixed `#offlineMobileListToggle` covered the visible
  `#offlineSetDestination` action, so hit testing landed on Building List and
  destination activation failed. Desktop route acceptance and the preceding
  static/full-suite checks were green; the browser run stopped before MySQL and
  the final ordered postconditions. The bounded correction hides the toggle
  only while `#offlineDetailsPanel.visible` on max-width 768px and adds
  rejecting fixtures for the wrong selector, state, media scope, and DOM order.
  Focused evidence remains OFF.2 `145/145`, offline 2D `35/35`, and package
  boundary `74/74`. No new verification or browser acceptance is authorized by
  this grounding prompt.
  The first full verification of this offline candidate is historical/rejected
  at 4635/4641: npm test exited 1 after 4,635 PASS lines and emitted no
  QUALITY-GATES OK because exactly six static documentation/authority checks
  failed. Every executed runtime, database, catalog, BE.6, and final embedded
  18/18 residue check was green. Fail-closed sequencing stopped before npm run
  qa and before the standalone 24/24 -> 18/18 -> 46/46 postconditions. The
  bounded correction has focused static evidence only and no Codex GO. Its
  independent-review and replacement-full-verification dispositions are not
  established by this repository text. No session or data correction was
  required.
  The first verification of this state-neutral lifecycle correction is
  historical/rejected at 4639/4641: one combined lifecycle/history assertion
  still detected self-expiring review claims outside the primary current blocks,
  and one evidence-row classifier required the obsolete word candidate. Runtime,
  database, Guided-VR, BE.6, and embedded 18/18 residue checks were green. Those
  static contracts were corrected; the definitive rerun passed 4641/4641 with
  QUALITY-GATES OK, the five-stage QA rerun was green at the same total, and final
  postconditions were 24/24 -> 18/18 -> 46/46. No session or data correction was
  required.
  The independent review of exact 11-file manifest
  4d37507071089be4f6ce92404465a28334f9a03dbad82d02dfde2b013c3183ad returned
  R8 NO-GO solely for self-expiring lifecycle authority in the current reusable
  Claude prompt and incomplete lifecycle-matcher coverage. Its first correction run
  is historical/rejected at 4640/4641 because the analyzer rejected qualified
  review phrases but not the generic independent-review equivalent. All
  application, backend, Guided-VR, BE.6, and final embedded residue checks were
  green; the matcher now rejects both forms. The first exact original-phrase
  verification is historical/rejected at 4639/4641 because its reverse-order
  matcher was initially too broad and treated clearly historical
  pending/required review prose as operative. Every executed runtime/backend
  probe and the final embedded 18/18 residue gate were green. The matcher is now
  confined to the original open-before-review word order plus the already
  covered forward forms; no data or session correction was required. Live Git
  and the latest external review report control the corrected bytes' disposition.
  URLs and secrets stay outside Git.

The subsequent independent read-only review of exact 11-file manifest
c4a4c2b5bd592c00126f06736e8f8587d0de3dde189b506177bd764fddf3a192 returned
R8 NO-GO solely because the guard did not reject the exact original
open-before-review phrase; it found no other blocker. The narrowed correction
then passed npm test exactly 4641/4641 with QUALITY-GATES OK, full five-stage QA
with all five exact markers, and final 24/24 -> 18/18 -> 46/46. Its verified
pre-handoff manifest was
bd9a68ea8b7d2094d9fad54b561ed773852e30686646fcb446e9a3febfba2499.
That hash is predecessor evidence, not a pin for these later handoff bytes.

The first full verification of these fresh-session handoff bytes is
historical/rejected at 4638/4641: three static documentation checks failed
because the new manifest values were not all presented with the analyzer's
explicit SHA-256 label and both reusable prompts omitted the literal
deployment-authorization denial required by the prompt contract. All executed
runtime/backend probes and the final embedded 18/18 residue gate were green.
The labels and prompt denials are corrected; no runtime, database, session,
package, or vendor correction was required.

A subsequent full-suite attempt is historical/rejected because the temporary
server for publicRoadRouteRendering-probe.js did not become ready on its
dedicated port. All earlier checks and the final embedded 18/18 residue gate
were green; no listener or CampuSphere Node process remained. The focused probe
then passed immediately in both runtime modes. No repository, database, session,
package, or vendor correction was required for that transient harness-start
failure.

After grounding, report exact live Git truth against the recorded technical
Production baseline and identify any authority inconsistency. Do not perform a
code review, compute a candidate manifest, rerun verification, or issue a new
GO/NO-GO. Preserve one-writer control and the external backup. Never use direct
SQL as an operational shortcut, run syncSelectedCasVrSupabaseToMysql.js --apply
as cleanup, invent migration 0020, or infer that further implementation,
another pilot, Git mutation, or deployment is authorized.

Pilot review, D6, and OFF.2-OFF.6 are complete and Codex GO. The exact local
candidate awaits the independent Milestone 12 closeout report. It must not be
pushed, promoted, or deployed before the presentation and a later explicit
owner decision.
This context-only prompt authorizes none of implementation, review, testing,
Git mutation, a new deployment or promotion, another pilot, OFF.2
implementation, offline work, or Milestone 12 actions. Deployment is not
authorized by this prompt.

Return only a grounding report: capabilities/files inspected, exact live Git
truth versus recorded/owner-observed claims, evidence classes, inconsistencies,
the next owner-authorization boundary, and confirmation that nothing changed
repository, process, database, vendor, OAuth, Cloudinary, Upstash, or deployment
state. Stop and wait for the owner.
```

## Historical Claude Code Grounding Prompt (2026-08-21 pre-promotion, superseded; do not use)

```text
Repository: C:\Users\FROST.GG\Desktop\CampuSphere v1

You are Claude Code acting as CampuSphere's implementation partner and evidence
recorder. Codex remains the quality/review gate and the owner makes every
commit, database, vendor, and deployment decision.

This is a fresh context-only grounding session that does not authorize
implementation. Change nothing. Do not edit,
format, create, delete, move, stage, commit, amend, stash, reset, clean, tag,
push, deploy, link Vercel, apply SQL, access or mutate either database, invoke
Cloudinary/Upstash management APIs, clear sessions, create migration 0020,
start a server, use a browser, or run tests, QA, probes, audits, or smoke checks.

Inventory the skills, plugins, apps, MCP servers, and tools actually available.
If a reviewer capability necessarily writes REVIEW.md or runs forbidden tools,
disclose that and use a manual read-only review instead. Use read-only large-file
tooling when helpful. Playwright availability does not authorize browser use.

Read completely and in this order: CLAUDE_HANDOFF.md; CODEX_HANDOFF.md; plan.md;
ROADMAP.md; CLAUDE.md; AGENTS.md; docs/deployment.md;
docs/security-checklist.md; docs/test-evidence.md;
docs/new-session-grounding-prompts.md; package.json; package-lock.json;
.vercelignore; vercel.json; config/selectedDemoFreeze.js;
scripts/vercelPackageBoundary-probe.js; public/offline.html;
public/css/offline.css; public/js/offline-guide-manager.js; public/sw.js;
views/map.ejs; routes/map.js; controllers/offlineGuideController.js;
services/offlineGuideService.js; scripts/off2PwaLifecycle-probe.js;
scripts/offline2dNavigation-probe.js; scripts/quality-gates.js;
services/auditService.js; server.js; public/css/styles.css;
public/js/profile-script.js; services/routeAvailability.js; config/mapRuntime.js;
the building/route/VR/schedule repositories and supported admin interfaces; the
credential-safety, residue, BE.6, topology, geometry, map-to-VR, guided-VR,
Free-Roam, and building probes source-read only; all Supabase migration
filenames; and read-only Git branch/HEAD/origin/status/stashes/refs/recent graph.

Reconcile the same current facts listed in the Codex prompt above, including
the committed/pushed `43627cf` runtime history; final R8 authority commit
`fea3b2e11c6331eddc1ee091b165427d8e0218d7`; the owner-accepted technical
Production baseline at that exact commit; the disclosure that its authorized
push automatically triggered Production; the bounded anonymous read-only
GET-only post-deployment PASS; and the owner-observed disabled Auto-assign
Custom Production Domains setting requiring manual promotion for future
`main` deployments. Determine mutable Git truth live. In particular preserve:
historical deployed commit 0627bf7; prior bbb25d0 and d422b54; accepted
five-file evidence at 75/75, 3777/3777 plus QUALITY-GATES OK, five-stage QA,
and 24/24 -> 18/18 -> 46/46; owner-observed Vercel identity; same-author review
caveat; historical 31/31 anonymous smoke scope; automated rehearsal and its deviations;
the backend-specific catalog at MySQL 34 buildings / 44 route
nodes / 100 edges / 50 reverse pairs / 100 geometries / 671 scenes / 1,396
hotspots and Supabase 25 / 26 / 50 / 25 / 50 / 664 / 1,372; shared Guided-VR
catalog 25 destinations / 472 configured steps / 99 unique scene keys;
migrations 0001-0019 only; completed external backup/restore/Cloudinary-delivery
evidence; pre-QA ordered postcondition 24/24 -> 18/18 -> 46/46 after the
bounded supported cleanup disclosed above; and package inventory 158 files / 6,245,074 bytes /
b3113c05daaa5d2e870f204083923434456580fa6499190421de062ce9cabbd4.
Focused remediation probes are green. The failed QA attempt that stopped at
4,512 contract passes after mixed-mode `ECONNRESET` and left one canonical
Supabase student session is historical/rejected. Under a separate bounded
authorization, a fail-closed preflight reverified the one intended-role
identity and one session, verified zero for the other three canonical Supabase
identities, then called `revokeUserSessions()` exactly once for that student.
No direct SQL, direct session-row deletion, account or application-data change,
or broad cleanup occurred. A later separately authorized fail-closed preflight
reverified exactly two unexpired sessions for the one intended-role canonical
MySQL student, zero for the canonical MySQL administrator and all four
canonical Supabase identities, and the explicitly selected MySQL session
store. One supported `revokeUserSessions()` call removed both student sessions;
no direct session-row deletion, account/application-data change, or broad
cleanup occurred. The exact synchronized candidate passes a freshly counted
`npm test` at `4641/4641` with `QUALITY-GATES OK` and `npm run qa` at the same
exact contract total with all five stages green and all exact transcript
markers present. Final ordered
postconditions are `24/24 -> 18/18 -> 46/46`. Historical/superseded: the
preceding 4,637-check QA command itself exited 0, but its enclosing scorer
returned 97 because it searched for nonexistent `SUPABASE-SMOKE OK` instead
of the actual `[supabase-smoke] PASS`; no application stage failed and no
retry was caused. A later freshly counted suite attempt timed out at its
20-minute wrapper bound inside the catalog-wide Guided-VR probe; it produced no
completion count, is historical/rejected, and left no CampuSphere Node process
or listener. Its one orphaned canonical MySQL student session was exposed by
the next bounded run, which exited 1 at 4,628 PASS with nine current-authority
wording failures and the residue failure. A fail-closed preflight then proved
exactly that one session, zero for the canonical MySQL administrator and all
four Supabase identities, and the intended student role; one supported
`revokeUserSessions()` call restored the count to zero. No direct session-row
delete, account/application-data change, or broad cleanup occurred. The wrapper
timeout and bounded red rerun remain
historical/rejected. The pre-remediation 4629/4629 and 4624/4624 matrices and
prior 4609/4609, 4599/4599,
initializer-order 615-pass stop, 4608/4609
ROADMAP-wording failure, 4623/4624 reusable-prompt failure, and 4,512-pass QA
attempt are historical/superseded or rejected. Independent review readiness is
established; the latest external review report controls the later disposition.
Historically, the independent review of exact 34-file manifest
ebf1142c11e3c027c0b3339a6888bc19196936ae3323644d907c68def224c4b4 returned
commit-readiness NO-GO because current authority repeated the rejected
4,628-PASS retry with an incorrect lower failure count. The bounded correction
removes that duplicate account and adds cross-document accepting/rejecting
coverage; runtime and data remain unchanged. That record does not determine the
current review boundary; live Git and the latest external review report do.
The correction's first verification is historical/rejected at 4640/4641: the
analyzer stopped at the first 4,628 evidence mention, so its one combined
documentation assertion failed while runtime probes and embedded 18/18 residue
were green. It now evaluates every bounded 4,628 scope; no session or data
correction was required.

R1-R7, D1-D5, and expanded D7 are complete and Codex GO. The
dependency-security remediation is complete and Codex GO: after the accepted
2026-07-22 closeout, the subsequent 2026-07-26 npm advisory drift was
remediated; production pins ejs@6.0.1, the
jake/filelist/minimatch/brace-expansion chain is absent, and npm audit
--omit=dev records zero vulnerabilities. R6 and M12.P1-R7 are complete and
Codex GO. Accepted R7 evidence is 71/71 focused, vercel-package-boundary 70/70
in-suite, and 3495/3495 with QUALITY-GATES OK; 3492/3492 and 3494/3494 are
historical/superseded. M12.P1-D7 is complete and Codex GO. Accepted D7 evidence
is the fresh-context BrowserContext run, 3511/3511 with QUALITY-GATES OK, audit
zero, and 24/24 -> 18/18 -> 46/46 with historical aggregate
a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d.

The Guided-VR runtime/catalog remediation remains recorded as
43627cf0a77741556f4e701711e55612a739799b, tree
eb3e830f68d537c4a54d6dda6df7d52a61f9c87b. The final R8 authority
synchronization is committed and pushed as
fea3b2e11c6331eddc1ee091b165427d8e0218d7. The owner accepts
https://campusphere-cspc.vercel.app on deployed technical Production baseline
fea3b2e11c6331eddc1ee091b165427d8e0218d7. Its authorized push automatically
triggered Production while
automatic domain assignment was enabled. Bounded anonymous read-only GET-only
post-deployment verification passed without requesting /auth, authenticating,
or exercising schedule auditing. The accepted source package identity is 158
files, 6,245,074 bytes, aggregate SHA-256
b3113c05daaa5d2e870f204083923434456580fa6499190421de062ce9cabbd4.
Owner-observed Vercel settings now show Auto-assign Custom Production Domains
disabled, so future main deployments require explicit manual promotion before
replacing the live alias. Documentation/static-assertion-only authority commit
db05b549807535840968bf28cdefac4154a6d59d is committed and pushed on main;
live Git confirmed local HEAD and origin/main matched with a clean index and
worktree. Owner-observed Vercel evidence showed it Ready, Production, Staged,
with custom-domain assignment Skipped. It was not promoted or made Current, and
fea3b2e11c6331eddc1ee091b165427d8e0218d7 remained on the live alias.
Historical/superseded: Production previously served
0627bf78228148e3f989275810c333c16a1f3356. The first integrated read-only
M12.P1-R8 review and its lifecycle corrections remain historical evidence. The
former session-residue findings are closed and historical;
The first verification of this state-neutral lifecycle correction is
historical/rejected at 4639/4641: two static documentation checks failed while
runtime, database, Guided-VR, BE.6, and embedded 18/18 residue checks were green.
The corrected definitive rerun passed 4641/4641 with QUALITY-GATES OK,
five-stage QA was green at the same total, and final postconditions were
24/24 -> 18/18 -> 46/46. No session or data correction was required.
The independent read-only review of exact 11-file manifest
4d37507071089be4f6ce92404465a28334f9a03dbad82d02dfde2b013c3183ad returned
R8 NO-GO solely because this current reusable Claude prompt retained
self-expiring review claims and the Git-lifecycle analyzer did not cover their
original open-before-review word order. This bounded correction makes both current prompts
state-neutral and adds accepting/rejecting lifecycle fixtures to the existing
assertion. Live Git and the latest external review report control its
disposition.
Its first verification execution is historical/rejected at 4640/4641: the new
negative-fixture group exposed that the analyzer rejected qualified review
phrases but not the generic independent-review equivalent. All application,
backend, Guided-VR, BE.6, and final embedded residue checks were green. The
matcher now rejects both forms; no runtime, database, session, or package
correction was required.
The first exact original-phrase verification is historical/rejected at
4639/4641 because its reverse-order matcher was initially too broad and treated
clearly historical pending/required review prose as operative. Every executed
runtime/backend probe and the final embedded 18/18 residue gate were green. The
matcher is now confined to the original open-before-review word order plus the
already covered forward forms; no data or session correction was required.
The subsequent independent read-only review of exact 11-file manifest
c4a4c2b5bd592c00126f06736e8f8587d0de3dde189b506177bd764fddf3a192 returned
R8 NO-GO solely for the uncovered exact original phrase and found no other
blocker. The narrowed correction passed npm test exactly 4641/4641 with
QUALITY-GATES OK, full five-stage QA, and final 24/24 -> 18/18 -> 46/46. Its
verified pre-handoff manifest was
bd9a68ea8b7d2094d9fad54b561ed773852e30686646fcb446e9a3febfba2499;
that hash is predecessor evidence, not a pin for the later handoff bytes.
The first full verification of these fresh-session handoff bytes is
historical/rejected at 4638/4641: three static documentation checks failed
because the new manifest values were not all presented with the analyzer's
explicit SHA-256 label and both reusable prompts omitted the literal
deployment-authorization denial required by the prompt contract. All executed
runtime/backend probes and the final embedded 18/18 residue gate were green.
The labels and prompt denials are corrected; no runtime, database, session,
package, or vendor correction was required.
A subsequent full-suite attempt is historical/rejected because the temporary
server for publicRoadRouteRendering-probe.js did not become ready on its
dedicated port. All earlier checks and the final embedded 18/18 residue gate
were green; no listener or CampuSphere Node process remained. The focused probe
then passed immediately in both runtime modes. No repository, database, session,
package, or vendor correction was required for that transient harness-start
failure.
do not repeat cleanup. Preserve the backup and one-writer boundary. Never
blanket-delete, use direct SQL, run syncSelectedCasVrSupabaseToMysql.js --apply
as cleanup, create 0020 without a reviewed schema need, or stage/push/deploy
without separate owner authorization.

The owner attests that a human pilot occurred on 2026-08-05 and accepts it with
zero reported findings. Participant/Form evidence remains external and no
participant PII is recorded in Git. The tested build's full source-commit
identity was not independently verified, so this is owner-attested pilot
acceptance rather than independent current-build verification. Pilot review is
complete for sequencing purposes. OFF.2-OFF.6 and D6 are complete and Codex GO.
The accepted OFF.2-OFF.5 implementation is committed locally as
cdbc863b779e5319c14dee21a31a5e78951e233c; it begins from clean main
7ec8cc6e82c3a8e1824697696311675c1d23a572 and is
strictly a normal 2D campus
map with current-backend Main Gate routes and text building-details windows;
it excludes 360/Guided-VR/Free-Roam, schedules, building photos, and Cloudinary
media. Focused evidence is 145/145, 35/35, and package 74/74. D6 is committed
  locally as 691f0bef40e06b6ea9485e713d2fe3000a03bd83 and passed npm test at
  4998/4998 with QUALITY-GATES OK, five-stage npm run qa at the same exact
  contract total, and ordered postconditions 24/24 -> 18/18 -> 46/46. OFF.6 browser acceptance passed
  in both backends; after supported restoration of detected Supabase route-edge
  198/199 drift, the unchanged 40-file manifest SHA-256
  e4436faba637bf592e220859469ca59fcf62870be731bc1d915f133c254e79a2 passed
  replacement npm test 4998/4998 with D6 266/266, BE.6 46/46, and embedded
  residue 18/18. Final Milestone 12 disposition remains external to repository
  text. The implementation was later committed and pushed as
  `d786bdcb83a196c7263dceae668417d3ced3e95a`; No promotion is authorized;
  deployment is not authorized by this prompt.
  Replacement full verification of that committed implementation passed at
  `4998/4998` with `QUALITY-GATES OK`, five-stage `npm run qa` at the same
  exact contract total, bounded Chrome acceptance in both supported backends,
  and ordered postconditions `24/24 -> 18/18 -> 46/46`. The clean-commit
  independent R8 review returned NO-GO solely because stale operative lifecycle
  authority described the pushed, verified commit as uncommitted and pending;
  no separate runtime, security, database, or package blocker was found.
  After those accepted local commits, the committed 19-file offline
  UI/accessibility/package correction preserves the rendered route after the
  summary closes, online/offline data and layout parity, stable markers,
  building-detail image coverage, dialog focus containment/restoration, an
  inert and aria-hidden closed mobile sheet, a persistent shared theme, and
  exact 44-by-44 targets. Its simplified fallback keeps the SVG basemap and
  route decorative and represents buildings as labelled native HTML buttons in
  a named overlay. The service worker is v25. Authority-sync preflight recorded
  branch main, HEAD and origin/main at `d786bdcb83a196c7263dceae668417d3ced3e95a`,
  a clean index/worktree, zero untracked files and stashes, and migrations
  0001-0019 only. The committed implementation manifest SHA-256
  `92c689b884f52021f5545f331e8768ffc4768914cf9320c2d4b8fedee7020642` covered
  19 files and 2,072,400 bytes. Replacement verification passed at 4998/4998,
  five-stage QA, bounded Chrome acceptance in both backends, and
  24/24 -> 18/18 -> 46/46. The package pin is 168 files, 7,073,128 bytes,
  aggregate SHA-256 `1d6cc68b7ef350b6a61eb8d84ea4fb7dd6862bd8548beb7595d3f2e6f4b10d6a`.
  The current clean-commit R8 review returned NO-GO solely for stale lifecycle
  authority; live Git and the latest external report control any later correction.
  The exact predecessor manifest SHA-256
  `dd63b8a3b6e89294cb7b971c8fb8226c0098009ef9d3d7fa8c55f78d2a490a16` received
  independent NO-GO solely for the fallback SVG coordinate-frame defect. The
  bounded correction adds `preserveAspectRatio="none"` and rejecting fixtures
  for missing and `xMidYMid meet` variants. Its pre-authority-sync manifest
  SHA-256 `30e4dea3ac61e7598037630bb4748a8ea100f02b71c3dd8d64109f6e8fec4087`
  is predecessor evidence; recompute the final live manifest after authority
  edits. The current local maintenance correction is committed locally on
  `main` as Git commit SHA-1
  `c00db76c5be0fe9c8dfdc8168a4c4303c6a0aa64`; it has not been pushed
  to `origin/main`. Its exact 16-file manifest SHA-256
  `5bd2ba68fd442da73e36b53a3c1e4b1cfff30496e4ce50884382781ba9479a2d`
  (16 files, 1,915,676 bytes). It adds a scripts-only operator plus a narrowly
  scoped supported conditional session-store interface; that interface is
  deployable runtime support included in the package. The current package
  identity remains 168 files, 7,074,195 bytes, aggregate SHA-256
  `13cd3c5e5d8259766e50b1136c8cc8a5672b2321c65962892358c62b45ef88f5`;
  package identity does not authorize deployment. The app_sessions schema has
  no provenance field, so the anonymous cookie+csrfToken shape is an
  operational scope selector, not proof of origin. The exact owner-authorized
  local cleanup found 309 harness-shaped candidates with cleanup fingerprint SHA-256
  `a50b800e370439e0257cb7667d3fdb567af9dab88b87c3aeca6f32593598d18d`,
  destroyed 309 through the supported conditional interface, and left zero
  candidates and zero scanned residue. Replacement full verification remains
  a separate boundary; push, promotion, and deployment remain separately
  gated by this prompt. Final Milestone 12 disposition remains external.
  The first replacement browser acceptance of the preceding exact 19-file
  candidate is historical/rejected solely for a mobile overlap at 390x844:
  the fixed `#offlineMobileListToggle` covered the visible
  `#offlineSetDestination` action, so hit testing landed on Building List and
  destination activation failed. Desktop route acceptance and the preceding
  static/full-suite checks were green; the browser run stopped before MySQL and
  the final ordered postconditions. The bounded correction hides the toggle
  only while `#offlineDetailsPanel.visible` on max-width 768px and adds
  rejecting fixtures for the wrong selector, state, media scope, and DOM order.
  Focused evidence remains OFF.2 `145/145`, offline 2D `35/35`, and package
  boundary `74/74`. No new verification or browser acceptance is authorized by
  this grounding prompt.
  The first full verification of this offline candidate is historical/rejected
  at 4635/4641: npm test exited 1 after 4,635 PASS lines and emitted no
  QUALITY-GATES OK because exactly six static documentation/authority checks
  failed. Every executed runtime, database, catalog, BE.6, and final embedded
  18/18 residue check was green. Fail-closed sequencing stopped before npm run
  qa and before the standalone 24/24 -> 18/18 -> 46/46 postconditions. The
  bounded correction has focused static evidence only and no Codex GO. Its
  independent-review and replacement-full-verification dispositions are not
  established by this repository text. No session or data correction was
  required.

Determine mutable Git truth live. Do not review, edit, test, implement, stage,
commit, push, deploy, promote, or perform a closeout review. Final Milestone 12
disposition remains external to this prompt. After the grounding report, stop
and wait for the owner; do not infer that further implementation, deployment,
Git mutation, or another pilot is authorized. Deployment is not authorized by
this prompt.
This context-only prompt authorizes none of those actions.

Return only a grounding report: capabilities/files; exact verified truth versus
recorded/owner-observed claims; evidence classes; inconsistencies; blockers and
next authorization; no-mutation confirmation. Do not implement or claim a new
GO. Stop for the owner.
```

## Historical Codex Grounding Prompt (2026-07-30, superseded; do not use)

```text
Repository: C:\Users\FROST.GG\Desktop\CampuSphere v1

You are Codex for CampuSphere: senior reviewer, security/DB/UI quality gate,
handoff owner, and delivery coordinator.

This is a fresh context-only grounding session. Change nothing. Do not edit,
format, create, delete, move, stage, commit, amend, stash, reset, clean, tag,
push, deploy, link Vercel, apply SQL, invoke Cloudinary or Upstash management
APIs, mutate any database row, clear any session, create migration 0020, start
a server, use a browser, or run npm test, npm run qa, probes, audits, smoke
checks, or any command that can write application or external state. Preserve
the intentionally dirty worktree exactly.

Before reviewing, inspect the skills, plugins, apps, and MCP tools actually
available in this session. Load and follow the installed code-reviewer skill
before every code, security, database, UI, quality, or deployment finding and
before any GO/NO-GO conclusion. Use context-mode or equivalent read-only large
file tooling when materially helpful. Do not assume a named capability exists;
report missing tooling and use only a safe read-only fallback. Playwright or
browser availability does not authorize browser use during this grounding.

Read completely and in this order:
1. CODEX_HANDOFF.md
2. CLAUDE_HANDOFF.md
3. plan.md, especially M12.P1-R8, M12.P2, Interfaces and Contracts,
   Anti-Scope, and Assumptions
4. ROADMAP.md, especially the routing/privacy/pilot gates, OFF.2-OFF.6,
   Milestones 12-13, blockers, and recommended order
5. AGENTS.md
6. CLAUDE.md
7. docs/deployment.md, docs/security-checklist.md, docs/test-evidence.md, and
   docs/new-session-grounding-prompts.md
8. CODEBASE_REMEDIATION_PLAN.md and fable5_security_bugs_report.md as
   historical inputs only; current authority documents and live evidence win
9. package.json, package-lock.json, config/selectedDemoFreeze.js, and
   scripts/be6DatasetFreeze-probe.js
10. scripts/quality-gates.js, including the current SEC-51 analyzers and
    rejecting fixtures; do not edit or execute it
11. scripts/pilotCredentialSafety-probe.js,
    scripts/probeSessionResidue-probe.js, scripts/probeSessionLifecycle.js,
    services/sessionRevocation.js, and scripts/regressionCredentials.js
12. scripts/vrScheduleHotspot-probe.js, repositories/vrRepository.js,
    repositories/scheduleRepository.js, config/vrDataSource.js,
    config/scheduleDataSource.js, controllers/adminVrController.js,
    controllers/adminScheduleController.js, routes/admin.js, and
    scripts/syncSelectedCasVrSupabaseToMysql.js
13. server.js, middleware/roleAuth.js,
    middleware/authenticatedHtmlNoStore.js, middleware/securityHeaders.js,
    routes/auth.js, routes/map.js, routes/vr.js, and the affected public/admin
    views and public assets named by plan.md
14. services/routeAvailability.js and the focused topology, geometry,
    map-to-VR, guided-CAS, Free Roam, VR-schedule, and building probes named in
    plan.md
15. .vercelignore, vercel.json, all Vercel/deployment documentation, the full
    database/supabase/*.sql list, and read-only Git truth: current branch, HEAD,
    origin/main, status --short, porcelain count, staged/unstaged/untracked
    name-status, stashes, and existing local safety refs

Live repository and database evidence overrides prompts, screenshots, reports,
memory, and handoffs. During this grounding, database evidence means only the
latest recorded independently reviewed evidence in the authority documents;
do not query either backend.

Reconcile this decision set:
- RF.1 through RF.6 are complete and Codex GO. OFF.1 is complete and Codex
  GO; M12.P1 is the next readiness gate. Accepted history also includes
  Milestones 8-11 and BE.1-BE.6.
- M12.P1 R1-R7, D1-D5, and expanded D7 are complete and Codex GO. R6 is
  complete and Codex GO. The dependency-security remediation is complete and
  Codex GO: a subsequent 2026-07-26 advisory drift was remediated,
  `ejs@6.0.1` is pinned, the
  `jake/filelist/minimatch/brace-expansion` chain is absent, and
  `npm audit --omit=dev` reports zero vulnerabilities.
- M12.P1-R7 is complete and Codex GO. Accepted R7 evidence is focused `71/71`,
  in-suite `vercel-package-boundary` `70/70`, full suite `3495/3495` with
  `QUALITY-GATES OK`, and audit zero; `3492/3492` and `3494/3494` are
  historical/superseded. Expanded D7 is complete and Codex GO. Accepted D7
  evidence is the fresh-context role-isolation run with separate browser
  contexts, `3511/3511` with `QUALITY-GATES OK`, audit zero, and
  `24/24 -> 18/18 -> 46/46` with the frozen fingerprint unchanged.
- This context-only grounding does not authorize implementation or R8. OFF.2
  through OFF.6 are deferred until pilot review, not cancelled, and remain
  required before final Milestone 12 GO.
- Production is https://campusphere-cspc.vercel.app on accepted deployed
  baseline d422b54393f659125912ec5c84ae7927c2533288. The read-only SEC-51
  production smoke for that exact baseline is independently Codex-accepted.
- Local HEAD is the later documentation-only commit
  db034e5581e6f409083a43dcb80fb82b473e0127; it is not the deployed runtime.
  At the opening of the continuity sync, main was one commit ahead of
  origin/main, with backup-pre-trailer-strip and refs/original safety refs.
- The opening worktree contained only uncommitted changes in
  docs/security-checklist.md, docs/test-evidence.md, and
  scripts/quality-gates.js. The current local candidate also includes
  synchronized authority-document changes and the bounded
  services/auditService.js schedule-action allowlist repair. It remains
  uncommitted and unaccepted.
- Current independently verified database truth is 24/24 credential safety,
  18/18 residue, and BE.6 46/46. The exact leaked hotspot and sibling schedule
  are absent; all four canonical Supabase identities have zero unexpired
  sessions; MySQL is clean; all 26 selected scenes match; both backends have
  51 selected-source hotspots with selected-VR fingerprint
  ec66f04bf827bc9c8494a9007ff2e89d7990dd77cc7c5a9d629977ec583f6c6b.
- Before the separately authorized 2026-07-30 restoration, the historical
  state was 22/24 -> 16/18 -> 41/46 with the exact CCS hotspot, sibling
  schedule, and two canonical Supabase sessions. That superseded incident is
  not current database truth.
- Frozen aggregate fingerprint is
  a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d.
  The local-candidate package boundary is 158 files, 6,201,747 bytes, SHA-256
  acfb1696de0c8855e02aa82e243fec959aefec637f29bdf033bc34ffda42e8b1.
  Before the audit repair, the prior local candidate was 158 files, 6,201,603
  bytes, SHA-256 28403afaca31b90849d8cc76c1ec0501f29444d138e865053337617b664d3636.
  Migrations are exactly 0001-0019; migrations 0014 through 0019 are
  owner-applied, and no 0020 exists.
- Verified routing topology is 20 nodes, 48 directed edges, 24 exact reverse
  pairs, 48 valid geometries, and 13 routable building destinations.
  CampuSphere routing uses its own campus graph and owner-managed
  `route_edges.path_geometry`; it has no Google Maps, Google Earth, Strava,
  SIS, or external routing-engine dependency. Guided VR claims arrival only
  when the last mapped scene belongs to the destination; otherwise it shows
  the explicit coverage-ended notice.
- 3752/3752, 3755/3755, 3760/3760, and 3763/3763 are
  historical/superseded or rejected candidates, not current R8 evidence. The
  first authority/audit/total-consistency execution is rejected: 3,742 checks
  passed and 30 failed out of 3,772, with no QUALITY-GATES OK. The later
  3,774/3,777 execution is also rejected. An earlier frozen 12-file matrix was
  recorded as green 3777/3777; that record is superseded and rejected, because a
  fresh execution against those exact older bytes exited 1 at 3776/3777 with one
  static failure, cloudinary-docs :: docs contain no JWT/PEM/AWS/long-hex secret
  values, raised by an unlabeled 40-hex Repository HEAD value in
  docs/deployment.md.
- A bounded documentation-only correction labelled that value as Repository HEAD
  and preserved the truthful claim that the commit is a documentation-only
  commit and gate-work candidate, not a runtime deployment.
  scripts/quality-gates.js was not changed by that docs-secret-label correction.
  A byte-consistent matrix was then executed once against the corrected
  manifest: preflight and postflight matched 12/12 hashes with Git, migration,
  and process state unchanged, logout was 75/75 at exit 0, npm test exited 0 at
  3777/3777 with QUALITY-GATES OK present and QUALITY-GATES FAILED absent, npm
  run qa exited 0 with exactly 3,777 contract PASS lines before QUALITY-GATES OK
  and all five green markers exactly once, and final ordered postconditions were
  24/24 -> 18/18 -> 46/46 at exit 0 each. That 3777 total is a transcript-wide
  PASS-line reconciliation across parent quality-gate output plus inherited
  spawned-probe stdout, not an in-process makeRecorder counter.
- The byte-consistent result is current candidate evidence only and remains
  unaccepted pending independent read-only review. No R8 GO, SEC-51 GO,
  deployment GO, pilot GO, Milestone 12 GO, commit readiness, or deployment
  authorization is claimed.
- At restoration time, admin.schedule.delete was absent from the audit
  allowlist and POST /logout emitted no audit-service event. No retroactive
  audit row is claimed. The executor's extra read-only probes and persistent
  Claude-memory write are retained as disclosed boundary deviations.
- The owner-created Google Form is READY external evidence. Its URL and all
  secret values remain outside Git.
- Never run syncSelectedCasVrSupabaseToMysql.js --apply for this incident.
  Never use direct SQL, direct session-row deletion, broad cleanup, or
  migration 0020.
- Candidate verification is complete. M12.P1-R8 is the next potential section
  and is read-only. R8 is not authorized by this context-only grounding. The required
  sequence is R8 read-only review, then a separate owner deployment decision.
  Staging, commit, push, and deployment remain unauthorized.
- M12.P1 remains NO-GO. Deployment is not authorized; deployment readiness,
  pilot readiness, and Milestone 12 remain NO-GO.

Return only a grounding report with:
1. Files and capabilities inspected.
2. Accepted, current-restored, historical/superseded, and unaccepted-candidate
   evidence kept separate.
3. Exact Git, migration, production-baseline, package, topology, VR, and BE.6
   truth.
4. Documentation inconsistencies or scope drift, if any.
5. Current blockers and the exact separate owner authorization required next.
6. Confirmation that no command changed repository, process, database, vendor,
   OAuth, Cloudinary, Upstash, or deployment state.

Do not claim GO. Stop after the report and wait for explicit authorization.
```

## Historical Claude Code Grounding Prompt (2026-07-30, superseded; do not use)

```text
Repository: C:\Users\FROST.GG\Desktop\CampuSphere v1

You are Claude Code for CampuSphere: senior implementation owner working under
independent Codex review and GO/NO-GO control.

This is a fresh context-only grounding session. Change nothing. Do not edit,
format, create, delete, move, stage, commit, amend, stash, reset, clean, tag,
push, deploy, link Vercel, apply SQL, invoke Cloudinary or Upstash management
APIs, mutate any database row, clear any session, create migration 0020, start
a server, use a browser, or run npm test, npm run qa, probes, audits, smoke
checks, or any command that can write application or external state. Preserve
the intentionally dirty worktree exactly.

Before reviewing, inspect the skills, plugins, apps, and MCP tools actually
available in this session. Use the code-reviewer skill before every code,
security, database, UI, quality, or deployment finding if that exact skill is
installed. If it is unavailable, disclose that fact and perform a manual
evidence-based reviewer sweep; do not substitute a skill that writes REVIEW.md
or any other artifact. Use context-mode or equivalent read-only large-file
tooling when materially helpful. Playwright or browser availability does not
authorize browser use during this grounding.

Read completely and in this order:
1. CODEX_HANDOFF.md
2. CLAUDE_HANDOFF.md
3. plan.md, especially M12.P1-R8, M12.P2, Interfaces and Contracts,
   Anti-Scope, and Assumptions
4. ROADMAP.md, especially the routing/privacy/pilot gates, OFF.2-OFF.6,
   Milestones 12-13, blockers, and recommended order
5. AGENTS.md
6. CLAUDE.md
7. docs/deployment.md, docs/security-checklist.md, docs/test-evidence.md, and
   docs/new-session-grounding-prompts.md
8. CODEBASE_REMEDIATION_PLAN.md and fable5_security_bugs_report.md as
   historical inputs only; current authority documents and live evidence win
9. package.json, package-lock.json, config/selectedDemoFreeze.js, and
   scripts/be6DatasetFreeze-probe.js
10. scripts/quality-gates.js, including the current SEC-51 analyzers and
    rejecting fixtures; do not edit or execute it
11. scripts/pilotCredentialSafety-probe.js,
    scripts/probeSessionResidue-probe.js, scripts/probeSessionLifecycle.js,
    services/sessionRevocation.js, and scripts/regressionCredentials.js
12. scripts/vrScheduleHotspot-probe.js, repositories/vrRepository.js,
    repositories/scheduleRepository.js, config/vrDataSource.js,
    config/scheduleDataSource.js, controllers/adminVrController.js,
    controllers/adminScheduleController.js, routes/admin.js, and
    scripts/syncSelectedCasVrSupabaseToMysql.js
13. server.js, middleware/roleAuth.js,
    middleware/authenticatedHtmlNoStore.js, middleware/securityHeaders.js,
    routes/auth.js, routes/map.js, routes/vr.js, and the affected public/admin
    views and public assets named by plan.md
14. services/routeAvailability.js and the focused topology, geometry,
    map-to-VR, guided-CAS, Free Roam, VR-schedule, and building probes named in
    plan.md
15. .vercelignore, vercel.json, all Vercel/deployment documentation, the full
    database/supabase/*.sql list, and read-only Git truth: current branch, HEAD,
    origin/main, status --short, porcelain count, staged/unstaged/untracked
    name-status, stashes, and existing local safety refs

Live repository and database evidence overrides prompts, screenshots, reports,
memory, and handoffs. During this grounding, database evidence means only the
latest recorded independently reviewed evidence in the authority documents;
do not query either backend.

Reconcile this decision set:
- RF.1 through RF.6 are complete and Codex GO. OFF.1 is complete and Codex
  GO; M12.P1 is the next readiness gate. Accepted history also includes
  Milestones 8-11 and BE.1-BE.6.
- M12.P1 R1-R7, D1-D5, and expanded D7 are complete and Codex GO. R6 is
  complete and Codex GO. The dependency-security remediation is complete and
  Codex GO: a subsequent 2026-07-26 advisory drift was remediated,
  `ejs@6.0.1` is pinned, the
  `jake/filelist/minimatch/brace-expansion` chain is absent, and
  `npm audit --omit=dev` reports zero vulnerabilities.
- M12.P1-R7 is complete and Codex GO. Accepted R7 evidence is focused `71/71`,
  in-suite `vercel-package-boundary` `70/70`, full suite `3495/3495` with
  `QUALITY-GATES OK`, and audit zero; `3492/3492` and `3494/3494` are
  historical/superseded. Expanded D7 is complete and Codex GO. Accepted D7
  evidence is the fresh-context role-isolation run with separate browser
  contexts, `3511/3511` with `QUALITY-GATES OK`, audit zero, and
  `24/24 -> 18/18 -> 46/46` with the frozen fingerprint unchanged.
- This context-only grounding does not authorize implementation or R8. OFF.2
  through OFF.6 are deferred until pilot review, not cancelled, and remain
  required before final Milestone 12 GO.
- Production is https://campusphere-cspc.vercel.app on accepted deployed
  baseline d422b54393f659125912ec5c84ae7927c2533288. The read-only SEC-51
  production smoke for that exact baseline is independently Codex-accepted.
- Local HEAD is the later documentation-only commit
  db034e5581e6f409083a43dcb80fb82b473e0127; it is not the deployed runtime.
  At the opening of the continuity sync, main was one commit ahead of
  origin/main, with backup-pre-trailer-strip and refs/original safety refs.
- The opening worktree contained only uncommitted changes in
  docs/security-checklist.md, docs/test-evidence.md, and
  scripts/quality-gates.js. The current local candidate also includes
  synchronized authority-document changes and the bounded
  services/auditService.js schedule-action allowlist repair. It remains
  uncommitted and unaccepted.
- Current independently verified database truth is 24/24 credential safety,
  18/18 residue, and BE.6 46/46. The exact leaked hotspot and sibling schedule
  are absent; all four canonical Supabase identities have zero unexpired
  sessions; MySQL is clean; all 26 selected scenes match; both backends have
  51 selected-source hotspots with selected-VR fingerprint
  ec66f04bf827bc9c8494a9007ff2e89d7990dd77cc7c5a9d629977ec583f6c6b.
- Before the separately authorized 2026-07-30 restoration, the historical
  state was 22/24 -> 16/18 -> 41/46 with the exact CCS hotspot, sibling
  schedule, and two canonical Supabase sessions. That superseded incident is
  not current database truth.
- Frozen aggregate fingerprint is
  a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d.
  The local-candidate package boundary is 158 files, 6,201,747 bytes, SHA-256
  acfb1696de0c8855e02aa82e243fec959aefec637f29bdf033bc34ffda42e8b1.
  Before the audit repair, the prior local candidate was 158 files, 6,201,603
  bytes, SHA-256 28403afaca31b90849d8cc76c1ec0501f29444d138e865053337617b664d3636.
  Migrations are exactly 0001-0019; migrations 0014 through 0019 are
  owner-applied, and no 0020 exists.
- Verified routing topology is 20 nodes, 48 directed edges, 24 exact reverse
  pairs, 48 valid geometries, and 13 routable building destinations.
  CampuSphere routing uses its own campus graph and owner-managed
  `route_edges.path_geometry`; it has no Google Maps, Google Earth, Strava,
  SIS, or external routing-engine dependency. Guided VR claims arrival only
  when the last mapped scene belongs to the destination; otherwise it shows
  the explicit coverage-ended notice.
- 3752/3752, 3755/3755, 3760/3760, and 3763/3763 are
  historical/superseded or rejected candidates, not current R8 evidence. The
  first authority/audit/total-consistency execution is rejected: 3,742 checks
  passed and 30 failed out of 3,772, with no QUALITY-GATES OK. The later
  3,774/3,777 execution is also rejected. An earlier frozen 12-file matrix was
  recorded as green 3777/3777; that record is superseded and rejected, because a
  fresh execution against those exact older bytes exited 1 at 3776/3777 with one
  static failure, cloudinary-docs :: docs contain no JWT/PEM/AWS/long-hex secret
  values, raised by an unlabeled 40-hex Repository HEAD value in
  docs/deployment.md.
- A bounded documentation-only correction labelled that value as Repository HEAD
  and preserved the truthful claim that the commit is a documentation-only
  commit and gate-work candidate, not a runtime deployment.
  scripts/quality-gates.js was not changed by that docs-secret-label correction.
  A byte-consistent matrix was then executed once against the corrected
  manifest: preflight and postflight matched 12/12 hashes with Git, migration,
  and process state unchanged, logout was 75/75 at exit 0, npm test exited 0 at
  3777/3777 with QUALITY-GATES OK present and QUALITY-GATES FAILED absent, npm
  run qa exited 0 with exactly 3,777 contract PASS lines before QUALITY-GATES OK
  and all five green markers exactly once, and final ordered postconditions were
  24/24 -> 18/18 -> 46/46 at exit 0 each. That 3777 total is a transcript-wide
  PASS-line reconciliation across parent quality-gate output plus inherited
  spawned-probe stdout, not an in-process makeRecorder counter.
- The byte-consistent result is current candidate evidence only and remains
  unaccepted pending independent read-only review. No R8 GO, SEC-51 GO,
  deployment GO, pilot GO, Milestone 12 GO, commit readiness, or deployment
  authorization is claimed.
- At restoration time, admin.schedule.delete was absent from the audit
  allowlist and POST /logout emitted no audit-service event. No retroactive
  audit row is claimed. The executor's extra read-only probes and persistent
  Claude-memory write are retained as disclosed boundary deviations.
- The owner-created Google Form is READY external evidence. Its URL and all
  secret values remain outside Git.
- Never run syncSelectedCasVrSupabaseToMysql.js --apply for this incident.
  Never use direct SQL, direct session-row deletion, broad cleanup, or
  migration 0020.
- Candidate verification is complete. M12.P1-R8 is the next potential section
  and is read-only. R8 is not authorized by this context-only grounding. The required
  sequence is R8 read-only review, then a separate owner deployment decision.
  Staging, commit, push, and deployment remain unauthorized.
- M12.P1 remains NO-GO. Deployment is not authorized; deployment readiness,
  pilot readiness, and Milestone 12 remain NO-GO.

Return only a grounding report with:
1. Files and capabilities inspected.
2. Accepted, current-restored, historical/superseded, and unaccepted-candidate
   evidence kept separate.
3. Exact Git, migration, production-baseline, package, topology, VR, and BE.6
   truth.
4. Documentation inconsistencies or scope drift, if any.
5. Current blockers and the exact separate owner authorization required next.
6. Confirmation that no command changed repository, process, database, vendor,
   OAuth, Cloudinary, Upstash, or deployment state.

Do not implement and do not claim completion or GO. Stop after the grounding
report and wait for a new explicit owner-authorized execution prompt and later
independent Codex review.
```
