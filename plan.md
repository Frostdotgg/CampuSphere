# Plan: Finish Milestone 2 - Harden Authentication, Roles, and Profiles

## Goal

Finish Milestone 2 from `ROADMAP.md`: lock down public registration, standardize route protection, verify admin API authorization, validate profile updates, define guest behavior, and harden session settings enough for a credible capstone demo.

This plan is only for Milestone 2. Do not work on room scheduling, announcements, VR, PWA/offline support, FAQ/log/settings backing data, or broad UI redesigns.

## Current State To Account For

- `controllers/authController.js` already blocks public registration roles outside `student-cspc`, `instructor`, and `guest`.
- Google OAuth role mapping in `controllers/authController.js` never returns `admin`.
- `routes/admin.js` protects all `/admin` pages and `/admin/api/*` endpoints with `requireRole('admin')`.
- Two login middleware modules exist:
  - `middleware/roleAuth.js`
  - `middleware/requireLogin.js`
- `routes/dashboard.js` still uses the standalone `middleware/requireLogin.js`.
- `controllers/profileController.js` trusts `req.body.role` and has weak validation.
- `/api/update-profile` is mounted directly in `server.js` and does its own session check instead of route-level middleware.
- Guest behavior is mixed: OAuth guest registration creates `guest_profiles`, but local guest registration does not clearly collect or persist guest profile fields.
- `server.js` uses a fallback session secret and minimal cookie settings.

## Implementation Steps

### 1. Verify And Finish Public Admin Registration Lockout

- Review `controllers/authController.js` public `registerPost`.
- Keep public roles limited to:
  - `student-cspc`
  - `instructor`
  - `guest`
- Ensure `admin`, unknown roles, blank roles, and tampered roles are rejected with a clear error.
- Do not remove `admin` from `controllers/adminUsersController.js`; admin-created admin accounts should remain possible from the protected admin UI.
- Confirm public auth views do not expose an admin option.
- Remove or correct misleading standalone register UI options if they do not match supported roles, especially `student-non-cspc`.

Acceptance criteria:

- Crafted public POST `/register` with `role=admin` does not create an admin account.
- Crafted public POST `/register` with an unknown role does not create a privileged account.
- Admin user creation from `/admin/users` can still create an admin account.
- Google OAuth cannot create admin users.

### 2. Standardize Protected Route Middleware

- Use `middleware/roleAuth.js` as the single source for auth middleware.
- Update `routes/dashboard.js` to import `requireLogin` from `middleware/roleAuth.js`.
- Decide what to do with `middleware/requireLogin.js`:
  - Preferred: make it a compatibility re-export from `roleAuth.js`.
  - Alternative: remove it only after confirming there are no imports.
- Keep `requireRole('admin')` protecting all `/admin` routes.
- Improve `requireLogin` and `requireRole` responses for API requests if practical:
  - Browser page requests can redirect/render.
  - JSON/API requests should return `401` or `403` JSON instead of an HTML redirect.

Acceptance criteria:

- Only one implementation owns login/role checks.
- `/dashboard` still requires login.
- Non-admin users cannot access `/admin` pages.
- Non-admin users cannot access `/admin/api/*` endpoints by direct URL or crafted request.

### 3. Review Admin API Authorization

- Confirm every admin mutation remains under `routes/admin.js`, which is mounted at `/admin`.
- Review these endpoints:
  - `/admin/api/users`
  - `/admin/api/news`
  - `/admin/api/events`
  - `/admin/api/buildings`
- Do not rely on hidden buttons or client-side navigation checks.
- Ensure controllers assume `req.session.user` is an admin because the route middleware enforces it.
- If adding JSON-aware auth responses in step 2, verify admin API denial responses are JSON and not redirects.

Acceptance criteria:

- Logged-out requests to `/admin/api/*` cannot mutate data.
- Student, instructor, and guest requests to `/admin/api/*` cannot mutate data.
- Admin requests to `/admin/api/*` still work.
- Admin pages still render normally for the seeded admin account.

### 4. Add Server Validation For Profile Updates

- Update `controllers/profileController.js`.
- Do not trust `req.body.role`; derive role from `req.session.user.role`.
- Ignore or reject attempts to change immutable identity fields through `/api/update-profile`, especially:
  - `role`
  - `email`
  - `id`
  - `password`
- Validate common profile fields:
  - `name`: required if sent; trim; reasonable length; split safely into first/last name.
- Validate student fields when session role is `student-cspc`:
  - `studentId`: trim; required when creating a missing profile.
  - `course`: trim; length limit.
  - `yearLevel`: allow known values or non-empty safe text.
- Validate instructor fields when session role is `instructor`:
  - `employeeId`: trim; required when creating a missing profile.
  - `department`: trim; length limit.
  - `position`: trim; length limit.
- Add guest profile update handling if the final guest model requires authenticated guest accounts:
  - `address`
  - `phone`
- Use parameterized queries only.
- Keep session data synchronized with saved DB values.
- Return consistent JSON errors, for example:

```json
{
  "success": false,
  "message": "Student ID is required."
}
```

Acceptance criteria:

- Profile updates persist in MySQL.
- After logout/login, updated profile fields reload correctly.
- A student cannot update instructor-only fields into their active profile.
- An instructor cannot update student-only fields into their active profile.
- A crafted request cannot change the user's role or email.
- Guest profile behavior is either implemented or explicitly rejected with a clear message.

### 5. Decide And Implement Guest Behavior

- Choose one final guest model for the capstone:
  - Recommended: authenticated guest accounts, because the current app already has a `guest` role and `guest_profiles` table.
- Document the choice in a short code comment or project note if needed.
- If using authenticated guest accounts:
  - Ensure local guest registration creates a matching `guest_profiles` row or clearly requires OAuth complete-registration for guest profile details.
  - Ensure guest login lands on the correct dashboard/home experience.
  - Ensure guest access restrictions in building details still work.
- If using true public guest access instead:
  - Define which public pages are accessible without login.
  - Do not create fake guest sessions silently.

Acceptance criteria:

- Guest behavior is consistent across local registration, OAuth registration, login, dashboard, and building restrictions.
- The team can explain guest behavior during defense without contradicting the manuscript.
- Guest users cannot access admin pages or admin APIs.

### 6. Harden Session Settings

- Update session configuration in `server.js`.
- Keep development usable, but fail loudly or warn clearly for unsafe production config.
- Recommended settings:
  - Require a strong `SESSION_SECRET` in production.
  - Keep fallback secret only for local development.
  - Set `cookie.httpOnly = true`.
  - Set `cookie.sameSite = 'lax'`.
  - Set `cookie.secure = true` when `NODE_ENV === 'production'`.
  - Keep a reasonable `maxAge`.
  - If deployed behind a proxy with HTTPS, set `app.set('trust proxy', 1)` in production.
- Keep OAuth redirect behavior compatible with the chosen environment.

Acceptance criteria:

- Local development still works with `npm start`.
- Production mode does not silently use the fallback session secret.
- Cookies use `httpOnly` and `sameSite`.
- Secure cookies are enabled when deployed over HTTPS in production.

### 7. Manual Verification Checklist

- Seed the database:

```bash
node database/seed.js
```

- Start the app:

```bash
npm start
```

- Verify role login flows:
  - Admin logs in and lands on `/admin`.
  - Student logs in and lands on `/dashboard`.
  - Instructor logs in and lands on `/dashboard`.
  - Guest logs in and lands on the intended guest experience.
- Verify public registration:
  - `student-cspc`, `instructor`, and `guest` registration work according to the chosen rules.
  - `admin` public registration is rejected.
  - Unknown public role registration is rejected.
- Verify RBAC:
  - Logged-out user cannot access `/dashboard`.
  - Logged-out user cannot access `/admin`.
  - Student, instructor, and guest cannot access `/admin`.
  - Student, instructor, and guest cannot call `/admin/api/*` successfully.
- Verify profile updates:
  - Student profile changes persist after logout/login.
  - Instructor profile changes persist after logout/login.
  - Guest profile behavior matches the chosen model.
  - Crafted role/email changes through `/api/update-profile` fail or are ignored safely.

## Final Milestone 2 Acceptance Criteria

- Students, instructors, admins, and guests land on the correct role experience.
- Non-admin users cannot access `/admin` pages or `/admin/api/*` endpoints by direct URL or crafted request.
- A user cannot register themselves as admin through the public form.
- Profile changes persist in the database and reload correctly after logout/login.
- Session settings are defensible for production or clearly documented for local demo use.
- Guest behavior is consistent and explainable.

## Recommended Order Of Work

1. Re-verify public admin registration lockout and remove misleading public role options.
2. Standardize `routes/dashboard.js` on `middleware/roleAuth.js`.
3. Make `roleAuth.js` return proper JSON errors for API authorization failures.
4. Review admin API protection with direct crafted requests.
5. Rewrite `/api/update-profile` validation to derive role from the session.
6. Decide and implement guest behavior.
7. Harden session settings in `server.js`.
8. Run the manual verification checklist.

## Risks And Notes

- Profile update validation is the highest-risk part because current code trusts client-submitted role data.
- Dashboard code still uses legacy client-side data, but that is Milestone 4 unless it directly affects role/profile correctness.
- CSRF protection is important before deployment, but it is broader than this milestone unless the team chooses to include it here.
- Google OAuth testing depends on valid Google Cloud credentials and redirect URI setup; local-login paths should remain the defense fallback.
