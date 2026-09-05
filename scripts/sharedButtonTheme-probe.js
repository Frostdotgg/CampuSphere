'use strict';

/* ========================================
   CampuSphere - shared button/theme probe

   DATABASE-, NETWORK-, and SESSION-FREE. This contract protects the shared
   reset, the building-card actions, the map's secondary actions, and the
   light/dark theme control from specificity regressions. It also pins the
   stylesheet/service-worker cache pair so an older shell cannot hide the fix.
   ======================================== */

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

function blockAt(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) return '';
  const end = source.indexOf('}', start);
  return end > start ? source.slice(start, end + 1) : '';
}

function variablesIn(source) {
  const vars = Object.create(null);
  const pattern = /(--[a-z0-9-]+)\s*:\s*([^;{}]+);/gi;
  let match;
  while ((match = pattern.exec(source))) vars[match[1]] = match[2].trim();
  return vars;
}

function hex(value) {
  return /^#[0-9a-f]{6}$/i.test(value || '') ? value : null;
}

function relativeLuminance(value) {
  const channels = value.slice(1).match(/../g).map((channel) => parseInt(channel, 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(first, second) {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const css = read('public/css/styles.css');
const buildings = read('views/buildings.ejs');
const map = read('views/map.ejs');
const serviceWorker = read('public/sw.js');

function resetContract(source) {
  const block = blockAt(source, ':where(\n    button:not(.btn),');
  return block.startsWith(':where(') &&
    block.includes('button:not(.btn)') &&
    block.includes("[type='button']:not(.btn)") &&
    block.includes("[type='reset']:not(.btn)") &&
    block.includes("[type='submit']:not(.btn)") &&
    /appearance:\s*button;/.test(block) && /cursor:\s*pointer;/.test(block);
}

function workerContract(source) {
  const precache = (source.match(/PRECACHE_URLS\s*=\s*\[([\s\S]*?)\]/) || [])[1] || '';
  return /CACHE_VERSION\s*=\s*'v39'/.test(source) &&
    !/CACHE_VERSION\s*=\s*'v38'/.test(source) &&
    (precache.match(/\/css\/styles\.css\?v=\d+/g) || []).length === 1 &&
    precache.includes("'/css/styles.css?v=11'");
}

function secondaryVariantContract(source) {
  const base = blockAt(source, '.btn--secondary {');
  return base.includes('color: var(--secondary-action-foreground)') &&
    base.includes('background: var(--secondary-action-bg)') &&
    base.includes('border: 1px solid var(--secondary-action-border)');
}

console.log('\n[shared buttons] reset and component source contracts');
const reset = blockAt(css, ':where(\n    button:not(.btn),');
check('reset', 'plain-button normalization is wrapped in zero-specificity :where()',
  reset.startsWith(':where(') &&
  reset.includes('button:not(.btn)') &&
  reset.includes("[type='button']:not(.btn)") &&
  reset.includes("[type='reset']:not(.btn)") &&
  reset.includes("[type='submit']:not(.btn)"));
check('reset', 'the former high-specificity reset is absent',
  !/(?:^|\n)button:not\(\.btn\),\s*\n\[type='button'\]:not\(\.btn\)/.test(css));
check('reset', 'the normalization still keeps plain buttons keyboard-operable',
  /appearance:\s*button;/.test(reset) && /cursor:\s*pointer;/.test(reset));

const secondary = blockAt(css, '.btn--secondary {');
const secondaryHover = blockAt(css, '.btn--secondary:hover {');
const secondaryActive = blockAt(css, '.btn--secondary:active {');
const secondaryFocus = blockAt(css, '.btn--secondary:focus-visible {');
const secondaryDisabled = blockAt(css, '.btn--secondary:disabled,');
check('secondary', 'the shared secondary variant has a filled surface and visible border',
  secondaryVariantContract(css));
check('secondary', 'secondary hover, active, focus, and disabled states are explicit',
  secondaryHover.includes('background: var(--secondary-action-hover-bg)') &&
  secondaryActive.includes('background: var(--secondary-action-active-bg)') &&
  /outline:\s*3px\s+solid\s+var\(--ring/.test(secondaryFocus) &&
  /cursor:\s*not-allowed/.test(secondaryDisabled) &&
  /opacity:\s*0\.8/.test(secondaryDisabled));

const detailButtons = [...buildings.matchAll(/<button\s+type="button"\s+class="bldg-card__btn\s+bldg-card__btn--(primary|routes)"[^>]*data-action="(details|routes)"/g)];
check('buildings', 'View Details and View Routes are explicit non-submitting buttons',
  detailButtons.length === 2 &&
  detailButtons.some((match) => match[1] === 'primary' && match[2] === 'details') &&
  detailButtons.some((match) => match[1] === 'routes' && match[2] === 'routes'));
const buildingPrimary = blockAt(css, '.bldg-card__btn--primary {');
const buildingPrimaryHover = blockAt(css, '.bldg-card__btn--primary:hover {');
const buildingRoutes = blockAt(css, '.bldg-card__btn--routes {');
const buildingRoutesHover = blockAt(css, '.bldg-card__btn--routes:hover {');
const buildingFocus = blockAt(css, '.bldg-card__btn:focus-visible {');
const buildingDisabled = blockAt(css, '.bldg-card__btn:disabled,');
check('buildings', 'card actions use semantic primary and route action tokens',
  buildingPrimary.includes('var(--primary-action-bg-start)') &&
  buildingPrimary.includes('var(--primary-action-bg-end)') &&
  buildingPrimaryHover.includes('var(--primary-action-hover-start)') &&
  buildingRoutes.includes('var(--route-action-bg-start)') &&
  buildingRoutes.includes('var(--route-action-bg-end)') &&
  buildingRoutesHover.includes('var(--route-action-hover-start)') &&
  buildingRoutesHover.includes('var(--route-action-hover-end)'));
check('buildings', 'card actions expose shared focus and disabled behavior',
  /outline:\s*3px\s+solid\s+var\(--ring/.test(buildingFocus) &&
  /cursor:\s*not-allowed/.test(buildingDisabled) &&
  /transform:\s*none/.test(buildingDisabled));

check('map', 'offline map uses the defined secondary variant',
  /<button[^>]*class="btn btn--secondary btn--sm map-offline-guide__download"[^>]*type="button"/.test(map));
check('theme', 'theme toggle keeps explicit button semantics on both affected pages',
  /<button\s+type="button"\s+class="theme-toggle"/.test(buildings) &&
  /<button\s+type="button"\s+class="theme-toggle"/.test(map));
check('theme', 'light and dark theme-toggle surfaces remain defined after the reset',
  blockAt(css, '.theme-toggle {\n    position: fixed;').includes('background: var(--white)') &&
  blockAt(css, '[data-theme="dark"] .theme-toggle {').includes('background: var(--navy-700)'));

console.log('\n[shared buttons] light/dark contrast and cache contracts');
const lightVars = variablesIn(blockAt(css, ':root {'));
const darkVars = {
  ...lightVars,
  ...variablesIn(blockAt(css, 'html[data-theme="dark"] {')),
  ...variablesIn(blockAt(css, '[data-theme="dark"] {')),
};
function themeContrastIsAa(vars) {
  const primaryForeground = hex(vars['--primary-action-foreground']);
  const primaryBackgrounds = [
    hex(vars['--primary-action-bg-start']), hex(vars['--primary-action-bg-end']),
    hex(vars['--primary-action-hover-start']), hex(vars['--primary-action-hover-end']),
  ];
  const secondaryForeground = hex(vars['--secondary-action-foreground']);
  const secondaryBackgrounds = [
    hex(vars['--secondary-action-bg']), hex(vars['--secondary-action-hover-bg']),
    hex(vars['--secondary-action-active-bg']),
  ];
  const routeForeground = hex(vars['--route-action-foreground']);
  const routeBackgrounds = [
    hex(vars['--route-action-bg-start']), hex(vars['--route-action-bg-end']),
    hex(vars['--route-action-hover-start']), hex(vars['--route-action-hover-end']),
  ];
  const secondaryDisabledForeground = hex(vars['--secondary-action-disabled-foreground']);
  const secondaryDisabledBackground = hex(vars['--secondary-action-disabled-bg']);
  return Boolean(primaryForeground && secondaryForeground && routeForeground &&
    secondaryDisabledForeground && secondaryDisabledBackground &&
    primaryBackgrounds.every((background) => contrastRatio(primaryForeground, background) >= 4.5) &&
    secondaryBackgrounds.every((background) => contrastRatio(secondaryForeground, background) >= 4.5) &&
    routeBackgrounds.every((background) => contrastRatio(routeForeground, background) >= 4.5) &&
    contrastRatio(secondaryDisabledForeground, secondaryDisabledBackground) >= 4.5);
}
check('contrast', 'light action states meet WCAG AA', themeContrastIsAa(lightVars));
check('contrast', 'dark action states meet WCAG AA', themeContrastIsAa(darkVars));

const stylesheetConsumers = [
  'public/offline.html',
  'views/about.ejs',
  'views/buildings.ejs',
  'views/events.ejs',
  'views/map.ejs',
  'views/partials/head.ejs',
  'views/vr.ejs',
  'views/vr-route.ejs',
].map(read);
check('cache', 'every shared stylesheet consumer uses v11',
  stylesheetConsumers.every((source) =>
    (source.match(/\/css\/styles\.css\?v=\d+/g) || []).length === 1 &&
    source.includes('/css/styles.css?v=11')));
check('cache', 'service worker advances to v39 and precaches only the v11 stylesheet',
  workerContract(serviceWorker));

console.log('\n[shared buttons] rejecting fixtures');
check('fixtures', 'restoring the high-specificity :not(.btn) reset is rejected',
  !resetContract(css.replace(':where(\n    button:not(.btn),', 'button:not(.btn),')));
check('fixtures', 'removing the secondary variant is rejected',
  !secondaryVariantContract(css.replace('.btn--secondary {', '.btn--secondary-removed {')));
check('fixtures', 'a low-contrast route endpoint is rejected',
  !themeContrastIsAa({ ...lightVars, '--route-action-bg-end': '#22c55e' }));
check('fixtures', 'a stale v38 worker is rejected',
  !workerContract(serviceWorker.replace("CACHE_VERSION = 'v39'", "CACHE_VERSION = 'v38'")));

if (failures.length === 0) {
  console.log(`\nSHARED-BUTTON-THEME-PROBE OK: ${checks}/${checks}`);
  process.exitCode = 0;
} else {
  console.error(`\nSHARED-BUTTON-THEME-PROBE FAILED: ${failures.length} check(s) did not pass.`);
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exitCode = 1;
}
