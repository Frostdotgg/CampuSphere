/* ========================================
   CampuSphere — Admin FAQs Client Script
   Milestone 7, Section 7.5.

   API-driven FAQ management for /admin/faqs. All database-derived
   content is rendered through DOM APIs + textContent (never innerHTML
   interpolation), so a stored payload like <img src=x onerror=...>
   renders as inert text. Numeric ids are validated before they touch
   a dataset value or a URL.
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {

  // ---- DOM references ----
  const listEl = document.getElementById('faq-list');
  const loadingEl = document.getElementById('faq-loading');
  const errorEl = document.getElementById('faq-error');
  const emptyEl = document.getElementById('faq-empty');
  const filteredEmptyEl = document.getElementById('faq-filtered-empty');
  const retryBtn = document.getElementById('faq-retry-btn');
  const listLabel = document.getElementById('faq-list-label');
  const statTotal = document.getElementById('faq-stat-total');
  const statCategories = document.getElementById('faq-stat-categories');
  const statShowing = document.getElementById('faq-stat-showing');
  const searchInput = document.getElementById('faq-search-input');
  const categoryFilter = document.getElementById('faq-category-filter');
  const addBtn = document.getElementById('add-faq-btn');

  const modal = document.getElementById('faq-modal');
  const modalTitle = document.getElementById('faq-modal-title');
  const form = document.getElementById('faq-form');
  const submitBtn = document.getElementById('faq-submit-btn');
  const submitLabel = document.getElementById('faq-submit-label');

  const deleteModal = document.getElementById('faq-delete-modal');
  const deleteQuestionEl = document.getElementById('faq-delete-question');
  const cancelDeleteBtn = document.getElementById('faq-cancel-delete-btn');
  const confirmDeleteBtn = document.getElementById('faq-confirm-delete-btn');

  const toast = document.getElementById('admin-toast');

  const UNCATEGORIZED = 'Uncategorized';

  // ---- State ----
  let allFaqs = [];
  let filter = { search: '', category: '' };
  let mode = 'create';            // 'create' | 'edit'
  let editingId = null;
  let pendingDeleteId = null;
  let requestBusy = false;        // guards against duplicate submissions
  let lastFocused = null;         // focus restoration after modal close

  // ---- Small helpers ----
  function showToast(message, type) {
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'admin-toast admin-toast--' + (type || 'success') + ' admin-toast--show';
    setTimeout(() => { toast.classList.remove('admin-toast--show'); }, 3500);
  }

  // Validate an id from untrusted JSON into a positive integer, or null.
  function toId(v) {
    const n = Number(v);
    return (Number.isInteger(n) && n >= 1) ? n : null;
  }

  function catOf(faq) {
    const c = faq && faq.category != null ? String(faq.category).trim() : '';
    return c === '' ? UNCATEGORIZED : c;
  }

  function orderOf(faq) {
    const n = Number(faq && faq.display_order);
    return Number.isFinite(n) ? n : 0;
  }

  function sortFaqs(rows) {
    return rows.slice().sort((a, b) => {
      const byOrder = orderOf(a) - orderOf(b);
      if (byOrder !== 0) return byOrder;
      return (toId(a.id) || 0) - (toId(b.id) || 0);
    });
  }

  function applyFilters() {
    const q = filter.search.trim().toLowerCase();
    return sortFaqs(allFaqs).filter((f) => {
      if (filter.category && catOf(f) !== filter.category) return false;
      if (q) {
        const hay = [f.question, f.answer, f.category]
          .map((v) => (v == null ? '' : String(v)))
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function distinctCategories() {
    const set = new Set();
    allFaqs.forEach((f) => set.add(catOf(f)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  function rebuildCategoryFilter() {
    if (!categoryFilter) return;
    const current = filter.category;
    while (categoryFilter.options.length > 1) categoryFilter.remove(1);
    let stillExists = false;
    distinctCategories().forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      if (cat === current) stillExists = true;
      categoryFilter.appendChild(opt);
    });
    if (current && !stillExists) filter.category = '';
    categoryFilter.value = filter.category;
  }

  // ---- States + rendering ----
  function setState(state) {
    if (loadingEl) loadingEl.hidden = state !== 'loading';
    if (errorEl) errorEl.hidden = state !== 'error';
    if (emptyEl) emptyEl.hidden = state !== 'empty';
    if (filteredEmptyEl) filteredEmptyEl.hidden = state !== 'filtered-empty';
    if (listEl) listEl.hidden = state !== 'list';
  }

  function render() {
    const filtered = applyFilters();

    if (statTotal) statTotal.textContent = String(allFaqs.length);
    if (statCategories) statCategories.textContent = String(allFaqs.length ? distinctCategories().length : 0);
    if (statShowing) statShowing.textContent = String(filtered.length);
    if (listLabel) {
      listLabel.textContent = (filtered.length === allFaqs.length)
        ? 'All FAQs (' + allFaqs.length + ')'
        : 'Showing ' + filtered.length + ' of ' + allFaqs.length + ' FAQs';
    }

    if (allFaqs.length === 0) { setState('empty'); refreshIcons(); return; }
    if (filtered.length === 0) { setState('filtered-empty'); refreshIcons(); return; }

    listEl.textContent = '';
    filtered.forEach((faq, idx) => {
      listEl.appendChild(buildItem(faq, idx === filtered.length - 1));
    });
    setState('list');
    refreshIcons();
  }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  // Build one accordion item with DOM APIs only — no HTML interpolation.
  function buildItem(faq, isLast) {
    const id = toId(faq.id);

    const item = document.createElement('details');
    item.className = 'faq-item py-4 group' + (isLast ? '' : ' border-b border-border');
    if (id !== null) item.dataset.faqId = String(id);

    const summary = document.createElement('summary');
    summary.className = 'faq-item-summary flex flex-1 items-center justify-between text-sm font-medium hover:underline outline-none';

    const row = document.createElement('div');
    row.className = 'faq-summary-row flex items-center justify-between w-full pr-4';

    const qSpan = document.createElement('span');
    qSpan.className = 'faq-question-text';
    qSpan.textContent = faq.question == null ? '' : String(faq.question);

    const right = document.createElement('div');
    right.className = 'flex items-center gap-2 ml-4 shrink-0';

    const badge = document.createElement('span');
    badge.className = 'ui-badge ui-badge-outline faq-category-badge bg-chart-2/10 text-chart-2 border-chart-2/20';
    badge.textContent = catOf(faq);

    const chevron = document.createElement('i');
    chevron.setAttribute('data-lucide', 'chevron-down');
    chevron.className = 'h-4 w-4 shrink-0 text-muted-foreground accordion-icon';

    right.appendChild(badge);
    right.appendChild(chevron);
    row.appendChild(qSpan);
    row.appendChild(right);
    summary.appendChild(row);

    const body = document.createElement('div');
    body.className = 'pb-1 pt-4 text-sm text-muted-foreground';

    const answer = document.createElement('p');
    answer.className = 'faq-answer-text mb-4';
    answer.textContent = faq.answer == null ? '' : String(faq.answer);

    const foot = document.createElement('div');
    foot.className = 'faq-item-foot flex items-center justify-between';

    const orderNote = document.createElement('span');
    orderNote.className = 'text-xs text-muted-foreground';
    orderNote.textContent = 'Display order: ' + orderOf(faq);

    const actions = document.createElement('div');
    actions.className = 'faq-item-actions flex items-center gap-2';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'ui-button ui-button-outline ui-button-size-sm faq-action-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => { if (id !== null) openEditModal(id); });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'ui-button ui-button-outline ui-button-size-sm text-destructive faq-action-btn';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => { if (id !== null) openDeleteModal(id); });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    foot.appendChild(orderNote);
    foot.appendChild(actions);
    body.appendChild(answer);
    body.appendChild(foot);

    item.appendChild(summary);
    item.appendChild(body);
    return item;
  }

  // ---- API helper ----
  // 401 -> redirect to /auth. Malformed/non-JSON bodies -> json: null so
  // callers fall back to a generic fixed error message.
  async function apiRequest(url, options) {
    const res = await fetch(url, options);
    if (res.status === 401) {
      window.location.href = '/auth';
      return { redirected: true, status: 401, json: null };
    }
    let json = null;
    try { json = await res.json(); } catch (e) { json = null; }
    return { redirected: false, status: res.status, json };
  }

  async function load() {
    setState('loading');
    refreshIcons();
    try {
      const r = await apiRequest('/admin/api/faqs');
      if (r.redirected) return;
      if (r.status === 200 && r.json && r.json.success === true && Array.isArray(r.json.faqs)) {
        allFaqs = r.json.faqs;
        rebuildCategoryFilter();
        render();
      } else {
        setState('error');
        refreshIcons();
      }
    } catch (e) {
      setState('error');
      refreshIcons();
    }
  }

  // ---- Modal helpers ----
  function openModal(m, focusEl) {
    if (!m) return;
    lastFocused = document.activeElement;
    m.classList.add('modal--open');
    document.body.style.overflow = 'hidden';
    const target = focusEl || m.querySelector('input, textarea, select, button');
    if (target && typeof target.focus === 'function') target.focus();
  }

  function closeModal(m) {
    if (!m) return;
    m.classList.remove('modal--open');
    document.body.style.overflow = '';
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    lastFocused = null;
  }

  function showFormError(m, msg) {
    const el = m ? m.querySelector('.form-error') : null;
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }
  function clearFormError(m) {
    const el = m ? m.querySelector('.form-error') : null;
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  }

  // Close on backdrop click / × / Cancel (blocked while a request runs).
  [modal, deleteModal].forEach((m) => {
    if (!m) return;
    m.addEventListener('click', (e) => {
      if (e.target === m && !requestBusy) {
        if (m === deleteModal) pendingDeleteId = null;
        closeModal(m);
      }
    });
    m.querySelectorAll('.modal-close-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (requestBusy) return;
        if (m === deleteModal) pendingDeleteId = null;
        closeModal(m);
      });
    });
  });

  // Escape closes whichever modal is open.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || requestBusy) return;
    if (modal && modal.classList.contains('modal--open')) {
      closeModal(modal);
    } else if (deleteModal && deleteModal.classList.contains('modal--open')) {
      pendingDeleteId = null;
      closeModal(deleteModal);
    }
  });

  // ---- Create / Edit ----
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      mode = 'create';
      editingId = null;
      if (form) form.reset();
      clearFormError(modal);
      if (modalTitle) modalTitle.textContent = 'Add FAQ';
      if (submitLabel) submitLabel.textContent = 'Create FAQ';
      openModal(modal, form ? form.question : null);
    });
  }

  function openEditModal(id) {
    const faq = allFaqs.find((f) => toId(f.id) === id);
    if (!faq || !form) return;
    mode = 'edit';
    editingId = id;
    form.reset();
    clearFormError(modal);
    form.question.value = faq.question == null ? '' : String(faq.question);
    form.answer.value = faq.answer == null ? '' : String(faq.answer);
    form.category.value = faq.category == null ? '' : String(faq.category);
    form.display_order.value = String(orderOf(faq));
    if (modalTitle) modalTitle.textContent = 'Edit FAQ';
    if (submitLabel) submitLabel.textContent = 'Save Changes';
    openModal(modal, form.question);
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (requestBusy) return;
      clearFormError(modal);

      const payload = {
        question: form.question.value.trim(),
        answer: form.answer.value.trim(),
        category: form.category.value.trim(),
        display_order: form.display_order.value.trim()
      };

      if (!payload.question) { showFormError(modal, 'Question is required.'); return; }
      if (!payload.answer) { showFormError(modal, 'Answer is required.'); return; }
      if (payload.display_order === '') { showFormError(modal, 'Display order is required.'); return; }

      requestBusy = true;
      if (submitBtn) submitBtn.disabled = true;

      const url = mode === 'edit' ? '/admin/api/faqs/' + editingId : '/admin/api/faqs';
      const method = mode === 'edit' ? 'PUT' : 'POST';

      try {
        const r = await apiRequest(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (r.redirected) return;
        if (r.json && r.json.success === true && r.json.faq) {
          if (mode === 'edit') {
            const idx = allFaqs.findIndex((f) => toId(f.id) === editingId);
            if (idx !== -1) allFaqs[idx] = r.json.faq; else allFaqs.push(r.json.faq);
          } else {
            allFaqs.push(r.json.faq);
          }
          rebuildCategoryFilter();
          render();
          closeModal(modal);
          showToast(mode === 'edit' ? 'FAQ updated successfully.' : 'FAQ created successfully.', 'success');
        } else if (r.status === 403) {
          showFormError(modal, 'You do not have permission to perform this action.');
        } else if (r.json && typeof r.json.message === 'string') {
          // Server validation (400) / duplicate (409): keep the modal open.
          showFormError(modal, r.json.message);
        } else {
          showFormError(modal, 'Something went wrong. Please try again.');
        }
      } catch (err) {
        showFormError(modal, 'Network error. Please try again.');
      } finally {
        requestBusy = false;
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // ---- Delete ----
  function openDeleteModal(id) {
    const faq = allFaqs.find((f) => toId(f.id) === id);
    if (!faq) return;
    pendingDeleteId = id;
    if (deleteQuestionEl) {
      deleteQuestionEl.textContent = faq.question == null ? '' : String(faq.question);
    }
    openModal(deleteModal, confirmDeleteBtn);
  }

  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', () => {
      if (requestBusy) return;
      pendingDeleteId = null;
      closeModal(deleteModal);
    });
  }

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
      if (requestBusy || pendingDeleteId === null) return;
      requestBusy = true;
      confirmDeleteBtn.disabled = true;

      try {
        const r = await apiRequest('/admin/api/faqs/' + pendingDeleteId, { method: 'DELETE' });
        if (r.redirected) return;
        if (r.json && r.json.success === true) {
          allFaqs = allFaqs.filter((f) => toId(f.id) !== pendingDeleteId);
          rebuildCategoryFilter();
          render();
          closeModal(deleteModal);
          showToast('FAQ deleted successfully.', 'success');
        } else if (r.status === 403) {
          showToast('You do not have permission to perform this action.', 'error');
        } else if (r.json && typeof r.json.message === 'string') {
          showToast(r.json.message, 'error');
        } else {
          showToast('Something went wrong. Please try again.', 'error');
        }
      } catch (err) {
        showToast('Network error. Please try again.', 'error');
      } finally {
        pendingDeleteId = null;
        requestBusy = false;
        confirmDeleteBtn.disabled = false;
      }
    });
  }

  // ---- Search / filter / retry ----
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      filter.search = searchInput.value;
      render();
    });
  }
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
      filter.category = categoryFilter.value;
      render();
    });
  }
  if (retryBtn) {
    retryBtn.addEventListener('click', () => load());
  }

  // ---- Initial load ----
  load();
});
