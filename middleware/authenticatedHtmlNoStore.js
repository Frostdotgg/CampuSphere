/* ========================================
   CampuSphere — Authenticated-HTML no-store policy (OFF.1)

   The service worker already treats navigations as network-only, but the
   browser's ORDINARY HTTP cache could still retain personalized HTML (a
   back-button or history restore after logout on a shared device). This
   middleware marks every authenticated response OUTSIDE the explicit API
   namespaces — HTML pages, their redirects (e.g. the POST /logout 302),
   error pages, and HEAD responses — with

       Cache-Control: no-store, private

   Classification is exactly: a live session user (req.session.user) AND a
   request path NOT anchored inside an explicit API namespace. The exemption
   is decided ONLY by req.path — request headers are attacker-controlled, so
   Accept, Content-Type, X-Requested-With/req.xhr, query parameters, cookies,
   roles, res.locals, and backend IDs are deliberately never consulted: a
   spoofed "Accept: application/json" on /map still receives personalized
   HTML and must still be uncacheable. roleAuth.wantsJson remains the correct
   auth/authz RESPONSE-negotiation helper; it is intentionally NOT used for
   this caching decision.

   Only paths beginning exactly with /api/ or /admin/api/ are exempt —
   /apiary, /admin/apiary, and /foo/api/bar are all protected. A missing or
   non-string req.path FAILS CLOSED: the authenticated response is marked
   no-store. express.static is mounted BEFORE the session middleware in
   server.js, so static assets and the session-neutral offline shell never
   reach this policy.
   ======================================== */

// Anchored API namespaces: a prefix match at position 0 only.
const API_PREFIXES = ['/api/', '/admin/api/'];

function isExplicitApiPath(p) {
  // Fail closed: a missing or malformed path grants NO exemption.
  if (typeof p !== 'string') return false;
  return API_PREFIXES.some((prefix) => p.indexOf(prefix) === 0);
}

function authenticatedHtmlNoStore(req, res, next) {
  if (req.session && req.session.user && !isExplicitApiPath(req.path)) {
    res.set('Cache-Control', 'no-store, private');
  }
  next();
}

module.exports = authenticatedHtmlNoStore;
