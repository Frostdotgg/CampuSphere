# Dashboard announcement-link correction — authorized release

The owner authorized local correction, Docker verification, one scoped commit
and normal main push, staged acceptance, and promotion of the same tested build
only after every required staged check passes. The source baseline is
`984682b467027d9ccec06832fd2de207cbbaa9a4`; the expected current Production and
recovery deployment is `dpl_UwKPVXwxtFr1WQ94BFecpCATLi4p`. Actual source,
deployment, tests, watches and recovery eligibility belong in the external
release receipt. This note does not establish release completion.

## Correction

The dashboard previously validated the requested section and highlighted the
correct sidebar item, but its initial render always displayed Overview. Startup
now renders the validated current section. Instructor notification links open
Announcements and Student links open News. The existing per-role allowlist,
server-session role precedence and one-time initial-query handling are retained.
Guest announcement links and unknown or unavailable sections remain on Overview.
Subsequent section switching and role initialization keep their existing rules.

The dashboard view is the only changed runtime file. Notification targets,
server content filtering, APIs, database schemas, dependencies, stylesheet v14,
shell v61, its 21 assets and the downloaded-guide format are unchanged.

## Regression and release evidence

The extended announcement probe runs the complete served dashboard bootstrap,
including the real client data module and template renderer, using synthetic
sessions and both isolated repository adapters. It follows the real feed link
and checks rendered reader content and active sidebar state after navigation
and reload. Rejection cases restore the hardcoded Overview render or remove
the role allowlist. Notification-client checks retain both role-specific links
and the Guest null-link behavior. Full browser checks exercise actual pointer
and keyboard navigation through the notification panel.

Reuse the established Compose stack for read-only localhost checks and the
existing labelled announcement fixture for synthetic content and sessions.
Create no additional container set. Stage and Production use existing shared
content only; no test posts are authorized. Preserve owner sessions and guides.
Actual Chrome 200% zoom is required and cannot be replaced by viewport emulation.

The earlier failed Instructor closeout and corrected recovery finding remain
dated external evidence. Fresh results, screenshots, canonical fingerprint,
preservation comparisons and ten-minute staged/Production watches are recorded
outside Git. A failed or incomplete required check blocks promotion. After any
confirmed critical regression, recover through the verified supported target
and stop; recovery to 984682b retains the prior known announcement-link defect.
