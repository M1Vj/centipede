import { describe, expect, test } from "vitest";
import { buildMathleteDashboardCards } from "@/lib/mathlete/dashboard-cards";
import type { RegistrationDetail } from "@/lib/registrations/types";

function makeRegistration(input: {
  id: string;
  competitionId: string;
  competitionName: string;
  competitionStatus: string;
  startTime: string | null;
  endTime?: string | null;
  durationMinutes?: number;
}): RegistrationDetail {
  return {
    id: input.id,
    competition_id: input.competitionId,
    team_id: null,
    status: "registered",
    status_reason: null,
    registered_at: "2026-05-04T06:00:00.000Z",
    updated_at: "2026-05-04T06:00:00.000Z",
    competition: {
      id: input.competitionId,
      name: input.competitionName,
      type: "scheduled",
      format: "individual",
      status: input.competitionStatus,
      startTime: input.startTime,
      endTime: input.endTime ?? null,
      durationMinutes: input.durationMinutes ?? 60,
      registrationStart: "2026-05-03T00:00:00.000Z",
    },
  };
}

describe("mathlete dashboard card mapping", () => {
  test("moves a registered published scheduled competition from upcoming to live once its start time passes", () => {
    const cards = buildMathleteDashboardCards(
      [
        makeRegistration({
          id: "registration-1",
          competitionId: "competition-1",
          competitionName: "May Timed Challenge",
          competitionStatus: "published",
          startTime: "2026-05-04T07:20:00.000Z",
          durationMinutes: 90,
        }),
      ],
      new Date("2026-05-04T07:21:00.000Z").getTime(),
    );

    expect(cards.liveCards).toEqual([
      expect.objectContaining({
        id: "competition-1",
        title: "May Timed Challenge",
        action: "Enter Arena",
      }),
    ]);
    expect(cards.upcomingCards).toEqual([]);
    expect(cards.registrationCards).toHaveLength(1);
  });

  test("keeps a registered published scheduled competition upcoming before its start time", () => {
    const cards = buildMathleteDashboardCards(
      [
        makeRegistration({
          id: "registration-1",
          competitionId: "competition-1",
          competitionName: "May Timed Challenge",
          competitionStatus: "published",
          startTime: "2026-05-04T07:20:00.000Z",
          durationMinutes: 90,
        }),
      ],
      new Date("2026-05-04T07:19:00.000Z").getTime(),
    );

    expect(cards.liveCards).toEqual([]);
    expect(cards.upcomingCards).toEqual([
      expect.objectContaining({
        id: "competition-1",
        title: "May Timed Challenge",
      }),
    ]);
  });

  test("removes registered scheduled competitions after their explicit or derived end time", () => {
    const cards = buildMathleteDashboardCards(
      [
        makeRegistration({
          id: "registration-1",
          competitionId: "derived-ended",
          competitionName: "Derived End",
          competitionStatus: "published",
          startTime: "2026-05-04T07:20:00.000Z",
          durationMinutes: 30,
        }),
        makeRegistration({
          id: "registration-2",
          competitionId: "explicit-ended",
          competitionName: "Explicit End",
          competitionStatus: "live",
          startTime: "2026-05-04T07:20:00.000Z",
          endTime: "2026-05-04T07:50:00.000Z",
          durationMinutes: 90,
        }),
      ],
      new Date("2026-05-04T07:51:00.000Z").getTime(),
    );

    expect(cards.liveCards).toEqual([]);
    expect(cards.upcomingCards).toEqual([]);
    expect(cards.registrationCards).toEqual([]);
  });
});
