# All Branches Quick Reference

| No. | Branch | Core Scope | Depends On |
| --- | --- | --- | --- |
| 01 | `feature/foundation` | bootstrap Next.js + Supabase workspace, env, base schema, legal/static pages, root layout, shared tokens, testing baseline | none |
| 02 | `feature/authentication` | mathlete Google OAuth, organizer/admin credential login, role-aware redirects, profile completion, suspended-user handling, callback hardening, strict single-session rules | 01 |
| 03 | `feature/interaction-feedback` | shared loading, empty, error, confirmation, navigation feedback, portal shells, mobile nav foundations | 01-02 |
| 04 | `feature/admin-user-management` | admin workspace, organizer approvals, user moderation, audit logs, read-only resource access, default-bank governance hooks | 02-03 |
| 05 | `feature/organizer-registration` | public organizer application form, secure review status, approval credential handoff, organizer workspace activation, organizer profile/settings, legal consent flow | 02-04 |
| 06 | `feature/problem-bank` | problem bank CRUD, default bank reuse, bulk import, asset uploads, rich math authoring, immutable draft protection rules | 03-05 |
| 07 | `feature/scoring-system` | scoring presets, answer normalization, tie-breakers, multi-attempt grading policy, grading and recalculation RPC design | 06 |
| 08 | `feature/competition-wizard` | competition draft builder, validation, problem snapshotting, publish safety, open vs scheduled behavior, organizer lifecycle controls | 06-07 |
| 09 | `feature/team-management` | team CRUD, invites, roster policies, transfer leadership, registration lock rules, ineligibility handling | 02-03 |
| 10 | `feature/competition-search` | discovery, filters, search, registration, withdrawal, timezone calendar, eligibility checks, reminder-ready data hooks | 08-09 |
| 11 | `feature/arena` | competition entry, rules and device acknowledgements, server-side timer, autosave, math answer input, problem navigation, active interval tracking, resume flow | 07-10 |
| 12 | `feature/anti-cheat` | focus-loss logging, offense penalties, overlay recovery, organizer-visible logs, safe session exception handling | 11 |
| 13 | `feature/review-submission` | review page, final submission, grading execution, answer key visibility, disputes, multi-attempt result handling | 11-12 |
| 14 | `feature/leaderboard-history` | leaderboard publication, history pages, exports, immutable result views, organizer archive metrics | 10-13 |
| 15 | `feature/notifications-polish` | in-app notifications, preferences, email delivery, score recalculation messaging, UI consistency and shared polish | 04-14 |
| 16 | `feature/participant-monitoring` | live participant dashboard, announcements, pause/resume/extend, legitimate-disconnection reset, event timeline, organizer intervention tools | 08-15 |
| 17 | `feature/testing-bug-fixes` | full QA sweep, accessibility/performance hardening, cross-browser checks, release prep, documentation finalization | 01-16 |

## Notes

- bucket folders in `.agent/features/` preserve the weekly/date planning style from the original documentation, but implementation follows branch dependencies rather than calendar assumptions
- features 15-17 intentionally absorb cross-cutting work that the old `.agents` plan treated as optional cleanup
- no new implementation branch should be invented unless the checklist and quick reference are updated first
