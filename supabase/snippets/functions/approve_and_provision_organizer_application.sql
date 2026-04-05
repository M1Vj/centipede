create or replace function public.approve_and_provision_organizer_application(
  p_application_id uuid,
  p_profile_id uuid default null
)
returns table (
  machine_code text,
  application_id uuid,
  resolved_profile_id uuid,
  activated boolean
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_application public.organizer_applications%rowtype;
  v_profile_id uuid;
  v_profile_email text;
begin
  perform pg_advisory_xact_lock(hashtext('organizer-approve-provision:' || p_application_id::text));

  select *
  into v_application
  from public.organizer_applications
  where id = p_application_id
  for update;

  if not found then
    return query
      select 'not_found', p_application_id, null::uuid, false;
    return;
  end if;

  if v_application.status = 'rejected' then
    return query
      select 'not_pending', v_application.id, v_application.profile_id, false;
    return;
  end if;

  v_profile_id := coalesce(v_application.profile_id, p_profile_id);

  if v_profile_id is null then
    return query
      select 'profile_required', v_application.id, null::uuid, false;
    return;
  end if;

  select email
  into v_profile_email
  from public.profiles
  where id = v_profile_id
  for update;

  if not found then
    return query
      select 'profile_not_found', v_application.id, v_profile_id, false;
    return;
  end if;

  if v_application.contact_email is not null
    and lower(v_profile_email) <> lower(v_application.contact_email) then
    return query
      select 'profile_email_mismatch', v_application.id, v_profile_id, false;
    return;
  end if;

  if v_application.status = 'pending' then
    update public.organizer_applications
    set status = 'approved',
        reviewed_at = coalesce(reviewed_at, timezone('utc', now()))
    where id = v_application.id;
  end if;

  if v_application.profile_id is null then
    update public.organizer_applications as organizer_applications
    set profile_id = v_profile_id
    where organizer_applications.id = v_application.id
      and organizer_applications.profile_id is null;
  end if;

  update public.profiles
  set role = 'organizer',
      approved_at = coalesce(approved_at, timezone('utc', now())),
      full_name = case
        when nullif(btrim(full_name), '') is null and nullif(btrim(v_application.applicant_full_name), '') is not null
          then btrim(v_application.applicant_full_name)
        else full_name
      end,
      organization = case
        when nullif(btrim(organization), '') is null and nullif(btrim(v_application.organization_name), '') is not null
          then btrim(v_application.organization_name)
        else organization
      end,
      updated_at = timezone('utc', now())
  where id = v_profile_id;

  return query
    select 'ok', v_application.id, v_profile_id, true;
end;
$$;

revoke all on function public.approve_and_provision_organizer_application(uuid, uuid)
  from public;

grant execute on function public.approve_and_provision_organizer_application(uuid, uuid)
  to service_role;
