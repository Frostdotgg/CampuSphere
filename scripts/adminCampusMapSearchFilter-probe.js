'use strict';

// The room-scheduling feature is retired. Keep the independent route/node/edge
// search and accessibility contracts here; HTTP retirement coverage lives in
// roomSchedulingRemoval-probe.js and never creates shared schedule records.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const failures = [];
let checks = 0;
function check(scope, label, condition) {
  checks++;
  console.log('  ['+(condition?'PASS':'FAIL')+'] '+scope+' :: '+label);
  if(!condition) failures.push(scope+' :: '+label);
}
function runStaticChecks() {
  const view=read('views/admin/campus-map.ejs');
  const graph=read('public/js/admin/admin-map-graph.js');
  const css=read('public/css/admin-styles.css');
  check('static','retired editor is absent and shared building preview remains',
    !/id="schedule-card"|id="schedule-modal"|admin-schedules.js/.test(view) &&
    view.includes('id="building-image-preview"'));
  check('static', 'route, node, edge, and destination searches remain labelled graph controls',
    ['route-search', 'node-search', 'edge-search'].every((id) => view.includes(`id="${id}"`)) &&
    view.includes('id="route-dest-search"') &&
    view.includes('aria-describedby="route-dest-count"') &&
    view.includes('id="route-dest-count"') &&
    graph.includes('fieldsForRoute') && graph.includes('fieldsForNode') && graph.includes('fieldsForEdge'));
  check('static', 'edge creation exposes drawn geometry and calculated/custom metric controls',
    view.includes('id="edge-geometry-section"') && view.includes('id="edge-metrics-badge"') &&
    view.includes('id="edge-use-calculated"') && graph.includes('metrics_mode') &&
    graph.includes('path_geometry') && graph.includes('geoMetricForPoints'));
  check('static', 'graph client renders backend values through text APIs',
    !/\binnerHTML\s*=|insertAdjacentHTML|document\.write/.test(graph));
  check('static', 'graph controls retain keyboard-sized targets',
    /min-height:\s*44px/.test(css) && /:focus-visible[\s\S]{0,220}outline:/.test(css) &&
    /#route-dest-search:focus-visible/.test(css) && /#route-dest-search,[\s\S]{0,120}min-height:\s*44px/.test(css));
}

async function runGraphClientChecks() {
  console.log('\n[client-graph] graph panel search smoke');
  const graph = read('public/js/admin/admin-map-graph.js');
  check('client-graph', 'route search covers destination and walk-time fields',
    /estimated_walk_time/.test(graph) && /destination_name/.test(graph) &&
    graph.includes('function populateBuildingSelect(selectedId, filterText)') &&
    graph.includes('function filterDestinationBuildings()') &&
    graph.includes("destinationSearch.addEventListener('input', filterDestinationBuildings)") &&
    graph.includes('const selected = selectedId != null') &&
    graph.includes('sel.value = selected;') &&
    graph.includes("destinationSearch.value = ''"));
  check('client-graph', 'node search covers key, label, type, and building name',
    /node_key/.test(graph) && /node_type/.test(graph) && /buildingNameForId/.test(graph));
  check('client-graph', 'edge search covers endpoint labels and geometry metadata',
    /from_label/.test(graph) && /to_label/.test(graph) && /walk_time_seconds/.test(graph));
  check('client-graph', 'same-node edge validation remains fail-closed',
    graph.includes('An edge cannot connect a node to itself.'));
}


(async () => {
  runStaticChecks();
  await runGraphClientChecks();
  if(failures.length) throw new Error(failures.join('; '));
  console.log('ADMIN-CAMPUS-MAP-SEARCH-FILTER-PROBE OK: '+checks+'/'+checks+' (source-only; no database).');
})().catch(() => { console.error('ADMIN-CAMPUS-MAP-SEARCH-FILTER-PROBE FAILED.');process.exitCode=1; });
