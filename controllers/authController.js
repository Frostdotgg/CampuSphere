/* ========================================
   CampuSphere — Auth Controller
   Handles Auth, Login, Register, Google OAuth
   ======================================== */

const crypto = require('crypto');
const db = require('../config/db');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

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
  const given = (profile && profile.given_name) || '';
  const family = (profile && profile.family_name) || '';
  if (given || family) {
    return { first: given.trim(), last: family.trim() };
  }
  const name = (profile && profile.name) || '';
  const parts = String(name).trim().split(/\s+/);
  return {
    first: parts[0] || '',
    last: parts.slice(1).join(' ') || ''
  };
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

async function hydrateSessionUser(req, userRow) {
  req.session.user = {
    id: userRow.id,
    username: userRow.username,
    email: userRow.email,
    role: userRow.role,
    first_name: userRow.first_name,
    last_name: userRow.last_name
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

async function createOAuthUserWithProfile(pending, body) {
  let fullName = String(body.fullName || '').trim();
  if (!fullName) {
    const g = splitGoogleName({
      given_name: pending.givenName,
      family_name: pending.familyName,
      name: pending.fullName
    });
    fullName = [g.first, g.last].filter(Boolean).join(' ').trim();
  }
  if (!fullName) {
    throw new Error('MISSING_NAME');
  }

  const nameParts = fullName.split(/\s+/);
  const first_name = nameParts[0] || '';
  const last_name = nameParts.slice(1).join(' ') || '';

  const email = pending.email;
  const rawUser = email.split('@')[0] || 'user';
  const username = rawUser.slice(0, 50);
  const placeholder = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), SALT_ROUNDS);
  const role = pending.role;

  const picture = pending.picture || null;
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
      const studentId = String(body.studentId || '').trim();
      if (!studentId) throw new Error('MISSING_STUDENT');
      await conn.query(
        `INSERT INTO student_profiles (user_id, student_id_number, course, year_level, enrollment_status, semester)
         VALUES (?, ?, ?, ?, 'Enrolled', ?)`,
        [
          userId,
          studentId,
          String(body.course || '').trim() || '',
          String(body.yearLevel || '').trim() || '1st Year',
          String(body.semester || '1st Semester 2026-2027').trim() || '1st Semester 2026-2027'
        ]
      );
    } else if (role === 'instructor') {
      const employeeId = String(body.employeeId || '').trim();
      if (!employeeId) throw new Error('MISSING_INSTRUCTOR');
      await conn.query(
        `INSERT INTO instructor_profiles (user_id, employee_id, department, position, status)
         VALUES (?, ?, ?, ?, 'Active')`,
        [
          userId,
          employeeId,
          String(body.department || '').trim() || '',
          String(body.position || '').trim() || ''
        ]
      );
    } else if (role === 'guest') {
      const address = String(body.address || '').trim();
      const phone = String(body.phone || '').trim();
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
    title: 'CampusSphere | Get Started',
    description:
      'Get started with CampusSphere — Sign in or create your account to explore the CSPC virtual map tour.',
    backgroundImage: '/img/campus-hero.jpg',
    error: oauthMsg,
    success: null,
    oauthErrorKey: oauthMsg ? qErr : undefined
  });
};

/**
 * GET /login — Standalone Login page
 */
exports.login = (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.role === 'admin' ? '/admin' : '/dashboard');
  }
  res.render('login', {
    title: 'CampusSphere | Sign In',
    description: 'Sign in to CampusSphere.',
    backgroundImage: '/img/campus-hero.jpg',
    error: null
  });
};

/**
 * GET /register — Standalone Register page
 */
exports.register = (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('register', {
    title: 'CampusSphere | Register',
    description: 'Register to CampusSphere - Choose your role to access the virtual map tour.',
    backgroundImage: '/img/campus-hero.jpg',
    error: null
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

  if (!fullName || !fullName.trim() || !email || !email.trim() || !password) {
    return res.render('auth', {
      title: 'CampusSphere | Get Started',
      description: 'Get started with CampusSphere.',
      backgroundImage: '/img/campus-hero.jpg',
      error: 'Please fill in your full name, email, and password.',
      success: null
    });
  }

  try {
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.render('auth', {
        title: 'CampusSphere | Get Started',
        description: 'Get started with CampusSphere.',
        backgroundImage: '/img/campus-hero.jpg',
        error: 'An account with this email already exists.',
        success: null
      });
    }

    const nameParts = (fullName || '').trim().split(/\s+/);
    const first_name = nameParts[0] || '';
    const last_name = nameParts.slice(1).join(' ') || '';

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const PUBLIC_ROLES = ['student-cspc', 'instructor', 'guest'];
    const normalizedRole = String(role || '').trim();
    if (!PUBLIC_ROLES.includes(normalizedRole)) {
      console.warn(`[auth] Blocked public registration with role="${normalizedRole}" for email="${email}"`);
      return res.render('auth', {
        title: 'CampusSphere | Get Started',
        description: 'Get started with CampusSphere.',
        backgroundImage: '/img/campus-hero.jpg',
        error: 'Invalid role selected. Please choose Student, Instructor, or Guest.',
        success: null
      });
    }
    const userRole = normalizedRole;

    const username = email.split('@')[0];

    const [result] = await db.query(
      'INSERT INTO users (username, email, password, role, first_name, last_name) VALUES (?, ?, ?, ?, ?, ?)',
      [username, email, hashedPassword, userRole, first_name, last_name]
    );

    const userId = result.insertId;

    if (userRole === 'student-cspc' && studentId) {
      await db.query(
        `INSERT INTO student_profiles (user_id, student_id_number, course, year_level, enrollment_status, semester)
         VALUES (?, ?, ?, ?, 'Enrolled', '2nd Semester 2025-2026')`,
        [userId, studentId, course || '', yearLevel || '1st Year']
      );
    }

    if (userRole === 'instructor') {
      await db.query(
        `INSERT INTO instructor_profiles (user_id, employee_id, department, position, status)
         VALUES (?, ?, ?, ?, 'Active')`,
        [userId, employeeId || '', department || '', position || '']
      );
    }

    req.session.user = {
      id: userId,
      username,
      email,
      role: userRole,
      first_name,
      last_name
    };

    return res.redirect('/dashboard');
  } catch (error) {
    console.error('Registration error:', error);
    return res.render('auth', {
      title: 'CampusSphere | Get Started',
      description: 'Get started with CampusSphere.',
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

  if (!email || !email.trim() || !password) {
    return res.render('auth', {
      title: 'CampusSphere | Get Started',
      description: 'Get started with CampusSphere.',
      backgroundImage: '/img/campus-hero.jpg',
      error: 'Please enter your email and password.',
      success: null
    });
  }

  try {
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.render('auth', {
        title: 'CampusSphere | Get Started',
        description: 'Get started with CampusSphere.',
        backgroundImage: '/img/campus-hero.jpg',
        error: 'Invalid email or password.',
        success: null
      });
    }

    const user = users[0];

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.render('auth', {
        title: 'CampusSphere | Get Started',
        description: 'Get started with CampusSphere.',
        backgroundImage: '/img/campus-hero.jpg',
        error: 'Invalid email or password.',
        success: null
      });
    }

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

    return res.redirect(user.role === 'admin' ? '/admin' : '/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    return res.render('auth', {
      title: 'CampusSphere | Get Started',
      description: 'Get started with CampusSphere.',
      backgroundImage: '/img/campus-hero.jpg',
      error: 'Something went wrong. Please try again.',
      success: null
    });
  }
};

/**
 * GET /logout — Destroy session and redirect
 */
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Logout error:', err);
    res.redirect('/auth');
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
  if (!code || !state || state !== req.session.oauthState) {
    clearOAuthState(req);
    return res.redirect('/auth?error=oauth_failed');
  }

  const intent = req.session.oauthIntent === 'register' ? 'register' : 'login';
  clearOAuthState(req);

  const config = getGoogleConfig();
  if (!config.clientId || !config.clientSecret) {
    return res.redirect('/auth?error=oauth_failed');
  }

  try {
    const tokenJson = await exchangeGoogleCode(code, config);
    if (!tokenJson || !tokenJson.access_token) {
      return res.redirect('/auth?error=oauth_failed');
    }

    const profile = await fetchGoogleUserinfo(tokenJson.access_token);
    if (!profile || !profile.email) {
      return res.redirect('/auth?error=oauth_failed');
    }

    const verified = profile.email_verified === true || profile.email_verified === 'true';
    if (!verified) {
      return res.redirect('/auth?error=oauth_failed');
    }

    const email = normalizeEmail(profile.email);
    const domainRole = getRoleFromEmail(email);
    if (!domainRole) {
      return res.redirect('/auth?error=unauthorized_domain');
    }

    if (intent === 'login') {
      const user = await findUserByEmail(email);
      if (!user) {
        return res.redirect('/auth?error=account_not_found');
      }
      await hydrateSessionUser(req, user);
      await loadRoleProfileIntoSession(req.session.user);
      await saveSession(req);
      return res.redirect(user.role === 'admin' ? '/admin' : '/dashboard');
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.redirect('/auth?error=account_exists');
    }

    const { first, last } = splitGoogleName(profile);
    req.session.pendingOAuthRegistration = {
      email,
      role: domainRole,
      googleSub: profile.sub || '',
      givenName: first,
      familyName: last,
      fullName: profile.name || '',
      picture: profile.picture || ''
    };
    await saveSession(req);
    return res.redirect('/auth/complete-registration');
  } catch (err) {
    console.error('Google OAuth callback error:', err);
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
    title: 'CampusSphere | Complete registration',
    description: 'Complete your CampusSphere account.',
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
    const stillThere = await findUserByEmail(pending.email);
    if (stillThere) {
      delete req.session.pendingOAuthRegistration;
      await saveSession(req);
      return res.redirect('/auth?error=account_exists');
    }

    const userId = await createOAuthUserWithProfile(pending, req.body);
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    const user = users[0];
    if (!user) {
      return res.redirect('/auth?error=oauth_failed');
    }

    await hydrateSessionUser(req, user);
    await loadRoleProfileIntoSession(req.session.user);
    delete req.session.pendingOAuthRegistration;
    await saveSession(req);
    return res.redirect('/dashboard');
  } catch (err) {
    console.error('completeRegistrationPost:', err);
    const code = err && err.message;
    let msg = 'Something went wrong. Please try again.';
    if (code === 'MISSING_NAME') msg = 'Please enter your full name.';
    if (code === 'MISSING_STUDENT') msg = 'Student ID is required.';
    if (code === 'MISSING_INSTRUCTOR') msg = 'Employee ID is required.';
    if (code === 'MISSING_GUEST') msg = 'Address and phone number are required.';

    return res.render('complete-registration', {
      title: 'CampusSphere | Complete registration',
      description: 'Complete your CampusSphere account.',
      backgroundImage: '/img/campus-hero.jpg',
      pending,
      roleLabel: ROLE_LABELS[pending.role] || pending.role,
      error: msg
    });
  }
};
