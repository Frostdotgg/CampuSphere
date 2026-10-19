# Walking 2D completed release — 2026-10-18

## Scope and status

The owner authorized review, focused tests, feature-branch publication, Preview
validation, and then a Production build and promotion. This record covers that
walking feature, its offline layout/cache fixes, and related release checks.
The release completed October 18 at source `c533719`, deployment
`dpl_94jYqWkHoC19cLKnfooTVEG8SCyU`. Checks below are dated release evidence;
this documentation update does not rerun them.

Development was isolated on `codex/walking-2d-routes`, based on
`87980c5fe03c68b8f59f0b8fbdc263299c2acbce`. Pending October 17 handoff edits in
the original desktop checkout are preserved and excluded from the product release.
Older authority documents retain their historical checkpoint statements; this
focused record does not convert those statements into fresh acceptance evidence.

The release plan began with **1/26** saved walking paths. A fresh SELECT-only
check on October 18 found **2/26**: **test building** (346 m, 288 s) and
**Academic Building I** (75 m, 63 s). Both stored geometries validate and both
destinations are route-ready. No path was drawn, updated, or removed during
these release checks. The remaining paths were administrator work after release. The October 19
Administrator counter subsequently showed **26/26 saved paths, zero missing**;
the owner reports the group finished drawing. Saved coverage does not establish
visual approval of every walkway or exhaustive route traversal.

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
DELETE on that table. After the owner signed in, a SELECT-only database-catalog
check confirmed that `anon` and `authenticated` each have SELECT/INSERT/UPDATE/
DELETE set to false, while `service_role` has all four set to true. That same
query confirmed 2 saved paths and 26 buildings. No SQL migration or grant was
applied by Codex.

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

## Completed Vercel release — October 18 observations

Project `calagrimas-projects/campusphere-cspc` is connected to
`Frostdotgg/CampuSphere`, with Production tracking main. Before release, the
Ready/Current source was `87980c5fe03c68b8f59f0b8fbdc263299c2acbce`.
The recorded rollback deployment is `2mEQ7Z67TcvfSkNoEjh3Lg9KwmZF`, immutable
host `campusphere-cspc-8pgsaerdg-calagrimas-projects.vercel.app`.

Feature commit `9a4a628a84f3333071d4d45ad548d98c4d8223d5` was pushed on
codex/walking-2d-routes. Preview `dpl_5Hjynvrd4a2VV4tyP5ufktMYwE44` built Ready
but returned `500 FUNCTION_INVOCATION_FAILED`: Preview had no project/shared
variables. No Production secrets were copied into Preview.

The owner approved replacing the separate Preview gate with a staged
Production build using existing Production settings. Source
`c5337195a02d358c71c5a421aaf64268755b5d6f` was published normally to main and
built as **`dpl_94jYqWkHoC19cLKnfooTVEG8SCyU`**. Email/password sign-in,
the Administrator editor, Walking entrance/return and Vehicle routes worked
at the temporary address. Google sign-in returned to the canonical site, so
the staged check used the local sign-in form.

Vercel temporary-host protection blocked the offline downloader's
credential-omitting basemap request. The normal website served that map file.
The owner explicitly approved promotion followed immediately by the offline
check, with rollback if blocked. Protection was not disabled. After promotion,
the normal alias `https://campusphere-cspc.vercel.app` was observed **Ready,
Production, Current**, source c533719, and the offline check passed.
The dashboard identity was
[the verified deployment](https://vercel.com/calagrimas-projects/campusphere-cspc/94jYqWkHoC19cLKnfooTVEG8SCyU).

Automatic Production domain assignment was disabled at the October 18 check;
this does not establish current settings. A later Git push can still trigger
a build. The October 19 documentation task does not authorize manual promotion,
deployment, configuration changes or database operations.

## Production smoke and authenticated checks

The bounded anonymous Production smoke passed **16/16**: three exact health
responses, no health cookie, anonymous protected-API denials, protected map
redirect, sign-in page and five committed asset byte matches. The matched
assets were public/sw.js, public/css/styles.css, public/css/offline.css,
public/js/offline-guide-manager.js and public/js/admin/admin-walking-routes.js.
These sampled bytes do not establish complete immutable deployed-byte equality.

The retained smoke checked at `2026-10-18T07:16:48.598Z` recorded these exact
committed-asset matches. This table preserves the dated result; it is not a
fresh download during the documentation review.

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| public/sw.js | 24,091 | `f4a31a7ac2db25f55d2e22c136b7abcbe870a1de99d4620897097ec699616fb7` |
| public/js/offline-guide-manager.js | 65,714 | `67040747d3c04ba7b93ec3ae2074d4bb5f1e2742d485954453748dbd11509aac` |
| public/js/admin/admin-walking-routes.js | 13,626 | `e8633298edaa243142ef2ff5a4f111a4736bce25466d8cd3c811dc5685d3cfdb` |
| public/css/styles.css | 214,505 | `a6f41d4fccee37f395cc21a976b79ae2ad91a4bfef54fd553550b478a00f9034` |
| public/css/offline.css | 14,085 | `fbdeb4fb6c7fdcc0f46de6cc2610b53bba534fe2aa12329e2186bf617a0b4b1e` |

The owner's Administrator session loaded the pilot editor with six intermediate
points; it was canceled without saving. Vehicle entry/return measured 470 m/
350 m. Pilot Walking entrance and reversed return both measured 346 m (online
5 minutes; offline 4–5 minutes). The refreshed guide then contained 26 buildings,
26 Vehicle entrance routes, 26 Vehicle exit routes and 2 walking paths.
Network-disabled offline reload and a 390 px phone selection passed; result
cards were at least 104 px high with no horizontal overflow. Every device must
refresh its downloaded guide to receive the later 26-path coverage.

Some automated online visual captures showed blank canvas after dialog/browser
diagnostic changes. Fresh loads rendered, and the owner confirmed buildings and
roads visible. This limits automated online pixel verification; it is not
evidence that every route was visually approved. The live Leaflet tile limit
and isolated older-guide fixture are recorded above.

## Final logs, limits and handoff

The final recorded deployment log window had **12 Warning rows, 0 Error,
0 Fatal**, including session-store touch timeout retries. Displayed 200/204
responses do not prove each retry's later outcome. This was not a zero-warning
window or proof of permanent provider availability. Historical September
LT-08's three warnings are a separate observation, not this release's count.

No full npm test/qa pass, live MySQL parity, complete OAuth/Admin coverage,
physical-device offline acceptance, exhaustive route/VR traversal, write
capacity, complete immutable deployed-byte equality or institutional adoption
is established. The later 26/26 saved counter does not extend the pilot test
into exhaustive validation. No saved path was changed by Codex during release
checks or this documentation update.

The Docker deployment source is in main and includes Walking 2D. Its tracked
ICTU profile uses external Supabase for data/sessions; saved paths reside there,
not in Git. Rebuilding for the same project can read those paths. A separate
database requires authorized schema/data transfer. No actual ICTU deployment
is established. See `docs/walking-2d-team-guide.md` for drawing/review steps and
`docs/session-handoff-2026-10-19.md` for the next-session handoff.
