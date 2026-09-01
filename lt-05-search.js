import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const VUS = Number(__ENV.SEARCH_VUS || 50);
const DURATION = __ENV.SEARCH_DURATION || "30s";
const HTTP_TIMEOUT = __ENV.HTTP_TIMEOUT || "30s";
const SESSION_COOKIE = __ENV.K6_SESSION_COOKIE || "";

const QUERIES = (__ENV.SEARCH_QUERIES ||
  "Academic Building,Administration Building,Library Building,Gymnasium")
  .split(",")
  .map((query) => query.trim())
  .filter(Boolean);

const buildingsPageOk = new Rate("buildings_page_ok");
const mapPageOk = new Rate("map_page_ok");
const directoryOk = new Rate("directory_ok");
const searchOk = new Rate("search_ok");
const searchMatchOk = new Rate("search_match_ok");
const searchDuration = new Trend("search_duration");
const DIAGNOSTIC = __ENV.SEARCH_DIAGNOSTIC === "1";
let diagnosticLogged = false;

if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(BASE_URL)) {
  throw new Error(`Refusing non-local BASE_URL: ${BASE_URL}`);
}

if (!Number.isInteger(VUS) || VUS < 1) {
  throw new Error("SEARCH_VUS must be a positive whole number.");
}

if (QUERIES.length === 0) {
  throw new Error("Provide at least one building name in SEARCH_QUERIES.");
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
    building_search: {
      executor: "constant-vus",
      vus: VUS,
      duration: DURATION,
      gracefulStop: "10s",
    },
  },
  thresholds: {
    checks: ["rate==1.0"],
    http_req_failed: ["rate==0.0"],
    buildings_page_ok: ["rate==1.0"],
    map_page_ok: ["rate==1.0"],
    directory_ok: ["rate==1.0"],
    search_ok: ["rate==1.0"],
    search_match_ok: ["rate==1.0"],
  },
};

export default function () {
  const query = QUERIES[__ITER % QUERIES.length];
  const encodedQuery = encodeURIComponent(query);

  // These requests are issued together to represent concurrent users opening
  // the Buildings page and Campus Map while searching the same catalog.
  const [buildingsPage, mapPage, directory, search] = http.batch([
    [
      "GET",
      `${BASE_URL}/buildings`,
      null,
      { headers, redirects: 0, timeout: HTTP_TIMEOUT, tags: { surface: "buildings-page" } },
    ],
    [
      "GET",
      `${BASE_URL}/map`,
      null,
      { headers, redirects: 0, timeout: HTTP_TIMEOUT, tags: { surface: "map-page" } },
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
  const buildingsPagePass =
    buildingsPage.status === 200 &&
    buildingsPage.body.includes("buildingsData") &&
    normalize(buildingsPage.body).includes(normalize(query));
  buildingsPageOk.add(buildingsPagePass);
  check(buildingsPage, {
    "Buildings page returned the catalog": () => buildingsPagePass,
  });

  const mapPagePass =
    mapPage.status === 200 &&
    Array.isArray(mapBuildings) &&
    mapBuildings.length > 0 &&
    mapBuildings.every((building) =>
      Number.isSafeInteger(Number(building.id)) &&
      Number(building.id) > 0 &&
      typeof building.name === "string" &&
      Number.isFinite(Number(building.lat)) &&
      Number.isFinite(Number(building.lng))
    );
  mapPageOk.add(mapPagePass);
  check(mapPage, {
    "Map page returned 200": () => mapPagePass,
  });

  const directoryPayload = jsonOrNull(directory);
  const directoryPass =
    directory.status === 200 &&
    directoryPayload &&
    directoryPayload.success === true &&
    Array.isArray(directoryPayload.buildings) &&
    directoryPayload.buildings.length > 0 &&
    directoryPayload.buildings.every((building) =>
      Number.isSafeInteger(Number(building.id)) &&
      Number(building.id) > 0 &&
      typeof building.name === "string" &&
      Number.isFinite(Number(building.lat)) &&
      Number.isFinite(Number(building.lng))
    );
  directoryOk.add(Boolean(directoryPass));
  check(directory, {
    "Directory returned valid building markers": () => Boolean(directoryPass),
  });

  const searchPayload = jsonOrNull(search);
  const results = searchPayload && Array.isArray(searchPayload.results)
    ? searchPayload.results
    : [];
  const queryNeedle = normalize(query);
  const hasMatchingBuilding = results.some((result) =>
    result &&
    result.type === "building" &&
    result.building &&
    normalize(result.building.name).includes(queryNeedle)
  );
  const searchPass =
    search.status === 200 &&
    searchPayload &&
    searchPayload.success === true &&
    Array.isArray(searchPayload.results);
  const searchMatchPass = Boolean(searchPass && hasMatchingBuilding);

  searchOk.add(Boolean(searchPass));
  searchMatchOk.add(searchMatchPass);
  searchDuration.add(search.timings.duration);

  check(search, {
    "Map search returned 200": () => Boolean(searchPass),
    "Map search returned the requested building": () => searchMatchPass,
  });

  if (DIAGNOSTIC && !diagnosticLogged) {
    console.log(JSON.stringify({
      query,
      buildings_page: responseDiagnostic(buildingsPage),
      map_page: responseDiagnostic(mapPage),
      directory: responseDiagnostic(directory),
      search: responseDiagnostic(search),
      embedded_map_buildings: Array.isArray(mapBuildings) ? mapBuildings.length : null,
    }));
    diagnosticLogged = true;
  }

  // Keep the local test controlled rather than creating an unlimited tight loop.
  sleep(1);
}
