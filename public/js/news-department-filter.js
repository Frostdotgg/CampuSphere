'use strict';
// Templates are rendered as sections change, so one delegated listener handles
// current and future lists. Content was audience-filtered on the server first.
document.addEventListener('change', event => {
  const select = event.target;
  if (!select.matches('[data-news-department-filter]')) return;
  const panel = select.closest('.panel-card');
  if (!panel) return;
  let visible = 0;
  let total = 0;
  panel.querySelectorAll('[data-news-department-label]').forEach(label => {
    const row = label.closest('.news-item,tr');
    if (!row) return;
    total++;
    const matches = select.value === 'all' || label.dataset.department === select.value;
    row.hidden = !matches;
    if (!matches) row.querySelectorAll('details[data-news-disclosure]').forEach(details => { details.open = false; });
    if (matches) visible++;
  });
  const empty = panel.querySelector('[data-news-department-empty]');
  if (empty) empty.hidden = visible > 0 || total === 0;
  const count = panel.querySelector('[data-news-result-count]');
  if (count) count.textContent = visible + (visible === 1 ? ' announcement' : ' announcements');
});

// Native details keeps keyboard behaviour. Its toggle event does not bubble,
// so capture it once for dynamically rendered role sections.
document.addEventListener('toggle', event => {
  const details = event.target;
  if (!details.matches('[data-news-disclosure]')) return;
  const preview = details.closest('.news-item').querySelector('[data-news-preview]');
  if (preview) preview.hidden = details.open;
}, true);
