# 06 - Problem Bank

- Feature branch: `feature/problem-bank`
- Requirement mapping: UR6 — problem-bank authoring, reusable problem CRUD, math content entry, asset uploads, and bulk import
- Priority: 6
- **Assigned to:** Mabansag, Vj

## Mission

Build the full problem-bank authoring system for organizers and the admin-managed default bank. This includes bank CRUD, problem CRUD, math authoring, asset uploads, tag and difficulty metadata, and bulk import scaffolding that later competition creation depends on.

This branch exists because problem-bank work is not just CRUD. It must include reusable authoring infrastructure, default-bank governance, immutable competition safety, and import ergonomics.

Depends on: `03-interaction-feedback`, `04-admin-user-management`, `05b-deferred-foundation-and-auth`, `05-organizer-registration`.

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

- Use MathLive as the mandatory editable editor for authored problem statements, explanations, and accepted answers, with LaTeX persisted as the durable storage format.
- Keep bulk import as a guided template flow with row-level validation results rather than silent partial imports.
- Treat delete as soft-delete on authored banks and problems so published competition snapshots remain historically valid.
- Reuse the same editor stack for organizer and admin default-bank management to preserve DRY behavior.

### Deterministic Math Tooling Contract (Locked)

- MathLive is mandatory for all editable math fields in this branch (statement, explanation, accepted answers) and in downstream math-input surfaces.
- KaTeX is mandatory for non-editable rendering (preview cards, review panes, read-only tables, exports that render math).
- LaTeX is the only persisted math representation. Persist authored values in `content_latex`, `explanation_latex`, and LaTeX payloads inside `answer_key_json`.
- `content_html` may be used only as a render cache and must never be treated as grading or snapshot source of truth.
- Conversion flow is fixed: MathLive output -> normalization helpers -> persisted LaTeX. Do not persist editor-specific markup.
- Prohibited alternatives for release one: MathQuill, Markdown-math parsers, or plain-text-only math entry as the primary authoring input.
- Branches `07`, `08`, `11`, `13`, and `14` consume this contract unchanged.

## Requirements

- bank CRUD for organizers and admin-managed default bank
- problem CRUD supporting MCQ, true/false, numeric, and identification
- numeric and identification validators must accept one-or-many equivalent accepted answers as a canonical array contract (order-insensitive after normalization)
- math authoring with MathLive, a visible symbol toolbox, and live KaTeX preview
- optional image upload for geometry and diagram problems
- metadata fields for difficulty, tags, explanation, and authoring notes
- bulk import flow with a downloadable template and validation feedback
- safe soft-delete behavior when draft and published competitions reference the same source records

### Deterministic Bulk Import Contract

- Template columns and required order: `type,difficulty,tags,content_latex,answer_key_json,options_json,explanation_latex,authoring_notes,image_path`.
- `type` allowed values: `mcq`, `tf`, `numeric`, `identification`.
- `difficulty` allowed values: `easy`, `average`, `difficult`.
- `options_json` is required for `mcq` and `tf`; option labels must be unique and parse deterministically.
- `answer_key_json` must follow type-specific validation; for `numeric` and `identification`, accepted answers must be normalized into a canonical array contract (one or many accepted values) and deduplicated after normalization.
- CSV template support for `numeric` and `identification` accepts pipe-delimited answer variants that import into the canonical accepted-answer array.
- invalid rows are rejected with row number plus reason and do not block valid rows.
- Import results must always return `total_rows`, `inserted_rows`, `failed_rows`, and per-row error details.

## Atomic Steps

1. Build the bank list page with owner-scoped and default-bank sections.
2. Add bank create and edit forms with validation and soft-delete confirmation.
3. Build the problem list view within a bank with filters by type, difficulty, and tag.
4. Implement problem create and edit forms using MathLive for editable input and a persistent KaTeX preview panel for every math-enabled field.
5. Add answer-shape validation per problem type, enforce unique MCQ choices, and enforce canonical multi-answer acceptance for `numeric` and `identification` in both form and import validators.
6. Integrate image upload with preview, replace, and remove flows.
7. Add soft-delete behavior and ownership checks for banks and problems.
8. Build the bulk import template, parser, validation pipeline, partial-success write path, and deterministic import result summaries (`total_rows`, `inserted_rows`, `failed_rows`, row-level errors).
9. Reuse the same authoring experience for the admin-managed default bank where allowed.
10. Add tests for validators, import parsing helpers, and any extracted ownership logic.

## Key Files

- `app/organizer/problem-bank/page.tsx`
- `app/organizer/problem-bank/create/page.tsx`
- `app/organizer/problem-bank/[bankId]/page.tsx`
- `app/organizer/problem-bank/[bankId]/problem/[problemId]/page.tsx`
- `app/admin/problem-banks/*`
- `components/problem-bank/*`
- `components/math-editor/*`
- `lib/problem-bank/*`
- `supabase/migrations/*` (including storage policy SQL for `problem-assets` and related organizer upload paths)

## Verification

- Manual QA: create banks, create and edit each problem type, upload images, import sample CSV rows, soft-delete draft items, open admin default-bank flows.
- Automated: lint plus tests for import parsers, answer validators, and any normalization helpers introduced here.
- Accessibility: math editor labeling, image upload instructions, import error summaries, and keyboard-safe dialogs.
- Performance: server pagination is the default list strategy (25 rows per page), and filter/search queries stay at p95 <= 400 ms on a 2,000-problem reference dataset; incremental loading is optional for mobile-only surfaces using the same filter contract.
- Edge cases: deleting content already used by a published competition does not corrupt historical data.

## Security and Reliability Addendum (2026-04)

- require optimistic concurrency controls on bank/problem writes to prevent stale tab overwrites (`write_conflict` outcome on stale revisions)
- require bulk-import idempotency token support so retries return deterministic summaries without duplicate logical inserts
- require non-edit read paths to exclude sensitive answer-key payload fields where not needed by the current role/context
- require upload integrity checks (MIME validation, size cap, canonical key handling) before persisting asset references
- require immutable snapshot boundary protection so authoring-table edits never mutate published competition snapshots

### Additional Verification Gates

- concurrency QA: simultaneous edits on one record produce deterministic conflict behavior
- import QA: repeated import retries with the same idempotency token do not duplicate accepted rows
- security QA: invalid MIME/oversized uploads are rejected and sensitive payloads are redacted from non-edit contexts

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
