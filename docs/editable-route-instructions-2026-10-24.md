# Editable route instructions — October 24 staged release

The owner approved editable instructions for pin → Set as Destination, Find
Route and return navigation, then separately authorized a staged release of
the reviewed Docker candidate. Its preparation baseline is documentation HEAD
`f63fc8404b3365dc7055af60531a19d5c0ab4120`. The released runtime remains
`2c0a1bf` until separately authorized Production promotion is verified. This
note records the authorized workflow; actual results and final source and
deployment identities belong in the external release receipt, avoiding a
self-referential follow-up commit. Authorization is not evidence of completion.
Earlier statements that Walking Steps were discussed but not approved describe
the released application and the earlier handoff, before this focused task.

## Behavior and storage

There are four independent lists for each route-source building ID:

| Mode | To building | Back to gate |
| --- | --- | --- |
| Vehicle | Existing `campus_route_steps` rows | New instruction list |
| Walking | New instruction list | New instruction list |

No wording is copied between modes or reversed. The new table is
`campus_route_instruction_lists`, keyed by `destination_building_id`, `mode`
and `direction`; each complete list is replaced in one atomic upsert.
Vehicle entry still uses the existing route-step API and transactional/RPC
write path. Existing administrator instructions are preserved. No real campus
directions are seeded, inferred or populated by the migration.

The shared server resolver requires one predefined route with the exact
destination ID and a normalized gate label: Guard House, Main Gate or
Guard House / Main Gate. It does not use title fragments or choose between
duplicate matches. Map responses retain geometry, segments, distance and time,
and add ordered `instructions` and `instructionStatus` (`saved`, `empty`,
`unavailable`). The fixed-gate Find Route action uses the same computed lookup
as pin navigation, including the validated route-source identity.

Empty lists display “No instructions have been added for this route yet.”
A failed or ambiguous instruction read displays “Instructions are temporarily
unavailable.” Route geometry remains available when only instructions fail.

## Administration and security

Routes offers Vehicle Steps; Walking 2D Routes offers Walking Steps. Both use
To building / Back to gate tabs. Add, remove and reorder controls preserve
optional landmarks and coordinates. Closing or switching a dirty list asks
before discarding it. Failed loads cannot be saved as an accidental empty list;
late responses cannot overwrite a newer selection. A save freezes its draft.

Limits remain 200 steps, 5,000 characters per instruction and 255 per landmark,
with bounded optional latitude/longitude. Empty lists clear only the selected
list; unfinished blank rows fail validation. The existing global JSON request
size limit still applies. No general request-size expansion is included.

`GET/PUT /admin/api/route-instructions/:destinationBuildingId` accepts exact
`mode=vehicle|walking` and `direction=entry|exit` parameters for the three new
lists. Vehicle entry continues through `/admin/api/routes/:routeId/steps`.
Authentication, full Administrator permission, CSRF and mutation limiting remain
in force. Department Administrators cannot use these APIs. Text is rendered
through DOM text/value properties. Audit events contain fixed metadata, never
instruction content or coordinates.

## Migration and offline compatibility

Additive sources are prepared, **not applied to a shared database**:

- `database/supabase/0030_route_instruction_lists.sql`
- `database/0030_route_instruction_lists.mysql.sql`
- Matching fresh-install table in `database/schema.sql`

Supabase enables RLS, denies `anon`/`authenticated`, and grants the server role
only the required table operations. Migration 0030 explicitly removes inherited
new-table grants from the server role before granting CRUD; the observed hosted
default grants otherwise include maintenance operations. Disposable PostgreSQL
tests reproduce those defaults and reject extra server/client permissions.
No existing steps, geometry or tables are
rewritten. Validate the target, take an external backup and separately authorize
the shared migration before release. Do not run the ordinary localhost seed
against a shared Supabase connection.

New downloaded guides add `instructionFormat: 1`, all four lists and explicit
Walking `returnSteps`. Instruction reads are paginated and a failed/ambiguous
snapshot refuses the new package. Older guides remain usable with their older
behavior and a connected Update Offline Map notice. Download/update remains
explicit and signed in; failed updates retain the previous guide. IndexedDB
holds the guide; Cache Storage remains shell-only. Candidate shell cache v57
refreshes the changed offline assets; shared stylesheet v13 is unchanged.

## Verification and release checkpoint

The current release authorizes one scoped commit and normal main push after
fresh local checks, a validated external route-only backup, owner-run additive
Supabase migration 0030 and SELECT-only preservation/permission verification.
MySQL migration sources remain local/rehearsal only. The target must match the
selected dashboard project and verified deployment configuration; do not read
environment files or reveal secrets to establish that identity.

Vercel must retain main tracking, existing protection and disabled automatic
Production domain assignment. Test the exact Ready/Staged build through its
generated URL without promoting it or changing deployment settings. Staged
Production uses shared data: temporary, clearly labelled instruction examples
for Academic Building I may briefly be visible through the live application.
Back up all four lists first, verify no concurrent edits before restoration,
and restore text/order/optional fields while preserving normal audit records.
Previously absent new-table rows require exact guarded owner-run cleanup.
No real walking directions are invented or seeded.

Acceptance includes all four lists, pin/search/Find Route agreement, returns,
destination isolation, mobile/focus behavior, new offline downloads, failed
update retention and a ten-minute staged log watch. Old normal-domain guides
remain intact; actual normal-domain upgrade and post-promotion live checks are
deferred. Stop after staged verification and restoration. Production promotion
requires separate authorization. Access/settings failures, changed remote main,
unexpected schema/data, failed checks/builds or promotion stop publication or
acceptance without bypasses, force pushes or workaround deployments.

Focused fixture probes cover both adapters, access/CSRF/validation, exact
destination resolution, atomic list replacement, read failures, stale editor
responses, text rendering, offline compatibility and retained geometry. Owned
Docker fixtures test actual MySQL HTTP behavior and additive DDL on MySQL and
PostgreSQL. The ordinary port-3000 stack and shared Supabase data are excluded.
External receipts contain actual runs, earlier failures, screenshots and the
final canonical package fingerprint. These are local candidate results, not
Production acceptance or a full shared-database QA pass.

Release execution must recheck repository state, branch rules, deployment
settings, the new table and rollback compatibility before publishing. Leave
the additive table in place if application rollback is later authorized; do
not perform a destructive database rollback. Staged tests do not establish
Production acceptance. A new session grounds, reports actual receipt-backed
state and waits for a focused task.
