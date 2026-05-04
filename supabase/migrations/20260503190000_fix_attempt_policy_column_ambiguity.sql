drop policy if exists "attempt_intervals_select_participant" on public.attempt_intervals;
create policy "attempt_intervals_select_participant"
on public.attempt_intervals
for select
using (
  public.jwt_is_admin()
  or exists (
    select 1
    from public.competition_attempts ca
    join public.competition_registrations cr on cr.id = ca.registration_id
    where ca.id = public.attempt_intervals.attempt_id
      and (
        cr.profile_id = auth.uid()
        or (cr.team_id is not null and public.is_active_team_member(cr.team_id, auth.uid()))
      )
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
    join public.competition_registrations cr on cr.id = ca.registration_id
    where ca.id = public.attempt_answers.attempt_id
      and (
        cr.profile_id = auth.uid()
        or (cr.team_id is not null and public.is_active_team_member(cr.team_id, auth.uid()))
      )
  )
  or exists (
    select 1
    from public.competition_attempts ca
    join public.competitions c on c.id = ca.competition_id
    where ca.id = public.attempt_answers.attempt_id
      and c.organizer_id = auth.uid()
  )
);

drop policy if exists "tab_switch_logs_select_organizer" on public.tab_switch_logs;
create policy "tab_switch_logs_select_organizer"
on public.tab_switch_logs
for select
using (
  public.jwt_is_admin()
  or exists (
    select 1
    from public.competition_attempts ca
    join public.competitions c on c.id = ca.competition_id
    where ca.id = public.tab_switch_logs.attempt_id
      and c.organizer_id = auth.uid()
  )
);

drop policy if exists "tab_switch_logs_select_participant" on public.tab_switch_logs;
create policy "tab_switch_logs_select_participant"
on public.tab_switch_logs
for select
using (
  exists (
    select 1
    from public.competition_attempts ca
    join public.competition_registrations cr on cr.id = ca.registration_id
    where ca.id = public.tab_switch_logs.attempt_id
      and (
        cr.profile_id = auth.uid()
        or (cr.team_id is not null and public.is_active_team_member(cr.team_id, auth.uid()))
      )
  )
);
