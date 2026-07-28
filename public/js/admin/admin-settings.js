/* ========================================
   CampuSphere — Admin Settings Client Script
   Milestone 7, Section 7.6.

   API-driven institutional settings form for /admin/settings. Values are
   written into inputs via `.value` only (never innerHTML), so a stored value
   can never execute as markup. Client validation mirrors the authoritative
   server rules; the server is the source of truth.
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {

  // Field spec mirrors the server SETTINGS_SPEC (key order + limits).
  const FIELDS = [
    { key: 'school_name', label: 'School name', max: 150 },
    { key: 'school_acronym', label: 'Acronym', max: 20 },
    { key: 'school_address', label: 'School address', max: 255 },
    { key: 'school_founded', label: 'Founded year', year: true },
    { key: 'school_description', label: 'Description', max: 2000 },
    { key: 'contact_address', label: 'Contact address', max: 255 },
    { key: 'contact_phone', label: 'Phone', max: 50 },
    { key: 'contact_email', label: 'Email', max: 254, email: true },
    { key: 'contact_website', label: 'Website', max: 2048, url: true },
    { key: 'contact_hours', label: 'Office hours', max: 255 },
  ];
  const CURRENT_YEAR = new Date().getFullYear();
  const MIN_YEAR = 1900;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // ---- DOM references ----
  const loadingEl = document.getElementById('settings-loading');
  const errorEl = document.getElementById('settings-error');
  const retryBtn = document.getElementById('settings-retry-btn');
  const formEl = document.getElementById('settings-form');
  const formError = document.getElementById('settings-form-error');
  const saveBtn = document.getElementById('settings-save-btn');
  const resetBtn = document.getElementById('settings-reset-btn');
  const toast = document.getElementById('admin-toast');

  // ---- State ----
  let baseline = null;   // last successfully loaded/saved values
  let busy = false;      // guards against duplicate submissions

  // ---- Helpers ----
  function input(key) { return document.getElementById('set-' + key); }
  function errEl(key) { return document.getElementById('err-' + key); }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
  }

  function setState(state) {
    if (loadingEl) loadingEl.hidden = state !== 'loading';
    if (errorEl) errorEl.hidden = state !== 'error';
    if (formEl) formEl.hidden = state !== 'form';
  }

  function showToast(message, type) {
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'admin-toast admin-toast--' + (type || 'success') + ' admin-toast--show';
    setTimeout(() => { toast.classList.remove('admin-toast--show'); }, 3500);
  }

  function showFormError(msg) {
    if (!formError) return;
    formError.textContent = msg;
    formError.style.display = 'block';
  }
  function clearFormError() {
    if (!formError) return;
    formError.textContent = '';
    formError.style.display = 'none';
  }

  function setFieldError(key, msg) {
    const e = errEl(key);
    if (e) { e.textContent = msg; e.hidden = false; }
    const i = input(key);
    if (i) i.setAttribute('aria-invalid', 'true');
  }
  function clearFieldErrors() {
    FIELDS.forEach((f) => {
      const e = errEl(f.key);
      if (e) { e.textContent = ''; e.hidden = true; }
      const i = input(f.key);
      if (i) i.removeAttribute('aria-invalid');
    });
  }

  // Write server values into inputs (value/textContent only, never innerHTML).
  function populate(settings) {
    FIELDS.forEach((f) => {
      const i = input(f.key);
      if (i) i.value = settings[f.key] == null ? '' : String(settings[f.key]);
    });
    const fy = input('school_founded');
    if (fy) fy.max = String(CURRENT_YEAR);
  }

  // Trimmed payload object (exactly the ten keys).
  function payload() {
    const o = {};
    FIELDS.forEach((f) => {
      const i = input(f.key);
      o[f.key] = i ? String(i.value).trim() : '';
    });
    return o;
  }

  // Client validation mirrors the server. Returns the first invalid key, or null.
  function validate() {
    clearFieldErrors();
    let firstInvalid = null;
    const fail = (key, msg) => { setFieldError(key, msg); if (!firstInvalid) firstInvalid = key; };

    for (const f of FIELDS) {
      const i = input(f.key);
      const raw = i ? i.value : '';

      if (f.year) {
        const s = String(raw).trim();
        let bad = false;
        if (!/^\d+$/.test(s)) bad = true;
        else {
          const n = Number(s);
          if (!Number.isInteger(n) || String(n) !== s || n < MIN_YEAR || n > CURRENT_YEAR) bad = true;
        }
        if (bad) fail(f.key, 'Enter a whole year between ' + MIN_YEAR + ' and ' + CURRENT_YEAR + '.');
        continue;
      }

      const v = String(raw).trim();
      if (v === '') { fail(f.key, f.label + ' is required.'); continue; }
      if (v.length > f.max) { fail(f.key, f.label + ' must be ' + f.max + ' characters or fewer.'); continue; }
      if (f.email && !EMAIL_RE.test(v)) { fail(f.key, 'Enter a valid email address.'); continue; }
      if (f.url) {
        let u = null;
        try { u = new URL(v); } catch (e) { u = null; }
        if (!u || (u.protocol !== 'http:' && u.protocol !== 'https:')) {
          fail(f.key, 'Enter an absolute http:// or https:// URL.');
        }
      }
    }
    return firstInvalid;
  }

  // 401 -> /auth; non-JSON body -> json:null so callers show a generic error.
  async function apiRequest(url, options) {
    const res = await fetch(url, options);
    if (res.status === 401) { window.location.href = '/auth'; return { redirected: true, status: 401, json: null }; }
    let json = null;
    try { json = await res.json(); } catch (e) { json = null; }
    return { redirected: false, status: res.status, json };
  }

  async function load() {
    setState('loading');
    refreshIcons();
    clearFormError();
    try {
      const r = await apiRequest('/admin/api/settings');
      if (r.redirected) return;
      if (r.status === 200 && r.json && r.json.success === true && r.json.settings && typeof r.json.settings === 'object') {
        baseline = r.json.settings;
        populate(baseline);
        clearFieldErrors();
        setState('form');
      } else {
        setState('error');
      }
    } catch (e) {
      setState('error');
    }
    refreshIcons();
  }

  if (retryBtn) retryBtn.addEventListener('click', () => load());

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (busy) return;
      if (baseline) populate(baseline);
      clearFieldErrors();
      clearFormError();
    });
  }

  if (formEl) {
    formEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      clearFormError();

      const firstInvalid = validate();
      if (firstInvalid) {
        const i = input(firstInvalid);
        if (i && typeof i.focus === 'function') i.focus();
        return;
      }

      busy = true;
      if (saveBtn) saveBtn.disabled = true;
      if (resetBtn) resetBtn.disabled = true;

      try {
        const r = await apiRequest('/admin/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload())
        });
        if (r.redirected) return;

        if (r.json && r.json.success === true && r.json.settings) {
          baseline = r.json.settings;
          populate(baseline);          // reflect the persisted values
          clearFieldErrors();
          showToast('Settings updated successfully.', 'success');
        } else if (r.status === 403) {
          showFormError('You do not have permission to perform this action.');
        } else if (r.json && typeof r.json.message === 'string') {
          // Server validation (400) etc.: keep the user's input, show the message.
          showFormError(r.json.message);
        } else {
          showFormError('Something went wrong. Please try again.');
        }
      } catch (err) {
        showFormError('Network error. Please try again.');
      } finally {
        busy = false;
        if (saveBtn) saveBtn.disabled = false;
        if (resetBtn) resetBtn.disabled = false;
      }
    });
  }

  // ---- Initial load ----
  load();
});
