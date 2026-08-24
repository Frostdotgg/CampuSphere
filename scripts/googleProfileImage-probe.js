'use strict';

/*
 * Focused, database-free contract probe for Google-synced profile pictures.
 * Run with: node scripts/googleProfileImage-probe.js
 *
 * This probe never contacts Google, either database, or the application
 * server. It exercises the URL policy and checks the source contracts that
 * keep the provider photo synchronized, safely rendered, and cache-delivered.
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

const policy = require(path.join(ROOT, 'utils', 'googleProfileImage'));
const auth = read('controllers/authController.js');
const repository = read('repositories/userRepository.js');
const profile = read('public/js/profile-script.js');
const securityHeaders = read('middleware/securityHeaders.js');
const privacy = read('views/privacy.ejs');
const serviceWorker = read('public/sw.js');

console.log('\n[google profile image] URL policy');

const accepted = [
  'https://lh3.googleusercontent.com/a/test=s96-c',
  'https://lh4.googleusercontent.com/profile/photo.png?sz=96'
];
const rejected = [
  'http://lh3.googleusercontent.com/a/test',
  'https://googleusercontent.com/a/test',
  'https://lh3.googleusercontent.com.evil.example/a/test',
  'https://user@lh3.googleusercontent.com/a/test',
  'https://lh3.googleusercontent.com:443/a/test',
  'data:image/png;base64,AAAA',
  'https://example.com/profile.png',
  'https://' + 'a'.repeat(260) + '.googleusercontent.com/photo'
];

for (const value of accepted) {
  check(`accepts approved HTTPS Google image (${value.split('/')[2]})`,
    policy.normalizeGoogleProfileImageUrl(value) === value);
}
for (const value of rejected) {
  check('rejects unsafe or non-Google image URL',
    policy.normalizeGoogleProfileImageUrl(value) === null);
}
check('rejects non-string input', policy.normalizeGoogleProfileImageUrl(null) === null);

console.log('\n[google profile image] server contracts');
check('auth validates stored session image URLs',
  auth.includes("normalizeGoogleProfileImageUrl(userRow && userRow.profile_image_url)") &&
  auth.includes("normalizeMediaUrl(userRow && userRow.profile_image_url)"));
check('Google login refreshes the picture before session hydration',
  auth.includes('await syncGoogleProfileImage(user, profile.picture, useSupabase);') &&
  auth.indexOf('await syncGoogleProfileImage(user, profile.picture, useSupabase);') <
  auth.indexOf('await hydrateSessionUser(req, user);'));
check('new OAuth registration stores only a validated picture',
  auth.includes('picture: normalizeGoogleProfileImageUrl(profile.picture) || \'\'') &&
  auth.includes('const picture = normalizeGoogleProfileImageUrl(pending.picture) || null;'));
check('Supabase repository validates and exports the image update method',
  repository.includes('normalizeGoogleProfileImageUrl(imageUrl)') &&
  repository.includes('async function updateUserProfileImage') &&
  repository.includes('updateUserProfileImage,'));
check('MySQL and Supabase writes use the existing profile_image_url column',
  auth.includes('UPDATE users SET profile_image_url = ? WHERE id = ?') &&
  repository.includes('profile_image_url: picture'));
check('session exposes only safe image fields',
  auth.includes('profile_image_url: storedPicture') &&
  auth.includes('profile_image_source:') &&
  !auth.includes('oauth_subject: userRow.oauth_subject'));

console.log('\n[google profile image] browser and delivery contracts');
check('profile data reads the server session image and source',
  profile.includes('profileImage: sessionUser.profile_image_url || \'\'') &&
  profile.includes('profileImageSource: sessionUser.profile_image_source || \'\''));
check('Google-synced Edit Profile state is read-only',
  profile.includes('Synced from your Google Account') &&
  profile.includes('const photoUploadArea = isGoogleProfileImage ? syncedPhotoArea : uploadPhotoArea;'));
check('avatar image loads use no-referrer and error fallback',
  profile.includes("img.referrerPolicy = 'no-referrer';") &&
  profile.includes("if (img.parentElement === avatar) applyProfileImage('');"));
check('CSP allows Google only as an image origin',
  /imgSrc:\s*\[[^\]]*https:\/\/\*\.googleusercontent\.com/.test(securityHeaders) &&
  !/scriptSrc:\s*\[[^\]]*googleusercontent\.com/.test(securityHeaders) &&
  !/connectSrc:\s*\[[^\]]*googleusercontent\.com/.test(securityHeaders));
check('privacy notice names the Google profile picture URL',
  /Google Account profile picture URL/i.test(privacy) && /profile picture URL/i.test(privacy));
check('service worker cache advances and still precaches profile-script.js',
  /CACHE_VERSION\s*=\s*'v30'/.test(serviceWorker) &&
  serviceWorker.includes("'/js/profile-script.js'"));

console.log(`\n${failures.length ? 'GOOGLE PROFILE IMAGE PROBE FAILED' : 'GOOGLE PROFILE IMAGE PROBE PASSED'} (${checks - failures.length}/${checks})`);
if (failures.length) process.exitCode = 1;
