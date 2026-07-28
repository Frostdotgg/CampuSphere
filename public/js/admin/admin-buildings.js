/* ========================================
   CampuSphere — Admin Buildings Script
   Handles CRUD for buildings via AJAX
   ======================================== */
document.addEventListener('DOMContentLoaded', () => {

  // ---- State ----
  let allBuildings = [];
  try { allBuildings = JSON.parse(document.getElementById('buildings-data-json').textContent); } catch(e){}

  let filter = { search: '', category: 'all' };
  let lastFocused = null;
  let pendingDeleteId = null;

  // ---- DOM ----
  const searchInput = document.getElementById('building-search-input');
  const catFilterMenu = document.getElementById('bld-cat-filter-menu');
  const catFilterBtn = document.getElementById('bld-cat-filter-btn');
  const addBtn = document.getElementById('add-building-btn');
  const buildingsGrid = document.getElementById('buildings-grid');
  const toast = document.getElementById('admin-toast');

  // Modals
  const buildingModal = document.getElementById('building-modal');
  const deleteModal = document.getElementById('delete-building-modal');

  /* ---- Structured details editor (M12.P1-D5) ----
     One editor instance mounted in the Building modal. It owns the entire
     `details` contract: load(raw) accepts the stored JSON string, a parsed
     jsonb object (Supabase list rows), or null; serialize() returns the
     canonical JSON string or null the API already expects. A parse failure
     keeps Save disabled with the editor's fixed actionable message so the
     stored value is never overwritten.

     M12.P1-D5 corrective pass — FAIL CLOSED. The details editor is MANDATORY
     for Building add/edit. If the helper global is missing, createEditor()
     throws, it returns an incomplete interface, or any editor method later
     throws, the editor becomes permanently unavailable for THIS page load:
     `detailsEditor` is null, a fixed sanitized message appears in the live
     status region, and Save stays disabled. Submission must abort BEFORE any
     request data is built or fetch() runs — it never falls back to
     `details: null`, which on an edit could erase stored building details. */
  const DETAILS_EDITOR_UNAVAILABLE_MSG =
    'Additional details editor is unavailable. Reload the page and try again.';
  let detailsEditor = null;
  let detailsEditorUnavailable = false;

  function detailsStatusRegion(){ return document.getElementById('building-details-status'); }
  function isCallable(fn){ return typeof fn === 'function'; }
  // A returned editor is valid only when it exposes every method the
  // integration calls; a partial interface is treated as unavailable.
  function editorInterfaceValid(ed){
    return !!ed && isCallable(ed.clear) && isCallable(ed.load) &&
      isCallable(ed.serialize) && isCallable(ed.isBlocked) && isCallable(ed.focusFirstError);
  }
  // Transition (permanently, for this page load) to the unavailable state:
  // drop the editor, show the ONE fixed message, and disable Save. Never logs
  // or displays a raw exception or value.
  function markDetailsEditorUnavailable(){
    detailsEditor = null;
    detailsEditorUnavailable = true;
    const region = detailsStatusRegion();
    if (region) region.textContent = DETAILS_EDITOR_UNAVAILABLE_MSG;
    const btn = document.getElementById('building-submit-btn');
    if (btn) btn.disabled = true;
  }
  (function initDetailsEditor(){
    const root = document.getElementById('building-details-editor');
    const statusRegion = document.getElementById('building-details-status');
    const submitBtn = document.getElementById('building-submit-btn');
    const helper = window.CampuSphereBuildingDetailsEditor;
    if (!root || !statusRegion || !submitBtn || !helper || !isCallable(helper.createEditor)) {
      markDetailsEditorUnavailable();
      return;
    }
    let ed = null;
    try {
      ed = helper.createEditor({ root, statusRegion });
    } catch (e) { markDetailsEditorUnavailable(); return; }
    if (!editorInterfaceValid(ed)) { markDetailsEditorUnavailable(); return; }
    detailsEditor = ed;
  })();
  // Centralized Save-enabled synchronizer. Save is disabled whenever the
  // editor is unavailable OR a ready editor reports blocked (unparseable
  // stored data). An isBlocked() failure fails closed to unavailable.
  function syncDetailsBlockedState(){
    const btn = document.getElementById('building-submit-btn');
    if (detailsEditorUnavailable || !detailsEditor) {
      if (btn) btn.disabled = true;
      const region = detailsStatusRegion();
      if (region) region.textContent = DETAILS_EDITOR_UNAVAILABLE_MSG;
      return;
    }
    let blocked = false;
    try { blocked = !!detailsEditor.isBlocked(); }
    catch (e) { markDetailsEditorUnavailable(); return; }
    if (btn) btn.disabled = blocked;
  }

  // ---- Lucide (guarded) ----
  // The Lucide CDN script can be unavailable/offline; icons then stay as
  // <i data-lucide> placeholders but the page must never throw. Mirrors
  // refreshIcons() in admin-map-graph.js.
  function refreshLucideIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  // ---- Toast ----
  function showToast(msg, type='success') {
    if(!toast) return;
    toast.textContent = msg;
    toast.className = 'admin-toast admin-toast--'+type+' admin-toast--show';
    setTimeout(()=>toast.classList.remove('admin-toast--show'), 3500);
  }

  // ---- Escape HTML ----
  function esc(t){ const d=document.createElement('div'); d.textContent=t||''; return d.innerHTML; }

  // ---- Category badge ----
  function catBadge(cat){
    const map={
      'Academic':{cls:'bg-chart-1/10 text-chart-1 border-chart-1/20'},
      'Administrative':{cls:'bg-chart-4/10 text-chart-4 border-chart-4/20'},
      'Student Services':{cls:'bg-chart-2/10 text-chart-2 border-chart-2/20'},
      'Sports':{cls:'bg-chart-3/10 text-chart-3 border-chart-3/20'},
      'Facilities':{cls:'bg-primary/10 text-primary border-primary/20'}
    };
    const info=map[cat]||{cls:'bg-muted text-muted-foreground border-border'};
    return `<span class="ui-badge ui-badge-outline ${info.cls}">${esc(cat)}</span>`;
  }

  // ---- Update Stats ----
  function updateStats(){
    const el=id=>document.getElementById(id);
    if(el('stat-buildings')) el('stat-buildings').textContent=allBuildings.length;
    const cats=[...new Set(allBuildings.map(b=>b.category))];
    if(el('stat-categories')) el('stat-categories').textContent=cats.length;
  }

  /* BE.3 — route-readiness status on each admin building card.
     Building creation/editing stays fully available so admins can STAGE a record
     before its route node exists; the card simply says so. Three fixed states,
     never a raw id, node key, or backend error:
       Route ready            -> route_available === true
       Route setup required   -> not_mapped / unreachable / invalid_geometry
       Route status unavailable -> the route source itself could not be read
     Rendered via esc() (textContent-based escaping), never raw DB text. */
  function routeStatus(b){
    if(b && b.route_available===true) return {label:'Route ready', cls:'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'};
    // A canonical-name collision is an admin data problem, not a missing route:
    // say so plainly so the admin knows to rename, not to add a node.
    if(b && b.route_unavailable_reason==='ambiguous_name') return {label:'Duplicate name — route unavailable', cls:'bg-red-500/10 text-red-600 border-red-500/30'};
    if(b && b.route_unavailable_reason==='route_data_unavailable') return {label:'Route status unavailable', cls:'bg-muted text-muted-foreground border-border'};
    if(b && typeof b.route_available==='boolean') return {label:'Route setup required', cls:'bg-amber-500/10 text-amber-600 border-amber-500/30'};
    return {label:'Route status unavailable', cls:'bg-muted text-muted-foreground border-border'};
  }
  function routeBadge(b){
    const s=routeStatus(b);
    return `<span class="ui-badge ${s.cls}" style="border-width:1px;">${esc(s.label)}</span>`;
  }

  /* BE.3 — re-pull the decorated admin rows so cards never go stale after a
     building/node/edge/geometry mutation changes route readiness. */
  async function refreshBuildings(){
    try{
      const res=await fetch('/admin/api/buildings',{headers:{Accept:'application/json'},credentials:'same-origin'});
      if(!res.ok) return false;
      const data=await res.json();
      if(!data || data.success!==true || !Array.isArray(data.buildings)) return false;
      allBuildings=data.buildings;
      renderAll();
      return true;
    }catch(e){ return false; } // fixed label only; never surface a raw error
  }
  // admin-map-graph.js broadcasts this after node/edge/geometry mutations, which
  // can flip a building between routable and not.
  document.addEventListener('campusphere:route-graph-changed', function(){ refreshBuildings(); });

  // Tell admin-map-graph.js to re-pull its building list (route-destination select).
  function emitBuildingsChanged(){
    document.dispatchEvent(new CustomEvent('campusphere:buildings-changed'));
  }

  // ---- Render Buildings Grid ----
  function renderBuildings(){
    if(!buildingsGrid) return;
    let items=allBuildings.filter(b=>{
      if(filter.category!=='all' && b.category!==filter.category) return false;
      if(filter.search){
        const q=filter.search.toLowerCase();
        if(!(b.name||'').toLowerCase().includes(q) && !(b.description||'').toLowerCase().includes(q)) return false;
      }
      return true;
    });

    if(items.length===0){
      buildingsGrid.innerHTML=`<div class="ui-card border-border" style="grid-column:1/-1;text-align:center;padding:3rem;">
        <i data-lucide="building-2" style="width:2.5rem;height:2.5rem;color:var(--muted-foreground);margin:0 auto .75rem;display:block;"></i>
        <p class="text-muted-foreground text-sm">No buildings found.</p></div>`;
      refreshLucideIcons(); return;
    }

    buildingsGrid.innerHTML=items.map(b=>{
      const descShort=(b.description||'No description').substring(0,80);
      return `<div class="ui-card border-border" data-id="${b.id}">
        <div class="p-6" style="display:flex;flex-direction:column;gap:0.75rem;">
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3">
              <div class="rounded-lg bg-primary/10 p-2.5"><i data-lucide="building-2" class="h-5 w-5 text-primary"></i></div>
              <div>
                <h4 class="text-base font-semibold text-foreground">${esc(b.name)}</h4>
                <p class="text-sm text-muted-foreground">${esc(descShort)}</p>
              </div>
            </div>
            <button class="ui-button ui-button-ghost ui-button-size-icon h-8 w-8 dropdown-trigger" data-dropdown-target="bm-${b.id}">
              <i data-lucide="more-horizontal" class="h-4 w-4"></i></button>
            <div id="bm-${b.id}" class="dropdown-menu-content p-1" style="width:130px;">
              <div class="dropdown-menu-item btn-edit-building" data-id="${b.id}"><i data-lucide="edit" class="h-4 w-4 mr-2"></i>Edit</div>
              <div class="h-px bg-border my-1"></div>
              <div class="dropdown-menu-item text-destructive btn-delete-building" data-id="${b.id}"><i data-lucide="trash-2" class="h-4 w-4 mr-2"></i>Delete</div>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-wrap">${catBadge(b.category)}${routeBadge(b)}</div>
          <div class="flex items-center gap-4 text-sm text-muted-foreground">
            <span class="flex items-center gap-1"><i data-lucide="map-pin" class="h-4 w-4"></i>${parseFloat(b.lat).toFixed(6)}, ${parseFloat(b.lng).toFixed(6)}</span>
          </div>
        </div></div>`;
    }).join('');

    refreshLucideIcons();
    bindActions();
    rebindDropdowns(buildingsGrid);
  }

  function renderAll(){ renderBuildings(); updateStats(); }

  // ---- Dropdown rebind ----
  function rebindDropdowns(container){
    container.querySelectorAll('.dropdown-trigger').forEach(trigger=>{
      const clone=trigger.cloneNode(true);
      trigger.parentNode.replaceChild(clone,trigger);
      clone.addEventListener('click',e=>{
        e.stopPropagation();
        const tid=clone.getAttribute('data-dropdown-target');
        const menu=document.getElementById(tid);
        document.querySelectorAll('.dropdown-menu-content').forEach(m=>{if(m.id!==tid)m.removeAttribute('data-state');});
        if(menu.getAttribute('data-state')==='open'){menu.removeAttribute('data-state');}
        else{menu.setAttribute('data-state','open');const r=clone.getBoundingClientRect();menu.style.top=(r.bottom+window.scrollY+8)+'px';menu.style.right=(window.innerWidth-r.right)+'px';}
      });
    });
  }

  // ---- Modal helpers ----
  function openModal(m, focusEl){
    if(m){
      lastFocused = document.activeElement;
      m.classList.add('modal--open');
      document.body.style.overflow='hidden';
      const target = focusEl || m.querySelector('input, textarea, select, button');
      if(target && typeof target.focus === 'function') setTimeout(()=>target.focus(), 0);
    }
  }
  function closeModal(m){
    if(m){
      m.classList.remove('modal--open');
      document.body.style.overflow='';
      if(lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
      lastFocused = null;
    }
  }
  document.querySelectorAll('.modal-backdrop').forEach(b=>{b.addEventListener('click',e=>{if(e.target===b)closeModal(b);});});
  document.querySelectorAll('.modal-close-btn').forEach(b=>{b.addEventListener('click',()=>closeModal(b.closest('.modal-backdrop')));});
  document.addEventListener('keydown', e=>{
    if(e.key !== 'Escape') return;
    const open = [buildingModal, deleteModal].find(m=>m && m.classList.contains('modal--open'));
    if(open){
      if(open === deleteModal) pendingDeleteId = null;
      closeModal(open);
    }
  });

  /* ---- M12.P1-D5: Building modal keyboard focus containment ----
     Scoped to #building-modal only (the aria-modal="true" dialog); the Delete
     modal and other admin modals are unchanged. Collects currently visible,
     enabled, tabbable controls in DOM order and keeps Tab / Shift+Tab inside
     the dialog while it is open. preventDefault fires ONLY for a wrap or to
     restore containment, so ordinary intra-dialog tabbing is untouched. A
     disabled Save button is naturally excluded, so the unavailable state
     still traps focus across the remaining fields and buttons. */
  function isFocusableVisible(el){
    if(!el || el.disabled) return false;
    if(el.getAttribute('aria-disabled') === 'true') return false;
    if(el.hidden) return false;
    const ti = el.getAttribute('tabindex');
    if(ti !== null && parseInt(ti, 10) < 0) return false;
    // Non-rendered controls (hidden ancestor / display:none) report no client
    // rects; exclude them so focus never lands on an invisible target.
    if(typeof el.getClientRects === 'function' && el.getClientRects().length === 0) return false;
    return true;
  }
  function buildingModalFocusables(){
    if(!buildingModal) return [];
    const sel = 'a[href], button, input, select, textarea, [tabindex]';
    return Array.prototype.slice.call(buildingModal.querySelectorAll(sel)).filter(isFocusableVisible);
  }
  document.addEventListener('keydown', e=>{
    if(e.key !== 'Tab') return;
    if(!buildingModal || !buildingModal.classList.contains('modal--open')) return;
    const focusable = buildingModalFocusables();
    if(focusable.length === 0){ e.preventDefault(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    // Focus unexpectedly outside the dialog — pull it back to the first control.
    if(!buildingModal.contains(active)){
      e.preventDefault();
      first.focus();
      return;
    }
    if(e.shiftKey){
      if(active === first){ e.preventDefault(); last.focus(); }
    } else if(active === last){
      e.preventDefault();
      first.focus();
    }
  });

  function showFormError(modal,msg){const el=modal?.querySelector('.form-error');if(el){el.textContent=msg;el.style.display='block';}}
  function clearFormErrors(modal){const el=modal?.querySelector('.form-error');if(el){el.textContent='';el.style.display='none';}}

  // ---- Bind row actions ----
  function bindActions(){
    document.querySelectorAll('.btn-edit-building').forEach(b=>b.addEventListener('click',e=>{
      e.stopPropagation();
      document.querySelectorAll('.dropdown-menu-content').forEach(m=>m.removeAttribute('data-state'));
      openEditBuilding(parseInt(b.dataset.id));
    }));
    document.querySelectorAll('.btn-delete-building').forEach(b=>b.addEventListener('click',e=>{
      e.stopPropagation();
      document.querySelectorAll('.dropdown-menu-content').forEach(m=>m.removeAttribute('data-state'));
      openDeleteModal(parseInt(b.dataset.id));
    }));
  }

  // ============================================================
  //  BUILDING CRUD
  // ============================================================
  if(addBtn) addBtn.addEventListener('click',()=>openCreateBuilding());

  function openCreateBuilding(){
    const form=document.getElementById('building-form'); if(form)form.reset();
    form.removeAttribute('data-edit-id');
    // Fresh empty structured editor. A clear() failure fails closed so the
    // modal opens showing the fixed error and cannot be saved.
    if(detailsEditor){ try { detailsEditor.clear(); } catch(e){ markDetailsEditorUnavailable(); } }
    document.getElementById('building-modal-title').textContent='Add New Building';
    document.getElementById('building-submit-btn').innerHTML='<i data-lucide="plus" class="h-4 w-4 mr-2"></i>Add Building';
    clearFormErrors(buildingModal); syncDetailsBlockedState();
    openModal(buildingModal, form ? form.building_name : null); refreshLucideIcons();
  }

  function openEditBuilding(id){
    const b=allBuildings.find(x=>x.id===id); if(!b)return;
    const form=document.getElementById('building-form');
    form.dataset.editId=id;
    form.building_name.value=b.name||'';
    form.category.value=b.category||'';
    form.description.value=b.description||'';
    form.lat.value=b.lat||'';
    form.lng.value=b.lng||'';
    // M12.P1-D5: the structured editor loads the RAW stored details (JSON
    // string, parsed jsonb object, or null) BEFORE the modal opens. A parse
    // failure shows the editor's fixed actionable message and keeps Save
    // disabled so the stored value can never be replaced with {} or blanks.
    // A THROWN load() fails closed to unavailable — the edit modal still
    // opens but cannot be saved, so stored details are never overwritten.
    if(detailsEditor){
      try { detailsEditor.load(b.details!==undefined?b.details:null); }
      catch(e){ markDetailsEditorUnavailable(); }
    }
    // Section 10.6: media metadata (set via .value DOM API — never innerHTML).
    if(form.image_url) form.image_url.value=b.image_url||'';
    if(form.cloudinary_public_id) form.cloudinary_public_id.value=b.cloudinary_public_id||'';
    document.getElementById('building-modal-title').textContent='Edit Building';
    document.getElementById('building-submit-btn').innerHTML='<i data-lucide="check" class="h-4 w-4 mr-2"></i>Save Changes';
    clearFormErrors(buildingModal); syncDetailsBlockedState();
    openModal(buildingModal, form ? form.building_name : null); refreshLucideIcons();
  }

  const buildingForm=document.getElementById('building-form');
  if(buildingForm) buildingForm.addEventListener('submit', async e=>{
    e.preventDefault(); clearFormErrors(buildingModal);
    const editId=buildingForm.dataset.editId;
    // M12.P1-D5 corrective: details come EXCLUSIVELY from the structured
    // editor and the editor is mandatory. If it is unavailable, abort here —
    // before request-data construction and before fetch() — and show the
    // fixed message. There is NO implicit `details: null` fallback, so an
    // edit can never blank stored details when the editor failed to mount.
    if(detailsEditorUnavailable || !detailsEditor){
      showFormError(buildingModal, DETAILS_EDITOR_UNAVAILABLE_MSG);
      syncDetailsBlockedState();
      return;
    }
    // A blocked (unparseable) load or an invalid field aborts BEFORE any
    // network work; the modal and editor contents stay intact. An unexpected
    // isBlocked()/serialize() failure fails closed to unavailable.
    let detailsValue=null;
    let blocked;
    try { blocked = detailsEditor.isBlocked(); }
    catch(err){ markDetailsEditorUnavailable(); showFormError(buildingModal, DETAILS_EDITOR_UNAVAILABLE_MSG); return; }
    if(blocked){
      showFormError(buildingModal,'Additional details could not be read; saving is disabled.');
      return;
    }
    let ser;
    try { ser=detailsEditor.serialize(); }
    catch(err){ markDetailsEditorUnavailable(); showFormError(buildingModal, DETAILS_EDITOR_UNAVAILABLE_MSG); return; }
    if(!ser||!ser.ok){
      // Ordinary invalid editor input: focus the first invalid field and keep
      // its validation message. A THROWN focusFirstError() is a broken-editor
      // signal — fail closed to unavailable (fixed sanitized message, Save
      // stays disabled for this page load) instead of swallowing the exception.
      // Neither branch constructs a request body or issues a fetch; the raw
      // error is never logged or displayed.
      try {
        detailsEditor.focusFirstError();
        showFormError(buildingModal, ser&&ser.message?ser.message:'Additional details are invalid.');
      } catch(err){
        markDetailsEditorUnavailable();
        showFormError(buildingModal, DETAILS_EDITOR_UNAVAILABLE_MSG);
      }
      return;
    }
    detailsValue=ser.value; // canonical JSON string or null
    const data={
      name:buildingForm.building_name.value.trim(),
      category:buildingForm.category.value,
      description:buildingForm.description.value.trim(),
      lat:buildingForm.lat.value.trim(),
      lng:buildingForm.lng.value.trim(),
      details:detailsValue,
      image_url:buildingForm.image_url?buildingForm.image_url.value.trim():'',
      cloudinary_public_id:buildingForm.cloudinary_public_id?buildingForm.cloudinary_public_id.value.trim():''
    };
    if(!data.name||!data.category||!data.lat||!data.lng){showFormError(buildingModal,'Name, category, lat, and lng are required.');return;}

    const btn=document.getElementById('building-submit-btn');
    btn.disabled=true; btn.innerHTML='<i data-lucide="loader-2" class="h-4 w-4 mr-2 animate-spin"></i>Saving...'; refreshLucideIcons();

    try{
      const url=editId?'/admin/api/buildings/'+editId:'/admin/api/buildings';
      const method=editId?'PUT':'POST';
      const res=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      const json=await res.json();
      if(json.success){
        // The server returns the DECORATED row (BE.3), so the replaced/appended
        // local row already carries route_available / route_unavailable_reason and
        // the card renders the correct status immediately — no reload needed.
        if(editId){const idx=allBuildings.findIndex(x=>x.id===parseInt(editId));if(idx!==-1)allBuildings[idx]=json.building;}
        else allBuildings.push(json.building);
        allBuildings.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
        renderAll(); closeModal(buildingModal);
        showToast(editId?'Building updated!':'Building added!','success');
        emitBuildingsChanged(); // refresh the route-destination dropdown
      } else showFormError(buildingModal,json.message);
    }catch(err){showFormError(buildingModal,'Network error.');}
    // Restore the label, then let the centralized synchronizer decide the
    // disabled state — never unconditionally re-enable Save (the editor may
    // have transitioned to unavailable mid-submit).
    finally{btn.innerHTML=editId?'<i data-lucide="check" class="h-4 w-4 mr-2"></i>Save Changes':'<i data-lucide="plus" class="h-4 w-4 mr-2"></i>Add Building';refreshLucideIcons();syncDetailsBlockedState();}
  });

  // ============================================================
  //  DELETE
  // ============================================================
  function openDeleteModal(id){
    const item=allBuildings.find(x=>x.id===id); if(!item)return;
    pendingDeleteId=id;
    const nameEl=document.getElementById('delete-building-name');
    if(nameEl) nameEl.textContent=item.name;
    openModal(deleteModal);
  }

  const cancelDelBtn=document.getElementById('cancel-building-delete-btn');
  const confirmDelBtn=document.getElementById('confirm-building-delete-btn');
  if(cancelDelBtn) cancelDelBtn.addEventListener('click',()=>{pendingDeleteId=null;closeModal(deleteModal);});

  if(confirmDelBtn) confirmDelBtn.addEventListener('click', async()=>{
    if(!pendingDeleteId)return;
    confirmDelBtn.disabled=true;
    confirmDelBtn.innerHTML='<i data-lucide="loader-2" class="h-4 w-4 mr-2 animate-spin"></i>Deleting...'; refreshLucideIcons();

    try{
      const res=await fetch('/admin/api/buildings/'+pendingDeleteId,{method:'DELETE'});
      const json=await res.json();
      if(json.success){
        allBuildings=allBuildings.filter(x=>x.id!==pendingDeleteId);
        renderAll(); closeModal(deleteModal);
        showToast('Building deleted.','success');
        emitBuildingsChanged(); // refresh the route-destination dropdown
      } else showToast(json.message||'Failed to delete.','error');
    }catch(err){showToast('Network error.','error');}
    finally{pendingDeleteId=null;confirmDelBtn.disabled=false;confirmDelBtn.innerHTML='<i data-lucide="trash-2" class="h-4 w-4 mr-2"></i>Delete';refreshLucideIcons();}
  });

  // ---- Search & Filter ----
  if(searchInput) searchInput.addEventListener('input',()=>{filter.search=searchInput.value;renderAll();});
  if(catFilterMenu) catFilterMenu.querySelectorAll('.dropdown-menu-item').forEach(item=>{
    item.addEventListener('click',()=>{
      filter.category=item.dataset.value||'all';
      if(catFilterBtn) catFilterBtn.querySelector('span').textContent=item.textContent;
      catFilterMenu.querySelectorAll('.dropdown-menu-item').forEach(i=>i.classList.remove('bg-accent','text-accent-foreground'));
      item.classList.add('bg-accent','text-accent-foreground');
      renderAll();
    });
  });

  // ---- Init ----
  renderAll();
});
