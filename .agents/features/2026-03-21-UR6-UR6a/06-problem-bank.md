# 06 – Problem Bank Management

## Mission

Enable organizers to create, edit, import and delete problem banks and
problems.  Provide a clean UI for adding problems (MCQ, true/false,
numeric and identification) with support for LaTeX, images and
metadata.  Ensure that published competitions are not affected when
items are removed from draft banks.

## Logistics

* **Source branch:** `develop`
* **Target branch:** `feature/problem-bank`
* **Requirements:** 05‑organizer-registration (organizers can log in)
* **Assigned to:** Mabansag, Vj

## Requirements

* Tables `problem_banks` and `problems` exist with RLS rules.
* Organizer dashboard layout and navigation are available.

## Atomic Steps
0. **Research math editors and open‑source tools.**  Before
   building the UI, search for open‑source libraries that simplify
   mathematical input and display.  Consider using MathQuill or
   equation‑editor‑react, which provide a live formula editor with a
   toolbox of common symbols so users do not need to memorise LaTeX.
   Evaluate at least two options, focusing on ease of integration,
   accessibility and mobile friendliness.  This research should also
   cover open‑source CSV/Excel parsers and import utilities to
   streamline bulk uploads.

1. **Bank list and creation.**  Under
   `app/organizer/problem-banks/page.tsx`:
   * Fetch problem banks where `organizer_id = auth.uid()` and
     `is_deleted = false`.
   * Display them in a table or card grid with counts of problems.
   * Add a button `New Bank` that opens a dialog to input a bank name
     and optional description (max 200 words).  On submit, insert
     into `problem_banks`.
2. **Bank detail page.**  Create
   `app/organizer/problem-banks/[id]/page.tsx` showing problems in the
   selected bank.  Provide actions to rename the bank, delete it (soft
   delete by setting `is_deleted = true`) and import problems via
   CSV/Excel.  Show a button to add new problems.
3. **Problem creation/editing form.**  Build a form component
   `ProblemForm.tsx` that supports all problem types:
   * For MCQ and True/False, allow adding/removing options and mark
     which option(s) are correct.
   * For Numeric/Identification, allow specifying one or more correct
     answers and optional tolerance.  Include a math input for LaTeX.
   * Capture difficulty level and tags.
   * Upload an optional image.
   On submit, insert or update the problem in `problems`.  Prevent
   deleting problems used in published competitions.

   To make numeric and identification questions accessible to
   students who are unfamiliar with LaTeX syntax, integrate the math
   editor selected during research (e.g. MathQuill).  Provide a
   toolbox of common mathematical symbols and operations (fractions,
   exponents, radicals, Greek letters) that users can click to insert
   into the editor.  Render a real‑time preview of the expression
   alongside the input field so that mathletes can verify their input
   visually.  Ensure the editor works on mobile devices with touch
   input and keyboard shortcuts on desktop.
4. **Bulk import.**  Provide an import modal that accepts CSV or
   Excel files following a template.  Parse the file client‑side or
   via a serverless function and insert problems into the selected
   bank.  Validate data and report errors.
5. **Soft delete protection.**  When attempting to delete a problem or
   bank, check if it has been used in a published competition.  If so,
   show a warning and prevent deletion.  Otherwise, set
   `is_deleted = true` on the record.
6. **Testing.**  Create, edit and delete problem banks and problems.
   Import problems via CSV.  Attempt to delete problems used in
   published competitions and verify that deletion is blocked.

## Key Files

* `pages/organizer/problem-banks/page.tsx`
* `pages/organizer/problem-banks/[id]/page.tsx`
* `components/ProblemForm.tsx`
* `components/BulkImportModal.tsx`
* `lib/supabase/problems.ts` (RPC wrappers)

## Verification

1. An organizer can create, edit and delete problem banks.
2. Problems of all supported types can be created with LaTeX and
   images.  Imported problems appear correctly.
3. Deleting a bank or problem used in a published competition is
   blocked and displays a warning.
4. Soft‑deleted banks and problems no longer appear in lists.

## Git Branching

Recommended commit titles:

- `feat: build problem bank list and creation UI`
- `feat: implement problem form and CRUD operations`
- `feat: add bulk import for problems via CSV/Excel`
- `fix: enforce soft delete rules for published competitions`
- `test: problem bank management tests`

## Definition of Done

* Organizers can manage their problem banks and problems with a
  user‑friendly interface.
* Soft deletes protect published competitions from accidental changes.
* All CRUD operations are covered by tests and verified manually.
* Checklist item `06-problem-bank` can be marked complete after
  merge.
