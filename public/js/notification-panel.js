'use strict';

/*
 * Authenticated navbar notification disclosure.
 *
 * The endpoint is intentionally read-only.  This client stores only the
 * server-provided revision in localStorage so the red dot represents updates
 * seen in this browser, never notification content or account data.
 */

const STORAGE_KEY = 'campussphere-notification-revision';
const DEFAULT_ANNOUNCEMENTS_HREF = '/dashboard?section=news';
const DEFAULT_EVENTS_HREF = '/events';
const ALLOWED_HREFS = new Set([
  '/admin/news',
  '/events',
  '/dashboard?section=news',
  '/dashboard?section=announcements',
  '/dashboard?section=news-events'
]);

function safeClientText(value, max = 240) {
  if (value == null) return '';
  return String(value).trim().slice(0, max);
}

function safeInternalHref(value, fallback = DEFAULT_EVENTS_HREF) {
  const candidate = safeClientText(value, 160);
  if (ALLOWED_HREFS.has(candidate)) return candidate;
  return ALLOWED_HREFS.has(fallback) ? fallback : DEFAULT_EVENTS_HREF;
}

function hasFeedItems(feed) {
  return Boolean(feed && ((Array.isArray(feed.announcements) && feed.announcements.length > 0)
    || (Array.isArray(feed.events) && feed.events.length > 0)));
}

function formatDateLabel(value) {
  const text = safeClientText(value, 40);
  if (!text) return '';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
  const parsed = new Date(dateOnly ? `${text}T12:00:00+08:00` : text);
  if (Number.isNaN(parsed.getTime())) return text;
  try {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(parsed);
  } catch (_error) {
    return text;
  }
}

function normalizeClientAnnouncement(value) {
  if (!value || typeof value !== 'object') return null;
  const title = safeClientText(value.title, 160);
  if (!title) return null;
  return {
    title,
    category: safeClientText(value.category, 50) || 'Announcement',
    excerpt: safeClientText(value.excerpt, 240),
    publishedAt: safeClientText(value.publishedAt, 40)
  };
}

function normalizeClientEvent(value) {
  if (!value || typeof value !== 'object') return null;
  const title = safeClientText(value.title, 160);
  const date = safeClientText(value.date, 10);
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return {
    title,
    category: safeClientText(value.category, 50) || 'Event',
    date,
    time: safeClientText(value.time, 100),
    location: safeClientText(value.location, 160),
    description: safeClientText(value.description, 240)
  };
}

function normalizeClientFeed(value) {
  if (!value || typeof value !== 'object' || value.success !== true) return null;
  const revision = safeClientText(value.revision, 128);
  if (!revision || /[^a-zA-Z0-9:_-]/.test(revision)) return null;
  const announcements = Array.isArray(value.announcements)
    ? value.announcements.map(normalizeClientAnnouncement).filter(Boolean)
    : null;
  const events = Array.isArray(value.events)
    ? value.events.map(normalizeClientEvent).filter(Boolean)
    : null;
  if (!announcements || !events) return null;
  const links = value.links && typeof value.links === 'object' ? value.links : {};
  return {
    revision,
    announcements,
    events,
    links: {
      announcements: safeInternalHref(links.announcements, DEFAULT_ANNOUNCEMENTS_HREF),
      events: safeInternalHref(links.events, DEFAULT_EVENTS_HREF)
    }
  };
}

function initNotificationPanel(doc, win) {
  if (!doc || typeof doc.querySelectorAll !== 'function') return null;
  const getById = (id) => (typeof doc.getElementById === 'function'
    ? doc.getElementById(id)
    : doc.querySelector(`#${id}`));
  const panel = getById('notificationPanel');
  const triggers = Array.from(doc.querySelectorAll('[data-notification-trigger]'));
  if (!panel || triggers.length === 0) return null;

  const closeButton = getById('notificationPanelClose');
  const heading = getById('notificationPanelTitle');
  const status = getById('notificationPanelStatus');
  const errorBox = getById('notificationPanelError');
  const retryButton = getById('notificationPanelRetry');
  const content = getById('notificationPanelContent');
  const empty = getById('notificationPanelEmpty');
  const announcementsSection = getById('notificationAnnouncementsSection');
  const eventsSection = getById('notificationEventsSection');
  const announcementsList = getById('notificationAnnouncementsList');
  const eventsList = getById('notificationEventsList');
  const announcementsLink = getById('notificationAnnouncementsLink');
  const eventsLink = getById('notificationEventsLink');
  const hamburger = getById('dashHamburger');
  const storage = getStorage(win);
  const state = { isOpen: false, lastTrigger: null, feed: null, inFlight: null };

  function setHidden(element, hidden) {
    if (!element) return;
    element.hidden = Boolean(hidden);
  }

  function getStoredRevision() {
    if (!storage) return '';
    try { return safeClientText(storage.getItem(STORAGE_KEY), 128); } catch (_error) { return ''; }
  }

  function rememberRevision(revision) {
    if (!storage || !revision) return;
    try { storage.setItem(STORAGE_KEY, revision); } catch (_error) { /* private mode */ }
  }

  function dotElements() {
    return triggers.reduce((items, trigger) => {
      const dot = trigger.querySelector && trigger.querySelector('.dash-nav__notif-dot');
      if (dot) items.push(dot);
      return items;
    }, []);
  }

  function setDotVisible(visible) {
    dotElements().forEach((dot) => {
      setHidden(dot, !visible);
      dot.setAttribute('aria-hidden', visible ? 'false' : 'true');
    });
  }

  function syncTriggers() {
    const hasNewItems = Boolean(state.feed && hasFeedItems(state.feed)
      && state.feed.revision !== getStoredRevision());
    triggers.forEach((trigger) => {
      trigger.setAttribute('aria-expanded', state.isOpen ? 'true' : 'false');
      trigger.setAttribute('aria-label', hasNewItems ? 'Notifications, new updates' : 'Notifications');
    });
    setDotVisible(!state.isOpen && hasNewItems);
  }

  function clearChildren(element) {
    if (!element) return;
    while (element.firstChild) element.removeChild(element.firstChild);
  }

  function addText(element, className, text) {
    if (!element || !text) return;
    const node = doc.createElement('span');
    if (className) node.className = className;
    node.textContent = text;
    element.appendChild(node);
  }

  function renderAnnouncement(item) {
    const article = doc.createElement('article');
    article.className = 'dash-nav__notification-item';
    addText(article, 'dash-nav__notification-item-category', item.category);
    addText(article, 'dash-nav__notification-item-title', item.title);
    addText(article, 'dash-nav__notification-item-copy', item.excerpt);
    addText(article, 'dash-nav__notification-item-meta', formatDateLabel(item.publishedAt));
    return article;
  }

  function renderEvent(item) {
    const article = doc.createElement('article');
    article.className = 'dash-nav__notification-item';
    addText(article, 'dash-nav__notification-item-category', item.category);
    addText(article, 'dash-nav__notification-item-title', item.title);
    const details = [formatDateLabel(item.date), item.time, item.location].filter(Boolean).join(' · ');
    addText(article, 'dash-nav__notification-item-meta', details);
    addText(article, 'dash-nav__notification-item-copy', item.description);
    return article;
  }

  function renderFeed(feed) {
    if (!feed) return;
    clearChildren(announcementsList);
    clearChildren(eventsList);
    const announcementItems = feed.announcements.map(renderAnnouncement);
    const eventItems = feed.events.map(renderEvent);
    announcementItems.forEach((item) => announcementsList && announcementsList.appendChild(item));
    eventItems.forEach((item) => eventsList && eventsList.appendChild(item));
    setHidden(announcementsSection, announcementItems.length === 0);
    setHidden(eventsSection, eventItems.length === 0);
    setHidden(content, !hasFeedItems(feed));
    setHidden(empty, hasFeedItems(feed));
    if (announcementsLink) announcementsLink.setAttribute('href', safeInternalHref(
      feed.links.announcements, DEFAULT_ANNOUNCEMENTS_HREF
    ));
    if (eventsLink) eventsLink.setAttribute('href', safeInternalHref(feed.links.events, DEFAULT_EVENTS_HREF));
    if (status) {
      const parts = [];
      if (announcementItems.length) parts.push(`${announcementItems.length} announcement${announcementItems.length === 1 ? '' : 's'}`);
      if (eventItems.length) parts.push(`${eventItems.length} upcoming event${eventItems.length === 1 ? '' : 's'}`);
      status.textContent = parts.length ? `${parts.join(' and ')}.` : 'No announcements or upcoming events.';
    }
    setHidden(errorBox, true);
  }

  function showLoading() {
    setHidden(errorBox, true);
    setHidden(empty, true);
    if (status) status.textContent = 'Loading notifications...';
    if (!state.feed) setHidden(content, true);
  }

  function showError() {
    if (status) status.textContent = 'Notifications are temporarily unavailable.';
    setHidden(errorBox, false);
    if (!state.feed) {
      setHidden(content, true);
      setHidden(empty, true);
    }
  }

  function markCurrentRevisionSeen() {
    if (state.feed && state.feed.revision) rememberRevision(state.feed.revision);
  }

  function isVisibleControl(control) {
    if (!control || control.hidden || control.getAttribute('aria-hidden') === 'true') return false;
    if (typeof control.getClientRects === 'function') return control.getClientRects().length > 0;
    return true;
  }

  function restoreFocus() {
    const candidate = [state.lastTrigger, ...triggers, hamburger].find(isVisibleControl);
    if (candidate && typeof candidate.focus === 'function') candidate.focus();
  }

  function openPanel(trigger) {
    state.isOpen = true;
    state.lastTrigger = trigger || state.lastTrigger || triggers[0];
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    setDotVisible(false);
    markCurrentRevisionSeen();
    syncTriggers();
    if (state.feed) renderFeed(state.feed);
    if (heading && typeof heading.focus === 'function') heading.focus();
    loadFeed(true);
  }

  function closePanel(restore = true) {
    state.isOpen = false;
    panel.hidden = true;
    panel.setAttribute('aria-hidden', 'true');
    syncTriggers();
    if (restore) restoreFocus();
  }

  async function requestFeed() {
    const transport = win && typeof win.fetch === 'function'
      ? win.fetch.bind(win)
      : (typeof fetch === 'function' ? fetch : null);
    if (!transport) throw new Error('Notification transport unavailable.');
    const response = await transport('/api/notifications', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    if (!response || !response.ok) throw new Error('Notification request failed.');
    const payload = await response.json();
    const normalized = normalizeClientFeed(payload);
    if (!normalized) throw new Error('Notification response invalid.');
    return normalized;
  }

  function loadFeed(showLoadingState) {
    if (state.inFlight) return state.inFlight;
    if (showLoadingState) showLoading();
    state.inFlight = requestFeed()
      .then((feed) => {
        state.feed = feed;
        renderFeed(feed);
        if (state.isOpen) markCurrentRevisionSeen();
        syncTriggers();
        return feed;
      })
      .catch((error) => {
        showError();
        syncTriggers();
        return null;
      })
      .finally(() => { state.inFlight = null; });
    return state.inFlight;
  }

  function onTriggerClick(event) {
    event.preventDefault();
    if (state.isOpen) closePanel();
    else openPanel(event.currentTarget);
  }

  function onKeydown(event) {
    if (event.key === 'Escape' && state.isOpen) {
      event.preventDefault();
      closePanel();
    }
  }

  function onPointerdown(event) {
    if (!state.isOpen) return;
    const target = event.target;
    const insidePanel = panel.contains && panel.contains(target);
    const onTrigger = triggers.some((trigger) => trigger.contains && trigger.contains(target));
    if (!insidePanel && !onTrigger) closePanel(false);
  }

  triggers.forEach((trigger) => trigger.addEventListener('click', onTriggerClick));
  if (closeButton) closeButton.addEventListener('click', closePanel);
  if (retryButton) retryButton.addEventListener('click', () => loadFeed(true));
  if (typeof doc.addEventListener === 'function') {
    doc.addEventListener('keydown', onKeydown);
    doc.addEventListener('pointerdown', onPointerdown);
  }
  panel.hidden = true;
  panel.setAttribute('aria-hidden', 'true');
  syncTriggers();
  loadFeed(false);

  return {
    state,
    open: openPanel,
    close: closePanel,
    refresh: () => loadFeed(true),
    destroy() {
      triggers.forEach((trigger) => trigger.removeEventListener('click', onTriggerClick));
      if (closeButton) closeButton.removeEventListener('click', closePanel);
      if (typeof doc.removeEventListener === 'function') {
        doc.removeEventListener('keydown', onKeydown);
        doc.removeEventListener('pointerdown', onPointerdown);
      }
    }
  };
}

function getStorage(win) {
  try {
    return win && win.localStorage ? win.localStorage
      : (typeof localStorage !== 'undefined' ? localStorage : null);
  } catch (_error) {
    return null;
  }
}

function bootNotificationPanel(root) {
  if (!root || !root.document) return;
  const start = () => initNotificationPanel(root.document, root);
  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}

if (typeof window !== 'undefined' && window.document) bootNotificationPanel(window);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STORAGE_KEY,
    safeInternalHref,
    hasFeedItems,
    formatDateLabel,
    normalizeClientFeed,
    initNotificationPanel
  };
}
