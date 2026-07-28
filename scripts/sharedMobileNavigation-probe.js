'use strict';

/* ========================================
   CampuSphere - Shared Mobile Navigation & Brand probe
   M12.P1-D2 verification script.

   DATABASE-FREE and NETWORK-FREE. Verifies, with fixed sanitized PASS/FAIL
   labels only:
     - the shared partial markup contract (type/button, aria-controls,
       aria-expanded="false", correct CampuSphere brand) and EXACTLY ONE
       deferred /js/authenticated-nav.js include across all views;
     - the shared client behavior against a minimal mock DOM through its
       CommonJS export: initial closed state + ARIA sync, single-toggle
       open/close, Escape close + focus return, outside-pointer close,
       capture-phase tab-selection close (immune to stopPropagation),
       media-query reset, idempotent re-initialization, missing-node guard,
       and no browser-global creation;
     - removal of all six page-local hamburger owners and profile-script's
       menu-class manipulation;
     - the 44px target, :focus-visible, explicit-transition, and
       reduced-motion CSS contracts;
     - rendered surfaces free of CampusSphere/CAMPUSPHERE while excluded
       internal identifiers stay unrenamed.
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

/* ---------------- 1. shared partial markup + single include ---------------- */
{
  const nav = read('views/partials/dash-navbar.ejs');
  check('markup', 'hamburger keeps id="dashHamburger"', nav.includes('id="dashHamburger"'));
  check('markup', 'menu keeps id="dashTabs"', nav.includes('id="dashTabs"'));
  const btn = nav.slice(nav.indexOf('<button class="dash-nav__hamburger"'), nav.indexOf('</button>', nav.indexOf('<button class="dash-nav__hamburger"')));
  check('markup', 'hamburger declares type="button"', btn.includes('type="button"'));
  check('markup', 'hamburger declares aria-controls="dashTabs"', btn.includes('aria-controls="dashTabs"'));
  check('markup', 'hamburger initializes aria-expanded="false"', btn.includes('aria-expanded="false"'));
  check('markup', 'visible brand is the correct CampuSphere',
    nav.includes('<span class="dash-nav__title">CampuSphere</span>'));

  // Exactly one deferred include, and it lives in the shared partial.
  const includeRe = /<script src="\/js\/authenticated-nav\.js" defer><\/script>/g;
  check('markup', 'partial carries the single deferred authenticated-nav include',
    (nav.match(includeRe) || []).length === 1);
  // Count actual SCRIPT INCLUDES (comments may legitimately name the file).
  let totalIncludes = 0;
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.ejs')) {
        totalIncludes += (fs.readFileSync(p, 'utf8').match(/<script src="\/js\/authenticated-nav\.js"/g) || []).length;
      }
    }
  };
  walk(path.join(ROOT, 'views'));
  check('markup', 'exactly one authenticated-nav.js script include exists across every view', totalIncludes === 1);
}

/* ---------------- 2. mock-DOM behavioral contract ---------------- */
function makeClassList() {
  const set = new Set();
  return {
    add: (c) => set.add(c),
    remove: (c) => set.delete(c),
    contains: (c) => set.has(c),
    toggle: (c) => (set.has(c) ? set.delete(c) : set.add(c)),
  };
}
function makeElement(id, className) {
  const el = {
    id,
    className: className || '',
    classList: makeClassList(),
    attrs: {},
    parentNode: null,
    childNodes: [],
    listeners: { capture: {}, bubble: {} },
    focused: 0,
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
    addEventListener(type, fn, capture) {
      const bucket = capture === true ? this.listeners.capture : this.listeners.bubble;
      (bucket[type] = bucket[type] || []).push(fn);
    },
    contains(node) {
      let n = node;
      while (n) { if (n === this) return true; n = n.parentNode; }
      return false;
    },
    focus() { this.focused += 1; },
    appendChild(child) { child.parentNode = this; this.childNodes.push(child); return child; },
  };
  if (className) className.split(/\s+/).forEach((c) => c && el.classList.add(c));
  return el;
}
function makeDocument() {
  const byId = {};
  const doc = {
    listeners: { bubble: {} },
    defaultView: null,
    register(el) { byId[el.id] = el; return el; },
    getElementById(id) { return byId[id] || null; },
    addEventListener(type, fn) { (this.listeners.bubble[type] = this.listeners.bubble[type] || []).push(fn); },
    dispatch(type, event) { (this.listeners.bubble[type] || []).forEach((fn) => fn(event)); },
  };
  doc.defaultView = {
    mediaHandlers: [],
    matchMedia(q) {
      const self = this;
      return {
        media: q,
        matches: false,
        addEventListener(t, fn) { if (t === 'change') self.mediaHandlers.push(fn); },
      };
    },
  };
  return doc;
}
// Dispatch a click that starts at `target`: capture listeners on `container`
// run FIRST (ancestor capture), then the target's own bubble listeners — the
// same relative order a real DOM guarantees, so a target stopPropagation can
// never suppress the container's capture-phase cleanup.
function dispatchClickThrough(container, target) {
  const event = { target, stopped: false, stopPropagation() { this.stopped = true; } };
  if (container.contains(target)) {
    (container.listeners.capture.click || []).forEach((fn) => fn(event));
  }
  (target.listeners.bubble.click || []).forEach((fn) => fn(event));
  if (!event.stopped && target !== container) {
    (container.listeners.bubble.click || []).forEach((fn) => fn(event));
  }
  return event;
}

{
  const globalsBefore = Object.keys(global).length;
  const { initAuthenticatedNav } = require('./../public/js/authenticated-nav.js');
  check('client', 'CommonJS export exists without creating a browser global',
    typeof initAuthenticatedNav === 'function' &&
    !('initAuthenticatedNav' in global) && Object.keys(global).length === globalsBefore);

  const doc = makeDocument();
  const hamburger = doc.register(makeElement('dashHamburger'));
  const tabs = doc.register(makeElement('dashTabs'));
  const tab = makeElement('tabMap', 'dash-nav__tab');
  tabs.appendChild(tab);
  const inner = makeElement('tabMapInner', '');
  tab.appendChild(inner);
  const outside = makeElement('somewhereElse');

  check('client', 'init succeeds against the mock DOM', initAuthenticatedNav(doc) === true);
  const state = () => ({
    open: tabs.classList.contains('open'),
    active: hamburger.classList.contains('active'),
    expanded: hamburger.getAttribute('aria-expanded'),
    label: hamburger.getAttribute('aria-label'),
  });
  let s = state();
  check('client', 'initial state is closed with aria-expanded=false and the Open label',
    s.open === false && s.active === false && s.expanded === 'false' && s.label === 'Open navigation menu');

  const clickHamburger = () => (hamburger.listeners.bubble.click || []).forEach((fn) => fn({}));
  check('client', 'exactly one click listener is registered on the hamburger',
    (hamburger.listeners.bubble.click || []).length === 1);

  clickHamburger();
  s = state();
  check('client', 'one activation opens (classes + aria + Close label in sync)',
    s.open === true && s.active === true && s.expanded === 'true' && s.label === 'Close navigation menu');
  clickHamburger();
  s = state();
  check('client', 'the next activation closes without double-toggle',
    s.open === false && s.active === false && s.expanded === 'false' && s.label === 'Open navigation menu');

  // Idempotent re-init: no duplicate listeners, still single-toggle.
  check('client', 'repeated initialization reports success', initAuthenticatedNav(doc) === true && initAuthenticatedNav(doc) === true);
  check('client', 'repeated initialization adds no duplicate click listener',
    (hamburger.listeners.bubble.click || []).length === 1);
  clickHamburger();
  check('client', 'after re-init one activation still toggles exactly once', state().open === true);

  // Escape closes and returns focus.
  const focusBefore = hamburger.focused;
  doc.dispatch('keydown', { key: 'Escape' });
  check('client', 'Escape closes the menu and returns focus to the hamburger',
    state().open === false && hamburger.focused === focusBefore + 1);

  // Outside pointer closes without stealing focus; inside pointer does not close.
  clickHamburger();
  doc.dispatch('pointerdown', { target: tabs });
  check('client', 'pointer interaction inside the menu keeps it open', state().open === true);
  const focusBeforeOutside = hamburger.focused;
  doc.dispatch('pointerdown', { target: outside });
  check('client', 'outside pointer interaction closes without stealing focus',
    state().open === false && hamburger.focused === focusBeforeOutside);

  // Tab selection closes through CAPTURE even when the target handler stops
  // propagation (the mobile Edit Profile pattern).
  clickHamburger();
  inner.addEventListener('click', (e) => { e.stopPropagation(); });
  const evt = dispatchClickThrough(tabs, inner);
  check('client', 'selecting a tab closes the menu despite target stopPropagation',
    state().open === false && evt.stopped === true);

  // Media-query change resets to closed.
  clickHamburger();
  check('client', 'a media-query change handler is registered', doc.defaultView.mediaHandlers.length === 1);
  doc.defaultView.mediaHandlers.forEach((fn) => fn({ matches: false }));
  check('client', 'responsive media-query change resets the state to closed', state().open === false);

  // Missing nodes guard.
  const emptyDoc = makeDocument();
  let threw = false;
  let result = null;
  try { result = initAuthenticatedNav(emptyDoc); } catch (e) { threw = true; }
  check('client', 'missing DOM nodes are guarded without throwing', threw === false && result === false);
  check('client', 'invalid document input is guarded without throwing',
    (() => { try { return initAuthenticatedNav(null) === false; } catch (e) { return false; } })());
}

/* ---------------- 3. page-local owners removed ---------------- */
{
  const PAGES = ['views/home.ejs', 'views/dashboard.ejs', 'views/events.ejs',
    'views/map.ejs', 'views/buildings.ejs', 'views/about.ejs'];
  for (const rel of PAGES) {
    const src = read(rel);
    check('owners', `${rel} no longer registers a dashHamburger handler`,
      !src.includes("getElementById('dashHamburger')") && !src.includes('dashHamburger.addEventListener'));
  }
  const profile = read('public/js/profile-script.js');
  check('owners', 'profile-script no longer mutates hamburger/menu classes',
    !profile.includes('dashHamburger') && !profile.includes("dashTabs"));
}

/* ---------------- 4. CSS contracts ---------------- */
{
  const css = read('public/css/styles.css');
  const base = css.slice(css.indexOf('.dash-nav__hamburger {'), css.indexOf('.dash-nav__hamburger span {'));
  check('css', 'hamburger declares at least a 44x44 minimum target',
    /min-width:\s*44px/.test(base) && /min-height:\s*44px/.test(base));
  check('css', 'hamburger centers its bars', /align-items:\s*center/.test(base) && /justify-content:\s*center/.test(base));
  const spanBlock = css.slice(css.indexOf('.dash-nav__hamburger span {'), css.indexOf('}', css.indexOf('.dash-nav__hamburger span {')));
  check('css', 'hamburger bars use explicit transform/opacity transitions (no transition: all)',
    !/transition:\s*all/.test(spanBlock) && /transition:\s*transform[^;]*opacity/.test(spanBlock));
  check('css', 'mobile menu items declare a 44px minimum height',
    /\.dash-nav__tab\s*\{[^}]*min-height:\s*44px/.test(css));
  check('css', 'hamburger and menu items have a visible :focus-visible outline',
    /\.dash-nav__hamburger:focus-visible[\s\S]{0,80}\.dash-nav__tab:focus-visible[\s\S]{0,120}outline:\s*3px solid/.test(css));
  check('css', 'reduced-motion disables the hamburger bar transition',
    /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]{0,200}\.dash-nav__hamburger span\s*\{[\s\S]{0,80}transition:\s*none/.test(css));
}

/* ---------------- 5. brand surfaces + preserved identifiers ---------------- */
{
  const surfaces = [];
  const walkViews = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) walkViews(p);
      else if (name.endsWith('.ejs')) surfaces.push(path.relative(ROOT, p).replace(/\\/g, '/'));
    }
  };
  walkViews(path.join(ROOT, 'views'));
  surfaces.push('public/offline.html', 'public/manifest.webmanifest',
    'public/css/admin-styles.css', 'public/css/styles.css');
  // Controllers supply rendered title/description locals — scan them too.
  for (const name of fs.readdirSync(path.join(ROOT, 'controllers'))) {
    if (name.endsWith('.js')) surfaces.push('controllers/' + name);
  }
  let offenders = 0;
  for (const rel of surfaces) {
    const src = read(rel);
    if (src.includes('CampusSphere') || src.includes('CAMPUSPHERE')) offenders += 1;
  }
  check('brand', `no rendered surface carries CampusSphere/CAMPUSPHERE (${surfaces.length} files scanned)`, offenders === 0);
  check('brand', 'offline shell and manifest stay correctly branded',
    read('public/offline.html').includes('CampuSphere') && read('public/manifest.webmanifest').includes('CampuSphere'));

  const profile = read('public/js/profile-script.js');
  check('brand', 'excluded internal identifiers stay unrenamed (CampuSphereData + campusphere-* keys)',
    profile.includes('CampuSphereData') && profile.includes("'campusphere-role'") &&
    profile.includes("'campusphere-student'") && profile.includes("'campusphere-non-cspc'"));
  const pkg = JSON.parse(read('package.json'));
  check('brand', 'package identifier is untouched', pkg.name === 'campusphere');
}

/* ---------------- summary ---------------- */
if (failures.length === 0) {
  console.log('SHARED-MOBILE-NAVIGATION-PROBE OK: all checks passed.');
  process.exitCode = 0;
} else {
  console.error(`SHARED-MOBILE-NAVIGATION-PROBE FAILED: ${failures.length} check(s) did not pass:`);
  failures.forEach((f) => console.error('  - ' + f));
  process.exitCode = 1;
}
