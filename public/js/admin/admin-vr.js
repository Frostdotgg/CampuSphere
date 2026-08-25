/* ========================================
   CampuSphere — Admin VR Client Script
   Milestone 7, Section 7.8.

   API-driven VR scene & hotspot management for /admin/vr. Every
   database-derived value is rendered through DOM APIs + textContent (never
   innerHTML interpolation), so a stored payload like <img src=x onerror=...>
   renders as inert text. Numeric ids are validated before they touch a
   dataset value or a URL.
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {

  // ---- DOM references ----
  const listEl = document.getElementById('vr-list');
  const loadingEl = document.getElementById('vr-loading');
  const errorEl = document.getElementById('vr-error');
  const emptyEl = document.getElementById('vr-empty');
  const filteredEmptyEl = document.getElementById('vr-filtered-empty');
  const retryBtn = document.getElementById('vr-retry-btn');
  const listLabel = document.getElementById('vr-list-label');
  const statTotal = document.getElementById('vr-stat-total');
  const statShowing = document.getElementById('vr-stat-showing');
  const searchInput = document.getElementById('vr-search-input');
  const addSceneBtn = document.getElementById('add-scene-btn');

  const sceneModal = document.getElementById('vr-scene-modal');
  const sceneModalTitle = document.getElementById('vr-scene-modal-title');
  const sceneForm = document.getElementById('vr-scene-form');
  const sceneSubmitBtn = document.getElementById('vr-scene-submit-btn');
  const sceneSubmitLabel = document.getElementById('vr-scene-submit-label');

  const hotspotModal = document.getElementById('vr-hotspot-modal');
  const hotspotModalTitle = document.getElementById('vr-hotspot-modal-title');
  const hotspotForm = document.getElementById('vr-hotspot-form');
  const hotspotSubmitBtn = document.getElementById('vr-hotspot-submit-btn');
  const hotspotSubmitLabel = document.getElementById('vr-hotspot-submit-label');
  const hotspotTypeSelect = document.getElementById('vr-hotspot-type');
  const hotspotTargetSelect = document.getElementById('vr-hotspot-target');
  const hotspotTargetGroup = document.getElementById('vr-hotspot-target-group');
  const hotspotTargetSearch = document.getElementById('vr-hotspot-target-search');
  const hotspotTargetStatus = document.getElementById('vr-hotspot-target-status');
  const hotspotScheduleGroup = document.getElementById('vr-hotspot-schedule-group');
  const hotspotScheduleSearch = document.getElementById('vr-hotspot-schedule-search');
  const hotspotScheduleSelect = document.getElementById('vr-hotspot-schedule-document');
  const hotspotScheduleStatus = document.getElementById('vr-hotspot-schedule-status');
  const hotspotSceneLabel = document.getElementById('vr-hotspot-scene-label');

  const deleteModal = document.getElementById('vr-delete-modal');
  const deleteTextEl = document.getElementById('vr-delete-text');
  const cancelDeleteBtn = document.getElementById('vr-cancel-delete-btn');
  const confirmDeleteBtn = document.getElementById('vr-confirm-delete-btn');

  const toast = document.getElementById('admin-toast');

  // ---- State ----
  let allScenes = [];
  let filter = { search: '' };
  let sceneMode = 'create';
  let editingSceneId = null;
  let hotspotMode = 'create';
  let editingHotspotId = null;
  let hotspotSceneId = null;          // scene a hotspot belongs to
  let hotspotTargetExcludeId = null;  // owner scene excluded from target options
  let pendingDelete = null;           // { kind:'scene'|'hotspot', id, sceneId }
  let requestBusy = false;
  let lastFocused = null;
  let roomScheduleDocuments = [];
  const SCHEDULE_PAGE_SIZE = 200;
  const SCHEDULE_MAX_ROWS = 2000;

  // ---- Small helpers ----
  function showToast(message, type) {
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'admin-toast admin-toast--' + (type || 'success') + ' admin-toast--show';
    setTimeout(() => { toast.classList.remove('admin-toast--show'); }, 4000);
  }
  function toId(v) { const n = Number(v); return (Number.isInteger(n) && n >= 1) ? n : null; }
  function numOf(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  function str(v) { return v == null ? '' : String(v); }
  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
  }

  function scheduleDocumentLabel(documentRow) {
    const location = str(documentRow.location_label) || 'Unnamed room';
    const floor = str(documentRow.floor_label);
    const building = str(documentRow.building_name) || ('Building #' + str(documentRow.building_id));
    const semester = str(documentRow.semester).replace(/-/g, ' ');
    return building + ' — ' + location + (floor ? ' · ' + floor : '') + ' · ' + semester + ' ' + str(documentRow.school_year);
  }

  function renderScheduleDocumentOptions(selectedId) {
    if (!hotspotScheduleSelect) return;
    const query = hotspotScheduleSearch ? hotspotScheduleSearch.value.trim().toLocaleLowerCase('en') : '';
    const selected = selectedId == null ? toId(hotspotScheduleSelect.value) : toId(selectedId);
    const matching = roomScheduleDocuments.filter((documentRow) =>
      !query || scheduleDocumentLabel(documentRow).toLocaleLowerCase('en').includes(query)
    );
    hotspotScheduleSelect.textContent = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = roomScheduleDocuments.length ? 'Select a room schedule…' : 'No room schedules available';
    hotspotScheduleSelect.appendChild(placeholder);
    matching.forEach((documentRow) => {
      const id = toId(documentRow.id);
      if (id === null) return;
      const option = document.createElement('option');
      option.value = String(id);
      option.textContent = scheduleDocumentLabel(documentRow);
      hotspotScheduleSelect.appendChild(option);
    });
    if (selected !== null && !matching.some((documentRow) => toId(documentRow.id) === selected)) {
      const stored = roomScheduleDocuments.find((documentRow) => toId(documentRow.id) === selected);
      const option = document.createElement('option');
      option.value = String(selected);
      option.textContent = stored ? scheduleDocumentLabel(stored) : 'Unavailable schedule #' + selected;
      hotspotScheduleSelect.appendChild(option);
    }
    hotspotScheduleSelect.value = selected === null ? '' : String(selected);
    if (hotspotScheduleStatus) {
      hotspotScheduleStatus.textContent = roomScheduleDocuments.length
        ? `${matching.length} of ${roomScheduleDocuments.length} room schedules shown.`
        : 'No room schedules exist yet. Create one from Admin Campus Map first.';
    }
  }

  function orderOf(s) { const n = Number(s && s.display_order); return Number.isFinite(n) ? n : 0; }
  function sortScenes(rows) {
    return rows.slice().sort((a, b) => {
      const byOrder = orderOf(a) - orderOf(b);
      if (byOrder !== 0) return byOrder;
      return (toId(a.id) || 0) - (toId(b.id) || 0);
    });
  }
  function applyFilter() {
    const q = filter.search.trim().toLowerCase();
    const sorted = sortScenes(allScenes);
    if (!q) return sorted;
    return sorted.filter((s) => {
      const hay = [s.scene_key, s.title, s.description].map(str).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  // ---- States ----
  function setState(state) {
    if (loadingEl) loadingEl.hidden = state !== 'loading';
    if (errorEl) errorEl.hidden = state !== 'error';
    if (emptyEl) emptyEl.hidden = state !== 'empty';
    if (filteredEmptyEl) filteredEmptyEl.hidden = state !== 'filtered-empty';
    if (listEl) listEl.hidden = state !== 'list';
  }

  function badge(text, cls) {
    const b = document.createElement('span');
    b.className = 'ui-badge ui-badge-outline vr-badge ' + (cls || '');
    b.textContent = text;
    return b;
  }

  // ---- Scene rendering ----
  function render() {
    const filtered = applyFilter();
    if (statTotal) statTotal.textContent = String(allScenes.length);
    if (statShowing) statShowing.textContent = String(filtered.length);
    if (listLabel) {
      listLabel.textContent = (filtered.length === allScenes.length)
        ? 'All Scenes (' + allScenes.length + ')'
        : 'Showing ' + filtered.length + ' of ' + allScenes.length + ' scenes';
    }
    if (allScenes.length === 0) { setState('empty'); refreshIcons(); return; }
    if (filtered.length === 0) { setState('filtered-empty'); refreshIcons(); return; }

    listEl.textContent = '';
    filtered.forEach((scene) => listEl.appendChild(buildSceneCard(scene)));
    setState('list');
    refreshIcons();
  }

  function buildSceneCard(scene) {
    const id = toId(scene.id);
    const card = document.createElement('div');
    card.className = 'vr-scene-card';
    if (id !== null) card.dataset.sceneId = String(id);

    // Head: toggle (key + title) + actions
    const head = document.createElement('div');
    head.className = 'vr-scene-head';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'vr-scene-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    const chev = document.createElement('i');
    chev.setAttribute('data-lucide', 'chevron-right');
    chev.className = 'h-4 w-4 shrink-0 text-muted-foreground vr-chevron';
    const titleWrap = document.createElement('span');
    titleWrap.className = 'vr-scene-titlewrap';
    const keySpan = document.createElement('span');
    keySpan.className = 'vr-scene-key';
    keySpan.textContent = str(scene.scene_key);
    const titleSpan = document.createElement('span');
    titleSpan.className = 'vr-scene-title';
    titleSpan.textContent = str(scene.title);
    titleWrap.appendChild(keySpan);
    titleWrap.appendChild(titleSpan);
    toggle.appendChild(chev);
    toggle.appendChild(titleWrap);

    const actions = document.createElement('div');
    actions.className = 'vr-scene-actions';
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'ui-button ui-button-outline ui-button-size-sm vr-action-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => { if (id !== null) openEditScene(id); });
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'ui-button ui-button-outline ui-button-size-sm text-destructive vr-action-btn';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => { if (id !== null) openDeleteScene(scene); });
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    head.appendChild(toggle);
    head.appendChild(actions);

    // Meta badges
    const meta = document.createElement('div');
    meta.className = 'vr-scene-meta';
    meta.appendChild(badge('order ' + orderOf(scene), 'vr-badge-muted'));
    if (scene.node_id != null) meta.appendChild(badge('node #' + numOf(scene.node_id), 'vr-badge-muted'));
    if (scene.building_id != null) meta.appendChild(badge('building #' + numOf(scene.building_id), 'vr-badge-muted'));
    meta.appendChild(badge(scene.image_url ? 'image set' : 'no image', 'vr-badge-muted'));
    // Section 10.6: badge only (never the raw public id).
    if (scene.cloudinary_public_id) meta.appendChild(badge('Cloudinary ID set', 'vr-badge-muted'));
    if (str(scene.description)) {
      const desc = document.createElement('p');
      desc.className = 'vr-scene-desc';
      desc.textContent = str(scene.description);
      meta.appendChild(desc);
    }

    // Hotspots panel (lazy)
    const panel = document.createElement('div');
    panel.className = 'vr-scene-hotspots';
    panel.hidden = true;

    const hHead = document.createElement('div');
    hHead.className = 'vr-hotspots-head';
    const hTitle = document.createElement('span');
    hTitle.className = 'vr-hotspots-title';
    hTitle.textContent = 'Hotspots';
    const addHotspotBtn = document.createElement('button');
    addHotspotBtn.type = 'button';
    addHotspotBtn.className = 'ui-button ui-button-outline ui-button-size-sm';
    addHotspotBtn.textContent = '+ Add Hotspot';
    addHotspotBtn.addEventListener('click', () => { if (id !== null) openCreateHotspot(id); });
    hHead.appendChild(hTitle);
    hHead.appendChild(addHotspotBtn);

    const hBody = document.createElement('div');
    hBody.className = 'vr-hotspots-body';

    panel.appendChild(hHead);
    panel.appendChild(hBody);

    toggle.addEventListener('click', () => {
      const open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      chev.setAttribute('data-lucide', open ? 'chevron-down' : 'chevron-right');
      refreshIcons();
      if (open && card.dataset.hotspotsLoaded !== 'true' && id !== null) {
        loadHotspots(id, hBody);
      }
    });

    card.appendChild(head);
    card.appendChild(meta);
    card.appendChild(panel);
    return card;
  }

  async function loadHotspots(sceneId, container) {
    const card = listEl.querySelector('.vr-scene-card[data-scene-id="' + sceneId + '"]');
    container.textContent = '';
    const loading = document.createElement('p');
    loading.className = 'vr-hotspots-note';
    loading.textContent = 'Loading hotspots…';
    container.appendChild(loading);
    try {
      const r = await apiRequest('/admin/api/vr/scenes/' + sceneId + '/hotspots');
      if (r.redirected) return;
      if (r.status === 200 && r.json && r.json.success === true && Array.isArray(r.json.hotspots)) {
        if (card) card.dataset.hotspotsLoaded = 'true';
        renderHotspots(sceneId, container, r.json.hotspots);
      } else {
        container.textContent = '';
        const err = document.createElement('p');
        err.className = 'vr-hotspots-note vr-hotspots-error';
        err.textContent = 'Could not load hotspots.';
        container.appendChild(err);
      }
    } catch (e) {
      container.textContent = '';
      const err = document.createElement('p');
      err.className = 'vr-hotspots-note vr-hotspots-error';
      err.textContent = 'Network error loading hotspots.';
      container.appendChild(err);
    }
  }

  function renderHotspots(sceneId, container, hotspots) {
    container.textContent = '';
    if (!hotspots.length) {
      const empty = document.createElement('p');
      empty.className = 'vr-hotspots-note';
      empty.textContent = 'No hotspots in this scene yet.';
      container.appendChild(empty);
      return;
    }
    hotspots.forEach((h) => container.appendChild(buildHotspotRow(h, sceneId)));
    refreshIcons();
  }

  function buildHotspotRow(h, sceneId) {
    const row = document.createElement('div');
    row.className = 'vr-hotspot-row';

    const left = document.createElement('div');
    left.className = 'vr-hotspot-info';

    const top = document.createElement('div');
    top.className = 'vr-hotspot-top';
    top.appendChild(badge(str(h.hotspot_type), 'vr-badge-type'));
    const label = document.createElement('span');
    label.className = 'vr-hotspot-label';
    label.textContent = str(h.label);
    top.appendChild(label);

    const sub = document.createElement('div');
    sub.className = 'vr-hotspot-sub';
    let subText = 'yaw ' + numOf(h.yaw) + ' · pitch ' + numOf(h.pitch) + ' · order ' + numOf(h.display_order);
    if (h.hotspot_type === 'scene' && h.target_scene_key) {
      subText += ' · → ' + str(h.target_scene_key);
    } else if (h.hotspot_type === 'schedule') {
      const documentId = toId(h.schedule_document_id);
      const documentRow = roomScheduleDocuments.find((candidate) => toId(candidate.id) === documentId);
      subText += documentRow
        ? ' · ' + scheduleDocumentLabel(documentRow)
        : (documentId === null ? ' · legacy schedule target — relink required' : ' · schedule #' + documentId);
    }
    sub.textContent = subText;

    left.appendChild(top);
    left.appendChild(sub);

    const acts = document.createElement('div');
    acts.className = 'vr-hotspot-actions';
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'ui-button ui-button-outline ui-button-size-sm vr-action-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => openEditHotspot(h, sceneId));
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'ui-button ui-button-outline ui-button-size-sm text-destructive vr-action-btn';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => openDeleteHotspot(h, sceneId));
    acts.appendChild(editBtn);
    acts.appendChild(delBtn);

    row.appendChild(left);
    row.appendChild(acts);
    return row;
  }

  // ---- API helper ----
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

  async function loadScheduleDocuments() {
    if (hotspotScheduleSelect) hotspotScheduleSelect.disabled = true;
    try {
      const documents = [];
      let total = 0;
      while (documents.length < SCHEDULE_MAX_ROWS) {
        const result = await apiRequest('/admin/api/room-schedule-documents?limit=200' +
          (documents.length ? '&offset=' + documents.length : ''));
        if (result.redirected) return;
        if (result.status !== 200 || !result.json || result.json.success !== true || !Array.isArray(result.json.documents)) {
          throw new Error('schedule list unavailable');
        }
        total = Number(result.json.total) || 0;
        if (total > SCHEDULE_MAX_ROWS) throw new Error('schedule list exceeds safe client bound');
        documents.push(...result.json.documents);
        if (result.json.documents.length < SCHEDULE_PAGE_SIZE || documents.length >= total) break;
      }
      if (documents.length !== total) throw new Error('incomplete schedule list');
      roomScheduleDocuments = documents;
      renderScheduleDocumentOptions();
    } catch (error) {
      roomScheduleDocuments = [];
      renderScheduleDocumentOptions();
      if (hotspotScheduleStatus) hotspotScheduleStatus.textContent = 'Unable to load room schedules. Reload this page to retry.';
    } finally {
      if (hotspotScheduleSelect) hotspotScheduleSelect.disabled = false;
    }
  }

  async function load() {
    setState('loading');
    refreshIcons();
    try {
      const r = await apiRequest('/admin/api/vr/scenes');
      if (r.redirected) return;
      if (r.status === 200 && r.json && r.json.success === true && Array.isArray(r.json.scenes)) {
        allScenes = r.json.scenes;
        render();
      } else {
        setState('error');
        refreshIcons();
      }
    } catch (e) {
      setState('error');
      refreshIcons();
    }
  }

  // ---- Modal helpers ----
  function openModal(m, focusEl) {
    if (!m) return;
    lastFocused = document.activeElement;
    m.classList.add('modal--open');
    document.body.style.overflow = 'hidden';
    const target = focusEl || m.querySelector('input, textarea, select, button');
    if (target && typeof target.focus === 'function') target.focus();
  }
  function closeModal(m) {
    if (!m) return;
    m.classList.remove('modal--open');
    if (!sceneModal.classList.contains('modal--open') &&
        !hotspotModal.classList.contains('modal--open') &&
        !deleteModal.classList.contains('modal--open')) {
      document.body.style.overflow = '';
    }
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    lastFocused = null;
  }
  function showFormError(m, msg) {
    const el = m ? m.querySelector('.form-error') : null;
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }
  function clearFormError(m) {
    const el = m ? m.querySelector('.form-error') : null;
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  }

  [sceneModal, hotspotModal, deleteModal].forEach((m) => {
    if (!m) return;
    m.addEventListener('click', (e) => {
      if (e.target === m && !requestBusy) {
        if (m === deleteModal) pendingDelete = null;
        closeModal(m);
      }
    });
    m.querySelectorAll('.modal-close-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (requestBusy) return;
        if (m === deleteModal) pendingDelete = null;
        closeModal(m);
      });
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || requestBusy) return;
    if (sceneModal.classList.contains('modal--open')) closeModal(sceneModal);
    else if (hotspotModal.classList.contains('modal--open')) closeModal(hotspotModal);
    else if (deleteModal.classList.contains('modal--open')) { pendingDelete = null; closeModal(deleteModal); }
  });

  // ---- Scene create / edit ----
  if (addSceneBtn) {
    addSceneBtn.addEventListener('click', () => {
      sceneMode = 'create';
      editingSceneId = null;
      if (sceneForm) sceneForm.reset();
      clearFormError(sceneModal);
      if (sceneModalTitle) sceneModalTitle.textContent = 'Add Scene';
      if (sceneSubmitLabel) sceneSubmitLabel.textContent = 'Create Scene';
      openModal(sceneModal, sceneForm ? sceneForm.scene_key : null);
    });
  }

  function openEditScene(id) {
    const scene = allScenes.find((s) => toId(s.id) === id);
    if (!scene || !sceneForm) return;
    sceneMode = 'edit';
    editingSceneId = id;
    sceneForm.reset();
    clearFormError(sceneModal);
    sceneForm.scene_key.value = str(scene.scene_key);
    sceneForm.title.value = str(scene.title);
    sceneForm.description.value = str(scene.description);
    sceneForm.image_url.value = str(scene.image_url);
    // Section 10.6: Cloudinary public id (set via .value DOM API — never innerHTML).
    if (sceneForm.cloudinary_public_id) sceneForm.cloudinary_public_id.value = str(scene.cloudinary_public_id);
    sceneForm.node_id.value = scene.node_id == null ? '' : String(numOf(scene.node_id));
    sceneForm.building_id.value = scene.building_id == null ? '' : String(numOf(scene.building_id));
    sceneForm.initial_yaw.value = String(numOf(scene.initial_yaw));
    sceneForm.initial_pitch.value = String(numOf(scene.initial_pitch));
    sceneForm.display_order.value = String(orderOf(scene));
    if (sceneModalTitle) sceneModalTitle.textContent = 'Edit Scene';
    if (sceneSubmitLabel) sceneSubmitLabel.textContent = 'Save Changes';
    openModal(sceneModal, sceneForm.scene_key);
  }

  if (sceneForm) {
    sceneForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (requestBusy) return;
      clearFormError(sceneModal);

      const payload = {
        scene_key: sceneForm.scene_key.value.trim(),
        title: sceneForm.title.value.trim(),
        description: sceneForm.description.value.trim(),
        image_url: sceneForm.image_url.value.trim(),
        cloudinary_public_id: sceneForm.cloudinary_public_id ? sceneForm.cloudinary_public_id.value.trim() : '',
        node_id: sceneForm.node_id.value.trim(),
        building_id: sceneForm.building_id.value.trim(),
        initial_yaw: sceneForm.initial_yaw.value.trim(),
        initial_pitch: sceneForm.initial_pitch.value.trim(),
        display_order: sceneForm.display_order.value.trim()
      };
      if (!payload.scene_key) { showFormError(sceneModal, 'Scene key is required.'); return; }
      if (!payload.title) { showFormError(sceneModal, 'Title is required.'); return; }

      requestBusy = true;
      if (sceneSubmitBtn) sceneSubmitBtn.disabled = true;
      const url = sceneMode === 'edit' ? '/admin/api/vr/scenes/' + editingSceneId : '/admin/api/vr/scenes';
      const method = sceneMode === 'edit' ? 'PUT' : 'POST';
      try {
        const r = await apiRequest(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (r.redirected) return;
        if (r.json && r.json.success === true && r.json.scene) {
          closeModal(sceneModal);
          showToast(sceneMode === 'edit' ? 'Scene updated successfully.' : 'Scene created successfully.', 'success');
          await load();
        } else if (r.status === 403) {
          showFormError(sceneModal, 'You do not have permission to perform this action.');
        } else if (r.json && typeof r.json.message === 'string') {
          showFormError(sceneModal, r.json.message);
        } else {
          showFormError(sceneModal, 'Something went wrong. Please try again.');
        }
      } catch (err) {
        showFormError(sceneModal, 'Network error. Please try again.');
      } finally {
        requestBusy = false;
        if (sceneSubmitBtn) sceneSubmitBtn.disabled = false;
      }
    });
  }

  // ---- Hotspot create / edit ----
  // Target-scene search: a local, case-insensitive partial filter over the
  // already-loaded allScenes collection (scene_key OR title). No network
  // request is made while typing. The native <select name="target_scene_id">
  // stays the submitted control; its options are rebuilt with createElement +
  // textContent only, keeping the existing display-order/id sort and the
  // owner-scene exclusion.
  function targetSceneLabel(s) { return str(s.scene_key) + ' — ' + str(s.title); }

  function announceTargetStatus(msg) {
    if (hotspotTargetStatus) hotspotTargetStatus.textContent = msg;
  }

  // Rebuild the target options for the current search query. When
  // `explicitSelectedId` is passed (may be null for "none"), it wins;
  // otherwise the select's current value is preserved. A selection that no
  // longer matches the query is kept and marked "(current selection)" rather
  // than silently cleared.
  function renderTargetOptions(explicitSelectedId) {
    if (!hotspotTargetSelect) return;
    const preservedId = explicitSelectedId !== undefined
      ? (explicitSelectedId != null ? toId(explicitSelectedId) : null)
      : (hotspotTargetSelect.value !== '' ? toId(hotspotTargetSelect.value) : null);
    const q = hotspotTargetSearch ? hotspotTargetSearch.value.trim().toLowerCase() : '';

    while (hotspotTargetSelect.options.length > 1) hotspotTargetSelect.remove(1);

    const eligible = sortScenes(allScenes).filter((s) => {
      const sid = toId(s.id);
      return sid !== null && sid !== hotspotTargetExcludeId;
    });
    const matches = q === '' ? eligible : eligible.filter((s) =>
      str(s.scene_key).toLowerCase().includes(q) ||
      str(s.title).toLowerCase().includes(q));
    const preservedMatches = preservedId !== null &&
      matches.some((s) => toId(s.id) === preservedId);

    // A preserved selection outside the current matches stays available,
    // clearly marked, directly under the placeholder.
    if (preservedId !== null && !preservedMatches) {
      const kept = eligible.find((s) => toId(s.id) === preservedId);
      const keptOpt = document.createElement('option');
      keptOpt.value = String(preservedId);
      keptOpt.textContent = (kept ? targetSceneLabel(kept) : 'Scene #' + preservedId) + ' (current selection)';
      hotspotTargetSelect.appendChild(keptOpt);
    }

    matches.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = String(toId(s.id));
      opt.textContent = targetSceneLabel(s);
      hotspotTargetSelect.appendChild(opt);
    });

    if (matches.length === 0 && preservedId === null) {
      const none = document.createElement('option');
      none.value = '';
      none.disabled = true;
      none.textContent = 'No matching scenes';
      hotspotTargetSelect.appendChild(none);
    }

    hotspotTargetSelect.value = preservedId !== null ? String(preservedId) : '';

    let msg;
    if (q !== '' && matches.length === 0) {
      msg = 'No matching scenes.';
    } else if (q !== '') {
      msg = 'Showing ' + matches.length + ' of ' + eligible.length + ' target scenes.';
    } else {
      msg = matches.length + (matches.length === 1 ? ' target scene available.' : ' target scenes available.');
    }
    if (preservedId !== null && !preservedMatches) msg += ' Current selection kept.';
    announceTargetStatus(msg);
  }

  // Entry point used by the create/edit openers: records the owner scene to
  // exclude, resets the search box, and renders the full eligible list with
  // the stored selection (edit) or none (create).
  function populateTargetSelect(excludeSceneId, selectedId) {
    hotspotTargetExcludeId = excludeSceneId != null ? toId(excludeSceneId) : null;
    if (hotspotTargetSearch) hotspotTargetSearch.value = '';
    renderTargetOptions(selectedId != null ? selectedId : null);
  }

  if (hotspotTargetSearch) {
    hotspotTargetSearch.addEventListener('input', () => { renderTargetOptions(); });
  }
  if (hotspotScheduleSearch) {
    hotspotScheduleSearch.addEventListener('input', () => { renderScheduleDocumentOptions(); });
  }

  function applyHotspotTypeUi() {
    const type = hotspotTypeSelect ? hotspotTypeSelect.value : '';
    const isScene = type === 'scene';
    const isSchedule = type === 'schedule';
    if (hotspotTargetSelect) hotspotTargetSelect.disabled = !isScene;
    if (hotspotTargetSearch) hotspotTargetSearch.disabled = !isScene;
    if (hotspotTargetGroup) hotspotTargetGroup.style.display = isScene ? '' : 'none';
    if (!isScene) {
      if (hotspotTargetSelect) hotspotTargetSelect.value = '';
      // Clear any active search so returning to type "scene" shows the full
      // eligible list again (selection was already cleared above).
      if (hotspotTargetSearch && hotspotTargetSearch.value !== '') {
        hotspotTargetSearch.value = '';
        renderTargetOptions(null);
      }
    }
    if (hotspotScheduleGroup) hotspotScheduleGroup.style.display = isSchedule ? '' : 'none';
    if (!isSchedule) {
      if (hotspotScheduleSearch) hotspotScheduleSearch.value = '';
      if (hotspotScheduleSelect) hotspotScheduleSelect.value = '';
      renderScheduleDocumentOptions(null);
    }
  }
  if (hotspotTypeSelect) hotspotTypeSelect.addEventListener('change', applyHotspotTypeUi);

  function openCreateHotspot(sceneId) {
    const scene = allScenes.find((s) => toId(s.id) === sceneId);
    if (!hotspotForm) return;
    hotspotMode = 'create';
    editingHotspotId = null;
    hotspotSceneId = sceneId;
    hotspotForm.reset();
    clearFormError(hotspotModal);
    hotspotTypeSelect.value = 'scene';
    populateTargetSelect(sceneId, null);
    applyHotspotTypeUi();
    if (hotspotSceneLabel) hotspotSceneLabel.textContent = scene ? ('Scene: ' + str(scene.scene_key)) : '';
    if (hotspotModalTitle) hotspotModalTitle.textContent = 'Add Hotspot';
    if (hotspotSubmitLabel) hotspotSubmitLabel.textContent = 'Create Hotspot';
    openModal(hotspotModal, hotspotTypeSelect);
  }

  function openEditHotspot(h, sceneId) {
    const scene = allScenes.find((s) => toId(s.id) === sceneId);
    const hid = toId(h.id);
    if (!hotspotForm || hid === null) return;
    hotspotMode = 'edit';
    editingHotspotId = hid;
    hotspotSceneId = sceneId;
    hotspotForm.reset();
    clearFormError(hotspotModal);
    hotspotTypeSelect.value = ['scene', 'info', 'exit', 'schedule'].indexOf(str(h.hotspot_type)) !== -1 ? str(h.hotspot_type) : 'info';
    hotspotForm.label.value = str(h.label);
    hotspotForm.text.value = str(h.text);
    hotspotForm.yaw.value = String(numOf(h.yaw));
    hotspotForm.pitch.value = String(numOf(h.pitch));
    hotspotForm.display_order.value = String(numOf(h.display_order));
    if (hotspotScheduleSearch) hotspotScheduleSearch.value = '';
    renderScheduleDocumentOptions(toId(h.schedule_document_id));
    populateTargetSelect(sceneId, h.target_scene_id != null ? toId(h.target_scene_id) : null);
    applyHotspotTypeUi();
    if (hotspotSceneLabel) hotspotSceneLabel.textContent = scene ? ('Scene: ' + str(scene.scene_key)) : '';
    if (hotspotModalTitle) hotspotModalTitle.textContent = 'Edit Hotspot';
    if (hotspotSubmitLabel) hotspotSubmitLabel.textContent = 'Save Changes';
    openModal(hotspotModal, hotspotTypeSelect);
  }

  if (hotspotForm) {
    hotspotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (requestBusy) return;
      clearFormError(hotspotModal);

      const type = hotspotTypeSelect.value;
      const payload = {
        hotspot_type: type,
        label: hotspotForm.label.value.trim(),
        text: hotspotForm.text.value.trim(),
        yaw: hotspotForm.yaw.value.trim(),
        pitch: hotspotForm.pitch.value.trim(),
        display_order: hotspotForm.display_order.value.trim()
      };
      if (!payload.label) { showFormError(hotspotModal, 'Label is required.'); return; }
      if (type === 'scene') {
        const t = hotspotTargetSelect.value.trim();
        if (!t) { showFormError(hotspotModal, 'A scene hotspot requires a target scene.'); return; }
        payload.target_scene_id = t;
      } else if (type === 'schedule') {
        const documentId = hotspotScheduleSelect ? hotspotScheduleSelect.value.trim() : '';
        if (!documentId) { showFormError(hotspotModal, 'Select a room schedule for this hotspot.'); return; }
        payload.schedule_document_id = documentId;
      }

      requestBusy = true;
      if (hotspotSubmitBtn) hotspotSubmitBtn.disabled = true;
      const url = hotspotMode === 'edit'
        ? '/admin/api/vr/hotspots/' + editingHotspotId
        : '/admin/api/vr/scenes/' + hotspotSceneId + '/hotspots';
      const method = hotspotMode === 'edit' ? 'PUT' : 'POST';
      try {
        const r = await apiRequest(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (r.redirected) return;
        if (r.json && r.json.success === true && r.json.hotspot) {
          closeModal(hotspotModal);
          showToast(hotspotMode === 'edit' ? 'Hotspot updated successfully.' : 'Hotspot created successfully.', 'success');
          await reloadSceneHotspots(hotspotSceneId);
        } else if (r.status === 403) {
          showFormError(hotspotModal, 'You do not have permission to perform this action.');
        } else if (r.json && typeof r.json.message === 'string') {
          showFormError(hotspotModal, r.json.message);
        } else {
          showFormError(hotspotModal, 'Something went wrong. Please try again.');
        }
      } catch (err) {
        showFormError(hotspotModal, 'Network error. Please try again.');
      } finally {
        requestBusy = false;
        if (hotspotSubmitBtn) hotspotSubmitBtn.disabled = false;
      }
    });
  }

  // Re-fetch and re-render the hotspot panel for one scene (keeps it expanded).
  async function reloadSceneHotspots(sceneId) {
    const card = listEl.querySelector('.vr-scene-card[data-scene-id="' + sceneId + '"]');
    if (!card) return;
    const panel = card.querySelector('.vr-scene-hotspots');
    const body = card.querySelector('.vr-hotspots-body');
    const toggle = card.querySelector('.vr-scene-toggle');
    const chev = card.querySelector('.vr-chevron');
    if (panel && panel.hidden) {
      panel.hidden = false;
      if (toggle) toggle.setAttribute('aria-expanded', 'true');
      if (chev) chev.setAttribute('data-lucide', 'chevron-down');
    }
    if (body) await loadHotspots(sceneId, body);
    refreshIcons();
  }

  // ---- Delete ----
  function openDeleteScene(scene) {
    const id = toId(scene.id);
    if (id === null) return;
    pendingDelete = { kind: 'scene', id, sceneId: id };
    if (deleteTextEl) {
      deleteTextEl.textContent = 'Delete the scene "' + str(scene.scene_key) + '"? Its own hotspots are removed too.';
    }
    openModal(deleteModal, confirmDeleteBtn);
  }
  function openDeleteHotspot(h, sceneId) {
    const id = toId(h.id);
    if (id === null) return;
    pendingDelete = { kind: 'hotspot', id, sceneId };
    if (deleteTextEl) deleteTextEl.textContent = 'Delete the hotspot "' + str(h.label) + '"?';
    openModal(deleteModal, confirmDeleteBtn);
  }

  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', () => {
      if (requestBusy) return;
      pendingDelete = null;
      closeModal(deleteModal);
    });
  }

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
      if (requestBusy || !pendingDelete) return;
      const job = pendingDelete;
      requestBusy = true;
      confirmDeleteBtn.disabled = true;
      const url = job.kind === 'scene'
        ? '/admin/api/vr/scenes/' + job.id
        : '/admin/api/vr/hotspots/' + job.id;
      try {
        const r = await apiRequest(url, { method: 'DELETE' });
        if (r.redirected) return;
        if (r.json && r.json.success === true) {
          closeModal(deleteModal);
          showToast(job.kind === 'scene' ? 'Scene deleted successfully.' : 'Hotspot deleted successfully.', 'success');
          if (job.kind === 'scene') { await load(); }
          else { await reloadSceneHotspots(job.sceneId); }
        } else if (r.status === 403) {
          showToast('You do not have permission to perform this action.', 'error');
        } else if (r.json && typeof r.json.message === 'string') {
          // e.g. 409 scene targeted by hotspots
          showToast(r.json.message, 'error');
          closeModal(deleteModal);
        } else {
          showToast('Something went wrong. Please try again.', 'error');
        }
      } catch (err) {
        showToast('Network error. Please try again.', 'error');
      } finally {
        pendingDelete = null;
        requestBusy = false;
        confirmDeleteBtn.disabled = false;
      }
    });
  }

  // ---- Search / retry ----
  if (searchInput) {
    searchInput.addEventListener('input', () => { filter.search = searchInput.value; render(); });
  }
  if (retryBtn) retryBtn.addEventListener('click', () => load());

  // ---- Initial load ----
  loadScheduleDocuments();
  load();
});
