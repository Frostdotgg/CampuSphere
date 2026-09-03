/**
 * profile-script.js
 * Universal script added to all pages to handle the Profile Dropdown and Edit Modal.
 * Uses server session data (window.__SESSION_USER) with localStorage fallback.
 */

// ===== OUTPUT-ENCODING HELPERS (R1: Stored-XSS Removal) =====
// This universal script injects the profile dropdown/edit modal on every
// authenticated page using session (DB-derived) profile fields. Those values
// must never be interpreted as HTML: escapeHtml() encodes text/quoted-attribute
// contexts and safeUrl() validates image URLs (rejecting javascript:, unsafe
// data:, and attribute-breakout input).
function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function safeUrl(value, opts) {
    if (value === null || value === undefined) return '';
    var s = String(value).trim();
    if (s === '') return '';
    var scheme = s.replace(/\s+/g, '').toLowerCase();
    if (scheme.indexOf('javascript:') === 0 || scheme.indexOf('vbscript:') === 0) return '';
    if (scheme.indexOf('data:') === 0) {
        if (opts && opts.allowDataImage &&
            /^data:image\/(png|jpe?g|gif|webp|bmp);base64,[a-z0-9+/=\s]+$/i.test(s)) return s;
        return '';
    }
    if (s.charAt(0) === '/' || s.charAt(0) === '#' || s.charAt(0) === '.') return s;
    if (/^https?:\/\//i.test(s)) return s;
    var colon = s.indexOf(':');
    if (colon === -1) return s;
    var slash = s.indexOf('/');
    if (slash !== -1 && slash < colon) return s;
    return '';
}

// CSRF synchronizer token for same-origin unsafe fetches / the logout POST
// (Milestone 8, Section 8.2). Read from the rendered <meta> tag only — never
// from localStorage/sessionStorage/IndexedDB.
function getCsrfToken() {
    var m = document.querySelector('meta[name="csrf-token"]');
    return m ? (m.getAttribute('content') || '') : '';
}

const CSPC_STUDENT_COURSES = Object.freeze([
    'Bachelor in Human Services',
    'Bachelor of Arts in English Language Studies',
    'Bachelor of Science in Development Communication',
    'Bachelor of Public Administration',
    'Bachelor of Science in Mathematics',
    'Bachelor of Science in Applied Mathematics',
    'Bachelor of Science in Information Technology',
    'Bachelor of Science in Computer Science',
    'Bachelor of Science in Information Systems',
    'Bachelor of Library and Information Science',
    'Bachelor of Science in Civil Engineering',
    'Bachelor of Science in Electrical Engineering',
    'Bachelor of Science in Electronics Engineering',
    'Bachelor of Science in Mechanical Engineering',
    'Bachelor of Science in Architecture',
    'Bachelor of Science in Computer Engineering',
    'Bachelor of Science in Nursing',
    'Bachelor of Science in Midwifery',
    'Bachelor of Special Needs Education',
    'Bachelor of Physical Education',
    'Bachelor of Culture and Arts Education',
    'Bachelor of Technical-Vocational Teacher Education – Major in Food Service Management',
    'Bachelor of Technical-Vocational Teacher Education – Major in Electronics Technology',
    'Bachelor of Technical-Vocational Teacher Education – Major in Fish Processing',
    'Bachelor of Science in Office Administration',
    'Bachelor of Science in Hospitality Management',
    'Bachelor of Science in Entrepreneurship',
    'Bachelor of Science in Tourism Management',
    'Bachelor of Science in Business Administration – Major in Financial Management',
    'Other'
]);

function normalizeCourseSearch(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[–—-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function attachCourseSearch(searchId, selectId, statusId) {
    const search = document.getElementById(searchId);
    const select = document.getElementById(selectId);
    const status = document.getElementById(statusId);
    if (!search || !select || !status) return;

    const originalOptions = Array.from(select.options)
        .filter((option) => option.value !== '')
        .map((option) => ({ value: option.value, label: option.textContent }));
    const courseCount = originalOptions.filter((option) => option.value !== 'Other').length;
    let preservedValue = select.value;
    const syncPreservedValue = () => {
        select.dataset.preservedCourseValue = preservedValue;
    };

    const renderOptions = () => {
        const query = normalizeCourseSearch(search.value);
        const matches = originalOptions.filter((option) =>
            option.value === 'Other' || !query || normalizeCourseSearch(option.label).includes(query)
        );

        select.replaceChildren();
        const placeholder = new Option('Select your course', '');
        placeholder.disabled = true;
        select.appendChild(placeholder);
        matches.forEach((option) => select.appendChild(new Option(option.label, option.value)));

        if (matches.some((option) => option.value === preservedValue)) {
            select.value = preservedValue;
        } else {
            select.selectedIndex = 0;
        }
        syncPreservedValue();

        const matchCount = matches.filter((option) => option.value !== 'Other').length;
        if (!query) {
            status.textContent = courseCount + ' courses available, plus Other.';
        } else if (matchCount === 0) {
            status.textContent = 'No matching course. Choose Other if your course is not listed.';
        } else {
            status.textContent = matchCount + ' matching course' + (matchCount === 1 ? '' : 's') + '.';
        }
    };

    search.addEventListener('input', renderOptions);
    select.addEventListener('change', () => {
        preservedValue = select.value;
        syncPreservedValue();
    });
    search.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && search.value) {
            search.value = '';
            renderOptions();
        }
    });
    renderOptions();
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Determine role and profile info from session or localStorage
    const sessionUser = window.__SESSION_USER || null;
    const savedRole = sessionUser ? sessionUser.role : (localStorage.getItem('campusphere-role') || 'guest');
    let profileData = {};
    let storageKey = '';

    if (sessionUser) {
        // Build profile data from server session
        profileData = {
            name: (sessionUser.first_name || '') + ' ' + (sessionUser.last_name || ''),
            email: sessionUser.email || '',
            studentId: sessionUser.student_id_number || '',
            course: sessionUser.course || '',
            yearLevel: sessionUser.year_level || '',
            enrollmentStatus: sessionUser.enrollment_status || '',
            semester: sessionUser.semester || '',
            address: sessionUser.address || '',
            phone: sessionUser.phone_number || '',
            profileImage: sessionUser.profile_image_url || '',
            profileImageSource: sessionUser.profile_image_source || ''
        };
    } else {
        // Fallback to localStorage
        if (savedRole === 'student-cspc') {
            storageKey = 'campusphere-student';
            const savedStudent = JSON.parse(localStorage.getItem(storageKey) || 'null') || {};
            // A legacy local mirror may contain a hand-edited name. It is not
            // an identity source, so ignore that property even on the
            // session-free fallback path.
            if (savedStudent && typeof savedStudent === 'object') delete savedStudent.name;
            profileData = {
                name: 'Aaron V. Lasprillas',
                studentId: 'CSPC-2024-001234',
                email: 'aaron.lasprillas@cspc.edu.ph',
                course: 'Bachelor of Science in Information Technology',
                yearLevel: '3rd Year',
                enrollmentStatus: 'Enrolled',
                semester: '2nd Semester, A.Y. 2025-2026',
                ...(savedStudent && typeof savedStudent === 'object' ? savedStudent : {})
            };
        } else if (savedRole === 'instructor') {
            storageKey = 'campusphere-instructor';
            const savedInstructor = JSON.parse(localStorage.getItem(storageKey) || 'null') || {};
            profileData = {
                // Instructor names are account-managed; old local mirrors may
                // not override the safe demo fallback.
                name: 'Dr. Maria Santos',
                email: savedInstructor.email || 'maria.santos@cspc.edu.ph',
                profileImage: savedInstructor.profileImage || '',
                profileImageSource: savedInstructor.profileImageSource || '',
                status: savedInstructor.status || 'Active'
            };
        } else if (savedRole === 'admin') {
            storageKey = 'campusphere-admin';
            profileData = JSON.parse(localStorage.getItem(storageKey)) || { name: 'Admin User', email: 'admin@cspc.edu.ph' };
        } else if (savedRole === 'student-non-cspc') {
            storageKey = 'campusphere-non-cspc';
            profileData = JSON.parse(localStorage.getItem(storageKey)) || { name: 'Guest Student', email: 'student@gmail.com' };
        } else {
            profileData = { name: 'Guest User', email: '' };
        }
    }

    // Update nav username dynamically globally
    const navUsername = document.getElementById('navUsername') || document.querySelector('.dash-nav__username');
    if (navUsername && profileData.name) {
        navUsername.textContent = profileData.name.trim().split(' ')[0];
    }
    const sidebarName = document.getElementById('sidebarName');
    if (sidebarName && profileData.name) {
        sidebarName.textContent = profileData.name.trim();
    }
    const sidebarEmail = document.getElementById('sidebarEmail');
    if (sidebarEmail && profileData.email) {
        sidebarEmail.textContent = profileData.email;
    }

    // Apply Profile Image globally
    const applyProfileImage = (rawImg) => {
        // Validate the image URL/data-URL before it touches the DOM; an invalid
        // value falls through to the default avatar SVG (R1).
        const base64Img = safeUrl(rawImg, { allowDataImage: true });
        const avatars = document.querySelectorAll('.dash-nav__avatar, .sidebar-profile__img, .sidebar__avatar');
        if (!base64Img) {
            // Revert back to default SVG
            avatars.forEach(avatar => {
                if (avatar.classList.contains('sidebar-profile__img')) {
                    avatar.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
                    avatar.style.padding = '8px';
                } else if (avatar.classList.contains('sidebar__avatar')) {
                    avatar.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
                    avatar.style.padding = '';
                } else {
                    avatar.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
                    avatar.style.padding = '';
                }
            });
            return;
        }

        // Show the validated profile image via DOM APIs, never innerHTML.
        avatars.forEach(avatar => {
            avatar.textContent = '';
            const img = document.createElement('img');
            img.src = base64Img;
            img.alt = '';
            img.setAttribute('aria-hidden', 'true');
            img.referrerPolicy = 'no-referrer';
            img.decoding = 'async';
            img.style.cssText = 'width:100%; height:100%; object-fit:cover; border-radius:50%;';
            img.addEventListener('error', () => {
                // A provider URL can expire or be unavailable. Only the image
                // that is still mounted may trigger the shared fallback.
                if (img.parentElement === avatar) applyProfileImage('');
            });
            avatar.appendChild(img);
            avatar.style.padding = '0'; // Remove padding for full fill
        });
    };

    if (profileData.profileImage) {
        applyProfileImage(profileData.profileImage);
    }

    // 2. Build Dropdown
    const userContainer = document.querySelector('.dash-nav__user');
    if (!userContainer) return;
    // Programmatic focus target used only when the modal closes. Keeping this
    // at -1 avoids introducing a role=button element that contains the real
    // dropdown buttons (invalid nested-interactive semantics).
    userContainer.tabIndex = -1;

    const existingDropdown = document.querySelector('.profile-dropdown');
    if (existingDropdown) existingDropdown.remove();

    const dropdown = document.createElement('div');
    dropdown.className = 'profile-dropdown';

    // Editing requires an authenticated session — anonymous visitors must not see
    // the Edit Profile button. All real roles (including guest) can edit; the
    // per-role modal branch below decides which fields are shown.
    const canEdit = Boolean(sessionUser);
    const identityManagedName = ['student-cspc', 'guest', 'instructor'].includes(savedRole);
    let dropdownHTML = '';

    if (canEdit) {
        dropdownHTML += `
            <button type="button" class="profile-dropdown__btn" id="editProfileBtn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                Edit Profile
            </button>
        `;
    }
    dropdownHTML += `
        <button type="button" class="profile-dropdown__btn" id="logoutBtn" style="color:var(--red);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Logout
        </button>
    `;

    dropdown.innerHTML = dropdownHTML;
    userContainer.appendChild(dropdown);

    userContainer.addEventListener('click', (e) => {
        dropdown.classList.toggle('show');
        e.stopPropagation();
    });

    document.addEventListener('click', () => {
        dropdown.classList.remove('show');
    });

    // 3. Build Edit Modal if applicable
    if (canEdit) {
        let modalFields = '';
        const safeProfileImg = safeUrl(profileData.profileImage, { allowDataImage: true });
        const isGoogleProfileImage = profileData.profileImageSource === 'google';
        const profileImageAlt = isGoogleProfileImage ? 'Google profile picture' : 'Profile picture';
        const currentImg = safeProfileImg
            ? `<img src="${escapeHtml(safeProfileImg)}" alt="${profileImageAlt}" id="previewProfileImg" referrerpolicy="no-referrer">`
            : `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="previewProfileSvg"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

        const profilePhotoArea = `
            <div class="edit-profile-photo">
                <div class="edit-photo-preview" id="editPhotoPreviewContainer">
                    ${currentImg}
                </div>
                <p class="edit-photo-sync-note" role="status">
                    Profile photos are currently read-only. Google-managed photos
                    refresh after you sign out and sign in again.
                </p>
            </div>
        `;

        const fullNameField = identityManagedName
            ? `
                <div class="edit-form-group">
                    <label class="edit-form-label" for="editName">Full Name</label>
                    <input type="text" id="editName" class="edit-form-input edit-form-input--readonly"
                        value="${escapeHtml(profileData.name)}" readonly aria-readonly="true"
                        aria-describedby="editNameHelp" title="Managed by your account identity">
                    <span class="edit-form-help" id="editNameHelp">
                        This name is managed by your account identity and cannot be changed here.
                    </span>
                </div>
            `
            : `
                <div class="edit-form-group">
                    <label class="edit-form-label" for="editName">Full Name</label>
                    <input type="text" id="editName" class="edit-form-input" value="${escapeHtml(profileData.name)}">
                </div>
            `;

        if (savedRole === 'student-cspc') {
            const currentCourse = String(profileData.course || '').trim();
            const courseOptions = currentCourse && !CSPC_STUDENT_COURSES.includes(currentCourse)
                ? [currentCourse, ...CSPC_STUDENT_COURSES]
                : [...CSPC_STUDENT_COURSES];
            const yearOptions = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

            const courseSelectHTML = [
                `<option value="" disabled ${currentCourse ? '' : 'selected'}>Select your course</option>`,
                ...courseOptions.map(c =>
                    `<option value="${escapeHtml(c)}" ${currentCourse === c ? 'selected' : ''}>${escapeHtml(c)}</option>`
                )
            ].join('');
            const yearSelectHTML = yearOptions.map(y =>
                `<option value="${y}" ${profileData.yearLevel === y ? 'selected' : ''}>${y}</option>`
            ).join('');

            modalFields = profilePhotoArea + `
                ${fullNameField}
                <div class="edit-form-group">
                    <label class="edit-form-label" for="editId">Student ID</label>
                    <input type="text" id="editId" class="edit-form-input" value="${escapeHtml(profileData.studentId)}">
                </div>
                <div class="edit-form-group">
                    <label class="edit-form-label" for="editEmail">Email</label>
                    <input type="email" id="editEmail" class="edit-form-input" value="${escapeHtml(profileData.email)}" readonly disabled title="Email cannot be changed">
                </div>
                <div class="edit-form-group">
                    <label class="edit-form-label" for="editCourseSearch">Search courses</label>
                    <input type="search" id="editCourseSearch" class="edit-form-input course-search-input"
                        placeholder="Type part of your course name" autocomplete="off" spellcheck="false"
                        aria-controls="editCourse" aria-describedby="editCourseSearchHint editCourseSearchStatus">
                    <span class="course-search-hint" id="editCourseSearchHint">Type to filter the list, then select your course.</span>
                    <span class="course-search-status" id="editCourseSearchStatus" role="status" aria-live="polite"></span>
                    <label class="sr-only" for="editCourse">Course</label>
                    <select id="editCourse" class="edit-form-input" aria-describedby="editCourseSearchHint editCourseSearchStatus">${courseSelectHTML}</select>
                </div>
                <div class="edit-form-group">
                    <label class="edit-form-label" for="editYear">Year Level</label>
                    <select id="editYear" class="edit-form-input">${yearSelectHTML}</select>
                </div>
            `;
        } else if (savedRole === 'instructor') {
            modalFields = profilePhotoArea + `
                ${fullNameField}
                <div class="edit-form-group">
                    <label class="edit-form-label" for="editEmail">Email</label>
                    <input type="email" id="editEmail" class="edit-form-input" value="${escapeHtml(profileData.email)}" readonly disabled title="Email cannot be changed">
                </div>
            `;
        } else if (savedRole === 'guest') {
            modalFields = profilePhotoArea + `
                ${fullNameField}
                <div class="edit-form-group">
                    <label class="edit-form-label" for="editEmail">Email</label>
                    <input type="email" id="editEmail" class="edit-form-input" value="${escapeHtml(profileData.email)}" readonly disabled title="Email cannot be changed">
                </div>
                <div class="edit-form-group">
                    <label class="edit-form-label" for="editAddress">Address</label>
                    <input type="text" id="editAddress" class="edit-form-input" value="${escapeHtml(profileData.address || '')}">
                </div>
                <div class="edit-form-group">
                    <label class="edit-form-label" for="editPhone">Phone</label>
                    <input type="text" id="editPhone" class="edit-form-input" value="${escapeHtml(profileData.phone || '')}">
                </div>
            `;
        } else {
            // admin — simple name + email + read-only profile photo
            modalFields = profilePhotoArea + `
                ${fullNameField}
                <div class="edit-form-group">
                    <label class="edit-form-label" for="editEmail">Email</label>
                    <input type="email" id="editEmail" class="edit-form-input" value="${escapeHtml(profileData.email)}" readonly disabled title="Email cannot be changed">
                </div>
            `;
        }

        const modalHTML = `
            <div class="edit-modal-overlay" id="editModalOverlay" aria-hidden="true" inert>
                <div class="edit-modal" id="editModalDialog" role="dialog" aria-modal="true" aria-labelledby="editModalTitle" tabindex="-1">
                    <div class="edit-modal__header">
                        <h2 class="edit-modal__title" id="editModalTitle">Edit Profile</h2>
                        <button type="button" class="edit-modal__close" id="closeEditModal" aria-label="Close edit profile dialog">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div class="edit-modal__body">
                        ${modalFields}
                    </div>
                    <div class="edit-modal__footer">
                        <button type="button" class="btn btn--outline btn--sm" id="cancelEditBtn">Cancel</button>
                        <button type="button" class="btn btn--primary btn--sm" id="saveEditBtn">Save Changes</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        if (savedRole === 'student-cspc') {
            attachCourseSearch('editCourseSearch', 'editCourse', 'editCourseSearchStatus');
        }

        const overlay = document.getElementById('editModalOverlay');
        const modalDialog = document.getElementById('editModalDialog');
        const closeBtn = document.getElementById('closeEditModal');
        const cancelBtn = document.getElementById('cancelEditBtn');
        const saveBtn = document.getElementById('saveEditBtn');
        const editBtn = document.getElementById('editProfileBtn');
        let lastModalTrigger = null;

        const getModalFocusableElements = () => Array.from(modalDialog.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )).filter((element) => element.getClientRects().length > 0);

        // Structural lookup for the control that owns the collapsible menu a
        // trigger lives in, used only as a close-time focus target. Navigation
        // element ids are deliberately NOT named here: the mobile menu's state is
        // owned solely by /js/authenticated-nav.js (M12.P1-D2), so this walks the
        // trigger's ancestors and returns whichever control declares
        // aria-controls for one of them from outside it. Read-only — this file
        // never mutates menu classes or aria state.
        const findMenuControllerFor = (element) => {
            let node = element && element.parentElement;
            while (node && node !== document.body) {
                // Guard the attribute selector against ids needing escaping.
                if (node.id && /^[A-Za-z][\w-]*$/.test(node.id)) {
                    const controller = document.querySelector('[aria-controls="' + node.id + '"]');
                    if (controller && !node.contains(controller)) return controller;
                }
                node = node.parentElement;
            }
            return null;
        };

        // Open-time focus placement. The overlay starts at `visibility: hidden`,
        // and .focus() on a not-yet-visible element is silently ignored — that is
        // how focus used to stay on <body> with the dialog open. Placement is
        // therefore verified, and retried on the following frame if it did not
        // take, instead of being assumed to have worked.
        const focusInitialModalElement = () => {
            if (!overlay.classList.contains('show')) return;
            const focusable = getModalFocusableElements();
            (focusable[0] || modalDialog).focus();
            if (!modalDialog.contains(document.activeElement)) modalDialog.focus();
        };

        // The keyboard contract cannot live on the overlay. If focus is on
        // <body> (or anywhere else outside the dialog) the overlay never
        // receives the keydown, so Tab walks into the page behind the modal.
        // This handler is registered on `document` in the CAPTURE phase for
        // exactly as long as the modal is open, and removed on close.
        // stopPropagation is used only for keys the modal actually consumes, so
        // the mobile-nav document handlers keep their normal behaviour.
        const handleModalKeydown = (e) => {
            if (!overlay.classList.contains('show')) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                closeModal();
                return;
            }
            if (e.key !== 'Tab') return;

            const focusable = getModalFocusableElements();
            if (focusable.length === 0) {
                e.preventDefault();
                e.stopPropagation();
                modalDialog.focus();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            // Focus is outside the dialog (escaped, or never entered it):
            // recapture rather than letting the browser advance behind the modal.
            if (!modalDialog.contains(document.activeElement)) {
                e.preventDefault();
                e.stopPropagation();
                (e.shiftKey ? last : first).focus();
                return;
            }
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                e.stopPropagation();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                e.stopPropagation();
                first.focus();
            }
        };

        // One state setter owns every visual, pointer, accessibility, and focus
        // transition. The hidden overlay is inert immediately, so it cannot
        // intercept the profile menu or Logout while its opacity is zero.
        const setEditModalOpen = (open, trigger) => {
            if (open) {
                lastModalTrigger = trigger === editBtn ? userContainer : (trigger || document.activeElement);
                overlay.inert = false;
                overlay.removeAttribute('inert');
                overlay.setAttribute('aria-hidden', 'false');
                overlay.classList.add('show');
                dropdown.classList.remove('show');
                document.addEventListener('keydown', handleModalKeydown, true);
                window.requestAnimationFrame(() => {
                    focusInitialModalElement();
                    if (!modalDialog.contains(document.activeElement)) {
                        window.requestAnimationFrame(focusInitialModalElement);
                    }
                });
                return;
            }

            document.removeEventListener('keydown', handleModalKeydown, true);
            overlay.classList.remove('show');
            const focusTarget = lastModalTrigger;
            lastModalTrigger = null;
            if (focusTarget && document.contains(focusTarget)) focusTarget.focus();
            // Focus must never be left inside the closing dialog, nor stranded on
            // <body> (which restarts keyboard travel at the top of the page).
            // Focusing a hidden element is silently ignored, and BOTH plausible
            // owners can be hidden: the mobile trigger lives inside a collapsible
            // menu that closes behind the modal, and the desktop profile menu is
            // hidden at narrow widths. Try each owner until one accepts focus.
            const restoreFocusToOwner = () => {
                const active = document.activeElement;
                if (active && active !== document.body && !overlay.contains(active)) return;
                const restoreCandidates = [userContainer, findMenuControllerFor(focusTarget)];
                for (let i = 0; i < restoreCandidates.length; i++) {
                    const candidate = restoreCandidates[i];
                    if (!candidate || !document.contains(candidate)) continue;
                    candidate.focus();
                    if (document.activeElement === candidate) break;
                }
            };
            // Ordering matters: focus must leave the overlay BEFORE it is marked
            // inert, otherwise the browser blurs it to <body> and a hidden trigger
            // leaves nothing focused at all.
            restoreFocusToOwner();
            overlay.setAttribute('aria-hidden', 'true');
            overlay.inert = true;
            overlay.setAttribute('inert', '');
            // The inert blur can still settle after this turn; re-check once.
            window.requestAnimationFrame(restoreFocusToOwner);
        };

        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                setEditModalOpen(true, editBtn);
            });
        }

        // Mobile Edit Profile button (in hamburger menu). M12.P1-D2: menu
        // open/close state is owned solely by /js/authenticated-nav.js (its
        // capture-phase tab delegation closes the menu even though this
        // handler stops propagation), so no menu classes are touched here.
        const mobileEditBtn = document.getElementById('mobileEditProfileBtn');
        if (mobileEditBtn) {
            mobileEditBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                setEditModalOpen(true, mobileEditBtn);
            });
        }

        const closeModal = () => {
            setEditModalOpen(false);
        };
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
        // NOTE: the Escape/Tab trap is deliberately NOT bound to the overlay —
        // see handleModalKeydown above. An overlay-scoped keydown listener only
        // fires once focus is already inside the overlay, which is precisely the
        // case that was broken.

        saveBtn.addEventListener('click', async () => {

            // Build newData based on role.
            // NOTE: email is intentionally not collected from the input — it is an
            // immutable identity field. The server rejects it if sent.
            let newData = { ...profileData };
            const nameEl = document.getElementById('editName');
            if (identityManagedName) {
                // Keep the Google-managed name in the rendered field, but do
                // not copy it into any client update payload or local mirror.
                delete newData.name;
            } else if (nameEl) {
                newData.name = nameEl.value;
            }

            if (savedRole === 'student-cspc') {
                const idEl = document.getElementById('editId');
                const courseEl = document.getElementById('editCourse');
                const yearEl = document.getElementById('editYear');
                if (idEl) newData.studentId = idEl.value;
                if (courseEl) {
                    newData.course = courseEl.value || courseEl.dataset.preservedCourseValue || '';
                }
                if (yearEl) newData.yearLevel = yearEl.value;
                if (window.CampuSphereData) {
                    window.CampuSphereData.studentProfile = { ...window.CampuSphereData.studentProfile, ...newData };
                }
            } else if (savedRole === 'instructor') {
                if (window.CampuSphereData) {
                    window.CampuSphereData.instructorProfile = { ...window.CampuSphereData.instructorProfile, ...newData };
                }
            } else if (savedRole === 'guest') {
                const addressEl = document.getElementById('editAddress');
                const phoneEl = document.getElementById('editPhone');
                if (addressEl) newData.address = addressEl.value;
                if (phoneEl) newData.phone = phoneEl.value;
            }

            // Save editable fields to localStorage using the role's key (for
            // backward compatibility). Locked roles never write a name mirror.
            if (storageKey) {
                localStorage.setItem(storageKey, JSON.stringify(newData));
            }

            // Administrators may edit their name. Participant navigation keeps
            // the server-provided identity and is never changed from a form.
            if (!identityManagedName) {
                const newName = nameEl ? nameEl.value : newData.name;
                if (navUsername) navUsername.textContent = newName.split(' ')[0];
                if (sidebarName) sidebarName.textContent = newName;
            }

            // POST to server to persist changes to the database
            if (sessionUser) {
                try {
                    saveBtn.disabled = true;
                    saveBtn.textContent = 'Saving...';
                    // Do NOT send role or email — both are immutable and the server
                    // will reject the request outright if either is present. A
                    // participant name is also server-managed and omitted.
                    const payload = {};
                    if (!identityManagedName) payload.name = newData.name;
                    if (savedRole === 'student-cspc') {
                        payload.studentId = newData.studentId;
                        payload.course = newData.course;
                        payload.yearLevel = newData.yearLevel;
                    } else if (savedRole === 'guest') {
                        payload.address = newData.address;
                        payload.phone = newData.phone;
                    }

                    const resp = await fetch('/api/update-profile', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': getCsrfToken()
                        },
                        body: JSON.stringify(payload)
                    });
                    if (resp.ok) {
                        closeModal();
                        // Reload so session data refreshes from DB
                        window.location.reload();
                        return;
                    } else {
                        const errData = await resp.json().catch(() => ({}));
                        alert(errData.message || errData.error || 'Failed to save profile. Please try again.');
                        saveBtn.disabled = false;
                        saveBtn.textContent = 'Save Changes';
                    }
                } catch (err) {
                    console.error('Profile save error:', err);
                    alert('Network error. Please try again.');
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save Changes';
                }
            } else {
                closeModal();
                // Optional: If dashboard, maybe re-render
                if (window.switchSection && window.currentRole && window.currentSection) {
                    window.switchSection(window.currentSection);
                } else {
                    window.location.reload();
                }
            }
        });

        const previewContainer = document.getElementById('editPhotoPreviewContainer');
        const restorePreviewFallback = () => {
            if (!previewContainer) return;
            previewContainer.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" id="previewProfileSvg"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        };
        const previewImage = document.getElementById('previewProfileImg');
        if (previewImage && previewContainer) {
            previewImage.referrerPolicy = 'no-referrer';
            previewImage.addEventListener('error', () => {
                if (previewImage.parentElement === previewContainer) restorePreviewFallback();
            });
        }

    }

    // 4. Logout — truthful shared async flow (M12.P1-D1).
    // A fresh token is fetched from GET /auth/csrf-token immediately before the
    // POST (the rendered meta can be stale after bfcache/second-tab logout). On
    // the FIRST 403 only, one refreshed retry runs — never a third POST. Local
    // auth remnants are cleared and navigation happens ONLY after a confirmed
    // 200 success (or a 401 proving no live session remains); a failure keeps
    // the signed-in state truthful, restores both buttons, and announces a
    // fixed message in a role=alert region. The redirect target is the exact
    // allowlisted /auth?logged_out=1 constant — the server response's redirect
    // field is deliberately NOT trusted — so public/js/pwa.js retains ownership
    // of the dynamic-cache/offline-catalog cleanup on that landing.
    const logoutBtn = document.getElementById('logoutBtn');
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
    const LOGOUT_REDIRECT = '/auth?logged_out=1';
    const LOGOUT_ERROR_MESSAGE = 'Unable to sign out. Please try again.';
    const AUTH_STORAGE_KEYS = [
        'campusphere-role',
        'campusphere-student',
        'campusphere-instructor',
        'campusphere-admin',
        'campusphere-non-cspc'
    ];
    let logoutInFlight = false;

    const setLogoutBusy = (busy) => {
        [logoutBtn, mobileLogoutBtn].forEach((btn) => {
            if (!btn) return;
            btn.disabled = busy;
            btn.setAttribute('aria-busy', busy ? 'true' : 'false');
        });
    };

    // Visible accessible failure announcement (textContent only; styles via
    // CSSOM like the pwa.js banner, so the nonce CSP is unaffected).
    const showLogoutError = () => {
        let el = document.getElementById('logoutErrorAlert');
        if (!el) {
            el = document.createElement('div');
            el.id = 'logoutErrorAlert';
            el.setAttribute('role', 'alert');
            el.setAttribute('aria-live', 'assertive');
            el.style.cssText = [
                'position:fixed',
                'left:50%',
                'transform:translateX(-50%)',
                'top:calc(12px + env(safe-area-inset-top, 0px))',
                'z-index:2147483646',
                'max-width:calc(100vw - 24px)',
                'padding:10px 18px',
                'border-radius:10px',
                'font:600 0.9rem/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
                'background:#7a2e0e',
                'color:#ffffff',
                'box-shadow:0 6px 20px rgba(0,0,0,0.28)',
                'text-align:center'
            ].join(';');
            (document.body || document.documentElement).appendChild(el);
        }
        el.textContent = LOGOUT_ERROR_MESSAGE;
        el.hidden = false;
    };

    // Confirmed end of the authenticated session (200 success or 401): clear
    // ONLY the auth remnants — theme, unrelated storage, and PWA shell/static
    // caches are preserved — then navigate to the exact allowlisted target.
    const finishLogoutSuccess = () => {
        AUTH_STORAGE_KEYS.forEach((key) => {
            try { localStorage.removeItem(key); } catch (err) { /* storage unavailable */ }
        });
        window.location.assign(LOGOUT_REDIRECT);
    };

    const failLogout = () => {
        logoutInFlight = false;
        setLogoutBusy(false);
        showLogoutError();
    };

    // Fetch the CURRENT session token. Returns { token } on success,
    // { unauthenticated: true } on 401 (no live session remains), or
    // { failed: true } for anything else. The token stays in memory only.
    const fetchFreshCsrfToken = async () => {
        const resp = await fetch('/auth/csrf-token', {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
            headers: { 'Accept': 'application/json' }
        });
        if (resp.status === 401) return { unauthenticated: true };
        if (!resp.ok) return { failed: true };
        let data = null;
        try { data = await resp.json(); } catch (err) { return { failed: true }; }
        if (!data || data.success !== true ||
            typeof data.csrfToken !== 'string' || data.csrfToken.length === 0) {
            return { failed: true };
        }
        return { token: data.csrfToken };
    };

    const postLogout = (token) => fetch('/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json', 'X-CSRF-Token': token }
    });

    const handleLogout = async (e) => {
        e.preventDefault();
        if (logoutInFlight) return;
        logoutInFlight = true;
        setLogoutBusy(true);
        try {
            const first = await fetchFreshCsrfToken();
            if (first.unauthenticated) return finishLogoutSuccess();
            if (!first.token) return failLogout();

            let resp = await postLogout(first.token);
            if (resp.status === 403) {
                // Exactly one refreshed retry on the FIRST 403 — never a third POST.
                const second = await fetchFreshCsrfToken();
                if (second.unauthenticated) return finishLogoutSuccess();
                if (!second.token) return failLogout();
                resp = await postLogout(second.token);
            }

            if (resp.status === 401) return finishLogoutSuccess();
            if (resp.status === 200) {
                let data = null;
                try { data = await resp.json(); } catch (err) { return failLogout(); }
                if (data && data.success === true) return finishLogoutSuccess();
                return failLogout();
            }
            // 403 after the retry, 5xx, or any other status: stay put, stay truthful.
            return failLogout();
        } catch (err) {
            // Network failure: no navigation, no remnant clearing.
            return failLogout();
        }
    };

    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', handleLogout);
    }
});
