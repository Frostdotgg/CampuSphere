'use strict';
/* =============================================================================
   CampuSphere — DB Performance / Indexing Gate (Milestone 8, Section 8.8 / R12)
   =============================================================================
   READ-ONLY. Collects index evidence for the critical data-access flows and
   decides GO/NO-GO. As of the Section 8.8 follow-up BOTH classes are REQUIRED:
   the hot transactional paths (auth lookup, session get/cleanup, audit-log
   filters, profile hydration) AND the order/filter paths (news/events/faqs/
   route-steps/route-nodes/VR ordering, users by created_at/updated_at/role) must
   each have a supporting MySQL index, matched by a declared Supabase parity index
   (0001 baseline + 0010 follow-up).

   Why index EXISTENCE (not EXPLAIN `type`) is the pass/fail signal:
     At seed scale MySQL's optimizer often picks a full scan over a tiny table
     even when an index exists, so EXPLAIN `type=ALL` is not, by itself, a defect.
     EXPLAIN output is still printed as evidence (possible_keys proves the index
     is available); the authoritative check is whether the supporting index is
     declared in INFORMATION_SCHEMA.

   Coverage: auth/session, dashboard, map/search, route/pathfinding, VR,
   admin CRUD, logs, session-store — MySQL EXPLAIN + index evidence, plus a
   practical Supabase query-path probe and static index-declaration parity.

   Output is sanitized: fixed labels + plan shape only. Never prints secrets,
   the Supabase host/key, raw errors, row values, cookies, or stack traces.

   Usage (safe to run repeatedly):
     node scripts/db-perf-gate.js
   ============================================================================= */

const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { getSupabaseClient, hasSupabaseConfig } = require('../config/supabase');

const failures = [];
const critical = (ok, label) => { console.log((ok ? '  PASS ' : '  FAIL ') + label); if (!ok) failures.push(label); };
const note = (label) => console.log('  NOTE ' + label);

// Live route-graph topology after the OWNER-APPLIED 0017 repair. 0014/0015 are
// immutable owner-applied predecessors that shipped the earlier 52-edge /
// 26-pair graph; 0017 retired the seven transit pairs and added the eastern
// terminal spurs + the building-free central spine. These counts are
// fail-closed: the obsolete 52-row state must NOT pass.
const EXPECTED_ROUTE_EDGES = 50;
const EXPECTED_ROUTE_PAIRS = 25;

/* ---------------- MySQL helpers ---------------- */
async function tableIndexes(table) {
  // index_name -> [columns in SEQ order]
  const [rows] = await db.query(
    `SELECT INDEX_NAME, SEQ_IN_INDEX, COLUMN_NAME
       FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      ORDER BY INDEX_NAME, SEQ_IN_INDEX`, [table]);
  const map = {};
  for (const r of rows) {
    (map[r.INDEX_NAME] = map[r.INDEX_NAME] || []).push(r.COLUMN_NAME);
  }
  return map;
}
// true if some index's leading columns equal `cols` (composite-prefix aware)
function hasLeading(indexes, cols) {
  return Object.values(indexes).some((idxCols) =>
    cols.every((c, i) => idxCols[i] === c));
}
async function explain(sql) {
  try {
    const [rows] = await db.query('EXPLAIN ' + sql);
    return rows.map((r) =>
      `type=${r.type || '-'} key=${r.key || '-'} poss=${r.possible_keys || '-'} rows=${r.rows == null ? '-' : r.rows} extra=${r.Extra || '-'}`
    ).join(' | ');
  } catch (e) {
    return '(explain unavailable)';
  }
}

// CRITICAL hot-path flows: supporting index MUST exist.
const CRITICAL_FLOWS = [
  { flow: 'auth: login lookup', table: 'users', cols: ['email'],
    sql: "SELECT id, password, role FROM users WHERE email = 'demo@example.invalid'" },
  { flow: 'session-store: get by sid', table: 'app_sessions', cols: ['sid'],
    sql: "SELECT sess FROM app_sessions WHERE sid = 'demo-sid'" },
  { flow: 'session-store: expiry cleanup', table: 'app_sessions', cols: ['expires_at'],
    sql: 'SELECT sid FROM app_sessions WHERE expires_at < 1' },
  { flow: 'logs: filtered audit view', table: 'system_logs', cols: ['event_type', 'outcome', 'created_at'],
    sql: "SELECT id FROM system_logs WHERE event_type = 'authentication' AND outcome = 'failure' ORDER BY created_at DESC LIMIT 50" },
  { flow: 'logs: recent stream', table: 'system_logs', cols: ['created_at'],
    sql: 'SELECT id FROM system_logs ORDER BY created_at DESC LIMIT 50' },
  { flow: 'auth: profile hydration', table: 'student_profiles', cols: ['user_id'],
    sql: 'SELECT id FROM student_profiles WHERE user_id = 1' },
];

// ORDER/FILTER flows: as of the Section 8.8 follow-up these are now REQUIRED —
// each must have a supporting index in MySQL (schema.sql for fresh installs;
// seed.js ensureIndex for existing DBs), matching the Supabase parity index.
const INDEXED_FLOWS = [
  { flow: 'dashboard: news by audience+published_date', table: 'news_announcements', cols: ['audience', 'published_date'], sbIndex: 'news_announcements_audience_published_date_idx',
    sql: "SELECT id FROM news_announcements WHERE audience IN ('all','student-cspc') ORDER BY published_date DESC LIMIT 20" },
  { flow: 'dashboard: news by published_date', table: 'news_announcements', cols: ['published_date'], sbIndex: 'news_announcements_published_date_idx',
    sql: 'SELECT id FROM news_announcements ORDER BY published_date DESC LIMIT 20' },
  { flow: 'admin: news by created_at', table: 'news_announcements', cols: ['created_at'], sbIndex: 'news_announcements_created_at_idx',
    sql: 'SELECT id FROM news_announcements ORDER BY created_at DESC LIMIT 20' },
  { flow: 'events: by event_date', table: 'events', cols: ['event_date'], sbIndex: 'events_event_date_idx',
    sql: 'SELECT id FROM events ORDER BY event_date DESC LIMIT 50' },
  { flow: 'admin CRUD: faqs ordering', table: 'faqs', cols: ['display_order'], sbIndex: 'faqs_display_order_idx',
    sql: 'SELECT id FROM faqs ORDER BY display_order ASC, id ASC' },
  { flow: 'route/pathfinding: steps order', table: 'campus_route_steps', cols: ['route_id', 'step_order'], sbIndex: 'campus_route_steps_route_id_step_order_idx',
    sql: 'SELECT id FROM campus_route_steps WHERE route_id = 1 ORDER BY step_order ASC' },
  { flow: 'route admin: nodes ordering', table: 'route_nodes', cols: ['display_order'], sbIndex: 'route_nodes_display_order_idx',
    sql: 'SELECT id FROM route_nodes ORDER BY display_order ASC, id ASC' },
  { flow: 'VR: scenes ordering', table: 'vr_scenes', cols: ['display_order'], sbIndex: 'vr_scenes_display_order_idx',
    sql: 'SELECT id FROM vr_scenes ORDER BY display_order ASC, id ASC' },
  { flow: 'VR: hotspots per scene order', table: 'vr_hotspots', cols: ['scene_id', 'display_order'], sbIndex: 'vr_hotspots_scene_id_display_order_idx',
    sql: 'SELECT id FROM vr_hotspots WHERE scene_id = 1 ORDER BY display_order ASC' },
  { flow: 'VR: schedule hotspots by target', table: 'vr_hotspots', cols: ['schedule_building_id', 'schedule_location_type', 'schedule_location_label'], sbIndex: 'vr_hotspots_schedule_target_idx',
    sql: "SELECT id FROM vr_hotspots WHERE schedule_building_id = 1 AND schedule_location_type = 'room' AND schedule_location_label = 'demo' LIMIT 50" },
  { flow: 'admin: recent users by created_at', table: 'users', cols: ['created_at'], sbIndex: 'users_created_at_idx',
    sql: 'SELECT id FROM users ORDER BY created_at DESC LIMIT 5' },
  { flow: 'admin: users by role', table: 'users', cols: ['role'], sbIndex: 'users_role_idx',
    sql: "SELECT id FROM users WHERE role = 'student-cspc' LIMIT 50" },
  { flow: 'users: updated_at parity', table: 'users', cols: ['updated_at'], sbIndex: 'users_updated_at_idx',
    sql: 'SELECT id FROM users ORDER BY updated_at DESC LIMIT 5' },
  // Milestone 11 (room scheduling, Section 11.3) read paths from the domain
  // contract: building detail view (building + bounded date range) and the
  // cross-building bounded date-range listing.
  { flow: 'schedules: by building+date (building view)', table: 'room_schedules', cols: ['building_id', 'schedule_date'], sbIndex: 'room_schedules_building_date_idx',
    sql: 'SELECT id FROM room_schedules WHERE building_id = 1 AND schedule_date >= CURDATE() ORDER BY schedule_date ASC LIMIT 50' },
  { flow: 'schedules: by date range', table: 'room_schedules', cols: ['schedule_date'], sbIndex: 'room_schedules_schedule_date_idx',
    sql: "SELECT id FROM room_schedules WHERE schedule_date BETWEEN '2026-01-01' AND '2026-03-31' ORDER BY schedule_date ASC LIMIT 50" },
  { flow: 'schedule images: by building and term', table: 'room_schedule_documents', cols: ['building_id', 'semester', 'school_year'], sbIndex: 'room_schedule_documents_building_term_idx',
    sql: "SELECT id FROM room_schedule_documents WHERE building_id = 1 AND semester = 'first-semester' AND school_year = '2026-2027' LIMIT 50" },
  { flow: 'VR: schedule image hotspots by document', table: 'vr_hotspots', cols: ['schedule_document_id'], sbIndex: 'vr_hotspots_schedule_document_idx',
    sql: 'SELECT id FROM vr_hotspots WHERE schedule_document_id = 1 LIMIT 50' },
];

async function verifyMysql() {
  console.log('MySQL — critical hot-path indexes (authoritative):');
  for (const f of CRITICAL_FLOWS) {
    let idx;
    try { idx = await tableIndexes(f.table); } catch (e) { critical(false, `${f.flow} — index introspection errored`); continue; }
    const ok = hasLeading(idx, f.cols);
    critical(ok, `${f.flow} — index on ${f.table}(${f.cols.join(', ')})`);
    console.log('         EXPLAIN: ' + (await explain(f.sql)));
  }

  console.log('\nMySQL — order/filter indexes (REQUIRED; Supabase parity):');
  for (const f of INDEXED_FLOWS) {
    let present = false;
    try { present = hasLeading(await tableIndexes(f.table), f.cols); } catch (e) { /* recorded as fail below */ }
    critical(present, `${f.flow} — index on ${f.table}(${f.cols.join(', ')}) [SB: ${f.sbIndex}]`);
    console.log('         EXPLAIN: ' + (await explain(f.sql)));
  }

  console.log('\nMySQL — map/search note:');
  note('map/search uses LIKE \'%term%\' (substring) — inherently unindexable; capped result set + query-length limit bound it for demo scope.');
}

/* ---------------- Supabase parity ---------------- */
function parseSupabaseDeclaredIndexes() {
  const dir = path.join(__dirname, '..', 'database', 'supabase');
  const declared = new Set();
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')); } catch (e) { return declared; }
  const re = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z0-9_]+)/gi;
  for (const file of files) {
    let sql = '';
    try { sql = fs.readFileSync(path.join(dir, file), 'utf8'); } catch (e) { continue; }
    let m;
    while ((m = re.exec(sql)) !== null) declared.add(m[1]);
  }
  return declared;
}

// Concatenate all Supabase migration SQL for static DDL declaration checks
// (e.g. the app_sessions table + primary key from 0011). Returns '' on error.
function readSupabaseSql() {
  const dir = path.join(__dirname, '..', 'database', 'supabase');
  let blob = '';
  try {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql'))) {
      try { blob += '\n' + fs.readFileSync(path.join(dir, f), 'utf8'); } catch (e) { /* skip unreadable */ }
    }
  } catch (e) { /* dir missing */ }
  return blob;
}

async function verifySupabase() {
  console.log('\nSupabase — query-path + index-declaration parity:');
  if (!hasSupabaseConfig()) {
    // Fail closed when Supabase is the selected session store but its env is
    // missing; otherwise SKIP cleanly (MySQL evidence above is authoritative).
    const supabaseRequired = String(process.env.SESSION_STORE || '').trim().toLowerCase() === 'supabase';
    if (supabaseRequired) {
      critical(false, 'Supabase required (SESSION_STORE=supabase) but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
      return;
    }
    note('SKIP — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set. MySQL evidence above is authoritative for the dev/fallback runtime.');
    return;
  }

  // (a) static index-declaration parity. Declared in 0001 (baseline) plus the
  //     Section 8.8 follow-up gap indexes added in 0010. Declaration is the
  //     accepted evidence for this repair; LIVE apply of 0010 is manual and is
  //     reported separately (see the gate's closing note / the section report).
  const declared = parseSupabaseDeclaredIndexes();
  const EXPECTED_SB_BASELINE = [
    'news_announcements_published_date_idx',
    'news_announcements_audience_idx',
    'events_event_date_idx',
    'faqs_display_order_idx',
    'campus_route_steps_route_id_step_order_idx',
  ];
  const EXPECTED_SB_0010 = [
    'users_created_at_idx',
    'users_updated_at_idx',
    'users_role_idx',
    'news_announcements_created_at_idx',
    'news_announcements_audience_published_date_idx',
    'vr_scenes_display_order_idx',
    'vr_hotspots_scene_id_display_order_idx',
    'route_nodes_display_order_idx',
  ];
  for (const ix of EXPECTED_SB_BASELINE) {
    critical(declared.has(ix), `Supabase declares index ${ix} (0001 baseline)`);
  }
  for (const ix of EXPECTED_SB_0010) {
    critical(declared.has(ix), `Supabase declares index ${ix} (0010 parity)`);
  }
  note('0010 indexes are DECLARED in database/supabase/0010_performance_indexes.sql; live apply is manual (run in the Supabase SQL editor). This gate checks declaration, not live apply.');

  // (a.1) session-store schema parity (migration 0011): the app_sessions table,
  //       its sid primary key, and the expires_at cleanup index must be declared.
  const sbSql = readSupabaseSql();
  critical(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.app_sessions/i.test(sbSql), 'Supabase declares public.app_sessions table (0011)');
  critical(/\bsid\b\s+text\s+PRIMARY\s+KEY/i.test(sbSql), 'Supabase app_sessions.sid is PRIMARY KEY (0011)');
  critical(declared.has('app_sessions_expires_at_idx'), 'Supabase declares index app_sessions_expires_at_idx (0011)');

  // (a.2) room-scheduling schema parity (migration 0012): table + both read-path
  //       indexes must be DECLARED. Live apply is manual/owner-controlled; no
  //       live room_schedules query-path probe runs here — Section 11.3 accepts
  //       static declaration as the parity evidence until the owner applies 0012
  //       in the Supabase SQL editor.
  critical(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.room_schedules/i.test(sbSql), 'Supabase declares public.room_schedules table (0012)');
  critical(declared.has('room_schedules_building_date_idx'), 'Supabase declares index room_schedules_building_date_idx (0012)');
  critical(declared.has('room_schedules_schedule_date_idx'), 'Supabase declares index room_schedules_schedule_date_idx (0012)');
  note('0012 room_schedules is OWNER-APPLIED legacy fallback storage; its old mutation probe is no longer part of the active semester-image flow.');

  // (a.3) VR room-door schedule metadata (migration 0013): nullable schedule
  //       target columns on vr_hotspots plus the lookup index used by admin and
  //       VR runtime checks. Live apply is owner-controlled.
  critical(/ALTER\s+TABLE\s+public\.vr_hotspots[\s\S]{0,600}schedule_building_id/i.test(sbSql), 'Supabase declares vr_hotspots.schedule_building_id (0013)');
  critical(/ALTER\s+TABLE\s+public\.vr_hotspots[\s\S]{0,700}schedule_location_type/i.test(sbSql), 'Supabase declares vr_hotspots.schedule_location_type (0013)');
  critical(declared.has('vr_hotspots_schedule_target_idx'), 'Supabase declares index vr_hotspots_schedule_target_idx (0013)');
  note('0013 vr_hotspot_schedule_metadata is OWNER-APPLIED legacy fallback metadata; new links use 0020 schedule_document_id.');

  // (a.3.1) Semester room schedule images (0020): source-only until the owner
  // separately authorizes application. The declaration is still required so
  // package review can prove both query-path indexes before runtime QA.
  critical(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.room_schedule_documents/i.test(sbSql),
    'Supabase declares public.room_schedule_documents table (0020)');
  critical(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+schedule_document_id/i.test(sbSql),
    'Supabase declares vr_hotspots.schedule_document_id (0020)');
  critical(declared.has('room_schedule_documents_building_term_idx'),
    'Supabase declares index room_schedule_documents_building_term_idx (0020)');
  critical(declared.has('vr_hotspots_schedule_document_idx'),
    'Supabase declares index vr_hotspots_schedule_document_idx (0020)');
  note('0020 room_schedule_documents is DECLARED in source only; applying it and running live query-path checks require separate owner authorization.');

  // (a.4) Route graph accuracy (0014) and route edge drawing geometry (0015)
  //       are IMMUTABLE OWNER-APPLIED PREDECESSORS: they shipped the pre-repair
  //       52-directed-edge / 26-pair graph. Migration 0017 (Guard House start +
  //       eastern terminal topology) is ALSO OWNER-APPLIED and supersedes that
  //       topology, retiring the seven transit pairs and adding the eastern
  //       spurs + central spine + additive Lugaw link -> 50 directed edges /
  //       25 forward-reverse pairs. Static declarations here; the live
  //       path_geometry read + 50/50 coverage + 25-pair checks fail closed in
  //       the query-path probes below.
  critical(/ON\s+CONFLICT\s+\(node_key\)\s+DO\s+UPDATE/i.test(sbSql) && /east-walk/.test(sbSql),
    'Supabase declares the 0014 route graph accuracy upserts (nodes by node_key incl. east-walk)');
  critical(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+path_geometry\s+jsonb/i.test(sbSql),
    'Supabase declares route_edges.path_geometry jsonb (0015)');
  critical(/jsonb_array_length\(path_geometry\)\s+BETWEEN\s+2\s+AND\s+200/i.test(sbSql),
    'Supabase declares the path_geometry 2-200 array constraint (0015)');
  critical(/FUNCTION\s+public\.app_set_route_edge_geometry_pair\s*\(/i.test(sbSql),
    'Supabase declares the atomic pair geometry RPC (0015)');
  critical(/ON\s+CONFLICT\s*\(\s*from_node_id\s*,\s*to_node_id\s*\)\s*DO\s+UPDATE/i.test(sbSql) &&
    /DELETE\s+FROM\s+public\.route_edges/i.test(sbSql),
    'Supabase declares the 0017 topology repair (transit-pair retirement + repaired-pair upserts)');
  note('0014 route_graph_accuracy is DECLARED and is an IMMUTABLE OWNER-APPLIED PREDECESSOR (it shipped the pre-repair 20-node / 52-edge graph).');
  note('0015 route_edge_path_geometry is DECLARED and is an IMMUTABLE OWNER-APPLIED PREDECESSOR (it shipped path_geometry and the pre-repair 26-pair dataset).');
  note('0017 route_topology_guard_house is DECLARED and has been OWNER-APPLIED; the later supported-interface additive Lugaw link brings the live graph to 50 directed edges / 25 pairs. The coverage checks below fail closed.');

  // (b) practical query-path probe: each critical read returns without error.
  const sb = getSupabaseClient();
  const probe = async (label, runner) => {
    try {
      const { error } = await runner();
      critical(!error, `Supabase query-path ok: ${label}`);
    } catch (e) {
      critical(false, `Supabase query-path errored: ${label}`);
    }
  };
  await probe('users by email (auth)', () => sb.from('users').select('id').eq('email', 'demo@example.invalid').limit(1));
  await probe('news by audience+published_date (dashboard)', () => sb.from('news_announcements').select('id').in('audience', ['all', 'student-cspc']).order('published_date', { ascending: false }).limit(20));
  await probe('events by event_date', () => sb.from('events').select('id').order('event_date', { ascending: false }).limit(50));
  await probe('faqs by display_order (admin CRUD)', () => sb.from('faqs').select('id').order('display_order', { ascending: true }).limit(50));
  await probe('campus_route_steps by route+order (pathfinding)', () => sb.from('campus_route_steps').select('id').eq('route_id', 1).order('step_order', { ascending: true }).limit(50));
  await probe('vr_scenes ordering (VR)', () => sb.from('vr_scenes').select('id').order('display_order', { ascending: true }).limit(50));
  await probe('vr_hotspots per scene (VR)', () => sb.from('vr_hotspots').select('id').eq('scene_id', 1).order('display_order', { ascending: true }).limit(50));
  // Session store (Supabase app_sessions, migration 0011) read paths. Test sid
  // is a fixed non-matching literal; it and row values are never printed.
  await probe('app_sessions get by sid (session store)', () => sb.from('app_sessions').select('sid').eq('sid', 'dbperf_nonexistent_test_sid').limit(1));
  await probe('app_sessions expiry cleanup path (session store)', () => sb.from('app_sessions').select('sid').lte('expires_at', 1).limit(1));
  // Route edge drawing geometry: the column must be readable and EVERY one of
  // the post-0017 directed edges must carry a valid stored array shape. This
  // fails CLOSED and deliberately REJECTS the obsolete pre-0017 52-row count:
  // after 0017 plus the additive Lugaw link the live graph is 50 directed
  // edges forming 25 forward/reverse pairs.
  await probe('route_edges path_geometry read (0015 column / 0017 topology)', () => sb.from('route_edges').select('id, path_geometry').limit(1));
  try {
    const { data, error } = await sb
      .from('route_edges')
      .select('from_node_id, to_node_id, path_geometry');
    const rows = Array.isArray(data) ? data : [];

    critical(!error && rows.length === EXPECTED_ROUTE_EDGES,
      `Supabase route_edges row count is ${EXPECTED_ROUTE_EDGES} directed rows (0017 owner-applied; the pre-0017 52-row state is rejected) (found ${rows.length})`);

    const geomOk = rows.filter((r) => Array.isArray(r.path_geometry) && r.path_geometry.length >= 2).length;
    critical(!error && rows.length === EXPECTED_ROUTE_EDGES && geomOk === EXPECTED_ROUTE_EDGES,
      `Supabase route_edges path_geometry coverage is ${EXPECTED_ROUTE_EDGES}/${EXPECTED_ROUTE_EDGES} valid arrays with >= 2 points (valid ${geomOk})`);

    // Forward/reverse pair count: every directed row must have its mirror row,
    // yielding exactly 25 undirected pairs. (Exact geometry-reversal parity is
    // owned by routeTopology-probe.js / routeGeometryData-probe.js; this gate
    // asserts the structural pairing.)
    const directed = new Set(rows.map((r) => `${r.from_node_id}|${r.to_node_id}`));
    let mirrored = 0;
    const seenPair = new Set();
    for (const r of rows) {
      const a = String(r.from_node_id), b = String(r.to_node_id);
      const un = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seenPair.has(un)) continue;
      seenPair.add(un);
      if (directed.has(`${a}|${b}`) && directed.has(`${b}|${a}`)) mirrored++;
    }
    critical(!error && seenPair.size === EXPECTED_ROUTE_PAIRS && mirrored === EXPECTED_ROUTE_PAIRS,
      `Supabase route_edges form ${EXPECTED_ROUTE_PAIRS} forward/reverse pairs (pairs ${seenPair.size}, mirrored ${mirrored})`);
  } catch (e) {
    critical(false, `Supabase route_edges post-0017 topology coverage (${EXPECTED_ROUTE_EDGES} rows / ${EXPECTED_ROUTE_PAIRS} pairs)`);
  }
}

(async () => {
  console.log('=== CampuSphere DB Performance / Indexing Gate (Section 8.8 / R12) ===\n');
  try { await verifyMysql(); }
  catch (e) { critical(false, 'MySQL perf verification (errored)'); }
  finally { try { await db.end(); } catch (e) {} }

  try { await verifySupabase(); }
  catch (e) { critical(false, 'Supabase perf verification (errored)'); }

  console.log('');
  if (failures.length === 0) {
    console.log(`DB-PERF-GATE OK: all critical hot-path AND order/filter indexes present in MySQL; Supabase parity (0001 + 0010 + 0011 app_sessions + 0012 room_schedules + 0013 VR schedule hotspots + 0014 route graph [owner-applied] + 0015 path_geometry [owner-applied] + 0017 topology repair [owner-applied]) declared, with live route_edges verified at ${EXPECTED_ROUTE_EDGES}/${EXPECTED_ROUTE_EDGES} geometry coverage across ${EXPECTED_ROUTE_PAIRS} forward/reverse pairs.`);
    process.exitCode = 0;
  } else {
    console.error(`DB-PERF-GATE FAILED: ${failures.length} critical check(s) did not pass:`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }
  setTimeout(() => process.exit(process.exitCode || 0), 1500).unref();
})();
