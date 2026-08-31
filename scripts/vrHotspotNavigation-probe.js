'use strict';

/* ========================================
   CampuSphere - VR Hotspot Navigation probe
   M12.P1-D3 verification script.

   DATABASE-FREE and NETWORK-FREE. Verifies, with fixed sanitized PASS/FAIL
   labels only:
     - the shared public/js/vr-hotspot-navigation.js helper loads through
       CommonJS (no global) AND as a browser script creating EXACTLY the one
       window.CampuSphereVrHotspotNavigation global;
     - exact guided Previous/Next/CAS-interior-Explore nav_url passthrough
       and validated Free Roam '/vr/<key>' construction;
     - native Pannellum scene-link decoration (type: 'scene', URL +
       attributes { target: '_self', aria-label }, plus the dedicated compact
       portal-ring CSS class; never a scene-navigation clickHandlerFunc; with
       no input or base-object mutation;
     - every malformed/external/traversal/query/fragment/wrong-type/
       wrong-mode/non-object case fails closed without throwing;
     - both VR views include the helper exactly once BEFORE viewer init,
       carry no duplicated window.location.href scene callback, keep the
       schedule integration separate, and keep the accessible
       server-rendered fallback links;
     - controllers/vrController.js normalizes Free Roam target keys through
       the existing isSafeSceneKey helper before JSON/fallback rendering.
   ======================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const failures = [];
function check(scope, label, ok) {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${scope} :: ${label}`);
  if (!ok) failures.push(`${scope} :: ${label}`);
}

// Run a fail-closed case; a thrown error is itself a failure.
function quiet(fn) {
  try { return { value: fn(), threw: false }; }
  catch (e) { return { value: undefined, threw: true }; }
}

/* ---------------- 1. module loading contracts ---------------- */
const HELPER_REL = 'public/js/vr-hotspot-navigation.js';
let helper = null;
{
  const globalsBefore = new Set(Object.keys(global));
  helper = require(path.join(ROOT, HELPER_REL));
  const leaked = Object.keys(global).filter((k) => !globalsBefore.has(k));
  check('load', 'CommonJS export provides navigation and decoration functions',
    !!helper &&
    typeof helper.resolveGuidedUrl === 'function' &&
    typeof helper.resolveFreeRoamUrl === 'function' &&
    typeof helper.decoratePannellumHotspot === 'function');
  check('load', 'Node require creates no global (no window shim leakage)',
    leaked.length === 0 && !('CampuSphereVrHotspotNavigation' in global));

  // Browser-global path: evaluate the raw source with a window sandbox and
  // no module binding in scope.
  const src = read(HELPER_REL);
  const win = {};
  const evaluate = quiet(() => { new Function('window', src)(win); return true; });
  const winKeys = Object.keys(win);
  check('load', 'browser evaluation creates exactly window.CampuSphereVrHotspotNavigation',
    evaluate.threw === false &&
    winKeys.length === 1 && winKeys[0] === 'CampuSphereVrHotspotNavigation' &&
    typeof win.CampuSphereVrHotspotNavigation.decoratePannellumHotspot === 'function');
  const reevaluate = quiet(() => { new Function('window', src)(win); return true; });
  check('load', 'repeated browser evaluation still yields the single global',
    reevaluate.threw === false && Object.keys(win).length === 1);
  check('load', 'helper source never logs, touches window.location, or uses HTML sinks',
    !/console\./.test(src) && !/window\.location/.test(src) &&
    !/innerHTML|insertAdjacentHTML|document\.write/.test(src));
}

const {
  resolveGuidedUrl,
  resolveFreeRoamUrl,
  decoratePannellumHotspot,
} = helper;
const LOC = { href: 'http://127.0.0.1/vr/to/1?step=24', origin: 'http://127.0.0.1' };
const guided = (nav_url) => ({ hotspot_type: 'scene', nav_url });
const roam = (target_scene_key) => ({ hotspot_type: 'scene', target_scene_key });

/* ---------------- 2. accepted guided/Free-Roam navigation ---------------- */
{
  const prevUrl = '/vr/to/153?step=23';
  const nextUrl = '/vr/routes/4?step=2';
  const exploreUrl = '/vr/scene-cas-1st-floor-2';
  check('accept', 'guided Previous nav_url is accepted exactly',
    resolveGuidedUrl(guided(prevUrl), LOC) === prevUrl);
  check('accept', 'guided Next nav_url is accepted exactly',
    resolveGuidedUrl(guided(nextUrl), LOC) === nextUrl);
  check('accept', 'guided CAS interior Explore nav_url is accepted exactly',
    resolveGuidedUrl(guided(exploreUrl), LOC) === exploreUrl);
  check('accept', 'an accepted nav_url is preserved byte-for-byte (never rebuilt)',
    resolveGuidedUrl(guided('/vr/to/9?step=1'), LOC) === '/vr/to/9?step=1');
  check('accept', 'guided resolution works without a locationLike argument',
    resolveGuidedUrl(guided(prevUrl)) === prevUrl && resolveGuidedUrl(guided(prevUrl), null) === prevUrl);
  check('accept', 'Free Roam constructs exactly /vr/<validated-key>',
    resolveFreeRoamUrl(roam('scene-cas-1st-floor-3'), LOC) === '/vr/scene-cas-1st-floor-3');
  check('accept', 'Free Roam accepts a multi-numeric key (scene-general-road-38-5)',
    resolveFreeRoamUrl(roam('scene-general-road-38-5'), LOC) === '/vr/scene-general-road-38-5');
  check('accept', 'Free Roam accepts a maximum-length (60) key',
    resolveFreeRoamUrl(roam('a'.repeat(60)), LOC) === '/vr/' + 'a'.repeat(60));
}

/* ---------------- 3. native Pannellum decoration ---------------- */
{
  const base = Object.freeze({ pitch: 3, yaw: -12, type: 'info', text: 'Enter CAS' });
  const hs = Object.freeze({ ...guided('/vr/scene-cas-1st-floor-2'), label: 'Enter CAS' });
  const baseSnapshot = JSON.stringify(base);
  const hsSnapshot = JSON.stringify(hs);
  const run = quiet(() => decoratePannellumHotspot(base, hs, 'guided', LOC));
  const cfg = run.value;
  check('pannellum', 'decoration succeeds without throwing on frozen inputs', run.threw === false && !!cfg);
  check('pannellum', 'decorated config uses the native URL contract',
    !!cfg && cfg.URL === '/vr/scene-cas-1st-floor-2');
  check('pannellum', 'decorated config carries same-tab and accessible-link attributes',
    !!cfg && !!cfg.attributes && cfg.attributes.target === '_self' &&
    cfg.attributes['aria-label'] === 'Enter CAS' &&
    Object.keys(cfg.attributes).length === 2);
  check('pannellum', 'no scene-navigation clickHandlerFunc is installed',
    !!cfg && !('clickHandlerFunc' in cfg) && !('clickHandlerArgs' in cfg));
  check('pannellum', 'validated navigation uses the dedicated compact scene-hotspot class',
    !!cfg && cfg.type === 'scene' && cfg.cssClass === 'campusphere-vr-scene-hotspot');
  check('pannellum', 'base tooltip fields are preserved on the copy',
    !!cfg && cfg.pitch === 3 && cfg.yaw === -12 && cfg.text === 'Enter CAS');
  check('pannellum', 'the returned config is a NEW object (no base mutation)',
    cfg !== base && JSON.stringify(base) === baseSnapshot);
  check('pannellum', 'the hotspot input is never mutated', JSON.stringify(hs) === hsSnapshot);

  const roamCfg = decoratePannellumHotspot({ type: 'info' }, roam('scene-cas-1st-floor-2'), 'free-roam', LOC);
  check('pannellum', 'free-roam mode decorates through the validated key',
    !!roamCfg && roamCfg.type === 'scene' &&
    roamCfg.URL === '/vr/scene-cas-1st-floor-2' &&
    roamCfg.cssClass === 'campusphere-vr-scene-hotspot' &&
    !!roamCfg.attributes && roamCfg.attributes.target === '_self' &&
    roamCfg.attributes['aria-label'] === 'Open 360 view');

  // Defense: navigation-capable keys on a hostile base never survive a
  // rejected decoration.
  const hostile = {
    type: 'info',
    cssClass: 'campusphere-vr-scene-hotspot',
    URL: 'https://evil.example/',
    attributes: { target: '_blank' },
    clickHandlerFunc: function () {},
    clickHandlerArgs: [1],
  };
  const rejected = decoratePannellumHotspot(hostile, guided('https://evil.example/vr/x'), 'guided', LOC);
  check('pannellum', 'a rejected decoration strips URL/attributes/clickHandlerFunc from the copy',
    !!rejected && !('URL' in rejected) && !('attributes' in rejected) &&
    !('cssClass' in rejected) &&
    !('clickHandlerFunc' in rejected) && !('clickHandlerArgs' in rejected) && rejected.type === 'info');
  check('pannellum', 'non-object baseConfig fails closed to null without throwing',
    quiet(() => decoratePannellumHotspot(null, hs, 'guided', LOC)).value === null &&
    quiet(() => decoratePannellumHotspot('x', hs, 'guided', LOC)).value === null);

  // Prototype-injection defense: an OWN '__proto__' data property on the base
  // (JSON.parse shape) must never reassign the copy's prototype — a rejected
  // decoration must not INHERIT navigation keys either.
  const protoBase = JSON.parse('{"type":"info","__proto__":{"URL":"https://evil.example/","clickHandlerFunc":1}}');
  const protoRejected = quiet(() => decoratePannellumHotspot(protoBase, guided('https://evil.example/vr/x'), 'guided', LOC));
  check('pannellum', 'an own __proto__ base property cannot smuggle inherited navigation into a rejected copy',
    protoRejected.threw === false && !!protoRejected.value &&
    Object.getPrototypeOf(protoRejected.value) === Object.prototype &&
    !('URL' in protoRejected.value) && !('clickHandlerFunc' in protoRejected.value));
  const protoAccepted = quiet(() => decoratePannellumHotspot(protoBase, hs, 'guided', LOC));
  check('pannellum', 'an own __proto__ base property never survives an accepted decoration either',
    protoAccepted.threw === false && !!protoAccepted.value &&
    Object.getPrototypeOf(protoAccepted.value) === Object.prototype &&
    protoAccepted.value.URL === '/vr/scene-cas-1st-floor-2' &&
    !Object.prototype.hasOwnProperty.call(protoAccepted.value, '__proto__'));
}

/* ---------------- 4. fail-closed matrix ---------------- */
{
  const rejectedGuidedUrls = [
    ['absolute http URL', 'http://127.0.0.1/vr/scene-a'],
    ['absolute https external URL', 'https://evil.example/vr/scene-a'],
    ['protocol-relative URL', '//evil.example/vr/scene-a'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['backslash path', '/vr\\scene-a'],
    ['windows-style path', 'C:\\vr\\scene-a'],
    ['embedded NUL control character', '/vr/scene-a\u0000'],
    ['embedded newline control character', '/vr/scene\na'],
    ['fragment on a scene URL', '/vr/scene-a#frag'],
    ['fragment on a step URL', '/vr/to/1?step=2#f'],
    ['dot-dot traversal', '/vr/../admin'],
    ['traversal inside the step form', '/vr/to/../1?step=2'],
    ['path outside /vr/', '/admin'],
    ['look-alike prefix', '/vrx/scene-a'],
    ['relative (unrooted) path', 'vr/scene-a'],
    ['uppercase prefix', '/VR/scene-a'],
    ['percent-encoded traversal', '/vr/%2e%2e/admin'],
    ['extra query parameter on a step URL', '/vr/to/1?step=2&x=1'],
    ['query parameter on a scene URL', '/vr/scene-a?x=1'],
    ['wrong query parameter name', '/vr/to/1?x=2'],
    ['missing step query', '/vr/to/1'],
    ['zero id', '/vr/to/0?step=1'],
    ['negative id', '/vr/to/-1?step=1'],
    ['decimal id', '/vr/to/1.5?step=1'],
    ['non-numeric id', '/vr/to/abc?step=1'],
    ['zero step', '/vr/to/1?step=0'],
    ['negative step', '/vr/to/1?step=-2'],
    ['zero-padded step', '/vr/to/1?step=02'],
    ['exponential step', '/vr/to/1?step=1e3'],
    ['empty step', '/vr/to/1?step='],
    ['uppercase scene key', '/vr/Scene-A'],
    ['double-hyphen scene key', '/vr/scene--a'],
    ['leading-hyphen scene key', '/vr/-scene'],
    ['trailing-hyphen scene key', '/vr/scene-'],
    ['bare /vr/ root', '/vr/'],
    ['bare /vr path', '/vr'],
    ['over-long (61) scene key', '/vr/' + 'a'.repeat(61)],
    ['over-long URL', '/vr/to/1?step=1' + ' '.repeat(200)],
  ];
  for (const [label, url] of rejectedGuidedUrls) {
    const r = quiet(() => resolveGuidedUrl(guided(url), LOC));
    check('fail-closed', `guided rejects ${label}`, r.threw === false && r.value === null);
  }
  const rejectedGuidedInputs = [
    ['non-string nav_url (number)', guided(42)],
    ['non-string nav_url (object)', guided({})],
    ['missing nav_url', { hotspot_type: 'scene' }],
    ['wrong hotspot type (info)', { hotspot_type: 'info', nav_url: '/vr/scene-a' }],
    ['wrong hotspot type (schedule)', { hotspot_type: 'schedule', nav_url: '/vr/scene-a' }],
    ['missing hotspot type', { nav_url: '/vr/scene-a' }],
    ['null hotspot', null],
    ['string hotspot', 'hotspot'],
    ['numeric hotspot', 7],
  ];
  for (const [label, input] of rejectedGuidedInputs) {
    const r = quiet(() => resolveGuidedUrl(input, LOC));
    check('fail-closed', `guided rejects ${label}`, r.threw === false && r.value === null);
  }
  check('fail-closed', 'guided rejects a non-object locationLike',
    quiet(() => resolveGuidedUrl(guided('/vr/scene-a'), 'http://x')).value === null &&
    quiet(() => resolveGuidedUrl(guided('/vr/scene-a'), 9)).value === null);

  const rejectedKeys = [
    ['uppercase key', 'Scene-A'],
    ['double hyphen', 'scene--a'],
    ['leading hyphen', '-a'],
    ['trailing hyphen', 'a-'],
    ['empty key', ''],
    ['over-long (61) key', 'a'.repeat(61)],
    ['space in key', 'a b'],
    ['slash in key', 'a/b'],
    ['backslash in key', 'a\\b'],
    ['dot in key', 'scene.k'],
    ['traversal key', '../x'],
    ['null key', null],
    ['numeric key', 42],
  ];
  for (const [label, key] of rejectedKeys) {
    const r = quiet(() => resolveFreeRoamUrl(roam(key), LOC));
    check('fail-closed', `Free Roam rejects ${label}`, r.threw === false && r.value === null);
  }
  check('fail-closed', 'Free Roam rejects wrong/missing hotspot types and non-objects',
    quiet(() => resolveFreeRoamUrl({ hotspot_type: 'info', target_scene_key: 'scene-a' }, LOC)).value === null &&
    quiet(() => resolveFreeRoamUrl({ target_scene_key: 'scene-a' }, LOC)).value === null &&
    quiet(() => resolveFreeRoamUrl(null, LOC)).value === null);
  check('fail-closed', 'Free Roam never falls back to nav_url or other fields',
    quiet(() => resolveFreeRoamUrl({ hotspot_type: 'scene', nav_url: '/vr/scene-a' }, LOC)).value === null);

  for (const mode of ['guided2', '', null, undefined, 'GUIDED', 'FREE-ROAM', 42]) {
    const r = quiet(() => decoratePannellumHotspot({ type: 'info' }, guided('/vr/scene-a'), mode, LOC));
    check('fail-closed', `unsupported mode ${JSON.stringify(String(mode))} yields a non-navigating copy`,
      r.threw === false && !!r.value && r.value.type === 'info' &&
      !('URL' in r.value) && !('cssClass' in r.value) && !('clickHandlerFunc' in r.value));
  }
}

/* ---------------- 5. view integration contracts ---------------- */
{
  const VIEWS = [
    ['views/vr-route.ejs', 'guided'],
    ['views/vr.ejs', 'free-roam'],
  ];
  for (const [rel, mode] of VIEWS) {
    const src = read(rel);
    const includes = src.match(/<script src="\/js\/vr-hotspot-navigation\.js"><\/script>/g) || [];
    check('views', `${rel} includes the helper exactly once`, includes.length === 1);
    check('views', `${rel} loads the helper before the inline viewer script`,
      includes.length === 1 &&
      src.indexOf('<script src="/js/vr-hotspot-navigation.js">') < src.indexOf('id="vrData"'));
    check('views', `${rel} has no window.location.href scene callback`,
      !src.includes('window.location.href'));
    check('views', `${rel} installs no clickHandlerFunc of its own`,
      !src.includes('clickHandlerFunc'));
    check('views', `${rel} decorates scene hotspots in '${mode}' mode`,
      src.includes(`decoratePannellumHotspot(hs, h, '${mode}', window.location)`));
    check('views', `${rel} does not install directional-arrow runtime machinery`,
      !src.includes('bindDirectionalHotspotArrows') && !src.includes('directionalHotspotCleanup'));
    check('views', `${rel} includes the shared nonce-protected scene marker styles`,
      (src.match(/include\('partials\/vr-scene-hotspot-styles'\)/g) || []).length === 1);
    check('views', `${rel} keeps the schedule integration separate (single-argument call)`,
      src.includes('scheduleUi.makePannellumHotspot(h)') &&
      !/makePannellumHotspot\(h,/.test(src));
  }
  const guidedView = read('views/vr-route.ejs');
  check('views', 'guided view keeps the accessible per-hotspot fallback link (nav_url)',
    guidedView.includes('class="vr-hotspot__explore" href="<%= h.nav_url %>"'));
  const roamView = read('views/vr.ejs');
  check('views', 'Free Roam view keeps the accessible fallback link (/vr/<target_scene_key>)',
    roamView.includes('class="vr-hotspot__go" href="/vr/<%= h.target_scene_key %>"'));
  const schedule = read('public/js/vr-schedule.js');
  check('views', 'vr-schedule.js remains schedule-only with no legacy navigation fallback',
    schedule.includes('window.CampuSphereVrSchedule') &&
    schedule.includes('function makePannellumHotspot(hotspot)') &&
    !schedule.includes('fallbackClickHandler') &&
    !schedule.includes('CampuSphereVrHotspotNavigation'));
  const sceneStyles = read('views/partials/vr-scene-hotspot-styles.ejs');
  check('views', 'scene styles keep a 44px target with a compact 24px portal ring and center dot',
    sceneStyles.includes('width: 44px') &&
    sceneStyles.includes('height: 44px') &&
    sceneStyles.includes('width: 24px') &&
    sceneStyles.includes('height: 24px') &&
    sceneStyles.includes('width: 6px') &&
    sceneStyles.includes('height: 6px') &&
    sceneStyles.includes('background: transparent'));
  check('views', 'scene styles provide focus, motion, and no arrow or external icon asset',
    sceneStyles.includes(':focus-visible') &&
    sceneStyles.includes('prefers-reduced-motion') &&
    !sceneStyles.includes('--campusphere-vr-arrow-angle') &&
    !/border-top\s*:|border-right\s*:/i.test(sceneStyles) &&
    !/transform\s*:\s*rotate/i.test(sceneStyles) &&
    !/url\s*\(/i.test(sceneStyles) &&
    !/data:image|iconify|emoji/i.test(sceneStyles));
}

/* ---------------- 6. controller normalization contract ---------------- */
{
  const ctrl = read('controllers/vrController.js');
  check('controller', 'vrController imports isSafeSceneKey from guidedVrResolution',
    /isSafeSceneKey,/.test(ctrl) && /require\(['"]\.\.\/services\/guidedVrResolution['"]\)/.test(ctrl));
  check('controller', 'normalizeHotspots nulls unsafe target keys through isSafeSceneKey',
    ctrl.includes('target_scene_key: isSafeSceneKey(h.target_scene_key) ? h.target_scene_key : null'));
  check('controller', 'the raw passthrough form is gone',
    !ctrl.includes('target_scene_key: h.target_scene_key || null'));
  const { isSafeSceneKey } = require(path.join(ROOT, 'services', 'guidedVrResolution.js'));
  check('controller', 'server isSafeSceneKey accepts the CAS interior keys',
    isSafeSceneKey('scene-cas-1st-floor-2') === true && isSafeSceneKey('scene-cas-1st-floor-3') === true);
  check('controller', 'server isSafeSceneKey rejects traversal/uppercase/over-long keys',
    isSafeSceneKey('../x') === false && isSafeSceneKey('Scene-A') === false &&
    isSafeSceneKey('a'.repeat(61)) === false && isSafeSceneKey('') === false);
  // Drift protection: the helper necessarily mirrors the server scene-key
  // regex, so BOTH implementations must agree across the full accepted and
  // rejected case list.
  const agreementKeys = [
    'scene-cas-1st-floor-2', 'scene-general-road-38-5', 'a'.repeat(60), 'a',
    'Scene-A', 'scene--a', '-a', 'a-', '', 'a'.repeat(61), 'a b', 'a/b',
    'a\\b', 'scene.k', '../x',
  ];
  check('controller', 'helper and server scene-key contracts agree across the shared case list',
    agreementKeys.every((key) =>
      (resolveFreeRoamUrl(roam(key), LOC) !== null) === isSafeSceneKey(key)));
}

/* ---------------- summary ---------------- */
if (failures.length === 0) {
  console.log('VR-HOTSPOT-NAVIGATION-PROBE OK: all checks passed.');
  process.exitCode = 0;
} else {
  console.error(`VR-HOTSPOT-NAVIGATION-PROBE FAILED: ${failures.length} check(s) did not pass:`);
  failures.forEach((f) => console.error('  - ' + f));
  process.exitCode = 1;
}
