'use strict';

/*
 * CampuSphere ICTU Docker deployment contract probe.
 *
 * Database-free and secret-free. Static checks bind the production Compose,
 * environment template, runbook, Docker boundary, and server wiring together.
 * The runtime check imports the app in development/memory-session mode and
 * exercises only anonymous GET /healthz on an ephemeral local listener.
 */

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

let checks = 0;
let failures = 0;

function check(section, label, condition) {
  checks += 1;
  if (condition) {
    console.log(`  [PASS] ${section} :: ${label}`);
  } else {
    failures += 1;
    console.log(`  [FAIL] ${section} :: ${label}`);
  }
}

function hasRequiredInterpolation(source, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}:\\s*["']?\\$\\{${escaped}:\\?[^}]+\\}["']?`).test(source);
}

function staticContracts() {
  const server = read('server.js');
  const compose = read('docker-compose.production.yml');
  const envTemplate = read('deploy/ictu.env.example');
  const runbook = read('deploy/README-ICTU.md');
  const dockerignore = read('.dockerignore');
  const dockerfile = read('Dockerfile');

  const readinessIndex = server.indexOf('app.use(sessionReadiness.middleware)');
  const healthIndex = server.indexOf("app.get('/healthz'");
  const limiterIndex = server.indexOf('app.use(preParseAuthLimiter)');
  const sessionIndex = server.indexOf('app.use(session({');

  console.log('\n[ICTU Docker] health endpoint source contracts');
  check('health', 'GET /healthz is registered exactly once',
    (server.match(/app\.get\('\/healthz'/g) || []).length === 1);
  check('health', 'health runs after shared session readiness',
    readinessIndex >= 0 && healthIndex > readinessIndex);
  check('health', 'health runs before rate limiting and express-session',
    healthIndex >= 0 && healthIndex < limiterIndex && healthIndex < sessionIndex);
  check('health', 'healthy response is no-store and contains only status ok',
    /app\.get\('\/healthz'[\s\S]{0,500}Cache-Control['"],\s*['"]no-store[\s\S]{0,300}status\(200\)\.json\(\{ status: 'ok' \}\)/.test(server));
  check('health', 'health source does not name a backend, host, key, or version',
    !/app\.get\('\/healthz'[\s\S]{0,700}(?:supabase|mysql|credential|service[_ -]?role|version)/i.test(server));

  console.log('\n[ICTU Docker] production Compose contracts');
  const serviceNames = Array.from(compose.matchAll(/^  ([a-z][a-z0-9_-]*):\s*$/gm), (match) => match[1]);
  check('compose', 'exactly one app service is defined',
    serviceNames.length === 1 && serviceNames[0] === 'app');
  check('compose', 'logical container and image are CampuSphere-specific',
    /container_name:\s*campusphere-app/.test(compose) && /image:\s*campusphere:\$\{IMAGE_TAG:-ictu\}/.test(compose));
  check('compose', 'the reviewed production Dockerfile builds the app',
    /build:\s*[\s\S]{0,120}context:\s*\.[\s\S]{0,120}dockerfile:\s*Dockerfile/.test(compose));
  check('compose', 'no MySQL service or DB connection variable is present',
    !/^  mysql:\s*$/m.test(compose) && !/\bDB_(?:HOST|USER|PASS|NAME)\b/.test(compose));
  check('compose', 'runtime is fixed to production and trusted one-hop proxy',
    /NODE_ENV:\s*production/.test(compose) && /TRUST_PROXY:\s*["']1["']/.test(compose));
  check('compose', 'session store is fixed to Supabase', /SESSION_STORE:\s*supabase/.test(compose));
  for (const name of ['AUTH_DATA_SOURCE', 'CONTENT_DATA_SOURCE', 'BUILDING_DATA_SOURCE',
    'ROUTE_DATA_SOURCE', 'VR_DATA_SOURCE', 'SCHEDULE_DATA_SOURCE']) {
    check('compose', `${name} is fixed to Supabase`, new RegExp(`${name}:\\s*supabase`).test(compose));
  }
  check('compose', 'production map renderer is fixed to MapLibre', /MAP_RENDERER:\s*maplibre/.test(compose));
  check('compose', 'server-only Supabase settings are required substitutions',
    hasRequiredInterpolation(compose, 'SUPABASE_URL') &&
    hasRequiredInterpolation(compose, 'SUPABASE_SERVICE_ROLE_KEY'));
  check('compose', 'session and Google OAuth secrets are required substitutions',
    hasRequiredInterpolation(compose, 'SESSION_SECRET') &&
    hasRequiredInterpolation(compose, 'GOOGLE_CLIENT_ID') &&
    hasRequiredInterpolation(compose, 'GOOGLE_CLIENT_SECRET'));
  check('compose', 'OAuth callback is the exact ICTU HTTPS endpoint',
    compose.includes('GOOGLE_REDIRECT_URI: "https://campusphere.cspc.edu.ph/auth/callback"'));
  check('compose', 'signed Drive release settings are required without a private signing key',
    /OFFLINE_MAP_RELEASE_MODE:\s*["']?\$\{OFFLINE_MAP_RELEASE_MODE:-drive\}/.test(compose) &&
    hasRequiredInterpolation(compose, 'OFFLINE_MAP_MANIFEST_URL') &&
    hasRequiredInterpolation(compose, 'OFFLINE_MAP_SIGNING_PUBLIC_KEY') &&
    !/OFFLINE_MAP_SIGNING_PRIVATE_KEY/.test(compose));
  check('compose', 'host port defaults to loopback and remains explicitly overridable',
    compose.includes('${BIND_ADDRESS:-127.0.0.1}:${HOST_PORT:-3000}:3000'));
  check('compose', 'restart, init, and graceful-stop policies are present',
    /restart:\s*unless-stopped/.test(compose) && /init:\s*true/.test(compose) &&
    /stop_grace_period:\s*30s/.test(compose));
  check('compose', 'filesystem and Linux privilege hardening are present',
    /read_only:\s*true/.test(compose) && /\/tmp:size=64m,mode=1777/.test(compose) &&
    /no-new-privileges:true/.test(compose) && /cap_drop:[\s\S]{0,80}- ALL/.test(compose));
  check('compose', 'healthcheck uses bundled Node against loopback /healthz',
    /healthcheck:[\s\S]{0,700}\bnode\b[\s\S]{0,700}http:\/\/127\.0\.0\.1:3000\/healthz/.test(compose));
  check('compose', 'health timing is bounded',
    /interval:\s*30s/.test(compose) && /timeout:\s*5s/.test(compose) &&
    /retries:\s*3/.test(compose) && /start_period:\s*20s/.test(compose));

  console.log('\n[ICTU Docker] handoff and secret-boundary contracts');
  for (const name of ['SESSION_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
    'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'OFFLINE_MAP_MANIFEST_URL',
    'OFFLINE_MAP_SIGNING_PUBLIC_KEY']) {
    check('env template', `${name} is represented by a placeholder`,
      new RegExp(`^${name}=.+`, 'm').test(envTemplate));
  }
  check('env template', 'template contains no private signing-key variable',
    !/OFFLINE_MAP_SIGNING_PRIVATE_KEY/.test(envTemplate));
  check('env template', 'template contains no live Supabase key or legacy service-role JWT',
    !/sb_secret_[A-Za-z0-9_-]{20,}/.test(envTemplate) &&
    !/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(envTemplate));
  check('runbook', 'one-container external-Supabase architecture is explicit',
    /one Docker application container/i.test(runbook) && /Supabase remains the external[\s\S]{0,100}PostgreSQL/i.test(runbook));
  check('runbook', 'ICTU hostname, TLS, proxy target, and forwarded HTTPS are explicit',
    runbook.includes('campusphere.cspc.edu.ph') && /TLS termination/i.test(runbook) &&
    runbook.includes('http://127.0.0.1:3000') && runbook.includes('X-Forwarded-Proto: https'));
  check('runbook', 'required outbound services and single-replica boundary are explicit',
    /outbound HTTPS/i.test(runbook) && /Supabase project API/i.test(runbook) &&
    /Google OAuth/i.test(runbook) && /Google Drive/i.test(runbook) &&
    /exactly one application replica/i.test(runbook));
  check('runbook', 'validation, build, start, health, stop, update, and rollback are documented',
    /config --quiet/.test(runbook) && /build --pull app/.test(runbook) &&
    /up -d app/.test(runbook) && /State\.Health\.Status/.test(runbook) &&
    /\bdown\b/.test(runbook) && /## Update and rollback/.test(runbook));
  check('runbook', 'migration/data mutation is explicitly prohibited',
    /must not apply,\s*reapply,\s*bootstrap,\s*seed,\s*or roll back any migration or application data/i.test(runbook));
  check('runbook', 'real environment files stay outside Git and rendered secrets stay unprinted',
    /protected path outside the repository/i.test(runbook) &&
    /Never\s+print the rendered Compose configuration/i.test(runbook));
  check('docker boundary', 'Compose and deploy support files are outside the image build context',
    /docker-compose\*\.yml/.test(dockerignore) && /^\/deploy\/$/m.test(dockerignore));
  check('docker boundary', 'production image remains explicit-copy and non-root',
    !/^COPY\s+\.\s+\.\s*$/m.test(dockerfile) && /USER\s+node/.test(dockerfile) &&
    /ENV\s+NODE_ENV=production/.test(dockerfile));
}

async function runtimeHealthContract() {
  console.log('\n[ICTU Docker] anonymous health runtime contract');

  process.env.VERCEL = '0';
  process.env.NODE_ENV = 'development';
  process.env.DOTENV_CONFIG_QUIET = 'true';
  process.env.SESSION_STORE = 'memory';
  process.env.SESSION_SECRET = 'ictu-health-probe-only-secret-000000000000';
  process.env.AUTH_DATA_SOURCE = 'mysql';
  process.env.CONTENT_DATA_SOURCE = 'mysql';
  process.env.BUILDING_DATA_SOURCE = 'mysql';
  process.env.ROUTE_DATA_SOURCE = 'mysql';
  process.env.VR_DATA_SOURCE = 'mysql';
  process.env.SCHEDULE_DATA_SOURCE = 'mysql';

  // server.js loads dotenv for ordinary local development. Import from an
  // isolated empty working directory so this probe can never read the
  // repository's ignored .env while still resolving source via __dirname.
  const originalCwd = process.cwd();
  const isolatedCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'campusphere-ictu-health-'));
  let app;
  try {
    process.chdir(isolatedCwd);
    app = require('../server');
  } finally {
    process.chdir(originalCwd);
    const resolvedTempRoot = fs.realpathSync(os.tmpdir());
    const resolvedIsolatedCwd = fs.realpathSync(isolatedCwd);
    if (!resolvedIsolatedCwd.startsWith(resolvedTempRoot + path.sep)) {
      throw new Error('isolated health directory escaped the temporary root');
    }
    fs.rmSync(resolvedIsolatedCwd, { recursive: true, force: true });
  }
  const listener = http.createServer(app);

  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });

  try {
    const address = listener.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/healthz`, {
      redirect: 'manual',
      headers: { Accept: 'application/json' },
    });
    const body = await response.text();

    check('runtime', 'GET /healthz returns HTTP 200', response.status === 200);
    check('runtime', 'body is the exact minimal JSON contract', body === '{"status":"ok"}');
    check('runtime', 'response is JSON and no-store',
      /^application\/json\b/i.test(response.headers.get('content-type') || '') &&
      response.headers.get('cache-control') === 'no-store');
    check('runtime', 'anonymous health creates no session cookie', !response.headers.has('set-cookie'));
    check('runtime', 'security and crawler headers remain present',
      response.headers.get('x-content-type-options') === 'nosniff' &&
      /noindex/i.test(response.headers.get('x-robots-tag') || ''));
  } finally {
    if (typeof listener.closeAllConnections === 'function') listener.closeAllConnections();
    await new Promise((resolve) => listener.close(resolve));
  }
}

async function main() {
  staticContracts();
  await runtimeHealthContract();

  if (failures > 0) {
    console.log(`\nICTU-DOCKER-DEPLOYMENT-PROBE FAILED: ${failures}/${checks}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nICTU-DOCKER-DEPLOYMENT-PROBE OK: ${checks}/${checks}`);
}

main().catch(() => {
  console.log('\nICTU-DOCKER-DEPLOYMENT-PROBE FAILED: unexpected sanitized failure');
  process.exitCode = 1;
});
