'use strict';

/*
 * Focused, database-free contract probe for the admin toolbar category menus.
 * Run with: node scripts/adminCategoryDropdown-probe.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const failures = [];

function check(label, condition) {
  const passed = Boolean(condition);
  console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${label}`);
  if (!passed) failures.push(label);
}

const newsView = read('views/admin/news.ejs');
const campusMapView = read('views/admin/campus-map.ejs');
const usersView = read('views/admin/users.ejs');
const adminStyles = read('public/css/admin-styles.css');
const adminMain = read('public/js/admin/main.js');
const adminNews = read('public/js/admin/admin-news.js');
const adminBuildings = read('public/js/admin/admin-buildings.js');
const adminUsers = read('public/js/admin/admin-users.js');

console.log('\n[admin category dropdown] source contracts');

for (const [name, source, triggerId, menuId] of [
  ['news', newsView, 'cat-filter-btn', 'cat-filter-menu'],
  ['campus-map', campusMapView, 'bld-cat-filter-btn', 'bld-cat-filter-menu'],
  ['users-role', usersView, 'role-filter-btn', 'role-filter-menu'],
  ['users-status', usersView, 'status-filter-btn', 'status-filter-menu'],
]) {
  check(`${name} has an anchored filter wrapper`,
    source.includes('class="admin-filter-dropdown relative inline-block text-left"'));
  check(`${name} trigger exposes menu state`,
    source.includes(`id="${triggerId}"`) &&
    source.includes('aria-haspopup="menu"') &&
    source.includes('aria-expanded="false"'));
  check(`${name} menu uses local anchor placement`,
    source.includes(`id="${menuId}"`) &&
    source.includes('data-dropdown-placement="anchor"') &&
    source.includes('role="menu"'));
  check(`${name} options are native buttons with radio state`,
    source.includes('<button type="button" class="dropdown-menu-item') &&
    source.includes('role="menuitemradio"') &&
    source.includes('aria-checked="true"'));
}

check('shared dropdown logic skips page coordinates for anchored menus',
  adminMain.includes("getAttribute('data-dropdown-placement') === 'anchor'") &&
  adminMain.includes("targetMenu.style.removeProperty('top')") &&
  adminMain.includes("targetMenu.style.removeProperty('right')"));
check('anchored menus can flip upward when a long list reaches the viewport edge',
  adminMain.includes('const fitsBelow = menuRect.bottom <= window.innerHeight') &&
  adminMain.includes("targetMenu.style.bottom = 'calc(100% + 0.5rem)'") &&
  adminMain.includes('const fitsAbove = triggerRect.top >= menuRect.height + 8'));
check('shared dropdown logic retains placement for other menus',
  adminMain.includes('rect.bottom + window.scrollY + 8') &&
  adminMain.includes('targetMenu.style.right = (window.innerWidth - rect.right)'));
check('shared dropdown logic synchronizes aria-expanded and Escape close',
  adminMain.includes("setAttribute('aria-expanded', String(expanded))") &&
  adminMain.includes("e.key !== 'Escape'") &&
  adminMain.includes('trigger.focus()'));

check('news tab rebuild keeps options keyboard-operable and stateful',
  adminNews.includes('<button type="button" class="dropdown-menu-item${activeClass}"') &&
  adminNews.includes("i.setAttribute('aria-checked','false')") &&
  adminNews.includes("item.setAttribute('aria-checked','true')"));
check('campus-map filter keeps selected option state synchronized',
  adminBuildings.includes("i.setAttribute('aria-checked','false')") &&
  adminBuildings.includes("item.setAttribute('aria-checked','true')"));
check('users role and status filters keep selected state and close after selection',
  adminUsers.includes("roleFilterMenu.removeAttribute('data-state')") &&
  adminUsers.includes("statusFilterMenu.removeAttribute('data-state')") &&
  adminUsers.includes("roleFilterBtn.setAttribute('aria-expanded', 'false')") &&
  adminUsers.includes("statusFilterBtn.setAttribute('aria-expanded', 'false')") &&
  adminUsers.includes("i.setAttribute('aria-checked', 'false')") &&
  adminUsers.includes("item.setAttribute('aria-checked', 'true')"));

check('admin CSS anchors the menu below its filter',
  adminStyles.includes('.dropdown-menu-content[data-dropdown-placement="anchor"]') &&
  adminStyles.includes('top: calc(100% + 0.5rem);') &&
  adminStyles.includes('right: 0;'));
check('admin CSS restores the missing menu surface and selected styling',
  adminStyles.includes('padding: 0.25rem;') &&
  adminStyles.includes('min-height: 44px;') &&
  adminStyles.includes('background: var(--accent);') &&
  adminStyles.includes(':focus-visible'));

console.log(`\n${failures.length ? 'ADMIN CATEGORY DROPDOWN PROBE FAILED' : 'ADMIN CATEGORY DROPDOWN PROBE PASSED'}`);
if (failures.length) process.exitCode = 1;
