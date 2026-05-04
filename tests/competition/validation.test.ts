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
    registrationTimingMode: "manual",
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

  test("default draft keeps Safe Exam Browser off until organizer enables it", () => {
    const draft = createDefaultCompetitionDraftState();

    expect(draft.safeExamBrowserMode).toBe("off");
    expect(draft.safeExamBrowserConfigKeyHashes).toEqual([]);
  });

  test("requires a 64-character Safe Exam Browser Config Key when strict mode is enabled", () => {
    const result = validateCompetitionDraftInput({
      ...buildScheduledTeamDraft(),
      safeExamBrowserMode: "required",
      safeExamBrowserConfigKeyHashes: [],
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "safeExamBrowserConfigKeyHashes",
        }),
      ]),
    );
  });

  test("accepts strict Safe Exam Browser mode with a valid Config Key", () => {
    const configKey = "a".repeat(64);
    const result = validateCompetitionDraftInput({
      ...buildScheduledTeamDraft(),
      safeExamBrowserMode: "required",
      safeExamBrowserConfigKeyHashes: [configKey],
    });

    expect(result.ok).toBe(true);
    expect(result.value?.safeExamBrowserMode).toBe("required");
    expect(result.value?.safeExamBrowserConfigKeyHashes).toEqual([configKey]);
  });

  test("default draft state uses scheduled default registration timing mode", () => {
    expect(createDefaultCompetitionDraftState().registrationTimingMode).toBe("default");
  });

  test("default draft state starts as individual competition without team capacity", () => {
    const draft = createDefaultCompetitionDraftState();

    expect(draft.format).toBe("individual");
    expect(draft.maxParticipants).toBe(3);
    expect(draft.participantsPerTeam).toBeNull();
    expect(draft.maxTeams).toBeNull();
  });

  test("requires competition start time for scheduled drafts", () => {
    const result = validateCompetitionDraftInput(createDefaultCompetitionDraftState());

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "startTime" }),
      ]),
    );
  });

  test("requires registration window fields only in manual registration timing mode", () => {
    const result = validateCompetitionDraftInput({
      ...createDefaultCompetitionDraftState(),
      type: "scheduled",
      registrationTimingMode: "manual",
      name: "Manual Registration Draft",
      description: "Manual window test",
      instructions: "Manual mode",
      startTime: "2026-04-05T09:00",
      durationMinutes: 60,
      selectedProblemIds: Array.from({ length: 10 }, (_, index) => `problem-${index + 1}`),
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "registrationStart" }),
        expect.objectContaining({ field: "registrationEnd" }),
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

  test("default registration mode keeps registration open until start", () => {
    const expectedStartIso = new Date("2026-04-05T09:00").toISOString();
    const expectedEndIso = new Date(new Date("2026-04-05T09:00").getTime() + 90 * 60_000).toISOString();

    const result = validateCompetitionDraftInput({
      ...createDefaultCompetitionDraftState(),
      type: "scheduled",
      registrationTimingMode: "default",
      name: "Default registration schedule",
      description: "Default registration timing",
      instructions: "Registration stays open until start.",
      startTime: "2026-04-05T09:00",
      durationMinutes: 90,
      selectedProblemIds: Array.from({ length: 10 }, (_, index) => `problem-${index + 1}`),
    });

    expect(result.ok).toBe(true);
    expect(result.value?.registrationStart).toBeNull();
    expect(result.value?.registrationEnd).toBe(expectedStartIso);
    expect(result.value?.endTime).toBe(expectedEndIso);
  });

  test("manual registration mode enforces end at or before competition start", () => {
    const result = validateCompetitionDraftInput({
      ...createDefaultCompetitionDraftState(),
      type: "scheduled",
      registrationTimingMode: "manual",
      name: "Manual conflict schedule",
      description: "Window conflict",
      instructions: "Registration must close before start.",
      registrationStart: "2026-04-05T07:00",
      registrationEnd: "2026-04-05T10:00",
      startTime: "2026-04-05T09:00",
      durationMinutes: 60,
      selectedProblemIds: Array.from({ length: 10 }, (_, index) => `problem-${index + 1}`),
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "registrationEnd",
          reason: "Registration must close at or before competition start.",
        }),
      ]),
    );
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
