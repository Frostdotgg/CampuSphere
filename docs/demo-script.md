# CampuSphere Defense Demo Script

Milestone 8, Section 8.10. This script is for a controlled defense/demo using
seeded data. Do not use real secrets or private production data on screen.

## Pre-Demo Setup

1. Confirm MySQL is running and seeded:
   ```bash
   node database/seed.js
   ```
2. Confirm Supabase migrations `0001` through `0019` have been owner-applied if
   the demo uses Supabase mode. Migrations `0014` through `0019` provide the
   verified road graph, owner-managed geometry, atomic geometry writes,
   authoritative Guard House topology, CAS baseline, and selected-demo parity;
   `0011` remains required for
   `SESSION_STORE=supabase`.
3. Run the gates and record only final pass lines:
   ```bash
   npm run qa
   npm run qa:db
   npm run qa:identity
   npm run qa:audit
   ```
4. Start the app only with the approved local workflow. Do not run foreground
   long-lived server commands inside Codex. For a human-led demo, `npm start` is
   acceptable in a normal terminal.
5. Use the regression accounts. For a local MySQL rehearsal, the deterministic
   seed fixtures apply (local-only values in `database/seed.js` /
   `scripts/regressionCredentials.js` — deliberately not listed here). For a
   Supabase-backed demo, the four regression identities (admin, student,
   instructor, guest) use private owner-managed passwords available only
   through the test-only `SUPABASE_REGRESSION_*` variables in the ignored
   local `.env` (names in `.env.example`).

No credential value is recorded in this repository; former documented demo
passwords are dead and rejected by the live accounts. Change or remove seeded
local fixtures before any non-demo deployment.

## Talk Track

### 1. Product Overview

- CampuSphere is a role-based campus navigation and information portal for CSPC.
- It uses Express, EJS, server-side sessions, MySQL fallback, and Supabase cloud
  data paths selected by runtime switches.
- Supabase Auth is not used; authentication stays in the Express app with local
  credentials and Google OAuth.

### 2. Authentication And Roles

1. Open `/auth`.
2. Sign in as the seeded student.
3. Show the student dashboard and role-specific navigation.
4. Attempt an admin-only URL and show access is denied.
5. Sign out with the UI logout control.

Expected: logout is POST-only and session cleanup redirects to
`/auth?logged_out=1`.

### 3. Admin Workflow

1. Sign in as the seeded admin.
2. Open the admin dashboard.
3. Create, edit, list, and delete a demo FAQ/news/event item.
4. Show invalid input returns a clean validation error.

Expected: admin CRUD works, non-admin users cannot access admin APIs, and errors
do not expose stacks, SQL, or secrets.

### 4. Campus Navigation

1. Open the public map.
2. Choose a known seeded building and select **Set as Destination**.
3. Show that the line starts at the Guard House, follows the owner-managed road
   geometry, and keeps the route steps in graph order.
4. Open **Set VR Route**. Navigate mapped scenes and show that incomplete scene
   coverage ends with a coverage notice, not a false arrival message.

Expected: map search is capped and sanitized, road geometry renders in graph
order, and VR navigation uses admin-managed non-private data. MySQL freezes 34
buildings, 44 route nodes, 100 directed edges, 50 exact reverse pairs, 100 valid
geometries, and 33 routable destinations; Supabase freezes 25 buildings, 26
route nodes, 50 directed edges, 25 exact reverse pairs, 50 valid geometries,
and 25 routable destinations; Guided VR covers 25 active destinations, 472
configured steps, and 99 unique scene keys.

Arrival requires the configured natural destination node, stored start and
arrival scene mappings, an approved Cloudinary delivery URL and public ID, and
exactly one forward and one reverse scene link for every adjacent scene pair;
otherwise the route remains unavailable and no arrival is reported.

### 5. PWA And Offline Boundary

  OFF.2-OFF.6 are complete and Codex GO on local commit
  `cdbc863b779e5319c14dee21a31a5e78951e233c`. M12.P1-D6 is complete and Codex
  GO on local commit `691f0bef40e06b6ea9485e713d2fe3000a03bd83`. The exact
  19-file offline UI/accessibility/package implementation was independently fully
  verified, committed as `d786bdcb83a196c7263dceae668417d3ced3e95a`, and pushed
  to `origin/main`.

  Its exact committed implementation manifest SHA-256
  `92c689b884f52021f5545f331e8768ffc4768914cf9320c2d4b8fedee7020642` covers 19
  files and 2,072,400 bytes. Replacement full verification passed at
  `4998/4998` with `QUALITY-GATES OK`, five-stage QA at the same exact contract
  total, bounded Chrome acceptance in both supported backends, and ordered
  postconditions `24/24 -> 18/18 -> 46/46`. The package pin is 168 files,
  7,073,128 bytes, aggregate SHA-256
  `1d6cc68b7ef350b6a61eb8d84ea4fb7dd6862bd8548beb7595d3f2e6f4b10d6a`.

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
Replacement full verification passed at `4998/4998` with `QUALITY-GATES OK`,
five-stage QA at the same exact contract total, bounded Chrome acceptance in
both supported backends, and ordered postconditions `24/24 -> 18/18 -> 46/46`.
The clean-commit independent R8 review returned NO-GO solely because stale
operative lifecycle authority still described this pushed, verified commit as
uncommitted and pending; it found no separate runtime, security, database, or
package blocker. This R8 result remains the current external disposition until
a later corrected review.

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
  Replacement verification of the committed implementation passed at
  `4998/4998` with `QUALITY-GATES OK`, five-stage QA, bounded Chrome acceptance
  in both supported backends, and ordered `24/24 -> 18/18 -> 46/46`. The
  implementation is committed and pushed as `d786bdcb83a196c7263dceae668417d3ced3e95a`;
  the clean-commit R8 review returned NO-GO solely for stale lifecycle authority.
  The `494010dd...` manifest is predecessor evidence, not a pin for the later
  documentation/static-assertion correction. Final Milestone 12 disposition
  remains external; no promotion or deployment is authorized here.

1. Show the manifest/offline support and explicitly download the local guide.
2. Demonstrate the accepted local normal campus map, Guard House/Main Gate routes,
   route directions, and the details window opened from a building node/list
   item. Explain that OFF.2-OFF.6 are Codex GO; promotion and deployment remain
   separately owner-authorized.
3. Explain that authenticated HTML, admin routes, auth routes, logout, and
   profile update APIs are never cached by the service worker.

Expected: current PWA behavior improves resilience without storing private
pages. BE.6, OFF.1-OFF.6, and D6 are Codex GO. Pilot review is complete by owner
acceptance. Offline scope contains only 2D Main Gate routing and text building
details—no 360/Guided VR/Free Roam, schedules, or building photos. Final
Milestone 12 disposition remains a separate independent closeout decision.

### 6. Security And Deployment Readiness

Show the accepted pre-offline baseline pass lines from:

```bash
npm run qa
npm run qa:db
npm run qa:identity
npm run qa:audit
```

Explain:

- CSRF protects unsafe requests and logout.
- Rate limiting covers login, OAuth, profile updates, and admin mutations.
- Helmet/CSP blocks inline/eval script execution except nonce-approved code.
- Production sessions use the Supabase session store by default (preferred); the
  server fails closed on unsafe session config, and MySQL remains the explicit
  fallback / local-rehearsal session store only.
- Supabase service-role key is server-only and runtime-env only.
- RF.6 road-following routing is Codex GO. CampuSphere computes routes from its
  own campus graph and owner-managed road geometry; it does not integrate Google
  Maps, Google Earth, Strava, SIS, or another external routing engine.
- Technical Production baseline
  `fea3b2e11c6331eddc1ee091b165427d8e0218d7` is accepted. The authorized push
  automatically triggered Production, and bounded anonymous read-only GET-only
  post-deployment verification passed. Vercel `Auto-assign Custom Production
  Domains` is disabled, so future `main` deployments require manual promotion.
  Documentation/static-assertion commit `db05b54` is `Ready` / `Production` /
  `Staged`, was not promoted, and did not replace the live alias. The human pilot
  occurred on 2026-08-05; the owner accepts it with zero reported findings,
  participant/Form evidence remains external, and its full source-commit
  identity was not independently verified. Pilot review is complete.
   OFF.2-OFF.6 and D6 are complete and Codex GO. The verified implementation
   `d786bdcb83a196c7263dceae668417d3ced3e95a` is committed and pushed; no
   promotion or deployment is authorized, and final Milestone 12 disposition
   remains external to this script.
- The first full verification of that offline candidate is
  historical/rejected at `4635/4641`: `npm test` exited 1 after 4,635 PASS
  lines and emitted no `QUALITY-GATES OK` because exactly six static
  documentation/authority checks failed. All executed runtime, database,
  catalog, BE.6, and final embedded `18/18` residue checks were green; QA and
  the standalone `24/24 -> 18/18 -> 46/46` postconditions did not run. Do not
  present that rejected run as current evidence; the later D6 and OFF.6
  definitive verification supersedes it.
- Docker packaging exists; Docker full deployment finalization is Milestone 13
  and must be verified on a Docker-enabled machine.

## Fallback Plan

- If Google OAuth is unavailable, show the documented fallback:
  `/auth/google` redirects to `/auth?error=oauth_failed`, while local login
  remains functional.
- If Supabase is unavailable, keep all `*_DATA_SOURCE=mysql` and demonstrate the
  MySQL fallback path.
- If internet access is unavailable, avoid CDN-dependent visual claims and focus
  on seeded local flows plus recorded sanitized evidence.
