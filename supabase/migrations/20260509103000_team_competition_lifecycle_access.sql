begin;

alter table public.competition_attempts
  add column if not exists participant_profile_id uuid references public.profiles(id) on delete set null;

update public.competition_attempts ca
set participant_profile_id = cr.profile_id
from public.competition_registrations cr
where cr.id = ca.registration_id
  and ca.participant_profile_id is null
  and cr.profile_id is not null;

with team_leaders as (
  select distinct on (tm.team_id)
    tm.team_id,
    tm.profile_id
  from public.team_memberships tm
  where tm.is_active = true
    and tm.role = 'leader'
  order by tm.team_id, tm.joined_at asc, tm.id asc
)
update public.competition_attempts ca
set participant_profile_id = tl.profile_id
from public.competition_registrations cr
join team_leaders tl on tl.team_id = cr.team_id
where cr.id = ca.registration_id
  and ca.participant_profile_id is null
  and cr.team_id is not null;

drop index if exists public.competition_attempts_registration_no_uq;
create unique index if not exists competition_attempts_registration_participant_no_uq
  on public.competition_attempts (registration_id, participant_profile_id, attempt_no)
  where participant_profile_id is not null;

create index if not exists competition_attempts_registration_participant_status_idx
  on public.competition_attempts (registration_id, participant_profile_id, status);

create or replace function public.can_actor_use_competition_registration(
  p_registration_id uuid,
  p_actor_user_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.competition_registrations cr
    where cr.id = p_registration_id
      and cr.status = 'registered'::public.registration_status
      and (
        cr.profile_id = p_actor_user_id
        or (
          cr.team_id is not null
          and public.is_active_team_member(cr.team_id, p_actor_user_id)
        )
      )
  );
$$;

create or replace function public.can_actor_use_competition_attempt(
  p_attempt_id uuid,
  p_actor_user_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.competition_attempts ca
    join public.competition_registrations cr on cr.id = ca.registration_id
    where ca.id = p_attempt_id
      and ca.participant_profile_id = p_actor_user_id
      and cr.status = 'registered'::public.registration_status
      and (
        cr.profile_id = p_actor_user_id
        or (
          cr.team_id is not null
          and public.is_active_team_member(cr.team_id, p_actor_user_id)
        )
      )
  );
$$;

drop policy if exists "competition_attempts_select_participant" on public.competition_attempts;
create policy "competition_attempts_select_participant"
on public.competition_attempts
for select
using (
  public.jwt_is_admin()
  or participant_profile_id = auth.uid()
  or exists (
    select 1
    from public.competitions c
    where c.id = competition_id
      and c.organizer_id = auth.uid()
  )
);

drop policy if exists "attempt_answers_select_participant" on public.attempt_answers;
create policy "attempt_answers_select_participant"
on public.attempt_answers
for select
using (
  public.jwt_is_admin()
  or exists (
    select 1
    from public.competition_attempts ca
    where ca.id = attempt_id
      and ca.participant_profile_id = auth.uid()
  )
  or exists (
    select 1
    from public.competition_attempts ca
    join public.competitions c on c.id = ca.competition_id
    where ca.id = attempt_id
      and c.organizer_id = auth.uid()
  )
);

create or replace function public.prevent_active_registration_roster_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_active = true and public.team_has_active_competition_registration(new.team_id) then
      raise exception 'Team roster changes are locked for an active registration.'
        using errcode = '23514',
              detail = 'active_team_registration_roster_locked';
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.is_active = true and public.team_has_active_competition_registration(old.team_id) then
      raise exception 'Team roster changes are locked for an active registration.'
        using errcode = '23514',
              detail = 'active_team_registration_roster_locked';
    end if;

    return old;
  end if;

  if old.is_active = true
     and (
       new.is_active = false
       or new.left_at is not null
       or new.profile_id is distinct from old.profile_id
       or new.team_id is distinct from old.team_id
     )
     and public.team_has_active_competition_registration(old.team_id) then
    raise exception 'Team roster changes are locked for an active registration.'
      using errcode = '23514',
            detail = 'active_team_registration_roster_locked';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_team_memberships_prevent_active_registration_roster_mutation
  on public.team_memberships;
create trigger trg_team_memberships_prevent_active_registration_roster_mutation
before insert or update or delete on public.team_memberships
for each row
execute function public.prevent_active_registration_roster_mutation();

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
  from public.competition_registrations cr
  where cr.id = p_registration_id
  for update;

  if not found then
    return query
      select 'registration_not_found'::text, null::uuid, null::uuid, null::integer, null::integer, null::timestamptz, false;
    return;
  end if;

  if not public.can_actor_use_competition_registration(p_registration_id, v_caller_id) then
    return query
      select 'registration_participant_required'::text, null::uuid, v_registration.competition_id, null::integer, null::integer, null::timestamptz, false;
    return;
  end if;

  select *
  into v_competition
  from public.competitions c
  where c.id = v_registration.competition_id;

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

  perform pg_advisory_xact_lock(hashtext('arena:start_attempt:registration:' || p_registration_id::text || ':participant:' || v_caller_id::text));

  select exists (
    select 1
    from public.competition_attempts ca
    where ca.registration_id = p_registration_id
      and ca.participant_profile_id = v_caller_id
      and ca.status = 'disqualified'::public.attempt_status
  )
  into v_has_disqualified_attempt;

  if v_has_disqualified_attempt then
    return query
      select 'attempts_exhausted'::text, null::uuid, v_competition.id, null::integer, null::integer, null::timestamptz, false;
    return;
  end if;

  select *
  into v_existing_attempt
  from public.competition_attempts ca
  where ca.registration_id = p_registration_id
    and ca.participant_profile_id = v_caller_id
    and ca.status = 'in_progress'::public.attempt_status
  order by ca.started_at desc, ca.id desc
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
  from public.competition_attempts ca
  where ca.registration_id = p_registration_id
    and ca.participant_profile_id = v_caller_id;

  if v_attempt_count >= coalesce(v_competition.attempts_allowed, 1) then
    return query
      select 'attempts_exhausted'::text, null::uuid, v_competition.id, null::integer, null::integer, null::timestamptz, false;
    return;
  end if;

  v_attempt_no := v_attempt_count + 1;
  v_attempt_base_deadline_at := now() + make_interval(mins => coalesce(v_competition.duration_minutes, 0));
  v_scheduled_competition_end_cap_at := coalesce(
    v_competition.end_time,
    v_competition.start_time + make_interval(mins => coalesce(v_competition.duration_minutes, 0))
  );

  insert into public.competition_attempts (
    competition_id,
    registration_id,
    participant_profile_id,
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
    v_caller_id,
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

create or replace function public.resume_competition_attempt(
  p_attempt_id uuid,
  p_actor_user_id uuid,
  p_request_idempotency_token text
)
returns table (
  machine_code text,
  attempt_id uuid,
  remaining_seconds integer,
  replayed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.competition_attempts%rowtype;
  v_token text := btrim(coalesce(p_request_idempotency_token, ''));
  v_caller_id uuid := p_actor_user_id;
  v_remaining integer;
begin
  if auth.role() <> 'service_role' then
    return query select 'forbidden'::text, null::uuid, null::integer, false;
    return;
  end if;

  if p_attempt_id is null then
    return query select 'attempt_id_required'::text, null::uuid, null::integer, false;
    return;
  end if;

  if v_token = '' then
    return query select 'request_idempotency_token_required'::text, null::uuid, null::integer, false;
    return;
  end if;

  if v_caller_id is null then
    return query select 'actor_user_id_required'::text, null::uuid, null::integer, false;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('arena:resume_attempt:attempt:' || p_attempt_id::text));

  select *
  into v_attempt
  from public.competition_attempts ca
  where ca.id = p_attempt_id
  for update;

  if not found then
    return query select 'attempt_not_found'::text, null::uuid, null::integer, false;
    return;
  end if;

  if v_attempt.status <> 'in_progress'::public.attempt_status then
    return query select 'attempt_not_in_progress'::text, p_attempt_id, null::integer, false;
    return;
  end if;

  if not public.can_actor_use_competition_attempt(p_attempt_id, v_caller_id) then
    return query select 'registration_participant_required'::text, p_attempt_id, null::integer, false;
    return;
  end if;

  v_remaining := greatest(
    0,
    extract(epoch from (coalesce(v_attempt.effective_attempt_deadline_at, v_attempt.started_at) - now()))::integer
  );

  if v_remaining <= 0 then
    update public.attempt_intervals ai
    set ended_at = now()
    where ai.attempt_id = p_attempt_id
      and ai.ended_at is null;

    update public.competition_attempts ca
    set status = 'auto_submitted'::public.attempt_status,
        submitted_at = now(),
        total_time_seconds = coalesce((
          select sum(extract(epoch from (coalesce(ai.ended_at, now()) - ai.started_at)))::integer
          from public.attempt_intervals ai
          where ai.attempt_id = p_attempt_id
        ), 0)
    where ca.id = p_attempt_id;

    perform public.grade_attempt(p_attempt_id);

    return query select 'auto_submitted'::text, p_attempt_id, 0::integer, false;
    return;
  end if;

  update public.attempt_intervals ai
  set ended_at = now()
  where ai.attempt_id = p_attempt_id
    and ai.ended_at is null;

  insert into public.attempt_intervals (attempt_id, started_at)
  values (p_attempt_id, now());

  return query select 'ok'::text, p_attempt_id, v_remaining, false;
end;
$$;

create or replace function public.close_active_attempt_interval(
  p_attempt_id uuid,
  p_actor_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.competition_attempts%rowtype;
  v_closed_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only trusted arena flows may execute close_active_attempt_interval.';
  end if;

  if p_attempt_id is null then
    raise exception 'attempt_id is required.';
  end if;

  if p_actor_user_id is null then
    raise exception 'actor_user_id is required.';
  end if;

  perform pg_advisory_xact_lock(hashtext('arena:close_interval:attempt:' || p_attempt_id::text));

  select *
  into v_attempt
  from public.competition_attempts ca
  where ca.id = p_attempt_id
  for update;

  if not found then
    raise exception 'attempt_not_found';
  end if;

  if not public.can_actor_use_competition_attempt(p_attempt_id, p_actor_user_id) then
    raise exception 'forbidden';
  end if;

  update public.attempt_intervals ai
  set ended_at = now()
  where ai.attempt_id = p_attempt_id
    and ai.ended_at is null;

  get diagnostics v_closed_count = row_count;

  return v_closed_count;
end;
$$;

create or replace function public.save_attempt_answer(
  p_attempt_id uuid,
  p_actor_user_id uuid,
  p_competition_problem_id uuid,
  p_answer_latex text,
  p_answer_text_normalized text,
  p_status_flag public.answer_status_flag,
  p_client_updated_at timestamptz
)
returns table (
  machine_code text,
  answer_id uuid,
  last_saved_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.competition_attempts%rowtype;
  v_remaining integer;
  v_answer public.attempt_answers%rowtype;
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    return query select 'forbidden'::text, null::uuid, null::timestamptz;
    return;
  end if;

  if p_attempt_id is null then
    return query select 'attempt_id_required'::text, null::uuid, null::timestamptz;
    return;
  end if;

  if p_competition_problem_id is null then
    return query select 'competition_problem_id_required'::text, null::uuid, null::timestamptz;
    return;
  end if;

  if p_actor_user_id is null then
    return query select 'actor_user_id_required'::text, null::uuid, null::timestamptz;
    return;
  end if;

  if p_client_updated_at is null then
    return query select 'client_updated_at_required'::text, null::uuid, null::timestamptz;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('arena:save_answer:attempt:' || p_attempt_id::text));

  select *
  into v_attempt
  from public.competition_attempts ca
  where ca.id = p_attempt_id
  for update;

  if not found then
    return query select 'attempt_not_found'::text, null::uuid, null::timestamptz;
    return;
  end if;

  if v_attempt.status <> 'in_progress'::public.attempt_status then
    return query select 'attempt_not_in_progress'::text, null::uuid, null::timestamptz;
    return;
  end if;

  if not public.can_actor_use_competition_attempt(p_attempt_id, p_actor_user_id) then
    return query select 'registration_participant_required'::text, null::uuid, null::timestamptz;
    return;
  end if;

  v_remaining := greatest(
    0,
    extract(epoch from (coalesce(v_attempt.effective_attempt_deadline_at, v_attempt.started_at) - now()))::integer
  );

  if v_remaining <= 0 then
    return query select 'deadline_passed'::text, null::uuid, null::timestamptz;
    return;
  end if;

  if not exists (
    select 1
    from public.competition_problems cp
    where cp.id = p_competition_problem_id
      and cp.competition_id = v_attempt.competition_id
  ) then
    return query select 'competition_problem_not_found'::text, null::uuid, null::timestamptz;
    return;
  end if;

  insert into public.attempt_answers (
    attempt_id,
    competition_problem_id,
    answer_latex,
    answer_text_normalized,
    status_flag,
    last_saved_at,
    client_updated_at
  )
  values (
    p_attempt_id,
    p_competition_problem_id,
    coalesce(p_answer_latex, ''),
    coalesce(p_answer_text_normalized, ''),
    coalesce(p_status_flag, 'filled'::public.answer_status_flag),
    v_now,
    p_client_updated_at
  )
  on conflict (attempt_id, competition_problem_id)
  do update set
    answer_latex = coalesce(excluded.answer_latex, attempt_answers.answer_latex),
    answer_text_normalized = coalesce(excluded.answer_text_normalized, attempt_answers.answer_text_normalized),
    status_flag = excluded.status_flag,
    last_saved_at = excluded.last_saved_at,
    client_updated_at = excluded.client_updated_at
  where attempt_answers.client_updated_at < excluded.client_updated_at
  returning * into v_answer;

  if not found then
    select *
    into v_answer
    from public.attempt_answers aa
    where aa.attempt_id = p_attempt_id
      and aa.competition_problem_id = p_competition_problem_id;

    return query select 'answer_write_conflict'::text, v_answer.id, v_answer.last_saved_at;
    return;
  end if;

  return query select 'ok'::text, v_answer.id, v_answer.last_saved_at;
end;
$$;

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
    return query select 'forbidden'::text, null::uuid, null::public.attempt_status, null::timestamptz, false;
    return;
  end if;

  if p_attempt_id is null then
    return query select 'attempt_id_required'::text, null::uuid, null::public.attempt_status, null::timestamptz, false;
    return;
  end if;

  if v_token = '' then
    return query select 'request_idempotency_token_required'::text, null::uuid, null::public.attempt_status, null::timestamptz, false;
    return;
  end if;

  if p_submission_kind not in ('manual', 'auto') then
    return query select 'invalid_submission_kind'::text, null::uuid, null::public.attempt_status, null::timestamptz, false;
    return;
  end if;

  if p_submission_kind = 'manual' and v_caller_id is null then
    return query select 'actor_user_id_required'::text, null::uuid, null::public.attempt_status, null::timestamptz, false;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('arena:submit_attempt:attempt:' || p_attempt_id::text));

  select *
  into v_attempt
  from public.competition_attempts ca
  where ca.id = p_attempt_id
  for update;

  if not found then
    return query select 'attempt_not_found'::text, null::uuid, null::public.attempt_status, null::timestamptz, false;
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

  if p_submission_kind = 'manual'
     and not public.can_actor_use_competition_attempt(p_attempt_id, v_caller_id) then
    return query select 'registration_participant_required'::text, p_attempt_id, v_attempt.status, null::timestamptz, false;
    return;
  end if;

  if v_attempt.status in ('submitted'::public.attempt_status, 'auto_submitted'::public.attempt_status) then
    perform public.grade_attempt(p_attempt_id);
    select * into v_attempt from public.competition_attempts ca where ca.id = p_attempt_id;
  elsif v_attempt.status = 'graded'::public.attempt_status then
    if v_competition.type = 'open'::public.competition_type
       or coalesce(v_competition.leaderboard_published, false) then
      perform public.refresh_leaderboard_entries(v_attempt.competition_id);
    end if;

    return query select 'ok'::text, p_attempt_id, v_attempt.status, v_attempt.submitted_at, true;
    return;
  elsif v_attempt.status <> 'in_progress'::public.attempt_status then
    return query select 'attempt_not_in_progress'::text, p_attempt_id, v_attempt.status, null::timestamptz, false;
    return;
  else
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
    select * into v_attempt from public.competition_attempts ca where ca.id = p_attempt_id;
  end if;

  update public.competition_attempts ca
  set is_latest_visible_result = (ca.id = (
    select ca2.id
    from public.competition_attempts ca2
    where ca2.registration_id = v_attempt.registration_id
      and ca2.participant_profile_id = v_attempt.participant_profile_id
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
    and ca.participant_profile_id = v_attempt.participant_profile_id
    and ca.status in ('submitted'::public.attempt_status, 'auto_submitted'::public.attempt_status, 'graded'::public.attempt_status);

  if v_competition.type = 'open'::public.competition_type
     or coalesce(v_competition.leaderboard_published, false) then
    perform public.refresh_leaderboard_entries(v_attempt.competition_id);
  end if;

  return query
    select 'ok'::text, p_attempt_id, v_attempt.status, v_attempt.submitted_at, v_attempt.status <> 'graded'::public.attempt_status;
end;
$$;

create or replace function public.log_tab_switch_offense(
  p_attempt_id uuid,
  p_metadata_json jsonb,
  p_actor_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := coalesce(p_actor_user_id, auth.uid());
  v_attempt public.competition_attempts%rowtype;
  v_registration public.competition_registrations%rowtype;
  v_competition public.competitions%rowtype;
  v_offense_number integer;
  v_penalty_applied text := 'none';
  v_client_timestamp_str text;
  v_client_timestamp timestamptz := null;
  v_penalties jsonb;
  v_penalty_rules jsonb;
  v_penalty_rule jsonb;
  v_penalty_kind text;
  v_penalty_threshold integer;
  v_warning_threshold integer := 999999;
  v_deduction_threshold integer := 999999;
  v_deduction_value numeric := 0;
  v_auto_submit_threshold integer := 999999;
  v_disqualification_threshold integer := 999999;
  v_last_log_time timestamptz;
  v_last_penalty text;
  v_has_rule boolean := false;
begin
  if auth.role() <> 'service_role' and p_actor_user_id is not null and p_actor_user_id <> auth.uid() then
    raise exception 'forbidden';
  end if;

  if p_attempt_id is null then
    raise exception 'attempt_id_required';
  end if;

  if p_metadata_json is null or jsonb_typeof(p_metadata_json) <> 'object' then
    raise exception 'metadata_json_object_required';
  end if;

  if not (p_metadata_json ? 'event_source' and p_metadata_json ? 'visibility_state' and p_metadata_json ? 'route_path' and p_metadata_json ? 'user_agent' and p_metadata_json ? 'client_timestamp') then
    raise exception 'metadata_json_missing_keys';
  end if;

  if v_caller_id is null then
    raise exception 'authentication_required';
  end if;

  perform pg_advisory_xact_lock(hashtext('arena:log_offense:attempt:' || p_attempt_id::text));

  select *
  into v_attempt
  from public.competition_attempts
  where id = p_attempt_id
  for update;

  if not found then
    raise exception 'attempt_not_found';
  end if;

  select logged_at, penalty_applied
  into v_last_log_time, v_last_penalty
  from public.tab_switch_logs
  where attempt_id = p_attempt_id
  order by logged_at desc
  limit 1;

  if v_attempt.status <> 'in_progress'::public.attempt_status then
    return coalesce(v_last_penalty, 'none');
  end if;

  select *
  into v_registration
  from public.competition_registrations
  where id = v_attempt.registration_id;

  if not public.can_actor_use_competition_attempt(p_attempt_id, v_caller_id) then
    raise exception 'forbidden';
  end if;

  select *
  into v_competition
  from public.competitions
  where id = v_attempt.competition_id;

  v_client_timestamp_str := p_metadata_json->>'client_timestamp';
  if v_client_timestamp_str is not null then
    begin
      v_client_timestamp := v_client_timestamp_str::timestamptz;
    exception when others then
      v_client_timestamp := null;
    end;
  end if;

  if v_last_log_time is not null and extract(epoch from (now() - v_last_log_time)) < 5 then
    return v_last_penalty;
  end if;

  v_offense_number := v_attempt.offense_count + 1;
  v_penalty_rules := case
    when jsonb_typeof(coalesce(v_competition.offense_penalties, '[]'::jsonb)) = 'array'
      then coalesce(v_competition.offense_penalties, '[]'::jsonb)
    else '[]'::jsonb
  end;

  for v_penalty_rule in
    select value
    from jsonb_array_elements(v_penalty_rules)
  loop
    if jsonb_typeof(v_penalty_rule) <> 'object' then
      continue;
    end if;

    begin
      v_penalty_threshold := nullif(v_penalty_rule ->> 'threshold', '')::integer;
    exception when others then
      continue;
    end;

    if v_penalty_threshold is null or v_penalty_threshold < 1 then
      continue;
    end if;

    v_penalty_kind := v_penalty_rule ->> 'penaltyKind';

    if v_penalty_kind = 'warning' and v_penalty_threshold < v_warning_threshold then
      v_warning_threshold := v_penalty_threshold;
      v_has_rule := true;
    elsif v_penalty_kind = 'deduction' and v_penalty_threshold < v_deduction_threshold then
      v_deduction_threshold := v_penalty_threshold;
      begin
        v_deduction_value := coalesce(nullif(v_penalty_rule ->> 'deductionValue', '')::numeric, 0);
      exception when others then
        v_deduction_value := 0;
      end;
      v_has_rule := true;
    elsif v_penalty_kind = 'forced_submit' and v_penalty_threshold < v_auto_submit_threshold then
      v_auto_submit_threshold := v_penalty_threshold;
      v_has_rule := true;
    elsif v_penalty_kind = 'disqualification' and v_penalty_threshold < v_disqualification_threshold then
      v_disqualification_threshold := v_penalty_threshold;
      v_has_rule := true;
    end if;
  end loop;

  if not v_has_rule then
    v_penalties := coalesce(v_competition.offense_penalties_json, '{}'::jsonb);
    if v_penalties ? 'warning_threshold' then
      v_warning_threshold := (v_penalties->>'warning_threshold')::integer;
    end if;
    if v_penalties ? 'deduction_threshold' then
      v_deduction_threshold := (v_penalties->>'deduction_threshold')::integer;
    end if;
    if v_penalties ? 'deduction_value' then
      v_deduction_value := (v_penalties->>'deduction_value')::numeric;
    end if;
    if v_penalties ? 'auto_submit_threshold' then
      v_auto_submit_threshold := (v_penalties->>'auto_submit_threshold')::integer;
    end if;
    if v_penalties ? 'disqualification_threshold' then
      v_disqualification_threshold := (v_penalties->>'disqualification_threshold')::integer;
    end if;
  end if;

  if v_offense_number >= v_disqualification_threshold then
    v_penalty_applied := 'disqualified';
  elsif v_offense_number >= v_auto_submit_threshold then
    v_penalty_applied := 'auto_submit';
  elsif v_offense_number >= v_deduction_threshold then
    v_penalty_applied := 'deduction';
  elsif v_offense_number >= v_warning_threshold then
    v_penalty_applied := 'warning';
  else
    v_penalty_applied := 'none';
  end if;

  insert into public.tab_switch_logs (
    attempt_id,
    offense_number,
    penalty_applied,
    client_timestamp,
    metadata_json
  ) values (
    p_attempt_id,
    v_offense_number,
    v_penalty_applied,
    v_client_timestamp,
    p_metadata_json
  );

  update public.competition_attempts
  set offense_count = v_offense_number
  where id = p_attempt_id;

  if v_penalty_applied = 'deduction' then
    update public.competition_attempts
    set penalty_score = penalty_score + abs(v_deduction_value)
    where id = p_attempt_id;
  elsif v_penalty_applied = 'auto_submit' then
    update public.competition_attempts
    set status = 'auto_submitted'::public.attempt_status,
        submitted_at = now()
    where id = p_attempt_id;

    update public.attempt_intervals
    set ended_at = now()
    where attempt_id = p_attempt_id and ended_at is null;
  elsif v_penalty_applied = 'disqualified' then
    update public.competition_attempts
    set status = 'disqualified'::public.attempt_status,
        submitted_at = now()
    where id = p_attempt_id;

    update public.attempt_intervals
    set ended_at = now()
    where attempt_id = p_attempt_id and ended_at is null;
  end if;

  return v_penalty_applied;
end;
$$;

create or replace function public.refresh_leaderboard_entries(p_competition_id uuid)
returns table (
  competition_id uuid,
  machine_code text,
  refreshed_rows bigint,
  computed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_competition public.competitions%rowtype;
  v_now timestamptz := now();
  v_refreshed_rows bigint := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only trusted backend leaderboard flows may execute refresh_leaderboard_entries.';
  end if;

  if p_competition_id is null then
    raise exception 'competition_id is required.';
  end if;

  select *
  into v_competition
  from public.competitions c
  where c.id = p_competition_id;

  if not found then
    return query
    select p_competition_id, 'not_found'::text, 0::bigint, v_now;
    return;
  end if;

  with official_member_attempts as (
    select ranked_attempts.*
    from (
      select
        ca.*,
        row_number() over (
          partition by ca.registration_id, ca.participant_profile_id
          order by
            case coalesce(v_competition.multi_attempt_grading_mode, 'highest_score'::public.attempt_grading_mode)
              when 'highest_score'::public.attempt_grading_mode then coalesce(ca.final_score, 0)
              else 0
            end desc,
            case coalesce(v_competition.multi_attempt_grading_mode, 'highest_score'::public.attempt_grading_mode)
              when 'latest_score'::public.attempt_grading_mode then ca.attempt_no
              else 0
            end desc,
            ca.attempt_no desc,
            coalesce(ca.submitted_at, ca.started_at, now()) desc,
            ca.id desc
        ) as official_attempt_rank
      from public.competition_attempts ca
      where ca.competition_id = p_competition_id
        and ca.participant_profile_id is not null
        and ca.status in (
          'submitted'::public.attempt_status,
          'auto_submitted'::public.attempt_status,
          'disqualified'::public.attempt_status,
          'graded'::public.attempt_status
        )
    ) ranked_attempts
    where ranked_attempts.official_attempt_rank = 1
  )
  update public.competition_attempts ca
  set is_latest_visible_result = exists (
    select 1
    from official_member_attempts oma
    where oma.id = ca.id
  )
  where ca.competition_id = p_competition_id
    and ca.status in (
      'submitted'::public.attempt_status,
      'auto_submitted'::public.attempt_status,
      'disqualified'::public.attempt_status,
      'graded'::public.attempt_status
    );

  with official_member_attempts as (
    select ranked_attempts.*
    from (
      select
        ca.*,
        row_number() over (
          partition by ca.registration_id, ca.participant_profile_id
          order by
            case coalesce(v_competition.multi_attempt_grading_mode, 'highest_score'::public.attempt_grading_mode)
              when 'highest_score'::public.attempt_grading_mode then coalesce(ca.final_score, 0)
              else 0
            end desc,
            case coalesce(v_competition.multi_attempt_grading_mode, 'highest_score'::public.attempt_grading_mode)
              when 'latest_score'::public.attempt_grading_mode then ca.attempt_no
              else 0
            end desc,
            ca.attempt_no desc,
            coalesce(ca.submitted_at, ca.started_at, now()) desc,
            ca.id desc
        ) as official_attempt_rank
      from public.competition_attempts ca
      where ca.competition_id = p_competition_id
        and ca.participant_profile_id is not null
        and ca.status in (
          'submitted'::public.attempt_status,
          'auto_submitted'::public.attempt_status,
          'disqualified'::public.attempt_status,
          'graded'::public.attempt_status
        )
    ) ranked_attempts
    where ranked_attempts.official_attempt_rank = 1
  ), registration_scores as (
    select
      oma.competition_id,
      oma.registration_id,
      (array_agg(oma.id order by oma.participant_profile_id asc, oma.id asc))[1] as attempt_id,
      sum(coalesce(oma.final_score, 0)) as score,
      sum(coalesce(oma.total_time_seconds, 0))::integer as total_time_seconds,
      sum(coalesce(oma.offense_count, 0))::integer as offense_count,
      min(coalesce(oma.submitted_at, oma.started_at, now())) as first_submitted_at,
      min(oma.id) as stable_attempt_id
    from official_member_attempts oma
    group by oma.competition_id, oma.registration_id
  ), ranked_scores as (
    select
      rs.*,
      row_number() over (
        partition by rs.competition_id
        order by
          coalesce(rs.score, 0) desc,
          coalesce(rs.total_time_seconds, 2147483647) asc,
          rs.first_submitted_at asc,
          rs.stable_attempt_id asc
      ) as leaderboard_rank
    from registration_scores rs
  ), source_rows as (
    select
      ranked_scores.competition_id,
      ranked_scores.registration_id,
      ranked_scores.attempt_id,
      ranked_scores.leaderboard_rank as rank,
      coalesce(
        nullif(btrim(cr.entry_snapshot_json ->> 'display_name'), ''),
        nullif(btrim(cr.entry_snapshot_json ->> 'team_name'), ''),
        nullif(btrim(cr.entry_snapshot_json ->> 'full_name'), ''),
        nullif(btrim(t.name), ''),
        nullif(btrim(p.full_name), ''),
        'Participant'
      ) as display_name,
      ranked_scores.score,
      ranked_scores.total_time_seconds,
      ranked_scores.offense_count,
      case
        when v_competition.type = 'open'::public.competition_type
             and v_competition.status <> 'draft'::public.competition_status
          then true
        else coalesce(v_competition.leaderboard_published, false)
      end as published_visibility,
      v_now as computed_at
    from ranked_scores
    join public.competition_registrations cr on cr.id = ranked_scores.registration_id
    left join public.teams t on t.id = cr.team_id
    left join public.profiles p on p.id = cr.profile_id
  ), upserted as (
    insert into public.leaderboard_entries (
      competition_id,
      registration_id,
      attempt_id,
      rank,
      display_name,
      score,
      total_time_seconds,
      offense_count,
      published_visibility,
      computed_at
    )
    select
      sr.competition_id,
      sr.registration_id,
      sr.attempt_id,
      sr.rank,
      sr.display_name,
      sr.score,
      sr.total_time_seconds,
      sr.offense_count,
      sr.published_visibility,
      sr.computed_at
    from source_rows sr
    on conflict on constraint leaderboard_entries_competition_registration_uq
    do update set
      attempt_id = excluded.attempt_id,
      rank = excluded.rank,
      display_name = excluded.display_name,
      score = excluded.score,
      total_time_seconds = excluded.total_time_seconds,
      offense_count = excluded.offense_count,
      published_visibility = excluded.published_visibility,
      computed_at = excluded.computed_at
    returning 1
  )
  select count(*) into v_refreshed_rows from upserted;

  with active_score_registrations as (
    select distinct ca.registration_id
    from public.competition_attempts ca
    where ca.competition_id = p_competition_id
      and ca.participant_profile_id is not null
      and ca.status in (
        'submitted'::public.attempt_status,
        'auto_submitted'::public.attempt_status,
        'disqualified'::public.attempt_status,
        'graded'::public.attempt_status
      )
  )
  delete from public.leaderboard_entries le
  where le.competition_id = p_competition_id
    and not exists (
      select 1
      from active_score_registrations asr
      where asr.registration_id = le.registration_id
    );

  return query
  select p_competition_id, 'ok'::text, v_refreshed_rows, v_now;
end;
$$;

revoke all on function public.can_actor_use_competition_registration(uuid, uuid) from public;
revoke all on function public.can_actor_use_competition_attempt(uuid, uuid) from public;
grant execute on function public.can_actor_use_competition_registration(uuid, uuid) to service_role;
grant execute on function public.can_actor_use_competition_attempt(uuid, uuid) to service_role;

revoke all on function public.start_competition_attempt(uuid, uuid, text) from public;
revoke all on function public.resume_competition_attempt(uuid, uuid, text) from public;
revoke all on function public.close_active_attempt_interval(uuid, uuid) from public;
revoke all on function public.save_attempt_answer(uuid, uuid, uuid, text, text, public.answer_status_flag, timestamptz) from public;
revoke all on function public.submit_competition_attempt(uuid, uuid, text, text) from public;
revoke all on function public.refresh_leaderboard_entries(uuid) from public;
revoke all on function public.log_tab_switch_offense(uuid, jsonb, uuid) from public;
revoke all on function public.start_competition_attempt(uuid, uuid, text) from anon, authenticated;
revoke all on function public.resume_competition_attempt(uuid, uuid, text) from anon, authenticated;
revoke all on function public.close_active_attempt_interval(uuid, uuid) from anon, authenticated;
revoke all on function public.save_attempt_answer(uuid, uuid, uuid, text, text, public.answer_status_flag, timestamptz) from anon, authenticated;
revoke all on function public.submit_competition_attempt(uuid, uuid, text, text) from anon, authenticated;
revoke all on function public.refresh_leaderboard_entries(uuid) from anon, authenticated;
revoke all on function public.log_tab_switch_offense(uuid, jsonb, uuid) from anon, authenticated;

grant execute on function public.start_competition_attempt(uuid, uuid, text) to service_role;
grant execute on function public.resume_competition_attempt(uuid, uuid, text) to service_role;
grant execute on function public.close_active_attempt_interval(uuid, uuid) to service_role;
grant execute on function public.save_attempt_answer(uuid, uuid, uuid, text, text, public.answer_status_flag, timestamptz) to service_role;
grant execute on function public.submit_competition_attempt(uuid, uuid, text, text) to service_role;
grant execute on function public.refresh_leaderboard_entries(uuid) to service_role;
grant execute on function public.log_tab_switch_offense(uuid, jsonb, uuid) to service_role;

commit;
