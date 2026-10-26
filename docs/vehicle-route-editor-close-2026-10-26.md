# Vehicle 2D Route editor header — authorized release

## October 26 release authorization

The owner authorized publication of the exact three reviewed files as one commit
and a normal push to main, followed by testing the resulting unpromoted staged
Vercel build. A complete staged pass authorizes promotion of that same build and
normal-domain verification. Missing or failed required checks block promotion.
The expected preparation and Production recovery baseline is `297e4d9`, deployment
`dpl_3FwFRzPa1MSZrdScQhxmbWw6eW1y`; recheck it and the supported rollback target.
Automatic Production domain assignment must already be disabled. No deployment
setting, shared campus-content, database, API or dependency change is included.

The existing floating theme-button overlap is accepted while affected controls
remain reachable. A confirmed critical Production regression authorizes immediate
rollback to the verified baseline, recovery checks and monitoring, then a stop.
Preserve sessions and guides. Fresh local, staged and Production results, final
commit/deployment identities, monitoring windows and limitations belong in the
external release receipt; authorization does not establish completion.

## Local implementation and review history

The owner authorized this focused local UI correction and Docker verification.
Preparation started from clean main at
`297e4d92994f7c8601bcdbcec96762d732606bb5`, with an empty index and no stashes.
Work belongs to `codex/vehicle-route-editor-close`. Commit, push and deployment
are separate tasks. Earlier release receipts remain dated history.

Only the Vehicle 2D Route editor layout changes. Its header remains outside the
scrolling form, so field focus and long waypoint lists cannot move its title or
Close button above the viewport. Existing width, colors, 44px Close target and
opening focus remain: From-node search for Add and Distance for Edit. The form
retains its Cancel and save actions at the end of its single scrolling region;
the footer wraps on narrow screens so Cancel cannot extend beyond its left edge.
No application markup, application JavaScript, API, schema, dependency or route-data change is included.
Public stylesheet v14, shell v61, its exact 21 assets and guide format remain.

## Evidence

The original Docker fixture failure was reproduced at 320x568: Edit focused
`edge-dist`, the old dialog scrolled 434 pixels, and Close was at y=-384.59375
with failed pointer hit-testing. The focused CSS uses a nonshrinking header and
a flexing form scroll area bounded by 90vh, with 90dvh on supporting browsers.

Validation reuses the established Compose stack for read-only checks and the
existing labelled admin-map fixture on an internal network with its relay at
127.0.0.1:3431. No additional app/MySQL/relay set is created. Only disposable
fixture records and normal fixture-session activity may be used; shared campus
content is outside this task. Environment files and private backups are not read.

The external local receipt records the final runtime fingerprint, rendered
visibility and pointer tests, original-style rejection, keyboard/dismissal
checks, exact focused-check results, screenshots and preservation evidence.
The candidate remains unstaged for review; this note establishes no release.

Canonical candidate runtime: 216 files / 8,666,339 bytes, aggregate SHA-256
`9b17fb80d7e20587a61a0cd71400e9aea3a544d22b8d7a25cbdb06302c513577`.
Only the page-specific stylesheet differs from the accepted runtime baseline.
