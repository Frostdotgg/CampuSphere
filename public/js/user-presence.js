'use strict';

/*
 * CampuSphere — visible authenticated-page presence heartbeat
 *
 * This file is intentionally not in the service-worker shell allowlist. An
 * offline page must never claim that it recently reported activity. The
 * server remains the authority for the five-minute window and throttles the
 * actual database write independently of this client interval.
 */
(function () {
    var HEARTBEAT_INTERVAL_MS = 60 * 1000;

    function readCsrfToken(doc) {
        if (!doc || typeof doc.querySelector !== 'function') return '';
        var meta = doc.querySelector('meta[name="csrf-token"]');
        return meta ? (meta.getAttribute('content') || '') : '';
    }

    function writeCsrfToken(doc, token) {
        if (!doc || typeof doc.querySelector !== 'function' || typeof token !== 'string') return;
        var meta = doc.querySelector('meta[name="csrf-token"]');
        if (meta && token) meta.setAttribute('content', token);
    }

    async function fetchFreshCsrfToken(fetchImpl, doc) {
        try {
            var response = await fetchImpl('/auth/csrf-token', {
                method: 'GET',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { Accept: 'application/json' }
            });
            if (!response) return '';
            // A stale token can race with session expiry. Surface the 401 so
            // the caller stops polling instead of retrying an unauthenticated
            // page every minute.
            if (response.status === 401) return null;
            if (response.status !== 200) return '';
            var body = await response.json();
            if (!body || body.success !== true || typeof body.csrfToken !== 'string' || !body.csrfToken) return '';
            writeCsrfToken(doc, body.csrfToken);
            return body.csrfToken;
        } catch (error) {
            return '';
        }
    }

    function initUserPresence(doc, win) {
        if (!doc || typeof doc.addEventListener !== 'function') return false;
        var fetchImpl = win && typeof win.fetch === 'function'
            ? win.fetch.bind(win)
            : (typeof fetch === 'function' ? fetch : null);
        if (!fetchImpl) return false;

        // Idempotence protects pages that accidentally include a shared
        // partial twice; duplicate scripts must not double the heartbeat.
        if (doc.__campuspherePresenceOwned === true) return true;
        doc.__campuspherePresenceOwned = true;

        var timer = null;
        var inFlight = false;
        var stopped = false;

        function isVisible() {
            return doc.visibilityState === undefined || doc.visibilityState === 'visible';
        }

        function stopTimer() {
            if (timer !== null) {
                (win && typeof win.clearInterval === 'function' ? win.clearInterval : clearInterval)(timer);
                timer = null;
            }
        }

        function startTimer() {
            if (timer !== null || stopped || !isVisible()) return;
            var set = win && typeof win.setInterval === 'function' ? win.setInterval : setInterval;
            timer = set(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
        }

        async function sendHeartbeat() {
            if (stopped || !isVisible() || inFlight) return;
            var token = readCsrfToken(doc);
            if (!token) return;
            inFlight = true;
            try {
                var response = await fetchImpl('/api/presence/heartbeat', {
                    method: 'POST',
                    credentials: 'same-origin',
                    cache: 'no-store',
                    headers: {
                        Accept: 'application/json',
                        'X-CSRF-Token': token
                    }
                });

                // A restored page can hold a token from an earlier session. One
                // safe GET refresh is enough; never retry a heartbeat endlessly.
                if (response && response.status === 403) {
                    var fresh = await fetchFreshCsrfToken(fetchImpl, doc);
                    if (fresh === null) {
                        stopped = true;
                        stopTimer();
                    } else if (fresh) {
                        response = await fetchImpl('/api/presence/heartbeat', {
                            method: 'POST',
                            credentials: 'same-origin',
                            cache: 'no-store',
                            headers: {
                                Accept: 'application/json',
                                'X-CSRF-Token': fresh
                            }
                        });
                    }
                }
                if (response && response.status === 401) {
                    stopped = true;
                    stopTimer();
                }
                // 204, 429, 503, and transient network failures are all
                // intentionally silent. The next visible interval can retry.
            } catch (error) {
                // Presence is advisory and must never interfere with navigation.
            } finally {
                inFlight = false;
            }
        }

        function onVisibilityChange() {
            if (isVisible()) {
                sendHeartbeat();
                startTimer();
            } else {
                stopTimer();
            }
        }

        doc.addEventListener('visibilitychange', onVisibilityChange);
        if (win && typeof win.addEventListener === 'function') {
            win.addEventListener('pageshow', onVisibilityChange);
            win.addEventListener('pagehide', stopTimer);
        }

        if (isVisible()) {
            sendHeartbeat();
            startTimer();
        }
        return true;
    }

    if (typeof document !== 'undefined') {
        initUserPresence(document, typeof window !== 'undefined' ? window : null);
    }

    // CommonJS-only exports support the database-free contract probe.
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            HEARTBEAT_INTERVAL_MS,
            initUserPresence,
            isVisibleDocument: function (doc) {
                return !doc || doc.visibilityState === undefined || doc.visibilityState === 'visible';
            }
        };
    }
})();
