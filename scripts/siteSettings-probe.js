'use strict';

/* ========================================
   CampuSphere - Site settings projection probe

   DATABASE-FREE and NETWORK-FREE. Covers the public render projection,
   allowlisted value normalization, route middleware wiring, escaped About and
   footer surfaces, and the admin preview affordance.
   ======================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const failures = [];
let checkCount = 0;

function check(scope, label, condition) {
  checkCount += 1;
  const passed = Boolean(condition);
  console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!passed) failures.push(`${scope} :: ${label}`);
}

const serviceSource = read('services/siteSettingsService.js');
const descriptionUtilsSource = read('utils/siteSettingsDescription.js');
const routes = read('routes/index.js');
const controller = read('controllers/pageController.js');
const adminContentController = read('controllers/adminContentController.js');
const about = read('views/about.ejs');
const footer = read('views/partials/footer.ejs');
const dashFooter = read('views/partials/dash-footer.ejs');
const admin = read('views/admin/settings.ejs');
const adminClient = read('public/js/admin/admin-settings.js');
const adminMain = read('public/js/admin/main.js');
const styles = read('public/css/styles.css');
const adminStyles = read('public/css/admin-styles.css');

console.log('\n[site settings] source and pure projection contracts');

check('service', 'fixed ten-key allowlist is present',
  (serviceSource.match(/key: '/g) || []).length === 10 &&
  serviceSource.includes('SETTINGS_KEYS') && serviceSource.includes('DEFAULT_PUBLIC_SETTINGS'));
check('service', 'public read selects the active backend',
  serviceSource.includes('contentDataSource.isSupabase()') &&
  serviceSource.includes('siteContentRepository.listSettings()') &&
  serviceSource.includes('db.query('));
check('service', 'MySQL settings read is parameterized and bounded to the allowlist',
  serviceSource.includes('WHERE setting_key IN (${placeholders})') &&
  serviceSource.includes('SETTINGS_KEYS') && !/SELECT[\s\S]*\+\s*.*setting/i.test(serviceSource));
check('service', 'invalid stored values fall back before public rendering',
  serviceSource.includes('normalizePublicSettings') &&
  serviceSource.includes('isValidSettingValue') &&
  serviceSource.includes('SETTINGS_EMAIL_RE') &&
  serviceSource.includes("parsed.protocol !== 'http:'") &&
  serviceSource.includes('expandLegacySchoolDescription') &&
  serviceSource.includes('settings[spec.key] = spec.key === \'school_description\''));
check('service', 'backend failures use sanitized logging and safe defaults',
  serviceSource.includes("logServerError('siteSettings.public', req)") &&
  serviceSource.includes('res.locals.siteSettings = { ...DEFAULT_PUBLIC_SETTINGS }'));

const { DEFAULT_PUBLIC_SETTINGS, normalizePublicSettings } = require('../services/siteSettingsService');
const {
  LEGACY_SCHOOL_DESCRIPTION,
  DEFAULT_SCHOOL_CONTEXT,
  DEFAULT_SCHOOL_DESCRIPTION,
  splitSchoolDescription,
  canonicalizeSchoolDescription,
  expandLegacySchoolDescription,
} = require('../utils/siteSettingsDescription');
const expandedLegacyDescription = expandLegacySchoolDescription(LEGACY_SCHOOL_DESCRIPTION);
const canonicalDescription = canonicalizeSchoolDescription(
  `${LEGACY_SCHOOL_DESCRIPTION}\r\n\r\n${DEFAULT_SCHOOL_CONTEXT}`
);
check('description', 'legacy description expands to the two canonical blocks without a write',
  descriptionUtilsSource.includes('LEGACY_SCHOOL_DESCRIPTION') &&
  expandedLegacyDescription === DEFAULT_SCHOOL_DESCRIPTION &&
  splitSchoolDescription(expandedLegacyDescription).length === 2);
check('description', 'description normalization preserves two blocks and canonical newlines',
  canonicalDescription.ok === true &&
  canonicalDescription.value === DEFAULT_SCHOOL_DESCRIPTION &&
  canonicalDescription.blocks.length === 2);
check('description', 'description rejects a third paragraph while retaining the existing length cap',
  canonicalizeSchoolDescription('one\n\ntwo\n\nthree').ok === false &&
  /at most two paragraphs/i.test(canonicalizeSchoolDescription('one\n\ntwo\n\nthree').message) &&
  canonicalizeSchoolDescription('x'.repeat(2001)).ok === false);
const validRows = Object.entries(DEFAULT_PUBLIC_SETTINGS).map(([setting_key, setting_value]) => ({ setting_key, setting_value }));
const normalized = normalizePublicSettings(validRows);
check('projection', 'canonical rows preserve all ten public values',
  Object.keys(DEFAULT_PUBLIC_SETTINGS).length === 10 &&
  Object.keys(normalized).length === 10 &&
  normalized.school_name === DEFAULT_PUBLIC_SETTINGS.school_name &&
  normalized.contact_website === DEFAULT_PUBLIC_SETTINGS.contact_website);
const hostile = normalizePublicSettings([
  { setting_key: 'school_name', setting_value: '<img src=x onerror=alert(1)>' },
  { setting_key: 'contact_email', setting_value: 'not-an-email' },
  { setting_key: 'contact_website', setting_value: 'javascript:alert(1)' },
  { setting_key: 'school_founded', setting_value: '0000' },
  { setting_key: 'internal_secret', setting_value: 'must-not-leak' },
]);
check('projection', 'malformed links/years and unknown keys fall back without leaking',
  hostile.school_name === '<img src=x onerror=alert(1)>' &&
  hostile.contact_email === DEFAULT_PUBLIC_SETTINGS.contact_email &&
  hostile.contact_website === DEFAULT_PUBLIC_SETTINGS.contact_website &&
  hostile.school_founded === DEFAULT_PUBLIC_SETTINGS.school_founded &&
  !Object.prototype.hasOwnProperty.call(hostile, 'internal_secret'));

check('route', 'all five footer/About routes load public settings',
  routes.includes("router.get('/', loadPublicSettings, pageController.landing)") &&
  routes.includes("router.get('/home', loadPublicSettings, pageController.home)") &&
  routes.includes("router.get('/privacy', loadPublicSettings, pageController.privacy)") &&
  routes.includes("router.get('/faq', loadPublicSettings, faqController.index)") &&
  routes.includes("router.get('/about', requireLogin, loadPublicSettings, pageController.about)"));
check('route', 'About keeps its existing signed-in requirement before settings loading',
  /router\.get\('\/about',\s*requireLogin,\s*loadPublicSettings,\s*pageController\.about\)/.test(routes));
check('controller', 'About passes settings into the rendered view and metadata',
  controller.includes('const siteSettings = res.locals.siteSettings || {};') &&
  controller.includes('schoolDescriptionParts') &&
  controller.includes('description: schoolDescriptionParts[0]') &&
  controller.includes('school_description: schoolDescription'));
check('admin api', 'settings validation canonicalizes the two-block description before persistence',
  adminContentController.includes('SCHOOL_DESCRIPTION_MAX_LENGTH') &&
  adminContentController.includes('canonicalizeSchoolDescription(v)') &&
  adminContentController.includes('out[spec.key] = parsedDescription.value'));

check('about', 'all institution fields render through escaped EJS output in existing elements',
  about.includes("setting('school_name'") && about.includes("setting('school_acronym'") &&
  about.includes("setting('school_address'") && about.includes("setting('school_founded'") &&
  about.includes("setting('school_description'") &&
  about.includes("setting('contact_address'") && about.includes("setting('contact_phone'") &&
  about.includes("setting('contact_email'") && about.includes("setting('contact_website'") &&
  about.includes("setting('contact_hours'") &&
  about.includes('descriptionParts') && about.includes('schoolOverview') &&
  about.includes('campusContext') &&
  about.includes('class="split-block"') && about.includes('class="contact-card"') &&
  !/institution-(?:facts?|profile|details?)/.test(about) &&
  !/<%-\s*institution\./.test(about));
check('about', 'institution email and website links are explicit and safe',
  about.includes('href="mailto:<%= setting(\'contact_email\'') &&
  about.includes('href="<%= setting(\'contact_website\'') &&
  about.includes('target="_blank" rel="noopener noreferrer"'));
check('about', 'existing Team Dutchess and project content remains present',
  about.includes('Meet Team Dutchess') && about.includes('Why CampuSphere?') &&
  about.includes('class="contact-links"'));

check('footer', 'anonymous footer uses managed school identity/address and website',
  footer.includes('footerSettings.school_name') &&
  footer.includes('footerSettings.school_address') &&
  footer.includes('footerSettings.contact_website') &&
  footer.includes('footerSettings.school_acronym'));
check('footer', 'signed-in footer uses the managed school name',
  dashFooter.includes('dashboardFooterSettings.school_name'));
check('admin', 'settings page explains the public destinations and links to About',
  /Changes appear on the <a href="\/about"/.test(admin) &&
  admin.includes('shared footers'));
check('admin', 'description editor explains and exposes the two-block format accessibly',
  admin.includes('rows="7"') &&
  admin.includes('data-legacy-description') &&
  admin.includes('data-default-context') &&
  admin.includes('hint-school_description') &&
  admin.includes('Use one blank line to separate'));
check('admin', 'save client remains API-driven and uses the existing form feedback',
  adminClient.includes("fetch('/admin/api/settings'") === false &&
  adminClient.includes("'/admin/api/settings'") &&
  adminClient.includes('showToast') && adminClient.includes('showFormError') &&
  adminClient.includes('displayDescription') && adminClient.includes('normalizeDescription'));
check('admin', 'shared admin fetch shim attaches CSRF only to same-origin unsafe requests',
  adminMain.includes('sameOrigin') && adminMain.includes('X-CSRF-Token') &&
  adminMain.includes('UNSAFE[method]'));

check('css', 'About keeps the original contact and split-block presentation',
  styles.includes('.contact-card') && styles.includes('.contact-links') &&
  styles.includes('.split-block') && !styles.includes('.institution-profile'));
check('css', 'removed institution-specific presentation rules stay absent',
  !styles.includes('.institution-facts') && !styles.includes('.institution-fact') &&
  !styles.includes('.institution-detail'));
check('css', 'admin preview link has visible keyboard focus',
  adminStyles.includes('.settings-preview-link:focus-visible'));

if (failures.length === 0) {
  console.log(`SITE-SETTINGS-PROBE OK: ${checkCount}/${checkCount}`);
  process.exitCode = 0;
} else {
  console.error(`SITE-SETTINGS-PROBE FAILED: ${failures.length} check(s) did not pass.`);
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exitCode = 1;
}
