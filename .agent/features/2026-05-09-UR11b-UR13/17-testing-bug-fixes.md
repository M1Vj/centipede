# 17 - Testing Bug Fixes

- Feature branch: `feature/testing-bug-fixes`
- Requirement mapping: UR1-UR16 — release-quality verification, full-system regression testing, bug fixing, accessibility review, performance hardening, and release readiness
- Priority: 17
- **Assigned to:** Abenoja, Jaaseia Gian R.; Celeres, Anthony; Mabansag, Vj

## Mission

Execute the final release hardening pass: full regression testing, accessibility review, performance tuning, browser and device QA, bug fixing, documentation finalization, and release preparation.

This branch exists because many critical issues only surface when flows are tested end to end. The rebuild must reserve an explicit branch for truth-finding, not assume feature completion equals release readiness.

Depends on: `01` through `16`.

Unblocks: release branch creation and deployment.

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

- Keep tests layered: unit and helper coverage for core logic, Playwright for end-to-end flows, and manual exploratory QA for live edge cases.
- Measure actual page performance and interaction stability instead of assuming the UI is fast because it feels fast locally.
- Fix the source of a bug and add regression coverage where practical instead of relying on manual memory.
- Finalize docs in the same branch so the project source of truth matches the releasable system.

## Requirements

- run and stabilize all lint, unit, integration, and end-to-end suites
- perform manual regression for every major role workflow
- perform accessibility and mobile review across the whole app
- measure performance on critical routes and resolve major regressions
- fix bugs discovered during QA and add regression tests
- finalize `.agent/` docs, `README.md`, and release notes or changelog inputs

## Atomic Steps

1. Establish the final automated test matrix and make sure it runs locally.
2. Add missing Playwright coverage for core user journeys if gaps remain.
3. Run the full regression suite and capture failures.
4. Perform role-based manual QA across anonymous, mathlete, organizer, and admin workflows.
5. Run accessibility review and fix blockers.
6. Run performance checks on critical routes and fix meaningful regressions.
7. Apply bug fixes with targeted regression tests.
8. Reconcile documentation with the final system, including `.agent/` and release notes.
9. Validate migrations, env assumptions, and deploy/build behavior.

## Key Files

- `tests/**/*`
- Playwright config and e2e specs
- performance and accessibility notes generated during QA
- `README.md`
- `.agent/*`

## Verification

- Automated: lint, unit, integration, and e2e all pass.
- Manual QA: all primary role workflows and major edge cases are exercised.
- Accessibility: keyboard, focus, labeling, contrast, and mobile-safe interactions pass the final sweep.
- Performance: critical routes meet acceptable local and staging thresholds with no major regression.
- Edge cases: disconnects, recalculation after publish, export failures, suspended-user access, invalid roster changes, large tables, and notification delivery.

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
  - Testing: lint, unit, integration, Playwright, manual regression
  - Docs: `.agent/`, README, and release notes aligned to final behavior

## Definition of Done

- the full system is verified rather than assumed
- high-severity bugs are fixed with regression coverage
- docs reflect the final releasable state
- the codebase is ready to move into a release branch without hidden implementation debt
