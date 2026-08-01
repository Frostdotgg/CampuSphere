# CampuSphere — Deployment & Environment Guide

Milestone 8, Section 8.9 (updated in Milestone 9, Section 9.7 for the Supabase
session store). This document covers environment variables, secret handling,
Supabase migration order, Cloudinary media env (server-only), MySQL fallback setup, production session policy
(Supabase-preferred, MySQL fallback), the security middleware, OAuth redirect
URIs, Docker packaging, the Vercel demo/UAT target, the QA gates, and
troubleshooting.

CampuSphere is an Express 5 + EJS server-rendered app. It runs against **MySQL**
(the default and fallback) and/or **Supabase/PostgreSQL** (the cloud target),
selected per-domain at runtime by the `*_DATA_SOURCE` switches. The app keeps
Express session auth + Google OAuth; **Supabase Auth is not used**.

## 2026-07-30 R8 Continuity Status

- Production at `https://campusphere-cspc.vercel.app` uses the independently
  Codex-accepted SEC-51 deployed runtime baseline
  `d422b54393f659125912ec5c84ae7927c2533288`.
- Repository HEAD `db034e5581e6f409083a43dcb80fb82b473e0127` is a later
  documentation-only commit whose bytes differ from the production runtime
  commit. The current local correction candidate is uncommitted and unaccepted;
  it adds one bounded runtime change in `services/auditService.js` plus
  authority/gate updates.
- Independently verified database preconditions are GREEN: credential safety
  `24/24`, residue `18/18`, and BE.6 `46/46`. The leaked Supabase hotspot and
  sibling schedule are absent, all four canonical Supabase identities have
  zero unexpired sessions, MySQL is clean, and both backends carry the frozen
  51 selected-source hotspots and selected-VR fingerprint.
- Before the separately authorized 2026-07-30 restoration, the historical
  state was `22/24 -> 16/18 -> 41/46` with the exact leaked fixture and two
  canonical Supabase sessions. That superseded incident is not current truth.
- Do not run `syncSelectedCasVrSupabaseToMysql.js --apply`; before restoration
  it would have copied the leaked Supabase row into the clean MySQL baseline.
  The supported restoration is complete. No further cleanup, revocation, SQL,
  or session-row mutation is authorized by this correction candidate.
- No R8, deployment, pilot, or Milestone 12 GO is current. Migration `0020`,
  direct SQL cleanup, direct session-row deletion, staging, commit, push, and
  deployment remain unauthorized. Candidate totals `3752`, `3755`, `3760`,
  and `3763` are historical/superseded or rejected. The first 3,772-check
  authority/audit/total-consistency execution is rejected at 3,742 passes and
  30 failures with no `QUALITY-GATES OK`. The later 3,774/3,777 matrix also
  remains rejected after three `docs-current` failures, exit 1, and no
  `QUALITY-GATES OK`. An earlier frozen 12-file matrix was recorded as green
  `3777/3777`; that record is superseded and rejected, because a fresh
  execution against those exact frozen bytes exited 1 at `3776/3777` with one
  static failure, `cloudinary-docs :: docs contain no JWT/PEM/AWS/long-hex
  secret values`, raised by an unlabeled 40-hex Repository HEAD value in the
  then-current copy of this document.
- A bounded documentation-only correction labelled that value as
  `Repository HEAD` and preserved the truthful claim that the commit is a
  documentation-only commit and gate-work candidate, not a runtime deployment.
  `scripts/quality-gates.js` was not changed by that correction, and the exact
  frozen 12-file manifest is pinned in `docs/test-evidence.md`. A
  byte-consistent matrix was then executed once against the corrected manifest:
  preflight and postflight matched 12/12 hashes with Git, migration, and
  process state unchanged; both `node --check` runs and `git diff --check`
  exited 0 with only LF/CRLF advisories; the logout probe passed `75/75` at
  exit 0 with zero FAIL/ERROR/SKIP and zero escaped logout-error lines;
  `npm test` exited 0 at `3777/3777` with `QUALITY-GATES OK` present and
  `QUALITY-GATES FAILED` absent; `npm run qa` exited 0 with exactly 3,777
  contract PASS lines before `QUALITY-GATES OK` and all five green markers
  exactly once; and final ordered postconditions were `24/24 -> 18/18 -> 46/46`
  at exit 0 each. The two disclosed wrapper-only overmatches caused no
  application failure or retry. That `3777` figure is a transcript-wide
  PASS-line reconciliation across parent and inherited spawned-probe stdout,
  not an in-process `makeRecorder` counter.
- The byte-consistent result is current candidate evidence only. It remains
  unaccepted pending independent read-only review and establishes no R8,
  SEC-51, deployment, pilot, or Milestone 12 GO.
- The local-candidate Vercel package inventory is 158 files, 6,201,747 bytes,
  aggregate SHA-256
  `acfb1696de0c8855e02aa82e243fec959aefec637f29bdf033bc34ffda42e8b1`.
  It describes local bytes only and is not deployment authorization.
- The owner-created feedback form is READY external evidence. Its responder URL
  and all secret values remain outside Git.

---

## 1. Environment variables

Set these in an untracked local `.env` (loaded by `dotenv`) for local runs, or as
real environment variables in your host/container platform for deployment. See
`.env.example` for the annotated template. **Never commit a real `.env`.**

### Core runtime

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NODE_ENV` | prod: yes | _(unset = non-prod)_ | `production` enables fail-closed session policy, the Secure `__Host-` cookie, and HTTPS upgrade. |
| `PORT` | no | `3000` | HTTP listen port. |

### MySQL (data fallback; also the fallback session store when `SESSION_STORE=mysql`)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DB_HOST` | mysql mode | `127.0.0.1` | MySQL host. In Docker Compose this must be the **service name** (`mysql`), not `localhost`. |
| `DB_USER` | mysql mode | `root` | MySQL user. |
| `DB_PASS` | mysql mode* | _(empty)_ | MySQL password. Required by the official MySQL image in Compose. |
| `DB_NAME` | mysql mode | `campusphere_db` | Database name. |

Required for any MySQL data-source (`*_DATA_SOURCE=mysql`) or fallback, and for
`SESSION_STORE=mysql`. A fully Supabase-backed production (Supabase data sources +
`SESSION_STORE=supabase`) does **not** need MySQL.

### Session / cookies / proxy (`config/sessionConfig.js`)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `SESSION_STORE` | prod: yes | prod `supabase`, else `memory` | `supabase` = preferred persistent store (`services/supabaseSessionStore.js`, table `public.app_sessions`; needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + migration `0011`). `mysql` = fallback/local-rehearsal persistent store (`services/mysqlSessionStore.js`, table `app_sessions`). `memory` is **local-dev only**; `SESSION_STORE=memory` **fails startup in production** (as does any unknown value). |
| `SESSION_SECRET` | prod: yes | dev fallback (insecure) | Signs the session cookie. In production it must be set, **≥32 chars**, and not a known placeholder, or the server **refuses to start**. |
| `SESSION_SECRET_PREVIOUS` | no | _(none)_ | Comma-separated rotated-out secrets that still **verify** old cookies. In production each value must also be ≥32 chars and non-placeholder. |
| `SESSION_COOKIE_MAX_AGE_MS` | no | `86400000` (24h) | Cookie lifetime (positive integer ms). Invalid value fails prod startup. |
| `TRUST_PROXY` | no | prod `1`, else `0` | Express `trust proxy` hops. Behind TLS termination the proxy must forward `X-Forwarded-Proto=https`. Invalid value fails prod startup. |

### Google OAuth (`controllers/authController.js`)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GOOGLE_CLIENT_ID` | no | _(none)_ | OAuth client id. If id or secret is missing, OAuth is disabled (`/auth/google` → `/auth?error=oauth_failed`); local login still works. |
| `GOOGLE_CLIENT_SECRET` | no | _(none)_ | OAuth client secret (server-only). |
| `GOOGLE_REDIRECT_URI` | no | `http://localhost:3000/auth/callback` | Must exactly match the Authorized redirect URI in Google Cloud (see §7). |

### Supabase (server-only; cloud data target)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `SUPABASE_URL` | for supabase mode | _(none)_ | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | for supabase mode | _(none)_ | **Privileged server-only key.** See §2. |
| `SUPABASE_ANON_KEY` | no | _(none)_ | Reserved; only if a future browser-safe read path is approved. |

`SESSION_STORE=supabase` uses the same `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
and additionally requires migration `0011_supabase_session_store.sql` (the
server-only `public.app_sessions` table) to be applied. **Supabase Auth is not used.**

### Cloudinary (server-only; media delivery)

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `CLOUDINARY_CLOUD_NAME` | no | _(none)_ | Cloudinary cloud name. **Public** delivery metadata (appears in every `https://res.cloudinary.com/<cloud_name>/…` URL); kept server-side with the other Cloudinary config. |
| `CLOUDINARY_API_KEY` | no | _(none)_ | **Secret**, server-only. See §2. |
| `CLOUDINARY_API_SECRET` | no | _(none)_ | **Secret**, server-only. See §2. |

Cloudinary is the media-delivery target for campus images and 360° VR panoramas;
the database stores only delivery **metadata** (`image_url`, `cloudinary_public_id`).
The variables are read only by server code (`config/cloudinary.js`) and are
**optional** — when unset, the app falls back to the local `/img/*` and
`/img/vr/*` placeholders, so local dev, the MySQL fallback, and the Supabase
runtime are unaffected. Real asset upload and credential entry are
**owner-controlled** (the Cloudinary dashboard); CampuSphere has **no** browser
direct-upload, unsigned-upload preset, Cloudinary Admin API, or SDK flow. As of
Sections 10.4–10.6 the media path is **live**: `image_url` is validated
server-side (`utils/mediaUrl.js`: a safe local `/img/` path or an
`https://res.cloudinary.com/…` URL only); the CSP allows `res.cloudinary.com`
for media delivery (`img-src`/`media-src`, plus `connect-src` for Pannellum's
XHR panorama load — **never** `script-src`); the
service worker may bounded-cache approved Cloudinary media but never caches
authenticated HTML or mirrors `/img/vr/*`; the VR viewer renders a sanitized
Cloudinary panorama where configured and otherwise falls back; and admins can
store/update `image_url` + `cloudinary_public_id` on buildings and VR scenes.
`cloudinary_public_id` is admin/server metadata only and never appears in
public/runtime responses. Uploading the final 360 panoramas is owner-controlled
asset work (validated at the Milestone 10 end-to-end gate), not an app feature.

### Runtime data-source switches (consumed today)

These are **live** — each controller/repository reads its switch at request time.
Each defaults to the MySQL/Leaflet fallback when unset, empty, or unrecognised.
The `supabase` modes require `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

| Variable | Values | Reads via | Selects |
| --- | --- | --- | --- |
| `AUTH_DATA_SOURCE` | `mysql` \| `supabase` | `config/authDataSource.js` | auth / profile / dashboard / admin-user backend |
| `CONTENT_DATA_SOURCE` | `mysql` \| `supabase` | `config/contentDataSource.js` | news / events / FAQs / settings backend |
| `BUILDING_DATA_SOURCE` | `mysql` \| `supabase` | `config/mapRuntime.js` | building reads (`/buildings`, `/map`, admin) |
| `ROUTE_DATA_SOURCE` | `mysql` \| `supabase` | `config/mapRuntime.js` | search / routes / pathfinding reads |
| `VR_DATA_SOURCE` | `mysql` \| `supabase` | `config/vrDataSource.js` | VR scene/hotspot + guided route reads |
| `SCHEDULE_DATA_SOURCE` | `mysql` \| `supabase` | `config/scheduleDataSource.js` | room/facility schedule reads + admin schedule CRUD (real **admin-managed** data - not SIS/enrollment/instructor-load simulation; `supabase` mode requires migrations `0012_room_schedules.sql` and `0013_vr_hotspot_schedule_metadata.sql`, owner-applied) |
| `MAP_RENDERER` | `leaflet` \| `maplibre` | `config/mapRuntime.js` | map library used by the map views |

The final Supabase-backed runtime is:
`SESSION_STORE=supabase AUTH_DATA_SOURCE=supabase CONTENT_DATA_SOURCE=supabase BUILDING_DATA_SOURCE=supabase ROUTE_DATA_SOURCE=supabase VR_DATA_SOURCE=supabase SCHEDULE_DATA_SOURCE=supabase MAP_RENDERER=maplibre`.
The session store is selected independently by `SESSION_STORE` (preferred
`supabase`, fallback `mysql`); it is **not** tied to the `*_DATA_SOURCE` switches.

### Rate-limit overrides (`middleware/rateLimit.js`, all optional)

Fixed-window limiter. `*_MAX` = requests per window; `*_WINDOW_MS` = window
length in ms. Defaults shown. These variables set the limits and windows only —
**where** the counters live is chosen by the runtime (M12.P1-R4): an in-memory
Map locally, a shared Upstash Redis counter on Vercel. Limits, bucket scopes,
the fixed `429` body, and `Retry-After` are identical in both modes.

| Variable | Default | Bucket |
| --- | --- | --- |
| `RATE_LIMIT_AUTH_MAX` / `RATE_LIMIT_AUTH_WINDOW_MS` | `20` / `900000` | auth form preflight (per IP): POST `/login` `/register` `/auth/complete-registration` `/logout` |
| `RATE_LIMIT_LOGIN_ACCOUNT_MAX` / `RATE_LIMIT_LOGIN_ACCOUNT_WINDOW_MS` | `8` / `900000` | login (per hashed email+IP) |
| `RATE_LIMIT_OAUTH_MAX` / `RATE_LIMIT_OAUTH_WINDOW_MS` | `20` / `600000` | OAuth start/callback (per IP) |
| `RATE_LIMIT_PROFILE_MAX` / `RATE_LIMIT_PROFILE_WINDOW_MS` | `20` / `600000` | profile update (per user+IP) |
| `RATE_LIMIT_ADMIN_MUTATION_MAX` / `RATE_LIMIT_ADMIN_MUTATION_WINDOW_MS` | `80` / `300000` | admin mutations (per admin+IP) |

There is intentionally no "disable all rate limits" switch.

### Shared rate-limit store — Vercel only (M12.P1-R4)

Required **only** when `VERCEL=1`; validated by the same pure preflight and the
same single fixed sanitized refusal. Local development, Docker rehearsal, and
the test suites require none of them.

| Variable | Contract |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | Server-only HTTPS REST endpoint; must parse as HTTPS with a hostname and must **not** embed a URL username/password. |
| `UPSTASH_REDIS_REST_TOKEN` | Server-only REST token; nonblank, never a documented placeholder. |
| `RATE_LIMIT_KEY_SECRET` | Server-only HMAC key, **at least 32 characters** after trimming, never a documented placeholder. Not a session secret; do not reuse `SESSION_SECRET`. |

- **Dependency:** `@upstash/redis` pinned to **exactly `1.38.0`** (no caret or
  range). No `@upstash/ratelimit` or other limiter dependency is added.
  Anonymous SDK telemetry is disabled with the documented
  `enableTelemetry: false` constructor option.
- **Zero SDK retries:** the client is constructed with `retry: { retries: 0 }`,
  giving **exactly one transport attempt** per counted request. The SDK default
  is 5 retries with exponential backoff (6 total attempts), which is wrong for a
  limiter that sits in front of every request: retrying a failing shared store
  would multiply latency on every request during an outage instead of failing
  closed immediately. Note that `retry: false` is **not** equivalent — in
  `1.38.0` it sets `attempts: 1` and the request loop is
  `for (i = 0; i <= attempts; i++)`, so it still performs **two** attempts.
  `{ retries: 0 }` also leaves the backoff branch unreachable, so no retry timer
  is created.
- **Why shared:** Vercel runs many independent serverless instances. A
  process-local Map would let each instance keep its own counter and multiply
  the effective limit, which is the M12.P1 audit finding this section closes.
- **Atomic counters:** each counted request runs **one** server-side Lua `EVAL`
  that performs `INCR`, reads `PTTL`, and applies `PEXPIRE` when the window is
  new or an expiry is missing, returning the count and authoritative TTL. Redis
  executes the script as a single uninterruptible unit, so an increment can
  never lose its expiry and a live window is never extended by later hits.
  A normal Upstash pipeline is **not** atomic and is deliberately not used.
- **Key-level locking:** the script's first line is
  `#!lua flags=allow-key-locking`. Without that shebang Upstash runs a Lua
  script under the **global database lock**, so every rate-limit check would
  serialize against every unrelated command in the database. With it, Upstash
  locks only the keys passed in the `KEYS` array, letting disjoint buckets run
  in parallel. The flag requires every key touched by `redis.call` to appear in
  `KEYS`: this script passes exactly one key and accesses only `KEYS[1]`, and
  performs no database-wide write.
- **Authoritative `Retry-After`:** the adapter returns the raw Redis `PTTL` and
  never clamps it to the configured window. `PTTL` is how long the counter
  actually stays elevated, so it is the only truthful basis for `Retry-After`.
  If an operator lowers a configured window, pre-existing keys legitimately
  hold a longer TTL; clamping there would tell the caller to retry while the
  bucket is still over the limit, producing a guaranteed second `429`. Unusable
  TTL replies (negative, non-integer, non-numeric, missing) still fail closed.
- **Key privacy:** only an HMAC-SHA-256 digest is persisted. Keys are
  `csrl:v1:<scope>:<digest>`; values are a bare integer counter. Raw IP
  addresses, emails, user IDs, cookies, session IDs, tokens, secrets, and
  submitted content never reach a key, a value, a response, or a log. The
  namespace, version, and scope are part of the HMAC material as well as the
  visible key, so limiter scopes cannot collide.
- **Local behaviour:** outside Vercel the original in-memory fixed-window
  adapter is used, the Upstash package is never loaded, and
  `RATE_LIMIT_KEY_SECRET` is **not** required.
- **Fail-closed:** on Vercel, missing configuration is refused at startup. An
  unreachable store, a rejected command, or a malformed reply returns one fixed
  sanitized `503` (`{"success":false,"message":"Service temporarily
  unavailable."}`) with `Cache-Control: no-store`, never calls `next()`, and
  **never** falls back to a process-local Map. No URL, token, secret, HMAC
  input, key, command, reply, or stack is exposed, and an outage produces no
  per-request log volume.
- **Preserved:** the existing `429` JSON/HTML bodies, the integer `Retry-After`
  (seconds, ≥ 1), every `RATE_LIMIT_*` override, all five bucket scopes, the
  pre-body-parser placement of the auth/OAuth/profile/admin IP limiters, the
  identity-aware limiters' position after auth/CSRF, and the exemption of safe
  admin `GET`/`HEAD`/`OPTIONS` methods from mutation limiting.
- **No live credentials** appear in source, documentation, or this repository.
  `scripts/sharedRateLimit-probe.js` is the focused database-free, network-free
  gate; it drives the shared path with an injected deterministic fake and never
  contacts a real Upstash service.

### Dependency-security lockfile closeout

R4 and its dependency-security follow-up are complete and Codex GO. The
production graph resolves `body-parser@2.3.0` and `brace-expansion@2.1.2` after
compatible transitive lockfile updates. `package.json` remained byte-identical;
no direct dependency, override, `--force`, major framework upgrade, or
application-source change was added. `npm audit --omit=dev` and
`npm run qa:audit` both report zero vulnerabilities. Accepted R4 regression
evidence remains full suite `3040/3040`, focused R4 `180/180`, R2 `119/119`,
R3 `86/86`, R1 `24/24`, residue `18/18`, and BE.6 `46/46`. The superseded
pre-R5 authority-sync suite was `3050/3050` with `QUALITY-GATES OK` (+10
`docs-current` checks); after the R5 follow-up the accepted R5 closeout suite is
`3234/3234` with `QUALITY-GATES OK`, and the exact breakdown is recorded in
`docs/test-evidence.md`.

### Subsequent 2026-07-26 dependency advisory remediation

The accepted 2026-07-22 compatible lockfile closeout remains historical
evidence. A subsequent 2026-07-26 npm advisory drift required a reviewed direct
dependency update: production now pins `ejs@6.0.1`, and the former
`jake/filelist/minimatch/brace-expansion` production chain is absent.
`npm audit --omit=dev` and `npm run qa:audit` report zero vulnerabilities. The
change used neither `npm audit fix --force`, an override, a broad update, an
application-source change, nor a migration.

### Bounded anonymous access-denial auditing (M12.P1-R5; complete, Codex GO)

`M12.P1-R5`, its authoritative-global-total follow-up, and its documentation-
gate final correction are complete and Codex GO. It is an audit-write-volume
and privacy boundary, not an access-control change: routine anonymous requests
to login-gated or role-gated routes keep the
exact `302` to `/auth` (browser) and the exact fixed
`401 { success:false, message:'Authentication required.' }` (JSON) while
creating **zero** `system_logs` rows. Before R5, every logged-out request to a
protected route wrote one immutable audit row, so ordinary crawler and
bookmark traffic could amplify the audit table on a publicly reachable
deployment.

The single retained authorization-denial write is the authenticated wrong-role
case. It is dispatched through an authenticated-only helper in
`middleware/roleAuth.js` that refuses any actor without a positive integer id
and a non-blank role, and it keeps `event_type='authorization'`,
`action='access.denied'`, `outcome='denied'`, `target_type='route'`, the
query-free request path, and a fixed sanitized message. Real authentication
failures remain audited unchanged. No anonymous-denial table, raw-IP storage,
Redis denial record, periodic aggregation job, dependency, or migration was
introduced, and the audit trail stays append-only.

The R5 follow-up closed two independent Codex findings. The focused probe now
also captures a stable authoritative baseline of the unfiltered `system_logs`
total (`summary.total`) immediately before the anonymous batches — bounded,
condition-based, accepted only after two consecutive equal reads — and asserts
that total is unchanged across six consecutive reads afterward, proving the
twenty anonymous requests added zero rows of any taxonomy rather than merely
none of the filtered authorization/denied taxonomy. Separately, both reusable
grounding prompts in `docs/new-session-grounding-prompts.md` were corrected to
current authority and are now validated by a dedicated documentation gate that
extracts and independently checks each fenced prompt body.

`M12.P1-R6` is complete and Codex GO. It self-hosts the exact reviewed browser
dependencies, contracts the
obsolete executable CDN origins out of CSP, and proves the affected map/VR/admin
surfaces through focused and independent browser evidence. `M12.P1-R7` is
complete and Codex GO.

Deployment impact of R6: the deployed package now carries `public/vendor` —
18 shipped runtime/license files plus `public/vendor/manifest.json`, 19 files
and 1,560,376 bytes in total. The
browser fetches no executable script or stylesheet from any external origin.
The only external origins a deployed page may still contact are Google Fonts
(`fonts.googleapis.com`, `fonts.gstatic.com`), OpenStreetMap tiles
(`*.tile.openstreetmap.org`), the Iconify data API (`api.iconify.design`), and
Cloudinary media delivery (`res.cloudinary.com`) — all data, media, or fonts,
never executable. `worker-src 'self' blob:` must be preserved: the MapLibre UMD
bundle spawns its map worker from a `blob:` URL.

Every shipped `/vendor` asset's provenance is pinned INDEPENDENTLY of
`public/vendor/manifest.json` in `EXPECTED_VENDOR_INVENTORY` (probe code),
verified against official `npm view`/`npm pack`: the analyzer and the in-suite
`self-hosted-vendor` gate fail closed on any divergence and re-verify disk and
HTTP bytes against the pinned SHA-256s, so a coordinated bytes-plus-manifest-hash
swap fails without an explicit reviewed code change. Accepted R6 Codex GO
evidence: focused `230/230`, full suite `3415/3415` with `QUALITY-GATES OK`
(pre-remediation `3375/3375`), and the complete independent desktop/mobile
affected-page and missing-library browser matrix green.

### M12.P1-R7 Vercel Package and Static-CDN Boundary (complete; Codex GO)

`M12.P1-R7` and both source-auditability corrections are complete and Codex GO.
Its execution prompt in `CLAUDE_HANDOFF.md` is spent and archived under
`Historical Spent One-Shot R7 Execution Prompt`; it authorizes nothing further.

**Source-auditability remediation and audited-source list pinning (closed).**
The independent Codex R7 review found one blocking defect: a
single literal `0x00` byte in `scripts/vercelPackageBoundary-probe.js` (former
line 564, offset 25235) inside `computeAggregateSha256()`. The NUL separator is
intentional at runtime, but the literal source byte made ordinary
`rg`/`grep`/`git diff` classify the whole JavaScript file as binary, silently
removing a security-relevant file from source review. The byte was replaced with
the textual JavaScript escape `\0` (ASCII `0x5c 0x30`); the file grew by exactly
one byte, every other byte is identical, and the R7-closeout package preview
was unchanged (154 files, 6,166,956 bytes, aggregate `c7c16ed7…38b9ec`), proving
runtime behaviour is identical. The aggregate is abbreviated here on purpose:
this file is scanned for secret-shaped values and a full 64-character hex run
trips that scan. The complete value is recorded in `docs/test-evidence.md`,
`docs/security-checklist.md`, and the handoffs. A frozen audited-source set
(`.vercelignore`, `vercel.json`, `scripts/vercelPackageBoundary-probe.js`,
`scripts/quality-gates.js`) and a fail-closed `containsLiteralNulByte()` guard
the NUL contract. The independent Codex re-review then found a fail-open
substitution gap: the in-suite assertion trusted the probe's exported
`R7_AUDITABLE_SOURCE_FILES` wholesale, so swapping `scripts/quality-gates.js`
for another existing NUL-free file (e.g. `package.json`) still passed. The gate
now pins the audited-source list INDEPENDENTLY in
`EXPECTED_R7_AUDITABLE_SOURCE_FILES` (declared in `scripts/quality-gates.js`,
never derived from the probe) and requires EXACT ORDERED EQUALITY with the
exported list before accepting the byte scan. Accepted R7 Codex GO evidence is
focused `71/71`, in-suite `vercel-package-boundary` `70/70`, full suite
`3495/3495` with `QUALITY-GATES OK`, and `npm audit --omit=dev` at zero
vulnerabilities. The superseded literal-NUL
remediation candidate was `71/71`, in-suite `69/69`, suite `3494/3494`; the
superseded initial R7 candidate was `70/70`, in-suite `67`, suite `3492/3492`.
Following the accepted 2026-07-22 dependency closeout, a subsequent
2026-07-26 npm advisory drift is remediated: production pins `ejs@6.0.1`, the
`jake/filelist/minimatch/brace-expansion` chain is absent, and
`npm audit --omit=dev` reports zero vulnerabilities.
Expanded D7 is complete and Codex GO. Accepted D7 evidence is the fresh-context
role-isolation rerun: separate Playwright `BrowserContext` objects per role with
no storage carryover, both MySQL and Supabase legs completed and cleaned up
through supported application interfaces, `npm test` `3511/3511` with
`QUALITY-GATES OK`, `npm audit --omit=dev` at zero vulnerabilities, and
postconditions `24/24 -> 18/18 -> 46/46` with fingerprint
`a1e11ac0...92591d`
unchanged. The post-D7 logout-output hygiene remediation is independently
Codex-accepted as additive evidence: `3529/3529` with `QUALITY-GATES OK`, zero
escaped logout-error lines, audit zero, and postconditions
`24/24 -> 18/18 -> 46/46`; it does not supersede D7. `M12.P1-R8` is the next
potential section and is read-only; it
requires a separate owner-authorized review prompt, and even R8 GO authorizes
only a separate owner deployment decision. M12.P1 remains NO-GO for deployment
and pilot readiness.

**Upload boundary.** The root `.vercelignore` is an allowlist: it begins with
`/*`, re-includes only `server.js`, `package.json`, `package-lock.json`,
`vercel.json`, and the ten runtime directories (`config`, `controllers`,
`middleware`, `models`, `repositories`, `routes`, `services`, `utils`, `views`,
`public`) with their descendants, then denies `public/img/sample 360/` and
`public/img/sample 360/**` AFTER the `public` re-inclusion. A new root file or
directory is therefore excluded by default. `.env*`, documentation and
handoffs, `scripts/`, `database/` and its migrations, screenshots and evidence
media, Docker files, local agent metadata, `node_modules`, logs/caches/temporary
material, and Git metadata are all excluded.

**Current package size after the 2026-07-26 dependency and bounded
session-store remediations.** 154 files
and 6,165,772 bytes, aggregate `44172479…c5910a`: 4 root files, 56 public assets
(68 minus the 12 excluded local panoramas), `config` 12, `controllers` 15,
`middleware` 8, `models` 1, `repositories` 8, `routes` 8, `services` 8, `utils`
8, `views` 26.

**Static/PWA headers.** The root `vercel.json` carries exactly `$schema` and
`headers`. Seven narrow rules: `X-Content-Type-Options: nosniff` on
`/css/:path*`, `/js/:path*`, `/img/:path*`, `/vendor/:path*`, and
`/manifest.webmanifest`; `Cache-Control: no-cache`, `Service-Worker-Allowed: /`,
and `nosniff` on `/sw.js`; and `nosniff`, `Referrer-Policy: no-referrer`, and
one fixed static-only CSP on `/offline.html`. There is no `builds`, `functions`,
`routes`, `rewrites`, `redirects`, framework/build/install override, or
catch-all rule. Long-lived immutable caching is deliberately NOT set because
these asset URLs are not content-hashed.

**CSP authority.** Express's per-response nonce CSP in
`middleware/securityHeaders.js` is untouched and remains the sole CSP authority
for dynamic responses; `script-src` is still exactly `'self'` plus the nonce.
The only static CSP is the session-neutral offline shell. Per Vercel's
documentation, headers set by a Function response take precedence over
file-based configuration, so the two never compete.

**Entrypoint.** `server.js` still exports the Express app and still opens a
listener only as the main module — the supported root-entrypoint detection path.
There is no `api/` duplicate, adapter, or `.vercel/` metadata.

**Verification.** `scripts/vercelPackageBoundary-probe.js` is standalone,
read-only, database-free, session-free, and external-network-free; it pins the
expected contract in probe code OUTSIDE both configuration files and proves the
static boundary from a temporary root served on dedicated port `3385`
(representative CSS/JS/icon/manifest/offline/service-worker/image plus all 18
vendored runtime files served 200 byte-identical; missing asset, excluded
panorama in decoded-space and percent-encoded forms, excluded root classes, and
traversal all `404` with no redirect). The in-suite `vercel-package-boundary`
gate drives the same analyzers with independent negative fixtures.

R7 changed no package manifest, created no upload archive or immutable
deployment manifest, linked no Vercel project, created no `.vercel` metadata,
and deployed nothing. Its console-only package preview describes the dirty
worktree and cannot become accepted upload evidence until a separately
authorized clean immutable Git snapshot exists.

Superseded, historical: the earlier documentation/authority synchronization
candidate run was RED and is not accepted deployment evidence. It ended with
nine failures after Supabase logout/session-destroy failures left unexpired
canonical administrator and student sessions; that post-run safety check was
`22/24`, the embedded residue gate was red, and the embedded BE.6 gate did not
establish its frozen postcondition. That blocker is closed: a separately
owner-authorized supported cleanup/restoration was performed and independently
reproduced, and the R6 session re-verified safety `24/24`, residue `18/18`, and
BE.6 `46/46` before editing and again after its full-suite run.

### M12.P1-R8 clean-snapshot candidate package inventory (current candidate record)

This section records the CURRENT candidate inventory. It is additive: the
accepted `M12.P1-R7` closeout values in the section above are unchanged
historical evidence and are deliberately not overwritten.

Aggregate hashes are abbreviated here, matching this file's existing
convention; the full values are recorded in `docs/test-evidence.md`.

| Record | Files | Bytes | Aggregate SHA-256 |
| --- | --- | --- | --- |
| Accepted R7 closeout (historical; unchanged) | 154 | 6,166,956 | `c7c16ed7…38b9ec` |
| R8 clean-snapshot candidate (reviewed; CANDIDATE NO-GO) | 155 | 6,172,845 | `d8830164…c2fe9e9f` |
| R8 pilot-readiness correction candidate (superseded) | 157 | 6,192,992 | `0ae9f57d…ab999a1c` |
| R8 re-review correction candidate (superseded) | 157 | 6,194,154 | `77e34105…e1a8551a` |
| **Current deployed baseline `d422b54`** | **158** | **6,201,603** | **`28403afa…b664d3636`** |
| **Current local schedule-audit correction candidate** | **158** | **6,201,747** | **`acfb1696…da42e8b1`** |

The deployed baseline adds one packaged file versus the superseded 157-file
record — `public/js/public-nav.js`, the shared anonymous-navbar client — under a
directory the allowlist already re-includes, so no new packaged path class
appears. Its remaining byte delta is confined to already-packaged files
(`views/landing.ejs`, `views/partials/navbar.ejs`, `views/auth.ejs`,
`views/complete-registration.ejs`, `public/css/styles.css`).
The local candidate keeps the same 158-file set and adds 144 bytes only in the
already-packaged `services/auditService.js`; its package record is not a
deployment decision.

The superseded 157-file record described a candidate that added two packaged
files — `views/privacy.ejs`
and `public/robots.txt` — plus a byte delta inside files that were already
allowlisted (`server.js`, `middleware/securityHeaders.js`,
`controllers/pageController.js`, `routes/index.js`, `public/css/styles.css`,
`views/auth.ejs`, `views/complete-registration.ejs`,
`views/partials/footer.ejs`). No new packaged path class is introduced: both new
files sit under directories the allowlist already re-includes.

Two changes separate the two records, and neither adds a new packaged path
class:

1. **`utils/buildingParticipantView.js` (+1 file).** This module was created
   after the R7 closeout was accepted, during the cross-role regression work,
   so the accepted R7 preview legitimately predates it. It is live runtime
   source, not verification residue: `controllers/buildingsController.js`
   requires it to build the participant Buildings page's display-only
   additional-details shape, and `scripts/buildingDetailsEditor-probe.js`
   exercises the same exported helpers. It performs formatting only — no
   database access, network call, credential, or stored contract change — and
   the public building JSON API keeps its existing raw shape.
2. **Byte delta within already-packaged files.** The admin-dashboard
   truthfulness correction edited `views/admin/index.ejs` and
   `controllers/adminController.js`, and the subsequent hygiene correction
   removed twelve trailing-whitespace bytes from `views/buildings.ejs` — all
   three already inside the allowlist.

The boundary contract itself is unchanged: the allowlist, the seven header
rules, the static-only `/offline.html` CSP, and Express's sole authority over
the per-response nonce CSP for dynamic responses are all as accepted at R7
closeout, and the focused probe still passes `71/71`.

This inventory describes the COMPLETE clean-snapshot candidate tree — the
committed repository state. The candidate's commit SHA is reported externally in
the session report and handed to the reviewer there; it is deliberately not
embedded in this file, because a commit cannot contain its own identifier.

**Inventory label (corrected in the R8 pilot-readiness correction).** The focused
probe previously stamped its output
`CURRENT DIRTY-WORKTREE BOUNDARY PREVIEW — NOT AN IMMUTABLE DEPLOYMENT MANIFEST`.
That was accurate while the deployable application lived in an uncommitted
working tree, but it became false once the complete intended state was committed,
and it contradicted this section. The label is now
`CURRENT VERCEL PACKAGE BOUNDARY INVENTORY - NOT DEPLOYMENT AUTHORIZATION`,
which stays neutral about worktree state (which the probe does not inspect) and
keeps the disclaimer that matters: enumerating the package is not permission to
upload it. The expected label is pinned independently in
`EXPECTED_PACKAGE_INVENTORY_LABEL` inside `scripts/quality-gates.js`, so the gate
never learns it from the artifact it audits, and reverting to the superseded
label fails closed. Accepted historical R7 evidence keeps the original label and
totals as history.

It nevertheless remains CANDIDATE EVIDENCE, not accepted upload evidence. It
becomes accepted evidence only through an independent read-only `M12.P1-R8`
review decision, and nothing here authorizes an upload, a Vercel link, or a
deployment.

The clean-snapshot candidate, its corrections, and the bounded evidence
re-execution recorded under "Bounded evidence re-execution (M12.P1-R8)" below
all await an independent read-only `M12.P1-R8` review decision. No R8 GO, Codex
GO, deployment GO, pilot GO, or Milestone 12 GO is claimed. Accepted `R1`-`R7`
and `D1`-`D7` history is unchanged.

`M12.P1` remains NO-GO for deployment and pilot readiness; deployment is not
authorized.

### Test-only Supabase regression credentials (M12.P1-R1; never runtime config)

The four retained local-login regression identities (admin, student,
instructor, guest) are supplied to authorized QA probes **only** through eight
test-only variables read by the shared loader
(`scripts/regressionCredentials.js`):
`SUPABASE_REGRESSION_ADMIN_EMAIL` / `SUPABASE_REGRESSION_ADMIN_PASSWORD`,
`SUPABASE_REGRESSION_STUDENT_EMAIL` / `SUPABASE_REGRESSION_STUDENT_PASSWORD`,
`SUPABASE_REGRESSION_INSTRUCTOR_EMAIL` /
`SUPABASE_REGRESSION_INSTRUCTOR_PASSWORD`, and
`SUPABASE_REGRESSION_GUEST_EMAIL` / `SUPABASE_REGRESSION_GUEST_PASSWORD`.

- Values live **only** in the ignored local `.env`. They are never committed,
  documented, printed, echoed in errors, exposed to the app or browser, or set
  as Vercel/deployment runtime variables (the application itself never reads
  them).
- Supabase-capable probes **fail closed** with a fixed sanitized message when
  any of the eight values is missing or blank; they never fall back to a
  documented or hardcoded live credential.
- Local MySQL probe runs do **not** use these variables: the deterministic
  local-only MySQL seed fixtures (`database/seed.js`) remain the MySQL-mode
  credentials.
- The read-only `scripts/pilotCredentialSafety-probe.js` verifies the live
  containment state (one row per identity, intended role, role-profile rows,
  replacement-hash match in memory, former-default rejection, zero unexpired
  sessions) without logging in or mutating anything.

---

## 2. Secret handling (read this)

`SUPABASE_SERVICE_ROLE_KEY` is a **privileged, server-only key** — treat it like a
database root password. It must **never** be:

- committed to git (kept only in an untracked local `.env` or the host env),
- rendered in an EJS template, `res.locals`, or `app.locals`,
- placed under `public/` or sent to any browser/`window` global,
- included in screenshots, recordings, logs, or error output,
- baked into a Docker image (it is provided at **runtime** only).

The same applies to `SESSION_SECRET`, `GOOGLE_CLIENT_SECRET`, `DB_PASS`, and the
Cloudinary secrets `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` (and any
signed-upload data). The app's logging is sanitized (no secrets/cookies/session
ids/SQL/stacks in normal output); keep it that way. The Docker image ships
**no** `.env` (see §8).

---

## 3. Supabase SQL apply order

Migrations live in `database/supabase/` and are **applied manually** by the
project owner in the Supabase SQL editor.

**Fresh project** — apply in order:

```
0001_initial_schema.sql
0002_seed_data.sql
0003_auth_profile_functions.sql
0004_building_backfill.sql
0005_building_write_functions.sql
0006_admin_content_and_logs.sql
0007_route_graph_admin_write_functions.sql
0008_profile_update_atomic_function.sql
0009_public_registration_trust_policy.sql
0010_performance_indexes.sql
0011_supabase_session_store.sql
0012_room_schedules.sql
0013_vr_hotspot_schedule_metadata.sql
0014_route_graph_accuracy.sql
0015_route_edge_path_geometry.sql
0016_route_geometry_admin_writes.sql
0017_route_topology_guard_house.sql
0018_cas_building_baseline.sql
0019_be5_selected_demo_parity.sql
```

**Existing project** — apply only the migrations not yet run, in ascending order.
All migrations are written to be idempotent/additive where practical
(`CREATE ... IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`).

> **Production GO gate:** migrations through `0019_be5_selected_demo_parity.sql`
> **must be applied before final production GO** — including
> `0010_performance_indexes.sql` (DB performance/index parity, required by
> `npm run qa:db`), `0011_supabase_session_store.sql` (the server-only
> `public.app_sessions` table required when `SESSION_STORE=supabase`), and
> `0012_room_schedules.sql` (the server-only `public.room_schedules` table
> required by the room-scheduling runtime when `SCHEDULE_DATA_SOURCE=supabase`;
> owner-applied), plus `0013_vr_hotspot_schedule_metadata.sql` (nullable
> schedule-target metadata on VR hotspots for room-door schedule interaction).
> Room schedules are real **admin-managed** room/facility data - not SIS,
> enrollment, or instructor-load simulation. Migrations `0014` through `0019`
> are also owner-applied and provide the verified campus route graph,
> `route_edges.path_geometry`, atomic forward/reverse admin geometry writes, and
> the authoritative Guard House topology, CAS baseline, and selected-demo
> parity.

The verified routing dataset contains 20 nodes, 48 directed edges, 24 exact
forward/reverse pairs, 48 valid geometries, and 13 routable building
destinations in both backends. CampuSphere computes routes from its own campus
graph and renders owner-managed road geometry. Google Maps, Google Earth,
Strava, SIS, and external routing engines are not integrated.
Guided VR reports arrival only when mapped panorama coverage reaches the
selected destination; partial coverage ends with an explicit notice and never
claims arrival.

---

## 4. MySQL fallback setup

The MySQL path is the local-development default and the fallback runtime; it also
backs the session store when `SESSION_STORE=mysql` (the production/demo preference
is `SESSION_STORE=supabase` — see §5).

```bash
node database/seed.js
```

The seed connects without a database first, creates `campusphere_db` from
`database/schema.sql`, runs idempotent migrations (including the Section 8.8
performance indexes via an `ensureIndex` helper), and seeds default content. It
is **idempotent and non-destructive** — safe to re-run.

**Strict mode** for deployment — fail hard if duplicate identity rows would block
a unique constraint (also implied when `NODE_ENV=production`):

```bash
SEED_STRICT_CONSTRAINTS=true node database/seed.js
```

**Default demo accounts** (created by the seed): the seed creates a
deterministic admin and sample-student fixture for **local MySQL development
only**. Their local-only values live in `database/seed.js` and the shared
test-only loader (`scripts/regressionCredentials.js`) and are intentionally no
longer recorded in documentation; they are not valid live credentials. The
live regression accounts (admin, student, instructor, guest) use private
owner-managed replacement passwords supplied to authorized probes only through
the test-only `SUPABASE_REGRESSION_*` variables in the ignored local `.env`
(see §1). Change or remove any seeded fixture before a non-demo deployment.

---

## 5. Production session setup

1. **Preferred:** `SESSION_STORE=supabase` (default in production). Set
   `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (server-only) and apply migration
   `0011_supabase_session_store.sql` so the `public.app_sessions` table exists;
   startup verifies the table and **fails closed** if it is missing/unreachable.
   **Fallback:** `SESSION_STORE=mysql` (provide `DB_*`; the store auto-creates its
   `app_sessions` table at startup). `SESSION_STORE=memory` is **rejected** in
   production, as is any unknown value.
2. `SESSION_SECRET` set, ≥32 chars, non-placeholder. Rotate by moving the old
   value into `SESSION_SECRET_PREVIOUS` and setting a new `SESSION_SECRET`; the
   current secret signs new cookies, previous values only verify old ones.
3. With `NODE_ENV=production` the cookie is named `__Host-campusphere.sid` and is
   `Secure` + `httpOnly` + `SameSite=Lax` + `Path=/` with **no `Domain`**. The
   `__Host-` prefix + `Secure` flag mean the app **must be served over HTTPS**.
4. Behind a reverse proxy / TLS terminator, set `TRUST_PROXY` to the number of
   proxy hops (default `1`) and ensure the proxy forwards
   `X-Forwarded-Proto=https`, or the Secure cookie will not be issued and login
   will silently fail.

The server **fails closed** in production on any missing/unsafe session value
(missing/short/placeholder secret, `SESSION_STORE=memory` or unknown store,
`SESSION_STORE=supabase` without a reachable Supabase / `app_sessions` table,
invalid max-age or trust-proxy) — it logs a fixed sanitized reason and exits
non-zero.

---

## 6. Security middleware & QA

- **CSRF + POST logout** (`middleware/csrfProtection.js`): synchronizer token in
  the session; unsafe requests require `X-CSRF-Token` or `_csrf`. Logout is
  **POST-only** (`GET /logout` → 405) and CSRF-protected; it emits an expiring
  Set-Cookie to drop the session cookie.
- **Rate limiting** (`middleware/rateLimit.js`): see the table in §1. Returns
  sanitized `429` + `Retry-After`.
- **Helmet / CSP** (`middleware/securityHeaders.js`): nonce-based CSP with no
  `unsafe-inline`/`unsafe-eval` for scripts; `upgradeInsecureRequests` is added
  in production. Inline `<script>`/`<style>` elements carry a per-request nonce.
- **PWA privacy boundaries** (`public/sw.js`): authenticated HTML is **never**
  cached; `/auth`, `/login`, `/register`, `/logout`, `/admin`(+`/admin/api/*`),
  and `/api/update-profile` are never intercepted/cached; navigations are
  network-only with an `/offline.html` fallback; only a session-neutral shell +
  approved JSON APIs + approved CDN hosts are cached, all capped.

**QA commands** (npm scripts):

```bash
npm run qa            # contracts + db-perf + supabase-smoke + identity + audit
npm test              # contracts + scheduling + routing/geometry/VR probes in both modes
npm run qa:contracts  # auth/authz/CSRF/rate-limit/404/CRUD/PWA/schedule probes + leak scan
npm run qa:db         # read-only MySQL EXPLAIN/index + Supabase index parity
npm run qa:smoke      # Supabase connectivity smoke (SKIPs cleanly if unconfigured)
npm run qa:identity   # R8 identity/profile uniqueness verifier (MySQL + Supabase)
npm run qa:audit      # npm audit --omit=dev
```

The contract gate boots the app with `SESSION_STORE=mysql` and (when Supabase is
configured) `SESSION_STORE=supabase`, so it verifies the **session-store runtime**,
not just the data-source switches. The Supabase portions SKIP cleanly when
`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are unset — but if
`SESSION_STORE=supabase` or any `*_DATA_SOURCE=supabase` runtime is selected
while the Supabase env or its required migration is unavailable (`0011` for
sessions, `0012` for room schedules), the QA gates and the DB-perf/smoke checks
**fail closed** instead of skipping.

Manual defense evidence and clean-demo notes are tracked separately:

- `docs/test-evidence.md` - black-box evidence checklist and screenshot rules.
- `docs/demo-script.md` - role-based walkthrough script for defense.
- `docs/security-checklist.md` - manual security review cases.
- `docs/usability-survey.md` - SUS-style and satisfaction survey templates.
- `docs/reset-demo.md` - reset/seed and evidence run notes.

---

## 7. OAuth redirect URI variants

The `GOOGLE_REDIRECT_URI` value **must exactly match** an Authorized redirect URI
configured for the OAuth client in Google Cloud Console (scheme, host, port, and
path). Register every environment you use:

| Environment | `GOOGLE_REDIRECT_URI` |
| --- | --- |
| Local `node server.js` / `npm start` | `http://localhost:3000/auth/callback` |
| Docker / Compose on the same machine (host-mapped `3000:3000`) | `http://localhost:3000/auth/callback` |
| Final hosted deployment (HTTPS) | `https://YOUR-DOMAIN/auth/callback` |

Notes:

- Google allows `http://localhost` for development but requires **HTTPS** for any
  non-localhost host.
- Inside a container the app listens on `0.0.0.0:3000`; the **browser** still hits
  the host-mapped `http://localhost:3000`, so the localhost redirect URI applies.
- A mismatch yields a Google `redirect_uri_mismatch` error (see §9).

---

## 8. Docker packaging

The image (`Dockerfile`) is `node:24-bookworm-slim`, installs production deps with
`npm ci --omit=dev`, copies **only** the named app folders (no `COPY . .`), runs
as the non-root `node` user, sets `NODE_ENV=production` + `PORT=3000`, exposes
`3000`, and runs `node server.js`. Secrets are provided at **runtime only**;
`.dockerignore` keeps `.env`, `node_modules`, `.git`, logs/caches, Playwright
folders, screenshots/images, PDFs/DOCX, and DB dumps out of the build context.
Use Node 22 or newer for non-Docker deployments; the Supabase runtime path
depends on native WebSocket support from modern Node.

**Build & run (Supabase-backed runtime, secrets via runtime env):**

```bash
docker build -t campusphere:m9 .

# Fully Supabase-backed production (preferred): Supabase data + Supabase sessions.
# Requires migrations 0011 and 0012 applied; no MySQL needed.
docker run --rm -p 3000:3000 \
  -e NODE_ENV=production \
  -e SESSION_STORE=supabase \
  -e SESSION_SECRET="<a-long-random-32+char-secret>" \
  -e AUTH_DATA_SOURCE=supabase -e CONTENT_DATA_SOURCE=supabase \
  -e BUILDING_DATA_SOURCE=supabase -e ROUTE_DATA_SOURCE=supabase \
  -e VR_DATA_SOURCE=supabase -e SCHEDULE_DATA_SOURCE=supabase \
  -e MAP_RENDERER=maplibre \
  -e SUPABASE_URL="<url>" -e SUPABASE_SERVICE_ROLE_KEY="<server-only-key>" \
  -e TRUST_PROXY=1 \
  campusphere:m9
```

> Production over HTTPS: `NODE_ENV=production` issues the Secure `__Host-` cookie,
> so terminate TLS in front of the container and forward
> `X-Forwarded-Proto=https` with `TRUST_PROXY` set (see §5). An env-only
> `.env` file can be passed with `--env-file ./prod.env` instead of repeating
> `-e` flags (the file stays on the host, never in the image).

Supabase is an **external** cloud service — there is no database in the image.
Docker also supports the **MySQL fallback**: set `SESSION_STORE=mysql` with `DB_*`
pointing at a reachable MySQL (and `*_DATA_SOURCE=mysql` for MySQL data), e.g. the
Compose rehearsal below. That is a fallback / local-rehearsal path, **not** the
production preference.

### Vercel demo / UAT (Milestone 9+)

Vercel is a **demo/UAT** target only — **not** the full production path (Docker
remains that, per `ROADMAP.md`). Because Vercel cannot rely on a local MySQL, the
demo must use the Supabase session store:

BE.6 and OFF.1 are complete and Codex GO. The owner has authorized `M12.P1`, a
limited pilot exception, but deployment still requires a separate readiness GO
and owner authorization. The pilot exposes the full authenticated application
while facilitators guide students and guests to routing; it is not a technical
routing-only mode and must not claim offline readiness. Feedback uses an
owner-created Google Form. OFF.2 through OFF.6 resume after pilot review and
remain mandatory before final Milestone 12 GO. The selected 13-building demo
roster is not the complete campus; later admin edits and additions require
refreshed freeze evidence rather than being prohibited.

#### Pilot participation model (owner decision, M12.P1-R8)

The pilot is **facilitator-mediated**. Randomly selected participants are
guided through the application by a facilitator during a session. Participants
register through **Sign in with Google**, and the application derives the role
from the verified email domain:

| Email domain | Role assigned |
| --- | --- |
| `@my.cspc.edu.ph` | `student-cspc` |
| `@cspc.edu.ph` | `instructor` |
| `@gmail.com` | `guest` |

The Google OAuth client stays in **Testing** publishing status. CampuSphere
requests only the `openid`, `email` and `profile` scopes. Because those three
are covered by Google's documented **basic-identity exception**, participants do
**not** need to be registered individually before they can sign in, and no
per-participant OAuth roster is maintained.

Three consequences follow, and all three are deliberate:

1. **The OAuth publishing status is not an access-control boundary.** It governs
   which Google consent experience is shown, not who may reach the application.
2. **Local email/password registration remains open** and creates a `guest`
   account only. That guest-only restriction is enforced twice — in
   `controllers/authController.js` and again in the SQL boundary redefined by
   `database/supabase/0009_public_registration_trust_policy.sql` — so no
   institutional or admin role can ever be self-registered. Facilitators direct
   participants to the Google path; the local path is the documented fallback.
3. **Access control is the session/role layer**, not the sign-in provider. Every
   participant-reachable surface is behind `requireLogin`, and `/admin` is behind
   `requireRole('admin')` (`middleware/roleAuth.js`).

Do not change the scopes, credentials, callback URL, publishing status, or the
domain-to-role mapping as part of pilot preparation.

#### Automated pilot-rehearsal evidence safety contract

An automated production rehearsal uses **three user-scoped, isolated
Playwright MCP servers** (administrator, student, and guest), each with a
distinct absolute operating-system temporary output directory outside the
repository. Before any production navigation, each context must prove that it
has zero CampuSphere cookies and empty `localStorage` and `sessionStorage`.
Tabs in one shared browser context are not a substitute for this isolation.

Every interaction must start from a fresh accessibility snapshot and use a
semantic selector that is re-resolved immediately before the action. A stale
element reference must be discarded; it must never be retried or guessed in a
different context. `browser_evaluate` may be used only for a narrowly scoped,
non-mutating measurement and must not return `document.body`, `innerHTML`, all
inputs, hidden profile fields, cookies, storage, or personally identifiable
information (PII) such as a participant name, email, student ID, phone number,
or address. Console and network evidence records only origin and pathname; it
must strip query strings and fragments, including OAuth parameters.

The executor records `git status --porcelain` before and after the rehearsal
and stops if any repository artifact appears. Screenshots and transcripts must
remain in the three operating-system temporary output directories. The student
account must be a fresh `@my.cspc.edu.ph` identity whose resulting
`student-cspc` role is verified; an existing role-mismatched account is not a
valid substitute. Sparse CAS content is truthful frozen-dataset evidence and
must not be fabricated, filled, or edited for the rehearsal.

Cleanup uses only the supported administrator interface for the two uniquely
identified rehearsal accounts and the real logout interface for every opened
session. No direct SQL, broad cleanup, session-row deletion, migration, or
dataset mutation is permitted. An earlier automated rehearsal disclosed an
over-broad page evaluation, raw OAuth URL/query capture, temporary files that
resolved inside the repository, and one stale-reference misclick. Those are
procedure/evidence-handling deviations, not application findings, and this
contract prevents their recurrence without erasing the disclosure.

#### Bounded evidence re-execution (M12.P1-R8; candidate evidence)

A separately owner-authorized bounded evidence re-execution has been completed.
It gathered evidence only — no source edit, commit, SQL, migration, Vercel
operation, or OAuth configuration change was made — and it is candidate evidence
awaiting an independent read-only `M12.P1-R8` review.

- **Local authenticated exposure matrix, clean bounded re-execution.** MySQL
  `34/34` plus a `14/14` supplement, Supabase `64/64` plus a `14/14` supplement:
  `126/126` with zero failures. A separate fresh browser context per role, each
  proven to carry zero cookies and zero web storage before authentication. Every
  authenticated session was registered with `scripts/probeSessionLifecycle.js`
  immediately after login and terminated exactly once through `terminateAll()`
  and the real CSRF-protected `POST /logout`. No `429` occurred, no failed logout
  was retried, `services/sessionRevocation.js` was never imported or called, and
  no session row was deleted directly and no database cleanup was performed.
  Final ordered postconditions were `24/24 -> 18/18 -> 46/46`.
- **`SEC-05`, the unsupported-domain OAuth flow.** Executed externally and
  passed. The flow reached `accounts.google.com` requesting exactly `openid`,
  `email` and `profile`; the unsupported-domain Google account completed Google
  authorization and returned to CampuSphere; CampuSphere redirected to
  `/auth?error=unauthorized_domain` with a sanitized message that echoed no
  email address and no raw error. Supabase `users` held 6 rows before and 6 rows
  after with zero rows on unsupported domains, no user or role-profile row was
  created, and no pending OAuth registration persisted. No scope, credential,
  redirect URI, publishing status, or test-user configuration was changed.
- **Pilot feedback form.** Opened anonymously; the responder page rather than
  the editor UI; accepting responses; no email collection; 10/10 SUS-style
  statements, 8/8 satisfaction questions, and 4/4 open-feedback prompts present.
  Nothing was submitted and no response row was created. `READY` as external
  owner evidence; the responder URL stays outside Git.

The first execution of that exposure matrix is historical/superseded and is
explicitly **not** accepted evidence: rate-limit `429`s disturbed it and an
orphaned session was cleared by calling `revokeUserSessions` directly rather
than through the supported logout interface.

`SEC-51`, the Vercel production smoke, has been executed against
`https://campusphere-cspc.vercel.app` twice. SHAs are abbreviated throughout this
file deliberately — it is covered by the long-hex secret scan; the full values
are recorded in `docs/test-evidence.md`, `docs/security-checklist.md`, and the
independently pinned gate.

| Record | Baseline | Status |
| --- | --- | --- |
| First accepted production smoke (historical/superseded) | `78d9053` | Before the corrected baseline was deployed, this was externally executed and accepted; it is superseded by the baseline below |
| **Current corrected production baseline** | **`d422b54`** | **Read-only smoke independently completed by Codex; SEC-51 CODEX GO** |

The current smoke established that the exact production hostname serves
`d422b54`, that dynamic surfaces returned the expected CSP and
`X-Robots-Tag: noindex, nofollow, noarchive`, that `/robots.txt` and
`/offline.html` retained their contracts, that anonymous `/dashboard`, `/map`,
`/buildings`, and `/admin` were denied through the expected redirect contract,
that the Google OAuth start used `accounts.google.com` with `response_type=code`
and scopes `openid email profile` against the exact production callback, and
that at 1440x900 and 390x844 the corrected landing copy, navbar `aria-expanded`
lifecycle, and non-overlapping auth theme control all behaved as locally
verified — with zero CSP violations, console errors, page errors, failed
requests, or horizontal overflow.

The three pilot-surface corrections — landing role-mapping copy, the shared
accessible anonymous navbar, and the auth-scoped in-card theme control — are
**deployed** on `d422b54`, with production `public/js/public-nav.js` and
`public/css/styles.css` byte-identical to that baseline.

The smoke was **read-only**: no authenticated production login was performed, so
the M12.P1-R2 and M12.P1-R3 session-store and bootstrap evidence stands
unchanged and is not restated as new. The correction changed no session-store or
bootstrap implementation.

The subsequent SEC-51 evidence and quality-gate synchronization at
Repository HEAD `db034e5581e6f409083a43dcb80fb82b473e0127` is a
documentation-only commit and gate-work candidate; it is **not a runtime
deployment**, does not change production, and remains unaccepted pending
independent read-only review. That synchronization commit is
LATER than the deployed runtime baseline, not earlier: it is the child of
`d422b543`. The present local candidate additionally repairs the schedule-audit
allowlist; production remains on `d422b54`, and independent review is still
required.
Nothing in this subsection is an R8 GO, a deployment
GO, a pilot GO, or a Milestone 12 GO.

#### Pilot indexing protection (M12.P1-R8)

The pilot runs on a public production hostname. Vercel applies an automatic
`noindex` to **preview** deployments only, so a production deployment is
crawlable unless the application says otherwise. Two voluntary directives are
therefore shipped:

- `middleware/securityHeaders.js` exports `pilotNoIndex`, mounted in `server.js`
  beside the security headers, which sets exactly
  `X-Robots-Tag: noindex, nofollow, noarchive` on **every** response — the
  anonymous `/`, `/auth` and `/privacy` pages, authenticated HTML, JSON APIs,
  the readiness `503`, rate-limit `429`s, and error pages.
- `public/robots.txt` contains exactly `User-agent: *` and `Disallow: /`.

**Indexing control is not access control.** Both are requests that well-behaved
crawlers honour. They reduce incidental search-engine discovery of the pilot.
They do not authenticate, authorize, rate-limit, or block anybody, and a crawler
or person that ignores them is stopped only by the session/role controls above.

#### Participant privacy notice (M12.P1-R8)

`GET /privacy` renders `views/privacy.ejs` and is deliberately **anonymous**: a
prospective participant must be able to read it before an account exists. It
touches no session and performs no database access. It is linked from the
anonymous footer, the sign-in/registration page, and the OAuth
complete-registration step — the screen that actually collects the
role-specific profile fields.

The notice states what is collected (identity, role/profile, authentication,
session, and security/audit data), why, and which services handle it (Vercel,
Supabase, Upstash, Google, Cloudinary). It records the exact requested Google
scopes, states that pilot feedback goes to a separate owner-created Google Form
that CampuSphere never receives or stores, describes retention as **30 days past
the final defense followed by owner-managed manual deletion unless CSPC requires
longer**, sets out data-subject rights under RA 10173, and links the official
CSPC policy at <https://cspc.edu.ph/governance/privacy-policy/>.

It deliberately makes **no** consent, legal-basis, automatic-deletion, or
data-sharing claim; the `pilot-readiness` gate rejects the notice if any of those
appear.

#### Required Vercel Project environment variables (complete checklist)

Every value below is a **server-only** Vercel Project Settings → Environment
Variables entry. None may appear in client code, an EJS template, `public/`, a
browser global, a response body, a log, a screenshot, or a commit. Never use a
public/`NEXT_PUBLIC_`-style name for any of them.

**(A) The 14 fail-closed production-profile entries.** `config/vercelProductionProfile.js`
requires **all fourteen** when `VERCEL=1`. A missing, blank, misspelled, or
conflicting value produces one fixed sanitized refusal and a nonzero exit — the
app will not serve, and it can never fall back to MySQL, Leaflet, or memory
sessions. All fourteen are mandatory; there is no partial mode:

| # | Variable | Required value / shape |
| --- | --- | --- |
| 1 | `NODE_ENV` | exactly `production` |
| 2 | `SESSION_STORE` | exactly `supabase` |
| 3 | `AUTH_DATA_SOURCE` | exactly `supabase` |
| 4 | `CONTENT_DATA_SOURCE` | exactly `supabase` |
| 5 | `BUILDING_DATA_SOURCE` | exactly `supabase` |
| 6 | `ROUTE_DATA_SOURCE` | exactly `supabase` |
| 7 | `VR_DATA_SOURCE` | exactly `supabase` |
| 8 | `SCHEDULE_DATA_SOURCE` | exactly `supabase` |
| 9 | `MAP_RENDERER` | exactly `maplibre` |
| 10 | `SUPABASE_URL` | HTTPS URL with a hostname, no embedded URL username/password |
| 11 | `SUPABASE_SERVICE_ROLE_KEY` | server-only secret: `sb_secret_…` or a legacy HS256 `role=service_role` JWT |
| 12 | `UPSTASH_REDIS_REST_URL` | HTTPS URL with a hostname, no embedded URL username/password |
| 13 | `UPSTASH_REDIS_REST_TOKEN` | nonblank server-only REST token, never a documented placeholder |
| 14 | `RATE_LIMIT_KEY_SECRET` | server-only HMAC key, **at least 32 characters**, never a documented placeholder |

**(B) Separately required — not part of the 14-entry preflight.** These are
validated elsewhere (or only when the feature is used), so the preflight passing
does **not** mean they are set:

- `SESSION_SECRET` — required in production by `config/sessionConfig.js`, which
  refuses to start on a missing, placeholder, or under-length value. Optional
  `SESSION_SECRET_PREVIOUS` values must clear the same bar.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` — the Google
  OAuth trio. If the ID or secret is absent, `/auth/google` is silently disabled
  and redirects to `/auth?error=oauth_failed`.

**(C) Required external owner evidence.** These are not repository values and
cannot be produced by any agent:

- The **exact HTTPS `/auth/callback` redirect URI** for the deployed hostname —
  e.g. `https://<project>.vercel.app/auth/callback` — set as `GOOGLE_REDIRECT_URI`
  **and** registered as an Authorized redirect URI in the Google Cloud console.
  It must be `https://`, must match byte-for-byte on both sides, and each Vercel
  preview hostname needs its own registered URI.
- The **owner-created Google Form feedback URL**, to be handed to facilitators.
  CampuSphere adds no feedback table, API mutation, or migration.

Also apply migration `0011_supabase_session_store.sql` to the Supabase project
before the first deploy (see the SQL apply order section; migrations `0001`
through `0019` are owner-applied).

#### Fail-closed Vercel production profile (M12.P1-R2)

When the platform-provided `VERCEL=1` indicator is present, `server.js` runs a
**pure synchronous preflight** (`config/vercelProductionProfile.js`) against
the **platform-injected `process.env` before dotenv runs** — so an
accidentally packaged repository `.env` can never backfill a missing or
misspelled Vercel Project variable — and **before** any backend client,
session configuration/store, middleware, controller, or route is imported.
dotenv loads quietly only after the preflight succeeds (or no-ops outside
Vercel). The preflight requires **exactly** this matrix:

```
NODE_ENV=production
SESSION_STORE=supabase
AUTH_DATA_SOURCE=supabase
CONTENT_DATA_SOURCE=supabase
BUILDING_DATA_SOURCE=supabase
ROUTE_DATA_SOURCE=supabase
VR_DATA_SOURCE=supabase
SCHEDULE_DATA_SOURCE=supabase
MAP_RENDERER=maplibre
SUPABASE_URL=<https URL with a hostname; no embedded URL username/password>
SUPABASE_SERVICE_ROLE_KEY=<nonblank SERVER-ONLY Supabase secret>
UPSTASH_REDIS_REST_URL=<https URL with a hostname; no embedded URL username/password>
UPSTASH_REDIS_REST_TOKEN=<nonblank SERVER-ONLY Upstash REST token>
RATE_LIMIT_KEY_SECRET=<server-only HMAC key, at least 32 characters>
```

The last three are the M12.P1-R4 shared rate-limit store (see *Shared
rate-limit store* above). They are required on Vercel only, are validated with
the same fixed sanitized refusal, and are never required for local development.

Any missing, blank, misspelled, or conflicting value makes startup print one
fixed sanitized refusal and exit nonzero — the offending setting name and the
supplied value are never echoed, and Vercel can never fall back to MySQL,
Leaflet, or memory sessions. Exactly two server-only key **shapes** are
accepted: an opaque secret key (`sb_secret_` + at least 20 characters from
`[A-Za-z0-9_-]`) or a legacy three-segment JWT whose decoded header has `alg`
exactly `HS256` and whose decoded payload has `role` exactly `service_role`
(shape-only structural decoding — no signature verification, network call, or
claim logging). Documented placeholders, browser/publishable keys
(`sb_publishable_…`, `sb_anon_…`, case-insensitive), generic or short strings,
malformed JWTs, and anon/authenticated-role JWTs are all rejected.
All secrets remain **server-only** Vercel environment variables (never client
code or `NEXT_PUBLIC_`-style names). The preflight validates configuration
shape only and performs **no network request**: live Supabase connectivity
and session-store readiness are verified separately at startup/bootstrap.
Outside Vercel the preflight is a no-op and the documented MySQL/Leaflet
local-development fallbacks are unchanged
(`scripts/vercelProductionProfile-probe.js` is the focused database-free
gate).

#### Awaited runtime and session bootstrap (M12.P1-R3)

> **Session hygiene and ownership follow-ups (complete; Codex GO).** Session
> regeneration discards the anonymous CSRF token, so
> `establishAuthenticatedSession` mints the replacement via `ensureCsrfToken`
> BEFORE the explicit save — the persisted authenticated session already
> carries the token the first rendered page shows, which is what makes an
> immediately submitted HTML logout form valid under the Supabase session
> store. For test tooling, `scripts/with-server.js` resolves the child
> `SESSION_STORE` from the normalized data mode when `sessionStore` is omitted
> and fails closed on a blank/invalid explicit value, so an ambient value can
> never leak into a probe leg. The ownership gate's import detector uses a
> lexical-state line scanner rather than global comment stripping; a
> backslash-continued newline (LF or CRLF) now advances the physical-line
> accounting by exactly one, so a declaration inside a continued string value is
> rejected and a real import on a later line is still found. Accepted Codex GO
> evidence: full suite `2921/2921` with `QUALITY-GATES OK`,
> in-suite
> resolver `14/14` and residue `18/18`, standalone R1 `24/24`, R2 `88/88`,
> R3 `86/86`, BE.6 `46/46`.

> **Status: R3, R4, R5, both R5 follow-ups, dependency-security remediation,
> `M12.P1-R6`, `M12.P1-R7`, and expanded D7 are complete; Codex GO.** None of
> these results authorizes deployment or pilot readiness; M12.P1 remains NO-GO
> and deployment requires a later R8 GO plus a separate owner decision.

The preflight above validates *configuration*. Session-store *readiness* is a
separate boundary, coordinated by `services/sessionReadiness.js`.

`server.js` resolves the session policy, constructs **at most one** store, and
creates **one** readiness coordinator before mounting any middleware.
Constructing that coordinator starts exactly one eager `init()` attempt. The
same promise instance is then used by both entry paths:

- **Local / Docker (`node server.js`, `npm start`)** — `start()` awaits the
  readiness promise and only then calls `app.listen()`. A failed bootstrap
  prints the fixed sanitized line
  `[startup] Session store initialization failed. Refusing to start.` exactly
  once and exits nonzero **without opening a listener**. `start()` runs only
  under `require.main === module`.
- **Vercel / any importer** — `module.exports = app` means the platform
  imports the app and dispatches requests into it; `app.listen()` is never
  called, so there is no startup await on that path. Importing the module
  therefore binds no port. Readiness is instead enforced per request by a gate
  mounted immediately after the security headers and **before** rate limiting,
  the body parsers, static serving, `express-session`, the authenticated
  no-store middleware, CSRF, the logger, the routes, and the error handlers.

Gate behaviour, by readiness state:

| State | Behaviour |
| --- | --- |
| pending | The request is **held** — neither forwarded nor answered — until the single in-flight attempt settles. |
| ready | The request proceeds exactly once. |
| failed | The request receives `503` with `Cache-Control: no-store` and exactly `{"success":false,"message":"Service temporarily unavailable."}` |

Because one shared promise backs everything, concurrent first requests on a
cold Vercel instance cannot produce a second initialization, a second store, a
duplicate cleanup timer, or a duplicate listener. There is **no retry, no
timeout, and no fallback store**: once the attempt fails the instance stays
failed, and recovery is a redeploy/restart concern rather than a per-request
one. The gate logs nothing per request and never inspects the initialization
error, so a backend host, key, or stack cannot reach a response body or the
process output through this path. It responds directly rather than calling
`next(err)`, because the error-rendering middleware sits below it in the chain
and a partially-wired application is exactly what the gate prevents.

`scripts/vercelRuntimeSessionBootstrap-probe.js` is the focused database-free
gate for this behaviour (fake stores, mocked responses, static wiring
assertions, and two controlled subprocesses). It is intentionally **not**
registered inside `npm test` yet.

### Compose rehearsal (local, MySQL fallback)

`docker-compose.yml` pairs the app with a MySQL service for **local rehearsal
only** (plain HTTP on `localhost`, so it defaults to `NODE_ENV=development` and a
non-Secure cookie; it still exercises `SESSION_STORE=mysql`). Secrets come from
your shell/`.env` via interpolation; required values use `${VAR:?...}`.

```bash
# 1. Provide secrets (shell or untracked .env): DB_PASS, SESSION_SECRET (+ optional Supabase/OAuth).
# 2. Start MySQL + app:
docker compose up --build
# 3. Seed ONCE (not auto-run on app startup):
docker compose run --rm app node database/seed.js
# 4. Validate the compose file without starting it:
docker compose config
```

`DB_HOST` is set to the compose service name `mysql` — **not** `localhost` —
because inside the app container `localhost` is the container itself.

---

## 9. Troubleshooting

| Symptom | Cause & fix |
| --- | --- |
| Server exits at startup: "SESSION_SECRET is required / must be ≥32 chars / must not be a placeholder" | Production requires a strong `SESSION_SECRET`. Set a 32+ char random value (and apply the same bar to every `SESSION_SECRET_PREVIOUS`). |
| Server exits: "SESSION_STORE=memory is not allowed in production" | Use `SESSION_STORE=supabase` (preferred - set `SUPABASE_*` and apply migration `0011`) or `SESSION_STORE=mysql` (fallback - provide `DB_*`). For full Supabase data mode, also apply `0012_room_schedules.sql` and `0013_vr_hotspot_schedule_metadata.sql`. Memory store is dev-only. |
| Login appears to succeed but you are immediately logged out (prod) | The Secure `__Host-` cookie was not sent: you are serving over HTTP, or the proxy isn't forwarding `X-Forwarded-Proto=https`. Terminate TLS and set `TRUST_PROXY` (§5). Or, for a non-HTTPS rehearsal, run with `NODE_ENV` unset/development. |
| `/auth/google` redirects to `/auth?error=oauth_failed` | `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` missing. OAuth is optional; local login still works. |
| Google `redirect_uri_mismatch` | `GOOGLE_REDIRECT_URI` doesn't exactly match an Authorized redirect URI in Google Cloud. Register the exact scheme/host/port/path (§7). |
| App can't reach MySQL in Docker (`ECONNREFUSED`/timeout) | `DB_HOST` points at `localhost` inside the container. In Compose use `DB_HOST=mysql` (the service name); standalone, point it at the reachable host. |
| Supabase mode errors / smoke FAIL | `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` unset or wrong, or migrations not applied. Apply migrations through `0019` in order; `0011` is required for Supabase sessions, `0012`-`0013` for scheduling/VR targets, and `0014`-`0019` for road-following routing, CAS baseline, selected-demo parity, and admin geometry. Verify with `npm run qa:smoke` and the focused probes. |
| `npm run qa:db` fails on a missing index or route-geometry count | Apply the Supabase migrations through `0019` (§3) and run `node database/seed.js` for MySQL. The post-`0019` route truth is 20 nodes, 48 directed edges, 24 reverse pairs, and 48 valid geometries. |
| `npm test` / `npm run qa` fails | Ensure MySQL is running and seeded; Supabase portions SKIP cleanly only when no Supabase runtime is selected. Selected Supabase runtimes fail closed when credentials or required migrations are missing. Re-run the named focused probe or gate for detail. |

---

## 10. Hosting options

The container starts the app from a clean checkout with runtime env only — no
secrets baked in. Targets per `ROADMAP.md`:

- **Docker** — the full deployment / institutional production-style path (HTTPS via
  a local TLS proxy for the production cookie). Defaults to Supabase data +
  `SESSION_STORE=supabase`; MySQL is the fallback / local-rehearsal path.
- **Vercel** — demo/UAT only (see §8). Uses Supabase sessions because it cannot
  rely on local MySQL.
- A Render/Railway-style Node host also works (set the env vars in the platform
  dashboard).

Supabase remains the external managed Postgres — data **and** the preferred session
store (via migration `0011`); MySQL is the fallback session/data store. Pick the
final target per `ROADMAP.md`.
