# 05 - Organizer Registration

- Feature branch: `feature/organizer-registration`
- Requirement mapping: UR2, partial UR3 and UR5 — organizer application intake, approval status visibility, organizer onboarding, and organizer profile/settings setup
- Priority: 5.5
- **Assigned to:** Mabansag, Vj

## Mission

Implement the full organizer eligibility lifecycle: public application entry, strict legal consent, file upload, review-status visibility, approval or rejection communication, organizer onboarding delivery, and organizer workspace onboarding. This branch also establishes organizer profile and settings surfaces because they are part of the actual post-approval workflow.

This branch exists because the original plan treated organizer registration as just a form. In reality it is a lifecycle that touches legal consent, uploads, admin review, applicant email communication, activation handoff, and organizer-first-run experience.

Depends on: `02-authentication`, `03-interaction-feedback`, `04-admin-user-management`, `05b-deferred-foundation-and-auth`.

Unblocks: problem banks, competition authoring, organizer notification polish (branch 15), organizer history, and organizer monitoring.

## Scope Boundary

- Do not rebuild admin approval UI from branch 04. This branch only integrates with its trusted decision outcomes.
- Do not write admin review decisions in this branch; `status`, `rejection_reason`, and `reviewed_at` are owned by branch 04 trusted admin paths.
- Do not write account-linked inbox or in-app notification rows in this branch; branch 15 owns notification delivery after account linkage.
- This branch owns trusted organizer activation and provisioning writes for approved applications (`profiles.role`, `profiles.approved_at`), including `organizer_applications.profile_id IS NULL` cases.
- This branch owns applicant-facing intake, status lookup, email communication delivery, and organizer-first-run pages.

## Full Context

- Business context: organizer access must be gated to preserve trust in competitions and shared content.
- User roles: public organizer applicants without organizer accounts yet, admins reviewing them, and newly approved organizers entering their workspace after approval communication delivery.
- UI flow: public apply CTA, organizer application form, secure review-status page, organizer-first-run dashboard, profile/settings completion.
- Backend flow: trusted application insert, trusted storage upload path persistence, admin review decision consumption as read-only handoff input, trusted activation/provisioning for approved rows (including null `profile_id` handling), secure status lookup using opaque token verification, submission or decision email communication delivery, and organizer dashboard redirect on first login.
- Related tables/functions: `organizer_applications`, `profiles`, `admin_audit_logs`, `lookup_organizer_application_status(status_lookup_token)`.
- Edge cases: duplicate applications, missing logo upload, approved user with stale session, rejected user reapplying, organizer application from suspended user.
- Security concerns: only the applicant can submit draft application data; approval is admin-only; secure status lookup must not leak applicant data broadly; storage paths must be permissioned.
- Performance concerns: form validation and upload progress must remain usable on low-end devices.
- Accessibility/mobile: long forms require grouped sections, inline validation, sticky progress, and touch-friendly upload affordances.

## Research Findings / Implementation Direction

- Keep application state server-trusted and idempotent so duplicate form submits do not create duplicate approval rows.
- Use Supabase Storage bucket `organizer-assets`; persist only `organizer_applications.logo_path` storage path values, never ad hoc public URLs.
- Hash status lookup tokens into `organizer_applications.status_lookup_token_hash`; never persist raw tokens.
- Keep status lookup responses minimal and safe (`status`, `rejection_reason`, `masked_contact_email`) with rate limiting to reduce brute-force risk.
- If branch-05 organizer intake or status RPCs are unavailable in under-migrated environments, use deterministic server fallbacks when safe and preserve non-disclosing outcomes (`not_found` or throttled) rather than surfacing raw database errors.
- Treat branch 04 reviewed decision fields as immutable handoff input; branch 05 runs trusted activation/provisioning for approved rows and handles applicant communication idempotently per `(application_id, message_type)`.
- Treat organizer profile/settings as part of onboarding so later feature branches are not forced to create the organizer shell retroactively.
- Use secure status lookup plus submission, approval, or rejection email communication as the immediate applicant feedback path.
- Account-linked inbox and in-app notification delivery are owned by branch 15 after profile linkage.

## Organizer Communication Contract

- Submission: after a successful application insert with `status = 'pending'`, send a submission-confirmation email to `contact_email`.
- Approval: when branch 04 marks an application `approved`, run trusted activation/provisioning in this branch (including null `profile_id` cases) and write `profiles.role = 'organizer'` plus `profiles.approved_at` idempotently, then send one activation email with a password-set/reset link exactly once per `(application_id, message_type='approved')`.
- Rejection: when branch 04 marks an application `rejected`, keep organizer access blocked and send a rejection email with reason exactly once per `(application_id, message_type='rejected')`.
- Decision-reason contract: `rejection_reason` is required for rejected outcomes; approval rationale is not persisted or required in release one.
- This branch does not write `notifications` or `notification_preferences`; account-linked notification delivery belongs to branch 15.
- This branch must not write `organizer_applications.status`, `rejection_reason`, or `reviewed_at`.
- Activation and communication retries must be deterministic and idempotent so the final organizer state and outbound messages are stable.

## Status Lookup Contract

- Applicant status must be checked through an opaque token path (not organizer login).
- Persist only token hashes (`status_lookup_token_hash`) and validate through trusted handlers or RPC.
- Canonical expiry evaluation is owned by trusted `lookup_organizer_application_status(status_lookup_token)` DB logic; callers must not invent client-side expiry rules.
- Success response is restricted to safe fields: `status`, `rejection_reason`, and `masked_contact_email`.
- Throttle key dimensions are `(client_ip, token_fingerprint)` where `token_fingerprint` is derived from normalized raw token input and malformed input maps to a fixed malformed bucket.
- Throttle window is deterministic: allow one accepted lookup per key per rolling 1-second window.
- Invalid, malformed, unknown, or DB-evaluated expired token returns `404` with the same generic `not_found` machine-code payload and no applicant data.
- Throttled lookups return `429` with `Retry-After: 1` and a generic `throttled` error payload with no applicant data.
- Negative-path responses must stay non-disclosing and follow the DB source-of-truth machine-code policy: `not_found` for lookup failure states (including expiry) and `throttled` for rate-limit states.
- Enforce the DB throttle contract exactly, including key dimensions, 1-second window, `429` response behavior, and `Retry-After: 1` header.

## Storage Contract

- Use the `organizer-assets` bucket for organizer-application logo uploads.
- Storage object key format is `organizer-applications/{application_id}/logo.{ext}` where `{ext}` is `jpg` or `png`.
- Persist exactly `organizer-applications/{application_id}/logo.{ext}` in `organizer_applications.logo_path`; do not persist bucket prefixes or public object URLs.
- Re-uploads for the same application overwrite the same key so `logo_path` stays canonical and idempotent.
- Upload through trusted signed flow or trusted backend handlers so raw objects are not broadly public.

## Requirements

- add organizer application entry points on the public landing page without requiring a pre-existing organizer account
- collect required organization information, statement, contact details, and explicit Data Privacy Act of 2012 plus Terms & Conditions consent
- support optional logo upload and validate file type/size (only `image/jpeg` and `image/png` are allowed, 2MB size limit)
- write organizer logo objects to `organizer-assets/organizer-applications/{application_id}/logo.{ext}` and persist only `organizer-applications/{application_id}/logo.{ext}` in `logo_path`
- send a submission-confirmation email immediately after successful organizer application creation
- show review status (`pending`, `approved`, `rejected`) and rejection reason through secure token lookup that returns only safe fields
- consume approved decisions from branch 04 and perform trusted organizer activation/provisioning writes (`profiles.role`, `profiles.approved_at`) idempotently, including null `profile_id` paths
- deliver one activation email with a password-set/reset link to the approved contact email after approval, and deliver explicit rejection messaging when denied
- route newly approved organizers into the organizer workspace (`/organizer`)
- add organizer dashboard home states for profile summary plus statistics/data-insights shells so the promised dashboard surface exists before later data-heavy branches
- keep the approved organizer login identifier immutable in self-service settings while allowing password recovery
- add organizer profile and settings pages needed before problem-bank work begins
- keep this branch read-only for admin decision fields (`status`, `rejection_reason`, `reviewed_at`)

## Atomic Steps

1. Add organizer CTA sections on the public landing page (`/`), login page (`/auth/login`), and sign-up page (`/auth/sign-up`).
2. Build the organizer application form with structured sections, clear legal consent copy, and `image/jpeg` / `image/png` validation (max 2MB).
3. Add upload handling for logo assets to Supabase Storage bucket `organizer-assets` using key `organizer-applications/{application_id}/logo.{ext}`, then persist only that canonical object path in `organizer_applications.logo_path`.
4. Persist application data to `organizer_applications` with idempotent submit behavior, default `status = 'pending'`, hashed status lookup token storage, and immediate submission-confirmation email delivery.
5. Build the applicant status page (`/organizer/status`) with `pending`, `approved`, and `rejected` states using secure token lookup that returns only `status`, `rejection_reason`, and `masked_contact_email`.
6. Integrate with trusted admin decisions from branch 04 as read-only handoff input (no admin UI rewrite and no decision writes): approved decisions trigger trusted activation/provisioning writes plus one idempotent activation email with onboarding instructions; rejected decisions trigger rejection email messaging only.
7. Add organizer-first-run routing so users logging in with the `organizer` role land directly in the `/organizer` dashboard.
8. Build organizer dashboard home states in `/organizer` for profile summary plus statistics/data-insights shells, then add organizer profile (`/organizer/profile`) and settings (`/organizer/settings`) pages with editable organization-facing fields while keeping the login identifier non-editable in self-service settings.
9. Verify the existing admin review path from branch 04 works cleanly end-to-end with the new application payload, including deterministic activation/provisioning for approved rows and null `profile_id` cases, then correct email and routing outcomes.

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

- Manual QA: submit an organizer application without an organizer account, upload a logo to `organizer-assets`, confirm only storage path persistence, inspect pending status via secure token lookup, approve and reject through admin, verify submission or approval or rejection messaging, verify approval communication handoff, and verify organizer redirect after approval.
- Automated: add validation and helper tests where logic is extracted.
- Accessibility: grouped form sections, required-state messaging, file input labeling, and error summaries.
- Performance: uploads show progress and failure states without freezing the form.
- Edge cases: duplicate submission idempotency, reapply after rejection, stale session after approval, invalid or unknown lookup token, throttled lookup response (`429` with retry), invalid file types, and high-frequency status-lookup attempts.

## Git Branching

- Branch from: `develop`
- Merge back into: `develop`
- Recommended atomic commits:
  - `feat(organizer): add application entry points and form`
  - `feat(organizer): add application status and review states`
  - `feat(organizer): add organizer profile and settings onboarding`
  - `refactor(organizer): connect approval flow to onboarding messaging`
- PR title template: `UR2: organizer eligibility, onboarding, and workspace readiness`
- PR description template:
  - Summary: organizer application flow, review states, uploads, organizer-first-run workspace
  - Testing: lint, manual applicant/admin review checks
  - Docs: DB doc updated for uploads and approval lifecycle

## Definition of Done

- legitimate organizer applicants can submit and track an application
- approval and rejection behavior is consistent with admin workflows while keeping decision-field writes owned by branch 04 and activation/provisioning writes owned by branch 05 trusted handlers
- status lookup uses hashed-token validation and returns only safe fields
- storage contract uses `organizer-assets` plus path-only persistence in `logo_path`
- approved users receive a clear activation path (including null `profile_id` recovery), and land in a usable organizer workspace immediately
- later organizer branches do not need to invent profile/settings foundations
