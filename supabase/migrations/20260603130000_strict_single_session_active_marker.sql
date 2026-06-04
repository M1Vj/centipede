begin;

alter table public.profiles
  add column if not exists active_session_expires_at timestamptz;

create or replace function public.handle_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_trusted_session_flow boolean :=
    coalesce(current_setting('app.trusted_session_flow', true), '') = 'on';
begin
  new.email := lower(new.email);

  if auth.role() <> 'service_role' then
    if new.email is distinct from old.email then
      raise exception 'Only trusted auth flows may change profile emails.';
    end if;

    if not is_trusted_session_flow
      and (
        new.session_version is distinct from old.session_version
        or new.active_session_expires_at is distinct from old.active_session_expires_at
      ) then
      raise exception 'Only trusted auth flows may update active sessions.';
    end if;
  end if;

  if auth.role() <> 'service_role' and not public.jwt_is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Only admins may change profile roles.';
    end if;

    if new.approved_at is distinct from old.approved_at then
      raise exception 'Only admins may change organizer approval status.';
    end if;

    if new.is_active is distinct from old.is_active then
      raise exception 'Only admins may change activation status.';
    end if;
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create or replace function public.rotate_session_version(profile_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version integer;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from profile_id then
    raise exception 'You may only rotate your own session.';
  end if;

  perform set_config('app.trusted_session_flow', 'on', true);

  update public.profiles
  set session_version = coalesce(session_version, 0) + 1,
      active_session_expires_at = timezone('utc', now()) + interval '30 days',
      updated_at = timezone('utc', now())
  where id = profile_id
  returning session_version into next_version;

  if next_version is null then
    raise exception 'Profile not found.';
  end if;

  return next_version;
end;
$$;

create or replace function public.clear_active_session(
  profile_id uuid,
  current_session_version integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  cleared_profile_id uuid;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from profile_id then
    raise exception 'You may only clear your own active session.';
  end if;

  perform set_config('app.trusted_session_flow', 'on', true);

  update public.profiles
  set active_session_expires_at = null,
      updated_at = timezone('utc', now())
  where id = profile_id
    and session_version = current_session_version
  returning id into cleared_profile_id;

  return cleared_profile_id is not null;
end;
$$;

revoke all on function public.clear_active_session(uuid, integer) from public;
grant execute on function public.clear_active_session(uuid, integer) to authenticated;
grant execute on function public.clear_active_session(uuid, integer) to service_role;

commit;
