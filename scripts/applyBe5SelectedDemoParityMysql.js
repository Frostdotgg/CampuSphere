'use strict';

/*
 * CampuSphere BE.5 selected-demo parity correction (MySQL).
 *
 * Dry-run is the default. Apply requires the exact confirmation token and is
 * reserved for a separate Codex-controlled rollout after migration 0019 has
 * been owner-applied and independently verified.
 *
 * Scope is intentionally narrow:
 *   - canonical CAS category/description/coordinate;
 *   - main-gate public label;
 *   - CAS route-node label/link/coordinate;
 *   - east-walk <-> cas drawing geometry.
 *
 * No schedule, VR, media, authentication, session, authorization, or schema row
 * is queried for mutation. Numeric ids remain backend-local and are used only
 * after same-backend natural identities have resolved uniquely.
 *
 * Usage:
 *   node scripts/applyBe5SelectedDemoParityMysql.js --dry-run
 *   node scripts/applyBe5SelectedDemoParityMysql.js --apply \
 *     --confirm=APPLY_BE5_SELECTED_DEMO_PARITY_TO_MYSQL
 */

process.env.DOTENV_CONFIG_QUIET = 'true';
require('dotenv').config({ quiet: true });

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('../config/db');
const { findShortestPath } = require('../utils/pathfinding');
const {
  normalizeStoredPathGeometry,
  validatePathGeometry,
  reversePathGeometry
} = require('../utils/routeGeometry');

const APPLY_CONFIRMATION = 'APPLY_BE5_SELECTED_DEMO_PARITY_TO_MYSQL';
const BACKUP_DIR_NAME = 'campusphere-be5-selected-demo-parity';
const START_NODE_KEY = 'main-gate';
const PINNED = Object.freeze({
  buildings: 13,
  nodes: 20,
  edges: 48,
  pairs: 24,
  geometries: 48,
  exactReverse: 24,
  routable: 13
});

const TARGET = Object.freeze({
  casName: 'College of Arts and Sciences',
  casDescription: 'College of Arts and Sciences (CAS)',
  casCategory: 'Academic',
  casNodeKey: 'cas',
  casNodeLabel: 'College of Arts and Sciences',
  mainGateNodeKey: 'main-gate',
  mainGateLabel: 'Guard House / Main Gate',
  eastWalkNodeKey: 'east-walk',
  casLat: 13.40594916,
  casLng: 123.37704274,
  eastWalkLat: 13.40577,
  eastWalkLng: 123.37645
});

const CAS_FORWARD_GEOMETRY = Object.freeze([
  Object.freeze({ lat: TARGET.eastWalkLat, lng: TARGET.eastWalkLng }),
  Object.freeze({ lat: 13.40583, lng: 123.37675 }),
  Object.freeze({ lat: 13.40592, lng: 123.37674 }),
  Object.freeze({ lat: TARGET.casLat, lng: TARGET.casLng })
]);
const CAS_REVERSE_GEOMETRY = Object.freeze(
  CAS_FORWARD_GEOMETRY.slice().reverse().map((p) => Object.freeze({ ...p }))
);

class SafeParityError extends Error {}

function canonicalKey(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function positiveInt(value) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 1 ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^[1-9][0-9]*$/.test(trimmed)) return null;
    const number = Number(trimmed);
    return Number.isSafeInteger(number) && number >= 1 ? number : null;
  }
  return null;
}

function finiteNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  return null;
}

function optionalString(value) {
  return value == null ? null : value;
}

function accessibilityFlag(value) {
  if (value === true || value === 1 || value === '1') return 1;
  if (value === false || value === 0 || value === '0') return 0;
  return null;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = stableValue(value[key]);
      return out;
    }, {});
  }
  return value;
}

function fingerprint(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(stableValue(value)))
    .digest('hex');
}

function normalizeDetails(value) {
  if (value == null) return { ok: true, value: null };
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch (_) { return { ok: false, value: null }; }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, value: null };
  }
  return { ok: true, value: stableValue(parsed) };
}

function normalizeGeometry(raw) {
  const normalized = normalizeStoredPathGeometry(raw);
  if (normalized.state !== 'present' || !Array.isArray(normalized.value)) return null;
  const points = [];
  for (const point of normalized.value) {
    const lat = point && typeof point.lat === 'number' && Number.isFinite(point.lat)
      ? point.lat
      : null;
    const lng = point && typeof point.lng === 'number' && Number.isFinite(point.lng)
      ? point.lng
      : null;
    if (lat === null || lng === null) return null;
    points.push({ lat, lng });
  }
  return points;
}

function edgeNatural(fromKey, toKey) {
  return `${fromKey}>${toKey}`;
}

function sameValue(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

/*
 * Build same-backend natural-key indexes and a complete semantic snapshot.
 * Any missing, duplicate, dangling, malformed, or ambiguous identity blocks
 * before a Map/Set result is trusted.
 */
function analyzeState(state) {
  const blockers = [];
  const buildings = Array.isArray(state && state.buildings) ? state.buildings : [];
  const nodes = Array.isArray(state && state.nodes) ? state.nodes : [];
  const edges = Array.isArray(state && state.edges) ? state.edges : [];

  const buildingById = new Map();
  const buildingByCanonical = new Map();
  for (const row of buildings) {
    const id = positiveInt(row.id);
    const nameValid = typeof row.name === 'string' && row.name.trim() !== '';
    const categoryValid = typeof row.category === 'string' && row.category.trim() !== '';
    const optionalStringsValid =
      (row.description == null || typeof row.description === 'string') &&
      (row.image_url == null || typeof row.image_url === 'string') &&
      (row.cloudinary_public_id == null || typeof row.cloudinary_public_id === 'string');
    const details = normalizeDetails(row.details);
    const natural = nameValid ? canonicalKey(row.name) : '';
    if (id === null) blockers.push('building has an invalid backend-local id.');
    else if (buildingById.has(id)) blockers.push('duplicate building backend-local id.');
    else buildingById.set(id, row);
    if (!natural) blockers.push('building has a missing or invalid canonical name.');
    else if (buildingByCanonical.has(natural)) blockers.push('duplicate canonical building name.');
    else buildingByCanonical.set(natural, row);
    if (finiteNumber(row.lat) === null || finiteNumber(row.lng) === null) {
      blockers.push('building has invalid coordinates.');
    }
    if (!categoryValid || !optionalStringsValid) {
      blockers.push('building has invalid public metadata types.');
    }
    if (!details.ok) blockers.push('building has invalid details JSON metadata.');
  }

  const nodeById = new Map();
  const nodeByKey = new Map();
  for (const row of nodes) {
    const id = positiveInt(row.id);
    const key = typeof row.node_key === 'string' ? row.node_key.trim() : '';
    if (id === null) blockers.push('route node has an invalid backend-local id.');
    else if (nodeById.has(id)) blockers.push('duplicate route-node backend-local id.');
    else nodeById.set(id, row);
    if (!key) blockers.push('route node has a missing natural key.');
    else if (nodeByKey.has(key)) blockers.push('duplicate route node natural key.');
    else nodeByKey.set(key, row);
    if (finiteNumber(row.lat) === null || finiteNumber(row.lng) === null) {
      blockers.push('route node has invalid coordinates.');
    }
    if (typeof row.label !== 'string' || row.label.trim() === '' ||
        typeof row.node_type !== 'string' || row.node_type.trim() === '') {
      blockers.push('route node has invalid public metadata types.');
    }
    if (row.building_id != null) {
      const buildingId = positiveInt(row.building_id);
      if (buildingId === null || !buildingById.has(buildingId)) {
        blockers.push('route node has a dangling or malformed building reference.');
      }
    }
  }

  const edgeByNatural = new Map();
  for (const row of edges) {
    const id = positiveInt(row.id);
    const fromId = positiveInt(row.from_node_id);
    const toId = positiveInt(row.to_node_id);
    const from = fromId === null ? null : nodeById.get(fromId);
    const to = toId === null ? null : nodeById.get(toId);
    if (id === null) blockers.push('route edge has an invalid backend-local id.');
    if (!from || !to) {
      blockers.push('route edge has a dangling or malformed node reference.');
      continue;
    }
    const natural = edgeNatural(String(from.node_key), String(to.node_key));
    if (edgeByNatural.has(natural)) blockers.push('duplicate directed route-edge identity.');
    else edgeByNatural.set(natural, row);
    if (finiteNumber(row.distance_meters) === null ||
        finiteNumber(row.walk_time_seconds) === null ||
        accessibilityFlag(row.is_accessible) === null) {
      blockers.push('route edge has invalid scalar metadata.');
    }
    if (row.path_label != null && typeof row.path_label !== 'string') {
      blockers.push('route edge has invalid path-label metadata.');
    }
    const geometry = normalizeGeometry(row.path_geometry);
    if (!geometry) {
      blockers.push('route edge has missing or malformed geometry.');
    } else {
      const validation = validatePathGeometry(geometry, {
        fromNode: from,
        toNode: to,
        allowNull: false,
        snapEndpoints: false
      });
      if (!validation.ok) blockers.push('route edge geometry is not endpoint-continuous.');
    }
  }

  if (blockers.length) {
    return {
      blockers: [...new Set(blockers)],
      buildingById,
      buildingByCanonical,
      nodeById,
      nodeByKey,
      edgeByNatural,
      snapshot: null,
      semanticFingerprint: null,
      metrics: null
    };
  }

  const snapshot = {
    buildings: buildings.map((row) => ({
      canonical: canonicalKey(row.name),
      name: String(row.name),
      category: String(row.category),
      description: optionalString(row.description),
      lat: finiteNumber(row.lat),
      lng: finiteNumber(row.lng),
      details: normalizeDetails(row.details).value,
      image_url: optionalString(row.image_url),
      cloudinary_public_id: optionalString(row.cloudinary_public_id)
    })).sort((a, b) => a.canonical.localeCompare(b.canonical)),
    nodes: nodes.map((row) => {
      const buildingId = row.building_id == null ? null : positiveInt(row.building_id);
      const building = buildingId == null ? null : buildingById.get(buildingId);
      return {
        node_key: String(row.node_key),
        label: String(row.label),
        node_type: String(row.node_type),
        building_canonical: building ? canonicalKey(building.name) : null,
        lat: finiteNumber(row.lat),
        lng: finiteNumber(row.lng),
        display_order: finiteNumber(row.display_order)
      };
    }).sort((a, b) => a.node_key.localeCompare(b.node_key)),
    edges: edges.map((row) => {
      const from = nodeById.get(positiveInt(row.from_node_id));
      const to = nodeById.get(positiveInt(row.to_node_id));
      return {
        from_key: String(from.node_key),
        to_key: String(to.node_key),
        distance_meters: finiteNumber(row.distance_meters),
        walk_time_seconds: finiteNumber(row.walk_time_seconds),
        path_label: optionalString(row.path_label),
        is_accessible: accessibilityFlag(row.is_accessible),
        geometry: normalizeGeometry(row.path_geometry)
      };
    }).sort((a, b) => edgeNatural(a.from_key, a.to_key).localeCompare(edgeNatural(b.from_key, b.to_key)))
  };

  const snapshotNodeByKey = new Map(snapshot.nodes.map((row) => [row.node_key, row]));
  const snapshotEdgeByNatural = new Map(
    snapshot.edges.map((row) => [edgeNatural(row.from_key, row.to_key), row])
  );

  const seenPairs = new Set();
  let pairs = 0;
  let exactReverse = 0;
  for (const row of snapshot.edges) {
    const natural = edgeNatural(row.from_key, row.to_key);
    const reverseNatural = edgeNatural(row.to_key, row.from_key);
    const pair = [natural, reverseNatural].sort().join('|');
    if (seenPairs.has(pair)) continue;
    seenPairs.add(pair);
    const reverse = snapshotEdgeByNatural.get(reverseNatural);
    if (!reverse) continue;
    pairs += 1;
    if (sameValue(reversePathGeometry(row.geometry), reverse.geometry)) exactReverse += 1;
  }

  const routeNodes = snapshot.nodes.map((row) => ({
    key: row.node_key,
    lat: row.lat,
    lng: row.lng
  }));
  const routeEdges = snapshot.edges.map((row) => ({
    from: row.from_key,
    to: row.to_key,
    distance_meters: row.distance_meters,
    walk_time_seconds: row.walk_time_seconds,
    is_accessible: row.is_accessible
  }));
  const routableBuildings = new Set();
  for (const node of snapshot.nodes) {
    if (!node.building_canonical) continue;
    const route = findShortestPath({
      nodes: routeNodes,
      edges: routeEdges,
      startKey: START_NODE_KEY,
      endKey: node.node_key
    });
    if (route && route.success) routableBuildings.add(node.building_canonical);
  }

  const metrics = {
    buildings: snapshot.buildings.length,
    nodes: snapshot.nodes.length,
    edges: snapshot.edges.length,
    pairs,
    geometries: snapshot.edges.filter((row) => Array.isArray(row.geometry)).length,
    exactReverse,
    routable: routableBuildings.size
  };

  return {
    blockers: [],
    buildingById,
    buildingByCanonical,
    nodeById,
    nodeByKey,
    edgeByNatural,
    snapshot,
    semanticFingerprint: fingerprint(snapshot),
    metrics
  };
}

function pinnedMetricsBlockers(metrics) {
  if (!metrics) return ['complete selected-demo metrics are unavailable.'];
  const blockers = [];
  for (const [key, expected] of Object.entries(PINNED)) {
    if (metrics[key] !== expected) blockers.push(`pinned ${key} count does not match.`);
  }
  return blockers;
}

function changedFields(row, expected) {
  return Object.keys(expected).filter((field) => {
    if (field === 'lat' || field === 'lng') {
      return finiteNumber(row[field]) !== expected[field];
    }
    if (field === 'building_canonical') return row[field] !== expected[field];
    return !sameValue(row[field], expected[field]);
  });
}

function applyActionsToState(state, actions) {
  const projected = deepClone(state);
  const analyzed = analyzeState(projected);
  if (analyzed.blockers.length) throw new SafeParityError('Unable to simulate an invalid selected-demo state.');

  for (const action of actions) {
    if (action.kind === 'building') {
      const row = analyzed.buildingByCanonical.get(action.canonical);
      for (const field of action.changes) row[field] = action.expected[field];
    } else if (action.kind === 'node') {
      const row = analyzed.nodeByKey.get(action.node_key);
      for (const field of action.changes) {
        if (field === 'building_canonical') {
          const building = analyzed.buildingByCanonical.get(action.expected.building_canonical);
          row.building_id = building.id;
        } else {
          row[field] = action.expected[field];
        }
      }
    } else if (action.kind === 'edge') {
      const row = analyzed.edgeByNatural.get(action.natural);
      row.path_geometry = deepClone(action.expected.geometry);
    }
  }
  return projected;
}

function targetStateBlockers(analysis) {
  const blockers = [];
  if (!analysis || analysis.blockers.length) return ['selected-demo state is invalid.'];
  const casCanonical = canonicalKey(TARGET.casName);
  const cas = analysis.snapshot.buildings.find((row) => row.canonical === casCanonical);
  const gate = analysis.snapshot.nodes.find((row) => row.node_key === TARGET.mainGateNodeKey);
  const casNode = analysis.snapshot.nodes.find((row) => row.node_key === TARGET.casNodeKey);
  const forward = analysis.snapshot.edges.find(
    (row) => edgeNatural(row.from_key, row.to_key) === edgeNatural(TARGET.eastWalkNodeKey, TARGET.casNodeKey)
  );
  const reverse = analysis.snapshot.edges.find(
    (row) => edgeNatural(row.from_key, row.to_key) === edgeNatural(TARGET.casNodeKey, TARGET.eastWalkNodeKey)
  );
  if (!cas ||
      cas.category !== TARGET.casCategory ||
      cas.description !== TARGET.casDescription ||
      cas.lat !== TARGET.casLat ||
      cas.lng !== TARGET.casLng) {
    blockers.push('canonical CAS building metadata is not at the selected-demo target.');
  }
  if (!gate || gate.label !== TARGET.mainGateLabel) {
    blockers.push('main-gate public label is not at the selected-demo target.');
  }
  if (!casNode ||
      casNode.label !== TARGET.casNodeLabel ||
      casNode.building_canonical !== casCanonical ||
      casNode.lat !== TARGET.casLat ||
      casNode.lng !== TARGET.casLng) {
    blockers.push('CAS route-node identity or coordinate is not at the selected-demo target.');
  }
  if (!forward || !sameValue(forward.geometry, CAS_FORWARD_GEOMETRY)) {
    blockers.push('east-walk to CAS geometry is not at the selected-demo target.');
  }
  if (!reverse || !sameValue(reverse.geometry, CAS_REVERSE_GEOMETRY)) {
    blockers.push('CAS to east-walk geometry is not the exact target reverse.');
  }
  return blockers;
}

function buildPlan(state) {
  const analysis = analyzeState(state);
  const blockers = [...analysis.blockers, ...pinnedMetricsBlockers(analysis.metrics)];
  if (blockers.length) {
    return {
      blockers: [...new Set(blockers)],
      actions: [],
      counts: { building_updates: 0, node_updates: 0, edge_updates: 0, total_updates: 0 },
      current: analysis.metrics,
      projected: null,
      preFingerprint: analysis.semanticFingerprint,
      projectedFingerprint: null,
      actionFingerprint: null
    };
  }

  const actions = [];
  const casCanonical = canonicalKey(TARGET.casName);
  const casBuildingRaw = analysis.buildingByCanonical.get(casCanonical);
  const casBuildingSnapshot = analysis.snapshot.buildings.find((row) => row.canonical === casCanonical);
  if (!casBuildingRaw || !casBuildingSnapshot) {
    blockers.push('canonical CAS building is missing.');
  } else {
    const expected = {
      category: TARGET.casCategory,
      description: TARGET.casDescription,
      lat: TARGET.casLat,
      lng: TARGET.casLng
    };
    const changes = changedFields(casBuildingSnapshot, expected);
    if (changes.length) actions.push({ kind: 'building', canonical: casCanonical, expected, changes });
  }

  for (const [nodeKey, expected] of [
    [TARGET.mainGateNodeKey, { label: TARGET.mainGateLabel }],
    [TARGET.casNodeKey, {
      label: TARGET.casNodeLabel,
      building_canonical: casCanonical,
      lat: TARGET.casLat,
      lng: TARGET.casLng
    }]
  ]) {
    const snapshotRow = analysis.snapshot.nodes.find((row) => row.node_key === nodeKey);
    if (!snapshotRow) {
      blockers.push('required selected-demo route node is missing.');
      continue;
    }
    const changes = changedFields(snapshotRow, expected);
    if (changes.length) actions.push({ kind: 'node', node_key: nodeKey, expected, changes });
  }

  for (const [fromKey, toKey, geometry] of [
    [TARGET.eastWalkNodeKey, TARGET.casNodeKey, CAS_FORWARD_GEOMETRY],
    [TARGET.casNodeKey, TARGET.eastWalkNodeKey, CAS_REVERSE_GEOMETRY]
  ]) {
    const natural = edgeNatural(fromKey, toKey);
    const snapshotRow = analysis.snapshot.edges.find(
      (row) => edgeNatural(row.from_key, row.to_key) === natural
    );
    if (!snapshotRow) {
      blockers.push('required selected-demo directed edge is missing.');
      continue;
    }
    if (!sameValue(snapshotRow.geometry, geometry)) {
      actions.push({
        kind: 'edge',
        natural,
        from_key: fromKey,
        to_key: toKey,
        expected: { geometry: deepClone(geometry) },
        changes: ['geometry']
      });
    }
  }

  if (blockers.length) {
    return {
      blockers: [...new Set(blockers)],
      actions: [],
      counts: { building_updates: 0, node_updates: 0, edge_updates: 0, total_updates: 0 },
      current: analysis.metrics,
      projected: null,
      preFingerprint: analysis.semanticFingerprint,
      projectedFingerprint: null,
      actionFingerprint: null
    };
  }

  let projectedState;
  let projectedAnalysis;
  try {
    projectedState = applyActionsToState(state, actions);
    projectedAnalysis = analyzeState(projectedState);
  } catch (_) {
    blockers.push('selected-demo projection could not be constructed safely.');
  }
  if (projectedAnalysis) {
    blockers.push(...projectedAnalysis.blockers);
    blockers.push(...pinnedMetricsBlockers(projectedAnalysis.metrics));
    blockers.push(...targetStateBlockers(projectedAnalysis));
  }

  const counts = {
    building_updates: actions.filter((action) => action.kind === 'building').length,
    node_updates: actions.filter((action) => action.kind === 'node').length,
    edge_updates: actions.filter((action) => action.kind === 'edge').length,
    total_updates: actions.length
  };
  const projectedFingerprint = projectedAnalysis ? projectedAnalysis.semanticFingerprint : null;
  return {
    blockers: [...new Set(blockers)],
    actions,
    counts,
    current: analysis.metrics,
    projected: projectedAnalysis ? projectedAnalysis.metrics : null,
    preFingerprint: analysis.semanticFingerprint,
    projectedFingerprint,
    actionFingerprint: projectedFingerprint
      ? fingerprint({
          preFingerprint: analysis.semanticFingerprint,
          projectedFingerprint,
          actions
        })
      : null
  };
}

function planIsFullyPresent(plan) {
  return !!plan &&
    plan.blockers.length === 0 &&
    plan.counts.total_updates === 0 &&
    plan.preFingerprint === plan.projectedFingerprint;
}

async function readMysqlState(queryTarget, lockRows) {
  const queryable = queryTarget || db;
  const suffix = lockRows ? ' FOR UPDATE' : '';
  const [buildings] = await queryable.query(
    'SELECT id, name, category, description, lat, lng, details, image_url, cloudinary_public_id ' +
    `FROM buildings ORDER BY id${suffix}`
  );
  const [nodes] = await queryable.query(
    'SELECT id, node_key, label, node_type, building_id, lat, lng, display_order ' +
    `FROM route_nodes ORDER BY id${suffix}`
  );
  const [edges] = await queryable.query(
    'SELECT id, from_node_id, to_node_id, distance_meters, walk_time_seconds, path_label, ' +
    `is_accessible, path_geometry FROM route_edges ORDER BY id${suffix}`
  );
  return { buildings, nodes, edges };
}

async function writeBackup(lockedState, semanticFingerprint) {
  const dir = path.join(os.tmpdir(), BACKUP_DIR_NAME);
  const file = path.join(
    dir,
    `mysql-before-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID()}.json`
  );
  const payload = {
    schema_version: 1,
    created_at: new Date().toISOString(),
    semantic_fingerprint: semanticFingerprint,
    selected_demo_state: lockedState
  };
  try {
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(
      file,
      `${JSON.stringify(payload, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx', mode: 0o600 }
    );
    const verify = JSON.parse(await fs.promises.readFile(file, 'utf8'));
    const verifiedState = analyzeState(verify.selected_demo_state);
    if (verify.schema_version !== 1 ||
        verify.semantic_fingerprint !== semanticFingerprint ||
        verifiedState.blockers.length !== 0 ||
        verifiedState.semanticFingerprint !== semanticFingerprint) {
      throw new Error('fingerprint mismatch');
    }
  } catch (_) {
    throw new SafeParityError('Unable to create and verify the locked MySQL parity backup.');
  }
  return { backupPath: file, fingerprint: semanticFingerprint };
}

function withBackup(message, backupPath) {
  if (!backupPath || /Backup:\s/.test(message)) return message;
  return `${message} Backup: ${backupPath}`;
}

async function applyPlanWithAdapter(adapter, approvedPlan) {
  if (!approvedPlan || approvedPlan.blockers.length) {
    throw new SafeParityError('Approved selected-demo plan is blocked; no data was written.');
  }

  let begun = false;
  let committed = false;
  let backupPath = null;
  let lockedFingerprint = null;

  try {
    await adapter.begin();
    begun = true;

    const lockedState = await adapter.readLockedState();
    const lockedPlan = buildPlan(lockedState);
    if (lockedPlan.blockers.length ||
        lockedPlan.preFingerprint !== approvedPlan.preFingerprint ||
        lockedPlan.actionFingerprint !== approvedPlan.actionFingerprint) {
      throw new SafeParityError('MySQL selected-demo state changed after preflight; no data was written.');
    }
    lockedFingerprint = lockedPlan.preFingerprint;

    const backup = await adapter.createBackup(lockedState, lockedFingerprint);
    if (!backup || !backup.backupPath || backup.fingerprint !== lockedFingerprint) {
      throw new SafeParityError('No usable locked-snapshot backup was created; no data was written.');
    }
    backupPath = backup.backupPath;

    const applied = await adapter.applyActions(lockedPlan.actions);
    if (!applied || applied.ok !== true || applied.count !== lockedPlan.actions.length) {
      throw new SafeParityError('MySQL selected-demo apply affected an unexpected number of rows.');
    }

    const inTransaction = await adapter.readLockedState();
    const inTransactionPlan = buildPlan(inTransaction);
    if (!planIsFullyPresent(inTransactionPlan) ||
        inTransactionPlan.preFingerprint !== lockedPlan.projectedFingerprint) {
      throw new SafeParityError('Pre-commit selected-demo parity verification failed.');
    }

    await adapter.commit();
    committed = true;

    const postCommit = await adapter.readFreshState();
    const postCommitPlan = buildPlan(postCommit);
    if (!planIsFullyPresent(postCommitPlan) ||
        postCommitPlan.preFingerprint !== lockedPlan.projectedFingerprint) {
      throw new SafeParityError('POST-COMMIT READBACK MISMATCH: data committed but parity is unverified.');
    }
    return { committed: true, backupPath, updates: lockedPlan.actions.length };
  } catch (error) {
    const safeMessage = error instanceof SafeParityError
      ? error.message
      : 'Selected-demo parity apply failed.';
    if (committed) throw new SafeParityError(withBackup(safeMessage, backupPath));
    if (!begun) throw new SafeParityError('Selected-demo parity apply failed before the transaction began; no data was written.');

    let rolledBack = false;
    try {
      const result = await adapter.rollback();
      rolledBack = !!(result && result.ok === true);
    } catch (_) {
      rolledBack = false;
    }

    if (!rolledBack) {
      throw new SafeParityError(withBackup(
        `ROLLBACK FAILED after: ${safeMessage}. Manual recovery review is required.`,
        backupPath
      ));
    }
    if (lockedFingerprint === null) {
      throw new SafeParityError(
        `Selected-demo parity apply failed (${safeMessage}); the transaction was rolled back and no data was written.`
      );
    }

    let restored = false;
    try {
      const afterRollback = analyzeState(await adapter.readFreshState());
      restored = afterRollback.blockers.length === 0 &&
        afterRollback.semanticFingerprint === lockedFingerprint;
    } catch (_) {
      restored = false;
    }
    if (restored) {
      if (backupPath === null) {
        throw new SafeParityError(
          `Selected-demo parity apply failed (${safeMessage}); the transaction was rolled back and no data was written.`
        );
      }
      throw new SafeParityError(withBackup(
        `Selected-demo parity apply failed (${safeMessage}); the original MySQL state was rolled back and verified.`,
        backupPath
      ));
    }
    if (backupPath === null) {
      throw new SafeParityError(
        `ROLLBACK VERIFICATION FAILED after: ${safeMessage}. Manual transaction cleanup is required; no usable backup exists.`
      );
    }
    throw new SafeParityError(withBackup(
      `ROLLBACK VERIFICATION FAILED after: ${safeMessage}. Manual recovery review is required.`,
      backupPath
    ));
  }
}

function makeLiveAdapter(pool) {
  const connectionPool = pool || db;
  let connection = null;

  function takeConnection() {
    const current = connection;
    connection = null;
    return current;
  }
  function releaseSafe(current) {
    try { current.release(); } catch (_) {
      try { current.destroy(); } catch (_2) { /* already disposed */ }
    }
  }
  function destroyUncertain(current) {
    try { current.destroy(); } catch (_) { /* already disposed */ }
  }
  async function lockedBuildingIdByCanonical(canonical) {
    const [rows] = await connection.query('SELECT id, name FROM buildings ORDER BY id FOR UPDATE');
    const matches = (rows || []).filter((row) => canonicalKey(row.name) === canonical);
    if (matches.length !== 1) {
      throw new SafeParityError('Canonical building identity changed inside the transaction.');
    }
    return matches[0].id;
  }

  return {
    _hasConnection() { return connection !== null; },
    async begin() {
      const current = await connectionPool.getConnection();
      connection = current;
      try {
        await current.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
        await current.beginTransaction();
      } catch (error) {
        takeConnection();
        destroyUncertain(current);
        throw error;
      }
    },
    async readLockedState() {
      return readMysqlState(connection, true);
    },
    async readFreshState() {
      return readMysqlState(connectionPool, false);
    },
    async createBackup(state, semanticFingerprint) {
      return writeBackup(state, semanticFingerprint);
    },
    async applyActions(actions) {
      let affected = 0;
      for (const action of actions) {
        if (action.kind === 'building') {
          const buildingId = await lockedBuildingIdByCanonical(action.canonical);
          const allowed = {
            category: 'category',
            description: 'description',
            lat: 'lat',
            lng: 'lng'
          };
          const columns = action.changes.map((field) => allowed[field]);
          if (columns.some((column) => !column)) throw new SafeParityError('Unexpected building correction field.');
          const sql = `UPDATE buildings SET ${columns.map((column) => `${column}=?`).join(', ')} WHERE id=?`;
          const values = action.changes.map((field) => action.expected[field]);
          const [result] = await connection.query(sql, [...values, buildingId]);
          if (!result || result.affectedRows !== 1) {
            throw new SafeParityError('Building correction affected an unexpected number of rows.');
          }
          affected += 1;
        } else if (action.kind === 'node') {
          const [rows] = await connection.query(
            'SELECT id FROM route_nodes WHERE node_key=? FOR UPDATE',
            [action.node_key]
          );
          if (!Array.isArray(rows) || rows.length !== 1) {
            throw new SafeParityError('Required route-node identity changed inside the transaction.');
          }
          const sets = [];
          const values = [];
          for (const field of action.changes) {
            if (field === 'label' || field === 'lat' || field === 'lng') {
              sets.push(`${field}=?`);
              values.push(action.expected[field]);
            } else if (field === 'building_canonical') {
              const buildingId = await lockedBuildingIdByCanonical(action.expected.building_canonical);
              sets.push('building_id=?');
              values.push(buildingId);
            } else {
              throw new SafeParityError('Unexpected route-node correction field.');
            }
          }
          const [result] = await connection.query(
            `UPDATE route_nodes SET ${sets.join(', ')} WHERE id=?`,
            [...values, rows[0].id]
          );
          if (!result || result.affectedRows !== 1) {
            throw new SafeParityError('Route-node correction affected an unexpected number of rows.');
          }
          affected += 1;
        } else if (action.kind === 'edge') {
          const [rows] = await connection.query(
            `SELECT e.id
               FROM route_edges e
               JOIN route_nodes f ON f.id=e.from_node_id
               JOIN route_nodes t ON t.id=e.to_node_id
              WHERE f.node_key=? AND t.node_key=?
              FOR UPDATE`,
            [action.from_key, action.to_key]
          );
          if (!Array.isArray(rows) || rows.length !== 1) {
            throw new SafeParityError('Required directed-edge identity changed inside the transaction.');
          }
          const [result] = await connection.query(
            'UPDATE route_edges SET path_geometry=? WHERE id=?',
            [JSON.stringify(action.expected.geometry), rows[0].id]
          );
          if (!result || result.affectedRows !== 1) {
            throw new SafeParityError('Route-edge correction affected an unexpected number of rows.');
          }
          affected += 1;
        } else {
          throw new SafeParityError('Unexpected selected-demo correction action.');
        }
      }
      return { ok: true, count: affected };
    },
    async commit() {
      const current = connection;
      await current.commit();
      takeConnection();
      releaseSafe(current);
      return { ok: true };
    },
    async rollback() {
      const current = connection;
      try {
        await current.rollback();
      } catch (error) {
        takeConnection();
        destroyUncertain(current);
        throw error;
      }
      takeConnection();
      releaseSafe(current);
      return { ok: true };
    }
  };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const allowed = new Set(['--dry-run', '--apply', '--help']);
  const flags = args.filter((arg) => !arg.startsWith('--confirm='));
  const confirmations = args
    .filter((arg) => arg.startsWith('--confirm='))
    .map((arg) => arg.slice('--confirm='.length));

  for (const flag of flags) {
    if (!allowed.has(flag)) {
      throw new SafeParityError('Unknown argument. Use --dry-run, --apply, or --help.');
    }
    if (flags.filter((candidate) => candidate === flag).length > 1) {
      throw new SafeParityError('Duplicate command flag is not allowed.');
    }
  }
  if (confirmations.length > 1) {
    throw new SafeParityError('Apply confirmation must be provided exactly once.');
  }
  if (flags.includes('--help')) {
    if (flags.length !== 1 || confirmations.length) {
      throw new SafeParityError('--help cannot be combined with another argument.');
    }
    return { help: true, mode: 'dry-run' };
  }
  if (flags.includes('--apply')) {
    if (flags.includes('--dry-run')) {
      throw new SafeParityError('--apply cannot be combined with --dry-run.');
    }
    if (confirmations[0] !== APPLY_CONFIRMATION) {
      throw new SafeParityError('Apply requires the exact confirmation token; no data was written.');
    }
    return { help: false, mode: 'apply' };
  }
  if (confirmations.length) {
    throw new SafeParityError('--confirm is valid only with --apply.');
  }
  return { help: false, mode: 'dry-run' };
}

function printPlan(plan, mode) {
  const dryRun = mode === 'dry-run';
  console.log(`=== CampuSphere BE.5 selected-demo MySQL parity: ${dryRun ? 'DRY RUN' : 'CONFIRMED APPLY PREFLIGHT'} ===`);
  console.log(dryRun
    ? 'READ ONLY: this invocation cannot issue a database mutation.'
    : 'WRITE MODE: the exact apply confirmation token was accepted.');
  if (plan.current) {
    console.log(
      `Current topology: ${plan.current.nodes}/${plan.current.edges}/${plan.current.pairs}/` +
      `${plan.current.geometries}/${plan.current.exactReverse}/${plan.current.routable}; ` +
      `${plan.current.buildings} selected buildings`
    );
  }
  console.log(
    `Planned row updates: ${plan.counts.building_updates} building, ` +
    `${plan.counts.node_updates} node, ${plan.counts.edge_updates} edge ` +
    `(${plan.counts.total_updates} total)`
  );
  if (plan.projected) {
    console.log(
      `Projected topology: ${plan.projected.nodes}/${plan.projected.edges}/${plan.projected.pairs}/` +
      `${plan.projected.geometries}/${plan.projected.exactReverse}/${plan.projected.routable}; ` +
      `${plan.projected.buildings} selected buildings`
    );
  }
  if (plan.blockers.length) {
    console.log(`BLOCKERS (${plan.blockers.length}):`);
    for (const blocker of plan.blockers) console.log(`  - ${blocker}`);
    console.log('PARITY CORRECTION BLOCKED: no data was written.');
  } else {
    console.log(`${dryRun ? 'DRY RUN' : 'PREFLIGHT'} OK: complete semantic state and rollback boundaries are ready.`);
    if (dryRun) {
      console.log('No data was written. A later controlled apply requires:');
      console.log(`  node scripts/applyBe5SelectedDemoParityMysql.js --apply --confirm=${APPLY_CONFIRMATION}`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log('Usage: node scripts/applyBe5SelectedDemoParityMysql.js --dry-run');
    console.log(
      `Apply: node scripts/applyBe5SelectedDemoParityMysql.js --apply --confirm=${APPLY_CONFIRMATION}`
    );
    console.log('Dry-run is the default. Apply requires separate authorization.');
    return;
  }

  const state = await readMysqlState(null, false);
  const plan = buildPlan(state);
  printPlan(plan, args.mode);
  if (plan.blockers.length) {
    process.exitCode = 2;
    return;
  }
  if (args.mode === 'dry-run') return;

  const result = await applyPlanWithAdapter(makeLiveAdapter(), plan);
  console.log('');
  console.log('APPLY OK: MySQL selected-demo metadata matches the reviewed target.');
  console.log(`Updated ${result.updates} row(s).`);
  console.log(`Pre-write backup: ${result.backupPath}`);
}

if (require.main === module) {
  main()
    .catch((error) => {
      const message = error instanceof SafeParityError
        ? error.message
        : 'Unexpected selected-demo parity failure.';
      console.error(`BE.5 selected-demo parity failed: ${message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      try { await db.end(); } catch (_) { /* already closed */ }
    });
}

module.exports = {
  APPLY_CONFIRMATION,
  BACKUP_DIR_NAME,
  PINNED,
  TARGET,
  CAS_FORWARD_GEOMETRY,
  CAS_REVERSE_GEOMETRY,
  SafeParityError,
  canonicalKey,
  positiveInt,
  analyzeState,
  buildPlan,
  planIsFullyPresent,
  applyActionsToState,
  applyPlanWithAdapter,
  makeLiveAdapter,
  parseArgs,
  fingerprint,
  targetStateBlockers
};
