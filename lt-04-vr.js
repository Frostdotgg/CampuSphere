import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// Comma-separated HTTPS Cloudinary delivery URLs are supplied at run time.
// Do not put credentials, upload URLs, or private tokens in this file.
const URLS = (__ENV.VR_URLS || "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

const VUS = Number(__ENV.VR_VUS || 1);
const DURATION = __ENV.VR_DURATION || "10s";

const vrAssetOk = new Rate("vr_asset_ok");
const vrAssetDuration = new Trend("vr_asset_duration");

if (URLS.length < 2) {
  throw new Error(
    "Provide at least two Cloudinary delivery URLs in VR_URLS."
  );
}

if (URLS.some((url) => !/^https:\/\//i.test(url))) {
  throw new Error("VR_URLS must contain HTTPS delivery URLs only.");
}

if (!Number.isInteger(VUS) || VUS < 1) {
  throw new Error("VR_VUS must be a positive whole number.");
}

export const options = {
  scenarios: {
    vr_assets: {
      executor: "constant-vus",
      vus: VUS,
      duration: DURATION,
      gracefulStop: "10s",
    },
  },
  thresholds: {
    checks: ["rate==1.0"],
    http_req_failed: ["rate==0.0"],
    vr_asset_ok: ["rate==1.0"],
  },
};

export default function () {
  // Each VU requests every panorama in one batch, so the assets are fetched
  // concurrently for that simulated user.
  const requests = URLS.map((url, index) => [
    "GET",
    url,
    {
      timeout: "30s",
      tags: { asset: `panorama_${index + 1}` },
    },
  ]);

  const responses = http.batch(requests);

  responses.forEach((response, index) => {
    const ok = Boolean(
      response.status === 200 &&
        response.body &&
        response.body.length > 0
    );

    vrAssetOk.add(ok);
    vrAssetDuration.add(response.timings.duration);

    const result = {};
    result[`panorama_${index + 1} returned 200`] = () => ok;
    check(response, result);
  });

  // Keep the test controlled and avoid an uncontrolled tight request loop.
  sleep(1);
}
