# All Branches Quick Reference

| No. | Branch | Core Scope | Depends On |
| --- | --- | --- | --- |
| 01 | `feature/foundation` | bootstrap Next.js + Supabase workspace, env, base schema, static pages, root layout, shared tokens, testing baseline | none |
| 02 | `feature/authentication` | mathlete Google OAuth, organizer/admin credential login, role-aware redirects, profile completion, suspended-user handling, and callback hardening | 01 |
| 03 | `feature/interaction-feedback` | shared loading, empty, error, confirmation, navigation feedback, portal shells, mobile nav foundations | 01, 02 |
| 04 | `feature/admin-user-management` | admin workspace, organizer approval and rejection decision writes (`organizer_applications` decision fields only), user moderation, audit logs, read-only admin settings shell contract with deferred trusted settings data source (no release-one settings write source), shell-only admin resource placeholders, and admin logs/settings shells | 02, 03 |
| 05b | `feature/deferred-technical-debt` | legal pages, strict single-session enforcement, loading boundaries, mathlete settings/profile edits for school and grade-level changes, and safe user anonymization | 01, 02, 03, 04 |
| 05 | `feature/organizer-registration` | public organizer application form, applicant status visibility, organizer activation after approval (owns `profiles.role = 'organizer'` and `approved_at` for approved rows, including `profile_id` null approvals), organizer workspace activation, organizer dashboard home with profile/statistics/data-insights shells, organizer profile/settings with immutable self-service login identifier/email, and legal/storage onboarding completion | 02, 03, 04, 05b |
| 06 | `feature/problem-bank` | problem bank CRUD, default bank reuse, bulk import, asset uploads, rich math authoring, immutable draft protection rules | 03, 04, 05b, 05 |
| 07 | `feature/scoring-system` | scoring presets, immutable publish-time scoring snapshots, answer normalization, tie-breakers, multi-attempt grading policy, and scoring RPC contracts (`grade_attempt`, `recalculate_competition_scores`, `refresh_leaderboard_entries`) | 06 |
| 08 | `feature/competition-wizard` | competition draft builder, overview instructions/rules box, validation, problem snapshotting, publish safety, trusted lifecycle transitions (`published -> live`, `live/paused -> ended`, archive), open vs scheduled behavior, lifecycle state guards, and safe draft-delete ownership | 06, 07 |
| 09 | `feature/team-management` | team CRUD, invites, roster policies, transfer leadership, registration lock rules, ineligibility handling | 02, 03, 08 |
| 10 | `feature/competition-search` | discovery, filters, search, registration, withdrawal with any-attempt-row blocking invariant, timezone calendar, eligibility checks, reminder-ready data hooks | 08, 09 |
| 11 | `feature/arena` | competition entry, rules and device acknowledgements, server-side timer, autosave, math answer input, problem navigation, active interval tracking, resume flow | 07, 08, 10 |
| 12 | `feature/anti-cheat` | focus-loss logging, offense penalties, overlay recovery, organizer-visible logs, safe session exception handling | 11 |
| 13 | `feature/review-submission` | review page, final submission, answer-key visibility rules, participant dispute submission contract ownership (`create_problem_dispute`), and multi-attempt result handling | 11, 12 |
| 14 | `feature/leaderboard-history` | leaderboard/history ownership surfaces, leaderboard publication, explicit open-leaderboard visibility contract for all non-draft open states, organizer dispute resolution and correction artifacts (`resolve_problem_dispute`, `record_competition_problem_correction`), publication/export (`publish_leaderboard`, `queue_export_job`), export participant/team context, and score recalculation follow-through via branch `07` scoring RPC contracts | 10, 13 |
| 15 | `feature/notifications-polish` | in-app notifications with recipient plus event-identity idempotency, explicit default preference rows, email delivery, score recalculation messaging, history/answer-key deep links, and shared notification infrastructure consumed by later producer branches | 05, 08, 14 |
| 16 | `feature/participant-monitoring` | live participant dashboard, announcements with canonical audience predicates, control-action timeline with request idempotency tokens, admin live-support force-pause hooks with required reason, organizer intervention controls for open-competition pause plus organizer-owned resume/extend/reset with required reason, and admin non-draft abuse/fraud moderation delete path | 08, 12, 15 |
| 17 | `feature/testing-bug-fixes` | full QA sweep, accessibility/performance hardening, cross-browser checks, release prep, and documentation finalization | 01, 02, 03, 04, 05b, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16 |

## Guide File Naming and Lane Map

- baseline-complete guides (`01` through `06`) keep legacy file naming: `NN-<slug>.md`
- remaining guides (`07+`) use lane naming: `NN-<lane>-<slug>.md`

| No. | Lane | Guide File Name |
| --- | --- | --- |
| 07 | A | `07-A-scoring-system.md` |
| 08 | A | `08-A-competition-wizard.md` |
| 09 | B | `09-B-team-management.md` |
| 10 | B | `10-B-competition-search.md` |
| 11 | A | `11-A-arena.md` |
| 12 | A | `12-A-anti-cheat.md` |
| 13 | A | `13-A-review-submission.md` |
| 14 | B | `14-B-leaderboard-history.md` |
| 15 | B | `15-B-notifications-polish.md` |
| 16 | B | `16-B-participant-monitoring.md` |
| 17 | A | `17-A-testing-bug-fixes.md` |

## Notes

- bucket folders in `.agent/features/` preserve the weekly/date planning style from the original documentation, but implementation follows branch dependencies rather than calendar assumptions
- `.agent/` numbering is the canonical execution numbering for the rebuild
- dependency entries are direct dependencies only (explicit branch list, no range shorthand); execution order still follows `.agent/checklist.md` and `.agent/00-ATOMIC-STRUCTURE.md`
- branch `04-admin-user-management` owns organizer-application decision writes only for organizer lifecycle and owns a read-only admin settings shell contract with deferred trusted settings data source (such as `system_settings` once introduced by its owning migration path), which may remain placeholder-only in release one; branch `05-organizer-registration` owns organizer-role activation and provisioning (`profiles.role`, `profiles.approved_at`, including approved rows with `profile_id` null)
- branch `07-scoring-system` owns scoring RPC contracts (`grade_attempt`, `recalculate_competition_scores`, `refresh_leaderboard_entries`); branch `13-review-submission` owns participant dispute-create contract (`create_problem_dispute`); branch `14-leaderboard-history` owns dispute resolution, correction artifacts, leaderboard/history publication, and export surfaces
- branch `08-competition-wizard` owns lifecycle status transitions (`published -> live`, `live/paused -> ended`, archive) and trusted draft-delete path; branch `16-participant-monitoring` consumes lifecycle events and owns announcement producers plus moderation live controls
- admin live support allow list is force-pause plus non-draft abuse/fraud moderation delete via moderation controls with explicit non-empty reason and `request_idempotency_token`; organizer controls own resume/extend/reset and require non-empty reason plus `request_idempotency_token`
- notification sequencing is one-way: branch `15-notifications-polish` provides shared notification infrastructure, and branch `16-participant-monitoring` announcement producers consume it; branch `15` must not depend on `competition_announcements` schema
- features 15-17 intentionally absorb cross-cutting work that earlier planning drafts treated as optional cleanup
- current workspace may still contain existing `[id]` routes in some admin pages; new work must use canonical dynamic segment names from `.agent/PROCESS-FLOW.md`
- admin route migration sequence is fixed: introduce canonical `[competitionId]` and `[bankId]` compatibility paths, cut over producers, then run the branch `17-testing-bug-fixes` zero-new-`/admin/**/[id]` producer gate, then remove deprecated handlers
- boolean lifecycle migration sequence is fixed: compatibility add enum status, deterministic backfill, dual-write sync, enum-only cutover, then drop deprecated boolean fields
- database migration sequencing in `.agent/DATABASE-EDR-RLS.md` Section G must remain branch-aligned with `.agent/checklist.md`; do not pull future-branch schema into earlier branches to satisfy documentation-only assumptions
- per-branch schema and trusted-function ownership mapping is canonical in `.agent/DATABASE-EDR-RLS.md` Section G and must be updated before introducing a new domain table or primary RPC outside its listed owner branch
- docs in `.agent/` are target-contract references for blank-slate implementation; branch sequencing defines when target schema/routes are introduced
- baseline-vs-target audit rule: if a target route or table belongs to a branch that has not executed yet, its absence in current app routes or migrations is expected pre-branch and is not a contradiction
- no new implementation branch should be invented unless the checklist and quick reference are updated first
- every implementation branch must carry explicit security and reliability acceptance criteria (trusted mutation checks, idempotency behavior, safe error contracts, and audit evidence)
- branch `17-testing-bug-fixes` is the release security gate owner for unresolved high or critical risk closure and evidence packaging
- route, API, and control contracts must remain deterministic across retries and contention; non-deterministic outcomes are release blockers
