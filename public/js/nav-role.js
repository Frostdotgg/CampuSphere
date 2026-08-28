/* ========================================
   CampusSphere - Role-Based Navigation
   1. Route guard - redirects if role cannot access current page
   2. Tab visibility - hides nav tabs the role should not see
   Uses server session data (window.__SESSION_USER) as the trusted role source.
   Missing session => anonymous visitor (NOT authenticated guest).
   ======================================== */
(function () {
    const sessionUser = window.__SESSION_USER || null;
    const role = sessionUser && sessionUser.role ? sessionUser.role : 'anonymous';

    // Campus content pages (/map, /buildings, /about, /events) are login-only.
    // Anonymous visitors only get the landing/home/auth surface.
    const PUBLIC_PAGES = ['/', '/home', '/auth'];

    /* ---- Which pages (routes) each role may visit ---- */
    const rolePageAccess = {
        'anonymous': PUBLIC_PAGES,
        'student-cspc': ['/home', '/dashboard', '/buildings', '/events', '/map', '/about', '/faq', '/'],
        'instructor': ['/home', '/dashboard', '/buildings', '/events', '/map', '/about', '/faq', '/'],
        'admin': ['/home', '/dashboard', '/buildings', '/events', '/map', '/about', '/faq', '/', '/admin'],
        'guest': ['/home', '/dashboard', '/buildings', '/events', '/map', '/about', '/faq', '/']
    };

    /* ---- Which nav-tab IDs each role can see ---- */
    const roleNavAccess = {
        'anonymous': ['tabHome', 'mobileLoginBtn'],
        'student-cspc': ['tabHome', 'tabDashboard', 'tabBuildings', 'tabEvents', 'tabMap', 'tabAbout', 'tabFaq', 'tabFaqMobile'],
        'instructor': ['tabHome', 'tabDashboard', 'tabBuildings', 'tabEvents', 'tabMap', 'tabAbout', 'tabFaq', 'tabFaqMobile'],
        'admin': ['tabHome', 'tabDashboard', 'tabBuildings', 'tabEvents', 'tabMap', 'tabAbout', 'tabFaq', 'tabFaqMobile'],
        'guest': ['tabHome', 'tabDashboard', 'tabBuildings', 'tabEvents', 'tabMap', 'tabAbout', 'tabFaq', 'tabFaqMobile']
    };

    // Roles that may use the VR viewer (Milestone 5). Anonymous
    // visitors are intentionally excluded and still go to /auth.
    const VR_ALLOWED_ROLES = ['student-cspc', 'instructor', 'guest', 'admin'];

    /* ---- Path access check ---- */
    // Keeps the existing exact-route behavior for normal pages, and
    // additionally allows authenticated roles to reach the VR viewer
    // at /vr and any /vr/... sub-path (e.g. /vr/routes/1, /vr/:sceneKey).
    function canAccessPath(currentRole, path) {
        const allowed = rolePageAccess[currentRole] || PUBLIC_PAGES;
        if (allowed.includes(path)) {
            return true;
        }
        if (VR_ALLOWED_ROLES.indexOf(currentRole) !== -1) {
            if (path === '/vr' || path.indexOf('/vr/') === 0) {
                return true;
            }
        }
        return false;
    }

    /* ---- Route Guard ---- */
    const currentPath = location.pathname || '/';

    if (!canAccessPath(role, currentPath)) {
        if (role === 'anonymous') {
            window.location.href = '/auth';
        } else {
            window.location.href = '/dashboard';
        }
        return;
    }

    /* ---- Hide disallowed nav tabs ---- */
    const allowedTabs = roleNavAccess[role] || roleNavAccess['anonymous'];
    const allTabs = document.querySelectorAll('.dash-nav__tab[id]');
    allTabs.forEach(tab => {
        if (!allowedTabs.includes(tab.id)) {
            tab.style.display = 'none';
        }
    });

    /* ---- Set display name from session ---- */
    let displayName = 'Guest';
    if (sessionUser) {
        displayName = sessionUser.first_name || 'User';
    }
    const usernameEl = document.getElementById('navUsername');
    if (usernameEl) {
        usernameEl.textContent = displayName;
    }
})();
