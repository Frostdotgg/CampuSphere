# CampuSphere New Session Grounding Prompts

Last updated: 2026-07-30 (Asia/Manila)

These are context-only grounding prompts. They authorize repository reads and
read-only Git inspection only. They do not authorize probes, servers, browsers,
live database access, cleanup, implementation, Git mutation, or deployment.

## Codex Grounding Prompt

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

## Claude Code Grounding Prompt

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
