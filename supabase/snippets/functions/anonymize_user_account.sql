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
      encode(extensions.digest(target_profile_id::text || ':centipede', 'sha256'), 'hex'),
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

revoke all on function public.anonymize_user_account(uuid, text, text) from public;
grant execute on function public.anonymize_user_account(uuid, text, text) to service_role;
