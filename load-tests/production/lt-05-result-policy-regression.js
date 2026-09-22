import { check } from 'k6';
import { evaluateSearchPayload } from './lt-05-result-policy.js';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ['rate==1.0'] },
};

const target = { id: 11, name: 'Academic Building I' };
const exactBuilding = {
  type: 'building',
  matchedOn: 'name',
  building: { id: 11, name: 'Academic Building I' },
};
const sameBuildingRoute = {
  type: 'route',
  matchedOn: 'route_destination',
  building: { id: 11, name: 'Academic Building I' },
  route: { id: 101, title: 'Main Gate to Academic Building I' },
};

function payload(results, query = target.name) {
  return { success: true, query, results };
}

export default function () {
  const exactOnly = evaluateSearchPayload(target, payload([exactBuilding]));
  const exactAndRoute = evaluateSearchPayload(target, payload([exactBuilding, sameBuildingRoute]));
  const siblingBuilding = evaluateSearchPayload(target, payload([
    exactBuilding,
    { type: 'building', matchedOn: 'name', building: { id: 12, name: 'Academic Building II' } },
  ]));
  const unrelatedRoute = evaluateSearchPayload(target, payload([
    exactBuilding,
    {
      type: 'route',
      matchedOn: 'route_title',
      building: { id: 13, name: 'Academic Building III' },
      route: { id: 103, title: 'Academic Building I corridor' },
    },
  ]));
  const routeWithoutBuilding = evaluateSearchPayload(target, payload([sameBuildingRoute]));
  const invalidRoute = evaluateSearchPayload(target, payload([
    exactBuilding,
    { ...sameBuildingRoute, route: { id: 0 } },
  ]));
  const wrongEcho = evaluateSearchPayload(target, payload([exactBuilding], 'Academic Building'));
  const malformed = evaluateSearchPayload(target, { success: true, query: target.name, results: null });

  check({
    exactOnly,
    exactAndRoute,
    siblingBuilding,
    unrelatedRoute,
    routeWithoutBuilding,
    invalidRoute,
    wrongEcho,
    malformed,
  }, {
    'exact building result is accepted': (value) => value.exactOnly.accepted === true,
    'same-building route result is accepted': (value) => value.exactAndRoute.accepted === true,
    'substring sibling building is rejected as ambiguous': (value) =>
      value.siblingBuilding.reason === 'ambiguous',
    'route associated with another building is rejected as ambiguous': (value) =>
      value.unrelatedRoute.reason === 'ambiguous',
    'same-building route without the exact building row is rejected': (value) =>
      value.routeWithoutBuilding.reason === 'missing-exact',
    'invalid route shape is rejected as an invalid response': (value) =>
      value.invalidRoute.reason === 'invalid-response',
    'query echo mismatch is rejected as an invalid response': (value) =>
      value.wrongEcho.reason === 'invalid-response',
    'malformed result collection is rejected as an invalid response': (value) =>
      value.malformed.reason === 'invalid-response',
  });
}
