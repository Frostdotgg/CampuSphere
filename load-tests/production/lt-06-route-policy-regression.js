import { check } from 'k6';
import { validateRoutePayload, validateScenePage } from './lt-06-route-policy.js';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ['rate==1.0'] },
};

const routeId = 34;
const mode = 'walking';
const direction = 'exit';
const sceneA = { scene_key: 'scene-a', title: 'Scene A' };
const sceneB = { scene_key: 'scene-b', title: 'Scene B' };
const path = ['main-gate', 'destination'];

function routePayload(overrides = {}) {
  return {
    success: true,
    travel_mode: mode,
    direction,
    route: { id: routeId },
    path,
    scenes: [sceneA, sceneB],
    destination_reached: true,
    ...overrides,
  };
}

function page(step, sceneKey, final = false, next = '') {
  const nextMarkup = next
    ? `<a class="vr-btn" id="vrNextBtn" href="/vr/routes/${routeId}?mode=${mode}&direction=${direction}&step=${step + 1}">Next scene</a>`
    : '';
  const complete = final ? '<div>Route complete</div>' : '';
  return `<span>Scene ${step} of 2</span><script id="vrData" type="application/json">${JSON.stringify({ scene: { scene_key: sceneKey } })}</script>${nextMarkup}${complete}`;
}

export default function () {
  const valid = validateRoutePayload(routeId, mode, direction, routePayload());
  const wrongRoute = validateRoutePayload(99, mode, direction, routePayload());
  const wrongMode = validateRoutePayload(routeId, 'vehicle', direction, routePayload());
  const incomplete = validateRoutePayload(routeId, mode, direction, routePayload({ destination_reached: false }));
  const duplicate = validateRoutePayload(routeId, mode, direction, routePayload({ scenes: [sceneA, sceneA] }));
  const validPage = validateScenePage(page(1, 'scene-a', false, 'next'), valid, 1, mode, direction);
  const validFinal = validateScenePage(page(2, 'scene-b', true), valid, 2, mode, direction);
  const missingPage = validateScenePage(page(2, 'scene-a', true), valid, 2, mode, direction);
  const droppedNext = validateScenePage(page(1, 'scene-a', false), valid, 1, mode, direction);
  const earlyComplete = validateScenePage(page(1, 'scene-a', true), valid, 1, mode, direction);

  check({ valid, wrongRoute, wrongMode, incomplete, duplicate, validPage, validFinal, missingPage, droppedNext, earlyComplete }, {
    'valid route sequence is accepted': (value) => value.valid.accepted === true,
    'wrong route id is rejected': (value) => value.wrongRoute.accepted === false,
    'wrong travel mode is rejected': (value) => value.wrongMode.accepted === false,
    'incomplete destination is rejected': (value) => value.incomplete.accepted === false,
    'duplicate scene is rejected': (value) => value.duplicate.accepted === false,
    'valid intermediate scene page is accepted': (value) => value.validPage.accepted === true,
    'valid final scene page is accepted': (value) => value.validFinal.accepted === true,
    'wrong scene key is rejected': (value) => value.missingPage.accepted === false,
    'missing next scene is rejected': (value) => value.droppedNext.accepted === false,
    'early completion is rejected': (value) => value.earlyComplete.accepted === false,
  });
}
