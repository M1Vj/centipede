import { createAdminClient } from "@/lib/supabase/admin";

export type NotificationChannelClass = "in_app_only" | "email_eligible" | "email_required";

export type NotificationPreferenceKey =
  | "team_invites"
  | "registration_reminders"
  | "announcements"
  | "leaderboard_publication"
  | "score_recalculation"
  | "organizer_decisions";

export type CanonicalNotificationEvent =
  | "team_invite_sent"
  | "team_invite_accepted"
  | "team_invite_declined"
  | "team_roster_invalidated"
  | "competition_registration_confirmed"
  | "competition_registration_withdrawn"
  | "competition_started"
  | "competition_announcement_posted"
  | "answer_key_released"
  | "leaderboard_published"
  | "dispute_resolved"
  | "score_recalculated"
  | "organizer_application_submitted"
  | "organizer_application_approved"
  | "organizer_application_rejected";

export type NotificationEmailDecision = {
  eligible: boolean;
  attempted: false;
  reason: "not_email_event" | "provider_not_configured";
};

export type NotificationDispatchResult =
  | {
      ok: true;
      eventIdentityKey: string;
      eventType: CanonicalNotificationEvent;
      channelClass: NotificationChannelClass;
      preferenceKey: NotificationPreferenceKey;
      skipped: boolean;
      notificationId: string | null;
      email: NotificationEmailDecision;
      reason?: string;
    }
  | {
      ok: false;
      eventIdentityKey: string;
      error: "invalid_event_type" | "missing_admin_client" | "enqueue_failed";
      message?: string;
    };

export type TeamNotificationEvent =
  | "team_invite_sent"
  | "team_invite_accepted"
  | "team_invite_declined"
  | "team_roster_invalidated";

export type CompetitionNotificationEvent =
  | "competition_registration_confirmed"
  | "competition_registration_withdrawn"
  | "competition_started"
  | "competition_announcement_posted"
  | "answer_key_released"
  | "competition_leaderboard_published"
  | "competition_problem_dispute_resolved"
  | "leaderboard_published"
  | "dispute_resolved"
  | "score_recalculated";

export type OrganizerDecisionNotificationEvent =
  | "organizer_application_submitted"
  | "organizer_application_approved"
  | "organizer_application_rejected";

export type NotificationDispatchInput = {
  event: string;
  eventIdentityKey: string;
  recipientId: string;
  actorId?: string | null;
  title?: string;
  body?: string;
  linkPath?: string | null;
  metadata?: Record<string, unknown>;
};

export type TeamNotificationDispatchInput = NotificationDispatchInput & {
  event: TeamNotificationEvent;
  teamId: string;
  inviteId?: string | null;
};

export type CompetitionNotificationDispatchInput = NotificationDispatchInput & {
  event: CompetitionNotificationEvent;
  competitionId: string;
  registrationId?: string | null;
};

export type OrganizerDecisionNotificationDispatchInput = NotificationDispatchInput & {
  event: OrganizerDecisionNotificationEvent;
  applicationId: string;
};

const EVENT_ALIASES: Partial<Record<string, CanonicalNotificationEvent>> = {
  competition_leaderboard_published: "leaderboard_published",
  competition_problem_dispute_resolved: "dispute_resolved",
};

const EVENT_PREFERENCE_KEYS: Record<CanonicalNotificationEvent, NotificationPreferenceKey> = {
  team_invite_sent: "team_invites",
  team_invite_accepted: "team_invites",
  team_invite_declined: "team_invites",
  team_roster_invalidated: "team_invites",
  competition_registration_confirmed: "registration_reminders",
  competition_registration_withdrawn: "registration_reminders",
  competition_started: "registration_reminders",
  competition_announcement_posted: "announcements",
  answer_key_released: "leaderboard_publication",
  leaderboard_published: "leaderboard_publication",
  dispute_resolved: "leaderboard_publication",
  score_recalculated: "score_recalculation",
  organizer_application_submitted: "organizer_decisions",
  organizer_application_approved: "organizer_decisions",
  organizer_application_rejected: "organizer_decisions",
};

const EVENT_CHANNEL_CLASSES: Record<CanonicalNotificationEvent, NotificationChannelClass> = {
  team_invite_sent: "email_eligible",
  team_invite_accepted: "email_eligible",
  team_invite_declined: "email_eligible",
  team_roster_invalidated: "email_eligible",
  competition_registration_confirmed: "email_eligible",
  competition_registration_withdrawn: "email_eligible",
  competition_started: "email_eligible",
  competition_announcement_posted: "email_eligible",
  answer_key_released: "email_eligible",
  leaderboard_published: "email_eligible",
  dispute_resolved: "email_eligible",
  score_recalculated: "in_app_only",
  organizer_application_submitted: "in_app_only",
  organizer_application_approved: "in_app_only",
  organizer_application_rejected: "in_app_only",
};

const MANDATORY_INBOX_EVENTS = new Set<CanonicalNotificationEvent>([
  "team_invite_sent",
  "competition_started",
  "competition_announcement_posted",
  "answer_key_released",
]);

const EVENT_TEMPLATES: Record<CanonicalNotificationEvent, { title: string; body: string }> = {
  team_invite_sent: {
    title: "Team invite received",
    body: "You have a pending team invitation.",
  },
  team_invite_accepted: {
    title: "Team invite accepted",
    body: "A team invitation was accepted.",
  },
  team_invite_declined: {
    title: "Team invite declined",
    body: "A team invitation was declined.",
  },
  team_roster_invalidated: {
    title: "Team roster invalidated",
    body: "A team roster no longer meets competition requirements.",
  },
  competition_registration_confirmed: {
    title: "Registration confirmed",
    body: "Your competition registration is confirmed.",
  },
  competition_registration_withdrawn: {
    title: "Registration withdrawn",
    body: "Your competition registration was withdrawn.",
  },
  competition_started: {
    title: "Competition started",
    body: "A competition you registered for is now live.",
  },
  competition_announcement_posted: {
    title: "Competition announcement",
    body: "A competition announcement was posted.",
  },
  answer_key_released: {
    title: "Answer key released",
    body: "A competition answer key is now available.",
  },
  leaderboard_published: {
    title: "Leaderboard published",
    body: "A competition leaderboard is now available.",
  },
  dispute_resolved: {
    title: "Dispute resolved",
    body: "A problem dispute has been resolved.",
  },
  score_recalculated: {
    title: "Score recalculated",
    body: "Competition scores were recalculated.",
  },
  organizer_application_submitted: {
    title: "Organizer application submitted",
    body: "An organizer application was submitted.",
  },
  organizer_application_approved: {
    title: "Organizer application approved",
    body: "Your organizer application was approved.",
  },
  organizer_application_rejected: {
    title: "Organizer application rejected",
    body: "Your organizer application was rejected.",
  },
};

const UUID_SEGMENT = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const ALLOWED_LINK_PATTERNS = [
  /^\/organizer\/status$/,
  /^\/mathlete\/teams\/invites$/,
  new RegExp(`^/mathlete/competition/${UUID_SEGMENT}$`),
  new RegExp(`^/organizer/competition/${UUID_SEGMENT}$`),
  new RegExp(`^/mathlete/competition/${UUID_SEGMENT}/leaderboard$`),
  new RegExp(`^/organizer/competition/${UUID_SEGMENT}/leaderboard$`),
  new RegExp(`^/organizer/competition/${UUID_SEGMENT}/participants$`),
  new RegExp(`^/mathlete/competition/${UUID_SEGMENT}/review$`),
  /^\/mathlete\/history$/,
  /^\/organizer\/history$/,
  new RegExp(`^/mathlete/competition/${UUID_SEGMENT}/answer-key$`),
];

export function getDefaultNotificationPreferences() {
  return {
    inAppEnabled: true,
    emailEnabled: false,
    teamInvites: true,
    registrationReminders: true,
    announcements: true,
    leaderboardPublication: true,
    scoreRecalculation: true,
    organizerDecisions: true,
  };
}

export function normalizeNotificationEventType(event: string): CanonicalNotificationEvent | null {
  const canonical = EVENT_ALIASES[event] ?? event;
  return canonical in EVENT_PREFERENCE_KEYS ? (canonical as CanonicalNotificationEvent) : null;
}

export function getNotificationPreferenceKey(event: string): NotificationPreferenceKey | null {
  const canonical = normalizeNotificationEventType(event);
  return canonical ? EVENT_PREFERENCE_KEYS[canonical] : null;
}

export function getNotificationChannelClass(event: string): NotificationChannelClass | null {
  const canonical = normalizeNotificationEventType(event);
  return canonical ? EVENT_CHANNEL_CLASSES[canonical] : null;
}

export function sanitizeNotificationLinkPath(linkPath?: string | null): string | null {
  if (!linkPath || linkPath.length > 256 || !linkPath.startsWith("/")) {
    return null;
  }

  if (linkPath.includes("//") || linkPath.includes("?") || linkPath.includes("#")) {
    return null;
  }

  return ALLOWED_LINK_PATTERNS.some((pattern) => pattern.test(linkPath)) ? linkPath : null;
}

export async function dispatchNotification(
  input: NotificationDispatchInput,
): Promise<NotificationDispatchResult> {
  const eventType = normalizeNotificationEventType(input.event);
  if (!eventType) {
    return {
      ok: false,
      eventIdentityKey: input.eventIdentityKey,
      error: "invalid_event_type",
    };
  }

  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false,
      eventIdentityKey: input.eventIdentityKey,
      error: "missing_admin_client",
    };
  }

  const channelClass = EVENT_CHANNEL_CLASSES[eventType];
  const preferenceKey = EVENT_PREFERENCE_KEYS[eventType];
  const template = EVENT_TEMPLATES[eventType];
  const email = getEmailDecision(channelClass);
  const metadata = {
    ...(input.metadata ?? {}),
    actorId: input.actorId ?? null,
    channelClass,
    preferenceKey,
    mandatoryInbox: channelClass === "in_app_only" || MANDATORY_INBOX_EVENTS.has(eventType),
    email,
  };

  const { data, error } = await admin.rpc("enqueue_notification", {
    p_recipient_id: input.recipientId,
    p_type: eventType,
    p_title: input.title ?? template.title,
    p_body: input.body ?? template.body,
    p_link_path: sanitizeNotificationLinkPath(input.linkPath),
    p_event_identity_key: input.eventIdentityKey,
    p_metadata_json: metadata,
  });

  if (error) {
    return {
      ok: false,
      eventIdentityKey: input.eventIdentityKey,
      error: "enqueue_failed",
      message: error.message,
    };
  }

  const row = normalizeEnqueueResult(data);
  return {
    ok: true,
    eventIdentityKey: input.eventIdentityKey,
    eventType,
    channelClass,
    preferenceKey,
    skipped: !row.inserted,
    notificationId: row.notificationId,
    email,
    reason: row.inserted
      ? undefined
      : row.inboxAllowed
        ? "duplicate_event_identity"
        : "preferences_disabled",
  };
}

export async function dispatchTeamNotification(
  input: TeamNotificationDispatchInput,
): Promise<NotificationDispatchResult> {
  return dispatchNotification({
    ...input,
    metadata: {
      ...(input.metadata ?? {}),
      teamId: input.teamId,
      inviteId: input.inviteId ?? null,
    },
  });
}

export async function dispatchCompetitionNotification(
  input: CompetitionNotificationDispatchInput,
): Promise<NotificationDispatchResult> {
  return dispatchNotification({
    ...input,
    metadata: {
      ...(input.metadata ?? {}),
      competitionId: input.competitionId,
      registrationId: input.registrationId ?? null,
    },
  });
}

export async function dispatchOrganizerDecisionNotification(
  input: OrganizerDecisionNotificationDispatchInput,
): Promise<NotificationDispatchResult> {
  return dispatchNotification({
    ...input,
    metadata: {
      ...(input.metadata ?? {}),
      applicationId: input.applicationId,
    },
  });
}

function getEmailDecision(channelClass: NotificationChannelClass): NotificationEmailDecision {
  if (channelClass === "in_app_only") {
    return {
      eligible: false,
      attempted: false,
      reason: "not_email_event",
    };
  }

  return {
    eligible: true,
    attempted: false,
    reason: "provider_not_configured",
  };
}

function normalizeEnqueueResult(data: unknown): {
  inboxAllowed: boolean;
  notificationId: string | null;
  inserted: boolean;
} {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return { inboxAllowed: true, notificationId: null, inserted: true };
  }

  const result = row as {
    inbox_allowed?: unknown;
    inboxAllowed?: unknown;
    notification_id?: unknown;
    notificationId?: unknown;
    inserted?: unknown;
  };

  return {
    inboxAllowed: typeof result.inbox_allowed === "boolean"
      ? result.inbox_allowed
      : typeof result.inboxAllowed === "boolean"
        ? result.inboxAllowed
        : true,
    notificationId: typeof result.notification_id === "string"
      ? result.notification_id
      : typeof result.notificationId === "string"
        ? result.notificationId
        : null,
    inserted: typeof result.inserted === "boolean" ? result.inserted : true,
  };
}
