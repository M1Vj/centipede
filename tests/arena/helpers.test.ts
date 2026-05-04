import { describe, expect, test } from "vitest";
import {
  computeRemainingSeconds,
  determineCompetitionPageMode,
  formatTimerText,
  normalizeArenaAnswerValue,
  resolveEffectiveCompetitionStatus,
  resolvePersistedAnswerStatusFlag,
} from "@/lib/arena/helpers";

describe("arena helpers", () => {
  test("resolves arena runtime before all other route modes", () => {
    expect(
      determineCompetitionPageMode({
        hasActiveAttempt: true,
        hasRegistration: true,
        registrationStatus: "registered",
        competitionStatus: "live",
        competitionType: "scheduled",
        attemptsRemaining: 1,
      }),
    ).toBe("arena_runtime");
  });

  test("ended competitions never resolve to interactive arena runtime", () => {
    expect(
      determineCompetitionPageMode({
        hasActiveAttempt: true,
        hasRegistration: true,
        registrationStatus: "registered",
        competitionStatus: "ended",
        competitionType: "scheduled",
        attemptsRemaining: 1,
      }),
    ).toBe("detail_register");
  });

  test("resolves pre-entry only for registered attempt-eligible competitions", () => {
    expect(
      determineCompetitionPageMode({
        hasActiveAttempt: false,
        hasRegistration: true,
        registrationStatus: "registered",
        competitionStatus: "live",
        competitionType: "scheduled",
        attemptsRemaining: 1,
      }),
    ).toBe("pre_entry");

    expect(
      determineCompetitionPageMode({
        hasActiveAttempt: false,
        hasRegistration: true,
        registrationStatus: "registered",
        competitionStatus: "ended",
        competitionType: "scheduled",
        attemptsRemaining: 1,
      }),
    ).toBe("detail_register");
  });

  test("treats due published scheduled competitions as effectively live until their end window", () => {
    expect(
      resolveEffectiveCompetitionStatus({
        status: "published",
        type: "scheduled",
        startTime: "2026-05-04T07:20:00.000Z",
        endTime: null,
        durationMinutes: 60,
        now: new Date("2026-05-04T07:21:00.000Z"),
      }),
    ).toBe("live");

    expect(
      resolveEffectiveCompetitionStatus({
        status: "published",
        type: "scheduled",
        startTime: "2026-05-04T07:20:00.000Z",
        endTime: null,
        durationMinutes: 60,
        now: new Date("2026-05-04T08:21:00.000Z"),
      }),
    ).toBe("ended");
  });

  test("allows open competitions to enter without a registration when attempts remain", () => {
    expect(
      determineCompetitionPageMode({
        hasActiveAttempt: false,
        hasRegistration: false,
        registrationStatus: null,
        competitionStatus: "published",
        competitionType: "open",
        attemptsRemaining: 1,
      }),
    ).toBe("pre_entry");

    expect(
      determineCompetitionPageMode({
        hasActiveAttempt: false,
        hasRegistration: false,
        registrationStatus: null,
        competitionStatus: "published",
        competitionType: "open",
        attemptsRemaining: 0,
      }),
    ).toBe("detail_register");
  });

  test("computes trusted remaining seconds from immutable deadline", () => {
    expect(
      computeRemainingSeconds("2026-04-22T12:00:10.000Z", new Date("2026-04-22T12:00:00.000Z")),
    ).toBe(10);
    expect(
      computeRemainingSeconds("2026-04-22T12:00:10.000Z", new Date("2026-04-22T12:00:15.000Z")),
    ).toBe(0);
  });

  test("keeps reset distinct and avoids solved on empty answers", () => {
    expect(resolvePersistedAnswerStatusFlag("numeric", "", "reset")).toBe("reset");
    expect(resolvePersistedAnswerStatusFlag("numeric", "", "solved")).toBe("blank");
    expect(resolvePersistedAnswerStatusFlag("numeric", "x+1", "solved")).toBe("solved");
    expect(resolvePersistedAnswerStatusFlag("mcq", "b", "blank")).toBe("filled");
    expect(resolvePersistedAnswerStatusFlag("numeric", "42", undefined)).toBe("filled");
    expect(resolvePersistedAnswerStatusFlag("tf", "true", "filled")).toBe("filled");
  });

  test("normalizes answer payloads by problem type", () => {
    expect(normalizeArenaAnswerValue("mcq", "opt_a")).toEqual({
      answerLatex: "",
      answerTextNormalized: "opt_a",
    });
    expect(normalizeArenaAnswerValue("tf", "Yes")).toEqual({
      answerLatex: "",
      answerTextNormalized: "true",
    });
    expect(normalizeArenaAnswerValue("identification", " Quadratic Formula ")).toEqual({
      answerLatex: " Quadratic Formula ",
      answerTextNormalized: "quadratic formula",
    });
  });

  test("formats timer text in fixed hh:mm:ss shape", () => {
    expect(formatTimerText(0)).toBe("00:00:00");
    expect(formatTimerText(65)).toBe("00:01:05");
    expect(formatTimerText(3661)).toBe("01:01:01");
  });
});
