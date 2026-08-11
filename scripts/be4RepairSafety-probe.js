'use strict';

/* ========================================
   CampuSphere - BE.4 repair-safety PURE probe (BE.4 NO-GO repair, v3)

   Database-free. Exercises the pure repair/sync logic and the adapter-driven
   apply/rollback flows with in-memory fixtures and narrow MOCKED adapters — no
   live Supabase/MySQL, no mutation API. Mocks enforce realistic uniqueness
   (route_edges UNIQUE(from,to)) so a rollback test cannot pass by silently
   double-inserting. Must pass regardless of the current live-data defects.

   Route repair proves: order-independent fingerprints that change on every
   attribute class; projections from a simulated graph; final-state validation
   rejects defects; adapter drift aborts BEFORE any mutation; insert failure
   makes zero restore calls; partial/ambiguous inserts are discovered+removed;
   first-delete-succeeds/second-fails restores only the first; untouched
   shortcuts are never reinserted; rollback cleanup failure and restored-metadata
   mismatch are surfaced. FINDING 1: thrown/ambiguous errors from insert, delete,
   the post-write read, and validation all enter the SAME fresh-read verified
   compensation (nothing-landed, landed-then-threw, delete-then-threw,
   post-read-threw); reconciliation read/restore/removal/final-read throws surface
   ROLLBACK VERIFICATION FAILED + backup; an initial-read throw mutates nothing
   and rolls back nothing.

   VR parity proves: unique-identity fail-closed; different backend ids compare
   equal; every attribute class changes the semantic fingerprint; truthful
   insert/update/present/delete; external Free Roam branch preservation; backup
   created before mutation and its path surfaced in failures; pre-commit failure
   rolls back without commit; a corrupted (scene or hotspot) rollback cannot
   claim verified; present actions perform zero mutations; a planned update/delete
   touches only its exact natural identity. FINDING 3: semanticScopeFingerprint /
   externalBranchFingerprint THROW on any identity blocker (never collide).
   FINDING 2: every failure after begin rolls back exactly once — locked read,
   authority read, preflight, drift, backup creation/verification — reporting
   rolled-back-no-data with no invented path; a failed backup-creation rollback is
   surfaced (ROLLBACK FAILED); commit never rolls back. FINDING 4: post-commit
   failures (unexpected AND SafeSyncError) carry the backup path exactly once and
   never claim rollback.

   CORRECTION #4 adds: (1) required schedule-hotspot identity — missing/unknown
   building, invalid/absent location type, blank/absent location label, and a
   SUPPLIED-but-blank floor all fail closed, while a genuine NULL floor stays valid;
   info/exit hotspots need a non-empty label; an invalid MySQL-target identity
   blocks the plan (no silent delete). (2) one strict raw-numeric validator (null/
   finite-number/finite-numeric-string valid; ''/whitespace/boolean/array/object/
   NaN/+-Infinity/non-numeric-string invalid, never coerced to NULL/0) so malformed
   values throw before any fingerprint and can never equal the NULL fingerprint.
   (3) live-adapter connection lifecycle: getConnection-failure disposes nothing;
   begin/rollback failure DESTROYS (never releases); confirmed commit/rollback
   release once; a release-throw after confirmation destroys; commit-failure retains
   the connection for the outer rollback; conn is cleared exactly once (no double
   dispose).

   CORRECTION #5 adds: a SUPPLIED scene node_id / building_id must resolve, in its
   OWN backend's maps, to exactly one non-empty node_key / canonical building name;
   a genuine NULL/undefined stays a valid NULL relationship, but a malformed,
   non-positive, or dangling id fails closed (no silent normalization to null) so it
   can never share a fingerprint with a genuine-NULL scene — while different
   backend-local ids that resolve to the same natural key still compare equal.

   CORRECTION #6 adds: the shared positiveInt parser is NON-COERCIVE. Against a
   fixture that really has an id=1 node and id=1 building, true / [1] (which the old
   Number()-based parser coerced to 1) are rejected by type and throw, while the
   legitimate numeric 1 and a canonical decimal string "1" resolve — proving the
   failure is strict type rejection, not a missing row. The grammar is asserted
   directly: only a safe-integer number >= 1 or a /^[1-9][0-9]*$/ trimmed string is
   accepted; booleans, arrays, objects, boxed numbers, empty/whitespace, zero,
   negative, fractional, hex/exponent/signed strings, NaN, +/-Infinity, and
   > MAX_SAFE_INTEGER all reject.

   Run:  node scripts/be4RepairSafety-probe.js
   ======================================== */

const route = require('./repairSupabaseRouteGraph');
const vr = require('./syncSelectedCasVrSupabaseToMysql');

const failures = [];
function check(section, label, ok) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${section} :: ${label}`);
  if (!ok) failures.push(`${section} :: ${label}`);
}
function threw(fn) { try { fn(); return false; } catch (_) { return true; } }
async function threwAsync(fn) { try { await fn(); return false; } catch (_) { return true; } }
async function catchMsg(fn) { try { await fn(); return null; } catch (e) { return e && e.message ? e.message : ''; } }

/* =========================================================================
   Route-graph fixtures.
========================================================================= */
function makePinnedGraph() {
  const nodeKeys = [
    'main-gate', 'flagpole', 'mid-campus', 'east-walk', 'cas', 'ccs',
    'admin-building', 'registrar',
    'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12'
  ];
  const buildingByKey = {
    cas: 1, ccs: 2, 'admin-building': 3, registrar: 3,
    f1: 4, f2: 5, f3: 6, f4: 7, f5: 8, f6: 9, f7: 10, f8: 11, f9: 12, f10: 13
  };
  const nodes = nodeKeys.map((key, i) => ({
    id: i + 1, node_key: key,
    label: key.toUpperCase(),
    node_type: key === 'main-gate' ? 'gate' : (buildingByKey[key] ? 'building' : 'walkway'),
    building_id: buildingByKey[key] != null ? buildingByKey[key] : null,
    lat: 13.4 + i * 0.0001, lng: 123.37 + i * 0.0001
  }));
  const idByKey = new Map(nodes.map((n) => [n.node_key, n.id]));
  const coordByKey = new Map(nodes.map((n) => [n.node_key, { lat: n.lat, lng: n.lng }]));
  const undirected = [
    ['main-gate', 'flagpole'], ['flagpole', 'mid-campus'], ['mid-campus', 'east-walk'],
    ['east-walk', 'cas'], ['east-walk', 'ccs'],
    ['admin-building', 'registrar'], ['main-gate', 'admin-building'],
    ['main-gate', 'f1'], ['f1', 'f2'], ['f2', 'f3'], ['f3', 'f4'], ['f4', 'f5'],
    ['f5', 'f6'], ['f6', 'f7'], ['f7', 'f8'], ['f8', 'f9'], ['f9', 'f10'],
    ['f10', 'f11'], ['f11', 'f12'],
    ['flagpole', 'f1'], ['mid-campus', 'f3'], ['east-walk', 'f5'],
    ['cas', 'ccs'], ['admin-building', 'f7']
  ];
  const edges = [];
  let edgeId = 1;
  for (const [a, b] of undirected) {
    const ca = coordByKey.get(a); const cb = coordByKey.get(b);
    edges.push({ id: edgeId++, from_node_id: idByKey.get(a), to_node_id: idByKey.get(b), distance_meters: 100, walk_time_seconds: 80, path_label: `${a}->${b}`, is_accessible: 1, path_geometry: [{ lat: ca.lat, lng: ca.lng }, { lat: cb.lat, lng: cb.lng }] });
    edges.push({ id: edgeId++, from_node_id: idByKey.get(b), to_node_id: idByKey.get(a), distance_meters: 100, walk_time_seconds: 80, path_label: `${b}->${a}`, is_accessible: 1, path_geometry: [{ lat: cb.lat, lng: cb.lng }, { lat: ca.lat, lng: ca.lng }] });
  }
  return { nodes, edges, idByKey, coordByKey };
}

function makeBrokenGraph(pinned) {
  const rm = new Set(['east-walk>cas', 'cas>east-walk', 'east-walk>ccs', 'ccs>east-walk', 'admin-building>registrar', 'registrar>admin-building']);
  const idToKey = new Map(pinned.nodes.map((n) => [n.id, n.node_key]));
  let edges = pinned.edges.filter((e) => !rm.has(`${idToKey.get(e.from_node_id)}>${idToKey.get(e.to_node_id)}`));
  let nextId = Math.max(...pinned.edges.map((e) => e.id)) + 1;
  const mg = pinned.coordByKey.get('main-gate'); const cas = pinned.coordByKey.get('cas');
  edges = edges.concat([
    { id: nextId++, from_node_id: pinned.idByKey.get('main-gate'), to_node_id: pinned.idByKey.get('cas'), distance_meters: 500, walk_time_seconds: 400, path_label: 'shortcut', is_accessible: 1, path_geometry: [{ lat: mg.lat, lng: mg.lng }, { lat: cas.lat, lng: cas.lng }] },
    { id: nextId++, from_node_id: pinned.idByKey.get('cas'), to_node_id: pinned.idByKey.get('main-gate'), distance_meters: 500, walk_time_seconds: 400, path_label: 'shortcut', is_accessible: 1, path_geometry: [{ lat: cas.lat, lng: cas.lng }, { lat: mg.lat, lng: mg.lng }] }
  ]);
  return { nodes: pinned.nodes.map((n) => ({ ...n })), edges };
}

// In-memory route_edges adapter with realistic UNIQUE(from,to) + call tracking.
// Options model BOTH explicit { ok:false } responses AND thrown/ambiguous errors
// so the thrown-error compensation path (FINDING 1) is exercised directly:
//   throwInsert          insertEdges throws BEFORE any row lands
//   throwInsertAfterLand insertEdges lands every row, THEN throws (ambiguous)
//   throwSecondDelete    1st delete lands, 2nd delete throws (ambiguous)
//   throwRestore         reconciliation insertOriginal throws
//   throwRemove          reconciliation deleteById throws
//   throwReadOn=N        readGraph throws on its Nth call (1=initial preflight read)
function makeMockRouteAdapter(nodes, initialEdges, opts) {
  const options = opts || {};
  let edges = initialEdges.map((e) => ({ ...e, path_geometry: (e.path_geometry || []).map((p) => ({ ...p })) }));
  let nextId = Math.max(0, ...edges.map((e) => e.id)) + 1;
  const calls = { readGraph: 0, insertEdges: 0, deleteEdge: 0, insertOriginal: 0, deleteById: 0 };
  let deleteEdgeSeq = 0;
  const hasDirected = (from, to) => edges.some((e) => e.from_node_id === from && e.to_node_id === to);
  return {
    _edges() { return edges; },
    _calls() { return calls; },
    async readGraph() {
      calls.readGraph++;
      if (options.throwReadOn && calls.readGraph === options.throwReadOn) throw new Error('ambiguous read transport failure');
      return { nodes: nodes.map((n) => ({ ...n })), edges: edges.map((e) => ({ ...e, path_geometry: (e.path_geometry || []).map((p) => ({ ...p })) })) };
    },
    async insertEdges(rows) {
      calls.insertEdges++;
      if (options.throwInsert) throw new Error('ambiguous insert transport failure'); // nothing landed
      if (options.failInsert) return { ok: false, ids: [] }; // reported failure, nothing landed
      for (const r of rows) if (hasDirected(r.from_node_id, r.to_node_id)) return { ok: false, ids: [] };
      const ids = [];
      for (const r of rows) { const id = nextId++; edges.push({ id, ...r, path_geometry: (r.path_geometry || []).map((p) => ({ ...p })) }); ids.push(id); }
      if (options.throwInsertAfterLand) throw new Error('ambiguous insert transport failure after landing'); // landed then threw
      if (options.failInsertButLand) return { ok: false, ids: [] }; // ambiguous: landed but reported failed
      return { ok: true, ids, count: rows.length };
    },
    async deleteEdge(id, fromId, toId) {
      calls.deleteEdge++; deleteEdgeSeq++;
      if (options.throwSecondDelete && deleteEdgeSeq === 2) throw new Error('ambiguous delete transport failure'); // 1st landed; 2nd ambiguous (row stays)
      if (options.failSecondDelete && deleteEdgeSeq === 2) return { ok: false, count: 0 }; // 2nd delete fails; row stays
      const before = edges.length;
      edges = edges.filter((e) => !(e.id === id && e.from_node_id === fromId && e.to_node_id === toId));
      return { ok: true, count: before - edges.length };
    },
    async insertOriginal(row) {
      calls.insertOriginal++;
      if (options.throwRestore) throw new Error('ambiguous restore transport failure');
      const r = options.corruptRestore ? { ...row, path_geometry: [{ lat: 0, lng: 0 }, { lat: 0, lng: 0.5 }] } : row;
      if (hasDirected(r.from_node_id, r.to_node_id)) return { ok: false, count: 0 }; // realistic UNIQUE
      edges.push({ id: nextId++, ...r, path_geometry: (r.path_geometry || []).map((p) => ({ ...p })) });
      return { ok: true, count: 1 };
    },
    async deleteById(id) {
      calls.deleteById++;
      if (options.throwRemove) throw new Error('ambiguous removal transport failure');
      if (options.failRollbackDelete) return { ok: false, count: 0 };
      const before = edges.length;
      edges = edges.filter((e) => e.id !== id);
      return { ok: true, count: before - edges.length };
    }
  };
}

async function runRouteTests() {
  const S = 'route';
  const pinned = makePinnedGraph();
  const pinnedSnap = route.completeGraphSnapshot(pinned.nodes, pinned.edges);
  const pinnedMetrics = route.computeGraphMetrics(pinnedSnap);
  const fpA = route.snapshotFingerprint(pinnedSnap);

  check(S, 'fixture pinned graph is 20/48/24/48/24/13', pinnedMetrics.nodes === 20 && pinnedMetrics.edges === 48 &&
    pinnedMetrics.pairs === 24 && pinnedMetrics.validGeometries === 48 && pinnedMetrics.exactReverse === 24 && pinnedMetrics.routable === 13);

  // Fingerprint order-independence + attribute sensitivity.
  check(S, 'complete fingerprint is order-independent',
    fpA === route.snapshotFingerprint(route.completeGraphSnapshot([...pinned.nodes].reverse(), [...pinned.edges].reverse())));
  function fpWith(mutate) {
    const nodes = pinned.nodes.map((n) => ({ ...n }));
    const edges = pinned.edges.map((e) => ({ ...e, path_geometry: e.path_geometry.map((p) => ({ ...p })) }));
    mutate(nodes, edges);
    return route.snapshotFingerprint(route.completeGraphSnapshot(nodes, edges));
  }
  check(S, 'fingerprint changes on a node coordinate change', fpWith((n) => { n[0].lat += 0.5; }) !== fpA);
  check(S, 'fingerprint changes on an edge distance change', fpWith((n, e) => { e[0].distance_meters = 999; }) !== fpA);
  check(S, 'fingerprint changes on an edge walk-time change', fpWith((n, e) => { e[0].walk_time_seconds = 999; }) !== fpA);
  check(S, 'fingerprint changes on an accessibility change', fpWith((n, e) => { e[0].is_accessible = 0; }) !== fpA);
  check(S, 'fingerprint changes on a path-label change', fpWith((n, e) => { e[0].path_label = 'changed'; }) !== fpA);
  check(S, 'fingerprint changes on a geometry change', fpWith((n, e) => { e[0].path_geometry[0].lat += 0.001; }) !== fpA);

  // Projections come from the simulated graph.
  const broken = makeBrokenGraph(pinned);
  const plan = route.buildPlan({ nodes: pinned.nodes, edges: pinned.edges }, { nodes: broken.nodes, edges: broken.edges });
  const brokenFp = route.snapshotFingerprint(route.completeGraphSnapshot(broken.nodes, broken.edges));
  check(S, 'buildPlan on the known drift is blocker-free', plan.blockers.length === 0);
  check(S, 'plan is 6 inserts + 2 deletes', plan.inserts.length === 6 && plan.deletes.length === 2);
  check(S, 'projected counts come from the simulated graph (20/48/24/48/24/13)',
    plan.projected.nodes === 20 && plan.projected.edges === 48 && plan.projected.pairs === 24 &&
    plan.projected.geometries === 48 && plan.projected.exactReverse === 24 && plan.projected.routable === 13);
  check(S, 'simulated final fingerprint equals the pinned-graph fingerprint', plan.simulatedFingerprint === fpA);

  // Final-state validation.
  check(S, 'validateFinalGraph accepts the pinned graph', route.validateFinalGraph(pinnedSnap, pinnedSnap).ok === true);
  check(S, 'validateFinalGraph rejects the broken graph', route.validateFinalGraph(pinnedSnap, route.completeGraphSnapshot(broken.nodes, broken.edges)).ok === false);
  check(S, 'validateFinalGraph rejects a missing reverse edge',
    route.validateFinalGraph(pinnedSnap, { nodes: pinnedSnap.nodes, edges: pinnedSnap.edges.filter((e, i) => i !== 0) }).ok === false);
  check(S, 'validateFinalGraph rejects invalid/discontinuous geometry',
    route.validateFinalGraph(pinnedSnap, { nodes: pinnedSnap.nodes, edges: pinnedSnap.edges.map((e, i) => i === 0 ? { ...e, geometry: [{ lat: 0, lng: 0 }, { lat: 0, lng: 0 }] } : e) }).ok === false);
  check(S, 'validateFinalGraph rejects an unroutable graph',
    route.validateFinalGraph(pinnedSnap, { nodes: pinnedSnap.nodes, edges: pinnedSnap.edges.filter((e) => e.from_key !== 'main-gate' && e.to_key !== 'main-gate') }).ok === false);

  // Adapter apply SUCCESS: broken -> pinned.
  const okAdapter = makeMockRouteAdapter(pinned.nodes, broken.edges);
  let applyOk = true;
  try { await route.applyPlanWithAdapter(okAdapter, plan.mysqlSnapshot, plan, '<probe-backup>'); } catch (_) { applyOk = false; }
  check(S, 'adapter apply reaches the pinned final state (success, no throw)', applyOk === true);
  const finalMetrics = route.computeGraphMetrics(route.completeGraphSnapshot(pinned.nodes, okAdapter._edges()));
  check(S, 'post-apply mock graph is 48 edges / 24 pairs', finalMetrics.edges === 48 && finalMetrics.pairs === 24);

  // FINDING 3: adapter-level graph drift aborts BEFORE any mutation call.
  const driftAdapter = makeMockRouteAdapter(pinned.nodes, pinned.edges); // NOT the broken pre-snapshot
  const driftMsg = await catchMsg(() => route.applyPlanWithAdapter(driftAdapter, plan.mysqlSnapshot, plan, '<probe-backup>'));
  check(S, 'drift guard aborts with "state changed" before mutating', driftMsg != null && /state changed/i.test(driftMsg));
  check(S, 'drift guard performs ZERO insert/delete mutation calls',
    driftAdapter._calls().insertEdges === 0 && driftAdapter._calls().deleteEdge === 0 && driftAdapter._calls().insertOriginal === 0 && driftAdapter._calls().deleteById === 0);

  // FINDING 2a: insert failure before any mutation -> zero restore calls, restored+verified.
  const failInsertAdapter = makeMockRouteAdapter(pinned.nodes, broken.edges, { failInsert: true });
  const failInsertMsg = await catchMsg(() => route.applyPlanWithAdapter(failInsertAdapter, plan.mysqlSnapshot, plan, '<probe-backup>'));
  check(S, 'insert failure -> throws restored+verified (nothing landed)', failInsertMsg != null && /restored and verified/i.test(failInsertMsg));
  check(S, 'insert failure makes ZERO restore/cleanup calls',
    failInsertAdapter._calls().insertOriginal === 0 && failInsertAdapter._calls().deleteById === 0);
  check(S, 'insert-failure graph is unchanged (still the broken pre-state)',
    route.snapshotFingerprint(route.completeGraphSnapshot(pinned.nodes, failInsertAdapter._edges())) === brokenFp);

  // FINDING 2b: partial/ambiguous insert (landed but reported failed) is discovered and removed.
  const partialAdapter = makeMockRouteAdapter(pinned.nodes, broken.edges, { failInsertButLand: true });
  const partialMsg = await catchMsg(() => route.applyPlanWithAdapter(partialAdapter, plan.mysqlSnapshot, plan, '<probe-backup>'));
  check(S, 'partial insert -> reconciled, restored+verified', partialMsg != null && /restored and verified/i.test(partialMsg));
  check(S, 'partial insert: the six landed rows were removed (back to broken)',
    route.snapshotFingerprint(route.completeGraphSnapshot(pinned.nodes, partialAdapter._edges())) === brokenFp);
  check(S, 'partial insert removed exactly the six landed inserts', partialAdapter._calls().deleteById === 6);

  // FINDING 2c: first delete succeeds, second fails -> only the first is restored; shortcut never reinserted.
  const halfDeleteAdapter = makeMockRouteAdapter(pinned.nodes, broken.edges, { failSecondDelete: true });
  const halfMsg = await catchMsg(() => route.applyPlanWithAdapter(halfDeleteAdapter, plan.mysqlSnapshot, plan, '<probe-backup>'));
  check(S, 'half-delete -> reconciled, restored+verified', halfMsg != null && /restored and verified/i.test(halfMsg));
  check(S, 'half-delete restores exactly ONE removed shortcut (never double-inserts)', halfDeleteAdapter._calls().insertOriginal === 1);
  check(S, 'half-delete graph returns to the broken pre-state (both shortcuts present)',
    route.snapshotFingerprint(route.completeGraphSnapshot(pinned.nodes, halfDeleteAdapter._edges())) === brokenFp);

  // FINDING 2 (rollback failure surfaced): cleanup delete fails.
  const rbFailAdapter = makeMockRouteAdapter(pinned.nodes, broken.edges, { failInsertButLand: true, failRollbackDelete: true });
  const rbFailMsg = await catchMsg(() => route.applyPlanWithAdapter(rbFailAdapter, plan.mysqlSnapshot, plan, '<probe-backup>'));
  check(S, 'rollback cleanup failure surfaces ROLLBACK VERIFICATION FAILED', rbFailMsg != null && /ROLLBACK VERIFICATION FAILED/.test(rbFailMsg) && /Backup: /.test(rbFailMsg));

  // FINDING 2 (restored metadata mismatch surfaced): restore writes wrong geometry.
  const corruptAdapter = makeMockRouteAdapter(pinned.nodes, broken.edges, { failSecondDelete: true, corruptRestore: true });
  const corruptMsg = await catchMsg(() => route.applyPlanWithAdapter(corruptAdapter, plan.mysqlSnapshot, plan, '<probe-backup>'));
  check(S, 'restored-metadata mismatch fails the fingerprint proof (ROLLBACK VERIFICATION FAILED)', corruptMsg != null && /ROLLBACK VERIFICATION FAILED/.test(corruptMsg));

  // ---- FINDING 1: thrown/ambiguous errors enter the SAME verified compensation ----

  // (a) insert THROWS before landing -> reconciliation proves the graph unchanged.
  const throwInsAdapter = makeMockRouteAdapter(pinned.nodes, broken.edges, { throwInsert: true });
  const throwInsMsg = await catchMsg(() => route.applyPlanWithAdapter(throwInsAdapter, plan.mysqlSnapshot, plan, '<probe-backup>'));
  check(S, 'thrown insert (nothing landed) -> reconciled, restored+verified', throwInsMsg != null && /restored and verified/i.test(throwInsMsg));
  check(S, 'thrown insert: graph unchanged and ZERO restore/cleanup calls',
    route.snapshotFingerprint(route.completeGraphSnapshot(pinned.nodes, throwInsAdapter._edges())) === brokenFp &&
    throwInsAdapter._calls().insertOriginal === 0 && throwInsAdapter._calls().deleteById === 0);

  // (b) insert LANDS then throws -> all landed inserts discovered via fresh read and removed.
  const throwInsLandAdapter = makeMockRouteAdapter(pinned.nodes, broken.edges, { throwInsertAfterLand: true });
  const throwInsLandMsg = await catchMsg(() => route.applyPlanWithAdapter(throwInsLandAdapter, plan.mysqlSnapshot, plan, '<probe-backup>'));
  check(S, 'thrown insert after landing -> reconciled, restored+verified', throwInsLandMsg != null && /restored and verified/i.test(throwInsLandMsg));
  check(S, 'thrown-after-land removed exactly the six landed inserts (back to broken)',
    throwInsLandAdapter._calls().deleteById === 6 &&
    route.snapshotFingerprint(route.completeGraphSnapshot(pinned.nodes, throwInsLandAdapter._edges())) === brokenFp);

  // (c) a deletion LANDS then throws -> exactly the landed deletion is restored (never double-inserted).
  const throwDelAdapter = makeMockRouteAdapter(pinned.nodes, broken.edges, { throwSecondDelete: true });
  const throwDelMsg = await catchMsg(() => route.applyPlanWithAdapter(throwDelAdapter, plan.mysqlSnapshot, plan, '<probe-backup>'));
  check(S, 'thrown second delete -> reconciled, restored+verified', throwDelMsg != null && /restored and verified/i.test(throwDelMsg));
  check(S, 'thrown-delete restores exactly ONE landed deletion, back to broken',
    throwDelAdapter._calls().insertOriginal === 1 &&
    route.snapshotFingerprint(route.completeGraphSnapshot(pinned.nodes, throwDelAdapter._edges())) === brokenFp);

  // (d) the post-write proof read THROWS once -> compensation subsequently runs and verifies.
  const throwPostReadAdapter = makeMockRouteAdapter(pinned.nodes, broken.edges, { throwReadOn: 2 });
  const throwPostReadMsg = await catchMsg(() => route.applyPlanWithAdapter(throwPostReadAdapter, plan.mysqlSnapshot, plan, '<probe-backup>'));
  check(S, 'thrown post-write read -> compensation runs, restored+verified', throwPostReadMsg != null && /restored and verified/i.test(throwPostReadMsg));
  check(S, 'thrown post-write read: graph reconciled back to the broken pre-state',
    route.snapshotFingerprint(route.completeGraphSnapshot(pinned.nodes, throwPostReadAdapter._edges())) === brokenFp);

  // (e) reconciliation read / restore / removal / final-read failures surface ROLLBACK VERIFICATION FAILED + backup.
  const recReadFailAdapter = makeMockRouteAdapter(pinned.nodes, broken.edges, { failInsertButLand: true, throwReadOn: 2 });
  const recReadFailMsg = await catchMsg(() => route.applyPlanWithAdapter(recReadFailAdapter, plan.mysqlSnapshot, plan, '<probe-backup>'));
  check(S, 'reconciliation initial-read failure -> ROLLBACK VERIFICATION FAILED + backup', recReadFailMsg != null && /ROLLBACK VERIFICATION FAILED/.test(recReadFailMsg) && /Backup: /.test(recReadFailMsg));

  const recFinalReadFailAdapter = makeMockRouteAdapter(pinned.nodes, broken.edges, { failInsertButLand: true, throwReadOn: 3 });
  const recFinalReadFailMsg = await catchMsg(() => route.applyPlanWithAdapter(recFinalReadFailAdapter, plan.mysqlSnapshot, plan, '<probe-backup>'));
  check(S, 'reconciliation final-verify-read failure -> ROLLBACK VERIFICATION FAILED + backup', recFinalReadFailMsg != null && /ROLLBACK VERIFICATION FAILED/.test(recFinalReadFailMsg) && /Backup: /.test(recFinalReadFailMsg));

  const recRestoreFailAdapter = makeMockRouteAdapter(pinned.nodes, broken.edges, { failSecondDelete: true, throwRestore: true });
  const recRestoreFailMsg = await catchMsg(() => route.applyPlanWithAdapter(recRestoreFailAdapter, plan.mysqlSnapshot, plan, '<probe-backup>'));
  check(S, 'reconciliation restore throw -> ROLLBACK VERIFICATION FAILED + backup', recRestoreFailMsg != null && /ROLLBACK VERIFICATION FAILED/.test(recRestoreFailMsg) && /Backup: /.test(recRestoreFailMsg));

  const recRemoveFailAdapter = makeMockRouteAdapter(pinned.nodes, broken.edges, { failInsertButLand: true, throwRemove: true });
  const recRemoveFailMsg = await catchMsg(() => route.applyPlanWithAdapter(recRemoveFailAdapter, plan.mysqlSnapshot, plan, '<probe-backup>'));
  check(S, 'reconciliation removal throw -> ROLLBACK VERIFICATION FAILED + backup', recRemoveFailMsg != null && /ROLLBACK VERIFICATION FAILED/.test(recRemoveFailMsg) && /Backup: /.test(recRemoveFailMsg));

  // (f) an initial/preflight read failure performs NO mutation and NO rollback.
  const initReadFailAdapter = makeMockRouteAdapter(pinned.nodes, broken.edges, { throwReadOn: 1 });
  const initReadFailMsg = await catchMsg(() => route.applyPlanWithAdapter(initReadFailAdapter, plan.mysqlSnapshot, plan, '<probe-backup>'));
  check(S, 'initial-read failure fails cleanly with NO mutation and NO rollback',
    initReadFailMsg != null &&
    initReadFailAdapter._calls().insertEdges === 0 && initReadFailAdapter._calls().deleteEdge === 0 &&
    initReadFailAdapter._calls().insertOriginal === 0 && initReadFailAdapter._calls().deleteById === 0);

  // parseArgs guards.
  check(S, 'parseArgs default is dry-run', route.parseArgs(['node', 's']).mode === 'dry-run');
  check(S, 'parseArgs rejects unknown args', threw(() => route.parseArgs(['node', 's', '--boom'])));
  check(S, 'parseArgs rejects --apply without token', threw(() => route.parseArgs(['node', 's', '--apply'])));
  check(S, 'parseArgs rejects --apply with wrong token', threw(() => route.parseArgs(['node', 's', '--apply', '--confirm=NOPE'])));
  check(S, 'parseArgs rejects --apply + --dry-run', threw(() => route.parseArgs(['node', 's', '--apply', '--dry-run', `--confirm=${route.APPLY_CONFIRMATION}`])));
  check(S, 'parseArgs rejects duplicate --confirm', threw(() => route.parseArgs(['node', 's', '--apply', `--confirm=${route.APPLY_CONFIRMATION}`, `--confirm=${route.APPLY_CONFIRMATION}`])));
  check(S, 'parseArgs accepts the exact apply token', route.parseArgs(['node', 's', '--apply', `--confirm=${route.APPLY_CONFIRMATION}`]).mode === 'apply');
}

/* =========================================================================
   VR sync fixtures: a fully-present selected CAS scope in both backends
   with DIFFERENT numeric ids, one CAS schedule hotspot, valid guided media,
   allScenes reference, and an optional out-of-scope Free Roam branch.
========================================================================= */
const CLOUD = 'https://res.cloudinary.com/demo/image/upload/';
const EXTERNAL_KEY = 'scene-general-road-16'; // a real non-selected road scene

function makeVrBackend(idBase, overrides) {
  const o = overrides || {};
  const scenes = vr.SELECTED_KEYS.map((key, i) => ({
    id: idBase + i, scene_key: key,
    title: `Title ${key}`, description: `Desc ${key}`,
    image_url: CLOUD + key + '.jpg', cloudinary_public_id: 'demo/' + key,
    node_id: null, building_id: null, initial_yaw: 0, initial_pitch: 0, display_order: i + 1
  }));
  const buildings = [{ id: idBase + 900, name: vr.CAS_SCHEDULE.building_name }];
  const nodes = [{ id: idBase + 800, node_key: 'acad-3' }];
  const casF3 = scenes.find((s) => s.scene_key === 'scene-cas-1st-floor-3').id;
  const hotspots = [{
    id: idBase + 500, scene_id: casF3, target_scene_id: null,
    hotspot_type: 'schedule', label: 'View Room Schedule', text: null,
    schedule_building_id: idBase + 900, schedule_location_type: 'room',
    schedule_location_label: 'CAS 101', schedule_floor_label: 'First Floor',
    yaw: 30, pitch: 0, display_order: 2
  }];
  // allScenes reference includes the selected scenes plus (optionally) the
  // external target scene so an out-of-scope branch target resolves.
  const allScenes = scenes.map((s) => ({ id: s.id, scene_key: s.scene_key }));
  if (o.external) {
    const extId = idBase + 700;
    allScenes.push({ id: extId, scene_key: EXTERNAL_KEY });
    const casF1 = scenes.find((s) => s.scene_key === 'scene-cas-1st-floor').id;
    hotspots.push({
      id: idBase + 600, scene_id: casF1, target_scene_id: extId,
      hotspot_type: 'scene', label: 'Free Roam branch', text: null,
      schedule_building_id: null, schedule_location_type: null, schedule_location_label: null, schedule_floor_label: null,
      yaw: 10, pitch: 0, display_order: 9
    });
  }
  const backend = { scenes, hotspots, nodes, buildings, allScenes };
  if (typeof o.mutate === 'function') o.mutate(backend);
  return backend;
}

function runVrTests() {
  const S = 'vr';
  const casRoute = {
    destination_name: vr.EXPECTED_CAS_SYNC_ROUTE.destination_name,
    destination_node_key: vr.EXPECTED_CAS_SYNC_ROUTE.destination_node_key,
    arrival_scene_key: vr.EXPECTED_CAS_SYNC_ROUTE.arrival_scene_key,
    scene_keys: [...vr.GUIDED_KEYS]
  };
  check(S, 'current CAS natural-key catalog matches the frozen 26-scene sync guard',
    vr.casSyncCatalogProblems().length === 0 && vr.GUIDED_KEYS.length === 26);
  const reorderedScenes = [...casRoute.scene_keys];
  [reorderedScenes[1], reorderedScenes[2]] = [reorderedScenes[2], reorderedScenes[1]];
  const replacedIntermediateScene = [...casRoute.scene_keys];
  replacedIntermediateScene[1] = 'scene-unexpected-intermediate';
  check(S, 'CAS sync guard rejects identity, count, final-step, duplicate, replacement, reorder, and hash-pin drift', [
    [{ ...casRoute, destination_name: 'College of Arts and Sciences' }],
    [{ ...casRoute, destination_node_key: 'cas' }],
    [{ ...casRoute, arrival_scene_key: 'scene-cas-wrong' }],
    [{ ...casRoute, scene_keys: casRoute.scene_keys.slice(0, -1) }],
    [{ ...casRoute, scene_keys: [...casRoute.scene_keys.slice(0, -1), 'scene-other'] }],
    [{ ...casRoute, scene_keys: [...casRoute.scene_keys.slice(0, -1), casRoute.scene_keys[0]] }],
    [{ ...casRoute, scene_keys: replacedIntermediateScene }],
    [{ ...casRoute, scene_keys: reorderedScenes }]
  ].every((catalog) => vr.casSyncCatalogProblems(catalog).length > 0) &&
    vr.casSyncCatalogProblems([casRoute], { ...vr.EXPECTED_CAS_SYNC_ROUTE, scene_keys_sha256: null }).length > 0 &&
    vr.casSyncCatalogProblems([casRoute], { ...vr.EXPECTED_CAS_SYNC_ROUTE, scene_keys_sha256: 'not-a-sha256' }).length > 0);

  const supabase = makeVrBackend(1000);
  const mysql = makeVrBackend(5000);
  const basePlan = vr.buildPlan(supabase, mysql);
  check(S, 'exact parity with different numeric ids -> all present, no writes',
    basePlan.blockers.length === 0 && vr.planIsFullyPresent(basePlan) &&
    basePlan.counts.scene_present === vr.SELECTED_KEYS.length && basePlan.counts.hotspot_present === 1 &&
    basePlan.counts.scene_insert === 0 && basePlan.counts.scene_update === 0 &&
    basePlan.counts.hotspot_insert === 0 && basePlan.counts.hotspot_update === 0 && basePlan.counts.hotspot_delete === 0);
  check(S, 'exactly one CAS schedule target', basePlan.schedule_targets === 1);

  // FINDING 1: every attribute class changes the semantic fingerprint.
  const baseFp = vr.semanticScopeFingerprint(supabase);
  const fpMut = (mutate) => vr.semanticScopeFingerprint(makeVrBackend(1000, { mutate }));
  check(S, 'scene title change changes the semantic fingerprint', fpMut((b) => { b.scenes[3].title = 'X'; }) !== baseFp);
  check(S, 'scene description change changes the fingerprint', fpMut((b) => { b.scenes[3].description = 'X'; }) !== baseFp);
  check(S, 'scene image_url change changes the fingerprint', fpMut((b) => { b.scenes[0].image_url = CLOUD + 'zzz.jpg'; }) !== baseFp);
  check(S, 'scene cloudinary_public_id change changes the fingerprint', fpMut((b) => { b.scenes[0].cloudinary_public_id = 'demo/zzz'; }) !== baseFp);
  check(S, 'scene display_order change changes the fingerprint', fpMut((b) => { b.scenes[0].display_order = 999; }) !== baseFp);
  check(S, 'hotspot label change changes the fingerprint', fpMut((b) => { b.hotspots[0].label = 'X'; }) !== baseFp);
  check(S, 'hotspot text change changes the fingerprint', fpMut((b) => { b.hotspots[0].text = 'X'; }) !== baseFp);
  check(S, 'hotspot yaw change changes the fingerprint', fpMut((b) => { b.hotspots[0].yaw = 99; }) !== baseFp);
  check(S, 'hotspot pitch change changes the fingerprint', fpMut((b) => { b.hotspots[0].pitch = 9; }) !== baseFp);
  check(S, 'hotspot display_order change changes the fingerprint', fpMut((b) => { b.hotspots[0].display_order = 99; }) !== baseFp);
  check(S, 'hotspot schedule metadata change changes the fingerprint', fpMut((b) => { b.hotspots[0].schedule_floor_label = 'Second Floor'; }) !== baseFp);
  // hotspot target change: give a scene hotspot then flip its target.
  const withTargetA = vr.semanticScopeFingerprint(makeVrBackend(1000, { external: true }));
  const withTargetB = vr.semanticScopeFingerprint(makeVrBackend(1000, { external: true, mutate: (b) => { b.hotspots[b.hotspots.length - 1].target_scene_id = b.scenes[0].id; b.allScenes = b.allScenes.filter((s) => s.scene_key !== EXTERNAL_KEY); } }));
  check(S, 'hotspot target change changes the fingerprint', withTargetA !== withTargetB);

  // Truthful actions.
  check(S, 'a scene attribute mismatch yields update (not present)', (() => { const p = vr.buildPlan(supabase, makeVrBackend(5000, { mutate: (b) => { b.scenes[3].title = 'D'; } })); return p.counts.scene_update === 1 && p.counts.scene_present === vr.SELECTED_KEYS.length - 1; })());
  check(S, 'a hotspot attribute mismatch yields update (not present)', (() => { const p = vr.buildPlan(supabase, makeVrBackend(5000, { mutate: (b) => { b.hotspots[0].yaw = 99; } })); return p.counts.hotspot_update === 1 && p.counts.hotspot_present === 0; })());
  check(S, 'a missing MySQL scene yields insert', vr.buildPlan(supabase, makeVrBackend(5000, { mutate: (b) => { b.scenes = b.scenes.filter((s) => s.scene_key !== 'scene-general-road-20'); b.allScenes = b.allScenes.filter((s) => s.scene_key !== 'scene-general-road-20'); } })).counts.scene_insert === 1);
  check(S, 'a MySQL-only in-scope hotspot yields delete', (() => {
    const p = vr.buildPlan(supabase, makeVrBackend(5000, { mutate: (b) => {
      const src = b.scenes.find((s) => s.scene_key === 'scene-cas-1st-floor').id;
      const tgt = b.scenes.find((s) => s.scene_key === 'scene-cas-1st-floor-2').id;
      b.hotspots.push({ id: 5555, scene_id: src, target_scene_id: tgt, hotspot_type: 'scene', label: 'x', text: null, schedule_building_id: null, schedule_location_type: null, schedule_location_label: null, schedule_floor_label: null, yaw: 0, pitch: 0, display_order: 1 });
    } }));
    return p.counts.hotspot_delete === 1;
  })());

  // Duplicate identities fail closed.
  check(S, 'duplicate scene_key fails closed', vr.buildPlan(makeVrBackend(1000, { mutate: (b) => { b.scenes.push({ ...b.scenes[0], id: 999 }); } }), mysql).blockers.length > 0);
  check(S, 'duplicate node_key fails closed', vr.buildPlan(makeVrBackend(1000, { mutate: (b) => { b.nodes.push({ id: 4321, node_key: 'acad-3' }); } }), mysql).blockers.length > 0);
  check(S, 'duplicate canonical building fails closed', vr.buildPlan(makeVrBackend(1000, { mutate: (b) => { b.buildings.push({ id: 4322, name: 'academic building iii' }); } }), mysql).blockers.length > 0);
  check(S, 'duplicate hotspot identity fails closed', vr.buildPlan(makeVrBackend(1000, { mutate: (b) => { b.hotspots.push({ ...b.hotspots[0], id: 4323 }); } }), mysql).blockers.length > 0);

  // External-target fail-closed: an orphaned scene target (resolves to no scene).
  check(S, 'an unresolved (orphaned) scene-hotspot target fails closed', vr.buildPlan(makeVrBackend(1000, { mutate: (b) => {
    const src = b.scenes.find((s) => s.scene_key === 'scene-cas-1st-floor').id;
    b.hotspots.push({ id: 7777, scene_id: src, target_scene_id: 999999, hotspot_type: 'scene', label: 'orphan', text: null, schedule_building_id: null, schedule_location_type: null, schedule_location_label: null, schedule_floor_label: null, yaw: 0, pitch: 0, display_order: 1 });
  } }), mysql).blockers.length > 0);
  // Duplicate external branch identity fails closed.
  check(S, 'a duplicate external-branch identity fails closed', vr.buildPlan(makeVrBackend(1000, { external: true, mutate: (b) => { b.hotspots.push({ ...b.hotspots[b.hotspots.length - 1], id: 7778 }); } }), makeVrBackend(5000)).blockers.length > 0);

  // FINDING 3: the semantic fingerprint helpers THEMSELVES fail closed on any
  // identity blocker — an invalid/ambiguous snapshot can never collapse into a
  // matching hash during authority/preflight/rollback/post-commit verification.
  check(S, 'semanticScopeFingerprint throws on a duplicate scene_key', threw(() => vr.semanticScopeFingerprint(makeVrBackend(1000, { mutate: (b) => { b.scenes.push({ ...b.scenes[0], id: 999 }); } }))));
  check(S, 'semanticScopeFingerprint throws on a duplicate node_key', threw(() => vr.semanticScopeFingerprint(makeVrBackend(1000, { mutate: (b) => { b.nodes.push({ id: 4321, node_key: 'acad-3' }); } }))));
  check(S, 'semanticScopeFingerprint throws on a duplicate canonical building', threw(() => vr.semanticScopeFingerprint(makeVrBackend(1000, { mutate: (b) => { b.buildings.push({ id: 4322, name: 'academic building iii' }); } }))));
  check(S, 'semanticScopeFingerprint throws on a duplicate hotspot identity (never equal fp)', threw(() => vr.semanticScopeFingerprint(makeVrBackend(1000, { mutate: (b) => { b.hotspots.push({ ...b.hotspots[0], id: 4323 }); } }))));
  check(S, 'semanticScopeFingerprint throws on an orphaned external target', threw(() => vr.semanticScopeFingerprint(makeVrBackend(1000, { mutate: (b) => {
    const src = b.scenes.find((s) => s.scene_key === 'scene-cas-1st-floor').id;
    b.hotspots.push({ id: 7777, scene_id: src, target_scene_id: 999999, hotspot_type: 'scene', label: 'orphan', text: null, schedule_building_id: null, schedule_location_type: null, schedule_location_label: null, schedule_floor_label: null, yaw: 0, pitch: 0, display_order: 1 });
  } }))));
  check(S, 'externalBranchFingerprint also fails closed on an identity blocker', threw(() => vr.externalBranchFingerprint(makeVrBackend(1000, { mutate: (b) => { b.nodes.push({ id: 4321, node_key: 'acad-3' }); } }))));
  // A duplicate hotspot must THROW rather than silently produce the clean fingerprint.
  check(S, 'a duplicate hotspot yields no fingerprint (throws instead of colliding)', (() => {
    let dupFp = null;
    try { dupFp = vr.semanticScopeFingerprint(makeVrBackend(1000, { mutate: (b) => { b.hotspots.push({ ...b.hotspots[0], id: 4324 }); } })); } catch (_) { dupFp = null; }
    return dupFp === null && dupFp !== baseFp;
  })());

  // ---- CORRECTION #4 (Finding 1): required schedule-identity validation ----
  const schedMut = (mut) => threw(() => vr.semanticScopeFingerprint(makeVrBackend(1000, { mutate: mut })));
  const schedValid = (mut) => { try { return typeof vr.semanticScopeFingerprint(makeVrBackend(1000, { mutate: mut })) === 'string'; } catch (_) { return false; } };
  check(S, 'schedule hotspot missing building id -> fingerprint throws', schedMut((b) => { b.hotspots[0].schedule_building_id = null; }));
  check(S, 'schedule hotspot with an unknown building id -> fingerprint throws', schedMut((b) => { b.hotspots[0].schedule_building_id = 424242; }));
  check(S, 'schedule hotspot with an invalid location type -> fingerprint throws', schedMut((b) => { b.hotspots[0].schedule_location_type = 'wing'; }));
  check(S, 'schedule hotspot with a missing location type -> fingerprint throws', schedMut((b) => { b.hotspots[0].schedule_location_type = null; }));
  check(S, 'schedule hotspot with a blank location label -> fingerprint throws', schedMut((b) => { b.hotspots[0].schedule_location_label = '   '; }));
  check(S, 'schedule hotspot with a missing location label -> fingerprint throws', schedMut((b) => { b.hotspots[0].schedule_location_label = null; }));
  check(S, 'schedule hotspot with a SUPPLIED blank floor label -> fingerprint throws', schedMut((b) => { b.hotspots[0].schedule_floor_label = '   '; }));
  check(S, 'schedule hotspot with a NULL (optional) floor label remains valid', schedValid((b) => { b.hotspots[0].schedule_floor_label = null; }));
  check(S, 'schedule hotspot with a supplied non-empty floor label remains valid', schedValid((b) => { b.hotspots[0].schedule_floor_label = 'Second Floor'; }));
  check(S, 'a duplicate schedule identity still fails closed', schedMut((b) => { b.hotspots.push({ ...b.hotspots[0], id: 6001 }); }));
  check(S, 'an info hotspot with a missing (blank) label fails closed', schedMut((b) => {
    const src = b.scenes.find((s) => s.scene_key === 'scene-cas-1st-floor-2').id;
    b.hotspots.push({ id: 8801, scene_id: src, target_scene_id: null, hotspot_type: 'info', label: '   ', text: 'x', schedule_building_id: null, schedule_location_type: null, schedule_location_label: null, schedule_floor_label: null, yaw: 0, pitch: 0, display_order: 1 });
  }));
  check(S, 'an exit hotspot with a missing label fails closed', schedMut((b) => {
    const src = b.scenes.find((s) => s.scene_key === 'scene-cas-1st-floor-2').id;
    b.hotspots.push({ id: 8802, scene_id: src, target_scene_id: null, hotspot_type: 'exit', label: null, text: 'x', schedule_building_id: null, schedule_location_type: null, schedule_location_label: null, schedule_floor_label: null, yaw: 0, pitch: 0, display_order: 1 });
  }));
  // Invalid target-side MySQL identity must BLOCK the plan (never a silent delete/replace).
  check(S, 'an invalid schedule identity in the MySQL target blocks the plan (no silent delete)',
    vr.buildPlan(makeVrBackend(1000), makeVrBackend(5000, { mutate: (b) => { b.hotspots[0].schedule_building_id = 424242; } })).blockers.length > 0);

  // ---- CORRECTION #4 (Finding 2): strict raw-numeric validation ----
  const numThrows = (field, isScene) => (bad) => threw(() => vr.semanticScopeFingerprint(makeVrBackend(1000, { mutate: (b) => { if (isScene) b.scenes[0][field] = bad; else b.hotspots[0][field] = bad; } })));
  const numValid = (bad) => { try { return typeof vr.semanticScopeFingerprint(makeVrBackend(1000, { mutate: (b) => { b.hotspots[0].yaw = bad; } })) === 'string'; } catch (_) { return false; } };
  for (const f of ['initial_yaw', 'initial_pitch', 'display_order']) check(S, `malformed scene ${f} -> fingerprint throws`, numThrows(f, true)('not-a-number'));
  for (const f of ['yaw', 'pitch', 'display_order']) check(S, `malformed hotspot ${f} -> fingerprint throws`, numThrows(f, false)('not-a-number'));
  for (const bad of [NaN, Infinity, -Infinity]) check(S, `non-finite numeric ${bad} -> fingerprint throws`, numThrows('yaw', false)(bad));
  for (const bad of ['', '   ', true, false, [], [5], {}, 'x12']) check(S, `malformed numeric ${JSON.stringify(bad)} -> fingerprint throws`, numThrows('yaw', false)(bad));
  for (const good of [0, -12.5, 359, '0', '12.5', ' 7 ']) check(S, `valid numeric ${JSON.stringify(good)} remains valid`, numValid(good));
  check(S, 'a real NULL numeric produces a valid fingerprint', numValid(null));
  check(S, 'malformed numeric yields no fingerprint (cannot equal the NULL fingerprint)', (() => {
    let nullFp = null; try { nullFp = vr.semanticScopeFingerprint(makeVrBackend(1000, { mutate: (b) => { b.hotspots[0].yaw = null; } })); } catch (_) { nullFp = null; }
    let malFp = null; try { malFp = vr.semanticScopeFingerprint(makeVrBackend(1000, { mutate: (b) => { b.hotspots[0].yaw = 'not-a-number'; } })); } catch (_) { malFp = null; }
    return typeof nullFp === 'string' && malFp === null && malFp !== nullFp;
  })());
  check(S, 'buildPlan blocks malformed numeric in the Supabase authority fixture',
    vr.buildPlan(makeVrBackend(1000, { mutate: (b) => { b.scenes[0].initial_yaw = 'not-a-number'; } }), makeVrBackend(5000)).blockers.length > 0);
  check(S, 'buildPlan blocks malformed numeric in the MySQL target fixture',
    vr.buildPlan(makeVrBackend(1000), makeVrBackend(5000, { mutate: (b) => { b.hotspots[0].yaw = 'not-a-number'; } })).blockers.length > 0);

  // ---- CORRECTION #5 (P1): dangling scene node_id / building_id fail closed ----
  const sfp = (mut) => { try { return vr.semanticScopeFingerprint(makeVrBackend(1000, { mutate: mut })); } catch (_) { return null; } };
  const sfpValid = (mut) => typeof sfp(mut) === 'string';
  const sfpThrows = (mut) => sfp(mut) === null;
  // Genuine NULL / undefined relationships stay valid.
  check(S, 'genuine NULL node_id produces a valid fingerprint', sfpValid((b) => { b.scenes[0].node_id = null; }));
  check(S, 'genuine NULL building_id produces a valid fingerprint', sfpValid((b) => { b.scenes[0].building_id = null; }));
  check(S, 'genuine undefined node_id produces a valid fingerprint', sfpValid((b) => { b.scenes[0].node_id = undefined; }));
  // Supplied dangling ids throw.
  check(S, 'a supplied dangling node_id makes the fingerprint throw', sfpThrows((b) => { b.scenes[0].node_id = 999999; }));
  check(S, 'a supplied dangling building_id makes the fingerprint throw', sfpThrows((b) => { b.scenes[0].building_id = 999999; }));
  // Malformed / non-positive supplied ids fail closed (never normalized to null).
  for (const bad of [0, -1, 1.5, 'abc', '', {}]) {
    check(S, `malformed/non-positive node_id ${JSON.stringify(bad)} fails closed`, sfpThrows((b) => { b.scenes[0].node_id = bad; }));
    check(S, `malformed/non-positive building_id ${JSON.stringify(bad)} fails closed`, sfpThrows((b) => { b.scenes[0].building_id = bad; }));
  }
  // A dangling relationship can never PRODUCE or EQUAL the genuine-NULL fingerprint.
  check(S, 'a dangling node relationship cannot produce or equal the NULL fingerprint', (() => {
    const nullFp = sfp((b) => { b.scenes[0].node_id = null; });
    const dangFp = sfp((b) => { b.scenes[0].node_id = 999999; });
    return typeof nullFp === 'string' && dangFp === null && dangFp !== nullFp;
  })());
  check(S, 'a dangling building relationship cannot produce or equal the NULL fingerprint', (() => {
    const nullFp = sfp((b) => { b.scenes[0].building_id = null; });
    const dangFp = sfp((b) => { b.scenes[0].building_id = 999999; });
    return typeof nullFp === 'string' && dangFp === null && dangFp !== nullFp;
  })());
  // buildPlan blocks dangling ids in EITHER backend (never a silent NULL/delete).
  check(S, 'buildPlan blocks a dangling node_id in the Supabase authority', vr.buildPlan(makeVrBackend(1000, { mutate: (b) => { b.scenes[0].node_id = 999999; } }), makeVrBackend(5000)).blockers.length > 0);
  check(S, 'buildPlan blocks a dangling node_id in the MySQL target', vr.buildPlan(makeVrBackend(1000), makeVrBackend(5000, { mutate: (b) => { b.scenes[0].node_id = 999999; } })).blockers.length > 0);
  check(S, 'buildPlan blocks a dangling building_id in the Supabase authority', vr.buildPlan(makeVrBackend(1000, { mutate: (b) => { b.scenes[0].building_id = 999999; } }), makeVrBackend(5000)).blockers.length > 0);
  check(S, 'buildPlan blocks a dangling building_id in the MySQL target', vr.buildPlan(makeVrBackend(1000), makeVrBackend(5000, { mutate: (b) => { b.scenes[0].building_id = 999999; } })).blockers.length > 0);
  // Mixed-source: DIFFERENT backend-local numeric ids resolve to the same natural key -> equal.
  check(S, 'valid node relationships with different backend ids compare equal via node_key', (() => {
    const p = vr.buildPlan(
      makeVrBackend(1000, { mutate: (b) => { b.scenes[0].node_id = b.nodes[0].id; } }),
      makeVrBackend(5000, { mutate: (b) => { b.scenes[0].node_id = b.nodes[0].id; } }));
    return p.blockers.length === 0 && vr.planIsFullyPresent(p);
  })());
  check(S, 'valid building relationships with different backend ids compare equal via canonical name', (() => {
    const p = vr.buildPlan(
      makeVrBackend(1000, { mutate: (b) => { b.scenes[0].building_id = b.buildings[0].id; } }),
      makeVrBackend(5000, { mutate: (b) => { b.scenes[0].building_id = b.buildings[0].id; } }));
    return p.blockers.length === 0 && vr.planIsFullyPresent(p);
  })());

  // ---- CORRECTION #6 (P1): NON-COERCIVE id parsing ----
  // A fixture whose node map AND building map each contain a REAL row with id = 1,
  // so a coercive Number() parser would resolve true / [1] to that legitimate row
  // (the historical collision). node_id=1 / building_id=1 must therefore succeed,
  // while true / [1] must be rejected by TYPE (not for pointing at a missing row).
  function withIdOneRefs(idBase, sceneMut) {
    return makeVrBackend(idBase, { mutate: (b) => {
      b.nodes.push({ id: 1, node_key: 'main-gate' });        // real id=1 node, distinct key
      b.buildings.push({ id: 1, name: 'Registrar Office' });  // real id=1 building, distinct canonical
      if (sceneMut) sceneMut(b);
    } });
  }
  const idfp = (idBase, mut) => { try { return vr.semanticScopeFingerprint(withIdOneRefs(idBase, mut)); } catch (_) { return null; } };
  // node_id: numeric 1 valid; true / [1] throw; neither equals the numeric-1 fingerprint.
  const nodeOneFp = idfp(1000, (b) => { b.scenes[0].node_id = 1; });
  check(S, 'numeric node_id=1 (real id=1 node) produces a valid fingerprint', typeof nodeOneFp === 'string');
  check(S, 'node_id=true throws and produces no fingerprint', idfp(1000, (b) => { b.scenes[0].node_id = true; }) === null);
  check(S, 'node_id=[1] throws and produces no fingerprint', idfp(1000, (b) => { b.scenes[0].node_id = [1]; }) === null);
  check(S, 'neither true nor [1] node value can equal the numeric-1 fingerprint',
    typeof nodeOneFp === 'string' && idfp(1000, (b) => { b.scenes[0].node_id = true; }) === null && idfp(1000, (b) => { b.scenes[0].node_id = [1]; }) === null);
  check(S, 'a canonical decimal-string node_id="1" still resolves (driver compat)', typeof idfp(1000, (b) => { b.scenes[0].node_id = '1'; }) === 'string');
  // building_id: numeric 1 valid; true / [1] throw; neither equals the numeric-1 fingerprint.
  const bldOneFp = idfp(1000, (b) => { b.scenes[0].building_id = 1; });
  check(S, 'numeric building_id=1 (real id=1 building) produces a valid fingerprint', typeof bldOneFp === 'string');
  check(S, 'building_id=true throws and produces no fingerprint', idfp(1000, (b) => { b.scenes[0].building_id = true; }) === null);
  check(S, 'building_id=[1] throws and produces no fingerprint', idfp(1000, (b) => { b.scenes[0].building_id = [1]; }) === null);
  check(S, 'neither true nor [1] building value can equal the numeric-1 fingerprint',
    typeof bldOneFp === 'string' && idfp(1000, (b) => { b.scenes[0].building_id = true; }) === null && idfp(1000, (b) => { b.scenes[0].building_id = [1]; }) === null);
  check(S, 'a canonical decimal-string building_id="1" still resolves (driver compat)', typeof idfp(1000, (b) => { b.scenes[0].building_id = '1'; }) === 'string');
  // buildPlan blocks true / [existingId] coercions in BOTH backends.
  check(S, 'buildPlan blocks node_id=true in the Supabase authority', vr.buildPlan(withIdOneRefs(1000, (b) => { b.scenes[0].node_id = true; }), withIdOneRefs(5000)).blockers.length > 0);
  check(S, 'buildPlan blocks node_id=[1] in the MySQL target', vr.buildPlan(withIdOneRefs(1000), withIdOneRefs(5000, (b) => { b.scenes[0].node_id = [1]; })).blockers.length > 0);
  check(S, 'buildPlan blocks building_id=true in the Supabase authority', vr.buildPlan(withIdOneRefs(1000, (b) => { b.scenes[0].building_id = true; }), withIdOneRefs(5000)).blockers.length > 0);
  check(S, 'buildPlan blocks building_id=[1] in the MySQL target', vr.buildPlan(withIdOneRefs(1000), withIdOneRefs(5000, (b) => { b.scenes[0].building_id = [1]; })).blockers.length > 0);
  // The shared parser grammar, tested directly.
  for (const bad of [true, false, [], [1], [1, 2], {}, new Number(5), '', '   ', '0', '01', '-1', '+1', '1.5', ' 1.0 ', '1e3', '0x10', 'abc', NaN, Infinity, -Infinity, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '9007199254740993']) {
    check(S, `positiveInt rejects (${typeof bad}) ${typeof bad === 'object' && bad !== null ? JSON.stringify(bad) : String(bad)}`, vr.positiveInt(bad) === null);
  }
  for (const [good, want] of [[1, 1], [2, 2], [5900, 5900], [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER], ['1', 1], ['5900', 5900], [' 42 ', 42]]) {
    check(S, `positiveInt accepts ${JSON.stringify(good)} -> ${want}`, vr.positiveInt(good) === want);
  }

  // Media / number fail-closed.
  check(S, 'missing guided Cloudinary URL blocks', vr.buildPlan(makeVrBackend(1000, { mutate: (b) => { b.scenes[0].image_url = null; } }), mysql).blockers.length > 0);
  check(S, 'local-only guided image_url blocks', vr.buildPlan(makeVrBackend(1000, { mutate: (b) => { b.scenes[0].image_url = '/img/vr/x.jpg'; } }), mysql).blockers.length > 0);
  check(S, 'missing guided cloudinary_public_id blocks', vr.buildPlan(makeVrBackend(1000, { mutate: (b) => { b.scenes[0].cloudinary_public_id = null; } }), mysql).blockers.length > 0);
  check(S, 'invalid guided cloudinary_public_id blocks', vr.buildPlan(makeVrBackend(1000, { mutate: (b) => { b.scenes[0].cloudinary_public_id = 'bad id!'; } }), mysql).blockers.length > 0);
  check(S, 'a non-finite scene number blocks (never coerced to 0)', vr.buildPlan(makeVrBackend(1000, { mutate: (b) => { b.scenes[0].initial_yaw = 'not-a-number'; } }), mysql).blockers.length > 0);
  check(S, 'zero CAS schedule targets blocks', vr.buildPlan(makeVrBackend(1000, { mutate: (b) => { b.hotspots = []; } }), mysql).blockers.length > 0);

  // External branch is preserved (excluded from parity planning; counted).
  const extPlan = vr.buildPlan(makeVrBackend(1000, { external: true }), makeVrBackend(5000, { external: true }));
  check(S, 'an external Free Roam branch is preserved, not planned', extPlan.blockers.length === 0 && vr.planIsFullyPresent(extPlan) && extPlan.counts.external_branches_preserved === 1);

  // parseArgs guards.
  check(S, 'parseArgs default is dry-run', vr.parseArgs(['node', 's']).mode === 'dry-run');
  check(S, 'parseArgs rejects unknown args', threw(() => vr.parseArgs(['node', 's', '--boom'])));
  check(S, 'parseArgs rejects --apply without token', threw(() => vr.parseArgs(['node', 's', '--apply'])));
  check(S, 'parseArgs rejects --apply with wrong token', threw(() => vr.parseArgs(['node', 's', '--apply', '--confirm=NOPE'])));
  check(S, 'parseArgs accepts the exact apply token', vr.parseArgs(['node', 's', '--apply', `--confirm=${vr.APPLY_CONFIRMATION}`]).mode === 'apply');
}

/* =========================================================================
   VR adapter-driven transaction: backup order, selective mutation, pre-commit
   proof, external preservation, verified rollback.
========================================================================= */
function cloneScope(b) {
  return {
    scenes: b.scenes.map((s) => ({ ...s })), hotspots: b.hotspots.map((h) => ({ ...h })),
    nodes: b.nodes.map((n) => ({ ...n })), buildings: b.buildings.map((x) => ({ ...x })),
    allScenes: (b.allScenes || b.scenes.map((s) => ({ id: s.id, scene_key: s.scene_key }))).map((s) => ({ ...s }))
  };
}

function makeMockVrAdapter(authority, initialMysql, opts) {
  const options = opts || {};
  let mysqlState = cloneScope(initialMysql);
  const baseline = cloneScope(initialMysql);
  let committed = false;
  let lockedReads = 0;
  let authReads = 0;
  const calls = { createBackup: 0, applyScenes: 0, applyHotspots: 0, commit: 0, rollback: 0, sceneMutations: 0, hotspotMutations: 0 };

  function maps() {
    return {
      sceneIdByKey: new Map(mysqlState.scenes.map((s) => [s.scene_key, s.id])),
      buildingIdByCanon: new Map(mysqlState.buildings.map((b) => [vr.canonicalKey(b.name), b.id])),
      nodeIdByKey: new Map(mysqlState.nodes.map((n) => [n.node_key, n.id])),
      allKeyById: new Map(mysqlState.allScenes.map((s) => [s.id, s.scene_key])),
      buildingNameById: new Map(mysqlState.buildings.map((b) => [b.id, b.name]))
    };
  }
  const isScene = (t) => vr.optStr(t) === 'scene';

  return {
    _committed() { return committed; },
    _calls() { return calls; },
    _mysql() { return mysqlState; },
    async begin() { if (options.failBegin) throw new Error('begin failed'); },
    async readLockedScope() {
      lockedReads++;
      if (options.throwLockedRead && lockedReads === 1) throw new Error('locked-scope read transport failure');
      return cloneScope(mysqlState);
    },
    async readFreshScope() {
      if (options.throwPostCommitRead && committed) throw new Error('post-commit read transport failure');
      if (options.postCommitParityBreak && committed) { const s = cloneScope(mysqlState); if (s.scenes[0]) s.scenes[0].title = 'POST-COMMIT-DRIFT'; return s; }
      return cloneScope(mysqlState);
    },
    async readAuthority() {
      authReads++;
      if (options.throwAuthorityRead && authReads === 1) throw new Error('authority read transport failure');
      if (options.driftAuthority) { const s = cloneScope(authority); if (s.scenes[1]) s.scenes[1].title = 'AUTHORITY-DRIFT'; return s; }
      return cloneScope(authority);
    },
    async createBackup(scope, fp) {
      calls.createBackup++;
      if (options.failBackup) throw new Error('backup write transport failure');
      if (options.badBackupFingerprint) return { backupPath: '<probe-backup-path>', fingerprint: 'WRONG-FINGERPRINT' };
      return { backupPath: '<probe-backup-path>', fingerprint: fp };
    },
    async applyScenes(scenePlan) {
      calls.applyScenes++;
      if (options.breakScenes) return { ok: true };
      const M = maps();
      let nextId = Math.max(0, ...mysqlState.scenes.map((s) => s.id), ...mysqlState.allScenes.map((s) => s.id)) + 1;
      for (const s of scenePlan) {
        if (s.action === 'present') continue;
        calls.sceneMutations++;
        const e = s.expected;
        const nodeId = e.node_key ? (M.nodeIdByKey.get(e.node_key) || null) : null;
        const buildingId = e.building_canonical ? (M.buildingIdByCanon.get(e.building_canonical) || null) : null;
        const cols = { title: e.title, description: e.description, image_url: e.image_url, cloudinary_public_id: e.cloudinary_public_id, node_id: nodeId, building_id: buildingId, initial_yaw: e.initial_yaw, initial_pitch: e.initial_pitch, display_order: e.display_order };
        if (s.action === 'update') Object.assign(mysqlState.scenes.find((x) => x.scene_key === s.scene_key), cols);
        else { const id = nextId++; mysqlState.scenes.push({ id, scene_key: s.scene_key, ...cols }); mysqlState.allScenes.push({ id, scene_key: s.scene_key }); }
      }
      return { ok: true };
    },
    async applyHotspots(hotspotPlan) {
      calls.applyHotspots++;
      if (options.breakHotspots) return { ok: true };
      const M = maps();
      const idByIdentity = new Map();
      for (const h of mysqlState.hotspots) {
        const sourceKey = M.allKeyById.get(h.scene_id);
        if (!sourceKey || !vr.SELECTED_KEYS.includes(sourceKey)) continue;
        if (isScene(h.hotspot_type)) { const tk = h.target_scene_id != null ? M.allKeyById.get(h.target_scene_id) : null; if (!tk || !vr.SELECTED_KEYS.includes(tk)) continue; }
        const identity = vr.hotspotIdentity(sourceKey, h, M.allKeyById, M.buildingNameById);
        if (identity) idByIdentity.set(identity, h);
      }
      let nextId = Math.max(0, ...mysqlState.hotspots.map((h) => h.id)) + 1;
      for (const h of hotspotPlan) {
        if (h.action === 'present') continue;
        calls.hotspotMutations++;
        if (h.action === 'delete') { const row = idByIdentity.get(h.identity); mysqlState.hotspots = mysqlState.hotspots.filter((x) => x !== row); continue; }
        const e = h.expected;
        const sceneId = M.sceneIdByKey.get(h.source_scene_key);
        const targetId = e.target_key ? M.sceneIdByKey.get(e.target_key) : null;
        const schedBId = e.schedule_building_canonical ? M.buildingIdByCanon.get(e.schedule_building_canonical) : null;
        const cols = { scene_id: sceneId, target_scene_id: targetId, hotspot_type: e.type, label: e.label, text: e.text, schedule_building_id: schedBId, schedule_location_type: e.schedule_location_type, schedule_location_label: e.schedule_location_label, schedule_floor_label: e.schedule_floor_label, yaw: e.yaw, pitch: e.pitch, display_order: e.display_order };
        if (h.action === 'update') Object.assign(idByIdentity.get(h.identity), cols);
        else mysqlState.hotspots.push({ id: nextId++, ...cols });
      }
      return { ok: true };
    },
    async commit() { calls.commit++; committed = true; return { ok: true }; },
    async rollback() {
      calls.rollback++;
      if (options.throwRollback) throw new Error('rollback transport failure');
      mysqlState = cloneScope(baseline);
      if (options.corruptRollbackScene) mysqlState.scenes.find((s) => s.scene_key === 'scene-guard-house').title = 'CORRUPT';
      if (options.corruptRollbackHotspot) mysqlState.hotspots[0].yaw = 12345;
      return { ok: true };
    }
  };
}

async function runVrTxTests() {
  const S = 'vr-tx';
  const authority = makeVrBackend(1000, { external: true });
  const approvedAuthorityFp = vr.semanticScopeFingerprint(authority);
  // MySQL initially out of parity (a scene + a hotspot mismatch) + the external branch.
  const initialMysql = makeVrBackend(5000, { external: true, mutate: (b) => { b.scenes[2].title = 'stale'; b.hotspots[0].label = 'stale label'; } });
  const approvedPlan = vr.buildPlan(authority, initialMysql);
  const extBefore = vr.externalBranchFingerprint(initialMysql);

  // SUCCESS: reconcile -> pre-commit proof passes -> commit; external preserved.
  const okAdapter = makeMockVrAdapter(authority, initialMysql);
  let okRes = null;
  try { okRes = await vr.applyPlanWithAdapter(okAdapter, approvedPlan, approvedAuthorityFp); } catch (_) { okRes = null; }
  check(S, 'successful flow commits only after transaction-local parity proof', okRes && okRes.committed === true && okAdapter._committed() === true);
  check(S, 'success returns the backup path', okRes && okRes.backupPath === '<probe-backup-path>');
  check(S, 'backup is created BEFORE the first mutation', okAdapter._calls().createBackup === 1 && okAdapter._calls().applyScenes === 1);
  check(S, 'out-of-scope Free Roam branch survives the sync unchanged', vr.externalBranchFingerprint(okAdapter._mysql()) === extBefore);
  check(S, 'a planned update/delete touches only its identity (1 scene + 1 hotspot mutation here)',
    okAdapter._calls().sceneMutations === 1 && okAdapter._calls().hotspotMutations === 1);
  check(S, 'a successful commit never invokes rollback', okAdapter._calls().rollback === 0);

  // FINDING: present actions perform zero mutations (already-parity fixture).
  const parityMysql = makeVrBackend(5000, { external: true });
  const parityPlan = vr.buildPlan(authority, parityMysql);
  const parityAdapter = makeMockVrAdapter(authority, parityMysql);
  await vr.applyPlanWithAdapter(parityAdapter, parityPlan, approvedAuthorityFp).catch(() => {});
  check(S, 'a fully-present plan performs ZERO scene/hotspot mutations', parityAdapter._calls().sceneMutations === 0 && parityAdapter._calls().hotspotMutations === 0);

  // FINDING 2: every failure after begin rolls back EXACTLY once; before a locked
  // baseline / usable backup exists it reports rolled-back-no-data and invents NO path.
  const backupCount = (msg) => (msg.match(/Backup:/g) || []).length;
  async function expectRollbackNoData(label, adapterOpts, mysqlScope, approved) {
    const ad = makeMockVrAdapter(authority, mysqlScope || initialMysql, adapterOpts);
    const msg = await catchMsg(() => vr.applyPlanWithAdapter(ad, approved || approvedPlan, approvedAuthorityFp));
    check(S, label, msg != null && /rolled back and no data was written/i.test(msg) && !/Backup:/.test(msg) &&
      ad._committed() === false && ad._calls().rollback === 1 && ad._calls().applyScenes === 0);
  }
  await expectRollbackNoData('locked-scope read failure after begin rolls back once (no invented path)', { throwLockedRead: true });
  await expectRollbackNoData('authority read failure after begin rolls back once (no invented path)', { throwAuthorityRead: true });
  await expectRollbackNoData('authority drift after begin rolls back once (no invented path)', { driftAuthority: true });
  // Transaction-local preflight blocker (a duplicate MySQL scene) also rolls back once.
  const dupMysql = makeVrBackend(5000, { external: true, mutate: (b) => { b.scenes.push({ ...b.scenes[0], id: 5999 }); } });
  await expectRollbackNoData('transaction-local preflight blocker rolls back once (no invented path)', {}, dupMysql, vr.buildPlan(authority, initialMysql));

  // FINDING 5: backup CREATION throw happens before mutation, rolls back once, no invented path.
  const backupFailAdapter = makeMockVrAdapter(authority, initialMysql, { failBackup: true });
  const backupMsg = await catchMsg(() => vr.applyPlanWithAdapter(backupFailAdapter, approvedPlan, approvedAuthorityFp));
  check(S, 'backup-creation failure rolls back once, no commit, no mutation, no invented path',
    backupMsg != null && /rolled back and no data was written/i.test(backupMsg) && !/Backup:/.test(backupMsg) &&
    backupFailAdapter._committed() === false && backupFailAdapter._calls().applyScenes === 0 && backupFailAdapter._calls().rollback === 1);

  // FINDING 5: backup VERIFICATION failure (bad fingerprint) -> "no usable backup", rolled back, no mutation.
  const badFpAdapter = makeMockVrAdapter(authority, initialMysql, { badBackupFingerprint: true });
  const badFpMsg = await catchMsg(() => vr.applyPlanWithAdapter(badFpAdapter, approvedPlan, approvedAuthorityFp));
  check(S, 'backup fingerprint mismatch -> no usable backup, rolled back, no mutation',
    badFpMsg != null && /no usable backup/i.test(badFpMsg) && badFpAdapter._committed() === false &&
    badFpAdapter._calls().applyScenes === 0 && badFpAdapter._calls().rollback === 1);

  // FINDING 2: a backup-creation rollback that itself FAILS is surfaced, never claimed successful.
  const backupRbFailAdapter = makeMockVrAdapter(authority, initialMysql, { failBackup: true, throwRollback: true });
  const backupRbFailMsg = await catchMsg(() => vr.applyPlanWithAdapter(backupRbFailAdapter, approvedPlan, approvedAuthorityFp));
  check(S, 'backup-creation rollback failure is surfaced (ROLLBACK FAILED), never claimed successful',
    backupRbFailMsg != null && /ROLLBACK FAILED/i.test(backupRbFailMsg) && !/rolled back and (no data|verified)/i.test(backupRbFailMsg) &&
    backupRbFailAdapter._committed() === false);

  // ---- CORRECTION #4 (Finding 3): live-adapter connection destroy-vs-release ----
  // A fake PromisePoolConnection tracking release()/destroy() counts + a fake pool.
  function makeFakeConn(o) {
    o = o || {};
    const c = {
      released: 0, destroyed: 0,
      async beginTransaction() { if (o.failBegin) throw new Error('begin failed'); },
      async commit() { if (o.failCommit) throw new Error('commit failed'); },
      async rollback() { if (o.failRollback) throw new Error('rollback failed'); },
      release() { c.released++; if (o.failRelease) throw new Error('release failed'); },
      destroy() { c.destroyed++; }
    };
    return c;
  }
  function makeFakePool(conn, o) {
    o = o || {};
    return { getConnectionCalls: 0, async getConnection() { this.getConnectionCalls++; if (o.failGetConnection) throw new Error('no connection available'); return conn; } };
  }

  // getConnection failure -> zero release/destroy, no retained conn.
  const cGet = makeFakeConn();
  const aGet = vr.makeLiveAdapter(null, makeFakePool(cGet, { failGetConnection: true }));
  const getThrew = await threwAsync(() => aGet.begin());
  check(S, 'getConnection failure: zero release/destroy calls, no retained conn',
    getThrew && cGet.released === 0 && cGet.destroyed === 0 && aGet._hasConn() === false);

  // beginTransaction failure -> destroy=1, release=0, _hasConn=false.
  const cBegin = makeFakeConn({ failBegin: true });
  const aBegin = vr.makeLiveAdapter(null, makeFakePool(cBegin));
  const beginThrew = await threwAsync(() => aBegin.begin());
  check(S, 'beginTransaction failure destroys (never releases) and clears conn',
    beginThrew && cBegin.destroyed === 1 && cBegin.released === 0 && aBegin._hasConn() === false);

  // Confirmed rollback -> release=1, destroy=0.
  const cRb = makeFakeConn();
  const aRb = vr.makeLiveAdapter(null, makeFakePool(cRb));
  await aRb.begin();
  const rbRes = await aRb.rollback();
  check(S, 'confirmed rollback releases once, never destroys, clears conn',
    rbRes && rbRes.ok === true && cRb.released === 1 && cRb.destroyed === 0 && aRb._hasConn() === false);

  // Rollback failure -> destroy=1, release=0, _hasConn=false, propagates.
  const cRbFail = makeFakeConn({ failRollback: true });
  const aRbFail = vr.makeLiveAdapter(null, makeFakePool(cRbFail));
  await aRbFail.begin();
  const rbFailThrew = await threwAsync(() => aRbFail.rollback());
  check(S, 'rollback failure destroys (never releases), clears conn, propagates',
    rbFailThrew && cRbFail.destroyed === 1 && cRbFail.released === 0 && aRbFail._hasConn() === false);

  // Confirmed commit -> release=1, destroy=0.
  const cCommit = makeFakeConn();
  const aCommit = vr.makeLiveAdapter(null, makeFakePool(cCommit));
  await aCommit.begin();
  const commitRes = await aCommit.commit();
  check(S, 'confirmed commit releases once, never destroys, clears conn',
    commitRes && commitRes.ok === true && cCommit.released === 1 && cCommit.destroyed === 0 && aCommit._hasConn() === false);

  // Release failure after confirmed commit -> destroy the connection (no pool return, no 2nd release).
  const cRelFail = makeFakeConn({ failRelease: true });
  const aRelFail = vr.makeLiveAdapter(null, makeFakePool(cRelFail));
  await aRelFail.begin();
  const relFailRes = await aRelFail.commit();
  check(S, 'release failure after commit destroys the connection (one release, one destroy)',
    relFailRes && relFailRes.ok === true && cRelFail.released === 1 && cRelFail.destroyed === 1 && aRelFail._hasConn() === false);

  // Commit failure before confirmation -> conn RETAINED for the outer rollback path.
  const cCommitFail = makeFakeConn({ failCommit: true });
  const aCommitFail = vr.makeLiveAdapter(null, makeFakePool(cCommitFail));
  await aCommitFail.begin();
  const commitFailThrew = await threwAsync(() => aCommitFail.commit());
  check(S, 'commit failure retains conn (no release/destroy) for the outer rollback path',
    commitFailThrew && cCommitFail.released === 0 && cCommitFail.destroyed === 0 && aCommitFail._hasConn() === true);
  const afterCommitFailRb = await aCommitFail.rollback();
  check(S, 'post-commit-failure rollback then releases exactly once (no double dispose)',
    afterCommitFailRb && afterCommitFailRb.ok === true && cCommitFail.released === 1 && cCommitFail.destroyed === 0 && aCommitFail._hasConn() === false);

  // PRE-COMMIT FAILURE: apply leaves a mismatch -> proof fails -> rollback+verify; backup path present.
  const breakAdapter = makeMockVrAdapter(authority, initialMysql, { breakScenes: true });
  const breakMsg = await catchMsg(() => vr.applyPlanWithAdapter(breakAdapter, approvedPlan, approvedAuthorityFp));
  check(S, 'pre-commit failure rolls back, verifies, and never commits', breakMsg != null && /rolled back and verified/i.test(breakMsg) && breakAdapter._committed() === false);
  check(S, 'a post-write failure message includes the backup path', breakMsg != null && /Backup: <probe-backup-path>/.test(breakMsg));

  // CORRUPTED ROLLBACK (scene): a rollback that leaves corrupted data cannot claim verified.
  const corruptSceneAdapter = makeMockVrAdapter(authority, initialMysql, { breakScenes: true, corruptRollbackScene: true });
  const corruptSceneMsg = await catchMsg(() => vr.applyPlanWithAdapter(corruptSceneAdapter, approvedPlan, approvedAuthorityFp));
  check(S, 'a corrupted-scene rollback cannot claim verified (ROLLBACK VERIFICATION FAILED)', corruptSceneMsg != null && /ROLLBACK VERIFICATION FAILED/.test(corruptSceneMsg));

  // CORRUPTED ROLLBACK (hotspot): same for a hotspot attribute.
  const corruptHotspotAdapter = makeMockVrAdapter(authority, initialMysql, { breakScenes: true, corruptRollbackHotspot: true });
  const corruptHotspotMsg = await catchMsg(() => vr.applyPlanWithAdapter(corruptHotspotAdapter, approvedPlan, approvedAuthorityFp));
  check(S, 'a corrupted-hotspot rollback cannot claim verified (ROLLBACK VERIFICATION FAILED)', corruptHotspotMsg != null && /ROLLBACK VERIFICATION FAILED/.test(corruptHotspotMsg));

  // ---- FINDING 4: post-commit failures carry the backup path once and never claim rollback ----

  // (a) an UNEXPECTED post-commit error (plain Error) is wrapped with the backup path.
  const pcUnexpectedAdapter = makeMockVrAdapter(authority, initialMysql, { throwPostCommitRead: true });
  const pcUnexpectedMsg = await catchMsg(() => vr.applyPlanWithAdapter(pcUnexpectedAdapter, approvedPlan, approvedAuthorityFp));
  check(S, 'post-commit unexpected error includes the backup path exactly once, never claims rollback',
    pcUnexpectedMsg != null && /Backup: <probe-backup-path>/.test(pcUnexpectedMsg) && backupCount(pcUnexpectedMsg) === 1 &&
    !/rolled back|ROLLBACK/i.test(pcUnexpectedMsg) && pcUnexpectedAdapter._committed() === true && pcUnexpectedAdapter._calls().rollback === 0);

  // (b) an existing SafeSyncError post-commit (parity mismatch) also carries the path once.
  const pcParityAdapter = makeMockVrAdapter(authority, initialMysql, { postCommitParityBreak: true });
  const pcParityMsg = await catchMsg(() => vr.applyPlanWithAdapter(pcParityAdapter, approvedPlan, approvedAuthorityFp));
  check(S, 'post-commit parity mismatch (SafeSyncError) includes the backup path exactly once, never claims rollback',
    pcParityMsg != null && /POST-COMMIT READBACK MISMATCH/.test(pcParityMsg) && /Backup: <probe-backup-path>/.test(pcParityMsg) &&
    backupCount(pcParityMsg) === 1 && !/rolled back/i.test(pcParityMsg) && pcParityAdapter._committed() === true && pcParityAdapter._calls().rollback === 0);
}

(async () => {
  console.log('=== CampuSphere BE.4 repair-safety pure probe ===');
  console.log('\n-- Route-graph repair --');
  await runRouteTests();
  console.log('\n-- Selected CAS VR parity --');
  runVrTests();
  console.log('\n-- VR transaction + backup/rollback verification --');
  await runVrTxTests();

  console.log('');
  if (failures.length === 0) {
    console.log('BE4-REPAIR-SAFETY-PROBE OK: all pure-logic checks passed.');
    process.exitCode = 0;
  } else {
    console.error(`BE4-REPAIR-SAFETY-PROBE FAILED: ${failures.length} check(s) did not pass:`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }
})().catch((e) => { console.error('BE4-REPAIR-SAFETY-PROBE crashed:', e && e.message); process.exitCode = 1; });
