-- Keep database notification routing in sync with the answer-key release event.

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
    when 'answer_key_released' then 'leaderboard_publication'
    when 'leaderboard_published' then 'leaderboard_publication'
    when 'dispute_resolved' then 'leaderboard_publication'
    when 'score_recalculated' then 'score_recalculation'
    when 'organizer_application_submitted' then 'organizer_decisions'
    when 'organizer_application_approved' then 'organizer_decisions'
    when 'organizer_application_rejected' then 'organizer_decisions'
    else null
  end;
$$;

create or replace function public.notification_requires_mandatory_inbox(p_type text)
returns boolean
language sql
immutable
as $$
  select p_type in (
    'team_invite_sent',
    'competition_started',
    'competition_announcement_posted',
    'answer_key_released',
    'score_recalculated',
    'organizer_application_submitted',
    'organizer_application_approved',
    'organizer_application_rejected'
  );
$$;

grant execute on function public.notification_preference_key(text) to authenticated, service_role;
grant execute on function public.notification_requires_mandatory_inbox(text) to authenticated, service_role;
