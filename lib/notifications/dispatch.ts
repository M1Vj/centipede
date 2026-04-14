export type NotificationDispatchResult =
  | {
      ok: true;
      eventIdentityKey: string;
      skipped: boolean;
      reason?: string;
    }
  | {
      ok: false;
      eventIdentityKey: string;
      error: string;
    };

export type TeamNotificationEvent =
  | "team_invite_sent"
  | "team_invite_accepted"
  | "team_invite_declined"
  | "team_roster_invalidated";

export type TeamNotificationDispatchInput = {
  event: TeamNotificationEvent;
  eventIdentityKey: string;
  recipientId: string;
  actorId?: string | null;
  teamId: string;
  inviteId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function dispatchTeamNotification(
  input: TeamNotificationDispatchInput,
): Promise<NotificationDispatchResult> {
  return {
    ok: true,
    eventIdentityKey: input.eventIdentityKey,
    skipped: true,
    reason: "not_configured",
  };
}
