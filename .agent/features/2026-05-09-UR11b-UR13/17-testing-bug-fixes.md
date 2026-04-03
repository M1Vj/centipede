# 17 - Testing Bug Fixes

- Feature branch: `feature/testing-bug-fixes`
- Requirement mapping: UR1-UR16 — release-quality verification, full-system regression testing, bug fixing, accessibility review, performance hardening, and release readiness
- Priority: 17
- **Assigned to:** Abenoja, Jaaseia Gian R.; Celeres, Anthony; Mabansag, Vj

## Mission

Execute the final release hardening pass: full regression testing, accessibility review, performance tuning, browser and device QA, bug fixing, documentation finalization, and release preparation.

This branch exists because many critical issues only surface when flows are tested end to end. The rebuild must reserve an explicit branch for truth-finding, not assume feature completion equals release readiness.

Depends on: `01-foundation`, `02-authentication`, `03-interaction-feedback`, `04-admin-user-management`, `05b-deferred-foundation-and-auth`, `05-organizer-registration`, `06-problem-bank`, `07-scoring-system`, `08-competition-wizard`, `09-team-management`, `10-competition-search`, `11-arena`, `12-anti-cheat`, `13-review-submission`, `14-leaderboard-history`, `15-notifications-polish`, `16-participant-monitoring`.

Unblocks: release branch creation and deployment.

## Scope Boundary

- This branch is for regression testing, bug fixes, hardening, and release-contract completion only.
- Do not add net-new product capabilities, new role workflows, or ownership changes that belong to earlier feature branches.
- Do not re-scope branch `15-notifications-polish` or `16-participant-monitoring`; only fix defects found while validating them.
- Playwright and other browser-automation tooling are forbidden in this branch unless an entry with `request_type = browser_automation_exception` and `status = approved` is logged in `.agent/PROCESS-FLOW.md` under `## CORE_PATCH_REQUESTS` using the canonical required fields before execution.
- If a release blocker requires out-of-scope architecture work, record it in `.agent/PROCESS-FLOW.md` under `## CORE_PATCH_REQUESTS` as `request_type = out_of_scope_blocker` using the canonical required fields, and do not silently absorb it into this branch.

## Route Naming Contract (Final QA Matrix)

- Public and auth: `/`, `/auth/login`, `/auth/sign-up`, `/auth/forgot-password`.
- Core role homes: `/mathlete`, `/organizer`, `/admin`.
- Notification surfaces: `/notifications`, `/settings/notifications`.
- Competition and results surfaces: `/mathlete/competition/[competitionId]/leaderboard`, `/organizer/competition/[competitionId]/leaderboard`.
- Canonical notification deep-link targets (branch 15): `/organizer/status`, `/mathlete/competition/[competitionId]/review`, `/mathlete/competition/[competitionId]/answer-key`, `/mathlete/history`, `/organizer/history`.
- Live operations surfaces: `/organizer/competition/[competitionId]/participants`, `/admin/competitions/[competitionId]/participants`.
- Any route touched by a bug fix must be added to the branch QA evidence list before merge.

## Command Verification Contract (Deterministic)

- Baseline commands that must pass with exit code 0: `npm run lint`, `npm run test` (Vitest), `npm run build`.
- Targeted Vitest suites for this branch must run when corresponding tests exist: `npm run test -- tests/notifications` and `npm run test -- tests/monitoring`.
- Dev-server smoke verification is deterministic: start `npm run dev`, confirm startup without runtime errors, probe required routes, then intentionally stop the process and capture probe evidence in QA notes.
- Browser automation is forbidden for this branch: do not run Playwright or other browser-automation tooling; if automation is required by external policy, log an entry with `request_type = browser_automation_exception` and `status = approved` in `.agent/PROCESS-FLOW.md` under `## CORE_PATCH_REQUESTS` using the canonical required fields before execution.
- If migrations changed while fixing bugs, run `npm run supabase:status` and `npm run supabase:db:reset`.

## Full Context

- Business context: this branch converts a feature-complete build into a releasable product.
- User roles: all roles and all major user journeys.
- UI flow: full regression across public, auth, mathlete, organizer, and admin paths.
- Backend flow: migration verification, RLS checks, grading correctness, realtime stability, export and notification delivery.
- Related tables/functions: every production surface created earlier.
- Edge cases: slow network, concurrent organizer and participant activity, stale browser tabs, mobile keyboards, large data volumes, failed exports, recalculation after publication.
- Security concerns: confirm no client route can bypass ownership or role checks; verify service-role usage never leaks into client bundles.
- Performance concerns: landing, dashboard, discovery, problem-bank, wizard, arena, and monitoring flows need explicit profiling.
- Accessibility/mobile: this is the branch where every touched route gets a final pass, not just the newest pages.

## Research Findings / Implementation Direction

- Keep tests layered: unit and helper coverage for core logic, targeted integration suites where available, and manual exploratory QA for live edge cases.
- Measure actual page performance and interaction stability instead of assuming the UI is fast because it feels fast locally.
- Fix the source of a bug and add regression coverage where practical instead of relying on manual memory.
- Finalize docs in the same branch so the project source of truth matches the releasable system.

## Requirements

- run and stabilize the deterministic command matrix in this document
- execute manual regression on every route in the final QA matrix
- verify branch 15 notification deep-link targets and canonical notification dedupe behavior using `(recipient_id, event_identity_key)`
- perform accessibility and mobile review across all touched routes
- measure performance on critical routes and resolve high-impact regressions
- fix QA-discovered bugs and add regression tests for each fixed defect where practical
- verify admin live support remains force-pause only and that pause/resume/extend/disconnect-reset flows enforce the canonical `(reason, request_idempotency_token)` tuple
- finalize `.agent/` docs, `README.md`, and release notes or changelog inputs
- capture out-of-scope blockers in `.agent/PROCESS-FLOW.md` under `## CORE_PATCH_REQUESTS` only

## Atomic Steps

1. Run baseline command verification and capture initial failures.
2. Run targeted Vitest notifications and monitoring suites when present.
3. Run deterministic dev-server smoke verification: start `npm run dev`, probe required routes, then stop the process intentionally and capture evidence.
4. Execute manual QA across the explicit route matrix for anonymous, mathlete, organizer, and admin journeys.
5. Execute accessibility checks for keyboard flow, focus behavior, labels, and contrast on touched routes.
6. Execute performance checks on critical routes and identify regressions.
7. Apply bug fixes, then add or update regression tests before rerunning failing checks.
8. Re-run full command verification until clean or until remaining blockers are explicitly documented.
9. Confirm Vitest-only automation was used (`npm run test` and targeted filters), and confirm Playwright/browser automation was not executed; if external policy requires it, log an entry with `request_type = browser_automation_exception` and `status = approved` in `.agent/PROCESS-FLOW.md` under `## CORE_PATCH_REQUESTS` using the canonical required fields before running it.
10. Reconcile release documentation and capture unresolved out-of-scope blockers in `.agent/PROCESS-FLOW.md` under `## CORE_PATCH_REQUESTS` as `request_type = out_of_scope_blocker` entries.
11. Validate migration and environment assumptions before release-branch handoff.

## Key Files

- `tests/**/*`
- QA evidence notes and route-matrix checklists generated during branch validation
- performance and accessibility notes generated during QA
- `README.md`
- `.agent/*`

## Verification

- Command verification: `npm run lint`, `npm run test`, and `npm run build` pass with exit code 0.
- Targeted suite verification: `npm run test -- tests/notifications` and `npm run test -- tests/monitoring` pass when suites exist.
- Dev-server verification: `npm run dev` starts cleanly, required route probes succeed during runtime, and the process is intentionally stopped after verification.
- Browser-automation policy verification: Playwright and other browser-automation tooling are not used in this branch; any external requirement is documented as `request_type = browser_automation_exception` with `status = approved` in `.agent/PROCESS-FLOW.md` under `## CORE_PATCH_REQUESTS` using the canonical required fields before execution.
- Manual route verification: every route in the Final QA Matrix is exercised with role-appropriate access checks.
- Accessibility verification: keyboard flow, focus, labeling, contrast, and mobile-safe interactions pass on touched routes.
- Performance verification: critical routes show no high-severity regression in load and interaction behavior.
- Edge-case verification: disconnects, recalculation after publish, export failures, suspended-user access, invalid roster changes, large tables, notification dedupe by `(recipient_id, event_identity_key)`, and force-pause-only plus `(reason, request_idempotency_token)` enforcement are exercised.

## Git Branching

- Branch from: `develop`
- Merge back into: `develop`
- Recommended atomic commits:
  - `test: add missing end-to-end coverage and stabilize suites`
  - `fix: resolve regression issues found during qa`
  - `perf: improve critical route and interaction performance`
  - `docs: finalize release documentation and agent files`
- PR title template: `Release readiness: regression fixes, verification, and final hardening`
- PR description template:
  - Summary: full QA, bug fixes, accessibility and performance hardening, docs finalization
  - Testing: lint, unit and integration suites, deterministic dev-server smoke checks, manual regression
  - Docs: `.agent/`, README, and release notes aligned to final behavior

## Definition of Done

- the full system is verified rather than assumed
- high-severity bugs are fixed with regression coverage
- docs reflect the final releasable state
- unresolved out-of-scope blockers are explicitly captured in `.agent/PROCESS-FLOW.md` under `## CORE_PATCH_REQUESTS`
- the codebase is ready to move into a release branch without hidden implementation debt
