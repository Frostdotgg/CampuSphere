<!-- NEWS OPTIONS RELEASE START -->
## News options product release — October 22, 2026 (verified)

Read `docs/news-options-release-2026-10-22.md` first. Product source
`8176c9f1bec4d3b584fecbec4482c4be09f863ad`, deployment
`dpl_CVsYatbsH43RvcG5r3hQTf1nF4KC`, passed staged and normal-website
verification. Seven departments and valid content categories are required;
University-wide and Facilities are retired write choices. Existing posts stay
readable; their edit forms require valid replacements without reassignment.
The two tracked release posts were removed; their audit history remains.
SELECT-only comparison preserved all original 9 articles and 12 events.
Source cache v55; stylesheet v13; downloaded-guide format and access rules stay.
No accounts, migration, shared cleanup, secrets or protection were changed.
Existing-post review/deletion remains deferred. Earlier local notices are
historical. The interrupted staged watch and fresh closing watch are recorded
separately; the sign-in-tab loading issue remains postponed, not claimed fixed.
The documentation successor has identical runtime; its final source/deployment
and ten-minute closing watch belong in the external receipt. Recompute live
truth before later work; this release grants no future cleanup permission.
<!-- NEWS OPTIONS RELEASE END -->

# News department and category options — local candidate, October 22

## Status and authority

This uncommitted, not deployed candidate is on `codex/news-department-options`,
based on `ba7dd2c32f33541688a5b3e30d9564cd4e7dd955`. The owner authorized local
implementation, Docker/browser checks using the supplied test account, and
creation/removal of one tracked draft article and Administrator-only event.
No commit, push, deployment or deletion of existing shared posts is authorized
in this implementation task. Production remains the completed Department News
release; do not treat local results as deployed verification.

## Changed behavior

News and event department choices and filters include exactly Graduate School,
CEA, CCS, CHS, CTHBM, CTDE and CAS. All departments remains a list filter.
Department editors default to their assigned department and may select another;
the main Administrator must select a department explicitly. Both existing write
APIs require a valid `department_code`; omitted/empty/invalid values and
`university-wide` receive 400 before a database write. There are no new endpoints.
The content repository also refuses invalid supplied departments and no longer
lets a missing create department invoke the historical database default.

Article categories are General, Academic, Advisory, Maintenance and Emergency.
Facilities, Event and Events are rejected on article create/update. Separate
events retain Academic, Sports and Cultural; Facilities is rejected there too.
Building/map Facilities categories remain available. Audience and draft privacy,
department-only access, shared editing, CSRF, audits and session policy remain.

Existing retired-value posts remain readable pending separate cleanup. Their
retired department badge is omitted, not mapped to a different department.
Editing requires a valid department/category and preserves author/publication
information. Nothing is silently deleted, reassigned or republished.

Candidate service worker is v55; stylesheet remains v13. Downloaded guides keep
their format and exclude news/events. Migration 0029 and database structures,
defaults and permissions are unchanged. Historical database/seed defaults can
still contain retired values; stop old writers and do not reseed shared data.
Application validation governs current writes; this is not a new DB constraint.

## Local Docker verification

Use the owner's `docker-compose.testing.yml` command with the external
`campusphere-local-supabase.env` file, then inspect service status and `/healthz`.
Do not dump resolved Compose configuration, container environment or credentials.
This localhost app uses the shared Supabase connection; localhost is not an
isolated database. Never run a seed or migration against it during this task.
The provided test login is entered only at localhost and never stored here.

Track one unique draft and one Administrator-only event by exact IDs outside
Git. Test create/reload/cross-department edit/filter/delete with the single
department account, then remove only these two disposable records. Main Admin,
participant privacy and rejected-request checks use isolated synthetic fixtures.
Original sign-in tabs may remain loading; a fresh protected tab can establish
an authenticated session. That postponed issue is not claimed fixed here.

## Prepared deletion and restoration — separate owner step

The selected scope is the union of articles/events whose `department_code`
equals `university-wide` OR whose `category` equals `Facilities`, including
drafts and published articles. A record matching both is counted once.
The October 22 read-only snapshot contains 9 articles / 12 events, with
8 affected articles / 11 affected events. These are dated observations;
review a fresh snapshot before any later deletion.

1. Confirm the exact database/project, pause all old content writers and export
   both complete content tables outside Git. Capture every column, IDs, authors,
   audiences, dates and nulls; retain a separate database backup if required.
   Validate a repeated read for consistency. This content snapshot is not a
   complete database/PITR backup and contains private post content.
2. Run `scripts/prepareRetiredContentCleanup.js PRIVATE_BACKUP_JSON NEW_EXTERNAL_DIRECTORY`.
   The offline-only tool reads files and prepares an affected-post manifest,
   copied backup, exact-ID deletion SQL and restoration SQL. It never connects
   to a database or executes its generated SQL. No credentials go into artifacts.
3. Review all exact IDs/titles and matching reasons with the owner. Regenerate
   after any content changes; do not broaden IDs manually. No shared deletion
   is part of this implementation, even if SQL files are already prepared.
4. Under a later focused authorization, keep writers paused, reverify target and
   backup, and review the complete SQL before execution. PostgreSQL requires
   `SET campusphere.cleanup_target = 'VERIFIED_PROJECT_REF';` in the same
   connection. MySQL requires `SET @campusphere_cleanup_target = 'VERIFIED_DATABASE';`.
   These values must match the reviewed backup target; they are not credentials.
5. The SQL checks database identity, complete table counts and every original
   column before deleting only the recorded affected IDs in a transaction.
   PostgreSQL locks the content tables; MySQL uses SERIALIZABLE isolation.
   Any missing/changed/unexpected row fails closed. Accounts, audits, routes,
   images and other tables are not deleted. Verify retained rows and counts.
6. To restore, keep writers paused and review the paired restoration SQL. It
   refuses conflicting IDs or changes to retained records, then restores the
   exact backed-up rows with their original IDs and content. It does not reset
   sequences or erase audit history. Resume writers only after verification.

MySQL helper procedures are transient and deliberately do not overwrite an
existing helper. On any failure, stop: inspect/roll back the connection and
review the helper procedure before removal or retry. Do not rerun blindly.
Never execute either shared-backend script during a disposable rehearsal.

## Verification and limitations

Focused results and browser evidence are recorded outside Git. Tests use
complete canonical Git-byte source and locked
dependencies; environment loading and external network are blocked for probes.
SQL rehearsals use only labelled, owned, network-disabled disposable containers.
No full npm test/QA pass, live MySQL parity, Production verification or
exhaustive map/VR/physical-device acceptance is claimed.

Candidate runtime inventory: **205 files / 8,610,144 bytes**, SHA-256
`54bbdea1b34fbdf17e4c90d6d39ae2ee529d785acd80ba0e56d693fd5d5ece5c`.
Canonical temporary-index Git bytes define it; the actual index remains empty.
The published predecessor remains 205 files / 8,610,129 bytes, SHA-256
`f72729ca781528f1fce24cfe81fa0a102bcdbb5b0856b15bb9af9ce44e4406f0`.

| Focused check | Local result |
| --- | --- |
| Department/content/access/privacy fixtures, both backends | 884/884 |
| Disposable PostgreSQL/MySQL cleanup and restore | 31/31 |
| Session bootstrap / resilience / request lifetime | 160/160, 73/73, 72/72 |
| Production startup profile / shared mutation rate limits | 116/116, 180/180 |
| Scheduling removal / Walking routes | 401/401, 118/118 |
| Offline navigation / PWA lifecycle with v54-to-v55 retirement | 49/49, 148/148 |
| Notification panel / event audiences | 26/26, 13/13 |
| User XSS / login timing / logout output | 5/5, 8/8, 11/11 |
| CSP / media URL policy | 5/5, 20/20 |
| Isolated documentation / canonical package boundary | 837/837, 76/76 |

Docker health passed. Browser checks exercised both forms, seven department
selections for each tracked post, cross-department updates, reload, search and
category/department filters, legacy required selections, keyboard dismissal and
390 px forms with long department names and no horizontal page overflow.
Only tracked draft 37 and Administrator-only event 24 were created and removed
through the application. SELECT-only read-back confirmed all original content
unchanged, the original 9 articles / 12 events, and 20 retained test audit records.
The existing department test account was not changed or deleted.

The initial PWA run found one stale numeric assertion (54 instead of 55) in its
updated test; the assertion was corrected without weakening rejection fixtures,
and all 148 checks passed. Browser selector timeouts were resolved by reading
the current DOM; they do not establish application defects or erase the known
sign-in-tab limitation. No existing shared post or shared MySQL record was
deleted, and no migration, Git commit/push or deployment was performed.
