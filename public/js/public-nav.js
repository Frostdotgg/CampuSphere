'use strict';
/* ========================================
   CampuSphere — shared ANONYMOUS-navbar client (M12.P1 SEC-51 correction)

   SINGLE owner of the #hamburger / #navLinks mobile-menu state for every page
   that renders views/partials/navbar.ejs (the landing page and the anonymous
   /privacy notice). Loaded exactly once, with defer, from that partial.
   Same-origin and CSP-compatible (external file; no inline handlers, no eval).

   This mirrors the audited public/js/authenticated-nav.js contract. Before this
   file existed the landing page carried its OWN inline hamburger handler, so
   /privacy rendered the same markup with no behaviour at all and neither page
   exposed aria-expanded. One owner now serves both.

   Contract:
     - Starts CLOSED and keeps navLinks.classList 'open',
       hamburger.classList 'active', aria-expanded, and the accessible label
       ('Open navigation menu' / 'Close navigation menu') in sync through ONE
       state setter. No caller mutates those independently.
     - Idempotent init: a data flag on the button makes duplicate evaluation
       register no duplicate listeners.
     - Relies on the NATIVE button click contract for mouse, pointer/touch,
       Enter, and Space — no extra touchstart/keydown toggles to double-fire.
     - Escape closes the menu and returns focus to the hamburger.
     - A pointer interaction outside both the hamburger and the menu closes it
       without stealing focus.
     - Selecting any .navbar__link or .navbar__cta closes the menu; the listener
       runs in the CAPTURE phase so a target handler's stopPropagation cannot
       skip the shared cleanup.
     - A change of matchMedia('(max-width: 768px)') resets to closed, so
       desktop<->mobile transitions never keep stale open state.
     - Never calls preventDefault or stopPropagation; guards missing DOM nodes
       without throwing; creates NO browser global. The CommonJS-only export
       exists solely for the Node regression probe.
   ======================================== */
(function () {
    var LABEL_OPEN = 'Open navigation menu';
    var LABEL_CLOSE = 'Close navigation menu';

    function initPublicNav(doc) {
        if (!doc || typeof doc.getElementById !== 'function') return false;
        var hamburger = doc.getElementById('hamburger');
        var navLinks = doc.getElementById('navLinks');
        if (!hamburger || !navLinks) return false;

        // Idempotent: duplicate evaluation must not add duplicate listeners.
        if (hamburger.getAttribute('data-cs-nav-owned') === '1') return true;
        hamburger.setAttribute('data-cs-nav-owned', '1');

        var isOpen = false;
        // THE single state setter: classes, aria-expanded, and the accessible
        // label always move together.
        function setOpen(open) {
            isOpen = open === true;
            if (isOpen) {
                navLinks.classList.add('open');
                hamburger.classList.add('active');
            } else {
                navLinks.classList.remove('open');
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
            var inLinks = !!t && (t === navLinks ||
                (typeof navLinks.contains === 'function' && navLinks.contains(t)));
            if (!inHamburger && !inLinks) setOpen(false);
        });

        // Any selected navigation entry closes the menu. CAPTURE phase, so a
        // target handler's stopPropagation cannot prevent this cleanup.
        navLinks.addEventListener('click', function (e) {
            var t = e ? e.target : null;
            while (t && t !== navLinks) {
                if (t.classList && typeof t.classList.contains === 'function' &&
                    (t.classList.contains('navbar__link') || t.classList.contains('navbar__cta'))) {
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
        initPublicNav(document);
    }
    // CommonJS-only export for the Node regression probe; no browser global.
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { initPublicNav: initPublicNav };
    }
})();
