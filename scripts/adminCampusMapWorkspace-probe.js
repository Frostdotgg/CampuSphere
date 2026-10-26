'use strict';

// Database-free UI contracts. Real CRUD and rendered checks use the labelled Docker fixture.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
let checks = 0;
function check(name, value) { assert.ok(value, name); checks++; console.log('  [PASS] ' + name); }
const source = read('public/js/admin/campus-map-workspace.js');
function api(text) { const context = { module: { exports: {} }, Map, Set }; vm.runInNewContext(text, context); return context.module.exports; }
function exercise(pager) {
  for (const size of [0, 1, 10, 11, 31, 101]) {
    const rows = Array.from({ length: size }, (_, id) => ({ id: id + 1 }));
    const joined = [];
    for (let n = 1; n <= Math.max(1, Math.ceil(size / 10)); n++) {
      const result = pager.pageWindow(rows, n);
      assert.ok(result.rows.length <= 10, 'A list must never render more than ten records');
      assert.equal(result.page, n); assert.equal(result.count, Math.max(1, Math.ceil(size / 10)));
      joined.push(...result.rows.map(x => x.id));
    }
    assert.deepEqual(joined, rows.map(x => x.id), 'Every record must be reachable exactly once');
    assert.equal(pager.pageWindow(rows, 999).page, Math.max(1, Math.ceil(size / 10)));
    assert.equal(pager.pageWindow(rows, -1).page, 1);
  }
}
const pager = api(source);
exercise(pager); check('0/1/10/11/31/101 records are bounded and reachable without duplicates', true);
for (const size of [0, 1, 10, 11, 31]) {
  const rows = Array.from({ length: size }, (_, id) => ({ id: id + 1 }));
  check(size + ' records: initial page has the correct count', pager.pageWindow(rows, 1).rows.length === Math.min(size, 10));
}
const rows = Array.from({ length: 31 }, (_, id) => ({ id: id + 1, name: 'Building ' + (id + 1) }));
const later = rows.filter(r => r.id === 31);
check('Filtering before pagination finds a record on a later page', pager.pageWindow(later, 1).rows[0].id === 31);
check('Deleting the sole last-page item returns to the preceding page', pager.pageWindow(rows.slice(0, 30), 4).page === 3);
check('A filter with no matches resets an out-of-range page', pager.pageWindow([], 4).page === 1);
check('Pure pagination never modifies the original collection', rows.length === 31 && rows[0].id === 1);

const view = read('views/admin/campus-map.ejs'), css = read('public/css/admin-campus-map.css');
function structure(text) {
  const graph = text.match(/<section id="graph-workspace"[\s\S]*?<\/section>/)?.[0] || '';
  return ['workspace-tab-buildings', 'workspace-tab-graph'].every(id => text.includes('id="' + id + '"')) &&
    graph.includes('id="walking-routes-card"') && graph.includes('data-graph-panel="walking"') &&
    ['buildings', 'routes', 'edges', 'walking', 'nodes'].every(key => text.includes('data-workspace-pager="' + key + '"'));
}
check('Walking belongs inside the graph workspace and all five lists have pagers', structure(view));
check('Graph subsections are in the requested order', /data-graph-tab="routes"[\s\S]*data-graph-tab="edges"[\s\S]*data-graph-tab="walking"[\s\S]*data-graph-tab="nodes"/.test(view));
check('Only Buildings opens on a full reload', /id="graph-workspace"[^>]*hidden/.test(view) && !/id="buildings-workspace"[^>]*hidden/.test(view));
check('The visible vehicle label changes without renaming the edge API', view.includes('Vehicle 2D Routes') && view.includes('id="edge-search"') && read('public/js/admin/admin-map-graph.js').includes("'/admin/api/route-edges'"));
check('Navigation supports arrow/Home/End keys and linked selected tabs', ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'aria-selected', 'aria-current'].every(s => source.includes(s)) && view.includes('aria-controls="graph-panel-edges"'));
check('Hidden panels cannot be revealed by layout display rules', css.includes('.campus-map-admin [hidden] { display: none !important; }'));
check('All changed UI rules are scoped to this admin page', !css.includes('.dash-nav') && css.includes('.campus-map-admin'));
check('Page size and per-list state stay in memory, separate from guide storage', source.includes('const SIZE = 10') && source.includes('pages = new Map()') && !/localStorage|indexedDB|sessionStorage/.test(source));
check('Rendering preserves scroll and rejects disconnected/hidden focus targets', source.includes('workspace.scrollTop = before') && source.includes("!el.closest('[hidden], [inert]')") && source.includes('!focused.isConnected'));
check('Only an explicit saved-item action can navigate to the saved record', source.includes("view.textContent = 'View saved item'") && source.includes('await activate(key)') && source.includes('if (active !== key) return'));
for (const [file, key] of [['admin-buildings.js', 'buildings'], ['admin-map-graph.js', 'graph'], ['admin-walking-routes.js', 'walking']]) {
  const client = read('public/js/admin/' + file);
  check(key + ' client uses the shared bounded list helper', client.includes('workspace.paginate(') && client.includes('workspace.register('));
  check(key + ' client resets paging on search/filter changes', client.includes('workspace.resetPage('));
}
check('Graph reads reject superseded responses without switching tabs', read('public/js/admin/admin-map-graph.js').includes('generation !== state.request[key]') && !read('public/js/admin/admin-map-graph.js').includes("p.hidden = p.getAttribute('data-graph-panel')"));
check('Walking search includes readiness labels before paging', read('public/js/admin/admin-walking-routes.js').includes("b.name + ' ' + readiness(b)"));
check('Building close controls cannot dismiss another editor before its warning', !read('public/js/admin/admin-buildings.js').includes("document.querySelectorAll('.modal-close-btn').forEach"));

let rejected = false;
try { exercise(api(source.replace('rows.slice((current - 1) * SIZE, current * SIZE)', 'rows'))); } catch (_) { rejected = true; }
check('Independent rejection fixture catches rendering every record', rejected);
const outsideWalking = view.replace('id="walking-routes-card"', 'id="walking-moved-placeholder"') +
  '<div id="walking-routes-card" data-graph-panel="walking"></div>';
check('Independent rejection fixture catches a Walking section outside the graph workspace', !structure(outsideWalking));
check('Independent rejection fixture catches a missing pager', !structure(view.replace('data-workspace-pager="nodes"', 'data-missing-pager="nodes"')));
console.log('ADMIN-CAMPUS-MAP-WORKSPACE-PROBE OK: ' + checks + '/' + checks + ' (database-free; browser/Docker evidence is separate).');
