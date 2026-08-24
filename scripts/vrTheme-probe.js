'use strict';

/* ========================================
   CampuSphere - VR theme probe

   DATABASE-FREE and NETWORK-FREE. Verifies the source contracts for both
   public VR views: semantic light/dark page tokens, a dark panorama stage,
   saved-theme initialization, and the shared accessible theme control.
   ======================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const failures = [];

function check(scope, label, ok) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!ok) failures.push(`${scope} :: ${label}`);
}

function hasThemeContract(source) {
  return source.includes('--vr-page-bg:') &&
    source.includes('html[data-theme="dark"] body') &&
    source.includes('background: var(--vr-page-bg)') &&
    source.includes('color: var(--vr-text)') &&
    source.includes('background: var(--vr-surface)') &&
    source.includes('var(--vr-border)');
}

function hasDarkViewerContract(source) {
  return /\.vr-stage[\s\S]*?background:\s*(?:#11151c|radial-gradient\(circle at 50% 40%, #14233d 0%, #07101e 100%\))/.test(source) &&
    /\.vr-fallback[\s\S]*?color:\s*#e(?:6edf7|8edf4)/.test(source);
}

/* ---------------- 1. both views use the shared theme contract ---------------- */
for (const rel of ['views/vr.ejs', 'views/vr-route.ejs']) {
  const source = read(rel);
  const themeIncludes = source.match(/<%- include\('partials\/theme-toggle'\) %>/g) || [];
  check('views', `${rel} includes the shared theme control exactly once`, themeIncludes.length === 1);
  check('views', `${rel} initializes the saved theme before the shared stylesheet`,
    source.includes("localStorage.getItem('campussphere-theme')") &&
    source.indexOf("localStorage.getItem('campussphere-theme')") < source.indexOf('<link rel="stylesheet" href="/css/styles.css'));
  check('views', `${rel} defines light and dark page tokens`, hasThemeContract(source));
  check('views', `${rel} keeps the panorama stage and fallback dark`, hasDarkViewerContract(source));
  check('views', `${rel} does not unconditionally force a dark page background`,
    !/body\s*\{\s*background:\s*#(?:050c18|111827)/.test(source));

  const missingDark = source.replace(/html\[data-theme="dark"\] body\s*\{[\s\S]*?\n        \}/, '');
  check('fixtures', `${rel} loses the contract when its dark override is removed`,
    !hasThemeContract(missingDark));
}

/* ---------------- 2. shared control and persistence contracts ---------------- */
{
  const toggle = read('views/partials/theme-toggle.ejs');
  check('toggle', 'control is a labelled button with an explicit pressed state',
    /<button[^>]+type="button"[^>]+aria-label="[^"]+"[^>]+aria-pressed="false"/.test(toggle));
  check('toggle', 'control uses the shared campussphere-theme storage key',
    toggle.includes("const STORAGE_KEY = 'campussphere-theme';"));
  check('toggle', 'dark state writes the expected data-theme value',
    toggle.includes("setAttribute('data-theme', 'dark')"));
  check('toggle', 'light state removes the data-theme attribute',
    toggle.includes("removeAttribute('data-theme')"));
  check('toggle', 'control synchronizes aria-pressed and its action label',
    toggle.includes("toggle.setAttribute('aria-pressed', dark ? 'true' : 'false')") &&
    toggle.includes("toggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode')"));
  check('toggle', 'storage access is fail-safe',
    /try\s*\{[\s\S]*localStorage\.getItem\(STORAGE_KEY\)[\s\S]*catch/.test(toggle) &&
    /try\s*\{\s*localStorage\.setItem\(STORAGE_KEY, theme\)[\s\S]*catch/.test(toggle));
  check('toggle', 'legacy empty-attribute toggling is absent',
    !toggle.includes("toggleAttribute('data-theme'"));
}

/* ---------------- summary ---------------- */
if (failures.length === 0) {
  console.log('VR-THEME-PROBE OK: all checks passed.');
  process.exitCode = 0;
} else {
  console.error(`VR-THEME-PROBE FAILED: ${failures.length} check(s) did not pass:`);
  failures.forEach((failure) => console.error('  - ' + failure));
  process.exitCode = 1;
}
