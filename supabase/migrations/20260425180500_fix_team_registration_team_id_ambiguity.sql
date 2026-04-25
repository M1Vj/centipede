-- ============================================================================
-- Bug fix: qualify team registration RPC references that collide with OUT columns
-- ============================================================================

create or replace function public.validate_team_registration(
  p_team_id uuid,
  p_competition_id uuid
)
returns table (
  machine_code text,
  team_id uuid,
  competition_id uuid,
  roster_count integer,
  required_count integer,
  conflict boolean,
  eligible boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_competition public.competitions%rowtype;
  v_team public.teams%rowtype;
  v_roster_count integer := 0;
  v_required_count integer := 0;
  v_conflict boolean := false;
  v_incomplete_count integer := 0;
begin
  if v_actor_id is null then
    return query select 'unauthenticated', p_team_id, p_competition_id, 0, 0, false, false;
    return;
  end if;

  if p_team_id is null then
    return query select 'team_id_required', null::uuid, p_competition_id, 0, 0, false, false;
    return;
  end if;

  if p_competition_id is null then
    return query select 'competition_id_required', p_team_id, null::uuid, 0, 0, false, false;
    return;
  end if;

  select c.*
  into v_competition
  from public.competitions c
  where c.id = p_competition_id;

  if not found then
    return query select 'competition_not_found', p_team_id, p_competition_id, 0, 0, false, false;
    return;
  end if;

  if v_competition.format <> 'team'::public.competition_format
     or v_competition.type <> 'scheduled'::public.competition_type then
    return query select 'team_competition_required', p_team_id, p_competition_id, 0, 0, false, false;
    return;
  end if;

  select t.*
  into v_team
  from public.teams t
  where t.id = p_team_id;

  if not found then
    return query select 'team_not_found', p_team_id, p_competition_id, 0, 0, false, false;
    return;
  end if;

  if v_team.is_archived then
    return query select 'team_archived', p_team_id, p_competition_id, 0, 0, false, false;
    return;
  end if;

  if not exists (
    select 1
    from public.team_memberships tm
    where tm.team_id = p_team_id
      and tm.profile_id = v_actor_id
      and tm.role = 'leader'::public.team_role
      and tm.is_active = true
  ) then
    return query select 'not_team_leader', p_team_id, p_competition_id, 0, 0, false, false;
    return;
  end if;

  select count(*)
  into v_roster_count
  from public.team_memberships tm
  where tm.team_id = p_team_id
    and tm.is_active = true;

  v_required_count := coalesce(v_competition.participants_per_team, 0);

  if v_roster_count <> v_required_count then
    return query select 'team_size_invalid', p_team_id, p_competition_id, v_roster_count, v_required_count, false, false;
    return;
  end if;

  select count(*)
  into v_incomplete_count
  from public.team_memberships tm
  join public.profiles p on p.id = tm.profile_id
  where tm.team_id = p_team_id
    and tm.is_active = true
    and (
      p.is_active = false
      or nullif(btrim(p.full_name), '') is null
      or nullif(btrim(p.school), '') is null
      or nullif(btrim(p.grade_level), '') is null
    );

  if v_incomplete_count > 0 then
    return query select 'team_member_profile_incomplete', p_team_id, p_competition_id, v_roster_count, v_required_count, false, false;
    return;
  end if;

  select exists (
    select 1
    from public.team_memberships tm
    join public.team_memberships tm_other
      on tm_other.profile_id = tm.profile_id
      and tm_other.is_active = true
      and tm_other.team_id <> p_team_id
    join public.competition_registrations cr
      on cr.team_id = tm_other.team_id
      and cr.competition_id = p_competition_id
      and cr.status = 'registered'::public.registration_status
    where tm.team_id = p_team_id
      and tm.is_active = true
  )
  into v_conflict;

  if v_conflict then
    return query select 'team_member_conflict', p_team_id, p_competition_id, v_roster_count, v_required_count, true, false;
    return;
  end if;

  return query select 'ok', p_team_id, p_competition_id, v_roster_count, v_required_count, false, true;
end;
$$;

create or replace function public.register_for_competition(
  p_competition_id uuid,
  p_team_id uuid default null,
  p_request_idempotency_token text default null
)
returns table (
  machine_code text,
  registration_id uuid,
  status public.registration_status,
  status_reason text,
  entry_snapshot_json jsonb,
  replayed boolean,
  changed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
  v_competition public.competitions%rowtype;
  v_registration public.competition_registrations%rowtype;
  v_profile public.profiles%rowtype;
  v_team public.teams%rowtype;
  v_capacity_count integer := 0;
  v_capacity_limit integer := 0;
  v_existing_registration boolean := false;
  v_snapshot jsonb;
  v_token text := btrim(coalesce(p_request_idempotency_token, ''));
  v_validation record;
  v_effective_registration_end timestamptz;
begin
  if v_actor_id is null then
    return query select 'unauthenticated', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
    return;
  end if;

  if p_competition_id is null then
    return query select 'competition_id_required', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
    return;
  end if;

  if v_token = '' then
    return query select 'request_idempotency_token_required', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
    return;
  end if;

  select c.*
  into v_competition
  from public.competitions c
  where c.id = p_competition_id
  for update;

  if not found then
    return query select 'competition_not_found', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
    return;
  end if;

  if v_competition.is_deleted then
    return query select 'competition_deleted', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
    return;
  end if;

  if v_competition.status not in (
    'published'::public.competition_status,
    'live'::public.competition_status,
    'paused'::public.competition_status
  ) then
    return query select 'competition_unavailable', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
    return;
  end if;

  if v_competition.type = 'scheduled'::public.competition_type then
    v_effective_registration_end := coalesce(v_competition.registration_end, v_competition.start_time);

    if v_effective_registration_end is null then
      return query select 'registration_window_missing', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
      return;
    end if;

    if v_competition.registration_start is not null and v_now < v_competition.registration_start then
      return query select 'registration_not_started', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
      return;
    end if;

    if v_now >= v_effective_registration_end then
      return query select 'registration_closed', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
      return;
    end if;

    if v_competition.start_time is not null and v_now >= v_competition.start_time then
      return query select 'competition_started', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
      return;
    end if;
  end if;

  perform pg_advisory_xact_lock(
    hashtext('competition_registration:' || p_competition_id::text)
  );

  if p_team_id is null then
    if v_competition.format <> 'individual'::public.competition_format then
      return query select 'team_required', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
      return;
    end if;

    select p.*
    into v_profile
    from public.profiles p
    where p.id = v_actor_id;

    if not found then
      return query select 'profile_not_found', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
      return;
    end if;

    if v_profile.is_active = false then
      return query select 'profile_inactive', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
      return;
    end if;

    if nullif(btrim(v_profile.full_name), '') is null
       or nullif(btrim(v_profile.school), '') is null
       or nullif(btrim(v_profile.grade_level), '') is null then
      return query select 'profile_incomplete', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
      return;
    end if;

    select cr.*
    into v_registration
    from public.competition_registrations cr
    where cr.competition_id = p_competition_id
      and cr.profile_id = v_actor_id
    for update;
    v_existing_registration := found;

    if v_existing_registration then
      if v_registration.status = 'registered'::public.registration_status then
        return query select 'already_registered', v_registration.id, v_registration.status, v_registration.status_reason, v_registration.entry_snapshot_json, true, false;
        return;
      end if;

      if v_registration.status = 'cancelled'::public.registration_status then
        return query select 'registration_cancelled', v_registration.id, v_registration.status, v_registration.status_reason, v_registration.entry_snapshot_json, false, false;
        return;
      end if;
    end if;

    select count(*)
    into v_capacity_count
    from public.competition_registrations cr
    where cr.competition_id = p_competition_id
      and cr.status = 'registered'::public.registration_status;

    v_capacity_limit := coalesce(v_competition.max_participants, 0);

    if v_capacity_limit > 0 and v_capacity_count >= v_capacity_limit then
      return query select 'capacity_full', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
      return;
    end if;

    v_snapshot := jsonb_build_object(
      'profile_id', v_profile.id,
      'full_name', v_profile.full_name,
      'school', v_profile.school,
      'grade_level', v_profile.grade_level,
      'registered_at', v_now
    );

    if v_existing_registration then
      update public.competition_registrations as cr
      set status = 'registered'::public.registration_status,
          status_reason = null,
          entry_snapshot_json = v_snapshot,
          registered_at = v_now,
          updated_at = v_now
      where cr.id = v_registration.id
      returning *
      into v_registration;

      return query select 'ok', v_registration.id, v_registration.status, v_registration.status_reason, v_registration.entry_snapshot_json, false, true;
      return;
    end if;

    insert into public.competition_registrations (
      competition_id,
      profile_id,
      team_id,
      status,
      status_reason,
      entry_snapshot_json,
      registered_at,
      updated_at
    )
    values (
      p_competition_id,
      v_actor_id,
      null,
      'registered'::public.registration_status,
      null,
      v_snapshot,
      v_now,
      v_now
    )
    returning *
    into v_registration;

    return query select 'ok', v_registration.id, v_registration.status, v_registration.status_reason, v_registration.entry_snapshot_json, false, true;
    return;
  end if;

  if v_competition.format <> 'team'::public.competition_format
     or v_competition.type <> 'scheduled'::public.competition_type then
    return query select 'team_registration_not_allowed', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
    return;
  end if;

  select t.*
  into v_team
  from public.teams t
  where t.id = p_team_id;

  if not found then
    return query select 'team_not_found', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
    return;
  end if;

  if v_team.is_archived then
    return query select 'team_archived', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
    return;
  end if;

  if not exists (
    select 1
    from public.team_memberships tm
    where tm.team_id = p_team_id
      and tm.profile_id = v_actor_id
      and tm.role = 'leader'::public.team_role
      and tm.is_active = true
  ) then
    return query select 'not_team_leader', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
    return;
  end if;

  select cr.*
  into v_registration
  from public.competition_registrations cr
  where cr.competition_id = p_competition_id
    and cr.team_id = p_team_id
  for update;
  v_existing_registration := found;

  select vtr.*
  into v_validation
  from public.validate_team_registration(p_team_id, p_competition_id) vtr
  limit 1;

  if v_validation.machine_code is distinct from 'ok' then
    v_snapshot := jsonb_build_object(
      'team_id', v_team.id,
      'team_name', v_team.name,
      'team_code', v_team.team_code,
      'registered_at', v_now,
      'roster', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'profile_id', p.id,
              'full_name', p.full_name,
              'school', p.school,
              'grade_level', p.grade_level,
              'role', tm.role
            )
            order by tm.joined_at asc, tm.id asc
          ),
          '[]'::jsonb
        )
        from public.team_memberships tm
        join public.profiles p on p.id = tm.profile_id
        where tm.team_id = p_team_id
          and tm.is_active = true
      )
    );

    if v_existing_registration then
      if v_registration.status = 'ineligible'::public.registration_status
         and v_registration.status_reason = v_validation.machine_code then
        return query select 'ineligible', v_registration.id, v_registration.status, v_registration.status_reason, v_registration.entry_snapshot_json, true, false;
        return;
      end if;

      update public.competition_registrations as cr
      set status = 'ineligible'::public.registration_status,
          status_reason = v_validation.machine_code,
          entry_snapshot_json = v_snapshot,
          registered_at = v_now,
          updated_at = v_now
      where cr.id = v_registration.id
      returning *
      into v_registration;

      return query select 'ineligible', v_registration.id, v_registration.status, v_registration.status_reason, v_registration.entry_snapshot_json, false, true;
      return;
    end if;

    insert into public.competition_registrations (
      competition_id,
      profile_id,
      team_id,
      status,
      status_reason,
      entry_snapshot_json,
      registered_at,
      updated_at
    )
    values (
      p_competition_id,
      null,
      p_team_id,
      'ineligible'::public.registration_status,
      v_validation.machine_code,
      v_snapshot,
      v_now,
      v_now
    )
    returning *
    into v_registration;

    return query select 'ineligible', v_registration.id, v_registration.status, v_registration.status_reason, v_registration.entry_snapshot_json, false, true;
    return;
  end if;

  if v_existing_registration then
    if v_registration.status = 'registered'::public.registration_status then
      return query select 'already_registered', v_registration.id, v_registration.status, v_registration.status_reason, v_registration.entry_snapshot_json, true, false;
      return;
    end if;

    if v_registration.status = 'cancelled'::public.registration_status then
      return query select 'registration_cancelled', v_registration.id, v_registration.status, v_registration.status_reason, v_registration.entry_snapshot_json, false, false;
      return;
    end if;
  end if;

  select count(*)
  into v_capacity_count
  from public.competition_registrations cr
  where cr.competition_id = p_competition_id
    and cr.status = 'registered'::public.registration_status;

  v_capacity_limit := coalesce(v_competition.max_teams, 0);

  if v_capacity_limit > 0 and v_capacity_count >= v_capacity_limit then
    return query select 'capacity_full', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
    return;
  end if;

  v_snapshot := jsonb_build_object(
    'team_id', v_team.id,
    'team_name', v_team.name,
    'team_code', v_team.team_code,
    'registered_at', v_now,
    'roster', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'profile_id', p.id,
            'full_name', p.full_name,
            'school', p.school,
            'grade_level', p.grade_level,
            'role', tm.role
          )
          order by tm.joined_at asc, tm.id asc
        ),
        '[]'::jsonb
      )
      from public.team_memberships tm
      join public.profiles p on p.id = tm.profile_id
      where tm.team_id = p_team_id
        and tm.is_active = true
    )
  );

  if v_existing_registration then
    update public.competition_registrations as cr
    set status = 'registered'::public.registration_status,
        status_reason = null,
        entry_snapshot_json = v_snapshot,
        registered_at = v_now,
        updated_at = v_now
    where cr.id = v_registration.id
    returning *
    into v_registration;

    return query select 'ok', v_registration.id, v_registration.status, v_registration.status_reason, v_registration.entry_snapshot_json, false, true;
    return;
  end if;

  insert into public.competition_registrations (
    competition_id,
    profile_id,
    team_id,
    status,
    status_reason,
    entry_snapshot_json,
    registered_at,
    updated_at
  )
  values (
    p_competition_id,
    null,
    p_team_id,
    'registered'::public.registration_status,
    null,
    v_snapshot,
    v_now,
    v_now
  )
  returning *
  into v_registration;

  return query select 'ok', v_registration.id, v_registration.status, v_registration.status_reason, v_registration.entry_snapshot_json, false, true;
end;
$$;

grant execute on function public.validate_team_registration(uuid, uuid) to authenticated, service_role;
grant execute on function public.register_for_competition(uuid, uuid, text) to authenticated, service_role;
