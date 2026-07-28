# CampuSphere Codebase Remediation Plan

> **HISTORICAL AUDIT — NOT CURRENT AUTHORITY.** This document records the
> independent codebase audit of 2026-06-15 and the remediation gates scheduled
> from it at that time. Its status lines, "next executable task", blocked/not-
> started markers, and gate sequencing are a snapshot of June 2026 and are
> superseded. Do not ground a session on them, and do not execute any task from
> this file.
>
> Specifically superseded: Milestone 7 Section 7.8 is no longer blocked;
> Milestones 8 through 11, RF.1-RF.6, BE.1-BE.6, and OFF.1 are complete and
> Codex GO; and the statement that `npm test` is a deliberately failing
> placeholder is obsolete — `npm test` now runs `scripts/quality-gates.js`, the
> authoritative contract and security suite, and a passing run is real
> evidence.
>
> This file's `R1`-`R12` numbering is the June 2026 audit's own scheme. It is
> unrelated to, and must never be confused with, the `M12.P1-R1` through
> `M12.P1-R8` deployment-readiness sections, which are defined in `plan.md`.
>
> Current authority is `plan.md`, `ROADMAP.md`, `CODEX_HANDOFF.md`, and
> `CLAUDE_HANDOFF.md`. This file is retained only as the historical record of
> what that audit found and how it was scheduled.

## Purpose And Precedence

This document schedules the findings from the June 15, 2026 independent
codebase audit without changing the approved scope of `plan.md` or
`ROADMAP.md`.

Precedence and workflow:

1. The live repository and databases are the source of truth.
2. `AGENTS.md` and `CLAUDE.md` define operating rules.
3. `plan.md` remains authoritative for Milestone 7 feature sections.
4. `ROADMAP.md` remains authoritative for Milestone 8 deployment readiness.
5. This file is authoritative only for the remediation gates defined below.
6. Claude executes exactly one remediation gate or approved milestone section
   at a time, reports, and stops.
7. Codex independently reviews the actual diff and runtime behavior before the
   next gate or section is unblocked.

Do not stage, commit, stash, reset, clean, delete, or revert repository content
without explicit user permission. Preserve the existing dirty worktree and all
pre-existing staged and unstaged changes.

## Current Status

- Milestones 1 through 6: complete.
- Milestone 7 Sections 7.1 through 7.7: Codex GO.
- Section 7.7 result: database-backed, read-only System Logs Admin View
  verified in MySQL and Supabase modes.
- Section 7.8 is **BLOCKED** until remediation gates R1 through R4 receive
  separate Codex GO decisions.
- Exact next executable task: **R1 - Stored-XSS Removal**.

The application remains suitable for controlled local capstone development,
but it is not ready for an internet-accessible production deployment.

## Audit Baseline

Assessment at the time this plan was created:

- Capstone quality: 6.5/10
- Production readiness: 3.5/10
- Security: 4/10
- Maintainability: 5/10
- Automated testing: 2/10

Existing strengths that every repair must preserve:

- Central admin role gate and established 302/401/403 behavior.
- Server-only Supabase clients and credentials.
- `safeJson` protection for JSON embedded in script blocks.
- Strict FAQ, settings, and logs validation.
- Privacy-minimal, best-effort audit logging.
- Parameterized SQL and centralized runtime data-source switches.
- MySQL fallback and natural-key cross-backend parity checks.
- Production startup refusal when `SESSION_SECRET` is absent.

## Global Repair Rules

Every remediation gate must:

- Preserve Express/EJS, CommonJS, MySQL fallback, Supabase mode, and existing
  runtime switches.
- Keep Supabase credentials and clients server-only.
- Preserve existing page routes, API response contracts, role behavior, and
  user-visible functionality unless the gate explicitly changes them.
- Use fixed sanitized server warnings. Never expose raw errors, stacks,
  passwords, cookies, session IDs, OAuth subjects, database credentials,
  service-role values, Supabase hosts, request bodies, or submitted content.
- Use `scripts/with-server.js` for API/HTTP verification. Never foreground-run
  `node server.js`, `npm start`, or `npm run dev`.
- Use temporary probe files outside the repository. Clean them afterward.
- Restore all controlled database mutations and stop exact test-server PIDs.
- Run `node scripts/supabase-smoke.js`.
- Do not use `npm test` as passing evidence because it is a deliberate failing
  placeholder.
- Report exact files changed, behavior, checks, database actions, cleanup,
  initial/final Git state, risks, and the exact next blocked or approved task.
- Stop for Codex review. Never automatically begin the next gate.

## Immediate Security Gates

### R1: Stored-XSS Removal

**Status:** NEXT - NOT STARTED

**Finding covered:** 1

Remove unsafe database-backed HTML interpolation from authenticated dashboard,
buildings, and events surfaces.

Required behavior:

- Remove or replace the custom dashboard template behavior where the
  supposedly escaped `<%%= ... %%>` branch performs only `String(...)` and the
  result is assigned to `innerHTML`.
- Ensure announcement, profile, building, floor, room, entrance, landmark,
  route, and event values cannot create markup, event handlers, script
  elements, dangerous attributes, or executable URLs.
- Prefer DOM construction and `textContent`. Where a static HTML template is
  retained, use one shared context-appropriate escaping helper for every
  database-derived value, including attribute values.
- Do not rely on input sanitization as the primary XSS defense. Stored content
  must remain safe even if a legacy or directly inserted database row contains
  hostile markup.
- Preserve search, filtering, dashboard section switching, modals, routes,
  floor selection, themes, responsive layouts, and both backend modes.
- Do not add Helmet or a broad CSP in this gate. That is defense in depth for
  Milestone 8 and must not replace correct output handling.

Primary areas:

- `views/dashboard.ejs`
- `views/buildings.ejs`
- `views/events.ejs`
- Shared browser helpers only where they reduce real duplication.

Required verification:

- Syntax checks for all changed JavaScript.
- MySQL and Supabase runtime checks for the affected pages.
- Controlled stored-XSS sentinels in every affected field category, including
  element, attribute, and closing-tag payloads.
- Assert sentinels render as literal text, no injected DOM nodes appear, no
  event handler runs, and no sentinel global is set.
- Test desktop 1440x900, mobile 390x844, and mobile 375x667.
- Restore all modified rows exactly and confirm natural-key parity.
- Leak scan rendered HTML, JSON, browser storage, caches, and server output.

**Exit gate:** Codex GO is required before R2.

### R2: Authenticated PWA Privacy

**Status:** BLOCKED BY R1

**Finding covered:** 2

Prevent personalized HTML containing session or profile data from entering
CacheStorage or being served to another user of the same browser profile.

Required behavior:

- Treat authenticated HTML navigations for `/map`, `/buildings`, `/vr`, and
  `/vr/*` as network-only unless the cached response is a session-neutral
  offline shell containing no user data.
- Do not cache HTML containing `window.__SESSION_USER`, email, role, student
  identifiers, employee identifiers, address, phone, or personalized
  navigation content.
- Preserve bounded caching of approved public static assets and privacy-safe
  API data where it remains useful for the offline demo.
- Keep `/admin`, authentication routes, logout, and profile-write routes
  forbidden.
- Preserve logout cleanup, but do not depend on logout cleanup as the primary
  privacy boundary.
- Use a new cache version so previously cached personalized pages are removed
  during service-worker activation.

Primary areas:

- `public/sw.js`
- `public/js/pwa.js`
- Session-data embedding or offline-shell boundaries only if required.

Required verification:

- Fresh install and upgrade from the prior cache version.
- Online then offline checks for all approved demo routes.
- Assert no cached response contains session identity or role-profile fields.
- User A login/load/logout followed by User B login and offline navigation must
  never display User A data.
- CacheStorage and IndexedDB remain bounded and contain no credentials,
  sessions, secrets, private profile data, or admin URLs.
- Preserve manifest registration, offline indicator, and privacy-safe offline
  fallback behavior.

**Exit gate:** Codex GO is required before R3.

### R3: Session Fixation Repair

**Status:** BLOCKED BY R2

**Finding covered:** 3

Regenerate the Express session identifier whenever an unauthenticated or
pending-registration session becomes authenticated.

Required behavior:

- Regenerate before assigning the authenticated user for:
  - local registration;
  - local login;
  - existing-user Google login;
  - completed Google OAuth registration.
- Preserve only explicitly required pre-authentication state across
  regeneration. Pending OAuth registration data may be copied only for the
  transition that still requires it and must be deleted after successful
  completion.
- Hydrate the role profile into the new session, save it, then redirect.
- A regeneration or save failure must return the existing fixed failure
  behavior, must not authenticate the old session, and must not leak an error.
- Preserve successful/failure audit behavior without recording session IDs.
- Logout must still destroy the active regenerated session. POST-only logout
  and CSRF remain Milestone 8 work.

Primary areas:

- `controllers/authController.js`
- A small shared Promise helper may be introduced in that module to avoid
  duplicated callback handling.

Required verification:

- Capture the pre-authentication cookie and assert the successful response
  issues a different session ID for every authentication path.
- Assert the old cookie cannot access authenticated or admin routes.
- Assert the new cookie has the correct role and profile hydration.
- Verify invalid credentials, invalid registration, OAuth error paths, logout,
  302/401/403 behavior, and audit deltas in both runtime modes.
- No session value or cookie may appear in logs, HTML, JSON, audit rows, or
  test reports.

**Exit gate:** Codex GO is required before R4.

### R4: Dependency Vulnerability Remediation

**Status:** BLOCKED BY R3

**Finding covered:** 11

Resolve the known production dependency advisories reported through
`path-to-regexp`, `qs`, and `brace-expansion`.

Required behavior:

- Re-run `npm audit --omit=dev` immediately before editing and record the
  current dependency paths and advisory IDs.
- Use the smallest compatible direct dependency upgrades that move vulnerable
  transitive packages to patched releases.
- Update only `package.json` and `package-lock.json` unless a compatibility
  repair is demonstrably required.
- Do not use `npm audit fix --force`.
- Do not introduce unrelated major framework upgrades.

Required verification:

- `npm install` completes from the lockfile.
- `npm audit --omit=dev` reports zero known production vulnerabilities, or any
  unavoidable residual advisory is documented and explicitly reviewed.
- Repository-wide `node --check`, Supabase smoke, server startup, auth,
  admin-role gate, malformed JSON, FAQ/settings/log APIs, map, buildings,
  events, VR, and PWA registration smoke checks pass.
- Initial and final dependency trees for the three vulnerable packages are
  reported.

**Exit gate:** After R1-R4 each receive Codex GO, Milestone 7 Section 7.8 becomes
eligible for execution.

## Milestone 7 Remediation Work

### R5: Destructive-Delete Guards

**Schedule:** Implement as part of Section 7.9.

**Finding covered:** 5

- Block building deletion with HTTP 409 when routes or other protected
  navigation records depend on it.
- Block route-node deletion when edges or VR scenes reference it.
- Avoid silent cascade loss. The UI must explain which dependency blocks the
  operation.
- Keep MySQL and Supabase behavior logically equivalent.
- Add database constraints or write functions only when required for
  race-safe enforcement.

### R6: Transactional Registration And Profile Updates

**Schedule:** Complete after Section 7.9 and before Section 7.10.

**Finding covered:** 6

- Make MySQL user-plus-profile creation atomic with one transaction.
- Make each profile update atomic across user and role-profile tables.
- Mutate session data only after database commit.
- On session-save failure after commit, reload or invalidate the session rather
  than reporting a clean rollback that did not happen.
- Preserve Supabase atomic RPC behavior and cross-backend response contracts.

### R7: Legacy CRUD Validation Consistency

**Schedule:** Complete after R6 and before Section 7.10.

**Finding covered:** 9

- Add shared server-side validation for users, news, events, and buildings.
- Validate object shape, canonical positive IDs, trimmed required strings,
  field types, lengths, email format, password policy, allowlisted roles and
  categories, valid dates, coordinate ranges, and bounded structured details.
- Extra fields must be ignored or rejected consistently before database work.
- Validation failures return sanitized 400 responses and create no mutation
  audit row.
- Keep FAQ, settings, and logs contracts unchanged.

### R8: MySQL/Supabase Identity Constraint Parity

**Schedule:** Complete after R7 and before Section 7.10.

**Finding covered:** 10

- Add MySQL uniqueness for one role-profile row per user.
- Add MySQL uniqueness for non-null `(oauth_provider, oauth_subject)` identity
  pairs, matching the Supabase intent.
- Audit live MySQL rows for conflicts before creating constraints.
- Create a focused MySQL schema change and the next sequential Supabase
  migration only if the live Supabase schema also requires adjustment.
- The user manually applies Supabase SQL when required.
- Do not run `database/seed.js` unless `database/schema.sql` or
  `database/seed.js` changes.

### R9: Fake And Nonfunctional UI Removal

**Schedule:** Include in Section 7.10.

**Finding covered:** 12

- Replace fabricated admin chart values and placeholder notification content
  with truthful database-backed data or remove those controls.
- Either implement profile-photo persistence safely end to end or remove the
  upload/remove controls. A temporary preview must not imply persistence.
- Remove stale localStorage fallback identities from authenticated surfaces.
- No page may claim an operational capability that has no server consumer.

### Section 7.10 Regression Additions

Section 7.10 must include regressions for R1 through R9 in addition to its
existing desktop, mobile, authorization, privacy, and PWA checks.

### Section 7.11 Final Gate

Section 7.11 remains the Milestone 7 end-to-end GO/NO-GO gate. It must verify
that all immediate gates and Milestone 7 remediation work remain intact before
`HANDOFF.md` is updated.

## Milestone 8 Security And Deployment Work

### R10: Production Request And Session Hardening

**Schedule:** Milestone 8, before staging deployment.

**Finding covered:** 7

- Add CSRF protection to cookie-authenticated mutations.
- Change logout to POST and protect it with CSRF.
- Add rate limiting for login, registration, OAuth starts/callback abuse, and
  sensitive admin mutations.
- Replace the default MemoryStore with an approved persistent production
  session store while keeping a documented local-development fallback.
- Define production cookie name, secure/httpOnly/SameSite policy, expiry,
  proxy behavior, and secret rotation procedure.
- Add Helmet and a CSP compatible with the application. Remove or nonce/hash
  inline scripts and styles as required instead of weakening the policy with
  unrestricted `unsafe-inline` or `unsafe-eval`.

### R11: Centralized Sanitized Error Contracts

**Schedule:** Milestone 8, before staging deployment.

**Finding covered:** 8

- Centralize fixed, sanitized server logging.
- Never log raw database/Supabase errors or stacks in normal production output.
- Return `{ success:false, message }` for API 404/500 responses and preserve
  HTML error pages for browser requests.
- Preserve the existing malformed-JSON 400 contract.
- Add correlation identifiers only if they contain no user or request data.

### R12: Maintainability And Automated Quality Gates

**Schedule:** Milestone 8 and before final production GO.

**Findings and patterns covered:** controller complexity, duplicated backend
branches, oversized templates/controllers, missing tests, linting, formatting,
coverage, and CI.

- Introduce Node's built-in test runner or another approved lightweight test
  framework for auth, authorization, CRUD, XSS, PWA privacy, transactions,
  destructive-delete guards, and MySQL/Supabase contracts.
- Add linting and formatting in check-only CI mode before any broad mechanical
  rewrite.
- Extract shared validation and backend service boundaries so controllers
  coordinate HTTP behavior rather than owning SQL, validation, session
  mutation, and audit logic simultaneously.
- Split `views/dashboard.ejs`, `controllers/authController.js`, and other large
  modules incrementally, preserving behavior with tests before each split.
- Add CI gates for syntax, tests, dependency audit, secret scanning, and
  migration consistency.

## Finding-To-Gate Matrix

| Finding | Severity | Scheduled gate |
| --- | --- | --- |
| 1. Stored XSS in authenticated views | High | R1 |
| 2. Personalized HTML cached by PWA | High | R2 |
| 3. Sessions not regenerated after authentication | High | R3 |
| 4. Public registration trusts institutional roles | Medium-high | R7, then R10 |
| 5. Building deletion silently cascades routes | Medium-high | R5 / Section 7.9 |
| 6. Multi-table writes are not consistently transactional | Medium | R6 |
| 7. Session/request hardening incomplete | Medium | R10 / Milestone 8 |
| 8. Raw legacy errors and inconsistent API errors | Medium | R11 / Milestone 8 |
| 9. Validation quality varies by feature | Medium | R7 |
| 10. MySQL identity constraints weaker than Supabase | Medium | R8 |
| 11. Known dependency vulnerabilities | Medium | R4 |
| 12. Fake or nonfunctional UI remains | Low-medium | R9 / Section 7.10 |

Finding 4 requires two layers:

- R7 must immediately enforce server-side email, password, profile, and
  role-selection validation consistent with the application's current trust
  model.
- R10 must make the production identity policy explicit: institutional roles
  require an approved institutional verification mechanism; unverified public
  users must receive only the guest role.

## Production Release Gate

Do not deploy CampuSphere to an internet-accessible production environment
until:

1. Milestone 7 Section 7.11 receives GO.
2. R1 through R11 receive GO.
3. R12 provides automated evidence for critical flows.
4. The Milestone 8 staging deployment passes security, privacy, migration,
   rollback, OAuth redirect, mobile, PWA, and clean-database checks.
5. Secrets are supplied only through the deployment environment.
6. The final production GO/NO-GO decision is explicitly recorded.

## Exact Continuation Point

Execute **R1: Stored-XSS Removal** only.

Do not execute R2, Section 7.8, or any later task in the same session. After R1
implementation, verification, cleanup, and reporting, stop for Codex review.
