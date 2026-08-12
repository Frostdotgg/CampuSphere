# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
the static ownership inventory in `scripts/quality-gates.js` discovers probes
from the filesystem as well as the registered list, but proves source patterns
only — never runtime store cleanliness.

The same contract suite also runs the road-routing probes for topology, stored geometry, API assembly, public Leaflet/MapLibre rendering, admin geometry editing, map-to-guided-VR flow, Free Roam, VR schedule hotspots, and the BE.6 expanded Guided-VR freeze. BE.6 and OFF.1 are complete and Codex GO. The current candidate freezes MySQL at 34 buildings, 44 route nodes, 100 directed edges, 50 exact reverse pairs, and 100 valid geometries; Supabase at 25 buildings, 26 route nodes, 50 directed edges, 25 exact reverse pairs, and 50 valid geometries; and the shared Guided-VR catalog at 25 active destinations, 472 configured steps, and 99 unique scene keys. The 13-building `models/data.js` roster is the reproducible seed baseline, not the complete campus; admin edits and later additions remain supported but invalidate freeze evidence until it is deliberately refreshed.

<!-- M12.P1 CURRENT STATUS START -->
**CURRENT STATUS (2026-08-12 Guided-VR authority-remediation candidate).**

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

The Guided-VR runtime and catalog remediation is committed and pushed as
43627cf0a77741556f4e701711e55612a739799b, with Git tree
eb3e830f68d537c4a54d6dda6df7d52a61f9c87b. Local HEAD and origin/main matched
that commit at the first integrated R8 review. The owner-observed Vercel
Production alias remains https://campusphere-cspc.vercel.app on deployed
baseline 0627bf78228148e3f989275810c333c16a1f3356; neither 43627cf nor this
authority-only follow-up is deployed. Live Git truth, not this narrative,
controls whether a later working tree is clean or modified. The accepted
0627bf7 five-file verification, anonymous production smoke 31/31, and
automated frozen-data rehearsal remain historical evidence and do not verify
the later Guided-VR runtime commit.

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
71/71 R7 classification, and adds accepting/rejecting fixtures. Independent
commit-readiness review of the exact follow-up bytes remains open. The required
order is independent commit-readiness review -> local commit -> separately
authorized push -> clean-commit R8 re-review. M12.P1 remains NO-GO for
deployment and pilot readiness; deployment is not authorized. Human pilot/Form
responses, OFF.2-OFF.6, and final Milestone 12 acceptance remain open. Do not
claim a new GO from this candidate.
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

A narrow logout-probe output-hygiene remediation is independently
Codex-accepted as additive evidence. The mocked failed-destroy unit cases in
`scripts/logoutSessionTermination-probe.js` now capture the controller's
expected fixed sanitized line instead of letting it print, so an otherwise
green `npm test` transcript no longer shows `Logout error: session destroy
failed.` twice, where a reviewer could not distinguish it from a real logout
failure. `controllers/authController.js` is UNCHANGED: a genuine logout failure
is still logged, once, sanitized, and still returns a sanitized 500 without
clearing the cookie.

The remediation adds the `logout-output-hygiene` static gate, whose expected
line is pinned in `scripts/quality-gates.js` independently of the probe and
whose detectors are each exercised against a rejecting fixture. Its evidence is
focused `75/75` (baseline `68/68`), full suite `3529/3529` with
`QUALITY-GATES OK` and zero escaped `Logout error:` lines in the captured
transcript, `npm audit --omit=dev` zero vulnerabilities, and postconditions
`24/24 -> 18/18 -> 46/46`. The `+18` is `+7` probe capture assertions and `+11`
new gate checks.

This remediation is accepted as additive test/output-hygiene evidence only. It
authorizes no new section, does not replace D7 evidence, and does not authorize
R8 or deployment.

This remediation does not supersede or replace the accepted D7 `3511/3511`
full-suite evidence recorded above, which stands unchanged.

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
a fixed sanitized `503` rather than falling back to a process-local Map.

R4 is complete and Codex GO after its focused probe passed `180/180`, R2 stayed
green at `119/119`, R3 stayed green at `86/86`, and the R4 full suite passed
`3040/3040` with `QUALITY-GATES OK`. The superseded pre-R5 authority-sync suite
was `3050/3050`; after the R5 follow-up (authoritative global-total probe check
plus the reusable-grounding-prompt gate) the accepted R5 closeout suite passed
`3234/3234` with `QUALITY-GATES OK` and focused R5 `90/90` standalone. Credential/session safety stayed `24/24`,
canonical residue stayed `18/18`, and BE.6 stayed `46/46`. The accepted
2026-07-22 compatible dependency-security remediation is historical Codex GO
evidence: at that closeout production resolved `body-parser@2.3.0` and
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

R3 through R7 and expanded D7 are complete and Codex GO. `M12.P1-R8` is the
next potential section and is read-only. It requires a separate
owner-authorized read-only review prompt, and even R8 GO authorizes only a
separate owner deployment decision. R7 adds an allowlist `.vercelignore`, a
minimal `vercel.json` with seven narrow static/PWA header rules and one fixed
static-only CSP confined to `/offline.html`, the standalone
`scripts/vercelPackageBoundary-probe.js`, and the in-suite
`vercel-package-boundary` gate; Express's per-response nonce CSP is untouched
and remains the sole CSP authority for dynamic responses.
D7 exercised the temporary building/details/node/reverse-geometry-edge/
public-schedule lifecycle through supported application interfaces in both
MySQL and Supabase, verified propagation and all-reachable-page behavior for
student, guest, and instructor with separate fresh browser/storage contexts,
cleaned up in reverse dependency order, and restored BE.6 plus
credential/session safety. The eventual pilot exposes the entire authenticated
application while facilitators direct students and guests to evaluate building
routing. Feedback uses an owner-created Google Form. No anonymous browsing is
added. OFF.2 through OFF.6 are deferred until pilot review, not cancelled, and
remain mandatory before final Milestone 12 GO. D6 remains post-pilot after
OFF.2-OFF.5 and before OFF.6.

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

`middleware/roleAuth.js` is the **single source of truth** for auth middleware. It exports:

- `requireLogin` — gate any authenticated route.
- `requireRole(...allowedRoles)` — gate a route by role; `routes/admin.js` uses `router.use(requireRole('admin'))` to gate the entire `/admin` namespace.
- `attachUser` — non-blocking; copies session user onto `req.currentUser`.
- `wantsJson(req)` — content-negotiation helper used internally.

`middleware/requireLogin.js` still exists as a compatibility re-export of `roleAuth.requireLogin` so older imports keep working — prefer `require('../middleware/roleAuth')` in new code.

**HTML vs. JSON responses.** `requireLogin` and `requireRole` both call `wantsJson(req)` and branch on the result:

- Browser requests → `302` redirect to `/auth` (unauthenticated) or `403` EJS `error.ejs` render (forbidden).
- API requests → `401`/`403` JSON `{ success, message }`.

`wantsJson` returns true if the URL contains `/api/`, the request is XHR, the `Accept` header prefers JSON over HTML, or `Content-Type` is JSON. When adding new admin JSON endpoints under `/admin/api/*`, this means a logged-out fetch gets a clean 401 — front-end code can react without parsing an HTML redirect.

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

Sign-in and registration live on a single combined page at **`/auth`** (`views/auth.ejs`). The standalone `/login` and `/register` URLs are legacy and now just `302` to `/auth` (and `/auth#register`); there is no separate `login.ejs` / `register.ejs`.

## Conventions

- Route paths are defined inside each router file — `server.js` only handles mounts. The `/admin` prefix is the only non-trivial one.
- Admin JSON endpoints live alongside admin page renders in `routes/admin.js` under `/api/...` (so `/admin/api/users`, etc.). These rely on `wantsJson` in `roleAuth` returning true for `/api/` paths, so unauthenticated fetches get JSON instead of an HTML redirect.
- Controllers are split by feature, plus `adminUsersController` / `adminContentController` / `adminBuildingsController` for the admin CRUD APIs specifically.
- Profile data for each role lives in its own table (`student_profiles`, `instructor_profiles`, `guest_profiles`) keyed by `user_id` with `ON DELETE CASCADE`.
