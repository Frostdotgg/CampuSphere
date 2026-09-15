# Production Session-Readiness Incident — 2026-09-14

Last updated: 2026-09-15 (Asia/Manila)

## Outcome

The source of the browser response is confirmed. Around 9:30 PM on September
14, 2026, the deployed application's fail-closed session-readiness check could
not verify the Supabase-backed `app_sessions` store. The old coordinator then
returned its fixed sanitized response:

```json
{"success":false,"message":"Service temporarily unavailable."}
```

Retained Supabase dashboard logs correlate the owner-reported incident with an
HTTP `401` for the exact readiness request, `GET /rest/v1/app_sessions` with the
`select=sid&limit=1` query, at `2026-09-14 21:29:01` Asia/Manila
(`2026-09-14T13:29:01.899Z`). A session write received HTTP `502` at 21:28:30,
and a settings read received HTTP `401` at 21:28:09. These records confirm that
Supabase's API/gateway rejected the readiness request during the incident
window. The retained row contains no response body or provider diagnostic, so
it does not prove why Supabase issued that temporary `401`.

## Why the whole site showed one JSON response

`server.js` mounts `sessionReadiness.middleware` before rate limiting, body
parsers, static files, `express-session`, application routes, and error
handlers. The root path is not a sensitive-path rate-limit target. Therefore a
request to `/` showing this exact fixed response was owned by the readiness
gate, not the rate limiter or a page controller.

In predecessor `4e9d579`, `services/sessionReadiness.js` started one eager
initialization and had no retry, timeout, or recovery wave. A rejected
initialization remained cached for the lifetime of that warm Vercel function.
`services/supabaseSessionStore.js` deliberately replaced the provider error
with a fixed initialization error, and both modules logged nothing. That was a
secure privacy posture, but it made the old Vercel invocation unable to record
the provider status that caused the refusal.

The Vercel dashboard no longer retained the requested 9:15–9:45 PM invocation
window when it was checked on September 15; the UI reported that the range was
outside the allowed window. The Supabase 24-hour log retained the correlated
gateway records above. No credential, session identifier, request identifier,
URL secret, raw response body, or user data is copied into this incident file.

## Current mitigation

Product release `13adb9d` keeps the readiness gate fail-closed but makes it
recoverable. It uses one shared recovery wave with three attempts, a two-second
timeout per attempt, 250/750 ms retry delays, transient cooldowns of
5/15/30/60 seconds, and a 60-second authorization cooldown. The Supabase
session store also bounds `get`, `set`, and `touch` retries to transient
timeout/network/408/429/5xx failures; authorization failures are not retried.
Diagnostics now record only fixed operation/state/category/status/attempt
fields and never credentials, URLs, cookies, session ids/data, raw errors, or
backend bodies.

The owner promoted the `13adb9d` Vercel deployment recorded in
`docs/current-authority.md`. Its bounded anonymous, read-only Production smoke
passed `301/301`, including ten consecutive healthy `/healthz` requests. This
is strong evidence for the released recovery path, but it is not a deliberately
induced outage test and cannot guarantee that an external provider will never
fail again.

## Separate heartbeat observation and resolution

During the September 15 read-only log review, two Vercel entries for
`POST /api/presence/heartbeat` showed `ERR_HTTP_HEADERS_SENT` after the request
had already returned `204`; a nearby session-store `touch` diagnostic recorded
one timeout/retry. This was a separate defect and is not evidence that the
September 14 readiness incident came from the presence endpoint.

Release `b8d2bf2` fixes the confirmed response-lifecycle defect. A late
`express-session` store-touch error can reach the global handler after the
route's `204` is already complete. The handler now preserves a completed
response and emits one fixed sanitized diagnostic instead of attempting a
second write; a committed but unfinished stream delegates to Express's default
handler. A real in-process regression passed inside the `117/117` Vercel
runtime/session bootstrap probe. The owner promoted deployment
`dpl_5aBjCeWeBj1ZcST2LJCqZhSv7Tct`; bounded anonymous Production smoke passed
`301/301`, and its deployment-filtered logs showed no `5xx` or
`ERR_HTTP_HEADERS_SENT`. The anonymous smoke did not send an authenticated
Production heartbeat, so that exact live path was not exercised.

## Plain-English explanation for clients and panelists

> The app briefly could not verify its server-side sign-in storage because the
> database service rejected the verification request. For safety, the app
> temporarily refused all pages instead of running with unreliable sessions.
> The old version stayed stuck after that first failure. The current version
> retries safely, recovers automatically, and records non-sensitive failure
> categories so the team can diagnose a future incident without exposing user
> or credential data.

## Current next move

The heartbeat observation is diagnosed, fixed, pushed, promoted, and boundedly
verified. The next release-closeout move is review of the authority/static-
contract synchronization and, if green and separately authorized, commit and
push. Any new implementation, session/database mutation, deployment, or broader
Production test still requires its own explicit owner task.
