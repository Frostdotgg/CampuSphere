(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    const byId = id => document.getElementById(id), modal = byId('steps-modal');
    if (!modal) return;
    const editor = byId('steps-editor'), save = byId('steps-save'), add = byId('add-step-btn');
    const state = { mode: 'vehicle', direction: 'entry', destinationId: null, routeId: null, name: '', token: 0, busy: false, loaded: false, baseline: '', invoker: null };
    const validId = value => /^[1-9][0-9]*$/.test(String(value)) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
    const text = value => value == null ? '' : String(value);
    const rows = () => Array.from(editor.querySelectorAll('.steps-row')).map(row => ({
      instruction: row.querySelector('.steps-instruction').value.trim(), landmark: row.querySelector('.steps-landmark').value.trim(),
      lat: row.querySelector('.steps-lat').value.trim(), lng: row.querySelector('.steps-lng').value.trim()
    }));
    const dirty = () => state.loaded && JSON.stringify(rows()) !== state.baseline;
    const mayDiscard = () => !dirty() || window.confirm('Discard unsaved instruction changes?');
    function error(message) { const target = modal.querySelector('.form-error'); target.textContent = message || ''; target.style.display = message ? 'block' : 'none'; }
    function status() {
      byId('steps-list-status').textContent = editor.children.length ? 'Save updates only this mode and direction.' : 'No instructions added. Save an empty list to clear only this direction.';
    }
    function button(label, accessibleName, handler) {
      const control = document.createElement('button'); control.type = 'button'; control.className = 'ui-button ui-button-outline ui-button-size-sm steps-mini';
      control.textContent = label; control.setAttribute('aria-label', accessibleName); control.addEventListener('click', handler); return control;
    }
    function appendRow(step = {}) {
      const row = document.createElement('div'); row.className = 'steps-row'; row.style.cssText = 'display:flex;flex-wrap:wrap;';
      const instruction = document.createElement('textarea'); instruction.className = 'ui-input steps-instruction'; instruction.rows = 2;
      instruction.placeholder = 'Instruction'; instruction.setAttribute('aria-label', 'Instruction'); instruction.maxLength = 5000; instruction.value = text(step.instruction);
      instruction.style.cssText = 'flex:1 1 100%;min-width:0;min-height:4.5rem;resize:vertical;'; row.appendChild(instruction);
      for (const [field, label, max] of [['landmark', 'Landmark (optional)', 255], ['lat', 'Latitude (optional)', null], ['lng', 'Longitude (optional)', null]]) {
        const input = document.createElement('input'); input.type = field === 'landmark' ? 'text' : 'number'; input.className = 'ui-input steps-' + field;
        input.placeholder = label; input.setAttribute('aria-label', label); input.value = text(step[field]);
        input.style.cssText = field === 'landmark' ? 'flex:1 1 140px;min-width:0;' : 'flex:1 1 90px;min-width:0;';
        if (max) input.maxLength = max; else input.step = 'any'; row.appendChild(input);
      }
      row.appendChild(button('↑', 'Move instruction up', () => { const previous = row.previousElementSibling; if (previous) editor.insertBefore(row, previous); }));
      row.appendChild(button('↓', 'Move instruction down', () => { const next = row.nextElementSibling; if (next) editor.insertBefore(next, row); }));
      row.appendChild(button('✕', 'Remove instruction', () => { row.remove(); status(); })); editor.appendChild(row); status();
    }
    function url() {
      if (state.mode === 'vehicle' && state.direction === 'entry') return '/admin/api/routes/' + state.routeId + '/steps';
      return '/admin/api/route-instructions/' + state.destinationId + '?mode=' + state.mode + '&direction=' + state.direction;
    }
    function labels() {
      const mode = state.mode === 'walking' ? 'Walking' : 'Vehicle';
      byId('steps-modal-title').textContent = mode + ' Steps';
      const gate = state.mode === 'walking' ? 'Walking Guard House' : 'Guard House / Main Gate';
      byId('steps-route-label').textContent = mode + ': ' + (state.direction === 'entry' ? gate + ' → ' + state.name : state.name + ' → ' + gate);
      for (const direction of ['entry', 'exit']) byId('steps-' + direction + '-tab').setAttribute('aria-selected', String(state.direction === direction));
    }
    async function load() {
      const token = ++state.token; state.loaded = false; error(''); editor.replaceChildren(); labels();
      save.disabled = true; add.disabled = true; byId('steps-list-status').textContent = 'Loading instructions…';
      try {
        const response = await fetch(url(), { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
        const data = await response.json(); if (token !== state.token) return;
        if (!response.ok || !data || !data.success || !Array.isArray(data.steps)) throw new Error();
        data.steps.forEach(appendRow); state.loaded = true; state.baseline = JSON.stringify(rows()); status();
        save.disabled = false; add.disabled = false;
      } catch (_) {
        if (token !== state.token) return;
        byId('steps-list-status').textContent = ''; error('Instructions could not be loaded. Close and reopen to retry.');
      }
    }
    function open(mode, selection) {
      if (state.busy || (modal.classList.contains('modal--open') && !mayDiscard())) return;
      const destinationId = validId(mode === 'vehicle' ? selection.destination_building_id : selection.id);
      const routeId = mode === 'vehicle' ? validId(selection.id) : null;
      if (!destinationId || (mode === 'vehicle' && !routeId)) return;
      state.invoker = document.activeElement; state.mode = mode; state.direction = 'entry'; state.destinationId = destinationId; state.routeId = routeId;
      state.name = text(selection.destination_name || selection.name || selection.title); state.loaded = false;
      modal.classList.add('modal--open'); modal.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
      byId('steps-entry-tab').focus(); load();
    }
    function close() {
      if (state.busy || !mayDiscard()) return;
      state.token++; state.loaded = false; modal.classList.remove('modal--open'); modal.setAttribute('aria-hidden', 'true'); document.body.style.overflow = '';
      if (state.invoker && state.invoker.isConnected) state.invoker.focus();
    }
    modal.querySelectorAll('.modal-close-btn').forEach(control => control.addEventListener('click', close));
    modal.addEventListener('click', event => { if (event.target === modal) close(); });
    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(modal.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)'));
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    for (const direction of ['entry', 'exit']) byId('steps-' + direction + '-tab').addEventListener('click', () => {
      if (state.busy || state.direction === direction || !mayDiscard()) return;
      state.direction = direction; load();
    });
    add.addEventListener('click', () => { if (state.loaded && !state.busy && editor.children.length < 200) appendRow(); });
    save.addEventListener('click', async () => {
      if (!state.loaded || state.busy) return;
      const steps = rows(); if (steps.some(step => !step.instruction)) return error('Every step needs an instruction. Remove unfinished rows or enter their text.');
      const token = state.token; state.busy = true; save.disabled = true; add.disabled = true; error('');
      // Freeze the draft while its atomic save is in flight.
      editor.querySelectorAll('input, textarea, button').forEach(control => { control.disabled = true; });
      try {
        const csrf = document.querySelector('meta[name="csrf-token"]');
        const response = await fetch(url(), { method: 'PUT', credentials: 'same-origin', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrf ? csrf.content : '' }, body: JSON.stringify({ steps }) });
        const data = await response.json(); if (token !== state.token) return;
        if (!response.ok || !data || !data.success) throw new Error(data && data.message || 'Instructions could not be saved.');
        state.baseline = JSON.stringify(rows()); byId('steps-list-status').textContent = 'Instructions saved. Other modes and directions were preserved.';
      } catch (failure) { if (token === state.token) error(failure.message || 'Save outcome is uncertain. Reopen this list to verify before retrying.'); }
      finally {
        state.busy = false;
        if (token === state.token) { save.disabled = false; add.disabled = false; editor.querySelectorAll('input, textarea, button').forEach(control => { control.disabled = false; }); }
      }
    });
    window.CampuSphereRouteInstructionsEditor = { openVehicle: route => open('vehicle', route), openWalking: destination => open('walking', destination) };
  });
}());
