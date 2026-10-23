# Campus-wide Events — local candidate, October 23, 2026

## Status and reading order

This is a local, uncommitted and not deployed candidate on
`codex/campus-wide-events`, based on
`da29b4fdc995f33c103e6bdda288565a3f9c6756`. Read this note before the dated
October 22 news-option release and its original implementation note. Those
records preserve earlier behavior and permissions; they do not authorize work.
Commit, push, deployment and shared cleanup remain separate owner tasks.

## Current candidate policy

- Events offer Campus-wide first, then Graduate School, CEA, CCS, CHS, CTHBM,
  CTDE and CAS. All departments remains a list filter.
- The stored/API value is `university-wide`; its event display label is
  Campus-wide. The literal `campus-wide` is not an accepted API value.
- Both editor roles may manage every department's events. Department
  Administrators default to their assigned department; main Administrators
  must select explicitly. Missing/invalid departments are rejected without
  fallback.
- News and account assignments retain only seven departments. Campus-wide is
  rejected for articles and account assignments. Facilities remains rejected
  for content writes; building Facilities categories remain available.
- Event labels and department filters support Campus-wide. Switching its
  Events filter to News resets to All departments. A valid department filter
  survives switching; search/category filters still combine with department.
- Audience restrictions, draft privacy, CSRF, department-only access and safe
  audits remain. Campus-wide does not grant reading access.
- Existing University-wide events display/edit as Campus-wide. Merely opening
  an event does not rewrite saved records, content, dates or audience.
- No schema migration or saved-record rewrite is required. Migration 0029,
  database structures/defaults, environment settings and session policy stay.
- Candidate service worker is v56; stylesheet remains v13. The downloaded-guide
  format is unchanged and still excludes news/events. Published v55 remains
  dated release evidence, not a deployment of this candidate.

## Deferred cleanup — policy version 2

**All earlier generated deletion plans are obsolete. Do not execute them.**
Preserve their historical backups and evidence. Prepare a fresh snapshot and
obtain fresh owner review before any future shared cleanup; this task grants
no cleanup permission.

The offline preparer emits `campusphere-retired-content-plan-v2`, policyVersion 2:

- Articles: University-wide department OR Facilities category; count overlap once.
- Events: Facilities category only. Valid Campus-wide events are retained.

The input backup format remains `campusphere-retired-content-backup-v1`.
The preparer never connects to a database. Both complete content tables and
every original column are required. Generated exact-ID delete and restore SQL
check the confirmed target, counts and complete row equality; changed or
unexpected records cause refusal. Future owners must pause writers, privately
back up/validate both tables, prepare into a new directory outside Git, review
IDs/reasons and paired restore SQL, then separately authorize execution.
PostgreSQL table locking and MySQL SERIALIZABLE transactions remain.
Accounts, audit history, routes and unrelated posts are preserved.

The October 22 affected-post counts belong to obsolete policy v1. They are not
current deletion counts under v2. No fresh shared-content export or cleanup
was performed for this candidate.

## Verification record

Focused checks use complete canonical Git-byte source with 127 installed
dependencies verified against the unchanged lockfile. Environment loading and
external network access are blocked; HTTP fixtures use loopback only, synthetic
accounts and fake providers. SQL runs only in owned disposable containers.

Final focused results:

| Check | Result |
| --- | --- |
| Content, access, privacy and both backend fixtures | 1,137/1,137 |
| Editor tabs, filters, defaults and keyboard DOM fixtures | 32/32 |
| Disposable PostgreSQL/MySQL cleanup and restore | 35/35 |
| Session bootstrap / resilience / request lifetime | 160/160; 73/73; 72/72 |
| Production startup profile / shared rate limits | 116/116; 180/180 |
| Notifications / event audiences | 26/26; 13/13 |
| Offline navigation / PWA lifecycle | 49/49; 148/148 |
| Walking routes / scheduling retirement | 118/118; 401/401 |
| Isolated documentation / dashboard analytics / login timing | 896/896; 113/113; 8/8 |
| Canonical package boundary | 76/76 |
| Syntax / EJS compilation | 14 JavaScript files; 3 templates passed |

UTF-8, BOM/NUL, whitespace and added-line secret checks passed. All 52 protected
files and 596 prior investigation-evidence files matched their starting hashes
(approved documentation edits are separately reviewed). The actual index is
unchanged; the candidate package differs from the baseline in ten runtime files.
Authentication/session implementation, dependencies and database source files
are unchanged. The v55 stale-cache rejection initially still used the previous
test expectation; it was advanced to v56 while preserving older cache fixtures,
then the final 148/148 run passed.

Docker rebuilt successfully and health returned HTTP 200. The in-app browser
confirmed the original-tab sign-in, assigned CCS default, Campus-wide ordering,
News separation, absent Facilities choices, Events-to-News filter reset, empty
search results, keyboard Tab/Escape, desktop and 390 px forms. Long department
names remain selectable; native selects truncate long closed labels. A separate
synthetic browser confirmed the main Administrator's empty default, participant
department/category combinations, private-event exclusion, 390 px layout and
legacy Campus-wide edit values. Its teardown reported zero writes.

Chrome's original-tab Docker login succeeded, but later control actions had
no visible effect. Those actions, including an attempted logout with no
observed POST, remain inconclusive and are not counted as browser passes.
The in-app browser's owned session signed out successfully. Test tabs closed;
the unsubmitted Chrome logout did not revoke that session. Its normal expiry
policy remains. No browser profile, extensions, cookies or downloaded guides
were manually cleared. The separate missed-click investigation was not fixed
or expanded here. These limits remain in the external browser evidence.

No full npm test/QA pass, live MySQL parity, physical-device acceptance or
Production verification is claimed. The separate missed-click investigation
is outside this feature; a missing automated submission is inconclusive.

Docker localhost uses shared Supabase for authentication, content and sessions.
Only normal sign-in/logout session activity is allowed. Forms/layout are
read-only; content writes run only in isolated fixtures. No shared posts,
accounts or environment settings are changed.

## Candidate runtime package

Canonical temporary-index Git bytes: 205 files / 8,611,691 bytes; SHA-256
`12fb08e21976a482a0a52a61ea4495287e1d50724fa7c3366f27ba52477a5eb6`.
The real Git index remains untouched. The published October 22 package remains
dated evidence in `docs/news-options-release-2026-10-22.md`.

Preservation and sanitized logs/screenshots live outside Git at
`C:/Users/FROST.GG/.codex/backups/campus-wide-events-20261023/`.
