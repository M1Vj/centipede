# Atomic Branching Structure

## Branch Model

### Long-Lived Branches

- `main`: production branch
- `develop`: integration branch for approved feature work

### Supporting Branches

- `feature/<slug>`: one planned implementation branch from `.agent/features/...`
- `fix/<slug>`: corrective work discovered during a feature or QA cycle
- `release/<code>`: release preparation only after feature-complete integration
- `hotfix/<slug>`: urgent production repair from `main`
- `docs/<slug>`: documentation-only work when it is intentionally separate from feature implementation

## Source and Target Rules

- all planned feature branches start from `develop`
- all planned feature branches merge back into `develop`
- hotfix branches start from `main` and merge into both `main` and `develop`
- release branches start from `develop`, accept only stabilization work, then merge into `main` and back into `develop`

## Feature Guide Mapping Rules

- every numbered markdown file under `.agent/features/<bucket>/NN-<slug>.md` maps to exactly one implementation branch
- bucket folders are sequencing containers only; they do not change the branch name
- the canonical branch name is always the `feature/<slug>` value written inside the feature file
- feature numbers must stay stable once introduced so checklist history remains traceable

## Execution Boundary

- every branch guide must be implementable using only the branch guide itself, referenced repo-local files, and shared `.agent/` docs
- `.agent/PROCESS-FLOW.md` must be treated as the workflow source of truth when a branch touches role behavior, approvals, arena flow, notifications, publication rules, or post-competition handling
- the live Figma frame may be used for visual alignment when the feature file allows it
- current internet research may be used for implementation details and best practices
- no branch guide may assume access to external local files outside the repository

## Naming Conventions

- branch names use concise kebab-case: `feature/problem-bank`
- PR titles use requirement IDs plus outcome, for example `UR6-UR6a: problem bank and scoring foundation`
- commit messages follow Conventional Commits
- documentation references use the feature number and slug exactly as written in `.agent/features`

## Merge Order Logic

The merge order is strictly sequential unless a later feature explicitly declares a safe parallel start point. The default order is:

1. `01-foundation`
2. `02-authentication`
3. `03-interaction-feedback`
4. `04-admin-user-management`
5. `05-organizer-registration`
6. `06-problem-bank`
7. `07-scoring-system`
8. `08-competition-wizard`
9. `09-team-management`
10. `10-competition-search`
11. `11-arena`
12. `12-anti-cheat`
13. `13-review-submission`
14. `14-leaderboard-history`
15. `15-notifications-polish`
16. `16-participant-monitoring`
17. `17-testing-bug-fixes`

## Atomic Commit Rules

- one logical change per commit
- feature branches may contain multiple commits, but each commit must stand on its own
- do not lump schema, UI, and test changes into one giant commit when they can be reviewed independently
- update `.agent/checklist.md`, `.agent/DATABASE-EDR-RLS.md`, and `.agent/learned-rules.md` in the same branch that introduces the relevant change

## Verification Gates

Before a feature branch is considered complete:

- run lint
- run relevant unit and integration tests
- run local dev and perform manual route checks
- inspect the changed database migration and RLS logic
- perform an accessibility pass on the touched flows
- verify mobile layouts for any new page or modal

## Documentation Update Rules

Every implementation branch must review whether it changed:

- branch scope or sequencing
- database tables, enums, triggers, or RLS
- project-level rules or discovered constraints
- verification expectations

If yes, update the appropriate `.agent/` files in the same branch.

## Fix and Hotfix Rules

- if a bug is discovered while implementing a planned feature and the fix is required for that feature to work, keep it inside the feature branch and document it in the feature file
- if a bug is unrelated to the current feature, create a `fix/<slug>` branch from `develop`
- if production is already affected, create `hotfix/<slug>` from `main`

## AI Workflow Rules

- do not push branches unless explicitly instructed
- use Gemini CLI at meaningful checkpoints when capacity permits
- if Gemini is unavailable because of repeated capacity failures, continue with local analysis and note the failure in the handoff
- do not treat external model output as authoritative without review

## PR Template Rules

Every feature file includes:

- branch source and merge target
- recommended atomic commit titles
- PR title template
- PR description template

No feature branch is complete until those sections are respected in practice.
