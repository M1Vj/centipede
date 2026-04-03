# Project Implementation Checklist

Use this checklist as the canonical execution order for the rebuild. Mark an item `[x]` only after the branch is implemented, verified, and merged back into `develop`, and record a short merge note or commit hash in the same update.

```markdown
- [x] 01-foundation -> feature/foundation (merge: b9ed970, PR #4)
- [x] 02-authentication -> feature/authentication (merge: 42545fb, PR #5)
- [x] 03-interaction-feedback -> feature/interaction-feedback (merge: 668b8b0, PR #6)
- [x] 04-admin-user-management -> feature/admin-user-management (merge: b9d7890, PR #10)
- [ ] 05b-deferred-foundation-and-auth -> feature/deferred-technical-debt
- [ ] 05-organizer-registration -> feature/organizer-registration
- [ ] 06-problem-bank -> feature/problem-bank
- [ ] 07-scoring-system -> feature/scoring-system
- [ ] 08-competition-wizard -> feature/competition-wizard
- [ ] 09-team-management -> feature/team-management
- [ ] 10-competition-search -> feature/competition-search
- [ ] 11-arena -> feature/arena
- [ ] 12-anti-cheat -> feature/anti-cheat
- [ ] 13-review-submission -> feature/review-submission
- [ ] 14-leaderboard-history -> feature/leaderboard-history
- [ ] 15-notifications-polish -> feature/notifications-polish
- [ ] 16-participant-monitoring -> feature/participant-monitoring
- [ ] 17-testing-bug-fixes -> feature/testing-bug-fixes
```

## Usage Rules

- do not renumber existing tasks
- the current `.agent/` numbering is canonical for execution even though legacy `.agents/` used a different historical sequence
- do not add side branches without updating this file and the quick reference
- **CRITICAL**: Branches `01` through `04` are completely **DONE**. You must never revisit them, edit their feature branches, or assume they still need to be executed.
- `04-admin-user-management` is DONE. It provides the admin-side approval UI and server shell. Do not rewrite this. `05-organizer-registration` connects to this existing approval path for applicant-facing status, organizer activation/provisioning, organizer workspace onboarding, and related lifecycle messaging without re-owning admin decision writes.
- if a bug fix is required to finish the active feature, keep it in that feature and note it in the feature file
- if a backend change alters tables, enums, functions, or RLS, update `.agent/DATABASE-EDR-RLS.md` before marking the item complete
- if a new project rule is learned, append it to `.agent/learned-rules.md` before marking the item complete
- no `.agent/` doc may depend on inaccessible external local files
