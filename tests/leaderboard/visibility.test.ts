import { describe, expect, test } from "vitest";
import { canParticipantViewLeaderboard } from "@/lib/leaderboard/visibility";
import type { CompetitionRecord } from "@/lib/competition/types";

function makeCompetition(overrides: Partial<CompetitionRecord> = {}): CompetitionRecord {
  return {
    id: "competition-1",
    organizerId: "organizer-1",
    leaderboardPublished: false,
    name: "Test Competition",
    description: "",
    instructions: "",
    type: "scheduled",
    format: "individual",
    status: "published",
    answerKeyVisibility: "after_end",
    registrationStart: null,
    registrationEnd: null,
    startTime: null,
    endTime: null,
    durationMinutes: 60,
    attemptsAllowed: 1,
    multiAttemptGradingMode: "highest_score",
    maxParticipants: 30,
    participantsPerTeam: null,
    maxTeams: null,
    scoringMode: "difficulty",
    customPointsByProblemId: {},
    penaltyMode: "none",
    deductionValue: 0,
    tieBreaker: "earliest_final_submission",
    shuffleQuestions: false,
    shuffleOptions: false,
    safeExamBrowserMode: "off",
    safeExamBrowserConfigKeyHashes: [],
    scoringSnapshotJson: null,
    draftRevision: 1,
    draftVersion: 1,
    isDeleted: false,
    publishedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("leaderboard visibility policy", () => {
  test("scheduled leaderboard requires participant context", () => {
    const decision = canParticipantViewLeaderboard({
      competition: makeCompetition({
        leaderboardPublished: true,
      }),
      hasParticipantContext: false,
    });

    expect(decision.canView).toBe(false);
    expect(decision.reason).toBe("participant_context_required");
  });

  test("scheduled leaderboard stays hidden before explicit publish", () => {
    const decision = canParticipantViewLeaderboard({
      competition: makeCompetition({
        leaderboardPublished: false,
      }),
      hasParticipantContext: true,
    });

    expect(decision.canView).toBe(false);
    expect(decision.reason).toBe("scheduled_unpublished");
  });

  test("open competitions bypass explicit publish gate after draft", () => {
    const decision = canParticipantViewLeaderboard({
      competition: makeCompetition({
        type: "open",
        status: "live",
      }),
      hasParticipantContext: true,
    });

    expect(decision.canView).toBe(true);
    expect(decision.reason).toBeNull();
  });
});
