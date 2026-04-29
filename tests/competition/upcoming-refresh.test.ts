import { describe, expect, test } from "vitest";
import { getUpcomingCompetitionRefreshDelayMs } from "@/lib/competition/upcoming-refresh";

describe("upcoming competition refresh timing", () => {
  test("uses the earliest valid timestamp even when cards are unsorted", () => {
    const now = new Date("2026-04-29T10:00:00.000Z").getTime();

    const delayMs = getUpcomingCompetitionRefreshDelayMs(
      [
        { timestamp: "2026-04-29T10:05:00.000Z" },
        { timestamp: null },
        { timestamp: "invalid" },
        { timestamp: "2026-04-29T10:01:30.000Z" },
      ],
      now,
    );

    expect(delayMs).toBe(90_000);
  });

  test("returns an immediate refresh delay once the next competition is due", () => {
    const now = new Date("2026-04-29T10:00:00.000Z").getTime();

    const delayMs = getUpcomingCompetitionRefreshDelayMs(
      [{ timestamp: "2026-04-29T09:59:59.000Z" }],
      now,
    );

    expect(delayMs).toBe(0);
  });

  test("returns null when no valid timestamps are available", () => {
    const delayMs = getUpcomingCompetitionRefreshDelayMs(
      [{ timestamp: null }, { timestamp: "invalid" }],
      new Date("2026-04-29T10:00:00.000Z").getTime(),
    );

    expect(delayMs).toBeNull();
  });
});