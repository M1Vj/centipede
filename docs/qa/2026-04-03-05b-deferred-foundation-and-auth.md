# 05b QA Notes

- Branch: `feature/deferred-technical-debt`
- Guide: `.agent/features/2026-03-14-UR2-UR5/05b-deferred-foundation-and-auth.md`
- Date: `2026-04-03`

## Step 1b Drift Gate

- `drift_detected`: `true`
- Selected action: `apply_step_1b`
- Evidence:
  - Active baseline migration inventory in [20260311143000_initial_auth_foundation.sql](/Users/vjmabansag/Projects/centipede/supabase/migrations/20260311143000_initial_auth_foundation.sql) still defined `organizer_applications.profile_id` as `not null`, omitted `contact_email`, `contact_phone`, `organization_type`, `legal_consent_at`, `status_lookup_token_hash`, and `status_lookup_token_expires_at`, and required authenticated organizer-profile inserts only.
  - Canonical target contract in [.agent/DATABASE-EDR-RLS.md](/Users/vjmabansag/Projects/centipede/.agent/DATABASE-EDR-RLS.md) requires nullable `profile_id`, applicant contact and consent fields, hashed status lookup fields, and pre-account applicant compatibility.
  - Corrective forward migration applied in [20260403120000_05b_deferred_foundation_and_auth.sql](/Users/vjmabansag/Projects/centipede/supabase/migrations/20260403120000_05b_deferred_foundation_and_auth.sql).

## Verification

- `npm run lint`: pass
- `npm run test`: pass
- `npm run build`: pass
- `npm run supabase:status`: blocked, Docker daemon unavailable on this machine
- `npm run supabase:db:reset`: blocked, Docker daemon unavailable on this machine

## Route Checklist

| route | role | result | evidence_note |
| --- | --- | --- | --- |
| `/privacy` | anonymous | pass | `curl` returned `200` during `npm run dev` smoke after proxy fix |
| `/terms` | anonymous | pass | `curl` returned `200` during `npm run dev` smoke after proxy fix |
| `/admin/users` | anonymous | pass | `curl` returned `307` redirect to `/auth/login` |
| `/mathlete/settings` | anonymous | pass | `curl` returned `307` redirect to `/auth/login` |

## Migration Checklist

| migration_id | changed_objects | policy_checks | result |
| --- | --- | --- | --- |
| `20260403120000_05b_deferred_foundation_and_auth` | `profiles.session_version`, `profiles.avatar_url`, `organizer_applications` drift backfill columns and indexes, `organizer_applications_insert_self`, `handle_profile_changes`, `rotate_session_version`, `update_mathlete_profile_settings`, `anonymize_user_account` | confirmed anon applicant compatibility backfill, trusted session rotation execute grants for authenticated plus service role, trusted mathlete settings execute grants for authenticated plus service role, service-role-only anonymization execute grant, trigger blocks direct email and session-version mutation outside trusted flows | pass |

## Dev Smoke Notes

- `npm run dev` started successfully and served the required routes after the proxy response fix in [lib/supabase/proxy.ts](/Users/vjmabansag/Projects/centipede/lib/supabase/proxy.ts).
- Local environment still emitted repeated `Watchpack Error (watcher): EMFILE: too many open files, watch` warnings during dev-server startup. Route responses remained correct, so this was treated as an environment watcher-capacity warning rather than an application routing failure.
