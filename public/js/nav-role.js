/* ========================================
   CampusSphere — Role-Based Navigation
   1. Route guard – redirects if role cannot access current page
   2. Tab visibility – hides nav tabs the role should not see
   Uses server session data (window.__SESSION_USER) with localStorage fallback.
   ======================================== */
(function () {
    // Prefer server session data, fall back to localStorage
    const sessionUser = window.__SESSION_USER || null;
    const role = sessionUser ? sessionUser.role : (localStorage.getItem('campusphere-role') || 'guest');

    /* ---- Which pages (routes) each role may visit ---- */
    const rolePageAccess = {
        'student-cspc': ['/home', '/dashboard', '/buildings', '/events', '/map', '/about', '/'],
        'instructor': ['/home', '/dashboard', '/buildings', '/events', '/map', '/about', '/'],
        'admin': ['/home', '/dashboard', '/buildings', '/events', '/map', '/about', '/', '/admin'],
        'guest': ['/home', '/dashboard', '/buildings', '/events', '/map', '/about', '/']
    };

    /* ---- Which nav-tab IDs each role can see ---- */
    const roleNavAccess = {
        'student-cspc': ['tabHome', 'tabDashboard', 'tabBuildings', 'tabEvents', 'tabMap', 'tabAbout'],
        'instructor': ['tabHome', 'tabDashboard', 'tabBuildings', 'tabEvents', 'tabMap', 'tabAbout'],
        'admin': ['tabHome', 'tabDashboard', 'tabBuildings', 'tabEvents', 'tabMap', 'tabAbout'],
        'guest': ['tabHome', 'tabDashboard', 'tabBuildings', 'tabEvents', 'tabMap', 'tabAbout']
    };

    /* ---- Route Guard ---- */
    const currentPath = location.pathname || '/';
    const allowedPages = rolePageAccess[role] || rolePageAccess['guest'];

    if (!allowedPages.includes(currentPath)) {
        window.location.href = '/dashboard';
        return;
    }

    /* ---- Hide disallowed nav tabs ---- */
    const allowedTabs = roleNavAccess[role] || roleNavAccess['guest'];
    const allTabs = document.querySelectorAll('.dash-nav__tab[id]');
    allTabs.forEach(tab => {
        if (!allowedTabs.includes(tab.id)) {
            tab.style.display = 'none';
        }
    });

    /* ---- Set display name from session or localStorage ---- */
    let displayName = 'Guest';
    if (sessionUser) {
        // Use server session data
        displayName = sessionUser.first_name || 'User';
    } else {
        // Fallback to localStorage
        if (role === 'student-cspc') {
            const saved = localStorage.getItem('campusphere-student');
            const profile = saved ? JSON.parse(saved) : null;
            displayName = profile && profile.name ? profile.name.split(' ')[0] : 'Aaron';
        } else if (role === 'instructor') {
            const saved = localStorage.getItem('campusphere-instructor');
            const profile = saved ? JSON.parse(saved) : null;
            displayName = profile && profile.name ? profile.name.split(' ')[0] : 'Dr. Santos';
        } else if (role === 'admin') {
            displayName = 'Admin';
        } else {
            const saved = localStorage.getItem('campusphere-non-cspc');
            const profile = saved ? JSON.parse(saved) : null;
            displayName = profile && profile.name ? profile.name.split(' ')[0] : 'Guest';
        }
    }
    const usernameEl = document.getElementById('navUsername');
    if (usernameEl) {
        usernameEl.textContent = displayName;
    }
})();
