'use strict';

/* ========================================
   CampuSphere - Friendly Building Additional-Details Editor probe
   M12.P1-D5 verification script.

   Four layers, all printing fixed sanitized PASS/FAIL labels only — never a
   credential, cookie, token, host, key, raw payload, or database error:

     1. PURE module contracts of public/js/admin/building-details-editor.js:
        CommonJS + single-browser-global loading, null/blank/string/object
        inputs, the complete supported shape, {room,name,use} and legacy
        {num,use} rooms, string and {office,floor} info items, semantic
        round-trip ordering, unknown top-level/nested key preservation,
        img/guestAccess/routes preservation, mixed supported/unsupported
        arrays, unsupported-shape section preservation, malformed/non-object
        roots failing closed, ambiguous room/num items, server-mirrored
        bounds, and __proto__/constructor/prototype inputs without pollution.
     2. STATIC contracts: no raw details JSON textarea in the Building modal,
        dialog semantics, correct script load order, no HTML sinks for
        stored values in the editor, admin-buildings.js integration, and the
        44px / stacking CSS rules.
     3. LIVE dual-backend integration through scripts/with-server.js and the
        shared TEST-ONLY credential loader: create a uniquely prefixed
        building with full structured details plus unknown sentinels, edit it
        with the serialized editor result, verify preservation, verify a
        no-data building stores null details, and delete every fixture in
        finally. The 13 selected-demo buildings are never touched.
     4. Leak scan over every captured response body.

   Run:   node scripts/buildingDetailsEditor-probe.js
   ======================================== */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { withServer } = require('./with-server');
const { hasSupabaseConfig } = require('../config/supabase');
const { getRegressionCredentials } = require('./regressionCredentials');
const {
  buildParticipantDetails,
  withParticipantDetails,
} = require('../utils/buildingParticipantView');
// Shared probe session ownership (scripts/probeSessionLifecycle.js): every
// canonical identity authenticated here is terminated through the real logout
// interface so `npm test` leaves no persisted regression session behind.
const { createProbeSessionTracker } = require('./probeSessionLifecycle');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const RUN_ID = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
const PREFIX = 'ZZ D5 Details Probe ' + RUN_ID;

const failures = [];
function check(scope, label, ok) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!ok) failures.push(`${scope} :: ${label}`);
}

function quiet(fn) {
  try { return { value: fn(), threw: false }; }
  catch (e) { return { value: undefined, threw: true }; }
}

/* Order-insensitive deep equality.

   The EDITOR's own contract preserves key order exactly (asserted in the pure
   layer against its serialized string). STORAGE is a different matter:
   Supabase stores `details` as PostgreSQL `jsonb`, which normalises object key
   order (shorter keys first, then bytewise) and cannot round-trip insertion
   order — while MySQL stores the canonical string verbatim in a TEXT column.
   That divergence is a pre-existing backend characteristic, not something the
   details contract promises, so the live storage assertions compare VALUES
   (every key present with the same value, arrays in order) and the separate
   sentinel checks assert key presence explicitly — a genuinely dropped or
   altered key still fails. */
function deepEqualUnordered(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqualUnordered(a[i], b[i])) return false;
    return true; // array ORDER is part of the contract and is compared strictly
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a).sort();
    const bk = Object.keys(b).sort();
    if (ak.length !== bk.length) return false;
    for (let i = 0; i < ak.length; i++) if (ak[i] !== bk[i]) return false;
    for (let i = 0; i < ak.length; i++) if (!deepEqualUnordered(a[ak[i]], b[ak[i]])) return false;
    return true;
  }
  return false;
}

const HELPER_REL = 'public/js/admin/building-details-editor.js';
let api = null;

/* ============================================================
   1a. module loading contracts
============================================================ */
function runLoadChecks() {
  console.log('\n[load] module loading contracts');
  const globalsBefore = new Set(Object.keys(global));
  api = require(path.join(ROOT, HELPER_REL));
  const leaked = Object.keys(global).filter((k) => !globalsBefore.has(k));
  check('load', 'CommonJS export provides parse/serialize/createEditor/newItems',
    !!api && typeof api.parseDetails === 'function' && typeof api.serializeModel === 'function' &&
    typeof api.createEditor === 'function' && !!api.newItems);
  check('load', 'Node require creates no global',
    leaked.length === 0 && !('CampuSphereBuildingDetailsEditor' in global));

  const src = read(HELPER_REL);
  const win = {};
  const evaluate = quiet(() => { new Function('window', src)(win); return true; });
  const winKeys = Object.keys(win);
  check('load', 'browser evaluation creates exactly window.CampuSphereBuildingDetailsEditor',
    evaluate.threw === false && winKeys.length === 1 && winKeys[0] === 'CampuSphereBuildingDetailsEditor' &&
    typeof win.CampuSphereBuildingDetailsEditor.createEditor === 'function');
  check('load', 'editor source never uses innerHTML/insertAdjacentHTML/document.write for values',
    !/\.innerHTML\s*=/.test(src) && !/insertAdjacentHTML|document\.write/.test(src));
  check('load', 'editor source never logs and never touches window.location',
    !/console\./.test(src) && !/window\.location/.test(src));
  check('load', 'server bounds are mirrored exactly',
    api.LIMITS.MAX_SERIALIZED === 10000 && api.LIMITS.MAX_DEPTH === 8 &&
    api.LIMITS.MAX_NODES === 500 && api.LIMITS.MAX_KEY_LEN === 100 && api.LIMITS.MAX_STRING_LEN === 5000);
}

/* ============================================================
   1b. pure parse/serialize contracts
============================================================ */
function serializeOf(raw) {
  const p = api.parseDetails(raw);
  if (!p.ok) return { parseFailed: true, message: p.message };
  return { parseFailed: false, model: p.model, result: api.serializeModel(p.model) };
}

// Canonical form of a JSON string: parse + re-stringify (preserves key order).
const canon = (s) => JSON.stringify(JSON.parse(s));

function runPureChecks() {
  console.log('\n[pure] parse/serialize preservation contracts');

  // null / blank / undefined inputs -> null details
  for (const [label, input] of [['null', null], ['undefined', undefined], ['empty string', ''], ['whitespace string', '   ']]) {
    const r = serializeOf(input);
    check('pure', `${label} input serializes to null`, !r.parseFailed && r.result.ok && r.result.value === null);
  }

  // string and object inputs are equivalent
  const FULL = {
    guestAccess: false,
    img: '/img/Camarines-sur-polytechnic-colleges.png',
    routes: [{ dest: 'library', time: '4 min' }],
    walkTime: '6-8 minutes from Main Gate',
    landmarks: ['Near the flagpole', 'Beside the covered walk'],
    floors: [
      { label: 'Ground Floor', rooms: [
        { room: 'GF-101', name: 'Programming Lab 1', use: 'Computer Lab' },
        { num: '102', use: 'Classroom' },
        { room: 'GF-103', name: 'Networking Lab', use: 'Computer Lab', capacity: 40 }
      ] },
      { label: '2nd Floor', wing: 'east', rooms: [{ room: '201', name: "Dean's Office", use: 'Administrative' }] }
    ],
    entrances: ['Front entrance facing the main road'],
    info: [
      { office: 'Dean of CCS', floor: '2nd Floor' },
      'Wi-Fi available throughout the building',
      { office: 'Records', floor: 'Ground Floor', hours: '8-5' }
    ],
    zz_sentinel_top: { nested: { keep: ['exactly', 'this'] } }
  };
  const FULL_STR = JSON.stringify(FULL);
  const rStr = serializeOf(FULL_STR);
  const rObj = serializeOf(JSON.parse(FULL_STR));
  check('pure', 'complete supported details round-trip semantically (string input)',
    !rStr.parseFailed && rStr.result.ok && rStr.result.value === canon(FULL_STR));
  check('pure', 'object input round-trips identically to string input',
    !rObj.parseFailed && rObj.result.ok && rObj.result.value === rStr.result.value);
  check('pure', 'top-level key ORDER is preserved on an untouched round trip',
    JSON.stringify(Object.keys(JSON.parse(rStr.result.value))) === JSON.stringify(Object.keys(FULL)));
  check('pure', 'img/guestAccess/routes pass through byte-identically',
    (() => {
      const out = JSON.parse(rStr.result.value);
      return out.img === FULL.img && out.guestAccess === FULL.guestAccess &&
        JSON.stringify(out.routes) === JSON.stringify(FULL.routes);
    })());
  check('pure', 'unknown top-level and unknown nested keys are preserved',
    (() => {
      const out = JSON.parse(rStr.result.value);
      return JSON.stringify(out.zz_sentinel_top) === JSON.stringify(FULL.zz_sentinel_top) &&
        out.floors[0].rooms[2].capacity === 40 && out.floors[1].wing === 'east' &&
        out.info[2].hours === '8-5';
    })());
  check('pure', 'legacy {num,use} room keeps its original identifier key untouched',
    (() => {
      const out = JSON.parse(rStr.result.value);
      const room = out.floors[0].rooms[1];
      return room.num === '102' && !Object.prototype.hasOwnProperty.call(room, 'room') && room.use === 'Classroom';
    })());
  check('pure', 'info strings remain strings and {office,floor} items remain objects',
    (() => {
      const out = JSON.parse(rStr.result.value);
      return typeof out.info[1] === 'string' && typeof out.info[0] === 'object' &&
        out.info[0].office === 'Dean of CCS' && out.info[0].floor === '2nd Floor';
    })());

  // edited round trips
  {
    const p = api.parseDetails(FULL_STR);
    p.model.walkTime.value = '  9 minutes from Main Gate  ';
    const entrance = api.newItems.text();
    entrance.value = '  Rear entrance  ';
    p.model.entrances.items.push(entrance);
    p.model.floors.items[0].rooms[0].name = 'Programming Laboratory 1';
    // Edit the legacy room's id — its ORIGINAL identifier key must survive.
    p.model.floors.items[0].rooms[1].id = '102-B';
    const s = api.serializeModel(p.model);
    const out = s.ok ? JSON.parse(s.value) : {};
    check('pure', 'edited values are trimmed and applied', s.ok &&
      out.walkTime === '9 minutes from Main Gate' &&
      out.entrances[1] === 'Rear entrance' &&
      out.floors[0].rooms[0].name === 'Programming Laboratory 1');
    check('pure', 'an EDITED legacy {num,use} room still keeps the num identifier key',
      s.ok && out.floors[0].rooms[1].num === '102-B' &&
      !Object.prototype.hasOwnProperty.call(out.floors[0].rooms[1], 'room'));
    check('pure', 'unknown nested keys survive the edited round trip',
      s.ok && out.floors[0].rooms[2].capacity === 40 && JSON.stringify(out.zz_sentinel_top) === JSON.stringify(FULL.zz_sentinel_top));
  }

  // new rooms use {room,name,use}; new info honors string vs {office,floor}
  {
    const p = api.parseDetails(null);
    const floor = api.newItems.floor();
    floor.label = 'Ground Floor';
    const room = api.newItems.room();
    room.id = 'GF-1'; room.name = 'Lobby'; room.use = 'Reception';
    floor.rooms.push(room);
    p.model.floors.items.push(floor);
    p.model.floors.present = true;
    const infoPlain = api.newItems.info();
    infoPlain.text = 'Open 8am to 5pm';
    const infoLocated = api.newItems.info();
    infoLocated.text = 'Guidance Office'; infoLocated.floor = '2nd Floor';
    p.model.info.items.push(infoPlain, infoLocated);
    p.model.info.present = true;
    const s = api.serializeModel(p.model);
    const out = s.ok ? JSON.parse(s.value) : {};
    check('pure', 'a new room serializes as {room,name,use}',
      s.ok && JSON.stringify(Object.keys(out.floors[0].rooms[0])) === JSON.stringify(['room', 'name', 'use']));
    check('pure', 'new info without a location is a plain string', s.ok && out.info[0] === 'Open 8am to 5pm');
    check('pure', 'new info with a location is an {office,floor} object',
      s.ok && out.info[1].office === 'Guidance Office' && out.info[1].floor === '2nd Floor');
    check('pure', 'newly added sections append after existing keys in canonical order',
      s.ok && JSON.stringify(Object.keys(out)) === JSON.stringify(['floors', 'info']));
  }

  // blanking the optional info floor removes only the floor key
  {
    const p = api.parseDetails(JSON.stringify({ info: [{ office: 'Registrar', floor: 'GF', code: 7 }] }));
    p.model.info.items[0].floor = '';
    const s = api.serializeModel(p.model);
    const out = s.ok ? JSON.parse(s.value) : {};
    check('pure', 'blanking the optional floor removes only floor and keeps the object shape',
      s.ok && out.info[0].office === 'Registrar' && out.info[0].code === 7 &&
      !Object.prototype.hasOwnProperty.call(out.info[0], 'floor'));
  }

  // explicit removals
  {
    const p = api.parseDetails(JSON.stringify({ entrances: ['A', 'B'], walkTime: '3 min' }));
    p.model.entrances.items.splice(0, 2); // remove both entrances
    p.model.walkTime.value = '   ';       // blank the walk time
    const s = api.serializeModel(p.model);
    const out = s.ok ? JSON.parse(s.value) : {};
    check('pure', 'removing every entrance keeps an explicit empty entrances array',
      s.ok && Array.isArray(out.entrances) && out.entrances.length === 0);
    check('pure', 'a blanked walking time removes the walkTime key',
      s.ok && !Object.prototype.hasOwnProperty.call(out, 'walkTime'));
  }

  // mixed supported/unsupported items keep their positions
  {
    const MIXED = JSON.stringify({ entrances: ['Front', { gate: 2 }, 'Rear'], info: ['a', 42, { office: 'X' }] });
    const r = serializeOf(MIXED);
    check('pure', 'mixed arrays keep unsupported items preserved in position',
      !r.parseFailed && r.result.ok && r.result.value === canon(MIXED));
    const p = api.parseDetails(MIXED);
    check('pure', 'unsupported mixed items classify as preserved rows',
      p.model.entrances.items[1].kind === 'preserved' && p.model.info.items[1].kind === 'preserved');
  }

  // supported top-level key with an unsupported shape -> legacy section preserved
  {
    const LEGACY = JSON.stringify({ walkTime: { min: 5, max: 8 }, floors: 'two storeys', entrances: ['ok'] });
    const p = api.parseDetails(LEGACY);
    check('pure', 'unsupported walkTime/floors shapes classify as legacy sections',
      p.ok && p.model.walkTime.legacy === true && p.model.floors.legacy === true && p.model.entrances.legacy === false);
    const s = api.serializeModel(p.model);
    check('pure', 'legacy sections serialize their original value unchanged',
      s.ok && s.value === canon(LEGACY));
  }

  // malformed / non-object roots fail closed with the ONE fixed message
  for (const [label, input] of [
    ['malformed JSON string', '{broken'],
    ['array root string', '[1,2,3]'],
    ['number root string', '42'],
    ['string root string', '"hello"'],
    ['boolean root string', 'true'],
    ['null-literal-with-content mismatch', '[{"a":1}]'],
    ['numeric raw input', 42],
    ['boolean raw input', true],
  ]) {
    const p = api.parseDetails(input);
    check('pure', `${label} fails closed with the fixed actionable message`,
      p.ok === false && p.message === api.MESSAGES.PARSE_BLOCKED);
  }
  check('pure', 'a blocked model refuses to serialize (never {}/null replacement)',
    (() => {
      const blocked = { blocked: true };
      const s = api.serializeModel(blocked);
      return s.ok === false && s.message === api.MESSAGES.PARSE_BLOCKED;
    })());

  // ambiguous room/num shapes fail closed for that item only
  {
    const AMB = JSON.stringify({ floors: [{ label: 'GF', rooms: [{ room: 'A', num: 'B', use: 'x' }, { room: 'C', num: 'C', use: 'y' }] }] });
    const p = api.parseDetails(AMB);
    check('pure', 'a room with CONFLICTING room/num values is preserved read-only',
      p.ok && p.model.floors.items[0].rooms[0].kind === 'preserved');
    check('pure', 'a room with EQUAL room/num values stays editable with both keys',
      p.ok && p.model.floors.items[0].rooms[1].kind === 'room' &&
      JSON.stringify(p.model.floors.items[0].rooms[1].idKeys) === JSON.stringify(['room', 'num']));
    const s = api.serializeModel(p.model);
    check('pure', 'both ambiguous-item shapes round-trip unchanged', s.ok && s.value === canon(AMB));
  }

  // whitespace-only edits are rejected with field errors
  {
    const p = api.parseDetails(JSON.stringify({ entrances: ['Front'] }));
    p.model.entrances.items[0].value = '   ';
    const s = api.serializeModel(p.model);
    check('pure', 'a blanked existing entrance is rejected (never silently dropped)',
      s.ok === false && s.message === api.MESSAGES.BLANK_ENTRANCE &&
      JSON.stringify(s.path) === JSON.stringify(['entrances', 0, 'text']));
  }
  {
    const p = api.parseDetails(JSON.stringify({ floors: [{ label: 'GF', rooms: [{ room: 'R1', name: 'N', use: 'U' }] }] }));
    p.model.floors.items[0].rooms[0].id = ' ';
    const s = api.serializeModel(p.model);
    check('pure', 'blanking an existing room number/code is rejected',
      s.ok === false && s.message === api.MESSAGES.BLANK_ROOM_ID);
  }
  {
    const p = api.parseDetails(null);
    const fl = api.newItems.floor();
    fl.label = 'GF';
    const rm = api.newItems.room();
    rm.id = 'R1'; rm.name = ''; rm.use = 'U';
    fl.rooms.push(rm);
    p.model.floors.items.push(fl);
    p.model.floors.present = true;
    const s = api.serializeModel(p.model);
    check('pure', 'a NEW room requires a non-blank name', s.ok === false && s.message === api.MESSAGES.BLANK_ROOM_NAME);
  }
  {
    // Legacy {num,use} room: the absent name stays optional and absent.
    const p = api.parseDetails(JSON.stringify({ floors: [{ label: 'GF', rooms: [{ num: '102', use: 'Classroom' }] }] }));
    const s = api.serializeModel(p.model);
    check('pure', 'a legacy room without a name keeps name absent (no forced key)',
      s.ok && !Object.prototype.hasOwnProperty.call(JSON.parse(s.value).floors[0].rooms[0], 'name'));
  }

  // bounds: serialized size, depth, nodes, key length, string length
  {
    const big = { walkTime: 'x'.repeat(4000), entrances: ['y'.repeat(4000), 'z'.repeat(4000)] };
    const p = api.parseDetails(JSON.stringify(big));
    const s = api.serializeModel(p.model);
    check('pure', 'a result beyond 10,000 canonical characters is rejected',
      s.ok === false && s.message === api.MESSAGES.TOO_LARGE);
  }
  {
    let deep = 'x';
    for (let i = 0; i < 9; i++) deep = { d: deep };
    const p = api.parseDetails(JSON.stringify({ zz: deep }));
    const s = p.ok ? api.serializeModel(p.model) : null;
    check('pure', 'depth beyond 8 is rejected', p.ok && s.ok === false && s.message === api.MESSAGES.TOO_DEEP);
  }
  {
    const many = {};
    for (let i = 0; i < 501; i++) many['k' + i] = i;
    const p = api.parseDetails(JSON.stringify({ zz: many }));
    const s = p.ok ? api.serializeModel(p.model) : null;
    check('pure', 'more than 500 nodes is rejected', p.ok && s.ok === false && s.message === api.MESSAGES.TOO_MANY);
  }
  {
    const p = api.parseDetails(JSON.stringify({ ['k'.repeat(101)]: 1 }));
    const s = p.ok ? api.serializeModel(p.model) : null;
    check('pure', 'a key longer than 100 characters is rejected', p.ok && s.ok === false && s.message === api.MESSAGES.KEY_TOO_LONG);
  }
  {
    const p = api.parseDetails(JSON.stringify({ zz: 's'.repeat(5001) }));
    const s = p.ok ? api.serializeModel(p.model) : null;
    check('pure', 'a string longer than 5,000 characters is rejected', p.ok && s.ok === false && s.message === api.MESSAGES.STRING_TOO_LONG);
  }

  // prototype pollution: __proto__ / constructor / prototype stay data
  {
    const HOSTILE = '{"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"alsoPolluted":1}},"prototype":"p","walkTime":"2 min"}';
    const r = serializeOf(HOSTILE);
    check('pure', '__proto__/constructor/prototype keys round-trip as plain data',
      !r.parseFailed && r.result.ok && r.result.value === canon(HOSTILE));
    check('pure', 'Object.prototype was not polluted',
      ({}).polluted === undefined && ({}).alsoPolluted === undefined);
    check('pure', 'the serialized output object has a clean prototype',
      (() => {
        const out = JSON.parse(r.result.value);
        return Object.getPrototypeOf(out) === Object.prototype && out.walkTime === '2 min';
      })());
  }
}

function runParticipantViewChecks() {
  console.log('\n[participant-view] structured display contracts');
  const raw = {
    walkTime: ' 6 minutes from Main Gate ',
    landmarks: [' Flagpole ', '', { unsafe: 'not a scalar landmark' }],
    entrances: [' Main entrance ', null],
    info: [
      ' Wi-Fi available ',
      { office: 'Dean of CCS', floor: '2nd Floor' },
      { label: 'Contact', value: '<script>alert(1)</script>' },
      { hours: '8:00 AM-5:00 PM' },
      { nested: { ignored: true } },
    ],
    floors: [{
      label: 'Ground Floor',
      rooms: [
        { room: 'GF-101', name: 'Programming Lab', use: 'Computer Lab' },
        { num: '102', use: 'Classroom' },
        { name: 'Clinic', use: 'Health service' },
        { unsupported: { ignored: true } },
      ],
    }],
  };
  const before = JSON.stringify(raw);
  const formatted = buildParticipantDetails(raw);
  const wrapped = withParticipantDetails({ id: 9, ...raw });

  check('participant-view', 'walking time, every scalar landmark, and entrances are normalized',
    formatted.keyInformation[0].label === 'Walking time' &&
    formatted.keyInformation[0].value === '6 minutes from Main Gate' &&
    formatted.keyInformation.some((item) => item.label === 'Landmark' && item.value === 'Flagpole') &&
    formatted.entrances.length === 1 && formatted.entrances[0] === 'Main entrance');
  check('participant-view', 'string, office/floor, label/value, and fallback info render without object coercion',
    formatted.keyInformation.some((item) => item.label === '' && item.value === 'Wi-Fi available') &&
    formatted.keyInformation.some((item) => item.label === 'Office' && item.value === 'Dean of CCS — 2nd Floor') &&
    formatted.keyInformation.some((item) => item.label === 'Contact' && item.value === '<script>alert(1)</script>') &&
    formatted.keyInformation.some((item) => item.label === 'Hours' && item.value === '8:00 AM-5:00 PM') &&
    !JSON.stringify(formatted).includes('[object Object]'));
  check('participant-view', 'new and legacy room shapes preserve identifier, name, and use',
    formatted.floors.length === 1 &&
    formatted.floors[0].rooms[0].heading === 'GF-101 — Programming Lab' &&
    formatted.floors[0].rooms[0].use === 'Computer Lab' &&
    formatted.floors[0].rooms[1].heading === '102' &&
    formatted.floors[0].rooms[1].use === 'Classroom' &&
    formatted.floors[0].rooms[2].heading === 'Clinic');
  check('participant-view', 'empty or unsupported nested shapes are omitted',
    formatted.floors[0].rooms.length === 3 &&
    !formatted.keyInformation.some((item) => item.label === 'Nested'));
  check('participant-view', 'formatting is non-mutating and attaches only the display model',
    JSON.stringify(raw) === before && wrapped.id === 9 &&
    wrapped.participantDetails.floors[0].rooms[0].heading === 'GF-101 — Programming Lab');
}

/* ============================================================
   2. static view/script/CSS contracts
============================================================ */
function runStaticChecks() {
  console.log('\n[static] view, integration, and CSS contracts');
  const view = read('views/admin/campus-map.ejs');
  const client = read('public/js/admin/admin-buildings.js');
  const css = read('public/css/admin-styles.css');
  const participantView = read('views/buildings.ejs');
  const aboutView = read('views/about.ejs');
  const controller = read('controllers/buildingsController.js');

  check('static', 'the Building modal has NO raw details JSON textarea',
    !/<textarea[^>]*name="details"/.test(view) && !/Additional Details \(JSON\)/.test(view));
  check('static', 'the structured editor container and live status region exist',
    view.indexOf('id="building-details-editor"') !== -1 &&
    /id="building-details-status"[^>]*aria-live="polite"/.test(view));
  check('static', 'the Building modal declares dialog semantics',
    /id="building-modal"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="building-modal-title"/.test(view));
  check('static', 'the Building modal close button is accessible',
    /building-modal[\s\S]{0,600}<button type="button" class="modal-close-btn[^>]*aria-label="Close"/.test(view));
  check('static', 'building-details-editor.js loads BEFORE admin-buildings.js',
    view.indexOf('/js/admin/building-details-editor.js') !== -1 &&
    view.indexOf('/js/admin/building-details-editor.js') < view.indexOf('/js/admin/admin-buildings.js'));

  check('static', 'admin-buildings.js no longer reads a raw details field',
    client.indexOf('form.details') === -1 && client.indexOf('buildingForm.details') === -1);
  check('static', 'admin-buildings.js mounts one editor via createEditor and clears it on create',
    /window\.CampuSphereBuildingDetailsEditor/.test(client) &&
    /\.createEditor\(\s*\{\s*root/.test(client) &&
    client.indexOf('detailsEditor.clear()') !== -1);
  // M12.P1-D5 corrective: fail-closed availability contract is present in the
  // shipped integration (the behavior is proven live by runIntegrationChecks).
  check('static', 'admin-buildings.js declares the fixed unavailable message and a callable-interface guard',
    /Additional details editor is unavailable\. Reload the page and try again\./.test(client) &&
    client.indexOf('editorInterfaceValid') !== -1 && client.indexOf('markDetailsEditorUnavailable') !== -1);
  check('static', 'submit aborts before any request when the editor is unavailable (no implicit null fallback)',
    /if\s*\(\s*detailsEditorUnavailable\s*\|\|\s*!detailsEditor\s*\)/.test(client) &&
    client.indexOf('DETAILS_EDITOR_UNAVAILABLE_MSG') !== -1);
  check('static', 'the Building modal has a Tab focus-containment handler',
    /e\.key\s*!==\s*'Tab'/.test(client) && client.indexOf('buildingModalFocusables') !== -1 &&
    /buildingModal\.contains\(active\)/.test(client));
  check('static', 'edit loads the raw stored details through the editor',
    client.indexOf('detailsEditor.load(b.details') !== -1);
  check('static', 'submit sends the serialized editor result as data.details',
    client.indexOf('detailsEditor.serialize()') !== -1 && /details:\s*detailsValue/.test(client));
  check('static', 'a blocked or invalid editor aborts the submit and focuses the first error',
    client.indexOf('detailsEditor.isBlocked()') !== -1 && client.indexOf('detailsEditor.focusFirstError()') !== -1);

  check('static', 'the Building modal is widened via a scoped rule',
    /#building-modal \.modal-box--building\s*\{[^}]*max-width:\s*720px/.test(css) &&
    /modal-box modal-box--building/.test(view));
  check('static', 'editor rows stack at 640px with 44px minimum targets',
    /@media \(max-width: 640px\)[\s\S]{0,600}\.bde-row--room\s*\{[\s\S]{0,200}grid-template-columns:\s*1fr/.test(css) &&
    /\.bde-input,[\s\S]{0,60}\.bde-add,[\s\S]{0,60}\.bde-remove\s*\{[\s\S]{0,80}min-height:\s*44px/.test(css));
  check('static', 'editor controls have visible keyboard focus rules',
    /\.bde-input:focus-visible/.test(css) && /outline:\s*2px solid/.test(css));
  check('static', 'participant HTML receives a display-only view model while the JSON API keeps its raw shape',
    /buildings:\s*decorated\.buildings\.map\(withParticipantDetails\)/.test(controller) &&
    /res\.json\(\{\s*success:\s*true,\s*buildings:\s*decorated\.buildings\s*\}\)/.test(controller));
  check('static', 'participant rendering consumes the display model and escapes every rendered value',
    participantView.indexOf('participantDetails.keyInformation') !== -1 &&
    participantView.indexOf('participantDetails.entrances') !== -1 &&
    participantView.indexOf('details.floors') !== -1 &&
    participantView.indexOf('escapeHtml(i.value)') !== -1 &&
    participantView.indexOf('escapeHtml(r.heading)') !== -1 &&
    participantView.indexOf('escapeHtml(i)') === -1 &&
    participantView.indexOf('escapeHtml(r.num)') === -1);
  check('static', 'building details labels floor tabs and room listings accurately',
    /floor-panel__label">Floors &amp; Rooms<\//.test(participantView) &&
    participantView.indexOf("textContent = 'Floors & Rooms'") !== -1 &&
    participantView.indexOf('No floor or room information available.') !== -1 &&
    participantView.indexOf('floor.label + \' — Rooms & Facilities\'') !== -1 &&
    /explore floors and rooms/i.test(participantView));
  check('static', 'public building copy does not claim the room listings are architectural floor plans',
    !/floor-panel__label">Floor Plan<\//.test(participantView) &&
    !/No floor plan available\./.test(participantView) &&
    !/Room Layout/.test(participantView) &&
    /floor and room\s+information/i.test(aboutView));
}

/* ============================================================
   2b. integration checks — run the REAL admin-buildings.js under a tiny
       deterministic fake DOM (no dependency) to prove fail-closed editor
       initialization, zero-fetch submits when unavailable, and Building
       modal focus containment. This executes the shipped integration code
       (public/js/admin/admin-buildings.js) inside a VM context; it is not a
       regex check or a re-implementation of its logic.
============================================================ */

// Fixed fail-closed message the corrective pass must show.
const UNAVAILABLE_MSG = 'Additional details editor is unavailable. Reload the page and try again.';

// Minimal building-modal DOM mirroring views/admin/campus-map.ejs (only the
// ids/controls admin-buildings.js touches).
const INTEGRATION_PAGE_HTML =
  '<div id="buildings-data-json">[]</div>' +
  '<input id="building-search-input" type="text">' +
  '<div id="bld-cat-filter-menu"></div>' +
  '<button id="bld-cat-filter-btn"><span>All</span></button>' +
  '<button id="add-building-btn">Add</button>' +
  '<div id="buildings-grid"></div>' +
  '<div id="admin-toast"></div>' +
  '<div id="building-modal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="building-modal-title">' +
    '<div class="modal-box modal-box--building">' +
      '<div class="modal-header">' +
        '<h3 id="building-modal-title">Add New Building</h3>' +
        '<button type="button" class="modal-close-btn" aria-label="Close">x</button>' +
      '</div>' +
      '<form id="building-form">' +
        '<div class="modal-body">' +
          '<div class="form-error"></div>' +
          '<input type="text" name="building_name" id="building-name">' +
          '<select name="category" id="building-category"></select>' +
          '<textarea name="description" id="building-desc"></textarea>' +
          '<input type="number" name="lat" id="building-lat">' +
          '<input type="number" name="lng" id="building-lng">' +
          '<div id="building-details-editor" class="bde"></div>' +
          '<p id="building-details-status" class="admin-result-status" role="status" aria-live="polite"></p>' +
          '<input type="text" name="image_url" id="building-image-url">' +
          '<input type="text" name="cloudinary_public_id" id="building-cloudinary-id">' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button type="button" class="modal-close-btn">Cancel</button>' +
          '<button id="building-submit-btn" type="submit">Add Building</button>' +
        '</div>' +
      '</form>' +
    '</div>' +
  '</div>' +
  '<div id="delete-building-modal" class="modal-backdrop">' +
    '<div class="modal-box">' +
      '<button class="modal-close-btn">x</button>' +
      '<span id="delete-building-name"></span>' +
      '<button id="cancel-building-delete-btn">Cancel</button>' +
      '<button id="confirm-building-delete-btn">Delete</button>' +
    '</div>' +
  '</div>';

// ---- tiny DOM ----
function fakeEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function selMatchOne(el, part) {
  const re = /([a-zA-Z][\w-]*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\]/g;
  let m; let matched = false;
  while ((m = re.exec(part)) !== null) {
    matched = true;
    if (m[1]) { if (el.tagName !== m[1].toUpperCase()) return false; }
    else if (m[2]) { if (el.getAttribute('id') !== m[2]) return false; }
    else if (m[3]) { if (!el.classList.contains(m[3])) return false; }
    else if (m[4]) {
      if (!el.hasAttribute(m[4])) return false;
      if (m[5] !== undefined && el.getAttribute(m[4]) !== m[5]) return false;
    }
  }
  return matched;
}
function selMatch(el, sel) {
  return String(sel).split(',').map((s) => s.trim()).filter(Boolean).some((p) => selMatchOne(el, p));
}
function makeClassList() {
  const set = new Set();
  return {
    add() { for (const c of arguments) if (c) String(c).split(/\s+/).forEach((x) => x && set.add(x)); },
    remove() { for (const c of arguments) if (c) String(c).split(/\s+/).forEach((x) => set.delete(x)); },
    contains(c) { return set.has(c); },
    get value() { return [...set].join(' '); },
    set value(v) { set.clear(); String(v || '').split(/\s+/).filter(Boolean).forEach((x) => set.add(x)); },
  };
}
function FakeEl(doc, tag) {
  const el = {
    nodeType: 1, tagName: String(tag).toUpperCase(), childNodes: [], parentNode: null,
    _attrs: new Map(), _text: '', _listeners: new Map(), classList: makeClassList(),
    style: {}, disabled: false, hidden: false, _doc: doc,
  };
  el.dataset = new Proxy({}, {
    get(_t, k) { return typeof k === 'string' ? el._attrs.get('data-' + k.replace(/[A-Z]/g, (x) => '-' + x.toLowerCase())) : undefined; },
    set(_t, k, v) { el._attrs.set('data-' + k.replace(/[A-Z]/g, (x) => '-' + x.toLowerCase()), String(v)); return true; },
    has(_t, k) { return el._attrs.has('data-' + String(k).replace(/[A-Z]/g, (x) => '-' + x.toLowerCase())); },
  });
  Object.defineProperties(el, {
    parentElement: { get() { return el.parentNode && el.parentNode.nodeType === 1 ? el.parentNode : null; } },
    children: { get() { return el.childNodes.filter((n) => n.nodeType === 1); } },
    firstChild: { get() { return el.childNodes[0] || null; } },
    className: { get() { return el.classList.value; }, set(v) { el.classList.value = v; } },
    id: { get() { return el._attrs.get('id') || ''; }, set(v) { el._attrs.set('id', String(v)); } },
    type: { get() { return el._attrs.get('type') || ''; }, set(v) { el._attrs.set('type', String(v)); } },
    value: { get() { return el._attrs.has('value') ? el._attrs.get('value') : ''; }, set(v) { el._attrs.set('value', v == null ? '' : String(v)); } },
    textContent: {
      get() { return el.childNodes.length ? el.childNodes.map((n) => (n.nodeType === 1 ? n.textContent : n.data)).join('') : el._text; },
      set(v) { el.childNodes = []; el._text = v == null ? '' : String(v); doc._reindex(); },
    },
    innerHTML: {
      get() { return el.childNodes.length ? el.childNodes.map((n) => (n.nodeType === 1 ? n.outerHTML : fakeEscape(n.data))).join('') : fakeEscape(el._text); },
      set(html) { el.childNodes = []; el._text = ''; for (const c of parseFakeHtml(doc, String(html))) el.appendChild(c); doc._reindex(); },
    },
    outerHTML: {
      get() {
        const a = [...el._attrs.entries()].map(([k, v]) => ` ${k}="${fakeEscape(v)}"`).join('');
        return `<${el.tagName.toLowerCase()}${a}>${el.innerHTML}</${el.tagName.toLowerCase()}>`;
      },
    },
  });
  el.getAttribute = (n) => (el._attrs.has(n) ? el._attrs.get(n) : null);
  el.setAttribute = (n, v) => { el._attrs.set(n, String(v)); if (n === 'class') el.classList.value = String(v); if (n === 'hidden') el.hidden = true; };
  el.removeAttribute = (n) => { el._attrs.delete(n); if (n === 'hidden') el.hidden = false; };
  el.hasAttribute = (n) => el._attrs.has(n);
  el.appendChild = (node) => {
    node.parentNode = el; el.childNodes.push(node);
    if (el.tagName === 'FORM' && node.nodeType === 1) doc._indexForm(el);
    doc._reindex(); return node;
  };
  el.removeChild = (node) => { const i = el.childNodes.indexOf(node); if (i !== -1) el.childNodes.splice(i, 1); node.parentNode = null; doc._reindex(); return node; };
  el.remove = () => { if (el.parentNode) el.parentNode.removeChild(el); };
  el.replaceChild = (next, prev) => { const i = el.childNodes.indexOf(prev); if (i !== -1) { el.childNodes[i] = next; next.parentNode = el; prev.parentNode = null; } doc._reindex(); return prev; };
  el.getClientRects = () => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (n.hidden === true) return [];
      if (n.style && (n.style.display === 'none' || n.style.visibility === 'hidden')) return [];
    }
    return [{ width: 10, height: 10 }];
  };
  el.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 });
  el.focus = () => { doc.activeElement = el; };
  el.blur = () => { if (doc.activeElement === el) doc.activeElement = doc.body; };
  el.contains = (node) => { for (let n = node; n; n = n.parentNode) if (n === el) return true; return false; };
  el.addEventListener = (t, fn) => { if (!el._listeners.has(t)) el._listeners.set(t, []); el._listeners.get(t).push(fn); };
  el.removeEventListener = (t, fn) => { const l = el._listeners.get(t); if (l) { const i = l.indexOf(fn); if (i !== -1) l.splice(i, 1); } };
  el.dispatchEvent = (ev) => {
    ev.target = ev.target || el;
    let node = el;
    while (node) {
      const l = node._listeners && node._listeners.get(ev.type);
      if (l) for (const fn of [...l]) { if (ev._stopped) break; fn.call(node, ev); }
      if (ev._stopped) break;
      node = node.parentNode;
    }
    if (!ev._stopped) { const l = doc._listeners.get(ev.type); if (l) for (const fn of [...l]) fn.call(doc, ev); }
    return !ev.defaultPrevented;
  };
  el.cloneNode = () => { const c = FakeEl(doc, el.tagName); for (const [k, v] of el._attrs) c._attrs.set(k, v); c.classList.value = el.classList.value; c._text = el._text; c.disabled = el.disabled; c.hidden = el.hidden; return c; };
  el.closest = (sel) => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) if (selMatch(n, sel)) return n; return null; };
  el.querySelector = (sel) => { const r = el.querySelectorAll(sel); return r.length ? r[0] : null; };
  el.querySelectorAll = (sel) => {
    const out = [];
    (function walk(node) { for (const c of node.childNodes) { if (c.nodeType !== 1) continue; if (selMatch(c, sel)) out.push(c); walk(c); } })(el);
    return out;
  };
  return el;
}
function parseFakeHtml(doc, html) {
  const roots = []; const stack = [];
  const tokens = html.match(/<[^>]+>|[^<]+/g) || [];
  for (const t of tokens) {
    if (t[0] === '<') {
      if (t[1] === '/') { stack.pop(); continue; }
      const tag = /^<\s*([a-zA-Z][\w-]*)/.exec(t); if (!tag) continue;
      const el = FakeEl(doc, tag[1]);
      const attrRe = /([\w:-]+)\s*=\s*"([^"]*)"/g; let a;
      while ((a = attrRe.exec(t)) !== null) el.setAttribute(a[1], a[2]);
      if (el.hasAttribute('class')) el.classList.value = el.getAttribute('class');
      const parent = stack[stack.length - 1];
      if (parent) { parent.childNodes.push(el); el.parentNode = parent; } else roots.push(el);
      if (!/\/>$/.test(t)) stack.push(el);
    } else {
      const parent = stack[stack.length - 1];
      if (parent) { const tn = { nodeType: 3, data: t, parentNode: parent }; parent.childNodes.push(tn); }
    }
  }
  return roots;
}
function makeFakeDocument() {
  const doc = { nodeType: 9, _listeners: new Map(), _byId: new Map(), activeElement: null };
  // Define document methods BEFORE building the tree: appendChild calls
  // doc._reindex(), so it must already exist.
  doc._reindex = () => {
    doc._byId = new Map();
    (function walk(n) { for (const c of n.childNodes) { if (c.nodeType !== 1) continue; const id = c.getAttribute('id'); if (id && !doc._byId.has(id)) doc._byId.set(id, c); walk(c); } })(doc.documentElement);
  };
  doc._indexForm = (form) => {
    for (const input of form.querySelectorAll('input, select, textarea')) {
      const name = input.getAttribute('name');
      if (name && !Object.prototype.hasOwnProperty.call(form, name)) {
        Object.defineProperty(form, name, { value: input, enumerable: false, configurable: true });
      }
    }
    if (!form.reset) form.reset = () => { for (const i of form.querySelectorAll('input, select, textarea')) i.value = ''; };
  };
  doc.documentElement = FakeEl(doc, 'html');
  doc.body = FakeEl(doc, 'body');
  doc.documentElement.appendChild(doc.body);
  doc.activeElement = doc.body;
  doc.createElement = (tag) => FakeEl(doc, tag);
  doc.getElementById = (id) => doc._byId.get(id) || null;
  doc.querySelector = (sel) => doc.documentElement.querySelector(sel);
  doc.querySelectorAll = (sel) => doc.documentElement.querySelectorAll(sel);
  doc.addEventListener = (t, fn) => { if (!doc._listeners.has(t)) doc._listeners.set(t, []); doc._listeners.get(t).push(fn); };
  doc.dispatchEvent = (ev) => { const l = doc._listeners.get(ev.type); if (l) for (const fn of [...l]) fn.call(doc, ev); return !ev.defaultPrevented; };
  return doc;
}
function fakeEvent(type, init) {
  return Object.assign({ type, defaultPrevented: false, _stopped: false, target: null, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this._stopped = true; } }, init || {});
}

// Boot the REAL admin-buildings.js against a fresh fake DOM. `cfg.helper`
// selects the editor-global scenario; `cfg.throwOn` makes one editor method
// throw; `cfg.buildings` seeds the grid; `cfg.serializeResult` overrides the
// serialize() return.
function bootIntegration(cfg) {
  const o = cfg || {};
  const doc = makeFakeDocument();
  doc.body.innerHTML = INTEGRATION_PAGE_HTML;
  doc._reindex();
  const form = doc.getElementById('building-form');
  if (form) doc._indexForm(form);
  const seed = o.buildings || [];
  doc.getElementById('buildings-data-json').textContent = JSON.stringify(seed);

  const requests = [];
  const editorCalls = [];
  const makeEditor = () => {
    const guard = (name, impl) => () => {
      editorCalls.push(name);
      if (o.throwOn === name) throw new Error('editor method failure');
      return impl ? impl() : undefined;
    };
    return {
      clear: guard('clear'), load: guard('load', () => true), reset: guard('reset'),
      isBlocked: guard('isBlocked', () => o.blocked === true),
      serialize: guard('serialize', () => (o.serializeResult !== undefined ? o.serializeResult : { ok: true, value: null })),
      focusFirstError: guard('focusFirstError', () => true), getModel: guard('getModel', () => ({})),
    };
  };
  let helper;
  if (o.helper === 'missing') helper = undefined;
  else if (o.helper === 'throws') helper = { createEditor() { throw new Error('constructor failure'); } };
  else if (o.helper === 'invalid') helper = { createEditor() { return { clear() {}, load() {} }; } };
  else if (o.helper === 'null-instance') helper = { createEditor() { return null; } };
  else if (o.helper === 'not-callable') helper = { createEditor: 'nope' };
  else helper = { createEditor: makeEditor };

  const timers = [];
  // Record every console call so a test can prove no raw exception/value is
  // ever logged when the integration fails closed.
  const consoleCalls = [];
  const recordConsole = (level) => (...args) => {
    consoleCalls.push(level + ' ' + args.map((a) => {
      try { return typeof a === 'string' ? a : (a && a.message) ? a.message : JSON.stringify(a); }
      catch (e) { return String(a); }
    }).join(' '));
  };
  const sandbox = {
    document: doc, JSON, Math, Date, Array, Object, String, Number, Set, Promise, parseInt, parseFloat,
    console: { log: recordConsole('log'), warn: recordConsole('warn'), error: recordConsole('error') },
    CustomEvent: function CustomEvent(type, init) { return fakeEvent(type, init); },
    setTimeout(fn) { timers.push(fn); return timers.length; },
    clearTimeout() {},
    async fetch(url, options) {
      const method = (options && options.method) || 'GET';
      requests.push({ method, url: String(url) });
      const body = { success: true, building: { id: 999, name: 'x', category: 'Academic', lat: 1, lng: 2 }, buildings: seed };
      return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  if (helper !== undefined) sandbox.CampuSphereBuildingDetailsEditor = helper;

  const ctx = vm.createContext(sandbox);
  vm.runInContext(read('public/js/admin/admin-buildings.js'), ctx, { filename: 'admin-buildings.js' });
  doc.dispatchEvent(fakeEvent('DOMContentLoaded'));
  const flush = () => { while (timers.length) timers.shift()(); };
  flush();

  return {
    doc, requests, flush,
    click(el) { el.dispatchEvent(fakeEvent('click', { target: el })); flush(); },
    submit() { doc.getElementById('building-form').dispatchEvent(fakeEvent('submit', { target: doc.getElementById('building-form') })); flush(); },
    keydown(key, shift) { const ev = fakeEvent('keydown', { key, shiftKey: !!shift }); doc.dispatchEvent(ev); return ev; },
    statusText() { return doc.getElementById('building-details-status').textContent || ''; },
    saveDisabled() { return doc.getElementById('building-submit-btn').disabled === true; },
    mutations() { return requests.filter((r) => ['POST', 'PUT', 'DELETE'].includes(r.method) && /\/admin\/api\/buildings/.test(r.url)); },
    formError() { const m = doc.getElementById('building-modal'); const el = m && m.querySelector('.form-error'); return el ? (el.textContent || '') : ''; },
    consoleOutput() { return consoleCalls.join('\n'); },
  };
}

function fillValidForm(h) {
  const f = h.doc.getElementById('building-form');
  f.building_name.value = 'ZZ Integration (never sent live)';
  f.category.value = 'Academic';
  f.lat.value = '13.4';
  f.lng.value = '123.3';
}

function runIntegrationChecks() {
  console.log('\n[integration] fail-closed editor + focus containment (real admin-buildings.js under a fake DOM)');

  // Sanity: the harness actually executes the shipped integration (a normal
  // editor mounts, Save enabled, a create POST proceeds). If this fails the
  // negative cases below would be meaningless.
  {
    const h = bootIntegration({ serializeResult: { ok: true, value: '{"walkTime":"5 min"}' } });
    h.click(h.doc.getElementById('add-building-btn'));
    const enabled = !h.saveDisabled();
    fillValidForm(h);
    h.submit();
    const m = h.mutations();
    check('integration', 'harness runs the real integration: normal editor keeps Save enabled and a create POST proceeds',
      enabled === true && m.length === 1 && m[0].method === 'POST');
  }

  // Unavailable scenarios: fixed message shown, Save disabled.
  const unavailableCfgs = [
    ['missing helper global', { helper: 'missing' }],
    ['createEditor() throws', { helper: 'throws' }],
    ['createEditor() returns an incomplete interface', { helper: 'invalid' }],
    ['createEditor() returns null', { helper: 'null-instance' }],
    ['createEditor is not callable', { helper: 'not-callable' }],
  ];
  for (const [label, cfg] of unavailableCfgs) {
    const h = bootIntegration(cfg);
    h.click(h.doc.getElementById('add-building-btn'));
    check('integration', `${label}: fixed message shown and Save disabled`,
      h.saveDisabled() === true && h.statusText() === UNAVAILABLE_MSG);
  }

  // An editor method that throws AFTER a valid mount fails closed too.
  for (const method of ['clear', 'load', 'isBlocked', 'serialize']) {
    const seed = [{ id: 5, name: 'ZZ Seed', category: 'Academic', description: 'd', lat: 13.4, lng: 123.3, details: '{"walkTime":"5 min"}' }];
    const h = bootIntegration({ throwOn: method, buildings: seed });
    if (method === 'clear') h.click(h.doc.getElementById('add-building-btn'));
    else h.click(h.doc.querySelectorAll('.btn-edit-building')[0]);
    fillValidForm(h);
    h.submit();
    check('integration', `${method}() throwing fails closed: Save disabled, zero building mutations`,
      h.saveDisabled() === true && h.mutations().length === 0);
  }

  // Create submit while unavailable -> zero building mutation requests.
  {
    const h = bootIntegration({ helper: 'missing' });
    h.click(h.doc.getElementById('add-building-btn'));
    fillValidForm(h);
    h.submit();
    check('integration', 'CREATE submit while unavailable issues zero POST/PUT/DELETE building requests', h.mutations().length === 0);
    check('integration', 'CREATE submit while unavailable re-shows the fixed message', h.statusText() === UNAVAILABLE_MSG);
  }

  // Edit submit while unavailable -> zero requests, so stored details cannot be
  // replaced with null.
  {
    const seed = [{ id: 9, name: 'ZZ Seed Edit', category: 'Academic', description: 'd', lat: 13.4, lng: 123.3, details: '{"walkTime":"5 min","entrances":["Front"]}' }];
    const h = bootIntegration({ helper: 'throws', buildings: seed });
    h.click(h.doc.querySelectorAll('.btn-edit-building')[0]);
    fillValidForm(h);
    h.submit();
    check('integration', 'EDIT submit while unavailable issues zero building requests (stored details cannot be nulled)', h.mutations().length === 0);
  }

  // focusFirstError() THROWS after an invalid serialize(): the editor mounts
  // normally, serialize() reports invalid input, and focusFirstError() then
  // throws. The integration must fail closed to the fixed unavailable state
  // (not swallow the exception), issue no request, and never log the raw error.
  // CREATE (no existing details).
  {
    const h = bootIntegration({ serializeResult: { ok: false, message: 'Additional details are invalid.' }, throwOn: 'focusFirstError' });
    h.click(h.doc.getElementById('add-building-btn'));
    check('integration', 'CREATE: mounted editor keeps Save enabled before submit', h.saveDisabled() === false);
    fillValidForm(h);
    h.submit();
    check('integration', 'CREATE + invalid serialize + focusFirstError throws: fixed unavailable status shown',
      h.statusText() === UNAVAILABLE_MSG);
    check('integration', 'CREATE + focusFirstError throws: modal error region shows the same fixed message (validation message not retained)',
      h.formError() === UNAVAILABLE_MSG);
    check('integration', 'CREATE + focusFirstError throws: Save disabled', h.saveDisabled() === true);
    check('integration', 'CREATE + focusFirstError throws: zero POST/PUT/DELETE building requests', h.mutations().length === 0);
    check('integration', 'CREATE + focusFirstError throws: the raw exception is never logged',
      h.consoleOutput().indexOf('editor method failure') === -1);
  }
  // EDIT (seeded building with existing details): the stored details cannot be
  // replaced or nulled because no request is ever built.
  {
    const seed = [{ id: 11, name: 'ZZ Seed FFE', category: 'Academic', description: 'd', lat: 13.4, lng: 123.3, details: '{"walkTime":"5 min","entrances":["Front"],"landmarks":["Flagpole"]}' }];
    const h = bootIntegration({ serializeResult: { ok: false, message: 'Additional details are invalid.' }, throwOn: 'focusFirstError', buildings: seed });
    h.click(h.doc.querySelectorAll('.btn-edit-building')[0]);
    fillValidForm(h);
    h.submit();
    check('integration', 'EDIT + invalid serialize + focusFirstError throws: fixed unavailable status shown',
      h.statusText() === UNAVAILABLE_MSG);
    check('integration', 'EDIT + focusFirstError throws: modal error region shows the same fixed message',
      h.formError() === UNAVAILABLE_MSG);
    check('integration', 'EDIT + focusFirstError throws: Save disabled', h.saveDisabled() === true);
    check('integration', 'EDIT + focusFirstError throws: zero building requests (existing details cannot be replaced or nulled)',
      h.mutations().length === 0);
    check('integration', 'EDIT + focusFirstError throws: the raw exception is never logged',
      h.consoleOutput().indexOf('editor method failure') === -1);
  }

  // Focus containment for the Building modal.
  {
    const h = bootIntegration({});
    h.click(h.doc.getElementById('add-building-btn'));
    const modal = h.doc.getElementById('building-modal');
    const focusable = modal.querySelectorAll('a, button, input, select, textarea').filter((n) => !n.disabled);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    last.focus();
    const e1 = h.keydown('Tab', false);
    check('integration', 'Tab from the last focusable wraps to the first (preventDefault)',
      e1.defaultPrevented === true && h.doc.activeElement === first);
    first.focus();
    const e2 = h.keydown('Tab', true);
    check('integration', 'Shift+Tab from the first focusable wraps to the last (preventDefault)',
      e2.defaultPrevented === true && h.doc.activeElement === last);
    if (focusable.length > 2) {
      focusable[1].focus();
      const e3 = h.keydown('Tab', false);
      check('integration', 'Tab in the middle of the sequence is not preventDefaulted', e3.defaultPrevented === false);
    }
  }

  // Disabled + hidden controls are excluded from the focus cycle.
  {
    const h = bootIntegration({ helper: 'missing' }); // Save is disabled here
    h.click(h.doc.getElementById('add-building-btn'));
    const modal = h.doc.getElementById('building-modal');
    const submit = h.doc.getElementById('building-submit-btn');
    // Hide one input to prove non-rendered controls are excluded.
    const hiddenInput = h.doc.getElementById('building-cloudinary-id');
    hiddenInput.style.display = 'none';
    const focusable = modal.querySelectorAll('a, button, input, select, textarea')
      .filter((n) => !n.disabled && !(n.style && n.style.display === 'none'));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    last.focus();
    const e1 = h.keydown('Tab', false);
    check('integration', 'disabled Save is excluded from the focus trap and Tab still wraps',
      submit.disabled === true && e1.defaultPrevented === true && h.doc.activeElement === first);
    hiddenInput.focus(); // hidden control should never be a wrap boundary
    const e2 = h.keydown('Tab', false);
    check('integration', 'a display:none control is excluded from the focus set',
      h.doc.getElementById('building-cloudinary-id').getClientRects().length === 0 && e2 !== null);
  }

  // Escape closes the modal and returns focus to the opener.
  {
    const h = bootIntegration({});
    const addBtn = h.doc.getElementById('add-building-btn');
    addBtn.focus(); // becomes lastFocused (the opener)
    h.click(addBtn);
    const modal = h.doc.getElementById('building-modal');
    check('integration', 'Building modal opens (modal--open) on Add', modal.classList.contains('modal--open') === true);
    h.keydown('Escape', false);
    check('integration', 'Escape closes the Building modal', modal.classList.contains('modal--open') === false);
    check('integration', 'focus returns to the opener after Escape', h.doc.activeElement === addBtn);
  }
}

/* ============================================================
   3. live dual-backend integration
============================================================ */
function cookieJar() {
  const jar = new Map();
  return {
    apply(res) {
      let list = [];
      if (typeof res.headers.getSetCookie === 'function') list = res.headers.getSetCookie() || [];
      else { const sc = res.headers.get('set-cookie'); if (sc) list = [sc]; }
      for (const sc of list) {
        const pair = String(sc).split(';')[0];
        const eq = pair.indexOf('=');
        if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    },
    header() { return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; '); },
  };
}

function participantBuildingsFromHtml(html) {
  const match = /<script[^>]*id="buildingsData"[^>]*>([\s\S]*?)<\/script>/.exec(html || '');
  if (!match) return null;
  try {
    const rows = JSON.parse(match[1]);
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

const metaCsrf = (html) => {
  const m = /<meta name="csrf-token" content="([^"]*)"/.exec(html || '');
  return m ? m[1] : '';
};

const LEAK_PATTERNS = [
  ['JWT-like token', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ['Supabase host', /[a-z0-9-]+\.supabase\.(co|com|in)/i],
  ['stack frame', /\bat [\w.$<>[\] ]+ \((?:file:\/\/|\/|[A-Za-z]:\\)[^)]*:\d+:\d+\)/],
  ['SQL/driver/PostgREST text', /sqlMessage|SQLSTATE|PostgREST|relation "[^"]+" does not exist|syntax error at or near/i],
  ['MySQL driver error code', /\bER_[A-Z]{2,}(?:_[A-Z]+)*\b/],
  ['session cookie value', /campusphere\.sid=/],
  ['credential name', /SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|CLOUDINARY_API_KEY|CLOUDINARY_API_SECRET/],
];

async function runLiveMode(mode, base) {
  const creds = getRegressionCredentials(mode);
  const bodies = [];
  const jar = cookieJar();
  const createdIds = [];
  let csrf = '';
  let loginOk = false;
  let baselineCount = null;

  const jfetch = async (url, options) => {
    const res = await fetch(base + url, options);
    const text = await res.text();
    bodies.push(text);
    let json = null; try { json = JSON.parse(text); } catch (e) { /* HTML */ }
    return { status: res.status, json };
  };

  // One tracker per withServer/runLiveMode invocation. It replaces this probe's
  // former bespoke logout (which retried once on a first 403); the shared
  // lifecycle instead reads a STABLE token via bounded safe GETs and never
  // retries the logout mutation.
  const sessions = createProbeSessionTracker({
    base,
    record: (label, pass) => check(mode, label, pass),
  });

  /* Outer try: session termination is the OUTERMOST finally — after the
     fixture cleanup below, even if that cleanup throws, and on every early
     return. Intentionally NOT re-indented (minimal diff). */
  try {
  try {
    let r = await fetch(base + '/auth', { headers: { Accept: 'text/html' } });
    jar.apply(r);
    const loginTok = metaCsrf(await r.text());
    r = await fetch(base + '/login', {
      method: 'POST', redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar.header() },
      body: `email=${encodeURIComponent(creds.admin.email)}&password=${encodeURIComponent(creds.admin.password)}&_csrf=${encodeURIComponent(loginTok)}`,
    });
    jar.apply(r);
    loginOk = r.status === 302;
    check(mode, 'admin login -> 302', loginOk);
    if (loginOk) sessions.register('admin', jar, '/admin/faqs');
    if (!loginOk) return bodies;

    // Stable admin CSRF token (two consecutive equal reads).
    let prev = null;
    for (let i = 0; i < 6; i++) {
      const pr = await fetch(base + '/admin/campus-map', { headers: { Accept: 'text/html', Cookie: jar.header() } });
      jar.apply(pr);
      const t = metaCsrf(await pr.text());
      if (t && t === prev) { csrf = t; break; }
      prev = t;
    }
    check(mode, 'admin CSRF token available', csrf.length > 0);
    const H = { 'Content-Type': 'application/json', Accept: 'application/json', Cookie: jar.header(), 'X-CSRF-Token': csrf };
    const GET = { Accept: 'application/json', Cookie: jar.header() };

    const before = await jfetch('/admin/api/buildings', { headers: GET });
    const beforeRows = (before.json && before.json.buildings) || [];
    baselineCount = beforeRows.length;
    check(mode, 'complete pre-fixture building roster is available',
      before.status === 200 && baselineCount > 0);

    // ---- create with full structured details + unknown sentinels ----
    const DETAILS = {
      guestAccess: true,
      img: '/img/Camarines-sur-polytechnic-colleges.png',
      routes: [],
      walkTime: '5 minutes from Main Gate',
      landmarks: ['Probe landmark'],
      floors: [{ label: 'Ground Floor', rooms: [
        { room: 'P-101', name: 'Probe Lab', use: 'Laboratory' },
        { num: 'P-102', use: 'Classroom' }
      ] }],
      entrances: ['Probe front entrance'],
      info: [{ office: 'Probe Office', floor: 'Ground Floor' }, 'Probe plain note'],
      zz_probe_sentinel: { keep: ['unknown', 'key'], n: 7 }
    };
    r = await jfetch('/admin/api/buildings', {
      method: 'POST', headers: H,
      body: JSON.stringify({
        name: PREFIX + ' Alpha', category: 'Academic', description: 'D5 probe fixture',
        lat: 13.4061, lng: 123.3751, details: JSON.stringify(DETAILS),
      }),
    });
    const created = r.json && r.json.building;
    check(mode, 'create with structured details -> success', r.status === 200 && !!created && r.json.success === true);
    if (!created) return bodies;
    createdIds.push(created.id);

    // Stored details must parse to the exact submitted structure.
    const storedRaw = created.details;
    const storedObj = typeof storedRaw === 'string' ? JSON.parse(storedRaw) : storedRaw;
    check(mode, 'stored details preserve every submitted key and value',
      deepEqualUnordered(storedObj, DETAILS));
    check(mode, 'the unknown sentinel key is stored with its exact value',
      !!storedObj && Object.prototype.hasOwnProperty.call(storedObj, 'zz_probe_sentinel') &&
      deepEqualUnordered(storedObj.zz_probe_sentinel, DETAILS.zz_probe_sentinel));

    // ---- edit through the REAL editor pure layer ----
    const parsed = api.parseDetails(storedRaw);
    check(mode, 'the editor parses the stored details without blocking', parsed.ok === true);
    if (parsed.ok) {
      parsed.model.walkTime.value = '7 minutes from Main Gate';
      const newEntrance = api.newItems.text();
      newEntrance.value = 'Probe rear entrance';
      parsed.model.entrances.items.push(newEntrance);
      parsed.model.floors.items[0].rooms[0].name = 'Probe Lab (Renovated)';
      const ser = api.serializeModel(parsed.model);
      check(mode, 'the edited model serializes cleanly', ser.ok === true);

      r = await jfetch('/admin/api/buildings/' + created.id, {
        method: 'PUT', headers: H,
        body: JSON.stringify({
          name: PREFIX + ' Alpha', category: 'Academic', description: 'D5 probe fixture',
          lat: 13.4061, lng: 123.3751, details: ser.ok ? ser.value : null,
        }),
      });
      const updated = r.json && r.json.building;
      check(mode, 'edit with the serialized editor result -> success', r.status === 200 && !!updated);
      const updObj = updated && (typeof updated.details === 'string' ? JSON.parse(updated.details) : updated.details);
      check(mode, 'supported edits applied (walkTime, entrance, room name)',
        !!updObj && updObj.walkTime === '7 minutes from Main Gate' &&
        updObj.entrances.length === 2 && updObj.entrances[1] === 'Probe rear entrance' &&
        updObj.floors[0].rooms[0].name === 'Probe Lab (Renovated)');
      check(mode, 'the unknown sentinel key survived the edit round trip',
        !!updObj && Object.prototype.hasOwnProperty.call(updObj, 'zz_probe_sentinel') &&
        deepEqualUnordered(updObj.zz_probe_sentinel, DETAILS.zz_probe_sentinel));
      check(mode, 'the legacy {num,use} room kept its identifier key through the edit',
        !!updObj && updObj.floors[0].rooms[1].num === 'P-102' &&
        !Object.prototype.hasOwnProperty.call(updObj.floors[0].rooms[1], 'room'));
      check(mode, 'img/guestAccess/routes survived the edit round trip',
        !!updObj && updObj.img === DETAILS.img && updObj.guestAccess === true &&
        JSON.stringify(updObj.routes) === JSON.stringify(DETAILS.routes));

      const participantResponse = await fetch(base + '/buildings', {
        headers: { Accept: 'text/html', Cookie: jar.header() },
      });
      const participantHtml = await participantResponse.text();
      bodies.push(participantHtml);
      const participantRows = participantBuildingsFromHtml(participantHtml);
      const participantBuilding = participantRows &&
        participantRows.find((building) => building.name === PREFIX + ' Alpha');
      const participantDetails = participantBuilding && participantBuilding.participantDetails;
      const participantInfo = participantDetails && participantDetails.keyInformation;
      const participantRooms = participantDetails && participantDetails.floors &&
        participantDetails.floors[0] && participantDetails.floors[0].rooms;
      check(mode, 'participant page exposes the complete safe structured-details view model',
        participantResponse.status === 200 && !!participantBuilding &&
        Array.isArray(participantInfo) &&
        participantInfo.some((item) => item.label === 'Walking time' && item.value === '7 minutes from Main Gate') &&
        participantInfo.some((item) => item.label === 'Landmark' && item.value === 'Probe landmark') &&
        participantInfo.some((item) => item.label === 'Office' && item.value === 'Probe Office — Ground Floor') &&
        Array.isArray(participantDetails.entrances) &&
        participantDetails.entrances.includes('Probe rear entrance') &&
        Array.isArray(participantRooms) &&
        participantRooms.some((room) => room.heading === 'P-101 — Probe Lab (Renovated)' && room.use === 'Laboratory') &&
        participantRooms.some((room) => room.heading === 'P-102' && room.use === 'Classroom'));
      check(mode, 'participant view model contains no object-coercion artifact',
        !!participantDetails && !JSON.stringify(participantDetails).includes('[object Object]'));
    }

    // ---- a no-data building stores null details ----
    r = await jfetch('/admin/api/buildings', {
      method: 'POST', headers: H,
      body: JSON.stringify({
        name: PREFIX + ' Beta', category: 'Facilities', description: 'D5 probe no-details fixture',
        lat: 13.4062, lng: 123.3752, details: null,
      }),
    });
    const bare = r.json && r.json.building;
    check(mode, 'create with null details -> success', r.status === 200 && !!bare);
    if (bare) {
      createdIds.push(bare.id);
      check(mode, 'a no-data building stores null details', bare.details === null || bare.details === undefined);
    }
  } finally {
    for (const id of createdIds) {
      try {
        await fetch(base + '/admin/api/buildings/' + id, {
          method: 'DELETE', headers: { Accept: 'application/json', 'X-CSRF-Token': csrf, Cookie: jar.header() },
        });
      } catch (e) { /* reported by the leftover check */ }
    }
    try {
      const after = await fetch(base + '/admin/api/buildings', { headers: { Accept: 'application/json', Cookie: jar.header() } });
      const aj = await after.json();
      const rows = (aj && aj.buildings) || [];
      const left = rows.filter((b) => String(b.name || '').indexOf('ZZ D5 Details Probe') === 0).length;
      check(mode, `zero leftover D5 fixtures (found ${left})`, left === 0);
      check(mode, `roster restored to the ${baselineCount} pre-fixture buildings (found ${rows.length})`,
        baselineCount !== null && rows.length === baselineCount);
    } catch (e) {
      check(mode, 'fixture cleanup verified', false);
    }

    // Authenticated-session hygiene now lives in the shared lifecycle helper
    // (see the outer finally): it reads a STABLE token through bounded safe
    // GETs, performs exactly ONE logout mutation with no retry, and proves the
    // former cookie is rejected afterwards.
  }

  } finally {
    await sessions.terminateAll();
  }
  return bodies;
}

function leakScan(mode, bodies) {
  const blob = (bodies || []).join('\n');
  for (const [label, re] of LEAK_PATTERNS) check(mode, `leak scan: no ${label}`, !re.test(blob));
}

/* ============================================================ main */
(async () => {
  console.log('=== CampuSphere Friendly Building Details Editor probe (M12.P1-D5) ===');

  runLoadChecks();
  runPureChecks();
  runParticipantViewChecks();
  runStaticChecks();
  runIntegrationChecks();

  console.log('\nmysql mode:');
  const mysqlBodies = await withServer({ mode: 'mysql', port: 3496, sessionStore: 'mysql' }, (base) => runLiveMode('mysql', base));
  leakScan('mysql', mysqlBodies || []);

  if (process.env.PROBE_SKIP_SUPABASE === '1' && !hasSupabaseConfig()) {
    console.log('\nsupabase mode: SKIP — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (MySQL fallback mode).');
  } else {
    console.log('\nsupabase mode:');
    const sbBodies = await withServer({ mode: 'supabase', port: 3497, sessionStore: 'supabase' }, (base) => runLiveMode('supabase', base));
    leakScan('supabase', sbBodies || []);
  }

  console.log('');
  console.log('NOTE fixtures were created and deleted through the ADMIN HTTP API only; the pre-existing building catalog was never modified.');
  if (failures.length === 0) {
    console.log('BUILDING-DETAILS-EDITOR-PROBE OK: all checks passed.');
    process.exitCode = 0;
  } else {
    console.error(`BUILDING-DETAILS-EDITOR-PROBE FAILED: ${failures.length} check(s) did not pass:`);
    failures.forEach((f) => console.error('  - ' + f));
    process.exitCode = 1;
  }
})().catch(() => {
  console.error('BUILDING-DETAILS-EDITOR-PROBE FAILED: sanitized harness failure.');
  process.exitCode = 1;
});
