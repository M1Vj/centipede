import {
  fetchCompetition,
  getRequestIdempotencyToken,
  jsonDatabaseError,
  jsonError,
  jsonOk,
  requireCompetitionAdminClient,
  requireOrganizerCompetitionActor,
  requireSameOriginMutation,
} from "@/app/api/organizer/competitions/_shared";
import { canViewAnswerKeySnapshot } from "@/lib/submission/visibility";
import { dispatchCompetitionNotification } from "@/lib/notifications/dispatch";
import type { CompetitionRecord } from "@/lib/competition/types";

type AdminClient = Extract<ReturnType<typeof requireCompetitionAdminClient>, { adminClient: unknown }>["adminClient"];
type RegistrationRow = {
  id: string;
  profile_id: string | null;
  team_id: string | null;
};
type TeamMembershipRow = {
  team_id: string;
  profile_id: string;
};
type AttemptRow = {
  registration_id: string;
  participant_profile_id: string | null;
  attempt_no: number;
  status: "in_progress" | "submitted" | "auto_submitted" | "disqualified" | "graded";
};

function addRecipient(recipients: Set<string>, profileId: string | null | undefined) {
  if (profileId) {
    recipients.add(profileId);
  }
}

async function resolveRegisteredRecipients(adminClient: AdminClient, registrations: RegistrationRow[]) {
  const recipients = new Set<string>();
  const teamIds = new Set<string>();

  for (const registration of registrations) {
    addRecipient(recipients, registration.profile_id);
    if (registration.team_id) {
      teamIds.add(registration.team_id);
    }
  }

  if (teamIds.size > 0) {
    const { data, error } = await adminClient
      .from("team_memberships")
      .select("team_id, profile_id")
      .in("team_id", Array.from(teamIds))
      .eq("is_active", true);

    if (error) {
      throw error;
    }

    for (const membership of (data ?? []) as TeamMembershipRow[]) {
      addRecipient(recipients, membership.profile_id);
    }
  }

  return recipients;
}

async function resolveEligibleAnswerKeyRecipients(
  adminClient: AdminClient,
  competition: CompetitionRecord,
  registrations: RegistrationRow[],
) {
  const registeredRecipients = await resolveRegisteredRecipients(adminClient, registrations);
  if (registeredRecipients.size === 0) {
    return [];
  }

  if (competition.type === "scheduled") {
    const visibility = canViewAnswerKeySnapshot({
      answerKeyVisibility: "after_end",
      competitionStatus: competition.status,
      competitionType: competition.type,
      competitionEndTime: competition.endTime,
      hasParticipantContext: true,
      attemptsAllowed: competition.attemptsAllowed,
    });

    return visibility.allowed ? Array.from(registeredRecipients) : [];
  }

  const registrationIds = registrations.map((registration) => registration.id);
  if (registrationIds.length === 0) {
    return [];
  }

  const { data, error } = await adminClient
    .from("competition_attempts")
    .select("registration_id, participant_profile_id, attempt_no, status")
    .eq("competition_id", competition.id)
    .in("registration_id", registrationIds)
    .order("attempt_no", { ascending: false });

  if (error) {
    throw error;
  }

  const latestAttemptsByParticipant = new Map<string, AttemptRow>();
  for (const attempt of (data ?? []) as AttemptRow[]) {
    if (!attempt.participant_profile_id || latestAttemptsByParticipant.has(attempt.participant_profile_id)) {
      continue;
    }

    latestAttemptsByParticipant.set(attempt.participant_profile_id, attempt);
  }

  return Array.from(registeredRecipients).filter((recipientId) => {
    const attempt = latestAttemptsByParticipant.get(recipientId);
    const visibility = canViewAnswerKeySnapshot({
      answerKeyVisibility: "after_end",
      competitionStatus: competition.status,
      competitionType: competition.type,
      competitionEndTime: competition.endTime,
      hasParticipantContext: true,
      attemptsAllowed: competition.attemptsAllowed,
      latestAttemptNo: attempt?.attempt_no ?? 0,
      latestAttemptStatus: attempt?.status ?? null,
    });

    return visibility.allowed;
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ competitionId: string }> },
) {
  const sameOriginError = requireSameOriginMutation(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const token = getRequestIdempotencyToken(request);
  if (!token) {
    return jsonError("request_idempotency_token_required", "Request idempotency token is required.", 400);
  }

  const actorResult = await requireOrganizerCompetitionActor();
  if ("response" in actorResult) {
    return actorResult.response;
  }

  const adminResult = requireCompetitionAdminClient();
  if ("response" in adminResult) {
    return adminResult.response;
  }

  const { competitionId } = await params;
  const competitionResult = await fetchCompetition(
    actorResult.supabase,
    competitionId,
    actorResult.actor.userId,
  );

  if ("response" in competitionResult) {
    return competitionResult.response;
  }

  const { competition } = competitionResult;
  if (competition.isDeleted) {
    return jsonError("not_found", "Requested resource was not found.", 404);
  }

  if (competition.status === "draft") {
    return jsonError("invalid_transition", "Draft competitions do not have a releasable answer key.", 409);
  }

  const { adminClient } = adminResult;
  const { data: registrations, error: registrationError } = await adminClient
    .from("competition_registrations")
    .select("id, profile_id, team_id")
    .eq("competition_id", competitionId)
    .eq("status", "registered");

  if (registrationError) {
    return jsonDatabaseError(registrationError);
  }

  if (competition.answerKeyVisibility === "hidden") {
    const updateResult = await adminClient
      .from("competitions")
      .update({ answer_key_visibility: "after_end" })
      .eq("id", competitionId)
      .eq("organizer_id", actorResult.actor.userId)
      .eq("answer_key_visibility", "hidden")
      .select("id")
      .maybeSingle();

    if (updateResult.error) {
      return jsonDatabaseError(updateResult.error);
    }
  }

  let recipientIds: string[];
  try {
    recipientIds = await resolveEligibleAnswerKeyRecipients(
      adminClient,
      { ...competition, answerKeyVisibility: "after_end" },
      (registrations ?? []) as RegistrationRow[],
    );
  } catch (error) {
    return jsonDatabaseError(error);
  }

  const notificationResults = await Promise.all(
    recipientIds.map((recipientId) =>
      dispatchCompetitionNotification({
        event: "answer_key_released",
        eventIdentityKey: `answer_key_released:${competitionId}:${recipientId}:${token}`,
        recipientId,
        actorId: actorResult.actor.userId,
        competitionId,
        title: "Answer key released",
        body: `${competition.name || "Competition"} answer key is now available.`,
        linkPath: `/mathlete/competition/${competitionId}/answer-key`,
        metadata: {
          releasedBy: actorResult.actor.userId,
          competitionType: competition.type,
        },
      }),
    ),
  );
  const notifiedCount = notificationResults.filter((result) => result.ok && !result.skipped).length;
  const notificationFailureCount = notificationResults.filter((result) => !result.ok).length;

  return jsonOk({
    code: "ok",
    competitionId,
    answerKeyVisibility: "after_end",
    changed: competition.answerKeyVisibility === "hidden",
    notifiedCount,
    notificationFailureCount,
  });
}
