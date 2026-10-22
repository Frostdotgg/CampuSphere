'use strict';
// Templates are rendered as sections change, so one delegated listener handles
// current and future lists. Content was audience-filtered on the server first.
document.addEventListener('change', event => {
  const select = event.target;
  if (!select.matches('[data-news-department-filter]')) return;
  const panel = select.closest('.panel-card');
  if (!panel) return;
  let visible = 0;
  panel.querySelectorAll('[data-news-department-label]').forEach(label => {
    const row = label.closest('.news-item,tr');
    if (!row) return;
    const matches = select.value === 'all' || label.dataset.department === select.value;
    row.hidden = !matches;
    if (matches) visible++;
  });
  const empty = panel.querySelector('[data-news-department-empty]');
  if (empty) empty.hidden = visible > 0;
});
