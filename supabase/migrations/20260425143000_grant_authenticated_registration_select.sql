-- Allow participants and organizers to read registration rows permitted by RLS.
grant select on public.competition_registrations to authenticated;
