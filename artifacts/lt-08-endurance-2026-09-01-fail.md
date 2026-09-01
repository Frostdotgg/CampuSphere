# LT-08 — Endurance result

Run date: 2026-09-01 (Asia/Manila)

Target: local Docker at `http://localhost:3000`

Workload: 50 constant VUs for 10 minutes, with one temporary local seeded
student session. The session was terminated through `POST /logout` after the
run and the former cookie was replayed to confirm `/dashboard` was denied.
No session cookie, CSRF token, password, or other credential is stored here.

## Outcome

**FAIL — strict zero-error endurance threshold crossed.**

The run completed its scheduled 10 minutes. A short timeout burst occurred at
about 7 minutes 37 seconds. The final k6 summary recorded 28 failed HTTP
requests (0.14%): 27 search requests and one Buildings-page request. The map,
directory API, route API, and route page checks remained 100%.

## Complete k6 summary

```text
THRESHOLDS
checks                         rate=99.68%  FAIL
endurance_buildings_page_ok   rate=99.96%  FAIL
endurance_directory_ok        rate=100.00% PASS
endurance_iteration_ok        rate=99.18%  FAIL
endurance_map_ok               rate=100.00% PASS
endurance_route_api_ok         rate=100.00% PASS
endurance_route_page_ok       rate=100.00% PASS
endurance_search_match_ok     rate=99.18%  FAIL
endurance_search_ok           rate=99.18%  FAIL
http_req_failed                rate=0.14%   FAIL

TOTAL RESULTS
checks_total........: 26408  43.78412/s
checks_succeeded....: 99.68% 26326 out of 26408
checks_failed.......: 0.31%  82 out of 26408

checks
  Endurance map returned valid building data                 3301 / 3301
  Endurance Buildings page returned the catalog              3300 / 3301
  Endurance directory returned valid markers                  3301 / 3301
  Endurance search returned JSON                              3274 / 3301
  Endurance search matched the requested building             3274 / 3301
  Endurance route API returned a complete route               3301 / 3301
  Endurance route page returned the first scene               3301 / 3301
  Endurance iteration completed                               3274 / 3301

CUSTOM
endurance_buildings_page_ok....: 99.96%  3300 out of 3301
endurance_directory_ok.........: 100.00% 3301 out of 3301
endurance_iteration_duration...: avg=8129.171766 min=3906 med=5862 max=36758 p(90)=14495 p(95)=15537 ms
endurance_iteration_ok.........: 99.18%  3274 out of 3301
endurance_map_ok...............: 100.00% 3301 out of 3301
endurance_route_api_ok.........: 100.00% 3301 out of 3301
endurance_route_page_ok........: 100.00% 3301 out of 3301
endurance_search_match_ok......: 99.18%  3274 out of 3301
endurance_search_ok............: 99.18%  3274 out of 3301

HTTP
http_req_duration..............: avg=3.47s min=363.12ms med=2.49s max=30s p(90)=7.94s p(95)=11.64s
{ expected_response:true }.....: avg=3.44s min=363.12ms med=2.49s max=29.92s p(90)=7.88s p(95)=11.55s
http_req_failed................: 0.14%  28 out of 19806
http_reqs......................: 19806  32.83809/s

EXECUTION
iteration_duration.............: avg=9.12s min=4.9s med=6.86s max=37.75s p(90)=15.49s p(95)=16.53s
iterations.....................: 3301   5.473015/s
vus............................: 4      min=4 max=50
vus_max........................: 50     min=50 max=50

NETWORK
data_received..................: 1.4 GB  2.3 MB/s
data_sent......................: 3.8 MB  6.4 kB/s
```

## Docker stats timeline

Values are `CPU% | memory usage | memory% | network I/O` from
`docker stats --no-stream`.

| sample | `campuspherev1-app-1` | `campuspherev1-mysql-1` |
|---|---|---|
| start 12:06:17 | 0.01% \| 335.9MiB \| 4.34% \| 751MB / 1.39GB | 0.87% \| 406.1MiB \| 5.25% \| 13.3MB / 39.2MB |
| 12:06:50 | 47.19% \| 573.6MiB \| 7.41% \| 789MB / 1.46GB | 14.91% \| 406.6MiB \| 5.25% \| 13.9MB / 41.1MB |
| 12:07:20 | 19.24% \| 580MiB \| 7.49% \| 842MB / 1.56GB | 4.25% \| 406.9MiB \| 5.26% \| 15.2MB / 46.3MB |
| 12:07:49 | 31.76% \| 578.7MiB \| 7.47% \| 881MB / 1.63GB | 1.75% \| 406.8MiB \| 5.25% \| 16.1MB / 49.2MB |
| 12:08:20 | 30.93% \| 610.1MiB \| 7.88% \| 936MB / 1.74GB | 6.43% \| 407MiB \| 5.26% \| 17.5MB / 54.3MB |
| 12:08:50 | 51.28% \| 610.6MiB \| 7.89% \| 986MB / 1.84GB | 2.27% \| 407.2MiB \| 5.26% \| 18.6MB / 58.4MB |
| 12:09:19 | 42.06% \| 604.9MiB \| 7.81% \| 1.04GB / 1.95GB | 11.45% \| 407.7MiB \| 5.27% \| 19.8MB / 62.7MB |
| 12:09:50 | 77.33% \| 587.9MiB \| 7.59% \| 1.10GB / 2.05GB | 4.12% \| 406.9MiB \| 5.26% \| 21.1MB / 67.6MB |
| 12:10:20 | 40.25% \| 610.4MiB \| 7.88% \| 1.15GB / 2.16GB | 9.39% \| 407.2MiB \| 5.27% \| 22.2MB / 71.6MB |
| 12:10:50 | 65.74% \| 603.8MiB \| 7.80% \| 1.20GB / 2.26GB | 9.65% \| 407.7MiB \| 5.27% \| 23.5MB / 76.1MB |
| 12:11:20 | 56.63% \| 618.6MiB \| 7.99% \| 1.26GB / 2.37GB | 8.57% \| 408MiB \| 5.27% \| 24.7MB / 80.4MB |
| 12:11:49 | 7.67% \| 613MiB \| 7.92% \| 1.30GB / 2.45GB | 2.01% \| 407.5MiB \| 5.26% \| 25.8MB / 84.3MB |
| 12:12:20 | 35.82% \| 611.4MiB \| 7.90% \| 1.34GB / 2.52GB | 9.95% \| 407.4MiB \| 5.26% \| 26.6MB / 87.6MB |
| 12:12:50 | 11.52% \| 589.2MiB \| 7.61% \| 1.36GB / 2.55GB | 14.83% \| 407.7MiB \| 5.27% \| 26.9MB / 88.4MB |
| 12:13:19 | 16.63% \| 590MiB \| 7.62% \| 1.38GB / 2.59GB | 1.20% \| 408MiB \| 5.27% \| 27.5MB / 90.7MB |
| 12:13:50 | 1.21% \| 590MiB \| 7.62% \| 1.39GB / 2.62GB | 0.49% \| 407.9MiB \| 5.27% \| 27.8MB / 91.8MB |
| 12:14:19 | 36.52% \| 611.3MiB \| 7.90% \| 1.41GB / 2.66GB | 13.29% \| 407.7MiB \| 5.27% \| 28.2MB / 93.3MB |
| 12:14:50 | 32.84% \| 615.4MiB \| 7.95% \| 1.44GB / 2.71GB | 11.86% \| 407.8MiB \| 5.27% \| 28.7MB / 95.1MB |
| 12:15:20 | 4.13% \| 588.4MiB \| 7.60% \| 1.47GB / 2.76GB | 1.37% \| 407.8MiB \| 5.27% \| 29.4MB / 97.6MB |
| 12:15:50 | 72.02% \| 612.1MiB \| 7.91% \| 1.51GB / 2.84GB | 4.59% \| 407.9MiB \| 5.27% \| 30.2MB / 100MB |
| 12:16:20 | 53.83% \| 606.8MiB \| 7.84% \| 1.56GB / 2.94GB | 17.61% \| 408.8MiB \| 5.28% \| 31.6MB / 106MB |
| end 12:16:22 | 4.12% \| 607.5MiB \| 7.85% \| 1.56GB / 2.94GB | 0.47% \| 408.8MiB \| 5.28% \| 31.6MB / 106MB |

## Interpretation

- This is a **local Docker endurance result**, not Production evidence.
- The app and MySQL containers remained running; no restart or OOM event was
  observed in the sampled `docker stats`. A final read-only Docker inspection
  reported `status=running`, `restart_count=0`, and `oom_killed=false` for both
  `campuspherev1-app-1` and `campuspherev1-mysql-1`.
- App memory rose during warm-up and then fluctuated around 588–619 MiB,
  ending at 607.5 MiB. These samples do not prove or disprove a memory leak.
- The immediate follow-up should focus on the timeout window and the search /
  Buildings request path before calling LT-08 a pass.
