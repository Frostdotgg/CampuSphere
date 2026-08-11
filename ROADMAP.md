# CampuSphere Completion Roadmap

## Source Review Note

All requested files were readable: `AGENTS.md`, `CLAUDE.md`, `MANUSCRIPT_TEAMDUTCHESS.pdf`, and the first-party source files outside `node_modules`. The manuscript PDF was parsed from its text streams. A few extracted sections had formatting noise, especially the numbered objectives, but the project scope, modules, testing plan, and technical expectations were readable enough to compare against the codebase.

## Scope Revision Note

The team has revised the capstone scope to remove simulated academic records from the role dashboards. The final roadmap no longer includes fake student enrollment status, simulated enrollment information, fake instructor assigned-room widgets, fake instructor teaching schedules, or a fake instructor "all rooms" dashboard feature. Student and instructor dashboards should focus on role-appropriate campus navigation, announcements, profile information, room/facility schedule information where real data exists, and quick access to map/building/event features instead of pretending to integrate with enrollment systems.

Real room/facility scheduling is now a post-Milestone 8 manuscript-alignment item. It must be implemented as admin-managed schedule data, not as hardcoded dashboard filler.

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
are unaccepted candidate evidence. The ordered matrix is complete; another
independent read-only review of the corrected exact manifest remains open. The
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

<!-- M12.P1 CURRENT STATUS START -->
**CURRENT STATUS (2026-08-11 Guided-VR catalog-remediation candidate).**

Accepted history remains unchanged: Milestones 8-11, RF.1-RF.6, BE.1-BE.6,
OFF.1, M12.P1 R1-R7, D1-D5, and expanded D7 are complete and Codex GO. OFF.2-OFF.6 are
deferred until the limited human-pilot review, not cancelled, and remain
mandatory before final Milestone 12 GO.

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

The clean starting Git baseline for this candidate was
5076e1316cf68e9d05c78a61b2362d1727873a09 on local HEAD and origin/main. That
value is a starting baseline, not a self-referential claim about the final dirty
worktree. The owner-observed Vercel Production alias remains
https://campusphere-cspc.vercel.app on deployed baseline
0627bf78228148e3f989275810c333c16a1f3356. The current worktree is intentionally
dirty and unstaged. Nothing from this candidate has been committed, pushed,
linked, or deployed. The accepted 0627bf7 five-file verification, anonymous
production smoke 31/31, and automated frozen-data rehearsal remain historical
evidence and do not verify this new candidate.

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
ordering. The prior manifest and its NO-GO disposition are historical; these
corrected bytes still require a new independent read-only review and claim no
GO.

A subsequent independent read-only review of exact 33-file manifest SHA-256
`2f78d9754094572ac2b6a2bec02786d66b35a651141cd8c0f5705ac85d1282a8`
returned commit-readiness NO-GO on two high findings and one low finding: the
exact package pin was documented but not enforced against the live manifest,
obsolete Guided-VR handoff sections were historical and not operative, but were
not marked away from current authority, and current dates were stale. This bounded correction
adds independent live package-pin enforcement and byte-drift fixtures, isolates
the obsolete handoff sections as explicit history, expands authority/date
fixtures, and synchronizes current dates. It changes no runtime or data and
still requires another independent read-only review.

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
superseded, or rejected. Independent read-only review remains open; these
results establish candidate-review readiness only.

The independent read-only review of exact 34-file manifest SHA-256
`ebf1142c11e3c027c0b3339a6888bc19196936ae3323644d907c68def224c4b4`
returned commit-readiness NO-GO because the same rejected 4,628-PASS retry was
described once with the exact nine current-authority wording failures plus
residue and again with an incorrect lower failure count. This bounded correction
removes the stale duplicate account and adds one cross-document analyzer with accepting and
rejecting fixtures. It changes no runtime or data. The prior `4639/4639` matrix
and manifest are historical candidate evidence; the corrected bytes require a
new independent read-only review and claim no GO.
The first verification execution of this correction is historical/rejected at
`4640/4641`: the new analyzer inspected only the evidence ledger's first 4,628
mention, so its one combined live assertion failed even though all runtime
probes and embedded residue were green. It now evaluates every bounded 4,628
scope and requires at least one exact transcript-faithful account; no session or
data correction was required.

M12.P1-R8 remains the next potential section and is read-only under the
repository's established gate wording. R8 is not authorized by this
synchronization; even R8 GO authorizes only a separate owner deployment
decision. M12.P1 remains NO-GO for deployment and pilot readiness; deployment
is not authorized. Human pilot/Form responses, OFF.2-OFF.6, and final Milestone
12 acceptance remain open. Do not claim a new GO from this candidate.
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

The eventual pilot exposes the full authenticated application while
facilitators guide students and guests to evaluate routing. Feedback uses an
owner-created Google Form; no CampuSphere feedback table, API mutation, or
migration is added. OFF.2 through OFF.6 resume after pilot review and remain
mandatory before final Milestone 12 GO. D6 remains the lowest-priority item and
runs post-pilot after OFF.2-OFF.5 and before OFF.6.

### Deferred Offline Campus Navigation Package

The following work is deferred, not cancelled. It must resume after the
limited-pilot findings are reviewed.

**OFF.2 — Installability, Offline Shell, and Update Lifecycle**

- Complete manifest/installability behavior and the session-neutral shell.
- Add visible online/offline and update-available states, safe activation,
  version cleanup, interrupted-install recovery, and reconnect handling.
- Keep authenticated HTML and sensitive routes network-only.

**OFF.3 — Privacy-Safe Public Data Availability**

- Package the current BE.6-frozen public catalog for the selected supported
  backend, precomputed route data/geometries, approved public schedules, and
  Guided-VR metadata for all 25 active destinations in bounded, versioned,
  read-only storage after explicit user download. The 13-building roster
  remains only the reproducible seed baseline, not the complete campus.
- Exclude sessions, CSRF, credentials, profiles, admin/private responses,
  mutations, raw errors, and personalized HTML.

**OFF.4 — Offline Map and Destination Routing**

- Render the frozen destinations, route lines, steps, and unavailable states
  without network access.
- Do not mirror OpenStreetMap; the route experience must remain readable when
  tiles are absent and preserve clearing/stale-response behavior.

**OFF.5 — Offline Guided-VR Catalog and Free Roam State**

- Represent all 25 active destinations in the offline catalog and cache only
  explicitly downloaded, owner-approved media plus the required Free Roam
  entry path within the agreed quota.
- Treat uncached or partially downloaded media as an offline availability
  state without changing the route's online active policy or claiming arrival;
  preserve schedule hotspots only when their bounded public data and required
  media are cached.

**OFF.6 — Offline Feature, Privacy, and Final GO/NO-GO**

- Run clean-install and warmed-cache desktop/mobile matrices for restart,
  network loss, all 25 catalog routes, a fully cached chain, an uncached active
  route, interrupted/partial media, Free Roam, schedules, quota/errors,
  upgrades, reconnect, logout, and shared-device privacy.
- Require zero private cache data, zero server mutations, green online
  regressions, and complete fixture/service-worker/listener cleanup.
- OFF.6 GO is required before final Milestone 12 GO.

### Milestone 12: Vercel Demo Deployment

Priority: P1

Goal: support Vercel as a demo/UAT target, not as the full production deployment path.

#### M12.P1 — Limited Routing-Focused Pilot

Status: the audit is complete with Codex NO-GO; blocker remediation is in
progress, and deployment is not authorized.

- The completed audit covered the entire exposed authenticated surface, Vercel
  configuration, Supabase-only data operation, Supabase sessions, OAuth
  redirects, cookies, CSRF/CSP/rate limits, logs/errors, secrets, Cloudinary
  delivery, service-worker behavior, rollback, and tester accounts.
- R1-R7 and D1-D5 are complete and Codex GO. R3 (awaited Vercel runtime and
  session bootstrap), together with all session-hygiene/ownership/import-
  detector follow-ups, is complete and Codex GO. R4 (shared Upstash rate
  limiting) and the dependency-security remediation are complete and Codex GO.
  `M12.P1-R5` (bounded anonymous access-denial auditing), its authoritative
  global-total follow-up, and its documentation-gate final correction are
  complete and Codex GO. `M12.P1-R6` (self-hosted browser dependencies) is
  complete and Codex GO. `M12.P1-R7` (Vercel package and static-CDN boundary)
  and both source-auditability corrections are complete and Codex GO.
  M12.P1 remains NO-GO for deployment and pilot readiness.
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
- R8 is a read-only integrated readiness review. R8 GO does not deploy; it only
  permits the owner to make a separate deployment decision.
- Only after that separate owner authorization may the full authenticated app
  be deployed for facilitated student/guest routing evaluation. No anonymous
  browsing is added.
- Collect feedback through the owner-created Google Form; add no feedback
  table, API mutation, or migration.
- Classify and review pilot findings before OFF.2–OFF.6 resume.

#### M12.P2 — Final Demo/UAT Closeout

Status: blocked by pilot review and OFF.2–OFF.6.

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
