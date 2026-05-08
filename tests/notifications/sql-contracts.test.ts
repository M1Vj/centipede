import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260505150000_15_notifications_polish.sql",
  "utf8",
);
const forwardFixMigration = readFileSync(
  "supabase/migrations/20260507133000_15_notification_start_and_invite_forward_fix.sql",
  "utf8",
);
const mandatoryInboxMigration = readFileSync(
  "supabase/migrations/20260507162000_15_mandatory_invite_and_start_inbox.sql",
  "utf8",
);

describe("branch 15 notification SQL contracts", () => {
  test("creates inbox table with recipient event identity idempotency", () => {
    expect(migration).toContain("create table if not exists public.notifications");
    expect(migration).toContain("recipient_id uuid not null references public.profiles (id) on delete cascade");
    expect(migration).toContain("event_identity_key text not null");
    expect(migration).toContain("notifications_recipient_event_identity_uq");
    expect(migration).toContain("unique (recipient_id, event_identity_key)");
    expect(migration).toContain("notifications_recipient_unread_created_idx");
  });

  test("creates complete preference defaults and backfills profiles", () => {
    expect(migration).toContain("create table if not exists public.notification_preferences");
    expect(migration).toContain("in_app_enabled boolean not null default true");
    expect(migration).toContain("email_enabled boolean not null default false");
    expect(migration).toContain("team_invites boolean not null default true");
    expect(migration).toContain("registration_reminders boolean not null default true");
    expect(migration).toContain("announcements boolean not null default true");
    expect(migration).toContain("leaderboard_publication boolean not null default true");
    expect(migration).toContain("score_recalculation boolean not null default true");
    expect(migration).toContain("organizer_decisions boolean not null default true");
    expect(migration).toContain("insert into public.notification_preferences");
    expect(migration).toContain("select p.id");
    expect(migration).toContain("from public.profiles p");
  });

  test("exposes trusted enqueue and owner read-state RPCs", () => {
    expect(migration).toContain("create or replace function public.enqueue_notification");
    expect(`${migration}\n${forwardFixMigration}`).toContain("when 'competition_started' then 'registration_reminders'");
    expect(`${migration}\n${forwardFixMigration}`).toContain("p_link_path = '/mathlete/teams/invites'");
    expect(migration).toContain("on conflict on constraint notifications_recipient_event_identity_uq");
    expect(migration).toContain("create or replace function public.mark_notification_read");
    expect(migration).toContain("where n.id = p_notification_id");
    expect(migration).toContain("and n.recipient_id = auth.uid()");
    expect(migration).toContain("create or replace function public.mark_all_notifications_read");
    expect(migration).toContain("where n.recipient_id = auth.uid()");
    expect(migration).toContain("create or replace function public.update_notification_preferences");
    expect(migration).toContain("values (");
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("grant execute on function public.enqueue_notification");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("grant execute on function public.update_notification_preferences");
    expect(migration).toContain("to authenticated");
  });

  test("ships a forward fix for databases that already applied branch 15 notifications", () => {
    expect(forwardFixMigration).toContain("create or replace function public.notification_preference_key");
    expect(forwardFixMigration).toContain("when 'competition_started' then 'registration_reminders'");
    expect(forwardFixMigration).toContain("create or replace function public.is_allowed_notification_link_path");
    expect(forwardFixMigration).toContain("p_link_path = '/mathlete/teams/invites'");
    expect(forwardFixMigration).toContain("grant execute on function public.notification_preference_key");
  });

  test("keeps actionable invite and start events in inbox even when category preferences are off", () => {
    expect(mandatoryInboxMigration).toContain("create or replace function public.notification_requires_mandatory_inbox");
    expect(mandatoryInboxMigration).toContain("'team_invite_sent'");
    expect(mandatoryInboxMigration).toContain("'competition_started'");
    expect(mandatoryInboxMigration).toContain("if public.notification_requires_mandatory_inbox(p_type) then");
    expect(mandatoryInboxMigration).toContain("v_inbox_allowed := true");
    expect(mandatoryInboxMigration).toContain("create or replace function public.enqueue_notification");
  });

  test("enforces owner-only RLS for inbox and preferences", () => {
    expect(migration).toContain("alter table public.notifications enable row level security");
    expect(migration).toContain("notifications_select_own");
    expect(migration).toContain("using (recipient_id = auth.uid())");
    expect(migration).toContain("alter table public.notification_preferences enable row level security");
    expect(migration).toContain("notification_preferences_select_own");
    expect(migration).toContain("using (profile_id = auth.uid())");
    expect(migration).toContain("notification_preferences_update_own");
    expect(migration).toContain("with check (profile_id = auth.uid())");
  });
});
