const SUPPORTED_MODES = new Set(['vehicle', 'walking']);
const SUPPORTED_DIRECTIONS = new Set(['entry', 'exit']);

export function routeVariantKey(routeId, mode, direction) {
  return `${Number(routeId)}:${String(mode)}:${String(direction)}`;
}

function sceneKey(scene) {
  return String(scene && scene.scene_key || '').trim();
}

function sceneTitle(scene) {
  return String(scene && scene.title || '').trim();
}

function pathKey(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node).trim();
  if (!node || typeof node !== 'object') return '';
  return String(node.key || node.node_key || node.id || '').trim();
}

function pathSignature(path) {
  if (!Array.isArray(path)) return [];
  return path.map(pathKey);
}

function uniqueNonEmpty(values) {
  return values.length > 0 && values.every(Boolean) && new Set(values).size === values.length;
}

export function validateRoutePayload(routeId, mode, direction, payload) {
  const expectedRouteId = Number(routeId);
  const expectedMode = String(mode || '');
  const expectedDirection = String(direction || '');
  const route = payload && payload.route;
  const path = payload && payload.path;
  const scenes = payload && payload.scenes;
  const sceneKeys = Array.isArray(scenes) ? scenes.map(sceneKey) : [];
  const sceneTitles = Array.isArray(scenes) ? scenes.map(sceneTitle) : [];
  const pathKeys = pathSignature(path);
  const valid = Number.isSafeInteger(expectedRouteId) && expectedRouteId > 0 &&
    SUPPORTED_MODES.has(expectedMode) && SUPPORTED_DIRECTIONS.has(expectedDirection) &&
    payload && payload.success === true &&
    route && Number(route.id) === expectedRouteId &&
    String(payload.travel_mode || '') === expectedMode &&
    String(payload.direction || '') === expectedDirection &&
    Array.isArray(path) && path.length > 0 && uniqueNonEmpty(pathKeys) &&
    Array.isArray(scenes) && scenes.length > 0 &&
    uniqueNonEmpty(sceneKeys) && sceneTitles.every(Boolean) &&
    payload.destination_reached === true;

  return {
    accepted: Boolean(valid),
    reason: valid ? 'accepted' : 'invalid-route-sequence',
    routeId: expectedRouteId,
    mode: expectedMode,
    direction: expectedDirection,
    pathKeys,
    sceneKeys,
    sceneTitles,
    sceneCount: sceneKeys.length,
    destinationReached: Boolean(payload && payload.destination_reached === true),
  };
}

function embeddedVrData(body) {
  const match = String(body || '').match(
    /<script[^>]+id=["']vrData["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (_) {
    return null;
  }
}

function sceneProgress(body) {
  const match = String(body || '').match(/Scene\s+(\d+)\s+of\s+(\d+)/i);
  return match ? { step: Number(match[1]), total: Number(match[2]) } : null;
}

function nextHref(body) {
  const match = String(body || '').match(
    /id=["']vrNextBtn["'][^>]*href=["']([^"']+)["']/i
  );
  return match ? String(match[1]) : '';
}

export function validateScenePage(body, baseline, step, mode, direction) {
  const expectedStep = Number(step);
  const expectedTotal = Number(baseline && baseline.sceneCount);
  const data = embeddedVrData(body);
  const progress = sceneProgress(body);
  const expectedKey = baseline && Array.isArray(baseline.sceneKeys)
    ? String(baseline.sceneKeys[expectedStep - 1] || '')
    : '';
  const currentKey = String(data && data.scene && data.scene.scene_key || '');
  const href = nextHref(body);
  const final = expectedStep === expectedTotal;
  const nextExpected = `step=${expectedStep + 1}`;
  const modeExpected = `mode=${encodeURIComponent(String(mode || ''))}`;
  const directionExpected = direction === 'exit' ? 'direction=exit' : '';
  const progressValid = Boolean(
    progress && progress.step === expectedStep && progress.total === expectedTotal
  );
  const sceneValid = Boolean(data && data.scene && currentKey === expectedKey);
  const completionValid = final
    ? /Route complete/i.test(String(body || '')) && !href
    : Boolean(href && href.includes(nextExpected) && href.includes(modeExpected) &&
      (!directionExpected || href.includes(directionExpected)) &&
      !/Route complete/i.test(String(body || '')));

  const accepted = expectedStep >= 1 && expectedStep <= expectedTotal &&
    progressValid && sceneValid && completionValid;
  return {
    accepted,
    reason: accepted ? 'accepted' : 'scene-page-mismatch',
    step: expectedStep,
    total: expectedTotal,
    sceneKey: currentKey,
    progressValid,
    sceneValid,
    completionValid,
  };
}
