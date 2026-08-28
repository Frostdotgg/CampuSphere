'use strict';

/* ========================================
   CampuSphere - bounded local site-settings runtime probe

   STANDALONE and MYSQL-ONLY. This probe exercises the real admin settings
   HTTP API and the public server-rendered projection against the current
   local database. It is deliberately NOT registered in npm test because the
   valid Save step is a database mutation and creates an audit event.

   Scope:
     - local, non-Production server only (dedicated port 3498)
     - one temporary reversible two-block school_description marker, then
       exact ten-key restoration
     - no direct SQL, repository handle, migration, seed, Supabase, or Vercel
     - credentials, cookies, CSRF tokens, settings values, and response bodies
       stay in memory and are never printed

   Normal run:
     node scripts/siteSettingsRuntime-probe.js

   Recovery after an interrupted normal run (decodes one exact description
   marker envelope):
     node scripts/siteSettingsRuntime-probe.js --restore-only

   The normal Save + restore intentionally leaves the two legitimate
   admin.settings.update audit rows required to record those actions.
   ======================================== */

require('dotenv').config();

const net = require('net');
const { withServer } = require('./with-server');
const { getRegressionCredentials } = require('./regressionCredentials');
const { createProbeSessionTracker, getStableCsrfToken } = require('./probeSessionLifecycle');
const {
  SCHOOL_DESCRIPTION_MAX_LENGTH,
  splitSchoolDescription,
} = require('../utils/siteSettingsDescription');

const PORT = 3498;
const OVERVIEW_MARKER = '[LOCAL DESCRIPTION OVERVIEW]';
const CONTEXT_MARKER = '[LOCAL DESCRIPTION CONTEXT]';
const DESCRIPTION_MARKER_PREFIX = `${OVERVIEW_MARKER} `;
const DESCRIPTION_CONTEXT_PREFIX = `${CONTEXT_MARKER} `;
const DESCRIPTION_OVERVIEW_TAG = '<b>runtime probe</b>';
const DESCRIPTION_CONTEXT_TAG = '<script>runtime-probe</script>';
const SETTINGS_KEYS = Object.freeze([
  'school_name',
  'school_acronym',
  'school_address',
  'school_founded',
  'school_description',
  'contact_address',
  'contact_phone',
  'contact_email',
  'contact_website',
  'contact_hours',
]);
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

const failures = [];
let checks = 0;

function check(scope, label, condition) {
  checks += 1;
  const passed = Boolean(condition);
  console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!passed) failures.push(`${scope} :: ${label}`);
}

function cookieJar() {
  const cookies = new Map();
  return {
    apply(response) {
      const list = typeof response.headers.getSetCookie === 'function'
        ? (response.headers.getSetCookie() || [])
        : (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')] : []);
      for (const raw of list) {
        const pair = String(raw).split(';')[0];
        const separator = pair.indexOf('=');
        if (separator > 0) {
          cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
        }
      }
    },
    header() {
      return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
    },
  };
}

function metaCsrf(html) {
  const match = /<meta name="csrf-token" content="([^"]*)"/.exec(html || '');
  return match ? match[1] : '';
}

function parseJson(text) {
  try { return JSON.parse(text); } catch (error) { return null; }
}

function exactSettingsObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === [...SETTINGS_KEYS].sort().join(',') &&
    SETTINGS_KEYS.every((key) => typeof value[key] === 'string');
}

function settingsEqual(left, right) {
  return exactSettingsObject(left) && exactSettingsObject(right) &&
    SETTINGS_KEYS.every((key) => left[key] === right[key]);
}

function htmlEscape(value) {
  const entities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&#34;',
    "'": '&#39;',
  };
  return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => entities[character]);
}

function encodeRecoveryValue(value) {
  return Buffer.from(String(value), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeRecoveryValue(token) {
  if (!/^[A-Za-z0-9_-]+$/.test(token || '')) return null;
  const padded = token.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (token.length % 4)) % 4);
  const decoded = Buffer.from(padded, 'base64').toString('utf8');
  return encodeRecoveryValue(decoded) === token ? decoded : null;
}

function buildDescriptionMarker(originalDescription) {
  const encoded = encodeRecoveryValue(originalDescription);
  const marked = `${DESCRIPTION_MARKER_PREFIX}${encoded} ${DESCRIPTION_OVERVIEW_TAG}\n\n${DESCRIPTION_CONTEXT_PREFIX}${DESCRIPTION_CONTEXT_TAG}`;
  return marked.length <= SCHOOL_DESCRIPTION_MAX_LENGTH ? marked : '';
}

function recoverDescriptionMarker(markedDescription) {
  const blocks = splitSchoolDescription(markedDescription);
  if (blocks.length !== 2 || !blocks[0].startsWith(DESCRIPTION_MARKER_PREFIX) ||
      !blocks[1].startsWith(DESCRIPTION_CONTEXT_PREFIX)) return null;

  const encoded = blocks[0].slice(DESCRIPTION_MARKER_PREFIX.length).split(/\s+/, 1)[0];
  const original = decodeRecoveryValue(encoded);
  if (original === null || buildDescriptionMarker(original) !== blocks.join('\n\n')) return null;
  return original;
}

function institutionParagraphs(html) {
  const start = String(html || '').indexOf('<section class="split-block">');
  if (start < 0) return [];
  const end = String(html || '').indexOf('</section>', start);
  const section = String(html || '').slice(start, end >= 0 ? end : undefined);
  return [...section.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((match) => match[1]);
}

function metaDescription(html) {
  const match = /<meta name="description"\s+content="([\s\S]*?)">/i.exec(String(html || ''));
  return match ? match[1] : '';
}

function localEnvironmentProblems() {
  const problems = [];
  const nodeEnv = String(process.env.NODE_ENV || 'development').trim().toLowerCase();
  const dbHost = String(process.env.DB_HOST || '127.0.0.1').trim().toLowerCase();
  const dbName = String(process.env.DB_NAME || 'campusphere_db').trim();
  const vercel = String(process.env.VERCEL || '').trim();
  const vercelEnv = String(process.env.VERCEL_ENV || '').trim();

  if (nodeEnv === 'production') problems.push('Production NODE_ENV is not allowed');
  if (vercel || vercelEnv) problems.push('Vercel execution is not allowed');
  if (!LOCAL_HOSTS.has(dbHost)) problems.push('DB_HOST is not a local host');
  if (dbName !== 'campusphere_db') problems.push('DB_NAME is not the local campusphere_db');
  return problems;
}

function portIsFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    const finish = (free) => {
      try { probe.close(); } catch (error) { /* already closed */ }
      resolve(free);
    };
    probe.once('error', () => finish(false));
    probe.once('listening', () => finish(true));
    probe.listen(port, '127.0.0.1');
  });
}

async function request(base, path, options, capturedBodies) {
  const response = await fetch(base + path, options);
  const text = await response.text();
  capturedBodies.push(text);
  return { response, text, json: parseJson(text) };
}

async function loginAdmin(base, capturedBodies) {
  const credentials = getRegressionCredentials('mysql').admin;
  const jar = cookieJar();
  const auth = await request(base, '/auth', { headers: { Accept: 'text/html' } }, capturedBodies);
  jar.apply(auth.response);
  const csrf = metaCsrf(auth.text);
  if (!csrf) return { ok: false, jar };

  const login = await request(base, '/login', {
    method: 'POST',
    redirect: 'manual',
    headers: {
      Accept: 'text/html',
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: jar.header(),
    },
    body: `email=${encodeURIComponent(credentials.email)}&password=${encodeURIComponent(credentials.password)}&_csrf=${encodeURIComponent(csrf)}`,
  }, capturedBodies);
  jar.apply(login.response);
  return {
    ok: login.response.status === 302,
    jar,
  };
}

async function readSettings(base, jar, capturedBodies) {
  const result = await request(base, '/admin/api/settings', {
    headers: { Accept: 'application/json', Cookie: jar.header() },
  }, capturedBodies);
  return result.response.status === 200 && result.json && result.json.success === true
    ? result.json.settings
    : null;
}

async function putSettings(base, jar, values, capturedBodies) {
  const csrf = await getStableCsrfToken({ base, jar });
  if (!csrf) return { status: 0, json: null };
  const result = await request(base, '/admin/api/settings', {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf,
      Cookie: jar.header(),
    },
    body: JSON.stringify(values),
  }, capturedBodies);
  return { status: result.response.status, json: result.json };
}

async function renderPage(base, path, jar, capturedBodies) {
  const headers = { Accept: 'text/html' };
  if (jar) headers.Cookie = jar.header();
  return request(base, path, { headers }, capturedBodies);
}

async function runMode(base, { restoreOnly = false } = {}) {
  const capturedBodies = [];
  const sessions = createProbeSessionTracker({
    base,
    record: (label, passed) => check('session', label, passed),
  });
  let admin = null;
  let baseline = null;
  let mutationAttempted = false;
  let restoreTarget = null;

  try {
    const anonymous = await request(base, '/admin/api/settings', {
      headers: { Accept: 'application/json' },
    }, capturedBodies);
    check('authorization', 'anonymous settings API is denied', anonymous.response.status === 401);

    admin = await loginAdmin(base, capturedBodies);
    check('authentication', 'local admin login succeeds', admin.ok);
    if (!admin.ok) return;
    sessions.register('admin', admin.jar, '/admin/settings');

    baseline = await readSettings(base, admin.jar, capturedBodies);
    check('settings API', 'admin GET returns the exact ten string settings', exactSettingsObject(baseline));
    if (!baseline) return;

    const settingsPage = await renderPage(base, '/admin/settings', admin.jar, capturedBodies);
    check('admin page', 'settings page renders with no-store private caching',
      settingsPage.response.status === 200 &&
      /no-store/i.test(settingsPage.response.headers.get('cache-control') || '') &&
      settingsPage.text.includes('settings-form') &&
      settingsPage.text.includes('settings-preview-link'));

    if (restoreOnly) {
      const recoveredDescription = recoverDescriptionMarker(baseline.school_description);
      check('recovery', 'restore-only sees the exact interrupted description marker', recoveredDescription !== null);
      if (recoveredDescription !== null) {
        const recovered = { ...baseline, school_description: recoveredDescription };
        mutationAttempted = true;
        restoreTarget = recovered;
        const restored = await putSettings(base, admin.jar, recovered, capturedBodies);
        const after = await readSettings(base, admin.jar, capturedBodies);
        const recoverySucceeded = restored.status === 200 && settingsEqual(after, recovered);
        check('recovery', 'restore-only removes one marker and preserves all other settings', recoverySucceeded);
        if (recoverySucceeded) mutationAttempted = false;
      }
      return;
    }

    const probeDescription = buildDescriptionMarker(baseline.school_description);
    check('safety', 'original description is unmarked, non-empty, and has room for the temporary envelope',
      typeof baseline.school_description === 'string' && baseline.school_description.trim() !== '' &&
      !baseline.school_description.includes(OVERVIEW_MARKER) &&
      !baseline.school_description.includes(CONTEXT_MARKER) && Boolean(probeDescription));
    if (typeof baseline.school_description !== 'string' || baseline.school_description.trim() === '' ||
        baseline.school_description.includes(OVERVIEW_MARKER) || baseline.school_description.includes(CONTEXT_MARKER) ||
        !probeDescription) return;

    const invalid = { ...baseline, contact_website: 'javascript:alert(1)' };
    const rejected = await putSettings(base, admin.jar, invalid, capturedBodies);
    const unchanged = await readSettings(base, admin.jar, capturedBodies);
    check('validation', 'javascript website is rejected without changing settings',
      rejected.status === 400 && settingsEqual(unchanged, baseline));

    const invalidDescription = { ...baseline, school_description: 'one paragraph\n\ntwo paragraphs\n\nthree paragraphs' };
    const rejectedDescription = await putSettings(base, admin.jar, invalidDescription, capturedBodies);
    const unchangedAfterDescription = await readSettings(base, admin.jar, capturedBodies);
    check('validation', 'a third Description paragraph is rejected without changing settings',
      rejectedDescription.status === 400 && settingsEqual(unchangedAfterDescription, baseline));

    const markedSettings = { ...baseline, school_description: probeDescription };
    mutationAttempted = true;
    restoreTarget = baseline;
    const saved = await putSettings(base, admin.jar, markedSettings, capturedBodies);
    const persisted = await readSettings(base, admin.jar, capturedBodies);
    check('save', 'valid two-block Description saves and reads back through the API',
      saved.status === 200 && settingsEqual(persisted, markedSettings) &&
      splitSchoolDescription(persisted.school_description).length === 2);

    const about = await renderPage(base, '/about', admin.jar, capturedBodies);
    const paragraphs = institutionParagraphs(about.text);
    const overviewParagraph = paragraphs[0] || '';
    const contextParagraph = paragraphs[1] || '';
    const managedFacts = `${htmlEscape(baseline.school_acronym)} was founded in ${htmlEscape(baseline.school_founded)} and is located at ${htmlEscape(baseline.school_address)}.`;
    const meta = metaDescription(about.text);
    check('projection', 'About renders overview and context as separate institution paragraphs',
      about.response.status === 200 && overviewParagraph.includes(OVERVIEW_MARKER) &&
      !overviewParagraph.includes(CONTEXT_MARKER) && contextParagraph.includes(CONTEXT_MARKER) &&
      contextParagraph.includes(managedFacts));
    check('projection', 'About escapes Description markup in both paragraphs',
      overviewParagraph.includes('&lt;b&gt;runtime probe&lt;/b&gt;') &&
      contextParagraph.includes('&lt;script&gt;runtime-probe&lt;/script&gt;') &&
      !about.text.includes(DESCRIPTION_OVERVIEW_TAG) && !about.text.includes(DESCRIPTION_CONTEXT_TAG));
    check('projection', 'About metadata contains only the overview block',
      meta.includes(OVERVIEW_MARKER) && !meta.includes(CONTEXT_MARKER) &&
      !meta.includes(DESCRIPTION_CONTEXT_TAG));
  } catch (error) {
    check('runtime', 'HTTP probe completed without an unexpected failure', false);
  } finally {
    try {
      if (mutationAttempted && admin && restoreTarget) {
        try {
          const restored = await putSettings(base, admin.jar, restoreTarget, capturedBodies);
          const after = await readSettings(base, admin.jar, capturedBodies);
          const restoredExactly = restored.status === 200 && settingsEqual(after, restoreTarget);
          check('restore', 'exact original ten-key settings are restored', restoredExactly);

          const aboutAfter = await renderPage(base, '/about', admin.jar, capturedBodies);
          check('restore', 'restored About page no longer carries the Description markers',
            restoredExactly && aboutAfter.response.status === 200 &&
            !aboutAfter.text.includes(OVERVIEW_MARKER) && !aboutAfter.text.includes(CONTEXT_MARKER));
        } catch (error) {
          check('restore', 'exact original ten-key settings are restored', false);
        }
      }
    } finally {
      await sessions.terminateAll();
    }
  }

  const leakPatterns = [
    /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
    /[a-z0-9-]+\.supabase\.(co|com|in)/i,
    /\bat [\w.$<>[\] ]+ \((?:file:\/\/|\/|[A-Za-z]:\\)[^)]*:\d+:\d+\)/,
    /sqlMessage/i,
    /\bER_[A-Z0-9_]{3,}\b/,
    /SQLSTATE/i,
    /PostgREST/i,
    /relation "[^"]+" does not exist/i,
    /campusphere\.sid=[^;\s<"']+/i,
    /SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY|CLOUDINARY_API_KEY|CLOUDINARY_API_SECRET/i,
  ];
  check('security', 'captured responses contain no credential, cookie, stack, or database leak',
    capturedBodies.every((body) => !leakPatterns.some((pattern) => pattern.test(body))));
}

async function main() {
  const environmentProblems = localEnvironmentProblems();
  check('preflight', 'execution environment is local MySQL and non-Production', environmentProblems.length === 0);
  if (environmentProblems.length > 0) {
    environmentProblems.forEach(() => console.error('  - preflight rejected a non-local runtime environment'));
  }

  const free = await portIsFree(PORT);
  check('preflight', 'dedicated port 3498 is free before starting', free);
  if (environmentProblems.length > 0 || !free) {
    console.error(`SITE-SETTINGS-RUNTIME-PROBE FAILED: ${failures.length}/${checks} checks failed.`);
    process.exitCode = 1;
    return;
  }

  try {
    await withServer({ mode: 'mysql', port: PORT, sessionStore: 'mysql' }, (base) =>
      runMode(base, { restoreOnly: process.argv.includes('--restore-only') }));
  } catch (error) {
    check('runtime', 'self-terminating local server harness completed', false);
  }

  if (failures.length === 0) {
    console.log(`SITE-SETTINGS-RUNTIME-PROBE OK: ${checks}/${checks}`);
    console.log('NOTE: the temporary save and restore leave two legitimate admin.settings.update audit events.');
    process.exitCode = 0;
  } else {
    console.error(`SITE-SETTINGS-RUNTIME-PROBE FAILED: ${failures.length}/${checks} checks failed.`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch(() => {
    console.error('SITE-SETTINGS-RUNTIME-PROBE FAILED: unexpected sanitized failure.');
    process.exitCode = 1;
  });
}

module.exports = {
  OVERVIEW_MARKER,
  CONTEXT_MARKER,
  SETTINGS_KEYS,
  exactSettingsObject,
  settingsEqual,
  localEnvironmentProblems,
  portIsFree,
  buildDescriptionMarker,
  recoverDescriptionMarker,
};
