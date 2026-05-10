// main.js — CampusSphere Admin

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

    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', () => {
            isSidebarCollapsed = !isSidebarCollapsed;
            
            if (isSidebarCollapsed) {
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
        });
    }

    // ---- Dropdowns ----
    const dropdownTriggers = document.querySelectorAll('.dropdown-trigger');
    
    dropdownTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetId = trigger.getAttribute('data-dropdown-target');
            const targetMenu = document.getElementById(targetId);
            
            // Close all others
            document.querySelectorAll('.dropdown-menu-content').forEach(menu => {
                if (menu.id !== targetId) {
                    menu.removeAttribute('data-state');
                }
            });

            // Toggle current
            if (targetMenu.getAttribute('data-state') === 'open') {
                targetMenu.removeAttribute('data-state');
            } else {
                targetMenu.setAttribute('data-state', 'open');
                
                // Position
                const rect = trigger.getBoundingClientRect();
                targetMenu.style.top = (rect.bottom + window.scrollY + 8) + 'px';
                targetMenu.style.right = (window.innerWidth - rect.right) + 'px';
            }
        });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-menu-content').forEach(menu => {
            menu.removeAttribute('data-state');
        });
    });
    
    // Prevent closing when clicking inside dropdown menu
    document.querySelectorAll('.dropdown-menu-content').forEach(menu => {
        menu.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });
});
