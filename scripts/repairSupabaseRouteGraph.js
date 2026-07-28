'use strict';

/*
 * CampuSphere Supabase route-graph repair (BE.4 NO-GO repair, v2).
 *
 * Restores the Supabase route_edges set to the pinned MySQL baseline by ADDING
 * exactly the six missing directed edges and REMOVING exactly the two spurious
 * ones — nothing else. Dry-run is the default and the ONLY authorized mode in
 * this phase; apply is implemented but must be executed only under a separate
 * authorization.
 *
 * Two clearly separated concerns:
 *   - PREFLIGHT PLANNING (buildPlan): expects the known broken six-missing /
 *     two-extra drift and builds the exact insert/delete set;
 *   - FINAL-STATE VALIDATION (validateFinalGraph): order-independent, drift-
 *     agnostic proof that a graph IS the pinned baseline. buildPlan is never the
 *     sole post-repair validator.
 *
 * The expected final Supabase graph is simulated in memory (pre-write snapshot
 * with the six inserts and two deletes applied); projected counts and the
 * post-apply semantic comparison come from that simulation, never from the
 * PINNED constants.
 *
 * Identity: edges compared by from_node_key -> to_node_key (never numeric ids).
 * Numeric ids are backend-local and used only inside a same-backend restore.
 * Does NOT touch migration 0017 and does NOT create migration 0019.
 *
 * Usage:
 *   node scripts/repairSupabaseRouteGraph.js --dry-run
 *   node scripts/repairSupabaseRouteGraph.js --apply --confirm=RESTORE_PINNED_ROUTE_GRAPH
 */

process.env.DOTENV_CONFIG_QUIET = 'true';
require('dotenv').config({ quiet: true });

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('../config/db');
const { getSupabaseClient, hasSupabaseConfig } = require('../config/supabase');
const { findShortestPath } = require('../utils/pathfinding');
const {
  normalizeStoredPathGeometry,
  validatePathGeometry,
  reversePathGeometry
} = require('../utils/routeGeometry');

const APPLY_CONFIRMATION = 'RESTORE_PINNED_ROUTE_GRAPH';
const START_NODE_KEY = 'main-gate';
const EPS = 1e-6;

// Pinned baseline (RF.6 verified truth) — MySQL must match exactly, and the
// final Supabase graph must independently satisfy these counts.
const PINNED = Object.freeze({ nodes: 20, edges: 48, pairs: 24, geometries: 48, exactReverse: 24, routable: 13 });

// The EXACT authorized Supabase drift, expressed as natural-key directed edges.
const EXPECTED_MISSING = Object.freeze([
  'east-walk>cas', 'cas>east-walk',
  'east-walk>ccs', 'ccs>east-walk',
  'admin-building>registrar', 'registrar>admin-building'
]);
const EXPECTED_EXTRA = Object.freeze([
  'main-gate>cas', 'cas>main-gate'
]);

class SafeRepairError extends Error {}

function edgeKey(fromKey, toKey) { return `${fromKey}>${toKey}`; }
function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function normAccessible(v) { return v ? 1 : 0; }
function optStr(v) { return v == null ? null : String(v); }

/* =========================================================================
   PURE order-independent complete snapshot + fingerprint + metrics.
   These operate on plain { nodes, edges } data and never touch the network,
   so the be4RepairSafety probe can drive them with in-memory fixtures.
========================================================================= */

// Order-independent complete SAME-BACKEND snapshot. Nodes carry natural key +
// label/type + building linkage + coordinates; edges carry natural endpoints +
// scalar metadata + normalized geometry. Backend-local ids are deliberately
// excluded so the snapshot is a portable semantic fingerprint (a separate,
// private id map is kept only for same-backend restore).
function completeGraphSnapshot(nodes, edges) {
  const nodeById = new Map();
  for (const n of nodes || []) nodeById.set(toNum(n.id), n);

  const snapNodes = (nodes || []).map((n) => ({
    node_key: optStr(n.node_key),
    label: optStr(n.label),
    node_type: optStr(n.node_type),
    building_id: n.building_id == null ? null : toNum(n.building_id),
    lat: toNum(n.lat),
    lng: toNum(n.lng)
  })).sort((a, b) => (a.node_key < b.node_key ? -1 : a.node_key > b.node_key ? 1 : 0));

  const snapEdges = (edges || []).map((e) => {
    const from = nodeById.get(toNum(e.from_node_id));
    const to = nodeById.get(toNum(e.to_node_id));
    const norm = normalizeStoredPathGeometry(e.path_geometry);
    return {
      from_key: from ? optStr(from.node_key) : null,
      to_key: to ? optStr(to.node_key) : null,
      distance_meters: toNum(e.distance_meters),
      walk_time_seconds: toNum(e.walk_time_seconds),
      path_label: optStr(e.path_label),
      is_accessible: normAccessible(e.is_accessible),
      geometry: norm.state === 'present' && Array.isArray(norm.value)
        ? norm.value.map((p) => ({ lat: toNum(p.lat), lng: toNum(p.lng) }))
        : null
    };
  }).sort((a, b) => {
    const ka = `${a.from_key}>${a.to_key}`;
    const kb = `${b.from_key}>${b.to_key}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  return { nodes: snapNodes, edges: snapEdges };
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((o, k) => { o[k] = stableValue(value[k]); return o; }, {});
  }
  return value;
}
function snapshotFingerprint(snapshot) {
  return crypto.createHash('sha256').update(JSON.stringify(stableValue(snapshot))).digest('hex');
}

// Routable DISTINCT building destinations from main-gate, computed from a
// complete snapshot (two nodes can share one building_id — count distinct).
function countRoutableFromSnapshot(snapshot) {
  const graphNodes = snapshot.nodes.map((n) => ({ key: n.node_key, lat: n.lat || 0, lng: n.lng || 0 }));
  const graphEdges = snapshot.edges
    .filter((e) => e.from_key && e.to_key)
    .map((e) => ({
      from: e.from_key, to: e.to_key,
      distance_meters: e.distance_meters || 0,
      walk_time_seconds: e.walk_time_seconds || 0,
      is_accessible: Number(e.is_accessible)
    }));
  const reachable = new Set();
  for (const n of snapshot.nodes) {
    if (n.building_id == null) continue;
    const r = findShortestPath({ nodes: graphNodes, edges: graphEdges, startKey: START_NODE_KEY, endKey: n.node_key });
    if (r && r.success) reachable.add(String(n.building_id));
  }
  return reachable.size;
}

// Order-independent metrics + blockers derived purely from a complete snapshot.
function computeGraphMetrics(snapshot) {
  const blockers = [];
  const nodeByKey = new Map();
  for (const n of snapshot.nodes) {
    if (n.node_key == null) { blockers.push('node with null natural key.'); continue; }
    if (nodeByKey.has(n.node_key)) blockers.push(`duplicate node_key ${n.node_key}.`);
    else nodeByKey.set(n.node_key, n);
  }

  const edgeByKey = new Map();
  for (const e of snapshot.edges) {
    if (e.from_key == null || e.to_key == null) { blockers.push('edge endpoint does not resolve to a node.'); continue; }
    const k = edgeKey(e.from_key, e.to_key);
    if (edgeByKey.has(k)) blockers.push(`duplicate directed edge ${k}.`);
    else edgeByKey.set(k, e);
  }

  let validGeometries = 0;
  for (const [k, e] of edgeByKey) {
    const from = nodeByKey.get(e.from_key);
    const to = nodeByKey.get(e.to_key);
    if (!from || !to) { blockers.push(`edge ${k}: endpoint node missing.`); continue; }
    if (e.geometry == null) { blockers.push(`edge ${k}: missing geometry.`); continue; }
    const v = validatePathGeometry(e.geometry, { fromNode: from, toNode: to, allowNull: false, snapEndpoints: false });
    if (v.ok) validGeometries += 1;
    else blockers.push(`edge ${k}: invalid or discontinuous geometry.`);
  }

  let pairs = 0;
  let exactReverse = 0;
  const seen = new Set();
  for (const [k, e] of edgeByKey) {
    const revK = edgeKey(e.to_key, e.from_key);
    if (!edgeByKey.has(revK)) continue;
    const un = [k, revK].sort().join('|');
    if (seen.has(un)) continue;
    seen.add(un);
    pairs += 1;
    const rev = edgeByKey.get(revK);
    if (e.geometry && rev.geometry) {
      const r = reversePathGeometry(e.geometry);
      const same = r.length === rev.geometry.length &&
        r.every((p, i) => Math.abs(p.lat - rev.geometry[i].lat) <= EPS && Math.abs(p.lng - rev.geometry[i].lng) <= EPS);
      if (same) exactReverse += 1;
    }
  }

  return {
    nodes: nodeByKey.size,
    edges: edgeByKey.size,
    pairs,
    validGeometries,
    exactReverse,
    routable: countRoutableFromSnapshot(snapshot),
    edgeKeys: new Set(edgeByKey.keys()),
    blockers
  };
}

// Simulate the expected final Supabase graph by applying the planned inserts +
// deletes to the pre-write snapshot (natural-key edge set).
function simulateFinalGraph(preSnapshot, plan) {
  const edgeByKey = new Map(preSnapshot.edges.map((e) => [edgeKey(e.from_key, e.to_key), e]));
  for (const del of plan.deletes) edgeByKey.delete(del.natural);
  for (const ins of plan.inserts) {
    const [from_key, to_key] = ins.natural.split('>');
    edgeByKey.set(ins.natural, {
      from_key, to_key,
      distance_meters: toNum(ins.distance_meters),
      walk_time_seconds: toNum(ins.walk_time_seconds),
      path_label: optStr(ins.path_label),
      is_accessible: normAccessible(ins.is_accessible),
      geometry: (ins.path_geometry || []).map((p) => ({ lat: toNum(p.lat), lng: toNum(p.lng) }))
    });
  }
  const edges = [...edgeByKey.values()].sort((a, b) => {
    const ka = `${a.from_key}>${a.to_key}`;
    const kb = `${b.from_key}>${b.to_key}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  return { nodes: preSnapshot.nodes, edges };
}

// Drift-agnostic proof that `finalSnapshot` IS the pinned baseline and matches
// the MySQL natural edge set. Returns { ok, blockers, metrics }.
function validateFinalGraph(mysqlSnapshot, finalSnapshot) {
  const blockers = [];
  const metrics = computeGraphMetrics(finalSnapshot);
  for (const b of metrics.blockers) blockers.push(b);

  if (metrics.nodes !== PINNED.nodes) blockers.push(`final nodes ${metrics.nodes} != ${PINNED.nodes}.`);
  if (metrics.edges !== PINNED.edges) blockers.push(`final edges ${metrics.edges} != ${PINNED.edges}.`);
  if (metrics.pairs !== PINNED.pairs) blockers.push(`final reverse pairs ${metrics.pairs} != ${PINNED.pairs}.`);
  if (metrics.validGeometries !== PINNED.geometries) blockers.push(`final valid geometries ${metrics.validGeometries} != ${PINNED.geometries}.`);
  if (metrics.exactReverse !== PINNED.exactReverse) blockers.push(`final exact reversals ${metrics.exactReverse} != ${PINNED.exactReverse}.`);
  if (metrics.routable !== PINNED.routable) blockers.push(`final routable ${metrics.routable} != ${PINNED.routable}.`);

  const mysqlMetrics = computeGraphMetrics(mysqlSnapshot);
  const mysqlKeys = [...mysqlMetrics.edgeKeys].sort();
  const finalKeys = [...metrics.edgeKeys].sort();
  const sameSet = mysqlKeys.length === finalKeys.length && mysqlKeys.every((k, i) => k === finalKeys[i]);
  if (!sameSet) blockers.push('final natural edge set does not match the MySQL baseline.');

  for (const shortcut of EXPECTED_EXTRA) {
    if (metrics.edgeKeys.has(shortcut)) blockers.push(`shortcut edge ${shortcut} is still present.`);
  }
  for (const required of EXPECTED_MISSING) {
    if (!metrics.edgeKeys.has(required)) blockers.push(`required repair edge ${required} is absent.`);
  }

  return { ok: blockers.length === 0, blockers: [...new Set(blockers)], metrics };
}

/* =========================================================================
   Reads
========================================================================= */

async function readMysqlGraph() {
  try {
    const [nodes] = await db.query(
      'SELECT id, node_key, label, node_type, building_id, lat, lng FROM route_nodes ORDER BY id ASC'
    );
    const [edges] = await db.query(
      'SELECT id, from_node_id, to_node_id, distance_meters, walk_time_seconds, ' +
      'path_label, is_accessible, path_geometry FROM route_edges ORDER BY id ASC'
    );
    return { nodes, edges };
  } catch (_) {
    throw new SafeRepairError('Unable to read the MySQL route graph.');
  }
}

async function readSupabaseGraph(client) {
  if (!hasSupabaseConfig()) throw new SafeRepairError('Supabase server credentials are not configured.');
  const sb = client || getSupabaseClient();
  async function sel(table, columns) {
    const { data, error } = await sb.from(table).select(columns).order('id', { ascending: true });
    if (error) throw new SafeRepairError(`Unable to read Supabase ${table}.`);
    return data || [];
  }
  const nodes = await sel('route_nodes', 'id,node_key,label,node_type,building_id,lat,lng');
  const edges = await sel('route_edges',
    'id,from_node_id,to_node_id,distance_meters,walk_time_seconds,path_label,is_accessible,path_geometry');
  return { nodes, edges };
}

/* =========================================================================
   Preflight planning (expects the KNOWN broken drift).
========================================================================= */

function indexNodes(nodes, backendLabel, blockers) {
  const byId = new Map();
  const byKey = new Map();
  const dup = new Set();
  for (const n of nodes) {
    const id = toNum(n.id);
    const key = optStr(n.node_key);
    if (id === null || key === null) { blockers.push(`${backendLabel} route node: invalid id or node_key.`); continue; }
    byId.set(id, n);
    if (byKey.has(key)) dup.add(key);
    else byKey.set(key, n);
  }
  for (const key of dup) blockers.push(`${backendLabel} route node: duplicate node_key ${key}.`);
  return { byId, byKey };
}

function indexEdges(edges, nodeIndex, backendLabel, blockers) {
  const byNatural = new Map();
  for (const e of edges) {
    const fromNode = nodeIndex.byId.get(toNum(e.from_node_id));
    const toNode = nodeIndex.byId.get(toNum(e.to_node_id));
    if (!fromNode || !toNode) { blockers.push(`${backendLabel} route edge: endpoint id does not resolve to a node.`); continue; }
    const key = edgeKey(String(fromNode.node_key), String(toNode.node_key));
    if (byNatural.has(key)) { blockers.push(`${backendLabel} route edge: duplicate directed edge ${key}.`); continue; }
    byNatural.set(key, { row: e, fromNode, toNode });
  }
  return byNatural;
}

function buildPlan(mysql, supabase) {
  const blockers = [];
  const mNodes = indexNodes(mysql.nodes, 'MySQL', blockers);
  const sNodes = indexNodes(supabase.nodes, 'Supabase', blockers);
  const mEdges = indexEdges(mysql.edges, mNodes, 'MySQL', blockers);
  const sEdges = indexEdges(supabase.edges, sNodes, 'Supabase', blockers);

  // MySQL baseline proven from its own complete snapshot metrics.
  const mysqlSnapshot = completeGraphSnapshot(mysql.nodes, mysql.edges);
  const mMetrics = computeGraphMetrics(mysqlSnapshot);
  for (const b of mMetrics.blockers) blockers.push(`MySQL: ${b}`);
  if (mMetrics.nodes !== PINNED.nodes) blockers.push(`MySQL nodes ${mMetrics.nodes} != pinned ${PINNED.nodes}.`);
  if (mMetrics.edges !== PINNED.edges) blockers.push(`MySQL edges ${mMetrics.edges} != pinned ${PINNED.edges}.`);
  if (mMetrics.pairs !== PINNED.pairs) blockers.push(`MySQL pairs ${mMetrics.pairs} != pinned ${PINNED.pairs}.`);
  if (mMetrics.exactReverse !== PINNED.exactReverse) blockers.push(`MySQL exact reversals ${mMetrics.exactReverse} != pinned ${PINNED.exactReverse}.`);
  if (mMetrics.validGeometries !== PINNED.geometries) blockers.push(`MySQL valid geometries ${mMetrics.validGeometries} != pinned ${PINNED.geometries}.`);
  if (mMetrics.routable !== PINNED.routable) blockers.push(`MySQL routable ${mMetrics.routable} != pinned ${PINNED.routable}.`);

  const supabaseSnapshot = completeGraphSnapshot(supabase.nodes, supabase.edges);
  const sMetrics = computeGraphMetrics(supabaseSnapshot);

  // Drift by natural key must be EXACTLY the authorized six missing + two extra.
  const mKeys = new Set(mEdges.keys());
  const sKeys = new Set(sEdges.keys());
  const missing = [...mKeys].filter((k) => !sKeys.has(k)).sort();
  const extra = [...sKeys].filter((k) => !mKeys.has(k)).sort();
  const expMissing = [...EXPECTED_MISSING].sort();
  const expExtra = [...EXPECTED_EXTRA].sort();
  if (!(missing.length === expMissing.length && missing.every((k, i) => k === expMissing[i]))) {
    blockers.push('Supabase missing-edge drift does not match the authorized six-edge set.');
  }
  if (!(extra.length === expExtra.length && extra.every((k, i) => k === expExtra[i]))) {
    blockers.push('Supabase extra-edge drift does not match the authorized two-edge set.');
  }

  // Build the six inserts: MySQL road shape + Supabase endpoint coordinates.
  const inserts = [];
  const notes = [];
  for (const key of expMissing) {
    const src = mEdges.get(key);
    if (!src) { blockers.push(`Missing edge ${key} absent from MySQL; cannot rebuild.`); continue; }
    const [fromKey, toKey] = key.split('>');
    const sFrom = sNodes.byKey.get(fromKey);
    const sTo = sNodes.byKey.get(toKey);
    if (!sFrom || !sTo) { blockers.push(`Supabase node_key translation failed for ${key}.`); continue; }
    const norm = normalizeStoredPathGeometry(src.row.path_geometry);
    if (norm.state !== 'present' || !Array.isArray(norm.value) || norm.value.length < 2) {
      blockers.push(`MySQL edge ${key} has no reusable geometry.`); continue;
    }
    const sFromPt = { lat: toNum(sFrom.lat), lng: toNum(sFrom.lng) };
    const sToPt = { lat: toNum(sTo.lat), lng: toNum(sTo.lng) };
    if (sFromPt.lat === null || sFromPt.lng === null || sToPt.lat === null || sToPt.lng === null) {
      blockers.push(`Supabase endpoint coordinates for ${key} are unavailable.`); continue;
    }
    const first = norm.value[0] || {};
    const last = norm.value[norm.value.length - 1] || {};
    const dFrom = Math.max(Math.abs(toNum(first.lat) - sFromPt.lat), Math.abs(toNum(first.lng) - sFromPt.lng));
    const dTo = Math.max(Math.abs(toNum(last.lat) - sToPt.lat), Math.abs(toNum(last.lng) - sToPt.lng));
    if (Number.isFinite(dFrom) && dFrom > EPS) notes.push(`${key}: from-endpoint adjusted to the Supabase '${fromKey}' node (delta ${dFrom.toExponential(2)}).`);
    if (Number.isFinite(dTo) && dTo > EPS) notes.push(`${key}: to-endpoint adjusted to the Supabase '${toKey}' node (delta ${dTo.toExponential(2)}).`);
    const rebuilt = norm.value.map((p) => ({ lat: toNum(p.lat), lng: toNum(p.lng) }));
    rebuilt[0] = { lat: sFromPt.lat, lng: sFromPt.lng };
    rebuilt[rebuilt.length - 1] = { lat: sToPt.lat, lng: sToPt.lng };
    const v = validatePathGeometry(rebuilt, { fromNode: sFromPt, toNode: sToPt, allowNull: false, snapEndpoints: true });
    if (!v.ok) { blockers.push(`Rebuilt geometry for ${key} failed validation against the Supabase endpoints.`); continue; }
    inserts.push({
      natural: key,
      from_node_id: toNum(sFrom.id),
      to_node_id: toNum(sTo.id),
      distance_meters: toNum(src.row.distance_meters) || 0,
      walk_time_seconds: toNum(src.row.walk_time_seconds) || 0,
      path_label: src.row.path_label != null ? String(src.row.path_label) : null,
      is_accessible: src.row.is_accessible ? 1 : 0,
      path_geometry: v.value
    });
  }

  // Build the two deletes (exact Supabase directed rows, by id + endpoints).
  const deletes = [];
  for (const key of expExtra) {
    const entry = sEdges.get(key);
    if (!entry) { blockers.push(`Expected extra edge ${key} is not present in Supabase.`); continue; }
    deletes.push({
      natural: key,
      id: toNum(entry.row.id),
      from_node_id: toNum(entry.row.from_node_id),
      to_node_id: toNum(entry.row.to_node_id)
    });
  }

  // Simulate the expected final graph and derive PROJECTED counts from it.
  const plan = { inserts, deletes };
  const simulated = simulateFinalGraph(supabaseSnapshot, plan);
  const projectedMetrics = computeGraphMetrics(simulated);

  return {
    blockers: [...new Set(blockers)],
    mysql: {
      nodes: mMetrics.nodes, edges: mMetrics.edges, pairs: mMetrics.pairs,
      geometries: mMetrics.validGeometries, exactReverse: mMetrics.exactReverse, routable: mMetrics.routable
    },
    supabase: {
      nodes: sMetrics.nodes, edges: sMetrics.edges, pairs: sMetrics.pairs,
      geometries: sMetrics.validGeometries, exactReverse: sMetrics.exactReverse, routable: sMetrics.routable
    },
    drift: { missing, extra },
    inserts,
    deletes,
    notes,
    preSnapshot: supabaseSnapshot,
    mysqlSnapshot,
    simulated,
    simulatedFingerprint: snapshotFingerprint(simulated),
    projected: {
      nodes: projectedMetrics.nodes,
      edges: projectedMetrics.edges,
      pairs: projectedMetrics.pairs,
      geometries: projectedMetrics.validGeometries,
      exactReverse: projectedMetrics.exactReverse,
      routable: projectedMetrics.routable
    }
  };
}

/* =========================================================================
   Backup
========================================================================= */

async function writeBackup(supabaseGraph, preFingerprint) {
  const dir = path.join(os.tmpdir(), 'campusphere-route-repair');
  const file = path.join(dir,
    `supabase-route-graph-before-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID()}.json`);
  const backup = {
    schema_version: 2,
    created_at: new Date().toISOString(),
    pre_fingerprint: preFingerprint,
    edges: supabaseGraph.edges
  };
  try {
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(file, `${JSON.stringify(backup, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  } catch (_) {
    throw new SafeRepairError('Unable to create the pre-write route-graph backup.');
  }
  return { backupPath: file };
}

/* =========================================================================
   Adapter-driven apply + verified rollback.
   The adapter isolates the four mutation/read primitives so the pure safety
   probe can exercise apply, post-state proof, and rollback with a mocked graph
   — no live database. Every response is inspected; nothing is swallowed.
========================================================================= */

function makeSupabaseAdapter(sb) {
  return {
    async readGraph() { return readSupabaseGraph(sb); },
    async insertEdges(rows) {
      const res = await sb.from('route_edges').insert(rows).select('id,from_node_id,to_node_id');
      if (res.error || !Array.isArray(res.data)) return { ok: false, ids: [] };
      return { ok: true, ids: res.data.map((r) => toNum(r.id)), count: res.data.length };
    },
    async deleteEdge(id, fromId, toId) {
      const res = await sb.from('route_edges').delete().eq('id', id).eq('from_node_id', fromId).eq('to_node_id', toId).select('id');
      if (res.error || !Array.isArray(res.data)) return { ok: false, count: 0 };
      return { ok: true, count: res.data.length };
    },
    async insertOriginal(row) {
      const res = await sb.from('route_edges').insert(row).select('id');
      if (res.error || !Array.isArray(res.data)) return { ok: false, count: 0 };
      return { ok: true, count: res.data.length };
    },
    async deleteById(id) {
      const res = await sb.from('route_edges').delete().eq('id', id).select('id');
      if (res.error || !Array.isArray(res.data)) return { ok: false, count: 0 };
      return { ok: true, count: res.data.length };
    }
  };
}

// Natural-key -> raw edge row (WITH id + metadata) for one backend graph.
function rawEdgesByNaturalKey(nodes, edges) {
  const idToKey = new Map((nodes || []).map((n) => [toNum(n.id), n.node_key == null ? null : String(n.node_key)]));
  const out = new Map();
  for (const e of edges || []) {
    const fk = idToKey.get(toNum(e.from_node_id));
    const tk = idToKey.get(toNum(e.to_node_id));
    if (fk == null || tk == null) continue;
    out.set(edgeKey(fk, tk), e);
  }
  return out;
}

// FINDING 2: reconcile the ACTUAL post-failure graph against the plan and undo
// only mutations that truly landed. A re-read is the source of truth, so a row
// inserted despite an incomplete response is still removed, and a delete that
// did NOT actually happen is never "restored" (which the real UNIQUE(from,to)
// constraint would reject anyway). Undoes in reverse operation order (restore
// landed deletes, then remove landed inserts), inspects every response, then
// re-reads and requires the complete fingerprint to equal the pre-write one.
// Returns { ok, reason } — never throws, never prints raw responses.
async function reconcileAndRollback(adapter, preFingerprint, plan, initialByKey, backupPath) {
  let current;
  try { current = await adapter.readGraph(); } catch (_) { return { ok: false, reason: 're-read failed' }; }
  const currentByKey = rawEdgesByNaturalKey(current.nodes, current.edges);
  const insertKeys = plan.inserts.map((i) => i.natural);
  const deleteKeys = plan.deletes.map((d) => d.natural);

  // Reverse operation order: restore landed deletes first, then remove landed inserts.
  const toRestore = [];
  for (const key of deleteKeys) {
    if (!currentByKey.has(key)) {
      const orig = initialByKey.get(key);
      if (!orig) return { ok: false, reason: 'original removed-row metadata unavailable' };
      toRestore.push(orig);
    }
  }
  const toRemove = [];
  for (const key of insertKeys) {
    if (currentByKey.has(key)) toRemove.push(currentByKey.get(key));
  }

  for (const orig of toRestore) {
    let res;
    try {
      res = await adapter.insertOriginal({
        from_node_id: orig.from_node_id, to_node_id: orig.to_node_id,
        distance_meters: orig.distance_meters, walk_time_seconds: orig.walk_time_seconds,
        path_label: orig.path_label, is_accessible: orig.is_accessible, path_geometry: orig.path_geometry
      });
    } catch (_) { return { ok: false, reason: 'removed-row restore failed' }; }
    if (!res || !res.ok || res.count !== 1) return { ok: false, reason: 'removed-row restore failed' };
  }
  for (const row of toRemove) {
    let res;
    try {
      res = await adapter.deleteById(toNum(row.id));
    } catch (_) { return { ok: false, reason: 'inserted-row cleanup failed' }; }
    if (!res || !res.ok || res.count !== 1) return { ok: false, reason: 'inserted-row cleanup failed' };
  }

  let after;
  try { after = await adapter.readGraph(); } catch (_) { return { ok: false, reason: 're-read failed' }; }
  const fp = snapshotFingerprint(completeGraphSnapshot(after.nodes, after.edges));
  if (fp !== preFingerprint) return { ok: false, reason: 'restored fingerprint mismatch' };
  return { ok: true, restored: toRestore.length, removed: toRemove.length };
}

// Apply the plan through the adapter, prove the post-state, and roll back on any
// mismatch. Returns a success object or throws a distinct sanitized
// SafeRepairError (restored vs ROLLBACK VERIFICATION FAILED). `backupPath` is
// included in every failure message once a backup exists.
async function applyPlanWithAdapter(adapter, mysqlSnapshot, plan, backupPath) {
  // PRE-MUTATION phase: fresh read + drift guard. A throw here means NOTHING was
  // mutated, so we fail cleanly with NO compensation (there is nothing to undo).
  let initialGraph;
  let preFingerprint;
  let initialByKey;
  try {
    initialGraph = await adapter.readGraph();
    const initialSnapshot = completeGraphSnapshot(initialGraph.nodes, initialGraph.edges);
    preFingerprint = snapshotFingerprint(initialSnapshot);
    // FINDING 3: compare the adapter-level fresh graph with the approved preflight
    // snapshot BEFORE the first mutation. A mismatch aborts with no data written
    // and NO compensating rollback (nothing was mutated).
    if (preFingerprint !== snapshotFingerprint(plan.preSnapshot)) {
      throw new SafeRepairError('Route-graph state changed after preflight; no data was written.');
    }
    initialByKey = rawEdgesByNaturalKey(initialGraph.nodes, initialGraph.edges);
  } catch (err) {
    if (err instanceof SafeRepairError) throw err;
    // Sanitized: never surface raw DB errors, hosts, or payloads.
    throw new SafeRepairError('Unable to read the route graph before applying; no data was written.');
  }

  // Journal of ACTUAL successful mutations (reference only; the authoritative
  // compensation is the re-read reconciliation below).
  const journal = { insertedIds: [], deletedOriginals: [] };
  let failure = null;

  // FINDING 1: the ENTIRE mutation + post-write proof phase is guarded. ANY
  // failure — an explicit { ok:false } response OR a thrown/ambiguous error from
  // insertEdges, deleteEdge, the post-write readGraph, or the validation /
  // fingerprint comparison — is treated as possibly-landed and routed through the
  // SAME fresh-read reconciliation compensation below.
  try {
    // Insert the six repair rows (single bounded bulk op).
    const insertRows = plan.inserts.map((e) => ({
      from_node_id: e.from_node_id, to_node_id: e.to_node_id,
      distance_meters: e.distance_meters, walk_time_seconds: e.walk_time_seconds,
      path_label: e.path_label, is_accessible: e.is_accessible, path_geometry: e.path_geometry
    }));
    const ins = await adapter.insertEdges(insertRows);
    if (!ins || !ins.ok || ins.count !== plan.inserts.length) failure = 'route-edge insert affected an unexpected number of rows';
    else journal.insertedIds = (ins.ids || []).slice();

    // Delete the two spurious rows (bounded, exact).
    if (!failure) {
      for (const del of plan.deletes) {
        const res = await adapter.deleteEdge(del.id, del.from_node_id, del.to_node_id);
        if (!res || !res.ok || res.count !== 1) { failure = 'route-edge delete affected an unexpected number of rows'; break; }
        journal.deletedOriginals.push(initialByKey.get(del.natural));
      }
    }

    // Fresh-read post-state proof: pinned baseline + simulated-final semantic match.
    if (!failure) {
      const finalGraph = await adapter.readGraph();
      const finalSnapshot = completeGraphSnapshot(finalGraph.nodes, finalGraph.edges);
      const validation = validateFinalGraph(mysqlSnapshot, finalSnapshot);
      if (!validation.ok) failure = 'post-apply final-state validation found blockers';
      else if (snapshotFingerprint(finalSnapshot) !== plan.simulatedFingerprint) failure = 'post-apply graph does not match the simulated expected final graph';
    }
  } catch (_) {
    // A thrown/ambiguous mutation or post-write read: assume it may have LANDED
    // and reconcile against a fresh graph read (never trust the journal here).
    failure = 'route-edge mutation or post-write read raised an ambiguous error';
  }

  if (!failure) {
    return { backupPath, inserted: plan.inserts.length, deleted: plan.deletes.length, journal };
  }

  // Any failure (returned OR thrown) -> reconcile the ACTUAL landed mutations via a
  // fresh read and undo only those. reconcileAndRollback never throws (its own
  // read/restore/removal/verify failures return { ok:false }).
  const rb = await reconcileAndRollback(adapter, preFingerprint, plan, initialByKey, backupPath);
  if (rb.ok) {
    throw new SafeRepairError(`Apply failed (${failure}); the original Supabase route graph was restored and verified. Backup: ${backupPath}`);
  }
  throw new SafeRepairError(`ROLLBACK VERIFICATION FAILED after a failed apply (${failure}); manual restore required from the backup. Backup: ${backupPath}`);
}

/* =========================================================================
   Reporting + CLI
========================================================================= */

function printPlan(plan, mode) {
  const dryRun = mode === 'dry-run';
  console.log(`=== CampuSphere Supabase route-graph repair: ${dryRun ? 'DRY RUN' : 'CONFIRMED APPLY PREFLIGHT'} ===`);
  console.log(dryRun
    ? 'READ ONLY: this invocation cannot issue any MySQL or Supabase mutation.'
    : 'WRITE MODE: the exact apply confirmation token was accepted.');
  console.log('');
  console.log(`MySQL baseline:   ${plan.mysql.nodes} nodes, ${plan.mysql.edges} edges, ${plan.mysql.pairs} pairs, ` +
    `${plan.mysql.geometries} geometries (${plan.mysql.exactReverse} exact-reverse), ${plan.mysql.routable} routable`);
  console.log(`Supabase current: ${plan.supabase.nodes} nodes, ${plan.supabase.edges} edges, ${plan.supabase.pairs} pairs, ` +
    `${plan.supabase.geometries} geometries (${plan.supabase.exactReverse} exact-reverse), ${plan.supabase.routable} routable`);
  console.log('');
  console.log(`Missing edges (planned INSERT ${plan.inserts.length}): ${JSON.stringify(plan.drift.missing)}`);
  console.log(`Extra edges (planned DELETE ${plan.deletes.length}):   ${JSON.stringify(plan.drift.extra)}`);
  console.log(`Projected (simulated) after repair: ${plan.projected.nodes} nodes, ${plan.projected.edges} edges, ` +
    `${plan.projected.pairs} pairs, ${plan.projected.geometries} geometries, ${plan.projected.exactReverse} exact-reverse, ${plan.projected.routable} routable`);
  console.log('');
  if (plan.notes && plan.notes.length) {
    console.log(`Endpoint-adjustment notes (${plan.notes.length}):`);
    for (const n of plan.notes) console.log(`  - ${n}`);
    console.log('');
  }
  if (plan.blockers.length) {
    console.log(`BLOCKERS (${plan.blockers.length}):`);
    for (const b of plan.blockers.slice(0, 50)) console.log(`  - ${b}`);
    console.log('');
    console.log('REPAIR BLOCKED: fail-closed checks must pass before any apply.');
  } else {
    console.log(`${dryRun ? 'DRY RUN' : 'PREFLIGHT'} OK: ${plan.inserts.length} inserts + ${plan.deletes.length} deletes; simulated final graph satisfies the pinned baseline.`);
    if (dryRun) {
      console.log('No data was written. Apply is available only with:');
      console.log(`  node scripts/repairSupabaseRouteGraph.js --apply --confirm=${APPLY_CONFIRMATION}`);
    }
  }
}

function parseArgs(argv) {
  const raw = argv.slice(2);
  const flags = new Set(raw.filter((a) => !a.startsWith('--confirm=')));
  const confirmations = raw.filter((a) => a.startsWith('--confirm=')).map((a) => a.slice('--confirm='.length));
  const allowed = new Set(['--dry-run', '--apply', '--help']);
  for (const f of flags) {
    if (!allowed.has(f)) throw new SafeRepairError('Unknown argument. Use --dry-run, --apply, or --help.');
  }
  if (confirmations.length > 1) throw new SafeRepairError('Apply confirmation must be provided exactly once.');
  if (flags.has('--help')) return { help: true, mode: 'dry-run' };
  if (flags.has('--apply')) {
    if (flags.has('--dry-run')) throw new SafeRepairError('--apply cannot be combined with --dry-run.');
    if (confirmations[0] !== APPLY_CONFIRMATION) throw new SafeRepairError('Apply requires the exact confirmation token; no data was written.');
    return { help: false, mode: 'apply' };
  }
  if (confirmations.length) throw new SafeRepairError('--confirm is valid only with --apply.');
  return { help: false, mode: 'dry-run' };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log('Usage: node scripts/repairSupabaseRouteGraph.js --dry-run');
    console.log(`Apply: node scripts/repairSupabaseRouteGraph.js --apply --confirm=${APPLY_CONFIRMATION}`);
    console.log('Dry-run is the default. Apply writes only after its exact confirmation token.');
    return;
  }
  if (!hasSupabaseConfig()) throw new SafeRepairError('Supabase server credentials are not configured.');

  const sb = getSupabaseClient();
  const [mysql, supabase] = await Promise.all([readMysqlGraph(), readSupabaseGraph(sb)]);
  const plan = buildPlan(mysql, supabase);
  printPlan(plan, args.mode);
  if (plan.blockers.length) { process.exitCode = 2; return; }
  if (args.mode === 'dry-run') return;

  // Apply path (never reached in this authorization phase). Re-read + re-verify
  // immediately before the first write, back up the locked pre-write snapshot,
  // then apply through the adapter with the post-state proof + verified rollback.
  const fresh = await Promise.all([readMysqlGraph(), readSupabaseGraph(sb)]);
  const freshPlan = buildPlan(fresh[0], fresh[1]);
  if (freshPlan.blockers.length || freshPlan.simulatedFingerprint !== plan.simulatedFingerprint) {
    throw new SafeRepairError('Route-graph state changed after preflight; no data was written.');
  }
  const { backupPath } = await writeBackup(fresh[1], snapshotFingerprint(freshPlan.preSnapshot));
  const result = await applyPlanWithAdapter(makeSupabaseAdapter(sb), freshPlan.mysqlSnapshot, freshPlan, backupPath);
  console.log('');
  console.log('APPLY OK: Supabase route graph restored to the pinned baseline (post-state proven).');
  console.log(`Inserted ${result.inserted}, deleted ${result.deleted}.`);
  console.log(`Pre-write backup: ${result.backupPath}`);
}

if (require.main === module) {
  main()
    .catch((error) => {
      const message = error instanceof SafeRepairError ? error.message : 'Unexpected route-graph repair failure.';
      console.error(`Route-graph repair failed: ${message}`);
      process.exitCode = 1;
    })
    .finally(async () => { try { await db.end(); } catch (_) { /* no-op */ } });
}

module.exports = {
  APPLY_CONFIRMATION,
  EXPECTED_MISSING,
  EXPECTED_EXTRA,
  PINNED,
  buildPlan,
  parseArgs,
  completeGraphSnapshot,
  snapshotFingerprint,
  computeGraphMetrics,
  simulateFinalGraph,
  validateFinalGraph,
  applyPlanWithAdapter,
  reconcileAndRollback,
  rawEdgesByNaturalKey
};
