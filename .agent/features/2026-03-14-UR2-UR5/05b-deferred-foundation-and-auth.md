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
- **Testing**: Browser automation is forbidden in this branch unless an external policy exception is logged in `.agent/PROCESS-FLOW.md` under `## CORE_PATCH_REQUESTS` using the canonical required fields with `status = approved` before execution.
- **Security**: Single session invalidation was planned but omitted. Currently, multiple logins create new session instances without invalidating stale ones.
- **UX**: Global or route-segment `loading.tsx` and App Router-native navigation feedback boundary implementation was omitted.
- **Safety**: Admin inactive-account removal currently uses raw `deleteUser` which performs a destructive ON DELETE CASCADE, violating the requirement to preserve historical competition data via anonymization.

## Non-Spam Removal Contract

- Non-spam admin account removal uses irreversible anonymization of user PII while preserving relational rows needed for history, leaderboard, and audit integrity.
- This contract is anonymization-only (not soft-delete and not generic hard-delete) to avoid ambiguous retention behavior.

## Scope Boundary

- Do not implement organizer intake/status/approval messaging in this branch. Those applicant-facing contracts are owned by `05-organizer-registration`.
- This branch only delivers missing foundation contracts required by branch 05 and later branches.

## Handoff Contract to Branch 05

- `/privacy` and `/terms` exist and are routable for legal-consent links.
- Trusted auth flow enforces `profiles.session_version` rotation and invalidates stale sessions server-side.
- Safe anonymization path exists for non-spam account removals, preserving historical competition integrity.
- App Router loading boundaries exist and deterministic dev-smoke evidence is captured so branch 05 can implement organizer flow safely.

## Requirements

- Add legal pages for privacy (`app/privacy/page.tsx`) and terms (`app/terms/page.tsx`).
- Add App Router loading feedback boundaries (`app/loading.tsx` and route-segment loading files where needed).
- Add strict single-session replacement logic using trusted server-side checks so a new login invalidates earlier active sessions.
- Build a safe user anonymization path for admin non-spam removals without cascading deletion of historical competition data, and without introducing soft-delete or generic hard-delete semantics.
- Enforce branch browser-automation policy: do not run Playwright or other browser-automation tooling; if external policy requires it, log the exception in `.agent/PROCESS-FLOW.md` under `## CORE_PATCH_REQUESTS` using the canonical required fields with `status = approved` before execution.

## Atomic Steps

1. Create `app/privacy/page.tsx` and `app/terms/page.tsx` with structural skeleton copy.
2. Add `app/loading.tsx` plus route-segment loading boundaries where user-perceived latency exists.
3. Update trusted auth and route-guard logic to rotate and validate `profiles.session_version` so stale sessions fail authorization.
4. Refactor non-spam admin account removal path to anonymize PII while preserving historical competition and leaderboard integrity, without introducing soft-delete or generic hard-delete semantics.
5. Enforce branch browser-automation policy: do not run Playwright or other browser-automation tooling unless an external policy exception is logged in `.agent/PROCESS-FLOW.md` under `## CORE_PATCH_REQUESTS` using the canonical required fields with `status = approved` before execution.
6. Verify legal routes, loading boundaries, session invalidation, and anonymization behavior before marking this branch done.

## Key Files

- `app/privacy/page.tsx`
- `app/terms/page.tsx`
- `app/loading.tsx`
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
	- Confirm Playwright and other browser-automation tooling were not used; if external policy requires automation, log the exception in `.agent/PROCESS-FLOW.md` under `## CORE_PATCH_REQUESTS` using the canonical required fields with `status = approved` before execution.

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
