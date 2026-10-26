/* Page-local navigation and bounded lists. No persistence or API policy lives here. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) {
    root.CampuSphereAdminWorkspace = api;
    root.document.addEventListener('DOMContentLoaded', api.init);
  }
}(typeof window === 'object' ? window : null, function () {
  'use strict';
  const SIZE = 10;
  const clients = new Map(), pages = new Map(), scroll = new Map();
  const keys = ['buildings', 'routes', 'edges', 'walking', 'nodes'];
  let active = 'buildings', graph = 'routes', ready = false, activation = 0;
  const byId = id => document.getElementById(id);
  const pane = key => key === 'buildings' ? byId('buildings-workspace') : document.querySelector('[data-graph-panel="' + key + '"]');
  const visible = el => !!(el && el.isConnected && !el.disabled && !el.closest('[hidden], [inert]') && el.getClientRects().length);
  function pageWindow(rows, page) {
    const count = Math.max(1, Math.ceil(rows.length / SIZE));
    const current = Math.max(1, Math.min(count, Number.isSafeInteger(page) ? page : 1));
    return { page: current, count, start: rows.length ? (current - 1) * SIZE + 1 : 0, end: Math.min(current * SIZE, rows.length), rows: rows.slice((current - 1) * SIZE, current * SIZE) };
  }
  function restoreFocus(target, key) {
    const fallback = { buildings: 'building-search-input', routes: 'route-search', edges: 'edge-search', nodes: 'node-search', walking: 'walking-route-search' };
    const el = visible(target) ? target : visible(byId(fallback[active])) ? byId(fallback[active]) : byId(active === 'buildings' ? 'workspace-tab-buildings' : 'workspace-tab-graph');
    if (visible(el)) el.focus({ preventScroll: true });
  }
  function preserve(key, render) {
    const workspace = byId('campus-map-scroll'), before = workspace ? workspace.scrollTop : 0;
    const focused = document.activeElement, row = focused && focused.closest('[data-workspace-item]');
    const id = row && row.dataset.workspaceItem;
    const position = row ? Array.from(row.querySelectorAll('button, a, input')).indexOf(focused) : -1;
    const result = render();
    if (key === active && workspace) {
      workspace.scrollTop = before;
      if (focused && !focused.isConnected && row) {
        const replacement = Array.from(pane(key).querySelectorAll('[data-workspace-item]')).find(e => e.dataset.workspaceItem === id);
        restoreFocus(replacement && replacement.querySelectorAll('button, a, input')[Math.max(0, position)], key);
      }
    }
    return result;
  }
  function paginate(key, rows, total, noun) {
    const result = pageWindow(rows, pages.get(key)); pages.set(key, result.page);
    const status = document.querySelector('[data-workspace-status="' + key + '"]');
    if (status) status.textContent = rows.length ? 'Showing ' + result.start + '–' + result.end + ' of ' + rows.length + ' ' + noun + (rows.length !== total ? ' (' + total + ' total)' : '') + '.' : '0 ' + noun + (total ? ' match your filters.' : '.');
    const nav = document.querySelector('[data-workspace-pager="' + key + '"]');
    if (!nav) return result.rows;
    nav.replaceChildren(); nav.hidden = result.count <= 1;
    const button = (label, page, disabled, current) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ui-button ui-button-outline';
      b.textContent = label; b.disabled = !!disabled; b.dataset.page = String(page);
      if (current) b.setAttribute('aria-current', 'page');
      else if (/^\d+$/.test(label)) b.setAttribute('aria-label', 'Page ' + label);
      b.addEventListener('click', () => {
        pages.set(key, page); const c = clients.get(key); if (c) c.render();
        const target = nav.querySelector('[aria-current="page"]'); if (target) target.focus({ preventScroll: true });
      });
      nav.appendChild(b);
    };
    button('Previous', result.page - 1, result.page === 1);
    const numbers = new Set([1, result.count, result.page - 1, result.page, result.page + 1]);
    let last = 0;
    Array.from(numbers).filter(n => n >= 1 && n <= result.count).sort((a, b) => a - b).forEach(n => {
      if (last && n - last > 1) { const gap = document.createElement('span'); gap.textContent = '…'; gap.setAttribute('aria-hidden', 'true'); nav.appendChild(gap); }
      button(String(n), n, false, n === result.page); last = n;
    });
    button('Next', result.page + 1, result.page === result.count);
    const label = document.createElement('span'); label.className = 'campus-map-page-label'; label.textContent = 'Page ' + result.page + ' of ' + result.count; nav.appendChild(label);
    return result.rows;
  }
  function refresh(key) {
    const c = clients.get(key); if (!c || !c.refresh) return Promise.resolve();
    c.dirty = false;
    return Promise.resolve(c.refresh()).then(result => { if (result === false) c.dirty = true; }).catch(() => { c.dirty = true; });
  }
  async function activate(key, focus) {
    if (!keys.includes(key)) return;
    const workspace = byId('campus-map-scroll');
    if (workspace) scroll.set(active, workspace.scrollTop);
    const changed = active !== key; active = key; if (key !== 'buildings') graph = key;
    const ticket = ++activation;
    document.querySelectorAll('[data-workspace-tab]').forEach(t => {
      const on = t.dataset.workspaceTab === (key === 'buildings' ? 'buildings' : 'graph');
      t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
    });
    ['buildings', 'graph'].forEach(name => { const p = byId(name + '-workspace'); p.hidden = name !== (key === 'buildings' ? 'buildings' : 'graph'); });
    document.querySelectorAll('#graph-card [data-graph-tab]').forEach(t => {
      const on = t.dataset.graphTab === graph; t.classList.toggle('graph-tab--active', on); t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll('#graph-card [data-graph-panel]').forEach(p => { p.hidden = p.dataset.graphPanel !== graph; });
    if (changed && workspace) workspace.scrollTop = scroll.get(key) || 0;
    if (focus) { const t = key === 'buildings' ? byId('workspace-tab-buildings') : document.querySelector('[data-graph-tab="' + key + '"]'); if (t) t.focus({ preventScroll: true }); }
    const c = clients.get(key); if (c && c.dirty) await refresh(key);
    if (ticket !== activation) return;
  }
  function register(key, client) {
    clients.set(key, Object.assign({ dirty: key !== 'buildings' }, client));
    if (ready && key === active && clients.get(key).dirty) refresh(key);
  }
  function invalidate(key) { const c = clients.get(key); if (!c) return; c.dirty = true; if (key === active) refresh(key); }
  function revealPage(key, rows, id) {
    const index = rows.findIndex(r => String(r.id) === String(id));
    if (index < 0) return false; pages.set(key, Math.floor(index / SIZE) + 1); return true;
  }
  function notifySaved(key, id, message) {
    const box = byId('campus-map-feedback'); if (!box) return;
    box.replaceChildren(); box.hidden = false;
    const text = document.createElement('span'); text.textContent = message || 'Changes saved.'; box.appendChild(text);
    if (id == null) return;
    const view = document.createElement('button'); view.type = 'button'; view.className = 'ui-button ui-button-outline'; view.textContent = 'View saved item';
    view.addEventListener('click', async () => {
      await activate(key); if (active !== key) return;
      const c = clients.get(key); if (!c || !c.reveal || !c.reveal(id)) { text.textContent = 'The saved item is no longer available. Refresh this section to check.'; return; }
      const row = Array.from(pane(key).querySelectorAll('[data-workspace-item]')).find(e => e.dataset.workspaceItem === String(id));
      if (row) { row.scrollIntoView({ block: 'center', behavior: 'auto' }); const control = row.querySelector('button, a'); if (control) control.focus({ preventScroll: true }); }
    });
    box.appendChild(view);
  }
  function tabs(group, selector, select) {
    const all = Array.from(group.querySelectorAll(selector));
    all.forEach((t, index) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', e => {
        let next; if (e.key === 'ArrowRight') next = (index + 1) % all.length;
        if (e.key === 'ArrowLeft') next = (index + all.length - 1) % all.length;
        if (e.key === 'Home') next = 0; if (e.key === 'End') next = all.length - 1;
        if (next !== undefined) { e.preventDefault(); select(all[next]); all[next].focus({ preventScroll: true }); }
      });
    });
  }
  function init() {
    if (ready || !byId('campus-map-scroll')) return;
    ready = true;
    tabs(byId('campus-map-main-tabs'), '[data-workspace-tab]', t => activate(t.dataset.workspaceTab === 'buildings' ? 'buildings' : graph));
    tabs(byId('campus-map-graph-tabs'), '[data-graph-tab]', t => activate(t.dataset.graphTab));
    activate('buildings');
  }
  return { init, pageWindow, paginate, preserve, register, invalidate, activate, notifySaved, revealPage, restoreFocus,
    resetPage: key => pages.set(key, 1), isActive: key => active === key,
    compare: (a, b) => String(a || '').localeCompare(String(b || '')), markDirty: key => { const c = clients.get(key); if (c) c.dirty = true; } };
}));
