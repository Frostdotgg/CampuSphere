'use strict';

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const HOST = '127.0.0.1';
const PORT = 3397;
const ROOT = path.resolve(__dirname, '..');
const K6_SCRIPT = path.join(ROOT, 'load-tests', 'production', 'lt-07-offline-navigation-regression.js');

const ONLINE_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>LT-07 online fixture</title></head>
<body class="online-page">
  <main>Online fixture</main>
  <script>navigator.serviceWorker.register('/sw.js');</script>
</body>
</html>`;

const OFFLINE_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>LT-07 offline fixture</title></head>
<body class="offline-page"><main>Offline fixture</main></body>
</html>`;

const SERVICE_WORKER = `'use strict';
const CACHE = 'lt07-offline-navigation-v1';
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['/offline.html'])));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')));
});`;

function send(res, status, type, body) {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'Service-Worker-Allowed': '/',
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, `http://${HOST}:${PORT}`).pathname;
  if (pathname === '/online') return send(res, 200, 'text/html; charset=utf-8', ONLINE_HTML);
  if (pathname === '/offline.html') return send(res, 200, 'text/html; charset=utf-8', OFFLINE_HTML);
  if (pathname === '/sw.js') return send(res, 200, 'application/javascript; charset=utf-8', SERVICE_WORKER);
  return send(res, 404, 'text/plain; charset=utf-8', 'Not found');
});

server.once('error', (error) => {
  console.error(`LT-07 offline navigation fixture could not start: ${error.code || 'server-error'}`);
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  const child = spawn('k6', ['run', '--quiet', K6_SCRIPT], {
    cwd: ROOT,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });

  child.once('error', (error) => {
    console.error(`LT-07 offline navigation regression could not start: ${error.code || 'spawn-error'}`);
    server.close(() => { process.exitCode = 1; });
  });

  child.once('exit', (code, signal) => {
    server.close(() => {
      if (signal || code !== 0) {
        console.error('LT-07 offline navigation regression: FAIL');
        process.exitCode = typeof code === 'number' ? code : 1;
        return;
      }
      console.log('LT-07 offline navigation regression: PASS');
    });
  });
});
