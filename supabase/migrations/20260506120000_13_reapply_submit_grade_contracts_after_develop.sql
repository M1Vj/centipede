begin;

create or replace function public.submit_competition_attempt(
  p_attempt_id uuid,
  p_actor_user_id uuid,
  p_request_idempotency_token text,
  p_submission_kind text default 'manual'
)
returns table (
  machine_code text,
  attempt_id uuid,
  status public.attempt_status,
  submitted_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_attempt public.competition_attempts%rowtype;
  v_competition public.competitions%rowtype;
  v_registration public.competition_registrations%rowtype;
  v_token text := btrim(coalesce(p_request_idempotency_token, ''));
  v_caller_id uuid := p_actor_user_id;
  v_total_time integer;
begin
  if auth.role() <> 'service_role' then
    return query
      select 'forbidden'::text, null::uuid, null::public.attempt_status, null::timestamptz, false;
    return;
  end if;

  if p_attempt_id is null then
    return query
      select 'attempt_id_required'::text, null::uuid, null::public.attempt_status, null::timestamptz, false;
    return;
  end if;

  if v_token = '' then
    return query
      select 'request_idempotency_token_required'::text, null::uuid, null::public.attempt_status, null::timestamptz, false;
    return;
  end if;

  if p_submission_kind not in ('manual', 'auto') then
    return query
      select 'invalid_submission_kind'::text, null::uuid, null::public.attempt_status, null::timestamptz, false;
    return;
  end if;

  if p_submission_kind = 'manual' and v_caller_id is null then
    return query
      select 'actor_user_id_required'::text, null::uuid, null::public.attempt_status, null::timestamptz, false;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('arena:submit_attempt:attempt:' || p_attempt_id::text));

  select *
  into v_attempt
  from public.competition_attempts ca
  where ca.id = p_attempt_id
  for update;

  if not found then
    return query
      select 'attempt_not_found'::text, null::uuid, null::public.attempt_status, null::timestamptz, false;
    return;
  end if;

  if v_attempt.status in ('submitted'::public.attempt_status, 'auto_submitted'::public.attempt_status, 'graded'::public.attempt_status) then
    return query
      select 'ok'::text, p_attempt_id, v_attempt.status, v_attempt.submitted_at, true;
    return;
  end if;

  if v_attempt.status <> 'in_progress'::public.attempt_status then
    return query
      select 'attempt_not_in_progress'::text, p_attempt_id, v_attempt.status, null::timestamptz, false;
    return;
  end if;

  select *
  into v_competition
  from public.competitions c
  where c.id = v_attempt.competition_id;

  select *
  into v_registration
  from public.competition_registrations cr
  where cr.id = v_attempt.registration_id;

  if p_submission_kind = 'manual' and v_registration.profile_id is not null and v_registration.profile_id <> v_caller_id then
    return query
      select 'forbidden'::text, p_attempt_id, v_attempt.status, null::timestamptz, false;
    return;
  end if;

  if p_submission_kind = 'manual' and v_registration.team_id is not null then
    if not exists (
      select 1
      from public.team_memberships tm
      where tm.team_id = v_registration.team_id
        and tm.profile_id = v_caller_id
        and tm.is_active = true
        and tm.role = 'leader'
    ) then
      return query
        select 'team_leader_required'::text, p_attempt_id, v_attempt.status, null::timestamptz, false;
      return;
    end if;
  end if;

  update public.attempt_intervals ai
  set ended_at = now()
  where ai.attempt_id = p_attempt_id
    and ai.ended_at is null;

  select coalesce(sum(extract(epoch from (coalesce(ai.ended_at, now()) - ai.started_at)))::integer, 0)
  into v_total_time
  from public.attempt_intervals ai
  where ai.attempt_id = p_attempt_id;

  update public.competition_attempts ca
  set status = case
        when p_submission_kind = 'auto' then 'auto_submitted'::public.attempt_status
        else 'submitted'::public.attempt_status
      end,
      submitted_at = now(),
      total_time_seconds = v_total_time
  where ca.id = p_attempt_id
  returning * into v_attempt;

  perform public.grade_attempt(p_attempt_id);

  update public.competition_attempts ca
  set is_latest_visible_result = (ca.id = (
    select ca2.id
    from public.competition_attempts ca2
    where ca2.registration_id = v_attempt.registration_id
      and ca2.status in ('submitted'::public.attempt_status, 'auto_submitted'::public.attempt_status, 'graded'::public.attempt_status)
    order by
      case coalesce(v_competition.multi_attempt_grading_mode, 'highest_score'::public.attempt_grading_mode)
        when 'highest_score'::public.attempt_grading_mode then ca2.final_score
        else 0
      end desc,
      case coalesce(v_competition.multi_attempt_grading_mode, 'highest_score'::public.attempt_grading_mode)
        when 'latest_score'::public.attempt_grading_mode then ca2.attempt_no
        else 0
      end desc,
      ca2.attempt_no desc
    limit 1
  ))
  where ca.registration_id = v_attempt.registration_id
    and ca.status in ('submitted'::public.attempt_status, 'auto_submitted'::public.attempt_status, 'graded'::public.attempt_status);

  return query
    select 'ok'::text, p_attempt_id, v_attempt.status, v_attempt.submitted_at, false;
end;
$$;

create or replace function public.grade_attempt(p_attempt_id uuid)
returns table (
  attempt_id uuid,
  competition_id uuid,
  machine_code text,
  raw_score numeric,
  penalty_score numeric,
  final_score numeric,
  graded_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only trusted backend grading flows may execute grade_attempt.';
  end if;

  if p_attempt_id is null then
    raise exception 'attempt_id is required.';
  end if;

  return query
  select
    p_attempt_id,
    null::uuid,
    'deferred_owner_schema'::text,
    0::numeric,
    0::numeric,
    0::numeric,
    now();
end;
$$;

revoke all on function public.submit_competition_attempt(uuid, uuid, text, text) from public;
revoke all on function public.submit_competition_attempt(uuid, uuid, text, text) from anon, authenticated;
grant execute on function public.submit_competition_attempt(uuid, uuid, text, text) to service_role;

revoke all on function public.grade_attempt(uuid) from public;
revoke all on function public.grade_attempt(uuid) from anon, authenticated;
grant execute on function public.grade_attempt(uuid) to service_role;

commit;
