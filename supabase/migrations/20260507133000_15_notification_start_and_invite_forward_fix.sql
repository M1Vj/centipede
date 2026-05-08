create or replace function public.notification_preference_key(p_type text)
returns text
language sql
immutable
as $$
  select case p_type
    when 'team_invite_sent' then 'team_invites'
    when 'team_invite_accepted' then 'team_invites'
    when 'team_invite_declined' then 'team_invites'
    when 'team_roster_invalidated' then 'team_invites'
    when 'competition_registration_confirmed' then 'registration_reminders'
    when 'competition_registration_withdrawn' then 'registration_reminders'
    when 'competition_started' then 'registration_reminders'
    when 'competition_announcement_posted' then 'announcements'
    when 'leaderboard_published' then 'leaderboard_publication'
    when 'dispute_resolved' then 'leaderboard_publication'
    when 'score_recalculated' then 'score_recalculation'
    when 'organizer_application_submitted' then 'organizer_decisions'
    when 'organizer_application_approved' then 'organizer_decisions'
    when 'organizer_application_rejected' then 'organizer_decisions'
    else null
  end;
$$;

create or replace function public.notification_channel_class(p_type text)
returns text
language sql
immutable
as $$
  select case p_type
    when 'score_recalculated' then 'in_app_only'
    when 'organizer_application_submitted' then 'in_app_only'
    when 'organizer_application_approved' then 'in_app_only'
    when 'organizer_application_rejected' then 'in_app_only'
    else 'email_eligible'
  end;
$$;

create or replace function public.is_allowed_notification_link_path(p_link_path text)
returns boolean
language sql
immutable
as $$
  select p_link_path is null
    or p_link_path = '/organizer/status'
    or p_link_path = '/mathlete/teams/invites'
    or p_link_path = '/mathlete/history'
    or p_link_path = '/organizer/history'
    or p_link_path ~ '^/mathlete/competition/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    or p_link_path ~ '^/organizer/competition/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    or p_link_path ~ '^/mathlete/competition/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/leaderboard$'
    or p_link_path ~ '^/organizer/competition/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/leaderboard$'
    or p_link_path ~ '^/organizer/competition/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/participants$'
    or p_link_path ~ '^/mathlete/competition/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/review$'
    or p_link_path ~ '^/mathlete/competition/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/answer-key$';
$$;

grant execute on function public.notification_preference_key(text) to authenticated, service_role;
grant execute on function public.notification_channel_class(text) to authenticated, service_role;
grant execute on function public.is_allowed_notification_link_path(text) to authenticated, service_role;
