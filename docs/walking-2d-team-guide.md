# Drawing walking 2D paths

Walking 2D was verified and published October 18 from source `c533719`. Use [Campus Map administration](https://campusphere-cspc.vercel.app/admin/campus-map)
with your existing Administrator account.

## Draw and check a building

1. Divide the buildings needing review or revision among your group. Each building should have
   one editor at a time; saving replaces that building's walking path.
2. Find **Walking 2D Routes** in Campus Map administration.
3. Choose **Draw path** beside your assigned building.
4. The Walking Guard House and existing building pin are locked. Click the map
   to add points in walking order along pedestrian paths. Add points at turns.
5. Drag intermediate markers or edit their coordinates. Use the arrows to
   reorder points, **Remove** to remove one, **Undo** to undo an edit, and
   **Fit path** to see the whole route. At least one intermediate point is required.
6. Visually check every segment. Avoid cutting across buildings or closed areas.
   Only the final short segment may enter the building footprint to reach its pin.
7. Select **Save walking route**. Reopen **Edit path** to confirm it was saved.
8. Open the regular campus map, select **Walking**, select the building, then
   choose **Set as Destination**. Entrance is dashed blue. **Walking Return** is
   dashed red and reverses the same path. Check both directions.
9. While connected and signed in, choose **Update Offline Map** on every device
   that needs the new route. Saved guides do not update automatically.

Vehicle routes and VR routes are managed separately. Do not alter vehicle graph
edges to draw a walking path. A building without a saved walking path remains
unavailable in Walking mode.

## Saved coverage — October 19, 2026

The live Administrator counter showed **26/26 saved paths, zero missing**.
Your group has finished drawing the current route-ready roster. This counter
proves saved coverage; it does not establish visual approval of every walkway.
Review each path's turns, open access and final segment, then check its blue
entrance/red return on the regular map. Divide review assignments to avoid
overwriting another editor. Check the live counter again when buildings change.

Every device must refresh its downloaded guide while connected and signed in
to receive the additional paths. Older saved guides keep their previous copy.

## Historical starting coverage

The approved plan began with **1/26** (test building). The October 18 release
checks found **2/26**: test building and Academic Building I. The earlier list
of 24 buildings needing drawing is superseded by the October 19 counter.
These snapshots describe saved paths at those times, not exhaustive visual QA.

## ICTU Docker dependency

The application code is on GitHub main. Walking paths are saved in Supabase;
they are not bundled into Git or a Docker image. An ICTU rebuild configured for
the same Supabase project can read those paths. A separate database requires an
authorized schema/data transfer. This guide does not establish that ICTU has
deployed the image. See `docs/session-handoff-2026-10-19.md` for release limits.
