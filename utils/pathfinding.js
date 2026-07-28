/* ========================================
   CampuSphere - Campus Pathfinding (Milestone 5)
   Pure Dijkstra shortest-path over the route
   graph (route_nodes / route_edges).

   This module does NO database access. The caller
   fetches rows and passes plain arrays in, which
   keeps the algorithm pure and unit-testable.

   Edge model: route_edges rows are DIRECTED. The
   seed inserts BOTH directions (A->B and B->A) for
   every walkable connection, so this module treats
   the edge list as a plain directed graph and does
   not auto-reverse anything.
   ======================================== */

'use strict';

/**
 * Weight used for shortest-path comparison.
 * Prefer walk_time_seconds (route duration is the
 * user-facing goal); fall back to distance_meters
 * when walk time is missing or non-positive.
 */
function edgeWeight(edge) {
  const walk = Number(edge.walk_time_seconds);
  if (Number.isFinite(walk) && walk > 0) return walk;
  const dist = Number(edge.distance_meters);
  if (Number.isFinite(dist) && dist > 0) return dist;
  return 0;
}

/**
 * Compute the shortest path between two node keys.
 *
 * @param {Object}   input
 * @param {Array}    input.nodes  - [{ key, label, lat, lng, ... }]
 * @param {Array}    input.edges  - [{ from, to, distance_meters,
 *                                     walk_time_seconds, path_label,
 *                                     is_accessible }]
 * @param {string}   input.startKey
 * @param {string}   input.endKey
 *
 * @returns On failure: { success:false, reason:
 *            'start_not_found' | 'destination_not_found' | 'no_route' }
 *          On success:  { success:true, nodes:[...node objects in order],
 *            segments:[{ from, to, distance_meters, walk_time_seconds,
 *            path_label }], distance_meters, walk_time_seconds }
 */
function findShortestPath(input) {
  const nodes = Array.isArray(input && input.nodes) ? input.nodes : [];
  const edges = Array.isArray(input && input.edges) ? input.edges : [];
  const startKey = input && input.startKey;
  const endKey = input && input.endKey;

  const nodeByKey = new Map();
  for (const n of nodes) {
    if (n && n.key != null) nodeByKey.set(String(n.key), n);
  }

  if (!nodeByKey.has(String(startKey))) {
    return { success: false, reason: 'start_not_found' };
  }
  if (!nodeByKey.has(String(endKey))) {
    return { success: false, reason: 'destination_not_found' };
  }

  const start = String(startKey);
  const end = String(endKey);

  // Trivial case: start equals destination.
  if (start === end) {
    return {
      success: true,
      nodes: [nodeByKey.get(start)],
      segments: [],
      distance_meters: 0,
      walk_time_seconds: 0
    };
  }

  // Build directed adjacency list. Inaccessible edges
  // (is_accessible === 0) and edges whose endpoints are
  // not known nodes are skipped.
  const adjacency = new Map();
  for (const e of edges) {
    if (Number(e.is_accessible) === 0) continue;
    const from = String(e.from);
    const to = String(e.to);
    if (!nodeByKey.has(from) || !nodeByKey.has(to)) continue;
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from).push({ to, edge: e });
  }

  // Dijkstra (O(V^2) selection - the campus graph is tiny).
  const dist = new Map();
  const prev = new Map(); // key -> { fromKey, edge }
  const visited = new Set();
  for (const key of nodeByKey.keys()) dist.set(key, Infinity);
  dist.set(start, 0);

  while (true) {
    let current = null;
    let best = Infinity;
    for (const [key, d] of dist) {
      if (!visited.has(key) && d < best) {
        best = d;
        current = key;
      }
    }
    if (current === null) break;       // remaining nodes unreachable
    if (current === end) break;        // shortest path to end finalized
    visited.add(current);

    const neighbors = adjacency.get(current) || [];
    for (const { to, edge } of neighbors) {
      if (visited.has(to)) continue;
      const candidate = dist.get(current) + edgeWeight(edge);
      if (candidate < dist.get(to)) {
        dist.set(to, candidate);
        prev.set(to, { fromKey: current, edge });
      }
    }
  }

  if (!Number.isFinite(dist.get(end))) {
    return { success: false, reason: 'no_route' };
  }

  // Reconstruct path end -> start, then reverse.
  const orderedKeys = [];
  const segmentsReversed = [];
  let cursor = end;
  while (cursor !== start) {
    orderedKeys.push(cursor);
    const step = prev.get(cursor);
    if (!step) {
      // Defensive: broken predecessor chain.
      return { success: false, reason: 'no_route' };
    }
    segmentsReversed.push({
      from: step.fromKey,
      to: cursor,
      distance_meters: Number(step.edge.distance_meters) || 0,
      walk_time_seconds: Number(step.edge.walk_time_seconds) || 0,
      path_label: step.edge.path_label != null ? step.edge.path_label : null
    });
    cursor = step.fromKey;
  }
  orderedKeys.push(start);
  orderedKeys.reverse();
  const segments = segmentsReversed.reverse();

  let totalDistance = 0;
  let totalWalk = 0;
  for (const s of segments) {
    totalDistance += s.distance_meters;
    totalWalk += s.walk_time_seconds;
  }

  return {
    success: true,
    nodes: orderedKeys.map((k) => nodeByKey.get(k)),
    segments,
    distance_meters: totalDistance,
    walk_time_seconds: totalWalk
  };
}

module.exports = { findShortestPath, edgeWeight };
