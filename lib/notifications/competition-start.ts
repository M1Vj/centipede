import { dispatchCompetitionNotification } from "@/lib/notifications/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";

type RegistrationRecipientRow = {
  id?: string | null;
  profile_id?: string | null;
  team_id?: string | null;
};

type TeamRecipientRow = {
  profile_id?: string | null;
  team_id?: string | null;
};

type RegistrationRecipient = {
  id: string;
  profile_id: string | null;
  team_id: string | null;
};

type CompetitionStartedNotificationInput = {
  actorId?: string | null;
  competitionId: string;
  organizerId: string;
  requestIdempotencyToken: string;
};

export async function dispatchCompetitionStartedNotifications({
  actorId,
  competitionId,
  organizerId,
  requestIdempotencyToken,
}: CompetitionStartedNotificationInput) {
  const admin = createAdminClient();
  if (!admin) {
    return { attempted: 0, sent: 0, skipped: 0, failed: 1 };
  }

  const { data, error } = await admin
    .from("competition_registrations")
    .select("id, profile_id, team_id")
    .eq("competition_id", competitionId)
    .eq("status", "registered")
    .returns<RegistrationRecipientRow[]>();

  if (error) {
    return { attempted: 0, sent: 0, skipped: 0, failed: 1 };
  }

  const registrationRows = (data ?? []).flatMap((row): RegistrationRecipient[] => {
    if (typeof row.id !== "string") {
      return [];
    }

    const profileId = typeof row.profile_id === "string" ? row.profile_id : null;
    const teamId = typeof row.team_id === "string" ? row.team_id : null;

    return profileId || teamId
      ? [
          {
            id: row.id,
            profile_id: profileId,
            team_id: teamId,
          },
        ]
      : [];
  });
  const teamIds = [...new Set(registrationRows.map((row) => row.team_id).filter((teamId): teamId is string => Boolean(teamId)))];
  const teamRecipientsByTeamId = new Map<string, string[]>();

  if (teamIds.length > 0) {
    const { data: teamRows, error: teamRowsError } = await admin
      .from("team_memberships")
      .select("team_id, profile_id")
      .in("team_id", teamIds)
      .eq("is_active", true)
      .returns<TeamRecipientRow[]>();

    if (teamRowsError) {
      return { attempted: 0, sent: 0, skipped: 0, failed: 1 };
    }

    for (const row of teamRows ?? []) {
      if (typeof row.team_id !== "string" || typeof row.profile_id !== "string") {
        continue;
      }

      const recipients = teamRecipientsByTeamId.get(row.team_id) ?? [];
      recipients.push(row.profile_id);
      teamRecipientsByTeamId.set(row.team_id, recipients);
    }
  }

  const registrationRecipients = registrationRows.flatMap((registration) => {
    const teamRecipients = registration.team_id
      ? teamRecipientsByTeamId.get(registration.team_id) ?? []
      : [];
    const recipientIds =
      teamRecipients.length > 0
        ? teamRecipients
        : registration.profile_id
          ? [registration.profile_id]
          : [];

    return [...new Set(recipientIds)].map((recipientId) => ({
      registrationId: registration.id,
      recipientId,
    }));
  });

  const requests = [
    dispatchCompetitionNotification({
      event: "competition_started",
      eventIdentityKey: `competition_started:${competitionId}:organizer`,
      recipientId: organizerId,
      actorId: actorId ?? organizerId,
      competitionId,
      linkPath: `/organizer/competition/${competitionId}`,
      title: "Competition started",
      body: "Your competition is now live.",
      metadata: {
        audience: "organizer",
        requestIdempotencyToken,
      },
    }),
    ...registrationRecipients.map((registration) =>
      dispatchCompetitionNotification({
        event: "competition_started",
        eventIdentityKey: `competition_started:${competitionId}:registration:${registration.registrationId}`,
        recipientId: registration.recipientId,
        actorId: actorId ?? organizerId,
        competitionId,
        registrationId: registration.registrationId,
        linkPath: `/mathlete/competition/${competitionId}`,
        metadata: {
          audience: "registered_mathlete",
          requestIdempotencyToken,
        },
      }),
    ),
  ];

  const results = await Promise.all(requests);
  return {
    attempted: results.length,
    sent: results.filter((result) => result.ok && !result.skipped).length,
    skipped: results.filter((result) => result.ok && result.skipped).length,
    failed: results.filter((result) => !result.ok).length,
  };
}
