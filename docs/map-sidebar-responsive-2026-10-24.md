# Responsive campus-map sidebar — October 24 staged release

## Authorized offline popup-layer corrective staged release

The owner authorized a focused correction based on
`04ecee1e80f3d4c71553dcc731b3b09c9cb3b25a`: move the existing offline
route dialog outside the fixed map workspace so it layers above navigation,
matching the online popup. Keep the existing backdrop, accessible title, IDs,
hidden state, keyboard focus, Close and Clear Route behavior. Cache v60 retains
the exact 21 shell assets and the unchanged downloaded-guide format.

The earlier correction's search and protected-download fixes passed their
focused tests, but full staged acceptance remained blocked: final actual-200%
screenshot review found the offline title underneath navigation. The earlier
bounds-only assertion missed that occlusion. Preserve the external
`fix-map-sidebar-20261024` receipt and failed screenshots as dated evidence.

This task includes a body-level structural regression, rejection coverage,
browser title/control hit-testing, disposable Docker checks, one scoped commit,
normal main push and acceptance of the exact Ready / Staged build. No routing
logic, API, schema, dependencies, shared content, CSP or protection changes are
included. Production promotion remains excluded. Recheck Git, branch rules and
disabled automatic custom Production domain assignment before publication.

Actual source/deployment identities, runtime fingerprint, fresh results,
screenshots, preservation evidence and limitations belong in the external
`offline-popup-layer-20261024` receipt. Authorization establishes none of those
results. New sessions ground, report and wait for a focused owner task.

## Historical authorization — v59 search/download correction

The owner authorized two bounded corrections based on `441e0fe71d88cde502949459110da3610bbbb210`:
preserve predefined Vehicle search instructions by removing the obsolete planner
handoff, and permit protected same-origin basemap downloads using the browser's
existing sign-in with redirects rejected. Destination validation, request abortion,
generation guards, public basemap delivery before session middleware, integrity
checks and atomic guide replacement remain. Cache v59 retains the exact 21 shell
assets and the existing guide format. No credentials are read or embedded.

The failed v58 staged acceptance and its reproduction remain dated evidence in
the external `release-map-sidebar-20261024` receipt. The current task includes
disposable Docker and isolated regression checks, one scoped corrective commit,
a normal main push, and acceptance of the exact Ready / Staged build. Production
promotion, shared campus-content writes, database/schema changes, dependencies,
CSP and deployment-protection changes are excluded. No bypass token is created.

Actual checks, canonical runtime identity, source/deployment identities, screenshots,
guide-preservation evidence and limitations belong in the external
`fix-map-sidebar-20261024` receipt. Authorization alone establishes none of those
results. Preserve older records below as history. New sessions ground, report and
wait for a focused owner task; normal-domain guide upgrades remain post-promotion.

## Historical authorization — first v58 staged release

The owner separately authorized publication of these 15 reviewed files through
one scoped commit and a normal main push, followed by testing of the exact Ready,
unpromoted staged Vercel deployment. Production promotion is excluded; the live
domain must retain its existing deployment. No API, schema, dependency, guide-format
or shared campus-content changes belong to this release. Candidate cache v58 stays.

The preparation baseline is `74509f06baae1dee5536186a4e79c6f40014e328`.
Recheck Git state, the reviewed manifest, branch rules and disabled automatic
Production domain assignment before publishing. Actual commit/deployment identities,
fresh checks, screenshots, preservation results and limitations belong in the external
`release-map-sidebar-20261024` receipt. Authorization alone does not establish
publication, build completion or staged acceptance. Existing normal-domain guide
upgrade testing remains a later post-promotion task. New sessions ground, report
and wait for a focused owner request.

## Historical local implementation and review — before release authorization

This work is local and uncommitted on `codex/responsive-map-sidebar`, based on
`74509f06baae1dee5536186a4e79c6f40014e328`. The owner's approved UI plan covers
the online and downloaded maps. It does not authorize committing, pushing,
deployment, dependency changes or shared database writes. The preceding editable
instructions release and later owner-authorized Production promotion are recorded
in the external October 24 release receipt; older staged-only notices remain history.

The sidebar prioritizes buildings: compact rows, one scroll owner, a collapsed
Offline Campus Guide, compact Free Roam link and a visible Vehicle/Walking selector.
The redundant fixed-start/destination/Find Route form is removed. Pin or list
selection → Set as Destination remains the route entry point. Return actions,
saved instructions, geometry, metrics, VR links and server APIs remain.

Clear Route cancels the current lookup generation, aborts its request and removes
stale geometry and instructions. Mode changes clear the preceding trip rather
than copying directions between modes. Mobile lists occupy the available workspace
height with View Map; route actions leave the list closed so the route remains visible.
Visible controls replace the removed Find Route focus fallback. Search/filter
changes reset the sidebar scroll position.

The shared stylesheet and viewport helper use navigation height, visual viewport
size and safe areas. Short screens scroll the header with the content. Existing
map renderers resize without resetting their camera. Candidate PWA cache v58
includes the exact new assets; the guide format and existing device data remain.
Real campus instructions are deferred.

Validation uses a separately labelled Docker fixture, an internal application/
database network and a fixed-target relay on loopback port 3411. The ordinary
localhost stack is not the isolated fixture and is left untouched. Only synthetic
fixture content may be changed. External matching locked dependencies are used
without changing workspace dependencies or reading environment files.

Before/after screenshots, measured viewports, fresh results, preservation checks
and limitations belong in the external `map-sidebar-20261024` receipt. Earlier
release totals are not results for this candidate. Physical-device coverage and
all possible browsers are not claimed from emulated viewports.
