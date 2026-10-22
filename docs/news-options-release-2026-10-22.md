# News department/category options — controlled release, October 22

## Status and authorized scope

Release status: preparation; no new Production publication is claimed yet.
Continue from `codex/news-department-options`, baseline
`ba7dd2c32f33541688a5b3e30d9564cd4e7dd955`. The owner explicitly authorized
review, focused checks, normal commit/push, staged Production verification,
manual promotion and a documentation successor. The earlier local-only notices
are implementation history, superseded by this focused release authorization.

**Existing-post review and deletion are deferred.** Older posts remain readable;
editing them requires valid department/category choices. Only one uniquely
labelled disposable draft article and one Administrator-only event may be
created, edited and removed for release checks. Track their exact IDs outside
Git. Use the owner's existing Administrator and department test accounts;
create no accounts and change no credentials, roles or department assignments.
No migration, seed, shared cleanup, schedule deletion or ICTU deployment is
authorized. Prepared maintenance helpers remain excluded from the Vercel
runtime and must not execute against shared databases.

## Frozen behavior and package

Exactly seven departments remain selectable, with All departments retained as
a list filter. Department accounts default to their assignment and may edit
across departments. Main Administrators explicitly select a department.
Existing news/event write APIs require a valid department and reject missing,
invalid and `university-wide` values before writes. Article categories are
General, Academic, Advisory, Maintenance and Emergency. Event categories remain
Academic, Sports and Cultural. Facilities is rejected for either content type;
Event/Events remain rejected article categories. Building Facilities remain.
Existing author/publication data, audience restrictions and draft privacy are
preserved. Unknown/retired department labels are omitted without reassignment.

Runtime package: **205 files / 8,610,144 bytes**, SHA-256
`54bbdea1b34fbdf17e4c90d6d39ae2ee529d785acd80ba0e56d693fd5d5ece5c`.
Canonical staged Git bytes define the package, not Windows checkout endings.
Source cache v55; stylesheet v13; downloaded-guide format unchanged.
Migration 0029, database defaults/permissions, dependencies, session policy,
secrets and deployment protection remain unchanged. Historical database defaults
are compatibility storage, not an accepted current application write choice.

## Release gates and rollback

Verify automatic Production domain assignment is disabled before pushing.
Build the exact published main commit with Production settings and verify
Ready/Staged before promotion; separate Preview credentials are not required.
Reverify the recorded Ready / Production / Current rollback target:
`dpl_9Q1aYoeWmCy4KxoL59sNq54uHzyD`, source `ba7dd2c`. Check rollback
eligibility before each promotion and prepare a staged rebuild of the recorded
source if necessary. Protection and secrets must remain unchanged.

Rerun the required focused checks from complete locked source with synthetic
providers, blocked environment loading and external networking, and loopback HTTP
only. SQL-helper rehearsals use owned, network-disabled disposable containers;
they grant no shared cleanup permission. Record fresh exact results below.
Check both account types, forms/defaults, rejected writes, older-post readability,
cross-department editing, privacy, filters and desktop/390 px layouts. Open older
editors without saving. Use the main Administrator for map, Walking/Vehicle and
representative VR reads; do not save campus content.

Observe expanded staged logs during testing and for ten minutes afterward.
After promotion repeat live checks, v55 update, an existing downloaded guide,
a fresh download and disconnected reload. If temporary-host protection blocks
only the staged basemap download, defer that check immediately to the normal
website without weakening protection. Remove only tracked disposable posts
through the application and retain audit history. Compare read-only content
snapshots; distinguish concurrent owner edits and never overwrite them.

Record verified product identity and evidence in the documentation successor,
prove identical runtime, verify its staged build, promote and repeat final
smoke. Monitor for ten minutes after final promotion. Final self-referential
commit/deployment identities and closing watch belong in the external receipt.
Roll back for blocking sign-in, unauthorized access, privacy leaks, broken
content operations, routing/offline regression or attributable server errors.
Preserve all existing accounts/content and audits. Finish with clean local main,
GitHub main and deployed source matching.

## Evidence and limitations

Fresh release results are recorded outside Git and summarized here before the
reviewed commit. Local implementation history and its original test results are
preserved in `docs/news-department-options-2026-10-22.md`. These focused results
are not a full npm test/QA pass, live MySQL parity, exhaustive map/VR traversal,
physical-device acceptance or complete immutable deployed-byte equality.
The original sign-in-tab loading issue is postponed and not claimed fixed;
usable authenticated navigation is required. Existing-post cleanup remains
deferred even when a prepared SQL file or dated affected-post list is present.

### Fresh pre-push results

Vercel's current deployment and main source were reverified as the recorded
rollback target above. Production tracks `main`; automatic domain assignment
was disabled, with manual promotion required. Git integration points to
Frostdotgg/CampuSphere. No rulesets or classic branch protections require a PR.
Neither settings nor secrets were changed. A repeated-read, SELECT-only private
snapshot captured 9 articles and 12 events before test content; no account or
session contents were read. Keep dated snapshots separate from future counts.

| Focused release gate | Fresh result |
| --- | --- |
| Department/content/access/privacy, both backend fixtures | 884/884 |
| Disposable PostgreSQL/MySQL cleanup/restore helpers | 31/31 |
| Session bootstrap / resilience / lifetime | 160/160, 73/73, 72/72 |
| Production profile / shared rate limits | 116/116, 180/180 |
| Walking / scheduling retirement | 118/118, 401/401 |
| Offline navigation / PWA lifecycle | 49/49, 148/148 |
| Notifications / event audience | 26/26, 13/13 |
| User XSS / login timing / logout hygiene | 5/5, 8/8, 11/11 |
| CSP / media policy | 5/5, 20/20 |
| Isolated documentation / canonical package boundary | 851/851, 76/76 |

The Docker rebuild was healthy, and representative desktop/390 px form checks
used the existing department test account without saving shared content. Syntax
passed for 13 JavaScript paths and 4 EJS templates. The 24 reviewed text paths
passed UTF-8, whitespace and added-line secret checks. All 52 unique protected
files, migration 0029, dependency manifests and 1,308 older evidence fingerprints
remained unchanged. New release evidence remains outside Git. No full QA pass
or new Production feature acceptance is implied by these pre-push results.
