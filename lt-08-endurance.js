import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// LT-08 is a sustained, representative authenticated read workload. It is
// deliberately local-only; Production testing requires a separately approved
// window and a Production-safe test plan.
const BASE_URL = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const VUS = Number(__ENV.ENDURANCE_VUS || 50);
const DURATION = __ENV.ENDURANCE_DURATION || "10m";
const HTTP_TIMEOUT = __ENV.HTTP_TIMEOUT || "30s";
const SESSION_COOKIE = __ENV.K6_SESSION_COOKIE || "";
const DIAGNOSTIC = __ENV.ENDURANCE_DIAGNOSTIC === "1";

const ROUTE_IDS = (__ENV.ENDURANCE_ROUTE_IDS || "34,30,26,19")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value) && value > 0);

const SEARCH_QUERIES = (__ENV.ENDURANCE_SEARCH_QUERIES ||
  "Academic Building I,Academic Building IV,Administration Building,Library Building")
  .split(",")
  .map((query) => query.trim())
  .filter(Boolean);

const mapOk = new Rate("endurance_map_ok");
const buildingsPageOk = new Rate("endurance_buildings_page_ok");
const directoryOk = new Rate("endurance_directory_ok");
const searchOk = new Rate("endurance_search_ok");
const searchMatchOk = new Rate("endurance_search_match_ok");
const routeApiOk = new Rate("endurance_route_api_ok");
const routePageOk = new Rate("endurance_route_page_ok");
const iterationOk = new Rate("endurance_iteration_ok");
const iterationDuration = new Trend("endurance_iteration_duration");

if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(BASE_URL)) {
  throw new Error(`Refusing non-local BASE_URL: ${BASE_URL}`);
}

if (!Number.isInteger(VUS) || VUS < 1) {
  throw new Error("ENDURANCE_VUS must be a positive whole number.");
}

if (ROUTE_IDS.length === 0) {
  throw new Error("Provide at least one positive route id in ENDURANCE_ROUTE_IDS.");
}

if (SEARCH_QUERIES.length === 0) {
  throw new Error("Provide at least one value in ENDURANCE_SEARCH_QUERIES.");
}

const headers = SESSION_COOKIE ? { Cookie: SESSION_COOKIE } : {};

function normalize(value) {
  return String(value == null ? "" : value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function jsonOrNull(response) {
  try {
    return response.json();
  } catch (_) {
    return null;
  }
}

function embeddedBuildingsOrNull(body) {
  const match = String(body || "").match(
    /<script[^>]+id=["']buildingsData["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed) ? parsed : null;
  } catch (_) {
    return null;
  }
}

function validBuilding(building) {
  return Boolean(
    building &&
      Number.isSafeInteger(Number(building.id)) &&
      Number(building.id) > 0 &&
      typeof building.name === "string" &&
      Number.isFinite(Number(building.lat)) &&
      Number.isFinite(Number(building.lng))
  );
}

function responseDiagnostic(response) {
  return {
    status: response.status,
    error: response.error || "",
    error_code: response.error_code || 0,
  };
}

export const options = {
  maxRedirects: 0,
  scenarios: {
    endurance: {
      executor: "constant-vus",
      vus: VUS,
      duration: DURATION,
      gracefulStop: "10s",
    },
  },
  thresholds: {
    checks: ["rate==1.0"],
    http_req_failed: ["rate==0.0"],
    endurance_map_ok: ["rate==1.0"],
    endurance_buildings_page_ok: ["rate==1.0"],
    endurance_directory_ok: ["rate==1.0"],
    endurance_search_ok: ["rate==1.0"],
    endurance_search_match_ok: ["rate==1.0"],
    endurance_route_api_ok: ["rate==1.0"],
    endurance_route_page_ok: ["rate==1.0"],
    endurance_iteration_ok: ["rate==1.0"],
  },
};

export default function () {
  const startedAt = Date.now();
  const query = SEARCH_QUERIES[__ITER % SEARCH_QUERIES.length];
  const routeId = ROUTE_IDS[__ITER % ROUTE_IDS.length];
  const encodedQuery = encodeURIComponent(query);

  // Core online surfaces are opened together, representing a user returning
  // to the map, checking the directory, and searching for a building.
  const [mapPage, buildingsPage, directory, search] = http.batch([
    [
      "GET",
      `${BASE_URL}/map`,
      null,
      { headers, redirects: 0, timeout: HTTP_TIMEOUT, tags: { surface: "map-page" } },
    ],
    [
      "GET",
      `${BASE_URL}/buildings`,
      null,
      { headers, redirects: 0, timeout: HTTP_TIMEOUT, tags: { surface: "buildings-page" } },
    ],
    [
      "GET",
      `${BASE_URL}/api/buildings`,
      null,
      { headers, redirects: 0, timeout: HTTP_TIMEOUT, tags: { surface: "directory-api" } },
    ],
    [
      "GET",
      `${BASE_URL}/api/search?q=${encodedQuery}`,
      null,
      { headers, redirects: 0, timeout: HTTP_TIMEOUT, tags: { surface: "map-search" } },
    ],
  ]);

  const mapBuildings = embeddedBuildingsOrNull(mapPage.body);
  const mapPass =
    mapPage.status === 200 &&
    Array.isArray(mapBuildings) &&
    mapBuildings.length > 0 &&
    mapBuildings.every(validBuilding);
  mapOk.add(mapPass);
  check(mapPage, { "Endurance map returned valid building data": () => mapPass });

  const buildingsData = embeddedBuildingsOrNull(buildingsPage.body);
  const buildingsPass =
    buildingsPage.status === 200 &&
    Array.isArray(buildingsData) &&
    buildingsData.length > 0 &&
    buildingsData.some((building) => normalize(building.name).includes(normalize(query)));
  buildingsPageOk.add(buildingsPass);
  check(buildingsPage, { "Endurance Buildings page returned the catalog": () => buildingsPass });

  const directoryPayload = jsonOrNull(directory);
  const directoryPass =
    directory.status === 200 &&
    directoryPayload &&
    directoryPayload.success === true &&
    Array.isArray(directoryPayload.buildings) &&
    directoryPayload.buildings.length > 0 &&
    directoryPayload.buildings.every(validBuilding);
  directoryOk.add(Boolean(directoryPass));
  check(directory, { "Endurance directory returned valid markers": () => Boolean(directoryPass) });

  const searchPayload = jsonOrNull(search);
  const searchResults = searchPayload && Array.isArray(searchPayload.results)
    ? searchPayload.results
    : [];
  const searchPass =
    search.status === 200 &&
    searchPayload &&
    searchPayload.success === true &&
    Array.isArray(searchPayload.results);
  const searchMatchPass = Boolean(
    searchPass &&
    searchResults.some((result) =>
      result &&
      result.type === "building" &&
      result.building &&
      normalize(result.building.name).includes(normalize(query))
    )
  );
  searchOk.add(Boolean(searchPass));
  searchMatchOk.add(searchMatchPass);
  check(search, {
    "Endurance search returned JSON": () => Boolean(searchPass),
    "Endurance search matched the requested building": () => searchMatchPass,
  });

  // Include one guided-route API request and its initial server-rendered scene
  // in the sustained workload. LT-06 already exercises every route step.
  const routeApi = http.get(`${BASE_URL}/api/vr/routes/${routeId}`, {
    headers,
    redirects: 0,
    timeout: HTTP_TIMEOUT,
    tags: { surface: "vr-route-api", route_id: String(routeId) },
  });
  const routePayload = jsonOrNull(routeApi);
  const route = routePayload && routePayload.route;
  const scenes = routePayload && Array.isArray(routePayload.scenes)
    ? routePayload.scenes
    : [];
  const routePass = Boolean(
    routeApi.status === 200 &&
    routePayload &&
    routePayload.success === true &&
    route &&
    Number(route.id) === routeId &&
    Array.isArray(routePayload.path) &&
    routePayload.path.length > 0 &&
    scenes.length > 0 &&
    scenes.every((scene) =>
      scene &&
      typeof scene.scene_key === "string" &&
      scene.scene_key.length > 0 &&
      typeof scene.title === "string" &&
      scene.title.length > 0
    ) &&
    routePayload.destination_reached === true
  );
  routeApiOk.add(routePass);
  check(routeApi, { "Endurance route API returned a complete route": () => routePass });

  let routePagePass = false;
  if (routePass) {
    const firstScene = scenes[0];
    const routePage = http.get(`${BASE_URL}/vr/routes/${routeId}?step=1`, {
      headers,
      redirects: 0,
      timeout: HTTP_TIMEOUT,
      tags: { surface: "vr-route-page", route_id: String(routeId), step: "1" },
    });
    const body = String(routePage.body || "");
    routePagePass = Boolean(
      routePage.status === 200 &&
      body.includes("Guided VR Route") &&
      (body.includes(firstScene.title) || body.includes(firstScene.scene_key))
    );
    routePageOk.add(routePagePass);
    check(routePage, { "Endurance route page returned the first scene": () => routePagePass });
  }

  const pass = Boolean(
    mapPass &&
    buildingsPass &&
    directoryPass &&
    searchPass &&
    searchMatchPass &&
    routePass &&
    routePagePass
  );
  iterationOk.add(pass);
  iterationDuration.add(Date.now() - startedAt);
  check(mapPage, { "Endurance iteration completed": () => pass });

  if (DIAGNOSTIC && __ITER === 0) {
    console.log(JSON.stringify({
      query,
      route_id: routeId,
      map: responseDiagnostic(mapPage),
      buildings_page: responseDiagnostic(buildingsPage),
      directory: responseDiagnostic(directory),
      search: responseDiagnostic(search),
      route_api: responseDiagnostic(routeApi),
      scenes: scenes.length,
    }));
  }

  // Keep the loop user-like and bounded during the long run.
  sleep(1);
}
