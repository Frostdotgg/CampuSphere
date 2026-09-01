# CampuSphere Claude Continuity Handoff

Last updated: 2026-09-02 (Asia/Manila)

Repository: `C:\Users\FROST.GG\Desktop\CampuSphere v1`

## Current Pushed Offline Camera Release (2026-08-29)

The pushed lineage ends at `c4de5ab`, after offline publisher implementation
`78fbc0e`, Drive-endpoint correction `99f08d2`, and runtime-settings commit
`4785b1b`. Focused source evidence passes `21/21`, package evidence passes
`74/74`, and the owner observed a successful post-`c4de5ab` publication,
Vercel Ready/Production status, and the intended Main Gate startup view in
Production. The offline boundary/camera work is no longer the active blocker.
Independent immutable deployed-byte proof for `c4de5ab` and Final Milestone
12 disposition remain external.

<!-- M12 RELEASE CONTINUITY START -->
## Current Release Continuity (2026-09-02)

At the start of this authority synchronization, Git branch `main` had local
`HEAD`, `origin/main`, and remote `main` all at pushed freeze/package-evidence
Git commit SHA-1 `7f4bfce54c7961bf5e3ffc4cf72a119bcf8d2b79` (`7f4bfce`). The
index was empty, no tracked paths were modified, exactly two untracked paths
existed (`artifacts/npm-test-2026-09-02.txt` and
`artifacts/npm-test-2026-09-02-final.txt`), and there were zero stashes. The
retained safety branch `backup-pre-trailer-strip` still pointed to Git commit
SHA-1 `d387c9151f1582cc4a8fc80002be52e11956335f`. The owner explicitly authorized
this bounded synchronization to update the 11 authority documents,
`docs/offline-map-refresh.md`, and `scripts/quality-gates.js`, commit both
transcripts, commit the exact candidate, and push `main`. Recompute live Git
truth in every later session; this start snapshot never authorizes
normalizing a difference. Codex did not inspect or record `.env` contents;
authorized probes may load configured environment values through the normal
application startup path.

The current pushed product/evidence lineage after the 2026-08-31 authority
work is grounding-role wording Git commit SHA-1
`9de526ec260d065a0c1fe967d7fac0ae715ea2d6`, auth/home UI Git commit SHA-1
`c1ca1b441e3ef4577de278f531fab8f41e1f03fa`, read-coalescing Git commit SHA-1
`b8da21ef79b29e672737730ef4d35e38c1ca1b59`, endurance/release-evidence Git
commit SHA-1 `0491c5d8be4b9b82ac0a84aa155eb46f4ec7947a`, and freeze/package-refresh Git
commit SHA-1 `7f4bfce54c7961bf5e3ffc4cf72a119bcf8d2b79`. Earlier relevant commits remain
home-authentication Git commit SHA-1
`6849aecbc6ecc2ae75697e80b3ae201d902dd68c`, reviewed-feature Git commit SHA-1
`12736ffb31cf54354212ef0ee13cf107e6d0846c`, route-maintenance Git commit
SHA-1 `06e15128db3027cd1c231b4919ddf440f54eb72b`, and offline-camera Git commit
SHA-1 `c4de5ab30caadf963908f0b8cab2d49ee9678481`.

Current product behavior remains: `/home` requires `requireLogin`; the auth tab
says `Sign in using Email`; the `/home` campus search is removed while its
three quick links remain; and the prior dashboard, event ordering, service
worker v36, and Guided-VR portal-marker changes remain accepted. Migration
`0020_room_schedule_documents.sql` and migration
`0021_minimal_instructor_oauth_registration.sql` are owner-applied in Supabase.
Migration 0021 preserves the 17-argument RPC, `SECURITY INVOKER`, fixed search
path, revoked `PUBLIC` EXECUTE, and granted `service_role` EXECUTE. Do not
reapply migration 0020 or 0021 without a new explicit database authorization.
There is still no real CSPC instructor Gmail end-to-end OAuth observation.

The search/building performance correction is deliberately narrow. The
`utils/singleFlight.js` helper shares only an active read promise among
concurrent callers; it is not a completed-result cache. The active entry is
discarded when the read settles, building rows are cloned before return, and
successful building or route mutations invalidate the relevant active read.
The repositories and `services/routeAvailability.js` therefore stop repeating
the same expensive building/route work during a burst without serving a stale
stored answer afterward.

The owner removed the unintended 26th Supabase building; Codex did not mutate
the database. The real Academic Building IV Mac Laboratory room
plotting/schedule hotspot is intentional and retained. The selected freeze is
dated 2026-09-02. It pins MySQL at 34 buildings, 44 route nodes, 100 directed
edges, 50 exact reverse pairs, 100 valid geometries, 671 scenes, 1,397
hotspots, and one selected schedule hotspot. It pins Supabase at 25 buildings,
26 route nodes, 50 directed edges, 25 exact reverse pairs, 50 valid geometries,
664 scenes, 1,374 hotspots, and zero selected schedule hotspots. Both backends
retain 25 active Guided-VR destinations, 472 configured steps, and 99 unique
scene keys. The MySQL building/route fingerprint SHA-256
`0dbb4c4ca38b375393c7ae2c842e1f799d429feda11d17cb29cee6ff0c2564ff`;
the Supabase building/route fingerprint SHA-256
`36cbf55cbdd8b88415f939cf8f9d818744b3154770b8ddf31b9c0b8df1785688`;
the selected VR fingerprint SHA-256
`1ec674e497cbe8fd36234368f9c0a679c05bd68c8002c3f9724e7b3f0de0810c`;
the shared Guided-VR catalog fingerprint SHA-256
`ed02ec95d5c642cd082f48c0b3c5b98d0707ffd5866f8f90b196793ecfe963d6`;
and the freeze manifest fingerprint SHA-256
`85b999ee54625997ad55908ea478ee462b8d6470bb97f67c76fa17b97187298c`.
Do not change a count or fingerprint merely to make a gate green; investigate
and deliberately refresh the freeze only when the live content is intended.

The first September 2 `npm test` transcript is historical/rejected evidence:
`artifacts/npm-test-2026-09-02.txt` has SHA-256
`5eee0c4a8e2935f8eddce598cf2c5de62dc54af2ad6f2933d1a98825f51f0edd`,
4,683 PASS lines, four FAIL lines (three BE.6 data-freeze assertions plus the
parent probe-exit assertion), `BE6-DATASET-FREEZE-PROBE FAILED: 3`, final
session residue `18/18`, and `QUALITY-GATES FAILED: 1`. The final accepted
transcript `artifacts/npm-test-2026-09-02-final.txt` has SHA-256
`d16a97e78d339f1213a41e1eafb18433083d432afe42d0089e66f755377a829d`,
4,687 PASS lines, zero FAIL lines, BE.6 `46/46`, final session residue
`18/18`, and `QUALITY-GATES OK`.

Local performance evidence remains separate from Production capacity proof.
Tracked LT-05 passed 4,000/4,000 checks over 3,200 requests with zero failures
(average 820.7 ms, p95 2.18 s, maximum 2.44 s); LT-06 passed 3,200/3,200 over
3,050 requests with zero failures (average 579.56 ms, p95 685.36 ms, maximum
2.34 s); and LT-08 passed 79,560/79,560 over 59,670 requests with zero failures
(average 594.74 ms, p95 858.99 ms, maximum 12.04 s). During those runs the app
container peaked at 54.55% CPU and 582.5 MiB memory (observed memory range
438-582.5 MiB); MySQL peaked at 21.94% CPU and 423.3 MiB (420.3-423.3 MiB),
with zero restarts and no OOM. The focused read-coalescing probe passed `6/6`.
The owner-observed, screenshot-only LT-04 localhost run used 5 VUs for 30
seconds and passed 50/50 checks with zero request failures (average 15.35 s,
p95 16.55 s, maximum 16.6 s); it exercises Cloudinary asset delivery, not an
upload path, and is not Production-capacity evidence.

This synchronization's final validation is required to include focused
read-coalescing `6/6`, BE.6 `46/46`, package boundary `74/74`, a fresh
`npm test` with `QUALITY-GATES OK`, all five `npm run qa` stages
(`QUALITY-GATES OK`, `DB-PERF-GATE OK`, `[supabase-smoke] PASS`,
`IDENTITY-CONSTRAINTS OK`, and zero audit vulnerabilities), final canonical
session residue `18/18`, and `git diff --check`. The current Vercel source
package remains 190 files and 7,227,026 bytes with aggregate SHA-256
`64ecc147335f1393afbb872f1ae87ccab7e29177c2b33dad4e0bcb3e71b2ba71`;
authority documents, scripts, and the two transcripts are outside that package.

Retain the offline-map authority unchanged. Its abbreviated lineage is
`78fbc0e` -> `99f08d2` -> `4785b1b` -> `c4de5ab`. The publisher is software:
`.github/workflows/offline-map-refresh.yml` runs
`scripts/publishOfflineMapRelease.js` at `30 18 * * *` or by explicit manual
dispatch. Do not repeat bootstrap or rollback without a new explicit owner
decision. The fixed rectangle is `[123.373606, 13.404852, 123.378745,
13.406981]`; release-manifest center is `[123.375604, 13.405885]`; opening
camera is `[123.374590, 13.405872]` at zoom 16.5. Whole intersecting edge tiles
remain accepted, strict polygon clipping is not a requirement, and no actual
newly added OSM building has yet been observed end to end. Historical
offline-camera package evidence remains 188 files, 7,242,957 bytes, aggregate
SHA-256 `6790308c8cd157425a551c1bb910b3e2d3b899bc3515b0904154b99b918d35af`.

Pushing `7f4bfce` to GitHub `main` is confirmed, but no post-push Vercel
deployment, Ready state, promotion, Production smoke, or immutable
deployed-byte identity for that commit has been observed. An earlier owner
screenshot showed `371540f`; it neither proves a failed deployment nor proves
that the later commit was deployed. Technical Production baseline
`fea3b2e11c6331eddc1ee091b165427d8e0218d7` remains the last independently
post-deployment-verified baseline. Source, localhost, owner-observed vendor
state, and immutable deployed-byte proof must remain separate evidence classes.

After this bounded authority commit and push, a fresh Codex or Claude Code
session must inventory its available MCP/tools/skills, read the current
authority and implementation surfaces, recompute Git truth with read-only
commands, report discrepancies and the unverified Vercel boundary, then stop
and wait. That grounding prompt authorizes no review, tests, edits, database or
session access, browser/vendor work, Git mutation, deployment, promotion,
Production smoke, or GO/NO-GO. A later owner instruction may separately
authorize Chrome inspection of the existing signed-in Vercel dashboard. Final
Milestone 12 disposition remains external.

## Historical Release Continuity (2026-08-31; superseded)

At the start of this authorized authority synchronization, Git branch `main`
had local `HEAD` at route-maintenance Git commit SHA-1
`06e15128db3027cd1c231b4919ddf440f54eb72b` (`06e1512`), after product
Git commit SHA-1 `12736ffb31cf54354212ef0ee13cf107e6d0846c` (`12736ff`) and home-auth
Git commit SHA-1 `6849aecbc6ecc2ae75697e80b3ae201d902dd68c` (`6849aec`). `origin/main`
and remote `main` still pointed to pushed offline-camera Git commit SHA-1
`c4de5ab30caadf963908f0b8cab2d49ee9678481` (`c4de5ab`). The index was
empty, there were no untracked paths, and there were zero stashes. The exact
remaining delta was 13 modified tracked paths: the 11 authority documents,
`docs/offline-map-refresh.md`, and `scripts/quality-gates.js`. The owner
explicitly authorized this session to commit and push this bounded work.
The final authority scope also includes `README.md`, `.env.example` comments,
and `database/supabase/README.md` so migration 0021 status is consistent; the
authority commit therefore contains 16 paths. `.env` was never read.
Recompute live Git truth in every later session; this start snapshot is not
permission to normalize any difference.

Commit `6849aec` fixes the reported anonymous `/home#` access: browser
fragments are not sent to Express, and `/home` now uses `requireLogin` before
rendering. Commit `12736ff` contains the reviewed product batch: the admin
search icon has a reserved gutter; the landing-page user roles count is 4;
Navigate Buildings is removed from the student/instructor dashboard; instructor
labels use Instructor and News & Announcements; the guest sidebar is limited to
Overview and News & Announcements and its Achievements card is removed; events
sort by date/id descending (newest first); `/home` removes Offices and loads
bounded current Featured Locations and Latest Events; refresh layout remains
gap-free; the service worker is v36; and Guided-VR scene-navigation hotspots use
a compact directional portal marker while info hotspots remain distinct.
The follow-up product commit `c1ca1b4` changes the auth tab to the
provider-neutral `Sign in using Email` label and removes the `/home` campus
search surface while retaining its three quick links. Documentation wording is
recorded separately in `9de526e`.

Instructor OAuth registration and profile display/editing now require only the
Google-provided name, email, and picture; position, department, and employee ID
were removed from those surfaces. Migration
`0021_minimal_instructor_oauth_registration.sql` preserves the exact
17-argument RPC, stays `SECURITY INVOKER` with a fixed search path, keeps
`PUBLIC` EXECUTE revoked, and grants `service_role` EXECUTE. The owner applied
0021 in Supabase and supplied read-only postflight evidence that the old
instructor guard is absent and the intended privileges remain. Codex did not
apply it. Do not reapply migration 0021. There is no real CSPC instructor Gmail
available, so no real CSPC instructor end-to-end OAuth observation exists.

Commit `06e1512` preserves the minimal MySQL seed while preferring Academic
Building IV for the expanded `ccs` route node, tracks the fail-closed local
repair utility, and keeps the historical route/data freeze scoped to migrations
0001-0020 while recognizing 0021 as auth-only. This synchronization did not run
the repair utility with `--apply`, apply SQL, or mutate either database.

Current source evidence is not Production evidence. `npm test` exited 0 with
`4687/4687` and `QUALITY-GATES OK`; the final canonical session-residue check passed `18/18`.
`npm run qa` also exited 0 with `QUALITY-GATES OK`, `DB-PERF-GATE OK`,
`[supabase-smoke] PASS`, `IDENTITY-CONSTRAINTS OK`, and zero audit
vulnerabilities.
The green suite figures above are accepted 2026-08-31 source evidence, not a
claim about the fresh run. Fresh local verification on 2026-09-01 passed LT-05
(4,000/4,000 checks), LT-06 (3,200/3,200 checks), LT-08 (79,560/79,560
checks), the read-coalescing probe (6/6), DB-PERF-GATE, Supabase smoke,
identity constraints, npm audit (0 vulnerabilities), and the 18/18 residue
gate. The fresh `npm test` and first stage of `npm run qa` are RED only because
the live Supabase freeze assertions find 26 buildings versus the frozen 25;
the standalone pilot-credential probe also has three pre-existing Supabase
data findings. No Supabase content was changed; canonical session revocation
was limited to the explicitly authorized stale regression sessions. Docker
remained running with restart count 0/OOM false. Load-test artifacts are under
`artifacts/`; this remains local/source evidence, not Production proof.
Focused evidence includes instructor minimal-profile `30/30`, OFF.2 PWA
`145/145`, VR hotspot navigation green, and package boundary `74/74`. The
current source package is 190 files, 7,227,026 bytes, aggregate SHA-256
`64ecc147335f1393afbb872f1ae87ccab7e29177c2b33dad4e0bcb3e71b2ba71`.
A rebuilt Docker localhost check covered `/home`, `/events`, the guest
dashboard, and Guided-VR with no console errors. The scoped review order was
Security -> Performance -> Correctness -> Maintainability -> Testing and found
no open blocker; it was not a separate independent reviewer engagement.

Retain the offline-map authority. Its abbreviated lineage is
`78fbc0e` -> `99f08d2` -> `4785b1b` -> `c4de5ab`. The publisher
is software: `.github/workflows/offline-map-refresh.yml` runs
`scripts/publishOfflineMapRelease.js` at `30 18 * * *` or by explicit manual
dispatch. Do not repeat bootstrap or rollback without a new explicit owner
decision. The fixed rectangle is `[123.373606, 13.404852, 123.378745,
13.406981]`; release-manifest center is `[123.375604, 13.405885]`; opening
camera is `[123.374590, 13.405872]` at zoom 16.5. Whole intersecting edge tiles
remain accepted, and strict polygon clipping is not a requirement. No actual
newly added OSM building has yet been observed end to end.

Historical offline evidence remains `21/21` and the `c4de5ab` package at 188
files, 7,242,957 bytes, aggregate SHA-256
`6790308c8cd157425a551c1bb910b3e2d3b899bc3515b0904154b99b918d35af`.
Owner-observed workflow, Drive, Vercel Ready, and browser behavior are not
independent verification of immutable deployed bytes. Technical Production
baseline `fea3b2e11c6331eddc1ee091b165427d8e0218d7` remains the last independently
post-deployment-verified baseline.

Keep evidence classes separate: accepted historical evidence; the three new
local commits; current source/package/localhost evidence; owner-applied 0021
postflight evidence; owner-observed Production facts; missing real-instructor
OAuth and immutable deployed-byte proof; and external Final Milestone 12.
Production promotion or deployment is not authorized. After the bounded push,
a fresh Codex or Claude session must ground read-only, recompute live truth,
report, and wait for the owner. No next feature, database/vendor action,
Production smoke, or GO/NO-GO is authorized by this record. Final Milestone 12
disposition remains external.

## Historical Release Continuity (2026-08-29; superseded)

Live Git at the start of this synchronization is branch `main`, with local
`HEAD`, `origin/main`, and remote `main` all equal to pushed Git commit SHA-1
`c4de5ab30caadf963908f0b8cab2d49ee9678481` (`c4de5ab`,
`fix: align offline map startup view`). Its parent is pushed runtime-settings
Git commit SHA-1 `4785b1b3b88d5db587506902939de791bea31a1e` (`4785b1b`), whose
parents are pushed Drive-endpoint correction
Git commit SHA-1 `99f08d20104ca0b2df15a8f879604f6f5670662a` (`99f08d2`), pushed
offline-refresh implementation
Git commit SHA-1 `78fbc0ed65ee04ec29894b284e945756b8856e28` (`78fbc0e`), and pushed
authority commit (Git commit SHA-1 `1ca40d431f8382c5843535165b87be945a4dd324`
(`1ca40d4`). At the start, the index was empty, no untracked paths existed,
and there were zero stashes. Recompute live Git truth in every new session;
this start-of-sync snapshot never authorizes normalization when live truth
differs.

This synchronization is authority/static-contract work only. Its exact live
delta is 13 modified tracked paths: the 11 authority documents,
`docs/offline-map-refresh.md`, and `scripts/quality-gates.js`. The index is
empty, there are no untracked paths, and there are zero stashes. The checkpoint
is intentionally unstaged, uncommitted, and unpushed for owner inspection. A
later commit or push requires separate explicit owner authorization. Every new
session must recompute which state is live; this record authorizes no
promotion, deployment, Production smoke, database/session mutation, vendor
mutation, or GO/NO-GO.

The pushed `c4de5ab` delta from `4785b1b` contains exactly five paths:
`public/js/offline-guide-manager.js`, `public/maps/manifest.json`,
`public/sw.js`, `scripts/vercelPackageBoundary-probe.js`, and
`services/offlineMapReleaseService.js`. Those product/package edits are
committed and pushed and are not part of the current 13-path authority
worktree. The PMTiles archive and campus bounds are unchanged.

The retained safety branch `backup-pre-trailer-strip` still points to Git
commit SHA-1 `d387c9151f1582cc4a8fc80002be52e11956335f`.

Accepted history remains separate and unchanged: Milestones 8-11, RF.1-RF.6,
BE.1-BE.6, OFF.1-OFF.6, M12.P1 R1-R7, D1-D7, dependency-security
remediation, the independently reviewed `bb17b9b` release authority, and the
owner-observed later Production/OAuth/course evidence retain their recorded
dispositions. The abbreviated operative lineage is
`d786bdc -> c00db76 -> bb17b9b -> dc961b1 -> 2b4f42d -> e481d03 ->
38905b7 -> 0c906db -> 1ca40d4 -> 78fbc0e -> 99f08d2 -> 4785b1b ->
c4de5ab`.

The current offline-map release system is implemented and pushed. Commit
`78fbc0e` added the automated CSPC offline-map publisher, `99f08d2` corrected
the Google Drive upload endpoints, `4785b1b` passes the public runtime settings
through Docker Compose, and `c4de5ab` aligns the offline startup camera and
release-center validation. In this context, the "publisher" is software, not a
person: the scheduled or manually
dispatched GitHub Actions workflow
`.github/workflows/offline-map-refresh.yml` runs
`scripts/publishOfflineMapRelease.js`. The workflow is scheduled at
`30 18 * * *` and also supports explicit manual publish, first-setup bootstrap,
and rollback inputs. Do not repeat bootstrap or rollback without a new explicit
owner decision.

The publisher reads the daily Protomaps OpenStreetMap PMTiles source, obtains
the tiles intersecting the fixed campus rectangle, validates the resulting
archive and signed manifests, and writes a stable manifest plus
content-addressed release manifest and PMTiles archive to the dedicated Google
Drive folder. Its exact code-order rectangle is
`[west, south, east, north] = [123.373606, 13.404852, 123.378745,
13.406981]`, with release-manifest center
`[longitude, latitude] = [123.375604, 13.405885]`. The user-facing
coordinates are southwest `13.404852, 123.373606`, northeast `13.406981,
123.378745`, and release center `13.405885, 123.375604`.

The offline opening camera is intentionally separate from release metadata.
Its code-order target is `[longitude, latitude] = [123.374590, 13.405872]`
(user order `13.405872, 123.374590`), with zoom `16.5`, bearing `0`,
pitch `0`, minimum zoom `12`, and maximum zoom `19`. The recenter
control continues to use the offline guide's route origin. The rectangle
selects intersecting map tiles; normal tile-edge content outside the exact
rectangle may remain. The client accepts that outside-campus buildings may
appear and has accepted the square as accurate enough. Strict polygon clipping
is not a requirement or blocker.

Connected users still deliberately choose Download Offline Map or Update
Offline Map. The app downloads the public stable manifest, verifies its
Ed25519 signature, compares the release fingerprint, verifies the archive
hash, and atomically stores the accepted package in browser IndexedDB. MapLibre
then reads the stored PMTiles archive while offline. The service worker supports
the offline shell but does not implicitly cache the manifest, offline API, or
PMTiles archive. "Download" is therefore a user-requested durable browser
download backed by IndexedDB, not an automatic general-purpose HTTP cache.

Keep the two data sources distinct. OpenStreetMap/Protomaps supplies the
visual basemap, including building footprints. Supabase/PostgreSQL supplies
the real Production CampuSphere building records, markers, routes, VR links,
and schedule relationships; MySQL remains the local-development, fallback,
and rehearsal store. A new upstream OSM building footprint can appear in a
later offline basemap after it reaches the daily Protomaps source, the workflow
publishes a successful new release, and the user chooses Update Offline Map.
That footprint alone does not create a Supabase building record, CampuSphere
marker, route, VR link, or schedule.

Credentials remain outside Git. GitHub Actions repository secrets hold the
Google Drive OAuth client/refresh values, private Ed25519 signing key, Drive
folder ID, and stable manifest file ID. Production receives only the public
runtime configuration `OFFLINE_MAP_RELEASE_MODE=drive`,
`OFFLINE_MAP_PUBLIC_MANIFEST_URL`, and
`OFFLINE_MAP_SIGNING_PUBLIC_KEY`. Never record or print any secret value,
Drive identifier, public manifest URL value, or PEM key material in authority
documents, logs, prompts, screenshots, or commits. The private key signs
releases; only the public key is delivered to the app for verification.

Current focused source evidence is separate from deployed behavior.
`npm run qa:offline-map` passed `21/21`. JavaScript syntax and scoped
whitespace checks passed. The Vercel package-boundary probe passed `74/74`
and measured 188 files, 7,242,957 bytes, aggregate SHA-256
`6790308c8cd157425a551c1bb910b3e2d3b899bc3515b0904154b99b918d35af`.
Documentation and `scripts/` are outside that deployment package, so this is
source/package evidence rather than immutable deployed-byte proof.

Owner-observed operational evidence is also separate. The first GitHub Actions
publish failed its Drive request before `99f08d2`; a later bootstrap and
release succeeded. After `c4de5ab` was pushed, the owner reported another
successful **Publish offline CSPC map** workflow. The owner observed the stable
manifest, content-addressed release manifest, and PMTiles archive in Drive,
configured the required GitHub repository secrets and the three public
Production variables, and supplied a Vercel view showing `c4de5ab` Ready in
Production on branch `main`. The owner then confirmed that a hard-refreshed
Production `/offline.html` opens at the intended Main Gate camera view,
matching localhost. Earlier owner-observed network-emulation testing also kept
the downloaded campus map rendered while Chrome was Offline. These are useful
owner-observed acceptance facts, not independent verification of immutable
deployed bytes.

No actual newly added OSM building has yet been observed through the full
upstream-to-offline path. A temporary local synthetic boundary fixture
validated the exact PMTiles header/bounds and showed that an inside test
building was retained; the outside test building on the same edge tile was
also retained because the publisher copies whole intersecting tiles. That
result matches the accepted tile-edge behavior above. The helper was ad hoc,
has been removed, and is not part of the `21/21` automated offline-map gate.
Do not claim strict feature-level clipping or a real new-building end-to-end
observation.

The pushed `e481d03` candidate remains accepted historical product evidence.
It contains the completed non-Cloudinary campus stabilization and semester
room-schedule image flow: valid Guided-VR and Free Roam scene arrows, VR
light/dark parity, compact accessible online/offline pins, the offline label
`Guard House`, authenticated notifications, the Paga About card, admin
category/user filters, safe Google profile-image synchronization, and removal
of manual profile-photo upload. A room schedule is one semester-long image
document per room/facility; an administrator pastes an approved HTTPS
Cloudinary delivery URL and optional public ID, and CampuSphere does not upload
the image bytes. The owner applied `0020_room_schedule_documents.sql` to
Supabase and local MySQL schema parity was verified. Do not reapply migration
0020 without new explicit database authorization.

Accepted `e481d03` verification remains a distinct historical evidence class:
its source passed `npm test` at `4998/4998` with `QUALITY-GATES OK`; its
five-stage `npm run qa` exited 0 with `QUALITY-GATES OK`,
`DB-PERF-GATE OK`, `[supabase-smoke] PASS`, `IDENTITY-CONSTRAINTS OK`,
and zero audit vulnerabilities. Focused room-schedule verification passed
`58/58`, package boundary `74/74`, BE.6 `46/46`, and final session residue
`18/18`.

The pushed product commit `38905b7` was independently reviewed Security ->
Performance -> Correctness -> Maintainability with no critical, high, medium,
or low findings. Its read-only verification exited 0 for `npm test` and
`npm run qa`, and focused probes passed public FAQ `38/38`, site settings
`26/26`, settings runtime `20/20`, package boundary `74/74`, BE.6
`46/46`, and final session residue `18/18`. The public `/faq` page and the
administrator-managed institutional settings projection are implemented in
that commit without a schema or migration change.

Authority-sync validation on 2026-08-26 remains separate incomplete/rejected
evidence. Its source-only `docs-current` gate passed, but the full `npm test`
rerun was not green because two read-only live-state postconditions had
changed: Supabase had 665 total VR scenes against the 664-scene freeze, and
one intended-role canonical Supabase administrator session was unexpired at
classification time. No data or session was changed. Recompute those
conditions before relying on them; do not delete content, refresh a freeze, or
revoke a session without separate explicit owner authorization.

The accepted `e481d03` runtime package identity remains historical: 180 files,
7,189,621 bytes, aggregate SHA-256
`c07e34f43f859f3f4055c9a00f90b0a5967d323ef85e243227d95c8023195216`.
The `38905b7` product package identity also remains historical: 186 files,
7,220,073 bytes, aggregate SHA-256
`c19b2bb9bcd328df56f0eb247077f48e0c3cc6f35bf919c0e22da0d3add1f621`.
The current pushed product package identity is the 188-file identity recorded
above.

The last independently post-deployment-verified technical Production baseline
`fea3b2e11c6331eddc1ee091b165427d8e0218d7` remains. Owner-observed workflow,
Vercel Ready status, and browser behavior for `c4de5ab` do not establish
immutable deployed-byte identity. Do not infer an independent Production GO or
Final Milestone 12 acceptance from those observations.

Production architecture remains Supabase/PostgreSQL for application data and
sessions, with MySQL for local development, fallback, and rehearsal. The stored
frozen verification baseline remains MySQL 34 buildings / 44 route nodes / 100
directed edges / 50 exact reverse pairs / 100 valid geometries; Supabase 25 /
26 / 50 / 25 / 50; and the shared Guided-VR catalog 25 active destinations /
472 configured steps / 99 unique scene keys. The accepted candidate's final
canonical-session postcondition was zero unexpired residue (`18/18`). The
supported local MySQL session revocation and MySQL CCS route correction are
closed operational history and authorize no further data or session mutation.

The owner-run `scripts/syncSupabaseContentToMysql.js --dry-run` remains
read-only preview evidence: it reported no content differences and equal
fingerprints SHA-256
`2504a0474b0481964d447f5f538b9e4e1cd77ef0116c4299c12d0a81eae5bf05`.
No data was written. Preserve the external backup/restore record of `109/109`
files and 86 referenced Cloudinary delivery assets without putting credentials,
signed URLs, database identifiers, backup paths, participant PII, developer
contact details, or verification artifacts in Git.

Google OAuth remains owner-observed `In production` and requests only
`openid email profile`; Google Data Access reported that sensitive or
restricted-scope verification is not required, and the owner confirmed account
creation and sign-in work. Branding/Search Console ownership remains deferred
and unverified. The owner-attested 2026-08-05 human pilot remains accepted with
zero reported findings; participant/Form evidence and full source identity
remain external. The Android 8 installed-PWA observation remains classified as
an unsupported Android/Chrome compatibility observation, not a confirmed
CampuSphere code or hardware defect. The supported mobile presentation target
is Android 10+ with a current Chrome release.

Keep evidence classes separate: accepted historical release/R8 evidence;
course-feature evidence; live Git truth; accepted `e481d03`
source/package/review/push evidence; `38905b7`
source/package/verification/review evidence; earlier authority commits;
current `c4de5ab` offline-camera and offline-refresh source/package evidence;
owner-observed GitHub Actions/Drive/Vercel/browser behavior; the synthetic
boundary observation; the missing real-new-OSM-building observation; the
missing independent deployed-byte proof for `c4de5ab`; owner-applied
migration 0020; the read-only content-sync
preview; OAuth/pilot/Android observations; and the external Final Milestone 12
disposition.

The offline boundary and refresh path are no longer the active blocker. After
this authority sync, use the fresh Codex or Claude grounding-only prompt,
recompute live truth, report, and wait. The owner may then select another bug,
addition, or feature under separate explicit authorization. No fresh session
may infer authority to review, implement, test, commit, push, promote, deploy,
alter SQL/data/sessions, contact vendors, run Production smoke, or issue a
GO/NO-GO merely from this record.

Every older section below that presents an earlier candidate or lifecycle as
"current" is retained only as an explicitly historical snapshot. This block
and fresh live repository/vendor evidence win when they conflict.

Final Milestone 12 disposition remains external.
<!-- M12 RELEASE CONTINUITY END -->

<!-- M12 HISTORICAL RELEASE CONTINUITY START -->
## Historical Release Continuity (2026-08-24; superseded)

Live Git at the start of this authority synchronization was branch `main`,
with local `HEAD`, `origin/main`, and remote `main` all equal to pushed Git
commit SHA-1 `dc961b1eeba191d79b96998d96f0a49dac3ffcf8`. The index was empty;
the worktree contained exactly 58 modified tracked paths and 12 untracked paths
(70 dirty paths total), with zero stashes. Eleven authority documents plus
`scripts/quality-gates.js` are the 12 tracked authority/static-assertion
surfaces; the other 46 tracked paths and all 12 untracked paths belong to the
current uncommitted implementation. The retained safety branch
`backup-pre-trailer-strip` points to
`d387c9151f1582cc4a8fc80002be52e11956335f`. Preserve this worktree exactly
and recompute live Git truth in every new session rather than reusing this
time-specific snapshot.

The release lineage is verified offline implementation
`d786bdcb83a196c7263dceae668417d3ced3e95a`, bounded readiness/session
maintenance `c00db76c5be0fe9c8dfdc8168a4c4303c6a0aa64`, independently reviewed
release authority `bb17b9b603583bcc2934e3ffab1cbdcb7d6b0ddd`, and searchable
course-catalog enhancement
`dc961b1eeba191d79b96998d96f0a49dac3ffcf8`.

The accepted `bb17b9b` release evidence remains unchanged. Its independently
reviewed authority delta covered 12 files and 1,854,481 bytes, with manifest
SHA-256
`1c5ed249dd21894a2cb0871a04fc650deebfe2fa790b7e260d123415a4aa45c7`.
Its release package pin was 168 files and 7,074,195 bytes, aggregate SHA-256
`13cd3c5e5d8259766e50b1136c8cc8a5672b2321c65962892358c62b45ef88f5`.
Replacement verification completed with `npm test` exit 0 and
`QUALITY-GATES OK`; `npm run qa` exited 0 with `QUALITY-GATES OK`,
`DB-PERF-GATE OK`, `[supabase-smoke] PASS`, `IDENTITY-CONSTRAINTS OK`, and
`found 0 vulnerabilities`; bounded Chrome acceptance completed in Supabase
and MySQL modes; final ordered postconditions passed at
`24/24 -> 18/18 -> 46/46`. The clean-commit independent R8 review returned
**GO** with no critical, high, medium, or low findings.

The owner separately authorized the `bb17b9b` push and manual Vercel promotion.
Owner-observed dashboard evidence showed `Ready`, blue `Production`, branch
`main`, and an 11-second build. No independent anonymous GET-only
post-promotion byte verification has been recorded for `bb17b9b` or
`dc961b1`. Git commit SHA-1
`fea3b2e11c6331eddc1ee091b165427d8e0218d7` remains the last independently
post-deployment-verified technical baseline; that historical smoke is not byte
proof for either later commit.

The owner supplied 29 official course titles for this application plus
`Other`. Commit `dc961b1` replaced the abbreviated selectors and added an
accessible, case-insensitive course search to new-student OAuth registration
completion and the existing student profile editor. Clearing the query or
pressing Escape restores the list; no matches retain `Other`; live status text
announces result counts. Existing saved legacy course values remain visible
until a student deliberately selects a new value. The submitted field remains
`course`; controllers, repositories, APIs, database schema, and migrations did
not change. The six-file commit recorded 433 insertions and 28 deletions.

Course-feature verification is a separate evidence class: the implementation
session recorded `npm test` exit 0 with `QUALITY-GATES OK` and five-stage
`npm run qa` exit 0 with `QUALITY-GATES OK`, `DB-PERF-GATE OK`,
`[supabase-smoke] PASS`, `IDENTITY-CONSTRAINTS OK`, and zero audit
vulnerabilities. The in-session package-boundary run passed `74/74` and
reported a then-current working-tree package of 168 files, 7,088,275 bytes,
aggregate SHA-256
`9849e3c18c70e54a3502217275724367945ff176be22ce4d20796b5c103dc9ec`.
Because unrelated authority/static-assertion edits were already unstaged, that
working-tree package identity is not clean-commit or deployed-byte proof. The
feature commit was pushed, separately promoted by the owner, and the owner
confirmed the registration and profile course flows work in Production. This
is owner-observed functional acceptance, not an independent review, byte
smoke, or new GO/NO-GO.

Production uses Supabase/PostgreSQL for application data and sessions; MySQL
remains local-development/fallback/rehearsal data. An offline-guide download is
a backend-specific immutable snapshot taken through the supported guide API.
Therefore a production download is built from the then-current Supabase
building and route data and should match the online production map for that
download point. The offline scope remains the normal 2D campus map, Main Gate
routes, text building details, the approved local placeholder, and required
2D map assets. It excludes 360/Guided-VR/Free-Roam content, schedules,
building photos, Cloudinary media, and private/admin/session data.

The local MySQL readiness residue incident is closed history: the readiness
poll now uses the pre-session `/favicon.ico` route, and the exact authorized
supported cleanup destroyed 309 harness-shaped anonymous sessions with
cleanup fingerprint SHA-256
`a50b800e370439e0257cb7667d3fdb567af9dab88b87c3aeca6f32593598d18d`,
leaving zero candidates and zero scanned residue. No cleanup is authorized by
this record. Migration sources are contiguous through `0020`; owner-applied
`0020_room_schedule_documents.sql` is recorded before this verification.
Preserve one-writer control and the external
backup/restore evidence: 109/109 manifest files verified, isolated Supabase and
MySQL restore proofs passed, and 86 referenced Cloudinary delivery assets were
exported and hashed without claiming a Cloudinary management/original-account
export.

The owner attests that the human pilot occurred on 2026-08-05 and accepts it
with zero reported findings. Participant/Form evidence remains external, no
participant PII is recorded in Git, and the tested build's full source-commit
identity was not independently verified. This is owner-attested pilot
acceptance, not independent current-build verification; pilot review is
complete for sequencing.

Google OAuth is now owner-observed `In production`. CampuSphere still requests
only `openid email profile`, and Google Data Access reported that sensitive or
restricted-scope verification is not required. The owner confirmed Google
account creation and sign-in work. Branding is not verified: Search Console
ownership for `campussphere-cspc.vercel.app` was not completed, the consent
branding remains unavailable, and the owner chose to defer that optional
branding work while sign-in functions. Do not describe OAuth as verified or
unlimited. Public local registration still creates guests only; trusted
student/instructor identity comes from CSPC Google OAuth.

The current uncommitted candidate is a stabilization candidate that includes the semester room-schedule image
flow, owner-applied `0020_room_schedule_documents.sql`, admin-pasted Cloudinary
delivery metadata, accessible image viewing, direct VR schedule-document links,
valid Guided-VR and Free Roam scene arrows, VR light/dark theme parity; smaller
accessible building pins online and offline; the offline display label `Guard
House`; the authenticated notification feed/panel and its cross-page stylesheet
ownership; the Paga About card; admin category-dropdown styling and user
role/status filters; safe Google profile-image synchronization; and removal of
the manual profile-photo upload. Do not record
or reuse any credential, account identifier, support contact, or secret.

The owner-run `scripts/syncSupabaseContentToMysql.js --dry-run` preview was
read-only and reported no content differences; the Supabase source and MySQL
target fingerprints both equalled
`2504a0474b0481964d447f5f538b9e4e1cd77ef0116c4299c12d0a81eae5bf05`.
No data was written, and users, role profiles, login sessions, and activity
logs remained excluded. This is preview evidence only, not an applied sync,
backup, restore proof, or current database verification. Existing instructor
OAuth completion collects full name, read-only email, employee ID, department,
and position. The owner-observed Android 8 installed-PWA crash remains
unresolved even though ordinary browser OAuth later worked; Docker/client-clone
deployment readiness also remains deferred.

The owner selected this next sequence: a fresh session grounds first; a later
separately authorized session verifies the non-Cloudinary changes; Cloudinary
support remains an external event-based dependency; and if no response has
arrived, work continues on verified non-Cloudinary findings one bounded issue
at a time. Manual Cloudinary upload stays deferred until the owner supplies a
sanitized support response and separately authorizes a bounded permission and
upload-acceptance plan. Grounding prompts do not themselves authorize tests,
fixes, browser/server work, database access, or vendor operations.

Evidence classes must remain separate: accepted historical release/R8
evidence; course-feature verification; live Git truth; the current uncommitted
implementation; previously reported focused/source checks; owner-observed
localhost visual acceptance; the Supabase-to-MySQL dry-run preview; the pending
Cloudinary blocker; the unresolved owner-observed Android installed-PWA
behavior; owner-observed Vercel/Production and OAuth facts; the missing
independent post-promotion byte verification for `dc961b1`; and the missing
current full QA, independent review, commit, push, deployment, and Production
acceptance for this worktree. This synchronization issues no new GO/NO-GO and
authorizes only these authority/static-contract edits plus bounded source-only
validation. It authorizes no product implementation, browser/server work,
database/session access, vendor mutation, Git-history mutation, push,
promotion, deployment, or production smoke. Final Milestone 12 disposition
remains an explicit owner/external closeout decision.

Every older section below that labels the pre-promotion maintenance state as
“current” is retained only as a historical snapshot. This continuity block and
live repository/vendor evidence win when they conflict.
<!-- M12 HISTORICAL RELEASE CONTINUITY END -->

<!-- M12.P1 CURRENT STATUS START -->
**HISTORICAL PRE-PROMOTION SNAPSHOT (2026-08-21; superseded by the current
release continuity block above).**

Accepted history remains unchanged: Milestones 8-11, RF.1-RF.6, BE.1-BE.6,
OFF.1, M12.P1 R1-R7, D1-D5, and expanded D7 are complete and Codex GO. The
limited human-pilot review is owner-accepted as described below. OFF.2-OFF.6
are complete and Codex GO on local commit
`cdbc863b779e5319c14dee21a31a5e78951e233c`; M12.P1-D6 is complete and Codex
GO on local commit `691f0bef40e06b6ea9485e713d2fe3000a03bd83`. The exact
19-file offline UI/accessibility/package implementation was independently fully
verified, committed as `d786bdcb83a196c7263dceae668417d3ced3e95a`, and pushed
to `origin/main`.

Historical/rejected: the independent read-only closeout review of exact 19-file predecessor manifest
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
Replacement full verification of the committed implementation passed at
`4998/4998` with `QUALITY-GATES OK`, five-stage QA at the same exact contract
total, bounded Chrome acceptance in both supported backends, and ordered
postconditions `24/24 -> 18/18 -> 46/46`. The clean-commit independent R8
review then returned NO-GO solely because stale operative lifecycle authority
still described this pushed, verified commit as uncommitted and pending; it
found no separate runtime, security, database, or package blocker. This R8
result remains the current external disposition until a later corrected review.

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
  2D `35/35`, and package boundary `74/74`; the accepted committed implementation package identity remains
  168 files, 7,073,128 bytes, aggregate SHA-256
  `1d6cc68b7ef350b6a61eb8d84ea4fb7dd6862bd8548beb7595d3f2e6f4b10d6a`.
The `494010dd...` manifest is predecessor evidence for the committed
implementation, not a pin for the later documentation/static-assertion
correction. The correction is a separate byte set: live Git and the latest
independent external review report control its lifecycle and disposition, and
this authority text does not claim that correction is reviewed, committed,
pushed, R8-approved, promoted, or deployed. Final Milestone 12 disposition
remains external. The accepted technical Production baseline remains
`fea3b2e11c6331eddc1ee091b165427d8e0218d7`; future `main` deployments require
explicit manual promotion, and no promotion or deployment is authorized here.

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

The accepted local OFF.2-OFF.5 implementation is committed as
`cdbc863b779e5319c14dee21a31a5e78951e233c`. It begins from clean main
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

Accepted focused evidence is green after that correction: the integrated
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

The committed offline UI/accessibility implementation package is 168 files,
7,073,128 bytes, aggregate SHA-256
`1d6cc68b7ef350b6a61eb8d84ea4fb7dd6862bd8548beb7595d3f2e6f4b10d6a`.
The rejected pre-correction package was 168 files, 7,071,943 bytes, aggregate
SHA-256 `dd00055741fedecd9d99f081c612f8c18e6573d7a121d5903d866fcebddb0a33`;
it is historical candidate evidence only.
The package identity is independently pinned and the implementation's replacement
verification is recorded above; it is not deployment authorization. The accepted local D6/OFF predecessor package remains
historical at 168 files, 7,042,705 bytes, aggregate SHA-256
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
postconditions. At that historical point, the bounded correction was confined
to current-authority documentation and existing static assertions and claimed
no Codex GO. It was superseded by the later independent review and definitive
replacement verification recorded below; no session or data correction was
required.
The accepted local M12.P1-D6 admin dashboard analytics implementation is
committed as `691f0bef40e06b6ea9485e713d2fe3000a03bd83`. It replaces the dashboard's
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

Historical pre-full-verification focused evidence for the corrected bytes is
the D6 probe in STATIC-ONLY mode at
`247/247`, the D6 gate at `113/113`, and the package-boundary probe at `74/74`.
The ordinary database-backed probe mode was NOT executed under that bounded
authorization, and no database was contacted. Full-suite verification was not
authorized and was not run; the structurally expected registered total is `4998`
when both backends are reachable; that statement was superseded by the
definitive database-backed verification below.
Historical/rejected after the review: the earlier D6 probe result `132/132`,
whose MySQL leg was reported NOT EXECUTED while the run still reported success,
the earlier D6 gate at `63/63`, and the earlier `4822` structural total.

D6 commit-readiness is Codex GO. Definitive evidence for 15-file manifest
SHA-256 `317d1312599d66171b08d850d84a746f701d5167f4f31ee233aa55cb0436212d`
is `npm test` `4998/4998` with `QUALITY-GATES OK`, the ordinary D6 probe
`266/266` with both required MySQL and Supabase comparison legs, five-stage
`npm run qa` at the same exact contract total, and ordered postconditions
`24/24 -> 18/18 -> 46/46`. The implementation was then committed locally as
`691f0bef40e06b6ea9485e713d2fe3000a03bd83` without push or deployment.

OFF.2-OFF.6 are Codex GO. OFF.6 browser acceptance passed for both backends:
MySQL covered `34/34` building details and `33/33` available routes with one
truthful unavailable building; Supabase covered `25/25` details and `25/25`
routes. Desktop/mobile layout, search, keyboard activation, offline reload and
map rendering, failed-update preservation, neutral protected-route fallback,
forbidden-data absence, and supported logout deletion all passed. The first
OFF.6 full-suite run is historical/rejected at `4995/4998` because it exposed
unreviewed Supabase geometry drift on route edges 198/199. One separately
authorized supported atomic pair write restored the frozen geometry; focused
BE.6 returned `46/46`, the Supabase building/route fingerprint returned to
`727605aa08c648ea645148087e937ea8f9723ca2fc201c3ece7f7c0229424625`, and
the combined BE.6 fingerprint returned to
`db51567e7a84fe37deeee436b305edd7f3e3aada6138e9111645a604fa12c77e`.
The unchanged 40-file candidate at manifest SHA-256
`e4436faba637bf592e220859469ca59fcf62870be731bc1d915f133c254e79a2`
then passed the replacement `npm test` at `4998/4998` with
`QUALITY-GATES OK`, D6 `266/266`, BE.6 `46/46`, and embedded residue `18/18`.

Fresh-session boundary: the current Codex and Claude Code prompts authorize
grounding only and then wait for the owner. Neither prompt authorizes further
implementation, Git mutation, a new deployment or promotion, another pilot, or
Milestone 12 GO.

At this 2026-08-21 correction boundary, the implementation is committed and
pushed as `d786bdcb83a196c7263dceae668417d3ced3e95a`. Its exact committed
implementation manifest SHA-256 `92c689b884f52021f5545f331e8768ffc4768914cf9320c2d4b8fedee7020642`
covers 19 files and 2,072,400 bytes. Replacement full verification passed at
`4998/4998` with `QUALITY-GATES OK`, five-stage QA at the same exact contract
total, bounded Chrome acceptance in both supported backends, and ordered
postconditions `24/24 -> 18/18 -> 46/46`. The package pin is 168 files,
7,073,128 bytes, aggregate SHA-256
`1d6cc68b7ef350b6a61eb8d84ea4fb7dd6862bd8548beb7595d3f2e6f4b10d6a`. The
clean-commit independent R8 review returned NO-GO solely for stale operative
lifecycle authority; no separate runtime, security, database, or package
blocker was found. The later documentation/static-assertion correction has its
own bytes; live Git and the latest independent external review report control
its disposition. No promotion or deployment is authorized by this
synchronization.
The synchronized auth/home candidate records `npm test` `4687/4687` with
`QUALITY-GATES OK` and `npm run qa` at the same exact contract total, with
five-stage QA and ordered postconditions `24/24 -> 18/18 -> 46/46`.
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
> Milestone 12 GO remains
> blocked by pilot review plus OFF.2-OFF.6 and D6.
>
> Milestone 10 Cloudinary Media Support is complete and Codex GO; Section 10.8
> passed its final end-to-end GO/NO-GO. Milestone 11: Room Scheduling is
> complete and Codex GO; Section 11.8 passed its final GO/NO-GO.
<!-- M12.P1 PRIOR STATUS END -->

> **CURRENT VERIFICATION BASELINE.** The former post-R5/pre-R6 synchronization
> run that ended RED with safety `22/24`, residue RED, and no established BE.6
> postcondition is superseded historical evidence. A separately owner-authorized
> supported restoration closed that blocker. R6 re-verified safety `24/24`,
> canonical residue `18/18`, and BE.6 `46/46` with the frozen fingerprint
> unchanged before editing and again after verification. The accepted R6
> closeout is focused `230/230`, full suite `3415/3415` with
> `QUALITY-GATES OK`, and independent browser verification green.

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

## Prior Stop Point

This section is historical continuity only. Before the 2026-07-30 restoration,
the stop point was the RED `22/24 -> 16/18 -> 41/46` precondition and bounded
restoration sequence. The current status block above records the later QA-
induced residue blocker and supersedes this historical green snapshot.

1. `M12.P1-R5`, both R5 follow-ups, dependency-security remediation, R6, R7,
   both R7 source-auditability corrections, and expanded D7 are complete and
   Codex GO.
2. At that historical stop point the safety baseline was R1 `24/24`, residue `18/18`, and BE.6
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

## BE.1 Through BE.3 Historical Decisions

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

## BE.4 Historical Revised-Scope GO

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

## OFF.1 Historical GO And PWA Privacy Truth

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
  consent; the current BE.6-frozen public catalog for the selected supported
  backend; bounded public schedules for today through 14 days; Guided-VR
  metadata for all 25 active destinations plus approved Free-Roam data;
  best-effort tiles; versioned/atomic storage; and logout cleanup. The
  13-building roster is only the reproducible seed baseline. The package
  excludes authenticated HTML, sessions, CSRF, credentials,
  profile/admin/private data, mutations, raw errors, and unapproved media.

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

## Owner-Authorization Boundary After Pilot Acceptance

- The full authenticated app remains on accepted technical Production baseline
  `fea3b2e11c6331eddc1ee091b165427d8e0218d7`.
- The owner attests that a human pilot occurred on 2026-08-05 and accepts it
  with zero reported findings. Participant/Form evidence remains external and
  no participant PII is recorded in Git. The tested build's full source-commit
  identity was not independently verified, so this is owner-attested pilot
  acceptance rather than independent current-build verification.
- Pilot review is complete for sequencing purposes. The owner-authorized local
  OFF.2-OFF.5 implementation candidate has focused evidence but no Codex GO.
  D6, OFF.6 browser acceptance, and final Milestone 12 GO remain open. Never
  describe the accepted pilot as offline readiness or final M12 signoff.
- Do not build feedback persistence, an API mutation, or a migration without
  new scope. Existing authentication/role gates stay unchanged; no anonymous
  browsing is added.

## Remaining Owner Decisions

1. R3 through R7, both R5 follow-ups, dependency-security remediation, both
   R7 source-auditability corrections, and expanded D7 are complete and Codex
   GO. The R7 and D7 execution prompts are spent and archived below; they
   authorize nothing further.
2. The later R8 lifecycle completed and technical Production baseline
   `fea3b2e11c6331eddc1ee091b165427d8e0218d7` is accepted. Vercel
   `Auto-assign Custom Production Domains` is disabled, so future `main`
   deployments require explicit manual promotion. This handoff authorizes no
   new deployment or promotion.
3. Pilot review is complete by owner acceptance. The owner-authorized local
   OFF.2-OFF.5 implementation candidate has focused evidence but no Codex GO.
   D6, OFF.6 browser acceptance, and M12.P2 final closeout remain open and
   separately gated. This handoff authorizes no further offline implementation.

The pilot acceptance changes sequencing, not the offline product obligation.
OFF.2-OFF.5 independent acceptance, D6, and OFF.6 remain open, not cancelled.
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

For a fresh thread, use the sole current Claude Code prompt in
`docs/new-session-grounding-prompts.md`. The list below remains a repository
map and does not override that prompt's read-only stop conditions.

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

## Historical Latest Continuity Snapshot

- D4 is complete and Codex GO. Both backends match the frozen
  `20/48/24/48/24/13` topology, VR `85/66`, and BE.6 fingerprint
  `a1e11ac03f15f837dade60dead664a88ff30b0bf313a99b760789d079892591d`.
- D5 is complete and Codex GO. Final evidence includes focused D5 `153/153`,
  full suite `2558/2558`, BE.6 `46/46`, credential/session safety `24/24`, and
  independent standalone Playwright MCP desktop/mobile and fail-closed negative
  cases with zero building mutations and complete cleanup.
- At that snapshot credential/session safety was `24/24`, canonical residue was `18/18`,
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
