/* ========================================
   CampuSphere — Auth Controller
   Handles Auth, Login, Register, Google OAuth
   ======================================== */

const crypto = require('crypto');
const db = require('../config/db');
const bcrypt = require('bcrypt');
const authDataSource = require('../config/authDataSource');
const userRepository = require('../repositories/userRepository');
const auditService = require('../services/auditService');
const { wantsJson } = require('../middleware/roleAuth');
// Single token-issuance primitive (middleware/csrfProtection.js). Imported so a
// regenerated authenticated session is persisted ALREADY carrying its CSRF
// token. No import cycle: csrfProtection -> roleAuth -> auditService only.
const { ensureCsrfToken } = require('../middleware/csrfProtection');
const { clearSessionCookie } = require('../config/sessionConfig');
// R7-style shared validators (utils/adminValidation.js). M2: local public
// registration now applies the same server-side email format + password policy
// the admin user CRUD already enforces, instead of only a non-empty presence check.
const { validateEmail, validatePassword } = require('../utils/adminValidation');
const { normalizeMediaUrl } = require('../utils/mediaUrl');
const { normalizeGoogleProfileImageUrl } = require('../utils/googleProfileImage');
const { resolveAccountIdentityName, normalizeWhitespace } = require('../utils/accountIdentityName');

const SALT_ROUNDS = 10;

// L4 (login user-enumeration): a FIXED, non-secret dummy bcrypt hash at the same
// cost (10) as real password hashes. On the local-login path we ALWAYS run
// bcrypt.compare — against the user's hash, or against THIS dummy when the email
// is unknown or the row has no password — so an unknown email costs the same as a
// wrong password and cannot be distinguished by response timing. It is a hash of
// a random throwaway value that matches no account; compare() against it is always
// false. It is generated offline (never at runtime) and never logged/exposed.
const DUMMY_LOGIN_HASH = '$2b$10$9vR6SG1xh5Vxbyzv2l2M.OG.6CWDsjO4vh2xSP4EltTklHVDSAc7i';

const OAUTH_QUERY_ERRORS = {
  unauthorized_domain: 'Your email domain is not authorized. Please use a CSPC or Gmail account.',
  account_not_found: 'No account found for this email. Please register first.',
  account_exists: 'An account with this email already exists. Please sign in instead.',
  oauth_failed: 'Google sign-in failed. Please try again.',
  registration_expired: 'Registration session expired. Please start again.'
};

function getGoogleConfig() {
  return {
    clientId: (process.env.GOOGLE_CLIENT_ID || '').trim(),
    clientSecret: (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
    redirectUri: (process.env.GOOGLE_REDIRECT_URI || '').trim() || 'http://localhost:3000/auth/callback'
  };
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Exact domain mapping for OAuth registration/login eligibility.
 * @returns {'student-cspc'|'instructor'|'guest'|null}
 */
function getRoleFromEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const domain = normalizedEmail.includes('@') ? normalizedEmail.split('@').pop() : '';
  if (domain === 'my.cspc.edu.ph') return 'student-cspc';
  if (domain === 'cspc.edu.ph') return 'instructor';
  if (domain === 'gmail.com') return 'guest';
  return null;
}

function splitGoogleName(profile) {
  const identity = resolveAccountIdentityName({
    givenName: profile && profile.given_name,
    familyName: profile && profile.family_name,
    fullName: profile && profile.name,
    email: profile && profile.email
  });
  return { first: identity.firstName, last: identity.lastName };
}

async function findUserByEmail(email) {
  const e = normalizeEmail(email);
  const [rows] = await db.query(
    'SELECT * FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1',
    [e]
  );
  return rows[0] || null;
}

function clearOAuthState(req) {
  delete req.session.oauthState;
  delete req.session.oauthIntent;
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

// Regenerate the Express session to issue a fresh session ID before an
// unauthenticated or pending-registration session becomes authenticated
// (R3 session-fixation defense). regenerate() destroys the old session in the
// store and starts an empty one, so a session ID fixed before login cannot be
// reused to reach the authenticated session, and no arbitrary pre-auth data is
// carried over. Any pre-auth state still required (e.g. pending OAuth
// registration) must be captured into a local variable before this call.
function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

// Best-effort destroy of the current session. Never rejects; used only on the
// failure path of establishAuthenticatedSession so a half-established
// authenticated session is not left in the store.
function destroySessionQuietly(req) {
  return new Promise((resolve) => {
    if (!req.session || typeof req.session.destroy !== 'function') return resolve();
    req.session.destroy(() => resolve());
  });
}

// Best-effort clear of the active session cookie using the configured name and
// attributes (Milestone 8, Section 8.4 — dev: campusphere.sid; prod:
// __Host-campusphere.sid). Never throws; privacy belt-and-suspenders alongside
// destroying the session.
function clearSessionCookieQuietly(res) {
  clearSessionCookie(res);
}

// Establish an authenticated session atomically (R3 + follow-up hardening):
//   1) regenerate to a fresh session ID (fixation defense);
//   2) assign/hydrate req.session.user via assignSessionUser();
//   3) mint the NEW session's CSRF token (regeneration discarded the anonymous
//      pre-login one, which is never reused);
//   4) persist the combined authenticated session with one explicit save
//      before the caller redirects.
// Step 3 must precede step 4: without it the token was minted lazily by
// attachCsrfToken on the FIRST authenticated page render, which dirtied the
// session and triggered an asynchronous store write. Under the Supabase session
// store an immediately submitted form carrying that rendered token — the admin
// HTML logout forms do exactly this — could then be validated against a stored
// session that did not yet contain it, producing a spurious 403. Minting before
// the save makes the persisted session and the rendered token atomic.
// If ANY step after regeneration fails, drop req.session.user so Express's
// end-of-response autosave cannot persist an authenticated regenerated session,
// best-effort destroy that session and clear its cookie, then rethrow a
// sanitized error into the caller's existing catch (which renders/redirects the
// path's fixed generic failure). No session ID, cookie, or raw error is logged.
async function establishAuthenticatedSession(req, res, assignSessionUser) {
  await regenerateSession(req);
  try {
    await assignSessionUser();
    // Mint the regenerated session's token BEFORE the explicit save. A failure
    // here falls into the same sanitized establishment-failure path below.
    ensureCsrfToken(req.session);
    await saveSession(req);
  } catch (err) {
    try { if (req.session) delete req.session.user; } catch (e) {}
    await destroySessionQuietly(req);
    clearSessionCookieQuietly(res);
    throw new Error('SESSION_ESTABLISH_FAILED');
  }
}

async function hydrateSessionUser(req, userRow) {
  const googlePicture = normalizeGoogleProfileImageUrl(userRow && userRow.profile_image_url);
  const storedPicture = googlePicture || normalizeMediaUrl(userRow && userRow.profile_image_url) || '';
  req.session.user = {
    id: userRow.id,
    username: userRow.username,
    email: userRow.email,
    role: userRow.role,
    first_name: userRow.first_name,
    last_name: userRow.last_name,
    profile_image_url: storedPicture,
    profile_image_source: (userRow.oauth_provider === 'google' || googlePicture) ? 'google' : (storedPicture ? 'custom' : '')
  };
}

async function loadRoleProfileIntoSession(sessionUser) {
  if (!sessionUser || !sessionUser.id) return;
  if (sessionUser.role === 'student-cspc') {
    const [profiles] = await db.query('SELECT * FROM student_profiles WHERE user_id = ?', [sessionUser.id]);
    if (profiles.length > 0) {
      const sp = profiles[0];
      Object.assign(sessionUser, {
        student_id_number: sp.student_id_number,
        course: sp.course,
        year_level: sp.year_level,
        enrollment_status: sp.enrollment_status,
        semester: sp.semester
      });
    }
  }
  if (sessionUser.role === 'instructor') {
    const [profiles] = await db.query('SELECT * FROM instructor_profiles WHERE user_id = ?', [sessionUser.id]);
    if (profiles.length > 0) {
      const ip = profiles[0];
      Object.assign(sessionUser, {
        employee_id: ip.employee_id,
        department: ip.department,
        position: ip.position
      });
    }
  }
  if (sessionUser.role === 'guest') {
    const [profiles] = await db.query('SELECT * FROM guest_profiles WHERE user_id = ?', [sessionUser.id]);
    if (profiles.length > 0) {
      const gp = profiles[0];
      Object.assign(sessionUser, {
        address: gp.address,
        phone_number: gp.phone_number
      });
    }
  }
}

// Supabase-mode counterpart of loadRoleProfileIntoSession. Merges role-
// specific profile fields into req.session.user using the read-only
// repository. The merged field names mirror the MySQL path exactly so EJS
// templates, dashboard partials, and middleware see the same session shape
// in either mode. Admin sessions have no profile row; missing rows are a
// no-op (mirrors the `profiles.length > 0` guard in the MySQL helper).
async function loadRoleProfileIntoSessionFromSupabase(sessionUser) {
  if (!sessionUser || !sessionUser.id) return;
  const profile = await userRepository.loadRoleProfile(sessionUser.id, sessionUser.role);
  if (!profile) return;
  if (sessionUser.role === 'student-cspc') {
    Object.assign(sessionUser, {
      student_id_number: profile.student_id_number,
      course: profile.course,
      year_level: profile.year_level,
      enrollment_status: profile.enrollment_status,
      semester: profile.semester
    });
  } else if (sessionUser.role === 'instructor') {
    Object.assign(sessionUser, {
      employee_id: profile.employee_id,
      department: profile.department,
      position: profile.position
    });
  } else if (sessionUser.role === 'guest') {
    Object.assign(sessionUser, {
      address: profile.address,
      phone_number: profile.phone_number
    });
  }
}

async function exchangeGoogleCode(code, config) {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code'
  });
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!tokenRes.ok) return null;
  return tokenRes.json();
}

async function fetchGoogleUserinfo(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) return null;
  return res.json();
}

/*
 * Google profile photos are non-essential to authentication. Refresh the
 * stored URL when it changes, but never turn a photo-provider outage into a
 * login outage. The user row is updated in place after a successful write so
 * the freshly hydrated session contains the same value without another read.
 */
async function syncGoogleProfileImage(userRow, rawPicture, useSupabase) {
  const picture = normalizeGoogleProfileImageUrl(rawPicture);
  if (!picture || !userRow || picture === userRow.profile_image_url) return;

  try {
    if (useSupabase) {
      await userRepository.updateUserProfileImage(userRow.id, picture);
    } else {
      await db.query(
        'UPDATE users SET profile_image_url = ? WHERE id = ?',
        [picture, userRow.id]
      );
    }
    userRow.profile_image_url = picture;
  } catch (err) {
    // Do not log the URL, user id, email, or provider error. The existing
    // stored picture remains authoritative for this session when the optional
    // refresh cannot be written.
    console.warn('Google profile picture refresh skipped.');
  }
}

/*
 * Google identity names are non-essential to authentication, but they are the
 * authoritative name for student, guest, and instructor accounts. Refresh the
 * stored value only when it differs, and never turn a provider/database write
 * failure into a login failure. The caller hydrates the session after this
 * best-effort sync, so a successful update is visible immediately.
 */
async function syncGoogleIdentityName(userRow, profile, useSupabase) {
  const lockedRoles = new Set(['student-cspc', 'guest', 'instructor']);
  if (!userRow || !lockedRoles.has(userRow.role)) return;

  const identity = resolveAccountIdentityName({
    givenName: profile && profile.given_name,
    familyName: profile && profile.family_name,
    fullName: profile && profile.name,
    email: profile && profile.email
  });
  const storedFirst = normalizeWhitespace(userRow.first_name);
  const storedLast = normalizeWhitespace(userRow.last_name);
  if (storedFirst === identity.firstName && storedLast === identity.lastName) return;

  try {
    if (useSupabase) {
      await userRepository.updateUserName(userRow.id, {
        first_name: identity.firstName,
        last_name: identity.lastName
      });
    } else {
      await db.query(
        'UPDATE users SET first_name = ?, last_name = ? WHERE id = ?',
        [identity.firstName, identity.lastName, userRow.id]
      );
    }
    userRow.first_name = identity.firstName;
    userRow.last_name = identity.lastName;
  } catch (err) {
    // Deliberately generic: never log the provider payload, account id, email,
    // database error, or any other identifier. The next Google login retries.
    console.warn('Google account name refresh skipped.');
  }
}

async function createOAuthUserWithProfile(pending, body) {
  const fields = body && typeof body === 'object' ? body : {};
  const identity = resolveAccountIdentityName({
    givenName: pending && pending.givenName,
    familyName: pending && pending.familyName,
    fullName: pending && pending.fullName,
    email: pending && pending.email
  });
  const first_name = identity.firstName;
  const last_name = identity.lastName;

  const email = normalizeEmail(pending && pending.email);
  const rawUser = email.split('@')[0] || 'user';
  const username = rawUser.slice(0, 50);
  const placeholder = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), SALT_ROUNDS);
  const role = pending && pending.role;

  const picture = normalizeGoogleProfileImageUrl(pending.picture) || null;
  const googleSub = pending.googleSub || null;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO users (username, email, password, role, first_name, last_name, profile_image_url, oauth_provider, oauth_subject)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'google', ?)`,
      [username, email, placeholder, role, first_name, last_name, picture, googleSub]
    );
    const userId = result.insertId;

    if (role === 'student-cspc') {
      const studentId = String(fields.studentId || '').trim();
      if (!studentId) throw new Error('MISSING_STUDENT');
      await conn.query(
        `INSERT INTO student_profiles (user_id, student_id_number, course, year_level, enrollment_status, semester)
         VALUES (?, ?, ?, ?, 'Enrolled', ?)`,
        [
          userId,
          studentId,
          String(fields.course || '').trim() || '',
          String(fields.yearLevel || '').trim() || '1st Year',
          String(fields.semester || '1st Semester 2026-2027').trim() || '1st Semester 2026-2027'
        ]
      );
    } else if (role === 'instructor') {
      // Instructor identity is supplied by the verified Google account. Keep
      // the role-profile row for its system-owned status, but do not collect
      // or persist the retired employee/department/position fields.
      await conn.query(
        `INSERT INTO instructor_profiles (user_id, employee_id, department, position, status)
         VALUES (?, ?, ?, ?, 'Active')`,
        [userId, '', '', '']
      );
    } else if (role === 'guest') {
      const address = String(fields.address || '').trim();
      const phone = String(fields.phone || '').trim();
      if (!address || !phone) throw new Error('MISSING_GUEST');
      await conn.query(
        'INSERT INTO guest_profiles (user_id, address, phone_number) VALUES (?, ?, ?)',
        [userId, address, phone]
      );
    }

    await conn.commit();
    return userId;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// Complete a pending OAuth registration and establish the authenticated
// session. Keeping this in one helper makes the direct instructor callback
// path and the legacy completion POST use identical duplicate checks,
// persistence, session rotation, and role hydration.
async function completeOAuthRegistration(req, res, pending, body) {
  const useSupabase = authDataSource.isSupabase();
  const email = normalizeEmail(pending && pending.email);
  const existing = useSupabase
    ? await userRepository.findUserByEmail(email)
    : await findUserByEmail(email);

  if (existing) {
    delete req.session.pendingOAuthRegistration;
    await saveSession(req);
    return { status: 'account_exists' };
  }

  const userId = useSupabase
    ? await userRepository.createOAuthUserWithProfile(pending, body || {})
    : await createOAuthUserWithProfile(pending, body || {});

  let user;
  if (useSupabase) {
    user = await userRepository.findUserById(userId);
  } else {
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    user = users[0];
  }
  if (!user) throw new Error('OAUTH_USER_NOT_FOUND');

  await establishAuthenticatedSession(req, res, async () => {
    await hydrateSessionUser(req, user);
    if (useSupabase) {
      await loadRoleProfileIntoSessionFromSupabase(req.session.user);
    } else {
      await loadRoleProfileIntoSession(req.session.user);
    }
  });
  return { status: 'created' };
}

/**
 * GET /auth — Combined Sign In / Register page
 */
exports.auth = (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.role === 'admin' ? '/admin' : '/dashboard');
  }
  const qErr = typeof req.query.error === 'string' ? req.query.error : '';
  const oauthMsg = OAUTH_QUERY_ERRORS[qErr] || null;
  res.render('auth', {
    title: 'CampuSphere | Get Started',
    description:
      'Get started with CampuSphere — Sign in or create your account to explore the CSPC virtual map tour.',
    backgroundImage: '/img/campus-hero.jpg',
    error: oauthMsg,
    success: null,
    oauthErrorKey: oauthMsg ? qErr : undefined
  });
};

/**
 * POST /register — Create a new user account
 */
exports.registerPost = async (req, res) => {
  const {
    fullName,
    email,
    password,
    role,
    studentId,
    yearLevel,
    course,
    employeeId,
    department,
    position
  } = req.body;

  // Type-safe presence guard (M2). A JSON body may carry non-string values
  // (e.g. email: { ... }), so NEVER call .trim() on a value not yet known to be
  // a string — that would throw and surface as a 500 instead of a clean 400-ish
  // rejection. Keep the legacy full-name presence check for the old form's
  // validation contract, but never use that submitted value as identity data;
  // the name written below is derived from the normalized email prefix.
  // email/password are intentionally allowed through when present-but-
  // non-string so they reach validateEmail/validatePassword (which reject
  // non-strings with a fixed message) rather than crashing.
  const hasFullName = typeof fullName === 'string' && fullName.trim() !== '';
  const hasEmail = email !== undefined && email !== null
    && !(typeof email === 'string' && email.trim() === '');
  const hasPassword = password !== undefined && password !== null
    && !(typeof password === 'string' && password === '');
  if (!hasFullName || !hasEmail || !hasPassword) {
    return res.render('auth', {
      title: 'CampuSphere | Get Started',
      description: 'Get started with CampuSphere.',
      backgroundImage: '/img/campus-hero.jpg',
      error: 'Please fill in your full name, email, and password.',
      success: null
    });
  }

  // M2: server-side email format + password policy BEFORE any DB lookup, hash,
  // or insert — matching the admin user CRUD (utils/adminValidation.js). The
  // normalized (trimmed, length-capped, format-checked) email and the validated
  // raw password are then used for every downstream branch (Supabase + MySQL):
  // duplicate check, username derivation, inserted email, and session email.
  const emailCheck = validateEmail(email);
  if (!emailCheck.ok) {
    return res.render('auth', {
      title: 'CampuSphere | Get Started',
      description: 'Get started with CampuSphere.',
      backgroundImage: '/img/campus-hero.jpg',
      error: emailCheck.message,
      success: null
    });
  }
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.ok) {
    return res.render('auth', {
      title: 'CampuSphere | Get Started',
      description: 'Get started with CampuSphere.',
      backgroundImage: '/img/campus-hero.jpg',
      error: passwordCheck.message,
      success: null
    });
  }
  const normalizedEmail = emailCheck.value;
  const validPassword = passwordCheck.value;
  const registrationIdentity = resolveAccountIdentityName({ email: normalizedEmail });

  try {
    // ===== Supabase branch (AUTH_DATA_SOURCE=supabase) =====
    if (authDataSource.isSupabase()) {
      const sbExisting = await userRepository.findUserByEmail(normalizedEmail);
      if (sbExisting) {
        return res.render('auth', {
          title: 'CampuSphere | Get Started',
          description: 'Get started with CampuSphere.',
          backgroundImage: '/img/campus-hero.jpg',
          error: 'An account with this email already exists.',
          success: null
        });
      }

      // Section 8.6 — Production Registration Trust Policy: local public
      // email/password registration may create GUEST accounts ONLY. Requested
      // student-cspc / instructor / admin / unknown / blank / missing roles are
      // REJECTED (never silently downgraded to guest). Trusted institutional
      // roles come only from verified Google OAuth domain mapping, seed data, or
      // admin-managed creation; admin self-registration is never possible.
      const sbNormalizedRole = String(role || '').trim();
      if (sbNormalizedRole !== 'guest') {
        console.warn('[auth] Blocked non-guest public registration role.');
        return res.render('auth', {
          title: 'CampuSphere | Get Started',
          description: 'Get started with CampuSphere.',
          backgroundImage: '/img/campus-hero.jpg',
          error: 'Public sign-up creates a guest account only. CSPC students and instructors must sign in with their CSPC Google account.',
          success: null
        });
      }
      const sbUserRole = 'guest';

      // Public legacy registration is guest-only. The submitted fullName is
      // deliberately ignored; derive the account identity from the email.
      const sbFirstName = registrationIdentity.firstName;
      const sbLastName = registrationIdentity.lastName;
      const sbHashedPassword = await bcrypt.hash(validPassword, SALT_ROUNDS);
      const sbUsername = normalizedEmail.split('@')[0];

      // Build role-specific profile payload. Patterns mirror the MySQL path:
      //   - student-cspc: profile only when studentId is provided.
      //   - instructor:   profile always (empty defaults match MySQL insert).
      //   - guest:        profile always (address/phone from body); SQL
      //                   function in 0003 silently skips inserting the guest
      //                   profile row when address/phone are blank, which
      //                   keeps the redirect/session behavior identical.
      let sbProfile = null;
      let sbGuestAddress = '';
      let sbGuestPhone = '';
      if (sbUserRole === 'student-cspc') {
        if (studentId) {
          sbProfile = {
            student_id_number: studentId,
            course: course || '',
            year_level: yearLevel || '1st Year',
            semester: '2nd Semester 2025-2026'
          };
        }
      } else if (sbUserRole === 'instructor') {
        sbProfile = {
          employee_id: employeeId || '',
          department: department || '',
          position: position || ''
        };
      } else if (sbUserRole === 'guest') {
        sbGuestAddress = String(req.body.address || '').trim();
        sbGuestPhone = String(req.body.phone || '').trim();
        sbProfile = {
          address: sbGuestAddress,
          phone_number: sbGuestPhone
        };
      }

      let sbUserId;
      try {
        sbUserId = await userRepository.createLocalUser({
          username: sbUsername,
          email: normalizedEmail,
          passwordHash: sbHashedPassword,
          role: sbUserRole,
          first_name: sbFirstName,
          last_name: sbLastName,
          profile: sbProfile
        });
      } catch (err) {
        // Defense in depth (Section 8.6): migration 0009 redefines
        // app_create_local_user to accept role 'guest' ONLY. The JS guard above
        // already filters non-guest roles; this maps any SQL-level reject back to
        // the same controller-facing message without a stack trace.
        if (err && err.code === 'INVALID_ROLE_FOR_PUBLIC_REGISTRATION') {
          console.warn('[auth] Supabase rejected non-guest public registration role.');
          return res.render('auth', {
            title: 'CampuSphere | Get Started',
            description: 'Get started with CampuSphere.',
            backgroundImage: '/img/campus-hero.jpg',
            error: 'Public sign-up creates a guest account only. CSPC students and instructors must sign in with their CSPC Google account.',
            success: null
          });
        }
        throw err;
      }

      // R3 (+ follow-up): regenerate, assign identity, and save atomically.
      await establishAuthenticatedSession(req, res, () => {
        req.session.user = {
          id: sbUserId,
          username: sbUsername,
          email: normalizedEmail,
          role: sbUserRole,
          first_name: sbFirstName,
          last_name: sbLastName
        };

        if (sbUserRole === 'guest') {
          req.session.user.address = sbGuestAddress;
          req.session.user.phone_number = sbGuestPhone;
        }
      });
      return res.redirect('/dashboard');
    }

    // ===== MySQL branch (default) =====
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length > 0) {
      return res.render('auth', {
        title: 'CampuSphere | Get Started',
        description: 'Get started with CampuSphere.',
        backgroundImage: '/img/campus-hero.jpg',
        error: 'An account with this email already exists.',
        success: null
      });
    }

    // Public legacy registration is guest-only. The submitted fullName is
    // deliberately ignored; derive the account identity from the email.
    const first_name = registrationIdentity.firstName;
    const last_name = registrationIdentity.lastName;

    const hashedPassword = await bcrypt.hash(validPassword, SALT_ROUNDS);

    // Section 8.6 — Production Registration Trust Policy: local public
    // registration is GUEST-ONLY (mirrors the Supabase branch above). Requested
    // student-cspc / instructor / admin / unknown / blank / missing roles are
    // rejected, never silently downgraded to guest.
    const normalizedRole = String(role || '').trim();
    if (normalizedRole !== 'guest') {
      console.warn('[auth] Blocked non-guest public registration role.');
      return res.render('auth', {
        title: 'CampuSphere | Get Started',
        description: 'Get started with CampuSphere.',
        backgroundImage: '/img/campus-hero.jpg',
        error: 'Public sign-up creates a guest account only. CSPC students and instructors must sign in with their CSPC Google account.',
        success: null
      });
    }
    const userRole = 'guest';

    const username = normalizedEmail.split('@')[0];

    let guestAddress = '';
    let guestPhone = '';
    if (userRole === 'guest') {
      guestAddress = String(req.body.address || '').trim();
      guestPhone = String(req.body.phone || '').trim();
    }

    // R6: create the users row and its role profile atomically in one
    // transaction. A failure inserting the role profile rolls the users row
    // back, so a half-registered (orphan) users row can never persist. Session
    // assignment happens only after the transaction commits (below).
    let userId;
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [result] = await conn.query(
        'INSERT INTO users (username, email, password, role, first_name, last_name) VALUES (?, ?, ?, ?, ?, ?)',
        [username, normalizedEmail, hashedPassword, userRole, first_name, last_name]
      );
      userId = result.insertId;

      if (userRole === 'student-cspc' && studentId) {
        await conn.query(
          `INSERT INTO student_profiles (user_id, student_id_number, course, year_level, enrollment_status, semester)
           VALUES (?, ?, ?, ?, 'Enrolled', '2nd Semester 2025-2026')`,
          [userId, studentId, course || '', yearLevel || '1st Year']
        );
      }

      if (userRole === 'instructor') {
        await conn.query(
          `INSERT INTO instructor_profiles (user_id, employee_id, department, position, status)
           VALUES (?, ?, ?, ?, 'Active')`,
          [userId, employeeId || '', department || '', position || '']
        );
      }

      if (userRole === 'guest') {
        await conn.query(
          `INSERT INTO guest_profiles (user_id, address, phone_number)
           VALUES (?, ?, ?)`,
          [userId, guestAddress, guestPhone]
        );
      }

      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }

    // R3 (+ follow-up): regenerate, assign identity, and save atomically.
    await establishAuthenticatedSession(req, res, () => {
      req.session.user = {
        id: userId,
        username,
        email: normalizedEmail,
        role: userRole,
        first_name,
        last_name
      };

      if (userRole === 'guest') {
        req.session.user.address = guestAddress;
        req.session.user.phone_number = guestPhone;
      }
    });
    return res.redirect('/dashboard');
  } catch (error) {
    console.error('Registration error: unexpected failure.');
    return res.render('auth', {
      title: 'CampuSphere | Get Started',
      description: 'Get started with CampuSphere.',
      backgroundImage: '/img/campus-hero.jpg',
      error: 'Something went wrong. Please try again.',
      success: null
    });
  }
};

/**
 * POST /login — Authenticate a user
 */
exports.loginPost = async (req, res) => {
  const { email, password } = req.body;

  // Type-safe presence guard. A JSON body may carry non-string values (e.g.
  // email: { ... }); NEVER call .trim() (or later bcrypt.compare) on a value not
  // known to be a string, which would throw and surface as a 500. Login stays
  // generic — this is not registration, so no email/password policy is applied
  // and no account-existence signal is revealed.
  const hasEmail = typeof email === 'string' && email.trim() !== '';
  const hasPassword = typeof password === 'string' && password !== '';
  if (!hasEmail || !hasPassword) {
    auditService.record({
      event_type: 'authentication',
      action: 'login.local',
      outcome: 'failure',
      // Never record a non-string raw body value.
      attempted_email: typeof email === 'string' ? email : undefined,
      message: 'Local login failed: missing credentials.'
    }).catch(() => {});
    return res.render('auth', {
      title: 'CampuSphere | Get Started',
      description: 'Get started with CampuSphere.',
      backgroundImage: '/img/campus-hero.jpg',
      error: 'Please enter your email and password.',
      success: null
    });
  }

  try {
    // ===== Supabase branch (AUTH_DATA_SOURCE=supabase) =====
    if (authDataSource.isSupabase()) {
      const sbUser = await userRepository.findUserByEmail(email);
      // L4: ALWAYS run bcrypt.compare — against the user's hash, or a fixed dummy
      // hash when the email is unknown / the row has no password — so the
      // unknown-email and wrong-password paths take the same time. Reject if the
      // user is missing, has no password, or the compare fails (uniform message).
      const sbMatch = await bcrypt.compare(password, (sbUser && sbUser.password) || DUMMY_LOGIN_HASH);
      if (!sbUser || !sbUser.password || !sbMatch) {
        auditService.record({
          event_type: 'authentication',
          action: 'login.local',
          outcome: 'failure',
          attempted_email: email,
          message: 'Local login failed: invalid credentials.'
        }).catch(() => {});
        return res.render('auth', {
          title: 'CampuSphere | Get Started',
          description: 'Get started with CampuSphere.',
          backgroundImage: '/img/campus-hero.jpg',
          error: 'Invalid email or password.',
          success: null
        });
      }

      // R3 (+ follow-up): regenerate, assign identity + role profile, save atomically.
      await establishAuthenticatedSession(req, res, async () => {
        req.session.user = {
          id: sbUser.id,
          username: sbUser.username,
          email: sbUser.email,
          role: sbUser.role,
          first_name: sbUser.first_name,
          last_name: sbUser.last_name
        };

        // Mirror the MySQL path's role-profile field merge exactly.
        const sbProfile = await userRepository.loadRoleProfile(sbUser.id, sbUser.role);
        if (sbProfile) {
          if (sbUser.role === 'student-cspc') {
            Object.assign(req.session.user, {
              student_id_number: sbProfile.student_id_number,
              course: sbProfile.course,
              year_level: sbProfile.year_level,
              enrollment_status: sbProfile.enrollment_status,
              semester: sbProfile.semester
            });
          } else if (sbUser.role === 'instructor') {
            Object.assign(req.session.user, {
              employee_id: sbProfile.employee_id,
              department: sbProfile.department,
              position: sbProfile.position
            });
          } else if (sbUser.role === 'guest') {
            Object.assign(req.session.user, {
              address: sbProfile.address,
              phone_number: sbProfile.phone_number
            });
          }
        }
      });

      auditService.record({
        event_type: 'authentication',
        action: 'login.local',
        outcome: 'success',
        actor_user_id: sbUser.id,
        actor_role: sbUser.role,
        message: 'Local login succeeded.'
      }).catch(() => {});

      return res.redirect(sbUser.role === 'admin' ? '/admin' : '/dashboard');
    }

    // ===== MySQL branch (default) =====
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = users[0];

    // L4: ALWAYS run bcrypt.compare — against the user's hash, or a fixed dummy
    // hash when the email is unknown / the row has no password — so the
    // unknown-email and wrong-password paths take the same time. Reject if the
    // user is missing, has no password, or the compare fails (uniform message).
    const match = await bcrypt.compare(password, (user && user.password) || DUMMY_LOGIN_HASH);
    if (!user || !user.password || !match) {
      auditService.record({
        event_type: 'authentication',
        action: 'login.local',
        outcome: 'failure',
        attempted_email: email,
        message: 'Local login failed: invalid credentials.'
      }).catch(() => {});
      return res.render('auth', {
        title: 'CampuSphere | Get Started',
        description: 'Get started with CampuSphere.',
        backgroundImage: '/img/campus-hero.jpg',
        error: 'Invalid email or password.',
        success: null
      });
    }

    // R3 (+ follow-up): regenerate, assign identity + role profile, save atomically.
    await establishAuthenticatedSession(req, res, async () => {
      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name
      };

      if (user.role === 'student-cspc') {
        const [profiles] = await db.query('SELECT * FROM student_profiles WHERE user_id = ?', [user.id]);
        if (profiles.length > 0) {
          const sp = profiles[0];
          Object.assign(req.session.user, {
            student_id_number: sp.student_id_number,
            course: sp.course,
            year_level: sp.year_level,
            enrollment_status: sp.enrollment_status,
            semester: sp.semester
          });
        }
      }

      if (user.role === 'instructor') {
        const [profiles] = await db.query('SELECT * FROM instructor_profiles WHERE user_id = ?', [user.id]);
        if (profiles.length > 0) {
          const ip = profiles[0];
          Object.assign(req.session.user, {
            employee_id: ip.employee_id,
            department: ip.department,
            position: ip.position
          });
        }
      }

      if (user.role === 'guest') {
        const [profiles] = await db.query('SELECT * FROM guest_profiles WHERE user_id = ?', [user.id]);
        if (profiles.length > 0) {
          const gp = profiles[0];
          Object.assign(req.session.user, {
            address: gp.address,
            phone_number: gp.phone_number
          });
        }
      }
    });

    auditService.record({
      event_type: 'authentication',
      action: 'login.local',
      outcome: 'success',
      actor_user_id: user.id,
      actor_role: user.role,
      message: 'Local login succeeded.'
    }).catch(() => {});

    return res.redirect(user.role === 'admin' ? '/admin' : '/dashboard');
  } catch (error) {
    console.error('Login error: unexpected failure.');
    auditService.record({
      event_type: 'authentication',
      action: 'login.local',
      outcome: 'failure',
      attempted_email: email,
      message: 'Local login failed: unexpected error.'
    }).catch(() => {});
    return res.render('auth', {
      title: 'CampuSphere | Get Started',
      description: 'Get started with CampuSphere.',
      backgroundImage: '/img/campus-hero.jpg',
      error: 'Something went wrong. Please try again.',
      success: null
    });
  }
};

/**
 * GET /auth/csrf-token — return the CURRENT session's CSRF token (M12.P1-D1).
 * Mounted behind an unconditional no-store pre-middleware and requireLogin
 * (routes/auth.js). Always JSON. The token was minted for this authenticated
 * session by attachCsrfToken; it is not rotated here and is never logged or
 * stored anywhere else. If an authenticated session somehow has no nonempty
 * token, fail closed with a fixed sanitized 500 instead of issuing one ad hoc.
 */
exports.csrfToken = (req, res) => {
  const token = req.session && req.session.csrfToken;
  if (typeof token !== 'string' || token.length === 0) {
    return res.status(500).json({ success: false, message: 'Unable to issue a request token. Please try again.' });
  }
  return res.status(200).json({ success: true, csrfToken: token });
};

/**
 * POST /logout — CSRF-verified session termination (M12.P1-D1: truthful).
 * The session cookie is cleared and success is reported ONLY after the
 * session store confirms destruction. If destroy reports an error the
 * session (and its cookie) remain live and the caller receives a fixed
 * sanitized 500 — never a redirect that pretends the session ended.
 */
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      // Fixed sanitized log — no session id, cookie value, or raw store error.
      console.error('Logout error: session destroy failed.');
      if (wantsJson(req)) {
        return res.status(500).json({ success: false, message: 'Unable to sign out. Please try again.' });
      }
      return res.status(500).render('error', {
        title: '500 — Sign-out Failed',
        statusCode: 500,
        message: 'Unable to sign out. Please try again.',
      });
    }
    // Destruction confirmed: emit the expiring Set-Cookie for the configured
    // session cookie (name/attributes match the issued cookie).
    clearSessionCookieQuietly(res);
    // JSON callers (the shared async logout client) get the sanitized success
    // contract; the client navigates only to its own allowlisted target.
    if (wantsJson(req)) {
      return res.status(200).json({ success: true, redirect: '/auth?logged_out=1' });
    }
    // Form/HTML callers keep the 302 with the marker so the shell-precached
    // PWA script (public/js/pwa.js) performs best-effort cleanup of
    // CampuSphere dynamic caches + offline catalog on the /auth load.
    return res.redirect('/auth?logged_out=1');
  });
};

/**
 * GET /logout — Non-mutating guard (Milestone 8, Section 8.2).
 * Logout is POST-only; a GET must never destroy the session. Returns a fixed
 * 405 Method Not Allowed (Allow: POST) for both browser and JSON callers.
 */
exports.logoutGet = (req, res) => {
  res.set('Allow', 'POST');
  if (wantsJson(req)) {
    return res.status(405).json({ success: false, message: 'Method Not Allowed. Use POST to log out.' });
  }
  return res.status(405).render('error', {
    title: '405 — Method Not Allowed',
    statusCode: 405,
    message: 'Please use the Logout button to sign out.',
  });
};

/**
 * GET /auth/google — Start Google OAuth
 */
exports.googleStart = (req, res) => {
  const config = getGoogleConfig();
  if (!config.clientId || !config.clientSecret) {
    return res.redirect('/auth?error=oauth_failed');
  }
  const intent = req.query.intent === 'register' ? 'register' : 'login';
  const state = crypto.randomBytes(32).toString('hex');
  req.session.oauthState = state;
  req.session.oauthIntent = intent;

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
};

/**
 * GET /auth/callback — Google OAuth callback
 */
exports.googleCallback = async (req, res) => {
  const { code, state } = req.query;
  // Resolve login-vs-register intent before the state check clears it, so the
  // Google failures below can be gated to login attempts only (registration
  // flows are deliberately not audited).
  const auditIntent = (req.session && req.session.oauthIntent === 'register') ? 'register' : 'login';
  if (!code || !state || state !== req.session.oauthState) {
    if (auditIntent === 'login') {
      auditService.record({
        event_type: 'authentication',
        action: 'login.google',
        outcome: 'failure',
        message: 'Google sign-in failed: invalid callback.'
      }).catch(() => {});
    }
    clearOAuthState(req);
    return res.redirect('/auth?error=oauth_failed');
  }

  const intent = req.session.oauthIntent === 'register' ? 'register' : 'login';
  clearOAuthState(req);

  const config = getGoogleConfig();
  if (!config.clientId || !config.clientSecret) {
    if (intent === 'login') {
      auditService.record({
        event_type: 'authentication',
        action: 'login.google',
        outcome: 'failure',
        message: 'Google sign-in failed: provider not configured.'
      }).catch(() => {});
    }
    return res.redirect('/auth?error=oauth_failed');
  }

  try {
    const tokenJson = await exchangeGoogleCode(code, config);
    if (!tokenJson || !tokenJson.access_token) {
      if (intent === 'login') {
        auditService.record({
          event_type: 'authentication',
          action: 'login.google',
          outcome: 'failure',
          message: 'Google sign-in failed: provider response invalid.'
        }).catch(() => {});
      }
      return res.redirect('/auth?error=oauth_failed');
    }

    const profile = await fetchGoogleUserinfo(tokenJson.access_token);
    if (!profile || !profile.email) {
      if (intent === 'login') {
        auditService.record({
          event_type: 'authentication',
          action: 'login.google',
          outcome: 'failure',
          message: 'Google sign-in failed: provider response invalid.'
        }).catch(() => {});
      }
      return res.redirect('/auth?error=oauth_failed');
    }

    const verified = profile.email_verified === true || profile.email_verified === 'true';
    if (!verified) {
      if (intent === 'login') {
        auditService.record({
          event_type: 'authentication',
          action: 'login.google',
          outcome: 'failure',
          attempted_email: profile.email,
          message: 'Google sign-in failed: email not verified.'
        }).catch(() => {});
      }
      return res.redirect('/auth?error=oauth_failed');
    }

    const email = normalizeEmail(profile.email);
    const domainRole = getRoleFromEmail(email);
    if (!domainRole) {
      if (intent === 'login') {
        auditService.record({
          event_type: 'authentication',
          action: 'login.google',
          outcome: 'failure',
          attempted_email: email,
          message: 'Google sign-in failed: email domain not allowed.'
        }).catch(() => {});
      }
      return res.redirect('/auth?error=unauthorized_domain');
    }

    // Backend selection: in supabase mode, OAuth lookup / duplicate check
    // route through the userRepository. Session hydration uses the Supabase
    // helper so the merged role fields come from the Supabase profile rows.
    // MySQL mode keeps the existing module-local findUserByEmail and
    // loadRoleProfileIntoSession helpers unchanged.
    const useSupabase = authDataSource.isSupabase();

    if (intent === 'login') {
      const user = useSupabase
        ? await userRepository.findUserByEmail(email)
        : await findUserByEmail(email);
      if (!user) {
        auditService.record({
          event_type: 'authentication',
          action: 'login.google',
          outcome: 'failure',
          attempted_email: email,
          message: 'Google sign-in failed: no matching account.'
        }).catch(() => {});
        return res.redirect('/auth?error=account_not_found');
      }
      // Identity-managed roles resync their verified Google name on each
      // successful login. Both identity and optional picture refreshes are
      // best-effort and never block authentication.
      await syncGoogleIdentityName(user, profile, useSupabase);
      await syncGoogleProfileImage(user, profile.picture, useSupabase);
      // R3 (+ follow-up): regenerate, hydrate identity + role profile, save atomically.
      await establishAuthenticatedSession(req, res, async () => {
        await hydrateSessionUser(req, user);
        if (useSupabase) {
          await loadRoleProfileIntoSessionFromSupabase(req.session.user);
        } else {
          await loadRoleProfileIntoSession(req.session.user);
        }
      });
      auditService.record({
        event_type: 'authentication',
        action: 'login.google',
        outcome: 'success',
        actor_user_id: user.id,
        actor_role: user.role,
        message: 'Google sign-in succeeded.'
      }).catch(() => {});
      return res.redirect(user.role === 'admin' ? '/admin' : '/dashboard');
    }

    const existing = useSupabase
      ? await userRepository.findUserByEmail(email)
      : await findUserByEmail(email);
    if (existing) {
      return res.redirect('/auth?error=account_exists');
    }

    const identity = resolveAccountIdentityName({
      givenName: profile.given_name,
      familyName: profile.family_name,
      fullName: profile.name,
      email
    });
    const pending = {
      email,
      role: domainRole,
      googleSub: profile.sub || '',
      givenName: identity.firstName,
      familyName: identity.lastName,
      fullName: identity.fullName,
      picture: normalizeGoogleProfileImageUrl(profile.picture) || ''
    };

    // Verified CSPC instructors no longer complete a role-specific form.
    // Create the account from the Google identity immediately, then use the
    // same fixation-safe session establishment as the existing completion
    // endpoint. Students and guests retain their current completion flow.
    if (domainRole === 'instructor') {
      const result = await completeOAuthRegistration(req, res, pending, {});
      if (result.status === 'account_exists') {
        return res.redirect('/auth?error=account_exists');
      }
      return res.redirect('/dashboard');
    }

    req.session.pendingOAuthRegistration = pending;
    await saveSession(req);
    return res.redirect('/auth/complete-registration');
  } catch (err) {
    console.error('Google OAuth callback error: unexpected failure.');
    if (intent === 'login') {
      auditService.record({
        event_type: 'authentication',
        action: 'login.google',
        outcome: 'failure',
        message: 'Google sign-in failed: unexpected error.'
      }).catch(() => {});
    }
    return res.redirect('/auth?error=oauth_failed');
  }
};

const ROLE_LABELS = {
  'student-cspc': 'Student (CSPC)',
  instructor: 'Instructor',
  guest: 'Guest'
};

/**
 * GET /auth/complete-registration — Finish OAuth registration
 */
exports.completeRegistration = (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.role === 'admin' ? '/admin' : '/dashboard');
  }
  const pending = req.session.pendingOAuthRegistration;
  if (!pending || !pending.email || !pending.role) {
    return res.redirect('/auth?error=registration_expired');
  }

  res.render('complete-registration', {
    title: 'CampuSphere | Complete registration',
    description: 'Complete your CampuSphere account.',
    backgroundImage: '/img/campus-hero.jpg',
    pending,
    roleLabel: ROLE_LABELS[pending.role] || pending.role,
    error: null
  });
};

/**
 * POST /auth/complete-registration
 */
exports.completeRegistrationPost = async (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  const pending = req.session.pendingOAuthRegistration;
  if (!pending || !pending.email || !pending.role) {
    return res.redirect('/auth?error=registration_expired');
  }

  try {
    // Instructors are normally completed in the Google callback. This branch
    // remains for already-open legacy completion pages. Only role-specific
    // completion fields are forwarded; fullName is intentionally discarded
    // because the pending verified Google identity is authoritative.
    const submitted = req.body && typeof req.body === 'object' ? req.body : {};
    const body = {};
    const allowedFields = pending.role === 'student-cspc'
      ? ['studentId', 'course', 'yearLevel', 'semester']
      : pending.role === 'guest' ? ['address', 'phone'] : [];
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(submitted, field)) body[field] = submitted[field];
    }
    const result = await completeOAuthRegistration(req, res, pending, body);
    if (result.status === 'account_exists') {
      return res.redirect('/auth?error=account_exists');
    }
    return res.redirect('/dashboard');
  } catch (err) {
    const code = err && err.message;
    // Expected validation rejections are user errors, not server faults:
    // log only the safe code, never the full error object (avoids leaking
    // OAuth subjects, profile values, or stack details into server logs).
    const KNOWN_VALIDATION_CODES = new Set([
      'MISSING_STUDENT',
      'MISSING_GUEST',
      'MISSING_OAUTH_SUBJECT',
      'INVALID_ROLE',
      'INVALID_ROLE_FOR_PUBLIC_REGISTRATION'
    ]);
    if (KNOWN_VALIDATION_CODES.has(code)) {
      console.warn('completeRegistrationPost: validation rejected (' + code + ')');
    } else {
      console.error('completeRegistrationPost: unexpected failure.');
    }
    let msg = 'Something went wrong. Please try again.';
    if (code === 'MISSING_STUDENT') msg = 'Student ID is required.';
    if (code === 'MISSING_GUEST') msg = 'Address and phone number are required.';

    return res.render('complete-registration', {
      title: 'CampuSphere | Complete registration',
      description: 'Complete your CampuSphere account.',
      backgroundImage: '/img/campus-hero.jpg',
      pending,
      roleLabel: ROLE_LABELS[pending.role] || pending.role,
      error: msg
    });
  }
};
