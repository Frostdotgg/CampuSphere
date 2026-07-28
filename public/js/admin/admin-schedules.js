/* ========================================
   CampuSphere — Admin Room Schedules Script
   Milestone 11, Section 11.5 — CRUD for /admin/api/schedules
   All DB-derived values are rendered with createElement/textContent only;
   nothing from the API is ever assigned to innerHTML. The CSRF header is
   attached by the shared fetch shim in main.js.
   ======================================== */
document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  // ---- State ----
  let buildings = [];
  try { buildings = JSON.parse($('buildings-data-json').textContent) || []; } catch (e) { buildings = []; }
  // M12.P1-D4 request race control: `requestId` is monotonic and `inFlight`
  // aborts the previous list request, so only the newest response may touch
  // results, counts, metadata, errors, or the busy state.
  const state = {
    schedules: [], editId: null, pendingDeleteId: null, busy: false,
    requestId: 0, inFlight: null, listBusy: false,
    // True once the ADMIN edits a date. The server echo writes the applied
    // window back into the inputs, so this flag (not the input values) is what
    // distinguishes "the user narrowed the dates" from "the server told us its
    // default" — it keeps the rolling default fresh and makes a user-chosen
    // window count as an active filter.
    userDates: false,
    // M12.P1-D4 corrective: the building refresh has its OWN request id and
    // controller. It must never share state with the schedule-list request,
    // so neither can abort, supersede, or unbusy the other.
    buildingsRequestId: 0, buildingsInFlight: null,
    // One-shot notice announced through the result status live region.
    pendingStatusNotice: null,
  };

  // ---- DOM ----
  const card = $('schedule-card');
  if (!card) return;
  const listEl = $('schedule-list');
  const loadingEl = $('schedule-loading');
  const errorEl = $('schedule-error');
  const emptyEl = $('schedule-empty');
  const modal = $('schedule-modal');
  const deleteModal = $('schedule-delete-modal');
  const form = $('schedule-form');
  const toast = $('admin-toast');

  // ---- Toast ----
  function showToast(msg, type) {
    if (!toast) return;
    toast.textContent = msg;
    toast.className = 'admin-toast admin-toast--' + (type || 'success') + ' admin-toast--show';
    setTimeout(() => { toast.classList.remove('admin-toast--show'); }, 4000);
  }

  // ---- API ----
  async function apiRequest(url, options) {
    const res = await fetch(url, Object.assign({ headers: { Accept: 'application/json' } }, options));
    let json = null;
    try { json = await res.json(); } catch (e) { /* non-JSON body */ }
    return { status: res.status, json };
  }

  // ---- Modals ----
  function openModal(m, focusEl) {
    if (!m) return;
    m.classList.add('modal--open');
    if (focusEl && typeof focusEl.focus === 'function') setTimeout(() => focusEl.focus(), 0);
  }
  function closeModal(m) {
    if (!m) return;
    m.classList.remove('modal--open');
  }
  [modal, deleteModal].forEach((m) => {
    if (!m) return;
    m.addEventListener('click', (e) => { if (e.target === m && !state.busy) { state.pendingDeleteId = null; closeModal(m); } });
    m.querySelectorAll('.modal-close-btn').forEach((b) => b.addEventListener('click', () => { if (state.busy) return; state.pendingDeleteId = null; closeModal(m); }));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || state.busy) return;
    [modal, deleteModal].forEach((m) => { if (m && m.classList.contains('modal--open')) { state.pendingDeleteId = null; closeModal(m); } });
  });

  function setFormError(msg) {
    const el = form ? form.querySelector('.form-error') : null;
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? 'block' : 'none';
  }

  // ---- Building selects (from buildings-data-json; textContent only) ----
  function fillBuildingSelect(select, includeAllOption, filterText, keepValue) {
    if (!select) return { shown: 0, preservedOutsideMatches: false };
    // Preserve the current selection across a re-filter so an admin cannot
    // silently lose the building they already chose.
    const selected = keepValue !== undefined ? keepValue : select.value;
    const needle = String(filterText || '').trim().toLowerCase();
    while (select.firstChild) select.removeChild(select.firstChild);
    const first = document.createElement('option');
    first.value = '';
    first.textContent = includeAllOption ? 'All buildings' : 'Select a building…';
    select.appendChild(first);
    let shown = 0;
    buildings.forEach((b) => {
      const name = b.name || ('Building ' + b.id);
      const isSelected = String(b.id) === String(selected) && String(selected) !== '';
      // A non-matching option is still rendered when it is the current
      // selection, so the chosen value always survives filtering.
      if (needle && String(name).toLowerCase().indexOf(needle) === -1 && !isSelected) return;
      if (!needle || String(name).toLowerCase().indexOf(needle) !== -1) shown += 1;
      const opt = document.createElement('option');
      opt.value = String(b.id);
      opt.textContent = name; // textContent only — never innerHTML
      select.appendChild(opt);
    });
    select.value = selected || '';
    // A preserved non-matching selection is rendered but not counted as a match.
    const preservedOutsideMatches = !!needle && String(selected || '') !== '' &&
      !buildings.some((b) => String(b.id) === String(selected) &&
        String(b.name || ('Building ' + b.id)).toLowerCase().indexOf(needle) !== -1);
    return { shown: needle ? shown : buildings.length, preservedOutsideMatches };
  }
  fillBuildingSelect($('schedule-filter-building'), true);
  fillBuildingSelect($('schedule-building'), false);

  // ---- Modal building search (Add/Edit Schedule) ----
  const buildingSearchEl = $('schedule-building-search');
  const buildingCountEl = $('schedule-building-count');
  // The count reports MATCHES; when the preserved selection is not one of them
  // it is announced too, so the spoken count matches what the select contains.
  function updateBuildingCount(shown, extraSelection) {
    if (!buildingCountEl) return;
    buildingCountEl.textContent = buildings.length === 0
      ? 'No buildings available.'
      : 'Showing ' + shown + ' of ' + buildings.length + ' buildings.' +
        (extraSelection ? ' Your current selection is also listed.' : '');
  }
  function resetBuildingSearch(selectedValue) {
    if (buildingSearchEl) buildingSearchEl.value = '';
    const r = fillBuildingSelect($('schedule-building'), false, '', selectedValue);
    updateBuildingCount(r.shown, r.preservedOutsideMatches);
  }
  if (buildingSearchEl) {
    buildingSearchEl.addEventListener('input', () => {
      const r = fillBuildingSelect($('schedule-building'), false, buildingSearchEl.value);
      updateBuildingCount(r.shown, r.preservedOutsideMatches);
    });
  }

  /* ---- Same-page building refresh (M12.P1-D4 corrective) ----------------
     admin-buildings.js broadcasts the no-payload campusphere:buildings-changed
     event after a building create/update/delete on this same page. Without
     consuming it, the schedule filter, the Add/Edit selector, and — because
     the schedule text search matches building NAMES — the result list all go
     stale until a full reload.

     Contract:
       - own request id + AbortController; the schedule-list request is never
         aborted, superseded, or unbusied by this path;
       - only the NEWEST successful response may replace the buildings array
         or touch a selector;
       - a response must be HTTP 200, success:true, and carry an array;
       - any other outcome keeps the previous buildings AND selections and
         reports one fixed recoverable message through the existing toast;
       - selections are preserved BY ID, renames re-label, new buildings
         appear, and an id that no longer exists is cleared deliberately with
         fixed feedback instead of silently submitting stale state;
       - the modal's search text and focus are never touched, and the modal is
         never closed or reset. */
  const BUILDING_REFRESH_FAILED_MESSAGE =
    'Could not refresh the building list. Showing the previously loaded buildings.';
  const FILTER_BUILDING_REMOVED_MESSAGE =
    'The building you had filtered by no longer exists. The building filter was cleared.';
  const MODAL_BUILDING_REMOVED_MESSAGE =
    'The building you had selected no longer exists. Please choose a building again.';

  async function refreshBuildings() {
    const id = ++state.buildingsRequestId;
    if (state.buildingsInFlight) {
      try { state.buildingsInFlight.abort(); } catch (e) { /* already settled */ }
    }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    state.buildingsInFlight = controller;
    const isCurrent = () => state.buildingsRequestId === id;

    // Captured BEFORE anything is rebuilt.
    const filterSel = $('schedule-filter-building');
    const modalSel = $('schedule-building');
    const prevFilterId = filterSel ? String(filterSel.value || '') : '';
    const prevModalId = modalSel ? String(modalSel.value || '') : '';
    const prevSearchText = buildingSearchEl ? buildingSearchEl.value : '';

    let fresh = null;
    try {
      const res = await fetch('/admin/api/buildings', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal: controller ? controller.signal : undefined,
      });
      if (!isCurrent()) return; // superseded by a newer refresh
      let json = null;
      try { json = await res.json(); } catch (e) { json = null; }
      if (!isCurrent()) return;
      if (res.status !== 200 || !json || json.success !== true || !Array.isArray(json.buildings)) {
        showToast(BUILDING_REFRESH_FAILED_MESSAGE, 'error');
        return; // previous buildings and selections are left untouched
      }
      fresh = json.buildings;
    } catch (e) {
      // An aborted refresh is a supersede, not a failure.
      if (e && (e.name === 'AbortError' || e.code === 20)) return;
      if (!isCurrent()) return;
      showToast(BUILDING_REFRESH_FAILED_MESSAGE, 'error');
      return;
    } finally {
      if (isCurrent()) state.buildingsInFlight = null;
    }
    if (!isCurrent() || !fresh) return;

    // Only a current, well-formed response gets this far. It is sorted by NAME
    // to match the server-rendered first-paint order (adminController sorts by
    // name; /admin/api/buildings sorts by id), so a refresh never silently
    // reshuffles both selectors from A-Z into insertion order.
    buildings = fresh.slice().sort((a, b) =>
      String(a && a.name ? a.name : '').localeCompare(String(b && b.name ? b.name : '')));

    const stillExists = (value) =>
      value !== '' && buildings.some((b) => String(b.id) === String(value));
    const keepFilter = stillExists(prevFilterId);
    const keepModal = stillExists(prevModalId);

    // Rebuild both selectors from the fresh list. Options are created with
    // textContent only, so a renamed building simply re-labels and a new one
    // appears. The modal keeps its existing search text.
    fillBuildingSelect(filterSel, true, '', keepFilter ? prevFilterId : '');
    const r = fillBuildingSelect(modalSel, false, prevSearchText, keepModal ? prevModalId : '');
    updateBuildingCount(r.shown, r.preservedOutsideMatches);

    // A selection that disappeared is cleared DELIBERATELY, with fixed
    // feedback, so nothing stale is filtered or submitted silently. The
    // filter notice is ALSO queued into the result status: that is the only
    // live region here, and without it a screen-reader user would hear just
    // the broadened result and never learn the filter was dropped.
    if (prevFilterId !== '' && !keepFilter) {
      showToast(FILTER_BUILDING_REMOVED_MESSAGE, 'error');
      state.pendingStatusNotice = FILTER_BUILDING_REMOVED_MESSAGE;
    }
    // Only worth writing while the modal is actually open; resetForm() clears
    // it on the next open in any case.
    if (prevModalId !== '' && !keepModal &&
        modal && modal.classList.contains('modal--open')) {
      setFormError(MODAL_BUILDING_REMOVED_MESSAGE);
    }

    // Exactly one rerun, reusing whatever q/date/audience/status and still
    // valid building filter the controls currently hold. Required because the
    // text search matches building names, which may have just changed.
    loadSchedules();
  }
  document.addEventListener('campusphere:buildings-changed', refreshBuildings);

  // ---- List states ----
  const filteredEmptyEl = $('schedule-filtered-empty');
  const statusEl = $('schedule-result-status');
  function showState(which) {
    if (loadingEl) loadingEl.hidden = which !== 'loading';
    if (errorEl) errorEl.hidden = which !== 'error';
    if (emptyEl) emptyEl.hidden = which !== 'empty';
    if (filteredEmptyEl) filteredEmptyEl.hidden = which !== 'filtered-empty';
    if (listEl) listEl.hidden = which !== 'list';
  }

  // Any filter narrowing the default view (used to tell "nothing scheduled"
  // apart from "nothing matches your filters"). A date window the ADMIN chose
  // counts; the server's own default window does not.
  function hasActiveFilters(applied) {
    if (!applied) return false;
    return !!(applied.q || applied.buildingId || applied.audience || applied.status ||
      state.userDates);
  }

  function setListBusy(busy) {
    state.listBusy = busy;
    const applyBtn = $('schedule-apply-filters');
    if (applyBtn) {
      applyBtn.disabled = busy;
      applyBtn.setAttribute('aria-busy', busy ? 'true' : 'false');
    }
  }

  // "July 20" style label for the applied window; falls back to the raw
  // ISO date if the browser cannot parse it.
  function prettyDate(ymd) {
    if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return String(ymd || '');
    const dt = new Date(ymd + 'T00:00:00');
    if (isNaN(dt.getTime())) return ymd;
    try {
      return dt.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    } catch (e) { return ymd; }
  }

  function setResultStatus(shown, total, applied) {
    if (!statusEl) return;
    if (!applied) { statusEl.textContent = ''; return; }
    // A queued one-shot notice (e.g. a building filter cleared because the
    // building no longer exists) is announced ahead of the result summary in
    // the same live region, then consumed.
    const notice = state.pendingStatusNotice ? state.pendingStatusNotice + ' ' : '';
    state.pendingStatusNotice = null;
    const window = ' ' + prettyDate(applied.from) + ' to ' + prettyDate(applied.to) + '.';
    statusEl.textContent = notice + (total === 0
      ? (hasActiveFilters(applied)
        ? 'No schedules match the current filters,' + window
        : 'No schedules' + window)
      : 'Showing ' + shown + ' of ' + total + ' schedule' + (total === 1 ? '' : 's') + ',' + window);
  }

  // Reflect the window the SERVER actually applied back into the date inputs,
  // so the effective default range is visible rather than guessed.
  function syncAppliedFilters(applied) {
    if (!applied) return;
    const from = $('schedule-filter-from');
    const to = $('schedule-filter-to');
    if (from && applied.from) from.value = applied.from;
    if (to && applied.to) to.value = applied.to;
  }

  function filterQuery() {
    const params = new URLSearchParams();
    const search = $('schedule-search');
    const b = $('schedule-filter-building');
    const from = $('schedule-filter-from');
    const to = $('schedule-filter-to');
    const aud = $('schedule-filter-audience');
    const st = $('schedule-filter-status');
    if (search && search.value.trim()) params.set('q', search.value.trim());
    if (b && b.value) params.set('buildingId', b.value);
    // Dates are sent only when the admin actually chose them, so the server's
    // rolling default window keeps re-deriving on a long-lived page.
    if (state.userDates) {
      if (from && from.value) params.set('from', from.value);
      if (to && to.value) params.set('to', to.value);
    }
    if (aud && aud.value) params.set('audience', aud.value);
    if (st && st.value) params.set('status', st.value);
    const qs = params.toString();
    return qs ? '?' + qs : '';
  }

  // ---- Render (createElement/textContent only; no DB value in innerHTML) ----
  function textDiv(className, text) {
    const el = document.createElement('div');
    el.className = className;
    el.textContent = text;
    return el;
  }

  function renderSchedules(applied) {
    if (!listEl) return;
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
    if (state.schedules.length === 0) {
      showState(hasActiveFilters(applied) ? 'filtered-empty' : 'empty');
      return;
    }

    state.schedules.forEach((s) => {
      const row = document.createElement('div');
      row.className = 'ui-card border-border';
      row.style.cssText = 'padding:0.75rem 1rem;margin-bottom:0.5rem;display:flex;flex-wrap:wrap;gap:0.75rem;align-items:center;justify-content:space-between;';

      const info = document.createElement('div');
      info.style.cssText = 'display:flex;flex-direction:column;gap:0.15rem;min-width:0;';
      const titleEl = textDiv('text-sm font-semibold text-foreground', s.title || '');
      const whenEl = textDiv('text-sm text-muted-foreground',
        (s.schedule_date || '') + '  ' + (s.start_time || '') + '–' + (s.end_time || ''));
      const whereParts = [s.building_name || ('Building #' + s.building_id), s.location_type, s.location_label];
      if (s.floor_label) whereParts.push(s.floor_label);
      const whereEl = textDiv('text-sm text-muted-foreground', whereParts.filter(Boolean).join(' · '));
      const metaEl = textDiv('text-sm text-muted-foreground', 'audience: ' + (s.audience || '') + ' · status: ' + (s.status || ''));
      info.appendChild(titleEl); info.appendChild(whenEl); info.appendChild(whereEl); info.appendChild(metaEl);

      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:0.5rem;flex-shrink:0;';
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'ui-button ui-button-outline ui-button-size-sm';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => openEdit(s.id));
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'ui-button ui-button-outline ui-button-size-sm';
      delBtn.style.color = 'var(--destructive)';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => openDelete(s));
      actions.appendChild(editBtn); actions.appendChild(delBtn);

      row.appendChild(info);
      row.appendChild(actions);
      listEl.appendChild(row);
    });
    showState('list');
  }

  /**
   * M12.P1-D4: only the newest request may render. Each call aborts the one
   * before it and carries a monotonic id; a superseded response — including a
   * SLOW EARLIER one that resolves after a faster later one — is dropped
   * before it can touch results, counts, metadata, errors, or busy state. An
   * AbortError is a normal supersede, never an error state.
   */
  async function loadSchedules() {
    const id = ++state.requestId;
    if (state.inFlight) { try { state.inFlight.abort(); } catch (e) { /* already settled */ } }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    state.inFlight = controller;
    const isCurrent = () => state.requestId === id;

    setListBusy(true);
    showState('loading');
    try {
      const r = await apiRequest('/admin/api/schedules' + filterQuery(),
        controller ? { signal: controller.signal } : undefined);
      if (!isCurrent()) return; // superseded: leave the newer request's UI alone
      if (r.status !== 200 || !r.json || r.json.success !== true) {
        const msg = (r.json && typeof r.json.message === 'string') ? r.json.message : null;
        const errText = $('schedule-error-text');
        // Sanitized server message (e.g. the search-length rule) or a fixed
        // fallback. Filters are intentionally left untouched so the admin can
        // correct and retry without re-entering them.
        if (errText) errText.textContent = msg || 'Could not load schedules.';
        if (statusEl) statusEl.textContent = msg || 'Could not load schedules.';
        showState('error');
        return;
      }
      const applied = r.json.appliedFilters || null;
      state.schedules = Array.isArray(r.json.schedules) ? r.json.schedules : [];
      const total = typeof r.json.total === 'number' ? r.json.total : state.schedules.length;
      syncAppliedFilters(applied);
      renderSchedules(applied);
      setResultStatus(state.schedules.length, total, applied);
    } catch (e) {
      // An aborted request is a supersede, not a failure.
      if (e && (e.name === 'AbortError' || e.code === 20)) return;
      if (!isCurrent()) return;
      const errText = $('schedule-error-text');
      if (errText) errText.textContent = 'Could not load schedules.';
      if (statusEl) statusEl.textContent = 'Could not load schedules.';
      showState('error');
    } finally {
      if (isCurrent()) { state.inFlight = null; setListBusy(false); }
    }
  }

  function clearFilters() {
    const search = $('schedule-search');
    if (search) search.value = '';
    ['schedule-filter-building', 'schedule-filter-from', 'schedule-filter-to',
      'schedule-filter-audience', 'schedule-filter-status'].forEach((id) => {
      const el = $(id);
      if (el) el.value = '';
    });
    state.userDates = false; // back to the server's rolling default window
    loadSchedules();
  }

  // ---- Create / Edit ----
  function resetForm() {
    if (!form) return;
    form.reset();
    setFormError('');
  }

  function openCreate() {
    state.editId = null;
    resetForm();
    resetBuildingSearch(''); // fresh, unfiltered list on every open
    const titleEl = $('schedule-modal-title');
    if (titleEl) titleEl.textContent = 'Add Schedule';
    const submitLabel = $('schedule-submit-label');
    if (submitLabel) submitLabel.textContent = 'Create Schedule';
    openModal(modal, $('schedule-building'));
  }

  function openEdit(id) {
    const s = state.schedules.find((x) => x.id === id);
    if (!s) return;
    state.editId = id;
    resetForm();
    // The building is populated BEFORE any filtering, and the reset seeds the
    // select with this row's building so the current value is always present.
    resetBuildingSearch(String(s.building_id));
    // Populate via .value assignments only (never markup).
    $('schedule-building').value = String(s.building_id);
    $('schedule-location-type').value = s.location_type || 'room';
    $('schedule-location-label').value = s.location_label || '';
    $('schedule-floor-label').value = s.floor_label || '';
    $('schedule-date').value = s.schedule_date || '';
    $('schedule-start-time').value = s.start_time || '';
    $('schedule-end-time').value = s.end_time || '';
    $('schedule-title').value = s.title || '';
    $('schedule-audience').value = s.audience || 'all';
    $('schedule-status').value = s.status || 'scheduled';
    $('schedule-description').value = s.description || '';
    const titleEl = $('schedule-modal-title');
    if (titleEl) titleEl.textContent = 'Edit Schedule';
    const submitLabel = $('schedule-submit-label');
    if (submitLabel) submitLabel.textContent = 'Save Changes';
    openModal(modal, $('schedule-building'));
  }

  async function submitSchedule(e) {
    e.preventDefault();
    if (state.busy) return;
    setFormError('');
    const payload = {
      title: $('schedule-title').value,
      schedule_date: $('schedule-date').value,
      start_time: $('schedule-start-time').value,
      end_time: $('schedule-end-time').value,
      audience: $('schedule-audience').value,
      status: $('schedule-status').value,
      building_id: $('schedule-building').value,
      location_type: $('schedule-location-type').value,
      location_label: $('schedule-location-label').value,
      floor_label: $('schedule-floor-label').value,
      description: $('schedule-description').value,
    };
    const isEdit = state.editId !== null;
    const url = isEdit ? '/admin/api/schedules/' + state.editId : '/admin/api/schedules';
    state.busy = true;
    try {
      const r = await apiRequest(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      if ((r.status === 200 || r.status === 201) && r.json && r.json.success === true) {
        closeModal(modal);
        showToast(isEdit ? 'Schedule updated.' : 'Schedule created.');
        loadSchedules();
      } else {
        setFormError((r.json && r.json.message) || 'Could not save the schedule.');
      }
    } catch (err) {
      setFormError('Could not save the schedule.');
    } finally {
      state.busy = false;
    }
  }

  // ---- Delete ----
  function openDelete(s) {
    state.pendingDeleteId = s.id;
    const text = $('schedule-delete-text');
    if (text) text.textContent = 'Are you sure you want to delete "' + (s.title || 'this schedule entry') + '"?';
    openModal(deleteModal, $('schedule-cancel-delete'));
  }

  async function confirmDelete() {
    if (state.busy || state.pendingDeleteId === null) return;
    state.busy = true;
    try {
      const r = await apiRequest('/admin/api/schedules/' + state.pendingDeleteId, { method: 'DELETE' });
      if (r.status === 200 && r.json && r.json.success === true) {
        showToast('Schedule deleted.');
      } else {
        showToast((r.json && r.json.message) || 'Could not delete the schedule.', 'error');
      }
    } catch (e) {
      showToast('Could not delete the schedule.', 'error');
    } finally {
      state.busy = false;
      state.pendingDeleteId = null;
      closeModal(deleteModal);
      loadSchedules();
    }
  }

  // ---- Wire up ----
  if (form) form.addEventListener('submit', submitSchedule);
  const addBtn = $('add-schedule-btn');
  if (addBtn) addBtn.addEventListener('click', openCreate);
  const applyBtn = $('schedule-apply-filters');
  if (applyBtn) applyBtn.addEventListener('click', loadSchedules);
  const clearBtn = $('schedule-clear-filters');
  if (clearBtn) clearBtn.addEventListener('click', clearFilters);
  // A date the admin picks is a real filter (and pins the window until Clear).
  ['schedule-filter-from', 'schedule-filter-to'].forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener('change', () => { state.userDates = true; });
  });
  // Enter in the search box applies; typing alone never calls the server.
  const searchEl = $('schedule-search');
  if (searchEl) {
    searchEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      loadSchedules();
    });
  }
  const retryBtn = $('schedule-retry');
  if (retryBtn) retryBtn.addEventListener('click', loadSchedules);
  const cancelDelete = $('schedule-cancel-delete');
  if (cancelDelete) cancelDelete.addEventListener('click', () => { state.pendingDeleteId = null; closeModal(deleteModal); });
  const confirmBtn = $('schedule-confirm-delete');
  if (confirmBtn) confirmBtn.addEventListener('click', confirmDelete);

  loadSchedules();
});
