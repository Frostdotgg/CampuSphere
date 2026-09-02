# Offline CSPC map refresh

Current handoff note (2026-09-02): the read-coalescing, load-evidence, and
freeze-refresh commits do not change the offline publisher, bounds, release
center, opening camera, Drive workflow, IndexedDB activation, or
user-controlled update model. The service-worker shell remains `v36`; that
cache revision does not change the PMTiles release rectangle or publisher.
The current full source package is 190 files, 7,227,736 bytes, aggregate
SHA-256 `8099a1a323c7cef0175dd85294c5ff38f654b6245f9cd09380e12af1549a2f3e`
with package boundary `74/74`. Keep this current full-package evidence separate
from the historical offline-specific `c4de5ab` package evidence below. GitHub
`main` contained `7f4bfce` before the September 2 authority synchronization,
but Vercel deployment/Ready state, promotion, Production smoke, and immutable
deployed bytes for that commit remain unverified.

This feature keeps the offline map package explicit and user-controlled while
allowing the package to be rebuilt daily from the newest available Protomaps
OpenStreetMap build.

## Runtime behavior

1. The publisher -- `.github/workflows/offline-map-refresh.yml` running
   `scripts/publishOfflineMapRelease.js`, not a person -- checks the latest daily
   Protomaps archive on its `30 18 * * *` schedule or by an explicit manual
   dispatch.
2. The publisher copies the PMTiles that intersect the fixed CSPC rectangle
   through the checksum-pinned `go-pmtiles` CLI, verifies PMTiles structure,
   size, hash, and required layers, then uploads a content-addressed archive to
   a dedicated Google Drive folder. Because whole edge tiles are copied, normal
   map content just outside the exact rectangle can remain in the archive.
3. The archive is made public-read-only and downloaded anonymously once for
   verification. Only then does the job replace the small signed manifest
   pointer. The previous pointer is restored if the public verification fails.
4. When a signed-in user clicks **Download Offline Map** while connected, the
   app obtains that manifest, compares its fingerprint with IndexedDB, and
   downloads/replaces the package atomically only when it changed. A guide-only
   change reuses the existing map Blob; a changed map archive is hash-checked
   before activation.
5. MapLibre reads the activated PMTiles archive while offline. The service
   worker does not cache the manifest, API, or PMTiles implicitly.

The exact code-order rectangle is
`[west, south, east, north] = [123.373606, 13.404852, 123.378745, 13.406981]`.
Its release-manifest center is
`[longitude, latitude] = [123.375604, 13.405885]`. In the
latitude/longitude order normally shown to users, the southwest corner is
`13.404852, 123.373606`, the northeast corner is
`13.406981, 123.378745`, and the release center is
`13.405885, 123.375604`.

The opening camera is independent of that release metadata. Its code-order
target is `[longitude, latitude] = [123.374590, 13.405872]` (user order
`13.405872, 123.374590`). MapLibre opens at zoom `16.5`, bearing `0`,
pitch `0`, minimum zoom `12`, and maximum zoom `19`. The recenter control
continues to use the offline guide's route origin. Commit `c4de5ab` advanced
the service-worker shell cache to `v34` so a stale camera script was replaced;
the later current product batch advances the shell cache to `v36` without
changing the offline camera or release metadata.

The archive is a whole bounded campus basemap, not an OSM-to-CampuSphere data
import. A new CSPC building footprint in the selected OSM snapshot becomes a
visual offline building polygon after the next successful release and user
update. It does not create a CampuSphere building record, route, VR link,
schedule, or administrator record automatically. OSM publication and the
Protomaps daily build can introduce normal upstream timing, so “within 24
hours” is an operational target rather than a promise about the instant an OSM
edit is saved.

Supabase/PostgreSQL remains the source of real Production CampuSphere building
records, markers, routes, VR links, and schedule relationships. MySQL remains
the local-development, fallback, and rehearsal store. Protomaps/OpenStreetMap
supplies only the visual basemap polygons used by this offline package.

The current phase changes only this offline-map path. VR panoramas and room
schedules remain on their existing Cloudinary delivery path and are not put in
IndexedDB. A future Drive-media migration is a separate design and capacity
decision.

## Drive boundary

The one-time `bootstrap` dispatch creates a dedicated folder and empty stable
manifest with the publisher's `drive.file` authorization. The owner has
observed that bootstrap and a later release succeed and that Drive contains the
stable manifest, a content-addressed release manifest, and its PMTiles archive.
Do not repeat bootstrap or use rollback without a new explicit owner decision.
The publisher shares only the generated PMTiles files and stable manifest as
public/read-only and remains the only writer. CampuSphere Production receives
only:

- `OFFLINE_MAP_RELEASE_MODE=drive`
- `OFFLINE_MAP_PUBLIC_MANIFEST_URL`
- `OFFLINE_MAP_SIGNING_PUBLIC_KEY`

The Drive OAuth client ID/secret, refresh token, folder ID, manifest file ID,
and Ed25519 private key belong only in GitHub Actions secrets. They must not be
placed in `.env.example`, Vercel source, browser code, logs, or the repository.
The checked-in bundled baseline remains a local/fallback mode. The owner has
observed the three public runtime variables configured for Production and a
Vercel deployment for `c4de5ab` marked Ready. Never place any actual URL,
identifier, OAuth value, or PEM key material in this document.

Required GitHub Actions secrets are:

`OFFLINE_MAP_DRIVE_FOLDER_ID`, `OFFLINE_MAP_DRIVE_MANIFEST_FILE_ID`,
`OFFLINE_MAP_PUBLIC_MANIFEST_URL`, `OFFLINE_MAP_GOOGLE_CLIENT_ID`,
`OFFLINE_MAP_GOOGLE_CLIENT_SECRET`, `OFFLINE_MAP_GOOGLE_REFRESH_TOKEN`, and
`OFFLINE_MAP_SIGNING_PRIVATE_KEY`.

`OFFLINE_MAP_DRIVE_PARENT_ID` is optional and is used only by the bootstrap
dispatch when the new folder should be created under a particular parent.

For first-time setup, the owner creates a separate Google OAuth client with the
narrow Drive file scope, stores its client values and refresh token in GitHub,
generates an Ed25519 key pair out-of-band, and dispatches the workflow with
`bootstrap=true`. The workflow prints the two new file IDs once; save them as
the corresponding GitHub secrets and construct the stable public manifest URL
from the manifest ID. Configure only the public key and URL in the app, then
separately authorize the production environment variables before switching the
runtime mode to `drive`.

The publisher retains the newest seven content-addressed releases and their
private sidecar records. `workflow_dispatch` can roll back to one of those
recorded versions by its 64-hex version. There is no per-user Drive token in
the web app.

Google’s personal-account storage is shared with Gmail and Photos, and Drive
API requests are subject to rate/egress quotas. This map is intentionally small
and low-frequency; future high-volume media must be evaluated separately.

## Current verification boundary

The database-free focused offline contract passes `21/21`. The historical
`c4de5ab` Vercel package-boundary probe passed `74/74` and reports 188 files, 7,242,957
bytes, aggregate SHA-256
`6790308c8cd157425a551c1bb910b3e2d3b899bc3515b0904154b99b918d35af`.
These are source/package results, not immutable deployed-byte proof.

The owner has also observed a successful post-`c4de5ab` workflow publication,
the expected Drive files, Vercel Ready/Production status for `c4de5ab`, and a
hard-refreshed Production `/offline.html` opening at the intended Main Gate
view, matching localhost. Earlier owner-observed network-emulation testing kept
the downloaded map rendered while Chrome was Offline. That is owner-observed
functional acceptance, not independent deployed-byte proof. No actual newly
added OSM building has yet been observed through the complete
upstream-to-offline path.

A temporary local synthetic fixture confirmed the exact archive bounds and
retained an inside test building. It also retained an outside test building on
the same edge tile because the publisher copies whole intersecting tiles. The
client accepts outside-campus buildings and the rectangle as accurate enough,
so strict polygon clipping is not a requirement. The temporary helper was
removed and is not part of the `21/21` gate.

## Local/source checks

The publisher is a CI-only script and is excluded from the Vercel package. It
requires a locally installed `pmtiles` binary and all Drive/Google secrets, so
it is not run as part of ordinary local development. The database-free focused
contract is:

```text
npm run qa:offline-map
```

That contract exercises manifest signing/validation, host and size boundaries,
asset identity, and the source-only wiring without contacting Drive, OSM,
databases, or a running server.
