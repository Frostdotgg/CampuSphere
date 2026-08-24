// main.js — CampusSphere Admin

/* ---- CSRF header shim (Milestone 8, Section 8.2) ----
   Every admin page loads this file (deferred) before its page-specific
   admin-*.js, so installing a fetch wrapper here transparently attaches the
   session CSRF token to all same-origin, state-changing admin API calls
   (users/news/events/buildings/FAQs/settings/VR/route-graph) without editing
   each client. The token is read from the rendered <meta name="csrf-token">
   tag only — never localStorage/sessionStorage/IndexedDB. Cross-origin and
   safe-method requests are passed through untouched so the token never leaks
   off-origin. */
(function () {
    'use strict';
    if (typeof window.fetch !== 'function') return;
    var UNSAFE = { POST: true, PUT: true, PATCH: true, DELETE: true };
    var nativeFetch = window.fetch.bind(window);

    function csrfToken() {
        var m = document.querySelector('meta[name="csrf-token"]');
        return m ? (m.getAttribute('content') || '') : '';
    }

    window.fetch = function (input, init) {
        try {
            init = init || {};
            var method = (init.method
                || (input && typeof input === 'object' && input.method)
                || 'GET').toString().toUpperCase();

            var rawUrl = (input && typeof input === 'object' && input.url)
                ? input.url : String(input);
            var sameOrigin = true;
            try { sameOrigin = new URL(rawUrl, location.href).origin === location.origin; }
            catch (e) { sameOrigin = true; }

            if (UNSAFE[method] && sameOrigin) {
                var token = csrfToken();
                if (token) {
                    var headers = new Headers(
                        init.headers
                        || (input && typeof input === 'object' ? input.headers : undefined)
                        || {}
                    );
                    if (!headers.has('X-CSRF-Token')) headers.set('X-CSRF-Token', token);
                    init = Object.assign({}, init, { headers: headers });
                    return nativeFetch(input, init);
                }
            }
        } catch (e) { /* never break fetch */ }
        return nativeFetch(input, init);
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    // ---- Dark Mode ----
    const savedTheme = localStorage.getItem('adminTheme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    const themeToggle = document.getElementById('admin-theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            if (next === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }
            localStorage.setItem('adminTheme', next);
        });
    }

    // ---- Sidebar Toggle ----
    const sidebar = document.getElementById('sidebar');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    const sidebarTexts = document.querySelectorAll('.sidebar-text');
    const sidebarHeaderFull = document.getElementById('sidebar-header-full');
    const sidebarUserFull = document.getElementById('sidebar-user-full');
    const sidebarIconRight = document.getElementById('sidebar-icon-right');
    const sidebarIconLeft = document.getElementById('sidebar-icon-left');

    let isSidebarCollapsed = false;

    function setSidebarCollapsed(collapsed) {
        if (!sidebar) return;
        isSidebarCollapsed = collapsed;

        if (collapsed) {
            sidebar.classList.remove('w-64');
            sidebar.classList.add('w-16');

            sidebarTexts.forEach(el => el.classList.add('hidden'));
            if (sidebarHeaderFull) sidebarHeaderFull.classList.add('hidden');
            if (sidebarUserFull) sidebarUserFull.classList.add('hidden');

            if (sidebarIconRight) sidebarIconRight.classList.remove('hidden');
            if (sidebarIconLeft) sidebarIconLeft.classList.add('hidden');
        } else {
            sidebar.classList.remove('w-16');
            sidebar.classList.add('w-64');

            sidebarTexts.forEach(el => el.classList.remove('hidden'));
            if (sidebarHeaderFull) sidebarHeaderFull.classList.remove('hidden');
            if (sidebarUserFull) sidebarUserFull.classList.remove('hidden');

            if (sidebarIconRight) sidebarIconRight.classList.add('hidden');
            if (sidebarIconLeft) sidebarIconLeft.classList.remove('hidden');
        }
    }

    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', () => {
            setSidebarCollapsed(!isSidebarCollapsed);
        });
    }

    // Responsive default: at mobile widths a full 256px sidebar leaves almost
    // no workspace (~134px at 390px wide), so collapse it automatically on
    // initial load and whenever the viewport crosses the mobile breakpoint.
    // Manual toggling keeps working in both directions afterwards; crossing
    // the breakpoint re-syncs to the size-appropriate default.
    const mobileSidebarQuery = window.matchMedia('(max-width: 760px)');
    if (sidebar && mobileSidebarQuery.matches) {
        setSidebarCollapsed(true);
    }
    if (sidebar && typeof mobileSidebarQuery.addEventListener === 'function') {
        mobileSidebarQuery.addEventListener('change', (e) => {
            setSidebarCollapsed(e.matches);
        });
    }

    // ---- Dropdowns ----
    const dropdownTriggers = document.querySelectorAll('.dropdown-trigger');

    function setDropdownExpanded(menu, expanded) {
        if (!menu) return;
        document.querySelectorAll('.dropdown-trigger').forEach(trigger => {
            if (trigger.getAttribute('data-dropdown-target') === menu.id) {
                trigger.setAttribute('aria-expanded', String(expanded));
            }
        });
    }

    function closeDropdown(menu) {
        if (!menu) return;
        menu.removeAttribute('data-state');
        setDropdownExpanded(menu, false);
    }

    function closeAllDropdowns() {
        document.querySelectorAll('.dropdown-menu-content').forEach(closeDropdown);
    }
    
    dropdownTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetId = trigger.getAttribute('data-dropdown-target');
            const targetMenu = document.getElementById(targetId);
            if (!targetMenu) return;
            
            // Close all others
            document.querySelectorAll('.dropdown-menu-content').forEach(menu => {
                if (menu.id !== targetId) {
                    closeDropdown(menu);
                }
            });

            // Toggle current
            if (targetMenu.getAttribute('data-state') === 'open') {
                closeDropdown(targetMenu);
            } else {
                targetMenu.setAttribute('data-state', 'open');

                // Toolbar filters are anchored to their local relative wrapper.
                // Other menus retain the legacy viewport-coordinate placement.
                if (targetMenu.getAttribute('data-dropdown-placement') === 'anchor') {
                    targetMenu.style.removeProperty('top');
                    targetMenu.style.removeProperty('right');
                    targetMenu.style.removeProperty('left');
                    targetMenu.style.removeProperty('bottom');

                    // Long category lists should remain reachable on short
                    // screens. Measure after opening, then flip above the
                    // trigger only when there is enough room there.
                    const triggerRect = trigger.getBoundingClientRect();
                    const menuRect = targetMenu.getBoundingClientRect();
                    const fitsBelow = menuRect.bottom <= window.innerHeight;
                    const fitsAbove = triggerRect.top >= menuRect.height + 8;
                    if (!fitsBelow && fitsAbove) {
                        targetMenu.style.top = 'auto';
                        targetMenu.style.bottom = 'calc(100% + 0.5rem)';
                    }
                } else {
                    const rect = trigger.getBoundingClientRect();
                    targetMenu.style.top = (rect.bottom + window.scrollY + 8) + 'px';
                    targetMenu.style.right = (window.innerWidth - rect.right) + 'px';
                }
                setDropdownExpanded(targetMenu, true);
            }
        });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        closeAllDropdowns();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const openMenu = document.querySelector('.dropdown-menu-content[data-state="open"]');
        if (!openMenu) return;
        closeDropdown(openMenu);
        const trigger = Array.from(document.querySelectorAll('.dropdown-trigger'))
            .find(item => item.getAttribute('data-dropdown-target') === openMenu.id);
        if (trigger) trigger.focus();
    });
    
    // Prevent closing when clicking inside dropdown menu
    document.querySelectorAll('.dropdown-menu-content').forEach(menu => {
        menu.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });
});
