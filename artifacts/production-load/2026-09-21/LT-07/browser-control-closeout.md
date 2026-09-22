# LT-07 browser-control closeout

- Date: 2026-09-21 (Asia/Manila)
- Target: canonical CampuSphere Production alias
- Evidence class: bounded real-Chrome application UAT
- Authentication: existing signed-in school-account Chrome profile
- Isolation: separate LT-07 tab; the pre-existing dashboard tab was left open
  and untouched

## Downloaded package

- Schema: `campusphere.offline-guide/1`
- Buildings: 25
- Main Gate entry routes: 25
- Main Gate exit routes: 25
- PMTiles Blob: 617,076 bytes
- Active service-worker control: PASS
- Cached `/offline.html` shell: PASS

## Offline recovery

Chrome network emulation was set to offline for the LT-07 tab. The page was
reloaded at each responsive size below.

| Profile | Viewport | `navigator.onLine` | Page | Building controls | MapLibre canvas |
| --- | --- | --- | --- | --- | --- |
| Phone | 390x844 | `false` | `/offline.html` | PASS | PASS |
| Tablet | 820x1180 | `false` | `/offline.html` | PASS | PASS |
| Desktop | 1440x900 | `false` | `/offline.html` | PASS | PASS |

The desktop interaction also passed these checks:

- downloaded building information opens;
- saved Main Gate entry route renders; and
- saved exit route to the Main Gate renders.

## Reconnection and exclusion boundary

- The LT-07 tab was restored online.
- **Update Offline Map** returned **Offline map is already up to date**.
- The final stored guide still contained 25 buildings, 25 entry routes, 25 exit
  routes, and the 617,076-byte PMTiles Blob.
- Serialized guide data contained no Cloudinary, panorama, VR, or scene
  reference.
- Free Roam remained visibly disabled and labeled online-only.
- The Chrome tab was left online at the end of the check.

## Result and limits

**PASS** for the bounded real-Chrome offline/reconnect application path across
three responsive sizes. This is one Chrome profile and one authenticated
account, not three physical devices, three isolated browser-storage profiles,
or three accounts. The visible screenshot was delivered in the owner session
and is not duplicated in this repository artifact.

The k6 run under `run-124016186` is rejected diagnostic evidence because its
offline browser processes became unreadable after `setOffline(true)`. It is not
the LT-07 application verdict.
