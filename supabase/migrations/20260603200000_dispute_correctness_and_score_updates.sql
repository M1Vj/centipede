begin;

create or replace function public.create_problem_dispute(
  p_competition_id uuid,
  p_competition_problem_id uuid,
  p_attempt_id uuid,
  p_reporter_id uuid,
  p_reason text
)
returns table (
  machine_code text,
  dispute_id uuid,
  status public.dispute_status,
  replayed boolean
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_competition public.competitions%rowtype;
  v_reason text := btrim(regexp_replace(coalesce(p_reason, ''), '\s+', ' ', 'g'));
  v_existing public.problem_disputes%rowtype;
  v_inserted public.problem_disputes%rowtype;
  dispute_spam_window interval := interval '1 minute';
begin
  if auth.role() <> 'service_role' then
    return query select 'forbidden'::text, null::uuid, null::public.dispute_status, false;
    return;
  end if;

  if p_competition_id is null or p_competition_problem_id is null or p_attempt_id is null or p_reporter_id is null then
    return query select 'target_required'::text, null::uuid, null::public.dispute_status, false;
    return;
  end if;

  if char_length(v_reason) < 10 or char_length(v_reason) > 1000 then
    return query select 'invalid_reason'::text, null::uuid, null::public.dispute_status, false;
    return;
  end if;

  select *
  into v_competition
  from public.competitions c
  where c.id = p_competition_id;

  if not found then
    return query select 'competition_not_found'::text, null::uuid, null::public.dispute_status, false;
    return;
  end if;

  if v_competition.status not in ('ended'::public.competition_status, 'archived'::public.competition_status)
    and not (
      v_competition.type = 'open'::public.competition_type
      and exists (
        select 1
        from public.competition_attempts ca
        where ca.id = p_attempt_id
          and ca.competition_id = p_competition_id
          and ca.attempt_no >= greatest(1, v_competition.attempts_allowed)
          and ca.status in (
            'submitted'::public.attempt_status,
            'auto_submitted'::public.attempt_status,
            'graded'::public.attempt_status
          )
      )
    ) then
    return query select 'competition_not_ended'::text, null::uuid, null::public.dispute_status, false;
    return;
  end if;

  if not exists (
    select 1
    from public.competition_problems cp
    join public.competition_attempts ca on ca.competition_id = cp.competition_id
    join public.competition_registrations cr on cr.id = ca.registration_id
    where cp.id = p_competition_problem_id
      and cp.competition_id = p_competition_id
      and ca.id = p_attempt_id
      and (
        cr.profile_id = p_reporter_id
        or (
          cr.team_id is not null
          and public.is_active_team_member(cr.team_id, p_reporter_id)
        )
      )
  ) then
    return query select 'forbidden'::text, null::uuid, null::public.dispute_status, false;
    return;
  end if;

  if exists (
    select 1
    from public.attempt_answers aa
    where aa.attempt_id = p_attempt_id
      and aa.competition_problem_id = p_competition_problem_id
      and aa.is_correct = true
  ) then
    return query select 'answer_already_correct'::text, null::uuid, null::public.dispute_status, false;
    return;
  end if;

  select *
  into v_existing
  from public.problem_disputes pd
  where pd.competition_problem_id = p_competition_problem_id
    and pd.attempt_id = p_attempt_id
    and pd.reporter_id = p_reporter_id
    and pd.status in ('open'::public.dispute_status, 'reviewing'::public.dispute_status)
  order by pd.created_at desc
  limit 1;

  if found then
    return query select 'already_open'::text, v_existing.id, v_existing.status, true;
    return;
  end if;

  if exists (
    select 1
    from public.problem_disputes pd
    where pd.reporter_id = p_reporter_id
      and pd.attempt_id = p_attempt_id
      and pd.competition_problem_id = p_competition_problem_id
      and pd.created_at > now() - dispute_spam_window
  ) then
    return query select 'dispute_rate_limited'::text, null::uuid, null::public.dispute_status, false;
    return;
  end if;

  insert into public.problem_disputes (
    competition_id,
    competition_problem_id,
    attempt_id,
    reporter_id,
    reason,
    status
  )
  values (
    p_competition_id,
    p_competition_problem_id,
    p_attempt_id,
    p_reporter_id,
    v_reason,
    'open'::public.dispute_status
  )
  returning * into v_inserted;

  return query select 'ok'::text, v_inserted.id, v_inserted.status, false;
end;
$$;

create or replace function public.apply_accepted_problem_dispute_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points numeric := 0;
  v_raw_score numeric := 0;
  v_penalty_score numeric := 0;
begin
  if new.status <> 'accepted'::public.dispute_status then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'accepted'::public.dispute_status then
    return new;
  end if;

  select coalesce(cp.points, 0)
  into v_points
  from public.competition_problems cp
  where cp.id = new.competition_problem_id;

  insert into public.attempt_answers (
    attempt_id,
    competition_problem_id,
    status_flag,
    is_correct,
    points_awarded
  )
  values (
    new.attempt_id,
    new.competition_problem_id,
    'filled'::public.answer_status_flag,
    true,
    v_points
  )
  on conflict on constraint attempt_answers_attempt_problem_uq
  do update
  set is_correct = true,
      points_awarded = excluded.points_awarded;

  select coalesce(sum(coalesce(aa.points_awarded, 0)), 0)
  into v_raw_score
  from public.attempt_answers aa
  where aa.attempt_id = new.attempt_id;

  select coalesce(ca.penalty_score, 0)
  into v_penalty_score
  from public.competition_attempts ca
  where ca.id = new.attempt_id;

  update public.competition_attempts ca
  set raw_score = v_raw_score,
      final_score = v_raw_score - v_penalty_score,
      graded_at = coalesce(ca.graded_at, now()),
      grade_summary_json = coalesce(ca.grade_summary_json, '{}'::jsonb) || jsonb_build_object(
        'raw_score', v_raw_score,
        'penalty_score', v_penalty_score,
        'final_score', v_raw_score - v_penalty_score,
        'accepted_dispute_id', new.id,
        'updated_at', now()
      )
  where ca.id = new.attempt_id;

  return new;
end;
$$;

drop trigger if exists problem_disputes_apply_accepted_score on public.problem_disputes;
create trigger problem_disputes_apply_accepted_score
after insert or update of status on public.problem_disputes
for each row
when (new.status = 'accepted'::public.dispute_status)
execute function public.apply_accepted_problem_dispute_score();

revoke all on function public.create_problem_dispute(uuid, uuid, uuid, uuid, text) from public;
revoke all on function public.apply_accepted_problem_dispute_score() from public;
grant execute on function public.create_problem_dispute(uuid, uuid, uuid, uuid, text) to service_role;

commit;
