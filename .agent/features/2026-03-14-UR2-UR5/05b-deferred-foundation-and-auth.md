# 05b - Deferred Foundations and Technical Debt

- Feature branch: `feature/deferred-technical-debt`
- Requirement mapping: UR1, UR2, UR3, UR4 — deferred platform contracts and hardening scope
- Priority: 5
- **Assigned to:** Mabansag, Vj

## Mission

Deliver deferred platform hardening needed before organizer onboarding and downstream feature work.

Depends on: `01-foundation`, `02-authentication`, `03-interaction-feedback`, `04-admin-user-management`.

Unblocks: legal route dependencies, strict single-session invalidation, safe user anonymization, and App Router loading boundaries used by later features.

## Full Context

- **Legal**: Organizer registration flows reference Data Privacy and Terms, but the `/privacy` and `/terms` pages do not physically exist.
- **Testing**: Browser automation is forbidden in this branch unless an entry with `request_type = browser_automation_exception` and `status = approved` is logged in `.agent/PROCESS-FLOW.md` under `## CORE_PATCH_REQUESTS` using the canonical required fields before execution.
- **Security**: Single session invalidation was planned but omitted. Currently, multiple logins create new session instances without invalidating stale ones.
- **UX**: Global or route-segment `loading.tsx` and App Router-native navigation feedback boundary implementation was omitted.
- **Safety**: Admin inactive-account removal currently uses raw `deleteUser` which performs a destructive ON DELETE CASCADE, violating the requirement to preserve historical competition data via anonymization.

## Non-Spam Removal Contract

- Non-spam admin account removal uses irreversible anonymization of user PII while preserving relational rows needed for history, leaderboard, and audit integrity.
- This contract is anonymization-only (not soft-delete and not generic hard-delete) to avoid ambiguous retention behavior.

## Field-Level Anonymization Contract

- Execute non-spam removal only through trusted helper `anonymize_user_account(target_profile_id, reason, request_idempotency_token)`.
- Transform `profiles` fields deterministically:
	- `email` -> `deleted+{sha256(profile_id || ':centipede')[0:24]}@anon.invalid`
	- `full_name` -> `Deleted User`
	- `school`, `grade_level`, `organization`, `avatar_url` -> `null`
	- `is_active` -> `false`
- Preserve `id`, `role`, `approved_at`, `created_at`, and all foreign-key references so historical competition and audit rows remain valid.
- Email strategy is irreversible: original email is never retained in reversible form, and the anonymized alias is deterministic per `profile_id`.
- Idempotency behavior is required: repeated anonymization calls for the same `target_profile_id` return the existing anonymized state and must not rewrite historical rows or produce a second alias.

## Scope Boundary

- Do not implement organizer intake/status/approval messaging in this branch. Those applicant-facing contracts are owned by `05-organizer-registration`.
- This branch only delivers missing foundation contracts required by branch 05 and later branches.

## Handoff Contract to Branch 05

- `/privacy` and `/terms` exist and are routable for legal-consent links.
- Trusted auth flow enforces `profiles.session_version` rotation through `rotate_session_version(profile_id)` and invalidates stale sessions server-side.
- Mathlete settings allow later school and grade-level updates through `update_mathlete_profile_settings(profile_id, school, grade_level)` without exposing role or credential mutations.
- Safe anonymization path exists for non-spam account removals through `anonymize_user_account(target_profile_id, reason, request_idempotency_token)`, preserving historical competition integrity.
- App Router loading boundaries exist and deterministic dev-smoke evidence is captured so branch 05 can implement organizer flow safely.

## Requirements

- Add legal pages for privacy (`app/privacy/page.tsx`) and terms (`app/terms/page.tsx`).
- Add App Router loading feedback boundaries with a deterministic minimum set: `app/loading.tsx`, `app/admin/loading.tsx`, `app/organizer/loading.tsx`, and `app/mathlete/loading.tsx`; later branches may add more segment boundaries.
- Add strict single-session replacement logic using trusted `rotate_session_version(profile_id)` checks so a new login invalidates earlier active sessions.
- Add trusted mathlete settings/profile edit support through `update_mathlete_profile_settings(profile_id, school, grade_level)` after first login without allowing role, email, or organizer/admin-only identity changes.
- Build a safe user anonymization path for admin non-spam removals through `anonymize_user_account(target_profile_id, reason, request_idempotency_token)` without cascading deletion of historical competition data, and without introducing soft-delete or generic hard-delete semantics.
- Enforce branch browser-automation policy: do not run Playwright or other browser-automation tooling; if external policy requires it, log an entry with `request_type = browser_automation_exception` and `status = approved` in `.agent/PROCESS-FLOW.md` under `## CORE_PATCH_REQUESTS` using the canonical required fields before execution.

## Atomic Steps

1. Create `app/privacy/page.tsx` and `app/terms/page.tsx` with structural skeleton copy.
1b. Fix `organizer_applications` schema in existing migrations: make `profile_id` nullable, add `status_lookup_token_hash`, `status_lookup_token_expires_at`, `contact_email`, `contact_phone`, `organization_type`, `legal_consent_at`. Fix `organizer_applications_insert_self` RLS to allow anon inserts.
1c. Fix `approveOrganizerApplication` RPC/helper in `lib/supabase/admin.ts` to NOT mutate `profiles.role` or `profiles.approved_at`.
1d. Fix `handle_profile_changes()` trigger to prevent non-admins from changing `email`.
2. Add `app/loading.tsx`, `app/admin/loading.tsx`, `app/organizer/loading.tsx`, and `app/mathlete/loading.tsx` as the minimum loading boundaries, with additional segment boundaries allowed later when needed.
3. Update trusted auth and route-guard logic to rotate and validate `profiles.session_version` through `rotate_session_version(profile_id)` so stale sessions fail authorization.
4. Add trusted mathlete settings/profile edit handling for school and grade-level changes through `update_mathlete_profile_settings(profile_id, school, grade_level)` while keeping role and credential fields immutable in self-service.
5. Refactor non-spam admin account removal path to call `anonymize_user_account(target_profile_id, reason, request_idempotency_token)` and enforce the field-level anonymization contract while preserving historical competition and leaderboard integrity, without introducing soft-delete or generic hard-delete semantics.
6. Enforce branch browser-automation policy: do not run Playwright or other browser-automation tooling unless an entry with `request_type = browser_automation_exception` and `status = approved` is logged in `.agent/PROCESS-FLOW.md` under `## CORE_PATCH_REQUESTS` using the canonical required fields before execution.
7. Verify legal routes, loading boundaries, session invalidation, mathlete settings behavior, and anonymization behavior before marking this branch done.

## Key Files

- `app/privacy/page.tsx`
- `app/terms/page.tsx`
- `app/loading.tsx`
- `app/mathlete/settings/page.tsx`
- `lib/auth/*`
- `lib/supabase/proxy.ts`
- `app/admin/users/user-actions.tsx`
- `lib/supabase/admin.ts`

## Verification

- Manual QA:
	- Confirm `/privacy` and `/terms` render and can be linked from organizer-facing legal consent copy.
	- Open slow transitions and confirm loading boundaries render expected feedback.
	- Log in on device A, then device B; confirm device A becomes invalid after session rotation.
	- Trigger non-spam admin removal flow and verify user PII is scrubbed while historical records remain intact.
- Automated:
	- Run `npm run lint`, `npm run test`, `npm run build`.
	- Run deterministic long-running dev smoke verification: start `npm run dev`, confirm startup without runtime errors, probe `/privacy`, `/terms`, and `/admin/users`, then intentionally stop the process and capture probe evidence in QA notes.
	- Confirm Playwright and other browser-automation tooling were not used; if external policy requires automation, log an entry with `request_type = browser_automation_exception` and `status = approved` in `.agent/PROCESS-FLOW.md` under `## CORE_PATCH_REQUESTS` using the canonical required fields before execution.

## Git Branching

- Branch from: `develop`
- Merge back into: `develop`
- Recommended atomic commits:
	- `feat(platform): add legal routes and app loading boundaries`
	- `feat(auth): enforce strict single-session invalidation`
	- `feat(admin): add safe non-spam account anonymization flow`
	- `test(platform): enforce deterministic dev-smoke and no-browser-automation policy`
- PR title template: `UR1-UR4: deferred platform contracts and auth hardening`
- PR description template:
	- Summary: legal pages, loading boundaries, single-session invalidation, safe anonymization, and no-browser-automation policy alignment
	- Testing: lint, test, build, dev smoke, session invalidation checks
	- Docs: confirms branch 05 start gate is satisfied

## Definition of Done

- All deferred foundation contracts listed in this guide are implemented and verified.
- Branch 05 can start without needing to backfill legal pages, session invalidation, or safe anonymization prerequisites.
