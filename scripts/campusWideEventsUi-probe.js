'use strict';
// Database-free DOM fixtures run the shipped editor script, without networking.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {CONTENT_DEPARTMENTS, EVENT_DEPARTMENTS} = require('../utils/departments');
let checks = 0;
function check(label, run) { run(); checks++; console.log('[PASS] ' + label); }
function fixture(defaultCode) {
  const nodes = new Map(), handlers = new Map();
  let active;
  class Node {
    constructor(id) { this.id=id; this.value=''; this.dataset={}; this.style={}; this.listeners={}; this.disabled=false; this.textContent=''; this.classes=new Set(); this.classList={add:(...v)=>v.forEach(x=>this.classes.add(x)),remove:(...v)=>v.forEach(x=>this.classes.delete(x))}; }
    addEventListener(event, fn) { this.listeners[event]=fn; }
    fire(event) { return this.listeners[event]?.({target:this,preventDefault(){},stopPropagation(){}}); }
    focus() { active=this; }
    setAttribute(key,value) { this[key]=value; }
    removeAttribute(key) { delete this[key]; if(key==='data-edit-id')delete this.dataset.editId; }
    getClientRects() { return [{}]; }
    querySelector(selector) { if(selector==='.form-error')return node(this.id+'-error'); if(selector==='span')return node(this.id+'-label'); if(selector==='select,input,button,textarea')return node('first-control'); return null; }
    querySelectorAll(selector) {
      if(selector==='.dropdown-menu-item')return this.menu || [];
      if(selector==='button,input,select,textarea,a[href]')return [node('first-control'),node('last-control')];
      return [];
    }
    get innerHTML() { return this.html ?? String(this.textContent).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    set innerHTML(html) { this.html=html; this.menu=[...html.matchAll(/data-value="([^"]+)"/g)].map(m=>{const el=new Node('category-'+m[1]);el.dataset.value=m[1];return el;}); }
  }
  const node=id=>{if(!nodes.has(id))nodes.set(id,new Node(id));return nodes.get(id);};
  const articles=[{id:1,title:'Legacy article',category:'General',department_code:'university-wide',audience:'all',excerpt:'Article text'}];
  const events=[{id:1,title:'Legacy Campus',category:'Academic',department_code:'university-wide',audience:'admin',event_date:'2026-11-01',description:'Keep original'}, {id:2,title:'CCS Sports',category:'Sports',department_code:'ccs',audience:'all',event_date:'2026-11-01'}];
  node('articles-data-json').textContent=JSON.stringify(articles);
  node('events-data-json').textContent=JSON.stringify(events);
  node('department-data-json').textContent=JSON.stringify({options:CONTENT_DEPARTMENTS,eventOptions:EVENT_DEPARTMENTS,defaultCode});
  for(const kind of ['news','event']) {
    const form=node(kind+'-form');
    for(const key of ['department_code','title_field','category','audience','event_date','event_time','location','description','excerpt','content','status'])form[key]=node(kind+'-'+key);
    form.reset=()=>{for(const key of ['department_code','title_field','category','audience','event_date','event_time','location','description','excerpt','content','status'])form[key].value='';};
  }
  const editEvent=node('edit-event');editEvent.dataset.id='1';
  const editNews=node('edit-news');editNews.dataset.id='1';
  const document={getElementById:node,createElement:()=>new Node('escape'),body:{style:{}},
    addEventListener:(event,fn)=>handlers.set(event,fn),
    querySelector:selector=>selector==='.modal-backdrop.modal--open'?[...nodes.values()].find(n=>n.classes.has('modal--open')):null,
    querySelectorAll:selector=>selector==='.btn-edit-event'?[editEvent]:selector==='.btn-edit-news'?[editNews]:[],
    get activeElement(){return active;}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/js/admin/admin-news.js'),'utf8'),{document,window:{},Date,console,setTimeout(){throw Error('Unexpected timer');},fetch(){throw Error('Unexpected network');}});
  handlers.get('DOMContentLoaded')();
  return {node,handlers,editEvent,editNews,document};
}
for(const defaultCode of ['', 'ccs']) {
  const f=fixture(defaultCode),get=f.node,tab=kind=>get('tab-'+kind).fire('click');
  check(defaultCode+' initial News filter has no Campus-wide',()=>{assert(!get('department-filter').innerHTML.includes('university-wide'));assert(get('department-filter').innerHTML.includes('All departments'));});
  tab('events');
  check(defaultCode+' Events filter orders Campus-wide before departments',()=>assert(get('department-filter').innerHTML.indexOf('Campus-wide')<get('department-filter').innerHTML.indexOf('Graduate School')));
  get('department-filter').value='university-wide';get('department-filter').fire('change');
  check(defaultCode+' Campus-wide filter displays only matching event',()=>{assert(get('events-table-body').innerHTML.includes('Legacy Campus'));assert(!get('events-table-body').innerHTML.includes('CCS Sports'));assert(get('events-table-body').innerHTML.includes('Campus-wide'));assert(get('events-table-body').innerHTML.includes('Admins'));});
  get('content-search-input').value='no match';get('content-search-input').fire('input');
  check(defaultCode+' search and department combine with empty state',()=>assert(get('events-table-body').innerHTML.includes('No events found')));
  get('content-search-input').value='Legacy';get('content-search-input').fire('input');
  check(defaultCode+' search restores matching Campus-wide event',()=>assert(get('events-table-body').innerHTML.includes('Legacy Campus')));
  const category=get('cat-filter-menu').querySelectorAll('.dropdown-menu-item').find(n=>n.dataset.value==='Sports');
  check(defaultCode+' event categories exclude Facilities',()=>{assert(category);assert(!get('cat-filter-menu').innerHTML.includes('Facilities'));});
  category.fire('click');
  check(defaultCode+' category search and department combine',()=>assert(get('events-table-body').innerHTML.includes('No events found')));
  get('cat-filter-menu').querySelectorAll('.dropdown-menu-item').find(n=>n.dataset.value==='Academic').fire('click');
  check(defaultCode+' Academic restores matching Campus-wide event',()=>assert(get('events-table-body').innerHTML.includes('Legacy Campus')));
  tab('news');
  check(defaultCode+' switching Campus-wide to News resets only department',()=>{assert.equal(get('department-filter').value,'all');assert(!get('department-filter').innerHTML.includes('university-wide'));assert.equal(get('content-search-input').value,'Legacy');});
  get('department-filter').value='ccs';get('department-filter').fire('change');tab('events');tab('news');
  check(defaultCode+' seven-department selection survives tab switching',()=>assert.equal(get('department-filter').value,'ccs'));
  tab('events');get('add-content-btn').fire('click');
  check(defaultCode+' new event retains role-specific default',()=>assert.equal(get('event-form').department_code.value,defaultCode));
  f.handlers.get('keydown')({key:'Escape',preventDefault(){}});
  check(defaultCode+' Escape closes modal',()=>assert(!get('event-modal').classes.has('modal--open')));
  f.editEvent.fire('click');
  check(defaultCode+' legacy event opens Campus-wide with unchanged audience/text',()=>{assert.equal(get('event-form').department_code.value,'university-wide');assert.equal(get('event-form').audience.value,'admin');assert.equal(get('event-form').description.value,'Keep original');});
  get('last-control').focus();let prevented=false;f.handlers.get('keydown')({key:'Tab',shiftKey:false,preventDefault(){prevented=true;}});
  check(defaultCode+' keyboard focus wraps within event dialog',()=>{assert(prevented);assert.equal(f.document.activeElement,get('first-control'));});
  f.handlers.get('keydown')({key:'Escape',preventDefault(){}});tab('news');get('add-content-btn').fire('click');
  check(defaultCode+' new article retains role-specific department default',()=>assert.equal(get('news-form').department_code.value,defaultCode));
  f.handlers.get('keydown')({key:'Escape',preventDefault(){}});f.editNews.fire('click');
  check(defaultCode+' legacy article still requires department replacement',()=>assert.equal(get('news-form').department_code.value,''));
}
console.log('CAMPUS-WIDE-EVENTS-UI OK: '+checks+'/'+checks);
