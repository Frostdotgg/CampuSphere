# Production LT-01

LT-01 is a one-user authenticated browser baseline for the Production map.
It is deliberately separate from the historical root-level local-only load
scripts.

From the repository root, run:

```powershell
.\scripts\run-production-lt01.ps1
```

The runner requires the operator to type `RUN-LT-01`, then enter the dedicated
guest test credentials into masked prompts. The password is passed only to the
child k6 process and is never written to the repository or evidence files.
An already signed-in Chrome tab is not reused: k6 launches its own clean
browser context, so use the dedicated test account at the prompts rather than
copying a session cookie.

The run performs one real browser login, opens `/map`, checks the rendered map
surface (MapLibre, Leaflet, or the app fallback), Guard House start label,
building labels, and route controls, captures the map page, and logs out through
the normal UI. It also enables k6's official web dashboard and saves the raw
dashboard export.

Evidence is written to:

```text
artifacts/production-load/YYYY-MM-DD/LT-01/
```

The directory contains the unedited k6 transcript, k6 summary JSON, official
k6 dashboard HTML, a PNG screenshot of that dashboard, the map screenshot, and
SHA-256 hashes. The dashboard screenshot is generated from the k6 export; it is
not a hand-authored results page.

## Production LT-02

LT-02 measures 50 concurrent authenticated browser clients browsing the map.
It performs one setup login with the dedicated guest test account, then copies
that one authenticated session cookie into 50 isolated browser contexts. This
avoids intentionally tripping the Production login limiter while keeping the
map requests real. It is a map-concurrency test, not a test of 50 distinct
accounts; do not use a personal account.

The map's advisory presence heartbeat is fulfilled locally by the k6 browser
route because 50 copies of one identity would intentionally hit the normal
presence limiter. The application and its limiter are not changed, and all
other map/document/API/static requests go to real Production. Presence has a
separate bounded test.

From the repository root, run:

```powershell
.\scripts\run-production-lt02.ps1
```

Type `RUN-LT-02` at the confirmation prompt. The runner saves each LT-02 run
under a timestamped directory below
`artifacts/production-load/YYYY-MM-DD/LT-02/` and refuses non-Production hosts.
It captures one representative map screenshot plus the full k6 dashboard,
transcript, sanitized summary, metadata, and hashes. The summary deliberately
omits k6 setup data so the temporary session cookie cannot enter the evidence.
The one shared test session is terminated during k6 teardown. This test is
deliberately separate from LT-01 and must be reviewed before any higher-load
case. Its pass/fail gates are the map checks and zero failed requests. Browser
request duration, map-ready time, and LCP remain in the official k6 summary as
timing evidence; LCP is not a pass/fail gate because 50 browser processes on
one load-generator computer can distort client-side web-vital timings.

## Production LT-03

LT-03 measures a 200-client peak enrollment workload without launching 200
local browsers. It ramps 199 authenticated HTTP users alongside one real
Chromium browser canary. Four temporary sessions are created from the
dedicated guest account in four independent local k6 cookie jars and
distributed as 49 HTTP users plus the browser on the first session, then 50
HTTP users on each remaining session. This is a 200-client virtual-user test,
not a test of 200 distinct accounts.

The HTTP users open `/map` once, then rotate through authenticated read-only
search, route-list, and pathfinding requests with four-to-eight-second think
time. The browser canary reloads the map every 30 seconds and checks the map
surface, Guard House start label, building labels, and route controls. It waits
three seconds after the required map elements become visible so those checks
observe a settled map DOM. k6 creates this browser in its own isolated context;
an already signed-in Chrome tab is not reused. Its presence heartbeat is
fulfilled by a browser-context fetch stub before page scripts run; no presence
request is sent to Production, and document navigation is not intercepted.

From the repository root, run:

```powershell
.\scripts\run-production-lt03.ps1
```

The runner requires `RUN-LT-03`, locks the target to
`https://campusphere-cspc.vercel.app`, and enforces a 16-minute cooldown after
the previous saved Production load run. The profile ramps through 10, 50,
100, 150, and 199 HTTP users, holds the 200-client peak for three minutes,
then ramps down. It aborts on sustained failures, rate limiting, server
errors, or severe latency.

LT-03 uses the balanced gates: at least 99% successful journeys, failed HTTP
requests below 1%, zero workload `429`/`5xx` responses, dynamic-request p95
below 3 seconds, p99 below 8 seconds, and a successful browser canary. Each
run is saved under a timestamped `LT-03` directory with the sanitized k6
summary, real dashboard HTML and PNG, peak browser screenshot, transcript,
metadata, and SHA-256 hashes. Setup data is removed from the summary and the
evidence is scanned for credentials, CSRF values, cookies, and session
identifiers before packaging.

If a run aborts early, inspect the safe `lt03_diag_*` counters in
`summary.json` and the matching phase/status tags in the official dashboard:
`lt03_diag_auth_responses` means `401`/`403` authentication responses,
`lt03_diag_redirect_responses` means `3xx` redirects, and
`lt03_diag_network_errors` means k6 received no HTTP response (`status 0`).
LT-03 deliberately does not follow workload redirects, so an unauthenticated
`/map` redirect to `/auth` is recorded as a redirect instead of being mistaken
for a successful `200` page.
The other counters separate remaining `4xx`, `5xx`, and unexpected statuses;
the browser counters separately identify authentication, redirects,
client-status, server-status, and other-status failures. Navigation outcomes are
reported independently: `lt03_diag_browser_navigation_response` counts the
selected real browser HTTP response, including a response recovered by the
main-navigation listener; `lt03_diag_browser_navigation_null_recovered` counts
a reload that returned no response object even though that listener captured
the real `/map` response; `lt03_diag_browser_navigation_null` counts a
navigation for which neither mechanism produced a response; and
`lt03_diag_browser_navigation_throw` counts a navigation exception. A recovered
null continues through the same status, URL, settle, and map assertions. An
unrecovered null or thrown navigation fails that browser cycle; only a real
HTTP 200 response may reach the map waits and assertions. The initial cycle
uses `goto`; later cycles reload the current `/map` page, while a non-map page
uses `goto` for recovery.
Browser wait counters identify whether the map container, map surface, or start
label failed to become visible. Browser check counters identify the exact failed
assertion: URL, HTTP status, map surface, Guard House label, building labels, or
route controls.
`lt03_diag_browser_render` remains the aggregate count for map wait/assertion
failures. The exact names are `lt03_diag_browser_wait_*` and
`lt03_diag_browser_check_*`; `lt03_diag_browser_unexpected` covers an
uncategorized browser exception. These diagnostics contain only fixed check or
outcome names, fixed navigation methods, numeric response statuses, or the
literal `none` when no response exists.

Before the ramp begins, setup also validates the copied cookie for each of the
four temporary sessions with an authenticated read-only request. If a copied
session is not accepted, the run stops before peak traffic and reports a fixed
stage such as `session-handoff-1 status-302` or `session-handoff-1 status-401`;
this distinguishes a harness/session handoff problem from a Production peak
capacity result. Setup checks the original login jar first, then checks the
copied cookie; a failure at `original-session-N` points to the login/session
store, while a failure at `session-handoff-N` points to the harness cookie
transfer.

## Production LT-04

LT-04 is a deliberately small Cloudinary delivery check. It does not launch
browser sessions and does not repeat the LT-03 application-capacity workload.
By default, one temporary dedicated guest session is used only to read the
authenticated route catalog and at most 25 guided-VR route responses. The
setup collects five to ten already-approved `https://res.cloudinary.com`
panorama URLs, then logs out before the asset workload begins.

If the owner supplies approved public Cloudinary delivery URLs that are not yet
exposed by the route API, pass them explicitly for this CDN-only check:

```powershell
.\scripts\run-production-lt04.ps1 -AssetUrls @(
  'https://res.cloudinary.com/<cloud>/image/upload/<asset-1>.png'
  'https://res.cloudinary.com/<cloud>/image/upload/<asset-2>.png'
  'https://res.cloudinary.com/<cloud>/image/upload/<asset-3>.png'
  'https://res.cloudinary.com/<cloud>/image/upload/<asset-4>.png'
  'https://res.cloudinary.com/<cloud>/image/upload/<asset-5>.png'
)
```

The override requires at least five unique HTTPS URLs on the exact
`res.cloudinary.com` host, performs the normal dedicated-session login/logout,
and bypasses route discovery. It proves Cloudinary delivery only; it does not
prove that the application route records reference those assets. URLs are not
printed into the transcript or summary.

From the repository root, run:

```powershell
.\scripts\run-production-lt04.ps1
```

The runner requires `RUN-LT-04`, locks the target to
`https://campusphere-cspc.vercel.app`, prompts for the dedicated guest test
credentials, and enforces the same 16-minute cooldown used by the other
Production load tests. It performs ten direct panorama GETs with at most five
simultaneous transfers and a 30-second per-request timeout. The workload sends
no application cookie, performs no upload or Cloudinary management operation,
and does not add cache-busting parameters.

LT-04 passes only when all ten asset requests return HTTP `200`, report an
image content type, complete before the timeout, and produce 50/50 checks with
zero failed requests. The asset-duration guard is p95 below 20 seconds and
maximum below 30 seconds. Setup failures (authentication, route discovery, or
too few approved Cloudinary assets) mean that no asset workload started and
must be reported separately from a delivery result.

When setup finds too few Cloudinary assets, the safe diagnostics print the
number of successful route responses, routes with no scenes, total scenes, and
the counts classified as explicit Cloudinary, discovered Cloudinary, local,
Drive, null, or other media. This
identifies a Production data/coverage prerequisite without printing URLs or
response bodies. Do not convert local placeholders or Drive media into a
Cloudinary result, and do not upload or edit VR records as part of LT-04.

Each run is saved under a timestamped `LT-04` directory below
`artifacts/production-load/YYYY-MM-DD/` with the sanitized k6 summary,
transcript, official dashboard HTML and PNG, metadata, and SHA-256 hashes.
The summary and metadata omit setup data, credentials, cookies, tokens,
response bodies, and individual panorama URLs. LT-04 measures CDN panorama
delivery only; it is not evidence of browser rendering, upload capacity, or
200-user application capacity.

The cookie-jar isolation regression is network-free and can be run before a
Production attempt:

```powershell
k6 run --quiet load-tests/production/lt-03-cookie-jar-isolation.js
```

## Production LT-05

LT-05 measures concurrent exact building-name searches with 49 authenticated
HTTP users and one real Chromium canary. It is deliberately not a 50-browser
run: the Buildings page filters its already-rendered catalog entirely in the
browser, while the Campus Map sends authenticated `GET /api/search` requests.
Each HTTP user opens `/buildings`, `/map`, and `/api/buildings` once, then
rotates through an unambiguous subset of exact names discovered from the live
authenticated building catalog. Before any ramp traffic begins, setup checks
up to 50 candidate names sequentially against `/api/search`, with 200 ms
spacing. It retains a candidate only when the response contains the exact
building row and every returned building or route resolves to that same
building. Ambiguous substring or route matches are counted and excluded;
malformed/non-200 responses fail setup, and fewer than five retained names
fail closed before load begins. Only aggregate selected/rejected counts are
logged. The browser canary verifies both rendered search surfaces and confirms
that searching does not change the visible map-marker set.

Four temporary guest sessions are created sequentially in four independent k6
cookie jars and distributed across the 50 virtual clients. The current Chrome
tab is not reused. The browser canary fulfills the advisory presence heartbeat
locally, while the search, page, directory, and static-resource requests remain
real Production traffic. All four temporary sessions are terminated through
the normal authenticated logout interface.

From the repository root, run:

```powershell
.\scripts\run-production-lt05.ps1
```

The runner requires `RUN-LT-05`, prompts for the dedicated guest credentials,
locks the target to `https://campusphere-cspc.vercel.app`, and enforces a
16-minute cooldown after the latest saved Production load run. It ramps through
10, 25, and 50 total clients, holds 50 for one minute, and then ramps down.

LT-05 passes only when every response and correctness check succeeds, no
authentication, redirect, network, rate-limit, client, or server failure is
observed, API search p95 remains below three seconds and p99 below eight
seconds, and the browser search-settle p95 remains below five seconds. The
exact building row must be returned. Route rows are permitted only when their
associated building is the exact searched building; unrelated building,
office, or route matches fail the run.

Evidence is saved below
`artifacts/production-load/YYYY-MM-DD/LT-05/run-<time>/` and includes the
sanitized summary, transcript, official k6 dashboard HTML and PNG, Buildings
search screenshot, Campus Map search screenshot, metadata, privacy check, and
SHA-256 manifest. Setup data, credentials, cookies, tokens, and response bodies
are excluded from retained evidence; query names are not deliberately logged.
A failed run is not retried automatically.

The shared result-scope policy has a network-free regression that can be run
before the single Production attempt:

```powershell
k6 run --quiet load-tests/production/lt-05-result-policy-regression.js
```

## Production LT-06

LT-06 measures repeated guided-route playback with 50 authenticated HTTP
clients. It covers the current supported route variants: 25 vehicle-entry
variants, 25 walking-entry variants, and 25 walking-exit variants. Vehicle exit
is not included because that mode is intentionally unsupported. The test is
HTTP-led and checks the route API plus every server-rendered scene page; it does
not download panorama subresources, so panorama/CDN delivery remains the
separate LT-04 measurement.

From the repository root, run:

```powershell
.\scripts\run-production-lt06.ps1
```

The runner requires `RUN-LT-06`, prompts for the dedicated guest credentials,
locks the target to `https://campusphere-cspc.vercel.app`, and enforces the
shared 16-minute cooldown after the latest saved Production load run. Setup
creates four temporary sessions, verifies their handoff, reads the live route
catalog, and preflights all 75 route/mode/direction variants. A non-200,
incomplete, reordered, duplicated, or non-arriving sequence stops setup before
the workload starts.

The workload ramps through 10, 25, and 50 clients, holds the 50-client peak,
then ramps down. Each playback re-fetches the route API, compares its path and
scene-key order with the setup baseline, and requests each scene page in order.
The page checks the exact scene, progress count, next-step link, and final
`Route complete` state. A missing, duplicated, reordered, prematurely completed,
or extra scene fails the playback. A 500 ms scene dwell keeps the requests
bounded while modelling repeated user playback.

LT-06 passes only when all route API, sequence, scene-page, completion, and
journey checks succeed; at least 150 complete playbacks are recorded; no HTTP
request, authentication, redirect, network, rate-limit, client, or server
failure occurs; and route API/scene-page p95 remains below three seconds with
p99 below eight seconds. The official dashboard, summary, transcript,
metadata, privacy scan, and SHA-256 manifest are saved below
`artifacts/production-load/YYYY-MM-DD/LT-06/run-<time>/`. Evidence excludes
route names, scene keys, URLs, response bodies, credentials, cookies, tokens,
and k6 setup data.

The route-policy regression is network-free and should pass before the single
Production attempt:

```powershell
k6 run --quiet load-tests/production/lt-06-route-policy-regression.js
```

## Production LT-07

LT-07 is browser recovery UAT, not a load or capacity test. Final evidence uses
a real signed-in Chrome tab and Chrome's network-offline control. Keep the
owner's existing application tab untouched: open a separate LT-07 tab that
shares the authenticated profile, download or update the Offline Campus Guide,
and inspect only fixed counts and UI state.

The final browser workflow is:

1. On `/map`, download the guide and confirm active service-worker control,
   the cached `/offline.html` shell, a non-empty PMTiles Blob, 25 buildings,
   25 Main Gate entry routes, and 25 Main Gate exit routes.
2. Switch that LT-07 tab offline and load `/offline.html` at desktop
   (`1440x900`), tablet (`820x1180`), and phone (`390x844`) sizes.
3. At each size, require the offline page, downloaded building controls, and
   rendered MapLibre canvas. On at least one size, open building information
   and render both a saved entry route and a saved exit route.
4. Reconnect, select **Update Offline Map**, and accept either a valid refreshed
   package or the safe **Offline map is already up to date** result.
5. Recheck package counts and confirm that the stored guide contains no
   Cloudinary, panorama, VR, or scene reference. Free Roam must remain visibly
   online-only.

Three responsive sizes in one Chrome profile are not three physical devices or
three accounts. If acceptance requires physical-device coverage, repeat the
same workflow on distinct devices and retain those owner-reviewed screenshots
separately.

### Retained k6 diagnostic prototype

LT-07 validates Offline Campus Guide recovery on three isolated Chromium
profiles: desktop (`1440x900`), tablet (`820x1180`), and phone (`390x844`).
It uses one dedicated guest login in setup, copies that session cookie into the
three new contexts, and never reuses the owner's current Chrome tab. Each
context has independent IndexedDB and service-worker state.

For every profile the browser opens `/map`, waits for service-worker control,
downloads the explicit authenticated offline guide, and verifies the stored
fingerprint, PMTiles byte count, building collection, and both entry and exit
route collections. It then calls the browser context's offline switch, opens
the service-worker `/offline.html` fallback, verifies the 2D map or its
accessible simplified fallback, opens a downloaded building, renders its saved
Main Gate entry route and exit route, and captures an offline screenshot. After
reconnecting, it performs one explicit guide update request, accepts either a
valid refreshed package or the safe “already up to date” result, rechecks
integrity and the no-VR boundary, and captures a reconnected screenshot.

The test deliberately does not cache or request VR panoramas, scene media,
photos, schedules, sessions, or admin data. The controlled offline navigation
has no network response by design; only online setup/update response statuses
are treated as HTTP failures. Browser diagnostics use fixed categories and do
not retain response bodies, URLs, guide names, route keys, cookies, or
credentials.

Before disconnecting, each profile proves that the active service worker
controls the page and that the session-neutral `/offline.html` shell is already
in Cache Storage. After `setOffline(true)`, LT-07 uses a browser-native reload
instead of `page.goto()` so the controlled navigation can reach the service
worker fallback. One profile failure does not abort the other two; fixed cache,
controller, navigation, unreadable-page, hidden-workspace, and render counters
identify the exact boundary while the overall run still fails. The fallback
shell and the stored-guide workspace are separate checks.

The network-free policy regression should pass first:

```powershell
k6 run --quiet load-tests/production/lt-07-offline-policy-regression.js
```

The Production runner is retained only to reproduce the known k6 limitation.
It is deliberately blocked unless the diagnostic-only switch is supplied:

```powershell
.\scripts\run-production-lt07.ps1 -AllowKnownK6OfflineDiagnostic
```

The runner requires `RUN-LT-07-DIAGNOSTIC`, locks the target to
`https://campusphere-cspc.vercel.app`, enforces the shared 16-minute cooldown,
and prompts for the dedicated guest credentials. It records the observed
service-worker version, official k6 dashboard, summary, transcript, metadata,
privacy scan, SHA-256 manifest, and six profile screenshots under
`artifacts/production-load/YYYY-MM-DD/LT-07/run-<time>/`.

On k6 v2.2.0, this prototype is not the final application verdict. The
localhost-only command below reproduces the same boundary without Production,
authentication, or application code:

```powershell
node scripts/lt07OfflineNavigation-probe.js
```

The expected result is 2/3 checks: service-worker control and shell precaching
pass, while the scheduled browser navigation to the cached offline shell fails.
Final LT-07 evidence must therefore come from the real-Chrome workflow above.
The bounded 2026-09-21 result is recorded in `docs/test-evidence.md` and the
LT-07 artifact closeout; the failed k6 artifact remains rejected diagnostic
evidence, and no threshold was weakened to manufacture a green run.

The prototype would pass only when all three profiles complete the download, offline
recovery, entry-route, exit-route, and reconnect/update checks; all fixed
authentication, redirect, network, client, server, render, unexpected, and
VR-resource diagnostics remain zero; and download/offline-ready/reconnect
p95 timings remain below 60/30/30 seconds. A failed attempt is packaged for
diagnosis and is not retried automatically or "fixed" by weakening thresholds.

## Production LT-08

LT-08 is the sustained read-only endurance run. It uses 49 authenticated HTTP
users plus one Chromium canary (50 concurrent clients total): a two-minute
ramp, a ten-minute hold at the 49-user HTTP peak, and a one-minute ramp-down.
Four independently created guest sessions are used by the load harness. The
workload reads `/map`, `/buildings`, the building directory, search, route
catalog, Main Gate pathfinding, and `/healthz`; it does not send writes,
presence heartbeats, offline-guide updates, admin requests, or media-management
requests. The browser canary checks the rendered `/map` surface every minute
and stubs only the local presence-heartbeat call. It launches a separate k6
Chromium context and never attaches to or reuses the owner's current Chrome tab.

Run the network-free profile regression before any Production traffic:

```powershell
k6 run --quiet load-tests/production/lt-08-endurance-policy-regression.js
```

The guarded Production runner is:

```powershell
.\scripts\run-production-lt08.ps1
```

It locks the target to `https://campusphere-cspc.vercel.app`, requires the
literal confirmation `RUN-LT-08`, prompts for a dedicated guest credential,
enforces the shared 16-minute cooldown, and writes the transcript, safe k6
summary, exported dashboard, dashboard screenshot, peak/final canary
screenshots, metadata, privacy scan, and SHA-256 manifest under
`artifacts/production-load/YYYY-MM-DD/LT-08/run-<time>/`.

LT-08 fails on any journey/browser check failure, HTTP 5xx, rate limiting,
request failure, missing canary cycle, p95/p99 threshold breach, or a late
hold-window p95 above `max(early p95 * 1.5, early p95 + 500 ms)`. The runner
does not claim server-memory health from k6. After the run, review the exact
UTC window in Vercel Observability/Runtime Logs for Peak Memory p99, OOM or
function-crash/timeout signals, and 5xx/error rows before recording the final
LT-08 disposition. If that Vercel evidence is unavailable, the result remains
incomplete rather than a final PASS.
