-- ============================================================================
-- Branch 12 forward fix: alias ambiguous competition registration and lifecycle
-- ============================================================================

create or replace function public.register_for_competition(
  p_competition_id uuid,
  p_actor_user_id uuid,
  p_team_id uuid default null
)
returns table (
  machine_code text,
  registration_id uuid,
  competition_id uuid,
  status public.registration_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := p_actor_user_id;
  v_competition public.competitions%rowtype;
  v_registration public.competition_registrations%rowtype;
  v_profile public.profiles%rowtype;
  v_now timestamptz := now();
  v_is_team_path boolean := p_team_id is not null;
  v_entry_snapshot jsonb;
begin
  if auth.role() <> 'service_role' then
    return query
      select 'forbidden'::text, null::uuid, p_competition_id, null::public.registration_status;
    return;
  end if;

  if v_caller_id is null then
    return query
      select 'unauthorized'::text, null::uuid, p_competition_id, null::public.registration_status;
    return;
  end if;

  select *
  into v_competition
  from public.competitions
  where id = p_competition_id
    and is_deleted = false
  limit 1;

  if not found then
    return query
      select 'competition_not_found'::text, null::uuid, p_competition_id, null::public.registration_status;
    return;
  end if;

  if v_competition.status not in ('published'::public.competition_status, 'live'::public.competition_status) then
    return query
      select 'competition_not_open'::text, null::uuid, p_competition_id, null::public.registration_status;
    return;
  end if;

  if v_competition.type = 'scheduled'::public.competition_type then
    if v_competition.registration_start is not null and v_now < v_competition.registration_start then
      return query
        select 'registration_not_started'::text, null::uuid, p_competition_id, null::public.registration_status;
      return;
    end if;

    if v_competition.registration_end is not null and v_now > v_competition.registration_end then
      return query
        select 'registration_closed'::text, null::uuid, p_competition_id, null::public.registration_status;
      return;
    end if;
  end if;

  if v_is_team_path then
    if v_competition.format <> 'team'::public.competition_format then
      return query
        select 'team_registration_not_allowed'::text, null::uuid, p_competition_id, null::public.registration_status;
      return;
    end if;

    if v_competition.type <> 'scheduled'::public.competition_type then
      return query
        select 'team_registration_requires_scheduled'::text, null::uuid, p_competition_id, null::public.registration_status;
      return;
    end if;

    if not exists (
      select 1
      from public.team_memberships
      where team_id = p_team_id
        and profile_id = v_caller_id
        and is_active = true
        and role = 'leader'
    ) then
      return query
        select 'team_leader_required'::text, null::uuid, p_competition_id, null::public.registration_status;
      return;
    end if;

    select cr.*
    into v_registration
    from public.competition_registrations cr
    where cr.competition_id = p_competition_id
      and cr.team_id = p_team_id
      and cr.status is not null
    limit 1;

  else
    if v_competition.format <> 'individual'::public.competition_format then
      return query
        select 'individual_registration_not_allowed'::text, null::uuid, p_competition_id, null::public.registration_status;
      return;
    end if;

    select *
    into v_profile
    from public.profiles
    where id = v_caller_id;

    if not found then
      return query
        select 'profile_not_found'::text, null::uuid, p_competition_id, null::public.registration_status;
      return;
    end if;

    select cr.*
    into v_registration
    from public.competition_registrations cr
    where cr.competition_id = p_competition_id
      and cr.profile_id = v_caller_id
      and cr.status is not null
    limit 1;
  end if;

  if found then
    if v_registration.status = 'registered'::public.registration_status then
      return query
        select 'already_registered'::text, v_registration.id, p_competition_id, v_registration.status;
      return;
    end if;

    if v_registration.status = 'cancelled'::public.registration_status then
      return query
        select 'registration_cancelled'::text, v_registration.id, p_competition_id, v_registration.status;
      return;
    end if;

    if v_registration.status in ('ineligible'::public.registration_status, 'withdrawn'::public.registration_status) then
      if v_is_team_path then
        v_entry_snapshot := jsonb_build_object(
          'team_id', p_team_id,
          'registered_by', v_caller_id,
          're_entry_from', v_registration.status,
          'registered_at', now()
        );
      else
        v_entry_snapshot := jsonb_build_object(
          'profile_id', v_caller_id,
          'display_name', coalesce(nullif(trim(v_profile.full_name), ''), v_caller_id::text),
          're_entry_from', v_registration.status,
          'registered_at', now()
        );
      end if;

      update public.competition_registrations as cr
      set status = 'registered'::public.registration_status,
          status_reason = null,
          entry_snapshot_json = v_entry_snapshot,
          updated_at = now()
      where cr.id = v_registration.id
      returning *
      into v_registration;

      return query
        select 'ok'::text, v_registration.id, p_competition_id, v_registration.status;
      return;
    end if;

    return query
      select 'invalid_existing_status'::text, v_registration.id, p_competition_id, v_registration.status;
    return;
  end if;

  if v_is_team_path then
    v_entry_snapshot := jsonb_build_object(
      'team_id', p_team_id,
      'registered_by', v_caller_id,
      'registered_at', now()
    );

    insert into public.competition_registrations as cr (
      competition_id, profile_id, team_id, status, entry_snapshot_json
    )
    values (
      p_competition_id, null, p_team_id, 'registered', v_entry_snapshot
    )
    returning *
    into v_registration;
  else
    v_entry_snapshot := jsonb_build_object(
      'profile_id', v_caller_id,
      'display_name', coalesce(nullif(trim(v_profile.full_name), ''), v_caller_id::text),
      'registered_at', now()
    );

    insert into public.competition_registrations as cr (
      competition_id, profile_id, team_id, status, entry_snapshot_json
    )
    values (
      p_competition_id, v_caller_id, null, 'registered', v_entry_snapshot
    )
    returning *
    into v_registration;
  end if;

  return query
    select 'ok'::text, v_registration.id, p_competition_id, v_registration.status;
end;
$$;

create or replace function public.end_competition(
  p_competition_id uuid,
  p_reason text,
  p_request_idempotency_token text,
  p_transition_source text
)
returns table (
  machine_code text,
  competition_id uuid,
  status public.competition_status,
  event_id uuid,
  request_idempotency_token text,
  replayed boolean,
  changed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_competition public.competitions%rowtype;
  v_event public.competition_events%rowtype;
  v_event_id uuid;
  v_actor_user_id uuid := auth.uid();
  v_token text := btrim(coalesce(p_request_idempotency_token, ''));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_transition_source text := lower(btrim(coalesce(p_transition_source, '')));
  v_effective_end_at timestamptz;
  v_system_token text;
  v_payload jsonb;
  v_payload_hash text;
begin
  if auth.role() <> 'service_role' then
    return query
      select 'forbidden', p_competition_id, null::public.competition_status, null::uuid, v_token, false, false;
    return;
  end if;

  if p_competition_id is null then
    return query
      select 'competition_id_required', null::uuid, null::public.competition_status, null::uuid, v_token, false, false;
    return;
  end if;

  select *
  into v_competition
  from public.competitions
  where id = p_competition_id
  for update;

  if not found then
    return query
      select 'not_found', p_competition_id, null::public.competition_status, null::uuid, v_token, false, false;
    return;
  end if;

  if v_competition.is_deleted then
    return query
      select 'deleted', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
    return;
  end if;

  if v_competition.type = 'scheduled'::public.competition_type then
    if v_transition_source <> 'system_timer' then
      return query
        select 'scheduled_requires_system_timer', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
      return;
    end if;

    if v_reason is not null then
      return query
        select 'reason_not_allowed_for_system_timer', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
      return;
    end if;

    v_effective_end_at := coalesce(
      v_competition.end_time,
      case
        when v_competition.start_time is null then null
        else v_competition.start_time + make_interval(mins => coalesce(v_competition.duration_minutes, 0))
      end
    );

    v_system_token :=
      'system_end:'
      || p_competition_id::text
      || ':'
      || to_char(
           coalesce(v_effective_end_at, timezone('utc', now())) at time zone 'utc',
           'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
         );

    if v_token = '' then
      v_token := v_system_token;
    end if;

    if v_token <> v_system_token then
      return query
        select 'invalid_system_timer_token', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
      return;
    end if;

    v_actor_user_id := null;
  elsif v_competition.type = 'open'::public.competition_type then
    if v_transition_source <> 'trusted_manual_action' then
      return query
        select 'open_requires_trusted_manual_action', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
      return;
    end if;

    if v_reason is null then
      return query
        select 'reason_required', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
      return;
    end if;

    if v_token = '' then
      return query
        select 'request_idempotency_token_required', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
      return;
    end if;
  else
    return query
      select 'unsupported_competition_type', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
    return;
  end if;

  v_payload := jsonb_build_object(
    'request_idempotency_token', v_token,
    'transition_source', v_transition_source,
    'reason_text', v_reason
  );
  v_payload_hash := encode(extensions.digest(v_payload::text, 'sha256'), 'hex');

  perform pg_advisory_xact_lock(
    hashtext(
      'competition_lifecycle:end:'
      || p_competition_id::text
      || ':'
      || coalesce(v_actor_user_id::text, '00000000-0000-0000-0000-000000000000')
      || ':'
      || v_token
    )
  );

  select *
  into v_event
  from public.competition_events ce
  where ce.competition_id = p_competition_id
    and ce.control_action = 'end_competition'
    and coalesce(ce.actor_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(v_actor_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and ce.request_idempotency_token = v_token
  order by ce.happened_at desc, ce.id desc
  limit 1;

  if found then
    if v_event.event_type = 'competition_ended'
       and v_event.payload_hash is not distinct from v_payload_hash then
      return query
        select
          coalesce(v_event.metadata_json ->> 'machine_code', 'ok'),
          p_competition_id,
          coalesce((v_event.metadata_json ->> 'result_status')::public.competition_status, v_competition.status),
          v_event.id,
          v_token,
          true,
          false;
      return;
    end if;

    raise exception 'idempotency_key_reused_with_different_payload';
  end if;

  if v_competition.status not in (
    'live'::public.competition_status,
    'paused'::public.competition_status
  ) then
    return query
      select 'invalid_transition', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
    return;
  end if;

  update public.competitions as c
  set status = 'ended'::public.competition_status,
      updated_at = timezone('utc', now())
  where c.id = p_competition_id
  returning c.status
  into v_competition.status;

  insert into public.competition_events (
    competition_id,
    event_type,
    actor_user_id,
    control_action,
    request_idempotency_token,
    payload_hash,
    payload_json,
    metadata_json
  )
  values (
    p_competition_id,
    'competition_ended',
    v_actor_user_id,
    'end_competition',
    v_token,
    v_payload_hash,
    v_payload,
    jsonb_build_object(
      'machine_code', 'ok',
      'result_status', 'ended',
      'target_status', 'ended',
      'transition_source', v_transition_source
    )
  )
  returning id into v_event_id;

  return query
    select 'ok', p_competition_id, v_competition.status, v_event_id, v_token, false, true;
end;
$$;

revoke all on function public.register_for_competition(uuid, uuid, uuid) from public;
revoke all on function public.register_for_competition(uuid, uuid, uuid) from anon, authenticated;
grant execute on function public.register_for_competition(uuid, uuid, uuid) to service_role;

revoke all on function public.end_competition(uuid, text, text, text) from public;
revoke all on function public.end_competition(uuid, text, text, text) from anon, authenticated;
grant execute on function public.end_competition(uuid, text, text, text) to service_role;
