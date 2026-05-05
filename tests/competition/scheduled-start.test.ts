import { beforeEach, describe, expect, test, vi } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  endDueScheduledCompetitions,
  startDueScheduledCompetitions,
} from "@/lib/competition/scheduled-start";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("scheduled competition start helper and cron route", () => {
  test("startDueScheduledCompetitions starts each due scheduled competition with deterministic token", async () => {
    const dueAt = new Date("2026-04-25T06:10:00.000Z");
    const token = "scheduled-start:competition-1:2026-04-25T06:00:00.000Z";

    const orderCalls: Array<string> = [];
    const competitionsQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      lte: vi.fn(),
      order: vi.fn(),
    };
    competitionsQuery.select.mockImplementation(() => competitionsQuery);
    competitionsQuery.eq.mockImplementation((column: string, value: string) => {
      orderCalls.push(`${column}=${value}`);
      return competitionsQuery;
    });
    competitionsQuery.lte.mockImplementation((column: string, value: string) => {
      orderCalls.push(`${column}<=${value}`);
      return competitionsQuery;
    });
    competitionsQuery.order.mockResolvedValue({
      data: [
        {
          id: "competition-1",
          start_time: "2026-04-25T06:00:00.000Z",
        },
      ],
      error: null,
    });

    const rpc = vi.fn().mockResolvedValue({
      data: {
        machine_code: "ok",
        status: "live",
        event_id: "event-1",
        request_idempotency_token: token,
        replayed: false,
        changed: true,
      },
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "competitions") {
          throw new Error(`Unexpected table: ${table}`);
        }

        return competitionsQuery;
      }),
      rpc,
    } as never);

    const result = await startDueScheduledCompetitions(dueAt);

    expect(orderCalls).toHaveLength(4);
    expect(orderCalls).toEqual(expect.arrayContaining([
      "type=scheduled",
      "status=published",
      "is_deleted=false",
      "start_time<=2026-04-25T06:10:00.000Z",
    ]));
    expect(rpc).toHaveBeenCalledWith("start_competition", {
      p_competition_id: "competition-1",
      p_request_idempotency_token: token,
    });
    expect(result).toEqual({
      attempted: 1,
      started: 1,
      skipped: 0,
      results: [
        {
          competitionId: "competition-1",
          requestIdempotencyToken: token,
          machineCode: "ok",
          status: "live",
          replayed: false,
          changed: true,
          eventId: "event-1",
        },
      ],
    });
  });

  test("endDueScheduledCompetitions ends due scheduled competitions with the system timer token", async () => {
    const dueAt = new Date("2026-04-25T07:10:00.000Z");
    const token = "system_end:competition-1:2026-04-25T07:00:00.000Z";

    const competitionsQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
    };
    competitionsQuery.select.mockImplementation(() => competitionsQuery);
    competitionsQuery.eq.mockImplementation(() => competitionsQuery);
    competitionsQuery.in.mockImplementation(() => competitionsQuery);
    competitionsQuery.order.mockResolvedValue({
      data: [
        {
          id: "competition-1",
          end_time: "2026-04-25T07:00:00.000Z",
          start_time: "2026-04-25T06:00:00.000Z",
          duration_minutes: 60,
        },
        {
          id: "competition-2",
          end_time: "2026-04-25T07:30:00.000Z",
          start_time: "2026-04-25T06:30:00.000Z",
          duration_minutes: 60,
        },
      ],
      error: null,
    });

    const rpc = vi.fn().mockResolvedValue({
      data: {
        machine_code: "ok",
        status: "ended",
        event_id: "event-1",
        request_idempotency_token: token,
        replayed: false,
        changed: true,
      },
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "competitions") {
          throw new Error(`Unexpected table: ${table}`);
        }

        return competitionsQuery;
      }),
      rpc,
    } as never);

    const result = await endDueScheduledCompetitions(dueAt);

    expect(competitionsQuery.eq).toHaveBeenCalledWith("type", "scheduled");
    expect(competitionsQuery.in).toHaveBeenCalledWith("status", ["live", "paused"]);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("end_competition", {
      p_competition_id: "competition-1",
      p_request_idempotency_token: token,
      p_reason: null,
      p_transition_source: "system_timer",
    });
    expect(result).toEqual({
      attempted: 1,
      ended: 1,
      skipped: 0,
      results: [
        {
          competitionId: "competition-1",
          requestIdempotencyToken: token,
          machineCode: "ok",
          status: "ended",
          replayed: false,
          changed: true,
          eventId: "event-1",
        },
      ],
    });
  });
});
