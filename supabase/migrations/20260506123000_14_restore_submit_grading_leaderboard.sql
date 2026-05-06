begin;

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
declare
  v_attempt public.competition_attempts%rowtype;
  v_now timestamptz := now();
  v_raw_score numeric := 0;
  v_penalty_score numeric := 0;
  v_final_score numeric := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only trusted backend grading flows may execute grade_attempt.';
  end if;

  if p_attempt_id is null then
    raise exception 'attempt_id is required.';
  end if;

  select *
  into v_attempt
  from public.competition_attempts ca
  where ca.id = p_attempt_id
  for update;

  if not found then
    return query
    select p_attempt_id, null::uuid, 'attempt_not_found'::text, 0::numeric, 0::numeric, 0::numeric, v_now;
    return;
  end if;

  with answer_scores as (
    select
      aa.id as answer_id,
      cp.points,
      exists (
        select 1
        from (
          select jsonb_array_elements_text(
            case
              when jsonb_typeof(coalesce(cp.answer_key_snapshot_json, '{}'::jsonb) -> 'acceptedAnswers') = 'array'
                then coalesce(cp.answer_key_snapshot_json, '{}'::jsonb) -> 'acceptedAnswers'
              else '[]'::jsonb
            end
          ) as accepted_answer
          union all
          select jsonb_array_elements_text(
            case
              when jsonb_typeof(coalesce(cp.answer_key_snapshot_json, '{}'::jsonb) -> 'answers') = 'array'
                then coalesce(cp.answer_key_snapshot_json, '{}'::jsonb) -> 'answers'
              else '[]'::jsonb
            end
          )
          union all
          select jsonb_array_elements_text(
            case
              when jsonb_typeof(coalesce(cp.answer_key_snapshot_json, '{}'::jsonb) -> 'correctOptionIds') = 'array'
                then coalesce(cp.answer_key_snapshot_json, '{}'::jsonb) -> 'correctOptionIds'
              else '[]'::jsonb
            end
          )
          union all
          select coalesce(cp.answer_key_snapshot_json, '{}'::jsonb) ->> 'correctAnswer'
          union all
          select coalesce(cp.answer_key_snapshot_json, '{}'::jsonb) ->> 'answer'
          union all
          select coalesce(cp.answer_key_snapshot_json, '{}'::jsonb) ->> 'value'
          union all
          select coalesce(cp.answer_key_snapshot_json, '{}'::jsonb) ->> 'text'
          union all
          select coalesce(cp.answer_key_snapshot_json, '{}'::jsonb) ->> 'latex'
          union all
          select coalesce(cp.answer_key_snapshot_json, '{}'::jsonb) ->> 'answerLatex'
          union all
          select jsonb_array_elements_text(
            case
              when jsonb_typeof(coalesce(cp.answer_key_snapshot_json, '[]'::jsonb)) = 'array'
                then coalesce(cp.answer_key_snapshot_json, '[]'::jsonb)
              else '[]'::jsonb
            end
          )
          union all
          select regexp_split_to_table(cp.answer_key_snapshot_json #>> '{}', '\|')
          where jsonb_typeof(coalesce(cp.answer_key_snapshot_json, 'null'::jsonb)) = 'string'
        ) accepted
        cross join lateral (
          select lower(btrim(coalesce(nullif(aa.answer_text_normalized, ''), aa.answer_latex, ''))) as actual_value,
                 lower(btrim(coalesce(accepted.accepted_answer, ''))) as expected_value
        ) normalized
        where normalized.actual_value <> ''
          and normalized.expected_value <> ''
          and (
            normalized.actual_value = normalized.expected_value
            or (
              normalized.actual_value ~ '^-?[0-9]+(\.[0-9]+)?$'
              and normalized.expected_value ~ '^-?[0-9]+(\.[0-9]+)?$'
              and normalized.actual_value::numeric = normalized.expected_value::numeric
            )
          )
      ) as is_correct
    from public.attempt_answers aa
    join public.competition_problems cp on cp.id = aa.competition_problem_id
    where aa.attempt_id = p_attempt_id
  ), updated_answers as (
    update public.attempt_answers aa
    set is_correct = answer_scores.is_correct,
        points_awarded = case when answer_scores.is_correct then coalesce(answer_scores.points, 0) else 0 end
    from answer_scores
    where aa.id = answer_scores.answer_id
    returning aa.points_awarded
  )
  select coalesce(sum(points_awarded), 0)
  into v_raw_score
  from updated_answers;

  v_penalty_score := coalesce(v_attempt.penalty_score, 0);
  v_final_score := v_raw_score - v_penalty_score;

  update public.competition_attempts ca
  set status = 'graded'::public.attempt_status,
      raw_score = v_raw_score,
      penalty_score = v_penalty_score,
      final_score = v_final_score,
      graded_at = v_now,
      grade_summary_json = jsonb_build_object(
        'raw_score', v_raw_score,
        'penalty_score', v_penalty_score,
        'final_score', v_final_score,
        'graded_at', v_now
      )
  where ca.id = p_attempt_id
  returning * into v_attempt;

  return query
  select
    v_attempt.id,
    v_attempt.competition_id,
    'ok'::text,
    v_raw_score,
    v_penalty_score,
    v_final_score,
    v_now;
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

  with ranked_attempts as (
    select
      ca.competition_id,
      ca.registration_id,
      ca.id as attempt_id,
      row_number() over (
        partition by ca.competition_id
        order by
          coalesce(ca.final_score, 0) desc,
          coalesce(ca.total_time_seconds, 2147483647) asc,
          coalesce(ca.submitted_at, ca.started_at, now()) asc,
          ca.id asc
      ) as leaderboard_rank,
      coalesce(ca.final_score, 0) as score,
      coalesce(ca.total_time_seconds, 0) as total_time_seconds,
      coalesce(ca.offense_count, 0) as offense_count
    from public.competition_attempts ca
    where ca.competition_id = p_competition_id
      and ca.status in (
        'submitted'::public.attempt_status,
        'auto_submitted'::public.attempt_status,
        'disqualified'::public.attempt_status,
        'graded'::public.attempt_status
      )
      and coalesce(ca.is_latest_visible_result, true) = true
  ), source_rows as (
    select
      ra.competition_id,
      ra.registration_id,
      ra.attempt_id,
      ra.leaderboard_rank as rank,
      coalesce(
        nullif(btrim(cr.entry_snapshot_json ->> 'display_name'), ''),
        nullif(btrim(cr.entry_snapshot_json ->> 'team_name'), ''),
        nullif(btrim(cr.entry_snapshot_json ->> 'full_name'), ''),
        nullif(btrim(t.name), ''),
        nullif(btrim(p.full_name), ''),
        'Participant'
      ) as display_name,
      ra.score,
      ra.total_time_seconds,
      ra.offense_count,
      case
        when v_competition.type = 'open'::public.competition_type
             and v_competition.status <> 'draft'::public.competition_status
          then true
        else coalesce(v_competition.leaderboard_published, false)
      end as published_visibility,
      v_now as computed_at
    from ranked_attempts ra
    join public.competition_registrations cr on cr.id = ra.registration_id
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

  delete from public.leaderboard_entries le
  where le.competition_id = p_competition_id
    and not exists (
      select 1
      from public.competition_attempts ca
      where ca.id = le.attempt_id
        and ca.competition_id = p_competition_id
        and ca.status in (
          'submitted'::public.attempt_status,
          'auto_submitted'::public.attempt_status,
          'disqualified'::public.attempt_status,
          'graded'::public.attempt_status
        )
    );

  return query
  select p_competition_id, 'ok'::text, v_refreshed_rows, v_now;
end;
$$;

create or replace function public.recalculate_competition_scores(
  p_competition_id uuid,
  p_request_idempotency_token text
)
returns table (
  competition_id uuid,
  request_idempotency_token text,
  machine_code text,
  graded_attempts bigint,
  refreshed_rows bigint,
  recalculated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_attempt_id uuid;
  v_graded_attempts bigint := 0;
  v_refreshed_rows bigint := 0;
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only trusted backend recalculation flows may execute recalculate_competition_scores.';
  end if;

  if p_competition_id is null then
    raise exception 'competition_id is required.';
  end if;

  v_token := btrim(coalesce(p_request_idempotency_token, ''));
  if v_token = '' then
    raise exception 'request_idempotency_token is required.';
  end if;

  for v_attempt_id in
    select ca.id
    from public.competition_attempts ca
    where ca.competition_id = p_competition_id
      and ca.status in (
        'submitted'::public.attempt_status,
        'auto_submitted'::public.attempt_status,
        'disqualified'::public.attempt_status,
        'graded'::public.attempt_status
      )
  loop
    perform public.grade_attempt(v_attempt_id);
    v_graded_attempts := v_graded_attempts + 1;
  end loop;

  select rle.refreshed_rows
  into v_refreshed_rows
  from public.refresh_leaderboard_entries(p_competition_id) rle;

  return query
  select
    p_competition_id,
    v_token,
    'ok'::text,
    v_graded_attempts,
    coalesce(v_refreshed_rows, 0),
    v_now;
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

  if v_attempt.status in ('submitted'::public.attempt_status, 'auto_submitted'::public.attempt_status) then
    perform public.grade_attempt(p_attempt_id);
    select * into v_attempt from public.competition_attempts ca where ca.id = p_attempt_id;
  elsif v_attempt.status = 'graded'::public.attempt_status then
    perform public.refresh_leaderboard_entries(v_attempt.competition_id);
    return query
      select 'ok'::text, p_attempt_id, v_attempt.status, v_attempt.submitted_at, true;
    return;
  elsif v_attempt.status <> 'in_progress'::public.attempt_status then
    return query
      select 'attempt_not_in_progress'::text, p_attempt_id, v_attempt.status, null::timestamptz, false;
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

  perform public.refresh_leaderboard_entries(v_attempt.competition_id);

  return query
    select 'ok'::text, p_attempt_id, v_attempt.status, v_attempt.submitted_at, v_attempt.status <> 'graded'::public.attempt_status;
end;
$$;

revoke all on function public.grade_attempt(uuid) from public;
revoke all on function public.recalculate_competition_scores(uuid, text) from public;
revoke all on function public.refresh_leaderboard_entries(uuid) from public;
revoke all on function public.submit_competition_attempt(uuid, uuid, text, text) from public;
revoke all on function public.grade_attempt(uuid) from anon, authenticated;
revoke all on function public.recalculate_competition_scores(uuid, text) from anon, authenticated;
revoke all on function public.refresh_leaderboard_entries(uuid) from anon, authenticated;
revoke all on function public.submit_competition_attempt(uuid, uuid, text, text) from anon, authenticated;

grant execute on function public.grade_attempt(uuid) to service_role;
grant execute on function public.recalculate_competition_scores(uuid, text) to service_role;
grant execute on function public.refresh_leaderboard_entries(uuid) to service_role;
grant execute on function public.submit_competition_attempt(uuid, uuid, text, text) to service_role;

commit;
