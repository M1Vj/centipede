import { describe, expect, test } from "vitest";
import { canViewAnswerKeySnapshot } from "@/lib/submission/visibility";

describe("answer-key visibility helpers", () => {
  test("hides snapshots when organizer sets answer key visibility to hidden", () => {
    expect(
      canViewAnswerKeySnapshot({
        answerKeyVisibility: "hidden",
        competitionStatus: "ended",
        competitionEndTime: "2026-05-01T00:00:00.000Z",
        hasParticipantContext: true,
        now: new Date("2026-05-02T00:00:00.000Z"),
      }),
    ).toEqual({ allowed: false, reason: "hidden" });
  });

  test("allows participant snapshots after explicit end state and server end time", () => {
    expect(
      canViewAnswerKeySnapshot({
        answerKeyVisibility: "after_end",
        competitionStatus: "ended",
        competitionType: "scheduled",
        competitionEndTime: "2026-05-01T00:00:00.000Z",
        hasParticipantContext: true,
        now: new Date("2026-05-02T00:00:00.000Z"),
      }),
    ).toEqual({ allowed: true, reason: "allowed" });
  });

  test("allows manually ended scheduled snapshots even when original end time is still in the future", () => {
    expect(
      canViewAnswerKeySnapshot({
        answerKeyVisibility: "after_end",
        competitionStatus: "ended",
        competitionType: "scheduled",
        competitionEndTime: "2026-05-03T00:00:00.000Z",
        hasParticipantContext: true,
        now: new Date("2026-05-02T00:00:00.000Z"),
      }),
    ).toEqual({ allowed: true, reason: "allowed" });
  });

  test("allows scheduled snapshots once end time passes even before lifecycle status catches up", () => {
    expect(
      canViewAnswerKeySnapshot({
        answerKeyVisibility: "after_end",
        competitionStatus: "live",
        competitionType: "scheduled",
        competitionEndTime: "2026-05-01T00:00:00.000Z",
        hasParticipantContext: true,
        now: new Date("2026-05-02T00:00:00.000Z"),
      }),
    ).toEqual({ allowed: true, reason: "allowed" });
  });

  test("keeps open competition answer keys hidden until the max retake is consumed", () => {
    expect(
      canViewAnswerKeySnapshot({
        answerKeyVisibility: "after_end",
        competitionStatus: "live",
        competitionType: "open",
        competitionEndTime: null,
        hasParticipantContext: true,
        attemptsAllowed: 3,
        latestAttemptNo: 2,
        latestAttemptStatus: "submitted",
      }),
    ).toEqual({ allowed: false, reason: "attempts_remaining" });
  });

  test("allows open competition answer keys after final completed attempt", () => {
    expect(
      canViewAnswerKeySnapshot({
        answerKeyVisibility: "after_end",
        competitionStatus: "live",
        competitionType: "open",
        competitionEndTime: null,
        hasParticipantContext: true,
        attemptsAllowed: 3,
        latestAttemptNo: 3,
        latestAttemptStatus: "submitted",
      }),
    ).toEqual({ allowed: true, reason: "allowed" });
  });

  test("blocks open competition answer keys while latest attempt is in progress", () => {
    expect(
      canViewAnswerKeySnapshot({
        answerKeyVisibility: "after_end",
        competitionStatus: "live",
        competitionType: "open",
        competitionEndTime: null,
        hasParticipantContext: true,
        attemptsAllowed: 1,
        latestAttemptNo: 1,
        latestAttemptStatus: "in_progress",
      }),
    ).toEqual({ allowed: false, reason: "attempt_in_progress" });
  });

  test("does not use leaderboard publication as answer-key permission", () => {
    expect(
      canViewAnswerKeySnapshot({
        answerKeyVisibility: "after_end",
        competitionStatus: "live",
        competitionEndTime: "2026-05-03T00:00:00.000Z",
        hasParticipantContext: true,
        leaderboardPublished: true,
        now: new Date("2026-05-02T00:00:00.000Z"),
      }),
    ).toEqual({ allowed: false, reason: "end_time_not_reached" });
  });
});
