'use strict';

/* ========================================
   CampuSphere - event audience contract probe

   DATABASE-FREE and NETWORK-FREE. This focused source contract keeps the
   admin form, both persistence paths, and every participant-facing event
   projection aligned around server-side audience filtering.
   ======================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const failures = [];

function check(scope, label, condition) {
  console.log(`  [${condition ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!condition) failures.push(`${scope} :: ${label}`);
}

const audienceValues = "'all', 'student-cspc', 'instructor', 'guest', 'admin'";
const audienceKeys = ['all', 'student-cspc', 'instructor', 'guest', 'admin'];
const audienceCheckPattern = /audience IN \(\s*'all'\s*,\s*'student-cspc'\s*,\s*'instructor'\s*,\s*'guest'\s*,\s*'admin'\s*\)/;

const view = read('views/admin/news.ejs');
const adminClient = read('public/js/admin/admin-news.js');
const adminController = read('controllers/adminContentController.js');
const repository = read('repositories/contentRepository.js');
const eventsController = read('controllers/eventsController.js');
const pageController = read('controllers/pageController.js');
const notificationService = read('services/notificationFeedService.js');
const schema = read('database/schema.sql');
const seed = read('database/seed.js');
const migration = read('database/supabase/0025_event_audience.sql');

check('admin form', 'event audience select has a visible label and all five options',
  /<label for="event-audience">Audience<\/label>/.test(view) &&
  /<select name="audience" id="event-audience" required>/.test(view) &&
  audienceKeys.every((value) => new RegExp(`value=["']${value}["']`).test(view)));
check('admin form', 'new events default to Everyone and edits restore the saved audience',
  /form\.audience\.value='all'/.test(adminClient) &&
  /form\.audience\.value=ev\.audience\|\|'all'/.test(adminClient));
check('admin form', 'audience is submitted and rendered in the management table',
  /audience:eventForm\.audience\.value/.test(adminClient) &&
  /<th>Audience<\/th>/.test(view) &&
  /audienceLabel\(ev\.audience\)/.test(adminClient) &&
  /audience:\s*e\.audience\s*\|\|\s*'all'/.test(view));

check('admin API', 'event validation accepts only the shared audience allowlist',
  /const EVENT_KEYS = \[[^\]]*['"]audience['"]/.test(adminController) &&
  /V\.allowedValue\(body\.audience, 'audience', ALLOWED_AUDIENCES\)/.test(adminController) &&
  /audience = 'all'/.test(adminController));
check('admin API', 'MySQL and Supabase event writes persist audience',
  /audience:\s*value\.audience/.test(adminController) &&
  /INSERT INTO events \(title, category, audience, event_date/.test(adminController) &&
  /SET title = \?, category = \?, audience = \?, event_date/.test(adminController));

check('repository', 'event rows include audience and role reads are explicit',
  /const EVENT_COLUMNS =\s*\n\s*'[^']*audience[^']*'/.test(repository) &&
  /async function listEventsForRole\(role, options = \{\}\)/.test(repository) &&
  /query = query\.in\('audience', trimmedRole \? \['all', trimmedRole\] : \['all'\]\)/.test(repository) &&
  /listEventsForRole,/.test(repository));
check('repository', 'event writes default missing audience to Everyone and update it',
  /audience: payload\.audience != null && payload\.audience !== '' \? payload\.audience : 'all'/.test(repository) &&
  /\['title', 'category', 'audience', 'description'/.test(repository));

check('participant reads', 'public events are filtered by the authenticated session role',
  /listEventsForRole\(role, \{ sortDirection: 'desc' \}\)/.test(eventsController) &&
  /WHERE \$\{audienceSql\}/.test(eventsController) &&
  /\(audience = \? OR audience = \?\)/.test(eventsController));
check('participant reads', 'Home latest events are filtered before the limit',
  /listEventsForRole\(role, \{/.test(pageController) &&
  /FROM events[\s\S]*WHERE \$\{audienceSql\}[\s\S]*LIMIT \$\{HOME_LATEST_EVENT_LIMIT\}/.test(pageController));
check('participant reads', 'notification events are role-filtered in both data sources',
  /listEventsForRole\(normalizedRole, \{ from: today, limit: EVENT_LIMIT \}\)/.test(notificationService) &&
  /FROM events[\s\S]*event_date >= \?[\s\S]*AND \$\{audienceSql\}/.test(notificationService));

check('schema', 'MySQL events include the default, check, and audience/date index',
  /audience VARCHAR\(30\) NOT NULL DEFAULT 'all'/.test(schema) &&
  /chk_events_audience[\s\S]*audience IN/.test(schema) && audienceCheckPattern.test(schema) &&
  /idx_events_audience_event_date \(audience, event_date, id\)/.test(schema));
check('schema', 'Supabase migration is additive, constrained, indexed, and owner-applied',
  /ADD COLUMN IF NOT EXISTS audience text/.test(migration) &&
  /UPDATE public\.events[\s\S]*SET audience = 'all'[\s\S]*WHERE audience IS NULL/.test(migration) &&
  /events_audience_check[\s\S]*CHECK \(audience IN/.test(migration) && audienceCheckPattern.test(migration) &&
  /events_audience_event_date_idx/.test(migration) &&
  /prepared for the owner to apply/i.test(migration));
check('schema', 'existing MySQL databases receive the column, index, and check idempotently',
  /TABLE_NAME = 'events'[\s\S]*COLUMN_NAME = 'audience'/.test(seed) &&
  /\['events', 'idx_events_audience_event_date'/.test(seed) &&
  /ensureCheckConstraint\([\s\S]*'events'[\s\S]*'chk_events_audience'/.test(seed));

if (failures.length > 0) {
  console.error(`EVENT-AUDIENCE-PROBE FAILED: ${failures.length}`);
  process.exitCode = 1;
} else {
  console.log('EVENT-AUDIENCE-PROBE OK');
}
