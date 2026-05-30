import { describe, expect, test } from "vitest";
import {
  isOrganizerManagementCompetition,
  isOrganizerManagementCompetitionStatus,
} from "@/lib/competition/organizer-management";
import type { CompetitionRecord, CompetitionStatus } from "@/lib/competition/types";

function buildCompetition(
  status: CompetitionStatus,
  overrides: Partial<CompetitionRecord> = {},
): CompetitionRecord {
  return {
    id: `${status}-competition`,
    organizerId: "organizer-1",
    leaderboardPublished: false,
    name: `${status} competition`,
    description: "",
    instructions: "",
    type: "scheduled",
    format: "individual",
    status,
    answerKeyVisibility: "after_end",
    registrationStart: null,
    registrationEnd: null,
    startTime: null,
    endTime: null,
    durationMinutes: 60,
    attemptsAllowed: 1,
    multiAttemptGradingMode: "highest_score",
    maxParticipants: null,
    participantsPerTeam: null,
    maxTeams: null,
    scoringMode: "difficulty",
    customPointsByProblemId: {},
    penaltyMode: "none",
    deductionValue: 0,
    tieBreaker: "earliest_final_submission",
    shuffleQuestions: false,
    shuffleOptions: false,
    logTabSwitch: false,
    offensePenalties: [],
    safeExamBrowserMode: "off",
    safeExamBrowserConfigKeyHashes: [],
    scoringSnapshotJson: null,
    draftRevision: 1,
    draftVersion: 1,
    isDeleted: false,
    publishedAt: null,
    createdAt: "2026-04-15T00:00:00.000Z",
    updatedAt: "2026-04-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("organizer competition management filters", () => {
  test("keeps draft, published, live, paused, and ended competitions in management", () => {
    expect(isOrganizerManagementCompetitionStatus("draft")).toBe(true);
    expect(isOrganizerManagementCompetitionStatus("published")).toBe(true);
    expect(isOrganizerManagementCompetitionStatus("live")).toBe(true);
    expect(isOrganizerManagementCompetitionStatus("paused")).toBe(true);
    expect(isOrganizerManagementCompetitionStatus("ended")).toBe(true);
  });

  test("moves archived competitions out of management", () => {
    expect(isOrganizerManagementCompetitionStatus("archived")).toBe(false);
  });

  test("excludes deleted competitions even when their lifecycle status is manageable", () => {
    expect(
      isOrganizerManagementCompetition(
        buildCompetition("published", { isDeleted: true }),
      ),
    ).toBe(false);
  });
});
