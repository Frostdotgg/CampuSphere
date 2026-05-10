/* ========================================
   CampuSphere — Admin News & Events Script
   Handles CRUD via AJAX (fetch)
   ======================================== */
document.addEventListener('DOMContentLoaded', () => {

  // ---- State ----
  let allArticles = [];
  let allEvents = [];
  try { allArticles = JSON.parse(document.getElementById('articles-data-json').textContent); } catch(e){}
  try { allEvents = JSON.parse(document.getElementById('events-data-json').textContent); } catch(e){}

  let currentTab = 'news';
  let filter = { search: '', category: 'all' };

  // ---- DOM ----
  const tabNews = document.getElementById('tab-news');
  const tabEvents = document.getElementById('tab-events');
  const newsPanel = document.getElementById('panel-news');
  const eventsPanel = document.getElementById('panel-events');
  const searchInput = document.getElementById('content-search-input');
  const catFilterBtn = document.getElementById('cat-filter-btn');
  const catFilterMenu = document.getElementById('cat-filter-menu');
  const addBtn = document.getElementById('add-content-btn');
  const newsGrid = document.getElementById('news-grid');
  const eventsTableBody = document.getElementById('events-table-body');
  const toast = document.getElementById('admin-toast');

  // Modals
  const newsModal = document.getElementById('news-modal');
  const eventModal = document.getElementById('event-modal');
  const deleteModal = document.getElementById('delete-content-modal');

  // ---- Toast ----
  function showToast(msg, type='success') {
    if(!toast) return;
    toast.textContent = msg;
    toast.className = 'admin-toast admin-toast--'+type+' admin-toast--show';
    setTimeout(()=>toast.classList.remove('admin-toast--show'), 3500);
  }

  // ---- Escape HTML ----
  function esc(t){ const d=document.createElement('div'); d.textContent=t||''; return d.innerHTML; }

  // ---- Time helpers ----
  function timeAgo(d){
    const ms=Date.now()-new Date(d).getTime(), m=Math.floor(ms/60000);
    if(m<1)return'Just now'; if(m<60)return m+' min ago';
    const h=Math.floor(m/60); if(h<24)return h+(h===1?' hour ago':' hours ago');
    const dy=Math.floor(h/24); if(dy<30)return dy+(dy===1?' day ago':' days ago');
    return Math.floor(dy/30)+' months ago';
  }
  function fmtDate(d){
    if(!d)return'—';
    return new Date(d).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});
  }

  // ---- Category badge ----
  function catBadge(cat){
    const map={
      'Announcement':{cls:'bg-chart-1/10 text-chart-1 border-chart-1/20'},
      'Campus Update':{cls:'bg-chart-2/10 text-chart-2 border-chart-2/20'},
      'Events':{cls:'bg-chart-4/10 text-chart-4 border-chart-4/20'},
      'Academic':{cls:'bg-primary/10 text-primary border-primary/20'},
      'Sports':{cls:'bg-chart-2/10 text-chart-2 border-chart-2/20'},
      'Cultural':{cls:'bg-chart-4/10 text-chart-4 border-chart-4/20'}
    };
    const info=map[cat]||{cls:'bg-muted text-muted-foreground border-border'};
    return `<span class="ui-badge ui-badge-outline ${info.cls}">${esc(cat)}</span>`;
  }

  // ---- Tabs ----
  function switchTab(tab){
    currentTab=tab;
    if(tab==='news'){
      tabNews.classList.add('bg-background','shadow-sm'); tabNews.classList.remove('text-muted-foreground');
      tabEvents.classList.remove('bg-background','shadow-sm'); tabEvents.classList.add('text-muted-foreground');
      newsPanel.style.display=''; eventsPanel.style.display='none';
      addBtn.innerHTML='<i data-lucide="plus" class="mr-2 h-4 w-4"></i>New Article';
    } else {
      tabEvents.classList.add('bg-background','shadow-sm'); tabEvents.classList.remove('text-muted-foreground');
      tabNews.classList.remove('bg-background','shadow-sm'); tabNews.classList.add('text-muted-foreground');
      newsPanel.style.display='none'; eventsPanel.style.display='';
      addBtn.innerHTML='<i data-lucide="plus" class="mr-2 h-4 w-4"></i>New Event';
    }
    lucide.createIcons();
    renderAll();
  }
  if(tabNews) tabNews.addEventListener('click',()=>switchTab('news'));
  if(tabEvents) tabEvents.addEventListener('click',()=>switchTab('events'));

  // ---- Update Stats ----
  function updateStats(){
    const el=id=>document.getElementById(id);
    if(el('stat-articles')) el('stat-articles').textContent=allArticles.length;
    if(el('stat-published')) el('stat-published').textContent=allArticles.filter(a=>a.published_date).length;
    if(el('stat-drafts')) el('stat-drafts').textContent=allArticles.filter(a=>!a.published_date).length;
    if(el('stat-events')) el('stat-events').textContent=allEvents.length;
  }

  // ---- Render News Grid ----
  function renderNews(){
    if(!newsGrid) return;
    let items=allArticles.filter(a=>{
      if(filter.category!=='all' && a.category!==filter.category) return false;
      if(filter.search){
        const q=filter.search.toLowerCase();
        if(!(a.title||'').toLowerCase().includes(q) && !(a.excerpt||'').toLowerCase().includes(q)) return false;
      }
      return true;
    });

    if(items.length===0){
      newsGrid.innerHTML=`<div class="ui-card border-border" style="grid-column:1/-1;text-align:center;padding:3rem;">
        <i data-lucide="newspaper" style="width:2.5rem;height:2.5rem;color:var(--muted-foreground);margin:0 auto .75rem;display:block;"></i>
        <p class="text-muted-foreground text-sm">No articles found.</p></div>`;
      lucide.createIcons(); return;
    }

    newsGrid.innerHTML=items.map(a=>{
      const isDraft=!a.published_date;
      const statusBadge=isDraft
        ?'<span class="ui-badge ui-badge-secondary border-transparent" style="align-self:flex-start;">Draft</span>'
        :'<span class="ui-badge ui-badge-default" style="align-self:flex-start;">Published</span>';
      return `<div class="ui-card border-border" data-id="${a.id}">
        <div class="p-6" style="display:flex;flex-direction:column;gap:0.75rem;">
          <div class="flex items-start justify-between">
            ${catBadge(a.category)}
            <button class="ui-button ui-button-ghost ui-button-size-icon h-8 w-8 dropdown-trigger" data-dropdown-target="nm-${a.id}">
              <i data-lucide="more-horizontal" class="h-4 w-4"></i></button>
            <div id="nm-${a.id}" class="dropdown-menu-content p-1" style="width:130px;">
              <div class="dropdown-menu-item btn-edit-news" data-id="${a.id}"><i data-lucide="edit" class="h-4 w-4 mr-2"></i>Edit</div>
              <div class="h-px bg-border my-1"></div>
              <div class="dropdown-menu-item text-destructive btn-delete-news" data-id="${a.id}"><i data-lucide="trash-2" class="h-4 w-4 mr-2"></i>Delete</div>
            </div>
          </div>
          <h4 class="text-base font-semibold text-foreground line-clamp-2">${esc(a.title)}</h4>
          <p class="text-sm text-muted-foreground line-clamp-2">${esc(a.excerpt)}</p>
          <div class="flex items-center justify-between mt-2">
            <span class="text-xs text-muted-foreground">${timeAgo(a.created_at)}</span>
          </div>
          ${statusBadge}
        </div></div>`;
    }).join('');
    lucide.createIcons();
    bindNewsActions();
    rebindDropdowns(newsGrid);
  }

  // ---- Render Events Table ----
  function renderEvents(){
    if(!eventsTableBody) return;
    let items=allEvents.filter(ev=>{
      if(filter.category!=='all' && ev.category!==filter.category) return false;
      if(filter.search){
        const q=filter.search.toLowerCase();
        if(!(ev.title||'').toLowerCase().includes(q) && !(ev.location||'').toLowerCase().includes(q)) return false;
      }
      return true;
    });

    if(items.length===0){
      eventsTableBody.innerHTML=`<tr><td colspan="6" style="text-align:center;padding:2rem;">
        <i data-lucide="calendar-x" style="width:2.5rem;height:2.5rem;color:var(--muted-foreground);display:inline-block;"></i>
        <p class="text-muted-foreground text-sm" style="margin-top:.5rem;">No events found.</p></td></tr>`;
      lucide.createIcons(); return;
    }

    eventsTableBody.innerHTML=items.map(ev=>`<tr data-id="${ev.id}">
      <td class="text-sm font-medium">${esc(ev.title)}</td>
      <td>${catBadge(ev.category)}</td>
      <td class="text-sm text-muted-foreground">${fmtDate(ev.event_date)}</td>
      <td class="text-sm text-muted-foreground">${esc(ev.event_time||'—')}</td>
      <td class="text-sm text-muted-foreground">${esc(ev.location||'—')}</td>
      <td>
        <button class="ui-button ui-button-ghost ui-button-size-icon h-8 w-8 dropdown-trigger" data-dropdown-target="em-${ev.id}">
          <i data-lucide="more-horizontal" class="h-4 w-4"></i></button>
        <div id="em-${ev.id}" class="dropdown-menu-content p-1" style="width:130px;">
          <div class="dropdown-menu-item btn-edit-event" data-id="${ev.id}"><i data-lucide="edit" class="h-4 w-4 mr-2"></i>Edit</div>
          <div class="h-px bg-border my-1"></div>
          <div class="dropdown-menu-item text-destructive btn-delete-event" data-id="${ev.id}"><i data-lucide="trash-2" class="h-4 w-4 mr-2"></i>Delete</div>
        </div>
      </td></tr>`).join('');
    lucide.createIcons();
    bindEventActions();
    rebindDropdowns(eventsTableBody);
  }

  function renderAll(){ renderNews(); renderEvents(); updateStats(); }

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
  function closeAllDropdowns(){document.querySelectorAll('.dropdown-menu-content').forEach(m=>m.removeAttribute('data-state'));}

  // ---- Modal helpers ----
  function openModal(m){if(m){m.classList.add('modal--open');document.body.style.overflow='hidden';}}
  function closeModal(m){if(m){m.classList.remove('modal--open');document.body.style.overflow='';}}
  document.querySelectorAll('.modal-backdrop').forEach(b=>{b.addEventListener('click',e=>{if(e.target===b)closeModal(b);});});
  document.querySelectorAll('.modal-close-btn').forEach(b=>{b.addEventListener('click',()=>closeModal(b.closest('.modal-backdrop')));});

  function showFormError(modal,msg){const el=modal?.querySelector('.form-error');if(el){el.textContent=msg;el.style.display='block';}}
  function clearFormErrors(modal){const el=modal?.querySelector('.form-error');if(el){el.textContent='';el.style.display='none';}}

  // ---- Bind row actions ----
  function bindNewsActions(){
    document.querySelectorAll('.btn-edit-news').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();closeAllDropdowns();openEditNews(parseInt(b.dataset.id));}));
    document.querySelectorAll('.btn-delete-news').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();closeAllDropdowns();openDeleteModal('news',parseInt(b.dataset.id));}));
  }
  function bindEventActions(){
    document.querySelectorAll('.btn-edit-event').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();closeAllDropdowns();openEditEvent(parseInt(b.dataset.id));}));
    document.querySelectorAll('.btn-delete-event').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();closeAllDropdowns();openDeleteModal('event',parseInt(b.dataset.id));}));
  }

  // ============================================================
  //  NEWS CRUD
  // ============================================================
  if(addBtn) addBtn.addEventListener('click',()=>{
    if(currentTab==='news') openCreateNews();
    else openCreateEvent();
  });

  function openCreateNews(){
    const form=document.getElementById('news-form'); if(form)form.reset();
    form.removeAttribute('data-edit-id');
    document.getElementById('news-modal-title').textContent='Create New Article';
    document.getElementById('news-submit-btn').innerHTML='<i data-lucide="plus" class="h-4 w-4 mr-2"></i>Create Article';
    clearFormErrors(newsModal); openModal(newsModal); lucide.createIcons();
  }

  function openEditNews(id){
    const a=allArticles.find(x=>x.id===id); if(!a)return;
    const form=document.getElementById('news-form');
    form.dataset.editId=id;
    form.title_field.value=a.title||'';
    form.category.value=a.category||'';
    form.excerpt.value=a.excerpt||'';
    form.content.value=a.content||a.excerpt||'';
    form.status.value=a.published_date?'published':'draft';
    document.getElementById('news-modal-title').textContent='Edit Article';
    document.getElementById('news-submit-btn').innerHTML='<i data-lucide="check" class="h-4 w-4 mr-2"></i>Save Changes';
    clearFormErrors(newsModal); openModal(newsModal); lucide.createIcons();
  }

  const newsForm=document.getElementById('news-form');
  if(newsForm) newsForm.addEventListener('submit', async e=>{
    e.preventDefault(); clearFormErrors(newsModal);
    const editId=newsForm.dataset.editId;
    const data={title:newsForm.title_field.value.trim(),category:newsForm.category.value,excerpt:newsForm.excerpt.value.trim(),content:newsForm.content.value.trim(),status:newsForm.status.value};
    if(!data.title||!data.category||!data.excerpt){showFormError(newsModal,'Title, category, and excerpt are required.');return;}

    const btn=document.getElementById('news-submit-btn');
    btn.disabled=true; btn.innerHTML='<i data-lucide="loader-2" class="h-4 w-4 mr-2 animate-spin"></i>Saving...'; lucide.createIcons();

    try{
      const url=editId?'/admin/api/news/'+editId:'/admin/api/news';
      const method=editId?'PUT':'POST';
      const res=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      const json=await res.json();
      if(json.success){
        if(editId){const idx=allArticles.findIndex(x=>x.id===parseInt(editId));if(idx!==-1)allArticles[idx]=json.article;}
        else allArticles.unshift(json.article);
        renderAll(); closeModal(newsModal);
        showToast(editId?'Article updated!':'Article created!','success');
      } else showFormError(newsModal,json.message);
    }catch(err){showFormError(newsModal,'Network error.');}
    finally{btn.disabled=false;btn.innerHTML=editId?'<i data-lucide="check" class="h-4 w-4 mr-2"></i>Save Changes':'<i data-lucide="plus" class="h-4 w-4 mr-2"></i>Create Article';lucide.createIcons();}
  });

  // ============================================================
  //  EVENT CRUD
  // ============================================================
  function openCreateEvent(){
    const form=document.getElementById('event-form'); if(form)form.reset();
    form.removeAttribute('data-edit-id');
    document.getElementById('event-modal-title').textContent='Create New Event';
    document.getElementById('event-submit-btn').innerHTML='<i data-lucide="plus" class="h-4 w-4 mr-2"></i>Create Event';
    clearFormErrors(eventModal); openModal(eventModal); lucide.createIcons();
  }

  function openEditEvent(id){
    const ev=allEvents.find(x=>x.id===id); if(!ev)return;
    const form=document.getElementById('event-form');
    form.dataset.editId=id;
    form.title_field.value=ev.title||'';
    form.category.value=ev.category||'';
    form.event_date.value=ev.event_date?new Date(ev.event_date).toISOString().split('T')[0]:'';
    form.event_time.value=ev.event_time||'';
    form.location.value=ev.location||'';
    form.description.value=ev.description||'';
    document.getElementById('event-modal-title').textContent='Edit Event';
    document.getElementById('event-submit-btn').innerHTML='<i data-lucide="check" class="h-4 w-4 mr-2"></i>Save Changes';
    clearFormErrors(eventModal); openModal(eventModal); lucide.createIcons();
  }

  const eventForm=document.getElementById('event-form');
  if(eventForm) eventForm.addEventListener('submit', async e=>{
    e.preventDefault(); clearFormErrors(eventModal);
    const editId=eventForm.dataset.editId;
    const data={title:eventForm.title_field.value.trim(),category:eventForm.category.value,event_date:eventForm.event_date.value,event_time:eventForm.event_time.value.trim(),location:eventForm.location.value.trim(),description:eventForm.description.value.trim()};
    if(!data.title||!data.category||!data.event_date){showFormError(eventModal,'Title, category, and date are required.');return;}

    const btn=document.getElementById('event-submit-btn');
    btn.disabled=true; btn.innerHTML='<i data-lucide="loader-2" class="h-4 w-4 mr-2 animate-spin"></i>Saving...'; lucide.createIcons();

    try{
      const url=editId?'/admin/api/events/'+editId:'/admin/api/events';
      const method=editId?'PUT':'POST';
      const res=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      const json=await res.json();
      if(json.success){
        if(editId){const idx=allEvents.findIndex(x=>x.id===parseInt(editId));if(idx!==-1)allEvents[idx]=json.event;}
        else allEvents.unshift(json.event);
        renderAll(); closeModal(eventModal);
        showToast(editId?'Event updated!':'Event created!','success');
      } else showFormError(eventModal,json.message);
    }catch(err){showFormError(eventModal,'Network error.');}
    finally{btn.disabled=false;btn.innerHTML=editId?'<i data-lucide="check" class="h-4 w-4 mr-2"></i>Save Changes':'<i data-lucide="plus" class="h-4 w-4 mr-2"></i>Create Event';lucide.createIcons();}
  });

  // ============================================================
  //  DELETE (shared)
  // ============================================================
  let pendingDelete={type:null,id:null};

  function openDeleteModal(type,id){
    const item=type==='news'?allArticles.find(x=>x.id===id):allEvents.find(x=>x.id===id);
    if(!item)return;
    pendingDelete={type,id};
    const nameEl=document.getElementById('delete-content-name');
    if(nameEl) nameEl.textContent=item.title;
    openModal(deleteModal);
  }

  const cancelDelBtn=document.getElementById('cancel-content-delete-btn');
  const confirmDelBtn=document.getElementById('confirm-content-delete-btn');
  if(cancelDelBtn) cancelDelBtn.addEventListener('click',()=>{pendingDelete={type:null,id:null};closeModal(deleteModal);});

  if(confirmDelBtn) confirmDelBtn.addEventListener('click', async()=>{
    if(!pendingDelete.id)return;
    confirmDelBtn.disabled=true;
    confirmDelBtn.innerHTML='<i data-lucide="loader-2" class="h-4 w-4 mr-2 animate-spin"></i>Deleting...'; lucide.createIcons();

    try{
      const url=pendingDelete.type==='news'?'/admin/api/news/'+pendingDelete.id:'/admin/api/events/'+pendingDelete.id;
      const res=await fetch(url,{method:'DELETE'});
      const json=await res.json();
      if(json.success){
        if(pendingDelete.type==='news') allArticles=allArticles.filter(x=>x.id!==pendingDelete.id);
        else allEvents=allEvents.filter(x=>x.id!==pendingDelete.id);
        renderAll(); closeModal(deleteModal);
        showToast(pendingDelete.type==='news'?'Article deleted.':'Event deleted.','success');
      } else showToast(json.message||'Failed to delete.','error');
    }catch(err){showToast('Network error.','error');}
    finally{pendingDelete={type:null,id:null};confirmDelBtn.disabled=false;confirmDelBtn.innerHTML='<i data-lucide="trash-2" class="h-4 w-4 mr-2"></i>Delete';lucide.createIcons();}
  });

  // ---- Search & Filter ----
  if(searchInput) searchInput.addEventListener('input',()=>{filter.search=searchInput.value;renderAll();});
  if(catFilterMenu) catFilterMenu.querySelectorAll('.dropdown-menu-item').forEach(item=>{
    item.addEventListener('click',()=>{
      filter.category=item.dataset.value||'all';
      if(catFilterBtn)catFilterBtn.querySelector('span').textContent=item.textContent;
      catFilterMenu.querySelectorAll('.dropdown-menu-item').forEach(i=>i.classList.remove('bg-accent','text-accent-foreground'));
      item.classList.add('bg-accent','text-accent-foreground');
      renderAll();
    });
  });

  // ---- Init ----
  switchTab('news');
});
