'use strict';

/* ========================================
   CampuSphere - scheduleRepository probe
   Milestone 11, Section 11.4 verification script.

   Exercises repositories/scheduleRepository.js end-to-end in BOTH runtime
   modes without starting an Express server:
     1. SCHEDULE_DATA_SOURCE=mysql    — local MySQL (schema.sql room_schedules)
     2. SCHEDULE_DATA_SOURCE=supabase — live Supabase (0012, owner-applied;
        a Supabase failure here is a REAL Section 11.4 blocker, not a skip)

   Per mode: buildingExists true/false, create, findById, filtered list/count,
   countSchedulesByBuilding, invalid-filter non-broadening checks, update,
   update-missing null, delete true, find-after-delete null, delete-again
   false — with exactly one throwaway row, removed in the finally cleanup.

   Throwaway convention: title = 'M11_4_PROBE_<run-id>' on a far-future date;
   cleanup deletes every 'M11_4_PROBE_%' title in both backends and reports
   the leftover count (expected 0).

   Safety:
     - Prints only fixed PASS/FAIL labels, counts, and booleans. No raw rows,
       payloads, secrets, raw DB errors, stacks, URLs, keys, cookies, or
       session IDs are ever printed.
     - Cleanup runs in finally; the MySQL pool is closed at the end
       (await db.end()) so the process exits cleanly.
   ======================================== */

require('dotenv').config();

const db = require('../config/db');
const { getSupabaseClient, hasSupabaseConfig } = require('../config/supabase');
// M12.P1-D4: the canonical "does this row match this search text" predicate,
// used to assert both backends agree with one definition of search truth.
const { matchesScheduleSearch } = require('../utils/scheduleSearch');

const runId = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
const PROBE_TITLE_PREFIX = 'M11_4_PROBE_';
const PROBE_TITLE = (PROBE_TITLE_PREFIX + runId).slice(0, 150);
const PROBE_DATE = '2099-01-15';
const NON_EXISTENT_ID = 999999999;

const failures = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function check(scope, label, ok) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!ok) failures.push(`${scope} :: ${label}`);
}

// Fixed-string error reporting: never prints error content (raw DB/Supabase
// messages could carry internals). The repository already redacts its own
// thrown messages, but the probe stays fixed-label-only regardless.
function checkThrew(scope, label) {
  console.log(`  [FAIL] ${scope} :: ${label} (operation threw)`);
  failures.push(`${scope} :: ${label} (operation threw)`);
}

async function firstBuildingId(mode) {
  if (mode === 'supabase') {
    const sb = getSupabaseClient();
    const { data, error } = await sb
      .from('buildings').select('id').order('id', { ascending: true }).limit(1);
    if (error || !data || data.length === 0) return null;
    return data[0].id;
  }
  const [rows] = await db.query('SELECT id FROM buildings ORDER BY id ASC LIMIT 1');
  return rows.length ? rows[0].id : null;
}

async function cleanupProbeRows(mode) {
  if (mode === 'supabase') {
    const sb = getSupabaseClient();
    await sb.from('room_schedules').delete().like('title', PROBE_TITLE_PREFIX + '%');
    const { count } = await sb
      .from('room_schedules')
      .select('id', { count: 'exact', head: true })
      .like('title', PROBE_TITLE_PREFIX + '%');
    return count || 0;
  }
  await db.query('DELETE FROM room_schedules WHERE title LIKE ?', [PROBE_TITLE_PREFIX + '%']);
  const [rows] = await db.query(
    'SELECT COUNT(*) AS n FROM room_schedules WHERE title LIKE ?',
    [PROBE_TITLE_PREFIX + '%']
  );
  return rows.length ? Number(rows[0].n) : 0;
}

async function runMode(mode) {
  console.log(`\n${mode} mode:`);
  process.env.SCHEDULE_DATA_SOURCE = mode;
  // Required fresh so the repository reads the switched env (the dataSource
  // helper reads process.env per call; the repository module is stateless).
  const repo = require('../repositories/scheduleRepository');

  let createdId = null;
  try {
    const buildingId = await firstBuildingId(mode);
    check(mode, 'a seeded building id is available', Number.isInteger(buildingId) && buildingId > 0);
    if (!Number.isInteger(buildingId) || buildingId <= 0) return;

    check(mode, 'buildingExists(seeded id) -> true', (await repo.buildingExists(buildingId)) === true);
    check(mode, 'buildingExists(non-existent id) -> false', (await repo.buildingExists(NON_EXISTENT_ID)) === false);

    const created = await repo.createSchedule({
      title: PROBE_TITLE,
      schedule_date: PROBE_DATE,
      start_time: '09:00',
      end_time: '10:30',
      audience: 'all',
      status: 'scheduled',
      building_id: buildingId,
      location_type: 'room',
      location_label: 'Probe Room 101',
      floor_label: 'Ground Floor',
      description: 'Section 11.4 repository probe row.',
    });
    createdId = created && created.id;
    check(mode, 'createSchedule returns a positive id', Number.isInteger(createdId) && createdId > 0);
    check(mode, 'created row has stable shape (date/time strings)',
      !!created && created.schedule_date === PROBE_DATE &&
      created.start_time === '09:00' && created.end_time === '10:30');
    check(mode, 'created row carries building_name',
      !!created && typeof created.building_name === 'string' && created.building_name.length > 0);

    const found = await repo.findScheduleById(createdId);
    check(mode, 'findScheduleById returns the created row', !!found && found.id === createdId && found.title === PROBE_TITLE);

    const filters = { buildingId, from: PROBE_DATE, to: PROBE_DATE, status: 'scheduled' };
    const listed = await repo.listSchedules(filters);
    check(mode, 'listSchedules(building+date+status) includes the row',
      Array.isArray(listed) && listed.some((r) => r.id === createdId));
    check(mode, 'countSchedules(same filters) >= 1', (await repo.countSchedules(filters)) >= 1);
    check(mode, 'countSchedulesByBuilding >= 1', (await repo.countSchedulesByBuilding(buildingId)) >= 1);

    // Invalid provided filters must NOT broaden results (empty, not unfiltered).
    check(mode, 'listSchedules({buildingId:"abc"}) -> 0 rows',
      (await repo.listSchedules({ buildingId: 'abc' })).length === 0);
    check(mode, 'listSchedules({from:"not-a-date"}) -> 0 rows',
      (await repo.listSchedules({ from: 'not-a-date' })).length === 0);
    check(mode, 'countSchedules({buildingId:-5}) -> 0',
      (await repo.countSchedules({ buildingId: -5 })) === 0);

    /* ---- M12.P1-D4: the repository layer owns the `q` text-search contract.
       The row created above has title PROBE_TITLE, location label
       "Probe Room 101", floor "Ground Floor", and a known building name. ---- */
    const qBase = { buildingId, from: PROBE_DATE, to: PROBE_DATE };
    const qList = async (q) => repo.listSchedules({ ...qBase, q });
    const qCount = async (q) => repo.countSchedules({ ...qBase, q });

    check(mode, 'q matches the title', (await qList(PROBE_TITLE)).some((r) => r.id === createdId));
    check(mode, 'q matches the location label', (await qList('Probe Room 101')).some((r) => r.id === createdId));
    check(mode, 'q matches the floor label', (await qList('Ground Floor')).some((r) => r.id === createdId));
    check(mode, 'q matches the description', (await qList('repository probe row')).some((r) => r.id === createdId));
    check(mode, 'q matches the building name',
      (await qList(String(created.building_name).slice(0, 8))).some((r) => r.id === createdId));
    check(mode, 'q is case-insensitive', (await qList(PROBE_TITLE.toLowerCase())).some((r) => r.id === createdId));
    check(mode, 'q that matches nothing returns 0 rows and count 0',
      (await qList('zzz-no-such-schedule-text-zzz')).length === 0 &&
      (await qCount('zzz-no-such-schedule-text-zzz')) === 0);
    check(mode, 'blank and whitespace q apply no search',
      (await qList('')).some((r) => r.id === createdId) &&
      (await qList('   ')).some((r) => r.id === createdId));
    check(mode, 'list and count agree under q',
      (await qList(PROBE_TITLE)).length === (await qCount(PROBE_TITLE)));

    // Metacharacters are literal: none of them may broaden the result to the
    // whole filtered window, and none may raise a backend error.
    for (const ch of ['%', '_', '*', '(', ')', ',', '"', '\\']) {
      const rows = await qList(PROBE_TITLE + ch);
      check(mode, `literal ${JSON.stringify(ch)} appended to the title matches nothing`, rows.length === 0);
    }
    // Parity with the canonical predicate: a bare metacharacter must match
    // exactly the rows that genuinely contain it and never act as a wildcard.
    // (The probe's own fixture title contains underscores, so "_" legitimately
    // matches it — the wildcard failure mode is matching the WHOLE window.)
    const windowRows = await repo.listSchedules({ ...qBase, limit: 100 });
    for (const ch of ['%', '_', '*']) {
      const rows = await qList(ch);
      const expected = windowRows.filter((r) => matchesScheduleSearch(r, ch)).length;
      check(mode, `a bare ${JSON.stringify(ch)} is literal, never a wildcard`,
        rows.length === expected && (expected === windowRows.length || rows.length < windowRows.length));
    }
    check(mode, 'a crafted PostgREST breakout matches nothing and never throws',
      (await qList('zzz",id.gte."0')).length === 0);

    // A non-scalar or over-long q is an INVALID filter: empty result, never a
    // silently ignored (and therefore broadened) one.
    check(mode, 'an array q yields an empty result, not an unfiltered one',
      (await qList(['a', 'b'])).length === 0 && (await qCount(['a', 'b'])) === 0);
    check(mode, 'an over-long q yields an empty result',
      (await qList('a'.repeat(101))).length === 0 && (await qCount('a'.repeat(101))) === 0);

    // updated_at must move on update in BOTH modes (MySQL: ON UPDATE
    // CURRENT_TIMESTAMP; Supabase: explicit refresh in the repository, since
    // 0012 has no trigger). Wait past MySQL's 1-second timestamp granularity;
    // raw timestamp values are compared, never printed.
    const createdUpdatedAt = created && created.updated_at;
    await sleep(1200);

    const updated = await repo.updateSchedule(createdId, {
      title: PROBE_TITLE,
      schedule_date: PROBE_DATE,
      start_time: '09:15',
      end_time: '10:45',
      audience: 'student-cspc',
      status: 'cancelled',
      building_id: buildingId,
      location_type: 'facility',
      location_label: 'Probe Facility A',
      floor_label: null,
      description: null,
    });
    check(mode, 'updateSchedule applies changes',
      !!updated && updated.status === 'cancelled' && updated.audience === 'student-cspc' &&
      updated.start_time === '09:15' && updated.location_type === 'facility' &&
      updated.floor_label === null);
    check(mode, 'updateSchedule refreshes updated_at',
      !!updated && typeof updated.updated_at === 'string' && updated.updated_at.length > 0 &&
      typeof createdUpdatedAt === 'string' && updated.updated_at !== createdUpdatedAt);
    check(mode, 'updateSchedule(non-existent id) -> null',
      (await repo.updateSchedule(NON_EXISTENT_ID, {
        title: PROBE_TITLE, schedule_date: PROBE_DATE, start_time: '09:00',
        end_time: '10:00', audience: 'all', status: 'scheduled',
        building_id: buildingId, location_type: 'room', location_label: 'X',
      })) === null);

    check(mode, 'deleteScheduleById -> true', (await repo.deleteScheduleById(createdId)) === true);
    check(mode, 'findScheduleById after delete -> null', (await repo.findScheduleById(createdId)) === null);
    check(mode, 'deleteScheduleById again -> false', (await repo.deleteScheduleById(createdId)) === false);
    createdId = null;
  } catch (e) {
    checkThrew(mode, 'probe sequence completed without throwing');
  } finally {
    try {
      const leftovers = await cleanupProbeRows(mode);
      check(mode, 'cleanup leftover probe rows = 0', leftovers === 0);
    } catch (e) {
      checkThrew(mode, 'cleanup completed');
    }
  }
}

(async () => {
  console.log('=== CampuSphere scheduleRepository probe (Milestone 11, Section 11.4) ===');
  try {
    await runMode('mysql');

    if (!hasSupabaseConfig()) {
      if (process.env.PROBE_SKIP_SUPABASE === '1') {
        // Quality-gates orchestration (Section 11.7): the caller verified no
        // Supabase runtime/session mode is selected, so unconfigured Supabase
        // may skip cleanly here (matching the contract-suite skip policy).
        console.log('\nsupabase mode: SKIP — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (MySQL fallback mode).');
      } else {
        // Standalone runs stay fail-closed: 0012 is owner-applied, so a
        // missing/failing Supabase runtime is a real blocker, not a skip.
        check('supabase', 'Supabase env configured (0012 is owner-applied; required)', false);
      }
    } else {
      await runMode('supabase');
    }
  } finally {
    try { await db.end(); } catch (e) { /* pool already closed */ }
  }

  console.log('');
  if (failures.length === 0) {
    console.log('SCHEDULE-REPOSITORY-PROBE OK: all checks passed (mysql + supabase).');
    process.exitCode = 0;
  } else {
    console.error(`SCHEDULE-REPOSITORY-PROBE FAILED: ${failures.length} check(s) did not pass:`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }
  setTimeout(() => process.exit(process.exitCode || 0), 1500).unref();
})();
