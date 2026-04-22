-- ============================================================================
-- Branch 11 follow-up: restore service-role fail-closed registration guard
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

    select *
    into v_registration
    from public.competition_registrations
    where competition_registrations.competition_id = p_competition_id
      and competition_registrations.team_id = p_team_id
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

    select *
    into v_registration
    from public.competition_registrations
    where competition_registrations.competition_id = p_competition_id
      and competition_registrations.profile_id = v_caller_id
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

      update public.competition_registrations
      set status = 'registered'::public.registration_status,
          status_reason = null,
          entry_snapshot_json = v_entry_snapshot,
          updated_at = now()
      where id = v_registration.id
      returning * into v_registration;

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

    insert into public.competition_registrations (
      competition_id, profile_id, team_id, status, entry_snapshot_json
    )
    values (
      p_competition_id, null, p_team_id, 'registered', v_entry_snapshot
    )
    returning * into v_registration;
  else
    v_entry_snapshot := jsonb_build_object(
      'profile_id', v_caller_id,
      'display_name', coalesce(nullif(trim(v_profile.full_name), ''), v_caller_id::text),
      'registered_at', now()
    );

    insert into public.competition_registrations (
      competition_id, profile_id, team_id, status, entry_snapshot_json
    )
    values (
      p_competition_id, v_caller_id, null, 'registered', v_entry_snapshot
    )
    returning * into v_registration;
  end if;

  return query
    select 'ok'::text, v_registration.id, p_competition_id, v_registration.status;
end;
$$;
