export function canonicalBuildingName(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/*
 * Evaluate one successful /api/search payload without retaining or logging any
 * query/result value. A route row is permitted only when it resolves to the
 * exact target building. At least one building row for the exact target is
 * mandatory; a same-building route by itself is not sufficient.
 */
export function evaluateSearchPayload(target, payload) {
  const targetId = Number(target && target.id);
  const targetName = String(target && target.name || '').trim();
  const targetCanonical = canonicalBuildingName(targetName);
  if (!Number.isSafeInteger(targetId) || targetId <= 0 || !targetCanonical ||
      !payload || payload.success !== true || payload.query !== targetName ||
      !Array.isArray(payload.results)) {
    return {
      accepted: false,
      responseValid: false,
      exactFound: false,
      scoped: false,
      reason: 'invalid-response',
    };
  }

  let exactFound = false;
  let scoped = payload.results.length > 0;
  let resultShapeValid = true;

  for (const result of payload.results) {
    if (!result || (result.type !== 'building' && result.type !== 'route') || !result.building) {
      resultShapeValid = false;
      continue;
    }
    const buildingId = Number(result.building.id);
    const buildingCanonical = canonicalBuildingName(result.building.name);
    if (!Number.isSafeInteger(buildingId) || buildingId <= 0 || !buildingCanonical) {
      resultShapeValid = false;
      continue;
    }
    const sameTarget = buildingId === targetId && buildingCanonical === targetCanonical;
    if (result.type === 'building') {
      if (sameTarget) exactFound = true;
      else scoped = false;
      continue;
    }

    const routeId = Number(result.route && result.route.id);
    if (!Number.isSafeInteger(routeId) || routeId <= 0) {
      resultShapeValid = false;
      continue;
    }
    if (!sameTarget) scoped = false;
  }

  if (!resultShapeValid) {
    return {
      accepted: false,
      responseValid: false,
      exactFound,
      scoped: false,
      reason: 'invalid-response',
    };
  }
  if (!exactFound) {
    return {
      accepted: false,
      responseValid: true,
      exactFound: false,
      scoped,
      reason: 'missing-exact',
    };
  }
  if (!scoped) {
    return {
      accepted: false,
      responseValid: true,
      exactFound: true,
      scoped: false,
      reason: 'ambiguous',
    };
  }
  return {
    accepted: true,
    responseValid: true,
    exactFound: true,
    scoped: true,
    reason: 'accepted',
  };
}
