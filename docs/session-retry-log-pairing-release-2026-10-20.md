# Session retry logging release — 2026-10-20

## Verified product publication

The owner approved committing, pushing, staged Production checks, promotion,
a runtime-identical documentation successor and final monitoring.

- Product commit: `6a5bbd8b81fd0ff874f3de0bc2ec38ac47c68d21`.
- Initial verified deployment: `dpl_AFoQhojBv2ha95QRHd944dJayw7w`.
- Normal website: **https://campusphere-cspc.vercel.app**.
- Verified rollback target before pushing: `dpl_5KW5rB3zwZT4SYpTCt9FJCYXzfgY`,
  source `59b61b8217881e28f7ad8514e82b3d3ff19534da`.

The product was built Ready/Staged with Production settings, then promoted
after owner-authenticated checks. The project still tracks `main`; automatic
Production domain assignment remained disabled and Standard Protection remained
enabled. No protection, secret or environment-variable setting was changed.
The final documentation successor's actual commit/deployment and ten-minute
monitoring receipt are recorded externally after it is built and verified;
the product identity above must not be presented as that future documentation SHA.

## Fresh verification

| Check | Result |
| --- | --- |
| Session resilience | 73/73 |
| Runtime/session bootstrap | 160/160 |
| Production startup/profile | 116/116 |
| Isolated documentation contracts | 652/652 |
| Canonical Git-byte package boundary | 75/75 |
| Initial normal-domain public smoke | 20/20 |

Release preparation found installed `proxy-addr` 2.0.7 while the unchanged
lockfile specifies 2.0.8. The first dependency preflight therefore refused
staging. A complete source copy received a fresh locked installation, with
102 installed package versions verified and install lifecycle scripts disabled.
All required session/startup checks passed there. The original checkout's
dependencies and the repository's dependency sources remained untouched.

Failure tests used synthetic sessions and fake providers, blocked environment
loading and external networking, and allowed loopback HTTP only. Strict
rejections, concurrency/burst budgets, exact minute boundaries, malformed IDs,
logger failures, aborts, late completions, expiry/logout and real HTTP 200/204/304
response handling passed. The old implementation had failed the two targeted
concurrency assertions. Syntax, whitespace, UTF-8/NUL and added-line secret
checks passed; no full `npm test` or QA pass is claimed.

The owner signed into the generated Production address using the email/password
form. An Administrator reload retained the session. Health, map administration,
preserved floor/room descriptions, Vehicle routing, mode clearing, Walking
entrance/return and a rendered Main Entrance panorama passed representative
checks without saving shared content. Academic Building IV's Walking path was
358 m in both directions. The normal-domain checks retained the existing
Administrator session and verified Vehicle/Walking navigation after promotion.
The public smoke includes anonymous authorization, retired assets, sign-in,
health and five exact committed public-asset comparisons.

## Natural timeout diagnostics

No Production failure was injected. Natural touch timeouts occurred during
the checks. An expanded warning and terminal `failed` outcome shared the same
operation/request IDs and reported two attempts. Its existing `post-response`
error also carried that request ID. A further timeout warning had a matching
`recovered` outcome. This directly demonstrates both paired outcome types.

A captured product-deployment snapshot contained **5 Warning request rows,
1 Error request row and 0 Fatal request rows**. Counts describe request rows,
not individual console messages; the expanded failed request contained the
paired failure plus the post-response error. A displayed HTTP 204 does not
establish successful session refresh. The failed diagnostic establishes that
operation's failure, while the other pairs establish their own outcomes.
No provider/root cause is established, and this is not a zero-warning/error
release. Detailed IDs, messages and later snapshots remain outside Git.

Sampling is per store instance, operation and initial category/status every
60 seconds. An admitted operation reserves its own final message across minute
boundaries; unsampled terminal failures retain their separate limiter. Two
messages are allowed per admitted pair, plus the standalone-failure allowance.
Process termination, logger failure and provider retention can still hide an
outcome externally. The fix preserves the 2,000 ms/two-attempt/200 ms policy.

## Package, preservation and final handoff

The runtime package contains **201 files / 8,580,207 bytes**, aggregate SHA-256
`01966f8b17022c7d43d9976876ef19e2680dda1b8c7c473cf683453f3368dfd0`.
Canonical staged Git bytes matched the reviewed inventory; exactly one runtime
file differs from `59b61b8`: the Supabase session store. The final documentation
commit must preserve this package. The predecessor package fingerprint remains
unchanged in the dated room-scheduling release record.

The six pending paths were backed up. All 52 protected files and 20 original
investigation files matched their starting fingerprints. Public APIs,
session/query payloads, saved application content, schemas, dependency sources
and cache versions are unchanged. Service worker remains v53 and stylesheet
v13. Normal authentication/presence checks may create or refresh their own
application sessions; no direct database maintenance or business-data writes
were performed. Schedule cleanup, migrations and ICTU deployment were excluded.

Sanitized detailed evidence and the final source/deployment/monitoring receipt:
`C:\Users\FROST.GG\.codex\backups\release-session-retry-pairing-20261020`.
The original local-fix and timeout-investigation directories remain preserved.
Representative checks do not establish exhaustive role, route or panorama
coverage, physical-device acceptance, permanent provider availability, load
capacity or complete immutable deployed-byte equality.

The completed release grants no future deployment, cleanup or database repair
permission. New sessions must recompute Git/deployment truth and wait for the
owner's next focused task.
