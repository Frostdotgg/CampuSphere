# Room-scheduling removal release — 2026-10-20

## Release execution

The owner approved reviewing, testing, committing, pushing and deploying this
removal on October 20. The October 19 uncommitted-candidate sections are the
earlier local checkpoint. Publication is pending at this record's preparation;
no successful deployment is claimed by the preparation checks below.

The release target is `https://campusphere-cspc.vercel.app`, project
`calagrimas-projects/campusphere-cspc`, connected to `Frostdotgg/CampuSphere`.
The live rollback target was independently observed Ready on October 20:
`dpl_94jYqWkHoC19cLKnfooTVEG8SCyU`, source
`c5337195a02d358c71c5a421aaf64268755b5d6f`. Production tracks main, automatic
domain assignment is disabled, and Standard Protection remains enabled. No
vendor configuration or secret value was changed.

## Fresh pre-publication evidence

- Backed up all 85 pending paths outside Git, including fingerprints/backups
  for 23 protected local files and 29 unchanged schema/migration sources.
  Remote main and the candidate's original HEAD matched `0af76f1` before review.
- Retired API, role, CSRF, supported-hotspot, audit and preserved-details
  fixtures: **401/401**. Shared hotspot navigation/Guest policy: **140/140**.
- Walking: **118/118**; offline navigation **49/49**; PWA lifecycle **148/148**;
  Vehicle rendering **131 source checks**; building details **112 source/DOM
  checks**. Their live database legs were not run.
- Coordinate picker **16**, Admin basemap **9**, map labels **20**, shared
  buttons **19/19**, media **42/42**, graph search **9/9**, offline release
  **21/21**, Production startup profile **116/116**, session bootstrap
  **121/121**, session resilience **21/21**, shared rate limiting **180/180**.
- Disposable MySQL 8/PostgreSQL 17 cleanup and exact restoration: **28/28**.
  Only disposable fixtures were changed; the owned containers were removed.
- Isolated documentation gate **595/595**, with server, database, credential
  and network operations blocked. JavaScript syntax and whitespace checks pass.
- Production dependency audit: **0 vulnerabilities** in the locked local tree.
- Package boundary **75/75**. The runtime package remains **201 files,
  8,577,707 bytes**, aggregate SHA-256
  `6c20279df6b9297f7859d1b0d01f72f15d863937c7816695919cf269924fe709`.
  Staged Git bytes must reproduce that inventory before committing.
- The staged-byte check exposed the old Git copy of Leaflet CSS using LF while
  its reviewed upstream inventory requires CRLF. Re-staging that exact pinned
  vendor original restores its provenance and preserves the 201-file package
  identity above. The staged-package check then passed **75/75**. Local HTTP
  smoke passed **20/20**; its text comparison normalizes Windows line endings.
  Production comparisons require exact committed bytes.

Read-only comparison of the public database project hostname confirmed that
Vercel Production and Docker use the same Supabase project. Fresh counts were
1,469 hotspots, zero Schedule types, 69 schedule-image entries, two legacy
schedule entries, 26 buildings and 26 walking paths. All 73 converted markers
across 65 scenes passed the seven application read-back checks: Info type,
preserved names/positions, Student/Instructor/Admin visibility, Guest privacy
and omission of retired metadata from Admin responses.

The rebuilt Docker app retained the signed-in Administrator session. Browser
checks confirmed CSLAB's Info type, label, yaw 50, pitch -10 and private Guest
flag; the editor was closed without saving. A real Free Roam panorama loaded
with no captured console errors. Floor/room descriptions and panorama previews
remain available. Walking and Vehicle entrance/return results, mode clearing,
Guided VR, an existing downloaded guide through a disconnected reload, and a
390 px offline details panel were checked. The existing two-path guide was
then explicitly refreshed to 26 walking paths. Synthetic fixtures cover older
vehicle-only guides. These are representative browser checks, not exhaustive
route/panorama traversal or physical-device acceptance.

## Publication and rollback requirements

Publish the reviewed feature branch and main normally, build that exact main
commit as staged Production, and complete authenticated staged checks before
promotion. Keep secrets and deployment protection unchanged. A temporary-host
protection restriction on the offline download is checked on the normal domain
immediately after promotion, with rollback for a blocking failure. Check logs
throughout and for ten minutes after the switch; preserve warning evidence.
Record the actual source/deployment identities and post-promotion observations
after the operation. A Ready build alone is not acceptance.

No full `npm test` or `npm run qa` pass is claimed. Earlier incomplete harness
runs, live MySQL parity, exhaustive VR/route verification and complete OAuth
acceptance remain outside this evidence. The historical October 18 log window
had 12 Warning rows, zero Error and zero Fatal; its retry outcomes were not
fully established and it is not a fresh zero-warning result.

An additional full R6 browser-dependency harness attempt passed its vendor
inventory/provenance assertions, then stopped before its MySQL listener became
ready because the sanitized test process had no session-database configuration.
No shared credentials were supplied and no full R6 pass is claimed. The required
release package/static-CDN checks use the independent database-free R7 runner
and passed against staged Git bytes. Actual browser media checks are recorded
separately above.

The 73-marker operation is completed history. This release does not delete
schedule entries, clear saved metadata, apply SQL/migrations, delete hosted
images or deploy ICTU. Cleanup/restore instructions remain in
`docs/room-scheduling-removal.md`. All private backups, screenshots and detailed
logs are outside Git in the owner's October 20 release evidence directory.
