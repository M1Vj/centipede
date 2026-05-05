-- ============================================================================
-- Verification: team registration RPCs must not retain team_id ambiguity
-- ============================================================================

do $$
begin
  if pg_get_functiondef('public.validate_team_registration(uuid, uuid)'::regprocedure)
     like '%where team_id = p_team_id%' then
    raise exception 'validate_team_registration still has an unqualified team_id predicate';
  end if;

  if pg_get_functiondef('public.validate_team_registration(uuid, uuid)'::regprocedure)
     not like '%where tm.team_id = p_team_id%' then
    raise exception 'validate_team_registration missing qualified team_memberships predicate';
  end if;

  if pg_get_functiondef('public.register_for_competition(uuid, uuid, text)'::regprocedure)
     not like '%v_existing_registration := found%' then
    raise exception 'register_for_competition missing preserved FOUND state';
  end if;
end
$$;
