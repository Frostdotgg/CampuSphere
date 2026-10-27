# Guest news and event visibility — local candidate

The owner authorized implementation and local validation on
`codex/guest-content-visibility`, starting from clean main at
`d4417eee84e07970eda22c5fe85b7d43458a4ca9`. After review, the owner authorized
one scoped commit and normal push, staged testing, and promotion of that same
build after every required staged check passes. Staging and Production checks
may use separate, uniquely labelled temporary News and Event batches, with
guarded cleanup and verification before each phase closes. This records scope
and authorization; actual commit, deployment, test, cleanup and monitoring
results belong in a fresh external release receipt.

## Reading rules

Guests receive no department announcements in dashboard data, navigation,
Overview summaries or notifications. Historical guest news links return to
Overview. Guests may read only events stored as `university-wide` (Campus-wide)
whose Audience is Everyone or Guests. That rule applies to the Events page,
Home's Latest Events and the bell. Other readers retain their audience rules.
Missing and unknown event department codes do not become Campus-wide.

The shared pure server policy is applied to MySQL queries and Supabase reads
before ordering and limits. Guest announcement reads are skipped. The bell's
guest response retains its shape with an empty `announcements` array, scoped
events and `links.announcements: null`. Its revision is computed only from
permitted items. The guest bell has no announcement link or restricted-item
placeholder; an empty feed says “No upcoming Campus-wide events.”

## News editing and compatibility

News offers Students, instructors and admins (stored `all`), Students (CSPC),
Instructors and Admins. Guests is retired for new/updated articles. Previously
guest-targeted articles remain stored and visible in the admin inventory. A
legacy article requires an explicit supported audience before it can be saved;
reads never reassign it. Events retain Guests and Everyone audiences.

No migration, shared-content rewrite, dependency or guide-format change belongs
to this candidate. Stylesheet v14, shell v61 and its 21 assets are retained.
Local browser review also corrects two page-specific layout limits: Events
category controls have 44px targets and Home's grid children may shrink to the
available width so longer event titles do not widen a 320px page.

## Verification and evidence

The external receipt records the baseline exposure, independent rejection
fixtures, real controller/repository tests in both adapter modes, synthetic
Docker admin saves and browser checks. The existing Compose stack is used for
read-only localhost checks. The existing labelled announcement fixture is reused
for synthetic records and session activity; its application/database use the
internal network and its relay publishes only 127.0.0.1:3421. No additional
container set is created. Environment files and private database backups are
not read. Final counts, screenshots, canonical runtime fingerprint, preservation
results and remaining limitations belong in the external receipt.
