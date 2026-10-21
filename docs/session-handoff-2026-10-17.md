# CampuSphere Session Handoff - 2026-10-17

> Historical checkpoint, superseded by `docs/session-handoff-2026-10-21.md`.
> Its dates, permissions, tests and candidate statements describe that earlier session.


> Historical October 17 checkpoint, superseded by `docs/session-handoff-2026-10-19.md`
> and `docs/current-authority.md`. Its permissions and source/deployment claims
> describe that earlier task only. Preserve this record; do not resume its tasks.

Last updated: 2026-10-17 (Asia/Manila)

## Purpose and authorization

The owner is moving to new Claude Code and Codex sessions because panelists
want additional features. The actual feature list, priority and acceptance
conditions have not been supplied here. Do not invent those requests from old
questions about map expansion, scripts or diagrams. The owner approved the
review-and-finalize plan for the existing authority drafts. This transition
authorizes authority documentation, copy-ready grounding prompts and bounded
static documentation checks, not product changes, commit/push or external access.
`docs/current-authority.md` is canonical. Use the current owner prompt in
`docs/new-session-grounding-prompts.md`, not any historical or teammate prompt.

## Git checkpoint and later source history

At the earlier pre-draft source checkpoint, main, HEAD, origin/main and remote
main all matched 87980c5fe03c68b8f59f0b8fbdc263299c2acbce; ahead/behind was
0/0, the worktree/index were clean and there were zero stashes. This is a
source baseline, not the state at the start of this approved finalization.

The approved finalization started with 15 modified tracked files and one
untracked handoff draft, an empty index and zero stashes. Local HEAD,
origin/main and read-only remote main were rechecked and still matched
87980c5fe03c68b8f59f0b8fbdc263299c2acbce, ahead/behind 0/0. The earlier
assistant drafts were review inputs, not an accepted checkpoint. The owner
then approved reviewing and finalizing them. Do not treat earlier draft checks
as fresh finalization results. No commit or push is included in this task.
New sessions must preserve pending edits and report actual Git state instead
of treating the clean pre-draft checkpoint as the current worktree state.

Source history since the older September 22 authority:

| Commit | Source change | What it does not establish |
| --- | --- | --- |
| b502c80 | Align Staff House Vehicle-exit assertions in the Guided-VR probes | A replacement full-suite pass |
| a3a0bfa | Add building/node map coordinate pickers, browser helper/UI and static probe | Every UI path tested or deployed |
| e275abe | Refresh branding/PWA assets; add missing-Guided-VR MySQL repair tooling; refresh selected-demo baseline dated September 24 | Fresh database parity or proof the repair was applied |
| f695585 | Add explicit preview/backup/confirmation safeguards for strict MySQL parity pruning | Permission to run a destructive apply or even a live preview |
| 87980c5 | Remove persistent building-name labels from online/offline map pins and update route-start cue/cache generation | Owner approval to restore labels or live Production byte equality |

Current source cache generation is v50. Source-only catalog counts were
recomputed from the pure `config/guidedVrRoutes.js`: Vehicle entry 25/486/101,
Vehicle exit 25/545/105, Walking 25/690/133 (destinations/steps/unique scenes).
`config/selectedDemoFreeze.js` records 25 buildings, 26 route nodes, 50 directed
edges, 670 VR scenes and 1,465 hotspots for each backend, with matching
natural-key fingerprints. Its comment records a September 24 parity baseline.
That source record is not a live query or a fresh verification of either DB.
Backend-local numeric IDs must never be copied or equated across backends.
The freeze migration fingerprint subset is not the full migration inventory;
numbered migration sources actually continue through 0027.

## Source map for the next focused task

Read only the minimum relevant source after the authority documents:

- Runtime/config: `package.json`, `server.js`, `.vercelignore`, `.gitattributes`,
  Dockerfile/Compose files only if the owner later selects container work.
- Security/auth: `middleware/roleAuth.js`, `middleware/securityHeaders.js`,
  `middleware/rateLimit.js`, `config/sessionConfig.js`, auth controllers,
  `services/sessionReadiness.js`, `services/supabaseSessionStore.js`,
  `middleware/errorHandler.js`, `services/rateLimitStore.js`.
- Building/node editing: `views/admin/campus-map.ejs`,
  `public/js/admin/admin-campus-map.js`, `public/js/admin/admin-buildings.js`,
  `public/js/admin/admin-map-graph.js`, relevant controllers/repositories,
  `scripts/adminCoordinatePicker-probe.js` (read, do not execute in grounding).
- Routing/map: `views/map.ejs`, `utils/pathfinding.js`,
  `utils/routeGeometry.js`, `controllers/adminRouteController.js`,
  `repositories/routeRepository.js`, `services/routeAvailability.js`.
- VR/freeze: `config/guidedVrRoutes.js`, `config/selectedDemoFreeze.js`,
  `controllers/vrController.js`, `services/guidedVrResolution.js`, VR views and
  the source of `scripts/guidedCasVr-probe.js`/`guidedVrResolution-probe.js`.
- Offline/map release: `services/offlineGuideService.js`,
  `services/offlineMapReleaseService.js`, `public/js/offline-guide-manager.js`,
  `public/offline.html`, `public/sw.js`, `public/maps/manifest.json`,
  `.github/workflows/offline-map-refresh.yml`,
  `scripts/publishOfflineMapRelease.js`, `docs/offline-map-refresh.md`.
  Changing only EXPECTED_BOUNDS cannot itself publish larger map tiles or
  replace an existing downloaded guide. Inspect the whole pipeline only if
  map expansion becomes the owner's selected request; none is authorized here.
- Announcements: `services/notificationFeedService.js`,
  `controllers/notificationController.js`, `public/js/notification-panel.js`,
  `views/partials/dash-navbar.ejs`, content controllers/repositories.
  The authenticated bell shows audience-filtered published announcements and
  upcoming events. It loads on initialization/open; there is no claim of a
  real-time phone push service. Category is topic; audience controls recipients.
- Dangerous parity tools: inspect source only as needed:
  `scripts/syncCampusVrSupabaseToMysql.js` and
  `scripts/repairMissingGuidedVrMysql.js`. A dry-run still connects to live
  systems. No old repair permission carries into a new thread.
- Schema boundaries: `database/schema.sql`,
  `database/supabase/README.md`, `database/supabase/REPOSITORY_BOUNDARIES.md`, and relevant
  numbered migrations. Do not seed, migrate, backfill, prune or repair from
  a grounding prompt.

## Completed local cleanup and academic materials

The owner chose to keep generated documents locally, not in Git. The completed
cleanup added only /output/ to this checkout's .git/info/exclude, preserving
the shared ignore rules. The output directory contained 17 files: twelve
finished/backup Word/PDF files and five Word temporary/lock files. Before/after
hash checks confirmed that all 17 files, the two line-ending-only source files,
and shared Git/deployment rules were byte-for-byte unchanged. Scoped Git
re-normalization cleared the two false-positive modified markers; it left no
staged changes. No deletion, move, commit, push, application test or deployment
occurred. Do not run git clean (especially -x), discard, stash or recreate files
merely to remove editor markers. The local exclusion is reversible by removing
that one rule; it is not present automatically in another clone.

Local authoring context from this thread (not product acceptance evidence):

- Main current manuscript source used for the reviewer is
  `CampuSphere-Chapter-4-CAPA-Submission (1).docx`; the owner had referred to
  the corresponding CAPA filename without the copy suffix. At this transition
  check the suffixed file exists, while the unsuffixed CAPA filename and the
  older `Chapter-4.pdf` are absent from the checkout root. Confirm availability
  and revision before future paper work. The older PDF and v7 deck are
  predecessor sources, not automatic authority over CAPA/v10.
- The current deck used here is
  `CampuSphere-Pre-Oral-Defense-Presentation-v10-Chapter-4-Aligned.pptx`
  (not .ppt). It has 26 slides and a schedule ending at 26:05. The original
  speaking source is `my script.docx`.
- Generated local-only pairs in output/docx and output/pdf include
  `CampuSphere_Chapter_4_SO2_SO4_Reviewer`,
  `CampuSphere_Chapter_4_CAPA_Reviewer`, `CampuSphere_Complete_Defense_Notes`,
  `CampuSphere_Pre_Oral_Defense_Script_v7`, and
  `CampuSphere_Defense_Script_v10_Selected_Slides` (each .docx and .pdf).
  A pre-diagram-revision v7 pair remains under output/archive. These files
  are not included by git archive or by a normal clone; never assume another
  machine can access them. Preserve manuscript tables/figures and originals.
- The v10 selected script covers slides 15-19 and 23 only, with timed text
  and detailed rehearsal notes. Earlier creation checks reported 29 inspected
  pages, 30 contents links and matching Word/PDF content; this transition does
  not re-render or recertify them. Presenters/slots are Ocean 15 (14:05-15:05),
  Aaron 16-19 (15:05-19:15), and John 23 (22:50-23:50). The six scripts use
  95/75/75/120/120/95 spoken words, with transitions and pause allowances.
  Slides remain unchanged; there are no live demonstrations in this version.
- Slide 15 shows a module list, not architecture. Slide 16 uses older context
  and DFD images; do not silently redraw, relabel or claim they match current
  CAPA figures. Repeated Portal User/D2 symbols are repeated views of one group/
  logical store. Six DFD processes are not six user-facing modules. D2/D3 guide
  sources are stated in a note, not drawn as direct arrows. Some deployment
  connectors are misaligned; explain labeled boxes without inventing links.
- Slide 17 shows Student/Admin dashboards after sign-in, not login forms or
  independent security proof. Slide 18 shows destination controls (not an
  active selected route), Guided VR toward Supply and Property, and Free Roam.
  Slide 19 shows Admin News/Events and guide downloading, not proof of PWA
  installation or disconnected search. Slide 23 is team-managed hosting, not
  institutional adoption. Fuller Sprint One/Two/Three contribution paragraphs
  and the notification explanation were delivered in chat for copy/paste.
  They were chat-only, not inserted into DOCX. The owner said not to put those
  additions into the saved script; do not claim they were inserted.
- Preserve research evidence distinctions: 472 consented survey records versus
  467 complete SUS records; SUS 65.16/100 (Marginal; OK) is not a percentage;
  five reported technical evaluators are not seven distinct people merely
  because seven form sets exist. A recorded 200-user run is not the later
  300-user plan. Older manuscript performance limits and later retained
  repository load evidence belong to different records; do not silently
  upgrade manuscript claims. Planned capabilities are not measured results.

## Evidence that must remain qualified

The last recorded owner-observed Production identity is deployment
`dpl_HbJRojVKtJUeUr2KMY6XhcRv6RCS` for `0e7fe8b`. Neither its current
status nor promotion of later product commits was checked in this task.
Production promotion remains an owner decision. Current Vercel settings were
not reverified; do not assume a push is harmless or a completed build means
promotion. A separately authorized push needs its own deployment-trigger review.
September load evidence remains bounded: LT-07 owner-browser pass; earlier k6
offline harness failure rejected; LT-08 all 26 thresholds passed but PASS WITH
WARNING because of three session-store retry warnings. The old full-suite
failure is not overwritten by later assertions or matching freeze comments.
There is no new DB parity, full QA, browser acceptance, immutable deployed-byte
proof or CSPC institutional acceptance. Team-managed hosting, Administrator
content editing and user-initiated guide refresh are different responsibilities.

## What the new session must do first

1. Inventory actual tools/MCP/skills without invoking external systems. Read
   applicable skills fully before use. Do not assume a remembered plugin exists.
2. Read the current authority, this note, the agent/handoff/plan documents,
   relevant source and historical evidence in the order given by the prompt.
3. Inspect root/branch/full HEAD/upstream/remote/status/index/stashes read-only.
   If remote lookup is unavailable, say so; do not fetch or invent equality.
4. Report current source behavior, later commits, evidence limits, ignored local
   documents, any pending handoff delta and unresolved discrepancies. Do not
   repair those discrepancies, run tests or issue a GO/NO-GO during grounding.
5. Stop. The owner then supplies the exact panel requests and selects one.
   Confirm roles, screens, data/offline impacts, compatibility and acceptance
   checks before implementing that feature under separate scoped authority.

One writer owns a scope at a time. If both agents will edit, agree explicit
ownership/sequence first; no automatic new threads, messages or worktrees.
Commit/push, tests, browser acceptance, DB changes and Production promotion are
not authorized merely because another agent or an old document mentions them.

## Approved finalization - verification and saved state

The following checks were rerun during the owner-approved finalization on
October 17; they are separate from the earlier draft results below:

- The isolated, network-free documentation gate passed 480 static assertions.
  Its loader disabled server, credential and backend imports; no application
  runtime or database was started. JavaScript syntax checking also passed.
- The code-reviewer skill guided review of the documentation-checker changes.
  Changes were limited to documentation facts, prompt boundaries and their
  regression fixtures. Historical fixtures and runtime/security checks remain
  intact. New rejection cases cover unsupported deployment/parity/test claims,
  inherited permissions, invented panel-feature approval and contradictory
  instructions to implement, test or deploy during grounding. These bounded
  wording checks are not a general natural-language safety guarantee.
- Both current owner prompts validated independently, including their agent
  identity, first-turn-only limits, complete reading routes and stop boundary.
  The Codex prompt body is under "Codex Grounding Prompt"; the Claude body is
  under "Claude Code Grounding Prompt" in
  `docs/new-session-grounding-prompts.md`. Copy only the appropriate text block.
- All eleven operative continuity summaries matched after line-ending
  normalization. All eleven older continuity bodies, eighteen existing
  historical prompt bodies and two newly archived September 22 prompt bodies
  were preserved. All sixty-nine checked source/document references resolved.
- Before/after SHA-256 comparisons preserved all 28 protected local files:
  seventeen output files, five root academic documents, the two cleanup-related
  source files, three shared Git/deployment rule files and the checkout-local
  exclusion file. The root-only /output/ exclusion remains in .git/info/exclude.
- The added-line secret-pattern/encoding scan, exact changed-file scope check
  and Git whitespace check passed. No unexpected changed path was present.

Final saved state: branch main; HEAD and origin/main remain
87980c5fe03c68b8f59f0b8fbdc263299c2acbce. A successful read-only remote lookup
again returned that same main SHA; ahead/behind remains 0/0. The index is empty
and there are zero stashes. Fifteen tracked files remain modified and this
handoff note remains untracked: sixteen intended authority/static-check paths,
not a clean checkout or a committed checkpoint. No stage, commit or push ran.

The handoff is ready for read-only grounding in this same checkout. Source
inspection and these documentation checks do not refresh Production, prove live
DB parity, rerun the application QA suite or establish panel acceptance. No
application behavior, public API, database structure/data/session, manuscript,
figure/table, PowerPoint, generated document or deployment was changed here.
Do not start feature branching until the pending handoff changes are resolved
under separate owner authority. Then obtain the exact panel requests and scope
one feature with agreed behavior and acceptance checks. No feature is approved
by completion of this documentation work.

## Earlier draft validation (historical)

The earlier draft ran the exported source-only docs-current checks in an isolated
loader with runtime/server/credential/backend imports disabled: 435 assertions
passed. JavaScript syntax checking passed for the static gate. All eleven
operative summaries matched exactly after line-ending normalization. All
eleven pre-existing historical continuity bodies, eighteen older historical
prompt bodies, and the two newly archived September 22 prompts were preserved.
Sixty-nine checked source/document references resolved, and both current owner
prompts extracted independently with explicit read-only/wait boundaries.
The added-line privacy/encoding scan and scoped whitespace check passed.
Before/after hash comparisons preserved all seventeen output files and the
two cleanup-related source files plus three shared Git/deployment rule files
(twenty-two files total). Only the fifteen tracked authority/static-check
files and this new transition note changed; the index stayed empty, HEAD and
origin/main stayed at 87980c5, and read-only remote main still matched it.

These are documentation/static-contract checks only, not npm test, npm run qa,
browser acceptance, security certification, DB parity, new load evidence or
deployment verification. Historical test fixtures remain in the gate; they
are not rerun application results. No application implementation, source
manuscript/PowerPoint, generated reviewer/script, data, session, migration,
vendor configuration or deployment was changed by this synchronization.

No commit or push was performed by this task. To use the updated uncommitted
handoff immediately, open the new sessions in this same checkout. A fresh
clone or worktree based on an older committed ref will not automatically
contain these edits or the new transition note. A later commit, push or other
handoff isolation needs explicit owner authorization; remeasure live Git then.
