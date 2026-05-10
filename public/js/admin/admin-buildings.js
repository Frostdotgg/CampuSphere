/* ========================================
   CampuSphere — Admin Buildings Script
   Handles CRUD for buildings via AJAX
   ======================================== */
document.addEventListener('DOMContentLoaded', () => {

  // ---- State ----
  let allBuildings = [];
  try { allBuildings = JSON.parse(document.getElementById('buildings-data-json').textContent); } catch(e){}

  let filter = { search: '', category: 'all' };

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
      lucide.createIcons(); return;
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
          <div class="flex items-center gap-2 flex-wrap">${catBadge(b.category)}</div>
          <div class="flex items-center gap-4 text-sm text-muted-foreground">
            <span class="flex items-center gap-1"><i data-lucide="map-pin" class="h-4 w-4"></i>${parseFloat(b.lat).toFixed(6)}, ${parseFloat(b.lng).toFixed(6)}</span>
          </div>
        </div></div>`;
    }).join('');

    lucide.createIcons();
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
  function openModal(m){if(m){m.classList.add('modal--open');document.body.style.overflow='hidden';}}
  function closeModal(m){if(m){m.classList.remove('modal--open');document.body.style.overflow='';}}
  document.querySelectorAll('.modal-backdrop').forEach(b=>{b.addEventListener('click',e=>{if(e.target===b)closeModal(b);});});
  document.querySelectorAll('.modal-close-btn').forEach(b=>{b.addEventListener('click',()=>closeModal(b.closest('.modal-backdrop')));});

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
    document.getElementById('building-modal-title').textContent='Add New Building';
    document.getElementById('building-submit-btn').innerHTML='<i data-lucide="plus" class="h-4 w-4 mr-2"></i>Add Building';
    clearFormErrors(buildingModal); openModal(buildingModal); lucide.createIcons();
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
    form.details.value=b.details||'';
    document.getElementById('building-modal-title').textContent='Edit Building';
    document.getElementById('building-submit-btn').innerHTML='<i data-lucide="check" class="h-4 w-4 mr-2"></i>Save Changes';
    clearFormErrors(buildingModal); openModal(buildingModal); lucide.createIcons();
  }

  const buildingForm=document.getElementById('building-form');
  if(buildingForm) buildingForm.addEventListener('submit', async e=>{
    e.preventDefault(); clearFormErrors(buildingModal);
    const editId=buildingForm.dataset.editId;
    const data={
      name:buildingForm.building_name.value.trim(),
      category:buildingForm.category.value,
      description:buildingForm.description.value.trim(),
      lat:buildingForm.lat.value.trim(),
      lng:buildingForm.lng.value.trim(),
      details:buildingForm.details.value.trim()
    };
    if(!data.name||!data.category||!data.lat||!data.lng){showFormError(buildingModal,'Name, category, lat, and lng are required.');return;}

    const btn=document.getElementById('building-submit-btn');
    btn.disabled=true; btn.innerHTML='<i data-lucide="loader-2" class="h-4 w-4 mr-2 animate-spin"></i>Saving...'; lucide.createIcons();

    try{
      const url=editId?'/admin/api/buildings/'+editId:'/admin/api/buildings';
      const method=editId?'PUT':'POST';
      const res=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      const json=await res.json();
      if(json.success){
        if(editId){const idx=allBuildings.findIndex(x=>x.id===parseInt(editId));if(idx!==-1)allBuildings[idx]=json.building;}
        else allBuildings.push(json.building);
        allBuildings.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
        renderAll(); closeModal(buildingModal);
        showToast(editId?'Building updated!':'Building added!','success');
      } else showFormError(buildingModal,json.message);
    }catch(err){showFormError(buildingModal,'Network error.');}
    finally{btn.disabled=false;btn.innerHTML=editId?'<i data-lucide="check" class="h-4 w-4 mr-2"></i>Save Changes':'<i data-lucide="plus" class="h-4 w-4 mr-2"></i>Add Building';lucide.createIcons();}
  });

  // ============================================================
  //  DELETE
  // ============================================================
  let pendingDeleteId=null;

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
    confirmDelBtn.innerHTML='<i data-lucide="loader-2" class="h-4 w-4 mr-2 animate-spin"></i>Deleting...'; lucide.createIcons();

    try{
      const res=await fetch('/admin/api/buildings/'+pendingDeleteId,{method:'DELETE'});
      const json=await res.json();
      if(json.success){
        allBuildings=allBuildings.filter(x=>x.id!==pendingDeleteId);
        renderAll(); closeModal(deleteModal);
        showToast('Building deleted.','success');
      } else showToast(json.message||'Failed to delete.','error');
    }catch(err){showToast('Network error.','error');}
    finally{pendingDeleteId=null;confirmDelBtn.disabled=false;confirmDelBtn.innerHTML='<i data-lucide="trash-2" class="h-4 w-4 mr-2"></i>Delete';lucide.createIcons();}
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
