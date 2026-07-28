/* ========================================
   CampuSphere — Admin System Logs Client Script
   Milestone 7, Section 7.7.

   Read-only, API-driven view of the immutable `system_logs` audit trail
   for /admin/logs. Every database-derived value is rendered through DOM
   APIs + textContent (never innerHTML interpolation), so a stored payload
   like <img src=x onerror=...> renders as inert text. There is no create,
   edit, delete, clear, or export path — this client only reads, filters,
   and paginates GET /admin/api/logs.
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {

  // ---- DOM references ----
  const loadingEl = document.getElementById('logs-loading');
  const errorEl = document.getElementById('logs-error');
  const emptyEl = document.getElementById('logs-empty');
  const filteredEmptyEl = document.getElementById('logs-filtered-empty');
  const resultsEl = document.getElementById('logs-results');
  const paginationEl = document.querySelector('.logs-pagination');

  const retryBtn = document.getElementById('logs-retry-btn');
  const filteredResetBtn = document.getElementById('logs-filtered-reset-btn');

  const statTotal = document.getElementById('logs-stat-total');
  const statSuccess = document.getElementById('logs-stat-success');
  const statFailure = document.getElementById('logs-stat-failure');
  const statDenied = document.getElementById('logs-stat-denied');

  const filtersForm = document.getElementById('logs-filters');
  const searchInput = document.getElementById('logs-search-input');
  const eventTypeSelect = document.getElementById('logs-event-type');
  const outcomeSelect = document.getElementById('logs-outcome');
  const fromInput = document.getElementById('logs-from');
  const toInput = document.getElementById('logs-to');
  const filterError = document.getElementById('logs-filter-error');

  const applyBtn = document.getElementById('logs-apply-btn');
  const resetBtn = document.getElementById('logs-reset-btn');
  const refreshBtn = document.getElementById('logs-refresh-btn');

  const tableBody = document.getElementById('logs-table-body');
  const cardList = document.getElementById('logs-card-list');

  const rangeEl = document.getElementById('logs-range');
  const pageInfoEl = document.getElementById('logs-page-info');
  const prevBtn = document.getElementById('logs-prev-btn');
  const nextBtn = document.getElementById('logs-next-btn');

  const toast = document.getElementById('admin-toast');

  const LIMIT = 50;
  const ET_LABEL = {
    authentication: 'Authentication',
    profile: 'Profile',
    authorization: 'Authorization',
    admin_mutation: 'Admin mutation'
  };

  // ---- State ----
  const state = {
    filters: { text: '', eventType: '', outcome: '', from: '', to: '' },
    offset: 0,
    limit: LIMIT,
    total: 0,
    hasMore: false,
    busy: false,
    loadedOnce: false,
    lastGoodState: null
  };

  // ---- Small helpers ----
  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
  }

  function showToast(message, type) {
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'admin-toast admin-toast--' + (type || 'success') + ' admin-toast--show';
    setTimeout(() => { toast.classList.remove('admin-toast--show'); }, 3500);
  }

  function showFilterError(msg) {
    if (!filterError) return;
    filterError.textContent = msg;
    filterError.hidden = false;
  }
  function clearFilterError() {
    if (!filterError) return;
    filterError.textContent = '';
    filterError.hidden = true;
  }

  function setStat(el, n) {
    if (!el) return;
    el.textContent = (typeof n === 'number' && Number.isFinite(n)) ? String(n) : '—';
  }

  function setState(st) {
    if (loadingEl) loadingEl.hidden = st !== 'loading';
    if (errorEl) errorEl.hidden = st !== 'error';
    if (emptyEl) emptyEl.hidden = st !== 'empty';
    if (filteredEmptyEl) filteredEmptyEl.hidden = st !== 'filtered-empty';
    if (resultsEl) resultsEl.hidden = st !== 'results';
    if (paginationEl) paginationEl.hidden = st !== 'results';
  }

  function filtersActive() {
    const f = state.filters;
    return !!(f.text || f.eventType || f.outcome || f.from || f.to);
  }

  // Build a positive-integer string formatter for the timestamp.
  function pad2(n) { return String(n).padStart(2, '0'); }

  // Local-time display; the full source value is kept in the title attribute.
  function fmtTimestamp(value) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }

  function eventTypeLabel(v) {
    if (v == null || v === '') return '—';
    return ET_LABEL[v] || String(v);
  }

  function outcomeBadge(outcome) {
    const o = outcome == null ? '' : String(outcome);
    const known = (o === 'success' || o === 'failure' || o === 'denied');
    const span = document.createElement('span');
    span.className = 'logs-badge logs-outcome-' + (known ? o : 'other');
    span.textContent = o === '' ? '—' : o;
    return span;
  }

  function actorPrimary(log) {
    if (log.attempted_email) return String(log.attempted_email);
    if (log.actor_user_id !== null && log.actor_user_id !== undefined && log.actor_user_id !== '') {
      return 'User #' + String(log.actor_user_id);
    }
    return '—';
  }
  function actorSecondary(log) { return log.actor_role ? String(log.actor_role) : ''; }
  function targetPrimary(log) { return log.target_type ? String(log.target_type) : '—'; }
  function targetSecondary(log) { return log.target_id ? String(log.target_id) : ''; }

  // ---- Rendering (DOM APIs + textContent only) ----
  function twoLineCell(primary, secondary) {
    const td = document.createElement('td');
    const stack = document.createElement('div');
    stack.className = 'logs-cell-stack';
    const p1 = document.createElement('span');
    p1.className = 'logs-cell-primary';
    p1.textContent = primary;
    stack.appendChild(p1);
    if (secondary) {
      const p2 = document.createElement('span');
      p2.className = 'logs-cell-secondary';
      p2.textContent = secondary;
      stack.appendChild(p2);
    }
    td.appendChild(stack);
    return td;
  }

  function buildRow(log) {
    const tr = document.createElement('tr');

    const tdTime = document.createElement('td');
    tdTime.className = 'logs-cell-time';
    const tsSpan = document.createElement('span');
    tsSpan.textContent = fmtTimestamp(log.created_at);
    if (log.created_at) tsSpan.title = String(log.created_at);
    tdTime.appendChild(tsSpan);
    tr.appendChild(tdTime);

    const tdEvent = document.createElement('td');
    const evBadge = document.createElement('span');
    evBadge.className = 'logs-badge logs-event';
    evBadge.textContent = eventTypeLabel(log.event_type);
    tdEvent.appendChild(evBadge);
    tr.appendChild(tdEvent);

    const tdAction = document.createElement('td');
    tdAction.className = 'logs-cell-action';
    tdAction.textContent = log.action == null ? '—' : String(log.action);
    tr.appendChild(tdAction);

    const tdOutcome = document.createElement('td');
    tdOutcome.appendChild(outcomeBadge(log.outcome));
    tr.appendChild(tdOutcome);

    tr.appendChild(twoLineCell(actorPrimary(log), actorSecondary(log)));
    tr.appendChild(twoLineCell(targetPrimary(log), targetSecondary(log)));

    const tdMsg = document.createElement('td');
    tdMsg.className = 'logs-cell-message';
    const msg = log.message == null ? '' : String(log.message);
    tdMsg.textContent = msg === '' ? '—' : msg;
    if (msg) tdMsg.title = msg;
    tr.appendChild(tdMsg);

    return tr;
  }

  function cardField(label, value) {
    const row = document.createElement('div');
    row.className = 'logs-card-row';
    const l = document.createElement('span');
    l.className = 'logs-card-label';
    l.textContent = label;
    const v = document.createElement('span');
    v.className = 'logs-card-value';
    v.textContent = (value === null || value === undefined || value === '') ? '—' : String(value);
    row.appendChild(l);
    row.appendChild(v);
    return row;
  }

  function buildCard(log) {
    const card = document.createElement('div');
    card.className = 'logs-card';

    const head = document.createElement('div');
    head.className = 'logs-card-head';
    const ts = document.createElement('span');
    ts.className = 'logs-card-time';
    ts.textContent = fmtTimestamp(log.created_at);
    if (log.created_at) ts.title = String(log.created_at);
    head.appendChild(ts);
    head.appendChild(outcomeBadge(log.outcome));
    card.appendChild(head);

    card.appendChild(cardField('Event', eventTypeLabel(log.event_type)));
    card.appendChild(cardField('Action', log.action));

    const actorSec = actorSecondary(log);
    card.appendChild(cardField('Actor', actorSec ? (actorPrimary(log) + ' · ' + actorSec) : actorPrimary(log)));

    const targetSec = targetSecondary(log);
    card.appendChild(cardField('Target', targetSec ? (targetPrimary(log) + ' · ' + targetSec) : targetPrimary(log)));

    card.appendChild(cardField('Message', log.message));
    return card;
  }

  function updateRange(returned) {
    if (!rangeEl) return;
    if (state.total > 0 && returned > 0) {
      const start = state.offset + 1;
      const end = state.offset + returned;
      rangeEl.textContent = 'Showing ' + start + '–' + end + ' of ' + state.total;
    } else if (state.total > 0) {
      rangeEl.textContent = '0 shown of ' + state.total;
    } else {
      rangeEl.textContent = '';
    }
  }

  function updatePagination() {
    const page = Math.floor(state.offset / state.limit) + 1;
    const pages = Math.max(1, Math.ceil(state.total / state.limit));
    if (pageInfoEl) pageInfoEl.textContent = state.total > 0 ? ('Page ' + page + ' of ' + pages) : '';
    if (prevBtn) prevBtn.disabled = state.busy || state.offset <= 0;
    if (nextBtn) nextBtn.disabled = state.busy || !state.hasMore;
  }

  function renderResults(data) {
    setStat(statTotal, data.summary.total);
    setStat(statSuccess, data.summary.success);
    setStat(statFailure, data.summary.failure);
    setStat(statDenied, data.summary.denied);

    state.total = (typeof data.total === 'number' && Number.isFinite(data.total)) ? data.total : 0;
    state.hasMore = !!(data.pagination && data.pagination.has_more);

    const rows = Array.isArray(data.logs) ? data.logs : [];
    if (tableBody) tableBody.textContent = '';
    if (cardList) cardList.textContent = '';
    rows.forEach((log) => {
      if (tableBody) tableBody.appendChild(buildRow(log));
      if (cardList) cardList.appendChild(buildCard(log));
    });

    updateRange(rows.length);
    updatePagination();

    let displayState;
    if (rows.length === 0) {
      displayState = (filtersActive() || data.summary.total > 0) ? 'filtered-empty' : 'empty';
    } else {
      displayState = 'results';
    }
    state.lastGoodState = displayState;
    setState(displayState);
    refreshIcons();
  }

  // ---- API helper ----
  // 401 -> redirect to /auth. Malformed/non-JSON bodies -> json: null so callers
  // fall back to a generic fixed message.
  async function apiRequest(url, options) {
    const res = await fetch(url, options);
    if (res.status === 401) {
      window.location.href = '/auth';
      return { redirected: true, status: 401, json: null };
    }
    let json = null;
    try { json = await res.json(); } catch (e) { json = null; }
    return { redirected: false, status: res.status, json };
  }

  function buildUrl() {
    const p = new URLSearchParams();
    const f = state.filters;
    if (f.text) p.set('text', f.text);
    if (f.eventType) p.set('event_type', f.eventType);
    if (f.outcome) p.set('outcome', f.outcome);
    if (f.from) p.set('from', f.from);
    if (f.to) p.set('to', f.to);
    p.set('limit', String(state.limit));
    p.set('offset', String(state.offset));
    return '/admin/api/logs?' + p.toString();
  }

  function setControlsDisabled(disabled) {
    [applyBtn, resetBtn, refreshBtn].forEach((b) => { if (b) b.disabled = disabled; });
    // prev/next are governed by updatePagination(), which also respects state.busy.
    updatePagination();
  }

  async function load() {
    if (state.busy) return;
    state.busy = true;
    setControlsDisabled(true);
    clearFilterError();
    setState('loading');
    refreshIcons();

    try {
      const r = await apiRequest(buildUrl());
      if (r.redirected) return;

      if (r.status === 200 && r.json && r.json.success === true &&
          Array.isArray(r.json.logs) && r.json.summary && r.json.pagination) {
        state.loadedOnce = true;
        renderResults(r.json);
      } else if (r.status === 400 && r.json && typeof r.json.message === 'string') {
        // Bad filter input: surface the server message inline and keep the
        // previous results visible if we already have a successful render.
        showFilterError(r.json.message);
        setState(state.loadedOnce && state.lastGoodState ? state.lastGoodState : 'error');
      } else if (r.status === 403) {
        showFilterError('You do not have permission to view system logs.');
        setState(state.loadedOnce && state.lastGoodState ? state.lastGoodState : 'error');
      } else {
        setState('error');
      }
    } catch (e) {
      setState('error');
    } finally {
      state.busy = false;
      setControlsDisabled(false);
      refreshIcons();
    }
  }

  // ---- Filter state transitions ----
  function readInputsIntoState() {
    state.filters = {
      text: searchInput ? searchInput.value.trim() : '',
      eventType: eventTypeSelect ? eventTypeSelect.value : '',
      outcome: outcomeSelect ? outcomeSelect.value : '',
      from: fromInput ? fromInput.value : '',
      to: toInput ? toInput.value : ''
    };
    state.offset = 0;
  }

  function clearInputsAndState() {
    if (searchInput) searchInput.value = '';
    if (eventTypeSelect) eventTypeSelect.value = '';
    if (outcomeSelect) outcomeSelect.value = '';
    if (fromInput) fromInput.value = '';
    if (toInput) toInput.value = '';
    state.filters = { text: '', eventType: '', outcome: '', from: '', to: '' };
    state.offset = 0;
  }

  // ---- Event wiring ----
  if (filtersForm) {
    filtersForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (state.busy) return;
      readInputsIntoState();
      load();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (state.busy) return;
      clearInputsAndState();
      load();
    });
  }

  if (filteredResetBtn) {
    filteredResetBtn.addEventListener('click', () => {
      if (state.busy) return;
      clearInputsAndState();
      load();
    });
  }

  // Refresh re-fetches the current applied filters + page (true refresh).
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      if (state.busy) return;
      load();
    });
  }

  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      if (state.busy) return;
      load();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (state.busy || state.offset <= 0) return;
      state.offset = Math.max(0, state.offset - state.limit);
      load();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (state.busy || !state.hasMore) return;
      state.offset = state.offset + state.limit;
      load();
    });
  }

  // ---- Initial load ----
  load();
});
