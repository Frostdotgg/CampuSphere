# Milestone 11 and Pre-Milestone-12 Delivery Plan

## Summary

Milestones 9, 10, and 11 are complete and Codex GO. The Road-Following Map Destination Routing Repair (RF.1-RF.6) is also complete and Codex GO. BE.1 through BE.6 and OFF.1 are complete and Codex GO. Final Milestone 12 GO has not been issued.

Supabase migrations are exactly `0001` through `0019`; migrations `0014` through `0019` are owner-applied and verified, and no `0020` exists. The guarded BE.5 MySQL parity apply is complete and its dry-run reports zero actions. The current expanded BE.6 freeze is backend-specific: MySQL has 34 buildings, 44 route nodes, 100 directed edges, 50 exact reverse pairs, and 100 valid road geometries; Supabase has 25 buildings, 26 route nodes, 50 directed edges, 25 exact reverse pairs, and 50 valid road geometries. The shared active Guided-VR catalog has 25 destinations, 472 configured steps, and 99 unique scene keys. The temporary D4 probe edge and `main-gate.display_order` drift were restored through separately authorized admin API operations, and the complete D4 regate remains accepted historical evidence. CampuSphere computes routes from its own campus graph and renders owner-managed road geometry; Google Maps, Google Earth, Strava, SIS, and external routing engines are not integrated.

<!-- M12.P1 CURRENT STATUS START -->
**CURRENT STATUS (2026-08-20 Milestone 12 closeout candidate).**

Accepted history remains unchanged: Milestones 8-11, RF.1-RF.6, BE.1-BE.6,
OFF.1, M12.P1 R1-R7, D1-D5, and expanded D7 are complete and Codex GO. The
limited human-pilot review is owner-accepted as described below. OFF.2-OFF.6
are complete and Codex GO on local commit
`cdbc863b779e5319c14dee21a31a5e78951e233c`; M12.P1-D6 is complete and Codex
GO on local commit `691f0bef40e06b6ea9485e713d2fe3000a03bd83`. The current
uncommitted 19-file offline UI/accessibility/package correction candidate is
pending independent read-only review and full verification.

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
Focused evidence remains OFF.2 `145/145`, offline 2D `35/35`, and package
boundary `74/74`. No full suite, QA, ordered postconditions, browser
acceptance, Codex GO, commit readiness, deployment readiness, or final
Milestone 12 GO is claimed. Replacement full verification requires separate
owner authorization; commit, push, promotion, and deployment remain
unauthorized.

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
  No `npm test`, `npm run qa`, ordered `24/24 -> 18/18 -> 46/46`
  postconditions, or browser acceptance was run for those exact bytes. The
  `494010dd...` manifest is predecessor evidence for this authority
  synchronization, not a pin for the later synchronized bytes; live Git and a
  freshly computed post-sync manifest control the next review. The current
uncommitted 19-file offline UI/accessibility/package correction candidate
claims no new Codex GO, commit readiness, deployment readiness, or final
Milestone 12 GO. Final Milestone 12 GO is not self-issued by this plan; the
latest independent external closeout report controls it. The local commits and
current candidate must not be pushed, promoted, or deployed before the
presentation and a later explicit owner decision.

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

At this 2026-08-20 synchronization boundary, the ordered handoff is: focused
static verification and a fresh external manifest; fresh Claude Code and Codex
grounding-only reports; a separately authorized independent read-only review of
that exact manifest; and, only after external review GO, a separately authorized
replacement full verification at `4998/4998`, five-stage QA, ordered
`24/24 -> 18/18 -> 46/46`, and bounded Chrome acceptance. Only after that
verification returns GO may the exact candidate be separately authorized for a
local commit. No push, deployment, promotion, rollback, or Production change is
authorized before the presentation; each later action requires separate owner
authority. Repository text neither pre-authorizes nor predicts any later result.
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
At that July 30 snapshot, the local-candidate package boundary was 158 files, 6,201,747 bytes,
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
BE.5 selected 13-building parity/regression, BE.6 selected-demo dataset freeze,
and OFF.1 received Codex GO. The owner-authorized `M12.P1` readiness audit is
complete with Codex NO-GO after one critical and six high blockers. R1-R7,
D1-D5, and expanded D7 are complete and Codex GO, including all R3 follow-ups,
the R4 shared-rate-limit follow-up, both R5 follow-ups, dependency-security
remediation, both R7 source-auditability corrections, and the expanded D7
cross-role regression gate. `M12.P1-R7` is complete and Codex GO. Accepted R7
closeout evidence is focused `71/71`,
in-suite `vercel-package-boundary` `70/70`, full
suite `3495/3495` with `QUALITY-GATES OK`, and `npm audit --omit=dev` at zero
vulnerabilities. The `3492/3492` initial R7 candidate and `3494/3494`
literal-NUL remediation candidate are historical/superseded. Following the
accepted 2026-07-22 dependency closeout, a subsequent 2026-07-26 npm advisory
drift is remediated: production pins `ejs@6.0.1`, the
`jake/filelist/minimatch/brace-expansion` chain is absent, and
`npm audit --omit=dev` reports zero vulnerabilities. `M12.P1-D7` accepted
evidence is the fresh-context role-isolation rerun, `npm test` `3511/3511`
with `QUALITY-GATES OK`, `npm audit --omit=dev` zero vulnerabilities, and
postconditions `24/24 -> 18/18 -> 46/46` with fingerprint
`a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d`
unchanged. Earlier D7 blocked/partial attempts are historical/superseded.
A later logout-output hygiene remediation is independently Codex-accepted as
additive evidence (`3529/3529`, `QUALITY-GATES OK`, zero escaped `Logout
error:` lines, audit zero, and `24/24 -> 18/18 -> 46/46`) and does not
supersede D7.
`M12.P1-R8` is the next potential section; it is read-only and not authorized
by this synchronization. Even R8 GO authorizes only a separate owner deployment
decision.
`M12.P1` remains NO-GO for deployment and pilot readiness; deployment is not
authorized.
<!-- M12.P1 PRIOR STATUS END -->

Superseded, historical: an earlier documentation/authority synchronization
produced a RED full-suite candidate after Supabase logout/session-destroy
failures left the canonical administrator and student with unexpired sessions;
the distinct post-run credential/session check was `22/24`, the embedded residue
gate was red, and the embedded BE.6 gate did not re-establish its frozen
postcondition. That blocker is closed. A separately owner-authorized supported
cleanup/restoration was performed and independently reproduced, and the R6
session re-verified safety `24/24`, residue `18/18`, and BE.6 `46/46` before
editing and again after its full-suite run.

R1 credential/session-safety evidence is `24/24` with canonical residue
`18/18`, verified before and after the R6 run. The accepted R4 evidence is
focused `180/180`, R2
`119/119`, R3 `86/86`, full suite `3040/3040` with `QUALITY-GATES OK`, and BE.6
`46/46`. The superseded pre-R5 authority-sync suite was `3050/3050`; the
accepted R5 closeout suite is `3234/3234` with `QUALITY-GATES OK`, and focused
R5 is `90/90` standalone. The pre-remediation R6 candidate suite was
`3375/3375`; after the narrow provenance/evidence-gate remediation the accepted
R6 Codex GO suite is `3415/3415` with `QUALITY-GATES OK`, with focused R6
`230/230` standalone and the complete independent desktop/mobile browser and
missing-library matrix green. Production dependency
audit is zero after the compatible lockfile-only
resolutions to `body-parser@2.3.0` and `brace-expansion@2.1.2`; `package.json`
was unchanged. D6 remains the least-priority post-pilot implementation after
OFF.2-OFF.5 and before OFF.6. The technical Production baseline is accepted.
The owner accepts the 2026-08-05 human pilot with zero reported findings;
participant/Form evidence remains external and the tested build's full
source-commit identity was not independently verified. Pilot review is complete
for sequencing purposes. The owner-authorized local OFF.2-OFF.5 implementation
candidate has focused evidence but no Codex GO; D6, OFF.6 browser acceptance,
and final Milestone 12 GO remain open. The
13-building roster remains editable selected-demo data, not a complete-campus
claim; any post-freeze data change requires replacement evidence. Guided VR
reports arrival only when the final available scene maps to the selected
destination; partial coverage ends with a truthful coverage notice.

Milestone 11 implements real admin-managed room and facility schedule data without bringing back fake academic records, simulated enrollment status, fake instructor assigned-room widgets, fake instructor teaching schedules, or fake instructor "all rooms" dashboards.

Codex owns and maintains `plan.md`, defines the section prompts, reviews the actual files, diffs, runtime behavior, security boundaries, database effects, cleanup, and dirty state, and gives GO or NO-GO. Claude implements exactly one Codex-authorized section at a time, stops, and reports. Claude must not create, replace, or revise `plan.md` unless the current explicit owner execution prompt grants a narrow status-only synchronization after every required verification is green. Only the current owner prompt can grant that exception, and it grants it for that one execution: an archived or spent prompt reproduced anywhere in this repository, including under a historical heading in either handoff, confers no authority to edit `plan.md` or to begin any section. Claude must not begin a later section without explicit Codex GO.

Milestone 11 must preserve the approved architecture:

- Supabase is the production data store and production session-store target.
- MySQL remains local development, fallback, and local rehearsal only.
- Supabase Auth is still not used; CampuSphere keeps Express sessions, bcrypt local login, and Google OAuth.
- Cloudinary media support from Milestone 10 remains intact for campus images and 360-degree VR panoramas.
- CSRF, CSP, rate limits, PWA privacy, sanitized error contracts, role authorization, and session-store behavior remain preserved.
- Schedule data must be real admin-managed data served from the configured runtime data source.

Do not deploy or promote merely because this plan records the pilot exception.
R1-R7, D1-D5, expanded D7, and the final R8 lifecycle are complete; technical
Production baseline `fea3b2e11c6331eddc1ee091b165427d8e0218d7` is accepted,
and future `main` deployments require manual promotion. M12.P1 remains NO-GO
for final acceptance. Pilot review is complete by owner acceptance. An
owner-authorized local OFF.2-OFF.5 implementation candidate exists with focused
evidence but no Codex GO. D6, OFF.6 browser acceptance, and final Milestone 12
GO remain open. The offline candidate must not be pushed, promoted, or deployed
before the presentation and a later explicit owner decision.

## Sections

**11.1: Room Scheduling Baseline Audit**

Read-only. Verify the current scheduling baseline before editing.

Inspect `ROADMAP.md`, `plan.md`, `database/schema.sql`, `database/seed.js`, `database/supabase/*.sql`, `routes/admin.js`, `routes/buildings.js`, `controllers/adminBuildingsController.js`, `controllers/buildingsController.js`, `controllers/dashboardController.js`, `repositories/`, `services/`, `views/buildings.ejs`, `views/dashboard.ejs`, `views/admin/campus-map.ejs`, `public/js/admin/admin-buildings.js`, `utils/adminValidation.js`, `scripts/quality-gates.js`, docs, and current Git state.

Record the live state for:

- Existing building, floor, room, facility, and `details` JSON structure.
- Existing admin CRUD patterns and validation helpers.
- Existing Supabase/MySQL runtime source switches and repository boundaries.
- Existing dashboard content, especially proof that fake enrollment and fake instructor schedule widgets remain out of scope.
- Current user-facing places where room or facility schedules could appear.
- Current QA/static gate coverage and dirty worktree warnings.

Confirm Milestone 10 is complete and Codex GO, and confirm the exact next section is 11.2. Do not modify source in this section.

**11.2: Schedule Domain Model and Validation Plan**

Define the smallest real scheduling model that fits the current app and roadmap before changing schemas.

Required behavior:

- Model real room/facility schedule entries tied to a building and, where available, floor, room, or facility text.
- Required fields should include schedule title or purpose, date, start time, end time, audience, status, and location target.
- Status values should be explicit and allow safe filtering, such as scheduled, cancelled, and completed.
- Audience values must align with existing role/audience conventions where possible.
- Validation must reject invalid dates, inverted time ranges, missing location/title fields, unsupported status/audience values, oversized text, and unsafe JSON/body shapes.
- The model must not imply SIS/enrollment integration, assigned classes, instructor teaching loads, or student enrollment status.

Verification must include a written domain contract and a Codex review before schema or implementation work begins.

**11.3: Database Schema and Supabase/MySQL Parity**

Add real schedule storage with MySQL and Supabase parity.

Required behavior:

- Add an additive MySQL table for schedule entries without breaking existing seed or fallback behavior.
- Add or create the matching Supabase migration only if live inspection shows it is needed.
- Do not silently apply Supabase SQL. If a Supabase migration is created, the project owner must apply it manually before the final gate.
- Keep schema idempotent where practical and compatible with local reseeding.
- Preserve existing buildings, VR, Cloudinary media fields, sessions, users, content, and route tables.
- Avoid broad rewrites of building `details` JSON unless the baseline audit proves a narrow compatibility need.

Verification must include schema checks for MySQL and Supabase where configured, plus confirmation that existing app flows tolerate an empty schedule table.

**11.4: Repository and Runtime Data Source Wiring**

Add schedule data access through the existing runtime data-source pattern.

Required behavior:

- Add or extend repository/service boundaries so schedule reads and writes can run against MySQL fallback or Supabase production mode.
- Preserve existing `*_DATA_SOURCE` switching style and do not introduce Supabase Auth.
- Keep API response shapes sanitized and consistent across backends.
- Ensure schedule reads can filter by building, date range, audience, and status without exposing raw DB internals.
- Server/database failures must return sanitized errors without SQL, PostgREST text, stack traces, request bodies, cookies, session IDs, or secrets.

Verification must include repository-level probes or QA checks for both backends where configured.

**11.5: Admin Schedule CRUD**

Add authorized admin management for real room/facility schedule entries.

Required behavior:

- Admins can create, update, list, and delete schedule entries.
- Non-admin users cannot access schedule mutation endpoints by direct URL, crafted fetch, or browser form.
- Validation failures return sanitized 400 JSON or established EJS errors.
- Missing entries return sanitized 404.
- Conflicting duplicate handling must be explicit if implemented; do not silently invent complex conflict rules beyond the approved model.
- Successful admin mutations should follow existing audit/logging conventions where available.
- The UI must be practical for repeated admin use: clear fields for building/location, date, time range, purpose/title, audience, and status.

Verification must include admin JSON contract probes for create, update, validation rejection, list, delete, and cleanup in both runtime modes where configured.

**11.6: Public Building and Room Schedule Display**

Display schedule/availability information where it helps users navigate.

Required behavior:

- Show relevant room/facility schedule information in building or room detail views.
- Keep role dashboards focused on useful links and summaries; do not add fake academic schedule widgets.
- Users should see real schedule rows only, with empty states when no schedule exists.
- Public/user-facing views must not expose internal IDs unnecessarily, admin-only metadata, raw database errors, private notes, session data, or secrets.
- Schedule display must remain usable on mobile and must not overlap map/building/VR controls.

Verification must include rendering checks for schedule-present and schedule-empty states, plus mobile-width review for any changed UI.

**11.7: QA Gates, Docs, and Deployment Notes**

Update QA and documentation so room scheduling is repeatable and clearly scoped.

Required behavior:

- Extend QA/static/runtime gates to cover schedule validation, admin-only mutation, backend parity, empty-state rendering, and leak boundaries.
- Update docs to state that schedules are real admin-managed room/facility data, not enrollment, SIS, or instructor-load simulation.
- Document any new environment or migration prerequisites.
- Preserve Cloudinary, Supabase session-store, MySQL fallback, OAuth, CSRF, CSP, rate-limit, PWA, and Docker/Vercel roadmap wording.
- Do not document private schedule data, real secrets, raw SQL errors, session IDs, cookies, Supabase keys, OAuth secrets, DB passwords, or Cloudinary credentials.

Verification must include `npm test` if executable QA gates changed, stale wording checks, and a secret/leak scan over changed docs/scripts.

**11.8A: Room Door Schedule Interaction Repair**

Address the Codex 11.8 GO/NO-GO finding that the implemented schedule display must work from the actual room/laboratory door interaction inside VR panoramas, not only from the building detail modal.

Required behavior:

- Admins can mark a VR hotspot as a schedule door/facility target with building, room/facility type, location label, and optional floor label.
- Door schedule metadata is stored durably in the configured runtime data source: MySQL schema/seed compatibility and Supabase migration parity.
- Supabase migration `0013_vr_hotspot_schedule_metadata.sql` is owner-applied before Supabase VR schedule verification is considered complete.
- Clicking a schedule hotspot or its accessible fallback button loads real room/facility schedule rows through the existing authenticated building schedule API.
- Filtering must be exact by building, location type, location label, and optional floor label so neighboring rooms cannot leak into the wrong door schedule.
- The UI must render safe empty/loading/error states and must not expose schedule row internals, admin-only metadata, raw DB errors, session data, or secrets.
- Existing scene/info/exit hotspots, guided routes, map, dashboard, Cloudinary media, CSP, CSRF, rate limits, sessions, and PWA privacy must remain intact.

Verification must include MySQL and Supabase-capable probes for schedule hotspot CRUD, exact public schedule filtering, cleanup, leak boundaries, and browser checks for the VR schedule interaction on desktop and mobile widths. The final 11.8 GO/NO-GO must be re-run after this repair.

**11.8B: Map Destination and VR Route Flow Repair**

Address the pre-final GO/NO-GO finding that the public map route flow must match the intended navigation model: a user chooses a campus destination pin/building, can set it as the destination to create a path from Guard House/Main Gate, and can set a VR route to open the guided VR scenes from Guard House/Main Gate to that destination.

Required behavior:

- The canonical internal start remains `main-gate`; user-facing labels may say `Guard House / Main Gate`.
- Clicking a building pin, list item, or search result opens the building panel with two clear actions: `Set as Destination` and `Set VR Route`.
- `Set as Destination` must immediately compute and display a path from `main-gate` to the selected destination using the route graph, without requiring a separate predefined `campus_routes` row.
- The public map must render the computed path on the active map renderer where possible, and show a safe readable route state if map tiles or route drawing are unavailable.
- The route panel must show the selected destination, start label, estimated walk time when available, and ordered path/segment information without exposing internal database errors or admin-only metadata.
- `Set VR Route` must open a guided VR route from `main-gate` to the selected destination. Destination-based VR routing must work even when the map flow starts from a building pin rather than a route search result.
- Existing predefined route behavior under `/api/routes`, `/api/routes/:id`, and `/vr/routes/:routeId` must remain backward-compatible.
- Empty/no-path/no-scene cases must be explicit and user-safe.
- Do not add fake academic records, SIS/enrollment data, fake instructor schedules, fake schedule rows, or broad map/dashboard redesigns.
- Preserve Supabase/MySQL runtime switches, Express sessions, Supabase session store, CSRF, CSP, PWA privacy, rate limits, Cloudinary media support, and sanitized error contracts.

Verification must include API probes for computed map paths and destination-based VR routes in both MySQL and Supabase modes, plus browser checks on desktop and mobile proving: selecting a destination creates a visible route state, `Set VR Route` opens the expected VR flow, `/map` remains rendered, no CSP/Lucide/Iconify regressions occur, and no probe data or server process is left behind.

**11.8C: Free Roam 360 Campus Mode**

Add a clear free-roaming choice so users can explore available 360 campus scenes without selecting a destination.

Required behavior:

- Users can start Free Roam from the public map UI through a clear `Free Roam 360` action.
- Free Roam opens the existing authenticated VR scene browser flow, starting at `scene-main-gate` / Guard House / Main Gate.
- Users can move between available 360 scenes using scene hotspots and accessible fallback links.
- Free Roam must be distinct from `Set as Destination` and `Set VR Route`: it does not compute a route, does not require a destination, and does not imply arrival/completion.
- If a panorama image is missing or unavailable, the existing readable fallback must remain safe and usable.
- Scene/info/exit/schedule hotspots must keep their current behavior; room-door schedule interaction must still work where schedule metadata exists.
- Do not create fake scenes, fake schedules, fake academic data, SIS/enrollment data, or instructor-load simulation.
- Prefer existing `vr_scenes` and `vr_hotspots` data. Do not create a new migration unless live inspection proves a schema gap.
- Preserve Supabase/MySQL runtime switches, Express sessions, Supabase session store, CSRF, CSP, PWA privacy, rate limits, Cloudinary media support, and sanitized error contracts.

Verification must include API/browser checks proving Free Roam starts at the main gate, scene navigation works through hotspots/fallback links, missing panoramas degrade safely, mobile layout has no horizontal overflow, and no CSP/Lucide/Iconify regressions occur.

**11.8D: New Feature Testing and Regression Gate**

Run a dedicated feature and regression gate for the new pre-final navigation features before the Milestone 11 GO/NO-GO review.

Feature testing must cover:

- Map destination flow: choose a building pin/list/search result, click `Set as Destination`, verify a path from Guard House/Main Gate is computed and displayed.
- Map VR route flow: click `Set VR Route`, verify the guided VR route opens from Guard House/Main Gate to the selected destination.
- Free Roam flow: click `Free Roam 360`, verify the VR scene browser opens at the main gate and allows campus roaming through scene hotspots/fallback links.
- Room-door schedule flow: from a schedule hotspot/fallback button, verify the matching room/facility schedule panel still loads exact schedule rows.
- Empty states: no route, no destination node, no VR scenes, no hotspots, no schedule rows, and missing panorama images all render safe user-facing messages.

Regression testing must cover:

- Existing `/map`, `/api/routes`, `/api/routes/:id`, `/api/pathfind`, `/vr`, `/vr/:sceneKey`, `/vr/routes/:routeId`, and `/api/vr/routes/:routeId` contracts.
- MySQL fallback and Supabase runtime modes.
- Supabase session store.
- Admin schedule CRUD, public schedule display, schedule repository parity, and VR schedule hotspot probes.
- Cloudinary media delivery/fallback behavior.
- CSRF, CSP, PWA privacy, role authorization, rate limits, sanitized errors, and leak scans.
- Desktop and mobile browser checks for map route display, guided VR route, Free Roam, and room-door schedule interaction.

Verification must run the new focused probes plus the existing QA suite. No final 11.8 GO may be given while any new feature test or regression test is failing, skipped without justification, leaking secrets, leaving probe data, leaving a server process, or requiring unapplied Supabase SQL.

**11.8: Milestone 11 End-to-End GO/NO-GO**

Run the final Milestone 11 production-readiness gate only after required schema, owner-applied Supabase SQL, admin workflows, public display, room-door schedule interaction repair, map destination/VR route flow repair, Free Roam 360 mode, dedicated new-feature testing, regression testing, QA, and docs are complete.

Production GO requires:

- Admins can create, update, list, and delete real schedule entries.
- Users can view relevant room/facility schedule information without fake academic records.
- Users can open a real room/facility schedule from a VR room/laboratory door hotspot where that metadata exists.
- Users can choose a map destination, create a path from Guard House/Main Gate, and open the matching VR route before final Milestone 11 GO.
- Users can start Free Roam 360 from the map, begin at Guard House/Main Gate, and move through available campus scenes without selecting a destination.
- New feature testing and regression testing for map destination routing, guided VR routing, Free Roam, and room-door schedule interaction have passed before final GO.
- Schedule data survives refresh and is served from the configured runtime data source.
- MySQL fallback and Supabase runtime modes still pass.
- Supabase session store from Milestone 9 still passes.
- Cloudinary media support from Milestone 10 still passes.
- CSRF, CSP, PWA privacy, role authorization, rate limits, and sanitized errors still pass.
- QA gates pass.
- No secret, API key, private data, session, cookie, JWT, Supabase key, Cloudinary credential, raw DB error, request body, or stack trace leaks.
- Docs match runtime behavior.
- Dirty worktree was preserved.
- No leftover probe users, content, schedules, media rows, temp files, ports, or stray Node processes remain except intentional immutable audit history.

Record the final GO/NO-GO and exact deployment status. Update handoff files only after all Milestone 11 checks pass.

## Pre-Milestone-12 Repair: Road-Following Map Destination Routing

### Goal and Required User Flow

Preserve graph-based shortest-path computation while making the visible route line follow the actual campus roads and walkways. The required user flow remains:

1. The user selects a building pin, building list item, or search result.
2. The user clicks `Set as Destination`.
3. The server computes the route from `main-gate` through `route_nodes` and `route_edges`.
4. The map draws that computed route using the stored road/walkway geometry for each selected edge.
5. The readable route panel shows the same ordered path and remains available if map drawing fails.

The graph remains authoritative for route selection, distance, walk time, accessibility, and ordered steps. Stored edge geometry is authoritative only for drawing the selected path. VR scenes and hotspots remain separate from the 2D route graph and must not silently create or rewrite map routes.

The route color may remain the existing blue `#2563eb`; acceptance depends on the line following roads and walkways, not on changing it to red.

### Ownership and Section Gate

- Codex is the sole owner of this plan and of every GO/NO-GO decision.
- Claude implements only the single RF section named in the current Codex prompt.
- Claude must inspect current files before editing, preserve the dirty worktree, and stop after reporting the authorized section.
- Claude must not edit `plan.md`, `CODEX_HANDOFF.md`, `CLAUDE_HANDOFF.md`, `ROADMAP.md`, or milestone status unless a later Codex prompt explicitly authorizes that exact documentation change.
- Codex reviews each RF section with the code-reviewer skill, relevant static/runtime tests, database parity checks, and browser verification before authorizing the next section.
- The project owner alone applies Supabase SQL. Claude and Codex must not apply migration `0015`.
- RF.6 must receive Codex GO before any later delivery work. Under the current
  owner-authorized revision, `M12.P1` may run a separately gated online pilot
  before OFF.2–OFF.6; final Milestone 12 GO still requires OFF.6.

**RF.1: Road Geometry Baseline Audit and Domain Contract**

Read-only. Establish the exact implementation contract before schema or runtime edits.

Claude must inspect `database/schema.sql`, `database/seed.js`, `database/supabase/0014_route_graph_accuracy.sql`, `repositories/routeRepository.js`, `controllers/mapController.js`, `controllers/adminRouteController.js`, `utils/pathfinding.js`, `views/map.ejs`, `views/admin/campus-map.ejs`, `public/js/admin/admin-map-graph.js`, route probes, QA gates, documentation, migration state, and dirty Git state.

The written contract must define:

- `route_edges.path_geometry` as an optional ordered JSON array of `{ "lat": number, "lng": number }` points from the directed edge's `from` node to its `to` node.
- A valid stored geometry has 2-200 points, finite latitude/longitude values, latitude in `[-90, 90]`, longitude in `[-180, 180]`, and no unsupported keys or nested payloads.
- The first and last points match the edge endpoint node coordinates. Shared consecutive edge endpoints are de-duplicated when a complete route geometry is assembled.
- Reverse directed edges store the exact reversed point sequence of the forward edge.
- Missing or invalid geometry never broadens a query or crashes routing; the server falls back to that edge's two node endpoints and records only sanitized server-side diagnostics.
- `route.geometry` is the public flattened drawing shape. `route.nodes` and `route.segments` remain backward-compatible.
- Geometry points must be intentionally traced from approved campus road/walkway references. Claude must not invent straight shortcuts through buildings, grass, restricted areas, or unmapped spaces.
- No Google Maps, Google Earth, Strava, or other third-party routing API becomes a runtime dependency. Restricted provider geometry must not be copied or persisted without an approved license and attribution decision.

RF.1 changes no files. Claude stops with the audit/contract report. RF.2 cannot begin until Codex reviews the report and gives GO.

**RF.2: Edge Geometry Schema, Seed Data, and Supabase/MySQL Parity**

Implement additive storage and an initial road-following geometry dataset.

Required work:

- Add nullable `path_geometry JSON` to MySQL `route_edges` and an idempotent existing-database column ensure in `database/seed.js`.
- Create, but do not apply, `database/supabase/0015_route_edge_path_geometry.sql` with nullable `jsonb` parity and safe idempotent constraints where practical.
- Keep `0014_route_graph_accuracy.sql` immutable because it is already owner-applied.
- Populate geometry for every active accessible directed edge used by the 13-building graph. Define each undirected path once in seed/migration source data and derive the reverse sequence mechanically to prevent drift.
- Preserve the verified route graph, 13/13 destination coverage, distances, walk times, accessibility, labels, building mappings, and retired-shortcut deletion unless a later separately authorized topology repair changes them.
- Do not seed fake buildings, routes, VR scenes, schedules, academic records, or user data.
- Add focused schema/data checks proving valid JSON shape, forward/reverse parity, endpoint continuity, no orphan geometry, idempotent MySQL reseeding, and no `0016` migration.

Claude stops after RF.2 and reports every changed file and test result. Codex must review `0015` before the project owner applies it. RF.3 cannot begin until Codex gives RF.2 GO, the owner applies `0015`, and Codex verifies the live Supabase column/data parity.

**RF.3: Repository, Pathfinding Result, and API Wiring**

Carry edge geometry through the existing backend boundaries without changing route selection semantics.

Required work:

- Extend explicit MySQL and Supabase route-edge column lists to read `path_geometry`; never use `SELECT *`.
- Parse and normalize database JSON through a shared server-side helper with the RF.1 limits and sanitized failure behavior.
- Preserve Dijkstra weighting and chosen node/edge order. Geometry must not influence which route wins unless a future separately reviewed plan changes routing weights.
- Retain normalized geometry on the selected path segments internally and assemble a flattened, de-duplicated `route.geometry` array in traversal order.
- Keep existing `route.nodes`, `route.segments`, distance, walk-time, destination, and sanitized failure contracts backward-compatible.
- Invalid destination IDs, unknown nodes, missing paths, missing geometry, repository failures, and malformed stored JSON must not expose SQL, PostgREST text, hosts, keys, sessions, cookies, request bodies, or stack traces.
- Add focused MySQL and Supabase probes for full geometry, one-edge fallback, mixed geometry/fallback, reverse traversal, malformed stored geometry handling, and all 13 destinations.

Claude stops after RF.3. RF.4 cannot begin until Codex independently reruns the focused probes and gives GO.

**RF.4: Admin Road Geometry Editor and Validation**

Give admins a usable way to maintain edge geometry without requiring browser-console work or raw numeric building IDs.

Required work:

- Extend the existing admin campus graph interface rather than creating a separate dashboard or redesigning the page.
- Let an admin select a route edge by its readable endpoint labels and edit its geometry on the campus map.
- Provide practical controls to add a waypoint, move or remove a waypoint, undo the latest edit, clear geometry, reset to endpoints, preview the line, and save or cancel.
- Keep endpoints locked or snapped to the selected `from` and `to` route-node coordinates so saved paths remain continuous.
- When saving an undirected campus connection, update the reverse directed edge with the exact reversed geometry in the same backend operation or fail without a partial pair update.
- Enforce admin authorization, CSRF, mutation rate limits, strict body allowlists, RF.1 geometry validation, sanitized 400/404/409/500 responses, and existing audit logging conventions.
- Never render database values through unsafe `innerHTML`; use existing safe DOM construction and escaped EJS patterns.
- Preserve building, schedule, route-node, VR, Cloudinary, session, and map-management controls.

Verification must cover keyboard-accessible controls, readable labels, invalid geometry rejection, forward/reverse atomicity, backend parity, empty/reset states, desktop/mobile layout, and zero CSP/Lucide/Iconify/Leaflet console regressions.

Claude stops after RF.4. RF.5 cannot begin until Codex reviews the API/UI behavior and gives GO.

**RF.5: Public Road-Following Route Rendering**

Render the server-computed route using road geometry while preserving a reliable fallback.

Required work:

- `views/map.ejs` must draw `route.geometry` when it contains a valid ordered shape and fall back to `route.nodes` only when geometry is unavailable.
- Support both configured map renderers through their existing line-layer/polyline paths without duplicating route computation in the browser.
- Clear the previous path before drawing a new destination and prevent stale lines after a failed or unmapped destination request.
- Keep the route panel, `Set VR Route`, predefined routes, Free Roam 360, room-door schedules, map tiles, marker interaction, and accessible no-map fallback unchanged.
- Fit the completed route into view without obscuring the destination workflow or producing horizontal overflow.
- Do not fetch geometry directly from Google Maps, Google Earth, Strava, Cloudinary, or another browser-side service.

Browser acceptance must prove CCS, CAS, CHS, and at least one west-campus destination route from Guard House/Main Gate along visible roads/walkways, with no building-crossing diagonal, no stale route, no console error, and no mobile overflow. The route panel's ordered steps and the visible line must describe the same selected graph path.

Claude stops after RF.5. RF.6 cannot begin until Codex performs independent desktop/mobile browser checks and gives GO.

**RF.6: Focused QA, Regression, Documentation, and Final GO/NO-GO**

Close the repair only after feature and regression evidence is complete.

Focused feature verification must cover:

- All 13 destinations route from `main-gate` in MySQL and Supabase.
- Selected path geometry is continuous, ordered, endpoint-correct, and forward/reverse symmetric.
- CCS, CAS, CHS, and west-campus browser routes follow visible roads/walkways.
- A missing-geometry edge uses the node fallback without breaking the route.
- Invalid or malformed geometry fails safely and never produces a secret/error leak.
- Admin geometry editing works through readable edge labels and persists identically in both backends.

Regression verification must cover:

- `node scripts/mapVrDestinationFlow-probe.js` and any new focused road-geometry probe.
- `node scripts/vrScheduleHotspot-probe.js` and `node scripts/freeRoamVr-probe.js`.
- `npm test`, `npm run qa:db`, `npm run qa:smoke`, `npm run qa:identity`, and `npm run qa:audit`.
- Existing `/map`, `/api/pathfind`, `/api/routes`, `/vr`, guided VR routes, Free Roam, room-door schedules, admin route CRUD, auth/role/CSRF/rate-limit/session behavior, Cloudinary media, CSP, and PWA privacy.
- Desktop and 390px mobile browser checks with zero relevant console errors, no horizontal overflow, and exact-PID server teardown.
- Zero leftover probe rows, temporary migrations/files, test users, ports, or stray Node processes.

Documentation must state that CampuSphere computes routes from its own campus graph and draws owner-managed road geometry; it must not claim Google Maps, Google Earth, Strava, SIS, or external routing-engine integration.

Codex performed the final RF.6 review after the guided-VR coverage-truth repair. **RF.6 is complete and Codex GO.** The final gate verified owner-applied migrations `0014` through `0017`, exact Supabase/MySQL topology and geometry parity, two consecutive green contract suites, focused routing/VR/admin probes, the full QA surface, preserved dirty-worktree state, sanitized failures, and no unresolved route geometry that crosses mapped buildings or bypasses the intended campus roads.

## Pre-Milestone-12 Building Expansion and Offline Delivery

### Ownership and Section Gate

- Codex owns this plan, creates each section prompt, reviews the actual repository and runtime evidence, and gives GO or NO-GO.
- Claude implements exactly one Codex-authorized BE or OFF section at a time, preserves the dirty worktree, stops with a complete report, and does not edit `plan.md`.
- The project owner alone uploads Cloudinary media and applies Supabase SQL after Codex reviews the exact migration.
- A later section must not begin until the preceding section receives Codex GO and any required owner-applied Supabase migration is verified live.
- BE.6 remains required before the limited pilot. OFF.6 remains required before
  final Milestone 12 GO, although `M12.P1` may conduct the separately reviewed
  online pilot first.

<!-- GUIDED-VR HISTORICAL POLICY START -->
### Building Expansion

> **Historical/superseded Guided-VR policy record.** BE.1 through BE.6 are
> accepted completed history, but their original CAS-only/deferred-CCS scope
> does not describe the current 25-destination runtime or govern future OFF
> work. The current-status block and the forward-looking offline sections below
> are the active authority. This marker preserves evidence without reviving the
> superseded policy.

**BE.1: Authoritative Building and Routing Baseline Audit**

Read-only. Inventory every CSPC building intended for the public map and compare the owner-approved authoritative roster with the current 13-destination baseline.

The audit must record canonical building names, aliases, categories, coordinates, entrances, public visibility, current MySQL/Supabase records, route-node mappings, required bidirectional connections, road-geometry requirements, and any missing or conflicting data. Every proposed public destination must be classified as routable, unavailable, or requiring correction. CAS is the required polished guided-VR demonstration destination; CCS remains a routable campus-map destination with guided VR explicitly deferred until the owner supplies genuine approved panoramas.

BE.1 changes no repository file, database row, migration, Cloudinary asset, or runtime state. BE.2 cannot begin until Codex reviews the audit and approves the authoritative expansion roster.

**BE.2: Atomic Building and Route Dataset Expansion**

Add every approved missing building and its complete routing data as one coordinated backend-parity batch.

Required work:

- Add canonical building records to MySQL seed data and the next Codex-reviewed, owner-applied Supabase migration using stable natural keys rather than cross-backend numeric IDs.
- Add one destination route node per approved building plus every required walkway junction, bidirectional route-edge pair, and owner-managed road geometry.
- Derive reverse geometry mechanically and preserve endpoint continuity, finite coordinate validation, accessibility flags, distances, walk times, and sanitized failures.
- Keep every new building unselectable as a public destination until its complete route is present; the section must not leave a visible building that draws a broken, stale, or misleading path.
- Preserve the owner-applied `0014` through `0017` migrations byte-for-byte and do not invent buildings, coordinates, shortcuts, panoramas, schedules, or academic data.

BE.2 stops before public/admin integration work. Codex must review the data, migration, idempotency, topology, road geometry, and backend parity before the owner applies any new Supabase SQL or BE.3 begins.

**BE.3: Public and Admin Dataset Integration**

Verify and, only where required, complete data-driven integration of the expanded dataset across admin building management, admin campus-map management, public buildings, map search, building pins/list items, and destination selection.

Every selectable building must route from the authoritative Guard House/Main Gate. Missing, invalid, or temporarily unavailable routes must produce a clear unavailable state and remove any previous line rather than drawing a stale or misleading path. Preserve room schedules, building deletion guards, readable building names instead of raw IDs, authorization, CSRF, mutation rate limits, audit logging, and sanitized 400/404/409/500 contracts.

Verification must cover both data sources, both map renderers, search and destination selection, admin CRUD compatibility, safe unavailable states, and no regression to Cloudinary, sessions, schedules, VR, CSP, or PWA privacy.

**BE.4: Selected Demo VR Dataset Completion**

Complete real guided-VR coverage from Guard House/Main Gate to CAS using owner-uploaded Cloudinary panoramas, real `vr_scenes`, and directional scene hotspots. Preserve CCS campus-map routing while its guided-VR flow remains explicitly deferred until genuine owner-approved panoramas exist.

Required behavior:

- The CAS guided route ends only at its approved destination scene.
- CCS remains route-ready on the campus map, but every guided-VR entry returns the fixed unavailable state with zero guided scenes and never claims arrival.
- Free Roam begins at the Guard House and continues through available general-road scenes without claiming a destination.
- Room-door schedule hotspots and their exact building/room/floor matching remain intact.
- Other destinations may have partial or no panorama coverage, but must retain the explicit coverage-ended state and must never show false arrival.
- Claude must not upload, rename, transform, or delete Cloudinary assets or expose Cloudinary credentials; the owner supplies approved delivery URLs and public IDs.

BE.4 requires MySQL/Supabase CAS VR metadata parity, accessible hotspot navigation, missing-media fallbacks, identical deferred-CCS behavior across all route/VR source combinations, desktop/mobile browser evidence, and cleanup of all temporary probe data. Adding CCS panoramas later requires a separately authorized dataset upgrade before any admin mutation.

**BE.5: Expansion Feature and Regression Gate**

**Status: COMPLETE / CODEX GO.**

The owner selected the current 13 buildings as the orientation-demo roster, not
the complete CSPC campus. They remain editable through the existing admin
interface, and future buildings may be added after this gate; coordinates,
names, descriptions, entrances, or routes changed after verification require
updated natural-key parity and regression evidence rather than a permanent
data lock.

The BE.5 parity target is:

- CAS public description: `College of Arts and Sciences (CAS)`.
- `main-gate` public label: `Guard House / Main Gate`.
- CAS building and `cas` route-node coordinate:
  `13.40594916, 123.37704274`.
- MySQL and Supabase `east-walk ↔ cas` geometry must be naturally identical,
  endpoint-continuous, and exact forward/reverse sequences.
- The route topology remains explicitly pinned at
  `20/48/24/48/24/13`; both VR backends remain `85/66`.

Source and fresh-install seed values carry the target. Owner-applied migration
`0019_be5_selected_demo_parity.sql` is data-only, natural-key based, and
transactional. The dry-run-first MySQL utility
`scripts/applyBe5SelectedDemoParityMysql.js` requires the exact confirmation
token `APPLY_BE5_SELECTED_DEMO_PARITY_TO_MYSQL`, creates a locked-snapshot
backup, verifies complete semantic fingerprints before and after writing, and
was executed exactly once under separate authorization and now reports zero
actions. The two
Supabase CAS schedule rows remain source-local; schedule and VR rows are not
part of this correction.

Run the complete selected-demo acceptance matrix against MySQL and Supabase
after both controlled data operations.

Focused verification must prove:

- Every approved public destination routes from `main-gate` with continuous, endpoint-correct, road-following geometry and no unrelated-building transit.
- Leaflet and MapLibre render the same API geometry on desktop and 390px mobile without horizontal overflow or relevant console errors.
- CAS guided VR, deferred CCS guided-VR behavior, CCS map routing, Free Roam, room-door schedules, panorama fallbacks, and truthful partial-coverage behavior remain usable.
- Rapid destination switching, route clearing, failed/unmapped requests, predefined routes, malformed geometry fallback, and stale-response protection leave only the current valid route.
- Building/search/admin surfaces agree by natural identity across backends, with no orphan node, edge, geometry, scene, hotspot, schedule target, or selectable unrouted building.
- Focused probes, two consecutive `npm test` runs, `qa:db`, `qa:smoke`, `qa:identity`, and `qa:audit` pass with complete cleanup and no secret/error leak.

BE.5 received Codex GO after the controlled Supabase/MySQL rollout, `52/52`
Leaflet/MapLibre destination evidence, focused accessibility/race/VR checks,
two consecutive full suites, all four QA commands, and clean fixture/listener
closeout. Any later selected-demo change requires refreshed evidence.

**BE.6: Dataset Freeze and Codex GO/NO-GO**

**Status: COMPLETE — CODEX GO.**

Freeze the owner-approved building roster, coordinates, entrances, graph topology, road geometry, selected CAS VR scenes/hotspot mappings, and the deferred CCS guided-VR policy only after BE.5 passes.

Pin the final building/node/edge/pair/geometry/destination/scene counts and migration hashes in focused QA and current documentation. Require live owner-applied Supabase parity with MySQL before GO. After BE.6 GO, no building, routing, or selected demo-VR data may change without a separately reviewed correction that updates the freeze evidence.

The source-controlled freeze is `config/selectedDemoFreeze.js`, verified by
`scripts/be6DatasetFreeze-probe.js`. It pins migrations `0001`-`0019`, the
sorted 13-building roster, topology `20/48/24/48/24/13`, VR totals `85/66`,
selected CAS scope `26/51`, exact 24-scene order, two interior scenes, one CAS
schedule target, and the deferred CCS policy. Aggregate manifest fingerprint:
`a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d`.

Codex GO evidence: the read-only freeze probe and every focused building,
topology, geometry, guided-CAS, map-to-VR, Free Roam, schedule-hotspot, and
repair-safety probe passed; retained BE.5 `52/52` visual evidence remained
valid under unchanged runtime/UI hashes; two consecutive `npm test` runs and
all four QA commands passed; `npm audit --omit=dev` reported zero
vulnerabilities; and final cleanup found no fixture or listener residue.

BE.6 GO authorized OFF.1. OFF.1 subsequently completed and received Codex GO.

<!-- GUIDED-VR HISTORICAL POLICY END -->

### Offline Campus Navigation Package

**OFF.1: Offline Baseline Audit and Domain Contract**

**Status: COMPLETE — CODEX GO.**

OFF.1 compared the existing manifest, service worker, offline shell, approved
caches, runtime APIs, map/VR media behavior, and manuscript requirements
against the frozen BE.6 dataset. The current PWA remains a privacy-safe demo
shell and bounded runtime cache, not the completed offline navigation package.

The audit found and closed two authenticated-HTML privacy defects:

- `/map` now renders the escaped CSRF meta token required by logout.
- Authenticated non-API responses receive exact
  `Cache-Control: no-store, private`. Exemption is anchored only to explicit
  `/api/` and `/admin/api/` paths, so spoofed `Accept`, XHR, or content-type
  headers cannot make personalized HTML cacheable.

The final Playwright MCP logout-isolation check verified `/map` and the logout
redirect carried the no-store policy, logout redirected to
`/auth?logged_out=1`, CampuSphere dynamic caches and offline-catalog records
were empty, session-neutral shell/static caches remained, and browser Back,
reload, and direct `/map` revisit could not replay the authenticated page.

The owner-approved package is now deliberately **2D-only**. It requires an
explicit **Download Offline Guide** action, retains one integrity-checked
version until explicit logout, reads the current active building and route
backends, and precomputes road-following routes from Guard House / Main Gate to
each safely resolvable building node. It ships a bounded normal campus basemap,
text building details, and a local generic building placeholder. It excludes
360 images, Guided VR, Free Roam, Cloudinary media, building photos, schedules,
authenticated HTML, sessions, CSRF tokens, credentials, user/profile data,
admin/private content, mutations, raw errors, and backend-selector identities.
An unmapped building remains available for details but exposes a truthful
route-unavailable state.

**OFF.2: Installability, Offline Shell, and Update Lifecycle**

**Status: COMPLETE — CODEX GO.**

The post-pilot implementation order is OFF.2, OFF.3, OFF.4, OFF.5,
`M12.P1-D6`, then OFF.6. D6 remains a separate Claude prompt and Codex gate; it
is grouped with the offline closeout tranche but must not be combined with an
OFF section. This keeps the admin-only analytics repair at the lowest priority
until student and guest testing is complete while still closing it before final
Milestone 12 GO.

Complete PWA installability and the versioned offline lifecycle using the existing custom service worker and manifest. Provide a usable session-neutral offline shell, visible online/offline state, update-available feedback, safe activation, old-cache invalidation, and deterministic recovery after reconnecting.

Do not cache personalized EJS pages or weaken existing service-worker privacy boundaries. Verification must cover first install, repeat install, cache-version upgrade, interrupted install, offline launch, reconnection, and mobile installability basics.

**OFF.3: Privacy-Safe 2D Guide Data and Explicit Download**

**Status: COMPLETE — CODEX GO.**

Build one authenticated, read-only, `no-store` package from the currently
selected building and route backends. Emit only normalized building text,
participant-safe details, Main Gate origin, route lines/steps, and the pinned
basemap identity. Validate JSON and map hashes before replacing the active
IndexedDB record in one transaction and reverify both when loading it.

Never cache or package authenticated HTML, admin APIs, user/profile responses,
session identifiers, cookies, credentials, private role content, mutation
responses, schedules, VR metadata/media, Cloudinary URLs, backend names, raw
errors, or unapproved URLs. Download/update occurs only from an explicit user
action while connected; the service worker never intercepts or caches the
package endpoint or PMTiles archive.

**OFF.4: Offline Map and Destination Routing**

**Status: COMPLETE — CODEX GO.**

Render the downloaded current-backend destinations and their road-following
routes while disconnected, always beginning at Guard House / Main Gate. Use the
self-hosted MapLibre runtime and a bounded, content-addressed local PMTiles
campus extract as the normal map background. The route line and steps must
represent the same selected graph path and preserve clear unavailable states.

Never mirror the public OpenStreetMap tile service. If MapLibre, PMTiles, or
WebGL cannot render, degrade to a keyboard-operable simplified campus map plus
the complete building list and route directions. Preserve route clearing and
desktop/mobile usability.

**OFF.5: Offline Building Details, Integrity, and Recovery**

**Status: COMPLETE — CODEX GO.**

Clicking a building node or list item opens a nonmodal details window with the
current description, category, walk-time text, offices/services, floors/rooms,
entrances, landmarks, and the local generic placeholder. Render every database
string through safe text nodes. Support Escape close, keyboard node activation,
focus placement/restoration, searching, route selection, and truthful
details-only behavior for an unroutable building.

An interrupted or corrupt update must leave the prior valid record usable.
Reject wrong schema, destination collisions, invalid map identity, byte/hash
drift, and partial IndexedDB writes. Explicit logout deletes only the exact
offline-guide IndexedDB database while leaving the session-neutral PWA shell
and unrelated browser storage alone.

**OFF.6: Offline Feature, Privacy, and Final GO/NO-GO**

**Status: COMPLETE — CODEX GO.**

Run the final offline acceptance matrix after an online warm-up and after a
clean install. Test network loss, browser restart while offline, every current
building entry and every available Main Gate route, node/list details windows,
the normal PMTiles campus background, the keyboard fallback map, unroutable and
missing-coordinate buildings, interrupted/corrupt replacement, reconnect
refresh, cache upgrades, logout/shared-device privacy, storage/error handling,
and desktop/mobile layouts. Assert explicitly that no 360/Guided-VR/Free-Roam,
schedule, building-photo, or Cloudinary payload is present.

OFF.6 receives GO only when:

- No private, authenticated, admin, session, credential, mutation, or personalized HTML response exists in Cache Storage.
- Offline public data matches the selected current backend at download time and cannot mutate server state.
- Required offline workflows pass without blank maps, wrong routes, stale data leaks, relevant console failures, horizontal overflow, or intermittent tests.
- Online auth, sessions, CSRF, CSP, rate limits, Supabase/MySQL switches, Cloudinary delivery, schedules, routing, and admin behavior regressions remain green.
- No probe rows, test users, temporary files, listeners, service-worker test state, or stray processes remain.

OFF.6 Codex GO remains mandatory before final Milestone 12 GO. The completed
owner-attested pilot cannot be described as offline-ready or as final Milestone
12 signoff.

### M12.P1: Limited Vercel Routing-Focused Pilot Exception

**Status: PILOT REVIEW COMPLETE — OWNER-ACCEPTED 2026-08-05; OFF.2 NEXT.**

The limited pilot exposed the entire then-reachable authenticated application.
It was routing-focused by facilitation, not by a technical feature restriction:
participants were guided to evaluate building search, destination routing,
route clarity, and usability, while other authenticated features remained part
of the reviewed security/exposure surface. No anonymous browsing was introduced.

Before any deployment, Codex must review Vercel configuration, production
environment variables, Supabase-only runtime operation, Supabase session
storage, OAuth redirects, cookies, CSRF/CSP/rate limits, logs/errors, secrets,
Cloudinary delivery, service-worker behavior, exposed routes, rollback, and
test-account handling. The completed review confirmed one critical blocker —
live Supabase seed accounts still accepted publicly documented default
credentials — and six high blockers: fail-open Vercel data-source modes, an
unproven awaited session bootstrap, process-local rate limits, anonymous
access-denial audit write amplification, an unreviewed Vercel package/static
boundary, and unpinned or externally executed browser dependencies.

The findings above are transferred to the one-at-a-time remediation stream
below. Passing the final readiness re-review authorizes only a separate owner
decision to deploy the pilot; it does not itself perform deployment.

Pilot feedback was retained externally through the owner-created evidence path.
No CampuSphere feedback table, mutation endpoint, or migration is introduced.
The owner attests that the human pilot occurred on 2026-08-05 and accepts it
with zero reported findings. Participant/Form evidence remains external and no
participant PII is recorded in Git. The tested build's full source-commit
identity was not independently verified, so this disposition is owner-attested
pilot acceptance rather than independent current-build verification. Pilot
review is complete for sequencing purposes. The owner-authorized local
OFF.2-OFF.5 implementation candidate has focused evidence but no Codex GO. The
deferred real admin dashboard
analytics repair in `M12.P1-D6` runs after OFF.5 and before the final OFF.6
acceptance gate.

### M12.P1-R: Limited-Pilot Readiness Remediation

**Status: R1–R7, D1–D5, AND EXPANDED D7 COMPLETE — CODEX GO. R3 AND ALL
SESSION-HYGIENE/OWNERSHIP/IMPORT-DETECTOR FOLLOW-UPS ARE CLOSED. R4 AND THE
DEPENDENCY-SECURITY REMEDIATION ARE CLOSED. R5 AND BOTH FOLLOW-UPS ARE CLOSED.
`M12.P1-R6`, `M12.P1-R7`, AND `M12.P1-D7` ARE COMPLETE — CODEX GO. R8 IS THE
NEXT READ-ONLY SECTION. DEPLOYMENT NOT
AUTHORIZED.**

Claude implements only the single `M12.P1-R*` section named in the current
Codex prompt, preserves the intentionally dirty worktree, stops after reporting
changed files and verification, and does not begin the next section until Codex
reviews live evidence with the code-reviewer skill and gives GO. A section may
not absorb work from a later finding merely because the files overlap.

**M12.P1-R1: Live Credential Containment and Pilot-Account Guardrail**

**Status: COMPLETE — CODEX GO; NO CLAUDE LIVE-DATA MUTATION.**

The owner-approved pilot account inventory retains four local-login regression
identities: the primary owner administrator, demo instructor, sample student,
and sample guest. The student and guest were recreated after deletion and may
therefore have new backend-local numeric IDs; their canonical email, intended
role, and role-profile association are authoritative. The separately assigned
`admin2` and `admin3` accounts are also retained for two trusted collaborators
performing owner-authorized building, route-node, building-detail, and 360-scene
work. They are attributed administrator accounts, not shared regression
identities.

The owner reports that all four regression identities use unique private
replacement passwords synchronized to the ignored local `.env`. The R1
acceptance run historically passed `24/24`: each canonical identity resolved
exactly once with its intended role, the student, instructor, and guest profile
rows were present, the private replacement candidates matched only in memory,
all repository-known former defaults were rejected, and zero unexpired
  persisted sessions remained after owner logout. The latest read-only rerun is
  again `24/24`: all four canonical identities retain the intended account,
  role, profile, password-containment, and zero-unexpired-session state. The D5
  probe now logs out and proves its former cookie is rejected; the independent
  local-MySQL Playwright MCP verification also logged out and passed direct-
  revisit isolation. No direct session-row cleanup is authorized. No replacement
  password, cookie, hash, session
identifier, recovery value, or collaborator email/numeric ID may appear in
source, documentation, logs, screenshots, chat, or test output.

The completed R1 repository work removed plaintext demo credentials from
repository documentation, added one shared test-only credential loader for
Supabase-capable authentication probes, and added the read-only pilot
credential/session-safety probe. The loader
uses `SUPABASE_REGRESSION_ADMIN_EMAIL` /
`SUPABASE_REGRESSION_ADMIN_PASSWORD`,
`SUPABASE_REGRESSION_STUDENT_EMAIL` /
`SUPABASE_REGRESSION_STUDENT_PASSWORD`,
`SUPABASE_REGRESSION_INSTRUCTOR_EMAIL` /
`SUPABASE_REGRESSION_INSTRUCTOR_PASSWORD`, and
`SUPABASE_REGRESSION_GUEST_EMAIL` /
`SUPABASE_REGRESSION_GUEST_PASSWORD`. Supabase-mode probes must fail closed with
a fixed sanitized message when a required value is missing or blank and must
never fall back to a documented or hardcoded live credential. Local MySQL
fixtures may retain deterministic local-only credentials.

The safety probe must locate the four regression identities by canonical email,
require exactly one row with the intended role, require the student, instructor,
and guest role-profile rows, compare private replacement candidates to the live
bcrypt hashes only in memory, reject every repository-known former default
candidate, and confirm zero unexpired persisted sessions after the owner logout.
It prints only sanitized pass/fail labels and does not call a login endpoint,
create a session, or expose candidate values. Immutable migration `0002`, local
MySQL seed fixtures, and migrations `0001` through `0019` remain unchanged. No
SQL, migration, direct Supabase mutation, account operation, password rotation,
or session deletion was performed by Claude or Codex.

**M12.P1-R2: Fail-Closed Vercel Production Profile**

**Status: COMPLETE — CODEX GO; DEPLOYMENT NOT AUTHORIZED.**

Add one centralized production-profile preflight activated when `VERCEL=1`.
Before any backend client, session middleware, or route can serve, require
`NODE_ENV=production`, `SESSION_STORE=supabase`, `AUTH_DATA_SOURCE=supabase`,
`CONTENT_DATA_SOURCE=supabase`, `BUILDING_DATA_SOURCE=supabase`,
`ROUTE_DATA_SOURCE=supabase`, `VR_DATA_SOURCE=supabase`,
`SCHEDULE_DATA_SOURCE=supabase`, `MAP_RENDERER=maplibre`, and valid server-only
`SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY`. A missing, empty, misspelled,
or conflicting value must cause a fixed sanitized failure; Vercel must never
fall back to MySQL, Leaflet, or memory sessions. Preserve the existing
MySQL/Leaflet/local-rehearsal defaults outside Vercel.

Verification must exercise every required value independently, the complete
valid Vercel matrix, sanitized error output, and unchanged non-Vercel fallback
behavior. Stop after this production-profile change and wait for Codex GO.

Codex GO evidence: the corrective preflight validates platform `process.env`
before dotenv and all side-effectful imports; it accepts only the reviewed
`sb_secret_` or legacy HS256 `role=service_role` shapes; its database-free probe
passed `88/88`; an independent accepted/rejected key matrix passed `8/8`; the
configured Supabase URL/key passed the shape contract without printing either
value; syntax, leak, former-default, whitespace, listener, and residue checks
were clean. The redundant dead override in one probe setup expression is a
non-blocking test-cleanliness note because the separate blank and deleted cases
both execute and pass.

**M12.P1-R3: Awaited Vercel Runtime and Session Bootstrap**

**Status: COMPLETE — CODEX GO;
DEPLOYMENT NOT AUTHORIZED.**

Refactor startup around one shared readiness promise. Mount a readiness gate
before session handling and application routes so an exported Express app
cannot serve while the Supabase session store is initializing. Local startup
must await the same readiness promise before `app.listen`; Vercel requests must
await it and receive a fixed sanitized `503` when initialization fails.
Concurrent first requests share one initialization attempt and must not create
duplicate clients, cleanup timers, listeners, or logs containing backend
details.

Verification must cover delayed success, rejected initialization, concurrent
first requests, local listener behavior, exported-app behavior, sanitized
failure responses, and process/listener cleanup. Stop after this bootstrap
change and wait for Codex GO.

**M12.P1-R3 session-hygiene/ownership/import-detector follow-ups (complete —
Codex GO).**

A follow-up closed three defects found during post-R3 follow-up review. (1) Runtime: session
regeneration discarded the anonymous CSRF token and the replacement was minted
lazily on the first authenticated render, so an immediately submitted HTML
logout form could be checked against a stored session that lacked it.
`ensureCsrfToken(session)` was added to `middleware/csrfProtection.js` and
`establishAuthenticatedSession` now mints the token after `assignSessionUser`
and before `saveSession`; the pre-regeneration token is never reused. (2)
Harness: `scripts/with-server.js` inherited an ambient `SESSION_STORE` when
`sessionStore` was omitted, so nominal MySQL legs used the Supabase session
store. The child store now follows the normalized mode, blank/invalid explicit
values fail closed, and `env.SESSION_STORE` is always assigned. (3) Ownership:
every canonical-login probe now registers its jars with
`scripts/probeSessionLifecycle.js` and terminates them from a `finally`, and
the ownership inventory discovers probes from the filesystem as well as the
registered list. `scripts/probeSessionResidue-probe.js` is the registered FINAL
npm-test gate and the authoritative zero-residue postcondition; static
ownership is defense in depth only.

Accepted Codex GO evidence: full suite
`2921/2921` with `QUALITY-GATES OK` (in-suite resolver
`14/14`, in-suite residue `18/18`); standalone R1 `24/24`, R2 `88/88`, R3
`86/86`, BE.6 `46/46` with the frozen fingerprint unchanged. Standalone results
are never counted inside the full-suite total. Bounded session restorations
were separately authorized and touched only validated regression identities'
persisted sessions.

**M12.P1-R4: Shared Upstash Rate Limiting**

**Status: COMPLETE — CODEX GO; DEPLOYMENT NOT AUTHORIZED.**

Add exact dependency `@upstash/redis@1.38.0` and preserve the existing limiter
scopes, configurable limits, fixed `429` response shapes, and `Retry-After`
contract while moving Vercel counters to atomic Redis increment/expiry
operations. Require server-only `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN`, and a separate `RATE_LIMIT_KEY_SECRET` of at least
32 characters in the Vercel production profile. Persist only HMAC-derived
bucket identifiers; never store raw IP addresses, emails, user data, cookies,
tokens, or submitted content in Redis keys or values.

Missing or unreachable shared rate-limit storage must fail closed with a
sanitized unavailable response on Vercel and must never silently fall back to a
process-local Map. Non-Vercel development retains the in-memory adapter.
Verification must cover counters shared across simulated instances, atomic
expiry, bucket isolation, `429` and `Retry-After`, expiry recovery, sanitized
store failure, secret-leak scans, and existing auth/profile/admin regression
behavior. Stop after this shared-limit change and wait for Codex GO.

The first R4 submission received Codex NO-GO on four findings, all now closed:
production SDK retries are set to `retry: { retries: 0 }` (exactly one transport
attempt — `retry: false` still allows two under `1.38.0` and is deliberately not
used); the `Math.min(ttl, windowMs)` clamp is removed so `Retry-After` reflects
the authoritative Redis `PTTL`; the Lua script's exact first line is now
`#!lua flags=allow-key-locking` so Upstash locks only `KEYS[1]` instead of the
whole database; and the stale forward-looking authority text that still started
the remaining work at R3 is corrected, with the documentation gate extended to
reject that class of false-green while still accepting historical R3
descriptions.

Accepted implementation and Codex GO evidence:
`services/rateLimitStore.js` is the narrow storage boundary.
`VERCEL=1` selects a shared `@upstash/redis@1.38.0` counter (one client per
process/module lifetime, never per request); every other environment keeps the
original in-memory fixed-window Map and never loads the dependency. Each
counted request is ONE atomic server-side Lua `EVAL` performing `INCR`, `PTTL`,
and a conditional `PEXPIRE` for a new window or a missing expiry, returning the
count plus authoritative TTL; an Upstash pipeline is explicitly non-atomic and
is not used. Only HMAC-SHA-256 digests are persisted, as
`csrl:v1:<scope>:<digest>` keys with a bare integer counter value; namespace,
version, and scope are part of the HMAC material and components are
length-prefixed, so scopes and identities cannot collide. The pure Vercel
preflight additionally requires server-only `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN`, and a `RATE_LIMIT_KEY_SECRET` of at least 32
characters under the same one fixed sanitized refusal, with no network call and
no requirement outside Vercel. Shared-store failure returns one fixed sanitized
`503` with `Cache-Control: no-store`, never calls `next()`, never falls back to
a process-local Map, and logs nothing. All `429`/`Retry-After` contracts,
`RATE_LIMIT_*` overrides, limiter scopes, middleware order, pre-body placement,
and the safe-method admin exemption are unchanged, and `server.js` was not
modified. Claude-side follow-up evidence: focused standalone
`scripts/sharedRateLimit-probe.js` `180/180` (was `154/154`; +26); full suite
`3040/3040` with `QUALITY-GATES OK` (was `3021/3021`; +19, and +119 versus the
accepted pre-R4 `2921/2921`); standalone R2 `119/119`; standalone R3 `86/86`
unchanged; standalone R1 `24/24`; residue `18/18`; BE.6 `46/46` with the
fingerprint unchanged. Standalone probes are never part of the npm-test total.

**Dependency-security remediation (2026-07-22 closeout — historical accepted
Codex GO evidence).**

The production audit advisories discovered during R4 closeout were resolved at
that time
without a major framework upgrade, direct dependency, override, `--force`, or
application-source change. `package.json` remained byte-identical. The lockfile
now resolves Express's nested `body-parser` to `2.3.0` and EJS tooling's nested
`brace-expansion` to `2.1.2`; compatible `type-is` and nested `content-type`
entries moved only as required by npm's package graph. At that closeout
`express@5.2.1`, `ejs@3.1.10`, `@upstash/redis@1.38.0`, and
`express-session@1.19.0` were pinned. Accepted verification:
`npm audit --omit=dev` and `npm run qa:audit`
both report zero vulnerabilities; full suite `3040/3040`; R4 `180/180`; R2
`119/119`; R3 `86/86`; R1 `24/24`; residue `18/18`; BE.6 `46/46` with the
frozen fingerprint unchanged.

**M12.P1-R5: Bounded Anonymous Access-Denial Auditing**

**Status: COMPLETE — CODEX GO.**

Routine logged-out requests to login-gated or role-gated routes must still
receive the existing redirect or `401` response but must not create
`system_logs` rows. Preserve audit records for real authentication failures and
for authenticated users attempting actions outside their allowed role. Do not
add an anonymous-denial table, raw-IP storage, individual Redis denial records,
or periodic database aggregation.

The repository-observed cause is in `middleware/roleAuth.js`: both anonymous
branches call the authorization-denial audit helper with null actor data, while
the authenticated wrong-role branch calls the same helper with the session
actor. R5 removes the first two audit writes, retains exactly one authenticated
wrong-role write, and hardens the helper so a missing or malformed actor cannot
be persisted accidentally. Preserve the existing `302`/`401`/`403` HTML-versus-
JSON negotiation, fixed audit taxonomy, query-free route target, best-effort
response behavior, and append-only audit design. Do not change the audit schema,
repository, session/auth model, rate limiting, or migrations.

Verification must prove in MySQL and Supabase that repeated anonymous protected-
route requests create zero audit rows, one authenticated role denial creates
exactly one sanitized row, login-failure auditing still works, and redirect/
JSON negotiation remains unchanged. Use supported HTTP/admin-log interfaces,
own and terminate sessions through `scripts/probeSessionLifecycle.js`, and keep
the focused R5 probe standalone. Audit rows created by this authorized security
test are immutable evidence: never delete, truncate, or directly repair them.
Clean up only owned sessions/listeners and stop for independent Codex review.

Accepted outcome (complete and Codex GO). The
production change is confined to `middleware/roleAuth.js`. Both anonymous
branches stopped auditing; the authenticated wrong-role branch retains exactly
one write through the new authenticated-only
`auditAuthenticatedAccessDenied(req, actor)` helper, which refuses any actor the
new pure `isAuditableActor(actor)` predicate rejects (a positive integer id and
a non-blank role are both required). `middleware/roleAuth.js` now contains
exactly one `auditService.record` call site. The fixed taxonomy, query-free
route target, sanitized message, fire-and-forget behaviour, `wantsJson(req)`
negotiation, `302 /auth`, fixed `401` JSON, and `403` HTML/JSON contracts are
unchanged, and no schema, migration, repository, session, rate-limit, or
dependency change was made. The standalone
`scripts/boundedAnonymousAccessDenial-probe.js` passed `90/90` across MySQL
(port `3381`) and Supabase (port `3382`); the in-suite `bounded-anon-denial`
gate proves the contract statically with negative fixtures mutated from the real
middleware and probe sources and contributes `133/133`. R5 remains standalone
and is never counted in the `npm test` total.

R5 follow-up (closes two independent Codex findings). (1) The focused probe now
proves the AUTHORITATIVE unfiltered `system_logs` total is unchanged across the
twenty anonymous requests, not merely the filtered authorization/denied count:
a fail-closed `validateLogsBody` reads a distinct `globalTotal` from
`body.summary.total` (never substituting the filtered `body.total`; missing/
malformed/negative fails closed), a bounded `readStableGlobalTotal` fixes a
stable baseline (two consecutive equal reads, ≤24 reads at 250 ms, reset by any
invalid read) immediately before the anonymous batches, and `globalTotalStaysAt`
proves it unchanged across six reads afterward — adding two per-backend checks
(`86/86` → `90/90`). (2) Both reusable prompts in
`docs/new-session-grounding-prompts.md` were corrected from their stale
pre-follow-up wording to current authority and are now validated by
a dedicated extractor/validator in `runDocsCurrentGate` that parses each fenced
prompt independently and fails on structural defects, stale R5-next wording, a
premature R5 GO, or R6 authorization. Follow-up candidate evidence: full suite
`3234/3234` with `QUALITY-GATES OK` (superseding the initial `3162/3162`; +72 =
+54 `bounded-anon-denial`, +18 `docs-current`), focused R5 `90/90`, R4
`180/180`, R2 `119/119`, R3 `86/86`, credential/session safety `24/24` before
and after, canonical residue `18/18` before and after, BE.6 `46/46` with the
frozen fingerprint unchanged, and zero production dependency vulnerabilities.
Historical note: the FIRST (initial-candidate) `npm test` was red in four
`bounded-anon-denial` checks — all new-gate authoring defects (documentation
prose matching forbidden-pattern scans, and one no-op negative fixture), no
application gate failed, corrected before that green run; the follow-up produced
no red suite run. Independent Codex review accepted the implementation,
authoritative-global-total follow-up, and documentation-gate final correction.

**M12.P1-R6: Self-Hosted Browser Dependencies**

**Status: COMPLETE — CODEX GO.**

Executable CDN dependencies are replaced with reviewed same-origin assets under
`public/vendor`. The already deployed versions are preserved to avoid an
unrelated upgrade: Leaflet `1.9.4`, MapLibre GL JS `4.7.1`, Pannellum `2.5.6`,
and Iconify Icon `1.0.7`; the former `lucide@latest` reference is resolved to
exact Lucide `1.25.0`. License notices and acquisition checksums ship with the
assets, Leaflet CSS and marker images are served locally, and the obsolete
executable CDN origins are removed from CSP. Approved map-tile, Google Fonts,
Iconify data, and Cloudinary delivery origins remain only where the runtime
still requires them; no remote executable script or stylesheet remains.

Delivered: 18 files under `public/vendor` plus `public/vendor/manifest.json`
recording package, version, registry tarball, sha512 integrity, source path,
destination, license, and the SHA-256 of every shipped byte. Every tarball's
SHA-512 matched the registry-published `dist.integrity`. The only transformation
is the pre-existing Leaflet `sourceMappingURL` removal, proven byte-exact
against the tarball source. CSP `script-src` is now exactly `'self'` plus the
per-request nonce, with `unpkg.com`, `cdn.jsdelivr.net`, and
`code.iconify.design` gone from every directive and nothing broadened. The
MapLibre UMD bundle uses a `blob:` worker and requested no separate worker file,
so none is shipped. `package.json` and `package-lock.json` are byte-identical.
`public/sw.js` changed in commentary only.

Verification covered every affected admin page, the public map in both renderer
modes, guided and Free Roam VR, missing-asset behavior via request interception,
CSP headers and console output, desktop `1440x900` and mobile `390x844`
layouts, licenses/checksums, and a source scan showing no `@latest` or remote
executable asset reference. A narrow follow-up added an independently reviewed
`EXPECTED_VENDOR_INVENTORY` (probe code, outside the manifest) that pins every
package/file's exact metadata and final SHA-256, verified against official
`npm view`/`npm pack`; the analyzer and gate now fail closed on any divergence
and re-verify disk/HTTP bytes against the pinned hashes, so a coordinated
bytes+manifest-hash swap fails without a reviewed code change. Accepted Codex
GO evidence: focused standalone
`scripts/selfHostedBrowserDependencies-probe.js` `230/230` (was `228/228`; +2);
full suite `3415/3415` with `QUALITY-GATES OK` (in-suite `self-hosted-vendor`
gate `139`, up from `119`; pre-remediation suite `3375/3375`); R2 `119/119`,
R3 `86/86`, R4 `180/180`, R5 `90/90`; safety `24/24` and
residue `18/18` before and after; BE.6 `46/46` fingerprint unchanged; audit
zero. Independent Codex browser verification passed all eight affected admin
pages, `/home`, `/dashboard`, `/about`, `/events`, `/map` in both renderer
modes, Free Roam VR, and the valid CAS guided route at `1440x900` and `390x844`.
Lucide, Iconify, Leaflet, Pannellum, and MapLibre interception cases failed
closed truthfully with only expected same-origin `404`s, no executable CDN
fallback, CSP violation, unexpected exception, horizontal overflow, stale map
route, or false VR arrival. R1-R6 are standalone and are never part of the
npm-test total.

**M12.P1-R7: Vercel Package and Static-CDN Boundary**

**Status: COMPLETE — CODEX GO.**

Add an allowlist-oriented `.vercelignore`, a minimal `vercel.json`, and a
read-only package-manifest probe. The package may include only runtime source,
views, required public assets, and package manifests. It must reject `.env*`,
evidence documents and screenshots, `public/img/sample 360/**`, database
migrations, test output, local tooling, temporary files, and unrelated
workspace material. The ignored local panorama directory must not be uploadable
or CDN-addressable and must return `404` in Vercel-style static-boundary tests.

Define only the static/service-worker headers needed at Vercel's CDN boundary;
do not duplicate, replace, or weaken Express's nonce-based CSP for dynamic
responses. Produce and review a console-only manifest with paths, counts, and
sizes from the eventual clean immutable Git snapshot. Claude must not stage,
commit, link a Vercel project, create `.vercel` project metadata, or deploy.
Clean snapshot creation remains a separate owner-authorized Git action after
the source and package boundary receive Codex GO. Stop for Codex GO.

Accepted R7 closeout. `.vercelignore` is an allowlist starting
at `/*` that re-includes only `server.js`, the two package manifests,
`vercel.json`, and the ten runtime directories with their descendants, then
denies `public/img/sample 360/` and `public/img/sample 360/**` after the
`public` re-inclusion. At R7 closeout the enumerated package was 154 files and
6,166,956 bytes
with aggregate SHA-256
`c7c16ed73de4b34e1989e6e6842ab897b1164477fb39ddc5862ed1901638b9ec`; every
`.env*`, documentation/handoff, script, database/migration, screenshot,
evidence, Docker, local-tool, temporary, `node_modules`, and Git path is
excluded. `vercel.json` carries exactly `$schema` and `headers` with seven
narrow static/PWA rules and one fixed static-only CSP confined to
`/offline.html`; Express's per-response nonce CSP is untouched and remains the
sole CSP authority for dynamic responses. `server.js` still exports the app and
listens only as the main module; no `api/` duplicate or `.vercel` metadata
exists. `scripts/vercelPackageBoundary-probe.js` is standalone, read-only,
database-free, session-free, and network-free; it pins the expected contract in
probe code outside both configuration files, emits a console-only preview
labelled `CURRENT DIRTY-WORKTREE BOUNDARY PREVIEW — NOT AN IMMUTABLE DEPLOYMENT
MANIFEST`, and proves the static boundary from a temporary root on dedicated
port `3385`. The in-suite `vercel-package-boundary` gate drives the same
analyzers with independent negative fixtures. `package.json` and
`package-lock.json` are unchanged. The preview describes the intentionally
dirty worktree and is not accepted upload evidence.

Post-review corrections (current candidate). The independent Codex R7 review
found a literal `0x00` byte in `scripts/vercelPackageBoundary-probe.js` (former
line 564, offset 25235) that made the file read as binary; it was replaced
byte-surgically with the textual `\0` with the package preview unchanged, and a
frozen audited-source set plus a fail-closed `containsLiteralNulByte()` guard
it. The re-review then found that the in-suite gate trusted the probe's exported
`R7_AUDITABLE_SOURCE_FILES` wholesale, so swapping `scripts/quality-gates.js`
for another NUL-free file such as `package.json` still passed; the gate now pins
the list independently in `EXPECTED_R7_AUDITABLE_SOURCE_FILES` and requires exact
ordered equality with the export. Accepted R7 Codex GO evidence is focused
`71/71`, in-suite `70/70`, full suite `3495/3495` with `QUALITY-GATES OK`, and
`npm audit --omit=dev` at zero vulnerabilities. The literal-NUL remediation
(`71/71`/`69`/`3494`) and the initial candidate (`70/70`/`67`/`3492`) are
historical/superseded.

### M12.P1-D: Authenticated-App Pilot Defect Remediation

**Status: D1-D5 AND EXPANDED D7 COMPLETE — CODEX GO; THE LATER R8 LIFECYCLE
COMPLETED AND TECHNICAL PRODUCTION BASELINE `fea3b2e` IS ACCEPTED.**

These defects were reported during owner testing of the authenticated app.
Claude receives exactly one D-section per prompt, reproduces the behavior before
editing, preserves the dirty worktree, and stops for independent Codex review.
Interactive findings require Playwright MCP evidence; HTTP probes alone cannot
establish UI GO. If the required browser surface is unavailable, report the
visual case as tool-blocked and do not claim it passed. Use the self-terminating
server harness for runtime probes and never launch a foreground server.

Every D-section preserves roles, CSRF, CSP, session behavior, Supabase/MySQL
switches, PWA privacy, Cloudinary delivery, route truth, schedule visibility,
and the BE.6 selected-demo freeze. Do not deploy, apply SQL, create migration
`0020`, access Cloudinary APIs, disclose regression credentials, or mutate Git
state. The execution order intentionally skips D6 until after the participant
pilot: D1 through D5, R3, R4, R5, R6, R7, the expanded D7 regression gate,
R8, a separately owner-authorized pilot, OFF.2, OFF.3, OFF.4, OFF.5, D6, then
OFF.6.

**M12.P1-D1: Logout and Session-Termination Repair**

**Status: COMPLETE — CODEX GO**

Reproduce the sample-student sequence dashboard → map → logout → landing page
→ Start Tour and capture the logout status and token lifecycle without printing
the CSRF value. Add an authenticated, same-origin, no-store
`GET /auth/csrf-token` endpoint that returns the current token under the normal
sanitized JSON convention. The shared logout client obtains a fresh token
immediately before POST. If that POST receives a CSRF rejection, refresh and
retry exactly once; never loop. A failed logout must display an error and leave
the signed-in state truthful instead of redirecting as if the session ended.

Preserve POST-only logout, CSRF verification, session destruction, cookie
clearing, and the existing `logged_out=1` PWA cleanup. Verify student,
instructor, and guest logout, browser Back, reload, and direct `/dashboard` and
`/map` revisits. GO requires no normal-flow `403`, an invalidated session/cookie,
and Start Tour returning to authentication rather than restoring a dashboard.

**M12.P1-D2: Shared Mobile Navigation and Brand Repair**

**Status: COMPLETE — CODEX GO**

Move hamburger behavior into one shared authenticated-navigation client used by
all applicable pages, including guided and Free Roam VR. Remove duplicate
page-local handlers so a tap cannot double-toggle. Maintain `aria-expanded` and
`aria-controls`; support pointer/touch, keyboard activation, Escape, outside
click, navigation selection, and responsive resize. Preserve visible focus and
at least a 44-by-44-pixel mobile target.

Correct every user-visible `CampusSphere` occurrence to `CampuSphere`. Do not
rename internal compatibility globals, persisted identifiers, or historical
migration text that is not rendered. Verify the VR mobile menu can open, close,
and leave the viewer, and run desktop/mobile shared-navigation regressions.

**M12.P1-D3: Guided-VR Arrival Exploration Repair**

**Status: COMPLETE — CODEX GO**

Reproduce Main Gate → CAS through the truthful final arrival scene and activate
each visible scene hotspot. Determine why the existing server-derived
`nav_url` passes focused probes but fails in the reported Pannellum interaction.
Use one shared client hotspot-navigation helper for guided and Free Roam views:
guided hotspots consume only their exact server-derived `nav_url`; Free Roam
uses a validated target scene key; all navigation remains same-origin under
`/vr/`; and final arrival must not disable valid interior exploration links.

Keep the accessible server-rendered hotspot link as a working fallback. Preserve
arrival only at the verified destination scene and preserve truthful
partial-coverage notices. GO requires pointer, touch, and keyboard navigation
from CAS arrival into its approved interior scenes and onward between valid
panoramas, with unresolved or arbitrary targets failing closed.

**M12.P1-D4: Admin Campus-Map Search and Filter Repair**

**Status: COMPLETE — CODEX GO**

Reproduce the Room Schedule and Routes/Nodes/Edges filter failures before
editing. Add bounded server-backed Room Schedule text search across title,
building, room/facility label, floor, and description. The schedule-list API
accepts an optional trimmed, length-limited `q`; both repositories implement
parameterized or correctly escaped matching. Return additive `appliedFilters`
metadata so the effective default date window is visible.

Provide Search, Apply, Clear, result-count, loading, empty, and inline-error
states, and prevent an older request from overwriting a newer filter result.
Repair the existing Route, Node, and Edge search controls instead of duplicating
them. Add accessible search inputs above the Add Schedule building select and
the Add Edge From-node and To-node selects. Preserve the selected option during
filtering and keep keyboard-usable native selects with live result counts. GO
requires equivalent bounded behavior in MySQL and Supabase modes.

The D4 corrective pass adds a race-safe listener for
`campusphere:buildings-changed`, refreshes the schedule building sources while
preserving valid selections, and reruns the active schedule query so renamed or
removed buildings cannot leave results stale. Supabase wildcard search remains
bounded and fails closed with one fixed sanitized `422` response when exact
exhaustion cannot be proven; no partial result or count may escape.

The temporary one-way probe edge and the interrupted geometry probe's
`main-gate.display_order` drift were subsequently restored through separately
authorized authenticated admin API operations. The edge was removed only after
its natural-key/scalar signature was reverified, and `display_order` was
restored from `101` to the frozen value `1`; the freeze manifest was not changed
to accept the temporary value.

The complete regate passed topology `105/105`, route geometry API `44/44`, admin
route geometry `112/112`, focused D4 `313/313`, schedule repository `86/86`,
admin schedule CRUD `96/96`, BE.6 `46/46`, and the full suite `2395/2395` with
`QUALITY-GATES OK`. Both backends match the frozen topology, building/route
fingerprint, and aggregate manifest fingerprint. **D4 is complete and Codex
GO.**

Non-blocking D4 observations remain recorded for later review: list and count
may each perform the bounded Supabase wildcard scan; the building-change event
may cause two building-list reads because separate admin components listen for
it; and literal `*` behavior differs between MySQL and Supabase while the
Supabase path fails closed. These observations do not authorize cleanup or
broaden the current gate.

**M12.P1-D5: Friendly Building Additional-Details Editor**

**Status: COMPLETE — CODEX GO.**

Replace raw JSON entry in add/edit Building with structured fields for walking
time, entrances, landmarks, floors, rooms within each floor, room name/use, and
informational items with optional locations. Provide labelled repeatable
Add/Remove controls, keyboard operation, mobile layout, and inline validation.

Keep the existing `details` API and storage contract; no schema or migration is
introduced. Parse supported existing details on edit and preserve unknown valid
top-level keys or unsupported legacy shapes during the round trip. Malformed
existing data must produce an actionable error rather than be discarded or
overwritten. Public building-detail output remains unchanged. Verify create,
edit, validation, unknown-key preservation, and no-data behavior in both
backends.

The final implementation replaces the raw JSON textarea with a structured
editor and preserves supported, unknown, and legacy details without changing
the backend contract. It fails closed when the helper is missing, construction
fails, the returned interface is incomplete, or an editor method throws: Save
is disabled, one fixed sanitized error is shown, the modal stays open, and no
building mutation request is issued. The Building dialog contains Tab and
Shift+Tab focus, preserves Escape and focus return, and uses at least 12px for
the previously undersized helper/preserved text. The focused probe terminates
its authenticated sessions and proves the former cookie is rejected.

Codex independently reviewed the final corrective code and verified the
documentation predicate repair, `focusFirstError()` fail-closed path, and zero-
network negative cases. The finished focused D5 probe passed `153/153`; the
full suite passed `2558/2558` with `QUALITY-GATES OK`; BE.6 passed `46/46`; and
the credential/session-safety probe passed `24/24`. A standalone Playwright MCP
run using only the deterministic local-MySQL regression administrator verified
desktop and mobile focus containment, forward/reverse wrapping, Escape/focus
return, missing-helper, constructor-throw, and `focusFirstError()`-throw paths,
normal-editor recovery, logout `200`, and direct-revisit isolation. All three
failure cases kept Save disabled, displayed the fixed message, retained the
modal, issued zero building mutations, and exposed no raw exception. No D5
fixture, server, browser, session, or current-run Playwright artifact remained.

**M12.P1-D7: Cross-Role Admin-to-Participant End-to-End Regression Gate**

**Status: COMPLETE — CODEX GO.**

D7 ran the complete browser-driven lifecycle in both MySQL and Supabase runtime
modes using protected regression credentials. It did not hardcode, print,
serialize, or expose credentials, cookies, tokens, session identifiers, database
host/key values, raw rows, or complete geometry. This was a pilot-data-chain
regression gate plus an all-reachable-page role smoke, not authorization to
exercise every unrelated admin CRUD surface.

For each backend, the regression administrator used supported application
interfaces to create a uniquely prefixed temporary building with structured
additional details, one building-linked route node, a forward/reverse route-edge
pair with valid owner-approved path geometry, and one public `audience=all`
room/facility schedule attached to that building. Backend-local numeric IDs were
resolved from canonical building names and route-node keys rather than reused
across backends. No permanent campus data, VR arrival claim for the temporary
building, SQL, migration, or Cloudinary API action was added.

Student, guest, and instructor regression identities verified login and
role-profile hydration; the temporary building's visibility on buildings and
map surfaces; search and destination routing through the temporary node and
stored geometry; truthful schedule visibility; truthful guided-VR unavailability
for the unmapped temporary destination; absence of cross-role profile leakage;
and correct HTML/JSON denial for `/admin` and `/admin/api/*`. The accepted
fresh-context rerun used separate Playwright `BrowserContext` objects per role
and proved no cookie/localStorage/sessionStorage/IndexedDB/CacheStorage
carryover. Reachable authenticated pages were smoked for each participant role,
including dashboard, events, about, guided CAS, Free Roam, shared mobile
navigation, and logout isolation.

Cleanup completed through supported authenticated application interfaces and in
reverse dependency order: schedule, both route edges, route node, then building,
followed by logout/session termination. Each fixture's unique natural-key
signature was reverified before deletion. No frozen selected-demo building or
route/VR/schedule data was deleted or rewritten, and no direct table deletion
was used.

Accepted D7 evidence is `npm test` `3511/3511` with `QUALITY-GATES OK`,
`npm audit --omit=dev` zero vulnerabilities, and postconditions
credential/session safety `24/24`, canonical residue `18/18`, and BE.6
`46/46` with fingerprint
`a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d`
unchanged. Both backends were restored to 13 buildings, topology
`20/48/24/48/24/13`, and VR totals `85/66`, with zero D7 fixture residue.
A later logout-output hygiene remediation is independently Codex-accepted as
additive evidence (`3529/3529`, `QUALITY-GATES OK`, zero escaped logout-error
lines, audit zero, and `24/24 -> 18/18 -> 46/46`) and does not supersede D7.
D7 GO was a prerequisite to the completed R8 lifecycle. Do not begin D6,
pilot, offline work, or another deployment/promotion without separate owner
authorization.

**M12.P1-D6: Real Admin Dashboard Analytics**

**Status: COMPLETE — CODEX GO.**

The owner-accepted pilot review is complete. Until D6 GO, hard-coded admin
chart values are known
non-authoritative placeholders and must not be presented as pilot evidence,
usage analytics, or decision data. Student and guest roles remain unable to
access the admin dashboard.

After participant testing and OFF.2–OFF.5, remove hard-coded activity and role
chart values. Rename the misleading internal map-view building count to
`totalBuildings`. Show real user and building additions for the latest 12
calendar months and exact student, instructor, admin, and guest role counts,
using consistent Asia/Manila month boundaries in both backends. Use existing
tables only: do not add page-view tracking, fake analytics, SQL, or a migration.

Provide accessible chart labels, exact legend values, a text/table summary,
zero-data and sanitized error states, theme redraw, and responsive resizing.
Never fall back to invented numbers. Verify chart data against independent
repository counts in MySQL and Supabase modes. D6 remains a separate prompt and
Codex gate even though it shares the post-pilot tranche with OFF.2–OFF.6.

**M12.P1-R8: Integrated Remediation Re-review**

<!-- M12.P1-R8 HISTORICAL EXECUTION RECORD START -->
**HISTORICAL/SUPERSEDED 2026-07-30 gate snapshot; not current authority.**
The separately owner-authorized restoration returned credential safety `24/24`,
residue `18/18`, and BE.6 `46/46`. The exact former drift is retained as
past-bounded history in the authoritative status block at the top of this file.
The prior bounded SEC-51 gate/evidence and schedule-audit correction completed
candidate verification, but its independent read-only R8 review found the
remaining analyzer and authority-wording defects now under bounded correction.
The resulting hashes must receive a fresh frozen matrix and another separate
independent read-only R8 review before any staging or commit decision.

**Historical status at that time: NEXT POTENTIAL SECTION — READ-ONLY; NOT
AUTHORIZED BY THAT SYNCHRONIZATION.**

**Historical/superseded clean-snapshot stage.** Under an earlier separate owner
authorization, the then-current R8 finding corrections were committed once on
`main` to create the immutable snapshot used by the first and second independent
reviews described below. That earlier snapshot is not the present correction
candidate and does not establish current Git cleanliness or current acceptance.

**Historical correction candidate at that time.** The 12-file working tree was
unstaged and uncommitted at repository HEAD
`db034e5581e6f409083a43dcb80fb82b473e0127`. It then required a fresh frozen
matrix and another independent read-only R8 review. This record authorized no
staging, commit, push, or deployment.

A first independent read-only R8 review of that clean-snapshot candidate
returned CANDIDATE NO-GO on pilot-readiness grounds. Under a separate owner
authorization, a pilot-readiness correction was then applied on top of it in one
follow-up commit: an anonymous `GET /privacy` notice linked from the anonymous
footer and both authentication surfaces; pilot indexing protection
(`X-Robots-Tag: noindex, nofollow, noarchive` on every response plus
`public/robots.txt`); removal of every dead footer placeholder; the corrected
neutral package-inventory label; the owner-approved facilitator-mediated pilot
model recorded in `docs/deployment.md`; `MANUSCRIPT_TEAMDUTCHESS.pdf` untracked;
and a new fail-closed `pilot-readiness` gate.

The owner pilot decision recorded there is that the pilot is
facilitator-mediated rather than restricted by any participant roster.
Participants register through Google under the existing domain-to-role mapping,
the OAuth client stays in Testing, and CampuSphere requests only `openid`,
`email` and `profile`, which Google's documented basic-identity exception covers.
Indexing control is documented as not being access control.

A second independent read-only R8 re-review of that correction candidate found
further pilot-readiness defects, and a separately owner-authorized re-review
correction was applied in one follow-up commit. The package-boundary probe no
longer claims an intentionally dirty worktree or a current-worktree snapshot;
its header now states that the inventory reflects current repository bytes, does
not itself establish Git cleanliness or immutability, and is not deployment
authorization. The independently pinned gate rejects every stale worktree
wording as well as the superseded label, with positive-neutral and negative
fixtures. `SEC-37` keeps only the accepted R7 values as history beside a freshly
recomputed current inventory. The privacy notice scopes its anonymous-denial
claim to authorization-denial audit events and keeps the separate truthful
method/path request-log disclosure, covered by static, runtime-rendered,
positive, and ambiguity-reintroduction gate cases. The owner-supplied pilot
feedback form was validated anonymously without submitting it and is recorded as
READY without its URL. The local authenticated exposure matrix was executed in
both runtime modes with a separate fresh browser context per role.

These corrections await another independent read-only R8 review. No R8 GO,
Codex GO, deployment GO, or pilot GO is claimed by this work.

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

At that time, `M12.P1` remained NO-GO for deployment and pilot readiness;
deployment was not authorized.
<!-- M12.P1-R8 HISTORICAL EXECUTION RECORD END -->

Read-only Codex GO/NO-GO review. Run syntax and dependency checks, the contract
and security suite, DB/index and Supabase smoke/identity checks, BE.6 freeze,
credential safety, Vercel production-profile, awaited-bootstrap, shared-limit,
audit-write, package-boundary, external-resource, routing/VR/schedule, and PWA
privacy gates. Include logout/session isolation, shared mobile navigation,
guided-arrival exploration, admin campus-map search/filter, structured building
details, and the two-backend admin-to-student/guest/instructor lifecycle and
all-reachable-page evidence from D1–D5 and D7. Review the
exact clean-snapshot candidate and confirm it contains no credentials, local
scratch media, evidence artifacts, unreviewed migration, feedback storage,
stale executable CDN reference, probe residue, listener, or stray process.

`M12.P1-R8` receives readiness GO only when all seven infrastructure blockers
and all pre-pilot D-sections are closed, no new critical or high finding exists,
the full authenticated exposure matrix is green, required owner inputs are
ready, and the dirty development worktree has not been mistaken for the
deployment snapshot. D6 remains an explicitly accepted admin-only post-pilot
deferral and its placeholder values must not be used as pilot evidence. GO
authorizes only a separate owner decision to create the Vercel preview; this
section performs no Git mutation, project linkage, deployment, SQL, or
Cloudinary operation.

### M12.P2: Final Vercel Demo/UAT Closeout

**Status: READY FOR THE INDEPENDENT READ-ONLY MILESTONE 12 CLOSEOUT REVIEW.**

The owner has formally accepted the pilot with zero reported findings. D6 and
OFF.2 through OFF.6 are Codex GO. Final Milestone 12 disposition now requires
the independent read-only closeout review of the exact local candidate. Vercel
remains the demo/UAT target; Docker remains the later full-deployment path.

## Interfaces and Contracts

- Preserve the existing `{ success, message, ...data }` JSON convention.
- Preserve HTTP 400, 401, 403, 404, 409, 429, and sanitized 500 response contracts.
- Preserve existing auth, role, CSRF, rate-limit, CSP nonce, PWA privacy, and session-cookie behavior.
- Browser requests may continue using redirects and EJS error pages where already established.
- Admin schedule mutation endpoints remain admin-only.
- Schedule data is public/user-visible only where intentionally rendered; admin-only metadata and internal implementation details must stay server-side.
- Supabase SQL migrations are applied manually by the project owner.
- MySQL fallback, Supabase runtime switches, Supabase session store, Express sessions, bcrypt local login, Google OAuth, and Cloudinary media support remain preserved.
- Every public map building must have a verified route from Guard House/Main Gate or be clearly non-selectable as a destination.
- Expansion data is identified by stable natural keys; backend-specific numeric IDs must not be copied between MySQL and Supabase.
- After BE.6 GO, the frozen building/routing/demo-VR dataset and its pinned QA counts are authoritative until a separately reviewed correction replaces the freeze evidence.
- The BE.6 manifest remains the authoritative baseline. Both live backends
  currently match it after the separately authorized D4 restoration and green
  replacement verification; temporary probe values never redefine the freeze.
- Guided VR reports arrival only when the final mapped scene belongs to the selected destination; partial or missing coverage remains explicit.
- Offline caching is bounded, versioned, public, read-only, and privacy-safe. Authenticated HTML, admin/private responses, sessions, cookies, credentials, and mutations remain network-only and uncached.
- The limited Vercel pilot exposes the current authenticated application; its
  routing focus is a facilitated test scope, not a route-level access-control
  boundary. Existing role authorization remains authoritative.
- Supabase regression automation uses only the test-only
  `SUPABASE_REGRESSION_ADMIN_EMAIL` / `SUPABASE_REGRESSION_ADMIN_PASSWORD`,
  `SUPABASE_REGRESSION_STUDENT_EMAIL` / `SUPABASE_REGRESSION_STUDENT_PASSWORD`,
  `SUPABASE_REGRESSION_INSTRUCTOR_EMAIL` /
  `SUPABASE_REGRESSION_INSTRUCTOR_PASSWORD`, and
  `SUPABASE_REGRESSION_GUEST_EMAIL` / `SUPABASE_REGRESSION_GUEST_PASSWORD`
  interface. Values remain only in the ignored local `.env`, are consumed from
  the inherited environment by authorized probes, and are never Vercel runtime
  variables, application responses, browser globals, documentation values,
  logs, screenshots, chat content, or committed files. Missing Supabase regression
  values fail closed; local MySQL fixtures remain local-only.
- On Vercel, production configuration is fail-closed and Supabase-only. The
  server-only Upstash interface uses `UPSTASH_REDIS_REST_URL`,
  `UPSTASH_REDIS_REST_TOKEN`, and `RATE_LIMIT_KEY_SECRET`; no value is exposed
  to EJS, `public/`, browser globals, responses, logs, screenshots, or commits.
- Preserve existing `429` contracts. A fixed sanitized `503` is allowed only
  when mandatory Vercel readiness or shared rate-limit infrastructure is
  unavailable; no partial/fallback application response may be served.
- Routine anonymous protected-route denials are not persisted. Authentication
  failures and authenticated role denials remain sanitized audit events.
- Browser executable dependencies are same-origin and version-pinned; static
  CDN packaging is controlled by a reviewed allowlist and clean snapshot.
- `GET /auth/csrf-token` is authenticated, same-origin, JSON-only, and
  `Cache-Control: no-store, private`; it never logs or serializes a token outside
  the response to the current authenticated browser.
- The admin schedule-list API may add an optional bounded `q` and additive
  `appliedFilters` metadata while preserving existing fields and status codes.
- Building `details` keeps its existing object/storage contract. The friendly
  editor is a UI composition layer, not a schema change.
- The friendly details editor is mandatory for Building add/edit submission.
  A missing helper or failed initialization disables Save, displays a fixed
  sanitized error, and performs no request; it must never fall back to
  `details: null` or silently discard existing data.
- The Building `aria-modal` dialog contains keyboard focus while open, restores
  focus when closed, and keeps readable labels, inline errors, and mobile touch
  targets. D5 probes terminate their authenticated sessions in `finally`.
- Admin dashboard analytics remain an internal controller/repository interface;
  D6 adds no public analytics endpoint or persistent page-view tracking.

## Anti-Scope

Do not implement or reintroduce:

- Fake student enrollment records or enrollment status.
- Fake instructor assigned-room widgets.
- Fake instructor teaching schedules.
- Fake instructor all-room dashboard features.
- SIS integration, automatic class assignment, attendance, grading, or enrollment workflows.
- Anonymous public browsing beyond the existing authenticated guest-role policy.
- Broad dashboard redesigns, map rewrites, Cloudinary upload automation,
  unreviewed Vercel deployment, Docker finalization, or unrelated refactors.
- Fake or guessed building names, coordinates, entrances, routes, road geometry, panoramas, schedules, or destination coverage.
- Google Maps, Google Earth, Strava, or any third-party runtime routing engine or copied restricted-provider geometry.
- Caching every campus panorama, mirroring the complete OpenStreetMap tile service, or caching private/authenticated/admin data for offline use.
- Treating the limited pilot as final Milestone 12 GO, claiming offline support
  before OFF.6, or deploying before `M12.P1-R8` readiness GO and separate owner
  authorization.
- Combining multiple `M12.P1-R*` sections in one Claude prompt, beginning a
  later section without Codex GO, or broadening a focused fix because files
  overlap.
- Combining multiple `M12.P1-D*` sections, combining D6 with an OFF section, or
  beginning D6 before the student/guest pilot and OFF.2–OFF.5 are complete.
- Using a grounding-only prompt to run fixture-writing probes, clear current
  sessions, begin any unstarted section, re-execute a completed section, or
  claim a new GO decision. Only the current explicit owner execution prompt
  authorizes work; an archived or spent prompt reproduced under a historical
  heading in either handoff authorizes nothing.
- Presenting the current hard-coded admin dashboard charts as real usage,
  participant, routing, or pilot evidence before D6 GO; adding fake analytics or
  a page-view persistence design as part of D6.
- Allowing Claude or Codex to rotate/delete live accounts, change or disclose
  pilot/regression credential values, copy those values into source,
  documentation, prompts, logs, screenshots, chat, or test output, apply SQL,
  create migration `0020`, clear live session rows directly, access Cloudinary
  APIs, link Vercel, deploy, or mutate Git state without the separately required
  owner authorization. Authorized R1 probes may consume the test-only values
  from the inherited local environment solely for non-printing in-memory
  comparisons.
- Raw IP/email identifiers in shared rate-limit storage, process-local fallback
  on Vercel, persistent routine-anonymous denial rows, external executable CDN
  dependencies, or deployment of scratch/evidence files.

## Assumptions

- Milestone 9 is complete and Codex GO.
- Milestone 10 is complete and Codex GO.
- Milestone 11 Room Scheduling, including Sections 11.8A-11.8D and the final 11.8 review, is complete and Codex GO.
- Supabase migrations are exactly `0001` through `0019`; `0014` through `0019` are owner-applied and verified, and no `0020` exists.
- RF.1 through RF.6 are complete and Codex GO. The current expanded BE.6 candidate freezes MySQL at 34 buildings / 44 route nodes / 100 directed edges / 50 reverse pairs / 100 valid geometries and Supabase at 25 / 26 / 50 / 25 / 50. The 13-building `models/data.js` roster remains the reproducible seed baseline, not the complete live catalog. The prior 20/48/24/48 and 21/50/25/50 baselines and the D4 replacement verification remain accepted historical evidence, not current candidate counts.
- BE.1 through BE.6 and OFF.1 are complete and Codex GO. The current Guided-VR remediation candidate covers 25 active destinations, 472 configured steps, and 99 unique scene keys; the older CAS-only/CCS-only policy is historical and does not describe current runtime truth.
- The `M12.P1` read-only readiness audit is complete with Codex NO-GO after one
  critical and six high findings. R1-R7, D1-D5, and expanded D7 are complete and
  Codex GO, including the R3 follow-ups, R4 follow-up, dependency-security
  remediation, both R5 follow-ups, R6, R7, both R7 source-auditability
  corrections, and the expanded D7 cross-role regression gate.
  The final R8 lifecycle completed and technical Production baseline
  `fea3b2e11c6331eddc1ee091b165427d8e0218d7` is accepted. Future `main`
  deployments require manual promotion and a separate owner decision.
  The owner accepts the 2026-08-05 human pilot with zero reported findings;
  external participant/Form evidence remains outside Git, and its full source-
  commit identity was not independently verified. Pilot review is complete.
  The owner-authorized local OFF.2-OFF.5 implementation candidate has focused
  evidence but no Codex GO. D6, OFF.6 browser acceptance, and final Milestone 12
  GO remain open.
- The owner reports that the primary administrator, demo instructor, sample
  student, and sample guest are retained as local-login regression identities;
  the previously deleted student and guest were recreated, so their numeric IDs
  may differ. All four replacement passwords are reported synchronized to the
  private ignored `.env`. The R1 acceptance run historically passed `24/24`,
  including canonical role/profile checks, in-memory replacement/default
  comparisons, and zero unexpired persisted sessions after logout;
  `M12.P1-R1` repository work remains Codex GO. The latest read-only rerun passed
  `24/24`, including zero unexpired persisted sessions for all four canonical
  identities. Direct session-row deletion remains unauthorized by this plan.
- `admin2` and `admin3` are retained as separately assigned administrator
  accounts for two trusted collaborators performing owner-authorized data-entry
  work. Their email addresses, numeric IDs, and credentials are not regression
  fixtures and are not recorded in this plan. No building, route, VR, schedule,
  content, or audit-history data is removed by the credential-containment work.
- Routine logged-out protected-route requests will not create database audit
  rows. Meaningful login failures and authenticated role violations remain
  audited.
- Pilot browser libraries will be self-hosted at the exact reviewed versions,
  not executed from third-party CDNs.
- D6 is intentionally the lowest-priority implementation. It runs only after
  student/guest pilot review and OFF.2–OFF.5, then must receive Codex GO before
  OFF.6 and final Milestone 12 signoff. The existing admin-only placeholder
  charts are excluded from pilot evidence until then.
- Real schedule data is admin-managed and stored in the configured runtime data source.
- Supabase is the production target; MySQL remains local/fallback.
- Room/facility schedule work should be additive and should preserve current app behavior when no schedule rows exist.
- All 25 configured Guided-VR destinations are active. Any future catalog,
  route, endpoint, link, or media change requires refreshed freeze and
  verification evidence; Cloudinary uploads remain owner-controlled.
- Future Supabase migrations after owner-applied `0019` must use the next sequential number, remain unapplied until Codex review, and be applied only by the project owner.
- The road-following routing repair, BE.5 parity/regression, BE.6 freeze, and
  OFF.1 privacy/domain audit are complete and Codex GO. The owner-attested pilot
  is accepted, but the remaining OFF.2–OFF.6 offline package is still required
  before final M12 signoff.
- Vercel demo support remains Milestone 12; Docker full deployment finalization remains Milestone 13.
