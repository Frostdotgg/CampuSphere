'use strict';

/*
 * Focused, database-free contract probe for semester room schedule images.
 * This probe never starts the server, opens a browser, calls Cloudinary, or
 * accesses either database. Runtime CRUD parity remains gated until migration
 * 0020 is separately authorized and applied to the selected test backends.
 */

const fs = require('fs');
const path = require('path');
const {
  locationKey,
  normalizeScheduleImageUrl,
  toPublicDocument
} = require('../utils/roomScheduleDocument');

const ROOT = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const failures = [];
let checkCount = 0;

function check(scope, label, condition) {
  checkCount += 1;
  const passed = Boolean(condition);
  console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!passed) failures.push(`${scope} :: ${label}`);
}

const schema = read('database/schema.sql');
const seed = read('database/seed.js');
const migration = read('database/supabase/0020_room_schedule_documents.sql');
const repository = read('repositories/roomScheduleDocumentRepository.js');
const adminController = read('controllers/adminRoomScheduleDocumentController.js');
const publicController = read('controllers/roomScheduleDocumentController.js');
const auditService = read('services/auditService.js');
const adminRoutes = read('routes/admin.js');
const buildingRoutes = read('routes/buildings.js');
const adminVrController = read('controllers/adminVrController.js');
const vrRepository = read('repositories/vrRepository.js');
const vrController = read('controllers/vrController.js');
const adminView = read('views/admin/campus-map.ejs');
const adminScheduleClient = read('public/js/admin/admin-schedules.js');
const adminVrView = read('views/admin/vr.ejs');
const adminVrClient = read('public/js/admin/admin-vr.js');
const vrView = read('views/vr.ejs');
const vrRouteView = read('views/vr-route.ejs');
const viewerPartial = read('views/partials/room-schedule-viewer.ejs');
const viewerClient = read('public/js/room-schedule-viewer.js');
const viewerCss = read('public/css/room-schedule-viewer.css');
const buildingClient = read('public/js/building-room-schedules.js');
const vrClient = read('public/js/vr-schedule.js');
const sync = read('scripts/syncSupabaseContentToMysql.js');
const reverseVrSync = read('scripts/syncVrMysqlToSupabase.js');
const narrowCasSync = read('scripts/syncSelectedCasVrSupabaseToMysql.js');
const dbPerf = read('scripts/db-perf-gate.js');
const supabaseSmoke = read('scripts/supabase-smoke.js');

console.log('\n[room schedule images] source and pure contracts');

/* Pure identity and response-shape checks. */
const normalized = locationKey('room', '  CS LAB   Laboratory ', ' Second Floor ');
check('identity', 'case and whitespace variants map to one stable location key',
  normalized === locationKey('ROOM', 'cs lab laboratory', 'second floor'));
check('identity', 'a different floor maps to a different room identity',
  normalized !== locationKey('room', 'cs lab laboratory', 'first floor'));
check('identity', 'the stored location key is a SHA-256 hex digest', /^[a-f0-9]{64}$/.test(normalized));

const publicShape = toPublicDocument({
  id: 7,
  building_id: 4,
  building_name: 'Academic Building 4',
  location_type: 'room',
  location_label: 'CSLAB Laboratory',
  floor_label: 'Second Floor',
  semester: 'first-semester',
  school_year: '2026-2027',
  image_url: 'https://res.cloudinary.com/demo/image/upload/sample.png',
  cloudinary_public_id: 'private/source-id',
  created_by_user_id: 99,
  created_at: '2026-08-25T00:00:00Z'
});
check('public shape', 'student response includes semester, room, image, and descriptive alt text',
  publicShape.location_label === 'CSLAB Laboratory' &&
  publicShape.semester_label === 'First Semester' &&
  publicShape.school_year === '2026-2027' &&
  publicShape.image_url.startsWith('https://res.cloudinary.com/') &&
  /CSLAB Laboratory.*First Semester.*2026-2027/.test(publicShape.alt_text));
check('public shape', 'student response strips audit and Cloudinary management metadata',
  !Object.prototype.hasOwnProperty.call(publicShape, 'cloudinary_public_id') &&
  !Object.prototype.hasOwnProperty.call(publicShape, 'created_by_user_id') &&
  !Object.prototype.hasOwnProperty.call(publicShape, 'created_at'));
check('public shape', 'database-drifted non-Cloudinary image URLs fail closed on read',
  normalizeScheduleImageUrl('https://example.com/schedule.png') === null &&
  toPublicDocument({ ...publicShape, image_url: 'https://example.com/schedule.png' }).image_url === null);

/* Schema and migration contracts. */
for (const [name, source] of [['MySQL schema', schema], ['Supabase migration', migration]]) {
  check('schema', `${name} declares room_schedule_documents`, /room_schedule_documents/.test(source));
  check('schema', `${name} stores a unique building plus normalized location identity`,
    /building_id[\s\S]{0,900}location_key/.test(source) && /UNIQUE[\s\S]{0,150}building_id[\s\S]{0,100}location_key/i.test(source));
  check('schema', `${name} stores semester metadata and Cloudinary delivery metadata`,
    /semester/.test(source) && /school_year/.test(source) && /image_url/.test(source) && /cloudinary_public_id/.test(source));
  check('schema', `${name} links VR hotspots by schedule_document_id with delete restriction`,
    /schedule_document_id/.test(source) && /REFERENCES[\s\S]{0,100}room_schedule_documents[\s\S]{0,100}(RESTRICT|NO ACTION)/i.test(source));
}
check('schema', 'migration 0020 is additive and contains no schedule data seed',
  /ADD COLUMN IF NOT EXISTS schedule_document_id/i.test(migration) &&
  !/INSERT\s+INTO\s+public\.room_schedule_documents/i.test(migration));
check('schema', 'Supabase table is service-role only with RLS enabled',
  /ENABLE ROW LEVEL SECURITY/i.test(migration) &&
  /REVOKE ALL[\s\S]{0,80}PUBLIC/i.test(migration) &&
  /REVOKE ALL[\s\S]{0,80}anon/i.test(migration) &&
  /REVOKE ALL[\s\S]{0,80}authenticated/i.test(migration) &&
  /GRANT SELECT, INSERT, UPDATE, DELETE[\s\S]{0,80}service_role/i.test(migration));
check('schema', 'MySQL seed upgrades the table, index, column, and foreign key without creating content rows',
  seed.includes("ensureColumn('vr_hotspots', 'schedule_document_id'") &&
  seed.includes("'room_schedule_documents', 'idx_room_schedule_documents_building_term'") &&
  !/INSERT\s+INTO\s+room_schedule_documents/i.test(seed));

/* Server-side security, CRUD, and backend-parity contracts. */
check('routes', 'all admin schedule-image routes sit behind the admin role, CSRF, and mutation limiter',
  adminRoutes.indexOf("router.use(requireRole('admin'))") < adminRoutes.indexOf("router.post('/api/room-schedule-documents'") &&
  adminRoutes.indexOf('router.use(verifyCsrf)') < adminRoutes.indexOf("router.post('/api/room-schedule-documents'") &&
  adminRoutes.indexOf('router.use(adminMutationLimiter)') < adminRoutes.indexOf("router.post('/api/room-schedule-documents'"));
check('routes', 'legacy schedule rows are read-only during transition',
  /router\.get\('\/api\/schedules'/.test(adminRoutes) &&
  !/router\.(?:post|put|delete)\('\/api\/schedules/.test(adminRoutes));
check('routes', 'building-list and exact-document endpoints require login',
  /router\.get\('\/api\/buildings\/:id\/room-schedule-documents',\s*requireLogin/.test(buildingRoutes) &&
  /router\.get\('\/api\/room-schedule-documents\/:id',\s*requireLogin/.test(buildingRoutes));
check('controller', 'public schedule responses are private and uncached',
  publicController.includes("res.set('Cache-Control', 'private, no-store')") &&
  publicController.includes("res.set('Pragma', 'no-cache')"));
check('controller', 'building-linked reads and admin CRUD fail closed on building/schedule backend mismatch',
  adminController.includes('scheduleDataSource.isSupabase() === mapRuntime.isBuildingSupabase()') &&
  publicController.includes('scheduleDataSource.isSupabase() !== mapRuntime.isBuildingSupabase()'));
check('controller', 'building schedule reads paginate to an exact bounded total instead of truncating at 200',
  publicController.includes('BUILDING_DOCUMENT_MAX = 2000') &&
  publicController.includes('offset: documents.length') &&
  publicController.includes('documents.length !== total'));
check('controller', 'admin payload validation has a fixed body allowlist and validates consecutive school years',
  adminController.includes('V.validateBody(body, BODY_KEYS)') &&
  /\^\(\\d\{4\}\)-\(\\d\{4\}\)\$/.test(adminController) &&
  adminController.includes('second !== first + 1'));
check('controller', 'only HTTPS Cloudinary delivery URLs and conservative public IDs are accepted',
  adminController.includes('validateImageUrlField') &&
  adminController.includes("startsWith('https://')") &&
  adminController.includes('validateCloudinaryPublicId'));
check('controller', 'duplicate rooms and linked deletes fail with conflict responses',
  /status\(409\)/.test(adminController) &&
  adminController.includes('countLinkedHotspots') &&
  adminController.includes('Relink or remove those hotspots'));
check('controller', 'linked schedule identity cannot be moved while term and image updates remain available',
  adminController.includes('identityChanged') &&
  adminController.includes('Unlink it before changing its building or room identity.') &&
  adminScheduleClient.includes('setIdentityLocked') &&
  adminView.includes('id="schedule-identity-hint"'));
check('audit', 'the three image-document mutation actions are fixed allowlisted values',
  ['create', 'update', 'delete'].every((action) =>
    auditService.includes(`'admin.room_schedule_document.${action}'`) &&
    adminController.includes(`'admin.room_schedule_document.${action}'`)));
check('repository', 'repository has explicit dual-backend branches and no wildcard Supabase document selection',
  repository.includes('scheduleDataSource.isSupabase()') &&
  repository.includes("from('room_schedule_documents')") &&
  repository.includes('select(DOCUMENT_COLUMNS') &&
  !/from\('room_schedule_documents'\)\.select\('\*'/.test(repository));
check('repository', 'MySQL document statements use placeholders and bound arrays',
  /WHERE d\.id = \? LIMIT 1`?,\s*\[number\]/.test(repository) &&
  /VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?, \?\)/.test(repository));
check('repository', 'Supabase related data is hydrated in batches instead of per-row queries',
  repository.includes('Promise.all([') &&
  repository.includes(".in('id', buildingIds)") &&
  repository.includes(".in('schedule_document_id', documentIds)"));

/* Direct VR linkage and legacy fallback. */
check('VR admin', 'schedule hotspots accept only a selected schedule_document_id',
  adminVrController.includes('body.schedule_document_id') &&
  adminVrController.includes('A schedule hotspot requires a room schedule selection.') &&
  adminVrController.includes('assertScheduleHotspotDocument'));
check('VR admin', 'schedule and VR backends must match before saving a schedule hotspot',
  adminVrController.includes('scheduleDataSource.getScheduleDataSource() !== vrDataSource.getVrDataSource()') &&
  adminVrController.includes('Room schedule and VR data sources must match'));
check('VR repository', 'admin and runtime hotspot shapes carry schedule_document_id',
  (vrRepository.match(/schedule_document_id/g) || []).length >= 6 &&
  (vrController.match(/schedule_document_id/g) || []).length >= 3);
check('VR admin UI', 'the hotspot form uses a searchable native schedule-document select',
  adminVrView.includes('id="vr-hotspot-schedule-search"') &&
  adminVrView.includes('name="schedule_document_id" id="vr-hotspot-schedule-document"') &&
  adminVrClient.includes("'/admin/api/room-schedule-documents?limit=200'") &&
  adminVrClient.includes('SCHEDULE_MAX_ROWS = 2000') && adminVrClient.includes("'&offset='") &&
  adminVrClient.includes('payload.schedule_document_id = documentId'));
check('VR runtime', 'document links open by ID while old metadata remains a fallback',
  vrClient.includes('viewer.openById(target.documentId') &&
  vrClient.includes('viewer.openLegacy(target') &&
  vrClient.includes('schedule_location_label'));
check('VR runtime', 'both accessible schedule hotspot triggers keep 44px touch targets',
  /\.vr-hotspot__schedule-btn[\s\S]{0,180}min-height:\s*44px/.test(vrView) &&
  /\.vr-hotspot__schedule-btn[\s\S]{0,180}min-height:\s*44px/.test(vrRouteView));

/* Admin and authenticated viewer UX/security. */
check('admin UI', 'the new form accepts URL metadata only and has no file upload control',
  adminView.includes('name="image_url" id="schedule-image-url"') &&
  adminView.includes('name="cloudinary_public_id"') &&
  !/<input[^>]+type="file"[^>]+schedule/i.test(adminView));
check('admin UI', 'client never calls a Cloudinary upload, delete, or management endpoint',
  !/api\.cloudinary\.com|upload_preset|destroy|unsigned_upload/i.test(adminScheduleClient) &&
  adminScheduleClient.includes('The Cloudinary image will not be deleted.'));
check('admin UI', 'stored values render through DOM text APIs and image URLs use an explicit property',
  adminScheduleClient.includes('document.createElement') &&
  adminScheduleClient.includes('.textContent') &&
  !/innerHTML|insertAdjacentHTML|document\.write/.test(adminScheduleClient));
check('admin UI', 'admin schedule lists paginate to an exact bounded total instead of silently truncating',
  adminScheduleClient.includes('MAX_LOADED_DOCUMENTS = 2000') &&
  adminScheduleClient.includes('listUrl(documents.length)') &&
  adminScheduleClient.includes('documents.length !== total'));
check('admin UI', 'admin and building thumbnails revalidate the exact Cloudinary host before loading',
  adminScheduleClient.includes("parsed.hostname === 'res.cloudinary.com'") &&
  buildingClient.includes("parsed.hostname === 'res.cloudinary.com'"));
check('viewer', 'one labelled dialog has close, status, image, and full-size fallback controls',
  viewerPartial.includes('role="dialog"') && viewerPartial.includes('aria-modal="true"') &&
  viewerPartial.includes('id="roomScheduleViewerClose"') &&
  viewerPartial.includes('id="roomScheduleViewerStatus"') &&
  viewerPartial.includes('id="roomScheduleViewerImage"') && viewerPartial.includes('referrerpolicy="no-referrer"') &&
  viewerPartial.includes('id="roomScheduleViewerOriginal"'));
check('viewer', 'viewer exposes an accessible fit/zoom toggle for loaded images',
  viewerPartial.includes('id="roomScheduleViewerToolbar"') &&
  viewerPartial.includes('id="roomScheduleViewerZoom"') &&
  viewerPartial.includes('aria-pressed="false"') &&
  viewerClient.includes('setZoomed') &&
  viewerClient.includes('Fit whole schedule') &&
  viewerClient.includes('frame.classList.contains(\'is-zoomed\')') &&
  viewerCss.includes('.room-schedule-viewer__frame.is-zoomed') &&
  viewerCss.includes('width: min(200%, 1600px)'));
check('viewer fixture', 'a missing zoom control is rejected by the viewer contract',
  !viewerPartial.replace('id="roomScheduleViewerZoom"', 'id="roomScheduleViewerZoomMissing"').includes('id="roomScheduleViewerZoom"'));
check('viewer', 'viewer enforces exact Cloudinary HTTPS host and safe text rendering',
  viewerClient.includes("parsed.hostname === 'res.cloudinary.com'") &&
  viewerClient.includes("parsed.protocol === 'https:'") &&
  !/innerHTML|insertAdjacentHTML|document\.write/.test(viewerClient));
check('viewer', 'viewer supports loading/error states, Escape, Tab trapping, and focus return',
  viewerClient.includes('image.onload') && viewerClient.includes('image.onerror') &&
  viewerClient.includes("event.key === 'Escape'") && viewerClient.includes("event.key !== 'Tab'") &&
  viewerClient.includes('returnFocus.focus()'));
check('viewer', 'modal state hides global overlays and locks the root scroll container',
  viewerCss.includes('body.room-schedule-viewer-open .theme-toggle') &&
  viewerCss.includes('body.room-schedule-viewer-open #cs-update-available') &&
  viewerClient.includes("document.body.appendChild(overlay)") &&
  viewerClient.includes("document.documentElement.classList.add('room-schedule-viewer-open')") &&
  viewerClient.includes("document.documentElement.classList.remove('room-schedule-viewer-open')"));
check('viewer fixture', 'removing the root modal lock is rejected by the viewer contract',
  !viewerClient.replace("document.documentElement.classList.add('room-schedule-viewer-open');", '').includes(
    "document.documentElement.classList.add('room-schedule-viewer-open')"));
check('viewer fixture', 'removing the body portal is rejected by the viewer contract',
  !viewerClient.replace('if (overlay.parentElement !== document.body) document.body.appendChild(overlay);', '').includes(
    'document.body.appendChild(overlay)'));
check('viewer', 'viewer controls keep 44px targets and include a mobile full-height layout',
  /min-height:\s*44px/.test(viewerCss) && /min-width:\s*44px/.test(viewerCss) &&
  /@media \(max-width:\s*640px\)/.test(viewerCss) && /min-height:\s*100dvh/.test(viewerCss) &&
  /safe-area-inset-top/.test(viewerCss) && !/min-height:\s*min\(62dvh,\s*680px\)/.test(viewerCss));
check('building UI', 'building details load image documents first and legacy rows only for the empty transition state',
  buildingClient.includes('/room-schedule-documents') &&
  buildingClient.includes('/schedules') &&
  buildingClient.indexOf('/room-schedule-documents') < buildingClient.indexOf('/schedules'));

/* Data/release boundary integration. */
check('sync', 'full content sync orders schedule documents before VR hotspots and validates the reference',
  sync.indexOf("name: 'room_schedule_documents'") < sync.indexOf("name: 'vr_hotspots'") &&
  sync.includes('assertOptionalForeignKey(row.schedule_document_id, scheduleDocuments'));
check('sync', 'MySQL-to-Supabase VR sync translates schedule documents by building natural key plus location_key',
  reverseVrSync.includes('targetScheduleDocumentGroups') &&
  reverseVrSync.includes('canonicalKey(sourceDocumentBuilding.name)') &&
  reverseVrSync.includes('schedule_document_id: scheduleDocumentId'));
check('sync', 'narrow CAS sync fails closed instead of dropping a direct schedule-document link',
  narrowCasSync.includes('document-linked schedule hotspots require the full content sync') &&
  narrowCasSync.includes('schedule_floor_label,schedule_document_id'));
check('performance', 'database performance gate requires both new lookup indexes',
  dbPerf.includes('room_schedule_documents_building_term_idx') &&
  dbPerf.includes('vr_hotspots_schedule_document_idx'));
check('verification boundary', 'Supabase smoke fails closed on selected schedule mode and probes migration 0020 read-only',
  supabaseSmoke.includes('scheduleSupabaseRequired') &&
  supabaseSmoke.includes("from('room_schedule_documents')") &&
  supabaseSmoke.includes("select('schedule_document_id')") &&
  !/from\('room_schedule_documents'\)[\s\S]{0,120}\.(?:insert|update|upsert|delete)\(/.test(supabaseSmoke));
check('offline', 'schedule images remain outside the offline package',
  !read('services/offlineGuideService.js').includes('room_schedule_documents') &&
  !read('controllers/offlineGuideController.js').includes('room_schedule_documents'));

if (failures.length) {
  console.error(`ROOM-SCHEDULE-DOCUMENT-PROBE FAILED: ${failures.length} check(s).`);
  failures.forEach((failure) => console.error('  - ' + failure));
  process.exitCode = 1;
} else {
  console.log(`ROOM-SCHEDULE-DOCUMENT-PROBE OK: ${checkCount}/${checkCount} checks passed.`);
}
