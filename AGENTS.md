# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

CampuSphere is an Express 5 + EJS server-rendered web app that delivers a virtual campus map tour for Camarines Sur Polytechnic Colleges (CSPC). Authentication uses session cookies (express-session) with bcrypt for local credentials and Google OAuth as a second sign-in path. Persistence spans two backends selected at runtime: **Supabase/PostgreSQL is the production data store and production session-store target**, while **MySQL (via the `mysql2/promise` pool) remains the local-development / fallback / local-rehearsal store**. Supabase Auth is not used — CampuSphere keeps Express sessions, bcrypt local login, and Google OAuth. Server-side data access goes through the `repositories/` and `services/` layers (the session stores also live in `services/`).

## Common Commands

```bash
npm start                  # Run server on PORT (default 3000) via node server.js
npm run dev                # Run with --watch for auto-restart on file changes
node database/seed.js      # Create DB, apply schema.sql, seed default users + content
```

`npm test` runs `node scripts/quality-gates.js` — a self-terminating contract/security gate that boots the app through `scripts/with-server.js` (never a foreground server) and asserts the auth/authz/CSRF/CSP/PWA/media contracts in both MySQL and Supabase session modes. It also spawns the four room-scheduling probes (`scripts/scheduleRepository-probe.js`, `scripts/adminScheduleCrud-probe.js`, `scripts/publicScheduleDisplay-probe.js`, `scripts/vrScheduleHotspot-probe.js`) covering schedule backend parity, admin-only schedule CRUD/validation, public building schedule display, and VR room-door schedule interaction (empty states, leak boundaries, cleanup) in both runtime modes. Related scripts (see `package.json`): `npm run qa` (contracts + db-perf + supabase-smoke + identity + audit), and the individual gates `qa:contracts`, `qa:db`, `qa:smoke`, `qa:identity`, `qa:audit`. Do not run `node server.js`, `npm start`, or `npm run dev` in the foreground (Windows job-object hang) — use the `scripts/with-server.js` harness for runtime probes.

Seven M12.P1 probes remain standalone rather than registered inside the
`npm test` total: `scripts/pilotCredentialSafety-probe.js` (R1, `24/24`),
`scripts/vercelProductionProfile-probe.js` (R2, `119/119`),
`scripts/vercelRuntimeSessionBootstrap-probe.js` (R3, `86/86`),
`scripts/sharedRateLimit-probe.js` (R4, `180/180`), and
`scripts/boundedAnonymousAccessDenial-probe.js` (R5, `90/90`, dedicated ports
`3381`/`3382`), `scripts/selfHostedBrowserDependencies-probe.js` (R6,
`230/230`, dedicated ports `3383`/`3384`), and
`scripts/vercelPackageBoundary-probe.js` (R7, current candidate `72/72`,
dedicated port `3385`; accepted R7 closeout remains historical `71/71`).
Never describe any of them as part
of the accepted R4
`3040/3040` full-suite total, the superseded pre-R5 `3050/3050` total, the
accepted R5 `3234/3234` full-suite total, the accepted R6 `3415/3415`
full-suite total, the superseded M12.P1-R7 candidate `3492/3492` and literal-NUL
remediation `3494/3494` totals, or the M12.P1-R7 audited-source list pinning
accepted closeout `3495/3495` total. A context-only grounding prompt must
not run them.

**Probe session hygiene.** Every probe that authenticates a canonical
regression identity must own that session: register each jar with
`scripts/probeSessionLifecycle.js` immediately after login and terminate it
from a `finally` through the real logout interface. `scripts/with-server.js`
resolves the child's `SESSION_STORE` from the normalized data mode when
`sessionStore` is omitted and fails closed on a blank/invalid explicit value,
so an ambient `SESSION_STORE` can never leak into a probe leg. The registered
final gate `scripts/probeSessionResidue-probe.js` is the authoritative
postcondition (SELECT-only, zero unexpired canonical sessions in both stores);
the static ownership inventory discovers probes from the filesystem as well as
the registered list, but proves source patterns only.

The same contract suite also runs the road-routing probes for topology, stored geometry, API assembly, public Leaflet/MapLibre rendering, admin geometry editing, map-to-guided-VR flow, Free Roam, VR schedule hotspots, and the BE.6 expanded Guided-VR freeze. BE.6 and OFF.1 are complete and Codex GO. The current candidate freezes MySQL at 34 buildings, 44 route nodes, 100 directed edges, 50 exact reverse pairs, and 100 valid geometries; Supabase at 25 buildings, 26 route nodes, 50 directed edges, 25 exact reverse pairs, and 50 valid geometries; and the shared Guided-VR catalog at 25 active destinations, 472 configured steps, and 99 unique scene keys. The 13-building `models/data.js` roster is the reproducible seed baseline, not the complete campus; admin edits and later additions remain supported but invalidate freeze evidence until it is deliberately refreshed.

<!-- M12 RELEASE CONTINUITY START -->
## Current Release Continuity (2026-08-24)

Live Git at the start of this authority synchronization was branch `main`,
with local `HEAD`, `origin/main`, and remote `main` all equal to pushed Git
commit SHA-1 `dc961b1eeba191d79b96998d96f0a49dac3ffcf8`. The index was empty;
the worktree contained exactly 58 modified tracked paths and 12 untracked paths
(70 dirty paths total), with zero stashes. Eleven authority documents plus
`scripts/quality-gates.js` are the 12 tracked authority/static-assertion
surfaces; the other 46 tracked paths and all 12 untracked paths belong to the
current uncommitted implementation. The retained safety branch
`backup-pre-trailer-strip` points to Git commit SHA-1
`d387c9151f1582cc4a8fc80002be52e11956335f`. Preserve this worktree exactly
and recompute live Git truth in every new session rather than reusing this
time-specific snapshot.

The release lineage is verified offline implementation Git commit SHA-1
`d786bdcb83a196c7263dceae668417d3ced3e95a`, bounded readiness/session
maintenance Git commit SHA-1 `c00db76c5be0fe9c8dfdc8168a4c4303c6a0aa64`, independently reviewed
release-authority Git commit SHA-1 `bb17b9b603583bcc2934e3ffab1cbdcb7d6b0ddd`, and searchable
course-catalog enhancement Git commit SHA-1
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
this record. Migrations remain exactly `0001`-`0019`; migration `0020` does not
exist and is not authorized. Preserve one-writer control and the external
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

The current 70-path worktree contains an uncommitted multi-feature
stabilization candidate. Implemented surfaces include valid Guided-VR and Free
Roam scene arrows; VR light/dark theme parity; smaller accessible building pins
online and offline; the offline display label `Guard House`; the authenticated
notification feed/panel and its cross-page stylesheet ownership; the Paga About
card; admin category-dropdown styling and user role/status filters; safe Google
profile-image synchronization; and a server-side manual profile-photo flow.
The manual flow uses authenticated `POST` and `DELETE /api/profile/photo`,
memory-only single-file handling, and the exact Cloudinary folder
`CampuSphere/profile-images`, but it is not accepted: the dedicated limited
key still lacks the required folder permission, the support response remains
external and pending, and the temporary setup key is disabled. Do not record
or reuse any credential, account identifier, support contact, or secret.

The owner-run `scripts/syncSupabaseContentToMysql.js --dry-run` preview was
read-only and reported no content differences; the Supabase source and MySQL
target fingerprints both equalled SHA-256
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

After the recorded grounding snapshot, the owner separately authorized a
bounded supported MySQL reconciliation, verification of the non-Cloudinary
candidate, and an exact commit/push. The prepared release candidate covers 58
changed paths relative to `dc961b1`: 49 tracked modifications and nine added
paths. It contains the Guided-VR/Free Roam arrows, VR theme parity, compact
online/offline pins and the offline `Guard House` label, authenticated
notifications, cross-page styling, the Paga card, admin dropdown/user filters,
safe Google profile-image synchronization, and the content-sync operator. It
excludes the manual profile-photo upload runtime, endpoints, dependencies, and
probe. That Cloudinary work remains unaccepted, deferred, and outside this
release.

Before reconciliation, a full MySQL backup was written outside Git. The
bounded repair used authenticated supported administrator interfaces only; no
seed, sync apply, restore, migration, or direct SQL data write was used. Users,
role profiles, guest profiles, and session rows remained exact; `system_logs`
grew only through expected audit records. The refreshed MySQL freeze passes
BE.6 at `46/46`, and the SELECT-only canonical session postcondition passes
`18/18`.

The exact candidate passed `npm test` and the five-stage `npm run qa` at
`5104/5104` with `QUALITY-GATES OK`, `DB-PERF-GATE OK`,
`[supabase-smoke] PASS`, `IDENTITY-CONSTRAINTS OK`, and `found 0
vulnerabilities`. The package boundary is 172 files and 7,141,628 bytes,
aggregate SHA-256
`43ca180186e8bb85152ac04e60a3226fda55c5885d632d26ff5de26a6db611db`.
The current Codex code-reviewer pass found no critical, high, medium, or low
findings. These are local candidate/review facts until live Git records the
commit/push. They are not deployment, promotion, Production-byte,
Cloudinary-upload, Android-PWA, or final Milestone 12 acceptance evidence.

Every older section below that labels the pre-promotion maintenance state as
“current” is retained only as a historical snapshot. This continuity block and
live repository/vendor evidence win when they conflict.
<!-- M12 RELEASE CONTINUITY END -->

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
complete for sequencing purposes.

The accepted local OFF.2-OFF.5 implementation is committed as
`cdbc863b779e5319c14dee21a31a5e78951e233c`. It begins from clean main
`7ec8cc6e82c3a8e1824697696311675c1d23a572` and integrates the preserved OFF.2
lifecycle work with revised OFF.3-OFF.5. Offline scope is strictly a normal
2D campus map, current-backend buildings and precomputed road-following routes
from Guard House / Main Gate, plus a node/list building-details window using
text and a local generic placeholder. It contains no 360 images, Guided VR,
Free Roam, schedule data, Cloudinary media, building photos, user/session/admin
data, or server mutation. The explicit authenticated no-store download verifies
guide and content-addressed PMTiles hashes before one atomic IndexedDB replace;
the service worker never caches the package API or map archive, and explicit
logout deletes only that guide database.

A bounded correction then tightened the offline cache scope, the durability of
that logout, and the guide's read path. `/api/vr/routes/*` and every Cloudinary
request are network-only and never Cache Storage eligible; OpenStreetMap tiles
are the only remaining cache-eligible external host, retained because the
existing online map depends on them. Ordinary online Guided-VR and Cloudinary
delivery are unchanged: the worker declines to handle those requests rather than
blocking or rewriting them, so they stay on the browser's normal network path.
`CACHE_VERSION` advanced exactly once from `v12` to `v13`, so activation removes
the preceding v12 API/external caches while preserving unrelated caches. Atomic
shell installation, user-controlled `SKIP_WAITING`, no automatic reload,
network-only personalized HTML, sensitive-route exclusions, non-GET
pass-through, and bounded cleanup are unchanged. Logout now writes an exact
namespaced pending-deletion marker before `logged_out=1` is stripped or any
asynchronous cleanup begins, signals every open tab to reset the guide runtime,
deletes only `campusphere-offline-guide`, clears the marker only after
`deleteDatabase` succeeds, coalesces concurrent attempts, keeps blocked and
error attempts pending, and retries on later CampuSphere page loads; no
unrelated database, cache, localStorage key, session, or application data is
touched. One offline-guide download now reads each required dataset once and
drives both availability decoration and route generation from that single
immutable snapshot — route-node and route-edge reads fell from two to one each
and the request total from eight reads to five — while canonical-name collision
handling, mixed `BUILDING_DATA_SOURCE`/`ROUTE_DATA_SOURCE` behaviour, the Main
Gate origin, stored-geometry validation, unavailable reasons, and the emitted
schema and fingerprint are preserved. No direct SQL beyond the existing
repository/service read paths, endpoint, schema change, or migration `0020` was
added.

A second bounded correction then confined Cache Storage to the approved 2D
scope. Same-origin cache eligibility is now an EXACT allowlist derived from the
reviewed `PRECACHE_URLS` and matched on pathname plus query string, replacing
the extension-wide rule that had silently admitted every same-origin
`.png`/`.jpg`/`.webp` outside `/img/vr/`, including local database-selected
building photos. `/css/styles.css?v=5` remains cacheable while
`/css/styles.css?v=6` is not. Every other same-origin static or media request,
and every cross-origin request without exception, is network-only. The external
cache constant, its size cap, the approved-host classifier, the cross-origin
strategy and its mode helper were REMOVED rather than left dormant, and the
external cache is gone from `CURRENT_CACHES`. OpenStreetMap tiles are no longer
mirrored: the offline map renders from the bundled content-addressed PMTiles
archive, while OSM remains CSP-permitted and the ONLINE Leaflet/MapLibre map is
untouched. `CACHE_VERSION` advanced exactly once from `v13` to `v14`, so
activation removes the unaccepted local v13 shell/static/API/external caches and
every other stale `campusphere-pwa-*` version while preserving unrelated caches.
Atomic precaching, deterministic failure recovery, the waiting-worker
user-approved activation lifecycle, network-only personalized HTML,
sensitive-route exclusions, non-GET pass-through, `/api/offline-guide`
network-only ownership, PMTiles download ownership by the explicit IndexedDB
manager, Guided-VR and Cloudinary network-only behaviour, the durable logout
deletion, and the shared route-snapshot read path are unchanged.

A third bounded correction then removed automatic API caching entirely. Every
same-origin API request — `/api/buildings`, `/api/routes`, every
`/api/routes/*` path, `/api/vr/routes/*`, `/api/search`, `/api/pathfind`, and
every query-string variant — is network-only, matched by a single `/api`
network-only prefix on pathname. `API_CACHE`, `API_MAX`, `isApprovedApi()`,
`apiStrategy()`, the synthesized offline JSON response, and the approved-API
fetch branch were REMOVED rather than disabled, and `CURRENT_CACHES` now holds
only the shell and static caches. The reason is the consent boundary:
`/api/buildings` and `/api/routes*` return building rows carrying Cloudinary
image URLs and local building-photo references, so caching them retained media
references the user never consented to download, contradicting the
explicit-download offline-package model. The worker issues no `respondWith()`,
performs no Cache Storage read or write, and applies no response transformation
to any API request, so online API response shapes, headers and status codes are
exactly what the server sends. `CACHE_VERSION` advanced exactly once from `v14`
to `v15`, so activation removes the unaccepted local v14 shell/static/API caches
and every older CampuSphere generation — including prior API, external and page
caches — while preserving unrelated caches. The exact static-shell allowlist,
atomic precaching and failure cleanup, user-controlled `SKIP_WAITING` and single
reload, non-GET pass-through, authenticated/admin HTML network-only behaviour,
`/api/offline-guide` ownership, Guided-VR/Cloudinary/OSM/local-photo/panorama
network-only behaviour, PMTiles and offline-guide IndexedDB ownership, and the
durable logout deletion are all unchanged.

Accepted focused evidence is green after that correction: the integrated
OFF.2 lifecycle probe passes `145/145`, the database-free 2D offline-navigation
probe passes `35/35`, and focused package-boundary verification passes `74/74`.
A fourth bounded correction then made the service-worker header truthful and
the guards exact. The header no longer claims api/external caches or approved
cross-origin caching; it states that only the shell and static caches exist,
that only exact reviewed shell assets are Cache Storage eligible, that every
cross-origin and every same-origin `/api` request is network-only, that
`API_CACHE`/`EXTERNAL_CACHE`/approved-host caching/synthesized API fallbacks do
not exist, and that the successful-response and redirect rules apply only to
reviewed shell/static caching. That edit is documentation-only: the
comment-stripped `public/sw.js` hash is byte-identical before and after, so
executable behaviour is unchanged. The OFF.2 analyzer, the quality gate, and
the self-hosted probe now each require exactly one `/api` network-only prefix,
the complete classifier truth table evaluated behaviourally in an isolated
`node:vm` (true for `/api`, `/api/buildings`, `/api/routes`, `/api/routes/1`,
`/api/vr/routes/1`, `/api/search`, `/api/pathfind`; false for `/apiary`,
`/apis`, `/auth`, `/map`, `/`), `CURRENT_CACHES` tokenizing to exactly
`[SHELL_CACHE, STATIC_CACHE]`, absent API machinery, and the guard running
before every remaining same-origin strategy — failing closed on any extraction
or evaluation error.

The committed offline UI/accessibility implementation package is 168 files,
7,073,128 bytes, aggregate SHA-256
`1d6cc68b7ef350b6a61eb8d84ea4fb7dd6862bd8548beb7595d3f2e6f4b10d6a`.
The rejected pre-correction package was 168 files, 7,071,943 bytes, aggregate
SHA-256 `dd00055741fedecd9d99f081c612f8c18e6573d7a121d5903d866fcebddb0a33`;
it is historical candidate evidence only.
The package identity is independently pinned and the implementation's replacement
verification is recorded above; it is not deployment authorization. The accepted local D6/OFF predecessor package remains
historical at 168 files, 7,042,705 bytes, aggregate SHA-256
`fe08232edf026edcbd33371df7d484bfaf39e3de0dafe22f5144e18e08efbf2b`.
Historical/rejected after the independent M12.P1-D6 review, never accepted:
the first D6 candidate at 168 files, 7,022,574 bytes, aggregate SHA-256
`779d331824026ce0c1c9510e6393790d0a8da508498a395c1e97d9a04c19e7fd`, whose
15-file ordinal manifest was
`a6202b0f2106f244d58a41fbc1d646f360356df299790d5f88d44fe2729a2bc2`.
Historical/blocked, never accepted: the preceding OFF.3-OFF.5 2D
offline-navigation candidate at 165 files, 6,971,229 bytes, aggregate SHA-256
`e383f2fe708c5233192ec3602727ed2029dbc906df1ad53a75a70f6fa583334b`.
Historical/blocked independent-review evidence, never accepted: candidate
manifest `af7a1a333db0653449727ee5b6b7f223606686a05717ef6f107607bd99f04e9c`
with package 165 files, 6,970,280 bytes, aggregate SHA-256
`fc5d8bdcc7a6482bd256d4504224018cfc56ba418f56d81babd6e0ec5a4ff783`, superseded
because its service-worker header and its API guards were incomplete.
Historical/blocked and never accepted: the preceding candidate at 165 files,
6,969,343 bytes, aggregate SHA-256
`2dd88fede872db81a771a9d7273c8fd0264e2f6006d5eee09f33a1b930400523`, and its
candidate manifest
`60154d93a3a3109a374a80ffeb4e20f8650aaa131b9b4ff97c16b028cade5f2d`, are
SUPERSEDED because automatic API caching contradicted the consent-driven
offline-package boundary and could retain building image references. The earlier
165-file, 6,968,875-byte candidate with aggregate SHA-256
`115dccba1fc4d9707caa5c43cc8bd7f9340bd7d92286513ad562d60af60b100f` remains
historical/blocked as well, because that probe required OSM caching and never
exercised same-origin building photos, non-shell static files, or OSM requests.
The accepted technical Production predecessor is unchanged and separate: 158
files, 6,245,074 bytes, aggregate SHA-256
`b3113c05daaa5d2e870f204083923434456580fa6499190421de062ce9cabbd4` on
`fea3b2e11c6331eddc1ee091b165427d8e0218d7`.
The first full verification of this offline candidate is historical/rejected at
`4635/4641`: `npm test` exited 1 after 4,635 PASS lines and emitted no
`QUALITY-GATES OK` because exactly six static documentation/authority assertions
failed. Every executed runtime, database, catalog, BE.6, and final embedded
`18/18` residue check was green. Fail-closed sequencing stopped before
`npm run qa` and before the standalone `24/24 -> 18/18 -> 46/46`
postconditions. At that historical point, the bounded correction was confined
to current-authority documentation and existing static assertions and claimed
no Codex GO. It was superseded by the later independent review and definitive
replacement verification recorded below; no session or data correction was
required.
The accepted local M12.P1-D6 admin dashboard analytics implementation is
committed as `691f0bef40e06b6ea9485e713d2fe3000a03bd83`. It replaces the dashboard's
hard-coded chart arrays with real data read from the currently selected
backends: account and building additions for the latest 12 Asia/Manila calendar
months including the current month, exact `student-cspc`, `instructor`, `admin`,
and `guest` account counts, and real total-user and total-building values. The
fabricated map-view series, the invented role array, both `Sample data` pills,
and their sample-data notices are removed. Analytics data access is confined to
the new `services/adminAnalyticsService.js` and the new dual-backend SELECT-only
`repositories/analyticsRepository.js`, which honour `AUTH_DATA_SOURCE` and
`BUILDING_DATA_SOURCE` independently; the controller holds no analytics SQL.
Month ranges are half-open — inclusive start, exclusive end — at a fixed
UTC+08:00 Manila offset, so year rollover and leap-year February are exact and a
boundary row is counted exactly once. A genuine zero displays as zero; a failed
or truncated read displays `Unavailable` and never a fabricated zero, behind one
fixed sanitized message carrying no database, SQL, stack, credential, host, or
backend identifier. Both charts are progressive enhancement drawn by
`public/js/admin/dashboard-analytics.js` from semantic tables that stay complete
without JavaScript, and they redraw on container resize and on `data-theme`
change. No schema, migration, RPC, seed, tracking table, analytics table,
dependency, public analytics endpoint, or persisted analytics result was added,
and no page-view, visit, session, IP, or user-agent data is collected. The
registered `admin-dashboard-truthfulness` gate is replaced by the
`admin-dashboard-analytics` gate, and `scripts/adminDashboardAnalytics-probe.js`
is registered for later full-suite execution.

An independent read-only M12.P1-D6 review then returned four findings, and one
bounded correction addressed all four. `controllers/adminController.js` was not
edited and no sixteenth path was created.

1. Malformed analytics counts now fail closed. One exact count parser accepts
   only a nonnegative safe-integer number or a digit-only nonnegative integer
   string within `Number.MAX_SAFE_INTEGER`, and rejects null, undefined,
   booleans, blanks, negatives, fractions, `NaN`, `Infinity`, arbitrary strings,
   and unsafe integers. The role map must carry EXACTLY the four reported own
   keys with every value parsing exactly, and the four counts must SUM to the
   total user count; a missing role, an extra role, an invalid or unsafe count,
   an invalid total, or a sum mismatch makes the users side unavailable, and an
   invalid building total makes the buildings side unavailable. The bucket
   validator additionally rejects any result whose outside count exceeds zero.
   Every `Number(...) || 0` coercion is gone from the D6 repository and service;
   MySQL role aggregation still initialises the four known roles to zero but
   rejects an unreported returned role, and Supabase validates all four counts.
2. Backend comparison evidence is fail-closed. The ordinary probe run REQUIRES
   both the MySQL and the Supabase comparison legs; an unreachable,
   unconfigured, or skipped leg records no PASS, fails the run, and suppresses
   `ADMIN-DASHBOARD-ANALYTICS-PROBE OK`. `PROBE_SKIP_SUPABASE=1` is read as a
   rejected skip request rather than as permission. A separate, explicitly
   named `--static-only` entrypoint runs the pure sections, initialises no
   database, prints the distinct `D6-STATIC-ONLY-PROBE OK` marker, and can never
   print the ordinary marker; the registered suite stage spawns the ordinary
   mode.
3. Supabase pagination is deterministic. Timestamp enumeration selects
   `id, created_at`, orders by `created_at` ascending and then `id` ascending,
   keeps bounded paging with its hard ceiling and half-open windows, and exposes
   only timestamps to the service. The independent comparison uses the same
   composite-ordered paginated read rather than one large limit.
4. Chart accessibility is corrected. Hard-coded chart colours are replaced by
   semantic `--analytics-*` light/dark tokens shared by the EJS legend and the
   client renderer, all clearing 3:1 against their own surface; legend labels
   use neutral foreground text instead of small gold text; and the four roles
   carry matching non-colour encodings — solid, diagonal stripe, crosshatch,
   dots — as SVG pattern fills in both the donut and the legend swatches, with
   the semantic role table preserved as the authoritative alternative.

Historical pre-full-verification focused evidence for the corrected bytes is
the D6 probe in STATIC-ONLY mode at
`247/247`, the D6 gate at `113/113`, and the package-boundary probe at `74/74`.
The ordinary database-backed probe mode was NOT executed under that bounded
authorization, and no database was contacted. Full-suite verification was not
authorized and was not run; the structurally expected registered total is `4998`
when both backends are reachable; that statement was superseded by the
definitive database-backed verification below.
Historical/rejected after the review: the earlier D6 probe result `132/132`,
whose MySQL leg was reported NOT EXECUTED while the run still reported success,
the earlier D6 gate at `63/63`, and the earlier `4822` structural total.

D6 commit-readiness is Codex GO. Definitive evidence for 15-file manifest
SHA-256 `317d1312599d66171b08d850d84a746f701d5167f4f31ee233aa55cb0436212d`
is `npm test` `4998/4998` with `QUALITY-GATES OK`, the ordinary D6 probe
`266/266` with both required MySQL and Supabase comparison legs, five-stage
`npm run qa` at the same exact contract total, and ordered postconditions
`24/24 -> 18/18 -> 46/46`. The implementation was then committed locally as
`691f0bef40e06b6ea9485e713d2fe3000a03bd83` without push or deployment.

OFF.2-OFF.6 are Codex GO. OFF.6 browser acceptance passed for both backends:
MySQL covered `34/34` building details and `33/33` available routes with one
truthful unavailable building; Supabase covered `25/25` details and `25/25`
routes. Desktop/mobile layout, search, keyboard activation, offline reload and
map rendering, failed-update preservation, neutral protected-route fallback,
forbidden-data absence, and supported logout deletion all passed. The first
OFF.6 full-suite run is historical/rejected at `4995/4998` because it exposed
unreviewed Supabase geometry drift on route edges 198/199. One separately
authorized supported atomic pair write restored the frozen geometry; focused
BE.6 returned `46/46`, the Supabase building/route fingerprint returned to
`727605aa08c648ea645148087e937ea8f9723ca2fc201c3ece7f7c0229424625`, and
the combined BE.6 fingerprint returned to
`db51567e7a84fe37deeee436b305edd7f3e3aada6138e9111645a604fa12c77e`.
The unchanged 40-file candidate at manifest SHA-256
`e4436faba637bf592e220859469ca59fcf62870be731bc1d915f133c254e79a2`
then passed the replacement `npm test` at `4998/4998` with
`QUALITY-GATES OK`, D6 `266/266`, BE.6 `46/46`, and embedded residue `18/18`.

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
D1-D5, and expanded D7 are complete and Codex GO, including all R3
session-hygiene/ownership/import-detector follow-ups, the R4 shared-rate-limit
follow-up, both R5 follow-ups, dependency-security remediation, both R7
source-auditability corrections, and the expanded D7 cross-role
admin-to-participant regression gate. `M12.P1-R7` is complete and Codex GO.
Accepted R7 closeout
evidence is focused `71/71`, in-suite
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
unchanged. Earlier D7 blocked/partial attempts are historical/superseded.
The post-D7 logout-probe output-hygiene remediation is independently
Codex-accepted as additive evidence: focused `75/75`, full suite `3529/3529`
with `QUALITY-GATES OK`, zero escaped `Logout error:` lines, `npm audit
--omit=dev` zero vulnerabilities, and postconditions
`24/24 -> 18/18 -> 46/46`. It does not supersede or replace the accepted D7
`3511/3511` evidence and authorizes no new section.
A first independent read-only R8 review of the clean-snapshot candidate returned
CANDIDATE NO-GO on pilot-readiness grounds. A separately owner-authorized
pilot-readiness correction was then applied in one follow-up commit: an
anonymous `GET /privacy` notice linked from the anonymous footer and both
authentication surfaces; `X-Robots-Tag: noindex, nofollow, noarchive` on every
response plus `public/robots.txt`; zero dead footer placeholders; the corrected
neutral package-inventory label
`CURRENT VERCEL PACKAGE BOUNDARY INVENTORY - NOT DEPLOYMENT AUTHORIZATION`
pinned independently in `scripts/quality-gates.js`; the owner-approved
facilitator-mediated pilot model in `docs/deployment.md`;
`MANUSCRIPT_TEAMDUTCHESS.pdf` untracked; and a new fail-closed `pilot-readiness`
gate. Indexing control is documented as not being access control.

A second independent read-only R8 re-review of that correction candidate found
further pilot-readiness defects, and a separately owner-authorized re-review
correction was applied in one follow-up commit: the package-boundary probe no
longer claims an intentionally dirty worktree or a current-worktree snapshot and
now states that its inventory reflects current repository bytes, does not itself
establish Git cleanliness or immutability, and is not deployment authorization;
the independently pinned gate rejects every stale worktree wording and the
superseded label; `SEC-37` keeps only the accepted R7 values as history beside a
freshly recomputed current inventory; the privacy notice now scopes its
anonymous-denial claim to authorization-denial audit events while preserving the
separate truthful method/path request-log disclosure; and the local authenticated
exposure matrix was executed in both runtime modes with a separate fresh browser
context per role.

Those corrections await another independent read-only R8 review. No R8 GO, Codex
GO, deployment GO, or pilot GO is claimed by that work.

A separately owner-authorized bounded evidence re-execution has since been
completed as candidate evidence. The local authenticated exposure matrix was
re-run clean — MySQL `34/34` plus a `14/14` supplement, Supabase `64/64` plus a
`14/14` supplement, `126/126` with zero failures — with a separate fresh browser
context per role, zero carried-over cookies and web storage before
authentication, every authenticated session registered immediately with
`scripts/probeSessionLifecycle.js` and terminated exactly once through
`terminateAll()` and the real CSRF-protected `POST /logout`, no `429`, no
retried logout, no import or call of `services/sessionRevocation.js`, and no
direct session-row deletion or database cleanup; final ordered postconditions
were `24/24 -> 18/18 -> 46/46`. `SEC-05` was executed externally and passed: the
unsupported-domain OAuth flow reached `accounts.google.com` with `openid`,
`email` and `profile`, returned to CampuSphere, and was refused at
`/auth?error=unauthorized_domain` with a sanitized message, leaving Supabase
`users` at six rows before and after, zero unsupported-domain rows, no user or
role-profile row, and no persisted pending OAuth registration. The pilot
feedback form is READY as external owner evidence, with its URL kept outside
Git. The first execution of that exposure matrix is historical/superseded and
explicitly NOT accepted: rate-limit `429`s disturbed it, and an orphaned session
was cleared by a direct `revokeUserSessions` call rather than through the
supported logout interface.

The follow-up documentation commit recording that evidence awaits an
independent read-only R8 review. No R8 GO, Codex GO, deployment GO, pilot GO, or
Milestone 12 GO is claimed. Historical/superseded: before `0627bf7`, the
`SEC-51` production smoke ran against deployed baseline
`d422b54393f659125912ec5c84ae7927c2533288` on
`https://campusphere-cspc.vercel.app` is independently Codex-accepted.
OFF.2-OFF.6 remain deferred until pilot
review and are not cancelled. Accepted `R1`-`R7` and `D1`-`D7` history is
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

`M12.P1-R8` is the next potential section. R8 is read-only and is not
authorized by this synchronization; even R8 GO authorizes only a separate owner
deployment decision.
`M12.P1` remains NO-GO for deployment and pilot readiness; deployment is not
authorized.
<!-- M12.P1 PRIOR STATUS END -->

Superseded, historical: an earlier post-synchronization verification run is
preserved as RED and is not accepted evidence — `npm test` ended with nine
failures after Supabase logout/session-destroy failures left unexpired
administrator and student sessions; that post-run safety check was `22/24`, the
embedded residue gate was red, and the embedded BE.6 check did not establish its
frozen postcondition. That blocker is closed: a separately owner-authorized
supported cleanup/restoration was performed and independently reproduced, and
the R6 session re-verified safety `24/24`, residue `18/18`, and BE.6 `46/46`
before editing and again after its own full-suite run.

R6 self-hosts every browser vendor library under `public/vendor` — Leaflet
`1.9.4`, MapLibre GL JS `4.7.1`, Pannellum `2.5.6`, Iconify Icon `1.0.7`, and
Lucide `1.25.0` — with `public/vendor/manifest.json` recording registry
provenance, sha512 integrity, license, and the SHA-256 of every shipped file.
Provenance is also pinned INDEPENDENTLY of the manifest in
`EXPECTED_VENDOR_INVENTORY` (probe code), verified against official
`npm view`/`npm pack`; the analyzer and gate fail closed on any divergence and
re-verify disk/HTTP bytes against the pinned hashes, so a coordinated
bytes+manifest-hash swap fails without a reviewed code change.
`script-src` is now exactly `'self'` plus the per-request nonce, and
`unpkg.com`, `cdn.jsdelivr.net`, and `code.iconify.design` are gone from every
directive. `package.json` and `package-lock.json` are byte-identical, and
`public/sw.js` changed in commentary only. Accepted R6 Codex GO evidence:
focused
`230/230`, full suite `3415/3415` with `QUALITY-GATES OK` (pre-remediation
`3375/3375`), safety `24/24`,
residue `18/18`, BE.6 `46/46`, audit zero, and independent browser verification
of all affected admin/public/map/VR surfaces at `1440x900` and `390x844`.
Missing-family interception for Lucide, Iconify, Leaflet, Pannellum, and
MapLibre failed closed truthfully with no executable CDN fallback, CSP
violation, stale route/arrival claim, unexpected exception, or horizontal
overflow.

R4 moves the Vercel rate-limit counters to a shared `@upstash/redis@1.38.0`
store (`services/rateLimitStore.js`) incremented by one atomic server-side Lua
`EVAL`; only HMAC-SHA-256 bucket digests are persisted. Local development keeps
the in-memory adapter, and on Vercel an unusable shared store fails closed with
a fixed sanitized `503` instead of falling back to a process-local Map.

R4 is complete and Codex GO after its focused probe passed `180/180`, R2 stayed
green at `119/119`, R3 stayed green at `86/86`, and the R4 full suite passed
`3040/3040` with `QUALITY-GATES OK`. The superseded pre-R5 authority-sync suite
was `3050/3050`; the accepted R5 closeout suite is `3234/3234` with
`QUALITY-GATES OK`. Credential/session safety stayed `24/24`, canonical residue
stayed `18/18`, and BE.6 stayed `46/46`. The accepted 2026-07-22 compatible
dependency-security remediation is historical Codex GO evidence: at that
closeout production resolved `body-parser@2.3.0` and
`brace-expansion@2.1.2`, `package.json` was unchanged, and
`npm audit --omit=dev` reported zero vulnerabilities.

R3 established one shared single-flight session-readiness promise, made local
startup await it, prevented the exported/Vercel app from reaching session
middleware or routes before readiness, returned one fixed sanitized `503` on
initialization failure, and avoided duplicate stores, timers, listeners, logs,
or initialization attempts. Grounding remains no authority to run probes,
clear sessions, implement the next section, or deploy.

R5 confines its production change to `middleware/roleAuth.js`: routine
anonymous denials on login-gated and role-gated routes now write zero
`system_logs` rows while keeping the exact `302 /auth`, fixed `401` JSON, and
`403` HTML/JSON contracts. The single retained authorization-denial write is
the authenticated wrong-role case, dispatched through an authenticated-only
helper that requires a positive integer actor id and a non-blank role. Real
authentication failures stay audited. The R5 follow-up additionally proves the
authoritative unfiltered `system_logs` total (`summary.total`) is unchanged
across the anonymous requests via a bounded baseline/postcondition, and makes
both reusable prompts in `docs/new-session-grounding-prompts.md` current under a
dedicated documentation gate. Focused R5 `90/90`; accepted closeout suite
`3234/3234` with `QUALITY-GATES OK`. R5 and its documentation-gate correction
are complete and Codex GO.

R3 through R7 and expanded D7 are complete and Codex GO. The later R8 lifecycle
completed and culminated in accepted technical Production baseline
`fea3b2e11c6331eddc1ee091b165427d8e0218d7`; future `main` deployments require
manual promotion. The owner accepts the 2026-08-05 human pilot with zero
reported findings; its evidence remains external and its full source-commit
identity was not independently verified. Pilot review is complete. The
owner-authorized local OFF.2-OFF.5 implementation candidate has focused evidence
but no Codex GO; D6, OFF.6 browser acceptance, and final Milestone 12 GO remain
open.
R7 adds an allowlist `.vercelignore`, a
minimal `vercel.json` with narrow static/PWA header rules and one fixed
static-only CSP confined to `/offline.html`, the standalone
`scripts/vercelPackageBoundary-probe.js`, and the in-suite
`vercel-package-boundary` gate; Express's per-response nonce CSP is untouched
and remains the sole CSP authority for dynamic responses.
D7 exercised the temporary building/details/node/reverse-geometry-edge/
public-schedule lifecycle through supported application interfaces in both
MySQL and Supabase, verified propagation and all-reachable-page behavior for
student, guest, and instructor with separate fresh browser/storage contexts,
cleaned up in reverse dependency order, and restored BE.6 plus
credential/session safety. The owner-attested pilot exposed the authenticated
application while facilitators directed participants to evaluate building
routing. Participant/Form evidence remains outside Git, and no anonymous
browsing was added. The owner-authorized local OFF.2-OFF.5 implementation
candidate has focused evidence but no Codex GO. D6, OFF.6 browser acceptance,
and final Milestone 12 GO remain open.

The seed script creates a default admin and a sample student for **local MySQL development only** — their deterministic local-only values live in `database/seed.js` and the shared test-only loader (`scripts/regressionCredentials.js`), not in documentation, and are not valid live credentials. Live/Supabase regression sign-ins use the test-only `SUPABASE_REGRESSION_*` variables from the ignored local `.env` (names in `.env.example`; Supabase-capable probes fail closed when they are missing). The seed connects without a database first and creates `campusphere_db` from `database/schema.sql`, so it can be re-run idempotently — every insert uses `INSERT IGNORE` or a pre-check on a natural key.

## Local server for verification (Windows) — avoid command hangs

`server.js` is a long-running process. Launching it as a foreground command (or with
hand-rolled detachment) hangs the agent command runner: on Windows the runner waits on the
entire job-object process tree, and the server never exits.

Rules:
- Never run `node server.js`, `npm start`, or `npm run dev` as a foreground command, and
  never use `detached`/`unref` or `ProcessStartInfo` + `WaitForExit`/`ReadToEnd`
  "background" workarounds — they do not escape the job object.
- API/HTTP/contract checks: use `scripts/with-server.js`, a self-terminating harness that
  spawns the server, waits for readiness, runs a probe, and kills the server in `finally`
  before exiting.
- Browser/visual checks: start the server with the agent runner's NATIVE background/async
  execution facility, record the PID and a dedicated port, drive the browser, then stop that
  exact PID and confirm the port is free.
- Always pass the full inherited environment and override only what's needed (PORT,
  *_DATA_SOURCE). Never clear the environment.
- Confirm the chosen port is free before launch; stop the exact PID you started afterward;
  never blanket-kill `node.exe` (MCP/session processes share that image name).
- Do not start a server before every task — only when runtime testing requires one.

## Required Environment Variables (`.env`)

- `SESSION_SECRET` — falls back to a hardcoded dev string if absent (don't ship without it).
- `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` — MySQL pool config (`config/db.js`); defaults assume local root access to `campusphere_db`.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` — required for the `/auth/google` flow; OAuth is silently disabled (redirects to `/auth?error=oauth_failed`) if either ID/secret is missing.
- `PORT` — optional, defaults to 3000.

## Architecture

### Request flow

`server.js` wires middleware in this order: body parsers → static files → `express-session` → a small middleware that copies `req.session.user` to `res.locals.user` (so every EJS template can read `user` without being passed it explicitly) → request logger → route modules → 404/500 error handlers.

Routes are mounted flat at `/` (except `/admin` which is namespaced). Several route files all mount at `/` — the actual URL paths are defined inside each router file, not via the mount prefix. Don't assume a route lives in `routes/<name>.js` based on its URL — check `server.js` for the mount, then the router for the path.

Controllers render EJS views directly in most cases. The admin section additionally exposes JSON CRUD endpoints under `/admin/api/*` (users, news, events, buildings) consumed by client-side JS in `public/js/`.

### Auth model

`middleware/roleAuth.js` is the **single source of truth** for auth middleware — it exports `requireLogin`, `requireRole(...allowedRoles)`, `attachUser`, and the `wantsJson(req)` content-negotiation helper. `middleware/requireLogin.js` still exists only as a **compatibility re-export** of `roleAuth.requireLogin` so older imports keep working; new role-gated / auth-gated code should `require('../middleware/roleAuth')`. `routes/admin.js` gates the entire `/admin` namespace with `router.use(requireRole('admin'))`.

**HTML vs JSON responses.** `requireLogin` and `requireRole` branch on `wantsJson(req)`: browser requests get a `302` redirect to `/auth` (unauthenticated) or a `403` `error.ejs` render (forbidden); API requests get `401`/`403` JSON `{ success, message }`. `wantsJson` returns true when the URL contains `/api/`, the request is XHR, the `Accept` header prefers JSON, or `Content-Type` is JSON — so a logged-out fetch of `/admin/api/*` gets a clean 401.

Roles: `student-cspc`, `instructor`, `admin`, `guest`. Each role has a different sidebar definition in `models/data.js` under `sidebarNav`.

### Runtime data source, session store & Cloudinary

CampuSphere runs against two backends chosen at request time by the `*_DATA_SOURCE` switches (read by `config/authDataSource.js`, `config/contentDataSource.js`, `config/vrDataSource.js`, `config/scheduleDataSource.js`, `config/mapRuntime.js`): **Supabase/PostgreSQL is the production target**, **MySQL is the local-development / fallback store**. Server-side Supabase access is through the **server-only** client (`config/supabase.js`, service role) and the `repositories/` + `services/` layers; MySQL uses the shared pool (`config/db.js`). **Supabase Auth is not used.**

Room scheduling (Milestone 11) stores **real admin-managed room/facility schedule data** in the `room_schedules` table (MySQL `database/schema.sql`; Supabase migration `0012_room_schedules.sql`, owner-applied) accessed only through the dual-backend `repositories/scheduleRepository.js`, switched by `SCHEDULE_DATA_SOURCE=mysql|supabase` — it is **not** SIS, enrollment, assigned-class, or instructor-teaching-load simulation. VR room-door schedule hotspots use nullable schedule-target metadata on `vr_hotspots` from Supabase migration `0013_vr_hotspot_schedule_metadata.sql` (owner-applied before Supabase VR schedule verification).

Road-following destination routing uses CampuSphere's own dual-backend campus graph and owner-managed `route_edges.path_geometry`; it has no Google Maps, Google Earth, Strava, SIS, or external routing-engine dependency. Supabase migrations are exactly `0001` through `0019`, and `0014` through `0019` are owner-applied. `config/selectedDemoFreeze.js` is the immutable BE.6 QA baseline; it is not a runtime/admin write lock. Guided VR resolves the configured natural `destination_node_key` and reports arrival only after the stored start scene maps to `main-gate`, the stored final scene maps to that exact destination node, every scene has approved Cloudinary delivery URL and public ID metadata, and every adjacent pair has exactly one forward and one reverse link. Incomplete or ambiguous coverage fails closed and never reports arrival.

Sessions (`express-session`; policy validated in `config/sessionConfig.js`): `SESSION_STORE=supabase` is the **preferred/default production & demo** store (`services/supabaseSessionStore.js`, table `public.app_sessions`); `SESSION_STORE=mysql` is the **explicit fallback / local-rehearsal** store (`services/mysqlSessionStore.js`); `SESSION_STORE=memory` is **local-development only and fails closed in production**.

**Cloudinary is media delivery only** (campus images + 360° VR panoramas) — not auth, not data persistence. Its credentials are **server-only** (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, read by `config/cloudinary.js`); delivery URLs are validated by `utils/mediaUrl.js`. The local `/img/*` and `/img/vr/*` fallbacks are preserved when Cloudinary is unconfigured.

### Google OAuth domain-to-role mapping

`controllers/authController.js` → `getRoleFromEmail()` assigns roles by **exact email domain** at OAuth registration time:

- `@my.cspc.edu.ph` → `student-cspc`
- `@cspc.edu.ph` → `instructor`
- `@gmail.com` → `guest`
- anything else → rejected with `unauthorized_domain`

Admin accounts cannot be created via OAuth — only through the seed script or direct DB insert. The OAuth flow is two-step: callback redirects to `/auth/complete-registration` to collect role-specific profile fields (student ID, employee ID, or address+phone) before the `users` row is actually inserted. Pending state lives in `req.session.pendingOAuthRegistration`.

### Session shape

After login, `req.session.user` is hydrated with the row from `users` plus role-specific fields merged in from `student_profiles` / `instructor_profiles` / `guest_profiles` (see `loadRoleProfileIntoSession` in `authController.js`). Controllers reading e.g. `user.course` or `user.employee_id` rely on this merge having already happened. The local-login path (`loginPost`) duplicates this hydration inline rather than calling the helper — keep both paths in sync if you change the session shape.

### Data layer

`models/data.js` is **not** a runtime data source — it's a static module used by `database/seed.js` to populate MySQL on first run, and by a small number of legacy template paths that still read from it directly. Live data (users, buildings, news, events, FAQs) comes from MySQL via `config/db.js` (a shared pool exported as `db`). When adding a new entity, follow the existing pattern: add a table in `database/schema.sql`, an optional seed in `database/seed.js`, controller methods that call `db.query(...)`, and an admin CRUD pair under `/admin/api/...` if it needs editing.

The `buildings` table stores extended fields (floors, entrances, walk time, landmarks) inside a single `details` JSON column populated by the seed; the `users` table carries `oauth_provider` / `oauth_subject` columns to distinguish local from Google-linked accounts.

### Views

EJS templates in `views/`, with admin pages under `views/admin/` and shared fragments in `views/partials/` (`head`, `navbar`, `dash-navbar`, `footer`, `dash-footer`, `theme-toggle`). Because of the `res.locals.user` middleware, partials can assume `user` is in scope.

## Conventions

- Route paths are defined inside each router file — `server.js` only handles mounts. The `/admin` prefix is the only non-trivial one.
- Admin JSON endpoints live alongside admin page renders in `routes/admin.js` under `/api/...` (so `/admin/api/users`, etc.).
- Controllers are split by feature, plus `adminUsersController` / `adminContentController` / `adminBuildingsController` for the admin CRUD APIs specifically.
- Profile data for each role lives in its own table (`student_profiles`, `instructor_profiles`, `guest_profiles`) keyed by `user_id` with `ON DELETE CASCADE`.
