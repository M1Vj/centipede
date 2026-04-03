begin;

alter table public.organizer_applications
  add column if not exists applicant_full_name text,
  add column if not exists organization_name text,
  add column if not exists logo_path text;

update public.organizer_applications as oa
set
  applicant_full_name = coalesce(
    nullif(oa.applicant_full_name, ''),
    nullif(p.full_name, ''),
    split_part(coalesce(oa.contact_email, ''), '@', 1),
    'Organizer Applicant'
  ),
  organization_name = coalesce(
    nullif(oa.organization_name, ''),
    nullif(p.organization, ''),
    'Organization'
  )
from public.profiles as p
where oa.profile_id = p.id
  and (
    oa.applicant_full_name is null
    or oa.organization_name is null
    or oa.applicant_full_name = ''
    or oa.organization_name = ''
  );

update public.organizer_applications
set
  applicant_full_name = coalesce(
    nullif(applicant_full_name, ''),
    split_part(coalesce(contact_email, ''), '@', 1),
    'Organizer Applicant'
  ),
  organization_name = coalesce(
    nullif(organization_name, ''),
    'Organization'
  )
where applicant_full_name is null
  or organization_name is null
  or applicant_full_name = ''
  or organization_name = '';

alter table public.organizer_applications
  add constraint organizer_applications_contact_email_lower_ck
    check (contact_email is null or contact_email = lower(contact_email)) not valid,
  add constraint organizer_applications_logo_path_format_ck
    check (
      logo_path is null
      or logo_path ~ '^organizer-applications/[0-9a-f-]{36}/logo\\.(jpg|png)$'
    ) not valid,
  add constraint organizer_applications_status_lookup_hash_format_ck
    check (
      status_lookup_token_hash is null
      or status_lookup_token_hash ~ '^[0-9a-f]{64}$'
    ) not valid,
  add constraint organizer_applications_status_lookup_pair_ck
    check (
      (status_lookup_token_hash is null and status_lookup_token_expires_at is null)
      or (status_lookup_token_hash is not null and status_lookup_token_expires_at is not null)
    ) not valid,
  add constraint organizer_applications_status_lookup_expiry_ck
    check (
      status_lookup_token_expires_at is null
      or status_lookup_token_expires_at > submitted_at
    ) not valid,
  add constraint organizer_applications_rejection_reason_safety_ck
    check (
      rejection_reason is null
      or (
        length(btrim(rejection_reason)) <= 500
        and rejection_reason !~* '<[^>]+>'
        and rejection_reason !~* '(https?://|www\\.)'
        and rejection_reason !~* '[A-Z0-9._%+\\-]+@[A-Z0-9.\\-]+\\.[A-Z]{2,}'
      )
    ) not valid;

create unique index if not exists organizer_applications_status_lookup_token_hash_uq
  on public.organizer_applications (status_lookup_token_hash)
  where status_lookup_token_hash is not null;

create index if not exists organizer_applications_reviewed_status_idx
  on public.organizer_applications (status, reviewed_at desc)
  where status in ('approved', 'rejected');

drop policy if exists "organizer_applications_insert_self" on public.organizer_applications;

create policy "organizer_applications_insert_trusted_only"
on public.organizer_applications
for insert
with check (auth.role() = 'service_role' or public.jwt_is_admin());

revoke insert on public.organizer_applications from anon;
revoke insert on public.organizer_applications from authenticated;

grant insert on public.organizer_applications to service_role;

create or replace function public.sanitize_safe_public_rejection_reason(p_reason text)
returns text
language plpgsql
immutable
as $$
declare
  v_reason text := coalesce(p_reason, '');
begin
  v_reason := regexp_replace(v_reason, '<[^>]+>', ' ', 'gi');
  v_reason := regexp_replace(v_reason, '(https?://|www\\.)\\S+', '[redacted-link]', 'gi');
  v_reason := regexp_replace(v_reason, '[A-Z0-9._%+\\-]+@[A-Z0-9.\\-]+\\.[A-Z]{2,}', '[redacted-email]', 'gi');
  v_reason := regexp_replace(v_reason, '(\\+?\\d[\\d\\s().-]{6,}\\d)', '[redacted-phone]', 'g');
  v_reason := btrim(v_reason);

  if v_reason = '' then
    return null;
  end if;

  return left(v_reason, 500);
end;
$$;

create or replace function public.enforce_organizer_application_review_contract()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.contact_email is not null then
    new.contact_email := lower(new.contact_email);
  end if;

  if old.status in ('approved', 'rejected') then
    new.status := old.status;
    new.reviewed_at := old.reviewed_at;
    new.rejection_reason := old.rejection_reason;
    return new;
  end if;

  if new.status = 'approved' then
    new.reviewed_at := coalesce(new.reviewed_at, timezone('utc', now()));
    new.rejection_reason := null;
  elsif new.status = 'rejected' then
    new.reviewed_at := coalesce(new.reviewed_at, timezone('utc', now()));
    new.rejection_reason := public.sanitize_safe_public_rejection_reason(new.rejection_reason);

    if new.rejection_reason is null then
      raise exception 'Rejection reason is required for rejected applications.';
    end if;
  else
    new.reviewed_at := null;
    new.rejection_reason := null;
  end if;

  return new;
end;
$$;

drop trigger if exists organizer_applications_review_contract_before_update
  on public.organizer_applications;

create trigger organizer_applications_review_contract_before_update
before update on public.organizer_applications
for each row
execute function public.enforce_organizer_application_review_contract();

create table if not exists public.organizer_status_lookup_throttle (
  client_ip inet not null,
  token_fingerprint text not null,
  last_accepted_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (client_ip, token_fingerprint)
);

create index if not exists organizer_status_lookup_throttle_last_accepted_idx
  on public.organizer_status_lookup_throttle (last_accepted_at);

alter table public.organizer_status_lookup_throttle enable row level security;

drop policy if exists "organizer_status_lookup_throttle_service_only"
  on public.organizer_status_lookup_throttle;

create policy "organizer_status_lookup_throttle_service_only"
on public.organizer_status_lookup_throttle
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

grant select, insert, update, delete on public.organizer_status_lookup_throttle to service_role;
revoke all on public.organizer_status_lookup_throttle from anon;
revoke all on public.organizer_status_lookup_throttle from authenticated;

create or replace function public.normalize_status_lookup_token(p_raw text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(btrim(coalesce(p_raw, '')), '\\s+', '', 'g'));
$$;

create or replace function public.hash_status_lookup_token(p_raw text)
returns text
language plpgsql
immutable
set search_path = public, extensions
as $$
declare
  v_normalized text := public.normalize_status_lookup_token(p_raw);
begin
  if v_normalized = '' or v_normalized !~ '^[a-f0-9]{32,128}$' then
    return null;
  end if;

  return encode(extensions.digest('centipede:status-lookup:' || v_normalized, 'sha256'), 'hex');
end;
$$;

create or replace function public.status_lookup_token_fingerprint(p_raw text)
returns text
language plpgsql
immutable
set search_path = public, extensions
as $$
declare
  v_normalized text := public.normalize_status_lookup_token(p_raw);
begin
  if v_normalized = '' or v_normalized !~ '^[a-f0-9]{32,128}$' then
    return 'malformed';
  end if;

  return encode(extensions.digest('centipede:lookup-fingerprint:' || v_normalized, 'sha256'), 'hex');
end;
$$;

create or replace function public.mask_contact_email(p_email text)
returns text
language plpgsql
immutable
as $$
declare
  v_email text := lower(coalesce(p_email, ''));
  v_local text;
  v_domain text;
begin
  if position('@' in v_email) <= 1 then
    return '***';
  end if;

  v_local := split_part(v_email, '@', 1);
  v_domain := split_part(v_email, '@', 2);

  return left(v_local, 1)
    || repeat('*', greatest(length(v_local) - 1, 2))
    || '@'
    || v_domain;
end;
$$;

create or replace function public.insert_organizer_application_intake(
  p_applicant_full_name text,
  p_organization_name text,
  p_contact_email text,
  p_contact_phone text,
  p_organization_type text,
  p_statement text,
  p_legal_consent_at timestamptz,
  p_status_lookup_token_hash text,
  p_status_lookup_token_expires_at timestamptz,
  p_profile_id uuid default null
)
returns table (application_id uuid, created_new boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact_email text := lower(btrim(coalesce(p_contact_email, '')));
  v_applicant_full_name text := btrim(coalesce(p_applicant_full_name, ''));
  v_organization_name text := btrim(coalesce(p_organization_name, ''));
  v_contact_phone text := btrim(coalesce(p_contact_phone, ''));
  v_organization_type text := btrim(coalesce(p_organization_type, ''));
  v_statement text := btrim(coalesce(p_statement, ''));
  v_existing_id uuid;
begin
  if v_applicant_full_name = '' then
    raise exception 'Applicant full name is required.';
  end if;

  if v_organization_name = '' then
    raise exception 'Organization name is required.';
  end if;

  if v_contact_email = '' then
    raise exception 'Contact email is required.';
  end if;

  if v_contact_phone = '' then
    raise exception 'Contact phone is required.';
  end if;

  if v_organization_type = '' then
    raise exception 'Organization type is required.';
  end if;

  if v_statement = '' then
    raise exception 'Organizer statement is required.';
  end if;

  if p_legal_consent_at is null then
    raise exception 'Legal consent is required.';
  end if;

  if p_status_lookup_token_hash is null or p_status_lookup_token_hash = '' then
    raise exception 'Status lookup token hash is required.';
  end if;

  if p_status_lookup_token_expires_at is null then
    raise exception 'Status lookup token expiry is required.';
  end if;

  perform pg_advisory_xact_lock(hashtext('organizer-intake:' || v_contact_email));

  select id
  into v_existing_id
  from public.organizer_applications
  where lower(contact_email) = v_contact_email
    and status = 'pending'
  order by submitted_at desc
  limit 1
  for update;

  if v_existing_id is not null then
    update public.organizer_applications
    set profile_id = coalesce(public.organizer_applications.profile_id, p_profile_id),
        applicant_full_name = v_applicant_full_name,
        organization_name = v_organization_name,
        contact_email = v_contact_email,
        contact_phone = v_contact_phone,
        organization_type = v_organization_type,
        statement = v_statement,
        legal_consent_at = p_legal_consent_at,
        status_lookup_token_hash = p_status_lookup_token_hash,
        status_lookup_token_expires_at = p_status_lookup_token_expires_at,
        submitted_at = timezone('utc', now())
    where id = v_existing_id;

    application_id := v_existing_id;
    created_new := false;
    return next;
    return;
  end if;

  insert into public.organizer_applications (
    profile_id,
    applicant_full_name,
    organization_name,
    contact_email,
    contact_phone,
    organization_type,
    statement,
    legal_consent_at,
    status_lookup_token_hash,
    status_lookup_token_expires_at,
    status
  )
  values (
    p_profile_id,
    v_applicant_full_name,
    v_organization_name,
    v_contact_email,
    v_contact_phone,
    v_organization_type,
    v_statement,
    p_legal_consent_at,
    p_status_lookup_token_hash,
    p_status_lookup_token_expires_at,
    'pending'
  )
  returning id into application_id;

  created_new := true;
  return next;
end;
$$;

create or replace function public.lookup_organizer_application_status(
  p_status_lookup_token text,
  p_client_ip inet
)
returns table (
  machine_code text,
  status public.organizer_application_status,
  rejection_reason text,
  masked_contact_email text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_fingerprint text := public.status_lookup_token_fingerprint(p_status_lookup_token);
  v_token_hash text := public.hash_status_lookup_token(p_status_lookup_token);
  v_allowed boolean := false;
begin
  with accepted as (
    insert into public.organizer_status_lookup_throttle (
      client_ip,
      token_fingerprint,
      last_accepted_at
    )
    values (coalesce(p_client_ip, '0.0.0.0'::inet), v_fingerprint, v_now)
    on conflict (client_ip, token_fingerprint)
    do update
      set last_accepted_at = excluded.last_accepted_at
    where public.organizer_status_lookup_throttle.last_accepted_at <= excluded.last_accepted_at - interval '1 second'
    returning 1
  )
  select exists(select 1 from accepted) into v_allowed;

  if not v_allowed then
    return query
      select 'throttled', null::public.organizer_application_status, null::text, null::text;
    return;
  end if;

  if v_token_hash is null then
    return query
      select 'not_found', null::public.organizer_application_status, null::text, null::text;
    return;
  end if;

  return query
  select
    'ok'::text,
    oa.status,
    case
      when oa.status = 'rejected'
        then public.sanitize_safe_public_rejection_reason(oa.rejection_reason)
      else null
    end,
    public.mask_contact_email(oa.contact_email)
  from public.organizer_applications as oa
  where oa.status_lookup_token_hash = v_token_hash
    and oa.status_lookup_token_expires_at > v_now
  limit 1;

  if not found then
    return query
      select 'not_found', null::public.organizer_application_status, null::text, null::text;
  end if;
end;
$$;

create or replace function public.provision_organizer_account(
  p_application_id uuid,
  p_profile_id uuid default null
)
returns table (
  machine_code text,
  application_id uuid,
  profile_id uuid,
  activated boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application public.organizer_applications%rowtype;
  v_profile_id uuid;
  v_profile_email text;
  v_activated boolean := false;
begin
  perform pg_advisory_xact_lock(hashtext('organizer-provision:' || p_application_id::text));

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

  if v_application.status <> 'approved' then
    return query
      select 'not_approved', v_application.id, v_application.profile_id, false;
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

  if v_application.contact_email is not null and lower(v_profile_email) <> lower(v_application.contact_email) then
    return query
      select 'profile_email_mismatch', v_application.id, v_profile_id, false;
    return;
  end if;

  if v_application.profile_id is null then
    update public.organizer_applications
    set profile_id = v_profile_id
    where id = v_application.id
      and profile_id is null;
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

  v_activated := true;

  return query
    select 'ok', v_application.id, v_profile_id, v_activated;
end;
$$;

do $$
begin
  create type public.organizer_application_message_type as enum (
    'submission',
    'approved',
    'rejected'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.organizer_application_communications (
  id uuid primary key default extensions.gen_random_uuid(),
  application_id uuid not null references public.organizer_applications(id) on delete cascade,
  message_type public.organizer_application_message_type not null,
  recipient_email text not null,
  payload_json jsonb not null default '{}'::jsonb,
  send_attempts integer not null default 0,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  last_error text,
  provider_message_id text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint organizer_application_communications_recipient_email_lower_ck
    check (recipient_email = lower(recipient_email)),
  constraint organizer_application_communications_send_attempts_ck
    check (send_attempts >= 0),
  constraint organizer_application_communications_one_per_type_uq
    unique (application_id, message_type)
);

create index if not exists organizer_application_communications_unsent_idx
  on public.organizer_application_communications (created_at)
  where sent_at is null;

alter table public.organizer_application_communications enable row level security;

drop policy if exists "organizer_application_communications_service_only"
  on public.organizer_application_communications;

create policy "organizer_application_communications_service_only"
on public.organizer_application_communications
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

grant select, insert, update, delete
  on public.organizer_application_communications
  to service_role;

revoke all on public.organizer_application_communications from anon;
revoke all on public.organizer_application_communications from authenticated;

create or replace function public.claim_organizer_application_communication(
  p_application_id uuid,
  p_message_type public.organizer_application_message_type,
  p_recipient_email text,
  p_payload_json jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_id uuid;
  v_email text := lower(btrim(coalesce(p_recipient_email, '')));
begin
  if v_email = '' then
    raise exception 'Recipient email is required.';
  end if;

  insert into public.organizer_application_communications (
    application_id,
    message_type,
    recipient_email,
    payload_json,
    send_attempts,
    last_attempt_at
  )
  values (
    p_application_id,
    p_message_type,
    v_email,
    coalesce(p_payload_json, '{}'::jsonb),
    1,
    v_now
  )
  on conflict (application_id, message_type)
  do nothing
  returning id into v_id;

  if v_id is not null then
    return v_id;
  end if;

  update public.organizer_application_communications
  set send_attempts = send_attempts + 1,
      last_attempt_at = v_now,
      recipient_email = v_email,
      payload_json = case
        when payload_json = '{}'::jsonb then coalesce(p_payload_json, '{}'::jsonb)
        else payload_json
      end
  where application_id = p_application_id
    and message_type = p_message_type
    and sent_at is null
    and (
      last_attempt_at is null
      or last_attempt_at <= v_now - interval '30 seconds'
    )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.mark_organizer_application_communication_sent(
  p_communication_id uuid,
  p_provider_message_id text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.organizer_application_communications
  set sent_at = coalesce(sent_at, timezone('utc', now())),
      provider_message_id = coalesce(provider_message_id, nullif(btrim(p_provider_message_id), '')),
      last_attempt_at = timezone('utc', now()),
      last_error = null
  where id = p_communication_id;
$$;

create or replace function public.mark_organizer_application_communication_failed(
  p_communication_id uuid,
  p_error text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.organizer_application_communications
  set last_attempt_at = timezone('utc', now()),
      last_error = left(coalesce(p_error, 'unknown_error'), 2000)
  where id = p_communication_id
    and sent_at is null;
$$;

revoke all on function public.insert_organizer_application_intake(
  text, text, text, text, text, text, timestamptz, text, timestamptz, uuid
) from public;
revoke all on function public.lookup_organizer_application_status(text, inet) from public;
revoke all on function public.provision_organizer_account(uuid, uuid) from public;
revoke all on function public.claim_organizer_application_communication(uuid, public.organizer_application_message_type, text, jsonb) from public;
revoke all on function public.mark_organizer_application_communication_sent(uuid, text) from public;
revoke all on function public.mark_organizer_application_communication_failed(uuid, text) from public;

grant execute on function public.insert_organizer_application_intake(
  text, text, text, text, text, text, timestamptz, text, timestamptz, uuid
) to service_role;
grant execute on function public.lookup_organizer_application_status(text, inet) to service_role;
grant execute on function public.provision_organizer_account(uuid, uuid) to service_role;
grant execute on function public.claim_organizer_application_communication(uuid, public.organizer_application_message_type, text, jsonb) to service_role;
grant execute on function public.mark_organizer_application_communication_sent(uuid, text) to service_role;
grant execute on function public.mark_organizer_application_communication_failed(uuid, text) to service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'organizer-assets',
  'organizer-assets',
  false,
  2097152,
  array['image/jpeg', 'image/png']::text[]
)
on conflict (id)
do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

commit;
