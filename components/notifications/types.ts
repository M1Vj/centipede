export type NotificationItem = {
  body: string | null;
  createdAt: string | null;
  id: string;
  linkPath: string | null;
  readAt: string | null;
  title: string;
  type: string | null;
};

export type NotificationPreferences = {
  announcements: boolean;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  leaderboardPublication: boolean;
  organizerDecisions: boolean;
  registrationReminders: boolean;
  scoreRecalculation: boolean;
  teamInvites: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  announcements: true,
  emailEnabled: false,
  inAppEnabled: true,
  leaderboardPublication: true,
  organizerDecisions: true,
  registrationReminders: true,
  scoreRecalculation: true,
  teamInvites: true,
};
