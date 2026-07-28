'use strict';

/* ========================================
   CampuSphere - Admin Campus-Map Search & Filter probe
   M12.P1-D4 verification script.

   Four layers, all with fixed sanitized PASS/FAIL labels only — never a
   credential, cookie, token, URL, key, or raw backend error:

     1. PURE unit checks of utils/scheduleSearch.js: the `q` normaliser
        (scalar/trim/blank/length) and the metacharacter encoders for both
        backends, including the asterisk rule.
     2. MOCK-DOM behavioural checks of public/js/admin/admin-schedules.js and
        public/js/admin/admin-map-graph.js: stale-response inversion, abort
        handling, filtered-empty vs empty, selection preservation, live
        counts, and route/node/edge field coverage.
     3. STATIC contract checks of the view, scripts, and CSS.
     4. LIVE HTTP checks against BOTH runtime modes through
        scripts/with-server.js: q parity across every searched column,
        combined filters, bounds, literal metacharacters, list/count
        agreement, appliedFilters, and fail-closed validation.

   Every live fixture uses the unique D4 prefix below and is removed in a
   finally block in both backends.

   Run:  node scripts/adminCampusMapSearchFilter-probe.js
   ======================================== */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const Module = require('module');
const { withServer } = require('./with-server');
const { hasSupabaseConfig } = require('../config/supabase');
const { getRegressionCredentials } = require('./regressionCredentials');
// Shared probe session ownership (scripts/probeSessionLifecycle.js): every
// canonical identity authenticated here is terminated through the real logout
// interface so `npm test` leaves no persisted regression session behind.
const { createProbeSessionTracker } = require('./probeSessionLifecycle');
const S = require('../utils/scheduleSearch');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const RUN_ID = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
const PREFIX = ('D4_PROBE_' + RUN_ID).slice(0, 60);
// Counting checks run in a DEDICATED far-future single-day window so a
// concurrent probe, browser driver, or real schedule can never drift the
// expected totals. The default-window assertions below still use today.
const FIXTURE_DATE = '2098-06-15';

const failures = [];
function check(scope, label, ok) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!ok) failures.push(`${scope} :: ${label}`);
}

/* ============================================================
   1. PURE: query normalisation + metacharacter encoders
============================================================ */
function runPureChecks() {
  console.log('\n[pure] search normalisation + encoders');

  // --- normalizeSearchQuery ---
  check('pure', 'absent q means no search',
    S.normalizeSearchQuery(undefined).value === null && S.normalizeSearchQuery(null).value === null);
  check('pure', 'blank and whitespace-only q mean no search',
    S.normalizeSearchQuery('').value === null && S.normalizeSearchQuery('   ').value === null &&
    S.normalizeSearchQuery('\t\n ').value === null);
  check('pure', 'q is trimmed', S.normalizeSearchQuery('  Room 204  ').value === 'Room 204');
  check('pure', `exactly ${S.SEARCH_MAX} characters is accepted`,
    S.normalizeSearchQuery('a'.repeat(S.SEARCH_MAX)).ok === true);
  check('pure', `${S.SEARCH_MAX + 1} characters is rejected with the fixed message`,
    S.normalizeSearchQuery('a'.repeat(S.SEARCH_MAX + 1)).ok === false &&
    S.normalizeSearchQuery('a'.repeat(S.SEARCH_MAX + 1)).message === S.SEARCH_TOO_LONG_MESSAGE);
  check('pure', 'length is measured AFTER trimming',
    S.normalizeSearchQuery('  ' + 'a'.repeat(S.SEARCH_MAX) + '  ').ok === true);
  check('pure', 'a repeated/array q is rejected (non-scalar)',
    S.normalizeSearchQuery(['a', 'b']).ok === false &&
    S.normalizeSearchQuery(['a', 'b']).message === S.SEARCH_INVALID_MESSAGE);
  check('pure', 'an object q is rejected (non-scalar)',
    S.normalizeSearchQuery({ x: '1' }).ok === false &&
    S.normalizeSearchQuery({ x: '1' }).message === S.SEARCH_INVALID_MESSAGE);
  check('pure', 'a numeric/boolean q is rejected (string only)',
    S.normalizeSearchQuery(12).ok === false && S.normalizeSearchQuery(true).ok === false);
  check('pure', 'rejection messages never echo the submitted value',
    S.normalizeSearchQuery('SECRETVALUE'.repeat(20)).message.indexOf('SECRET') === -1);

  // --- MySQL encoder ---
  check('pure', 'MySQL escapes the LIKE metacharacters \\ % _',
    S.escapeMysqlLikeLiteral('a%b_c\\d') === 'a\\%b\\_c\\\\d');
  check('pure', 'MySQL pattern is a lowercased contains-pattern',
    S.mysqlLikePattern('RoOm') === '%room%');
  check('pure', 'MySQL pattern keeps escapes while lowercasing',
    S.mysqlLikePattern('A%B_C') === '%a\\%b\\_c%');
  check('pure', 'MySQL leaves the asterisk alone (ordinary character in SQL LIKE)',
    S.escapeMysqlLikeLiteral('a*b') === 'a*b');

  // --- PostgREST encoder ---
  check('pure', 'PostgREST escapes \\ % _ at the LIKE layer',
    S.escapePostgrestLikeLiteral('a%b_c\\d') === 'a\\%b\\_c\\\\d');
  check('pure', 'PostgREST maps the asterisk to the single-character wildcard',
    S.escapePostgrestLikeLiteral('a*b') === 'a_b');
  check('pure', 'a user underscore is escaped BEFORE the asterisk becomes a wildcard',
    S.escapePostgrestLikeLiteral('_*') === '\\__');
  check('pure', 'asterisk queries are flagged for exact narrowing',
    S.searchNeedsExactPostFilter('a*b') === true && S.searchNeedsExactPostFilter('ab') === false);
  check('pure', 'quoted values escape backslashes and double quotes',
    S.postgrestQuoteValue('a"b\\c') === '"a\\"b\\\\c"');
  check('pure', 'the or() value is double-quoted and doubly escaped',
    S.supabaseOrIlikeValue('50%') === '"%50\\\\%%"');

  // --- or() expression construction ---
  const expr = S.supabaseScheduleOrExpression('zz', []);
  check('pure', 'or() covers title, location_label, floor_label, description',
    expr.indexOf('title.ilike.') === 0 &&
    expr.indexOf('location_label.ilike.') !== -1 &&
    expr.indexOf('floor_label.ilike.') !== -1 &&
    expr.indexOf('description.ilike.') !== -1);
  check('pure', 'or() omits the building disjunct when no building name matched',
    expr.indexOf('building_id.in.') === -1);
  check('pure', 'or() adds only server-produced integer building ids',
    S.supabaseScheduleOrExpression('zz', [3, 7]).indexOf('building_id.in.(3,7)') !== -1);
  check('pure', 'or() drops non-integer building ids',
    S.supabaseScheduleOrExpression('zz', [1, 'x', -2, 0, null]).indexOf('building_id.in.(1)') !== -1);

  // --- injection containment ---
  const breakout = 'zzz",id.gte."0';
  const encoded = S.supabaseScheduleOrExpression(breakout, []);
  const disjuncts = encoded.split('.ilike.').length - 1;
  check('pure', 'a crafted breakout value cannot add a disjunct', disjuncts === 4);
  check('pure', 'a crafted breakout value stays inside its quotes',
    encoded.indexOf('id.gte') !== -1 && encoded.indexOf('\\"') !== -1 &&
    encoded.indexOf('",id.gte."0') === -1);
  for (const ch of ['%', '_', ',', '(', ')', '"', '\\', '*', '.', ':']) {
    const v = S.supabaseOrIlikeValue('a' + ch + 'b');
    const balanced = v.charAt(0) === '"' && v.charAt(v.length - 1) === '"';
    // Any interior double quote must be backslash-escaped.
    let unescaped = 0;
    for (let i = 1; i < v.length - 1; i++) {
      if (v.charAt(i) === '"' && v.charAt(i - 1) !== '\\') unescaped += 1;
    }
    check('pure', `literal ${JSON.stringify(ch)} stays inside the quoted value`,
      balanced && unescaped === 0);
  }

  // --- exact match semantics (the single definition of search truth) ---
  const row = {
    title: 'Org Meeting', building_name: 'Library Building', location_label: 'Room 204',
    floor_label: '2nd Floor', description: 'Weekly sync',
  };
  check('pure', 'exact predicate matches each searched field',
    S.matchesScheduleSearch(row, 'org') && S.matchesScheduleSearch(row, 'library') &&
    S.matchesScheduleSearch(row, '204') && S.matchesScheduleSearch(row, '2nd') &&
    S.matchesScheduleSearch(row, 'weekly'));
  check('pure', 'exact predicate is case-insensitive', S.matchesScheduleSearch(row, 'ORG MEETING'));
  check('pure', 'exact predicate rejects a non-substring', !S.matchesScheduleSearch(row, 'gymnasium'));
  check('pure', 'exact predicate treats % and _ literally',
    !S.matchesScheduleSearch(row, '%') && !S.matchesScheduleSearch(row, 'Room_204') &&
    S.matchesScheduleSearch({ title: 'a_b' }, '_'));
  check('pure', 'exact predicate tolerates null fields',
    S.matchesScheduleSearch({ title: 'x', floor_label: null, description: undefined }, 'x'));
  check('pure', 'exact predicate ignores unsearched fields',
    !S.matchesScheduleSearch({ title: 'x', audience: 'instructor' }, 'instructor'));
}

/* ============================================================
   2. MOCK DOM
============================================================ */
function makeElement(id) {
  const el = {
    id, value: '', className: '', hidden: false, disabled: false,
    style: {}, attrs: {}, dataset: {}, children: [], listeners: {}, focusCount: 0,
    _text: '',
    // Assigning textContent replaces all children, exactly as the DOM does —
    // the clients rely on `list.textContent = ''` to empty a container.
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v === undefined || v === null ? '' : v); this.children.length = 0; },
    get firstChild() { return this.children.length ? this.children[0] : null; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    removeEventListener() {},
    appendChild(child) { this.children.push(child); return child; },
    removeChild(child) {
      const i = this.children.indexOf(child);
      if (i !== -1) this.children.splice(i, 1);
      return child;
    },
    remove() {},
    focus() { this.focusCount += 1; },
    reset() {},
    contains() { return false; },
    querySelector() { return makeElement(id + '-child'); },
    querySelectorAll() { return []; },
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    dispatch(type, event) { (this.listeners[type] || []).forEach((fn) => fn(event || {})); },
    get options() {
      const kids = this.children;
      return { length: kids.length, item: (i) => kids[i] };
    },
    remove_(i) { this.children.splice(i, 1); },
  };
  // <select>.remove(index) removes an option
  el.remove = function (i) { if (typeof i === 'number') this.children.splice(i, 1); };
  return el;
}

function makeDocument(seed) {
  const registry = {};
  const doc = {
    listeners: {},
    getElementById(id) {
      if (!Object.prototype.hasOwnProperty.call(registry, id)) registry[id] = makeElement(id);
      return registry[id];
    },
    createElement(tag) { return makeElement('created-' + tag); },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    // Real dispatch: registered listeners actually run, so a custom event such
    // as campusphere:buildings-changed exercises the production listener
    // instead of a stub that silently passes.
    dispatchEvent(evt) {
      const type = evt && evt.type;
      (this.listeners[type] || []).forEach((fn) => fn(evt));
      return true;
    },
    body: makeElement('body'),
    get registry() { return registry; },
  };
  Object.keys(seed || {}).forEach((id) => {
    const el = doc.getElementById(id);
    Object.assign(el, seed[id]);
  });
  return doc;
}

// Load an admin client script with a mock document/fetch and fire DOMContentLoaded.
function loadAdminScript(relPath, doc, fetchImpl) {
  const src = read(relPath);
  const prevDoc = global.document;
  const prevFetch = global.fetch;
  const prevCustomEvent = global.CustomEvent;
  const prevWindow = global.window;
  global.document = doc;
  global.fetch = fetchImpl;
  global.CustomEvent = function (t, o) { return Object.assign({ type: t }, o || {}); };
  // The graph client feature-detects the Lucide icon CDN and reads location.
  global.window = { lucide: null, location: { href: '' } };
  try {
    const m = new Module(relPath, null);
    m._compile(src, path.join(ROOT, relPath));
  } finally {
    global.document = prevDoc;
    global.fetch = prevFetch;
    global.CustomEvent = prevCustomEvent;
    global.window = prevWindow;
  }
  const fire = () => (doc.listeners.DOMContentLoaded || []).forEach((fn) => fn({}));
  return { fire };
}

function jsonResponse(payload, status) {
  return { status: status || 200, json: async () => payload, headers: { get: () => null } };
}

function scheduleRow(over) {
  return Object.assign({
    id: 1, title: 'T', schedule_date: '2026-07-20', start_time: '08:00', end_time: '09:00',
    audience: 'all', status: 'scheduled', building_id: 1, building_name: 'B',
    location_type: 'room', location_label: 'L', floor_label: 'F', description: 'D',
  }, over || {});
}

function runScheduleClientChecks() {
  console.log('\n[client-schedules] stale-response, abort, states, selection');

  const buildings = [{ id: 1, name: 'Library Building' }, { id: 2, name: 'Gymnasium' }, { id: 3, name: 'Green Building' }];
  const doc = makeDocument({ 'buildings-data-json': { textContent: JSON.stringify(buildings) } });

  const pending = [];
  const fetchImpl = (url, opts) => new Promise((resolve, reject) => {
    pending.push({ url: String(url), opts: opts || {}, resolve, reject });
  });

  const { fire } = loadAdminScript('public/js/admin/admin-schedules.js', doc, fetchImpl);
  const prevDoc = global.document;
  const prevFetch = global.fetch;
  global.document = doc;
  global.fetch = fetchImpl;
  try {
    fire(); // initial load fires request #0
    check('client-schedules', 'initial load issues one list request', pending.length === 1);

    const applyBtn = doc.getElementById('schedule-apply-filters');
    const statusEl = doc.getElementById('schedule-result-status');
    const listEl = doc.getElementById('schedule-list');
    const searchEl = doc.getElementById('schedule-search');

    // Settle the initial request so the inversion test starts clean.
    pending[0].resolve(jsonResponse({
      success: true, schedules: [scheduleRow({ id: 9, title: 'Initial' })], total: 1,
      appliedFilters: { q: null, buildingId: null, from: '2026-07-20', to: '2026-08-03', audience: null, status: null, limit: 50, offset: 0 },
    }));
    return { doc, pending, applyBtn, statusEl, listEl, searchEl };
  } finally {
    global.document = prevDoc;
    global.fetch = prevFetch;
  }
}

async function runScheduleClientAsyncChecks(ctx) {
  const { doc, pending, applyBtn, statusEl, listEl, searchEl } = ctx;
  const prevDoc = global.document;
  const prevFetch = global.fetch;
  global.document = doc;
  global.fetch = (url, opts) => new Promise((resolve, reject) => {
    pending.push({ url: String(url), opts: opts || {}, resolve, reject });
  });
  const settle = () => new Promise((r) => setImmediate(r));
  try {
    await settle();
    check('client-schedules', 'applied window is echoed into the date inputs',
      doc.getElementById('schedule-filter-from').value === '2026-07-20' &&
      doc.getElementById('schedule-filter-to').value === '2026-08-03');
    check('client-schedules', 'result status reports count and applied window',
      /Showing 1 of 1 schedule/.test(statusEl.textContent) && /July 20/.test(statusEl.textContent));

    // ---- stale-response inversion: A then B, B resolves FIRST, A resolves late ----
    const before = pending.length;
    searchEl.value = 'alpha';
    applyBtn.dispatch('click');           // request A
    await settle();
    searchEl.value = 'beta';
    applyBtn.dispatch('click');           // request B (supersedes A)
    await settle();
    check('client-schedules', 'two distinct list requests were issued', pending.length === before + 2);
    const reqA = pending[before];
    const reqB = pending[before + 1];
    check('client-schedules', 'each request carries its own q', /q=alpha/.test(reqA.url) && /q=beta/.test(reqB.url));
    check('client-schedules', 'the superseded request was aborted',
      !!(reqA.opts.signal && reqA.opts.signal.aborted === true));

    reqB.resolve(jsonResponse({
      success: true, schedules: [scheduleRow({ id: 2, title: 'BETA-ROW' })], total: 1,
      appliedFilters: { q: 'beta', buildingId: null, from: '2026-07-20', to: '2026-08-03', audience: null, status: null, limit: 50, offset: 0 },
    }));
    await settle();
    // A now answers LATE with different data; it must be ignored entirely.
    reqA.resolve(jsonResponse({
      success: true, schedules: [scheduleRow({ id: 3, title: 'ALPHA-STALE' }), scheduleRow({ id: 4 })], total: 2,
      appliedFilters: { q: 'alpha', buildingId: null, from: '2000-01-01', to: '2000-01-15', audience: null, status: null, limit: 50, offset: 0 },
    }));
    await settle();

    const renderedText = JSON.stringify(listEl.children.map((c) => JSON.stringify(c)));
    check('client-schedules', 'only the newest response renders (stale response dropped)',
      listEl.children.length === 1 && renderedText.indexOf('ALPHA-STALE') === -1);
    check('client-schedules', 'stale response cannot overwrite the result count',
      /Showing 1 of 1 schedule/.test(statusEl.textContent));
    check('client-schedules', 'stale response cannot overwrite the applied window',
      doc.getElementById('schedule-filter-from').value === '2026-07-20');

    // ---- an aborted request must never show an error ----
    const beforeAbort = pending.length;
    applyBtn.dispatch('click');
    await settle();
    applyBtn.dispatch('click');
    await settle();
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    pending[beforeAbort].reject(abortErr);
    await settle();
    check('client-schedules', 'an AbortError does not display an error state',
      doc.getElementById('schedule-error').hidden === true);
    pending[beforeAbort + 1].resolve(jsonResponse({
      success: true, schedules: [], total: 0,
      appliedFilters: { q: 'beta', buildingId: null, from: '2026-07-20', to: '2026-08-03', audience: null, status: null, limit: 50, offset: 0 },
    }));
    await settle();
    check('client-schedules', 'zero rows WITH an active filter shows filtered-empty',
      doc.getElementById('schedule-filtered-empty').hidden === false &&
      doc.getElementById('schedule-empty').hidden === true);

    // ---- zero rows with NO filters is the plain empty state ----
    const beforeEmpty = pending.length;
    searchEl.value = '';
    applyBtn.dispatch('click');
    await settle();
    pending[beforeEmpty].resolve(jsonResponse({
      success: true, schedules: [], total: 0,
      appliedFilters: { q: null, buildingId: null, from: '2026-07-20', to: '2026-08-03', audience: null, status: null, limit: 50, offset: 0 },
    }));
    await settle();
    check('client-schedules', 'zero rows with NO filters shows the unfiltered empty state',
      doc.getElementById('schedule-empty').hidden === false &&
      doc.getElementById('schedule-filtered-empty').hidden === true);

    // ---- sanitized inline error keeps filters intact, and Retry re-requests ----
    const beforeErr = pending.length;
    searchEl.value = 'x'.repeat(101);
    applyBtn.dispatch('click');
    await settle();
    pending[beforeErr].resolve(jsonResponse({ success: false, message: S.SEARCH_TOO_LONG_MESSAGE }, 400));
    await settle();
    check('client-schedules', 'a 400 shows the sanitized server message inline',
      doc.getElementById('schedule-error').hidden === false &&
      doc.getElementById('schedule-error-text').textContent === S.SEARCH_TOO_LONG_MESSAGE);
    check('client-schedules', 'filters are preserved after an error', searchEl.value === 'x'.repeat(101));
    const beforeRetry = pending.length;
    doc.getElementById('schedule-retry').dispatch('click');
    await settle();
    check('client-schedules', 'Retry issues a new request', pending.length === beforeRetry + 1);

    // ---- Apply is disabled with truthful aria-busy while in flight ----
    check('client-schedules', 'Apply is disabled and aria-busy while a request is current',
      applyBtn.disabled === true && applyBtn.getAttribute('aria-busy') === 'true');
    pending[pending.length - 1].resolve(jsonResponse({
      success: true, schedules: [], total: 0,
      appliedFilters: { q: null, buildingId: null, from: '2026-07-20', to: '2026-08-03', audience: null, status: null, limit: 50, offset: 0 },
    }));
    await settle();
    check('client-schedules', 'Apply is re-enabled and aria-busy false once settled',
      applyBtn.disabled === false && applyBtn.getAttribute('aria-busy') === 'false');

    // ---- a bounded-search 422 behaves exactly like the other sanitized
    //      non-200s: fixed inline message, filters intact, Retry works ----
    const LIMIT_MESSAGE = 'Schedule search is too broad. Narrow the date range or search text and try again.';
    const before422 = pending.length;
    searchEl.value = 'a*b';
    applyBtn.dispatch('click');
    await settle();
    pending[before422].resolve(jsonResponse({ success: false, message: LIMIT_MESSAGE }, 422));
    await settle();
    check('client-schedules', 'a 422 bounded-search refusal shows its fixed message inline',
      doc.getElementById('schedule-error').hidden === false &&
      doc.getElementById('schedule-error-text').textContent === LIMIT_MESSAGE);
    check('client-schedules', 'the 422 preserves the filters that caused it', searchEl.value === 'a*b');
    check('client-schedules', 'the 422 is also announced through the live region',
      statusEl.textContent === LIMIT_MESSAGE);
    check('client-schedules', 'Apply is re-enabled after a 422',
      applyBtn.disabled === false && applyBtn.getAttribute('aria-busy') === 'false');
    const beforeRetry422 = pending.length;
    doc.getElementById('schedule-retry').dispatch('click');
    await settle();
    check('client-schedules', 'Retry after a 422 reissues the same filtered request',
      pending.length === beforeRetry422 + 1 && /q=a\*b/.test(pending[beforeRetry422].url));
    pending[pending.length - 1].resolve(jsonResponse({
      success: true, schedules: [], total: 0,
      appliedFilters: { q: 'a*b', buildingId: null, from: '2026-07-20', to: '2026-08-03', audience: null, status: null, limit: 50, offset: 0 },
    }));
    await settle();
    check('client-schedules', 'a successful retry clears the error state',
      doc.getElementById('schedule-error').hidden === true);
    searchEl.value = '';

    // ---- Clear resets every filter and reloads ----
    searchEl.value = 'zzz';
    doc.getElementById('schedule-filter-building').value = '2';
    doc.getElementById('schedule-filter-audience').value = 'instructor';
    doc.getElementById('schedule-filter-status').value = 'cancelled';
    const beforeClear = pending.length;
    doc.getElementById('schedule-clear-filters').dispatch('click');
    await settle();
    check('client-schedules', 'Clear resets q, building, dates, audience and status',
      searchEl.value === '' && doc.getElementById('schedule-filter-building').value === '' &&
      doc.getElementById('schedule-filter-from').value === '' && doc.getElementById('schedule-filter-to').value === '' &&
      doc.getElementById('schedule-filter-audience').value === '' &&
      doc.getElementById('schedule-filter-status').value === '');
    check('client-schedules', 'Clear reloads the default window',
      pending.length === beforeClear + 1 && !/q=/.test(pending[beforeClear].url));
    pending[pending.length - 1].resolve(jsonResponse({
      success: true, schedules: [], total: 0,
      appliedFilters: { q: null, buildingId: null, from: '2026-07-20', to: '2026-08-03', audience: null, status: null, limit: 50, offset: 0 },
    }));
    await settle();

    // ---- Enter applies; typing alone never calls the server ----
    const beforeType = pending.length;
    searchEl.value = 'library';
    searchEl.dispatch('input', { target: searchEl });
    await settle();
    check('client-schedules', 'typing in the search box issues no request', pending.length === beforeType);
    searchEl.dispatch('keydown', { key: 'a', preventDefault() {} });
    await settle();
    check('client-schedules', 'a non-Enter key issues no request', pending.length === beforeType);
    searchEl.dispatch('keydown', { key: 'Enter', preventDefault() {} });
    await settle();
    check('client-schedules', 'Enter applies the search', pending.length === beforeType + 1 && /q=library/.test(pending[beforeType].url));
    pending[pending.length - 1].resolve(jsonResponse({
      success: true, schedules: [], total: 0,
      appliedFilters: { q: 'library', buildingId: null, from: '2026-07-20', to: '2026-08-03', audience: null, status: null, limit: 50, offset: 0 },
    }));
    await settle();

    // ---- modal building selector keeps its selection while filtering ----
    const buildingSelect = doc.getElementById('schedule-building');
    const buildingSearch = doc.getElementById('schedule-building-search');
    const countEl = doc.getElementById('schedule-building-count');
    doc.getElementById('add-schedule-btn').dispatch('click');
    await settle();
    check('client-schedules', 'Add Schedule resets the building search',
      buildingSearch.value === '' && /Showing 3 of 3 buildings/.test(countEl.textContent));
    buildingSelect.value = '2'; // Gymnasium
    buildingSearch.value = 'green';
    buildingSearch.dispatch('input', { target: buildingSearch });
    await settle();
    check('client-schedules', 'filtering the building list keeps the current selection',
      buildingSelect.value === '2');
    check('client-schedules', 'building count reflects matches only',
      /Showing 1 of 3 buildings/.test(countEl.textContent));
    const values = buildingSelect.children.map((o) => o.value);
    check('client-schedules', 'a non-matching selected option is still rendered',
      values.indexOf('2') !== -1 && values.indexOf('3') !== -1 && values.indexOf('1') === -1);
    check('client-schedules', 'options are rendered with textContent only',
      buildingSelect.children.every((o) => typeof o.textContent === 'string' && o.innerHTML === undefined));
  } finally {
    global.document = prevDoc;
    global.fetch = prevFetch;
  }
}

async function runGraphClientChecks() {
  console.log('\n[client-graph] route/node/edge field coverage, counts, states');

  const buildings = [{ id: 5, name: 'Engineering Building' }];
  const doc = makeDocument({
    'graph-card': {},
    'buildings-data-json': { textContent: JSON.stringify(buildings) },
    // Named form controls, as a real <form> exposes them.
    'edge-from': { children: [makeElement('edge-from-placeholder')] },
    'edge-to': { children: [makeElement('edge-to-placeholder')] },
    'edge-form': {
      is_accessible: { checked: false }, distance_meters: { value: '' },
      walk_time_seconds: { value: '' }, path_label: { value: '' },
      from_node_id: { value: '' }, to_node_id: { value: '' },
    },
  });
  const routes = [{ id: 11, title: 'Gate to Library', start_label: 'Main Gate', destination_name: 'Library Building', estimated_walk_time: '7 minutes', destination_building_id: 4 }];
  const nodes = [
    { id: 21, node_key: 'main-gate', label: 'Guard House', node_type: 'gate', building_id: null, lat: 1, lng: 2, display_order: 1 },
    { id: 22, node_key: 'eng', label: 'Engineering', node_type: 'building', building_id: 5, lat: 1, lng: 2, display_order: 2 },
  ];
  const edges = [{ id: 31, from_node_id: 21, to_node_id: 22, from_node_key: 'main-gate', from_label: 'Guard House', to_node_key: 'eng', to_label: 'Engineering', distance_meters: 137, walk_time_seconds: 95, path_label: 'North walk', is_accessible: 1 }];

  const routeFor = (url) => {
    if (url.indexOf('/admin/api/routes') === 0) return { success: true, routes, total: routes.length };
    if (url.indexOf('/admin/api/route-nodes') === 0) return { success: true, nodes, total: nodes.length };
    if (url.indexOf('/admin/api/route-edges') === 0) return { success: true, edges, total: edges.length };
    return { success: true };
  };
  const fetchImpl = async (url) => jsonResponse(routeFor(String(url)));

  const { fire } = loadAdminScript('public/js/admin/admin-map-graph.js', doc, fetchImpl);
  const prevDoc = global.document;
  const prevFetch = global.fetch;
  const prevWindow = global.window;
  global.document = doc;
  global.fetch = fetchImpl;
  global.window = { lucide: null, location: { href: '' } };
  const settle = () => new Promise((r) => setImmediate(r));
  try {
    fire();
    await settle(); await settle(); await settle();

    // Routes: title / start_label / destination_name / walk time / id
    const routeSearch = doc.getElementById('route-search');
    const routeStatus = doc.getElementById('route-result-status');
    const routeFilteredEmpty = doc.getElementById('route-filtered-empty');
    check('client-graph', 'routes render with a live count',
      /Showing 1 of 1 route/.test(routeStatus.textContent));
    const routeTerms = [['title', 'gate to library'], ['start_label', 'main gate'],
      ['destination_name', 'library building'], ['estimated_walk_time', '7 minutes'], ['id', '11']];
    for (const [field, term] of routeTerms) {
      routeSearch.value = term;
      routeSearch.dispatch('input', { target: routeSearch });
      check('client-graph', `route search matches ${field}`,
        /Showing 1 of 1 route/.test(routeStatus.textContent) && routeFilteredEmpty.hidden === true);
    }
    routeSearch.value = 'no-such-route-zzz';
    routeSearch.dispatch('input', { target: routeSearch });
    check('client-graph', 'route no-match shows filtered-empty with a 0-of-N count',
      routeFilteredEmpty.hidden === false && /Showing 0 of 1 route/.test(routeStatus.textContent));
    routeSearch.value = '';
    routeSearch.dispatch('input', { target: routeSearch });
    check('client-graph', 'clearing the route search restores every row',
      routeFilteredEmpty.hidden === true && /Showing 1 of 1 route/.test(routeStatus.textContent));

    // Nodes: node_key / label / node_type / linked building NAME / id
    doc.getElementById('node-list');
    const nodeSearch = doc.getElementById('node-search');
    const nodeStatus = doc.getElementById('node-result-status');
    // Switch to the nodes tab is not needed: the search re-renders directly,
    // but the entity must be loaded first.
    const nodeTerms = [['node_key', 'main-gate', 1], ['label', 'guard house', 1],
      ['node_type', 'gate', 1], ['linked building name', 'engineering building', 1], ['id', '22', 1]];
    // Load nodes by firing the nodes tab load path through the retry button.
    doc.getElementById('node-retry').dispatch('click');
    await settle(); await settle();
    for (const [field, term, expected] of nodeTerms) {
      nodeSearch.value = term;
      nodeSearch.dispatch('input', { target: nodeSearch });
      check('client-graph', `node search matches ${field}`,
        new RegExp('Showing ' + expected + ' of 2 nodes').test(nodeStatus.textContent));
    }
    nodeSearch.value = '';
    nodeSearch.dispatch('input', { target: nodeSearch });

    // Edges: keys, labels, path label, distance, walk time, accessibility, id
    doc.getElementById('edge-retry').dispatch('click');
    await settle(); await settle();
    const edgeSearch = doc.getElementById('edge-search');
    const edgeStatus = doc.getElementById('edge-result-status');
    const edgeTerms = [['from_node_key', 'main-gate'], ['from_label', 'guard house'],
      ['to_node_key', 'eng'], ['to_label', 'engineering'], ['path_label', 'north walk'],
      ['distance_meters', '137'], ['walk_time_seconds', '95'],
      ['accessibility text', 'accessible'], ['id', '31']];
    for (const [field, term] of edgeTerms) {
      edgeSearch.value = term;
      edgeSearch.dispatch('input', { target: edgeSearch });
      check('client-graph', `edge search matches ${field}`,
        /Showing 1 of 1 edge/.test(edgeStatus.textContent));
    }
    edgeSearch.value = 'zzz-no-edge';
    edgeSearch.dispatch('input', { target: edgeSearch });
    check('client-graph', 'edge no-match shows filtered-empty',
      doc.getElementById('edge-filtered-empty').hidden === false);
    edgeSearch.value = '';
    edgeSearch.dispatch('input', { target: edgeSearch });
    check('client-graph', 'clearing the edge search restores every row',
      doc.getElementById('edge-filtered-empty').hidden === true);

    // Add Edge: endpoint searches filter independently and keep selections.
    doc.getElementById('add-edge-btn').dispatch('click');
    await settle(); await settle();
    const fromSel = doc.getElementById('edge-from');
    const toSel = doc.getElementById('edge-to');
    const fromSearch = doc.getElementById('edge-from-search');
    const toSearch = doc.getElementById('edge-to-search');
    check('client-graph', 'Add Edge resets both endpoint searches',
      fromSearch.value === '' && toSearch.value === '' && fromSearch.disabled === false);
    fromSel.value = '21';
    toSel.value = '22';
    fromSearch.value = 'eng';
    fromSearch.dispatch('input', { target: fromSearch });
    check('client-graph', 'the From search keeps its own selection while filtering', fromSel.value === '21');
    check('client-graph', 'the From search leaves the To select untouched',
      toSel.value === '22' && toSel.children.length === 3);
    check('client-graph', 'the From count reports matches of the total',
      /Showing 1 of 2 nodes/.test(doc.getElementById('edge-from-count').textContent));
    toSearch.value = 'main';
    toSearch.dispatch('input', { target: toSearch });
    check('client-graph', 'the To search filters independently and keeps its selection',
      toSel.value === '22' && /Showing 1 of 2 nodes/.test(doc.getElementById('edge-to-count').textContent));
  } finally {
    global.document = prevDoc;
    global.fetch = prevFetch;
    global.window = prevWindow;
  }
}

/* ============================================================
   2b. SAME-PAGE BUILDING REFRESH (M12.P1-D4 corrective)
   Drives the REAL campusphere:buildings-changed listener in
   admin-schedules.js through the mock DOM.
============================================================ */
async function runBuildingRefreshChecks() {
  console.log('\n[client-refresh] campusphere:buildings-changed handling');

  const initial = [
    { id: 1, name: 'Library Building' },
    { id: 2, name: 'Gymnasium' },
    { id: 3, name: 'Doomed Hall' },
  ];
  const doc = makeDocument({ 'buildings-data-json': { textContent: JSON.stringify(initial) } });

  // Scripted responses per URL; each entry may resolve or reject.
  const calls = [];
  let buildingsResponder = null;
  const fetchImpl = (url, opts) => {
    const u = String(url);
    calls.push({ url: u, opts: opts || {} });
    if (u.indexOf('/admin/api/buildings') !== -1) {
      return buildingsResponder(u, opts || {});
    }
    return Promise.resolve(jsonResponse({
      success: true, schedules: [], total: 0,
      appliedFilters: { q: null, buildingId: null, from: '2026-07-20', to: '2026-08-03', audience: null, status: null, limit: 50, offset: 0 },
    }));
  };

  const { fire } = loadAdminScript('public/js/admin/admin-schedules.js', doc, fetchImpl);
  const prevDoc = global.document;
  const prevFetch = global.fetch;
  const prevCE = global.CustomEvent;
  global.document = doc;
  global.fetch = fetchImpl;
  global.CustomEvent = function (t, o) { return Object.assign({ type: t }, o || {}); };
  const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };
  const dispatchChanged = () => doc.dispatchEvent(new global.CustomEvent('campusphere:buildings-changed'));
  const urls = () => calls.map((c) => c.url);

  try {
    buildingsResponder = () => Promise.resolve(jsonResponse({ success: true, buildings: initial }));
    fire();
    await settle();

    const filterSel = doc.getElementById('schedule-filter-building');
    const modalSel = doc.getElementById('schedule-building');
    const searchInput = doc.getElementById('schedule-building-search');
    const countEl = doc.getElementById('schedule-building-count');
    const toast = doc.getElementById('admin-toast');

    check('client-refresh', 'a listener for campusphere:buildings-changed is registered',
      (doc.listeners['campusphere:buildings-changed'] || []).length === 1);

    // ---- happy path: rename + add, selections and search text survive ----
    filterSel.value = '2';           // Gymnasium
    modalSel.value = '1';            // Library Building
    searchInput.value = 'build';     // active modal search text
    const renamedAndAdded = [
      { id: 1, name: 'Library Building (Renamed)' },
      { id: 2, name: 'Gymnasium' },
      { id: 4, name: 'Brand New Building' },
    ];
    buildingsResponder = () => Promise.resolve(jsonResponse({ success: true, buildings: renamedAndAdded }));
    const before = calls.length;
    dispatchChanged();
    await settle();

    const issued = urls().slice(before);
    check('client-refresh', 'the event issues GET /admin/api/buildings',
      issued.some((u) => u.indexOf('/admin/api/buildings') !== -1));
    check('client-refresh', 'the refresh request is same-origin and asks for JSON',
      (() => {
        const c = calls.slice(before).find((x) => x.url.indexOf('/admin/api/buildings') !== -1);
        return !!c && c.opts.credentials === 'same-origin' &&
          !!c.opts.headers && c.opts.headers.Accept === 'application/json';
      })());
    check('client-refresh', 'the schedule list reruns exactly once after a successful refresh',
      issued.filter((u) => u.indexOf('/admin/api/schedules') !== -1).length === 1);
    check('client-refresh', 'a valid filter selection survives by id', filterSel.value === '2');
    check('client-refresh', 'a valid modal selection survives by id', modalSel.value === '1');
    check('client-refresh', 'the modal building-search text is not reset', searchInput.value === 'build');
    check('client-refresh', 'a renamed building shows its new label',
      modalSel.children.some((o) => o.value === '1' && o.textContent === 'Library Building (Renamed)'));
    check('client-refresh', 'a newly created building appears in both selectors',
      modalSel.children.some((o) => o.value === '4') && filterSel.children.some((o) => o.value === '4'));
    check('client-refresh', 'the refreshed selectors stay in name order',
      (() => {
        const names = filterSel.children.slice(1).map((o) => o.textContent);
        return names.join('|') === names.slice().sort((a, b) => a.localeCompare(b)).join('|');
      })());
    check('client-refresh', 'the live building count reflects the refreshed list',
      /of 3 buildings/.test(countEl.textContent));
    check('client-refresh', 'options are still rendered with textContent (never innerHTML)',
      modalSel.children.every((o) => typeof o.textContent === 'string' && o.innerHTML === undefined));

    // ---- a removed selection is cleared deliberately with fixed feedback ----
    filterSel.value = '2';
    modalSel.value = '2';
    buildingsResponder = () => Promise.resolve(jsonResponse({
      success: true, buildings: [{ id: 1, name: 'Library Building (Renamed)' }],
    }));
    const beforeRemoval = calls.length;
    dispatchChanged();
    await settle();
    check('client-refresh', 'a filter selection that no longer exists is cleared', filterSel.value === '');
    check('client-refresh', 'a modal selection that no longer exists is cleared', modalSel.value === '');
    check('client-refresh', 'removal is explained through fixed feedback, not silently',
      /no longer exists/.test(toast.textContent));
    check('client-refresh', 'the removal notice also reaches the live result status',
      /no longer exists/.test(doc.getElementById('schedule-result-status').textContent));
    check('client-refresh', 'the list still reruns exactly once after the removal refresh',
      urls().slice(beforeRemoval).filter((u) => u.indexOf('/admin/api/schedules') !== -1).length === 1);

    // ---- malformed / failed refresh keeps everything intact ----
    // The search text is set FIRST so the Annex option is actually rendered
    // and can then be selected; otherwise the filter would exclude it.
    const goodBuildings = [{ id: 1, name: 'Library Building (Renamed)' }, { id: 7, name: 'Annex' }];
    searchInput.value = 'ann';
    buildingsResponder = () => Promise.resolve(jsonResponse({ success: true, buildings: goodBuildings }));
    dispatchChanged();
    await settle();
    modalSel.value = '7';
    filterSel.value = '7';

    for (const [label, responder] of [
      ['non-200', () => Promise.resolve(jsonResponse({ success: false, message: 'Server error.' }, 500))],
      ['success:false', () => Promise.resolve(jsonResponse({ success: false }, 200))],
      ['non-array payload', () => Promise.resolve(jsonResponse({ success: true, buildings: 'nope' }, 200))],
      ['network failure', () => Promise.reject(new Error('network'))],
    ]) {
      buildingsResponder = responder;
      toast.textContent = '';
      const beforeFail = calls.length;
      dispatchChanged();
      await settle();
      check('client-refresh', `${label} refresh keeps the previous selections`,
        filterSel.value === '7' && modalSel.value === '7' && searchInput.value === 'ann');
      check('client-refresh', `${label} refresh keeps the previous building options`,
        modalSel.children.some((o) => o.value === '7'));
      check('client-refresh', `${label} refresh reports one fixed recoverable message`,
        /Could not refresh the building list/.test(toast.textContent));
      check('client-refresh', `${label} refresh exposes no raw response or error text`,
        !/network|nope|Server error|undefined|\[object/.test(toast.textContent));
      check('client-refresh', `${label} refresh does NOT rerun the schedule list`,
        urls().slice(beforeFail).filter((u) => u.indexOf('/admin/api/schedules') !== -1).length === 0);
    }

    // ---- overlapping refreshes: an older response cannot win ----
    // Clear the modal search so the winning list is rendered unfiltered.
    searchInput.value = '';
    buildingsResponder = () => Promise.resolve(jsonResponse({ success: true, buildings: goodBuildings }));
    dispatchChanged();
    await settle();

    let resolveOld = null;
    let resolveNew = null;
    const oldList = [{ id: 90, name: 'STALE ONLY' }];
    const newList = [{ id: 91, name: 'NEWEST ONLY' }];
    let call = 0;
    buildingsResponder = () => new Promise((resolve, reject) => {
      call += 1;
      if (call === 1) resolveOld = () => resolve(jsonResponse({ success: true, buildings: oldList }));
      else resolveNew = () => resolve(jsonResponse({ success: true, buildings: newList }));
    });
    dispatchChanged();            // refresh A
    await new Promise((r) => setImmediate(r));
    dispatchChanged();            // refresh B supersedes A
    await new Promise((r) => setImmediate(r));
    const aborted = calls.filter((c) => c.url.indexOf('/admin/api/buildings') !== -1).slice(-2)[0];
    check('client-refresh', 'an older refresh is aborted when a newer one starts',
      !!(aborted && aborted.opts.signal && aborted.opts.signal.aborted === true));
    resolveNew();
    await settle();
    resolveOld();                 // the superseded response answers LATE
    await settle();
    check('client-refresh', 'a late older refresh cannot overwrite the newest buildings',
      modalSel.children.some((o) => o.textContent === 'NEWEST ONLY') &&
      !modalSel.children.some((o) => o.textContent === 'STALE ONLY'));

    // ---- the refresh must not disturb schedule-list request state ----
    check('client-refresh', 'the schedule Apply control is left enabled and not busy',
      doc.getElementById('schedule-apply-filters').disabled === false &&
      doc.getElementById('schedule-apply-filters').getAttribute('aria-busy') === 'false');
  } finally {
    global.document = prevDoc;
    global.fetch = prevFetch;
    global.CustomEvent = prevCE;
  }
}

/* ============================================================
   2c. BOUNDED SUPERSET SCAN (M12.P1-D4 corrective)
   Probe-only mocked Supabase client; no live rows are created.
============================================================ */
// `pageLengths` drives each range page. `totalCount` is what the server
// reports for { count: 'exact' } — pass null to model a backend that omits it
// (the scan then falls back to short-page inference).
function mockSupabaseForPages(pageLengths, totalCount) {
  const row = (id) => ({
    id, title: 'row*match', schedule_date: '2098-06-15', start_time: '08:00',
    end_time: '09:00', audience: 'all', status: 'scheduled', building_id: 1,
    location_type: 'room', location_label: 'L', floor_label: 'F', description: 'd',
    created_by_user_id: null, created_at: null, updated_at: null,
  });
  const chain = (resultFor) => {
    const obj = {
      _range: null,
      eq: () => obj, gte: () => obj, lte: () => obj, or: () => obj,
      in: () => obj, ilike: () => obj, order: () => obj,
      range(from, to) { obj._range = [from, to]; return obj; },
      then(resolve, reject) { return Promise.resolve(resultFor(obj)).then(resolve, reject); },
    };
    return obj;
  };
  return {
    from(table) {
      return {
        select(cols, opts) {
          if (table === 'buildings') return chain(() => ({ data: [], error: null }));
          if (opts && opts.head) return chain(() => ({ count: 0, error: null }));
          const wantsCount = !!(opts && opts.count === 'exact');
          return chain((o) => {
            const page = o._range ? Math.floor(o._range[0] / 1000) : 0;
            const width = o._range ? (o._range[1] - o._range[0] + 1) : 1000;
            const n = Math.min(page < pageLengths.length ? pageLengths[page] : 0, width);
            const out = {
              data: Array.from({ length: n }, (_, i) => row(page * 1000 + i + 1)),
              error: null,
            };
            // Only the count-requesting page carries a count, as PostgREST does.
            if (wantsCount && totalCount !== null && totalCount !== undefined) out.count = totalCount;
            return out;
          });
        },
      };
    },
  };
}

// Load the repository with a mocked Supabase client + schedule source, run
// `fn(repo)`, then restore Module._load and the require cache.
async function withMockedScheduleRepository(pageLengths, fn, totalCount) {
  const supPath = path.join(ROOT, 'config', 'supabase.js');
  const dsPath = path.join(ROOT, 'config', 'scheduleDataSource.js');
  const repoPath = path.join(ROOT, 'repositories', 'scheduleRepository.js');
  const origLoad = Module._load;
  const bust = () => [supPath, dsPath, repoPath].forEach((p) => { delete require.cache[require.resolve(p)]; });
  bust();
  Module._load = function (request, parent) {
    if (parent && parent.filename === repoPath) {
      if (request === '../config/supabase') {
        return {
          getSupabaseClient: () => mockSupabaseForPages(pageLengths, totalCount),
          hasSupabaseConfig: () => true,
        };
      }
      if (request === '../config/scheduleDataSource') return { isSupabase: () => true };
      if (request === '../config/db') return { query: async () => [[]] };
    }
    return origLoad.apply(this, arguments);
  };
  try {
    return await fn(require(repoPath));
  } finally {
    Module._load = origLoad;
    bust();
  }
}

async function runScanBoundaryChecks() {
  console.log('\n[scan-bound] bounded superset scan fails closed');
  const FILTERS = { q: 'row*match', from: '2098-06-15', to: '2098-06-15', limit: 50, offset: 0 };
  const full = (n) => Array.from({ length: n }, () => 1000);

  // 19 full pages + a short final page proves exhaustion.
  await withMockedScheduleRepository(full(19).concat([999]), async (repo) => {
    const rows = await repo.listSchedules(FILTERS);
    const total = await repo.countSchedules(FILTERS);
    check('scan-bound', '19 full pages plus a 999-row page is treated as exhausted',
      Array.isArray(rows) && total === 19 * 1000 + 999);
    check('scan-bound', 'the exhausted scan still paginates the list', rows.length === 50);
  });

  // A full twentieth page cannot prove exhaustion: both calls must refuse.
  await withMockedScheduleRepository(full(20), async (repo) => {
    let listErr = null;
    let countErr = null;
    let listValue = 'NOT_THROWN';
    let countValue = 'NOT_THROWN';
    try { listValue = await repo.listSchedules(FILTERS); } catch (e) { listErr = e; }
    try { countValue = await repo.countSchedules(FILTERS); } catch (e) { countErr = e; }

    check('scan-bound', 'a full twentieth page makes listSchedules throw', !!listErr);
    check('scan-bound', 'a full twentieth page makes countSchedules throw', !!countErr);
    check('scan-bound', 'no partial list escapes', listValue === 'NOT_THROWN');
    check('scan-bound', 'no partial count escapes', countValue === 'NOT_THROWN');
    check('scan-bound', 'both refusals carry the stable SCHEDULE_SEARCH_LIMIT code',
      repo.isScheduleSearchLimitError(listErr) && repo.isScheduleSearchLimitError(countErr));
    check('scan-bound', 'the refusal message is the fixed client-safe sentence',
      listErr.message === repo.SCHEDULE_SEARCH_LIMIT_MESSAGE &&
      listErr.message === 'Schedule search is too broad. Narrow the date range or search text and try again.');
    check('scan-bound', 'the refusal leaks no query text, row, count, host, key, or backend detail',
      !/row\*match|2098-06-15|supabase|http|select|room_schedules|\d{3,}/i.test(listErr.message));
    check('scan-bound', 'the predicate rejects unrelated errors',
      repo.isScheduleSearchLimitError(new Error('boom')) === false &&
      repo.isScheduleSearchLimitError(null) === false);
    check('scan-bound', 'private scan helpers are not exported',
      repo.supabaseExactSearchRows === undefined && repo.orderSchedules === undefined);
  });

  // A non-asterisk search never enters the bounded scan at all: it must come
  // back within the requested page size, not the scan width.
  await withMockedScheduleRepository(full(20), async (repo) => {
    const rows = await repo.listSchedules({ ...FILTERS, q: 'plain' });
    check('scan-bound', 'a search without an asterisk is unaffected by the bound',
      Array.isArray(rows) && rows.length <= FILTERS.limit);
  });

  /* ---- exhaustion is PROVEN against the server count, not inferred ---- */
  // A backend that caps rows below the page size makes every page look short.
  // Inference alone would call that "exhausted" and silently truncate; the
  // count cross-check must refuse instead.
  await withMockedScheduleRepository(Array.from({ length: 20 }, () => 500), async (repo) => {
    let err = null;
    let value = 'NOT_THROWN';
    try { value = await repo.listSchedules(FILTERS); } catch (e) { err = e; }
    check('scan-bound', 'a server row-cap below the page size cannot fake exhaustion',
      !!err && repo.isScheduleSearchLimitError(err) && value === 'NOT_THROWN');
  }, 50000);

  // The same short pages ARE exhaustion when the server count agrees.
  await withMockedScheduleRepository([500], async (repo) => {
    const rows = await repo.listSchedules(FILTERS);
    const total = await repo.countSchedules(FILTERS);
    check('scan-bound', 'short pages that match the reported count are exhaustion',
      Array.isArray(rows) && total === 500);
  }, 500);

  // A candidate set larger than the whole budget refuses on the FIRST page,
  // before walking every remaining page.
  await withMockedScheduleRepository(full(20), async (repo) => {
    let err = null;
    try { await repo.listSchedules(FILTERS); } catch (e) { err = e; }
    check('scan-bound', 'a count beyond the budget refuses immediately',
      !!err && repo.isScheduleSearchLimitError(err));
  }, 20001);

  // A page that returns nothing while the count says more remain cannot prove
  // exhaustion either.
  await withMockedScheduleRepository([1000, 0], async (repo) => {
    let err = null;
    try { await repo.listSchedules(FILTERS); } catch (e) { err = e; }
    check('scan-bound', 'a zero-row page that contradicts the count refuses',
      !!err && repo.isScheduleSearchLimitError(err));
  }, 5000);

  /* ---- controller mapping: only this refusal becomes 422 ---- */
  console.log('\n[scan-bound-controller] 422 mapping');
  const controllerPath = path.join(ROOT, 'controllers', 'adminScheduleController.js');
  const repoPath = path.join(ROOT, 'repositories', 'scheduleRepository.js');
  const realRepo = require(repoPath);
  const origList = realRepo.listSchedules;
  const origCount = realRepo.countSchedules;
  const origError = console.error;
  const logged = [];
  try {
    delete require.cache[require.resolve(controllerPath)];
    const controller = require(controllerPath);
    const runList = async (thrown) => {
      realRepo.listSchedules = async () => { throw thrown; };
      realRepo.countSchedules = async () => { throw thrown; };
      const captured = { status: 200, body: null };
      const res = {
        status(code) { captured.status = code; return this; },
        json(body) { captured.body = body; return this; },
      };
      await controller.listSchedules({ query: { q: 'a*b' } }, res);
      return captured;
    };

    console.error = (...args) => { logged.push(args.join(' ')); };
    const limit = await runList(Object.assign(new Error(realRepo.SCHEDULE_SEARCH_LIMIT_MESSAGE), { code: 'SCHEDULE_SEARCH_LIMIT' }));
    check('scan-bound-controller', 'the bounded-search refusal becomes HTTP 422', limit.status === 422);
    check('scan-bound-controller', 'the 422 body is the fixed sanitized contract',
      !!limit.body && limit.body.success === false &&
      limit.body.message === 'Schedule search is too broad. Narrow the date range or search text and try again.');
    check('scan-bound-controller', 'the expected refusal is not logged', logged.length === 0);

    const other = await runList(new Error('unexpected backend failure'));
    check('scan-bound-controller', 'any other error still returns the fixed 500',
      other.status === 500 && !!other.body && other.body.success === false && other.body.message === 'Server error.');
    check('scan-bound-controller', 'the 500 body never carries the raw error text',
      other.body.message.indexOf('unexpected backend failure') === -1);
    check('scan-bound-controller', 'an unexpected error IS still logged, sanitized',
      logged.length === 1 && logged[0].indexOf('unexpected backend failure') === -1);
  } finally {
    console.error = origError;
    realRepo.listSchedules = origList;
    realRepo.countSchedules = origCount;
    delete require.cache[require.resolve(controllerPath)];
  }
}

/* ============================================================
   3. STATIC contracts
============================================================ */
function runStaticChecks() {
  console.log('\n[static] view, script, and CSS contracts');
  const view = read('views/admin/campus-map.ejs');
  const schedJs = read('public/js/admin/admin-schedules.js');
  const graphJs = read('public/js/admin/admin-map-graph.js');
  const css = read('public/css/admin-styles.css');

  check('static', 'schedule search input is visible, labelled, and length-capped',
    /<label for="schedule-search">/.test(view) &&
    /id="schedule-search"[^>]*maxlength="100"/.test(view));
  check('static', 'Apply and Clear both exist',
    view.indexOf('id="schedule-apply-filters"') !== -1 && view.indexOf('id="schedule-clear-filters"') !== -1);
  check('static', 'schedule result status is an aria-live region',
    /id="schedule-result-status"[^>]*aria-live="polite"/.test(view));
  check('static', 'schedule filtered-empty state is distinct from empty',
    view.indexOf('id="schedule-filtered-empty"') !== -1 && view.indexOf('id="schedule-empty"') !== -1);
  check('static', 'existing schedule filters are preserved',
    ['schedule-filter-building', 'schedule-filter-from', 'schedule-filter-to',
      'schedule-filter-audience', 'schedule-filter-status']
      .every((id) => view.indexOf('id="' + id + '"') !== -1));
  check('static', 'building search sits above the native building select and is labelled',
    /<label for="schedule-building-search">/.test(view) &&
    view.indexOf('id="schedule-building-search"') < view.indexOf('id="schedule-building"') &&
    /id="schedule-building-count"[^>]*aria-live="polite"/.test(view));
  check('static', 'both edge endpoint searches are labelled with live counts',
    /<label for="edge-from-search">/.test(view) && /<label for="edge-to-search">/.test(view) &&
    /id="edge-from-count"[^>]*aria-live="polite"/.test(view) &&
    /id="edge-to-count"[^>]*aria-live="polite"/.test(view));
  check('static', 'each endpoint search precedes its own select',
    view.indexOf('id="edge-from-search"') < view.indexOf('id="edge-from"') &&
    view.indexOf('id="edge-to-search"') < view.indexOf('id="edge-to"'));
  check('static', 'the immutable-endpoint note exists and starts hidden',
    /id="edge-endpoint-note"[^>]*hidden/.test(view));
  check('static', 'the three graph panels each expose a live result status',
    ['route', 'node', 'edge'].every((e) => new RegExp('id="' + e + '-result-status"[^>]*aria-live="polite"').test(view)));
  check('static', 'native selects are kept (no combobox/datalist replacement)',
    view.indexOf('<datalist') === -1 && view.indexOf('role="combobox"') === -1 &&
    /<select name="building_id" id="schedule-building"/.test(view) &&
    /<select name="from_node_id" id="edge-from"/.test(view));

  check('static', 'the schedule client sends q and reads appliedFilters',
    schedJs.indexOf("params.set('q'") !== -1 && schedJs.indexOf('appliedFilters') !== -1);
  check('static', 'the schedule client uses AbortController plus a monotonic request id',
    schedJs.indexOf('AbortController') !== -1 && schedJs.indexOf('++state.requestId') !== -1 &&
    schedJs.indexOf('isCurrent()') !== -1);
  check('static', 'the schedule client ignores AbortError',
    schedJs.indexOf("'AbortError'") !== -1);
  check('static', 'neither admin script renders backend text through an HTML sink',
    !/\.innerHTML\s*=/.test(schedJs) && !/insertAdjacentHTML|document\.write/.test(schedJs) &&
    !/\.innerHTML\s*=/.test(graphJs) && !/insertAdjacentHTML|document\.write/.test(graphJs));
  check('static', 'the graph client searches the exact returned route fields',
    /function fieldsForRoute[\s\S]{0,200}estimated_walk_time[\s\S]{0,60}r\.id/.test(graphJs));
  check('static', 'the graph client resolves the node building name',
    /function fieldsForNode[\s\S]{0,200}buildingNameForId\(n\.building_id\)/.test(graphJs));
  check('static', 'the graph client searches the exact returned edge fields',
    /function fieldsForEdge[\s\S]{0,400}from_label[\s\S]{0,400}to_label[\s\S]{0,400}walk_time_seconds/.test(graphJs));
  check('static', 'the graph client keeps the three existing search inputs (no duplicates)',
    (view.match(/id="route-search"/g) || []).length === 1 &&
    (view.match(/id="node-search"/g) || []).length === 1 &&
    (view.match(/id="edge-search"/g) || []).length === 1);
  check('static', 'endpoint searches are disabled while editing an edge',
    /fromSearch\.disabled = !!editing/.test(graphJs) && /toSearch\.disabled = !!editing/.test(graphJs));
  check('static', 'same-node edge validation is preserved',
    graphJs.indexOf('An edge cannot connect a node to itself.') !== -1);

  check('static', 'new CSS is scoped to the D4 controls',
    css.indexOf('.admin-search-field') !== -1 && css.indexOf('.admin-result-status') !== -1 &&
    css.indexOf('.admin-field-count') !== -1);
  check('static', 'mobile targets are at least 44px with visible focus',
    /min-height:\s*44px/.test(css) && /:focus-visible[\s\S]{0,200}outline:/.test(css));
}

/* ============================================================
   4. LIVE both-mode HTTP contracts
============================================================ */
function cookieJar() {
  const jar = {};
  return {
    apply(res) {
      const list = res.headers.getSetCookie ? res.headers.getSetCookie()
        : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
      for (const c of list) { const p = c.split(';')[0]; const i = p.indexOf('='); if (i > 0) jar[p.slice(0, i).trim()] = p.slice(i + 1).trim(); }
    },
    header() { return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '); },
  };
}
const metaCsrf = (html) => { const m = String(html).match(/name="csrf-token" content="([^"]+)"/); return m ? m[1] : ''; };

const LEAK_PATTERNS = [
  ['JWT-like token', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['Supabase host', /[a-z0-9-]+\.supabase\.(co|com|in)/i],
  ['stack frame', /\bat [\w.$<>[\] ]+ \((?:file:\/\/|\/|[A-Za-z]:\\)[^)]*:\d+:\d+\)/],
  ['SQL/driver/PostgREST text', /sqlMessage|SQLSTATE|PostgREST|relation "[^"]+" does not exist|syntax error at or near/i],
  ['MySQL driver error code', /\bER_[A-Z_]{3,}\b/],
  ['session cookie value', /campusphere\.sid=/],
  ['credential name', /SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|CLOUDINARY_API_SECRET/],
];

async function runLiveMode(mode, base) {
  const creds = getRegressionCredentials(mode);
  const bodies = [];
  const jar = cookieJar();

  let r = await fetch(base + '/auth', { headers: { Accept: 'text/html' } });
  jar.apply(r);
  const csrf0 = metaCsrf(await r.text());
  r = await fetch(base + '/login', {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.header() },
    body: `email=${encodeURIComponent(creds.admin.email)}&password=${encodeURIComponent(creds.admin.password)}&_csrf=${encodeURIComponent(csrf0)}`,
  });
  jar.apply(r);
  check(mode, 'admin login -> 302', r.status === 302);
  // One tracker per withServer/runLiveMode invocation.
  const sessions = createProbeSessionTracker({
    base,
    record: (label, pass) => check(mode, label, pass),
  });
  if (r.status === 302) sessions.register('admin', jar, '/admin/faqs');
  if (r.status !== 302) return bodies;

  /* Outer try: session termination is the OUTERMOST finally — after the
     fixture cleanup below, even if that cleanup throws, and on every early
     return. Intentionally NOT re-indented (minimal diff). */
  try {

  let tok = ''; let prev = null;
  for (let i = 0; i < 6; i++) {
    const pr = await fetch(base + '/admin/campus-map', { headers: { Accept: 'text/html', Cookie: jar.header() } });
    jar.apply(pr);
    const t = metaCsrf(await pr.text());
    if (t && t === prev) { tok = t; break; }
    prev = t;
  }
  check(mode, 'admin CSRF token available', tok.length > 0);

  const SCOPE = '&from=' + FIXTURE_DATE + '&to=' + FIXTURE_DATE;
  const get = async (url) => {
    const res = await fetch(base + url, { headers: { Accept: 'application/json', Cookie: jar.header() } });
    const text = await res.text();
    bodies.push(text);
    let json = null; try { json = JSON.parse(text); } catch (e) {}
    return { status: res.status, json };
  };
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

  const bl = await get('/api/buildings');
  const buildings = (bl.json && bl.json.buildings) || [];
  const bMain = buildings[0];
  const bOther = buildings.find((b) => Number(b.id) !== Number(bMain.id)) || bMain;
  check(mode, 'fixture buildings resolved', !!bMain && !!bOther);
  if (!bMain) return bodies;

  const METAPAYLOAD = '50%_x(a),b"c\\d*';
  const created = [];
  const mk = async (body) => {
    const res = await fetch(base + '/admin/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': tok, Cookie: jar.header() },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    bodies.push(text);
    let j = null; try { j = JSON.parse(text); } catch (e) {}
    if (j && j.schedule) created.push(j.schedule.id);
    return res.status;
  };

  try {
    const s1 = await mk({ title: PREFIX + ' AlphaTitle', schedule_date: FIXTURE_DATE, start_time: '08:00', end_time: '09:00', audience: 'all', status: 'scheduled', building_id: Number(bMain.id), location_type: 'room', location_label: PREFIX + '-alpha', floor_label: 'AlphaFloor', description: 'alpha description' });
    const s2 = await mk({ title: PREFIX + ' BetaTitle', schedule_date: FIXTURE_DATE, start_time: '10:00', end_time: '11:00', audience: 'all', status: 'scheduled', building_id: Number(bMain.id), location_type: 'room', location_label: PREFIX + '-' + METAPAYLOAD, floor_label: 'BetaFloor', description: 'beta description' });
    const s3 = await mk({ title: PREFIX + ' GammaTitle', schedule_date: FIXTURE_DATE, start_time: '12:00', end_time: '13:00', audience: 'instructor', status: 'cancelled', building_id: Number(bOther.id), location_type: 'facility', location_label: PREFIX + '-gamma', floor_label: 'GammaFloor', description: 'gamma description zeta' });
    check(mode, 'three prefixed fixtures created', s1 === 201 && s2 === 201 && s3 === 201 && created.length === 3);

    // --- per-column coverage ---
    const all = await get('/admin/api/schedules?q=' + encodeURIComponent(PREFIX) + SCOPE);
    check(mode, 'q matches exactly the three fixtures', !!all.json && all.json.total === 3 && all.json.schedules.length === 3);
    for (const [field, term, expected] of [
      ['title', 'AlphaTitle', 1], ['location_label', 'gamma', 1],
      ['floor_label', 'BetaFloor', 1], ['description', 'zeta', 1],
    ]) {
      const res = await get('/admin/api/schedules?q=' + encodeURIComponent(term) + SCOPE);
      check(mode, `q matches ${field}`, !!res.json && res.json.total === expected);
    }
    const byBuilding = await get('/admin/api/schedules?q=' + encodeURIComponent(String(bOther.name).slice(0, 12)) + SCOPE);
    check(mode, 'q matches the building name',
      !!byBuilding.json && byBuilding.json.schedules.some((s) => String(s.title).indexOf('Gamma') !== -1));
    const ci = await get('/admin/api/schedules?q=' + encodeURIComponent('alphatitle') + SCOPE);
    check(mode, 'q is case-insensitive', !!ci.json && ci.json.total === 1);

    // --- combined filters ---
    const combo1 = await get('/admin/api/schedules?q=' + encodeURIComponent(PREFIX) + SCOPE + '&audience=instructor&status=cancelled');
    check(mode, 'q + audience + status narrows to one row', !!combo1.json && combo1.json.total === 1);
    const combo2 = await get('/admin/api/schedules?q=' + encodeURIComponent(PREFIX) + SCOPE + '&buildingId=' + Number(bMain.id));
    check(mode, 'q + buildingId narrows to two rows', !!combo2.json && combo2.json.total === 2);
    const combo3 = await get('/admin/api/schedules?q=' + encodeURIComponent(PREFIX) + '&from=' + FIXTURE_DATE + '&to=' + FIXTURE_DATE);
    check(mode, 'q + explicit date window still matches', !!combo3.json && combo3.json.total === 3);

    // --- blank / whitespace ---
    const blank = await get('/admin/api/schedules?q=');
    check(mode, 'blank q applies no search', blank.status === 200 && blank.json.appliedFilters.q === null);
    const ws = await get('/admin/api/schedules?q=' + encodeURIComponent('   '));
    check(mode, 'whitespace-only q applies no search', ws.status === 200 && ws.json.appliedFilters.q === null);

    // --- bounds and non-scalars ---
    check(mode, 'exactly 100 characters is accepted',
      (await get('/admin/api/schedules?q=' + encodeURIComponent('a'.repeat(100)))).status === 200);
    const over = await get('/admin/api/schedules?q=' + encodeURIComponent('a'.repeat(101)));
    check(mode, '101 characters is rejected with a sanitized 400',
      over.status === 400 && !!over.json && over.json.success === false &&
      over.json.message === S.SEARCH_TOO_LONG_MESSAGE);
    const dup = await get('/admin/api/schedules?q=a&q=b');
    check(mode, 'a repeated q is rejected with a sanitized 400',
      dup.status === 400 && !!dup.json && dup.json.message === S.SEARCH_INVALID_MESSAGE);
    const bracket = await get('/admin/api/schedules?q[x]=1');
    check(mode, 'a bracketed q applies no search rather than broadening',
      bracket.status === 200 && bracket.json.appliedFilters.q === null);

    // --- literal metacharacters ---
    const windowAll = await get('/admin/api/schedules?limit=100' + SCOPE);
    const windowTotal = windowAll.json ? windowAll.json.total : -1;
    check(mode, 'the unfiltered window has more rows than any single fixture', windowTotal >= 3);
    const metaExact = await get('/admin/api/schedules?q=' + encodeURIComponent(METAPAYLOAD) + SCOPE);
    check(mode, 'the full metacharacter payload matches only its own row',
      metaExact.status === 200 && metaExact.json.total === 1);
    // Parity: for every metacharacter the server must return EXACTLY the rows
    // the canonical predicate matches over the same window — never the whole
    // window (a wildcard) and never an error. The expectation is computed from
    // live data, so it stays correct whatever else is scheduled that day
    // (building names such as "College of Computer Studies (CCS)" genuinely
    // contain parentheses and are legitimately searchable).
    const windowRows = (windowAll.json && windowAll.json.schedules) || [];
    for (const [name, ch] of [
      ['percent', '%'], ['underscore', '_'], ['asterisk', '*'],
      ['open paren', '('], ['close paren', ')'], ['comma', ','],
      ['double quote', '"'], ['backslash', '\\'], ['dot', '.'], ['colon', ':'],
    ]) {
      const res = await get('/admin/api/schedules?q=' + encodeURIComponent(ch) + SCOPE);
      const expected = windowRows.filter((row) => S.matchesScheduleSearch(row, ch)).length;
      check(mode, `a literal ${name} matches exactly the rows containing it, never the window`,
        res.status === 200 && res.json.total === expected &&
        (expected === windowTotal || res.json.total < windowTotal));
    }
    const starNotPercent = await get('/admin/api/schedules?q=' + encodeURIComponent('*_x') + SCOPE);
    check(mode, 'an asterisk is not silently treated as a percent',
      starNotPercent.status === 200 && starNotPercent.json.total === 0);
    const realPercent = await get('/admin/api/schedules?q=' + encodeURIComponent('%_x') + SCOPE);
    check(mode, 'the genuine percent substring still matches', realPercent.status === 200 && realPercent.json.total === 1);
    const breakout = await get('/admin/api/schedules?q=' + encodeURIComponent('zzz",id.gte."0') + SCOPE);
    check(mode, 'a crafted filter-grammar breakout matches nothing and never errors',
      breakout.status === 200 && breakout.json.total === 0);

    // --- list/count agreement ---
    for (const term of [PREFIX, METAPAYLOAD, 'AlphaTitle', '_']) {
      const res = await get('/admin/api/schedules?limit=100' + SCOPE + '&q=' + encodeURIComponent(term));
      check(mode, `list length agrees with total for ${JSON.stringify(term.slice(0, 12))}`,
        res.status === 200 && res.json.schedules.length === res.json.total);
    }
    const paged = await get('/admin/api/schedules?limit=1' + SCOPE + '&q=' + encodeURIComponent(PREFIX));
    check(mode, 'total counts every match while limit bounds the page',
      paged.status === 200 && paged.json.total === 3 && paged.json.schedules.length === 1 &&
      paged.json.appliedFilters.limit === 1);

    // --- appliedFilters exactness ---
    const applied = (await get('/admin/api/schedules')).json.appliedFilters;
    const plus14 = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)) + 14)).toISOString().slice(0, 10);
    check(mode, 'appliedFilters exposes the exact default Manila window',
      !!applied && applied.from === today && applied.to === plus14);
    check(mode, 'appliedFilters defaults are null/limit/offset exact',
      applied.q === null && applied.buildingId === null && applied.audience === null &&
      applied.status === null && applied.limit === 50 && applied.offset === 0);
    const echoed = (await get('/admin/api/schedules?q=' + encodeURIComponent('Alpha') + '&audience=all&status=scheduled&buildingId=' + Number(bMain.id) + '&limit=5&offset=0')).json.appliedFilters;
    check(mode, 'appliedFilters echoes every active filter',
      echoed.q === 'Alpha' && echoed.audience === 'all' && echoed.status === 'scheduled' &&
      Number(echoed.buildingId) === Number(bMain.id) && echoed.limit === 5);

    // --- existing validation still fails closed ---
    for (const [label, url] of [
      ['invalid buildingId', '/admin/api/schedules?buildingId=abc'],
      ['invalid from date', '/admin/api/schedules?from=not-a-date'],
      ['inverted range', '/admin/api/schedules?from=2026-02-01&to=2026-01-01'],
      ['over-wide range', '/admin/api/schedules?from=2026-01-01&to=2026-12-31'],
      ['invalid audience', '/admin/api/schedules?audience=nobody'],
      ['invalid status', '/admin/api/schedules?status=maybe'],
      ['invalid limit', '/admin/api/schedules?limit=0'],
    ]) {
      const res = await get(url);
      check(mode, `${label} still returns a sanitized 400`,
        res.status === 400 && !!res.json && res.json.success === false && typeof res.json.message === 'string');
    }

    // --- graph API shapes the client search depends on ---
    const routes = await get('/admin/api/routes');
    const nodes = await get('/admin/api/route-nodes');
    const edges = await get('/admin/api/route-edges');
    check(mode, 'routes expose title/start_label/destination_name/walk time/id',
      routes.status === 200 && (routes.json.routes || []).every((x) =>
        'title' in x && 'start_label' in x && 'destination_name' in x && 'estimated_walk_time' in x && 'id' in x));
    check(mode, 'nodes expose node_key/label/node_type/building_id/id',
      nodes.status === 200 && (nodes.json.nodes || []).every((x) =>
        'node_key' in x && 'label' in x && 'node_type' in x && 'building_id' in x && 'id' in x));
    check(mode, 'edges expose both keys, both labels, metrics, accessibility and id',
      edges.status === 200 && (edges.json.edges || []).every((x) =>
        'from_node_key' in x && 'from_label' in x && 'to_node_key' in x && 'to_label' in x &&
        'path_label' in x && 'distance_meters' in x && 'walk_time_seconds' in x &&
        'is_accessible' in x && 'id' in x));

    // --- role boundary is unchanged ---
    const anon = await fetch(base + '/admin/api/schedules?q=x', { headers: { Accept: 'application/json' } });
    const anonText = await anon.text();
    bodies.push(anonText);
    check(mode, 'anonymous schedule search -> 401 JSON', anon.status === 401);
  } finally {
    for (const id of created) {
      await fetch(base + '/admin/api/schedules/' + id, {
        method: 'DELETE', headers: { Accept: 'application/json', 'X-CSRF-Token': tok, Cookie: jar.header() },
      }).catch(() => {});
    }
    const after = await get('/admin/api/schedules?limit=100' + SCOPE + '&q=' + encodeURIComponent('D4_PROBE_'));
    const leftovers = ((after.json && after.json.schedules) || []).length;
    check(mode, 'zero D4 fixtures remain after cleanup', leftovers === 0);
  }

  } finally {
    await sessions.terminateAll();
  }
  return bodies;
}

function leakScan(mode, bodies) {
  const blob = bodies.join('\n');
  for (const [label, re] of LEAK_PATTERNS) {
    check(mode, `leak scan: no ${label}`, !re.test(blob));
  }
}

/* ============================================================ main */
(async () => {
  console.log('=== CampuSphere Admin Campus-Map Search & Filter probe (M12.P1-D4) ===');

  runPureChecks();
  const ctx = runScheduleClientChecks();
  await runScheduleClientAsyncChecks(ctx);
  await runBuildingRefreshChecks();
  await runScanBoundaryChecks();
  await runGraphClientChecks();
  runStaticChecks();

  console.log('\nmysql mode:');
  const mysqlBodies = await withServer({ mode: 'mysql', port: 3486, sessionStore: 'mysql' }, (base) => runLiveMode('mysql', base));
  leakScan('mysql', mysqlBodies || []);

  if (process.env.PROBE_SKIP_SUPABASE === '1' && !hasSupabaseConfig()) {
    console.log('\nsupabase mode: SKIP — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (MySQL fallback mode).');
  } else {
    console.log('\nsupabase mode:');
    const sbBodies = await withServer({ mode: 'supabase', port: 3487, sessionStore: 'supabase' }, (base) => runLiveMode('supabase', base));
    leakScan('supabase', sbBodies || []);
  }

  console.log('');
  if (failures.length === 0) {
    console.log('ADMIN-CAMPUS-MAP-SEARCH-FILTER-PROBE OK: all checks passed.');
    process.exitCode = 0;
  } else {
    console.error(`ADMIN-CAMPUS-MAP-SEARCH-FILTER-PROBE FAILED: ${failures.length} check(s) did not pass:`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }
})().catch((e) => {
  console.error('ADMIN-CAMPUS-MAP-SEARCH-FILTER-PROBE FAILED: sanitized harness failure.');
  process.exitCode = 1;
});
