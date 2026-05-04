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
        competitionEndTime: "2026-05-01T00:00:00.000Z",
        hasParticipantContext: true,
        now: new Date("2026-05-02T00:00:00.000Z"),
      }),
    ).toEqual({ allowed: true, reason: "allowed" });
  });

  test("does not use leaderboard publication as answer-key permission", () => {
    expect(
      canViewAnswerKeySnapshot({
        answerKeyVisibility: "after_end",
        competitionStatus: "live",
        competitionEndTime: "2026-05-01T00:00:00.000Z",
        hasParticipantContext: true,
        leaderboardPublished: true,
        now: new Date("2026-05-02T00:00:00.000Z"),
      }),
    ).toEqual({ allowed: false, reason: "competition_not_ended" });
  });
});
