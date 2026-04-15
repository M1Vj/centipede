import { describe, expect, test } from "vitest";
import {
  buildCompetitionScoringSnapshot,
  createDefaultCompetitionDraftState,
  validateCompetitionDraftInput,
  validateCompetitionPublishReadiness,
} from "@/lib/competition/validation";
import type { CompetitionDraftFormState } from "@/lib/competition/types";

function buildOpenDraft(): CompetitionDraftFormState {
  return {
    ...createDefaultCompetitionDraftState(),
    type: "open",
    format: "individual",
    name: "Open Winter Invitational",
    description: "A high-visibility open competition for organizer QA.",
    instructions: "No external resources. Submit before time expires.",
    durationMinutes: 120,
    attemptsAllowed: 3,
    multiAttemptGradingMode: "latest_score",
    maxParticipants: 42,
    participantsPerTeam: null,
    maxTeams: null,
    scoringMode: "custom",
    customPointsByProblemId: {
      problem_a: 5,
      problem_b: 7,
    },
    penaltyMode: "fixed_deduction",
    deductionValue: 2,
    tieBreaker: "lowest_total_time",
    shuffleQuestions: true,
    shuffleOptions: true,
    logTabSwitch: true,
    offensePenalties: [
      {
        threshold: 2,
        penaltyKind: "warning",
        deductionValue: 0,
      },
    ],
    answerKeyVisibility: "after_end",
    selectedProblemIds: Array.from({ length: 10 }, (_, index) => `problem-${index + 1}`),
  };
}

function buildScheduledTeamDraft(): CompetitionDraftFormState {
  return {
    ...createDefaultCompetitionDraftState(),
    type: "scheduled",
    format: "team",
    name: "Scheduled Team Finals",
    description: "Timed team competition with fixed registration windows.",
    instructions: "Teams share one attempt and one answer sheet.",
    registrationStart: "2026-04-01T09:00",
    registrationEnd: "2026-04-02T09:00",
    startTime: "2026-04-05T09:00",
    endTime: "2026-04-05T12:00",
    durationMinutes: 180,
    attemptsAllowed: 1,
    participantsPerTeam: 3,
    maxTeams: 12,
    maxParticipants: null,
    multiAttemptGradingMode: "highest_score",
    selectedProblemIds: Array.from({ length: 10 }, (_, index) => `problem-${index + 1}`),
  };
}

describe("competition draft validation", () => {
  test("default draft state preserves after_end answer key visibility", () => {
    expect(createDefaultCompetitionDraftState().answerKeyVisibility).toBe("after_end");
  });

  test("default draft state starts as individual competition without team capacity", () => {
    const draft = createDefaultCompetitionDraftState();

    expect(draft.format).toBe("individual");
    expect(draft.maxParticipants).toBe(3);
    expect(draft.participantsPerTeam).toBeNull();
    expect(draft.maxTeams).toBeNull();
  });

  test("requires schedule windows and competition start time for scheduled drafts", () => {
    const result = validateCompetitionDraftInput(createDefaultCompetitionDraftState());

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "registrationStart" }),
        expect.objectContaining({ field: "registrationEnd" }),
        expect.objectContaining({ field: "startTime" }),
      ]),
    );
  });

  test("accepts open draft with valid capacity and scoring rules", () => {
    const result = validateCompetitionDraftInput(buildOpenDraft());

    expect(result.ok).toBe(true);
    expect(result.value?.type).toBe("open");
    expect(result.value?.multiAttemptGradingMode).toBe("latest_score");
    expect(result.value?.selectedProblemIds).toHaveLength(10);
  });

  test("accepts scheduled team draft when team capacity rules are satisfied", () => {
    const result = validateCompetitionDraftInput(buildScheduledTeamDraft());

    expect(result.ok).toBe(true);
    expect(result.value?.type).toBe("scheduled");
    expect(result.value?.format).toBe("team");
    expect(result.value?.participantsPerTeam).toBe(3);
    expect(result.value?.maxTeams).toBe(12);
  });

  test("rejects publish readiness when fewer than 10 problems are selected", () => {
    const result = validateCompetitionPublishReadiness({
      ...buildOpenDraft(),
      selectedProblemIds: Array.from({ length: 9 }, (_, index) => `problem-${index + 1}`),
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "selectedProblemIds",
        }),
      ]),
    );
  });

  test("builds scoring snapshot from validated draft payload", () => {
    const validation = validateCompetitionDraftInput(buildOpenDraft());
    expect(validation.ok).toBe(true);
    if (!validation.ok || !validation.value) {
      return;
    }

    const snapshot = buildCompetitionScoringSnapshot(validation.value);

    expect(snapshot.ok).toBe(true);
    expect(snapshot.value?.multiAttemptGradingMode).toBe("latest_score");
    expect(snapshot.value?.customPointsByProblemId).toEqual({
      problem_a: 5,
      problem_b: 7,
    });
  });
});
