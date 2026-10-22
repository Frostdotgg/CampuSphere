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

<!-- NEWS OPTIONS LOCAL START -->
## Local news-option removal candidate — October 22, 2026

Read `docs/news-department-options-2026-10-22.md` first for the uncommitted,
not deployed work on `codex/news-department-options`, based on `ba7dd2c`.
Only seven departments are selectable; University-wide and Facilities are
retired content choices. Candidate cache v55; published cache v54 remains dated
release evidence. Existing shared posts remain until a separate owner-reviewed
cleanup. Docker localhost uses shared Supabase: only the tracked disposable
draft/event may be changed and removed. No commit, push or deployment belongs
to this implementation. Account editing remains shared across departments;
audience/draft privacy and building Facilities remain. Historical notices below
are preserved and do not override this focused local task.
<!-- NEWS OPTIONS LOCAL END -->

# Department news administrators — implementation history and release guide

## Current released setup — October 21

Product `0968b5d` is verified on the normal website. The owner completed
migration 0029 after backup; do not reapply it. See
`docs/department-news-release-2026-10-21.md` for exact evidence and limitations.
The temporary verification account and its two private posts were removed;
seven permanent department accounts remain for the owner after release closure.

1. Sign in with the existing main Administrator account at
   https://campusphere-cspc.vercel.app/admin/users.
2. Choose Create User, select Department Administrator, select one of the seven
   departments, and enter the owner's chosen name, email and password.
3. Repeat for Graduate School, CEA, CCS, CHS, CTHBM, CTDE and CAS. Keep each
   account's credentials private; there is no shared default password.
4. Check that each login opens /admin/news with only News & Events and Logout.
   These editors can manage every department and University-wide content.
   Department labels do not replace audience restrictions or publish drafts.
5. Role, department and password changes revoke the affected account's sessions.
   Existing articles with Event/Events remain readable; choose a remaining
   article category before saving an edit. Separate Events retain their categories.

The implementation-only instructions and results below are history. They do
not supersede the completed release or authorize future migrations or accounts.

## Historical local implementation — October 21, 2026

# Department news administrators — local candidate, October 21, 2026

## Status and authority

This is a local, uncommitted and not deployed candidate on
`codex/department-news-admin`, based on `71946ab`. Read this note before the
dated published release in `docs/current-authority.md`. The owner authorized
implementation and isolated local tests only. Do not commit, push, deploy,
apply shared-database migrations or create live accounts under this task.
Production remains the dated `38fd296` application release; its verification
is not repeated here. No actual environment file or secret was read.

## Account and content policy

The new `department-admin` role requires one of seven department codes:

| Code | Department |
| --- | --- |
| graduate-school | Graduate School |
| cea | College of Engineering and Architecture (CEA) |
| ccs | College of Computer Studies (CCS) |
| chs | College of Health Sciences (CHS) |
| cthbm | College of Tourism, Hospitality and Business Management (CTHBM) |
| ctde | College of Technological and Developmental Education (CTDE) |
| cas | College of Arts and Sciences (CAS) |

The owner selected shared editing: every department administrator can create,
publish, edit and delete all departments' articles/events and University-wide
posts. The account department is a creation default, not an ownership boundary.
University-wide means content for the whole school. Existing posts receive this
default. Existing role-based audiences and unpublished-news privacy remain.

Department accounts go directly to `/admin/news`. Its news/event CRUD, logout,
CSRF refresh and presence heartbeat are the only permitted dynamic operations;
authentication entry pages redirect back to the editor. Other application pages
and APIs return the existing 403 denial before their controllers read protected
data. Public static assets and anonymous health endpoints remain public. Missing
department assignments fail closed. Main Administrator access is retained.
Public registration cannot create this role. Account role, department and
password changes revoke that account's sessions through the existing mechanism.

Both content forms have a Department dropdown. Lists show department labels
and filters; filtering does not grant reading permissions. Both `Event` and
`Events` are removed from article category choices and accepted article writes.
Legacy articles are retained and readable; editing requires a remaining category.
Events remain in the separate Events tab with Academic/Sports/Cultural categories.

The main Administrator's account analytics now include the fifth role. This is
required compatibility: retaining a four-role count would make the exact-total
validation reject real account totals. The fifth series has its own label,
colour and horizontal pattern, with the semantic count table retained.

## Owner-controlled setup after a separate release decision

1. Confirm and back up the intended database. Review the additive PostgreSQL
   `database/supabase/0029_department_news_admin.sql` or MySQL
   `database/0029_department_news_admin.mysql.sql`. Apply the appropriate file
   only under separate owner authorization, before running the new application.
2. PostgreSQL 0029 adds versioned server-only account-management RPCs, avoiding
   ambiguous overloads and preserving original RPC signatures/permissions.
   Both new functions deny PUBLIC/anon/authenticated and grant service_role.
   MySQL DDL implicitly commits; its migration is run once. Prior migration
   history is unchanged. The fresh-install MySQL schema includes the new fields.
3. After a separately authorized deployment, sign in as the main Administrator.
   Open Users, choose Create User, select Department Administrator, choose the
   department, and enter the owner's chosen name, email and password.
4. Repeat for the seven departments. There is no automatic account seed, shared
   default password or uniqueness limit preventing additional named editors.
   Distribute credentials privately and test each login. Department admins
   cannot manage accounts or change their own assignment.

The application requires 0029; it does not silently fall back if a backend has
not been migrated. New content/account API payloads add `department_code`.
Older content callers omitting it retain the University-wide default; supplied
invalid values are rejected. Department assignment is separate from the old
instructor profile's department text.

## Compatibility and local verification

Source service worker is v54; stylesheet remains v13. Published v53 and
owner-applied migration 0028 remain dated release facts. Source migration 0029
is prepared only and has not been applied to a shared database. Downloaded
guides retain their format and continue excluding news/events and admin data.
Session retry budgets, paired diagnostics and lifetime registration are unchanged.
Room-scheduling retirement, Info privacy, saved routes and panoramas remain.

Tests use synthetic sessions, fake providers and local fixtures. SQL rehearsals
use disposable, labelled, network-disabled PostgreSQL/MySQL containers with no
host ports or shared volumes. Browser checks use a loopback fixture, not the
owner's Supabase-backed application. They cover desktop/390 px forms, department
defaults, filtering, local article save/reload, retained main-admin controls,
participant lists and keyboard Escape/focus restoration. A narrow phone toolbar
was corrected after visual inspection. Full QA, live backend parity, real Google
OAuth, physical-device acceptance and Production acceptance are not claimed.

## Final focused results — October 21 local candidate

| Check | Result | Evidence scope |
| --- | --- | --- |
| Department accounts/content/access | 815/815 | Real routers, controllers, repositories and EJS; synthetic sessions and fake MySQL/PostgREST providers |
| Additive migration and fresh schema | 36/36 | Disposable PostgreSQL/MySQL containers; existing content/timestamps and RPC permissions checked |
| Dashboard analytics standalone | 247/247 | Explicit static-only mode; live comparison excluded |
| Registered analytics contracts | 113/113 | Isolated source/fixture checks for five roles and accessible patterns |
| Session bootstrap | 160/160 | Isolated runtime/session fixtures |
| Session resilience | 73/73 | Fake provider, abort/retry/privacy/callback fixtures |
| Session refresh lifetime | 72/72 | Loopback lifecycle fixtures |
| Production startup/profile | 116/116 | Local synthetic configuration; no Production traffic |
| Shared rate limits | 180/180 | Isolated limiter fixtures |
| Room-scheduling removal | 401/401 | Isolated retirement/privacy regressions |
| Walking 2D | 118/118 | Isolated route fixtures; source migration inventory now includes prepared 0029 |
| Offline navigation | 49/49 | Isolated downloaded-guide compatibility fixtures |
| PWA lifecycle | 148/148 | Current cache v54 and stale-cache transition fixtures |
| Notifications | 26/26 | Existing audience-safe feed and client checks |
| Event audiences | 13/13 | Existing role visibility and source contracts |
| Documentation contracts | 775/775 | Network-free, database-free gate; previous 761/761 remains dated evidence |
| Runtime package boundary | 76/76 | Canonical Git bytes, inclusions and secret/local-artifact exclusions |
| Pilot readiness source contracts | 84/84 | No runtime/database checks; only a read-only Git tracking query permitted |
| User-list XSS / login timing / logout output | 5/5, 8/8, 11/11 | Isolated source and rejection-fixture gates |
| CSP / media policy | 5/5, 20/20 | Isolated policy contracts |

The account/content probe explicitly creates all seven Department Administrator
assignments through the existing main Administrator's real User Management
controller, on both backend fixtures. It verifies department/password/role
changes invalidate previous sessions. Department accounts cannot call User
Management or change their own role/assignment. Authentication entry addresses,
including Google sign-in/callback and registration completion, return an already
signed-in department account to the editor without starting another auth flow.

Browser checks covered desktop and 390 px layouts, the main Administrator's
department-role form, new article/event defaults, department filters, audience-
filtered participant lists, local article save/reload and Escape/focus restoration.
Review found and corrected a narrow toolbar overflow and a filter in the legacy
main-admin news table; the latter now has a card/table-row regression. Long
department options retain their full names; a closed native select may visually
truncate the selected name on a phone.

Earlier implementation runs exposed missing dependencies in the primary local
installation, outdated four-role/cache/migration assertions and fixture setup
errors. These were corrected before the final runs. Tests ran from the complete
canonical source with a preserved dependency installation whose lockfile hash
matches this checkout. Dependencies and `package-lock.json` were not changed.
The pilot-readiness isolation wrapper initially blocked its Git tracking query;
the successful rerun permits only that exact read-only query. It still blocks
server, database, credential and network operations.

Final source checks passed: 27 JavaScript syntax checks, eight EJS compilations,
56 UTF-8/NUL/BOM checks, documentation path-reference checks, whitespace
and added-line secret-pattern checks. Eleven candidate notices match. All 1,233
fingerprinted prior evidence files and 51 protected files remain unchanged.
The only authorized change in the original protected-file inventory is the
fresh-install `database/schema.sql`; migration history through 0028 is unchanged.

## Candidate package and delivery boundary

The canonical candidate Git-byte runtime inventory is **205 files / 8,610,129
bytes**, aggregate SHA-256
`f72729ca781528f1fce24cfe81fa0a102bcdbb5b0856b15bb9af9ce44e4406f0`.
The four added runtime files are the department utility, access middleware,
dropdown partial and participant filter script. Published package fingerprints
remain historical release evidence. This local inventory does not establish
deployed-byte identity.

Original release evidence, local backups, browser screenshots, isolated logs
and the final source-review receipt remain outside Git. Disposable containers
were removed after the successful migration rehearsals. No shared application
records, live accounts, actual environment files, vendor settings or deployment
were changed. The actual Git index remains empty; HEAD stays at `71946ab` on
`codex/department-news-admin`, with this reviewed local diff pending.

These are focused results, not a full `npm test`/QA pass. Real Google OAuth,
live backend parity, physical-device acceptance and Production acceptance are
not established. Migration 0029, live account creation, commit/push and deployment
remain separately authorized later steps.
