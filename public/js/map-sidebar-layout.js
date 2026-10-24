/* Shared viewport sizing only; navigation and route data stay in their owners. */
(function () {
  'use strict';
  function init() {
    var workspace = document.querySelector('.map-page');
    if (!workspace) return;
    var nav = document.querySelector('.dash-nav');
    var header = workspace.querySelector('.map-sidebar__header');
    var canvas = workspace.querySelector('.map-container');
    var scheduled = false;
    function update() {
      scheduled = false;
      var viewport = window.visualViewport;
      var height = viewport ? viewport.height : window.innerHeight;
      var navBottom = nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 0;
      var available = Math.max(0, height - navBottom);
      workspace.style.setProperty('--map-nav-height', navBottom + 'px');
      workspace.style.setProperty('--map-workspace-height', available + 'px');
      workspace.style.setProperty('--map-sidebar-header-height', header ? header.offsetHeight + 'px' : '0px');
      workspace.classList.toggle('is-short-viewport', available < 560);
      window.dispatchEvent(new Event('campusphere:map-layout'));
    }
    function schedule() {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(update);
    }
    window.addEventListener('resize', schedule);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', schedule);
    if (typeof ResizeObserver === 'function') {
      var observer = new ResizeObserver(schedule);
      [nav, header, canvas].forEach(function (element) { if (element) observer.observe(element); });
    }
    update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
