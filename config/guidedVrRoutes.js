"use strict";

/* ========================================
   CampuSphere — Guided VR route catalog (BE.4)

   Frozen, source-controlled catalog of guided VR walkthroughs that are
   defined by STABLE NATURAL IDENTITIES only:

     - destination_name       canonical building display name (matched via
                              services/routeAvailability.canonicalKey by the
                              caller — this module performs no normalization
                              of its own so there is exactly ONE canonical-name
                              function in the codebase);
     - destination_node_key   the route-graph node the walkthrough must end at;
     - arrival_scene_key      the ONLY scene whose presence as the final
                              verified step counts as truthful arrival;
     - scene_keys             the owner-approved ordered panorama sequence.

   HARD RULES:
   - Natural keys only. This module must NEVER contain backend numeric ids
     (vr_scenes.id, buildings.id, route_nodes.id are backend-local and must
     never be compared or copied across MySQL/Supabase).
   - No imports, no env reads, no side effects — pure frozen data, safe to
     require from any layer.
   - The catalog describes the GUIDED walkthrough only. Post-arrival interior
     scenes (e.g. scene-cas-1st-floor-2 / -3) are deliberately NOT steps; they
     stay reachable through the arrival scene's own hotspots in Free Roam.
   - Adding a destination here does not by itself make it arrivable: the
     runtime still verifies every scene key and every forward/reverse
     directional link in the ACTIVE VR data source and truthfully reports
     partial coverage when the chain is incomplete.
   - A destination listed in DEFERRED_GUIDED_VR_DESTINATIONS remains routable
     on the campus map, but guided VR must fail closed with an explicit
     unavailable state until the owner supplies and approves its panorama
     sequence. A destination must never appear in both collections.
   ======================================== */

const GUIDED_VR_ROUTES = Object.freeze([
  Object.freeze({
    destination_name: "Academic Building III",
    destination_node_key: "acad-3",
    arrival_scene_key: "scene-cas-1st-floor",
    scene_keys: Object.freeze([
      "scene-guard-house",
      "scene-general-road-10",
      "scene-general-road-11",
      "scene-general-road-12",
      "scene-general-road-13",
      "scene-general-road-14",
      "scene-general-road-15",
      "scene-duran-1st-floor-13",
      "scene-general-road-19",
      "scene-general-road-20",
      "scene-general-road-21",
      "scene-general-road-22",
      "scene-general-road-23",
      "scene-general-road-27",
      "scene-general-road-28",
      "scene-general-road-29",
      "scene-general-road-30",
      "scene-general-road-31",
      "scene-general-road-32",
      "scene-general-road-33",
      "scene-general-road-33-5",
      "scene-general-road-37",
      "scene-general-road-38",
      "scene-general-road-38-5",
      "scene-general-road-39",
      "scene-cas-1st-floor",
    ]),
  }),
  Object.freeze({
    destination_name: "Academic Building IV",
    destination_node_key: "ccs",
    arrival_scene_key: "scene-ccs-1st-floor",
    scene_keys: Object.freeze([
      "scene-guard-house",
      "scene-general-road-10",
      "scene-general-road-11",
      "scene-general-road-12",
      "scene-general-road-13",
      "scene-general-road-14",
      "scene-general-road-15",
      "scene-duran-1st-floor-13",
      "scene-general-road-19",
      "scene-general-road-20",
      "scene-general-road-21",
      "scene-general-road-22",
      "scene-general-road-23",
      "scene-general-road-27",
      "scene-general-road-28",
      "scene-general-road-29",
      "scene-general-road-30",
      "scene-general-road-31",
      "scene-general-road-32",
      "scene-general-road-33",
      "scene-general-road-33-5",
      "scene-general-road-37",
      "scene-general-road-38",
      "scene-general-road-94",
      "scene-ccs-1st-floor",
    ]),
  }),

  Object.freeze({
    destination_name: "Academic Building VI",
    destination_node_key: "acad-6",
    arrival_scene_key: "scene-chs-1st-floor-001",
    scene_keys: Object.freeze([
      "scene-guard-house",
      "scene-general-road-10",
      "scene-general-road-11",
      "scene-general-road-12",
      "scene-general-road-13",
      "scene-general-road-14",
      "scene-general-road-15",
      "scene-duran-1st-floor-13",
      "scene-general-road-19",
      "scene-general-road-20",
      "scene-general-road-21",
      "scene-general-road-22",
      "scene-general-road-23",
      "scene-general-road-27",
      "scene-general-road-28",
      "scene-general-road-29",
      "scene-general-road-30",
      "scene-general-road-31",
      "scene-general-road-32",
      "scene-general-road-33",
      "scene-general-road-33-5",
      "scene-general-road-37",
      "scene-general-road-38",
      "scene-general-road-94",
      "scene-general-road-93",
      "scene-general-road-92",
      "scene-general-road-91",
      "scene-chs-1st-floor-001",
    ]),
  }),

  Object.freeze({
    destination_name: "Academic Building V",
    destination_node_key: "acad-5",
    arrival_scene_key: "scene-acad-5-1st-floor-7",
    scene_keys: Object.freeze([
      "scene-guard-house",
      "scene-general-road-10",
      "scene-general-road-11",
      "scene-general-road-12",
      "scene-general-road-13",
      "scene-general-road-14",
      "scene-general-road-15",
      "scene-duran-1st-floor-13",
      "scene-general-road-19",
      "scene-general-road-20",
      "scene-general-road-21",
      "scene-general-road-22",
      "scene-general-road-23",
      "scene-general-road-27",
      "scene-general-road-28",
      "scene-general-road-29",
      "scene-general-road-30",
      "scene-general-road-31",
      "scene-general-road-32",
      "scene-general-road-33",
      "scene-general-road-33-5",
      "scene-general-road-37",
      "scene-general-road-38",
      "scene-general-road-38-5",
      "scene-general-road-39",
      "scene-general-road-41",
      "scene-general-road-39",
      "scene-general-road-41",
      "scene-general-road-42",
      "scene-general-road-43",
      "scene-general-road-44",
      "scene-general-road-45",
      "scene-general-road-46",
      "scene-general-road-47",
      "scene-general-road-48",
      "scene-general-road-49",
      "scene-acad-5-1st-floor-7",
    ]),
  }),

  Object.freeze({
    destination_name: "Green Building",
    destination_node_key: "green",
    arrival_scene_key: "scene-green-1st-floor-7",
    scene_keys: Object.freeze([
      "scene-guard-house",
      "scene-general-road-10",
      "scene-general-road-11",
      "scene-general-road-12",
      "scene-general-road-13",
      "scene-general-road-14",
      "scene-general-road-15",
      "scene-duran-1st-floor-13",
      "scene-general-road-19",
      "scene-general-road-20",
      "scene-general-road-21",
      "scene-general-road-22",
      "scene-general-road-23",
      "scene-general-road-27",
      "scene-general-road-28",
      "scene-general-road-29",
      "scene-general-road-30",
      "scene-general-road-31",
      "scene-general-road-32",
      "scene-general-road-33",
      "scene-general-road-34",
      "scene-general-road-35",
      "scene-green-1st-floor-7",
    ]),
  }),
]);

const DEFERRED_GUIDED_VR_DESTINATIONS = Object.freeze([]);

module.exports = {
  GUIDED_VR_ROUTES,
  DEFERRED_GUIDED_VR_DESTINATIONS,
};
