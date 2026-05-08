import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchCompetitionNotification } from "@/lib/notifications/dispatch";
import {
  MONITORING_ANNOUNCEMENT_AUDIENCES,
  type MonitoringAnnouncementAudience,
  type MonitoringAttemptSummary,
  type MonitoringControlResult,
  type MonitoringParticipantSummary,
  type MonitoringRegistrationStatus,
  type MonitoringSummary,
  type MonitoringTimelineEvent,
} from "./types";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

type RegistrationRecipientRow = {
  id?: unknown;
  profile_id?: unknown;
  team_id?: unknown;
  status?: unknown;
};

type TeamMembershipRecipientRow = {
  team_id?: unknown;
  profile_id?: unknown;
};

type AnnouncementRow = {
  id?: unknown;
  competition_id?: unknown;
  title?: unknown;
  body?: unknown;
  audience?: unknown;
};

type ControlResultRow = {
  machine_code?: unknown;
  machineCode?: unknown;
  competition_id?: unknown;
  competitionId?: unknown;
  status?: unknown;
  current_status?: unknown;
  currentStatus?: unknown;
  event_id?: unknown;
  eventId?: unknown;
  replayed?: unknown;
  changed?: unknown;
  request_idempotency_token?: unknown;
  requestIdempotencyToken?: unknown;
  decision_outcome?: unknown;
  decisionOutcome?: unknown;
};

function readNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numberValue) ? numberValue : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function firstRow<T>(data: T[] | T | null | undefined): T | null {
  if (!data) {
    return null;
  }

  return Array.isArray(data) ? (data[0] ?? null) : data;
}

export function isMonitoringMissingTableError(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) {
    return false;
  }

  const message = (error.message ?? "").toLowerCase();
  return error.code === "42P01" || error.code === "42703" || message.includes("does not exist");
}

export function isMonitoringAnnouncementAudience(value: unknown): value is MonitoringAnnouncementAudience {
  return typeof value === "string" && MONITORING_ANNOUNCEMENT_AUDIENCES.includes(value as MonitoringAnnouncementAudience);
}

export function normalizeMonitoringControlResult(data: unknown): MonitoringControlResult | null {
  const row = firstRow(data as ControlResultRow[] | ControlResultRow | null | undefined);
  if (!row || typeof row !== "object") {
    return null;
  }

  const record = row as ControlResultRow;
  const machineCode = readString(record.machine_code) ?? readString(record.machineCode);
  if (!machineCode) {
    return null;
  }

  return {
    machineCode,
    competitionId: readString(record.competition_id) ?? readString(record.competitionId),
    status: readString(record.status) ?? readString(record.current_status) ?? readString(record.currentStatus),
    eventId: readString(record.event_id) ?? readString(record.eventId),
    replayed: record.replayed === true,
    changed: record.changed === true,
    requestIdempotencyToken: readString(record.request_idempotency_token) ?? readString(record.requestIdempotencyToken),
    decisionOutcome: readString(record.decision_outcome) ?? readString(record.decisionOutcome),
  };
}

export function mapMonitoringTimelineEvent(row: Record<string, unknown>): MonitoringTimelineEvent | null {
  const id = readString(row.id);
  const competitionId = readString(row.competition_id);
  const eventType = readString(row.event_type);
  if (!id || !competitionId || !eventType) {
    return null;
  }

  return {
    id,
    competitionId,
    eventType,
    controlAction: readString(row.control_action),
    actorUserId: readString(row.actor_user_id),
    happenedAt: readString(row.happened_at),
    requestIdempotencyToken: readString(row.request_idempotency_token),
    payload: readRecord(row.payload_json),
    metadata: readRecord(row.metadata_json),
  };
}

export async function fetchMonitoringSummary(competitionId: string): Promise<MonitoringSummary> {
  const admin = createAdminClient();
  if (!admin) {
    return { competitionId, participants: [], activeAttempts: [], timeline: [] };
  }

  const [participants, activeAttempts, timeline] = await Promise.all([
    fetchMonitoringParticipants(admin, competitionId),
    fetchMonitoringAttempts(admin, competitionId),
    fetchMonitoringTimeline(admin, competitionId),
  ]);

  return { competitionId, participants, activeAttempts, timeline };
}

async function fetchMonitoringParticipants(admin: AdminClient, competitionId: string): Promise<MonitoringParticipantSummary[]> {
  const { data, error } = await admin
    .from("competition_registrations")
    .select("id, profile_id, team_id, status, entry_snapshot_json")
    .eq("competition_id", competitionId);

  if (error && isMonitoringMissingTableError(error)) {
    return [];
  }

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.flatMap((row: Record<string, unknown>) => {
    const registrationId = readString(row.id);
    const status = readString(row.status) as MonitoringRegistrationStatus | null;
    if (!registrationId || !status) {
      return [];
    }

    const snapshot = readRecord(row.entry_snapshot_json);
    return [{
      registrationId,
      profileId: readString(row.profile_id),
      teamId: readString(row.team_id),
      status,
      displayName: readString(snapshot.full_name) ?? readString(snapshot.team_name) ?? "Unnamed participant",
    }];
  });
}

async function fetchMonitoringAttempts(admin: AdminClient, competitionId: string): Promise<MonitoringAttemptSummary[]> {
  const { data, error } = await admin
    .from("competition_attempts")
    .select("id, registration_id, status, final_score, raw_score, started_at, updated_at, offense_count")
    .eq("competition_id", competitionId)
    .eq("status", "in_progress");

  if (error && isMonitoringMissingTableError(error)) {
    return [];
  }

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.flatMap((row: Record<string, unknown>) => {
    const attemptId = readString(row.id);
    const registrationId = readString(row.registration_id);
    const status = readString(row.status);
    if (!attemptId || !registrationId || !status) {
      return [];
    }

    return [{
      attemptId,
      registrationId,
      status,
      score: readNumber(row.final_score) ?? readNumber(row.raw_score),
      startedAt: readString(row.started_at),
      lastHeartbeatAt: readString(row.updated_at),
      offenseCount: readNumber(row.offense_count) ?? 0,
    }];
  });
}

async function fetchMonitoringTimeline(admin: AdminClient, competitionId: string): Promise<MonitoringTimelineEvent[]> {
  const { data, error } = await admin
    .from("competition_events")
    .select("id, competition_id, event_type, control_action, actor_user_id, happened_at, request_idempotency_token, payload_json, metadata_json")
    .eq("competition_id", competitionId)
    .order("happened_at", { ascending: false })
    .limit(100);

  if (error && isMonitoringMissingTableError(error)) {
    return [];
  }

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.flatMap((row: Record<string, unknown>) => mapMonitoringTimelineEvent(row) ?? []);
}

export function statusesForAnnouncementAudience(audience: MonitoringAnnouncementAudience): MonitoringRegistrationStatus[] {
  switch (audience) {
    case "registered_only":
      return ["registered"];
    case "registered_and_ineligible":
      return ["registered", "ineligible"];
    case "all_non_cancelled":
      return ["registered", "ineligible", "withdrawn"];
    case "operators_only":
      return [];
  }
}

export async function sendCompetitionAnnouncement(input: {
  admin: AdminClient;
  competitionId: string;
  actorUserId: string;
  title: string;
  body: string;
  audience: MonitoringAnnouncementAudience;
}) {
  const { data, error } = await input.admin
    .from("competition_announcements")
    .insert({
      competition_id: input.competitionId,
      actor_user_id: input.actorUserId,
      title: input.title,
      body: input.body,
      audience: input.audience,
    })
    .select("id, competition_id, title, body, audience")
    .maybeSingle();

  if (error) {
    return { announcement: null, dispatchCount: 0, error } as const;
  }

  const announcement = firstRow(data as AnnouncementRow | AnnouncementRow[] | null);
  const announcementId = readString(announcement?.id);
  if (!announcementId) {
    return { announcement: null, dispatchCount: 0, error: { message: "Announcement insert returned no id." } } as const;
  }

  const statuses = statusesForAnnouncementAudience(input.audience);
  if (statuses.length === 0) {
    return { announcement, dispatchCount: 0, error: null } as const;
  }

  const recipientsResult = await input.admin
    .from("competition_registrations")
    .select("id, profile_id, team_id, status")
    .eq("competition_id", input.competitionId)
    .in("status", statuses);

  if (recipientsResult.error) {
    return { announcement, dispatchCount: 0, error: recipientsResult.error } as const;
  }

  const recipients = Array.isArray(recipientsResult.data) ? recipientsResult.data as RegistrationRecipientRow[] : [];
  const teamIds = Array.from(new Set(recipients.map((recipient) => readString(recipient.team_id)).filter((teamId): teamId is string => Boolean(teamId))));
  const teamRecipientsByTeamId = new Map<string, string[]>();

  if (teamIds.length > 0) {
    const teamRecipientsResult = await input.admin
      .from("team_memberships")
      .select("team_id, profile_id")
      .eq("is_active", true)
      .in("team_id", teamIds);

    if (teamRecipientsResult.error) {
      return { announcement, dispatchCount: 0, error: teamRecipientsResult.error } as const;
    }

    for (const membership of (Array.isArray(teamRecipientsResult.data) ? teamRecipientsResult.data as TeamMembershipRecipientRow[] : [])) {
      const teamId = readString(membership.team_id);
      const profileId = readString(membership.profile_id);
      if (!teamId || !profileId) {
        continue;
      }
      const existing = teamRecipientsByTeamId.get(teamId) ?? [];
      existing.push(profileId);
      teamRecipientsByTeamId.set(teamId, existing);
    }
  }

  let dispatchCount = 0;
  let failedDispatchCount = 0;
  for (const recipient of recipients) {
    const registrationId = readString(recipient.id);
    const directRecipientId = readString(recipient.profile_id);
    const teamId = readString(recipient.team_id);
    const recipientIds = directRecipientId
      ? [directRecipientId]
      : teamId
        ? teamRecipientsByTeamId.get(teamId) ?? []
        : [];

    if (!registrationId || recipientIds.length === 0) {
      continue;
    }

    for (const recipientId of recipientIds) {
      const dispatchResult = await dispatchCompetitionNotification({
        event: "competition_announcement_posted",
        eventIdentityKey: `announcement:${announcementId}:${registrationId}:${recipientId}`,
        recipientId,
        actorId: input.actorUserId,
        title: input.title,
        body: input.body,
        linkPath: `/mathlete/competition/${input.competitionId}/review`,
        competitionId: input.competitionId,
        registrationId,
        metadata: {
          announcementId,
          audience: input.audience,
          teamId,
        },
      });

      if (dispatchResult.ok) {
        dispatchCount += 1;
      } else {
        failedDispatchCount += 1;
      }
    }
  }

  if (failedDispatchCount > 0) {
    return {
      announcement,
      dispatchCount,
      error: { message: `${failedDispatchCount} announcement notification dispatches failed.` },
    } as const;
  }

  return { announcement, dispatchCount, error: null } as const;
}
