# Campus-wide Events — controlled release, October 23, 2026

## Release status and authority

Release status: product verified on the normal website. Product source
`509518f9fbbbd89edc49e98feb3582e635135c0f`, deployment
`dpl_HzhVWaEXzmDkdAWFTQrqWfykZxda`, was verified Ready / Production / Current
at https://campusphere-cspc.vercel.app after staged acceptance. These are dated
product observations. The documentation successor retains identical runtime;
its final SHA, deployment and closing watch belong in the external receipt.

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
package boundary 76/76. Documentation passed 919/919 at product freeze, after
the earlier local 896/896 result. The documentation successor passed isolated
documentation 942/942 and package boundary 76/76; its actual final validation
receipt remains outside Git. Canonical complete
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
it as a pass or resubmit automatically. The owner selected signed-in Chrome.
Fresh Chrome tabs completed the checks; the separate Chrome missed-click
investigation is not claimed fixed.

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
Prove identical runtime bytes, stage/promote the documentation successor and
repeat final smoke and a ten-minute watch. Final self-referential identities
belong in the external receipt.

### Verified product results

- Five existing roles passed staged and live sign-in/access checks. Main
  Administrator reached Operations Command Center with full navigation;
  Department Administrator reached only News & Events with default CCS.
  Unrelated department pages/APIs were denied. Main Administrator's event
  department remained an explicit selection. No accounts or credentials changed.
- Temporary event 26 alone was created, edited across CAS and Campus-wide,
  reloaded and deleted through the application. It stayed Academic and
  Administrator-only. Guest, Instructor and Student server-delivered event
  JSON excluded that event; their editor requests were denied. Public legacy
  Campus-wide labels, combined filtering and Events-to-News filter reset passed.
  Existing event editing was opened without saving. News still excludes
  Campus-wide, Event/Events and Facilities choices. Event categories remain
  Academic, Sports and Cultural. Long department names and keyboard navigation
  passed at a 390 px viewport.
- SELECT-only comparison preserved all original 9 articles and 12 events,
  byte-for-byte at row-JSON level (5/5 checks). No unrelated additions remained.
  Test-event audit checks passed 3/3, retaining six create/update/delete records.
  The first external audit checker incorrectly looked for actions in event_type;
  source review corrected it to action, and the initial failed evidence remains.
  This was a checker mistake, not a missing audit or database repair.
- Public live smoke passed 22/22, including three health checks, authentication
  boundaries, retired schedule assets/APIs and seven exact committed asset
  matches. Online Vehicle and Walking routes to Academic Building IV, retained
  floor/room descriptions and the real Main Entrance panorama rendered.
- A guide downloaded while v55 still served was retained through the explicit
  v56 Update now prompt and reload. It kept its original download timestamp,
  and disconnected reload rendered the basemap and saved Vehicle path. After
  normal owned logout removed that test guide under existing privacy behavior,
  a new full download completed on v56; disconnected reload rendered its
  basemap and saved Walking path. Each guide contained 26 buildings and 26
  entry, exit and Walking paths. Networking was restored afterward. An update
  returning already up to date was not counted as the fresh-download check.
- Chrome occasionally delivered no visible action in a tab. Early unopened
  form, document-only and asynchronous guide-summary observations stayed
  inconclusive; readiness-aware or fresh-tab retests passed. One Guest observer
  exceeded its tool deadline; the original tab's destination and Guest role
  were confirmed without resubmitting credentials. No application login patch,
  security bypass, cookie transfer or profile clearing was made.

### Dated monitoring

The staged closing watch ran 2026-10-23 04:52:32–05:02:47 UTC (614.7 seconds).
The product-live watch ran 05:03:26–05:13:39 UTC (612.168 seconds). Loaded
Runtime Logs views showed 0 Warning / 0 Error / 0 Fatal in both closing
snapshots; normal heartbeat rows continued. Expanded heartbeat messages and
the exact deployment filter were inspected. No natural retry was observed to
correlate, and no injected failure traffic was generated. Dashboard level
totals belong to the displayed Runtime Logs view, not an inferred count of
failed session refreshes. Earlier preparing snapshots and browser interruptions
remain in external evidence. These finite watches do not promise zero future
timeouts or provider outages. The final successor watch is recorded separately
in its external receipt, not treated as an already completed continuous watch.

The original baseline `dpl_G7Po4YVSvuAzp2Z9zgRWTfcT5NVc` remained current until
validated product promotion. A Ready/Staged rebuild of source `da29b4f`,
`dpl_6YqoBim7f7zVeFZLP7aCFNN3kWDr`, was prepared and health-checked as a manual
fallback before promotion; it was not promoted. No rollback was needed during
product acceptance. Recheck eligibility before every later promotion.

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
