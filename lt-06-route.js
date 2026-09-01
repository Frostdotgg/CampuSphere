import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// LT-06 is deliberately local-only. Run it against the Docker rehearsal,
// never against Production without a separately approved test window.
const BASE_URL = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const VUS = Number(__ENV.ROUTE_VUS || 50);
const DURATION = __ENV.ROUTE_DURATION || "30s";
const HTTP_TIMEOUT = __ENV.HTTP_TIMEOUT || "30s";
const SESSION_COOKIE = __ENV.K6_SESSION_COOKIE || "";
const REQUIRE_ARRIVAL = __ENV.ROUTE_REQUIRE_ARRIVAL !== "0";
const DIAGNOSTIC = __ENV.ROUTE_DIAGNOSTIC === "1";

// The default Docker rehearsal uses the Supabase route catalog, whose stable
// Guided-VR routes include these IDs. Override ROUTE_IDS when rehearsing a
// different backend/catalog (for example, a freshly seeded MySQL database).
const ROUTE_IDS = (__ENV.ROUTE_IDS || "34,30,26,19")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value) && value > 0);

const routeApiOk = new Rate("route_api_ok");
const routePageOk = new Rate("route_page_ok");
const routeSceneOk = new Rate("route_scene_ok");
const routePlaybackOk = new Rate("route_playback_ok");
const routePlaybackDuration = new Trend("route_playback_duration");
const routeSceneCount = new Trend("route_scene_count");

if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(BASE_URL)) {
  throw new Error(`Refusing non-local BASE_URL: ${BASE_URL}`);
}

if (!Number.isInteger(VUS) || VUS < 1) {
  throw new Error("ROUTE_VUS must be a positive whole number.");
}

if (ROUTE_IDS.length === 0) {
  throw new Error("Provide at least one positive route id in ROUTE_IDS.");
}

const headers = { Cookie: SESSION_COOKIE };

function jsonOrNull(response) {
  try {
    return response.json();
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

function validScene(scene) {
  return Boolean(
    scene &&
      typeof scene.scene_key === "string" &&
      scene.scene_key.length > 0 &&
      typeof scene.title === "string" &&
      scene.title.length > 0
  );
}

export const options = {
  maxRedirects: 0,
  scenarios: {
    route_playback: {
      executor: "constant-vus",
      vus: VUS,
      duration: DURATION,
      gracefulStop: "10s",
    },
  },
  thresholds: {
    checks: ["rate==1.0"],
    http_req_failed: ["rate==0.0"],
    route_api_ok: ["rate==1.0"],
    route_page_ok: ["rate==1.0"],
    route_scene_ok: ["rate==1.0"],
    route_playback_ok: ["rate==1.0"],
  },
};

export default function () {
  const routeId = ROUTE_IDS[__ITER % ROUTE_IDS.length];
  const startedAt = Date.now();
  const api = http.get(`${BASE_URL}/api/vr/routes/${routeId}`, {
    headers,
    redirects: 0,
    timeout: HTTP_TIMEOUT,
    tags: { surface: "vr-route-api", route_id: String(routeId) },
  });
  const payload = jsonOrNull(api);
  const route = payload && payload.route;
  const scenes = payload && Array.isArray(payload.scenes) ? payload.scenes : [];
  const path = payload && Array.isArray(payload.path) ? payload.path : [];

  const apiPass = Boolean(
    api.status === 200 &&
      payload &&
      payload.success === true &&
      route &&
      Number(route.id) === routeId &&
      path.length > 0 &&
      scenes.length > 0 &&
      scenes.every(validScene) &&
      (!REQUIRE_ARRIVAL || payload.destination_reached === true)
  );
  routeApiOk.add(apiPass);
  routeSceneCount.add(scenes.length);
  check(api, {
    "VR route API returned a complete route": () => apiPass,
  });

  let allPagesPass = apiPass;
  let firstPageDiagnostic = null;

  // A real guided playback opens the server-rendered viewer at each scene.
  // Keep the sequence bounded by the server-provided scene list.
  if (apiPass) {
    for (let index = 0; index < scenes.length; index += 1) {
      const scene = scenes[index];
      const step = index + 1;
      const page = http.get(`${BASE_URL}/vr/routes/${routeId}?step=${step}`, {
        headers,
        redirects: 0,
        timeout: HTTP_TIMEOUT,
        tags: { surface: "vr-route-page", route_id: String(routeId), step: String(step) },
      });
      const body = String(page.body || "");
      const pagePass = Boolean(
        page.status === 200 &&
          body.includes("Guided VR Route") &&
          (body.includes(scene.title) || body.includes(scene.scene_key))
      );
      routePageOk.add(pagePass);
      check(page, {
        "VR route scene page contains the expected scene": () => pagePass,
      });
      if (!pagePass) allPagesPass = false;
      if (!firstPageDiagnostic && !pagePass) {
        firstPageDiagnostic = responseDiagnostic(page);
      }
    }
  }

  const playbackPass = apiPass && allPagesPass;
  routeSceneOk.add(Boolean(apiPass && allPagesPass));
  routePlaybackOk.add(playbackPass);
  routePlaybackDuration.add(Date.now() - startedAt);
  check(api, {
    "VR route playback completed": () => playbackPass,
  });

  if (DIAGNOSTIC) {
    console.log(
      JSON.stringify({
        route_id: routeId,
        api: responseDiagnostic(api),
        path_nodes: path.length,
        scenes: scenes.length,
        destination_reached: payload ? payload.destination_reached === true : false,
        first_failed_page: firstPageDiagnostic,
      })
    );
  }

  // Model a user reading the current route step before advancing/restarting.
  sleep(1);
}
