# CampuSphere Defense Demo Script

Milestone 8, Section 8.10. This script is for a controlled defense/demo using
seeded data. Do not use real secrets or private production data on screen.

## Pre-Demo Setup

1. Confirm MySQL is running and seeded:
   ```bash
   node database/seed.js
   ```
2. Confirm Supabase migrations `0001` through `0019` have been owner-applied if
   the demo uses Supabase mode. Migrations `0014` through `0019` provide the
   verified road graph, owner-managed geometry, atomic geometry writes,
   authoritative Guard House topology, CAS baseline, and selected-demo parity;
   `0011` remains required for
   `SESSION_STORE=supabase`.
3. Run the gates and record only final pass lines:
   ```bash
   npm run qa
   npm run qa:db
   npm run qa:identity
   npm run qa:audit
   ```
4. Start the app only with the approved local workflow. Do not run foreground
   long-lived server commands inside Codex. For a human-led demo, `npm start` is
   acceptable in a normal terminal.
5. Use the regression accounts. For a local MySQL rehearsal, the deterministic
   seed fixtures apply (local-only values in `database/seed.js` /
   `scripts/regressionCredentials.js` — deliberately not listed here). For a
   Supabase-backed demo, the four regression identities (admin, student,
   instructor, guest) use private owner-managed passwords available only
   through the test-only `SUPABASE_REGRESSION_*` variables in the ignored
   local `.env` (names in `.env.example`).

No credential value is recorded in this repository; former documented demo
passwords are dead and rejected by the live accounts. Change or remove seeded
local fixtures before any non-demo deployment.

## Talk Track

### 1. Product Overview

- CampuSphere is a role-based campus navigation and information portal for CSPC.
- It uses Express, EJS, server-side sessions, MySQL fallback, and Supabase cloud
  data paths selected by runtime switches.
- Supabase Auth is not used; authentication stays in the Express app with local
  credentials and Google OAuth.

### 2. Authentication And Roles

1. Open `/auth`.
2. Sign in as the seeded student.
3. Show the student dashboard and role-specific navigation.
4. Attempt an admin-only URL and show access is denied.
5. Sign out with the UI logout control.

Expected: logout is POST-only and session cleanup redirects to
`/auth?logged_out=1`.

### 3. Admin Workflow

1. Sign in as the seeded admin.
2. Open the admin dashboard.
3. Create, edit, list, and delete a demo FAQ/news/event item.
4. Show invalid input returns a clean validation error.

Expected: admin CRUD works, non-admin users cannot access admin APIs, and errors
do not expose stacks, SQL, or secrets.

### 4. Campus Navigation

1. Open the public map.
2. Choose a known seeded building and select **Set as Destination**.
3. Show that the line starts at the Guard House, follows the owner-managed road
   geometry, and keeps the route steps in graph order.
4. Open **Set VR Route**. Navigate mapped scenes and show that incomplete scene
   coverage ends with a coverage notice, not a false arrival message.

Expected: map search is capped and sanitized, road geometry renders in graph
order, and VR navigation uses admin-managed non-private data. MySQL freezes 34
buildings, 44 route nodes, 100 directed edges, 50 exact reverse pairs, 100 valid
geometries, and 33 routable destinations; Supabase freezes 25 buildings, 26
route nodes, 50 directed edges, 25 exact reverse pairs, 50 valid geometries,
and 25 routable destinations; Guided VR covers 25 active destinations, 472
configured steps, and 99 unique scene keys.

Arrival requires the configured natural destination node, stored start and
arrival scene mappings, an approved Cloudinary delivery URL and public ID, and
exactly one forward and one reverse scene link for every adjacent scene pair;
otherwise the route remains unavailable and no arrival is reported.

### 5. PWA And Offline Boundary

1. Show the manifest/offline support.
2. Demonstrate only the currently verified offline fallback. Do not claim that
   the full Offline Campus Navigation Package is complete yet.
3. Explain that authenticated HTML, admin routes, auth routes, logout, and
   profile update APIs are never cached by the service worker.

Expected: current PWA behavior improves resilience without storing private
pages. BE.6 and OFF.1 are Codex GO. Pilot review is complete by owner
acceptance; OFF.2 is next but not authorized by this script. OFF.2 through
OFF.6 remain open and required before final Milestone 12 GO. Explicitly say
that offline navigation is not complete.

### 6. Security And Deployment Readiness

Show final pass lines from:

```bash
npm run qa
npm run qa:db
npm run qa:identity
npm run qa:audit
```

Explain:

- CSRF protects unsafe requests and logout.
- Rate limiting covers login, OAuth, profile updates, and admin mutations.
- Helmet/CSP blocks inline/eval script execution except nonce-approved code.
- Production sessions use the Supabase session store by default (preferred); the
  server fails closed on unsafe session config, and MySQL remains the explicit
  fallback / local-rehearsal session store only.
- Supabase service-role key is server-only and runtime-env only.
- RF.6 road-following routing is Codex GO. CampuSphere computes routes from its
  own campus graph and owner-managed road geometry; it does not integrate Google
  Maps, Google Earth, Strava, SIS, or another external routing engine.
- Technical Production baseline
  `fea3b2e11c6331eddc1ee091b165427d8e0218d7` is accepted. The authorized push
  automatically triggered Production, and bounded anonymous read-only GET-only
  post-deployment verification passed. Vercel `Auto-assign Custom Production
  Domains` is disabled, so future `main` deployments require manual promotion.
  Documentation/static-assertion commit `db05b54` is `Ready` / `Production` /
  `Staged`, was not promoted, and did not replace the live alias. The human pilot
  occurred on 2026-08-05; the owner accepts it with zero reported findings,
  participant/Form evidence remains external, and its full source-commit
  identity was not independently verified. Pilot review is complete. OFF.2 is
  next, while OFF.2-OFF.6, offline work, D6, and final Milestone 12 GO remain
  open. Do not infer that OFF.2 implementation or another deployment is
  authorized by this script.
- Docker packaging exists; Docker full deployment finalization is Milestone 13
  and must be verified on a Docker-enabled machine.

## Fallback Plan

- If Google OAuth is unavailable, show the documented fallback:
  `/auth/google` redirects to `/auth?error=oauth_failed`, while local login
  remains functional.
- If Supabase is unavailable, keep all `*_DATA_SOURCE=mysql` and demonstrate the
  MySQL fallback path.
- If internet access is unavailable, avoid CDN-dependent visual claims and focus
  on seeded local flows plus recorded sanitized evidence.
