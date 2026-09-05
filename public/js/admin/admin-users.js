/* ========================================
   CampuSphere — Admin Users Client Script
   Handles CRUD operations via AJAX (fetch)
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {

  // ---- DOM References ----
  const userTableBody  = document.getElementById('user-table-body');
  const userCountLabel = document.getElementById('user-count-label');
  const searchInput    = document.getElementById('user-search-input');
  const roleFilterBtn  = document.getElementById('role-filter-btn');
  const roleFilterMenu = document.getElementById('role-filter-menu');
  const statusFilterBtn = document.getElementById('status-filter-btn');
  const statusFilterMenu = document.getElementById('status-filter-menu');
  const addUserBtn     = document.getElementById('add-user-btn');

  // Modals
  const createModal    = document.getElementById('create-user-modal');
  const editModal      = document.getElementById('edit-user-modal');
  const deleteModal    = document.getElementById('delete-user-modal');

  // Toast
  const toast          = document.getElementById('admin-toast');

  // ---- State ----
  let allUsers = [];
  try { allUsers = JSON.parse(document.getElementById('users-data-json').textContent); } catch (e) { allUsers = []; }

  let currentFilter = { role: 'all', status: 'all', search: '' };
  let serverClockOffsetMs = 0;
  let presenceRequestInFlight = false;
  let presencePollTimer = null;

  // ---- Utility: Refresh Lucide icons (M12.P1-R6 guard) ----
  // Every call site below used to invoke `lucide.createIcons()` directly. When
  // the Lucide bundle was unavailable that threw a ReferenceError mid-function,
  // so the statements AFTER it never ran — leaving the rendered user table with
  // no row actions and no dropdown bindings. Icons are decorative here; the
  // table, its labels and its actions must survive without them.
  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  // ---- Utility: Show Toast ----
  function showToast(message, type = 'success') {
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'admin-toast admin-toast--' + type + ' admin-toast--show';
    setTimeout(() => { toast.classList.remove('admin-toast--show'); }, 3500);
  }

  // ---- Utility: Role Badge ----
  function roleBadge(role) {
    const map = {
      'student-cspc': { label: 'Student',    cls: 'bg-chart-1/10 text-chart-1 border-chart-1/20' },
      'instructor':   { label: 'Instructor', cls: 'bg-chart-2/10 text-chart-2 border-chart-2/20' },
      'admin':        { label: 'Admin',      cls: 'bg-chart-4/10 text-chart-4 border-chart-4/20' },
      'guest':        { label: 'Guest',      cls: 'bg-muted text-muted-foreground border-border' }
    };
    const info = map[role] || map['guest'];
    return `<span class="ui-badge ui-badge-outline ${info.cls}">${info.label}</span>`;
  }

  // ---- Utility: five-minute presence ----
  const ONLINE_WINDOW_MS = 5 * 60 * 1000;

  function serverNowMs() {
    return Date.now() + serverClockOffsetMs;
  }

  function isUserOnline(lastSeenAt) {
    const seen = new Date(lastSeenAt || '').getTime();
    if (!Number.isFinite(seen)) return false;
    const now = serverNowMs();
    return seen >= now - ONLINE_WINDOW_MS && seen <= now;
  }

  function statusBadge(lastSeenAt) {
    if (isUserOnline(lastSeenAt)) {
      return '<span class="ui-badge ui-badge-outline bg-chart-1/10 text-chart-1 border-chart-1/20">Online</span>';
    }
    return '<span class="ui-badge ui-badge-outline bg-chart-4/10 text-chart-4 border-chart-4/20">Offline</span>';
  }

  // ---- Utility: Time Ago ----
  function timeAgo(dateStr) {
    if (!dateStr) return 'Never';
    const then = new Date(dateStr).getTime();
    if (!Number.isFinite(then)) return 'Never';
    const diffMs = serverNowMs() - then;
    if (diffMs < 0) return 'Just now';
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + ' min ago';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
    const days = Math.floor(hours / 24);
    if (days < 30) return days + (days === 1 ? ' day ago' : ' days ago');
    const months = Math.floor(days / 30);
    return months + (months === 1 ? ' month ago' : ' months ago');
  }

  // ---- Utility: Initials ----
  // Type-safe: non-string inputs behave as blank (never throw mid-render).
  // "Bleak Santos" -> "BS"; a missing first/last name still yields the other initial.
  function getInitials(firstName, lastName) {
    const f = typeof firstName === 'string' ? firstName : '';
    const l = typeof lastName === 'string' ? lastName : '';
    return ((f[0] || '') + (l[0] || '')).toUpperCase();
  }

  // ---- Render Table ----
  function renderTable() {
    const filtered = allUsers.filter(u => {
      // Role filter
      if (currentFilter.role !== 'all') {
        if (currentFilter.role === 'student-cspc' && u.role !== 'student-cspc') return false;
        if (currentFilter.role === 'instructor' && u.role !== 'instructor') return false;
        if (currentFilter.role === 'admin' && u.role !== 'admin') return false;
        if (currentFilter.role === 'guest' && u.role !== 'guest') return false;
      }
      // Status filter
      if (currentFilter.status !== 'all') {
        const online = isUserOnline(u.last_seen_at);
        if (currentFilter.status === 'online' && !online) return false;
        if (currentFilter.status === 'offline' && online) return false;
      }
      // Search filter
      if (currentFilter.search) {
        const q = currentFilter.search.toLowerCase();
        const full = ((u.first_name || '') + ' ' + (u.last_name || '') + ' ' + (u.email || '')).toLowerCase();
        if (!full.includes(q)) return false;
      }
      return true;
    });

    // Update count label
    if (userCountLabel) {
      userCountLabel.textContent = 'All Users (' + filtered.length + ')';
    }

    if (!userTableBody) return;

    if (filtered.length === 0) {
      userTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding:2rem;">
            <div style="display:flex;flex-direction:column;align-items:center;gap:0.5rem;">
              <i data-lucide="user-x" style="width:2.5rem;height:2.5rem;color:var(--muted-foreground);"></i>
              <p class="text-muted-foreground text-sm">No users found matching your criteria.</p>
            </div>
          </td>
        </tr>`;
      refreshIcons();
      return;
    }

    userTableBody.innerHTML = filtered.map(u => `
      <tr data-user-id="${u.id}">
        <td>
          <div class="flex items-center gap-3">
            <div class="ui-avatar h-9 w-9 shrink-0">
              <div class="ui-avatar-fallback text-xs font-semibold">${escapeHtml(getInitials(u.first_name, u.last_name))}</div>
            </div>
            <span class="text-sm font-medium">${escapeHtml(u.first_name + ' ' + u.last_name)}</span>
          </div>
        </td>
        <td class="text-sm text-muted-foreground">${escapeHtml(u.email)}</td>
        <td>${roleBadge(u.role)}</td>
        <td>${statusBadge(u.last_seen_at)}</td>
        <td class="text-sm text-muted-foreground">${timeAgo(u.last_seen_at)}</td>
        <td>
          <button class="ui-button ui-button-ghost ui-button-size-icon h-8 w-8 dropdown-trigger"
                  data-dropdown-target="user-menu-${u.id}">
            <i data-lucide="more-horizontal" class="h-4 w-4"></i>
          </button>
          <div id="user-menu-${u.id}" class="dropdown-menu-content p-1" style="width:140px;">
            <div class="dropdown-menu-item btn-edit-user" data-user-id="${u.id}">
              <i data-lucide="edit" class="h-4 w-4 mr-2"></i>Edit
            </div>
            <div class="h-px bg-border my-1"></div>
            <div class="dropdown-menu-item text-destructive btn-delete-user" data-user-id="${u.id}">
              <i data-lucide="trash-2" class="h-4 w-4 mr-2"></i>Delete
            </div>
          </div>
        </td>
      </tr>
    `).join('');

    refreshIcons();
    bindRowActions();
    rebindDropdowns();
  }

  // ---- Escape HTML ----
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // ---- Rebind Dropdowns (for dynamically added triggers) ----
  function rebindDropdowns() {
    const triggers = userTableBody.querySelectorAll('.dropdown-trigger');
    triggers.forEach(trigger => {
      // Remove existing listeners by cloning
      const clone = trigger.cloneNode(true);
      trigger.parentNode.replaceChild(clone, trigger);

      clone.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetId = clone.getAttribute('data-dropdown-target');
        const targetMenu = document.getElementById(targetId);

        // Close all other menus
        document.querySelectorAll('.dropdown-menu-content').forEach(menu => {
          if (menu.id !== targetId) menu.removeAttribute('data-state');
        });

        if (targetMenu.getAttribute('data-state') === 'open') {
          targetMenu.removeAttribute('data-state');
        } else {
          targetMenu.setAttribute('data-state', 'open');
          const rect = clone.getBoundingClientRect();
          targetMenu.style.top = (rect.bottom + window.scrollY + 8) + 'px';
          targetMenu.style.right = (window.innerWidth - rect.right) + 'px';
        }
      });
    });
  }

  // ---- Bind Edit/Delete Row Actions ----
  function bindRowActions() {
    // Edit buttons
    document.querySelectorAll('.btn-edit-user').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllDropdowns();
        const id = parseInt(btn.dataset.userId);
        openEditModal(id);
      });
    });

    // Delete buttons
    document.querySelectorAll('.btn-delete-user').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllDropdowns();
        const id = parseInt(btn.dataset.userId);
        openDeleteModal(id);
      });
    });
  }

  function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu-content').forEach(m => m.removeAttribute('data-state'));
  }

  // ---- Update Stat Cards ----
  function updateStatCards() {
    const total = allUsers.length;
    const online = allUsers.filter(u => isUserOnline(u.last_seen_at)).length;
    const offline = total - online;
    const now = new Date();
    const newThisMonth = allUsers.filter(u => {
      const d = new Date(u.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    const el = (id) => document.getElementById(id);
    if (el('stat-total'))    el('stat-total').textContent    = total.toLocaleString();
    if (el('stat-online'))   el('stat-online').textContent   = online.toLocaleString();
    if (el('stat-offline')) el('stat-offline').textContent = offline.toLocaleString();
    if (el('stat-new'))      el('stat-new').textContent      = newThisMonth.toLocaleString();
  }

  // ---- Live presence refresh (one batched GET; no per-user requests) ----
  async function refreshPresence() {
    if (presenceRequestInFlight || document.visibilityState === 'hidden') return;
    presenceRequestInFlight = true;
    try {
      const response = await fetch('/admin/api/users/presence', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) return;
      const snapshot = await response.json();
      const serverNow = new Date(snapshot && snapshot.serverNow).getTime();
      if (!Number.isFinite(serverNow) || !Array.isArray(snapshot.users)) return;
      serverClockOffsetMs = serverNow - Date.now();

      const byId = new Map();
      snapshot.users.forEach((row) => {
        const id = Number(row && row.id);
        if (Number.isSafeInteger(id) && id > 0) {
          byId.set(id, row.lastSeenAt || null);
        }
      });
      allUsers = allUsers.map((user) => ({
        ...user,
        last_seen_at: byId.has(Number(user.id)) ? byId.get(Number(user.id)) : null
      }));
      renderTable();
      updateStatCards();
    } catch (error) {
      // Presence is advisory; a temporary snapshot failure must not break CRUD
      // actions or leave a noisy browser-console error.
    } finally {
      presenceRequestInFlight = false;
    }
  }

  function stopPresencePolling() {
    if (presencePollTimer !== null) {
      clearInterval(presencePollTimer);
      presencePollTimer = null;
    }
  }

  function startPresencePolling() {
    if (presencePollTimer !== null || document.visibilityState === 'hidden') return;
    refreshPresence();
    presencePollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') refreshPresence();
    }, 30 * 1000);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') startPresencePolling();
    else stopPresencePolling();
  });

  // ============================================================
  //  MODAL HELPERS
  // ============================================================

  function openModal(modal) {
    if (!modal) return;
    modal.classList.add('modal--open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('modal--open');
    document.body.style.overflow = '';
  }

  // Close modals on backdrop click or × button
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal(backdrop);
    });
  });
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-backdrop');
      closeModal(modal);
    });
  });

  // ============================================================
  //  CREATE USER
  // ============================================================
  if (addUserBtn) {
    addUserBtn.addEventListener('click', () => {
      // Reset form
      const form = document.getElementById('create-user-form');
      if (form) form.reset();
      clearFormErrors(createModal);
      openModal(createModal);
    });
  }

  const createForm = document.getElementById('create-user-form');
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFormErrors(createModal);

      const data = {
        first_name: createForm.first_name.value.trim(),
        last_name:  createForm.last_name.value.trim(),
        email:      createForm.email.value.trim(),
        password:   createForm.password.value,
        role:       createForm.role.value
      };

      // Client-side validation
      if (!data.first_name || !data.last_name || !data.email || !data.password || !data.role) {
        showFormError(createModal, 'Please fill in all fields.');
        return;
      }

      const submitBtn = createForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i data-lucide="loader-2" class="h-4 w-4 mr-2 animate-spin"></i>Creating...';

      try {
        const res = await fetch('/admin/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const json = await res.json();

        if (json.success) {
          allUsers.unshift(json.user); // Add to top of array
          renderTable();
          updateStatCards();
          closeModal(createModal);
          showToast('User created successfully!', 'success');
        } else {
          showFormError(createModal, json.message || 'Failed to create user.');
        }
      } catch (err) {
        showFormError(createModal, 'Network error. Please try again.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-lucide="plus" class="h-4 w-4 mr-2"></i>Create User';
        refreshIcons();
      }
    });
  }

  // ============================================================
  //  EDIT USER
  // ============================================================
  function openEditModal(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;

    const form = document.getElementById('edit-user-form');
    if (!form) return;

    form.dataset.userId = userId;
    form.first_name.value = user.first_name || '';
    form.last_name.value  = user.last_name || '';
    form.email.value      = user.email || '';
    form.role.value       = user.role || 'guest';
    form.password.value   = ''; // Always blank — optional

    clearFormErrors(editModal);
    openModal(editModal);
  }

  const editForm = document.getElementById('edit-user-form');
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFormErrors(editModal);

      const userId = editForm.dataset.userId;
      const data = {
        first_name: editForm.first_name.value.trim(),
        last_name:  editForm.last_name.value.trim(),
        email:      editForm.email.value.trim(),
        role:       editForm.role.value,
        password:   editForm.password.value // Blank = no change
      };

      if (!data.first_name || !data.last_name || !data.email || !data.role) {
        showFormError(editModal, 'Please fill in all required fields.');
        return;
      }

      const submitBtn = editForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i data-lucide="loader-2" class="h-4 w-4 mr-2 animate-spin"></i>Saving...';

      try {
        const res = await fetch('/admin/api/users/' + userId, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const json = await res.json();

        if (json.success) {
          // Update local array
          const idx = allUsers.findIndex(u => u.id === parseInt(userId));
          if (idx !== -1) {
            // CRUD responses intentionally do not carry presence data; keep
            // the current snapshot until the next single batched refresh.
            allUsers[idx] = { ...json.user, last_seen_at: allUsers[idx].last_seen_at || null };
          }
          renderTable();
          updateStatCards();
          closeModal(editModal);
          showToast('User updated successfully!', 'success');
        } else {
          showFormError(editModal, json.message || 'Failed to update user.');
        }
      } catch (err) {
        showFormError(editModal, 'Network error. Please try again.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-lucide="check" class="h-4 w-4 mr-2"></i>Save Changes';
        refreshIcons();
      }
    });
  }

  // ============================================================
  //  DELETE USER
  // ============================================================
  let pendingDeleteId = null;

  function openDeleteModal(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    pendingDeleteId = userId;

    const nameEl = document.getElementById('delete-user-name');
    if (nameEl) nameEl.textContent = (user.first_name + ' ' + user.last_name).trim();

    openModal(deleteModal);
  }

  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
  const cancelDeleteBtn  = document.getElementById('cancel-delete-btn');

  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', () => {
      pendingDeleteId = null;
      closeModal(deleteModal);
    });
  }

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
      if (!pendingDeleteId) return;

      confirmDeleteBtn.disabled = true;
      confirmDeleteBtn.innerHTML = '<i data-lucide="loader-2" class="h-4 w-4 mr-2 animate-spin"></i>Deleting...';

      try {
        const res = await fetch('/admin/api/users/' + pendingDeleteId, {
          method: 'DELETE'
        });
        const json = await res.json();

        if (json.success) {
          allUsers = allUsers.filter(u => u.id !== pendingDeleteId);
          renderTable();
          updateStatCards();
          closeModal(deleteModal);
          showToast('User deleted successfully.', 'success');
        } else {
          showToast(json.message || 'Failed to delete user.', 'error');
        }
      } catch (err) {
        showToast('Network error. Please try again.', 'error');
      } finally {
        pendingDeleteId = null;
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.innerHTML = '<i data-lucide="trash-2" class="h-4 w-4 mr-2"></i>Delete';
        refreshIcons();
      }
    });
  }

  // ============================================================
  //  SEARCH & FILTERS
  // ============================================================
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentFilter.search = searchInput.value;
      renderTable();
    });
  }

  // Role filter
  if (roleFilterMenu) {
    roleFilterMenu.querySelectorAll('.dropdown-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const val = item.dataset.value || 'all';
        currentFilter.role = val;
        if (roleFilterBtn) roleFilterBtn.querySelector('span').textContent = item.textContent;
        roleFilterMenu.querySelectorAll('.dropdown-menu-item').forEach(i => {
          i.classList.remove('bg-accent', 'text-accent-foreground');
          i.setAttribute('aria-checked', 'false');
        });
        item.classList.add('bg-accent', 'text-accent-foreground');
        item.setAttribute('aria-checked', 'true');
        roleFilterMenu.removeAttribute('data-state');
        if (roleFilterBtn) {
          roleFilterBtn.setAttribute('aria-expanded', 'false');
          roleFilterBtn.focus();
        }
        renderTable();
      });
    });
  }

  // Status filter
  if (statusFilterMenu) {
    statusFilterMenu.querySelectorAll('.dropdown-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const val = item.dataset.value || 'all';
        currentFilter.status = val;
        if (statusFilterBtn) statusFilterBtn.querySelector('span').textContent = item.textContent;
        statusFilterMenu.querySelectorAll('.dropdown-menu-item').forEach(i => {
          i.classList.remove('bg-accent', 'text-accent-foreground');
          i.setAttribute('aria-checked', 'false');
        });
        item.classList.add('bg-accent', 'text-accent-foreground');
        item.setAttribute('aria-checked', 'true');
        statusFilterMenu.removeAttribute('data-state');
        if (statusFilterBtn) {
          statusFilterBtn.setAttribute('aria-expanded', 'false');
          statusFilterBtn.focus();
        }
        renderTable();
      });
    });
  }

  // ---- Form error helpers ----
  function showFormError(modal, msg) {
    const el = modal ? modal.querySelector('.form-error') : null;
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }
  function clearFormErrors(modal) {
    const el = modal ? modal.querySelector('.form-error') : null;
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  }

  // ---- Initial Render ----
  renderTable();
  updateStatCards();
  startPresencePolling();
});
