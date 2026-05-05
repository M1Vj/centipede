-- ============================================================================
-- Hardening: qualify team membership helper and RLS policy references
-- ============================================================================

create or replace function public.is_active_team_member(
  p_team_id uuid,
  p_profile_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.team_memberships tm
    where tm.team_id = p_team_id
      and tm.profile_id = p_profile_id
      and tm.is_active = true
  );
$$;

drop policy if exists "teams_select_members" on public.teams;
create policy "teams_select_members"
on public.teams
for select
using (
  public.jwt_is_admin()
  or public.is_active_team_member(teams.id, auth.uid())
);

drop policy if exists "team_memberships_select_members" on public.team_memberships;
create policy "team_memberships_select_members"
on public.team_memberships
for select
using (
  public.jwt_is_admin()
  or public.is_active_team_member(team_memberships.team_id, auth.uid())
);

drop policy if exists "competition_registrations_select_owner" on public.competition_registrations;
create policy "competition_registrations_select_owner"
on public.competition_registrations
for select
using (
  public.jwt_is_admin()
  or competition_registrations.profile_id = auth.uid()
  or public.is_active_team_member(competition_registrations.team_id, auth.uid())
  or exists (
    select 1
    from public.competitions c
    where c.id = competition_registrations.competition_id
      and c.organizer_id = auth.uid()
  )
);
