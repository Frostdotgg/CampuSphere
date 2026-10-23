# Campus-wide Events — controlled release, October 23, 2026

## Release status and authority

Release status: preparing staged Production verification. No new deployment
has been promoted by this release at this checkpoint.

The owner authorized review, focused tests, normal commit/push, staged
Production builds and manual promotion to https://campusphere-cspc.vercel.app.
Continue from `codex/campus-wide-events`, baseline
`da29b4fdc995f33c103e6bdda288565a3f9c6756`. Earlier local-only instructions are
implementation history, superseded for this explicit release task.

Use only the five existing owner-provided accounts. Normal sign-in/logout
session activity is permitted; account creation, password/role/department
changes and session-row inspection are excluded. Credentials, private content
snapshots, generated SQL and screenshots stay outside Git.

Online content writes are limited to one uniquely labelled, future-dated
Academic event with Administrator-only audience. Record its exact ID outside
Git, reuse it across both editors and staged/live verification, then remove
only that event through the application and retain its audit history.
Existing-post deletion, migrations, shared cleanup, schedule cleanup and ICTU
deployment remain excluded. Maintenance policy v2 is preparation-only; all
earlier generated deletion plans are obsolete and require fresh preparation
and owner review under separate cleanup authorization.

## Frozen product and package

Events support Campus-wide first, then the seven departments, with All
departments retained as a filter. The stored/API code is `university-wide`;
the literal `campus-wide` is rejected. Existing events display/edit as
Campus-wide without a read-triggered rewrite. Main Administrators explicitly
select a department; Department Administrators retain their assigned default.
Switching a Campus-wide Events filter to News resets it to All departments.
News and account assignments retain only seven departments. Facilities stays
removed from content choices; building Facilities is unchanged. Audience,
draft privacy, department-only access, CSRF and session policies remain.

Source cache v56; stylesheet v13; downloaded-guide format unchanged. No schema
migration or saved-record rewrite is needed; migration 0029 remains unchanged.
Canonical staged-Git runtime package: 205 files / 8,611,691 bytes, SHA-256
`12fb08e21976a482a0a52a61ea4495287e1d50724fa7c3366f27ba52477a5eb6`.
Only ten runtime paths differ from the published baseline. Dependencies,
authentication/session implementation and database sources are unchanged.

## Preflight and required checks

Fresh fetch found local HEAD, origin/main and GitHub main at `da29b4f`.
Vercel still serves Ready / Production / Current deployment
`dpl_G7Po4YVSvuAzp2Z9zgRWTfcT5NVc`, source `da29b4f`. Production tracks main;
automatic Production domain assignment is disabled. Protection and secrets
remain unchanged. GitHub has no rulesets or classic branch-protection rules
requiring a pull request; use normal fast-forward pushes without force.

Rollback must be rechecked before each promotion. The Hobby plan restricts
Instant Rollback to the immediately previous Production deployment. Preserve
the recorded baseline and prepare a Ready/Staged rebuild if needed as the
manual-promotion fallback. An older promoted deployment is not assumed to
remain eligible after a documentation successor becomes Current.

Fresh isolated checks passed: content/access/privacy 1,137/1,137; editor DOM
32/32; PostgreSQL/MySQL cleanup/restore 35/35; session bootstrap/resilience/
lifetime 160/160, 73/73, 72/72; startup 116/116; rate limits 180/180;
notifications 26/26; audiences 13/13; offline 49/49; PWA 148/148; Walking
118/118; scheduling retirement 401/401; analytics 113/113; login timing 8/8;
package boundary 76/76. Documentation was 896/896 before release assertions;
record its actual fresh total after this note is validated. Canonical complete
source uses locked dependencies, blocked environment loading and external
networking, fake providers and loopback-only HTTP. SQL ran only in disposable,
owned, network-disabled databases. No shared cleanup ran.

The real v55/v56 service workers passed isolated upgrade and reverse-activation
cache pruning (6/6), preserving unrelated caches. This models worker activation;
it does not claim an actual Vercel rollback or physical-device acceptance.
Docker rebuilt; the in-app browser confirmed original-tab sign-in, read-only
event choices/defaults, absent Facilities, filter reset, empty results, keyboard
navigation and 390 px layout, then signed out the owned session. The first
health request arrived during startup; later health is checked separately.

## Staged/live acceptance and closing record

Before promotion, verify the exact source and Ready/Staged state with existing
Production settings. Use the corrected original-tab navigation observer and
30-second deadline. A missing action/submission is inconclusive; do not count
it as a pass or resubmit automatically. Prefer the working in-app browser;
the separate Chrome missed-click investigation is not claimed fixed.

Require both editor roles, cross-department save/reload, existing-event labels,
News separation, participant response privacy for Guest/Instructor/Student,
and representative map/Walking/Vehicle/VR checks. Capture read-only original
content snapshots outside Git. Observe expanded logs at all levels throughout
testing and for ten minutes after staged checks, and after each live promotion.
Record interruptions and natural retry outcomes without manufacturing failures.

Keep an existing or freshly downloaded v55 guide on the normal domain before
promotion. Verify compatibility after v56 activation, then a fresh download and
disconnected reload. If temporary-host protection blocks basemap downloading,
perform that check immediately after promotion; do not weaken protection.

After live checks, delete only the tracked test event, verify its absence and
audit retention, and compare every original content row with the baseline.
Report concurrent owner edits separately; never restore them automatically.
Release findings and actual source/deployment identities will replace this
pending section in the documentation successor. Prove identical runtime bytes,
stage/promote that successor and repeat final smoke and a ten-minute watch.
Final self-referential identities belong in the external receipt.

Rollback for blocking authentication, access/privacy failure, broken content,
routing/offline regressions or attributable server errors. Restore service and
verify normal cache recovery; preserve all original data and audit history.
An isolated retry warning is not itself proof of failed refresh. Preserve
paired outcomes, warning counts and finite monitoring limitations.

No full npm test/QA pass, live MySQL parity, exhaustive campus traversal,
physical-device acceptance, complete immutable deployed-byte equality or
permanent provider availability is claimed. The published result must end with
clean local main, GitHub main and deployed source matching.

Sanitized evidence and private snapshots are outside Git under
`C:/Users/FROST.GG/.codex/backups/release-campus-wide-events-20261023/`.
