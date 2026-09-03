# CampuSphere — Deployment & Environment Guide

Milestone 8, Section 8.9 (updated in Milestone 9, Section 9.7 for the Supabase
session store). This document covers environment variables, secret handling,
Supabase migration order, administrator-pasted Cloudinary media metadata, MySQL fallback setup, production session policy
(Supabase-preferred, MySQL fallback), the security middleware, OAuth redirect
URIs, Docker packaging, the Vercel demo/UAT target, the QA gates, and
troubleshooting.

CampuSphere is an Express 5 + EJS server-rendered app. It runs against **MySQL**
(the default and fallback) and/or **Supabase/PostgreSQL** (the cloud target),
selected per-domain at runtime by the `*_DATA_SOURCE` switches. The app keeps
Express session auth + Google OAuth; **Supabase Auth is not used**.

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
worker v38, and Guided-VR portal-marker changes remain accepted. Migration
`0020_room_schedule_documents.sql` and migration
`0021_minimal_instructor_oauth_registration.sql` are owner-applied in Supabase.
Migration 0021 preserves the 17-argument RPC, `SECURITY INVOKER`, fixed search
path, revoked `PUBLIC` EXECUTE, and granted `service_role` EXECUTE. Do not
reapply migration 0020 or 0021 without a new explicit database authorization.
There is still no real CSPC instructor Gmail end-to-end OAuth observation.

The current identity-lock candidate makes student, guest, and instructor names
server-controlled: verified Google given/family claims take precedence, then the
Google full name, then a normalized email prefix. Completion and profile fields
are read-only for those roles, tampered names are rejected or ignored, and
Google-login resynchronization is best-effort. This candidate is not a database
backfill or a deployment claim.

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
package remains 191 files and 7,239,253 bytes with aggregate SHA-256
`8db237eecd6946c8ced5a9a65a770e94f05b0ecc34f29b57ee71231a5f26764a`;
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
gap-free; the service worker is v38; and Guided-VR scene-navigation hotspots use
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
The synchronized auth/home candidate records `npm test` `4687/4687` with
`QUALITY-GATES OK` and `npm run qa` at the same exact contract total, with
five-stage QA and ordered postconditions `24/24 -> 18/18 -> 46/46`.

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
Git commit SHA-1 `d387c9151f1582cc4a8fc80002be52e11956335f`. Preserve this worktree exactly
and recompute live Git truth in every new session rather than reusing this
time-specific snapshot.

The release lineage is verified offline implementation
Git commit SHA-1 `d786bdcb83a196c7263dceae668417d3ced3e95a`, bounded readiness/session
maintenance Git commit SHA-1 `c00db76c5be0fe9c8dfdc8168a4c4303c6a0aa64`, independently reviewed
release authority Git commit SHA-1 `bb17b9b603583bcc2934e3ffab1cbdcb7d6b0ddd`, and searchable
course-catalog enhancement Git commit SHA-1 `dc961b1eeba191d79b96998d96f0a49dac3ffcf8`.

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
sync preview fingerprint SHA-256 `2504a0474b0481964d447f5f538b9e4e1cd77ef0116c4299c12d0a81eae5bf05`.
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

## Historical 2026-08-21 Pre-Promotion Production Snapshot

OFF.2-OFF.6 are complete and Codex GO on local Git commit SHA-1
`cdbc863b779e5319c14dee21a31a5e78951e233c`. M12.P1-D6 is complete and Codex
GO on local Git commit SHA-1 `691f0bef40e06b6ea9485e713d2fe3000a03bd83`. The exact
19-file offline UI/accessibility/package implementation was independently fully
verified, committed as Git commit SHA-1 `d786bdcb83a196c7263dceae668417d3ced3e95a`, and pushed
to `origin/main`.

Its exact committed implementation manifest SHA-256
`92c689b884f52021f5545f331e8768ffc4768914cf9320c2d4b8fedee7020642` covers 19
files and 2,072,400 bytes. Replacement full verification passed at
`4998/4998` with `QUALITY-GATES OK`, five-stage QA at the same exact contract
total, bounded Chrome acceptance in both supported backends, and ordered
postconditions `24/24 -> 18/18 -> 46/46`. The package pin is 168 files,
7,073,128 bytes, aggregate SHA-256
`1d6cc68b7ef350b6a61eb8d84ea4fb7dd6862bd8548beb7595d3f2e6f4b10d6a`.

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
  SHA-256
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
The `494010dd...` manifest is predecessor evidence for the committed
implementation, not a pin for the later documentation/static-assertion
correction. The correction is a separate byte set: live Git and the latest
independent external review report control its lifecycle and disposition, and
this document does not claim that correction is reviewed, committed, pushed,
R8-approved, promoted, or deployed. Final Milestone 12 disposition remains
external. The accepted technical Production baseline `fea3b2e11c6331eddc1ee091b165427d8e0218d7`
remains the live alias; future `main` deployments require
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

- The Guided-VR runtime/catalog remediation remains recorded as Git commit
  SHA-1 `43627cf0a77741556f4e701711e55612a739799b`, Git tree SHA-1
  `eb3e830f68d537c4a54d6dda6df7d52a61f9c87b`. The final R8 authority
  synchronization is committed and pushed as Git commit SHA-1
  `fea3b2e11c6331eddc1ee091b165427d8e0218d7`; live Git at the
  post-deployment review confirmed branch `main`, local HEAD, and origin/main
  all matched that commit.
- The separately authorized push automatically triggered Vercel Production
  through the Git integration while automatic production-domain assignment
  was still enabled. The owner accepts
  `https://campusphere-cspc.vercel.app` on deployed technical Production
  baseline `fea3b2e11c6331eddc1ee091b165427d8e0218d7`. Owner-observed Vercel
  evidence showed `Ready`, `Production`, `Current`, branch `main`, and source
  commit `fea3b2e`; the build completed in 17 seconds. Its only disclosed
  warning was that `engines.node` is `>=22`, which permits a future major Node
  version to be selected automatically.
- Post-deployment verification passed within a bounded anonymous read-only
  GET-only scope. The production alias served the expected public pages and
  static assets; sampled deployed bytes matched the pushed source; protected
  HTML routes redirected to `/auth`; protected JSON routes returned `401`; and
  the checked responses set no session cookie. `/auth` was deliberately not
  requested because it may create an anonymous identity-free session. No
  authentication, schedule-audit path, database/session mutation, or vendor
  management operation was exercised. The accepted source package identity is
  158 files, 6,245,074 bytes, aggregate SHA-256
  `b3113c05daaa5d2e870f204083923434456580fa6499190421de062ce9cabbd4`.
- The owner then disabled Vercel `Auto-assign Custom Production Domains` under
  Production Branch Tracking. Future `main` pushes may create staged
  Production deployments, but an explicit later `Promote to Production`
  action is required before a staged deployment replaces the live alias. The
  saved dashboard state showed this control as `Disabled`; it was not tested
  with a dummy push.
- The later documentation/static-assertion-only authority synchronization is
  committed and pushed as Git commit SHA-1
  `db05b549807535840968bf28cdefac4154a6d59d`. Live Git then confirmed branch
  `main`, local HEAD, and origin/main all matched that commit with a clean index
  and worktree. Owner-observed Vercel evidence showed its deployment as
  `Ready` / `Production` / `Staged`, with custom-domain assignment `Skipped`.
  It was not promoted or made `Current`; the live alias remained on technical
  Production baseline `fea3b2e11c6331eddc1ee091b165427d8e0218d7`.
- Historical/superseded: before `fea3b2e` became Current, Production served
  technical Production baseline `0627bf78228148e3f989275810c333c16a1f3356`.
  Its five-file verification passed
  logout `75/75`, `npm test` `3777/3777` with `QUALITY-GATES OK`, all five
  `npm run qa` stages, final `24/24 -> 18/18 -> 46/46`, and anonymous smoke
  `31/31`. The review had low/advisory findings and a disclosed
  same-author/self-review limitation; that evidence remains historical and did
  not authenticate or exercise schedule auditing.
- The automated frozen-data production rehearsal PASSed with isolated admin,
  student, and guest Playwright MCP contexts. It created and removed exactly one
  temporary student and guest through supported interfaces, restored the
  seven-user baseline, closed the sessions, and finished at
  `24/24 -> 18/18 -> 46/46`. It is automated rehearsal evidence only, not a
  human pilot or Google Form response. Its PII/transcript, temporary-file,
  misclick, and human sign-in sequencing deviations remain disclosed in the
  authority handoffs and are not repeated with sensitive values here.
- The owner attests that a human pilot occurred on 2026-08-05 and accepts it
  with zero reported findings. Participant/Form evidence remains external and
  no participant PII is recorded in Git. The tested build's full source-commit
  identity was not independently verified, so this is owner-attested pilot
  acceptance rather than independent current-build verification. Pilot review
  is complete for sequencing purposes. OFF.2-OFF.6 and D6 are complete and
  Codex GO on local Git commit SHA-1
  `cdbc863b779e5319c14dee21a31a5e78951e233c` and local Git commit SHA-1
  `691f0bef40e06b6ea9485e713d2fe3000a03bd83`. Final Milestone 12 disposition
  remains external to this document. The implementation is pushed as Git commit
  SHA-1 `d786bdcb83a196c7263dceae668417d3ced3e95a`; promotion and deployment remain
  separate owner decisions.
- The 13-building `models/data.js` roster remains the reproducible seed
  baseline, not the complete live catalog. MySQL currently has 34 buildings,
  44 route nodes, 100 directed edges, 50 exact reverse pairs, and 100 valid
  geometries. Supabase currently has 25 buildings, 26 route nodes, 50 directed
  edges, 25 exact reverse pairs, and 50 valid geometries. The shared catalog
  has 25 active Guided VR destinations, 472 configured steps, and 99 unique
  scene keys. Migrations remain exactly `0001-0019`; no `0020` exists.
- The separately authorized backup/cutover used one-writer control and
  supported admin interfaces. Isolated Supabase and MySQL restores passed;
  the external manifest verifies 109/109 files; and all 86 referenced
  Cloudinary delivery URLs were exported and hashed. That delivery export is
  not a Cloudinary management/original-account export. A later bounded admin
  correction removed exactly three redundant MySQL scene links after visual
  preflight; no building, schedule, route, scene, or user was removed. A fresh
  MySQL dump passed 6/6 checksum and isolated restore/redump checks. No direct
  SQL, blanket cleanup, or sync apply was used.
- After the owner logged out the accessible administrator/student sessions,
  exact preflight found one MySQL administrator, one MySQL student, and one
  Supabase administrator session. A first bounded wrapper stopped before
  mutation on a role-label mismatch. The corrected wrapper invoked supported
  `revokeUserSessions()` exactly once for each verified backend-local identity.
  It used no direct session-row deletion and changed no account or application
  data. That pre-QA read-only postcondition was `24/24 -> 18/18 -> 46/46`.
- The failed `npm run qa` attempt that stopped at 4,512 contract passes after a
  mixed-mode integration `ECONNRESET` remains historical/rejected. Its
  incomplete student logout left exactly one unexpired canonical Supabase
  student session and produced the historical `17/18` residue reading. Under a
  separate bounded authorization, a fail-closed preflight reverified exactly
  one intended-role student identity, that one session, and zero sessions for
  the other three canonical Supabase identities; `revokeUserSessions()` was
  then invoked exactly once for that student. It used no direct SQL or direct
  session-row deletion, changed no account/application data, and performed no
  broad cleanup. The ordered precondition returned to
  `24/24 -> 18/18 -> 46/46`.
- The independent read-only review of prior candidate manifest SHA-256
  `b4c2c3c2a5766399b843c6e43f2f8cf347bcc04473e5ba6a0a808397c77a3d56`
  returned commit-readiness NO-GO on the incomplete CAS sequence guard, a stale
  SEC-37 package claim, obsolete OFF.3 scope, and premature pilot sequencing.
  The bounded follow-up pins the ordered CAS hash, extends rejecting fixtures,
  binds SEC-37 to the independent package pin, and restores the complete
  review-to-pilot authorization order. The prior manifest and its then-required
  independent review are historical; the latest external report controls the
  corrected bytes' disposition.
- A subsequent independent read-only review of exact 33-file manifest SHA-256
  `2f78d9754094572ac2b6a2bec02786d66b35a651141cd8c0f5705ac85d1282a8`
  returned commit-readiness NO-GO because the exact package inventory was not
  enforced against the live manifest, obsolete handoff policy was historical
  but not isolated from current authority, and current dates were stale. This
  bounded correction adds independent live package pins and byte-drift
  fixtures, explicit handoff-history boundaries, authority/date fixtures, and
  synchronized current dates. It changed no runtime or data; that candidate's
  later disposition is historical.
- The independent read-only review of exact 34-file manifest SHA-256
  `ebf1142c11e3c027c0b3339a6888bc19196936ae3323644d907c68def224c4b4`
  returned commit-readiness NO-GO because six current-authority documents
  repeated the rejected 4,628-PASS retry with an incorrect lower failure count
  after already recording the transcript-faithful nine wording failures plus
  residue. This bounded correction removes the duplicate claim and adds a
  cross-document analyzer with accepting/rejecting fixtures. It changed no
  runtime or data; the latest external report controls its later disposition.
- The first verification of that correction is historical/rejected at
  `4640/4641`: the new analyzer stopped at the evidence ledger's first 4,628
  mention, so one combined documentation assertion failed while runtime probes
  and embedded `18/18` residue remained green. The analyzer now evaluates every
  bounded 4,628 scope; no session or data correction was required.
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
  historical/rejected. Live Git and the latest external review report establish
  the later commit/push/R8 disposition; deployment and GO remain unclaimed.
- The committed offline UI/accessibility implementation package is 168
  files, 7,073,128 bytes, aggregate SHA-256
  `1d6cc68b7ef350b6a61eb8d84ea4fb7dd6862bd8548beb7595d3f2e6f4b10d6a`.
  The rejected pre-correction package was 168 files, 7,071,943 bytes,
  aggregate SHA-256
  `dd00055741fedecd9d99f081c612f8c18e6573d7a121d5903d866fcebddb0a33`;
  it is historical candidate evidence only.
  The package identity is independently pinned and the implementation's
  replacement verification is recorded above; it is not deployment
  authorization. The accepted local D6/OFF predecessor
  package remains historical at 168 files, 7,042,705 bytes, aggregate SHA-256
  `fe08232edf026edcbd33371df7d484bfaf39e3de0dafe22f5144e18e08efbf2b`
  (historical/rejected after the independent review, never accepted: the first
  D6 candidate at 168 files, 7,022,574 bytes, aggregate SHA-256
  `779d331824026ce0c1c9510e6393790d0a8da508498a395c1e97d9a04c19e7fd`, 15-file
  manifest SHA-256 `a6202b0f2106f244d58a41fbc1d646f360356df299790d5f88d44fe2729a2bc2`)
  (historical/blocked, never accepted: the OFF.3-OFF.5 2D offline-navigation
  candidate at 165 files, 6,971,229 bytes, aggregate SHA-256
  `e383f2fe708c5233192ec3602727ed2029dbc906df1ad53a75a70f6fa583334b`)
  (historical/blocked, never accepted: candidate manifest SHA-256
  `af7a1a333db0653449727ee5b6b7f223606686a05717ef6f107607bd99f04e9c` with
  package 165 files, 6,970,280 bytes, aggregate SHA-256
  `fc5d8bdcc7a6482bd256d4504224018cfc56ba418f56d81babd6e0ec5a4ff783`, whose
  service-worker header and API guards were incomplete)
  (historical/blocked, never accepted: 165 files, 6,969,343 bytes, aggregate
  SHA-256 `2dd88fede872db81a771a9d7273c8fd0264e2f6006d5eee09f33a1b930400523`
  at candidate manifest SHA-256
  `60154d93a3a3109a374a80ffeb4e20f8650aaa131b9b4ff97c16b028cade5f2d`, because
  automatic API caching contradicted the consent-driven offline-package
  boundary; and 165 files, 6,968,875 bytes, aggregate SHA-256
  `115dccba1fc4d9707caa5c43cc8bd7f9340bd7d92286513ad562d60af60b100f`);
  independent package pins are synchronized and focused execution passes
  `74/74`; the registered in-suite package gate also passed inside the rejected
  4,635-PASS full-suite attempt described below.
  Accepted technical Production remains the 158-file / 6,245,074-byte /
  aggregate SHA-256
  `b3113c05daaa5d2e870f204083923434456580fa6499190421de062ce9cabbd4`
  predecessor. The offline candidate is not deployment authorization and must
  not be pushed/promoted/deployed before the presentation.
- The first full verification of the offline candidate is
  historical/rejected at `4635/4641`: `npm test` exited 1 after 4,635 PASS
  lines and emitted no `QUALITY-GATES OK` because exactly six static
  documentation/authority assertions failed. Every executed runtime, database,
  catalog, BE.6, and final embedded `18/18` residue check was green.
  Fail-closed sequencing stopped before `npm run qa` and before the standalone
  `24/24 -> 18/18 -> 46/46` postconditions. At that historical point the
  bounded correction had focused evidence only and claimed no Codex GO. It was
  superseded by the later independent reviews and definitive verification. No
  session or data correction was required.
- The first authority-follow-up execution is historical/rejected at
  `4635/4641`: six static lifecycle/documentation checks failed, while all
  runtime, database, catalog, BE.6, and embedded residue probes were green,
  including `18/18`. The labels, predicates, and prompts were corrected before
  a fresh rerun; no session or data correction was needed.
- The first integrated read-only M12.P1-R8 review of clean commit `43627cf`
  reverified the exact package pin above, `npm test` `4641/4641` with
  `QUALITY-GATES OK`, five-stage QA at the same exact contract total, and final
  `24/24 -> 18/18 -> 46/46`. It returned R8 NO-GO solely because operative
  authority falsely described the committed and pushed candidate as dirty,
  uncommitted, and unpushed; it found no separate runtime, security, database,
  or package blocker. The bounded follow-up corrects that lifecycle wording,
  preserves current R7 `72/72` versus accepted historical `71/71`, and adds
  accepting/rejecting fixtures. The follow-up's commit, push, and R8 disposition
  are established only by live Git and the latest external review report; this
  repository snapshot deliberately makes no self-referential claim about those
  later events. The required lifecycle is independent commit-readiness review ->
  local commit -> separately authorized push -> clean-commit R8 re-review.
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
  returned R8 NO-GO solely because the current reusable Claude prompt retained
  self-expiring review claims and the Git-lifecycle analyzer did not cover their
  original open-before-review word order. This bounded correction makes both current copy-paste prompts
  state-neutral and extends the existing assertion with lifecycle fixtures. It
  changes no runtime, database, session, or package bytes; live Git and the
  latest external review report control its disposition.
- Its first verification execution is historical/rejected at `4640/4641`:
  the new negative-fixture group exposed that the lifecycle analyzer rejected
  qualified review phrases but not the generic `independent review`
  equivalent. All application, backend, Guided-VR, BE.6, and final embedded
  residue checks were green. The matcher now rejects both forms; no runtime,
  database, session, or package correction was required.
- The first verification of the exact original-phrase coverage is
  historical/rejected at `4639/4641`: the reverse-order matcher was initially
  too broad and treated clearly historical `pending`/`required` review prose as
  operative. Every executed runtime/backend probe and the final embedded
  `18/18` residue gate were green. The matcher is now confined to the original
  `open independent ... review` word order plus the already covered forward
  forms; no runtime, database, session, or package correction was required.
- The subsequent independent read-only review of exact 11-file manifest
  SHA-256 `c4a4c2b5bd592c00126f06736e8f8587d0de3dde189b506177bd764fddf3a192`
  returned R8 NO-GO solely for the uncovered exact open-before-review phrase;
  it found no other blocker. The narrowed correction passed `npm test`
  `4641/4641`, full five-stage QA, and final `24/24 -> 18/18 -> 46/46`.
  Its verified pre-handoff Manifest SHA-256
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
- Pilot review is complete by owner acceptance. OFF.2-OFF.6 and D6 are complete
  and Codex GO. D6 passed `npm test` at `4998/4998` with `QUALITY-GATES OK`,
  five-stage `npm run qa` at the same exact contract total, and ordered
  postconditions `24/24 -> 18/18 -> 46/46`. OFF.6 browser acceptance passed in both backends;
  after supported restoration of the discovered Supabase route-edge 198/199
  geometry drift, the unchanged candidate passed replacement `npm test` at
  `4998/4998` with D6 `266/266`, BE.6 `46/46`, and embedded residue `18/18`.
  Final Milestone 12 disposition requires the independent closeout review.
  This status records deployment truth; it is not authority for another deploy,
  database change, media operation, or destructive data replacement.

### Required Backup And Additive Cutover Gate

Before replacing the selected-demo routes, nodes, edges, buildings, panoramas,
hotspots, or schedules with real campus data:

1. Freeze writers: schedule a maintenance window, nominate one administrator,
   and stop simultaneous admin edits for the cutover.
2. Produce a timestamped Supabase backup using the provider-supported backup or
   PostgreSQL dump path, covering schema, roles/permissions required for
   restoration, and data. Record tool/version, source project identifier,
   timestamp, object counts, size, and SHA-256 in owner-controlled evidence.
3. Inventory and export Cloudinary assets separately. Database backups contain
   only Cloudinary identifiers/URLs, not the image bytes. Record public IDs,
   resource types, versions, dimensions/bytes, folder/tags, and checksums where
   available; keep credentials and signed URLs outside Git.
4. Restore the database backup into an isolated non-production target and prove
   authentication-safe startup plus representative building, routing, schedule,
   VR, and media reads. A backup is not accepted until restore is demonstrated.
5. Capture a final pre-cutover database/media delta and stop if it differs from
   the approved manifest.
6. Apply an additive cutover through supported repositories/admin interfaces:
   preserve or deliberately map stable building IDs; add buildings; add nodes;
   add both directions of each edge with geometry; add/relink route steps;
   add/relink scenes, hotspots, and schedules; verify participant behavior; then
   remove superseded schedules/hotspots, edge pairs, unused nodes, and buildings
   last. Never use blanket deletion as the first step.
7. Recompute topology, routing, selected-VR, package/deployment, credential,
   residue, and BE.6 evidence. Changes to selected content invalidate the old
   freeze until `config/selectedDemoFreeze.js` is deliberately reviewed and
   refreshed. A data backup does not back up source code; retain the Git commit
   and deployment record separately.

The backup, isolated restore proofs, additive reconciliation, and duplicate-link
correction described above have been performed. Focused catalog and BE.6 probes
are green; the exact synchronized full contract/QA matrix and final ordered
postconditions recorded above passed on the candidate bytes. Bounded
independent-review findings were remediated and the corrected matrix passed.
Live Git and the latest external review report control the later disposition;
deployment remains separate and is not authorized by this documentation record.

## Historical/Superseded — 2026-07-30 R8 Continuity Status

The following section records what was known on July 30. It is retained for
incident traceability and does not override the August 12 status above.

- Historical/superseded: before the `0627bf7` deployment, production at
  `https://campusphere-cspc.vercel.app` used the independently Codex-accepted
  SEC-51 runtime baseline `d422b54393f659125912ec5c84ae7927c2533288`.
- Repository HEAD `db034e5581e6f409083a43dcb80fb82b473e0127` is a later
  documentation-only commit whose bytes differ from the production runtime
  commit. The current local correction candidate is uncommitted and unaccepted;
  it adds one bounded runtime change in `services/auditService.js` plus
  authority/gate updates.
- Independently verified database preconditions are GREEN: credential safety
  `24/24`, residue `18/18`, and BE.6 `46/46`. The leaked Supabase hotspot and
  sibling schedule are absent, all four canonical Supabase identities have
  zero unexpired sessions, MySQL is clean, and both backends carry the frozen
  51 selected-source hotspots and selected-VR fingerprint.
- Before the separately authorized 2026-07-30 restoration, the historical
  state was `22/24 -> 16/18 -> 41/46` with the exact leaked fixture and two
  canonical Supabase sessions. That superseded incident is not current truth.
- Do not run `syncSelectedCasVrSupabaseToMysql.js --apply`; before restoration
  it would have copied the leaked Supabase row into the clean MySQL baseline.
  The supported restoration is complete. No further cleanup, revocation, SQL,
  or session-row mutation is authorized by this correction candidate.
- No R8, deployment, pilot, or Milestone 12 GO is current. Migration `0020`,
  direct SQL cleanup, direct session-row deletion, staging, commit, push, and
  deployment remain unauthorized. Candidate totals `3752`, `3755`, `3760`,
  and `3763` are historical/superseded or rejected. The first 3,772-check
  authority/audit/total-consistency execution is rejected at 3,742 passes and
  30 failures with no `QUALITY-GATES OK`. The later 3,774/3,777 matrix also
  remains rejected after three `docs-current` failures, exit 1, and no
  `QUALITY-GATES OK`. An earlier frozen 12-file matrix was recorded as green
  `3777/3777`; that record is superseded and rejected, because a fresh
  execution against those exact frozen bytes exited 1 at `3776/3777` with one
  static failure, `cloudinary-docs :: docs contain no JWT/PEM/AWS/long-hex
  secret values`, raised by an unlabeled 40-hex Repository HEAD value in the
  then-current copy of this document.
- A bounded documentation-only correction labelled that value as
  `Repository HEAD` and preserved the truthful claim that the commit is a
  documentation-only commit and gate-work candidate, not a runtime deployment.
  `scripts/quality-gates.js` was not changed by that correction, and the exact
  frozen 12-file manifest is pinned in `docs/test-evidence.md`. A
  byte-consistent matrix was then executed once against the corrected manifest:
  preflight and postflight matched 12/12 hashes with Git, migration, and
  process state unchanged; both `node --check` runs and `git diff --check`
  exited 0 with only LF/CRLF advisories; the logout probe passed `75/75` at
  exit 0 with zero FAIL/ERROR/SKIP and zero escaped logout-error lines;
  `npm test` exited 0 at `3777/3777` with `QUALITY-GATES OK` present and
  `QUALITY-GATES FAILED` absent; `npm run qa` exited 0 with exactly 3,777
  contract PASS lines before `QUALITY-GATES OK` and all five green markers
  exactly once; and final ordered postconditions were `24/24 -> 18/18 -> 46/46`
  at exit 0 each. The two disclosed wrapper-only overmatches caused no
  application failure or retry. That `3777` figure is a transcript-wide
  PASS-line reconciliation across parent and inherited spawned-probe stdout,
  not an in-process `makeRecorder` counter.
- The byte-consistent result was candidate evidence at that historical point;
  its disposition is preserved by the corresponding external review. It
  establishes no current R8, SEC-51, deployment, pilot, or Milestone 12 GO.
- The local-candidate Vercel package inventory is 158 files, 6,201,747 bytes,
  aggregate SHA-256
  `acfb1696de0c8855e02aa82e243fec959aefec637f29bdf033bc34ffda42e8b1`.
  It describes local bytes only and is not deployment authorization.
- The owner-created feedback form is READY external evidence. Its responder URL
  and all secret values remain outside Git.

---

## 1. Environment variables

Set these in an untracked local `.env` (loaded by `dotenv`) for local runs, or as
real environment variables in your host/container platform for deployment. See
`.env.example` for the annotated template. **Never commit a real `.env`.**

### Core runtime

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NODE_ENV` | prod: yes | _(unset = non-prod)_ | `production` enables fail-closed session policy, the Secure `__Host-` cookie, and HTTPS upgrade. |
| `PORT` | no | `3000` | HTTP listen port. |

### MySQL (data fallback; also the fallback session store when `SESSION_STORE=mysql`)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DB_HOST` | mysql mode | `127.0.0.1` | MySQL host. In Docker Compose this must be the **service name** (`mysql`), not `localhost`. |
| `DB_USER` | mysql mode | `root` | MySQL user. |
| `DB_PASS` | mysql mode* | _(empty)_ | MySQL password. Required by the official MySQL image in Compose. |
| `DB_NAME` | mysql mode | `campusphere_db` | Database name. |

Required for any MySQL data-source (`*_DATA_SOURCE=mysql`) or fallback, and for
`SESSION_STORE=mysql`. A fully Supabase-backed production (Supabase data sources +
`SESSION_STORE=supabase`) does **not** need MySQL.

### Session / cookies / proxy (`config/sessionConfig.js`)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `SESSION_STORE` | prod: yes | prod `supabase`, else `memory` | `supabase` = preferred persistent store (`services/supabaseSessionStore.js`, table `public.app_sessions`; needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + migration `0011`). `mysql` = fallback/local-rehearsal persistent store (`services/mysqlSessionStore.js`, table `app_sessions`). `memory` is **local-dev only**; `SESSION_STORE=memory` **fails startup in production** (as does any unknown value). |
| `SESSION_SECRET` | prod: yes | dev fallback (insecure) | Signs the session cookie. In production it must be set, **≥32 chars**, and not a known placeholder, or the server **refuses to start**. |
| `SESSION_SECRET_PREVIOUS` | no | _(none)_ | Comma-separated rotated-out secrets that still **verify** old cookies. In production each value must also be ≥32 chars and non-placeholder. |
| `SESSION_COOKIE_MAX_AGE_MS` | no | `86400000` (24h) | Cookie lifetime (positive integer ms). Invalid value fails prod startup. |
| `TRUST_PROXY` | no | prod `1`, else `0` | Express `trust proxy` hops. Behind TLS termination the proxy must forward `X-Forwarded-Proto=https`. Invalid value fails prod startup. |

### Google OAuth (`controllers/authController.js`)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GOOGLE_CLIENT_ID` | no | _(none)_ | OAuth client id. If id or secret is missing, OAuth is disabled (`/auth/google` → `/auth?error=oauth_failed`); local login still works. |
| `GOOGLE_CLIENT_SECRET` | no | _(none)_ | OAuth client secret (server-only). |
| `GOOGLE_REDIRECT_URI` | no | `http://localhost:3000/auth/callback` | Must exactly match the Authorized redirect URI in Google Cloud (see §7). |

### Supabase (server-only; cloud data target)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `SUPABASE_URL` | for supabase mode | _(none)_ | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | for supabase mode | _(none)_ | **Privileged server-only key.** See §2. |
| `SUPABASE_ANON_KEY` | no | _(none)_ | Reserved; only if a future browser-safe read path is approved. |

`SESSION_STORE=supabase` uses the same `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
and additionally requires migration `0011_supabase_session_store.sql` (the
server-only `public.app_sessions` table) to be applied. **Supabase Auth is not used.**

### Cloudinary (media delivery and admin-pasted asset metadata)

Cloudinary is an optional delivery host for campus images and 360-degree VR panoramas. Administrators paste a validated HTTPS delivery URL and public ID; approved media is served from `https://res.cloudinary.com`, and CampuSphere does not upload, delete, transform, or manage Cloudinary assets. Manual profile-photo upload is deferred and excluded from this candidate; Google-managed profile photos remain read-only.

The URL boundary is enforced by `utils/mediaUrl.js`: approved Cloudinary delivery URLs and local `/img/*` / `/img/vr/*` fallbacks are accepted, while other external origins are rejected. `cloudinary_public_id` is administrator/server metadata and never appears in public/runtime responses. No Cloudinary credential is read by the application, and no browser direct-upload, unsigned-upload preset, SDK write, or Cloudinary Admin API flow exists.

### Runtime data-source switches (consumed today)

These are **live** — each controller/repository reads its switch at request time.
Each defaults to the MySQL/Leaflet fallback when unset, empty, or unrecognised.
The `supabase` modes require `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

| Variable | Values | Reads via | Selects |
| --- | --- | --- | --- |
| `AUTH_DATA_SOURCE` | `mysql` \| `supabase` | `config/authDataSource.js` | auth / profile / dashboard / admin-user backend |
| `CONTENT_DATA_SOURCE` | `mysql` \| `supabase` | `config/contentDataSource.js` | news / events / FAQs / settings backend |
| `BUILDING_DATA_SOURCE` | `mysql` \| `supabase` | `config/mapRuntime.js` | building reads (`/buildings`, `/map`, admin) |
| `ROUTE_DATA_SOURCE` | `mysql` \| `supabase` | `config/mapRuntime.js` | search / routes / pathfinding reads |
| `VR_DATA_SOURCE` | `mysql` \| `supabase` | `config/vrDataSource.js` | VR scene/hotspot + guided route reads |
| `SCHEDULE_DATA_SOURCE` | `mysql` \| `supabase` | `config/scheduleDataSource.js` | semester room-schedule image reads + admin document CRUD, with legacy time-row reads retained only as fallback. Must match `BUILDING_DATA_SOURCE` for building-linked flows and `VR_DATA_SOURCE` for new schedule hotspots; numeric IDs are not guessed across backends. This is real **admin-managed** data, not SIS/enrollment/instructor-load simulation. `supabase` mode requires `0012`, `0013`, and separately owner-applied `0020_room_schedule_documents.sql`. |
| `MAP_RENDERER` | `leaflet` \| `maplibre` | `config/mapRuntime.js` | map library used by the map views |

The final Supabase-backed runtime is:
`SESSION_STORE=supabase AUTH_DATA_SOURCE=supabase CONTENT_DATA_SOURCE=supabase BUILDING_DATA_SOURCE=supabase ROUTE_DATA_SOURCE=supabase VR_DATA_SOURCE=supabase SCHEDULE_DATA_SOURCE=supabase MAP_RENDERER=maplibre`.
The session store is selected independently by `SESSION_STORE` (preferred
`supabase`, fallback `mysql`); it is **not** tied to the `*_DATA_SOURCE` switches.

### Rate-limit overrides (`middleware/rateLimit.js`, all optional)

Fixed-window limiter. `*_MAX` = requests per window; `*_WINDOW_MS` = window
length in ms. Defaults shown. These variables set the limits and windows only —
**where** the counters live is chosen by the runtime (M12.P1-R4): an in-memory
Map locally, a shared Upstash Redis counter on Vercel. Limits, bucket scopes,
the fixed `429` body, and `Retry-After` are identical in both modes.

| Variable | Default | Bucket |
| --- | --- | --- |
| `RATE_LIMIT_AUTH_MAX` / `RATE_LIMIT_AUTH_WINDOW_MS` | `20` / `900000` | auth form preflight (per IP): POST `/login` `/register` `/auth/complete-registration` `/logout` |
| `RATE_LIMIT_LOGIN_ACCOUNT_MAX` / `RATE_LIMIT_LOGIN_ACCOUNT_WINDOW_MS` | `8` / `900000` | login (per hashed email+IP) |
| `RATE_LIMIT_OAUTH_MAX` / `RATE_LIMIT_OAUTH_WINDOW_MS` | `20` / `600000` | OAuth start/callback (per IP) |
| `RATE_LIMIT_PROFILE_MAX` / `RATE_LIMIT_PROFILE_WINDOW_MS` | `20` / `600000` | profile update (per user+IP) |
| `RATE_LIMIT_ADMIN_MUTATION_MAX` / `RATE_LIMIT_ADMIN_MUTATION_WINDOW_MS` | `80` / `300000` | admin mutations (per admin+IP) |

There is intentionally no "disable all rate limits" switch.

### Shared rate-limit store — Vercel only (M12.P1-R4)

Required **only** when `VERCEL=1`; validated by the same pure preflight and the
same single fixed sanitized refusal. Local development, Docker rehearsal, and
the test suites require none of them.

| Variable | Contract |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | Server-only HTTPS REST endpoint; must parse as HTTPS with a hostname and must **not** embed a URL username/password. |
| `UPSTASH_REDIS_REST_TOKEN` | Server-only REST token; nonblank, never a documented placeholder. |
| `RATE_LIMIT_KEY_SECRET` | Server-only HMAC key, **at least 32 characters** after trimming, never a documented placeholder. Not a session secret; do not reuse `SESSION_SECRET`. |

- **Dependency:** `@upstash/redis` pinned to **exactly `1.38.0`** (no caret or
  range). No `@upstash/ratelimit` or other limiter dependency is added.
  Anonymous SDK telemetry is disabled with the documented
  `enableTelemetry: false` constructor option.
- **Zero SDK retries:** the client is constructed with `retry: { retries: 0 }`,
  giving **exactly one transport attempt** per counted request. The SDK default
  is 5 retries with exponential backoff (6 total attempts), which is wrong for a
  limiter that sits in front of every request: retrying a failing shared store
  would multiply latency on every request during an outage instead of failing
  closed immediately. Note that `retry: false` is **not** equivalent — in
  `1.38.0` it sets `attempts: 1` and the request loop is
  `for (i = 0; i <= attempts; i++)`, so it still performs **two** attempts.
  `{ retries: 0 }` also leaves the backoff branch unreachable, so no retry timer
  is created.
- **Why shared:** Vercel runs many independent serverless instances. A
  process-local Map would let each instance keep its own counter and multiply
  the effective limit, which is the M12.P1 audit finding this section closes.
- **Atomic counters:** each counted request runs **one** server-side Lua `EVAL`
  that performs `INCR`, reads `PTTL`, and applies `PEXPIRE` when the window is
  new or an expiry is missing, returning the count and authoritative TTL. Redis
  executes the script as a single uninterruptible unit, so an increment can
  never lose its expiry and a live window is never extended by later hits.
  A normal Upstash pipeline is **not** atomic and is deliberately not used.
- **Key-level locking:** the script's first line is
  `#!lua flags=allow-key-locking`. Without that shebang Upstash runs a Lua
  script under the **global database lock**, so every rate-limit check would
  serialize against every unrelated command in the database. With it, Upstash
  locks only the keys passed in the `KEYS` array, letting disjoint buckets run
  in parallel. The flag requires every key touched by `redis.call` to appear in
  `KEYS`: this script passes exactly one key and accesses only `KEYS[1]`, and
  performs no database-wide write.
- **Authoritative `Retry-After`:** the adapter returns the raw Redis `PTTL` and
  never clamps it to the configured window. `PTTL` is how long the counter
  actually stays elevated, so it is the only truthful basis for `Retry-After`.
  If an operator lowers a configured window, pre-existing keys legitimately
  hold a longer TTL; clamping there would tell the caller to retry while the
  bucket is still over the limit, producing a guaranteed second `429`. Unusable
  TTL replies (negative, non-integer, non-numeric, missing) still fail closed.
- **Key privacy:** only an HMAC-SHA-256 digest is persisted. Keys are
  `csrl:v1:<scope>:<digest>`; values are a bare integer counter. Raw IP
  addresses, emails, user IDs, cookies, session IDs, tokens, secrets, and
  submitted content never reach a key, a value, a response, or a log. The
  namespace, version, and scope are part of the HMAC material as well as the
  visible key, so limiter scopes cannot collide.
- **Local behaviour:** outside Vercel the original in-memory fixed-window
  adapter is used, the Upstash package is never loaded, and
  `RATE_LIMIT_KEY_SECRET` is **not** required.
- **Fail-closed:** on Vercel, missing configuration is refused at startup. An
  unreachable store, a rejected command, or a malformed reply returns one fixed
  sanitized `503` (`{"success":false,"message":"Service temporarily
  unavailable."}`) with `Cache-Control: no-store`, never calls `next()`, and
  **never** falls back to a process-local Map. No URL, token, secret, HMAC
  input, key, command, reply, or stack is exposed, and an outage produces no
  per-request log volume.
- **Preserved:** the existing `429` JSON/HTML bodies, the integer `Retry-After`
  (seconds, ≥ 1), every `RATE_LIMIT_*` override, all five bucket scopes, the
  pre-body-parser placement of the auth/OAuth/profile/admin IP limiters, the
  identity-aware limiters' position after auth/CSRF, and the exemption of safe
  admin `GET`/`HEAD`/`OPTIONS` methods from mutation limiting.
- **No live credentials** appear in source, documentation, or this repository.
  `scripts/sharedRateLimit-probe.js` is the focused database-free, network-free
  gate; it drives the shared path with an injected deterministic fake and never
  contacts a real Upstash service.

### Dependency-security lockfile closeout

R4 and its dependency-security follow-up are complete and Codex GO. The
production graph resolves `body-parser@2.3.0` and `brace-expansion@2.1.2` after
compatible transitive lockfile updates. `package.json` remained byte-identical;
no direct dependency, override, `--force`, major framework upgrade, or
application-source change was added. `npm audit --omit=dev` and
`npm run qa:audit` both report zero vulnerabilities. Accepted R4 regression
evidence remains full suite `3040/3040`, focused R4 `180/180`, R2 `119/119`,
R3 `86/86`, R1 `24/24`, residue `18/18`, and BE.6 `46/46`. The superseded
pre-R5 authority-sync suite was `3050/3050` with `QUALITY-GATES OK` (+10
`docs-current` checks); after the R5 follow-up the accepted R5 closeout suite is
`3234/3234` with `QUALITY-GATES OK`, and the exact breakdown is recorded in
`docs/test-evidence.md`.

### Subsequent 2026-07-26 dependency advisory remediation

The accepted 2026-07-22 compatible lockfile closeout remains historical
evidence. A subsequent 2026-07-26 npm advisory drift required a reviewed direct
dependency update: production now pins `ejs@6.0.1`, and the former
`jake/filelist/minimatch/brace-expansion` production chain is absent.
`npm audit --omit=dev` and `npm run qa:audit` report zero vulnerabilities. The
change used neither `npm audit fix --force`, an override, a broad update, an
application-source change, nor a migration.

### Bounded anonymous access-denial auditing (M12.P1-R5; complete, Codex GO)

`M12.P1-R5`, its authoritative-global-total follow-up, and its documentation-
gate final correction are complete and Codex GO. It is an audit-write-volume
and privacy boundary, not an access-control change: routine anonymous requests
to login-gated or role-gated routes keep the
exact `302` to `/auth` (browser) and the exact fixed
`401 { success:false, message:'Authentication required.' }` (JSON) while
creating **zero** `system_logs` rows. Before R5, every logged-out request to a
protected route wrote one immutable audit row, so ordinary crawler and
bookmark traffic could amplify the audit table on a publicly reachable
deployment.

The single retained authorization-denial write is the authenticated wrong-role
case. It is dispatched through an authenticated-only helper in
`middleware/roleAuth.js` that refuses any actor without a positive integer id
and a non-blank role, and it keeps `event_type='authorization'`,
`action='access.denied'`, `outcome='denied'`, `target_type='route'`, the
query-free request path, and a fixed sanitized message. Real authentication
failures remain audited unchanged. No anonymous-denial table, raw-IP storage,
Redis denial record, periodic aggregation job, dependency, or migration was
introduced, and the audit trail stays append-only.

The R5 follow-up closed two independent Codex findings. The focused probe now
also captures a stable authoritative baseline of the unfiltered `system_logs`
total (`summary.total`) immediately before the anonymous batches — bounded,
condition-based, accepted only after two consecutive equal reads — and asserts
that total is unchanged across six consecutive reads afterward, proving the
twenty anonymous requests added zero rows of any taxonomy rather than merely
none of the filtered authorization/denied taxonomy. Separately, both reusable
grounding prompts in `docs/new-session-grounding-prompts.md` were corrected to
current authority and are now validated by a dedicated documentation gate that
extracts and independently checks each fenced prompt body.

`M12.P1-R6` is complete and Codex GO. It self-hosts the exact reviewed browser
dependencies, contracts the
obsolete executable CDN origins out of CSP, and proves the affected map/VR/admin
surfaces through focused and independent browser evidence. `M12.P1-R7` is
complete and Codex GO.

Deployment impact of R6: the deployed package now carries `public/vendor` —
18 shipped runtime/license files plus `public/vendor/manifest.json`, 19 files
and 1,560,376 bytes in total. The
browser fetches no executable script or stylesheet from any external origin.
The only external origins a deployed page may still contact are Google Fonts
(`fonts.googleapis.com`, `fonts.gstatic.com`), OpenStreetMap tiles
(`*.tile.openstreetmap.org`), the Iconify data API (`api.iconify.design`), and
Cloudinary media delivery (`res.cloudinary.com`) — all data, media, or fonts,
never executable. `worker-src 'self' blob:` must be preserved: the MapLibre UMD
bundle spawns its map worker from a `blob:` URL.

Every shipped `/vendor` asset's provenance is pinned INDEPENDENTLY of
`public/vendor/manifest.json` in `EXPECTED_VENDOR_INVENTORY` (probe code),
verified against official `npm view`/`npm pack`: the analyzer and the in-suite
`self-hosted-vendor` gate fail closed on any divergence and re-verify disk and
HTTP bytes against the pinned SHA-256s, so a coordinated bytes-plus-manifest-hash
swap fails without an explicit reviewed code change. Accepted R6 Codex GO
evidence: focused `230/230`, full suite `3415/3415` with `QUALITY-GATES OK`
(pre-remediation `3375/3375`), and the complete independent desktop/mobile
affected-page and missing-library browser matrix green.

### M12.P1-R7 Vercel Package and Static-CDN Boundary (complete; Codex GO)

`M12.P1-R7` and both source-auditability corrections are complete and Codex GO.
Its execution prompt in `CLAUDE_HANDOFF.md` is spent and archived under
`Historical Spent One-Shot R7 Execution Prompt`; it authorizes nothing further.

**Source-auditability remediation and audited-source list pinning (closed).**
The independent Codex R7 review found one blocking defect: a
single literal `0x00` byte in `scripts/vercelPackageBoundary-probe.js` (former
line 564, offset 25235) inside `computeAggregateSha256()`. The NUL separator is
intentional at runtime, but the literal source byte made ordinary
`rg`/`grep`/`git diff` classify the whole JavaScript file as binary, silently
removing a security-relevant file from source review. The byte was replaced with
the textual JavaScript escape `\0` (ASCII `0x5c 0x30`); the file grew by exactly
one byte, every other byte is identical, and the R7-closeout package preview
was unchanged (154 files, 6,166,956 bytes, aggregate `c7c16ed7…38b9ec`), proving
runtime behaviour is identical. The aggregate is abbreviated here on purpose:
this file is scanned for secret-shaped values and a full 64-character hex run
trips that scan. The complete value is recorded in `docs/test-evidence.md`,
`docs/security-checklist.md`, and the handoffs. A frozen audited-source set
(`.vercelignore`, `vercel.json`, `scripts/vercelPackageBoundary-probe.js`,
`scripts/quality-gates.js`) and a fail-closed `containsLiteralNulByte()` guard
the NUL contract. The independent Codex re-review then found a fail-open
substitution gap: the in-suite assertion trusted the probe's exported
`R7_AUDITABLE_SOURCE_FILES` wholesale, so swapping `scripts/quality-gates.js`
for another existing NUL-free file (e.g. `package.json`) still passed. The gate
now pins the audited-source list INDEPENDENTLY in
`EXPECTED_R7_AUDITABLE_SOURCE_FILES` (declared in `scripts/quality-gates.js`,
never derived from the probe) and requires EXACT ORDERED EQUALITY with the
exported list before accepting the byte scan. Accepted R7 Codex GO evidence is
focused `71/71`, in-suite `vercel-package-boundary` `70/70`, full suite
`3495/3495` with `QUALITY-GATES OK`, and `npm audit --omit=dev` at zero
vulnerabilities. The superseded literal-NUL
remediation candidate was `71/71`, in-suite `69/69`, suite `3494/3494`; the
superseded initial R7 candidate was `70/70`, in-suite `67`, suite `3492/3492`.
Following the accepted 2026-07-22 dependency closeout, a subsequent
2026-07-26 npm advisory drift is remediated: production pins `ejs@6.0.1`, the
`jake/filelist/minimatch/brace-expansion` chain is absent, and
`npm audit --omit=dev` reports zero vulnerabilities.
Expanded D7 is complete and Codex GO. Accepted D7 evidence is the fresh-context
role-isolation rerun: separate Playwright `BrowserContext` objects per role with
no storage carryover, both MySQL and Supabase legs completed and cleaned up
through supported application interfaces, `npm test` `3511/3511` with
`QUALITY-GATES OK`, `npm audit --omit=dev` at zero vulnerabilities, and
postconditions `24/24 -> 18/18 -> 46/46` with fingerprint
`a1e11ac0...92591d`
unchanged. The post-D7 logout-output hygiene remediation is independently
Codex-accepted as additive evidence: `3529/3529` with `QUALITY-GATES OK`, zero
escaped logout-error lines, audit zero, and postconditions
`24/24 -> 18/18 -> 46/46`; it does not supersede D7. The later R8 lifecycle
completed and culminated in accepted technical Production baseline
`fea3b2e11c6331eddc1ee091b165427d8e0218d7`. Human pilot evidence, OFF.2-OFF.6,
offline work, and final Milestone 12 GO were open at the R8 closeout. The owner
later accepted the 2026-08-05 pilot with zero reported findings; OFF.2 is now
the next workstream. No new deployment or manual promotion is authorized by
this section.

**Upload boundary.** The root `.vercelignore` is an allowlist: it begins with
`/*`, re-includes only `server.js`, `package.json`, `package-lock.json`,
`vercel.json`, and the ten runtime directories (`config`, `controllers`,
`middleware`, `models`, `repositories`, `routes`, `services`, `utils`, `views`,
`public`) with their descendants, then denies `public/img/sample 360/` and
`public/img/sample 360/**` AFTER the `public` re-inclusion. A new root file or
directory is therefore excluded by default. `.env*`, documentation and
handoffs, `scripts/`, `database/` and its migrations, screenshots and evidence
media, Docker files, local agent metadata, `node_modules`, logs/caches/temporary
material, and Git metadata are all excluded.

**Current package size after the 2026-07-26 dependency and bounded
session-store remediations.** 154 files
and 6,165,772 bytes, aggregate `44172479…c5910a`: 4 root files, 56 public assets
(68 minus the 12 excluded local panoramas), `config` 12, `controllers` 15,
`middleware` 8, `models` 1, `repositories` 8, `routes` 8, `services` 8, `utils`
8, `views` 26.

**Static/PWA headers.** The root `vercel.json` carries exactly `$schema` and
`headers`. Seven narrow rules: `X-Content-Type-Options: nosniff` on
`/css/:path*`, `/js/:path*`, `/img/:path*`, `/vendor/:path*`, and
`/manifest.webmanifest`; `Cache-Control: no-cache`, `Service-Worker-Allowed: /`,
and `nosniff` on `/sw.js`; and `nosniff`, `Referrer-Policy: no-referrer`, and
one fixed static-only CSP on `/offline.html`. There is no `builds`, `functions`,
`routes`, `rewrites`, `redirects`, framework/build/install override, or
catch-all rule. Long-lived immutable caching is deliberately NOT set because
these asset URLs are not content-hashed.

**CSP authority.** Express's per-response nonce CSP in
`middleware/securityHeaders.js` is untouched and remains the sole CSP authority
for dynamic responses; `script-src` is still exactly `'self'` plus the nonce.
The only static CSP is the session-neutral offline shell. Per Vercel's
documentation, headers set by a Function response take precedence over
file-based configuration, so the two never compete.

**Entrypoint.** `server.js` still exports the Express app and still opens a
listener only as the main module — the supported root-entrypoint detection path.
There is no `api/` duplicate, adapter, or `.vercel/` metadata.

**Verification.** `scripts/vercelPackageBoundary-probe.js` is standalone,
read-only, database-free, session-free, and external-network-free; it pins the
expected contract in probe code OUTSIDE both configuration files and proves the
static boundary from a temporary root served on dedicated port `3385`
(representative CSS/JS/icon/manifest/offline/service-worker/image plus all 18
vendored runtime files served 200 byte-identical; missing asset, excluded
panorama in decoded-space and percent-encoded forms, excluded root classes, and
traversal all `404` with no redirect). The in-suite `vercel-package-boundary`
gate drives the same analyzers with independent negative fixtures.

R7 changed no package manifest, created no upload archive or immutable
deployment manifest, linked no Vercel project, created no `.vercel` metadata,
and deployed nothing. Its console-only package preview describes the dirty
worktree and cannot become accepted upload evidence until a separately
authorized clean immutable Git snapshot exists.

Superseded, historical: the earlier documentation/authority synchronization
candidate run was RED and is not accepted deployment evidence. It ended with
nine failures after Supabase logout/session-destroy failures left unexpired
canonical administrator and student sessions; that post-run safety check was
`22/24`, the embedded residue gate was red, and the embedded BE.6 gate did not
establish its frozen postcondition. That blocker is closed: a separately
owner-authorized supported cleanup/restoration was performed and independently
reproduced, and the R6 session re-verified safety `24/24`, residue `18/18`, and
BE.6 `46/46` before editing and again after its full-suite run.

### Historical/superseded M12.P1-R8 package inventory record

This section preserves the July R8 and schedule-audit candidate inventories as
historical evidence. The 2026-08-01 current candidate inventory is recorded in
the current-status section above; the accepted `M12.P1-R7` closeout values are
unchanged historical evidence and are deliberately not overwritten.

Aggregate hashes are abbreviated here, matching this file's existing
convention; the full values are recorded in `docs/test-evidence.md`.

| Record | Files | Bytes | Aggregate SHA-256 |
| --- | --- | --- | --- |
| Accepted R7 closeout (historical; unchanged) | 154 | 6,166,956 | `c7c16ed7…38b9ec` |
| R8 clean-snapshot candidate (reviewed; CANDIDATE NO-GO) | 155 | 6,172,845 | `d8830164…c2fe9e9f` |
| R8 pilot-readiness correction candidate (superseded) | 157 | 6,192,992 | `0ae9f57d…ab999a1c` |
| R8 re-review correction candidate (superseded) | 157 | 6,194,154 | `77e34105…e1a8551a` |
| Historical/superseded deployed baseline `d422b54` before `0627bf7` | 158 | 6,201,603 | `28403afa…b664d3636` |
| Local schedule-audit correction candidate — historical/superseded | 158 | 6,201,747 | `acfb1696…da42e8b1` |

The deployed baseline adds one packaged file versus the superseded 157-file
record — `public/js/public-nav.js`, the shared anonymous-navbar client — under a
directory the allowlist already re-includes, so no new packaged path class
appears. Its remaining byte delta is confined to already-packaged files
(`views/landing.ejs`, `views/partials/navbar.ejs`, `views/auth.ejs`,
`views/complete-registration.ejs`, `public/css/styles.css`).
That historical local candidate kept the same 158-file set and added 144 bytes
only in the already-packaged `services/auditService.js`; its package record was
not a deployment decision.

The superseded 157-file record described a candidate that added two packaged
files — `views/privacy.ejs`
and `public/robots.txt` — plus a byte delta inside files that were already
allowlisted (`server.js`, `middleware/securityHeaders.js`,
`controllers/pageController.js`, `routes/index.js`, `public/css/styles.css`,
`views/auth.ejs`, `views/complete-registration.ejs`,
`views/partials/footer.ejs`). No new packaged path class is introduced: both new
files sit under directories the allowlist already re-includes.

Two changes separate the two records, and neither adds a new packaged path
class:

1. **`utils/buildingParticipantView.js` (+1 file).** This module was created
   after the R7 closeout was accepted, during the cross-role regression work,
   so the accepted R7 preview legitimately predates it. It is live runtime
   source, not verification residue: `controllers/buildingsController.js`
   requires it to build the participant Buildings page's display-only
   additional-details shape, and `scripts/buildingDetailsEditor-probe.js`
   exercises the same exported helpers. It performs formatting only — no
   database access, network call, credential, or stored contract change — and
   the public building JSON API keeps its existing raw shape.
2. **Byte delta within already-packaged files.** The admin-dashboard
   truthfulness correction edited `views/admin/index.ejs` and
   `controllers/adminController.js`, and the subsequent hygiene correction
   removed twelve trailing-whitespace bytes from `views/buildings.ejs` — all
   three already inside the allowlist.

Accepted R7 history retains the former seven-rule boundary. The current offline
candidate adds one exact content-hashed PMTiles immutable-cache rule and narrows
the static `/offline.html` CSP to the reviewed same-origin MapLibre/PMTiles/
manager scripts plus the required self/blob worker boundary. Express remains
sole authority over the per-response nonce CSP for dynamic responses.

This inventory describes the COMPLETE clean-snapshot candidate tree — the
committed repository state. The candidate's commit SHA is reported externally in
the session report and handed to the reviewer there; it is deliberately not
embedded in this file, because a commit cannot contain its own identifier.

**Inventory label (corrected in the R8 pilot-readiness correction).** The focused
probe previously stamped its output
`CURRENT DIRTY-WORKTREE BOUNDARY PREVIEW — NOT AN IMMUTABLE DEPLOYMENT MANIFEST`.
That was accurate while the deployable application lived in an uncommitted
working tree, but it became false once the complete intended state was committed,
and it contradicted this section. The label is now
`CURRENT VERCEL PACKAGE BOUNDARY INVENTORY - NOT DEPLOYMENT AUTHORIZATION`,
which stays neutral about worktree state (which the probe does not inspect) and
keeps the disclaimer that matters: enumerating the package is not permission to
upload it. The expected label is pinned independently in
`EXPECTED_PACKAGE_INVENTORY_LABEL` inside `scripts/quality-gates.js`, so the gate
never learns it from the artifact it audits, and reverting to the superseded
label fails closed. Accepted historical R7 evidence keeps the original label and
totals as history.

It nevertheless remains CANDIDATE EVIDENCE, not accepted upload evidence. It
becomes accepted evidence only through an independent read-only `M12.P1-R8`
review decision, and nothing here authorizes an upload, a Vercel link, or a
deployment.

The clean-snapshot candidate, its corrections, and the bounded evidence
re-execution recorded under "Bounded evidence re-execution (M12.P1-R8)" below
all await an independent read-only `M12.P1-R8` review decision. No R8 GO, Codex
GO, deployment GO, pilot GO, or Milestone 12 GO is claimed. Accepted `R1`-`R7`
and `D1`-`D7` history is unchanged.

`M12.P1` remains NO-GO for deployment and pilot readiness; deployment is not
authorized.

### Test-only Supabase regression credentials (M12.P1-R1; never runtime config)

The four retained local-login regression identities (admin, student,
instructor, guest) are supplied to authorized QA probes **only** through eight
test-only variables read by the shared loader
(`scripts/regressionCredentials.js`):
`SUPABASE_REGRESSION_ADMIN_EMAIL` / `SUPABASE_REGRESSION_ADMIN_PASSWORD`,
`SUPABASE_REGRESSION_STUDENT_EMAIL` / `SUPABASE_REGRESSION_STUDENT_PASSWORD`,
`SUPABASE_REGRESSION_INSTRUCTOR_EMAIL` /
`SUPABASE_REGRESSION_INSTRUCTOR_PASSWORD`, and
`SUPABASE_REGRESSION_GUEST_EMAIL` / `SUPABASE_REGRESSION_GUEST_PASSWORD`.

- Values live **only** in the ignored local `.env`. They are never committed,
  documented, printed, echoed in errors, exposed to the app or browser, or set
  as Vercel/deployment runtime variables (the application itself never reads
  them).
- Supabase-capable probes **fail closed** with a fixed sanitized message when
  any of the eight values is missing or blank; they never fall back to a
  documented or hardcoded live credential.
- Local MySQL probe runs do **not** use these variables: the deterministic
  local-only MySQL seed fixtures (`database/seed.js`) remain the MySQL-mode
  credentials.
- The read-only `scripts/pilotCredentialSafety-probe.js` verifies the live
  containment state (one row per identity, intended role, role-profile rows,
  replacement-hash match in memory, former-default rejection, zero unexpired
  sessions) without logging in or mutating anything.

---

## 2. Secret handling (read this)

`SUPABASE_SERVICE_ROLE_KEY` is a **privileged, server-only key** — treat it like a
database root password. It must **never** be:

- committed to git (kept only in an untracked local `.env` or the host env),
- rendered in an EJS template, `res.locals`, or `app.locals`,
- placed under `public/` or sent to any browser/`window` global,
- included in screenshots, recordings, logs, or error output,
- baked into a Docker image (it is provided at **runtime** only).

The same applies to `SESSION_SECRET`, `GOOGLE_CLIENT_SECRET`, and `DB_PASS`. The app logging is sanitized (no secrets/cookies/session ids/SQL/stacks in normal output); keep it that way. The Docker image ships
**no** `.env` (see §8).

---

## 3. Supabase SQL apply order

Migrations live in `database/supabase/` and are **applied manually** by the
project owner in the Supabase SQL editor.

**Fresh project** — apply in order:

```
0001_initial_schema.sql
0002_seed_data.sql
0003_auth_profile_functions.sql
0004_building_backfill.sql
0005_building_write_functions.sql
0006_admin_content_and_logs.sql
0007_route_graph_admin_write_functions.sql
0008_profile_update_atomic_function.sql
0009_public_registration_trust_policy.sql
0010_performance_indexes.sql
0011_supabase_session_store.sql
0012_room_schedules.sql
0013_vr_hotspot_schedule_metadata.sql
0014_route_graph_accuracy.sql
0015_route_edge_path_geometry.sql
0016_route_geometry_admin_writes.sql
0017_route_topology_guard_house.sql
0018_cas_building_baseline.sql
0019_be5_selected_demo_parity.sql
0020_room_schedule_documents.sql
```

**Existing project** — apply only the migrations not yet run, in ascending order.
All migrations are written to be idempotent/additive where practical
(`CREATE ... IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`).

> **Production GO gate:** migrations through `0020_room_schedule_documents.sql`
> **must be applied before final production GO** — including
> `0010_performance_indexes.sql` (DB performance/index parity, required by
> `npm run qa:db`), `0011_supabase_session_store.sql` (the server-only
> `public.app_sessions` table required when `SESSION_STORE=supabase`), and
> `0012_room_schedules.sql` (the server-only `public.room_schedules` table
> required by the room-scheduling runtime when `SCHEDULE_DATA_SOURCE=supabase`;
> owner-applied), plus `0013_vr_hotspot_schedule_metadata.sql` (nullable
> schedule-target metadata on VR hotspots for the legacy room-door fallback),
> plus `0020_room_schedule_documents.sql` (one current semester image record per
> room/facility and the direct `vr_hotspots.schedule_document_id` link).
> Migration `0020` is recorded as owner-applied for this implementation. Any
> future schema change requires separate owner operational authorization.
> Room schedules are real **admin-managed** room/facility data - not SIS,
> enrollment, or instructor-load simulation. Migrations `0014` through `0019`
> are also owner-applied and provide the verified campus route graph,
> `route_edges.path_geometry`, atomic forward/reverse admin geometry writes, and
> the authoritative Guard House topology, CAS baseline, and selected-demo
> parity.

The current expanded candidate is backend-specific: MySQL contains 34
buildings, 44 route nodes, 100 directed edges, 50 exact reverse pairs, and 100
valid geometries; Supabase contains 25 buildings, 26 route nodes, 50 directed
edges, 25 exact reverse pairs, and 50 valid geometries. The shared Guided-VR
catalog contains 25 active destinations, 472 configured steps, and 99 unique
scene keys. CampuSphere computes routes from its own campus graph and renders
owner-managed road geometry. Google Maps, Google Earth, Strava, SIS, and
external routing engines are not integrated. Guided VR reports arrival only
after stored natural-key endpoints, approved panorama media, and every exact
forward/reverse adjacent scene link verify; partial coverage fails closed.

---

## 4. MySQL fallback setup

The MySQL path is the local-development default and the fallback runtime; it also
backs the session store when `SESSION_STORE=mysql` (the production/demo preference
is `SESSION_STORE=supabase` — see §5).

```bash
node database/seed.js
```

The seed connects without a database first, creates `campusphere_db` from
`database/schema.sql`, runs idempotent migrations (including the Section 8.8
performance indexes via an `ensureIndex` helper), and seeds default content. It
is **idempotent and non-destructive** — safe to re-run.

**Strict mode** for deployment — fail hard if duplicate identity rows would block
a unique constraint (also implied when `NODE_ENV=production`):

```bash
SEED_STRICT_CONSTRAINTS=true node database/seed.js
```

**Default demo accounts** (created by the seed): the seed creates a
deterministic admin and sample-student fixture for **local MySQL development
only**. Their local-only values live in `database/seed.js` and the shared
test-only loader (`scripts/regressionCredentials.js`) and are intentionally no
longer recorded in documentation; they are not valid live credentials. The
live regression accounts (admin, student, instructor, guest) use private
owner-managed replacement passwords supplied to authorized probes only through
the test-only `SUPABASE_REGRESSION_*` variables in the ignored local `.env`
(see §1). Change or remove any seeded fixture before a non-demo deployment.

---

## 5. Production session setup

1. **Preferred:** `SESSION_STORE=supabase` (default in production). Set
   `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (server-only) and apply migration
   `0011_supabase_session_store.sql` so the `public.app_sessions` table exists;
   startup verifies the table and **fails closed** if it is missing/unreachable.
   **Fallback:** `SESSION_STORE=mysql` (provide `DB_*`; the store auto-creates its
   `app_sessions` table at startup). `SESSION_STORE=memory` is **rejected** in
   production, as is any unknown value.
2. `SESSION_SECRET` set, ≥32 chars, non-placeholder. Rotate by moving the old
   value into `SESSION_SECRET_PREVIOUS` and setting a new `SESSION_SECRET`; the
   current secret signs new cookies, previous values only verify old ones.
3. With `NODE_ENV=production` the cookie is named `__Host-campusphere.sid` and is
   `Secure` + `httpOnly` + `SameSite=Lax` + `Path=/` with **no `Domain`**. The
   `__Host-` prefix + `Secure` flag mean the app **must be served over HTTPS**.
4. Behind a reverse proxy / TLS terminator, set `TRUST_PROXY` to the number of
   proxy hops (default `1`) and ensure the proxy forwards
   `X-Forwarded-Proto=https`, or the Secure cookie will not be issued and login
   will silently fail.

The server **fails closed** in production on any missing/unsafe session value
(missing/short/placeholder secret, `SESSION_STORE=memory` or unknown store,
`SESSION_STORE=supabase` without a reachable Supabase / `app_sessions` table,
invalid max-age or trust-proxy) — it logs a fixed sanitized reason and exits
non-zero.

---

## 6. Security middleware & QA

- **CSRF + POST logout** (`middleware/csrfProtection.js`): synchronizer token in
  the session; unsafe requests require `X-CSRF-Token` or `_csrf`. Logout is
  **POST-only** (`GET /logout` → 405) and CSRF-protected; it emits an expiring
  Set-Cookie to drop the session cookie.
- **Rate limiting** (`middleware/rateLimit.js`): see the table in §1. Returns
  sanitized `429` + `Retry-After`.
- **Helmet / CSP** (`middleware/securityHeaders.js`): nonce-based CSP with no
  `unsafe-inline`/`unsafe-eval` for scripts; `upgradeInsecureRequests` is added
  in production. Inline `<script>`/`<style>` elements carry a per-request nonce.
- **PWA privacy boundaries** (`public/sw.js`): authenticated HTML is **never**
  cached; `/auth`, `/login`, `/register`, `/logout`, `/admin`(+`/admin/api/*`),
  and `/api/update-profile` are never intercepted/cached; navigations are
  network-only with an `/offline.html` fallback; only a session-neutral shell +
  approved JSON APIs + approved CDN hosts are cached, all capped.

**QA commands** (npm scripts):

```bash
npm run qa            # contracts + db-perf + supabase-smoke + identity + audit
npm test              # contracts + scheduling + routing/geometry/VR probes in both modes
npm run qa:contracts  # auth/authz/CSRF/rate-limit/404/CRUD/PWA/schedule probes + leak scan
npm run qa:db         # read-only MySQL EXPLAIN/index + Supabase index parity
npm run qa:smoke      # Supabase connectivity smoke (SKIPs cleanly if unconfigured)
npm run qa:identity   # R8 identity/profile uniqueness verifier (MySQL + Supabase)
npm run qa:audit      # npm audit --omit=dev
```

The contract gate boots the app with `SESSION_STORE=mysql` and (when Supabase is
configured) `SESSION_STORE=supabase`, so it verifies the **session-store runtime**,
not just the data-source switches. The Supabase portions SKIP cleanly when
`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are unset — but if
`SESSION_STORE=supabase` or any `*_DATA_SOURCE=supabase` runtime is selected
while the Supabase env or its required migration is unavailable (`0011` for
sessions, `0012` plus `0020` for the image-based room schedule flow), the QA gates and the DB-perf/smoke checks
**fail closed** instead of skipping.

Manual defense evidence and clean-demo notes are tracked separately:

- `docs/test-evidence.md` - black-box evidence checklist and screenshot rules.
- `docs/demo-script.md` - role-based walkthrough script for defense.
- `docs/security-checklist.md` - manual security review cases.
- `docs/usability-survey.md` - SUS-style and satisfaction survey templates.
- `docs/reset-demo.md` - reset/seed and evidence run notes.

---

## 7. OAuth redirect URI variants

The `GOOGLE_REDIRECT_URI` value **must exactly match** an Authorized redirect URI
configured for the OAuth client in Google Cloud Console (scheme, host, port, and
path). Register every environment you use:

| Environment | `GOOGLE_REDIRECT_URI` |
| --- | --- |
| Local `node server.js` / `npm start` | `http://localhost:3000/auth/callback` |
| Docker / Compose on the same machine (host-mapped `3000:3000`) | `http://localhost:3000/auth/callback` |
| Final hosted deployment (HTTPS) | `https://YOUR-DOMAIN/auth/callback` |

Notes:

- Google allows `http://localhost` for development but requires **HTTPS** for any
  non-localhost host.
- Inside a container the app listens on `0.0.0.0:3000`; the **browser** still hits
  the host-mapped `http://localhost:3000`, so the localhost redirect URI applies.
- A mismatch yields a Google `redirect_uri_mismatch` error (see §9).

---

## 8. Docker packaging

The image (`Dockerfile`) is `node:24-bookworm-slim`, installs production deps with
`npm ci --omit=dev`, copies **only** the named app folders (no `COPY . .`), runs
as the non-root `node` user, sets `NODE_ENV=production` + `PORT=3000`, exposes
`3000`, and runs `node server.js`. Secrets are provided at **runtime only**;
`.dockerignore` keeps `.env`, `node_modules`, `.git`, logs/caches, Playwright
folders, screenshots/images, PDFs/DOCX, and DB dumps out of the build context.
Use Node 22 or newer for non-Docker deployments; the Supabase runtime path
depends on native WebSocket support from modern Node.

**Build & run (Supabase-backed runtime, secrets via runtime env):**

```bash
docker build -t campusphere:m9 .

# Fully Supabase-backed production (preferred): Supabase data + Supabase sessions.
# Requires migrations 0011 and 0012 applied; no MySQL needed.
docker run --rm -p 3000:3000 \
  -e NODE_ENV=production \
  -e SESSION_STORE=supabase \
  -e SESSION_SECRET="<a-long-random-32+char-secret>" \
  -e AUTH_DATA_SOURCE=supabase -e CONTENT_DATA_SOURCE=supabase \
  -e BUILDING_DATA_SOURCE=supabase -e ROUTE_DATA_SOURCE=supabase \
  -e VR_DATA_SOURCE=supabase -e SCHEDULE_DATA_SOURCE=supabase \
  -e MAP_RENDERER=maplibre \
  -e SUPABASE_URL="<url>" -e SUPABASE_SERVICE_ROLE_KEY="<server-only-key>" \
  -e TRUST_PROXY=1 \
  campusphere:m9
```

> Production over HTTPS: `NODE_ENV=production` issues the Secure `__Host-` cookie,
> so terminate TLS in front of the container and forward
> `X-Forwarded-Proto=https` with `TRUST_PROXY` set (see §5). An env-only
> `.env` file can be passed with `--env-file ./prod.env` instead of repeating
> `-e` flags (the file stays on the host, never in the image).

Supabase is an **external** cloud service — there is no database in the image.
Docker also supports the **MySQL fallback**: set `SESSION_STORE=mysql` with `DB_*`
pointing at a reachable MySQL (and `*_DATA_SOURCE=mysql` for MySQL data), e.g. the
Compose rehearsal below. That is a fallback / local-rehearsal path, **not** the
production preference.

### Vercel demo / UAT (Milestone 9+)

Vercel is a **demo/UAT** target only — **not** the full production path (Docker
remains that, per `ROADMAP.md`). Because Vercel cannot rely on a local MySQL, the
demo must use the Supabase session store:

BE.6 and OFF.1 are complete and Codex GO. Technical Production baseline
`fea3b2e11c6331eddc1ee091b165427d8e0218d7` is accepted. The owner accepts the
2026-08-05 human pilot with zero reported findings; participant/Form evidence
remains external and the tested build's full source-commit identity was not
independently verified. Pilot review is complete for sequencing purposes.
Future `main` deployments still require explicit manual promotion. The pilot
must not be represented as a routing-only technical mode or as independent
current-build evidence. OFF.2-OFF.6 and D6 are complete and Codex GO; final
Milestone 12 disposition remains separately controlled. The selected 13-building demo
roster is not the complete campus; later admin edits and additions require
refreshed freeze evidence rather than being prohibited.

#### Pilot participation model (owner decision, M12.P1-R8)

The pilot is **facilitator-mediated**. Randomly selected participants are
guided through the application by a facilitator during a session. Participants
register through **Sign in with Google**, and the application derives the role
from the verified email domain:

| Email domain | Role assigned |
| --- | --- |
| `@my.cspc.edu.ph` | `student-cspc` |
| `@cspc.edu.ph` | `instructor` |
| `@gmail.com` | `guest` |

The Google OAuth client stays in **Testing** publishing status. CampuSphere
requests only the `openid`, `email` and `profile` scopes. Because those three
are covered by Google's documented **basic-identity exception**, participants do
**not** need to be registered individually before they can sign in, and no
per-participant OAuth roster is maintained.

Three consequences follow, and all three are deliberate:

1. **The OAuth publishing status is not an access-control boundary.** It governs
   which Google consent experience is shown, not who may reach the application.
2. **Local email/password registration remains open** and creates a `guest`
   account only. That guest-only restriction is enforced twice — in
   `controllers/authController.js` and again in the SQL boundary redefined by
   `database/supabase/0009_public_registration_trust_policy.sql` — so no
   institutional or admin role can ever be self-registered. Facilitators direct
   participants to the Google path; the local path is the documented fallback.
3. **Access control is the session/role layer**, not the sign-in provider. Every
   participant-reachable surface is behind `requireLogin`, and `/admin` is behind
   `requireRole('admin')` (`middleware/roleAuth.js`).

Do not change the scopes, credentials, callback URL, publishing status, or the
domain-to-role mapping as part of pilot preparation.

#### Automated pilot-rehearsal evidence safety contract

An automated production rehearsal uses **three user-scoped, isolated
Playwright MCP servers** (administrator, student, and guest), each with a
distinct absolute operating-system temporary output directory outside the
repository. Before any production navigation, each context must prove that it
has zero CampuSphere cookies and empty `localStorage` and `sessionStorage`.
Tabs in one shared browser context are not a substitute for this isolation.

Every interaction must start from a fresh accessibility snapshot and use a
semantic selector that is re-resolved immediately before the action. A stale
element reference must be discarded; it must never be retried or guessed in a
different context. `browser_evaluate` may be used only for a narrowly scoped,
non-mutating measurement and must not return `document.body`, `innerHTML`, all
inputs, hidden profile fields, cookies, storage, or personally identifiable
information (PII) such as a participant name, email, student ID, phone number,
or address. Console and network evidence records only origin and pathname; it
must strip query strings and fragments, including OAuth parameters.

The executor records `git status --porcelain` before and after the rehearsal
and stops if any repository artifact appears. Screenshots and transcripts must
remain in the three operating-system temporary output directories. The student
account must be a fresh `@my.cspc.edu.ph` identity whose resulting
`student-cspc` role is verified; an existing role-mismatched account is not a
valid substitute. Sparse CAS content is truthful frozen-dataset evidence and
must not be fabricated, filled, or edited for the rehearsal.

Cleanup uses only the supported administrator interface for the two uniquely
identified rehearsal accounts and the real logout interface for every opened
session. No direct SQL, broad cleanup, session-row deletion, migration, or
dataset mutation is permitted. An earlier automated rehearsal disclosed an
over-broad page evaluation, raw OAuth URL/query capture, temporary files that
resolved inside the repository, and one stale-reference misclick. Those are
procedure/evidence-handling deviations, not application findings, and this
contract prevents their recurrence without erasing the disclosure.

#### Bounded evidence re-execution (M12.P1-R8; candidate evidence)

A separately owner-authorized bounded evidence re-execution has been completed.
It gathered evidence only — no source edit, commit, SQL, migration, Vercel
operation, or OAuth configuration change was made — and it is candidate evidence
awaiting an independent read-only `M12.P1-R8` review.

- **Local authenticated exposure matrix, clean bounded re-execution.** MySQL
  `34/34` plus a `14/14` supplement, Supabase `64/64` plus a `14/14` supplement:
  `126/126` with zero failures. A separate fresh browser context per role, each
  proven to carry zero cookies and zero web storage before authentication. Every
  authenticated session was registered with `scripts/probeSessionLifecycle.js`
  immediately after login and terminated exactly once through `terminateAll()`
  and the real CSRF-protected `POST /logout`. No `429` occurred, no failed logout
  was retried, `services/sessionRevocation.js` was never imported or called, and
  no session row was deleted directly and no database cleanup was performed.
  Final ordered postconditions were `24/24 -> 18/18 -> 46/46`.
- **`SEC-05`, the unsupported-domain OAuth flow.** Executed externally and
  passed. The flow reached `accounts.google.com` requesting exactly `openid`,
  `email` and `profile`; the unsupported-domain Google account completed Google
  authorization and returned to CampuSphere; CampuSphere redirected to
  `/auth?error=unauthorized_domain` with a sanitized message that echoed no
  email address and no raw error. Supabase `users` held 6 rows before and 6 rows
  after with zero rows on unsupported domains, no user or role-profile row was
  created, and no pending OAuth registration persisted. No scope, credential,
  redirect URI, publishing status, or test-user configuration was changed.
- **Pilot feedback form.** Opened anonymously; the responder page rather than
  the editor UI; accepting responses; no email collection; 10/10 SUS-style
  statements, 8/8 satisfaction questions, and 4/4 open-feedback prompts present.
  Nothing was submitted and no response row was created. `READY` as external
  owner evidence; the responder URL stays outside Git.

The first execution of that exposure matrix is historical/superseded and is
explicitly **not** accepted evidence: rate-limit `429`s disturbed it and an
orphaned session was cleared by calling `revokeUserSessions` directly rather
than through the supported logout interface.

`SEC-51`, the Vercel production smoke, has been executed against
`https://campusphere-cspc.vercel.app` twice. SHAs are abbreviated throughout this
file deliberately — it is covered by the long-hex secret scan; the full values
are recorded in `docs/test-evidence.md`, `docs/security-checklist.md`, and the
independently pinned gate.

| Record | Baseline | Status |
| --- | --- | --- |
| First accepted production smoke (historical/superseded) | `78d9053` | Before the later baselines were deployed, this was externally executed and accepted |
| Detailed browser smoke (historical/superseded) | `d422b54` | Before `0627bf7`, this read-only smoke was independently completed and accepted |
| Anonymous production smoke (historical/superseded) | `0627bf7` | Before `fea3b2e`, anonymous smoke `31/31` passed; deployment identity was owner-observed |
| **Current technical Production baseline** | **Git commit SHA-1 `fea3b2e11c6331eddc1ee091b165427d8e0218d7`** | **Ready/Current source commit confirmed in owner-observed Vercel evidence; bounded anonymous read-only GET-only post-deployment verification passed** |

The current bounded post-deployment verification established that the exact
production hostname serves deployed technical Production baseline
`fea3b2e11c6331eddc1ee091b165427d8e0218d7`. Anonymous GET-only checks covered
public pages, static assets, sampled byte identity, anonymous protected-route
denial, and zero checked `Set-Cookie` responses. It deliberately avoided
`/auth`, did not authenticate, and did not exercise schedule auditing.
Historical/superseded: before this deployment, anonymous smoke `31/31` ran on
technical Production baseline `0627bf78228148e3f989275810c333c16a1f3356`; the
earlier detailed browser smoke ran on technical Production baseline
`d422b54393f659125912ec5c84ae7927c2533288`.

The three pilot-surface corrections — landing role-mapping copy, the shared
accessible anonymous navbar, and the auth-scoped in-card theme control — remain
present in deployed technical Production baseline
`fea3b2e11c6331eddc1ee091b165427d8e0218d7`. Historical/superseded: before
`fea3b2e`, they were deployed on technical Production baseline
`0627bf78228148e3f989275810c333c16a1f3356`; their detailed independent browser
acceptance originally ran against technical Production baseline
`d422b54393f659125912ec5c84ae7927c2533288`.

The smoke was **read-only**: no authenticated production login was performed, so
the M12.P1-R2 and M12.P1-R3 session-store and bootstrap evidence stands
unchanged and is not restated as new. The correction changed no session-store or
bootstrap implementation.

Historical/superseded: the preceding SEC-51 evidence synchronization was Git
commit SHA-1 `bbb25d0dee5917e4704da35784421c840f825afb`; the Guided-VR runtime/catalog
remediation was commit `43627cf`. Previously, before `fea3b2e`, Production
served technical Production baseline `0627bf78228148e3f989275810c333c16a1f3356`.
Production now serves accepted technical Production baseline
`fea3b2e11c6331eddc1ee091b165427d8e0218d7`. This acceptance is not a pilot GO,
offline-work authorization, or
Milestone 12 GO. `Auto-assign Custom Production Domains` is disabled, and no
new staged deployment may be promoted without a separate owner decision.

#### Pilot indexing protection (M12.P1-R8)

The pilot runs on a public production hostname. Vercel applies an automatic
`noindex` to **preview** deployments only, so a production deployment is
crawlable unless the application says otherwise. Two voluntary directives are
therefore shipped:

- `middleware/securityHeaders.js` exports `pilotNoIndex`, mounted in `server.js`
  beside the security headers, which sets exactly
  `X-Robots-Tag: noindex, nofollow, noarchive` on **every** response — the
  anonymous `/`, `/auth` and `/privacy` pages, authenticated HTML, JSON APIs,
  the readiness `503`, rate-limit `429`s, and error pages.
- `public/robots.txt` contains exactly `User-agent: *` and `Disallow: /`.

**Indexing control is not access control.** Both are requests that well-behaved
crawlers honour. They reduce incidental search-engine discovery of the pilot.
They do not authenticate, authorize, rate-limit, or block anybody, and a crawler
or person that ignores them is stopped only by the session/role controls above.

#### Participant privacy notice (M12.P1-R8)

`GET /privacy` renders `views/privacy.ejs` and is deliberately **anonymous**: a
prospective participant must be able to read it before an account exists. It
touches no session and performs no database access. It is linked from the
anonymous footer, the sign-in/registration page, and the OAuth
complete-registration step — the screen that actually collects the
role-specific profile fields.

The notice states what is collected (identity, role/profile, authentication,
session, and security/audit data), why, and which services handle it (Vercel,
Supabase, Upstash, Google, Cloudinary). It records the exact requested Google
scopes, states that pilot feedback goes to a separate owner-created Google Form
that CampuSphere never receives or stores, describes retention as **30 days past
the final defense followed by owner-managed manual deletion unless CSPC requires
longer**, sets out data-subject rights under RA 10173, and links the official
CSPC policy at <https://cspc.edu.ph/governance/privacy-policy/>.

It deliberately makes **no** consent, legal-basis, automatic-deletion, or
data-sharing claim; the `pilot-readiness` gate rejects the notice if any of those
appear.

#### Required Vercel Project environment variables (complete checklist)

Every value below is a **server-only** Vercel Project Settings → Environment
Variables entry. None may appear in client code, an EJS template, `public/`, a
browser global, a response body, a log, a screenshot, or a commit. Never use a
public/`NEXT_PUBLIC_`-style name for any of them.

**(A) The 14 fail-closed production-profile entries.** `config/vercelProductionProfile.js`
requires **all fourteen** when `VERCEL=1`. A missing, blank, misspelled, or
conflicting value produces one fixed sanitized refusal and a nonzero exit — the
app will not serve, and it can never fall back to MySQL, Leaflet, or memory
sessions. All fourteen are mandatory; there is no partial mode:

| # | Variable | Required value / shape |
| --- | --- | --- |
| 1 | `NODE_ENV` | exactly `production` |
| 2 | `SESSION_STORE` | exactly `supabase` |
| 3 | `AUTH_DATA_SOURCE` | exactly `supabase` |
| 4 | `CONTENT_DATA_SOURCE` | exactly `supabase` |
| 5 | `BUILDING_DATA_SOURCE` | exactly `supabase` |
| 6 | `ROUTE_DATA_SOURCE` | exactly `supabase` |
| 7 | `VR_DATA_SOURCE` | exactly `supabase` |
| 8 | `SCHEDULE_DATA_SOURCE` | exactly `supabase` |
| 9 | `MAP_RENDERER` | exactly `maplibre` |
| 10 | `SUPABASE_URL` | HTTPS URL with a hostname, no embedded URL username/password |
| 11 | `SUPABASE_SERVICE_ROLE_KEY` | server-only secret: `sb_secret_…` or a legacy HS256 `role=service_role` JWT |
| 12 | `UPSTASH_REDIS_REST_URL` | HTTPS URL with a hostname, no embedded URL username/password |
| 13 | `UPSTASH_REDIS_REST_TOKEN` | nonblank server-only REST token, never a documented placeholder |
| 14 | `RATE_LIMIT_KEY_SECRET` | server-only HMAC key, **at least 32 characters**, never a documented placeholder |

**(B) Separately required — not part of the 14-entry preflight.** These are
validated elsewhere (or only when the feature is used), so the preflight passing
does **not** mean they are set:

- `SESSION_SECRET` — required in production by `config/sessionConfig.js`, which
  refuses to start on a missing, placeholder, or under-length value. Optional
  `SESSION_SECRET_PREVIOUS` values must clear the same bar.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` — the Google
  OAuth trio. If the ID or secret is absent, `/auth/google` is silently disabled
  and redirects to `/auth?error=oauth_failed`.

**(C) Required external owner evidence.** These are not repository values and
cannot be produced by any agent:

- The **exact HTTPS `/auth/callback` redirect URI** for the deployed hostname —
  e.g. `https://<project>.vercel.app/auth/callback` — set as `GOOGLE_REDIRECT_URI`
  **and** registered as an Authorized redirect URI in the Google Cloud console.
  It must be `https://`, must match byte-for-byte on both sides, and each Vercel
  preview hostname needs its own registered URI.
- The **owner-created Google Form feedback URL**, to be handed to facilitators.
  CampuSphere adds no feedback table, API mutation, or migration.

Also apply migration `0011_supabase_session_store.sql` to the Supabase project
before the first deploy. Migrations `0001` through `0019` are recorded as
owner-applied; `0020_room_schedule_documents.sql` must be separately authorized,
applied, and verified before deploying the semester-image schedule flow.

#### Fail-closed Vercel production profile (M12.P1-R2)

When the platform-provided `VERCEL=1` indicator is present, `server.js` runs a
**pure synchronous preflight** (`config/vercelProductionProfile.js`) against
the **platform-injected `process.env` before dotenv runs** — so an
accidentally packaged repository `.env` can never backfill a missing or
misspelled Vercel Project variable — and **before** any backend client,
session configuration/store, middleware, controller, or route is imported.
dotenv loads quietly only after the preflight succeeds (or no-ops outside
Vercel). The preflight requires **exactly** this matrix:

```
NODE_ENV=production
SESSION_STORE=supabase
AUTH_DATA_SOURCE=supabase
CONTENT_DATA_SOURCE=supabase
BUILDING_DATA_SOURCE=supabase
ROUTE_DATA_SOURCE=supabase
VR_DATA_SOURCE=supabase
SCHEDULE_DATA_SOURCE=supabase
MAP_RENDERER=maplibre
SUPABASE_URL=<https URL with a hostname; no embedded URL username/password>
SUPABASE_SERVICE_ROLE_KEY=<nonblank SERVER-ONLY Supabase secret>
UPSTASH_REDIS_REST_URL=<https URL with a hostname; no embedded URL username/password>
UPSTASH_REDIS_REST_TOKEN=<nonblank SERVER-ONLY Upstash REST token>
RATE_LIMIT_KEY_SECRET=<server-only HMAC key, at least 32 characters>
```

The last three are the M12.P1-R4 shared rate-limit store (see *Shared
rate-limit store* above). They are required on Vercel only, are validated with
the same fixed sanitized refusal, and are never required for local development.

Any missing, blank, misspelled, or conflicting value makes startup print one
fixed sanitized refusal and exit nonzero — the offending setting name and the
supplied value are never echoed, and Vercel can never fall back to MySQL,
Leaflet, or memory sessions. Exactly two server-only key **shapes** are
accepted: an opaque secret key (`sb_secret_` + at least 20 characters from
`[A-Za-z0-9_-]`) or a legacy three-segment JWT whose decoded header has `alg`
exactly `HS256` and whose decoded payload has `role` exactly `service_role`
(shape-only structural decoding — no signature verification, network call, or
claim logging). Documented placeholders, browser/publishable keys
(`sb_publishable_…`, `sb_anon_…`, case-insensitive), generic or short strings,
malformed JWTs, and anon/authenticated-role JWTs are all rejected.
All secrets remain **server-only** Vercel environment variables (never client
code or `NEXT_PUBLIC_`-style names). The preflight validates configuration
shape only and performs **no network request**: live Supabase connectivity
and session-store readiness are verified separately at startup/bootstrap.
Outside Vercel the preflight is a no-op and the documented MySQL/Leaflet
local-development fallbacks are unchanged
(`scripts/vercelProductionProfile-probe.js` is the focused database-free
gate).

#### Awaited runtime and session bootstrap (M12.P1-R3)

> **Session hygiene and ownership follow-ups (complete; Codex GO).** Session
> regeneration discards the anonymous CSRF token, so
> `establishAuthenticatedSession` mints the replacement via `ensureCsrfToken`
> BEFORE the explicit save — the persisted authenticated session already
> carries the token the first rendered page shows, which is what makes an
> immediately submitted HTML logout form valid under the Supabase session
> store. For test tooling, `scripts/with-server.js` resolves the child
> `SESSION_STORE` from the normalized data mode when `sessionStore` is omitted
> and fails closed on a blank/invalid explicit value, so an ambient value can
> never leak into a probe leg. The ownership gate's import detector uses a
> lexical-state line scanner rather than global comment stripping; a
> backslash-continued newline (LF or CRLF) now advances the physical-line
> accounting by exactly one, so a declaration inside a continued string value is
> rejected and a real import on a later line is still found. Accepted Codex GO
> evidence: full suite `2921/2921` with `QUALITY-GATES OK`,
> in-suite
> resolver `14/14` and residue `18/18`, standalone R1 `24/24`, R2 `88/88`,
> R3 `86/86`, BE.6 `46/46`.

> **Status: R3, R4, R5, both R5 follow-ups, dependency-security remediation,
> `M12.P1-R6`, `M12.P1-R7`, and expanded D7 are complete; Codex GO.** None of
> these results authorizes deployment or pilot readiness; M12.P1 remains NO-GO
> and deployment requires a later R8 GO plus a separate owner decision.

The preflight above validates *configuration*. Session-store *readiness* is a
separate boundary, coordinated by `services/sessionReadiness.js`.

`server.js` resolves the session policy, constructs **at most one** store, and
creates **one** readiness coordinator before mounting any middleware.
Constructing that coordinator starts exactly one eager `init()` attempt. The
same promise instance is then used by both entry paths:

- **Local / Docker (`node server.js`, `npm start`)** — `start()` awaits the
  readiness promise and only then calls `app.listen()`. A failed bootstrap
  prints the fixed sanitized line
  `[startup] Session store initialization failed. Refusing to start.` exactly
  once and exits nonzero **without opening a listener**. `start()` runs only
  under `require.main === module`.
- **Vercel / any importer** — `module.exports = app` means the platform
  imports the app and dispatches requests into it; `app.listen()` is never
  called, so there is no startup await on that path. Importing the module
  therefore binds no port. Readiness is instead enforced per request by a gate
  mounted immediately after the security headers and **before** rate limiting,
  the body parsers, static serving, `express-session`, the authenticated
  no-store middleware, CSRF, the logger, the routes, and the error handlers.

Gate behaviour, by readiness state:

| State | Behaviour |
| --- | --- |
| pending | The request is **held** — neither forwarded nor answered — until the single in-flight attempt settles. |
| ready | The request proceeds exactly once. |
| failed | The request receives `503` with `Cache-Control: no-store` and exactly `{"success":false,"message":"Service temporarily unavailable."}` |

Because one shared promise backs everything, concurrent first requests on a
cold Vercel instance cannot produce a second initialization, a second store, a
duplicate cleanup timer, or a duplicate listener. There is **no retry, no
timeout, and no fallback store**: once the attempt fails the instance stays
failed, and recovery is a redeploy/restart concern rather than a per-request
one. The gate logs nothing per request and never inspects the initialization
error, so a backend host, key, or stack cannot reach a response body or the
process output through this path. It responds directly rather than calling
`next(err)`, because the error-rendering middleware sits below it in the chain
and a partially-wired application is exactly what the gate prevents.

`scripts/vercelRuntimeSessionBootstrap-probe.js` is the focused database-free
gate for this behaviour (fake stores, mocked responses, static wiring
assertions, and two controlled subprocesses). It is intentionally **not**
registered inside `npm test` yet.

### Compose rehearsal (local, MySQL fallback)

`docker-compose.testing.yml` pairs the app with a MySQL service for **local
rehearsal only** (plain HTTP on `localhost`, so it defaults to
`NODE_ENV=development` and a non-Secure cookie; it still exercises
`SESSION_STORE=mysql`). The default `docker-compose.yml` is reserved for the
one-container ICTU production deployment backed by external Supabase. Secrets
come from your shell/`.env` via interpolation; required values use
`${VAR:?...}`.

```bash
# 1. Provide secrets (shell or untracked .env): DB_PASS, SESSION_SECRET (+ optional Supabase/OAuth).
# 2. Start MySQL + app:
docker compose -f docker-compose.testing.yml up --build
# 3. Seed ONCE (not auto-run on app startup):
docker compose -f docker-compose.testing.yml run --rm app node database/seed.js
# 4. Validate the compose file without starting it:
docker compose -f docker-compose.testing.yml config
```

`DB_HOST` is set to the compose service name `mysql` — **not** `localhost` —
because inside the app container `localhost` is the container itself.

---

## 9. Troubleshooting

| Symptom | Cause & fix |
| --- | --- |
| Server exits at startup: "SESSION_SECRET is required / must be ≥32 chars / must not be a placeholder" | Production requires a strong `SESSION_SECRET`. Set a 32+ char random value (and apply the same bar to every `SESSION_SECRET_PREVIOUS`). |
| Server exits: "SESSION_STORE=memory is not allowed in production" | Use `SESSION_STORE=supabase` (preferred - set `SUPABASE_*` and apply migration `0011`) or `SESSION_STORE=mysql` (fallback - provide `DB_*`). For full Supabase data mode, also apply `0012_room_schedules.sql`, `0013_vr_hotspot_schedule_metadata.sql`, and `0020_room_schedule_documents.sql`. Memory store is dev-only. |
| Login appears to succeed but you are immediately logged out (prod) | The Secure `__Host-` cookie was not sent: you are serving over HTTP, or the proxy isn't forwarding `X-Forwarded-Proto=https`. Terminate TLS and set `TRUST_PROXY` (§5). Or, for a non-HTTPS rehearsal, run with `NODE_ENV` unset/development. |
| `/auth/google` redirects to `/auth?error=oauth_failed` | `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` missing. OAuth is optional; local login still works. |
| Google `redirect_uri_mismatch` | `GOOGLE_REDIRECT_URI` doesn't exactly match an Authorized redirect URI in Google Cloud. Register the exact scheme/host/port/path (§7). |
| App can't reach MySQL in Docker (`ECONNREFUSED`/timeout) | `DB_HOST` points at `localhost` inside the container. In Compose use `DB_HOST=mysql` (the service name); standalone, point it at the reachable host. |
| Supabase mode errors / smoke FAIL | `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` unset or wrong, or migrations not applied. Apply authorized migrations through `0020` in order; `0011` is required for Supabase sessions, `0012`-`0013` for the legacy schedule fallback, `0014`-`0019` for road-following routing/CAS/admin geometry, and `0020` for semester schedule images/direct VR links. Verify with `npm run qa:smoke` and the focused probes. |
| `npm run qa:db` fails on a missing index or route-geometry count | After authorization, apply the Supabase migrations through `0020` (§3) and run `node database/seed.js` for MySQL. Re-measure the selected backend rather than assuming parity: the current candidate freezes MySQL at 44 nodes / 100 edges / 50 reverse pairs / 100 geometries and Supabase at 26 / 50 / 25 / 50. |
| `npm test` / `npm run qa` fails | Ensure MySQL is running and seeded; Supabase portions SKIP cleanly only when no Supabase runtime is selected. Selected Supabase runtimes fail closed when credentials or required migrations are missing. Re-run the named focused probe or gate for detail. |

---

## 10. Hosting options

The container starts the app from a clean checkout with runtime env only — no
secrets baked in. Targets per `ROADMAP.md`:

- **Docker** — the full deployment / institutional production-style path (HTTPS via
  a local TLS proxy for the production cookie). Defaults to Supabase data +
  `SESSION_STORE=supabase`; MySQL is the fallback / local-rehearsal path.
- **Vercel** — demo/UAT only (see §8). Uses Supabase sessions because it cannot
  rely on local MySQL.
- A Render/Railway-style Node host also works (set the env vars in the platform
  dashboard).

Supabase remains the external managed Postgres — data **and** the preferred session
store (via migration `0011`); MySQL is the fallback session/data store. Pick the
final target per `ROADMAP.md`.
