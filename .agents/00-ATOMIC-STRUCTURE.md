# Atomic Branching Structure

This document defines the branching strategy for the Mathwiz Arena project.
All team members must adhere to this structure to ensure a predictable and
scalable workflow.

## Primary Branches

| Branch   | Purpose                                                      |
|---------|--------------------------------------------------------------|
| `main`  | Production‑ready code deployed to Vercel.  Only release and  |
|         | hotfix branches merge here.                                  |
| `develop` | Integration branch where feature branches are merged.  This  |
|         | branch always reflects the latest completed work ready for    |
|         | staging.                                                     |

## Supporting Branches

* **Feature branches** (`feature/<slug>`)
  * Branch off of `develop`.
  * Implement a single feature or user requirement.  Do not include
    numbers or dates in the branch name.  Use a concise kebab‑case
    description (e.g. `feature/problem-bank`).
  * Once complete and verified locally, open a Pull Request back into
    `develop`.  The PR title should correspond to the `.agents` feature
    file (e.g. `UR6: Problem bank management`).

* **Fix branches** (`fix/<slug>`)
  * Branch off of `develop` (or from a release branch if the fix must
    land in a specific version).
  * Address bugs or regressions found during development.
  * Merge back into `develop` after review.  For urgent production
    fixes, merge into `main` via a hotfix branch.

* **Release branches** (`release/<version>`)
  * Created from `develop` when a milestone is feature‑complete and
    stable.  The version string reflects semantic versioning (e.g.
    `release/1.0.0`).
  * Only bug fixes, documentation, and polishing should be committed
    here.  After testing, merge into `main` and tag the release.

* **Hotfix branches** (`hotfix/<slug>`)
  * Created from `main` to address critical issues in production.
  * After the fix is implemented, merge into both `main` and
    `develop` (or the current release branch).

## Commit Guidelines

* Use **atomic commits**: each commit should represent a single logical
  change.  This makes history easier to read and revert.
* Write conventional commit messages without numbering or dating
  information.  For example, `feat: implement team invitation flow` or
  `fix: correct scoring calculation`.
* Do not push directly to `main` or `develop`.  Always create a
  feature/fix/hotfix branch and open a Pull Request.
* Before merging, ensure that `npm run lint` and any automated tests
  pass.  Visual checks (running `npm run dev` and navigating the
  relevant pages) are also required.
