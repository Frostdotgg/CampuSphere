(function (global) {
  'use strict';

  // Client-side preview guard mirrors utils/mediaUrl.js. It never fetches a
  // pasted Drive URL directly: valid Drive links are converted to the
  // authenticated same-origin proxy path before an <img> receives them.
  var DRIVE_HOSTS = { 'drive.google.com': true, 'www.drive.google.com': true };
  var FILE_ID_RE = /^[A-Za-z0-9_-]{1,200}$/;
  var RESOURCE_KEY_RE = /^[A-Za-z0-9_-]{1,200}$/;
  var USP_RE = /^[A-Za-z0-9._~-]{1,80}$/;
  var CLOUDINARY_HOST = 'res.cloudinary.com';

  function safeLocalImgPath(raw) {
    var candidate = typeof raw === 'string' ? raw.trim() : '';
    return /^\/img\/[A-Za-z0-9._/-]+$/.test(candidate) &&
      candidate.indexOf('//') === -1 && candidate.indexOf('..') === -1
      ? candidate : null;
  }

  function scalarParam(url, name, pattern) {
    var values = url.searchParams.getAll(name);
    if (values.length > 1) return null;
    if (values.length === 0) return '';
    return pattern.test(values[0]) ? values[0] : null;
  }

  function parseGoogleDriveFileUrl(raw) {
    var value = typeof raw === 'string' ? raw.trim() : '';
    if (!value || value.length > 2048) return null;
    var url;
    try { url = new URL(value); } catch (error) { return null; }
    if (url.protocol !== 'https:' || !DRIVE_HOSTS[url.hostname] ||
        url.username || url.password || url.port || url.hash) return null;
    var keys = Array.from(new Set(Array.from(url.searchParams.keys())));
    if (keys.some(function (key) { return key !== 'id' && key !== 'resourcekey' && key !== 'usp'; })) return null;
    var resourceKey = scalarParam(url, 'resourcekey', RESOURCE_KEY_RE);
    var usp = scalarParam(url, 'usp', USP_RE);
    if (resourceKey === null || usp === null) return null;
    var fileId = '';
    var fileMatch = /^\/file\/d\/([^/]+)\/view\/?$/.exec(url.pathname);
    if (fileMatch) {
      try { fileId = decodeURIComponent(fileMatch[1]); } catch (error) { return null; }
      if (url.searchParams.has('id')) return null;
    } else if (url.pathname === '/open' || url.pathname === '/open/') {
      fileId = scalarParam(url, 'id', FILE_ID_RE);
      if (fileId === null || fileId === '') return null;
    } else return null;
    return FILE_ID_RE.test(fileId) ? { fileId: fileId, resourceKey: resourceKey || null } : null;
  }

  function googleDriveProxyUrl(raw) {
    var parsed = parseGoogleDriveFileUrl(raw);
    if (!parsed) return null;
    return '/api/media/google-drive/' + encodeURIComponent(parsed.fileId) +
      (parsed.resourceKey ? '?resourcekey=' + encodeURIComponent(parsed.resourceKey) : '');
  }

  function safeCloudinaryUrl(raw) {
    var candidate = typeof raw === 'string' ? raw.trim() : '';
    try {
      var parsed = new URL(candidate);
      return parsed.protocol === 'https:' && parsed.hostname === CLOUDINARY_HOST &&
        !parsed.username && !parsed.password && !parsed.port ? candidate : null;
    } catch (error) { return null; }
  }

  function safeProxyUrl(raw) {
    var candidate = typeof raw === 'string' ? raw.trim() : '';
    if (!candidate || candidate.length > 2048) return null;
    try {
      var parsed = new URL(candidate, global.location && global.location.origin);
      if (parsed.origin !== (global.location && global.location.origin)) return null;
      if (!/^\/api\/media\/google-drive\/[A-Za-z0-9_-]{1,200}$/.test(parsed.pathname)) return null;
      var key = scalarParam(parsed, 'resourcekey', RESOURCE_KEY_RE);
      var names = Array.from(new Set(Array.from(parsed.searchParams.keys())));
      if (names.some(function (name) { return name !== 'resourcekey'; }) || key === null) return null;
      return candidate;
    } catch (error) { return null; }
  }

  function safeMediaUrl(raw) {
    return safeLocalImgPath(raw) || safeCloudinaryUrl(raw) || googleDriveProxyUrl(raw) || safeProxyUrl(raw);
  }

  global.CampuSphereMedia = Object.freeze({
    parseGoogleDriveFileUrl: parseGoogleDriveFileUrl,
    googleDriveProxyUrl: googleDriveProxyUrl,
    safeLocalImgPath: safeLocalImgPath,
    safeCloudinaryUrl: safeCloudinaryUrl,
    safeMediaUrl: safeMediaUrl
  });
})(window);
