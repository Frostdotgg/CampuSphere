# Google OAuth Auth Plan for CampusSphere

## Codebase Context

1. The project is an Express.js 5 app using CommonJS, EJS views, MySQL through `mysql2/promise`, `express-session`, and `bcrypt`.
2. The main app entry is `server.js`. It configures sessions, exposes `req.session.user` to all views as `res.locals.user`, mounts route modules, and serves static files from `public/`.
3. The `/auth` page is defined in `routes/auth.js` and rendered by `controllers/authController.js` through `views/auth.ejs`.
4. Existing auth is local email/password auth. There is no Google OAuth, Passport, NextAuth, Firebase, or other auth library currently wired in.
5. Existing roles are `student-cspc`, `instructor`, `admin`, and `guest`. These roles are stored in the `users.role` enum in `database/schema.sql`.
6. The app has one `/dashboard` route in `routes/dashboard.js`. Role-specific dashboard content is rendered by `views/dashboard.ejs` based on `req.session.user.role`.
7. `views/dashboard.ejs`, `public/js/data.js`, `models/data.js`, `public/js/nav-role.js`, and `public/js/profile-script.js` all depend on the role keys. OAuth must continue using `student-cspc`, `instructor`, and `guest`.
8. Important correction: do not simplify or remove the existing sign-in/register UI in `views/auth.ejs`. The current page must stay recognizable and keep its local email/password sign-in and register forms.
9. The previous plan said to remove the role-selection/register flow. Do not follow that older instruction.

## Revised Target Behavior

1. On `http://localhost:3000/auth`, preserve the existing Sign In and Register tabs.
2. Do not remove existing local email/password sign-in.
3. Do not remove existing local email/password registration fields unless a field is explicitly replaced by the new Google registration flow.
4. Do not remove visible sign-in controls for existing users.
5. The existing Sign In tab button labeled `Sign in using CSPC Email` must start a real server-side Google OAuth flow for existing users.
6. The Register tab must include a Google registration action labeled:

   `Register using Email`

7. Login and registration are separate OAuth intents:
   - Sign-in OAuth intent: existing users only.
   - Register OAuth intent: new-user onboarding.
8. If a user tries to sign in with Google and their email already exists in the `users` table, authenticate them and redirect by role.
9. If a user tries to sign in with Google and their email does not exist, do not auto-create the account. Redirect them to the registration/onboarding flow with a message like:

   `No account found for this email. Please register first.`

10. If a user starts registration with Google and their email already exists, sign them in or show:

   `An account with this email already exists. Please sign in instead.`

11. If a user starts registration with Google and their email is new, classify their role by exact email domain and ask for the necessary details before creating the account.
12. Unauthorized domains must be rejected with:

   `Your email domain is not authorized. Please use a CSPC or Gmail account.`

## Domain Role Rules

Normalize emails before domain checks:

```js
const normalizedEmail = String(email || '').trim().toLowerCase();
const domain = normalizedEmail.includes('@')
  ? normalizedEmail.split('@').pop()
  : '';
```

Exact domain mapping:

1. `my.cspc.edu.ph` -> `student-cspc`
2. `cspc.edu.ph` -> `instructor`
3. `gmail.com` -> `guest`
4. Anything else -> unauthorized domain

Do not allow other domains or subdomains unless explicitly added later.

## Sign-In Flow

1. User opens `/auth`.
2. User stays on the existing Sign In tab.
3. User can still use the local email/password form.
4. User can click the existing Google-style button currently labeled `Sign in using CSPC Email`.
5. That button should link to a new OAuth start route for sign-in intent, for example:

   ```text
   /auth/google?intent=login
   ```

6. The server starts Google OAuth and stores both:
   - `req.session.oauthState`
   - `req.session.oauthIntent = 'login'`

7. Google returns to `/auth/callback`.
8. The server validates OAuth state, gets the verified email, normalizes it, and checks the database.
9. If the email exists:
   - Use the existing user row.
   - Hydrate `req.session.user`.
   - Load `student_profiles`, `instructor_profiles`, or `guest_profiles` data if applicable.
   - Redirect admins to `/admin`.
   - Redirect all other roles to `/dashboard`.
10. If the email does not exist:
   - Clear partial OAuth session data.
   - Redirect to `/auth?error=account_not_found`.
   - Do not create a user silently.

## Registration Flow

1. User opens `/auth`.
2. User stays on the existing Register tab.
3. The Register tab must include `Register using Email`.
4. Clicking `Register using Email` should link to:

   ```text
   /auth/google?intent=register
   ```

5. The server starts Google OAuth and stores:
   - `req.session.oauthState`
   - `req.session.oauthIntent = 'register'`

6. Google returns to `/auth/callback`.
7. The server validates OAuth state, gets the verified email, normalizes it, and checks the database.
8. If the email already exists:
   - Either sign in immediately and redirect by role, or redirect to `/auth?error=account_exists`.
   - Preferred behavior: redirect to `/auth?error=account_exists` so the user intentionally uses Sign In.
9. If the email is new:
   - Determine the role from the exact domain.
   - Store temporary pending OAuth registration data in session:

     ```js
     req.session.pendingOAuthRegistration = {
       email,
       role,
       googleSub,
       givenName,
       familyName,
       fullName,
       picture
     };
     ```

   - Redirect to a new role-aware completion page:

     ```text
     /auth/complete-registration
     ```

10. The completion page renders only the fields required for the detected role.
11. When the user submits the completion form, create the `users` row, create the matching profile row, hydrate `req.session.user`, clear `pendingOAuthRegistration`, then redirect:
   - `student-cspc` -> `/dashboard`
   - `instructor` -> `/dashboard`
   - `guest` -> `/dashboard`

## Registration Detail Fields

Use the current code as the source of truth for student and instructor registration fields. The field lists below are based on the existing local registration form in `views/auth.ejs` and the current profile tables in `database/schema.sql`.

### Student Registration: `@my.cspc.edu.ph`

The role is `student-cspc`.

Required or expected fields:

1. Full Name
2. Email, read-only from Google OAuth
3. Student ID
4. Year Level
5. Course
6. Section
7. Status, default `Regular`

Create:

1. `users` row:
   - `username` from email prefix
   - `email` from Google
   - random non-login placeholder password hash
   - `role = 'student-cspc'`
   - `first_name` and `last_name` from submitted full name or Google profile
2. `student_profiles` row:
   - `user_id`
   - `student_id_number`
   - `course`
   - `year_level`
   - `section`
   - `status`
   - `enrollment_status = 'Enrolled'`
   - `semester`, use a sensible current/default value unless the form supplies it

### Instructor Registration: `@cspc.edu.ph`

The role is `instructor`.

Required or expected fields:

1. Full Name
2. Email, read-only from Google OAuth
3. Employee ID
4. Department
5. Position

Create:

1. `users` row:
   - `username` from email prefix
   - `email` from Google
   - random non-login placeholder password hash
   - `role = 'instructor'`
   - `first_name` and `last_name` from submitted full name or Google profile
2. `instructor_profiles` row:
   - `user_id`
   - `employee_id`
   - `department`
   - `position`
   - `status = 'Active'`

### Guest Registration: `@gmail.com`

The role is `guest`.

Required fields:

1. Full Name
2. Email, read-only from Google OAuth
3. Address
4. Phone Number

Create:

1. `users` row:
   - `username` from email prefix
   - `email` from Google
   - random non-login placeholder password hash
   - `role = 'guest'`
   - `first_name` and `last_name` from submitted full name or Google profile
2. `guest_profiles` row:
   - `user_id`
   - `address`
   - `phone_number`

## Database Changes

The previous plan said no schema change was needed. That is no longer true because guest registration requires address and phone number.

Modify `database/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS guest_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    address VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

Recommended optional additions:

1. Add `oauth_provider VARCHAR(50)` to `users`, default `local`.
2. Add `oauth_subject VARCHAR(255)` to `users`, nullable.
3. Add `profile_image_url VARCHAR(255)` to `users`, nullable, if Google profile pictures should be saved.

If avoiding optional migrations for now, keep using email as the unique identity and only add `guest_profiles`.

## Files to Modify

### `routes/auth.js`

Add routes:

1. `GET /auth/google`
   - Starts OAuth with `intent=login` or `intent=register`.
2. `GET /auth/callback`
   - Handles Google OAuth callback.
3. `GET /auth/complete-registration`
   - Renders the role-specific completion form for new OAuth registrations.
4. `POST /auth/complete-registration`
   - Creates the user/profile from pending OAuth registration data.

Keep existing routes:

1. `GET /auth`
2. `GET /login`
3. `GET /register`
4. `POST /login`
5. `POST /register`
6. `GET /logout`

### `controllers/authController.js`

Update `exports.auth`:

1. Read `req.query.error`.
2. Render user-facing messages for:
   - `unauthorized_domain`
   - `account_not_found`
   - `account_exists`
   - `oauth_failed`
   - `registration_expired`

Add or update helper functions:

1. `getGoogleConfig()`
2. `getRoleFromEmail(email)`
3. `splitGoogleName(profile)`
4. `findUserByEmail(email)`
5. `createOAuthUserWithProfile(pending, formBody)`
6. `hydrateSessionUser(user)`
7. `loadRoleProfileIntoSession(sessionUser)`
8. `clearOAuthState(req)`

Add controller actions:

1. `googleStart`
2. `googleCallback`
3. `completeRegistration`
4. `completeRegistrationPost`

Important controller rules:

1. Do not auto-create new users during login intent.
2. Do not let browser JavaScript decide the role.
3. Do not expose `GOOGLE_CLIENT_SECRET` to EJS or browser JavaScript.
4. Always validate that `req.session.pendingOAuthRegistration` exists before rendering/submitting completion.
5. Always re-check that the pending email does not already exist before creating the account.
6. Use parameterized SQL queries only.
7. Generate a random placeholder password hash for OAuth-created users because `users.password` is `NOT NULL`.

### `views/auth.ejs`

Preserve the current page structure:

1. Keep Sign In and Register tabs.
2. Keep the local email/password login form.
3. Keep the local email/password registration form unless later explicitly removed.
4. Keep the existing error/success message area.
5. Do not remove `.auth-tabs`, `panel-login`, or `panel-register`.
6. Do not replace the whole page with a single OAuth panel.

Specific changes:

1. Change the Sign In Google button behavior from `onclick="simulateLogin()"` to a real link or button that navigates to:

   ```text
   /auth/google?intent=login
   ```

2. Keep its visible label as:

   ```text
   Sign in using CSPC Email
   ```

3. Add or update the Register tab's Google button so its visible label is:

   ```text
   Register using Email
   ```

4. That register button should navigate to:

   ```text
   /auth/google?intent=register
   ```

5. Remove only the simulated Google JavaScript functions:
   - `simulateLogin`
   - `simulateRegister`

6. Do not remove local form submission scripts that are still needed for the local email/password forms.
7. If the current role-selection cards remain for local registration, keep them. OAuth registration ignores client-selected role and uses server-side email domain instead.

### New View: `views/complete-registration.ejs`

Create a new EJS view for completing OAuth registration.

Requirements:

1. Use the same visual language as `views/auth.ejs`.
2. Show the detected role in a non-editable way.
3. Show Google email as read-only.
4. Render fields based on `pendingOAuthRegistration.role`.
5. Submit to `POST /auth/complete-registration`.
6. Include CSRF protection only if the app later adds a CSRF library. Do not invent partial CSRF in this implementation.

### `database/schema.sql`

Add `guest_profiles` table.

Optional:

1. Add OAuth metadata columns to `users`.
2. Add profile image URL column to `users`.

### `database/seed.js`

No required seed changes unless adding default guest sample data.

If `guest_profiles` is added, no existing seed row must break.

### `public/css/styles.css`

Prefer existing auth styles.

Only add CSS for:

1. Role badge on complete registration page.
2. Read-only OAuth email field.
3. Minor spacing for completion form.

Do not redesign the auth page.

### `.env`

Add:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
```

### `.env.example`

Create this file if it does not exist.

Include placeholders for:

1. DB settings
2. `PORT`
3. `SESSION_SECRET`
4. Google OAuth settings

Do not put real secrets in `.env.example`.

## OAuth Flow Details

1. `GET /auth/google?intent=login`
2. `GET /auth/google?intent=register`
3. If `intent` is missing or invalid, default to `login`.
4. Generate a cryptographically random `state` value with Node's `crypto` module.
5. Save the state and intent in session.
6. Redirect to Google's authorization endpoint:

   ```text
   https://accounts.google.com/o/oauth2/v2/auth
   ```

7. Include:

   ```text
   client_id=process.env.GOOGLE_CLIENT_ID
   redirect_uri=process.env.GOOGLE_REDIRECT_URI
   response_type=code
   scope=openid email profile
   access_type=offline
   prompt=select_account
   state=<session state>
   ```

8. In callback, reject if:
   - `code` is missing.
   - `state` is missing.
   - `state` does not match `req.session.oauthState`.
   - Google token exchange fails.
   - Google userinfo fetch fails.
   - Google does not return an email.
   - `email_verified` is false.
   - Domain is not exactly `my.cspc.edu.ph`, `cspc.edu.ph`, or `gmail.com`.

9. Exchange authorization code:

   ```text
   POST https://oauth2.googleapis.com/token
   Content-Type: application/x-www-form-urlencoded

   code=<code>
   client_id=<GOOGLE_CLIENT_ID>
   client_secret=<GOOGLE_CLIENT_SECRET>
   redirect_uri=<GOOGLE_REDIRECT_URI>
   grant_type=authorization_code
   ```

10. Fetch user profile:

   ```text
   GET https://www.googleapis.com/oauth2/v3/userinfo
   Authorization: Bearer <access_token>
   ```

11. Use returned `email`, `email_verified`, `given_name`, `family_name`, `name`, `picture`, and `sub` if available.

## Session and Dashboard Notes

1. Existing dashboard rendering reads `window.__SESSION_USER` from `views/partials/dash-navbar.ejs`.
2. Existing client scripts prefer server session data and only fall back to `localStorage`.
3. OAuth should not write selected roles to `localStorage`.
4. The dashboard should continue receiving role from `req.session.user.role`.
5. For students without a `student_profiles` row, `controllers/dashboardController.js` already shows "Not yet set" defaults.
6. For instructors without an `instructor_profiles` row, `controllers/dashboardController.js` already shows empty-state defaults.
7. For guests, add guest profile loading only where the UI needs address and phone. The current guest dashboard can continue working with the base `users` session shape.

## Dashboard Access

Recommended hardening:

1. Add `requireLogin` to `/dashboard` so the dashboard means an authenticated session.
2. If the project still needs anonymous guest browsing, preserve public `/home`, `/map`, `/buildings`, and `/events`, but keep `/dashboard` authenticated.
3. A Gmail user is an authenticated `guest`, not an anonymous visitor.

## Dependency Plan

1. Prefer no new dependency.
2. Use native Node.js `fetch` for token exchange and userinfo requests.
3. Use Node's built-in `crypto` module for OAuth state generation and random placeholder passwords.
4. Keep `bcrypt` because it is already installed and required by existing local auth.
5. If the local Node version does not support global `fetch`, install `undici` and import `fetch` from it.
6. Do not install Passport or NextAuth unless the user explicitly asks to switch to a library-based implementation.

## Google Cloud Setup

1. Create or open a Google Cloud project.
2. Configure the OAuth consent screen.
3. Create an OAuth 2.0 Client ID for a Web application.
4. Add this Authorized redirect URI:

   ```text
   http://localhost:3000/auth/callback
   ```

5. Copy the client ID and secret into `.env`:

   ```env
   GOOGLE_CLIENT_ID=<client id>
   GOOGLE_CLIENT_SECRET=<client secret>
   GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
   ```

6. Restart the Express server after editing `.env`.

## Implementation Order

1. Add `.env.example` placeholders.
2. Add `guest_profiles` to `database/schema.sql`.
3. Add OAuth/domain/session helper functions to `controllers/authController.js`.
4. Add `googleStart` in `controllers/authController.js`.
5. Add `googleCallback` in `controllers/authController.js`.
6. Add `completeRegistration` and `completeRegistrationPost`.
7. Add `/auth/google`, `/auth/callback`, `/auth/complete-registration` GET, and `/auth/complete-registration` POST routes in `routes/auth.js`.
8. Update `authController.auth` to display OAuth-specific query errors.
9. Update `views/auth.ejs` without removing the existing page:
   - Wire Sign In OAuth button to login intent.
   - Add/wire Register OAuth button to register intent.
   - Remove only simulated Google handlers.
10. Add `views/complete-registration.ejs`.
11. Add small CSS only if needed for the completion form.
12. Decide whether to protect `/dashboard` with `requireLogin`.
13. Run the app and manually test all login and registration branches.

## Manual Test Checklist

### Existing Sign-In UI Preservation

1. Open `http://localhost:3000/auth`.
2. Confirm the Sign In tab still exists.
3. Confirm the Register tab still exists.
4. Confirm local email/password sign-in still exists.
5. Confirm local email/password registration still exists unless intentionally preserved as-is.
6. Confirm the page was not replaced by a single OAuth-only panel.

### Existing User OAuth Sign-In

1. Seed or create a user with email ending in `my.cspc.edu.ph`.
2. Click `Sign in using CSPC Email`.
3. Choose the same Google account.
4. Confirm the app signs in the existing user as `student-cspc` and redirects to `/dashboard`.
5. Repeat with an existing `cspc.edu.ph` user and confirm role `instructor`.
6. Repeat with an existing `gmail.com` user and confirm role `guest`.
7. Try sign-in with an allowed-domain email that is not in the database. Confirm no account is created and the app shows the account-not-found message.

### New User OAuth Registration

1. Click `Register using Email`.
2. Register with a new `my.cspc.edu.ph` email.
3. Confirm the app asks for student details only.
4. Submit student details and confirm a `users` row and `student_profiles` row are created.
5. Register with a new `cspc.edu.ph` email.
6. Confirm the app asks for instructor details only.
7. Submit instructor details and confirm a `users` row and `instructor_profiles` row are created.
8. Register with a new `gmail.com` email.
9. Confirm the app asks for Full Name, Address, and Phone Number only.
10. Submit guest details and confirm a `users` row and `guest_profiles` row are created.
11. Try registration with an unsupported domain and confirm the unauthorized-domain message.
12. Try registration with an email that already exists and confirm the account-exists message or sign-in redirect behavior chosen above.

### Session and Dashboard

1. Confirm `req.session.user.role` is set from the server-side domain result.
2. Confirm no OAuth role is written to `localStorage`.
3. Confirm dashboard navbar name/email come from server session.
4. Confirm `/logout` destroys the session and returns to `/auth`.

## Notes for the Implementing AI

1. Preserve the current `/auth` page. Do not delete its tabs, local sign-in form, or local register form.
2. Wire the existing Google sign-in button instead of removing it.
3. Add the new register Google action without flattening the whole page.
4. Existing-user sign-in must not create users silently.
5. New-user registration must not finish until the role-specific details are submitted.
6. Determine role only on the server after Google returns a verified email.
7. Use exact domain checks:
   - `my.cspc.edu.ph` -> student
   - `cspc.edu.ph` -> instructor
   - `gmail.com` -> guest
8. Do not expose `GOOGLE_CLIENT_SECRET` in EJS or browser JavaScript.
9. Keep dashboard role keys unchanged.
10. Preserve unrelated admin, map, buildings, events, and profile behavior.
11. Do not create `/dashboard/student`, `/dashboard/instructor`, or `/dashboard/guest` unless explicitly requested. The current architecture uses one role-aware `/dashboard`.
