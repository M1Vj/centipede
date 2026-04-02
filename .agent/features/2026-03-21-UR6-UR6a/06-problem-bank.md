# 06 - Problem Bank

- Feature branch: `feature/problem-bank`
- Requirement mapping: UR6 — problem-bank authoring, reusable problem CRUD, math content entry, asset uploads, and bulk import
- Priority: 6
- **Assigned to:** Mabansag, Vj

## Mission

Build the full problem-bank authoring system for organizers and the admin-managed default bank. This includes bank CRUD, problem CRUD, math authoring, asset uploads, tag and difficulty metadata, and bulk import scaffolding that later competition creation depends on.

This branch exists because problem-bank work is not just CRUD. It must include reusable authoring infrastructure, default-bank governance, immutable competition safety, and import ergonomics.

Depends on: `03-interaction-feedback`, `04-admin-user-management`, `05-organizer-registration`.

Unblocks: scoring rules, competition wizard, default-bank moderation, answer-key snapshots.

## Full Context

- Business context: problem authoring quality directly determines competition quality and organizer adoption.
- User roles: organizers author and manage their own banks; admins manage the default shared bank and moderate organizer content.
- UI flow: bank list, bank create/edit/delete, problem list, problem create/edit/delete, import entry point, asset preview, read-only resource views.
- Backend flow: bank and problem writes, storage uploads for diagrams, tag search, safe soft-delete logic, admin default-bank handling.
- Related tables/functions: `problem_banks`, `problems`, `admin_audit_logs`, Storage paths.
- Edge cases: deleting a problem used in a published competition, malformed CSV imports, invalid answer payloads, duplicate bank names, missing image cleanup.
- Security concerns: organizer ownership, admin read-all but mutate-own/default-bank rules, safe moderation deletes, asset path permissions.
- Performance concerns: bank lists, tag filters, and problem previews must remain responsive; import validation should batch and report row-level errors.
- Accessibility/mobile: authoring forms must remain usable on tablets and phones, especially for math entry and image upload.

## Research Findings / Implementation Direction

- Use MathLive as the primary editor for authored problem statements, explanations, and accepted answers, with LaTeX persisted as the durable storage format.
- Keep bulk import as a guided template flow with row-level validation results rather than silent partial imports.
- Treat delete as soft-delete on authored banks and problems so published competition snapshots remain historically valid.
- Reuse the same editor stack for organizer and admin default-bank management to preserve DRY behavior.

## Requirements

- bank CRUD for organizers and admin-managed default bank
- problem CRUD supporting MCQ, true/false, numeric, and identification
- math authoring with live preview and symbol affordances
- optional image upload for geometry and diagram problems
- metadata fields for difficulty, tags, explanation, and authoring notes
- bulk import flow with a downloadable template and validation feedback
- safe soft-delete behavior when draft and published competitions reference the same source records

## Atomic Steps

1. Build the bank list page with owner-scoped and default-bank sections.
2. Add bank create and edit forms with validation and soft-delete confirmation.
3. Build the problem list view within a bank with filters by type, difficulty, and tag.
4. Implement problem create and edit forms using MathLive and static KaTeX preview where needed.
5. Add answer-shape validation per problem type and enforce unique MCQ choices.
6. Integrate image upload with preview, replace, and remove flows.
7. Add soft-delete behavior and ownership checks for banks and problems.
8. Build the bulk import template, parser, validation pipeline, and import results UI.
9. Reuse the same authoring experience for the admin-managed default bank where allowed.
10. Add tests for validators, import parsing helpers, and any extracted ownership logic.

## Key Files

- `app/organizer/problem-bank/page.tsx`
- `app/organizer/problem-bank/create/page.tsx`
- `app/organizer/problem-bank/[id]/page.tsx`
- `app/organizer/problem-bank/[id]/problem/[problemId]/page.tsx`
- `app/admin/problem-banks/*`
- `components/problem-bank/*`
- `components/math-editor/*`
- `lib/problem-bank/*`
- `supabase/migrations/*`
- Storage policy definitions

## Verification

- Manual QA: create banks, create and edit each problem type, upload images, import sample CSV rows, soft-delete draft items, open admin default-bank flows.
- Automated: lint plus tests for import parsers, answer validators, and any normalization helpers introduced here.
- Accessibility: math editor labeling, image upload instructions, import error summaries, and keyboard-safe dialogs.
- Performance: large bank lists and problem lists remain usable with pagination or incremental loading.
- Edge cases: deleting content already used by a published competition does not corrupt historical data.

## Git Branching

- Branch from: `develop`
- Merge back into: `develop`
- Recommended atomic commits:
  - `feat(problem-bank): add bank list and CRUD flows`
  - `feat(problem-bank): add problem authoring and math editor support`
  - `feat(problem-bank): add asset uploads and validation`
  - `feat(problem-bank): add bulk import pipeline`
- PR title template: `UR6: problem bank authoring, import, and default-bank support`
- PR description template:
  - Summary: problem bank CRUD, math authoring, uploads, import, safe delete rules
  - Testing: lint, helper tests, manual authoring and import checks
  - Docs: DB doc updated for problem structures and storage rules

## Definition of Done

- organizers can fully author and manage reusable problem banks
- admins can manage the shared default bank through the same core tooling
- imported and manually-authored problems use the same validation model
- later competition features can trust the authoring data contract
