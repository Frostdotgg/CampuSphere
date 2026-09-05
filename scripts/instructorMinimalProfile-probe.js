'use strict';

/*
 * CampuSphere - minimal instructor identity/profile contract probe
 *
 * Database-free and network-free. This probe checks the coupled Google OAuth,
 * profile, dashboard, browser-session projection, and Supabase migration
 * surfaces for the minimal instructor identity contract:
 * verified Google name, email, and optional profile picture only. Existing
 * employee/department/position columns remain compatibility storage and are
 * never rendered, edited, or serialized into the browser projection.
 *
 * Run: node scripts/instructorMinimalProfile-probe.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const failures = [];
let checks = 0;

function check(scope, label, condition) {
  checks += 1;
  const passed = Boolean(condition);
  console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!passed) failures.push(`${scope} :: ${label}`);
}

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) return '';
  const end = endMarker ? source.indexOf(endMarker, start + startMarker.length) : -1;
  return source.slice(start, end < 0 ? source.length : end);
}

const auth = read('controllers/authController.js');
const repository = read('repositories/userRepository.js');
const profileController = read('controllers/profileController.js');
const dashboardController = read('controllers/dashboardController.js');
const dashboardView = read('views/dashboard.ejs');
const completionView = read('views/complete-registration.ejs');
const profileScript = read('public/js/profile-script.js');
const publicData = read('public/js/data.js');
const navbar = read('views/partials/dash-navbar.ejs');
const privacy = read('views/privacy.ejs');
const serviceWorker = read('public/sw.js');
const migrationPath = path.join(ROOT, 'database', 'supabase', '0021_minimal_instructor_oauth_registration.sql');
const migration = fs.existsSync(migrationPath) ? fs.readFileSync(migrationPath, 'utf8') : '';

console.log('\n[instructor identity] OAuth creation contract');

const callback = section(auth, 'const email = normalizeEmail(profile.email);', '  } catch (err) {');
const localOAuth = section(auth, 'async function createOAuthUserWithProfile(pending, body)', '// Complete a pending OAuth registration');
const registrationPost = section(auth, 'exports.completeRegistrationPost = async', '\n\n\n');
check('auth', 'instructor callback creates directly from verified Google claims',
  /if \(domainRole === 'instructor'\) \{[\s\S]*?completeOAuthRegistration\(req, res, pending, \{\}\);[\s\S]*?return res\.redirect\('\/dashboard'\);/.test(callback));
check('auth', 'Google picture is normalized before pending registration state',
  callback.includes("picture: normalizeGoogleProfileImageUrl(profile.picture) || ''"));
check('auth', 'pending registration name comes from the shared identity resolver',
  callback.includes('givenName: identity.firstName') &&
  callback.includes('familyName: identity.lastName') &&
  callback.includes('fullName: identity.fullName'));
check('auth', 'student/guest completion remains the fallback branch',
  callback.includes('req.session.pendingOAuthRegistration = pending;') &&
  callback.includes("return res.redirect('/auth/complete-registration');"));
check('auth', 'legacy instructor completion POST ignores retired form fields',
  registrationPost.includes('const allowedFields = pending.role ===') &&
  registrationPost.includes('fullName is intentionally discarded') &&
  registrationPost.includes('completeOAuthRegistration(req, res, pending, body)'));
check('auth', 'local instructor OAuth profile is created with blank compatibility fields',
  /else if \(role === 'instructor'\) \{[\s\S]*?INSERT INTO instructor_profiles[\s\S]*?\[userId, '', '', ''\][\s\S]*?\}/.test(localOAuth) &&
  !/else if \(role === 'instructor'\) \{[\s\S]*?body\.(?:employeeId|department|position)/.test(localOAuth));
check('auth', 'new OAuth picture is stored only after URL normalization',
  localOAuth.includes('const picture = normalizeGoogleProfileImageUrl(pending.picture) || null;'));
check('auth', 'shared completion rotates and saves the authenticated session',
  auth.includes('async function completeOAuthRegistration') &&
  section(auth, 'async function completeOAuthRegistration', 'const ROLE_LABELS').includes('establishAuthenticatedSession(req, res'));

// Negative fixtures ensure the positive checks cannot pass if the old
// instructor form or request-fed metadata is accidentally reintroduced.
check('auth', 'fixture: restoring the instructor completion form is rejected',
  !/if \(domainRole === 'instructor'\) \{[\s\S]*?completeOAuthRegistration\(req, res, pending, req\.body\)/.test(callback));
check('auth', 'fixture: forwarding instructor metadata to the local insert is rejected',
  !/else if \(role === 'instructor'\) \{[\s\S]*?body\.(?:employeeId|department|position)/.test(localOAuth));

console.log('\n[instructor identity] Supabase repository and migration');

const repoOAuth = section(repository, 'async function createOAuthUserWithProfile(pending, body)', 'async function updateUserName');
check('repository', 'instructor OAuth parameters are explicitly nulled',
  repoOAuth.includes("p_employee_id: role === 'instructor' ? null : trimOrNull(b.employeeId)") &&
  repoOAuth.includes("p_department: role === 'instructor' ? null : trimOrNull(b.department)") &&
  repoOAuth.includes("p_position: role === 'instructor' ? null : trimOrNull(b.position)"));
check('repository', 'instructor OAuth has no employee-id requirement',
  !/role === 'instructor'[\s\S]{0,300}MISSING_INSTRUCTOR/.test(repoOAuth));
check('repository', 'student and guest validation remains intact',
  repoOAuth.includes("new Error('MISSING_STUDENT')") &&
  repoOAuth.includes("new Error('MISSING_GUEST')"));
check('migration', '0021 exists and preserves the deployed RPC signature',
  migration.includes('CREATE OR REPLACE FUNCTION public.app_create_oauth_user_with_profile(') &&
  (migration.match(/^\s*p_[a-z_]+\s+/gm) || []).length === 17);
check('migration', 'instructor branch inserts only blank legacy values and Active status',
  /ELSIF p_role = 'instructor' THEN[\s\S]*?INSERT INTO public\.instructor_profiles[\s\S]*?VALUES \(v_user_id, '', '', '', 'Active'\)/.test(migration) &&
  !/MISSING_INSTRUCTOR/.test(migration));
check('migration', 'migration source records that Codex did not apply it and exposes the RPC only to service_role',
  /PREPARED FOR OWNER REVIEW; NOT APPLIED BY CODEX/i.test(migration) &&
  migration.includes('REVOKE EXECUTE ON FUNCTION') &&
  migration.includes('GRANT EXECUTE ON FUNCTION') &&
  migration.includes('TO service_role'));
check('repository', 'fixture: forwarding request metadata to Supabase is rejected',
  !repoOAuth.includes('p_employee_id: trimOrNull(b.employeeId)') ||
  repoOAuth.includes("p_employee_id: role === 'instructor' ? null : trimOrNull(b.employeeId)"));

console.log('\n[instructor identity] UI and browser projection');

const modalMarker = "} else if (savedRole === 'instructor') {";
const modalFirst = profileScript.indexOf(modalMarker);
const modalBranchStart = profileScript.indexOf(modalMarker, modalFirst + modalMarker.length);
const modalBranchEnd = profileScript.indexOf("} else if (savedRole === 'guest') {", modalBranchStart + 1);
const instructorModal = profileScript.slice(modalBranchStart, modalBranchEnd < 0 ? profileScript.length : modalBranchEnd);
const instructorFallback = section(profileScript, "} else if (savedRole === 'instructor') {", "} else if (savedRole === 'admin') {");
const instructorData = section(publicData, "instructorProfile: {", "\n  },");
const instructorDashboard = section(dashboardController, '// Fetch additional profile data if instructor', '    res.render(\'dashboard\'');
const instructorOverview = section(dashboardView, 'id="tmpl-instructor-overview"', '</script>');
const instructorProfile = section(dashboardView, 'id="tmpl-instructor-profile"', '</script>');
const browserProjection = section(navbar, '<%- safeJson(user ?', ': null) %>');

check('completion view', 'instructor completion has no employee/department/position controls',
  !/oauth(?:EmployeeId|Department|Position)/.test(completionView) &&
  !/<label[^>]*>\s*(?:Employee ID|Department|Position)\s*<\/label>/i.test(completionView));
check('profile controller', 'instructor names are server-managed while other profile logic remains',
  profileController.includes("new Set(['student-cspc', 'guest', 'instructor'])") &&
  profileController.includes('Full name is managed by your account identity') &&
  profileController.includes('sbPlan.updateName') &&
  profileController.includes('UPDATE users SET first_name'));
check('profile script', 'instructor edit modal contains only name, email, and photo state',
  instructorModal.includes('${fullNameField}') && instructorModal.includes('for="editEmail"') &&
  profileScript.includes('const fullNameField = identityManagedName') &&
  profileScript.includes('edit-form-input--readonly') &&
  profileScript.includes('aria-readonly="true"') &&
  !/(?:editId|editDept|editPos|employeeId|department|position)/i.test(instructorModal));
check('profile script', 'instructor local fallback strips legacy metadata',
  instructorFallback.includes('profileImage') && instructorFallback.includes("status: savedInstructor.status || 'Active'") &&
  !/(?:employeeId|department|position)/i.test(instructorFallback));
check('profile script', 'instructor save sends no retired fields',
  /else if \(savedRole === 'instructor'\) \{[\s\S]*?window\.CampuSphereData\.instructorProfile/.test(profileScript) &&
  !/else if \(savedRole === 'instructor'\) \{[\s\S]*?payload\.(?:employeeId|department|position)/.test(profileScript));
check('public data', 'default instructor profile contains only identity and status',
  instructorData.includes("name: 'Dr. Maria Santos'") &&
  instructorData.includes("email: 'maria.santos@cspc.edu.ph'") &&
  instructorData.includes("status: 'Active'") &&
  !/(?:employeeId|department|position)/i.test(instructorData));
check('dashboard controller', 'instructor view model exposes identity, picture, and status only',
  instructorDashboard.includes('profileImage: user.profile_image_url || \'\'') &&
  instructorDashboard.includes('status: fallback(ip.status, \'Active\')') &&
  !/(?:employeeId|department|position)/i.test(instructorDashboard));
check('dashboard view', 'instructor overview keeps a compact account-status summary',
  instructorOverview.includes('instructor-status-summary') &&
  instructorOverview.includes('instructorProfile.status') &&
  !/(?:Employee ID|Department|Position|employeeId|department|position)/i.test(instructorOverview));
check('dashboard view', 'instructor profile keeps full name, email, picture, and status only',
  instructorProfile.includes('instructorProfile.profileImage') &&
  instructorProfile.includes('>Full Name<') &&
  instructorProfile.includes('>Email<') &&
  instructorProfile.includes('>Status<') &&
  !/(?:Employee ID|Department|Position|employeeId|department|position)/i.test(instructorProfile));
check('navbar', 'browser session projection excludes instructor legacy metadata',
  navbar.includes('safeJson(user ? {') &&
  !/(?:employee_id|department|position)\s*:/.test(browserProjection));
check('privacy', 'privacy notice explains preserved legacy values are hidden',
  /Legacy employee ID, position, and department values may remain stored[\s\S]*no longer collected or shown/i.test(privacy));
check('delivery', 'service-worker cache advances for the changed profile surfaces',
  /CACHE_VERSION\s*=\s*'v40'/.test(serviceWorker));

// Negative UI fixtures catch accidental reintroduction of one of the removed
// labels or controls even when the surrounding template remains unchanged.
const instructorProfileIsClean = (source) =>
  !/(?:Employee ID|Department|Position|employeeId|department|position)/i.test(source);
const instructorModalIsClean = (source) => !/(?:editId|editDept|editPos)/i.test(source);
check('dashboard view', 'fixture: reintroduced instructor Position UI is rejected',
  instructorProfileIsClean(instructorProfile) &&
  !instructorProfileIsClean(instructorProfile + '\n<span>Position</span>'));
check('profile script', 'fixture: reintroduced instructor edit field is rejected',
  instructorModalIsClean(instructorModal) &&
  !instructorModalIsClean(instructorModal + '\n<input id="editDept">'));

if (failures.length === 0) {
  console.log(`\nINSTRUCTOR-MINIMAL-PROFILE-PROBE OK: ${checks}/${checks}`);
  process.exitCode = 0;
} else {
  console.error(`\nINSTRUCTOR-MINIMAL-PROFILE-PROBE FAILED: ${failures.length} check(s) did not pass.`);
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exitCode = 1;
}
