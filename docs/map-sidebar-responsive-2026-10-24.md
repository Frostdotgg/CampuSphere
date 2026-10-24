# Responsive campus-map sidebar — October 24 staged release

## Authorized staged release

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
