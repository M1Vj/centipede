import { describe, expect, test } from "vitest";
import { mapCompetitionEventNotice } from "@/lib/competition/events";

describe("competition event notices", () => {
  test("maps schedule change notices", () => {
    const notice = mapCompetitionEventNotice({
      id: "event-1",
      event_type: "competition_schedule_changed",
      control_action: "update_schedule",
      happened_at: "2026-04-23T10:00:00.000Z",
      metadata_json: {
        summary: "The start time moved by 30 minutes.",
      },
    });

    expect(notice).toEqual({
      id: "event-1",
      title: "Schedule updated",
      message: "The start time moved by 30 minutes.",
      tone: "info",
      happenedAt: "2026-04-23T10:00:00.000Z",
    });
  });

  test("maps cancellation notices", () => {
    const notice = mapCompetitionEventNotice({
      id: "event-2",
      event_type: "competition_cancelled",
      control_action: "cancel_competition",
      happened_at: "2026-04-23T11:00:00.000Z",
      metadata_json: {},
    });

    expect(notice).toEqual({
      id: "event-2",
      title: "Competition cancelled",
      message: "This competition was cancelled by the organizer or system.",
      tone: "error",
      happenedAt: "2026-04-23T11:00:00.000Z",
    });
  });

  test("ignores unrelated events", () => {
    const notice = mapCompetitionEventNotice({
      id: "event-3",
      event_type: "competition_started",
      control_action: "start_competition",
      happened_at: "2026-04-23T12:00:00.000Z",
      metadata_json: null,
    });

    expect(notice).toBeNull();
  });
});