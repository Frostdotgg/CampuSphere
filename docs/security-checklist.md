# CampuSphere Security Checklist

Milestone 8, Section 8.10. Use this checklist for manual security review and
defense evidence. Record pass/fail and sanitized notes only.

## 2026-08-20 Current Security And Pilot Status

OFF.2-OFF.6 are complete and Codex GO on local commit
`cdbc863b779e5319c14dee21a31a5e78951e233c`. M12.P1-D6 is complete and Codex
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
Milestone 12 GO. Final Milestone 12 disposition remains external. The local
commits and current candidate must not be pushed, promoted, or deployed before
the presentation and a later explicit owner decision.

- The Guided-VR runtime/catalog remediation remains recorded as
  `43627cf0a77741556f4e701711e55612a739799b`, Git tree
  `eb3e830f68d537c4a54d6dda6df7d52a61f9c87b`. The final R8 authority
  synchronization is committed and pushed as
  `fea3b2e11c6331eddc1ee091b165427d8e0218d7`; live Git at post-deployment
  review confirmed branch `main`, local HEAD, and origin/main matched it. The
  authorized push automatically triggered Vercel Production while automatic
  domain assignment was enabled. The owner accepts
  `https://campusphere-cspc.vercel.app` on deployed technical Production
  baseline `fea3b2e11c6331eddc1ee091b165427d8e0218d7`.
- Bounded anonymous read-only GET-only post-deployment verification passed.
  It covered public pages/assets, sampled source-byte identity, anonymous
  protected-route denial, and zero checked `Set-Cookie` responses; it avoided
  `/auth`, did not authenticate, and did not exercise schedule auditing. The
  accepted source package identity is 158 files, 6,245,074 bytes, aggregate
  SHA-256 `b3113c05daaa5d2e870f204083923434456580fa6499190421de062ce9cabbd4`.
- Owner-observed Vercel settings now show `Auto-assign Custom Production
  Domains` disabled. Future `main` pushes may create staged Production
  deployments, but replacing the live alias requires explicit manual
  promotion. This saved-state control was not tested with a dummy push.
- The documentation/static-assertion-only authority synchronization is
  committed and pushed as `db05b549807535840968bf28cdefac4154a6d59d`.
  Live Git then confirmed `main`, local HEAD, and origin/main matched with a
  clean index/worktree. Owner-observed Vercel evidence showed its deployment as
  `Ready` / `Production` / `Staged` with custom-domain assignment `Skipped`.
  It was not promoted or made `Current`; the live alias remained on
  `fea3b2e11c6331eddc1ee091b165427d8e0218d7`.
- Historical/superseded: before this deployment, Production served
  `0627bf78228148e3f989275810c333c16a1f3356`; its accepted five-file and
  anonymous `31/31` evidence remain history.
- The deployed modal correction passed desktop and mobile focus containment,
  outside-focus recapture, Escape close, focus restoration, reduced-motion,
  hidden-overlay pointer safety, and the accepted single-navigation-owner
  contract. The five-file matrix was green at `75/75`, `3777/3777` with
  `QUALITY-GATES OK`, all five QA stages, and `24/24 -> 18/18 -> 46/46`.
- Anonymous production smoke passed `31/31`. `GET /auth` may intentionally
  initialize an anonymous identity-free session. After the owner logged out the
  accessible sessions, exact preflight found one MySQL administrator, one MySQL
  student, and one Supabase administrator session. A first bounded wrapper
  stopped before mutation on a role-label mismatch; the corrected wrapper then
  called the supported `revokeUserSessions()` service exactly once for each of
  those three verified backend-local identities. No direct session-row delete,
  account change, or broad cleanup was used.
- The isolated automated rehearsal PASSed for one temporary CSPC student and
  one temporary Gmail guest. Both were deleted through the supported admin UI,
  all three role sessions were logged out, the seven-user baseline returned,
  and postconditions stayed green. This is not human-pilot evidence.
- Retained execution deviations are security evidence, not erased history: an
  over-broad browser evaluation printed pilot PII to the executor transcript;
  three temporary repository files were created and removed; one read-only
  navigation misclick was corrected; and human sign-in sequencing interrupted
  the automated flow. Do not copy those values into Git or future prompts.
- The one-writer backup and additive reconciliation completed through
  supported interfaces. Isolated Supabase and MySQL restores passed; the
  external backup manifest verifies 109/109 files; and all 86 referenced
  Cloudinary delivery assets were downloaded and hashed. This is not a
  Cloudinary management/original-account export. After visual preflight,
  exactly three redundant MySQL scene-link rows were removed through the
  supported administrator interface; a post-correction MySQL backup passed
  6/6 checksum/isolated-restore checks. No direct SQL was used, and migrations
  remain `0001-0019`.
- Current MySQL truth is 34 buildings / 44 route nodes / 100 edges / 50 exact
  reverse pairs / 100 valid geometries / 671 scenes / 1,396 hotspots. Current
  Supabase truth is 25 / 26 / 50 / 25 / 50 / 664 / 1,372. The shared catalog
  has 25 active Guided-VR destinations, 472 configured steps, and 99 unique
  scene keys. The ordered safety postcondition is green at
  `24/24 -> 18/18 -> 46/46`.
- The current offline UI/accessibility correction candidate package is 168
  files / 7,073,128 bytes /
  SHA-256 `1d6cc68b7ef350b6a61eb8d84ea4fb7dd6862bd8548beb7595d3f2e6f4b10d6a`.
  The rejected pre-correction package was 168 files / 7,071,943 bytes /
  SHA-256 `dd00055741fedecd9d99f081c612f8c18e6573d7a121d5903d866fcebddb0a33`
  and is historical candidate evidence only.
  It is candidate evidence pending independent review, not accepted local
  package or deployment evidence. The accepted local D6/OFF predecessor
  package remains historical at 168 files / 7,042,705 bytes / SHA-256
  `fe08232edf026edcbd33371df7d484bfaf39e3de0dafe22f5144e18e08efbf2b`.
  Historical/rejected after the independent review, never accepted: the first
  D6 candidate at 168 files / 7,022,574 bytes /
  SHA-256 `779d331824026ce0c1c9510e6393790d0a8da508498a395c1e97d9a04c19e7fd`,
  15-file manifest
  `a6202b0f2106f244d58a41fbc1d646f360356df299790d5f88d44fe2729a2bc2`;
  the `+3` files versus the offline candidate are
  `services/adminAnalyticsService.js`, `repositories/analyticsRepository.js`,
  and `public/js/admin/dashboard-analytics.js`, all under already re-included
  directories, and `scripts/adminDashboardAnalytics-probe.js` stays denied by
  the allowlist. Historical/blocked and never accepted: the OFF.3-OFF.5 2D
  offline-navigation candidate at 165 files / 6,971,229 bytes /
  SHA-256 `e383f2fe708c5233192ec3602727ed2029dbc906df1ad53a75a70f6fa583334b`;
  historical/blocked and never accepted: candidate manifest SHA-256
  `af7a1a333db0653449727ee5b6b7f223606686a05717ef6f107607bd99f04e9c` with
  package 165 files / 6,970,280 bytes /
  SHA-256 `fc5d8bdcc7a6482bd256d4504224018cfc56ba418f56d81babd6e0ec5a4ff783`,
  superseded because its service-worker header and API guards were incomplete;
  historical/blocked and never accepted: 165 files / 6,969,343 bytes /
  SHA-256 `2dd88fede872db81a771a9d7273c8fd0264e2f6006d5eee09f33a1b930400523`
  at candidate manifest SHA-256
  `60154d93a3a3109a374a80ffeb4e20f8650aaa131b9b4ff97c16b028cade5f2d`, because
  automatic API caching contradicted the consent-driven offline-package
  boundary and could retain building image references; and 165 files /
  6,968,875 bytes /
  SHA-256 `115dccba1fc4d9707caa5c43cc8bd7f9340bd7d92286513ad562d60af60b100f`;
  independent probe/gate pins are synchronized and focused and registered
  package execution passes `74/74`. The
  accepted technical Production predecessor remains 158 files /
  6,245,074 bytes / aggregate SHA-256
  `b3113c05daaa5d2e870f204083923434456580fa6499190421de062ce9cabbd4`.
- The first full verification of the offline candidate is historical/rejected
  at `4635/4641`: `npm test` exited 1 after 4,635 PASS lines and emitted no
  `QUALITY-GATES OK` because exactly six static documentation/authority checks
  failed. Every executed runtime, database, catalog, BE.6, and final embedded
  `18/18` residue check was green. Fail-closed sequencing stopped before
  `npm run qa` and before the standalone `24/24 -> 18/18 -> 46/46`
  postconditions. At that historical point the bounded correction had focused
  evidence only and no Codex GO. Later independent review and definitive D6 and
  OFF.6 verification supersede it; no session or data correction was required.
- A fourth bounded correction made the service-worker header truthful and the
  API guards exact. The header no longer claims api/external caches or approved
  cross-origin caching: it now states that only the shell and static caches
  exist, that only exact reviewed shell assets are Cache Storage eligible, that
  every cross-origin and every same-origin `/api` request is network-only, that
  `API_CACHE`/`EXTERNAL_CACHE`/approved-host caching/synthesized API fallback
  responses do not exist, and that the successful-response and never-cache-a-
  redirect rules apply only to reviewed shell/static caching. The edit is
  documentation-only — the comment-stripped `public/sw.js` SHA-256 is identical
  before and after (`fc043eae18d05710f94539a1434131a5a8132401c3dfdd0a1f92cf1b306feb6d`),
  so executable behaviour is unchanged. The OFF.2 analyzer, the quality gate and
  the self-hosted probe now each require exactly one `/api` network-only prefix,
  the complete classifier truth table evaluated behaviourally in an isolated
  `node:vm` (true for `/api`, `/api/buildings`, `/api/routes`, `/api/routes/1`,
  `/api/vr/routes/1`, `/api/search`, `/api/pathfind`; false for `/apiary`,
  `/apis`, `/auth`, `/map`, `/`), `CURRENT_CACHES` tokenizing to exactly
  `[SHELL_CACHE, STATIC_CACHE]`, absent API machinery, and the guard running
  before every remaining same-origin strategy — failing closed on any extraction
  or evaluation error. The compound rejecting fixture additionally rejects an
  always-false classifier and a third cache in `CURRENT_CACHES`. No GO is
  claimed.
- Historical/blocked: a third bounded correction removed automatic API caching entirely. Every
  same-origin API request is network-only: `/api/buildings`, `/api/routes`,
  every `/api/routes/*` path, `/api/vr/routes/*`, `/api/search`,
  `/api/pathfind`, and every query-string variant, matched by a single `/api`
  network-only prefix on pathname. `API_CACHE`, `API_MAX`, `isApprovedApi()`,
  `apiStrategy()`, the synthesized offline JSON response and the approved-API
  fetch branch were removed rather than disabled, and `CURRENT_CACHES` now holds
  only the shell and static caches. The driver is the consent boundary:
  `/api/buildings` and `/api/routes*` return building rows carrying Cloudinary
  image URLs and local building-photo references, so caching them retained media
  references the user never explicitly downloaded. The worker performs no
  `respondWith()`, no Cache Storage read or write, and no response
  transformation on any API request, so online response shapes, headers and
  status codes are exactly what the server sends. `CACHE_VERSION` advanced once
  `v14` -> `v15`, evicting the unaccepted local v14 shell/static/API caches and
  every older CampuSphere generation while preserving unrelated caches. Focused
  evidence after this correction is OFF.2 `145/145`, 2D offline navigation
  `35/35`, and package boundary `74/74`, with runtime proof of zero interception
  and byte-identical cache contents across ten API requests whose JSON body
  carried both a Cloudinary URL and a local building-photo reference. No GO is
  claimed.
- Historical/blocked: a second bounded correction confined Cache Storage to the approved 2D scope.
  The ONLY same-origin requests eligible for Cache Storage are the exact
  reviewed shell assets, matched by pathname plus query string against a set
  derived from `PRECACHE_URLS` (`/css/styles.css?v=5` matches;
  `/css/styles.css?v=6` does not). The former extension-wide rule is gone, so
  local database-selected building photos, `/img/campus-hero.jpg`, arbitrary
  `/img/*.jpg`, `/img/vr/` panoramas, and non-shell admin CSS/JS are all
  network-only. EVERY cross-origin request is network-only, including
  `tile.openstreetmap.org` and its a/b/c subdomains and `res.cloudinary.com`;
  the external cache constant, size cap, host classifier, cross-origin strategy
  and mode helper were removed rather than left dormant, and the external cache
  is gone from `CURRENT_CACHES`. Online OSM remains CSP-permitted and the online
  Leaflet/MapLibre map is unchanged; offline map rendering uses the bundled
  content-addressed PMTiles archive. `CACHE_VERSION` advanced once `v13` ->
  `v14`, evicting the unaccepted local v13 shell/static/API/external caches
  while preserving unrelated caches. Focused evidence after this correction is
  OFF.2 `145/145`, 2D offline navigation `35/35`, and package boundary `74/74`,
  with runtime proof of zero interception and byte-identical cache contents for
  same-origin photos, panoramas, non-shell scripts/styles, query-modified shell
  paths, OSM apex and subdomain tiles, Cloudinary, and Guided-VR route JSON. No
  GO is claimed.
- Historical/blocked: a bounded offline-scope correction narrowed the service-worker cache boundary:
  `/api/vr/routes/*` and every `res.cloudinary.com` request are network-only and
  never Cache Storage eligible, leaving OpenStreetMap tiles as the only
  cache-eligible external host. Online Guided-VR and Cloudinary delivery are
  unchanged because the worker declines those requests rather than blocking or
  rewriting them. `CACHE_VERSION` advanced once `v12` -> `v13` so activation
  evicts the preceding v12 API/external caches while preserving unrelated
  caches. Explicit-logout deletion of `campusphere-offline-guide` is now durable:
  an exact namespaced pending marker is written before `logged_out=1` is
  stripped, cleared only on a confirmed `deleteDatabase`, retried on later page
  loads, and coalesced across concurrent attempts, touching no unrelated
  database, cache, localStorage key, session, or application data. Focused
  evidence after the correction is OFF.2 `145/145`, 2D offline navigation
  `35/35`, and package boundary `74/74`; adversarial VR-route and Cloudinary
  requests are proven neither intercepted nor cached, each with a rejecting
  mutation. No GO is claimed.
  The failed QA attempt
  that stopped at 4,512 contract passes
  after mixed-mode `ECONNRESET` remains historical/rejected. Its incomplete
  logout left exactly one canonical Supabase student session. A separately
  authorized fail-closed preflight reverified the intended-role identity, that
  one session, and zero for the other three canonical Supabase identities;
  `revokeUserSessions()` was then called exactly once for the student. No direct
  SQL, direct session-row deletion, account/application-data change, or broad
  cleanup occurred.
- The independent read-only review of prior candidate manifest SHA-256
  `b4c2c3c2a5766399b843c6e43f2f8cf347bcc04473e5ba6a0a808397c77a3d56`
  returned commit-readiness NO-GO on the incomplete CAS sequence guard, a stale
  SEC-37 package claim, obsolete OFF.3 scope, and premature pilot sequencing.
  The bounded follow-up pins the ordered CAS hash, rejects intermediate
  replacement/reordering and malformed hash pins, validates SEC-37 against the
  independent package pin, and restores the complete authorization order. The
  prior manifest is historical; at that point the corrected bytes required an
  independent read-only review.
- A subsequent independent read-only review of exact 33-file manifest SHA-256
  `2f78d9754094572ac2b6a2bec02786d66b35a651141cd8c0f5705ac85d1282a8`
  returned commit-readiness NO-GO because the exact package pin was not applied
  to the live manifest, obsolete handoff policy was not isolated from current
  authority, and current dates were stale. This bounded correction adds two
  independent live package pins, byte-drift and authority/date fixtures,
  explicit historical boundaries, and synchronized dates. It changed no
  runtime or data; at that historical point independent review remained open.
- The independent read-only review of exact 34-file manifest SHA-256
  `ebf1142c11e3c027c0b3339a6888bc19196936ae3323644d907c68def224c4b4`
  returned commit-readiness NO-GO because the same rejected 4,628-PASS retry
  carried a transcript-faithful nine-failure account and a duplicate lower-count
  account in current authority. The correction removes that duplicate and adds
  a cross-document analyzer with accepting/rejecting fixtures. Runtime and data
  are unchanged; the latest external review report controls its disposition.
- The correction's first verification is historical/rejected at `4640/4641`:
  one combined documentation assertion failed because the analyzer stopped at
  the first 4,628 mention. Runtime probes and embedded `18/18` residue were
  green. The analyzer now checks every bounded 4,628 scope; no session or data
  correction was required.
- Under a separate bounded authorization, a fail-closed preflight reverified
  exactly two unexpired sessions for the one intended-role canonical MySQL
  student, zero for the canonical MySQL administrator and all four canonical
  Supabase identities, and the explicitly selected MySQL session store. One
  supported `revokeUserSessions()` call removed both student sessions. No
  direct session-row deletion, account/application-data change, or broad
  cleanup occurred. The pre-QA ordered postcondition is green at
  `24/24 -> 18/18 -> 46/46`.
- The exact synchronized candidate passes a freshly counted `npm test` at
  `4641/4641` with `QUALITY-GATES OK` and `npm run qa` at the same exact
  contract total with all five stages green and all exact transcript markers
  present. Final ordered
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
  historical/rejected. Live Git and the latest external review report control
  the bounded authority follow-up's commit/push/R8 disposition.
- The first authority-follow-up execution is historical/rejected at
  `4635/4641`: six static lifecycle/documentation checks failed, while all
  runtime, database, catalog, BE.6, and embedded residue probes were green,
  including `18/18`. The labels, predicates, and prompts were corrected before
  a fresh rerun; no session or data correction was needed.
- The first integrated read-only M12.P1-R8 review of clean commit `43627cf`
  reverified package inventory 158 / 6,245,074 /
  `b3113c05daaa5d2e870f204083923434456580fa6499190421de062ce9cabbd4`,
  `npm test` `4641/4641` with `QUALITY-GATES OK`, five-stage QA at the same
  contract total, and final `24/24 -> 18/18 -> 46/46`. It returned R8 NO-GO
  solely for stale operative Git-lifecycle wording and found no separate
  runtime, security, database, or package blocker. Required lifecycle is
  independent commit-readiness review -> local commit -> separately authorized
  push -> clean-commit R8 re-review.
- The first verification of this state-neutral lifecycle correction is
  historical/rejected at `4639/4641`: one combined lifecycle/history assertion
  still detected self-expiring review claims outside the primary current blocks,
  and one evidence-row classifier required the obsolete word `candidate`.
  Runtime, database, Guided-VR, BE.6, and embedded `18/18` residue checks were
  green. Those static contracts were corrected; the definitive rerun passed
  `4641/4641` with `QUALITY-GATES OK`, the five-stage QA rerun was green at the
  same total, and final postconditions were `24/24 -> 18/18 -> 46/46`. No session
  or data correction was required.
- The independent read-only review of exact 11-file manifest SHA-256
  `4d37507071089be4f6ce92404465a28334f9a03dbad82d02dfde2b013c3183ad`
  returned R8 NO-GO solely for self-expiring lifecycle authority in the current
  reusable Claude prompt and incomplete lifecycle-matcher coverage. The bounded
  correction makes both current prompts state-neutral and adds lifecycle
  rejection fixtures to the existing reusable-prompt assertion. It changes no
  runtime, data, session, or package bytes.
- Its first verification execution is historical/rejected at `4640/4641`:
  the new negative-fixture group exposed that the analyzer rejected qualified
  review phrases but not the generic `independent review` equivalent. All
  application, backend, Guided-VR, BE.6, and final embedded residue checks were
  green. The matcher now rejects both forms; no runtime, data, session, or
  package correction was required.
- The first verification of the exact original-phrase coverage is
  historical/rejected at `4639/4641`: the reverse-order matcher was initially
  too broad and treated clearly historical `pending`/`required` review prose as
  operative. Every executed runtime/backend probe and the final embedded
  `18/18` residue gate were green. The matcher is now confined to the original
  `open independent ... review` word order plus the already covered forward
  forms; no runtime, data, session, or package correction was required.
- The subsequent independent read-only review of exact 11-file manifest
  SHA-256 `c4a4c2b5bd592c00126f06736e8f8587d0de3dde189b506177bd764fddf3a192`
  returned R8 NO-GO solely for the uncovered exact open-before-review phrase;
  it found no other blocker. The narrowed correction passed `npm test`
  `4641/4641`, full five-stage QA, and final `24/24 -> 18/18 -> 46/46`.
  Its verified pre-handoff manifest was
  `bd9a68ea8b7d2094d9fad54b561ed773852e30686646fcb446e9a3febfba2499`.
  That hash is predecessor evidence, not a pin for the later handoff bytes;
  live Git and a fresh manifest control the new candidate.
- The first full verification of the fresh-session handoff synchronization is
  historical/rejected at `4638/4641`: three static documentation checks failed
  because the new manifest values were not all presented with the analyzer's
  explicit `SHA-256` label and both reusable prompts omitted the literal
  deployment-authorization denial required by the current prompt contract.
  All executed runtime/backend probes and the final embedded `18/18` residue
  gate were green. The labels and prompt denials are corrected; no runtime,
  database, session, package, or vendor correction was required.
- A subsequent full-suite attempt is historical/rejected because the temporary
  server for `publicRoadRouteRendering-probe.js` did not become ready on its
  dedicated port. All earlier checks in that run and the final embedded
  `18/18` residue gate were green; no listener or CampuSphere Node process
  remained. The focused probe then passed immediately in both runtime modes.
  No repository, database, session, package, or vendor correction was required
  for that transient harness-start failure.
- Fresh-session authority is state-neutral: Codex and Claude Code both ground
  current truth and then wait for the owner. Neither prompt authorizes further
  implementation, Git mutation, a new deployment or promotion, another pilot,
  or Milestone 12 GO.
- The owner attests that a human pilot occurred on 2026-08-05 and accepts it
  with zero reported findings. Participant/Form evidence remains external and
  no participant PII is recorded in Git. The tested build's full source-commit
  identity was not independently verified, so this is owner-attested pilot
  acceptance rather than independent current-build verification. Pilot review
  is complete for sequencing purposes. OFF.2-OFF.6 and D6 are complete and
  Codex GO on local commits `cdbc863b779e5319c14dee21a31a5e78951e233c` and
  `691f0bef40e06b6ea9485e713d2fe3000a03bd83`. D6 passed `npm test` at
  `4998/4998` with `QUALITY-GATES OK`, ordinary D6 `266/266`, five-stage
  `npm run qa` at the same exact contract total, and ordered postconditions
  `24/24 -> 18/18 -> 46/46`; OFF.6 browser acceptance passed in both
  backends and the immutable replacement suite passed `4998/4998` with D6
  `266/266`, BE.6 `46/46`, and embedded residue `18/18` after supported
  restoration of the discovered Supabase route-edge 198/199 geometry drift.
- Never share service-role, DB, OAuth, session, or Cloudinary secrets with
  editors; never use direct SQL or blanket deletion for operational
  convenience.

Final Milestone 12 disposition remains external to this checklist. The local
commits must not be pushed, promoted, or deployed before the presentation and a
later explicit owner decision. This checklist records evidence only and
authorizes no mutation, deployment, or promotion.

## Historical/Superseded — 2026-07-30 R8 Review Status

The following note is retained as historical evidence and must not be read as
the current deployment, Git, database, or R8 disposition.

This note overrides lower rows that still use the word "current" for an older
uncommitted SEC-51 gate candidate. The `3752`, `3755`, `3760`, and `3763` runs
are historical/superseded or rejected and are not accepted R8 evidence. The
historical SEC-51 production result for the earlier accepted runtime baseline
`d422b54393f659125912ec5c84ae7927c2533288` remains accepted. Independently
verified database postconditions are now `24/24 -> 18/18 -> 46/46`: the leaked
hotspot and schedule are absent, all canonical Supabase sessions are clean,
MySQL is clean, and the frozen fingerprints are restored. Before the separately
authorized 2026-07-30 restoration, the historical state was
`22/24 -> 16/18 -> 41/46`; that superseded incident is not current truth. The
first 3,772-check authority/audit/total-consistency execution is rejected:
3,742 checks passed, 30 static contracts failed, exit code was 1, and no
`QUALITY-GATES OK` marker was produced. The later 3,774/3,777 frozen-candidate
matrix also remains rejected after three `docs-current` failures, exit 1, and
no `QUALITY-GATES OK`. An earlier frozen 12-file matrix was recorded as green
`3777/3777`; that record is superseded and rejected, because a fresh execution
against those exact frozen bytes exited 1 at `3776/3777` with one static
failure, `cloudinary-docs :: docs contain no JWT/PEM/AWS/long-hex secret
values`, raised by an unlabeled 40-hex Repository HEAD value in the then-current
`docs/deployment.md`.

A bounded documentation-only correction labelled that value as `Repository HEAD`
and preserved the truthful claim that
`db034e5581e6f409083a43dcb80fb82b473e0127` is a documentation-only commit and
gate-work candidate, not a runtime deployment. `scripts/quality-gates.js` was
not changed by that correction, and the exact frozen 12-file manifest is pinned
in `docs/test-evidence.md`. A byte-consistent matrix was then executed once
against the corrected manifest: preflight and postflight matched 12/12 hashes
with Git, migration, and process state unchanged; `node --check` exited 0 for
both audited sources and `git diff --check` exited 0 with only LF/CRLF
advisories; the logout probe passed `75/75` at exit 0 with zero FAIL/ERROR/SKIP
and zero escaped or literal logout-error lines; `npm test` exited 0 at
`3777/3777` with `QUALITY-GATES OK` present and `QUALITY-GATES FAILED` absent;
`npm run qa` exited 0 with exactly 3,777 contract PASS lines before
`QUALITY-GATES OK` and all five green markers exactly once; and the final
ordered postconditions were `24/24 -> 18/18 -> 46/46` at exit 0 each. The two
wrapper-only overmatches caused no application failure or retry. That `3777`
figure is a transcript-wide PASS-line reconciliation across parent and inherited
spawned-probe stdout, not an in-process `makeRecorder` counter.

This byte-consistent result was candidate evidence at that historical point;
its disposition is preserved by the corresponding external review. No current
R8, SEC-51, deployment, pilot, or Milestone 12 GO follows from that record.

Accepted readiness evidence remains explicit. The dependency-security
remediation is complete and Codex GO: a subsequent 2026-07-26 advisory drift
was remediated, production pins `ejs@6.0.1`, the
`jake/filelist/minimatch/brace-expansion` chain is absent, and
`npm audit --omit=dev` reports zero vulnerabilities. M12.P1-R7 is complete and
Codex GO; accepted R7 evidence is focused `71/71`, in-suite
`vercel-package-boundary` `70/70`, full suite `3495/3495` with
`QUALITY-GATES OK`, and audit zero, while `3492/3492` and `3494/3494` are
historical/superseded. Expanded D7 is complete and Codex GO; accepted D7
evidence is the fresh-context role-isolation run with separate browser
contexts, `3511/3511` with `QUALITY-GATES OK`, audit zero, and
`24/24 -> 18/18 -> 46/46` with the frozen fingerprint unchanged.

**Restoration audit disclosure.** The historical restoration report overstated
append-only audit effects. At execution time, `admin.schedule.delete` was not
allowlisted and its audit request was refused; `POST /logout` records no
audit-service event. The present three-action allowlist repair is prospective
only. No retroactive audit row or new logout-audit contract is claimed. Extra
read-only probe passes and a persistent Claude-memory write are retained as
execution-boundary disclosures rather than presented as strict one-run
adherence.

## Redaction Rules

- Never store real cookies, session IDs, OAuth codes, service-role keys, OAuth
  secrets, DB passwords, `.env` contents, raw stack traces, SQL text, or private
  production rows in this repo.
- For screenshots, crop browser devtools and terminal output unless the values
  are confirmed safe placeholders.

## Manual Security Cases

| ID | Area | Test | Expected result | Status | Notes/evidence |
| --- | --- | --- | --- | --- | --- |
| SEC-01 | RBAC bypass | Request `/admin` and `/admin/api/*` as anonymous | 401 JSON for API or auth redirect/denial for browser | PASS (automated) | `npm test`, both backends: `Unauth admin API -> 401 JSON {success:false}`, plus the L3 anonymous set (`/buildings` -> 302 `/auth`, `/api/buildings` -> 401 JSON, no session cookie minted on any of them) |
| SEC-02 | RBAC bypass | Request admin APIs as seeded student | 403 JSON; no mutation | **PASS (clean bounded re-execution)** | M12.P1-R8 local authenticated exposure matrix — the CLEAN bounded re-execution described in SEC-49, run in BOTH MySQL and Supabase runtime modes with a separate Playwright BrowserContext per role, each proven to carry zero cookies and zero web storage before authentication. Totals: MySQL 34/34, Supabase 64/64, plus a 14/14 supplement per backend, 126/126 with zero failures. Student, instructor, and guest each received the fixed 403 JSON on `/admin/api/*`; no mutation was accepted. |
| SEC-03 | Guest boundary | Use guest/student account on restricted admin pages | Access denied; no private admin data | **PASS (clean bounded re-execution)** | M12.P1-R8 local authenticated exposure matrix — the CLEAN bounded re-execution described in SEC-49, run in BOTH MySQL and Supabase runtime modes with a separate Playwright BrowserContext per role, each proven to carry zero cookies and zero web storage before authentication. Totals: MySQL 34/34, Supabase 64/64, plus a 14/14 supplement per backend, 126/126 with zero failures. Student, instructor, and guest each received the 403 HTML denial on `/admin`; no private admin data was rendered. |
| SEC-04 | Registration trust | Try local sign-up with `admin`, `student-cspc`, `instructor` | Rejected or forced guest per policy | **PASS (clean bounded re-execution)** | M12.P1-R8 local authenticated exposure matrix — the CLEAN bounded re-execution described in SEC-49, run in BOTH MySQL and Supabase runtime modes with a separate Playwright BrowserContext per role, each proven to carry zero cookies and zero web storage before authentication. Totals: MySQL 34/34, Supabase 64/64, plus a 14/14 supplement per backend, 126/126 with zero failures. Local sign-up attempts requesting `admin`, `instructor`, and `student-cspc` were each refused escalation in both backends. Guest-only creation is enforced twice: the controller guard and the SQL boundary in `0009_public_registration_trust_policy.sql`. |
| SEC-05 | OAuth domain policy | Drive the unsupported-domain Google OAuth flow from a fresh anonymous browser context | Rejected with a sanitized error; nothing created | **PASS (externally executed)** | M12.P1-R8 bounded evidence re-execution. Proven facts only: the flow reached `accounts.google.com` requesting exactly `openid`, `email` and `profile`; the unsupported-domain Google account completed Google authorization and returned to CampuSphere; CampuSphere redirected to `/auth?error=unauthorized_domain`; the displayed rejection was sanitized and echoed no email address and no raw error; Supabase `users` held 6 rows before and 6 rows after with zero rows on unsupported domains; no user row and no role-profile row was created; and no pending OAuth registration persisted. No test email, password, OAuth code, token, cookie, or account identifier is recorded. No OAuth scope, credential, redirect URI, publishing status, or test-user configuration was changed. |
| SEC-06 | CSRF | POST unsafe route without token | 403 `{ success:false, message:"Invalid request token" }` for API or generic browser error | PASS (automated) | `npm test`, both backends: `CSRF missing -> 403 JSON "Invalid request token"` |
| SEC-07 | Logout method | GET `/logout` | 405 and session remains intact | PASS (automated) | `npm test`, both backends: `GET /logout stays 405 with Allow: POST` |
| SEC-08 | Session fixation | Login after anonymous session | Session ID changes after auth | **PASS (clean bounded re-execution)** | M12.P1-R8 local authenticated exposure matrix — the CLEAN bounded re-execution described in SEC-49, run in BOTH MySQL and Supabase runtime modes with a separate Playwright BrowserContext per role, each proven to carry zero cookies and zero web storage before authentication. Totals: MySQL 34/34, Supabase 64/64, plus a 14/14 supplement per backend, 126/126 with zero failures. An anonymous `/auth` visit mints a session; after authentication the session identifier was compared in memory and had CHANGED in both backends. Cookie values were never printed. |
| SEC-09 | Session expiry/tamper | Reuse old/tampered cookie | Request is denied or treated anonymous | **PASS (clean bounded re-execution)** | M12.P1-R8 local authenticated exposure matrix — the CLEAN bounded re-execution described in SEC-49, run in BOTH MySQL and Supabase runtime modes with a separate Playwright BrowserContext per role, each proven to carry zero cookies and zero web storage before authentication. Totals: MySQL 34/34, Supabase 64/64, plus a 14/14 supplement per backend, 126/126 with zero failures. Both halves executed: a TAMPERED session cookie was rejected with 302 to `/auth`, and the valid pre-logout cookie was rejected the same way when replayed in a clean context after logout. |
| SEC-10 | Injection payloads | Submit SQL-like strings in search/forms | Parameterized handling; sanitized validation; no SQL leak | **PASS (clean bounded re-execution)** | M12.P1-R8 local authenticated exposure matrix — the CLEAN bounded re-execution described in SEC-49, run in BOTH MySQL and Supabase runtime modes with a separate Playwright BrowserContext per role, each proven to carry zero cookies and zero web storage before authentication. Totals: MySQL 34/34, Supabase 64/64, plus a 14/14 supplement per backend, 126/126 with zero failures. Four SQL-like payloads were submitted to the authenticated search endpoint in both backends; every response was a sane 200/400/404 and none contained SQL syntax, SQLSTATE, MySQL `ER_*` codes, PostgREST/pg text, or a stack frame. |
| SEC-11 | Stored XSS | Submit HTML/script-like content in admin content fields | Rendered as escaped/inert text or blocked by CSP | **PASS (clean bounded re-execution)** | M12.P1-R8 local authenticated exposure matrix — the CLEAN bounded re-execution described in SEC-49, run in BOTH MySQL and Supabase runtime modes with a separate Playwright BrowserContext per role, each proven to carry zero cookies and zero web storage before authentication. Totals: MySQL 34/34, Supabase 64/64, plus a 14/14 supplement per backend, 126/126 with zero failures. A script-and-onerror payload was stored through the admin FAQ API, then the admin page was rendered: the payload did NOT execute, was never emitted as a raw executable script element, and raised zero CSP violations and zero page errors. The fixture was deleted through the same admin API with zero residue. |
| SEC-12 | Error contract | Request unknown `/api/*` route | 404 JSON `{ success:false, message }`, no HTML for API caller | PASS (automated) | `npm test`, both backends: unknown `/api/*` 404 JSON and `Malformed JSON -> 400 JSON {success:false}` |
| SEC-13 | Error leak | Trigger malformed JSON and validation failures | No stack, SQL, DB internals, Supabase host/key/JWT, cookie, or session ID in response | PASS (automated) | `npm test`, both backends: leak scans for stack frames, SQL/driver/PostgREST text, MySQL driver codes, JWT-like tokens, Supabase host, session cookie values, and Supabase/Cloudinary credential names all clean |
| SEC-14 | Rate limiting | Exceed configured login/auth/admin/profile limits in a test env | 429 with sanitized message and `Retry-After` | PASS (automated) | In-suite `shared-rate-limit` gate plus M12.P1-R4 focused `180/180`, including the authoritative-PTTL `Retry-After` case (SEC-24) |
| SEC-15 | PWA privacy | Inspect `public/sw.js` behavior | Auth/admin/profile/logout pages are never cached/intercepted | **PASS (automated)** | In-suite OFF.1/R2 PWA-privacy gates in `npm test`: `public/sw.js` is network-only for all same-origin navigations, caches no HTML, and authenticated responses carry exact `no-store, private`. |
| SEC-16 | Secret handling | Inspect Docker/package/docs | `.env`, real keys, screenshots, dumps, and `node_modules` not copied into image or docs | **PASS (automated)** | In-suite `vercel-package-boundary` (SEC-37), `sample-360`, and `db-dump` gates plus the M12.P1-R7 focused probe 71/71: no `.env*`, key, screenshot, dump, or `node_modules` is inside the deployment package, the Docker image, or the docs. |
| SEC-17 | Supabase privilege | Search rendered pages/public JS for service-role values | Variable value never appears client-side | **PASS (automated)** | In-suite leak scans in both backends (no Supabase host, JWT-like token, or credential name in any response body) plus M12.P1-R2 119/119, which rejects a browser/publishable key acting as the server secret. |
| SEC-18 | Production session config | Start with unsafe production session env in controlled probe | Server exits non-zero with sanitized fixed reason | **PASS (automated)** | M12.P1-R2 focused probe 119/119: with `VERCEL=1` and a missing/blank/invalid production-profile value the server exits non-zero with one fixed sanitized refusal, opening no listener and no session store. |
| SEC-19 | Shared rate-limit config | Start with `VERCEL=1` and a missing/blank/short `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, or `RATE_LIMIT_KEY_SECRET` (< 32 chars) | Server exits non-zero with the one fixed sanitized refusal; the offending variable and its value are never echoed | **PASS (automated)** | M12.P1-R2 119/119 (fail-closed profile, including missing `UPSTASH_REDIS_REST_URL`/`_TOKEN` and a short `RATE_LIMIT_KEY_SECRET`) and M12.P1-R4 180/180. The offending variable and its value are never echoed. |
| SEC-20 | Shared rate-limit privacy | Inspect the rate-limit keys/values written to the shared store | Keys are only `csrl:v1:<scope>:<HMAC-SHA-256 digest>` and values are a bare integer counter; no raw IP, email, user ID, cookie, session ID, token, secret, or submitted content | **PASS (automated)** | M12.P1-R4 focused 180/180 and in-suite `shared-rate-limit` 88/88: keys are only `csrl:v1:<scope>:<HMAC-SHA-256 digest>` and values a bare integer counter. |
| SEC-21 | Shared store outage | Make the shared rate-limit store unreachable (or return a malformed reply) on Vercel | One fixed sanitized `503` with `Cache-Control: no-store`; the request is never passed through and never falls back to a process-local Map; no URL/token/key/command/reply/stack is exposed | **PASS (automated)** | M12.P1-R4 focused 180/180: an unusable shared store yields one fixed sanitized 503 with `Cache-Control: no-store`, never a pass-through and never a process-local Map fallback. |
| SEC-22 | Shared rate-limit exposure | Search rendered pages, `public/`, and browser globals for the Upstash URL/token and `RATE_LIMIT_KEY_SECRET` | No value ever appears client-side, in a response, or in logs | **PASS (automated)** | M12.P1-R4 180/180 plus in-suite leak scans and the `shared-rate-limit` gate: no Upstash URL/token or `RATE_LIMIT_KEY_SECRET` appears client-side, in a response, or in logs. |
| SEC-23 | Shared store retry amplification | Make the shared rate-limit transport fail and count transport attempts for one counted request | Exactly **one** attempt (`retry: { retries: 0 }`); no retry storm, no backoff timer, and no added latency during an outage. `retry: false` is NOT acceptable — in `1.38.0` it still performs two attempts | PASS (automated) | R4 focused `180/180`; real SDK request loop exercised with rejecting fetch stub |
| SEC-24 | Truthful `Retry-After` | Force a stored bucket whose Redis `PTTL` exceeds the configured window, then trigger a `429` | `Retry-After` reflects the authoritative `PTTL`, never a clamp to the configured window, so a client that waits the advertised time is not immediately re-limited | PASS (automated) | R4 focused `180/180`; 120-second authoritative TTL preserved under 60-second configuration |
| SEC-25 | Lua lock scope | Inspect the shared-counter script and its `EVAL` invocation | First line is `#!lua flags=allow-key-locking`; exactly one key is passed; only `KEYS[1]` is accessed; no global-database-lock fallback and no database-wide write (`FLUSHDB`/`FLUSHALL`/`SCAN`) | PASS (automated) | R4 focused `180/180` and in-suite shared-rate-limit gate `88/88` |
| SEC-26 | Production dependency audit | Audit the production dependency graph after the compatible lockfile remediation | Zero vulnerabilities; `body-parser@2.3.0` and `brace-expansion@2.1.2`; no direct dependency, override, `--force`, or major framework upgrade | PASS | `npm audit --omit=dev` and `npm run qa:audit` both green; dependency remediation Codex GO |
| SEC-27 | Anonymous audit-write amplification | Send repeated anonymous requests to a login-gated route (`GET /dashboard`) and a role-gated JSON route (`GET /admin/api/logs`), then read the admin log API | Denials are unchanged (`302` to `/auth`; fixed `401` JSON) and **zero** `system_logs` rows of any taxonomy are created — proven by both the authoritative unfiltered `summary.total` staying flat and the filtered `authorization`/`access.denied`/`denied` count staying flat; no anonymous-denial table, raw IP, or Redis denial record exists | PASS (automated) | M12.P1-R5 focused `90/90` (ten browser + ten JSON anonymous requests per backend, plus the global-total baseline/postcondition); accepted Codex GO |
| SEC-28 | Retained authorization-denial audit | Sign in as the student regression identity and request `/admin/api/logs` | Exact fixed `403` JSON; **exactly one** sanitized row with `event_type=authorization`, `action=access.denied`, `outcome=denied`, the intended actor role, a positive actor id, `target_type=route`, a query-free `target_id`, the fixed message, and `attempted_email` null | PASS (automated) | M12.P1-R5 focused `90/90` in MySQL and Supabase; accepted Codex GO |
| SEC-29 | Null-actor audit guard | Drive the exported `isAuditableActor` with null, missing, malformed, zero/negative/fractional/non-numeric id, and roleless/blank-role actors | Every non-authenticated actor is refused before `auditService.record` is reached; only a positive integer id plus a non-blank role is accepted | PASS (automated) | In-suite `bounded-anon-denial` gate: 18 refused actor shapes plus source-mutation negative fixtures |
| SEC-30 | Preserved authentication-failure audit | Submit one deliberately invalid login through the supported CSRF flow | Normal sanitized rejection; **exactly one** `authentication`/`login.local`/`failure` row with the normalized attempted identity and no submitted password | PASS (automated) | M12.P1-R5 focused `90/90`; canary password generated in memory and never printed |
| SEC-31 | Authoritative global-total unchanged | Capture a stable unfiltered `system_logs` total before the anonymous batches (accepted only after two consecutive equal reads), then re-read it after both batches | The authoritative `summary.total` is unchanged across six consecutive reads, so the twenty anonymous denials added no row of any taxonomy; a filtered count is never substituted for the global count, and any malformed/missing count fails closed | PASS (automated) | M12.P1-R5 focused `90/90` plus in-suite `bounded-anon-denial` database-free helper drives and source-mutation fixtures |
| SEC-32 | No remote executable browser dependencies | Inspect rendered affected pages, CSP, and the browser network log | Exact reviewed Leaflet, MapLibre, Pannellum, Iconify, and Lucide assets load from `/vendor/`; no `@latest`, unpkg, jsDelivr, code.iconify executable script, or other remote executable stylesheet/script remains | **PASS — accepted R6 Codex GO** | M12.P1-R6 focused `230/230` across both backends and both renderer modes; in-suite `self-hosted-vendor` exact independently pinned inventory over every view and client asset; independent browser matrix recorded zero executable CDN requests on every affected surface at both viewports. Only Google Fonts remains as the documented stylesheet exception |
| SEC-33 | Vendor provenance and license integrity | Validate every shipped asset against an independently reviewed inventory, not just the manifest's own self-consistent values | Exact package name/version/license, registry tarball URL and sha512 integrity, global interface, tarball source path, `/vendor` destination, byte count, final SHA-256, and transformations are pinned in `EXPECTED_VENDOR_INVENTORY`, which lives in probe code OUTSIDE `public/vendor/manifest.json`. The manifest must reproduce that inventory EXACTLY, and disk AND served (HTTP) bytes are verified against the independently pinned SHA-256 — so a coordinated bytes-plus-manifest-hash swap fails without an explicit reviewed code change. This replaces the earlier shape-only validation (registry-URL prefix + `sha512-` prefix), which a coordinated data edit could satisfy | **PASS — accepted R6 Codex GO** | Every tarball's SHA-512 matched the registry `dist.integrity`, and each of the 18 files was confirmed byte-identical to its tarball source (Leaflet JS the one prefix-minus-sourceMappingURL exception). Same-analyzer negative fixtures reject a different valid-looking tarball URL, sha512, license, source path, destination, byte count, and SHA-256; missing/extra package and file entries; duplicate package names and destinations; undeclared/altered transformations; a different global interface; and the fail-open closer — a coordinated hash update that still differs from the independently pinned hash |
| SEC-34 | CSP contraction and approved data origins | Inspect production CSP and exercise affected pages | Obsolete executable CDN origins are absent; nonces remain; only required Google Fonts, OSM tiles, Iconify data, Cloudinary, self, and required worker boundaries remain | **PASS — accepted R6 Codex GO** | `script-src` is exactly `'self'` + nonce; `unpkg.com`, `cdn.jsdelivr.net`, `code.iconify.design` removed from every directive; live response CSP asserted in-suite and in the focused probe; independent browser review recorded zero `securitypolicyviolation` events across the whole matrix |
| SEC-35 | Missing self-hosted asset degradation | Intercept each vendor family locally and reload affected map/VR/admin pages | Essential content/actions remain truthful; no stale route/arrival success, uncaught initialization cascade, or executable CDN fallback occurs | **PASS — accepted R6 Codex GO** | Independent fresh-context interception covered Lucide, Iconify, Leaflet, Pannellum, and MapLibre. Lucide/Iconify absence preserved essential labels/actions; Leaflet/MapLibre absence showed "Live map engine is unavailable." with 13 locations and zero stale route paths; Pannellum absence showed "360 viewer could not be loaded." and never claimed arrival. Only expected same-origin 404s occurred, with zero executable CDN fallback or unexpected page errors |
| SEC-36 | R6 browser and responsive verification | Run the required admin/map/VR matrix at desktop and mobile sizes | No CSP violation, unexpected failed vendor request, broken essential control, or untruthful unavailable state | **PASS — accepted R6 Codex GO** | Independent Codex review covered eight admin pages, `/home`, `/dashboard`, `/about`, `/events`, `/map` in Leaflet and MapLibre modes, Free Roam `/vr`, and a valid CAS guided route at 1440×900 and 390×844: all HTTP 200, zero CSP violations, zero unexpected page errors, no horizontal overflow, Leaflet markers resolving from `/vendor/leaflet/images/marker-icon.png`, and the MapLibre `blob:` worker with zero separate worker-file requests |

| SEC-37 | Deployment package boundary | Inspect the root `.vercelignore` allowlist and enumerate what a Vercel upload would contain | The first rule is the root `/*`, so a new root file or directory is excluded by default. Only reviewed runtime roots are re-included; `public/img/sample 360` remains denied after `public`. No secret, documentation, probe, database source, screenshot, Docker/local-agent, dependency tree, temporary, or Git metadata is packaged. The exact content-addressed PMTiles archive/manifest and 20 vendor runtime files are independently required | **PASS — accepted M12.P1-R7 history; current correction candidate focused package evidence 74/74** | **Accepted technical Production predecessor:** 158 files, 6,245,074 bytes, aggregate SHA-256 `b3113c05daaa5d2e870f204083923434456580fa6499190421de062ce9cabbd4`. **Current offline UI/accessibility correction candidate package:** 168 files, 7,073,128 bytes, aggregate SHA-256 `1d6cc68b7ef350b6a61eb8d84ea4fb7dd6862bd8548beb7595d3f2e6f4b10d6a`; candidate evidence pending independent review, not accepted local package or deployment evidence. **Historical/rejected pre-correction package:** 168 files, 7,071,943 bytes, aggregate SHA-256 `dd00055741fedecd9d99f081c612f8c18e6573d7a121d5903d866fcebddb0a33`. **Accepted local predecessor:** 168 files, 7,042,705 bytes, aggregate SHA-256 `fe08232edf026edcbd33371df7d484bfaf39e3de0dafe22f5144e18e08efbf2b`. **Historical/blocked, never accepted:** 168 files, 7,022,574 bytes, aggregate SHA-256 `779d331824026edcbd33371df7d484bfaf39e3de0dafe22f5144e18e08efbf2b` (the first D6 candidate, rejected by the independent review); 165 files, 6,971,229 bytes, aggregate SHA-256 `e383f2fe708c5233192ec3602727ed2029dbc906df1ad53a75a70f6fa583334b` (the OFF.3-OFF.5 2D offline-navigation candidate); 165 files, 6,970,280 bytes, aggregate SHA-256 `fc5d8bdcc7a6482bd256d4504224018cfc56ba418f56d81babd6e0ec5a4ff783` at candidate manifest `af7a1a333db0653449727ee5b6b7f223606686a05717ef6f107607bd99f04e9c` (incomplete service-worker header and API guards); 165 files, 6,969,343 bytes, aggregate SHA-256 `2dd88fede872db81a771a9d7273c8fd0264e2f6006d5eee09f33a1b930400523` (automatic API caching contradicted the consent-driven offline-package boundary); and 165 files, 6,968,875 bytes, aggregate SHA-256 `115dccba1fc4d9707caa5c43cc8bd7f9340bd7d92286513ad562d60af60b100f`. The allowlist, forbidden classes, exact map assets, and vendor files are pinned outside `.vercelignore`; this is candidate evidence only, not deployment authorization |
| SEC-38 | Excluded scratch panoramas are not CDN-addressable | Serve only the allowlisted public files from a bounded local static root and request the excluded panorama directory in both wire forms | Percent-encoded requests (which decode to the literal `img/sample 360/` path) return `404` with no `Location` header for a file, the directory, and the trailing-slash directory; literal-space request lines never return `200` and never carry file bytes; a missing normal asset, every excluded root/`scripts`/`database`/`docs` path, and four traversal forms also fail closed with no redirect or fallback | **PASS — accepted M12.P1-R7 Codex GO** | Focused `71/71` (historical/superseded initial R7 candidate: `70/70`) on dedicated port `3385`; representative CSS, client script, PWA icon, web app manifest, offline shell, service worker, campus image, all 18 vendored runtime files, and the vendor manifest were served `200` byte-identical in the same run. The temporary static root is created outside the repository and removed in `finally` |
| SEC-39 | Static headers never override the dynamic nonce CSP | Compare `vercel.json` header rules against `middleware/securityHeaders.js` | `vercel.json` carries exactly `$schema` and `headers` with seven narrowly scoped rules and no catch-all/dynamic matcher. The only static CSP is on `/offline.html`, the session-neutral shell. Express still mints a per-request nonce and still restricts `script-src` to exactly `'self'` plus that nonce, so it remains the sole CSP authority for dynamic responses. No `builds`, `functions`, `routes`, `rewrites`, `redirects`, framework/build/install override, or long-lived immutable caching on the non-content-hashed asset URLs | **PASS — accepted M12.P1-R7 Codex GO** | In-suite `vercel-package-boundary` `70/70`; negative fixtures reject a broadened source, a catch-all or dynamic-route CSP, an altered/added/dropped header key or value, an extra top-level key, and every build/routing override. Per Vercel's documentation, headers set in a Function response take precedence over file-based configuration, so the two never compete |

| SEC-40 | Source auditability of the R7 boundary files | Read each file in the frozen audited-source set as a raw buffer and scan for literal `0x00` bytes, confirm ordinary `rg`/`grep` return matching source lines, and confirm the audited-source list is pinned independently by exact ordered equality | Zero literal NUL bytes in `.vercelignore`, `vercel.json`, `scripts/vercelPackageBoundary-probe.js`, and `scripts/quality-gates.js`. A single literal NUL makes review tooling report "binary file matches" instead of the line, silently removing a security-relevant file from source review. The NUL separator inside `computeAggregateSha256()` must be the textual `\0` escape, never a literal byte; `containsLiteralNulByte()` fails closed on any non-Buffer input, including a decoded string that still carries the NUL character. The in-suite gate no longer trusts the probe's exported `R7_AUDITABLE_SOURCE_FILES` wholesale: it pins the set independently in `EXPECTED_R7_AUDITABLE_SOURCE_FILES` and requires EXACT ORDERED EQUALITY before accepting the byte scan, so swapping `scripts/quality-gates.js` out of the exported list for another NUL-free file (e.g. `package.json`) now fails | **PASS — accepted M12.P1-R7 Codex GO** | Found by independent Codex review of the initial R7 candidate: one literal `0x00` at former line 564 / offset 25235. Remediated byte-surgically (`0x00` → `0x5c 0x30`); length grew by exactly one byte, all other bytes identical, and the package preview (154 files, 6,166,956 bytes, aggregate `c7c16ed7…38b9ec`) is unchanged, proving identical runtime behaviour. The independent Codex re-review then found the exported-list substitution gap, closed by the independent exact-ordered-equality pin. Covered by 3 in-suite assertions + 1 focused assertion; the NUL negative fixture rejects `[0x61,0x00,0x62]`, accepts textual `[0x61,0x5c,0x30,0x62]`, and rejects `null`/`undefined`/string/array/object-like input; the list fixture rejects a `package.json` substitution, a reorder, a duplicate-plus-omission, an extra path, a short list, and non-array/non-string input. Disclosed: an earlier draft of the NUL fixture reintroduced the same literal byte and the new gate caught it, so all NUL-bearing fixtures are built at runtime from byte arrays |
| SEC-41 | Subsequent production dependency advisory | Re-audit after the 2026-07-26 npm advisory drift and inspect the resolved production graph | Exact `ejs@6.0.1`; `jake/filelist/minimatch/brace-expansion` absent from production; `npm audit --omit=dev` reports zero vulnerabilities | **PASS — current dependency baseline** | Later than, and separate from, the accepted 2026-07-22 compatible lockfile closeout. The direct EJS major update was reviewed explicitly; no `npm audit fix --force`, override, broad update, application-source change, or migration was used |
| SEC-42 | Supabase exact-session logout under ambiguous delete responses | Drive the real store through database-free scripted delete/read outcomes and repeat the real MySQL/Supabase logout contract | One normal delete; exact-SID confirmation after an ambiguous response; at most one retry; callback exactly once; fixed sanitized terminal error; no user-wide revocation fallback or raw detail | **PASS — covered by accepted D7 closeout** | Focused logout/session-termination probe is green in both runtime modes plus five database-free retry fixtures. The later accepted D7 closeout supplied covering evidence: `npm test` `3511/3511`, `npm audit --omit=dev` zero vulnerabilities, and postconditions `24/24 -> 18/18 -> 46/46` with the frozen fingerprint unchanged |
| SEC-43 | D7 cross-role storage isolation and authorization boundaries | Run the two-backend admin-to-participant regression with genuinely separate browser/storage contexts for administrator, student, guest, and instructor | No cookie, localStorage, sessionStorage, IndexedDB, or CacheStorage carries between roles; student, guest, and instructor see only participant-appropriate surfaces; `/admin` and `/admin/api/*` remain forbidden for non-admin roles; temporary D7 records are cleaned up through supported application interfaces | **PASS — accepted M12.P1-D7 Codex GO** | Fresh-context role-isolation rerun used separate Playwright `BrowserContext` objects per role in both MySQL and Supabase; both legs completed and cleaned up; final `npm test` was `3511/3511` with `QUALITY-GATES OK`, audit zero, and postconditions `24/24 -> 18/18 -> 46/46` with frozen fingerprint `a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d` unchanged |
| SEC-44 | Logout probe output hygiene | Ensure mocked failed-destroy unit cases capture the expected sanitized controller log instead of leaking it to a green transcript | Green transcripts show zero escaped `Logout error: session destroy failed.` lines while real logout failures still log one sanitized line and return sanitized `500` without clearing the cookie | **PASS — independently Codex-accepted additive evidence** | Focused logout probe `75/75`; full suite `3529/3529` with `QUALITY-GATES OK`, zero `[FAIL]`, zero escaped logout-error lines; `npm audit --omit=dev` zero vulnerabilities; postconditions `24/24 -> 18/18 -> 46/46`. Additive only; accepted D7 remains `3511/3511` |

| SEC-45 | Participant privacy notice | Request `/privacy` with no cookie, then read the rendered notice | Anonymous `200` HTML with no session cookie minted. The notice names Team Dutchess and the capstone-pilot nature; lists the identity, role/profile, authentication, session, and security data collected; lists Vercel, Supabase, Upstash, Google, and Cloudinary; states the exact `openid`/`email`/`profile` scopes; states that pilot feedback goes to a separate owner-created Google Form CampuSphere never receives or stores; states 30-day-post-defense retention followed by owner-managed **manual** deletion; states RA 10173 rights and the CSPC DPO route; and links <https://cspc.edu.ph/governance/privacy-policy/>. It asserts **no** consent basis, legal basis, automatic deletion, or data-sharing guarantee | **PASS (automated)** | M12.P1-R8. Runtime assertions in `npm test` plus the static `pilot-readiness` gate. Rejecting fixtures mutate the REAL view: removing the CSPC policy URL, the retention window, or the DPO route each fail, and appending an invented legal basis, an automatic-deletion promise, or a "we never share" guarantee each fail |
| SEC-46 | Pilot indexing protection | Inspect response headers on `/`, `/auth`, `/privacy`, and authenticated HTML, and fetch `/robots.txt` | Every response carries exactly `X-Robots-Tag: noindex, nofollow, noarchive` (exact-value comparison, so a weakened directive fails), and `/robots.txt` returns exactly `User-agent: *` / `Disallow: /`. **Indexing control is explicitly NOT access control** and is documented as such in both `middleware/securityHeaders.js` and `server.js` | **PASS (automated)** | M12.P1-R8. Authenticated coverage uses a real logged-in session (`/dashboard` `200`), not a redirect. Vercel auto-noindexes preview deployments only, so the production pilot hostname needs this explicitly |
| SEC-47 | No dead placeholder UI on participant surfaces | Scan the anonymous footer and both auth surfaces for empty-fragment anchors | Zero `href="#"` placeholders in `views/partials/footer.ejs`, `views/auth.ejs`, and `views/complete-registration.ejs`; all three link the real `/privacy` notice; the footer points at the real `https://cspc.edu.ph/`; and the unsupported Student Portal, FAQ, Contact Us, and Terms of Use entries are removed rather than given invented destinations | **PASS (automated)** | M12.P1-R8 `pilot-readiness` gate. The scan covers the whole file including comments, so a placeholder cannot be smuggled back in as commented-out markup |
| SEC-48 | Truthful pilot / OAuth documentation | Compare `docs/deployment.md` against the shipped OAuth request and the owner's pilot decision | The guide records the facilitator-mediated model, Testing publishing status, the exact `openid`/`email`/`profile` scopes, and Google's basic-identity exception; the shipped `scope: 'openid email profile'` still matches; and no tracked document claims an invitation-only pilot, an OAuth test-user allowlist, pre-added test users, or a 100-participant cap | **PASS (automated)** | M12.P1-R8 `pilot-readiness` gate, with rejecting fixtures for each superseded framing. Documents that the OAuth publishing status is **not** an access-control boundary and that open local registration creates a `guest` account only, enforced at the controller and again in `0009_public_registration_trust_policy.sql` |

| SEC-49 | Local authenticated exposure matrix | Drive the full authenticated surface in BOTH runtime modes with a separate fresh browser context per role | For administrator, student, instructor, and guest: each context starts with zero carried-over cookies and zero carried-over web storage; sign-in works through the real form; role denial is correct (`/admin` 403 HTML and `/admin/api/*` 403 JSON for non-admins, 200 for the administrator; 302/401 for anonymous); registration trust refuses `admin`/`instructor`/`student-cspc` escalation; the participant dashboard, building roster, destination routing, and Free Roam VR all respond truthfully; guided VR claims arrival only where coverage exists; admin CRUD completes create -> read-back -> edit -> delete with a real list read proving zero residue; logout returns 200 and the post-logout request is denied; and `/dashboard`, `/map`, and `/admin` show no horizontal overflow, zero CSP violations, and zero console errors at 1440x900 and 390x844 | **PASS (clean bounded re-execution)** | M12.P1-R8. **MySQL 34/34, Supabase 64/64**, plus a **14/14 supplement per backend** covering SEC-08/09/10/11 — **126 checks, zero failures**. Every authenticated session was registered with `scripts/probeSessionLifecycle.js` immediately after login and terminated exactly once through `terminateAll()` and the real CSRF-protected `POST /logout`. No `429` occurred; no failed logout was retried; `services/sessionRevocation.js` was never imported or called; no session row was deleted directly and no database cleanup was performed. MySQL exercises administrator and student (the only deterministic local fixtures); instructor and guest are exercised in Supabase, where all four regression identities exist. Every fixture was deleted through the same admin API that created it. Final ordered postconditions were `24/24 -> 18/18 -> 46/46`. The earlier first execution of this matrix is historical/superseded and is NOT accepted — see the evidence row below |
| SEC-50 | Pilot feedback form readiness | Fetch the owner-supplied responder form anonymously and inspect it WITHOUT submitting | The form is reachable, is a responder (not editor) URL, is accepting responses, does not request an email address, and carries the minimum `docs/usability-survey.md` questionnaire | **PASS (external owner evidence: READY)** | M12.P1-R8. Opened anonymously; the page served was the **responder page, not the editor UI**; it was **accepting responses** and requested **no email address**. Matched **10/10 SUS-style statements, 8/8 user-satisfaction questions, and 4/4 open-feedback prompts**. **Nothing was submitted and no response row was created.** The responder URL is deliberately NOT recorded in this repository — only its readiness is |
| SEC-51 | Vercel production smoke | Exercise the deployed app read-only on the production hostname | Production serves the synchronized baseline; public pages/assets retain expected security contracts; protected surfaces deny anonymous access | **PASS (bounded anonymous read-only GET-only post-deployment verification; owner-observed deployment identity)** | The bounded checks ran against `https://campusphere-cspc.vercel.app` on deployed technical Production baseline `fea3b2e11c6331eddc1ee091b165427d8e0218d7`. Public pages/assets returned the expected responses, sampled bytes matched pushed source, protected HTML routes redirected to `/auth`, protected JSON routes returned `401`, and checked responses set no cookie. `/auth` was deliberately avoided; no authenticated login or schedule auditing was exercised. Historical/superseded: before this deployment, anonymous smoke `31/31` ran on `0627bf78228148e3f989275810c333c16a1f3356`; the earlier detailed browser smoke ran on `d422b54393f659125912ec5c84ae7927c2533288`; the first accepted baseline was `78d9053c8ce5c2cc7a9ede80326950cfd29a3a53` |

**Status labelling.** Every row above states HOW it was proven.
`PASS (clean bounded re-execution)` means the exact scenario was executed in the
clean bounded evidence re-execution, in both runtime modes, entirely through
supported application interfaces.
`PASS (automated)` means it is directly covered by named accepted automated
evidence — an in-suite gate or a focused M12.P1 probe — and is **not** a manual
execution claim. `PASS (externally executed)` marks a case that required a live
third-party sign-in outside the local harness.
`PASS (externally executed, independently accepted)` marks a case the local
harness cannot perform at all — it was executed by the owner against production
and independently accepted, and the row names the exact host and deployed
baseline so the claim is checkable.
No row remains `DEFERRED`.

**No manual case remains unrecorded.** SEC-02, SEC-03, SEC-04, and SEC-08
through SEC-11 were previously `Pending` and have been executed by the M12.P1-R8
exposure matrix and its supplement, in the clean bounded re-execution. SEC-15
through SEC-22 are recorded against the specific automated gate or probe that
covers each one, labelled as automated rather than manual. SEC-05 was previously
deferred and has now been executed externally with the proven facts recorded in
its row. SEC-51 (actual Vercel production smoke) was previously deferred and
later executed externally. The current bounded anonymous read-only GET-only
post-deployment verification passed against deployed technical Production
baseline `fea3b2e11c6331eddc1ee091b165427d8e0218d7`; deployment identity remains
owner-observed. Historical/superseded: before this deployment, anonymous smoke
`31/31` ran on `0627bf78228148e3f989275810c333c16a1f3356`; the earlier accepted
baseline was `d422b54393f659125912ec5c84ae7927c2533288`; the first baseline was
`78d9053c8ce5c2cc7a9ede80326950cfd29a3a53`.

**Deployed technical Production baseline.** Production at
`https://campusphere-cspc.vercel.app` serves
`fea3b2e11c6331eddc1ee091b165427d8e0218d7` as the accepted technical
Production baseline. The authorized push automatically triggered that
deployment. Historical/superseded: `bbb25d0` was an earlier evidence commit,
and `43627cf` was the Guided-VR runtime/catalog remediation. Previously, before
`fea3b2e`, Production served `0627bf78228148e3f989275810c333c16a1f3356`.
`Auto-assign Custom Production Domains` is disabled, so
future `main` deployments require explicit manual promotion before replacing
the live alias.

**SEC-52 — pilot-surface correction (deployed and independently accepted under
SEC-51).** Three findings were raised against the pilot surface and
corrected: (1) the landing page claimed Google sign-in was "restricted
to @cspc.edu.ph accounts", which contradicted `getRoleFromEmail()` — it now
states the real student/instructor/guest mapping and the refusal of other
domains; (2) the anonymous navbar exposed no `aria-expanded`/`aria-controls` and
its only hamburger handler lived inline on the landing page, so `/privacy`
rendered the same markup with no behaviour — a shared `public/js/public-nav.js`
now owns the state for both pages through one setter that closes on navigation,
Escape, outside click, and the desktop transition; (3) the globally fixed
theme-toggle overlapped the auth card's privacy notice and Back-to-Home link —
it is now rendered inside the card and pinned to its top-right by one
auth-scoped rule, still 44x44 and never hidden, with global placement
unchanged. Each contract is asserted in the `pilot-readiness` gate with
mutated-source rejecting fixtures. **All three remain present in deployed
technical Production baseline
`fea3b2e11c6331eddc1ee091b165427d8e0218d7`.**

Historical/superseded: before this deployment they were live on
`0627bf78228148e3f989275810c333c16a1f3356` and were independently verified in
the earlier detailed SEC-51 smoke on
`d422b54393f659125912ec5c84ae7927c2533288`, which confirmed production
`public/js/public-nav.js` and `public/css/styles.css` byte-identical to that
earlier baseline. The implementation and local verification history above is retained
unchanged. No Milestone 12 GO is claimed.

## Automated Security Evidence

| Command | Expected result | Status | Evidence reference |
| --- | --- | --- | --- |
| `npm test` | Auth/authz/CSRF/rate-limit/error/PWA/leak checks pass | **4998/4998 PASS — accepted local D6/OFF.6 evidence; exit 0** | Exactly 4,998 `[PASS]` lines and `QUALITY-GATES OK`; ordinary D6 `266/266` completed both required backend legs; BE.6 `46/46`; live Git and the latest external review report control release disposition |
| `node scripts/vercelPackageBoundary-probe.js` | Allowlisted package only; excluded scratch panoramas and every excluded class fail closed at the static boundary | PASS | **72/72 current candidate**; accepted R7 history remains **71/71** (and **70/70** before the literal-NUL remediation) — standalone, never counted in the `npm test` total; dedicated port `3385`; console-only preview, no manifest or archive written |
| Local authenticated exposure matrix (clean bounded re-execution) | Browser-driven in both runtime modes, one bounded server per backend on its own free port | Every scenario in SEC-49 passes with a separate fresh browser context per role and no unsupported cleanup | **126/126 PASS — MySQL 34/34 + 14/14 supplement; Supabase 64/64 + 14/14 supplement; zero failures** | Each role context proved zero carried-over cookies and zero carried-over web storage BEFORE authentication. Every authenticated session was registered with `scripts/probeSessionLifecycle.js` immediately after login and terminated exactly once via `terminateAll()` and the real CSRF-protected `POST /logout`, each with a former-cookie replay-denial proof. No `429`; no retried logout; `services/sessionRevocation.js` never imported or called; no direct session-row deletion and no database cleanup. Final ordered postconditions `24/24 -> 18/18 -> 46/46` |
| Local authenticated exposure matrix, first execution — historical/superseded | Browser-driven in both runtime modes | Same scenario set | **Historical/superseded — explicitly NOT accepted evidence, whatever totals it produced** | Retained so the defect is not erased. Repeated runs exhausted the in-memory `preParseAuthLimiter` budget; the run started receiving `429` with a `Retry-After`, and one throttled `POST /logout` left an orphaned MySQL administrator session. That session was cleared by calling `revokeUserSessions` DIRECTLY rather than through the supported logout interface. Direct revocation falls outside the supported-interface rule this evidence class depends on, so the run is not accepted on its numbers. Superseded by the clean bounded re-execution above |
| Unsupported-domain OAuth flow (SEC-05) | Live Google sign-in from a fresh anonymous browser context | Sanitized `unauthorized_domain` rejection; no row created | **PASS — externally executed** | Reached `accounts.google.com` with exactly `openid`, `email` and `profile`; the account completed Google authorization and returned to CampuSphere; CampuSphere redirected to `/auth?error=unauthorized_domain` with a sanitized message echoing no email and no raw error. Supabase `users` 6 before and 6 after, zero rows on unsupported domains, no role-profile row, and no persisted pending OAuth registration. No email, password, code, token, cookie, or account identifier is recorded |
| Post-synchronization candidate (historical/superseded) | One full `npm test` run plus distinct read-only safety postcondition | **RED — historical/superseded; not accepted** | Nine suite failures after Supabase logout/session-destroy failures; post-run safety `22/24` with canonical administrator and student sessions unexpired; embedded residue and BE.6 checks red. That blocker was closed by a separately owner-authorized restoration, independently reproduced: credential/session safety is now `24/24`, canonical residue `18/18`, and BE.6 `46/46` with the frozen fingerprint unchanged. Retained only as history |
| `node scripts/boundedAnonymousAccessDenial-probe.js` | Zero audit rows from anonymous denials (authoritative global total AND filtered count both flat); exactly one authenticated role-denial row; exactly one login-failure row, in both backends | PASS | **90/90** — standalone (M12.P1-R5), never counted in the `npm test` total; accepted Codex GO |
| `npm run qa:identity` | Identity/profile uniqueness enforced | PASS | `IDENTITY-CONSTRAINTS OK`, exit 0: no duplicate non-null `(oauth_provider, oauth_subject)` groups, and duplicate `student_profiles` / `instructor_profiles` / `guest_profiles` `user_id` rows are rejected |
| `npm run qa:audit` | 0 production dependency vulnerabilities | PASS | Accepted compatible remediation, 2026-07-22; subsequent 2026-07-26 advisory drift remediated with exact `ejs@6.0.1` and the `jake/filelist/minimatch/brace-expansion` chain absent |
| `npm run qa` | Aggregate security and smoke gates pass | **4998/4998 PASS — all five stages green; exit 0** | `QUALITY-GATES OK`, `DB-PERF-GATE OK`, `[supabase-smoke] PASS`, `IDENTITY-CONSTRAINTS OK`, and `found 0 vulnerabilities`; the superseded scorer-only exit 97 required nonexistent `SUPABASE-SMOKE OK` even though the inner command exited 0; the later 20-minute standalone-suite wrapper timeout is historical/rejected; live Git and the latest external review report control the later disposition |
