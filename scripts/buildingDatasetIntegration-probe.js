'use strict';

/* ========================================
   CampuSphere - Building dataset integration probe (BE.3 + NO-GO repair)

   Boots through scripts/with-server.js (never a foreground server) across ALL
   FOUR data-source combinations and proves that public and admin surfaces share
   ONE server-computed route-availability truth, and that BUILDING-source and
   ROUTE-source numeric ids are never confused.

   THE DEFECTS THIS LOCKS DOWN
   ---------------------------
   1. MIXED SOURCES. BUILDING_DATA_SOURCE and ROUTE_DATA_SOURCE are independent,
      and numeric ids are BACKEND-LOCAL: the College of Arts and Sciences is a
      different id in each backend. /api/search previously selected BOTH its
      building hits and its route hits with the ROUTE switch, so in a mixed
      configuration it emitted a route-backend id as `building.id` and the browser
      could open the WRONG building.
   2. GUIDED-VR ID. The computed-route panel built /vr/to/:id from `building.id`.
      Guided VR reads the ROUTE source, so it needs route_destination_id.
   3. DUPLICATE NAMES. Availability joins building rows to route rows by canonical
      name. Without collision detection, two same-named buildings both inherit one
      route. Now any collision is `ambiguous_name` with NULL destination/VR ids,
      and admin create/rename returns a sanitized 409.

   Per mode this asserts:
     - exactly 13 buildings, ZERO unavailable in the clean state
     - buildings matched by NORMALIZED NAME, never by numeric id
     - CAS search: building.id belongs to the BUILDING source (it equals the id
       /api/buildings reports) and route_destination_id belongs to the ROUTE source
     - /api/pathfind accepts route_destination_id
     - selecting a search hit resolves the SAME canonical row as /api/buildings
     - computed Set VR Route targets the route-source id, with NO building.id fallback
     - a staged-but-unrouted building stays visible, is marked, and triggers no pathfind
     - admin create/rename canonical collision -> sanitized 409; re-saving a row's
       OWN name is allowed
     - the pure duplicate-name service contract (fixtures, no DB writes)

   Fixtures are created and deleted through the ADMIN HTTP API only — never raw
   SQL, seed data, or a migration — and restored in `finally` with zero leftovers.
   Prints fixed labels only.

   Run:   node scripts/buildingDatasetIntegration-probe.js
   ======================================== */

require('dotenv').config();

const { withServer } = require('./with-server');
const { hasSupabaseConfig } = require('../config/supabase');
const routeAvailability = require('../services/routeAvailability');

// M12.P1-R1: regression identities come from the shared TEST-ONLY loader —
// deterministic local fixtures for the MySQL leg, SUPABASE_REGRESSION_* env
// (fail-closed, never printed) for the Supabase leg. No hardcoded
// live-capable credential remains in this probe.
const { getRegressionCredentials } = require('./regressionCredentials');
// Shared probe session ownership (scripts/probeSessionLifecycle.js): every
// canonical identity authenticated here is terminated through the real logout
// interface so `npm test` leaves no persisted regression session behind.
const { createProbeSessionTracker } = require('./probeSessionLifecycle');

const EXPECTED_BUILDINGS = 13;
const REASONS = ['not_mapped', 'unreachable', 'invalid_geometry', 'ambiguous_name', 'route_data_unavailable'];

const CAS_CANON = 'college of arts and sciences';

const failures = [];
function check(scope, label, ok) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!ok) failures.push(`${scope} :: ${label}`);
}

// The ONE canonical-name contract, shared with the server.
const norm = routeAvailability.canonicalKey;

function cookieJar() {
  const cookies = new Map();
  return {
    apply(res) {
      let list = [];
      if (typeof res.headers.getSetCookie === 'function') list = res.headers.getSetCookie() || [];
      else { const sc = res.headers.get('set-cookie'); if (sc) list = [sc]; }
      for (const sc of list) {
        const pair = String(sc).split(';')[0];
        const eq = pair.indexOf('=');
        if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    },
    header() { return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; '); }
  };
}
function metaCsrf(html) {
  const m = /<meta name="csrf-token" content="([^"]*)"/.exec(html || '');
  return m ? m[1] : '';
}

const LEAK_PATTERNS = [
  ['JWT-like token', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['Supabase host', /[a-z0-9-]+\.supabase\.(co|com|in)/i],
  ['stack frame', /\bat [\w.$<>[\] ]+ \((?:file:\/\/|\/|[A-Za-z]:\\)[^)]*:\d+:\d+\)/],
  ['SQL/driver/PostgREST text', /sqlMessage|SQLSTATE|PostgREST|relation "[^"]+" does not exist/i],
  // Case-SENSITIVE: real MySQL codes are uppercase. A case-insensitive form
  // false-positives on BEM classes (`map-route-planner__toggle` -> `er__toggle`)
  // because this probe scans whole HTML pages.
  ['MySQL driver error code', /\bER_[A-Z]{2,}(?:_[A-Z]+)*\b/],
  ['session cookie value', /campusphere\.sid=/],
  ['Supabase/Cloudinary credential name', /SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|CLOUDINARY_API_KEY|CLOUDINARY_API_SECRET/]
];

function contractOk(b) {
  if (typeof b.route_available !== 'boolean') return false;
  if (!(b.route_destination_id === null || Number.isInteger(Number(b.route_destination_id)))) return false;
  const r = b.route_unavailable_reason;
  if (b.route_available === true) return r === null || r === undefined;
  return REASONS.includes(r);
}

/* ===========================================================================
   PURE duplicate-name service contract. Fixtures only — no database writes.
   Exercises the exact function buildAvailabilityIndex() uses to decide whether a
   canonical name is safe to join.
=========================================================================== */
function verifyDuplicateNameContract() {
  console.log('\nduplicate-name service contract (pure fixtures; no DB writes):');
  const V = routeAvailability.canonicalJoinVerdict;
  const B = (id, name) => ({ id, name });

  // 1:1 -> route-ready, resolves the ROUTE-source id
  let v = V([B(10, 'Green Building')], [B(99, 'Green Building')]);
  check('dup', '1 building + 1 route row -> ok, resolves the ROUTE-source id',
    v.ok === true && v.routeBuildingId === 99);

  // duplicate on the BUILDING side
  v = V([B(10, 'Green Building'), B(11, 'green building')], [B(99, 'Green Building')]);
  check('dup', 'DUPLICATE building rows -> ambiguous_name with NULL destination + VR ids',
    v.ok === false &&
    v.decoration.route_unavailable_reason === 'ambiguous_name' &&
    v.decoration.route_available === false &&
    v.decoration.route_destination_id === null &&
    v.decoration.vr_route_id === null);

  // duplicate on the ROUTE side
  v = V([B(10, 'Green Building')], [B(98, 'Green Building'), B(99, 'Green  Building')]);
  check('dup', 'DUPLICATE route rows -> ambiguous_name with NULL destination + VR ids',
    v.ok === false &&
    v.decoration.route_unavailable_reason === 'ambiguous_name' &&
    v.decoration.route_destination_id === null &&
    v.decoration.vr_route_id === null);

  // no route counterpart
  v = V([B(10, 'Staged Building')], []);
  check('dup', 'building with NO route-source row -> not_mapped with NULL ids',
    v.ok === false &&
    v.decoration.route_unavailable_reason === 'not_mapped' &&
    v.decoration.route_destination_id === null);

  // ZERO building rows + one valid route row. This is the fail-closed gap the
  // narrow cleanup closes: an earlier `bs.length > 1` guard let 0 slip through
  // (0 is not > 1), so a route-source row with NO building-source counterpart
  // resolved as route-ready and handed out a route-source destination id for a
  // name the active building source does not own. Exactly-one on BOTH sides is
  // now required.
  v = V([], [B(99, 'Orphan Route Row')]);
  check('dup', 'ZERO building rows + 1 route row -> ambiguous_name with NULL destination + VR ids',
    v.ok === false &&
    v.decoration.route_available === false &&
    v.decoration.route_unavailable_reason === 'ambiguous_name' &&
    v.decoration.route_destination_id === null &&
    v.decoration.vr_route_id === null);

  // canonical equivalence: punctuation/case/spacing differences still collide
  check('dup', 'canonical key folds case, punctuation and spacing',
    norm('College of Computer Studies (CCS)') === norm('college  of computer-studies  ccs'));
}

/* ===========================================================================
   Per-mode HTTP verification.
=========================================================================== */
async function runMode(scope, base, authSource) {
  // M12.P1-R1: MODES override only BUILDING/ROUTE sources, so each row's BASE
  // mode (passed explicitly as authSource) is this leg's AUTH_DATA_SOURCE.
  const creds = getRegressionCredentials(authSource);
  const ADMIN_EMAIL = creds.admin.email;
  const ADMIN_PASS = creds.admin.password;
  const STUDENT_EMAIL = creds.student.email;
  const STUDENT_PASS = creds.student.password;
  const bodies = [];
  const createdIds = [];
  let adminJar = null;
  let adminCsrf = '';

  async function jfetch(url, options) {
    const res = await fetch(base + url, options);
    const text = await res.text();
    bodies.push(text);
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* HTML */ }
    return { status: res.status, text, json };
  }

  async function login(email, pass) {
    const jar = cookieJar();
    const pre = await fetch(base + '/auth', { headers: { Accept: 'text/html' } });
    jar.apply(pre);
    const csrf0 = metaCsrf(await pre.text());
    const r = await fetch(base + '/login', {
      method: 'POST', redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.header() },
      body: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(pass)}&_csrf=${encodeURIComponent(csrf0)}`
    });
    jar.apply(r);
    return { ok: r.status === 302, jar };
  }

  async function adminPost(body) {
    return jfetch('/admin/api/buildings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminJar.header(), Accept: 'application/json', 'X-CSRF-Token': adminCsrf },
      body: JSON.stringify(body)
    });
  }
  async function adminPut(id, body) {
    return jfetch('/admin/api/buildings/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: adminJar.header(), Accept: 'application/json', 'X-CSRF-Token': adminCsrf },
      body: JSON.stringify(body)
    });
  }

  // One tracker per withServer invocation.
  const sessions = createProbeSessionTracker({
    base,
    record: (label, pass) => check(scope, label, pass),
  });

  /* Outer try: session termination is the OUTERMOST finally — after fixture
     cleanup, even if that cleanup throws, and on every early return below. The
     inner block is intentionally NOT re-indented (minimal diff). */
  try {
  try {
    const student = await login(STUDENT_EMAIL, STUDENT_PASS);
    check(scope, 'student login -> 302', student.ok);
    if (student.ok) sessions.register('student', student.jar, '/dashboard');
    if (!student.ok) return bodies;
    const SH = { Cookie: student.jar.header(), Accept: 'application/json' };
    const SHTML = { Cookie: student.jar.header(), Accept: 'text/html' };

    /* ---- clean-state dataset ---- */
    let r = await jfetch('/api/buildings', { headers: SH });
    const pub = (r.json && r.json.buildings) || [];
    check(scope, `/api/buildings -> ${EXPECTED_BUILDINGS} buildings (found ${pub.length})`,
      r.status === 200 && pub.length === EXPECTED_BUILDINGS);
    check(scope, 'every building carries the additive route contract (typed)',
      pub.length > 0 && pub.every(contractOk));
    check(scope, `ZERO unavailable buildings in the clean state (found ${pub.filter((b) => !b.route_available).length})`,
      pub.filter((b) => !b.route_available).length === 0);
    check(scope, 'no building reports ambiguous_name in the clean state',
      pub.every((b) => b.route_unavailable_reason !== 'ambiguous_name'));

    /* ---- ID SEPARATION: CAS, matched by canonical name (never by id) ---- */
    const casList = pub.find((b) => norm(b.name) === CAS_CANON);
    check(scope, 'CAS resolved from /api/buildings by canonical name', !!casList);
    if (!casList) return bodies;

    r = await jfetch('/api/search?q=' + encodeURIComponent('Arts and Sciences'), { headers: SH });
    const hits = ((r.json && r.json.results) || []).map((x) => x.building).filter(Boolean);
    const casSearch = hits.find((b) => norm(b.name) === CAS_CANON);
    check(scope, 'CAS is returned by /api/search', !!casSearch);
    if (!casSearch) return bodies;
    check(scope, 'search hits carry the same decorated contract', hits.every(contractOk));

    // building.id must belong to the BUILDING source -> it must equal the id that
    // /api/buildings (which reads the BUILDING source) reports for the same
    // canonical row. This is what breaks if search reads the route backend.
    check(scope, 'search building.id belongs to BUILDING_DATA_SOURCE (matches /api/buildings)',
      Number(casSearch.id) === Number(casList.id));
    check(scope, 'selecting the search hit resolves the SAME canonical /api/buildings row',
      norm(casSearch.name) === norm(casList.name) && Number(casSearch.id) === Number(casList.id));

    // route_destination_id must belong to the ROUTE source -> /api/pathfind (route
    // backend) must accept it and land on a real destination.
    const destId = Number(casSearch.route_destination_id);
    check(scope, 'CAS exposes a positive route_destination_id', Number.isInteger(destId) && destId > 0);
    r = await jfetch(`/api/pathfind?start=main-gate&destinationBuildingId=${destId}`, { headers: SH });
    check(scope, 'route_destination_id is accepted by /api/pathfind (ROUTE-source id)',
      r.status === 200 && r.json && r.json.success === true && !!r.json.route &&
      r.json.route.destination && r.json.route.destination.key === 'cas');
    check(scope, 'search route_destination_id matches the /api/buildings route_destination_id',
      Number(casSearch.route_destination_id) === Number(casList.route_destination_id));

    /* ---- computed Set VR Route must use the ROUTE-source id ---- */
    r = await jfetch('/map', { headers: SHTML });
    const mapHtml = r.text || '';
    check(scope, '/map computed VR link uses the validated route-source destination id',
      /function routeDestinationId\(b\)/.test(mapHtml) &&
      /'\/vr\/to\/' \+ destId/.test(mapHtml));
    check(scope, '/map has NO building.id fallback for the computed VR link',
      !/'\/vr\/to\/' \+ b\.id/.test(mapHtml));
    // Regression guard (found by mixed-mode browser check): /api/pathfind must be
    // called with the ROUTE-source id. The Set-as-Destination handler previously
    // rebuilt a bare { id, name } object, dropping route_destination_id, so
    // findComputedRoute silently fell back to the BUILDING-source id.
    check(scope, '/map pathfind uses the validated route-source id with NO building.id fallback',
      /const destId = routeDestinationId\(b\);/.test(mapHtml) &&
      !/route_destination_id != null\) \? b\.route_destination_id : b\.id/.test(mapHtml));
    check(scope, '/map Set-as-Destination forwards route_destination_id to the computed lookup',
      /findComputedRoute\(\{[\s\S]*?route_destination_id: b\.route_destination_id[\s\S]*?\}\)/.test(mapHtml));
    check(scope, '/map keeps the authoritative first-paint index (search cannot overwrite it)',
      !/buildingIndex\.set\(r\.building\.id/.test(mapHtml) &&
      /function selectBuildingFromResult\(/.test(mapHtml));
    check(scope, '/map fails closed when a result is unknown to the authoritative index',
      /const authoritative = buildingIndex\.get\(id\);/.test(mapHtml));

    /* ---- admin ---- */
    const admin = await login(ADMIN_EMAIL, ADMIN_PASS);
    check(scope, 'admin login -> 302', admin.ok);
    if (admin.ok) sessions.register('admin', admin.jar, '/admin/faqs');
    if (!admin.ok) return bodies;
    adminJar = admin.jar;
    const AH = { Cookie: adminJar.header(), Accept: 'application/json' };
    const page = await fetch(base + '/admin/campus-map', { headers: { Cookie: adminJar.header(), Accept: 'text/html' } });
    adminCsrf = metaCsrf(await page.text());

    r = await jfetch('/admin/api/buildings', { headers: AH });
    const adm = (r.json && r.json.buildings) || [];
    check(scope, `GET /admin/api/buildings -> ${EXPECTED_BUILDINGS} rows`,
      r.status === 200 && adm.length === EXPECTED_BUILDINGS);
    check(scope, 'admin rows carry the admin shape + availability fields',
      adm.length > 0 && adm.every((b) => Object.prototype.hasOwnProperty.call(b, 'created_at') && contractOk(b)));
    r = await jfetch('/admin/api/buildings', { headers: SH });
    check(scope, 'student GET /admin/api/buildings -> 403', r.status === 403);

    /* ---- DUPLICATE CANONICAL NAME: admin create/rename -> sanitized 409 ---- */
    const casName = casList.name;
    r = await adminPost({ name: casName, category: 'Academic', description: 'dup probe', lat: 13.406, lng: 123.375 });
    check(scope, 'admin CREATE with a duplicate canonical name -> sanitized 409',
      r.status === 409 && r.json && r.json.success === false &&
      typeof r.json.message === 'string' && !/id|sql|supabase/i.test(r.json.message.replace(/building/gi, '')));

    // punctuation/case variant of an existing name must also collide
    r = await adminPost({ name: 'college of ARTS and sciences', category: 'Academic', description: 'dup probe', lat: 13.406, lng: 123.375 });
    check(scope, 'admin CREATE with a canonical (case/punctuation) variant -> 409', r.status === 409);

    // a genuinely unique staged building is still allowed
    const stagedName = 'ZZ BE3 Unrouted Probe ' + Date.now();
    r = await adminPost({ name: stagedName, category: 'Academic', description: 'staged', lat: 13.4061, lng: 123.3752 });
    const staged = r.json && r.json.building;
    check(scope, 'admin CREATE with a unique name still succeeds (staging preserved)',
      r.status === 200 && !!staged);
    if (!staged) return bodies;
    createdIds.push(staged.id);

    check(scope, 'created row is DECORATED and not route-available (not_mapped)',
      contractOk(staged) && staged.route_available === false && staged.route_unavailable_reason === 'not_mapped');
    // route_destination_id is legitimately NULL in a mixed configuration (the row
    // exists only in the BUILDING source) and legitimately a route-source id in a
    // same-source one (the row IS in the route source, it just has no node). The
    // invariant that matters is that it is never USABLE: the row is not available,
    // and pathfind refuses it either way (asserted below).
    check(scope, 'created row exposes either NULL or a route-source id — never a usable destination',
      staged.route_available === false &&
      (staged.route_destination_id === null || Number.isInteger(Number(staged.route_destination_id))));

    // rename the staged row to an existing canonical name -> 409
    r = await adminPut(staged.id, { name: casName, category: 'Academic', description: 'staged', lat: 13.4061, lng: 123.3752 });
    check(scope, 'admin RENAME onto an existing canonical name -> sanitized 409',
      r.status === 409 && r.json && r.json.success === false);

    // a row may always re-save its OWN name (the edited row is excluded)
    r = await adminPut(staged.id, { name: stagedName, category: 'Academic', description: 'staged v2', lat: 13.4061, lng: 123.3752 });
    check(scope, 'admin may re-save a row with its OWN canonical name (self excluded)',
      r.status === 200 && r.json && r.json.success === true);

    /* ---- staged building stays informational but unusable ---- */
    r = await jfetch('/api/buildings', { headers: SH });
    const pubWith = (r.json && r.json.buildings) || [];
    const pubStaged = pubWith.find((b) => b.name === stagedName);
    check(scope, 'public still SHOWS the staged building (campus information preserved)', !!pubStaged);
    check(scope, 'staged building is marked unavailable (not_mapped)',
      !!pubStaged && pubStaged.route_available === false && pubStaged.route_unavailable_reason === 'not_mapped');
    check(scope, `the ${EXPECTED_BUILDINGS} real destinations remain usable alongside it`,
      pubWith.filter((b) => b.route_available === true).length === EXPECTED_BUILDINGS);

    // Probe the ROUTE-source id when one exists (that is the id pathfind actually
    // consumes); otherwise the building id. Either way it must be refused.
    const stagedProbeId = (pubStaged && pubStaged.route_destination_id != null)
      ? pubStaged.route_destination_id
      : staged.id;
    r = await jfetch(`/api/pathfind?start=main-gate&destinationBuildingId=${stagedProbeId}`, { headers: SH });
    check(scope, 'direct pathfind for the staged building -> sanitized 404 (no usable destination)',
      r.status === 404 && r.json && r.json.success === false);
    r = await jfetch('/api/pathfind?start=main-gate&destinationBuildingId=abc', { headers: SH });
    check(scope, 'malformed pathfind -> sanitized 400', r.status === 400 && r.json && r.json.success === false);
  } finally {
    /* ---- restore every fixture; require zero leftovers ---- */
    if (adminJar) {
      for (const id of createdIds) {
        try {
          await fetch(base + '/admin/api/buildings/' + id, {
            method: 'DELETE',
            headers: { Cookie: adminJar.header(), Accept: 'application/json', 'X-CSRF-Token': adminCsrf }
          });
        } catch (e) { /* reported by the leftover check below */ }
      }
      try {
        const after = await fetch(base + '/admin/api/buildings', {
          headers: { Cookie: adminJar.header(), Accept: 'application/json' }
        });
        const aj = await after.json();
        const rows = (aj && aj.buildings) || [];
        const left = rows.filter((b) => /^ZZ BE3 /.test(String(b.name || ''))).length;
        check(scope, `zero leftover probe fixtures (found ${left})`, left === 0);
        check(scope, `roster restored to exactly ${EXPECTED_BUILDINGS} buildings (found ${rows.length})`,
          rows.length === EXPECTED_BUILDINGS);
      } catch (e) {
        check(scope, 'fixture cleanup verified', false);
      }
    }
  }

  } finally {
    await sessions.terminateAll();
  }

  return bodies;
}

function leakScan(scope, bodies) {
  const blob = (bodies || []).join('\n');
  for (const [label, re] of LEAK_PATTERNS) check(scope, `leak scan: no ${label}`, !re.test(blob));
}

/* ===========================================================================
   All four BUILDING x ROUTE combinations. Numeric ids diverge between backends,
   so the mixed rows are where an id confusion actually bites.
=========================================================================== */
const MODES = [
  { scope: 'B:mysql/R:mysql', base: 'mysql', port: 3372, session: 'mysql', overrides: { BUILDING_DATA_SOURCE: 'mysql', ROUTE_DATA_SOURCE: 'mysql' } },
  { scope: 'B:mysql/R:supabase', base: 'mysql', port: 3373, session: 'mysql', overrides: { BUILDING_DATA_SOURCE: 'mysql', ROUTE_DATA_SOURCE: 'supabase' } },
  { scope: 'B:supabase/R:mysql', base: 'supabase', port: 3374, session: 'supabase', overrides: { BUILDING_DATA_SOURCE: 'supabase', ROUTE_DATA_SOURCE: 'mysql' } },
  { scope: 'B:supabase/R:supabase', base: 'supabase', port: 3375, session: 'supabase', overrides: { BUILDING_DATA_SOURCE: 'supabase', ROUTE_DATA_SOURCE: 'supabase' } }
];

(async () => {
  console.log('=== CampuSphere building dataset integration probe (BE.3 + mixed-source repair) ===');

  verifyDuplicateNameContract();

  const supabaseUsable = hasSupabaseConfig();
  for (const m of MODES) {
    const needsSupabase = m.base === 'supabase' ||
      Object.values(m.overrides).includes('supabase');
    if (needsSupabase && !supabaseUsable) {
      console.log(`\n${m.scope}: SKIP — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set.`);
      continue;
    }
    console.log(`\n${m.scope} (all switches forced; SESSION_STORE=${m.session}):`);
    const bodies = await withServer(
      { mode: m.base, port: m.port, sessionStore: m.session, sourceOverrides: m.overrides },
      (b) => runMode(m.scope, b, m.base)
    );
    leakScan(m.scope, bodies);
  }

  console.log('');
  console.log('NOTE fixtures were created and deleted through the ADMIN HTTP API only —');
  console.log('NOTE never via raw SQL, seed data, or a migration. Zero leftovers verified per mode.');
  if (failures.length === 0) {
    console.log('BUILDING-DATASET-INTEGRATION-PROBE OK: all checks passed.');
    process.exitCode = 0;
  } else {
    console.error(`BUILDING-DATASET-INTEGRATION-PROBE FAILED: ${failures.length} check(s) did not pass:`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }
})();
