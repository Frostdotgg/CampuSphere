# Walking 2D release candidate — 2026-10-18

## Scope and status

The owner authorized review, focused tests, feature-branch publication, Preview
validation, and then a Production build and promotion. This record covers that
walking feature, its offline layout/cache fixes, and related release checks.
Production publication remains gated on the checks below. It has not happened
merely because this file exists or the feature branch is pushed.

Development is isolated on `codex/walking-2d-routes`, based on
`87980c5fe03c68b8f59f0b8fbdc263299c2acbce`. Pending October 17 handoff edits in
the original desktop checkout are preserved and excluded from this candidate.
Older authority documents retain their historical checkpoint statements; this
focused record does not convert those statements into fresh acceptance evidence.

The release plan began with **1/26** saved walking paths. A fresh SELECT-only
check on October 18 found **2/26**: **test building** (346 m, 288 s) and
**Academic Building I** (75 m, 63 s). Both stored geometries validate and both
destinations are route-ready. No path was drawn, updated, or removed during
these release checks. Remaining paths are administrator work after release.

## Reviewed behavior

- Vehicle remains the default mode online and offline.
- Walking starts at latitude `13.405710`, longitude `123.374181`, and ends at
  the existing building pin. A saved path requires at least one intermediate
  waypoint. Endpoints are locked and validated; only `path_geometry` is accepted.
- One authored walking path per route-source building is stored independently
  from vehicle graph edges and Walking VR. Return geometry reverses that path;
  distance and estimated time are identical in both directions.
- Only the selected route is drawn. Walking is dashed blue on entrance and
  dashed red on return. Mode/destination changes invalidate pending responses.
- Signed-in roles can read paths. Editing uses the existing Administrator role,
  CSRF and mutation-rate guards. Walking API responses are private/no-store.
  Audit entries use fixed actions/messages and contain no geometry or request body.
- Mixed-source building IDs resolve through route availability, with unique
  canonical-name and matching-pin checks. Missing or inconsistent paths are
  withheld; no straight-line replacement is published.
- Refreshed guides include walking data. Older vehicle-only guides remain usable
  and request an explicit connected update before walking navigation.
- Offline result cards do not shrink below 104 px. Moving sheets and dialog
  focus restoration avoid scrolling their parent map layout.
- Worker cache is `v52`; shared stylesheet URL is `v13`. IndexedDB holds guide
  data and the basemap; service-worker caches remain shell/static only.

## Migration and database evidence

Sources include `database/supabase/0028_walking_2d_routes.sql`, the separate
MySQL upgrade file `database/0028_walking_2d_routes.mysql.sql`, and the matching
fresh-install table in `database/schema.sql`. Supabase sources are contiguous
through 0028. The owner previously applied 0028; Codex did not apply/reapply SQL.

The non-secret Production `SUPABASE_URL` setting was compared with the local
application target using hostname SHA-256, without displaying credential values.
They match. SELECT-only reads confirm the walking table and the two paths above.
Live PostgREST metadata for the service role advertises GET, POST, PATCH and
DELETE on that table. Source 0028 revokes PUBLIC/anon/authenticated access and
grants service-role CRUD. A fresh database-catalog check of all role grants is
still pending the owner's Supabase dashboard sign-in. Do not describe the
source revocations alone as a fresh live catalog audit.

## Focused verification

All commands below ran against the complete isolated source checkout with
installed dependencies. Tests that exercise writes use only in-memory fixtures;
no canonical regression account is authenticated by the new walking probe.

| Check | Result |
| --- | --- |
| `node scripts/walking2dRoutes-probe.js` | 118/118 |
| `node scripts/offline2dNavigation-probe.js` | 49/49 |
| `node scripts/off2PwaLifecycle-probe.js` | 148/148 |
| `node scripts/publicRoadRouteRendering-probe.js --source-only` | 131 passed, 0 failed; live database legs explicitly not run |
| `node scripts/adminCoordinatePicker-probe.js` | 16 passed |
| `node scripts/adminMapBasemap-probe.js` | 9 passed |
| `node scripts/mapLabels-probe.js` | 20 passed |
| `node scripts/sharedButtonTheme-probe.js` | 19/19 |
| `node scripts/offlineMapRelease-probe.js` | 21/21 |
| `node scripts/vercelPackageBoundary-probe.js` | 75/75 |
| `npm audit --omit=dev` | 0 vulnerabilities after the reviewed patch below |
| Syntax and scoped whitespace checks | Passed |

The walking probe covers endpoint/waypoint validation, independent fixture
metrics, return geometry, missing/invalid destinations, mixed identities,
backend failures, real route authorization/CSRF, safe audits, and save/reload/
update/removal through both backend adapters. It also executes renderer helpers
and the older-guide validator against isolated fixtures.

Browser observations on Docker localhost: Vehicle default; walking entrance
and return for test building; disabled walking actions for Library Building;
mode switching; updated guide with two walking paths; disconnected offline
reload; entrance/return dialogs; 390 px phone controls/list spacing. An isolated
older-guide browser fixture retained vehicle navigation and displayed the walking
update request with disabled walking actions. No shared data was written.

The Leaflet browser leg encountered unavailable external OSM tiles and entered
the existing readable fallback. Its route drawing helper passes fixture tests;
successful live Leaflet tile rendering is **not** claimed. MapLibre remains the
configured local and Production renderer. Docker was restored to MapLibre after
the alternate-renderer check.

The first offline run exposed stale source assertions and Windows-converted
vendor bytes. Assertions now cover the new controls and focus behavior; rejecting
fixtures remain active. Vendor bytes reproduce their existing provenance hashes.
`.gitattributes` keeps runtime text consistent and bundled vendor bytes exact.
The Leaflet license's committed bytes now match its existing upstream manifest.
The bounded server harness polls the pre-session `/healthz` route, avoiding
absolute favicon dotfile rejection inside the hidden worktree.

A dependency audit found pre-existing `proxy-addr` 2.0.7 affected by
[GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h).
Only that transitive package was updated to 2.0.8 in the lockfile. The patched
subnet behavior and the application's numeric proxy-hop behavior were checked.

No full `npm test`/`npm run qa` pass, live MySQL parity, physical-device offline
acceptance, or exhaustive traversal is claimed. Historical MySQL/VR failures
remain historical; focused checks do not repair or supersede them.

## Package identity

The reviewed runtime upload allowlist includes all four new runtime files:
the walking controller, service, repository, and administrator editor. Schema,
scripts, docs, screenshots, local artifacts, and secret files remain excluded.

- Files: **213**
- Bytes: **8,755,240**
- Aggregate SHA-256: `55bd59fb311569ef55a137f1d6bcbe9e56844dc4cf607555af12f54740a49990`

This is the source package identity, not proof of immutable deployed-byte equality.

## Vercel checkpoint and remaining release gate

Observed October 18 in project `calagrimas-projects/campusphere-cspc`:

- Connected repository: `Frostdotgg/CampuSphere`.
- Current Production is Ready, serves `campusphere-cspc.vercel.app`, and shows
  source `87980c5fe03c68b8f59f0b8fbdc263299c2acbce` on `main`.
- Rollback target: dashboard deployment
  `2mEQ7Z67TcvfSkNoEjh3Lg9KwmZF`, immutable host
  `campusphere-cspc-8pgsaerdg-calagrimas-projects.vercel.app`.
- Production tracks `main`; automatic domain assignment is disabled. A new
  Production build needs manual promotion after its checks pass.
- Preview tracks all unassigned branches. **Preview has no project variables
  and no linked shared variables.** The owner must configure its own approved
  test backend/session/rate-limit settings. Production secrets must not be copied.

Do not publish to `main` or promote while Preview configuration or the required
database verification remains unresolved. After Preview passes, recheck remote
`main`, integrate newer source if any, validate, publish by normal fast-forward
or the required PR process, and build the exact candidate with Production settings.
Verify health, sign-in, Administrator editor, pilot entry/return, vehicle routes,
refreshed offline guide and deployment logs before assigning the alias. Roll back
to the target above if a blocking regression appears; preserve walking-path data.
Record exact final source and deployment identity after those steps actually run.

Drawing instructions and the current remaining list are in
`docs/walking-2d-team-guide.md`. Every device needs a connected, signed-in guide
refresh after additional paths are saved.
