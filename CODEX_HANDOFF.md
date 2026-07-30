# CampuSphere Codex Handoff

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
> OFF.2 through OFF.6 are deferred until the owner-authorized limited-pilot
> review; they are not cancelled. The `M12.P1` readiness audit is complete with
> Codex NO-GO. R1-R7, D1-D5, and expanded D7 are complete and Codex GO.
> M12.P1-R3 and all session-hygiene/ownership/import-detector follow-ups and
> the R4 follow-up are closed. Dependency-security remediation, R5, both R5
> follow-ups, R6, R7, both R7 source-auditability corrections, and expanded D7
> are complete and Codex GO. `M12.P1-R7` is complete and Codex GO. Accepted R7
> closeout evidence is
> focused `71/71`, in-suite
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
> Milestone 12 GO is claimed. `SEC-51` production smoke has since been executed
> externally against `https://campusphere-cspc.vercel.app` on deployed baseline
> `78d9053c8ce5c2cc7a9ede80326950cfd29a3a53` and independently accepted; its
> superseded deferral is retained in its own row rather than erased.
> OFF.2-OFF.6 remain deferred until pilot
> review and are not cancelled. Accepted `R1`-`R7` and `D1`-`D7` history is
> unchanged.
>
> A separately owner-authorized `SEC-51` pilot-surface correction candidate is
> recorded: truthful landing role-mapping copy that matches `getRoleFromEmail()`,
> a shared accessible anonymous navbar owned by `public/js/public-nav.js`, and an
> auth-scoped in-card theme control. Each contract is pinned in the
> `pilot-readiness` gate with mutated-source rejecting fixtures. That candidate
> awaits an independent Codex review, is not deployed, and production continues
> to serve the accepted baseline.
>
> `M12.P1-R8` is the next potential section. R8 is read-only and is not
> authorized by this synchronization. Even a future R8 GO authorizes only a
> separate owner deployment decision. Deployment is not authorized, and final
> Milestone 12 GO remains blocked by pilot review plus OFF.2-OFF.6 and D6.
>
> Milestone 10 Cloudinary Media Support is complete and Codex GO; Section 10.8
> passed its final end-to-end GO/NO-GO. Milestone 11: Room Scheduling is
> complete and Codex GO; Section 11.8 passed its final GO/NO-GO.
<!-- M12.P1 CURRENT STATUS END -->

> **SUPERSEDED VERIFICATION BLOCKER (historical).** The earlier
> documentation/authority synchronization produced a RED full-suite candidate
> after Supabase logout/session-destroy failures left unexpired canonical
> administrator and student sessions; the distinct post-run safety check was
> `22/24`, the embedded residue gate was red, and the embedded BE.6 gate did not
> establish its frozen postcondition. That blocker is now closed: a separately
> owner-authorized supported cleanup/restoration was performed and independently
> reproduced, and R6 execution re-verified safety `24/24`, residue `18/18`, and
> BE.6 `46/46` with the frozen fingerprint unchanged, before and after its own
> full-suite run.

## Current Truth

- Supabase migrations are exactly `0001` through `0019`; migrations `0014`
  through `0019` are owner-applied and verified. No `0020` exists.
- The BE.6 current reproducible baseline is 13 selected-demo buildings, 20
  route nodes, 48 directed edges, 24 exact forward/reverse pairs, 48 valid
  owner-managed road geometries, and 13 routable building destinations in both
  backends. The temporary `main-gate -> chs` probe edge was deleted and
  `main-gate.display_order` was restored from `101` to the frozen value `1`
  through separately authorized admin API operations. The complete D4 regate
  returned the live topology and BE.6 fingerprint to the frozen baseline.
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
  walkthrough. CCS remains a fully routable campus-map destination, while its
  guided VR is explicitly deferred until the owner supplies genuine approved
  panoramas; the existing missing-media CCS rows cannot qualify as arrival.
- Real room/facility schedules are admin-managed data stored in the configured
  runtime source. They are not enrollment, assigned-class, SIS, or
  instructor-load simulation.

## Current M12.P1 Stop Point

- R1: Live Credential Containment and R2: Fail-Closed Vercel Production
  Profile are complete and Codex GO. R1 credential/session safety is `24/24`
  both before and after the R6 run. The historical `22/24` reading was cleared
  by the separately owner-authorized restoration. Do not disclose or directly
  delete session rows.
- D1: Logout and Session-Termination, D2: Shared Mobile Navigation and Brand,
  D3: Guided-VR Arrival Exploration, D4: Admin Campus-Map Search and Filter
  Repair, and D5: Friendly Building Additional-Details Editor are complete and
  Codex GO.
- D4 restoration and the complete regate are closed. The final recorded gates
  include topology `105/105`, route geometry API `44/44`, admin route geometry
  `112/112`, focused D4 `313/313`, BE.6 `46/46`, and the full suite
  `2395/2395`. Both backends match the frozen topology and fingerprint.
- D5 final evidence is focused probe `153/153`, full suite `2558/2558` with
  `QUALITY-GATES OK`, BE.6 `46/46`, and credential/session safety `24/24`.
  Independent standalone Playwright MCP verification passed desktop/mobile
  focus containment and the missing-helper, constructor-throw, and
  `focusFirstError()`-throw fail-closed cases with zero building mutations,
  sanitized errors, normal recovery, logout `200`, and direct-revisit isolation.
- M12.P1-R3, all session-hygiene/ownership/import-detector follow-ups, R4, R5,
  both R5 follow-ups, dependency-security remediation, R6, R7, both R7
  source-auditability corrections, and expanded D7 are complete and Codex GO.
  `M12.P1-R8` is the next potential section. R8 is read-only and requires a
  separate owner-authorized read-only review prompt; even R8 GO authorizes only
  a separate owner deployment decision. D6 remains the lowest-priority
  post-pilot repair after OFF.2-OFF.5 and before OFF.6. The remaining sequence
  is R8 read-only review -> separate owner deployment decision -> pilot review
  -> OFF.2-OFF.5 -> D6 -> OFF.6 -> M12.P2 final closeout.
- Under a separate owner authorization, the narrowly scoped R8 finding
  corrections were applied and the complete intended repository state was
  committed once on `main`, so a reviewable immutable snapshot exists. The
  candidate package inventory is recorded in `docs/deployment.md` and
  `docs/test-evidence.md`. The clean-snapshot candidate awaits an independent
  read-only R8 review decision, and `M12.P1` remains NO-GO for deployment and
  pilot readiness.
- The accepted R4 full-suite evidence remains `3040/3040`; the superseded
  pre-R5 authority/handoff gate passed `3050/3050`; the initial R5 candidate
  full suite passed `3162/3162`. After the R5 follow-up the accepted R5 closeout
  full suite passed `3234/3234` with `QUALITY-GATES OK` (+72 vs `3162`: +54
  `bounded-anon-denial`, +18 `docs-current`). The pre-remediation R6 candidate
  full suite was `3375/3375`; after the narrow provenance/evidence-gate
  remediation the accepted R6 Codex GO full suite is `3415/3415` with
  `QUALITY-GATES OK` (+40 vs `3375`: `self-hosted-vendor` `119 -> 139` and
  `docs-current` +20). The accepted R7 closeout full suite passed `3495/3495`;
  the `3492/3492` and `3494/3494` R7 candidates are historical/superseded. The
  accepted D7 closeout full suite passed `3511/3511` with `QUALITY-GATES OK`
  after fresh browser/storage role isolation, reverse-order cleanup, audit
  zero, and postconditions `24/24 -> 18/18 -> 46/46`. A later logout-output
  hygiene remediation is accepted only as additive post-D7 evidence at
  `3529/3529` with zero escaped logout-error lines; it does not replace D7
  evidence. R1-R7 focused probes remain standalone and are never counted in any
  full-suite total.
- Authority-sync authoring disclosure: two earlier `npm test` runs were red
  only in the new `docs-current` R5-ready assertions (7 failures, then 5).
  Their predicate/prose defects were corrected before the final green run; no
  application, session, dataset, or dependency gate failed in those runs.

## BE.1 Through BE.3 Decisions

- BE.1 audited the current building, routing, VR, schedule, and media state.
  Official academic-unit names alone are not proof of distinct map buildings.
  No building, coordinate, entrance, or walkway connection may be invented.
- BE.2 added College of Arts and Sciences (CAS) to the canonical
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
- Cross-source joins use normalized canonical names. A valid join requires
  exactly one building-source row and no duplicate route-source row. Missing,
  orphaned, duplicate, or ambiguous identities fail closed with null
  destination and VR IDs. Admin duplicate canonical names receive a sanitized
  `409` response.
- All current 13 canonical buildings are route-ready in MySQL, Supabase, and
  both mixed building/route source configurations.

## BE.4 Revised-Scope GO And Current Objective

- The system is intended for CSPC first-year orientation before July 27, 2026.
  The owner does not consider the current 13-building roster the final
  whole-campus scope.
- BE.4 received Codex GO with the exact 24-scene Guard House-to-CAS guided-VR
  sequence, MySQL/Supabase natural-key parity, and the CAS 101 schedule hotspot
  preserved. CCS campus-map routing remains available with the fixed truthful
  guided-VR-unavailable state in every route/VR source combination.
- At BE.4 closeout, focused probes, desktop and 390 px browser checks, and the
  complete `npm test` quality suite passed. The graph then matched
  `20/48/24/48/24/13`, and both VR backends had 85 scenes and 66 hotspots with
  zero leftover fixtures. The Current M12.P1 Stop Point records the later
  Supabase probe residue and overrides that historical graph snapshot.
- Selected CAS metadata is semantically identical in MySQL and Supabase by
  natural keys. Numeric database IDs remain backend-local and must never be
  compared across sources.
- The owner controls Cloudinary uploads. Agents must not upload, rename,
  transform, or delete Cloudinary assets. CCS activation is a separately
  authorized future dataset upgrade after genuine CCS panoramas exist; it must
  replace affected BE.6/OFF evidence if performed after dataset freeze.
- Future building additions require owner-confirmed canonical name, category,
  coordinates, entrance, and walkway connection. They do not block the
  selected 13-building demo gate; after a freeze they require refreshed
  verification evidence.
- OFF.1 is complete and Codex GO. The remaining Offline Campus Navigation
  Package is deferred until limited-pilot review and remains required before
  final Milestone 12 GO.

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
  The Current M12.P1 Stop Point records the later live Supabase exception.
- BE.5 received Codex GO after `52/52` Leaflet/MapLibre destination evidence,
  focused interaction/VR checks, consecutive full suites, and QA closeout.
- `config/selectedDemoFreeze.js` is the immutable BE.6 QA manifest. It pins
  migrations `0001`-`0019`, counts, the sorted 13-building roster, the
  building/route fingerprint, selected CAS VR fingerprint, exact 24-scene
  order, one CAS schedule target, and deferred CCS policy. Aggregate manifest
  fingerprint: `a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d`.
- The freeze is not a runtime lock. Admin edits and future owner-approved
  buildings remain supported, but a frozen building/route/selected-VR change
  invalidates BE.6 evidence until a separately reviewed manifest refresh.
- BE.6 received Codex GO after the read-only freeze probe, focused route/VR and
  building probes, two consecutive full contract suites, all four QA commands,
  zero-vulnerability audit, and clean fixture/listener closeout. This GO
  authorized OFF.1, which subsequently completed.

## OFF.1 GO And Privacy Contract

- OFF.1 audited the existing manifest, custom service worker, session-neutral
  offline shell, runtime caches/catalog, public APIs, map/VR media behavior,
  privacy boundaries, and the BE.6-frozen dataset. The current PWA is not the
  completed Offline Campus Navigation Package.
- `/map` now renders the escaped CSRF meta token used by logout.
- `middleware/authenticatedHtmlNoStore.js` applies exact
  `Cache-Control: no-store, private` to authenticated non-API responses. Only
  paths anchored at `/api/` or `/admin/api/` are exempt; spoofed `Accept`, XHR,
  or JSON content-type headers cannot make personalized HTML cacheable.
- The final Playwright MCP check at `127.0.0.1:3462` verified `/map` and logout
  carried the no-store policy; logout returned `302` to
  `/auth?logged_out=1`; dynamic-cache count and catalog-record count were zero;
  two neutral caches remained; and Back, reload, and direct `/map` revisit did
  not replay authenticated content. The sanitized evidence is under
  `%TEMP%\campusphere-off1-browser\logout-back-reload-playwright-20260718-114310`.
- The future package contract requires explicit **Download Offline Guide**
  consent; the frozen 13-building catalog/routes; public `audience=all`,
  `status=scheduled` schedules for today through 14 days capped at 100 rows per
  building; selected CAS/Free-Roam data; truthful deferred CCS; bounded storage
  and atomic updates; best-effort map tiles; and explicit logout cleanup.
- Authenticated HTML, sessions, cookies, CSRF tokens, credentials,
  user/profile data, admin/private content, mutations, raw errors, and
  unapproved media remain excluded from offline storage.

## Limited Vercel Pilot Decision And Next Work

- The owner authorized a limited pilot exception after OFF.1. The `M12.P1`
  readiness/exposure audit is complete with NO-GO after one critical and six
  high findings. R1-R4 and D1-D5 have GO; dependency-security remediation is
  also complete and Codex GO. `M12.P1-R5`, both follow-ups, and `M12.P1-R6` are
  complete and Codex GO. This Codex handoff alone does not authorize
  implementation, session cleanup, or deployment.
- The eventual pilot exposes the entire currently reachable authenticated
  application. It is routing-focused by facilitator instruction, not by a
  technical route/feature restriction. Every exposed surface therefore remains
  inside the security and deployment review.
- Students and guests will be guided to evaluate campus building search and
  routing. Existing authentication and role authorization remain mandatory;
  no anonymous browsing is introduced.
- Feedback uses an owner-created Google Form. Its URL is still pending, and no
  CampuSphere feedback table, API mutation, or migration is authorized.
- OFF.2 through OFF.6 resume after pilot feedback review and remain mandatory
  before final Milestone 12 GO. The pilot must not claim offline readiness.
- R3 through R7 and expanded D7 are complete and Codex GO. The remaining
  sequence begins at the read-only R8 review, one section at a time after each
  independent GO: read-only R8; separate owner pilot-deployment decision;
  participant review; OFF.2-OFF.5; D6; OFF.6; and M12.P2 final closeout.
- Expanded D7 is the agreed full browser lifecycle in both MySQL and Supabase:
  the regression administrator creates a uniquely prefixed temporary building
  with structured details, a building-linked route node, a forward/reverse
  geometry edge pair, and an `audience=all` schedule; student, guest, and
  instructor verify propagated building, routing, schedule, authorization, and
  all-reachable-page behavior; cleanup occurs in reverse dependency order; and
  BE.6 plus credential/session safety must return to the frozen baseline. D7 is
  a regression gate, not an inline defect-repair section.

Vercel remains a demo/UAT target. Docker remains the Milestone 13 full
deployment finalization path.

## Architecture To Preserve

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

## Fresh-Session Read Order

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
11. `server.js`, `middleware/authenticatedHtmlNoStore.js`, and
    `middleware/roleAuth.js`
12. `views/map.ejs`, `public/sw.js`, `public/js/pwa.js`,
    `public/offline.html`, and `public/manifest.webmanifest`
13. `scripts/quality-gates.js`, especially OFF.1 privacy and documentation
    contract gates
14. `services/routeAvailability.js`
15. R3 inputs: `config/vercelProductionProfile.js`,
    `config/sessionConfig.js`, `services/supabaseSessionStore.js`,
    `services/mysqlSessionStore.js`, `scripts/with-server.js`, and
    `scripts/vercelProductionProfile-probe.js`
16. `scripts/routeTopology-probe.js`,
    `scripts/adminRouteGeometryEditor-probe.js`,
    `scripts/adminCampusMapSearchFilter-probe.js`, and the D1-D4 files named
    in the refreshed Claude handoff
17. building baseline/integration, route geometry, map-to-VR, guided-CAS,
    Free Roam, and VR-schedule probes named in `plan.md`
18. future D7 interfaces: admin building, route-node, route-edge/geometry, and
    schedule routes/controllers/repositories plus their focused probes
19. `public/js/admin/building-details-editor.js`,
    `public/js/admin/admin-buildings.js`, `views/admin/campus-map.ejs`, the
    D5-scoped CSS, `scripts/buildingDetailsEditor-probe.js`, and its quality-gate
    registration
20. `scripts/pilotCredentialSafety-probe.js`
21. Vercel/deployment files and documentation currently present in the repo
22. full `database/supabase/*.sql` migration list
23. `git status --short` and `git status --porcelain=v1` count
24. staged, unstaged, untracked, stash, and current-HEAD summaries

Use the code-reviewer skill before every code/security/database/UI finding or
GO. Live repository and database evidence overrides screenshots, reports,
memory, and either handoff.

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
- Runtime correction: `middleware/csrfProtection.js` gained
  `ensureCsrfToken(session)`, and `establishAuthenticatedSession` now mints the
  regenerated session's CSRF token AFTER `assignSessionUser` and BEFORE
  `saveSession`. Previously the token was minted lazily on the first
  authenticated page render, so an immediately submitted HTML logout form could
  be validated against a stored session that did not yet carry it.
- Harness correction: `scripts/with-server.js` normalizes/validates `mode`,
  defaults the child `SESSION_STORE` to the normalized mode when `sessionStore`
  is omitted, fails closed on a blank/invalid explicit value, and now ALWAYS
  assigns `env.SESSION_STORE` so an ambient value can never leak. All probe
  `withServer` call sites are explicit.
- Ownership: `scripts/probeSessionLifecycle.js` is the single supported
  termination path; every canonical-login probe registers its jars and
  terminates them from a `finally`. The ownership inventory now discovers
  probes from the filesystem as well as the registered list, so standalone
  probes are covered too.
- Postcondition: `scripts/probeSessionResidue-probe.js` (SELECT-only) is the
  registered FINAL npm-test gate and is authoritative for zero unexpired
  canonical sessions in both stores. Static ownership is defense in depth only.
- Bounded restorations were performed under explicit owner authorization and
  touched only validated regression identities' persisted sessions. No account,
  password, role, profile, cookie policy, or session configuration changed.
- Accepted Codex GO evidence: full suite
  `2921/2921` with `QUALITY-GATES OK`; in-suite resolver
  `14/14` and residue `18/18`; standalone R1 `24/24`, R2 `88/88`, R3 `86/86`;
  standalone BE.6 `46/46` with the frozen fingerprint unchanged. Standalone
  results are never part of the full-suite total.
- M12.P1-R4 follow-up remediation, dependency-security remediation, R5, both
  R5 follow-ups, R6, and R7 are complete and Codex GO.

## M12.P1-R4 Shared Upstash Rate Limiting (complete; Codex GO)

The first R4 submission received Codex NO-GO on four findings. All four are
closed below, and the corrected section received independent Codex GO.

- **HIGH — SDK retries were enabled by default (closed).** The production
  client is now constructed with `retry: { retries: 0 }`, giving EXACTLY ONE
  transport attempt. Verified against the installed 1.38.0 request loop
  `for (i = 0; i <= attempts; i++)`: omitted -> attempts 5 -> six attempts;
  `retry: false` -> attempts 1 -> TWO attempts (so it is NOT "no retries" and
  is deliberately not used); `{ retries: 0 }` -> attempts 0 -> one attempt with
  the backoff branch unreachable, so no retry timer exists. The focused probe
  proves the call count against the REAL SDK by swapping `global.fetch` for a
  rejecting stub inside a strict try/finally (no network performed, original
  reference restored).
- **HIGH — `Retry-After` could understate the authoritative TTL (closed).** The
  `Math.min(ttl, windowMs)` clamp is removed; the adapter returns the raw Redis
  `PTTL`. Clamping would have advised a retry while the bucket was still over
  the limit, guaranteeing a second `429`. Unusable TTL replies (negative,
  non-integer, non-numeric, missing) still fail closed.
- **MEDIUM — the Lua script took Upstash's global database lock (closed).** The
  script's exact first line is now `#!lua flags=allow-key-locking`, so Upstash
  locks only the keys in the `KEYS` array instead of the whole database. The
  script passes exactly one key, accesses only `KEYS[1]`, and performs no
  database-wide write, satisfying the flag's rules.
- **MEDIUM — forward-looking authority docs still started at R3 (closed).**
  `CODEX_HANDOFF.md`, `CLAUDE_HANDOFF.md`, `AGENTS.md`, and `CLAUDE.md` each
  still carried a forward-looking remaining-sequence statement, or an
  execution instruction, that began at the already-completed R3 — a false
  green in which every per-document status banner read correctly while the
  plan section below it still directed the next session to execute R3. All
  four are corrected to begin after R4. The documentation gate's R3 predicate
  now rejects that whole class (forward-looking remaining sequence/order
  statements and execution instructions anchored on R3), with named fixtures
  pinning both directions; it still accepts historical descriptions of the
  completed R3 work. This report deliberately paraphrases rather than quotes
  the old wording, so the corrected file cannot re-trip its own gate.

- Adds exactly `@upstash/redis@1.38.0` (saved exact, no range). No
  `@upstash/ratelimit` or other limiter dependency is introduced.
- `services/rateLimitStore.js` is the narrow storage boundary.
  `VERCEL=1` selects a SHARED Upstash counter; every other environment keeps
  the original in-memory fixed-window Map and never loads the dependency. One
  client per process/module lifetime, never per request. No timers, listeners,
  retries, or background workers — retries are explicitly zero (see the HIGH
  finding above).
- Counters are atomic: one server-side Lua `EVAL` performs `INCR`, reads
  `PTTL`, and applies `PEXPIRE` when the window is new or an expiry is missing,
  returning the count plus the authoritative TTL used for `Retry-After`. An
  Upstash pipeline is explicitly NOT atomic and is deliberately not used.
- Only HMAC-SHA-256 digests are persisted. Keys are
  `csrl:v1:<scope>:<digest>`; values are a bare integer counter. Namespace,
  version, and scope are part of the HMAC material and the visible key, and
  components are length-prefixed, so scopes and identities cannot collide. No
  raw IP, email, user id, cookie, session id, token, secret, or submitted
  content reaches a key, value, response, or log.
- The Vercel preflight now also requires server-only `UPSTASH_REDIS_REST_URL`
  (HTTPS, hostname, no embedded URL credentials), `UPSTASH_REDIS_REST_TOKEN`
  (nonblank, no documented placeholder), and `RATE_LIMIT_KEY_SECRET` (>= 32
  characters, no documented placeholder) — all under the SAME one fixed
  sanitized refusal, still pure, still no network call. None is required off
  Vercel.
- Existing `429` JSON/HTML bodies, integer `Retry-After` (>= 1), every
  `RATE_LIMIT_*` override, all limiter scopes, pre-body placement, the
  identity-aware limiters' position after auth/CSRF, and the safe-method admin
  exemption are unchanged. `req.ip`/trust-proxy semantics and middleware order
  are untouched; `server.js` was NOT modified by R4.
- Shared-store failure fails closed: a fixed sanitized `503` with
  `Cache-Control: no-store`, never `next()`, never a process-local Map, no
  backend detail, and no per-request logging during an outage. The literal is
  declared independently of the R3 readiness module.
- Claude-side follow-up evidence: focused standalone
  `scripts/sharedRateLimit-probe.js` `180/180` (was `154/154`; +26); full suite
  `3040/3040` with `QUALITY-GATES OK` (was `3021/3021`; +19 = +11
  `shared-rate-limit`, +8 `docs-current`; +119 versus the accepted pre-R4
  `2921/2921`); standalone R2 `119/119`; standalone R3 `86/86` unchanged;
  standalone R1 `24/24`; residue `18/18`; BE.6 `46/46` with the fingerprint
  unchanged. Standalone probes are never part of the npm-test total. Codex
  independently reviewed this evidence and granted R4 GO.

## Dependency-Security Remediation (2026-07-22 closeout; historical accepted evidence)

- The two production advisories found during R4 closeout were resolved at that
  time through
  compatible transitive lockfile updates only: `body-parser@2.3.0` and
  `brace-expansion@2.1.2`, with the required compatible `type-is` and nested
  `content-type` graph adjustments.
- `package.json` remained byte-identical. No direct dependency, override,
  `--force`, major Express/EJS/Upstash/session upgrade, application-source
  change, or manual lockfile edit was introduced.
- Accepted verification: `npm audit --omit=dev` and `npm run qa:audit` report
  zero vulnerabilities; full suite `3040/3040`; R4 `180/180`; R2 `119/119`;
  R3 `86/86`; R1 `24/24`; residue `18/18`; BE.6 `46/46`, fingerprint unchanged.
- Reviewed file hashes: `package.json`
  `8291bcba01370e529bc756dc122a4166d2b9ade1a9c1f0a81f5af2a00b5e5c4e`;
  `package-lock.json`
  `88bd470464bf0fc4fb5dc5c371588db3a655c4b67cf8d82a0e0dea5e81f33d61`.

## M12.P1-R5 Bounded Anonymous Access-Denial Auditing (complete; Codex GO)

`M12.P1-R5`, its authoritative-global-total follow-up, its documentation-gate
final correction, R6, and R7 are complete and Codex GO.
`M12.P1` remains NO-GO for deployment and pilot readiness.

- **Production change is confined to `middleware/roleAuth.js`.** The two
  anonymous branches (`requireLogin` with no session, `requireRole` with no
  session) no longer invoke any audit path, so routine logged-out traffic
  creates zero `system_logs` rows. Their responses are unchanged: the exact
  `302` to `/auth` for browsers and the exact fixed
  `401 { success:false, message:'Authentication required.' }` for JSON callers,
  still selected by the unchanged `wantsJson(req)`.
- The former general-purpose `auditAccessDenied(req, actorId, actorRole)` helper
  is replaced by `auditAuthenticatedAccessDenied(req, actor)`, which is
  authenticated-only by construction: it returns `false` unless the new pure
  `isAuditableActor(actor)` predicate confirms a positive integer id **and** a
  non-blank role. A null, missing, malformed, or roleless actor can no longer
  reach `auditService.record`.
- Exactly one audit write remains, in the authenticated wrong-role branch, and
  `middleware/roleAuth.js` now contains exactly one `auditService.record` call
  site in total. The row keeps `event_type='authorization'`,
  `action='access.denied'`, `outcome='denied'`, `target_type='route'`, the
  query-free request path, and the fixed sanitized message. Persistence stays
  fire-and-forget and never blocks or alters the `403` HTML/JSON denial.
- Nothing else changed: no audit schema, service, repository, migration,
  session, authentication, rate-limit, dependency, or `server.js` edit. No
  anonymous-denial table, raw-IP storage, Redis denial record, timer, retry, or
  aggregation path was introduced, and Supabase migrations remain exactly
  `0001`-`0019`.
- **Focused evidence (standalone):** `scripts/boundedAnonymousAccessDenial-probe.js`
  passed `90/90` across both backends (MySQL port `3381`, Supabase port `3382`,
  each refusing to start on an occupied port). Per leg it proved ten anonymous
  `GET /dashboard` requests stayed `302 -> /auth`, ten anonymous JSON
  `GET /admin/api/logs` requests stayed the exact `401`, those twenty added zero
  rows of ANY taxonomy (the authoritative unfiltered `summary.total` is
  unchanged) AND zero `authorization/access.denied/denied` rows (filtered,
  defence in depth), one authenticated student request returned the exact `403`
  JSON and added exactly one sanitized row (intended role, positive actor id,
  `target_type=route`, `target_id=/admin/api/logs` with no query string, fixed
  message, null `attempted_email`, no raw request material), and one deliberately
  invalid login added exactly one `authentication/login.local/failure` row.
  Bounded condition-based polling of the admin-only log API was used for the
  fire-and-forget writes; the probe was run once.
- **Historical R5 follow-up candidate evidence — closes two independent Codex
  findings.**
  (1) The focused probe previously proved only that the FILTERED
  authorization/denied count did not increase, which shows one taxonomy did not
  grow. It now also validates the authoritative unfiltered `system_logs` total
  from `body.summary.total`: a fail-closed `validateLogsBody` returns both a
  distinct filtered `total` and a `globalTotal` (missing/malformed/non-integer/
  negative fails closed, and a filtered count is never substituted for the
  global count); a bounded `readStableGlobalTotal` captures a stable baseline
  (accepted only after two consecutive equal reads, at most 24 reads / 250 ms,
  reset by any invalid read) IMMEDIATELY before the anonymous batches; and a
  bounded `globalTotalStaysAt` proves the authoritative total is unchanged
  across six reads afterward. The two new per-backend checks (stable global
  baseline obtained; twenty anonymous denials added zero rows of any taxonomy)
  raise the focused probe from `86/86` to `90/90`. (2)
  `docs/new-session-grounding-prompts.md` still told a fresh session that R5 was
  next/unimplemented; both reusable fenced prompts were corrected to the
  authority at that candidate stage (R5 implemented and awaiting review, no R5
  GO, R6 blocked, M12.P1 NO-GO) with an updated Asia/Manila date.
- **In-suite gate:** the `bounded-anon-denial` stage in
  `scripts/quality-gates.js` proves the roleAuth contract statically (unchanged
  from the initial candidate) AND now the global-total contract: a pure
  `analyzeGlobalTotalContract` plus source-mutation negative fixtures prove the
  probe reads `summary.total`, keeps the filtered count distinct, establishes
  the baseline before both anonymous batches exactly once, asserts the
  postcondition after both batches exactly once, retains the filtered
  authorization assertion, and never bypasses the validator; and the REAL
  exported helpers (`toCount`, `validateLogsBody`, `readStableGlobalTotal`,
  `globalTotalStaysAt`) are driven database-free from stub read sequences with
  negative cases. A dedicated documentation extractor/validator
  (`extractReusablePrompts`/`reusablePromptIsCurrent`/`reusablePromptsAreCurrent`)
  parses each fenced prompt independently and fails on missing/duplicate/
  unclosed/empty blocks, stale R5-next wording, a premature R5 GO, or wording
  that authorizes R6 — with fixtures pinning each case. The existing fenced-block
  stripping used for the handoffs' archived prompts is deliberately unchanged.
- **Standalone accounting is unchanged in kind:** R1 `24/24`, R2 `119/119`,
  R3 `86/86`, R4 `180/180`, and R5 `90/90` are standalone probes and are never
  part of the `npm test` total. The initial R5 candidate full suite was
  `3162/3162`; after the follow-up the accepted R5 closeout full suite is
  `3234/3234` with `QUALITY-GATES OK` (+72: +54 `bounded-anon-denial`, +18
  `docs-current`), of which the `bounded-anon-denial` gate now contributes
  `133/133`.
- **Disclosed red run.** The first R5 candidate `npm test` reported four
  `bounded-anon-denial` failures. All four were defects in the NEW GATE, not in
  the application: three forbidden-pattern scans matched the prose in file
  headers that documents the very guarantee being asserted (the audit
  repository's "UPDATE/DELETE/TRUNCATE revoked" note, and the probe's "never
  kills any process" / "never deletes ... system_logs" notes), and one negative
  fixture anchored on a wrongly indented line so its mutation was a silent
  no-op. A comment-stripping lexer was tried and rejected — this repository has
  regex literals holding an odd number of quote characters, which flip a
  non-parsing lexer into a string state — so every scan was rewritten as a
  precise code shape (a real SQL statement against `system_logs`, a real
  `.kill(`/`.delete(`/`.update(` call), and the fixture was re-anchored on a
  unique substring. No application, session, dataset, or dependency gate failed
  in that run.
- Audit rows created by this authorized security test are immutable evidence.
  Nothing was deleted, truncated, repaired, or directly mutated in
  `system_logs`, and no session row was touched outside the supported logout
  interface.

## M12.P1-R6 Self-Hosted Browser Dependencies (complete; Codex GO)

`M12.P1-R6` and `M12.P1-R7` are complete and Codex GO. `M12.P1` remains NO-GO
for deployment and pilot readiness.

- **Every browser vendor library is now same-origin.** Leaflet `1.9.4`,
  MapLibre GL JS `4.7.1`, Pannellum `2.5.6`, Iconify Icon `1.0.7`, and Lucide
  `1.25.0` are served from `public/vendor`. The former floating
  `lucide@latest` reference is resolved to an exact reviewed version.
- **Provenance.** Each package was acquired with `npm pack` from the public npm
  registry into an external scratch directory; every tarball's SHA-512 matched
  the registry-published `dist.integrity` exactly. `public/vendor/manifest.json`
  records package, version, tarball URL, integrity, source path, destination,
  license, and the SHA-256 of the final shipped bytes for all 18 shipped files.
  No dependency was installed; `package.json` and `package-lock.json` are
  byte-identical (`8291bcba…5c4e`, `88bd4704…3d61`).
- **The single documented transformation** is the pre-existing Leaflet
  `sourceMappingURL` removal. `public/vendor/leaflet/leaflet.js` was preserved
  unchanged and verified to be a byte-exact prefix of the 147552-byte tarball
  source, minus exactly the 35-byte `//# sourceMappingURL=leaflet.js.map`
  trailer. Every other shipped file is byte-identical to its tarball source.
- **CSP contraction.** `unpkg.com`, `cdn.jsdelivr.net`, and
  `code.iconify.design` are removed from every directive. `script-src` is now
  exactly `'self'` plus the per-request nonce. Nonces, `style-src-attr`,
  `script-src-attr 'none'`, the approved Google Fonts / OSM tile / Iconify data
  / Cloudinary origins, `data:`/`blob:` image sources, and the `'self' blob:`
  worker boundary are unchanged. No directive was broadened.
- **MapLibre ships no separate worker.** The exact 4.7.1 UMD bundle spawns its
  worker from a `blob:` URL; browser verification recorded zero separate
  worker-file requests, so no speculative worker machinery was added.
- **Truthful degradation.** Every `lucide.createIcons` call site is guarded;
  `public/js/admin/admin-users.js` and `admin-news.js` gained a local
  `refreshIcons()` helper because an unguarded call previously threw before
  `bindRowActions()`/`rebindDropdowns()` and before the submit `finally`
  handlers re-enabled their buttons. `/map` retains its fixed "Live map engine
  is unavailable." state for both renderers; `/home` and `/dashboard` gained the
  same truthful state; the VR views keep "360 viewer could not be loaded."
  and never claim arrival.
- **`public/sw.js` changed in commentary only.** Cache version, precache list,
  approved external hosts, forbidden prefixes, and the network-only
  authenticated-navigation privacy boundary are unchanged.
- **Accepted Codex GO evidence.** Focused standalone
  `scripts/selfHostedBrowserDependencies-probe.js` `230/230` across MySQL and
  Supabase and both renderer modes (was `228/228` before the independent-
  inventory static checks; +2); full suite `3415/3415` with
  `QUALITY-GATES OK` (`self-hosted-vendor` gate contributes `139`, up from `119`;
  pre-remediation suite was `3375/3375`); standalone R2 `119/119`, R3 `86/86`,
  R4 `180/180`, R5 `90/90`;
  credential/session safety `24/24` before and after; canonical residue `18/18`
  before and after; BE.6 `46/46` with the fingerprint unchanged;
  `npm audit --omit=dev` zero vulnerabilities. R1-R6 are standalone and are
  never part of the npm-test total.
- **Narrow provenance/evidence-gate remediation (this follow-up).** Added an
  independently reviewed `EXPECTED_VENDOR_INVENTORY` in probe code, OUTSIDE
  `public/vendor/manifest.json`, pinning every package's name/version/license/
  registry-tarball/sha512-integrity/global-interface and every file's source/
  destination/byte-count/final-SHA-256/transformations. All 18 were re-verified
  against official `npm view` metadata and exact `npm pack` tarballs (external
  scratch; no asset copied into the repo). `analyzeVendorManifest` now fails
  closed on ANY divergence from that inventory, and the in-suite gate re-verifies
  disk AND HTTP bytes against the independently pinned SHA-256 — so a coordinated
  bytes+manifest-hash swap fails without an explicit reviewed code change. The
  only manifest edit was correcting the false `approvedExternalOrigins` comment
  (Google Fonts is the sole external stylesheet exception). No vendor runtime
  byte, view, CSP, service worker, or application behavior changed.
- **Independent Codex browser verification** covered all eight admin pages,
  `/home`,
  `/dashboard`, `/about`, `/events`, `/map` in both Leaflet and MapLibre modes,
  Free Roam `/vr`, and a guided `/vr/to/<CAS>` route at 1440x900 and 390x844:
  zero CSP violations, zero page errors, zero executable CDN requests, no
  horizontal
  overflow, and Leaflet markers resolving from
  `/vendor/leaflet/images/marker-icon.png`. Missing-asset cases were simulated
  by request interception in fresh browser contexts; no repository asset was
  renamed, deleted, or overwritten. Independent missing-family interception
  for Lucide, Iconify, Leaflet, Pannellum, and MapLibre produced only expected
  same-origin `404`s and no stale route, false arrival, or unexpected exception.
- **Disclosed historical runs.** Five `npm test` runs were performed, all
  disclosed. Run 1
  reported ONE failure, in the NEW GATE rather than the application: its
  `lucide.createIcons` scan matched the `//` comment lines that document the
  guard, repeating the R5 class of defect. The scan was rewritten as a precise
  code shape that ignores lines beginning a comment, with fixtures pinning both
  directions, and run 2 passed `3369/3369`. Run 3, after the documentation
  synchronization, reported ONE failure — the retargeted post-R6 predicate
  matched a prohibition sentence in `CLAUDE_HANDOFF.md` that named the next
  section after an imperative verb, a false positive on a ban rather than an
  authorization; the prose was reworded rather than the gate weakened. Run 4 was
  the pre-remediation candidate at `3375/3375`
  (`+6` `docs-current` versus run 2, from the retargeted fixtures). Run 5, after
  the narrow provenance/evidence-gate remediation, became the accepted R6 GO
  suite at
  `3415/3415` (`+40`: `self-hosted-vendor` `119 -> 139`, `docs-current` `+20`).
  No application, session, dataset, or dependency gate failed in any run.
- **R6-GO / R7 authority synchronization.** The first synchronization suite was
  RED only in four newly retargeted `docs-current` assertions: the blocked-by-R6
  negative fixture, the Claude handoff stale scan, and the live/fixture R7 prompt
  validators. The predicate and prompt-shape checks were corrected without
  weakening the R7 boundary. The accepted closeout suite is `3415/3415` with
  `QUALITY-GATES OK`; post-suite safety is `24/24`, residue `18/18`, and BE.6
  `46/46` with the frozen fingerprint unchanged. This synchronization is not R7
  implementation evidence.

## Latest Continuity Snapshot

- D4 restoration is complete and Codex GO. Both backends currently match the
  frozen `20/48/24/48/24/13` topology, VR `85/66`, and BE.6 fingerprint
  `a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d`.
- D5 is complete and Codex GO. The final fail-closed editor, focus containment,
  readability, documentation-gate, and session-hygiene corrections passed the
  focused probe `153/153`, full suite `2558/2558`, standalone Playwright MCP
  desktop/mobile and negative-case verification, and final cleanup checks.
- Credential/session safety is `24/24` and canonical residue `18/18`, verified
  both before and after the R6 full-suite run. No direct session-row cleanup was
  performed or is authorized.
- Repository snapshot at the START of the R6 session: HEAD `5cce682`, 161
  porcelain entries, 13 staged paths, 76 unstaged tracked paths, 81 untracked
  entries, 284 expanded untracked files, and zero stashes. R6 added the
  `public/vendor` tree, `public/vendor/manifest.json`, and
  `scripts/selfHostedBrowserDependencies-probe.js`, and edited the affected
  views, `middleware/securityHeaders.js`, `public/sw.js`, two admin client
  scripts, `scripts/quality-gates.js`, and the documentation set. Recalculate
  after every session because the worktree is intentionally dirty.
- The R6 execution prompt in `CLAUDE_HANDOFF.md` has now been executed. It is
  retained under a historical/spent heading as the exact authority R6 ran under,
  so
  the review can check the delivered work against it. It grants no further
  authority.
- R3, all follow-ups, R4, R5, both R5 follow-ups, dependency-security
  remediation, R6, R7, both R7 source-auditability corrections, and expanded
  D7 are complete and Codex GO. `M12.P1-R8` is the next potential section and
  is read-only. R8 requires separate owner authorization and can authorize only
  a separate owner deployment decision, not deployment by itself.

## M12.P1-R7 Vercel Package And Static-CDN Boundary (complete; Codex GO)

`M12.P1-R7` and both source-auditability corrections are complete and Codex GO.
Accepted evidence is focused `71/71`, in-suite `vercel-package-boundary`
`70/70`, full suite `3495/3495` with `QUALITY-GATES OK`, and
`npm audit --omit=dev` at zero vulnerabilities. The `3492/3492` initial
candidate and `3494/3494` literal-NUL remediation candidate remain
historical/superseded. `M12.P1-D7` is now complete and Codex GO. `M12.P1-R8`
is the next potential section and is read-only. `M12.P1` remains NO-GO for
deployment and pilot readiness.

- **New files.** `.vercelignore`, `vercel.json`, and
  `scripts/vercelPackageBoundary-probe.js`. **Edited:**
  `scripts/quality-gates.js` (new `vercel-package-boundary` gate plus the
  retargeted R7-candidate authority predicates) and the documentation set.
  No application view, client script, middleware, controller, route,
  repository, service, schema, migration, or vendor byte was changed.
- **Allowlist.** `.vercelignore` begins with `/*`, re-includes only `server.js`,
  `package.json`, `package-lock.json`, `vercel.json`, and the ten runtime
  directories with their descendants, then denies `public/img/sample 360/` and
  `public/img/sample 360/**` AFTER the `public` re-inclusion so a later
  re-inclusion cannot silently reopen the subtree.
- **Enumerated package at accepted R7 closeout.** 154 files, 6,166,956 bytes,
  aggregate SHA-256
  `c7c16ed73de4b34e1989e6e6842ab897b1164477fb39ddc5862ed1901638b9ec`:
  4 root files, 56 public assets (68 minus the 12 excluded local panoramas),
  `config` 12, `controllers` 15, `middleware` 8, `models` 1, `repositories` 8,
  `routes` 8, `services` 8, `utils` 8, `views` 26. This preview describes the
  CURRENT DIRTY WORKTREE and is explicitly NOT an immutable deployment
  manifest; it cannot become accepted upload evidence until a separately
  authorized clean snapshot exists.
- **Headers.** `vercel.json` has exactly `$schema` and `headers`. Seven narrow
  rules: `nosniff` on `/css/:path*`, `/js/:path*`, `/img/:path*`,
  `/vendor/:path*`, `/manifest.webmanifest`; `no-cache` +
  `Service-Worker-Allowed: /` + `nosniff` on `/sw.js`; `nosniff` +
  `Referrer-Policy: no-referrer` + one fixed static-only CSP on
  `/offline.html`. No `builds`, `functions`, `routes`, `rewrites`, `redirects`,
  framework/build/install override, catch-all matcher, or immutable caching on
  these non-content-hashed URLs.
- **CSP boundary.** `middleware/securityHeaders.js` is untouched and remains the
  sole CSP authority for dynamic responses: per-request nonce preserved,
  `script-src` still exactly `'self'` plus that nonce. The only static CSP is
  the session-neutral offline shell.
- **Entrypoint.** `server.js` is unchanged; it still exports the Express app and
  still listens only as the main module. No `api/` duplicate, adapter, or
  `.vercel` metadata exists.
- **Independence.** The expected root files, runtime directories, forbidden path
  classes, public asset classes, the 18 vendored runtime files, and the header
  contract are pinned in probe code OUTSIDE `.vercelignore` and `vercel.json`,
  so a coordinated configuration-plus-preview edit still fails without a
  reviewed code change.
- **Standalone accounting.** The focused R7 probe is standalone and is never
  registered or counted inside `npm test`, exactly like R1-R6.
  `scripts/probeSessionResidue-probe.js` remains registered exactly once and
  last.
- **Boundaries respected.** `package.json` and `package-lock.json` are byte-
  identical and retain their opening SHA-256 values. No Vercel link, build,
  deploy, or API call; no `.vercel` metadata; no package upload or archive; no
  SQL, migration `0020`, dataset/account/credential change, direct session-row
  deletion, dependency mutation, browser run, or Git-state mutation.
- **Review focus.** The allowlist ordering and vocabulary, the independent pins
  versus the live configuration, the header narrowness, the untouched dynamic
  CSP, the standalone accounting, and whether the console-only preview is
  correctly framed as a dirty-worktree snapshot.
- **Post-review corrections (closed; Codex GO).** The independent Codex R7
  review found a literal `0x00` byte in `scripts/vercelPackageBoundary-probe.js`
  (former line 564, offset 25235) that made the file read as binary; it was
  replaced byte-surgically with the textual `\0` (`0x5c 0x30`), the package
  preview is unchanged, and a frozen audited-source set plus a fail-closed
  `containsLiteralNulByte()` guard it. The re-review then found that the in-suite
  gate trusted the probe's exported `R7_AUDITABLE_SOURCE_FILES` wholesale, so
  swapping `scripts/quality-gates.js` for another NUL-free file (e.g.
  `package.json`) still passed; the gate now pins the list independently in
  `EXPECTED_R7_AUDITABLE_SOURCE_FILES` and requires exact ordered equality with
  the export. Accepted R7 Codex GO evidence is focused `71/71`, in-suite
  `vercel-package-boundary` `70/70`, full suite `3495/3495` with
  `QUALITY-GATES OK`, and `npm audit --omit=dev` at zero vulnerabilities. The
  literal-NUL remediation (`71/71`/`69`/`3494`) and the initial candidate
  (`70/70`/`67`/`3492`) are historical/superseded.

## Copy-Paste Prompt For A New Codex Session

```text
You are Codex for CampuSphere: senior reviewer, security/DB/UI quality gate,
handoff owner, and delivery coordinator.

This is a fresh grounding session. Do not implement, edit, deploy, apply SQL,
access Cloudinary APIs, create migration 0020, or perform Git state-changing
operations. Preserve the intentionally dirty worktree.

Read completely and in this order:
1. CODEX_HANDOFF.md
2. CLAUDE_HANDOFF.md
3. plan.md, including BE.4-BE.6, OFF.1-OFF.6, M12.P1/M12.P2, Interfaces,
   Anti-Scope, and Assumptions
4. ROADMAP.md, especially the routing/privacy/pilot gates, deferred OFF.2-OFF.6,
   and Milestones 12-13
5. AGENTS.md
6. CLAUDE.md
7. CODEBASE_REMEDIATION_PLAN.md
8. fable5_security_bugs_report.md
9. package.json
10. config/selectedDemoFreeze.js and scripts/be6DatasetFreeze-probe.js
11. server.js, middleware/authenticatedHtmlNoStore.js, middleware/roleAuth.js,
    routes/auth.js, and routes/map.js
12. views/map.ejs, public/sw.js, public/js/pwa.js, public/offline.html,
    public/manifest.webmanifest, and public/css/offline.css
13. scripts/quality-gates.js OFF.1 privacy and documentation gates
14. R3 inputs: config/vercelProductionProfile.js, config/sessionConfig.js,
    services/supabaseSessionStore.js, services/mysqlSessionStore.js,
    scripts/with-server.js, and scripts/vercelProductionProfile-probe.js
15. services/routeAvailability.js and the focused building/topology/geometry,
    map-to-VR, guided-CAS, Free Roam, and VR-schedule probes named in plan.md
16. future D7 interfaces: admin building, route-node, route-edge/geometry, and
    schedule routes/controllers/repositories plus their focused probes
17. public/js/admin/building-details-editor.js,
    public/js/admin/admin-buildings.js, views/admin/campus-map.ejs, the D5 CSS,
    scripts/buildingDetailsEditor-probe.js, and scripts/pilotCredentialSafety-probe.js
18. all existing Vercel/deployment configuration and documentation
19. full database/supabase/*.sql migration list
20. git status --short, porcelain count, staged/unstaged name-status summaries,
    and current HEAD

Use the code-reviewer skill before every code, security, database, UI, quality,
deployment finding, and before giving GO. Live repository/database evidence
overrides this prompt, screenshots, reports, memory, and handoffs.

Before acting, inspect the skills, plugins, apps, and MCP tools actually
available in the current session. Use each applicable installed capability when
it materially helps the authorized task, and follow its complete instructions.
Do not assume a capability is available merely because this prompt names it;
report unavailable required tooling and use only a safe authorized fallback.
Tool availability never broadens the task or authorizes database, Cloudinary,
deployment, migration, or Git-state mutations.

Verify this authoritative decision set:
- Milestones 8-11, RF.1-RF.6, and BE.1-BE.6 are Codex GO.
- OFF.1 is complete and Codex GO. /map has its CSRF meta; authenticated
  non-API responses fail closed to Cache-Control: no-store, private; explicit
  API/static/session-neutral shell caching remains intact; the Playwright MCP
  logout -> Back -> reload/direct-revisit isolation check passed.
- OFF.2-OFF.6 are deferred until limited-pilot review, not cancelled, and are
  required before final Milestone 12 GO.
- M12.P1 readiness audit is complete with Codex NO-GO. R1-R7, D1-D5, and
  expanded D7 are complete and Codex GO. This context-only grounding prompt does
  not authorize implementation. M12.P1-R7 and both source-auditability
  corrections are complete and Codex GO. Accepted R7 evidence is focused 71/71,
  in-suite vercel-package-boundary 70/70, full suite 3495/3495 with
  QUALITY-GATES OK, and npm audit --omit=dev at zero vulnerabilities. The
  3492/3492 and 3494/3494 candidates are historical/superseded. D7 accepted
  evidence is the fresh-context role-isolation rerun with separate BrowserContext
  objects per role, both MySQL and Supabase legs completed and cleaned up through
  supported application interfaces, npm test 3511/3511 with QUALITY-GATES OK,
  npm audit --omit=dev at zero vulnerabilities, and 24/24 -> 18/18 -> 46/46
  postconditions with the frozen fingerprint unchanged. R8 is the next potential
  section and is read-only; it requires a separate owner-authorized read-only
  review prompt, and even R8 GO authorizes only a separate owner deployment
  decision. Grounding/readiness is not permission to implement, clean up
  sessions, or deploy.
- R6 self-hosts Leaflet 1.9.4, MapLibre GL JS 4.7.1, Pannellum 2.5.6, Iconify
  Icon 1.0.7, and Lucide 1.25.0 under public/vendor with a provenance manifest,
  and removes unpkg.com, cdn.jsdelivr.net, and code.iconify.design from every
  CSP directive. Provenance is pinned independently of the manifest in
  EXPECTED_VENDOR_INVENTORY (probe code), and disk/HTTP bytes are re-verified
  against those pinned SHA-256s. Review the independent inventory, the preserved
  Leaflet bytes, the CSP contraction, the missing-asset degradation, and the
  standalone/full-suite accounting. Accepted Codex GO evidence: focused 230/230,
  full
  suite 3415/3415 with QUALITY-GATES OK (pre-remediation 3375/3375), safety
  24/24, residue 18/18, BE.6 46/46, audit zero.
- R5 changed only middleware/roleAuth.js, added the standalone
  scripts/boundedAnonymousAccessDenial-probe.js, and added the in-suite
  bounded-anon-denial gate. Review that the two anonymous denial branches audit
  nothing, the authenticated wrong-role branch audits exactly once through the
  authenticated-only helper, the actor guard rejects null/malformed/roleless
  actors, and the 302/401/403 contracts and fixed audit taxonomy are unchanged.
- Expanded D7 is a complete admin-to-participant browser lifecycle in both
  MySQL and Supabase modes. It temporarily creates a uniquely identified
  building, structured details, linked node, forward/reverse geometry edges,
  and public schedule through supported app interfaces; verifies propagation
  and all-reachable-page smoke for student, guest, and instructor; cleans up in
  reverse dependency order; and regates BE.6 plus session safety. It is not
  authorization to test every unrelated admin CRUD surface or repair defects
  inline.
- The eventual pilot exposes the entire authenticated app. Facilitators guide
  students/guests to routing, but other reachable features remain in the
  exposure/security review. No anonymous browsing is added.
- Feedback uses an owner-created Google Form; its URL is pending. Do not add a
  CampuSphere feedback table/API/migration.
- Supabase migrations are exactly 0001-0019; 0014-0019 are owner-applied; no
  0020 exists.
- The current BE.6 baseline retains 13 selected-demo buildings, topology
  20/48/24/48/24/13, VR totals 85/66, and manifest fingerprint
  a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d.
  Both MySQL and Supabase match it after the separately authorized D4
  restoration and complete green regate.
- D5 is complete and Codex GO. The final focused probe passed 153/153, the full
  suite passed 2558/2558 with QUALITY-GATES OK, standalone Playwright MCP
  desktop/mobile and fail-closed negative cases passed, and no verification
  residue remained.
- The latest read-only R1 safety rerun passed 24/24, including zero unexpired
  persisted sessions for all four canonical identities. Do not disclose
  identifiers or directly delete rows.
- Routing uses CampuSphere's own campus graph and owner-managed path_geometry.
  It has no Google Maps, Google Earth, Strava, SIS, or external routing-engine
  dependency.
- The 13 buildings are editable and are not the complete campus; later frozen
  data changes require replacement evidence.
- CAS has the verified 24-scene Guard House-to-CAS guided route and schedule
  target. CCS remains map-routable with truthful guided-VR deferral.
- Guided VR shows arrival only when the final renderable scene belongs to the
  selected destination; partial coverage ends with a truthful coverage notice.
- Numeric IDs remain backend-local: building.id belongs to BUILDING_DATA_SOURCE;
  route_destination_id belongs to ROUTE_DATA_SOURCE; VR IDs belong to
  VR_DATA_SOURCE. Cross-source translation uses canonical names/node/scene keys
  and fails closed on missing, duplicate, orphaned, or ambiguous identity.
- Supabase is the production data/session target; MySQL is local/fallback.
  Preserve Express sessions, bcrypt, Google OAuth, roles, CSRF, CSP, rate
  limits, sanitized errors, PWA privacy, owner-controlled Cloudinary, routing,
  schedules, and truthful VR arrival.

Do not run fixture-writing probes during grounding. Perform only read-only
grounding. Return:
1. Files inspected.
2. Live milestone, migration, topology, VR, OFF.1, and Git truth.
3. Documentation inconsistencies, if any.
4. Current Vercel/deployment surface and exact M12.P1 readiness inputs.
5. Security/privacy blockers or owner inputs required before a pilot apply.
6. Confirmation that grounding changed nothing.

Stop after the grounding report and wait for explicit authorization.
```
