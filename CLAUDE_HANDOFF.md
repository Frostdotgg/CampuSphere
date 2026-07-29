# CampuSphere Claude Continuity Handoff

Last updated: 2026-07-27 (Asia/Manila)

Repository: `C:\Users\FROST.GG\Desktop\CampuSphere v1`

<!-- M12.P1 CURRENT STATUS START -->
> **CURRENT STATUS (authoritative).** Milestones 8, 9, 10, and 11 are
> complete and Codex GO. RF.1 through RF.6 road-following destination routing
> is complete and Codex GO. BE.1, BE.2, and BE.3 are complete and Codex GO.
> BE.4: Selected Demo VR Dataset Completion and BE.5: Expansion Feature and
> Regression Gate are complete and Codex GO under the owner-authorized
> CAS-only selected-demo scope. BE.6: Dataset Freeze is complete and Codex GO.
> OFF.1: Offline Baseline Audit and Domain Contract is complete and Codex GO.
> OFF.2 through OFF.6 are deferred until limited-pilot review, not cancelled.
> The `M12.P1` readiness audit is complete with Codex NO-GO. R1-R7, D1-D5, and
> expanded D7 are complete and Codex GO. M12.P1-R3 and all session-hygiene/
> ownership/import-detector follow-ups, the R4 follow-up, dependency-security
> remediation, R5, both R5 follow-ups, R6, R7, both R7 source-auditability
> corrections, and expanded D7 are complete and Codex GO. `M12.P1-R7` is
> complete and Codex GO. Accepted R7 closeout evidence is focused `71/71`,
> in-suite
> `vercel-package-boundary` `70/70`, full suite `3495/3495` with
> `QUALITY-GATES OK`, and `npm audit --omit=dev` at zero vulnerabilities. The
> `3492/3492` initial R7 candidate and `3494/3494` literal-NUL remediation
> candidate are historical/superseded. Following the accepted 2026-07-22
> dependency closeout, a subsequent 2026-07-26 npm advisory drift is
> remediated: production pins `ejs@6.0.1`, the
> `jake/filelist/minimatch/brace-expansion` chain is absent, and
> `npm audit --omit=dev` reports zero vulnerabilities. `M12.P1-D7` is complete
> and Codex GO. Accepted D7 evidence is the fresh-context role-isolation rerun:
> separate Playwright `BrowserContext` objects with no cookie/localStorage/
> sessionStorage/IndexedDB/CacheStorage carryover; both MySQL and Supabase
> legs completed through supported application interfaces; cleanup returned both
> backends to the frozen `13/20/48` state with VR `85/66`; `npm test` passed
> `3511/3511` with `QUALITY-GATES OK`; `npm audit --omit=dev` reported zero
> vulnerabilities; and postconditions were credential/session safety `24/24`,
> canonical residue `18/18`, and BE.6 `46/46` with fingerprint
> `a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d`
> unchanged. Earlier D7 blocked/partial candidates are historical/superseded.
> The post-D7 logout-probe output-hygiene remediation is independently
> Codex-accepted as additive evidence: focused `75/75`, full suite
> `3529/3529` with `QUALITY-GATES OK`, zero escaped `Logout error:` lines,
> `npm audit --omit=dev` zero vulnerabilities, and postconditions
> `24/24 -> 18/18 -> 46/46`. It does not supersede or replace the accepted D7
> `3511/3511` evidence and authorizes no new section.
>
> A first independent read-only R8 review of the clean-snapshot candidate
> returned CANDIDATE NO-GO on pilot-readiness grounds. A separately
> owner-authorized pilot-readiness correction was then applied in one follow-up
> commit: an anonymous `GET /privacy` notice linked from the anonymous footer
> and both authentication surfaces; `X-Robots-Tag: noindex, nofollow, noarchive`
> on every response plus `public/robots.txt`; zero dead footer placeholders; the
> corrected neutral package-inventory label; the owner-approved
> facilitator-mediated pilot model in `docs/deployment.md`;
> `MANUSCRIPT_TEAMDUTCHESS.pdf` untracked; and a new fail-closed
> `pilot-readiness` gate. Indexing control is documented as not being access
> control.
>
> A second independent read-only R8 re-review of that correction candidate found
> further pilot-readiness defects, and a separately owner-authorized re-review
> correction was applied in one follow-up commit: the package-boundary probe no
> longer claims an intentionally dirty worktree or a current-worktree snapshot and
> now states that its inventory reflects current repository bytes, does not itself
> establish Git cleanliness or immutability, and is not deployment authorization;
> the independently pinned gate rejects every stale worktree wording and the
> superseded label; `SEC-37` keeps only the accepted R7 values as history beside a
> freshly recomputed current inventory; the privacy notice now scopes its
> anonymous-denial claim to authorization-denial audit events while preserving the
> separate truthful method/path request-log disclosure; and the local authenticated
> exposure matrix was executed in both runtime modes with a separate fresh browser
> context per role.
>
> Those corrections await another independent read-only R8 review. No R8 GO, Codex
> GO, deployment GO, or pilot GO is claimed by that work.
>
> A separately owner-authorized bounded evidence re-execution has since been
> completed as candidate evidence. The local authenticated exposure matrix was
> re-run clean — MySQL `34/34` plus a `14/14` supplement, Supabase `64/64` plus a
> `14/14` supplement, `126/126` with zero failures — with a separate fresh browser
> context per role, zero carried-over cookies and web storage before
> authentication, every authenticated session registered immediately with
> `scripts/probeSessionLifecycle.js` and terminated exactly once through
> `terminateAll()` and the real CSRF-protected `POST /logout`, no `429`, no
> retried logout, no import or call of `services/sessionRevocation.js`, and no
> direct session-row deletion or database cleanup; final ordered postconditions
> were `24/24 -> 18/18 -> 46/46`. `SEC-05` was executed externally and passed: the
> unsupported-domain OAuth flow reached `accounts.google.com` with `openid`,
> `email` and `profile`, returned to CampuSphere, and was refused at
> `/auth?error=unauthorized_domain` with a sanitized message, leaving Supabase
> `users` at six rows before and after, zero unsupported-domain rows, no user or
> role-profile row, and no persisted pending OAuth registration. The pilot
> feedback form is READY as external owner evidence, with its URL kept outside
> Git. The first execution of that exposure matrix is historical/superseded and
> explicitly NOT accepted: rate-limit `429`s disturbed it, and an orphaned session
> was cleared by a direct `revokeUserSessions` call rather than through the
> supported logout interface.
>
> The follow-up documentation commit recording that evidence awaits an
> independent read-only R8 review. No R8 GO, Codex GO, deployment GO, pilot GO, or
> Milestone 12 GO is claimed. `SEC-51` production smoke remains deferred to a
> separate owner deployment decision. OFF.2-OFF.6 remain deferred until pilot
> review and are not cancelled. Accepted `R1`-`R7` and `D1`-`D7` history is
> unchanged.
>
> `M12.P1-R8` is the next potential section. R8 is read-only and is not
> authorized by this synchronization. Even a future R8 GO authorizes only a
> separate owner deployment decision. Deployment is not authorized, and final
> Milestone 12 GO remains
> blocked by pilot review plus OFF.2-OFF.6 and D6.
>
> Milestone 10 Cloudinary Media Support is complete and Codex GO; Section 10.8
> passed its final end-to-end GO/NO-GO. Milestone 11: Room Scheduling is
> complete and Codex GO; Section 11.8 passed its final GO/NO-GO.
<!-- M12.P1 CURRENT STATUS END -->

> **CURRENT VERIFICATION BASELINE.** The former post-R5/pre-R6 synchronization
> run that ended RED with safety `22/24`, residue RED, and no established BE.6
> postcondition is superseded historical evidence. A separately owner-authorized
> supported restoration closed that blocker. R6 re-verified safety `24/24`,
> canonical residue `18/18`, and BE.6 `46/46` with the frozen fingerprint
> unchanged before editing and again after verification. The accepted R6
> closeout is focused `230/230`, full suite `3415/3415` with
> `QUALITY-GATES OK`, and independent browser verification green.

## Current Truth

- Supabase migrations are exactly `0001` through `0019`; migrations `0014`
  through `0019` are owner-applied and verified. No `0020` exists.
- The BE.6 current reproducible baseline is 13 selected-demo buildings, 20
  route nodes, 48 directed edges, 24 exact forward/reverse pairs, 48 valid
  owner-managed road geometries, and 13 routable building destinations in both
  backends. The temporary edge and `main-gate.display_order` drift were restored
  through separately authorized admin API operations, and the complete D4
  regate returned both backends to the frozen fingerprint.
- The 13 buildings are the selected orientation-demo roster, not a claim that
  every CSPC campus building is represented. They remain admin-editable and
  future owner-approved additions remain supported; changes require refreshed
  parity/regression evidence.
- The authoritative route start is the Guard House / Main Gate.
- CampuSphere computes routes from its own campus graph and renders
  owner-managed road geometry. Google Maps, Google Earth, Strava, SIS, and
  external routing engines are not integrated.
- Guided VR reports arrival only when the final mapped scene belongs to the
  selected destination and has renderable media. Partial panorama coverage
  ends with an explicit coverage notice and never claims arrival.
- The selected demonstration requires the verified Guard House-to-CAS
  walkthrough. CCS remains fully campus-map routable but its guided VR is
  deferred until genuine owner-approved panoramas exist.
- Real room/facility schedules are admin-managed data stored in the configured
  runtime source. They are not enrollment, assigned-class, SIS, or
  instructor-load simulation.

## Current Stop Point

1. `M12.P1-R5`, both R5 follow-ups, dependency-security remediation, R6, R7,
   both R7 source-auditability corrections, and expanded D7 are complete and
   Codex GO.
2. The current safety baseline is R1 `24/24`, residue `18/18`, and BE.6
   `46/46` with the frozen fingerprint unchanged. Do not directly clear session
   rows or mutate accounts.
3. Accepted R7 Codex GO evidence is focused `71/71`, in-suite
   `vercel-package-boundary` `70/70`, full suite `3495/3495` with
   `QUALITY-GATES OK`, and `npm audit --omit=dev` at zero vulnerabilities. The
   `3492/3492` and `3494/3494` candidates remain historical/superseded.
4. The R5, R6, and R7 execution prompts are all spent. Their archived copies
   below are historical and authorize nothing further; a context-only prompt
   authorizes even less.
5. `M12.P1-R8` is the next potential section. R8 is read-only and requires a
   separate owner-authorized read-only review prompt; even R8 GO authorizes only
   a separate owner deployment decision. Vercel linkage and deployment remain
   unauthorized.
6. Under a separate owner authorization, the narrowly scoped R8 finding
   corrections were applied and the complete intended repository state was
   committed once on `main`, so a reviewable immutable snapshot exists. The
   candidate package inventory is recorded in `docs/deployment.md` and
   `docs/test-evidence.md`. The clean-snapshot candidate awaits an independent
   read-only R8 review decision, and `M12.P1` remains NO-GO for deployment and
   pilot readiness.

R1: Live Credential Containment and R2: Fail-Closed Vercel Production Profile
are complete and Codex GO. D1: Logout and Session-Termination, D2: Shared Mobile
Navigation and Brand, D3: Guided-VR Arrival Exploration, D4: Admin Campus-Map
Search and Filter Repair, and D5: Friendly Building Additional-Details Editor
are complete and Codex GO.

D4 restoration and regating are complete. The recorded green evidence includes
topology `105/105`, route geometry API `44/44`, admin route geometry `112/112`,
focused D4 `313/313`, BE.6 `46/46`, and the full suite `2395/2395`. Both
backends match the frozen topology and fingerprint.

D5 is complete and Codex GO. Its final fail-closed editor, modal focus
containment, minimum text size, documentation-gate, and session-hygiene
corrections passed the focused probe `153/153`, full suite `2558/2558` with
`QUALITY-GATES OK`, and BE.6 `46/46`. Independent standalone Playwright MCP
verification passed desktop/mobile focus containment; missing-helper,
constructor-throw, and `focusFirstError()`-throw cases with fixed sanitized
messages, disabled Save, retained modal state, and zero building mutations;
normal editor recovery; logout `200`; and direct-revisit isolation.

The current R1 credential/session-safety result is `24/24`; canonical residue
is `18/18`, and BE.6 is `46/46` with the frozen fingerprint unchanged. The
former `22/24` post-run result is superseded historical evidence. Do not
disclose identifiers or directly delete rows.

M12.P1-R3, all session-hygiene/ownership/import-detector follow-ups, R4, R5,
both R5 follow-ups, the dependency-security remediation, R6, R7, both R7
source-auditability corrections, and expanded D7 are complete and Codex GO.
Accepted D7 evidence is `npm test` `3511/3511` with `QUALITY-GATES OK`,
`npm audit --omit=dev` zero vulnerabilities, fresh separate browser/storage
contexts per role, successful MySQL and Supabase cleanup, and postconditions
`24/24 -> 18/18 -> 46/46` with the frozen fingerprint unchanged. The post-D7
logout-output hygiene remediation is independently Codex-accepted only as
additive evidence at `3529/3529`; it does not replace the accepted D7
`3511/3511` evidence. `M12.P1-R8` is the next potential section. R8 is
read-only and requires a separate
owner-authorized read-only review prompt; even R8 GO authorizes only a separate
owner deployment decision. D6 remains the lowest-priority post-pilot repair
after OFF.2-OFF.5 and before OFF.6. The remaining sequence is R8 read-only
review -> separate owner deployment decision -> pilot review -> OFF.2-OFF.5 ->
D6 -> OFF.6 -> M12.P2 final closeout.

## BE.1 Through BE.3 Decisions

- BE.1 audited the current building, routing, VR, schedule, and media state.
  Official academic-unit names alone are not proof of distinct map buildings.
  No building, coordinate, entrance, or walkway connection may be invented.
- BE.2 added College of Arts and Sciences (CAS) to the canonical,
  source-controlled 13-building roster. Owner-applied migration
  `0018_cas_building_baseline.sql` guarantees one canonical CAS building and
  links the `cas` route node using natural keys without changing topology.
- BE.3 computes route availability once per request and applies it consistently
  across public buildings, map/search, destination actions, and admin building
  surfaces. Unrouted buildings remain visible as campus information but cannot
  initiate map or guided-VR routing, and selection clears any stale line.
- `building.id` always belongs to `BUILDING_DATA_SOURCE`.
  `route_destination_id` and `vr_route_id` always belong to
  `ROUTE_DATA_SOURCE`; numeric IDs are never compared across backends.
- Cross-source joins use normalized canonical names, never numeric IDs. A
  valid join requires exactly one building-source row and no duplicate
  route-source row. Missing, orphaned, duplicate, or ambiguous identities fail
  closed with null destination and VR IDs. Admin duplicate canonical names
  receive a sanitized `409` response.
- All current 13 canonical buildings are route-ready in MySQL, Supabase, and
  both mixed building/route source configurations.

## BE.4 Revised-Scope GO

- The system is intended for CSPC first-year orientation before July 27, 2026.
  The owner does not consider the current 13-building roster the final
  whole-campus scope.
- BE.4 received Codex GO with the exact 24-scene Guard House-to-CAS guided-VR
  sequence, real Cloudinary-backed `vr_scenes`, bidirectional directional
  `vr_hotspots`, and the CAS 101 room-schedule hotspot preserved in both VR
  backends. CCS retains its real campus-map path and metrics while returning
  zero guided scenes, no arrival, and the fixed unavailable notice.
- MySQL and Supabase must use matching CAS natural scene keys, node/building
  linkage, image metadata, directional hotspot semantics, and destination
  coverage. Never compare numeric IDs across backends.
- Existing `scene-ccs` rows and hotspots remain untouched. Their missing local
  media is fallback-readable only and cannot qualify as guided arrival.
- The owner controls Cloudinary uploads. Claude must not upload, rename,
  transform, or delete Cloudinary assets, and must not expose credentials.
  Activating CCS later requires a separate Codex-reviewed dataset upgrade and
  replacement of affected BE.6/OFF evidence if the dataset is already frozen.
- Partial coverage must keep every real available scene usable, end with the
  explicit coverage-ended state, and never report arrival at an unmapped
  destination.
- At BE.4 closeout, focused probes, all four route/VR source combinations,
  desktop and 390 px browser checks, and the complete `npm test` suite passed.
  The graph then matched `20/48/24/48/24/13`; both VR backends had 85 scenes
  and 66 hotspots with zero leftover fixtures. The Current Stop Point records
  the later Supabase probe residue and overrides that graph snapshot.
- BE.5, BE.6, and OFF.1 previously received Codex GO. The `M12.P1` audit is
  complete with NO-GO; current sequencing is recorded in the Current Stop
  Point. Nothing in this handoff authorizes cleanup or deployment.

## BE.5 Selected-Demo Parity GO And BE.6 Freeze

- Canonical target values are CAS description
  `College of Arts and Sciences (CAS)`, `main-gate` label
  `Guard House / Main Gate`, and CAS building/node coordinate
  `13.40594916, 123.37704274`.
- Source and fresh-install seed values are current. Owner-applied migration
  `0019_be5_selected_demo_parity.sql` locks buildings, route nodes, and route
  edges in deterministic order; resolves natural identities; rebuilds only
  `east-walk ↔ cas` geometry; and asserts `20/48/24/48/24/13`.
- `scripts/applyBe5SelectedDemoParityMysql.js` is dry-run-first and guarded by
  `APPLY_BE5_SELECTED_DEMO_PARITY_TO_MYSQL`. It uses a complete semantic
  fingerprint, locked-snapshot backup, affected-row checks, pre-commit proof,
  verified rollback, and post-commit readback.
- Migration `0019` and the guarded MySQL apply were each executed exactly once
  and verified. Its last reviewed dry-run reported zero building, node, and
  edge actions; both backends matched `20/48/24/48/24/13` at BE.5 closeout.
  The Current Stop Point records the later live Supabase exception.
- BE.5 received Codex GO after `52/52` Leaflet/MapLibre destination evidence,
  focused interaction/VR checks, consecutive full suites, and QA closeout.
- `config/selectedDemoFreeze.js` and `scripts/be6DatasetFreeze-probe.js` define
  and verify the read-only BE.6 natural-key freeze. Aggregate manifest
  fingerprint: `a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d`.
- The 13-building freeze is a QA baseline, not a runtime/admin lock. Later
  edits or additions require separately reviewed replacement freeze evidence.
- BE.6 received Codex GO after the freeze probe, focused route/VR/building
  probes, two consecutive full suites, all four QA commands, zero-vulnerability
  audit, and clean fixture/listener closeout.

## OFF.1 GO And Current PWA Privacy Truth

- OFF.1 audited the existing manifest, service worker, session-neutral shell,
  runtime cache/catalog, public APIs, media, and BE.6 dataset. The current PWA
  is still a bounded demo shell/cache, not the completed offline package.
- `/map` now includes the escaped CSRF meta token required by logout.
- `middleware/authenticatedHtmlNoStore.js` sets exact
  `Cache-Control: no-store, private` on authenticated non-API responses. Only
  paths anchored at `/api/` and `/admin/api/` are exempt; request headers do
  not control this cache-security decision.
- Playwright MCP verified logout `302` to `/auth?logged_out=1`, no-store on the
  map/logout responses, zero dynamic caches, zero offline-catalog records, two
  retained session-neutral caches, and no authenticated replay through Back,
  reload, or direct `/map` revisit.
- The deferred package contract uses explicit **Download Offline Guide**
  consent; the 13-building catalog/routes; bounded public schedules for today
  through 14 days; selected CAS/Free-Roam data; truthful deferred CCS;
  best-effort tiles; versioned/atomic storage; and logout cleanup. It excludes
  authenticated HTML, sessions, CSRF, credentials, profile/admin/private data,
  mutations, raw errors, and unapproved media.

## Owner-Authorized Limited Pilot Revision

- The full authenticated app will be deployed if and only if `M12.P1`
  readiness receives Codex GO and the owner separately authorizes deployment.
  This is not a routing-only technical mode.
- Facilitators will guide student/guest testers toward building search and
  routing. All other reachable features remain part of the exposed security
  surface. Existing authentication/role gates stay unchanged; no anonymous
  browsing is added.
- Feedback uses an owner-created Google Form; the URL is pending. Do not build
  feedback persistence, an API mutation, or migration without new scope.
- OFF.2 through OFF.6 resume after pilot review and remain required for final
  Milestone 12 GO. Never claim that the pilot is offline-ready.

## Remaining Sequence

1. R3 through R7, both R5 follow-ups, dependency-security remediation, both
   R7 source-auditability corrections, and expanded D7 are complete and Codex
   GO. The R7 and D7 execution prompts are spent and archived below; they
   authorize nothing further.
2. `M12.P1-R8` is the next potential section. It is read-only, requires a
   separate owner-authorized read-only review prompt, and even R8 GO authorizes
   only a separate owner deployment decision. Do not link Vercel or deploy from
   this handoff.
3. After a separately authorized pilot, review participant findings, then run
   OFF.2 through OFF.5, D6, OFF.6, and M12.P2 final closeout.

The pilot exception changes sequencing, not the offline product obligation.
OFF.2 through OFF.6 are deferred, not cancelled.
Vercel remains a demo/UAT target; Docker remains the Milestone 13 full
deployment finalization path.

## Architecture And Boundaries

- Supabase is the production data and preferred production/demo session-store
  target. MySQL remains the explicit local/fallback/rehearsal path.
- `SESSION_STORE=supabase` is preferred for production and demo;
  `SESSION_STORE=mysql` is the persistent fallback; memory is development-only
  and rejected in production.
- Supabase Auth is not used. Preserve Express sessions, bcrypt local login,
  Google OAuth, role authorization, CSRF, mutation rate limits, audit logging,
  CSP nonces, PWA privacy, and sanitized error contracts.
- Cloudinary is media delivery only for campus images and 360-degree
  panoramas. Credentials remain server-only; local `/img/*` and `/img/vr/*`
  fallbacks remain supported.
- Preserve Leaflet/MapLibre road-following rendering, the admin geometry
  editor, Free Roam, guided VR, room-door schedules, truthful panorama
  coverage, and mixed runtime-source compatibility.
- Do not introduce fake buildings, coordinates, entrances, paths, scenes,
  schedules, enrollment, instructor loads, academic records, SIS integration,
  or third-party routing.

## Required Grounding Read Order

1. `CODEX_HANDOFF.md`
2. `CLAUDE_HANDOFF.md`
3. `plan.md`
4. `ROADMAP.md`
5. `AGENTS.md`
6. `CLAUDE.md`
7. `CODEBASE_REMEDIATION_PLAN.md`
8. `fable5_security_bugs_report.md`
9. `package.json`
10. `config/selectedDemoFreeze.js` and `scripts/be6DatasetFreeze-probe.js`
11. `server.js`, `middleware/authenticatedHtmlNoStore.js`,
    `middleware/roleAuth.js`, `routes/auth.js`, and `routes/map.js`
12. `views/map.ejs`, `public/sw.js`, `public/js/pwa.js`,
    `public/offline.html`, `public/manifest.webmanifest`, and
    `public/css/offline.css`
13. `scripts/quality-gates.js` OFF.1 privacy and documentation gates
14. `services/routeAvailability.js`
15. R3 inputs: `config/vercelProductionProfile.js`,
    `config/sessionConfig.js`, `services/supabaseSessionStore.js`,
    `services/mysqlSessionStore.js`, `scripts/with-server.js`, and
    `scripts/vercelProductionProfile-probe.js`
16. `scripts/routeTopology-probe.js`,
    `scripts/adminRouteGeometryEditor-probe.js`,
    `scripts/adminCampusMapSearchFilter-probe.js`, and the R1-R2/D1-D5 files
    listed in the copy-paste prompt below
17. building baseline/integration, route geometry, map-to-VR, guided-CAS,
    Free Roam, and VR-schedule probes named in `plan.md`
18. future D7 interfaces: admin building, route-node, route-edge/geometry, and
    schedule routes/controllers/repositories plus their focused probes
19. `public/js/admin/building-details-editor.js`,
    `public/js/admin/admin-buildings.js`, `views/admin/campus-map.ejs`, the
    D5-scoped CSS, `scripts/buildingDetailsEditor-probe.js`, and its quality-gate
    registration
20. `scripts/pilotCredentialSafety-probe.js`
21. all existing Vercel/deployment configuration and documentation
22. full `database/supabase/*.sql` migration list
23. `git status --short` and `git status --porcelain=v1` count
24. staged, unstaged, untracked, stash, and current-HEAD summaries

The live repository and database override screenshots, reports, and memory.
The refreshed handoffs and `plan.md` override stale summary claims in
`ROADMAP.md`, `AGENTS.md`, `CLAUDE.md`, or other documentation. Detailed
section contracts remain authoritative unless current live evidence invalidates
their assumptions. Stop after grounding unless a specific implementation
section is explicitly authorized.

## Working Rules

- Preserve the intentionally dirty worktree. Do not stage, commit, stash,
  reset, clean, delete, move, or revert unless the owner explicitly asks.
- Do not overwrite unrelated user or agent changes.
- Do not apply Supabase SQL, perform Cloudinary runtime/API/credential
  actions, deploy, or create migration `0020` or later without an explicitly
  reviewed section. `M12.P1` grounding/readiness is not deployment permission.
- Never run `node server.js`, `npm start`, or `npm run dev` in the foreground.
  Use `scripts/with-server.js` for probes; use a bounded background server with
  exact-PID teardown only for browser checks.
- Never expose secrets, cookies, session IDs, keys, request bodies, raw DB
  errors, stack traces, or complete geometry payloads in reports or external
  tools.
- A context-only prompt authorizes file reading and read-only Git inspection
  only. It does not authorize `npm test`, application probes, servers, browser
  operation, live database queries, residue cleanup, implementation, or GO.
- Claude implements one Codex-authorized BE/OFF/PILOT section at a time and
  does not edit `plan.md` unless the current owner prompt explicitly authorizes
  a status-only synchronization, and then only after green verification. Only
  the current owner prompt can grant that exception; an archived or spent
  prompt reproduced under a historical heading in either handoff authorizes
  nothing. Claude stops with a complete report and waits for independent Codex
  review before continuing.

## R3 Session-Hygiene Remediation (complete; Codex GO)

- R3 and all session-hygiene/ownership/import-detector follow-ups are complete
  and Codex GO. Its GO did not itself authorize later work; R4 was subsequently
  implemented, independently reviewed, and granted Codex GO.
- `ensureCsrfToken(session)` was added to `middleware/csrfProtection.js`, and
  `establishAuthenticatedSession` mints the regenerated session's token after
  `assignSessionUser` and before `saveSession`, so the persisted authenticated
  session already carries the token the first rendered page shows. The
  pre-regeneration anonymous token is never reused.
- `scripts/with-server.js` now always assigns the child `SESSION_STORE`:
  omitted means "follow the normalized data mode", and a blank/invalid explicit
  value fails closed instead of inheriting the ambient value.
- Every canonical-login probe owns its sessions through
  `scripts/probeSessionLifecycle.js`, terminating from a `finally`. The static
  ownership inventory now discovers probes from the filesystem as well as the
  registered list; it proves source patterns only.
- `scripts/probeSessionResidue-probe.js` is the registered FINAL npm-test gate
  and the authoritative zero-residue postcondition (SELECT-only, both stores,
  fail-closed when a store is unreadable or unconfigured).
- Accepted Codex GO evidence: full suite
  `2921/2921` `QUALITY-GATES OK`; in-suite resolver
  `14/14`, residue `18/18`; standalone R1 `24/24`, R2 `88/88`, R3 `86/86`,
  BE.6 `46/46` with the frozen fingerprint unchanged.

## R4 And Dependency-Security Closeout (complete; Codex GO)

- R4 uses one `@upstash/redis@1.38.0` client per process on Vercel, exactly one
  transport attempt (`retry: { retries: 0 }`), one atomic single-key Lua
  `EVAL` with `#!lua flags=allow-key-locking`, authoritative Redis `PTTL`, and
  HMAC-only bucket identifiers. Local development keeps the in-memory adapter;
  Vercel failure returns the fixed sanitized no-store `503` without fallback.
- Accepted R4 evidence: focused `180/180`, R2 `119/119`, R3 `86/86`, full
  suite `3040/3040` with `QUALITY-GATES OK`, R1 `24/24`, residue `18/18`, and
  BE.6 `46/46`, fingerprint unchanged. Standalone probes are not counted in the
  full-suite total.
- Current pre-R5 authority/handoff evidence: full suite `3050/3050` with
  `QUALITY-GATES OK` (+10 `docs-current` checks versus the accepted R4 total).
  No R5 implementation or focused R5 probe was run to produce this number.
- Authority-sync authoring disclosure: two earlier `npm test` runs were red
  only in the new `docs-current` R5-ready assertions (7 failures, then 5).
  Their predicate/prose defects were corrected before the final green run; no
  application, session, dataset, or dependency gate failed in those runs.
- The accepted 2026-07-22 compatible dependency-security remediation is
  historical Codex GO evidence. At that closeout `package.json` remained
  byte-identical and compatible lockfile updates resolved
  `body-parser@2.3.0` and `brace-expansion@2.1.2`. Both `npm audit --omit=dev`
  and `npm run qa:audit` report zero vulnerabilities.

## Latest Continuity Snapshot

- D4 is complete and Codex GO. Both backends match the frozen
  `20/48/24/48/24/13` topology, VR `85/66`, and BE.6 fingerprint
  `a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d`.
- D5 is complete and Codex GO. Final evidence includes focused D5 `153/153`,
  full suite `2558/2558`, BE.6 `46/46`, credential/session safety `24/24`, and
  independent standalone Playwright MCP desktop/mobile and fail-closed negative
  cases with zero building mutations and complete cleanup.
- Current credential/session safety is `24/24`, canonical residue is `18/18`,
  and BE.6 is `46/46` with the frozen fingerprint unchanged. The earlier
  `22/24` result and red residue/BE.6 candidate are explicitly superseded
  historical evidence. No direct session-row cleanup is authorized.
- Repository snapshot at the START of the R7 session: HEAD `5cce682`, 161
  porcelain entries, 13 staged paths, 76 unstaged tracked paths, 81 untracked
  entries, 304 expanded untracked files, and zero stashes.
- Current repository snapshot after R7: HEAD `5cce682`, 163 porcelain entries,
  13 staged paths, 76 unstaged tracked paths, 83 untracked entries, 307
  expanded untracked files, and zero stashes. The whole delta is R7: the new
  untracked `.vercelignore`, `vercel.json`, and
  `scripts/vercelPackageBoundary-probe.js`. Nothing was staged, committed,
  stashed, reset, or reverted. Recalculate after every session because
  the worktree is intentionally dirty.
- R3, all follow-ups, R4, R5, both R5 follow-ups, dependency-security
  remediation, R6, R7, both R7 source-auditability corrections, and expanded D7
  are complete and Codex GO. `M12.P1-R8` is the next potential section and is
  read-only; it requires a separate owner-authorized read-only review prompt, and
  even R8 GO authorizes only a separate owner deployment decision.

## M12.P1-R5 Bounded Anonymous Access-Denial Auditing (complete; Codex GO)

`M12.P1-R5`, its authoritative-global-total follow-up, its documentation-gate
final correction, R6, and R7 are complete and Codex GO.
`M12.P1` remains NO-GO for deployment and pilot readiness.

- Production scope is one file: `middleware/roleAuth.js`. Both anonymous
  branches stopped auditing, so routine logged-out traffic to a login-gated or
  role-gated route creates zero `system_logs` rows while keeping the exact
  `302` to `/auth` and the exact fixed
  `401 { success:false, message:'Authentication required.' }`. `wantsJson(req)`
  is unchanged.
- `auditAccessDenied(req, actorId, actorRole)` became
  `auditAuthenticatedAccessDenied(req, actor)` and is authenticated-only by
  construction: the new pure `isAuditableActor(actor)` predicate requires a
  positive integer id and a non-blank role, and the helper returns `false`
  before touching `auditService.record` otherwise.
- Exactly one audit write remains, in the authenticated wrong-role branch, with
  `event_type='authorization'`, `action='access.denied'`, `outcome='denied'`,
  `target_type='route'`, the query-free request path, and the fixed sanitized
  message. It stays fire-and-forget and never alters the `403` HTML/JSON denial.
- No audit schema/service/repository, migration, session, authentication,
  rate-limit, dependency, or `server.js` change. No anonymous-denial table, raw
  IP, Redis denial record, timer, retry, or aggregation path. Supabase
  migrations remain exactly `0001`-`0019`.
- Focused standalone evidence: `scripts/boundedAnonymousAccessDenial-probe.js`
  `90/90`, MySQL on port `3381` and Supabase on port `3382`, each refusing an
  occupied port and terminating both canonical sessions through
  `scripts/probeSessionLifecycle.js` from the outermost `finally`.
- Historical R5 follow-up candidate evidence closed two independent Codex findings:
  1. The focused probe now proves the AUTHORITATIVE unfiltered `system_logs`
     total is unchanged across the twenty anonymous requests, not merely the
     filtered authorization/denied count. A fail-closed `validateLogsBody`
     returns a distinct filtered `total` and a `globalTotal` from
     `body.summary.total` (missing/malformed/negative fails closed; a filtered
     count is never substituted); a bounded `readStableGlobalTotal` fixes a
     stable baseline (two consecutive equal reads, ≤24 reads / 250 ms, reset by
     any invalid read) before the anonymous batches; and `globalTotalStaysAt`
     proves it unchanged across six reads after. +2 checks per backend → `90/90`.
  2. Historical R5 follow-up evidence: both reusable prompts in
     `docs/new-session-grounding-prompts.md` once carried stale pre-follow-up
     wording and were corrected under the R5 documentation gate. They have
     since been synchronized again for R6 GO and R7-next authority.
- In-suite evidence: the `bounded-anon-denial` gate in
  `scripts/quality-gates.js`, whose negative fixtures mutate the real
  `middleware/roleAuth.js` AND probe sources (reintroduced anonymous audit
  write, removed actor guard, duplicated authenticated write, query-bearing
  target, weakened denial response, removed/substituted global-total read,
  omitted postcondition, late baseline, dropped filtered assertion, bypassed
  validator) plus database-free drives of the probe's real exported helpers; a
  dedicated documentation extractor/validator parses each fenced grounding
  prompt independently. Historical candidate fixtures rejected structural
  defects, stale R5-next wording, a premature R5 GO, or R6 authorization at
  that candidate stage; the current gate is retargeted to R6 GO/R7-next
  authority.
- R1 `24/24`, R2 `119/119`, R3 `86/86`, R4 `180/180`, and R5 `90/90` are
  standalone and are never counted inside the `npm test` total. The initial R5
  candidate full suite was `3162/3162`; after the follow-up the accepted R5
  closeout full suite is `3234/3234` with `QUALITY-GATES OK` (+72 vs `3162`:
  +54 `bounded-anon-denial`, +18 `docs-current`), with credential/session safety
  `24/24`, canonical residue `18/18`, BE.6 `46/46` with the fingerprint
  unchanged, and `npm audit --omit=dev` at zero.
- Disclosed red run: the FIRST (initial-candidate) R5 `npm test` reported four
  `bounded-anon-denial` failures, all defects in the NEW GATE rather than the
  application — three forbidden-pattern scans matched documentation prose that
  states the guarantee being asserted, and one negative fixture was anchored on
  a wrongly indented line and mutated nothing. The scans were rewritten as
  precise code shapes and the fixture re-anchored; no application, session,
  dataset, or dependency gate failed. The R5 follow-up in this session produced
  no red suite run.

## M12.P1-R6 Self-Hosted Browser Dependencies (complete; Codex GO)

`M12.P1-R6` and `M12.P1-R7` are complete and Codex GO. `M12.P1` remains NO-GO
for deployment and pilot readiness.

- Exact reviewed browser dependencies are self-hosted under `public/vendor`:
  Leaflet `1.9.4`, MapLibre GL JS `4.7.1`, Pannellum `2.5.6`, Iconify Icon
  `1.0.7`, and Lucide `1.25.0`.
- `public/vendor/manifest.json` records the exact registry tarball URL,
  sha512 integrity, license, source path, destination, byte count, final
  SHA-256, and the sole Leaflet transformation. The previously reviewed
  `public/vendor/leaflet/leaflet.js` bytes remain the official distribution
  with only the trailing sourceMappingURL reference removed.
- Provenance is pinned independently of the manifest in
  `EXPECTED_VENDOR_INVENTORY` inside
  `scripts/selfHostedBrowserDependencies-probe.js`. The analyzer and in-suite
  gate fail closed on any package, version, license, tarball, integrity, source,
  destination, byte-count, SHA-256, global-interface, inventory, or
  transformation divergence. Disk and served bytes are checked against those
  independent pins.
- Remote executable CDN references were removed from all affected views.
  `script-src` is exactly `'self'` plus the per-response nonce;
  `unpkg.com`, `cdn.jsdelivr.net`, and `code.iconify.design` are absent from
  every CSP directive. Google Fonts, approved OSM tiles, Iconify data delivery,
  and owner-controlled Cloudinary remain only in their truthful
  non-executable font/data/media boundaries.
- PWA privacy remains unchanged. `public/sw.js` changed only in commentary, no
  authenticated navigation is claimed offline, and the allowlist boundaries
  for tiles and owner-controlled media are preserved.
- Missing Lucide, Iconify, Leaflet, MapLibre, or Pannellum assets fail closed
  with truthful unavailable states and no executable CDN fallback, stale route,
  or false VR-arrival claim.
- Accepted R6 evidence is the standalone focused probe `230/230`, full suite
  `3415/3415` with `QUALITY-GATES OK`, independent browser verification of all
  affected admin/public/map/VR pages at `1440x900` and `390x844`, safety
  `24/24`, residue `18/18`, and BE.6 `46/46` with fingerprint
  `a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d`
  unchanged. `npm audit --omit=dev` reports zero vulnerabilities.
- The focused R6 probe is standalone and is never counted in the npm-test
  total. R1-R5 focused probes, standalone residue checks, and standalone BE.6
  checks remain separate evidence.
- `package.json` and `package-lock.json` were not changed by R6. No migration
  `0020`, database repair, account/credential change, deployment, Vercel
  linkage, or Git-state mutation occurred.
- Historical disclosed R6 runs remain evidence, not current authority: the
  implementer encountered two new-gate false positives and corrected them
  without weakening the contract; the first R6 authority-synchronization suite
  later found four documentation-predicate/prompt-shape defects, which were
  corrected before the accepted `3415/3415` closeout. Neither red run replaced
  accepted R6 evidence.

## M12.P1-R7 Vercel Package And Static-CDN Boundary (complete; Codex GO)

`M12.P1-R7`, both source-auditability corrections, and expanded D7 are complete
and Codex GO.
Accepted evidence is focused `71/71`, in-suite `vercel-package-boundary`
`70/70`, full suite `3495/3495` with `QUALITY-GATES OK`, and
`npm audit --omit=dev` at zero vulnerabilities. Accepted D7 evidence is the
fresh-context role-isolation rerun: separate Playwright `BrowserContext`
objects per role with no storage carryover, both MySQL and Supabase legs
completed and cleaned up through supported application interfaces, `npm test`
`3511/3511` with `QUALITY-GATES OK`, `npm audit --omit=dev` at zero
vulnerabilities, and postconditions `24/24 -> 18/18 -> 46/46` with the frozen
fingerprint unchanged. The post-D7 logout-output hygiene remediation is
accepted only as additive evidence at `3529/3529` with `QUALITY-GATES OK` and
zero escaped logout-error lines; it does not supersede D7. `M12.P1-R8` is the
next potential section and is read-only; it is not authorized by this
synchronization.
`M12.P1` remains NO-GO for deployment and pilot readiness.

- The new root `.vercelignore` is an ALLOWLIST: it begins with `/*`, re-includes
  only `server.js`, `package.json`, `package-lock.json`, `vercel.json`, and the
  ten runtime directories (`config`, `controllers`, `middleware`, `models`,
  `repositories`, `routes`, `services`, `utils`, `views`, `public`) together
  with their descendants, and then denies `public/img/sample 360/` and
  `public/img/sample 360/**` AFTER the `public` re-inclusion.
- At accepted R7 closeout the enumerated package was 154 files and 6,166,956
  bytes: 4 root files, 56
  public assets (68 minus the 12 excluded local panoramas), and the ten runtime
  directories. `.env*`, documentation and handoffs, `scripts/`, `database/`,
  screenshots and evidence media, Docker files, local agent metadata,
  `node_modules`, logs/caches/temporary material, and Git metadata are all
  excluded.
- The new root `vercel.json` carries exactly `$schema` and `headers`. Its seven
  rules are narrowly scoped: `nosniff` for `/css/:path*`, `/js/:path*`,
  `/img/:path*`, `/vendor/:path*`, and `/manifest.webmanifest`; `no-cache` plus
  `Service-Worker-Allowed: /` plus `nosniff` for `/sw.js`; and `nosniff`,
  `Referrer-Policy: no-referrer`, and one fixed static-only CSP for
  `/offline.html`. There is no `builds`, `functions`, `routes`, `rewrites`,
  `redirects`, framework/build/install override, or catch-all rule, and no
  long-lived immutable caching on these non-content-hashed URLs.
- Express keeps sole CSP authority for dynamic responses. `middleware/
  securityHeaders.js` is unchanged: it still mints a per-request nonce and still
  restricts `script-src` to `'self'` plus that nonce.
- `server.js` is unchanged. It still exports the Express app and still opens a
  listener only as the main module; no `api/` duplicate entrypoint, Vercel
  adapter, or `.vercel` metadata was created.
- `scripts/vercelPackageBoundary-probe.js` is standalone, read-only,
  database-free, session-free, and external-network-free. It pins the expected
  root files, runtime directories, forbidden path classes, public asset classes,
  the 18 vendored runtime files, and the header contract in probe code OUTSIDE
  `.vercelignore` and `vercel.json`, so a coordinated configuration-plus-preview
  edit still fails without a reviewed code change. Its preview is console-only
  and is labelled `CURRENT DIRTY-WORKTREE BOUNDARY PREVIEW — NOT AN IMMUTABLE
  DEPLOYMENT MANIFEST`; nothing is written into the repository.
- The focused probe also builds a temporary static root OUTSIDE the repository
  containing only the allowlisted public files, serves it from one bounded
  listener on dedicated port `3385`, and closes the listener and removes the
  directory in `finally`.
- The in-suite `vercel-package-boundary` gate drives the same real analyzers and
  adds independent negative fixtures for every forbidden inclusion, missing
  requirement, ordering/duplicate/case/traversal/separator/encoded-space
  ambiguity, extra or altered header rule, broad or dynamic CSP, build/routing
  override, and falsified manifest count, size, per-file hash, or aggregate
  hash.
- The focused R7 probe is standalone and is never registered or counted in
  `npm test`, exactly like R1-R6. `scripts/probeSessionResidue-probe.js` remains
  registered exactly once and last.
- `package.json` and `package-lock.json` were not changed; both retain their
  opening SHA-256 values. No SQL, migration `0020`, dataset repair, account or
  credential change, direct session-row deletion, dependency mutation, Vercel
  linkage/build/deployment, or Git-state mutation occurred.
- **Post-review corrections (closed; Codex GO).** The independent Codex R7
  review found a literal `0x00` byte in
  `scripts/vercelPackageBoundary-probe.js` (former line 564, offset 25235) that
  made the file read as binary; it was replaced byte-surgically with the textual
  `\0` (`0x5c 0x30`) with the package preview unchanged, and a frozen
  audited-source set plus a fail-closed `containsLiteralNulByte()` guard it. The
  re-review then found that the in-suite gate trusted the probe's exported
  `R7_AUDITABLE_SOURCE_FILES` wholesale, so swapping `scripts/quality-gates.js`
  for another NUL-free file (e.g. `package.json`) still passed; the gate now
  pins the list independently in `EXPECTED_R7_AUDITABLE_SOURCE_FILES` and
  requires exact ordered equality with the export. Only
  `scripts/quality-gates.js` and the documentation set changed for these
  corrections; the probe, `.vercelignore`, `vercel.json`, and both package
  manifests were not changed for the list-pinning fix. Accepted R7 Codex GO
  evidence is focused `71/71`, in-suite `70/70`, full suite `3495/3495` with
  `QUALITY-GATES OK`, and `npm audit --omit=dev` at zero vulnerabilities. The
   literal-NUL remediation (`71/71`/`69`/`3494`) and the initial candidate
   (`70/70`/`67`/`3492`) are historical/superseded.

## Historical Spent One-Shot D7 Execution Prompt

The fenced prompt below is preserved only as the historical authority D7 ran
under. `M12.P1-D7` is complete and Codex GO, so this prompt is spent and
authorizes nothing further: no D7 rerun, R8, Vercel linkage, deployment, SQL,
direct data repair, or Git-state mutation.

~~~text
M12.P1-D7 — Cross-Role Admin-to-Participant End-to-End Regression Gate

Work in:

C:\Users\FROST.GG\Desktop\CampuSphere v1

This is the current Codex thread and a single owner-authorized D7 execution
dated 2026-07-26 Asia/Manila.

AUTHORITY, PURPOSE, AND STOP BOUNDARY

This prompt explicitly authorizes only expanded M12.P1-D7. R1-R7 and D1-D5 are
complete and Codex GO. Accepted R7 closeout evidence is focused 71/71, in-suite
vercel-package-boundary 70/70, full suite 3495/3495 with QUALITY-GATES OK, and
npm audit --omit=dev at zero vulnerabilities. The 3492/3492 initial R7 candidate
and 3494/3494 literal-NUL remediation candidate are historical/superseded.

D7 is a browser-driven, two-backend, temporary-data lifecycle and
all-reachable-page regression gate. It is not a code-editing or defect-repair
section. Do not edit, format, create, delete, rename, or regenerate any
repository file. Do not add a D7 probe or quality gate, update documentation,
change package.json or package-lock.json, install/update dependencies, apply SQL,
create migration 0020, use direct table mutation, alter accounts or credentials,
clear session rows directly, access Cloudinary or Upstash APIs, link or call
Vercel, build/upload/deploy, create .vercel metadata, or perform any Git
state-changing operation.

Do not begin R8, D6, OFF.2-OFF.6, or any unrelated admin CRUD exercise. Do not
repair a defect found by D7. If D7 exposes an application defect, preserve the
evidence, perform the mandatory supported cleanup if its exact fixture identity
is still safe, stop, and recommend a separately scoped remediation prompt.

D7 cannot receive GO from its implementer. At the end, report either
"executed and awaiting independent Codex review", RED/BLOCKED, or
TOOL-BLOCKED. Do not claim D7 GO, R8 readiness, deployment readiness, pilot
readiness, or Milestone 12 GO. M12.P1 remains NO-GO for deployment and pilot
readiness. Stop after the final report.

CAPABILITIES AND REVIEW DISCIPLINE

1. Inspect the skills, plugins, MCP servers, browser surfaces, and other
   capabilities actually available in this session before acting.
2. Use the code-reviewer skill before every security, performance, correctness,
   maintainability, database, UI, quality, deployment, or documentation finding.
   If it is unavailable, report that and review inline in this order: security,
   performance, correctness, maintainability.
3. Root Codex may spawn exactly one bounded D7 executor subagent. That executor
   performs the browser/server lifecycle and returns candidate evidence only;
   root Codex remains the independent reviewer and makes the D7 GO/NO-GO
   decision. Do not spawn any other subagent or delegate any other work.
4. Playwright MCP/browser control is mandatory for D7. Use it for the real
   desktop/mobile UI, browser storage, network, console, accessibility, logout,
   Back/reload, and missing/stale-session checks. Static inspection or HTTP-only
   evidence cannot replace the browser matrix. If no browser-capable surface is
   available, stop before any fixture write and report TOOL-BLOCKED.
5. Use Context7 only if exact current library or Vercel behavior becomes
   genuinely ambiguous. Do not call external services merely because a
   connector is installed.
6. Do not use Vercel, Cloudinary, Upstash, or live database consoles/APIs.
   Named repository probes may use their existing supported clients. D7 fixture
   writes and cleanup must use only the real authenticated application UI and
   its existing supported application endpoints.
7. Preserve the intentionally dirty worktree. Do not stage, commit, stash,
   reset, checkout, clean, restore, revert, or overwrite inherited changes.

READ COMPLETELY BEFORE THE FIRST PRECONDITION

Read in this order:

1. CODEX_HANDOFF.md:
   - authoritative current-status block;
   - Current Truth;
   - Current M12.P1 Stop Point;
   - D7 contract and remaining sequence;
   - R6/R7 closeouts and accepted/superseded evidence;
   - fresh-session rules and historical-prompt boundaries.
2. CLAUDE_HANDOFF.md:
   - authoritative current-status block;
   - Current Truth and Current Stop Point;
   - Remaining Sequence;
   - architecture and working boundaries;
   - R6/R7 closeouts;
   - this complete current owner-authorized D7 prompt;
   - historical prompts only as history.
3. plan.md completely, with special attention to Summary, M12.P1, D1-D7, R8,
   Interfaces and Contracts, Anti-Scope, Assumptions, and pilot/post-pilot
   sequencing.
4. AGENTS.md completely.
5. CLAUDE.md completely.
6. ROADMAP.md, especially M12.P1, the expanded D7/R8 order, pilot gates,
   deferred OFF.2-OFF.6, and Milestones 12-13.
7. docs/new-session-grounding-prompts.md, docs/deployment.md,
   docs/security-checklist.md, and docs/test-evidence.md.
8. package.json and the relevant package-lock.json application/session entries.
9. server.js and scripts/with-server.js.
10. scripts/regressionCredentials.js, scripts/probeSessionLifecycle.js,
    scripts/pilotCredentialSafety-probe.js, scripts/probeSessionResidue-probe.js,
    and scripts/be6DatasetFreeze-probe.js.
11. The runtime-source, session, authentication, authorization, CSRF, no-store,
    rate-limit, and selected-demo configuration used by both backend legs,
    including:
    - config/authDataSource.js
    - config/contentDataSource.js
    - config/vrDataSource.js
    - config/scheduleDataSource.js
    - config/mapRuntime.js
    - config/sessionConfig.js
    - config/selectedDemoFreeze.js
    - middleware/roleAuth.js
    - middleware/csrfProtection.js
    - middleware/authenticatedHtmlNoStore.js
    - services/supabaseSessionStore.js
    - services/mysqlSessionStore.js
12. The complete supported admin interfaces for buildings, structured details,
    route nodes, route edges/geometry, and schedules:
    - routes/admin.js
    - controllers/adminController.js
    - controllers/adminBuildingsController.js
    - controllers/adminRouteController.js
    - controllers/adminScheduleController.js
    - repositories/buildingRepository.js
    - repositories/routeRepository.js
    - repositories/scheduleRepository.js
    - views/admin/campus-map.ejs
    - public/js/admin/admin-buildings.js
    - public/js/admin/building-details-editor.js
    - public/js/admin/admin-map-graph.js
    - public/js/admin/admin-schedules.js
13. The participant building, map, routing, schedule, VR, navigation, and logout
    interfaces, including routes/buildings.js, routes/map.js, routes/vr.js,
    controllers/buildingsController.js, controllers/mapController.js,
    controllers/vrController.js, services/routeAvailability.js, models/data.js,
    and every client script those reachable views load.
14. scripts/quality-gates.js and the relevant existing probes, especially:
    - scripts/logoutSessionTermination-probe.js
    - scripts/sharedMobileNavigation-probe.js
    - scripts/guidedCasVr-probe.js
    - scripts/guidedVrResolution-probe.js
    - scripts/vrHotspotNavigation-probe.js
    - scripts/adminCampusMapSearchFilter-probe.js
    - scripts/buildingDetailsEditor-probe.js
    - scripts/buildingDatasetIntegration-probe.js
    - scripts/routeTopology-probe.js
    - scripts/routeGeometryData-probe.js
    - scripts/routeGeometryApi-probe.js
    - scripts/adminRouteGeometryEditor-probe.js
    - scripts/publicRoadRouteRendering-probe.js
    - scripts/scheduleRepository-probe.js
    - scripts/adminScheduleCrud-probe.js
    - scripts/publicScheduleDisplay-probe.js
    - scripts/mapVrDestinationFlow-probe.js
    - scripts/freeRoamVr-probe.js
    - scripts/vrScheduleHotspot-probe.js
15. The complete database/supabase/*.sql filename list. Confirm migrations stop
    at 0019 and do not apply or create a migration.
16. Read-only Git truth:
    - git status --short;
    - porcelain count;
    - staged name-status summary;
    - unstaged tracked name-status summary;
    - compact and expanded untracked counts;
    - stash count;
    - branch and HEAD;
    - SHA-256 of package.json, package-lock.json, and
      config/selectedDemoFreeze.js.

CURRENT FROZEN TRUTH TO VERIFY, NOT BLINDLY TRUST

- Supabase migrations are exactly 0001-0019. Migrations 0014-0019 are
  owner-applied. No migration 0020 exists or is authorized.
- Supabase is the production data/session target. MySQL is local development,
  fallback, and rehearsal. Supabase Auth is not used.
- Both backends must begin and end with 13 selected-demo buildings.
- Frozen topology is 20 nodes, 48 directed edges, 24 exact reverse pairs,
  48 valid geometries, 24 exact reverse geometries, and 13 routable
  destinations.
- VR totals are 85 scenes and 66 hotspots.
- BE.6 fingerprint is:
  a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d
- The 13 buildings are editable selected-demo data, not the complete campus.
  D7 adds only one explicitly temporary fixture per backend and must remove it.
- Numeric IDs are backend-local. Match the two legs only by the D7 building
  name, node key, schedule title, and other explicit natural keys.
- Routing uses CampuSphere's graph and owner-managed path_geometry. It has no
  Google Maps, Google Earth, Strava, SIS, or external routing-engine dependency.
- CAS keeps the verified Guard House-to-CAS guided route. The temporary D7
  building must not receive a fake VR scene, hotspot, mapping, or arrival claim.
  Map routing may work while guided VR truthfully reports no coverage.
- Preserve Express sessions, bcrypt, Google OAuth, roles, CSRF, CSP nonces,
  rate limits, sanitized errors, audit behavior, PWA privacy, same-origin
  browser vendors, owner-controlled Cloudinary delivery, schedules, routing,
  and truthful VR arrival.

EXPECTED OPENING SNAPSHOT

Verify rather than trust:

- HEAD: 5cce682
- Branch: main
- Porcelain entries: 163
- Staged paths: 13
- Unstaged tracked paths: 76
- Compact untracked entries: 83
- Expanded untracked files: 307
- Stashes: 0
- package.json SHA-256:
  7bd8e67c000e7ef35677a0919be122ff5708f0b7a5f15cbb903ddc65b9733548
- package-lock.json SHA-256:
  59a77a5601af97692bd79b92bd3d268fe547dcaa513b775bab6fd27fb4a5a437
- config/selectedDemoFreeze.js SHA-256:
  4b82545acedbb035e984160dc37ffdb02c43acdf7c820bec1fff4683f029568d
- Current dirty-worktree Vercel boundary preview: 154 files, 6,165,772 bytes,
  aggregate SHA-256
  44172479d5b57f0f7ec9945cc63f9078ad738ba68ad9acf6efc05878dbc5910a.

If live Git truth or a hash differs, stop before any fixture write and report
the exact difference. Do not "repair" the intentionally dirty worktree.

MANDATORY SEQUENTIAL OPENING GATE

Before starting a server, opening the browser, logging in, or writing a fixture,
run exactly once and in this order:

1. node scripts/pilotCredentialSafety-probe.js — require 24/24.
2. node scripts/probeSessionResidue-probe.js — require 18/18.
3. node scripts/be6DatasetFreeze-probe.js — require 46/46 and the frozen
   fingerprint unchanged.

Do not overlap these commands. Do not rerun an unchanged red check hoping for
green. If any gate is not green, stop before all D7 writes and report the
blocker. This prompt does not authorize cleanup/restoration, direct session-row
deletion, database repair, dataset repair, account repair, or freeze-manifest
changes to satisfy the opening gate.

CREDENTIAL AND OWNER-INPUT BOUNDARY

- Never open, print, echo, log, serialize, screenshot, or paste the value of any
  credential, cookie, CSRF token, session id, database URL/key, OAuth secret,
  Cloudinary secret, or Upstash token.
- Existing probes may consume regression credentials only through
  scripts/regressionCredentials.js in memory.
- For interactive browser logins, pause and ask the owner to take control and
  enter the credential privately. Do not inspect password fields or browser
  request bodies. After successful login, resume only when the owner returns
  control.
- The owner supplies and confirms the temporary building image, building
  coordinates, linked-node coordinates, chosen existing anchor node, forward
  geometry, reverse geometry, distance/time/instruction fields, structured
  building details, and public schedule values. Do not invent campus facts,
  coordinates, road shapes, entrances, or room claims.
- At each checkpoint below, show the owner a concise field checklist, pause for
  input, validate the resulting UI state against this contract, and continue
  only after the owner confirms it is correct.

BROWSER AND SERVER DISCIPLINE

Use one backend and one server at a time:

- MySQL leg: dedicated port 3500.
- Supabase leg: dedicated port 3501.

Before each launch, prove the port is free. Use the agent runner's native
background/async process facility, not a foreground `node server.js`, npm start,
npm run dev, detached/unref workaround, or blanket node.exe kill. Inherit the
complete environment and override only PORT plus all six data-source switches:
AUTH_DATA_SOURCE, CONTENT_DATA_SOURCE, BUILDING_DATA_SOURCE,
ROUTE_DATA_SOURCE, VR_DATA_SOURCE, and SCHEDULE_DATA_SOURCE. Set all six to the
current backend and set SESSION_STORE to that same backend.

Record the exact PID. Wait for readiness, use the browser, then stop that exact
PID in `finally` and confirm its port is free. Never run the MySQL and Supabase
D7 servers concurrently. Never leave a listener, browser context, cookie jar,
temporary file, or cache artifact behind.

Use fresh browser contexts for administrator, student, guest, and instructor
roles. Do not reuse authenticated storage across roles or backends. Test at:

- desktop: 1440x900;
- mobile: 390x844.

Record sanitized screenshots only when they contain no credential, cookie,
token, session id, private environment value, or raw database output. Store no
new screenshot or console artifact in the repository.

TEMPORARY FIXTURE CONTRACT

Create one run token from Asia/Manila local time:

D7-YYYYMMDD-HHmmss

Use the same natural keys in both backends:

- building name: D7 TEMP YYYYMMDD-HHmmss Building
- route-node key: d7-temp-yyyymmdd-hhmmss-building
- edge/path label: D7 TEMP YYYYMMDD-HHmmss Connector
- schedule title: D7 TEMP YYYYMMDD-HHmmss Public Schedule
- room/facility label: D7-101
- floor label: Ground Floor

Before every create, search the current backend for an exact natural-key match.
Require zero matches. After each create, require exactly one match and record
only the backend-local positive integer ID in process memory; do not print it or
reuse it in the other backend.

Use the owner-supplied same-origin sample image path or an existing
owner-controlled Cloudinary delivery URL. If the owner explicitly chooses the
repository fallback, `/img/campus-hero.jpg` is allowed. Do not upload media or
call Cloudinary.

The building details must be created through the friendly structured editor and
must exercise walking time, at least one entrance, at least one landmark, one
floor, one room with name/use, and one informational item with its optional
location. The visible values must remain explicitly temporary and
owner-supplied.

The linked route node must use the building's backend-local ID and the exact
owner-supplied key/coordinates. Connect it to exactly one owner-selected
existing frozen node with two directed edges. The forward geometry must begin
at the selected existing node and end at the D7 node; the reverse geometry must
be the exact point-order reverse. Both geometries must be valid owner-supplied
road-following paths. Do not create a campus_routes row.

The one schedule must be `audience=all`, `status=scheduled`, attached to the
temporary building, and use an owner-approved future Asia/Manila date visible
within the public schedule window. Do not invent enrollment, assigned class,
teaching-load, or SIS data.

PER-BACKEND EXECUTION — MYSQL FIRST, THEN SUPABASE

Complete the entire MySQL lifecycle and cleanup before starting Supabase. Use
the same checklist for both legs.

Checkpoint 1 — building and structured details:

1. Start the backend-specific server and a fresh administrator browser context.
2. Pause for private owner login.
3. Open `/admin/campus-map`; verify HTTP 200, admin identity, CSRF-protected
   controls, no console/page error, and no CSP violation.
4. Search Buildings for the exact D7 name and require zero results.
5. Ask the owner to take control and create the temporary building through the
   Add Building UI using the owner-supplied image, coordinates, and structured
   details. The owner performs the final Save.
6. Resume and verify the modal closed truthfully, exactly one building exists,
   its details round-trip through Edit without loss, search/filter finds it, and
   no unexpected request or sanitized-error leak occurred.

Checkpoint 2 — linked route node:

1. Open the Nodes UI, search the exact node key, and require zero results.
2. Ask the owner to take control and create one building-linked node using the
   temporary building selected by name and the owner-supplied coordinates.
3. Resume and verify exactly one node exists, it links to the correct
   backend-local building, and search/filter displays the canonical key.

Checkpoint 3 — forward/reverse geometry edge pair:

1. Ask the owner to identify one existing frozen anchor node and provide the
   complete owner-approved forward and exact-reverse geometry plus scalar edge
   fields.
2. Confirm neither prospective directed edge already exists.
3. Ask the owner to take control and create the forward and reverse edges
   through the Routes/Nodes/Edges UI, including valid geometry.
4. Resume and verify exactly two directed edges, correct endpoints, exact
   reverse pairing, valid geometry, exact reverse geometry, no self-loop, and
   successful admin search/filter/edit display. Do not change the selected
   frozen anchor node or any frozen edge.

Checkpoint 4 — public schedule:

1. Search schedules by the exact D7 title and require zero results.
2. Ask the owner to take control and create the one `audience=all`,
   `status=scheduled` schedule through the Schedule UI using the temporary
   building selected by name and the owner-approved date/time/details.
3. Resume and verify exactly one schedule, correct building association,
   search/filter visibility, and a truthful public schedule presentation.

ADMIN VERIFICATION

Before participant testing, verify in the real admin UI:

- the building search/filter, structured Edit round trip, image preview, and
  details remain correct;
- node and edge search/filter locate the fixture;
- edge endpoints and geometry remain the owner-approved forward/exact-reverse
  pair;
- schedule search/filter locates exactly the one public entry;
- no admin page, client, or API reports an unexpected exception, CSP violation,
  or remote executable fallback;
- no unrelated building, node, edge, route, scene, hotspot, or schedule was
  mutated.

PARTICIPANT AND ROLE MATRIX

For student, guest, and instructor, use a separate fresh context and private
owner-entered login. At desktop and mobile widths:

1. Verify role/profile hydration and that no other role's profile fields leak.
2. Derive the complete reachable navigation set from the live role sidebar and
   smoke every reachable authenticated page. At minimum cover dashboard,
   buildings, map, events, about, guided CAS, Free Roam, and every additional
   role-visible destination present in the live navigation.
3. Verify shared mobile navigation opens, closes, maintains accessible state,
   supports keyboard interaction, and has no horizontal overflow.
4. Find the D7 building on Buildings and Map surfaces. Verify its owner-supplied
   image/details and public schedule are visible without admin-only data.
5. Search for and select the D7 destination. Verify pathfinding from Guard
   House/Main Gate uses the D7 node and the stored owner-supplied geometry,
   renders without a stale route claim, and never relies on an external routing
   engine.
6. Exercise map-to-guided-VR behavior. Because no scene is created, require a
   truthful unavailable/coverage-ended result and no arrival claim, fabricated
   scene, stale CAS arrival, or arbitrary fallback.
7. Verify the existing guided Guard House-to-CAS flow and Free Roam still work
   truthfully and remain distinct from the D7 no-coverage case.
8. Request `/admin` as HTML and an `/admin/api/*` endpoint as JSON. Require the
   existing authenticated wrong-role 403 contracts and no admin content leak.
9. Complete real POST logout, then verify Back, reload, and direct `/dashboard`,
   `/map`, and prior authenticated-page revisits cannot replay protected HTML or
   restore the role session.
10. Record console errors, CSP violations, unexpected CDN requests, failed
    resources, horizontal overflow, and accessibility regressions. Any
    application-caused failure makes the D7 candidate RED.

MANDATORY CLEANUP IN FINALLY

Cleanup runs even after an intermediate verification failure, but only while
the exact fixture identity remains unambiguous. Re-authenticate through the
supported admin login if necessary; never bypass auth.

Before each delete, re-fetch through the supported application interface and
require exactly one record whose natural key and critical scalar signature match
the D7 fixture created in this leg. If zero, duplicate, ambiguous, or changed,
do not guess and do not delete. Stop that cleanup step, preserve sanitized
evidence, report RED/BLOCKED, and request a separately authorized residue
diagnosis.

Delete in this exact reverse dependency order:

1. the D7 schedule;
2. the forward D7 edge;
3. the reverse D7 edge;
4. the D7 route node;
5. the D7 building;
6. terminate the administrator session through real logout.

After each deletion, require zero exact natural-key matches. Do not delete audit
rows produced by supported application actions; they are expected append-only
side effects. Do not delete or edit any frozen building, anchor node, edge,
route, VR record, schedule, account, credential, or session row.

Close all role contexts and the backend server, confirm the exact PID ended and
the port is free, and require no unexpired D7-owned session. Only after the
MySQL fixture is fully absent may the Supabase leg begin.

FINAL VERIFICATION ORDER

After both backend cleanups:

1. Re-read Git truth and SHA-256 values. Require the exact opening repository
   snapshot and all three hashes unchanged.
2. Confirm no D7 fixture natural key remains through supported application
   reads in either backend, no D7 process/listener/browser/cache/temp artifact
   remains, and ports 3500/3501 are free.
3. Run `npm test` once. With no repository change, the expected accepted
   baseline is 3495/3495 with zero `[FAIL]` and `QUALITY-GATES OK`.
4. Run `npm audit --omit=dev` once and require zero vulnerabilities.
5. Re-run the postconditions sequentially:
   - node scripts/pilotCredentialSafety-probe.js — require 24/24;
   - node scripts/probeSessionResidue-probe.js — require 18/18;
   - node scripts/be6DatasetFreeze-probe.js — require 46/46 and fingerprint
     a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d.

Do not overlap the full suite, audit, or postcondition probes. If `npm test`
ends RED, do not rerun it unchanged. Run the three read-only/supported
postcondition probes once in the stated order so residue/freeze state is known,
then stop. Do not repair, clean, or change data beyond the already authorized
exact D7 fixture cleanup.

EVIDENCE ACCOUNTING

- Keep R1-R7 focused probes, standalone residue runs, and standalone BE.6 runs
  outside every `npm test` total.
- Preserve accepted R7 evidence as 71/71 focused and 3495/3495 full suite.
  Do not replace it with the D7 post-run suite merely because the numeric total
  is expected to be the same.
- D7 browser evidence is new candidate evidence. Separate it by backend, role,
  viewport, checkpoint, cleanup, and postcondition.
- Distinguish accepted historical evidence, superseded candidates, current D7
  candidate evidence, tool-blocked cases, and red/transient commands.
- Report every failed, retried, skipped, cancelled, or blocked action. Never
  hide a red run behind a later green run.

FINAL REPORT

Return one self-contained report containing:

1. capabilities available/used/unavailable and code-review method;
2. files read completely and files inspected only in part;
3. exact opening and closing Git truth and the three hashes;
4. opening gate results in order: 24/24, 18/18, 46/46 plus fingerprint;
5. server/browser lifecycle, ports, exact-PID cleanup, and browser availability;
6. sanitized owner checkpoints and the natural-key fixture contract used,
   without credentials, tokens, IDs, raw rows, or complete geometry;
7. MySQL and Supabase admin lifecycle results;
8. student/guest/instructor desktop/mobile and all-reachable-page results;
9. routing, schedule, guided-VR truth, authorization, CSP/PWA, logout, and
   session-isolation results;
10. exact reverse-order cleanup proof for each backend and every residue;
11. `npm test`, audit, and final 24/24 -> 18/18 -> 46/46 results with strict
    standalone accounting;
12. every red, transient, retry, skipped, blocked, or tool-limited action;
13. explicit confirmation that no repository file, package manifest, database
    schema/migration, account/credential, frozen data, unrelated row, deployment
    state, or Git state changed;
14. final status: D7 candidate awaiting independent Codex review, or
    RED/BLOCKED/TOOL-BLOCKED. No D7 GO may be claimed.

Stop after the report. R8 remains blocked until independent Codex D7 GO. Even a
future R8 GO authorizes only a separate owner deployment decision.
~~~

## Historical Spent One-Shot R7 Execution Prompt

The fenced prompt below is the exact authority `M12.P1-R7` was executed under.
It has now been SPENT and must not be replayed. It is retained verbatim under
this heading so a reviewer can check the delivered work against the authority
it ran under. The prompt itself never granted R7 GO; independent Codex review
later did. It authorizes neither expanded D7 nor deployment.

~~~text
M12.P1-R7 — Vercel Package and Static-CDN Boundary

Work in:

C:\Users\FROST.GG\Desktop\CampuSphere v1

AUTHORITY AND STOP BOUNDARY

This prompt explicitly authorizes only M12.P1-R7. M12.P1-R6 is complete and
Codex GO. R7 is the next owner-authorized code section and is not started.

Do not begin expanded D7 or R8. Do not deploy, link a Vercel project, create
.vercel project metadata, run a Vercel build, upload a package, or claim R7 GO.
R7 cannot receive GO from its implementer. Stop after the final R7 candidate
report and wait for independent Codex review.

M12.P1 remains NO-GO for deployment and pilot readiness. Even a future R8 GO
authorizes only a separate owner deployment decision. OFF.2-OFF.6 remain
mandatory after pilot review.

Preserve the intentionally dirty worktree. Do not stage, commit, stash, reset,
checkout, clean, revert, restore, or overwrite inherited changes. Do not create
a branch or tag. Do not spawn subagents.

Before editing, record read-only Git truth:

- HEAD and branch;
- git status --short and porcelain count;
- staged name-status;
- unstaged tracked name-status;
- compact untracked-entry count;
- expanded untracked-file count;
- stash count.

The expected opening snapshot is HEAD 5cce682 on main, 161 porcelain entries,
13 staged paths, 76 unstaged tracked paths, 81 compact untracked entries, 304
expanded untracked files, and zero stashes. Verify rather than trust these
numbers. If the live repository differs, report the difference and preserve the
live state; do not normalize it.

CAPABILITIES

1. Inspect the skills, plugins, MCP servers, browser surfaces, and other
   capabilities actually available in the fresh Claude Code session.
2. Use the code-review skill before every code, security, performance,
   correctness, maintainability, testing, deployment, or documentation finding.
   If it is unavailable or would delegate to subagents, report that fact and
   review inline in this order: security, performance, correctness,
   maintainability, testing.
3. Use Context7 to verify current official Vercel documentation for
   `.vercelignore`, root Express/Node detection, `vercel.json` header matching,
   and response-header precedence before editing.
4. Use safe filesystem and shell inspection. Browser/Playwright verification is
   not required for this package-boundary section because it must not change
   browser-visible application behavior. Do not start a browser merely because
   one is installed.
5. Do not use Vercel, Supabase, Upstash, or Cloudinary APIs directly. The
   existing authorized read-only/supported probes may use their configured
   application boundaries during the verification sequence below.
6. Do not run `npm install`, `npm update`, `npm audit fix`, `npx vercel`, or any
   command that installs or mutates dependencies. Do not change package.json or
   package-lock.json.
7. Do not apply SQL, create migration 0020, mutate accounts or credentials,
   repair datasets, directly delete session rows, or perform cleanup that is not
   already owned by a supported probe through its real application interface.
8. Never start `node server.js`, `npm start`, or `npm run dev` in the foreground.
   Use `scripts/with-server.js` for application HTTP probes and a bounded
   self-terminating listener for the new static-boundary probe.

READ COMPLETELY AND IN THIS ORDER

1. CODEX_HANDOFF.md:
   - authoritative current-status block;
   - Current Truth;
   - Current M12.P1 Stop Point;
   - accepted R6 Codex GO closeout;
   - current R7 sequencing;
   - historical/archived prompt boundaries.
2. CLAUDE_HANDOFF.md:
   - authoritative current-status block;
   - this complete current R7 execution prompt;
   - the spent R6 prompt as history only;
   - R3-R6 and dependency-security closeouts.
3. plan.md in full, especially:
   - Summary and current status;
   - M12.P1 R1-R8;
   - the complete R7 contract;
   - expanded D7;
   - Interfaces and Contracts;
   - Anti-Scope;
   - Assumptions;
   - pilot and post-pilot sequencing.
4. AGENTS.md.
5. CLAUDE.md.
6. ROADMAP.md, especially Milestones 12-13, M12.P1, deferred OFF.2-OFF.6,
   and the R7 -> expanded D7 -> R8 sequence.
7. docs/new-session-grounding-prompts.md.
8. docs/deployment.md.
9. docs/security-checklist.md.
10. docs/test-evidence.md.
11. package.json and the complete relevant package-lock.json entries, without
    changing either file.
12. server.js and scripts/with-server.js. Confirm that server.js exports the
    Express app and only performs its local listen path when it is the main
    module; do not add a legacy Vercel adapter or an api/ duplicate.
13. .gitignore, .dockerignore, Dockerfile, and the complete root inventory.
14. The complete public tree, especially:
    - public/img/sample 360/**;
    - public/vendor/** and public/vendor/manifest.json;
    - public/sw.js;
    - public/offline.html;
    - public/manifest.webmanifest;
    - public/css/offline.css;
    - public/img/icons/**.
15. Every existing Vercel configuration surface. The expected pre-R7 state is
    that `.vercelignore`, `vercel.json`, `.vercel/`, and api/ do not exist.
16. config/vercelProductionProfile.js, config/sessionConfig.js,
    services/sessionReadiness.js, services/rateLimitStore.js,
    services/supabaseSessionStore.js, and services/mysqlSessionStore.js.
17. middleware/securityHeaders.js and
    middleware/authenticatedHtmlNoStore.js.
18. scripts/vercelProductionProfile-probe.js,
    scripts/vercelRuntimeSessionBootstrap-probe.js,
    scripts/sharedRateLimit-probe.js,
    scripts/boundedAnonymousAccessDenial-probe.js, and
    scripts/selfHostedBrowserDependencies-probe.js.
19. scripts/pilotCredentialSafety-probe.js,
    scripts/probeSessionResidue-probe.js,
    scripts/be6DatasetFreeze-probe.js,
    scripts/probeSessionLifecycle.js, and
    scripts/regressionCredentials.js.
20. scripts/quality-gates.js in full, focusing on:
    - existing Vercel production-profile gates;
    - CSP/PWA/sample-360/vendor gates;
    - standalone-probe accounting;
    - documentation-current predicates and fixtures;
    - current execution-prompt extraction/validation;
    - residue-final-order and session-ownership contracts.
21. The complete database/supabase/*.sql filename list. It must remain exactly
    0001 through 0019.
22. Read-only Git truth and package-manifest hashes immediately before the
    precondition probes.

AUTHORITATIVE CURRENT TRUTH

- Milestones 8-11, RF.1-RF.6, BE.1-BE.6, and OFF.1 are complete and Codex GO.
- The M12.P1 readiness/exposure audit remains Codex NO-GO after one critical
  and six high blockers.
- R1-R6 and D1-D5 are complete and Codex GO.
- R6 self-hosts Leaflet 1.9.4, MapLibre GL JS 4.7.1, Pannellum 2.5.6, Iconify
  Icon 1.0.7, and Lucide 1.25.0 under public/vendor; the reviewed manifest and
  independent EXPECTED_VENDOR_INVENTORY pin exact provenance and shipped bytes.
- Accepted R6 evidence is focused 230/230, full suite 3415/3415 with
  QUALITY-GATES OK, independent desktop/mobile affected-page and
  missing-library browser verification green, safety 24/24, residue 18/18,
  BE.6 46/46 with the frozen fingerprint unchanged, and
  `npm audit --omit=dev` at zero vulnerabilities.
- The historical post-R5/pre-R6 RED run and its 22/24 safety result are
  superseded evidence. Do not treat them as the current baseline or rerun an
  unchanged red check.
- R7 is the next owner-authorized code section and is not started.
- Expanded D7 remains blocked until independent R7 Codex GO. D7 then runs
  before the read-only R8 review.
- Deployment remains unauthorized.
- Supabase migrations are exactly 0001-0019. No migration 0020 exists or is
  authorized.
- The frozen selected-demo truth remains 13 buildings, 20 route nodes, 48
  directed edges, 24 exact reverse pairs, 48 valid geometries, 13 routable
  destinations, 85 VR scenes, and 66 hotspots.
- The BE.6 fingerprint is:
  a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d
- Supabase is the production data/session target; MySQL is local development,
  fallback, and rehearsal. Supabase Auth is not used.
- Preserve Express sessions, bcrypt, Google OAuth, roles, CSRF, nonce CSP,
  shared rate limits, sanitized errors, PWA privacy, owner-controlled
  Cloudinary delivery, routing, schedules, and truthful VR arrival.
- R1-R6 focused probes are standalone and never counted inside an npm-test
  total. The new R7 focused probe must also remain standalone.

CURRENT EXECUTION PRECONDITION — CHECK BEFORE ANY R7 EDIT

Run these sequentially, never concurrently:

1. `node scripts/pilotCredentialSafety-probe.js` — require exactly 24/24.
2. `node scripts/probeSessionResidue-probe.js` — require exactly 18/18.
3. `node scripts/be6DatasetFreeze-probe.js` — require exactly 46/46 and the
   frozen fingerprint unchanged.

If any precondition is not green, stop without editing and report the blocker.
Do not rerun an unchanged red command merely hoping for green. This R7 prompt
does not authorize session cleanup, revocation, direct session-row deletion,
database repair, dataset repair, account repair, credential changes, or
migration changes.

PACKAGE-MANIFEST IMMUTABILITY

Before editing, record SHA-256 and require:

- package.json:
  8291bcba01370e529bc756dc122a4166d2b9ade1a9c1f0a81f5af2a00b5e5c4e
- package-lock.json:
  88bd470464bf0fc4fb5dc5c371588db3a655c4b67cf8d82a0e0dea5e81f33d61

Verify the same hashes again at the end. Do not edit, regenerate, format, or
normalize either file.

IMPLEMENTATION CONTRACT

1. Create a root `.vercelignore` using an allowlist, in this exact structural
   order:

   - begin with `/*`;
   - re-include `server.js`, `package.json`, `package-lock.json`, and
     `vercel.json`;
   - re-include each required runtime directory and its descendants:
     `config`, `controllers`, `middleware`, `models`, `repositories`, `routes`,
     `services`, `utils`, `views`, and `public`;
   - after the public re-inclusion, deny `public/img/sample 360/**`.

   Use explicit parent and descendant negations where Git-ignore semantics
   require them. Do not include `.env`, `.env.*`, `.env.example`, docs,
   handoffs, scripts/tests, database files or migrations, screenshots/evidence,
   Docker files, local agent metadata, node_modules, logs, caches, temporary
   material, Git metadata, or unrelated workspace files.

2. Create a minimal root `vercel.json` with exactly these top-level keys:

   - `$schema`: `https://openapi.vercel.sh/vercel.json`
   - `headers`

   Do not add `builds`, `functions`, `routes`, `rewrites`, redirects, an output
   directory, framework override, install command, build command, or a catch-all
   response-header rule.

3. The `headers` array must contain only narrowly scoped static/PWA rules:

   - `/css/:path*`, `/js/:path*`, `/img/:path*`, `/vendor/:path*`, and
     `/manifest.webmanifest`: `X-Content-Type-Options: nosniff`;
   - `/sw.js`: `Cache-Control: no-cache`, `Service-Worker-Allowed: /`, and
     `X-Content-Type-Options: nosniff`;
   - `/offline.html`: `X-Content-Type-Options: nosniff`,
     `Referrer-Policy: no-referrer`, and this fixed static-only CSP:
     `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'none'; style-src 'self'; img-src 'self' data:; manifest-src 'self'; connect-src 'none'; worker-src 'none'`.

   Do not set long-lived immutable caching because these asset URLs are not
   content-hashed. Do not define CSP for `/`, `/:path*`, dynamic routes, or any
   broad matcher. Express's existing per-response nonce CSP remains the sole CSP
   authority for dynamic application responses.

4. Do not create api/, a Vercel adapter, or a second app entrypoint. Preserve
   the current server.js export/local-listen contract.

5. Add `scripts/vercelPackageBoundary-probe.js` as a standalone, database-free,
   external-network-free, session-free, read-only repository probe. It must:

   - export pure analyzers/constants that the in-suite gate can drive;
   - pin the expected allowlisted root files/directories and forbidden path
     classes independently of `.vercelignore` and `vercel.json`;
   - parse and validate the actual ignore and header configurations fail closed;
   - normalize paths to forward slashes and reject absolute paths, traversal,
     duplicates, case-fold collisions, ambiguous separators, and malformed
     space/encoding variants;
   - enumerate only the package candidate, never print ignored filenames, and
     emit a deterministic console-only preview with normalized included paths,
     file count, byte totals, per-file SHA-256, and one aggregate SHA-256;
   - label that output `CURRENT DIRTY-WORKTREE BOUNDARY PREVIEW — NOT AN
     IMMUTABLE DEPLOYMENT MANIFEST`;
   - never write a package manifest or deployment archive into the repository.

6. The focused probe must create an external temporary static root containing
   only the allowed public files, start one bounded listener on a verified-free
   dedicated port, and prove:

   - representative CSS, JS, icon, manifest, offline shell, service worker,
     normal image, and all 18 vendored runtime files return 200 with
     byte-identical bodies;
   - a missing normal asset returns 404;
   - both decoded-space and percent-encoded requests targeting
     `public/img/sample 360/**` return 404;
   - no redirect or fallback exposes an excluded file.

   Close the exact listener and delete the exact temporary directory in
   `finally`. Never blanket-kill node.exe.

7. Add an in-suite `vercel-package-boundary` gate to
   `scripts/quality-gates.js`. It must drive the same real analyzers and add
   independent negative fixtures for:

   - missing or altered root `/*`;
   - an added `.env*`, docs/handoff, scripts/tests, database/migration,
     screenshot/evidence, Docker, local-tool, temporary, node_modules, or
     `sample 360` inclusion;
   - a missing required root file, runtime directory, public asset class, or
     vendor file;
   - duplicate, reordered-to-broaden, traversal, slash, case, or encoded-space
     ambiguity;
   - an extra `vercel.json` top-level key;
   - a missing, duplicate, broadened, or altered header rule;
   - a catch-all/dynamic CSP;
   - `builds`, `functions`, routes, rewrites, redirects, framework/build/install
     overrides;
   - a falsified manifest count, size, per-file hash, or aggregate hash.

   A coordinated config-plus-preview edit must still fail unless the independent
   expected contract in probe code is explicitly reviewed and changed.

8. Keep the focused R7 probe standalone. Do not register or count it in
   `npm test`. Preserve R1-R6 standalone accounting and keep
   `scripts/probeSessionResidue-probe.js` exactly once and last in the suite.

9. Update only the documentation and authority predicates required to record
   the R7 implementation candidate after all required verification is green:

   - R6 remains complete and Codex GO;
   - R7 becomes `implemented and awaiting independent Codex review`;
   - no R7 GO is claimed;
   - expanded D7 remains blocked by R7 Codex GO;
   - M12.P1 remains NO-GO and deployment remains unauthorized;
   - the current R7 execution prompt becomes spent/historical;
   - the resulting focused/full-suite counts and manifest preview are recorded
     exactly, without inventing totals.

   This is the only authorized status-only synchronization exception for
   plan.md. Preserve older R6 and RED runs as accepted/superseded/history with
   their original accounting.

10. Do not change application views, browser vendor bytes, CSP middleware,
    service-worker behavior, authentication, authorization, sessions, rate
    limiting, data repositories, database schemas, migrations, accounts,
    credentials, routing, schedules, VR data, or Cloudinary behavior. If the
    package boundary cannot be implemented without such a change, stop and
    report the blocker instead of broadening R7.

REQUIRED VERIFICATION ORDER

Never overlap session-writing probes. Stop on the first unexplained red result;
diagnose and fix only an R7-caused defect within scope. Do not repair unrelated
red state.

1. Record initial Git truth and package.json/package-lock.json SHA-256.
2. Run the three preconditions in the stated order: safety 24/24, residue
   18/18, BE.6 46/46 with the fingerprint unchanged.
3. Implement R7.
4. Run `node --check` on every changed JavaScript file.
5. Run the focused standalone R7 probe once.
6. Run these standalone regression probes sequentially:
   - `node scripts/vercelProductionProfile-probe.js` — require 119/119;
   - `node scripts/vercelRuntimeSessionBootstrap-probe.js` — require 86/86;
   - `node scripts/sharedRateLimit-probe.js` — require 180/180;
   - `node scripts/boundedAnonymousAccessDenial-probe.js` — require 90/90;
   - `node scripts/selfHostedBrowserDependencies-probe.js` — require 230/230.
7. Run `npm test` once and require zero failures plus `QUALITY-GATES OK`.
8. Run `npm audit --omit=dev` and require zero vulnerabilities.
9. Re-run, sequentially:
   - safety 24/24;
   - residue 18/18;
   - BE.6 46/46 with the fingerprint unchanged.
10. Run the R7 focused probe's final console-only package preview and confirm no
    listener, temporary directory, archive, generated manifest, `.vercel`
    metadata, or package residue remains.
11. Confirm package.json and package-lock.json retain their exact opening hashes.
12. Record final Git truth and attribute every changed or new path to R7.

If a command is red because of a newly authored R7 gate or fixture, disclose the
exact failure, fix the gate only when the contract was implemented correctly,
and rerun once. Never weaken a gate to accept unsafe package contents. Report
every red, transient, skipped, unavailable, or blocked action.

FINAL REPORT

Return:

1. Capabilities used and unavailable.
2. Files read completely and files inspected only in part.
3. Initial and final Git truth.
4. Exact changed/new files and why.
5. `.vercelignore` allowlist and excluded-class proof.
6. `vercel.json` header rules and proof that dynamic Express CSP is untouched.
7. Focused R7 results and console-only package preview: included path count,
   byte total, aggregate SHA-256, and explicit dirty-worktree/non-deployable
   label.
8. Negative-fixture and static-boundary 200/404 evidence.
9. Every verification result with strict standalone/full-suite accounting.
10. Package-manifest opening/final hashes.
11. Every red/transient/skipped/blocked action and its disposition.
12. Confirmation that no Vercel link/build/deploy/API action, `.vercel`
    metadata, package upload/archive, SQL/migration, live-data repair,
    session-row deletion, account/credential change, dependency mutation,
    browser run, or Git-state mutation occurred.
13. Final status exactly in substance:

    `M12.P1-R7 is implemented and awaiting independent Codex review. No R7 GO
    is claimed. Expanded D7 is not started and remains blocked by R7 Codex GO.
    M12.P1 remains NO-GO for deployment and pilot readiness; deployment is not
    authorized.`

Stop after the report. Do not continue to D7, R8, clean-snapshot creation,
Vercel linkage, or deployment.
~~~

## Historical Spent One-Shot R6 Execution Prompt

The fenced prompt below is the exact authority M12.P1-R6 was executed under. It
has now been SPENT: R6 is complete and Codex GO, so
the prompt must not be replayed. It is retained verbatim under this heading so a
reviewer can check the delivered work against the authority it ran under. It
never granted R6 GO, and it authorizes neither R7 nor deployment.

~~~text
You are Claude Code a senior developer implementor executing exactly one narrowly scoped CampuSphere
deployment-readiness section:

M12.P1-R6 — Self-Hosted Browser Dependencies

Work in:
C:\Users\FROST.GG\Desktop\CampuSphere v1

AUTHORITY AND STOP BOUNDARY

This prompt explicitly authorizes only R6: reviewed same-origin browser vendor
assets, the affected views and client-side missing-library guards, the CSP and
service-worker wording required by those assets, a focused standalone R6 probe,
the in-suite R6 quality gate, and synchronized candidate-status documentation
only after every required verification is green.

Do not start R7 or any later R/D/OFF section. Do not deploy, link Vercel, create
or edit .vercel project metadata, access live Upstash or Cloudinary APIs, apply
SQL, query or repair live data directly, create migration 0020, change accounts
or credentials, delete session rows directly, install dependencies, edit
package.json or package-lock.json, or perform any Git state-changing operation.
Do not repair unrelated findings. Preserve the intentionally dirty worktree and
every inherited edit. Do not stage, commit, stash, reset, checkout, clean,
revert, or overwrite another contributor's changes. Do not spawn subagents.

R5, its authoritative-global-total follow-up, and its documentation-gate final
correction are complete and Codex GO. R6 is the next owner-authorized code
section and is not started. R7 remains blocked by R6 Codex GO. M12.P1 remains
NO-GO for deployment and pilot readiness. Even a future R8 GO authorizes only a
separate owner deployment decision.

CURRENT EXECUTION PRECONDITION — CHECK BEFORE ANY R6 EDIT

The documentation/authority synchronization that produced this prompt ran one
full-suite candidate. It ended RED with nine failures after Supabase logout/
session-destroy failures left unexpired canonical administrator and student
sessions. The distinct post-run safety check is 22/24, the embedded residue gate
is red, and the embedded BE.6 check did not establish its frozen postcondition.
No R6 code caused these failures, but the current state is not a valid clean
starting baseline.

This prompt does not authorize session cleanup, revocation, direct session-row
deletion, database repair, or dataset repair. Before any R6 edit, require a
separately owner-authorized supported cleanup/restoration action and then verify
credential/session safety 24/24, canonical residue 18/18, and BE.6 46/46
sequentially. If any precondition is not green, stop without editing and report
the blocker. Do not rerun an unchanged red check merely hoping for green.

CAPABILITIES

Before acting, inspect the skills, plugins, MCP servers, browser surfaces, and
other capabilities actually available in this Claude Code session. Use a
non-delegating code-review/security skill before findings when one exists. If
the available review skills require subagents, report that limitation and
review inline in this order: security, performance, correctness,
maintainability.

Use Context7 or primary project documentation for the exact browser libraries.
Use official npm registry metadata and exact public package tarballs for
provenance, versions, contents, and licenses. Public network access is permitted
only for those official documentation/registry/package-acquisition needs.
Acquire with npm view/npm pack into an external scratch directory; do not run
npm install, npm update, npm audit fix, or change either package manifest.

Browser/Playwright verification is required for R6 because static scans cannot
prove runtime loading, CSP, layout, or missing-asset behavior. Use only the
local application and no external authenticated service. If no usable browser
surface is available, complete only defensible in-scope static work, report R6
browser verification as blocked, do not claim the required evidence is green,
and do not synchronize status documents to "awaiting independent Codex review."

READ COMPLETELY AND IN THIS ORDER

1. CODEX_HANDOFF.md
2. CLAUDE_HANDOFF.md
3. plan.md, especially Current Status/Summary, M12.P1 R1-R8, D1-D7,
   Interfaces and Contracts, Anti-Scope, and Assumptions
4. AGENTS.md
5. CLAUDE.md
6. ROADMAP.md, especially the routing/privacy/pilot gates, M12.P1, deferred
   OFF.2-OFF.6, and Milestones 12-13
7. package.json and the relevant complete package-lock.json dependency entries
8. server.js and scripts/with-server.js
9. middleware/securityHeaders.js
10. public/sw.js and the complete current public/vendor tree
11. These affected views:
    - views/admin/campus-map.ejs
    - views/admin/faqs.ejs
    - views/admin/index.ejs
    - views/admin/logs.ejs
    - views/admin/news.ejs
    - views/admin/settings.ejs
    - views/admin/users.ejs
    - views/admin/vr.ejs
    - views/about.ejs
    - views/dashboard.ejs
    - views/events.ejs
    - views/home.ejs
    - views/map.ejs
    - views/vr.ejs
    - views/vr-route.ejs
12. Every relevant map, VR, Iconify, and Lucide client script and existing
    missing-library guard used by those views
13. scripts/quality-gates.js, focusing on CSP, PWA, Leaflet/vendor,
    documentation-current, and executed-stage-plan gates
14. Existing map, VR, admin-page, CSP, PWA, browser, session-lifecycle, safety,
    residue, and BE.6 probes relevant to the affected surfaces
15. docs/deployment.md, docs/security-checklist.md, docs/test-evidence.md, and
    docs/new-session-grounding-prompts.md
16. The complete database/supabase/*.sql filename list
17. Read-only Git truth: git status --short; porcelain count; staged and
    unstaged name-status summaries; compact and expanded untracked counts;
    stash count; branch; and current HEAD

Verify rather than trust this expected opening snapshot: HEAD 5cce682, branch
main, 161 porcelain entries, 13 staged paths, 76 unstaged tracked paths, 81
compact untracked entries, 284 expanded untracked files, and zero stashes.
Preserve the snapshot except for the exact authorized R6 file additions/edits.

PRESERVED AUTHORITY AND DATA TRUTH

- Milestones 8-11, RF.1-RF.6, BE.1-BE.6, OFF.1, R1-R5, D1-D5, and the
  dependency-security remediation are complete and Codex GO.
- Accepted R5 closeout evidence is focused 90/90, full suite 3234/3234 with
  QUALITY-GATES OK, credential/session safety 24/24, canonical residue 18/18,
  BE.6 46/46, and npm audit --omit=dev at zero vulnerabilities. R1-R5 are
  standalone and are never part of the npm-test total.
- Supabase migrations are exactly 0001-0019; 0014-0019 are owner-applied. No
  migration 0020 exists or is authorized.
- Both backends retain 13 selected-demo buildings, 20 route nodes, 48 directed
  edges, 24 exact reverse pairs, 48 valid geometries, 24 exact reverse
  geometries, and 13 routable destinations.
- VR remains 85 scenes and 66 hotspots. CAS retains the verified 24-scene
  guided route and schedule target. CCS remains map-routable with truthful
  guided-VR deferral.
- The BE.6 fingerprint is
  a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d.
- Routing uses CampuSphere's own campus graph and owner-managed path_geometry.
  It has no Google Maps, Google Earth, Strava, SIS, or external routing-engine
  dependency.
- Preserve Supabase production data/session targets, MySQL local/fallback
  behavior, Express sessions, bcrypt, Google OAuth, roles, CSRF, CSP, rate
  limits, sanitized errors, PWA privacy, owner-controlled Cloudinary delivery,
  schedules, routing, and truthful VR arrival.

REPOSITORY-OBSERVED R6 SURFACE

The current public/vendor tree already contains
public/vendor/leaflet/leaflet.js. It is the reviewed Leaflet 1.9.4 distribution
with only its trailing sourceMappingURL reference removed. Preserve those exact
bytes; do not replace it with a newly unpacked copy.

Remote executable/style dependencies currently occur at these boundaries:

- Lucide from unpkg using @latest in the eight admin views listed above.
- Iconify Icon 1.0.7 component script in about, dashboard, events, and home.
- Pannellum 2.5.6 JavaScript/CSS in vr.ejs and vr-route.ejs.
- Leaflet 1.9.4 CSS in admin campus-map, dashboard, home, and map; Leaflet
  marker URLs in map.ejs still point to remote assets.
- MapLibre GL JS 4.7.1 JavaScript/CSS in map.ejs.

Google Fonts may remain. Approved OpenStreetMap tile delivery, the existing
Iconify data API, and owner-controlled Cloudinary delivery may remain only
where the runtime genuinely requires them. They are data/media/font delivery,
not permission for remote executable JavaScript or stylesheets.

The current CSP permits executable/style CDN origins for these libraries.
R6 must remove obsolete unpkg/jsDelivr/code.iconify executable origins without
weakening nonces or any other directive. Preserve only the exact approved
Google Fonts, OSM tiles, Iconify data, Cloudinary, self, and required self/blob
worker boundaries. Do not broaden connect-src, img-src, media-src, worker-src,
or any other directive speculatively.

IMPLEMENTATION CONTRACT

Self-host these exact versions under public/vendor:

- Leaflet 1.9.4
- MapLibre GL JS 4.7.1
- Pannellum 2.5.6
- Iconify Icon 1.0.7
- Lucide 1.25.0

Use exact public npm tarballs in an external scratch directory. Copy only the
runtime distribution assets and license notices required by the application:

- Leaflet: preserve the existing leaflet.js; add matching leaflet.css, the five
  distribution images (layer controls, marker images, and marker shadow), and
  LICENSE.
- MapLibre: add the exact UMD maplibre-gl.js, maplibre-gl.css, and license.
  Add a separate worker only if the exact 4.7.1 UMD runtime demonstrably
  requests it; do not add speculative worker machinery.
- Pannellum: add its exact built JavaScript/CSS, COPYING/license, and every
  image referenced by that CSS, keeping relative paths valid.
- Iconify Icon: add its exact minified component bundle and license.
- Lucide: add its exact minified UMD bundle and license.

Add public/vendor/manifest.json as the machine-readable acquisition record.
For each shipped file record package name, exact version, registry/tarball
provenance or integrity, source path in the tarball, destination path, license,
and SHA-256 of the final shipped bytes. Record the existing Leaflet
sourceMappingURL-only transformation explicitly. Never record local paths,
credentials, tokens, cookies, or private registry state.

Replace every affected remote executable script and stylesheet reference with
the corresponding same-origin /vendor path. Preserve load order and the global
interfaces already used by the app: L, maplibregl, pannellum, lucide, and the
Iconify custom element. Remove hard-coded remote Leaflet marker URLs and let the
local matching CSS/images resolve normally.

Missing assets must degrade truthfully without hiding a defect:

- Guard every lucide.createIcons invocation so a missing Lucide bundle does not
  break the rest of the page.
- A missing map renderer must show or retain the existing fixed unavailable
  state rather than throwing, drawing stale route state, or silently swapping
  to an unapproved remote dependency.
- A missing Pannellum bundle must leave a truthful VR-unavailable state rather
  than reporting arrival or a successful panorama.
- Iconify absence must not remove essential text, navigation labels, or actions.

Update public/sw.js only to remove obsolete CDN commentary and keep its current
same-origin/static behavior accurate. Do not expand OFF scope, cache
authenticated pages, precache private content, or claim offline navigation.

Do not change package.json, package-lock.json, application APIs, database
schemas, migrations, session/authentication policy, rate-limit behavior,
routing/schedule data, or the BE.6 freeze.

FOCUSED AND IN-SUITE GATES

Create scripts/selfHostedBrowserDependencies-probe.js as the standalone R6
probe. It must be self-terminating and must not be registered in npm test. If it
authenticates canonical identities, use scripts/probeSessionLifecycle.js,
register each jar immediately after login, and terminate through the real
logout interface from an outermost finally.

Add an in-suite R6 static/HTTP gate that fails closed and proves:

- The exact five package versions, expected runtime files, licenses, manifest
  provenance, and final SHA-256 hashes.
- The preserved existing Leaflet JavaScript bytes and documented transformation.
- Every affected view uses the exact intended same-origin asset.
- No @latest, unpkg/jsDelivr/code.iconify executable URL, or other remote
  executable script/stylesheet remains outside the explicit Google Fonts
  exception.
- CSP drops the obsolete executable/style origins while preserving nonce,
  approved data/media/font origins, and required worker behavior.
- Leaflet marker paths, Pannellum CSS image paths, and all manifest destinations
  resolve locally.
- A missing vendor path returns 404 and no fallback contacts an executable CDN.
- package.json and package-lock.json remain unchanged.
- The service-worker privacy/offline boundary remains unchanged.
- R1-R6 focused probes remain standalone and the residue gate remains exactly
  once and last in the actual executed stage plan.

Include negative fixtures that remove or alter a version, hash, license, view
reference, CSP contraction, standalone-probe boundary, and approved-origin
allowlist. Fixtures must drive the same production analyzer as live assertions.

BROWSER VERIFICATION

Browser verification is mandatory and local-only. Cover:

- All eight affected administrator pages.
- Home, dashboard, about, and events.
- /map in both Leaflet and MapLibre renderer modes.
- Free Roam VR and one valid guided route.
- Desktop 1440x900 and mobile 390x844.
- Console errors, CSP violations, network requests, global-library availability,
  essential labels/actions, and layout.

Simulate each missing vendor family through browser request interception. Do not
rename, delete, or overwrite repository assets for a negative case. Confirm the
truthful missing-library behavior and that no executable CDN request occurs.

Do not run node server.js, npm start, or npm run dev in the foreground. Use
scripts/with-server.js for HTTP/contract probes. For browser work, use the
agent runner's native background/async process facility, a dedicated verified-
free port, and the exact spawned PID. Stop that PID in finally and confirm the
port is free. Never blanket-kill node.exe and never use detached/unref or
hand-rolled Windows process workarounds.

VERIFICATION ORDER AND ACCOUNTING

Run sequentially, never overlapping a session-writing browser/probe run with
npm test:

1. node --check for every changed/created JavaScript file.
2. Read-only credential/session safety and canonical residue preconditions.
3. The focused standalone R6 probe once; report its actual total.
4. Standalone R2, R3, R4, and R5 regression probes.
5. The required browser matrix and intercepted missing-asset cases.
6. One npm test full-suite run.
7. Read-only credential/session safety and canonical residue postconditions.
8. Standalone BE.6 freeze probe.
9. npm audit --omit=dev.
10. Final Git truth, changed-file review, secret/raw-identity scan, process/
    listener/port checks, licenses, hashes, and package-manifest byte checks.

R1-R6, residue reruns, and standalone BE.6 are not part of the npm-test total.
Do not double-count them. Record every red, transient, blocked, or cancelled
command. Never rerun an unchanged red test merely hoping for green. Repair only
an R6-caused or R6-gate defect inside this authorization; report unrelated
failures without changing them.

DOCUMENTATION AND FINAL STATUS

Do not claim R6 GO. If any required check or browser capability is red/blocked,
do not promote current authority documents. Preserve the evidence and report
the blocker.

Only after every required check is green, synchronize the current status and
exact observed evidence in CODEX_HANDOFF.md, CLAUDE_HANDOFF.md, plan.md,
ROADMAP.md, AGENTS.md, CLAUDE.md, docs/deployment.md,
docs/security-checklist.md, and docs/test-evidence.md. The synchronized status
must be:

"M12.P1-R6 is implemented and awaiting independent Codex review. No GO is
claimed. R7 is not started and remains blocked by R6 Codex GO. M12.P1 remains
NO-GO for deployment and pilot readiness."

Retarget the documentation-current gate and fixtures to that candidate state.
Preserve all historical/superseded totals and record only actual new counts.
Do not alter the two context-only prompts to authorize implementation.

FINAL REPORT

Return:

1. Capabilities/skills/MCP/browser surfaces used and unavailable.
2. Files read completely and partially.
3. Initial and final Git truth.
4. Every changed/created file and why.
5. Exact vendor package/version/file/license/provenance/hash inventory.
6. Every replaced remote reference and the final approved external-origin list.
7. CSP and service-worker changes.
8. Missing-asset and browser evidence for every required surface/viewport.
9. Focused R6, regression probes, full-suite, safety/residue, BE.6, and audit
   results with strict standalone accounting.
10. Every red/transient/blocked command, fully attributed.
11. Confirmation that no prohibited action occurred and all ports/processes
    were cleaned up.
12. Final status.

Stop after the report. Do not begin R7 and do not claim Codex GO.
~~~

## Historical One-Shot R5 Execution Prompt (already executed; not current authority)

The prompt below has been executed. It is retained as a historical record of
the exact authorization R5 ran under. It grants no further authority, and it
must not be replayed to start R6 or any later section.

~~~text
You are Claude Code executing one narrowly scoped CampuSphere security and
test-harness section:

M12.P1-R5 — Bounded Anonymous Access-Denial Auditing

Work in:
C:\Users\FROST.GG\Desktop\CampuSphere v1

This prompt explicitly authorizes only the R5 production-code, focused-probe,
quality-gate, and status-documentation changes described below. It does not
authorize R6 or later work, deployment, Vercel linkage, browser testing,
Cloudinary access, live Upstash access, migrations, direct SQL, direct database
repair, Git state changes, or unrelated repairs.

Do not spawn subagents. Preserve the intentionally dirty worktree. Do not
stage, commit, stash, reset, checkout, clean, revert, or overwrite inherited
changes. Use editing operations only on files required by R5.

CAPABILITIES

1. Inspect the skills, plugins, MCP servers, and browser capabilities actually
   available in this Claude session.
2. Use a non-delegating code-review/security skill before every finding if one
   exists. If installed review skills require subagents, report that limitation
   and perform the review inline in this order:
   security -> performance -> correctness -> maintainability.
3. Use Context7 or primary official documentation only when a current external
   contract genuinely requires it. R5 should be decidable primarily from live
   repository evidence.
4. Do not use a browser or Playwright.
5. Live repository evidence overrides this prompt, screenshots, memory, and old
   reports. If a conflict changes the authorized scope, stop and report it.

READ COMPLETELY IN THIS ORDER

1. CODEX_HANDOFF.md
2. CLAUDE_HANDOFF.md
3. plan.md:
   - Current Status and Summary
   - M12.P1 and R1-R8
   - D1-D7
   - Interfaces and Contracts
   - Anti-Scope
   - Assumptions
4. AGENTS.md
5. CLAUDE.md
6. ROADMAP.md:
   - routing/privacy/pilot gates
   - Milestones 12-13
   - deferred OFF.2-OFF.6
   - current M12.P1 sequence
7. package.json and relevant package-lock.json entries
8. server.js plus config/authDataSource.js, config/contentDataSource.js, and
   config/sessionConfig.js
9. middleware/roleAuth.js
10. services/auditService.js
11. repositories/auditRepository.js
12. controllers/authController.js
13. controllers/adminController.js
14. routes/auth.js
15. routes/admin.js and representative login/role-gated routes
16. database/schema.sql system_logs definition
17. database/supabase/0006_admin_content_and_logs.sql
18. The complete database/supabase/*.sql filename list
19. scripts/with-server.js
20. scripts/regressionCredentials.js
21. scripts/probeSessionLifecycle.js
22. scripts/pilotCredentialSafety-probe.js
23. scripts/probeSessionResidue-probe.js
24. scripts/auth-http-probe.js, scripts/adminUsers-http-probe.js,
    scripts/logoutSessionTermination-probe.js, and the other existing
    authentication, authorization, admin-log, and session probes
25. scripts/quality-gates.js:
    - auth/authz gates
    - audit/privacy checks
    - documentation-current predicates
    - standalone-probe exclusions
    - executed stage plan and final residue gate
26. scripts/sharedRateLimit-probe.js
27. scripts/vercelProductionProfile-probe.js
28. scripts/vercelRuntimeSessionBootstrap-probe.js
29. docs/deployment.md
30. docs/security-checklist.md
31. docs/test-evidence.md
32. Read-only Git truth:
    - git status --short
    - porcelain count
    - staged and unstaged name-status
    - compact and expanded untracked counts
    - stash count
    - current HEAD and branch

AUTHORITATIVE STARTING STATE

- Milestones 8-11, RF.1-RF.6, BE.1-BE.6, OFF.1, R1-R4, and D1-D5
  are complete and Codex GO.
- R3 includes all session-hygiene/ownership/import-detector follow-ups.
- R4 includes the shared-rate-limit follow-up.
- Dependency-security remediation is complete and Codex GO.
- body-parser resolves to 2.3.0 and brace-expansion to 2.1.2.
- npm audit --omit=dev reports zero vulnerabilities.
- R5 is the next owner-authorized code section. It is not implemented or GO at
  the start of this execution.
- R6 is not started and remains blocked by independent R5 Codex GO.
- M12.P1 remains NO-GO for deployment and pilot readiness.
- Remaining order:
  R5 -> R6 -> R7 -> expanded D7 -> R8
  -> separate owner deployment decision.
- R8 GO authorizes only a separate owner deployment decision.
- No deployment is authorized here.

Accepted pre-R5 evidence:

- R4 focused standalone: 180/180.
- R2 standalone: 119/119.
- R3 standalone: 86/86.
- Accepted R4 full suite: 3040/3040, QUALITY-GATES OK.
- Current pre-R5 authority-sync full suite: 3050/3050, QUALITY-GATES OK (+10
  `docs-current` checks). R5 was not implemented or run for this total.
- Credential/session safety: 24/24.
- Canonical residue: 18/18.
- BE.6: 46/46.
- Dependency audit: zero vulnerabilities.
- R1-R4 are standalone and are not part of the npm-test total. R5 must also
  remain standalone.

Frozen truth:

- Supabase migrations are exactly 0001-0019.
- Migrations 0014-0019 are owner-applied.
- No migration 0020 exists or is authorized.
- 13 selected-demo buildings.
- 20 route nodes.
- 48 directed edges.
- 24 exact reverse pairs.
- 48 valid geometries.
- 24 exact reverse geometries.
- 13 routable destinations.
- 85 VR scenes and 66 hotspots.
- BE.6 fingerprint:
  a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d

Expected initial Git truth, to verify rather than trust:

- HEAD 5cce682 on main.
- 161 porcelain entries.
- 13 staged paths.
- 76 unstaged tracked paths.
- 81 compact untracked entries.
- 283 expanded untracked files.
- 0 stashes.

R5 CONTRACT

Routine anonymous requests to login-gated or role-gated routes must retain the
existing denial responses while creating zero system_logs rows.

Preserve audit rows for:

- Real authentication failures.
- Authenticated users attempting actions outside their allowed role.

Do not add:

- Anonymous-denial tables.
- Raw IP storage.
- Raw request/header/body/cookie/session persistence.
- Redis denial records.
- Periodic aggregation or timer jobs.
- New dependencies.
- New migrations.
- Anonymous public browsing.
- Any R6 functionality.

CURRENT ROOT CAUSE TO VERIFY

middleware/roleAuth.js currently calls the authorization-denial helper in:

1. requireLogin when no authenticated session exists.
2. requireRole when no authenticated session exists.
3. requireRole when an authenticated user lacks the allowed role.

The first two calls let routine anonymous traffic create immutable system_logs
rows. The third call is required and must remain exactly once.

IMPLEMENTATION

1. Change middleware/roleAuth.js narrowly:
   - Remove audit writes from anonymous requireLogin.
   - Remove audit writes from anonymous requireRole.
   - Preserve exact 302 /auth browser denial.
   - Preserve exact fixed 401 JSON denial.
   - Preserve wantsJson(req).
   - Preserve authenticated wrong-role 403 HTML/JSON.
   - Replace or harden the helper as authenticated-only.
   - Require a positive integer user id and nonblank role before calling
     auditService.record.
   - Keep event_type authorization, action access.denied, outcome denied,
     target_type route, query-free request path, and fixed sanitized message.
   - Audit persistence must not block or alter the denial response.

2. Do not change auditService, auditRepository, database schemas, migrations,
   authentication, sessions, rate limiting, or server ordering unless a
   focused failing reproduction proves an R5 defect there. Stop and report
   before broadening production scope.

3. Create:
   scripts/boundedAnonymousAccessDenial-probe.js

   It must be a self-terminating standalone probe using scripts/with-server.js:
   - MySQL mode on dedicated port 3381.
   - Supabase mode on dedicated port 3382.
   - Refuse to start if either port is occupied; never kill an unrelated PID.
   - Inherit the full environment and override only required values.
   - Use the shared regression credential loader.
   - Use probeSessionLifecycle ownership and terminateAll() in an outermost
     finally.
   - Print fixed sanitized labels only.
   - Never print a secret, identity, cookie, token, session id, audit payload,
     Supabase URL/key, or backend error.

4. For each backend leg, use supported HTTP/application interfaces only:

   A. Authenticate the canonical regression administrator and establish audit
      baselines through GET /admin/api/logs.

   B. Send exactly ten anonymous browser-style GET /dashboard requests.
      Assert every response remains 302 with Location: /auth.

   C. Send exactly ten anonymous JSON GET /admin/api/logs requests.
      Assert every response remains the exact current 401 JSON denial.

   D. Query the admin logs API and prove those twenty anonymous requests added
      zero authorization/access.denied/denied rows.

   E. Authenticate the canonical regression student. Send exactly one JSON
      GET /admin/api/logs. Assert the exact current 403 JSON body.

   F. Through bounded condition-based polling of the admin logs API, prove the
      authenticated denial added exactly one row with:
      - event_type authorization
      - action access.denied
      - outcome denied
      - intended actor role
      - positive actor id when backend identity spaces permit it
      - target_type route
      - target_id /admin/api/logs with no query string
      - fixed sanitized message
      - null attempted_email
      - no private request material.

   G. Use the supported CSRF flow and POST /login exactly once with a canonical
      regression email and deliberately incorrect in-memory canary password.
      Never print either. Assert the normal invalid-login response.

   H. Prove exactly one new authentication/login.local/failure row.
      attempted_email is an intentional existing audit column; verify it only
      through the admin interface and never print it.

   I. Terminate administrator and student sessions through supported logout,
      prove former-cookie denial, and verify no owned session remains.

   Audit rows are immutable security evidence. This prompt authorizes only the
   minimum events needed by the MySQL and Supabase probe. Do not delete, clear,
   truncate, repair, or directly mutate system_logs afterward.

   Use bounded condition-based polling for fire-and-forget persistence. Do not
   generate extra denial/login events while polling and do not rerun a red
   probe merely hoping for green.

5. Extend scripts/quality-gates.js with an in-suite R5 gate proving:

   - Anonymous requireLogin has no audit invocation.
   - Anonymous requireRole has no audit invocation.
   - Authenticated wrong-role invokes exactly one authenticated-only helper.
   - The helper refuses null, missing, malformed, or roleless actors.
   - Fixed taxonomy and query-free target remain intact.
   - HTML/JSON responses remain compatible.
   - No raw IP, header, body, cookie, session id, Redis denial key, new table,
     migration, timer, retry, or aggregation path was introduced.
   - The R5 focused probe exists but is not registered in npm test.
   - R1-R4 remain standalone.
   - The final residue gate remains exactly once and last.
   - Documentation contains one current authoritative state per required file.

6. Add negative fixtures so the gate fails if:

   - Either anonymous branch calls auditService.record directly.
   - Either anonymous branch calls the authenticated helper.
   - A null actor reaches the audit service.
   - The authenticated branch audits twice.
   - An audit target includes a query string.
   - R5 becomes registered in npm test.
   - Documentation claims R5 GO or R6 authorization.

DOCUMENTATION

Only after every required verification is green, synchronize:

- CODEX_HANDOFF.md
- CLAUDE_HANDOFF.md
- plan.md
- AGENTS.md
- CLAUDE.md
- ROADMAP.md
- docs/deployment.md
- docs/security-checklist.md
- docs/test-evidence.md

This prompt specifically authorizes status-only plan.md edits despite older
general instructions to the contrary.

Final candidate wording must state:

“M12.P1-R5 is implemented and awaiting independent Codex review. No GO is
claimed. R6 is not started and remains blocked by R5 Codex GO. M12.P1 remains
NO-GO for deployment and pilot readiness.”

Also preserve:

- R3/R4/dependency-security Codex GO.
- Zero production dependency vulnerabilities.
- The remaining sequence.
- Deployment non-authorization.
- Historical failed/candidate evidence, clearly labeled historical.
- Strict standalone versus full-suite accounting.

Update the delimited current-authority blocks and docs-current fixtures. If any
required verification is red, do not promote the documents to candidate R5.

VERIFICATION ORDER

1. Initial read-only Git truth.
2. Confirm ports 3381 and 3382 are free.
3. Pre-change R1 safety: must be 24/24.
4. Pre-change residue: must be 18/18.
5. Implement the narrow production change, focused probe, and in-suite gate.
6. node --check every changed/created JavaScript file.
7. Run focused R5 once; report its actual standalone total.
8. Run R4 focused: expected 180/180.
9. Run R2 focused: expected 119/119.
10. Run R3 focused: expected 86/86.
11. Run npm test once to completion; report the actual new in-suite total and
    require QUALITY-GATES OK.
12. Post-suite R1 safety: 24/24.
13. Post-suite residue: 18/18.
14. BE.6 standalone: 46/46, exact fingerprint unchanged.
15. npm audit --omit=dev: zero vulnerabilities.
16. Re-run node --check if documentation-gate code changed after the suite.
17. Run one final npm test only if post-suite code/docs changes require it;
    disclose every run.
18. Confirm exact spawned PIDs stopped, ports free, and no child/listener
    remains.
19. Capture final Git truth and compare with the initial snapshot.

R1-R5, residue, and standalone BE.6 are never counted inside npm test.

FAILURE RULES

- Do not conceal, clean up, or rerun unexplained red evidence.
- Do not revoke unrelated sessions or delete audit evidence to obtain green.
- Missing Supabase configuration fails closed; do not skip that leg.
- Report inherited unrelated defects without repairing them.
- Stop if R5 appears to require a new table, migration, dependency, persistent
  anonymous record, raw IP, or background aggregation.
- Do not start R6 under any result.

FINAL REPORT

Return:

1. Capabilities/skills/MCP used and unavailable.
2. Files read completely and partially.
3. Initial and final Git truth.
4. Every changed/created file and why.
5. Exact anonymous versus authenticated audit behavior.
6. MySQL and Supabase focused evidence.
7. Full-suite versus standalone accounting.
8. Pre/post credential safety and residue.
9. BE.6/fingerprint and dependency-audit results.
10. Every red/transient/blocked command, fully attributed.
11. Confirmation that no prohibited action occurred.
12. Final status:

“R5 implemented and awaiting independent Codex review; no GO claimed. R6 was
not started.”

Stop there and wait for independent Codex review.
~~~

## Historical Context-Only Prompt (not the R5 execution authority)

```text
You are Claude Code a senior developer implementor starting a fresh CampuSphere grounding session.

This prompt is solely for context recovery. It does not authorize implementation
or any other project work.

Repository:
C:\Users\FROST.GG\Desktop\CampuSphere v1

Hard stop boundaries:
- Do not create, edit, delete, move, format, or rewrite any file, including
  plan.md and the handoff files.
- Do not run npm test, npm start, npm run dev, node server.js, any application
  probe, browser automation, Playwright, or a foreground/background server.
- Do not query or mutate either live database.
- Do not apply SQL, create migration 0020, clear sessions, change accounts or
  passwords, access Cloudinary APIs, link or deploy Vercel, or perform any Git
  state-changing operation.
- Do not read or print .env values, credentials, hashes, cookies, CSRF tokens,
  session IDs, service keys, database hosts, raw rows, or complete geometry.
- Preserve the intentionally dirty worktree exactly.
- Read-only file inspection, migration-filename listing, and read-only Git
  status/diff summaries are the only authorized actions.
- Do not claim GO or begin the next section. Stop after the grounding report.

Capability rules for this grounding session:
- Inspect the skills, plugins, apps, and MCP tools actually available before
  relying on one. Read and follow the complete instructions for any applicable
  capability.
- Use the code-reviewer skill before reporting any code, security, database,
  UI, quality, or deployment inconsistency. This context-only prompt still does
  not authorize a GO/NO-GO decision.
- Playwright/browser MCP is required later for interactive D7 evidence, but it
  is not needed or authorized during this grounding session. Tool availability
  never broadens scope or permits a server, database, Cloudinary, deployment,
  migration, cleanup, or Git-state action.

Read completely and in this order:
1. CODEX_HANDOFF.md
2. CLAUDE_HANDOFF.md
3. plan.md, especially Summary, M12.P1, R1-R8, D1-D7, Interfaces and
   Contracts, Anti-Scope, and Assumptions
4. ROADMAP.md, especially routing/privacy/pilot gates, OFF.2-OFF.6, and
   Milestones 12-13
5. AGENTS.md
6. CLAUDE.md
7. CODEBASE_REMEDIATION_PLAN.md
8. fable5_security_bugs_report.md
9. package.json
10. server.js
11. config/vercelProductionProfile.js and
    scripts/vercelProductionProfile-probe.js
12. config/sessionConfig.js, services/supabaseSessionStore.js, and
    services/mysqlSessionStore.js
13. scripts/with-server.js and the server/session initialization paths used by
    server.js
14. config/selectedDemoFreeze.js and scripts/be6DatasetFreeze-probe.js
15. scripts/quality-gates.js, especially R2, D5, OFF.1 privacy, and
    documentation registrations
16. public/js/admin/building-details-editor.js,
    public/js/admin/admin-buildings.js, views/admin/campus-map.ejs, the
    D5-scoped portion of public/css/admin-styles.css, and
    scripts/buildingDetailsEditor-probe.js
17. future D7 interfaces: routes/admin.js; admin building, route, and schedule
    controllers/repositories; public/js/admin/admin-buildings.js,
    public/js/admin/admin-map-graph.js, and public/js/admin/admin-schedules.js
18. scripts/adminCampusMapSearchFilter-probe.js,
    scripts/adminRouteGeometryEditor-probe.js,
    scripts/adminScheduleCrud-probe.js, and the building/route/schedule probes
    referenced by plan.md
19. scripts/regressionCredentials.js,
    scripts/pilotCredentialSafety-probe.js, and the D1 logout/session contract
20. the complete database/supabase/*.sql filename list
21. all current Vercel/deployment configuration and documentation
22. read-only Git truth: HEAD, git status --short, porcelain count, staged and
    unstaged summaries, untracked entry/file counts, and stash count

Treat CODEX_HANDOFF.md, CLAUDE_HANDOFF.md, plan.md, and current repository
evidence as the active workflow authority. ROADMAP.md, CLAUDE.md, AGENTS.md,
older reports, screenshots, and memory may contain stale history. Do not edit
them during this grounding. If repository evidence conflicts with the
handoffs, report the inconsistency without correcting it.

Authoritative decisions and current context:
- Milestones 8-11, RF.1-RF.6, BE.1-BE.6, and OFF.1 are complete and Codex GO.
- OFF.2-OFF.6 are deferred until participant pilot review, not cancelled, and
  remain mandatory before final Milestone 12 GO.
- M12.P1 readiness remains overall Codex NO-GO. Grounding is not deployment
  permission.
- R1 and R2 repository work, plus D1-D5, are complete and Codex GO.
- D4's temporary Supabase probe residue and main-gate display-order drift were
  restored through separately authorized application API operations. Both
  backends are back at the BE.6 baseline.
- Current frozen truth is 13 selected-demo buildings, 20 route nodes, 48
  directed edges, 24 exact reverse pairs, 48 valid geometries, 13 routable
  destinations, VR totals 85 scenes/66 hotspots, and manifest fingerprint
  a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d.
- Supabase migrations remain exactly 0001-0019. Migrations 0014-0019 are
  owner-applied. No 0020 exists.
- D5 Friendly Building Additional-Details Editor is complete and Codex GO.
  The final implementation fails closed for a missing helper, constructor
  failure, incomplete editor interface, and editor-method failure; contains
  modal focus; keeps the previously undersized text at least 12px; and cleans
  up probe sessions.
- Final D5 evidence is focused probe 153/153, full quality gates 2558/2558 with
  QUALITY-GATES OK, BE.6 46/46, credential/session safety 24/24, and standalone
  Playwright MCP desktop/mobile plus missing-helper, constructor-throw, and
  focusFirstError-throw verification. The negative cases showed fixed sanitized
  messages, disabled Save, retained modal state, zero building mutations, no raw
  exception leakage, normal recovery, logout 200, and direct-revisit isolation.
- R3 Awaited Vercel Runtime and Session Bootstrap, all session-hygiene/
  ownership/import-detector follow-ups, R4, and dependency-security remediation
  are complete and Codex GO. R5 is the next owner-authorized section and is not
  started; R6-R7 must run one at a time after Codex GO for the preceding section.
- Expanded D7 is deferred until after R7 and required before R8 and any Vercel
  deployment decision. In both MySQL and Supabase modes it must use the real
  admin UI/application interfaces to create a uniquely prefixed temporary
  building with structured details, linked node, forward/reverse geometry
  edges, and an `audience=all` schedule; verify propagation, authorization, and
  all-reachable-page smoke for student, guest, and instructor; clean up in
  reverse dependency order; and restore BE.6 `46/46`, the frozen fingerprint,
  and credential safety `24/24`. It is a regression gate, not authorization to
  exercise every unrelated admin CRUD surface or repair defects inline.
- After D7 GO, R8 performs the read-only integrated readiness review. Even R8
  GO authorizes only a separate owner deployment decision. Do not begin D6;
  D6 remains the lowest-priority post-pilot task after OFF.2-OFF.5 and before
  OFF.6.
- The latest read-only credential/session safety result passed 24/24, including
  zero unexpired persisted sessions for all four canonical identities. Do not
  expose identifiers, clear rows, or mutate accounts.
- The eventual pilot exposes the whole reachable authenticated application.
  Facilitators focus students and guests on routing, but every reachable feature
  remains inside the security review. No anonymous browsing is added.
- Feedback uses an owner-created Google Form whose URL is still pending. Do not
  add a CampuSphere feedback table, API, or migration.
- Supabase is the production data/session target; MySQL remains local/fallback.
  Supabase Auth is not used. Preserve Express sessions, bcrypt, Google OAuth,
  roles, CSRF, CSP, rate limits, sanitized errors, PWA privacy, Cloudinary media
  boundaries, schedules, routing, and truthful VR arrival.
- Routing uses CampuSphere's own campus graph and owner-managed path_geometry.
  It has no Google Maps, Google Earth, Strava, SIS, or external routing engine.
- The 13 buildings are editable selected-demo records, not the complete campus.
  Numeric IDs remain backend-local; cross-source work uses canonical building
  names, node keys, and scene keys and fails closed on ambiguity.
- CAS retains the verified 24-scene Guard House-to-CAS guided route. CCS remains
  map-routable with truthful guided-VR deferral. Guided arrival appears only
  when the final renderable scene belongs to the selected destination.
- The worktree is intentionally dirty. The last snapshot was HEAD 5cce682,
  161 porcelain entries, 13 staged paths, 76 unstaged tracked paths,
  81 untracked entries, 283 expanded untracked files, and zero stashes.
  Recalculate read-only because these counts may have changed.
- Codex completed independent D5 browser verification through a fresh isolated
  invocation of the installed standalone Playwright MCP server after the
  configured MCP transport closed. The transport event was not an application
  failure; the standalone MCP verification passed and left no current-run
  browser, server, session, temp-directory, or Playwright artifact residue.

Return only:
1. Files read completely.
2. Your concise understanding of the current milestone and section decisions.
3. The exact final D5 GO evidence, the current R3 status, and why expanded D7 is
   deferred until after R7 but mandatory before R8/deployment.
4. Current read-only Git and migration truth.
5. Documentation inconsistencies, if any.
6. The current R3/R4/dependency status (complete and Codex GO), R5 explicitly
   labelled as next and owner-authorized only by the canonical execution prompt
   but not started, plus the
   remaining sequence R5 -> R6 -> R7 -> expanded D7 -> R8 -> separate owner
   deployment decision.
7. Confirmation that you ran no tests, server, browser, live query, mutation,
   deployment, or Git-state operation and changed nothing.

Stop after that grounding report and wait for a separate explicit execution
prompt.
```
