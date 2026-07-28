/* ========================================
   CampuSphere — Admin Schedule Controller
   Milestone 11, Section 11.5 — CRUD API for room_schedules
   ======================================== */

const scheduleRepository = require('../repositories/scheduleRepository');
const auditService = require('../services/auditService');
const V = require('../utils/adminValidation');
// M12.P1-D4: bounded free-text search normalisation (scalar/trim/length).
const { normalizeSearchQuery } = require('../utils/scheduleSearch');

// Allowlists fixed by the domain contract (docs/room-scheduling-domain-contract.md).
// audience mirrors ALLOWED_AUDIENCES in adminContentController.js exactly.
const ALLOWED_AUDIENCES = ['all', 'student-cspc', 'instructor', 'guest', 'admin'];
const ALLOWED_STATUSES = ['scheduled', 'cancelled', 'completed'];
const ALLOWED_LOCATION_TYPES = ['room', 'facility'];
const SCHEDULE_KEYS = [
  'title', 'schedule_date', 'start_time', 'end_time', 'audience', 'status',
  'building_id', 'location_type', 'location_label', 'floor_label', 'description',
];
const TITLE_MAX = 150;
const LOCATION_LABEL_MAX = 120;
const FLOOR_LABEL_MAX = 80;
const DESCRIPTION_MAX = 1000;

// List-query bounds from the domain contract: bounded windows only, default
// Asia/Manila today through the next 14 days inclusive, max 90-day span.
const DEFAULT_WINDOW_DAYS = 14;
const MAX_WINDOW_DAYS = 90;
const LIMIT_MIN = 1;
const LIMIT_MAX = 100;
const LIMIT_DEFAULT = 50;
const OFFSET_MIN = 0;
const OFFSET_MAX = 10000;
const OFFSET_DEFAULT = 0;

// Best-effort audit of a successful admin mutation. Fire-and-forget: it never
// throws, never blocks, and never changes the JSON response. Mirrors the
// helper in adminBuildingsController.js.
function auditAdminMutation(req, action, targetType, targetId, message) {
  const actor = (req.session && req.session.user) || {};
  auditService.record({
    event_type: 'admin_mutation',
    action,
    outcome: 'success',
    actor_user_id: actor.id,
    actor_role: actor.role,
    target_type: targetType,
    target_id: targetId,
    message
  }).catch(() => {});
}

/* ---------------- date-window helpers (Asia/Manila wall clock) ---------------- */

// Today's date in the campus-local (Asia/Manila) wall clock as YYYY-MM-DD.
// en-CA formats as YYYY-MM-DD directly.
function manilaTodayYmd() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function addDaysYmd(ymd, days) {
  const dt = new Date(Date.UTC(
    Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10))
  ));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// Whole days from `from` to `to` (0 when equal, negative when inverted).
function ymdDiffDays(from, to) {
  const f = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const t = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((t - f) / 86400000);
}

/* ---------------- validation ---------------- */

// Strict positive integer for building_id body values (accepts number or
// canonical digit string; rejects signs, blanks, fractions, unsafe sizes).
function parsePositiveInt(raw) {
  if (typeof raw === 'number') {
    return Number.isSafeInteger(raw) && raw >= 1 ? raw : null;
  }
  return V.parseRouteId(raw);
}

/**
 * Validate + normalize a schedule create/update body. Returns { ok, value }
 * with the exact writable field set (floor_label/description null when
 * blank), or { ok:false, message }. No DB work, no extras.
 */
function validateSchedulePayload(body) {
  const shape = V.validateBody(body, SCHEDULE_KEYS);
  if (!shape.ok) return shape;

  const title = V.requiredString(body.title, 'Title', TITLE_MAX);
  if (!title.ok) return title;

  const date = V.validateYmdDate(body.schedule_date, 'Schedule date');
  if (!date.ok) return date;

  const range = V.validateTimeRange(body.start_time, body.end_time);
  if (!range.ok) return range;

  const audience = V.allowedValue(body.audience, 'audience', ALLOWED_AUDIENCES);
  if (!audience.ok) return audience;

  const status = V.allowedValue(body.status, 'status', ALLOWED_STATUSES);
  if (!status.ok) return status;

  const buildingId = parsePositiveInt(body.building_id);
  if (buildingId === null) {
    return { ok: false, message: 'Invalid building id.' };
  }

  const locationType = V.allowedValue(body.location_type, 'location type', ALLOWED_LOCATION_TYPES);
  if (!locationType.ok) return locationType;

  const locationLabel = V.requiredString(body.location_label, 'Location label', LOCATION_LABEL_MAX);
  if (!locationLabel.ok) return locationLabel;

  const floorLabel = V.optionalString(body.floor_label, 'Floor label', FLOOR_LABEL_MAX);
  if (!floorLabel.ok) return floorLabel;

  const description = V.optionalString(body.description, 'Description', DESCRIPTION_MAX);
  if (!description.ok) return description;

  return {
    ok: true,
    value: {
      title: title.value,
      schedule_date: date.value,
      start_time: range.value.start,
      end_time: range.value.end,
      audience: audience.value,
      status: status.value,
      building_id: buildingId,
      location_type: locationType.value,
      location_label: locationLabel.value,
      floor_label: floorLabel.value === '' ? null : floorLabel.value,
      description: description.value === '' ? null : description.value,
    },
  };
}

/**
 * Validate list-query params. Blank building/audience/status mean "no
 * filter"; anything provided is validated strictly. Returns { ok, value }
 * with normalized { buildingId, from, to, audience, status, limit, offset }
 * or { ok:false, message }.
 */
function validateListQuery(query) {
  const q = query || {};
  const out = {};

  // M12.P1-D4: optional bounded text search. A repeated `?q=a&q=b` arrives as
  // an array and an overlong value is rejected — both with a fixed sanitized
  // message that never echoes the submitted text.
  const search = normalizeSearchQuery(q.q);
  if (!search.ok) return search;
  out.q = search.value;

  if (q.buildingId !== undefined && String(q.buildingId).trim() !== '') {
    const n = parsePositiveInt(String(q.buildingId).trim());
    if (n === null) return { ok: false, message: 'Invalid building id.' };
    out.buildingId = n;
  }

  let from;
  if (q.from !== undefined && String(q.from).trim() !== '') {
    const v = V.validateYmdDate(String(q.from), 'From date');
    if (!v.ok) return v;
    from = v.value;
  } else {
    from = manilaTodayYmd();
  }

  let to;
  if (q.to !== undefined && String(q.to).trim() !== '') {
    const v = V.validateYmdDate(String(q.to), 'To date');
    if (!v.ok) return v;
    to = v.value;
  } else {
    to = addDaysYmd(from, DEFAULT_WINDOW_DAYS);
  }

  const span = ymdDiffDays(from, to);
  if (span < 0) {
    return { ok: false, message: 'Invalid date range: the end date is before the start date.' };
  }
  if (span + 1 > MAX_WINDOW_DAYS) {
    return { ok: false, message: `Date range is too wide (maximum ${MAX_WINDOW_DAYS} days).` };
  }
  out.from = from;
  out.to = to;

  if (q.audience !== undefined && String(q.audience).trim() !== '') {
    const v = V.allowedValue(String(q.audience), 'audience', ALLOWED_AUDIENCES);
    if (!v.ok) return v;
    out.audience = v.value;
  }

  if (q.status !== undefined && String(q.status).trim() !== '') {
    const v = V.allowedValue(String(q.status), 'status', ALLOWED_STATUSES);
    if (!v.ok) return v;
    out.status = v.value;
  }

  if (q.limit !== undefined && String(q.limit).trim() !== '') {
    const n = parsePositiveInt(String(q.limit).trim());
    if (n === null || n < LIMIT_MIN || n > LIMIT_MAX) {
      return { ok: false, message: 'Invalid limit.' };
    }
    out.limit = n;
  } else {
    out.limit = LIMIT_DEFAULT;
  }

  if (q.offset !== undefined && String(q.offset).trim() !== '') {
    const s = String(q.offset).trim();
    const n = s === '0' ? 0 : parsePositiveInt(s);
    if (n === null || n < OFFSET_MIN || n > OFFSET_MAX) {
      return { ok: false, message: 'Invalid offset.' };
    }
    out.offset = n;
  } else {
    out.offset = OFFSET_DEFAULT;
  }

  return { ok: true, value: out };
}

/* ---------------- handlers ---------------- */

/**
 * GET /admin/api/schedules — bounded, filtered list.
 * Response: { success:true, schedules, total, appliedFilters }.
 *
 * M12.P1-D4: `appliedFilters` is ADDITIVE — existing consumers keep reading
 * `schedules` and `total` unchanged. It echoes the filters the server actually
 * applied (notably the resolved default Asia/Manila date window) so the client
 * can display the effective range instead of guessing it. `total` counts every
 * active filter, including the text search.
 */
exports.listSchedules = async (req, res) => {
  const check = validateListQuery(req.query);
  if (!check.ok) {
    return res.status(400).json({ success: false, message: check.message });
  }
  try {
    const f = check.value;
    const schedules = await scheduleRepository.listSchedules(f);
    const total = await scheduleRepository.countSchedules({
      q: f.q,
      buildingId: f.buildingId, from: f.from, to: f.to,
      audience: f.audience, status: f.status,
    });
    return res.json({
      success: true,
      schedules,
      total,
      appliedFilters: {
        q: f.q === undefined ? null : f.q,
        buildingId: f.buildingId === undefined ? null : f.buildingId,
        from: f.from,
        to: f.to,
        audience: f.audience === undefined ? null : f.audience,
        status: f.status === undefined ? null : f.status,
        limit: f.limit,
        offset: f.offset,
      },
    });
  } catch (error) {
    // M12.P1-D4 corrective: a bounded-search refusal is an EXPECTED, actionable
    // outcome, not a server fault — it is answered with the repository's fixed
    // client-safe sentence and is deliberately not logged. Every other failure
    // keeps the existing sanitized 500 behaviour.
    if (scheduleRepository.isScheduleSearchLimitError(error)) {
      return res.status(422).json({
        success: false,
        message: scheduleRepository.SCHEDULE_SEARCH_LIMIT_MESSAGE,
      });
    }
    console.error('Error listing schedules: unexpected failure.');
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * GET /admin/api/schedules/:id — single schedule.
 */
exports.getSchedule = async (req, res) => {
  const id = V.parseRouteId(req.params.id);
  if (id === null) {
    return res.status(400).json({ success: false, message: 'Invalid schedule id.' });
  }
  try {
    const schedule = await scheduleRepository.findScheduleById(id);
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found.' });
    }
    return res.json({ success: true, schedule });
  } catch (error) {
    console.error('Error loading schedule: unexpected failure.');
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * POST /admin/api/schedules — create a schedule entry.
 */
exports.createSchedule = async (req, res) => {
  const check = validateSchedulePayload(req.body);
  if (!check.ok) {
    return res.status(400).json({ success: false, message: check.message });
  }
  try {
    if (!(await scheduleRepository.buildingExists(check.value.building_id))) {
      return res.status(404).json({ success: false, message: 'Building not found.' });
    }
    const actor = (req.session && req.session.user) || {};
    const schedule = await scheduleRepository.createSchedule({
      ...check.value,
      created_by_user_id: actor.id || null,
    });
    auditAdminMutation(req, 'admin.schedule.create', 'room_schedule', schedule.id, 'Admin created a room schedule entry.');
    return res.status(201).json({ success: true, message: 'Schedule created.', schedule });
  } catch (error) {
    console.error('Error creating schedule: unexpected failure.');
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PUT /admin/api/schedules/:id — full update of a schedule entry.
 */
exports.updateSchedule = async (req, res) => {
  const id = V.parseRouteId(req.params.id);
  if (id === null) {
    return res.status(400).json({ success: false, message: 'Invalid schedule id.' });
  }
  const check = validateSchedulePayload(req.body);
  if (!check.ok) {
    return res.status(400).json({ success: false, message: check.message });
  }
  try {
    if (!(await scheduleRepository.buildingExists(check.value.building_id))) {
      return res.status(404).json({ success: false, message: 'Building not found.' });
    }
    const schedule = await scheduleRepository.updateSchedule(id, check.value);
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Schedule not found.' });
    }
    auditAdminMutation(req, 'admin.schedule.update', 'room_schedule', id, 'Admin updated a room schedule entry.');
    return res.json({ success: true, message: 'Schedule updated.', schedule });
  } catch (error) {
    console.error('Error updating schedule: unexpected failure.');
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * DELETE /admin/api/schedules/:id — delete a schedule entry.
 */
exports.deleteSchedule = async (req, res) => {
  const id = V.parseRouteId(req.params.id);
  if (id === null) {
    return res.status(400).json({ success: false, message: 'Invalid schedule id.' });
  }
  try {
    const removed = await scheduleRepository.deleteScheduleById(id);
    if (!removed) {
      return res.status(404).json({ success: false, message: 'Schedule not found.' });
    }
    auditAdminMutation(req, 'admin.schedule.delete', 'room_schedule', id, 'Admin deleted a room schedule entry.');
    return res.json({ success: true, message: 'Schedule deleted.' });
  } catch (error) {
    console.error('Error deleting schedule: unexpected failure.');
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};
