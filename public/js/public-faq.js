'use strict';

/* Public FAQ progressive-enhancement controls. The server-rendered <details>
 * remain usable when this file is unavailable; this script only adds search,
 * category filtering, and result announcements. */

function initPublicFaq(doc) {
    if (!doc || typeof doc.querySelector !== 'function') return null;

    const root = doc.querySelector('[data-faq-root]');
    if (!root) return null;

    const controls = root.querySelector('[data-faq-controls]');
    const search = root.querySelector('#faq-search');
    const category = root.querySelector('#faq-category');
    const clear = root.querySelector('#faq-clear');
    const status = root.querySelector('#faq-status');
    const filteredEmpty = root.querySelector('#faq-filtered-empty');
    const items = Array.from(root.querySelectorAll('[data-faq-item]'));

    if (!controls || !search || !category || !clear || !status || !filteredEmpty) return null;

    controls.hidden = false;

    const normalize = (value) => String(value || '').trim().toLowerCase();

    function applyFilters() {
        const query = normalize(search.value);
        const selectedCategory = String(category.value || '');
        let visibleCount = 0;

        items.forEach((item) => {
            const matchesQuery = !query || normalize(item.textContent).includes(query);
            const matchesCategory = !selectedCategory || item.getAttribute('data-category') === selectedCategory;
            const visible = matchesQuery && matchesCategory;

            if (!visible && typeof item.contains === 'function' && item.contains(doc.activeElement)
                && typeof search.focus === 'function') {
                search.focus();
            }

            item.hidden = !visible;
            if (!visible) item.open = false;
            if (visible) visibleCount += 1;
        });

        const noun = visibleCount === 1 ? 'question' : 'questions';
        status.textContent = `${visibleCount} ${noun} shown`;
        filteredEmpty.hidden = visibleCount !== 0 || items.length === 0;
        clear.hidden = !query && !selectedCategory;
    }

    search.addEventListener('input', applyFilters);
    category.addEventListener('change', applyFilters);
    clear.addEventListener('click', () => {
        search.value = '';
        category.value = '';
        applyFilters();
        if (typeof search.focus === 'function') search.focus();
    });

    applyFilters();
    return { applyFilters, items };
}

const publicFaqApi = { initPublicFaq };

if (typeof module !== 'undefined' && module.exports) {
    module.exports = publicFaqApi;
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => initPublicFaq(document), { once: true });
}
