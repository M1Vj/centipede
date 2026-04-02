# Project Implementation Checklist

Use this checklist as the canonical execution order for the rebuild. Mark an item `[x]` only after the branch is implemented, verified, and merged back into `develop`.

```markdown
- [x] 01-foundation -> feature/foundation
- [x] 02-authentication -> feature/authentication
- [x] 03-interaction-feedback -> feature/interaction-feedback
- [x] 04-admin-user-management -> feature/admin-user-management
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
- do not add side branches without updating this file and the quick reference
- if a bug fix is required to finish the active feature, keep it in that feature and note it in the feature file
- if a backend change alters tables, enums, functions, or RLS, update `.agent/DATABASE-EDR-RLS.md` before marking the item complete
- if a new project rule is learned, append it to `.agent/learned-rules.md` before marking the item complete
- no `.agent/` doc may depend on inaccessible external local files
