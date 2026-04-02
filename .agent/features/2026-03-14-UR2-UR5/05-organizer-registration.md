# 05 - Organizer Registration

- Feature branch: `feature/organizer-registration`
- Requirement mapping: UR2, partial UR3 and UR5 — organizer application intake, approval status visibility, organizer onboarding, and organizer profile/settings activation
- Priority: 5
- **Assigned to:** Mabansag, Vj

## Mission

Implement the full organizer eligibility lifecycle: public application entry, legal consent, file upload, review-status visibility, approval activation, rejection feedback, credential handoff, and organizer workspace onboarding. This branch also establishes organizer profile and settings surfaces because they are part of the actual post-approval workflow.

This branch exists because the original plan treated organizer registration as just a form. In reality it is a lifecycle that touches legal consent, uploads, admin review, notification delivery, and organizer-first-run experience.

Depends on: `02-authentication`, `03-interaction-feedback`, `04-admin-user-management`.

Unblocks: problem banks, competition authoring, organizer notifications, organizer history, and organizer monitoring.

## Full Context

- Business context: organizer access must be gated to preserve trust in competitions and shared content.
- User roles: public organizer applicants without organizer accounts yet, admins reviewing them, newly approved organizers entering their workspace after credential delivery.
- UI flow: public apply CTA, organizer application form, secure review-status page, organizer-first-run dashboard, profile/settings completion.
- Backend flow: public application insert, file upload to storage, admin review, organizer account provisioning after approval, notification or email delivery, organizer dashboard redirect on first login.
- Related tables/functions: `organizer_applications`, `profiles`, `notifications`, `notification_preferences`, `admin_audit_logs`.
- Edge cases: duplicate applications, missing logo upload, approved user with stale session, rejected user reapplying, organizer application from suspended user.
- Security concerns: only the applicant can submit/update draft application data; approval is admin-only; storage paths must be permissioned.
- Performance concerns: form validation and upload progress must remain usable on low-end devices.
- Accessibility/mobile: long forms require grouped sections, inline validation, sticky progress, and touch-friendly upload affordances.

## Research Findings / Implementation Direction

- Keep application state server-trusted and idempotent so duplicate form submits do not create duplicate approval rows.
- Use Storage paths rather than public ad hoc URLs for organizer logos and proof assets.
- Treat organizer profile/settings as part of onboarding so later feature branches are not forced to create the organizer shell retroactively.
- Use secure status lookup plus approval or rejection messaging as the immediate applicant feedback path. In-app notifications apply after the organizer account exists; broader delivery polish lands in the notification branch.

## Requirements

- add organizer application entry points on the public landing page without requiring a pre-existing organizer account
- collect required organization information, statement, contact details, and legal consent
- support optional logo upload and validate file type/size
- show review status and rejection reason to the applicant through a secure status lookup path
- activate organizer role only through admin approval
- deliver organizer credentials or invite instructions after approval
- route newly approved organizers into the organizer workspace
- add organizer profile and settings pages needed before problem-bank work begins

## Atomic Steps

1. Add organizer CTA sections on the public landing page and any relevant non-organizer surfaces.
2. Build the organizer application form with structured sections and clear legal consent copy.
3. Add upload handling for logo assets using Supabase Storage.
4. Persist application data with idempotent submit behavior and pending status.
5. Build the applicant status page with pending, approved, and rejected states using a secure lookup reference rather than organizer login.
6. Integrate approval notifications and organizer credential or invite delivery handoff from the admin approval path.
7. Add organizer-first-run routing so newly approved users land in the organizer portal.
8. Build organizer profile and settings pages with editable organization-facing fields.
9. Verify the admin review path from branch 04 works cleanly end to end with the new application payload and credential-delivery behavior.

## Key Files

- `app/organizer/apply/page.tsx`
- `app/organizer/status/page.tsx`
- `app/organizer/layout.tsx`
- `app/organizer/page.tsx`
- `app/organizer/profile/page.tsx`
- `app/organizer/settings/page.tsx`
- `components/organizer/*`
- `lib/organizer/*`
- `supabase/storage` policies or related config
- `supabase/migrations/*`

## Verification

- Manual QA: submit an organizer application without an organizer account, upload a logo, inspect pending status, approve and reject through admin, verify credential handoff and organizer redirect after approval.
- Automated: add validation and helper tests where logic is extracted.
- Accessibility: grouped form sections, required-state messaging, file input labeling, and error summaries.
- Performance: uploads show progress and failure states without freezing the form.
- Edge cases: duplicate submission, reapply after rejection, stale session after approval, invalid file types.

## Git Branching

- Branch from: `develop`
- Merge back into: `develop`
- Recommended atomic commits:
  - `feat(organizer): add application entry points and form`
  - `feat(organizer): add application status and review states`
  - `feat(organizer): add organizer profile and settings onboarding`
  - `refactor(organizer): connect approval flow to role activation`
- PR title template: `UR2: organizer eligibility, onboarding, and workspace activation`
- PR description template:
  - Summary: organizer application flow, review states, uploads, organizer-first-run workspace
  - Testing: lint, manual applicant/admin review checks
  - Docs: DB doc updated for uploads and approval lifecycle

## Definition of Done

- legitimate organizer applicants can submit and track an application
- approval and rejection behavior is consistent with admin workflows
- approved users land in a usable organizer workspace immediately
- later organizer branches do not need to invent profile/settings foundations
