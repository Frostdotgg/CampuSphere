'use strict';

/*
 * CampuSphere - account identity-name contract probe
 *
 * Database- and network-free. It exercises the shared resolver and checks the
 * coupled OAuth, legacy registration, profile API, browser, privacy, and PWA
 * contracts that keep participant names server-controlled. No session, vendor,
 * database, or application server is opened.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const failures = [];
let checks = 0;

function check(label, condition) {
  checks += 1;
  const passed = Boolean(condition);
  console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${label}`);
  if (!passed) failures.push(label);
}

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) return '';
  const end = endMarker ? source.indexOf(endMarker, start + startMarker.length) : -1;
  return source.slice(start, end < 0 ? source.length : end);
}

const resolver = require(path.join(ROOT, 'utils', 'accountIdentityName'));
const auth = read('controllers/authController.js');
const repository = read('repositories/userRepository.js');
const profileController = read('controllers/profileController.js');
const profileScript = read('public/js/profile-script.js');
const dataScript = read('public/js/data.js');
const completion = read('views/complete-registration.ejs');
const privacy = read('views/privacy.ejs');
const styles = read('public/css/styles.css');
const sw = read('public/sw.js');

console.log('\n[identity name] resolver precedence and formatting');
const givenFamily = resolver.resolveAccountIdentityName({
  givenName: '  Ada  ', familyName: '  Lovelace ', fullName: 'Tampered Name', email: 'wrong@example.com'
});
check('verified given/family claims take precedence over full name and email',
  givenFamily.fullName === 'Ada Lovelace' && givenFamily.source === 'google-given-family');

const fullName = resolver.resolveAccountIdentityName({
  givenName: '', familyName: '', fullName: '  Grace   Hopper  ', email: 'wrong@example.com'
});
check('Google full name is the second fallback',
  fullName.firstName === 'Grace' && fullName.lastName === 'Hopper' && fullName.source === 'google-full-name');

const emailPrefix = resolver.resolveAccountIdentityName({
  givenName: '', familyName: '', fullName: '', email: 'grace.hopper+probe@gmail.com'
});
check('normalized email prefix is the final identity fallback',
  emailPrefix.fullName === 'Grace Hopper' && emailPrefix.source === 'email-prefix');

const whitespace = resolver.resolveAccountIdentityName({
  givenName: '\t', familyName: '\n', fullName: '  ', email: '___@gmail.com'
});
check('blank claims receive a safe non-empty fallback',
  whitespace.fullName === 'User' && whitespace.first_name === 'User' && whitespace.last_name === '');
check('resolver bounds database name parts',
  resolver.resolveAccountIdentityName({ givenName: 'a'.repeat(70), familyName: 'b'.repeat(70) }).firstName.length <= 50 &&
  resolver.resolveAccountIdentityName({ givenName: 'a'.repeat(70), familyName: 'b'.repeat(70) }).lastName.length <= 50);

console.log('\n[identity name] server authority contracts');
const localOAuth = section(auth, 'async function createOAuthUserWithProfile(pending, body)', '// Complete a pending OAuth registration');
const repoOAuth = section(repository, 'async function createOAuthUserWithProfile(pending, body)', 'async function updateUserName');
const loginBranch = section(auth, "if (intent === 'login') {", '    const existing =');
const registerBranch = section(auth, 'exports.registerPost = async', '/**\n * POST /login');
check('MySQL OAuth creation uses the shared resolver and not submitted fullName',
  localOAuth.includes('resolveAccountIdentityName') &&
  !/body\.fullName|fields\.fullName/.test(localOAuth));
check('Supabase OAuth creation uses the shared resolver and not submitted fullName',
  repoOAuth.includes('resolveAccountIdentityName') &&
  !/b\.fullName/.test(repoOAuth));
check('legacy guest registration derives both backends from the email identity',
  registerBranch.includes('registrationIdentity') &&
  registerBranch.includes('const sbFirstName = registrationIdentity.firstName') &&
  registerBranch.includes('const first_name = registrationIdentity.firstName') &&
  /submitted fullName is[\s\S]{0,100}ignored/.test(registerBranch));
check('OAuth login resynchronizes locked-role names before hydration',
  auth.includes('async function syncGoogleIdentityName') &&
  loginBranch.includes('await syncGoogleIdentityName(user, profile, useSupabase);') &&
  loginBranch.indexOf('await hydrateSessionUser(req, user);') > loginBranch.indexOf('await syncGoogleIdentityName(user, profile, useSupabase);'));
check('name sync failures are non-blocking and sanitized',
  auth.includes("console.warn('Google account name refresh skipped.')") &&
  !/console\.warn\([^\n]*(?:profile|email|userRow|err)/.test(section(auth, 'async function syncGoogleIdentityName', 'async function createOAuthUserWithProfile')));
check('completion POST allowlists only role fields and discards fullName',
  auth.includes('const allowedFields = pending.role ===') &&
  auth.includes('fullName is intentionally discarded'));

console.log('\n[identity name] profile and completion UI/API contracts');
check('completion name is selectable read-only with an explanation',
  /id="oauthFullName"[^>]*readonly[^>]*aria-readonly="true"/.test(completion) &&
  !/id="oauthFullName"[^>]*name="fullName"/.test(completion) &&
  /Google manages this name/i.test(completion));
check('locked roles are rejected when name is submitted to the profile API',
  profileController.includes("new Set(['student-cspc', 'guest', 'instructor'])") &&
  profileController.includes('Full name is managed by your account identity and cannot be changed.') &&
  /IDENTITY_MANAGED_ROLES\.has\(role\)[\s\S]{0,220}hasOwnProperty\.call\(req\.body, 'name'\)/.test(profileController));
check('administrator name editing remains in the normal profile write path',
  profileController.includes('sbPlan.updateName = true') &&
  /if \(Object\.prototype\.hasOwnProperty\.call\(req\.body, 'name'\)\)/.test(profileController));
check('locked role modal fields are read-only and describe the authority',
  profileScript.includes('const identityManagedName =') &&
  profileScript.includes('edit-form-input--readonly') &&
  profileScript.includes('This name is managed by your account identity'));
check('locked role saves omit name from local mirrors, navigation, and API payloads',
  /if \(identityManagedName\) \{[\s\S]{0,180}?delete newData\.name/.test(profileScript) &&
  /if \(!identityManagedName\) \{[\s\S]{0,180}?navUsername/.test(profileScript) &&
  /if \(!identityManagedName\) payload\.name/.test(profileScript));
check('legacy local mirrors cannot override participant names',
  /delete savedStudent\.name/.test(profileScript) &&
  /name: 'Dr\. Maria Santos'/.test(profileScript) &&
  /delete savedStudentData\.name/.test(dataScript) &&
  !/name:\s*savedInstructorData\.name/.test(dataScript));
check('administrator save still sends name',
  /if \(!identityManagedName\) payload\.name = newData\.name/.test(profileScript));

console.log('\n[identity name] styling, privacy, and cache contracts');
check('read-only name styling exists in light and dark themes',
  styles.includes('.edit-form-input--readonly') &&
  styles.includes('[data-theme="dark"] .edit-form-input--readonly') &&
  styles.includes('.edit-form-help'));
check('privacy notice explains Google-managed name refresh',
  /displayed name is managed by the verified Google identity/i.test(privacy) &&
  /refreshed after a successful Google sign-in/i.test(privacy));
check('stylesheet cache key and worker version advance together',
  /CACHE_VERSION\s*=\s*'v38'/.test(sw) &&
  sw.includes("'/css/styles.css?v=10'") &&
  !/CACHE_VERSION\s*=\s*'v37'/.test(sw));

console.log(`\n${failures.length ? 'IDENTITY-NAME-PROBE FAILED' : 'IDENTITY-NAME-PROBE OK'}: ${checks - failures.length}/${checks}`);
if (failures.length) {
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exitCode = 1;
}
