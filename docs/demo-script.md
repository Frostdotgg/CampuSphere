# CampuSphere Defense Demo Script

Milestone 8, Section 8.10. This script is for a controlled defense/demo using
seeded data. Do not use real secrets or private production data on screen.

<!-- M12 RELEASE CONTINUITY START -->
## Current Release Continuity (2026-09-05)

At the start of this owner-authorized closeout, Git branch `main` had local
`HEAD`, `origin/main`, and remote `main` all at Git commit SHA-1
`ecc97930e42688dab6646bdf3fc9733a58d0c095` (`ecc9793`). The index was
empty, 65 tracked paths were modified, nine paths were untracked, and there
were zero stashes. The owner authorized preserving and closing that exact
profile-image, five-minute-presence, and campus-UI work; synchronizing current
authority and new-session prompts; creating the four planned logical commits
plus one audit-driven dependency-security commit; and pushing
`main`. This authorization did not include Vercel or ICTU deployment,
promotion, Production smoke, or database/content mutation. The accidental
text-encoding damage in the pending authority/probe files was repaired before
commit. After the fresh audit exposed newly published `mysql2` and `qs`
advisories, `package-lock.json` was intentionally refreshed within the existing
semver ranges; `package.json` constraints were unchanged. Codex did not
inspect or record `.env` contents.

The current product lineage created by this closeout is:

- Dashboard Google-image repair Git commit SHA-1
  `fdb0c8c23f96214dfb19219ea282230eedcc3ee0` (`fdb0c8c`).
- Five-minute presence Git commit SHA-1
  `621d72ead6df26bcdfb8d9c143fff871f3996456` (`621d72e`).
- Campus UI refinement Git commit SHA-1
  `b8e7ffbb2150f916829b98fd22595f40ae54ca89` (`b8e7ffb`).
- Runtime dependency security Git commit SHA-1
  `a5a6ceec1779bf110639c3038e72f47db1e7c82a` (`a5a6cee`).
- The authority synchronization commit containing this block and the current
  grounding prompts is the live `HEAD` after delivery. A new session must
  recompute its full SHA rather than trust a self-referential value in this
  commit.

The Dashboard Personal Info card now receives the same validated Google
profile-image URL/source as the authenticated navbar and Edit Profile modal,
uses a no-referrer image request, and retains a safe SVG fallback. No profile
API, schema, session revocation, or data backfill is involved.

Five-minute presence is now source-complete for all authenticated roles.
Visible authenticated pages send a CSRF-protected heartbeat on load/resume and
at 60-second intervals; hidden/closed pages stop. The database atomically
limits timestamp writes to at most one per user per 60 seconds. Administrators
receive one batched, reduced Online/Offline/Last seen snapshot every 30 seconds
while the Users page is visible. Missing timestamps mean Offline/Never, Online
is inclusive at server time minus 300 seconds, login remains available if the
advisory presence store fails, and no IP, device, session id, activity history,
or client timestamp is stored. Presence never changes `users.updated_at`.

The current UI refinements restore visible light/dark action surfaces for
building View Details/View Routes and the campus-map Download/Update Offline
Map action; advance the shared stylesheet key to `v11` and service worker to
`v39`; label the guest dashboard map as `2D and 360 View`; add a local,
keyboard-safe Destination Building filter to admin route add/edit; show
`360° scenes captured on May 28, 2026.` on Free Roam and Guided VR pages; and
replace the misleading building label `Floor Plan` with `Floors & Rooms`
and `Rooms & Facilities`. The destination search is an in-memory linear
filter over the already embedded building list and performs no request per
keystroke.

Supabase migrations `0020_room_schedule_documents.sql`,
`0021_minimal_instructor_oauth_registration.sql`, and
`0022_user_presence.sql` are owner-applied. Codex did not apply them and must
not reapply them without new explicit database authorization. Read-only 0022
postflight confirmed the presence table, primary/cascading foreign key,
last-seen index, RLS, fixed function search path, `SECURITY INVOKER`, revoked
browser-role access, and `service_role` execution. The matching additive
MySQL presence table is applied locally. No user/account/profile/campus record
was backfilled or altered to obtain verification.

The selected data/route freeze remains the owner-approved 2026-09-02 freeze.
MySQL remains at 34 buildings, 44 route nodes, 100 directed edges, 50 exact
reverse pairs, 100 valid geometries, 671 scenes, 1,397 hotspots, and one
selected schedule hotspot. Supabase remains at 25 buildings, 26 route nodes,
50 directed edges, 25 exact reverse pairs, 50 valid geometries, 664 scenes,
1,374 hotspots, and zero selected schedule hotspots. Both backends retain 25
active Guided-VR destinations, 472 configured steps, and 99 unique scene keys.
The MySQL building/route SHA-256
`0dbb4c4ca38b375393c7ae2c842e1f799d429feda11d17cb29cee6ff0c2564ff`;
the Supabase building/route SHA-256
`36cbf55cbdd8b88415f939cf8f9d818744b3154770b8ddf31b9c0b8df1785688`;
the selected VR SHA-256
`1ec674e497cbe8fd36234368f9c0a679c05bd68c8002c3f9724e7b3f0de0810c`;
the shared Guided-VR catalog SHA-256
`ed02ec95d5c642cd082f48c0b3c5b98d0707ffd5866f8f90b196793ecfe963d6`;
and the freeze-manifest SHA-256
`85b999ee54625997ad55908ea478ee462b8d6470bb97f67c76fa17b97187298c`.
Never change these facts merely to make a gate green.

The required Security -> Performance -> Correctness -> Maintainability ->
Testing review found no open blocker. Presence is session-bound, parameterized
on MySQL, service-role-only on Supabase, atomically throttled, index-supported,
batched without N+1 reads, and sanitized on failure. Focused evidence includes
Google profile image `27/27`, presence `34/34`, shared button/theme
`19/19`, BE.6 `46/46`, ICTU Docker `49/49`, and package boundary
`74/74`. The fresh full source suite passed `4809/4809` with zero failures
and `QUALITY-GATES OK`; all five `npm run qa` stages passed with
`QUALITY-GATES OK`, `DB-PERF-GATE OK`, `[supabase-smoke] PASS`,
`IDENTITY-CONSTRAINTS OK`, and zero audit vulnerabilities. Final canonical
session residue passed `18/18`, and `git diff --check` passed. These are
source/local evidence, not Production evidence.

The rebuilt local Supabase Docker testing application returned HTTP 200 from
`/healthz`, ran as non-root uid 1000, and its image contained no `.env`, Git
metadata, database dump, or deployment documentation. The time-scoped
administrator Chrome check observed 138 total users, one Online and 137 Offline
while the administrator page was visible; Online/Offline filters, Last seen,
30-second polling, mobile/desktop layout, and light/dark mode worked without
console errors. The authenticated UI checks also covered the synchronized
Google image and current UI wording/actions. The administrator session used for
verification was ended through the normal application Logout before the final
residue gate. Counts are observational and may change; no account email belongs
in authority evidence.

The current Vercel source package is 196 files and 7,267,536 bytes with
aggregate SHA-256
`cd4c9b700b744cd0c02f971e0f413cb4362d769a70cac3293c952b4a4bbfe768`.
Authority documents and scripts are outside that allowlisted package. No
post-push Vercel deployment, Ready state, promotion, Production smoke, or
immutable deployed-byte identity was inspected or established. Technical
Production baseline `fea3b2e11c6331eddc1ee091b165427d8e0218d7` remains the
last independently post-deployment-verified baseline. There is still no real
CSPC instructor Gmail end-to-end OAuth observation. Source, localhost,
owner-observed vendor state, Production, and independent evidence must remain
separate.

A fresh Codex or Claude Code session must use the current copy-paste prompt in
`docs/new-session-grounding-prompts.md`: inventory available tools/MCP/skills,
read current authority and the named implementation surfaces, recompute live
Git truth using read-only commands, report discrepancies and the unverified
Vercel boundary, then stop and wait. Grounding authorizes no review, test,
edit, database/session/browser/vendor action, Git mutation, deployment,
promotion, Production smoke, or GO/NO-GO. The recommended next separately
authorized action is an independent read-only review of the exact pushed
commit; any feature, deployment, or milestone decision remains owner-controlled.

## Historical Release Continuity (2026-09-02; superseded)

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
