# Department News controlled release — October 21, 2026

## Status and scope

Release status: in progress. No product commit or deployment is accepted yet.
The reviewed branch is `codex/department-news-admin`, starting at `71946ab`.
Existing source release `38fd296` and Ready deployment
`dpl_86Lge98zAWnSKYbG7b14ef4uMpfF` remain the rollback target and currently
serve https://campusphere-cspc.vercel.app. GitHub has no rulesets or classic
branch protections requiring a pull request at the recorded check. Production
tracks main; automatic Production domain assignment is disabled. Settings and
deployment protection remain unchanged. Recheck staging before pushing.

This explicit release authorizes one temporary department account, a draft
article and an Administrator-only event, with exact IDs recorded outside Git.
Seven permanent accounts are deferred to the owner after release closure.
No shared MySQL migration, schedule cleanup or ICTU deployment is included.

## Database verification

The Production Supabase URL matched the selected dashboard project before any
owner-run change. The owner exported the affected-table/schema snapshot outside
Git. Its validator confirmed 157 users, 8 articles and 11 events. This is an
affected-table snapshot, not a complete database/PITR backup; private records
and credentials stay outside Git and this report.

The owner completed migration 0029. SELECT-only checks verified three department
columns, University-wide defaults, four validated constraints and both versioned
account-management RPCs. PUBLIC, anon and authenticated cannot execute either
new RPC; service_role can. Function bodies match reviewed source after CRLF/LF
normalization. Existing account/content hashes, authors, audiences and publication
dates were unchanged. No session contents were inspected. Old RPC signatures and
permissions are preserved. No permanent account was automatically created.

The unmodified live application's health remained 200 after the additive change.
The owner signed in; a fresh tab loaded the Administrator dashboard and existing
News & Events editor. The original sign-in tab remained loading and browser
inspection timed out; successful fresh-tab navigation establishes a usable
authenticated session, not the cause of that tab's loading state. Both original
account RPC definitions and ACLs matched the pre-migration backup exactly.

## Frozen source and focused checks

Runtime package: **205 files / 8,610,129 bytes**, SHA-256
`f72729ca781528f1fce24cfe81fa0a102bcdbb5b0856b15bb9af9ce44e4406f0`.
Canonical Git bytes define this package, not Windows checkout line endings.
Source cache v54; stylesheet v13; downloaded-guide format unchanged.
No dependency, session retry policy, secret or provider-setting change.

Fresh release runs used complete canonical source and locked dependencies.
Fake providers/synthetic sessions blocked external networking and environment
loading; SQL writes used owned disposable network-disabled containers only.

| Focused check | Result |
| --- | --- |
| Department accounts, content, access and CSRF | 815/815 |
| PostgreSQL/MySQL migrations and fresh schema | 36/36 |
| Owner backup query/validator rehearsal | 22/22 |
| Complete/truncated/incorrect-row-count CSV fixtures | 3/3 |
| Owner verification and scoped emergency cleanup rehearsal | 25/25 |
| Session bootstrap / resilience / lifetime | 160/160, 73/73, 72/72 |
| Production profile / shared rate limits | 116/116, 180/180 |
| Scheduling retirement / Walking routes | 401/401, 118/118 |
| Offline navigation / PWA lifecycle | 49/49, 148/148 |
| Notifications / event audiences | 26/26, 13/13 |
| Analytics standalone / source contracts | 247/247 static-only, 113/113 |
| Pilot readiness / XSS / login timing / logout output | 84/84, 5/5, 8/8, 11/11 |
| CSP / media policy | 5/5, 20/20 |
| Documentation before / after release-note changes | 775/775, 797/797 |
| Canonical runtime package boundary | 76/76 |

Vehicle rendering source-only checks also passed with zero failures; database
legs were not run. Syntax checked 27 JavaScript files; 8 EJS templates compiled;
56 changed files passed UTF-8/NUL/BOM and added-line secret checks; 1,564 source
paths resolved. All 52 protected files and 1,308 earlier evidence files matched
the preparation fingerprints. Rerun affected checks after documentation edits.
The final pre-commit review covered 57 approved paths, 27 JavaScript syntax
checks, 8 EJS compilations and 1,581 referenced paths. The updated isolated
documentation gate passed 797/797; the canonical package rerun passed 76/76
with the same runtime fingerprint. All protected/evidence fingerprints remained.
These focused results are not a full npm test/QA pass, live MySQL parity,
exhaustive route/VR traversal or physical-device acceptance.

## Staged acceptance and cleanup still required

Main Administrators retain User Management; department-admin accounts use only
/admin/news and required authentication/CSRF/heartbeat operations. They share
editing across all seven departments and University-wide posts. Department labels
do not grant reading access: existing audiences and draft privacy remain.
Both Event and Events article categories are rejected; old articles remain.
Check account creation/update, revoked sessions, all roles, article/event CRUD,
filters, desktop/390 px, normal sessions and representative maps/VR. Do not save
unrelated shared content. Fresh/offline existing-guide checks and finite staged,
live and final-successor ten-minute log watches remain pending.

Delete only tracked temporary records and revoke their sessions through the
application before old-code rollback. The older release does not enforce the
department role's restrictions. Owner emergency cleanup requires verified IDs,
nonce, exact email/titles and retained unrelated fixture hashes; unfilled or
mismatched identities fail closed. Keep additive 0029 in place on rollback.
Preserve audits, unrelated users/content, saved routes, room descriptions and
private Info markers. Seven permanent accounts remain uncreated by this release.

Product commit: pending. Product deployment: pending. Promotion: pending.
Final documentation successor and deployment identities belong in the external
receipt after verification, avoiding a self-referential follow-up commit.
