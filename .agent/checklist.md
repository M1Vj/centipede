# Project Implementation Checklist

Use this checklist as the canonical execution order for the rebuild. Mark an item `[x]` only after the branch is implemented, verified, and merged back into `develop`, and record a short merge note or commit hash in the same update.

```markdown
- [x] 01-foundation -> feature/foundation (merge: b9ed970, PR #4)
- [x] 02-authentication -> feature/authentication (merge: 42545fb, PR #5)
- [x] 03-interaction-feedback -> feature/interaction-feedback (merge: 668b8b0, PR #6)
- [x] 04-admin-user-management -> feature/admin-user-management (merge: b9d7890, PR #10)
- [x] 05b-deferred-foundation-and-auth -> feature/deferred-technical-debt
- [x] 05-organizer-registration -> feature/organizer-registration
- [x] 06-problem-bank -> feature/problem-bank (merge: e5428ba, PR #16)
- [x] 07-A-scoring-system -> feature/scoring-system (merge: 39f7eae, PR #18)
- [x] 08-A-competition-wizard -> feature/competition-wizard (merge: pending, PR #21)
- [x] 09-B-team-management -> feature/team-management (merge: 7c45adf, PR #20)
- [ ] 10-B-competition-search -> feature/competition-search
- [ ] 11-A-arena -> feature/arena
- [x] 12-A-anti-cheat -> feature/anti-cheat
- [ ] 13-A-review-submission -> feature/review-submission
- [ ] 14-B-leaderboard-history -> feature/leaderboard-history
- [ ] 15-B-notifications-polish -> feature/notifications-polish
- [ ] 16-B-participant-monitoring -> feature/participant-monitoring
- [ ] 17-A-testing-bug-fixes -> feature/testing-bug-fixes
```

## Usage Rules

- do not renumber existing tasks
- the current `.agent/` numbering is canonical for execution
- process-flow and schema references outside this repository are non-authoritative context; current `.agent/` branch contracts are authoritative
- do not add side branches without updating this file and the quick reference
- **CRITICAL**: Branches `01` through `04` are baseline-complete and must not be re-executed. Evidence-backed corrective fixes are allowed only when needed to unblock the active branch and must be documented in that active branch guide.
- baseline-complete status for branch `04` does not imply admin route-param migration is finished; current `/admin/**/[id]` compatibility readers may remain until canonical `[bankId]` and `[competitionId]` producer cutover and branch `17` validation gates complete
- `04-admin-user-management` remains the canonical admin decision-write owner branch. `05-organizer-registration` connects to that approval path for applicant-facing status, organizer activation/provisioning, organizer workspace onboarding, and related lifecycle messaging without re-owning admin decision writes.
- if a bug fix is required to finish the active feature, keep it in that feature and note it in the feature file
- if a backend change alters tables, enums, functions, or RLS, update `.agent/DATABASE-EDR-RLS.md` before marking the item complete
- migration execution protocol is strict: apply `supabase/migrations` in ascending timestamp order
- applied migration files are append-only in shared environments; corrections must be new higher-timestamp files
- migration verification gate before marking a checklist item complete (when branch changes `supabase/migrations/*`): `npm run supabase:status`, `npm run supabase:db:reset`, `npm run lint`, `npm run test`, `npm run build`
- FR14.5 fidelity gate for branches touching competition visibility: default `answer_key_visibility` remains `after_end`, and reveal checks use trusted server end-time independent from `leaderboard_published`
- if a new project rule is learned, append it to `.agent/learned-rules.md` before marking the item complete
- no `.agent/` doc may depend on inaccessible external local files

## Security and Governance Gates

- [ ] mutation-method gate: no state-changing `GET` handlers in touched routes
- [ ] action-authorization gate: privileged server actions/handlers enforce trusted actor checks inside mutation paths
- [ ] same-origin and CSRF gate: browser-callable mutation endpoints enforce deterministic cross-site protection behavior
- [ ] safe-redirect gate: `next` and return-target params are parsed by a canonical helper that rejects absolute/protocol-relative targets and accepts in-app relative paths only
- [ ] idempotency gate: event-producing or high-impact control actions prove replay-safe behavior with deterministic token handling
- [ ] abuse-control gate: high-frequency endpoints and control actions have documented throttling behavior and tested outcomes
- [ ] auditability gate: privileged actions are reconstructable via structured logs or durable audit rows with `request_id` and outcome metadata
- [ ] privacy gate: logs and user-facing errors are non-disclosing and redact raw tokens/PII
- [ ] accessibility gate: touched routes pass keyboard, focus, and status-message checks (WCAG 2.2 AA expectations)
- [ ] performance gate: required route/action p95 budgets pass without security/control regression
- [ ] release-severity gate: zero unresolved high/critical defects in access control, session, injection, and data-exposure categories
- [ ] dependency-vulnerability gate: dependency audit is reviewed and unresolved high/critical package vulnerabilities are blocked or documented via approved blocker entry
- [ ] secrets-scanning gate: no committed secrets or raw credential material in changed files or logs
- [ ] reliability gate: branch QA evidence includes SLI definition, SLO target, measurement window, and release decision against error-budget policy, with canonical release-one reliability target `>= 99.5%` over rolling 28 days and evidence artifact at `.agent/evidence/release/<branch>/sli-slo.md`
