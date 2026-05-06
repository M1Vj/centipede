import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "@/app/organizer/competition/[competitionId]/exports/[exportJobId]/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

const COMPETITION_ID = "competition-1";
const EXPORT_JOB_ID = "export-1";
const ORGANIZER_ID = "organizer-1";

function chainQuery(data: unknown, error: unknown = null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

function makeClient(role: "organizer" | "mathlete" | "admin" = "organizer") {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: { id: ORGANIZER_ID },
        },
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return chainQuery({
          id: ORGANIZER_ID,
          role,
          is_active: true,
        });
      }

      if (table === "competitions") {
        return chainQuery({
          id: COMPETITION_ID,
          organizer_id: ORGANIZER_ID,
          is_deleted: false,
        });
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function makeAdminClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === "export_jobs") {
        return chainQuery({
          id: EXPORT_JOB_ID,
          competition_id: COMPETITION_ID,
          requested_by: ORGANIZER_ID,
          format: "csv",
          scope: "leaderboard_history",
          status: "completed",
          storage_path: "competition-1/results/export-1.csv",
          error_message: null,
          request_idempotency_token: "idem-token-123",
          created_at: "2026-05-01T00:00:00.000Z",
          updated_at: "2026-05-01T00:00:00.000Z",
          completed_at: "2026-05-01T00:05:00.000Z",
        });
      }

      throw new Error(`Unexpected admin table: ${table}`);
    }),
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: {
            signedUrl: "https://storage.example/signed-export",
          },
          error: null,
        }),
      })),
    },
  };
}

describe("export job status and download route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns signed download URL for completed owner-scoped export without leaking storage path", async () => {
    vi.mocked(createClient).mockResolvedValue(makeClient("organizer") as never);
    vi.mocked(createAdminClient).mockReturnValue(makeAdminClient() as never);

    const response = await GET(
      new Request(`http://localhost:3000/organizer/competition/${COMPETITION_ID}/exports/${EXPORT_JOB_ID}`),
      { params: Promise.resolve({ competitionId: COMPETITION_ID, exportJobId: EXPORT_JOB_ID }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.job.status).toBe("completed");
    expect(body.job.downloadUrl).toBe("https://storage.example/signed-export");
    expect(JSON.stringify(body)).not.toContain("competition-1/results/export-1.csv");
  });

  test("denies participant access even when export job id is known", async () => {
    vi.mocked(createClient).mockResolvedValue(makeClient("mathlete") as never);
    vi.mocked(createAdminClient).mockReturnValue(makeAdminClient() as never);

    const response = await GET(
      new Request(`http://localhost:3000/organizer/competition/${COMPETITION_ID}/exports/${EXPORT_JOB_ID}`),
      { params: Promise.resolve({ competitionId: COMPETITION_ID, exportJobId: EXPORT_JOB_ID }) },
    );

    expect(response.status).toBe(403);
  });
});
