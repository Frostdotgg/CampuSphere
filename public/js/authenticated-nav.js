'use strict';
/* ========================================
   CampuSphere — shared authenticated-navbar client (M12.P1-D2)

   SINGLE owner of the #dashHamburger / #dashTabs mobile-menu state for every
   page that renders views/partials/dash-navbar.ejs (home, dashboard,
   buildings, events, map, about, admin-linked pages, and BOTH VR views).
   Loaded exactly once, with defer, from that partial. Same-origin and
   CSP-compatible (external file; no inline handlers, no eval).

   Contract:
     - Starts CLOSED and keeps dashTabs.classList 'open',
       dashHamburger.classList 'active', aria-expanded, and the accessible
       label ('Open navigation menu' / 'Close navigation menu') in sync.
     - Idempotent init: a data flag on the button makes duplicate evaluation
       register no duplicate listeners.
     - Relies on the NATIVE button click contract for mouse, pointer/touch,
       Enter, and Space — no extra touchstart/keydown toggles to double-fire.
     - Escape closes the menu and returns focus to the hamburger.
     - A pointer interaction outside both the hamburger and the menu closes
       it without stealing focus.
     - Selecting any .dash-nav__tab (including mobile Edit Profile / Logout)
       closes the menu; the listener runs in the CAPTURE phase so a target
       handler's stopPropagation cannot skip the shared cleanup.
     - A change of matchMedia('(max-width: 768px)') resets to closed, so
       desktop<->mobile transitions never keep stale open state.
     - Never calls preventDefault or stopPropagation; guards missing DOM
       nodes without throwing; creates NO browser global. The CommonJS-only
       export exists solely for the Node regression probe.
   ======================================== */
(function () {
    var LABEL_OPEN = 'Open navigation menu';
    var LABEL_CLOSE = 'Close navigation menu';

    function initAuthenticatedNav(doc) {
        if (!doc || typeof doc.getElementById !== 'function') return false;
        var hamburger = doc.getElementById('dashHamburger');
        var tabs = doc.getElementById('dashTabs');
        if (!hamburger || !tabs) return false;

        // Idempotent: duplicate evaluation must not add duplicate listeners.
        if (hamburger.getAttribute('data-cs-nav-owned') === '1') return true;
        hamburger.setAttribute('data-cs-nav-owned', '1');

        var isOpen = false;
        function setOpen(open) {
            isOpen = open === true;
            if (isOpen) {
                tabs.classList.add('open');
                hamburger.classList.add('active');
            } else {
                tabs.classList.remove('open');
                hamburger.classList.remove('active');
            }
            hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            hamburger.setAttribute('aria-label', isOpen ? LABEL_CLOSE : LABEL_OPEN);
        }
        setOpen(false); // enforce the closed initial state on every page

        // Native button 'click' covers mouse, pointer/touch, Enter, and Space.
        hamburger.addEventListener('click', function () {
            setOpen(!isOpen);
        });

        // Escape closes and returns focus to the hamburger.
        doc.addEventListener('keydown', function (e) {
            if (!isOpen) return;
            if (e && (e.key === 'Escape' || e.key === 'Esc')) {
                setOpen(false);
                if (typeof hamburger.focus === 'function') hamburger.focus();
            }
        });

        // Outside pointer interaction closes without stealing focus.
        doc.addEventListener('pointerdown', function (e) {
            if (!isOpen) return;
            var t = e ? e.target : null;
            var inHamburger = !!t && (t === hamburger ||
                (typeof hamburger.contains === 'function' && hamburger.contains(t)));
            var inTabs = !!t && (t === tabs ||
                (typeof tabs.contains === 'function' && tabs.contains(t)));
            if (!inHamburger && !inTabs) setOpen(false);
        });

        // Any selected tab closes the menu. CAPTURE phase: the existing
        // profile handler's stopPropagation cannot prevent this cleanup.
        tabs.addEventListener('click', function (e) {
            var t = e ? e.target : null;
            while (t && t !== tabs) {
                if (t.classList && typeof t.classList.contains === 'function' &&
                    t.classList.contains('dash-nav__tab')) {
                    setOpen(false);
                    return;
                }
                t = t.parentNode || null;
            }
        }, true);

        // Responsive transitions across the 768px boundary reset to closed.
        var win = doc.defaultView;
        if (win && typeof win.matchMedia === 'function') {
            var mq = win.matchMedia('(max-width: 768px)');
            var onChange = function () { setOpen(false); };
            if (mq && typeof mq.addEventListener === 'function') {
                mq.addEventListener('change', onChange);
            } else if (mq && typeof mq.addListener === 'function') {
                mq.addListener(onChange);
            }
        }
        return true;
    }

    if (typeof document !== 'undefined') {
        initAuthenticatedNav(document);
    }
    // CommonJS-only export for the Node regression probe; no browser global.
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { initAuthenticatedNav: initAuthenticatedNav };
    }
})();
