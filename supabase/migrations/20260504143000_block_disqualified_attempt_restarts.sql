begin;

create or replace function public.start_competition_attempt(
  p_registration_id uuid,
  p_actor_user_id uuid,
  p_request_idempotency_token text
)
returns table (
  machine_code text,
  attempt_id uuid,
  competition_id uuid,
  attempt_no integer,
  remaining_seconds integer,
  started_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration public.competition_registrations%rowtype;
  v_competition public.competitions%rowtype;
  v_token text := btrim(coalesce(p_request_idempotency_token, ''));
  v_caller_id uuid := p_actor_user_id;
  v_attempt public.competition_attempts%rowtype;
  v_existing_attempt public.competition_attempts%rowtype;
  v_attempt_count integer;
  v_attempt_no integer;
  v_remaining integer;
  v_attempt_base_deadline_at timestamptz;
  v_scheduled_competition_end_cap_at timestamptz;
  v_has_disqualified_attempt boolean;
begin
  if auth.role() <> 'service_role' then
    return query
      select 'forbidden'::text, null::uuid, null::uuid, null::integer, null::integer, null::timestamptz, false;
    return;
  end if;

  if p_registration_id is null then
    return query
      select 'registration_id_required'::text, null::uuid, null::uuid, null::integer, null::integer, null::timestamptz, false;
    return;
  end if;

  if v_token = '' then
    return query
      select 'request_idempotency_token_required'::text, null::uuid, null::uuid, null::integer, null::integer, null::timestamptz, false;
    return;
  end if;

  if v_caller_id is null then
    return query
      select 'actor_user_id_required'::text, null::uuid, null::uuid, null::integer, null::integer, null::timestamptz, false;
    return;
  end if;

  select *
  into v_registration
  from public.competition_registrations
  where id = p_registration_id
  for update;

  if not found then
    return query
      select 'registration_not_found'::text, null::uuid, null::uuid, null::integer, null::integer, null::timestamptz, false;
    return;
  end if;

  if v_registration.status <> 'registered'::public.registration_status then
    return query
      select 'registration_not_active'::text, null::uuid, v_registration.competition_id, null::integer, null::integer, null::timestamptz, false;
    return;
  end if;

  select *
  into v_competition
  from public.competitions
  where id = v_registration.competition_id;

  if not found then
    return query
      select 'competition_not_found'::text, null::uuid, v_registration.competition_id, null::integer, null::integer, null::timestamptz, false;
    return;
  end if;

  if v_competition.is_deleted then
    return query
      select 'competition_deleted'::text, null::uuid, v_competition.id, null::integer, null::integer, null::timestamptz, false;
    return;
  end if;

  if v_competition.type = 'scheduled'::public.competition_type then
    if v_competition.status <> 'live'::public.competition_status then
      return query
        select 'competition_not_live'::text, null::uuid, v_competition.id, null::integer, null::integer, null::timestamptz, false;
      return;
    end if;

    if v_competition.start_time is not null and now() < v_competition.start_time then
      return query
        select 'competition_not_started_yet'::text, null::uuid, v_competition.id, null::integer, null::integer, null::timestamptz, false;
      return;
    end if;
  else
    if v_competition.status not in ('published'::public.competition_status, 'live'::public.competition_status) then
      return query
        select 'competition_not_available'::text, null::uuid, v_competition.id, null::integer, null::integer, null::timestamptz, false;
      return;
    end if;
  end if;

  if v_registration.team_id is not null then
    if not exists (
      select 1
      from public.team_memberships
      where team_id = v_registration.team_id
        and profile_id = v_caller_id
        and is_active = true
        and role = 'leader'
    ) then
      return query
        select 'team_leader_required'::text, null::uuid, v_competition.id, null::integer, null::integer, null::timestamptz, false;
      return;
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('arena:start_attempt:registration:' || p_registration_id::text));

  select exists (
    select 1
    from public.competition_attempts
    where registration_id = p_registration_id
      and status = 'disqualified'::public.attempt_status
  )
  into v_has_disqualified_attempt;

  if v_has_disqualified_attempt then
    return query
      select 'attempts_exhausted'::text, null::uuid, v_competition.id, null::integer, null::integer, null::timestamptz, false;
    return;
  end if;

  select *
  into v_existing_attempt
  from public.competition_attempts
  where registration_id = p_registration_id
    and status = 'in_progress'::public.attempt_status
  order by started_at desc, id desc
  limit 1;

  if found then
    v_remaining := greatest(
      0,
      extract(epoch from (coalesce(v_existing_attempt.effective_attempt_deadline_at, v_existing_attempt.started_at) - now()))::integer
    );

    return query
      select 'ok'::text, v_existing_attempt.id, v_competition.id, v_existing_attempt.attempt_no, v_remaining, v_existing_attempt.started_at, true;
    return;
  end if;

  select count(*)
  into v_attempt_count
  from public.competition_attempts
  where registration_id = p_registration_id;

  if v_attempt_count >= coalesce(v_competition.attempts_allowed, 1) then
    return query
      select 'attempts_exhausted'::text, null::uuid, v_competition.id, null::integer, null::integer, null::timestamptz, false;
    return;
  end if;

  v_attempt_no := v_attempt_count + 1;

  v_attempt_base_deadline_at :=
    now() + make_interval(mins => coalesce(v_competition.duration_minutes, 0));
  v_scheduled_competition_end_cap_at :=
    coalesce(
      v_competition.end_time,
      v_competition.start_time + make_interval(mins => coalesce(v_competition.duration_minutes, 0))
    );

  insert into public.competition_attempts (
    competition_id,
    registration_id,
    attempt_no,
    status,
    started_at,
    attempt_base_deadline_at,
    scheduled_competition_end_cap_at,
    effective_attempt_deadline_at
  )
  values (
    v_competition.id,
    p_registration_id,
    v_attempt_no,
    'in_progress',
    now(),
    v_attempt_base_deadline_at,
    v_scheduled_competition_end_cap_at,
    case
      when v_competition.type = 'scheduled'::public.competition_type then least(
        v_attempt_base_deadline_at,
        coalesce(v_scheduled_competition_end_cap_at, v_attempt_base_deadline_at)
      )
      else v_attempt_base_deadline_at
    end
  )
  returning * into v_attempt;

  insert into public.attempt_answers (attempt_id, competition_problem_id, status_flag)
  select v_attempt.id, cp.id, 'blank'::public.answer_status_flag
  from public.competition_problems cp
  where cp.competition_id = v_competition.id
  order by cp.order_index;

  insert into public.attempt_intervals (attempt_id, started_at)
  values (v_attempt.id, now());

  v_remaining := greatest(
    0,
    extract(epoch from (coalesce(v_attempt.effective_attempt_deadline_at, v_attempt.started_at) - now()))::integer
  );

  return query
    select 'ok'::text, v_attempt.id, v_competition.id, v_attempt.attempt_no, v_remaining, v_attempt.started_at, false;
end;
$$;

revoke all on function public.start_competition_attempt(uuid, uuid, text) from public;
revoke all on function public.start_competition_attempt(uuid, uuid, text) from anon, authenticated;
grant execute on function public.start_competition_attempt(uuid, uuid, text) to service_role;

commit;
