create or replace function public.notification_requires_mandatory_inbox(p_type text)
returns boolean
language sql
immutable
as $$
  select p_type in (
    'team_invite_sent',
    'competition_started',
    'competition_announcement_posted',
    'score_recalculated',
    'organizer_application_submitted',
    'organizer_application_approved',
    'organizer_application_rejected'
  );
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

  if public.notification_requires_mandatory_inbox(p_type) then
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

grant execute on function public.notification_requires_mandatory_inbox(text) to authenticated, service_role;
revoke execute on function public.enqueue_notification(uuid, text, text, text, text, text, jsonb) from public, authenticated;
grant execute on function public.enqueue_notification(uuid, text, text, text, text, text, jsonb) to service_role;
