# All Branches Quick Reference

| No. | Branch | Core Scope | Depends On |
| --- | --- | --- | --- |
| 01 | `feature/foundation` | bootstrap Next.js + Supabase workspace, env, base schema, static pages, root layout, shared tokens, testing baseline | none |
| 02 | `feature/authentication` | mathlete Google OAuth, organizer/admin credential login, role-aware redirects, profile completion, suspended-user handling, and callback hardening | 01 |
| 03 | `feature/interaction-feedback` | shared loading, empty, error, confirmation, navigation feedback, portal shells, mobile nav foundations | 01, 02 |
| 04 | `feature/admin-user-management` | admin workspace, organizer approval and rejection decision writes (`organizer_applications` decision fields only), user moderation, audit logs, `system_settings` dependency for admin settings shell, read-only resource access, and admin logs/settings shells | 02, 03 |
| 05b | `feature/deferred-technical-debt` | legal pages, playwright E2E setup, strict single-session enforcement, loading boundaries, safe user anonymization | 01, 02, 03, 04 |
| 05 | `feature/organizer-registration` | public organizer application form, applicant status visibility, organizer activation or provisioning after approval (owns `profiles.role = 'organizer'` and `approved_at`, including `profile_id` null approvals), organizer workspace activation, organizer profile/settings with immutable self-service login identifier/email, and legal/storage onboarding completion | 02, 03, 04, 05b |
| 06 | `feature/problem-bank` | problem bank CRUD, default bank reuse, bulk import, asset uploads, rich math authoring, immutable draft protection rules | 03, 04, 05b, 05 |
| 07 | `feature/scoring-system` | scoring presets, immutable publish-time scoring snapshots, answer normalization, tie-breakers, multi-attempt grading policy, and scoring RPC contracts (`grade_attempt`, `recalculate_competition_scores`, `refresh_leaderboard_entries`) | 06 |
| 08 | `feature/competition-wizard` | competition draft builder, validation, problem snapshotting, publish safety, open vs scheduled behavior, lifecycle state guards, and safe delete rules | 06, 07 |
| 09 | `feature/team-management` | team CRUD, invites, roster policies, transfer leadership, registration lock rules, ineligibility handling | 02, 03, 08 |
| 10 | `feature/competition-search` | discovery, filters, search, registration, withdrawal with any-attempt-row blocking invariant, timezone calendar, eligibility checks, reminder-ready data hooks | 08, 09 |
| 11 | `feature/arena` | competition entry, rules and device acknowledgements, server-side timer, autosave, math answer input, problem navigation, active interval tracking, resume flow | 07, 08, 10 |
| 12 | `feature/anti-cheat` | focus-loss logging, offense penalties, overlay recovery, organizer-visible logs, safe session exception handling | 11 |
| 13 | `feature/review-submission` | review page, final submission, answer-key visibility rules, participant dispute submission contract ownership (`create_problem_dispute`), and multi-attempt result handling | 11, 12 |
| 14 | `feature/leaderboard-history` | leaderboard/history ownership surfaces, leaderboard publication, explicit open-leaderboard visibility contract (self-row in `live`/`paused`, full after `ended`/`archived`), organizer dispute resolution and correction artifacts (`resolve_problem_dispute`, `record_competition_problem_correction`), publication/export (`publish_leaderboard`, `queue_export_job`), and score recalculation follow-through via branch `07` scoring RPC contracts | 10, 13 |
| 15 | `feature/notifications-polish` | in-app notifications with recipient plus event-identity idempotency, preferences, email delivery, score recalculation messaging, UI consistency and shared polish | 05, 08, 14 |
| 16 | `feature/participant-monitoring` | live participant dashboard, announcements, control-action timeline with request idempotency tokens, admin live-support force-pause hooks with required reason, and organizer intervention controls for resume/extend/reset with required reason | 08, 12, 15 |
| 17 | `feature/testing-bug-fixes` | full QA sweep, accessibility/performance hardening, cross-browser checks, release prep, and documentation finalization | 01, 02, 03, 04, 05b, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16 |

## Notes

- bucket folders in `.agent/features/` preserve the weekly/date planning style from the original documentation, but implementation follows branch dependencies rather than calendar assumptions
- `.agent/` numbering is the canonical execution numbering for the rebuild, even where legacy `.agents/` used a different historical sequence
- dependency entries are direct dependencies only (explicit branch list, no range shorthand); execution order still follows `.agent/checklist.md` and `.agent/00-ATOMIC-STRUCTURE.md`
- branch `04-admin-user-management` owns organizer-application decision writes only for organizer lifecycle and owns `system_settings` dependency for the admin settings shell; branch `05-organizer-registration` owns organizer-role activation and provisioning (`profiles.role`, `profiles.approved_at`, including approved rows with `profile_id` null)
- branch `07-scoring-system` owns scoring RPC contracts (`grade_attempt`, `recalculate_competition_scores`, `refresh_leaderboard_entries`); branch `13-review-submission` owns participant dispute-create contract (`create_problem_dispute`); branch `14-leaderboard-history` owns dispute resolution, correction artifacts, leaderboard/history publication, and export surfaces
- admin live support may force-pause via moderation controls with explicit reason; organizer controls own resume/extend/reset and require explicit reason values
- features 15-17 intentionally absorb cross-cutting work that the old `.agents` plan treated as optional cleanup
- current workspace may still contain legacy `[id]` routes in some existing admin pages; new work must use canonical dynamic segment names from `.agent/PROCESS-FLOW.md`
- legacy admin route migration sequence is fixed: compatibility introduce canonical `[competitionId]` and `[bankId]`, cut over producers, then run the branch `17-testing-bug-fixes` zero-new-`/admin/**/[id]` producer gate, then remove legacy handlers
- legacy boolean lifecycle migration sequence is fixed: compatibility add enum status, deterministic backfill, dual-write sync, enum-only cutover, then drop old booleans
- per-branch schema and trusted-function ownership mapping is canonical in `.agent/DATABASE-EDR-RLS.md` Section G and must be updated before introducing a new domain table or primary RPC outside its listed owner branch
- docs in `.agent/` are target-contract references for blank-slate implementation; branch sequencing defines when target schema/routes are introduced
- baseline-vs-target audit rule: if a target route or table belongs to a branch that has not executed yet, its absence in current app routes or migrations is expected pre-branch and is not a contradiction
- no new implementation branch should be invented unless the checklist and quick reference are updated first
