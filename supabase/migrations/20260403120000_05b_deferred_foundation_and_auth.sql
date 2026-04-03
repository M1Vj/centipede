begin;

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists session_version integer not null default 1;

alter table public.organizer_applications
  alter column profile_id drop not null;

alter table public.organizer_applications
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists organization_type text,
  add column if not exists legal_consent_at timestamptz,
  add column if not exists status_lookup_token_hash text,
  add column if not exists status_lookup_token_expires_at timestamptz;

create index if not exists organizer_applications_profile_idx
  on public.organizer_applications (profile_id);

create index if not exists organizer_applications_contact_email_idx
  on public.organizer_applications (contact_email);

create unique index if not exists organizer_applications_pending_contact_email_uq
  on public.organizer_applications ((lower(contact_email)))
  where status = 'pending';

drop policy if exists "organizer_applications_insert_self" on public.organizer_applications;

create policy "organizer_applications_insert_self"
on public.organizer_applications
for insert
with check (
  (
    auth.role() = 'anon'
    and profile_id is null
  )
  or auth.uid() = profile_id
  or public.jwt_is_admin()
);

grant insert on public.organizer_applications to anon;

create or replace function public.handle_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.email := lower(new.email);

  if auth.role() <> 'service_role' then
    if new.email is distinct from old.email then
      raise exception 'Only trusted auth flows may change profile emails.';
    end if;

    if new.session_version is distinct from old.session_version then
      raise exception 'Only trusted auth flows may rotate session version.';
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

  update public.profiles
  set session_version = coalesce(session_version, 0) + 1,
      updated_at = timezone('utc', now())
  where id = profile_id
  returning session_version into next_version;

  if next_version is null then
    raise exception 'Profile not found.';
  end if;

  return next_version;
end;
$$;

create or replace function public.update_mathlete_profile_settings(
  profile_id uuid,
  next_school text,
  next_grade_level text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles%rowtype;
begin
  if auth.role() <> 'service_role' and auth.uid() is distinct from profile_id then
    raise exception 'You may only update your own mathlete settings.';
  end if;

  update public.profiles
  set school = nullif(btrim(next_school), ''),
      grade_level = nullif(btrim(next_grade_level), ''),
      updated_at = timezone('utc', now())
  where id = profile_id
    and role = 'mathlete'
  returning * into updated_profile;

  if not found then
    raise exception 'Mathlete profile not found.';
  end if;

  return updated_profile;
end;
$$;

create or replace function public.anonymize_user_account(
  target_profile_id uuid,
  reason text,
  request_idempotency_token text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_profile public.profiles%rowtype;
  anonymized_email text;
  normalized_reason text := btrim(reason);
  normalized_token text := btrim(request_idempotency_token);
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only trusted admin flows may anonymize accounts.';
  end if;

  if normalized_reason = '' then
    raise exception 'Anonymization reason is required.';
  end if;

  if normalized_token = '' then
    raise exception 'Anonymization idempotency token is required.';
  end if;

  select *
  into existing_profile
  from public.profiles
  where id = target_profile_id
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  anonymized_email := 'deleted+'
    || substr(
      encode(digest(target_profile_id::text || ':centipede', 'sha256'), 'hex'),
      1,
      24
    )
    || '@anon.invalid';

  if existing_profile.email = anonymized_email
    and existing_profile.full_name = 'Deleted User'
    and existing_profile.school is null
    and existing_profile.grade_level is null
    and existing_profile.organization is null
    and existing_profile.avatar_url is null
    and existing_profile.is_active = false then
    return existing_profile;
  end if;

  update public.profiles
  set email = anonymized_email,
      full_name = 'Deleted User',
      school = null,
      grade_level = null,
      organization = null,
      avatar_url = null,
      is_active = false,
      updated_at = timezone('utc', now())
  where id = target_profile_id
  returning * into existing_profile;

  return existing_profile;
end;
$$;

revoke all on function public.rotate_session_version(uuid) from public;
revoke all on function public.update_mathlete_profile_settings(uuid, text, text) from public;
revoke all on function public.anonymize_user_account(uuid, text, text) from public;

grant execute on function public.rotate_session_version(uuid) to authenticated;
grant execute on function public.update_mathlete_profile_settings(uuid, text, text) to authenticated;
grant execute on function public.rotate_session_version(uuid) to service_role;
grant execute on function public.update_mathlete_profile_settings(uuid, text, text) to service_role;
grant execute on function public.anonymize_user_account(uuid, text, text) to service_role;

commit;
