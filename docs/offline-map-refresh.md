# Offline CSPC map refresh

This feature keeps the offline map package explicit and user-controlled while
allowing the package to be rebuilt daily from the newest available Protomaps
OpenStreetMap build.

## Runtime behavior

1. A scheduled GitHub Actions job checks the latest daily Protomaps archive.
2. The job extracts only the fixed CSPC bounding box through the pinned
   `go-pmtiles` CLI, verifies PMTiles structure, size, hash, and required layers,
   then uploads a content-addressed archive to a dedicated Google Drive folder.
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

The archive is a whole bounded campus basemap, not an OSM-to-CampuSphere data
import. A new CSPC building footprint in the selected OSM snapshot becomes a
visual offline building polygon after the next successful release and user
update. It does not create a CampuSphere building record, route, VR link,
schedule, or administrator record automatically. OSM publication and the
Protomaps daily build can introduce normal upstream timing, so “within 24
hours” is an operational target rather than a promise about the instant an OSM
edit is saved.

The current phase changes only this offline-map path. VR panoramas and room
schedules remain on their existing Cloudinary delivery path and are not put in
IndexedDB. A future Drive-media migration is a separate design and capacity
decision.

## Drive boundary

Use the workflow's one-time `bootstrap` dispatch to create a dedicated folder
and empty stable manifest with the publisher's `drive.file` authorization. The
publisher then shares only the generated PMTiles files and the stable manifest
as public/read-only. The publisher is the only writer. CampuSphere production
receives only:

- `OFFLINE_MAP_RELEASE_MODE=drive`
- the public stable manifest URL
- the Ed25519 public key

The Drive OAuth client ID/secret, refresh token, folder ID, manifest file ID,
and Ed25519 private key belong only in GitHub Actions secrets. They must not be
placed in `.env.example`, Vercel source, browser code, logs, or the repository.
The existing default `OFFLINE_MAP_RELEASE_MODE=bundled` keeps the checked-in
baseline available until the owner completes this setup and separately
authorizes deployment configuration.

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
