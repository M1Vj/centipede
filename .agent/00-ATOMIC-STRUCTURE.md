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
- `.agent/DATABASE-EDR-RLS.md` and `.agent/PROCESS-FLOW.md` are target-contract sources of truth; if current workspace artifacts differ, follow target contracts and branch sequencing
- baseline-vs-target audit rule: missing routes or tables that belong to not-yet-executed branches are expected and must be treated as planned sequencing gaps
- organizer eligibility ownership is split: branch `04-admin-user-management` writes organizer-application decisions only, while branch `05-organizer-registration` owns organizer-role activation/provisioning (`profiles.role`, `profiles.approved_at`, including approved rows with `profile_id` null)
- the live Figma frame may be used for visual alignment when the feature file allows it
- current internet research may be used for implementation details and best practices
- no branch guide may assume access to external local files outside the repository

## Naming Conventions

- branch names use concise kebab-case: `feature/problem-bank`
- PR titles use requirement IDs plus outcome, for example `UR6-UR6a: problem bank and scoring foundation`
- commit messages follow Conventional Commits
- documentation references use the feature number and slug exactly as written in `.agent/features`

## Route Parameter Naming Policy

- use explicit dynamic segment names instead of generic `[id]` when defining new routes or updating docs
- canonical names: `[competitionId]`, `[teamId]`, `[bankId]`, `[problemId]`, `[applicationId]`, `[attemptId]`, `[registrationId]`, `[disputeId]`, `[userId]`
- existing workspace admin pages may still include `[id]` segments; treat them as compatibility paths and do not reuse that pattern in new work
- for competition-facing pages, `[competitionId]` is mandatory; if an older branch guide shows `[id]`, treat it as a compatibility alias for `[competitionId]` rather than a different entity
- downstream branches must reuse upstream parameter names and must not rename route params without updating all affected `.agent/` docs in the same branch

Admin route migration contract (required sequence):

1. compatibility introduce canonical admin routes with `[competitionId]` and `[bankId]` while existing `[id]` readers still exist
2. cut over all route producers to canonical params only (navigation, redirects, links, notifications metadata); before this cutover lands, existing `[id]` producers may still exist as compatibility
3. after step 2 is merged, verify zero new `/admin/**/[id]` producers during branch `17-testing-bug-fixes`
4. remove deprecated `[id]` handlers only after producer cutover and verification

## Blank-Slate Contract Boundaries

- current workspace may still contain existing `[id]` routes in admin pages
- current app routes may not yet include future-branch target paths; this is expected until the owning branch executes
- current migrations may still include earlier boolean lifecycle fields from pre-target schema stages
- current migrations may not yet include future-branch target tables or RPC-backed artifacts from the ownership matrix; this is expected until the owning branch executes
- lifecycle enum migration must follow compatibility -> deterministic backfill -> dual-write compatibility -> enum-only cutover -> deprecated-field drop (see `.agent/DATABASE-EDR-RLS.md` Section G)
- per-branch schema and trusted-function ownership must follow the matrix in `.agent/DATABASE-EDR-RLS.md` Section G; do not introduce a domain table or primary RPC outside its owning branch without updating that matrix first
- target schema and route contracts are introduced by branch sequence; do not assume current code state already matches target contracts

## Merge Order Logic

The merge order is strictly sequential unless a later feature explicitly declares a safe parallel start point. The default order is:

1. `01-foundation`
2. `02-authentication`
3. `03-interaction-feedback`
4. `04-admin-user-management`
5. `05b-deferred-foundation-and-auth`
6. `05-organizer-registration`
7. `06-problem-bank`
8. `07-scoring-system`
9. `08-competition-wizard`
10. `09-team-management`
11. `10-competition-search`
12. `11-arena`
13. `12-anti-cheat`
14. `13-review-submission`
15. `14-leaderboard-history`
16. `15-notifications-polish`
17. `16-participant-monitoring`
18. `17-testing-bug-fixes`

## Atomic Commit Rules

- one logical change per commit
- feature branches may contain multiple commits, but each commit must stand on its own
- do not lump schema, UI, and test changes into one giant commit when they can be reviewed independently
- update `.agent/checklist.md`, `.agent/DATABASE-EDR-RLS.md`, and `.agent/learned-rules.md` in the same branch that introduces the relevant change

## Verification Gates

Before a feature branch is considered complete:

- run `npm run lint`
- run `npm run test`
- run `npm run build`
- run `npm run dev` and manually verify all routes touched by the branch; capture a route checklist artifact with `route`, `role`, `result`, and `evidence_note`
- if a branch modifies `supabase/migrations/*`, run `npm run supabase:status` and `npm run supabase:db:reset`
- inspect changed migration and RLS logic using a checklist artifact with `migration_id`, `changed_objects`, `policy_checks`, and `result`
- perform an accessibility pass on touched flows with explicit checks for keyboard navigation, focus order, labels, and contrast
- verify mobile layouts for each new page or modal at minimum viewports `375x812` and `768x1024`, and record pass or fail evidence in QA notes

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
- use Gemini CLI at fixed checkpoints: before risky architecture refactors, after core implementation and before final verification, and before final handoff on substantial branches
- if Gemini is unavailable after 3 consecutive capacity failures across headless and interactive attempts, continue with local analysis and note the failure evidence in the handoff
- do not treat external model output as authoritative without review

## PR Template Rules

Every feature file includes:

- branch source and merge target
- recommended atomic commit titles
- PR title template
- PR description template

No feature branch is complete until those sections are respected in practice.
