'use strict';

/* ========================================
   CampuSphere — Cloudinary server-only config boundary
   (Milestone 10, Section 10.2: Cloudinary Env, Config, and Secret Boundary)

   Cloudinary is the media-DELIVERY target for campus images and 360-degree VR
   panoramas (Milestone 10). This module is the single SERVER-ONLY source of
   truth for two SAFE facts:
     1. whether Cloudinary delivery is configured (availability / status), and
     2. the approved PUBLIC delivery host / origin.

   It is a CONFIG BOUNDARY only — it performs no media work. URL validation and
   CSP/PWA host wiring (10.4), VR panorama runtime wiring (10.5), and admin media
   workflows (10.6) are deferred to their own sections and have no consumer here
   yet.

   Hard rules (do NOT relax):
   - SERVER-ONLY. Never require this from an EJS template, anything under
     public/, a browser/window global, res.locals, or app.locals.
   - The three Cloudinary variables are server-only configuration:
       CLOUDINARY_CLOUD_NAME   - PUBLIC delivery metadata (it appears in every
                                 https://res.cloudinary.com/<cloud_name>/... URL)
                                 but is kept server-side with the rest of the
                                 Cloudinary config;
       CLOUDINARY_API_KEY      - SECRET;
       CLOUDINARY_API_SECRET   - SECRET.
   - This module NEVER returns, logs, or otherwise exposes the VALUE of any of
     the three variables. It only derives and returns a boolean "configured"
     status from their presence.
   - No Cloudinary SDK import, no network / Admin API call, no live credential
     check, no npm dependency. Missing/blank config must NOT throw — it simply
     reports "not configured" so local development, the MySQL fallback, the
     Supabase runtime switches, sessions, OAuth, CSRF, CSP, PWA, and the QA
     gates all keep working unchanged.
   ======================================== */

// Approved Cloudinary delivery host + origin (PUBLIC, not a secret). Exposed as
// constants so later sections wire a single source of truth into URL validation
// (10.4) and CSP / service-worker host policy (10.4) instead of hardcoding the
// host string in several places.
const CLOUDINARY_DELIVERY_HOST = 'res.cloudinary.com';
const CLOUDINARY_DELIVERY_ORIGIN = 'https://' + CLOUDINARY_DELIVERY_HOST;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

// True only when all three server-only Cloudinary variables are present and
// non-empty. Returns a BOOLEAN only — never any variable value. Safe to call
// when Cloudinary is unconfigured (returns false); callers branch on this
// status without ever reading the secrets themselves.
function isCloudinaryConfigured() {
  return (
    isNonEmptyString(process.env.CLOUDINARY_CLOUD_NAME) &&
    isNonEmptyString(process.env.CLOUDINARY_API_KEY) &&
    isNonEmptyString(process.env.CLOUDINARY_API_SECRET)
  );
}

module.exports = {
  CLOUDINARY_DELIVERY_HOST,
  CLOUDINARY_DELIVERY_ORIGIN,
  isCloudinaryConfigured,
};
