# Dashboard announcement reader — authorized combined release (October 25, 2026)

The owner authorized publication of the exact 27-file combined announcement and
navbar candidate, based on `2adc8d843471594144cf4f8f78d6fa88ee41d42b`.
One scoped commit and normal main push must produce a Ready / Staged build.
Only complete staged acceptance permits promotion of that same build, followed
by normal-domain verification and monitoring. Confirmed critical regressions
require recovery to the verified working `2adc8d8` deployment and a stop.
Automatic domain assignment and protection must remain unchanged. Shared
content writes, migrations, dependency changes and rebuild workarounds are
excluded. Actual commit/deployment identities, fresh results and recovery
eligibility belong in the external release receipt; authorization is not proof
of completion. The combined candidate uses cache v61 and stylesheet v14.

## Original local implementation record — dated history

The original scope, restrictions and results below describe the earlier local
implementation only. The release authorization above supersedes its publishing
boundary without changing its historical evidence.

This focused task is based on `2adc8d843471594144cf4f8f78d6fa88ee41d42b`
on `codex/dashboard-announcement-reader`. It is a local, uncommitted candidate.
No commit, push, deployment, migration, shared content edit or dependency change
is authorized by this implementation task.

## Behavior and scope

The dashboard previously received the saved article `content` but dropped it
while preparing client display data. Its three reader templates displayed only
the excerpt. The student, instructor and guest announcement sections now reuse
one escaped template partial. Native, independent disclosures show the complete
plain-text body and preserve paragraphs and line breaks. Opening a disclosure
replaces its preview; closing it restores the preview. Missing or blank content
falls back to the complete excerpt. Identical excerpt/body text appears once
without an unnecessary disclosure.

The scoped layout uses separated headline-first rows, wrapping metadata,
readable text widths, an accessible result count, a compact desktop department
filter and full-width mobile filter. Expanded text uses normal page scrolling.
Filtering closes only hidden announcements. Changing dashboard sections renders
a fresh reading view. Overview previews and the administrator editor are unchanged.

Published/audience filtering remains server-side for both data adapters. Saved
text remains escaped by the existing CSP-safe renderer; HTML is never interpreted.
No endpoint, schema, rich-text editor, dependency or shared stylesheet is added.
Maps, downloaded-guide format, cache v60 and its exact 21 shell assets are unchanged.

## Validation and evidence

Use only the labelled `dashboard-announcements-20261025` disposable Docker
fixture and isolated MySQL/Supabase adapter fixtures. The ordinary localhost
stack can use shared Supabase and is not an isolated test environment.
Credentials, environment files and private database backups must not be read.

Fresh candidate results, source fingerprint, screenshots and preservation checks
belong in the external receipt under the owner's Codex backups directory. Earlier
map release and failed acceptance records remain historical evidence; this note
does not establish a fresh Production result. The implementation must finish
with local review and an empty real Git index. Publishing requires a separate task.

The local reader regression passes 57/57 and rejects the original dashboard's
missing-body behavior. Department-news checks pass 1,137/1,137, notifications
26/26, audiences 13/13, PWA 148/148 and the canonical package boundary 79/79.
The guarded host checks report zero attempted blocked operations. Disposable
Docker create/read and edit/read checks each pass 12/12, including all three
reader roles, server-side audience exclusion and the existing nonce CSP.

Browser checks cover all three reader sections in both themes at 320×568,
390×844, 768×1024, 1366×768 and 844×390, plus independent expansion, native
keyboard operation, filtering, section reset, reload persistence, escaped text,
10,000-character content and unbroken-text wrapping. These viewport checks are
emulation, not physical-device acceptance. The actual Chrome zoom observation,
restoration, final fingerprint and any outstanding limits are recorded separately
in the external receipt; this paragraph does not claim that zoom check passed.
