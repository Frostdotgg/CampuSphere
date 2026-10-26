# Admin campus-map organization — authorized staged release

## October 26 staged-release authorization

The owner authorized publication of the exact ten reviewed files as one commit
and a normal push to main, followed by testing the resulting unpromoted staged
Vercel build. Production remains on the accepted `ed99e8c` deployment. No
Production promotion, deployment-setting change or shared campus-content write
is included. Normal sign-in/session activity is permitted. Actual add/edit/delete
and save checks use only the existing labelled disposable local fixture; normal
localhost checks reuse the established Compose testing stack. No additional
app/MySQL/relay container set is created. The reviewed runtime is 216 files /
8,665,643 bytes, SHA-256
`7fcbab1fcd81c45b90c558d1f7cb4b53cd5247608ba0e2b806931881dcd55b08`.
Shell v61, public stylesheet v14 and its exact 21 assets remain unchanged.

Recheck source, the ten-file manifest, matching remote main, branch rules,
protection and disabled automatic Production domain assignment before staging.
Record fresh checks, final commit/deployment identities, preservation evidence
and actual staged acceptance in the external release receipt. Authorization
does not establish publication or acceptance. Stop before Production promotion;
future release work requires separate authorization. The earlier local review
below remains dated history and is not a new staged test result.

## October 25 local implementation and review history

This focused UI candidate starts from `ed99e8c0cbb6f78f1588d045ef1c75ef46cab406`
on `codex/admin-campus-map-organization`. It is intentionally uncommitted.
Only `/admin/campus-map` receives new layout and list behavior. No shared data,
API, schema, dependency, public map, downloaded-guide format or deployment
change belongs to this task. Public shell v61, stylesheet v14 and its 21 assets
remain unchanged. Earlier release and failed-acceptance evidence is history.

Buildings is the initial main tab. Routes & Campus Graph contains Routes,
Vehicle 2D Routes (the existing directed-edge editor), Walking 2D Routes and
Nodes. Existing IDs, API endpoints, validation, geometry and mode/direction
instruction storage remain. Visible edge terminology becomes vehicle-route
terminology. Search/filtering happens across the loaded collection before
ten-record pagination; each list owns its page and query in page memory.

Saving preserves the current tab, filters, page and scroll. The explicit
View saved item action may clear filters to locate the saved record and opens
only its page. Deletion clamps the page and returns focus to a visible control.
Deferred refreshes never select tabs. Superseded reads cannot replace newer
results. Building/graph readiness updates are retained and Walking lists are
invalidated after related changes. Unavailable reads retain existing rows
with a retry/error state rather than expanding the whole collection.

Tabs use selected states, associated panels, roving focus and arrow/Home/End
keys. Page-specific styles wrap controls and long labels, honor hidden panels,
and retain the existing main workspace scroll. They do not enter the cached
public/offline shell. Building modal close handlers are scoped to their owned
dialogs so another editor's unsaved-change warning cannot be bypassed.

Validation uses a fresh external candidate, temporary index and matching
locked external dependencies. Docker app/MySQL use only the labelled
`admin-campus-map-organization-20261025` internal network, with a relay bound
to `127.0.0.1:3431`. Ordinary localhost and shared Supabase are not test targets.
The synthetic campus records and local fixture sessions are disposable.
No environment files or private database backups are read.

The focused workspace regression covers list boundaries, reachability,
filter-before-page ordering, delete clamping, scoped visibility and independent
rejection fixtures. Actual editor mutations, delayed/failed reads, keyboard
focus, both themes, specified screen sizes and actual Chrome 200% are verified
separately in Docker. Final counts, screenshots, runtime fingerprint, exact
manifest, preservation results and limitations belong in the external receipt.

Finish with an empty real index and reviewed local files. Commit, push and
Vercel release require a separate focused task; this note establishes neither
current staged nor Production acceptance.
