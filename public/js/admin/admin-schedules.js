/* CampuSphere — semester room schedule image administration. */
document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const card = byId('schedule-card');
  if (!card) return;

  let buildings = [];
  try {
    const parsed = JSON.parse(byId('buildings-data-json').textContent);
    buildings = Array.isArray(parsed) ? parsed : [];
  } catch (error) { buildings = []; }

  const state = {
    documents: [], editId: null, deleteId: null, busy: false,
    requestId: 0, requestController: null, lastFocused: null
  };

  const list = byId('schedule-list');
  const loading = byId('schedule-loading');
  const errorState = byId('schedule-error');
  const errorText = byId('schedule-error-text');
  const empty = byId('schedule-empty');
  const filteredEmpty = byId('schedule-filtered-empty');
  const resultStatus = byId('schedule-result-status');
  const modal = byId('schedule-modal');
  const deleteModal = byId('schedule-delete-modal');
  const form = byId('schedule-form');
  const submitButton = byId('schedule-submit');
  const submitLabel = byId('schedule-submit-label');
  const preview = byId('schedule-image-preview');
  const previewImage = byId('schedule-image-preview-img');
  const previewError = byId('schedule-image-preview-error');
  const toast = byId('admin-toast');
  const PAGE_SIZE = 200;
  const MAX_LOADED_DOCUMENTS = 2000;

  function stringValue(value) { return value == null ? '' : String(value); }
  function safeCloudinaryUrl(value) {
    const candidate = stringValue(value).trim();
    try {
      const parsed = new URL(candidate);
      return parsed.protocol === 'https:' && parsed.hostname === 'res.cloudinary.com' &&
        !parsed.username && !parsed.password && !parsed.port ? candidate : null;
    } catch (error) { return null; }
  }
  function positiveId(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : null;
  }
  function semesterLabel(value) {
    if (value === 'first-semester') return 'First Semester';
    if (value === 'second-semester') return 'Second Semester';
    if (value === 'midyear') return 'Midyear';
    return 'Semester';
  }
  function documentLabel(documentRow) {
    return `${stringValue(documentRow.building_name) || 'Building'} — ${stringValue(documentRow.location_label) || 'Room'}`;
  }
  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
  }
  function showToast(message, type) {
    if (!toast) return;
    toast.textContent = message;
    toast.className = `admin-toast admin-toast--${type || 'success'} admin-toast--show`;
    window.setTimeout(() => toast.classList.remove('admin-toast--show'), 4000);
  }

  async function apiRequest(url, options) {
    const response = await fetch(url, Object.assign({ headers: { Accept: 'application/json' } }, options));
    if (response.status === 401) {
      window.location.href = '/auth';
      return { redirected: true, status: 401, json: null };
    }
    let json = null;
    try { json = await response.json(); } catch (error) { json = null; }
    return { redirected: false, status: response.status, json };
  }

  function setListState(name) {
    if (loading) loading.hidden = name !== 'loading';
    if (errorState) errorState.hidden = name !== 'error';
    if (empty) empty.hidden = name !== 'empty';
    if (filteredEmpty) filteredEmpty.hidden = name !== 'filtered-empty';
    if (list) list.hidden = name !== 'ready';
  }

  function hasFilters() {
    return [
      byId('schedule-search'), byId('schedule-filter-building'),
      byId('schedule-filter-semester'), byId('schedule-filter-school-year')
    ].some((element) => element && element.value.trim());
  }

  function listUrl(offset) {
    const params = new URLSearchParams();
    const pairs = [
      ['q', byId('schedule-search')],
      ['buildingId', byId('schedule-filter-building')],
      ['semester', byId('schedule-filter-semester')],
      ['schoolYear', byId('schedule-filter-school-year')]
    ];
    pairs.forEach(([name, element]) => {
      const value = element ? element.value.trim() : '';
      if (value) params.set(name, value);
    });
    params.set('limit', String(PAGE_SIZE));
    if (offset) params.set('offset', String(offset));
    return '/admin/api/room-schedule-documents?' + params.toString();
  }

  function actionButton(label, icon, className, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    const iconElement = document.createElement('i');
    iconElement.setAttribute('data-lucide', icon);
    iconElement.className = 'h-4 w-4 mr-2';
    button.append(iconElement, document.createTextNode(label));
    button.addEventListener('click', handler);
    return button;
  }

  function renderDocuments() {
    list.replaceChildren();
    state.documents.forEach((documentRow) => {
      const article = document.createElement('article');
      article.className = 'schedule-document-card';
      const thumbnailWrap = document.createElement('div');
      thumbnailWrap.className = 'schedule-document-card__thumbnail';
      const image = document.createElement('img');
      image.alt = `${stringValue(documentRow.location_label) || 'Room'} schedule thumbnail`;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.referrerPolicy = 'no-referrer';
      const thumbnailError = document.createElement('span');
      thumbnailError.className = 'schedule-document-card__thumbnail-error';
      thumbnailError.textContent = 'Preview unavailable';
      thumbnailError.hidden = true;
      image.addEventListener('error', () => {
        image.hidden = true;
        thumbnailError.hidden = false;
      });
      const thumbnailUrl = safeCloudinaryUrl(documentRow.image_url);
      if (thumbnailUrl) image.src = thumbnailUrl;
      else {
        image.hidden = true;
        thumbnailError.hidden = false;
      }
      thumbnailWrap.append(image, thumbnailError);

      const content = document.createElement('div');
      content.className = 'schedule-document-card__content';
      const title = document.createElement('h4');
      title.textContent = documentLabel(documentRow);
      const location = document.createElement('p');
      location.className = 'schedule-document-card__meta';
      location.textContent = [documentRow.location_type, documentRow.floor_label].filter(Boolean).join(' · ');
      const term = document.createElement('p');
      term.className = 'schedule-document-card__term';
      term.textContent = `${semesterLabel(documentRow.semester)} · ${stringValue(documentRow.school_year)}`;
      const links = document.createElement('p');
      links.className = 'schedule-document-card__meta';
      const count = Number(documentRow.linked_hotspot_count) || 0;
      links.textContent = `${count} linked VR hotspot${count === 1 ? '' : 's'}`;
      content.append(title, term, location, links);

      const actions = document.createElement('div');
      actions.className = 'schedule-document-card__actions';
      actions.append(
        actionButton('Edit', 'pencil', 'ui-button ui-button-outline ui-button-size-sm', () => openEdit(documentRow)),
        actionButton('Delete', 'trash-2', 'ui-button ui-button-outline ui-button-size-sm text-destructive', () => openDelete(documentRow))
      );
      article.append(thumbnailWrap, content, actions);
      list.appendChild(article);
    });
    refreshIcons();
  }

  async function loadDocuments() {
    const requestId = ++state.requestId;
    if (state.requestController) state.requestController.abort();
    state.requestController = new AbortController();
    setListState('loading');
    if (resultStatus) resultStatus.textContent = 'Loading room schedules…';
    try {
      const documents = [];
      let total = 0;
      while (documents.length < MAX_LOADED_DOCUMENTS) {
        const result = await apiRequest(listUrl(documents.length), { signal: state.requestController.signal });
        if (requestId !== state.requestId || result.redirected) return;
        if (result.status !== 200 || !result.json || result.json.success !== true || !Array.isArray(result.json.documents)) {
          if (errorText) errorText.textContent = result.json && result.json.message ? result.json.message : 'Could not load room schedules.';
          setListState('error');
          if (resultStatus) resultStatus.textContent = 'Room schedules unavailable.';
          return;
        }
        total = Number(result.json.total) || 0;
        if (total > MAX_LOADED_DOCUMENTS) {
          if (errorText) errorText.textContent = 'More than 2,000 schedules match. Narrow the filters before managing this list.';
          setListState('error');
          if (resultStatus) resultStatus.textContent = 'Too many room schedules to display safely.';
          return;
        }
        documents.push(...result.json.documents);
        if (result.json.documents.length < PAGE_SIZE || documents.length >= total) break;
      }
      if (documents.length !== total) throw new Error('Incomplete room schedule pagination result.');
      state.documents = documents;
      if (!state.documents.length) setListState(hasFilters() ? 'filtered-empty' : 'empty');
      else { renderDocuments(); setListState('ready'); }
      if (resultStatus) resultStatus.textContent = `${total} room schedule${total === 1 ? '' : 's'} found.`;
    } catch (error) {
      if (error && error.name === 'AbortError') return;
      if (requestId !== state.requestId) return;
      if (errorText) errorText.textContent = 'Could not load room schedules.';
      setListState('error');
      if (resultStatus) resultStatus.textContent = 'Room schedules unavailable.';
    }
  }

  function populateBuildingSelect() {
    const select = byId('schedule-building');
    const filter = byId('schedule-filter-building');
    if (!select || !filter) return;
    buildings.slice().sort((a, b) => stringValue(a.name).localeCompare(stringValue(b.name))).forEach((building) => {
      const id = positiveId(building.id);
      if (id === null) return;
      [select, filter].forEach((target) => {
        const option = document.createElement('option');
        option.value = String(id);
        option.textContent = stringValue(building.name) || `Building #${id}`;
        target.appendChild(option);
      });
    });
  }

  function filterBuildingOptions() {
    const search = byId('schedule-building-search');
    const select = byId('schedule-building');
    const status = byId('schedule-building-count');
    if (!search || !select) return;
    const query = search.value.trim().toLocaleLowerCase('en');
    let visible = 0;
    Array.from(select.options).forEach((option, index) => {
      if (index === 0 || option.selected) { option.hidden = false; return; }
      option.hidden = !!query && !option.textContent.toLocaleLowerCase('en').includes(query);
      if (!option.hidden) visible += 1;
    });
    if (status) status.textContent = query ? `${visible} matching buildings.` : `${Math.max(select.options.length - 1, 0)} buildings available.`;
  }

  function showPreview(url) {
    const value = stringValue(url).trim();
    const safeUrl = safeCloudinaryUrl(value);
    if (!preview || !previewImage || !previewError) return;
    preview.hidden = !value;
    previewError.style.display = 'none';
    previewError.textContent = '';
    if (!value) { previewImage.removeAttribute('src'); return; }
    if (!safeUrl) {
      previewImage.removeAttribute('src');
      previewError.textContent = 'Paste an HTTPS Cloudinary delivery URL to preview the image.';
      previewError.style.display = 'block';
      return;
    }
    previewImage.src = safeUrl;
  }

  function openModal(target, focusTarget) {
    if (!target) return;
    state.lastFocused = document.activeElement;
    target.classList.add('modal--open');
    document.body.style.overflow = 'hidden';
    const focus = focusTarget || target.querySelector('input, select, button');
    if (focus) focus.focus();
  }
  function closeModal(target) {
    if (!target) return;
    target.classList.remove('modal--open');
    document.body.style.overflow = '';
    if (state.lastFocused && document.contains(state.lastFocused)) state.lastFocused.focus();
    state.lastFocused = null;
  }
  function formError(message) {
    const element = modal && modal.querySelector('.form-error');
    if (!element) return;
    element.textContent = message || '';
    element.style.display = message ? 'block' : 'none';
    if (message) element.setAttribute('role', 'alert');
  }

  function setModalTitle(text) {
    const title = byId('schedule-modal-title');
    if (!title) return;
    const icon = title.querySelector('[data-lucide]');
    title.replaceChildren();
    if (icon) title.appendChild(icon);
    title.appendChild(document.createTextNode(text));
    refreshIcons();
  }

  function setIdentityLocked(locked) {
    [
      byId('schedule-building-search'), byId('schedule-building'),
      byId('schedule-location-type'), byId('schedule-location-label'),
      byId('schedule-floor-label')
    ].forEach((element) => { if (element) element.disabled = Boolean(locked); });
    const hint = byId('schedule-identity-hint');
    if (hint) hint.hidden = !locked;
  }

  function openCreate() {
    state.editId = null;
    form.reset();
    formError('');
    setIdentityLocked(false);
    setModalTitle(' Add Schedule');
    submitLabel.textContent = 'Create Schedule';
    byId('schedule-semester').value = 'first-semester';
    byId('schedule-building-search').value = '';
    filterBuildingOptions();
    showPreview('');
    openModal(modal, byId('schedule-building-search'));
  }

  function openEdit(documentRow) {
    state.editId = positiveId(documentRow.id);
    form.reset();
    formError('');
    setIdentityLocked((Number(documentRow.linked_hotspot_count) || 0) > 0);
    form.elements.building_id.value = String(documentRow.building_id);
    form.elements.location_type.value = stringValue(documentRow.location_type);
    form.elements.location_label.value = stringValue(documentRow.location_label);
    form.elements.floor_label.value = stringValue(documentRow.floor_label);
    form.elements.semester.value = stringValue(documentRow.semester);
    form.elements.school_year.value = stringValue(documentRow.school_year);
    form.elements.image_url.value = stringValue(documentRow.image_url);
    form.elements.cloudinary_public_id.value = stringValue(documentRow.cloudinary_public_id);
    byId('schedule-building-search').value = '';
    filterBuildingOptions();
    showPreview(documentRow.image_url);
    setModalTitle(' Edit Schedule');
    submitLabel.textContent = 'Save Changes';
    openModal(modal, byId('schedule-building-search'));
  }

  function validateSchoolYear(value) {
    const match = /^(\d{4})-(\d{4})$/.exec(value);
    return !!match && Number(match[2]) === Number(match[1]) + 1;
  }

  async function submitDocument(event) {
    event.preventDefault();
    if (state.busy) return;
    formError('');
    const payload = {
      building_id: form.elements.building_id.value.trim(),
      location_type: form.elements.location_type.value.trim(),
      location_label: form.elements.location_label.value.trim(),
      floor_label: form.elements.floor_label.value.trim(),
      semester: form.elements.semester.value.trim(),
      school_year: form.elements.school_year.value.trim(),
      image_url: form.elements.image_url.value.trim(),
      cloudinary_public_id: form.elements.cloudinary_public_id.value.trim()
    };
    if (!payload.building_id || !payload.location_label) return formError('Building and room/facility name are required.');
    if (!validateSchoolYear(payload.school_year)) return formError('School year must contain consecutive years in YYYY-YYYY format.');
    if (!safeCloudinaryUrl(payload.image_url)) return formError('Paste an HTTPS Cloudinary delivery URL.');
    state.busy = true;
    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');
    const editing = state.editId !== null;
    try {
      const result = await apiRequest(
        editing ? `/admin/api/room-schedule-documents/${state.editId}` : '/admin/api/room-schedule-documents',
        { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
      );
      if (result.redirected) return;
      if (result.json && result.json.success === true) {
        closeModal(modal);
        showToast(editing ? 'Room schedule updated.' : 'Room schedule created.');
        await loadDocuments();
      } else formError(result.json && result.json.message ? result.json.message : 'Could not save the room schedule.');
    } catch (error) {
      formError('Network error. Check your connection and try again.');
    } finally {
      state.busy = false;
      submitButton.disabled = false;
      submitButton.removeAttribute('aria-busy');
    }
  }

  function openDelete(documentRow) {
    state.deleteId = positiveId(documentRow.id);
    const text = byId('schedule-delete-text');
    if (text) text.textContent = `Delete ${documentLabel(documentRow)}? The Cloudinary image will not be deleted.`;
    openModal(deleteModal, byId('schedule-cancel-delete'));
  }

  async function confirmDelete() {
    if (state.busy || state.deleteId === null) return;
    state.busy = true;
    const button = byId('schedule-confirm-delete');
    button.disabled = true;
    try {
      const result = await apiRequest(`/admin/api/room-schedule-documents/${state.deleteId}`, { method: 'DELETE' });
      if (result.redirected) return;
      closeModal(deleteModal);
      if (result.json && result.json.success === true) {
        showToast('Room schedule deleted.');
        await loadDocuments();
      } else showToast(result.json && result.json.message ? result.json.message : 'Could not delete the room schedule.', 'error');
    } catch (error) {
      closeModal(deleteModal);
      showToast('Network error. Try again.', 'error');
    } finally {
      state.busy = false;
      state.deleteId = null;
      button.disabled = false;
    }
  }

  populateBuildingSelect();
  filterBuildingOptions();
  byId('schedule-building-search').addEventListener('input', filterBuildingOptions);
  byId('schedule-image-url').addEventListener('input', (event) => showPreview(event.target.value));
  previewImage.addEventListener('error', () => {
    previewError.textContent = 'The image preview could not be loaded. Verify the Cloudinary delivery URL.';
    previewError.style.display = 'block';
  });
  form.addEventListener('submit', submitDocument);
  byId('add-schedule-btn').addEventListener('click', openCreate);
  byId('schedule-apply-filters').addEventListener('click', loadDocuments);
  byId('schedule-clear-filters').addEventListener('click', () => {
    byId('schedule-search').value = '';
    byId('schedule-filter-building').value = '';
    byId('schedule-filter-semester').value = '';
    byId('schedule-filter-school-year').value = '';
    loadDocuments();
  });
  byId('schedule-search').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); loadDocuments(); }
  });
  byId('schedule-retry').addEventListener('click', loadDocuments);
  byId('schedule-cancel-delete').addEventListener('click', () => { state.deleteId = null; closeModal(deleteModal); });
  byId('schedule-confirm-delete').addEventListener('click', confirmDelete);
  [modal, deleteModal].forEach((target) => {
    target.querySelectorAll('.modal-close-btn').forEach((button) => button.addEventListener('click', () => closeModal(target)));
    target.addEventListener('mousedown', (event) => { if (event.target === target) closeModal(target); });
  });
  document.addEventListener('keydown', (event) => {
    const activeModal = deleteModal.classList.contains('modal--open')
      ? deleteModal
      : (modal.classList.contains('modal--open') ? modal : null);
    if (!activeModal) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal(activeModal);
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(activeModal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]'))
      .filter((element) => !element.hidden && element.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  loadDocuments();
});
