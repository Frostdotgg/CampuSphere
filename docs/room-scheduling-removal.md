# Room scheduling removal — release and cleanup runbook

Last updated: 2026-10-20 (Asia/Manila)

October 20 publication follow-up: the owner separately authorized release
testing, commit/push and staged Production deployment. Fresh evidence and the
publication record are in `docs/room-scheduling-release-2026-10-20.md`. The
October 19 candidate/authorization statements below describe that earlier
checkpoint; saved-data deletion remains excluded from the release.

## Current release status

Product commit b39d08cf2536cafc5d965adba0803e743425a698 was published and
verified on October 20 as dpl_FKR7rgR6QPbsBJp1PXcdKrVroiha. The normal website
passed the immediate offline download and disconnected-reload check. See the
October 20 release record for bounded evidence and the later documentation-only
handoff. No schedule entries were deleted and no migration was applied.

## Historical local candidate status (October 19)

This is the uncommitted, not deployed candidate on `codex/remove-room-scheduling`,
based on `0af76f161443f8259858f4fa67116bc12f51321e`. The original removal task authorized local
implementation and focused testing. The owner later explicitly approved the
73-marker saved-data conversion recorded below. No commit, push, deployment,
environment change or full schedule-data cleanup has occurred; that one-time
conversion authorization is complete.

Scheduling is retired everywhere: Administrator editing, building schedule
images, legacy schedule APIs and schedule hotspots in Free Roam/Guided VR.
Floor and room descriptions remain. Scene, exit and information hotspots retain
their role rules; Guests still need explicit approval for information hotspots.
Building/panorama previews, Walking/Vehicle routes, accounts and audit history
are preserved. External Cloudinary/Drive assets are not deleted.

The owner's follow-up changes the cleanup choice: **reuse the schedule markers
as Info hotspots instead of deleting them**. Their IDs, scenes, yaw/pitch and
display order remain. Names come from the linked document's room/facility,
then legacy room metadata, then the existing label. Info text contains only
room/floor identity; old schedule prompts, image links and references are
removed. Converted markers default to `guest_visible=false`; Administrators
may approve them for Guests later. Existing ordinary Info approvals remain.
The local removal code hides any old schedule types that remain. The separate
owner-approved type-only conversion below has now handled the 73 saved markers.
Full cleanup and deletion of saved schedule entries remain later owner steps.

The old public API families `/api/buildings/:id/schedules`,
`/api/buildings/:id/room-schedule-documents`, `/api/room-schedule-documents/:id`
and Administrator `/admin/api/schedules` and `/admin/api/room-schedule-documents`
(including item paths and writes) are retired. Authorized requests receive the
standard JSON 404. Login, Administrator role and CSRF checks still run in their
existing order. Schedule hotspot types and `schedule_*` request fields are
rejected; stored schedule hotspots/metadata are withheld before owner cleanup.

Both schedule tables and nullable hotspot fields remain in the schema. Source
migrations 0001–0028 are unchanged. A small same-backend reference check blocks
building deletion with a safe 409 while old records remain. The retired runtime
switch is removed from source templates; actual environment files are untouched.
Maintenance sync plans containing schedule content fail before writes; clean
non-schedule plans remain supported. Do not run those tools against live data
as part of this task.

The service worker advances to v53; shared stylesheet stays v13. Schedules were
already excluded from downloaded guides, so there is no guide-format change.
Existing guides remain usable; additional Walking paths still require an explicit
connected update on each device. This does not refresh Production or ICTU.


## Completed saved-marker conversion (2026-10-19)

The owner explicitly approved converting the 73 saved markers in the Supabase
database configured by the running Docker app. The operation completed at
20:23:09 Asia/Manila (12:23:09 UTC). Before writing, all hotspot rows and both
schedule tables were backed up outside Git, fingerprinted, and accompanied by
type/Guest-flag restore SQL. A fresh read confirmed the backup still matched.

One bounded update changed only `hotspot_type` to `info` and retained
`guest_visible=false` for those exact 73 IDs. All 73 already had false Guest
flags. Labels, text, scenes, coordinates, order, timestamps and schedule
references were left unchanged. No marker, schedule entry or hosted image was
deleted. The pending full cleanup remains separate and must use a fresh backup.

Post-write database verification passed **6/6**: correct target, exactly 73
updates, zero remaining Schedule types, exact expected hotspot snapshot,
unchanged image entries and unchanged legacy entries. Total hotspots remain
**1,469**, image entries **69**, and legacy entries **2**.

A separate read through the running application's VR repository checked all
**73 markers across 65 scenes**. All **7** checks passed: Info type, preserved
names/positions, Student/Instructor/Administrator visibility, Guest privacy and
omission of schedule metadata from Administrator responses. The signed-in
Chrome editor also displayed CSLAB as `info — show text`, with its original
yaw 50, pitch -10 and order 0; its Free Roam page displayed INFO CSLAB. The edit
form was closed without saving. This is a representative browser check and a
complete 73-marker data check, not exhaustive panorama traversal.
The real panorama finished loading, and the browser reported zero captured
console errors during that check. The removal regression was rerun afterward
with 401/401 passing, alongside 140/140 shared hotspot-navigation checks.

Private evidence is in the owner's external backup folder named
`saved-hotspot-conversion-2026-10-19T12-22-50-142Z`: `before.json`,
`manifest.json`, `restore-types.sql`, `write-result.json`, `after.json`,
`verification.json`, `application-readback.json` and the CSLAB screenshot.
Do not copy backups, URLs or credentials into Git or a runtime package. This
completed data operation does not publish the uncommitted application candidate,
prove another deployment's configuration, or authorize further database writes.

## Owner-controlled backup, cleanup and restoration

These steps are for a later database-owner operation, after the retired app is
published and verified. They do not run during installation or server startup.
Use a maintenance window and stop old application deployments and sync writers.

1. Verify the exact project/host and database separately for Supabase/PostgreSQL
   and MySQL. `postgres` alone does not identify a Supabase project. Record the
   target and pre-cleanup counts/fingerprints for unrelated buildings/details,
   routes/Walking paths, VR scenes, ordinary hotspots, accounts, sessions and logs.
   Record the total hotspot count and every schedule marker's ID, scene,
   yaw/pitch and order. Review the proposed room names, including any fallback
   labels, before applying the conversion.
2. Prepare the read-only export query with
   `node database/maintenance/prepare-room-schedule-restore.js --backup-query postgres`
   (or `mysql`). The program prints SQL only and never connects to a database.
   The owner executes the query and exports its single `schedule_backup` object
   as plain JSON outside the checkout. It includes both complete schedule tables
   and the hotspot rows needed to preserve IDs, relationships and metadata.
   Do not save a result-grid wrapper instead of the object, and do not truncate
   the result. Keep the backup protected; it contains saved content and URLs.
3. Fingerprint the backup and prepare restore SQL **before deleting anything**:
   `node database/maintenance/prepare-room-schedule-restore.js ABSOLUTE_BACKUP_JSON ABSOLUTE_NEW_RESTORE_SQL`.
   Both paths must be outside the repository. Existing output is never overwritten.
   The offline converter validates the schema and refuses incomplete/unknown
   fields or unsafe numeric IDs. Large IDs must be exported as strings.
   Rehearse the backup/restore on a disposable copy before a live cleanup.
4. In the same owner-controlled SQL connection, set the expected database and
   confirmation below, then execute the matching cleanup file. Use psql with
   `ON_ERROR_STOP=1`, or mysql batch mode **without `--force`**. Stop on any error.

PostgreSQL settings, followed by `database/maintenance/remove-room-schedules.postgres.sql`:

```sql
SET campusphere.cleanup_database = 'the exact verified database name';
SET campusphere.cleanup_confirmation = 'BACKUP_VERIFIED_REMOVE_ROOM_SCHEDULES';
```

MySQL settings, followed by `database/maintenance/remove-room-schedules.mysql.sql`:

```sql
SET @campusphere_cleanup_database = 'the exact verified database name';
SET @campusphere_cleanup_confirmation = 'BACKUP_VERIFIED_REMOVE_ROOM_SCHEDULES';
```

The scripts use transactions, convert schedule hotspots to private Info markers,
clear five schedule reference fields on every hotspot, then delete image and
legacy schedule entries. No placed hotspot is deleted or needs replotting.
They keep all persistent tables, columns, grants and migration sources. They do
not reset IDs, disable foreign keys, use CASCADE, delete audit logs or call an
external image provider. Missing confirmation or a different database fails closed.

5. Verify zero rows in `room_schedules` and `room_schedule_documents`; zero
   schedule hotspots; and all five remaining `schedule_*` reference fields NULL.
   Verify the total hotspot count is unchanged and every converted marker keeps
   its ID, scene, yaw/pitch and order, has its room name, and is private Info.
   Compare the protected data with the pre-cleanup fingerprints and smoke-test
   building details, Walking/Vehicle navigation and both VR viewers. Record each
   backend separately; a Supabase cleanup says nothing about MySQL.
6. If rollback is required, keep writers stopped, confirm the target and inspect
   the generated restore SQL. It requires empty schedule tables, inserts their
   original rows, restores former schedule markers in place, and restores only
   schedule metadata/timestamps on ordinary hotspots. It refuses a converted
   marker that is missing or has changed since cleanup. It does not overwrite
   ordinary hotspot labels, links or positions. Stop on a target/ID conflict; do not use
   force, replace/upsert or delete unrelated rows to make it pass. Verify the
   restored snapshot and protected-data fingerprints before resuming writers.

Backups/restore SQL, screenshots and local test logs must remain outside Git and
the Vercel package. The owner must not paste credentials or private backup data
into handoff documents.

## Local verification and limitations

- Removal HTTP/EJS fixtures: **401/401**, covering both adapter modes and all
  four roles, retired API families, CSRF, supported hotspot editing and safe audits.
- Disposable MySQL 8 and PostgreSQL 17 cleanup/restore: **28/28**. Both formats
  export complete backups; missing confirmation and wrong targets fail closed.
  Document-linked, legacy and label-only markers convert to private Info with
  preserved positions, including quoted/dollar-tag labels. Repeated cleanup,
  changed-marker restore refusal, exact restoration and unrelated-data
  preservation passed. Containers used no host ports, bind mounts or external
  network and were removed after testing.
- Walking 2D regression: **118/118**, fixture-only, no live database writes.
- Other focused checks: offline navigation **49/49**, PWA lifecycle **148/148**,
  Vehicle rendering **131 source checks**, coordinate picker **16**, admin basemap
  **9**, map labels **20**, shared buttons **19/19**, Google Drive/media **42/42**,
  building-details editor **112 source/DOM checks**, graph search **9/9**,
  offline-map release **21/21**, and Vercel startup profile **116/116**. The last
  check retains all active startup/security requirements while ignoring the
  retired schedule setting. No vendor settings were changed.
- Shared Guided/Free-Roam hotspot navigation and Guest policy: **140/140**.
- Isolated documentation validation: **595/595**, building-delete transaction
  assertions **9/9**, supported Admin VR UX **12/12**, retirement runbook **2/2**. The validation loader
  blocks servers, databases, credentials and network operations.
- Browser fixtures used synthetic roles/data on localhost. Desktop and 390 px
  layouts retained building room descriptions, previews, Free Roam/Guided VR
  fallback controls and Guest filtering without schedule controls. A downloaded
  guide survived a network-blocked reload, with Walking entrance/return and
  Vehicle controls available. Older-guide compatibility/update prompts are
  covered by the focused offline fixtures. Panorama images were not configured
  in the browser fixture; this is not real panorama traversal or physical-device
  acceptance. Inline visual inspection was possible; no screenshot artifact is
  included in Git.

Two earlier legacy full harness attempts (Free Roam and building-details editor)
completed their local MySQL legs, then stopped because Supabase regression
credentials were not configured. They are **not accepted full harness passes**.
The building-details leg removed its own temporary fixtures, confirmed the
original 25-building local roster, and logged out its test session; Free Roam's
session was also closed. No shared schedule data was cleaned. The final new
removal fixtures and building-details source-only run do not require those
credentials. No full npm test/qa pass, live MySQL parity, complete OAuth
acceptance, physical-device acceptance or exhaustive route/VR traversal is
claimed. The October 18 Production release remains historical evidence and is
not acceptance for this candidate.

Syntax checks passed for 34 changed/new JavaScript files. Raw fingerprints
confirmed 23 protected local files and all 29 schema/migration sources unchanged;
26 historical standalone grounding prompts remain verbatim after line-ending
normalization. The eleven current summaries remain synchronized. Whitespace,
UTF-8 and documentation secret-pattern checks passed. No actual environment
file was edited; the Git index remains empty and HEAD remains `0af76f1`.

## Runtime source package

The local candidate package is **201 files, 8,577,707 bytes**, aggregate SHA-256
`6c20279df6b9297f7859d1b0d01f72f15d863937c7816695919cf269924fe709`.
The package boundary probe passed **75/75** against an external snapshot whose
text bytes were independently checked against Git clean-filter blob identities;
vendor binary/text attributes were preserved. This avoids Windows line-ending
false alarms without staging files. Retired browser/runtime files are absent;
the compatibility helper is included. Backups, database scripts, test logs,
screenshots, documents and actual secrets remain outside the runtime package.
This is local source-package evidence, not a build, deployment or deployed-byte
claim. The previous Walking release's 213-file package is historical.

## Handoff

Review the local diff and test results before a later owner-selected publication
task. GitHub push, Vercel promotion, ICTU deployment and live cleanup require
their own scope. Preserve local documents and one writer per scope. Use the
current role prompt for a fresh read-only grounding turn; do not inherit old
release permissions.
