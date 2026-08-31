/* ========================================
   CampuSphere — shared VR hotspot-navigation helper (M12.P1-D3)

   ONE dependency-free client module owns scene-hotspot navigation for BOTH
   VR views (guided views/vr-route.ejs and Free Roam views/vr.ejs). It
   replaces the former coupling where scene navigation rode on the schedule
   helper's makePannellumHotspot fallback callback and a custom
   window-location clickHandlerFunc.

   Contract:
     - resolveGuidedUrl(hotspot, locationLike)
         Guided hotspots consume ONLY their exact server-derived
         hotspot.nav_url. Navigation is NEVER reconstructed from nav_kind,
         target_scene_key, array position, or numeric ids. An accepted URL is
         returned byte-for-byte; everything else resolves to null.
     - resolveFreeRoamUrl(hotspot, locationLike)
         Free Roam validates hotspot.target_scene_key against the server
         scene-key contract (lowercase ASCII alphanumeric components joined
         by single hyphens, nonempty, at most 60 characters) and constructs
         exactly '/vr/<validated-key>'.
     - decoratePannellumHotspot(baseConfig, hotspot, mode, locationLike)
         Returns a NEW config (inputs are never mutated) using Pannellum's
         NATIVE scene-hotspot link contract for validated navigation:
         type: 'scene', URL: <validatedUrl>, attributes { target: '_self' },
         and the dedicated scene-hotspot CSS class. No
         clickHandlerFunc is ever installed for scene navigation. When nothing
         validates, the copy carries no URL/attributes/cssClass/clickHandlerFunc
         at all, so a rejected target stays a non-navigating info point. mode
         is 'guided' or 'free-roam'; anything else fails closed.

   Accepted same-origin URL forms (entire string, nothing else):
     /vr/to/<positive-id>?step=<positive-step>
     /vr/routes/<positive-id>?step=<positive-step>
     /vr/<safe-scene-key>

   Fail closed (return null / non-navigating copy; never throw, navigate,
   or log the rejected value): absolute or protocol-relative URLs, external
   origins, backslashes or control characters, fragments, traversal or any
   normalization outside /vr/, unsupported query parameters, malformed ids
   or steps, unsafe or missing scene keys, wrong hotspot types, unsupported
   modes, and missing or non-object inputs.

   Exactly ONE browser global is created: window.CampuSphereVrHotspotNavigation.
   The CommonJS export exists for the Node probe; in Node no global is set.
   ======================================== */
(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.CampuSphereVrHotspotNavigation = api;
    }
}(typeof window !== 'undefined' ? window : null, function () {
    'use strict';

    var MAX_SCENE_KEY_LENGTH = 60;
    // Bounded overall URL budget: the accepted forms are short; anything
    // longer is rejected before the regexes run.
    var MAX_URL_LENGTH = 160;
    var SCENE_KEY_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    var GUIDED_STEP_RE = /^\/vr\/(?:to|routes)\/[1-9][0-9]*\?step=[1-9][0-9]*$/;
    var SCENE_PATH_RE = /^\/vr\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;
    var SCENE_HOTSPOT_CLASS = 'campusphere-vr-scene-hotspot';

    function isObjectLike(value) {
        return value !== null && typeof value === 'object';
    }

    // locationLike is part of the public signature; callers pass the page
    // location object (or a probe stand-in). Accepted URLs are origin-relative
    // /vr/ paths by construction, so only its SHAPE is validated: absent is
    // fine, but a present non-object input fails closed.
    function locationOk(locationLike) {
        return locationLike === undefined || locationLike === null || isObjectLike(locationLike);
    }

    function hasUnsafeCharacters(url) {
        for (var i = 0; i < url.length; i++) {
            var code = url.charCodeAt(i);
            if (code <= 0x1f || code === 0x7f) return true; // control characters
            if (code === 0x5c) return true;                 // backslash
        }
        return false;
    }

    function isSafeSceneKey(key) {
        return typeof key === 'string' &&
            key.length > 0 &&
            key.length <= MAX_SCENE_KEY_LENGTH &&
            SCENE_KEY_RE.test(key);
    }

    // Entire-string acceptance of the three same-origin /vr/ forms. The
    // rooted '/vr/' prefix check also rejects absolute ('https://…'),
    // protocol-relative ('//…'), and relative ('vr/…') inputs; dots, '%',
    // '&', and '#' never match the anchored patterns, which closes the
    // traversal, encoding-trick, extra-query, and fragment routes.
    function isAcceptedVrUrl(url) {
        if (typeof url !== 'string' || url.length === 0 || url.length > MAX_URL_LENGTH) return false;
        if (hasUnsafeCharacters(url)) return false;
        if (url.indexOf('#') !== -1) return false;
        if (url.indexOf('/vr/') !== 0) return false;
        if (GUIDED_STEP_RE.test(url)) return true;
        var m = SCENE_PATH_RE.exec(url);
        return !!m && m[1].length <= MAX_SCENE_KEY_LENGTH;
    }

    function resolveGuidedUrl(hotspot, locationLike) {
        if (!locationOk(locationLike)) return null;
        if (!isObjectLike(hotspot)) return null;
        if (hotspot.hotspot_type !== 'scene') return null;
        // Exact server-derived nav_url only; preserved unchanged when accepted.
        return isAcceptedVrUrl(hotspot.nav_url) ? hotspot.nav_url : null;
    }

    function resolveFreeRoamUrl(hotspot, locationLike) {
        if (!locationOk(locationLike)) return null;
        if (!isObjectLike(hotspot)) return null;
        if (hotspot.hotspot_type !== 'scene') return null;
        if (!isSafeSceneKey(hotspot.target_scene_key)) return null;
        return '/vr/' + hotspot.target_scene_key;
    }

    function hotspotAccessibleLabel(hotspot, fallbackText) {
        var label = isObjectLike(hotspot) && typeof hotspot.label === 'string'
            ? hotspot.label.trim()
            : '';
        if (!label && typeof fallbackText === 'string') label = fallbackText.trim();
        if (!label) label = 'Open 360 view';
        if (label.length > 120) label = label.slice(0, 117) + '...';
        return label;
    }

    function decoratePannellumHotspot(baseConfig, hotspot, mode, locationLike) {
        if (!isObjectLike(baseConfig)) return null;
        // Fresh copy: inputs are never mutated, and any navigation-capable
        // key on the base (URL/attributes/clickHandlerFunc/clickHandlerArgs)
        // is dropped so navigation can only come from a validated decoration.
        // '__proto__'/'constructor'/'prototype' are excluded too: an OWN
        // '__proto__' data property (e.g. from JSON.parse) would otherwise
        // reassign the copy's prototype and let a rejected decoration INHERIT
        // navigation keys, defeating the strip guarantee.
        var config = {};
        for (var key in baseConfig) {
            if (Object.prototype.hasOwnProperty.call(baseConfig, key) &&
                key !== 'URL' && key !== 'attributes' &&
                key !== 'clickHandlerFunc' && key !== 'clickHandlerArgs' &&
                key !== 'cssClass' &&
                key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
                config[key] = baseConfig[key];
            }
        }
        var url = null;
        if (mode === 'guided') {
            url = resolveGuidedUrl(hotspot, locationLike);
        } else if (mode === 'free-roam') {
            url = resolveFreeRoamUrl(hotspot, locationLike);
        }
        // Unsupported mode or rejected target: the copy stays a non-navigating
        // info point. Only a validated destination receives the dedicated
        // scene-hotspot class and Pannellum's native URL anchor.
        if (url !== null) {
            config.type = 'scene';
            config.cssClass = SCENE_HOTSPOT_CLASS;
            // Pannellum wraps URL hotspots in a real same-tab anchor. Keep the
            // existing validated URL contract and expose the label to keyboard
            // and assistive-technology users.
            config.URL = url;
            config.attributes = {
                target: '_self',
                'aria-label': hotspotAccessibleLabel(hotspot, config.text)
            };
        }
        return config;
    }

    return {
        resolveGuidedUrl: resolveGuidedUrl,
        resolveFreeRoamUrl: resolveFreeRoamUrl,
        decoratePannellumHotspot: decoratePannellumHotspot
    };
}));
