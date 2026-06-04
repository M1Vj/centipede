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
#variable_conflict use_column
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
              when jsonb_typeof(coalesce(cp.answer_key_snapshot_json, '{}'::jsonb) -> 'accepted_answers') = 'array'
                then coalesce(cp.answer_key_snapshot_json, '{}'::jsonb) -> 'accepted_answers'
              else '[]'::jsonb
            end
          )
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
          select jsonb_array_elements_text(
            case
              when jsonb_typeof(coalesce(cp.answer_key_snapshot_json, '{}'::jsonb) -> 'correct_option_ids') = 'array'
                then coalesce(cp.answer_key_snapshot_json, '{}'::jsonb) -> 'correct_option_ids'
              else '[]'::jsonb
            end
          )
          union all
          select coalesce(cp.answer_key_snapshot_json, '{}'::jsonb) ->> 'acceptedAnswer'
          union all
          select coalesce(cp.answer_key_snapshot_json, '{}'::jsonb) ->> 'accepted_answer'
          union all
          select coalesce(cp.answer_key_snapshot_json, '{}'::jsonb) ->> 'accepted'
          union all
          select coalesce(cp.answer_key_snapshot_json, '{}'::jsonb) ->> 'correctAnswer'
          union all
          select coalesce(cp.answer_key_snapshot_json, '{}'::jsonb) ->> 'correct_answer'
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
          select coalesce(cp.answer_key_snapshot_json, '{}'::jsonb) ->> 'answer_latex'
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
#variable_conflict use_column
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

revoke all on function public.grade_attempt(uuid) from public;
revoke all on function public.refresh_leaderboard_entries(uuid) from public;
revoke all on function public.grade_attempt(uuid) from anon, authenticated;
revoke all on function public.refresh_leaderboard_entries(uuid) from anon, authenticated;
grant execute on function public.grade_attempt(uuid) to service_role;
grant execute on function public.refresh_leaderboard_entries(uuid) to service_role;

commit;
