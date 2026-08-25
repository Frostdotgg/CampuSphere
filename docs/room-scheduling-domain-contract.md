# CampuSphere Room Scheduling Domain Contract

## Replacement Contract: Semester Image Per Room (2026-08-25)

This section supersedes the original Milestone 11 time-row model below for all
new administration and user-facing behavior. The older text is retained only
as the historical contract for legacy fallback rows.

- One `room_schedule_documents` record represents the current semester image
  for a unique building + location type + room/facility label + optional floor.
  The normalized `location_key` enforces that identity; a new semester updates
  the existing record and keeps its numeric ID.
- Required admin values are building, `room|facility`, location label,
  `first-semester|second-semester|midyear`, consecutive `YYYY-YYYY` school year,
  and an HTTPS URL on the exact `res.cloudinary.com` delivery host. Floor and a
  conservative Cloudinary public ID are optional. No OCR, class, year/section,
  instructor, student, time slot, or schedule-grid cell is parsed or stored.
- CampuSphere performs no Cloudinary upload, transformation, management, or
  deletion request. The administrator uploads externally and pastes delivery
  metadata. The approved image must contain no participant PII.
- `vr_hotspots.schedule_document_id` is the direct link. Building and schedule
  sources must match for building-linked administration/display, and schedule
  and VR sources must match before a hotspot link is saved. Numeric IDs are
  never guessed across backends. The foreign key uses delete
  restriction; admins must relink/remove hotspots before deleting a document
  or changing its building/room identity. Term and image updates keep the same
  ID and remain available while linked.
- Authenticated building details and VR views use the same accessible image
  viewer. Public API shapes omit Cloudinary public ID, creator identity,
  timestamps, and normalized keys, and responses are private/no-store.
- Legacy `room_schedules` rows and legacy hotspot metadata are read-only
  transition fallback. Their mutation routes are retired. Offline guide
  packages continue to exclude every schedule and Cloudinary asset.
- Supabase migration source `0020_room_schedule_documents.sql` exists but is
  not applied by this candidate. Application and runtime verification require
  separate owner authorization. Source-only checks do not constitute GO.

Milestone 11, Section 11.2: Schedule Domain Model and Validation Plan.

Status: **written contract only — nothing in this document is implemented yet.**
Section 11.3 (Database Schema and Supabase/MySQL Parity) must not begin until
Codex reviews this contract and gives GO. This file defines the smallest real
room/facility scheduling model that fits the current app; it changes no
runtime code, schema, seed, migration, or QA gate.

> **Implementation status (updated 2026-07-09, Section 11.7):** this contract
> has since been implemented — Sections 11.3–11.6 are complete and Codex GO.
> The `room_schedules` table exists in both backends, Supabase migration
> `0012_room_schedules.sql` is **owner-applied**, and the "baseline facts" /
> "future"/"nothing exists yet" wording below describes the pre-implementation
> state and is retained as the historical Section 11.2 deliverable.

Baseline facts this contract is built on (verified in Section 11.1,
2026-07-08): no schedule or room table exists in MySQL or Supabase; rooms and
facilities exist only as fragments inside the `buildings.details` JSON column
(`floors[].label`, `floors[].rooms[].{num, use}`); migrations are
`0001`–`0011` with no `0012`; no schedule repository, service, route,
controller, validator, or UI exists anywhere in the runtime.

---

## 1. Purpose and scope

Milestone 11 adds **real admin-managed room/facility schedule data** served
from the configured runtime data source. A schedule entry answers: *"what is
happening (or planned/cancelled/completed) in a given room or facility of a
given building, on a given date, between which times, and for which audience."*

Schedule entries are campus operations data (a room reserved for an org
meeting, a facility closed for maintenance, a hall booked for a seminar).
They are **not** academic records. This contract explicitly excludes — now and
in every later section — SIS integration, enrollment records or status,
assigned classes, instructor teaching loads, attendance, grading, fake
academic records, fake instructor assigned-room widgets, fake instructor
teaching schedules, and fake all-room dashboards.

## 2. Entity: `room_schedules`

Future table name (both backends): **`room_schedules`** — the additive table
already anticipated by `ROADMAP.md` ("Suggested Technical Improvements").
Created in Section 11.3 only: additive MySQL DDL in `database/schema.sql`
plus, if live inspection confirms it is needed, Supabase migration `0012_*`
applied **manually by the project owner**. Neither exists yet and neither is
created by this section.

### 2.1 Required fields (admin-supplied)

| Field | Contract | Rules |
| --- | --- | --- |
| `title` | string, **1–150 chars** | Purpose/title of the entry. Trimmed; required non-empty. |
| `schedule_date` | string, **strict `YYYY-MM-DD`** | Real calendar date (`validateYmdDate` semantics: regex + real-date check). |
| `start_time` | string, **strict `HH:MM`**, 24-hour | Campus-local wall time (Asia/Manila). `00:00`–`23:59`. |
| `end_time` | string, **strict `HH:MM`**, 24-hour | Same day as `start_time`; must be **strictly greater** than `start_time`. No overnight ranges in v1. |
| `audience` | allowlisted string | One of §2.4. Who the entry is relevant to, matching the announcement audience convention. |
| `status` | allowlisted string | One of §2.4. |
| building target | integer id of an existing `buildings` row | Per-backend FK `building_id` → `buildings(id)`. Must reference an existing building at write time. Cross-backend QA parity is asserted by **natural keys** (building name + title + date + times), never by numeric ids. |
| `location_type` | allowlisted string | `room` or `facility`. |
| `location_label` | string, **1–120 chars** | Free-text room number / facility name (e.g. `Room 204`, `Gymnasium`). Free text is deliberate: rooms are JSON fragments inside `buildings.details`, not rows, so there is nothing to foreign-key. No requirement that the label match a `details` room entry. |

### 2.2 Optional fields (admin-supplied)

| Field | Contract | Rules |
| --- | --- | --- |
| `floor_label` | string, max **80 chars** | Free text (e.g. `2nd Floor`); may but need not match a `details.floors[].label`. Empty/absent stored as NULL. |
| `description` | string, max **1000 chars** | Public-safe plain text only. Rendered exclusively through escaped output (EJS `<%= %>` / `textContent` / existing `escapeHtml` client helpers) — never as HTML. Must never carry private notes, contact data, or secrets. |

### 2.3 Server-only / internal fields (never admin-supplied)

| Field | Contract |
| --- | --- |
| `id` | Backend primary key. Internal; exposed only where existing conventions already expose ids (admin CRUD responses/UI). Public views must not surface ids beyond what rendering requires. |
| `created_by_user_id` | Set server-side from `req.session.user`; FK `users(id) ON DELETE SET NULL` (mirrors `news_announcements.author_id`). **Never exposed in public/user-facing responses or views.** |
| `created_at`, `updated_at` | Backend timestamps, existing column conventions. Admin-facing only. |

Public/user-facing views and APIs expose only: title, schedule_date,
start_time, end_time, audience, status, building identity as already rendered
publicly (name), location_type, location_label, floor_label, description.
No admin-only metadata, no creator identity, no raw DB internals.

### 2.4 Allowlists (fixed in v1)

- **`status`**: `scheduled`, `cancelled`, `completed`. Explicit values enable
  safe filtering; no other value is accepted. Default public visibility is
  `scheduled` only (§5.2); `cancelled`/`completed` rows are retained for admin
  view and optional explicit filters.
- **`audience`**: `all`, `student-cspc`, `instructor`, `guest`, `admin` —
  byte-for-byte the existing `ALLOWED_AUDIENCES` list in
  `controllers/adminContentController.js` and the role values used by the
  dashboard announcement filter (`audience = 'all' OR audience = <role>`).
- **`location_type`**: `room`, `facility`.

### 2.5 Time semantics

All dates/times are **naive campus-local wall time** (Asia/Manila). No
timezone conversion, no UTC storage semantics, no DST logic — matching how
`events.event_date`/`event_time` are already treated. An entry lives entirely
within one calendar day. Exact storage column types (`DATE` + `TIME`
recommended, for index/order-ability in both MySQL and Postgres) are a 11.3
decision; this contract fixes only the API string formats and comparison
semantics above.

### 2.6 Overlaps and conflicts — explicitly out of scope in v1

**No automatic conflict or overlap enforcement exists in v1.** Two or more
entries may occupy the same building/location/date/time range; all are stored
and displayed. Admins are responsible for avoiding real-world double-booking.
Conflict/overlap detection, warnings, or rejection are out of scope unless a
later section is explicitly approved for it. (Exact-duplicate handling beyond
this — e.g. a uniqueness guard — is likewise not part of v1 unless Codex
approves it in 11.3; per `plan.md` 11.5, no complex conflict rules may be
invented silently.)

### 2.7 Referential behavior

- `building_id` → `buildings(id)`. Recommended v1 rule for building deletion:
  follow the existing destructive-delete-guard convention (R5 /
  `adminBuildingsController` route guard) and **block deletion with sanitized
  409** while `room_schedules` rows reference the building, telling the admin
  to remove those schedules first. The alternative (`ON DELETE CASCADE`, as
  used for profile tables) silently destroys future bookings. Final choice is
  flagged for Codex decision in 11.3; this contract recommends the 409 guard.
- Empty-table safety: every app flow must behave exactly as today when
  `room_schedules` has zero rows (11.3–11.6 verification requirement).

## 3. Runtime data source switch

Future switch: **`SCHEDULE_DATA_SOURCE=mysql|supabase`**, implemented in 11.4
as `config/scheduleDataSource.js`, a line-for-line sibling of
`config/contentDataSource.js`:

- Valid values `['mysql', 'supabase']`; unset/empty/unrecognised falls back to
  the default `mysql` with a single non-secret warning that never echoes the
  raw value.
- Reads only `process.env`; no side effects; does not import the Supabase
  client, the MySQL pool, or any repository.
- Exports `getScheduleDataSource()`, `isSupabase()`, `isMysql()`,
  `VALID_SCHEDULE_DATA_SOURCES`, `DEFAULT_SCHEDULE_DATA_SOURCE`.

Data access goes through a new `repositories/scheduleRepository.js` (Supabase,
server-only client) with the MySQL path using the shared `config/db.js` pool —
the same boundary split every other entity uses. Supabase Auth remains unused;
Supabase credentials remain server-only.

## 4. Validation plan (contract for 11.3–11.5 implementation)

All schedule validation reuses `utils/adminValidation.js` patterns and lives
server-side. Client-side checks are convenience only, never security.

### 4.1 Existing helpers reused

- `validateBody(body, SCHEDULE_KEYS)` — plain-object check + **rejection of
  any unsupported key**. `SCHEDULE_KEYS = ['title', 'schedule_date',
  'start_time', 'end_time', 'audience', 'status', 'building_id',
  'location_type', 'location_label', 'floor_label', 'description']`.
- `requiredString(raw, label, max)` — `title` (150), `location_label` (120).
- `optionalString(raw, label, max)` — `floor_label` (80), `description` (1000).
- `allowedValue(raw, label, allowed)` — `audience`, `status`, `location_type`.
- `validateYmdDate(raw, label)` — `schedule_date` (strict format + real
  calendar date).
- `validateNumberInRange` / the integer-id parse pattern (`parseRouteId`
  style) — `building_id` and `:id` route params.

### 4.2 New helpers to add in `utils/adminValidation.js` (implementation in a later approved section, not now)

- **`validateHhMmTime(raw, label)`** — string only; trimmed; strict
  `/^([01]\d|2[0-3]):[0-5]\d$/`; returns the canonical `HH:MM` string.
  Rejects `24:00`, missing zero-padding, seconds, AM/PM, non-strings.
- **`validateTimeRange(startRaw, endRaw)`** — runs `validateHhMmTime` on both,
  then requires `end > start` as same-day minute values. Rejects inverted
  **and equal** (zero-length) ranges with a sanitized message.

### 4.3 Rejection matrix (all → sanitized 400 `{ success:false, message }`)

Reject, with a fixed human-readable message and no echo of raw input:

- Non-object bodies, arrays or scalars where an object is expected, and any
  unsupported/unknown field (allowlist enforcement via `validateBody`).
- Missing/empty `title`, `schedule_date`, `start_time`, `end_time`,
  `audience`, `status`, `building_id`, `location_type`, or `location_label`.
- Invalid dates (format or non-existent calendar date), invalid times
  (format), inverted or zero-length time ranges.
- Unsupported `audience`, `status`, or `location_type` values.
- Oversized strings (title > 150, location_label > 120, floor_label > 80,
  description > 1000) and wrong-typed values (non-string where string
  expected, non-integer building id).
- `building_id` not matching an existing building → sanitized 400 (validation)
  or 404 per the established building-lookup convention in the implementing
  controller; never a raw DB error.
- Unsafe nested/structured payloads: no schedule field accepts objects,
  arrays, or JSON blobs — every field is a flat string or integer. (The
  bounded `validateDetails` walker is *not* needed for schedules and is not
  part of this contract.)

### 4.4 Error sanitization invariant

Every error path — validation, missing entry, backend failure — returns the
existing fixed contracts (`400`/`404`/`409`/`429`/sanitized `500`
`{ success:false, message }` for API; established EJS error pages for browser
navigation). **No raw SQL, PostgREST text, stack traces, request bodies,
cookies, session IDs, Supabase hosts/keys/service-role values, Cloudinary
credentials, OAuth secrets, or DB credentials may appear in any response,
log, or gate output.** Server logging uses the existing fixed-string
`logServerError`/`serverLog` conventions.

## 5. Future API / interface plan (documentation only — nothing exists yet)

### 5.1 Admin CRUD (Section 11.5)

Mounted in `routes/admin.js`, inheriting the namespace-wide
`requireRole('admin')` → `verifyCsrf` → `adminMutationLimiter` chain:

- `GET    /admin/api/schedules` — list (all statuses/audiences), filterable,
  bounded (§5.3); response `{ success, schedules, total }`.
- `POST   /admin/api/schedules` — create; `201` + `{ success, message, schedule }`.
- `GET    /admin/api/schedules/:id` — fetch one; `{ success, schedule }`; 404 sanitized.
- `PUT    /admin/api/schedules/:id` — full update through the same validator;
  `{ success, message, schedule }`.
- `DELETE /admin/api/schedules/:id` — delete; `{ success, message }`; 404 sanitized.

Responses follow the existing `{ success, message, <entity>/<entities>, total }`
conventions used by the buildings/news/events admin APIs. Successful mutations
record audit entries via the existing `auditAdminMutation` →
`services/auditService` convention (actions e.g. `admin.schedule.create/update/delete`)
without session IDs or raw payloads. Both runtime modes (MySQL fallback,
Supabase production) must behave equivalently, keyed by natural identifiers
for parity checks.

### 5.2 Public/user-facing reads (Section 11.6)

- Read surface for authenticated users (all roles, including guest — matching
  the `requireLogin` gate on `/buildings` and `/api/buildings`); no anonymous
  public browsing.
- Filters supported without exposing raw DB internals: **building, date range
  (`from`/`to`), audience, status.**
- Default non-admin visibility: `status = 'scheduled'` rows whose `audience`
  is `all` or matches the requesting user's role (the dashboard announcement
  filter rule). Admin surfaces may see and filter all statuses/audiences.
- Building detail display (`views/buildings.ejs` detail panel) shows **real
  schedule rows only**, ordered by `schedule_date` then `start_time`, with an
  explicit friendly **empty state** when no rows exist (mirroring the "No
  floor plan available." pattern). No fake filler ever.
- Rendering uses the page's existing escaping discipline (R1): every
  DB-derived schedule value passes through `escapeHtml`/`textContent`; no
  innerHTML interpolation of unescaped values.
- Mobile: schedule display must remain usable at the already-verified mobile
  widths and must not overlap map/building/VR controls.
- Dashboards remain links/summaries at most — no schedule grids, no per-user
  "my room/my classes" widgets (anti-scope §6).

### 5.3 Bounded query ranges (performance contract)

- Every schedule list query is date-bounded; unbounded "all history" reads are
  not offered on public surfaces.
- **Maximum requested range: 90 days**; wider requests are rejected with
  sanitized 400 or clamped — the implementing section picks one behavior and
  documents it (recommendation: reject, consistent with strict validation).
- **Building-view default: the upcoming 14 days** (today inclusive) when no
  explicit range is given.
- Index plan (11.3, verified by the db-perf gate): composite
  `(building_id, schedule_date)` plus `(schedule_date)`, mirroring the
  `news_announcements` `(audience, published_date)` convention; final index
  set is a 11.3 deliverable.

## 6. Anti-scope (restated, binding on every Milestone 11 section)

Not implemented, not simulated, not reintroduced:

- Fake student enrollment records or enrollment status; SIS integration.
- Fake instructor assigned-room widgets, fake instructor teaching schedules,
  fake instructor all-room dashboards.
- Automatic class assignment, attendance, grading, or enrollment workflows.
- Automatic conflict/overlap detection (§2.6) in v1.
- Anonymous public browsing beyond the authenticated guest-role policy.
- Supabase Auth; browser-side Supabase access; Cloudinary involvement of any
  kind (schedules are text data — media support from Milestone 10 is simply
  preserved, unchanged).
- Dashboard redesigns, map rewrites, or unrelated refactors.

## 7. Security & architecture invariants preserved

Express sessions + bcrypt local login + Google OAuth (Supabase Auth unused);
`SESSION_STORE=supabase` production default with MySQL fallback and
fail-closed memory policy; namespace-level admin role gate, synchronizer-token
CSRF, and mutation rate limiting inherited by all schedule admin endpoints;
nonce CSP (no Cloudinary in `script-src`); PWA privacy rules (authenticated
HTML and `/admin`/`/admin/api/*` never cached — future schedule API responses
under `/admin/api/*` are automatically excluded; public schedule reads must
not be added to service-worker caching without explicit privacy review);
sanitized error contracts; server-only Supabase and Cloudinary credentials;
natural-identifier parity between backends; owner-applied Supabase SQL only.

## 8. Verification contract for later sections

- 11.3: schema checks in both backends; empty-table tolerance of every
  existing flow; no silent Supabase SQL application (owner applies `0012_*`).
- 11.4: repository-level probes in both modes; sanitized failure behavior.
- 11.5: admin JSON contract probes — create, update, validation rejection
  (every §4.3 class), list, delete, 404, non-admin 401/403 denial by direct
  URL/crafted fetch, and probe cleanup — in both runtime modes.
- 11.6: schedule-present and schedule-empty rendering checks + mobile-width
  review.
- 11.7: QA gates extended for schedule validation, admin-only mutation,
  backend parity, empty states, and leak boundaries; docs updated to state
  schedules are real admin-managed room/facility data (not enrollment/SIS/
  instructor-load simulation).

---

**Stop point:** This contract is the complete Section 11.2 deliverable.
Awaiting Codex review and explicit GO before Milestone 11, Section 11.3
(Database Schema and Supabase/MySQL Parity). No schema, migration, seed,
runtime code, or QA change accompanies this document.
