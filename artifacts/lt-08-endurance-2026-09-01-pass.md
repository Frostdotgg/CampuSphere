# LT-08 — Endurance result — PASS

Run date: 2026-09-01 (Asia/Manila)

Target: local Docker at `http://localhost:3000` (not Production)

Workload: 50 constant VUs for 10 minutes, `HTTP_TIMEOUT=30s`, and a 10-second
graceful stop. The strict `rate==1.0` checks and `http_req_failed rate==0.0`
thresholds were unchanged. A temporary local MySQL student session was used
for the authenticated workload, then terminated through the real logout
endpoint. The final canonical session-residue gate passed 18/18.

## k6 result

- Checks: **79,560 / 79,560 passed (100.00%)**
- Iterations: **9,945 / 9,945 completed**
- HTTP requests: **59,670; 0 failed (0.00%)**
- Map, Buildings page, directory, search, route API, route page, and iteration
  thresholds: **100.00%**
- HTTP duration: average **594.74 ms**, p95 **858.99 ms**, maximum **12.04 s**
- Iteration duration: average **3.02 s**, p95 **3.31 s**, maximum **14.47 s**
- Data received: **4.2 GB**

The complete raw k6 transcript and summary export are beside this file:
`lt-08-endurance-2026-09-01.txt` and `lt-08-endurance-2026-09-01.json`.

## Docker observations

The app and MySQL containers remained running. The monitor recorded 73 samples
per container during the sustained portion of the run:

- App: **438.0–582.5 MiB** sampled; final post-run sample **516.4 MiB**
- MySQL: **420.3–423.3 MiB** sampled; final post-run sample **422.8 MiB**
- Final inspection: `running`, restart count **0**, OOM-killed **false** for
  both containers

The Docker sample log is `lt-08-docker-stats-2026-09-01.txt`.

## Interpretation

This is a local Docker endurance result, not evidence of Production capacity.
The performance candidate removed duplicate concurrent roster/corpus reads;
the read-coalescing probe passed 6/6. The separate full quality suite remains
blocked by live Supabase dataset drift (26 buildings versus the frozen 25-row
baseline); no content was deleted or changed to manufacture a green result.
