-- Align trusted answer-key RPC visibility with scheduled vs. open competition rules.

create or replace function public.can_view_answer_key(
  p_competition_id uuid,
  p_viewer_profile_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_competition public.competitions%rowtype;
  v_has_participant_context boolean := false;
  v_latest_attempt record;
begin
  if auth.role() <> 'service_role' then
    return false;
  end if;

  if p_competition_id is null or p_viewer_profile_id is null then
    return false;
  end if;

  select *
  into v_competition
  from public.competitions c
  where c.id = p_competition_id;

  if not found or v_competition.answer_key_visibility = 'hidden'::public.answer_key_visibility then
    return false;
  end if;

  select exists (
    select 1
    from public.competition_registrations cr
    where cr.competition_id = p_competition_id
      and cr.status = 'registered'::public.registration_status
      and (
        cr.profile_id = p_viewer_profile_id
        or (
          cr.team_id is not null
          and public.is_active_team_member(cr.team_id, p_viewer_profile_id)
        )
      )
  )
  or exists (
    select 1
    from public.competition_attempts ca
    join public.competition_registrations cr on cr.id = ca.registration_id
    where ca.competition_id = p_competition_id
      and (
        cr.profile_id = p_viewer_profile_id
        or (
          cr.team_id is not null
          and public.is_active_team_member(cr.team_id, p_viewer_profile_id)
        )
      )
  )
  into v_has_participant_context;

  if not v_has_participant_context then
    return false;
  end if;

  if v_competition.type = 'open'::public.competition_type then
    select ca.attempt_no, ca.status
    into v_latest_attempt
    from public.competition_attempts ca
    join public.competition_registrations cr on cr.id = ca.registration_id
    where ca.competition_id = p_competition_id
      and ca.participant_profile_id = p_viewer_profile_id
      and (
        cr.profile_id = p_viewer_profile_id
        or (
          cr.team_id is not null
          and public.is_active_team_member(cr.team_id, p_viewer_profile_id)
        )
      )
    order by ca.attempt_no desc
    limit 1;

    if not found or v_latest_attempt.status = 'in_progress'::public.attempt_status then
      return false;
    end if;

    return v_latest_attempt.attempt_no >= greatest(coalesce(v_competition.attempts_allowed, 1), 1);
  end if;

  if v_competition.status in ('draft'::public.competition_status, 'published'::public.competition_status) then
    return false;
  end if;

  if v_competition.end_time is not null then
    if now() < v_competition.end_time then
      return false;
    end if;

    return true;
  end if;

  return v_competition.status in ('ended'::public.competition_status, 'archived'::public.competition_status);
end;
$$;

grant execute on function public.can_view_answer_key(uuid, uuid) to service_role;
