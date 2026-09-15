'use strict';
/* ========================================
   CampuSphere — recoverable session-readiness coordinator

   The Vercel entry point exports the Express app without awaiting app.listen(),
   so every request must wait until the selected persistent session store is
   reachable. A failed probe remains fail-closed, but it is no longer cached
   forever: bounded single-flight recovery waves let a warm function recover
   after a temporary upstream outage without a redeploy or instance restart.

   Privacy: only fixed categories, numeric HTTP status values, attempt counts,
   and cooldowns are logged. Raw errors, URLs, keys, session ids, cookies,
   request headers, and backend response bodies are never logged or returned.
   ======================================== */

const UNAVAILABLE_BODY = '{"success":false,"message":"Service temporarily unavailable."}';
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 2000;
const DEFAULT_ATTEMPT_DELAYS_MS = Object.freeze([250, 750]);
const DEFAULT_TRANSIENT_COOLDOWNS_MS = Object.freeze([5000, 15000, 30000, 60000]);
const DEFAULT_AUTHORIZATION_COOLDOWN_MS = 60000;
const FAILURE_CATEGORIES = new Set(['authorization', 'rate-limit', 'upstream', 'timeout', 'network', 'unknown']);

function noop() { /* intentionally empty */ }

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 100 && number <= 599 ? number : null;
}

function classifyFailure(error) {
  const status = safeNumber(error && error.status);
  const declared = error && FAILURE_CATEGORIES.has(error.category) ? error.category : null;
  if (declared) return { category: declared, status };
  if (status === 401 || status === 403) return { category: 'authorization', status };
  if (status === 429) return { category: 'rate-limit', status };
  if (status === 408) return { category: 'timeout', status };
  if (status !== null && status >= 500) return { category: 'upstream', status };
  if (error && (error.name === 'AbortError' || error.code === 'SESSION_STORE_TIMEOUT')) {
    return { category: 'timeout', status };
  }
  const networkCode = error && (error.code || (error.cause && error.cause.code));
  if (error && (error.name === 'TypeError' || networkCode === 'ECONNRESET' || networkCode === 'ECONNREFUSED' || networkCode === 'ENOTFOUND' || networkCode === 'EAI_AGAIN')) {
    return { category: 'network', status };
  }
  return { category: 'unknown', status };
}

function readinessError(classification) {
  const error = new Error('Session store initialization failed.');
  error.code = 'SESSION_STORE_INIT_FAILED';
  error.category = classification.category;
  if (classification.status !== null) error.status = classification.status;
  return error;
}

function makeHtmlUnavailable(retryAfterSeconds, nonce) {
  const nonceAttribute = typeof nonce === 'string' && /^[A-Za-z0-9+/=_-]{8,256}$/.test(nonce)
    ? ` nonce="${nonce}"` : '';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>CampuSphere is reconnecting</title>' +
    `<style${nonceAttribute}>` +
    'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f172a;color:#e5eefc;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}' +
    'main{width:min(32rem,calc(100% - 2rem));padding:2rem;border:1px solid #334155;border-radius:1rem;background:#111c30;box-shadow:0 1.25rem 3rem #02061755}' +
    'h1{margin:0 0 .75rem;font-size:clamp(1.45rem,4vw,2rem)}p{margin:.5rem 0;color:#bfcee3;line-height:1.55}' +
    'a{display:inline-block;margin-top:1.25rem;padding:.7rem 1rem;border-radius:.65rem;background:#3b82f6;color:white;text-decoration:none;font-weight:700}' +
    'small{display:block;margin-top:1rem;color:#8fa3bf}</style></head><body><main>' +
    '<h1>CampuSphere is reconnecting</h1>' +
    '<p>The service it uses to keep you signed in is temporarily unavailable. Your account and campus data have not been removed.</p>' +
    '<a href="">Try again</a>' +
    `<small>Please wait about ${retryAfterSeconds} second${retryAfterSeconds === 1 ? '' : 's'} before retrying.</small>` +
    '</main></body></html>';
}

/**
 * @param {object|undefined} sessionStore already-selected persistent store
 * @param {object} options testable timing/logging overrides
 * @returns {{ whenReady: function(): Promise<void>, middleware: function }}
 */
function createSessionReadiness(sessionStore, options = {}) {
  const attempts = Number.isInteger(options.attempts) && options.attempts > 0
    ? options.attempts : DEFAULT_ATTEMPTS;
  const attemptTimeoutMs = Number.isFinite(options.attemptTimeoutMs) && options.attemptTimeoutMs > 0
    ? options.attemptTimeoutMs : DEFAULT_TIMEOUT_MS;
  const attemptDelaysMs = Array.isArray(options.attemptDelaysMs)
    ? options.attemptDelaysMs.map((ms) => Math.max(0, Number(ms) || 0))
    : DEFAULT_ATTEMPT_DELAYS_MS;
  const transientCooldownsMs = Array.isArray(options.transientCooldownsMs) && options.transientCooldownsMs.length
    ? options.transientCooldownsMs.map((ms) => Math.max(1, Number(ms) || 1))
    : DEFAULT_TRANSIENT_COOLDOWNS_MS;
  const authorizationCooldownMs = Number.isFinite(options.authorizationCooldownMs) && options.authorizationCooldownMs > 0
    ? options.authorizationCooldownMs : DEFAULT_AUTHORIZATION_COOLDOWN_MS;
  const sleep = typeof options.sleep === 'function' ? options.sleep : delay;
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const logger = options.logger && typeof options.logger === 'object' ? options.logger : console;

  let state = 'checking';
  let currentWave = null;
  let nextRetryAt = 0;
  let transientFailureWaves = 0;
  let hasFailed = false;

  function log(level, fields) {
    const writer = logger && typeof logger[level] === 'function' ? logger[level] : null;
    if (!writer) return;
    const parts = ['[session-readiness]'];
    for (const [key, value] of Object.entries(fields)) {
      if (value !== null && value !== undefined && value !== '') parts.push(`${key}=${value}`);
    }
    writer.call(logger, parts.join(' '));
  }

  async function runAttempt() {
    const controller = new AbortController();
    let timer = null;
    let timedOut = false;
    const timeout = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        const error = new Error('Session store initialization failed.');
        error.code = 'SESSION_STORE_TIMEOUT';
        error.category = 'timeout';
        reject(error);
      }, attemptTimeoutMs);
    });

    try {
      const initialization = Promise.resolve().then(() => {
        if (!sessionStore || typeof sessionStore.init !== 'function') return undefined;
        return sessionStore.init({ signal: controller.signal });
      });
      return await Promise.race([initialization, timeout]);
    } catch (error) {
      if (timedOut) {
        const safe = new Error('Session store initialization failed.');
        safe.code = 'SESSION_STORE_TIMEOUT';
        safe.category = 'timeout';
        throw safe;
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function startWave(reason) {
    if (state === 'ready') return currentWave || Promise.resolve();
    if (state === 'checking' && currentWave) return currentWave;
    state = 'checking';

    const wave = (async () => {
      let last = { category: 'unknown', status: null };
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
          await runAttempt();
          state = 'ready';
          nextRetryAt = 0;
          transientFailureWaves = 0;
          if (hasFailed) log('info', { state: 'recovered', reason, attempts: attempt });
          return undefined;
        } catch (error) {
          last = classifyFailure(error);
          if (attempt < attempts) {
            const waitMs = attemptDelaysMs[Math.min(attempt - 1, attemptDelaysMs.length - 1)] || 0;
            if (waitMs > 0) await sleep(waitMs);
          }
        }
      }

      hasFailed = true;
      state = 'cooldown';
      let cooldownMs;
      if (last.category === 'authorization') {
        cooldownMs = authorizationCooldownMs;
      } else {
        const index = Math.min(transientFailureWaves, transientCooldownsMs.length - 1);
        cooldownMs = transientCooldownsMs[index];
        transientFailureWaves += 1;
      }
      nextRetryAt = now() + cooldownMs;
      log('warn', {
        state: 'unavailable',
        reason,
        category: last.category,
        status: last.status,
        attempts,
        retry_after_seconds: Math.max(1, Math.ceil(cooldownMs / 1000)),
      });
      throw readinessError(last);
    })();

    currentWave = wave;
    wave.then(noop, noop);
    return wave;
  }

  function readinessPromise() {
    if (state === 'ready' || state === 'checking') return currentWave;
    if (now() < nextRetryAt) return currentWave;
    return startWave('request-recovery');
  }

  function retryAfterSeconds() {
    return Math.max(1, Math.ceil(Math.max(0, nextRetryAt - now()) / 1000));
  }

  function wantsHtml(req) {
    const path = String(req && (req.originalUrl || req.url) || '').split('?')[0];
    if (path === '/healthz' || path.startsWith('/api/')) return false;
    if (!req || typeof req.accepts !== 'function') return false;
    return req.accepts(['html', 'json']) === 'html';
  }

  function sendUnavailable(req, res) {
    if (res.headersSent) return;
    const retrySeconds = retryAfterSeconds();
    res.status(503);
    res.set('Cache-Control', 'no-store');
    res.set('Retry-After', String(retrySeconds));
    if (wantsHtml(req)) {
      res.type('text/html');
      res.send(makeHtmlUnavailable(retrySeconds, res.locals && res.locals.cspNonce));
      return;
    }
    res.type('application/json');
    res.send(UNAVAILABLE_BODY);
  }

  function middleware(req, res, next) {
    readinessPromise().then(
      function onReady() { next(); },
      function onUnavailable() { sendUnavailable(req, res); }
    );
  }

  // Eager first wave: local startup and imported Vercel apps share it.
  state = 'idle';
  startWave('startup');

  return {
    whenReady: readinessPromise,
    middleware,
  };
}

module.exports = {
  createSessionReadiness,
  UNAVAILABLE_BODY,
  DEFAULT_ATTEMPTS,
  DEFAULT_TIMEOUT_MS,
};
