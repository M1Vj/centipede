create table if not exists public.notification_preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  team_invites boolean not null default true,
  registration_reminders boolean not null default true,
  announcements boolean not null default true,
  leaderboard_publication boolean not null default true,
  score_recalculation boolean not null default true,
  organizer_decisions boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.notification_preferences
  add column if not exists in_app_enabled boolean not null default true,
  add column if not exists email_enabled boolean not null default false,
  add column if not exists team_invites boolean not null default true,
  add column if not exists registration_reminders boolean not null default true,
  add column if not exists announcements boolean not null default true,
  add column if not exists leaderboard_publication boolean not null default true,
  add column if not exists score_recalculation boolean not null default true,
  add column if not exists organizer_decisions boolean not null default true,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  link_path text,
  event_identity_key text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.notifications
  add column if not exists recipient_id uuid references public.profiles (id) on delete cascade,
  add column if not exists type text,
  add column if not exists title text,
  add column if not exists body text,
  add column if not exists link_path text,
  add column if not exists event_identity_key text,
  add column if not exists metadata_json jsonb not null default '{}'::jsonb,
  add column if not exists read_at timestamptz,
  add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table public.notifications
  alter column recipient_id set not null,
  alter column type set not null,
  alter column title set not null,
  alter column body set not null,
  alter column event_identity_key set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conname = 'notifications_recipient_event_identity_uq'
      and c.conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint notifications_recipient_event_identity_uq unique (recipient_id, event_identity_key);
  end if;
end $$;

create index if not exists notification_preferences_updated_at_idx
on public.notification_preferences (updated_at desc);

create index if not exists notifications_recipient_created_idx
on public.notifications (recipient_id, created_at desc);

create index if not exists notifications_recipient_unread_created_idx
on public.notifications (recipient_id, created_at desc)
where read_at is null;

create or replace function public.create_default_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_preferences (
    profile_id,
    in_app_enabled,
    email_enabled,
    team_invites,
    registration_reminders,
    announcements,
    leaderboard_publication,
    score_recalculation,
    organizer_decisions
  )
  values (
    new.id,
    true,
    false,
    true,
    true,
    true,
    true,
    true,
    true
  )
  on conflict (profile_id) do update
  set
    in_app_enabled = coalesce(public.notification_preferences.in_app_enabled, true),
    email_enabled = coalesce(public.notification_preferences.email_enabled, false),
    team_invites = coalesce(public.notification_preferences.team_invites, true),
    registration_reminders = coalesce(public.notification_preferences.registration_reminders, true),
    announcements = coalesce(public.notification_preferences.announcements, true),
    leaderboard_publication = coalesce(public.notification_preferences.leaderboard_publication, true),
    score_recalculation = coalesce(public.notification_preferences.score_recalculation, true),
    organizer_decisions = coalesce(public.notification_preferences.organizer_decisions, true),
    updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists profiles_create_default_notification_preferences on public.profiles;
create trigger profiles_create_default_notification_preferences
after insert on public.profiles
for each row
execute function public.create_default_notification_preferences();

insert into public.notification_preferences (
  profile_id,
  in_app_enabled,
  email_enabled,
  team_invites,
  registration_reminders,
  announcements,
  leaderboard_publication,
  score_recalculation,
  organizer_decisions
)
select p.id, true, false, true, true, true, true, true, true
from public.profiles p
on conflict (profile_id) do nothing;

create or replace function public.notification_preference_key(p_type text)
returns text
language sql
immutable
as $$
  select case p_type
    when 'team_invite_sent' then 'team_invites'
    when 'team_invite_accepted' then 'team_invites'
    when 'team_invite_declined' then 'team_invites'
    when 'team_roster_invalidated' then 'team_invites'
    when 'competition_registration_confirmed' then 'registration_reminders'
    when 'competition_registration_withdrawn' then 'registration_reminders'
    when 'competition_started' then 'registration_reminders'
    when 'competition_announcement_posted' then 'announcements'
    when 'leaderboard_published' then 'leaderboard_publication'
    when 'dispute_resolved' then 'leaderboard_publication'
    when 'score_recalculated' then 'score_recalculation'
    when 'organizer_application_submitted' then 'organizer_decisions'
    when 'organizer_application_approved' then 'organizer_decisions'
    when 'organizer_application_rejected' then 'organizer_decisions'
    else null
  end;
$$;

create or replace function public.notification_channel_class(p_type text)
returns text
language sql
immutable
as $$
  select case p_type
    when 'score_recalculated' then 'in_app_only'
    when 'organizer_application_submitted' then 'in_app_only'
    when 'organizer_application_approved' then 'in_app_only'
    when 'organizer_application_rejected' then 'in_app_only'
    else 'email_eligible'
  end;
$$;

create or replace function public.is_allowed_notification_link_path(p_link_path text)
returns boolean
language sql
immutable
as $$
  select p_link_path is null
    or p_link_path = '/organizer/status'
    or p_link_path = '/mathlete/teams/invites'
    or p_link_path = '/mathlete/history'
    or p_link_path = '/organizer/history'
    or p_link_path ~ '^/mathlete/competition/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    or p_link_path ~ '^/organizer/competition/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    or p_link_path ~ '^/mathlete/competition/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/leaderboard$'
    or p_link_path ~ '^/organizer/competition/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/leaderboard$'
    or p_link_path ~ '^/organizer/competition/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/participants$'
    or p_link_path ~ '^/mathlete/competition/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/review$'
    or p_link_path ~ '^/mathlete/competition/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/answer-key$';
$$;

create or replace function public.enqueue_notification(
  p_recipient_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link_path text,
  p_event_identity_key text,
  p_metadata_json jsonb default '{}'::jsonb
)
returns table (
  notification_id uuid,
  inserted boolean,
  inbox_allowed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_preference_key text := public.notification_preference_key(p_type);
  v_channel_class text := public.notification_channel_class(p_type);
  v_link_path text := case
    when public.is_allowed_notification_link_path(p_link_path) then p_link_path
    else null
  end;
  v_inbox_allowed boolean := false;
begin
  if v_preference_key is null then
    raise exception 'invalid_notification_event_type'
      using errcode = '22023';
  end if;

  insert into public.notification_preferences (
    profile_id,
    in_app_enabled,
    email_enabled,
    team_invites,
    registration_reminders,
    announcements,
    leaderboard_publication,
    score_recalculation,
    organizer_decisions
  )
  values (p_recipient_id, true, false, true, true, true, true, true, true)
  on conflict (profile_id) do nothing;

  select case v_preference_key
    when 'team_invites' then np.in_app_enabled and np.team_invites
    when 'registration_reminders' then np.in_app_enabled and np.registration_reminders
    when 'announcements' then np.announcements
    when 'leaderboard_publication' then np.in_app_enabled and np.leaderboard_publication
    when 'score_recalculation' then true
    when 'organizer_decisions' then true
    else false
  end
  into v_inbox_allowed
  from public.notification_preferences np
  where np.profile_id = p_recipient_id;

  if v_channel_class = 'in_app_only' or p_type = 'competition_announcement_posted' then
    v_inbox_allowed := true;
  end if;

  if not v_inbox_allowed then
    return query select null::uuid, false, false;
    return;
  end if;

  return query
  with inserted_row as (
    insert into public.notifications (
      recipient_id,
      type,
      title,
      body,
      link_path,
      event_identity_key,
      metadata_json
    )
    values (
      p_recipient_id,
      p_type,
      p_title,
      p_body,
      v_link_path,
      p_event_identity_key,
      coalesce(p_metadata_json, '{}'::jsonb)
    )
    on conflict on constraint notifications_recipient_event_identity_uq
    do nothing
    returning public.notifications.id
  )
  select inserted_row.id, true, true
  from inserted_row
  union all
  select n.id, false, true
  from public.notifications n
  where n.recipient_id = p_recipient_id
    and n.event_identity_key = p_event_identity_key
    and not exists (select 1 from inserted_row)
  limit 1;
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns table (
  notification_id uuid,
  read_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.notifications as n
  set read_at = coalesce(n.read_at, timezone('utc', now()))
  where n.id = p_notification_id
    and n.recipient_id = auth.uid()
  returning n.id, n.read_at;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_count integer := 0;
begin
  update public.notifications as n
  set read_at = timezone('utc', now())
  where n.recipient_id = auth.uid()
    and n.read_at is null;

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$;

create or replace function public.update_notification_preferences(
  p_in_app_enabled boolean,
  p_email_enabled boolean,
  p_team_invites boolean,
  p_registration_reminders boolean,
  p_announcements boolean,
  p_leaderboard_publication boolean,
  p_score_recalculation boolean,
  p_organizer_decisions boolean
)
returns table (
  updated_profile_id uuid,
  preferences_updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  insert into public.notification_preferences (
    profile_id,
    in_app_enabled,
    email_enabled,
    team_invites,
    registration_reminders,
    announcements,
    leaderboard_publication,
    score_recalculation,
    organizer_decisions,
    updated_at
  )
  values (
    auth.uid(),
    coalesce(p_in_app_enabled, true),
    coalesce(p_email_enabled, false),
    coalesce(p_team_invites, true),
    coalesce(p_registration_reminders, true),
    coalesce(p_announcements, true),
    coalesce(p_leaderboard_publication, true),
    coalesce(p_score_recalculation, true),
    coalesce(p_organizer_decisions, true),
    timezone('utc', now())
  )
  on conflict on constraint notification_preferences_pkey do update
  set
    in_app_enabled = excluded.in_app_enabled,
    email_enabled = excluded.email_enabled,
    team_invites = excluded.team_invites,
    registration_reminders = excluded.registration_reminders,
    announcements = excluded.announcements,
    leaderboard_publication = excluded.leaderboard_publication,
    score_recalculation = excluded.score_recalculation,
    organizer_decisions = excluded.organizer_decisions,
    updated_at = excluded.updated_at
  returning public.notification_preferences.profile_id,
    public.notification_preferences.updated_at;
end;
$$;

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
on public.notifications
for select
to authenticated
using (recipient_id = auth.uid());

drop policy if exists notification_preferences_select_own on public.notification_preferences;
create policy notification_preferences_select_own
on public.notification_preferences
for select
to authenticated
using (profile_id = auth.uid());

drop policy if exists notification_preferences_update_own on public.notification_preferences;
create policy notification_preferences_update_own
on public.notification_preferences
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

grant select on public.notifications to authenticated;
grant select, update on public.notification_preferences to authenticated;
grant all privileges on public.notifications to service_role;
grant all privileges on public.notification_preferences to service_role;

revoke execute on function public.enqueue_notification(uuid, text, text, text, text, text, jsonb) from public, authenticated;
grant execute on function public.enqueue_notification(uuid, text, text, text, text, text, jsonb) to service_role;

revoke execute on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;

revoke execute on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated;

revoke execute on function public.update_notification_preferences(
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean
) from public;
grant execute on function public.update_notification_preferences(
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean
) to authenticated;

grant execute on function public.notification_preference_key(text) to authenticated, service_role;
grant execute on function public.notification_channel_class(text) to authenticated, service_role;
grant execute on function public.is_allowed_notification_link_path(text) to authenticated, service_role;
