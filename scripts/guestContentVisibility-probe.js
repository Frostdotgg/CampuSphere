'use strict';

// Real controllers, EJS and repository adapters with disposable in-memory data.
// No shared credentials, environment loading or provider connections.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { fixture } = require('./departmentNewsAdmin-probe');
const sourceArg = process.argv.find(value => value.startsWith('--source-root='));
const root = sourceArg ? path.resolve(sourceArg.slice('--source-root='.length)) : path.join(__dirname, '..');
const departments = ['graduate-school', 'cea', 'ccs', 'chs', 'cthbm', 'ctde', 'cas'];
const audiences = ['all', 'student-cspc', 'instructor', 'guest', 'admin'];
let checks = 0;
const failures = [];
function check(label, fn) {
  checks += 1;
  try { fn(); console.log('[PASS] ' + label); }
  catch (error) { failures.push(label + ': ' + error.message); console.log('[FAIL] ' + label + ': ' + error.message); }
}
function jsonData(html, id) {
  const match = html.match(new RegExp('id="' + id + '"[^>]*>([\\s\\S]*?)<\\/script>'));
  assert.ok(match, 'Expected server JSON: ' + id);
  return JSON.parse(match[1]);
}
function permittedEvent(row, role) {
  return ['all', role].includes(row.audience) && (role !== 'guest' || row.department_code === 'university-wide');
}
function seed(state) {
  let id = 1000;
  for (const department of ['university-wide', ...departments, '', null, 'unknown', 'campus-wide']) {
    for (const audience of audiences) state.tables.events.push({ id: id++, title: 'EVENT-' + department + '-' + audience, category: 'Academic', audience, department_code: department, event_date: '2099-11-01', event_time: '09:00', location: 'Synthetic venue', description: 'Synthetic event body', updated_at: '2026-10-27T00:00:00Z' });
  }
  for (const department of departments) for (const audience of audiences) state.tables.news_announcements.push({ id: id++, title: 'NEWS-CANARY-' + department + '-' + audience, category: 'General', audience, department_code: department, excerpt: 'EXCERPT-CANARY-' + audience, content: 'BODY-CANARY-' + audience, published_date: '2026-10-27T00:00:00Z' });
  state.tables.news_announcements.push({ id: id++, title: 'DRAFT-CANARY', category: 'General', audience: 'all', department_code: 'ccs', content: 'DRAFT-BODY-CANARY', published_date: null });
  state.tables.events.push({ id: id++, title: 'PAST-CAMPUS-EVENT', category: 'Cultural', audience: 'all', department_code: 'university-wide', event_date: '2001-01-01' });
  return id;
}
async function run() {
  for (const mode of ['mysql', 'supabase']) {
    const f = fixture(mode, { sourceRoot: root });
    let next = seed(f.state);
    const server = await new Promise(resolve => { const s = f.app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = 'http://127.0.0.1:' + server.address().port;
    async function request(url, jar = {}, method = 'GET', body) {
      const response = await fetch(base + url, { method, redirect: 'manual', headers: { ...(jar.cookie ? { Cookie: jar.cookie } : {}), ...(jar.token ? { 'X-CSRF-Token': jar.token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const text = await response.text();
      return { status: response.status, text, cache: response.headers.get('cache-control'), cookie: response.headers.get('set-cookie')?.split(';')[0] || jar.cookie, body: (() => { try { return JSON.parse(text); } catch { return null; } })() };
    }
    async function login(id) {
      const result = await request('/fixture/login/' + id), jar = { cookie: result.cookie };
      jar.token = (await request('/auth/csrf-token', jar)).body.csrfToken;
      return jar;
    }
    try {
      const guest = await login(4), admin = await login(1), departmentAdmin = await login(5);
      for (const suffix of ['', '?section=news-events', '?section=news', '?section=announcements']) {
        const before = f.state.queries.length, readsBefore = f.state.reads.length, response = await request('/dashboard' + suffix, guest);
        check(mode + ' guest dashboard sends no news data ' + suffix, () => {
          assert.equal(response.status, 200); assert.deepEqual(jsonData(response.text, 'dbNewsData'), []);
          assert.ok(!/NEWS-CANARY|EXCERPT-CANARY|BODY-CANARY|DRAFT-CANARY/.test(response.text));
        });
        check(mode + ' guest skips announcement reads ' + suffix, () => { assert.ok(!f.state.queries.slice(before).some(sql => /FROM news_announcements/.test(sql))); assert.ok(!f.state.reads.slice(readsBefore).includes('news_announcements')); });
      }
      for (const [id, role] of [[4, 'guest'], [2, 'student-cspc'], [3, 'instructor'], [1, 'admin']]) {
        const jar = await login(id), response = await request('/events?department=ccs', jar), rows = jsonData(response.text, 'eventsData');
        const expected = f.state.tables.events.filter(row => permittedEvent(row, role)).map(row => row.title).sort();
        check(mode + ' complete event visibility matrix ' + role, () => { assert.equal(response.status, 200); assert.deepEqual(rows.map(row => row.title).sort(), expected); });
        if (role === 'guest') check(mode + ' guest events has no department picker', () => { assert.ok(!response.text.includes('id="events-department"')); assert.ok(response.text.includes('Campus-wide events')); });
        else {
          const news = await request('/dashboard', jar);
          check(mode + ' campus readers keep published audience filtering ' + role, () => { const articles = jsonData(news.text, 'dbNewsData'); assert.ok(articles.length); assert.ok(articles.every(row => row.published_date && ['all', role].includes(row.audience))); assert.ok(!news.text.includes('DRAFT-BODY-CANARY')); });
        }
      }
      // Department events crowd both ends of the ordering. Guest filtering must
      // happen before the home limit (2) and notification limit (5).
      for (let i = 0; i < 8; i++) for (const date of ['2090-01-01', '2100-01-01']) f.state.tables.events.push({ id: next++, title: 'CROWD-DEPARTMENT-' + i + '-' + date, category: 'Sports', audience: 'all', department_code: 'ccs', event_date: date });
      for (let i = 0; i < 7; i++) f.state.tables.events.push({ id: next++, title: 'CAMPUS-ELIGIBLE-' + i, category: 'Cultural', audience: i % 2 ? 'guest' : 'all', department_code: 'university-wide', event_date: '2098-06-0' + (i + 1), updated_at: '2026-10-27T00:00:00Z' });
      const eligible = f.state.tables.events.filter(row => permittedEvent(row, 'guest'));
      const home = await request('/home', guest), latest = eligible.slice().sort((a, b) => b.event_date.localeCompare(a.event_date) || b.id - a.id).slice(0, 2);
      check(mode + ' Home filters before latest-two limit', () => { assert.equal(home.status, 200); assert.ok(latest.every(row => home.text.includes(row.title))); assert.ok(!home.text.includes('CROWD-DEPARTMENT')); });
      const feed = await request('/api/notifications', guest), upcoming = eligible.filter(row => row.event_date >= '2026-10-27').sort((a, b) => a.event_date.localeCompare(b.event_date) || a.id - b.id).slice(0, 5);
      check(mode + ' guest feed is private and events-only before limit', () => { assert.equal(feed.status, 200); assert.equal(feed.cache, 'no-store, private'); assert.deepEqual(feed.body.announcements, []); assert.equal(feed.body.links.announcements, null); assert.equal(feed.body.links.events, '/events'); assert.deepEqual(feed.body.events.map(row => row.title), upcoming.map(row => row.title)); assert.ok(!/CANARY|DEPARTMENT|PAST-CAMPUS/.test(feed.text)); });
      const restricted = f.state.tables.events.find(row => row.title.startsWith('CROWD-DEPARTMENT'));
      restricted.title = 'RESTRICTED-CHANGED-CANARY'; restricted.updated_at = '2026-10-28T00:00:00Z';
      f.state.tables.news_announcements[0].title = 'RESTRICTED-NEWS-CHANGED';
      const afterHiddenEdit = await request('/api/notifications', guest);
      check(mode + ' restricted edits cannot trigger the guest unread revision', () => assert.equal(afterHiddenEdit.body.revision, feed.body.revision));
      const visible = f.state.tables.events.find(row => row.title === upcoming[0].title); visible.description = 'ELIGIBLE-EDITED';
      const afterVisibleEdit = await request('/api/notifications', guest);
      check(mode + ' eligible event edits change the guest revision', () => assert.notEqual(afterVisibleEdit.body.revision, feed.body.revision));
      const defensive = f.notificationService.buildNotificationFeed({ role: 'guest', announcements: f.state.tables.news_announcements, events: f.state.tables.events });
      check(mode + ' feed projection rejects unfiltered restricted rows defensively', () => { assert.deepEqual(defensive.announcements, []); assert.ok(defensive.events.length); assert.ok(defensive.events.every(item => f.state.tables.events.some(row => row.title === item.title && permittedEvent(row, 'guest')))); });
      for (const actor of [admin, departmentAdmin]) {
        const payload = { title: 'Disposable news save', category: 'General', department_code: 'ccs', excerpt: 'Synthetic excerpt', content: 'Synthetic body', status: 'published', audience: 'guest' };
        for (const method of ['POST', 'PUT']) {
          const before = f.state.writes, denied = await request('/admin/api/news' + (method === 'PUT' ? '/' + f.state.tables.news_announcements[0].id : ''), actor, method, payload);
          check(mode + ' rejects new or updated guest news ' + method + '/' + (actor === admin ? 'admin' : 'department-admin'), () => { assert.equal(denied.status, 400); assert.equal(f.state.writes, before); });
        }
        for (const audience of ['all', 'student-cspc', 'instructor', 'admin']) {
          const saved = await request('/admin/api/news', actor, 'POST', { ...payload, audience });
          check(mode + ' supported News audience persists ' + audience, () => { assert.equal(saved.status, 201); assert.equal(saved.body.article.audience, audience); });
        }
        const legacy = f.state.tables.news_announcements.find(row => row.audience === 'guest'), before = JSON.stringify(legacy);
        for (const value of [undefined, null, '   ']) {
          const body = { ...payload }; if (value === undefined) delete body.audience; else body.audience = value;
          const response = await request('/admin/api/news/' + legacy.id, actor, 'PUT', body);
          check(mode + ' missing legacy audience cannot retarget News ' + String(value), () => { assert.equal(response.status, 400); assert.equal(JSON.stringify(legacy), before); });
        }
        const editor = await request('/admin/news', actor), empty = await request('/admin/api/news/' + legacy.id, actor, 'PUT', { ...payload, audience: '' });
        check(mode + ' legacy guest News stays admin-readable without automatic retargeting', () => { assert.ok(editor.text.includes(legacy.title)); assert.equal(empty.status, 400); assert.equal(JSON.stringify(legacy), before); const select = editor.text.match(/id="news-audience"[^>]*>([\s\S]*?)<\/select>/)[1]; assert.ok(!select.includes('value="guest"')); assert.ok(select.includes('Students, instructors and admins')); });
        const changed = await request('/admin/api/news/' + legacy.id, actor, 'PUT', { ...payload, audience: 'instructor' });
        check(mode + ' legacy News changes audience only through an explicit save', () => { assert.equal(changed.status, 200); assert.equal(changed.body.article.audience, 'instructor'); });
        const event = await request('/admin/api/events', actor, 'POST', { title: 'Guest event stays supported', category: 'Academic', department_code: 'university-wide', audience: 'guest', event_date: '2099-01-01' });
        check(mode + ' Guests remains a valid Events audience', () => assert.equal(event.status, 201));
      }
      const deniedWrite = await request('/admin/api/news', guest, 'POST', {}), csrf = await request('/admin/api/news', { cookie: admin.cookie }, 'POST', {}), anonymous = await request('/api/notifications');
      check(mode + ' guest mutation and CSRF guards remain enforced', () => { assert.equal(deniedWrite.status, 403); assert.equal(csrf.status, 403); assert.equal(anonymous.status, 401); });
      f.state.tables.events = f.state.tables.events.filter(row => !permittedEvent(row, 'guest'));
      const empty = await request('/api/notifications', guest), emptyEvents = await request('/events', guest);
      check(mode + ' no eligible events produces a genuinely empty guest feed', () => { assert.deepEqual(empty.body.events, []); assert.deepEqual(empty.body.announcements, []); assert.equal(empty.body.links.announcements, null); assert.deepEqual(jsonData(emptyEvents.text, 'eventsData'), []); });
      f.state.fail = true;
      const unavailable = await request('/api/notifications', guest), eventsUnavailable = await request('/events', guest), homeUnavailable = await request('/home', guest), dashboardUnavailable = await request('/dashboard', guest);
      check(mode + ' failed reads never reveal wider content or provider details', () => { assert.equal(unavailable.status, 503); assert.ok(!unavailable.text.includes('PRIVATE')); assert.deepEqual(jsonData(eventsUnavailable.text, 'eventsData'), []); assert.deepEqual(jsonData(dashboardUnavailable.text, 'dbNewsData'), []); assert.ok(!/EVENT-|CANARY/.test(homeUnavailable.text)); });
      f.state.fail = false;
      check(mode + ' retry recovers without fallback content', () => assert.equal(f.notificationService.buildNotificationFeed({ role: 'guest' }).announcements.length, 0));
      const retried = await request('/api/notifications', guest); check(mode + ' successful retry returns filtered feed', () => { assert.equal(retried.status, 200); assert.deepEqual(retried.body.events, []); });
    } finally { await new Promise(resolve => f.store.clear(resolve)); await new Promise(resolve => server.close(resolve)); }
  }
  const view = fs.readFileSync(path.join(root, 'views/dashboard.ejs'), 'utf8'), client = fs.readFileSync(path.join(root, 'public/js/data.js'), 'utf8');
  check('guest menu and reading template are removed', () => { const nav = client.match(/'guest':\s*\[([\s\S]*?)\]/)[1]; assert.ok(!nav.includes('news-events')); assert.ok(!view.includes('tmpl-guest-news-events')); const overview = view.match(/id="tmpl-guest-overview">([\s\S]*?)<\/script>/)[1]; assert.ok(!/news\.length|read news|stat-card__label">News/.test(overview)); });
  if (failures.length) throw new Error(failures.length + '/' + checks + ' failed\n' + failures.join('\n'));
  console.log('GUEST-CONTENT-VISIBILITY OK: ' + checks + '/' + checks);
}
if (require.main === module) run().catch(error => { console.error('GUEST-CONTENT-VISIBILITY FAIL: ' + error.stack); process.exitCode = 1; });
