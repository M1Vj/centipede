begin;

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

  if v_registration.profile_id is not null and v_registration.profile_id <> v_caller_id then
    raise exception 'forbidden';
  elsif v_registration.team_id is not null and not public.is_active_team_member(v_registration.team_id, v_caller_id) then
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

create or replace function public.log_tab_switch_offense(
  p_attempt_id uuid,
  p_metadata_json jsonb
)
returns text
language sql
security definer
set search_path = public
as $$
  select public.log_tab_switch_offense(p_attempt_id, p_metadata_json, auth.uid());
$$;

revoke all on function public.log_tab_switch_offense(uuid, jsonb, uuid) from public;
revoke all on function public.log_tab_switch_offense(uuid, jsonb, uuid) from anon, authenticated;
grant execute on function public.log_tab_switch_offense(uuid, jsonb, uuid) to service_role;

grant execute on function public.log_tab_switch_offense(uuid, jsonb) to authenticated;

commit;
