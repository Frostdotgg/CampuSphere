# CampuSphere Codex Handoff

Last updated: 2026-08-13 (Asia/Manila)

Repository: `C:\Users\FROST.GG\Desktop\CampuSphere v1`

<!-- M12.P1 CURRENT STATUS START -->
**CURRENT STATUS (2026-08-13 post-pilot authority).**

Accepted history remains unchanged: Milestones 8-11, RF.1-RF.6, BE.1-BE.6,
OFF.1, M12.P1 R1-R7, D1-D5, and expanded D7 are complete and Codex GO. The
limited human-pilot review is owner-accepted as described below. OFF.2-OFF.6
remain open, not cancelled, and mandatory before final Milestone 12 GO.

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

The owner-authorized local OFF.2-OFF.5 implementation candidate has focused
evidence but no Codex GO. It begins from clean main
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

Candidate-only focused evidence is green after that correction: the integrated
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

The current deployable package candidate is 168 files, 7,042,705 bytes,
aggregate SHA-256
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
postconditions. This bounded correction is confined to current-authority
documentation and existing static assertions, has focused evidence but no
Codex GO, and requires a later independent review plus separately authorized
replacement full verification. No session or data correction was required.
The owner-authorized local M12.P1-D6 admin dashboard analytics implementation
candidate has focused evidence but no Codex GO. It replaces the dashboard's
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

Focused evidence for the corrected bytes is the D6 probe in STATIC-ONLY mode at
`247/247`, the D6 gate at `113/113`, and the package-boundary probe at `74/74`.
The ordinary database-backed probe mode was NOT executed under that bounded
authorization, and no database was contacted. Full-suite verification was not
authorized and was not run; the structurally expected registered total is `4998`
when both backends are reachable, and that total is not claimed as passed.
Historical/rejected after the review: the earlier D6 probe result `132/132`,
whose MySQL leg was reported NOT EXECUTED while the run still reported success,
the earlier D6 gate at `63/63`, and the earlier `4822` structural total.

D6, OFF.6 browser acceptance, and final Milestone 12 GO remain open. The
offline candidate must not be pushed, promoted, or deployed before the presentation
and a later explicit owner decision. The D6 candidate is under the same
restriction.

Fresh-session boundary: the current Codex and Claude Code prompts authorize
grounding only and then wait for the owner. Neither prompt authorizes edits,
tests, Git mutation, a new deployment or promotion, another pilot, OFF.2
implementation, or Milestone 12 GO.

M12.P1 remains NO-GO for final acceptance.
No new deployment or promotion is authorized by this status block; either
action requires a separate owner authorization.
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
> Milestone 12 GO is claimed. Historical/superseded: before `0627bf7`, the
> `SEC-51` production smoke ran against deployed baseline
> `d422b54393f659125912ec5c84ae7927c2533288` on
> `https://campusphere-cspc.vercel.app` is independently Codex-accepted.
> OFF.2-OFF.6 remain deferred until pilot
> review and are not cancelled. Accepted `R1`-`R7` and `D1`-`D7` history is
> unchanged.
>
> The three pilot-surface corrections are DEPLOYED on that baseline: truthful
> landing role-mapping copy matching `getRoleFromEmail()`, a shared accessible
> anonymous navbar owned by `public/js/public-nav.js`, and an auth-scoped in-card
> theme control. Each contract is pinned in the `pilot-readiness` gate with
> mutated-source rejecting fixtures, and the read-only production smoke found
> production `public/js/public-nav.js` and `public/css/styles.css`
> byte-identical to that baseline. That smoke performed no authenticated
> production login, so the accepted `R2` and `R3` session-store and bootstrap
> evidence stands unchanged.
>
> Historical/superseded: before the current deployment, the earlier accepted
> production baseline was `78d9053c8ce5c2cc7a9ede80326950cfd29a3a53`, and
> `SEC-51` was originally deferred.
>
> The subsequent `SEC-51` evidence and quality-gate synchronization at
> `db034e5581e6f409083a43dcb80fb82b473e0127` is documentation-and-gate work
> only; it is not a runtime deployment, does not change production, and remains
> unaccepted pending independent read-only review. It is LATER than the
> deployed runtime baseline, not earlier. The present local candidate
> additionally repairs the schedule-audit allowlist and is likewise unaccepted.
>
> `M12.P1-R8` is the next potential section. R8 is read-only and is not
> authorized by this synchronization. Even a future R8 GO authorizes only a
> separate owner deployment decision. Deployment is not authorized, and final
> Milestone 12 GO remains blocked by pilot review plus OFF.2-OFF.6 and D6.
>
> Milestone 10 Cloudinary Media Support is complete and Codex GO; Section 10.8
> passed its final end-to-end GO/NO-GO. Milestone 11: Room Scheduling is
> complete and Codex GO; Section 11.8 passed its final GO/NO-GO.
<!-- M12.P1 PRIOR STATUS END -->

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

<!-- GUIDED-VR HISTORICAL POLICY START -->
Historical/superseded architectural, BE.1-BE.6, and OFF.1 snapshot. This block
is retained for traceability and is not current or operative Guided-VR catalog
authority.

## Prior Architectural Truth

This section preserves accepted architectural and earlier clean-baseline
context. The 2026-07-30 `M12.P1 CURRENT STATUS` block above overrides any
statement below that describes the live session or BE.6 state as clean.

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

## Prior M12.P1 Stop Point

This section is historical continuity only. Before the 2026-07-30 restoration,
the stop point was the RED `22/24 -> 16/18 -> 41/46` precondition and bounded
restoration sequence. The current status block above records the later QA-
induced residue blocker and supersedes this historical green snapshot.

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

## BE.1 Through BE.3 Historical Decisions

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

## BE.4 Historical Revised-Scope GO

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

## OFF.1 Historical GO And Privacy Contract

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
  consent; the current BE.6-frozen public catalog for the selected supported
  backend; public `audience=all`, `status=scheduled` schedules for today through
  14 days capped at 100 rows per building; Guided-VR metadata for all 25 active
  destinations plus approved Free-Roam data; bounded storage and atomic updates;
  best-effort map tiles; and explicit logout cleanup. The 13-building roster is
  only the reproducible seed baseline.
- Authenticated HTML, sessions, cookies, CSRF tokens, credentials,
  user/profile data, admin/private content, mutations, raw errors, and
  unapproved media remain excluded from offline storage.

<!-- GUIDED-VR HISTORICAL POLICY END -->

## Current Guided-VR Authority

- The shared catalog has 25 active destinations, 472 configured steps, and 99
  unique scene keys. The 13-building `models/data.js` roster is only the
  reproducible seed baseline, not the complete current campus catalog.
- Every active route resolves the configured natural `destination_node_key`.
  Arrival requires a stored `main-gate` start mapping, a stored final-scene
  mapping to that exact destination node, approved Cloudinary delivery URL and
  public ID metadata for every scene, and exactly one forward and one reverse
  scene link for every adjacent pair. Incomplete or ambiguous coverage fails
  closed and never reports arrival.

## Limited Vercel Pilot Decision And Next Work

- The owner attests that a human pilot occurred on 2026-08-05 and accepts it
  with zero reported findings. Participant/Form evidence remains external and
  no participant PII is recorded in Git. The tested build's full source-commit
  identity was not independently verified, so the disposition is owner-attested
  pilot acceptance rather than independent current-build verification.
- Pilot review is complete for sequencing purposes. The owner-authorized local
  OFF.2-OFF.5 implementation candidate has focused evidence but no Codex GO.
  D6, OFF.6 browser acceptance, and final Milestone 12 GO remain open.
- No feedback table, API mutation, or migration is introduced. No anonymous
  browsing is added, and the accepted pilot must not be represented as offline
  readiness or final Milestone 12 signoff.
- R3 through R7, expanded D7, the final R8 lifecycle, technical Production
  acceptance, and pilot review are complete. The remaining ordered work is
  OFF.2-OFF.5 independent acceptance -> D6 -> OFF.6 browser acceptance ->
  M12.P2 final closeout, one separately authorized gate at a time.
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

For the complete current context-only prompt, use
`docs/new-session-grounding-prompts.md`. The list below is retained as a
repository map, but the prompt document carries the current stop conditions.

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

## Historical Latest Continuity Snapshot

- D4 restoration is complete and Codex GO. Both backends currently match the
  frozen `20/48/24/48/24/13` topology, VR `85/66`, and BE.6 fingerprint
  `a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d`.
- D5 is complete and Codex GO. The final fail-closed editor, focus containment,
  readability, documentation-gate, and session-hygiene corrections passed the
  focused probe `153/153`, full suite `2558/2558`, standalone Playwright MCP
  desktop/mobile and negative-case verification, and final cleanup checks.
- At that snapshot credential/session safety was `24/24` and canonical residue was `18/18`, verified
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

## Historical Copy-Paste Prompt For A New Codex Session

Archived for provenance only. Do not paste this older prompt. Use the sole
current Codex prompt in `docs/new-session-grounding-prompts.md`.

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
