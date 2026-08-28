'use strict';

/* ========================================
   CampuSphere - Public FAQ focused probe

   DATABASE-FREE and NETWORK-FREE. This probe checks the SSR route, dual
   backend boundary, escaped answer rendering, navigation/admin discoverability,
   online-only PWA boundary, shared light/dark theme wiring, and the real
   client-side search/filter behavior against a minimal mock DOM.
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

const controller = read('controllers/faqController.js');
const routes = read('routes/index.js');
const view = read('views/faq.ejs');
const client = read('public/js/public-faq.js');
const css = read('public/css/faq.css');
const themeToggle = read('views/partials/theme-toggle.ejs');
const publicNav = read('views/partials/navbar.ejs');
const footer = read('views/partials/footer.ejs');
const dashNav = read('views/partials/dash-navbar.ejs');
const navRole = read('public/js/nav-role.js');
const adminView = read('views/admin/faqs.ejs');
const seed = read('database/seed.js');
const serviceWorker = read('public/sw.js');
const offlinePage = read('public/offline.html');
const offlineGuide = read('services/offlineGuideService.js');

console.log('\n[public FAQ] source and pure client contracts');

/* ---------------- server-side route/controller/view contracts ---------------- */
check('route', 'GET /faq is registered on the index router',
    /router\.get\(\s*['"]\/faq['"]\s*,[\s\S]*?faqController\.index\s*\)/.test(routes));
check('route', 'GET /faq is anonymous and not behind requireLogin',
    !/router\.get\(\s*['"]\/faq['"][^\n]*requireLogin/.test(routes));
check('controller', 'controller exposes an index handler and renders the FAQ view',
    /exports\.index\s*=/.test(controller) && /res\.render\('faq'/.test(controller));
check('controller', 'controller branches between Supabase and parameter-free MySQL SELECT',
    controller.includes('contentDataSource.isSupabase()') &&
    controller.includes('siteContentRepository.listFaqs()') &&
    /SELECT id, question, answer, category, display_order FROM faqs ORDER BY display_order ASC, id ASC/.test(controller) &&
    !/FAQ_SELECT\s*=\s*`/.test(controller));
check('controller', 'FAQ read is one bounded ordered query with normalization and no request-data access',
    !/req\.session|req\.body|req\.query|req\.params/.test(controller) &&
    (controller.match(/siteContentRepository\.listFaqs\(\)/g) || []).length === 1 &&
    (controller.match(/db\.query\(/g) || []).length === 1 &&
    controller.includes('displayCategory'));
check('controller', 'public controller fails closed with a no-store 503 state',
    controller.includes('listFaqContent()') && controller.includes("res.set('Cache-Control', 'no-store')") &&
    /status\(503\)\.render\('faq'/.test(controller) && controller.includes('logServerError'));
check('view', 'view includes shared head, authenticated/public chrome, and network-only FAQ assets',
    /include\('partials\/head'\)/.test(view) &&
    /include\('partials\/dash-navbar'/.test(view) && /include\('partials\/navbar'/.test(view) &&
    view.includes('/css/faq.css?v=2') && view.includes('/js/public-faq.js'));
check('view', 'server-rendered native details remain usable without JavaScript',
    view.includes('<details class="faq-item"') && view.includes('<summary class="faq-summary">') &&
    view.includes('data-faq-controls aria-label="FAQ filters" hidden'));
check('view', 'FAQ answer and category output use escaped EJS interpolation only',
    view.includes('<%= faq.answer %>') && view.includes('<%= faq.question %>') &&
    view.includes('<%= faq.displayCategory %>') && !/<%-\s*faq\./.test(view));
check('view', 'filter controls expose labels, status announcements, and an empty-result state',
    view.includes('for="faq-search"') && view.includes('for="faq-category"') &&
    view.includes('role="status" aria-live="polite"') && view.includes('id="faq-filtered-empty"'));
check('view', 'load failure is truthful and does not expose database error details',
    view.includes('FAQs are temporarily unavailable') && !view.includes('<%= error') &&
    !view.includes('<%- error'));
check('view', 'FAQ bootstraps the shared preference before its stylesheet and includes one theme control',
    (view.match(/include\('partials\/theme-toggle'\)/g) || []).length === 1 &&
    view.includes("localStorage.getItem('campussphere-theme')") &&
    view.includes("setAttribute('data-theme', 'dark')") &&
    view.includes("removeAttribute('data-theme')") &&
    view.indexOf("localStorage.getItem('campussphere-theme')") < view.indexOf('/css/faq.css?v=2'));

check('theme', 'shared control uses an explicit accessible button state',
    /<button[^>]+type="button"[^>]+aria-label="[^"]+"[^>]+aria-pressed="false"/.test(themeToggle));
check('theme', 'shared control persists only the light/dark CampuSphere preference',
    themeToggle.includes("const STORAGE_KEY = 'campussphere-theme';") &&
    themeToggle.includes("saved === 'dark' || saved === 'light'") &&
    themeToggle.includes("localStorage.setItem(STORAGE_KEY, theme)"));
check('theme', 'shared control maps dark to data-theme and light to no attribute',
    themeToggle.includes("setAttribute('data-theme', 'dark')") &&
    themeToggle.includes("removeAttribute('data-theme')"));
check('theme', 'shared control synchronizes pressed state and action label',
    themeToggle.includes("toggle.setAttribute('aria-pressed', dark ? 'true' : 'false')") &&
    themeToggle.includes("toggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode')"));
check('theme', 'shared preference storage is fail-safe',
    /try\s*\{[\s\S]*localStorage\.getItem\(STORAGE_KEY\)[\s\S]*catch/.test(themeToggle) &&
    /try\s*\{\s*localStorage\.setItem\(STORAGE_KEY, theme\)[\s\S]*catch/.test(themeToggle));

/* ---------------- navigation/admin/PWA boundaries ---------------- */
check('navigation', 'anonymous navbar and footer link to the real /faq route',
    /href="\/faq"/.test(publicNav) && /href="\/faq"/.test(footer));
check('navigation', 'signed-in navbar offers FAQ on desktop and in the mobile menu',
    (dashNav.match(/href="\/faq"/g) || []).length >= 2 &&
    dashNav.includes('id="tabFaq"') && dashNav.includes('id="tabFaqMobile"'));
check('navigation', 'signed-in FAQ route and top links survive the role allowlist',
    (navRole.match(/'\/faq'/g) || []).length === 4 &&
    (navRole.match(/'tabFaq'/g) || []).length === 4 &&
    (navRole.match(/'tabFaqMobile'/g) || []).length === 4);
check('admin', 'admin page explains save=publish and links to the public FAQ',
    /published on the public FAQ page when saved/i.test(adminView) &&
    adminView.includes('href="/faq"') && adminView.includes('View public FAQ'));
check('seed', 'future MySQL seed uses the explicit downloadable-package offline wording',
    seed.includes('Download the Offline Campus Guide from the signed-in Campus Map while you are online.') &&
    seed.includes('It does not include Guided VR, Free Roam, schedules, or building photos.'));
check('offline', 'FAQ assets and route stay outside the service-worker shell and offline guide',
    !/public-faq|faq\.css|['"]\/faq['"]/.test(serviceWorker) &&
    !/public-faq|faq\.css|['"]\/faq['"]/.test(offlinePage) &&
    !/public-faq|faq\.css|['"]\/faq['"]/.test(offlineGuide));

/* ---------------- client security and accessibility source contracts ---------------- */
check('client', 'CommonJS export and guarded browser initialization are present',
    client.includes('module.exports') && client.includes('typeof document !==') &&
    client.includes('if (!root) return null') && !client.includes('CampuSpherePublicFaq'));
check('client', 'filtering reads textContent and never uses unsafe HTML/eval/navigation sinks',
    client.includes('item.textContent') && client.includes('status.textContent') &&
    !client.includes('innerHTML') && !/\beval\s*\(/.test(client) &&
    !client.includes('document.write') && !client.includes('window.location') &&
    !client.includes('fetch('));
check('client', 'search, category, clear, hidden-state, and result-count behavior are implemented',
    client.includes("search.addEventListener('input'") &&
    client.includes("category.addEventListener('change'") &&
    client.includes("clear.addEventListener('click'") &&
    client.includes('filteredEmpty.hidden') && client.includes('shown`'));
check('client', 'hidden focused answers return focus to the search field',
    client.includes('item.contains(doc.activeElement)') && client.includes('search.focus()'));
check('css', 'controls, summaries, and focus states meet the 44px keyboard/touch contract',
    /\.faq-input,\s*\.faq-select,\s*\.faq-clear\s*\{[\s\S]*?min-height:\s*44px/.test(css) &&
    css.includes('.faq-summary {') && /min-height:\s*44px/.test(css) &&
    css.includes(':focus-visible') && css.includes('outline: 3px solid'));
check('css', 'responsive layout, readable line height, dark mode, and reduced motion are scoped',
    css.includes('@media (min-width: 640px)') && css.includes('white-space: pre-line') &&
    css.includes('[data-theme="dark"] body.faq-page') &&
    css.includes('@media (prefers-reduced-motion: reduce)'));
check('css', 'FAQ page prevents horizontal overflow and uses semantic token fallbacks',
    css.includes('overflow-x: hidden') && css.includes('--faq-page-bg:') &&
    css.includes('--faq-surface:') && css.includes('--faq-text:') &&
    css.includes('--faq-muted:') && css.includes('--faq-border:'));

function relativeLuminance(hex) {
    const channels = hex.replace('#', '').match(/.{2}/g).map((channel) => parseInt(channel, 16) / 255);
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

check('css', 'FAQ light/dark text, borders, and focus colors meet contrast targets',
    css.includes('--faq-control-border: #64748b;') && css.includes('--faq-focus: #9a751a;') &&
    contrastRatio('#f3f4f6', '#1f2537') >= 4.5 &&
    contrastRatio('#cbd5e1', '#1f2537') >= 4.5 &&
    contrastRatio('#64748b', '#111827') >= 3 &&
    contrastRatio('#64748b', '#ffffff') >= 3 &&
    contrastRatio('#9a751a', '#111827') >= 3 &&
    contrastRatio('#9a751a', '#ffffff') >= 3);

/* ---------------- real client behavior with a minimal mock DOM ---------------- */
function makeElement(id, textContent = '') {
    return {
        id,
        hidden: false,
        open: false,
        value: '',
        textContent,
        attrs: {},
        listeners: {},
        parentNode: null,
        focused: 0,
        setAttribute(name, value) { this.attrs[name] = String(value); },
        getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
        addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
        dispatch(type, event = {}) {
            const enriched = Object.assign({ target: this, currentTarget: this }, event);
            (this.listeners[type] || []).slice().forEach((fn) => fn(enriched));
        },
        contains(node) { return node === this || (node && node.parentNode === this); },
        focus() { this.focused += 1; this.ownerDocument.activeElement = this; }
    };
}

function makeFaqDocument() {
    const root = makeElement('faq-root');
    const controls = makeElement('faq-controls');
    const search = makeElement('faq-search');
    const category = makeElement('faq-category');
    const clear = makeElement('faq-clear');
    const status = makeElement('faq-status');
    const filteredEmpty = makeElement('faq-filtered-empty');
    const items = [
        makeElement('faq-a', 'How do I find a building? Campus Map Use search.'),
        makeElement('faq-b', 'How do I start a guided VR route? VR Tour Select a route.')
    ];
    items[0].attrs['data-category'] = 'Campus Map';
    items[1].attrs['data-category'] = 'VR Tour';
    const nodes = {
        '[data-faq-root]': root,
        '[data-faq-controls]': controls,
        '#faq-search': search,
        '#faq-category': category,
        '#faq-clear': clear,
        '#faq-status': status,
        '#faq-filtered-empty': filteredEmpty
    };
    root.ownerDocument = null;
    root.querySelector = (selector) => nodes[selector] || null;
    root.querySelectorAll = (selector) => selector === '[data-faq-item]' ? items : [];
    const doc = {
        activeElement: null,
        querySelector(selector) { return selector === '[data-faq-root]' ? root : null; }
    };
    root.ownerDocument = doc;
    [controls, search, category, clear, status, filteredEmpty, ...items].forEach((node) => { node.ownerDocument = doc; });
    return { doc, root, controls, search, category, clear, status, filteredEmpty, items };
}

{
    const { initPublicFaq } = require('../public/js/public-faq.js');
    const state = makeFaqDocument();
    const instance = initPublicFaq(state.doc);
    check('client', 'initialization succeeds and unhides progressive-enhancement controls',
        !!instance && state.controls.hidden === false && state.status.textContent === '2 questions shown');

    state.search.value = 'guided';
    state.search.dispatch('input');
    check('client', 'text search hides non-matching details and announces one result',
        state.items[0].hidden === true && state.items[1].hidden === false &&
        state.status.textContent === '1 question shown');

    state.search.value = '';
    state.category.value = 'Campus Map';
    state.category.dispatch('change');
    check('client', 'category filter shows only the selected category',
        state.items[0].hidden === false && state.items[1].hidden === true &&
        state.clear.hidden === false);

    state.doc.activeElement = state.items[0];
    state.search.value = 'does-not-exist';
    state.category.value = '';
    state.search.dispatch('input');
    check('client', 'zero matches show the filtered-empty state and restore focus',
        state.items.every((item) => item.hidden === true) && state.filteredEmpty.hidden === false &&
        state.search.focused > 0);

    state.clear.dispatch('click');
    check('client', 'clear restores all details, status, and search focus',
        state.search.value === '' && state.category.value === '' &&
        state.items.every((item) => item.hidden === false) && state.filteredEmpty.hidden === true &&
        state.status.textContent === '2 questions shown' && state.search.focused > 1);

    const empty = { querySelector() { return null; } };
    check('client', 'missing FAQ root is guarded without throwing', initPublicFaq(empty) === null);
    check('client', 'invalid document input is guarded without throwing', initPublicFaq(null) === null);
}

if (failures.length === 0) {
    console.log(`PUBLIC-FAQ-PROBE OK: ${checkCount}/${checkCount}`);
    process.exitCode = 0;
} else {
    console.error(`PUBLIC-FAQ-PROBE FAILED: ${failures.length} check(s) did not pass.`);
    failures.forEach((failure) => console.error(`  - ${failure}`));
    process.exitCode = 1;
}
