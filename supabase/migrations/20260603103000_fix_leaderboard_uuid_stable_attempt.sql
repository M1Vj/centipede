begin;

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
      (array_agg(oma.id order by oma.id asc))[1] as stable_attempt_id
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

revoke all on function public.refresh_leaderboard_entries(uuid) from public;
revoke all on function public.refresh_leaderboard_entries(uuid) from anon, authenticated;
grant execute on function public.refresh_leaderboard_entries(uuid) to service_role;

commit;
