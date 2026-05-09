import { describe, expect, test } from "vitest";
import { buildTeamLiveMonitoringRows } from "@/components/monitoring/team-live-monitoring";
import type { MonitoringAttemptSummary } from "@/components/monitoring/types";
import type { OrganizerRegistrationDetail } from "@/lib/registrations/types";

function registration(overrides: Partial<OrganizerRegistrationDetail> = {}): OrganizerRegistrationDetail {
  return {
    id: "registration-1",
    competitionId: "competition-1",
    profileId: null,
    teamId: "team-1",
    participantType: "team",
    displayName: "Euler Squad",
    subtitle: "TEAMCODE01 / 2 members",
    status: "registered",
    statusReason: null,
    registeredAt: "2026-05-09T08:00:00.000Z",
    updatedAt: "2026-05-09T08:00:00.000Z",
    roster: [
      { profileId: "profile-1", fullName: "Ada Lovelace", school: null, gradeLevel: null, role: "leader" },
      { profileId: "profile-2", fullName: "Grace Hopper", school: null, gradeLevel: null, role: "member" },
    ],
    ...overrides,
  };
}

function attempt(overrides: Partial<MonitoringAttemptSummary> = {}): MonitoringAttemptSummary {
  return {
    attemptId: "attempt-1",
    registrationId: "registration-1",
    displayName: "Euler Squad",
    status: "in_progress",
    score: 12,
    maxScore: 20,
    startedAt: "2026-05-09T08:05:00.000Z",
    lastSeenAt: "2026-05-09T08:10:00.000Z",
    elapsedSeconds: 300,
    remainingSeconds: 3300,
    offenseCount: 0,
    answeredCount: 3,
    totalQuestions: 10,
    progressPercent: 30,
    riskLevel: "low",
    ...overrides,
  };
}

describe("buildTeamLiveMonitoringRows", () => {
  test("aggregates each team's current total score from active and finished attempts", () => {
    const rows = buildTeamLiveMonitoringRows({
      registrations: [
        registration(),
        registration({
          id: "registration-2",
          teamId: "team-2",
          displayName: "Noether Team",
          subtitle: null,
          roster: [],
        }),
      ],
      activeAttempts: [
        attempt({ attemptId: "attempt-1", score: 12, maxScore: 20, answeredCount: 3, totalQuestions: 10 }),
        attempt({ attemptId: "attempt-2", score: 8, maxScore: 20, answeredCount: 4, totalQuestions: 10 }),
        attempt({
          attemptId: "attempt-3",
          registrationId: "registration-2",
          displayName: "Noether Team",
          score: 17,
          maxScore: 20,
        }),
      ],
      finishedAttempts: [
        attempt({
          attemptId: "attempt-4",
          status: "submitted",
          score: 21,
          maxScore: 25,
          offenseCount: 1,
          answeredCount: 5,
          totalQuestions: 5,
          progressPercent: 100,
          lastSeenAt: "2026-05-09T08:20:00.000Z",
        }),
      ],
    });

    expect(rows[0]).toMatchObject({
      registrationId: "registration-1",
      teamName: "Euler Squad",
      currentTotalScore: 41,
      maxScore: 65,
      activeAttemptCount: 2,
      finishedAttemptCount: 1,
      offenseCount: 1,
      answeredCount: 12,
      totalQuestions: 25,
      progressPercent: 48,
      lastSeenAt: "2026-05-09T08:20:00.000Z",
    });
    expect(rows[1]).toMatchObject({
      registrationId: "registration-2",
      currentTotalScore: 17,
    });
  });

  test("keeps registered teams visible before attempts start", () => {
    const rows = buildTeamLiveMonitoringRows({
      registrations: [registration()],
      activeAttempts: [],
      finishedAttempts: [],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      currentTotalScore: 0,
      maxScore: null,
      activeAttemptCount: 0,
      finishedAttemptCount: 0,
      progressPercent: 0,
      lastSeenAt: null,
    });
  });

  test("uses only the latest attempt per team member when participant identity is available", () => {
    const rows = buildTeamLiveMonitoringRows({
      registrations: [registration()],
      activeAttempts: [
        attempt({
          attemptId: "attempt-current",
          participantProfileId: "profile-1",
          attemptNo: 2,
          score: 14,
          maxScore: 20,
          lastSeenAt: "2026-05-09T08:30:00.000Z",
        }),
      ],
      finishedAttempts: [
        attempt({
          attemptId: "attempt-old",
          participantProfileId: "profile-1",
          attemptNo: 1,
          status: "submitted",
          score: 9,
          maxScore: 20,
          lastSeenAt: "2026-05-09T08:20:00.000Z",
        }),
        attempt({
          attemptId: "attempt-profile-2",
          participantProfileId: "profile-2",
          attemptNo: 1,
          status: "submitted",
          score: 11,
          maxScore: 20,
          lastSeenAt: "2026-05-09T08:22:00.000Z",
        }),
      ],
    });

    expect(rows[0]).toMatchObject({
      currentTotalScore: 25,
      maxScore: 40,
      activeAttemptCount: 1,
      finishedAttemptCount: 2,
    });
  });
});
