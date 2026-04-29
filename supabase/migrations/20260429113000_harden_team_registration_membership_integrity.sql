-- ============================================================================
-- Hardening: prevent roster mutation while a team registration is active
-- ============================================================================

create or replace function public.team_has_active_competition_registration(
  p_team_id uuid
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
    join public.competitions c on c.id = cr.competition_id
    where cr.team_id = p_team_id
      and cr.status = 'registered'::public.registration_status
      and c.format = 'team'::public.competition_format
      and c.type = 'scheduled'::public.competition_type
      and c.is_deleted = false
      and c.status in (
        'published'::public.competition_status,
        'live'::public.competition_status,
        'paused'::public.competition_status
      )
  );
$$;

create or replace function public.prevent_active_registration_roster_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
before update or delete on public.team_memberships
for each row
execute function public.prevent_active_registration_roster_mutation();
