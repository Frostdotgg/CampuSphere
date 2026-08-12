# CampuSphere New Session Grounding Prompts

Last updated: 2026-08-12 (Asia/Manila)

The first two sections are the only current copy-paste prompts. Both authorize
grounding only and then wait for the owner. Neither prompt authorizes review,
implementation, Git mutation, a new deployment or promotion, pilot work,
offline work, or the next product workstream. Earlier prompts remain below
under historical headings and must not be used as current authority.

## Codex Grounding Prompt

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
9. scripts/quality-gates.js, services/auditService.js, server.js,
   public/css/styles.css, and public/js/profile-script.js
10. services/routeAvailability.js, config/mapRuntime.js, the building/route/VR/
    schedule repositories, and supported admin controllers/routes
11. the credential-safety, residue, and BE.6 probes plus focused topology,
    geometry, map-to-VR, guided-VR, Free-Roam, and building probes named in
    plan.md, source-read only
12. every database/supabase migration filename and read-only Git truth: branch,
    HEAD, origin/main, status, staged/unstaged/untracked paths, stashes, safety
    refs, and recent graph

Reconcile these current recorded facts against live repository truth, which
wins:
- Accepted history remains M8-M11, RF.1-RF.6, BE.1-BE.6, OFF.1, M12.P1 R1-R7,
  D1-D5, and expanded D7. OFF.2-OFF.6 are deferred, not cancelled.
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
  external review report. Human pilot/Form responses,
  OFF.2-OFF.6, and final Milestone 12 GO
  remain open.
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
as cleanup, invent migration 0020, or infer that pilot, offline, or deployment
work is next.

M12.P1 remains NO-GO for pilot readiness and final acceptance. Human pilot/Form
responses, OFF.2-OFF.6, offline work, and final Milestone 12 GO remain open.
This context-only prompt authorizes none of implementation, review, testing,
Git mutation, a new deployment or promotion, pilot activity, offline work, or
Milestone 12 actions. Deployment is not authorized by this prompt.

Return only a grounding report: capabilities/files inspected, exact live Git
truth versus recorded/owner-observed claims, evidence classes, inconsistencies,
the next owner-authorization boundary, and confirmation that nothing changed
repository, process, database, vendor, OAuth, Cloudinary, Upstash, or deployment
state. Stop and wait for the owner.
```

## Claude Code Grounding Prompt

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
scripts/vercelPackageBoundary-probe.js; scripts/quality-gates.js;
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
replacing the live alias. Historical/superseded: Production previously served
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

Determine mutable Git truth live. Do not review, edit, test, implement, stage,
commit, push, deploy, promote, or perform an R8 review. M12.P1 remains NO-GO for
pilot readiness and final acceptance. Human pilot/Form responses, OFF.2-OFF.6,
offline work, and final Milestone 12 GO remain open. After the grounding report,
stop and wait for the owner; do not infer that offline mode, deployment, or
pilot work is automatically next. Deployment is not authorized by this prompt.
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
10. scripts/quality-gates.js, including the current uncommitted SEC-51
    analyzers and rejecting fixtures; do not edit or execute it
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
10. scripts/quality-gates.js, including the current uncommitted SEC-51
    analyzers and rejecting fixtures; do not edit or execute it
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
