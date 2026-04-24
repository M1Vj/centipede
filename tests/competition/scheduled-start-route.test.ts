import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "@/app/api/cron/competitions/start-due/route";
import { startDueScheduledCompetitions } from "@/lib/competition/scheduled-start";

vi.mock("@/lib/competition/scheduled-start", () => ({
  startDueScheduledCompetitions: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function setCronSecret(value: string | undefined) {
  if (value === undefined) {
    delete process.env.CRON_SECRET;
    return;
  }

  process.env.CRON_SECRET = value;
}

describe("cron route for due scheduled competitions", () => {
  test.each([
    ["missing", undefined],
    ["blank", "   "],
  ])("fails closed with 503 when CRON_SECRET is %s", async (_, cronSecret) => {
    const previousCronSecret = process.env.CRON_SECRET;
    setCronSecret(cronSecret);
    const helper = vi.mocked(startDueScheduledCompetitions);

    try {
      const request = new Request("http://localhost:3000/api/cron/competitions/start-due", {
        method: "GET",
      });

      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.code).toBe("service_unavailable");
      expect(helper).not.toHaveBeenCalled();
    } finally {
      setCronSecret(previousCronSecret);
    }
  });

  test("rejects request without bearer token when CRON_SECRET is configured", async () => {
    const previousCronSecret = process.env.CRON_SECRET;
    setCronSecret("cron-secret");

    try {
      const request = new Request("http://localhost:3000/api/cron/competitions/start-due", {
        method: "GET",
      });

      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.code).toBe("unauthorized");
    } finally {
      setCronSecret(previousCronSecret);
    }
  });

  test("calls helper with current time when bearer token matches configured secret", async () => {
    const previousCronSecret = process.env.CRON_SECRET;
    setCronSecret("cron-secret");
    const helper = vi.mocked(startDueScheduledCompetitions);
    helper.mockResolvedValue({
      attempted: 1,
      started: 1,
      skipped: 0,
      results: [],
    } as never);

    try {
      const request = new Request("http://localhost:3000/api/cron/competitions/start-due", {
        method: "GET",
        headers: {
          authorization: "Bearer cron-secret",
        },
      });

      const response = await GET(request);
      const body = await response.json();

      expect(helper).toHaveBeenCalledTimes(1);
      expect(helper.mock.calls[0]?.[0]).toBeInstanceOf(Date);
      expect(response.status).toBe(200);
      expect(body.attempted).toBe(1);
      expect(body.started).toBe(1);
    } finally {
      setCronSecret(previousCronSecret);
    }
  });
});
