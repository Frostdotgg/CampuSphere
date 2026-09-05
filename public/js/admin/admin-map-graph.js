/* ========================================
   CampuSphere — Admin Route / Graph Client Script
   Milestone 7, Section 7.9.

   API-driven management of campus routes (+ ordered steps), graph nodes, and
   directed edges on /admin/campus-map. Every database-derived value is rendered
   through DOM APIs + textContent (never innerHTML interpolation), so a stored
   payload like <img src=x onerror=...> renders as inert text. Numeric ids are
   validated before they touch a dataset value or a URL.
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);
  const toast = $('admin-toast');
  if (!$('graph-card')) return; // not on a page with the graph section

  const state = {
    tab: 'routes',
    routes: [], nodes: [], edges: [], buildings: [],
    loaded: { routes: false, nodes: false, edges: false },
    filter: { routes: '', nodes: '', edges: '' },
    busy: false, pendingDelete: null, lastFocused: null,
    routeMode: 'create', routeEditId: null,
    nodeMode: 'create', nodeEditId: null,
    edgeMode: 'create', edgeEditId: null,
    stepsRouteId: null
  };

  /* ---------- helpers ---------- */
  function showToast(msg, type) {
    if (!toast) return;
    toast.textContent = msg;
    toast.className = 'admin-toast admin-toast--' + (type || 'success') + ' admin-toast--show';
    setTimeout(() => { toast.classList.remove('admin-toast--show'); }, 4000);
  }
  function toId(v) { const n = Number(v); return (Number.isInteger(n) && n >= 1) ? n : null; }
  function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  function str(v) { return v == null ? '' : String(v); }
  function refreshIcons() { if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons(); }
  function truthy(v) { return v === true || v === 1 || v === '1' || v === 'true'; }

  async function apiRequest(url, options) {
    const res = await fetch(url, options);
    if (res.status === 401) { window.location.href = '/auth'; return { redirected: true, status: 401, json: null }; }
    let json = null; try { json = await res.json(); } catch (e) { json = null; }
    return { redirected: false, status: res.status, json };
  }

  // Keep the embedded building list in the same stable order used by the
  // destination dropdown. Filtering then performs only one linear scan per
  // keystroke; no request is made while an administrator is typing.
  function setBuildings(buildings) {
    state.buildings = (Array.isArray(buildings) ? buildings : []).slice()
      .sort((a, b) => str(a.name).localeCompare(str(b.name)));
  }

  // Buildings for the route destination select (embedded JSON already on page).
  function loadBuildings() {
    try {
      const el = $('buildings-data-json');
      const arr = el ? JSON.parse(el.textContent || '[]') : [];
      setBuildings(arr);
    } catch (e) { setBuildings([]); }
  }

  /* ---------- modal plumbing ---------- */
  function openModal(m, focusEl) {
    if (!m) return;
    state.lastFocused = document.activeElement;
    m.classList.add('modal--open');
    document.body.style.overflow = 'hidden';
    const t = focusEl || m.querySelector('input, textarea, select, button');
    if (t && typeof t.focus === 'function') t.focus();
  }
  function closeModal(m) {
    if (!m) return;
    m.classList.remove('modal--open');
    document.body.style.overflow = '';
    // RF.4 repair (Finding 3): closing/cancelling the edge modal discards the
    // geometry draft and invalidates any in-flight load/save (geoTeardownDraft
    // is a hoisted function declaration).
    if (m === $('edge-modal')) geoTeardownDraft();
    if (state.lastFocused && typeof state.lastFocused.focus === 'function') state.lastFocused.focus();
    state.lastFocused = null;
  }
  function showErr(m, msg) { const e = m ? m.querySelector('.form-error') : null; if (e) { e.textContent = msg; e.style.display = 'block'; } }
  function clearErr(m) { const e = m ? m.querySelector('.form-error') : null; if (e) { e.textContent = ''; e.style.display = 'none'; } }

  const MODALS = ['route-modal', 'steps-modal', 'node-modal', 'edge-modal', 'graph-delete-modal'].map($);
  MODALS.forEach((m) => {
    if (!m) return;
    m.addEventListener('click', (e) => { if (e.target === m && !state.busy) { if (m === $('graph-delete-modal')) state.pendingDelete = null; closeModal(m); } });
    m.querySelectorAll('.modal-close-btn').forEach((b) => b.addEventListener('click', () => { if (state.busy) return; if (m === $('graph-delete-modal')) state.pendingDelete = null; closeModal(m); }));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || state.busy) return;
    const open = MODALS.find((m) => m && m.classList.contains('modal--open'));
    if (open) { if (open === $('graph-delete-modal')) state.pendingDelete = null; closeModal(open); }
  });

  function badge(text, cls) { const b = document.createElement('span'); b.className = 'ui-badge ui-badge-outline vr-badge ' + (cls || 'vr-badge-muted'); b.textContent = text; return b; }
  function setState(entity, st) {
    ['loading', 'error', 'empty', 'filtered-empty'].forEach((s) => { const el = $(entity + '-' + s); if (el) el.hidden = st !== s; });
    const list = $(entity + '-list'); if (list) list.hidden = st !== 'list';
  }

  /* ---------- M12.P1-D4 local search helpers ----------
     The three panel searches match a trimmed, case-folded query against the
     EXACT fields the API returns for that entity (see fieldsFor* below), so a
     term an admin can see on a card is a term they can search. Values are read
     through str()/num() and only ever rendered via textContent. */
  function norm(v) { return str(v).toLowerCase(); }
  function matchesQuery(fields, q) {
    if (!q) return true;
    for (let i = 0; i < fields.length; i++) {
      if (norm(fields[i]).indexOf(q) !== -1) return true;
    }
    return false;
  }
  // Live "N of total" summary for a panel; also the accessible announcement.
  function setResultStatus(entity, shown, total, noun) {
    const el = $(entity + '-result-status');
    if (!el) return;
    if (total === 0) { el.textContent = ''; return; }
    el.textContent = 'Showing ' + shown + ' of ' + total + ' ' + noun + (total === 1 ? '' : 's') + '.';
  }
  // Building name for a node, resolved from the buildings payload already on
  // the page (the nodes API returns building_id only).
  function buildingNameForId(buildingId) {
    if (buildingId === null || buildingId === undefined || buildingId === '') return '';
    const match = state.buildings.find((b) => String(b.id) === String(buildingId));
    return match ? str(match.name) : '';
  }

  /* ---------- tabs ---------- */
  document.querySelectorAll('.graph-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const name = tab.getAttribute('data-graph-tab');
      state.tab = name;
      document.querySelectorAll('.graph-tab').forEach((t) => {
        const on = t === tab;
        t.classList.toggle('graph-tab--active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      document.querySelectorAll('.graph-panel').forEach((p) => { p.hidden = p.getAttribute('data-graph-panel') !== name; });
      if (!state.loaded[name]) loadEntity(name);
      refreshIcons();
    });
  });

  function loadEntity(name) {
    if (name === 'routes') loadRoutes();
    else if (name === 'nodes') loadNodes();
    else if (name === 'edges') loadEdges();
  }

  /* ============================================================ ROUTES */
  async function loadRoutes() {
    setState('route', 'loading'); refreshIcons();
    try {
      const r = await apiRequest('/admin/api/routes');
      if (r.redirected) return;
      if (r.status === 200 && r.json && r.json.success && Array.isArray(r.json.routes)) {
        state.routes = r.json.routes; state.loaded.routes = true; renderRoutes();
      } else { setState('route', 'error'); refreshIcons(); }
    } catch (e) { setState('route', 'error'); refreshIcons(); }
  }
  // Exact route fields returned by /admin/api/routes, plus the id.
  function fieldsForRoute(r) {
    return [r.title, r.start_label, r.destination_name, r.estimated_walk_time, r.id];
  }
  function filteredRoutes() {
    const q = state.filter.routes.trim().toLowerCase();
    const rows = state.routes.slice().sort((a, b) => str(a.title).localeCompare(str(b.title)));
    if (!q) return rows;
    return rows.filter((r) => matchesQuery(fieldsForRoute(r), q));
  }
  function renderRoutes() {
    const list = $('route-list');
    if (!state.routes.length) { setState('route', 'empty'); setResultStatus('route', 0, 0, 'route'); refreshIcons(); return; }
    const rows = filteredRoutes();
    setResultStatus('route', rows.length, state.routes.length, 'route');
    if (!rows.length) { setState('route', 'filtered-empty'); refreshIcons(); return; }
    list.textContent = '';
    rows.forEach((route) => list.appendChild(buildRouteCard(route)));
    setState('route', 'list'); refreshIcons();
  }
  function buildRouteCard(route) {
    const id = toId(route.id);
    const card = document.createElement('div'); card.className = 'vr-scene-card'; if (id !== null) card.dataset.routeId = String(id);
    const head = document.createElement('div'); head.className = 'vr-scene-head';
    const tw = document.createElement('div'); tw.className = 'vr-scene-titlewrap';
    const title = document.createElement('span'); title.className = 'vr-scene-title'; title.textContent = str(route.title); tw.appendChild(title);
    const sub = document.createElement('span'); sub.className = 'vr-scene-key'; sub.textContent = str(route.start_label) + ' → ' + str(route.destination_name || ('building #' + num(route.destination_building_id))); tw.appendChild(sub);
    const actions = document.createElement('div'); actions.className = 'vr-scene-actions';
    const stepsBtn = mkBtn('Steps', () => { if (id !== null) openStepsModal(route); });
    const editBtn = mkBtn('Edit', () => { if (id !== null) openRouteModal('edit', route); });
    const delBtn = mkBtn('Delete', () => { if (id !== null) openDelete('route', id, 'Delete the route "' + str(route.title) + '"? Its steps are removed too.'); }, true);
    actions.appendChild(stepsBtn); actions.appendChild(editBtn); actions.appendChild(delBtn);
    head.appendChild(tw); head.appendChild(actions);
    const meta = document.createElement('div'); meta.className = 'vr-scene-meta';
    if (route.estimated_walk_time) meta.appendChild(badge('⏱ ' + str(route.estimated_walk_time)));
    meta.appendChild(badge('dest #' + num(route.destination_building_id)));
    card.appendChild(head); card.appendChild(meta);
    return card;
  }
  function mkBtn(label, fn, danger) {
    const b = document.createElement('button'); b.type = 'button';
    b.className = 'ui-button ui-button-outline ui-button-size-sm vr-action-btn' + (danger ? ' text-destructive' : '');
    b.textContent = label; b.addEventListener('click', fn); return b;
  }

  /* BE.3 — keep the two admin panels in sync.

     A node/edge/geometry mutation can flip a building between routable and not,
     and a building create/rename/delete changes the destination dropdown. Without
     this, an admin who adds the missing route node still sees "Route setup
     required" on the card until a full page reload, and a newly created building
     is missing from the route-destination select. */
  function emitGraphChanged() {
    document.dispatchEvent(new CustomEvent('campusphere:route-graph-changed'));
  }

  // admin-buildings.js broadcasts this after a building create/update/delete.
  document.addEventListener('campusphere:buildings-changed', async function () {
    try {
      const res = await fetch('/admin/api/buildings', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || data.success !== true || !Array.isArray(data.buildings)) return;
      setBuildings(data.buildings);
      const select = $('route-dest');
      const search = $('route-dest-search');
      const shown = populateBuildingSelect(select ? select.value : null, search ? search.value : '');
      setBuildingSelectCount(shown);
    } catch (e) { /* fixed label only; never surface a raw error */ }
  });
  /**
   * Populate the route destination select with an optional local search.
   * The currently selected building is retained even when it is outside the
   * filter, so editing a route can never silently lose its saved destination.
   */
  function populateBuildingSelect(selectedId, filterText) {
    const sel = $('route-dest'); if (!sel) return 0;
    const selected = selectedId != null ? String(selectedId) : String(sel.value || '');
    const needle = String(filterText || '').trim().toLowerCase();
    while (sel.options.length > 1) sel.remove(1);
    let shown = 0;
    state.buildings.forEach((bl) => {
      const id = toId(bl.id); if (id === null) return;
      const label = str(bl.name) + ' (#' + id + ')';
      const matches = !needle || matchesQuery([bl.name, id, label], needle);
      if (matches) shown += 1;
      const isSelected = selected !== '' && String(id) === selected;
      if (!matches && !isSelected) return;
      const o = document.createElement('option');
      o.value = String(id); o.textContent = label; sel.appendChild(o);
    });
    sel.value = selected;
    return needle ? shown : state.buildings.length;
  }

  function setBuildingSelectCount(shown) {
    const el = $('route-dest-count');
    if (!el) return;
    const total = state.buildings.length;
    el.textContent = total === 0
      ? 'No buildings available.'
      : 'Showing ' + shown + ' of ' + total + ' buildings.';
  }

  function filterDestinationBuildings() {
    const search = $('route-dest-search');
    const select = $('route-dest');
    if (!search || !select) return;
    setBuildingSelectCount(populateBuildingSelect(select.value, search.value));
  }

  const destinationSearch = $('route-dest-search');
  if (destinationSearch) {
    destinationSearch.addEventListener('input', filterDestinationBuildings);
    // Prevent Enter in the search field from accidentally submitting the
    // route form while the administrator is still choosing a destination.
    destinationSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') e.preventDefault();
    });
  }

  function openRouteModal(mode, route) {
    const m = $('route-modal'); const form = $('route-form'); if (!form) return;
    state.routeMode = mode; state.routeEditId = mode === 'edit' && route ? toId(route.id) : null;
    form.reset(); clearErr(m);
    const destinationSearch = $('route-dest-search');
    if (destinationSearch) destinationSearch.value = '';
    const selectedDestination = mode === 'edit' && route ? toId(route.destination_building_id) : null;
    setBuildingSelectCount(populateBuildingSelect(selectedDestination, ''));
    if (mode === 'edit' && route) {
      form.title.value = str(route.title); form.start_label.value = str(route.start_label);
      form.destination_building_id.value = route.destination_building_id != null ? String(num(route.destination_building_id)) : '';
      form.estimated_walk_time.value = str(route.estimated_walk_time);
    }
    $('route-modal-title').textContent = mode === 'edit' ? 'Edit Route' : 'Add Route';
    $('route-submit-label').textContent = mode === 'edit' ? 'Save Changes' : 'Create Route';
    openModal(m, form.title);
  }
  $('add-route-btn') && $('add-route-btn').addEventListener('click', () => openRouteModal('create', null));
  $('route-form') && $('route-form').addEventListener('submit', async (e) => {
    e.preventDefault(); if (state.busy) return; const m = $('route-modal'); const form = e.target; clearErr(m);
    const payload = { title: form.title.value.trim(), start_label: form.start_label.value.trim(), destination_building_id: form.destination_building_id.value.trim(), estimated_walk_time: form.estimated_walk_time.value.trim() };
    if (!payload.title) return showErr(m, 'Title is required.');
    if (!payload.start_label) return showErr(m, 'Start label is required.');
    if (!payload.destination_building_id) return showErr(m, 'A destination building is required.');
    const url = state.routeMode === 'edit' ? '/admin/api/routes/' + state.routeEditId : '/admin/api/routes';
    const method = state.routeMode === 'edit' ? 'PUT' : 'POST';
    await submitForm(m, url, method, payload, 'route', () => { closeModal(m); showToast(state.routeMode === 'edit' ? 'Route updated.' : 'Route created.'); loadRoutes(); });
  });

  /* ---- steps editor ---- */
  function stepRow(step) {
    const row = document.createElement('div'); row.className = 'steps-row';
    const ins = document.createElement('input'); ins.type = 'text'; ins.className = 'ui-input steps-instruction'; ins.placeholder = 'Instruction'; ins.maxLength = 5000; ins.value = step ? str(step.instruction) : '';
    const lm = document.createElement('input'); lm.type = 'text'; lm.className = 'ui-input steps-landmark'; lm.placeholder = 'Landmark (optional)'; lm.maxLength = 255; lm.value = step ? str(step.landmark) : '';
    const lat = document.createElement('input'); lat.type = 'number'; lat.className = 'ui-input steps-lat'; lat.placeholder = 'lat'; lat.step = 'any'; lat.value = step && step.lat != null ? String(num(step.lat)) : '';
    const lng = document.createElement('input'); lng.type = 'number'; lng.className = 'ui-input steps-lng'; lng.placeholder = 'lng'; lng.step = 'any'; lng.value = step && step.lng != null ? String(num(step.lng)) : '';
    const up = mkMini('↑', () => { const p = row.previousElementSibling; if (p) row.parentNode.insertBefore(row, p); });
    const down = mkMini('↓', () => { const n = row.nextElementSibling; if (n) row.parentNode.insertBefore(n, row); });
    const rm = mkMini('✕', () => { row.remove(); }, true);
    row.appendChild(ins); row.appendChild(lm); row.appendChild(lat); row.appendChild(lng); row.appendChild(up); row.appendChild(down); row.appendChild(rm);
    return row;
  }
  function mkMini(label, fn, danger) { const b = document.createElement('button'); b.type = 'button'; b.className = 'ui-button ui-button-outline ui-button-size-sm steps-mini' + (danger ? ' text-destructive' : ''); b.textContent = label; b.addEventListener('click', fn); return b; }
  async function openStepsModal(route) {
    const m = $('steps-modal'); const editor = $('steps-editor'); state.stepsRouteId = toId(route.id);
    clearErr(m); editor.textContent = '';
    $('steps-route-label').textContent = 'Route: ' + str(route.title);
    const loading = document.createElement('p'); loading.className = 'vr-hotspots-note'; loading.textContent = 'Loading steps…'; editor.appendChild(loading);
    openModal(m, $('add-step-btn'));
    try {
      const r = await apiRequest('/admin/api/routes/' + state.stepsRouteId + '/steps');
      editor.textContent = '';
      const steps = (r.json && Array.isArray(r.json.steps)) ? r.json.steps : [];
      if (!steps.length) editor.appendChild(stepRow(null));
      else steps.forEach((s) => editor.appendChild(stepRow(s)));
    } catch (e) { editor.textContent = ''; editor.appendChild(stepRow(null)); }
  }
  $('add-step-btn') && $('add-step-btn').addEventListener('click', () => { $('steps-editor').appendChild(stepRow(null)); });
  $('steps-save') && $('steps-save').addEventListener('click', async () => {
    if (state.busy) return; const m = $('steps-modal'); clearErr(m);
    const rows = Array.from($('steps-editor').querySelectorAll('.steps-row'));
    const steps = rows.map((row) => ({
      instruction: row.querySelector('.steps-instruction').value.trim(),
      landmark: row.querySelector('.steps-landmark').value.trim(),
      lat: row.querySelector('.steps-lat').value.trim(),
      lng: row.querySelector('.steps-lng').value.trim()
    }));
    if (!steps.length) return showErr(m, 'At least one step is required.');
    if (steps.some((s) => !s.instruction)) return showErr(m, 'Every step needs an instruction.');
    state.busy = true; $('steps-save').disabled = true;
    try {
      const r = await apiRequest('/admin/api/routes/' + state.stepsRouteId + '/steps', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ steps }) });
      if (r.redirected) return;
      if (r.json && r.json.success) { closeModal(m); showToast('Route steps updated.'); }
      else if (r.status === 403) showErr(m, 'You do not have permission to perform this action.');
      else if (r.json && typeof r.json.message === 'string') showErr(m, r.json.message);
      else showErr(m, 'Something went wrong. Please try again.');
    } catch (e) { showErr(m, 'Network error. Please try again.'); }
    finally { state.busy = false; $('steps-save').disabled = false; }
  });

  /* ============================================================ NODES */
  async function loadNodes() {
    setState('node', 'loading'); refreshIcons();
    try {
      const r = await apiRequest('/admin/api/route-nodes');
      if (r.redirected) return;
      if (r.status === 200 && r.json && r.json.success && Array.isArray(r.json.nodes)) { state.nodes = r.json.nodes; state.loaded.nodes = true; renderNodes(); }
      else { setState('node', 'error'); refreshIcons(); }
    } catch (e) { setState('node', 'error'); refreshIcons(); }
  }
  // Exact node fields returned by /admin/api/route-nodes, the id, and the
  // linked building NAME resolved from the buildings payload on the page.
  function fieldsForNode(n) {
    return [n.node_key, n.label, n.node_type, buildingNameForId(n.building_id), n.id];
  }
  function filteredNodes() {
    const q = state.filter.nodes.trim().toLowerCase();
    const rows = state.nodes.slice();
    if (!q) return rows;
    return rows.filter((n) => matchesQuery(fieldsForNode(n), q));
  }
  function renderNodes() {
    const list = $('node-list');
    if (!state.nodes.length) { setState('node', 'empty'); setResultStatus('node', 0, 0, 'node'); refreshIcons(); return; }
    const rows = filteredNodes();
    setResultStatus('node', rows.length, state.nodes.length, 'node');
    if (!rows.length) { setState('node', 'filtered-empty'); refreshIcons(); return; }
    list.textContent = '';
    rows.forEach((node) => list.appendChild(buildNodeCard(node)));
    setState('node', 'list'); refreshIcons();
  }
  function buildNodeCard(node) {
    const id = toId(node.id);
    const card = document.createElement('div'); card.className = 'vr-scene-card';
    const head = document.createElement('div'); head.className = 'vr-scene-head';
    const tw = document.createElement('div'); tw.className = 'vr-scene-titlewrap';
    const key = document.createElement('span'); key.className = 'vr-scene-key'; key.textContent = str(node.node_key); tw.appendChild(key);
    const label = document.createElement('span'); label.className = 'vr-scene-title'; label.textContent = str(node.label); tw.appendChild(label);
    const actions = document.createElement('div'); actions.className = 'vr-scene-actions';
    actions.appendChild(mkBtn('Edit', () => { if (id !== null) openNodeModal('edit', node); }));
    actions.appendChild(mkBtn('Delete', () => { if (id !== null) openDelete('route_node', id, 'Delete node "' + str(node.node_key) + '"?'); }, true));
    head.appendChild(tw); head.appendChild(actions);
    const meta = document.createElement('div'); meta.className = 'vr-scene-meta';
    meta.appendChild(badge(str(node.node_type), 'vr-badge-type'));
    meta.appendChild(badge('lat ' + num(node.lat) + ', lng ' + num(node.lng)));
    if (node.building_id != null) meta.appendChild(badge('building #' + num(node.building_id)));
    meta.appendChild(badge('order ' + num(node.display_order)));
    card.appendChild(head); card.appendChild(meta);
    return card;
  }
  function openNodeModal(mode, node) {
    const m = $('node-modal'); const form = $('node-form'); if (!form) return;
    state.nodeMode = mode; state.nodeEditId = mode === 'edit' && node ? toId(node.id) : null;
    form.reset(); clearErr(m);
    if (mode === 'edit' && node) {
      form.node_key.value = str(node.node_key); form.label.value = str(node.label);
      form.node_type.value = ['gate', 'walkway', 'building', 'service'].indexOf(str(node.node_type)) !== -1 ? str(node.node_type) : 'walkway';
      form.building_id.value = node.building_id != null ? String(num(node.building_id)) : '';
      form.lat.value = String(num(node.lat)); form.lng.value = String(num(node.lng)); form.display_order.value = String(num(node.display_order));
    }
    $('node-modal-title').textContent = mode === 'edit' ? 'Edit Node' : 'Add Node';
    $('node-submit-label').textContent = mode === 'edit' ? 'Save Changes' : 'Create Node';
    openModal(m, form.node_key);
  }
  $('add-node-btn') && $('add-node-btn').addEventListener('click', () => openNodeModal('create', null));
  $('node-form') && $('node-form').addEventListener('submit', async (e) => {
    e.preventDefault(); if (state.busy) return; const m = $('node-modal'); const form = e.target; clearErr(m);
    const payload = { node_key: form.node_key.value.trim(), label: form.label.value.trim(), node_type: form.node_type.value, building_id: form.building_id.value.trim(), lat: form.lat.value.trim(), lng: form.lng.value.trim(), display_order: form.display_order.value.trim() };
    if (!payload.node_key) return showErr(m, 'Node key is required.');
    if (!payload.label) return showErr(m, 'Label is required.');
    if (payload.lat === '' || payload.lng === '') return showErr(m, 'Latitude and longitude are required.');
    const url = state.nodeMode === 'edit' ? '/admin/api/route-nodes/' + state.nodeEditId : '/admin/api/route-nodes';
    const method = state.nodeMode === 'edit' ? 'PUT' : 'POST';
    await submitForm(m, url, method, payload, 'node', () => { closeModal(m); showToast(state.nodeMode === 'edit' ? 'Node updated.' : 'Node created.'); state.loaded.edges = false; loadNodes(); });
  });

  /* ============================================================ EDGES */
  async function ensureNodes() {
    if (state.nodes.length || state.loaded.nodes) return;
    const r = await apiRequest('/admin/api/route-nodes');
    if (r.json && Array.isArray(r.json.nodes)) { state.nodes = r.json.nodes; }
  }
  async function loadEdges() {
    setState('edge', 'loading'); refreshIcons();
    try {
      await ensureNodes();
      const r = await apiRequest('/admin/api/route-edges');
      if (r.redirected) return;
      if (r.status === 200 && r.json && r.json.success && Array.isArray(r.json.edges)) { state.edges = r.json.edges; state.loaded.edges = true; renderEdges(); }
      else { setState('edge', 'error'); refreshIcons(); }
    } catch (e) { setState('edge', 'error'); refreshIcons(); }
  }
  // Exact edge fields returned by /admin/api/route-edges, the id, and the
  // accessibility text an admin actually sees on the card ("accessible").
  function fieldsForEdge(e) {
    return [
      e.from_node_key, e.from_label, e.to_node_key, e.to_label, e.path_label,
      e.distance_meters, e.walk_time_seconds,
      truthy(e.is_accessible) ? 'accessible' : 'not accessible',
      e.id,
    ];
  }
  function filteredEdges() {
    const q = state.filter.edges.trim().toLowerCase();
    const rows = state.edges.slice();
    if (!q) return rows;
    return rows.filter((e) => matchesQuery(fieldsForEdge(e), q));
  }
  function renderEdges() {
    const list = $('edge-list');
    if (!state.edges.length) { setState('edge', 'empty'); setResultStatus('edge', 0, 0, 'edge'); refreshIcons(); return; }
    const rows = filteredEdges();
    setResultStatus('edge', rows.length, state.edges.length, 'edge');
    if (!rows.length) { setState('edge', 'filtered-empty'); refreshIcons(); return; }
    list.textContent = '';
    rows.forEach((edge) => list.appendChild(buildEdgeCard(edge)));
    setState('edge', 'list'); refreshIcons();
  }
  function buildEdgeCard(edge) {
    const id = toId(edge.id);
    const row = document.createElement('div'); row.className = 'vr-hotspot-row';
    const info = document.createElement('div'); info.className = 'vr-hotspot-info';
    const top = document.createElement('div'); top.className = 'vr-hotspot-top';
    const label = document.createElement('span'); label.className = 'vr-hotspot-label'; label.textContent = str(edge.from_node_key) + ' → ' + str(edge.to_node_key); top.appendChild(label);
    if (truthy(edge.is_accessible)) top.appendChild(badge('accessible', 'vr-badge-type'));
    const sub = document.createElement('div'); sub.className = 'vr-hotspot-sub';
    sub.textContent = num(edge.distance_meters) + ' m · ' + num(edge.walk_time_seconds) + ' s' + (edge.path_label ? ' · ' + str(edge.path_label) : '');
    info.appendChild(top); info.appendChild(sub);
    const acts = document.createElement('div'); acts.className = 'vr-hotspot-actions';
    acts.appendChild(mkBtn('Edit', () => { if (id !== null) openEdgeModal('edit', edge); }));
    acts.appendChild(mkBtn('Delete', () => { if (id !== null) openDelete('route_edge', id, 'Delete the edge ' + str(edge.from_node_key) + ' → ' + str(edge.to_node_key) + '?'); }, true));
    row.appendChild(info); row.appendChild(acts);
    return row;
  }
  /**
   * M12.P1-D4: populate a node <select>, optionally narrowed by `filterText`
   * (node key or label). The currently selected endpoint is ALWAYS rendered
   * even when it does not match, so filtering can never silently drop the
   * admin's choice. Returns the number of MATCHING nodes for the live count.
   */
  function populateNodeSelect(sel, selectedId, filterText) {
    if (!sel) return 0;
    const selected = selectedId != null ? String(selectedId) : String(sel.value || '');
    const needle = String(filterText || '').trim().toLowerCase();
    while (sel.options.length > 1) sel.remove(1);
    let shown = 0;
    state.nodes.slice().forEach((n) => {
      const id = toId(n.id); if (id === null) return;
      const matches = !needle || matchesQuery([n.node_key, n.label], needle);
      if (matches) shown += 1;
      const isSelected = selected !== '' && String(id) === selected;
      if (!matches && !isSelected) return;
      const o = document.createElement('option');
      o.value = String(id);
      o.textContent = str(n.node_key) + ' — ' + str(n.label); // textContent only
      sel.appendChild(o);
    });
    sel.value = selected;
    return needle ? shown : state.nodes.length;
  }

  // Live "N of total nodes" announcements for the two endpoint searches.
  function setNodeSelectCount(countElId, shown) {
    const el = $(countElId);
    if (!el) return;
    const total = state.nodes.length;
    el.textContent = total === 0
      ? 'No nodes available.'
      : 'Showing ' + shown + ' of ' + total + ' node' + (total === 1 ? '' : 's') + '.';
  }
  function wireEndpointSearch(searchId, selectId, countId) {
    const input = $(searchId);
    if (!input) return;
    input.addEventListener('input', () => {
      const sel = $(selectId);
      const shown = populateNodeSelect(sel, sel ? sel.value : null, input.value);
      setNodeSelectCount(countId, shown);
    });
  }
  wireEndpointSearch('edge-from-search', 'edge-from', 'edge-from-count');
  wireEndpointSearch('edge-to-search', 'edge-to', 'edge-to-count');
  async function openEdgeModal(mode, edge) {
    const m = $('edge-modal'); const form = $('edge-form'); if (!form) return;
    await ensureNodes();
    state.edgeMode = mode; state.edgeEditId = mode === 'edit' && edge ? toId(edge.id) : null;
    form.reset(); clearErr(m);
    // M12.P1-D4: both endpoint searches reset on every open, so a stale filter
    // never hides nodes from the next edge.
    const fromSearch = $('edge-from-search');
    const toSearch = $('edge-to-search');
    if (fromSearch) fromSearch.value = '';
    if (toSearch) toSearch.value = '';
    setNodeSelectCount('edge-from-count', state.nodes.length);
    setNodeSelectCount('edge-to-count', state.nodes.length);
    populateNodeSelect($('edge-from'), mode === 'edit' && edge ? toId(edge.from_node_id) : null, '');
    populateNodeSelect($('edge-to'), mode === 'edit' && edge ? toId(edge.to_node_id) : null, '');
    if (mode === 'edit' && edge) {
      form.distance_meters.value = String(num(edge.distance_meters)); form.walk_time_seconds.value = String(num(edge.walk_time_seconds));
      form.path_label.value = str(edge.path_label); form.is_accessible.checked = truthy(edge.is_accessible);
    } else { form.is_accessible.checked = true; }
    // RF.4 repair (Finding 1): endpoints are immutable after creation. Disable
    // the From/To selects while editing (their values stay in the JS-built
    // scalar payload); re-enable them for create mode.
    const editing = mode === 'edit' && edge;
    $('edge-from').disabled = !!editing;
    $('edge-to').disabled = !!editing;
    // M12.P1-D4: the endpoint SEARCHES follow the same immutability — filtering
    // a locked select would be misleading — and a concise note explains why.
    if (fromSearch) fromSearch.disabled = !!editing;
    if (toSearch) toSearch.disabled = !!editing;
    const endpointNote = $('edge-endpoint-note');
    if (endpointNote) endpointNote.hidden = !editing;
    $('edge-modal-title').textContent = mode === 'edit' ? 'Edit Edge' : 'Add Edge';
    $('edge-submit-label').textContent = mode === 'edit' ? 'Save Changes' : 'Create Edge';
    // RF.4: road-geometry editor is available only when editing an existing edge.
    const geoSection = $('edge-geometry-section');
    if (mode === 'edit' && edge && toId(edge.id) !== null) {
      if (geoSection) geoSection.style.display = '';
      openModal(m, $('edge-dist')); // From/To are disabled while editing
      initGeometryEditor(toId(edge.id));
    } else {
      if (geoSection) geoSection.style.display = 'none';
      geoTeardownDraft();
      // Add Edge focuses the From-node SEARCH first (D4), so an admin can
      // narrow a long node list straight from the keyboard.
      openModal(m, fromSearch || $('edge-from'));
    }
  }
  $('add-edge-btn') && $('add-edge-btn').addEventListener('click', () => openEdgeModal('create', null));
  $('edge-form') && $('edge-form').addEventListener('submit', async (e) => {
    e.preventDefault(); if (state.busy) return; const m = $('edge-modal'); const form = e.target; clearErr(m);
    const payload = { from_node_id: form.from_node_id.value.trim(), to_node_id: form.to_node_id.value.trim(), distance_meters: form.distance_meters.value.trim(), walk_time_seconds: form.walk_time_seconds.value.trim(), path_label: form.path_label.value.trim(), is_accessible: !!form.is_accessible.checked };
    if (!payload.from_node_id || !payload.to_node_id) return showErr(m, 'Both from-node and to-node are required.');
    if (payload.from_node_id === payload.to_node_id) return showErr(m, 'An edge cannot connect a node to itself.');
    const url = state.edgeMode === 'edit' ? '/admin/api/route-edges/' + state.edgeEditId : '/admin/api/route-edges';
    const method = state.edgeMode === 'edit' ? 'PUT' : 'POST';
    await submitForm(m, url, method, payload, 'edge', () => { closeModal(m); showToast(state.edgeMode === 'edit' ? 'Edge updated.' : 'Edge created.'); loadEdges(); });
  });

  /* ============================================================
     RF.4 — ROAD GEOMETRY EDITOR (edit an existing directed edge)
     Draft-only until "Save geometry" (PUT /route-edges/:id/geometry);
     Cancel/close never mutates the database. All DB-derived values are
     rendered via createElement/textContent/value — never innerHTML.
  ============================================================ */
  const GEO_HISTORY_MAX = 50;
  const geo = {
    map: null, editId: null,
    from: null, to: null,               // { lat, lng, label }
    waypoints: [], cleared: false,
    history: [],
    layers: { from: null, to: null, mid: [], line: null },
    busy: false, ready: false,
    // RF.4 repair (Finding 3): monotonic load generation. Every teardown
    // bumps it, so a slow async load/save from an older editor session is
    // discarded and can never overwrite a newer session's state.
    loadToken: 0
  };
  function geoLeaflet() { return (typeof L !== 'undefined') ? L : null; }
  function edgeModalOpen() { const m = $('edge-modal'); return !!m && m.classList.contains('modal--open'); }
  // A pending async result is still valid only if its captured token, the
  // current editId, and the still-open edge modal all match.
  function geoStillCurrent(token, id) { return geo.loadToken === token && geo.editId === id && edgeModalOpen(); }
  function geoStatus(msg) { const el = $('edge-geo-status'); if (el) el.textContent = msg || ''; }
  function cloneWps(list) { return (list || []).map((w) => ({ lat: Number(w.lat), lng: Number(w.lng) })); }
  function inRange(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }
  function geoPushHistory() {
    geo.history.push({ waypoints: cloneWps(geo.waypoints), cleared: geo.cleared });
    if (geo.history.length > GEO_HISTORY_MAX) geo.history.shift();
  }
  function geoTeardownDraft() {
    // Invalidate any in-flight load/save of a previous session, then reset all
    // draft + UI state (ready/busy/endpoints/waypoints/clear/history/status/layers).
    geo.loadToken += 1;
    geo.editId = null; geo.from = null; geo.to = null;
    geo.waypoints = []; geo.cleared = false; geo.history = [];
    geo.ready = false; geo.busy = false;
    geoClearLayers();
    const list = $('edge-geo-list'); if (list) while (list.firstChild) list.removeChild(list.firstChild);
    geoStatus('');
    const ep = $('edge-geo-endpoints'); if (ep) ep.textContent = '';
    const btn = $('edge-geo-save'); if (btn) btn.disabled = false;
  }
  function geoClearLayers() {
    const map = geo.map; if (!map) return;
    ['from', 'to', 'line'].forEach((k) => { if (geo.layers[k]) { try { map.removeLayer(geo.layers[k]); } catch (e) {} geo.layers[k] = null; } });
    geo.layers.mid.forEach((mk) => { try { map.removeLayer(mk); } catch (e) {} });
    geo.layers.mid = [];
  }
  function geoEnsureMap() {
    if (geo.map) return geo.map;
    const L = geoLeaflet(); const el = $('edge-geo-map');
    if (!L || !el) return null;
    try {
      geo.map = L.map(el, { zoomControl: true, attributionControl: true }).setView([13.4059, 123.3745], 17);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© OpenStreetMap contributors'
      }).addTo(geo.map);
      geo.map.on('click', (e) => {
        if (geo.busy || !geo.from) return;
        geoAddWaypoint(e.latlng.lat, e.latlng.lng);
      });
    } catch (e) { geo.map = null; }
    return geo.map;
  }
  async function initGeometryEditor(id) {
    geoTeardownDraft();               // bumps loadToken, resets state
    const token = geo.loadToken;      // this session's generation
    geo.editId = id;
    geoStatus('Loading geometry…');
    let edge = null;
    try {
      const r = await apiRequest('/admin/api/route-edges/' + id);
      if (r.status === 200 && r.json && r.json.success && r.json.edge) edge = r.json.edge;
    } catch (e) { edge = null; }
    // Discard a stale response: a newer editor session (or a closed modal)
    // superseded this load while the request was in flight.
    if (!geoStillCurrent(token, id)) return;
    if (!edge) { geoStatus('Could not load this edge’s geometry.'); return; }
    geo.from = { lat: Number(edge.from_lat), lng: Number(edge.from_lng), label: str(edge.from_label) || str(edge.from_node_key) };
    geo.to = { lat: Number(edge.to_lat), lng: Number(edge.to_lng), label: str(edge.to_label) || str(edge.to_node_key) };
    const stored = Array.isArray(edge.path_geometry) ? edge.path_geometry : null;
    geo.waypoints = stored && stored.length > 2 ? cloneWps(stored.slice(1, -1)) : [];
    geo.cleared = false;
    geo.history = [];
    const ep = $('edge-geo-endpoints');
    if (ep) ep.textContent = geo.from.label + ' → ' + geo.to.label;
    if (!inRange(geo.from.lat, geo.from.lng) || !inRange(geo.to.lat, geo.to.lng)) {
      geoStatus('Endpoint coordinates are unavailable; geometry editing is disabled for this edge.');
      geo.ready = false; return;
    }
    geo.ready = true;
    const map = geoEnsureMap();
    if (!map) { geoStatus('Map could not be initialised. The waypoint list still works.'); }
    geoRender();
    if (map) {
      // The container just became visible inside the modal; recompute size
      // and fit the endpoints (avoids a blank/garbled first paint). Guarded so
      // a superseded session cannot re-fit the newer session's map.
      setTimeout(() => { if (!geoStillCurrent(token, id)) return; try { map.invalidateSize(); geoFitBounds(); } catch (e) {} }, 60);
    }
    geoStatus(stored ? 'Loaded stored geometry.' : 'No stored geometry — showing the straight endpoint line.');
  }
  function geoFullPoints() {
    if (!geo.from || !geo.to) return [];
    return [{ lat: geo.from.lat, lng: geo.from.lng }].concat(cloneWps(geo.waypoints), [{ lat: geo.to.lat, lng: geo.to.lng }]);
  }
  function geoFitBounds() {
    const L = geoLeaflet(); if (!L || !geo.map) return;
    const pts = geoFullPoints(); if (pts.length < 2) return;
    try { geo.map.fitBounds(pts.map((p) => [p.lat, p.lng]), { padding: [30, 30] }); } catch (e) {}
  }
  function geoRender() { geoRenderMarkers(); geoRenderLine(); geoRenderList(); }
  function geoRenderLine() {
    const L = geoLeaflet(); const map = geo.map; if (!L || !map) return;
    if (geo.layers.line) { try { map.removeLayer(geo.layers.line); } catch (e) {} geo.layers.line = null; }
    const pts = geoFullPoints().map((p) => [p.lat, p.lng]);
    if (pts.length >= 2) geo.layers.line = L.polyline(pts, { color: '#2563eb', weight: 4, opacity: 0.85 }).addTo(map);
  }
  function geoRenderMarkers() {
    const L = geoLeaflet(); const map = geo.map; if (!L || !map || !geo.from || !geo.to) return;
    geo.layers.mid.forEach((mk) => { try { map.removeLayer(mk); } catch (e) {} });
    geo.layers.mid = [];
    if (!geo.layers.from) geo.layers.from = L.marker([geo.from.lat, geo.from.lng], { draggable: false, title: 'From: ' + geo.from.label, opacity: 0.9 }).addTo(map);
    else geo.layers.from.setLatLng([geo.from.lat, geo.from.lng]);
    if (!geo.layers.to) geo.layers.to = L.marker([geo.to.lat, geo.to.lng], { draggable: false, title: 'To: ' + geo.to.label, opacity: 0.9 }).addTo(map);
    else geo.layers.to.setLatLng([geo.to.lat, geo.to.lng]);
    geo.waypoints.forEach((w, i) => {
      // Draggable marker per intermediate waypoint (Leaflet markers support
      // dragging; circleMarker does not).
      const dm = L.marker([w.lat, w.lng], { draggable: true, title: 'Waypoint ' + (i + 1) });
      dm.on('dragend', () => {
        const ll = dm.getLatLng();
        if (!inRange(ll.lat, ll.lng)) { dm.setLatLng([w.lat, w.lng]); return; }
        geoPushHistory(); geo.waypoints[i] = { lat: ll.lat, lng: ll.lng }; geo.cleared = false;
        geoRenderLine(); geoRenderList(); geoStatus('Waypoint ' + (i + 1) + ' moved.');
      });
      dm.addTo(map);
      geo.layers.mid.push(dm);
    });
  }
  function mkGeoBtn(label, onClick) {
    const b = document.createElement('button'); b.type = 'button';
    b.className = 'ui-button ui-button-outline ui-button-size-sm'; b.textContent = label;
    b.style.padding = '0.15rem 0.5rem'; b.addEventListener('click', onClick); return b;
  }
  function geoRenderList() {
    const list = $('edge-geo-list'); if (!list) return;
    while (list.firstChild) list.removeChild(list.firstChild);
    if (geo.cleared) {
      const li = document.createElement('li'); li.className = 'text-muted-foreground';
      li.style.fontSize = '0.78rem'; li.textContent = 'Geometry will be cleared on save (both directions).';
      list.appendChild(li); return;
    }
    if (!geo.waypoints.length) {
      const li = document.createElement('li'); li.className = 'text-muted-foreground';
      li.style.fontSize = '0.78rem'; li.textContent = 'No intermediate waypoints (straight endpoint line).';
      list.appendChild(li); return;
    }
    geo.waypoints.forEach((w, i) => {
      const li = document.createElement('li');
      li.style.display = 'flex'; li.style.flexWrap = 'wrap'; li.style.alignItems = 'center'; li.style.gap = '0.3rem';
      const idx = document.createElement('span'); idx.textContent = '#' + (i + 1); idx.style.minWidth = '2rem'; idx.style.fontSize = '0.8rem';
      const latI = document.createElement('input'); latI.type = 'number'; latI.step = 'any'; latI.className = 'ui-input';
      latI.value = String(w.lat); latI.setAttribute('aria-label', 'Waypoint ' + (i + 1) + ' latitude'); latI.style.width = '8.5rem';
      const lngI = document.createElement('input'); lngI.type = 'number'; lngI.step = 'any'; lngI.className = 'ui-input';
      lngI.value = String(w.lng); lngI.setAttribute('aria-label', 'Waypoint ' + (i + 1) + ' longitude'); lngI.style.width = '8.5rem';
      function commit() {
        const la = Number(latI.value), ln = Number(lngI.value);
        if (!inRange(la, ln)) { geoStatus('Waypoint ' + (i + 1) + ': latitude must be -90..90 and longitude -180..180.'); latI.value = String(geo.waypoints[i].lat); lngI.value = String(geo.waypoints[i].lng); return; }
        geoPushHistory(); geo.waypoints[i] = { lat: la, lng: ln }; geo.cleared = false;
        geoRenderMarkers(); geoRenderLine(); geoStatus('Waypoint ' + (i + 1) + ' updated.');
      }
      latI.addEventListener('change', commit); lngI.addEventListener('change', commit);
      const up = mkGeoBtn('↑', () => geoMove(i, -1)); up.setAttribute('aria-label', 'Move waypoint ' + (i + 1) + ' up');
      const dn = mkGeoBtn('↓', () => geoMove(i, 1)); dn.setAttribute('aria-label', 'Move waypoint ' + (i + 1) + ' down');
      const rm = mkGeoBtn('Remove', () => geoRemove(i)); rm.setAttribute('aria-label', 'Remove waypoint ' + (i + 1));
      li.appendChild(idx); li.appendChild(latI); li.appendChild(lngI); li.appendChild(up); li.appendChild(dn); li.appendChild(rm);
      list.appendChild(li);
    });
  }
  function geoAddWaypoint(lat, lng) {
    if (!geo.ready || !geo.from || !geo.to) return;
    let la = lat, ln = lng;
    if (!inRange(la, ln)) {
      // Keyboard "Add waypoint": insert the midpoint of the current end segment.
      const pts = geoFullPoints(); const a = pts[pts.length - 2], b = pts[pts.length - 1];
      la = (a.lat + b.lat) / 2; ln = (a.lng + b.lng) / 2;
    }
    geoPushHistory(); geo.cleared = false; geo.waypoints.push({ lat: la, lng: ln });
    geoRender(); geoStatus('Waypoint ' + geo.waypoints.length + ' added.');
  }
  function geoMove(i, dir) {
    const j = i + dir; if (j < 0 || j >= geo.waypoints.length) return;
    geoPushHistory(); const t = geo.waypoints[i]; geo.waypoints[i] = geo.waypoints[j]; geo.waypoints[j] = t;
    geoRender(); geoStatus('Waypoint order changed.');
  }
  function geoRemove(i) {
    if (i < 0 || i >= geo.waypoints.length) return;
    geoPushHistory(); geo.waypoints.splice(i, 1); geo.cleared = false;
    geoRender(); geoStatus('Waypoint removed.');
  }
  function geoUndo() {
    if (!geo.history.length) { geoStatus('Nothing to undo.'); return; }
    const prev = geo.history.pop(); geo.waypoints = cloneWps(prev.waypoints); geo.cleared = !!prev.cleared;
    geoRender(); geoStatus('Undid last change.');
  }
  function geoReset() {
    geoPushHistory(); geo.waypoints = []; geo.cleared = false;
    geoRender(); geoFitBounds(); geoStatus('Reset to the straight endpoint line (saves the two endpoints).');
  }
  function geoClear() {
    geoPushHistory(); geo.waypoints = []; geo.cleared = true;
    geoRender(); geoStatus('Marked for clearing — save to remove geometry from both directions.');
  }
  function geoPreview() { geoRender(); geoFitBounds(); geoStatus('Preview updated.'); }
  async function geoSave() {
    if (geo.busy || !geo.editId) return;
    if (!geo.ready && !geo.cleared) { geoStatus('Geometry editing is unavailable for this edge.'); return; }
    const token = geo.loadToken, id = geo.editId;   // this session's generation + edge
    const wasCleared = geo.cleared;
    let payload;
    if (wasCleared) payload = { path_geometry: null };
    else payload = { path_geometry: geoFullPoints() };
    geo.busy = true; const btn = $('edge-geo-save'); if (btn) btn.disabled = true;
    geoStatus('Saving…');
    let result = null;
    try {
      result = await apiRequest('/admin/api/route-edges/' + id + '/geometry', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
    } catch (e) { result = { error: true }; }
    // A save from a superseded session may have already mutated its own edge
    // on the server, but it must not touch a newer session's editor state.
    if (!geoStillCurrent(token, id)) return;
    geo.busy = false; if (btn) btn.disabled = false;
    if (result && result.status === 200 && result.json && result.json.success) {
      showToast(wasCleared ? 'Geometry cleared.' : 'Geometry saved.');
      geoStatus(wasCleared ? 'Geometry cleared for both directions.' : 'Geometry saved for both directions.');
      if (wasCleared) { geo.cleared = false; geo.waypoints = []; geoRender(); }
      // Clearing geometry can make a destination unroutable (and re-adding it can
      // restore routability), so the building cards must re-evaluate.
      emitGraphChanged();
    } else if (result && !result.error) {
      geoStatus((result.json && result.json.message) ? result.json.message : 'Could not save geometry.');
    } else {
      geoStatus('Could not save geometry. Please try again.');
    }
  }
  $('edge-geo-add') && $('edge-geo-add').addEventListener('click', () => geoAddWaypoint());
  $('edge-geo-undo') && $('edge-geo-undo').addEventListener('click', geoUndo);
  $('edge-geo-reset') && $('edge-geo-reset').addEventListener('click', geoReset);
  $('edge-geo-clear') && $('edge-geo-clear').addEventListener('click', geoClear);
  $('edge-geo-preview') && $('edge-geo-preview').addEventListener('click', geoPreview);
  $('edge-geo-save') && $('edge-geo-save').addEventListener('click', geoSave);

  /* ---------- shared submit + delete ---------- */
  async function submitForm(m, url, method, payload, kind, onOk) {
    state.busy = true; const btn = m.querySelector('button[type="submit"]'); if (btn) btn.disabled = true;
    try {
      const r = await apiRequest(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (r.redirected) return;
      if (r.json && r.json.success) { onOk(); emitGraphChanged(); }
      else if (r.status === 403) showErr(m, 'You do not have permission to perform this action.');
      else if (r.json && typeof r.json.message === 'string') showErr(m, r.json.message);
      else showErr(m, 'Something went wrong. Please try again.');
    } catch (e) { showErr(m, 'Network error. Please try again.'); }
    finally { state.busy = false; if (btn) btn.disabled = false; }
  }
  function openDelete(kind, id, text) {
    state.pendingDelete = { kind, id };
    $('graph-delete-text').textContent = text;
    openModal($('graph-delete-modal'), $('graph-confirm-delete'));
  }
  $('graph-cancel-delete') && $('graph-cancel-delete').addEventListener('click', () => { if (state.busy) return; state.pendingDelete = null; closeModal($('graph-delete-modal')); });
  $('graph-confirm-delete') && $('graph-confirm-delete').addEventListener('click', async () => {
    if (state.busy || !state.pendingDelete) return;
    const job = state.pendingDelete; state.busy = true; $('graph-confirm-delete').disabled = true;
    const path = job.kind === 'route' ? '/admin/api/routes/' + job.id : job.kind === 'route_node' ? '/admin/api/route-nodes/' + job.id : '/admin/api/route-edges/' + job.id;
    try {
      const r = await apiRequest(path, { method: 'DELETE' });
      if (r.redirected) return;
      if (r.json && r.json.success) {
        closeModal($('graph-delete-modal'));
        showToast(job.kind === 'route' ? 'Route deleted.' : job.kind === 'route_node' ? 'Node deleted.' : 'Edge deleted.');
        if (job.kind === 'route') loadRoutes();
        else if (job.kind === 'route_node') { state.loaded.edges = false; loadNodes(); }
        else loadEdges();
        // Deleting a node or edge can strand a building with no usable route.
        emitGraphChanged();
      } else if (r.status === 403) { showToast('You do not have permission to perform this action.', 'error'); }
      else if (r.json && typeof r.json.message === 'string') { showToast(r.json.message, 'error'); closeModal($('graph-delete-modal')); }
      else showToast('Something went wrong. Please try again.', 'error');
    } catch (e) { showToast('Network error. Please try again.', 'error'); }
    finally { state.pendingDelete = null; state.busy = false; $('graph-confirm-delete').disabled = false; }
  });

  /* ---------- search wires ---------- */
  $('route-search') && $('route-search').addEventListener('input', (e) => { state.filter.routes = e.target.value; renderRoutes(); });
  $('node-search') && $('node-search').addEventListener('input', (e) => { state.filter.nodes = e.target.value; renderNodes(); });
  $('edge-search') && $('edge-search').addEventListener('input', (e) => { state.filter.edges = e.target.value; renderEdges(); });
  $('route-retry') && $('route-retry').addEventListener('click', loadRoutes);
  $('node-retry') && $('node-retry').addEventListener('click', loadNodes);
  $('edge-retry') && $('edge-retry').addEventListener('click', loadEdges);

  /* ---------- init ---------- */
  loadBuildings();
  loadRoutes(); // default tab
});
