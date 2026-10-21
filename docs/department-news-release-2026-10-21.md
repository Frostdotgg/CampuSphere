# Department News controlled release — October 21, 2026

## Status and scope

Release status: completed product verification. The documentation successor's
final commit, deployment and closing verification are recorded outside Git.
Product commit: `0968b5d107b69166301e9c80350d3f7c6a7ffcbb` (`0968b5d`). Product deployment:
`dpl_7wPtbzKtFUuGAENtYWHHxGz4DJZJ`, verified Ready / Production / Current
on https://campusphere-cspc.vercel.app after staged acceptance. Promotion was
requested at `2026-10-21T12:32:11.161Z`. The previous source `38fd296` and
deployment `dpl_86Lge98zAWnSKYbG7b14ef4uMpfF` remain the recorded rollback
target; they no longer serve the normal website. GitHub had no rulesets or
classic branch protections requiring a pull request. The feature and main were
pushed normally; no force push was used. Production tracks main; automatic
Production domain assignment is disabled. Protection, secrets and provider
settings remain unchanged. Recheck this setting before the documentation push.

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

The documentation closeout passed **824/824** isolated contracts and **76/76**
canonical package checks. It reviewed 19 documentation/static-assertion paths,
one JavaScript syntax check, 19 UTF-8/NUL/BOM checks and 1,581 referenced paths.
Whitespace and added-line secret checks passed. All 52 protected files and
1,308 earlier evidence fingerprints remained unchanged. Sixteen current release
notices agree, including the eleven continuity copies. The 797/797 result above
is the earlier product-freeze documentation checkpoint, not this successor's total.
The successor retains exactly the product runtime inventory and fingerprint.

## Verified staged and normal-website acceptance

Main Administrators retain User Management; department-admin accounts use only
/admin/news and required authentication/CSRF/heartbeat operations. They share
editing across all seven departments and University-wide posts. Department labels
do not grant reading access: existing audiences and draft privacy remain.
Both Event and Events article categories are rejected; old articles remain.
The main Administrator created and updated the one tracked account through
User Management. Department sign-in opened the editor, and 22 direct forbidden
paths returned 403 in staging. Guest, Student and Instructor checks hid the draft
and Administrator-only event and denied the editor; each role change revoked
the previous session. The account was restored to Department Administrator / CEA.
Password and department updates also revoked its former session. All seven
assignments and remaining backend/security cases passed the isolated fixtures.

The tracked draft and event saved, reloaded and changed across departments and
University-wide labels while retaining their private status/audience. Filters,
desktop and 390 px forms, long names and Escape/focus restoration passed. An
existing Events-category article remained readable, and its edit form required
a remaining category without saving any change to that article.

The normal website retained all main Administrator sections; the department
account could update its private draft/event but received 403 for User Management,
the participant dashboard and the offline-guide API. Walking and Vehicle entrance
and return responses passed. Main Entrance Free Roam and representative Guided VR
were checked in staging; the live Main Entrance panorama rendered before and
after accepting the available browser update. Room descriptions were preserved.
Public smoke passed **22/22**, including seven exact committed asset matches.

The staged guide data API returned 200, but temporary-host Vercel protection
redirected its basemap to SSO; CSP blocked that redirect. This approved deferral
was resolved immediately on the normal website: its October 20 saved guide
reloaded disconnected and drew a Walking route, then a fresh October 21 download
succeeded with 26 buildings, 26 entry, 26 exit and 26 Walking paths. The refreshed
guide reloaded disconnected and drew the Walking return. The browser's Update now
flow completed, followed by another disconnected reload. Connectivity was restored.
Raw cache-name inspection was unsupported; no direct Cache Storage inventory is
claimed. The source v54 worker matched its committed bytes and its update flow
and offline reload were exercised. Guide format is unchanged; news/events and
Administrator data remain excluded.

The owner explicitly confirmed cleanup of only account 3710, draft article 35
and Administrator-only event 22. Each application deletion returned 200; fresh
lists showed no tracked posts/account, with 8 articles, 0 drafts and 11 events.
Both former account sessions redirected to sign-in, and its creation audit
remained visible after deletion. No direct database cleanup was used. The owner
then signed in as the main Administrator; a fresh protected tab confirmed the
dashboard and complete sidebar. Seven permanent accounts remain uncreated.

### Monitoring and limitations

Staged closing watch: `2026-10-21T12:21:44.203Z`–`2026-10-21T12:31:57.788Z` UTC
(**613.585 seconds**). Product-live watch:
`2026-10-21T12:32:32.520Z`–`2026-10-21T12:42:56.945Z` UTC (**624.425 seconds**).
Loaded all-severity closing views showed **0 Warning / 0 Error / 0 Fatal request
rows**; no natural retry was observed in those finite watches. These are
request-row counts, not console-message totals or a promise of future availability.
Earlier owner waits and the Chrome restart are monitoring gaps, not continuous
watch time. The original sign-in tabs repeatedly remained loading and browser
inspection timed out; fresh protected tabs established usable signed-in sessions.
Their loading cause remains unestablished and is not claimed fixed by this feature.
Two browser assertions initially failed because of masked email observation and
inactive network capture; both were resolved and independently rechecked. They
are retained as observer limitations, not erased or counted as application defects.
These browser observations do not establish exhaustive traversal, a physical-device
acceptance pass, complete deployed-byte equality or a full QA pass.

The documentation successor changes only these handoffs and static assertions.
Before closure, prove its runtime package identical, validate its Ready / Staged
Production build, promote it, repeat live smoke and observe ten minutes of logs.
Its self-referential commit/deployment IDs and final watch belong in the external
receipt, without another documentation commit.

Delete only tracked temporary records and revoke their sessions through the
application before old-code rollback. The older release does not enforce the
department role's restrictions. Owner emergency cleanup requires verified IDs,
nonce, exact email/titles and retained unrelated fixture hashes; unfilled or
mismatched identities fail closed. Keep additive 0029 in place on rollback.
Preserve audits, unrelated users/content, saved routes, room descriptions and
private Info markers. Seven permanent accounts remain uncreated by this release.

The final documentation successor and deployment identities belong in the external
receipt after verification, avoiding a self-referential follow-up commit.
