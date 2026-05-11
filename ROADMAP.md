# CampuSphere Completion Roadmap

## Source Review Note

All requested files were readable: `AGENTS.md`, `CLAUDE.md`, `MANUSCRIPT_TEAMDUTCHESS.pdf`, and the first-party source files outside `node_modules`. The manuscript PDF was parsed from its text streams. A few extracted sections had formatting noise, especially the numbered objectives, but the project scope, modules, testing plan, and technical expectations were readable enough to compare against the codebase.

## Project Summary

CampuSphere is a role-based campus navigation and information portal for Camarines Sur Polytechnic Colleges. The manuscript defines the target as a Progressive Web Application with user roles, searchable campus map data, VR/360-degree guided navigation, announcements, room scheduling, admin content management, offline access, and black-box/usability/security testing before deployment.

The current repository already has a working Express/EJS/MySQL foundation with authentication, role dashboards, public map/building/event pages, and several admin CRUD screens. The largest remaining work is turning the prototype into a manuscript-aligned capstone product: DB-backed map consistency, VR route walkthroughs, PWA/offline support, room scheduling, complete admin tooling, security hardening, and test/demo evidence.

## Current Implementation Status

### Implemented

- Express 5 + EJS server-rendered MVC structure in `server.js`, `routes/`, `controllers/`, and `views/`.
- MySQL persistence through `config/db.js`, `database/schema.sql`, and `database/seed.js`.
- Local username/password authentication with bcrypt in `controllers/authController.js`.
- Google OAuth flow with domain-to-role mapping and complete-registration step in `controllers/authController.js`.
- Session-based role data exposed to EJS through `server.js`.
- Authenticated dashboard route in `routes/dashboard.js` and `controllers/dashboardController.js`.
- Admin route protection through `middleware/roleAuth.js` and `routes/admin.js`.
- Admin CRUD APIs for users, news/events, and buildings in `controllers/adminUsersController.js`, `controllers/adminContentController.js`, and `controllers/adminBuildingsController.js`.
- Database-backed building directory in `controllers/buildingsController.js` and `views/buildings.ejs`.
- Leaflet-based maps in `views/map.ejs`, `views/home.ejs`, and `views/dashboard.ejs`.
- Seeded default admin, sample student, buildings, news, events, team members, FAQs, and settings in `database/seed.js`.

### Partially Implemented

- Role dashboards exist in `views/dashboard.ejs`, but much of the role-specific data still comes from hardcoded browser-side data in `public/js/data.js`.
- Building details, floor layouts, route text, entrances, walk time, and landmarks exist as seeded JSON inside the `buildings.details` column, but they are not normalized or validated.
- Announcements/news can be managed by admins, but instructor-created announcements and role-targeted visibility are not implemented.
- Public `/map` uses static `public/js/data.js` building data, while `/buildings` uses MySQL. Admin building edits will not reliably appear on the main map.
- Admin FAQ, logs, and settings pages exist, but `views/admin/faqs.ejs`, `views/admin/logs.ejs`, and `views/admin/settings.ejs` are mostly static mockups without backing CRUD APIs.
- Route guidance exists as textual walking directions in `views/buildings.ejs`, but no graph/pathfinding or VR progression exists.

### Missing

- PWA manifest, service worker, offline cache strategy, IndexedDB/local cache, and installability.
- Pannellum.js or any equivalent 360-degree/VR scene viewer.
- VR scene assets, hotspot graph, scene-to-scene route progression, and route completion flow.
- Room and schedule tables, schedule plotting, room occupancy, and admin schedule management.
- MapLibre GL JS, vector tiles, Supabase/PostgreSQL/PostGIS, and Cloudinary, which are named in the manuscript. The current app uses Leaflet, OpenStreetMap tiles, MySQL, and local assets instead.
- Automated test framework. `package.json` has an `npm test` placeholder that exits with failure.
- Formal black-box test cases, SUS/usability survey materials, security test checklist evidence, and deployment checklist.
- Production session hardening, CSRF protection, strong input validation, audit logging, and authorization checks for every sensitive operation.

## Manuscript vs Existing App Gaps

| Manuscript requirement | Current implementation | Gap and impact |
| --- | --- | --- |
| Role-based PWA campus mapping portal with offline support | Express/EJS web app; no manifest or service worker in `public/` or `views/partials/head.ejs` | Not installable and not offline-capable, which is a core capstone claim. |
| VR/360-degree navigation using scenes and hotspots | No Pannellum, no VR routes, no panorama assets; only textual routes in `views/buildings.ejs` | The "VR-based campus mapping" requirement is not yet met. |
| Searchable building, office, and room directory | Building search exists in `views/map.ejs` and `views/buildings.ejs`; room data is hardcoded in `public/js/data.js` | Search is not authoritative, does not cover real DB rooms/offices, and is split across data sources. |
| Admin control over users, map data, announcements, VR scenes, navigation routes, room data, and schedules | Admin can manage users, news/events, and buildings through `routes/admin.js` and admin controllers | Missing VR scene management, route management, room/schedule management, FAQ CRUD, settings persistence, and logs. |
| Student and instructor dashboards with schedules and assigned rooms | Dashboards exist, but instructor assigned rooms and student schedules are hardcoded fallback data in `public/js/data.js` and `views/dashboard.ejs` | Schedule features are demo-only and not maintained by admins. |
| Announcement dissemination | News/announcements table and admin CRUD exist | No role targeting, notification state, instructor posting, or dashboard-specific filtering. |
| MapLibre GL JS, Supabase/PostgreSQL/PostGIS, Cloudinary | Current stack is Leaflet/OpenStreetMap CDN, MySQL, local/static images | Team must either implement equivalent features in the current stack or revise the manuscript/defense narrative to match the actual stack. |
| Black-box, usability, security, and user satisfaction testing | No tests or testing artifacts in repo | Capstone validation evidence is missing. |
| Deployment within CSPC or cloud environment | `npm start` works by design, but no deployment config/checklist exists | Demo/deployment readiness is unproven. |

## Prioritized Milestones

### Milestone 1: Stabilize the Baseline and Single Source of Data

Priority: P0

Concrete tasks:

- Decide whether the final technical narrative will keep the current MySQL/Leaflet stack or migrate toward the manuscript stack of Supabase/PostGIS/MapLibre.
- Make the database the single source for buildings used by `/buildings`, `/map`, dashboard map widgets, and admin map management.
- Add server JSON endpoints for public map/building data instead of relying on `public/js/data.js`.
- Keep `models/data.js` as seed-only data and remove runtime dependence where practical.
- Validate `buildings.details` JSON before saving through `adminBuildingsController`.
- Re-run `node database/seed.js` and verify default accounts still work.

Acceptance criteria:

- `/map`, `/buildings`, and admin campus map show the same building set after an admin creates, edits, or deletes a building.
- A clean database can be created and seeded with one command.
- No core screen depends on stale duplicate building data from `public/js/data.js`.
- The team can explain the final chosen stack consistently in defense.

### Milestone 2: Harden Authentication, Roles, and Profiles

Priority: P0

Concrete tasks:

- Prevent public self-registration as `admin` in `controllers/authController.js`; admin creation should be seed-only or admin-only.
- Standardize on `middleware/roleAuth.js` for protected routes.
- Review all admin API routes for server-side authorization, not just client-side navigation hiding.
- Add server validation for profile updates in `controllers/profileController.js`.
- Add guest behavior that matches the manuscript: either true public guest access or authenticated guest accounts, but document the choice.
- Configure production session settings: secure secret, secure cookies when HTTPS is used, sameSite, and environment checks.

Acceptance criteria:

- Students, instructors, admins, and guests land on the correct role experience.
- Non-admin users cannot access `/admin` pages or `/admin/api/*` endpoints by direct URL or crafted request.
- A user cannot register themselves as admin through the public form.
- Profile changes persist in the database and reload correctly after logout/login.

### Milestone 3: Complete Campus Map, Search, and Non-VR Route MVP

Priority: P0

Concrete tasks:

- Add DB-backed search covering building name, category, description, rooms, offices, and key services.
- Add a simple route model for demo-ready predefined paths: starting point, destination, ordered steps, landmarks, and estimated walk time.
- Decide whether to keep textual routes only as fallback or add a lightweight graph for Dijkstra/A* later.
- Add map details panel fields for office hours, contact info, floor/room summary, and route entry points.
- Make map UI usable on mobile with search, filters, building selection, and route details.

Acceptance criteria:

- A user can search for a building, office, or room and open a details panel from the result.
- A user can select a starting point and destination and see a route summary.
- Routes are admin-maintained or seed-maintained and survive page reload.
- At least the main gate to three important destinations are demo-ready.

### Milestone 4: Add Room Scheduling and Announcement Workflows

Priority: P1

Concrete tasks:

- Add `rooms`, `room_schedules`, and optionally `announcement_targets` tables in `database/schema.sql`.
- Seed a small realistic room/schedule dataset for students and instructors.
- Add admin CRUD for rooms and schedules.
- Show student schedule and instructor assigned rooms from the database instead of hardcoded arrays.
- Add announcement categories and optional role targeting: all, students, instructors, guests.
- Decide whether instructors can post announcements directly or submit them for admin approval.

Acceptance criteria:

- Admin can create/update/delete rooms and schedules.
- Student and instructor dashboards display schedule data from MySQL.
- Announcements appear chronologically and can be filtered by role/category.
- Demo accounts have realistic dashboard content without relying on `public/js/data.js` mock data.

### Milestone 5: Implement VR/360-Degree Guided Navigation

Priority: P1

Concrete tasks:

- Choose a practical VR library. Pannellum.js matches the manuscript and is lightweight for the current EJS app.
- Create a `vr_scenes` table with scene id, title, panorama URL, building/route relation, and hotspot definitions.
- Add at least one complete route with 3 to 5 linked scenes, such as Main Gate to Administration/Registrar.
- Add a VR route page or modal launched from map/building details.
- Add hotspot navigation, details panel, current route progress, and route completion state.
- Use optimized image assets and keep file sizes realistic for student devices.

Acceptance criteria:

- A user can start a VR route from a building/map details panel.
- Each hotspot moves to the next scene without console errors.
- The user can reach a destination and see a route completion state.
- At least two campus destinations have complete demo routes.
- Missing VR assets fail gracefully with a useful message instead of a broken viewer.

### Milestone 6: Add PWA Installability and Offline Mode

Priority: P1

Concrete tasks:

- Add `manifest.webmanifest`, icons, theme colors, and app metadata.
- Add a service worker and register it in a shared partial such as `views/partials/head.ejs`.
- Cache the app shell, CSS, JS, logo, selected building data, and a small set of VR/demo route assets.
- Add an offline indicator and fallback page.
- Store last-loaded map/building/route data in IndexedDB or Cache Storage.
- Keep offline scope small: enough for the demo routes and essential map/building directory.

Acceptance criteria:

- Browser install prompt or "install app" behavior is available on supported devices.
- After one successful online load, the app shell and selected building/route data open while offline.
- Offline mode clearly tells the user what is cached and what still needs internet.
- Lighthouse PWA checks pass for manifest and service worker basics.

### Milestone 7: Complete Admin, Logs, Settings, and Content Management

Priority: P2

Concrete tasks:

- Back `views/admin/faqs.ejs` with the existing `faqs` table and CRUD API.
- Replace hardcoded logs in `views/admin/logs.ejs` with a `system_logs` table.
- Log important events: login success/failure, admin CRUD actions, profile updates, and authorization denials.
- Back `views/admin/settings.ejs` with `system_settings`.
- Remove misleading hardcoded values, especially the MongoDB URI shown on the settings page.
- Add admin management for VR scenes and route definitions if time allows.

Acceptance criteria:

- FAQ, logs, and settings pages show database-backed data.
- Admin actions create audit log entries.
- Settings persist after refresh.
- No admin page presents obviously fake operational data during the final demo.

### Milestone 8: Testing, Security Review, and Deployment Readiness

Priority: P0, started early and completed last

Concrete tasks:

- Create a manual black-box test checklist matching manuscript Table 9 functionality cases.
- Create a security checklist matching manuscript Table 11: RBAC bypass, domain bypass, guest boundary, injection payloads, unauthorized POST, expired/modified session.
- Add at least lightweight automated smoke tests if time allows, using Playwright or Node's built-in test runner.
- Prepare SUS and user satisfaction survey forms matching manuscript Tables 10 and 12.
- Prepare a demo script using default accounts from `database/seed.js`.
- Document environment setup, seed steps, OAuth limitations, and fallback local login demo path.
- Decide final hosting plan: local school server, Render/Railway/Vercel-style frontend plus Node host, or local defense laptop.

Acceptance criteria:

- Test checklist has pass/fail evidence for every core module.
- Demo can be reset from a clean database.
- App runs with `npm start` and all required `.env` values are documented.
- The team has screenshots or recordings for map search, admin CRUD, VR route, offline mode, and role-based access.

## Suggested Technical Improvements

- Keep the current Express/EJS/MySQL stack unless the panel specifically requires the exact manuscript stack. Migrating to Supabase/PostGIS/MapLibre late in the project is high risk.
- If keeping MySQL, revise the manuscript/defense language to say "MySQL spatial-ready relational data" or "Leaflet/OpenStreetMap implementation" instead of claiming Supabase/PostGIS/MapLibre.
- Add small, focused tables instead of overloading `buildings.details`: `rooms`, `room_schedules`, `routes`, `route_steps`, `vr_scenes`, `vr_hotspots`, `announcement_targets`, and `system_logs`.
- Use shared validation helpers for admin APIs, especially for JSON fields and numeric coordinates.
- Add CSRF protection for form/API mutations before deployment.
- Add input sanitization/output escaping review for admin-created content.
- Add `helmet` and production session cookie settings.
- Keep offline caching limited to demo-critical assets. Caching every map tile and panorama can exceed device storage quickly.
- Avoid building a complex pathfinding engine unless route data is stable. Predefined route chains are more realistic for a capstone timeline and match the manuscript limitation of preset paths.

## Testing and Demo-Readiness Checklist

- Environment: `.env` contains DB credentials, `SESSION_SECRET`, and OAuth values or a documented local-login fallback.
- Database: `node database/seed.js` completes successfully and creates default admin/student data.
- Auth: local login, logout, invalid password, Google OAuth missing-config behavior, and role dashboard redirects are verified.
- RBAC: student/instructor/guest direct access to `/admin` and `/admin/api/*` is denied.
- Admin users: create, edit, delete, duplicate email, invalid role, and self-delete protection are verified.
- Admin content: news/events CRUD appears on public/dashboard screens after refresh.
- Buildings: admin building edits appear on `/buildings` and `/map`.
- Search: building, room, office, and category searches produce correct results.
- Routes: at least three predefined routes from main gate are demo-ready.
- VR: at least two VR route walkthroughs load on desktop and mobile.
- PWA: manifest is valid, service worker registers, installability works, and offline fallback works.
- Mobile: map, dashboard, building details, route modal, and VR viewer are usable on a phone viewport.
- Security: SQL/XSS payloads do not bypass login/search/admin forms or render executable scripts.
- Performance: large images are compressed; initial page load is acceptable on mobile data.
- Defense artifacts: screenshots, test results, survey forms, and demo script are prepared.

## Risks, Blockers, and Assumptions

### Risks

- The manuscript and implementation stack do not match. This is a defense risk unless the team either implements the named stack or explains an approved equivalent.
- VR asset collection can consume more time than coding. Without actual campus panoramas, the VR requirement will look incomplete.
- Offline caching for 360-degree assets can become slow or storage-heavy on student phones.
- Google OAuth depends on correct Google Cloud credentials and redirect URI setup.
- The app has no automated tests, so late changes can break core demo flows.
- Admin pages currently mix real and mock data, which can undermine credibility during a demo.
- Campus building, room, and route accuracy depends on verified CSPC data.

### Blockers

- No current panorama/VR assets are present in the repository.
- No room/schedule source of truth exists in `database/schema.sql`.
- No deployment target or production environment is defined.
- No final decision is documented for MySQL/Leaflet versus Supabase/PostGIS/MapLibre.

### Assumptions

- Real-time GPS, indoor positioning, automatic rerouting, and CSPC SIS/enrollment integration are out of scope, consistent with the manuscript limitations.
- Mocked or manually maintained room schedules are acceptable for the capstone demo if clearly documented.
- A small number of polished VR routes is better than many incomplete routes.
- The team has limited time, so the roadmap prioritizes defense-critical features over broad refactoring.

## Recommended Order of Work

1. Decide and document the final implementation stack.
2. Make buildings/map data database-backed everywhere.
3. Lock down auth and RBAC, especially admin registration and admin APIs.
4. Add room/schedule tables and replace hardcoded dashboard schedule data.
5. Complete announcements with role-aware display.
6. Build the first complete VR route with real or approved placeholder panoramas.
7. Add PWA manifest, service worker, offline shell, and offline indicator.
8. Finish admin FAQ/log/settings backing data if time remains.
9. Run the manuscript-aligned functional and security test checklist.
10. Prepare the final demo database, accounts, screenshots, and deployment notes.

## Minimum Defense-Ready Cut

If time becomes tight, focus on this reduced but credible scope:

- Database-backed buildings, search, route text, and admin building edits.
- Secure role login with admin-only backend.
- Student/instructor dashboards populated from the database.
- Admin news/events plus role-visible announcements.
- Two polished VR routes with hotspot progression.
- Basic PWA installability and offline shell with cached building/route data.
- Manual black-box, security, SUS, and user satisfaction test artifacts.

