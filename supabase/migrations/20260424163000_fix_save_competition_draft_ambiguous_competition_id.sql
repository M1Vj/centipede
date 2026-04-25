-- ============================================================================
-- Forward fix: qualify competition_problems references inside save_competition_draft
-- ============================================================================

create or replace function public.save_competition_draft(
  p_competition_id uuid,
  p_expected_draft_revision integer,
  p_payload_json jsonb
)
returns table (
  machine_code text,
  competition_id uuid,
  status public.competition_status,
  draft_revision integer,
  draft_version integer,
  selected_problem_count bigint,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_competition public.competitions%rowtype;
  v_payload jsonb := coalesce(p_payload_json, '{}'::jsonb);
  v_now timestamptz := timezone('utc', now());
  v_selected_problem_count bigint := 0;
  v_selected_ids jsonb;
begin
  if auth.role() <> 'service_role' then
    return query
      select 'forbidden', p_competition_id, null::public.competition_status, null::integer, null::integer, 0::bigint, null::timestamptz;
    return;
  end if;

  if p_competition_id is null then
    return query
      select 'competition_id_required', null::uuid, null::public.competition_status, null::integer, null::integer, 0::bigint, null::timestamptz;
    return;
  end if;

  if p_expected_draft_revision is null or p_expected_draft_revision < 1 then
    return query
      select 'draft_revision_required', p_competition_id, null::public.competition_status, null::integer, null::integer, 0::bigint, null::timestamptz;
    return;
  end if;

  select *
  into v_competition
  from public.competitions
  where id = p_competition_id
  for update;

  if not found then
    return query
      select 'not_found', p_competition_id, null::public.competition_status, null::integer, null::integer, 0::bigint, null::timestamptz;
    return;
  end if;

  if v_competition.is_deleted then
    return query
      select 'deleted', p_competition_id, v_competition.status, v_competition.draft_revision, v_competition.draft_version, 0::bigint, v_competition.updated_at;
    return;
  end if;

  if v_competition.status <> 'draft'::public.competition_status then
    return query
      select 'invalid_transition', p_competition_id, v_competition.status, v_competition.draft_revision, v_competition.draft_version, 0::bigint, v_competition.updated_at;
    return;
  end if;

  if coalesce(v_competition.draft_revision, 1) <> p_expected_draft_revision then
    return query
      select 'draft_write_conflict', p_competition_id, v_competition.status, v_competition.draft_revision, v_competition.draft_version, 0::bigint, v_competition.updated_at;
    return;
  end if;

  if v_payload ? 'selectedProblemIds' then
    delete from public.competition_problems cp
    where cp.competition_id = p_competition_id;

    v_selected_ids := case
      when jsonb_typeof(v_payload -> 'selectedProblemIds') = 'array' then v_payload -> 'selectedProblemIds'
      else '[]'::jsonb
    end;

    with selected_problem_ids as (
      select nullif(btrim(value), '') as problem_id, ordinality
      from jsonb_array_elements_text(coalesce(v_selected_ids, '[]'::jsonb)) with ordinality as entries(value, ordinality)
    ),
    deduped_problem_ids as (
      select problem_id, min(ordinality) as ordinality
      from selected_problem_ids
      where problem_id is not null
      group by problem_id
    )
    insert into public.competition_problems (
      competition_id,
      problem_id,
      order_index,
      points
    )
    select
      p_competition_id,
      deduped_problem_ids.problem_id::uuid,
      deduped_problem_ids.ordinality::integer,
      null
    from deduped_problem_ids
    order by deduped_problem_ids.ordinality;

    select count(*)
    into v_selected_problem_count
    from public.competition_problems cp
    where cp.competition_id = p_competition_id;
  else
    select count(*)
    into v_selected_problem_count
    from public.competition_problems cp
    where cp.competition_id = p_competition_id;
  end if;

  update public.competitions
  set name = case when v_payload ? 'name' then nullif(btrim(coalesce(v_payload ->> 'name', name)), '') else name end,
      description = case when v_payload ? 'description' then coalesce(v_payload ->> 'description', description) else description end,
      instructions = case when v_payload ? 'instructions' then coalesce(v_payload ->> 'instructions', instructions) else instructions end,
      type = case when v_payload ? 'type' then (v_payload ->> 'type')::public.competition_type else type end,
      format = case when v_payload ? 'format' then (v_payload ->> 'format')::public.competition_format else format end,
      registration_start = case
        when v_payload ? 'registrationStart' then nullif(v_payload ->> 'registrationStart', '')::timestamptz
        else registration_start
      end,
      registration_end = case
        when v_payload ? 'registrationEnd' then nullif(v_payload ->> 'registrationEnd', '')::timestamptz
        else registration_end
      end,
      start_time = case
        when v_payload ? 'startTime' then nullif(v_payload ->> 'startTime', '')::timestamptz
        else start_time
      end,
      end_time = case
        when v_payload ? 'endTime' then nullif(v_payload ->> 'endTime', '')::timestamptz
        else end_time
      end,
      duration_minutes = case
        when v_payload ? 'durationMinutes' then nullif(v_payload ->> 'durationMinutes', '')::integer
        else duration_minutes
      end,
      attempts_allowed = case
        when v_payload ? 'attemptsAllowed' then nullif(v_payload ->> 'attemptsAllowed', '')::integer
        else attempts_allowed
      end,
      multi_attempt_grading_mode = case
        when v_payload ? 'multiAttemptGradingMode' then (v_payload ->> 'multiAttemptGradingMode')::public.attempt_grading_mode
        else multi_attempt_grading_mode
      end,
      max_participants = case
        when v_payload ? 'maxParticipants' then nullif(v_payload ->> 'maxParticipants', '')::integer
        else max_participants
      end,
      participants_per_team = case
        when v_payload ? 'participantsPerTeam' then nullif(v_payload ->> 'participantsPerTeam', '')::integer
        else participants_per_team
      end,
      max_teams = case
        when v_payload ? 'maxTeams' then nullif(v_payload ->> 'maxTeams', '')::integer
        else max_teams
      end,
      scoring_mode = case
        when v_payload ? 'scoringMode' then (v_payload ->> 'scoringMode')::public.scoring_mode
        else scoring_mode
      end,
      custom_points = case
        when v_payload ? 'customPoints' then coalesce(v_payload -> 'customPoints', '{}'::jsonb)
        else custom_points
      end,
      penalty_mode = case
        when v_payload ? 'penaltyMode' then (v_payload ->> 'penaltyMode')::public.penalty_mode
        else penalty_mode
      end,
      deduction_value = case
        when v_payload ? 'deductionValue' then nullif(v_payload ->> 'deductionValue', '')::integer
        else deduction_value
      end,
      tie_breaker = case
        when v_payload ? 'tieBreaker' then (v_payload ->> 'tieBreaker')::public.tie_breaker
        else tie_breaker
      end,
      shuffle_questions = case
        when v_payload ? 'shuffleQuestions' then coalesce((v_payload ->> 'shuffleQuestions')::boolean, shuffle_questions)
        else shuffle_questions
      end,
      shuffle_options = case
        when v_payload ? 'shuffleOptions' then coalesce((v_payload ->> 'shuffleOptions')::boolean, shuffle_options)
        else shuffle_options
      end,
      log_tab_switch = case
        when v_payload ? 'logTabSwitch' then coalesce((v_payload ->> 'logTabSwitch')::boolean, log_tab_switch)
        else log_tab_switch
      end,
      offense_penalties = case
        when v_payload ? 'offensePenalties' then coalesce(v_payload -> 'offensePenalties', '[]'::jsonb)
        else offense_penalties
      end,
      answer_key_visibility = case
        when v_payload ? 'answerKeyVisibility' then (v_payload ->> 'answerKeyVisibility')::public.answer_key_visibility
        else answer_key_visibility
      end,
      draft_revision = coalesce(v_competition.draft_revision, 1) + 1,
      draft_version = coalesce(v_competition.draft_revision, 1) + 1,
      updated_at = v_now
  where id = p_competition_id;

  select *
  into v_competition
  from public.competitions
  where id = p_competition_id;

  return query
    select
      'ok',
      p_competition_id,
      v_competition.status,
      v_competition.draft_revision,
      v_competition.draft_version,
      v_selected_problem_count,
      v_competition.updated_at;
end;
$$;
