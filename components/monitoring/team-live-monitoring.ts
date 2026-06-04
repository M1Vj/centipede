import type { MonitoringAttemptSummary } from "@/components/monitoring/types";
import type { OrganizerRegistrationDetail } from "@/lib/registrations/types";

export type TeamLiveMonitoringRow = {
  registrationId: string;
  teamId: string | null;
  teamName: string;
  subtitle: string | null;
  status: OrganizerRegistrationDetail["status"];
  rosterCount: number;
  currentTotalScore: number;
  maxScore: number | null;
  activeAttemptCount: number;
  finishedAttemptCount: number;
  answeredCount: number | null;
  totalQuestions: number | null;
  progressPercent: number;
  lastSeenAt: string | null;
};

function newestDate(left: string | null, right: string | null) {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }

  return new Date(right).getTime() > new Date(left).getTime() ? right : left;
}

function compareAttemptRecency(left: MonitoringAttemptSummary, right: MonitoringAttemptSummary) {
  const leftAttemptNo = left.attemptNo ?? 0;
  const rightAttemptNo = right.attemptNo ?? 0;
  if (rightAttemptNo !== leftAttemptNo) {
    return rightAttemptNo - leftAttemptNo;
  }

  const leftDate = new Date(left.lastSeenAt ?? left.startedAt ?? 0).getTime();
  const rightDate = new Date(right.lastSeenAt ?? right.startedAt ?? 0).getTime();
  return rightDate - leftDate;
}

function currentAttemptsForScore(attempts: MonitoringAttemptSummary[]) {
  const byParticipant = new Map<string, MonitoringAttemptSummary[]>();
  const attemptsWithoutParticipant: MonitoringAttemptSummary[] = [];

  for (const attempt of attempts) {
    if (attempt.participantProfileId) {
      const existing = byParticipant.get(attempt.participantProfileId) ?? [];
      existing.push(attempt);
      byParticipant.set(attempt.participantProfileId, existing);
    } else {
      attemptsWithoutParticipant.push(attempt);
    }
  }

  const latestParticipantAttempts = Array.from(byParticipant.values()).map(
    (participantAttempts) => [...participantAttempts].sort(compareAttemptRecency)[0],
  );

  return [...latestParticipantAttempts, ...attemptsWithoutParticipant];
}

export function buildTeamLiveMonitoringRows(input: {
  registrations: OrganizerRegistrationDetail[];
  activeAttempts: MonitoringAttemptSummary[];
  finishedAttempts: MonitoringAttemptSummary[];
}): TeamLiveMonitoringRow[] {
  const activeAttemptsByRegistration = new Map<string, MonitoringAttemptSummary[]>();
  const finishedAttemptsByRegistration = new Map<string, MonitoringAttemptSummary[]>();

  for (const attempt of input.activeAttempts) {
    const attempts = activeAttemptsByRegistration.get(attempt.registrationId) ?? [];
    attempts.push(attempt);
    activeAttemptsByRegistration.set(attempt.registrationId, attempts);
  }

  for (const attempt of input.finishedAttempts) {
    const attempts = finishedAttemptsByRegistration.get(attempt.registrationId) ?? [];
    attempts.push(attempt);
    finishedAttemptsByRegistration.set(attempt.registrationId, attempts);
  }

  return input.registrations
    .filter((registration) => registration.participantType === "team" || registration.teamId)
    .map((registration) => {
      const activeAttempts = activeAttemptsByRegistration.get(registration.id) ?? [];
      const finishedAttempts = finishedAttemptsByRegistration.get(registration.id) ?? [];
      const attempts = [...activeAttempts, ...finishedAttempts];
      const currentAttempts = currentAttemptsForScore(attempts);
      const scoredAttempts = currentAttempts.filter((attempt) => attempt.score !== null);
      const maxScoredAttempts = currentAttempts.filter((attempt) => attempt.maxScore !== null);
      const answeredAttempts = currentAttempts.filter((attempt) => attempt.answeredCount !== null);
      const questionAttempts = currentAttempts.filter((attempt) => attempt.totalQuestions !== null);
      const currentTotalScore = scoredAttempts.reduce((total, attempt) => total + (attempt.score ?? 0), 0);
      const maxScore =
        maxScoredAttempts.length > 0
          ? maxScoredAttempts.reduce((total, attempt) => total + (attempt.maxScore ?? 0), 0)
          : null;
      const answeredCount =
        answeredAttempts.length > 0
          ? answeredAttempts.reduce((total, attempt) => total + (attempt.answeredCount ?? 0), 0)
          : null;
      const totalQuestions =
        questionAttempts.length > 0
          ? questionAttempts.reduce((total, attempt) => total + (attempt.totalQuestions ?? 0), 0)
          : null;
      const progressPercent =
        totalQuestions && answeredCount !== null
          ? Math.round((answeredCount / totalQuestions) * 100)
          : currentAttempts.length > 0
            ? Math.round(
                currentAttempts.reduce((total, attempt) => total + attempt.progressPercent, 0) /
                  currentAttempts.length,
              )
            : 0;
      const lastSeenAt = attempts.reduce<string | null>(
        (latest, attempt) => newestDate(latest, attempt.lastSeenAt),
        null,
      );

      return {
        registrationId: registration.id,
        teamId: registration.teamId,
        teamName: registration.displayName,
        subtitle: registration.subtitle,
        status: registration.status,
        rosterCount: registration.roster.length,
        currentTotalScore,
        maxScore,
        activeAttemptCount: activeAttempts.length,
        finishedAttemptCount: finishedAttempts.length,
        answeredCount,
        totalQuestions,
        progressPercent: Math.max(0, Math.min(100, progressPercent)),
        lastSeenAt,
      };
    })
    .sort((left, right) => {
      if (right.currentTotalScore !== left.currentTotalScore) {
        return right.currentTotalScore - left.currentTotalScore;
      }

      return left.teamName.localeCompare(right.teamName);
    });
}
