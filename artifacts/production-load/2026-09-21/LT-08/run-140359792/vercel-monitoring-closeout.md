# LT-08 Vercel monitoring closeout

Disposition: **PASS WITH WARNING**.

The LT-08 k6 acceptance run passed all 26/26 configured thresholds. The separate Vercel Production observation found healthy function and memory indicators, but three session-store timeout-retry warnings appeared during the same interval. This is not a zero-warning monitoring window, so the closeout preserves the warnings rather than calling it a clean Production observation.

## Scope and evidence window

- Project: `campusphere-cspc`
- Environment: Production
- Deployment observed: `dpl_HbJRojVKtJUeUr2KMY6XhcRv6RCS` (`main`, commit `0e7fe8bb50708bbcfaa4297f6ca133a547da4d76`)
- Window: September 21, 2026, 14:03-14:18 Asia/Manila (06:03-06:18 UTC)
- LT-08 run: 14:04:11-14:17:30 Asia/Manila; 50 concurrent users (49 HTTP, one browser canary)
- Observation method: read-only Vercel Overview, Observability > Functions, and deployment-filtered Logs in the already-authenticated Chrome session. No Vercel settings, deployments, or application state were changed.

## LT-08 load result

- 26/26 thresholds passed; 10,892/10,892 checks passed.
- 5,322 completed journeys and 5,517 HTTP requests.
- Overall dynamic request p95: 457.77 ms; early/middle/late p95: 455.63/429.13/442.28 ms; maximum: 2,564.18 ms.
- Browser map-ready p95: 6,832.8 ms against the 15,000 ms threshold.
- HTTP failure, 5xx, and rate-limit rates were zero in the k6 summary.

## Vercel observations

- Functions dashboard: approximately 5.6K invocations, 0% error rate, and 0% timeout rate.
- Memory: 341 MB average, 352 MB P75, 356 MB P95, against a displayed 2.05 GB provisioned limit. The graph remained well below the limit without a visible upward drift. Memory P99 was not exposed by this Hobby dashboard.
- Active CPU: 22/27/48 ms average/P75/P95. CPU throttle: 1.4%/1.2%/6.1% average/P75/P95. Hot/cold starts: 99.9%/<0.1%.
- Deployment-filtered Production logs showed Error 0, Fatal 0, Warning 3; the visible status buckets were 200 (~5K), 204 (11), and 302 (4). The status filter returned no 5xx matches.
- The dashboard TTFB chart was labeled “Demo Data” and was not treated as Production evidence.

## Warning detail and attribution

Three application-level session-store timeout retry warnings appeared in the observation window:

- 14:05:46.30, `GET /api/pathfind`, operation `get`, timeout, first attempt marked `retrying` after at least 2,000 ms.
- 14:09:19.78, `GET /api/routes`, operation `touch`, timeout, first attempt marked `retrying` after at least 2,000 ms.
- 14:15:21.62, `GET /api/search`, operation `touch`, timeout, first attempt marked `retrying` after at least 2,000 ms.

Each corresponding request log displayed HTTP 200. The captured dashboard rows show the retry beginning, but do not establish the explicit outcome of a later retry; this closeout does not infer recovery solely from the 200 response.

The four 302 rows were the k6 setup `POST /login` redirects. The 11 `POST /api/presence/heartbeat` 204 rows were background activity from the already-open signed-in Chrome app; the k6 browser canary used a local heartbeat stub, so those 204s are not attributed to the LT-08 workload.

## Conclusion and retained evidence

The LT-08 performance/load criteria pass, and this Vercel window showed no function errors, timeouts, 5xx responses, or memory pressure. Record the run as **PASS WITH WARNING** because three session-store timeout retries were logged on tested read routes. Track the session-store retry behavior as an operational follow-up; this observation alone does not establish a defect or prove retry completion.

Three dashboard screenshots (status buckets, retry warnings, and Functions/memory metrics) were captured inline in the Codex conversation. The available browser screenshot interface did not provide a local output path, so the screenshots could not be added to this run directory. The exact observed values and caveats are retained here and in `metadata.json`.
