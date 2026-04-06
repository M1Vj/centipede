import { describe, expect, test, vi } from "vitest";
import { GET, POST } from "@/app/api/organizer/problem-banks/import/route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

function createSelectBuilder(result: unknown) {
  const builder = {
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
  };

  return builder;
}

function mockClientForImport(options: {
  profileResult: { data: unknown; error: unknown };
  bankResult?: { data: unknown; error: unknown };
  jobResult?: { data: unknown; error: unknown };
}) {
  const profileBuilder = createSelectBuilder(options.profileResult);
  const bankBuilder = createSelectBuilder(
    options.bankResult ?? { data: null, error: null },
  );
  const jobBuilder = createSelectBuilder(
    options.jobResult ?? { data: null, error: null },
  );

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "organizer-1" } } }),
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => profileBuilder),
        };
      }

      if (table === "problem_banks") {
        return {
          select: vi.fn(() => bankBuilder),
        };
      }

      if (table === "problem_import_jobs") {
        return {
          select: vi.fn(() => jobBuilder),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
        };
      }

      if (table === "problems") {
        return {
          insert: vi.fn(async () => ({ error: null })),
        };
      }

      return {
        select: vi.fn(() => createSelectBuilder({ data: null, error: null })),
      };
    }),
  };

  vi.mocked(createClient).mockResolvedValue(client as never);
  return client;
}

describe("problem-bank import route", () => {
  test("GET returns deterministic CSV template payload", async () => {
    mockClientForImport({
      profileResult: {
        data: { id: "organizer-1", role: "organizer", is_active: true },
        error: null,
      },
    });

    const response = await GET();
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(text).toContain("type,difficulty,tags,content_latex");
  });

  test("POST returns completed summary for idempotent replay", async () => {
    mockClientForImport({
      profileResult: {
        data: { id: "organizer-1", role: "organizer", is_active: true },
        error: null,
      },
      bankResult: {
        data: {
          id: "bank-1",
          organizer_id: "organizer-1",
          name: "Algebra",
          description: "",
          is_default_bank: false,
          is_visible_to_organizers: false,
          is_deleted: false,
          created_at: "2026-04-06T00:00:00.000Z",
          updated_at: "2026-04-06T00:00:00.000Z",
        },
        error: null,
      },
      jobResult: {
        data: {
          id: "job-1",
          status: "completed",
          total_rows: 5,
          inserted_rows: 4,
          failed_rows: 1,
          row_errors_json: [{ rowNumber: 4, reason: "row_insert_failed" }],
          completed_at: "2026-04-06T01:00:00.000Z",
        },
        error: null,
      },
    });

    const formData = new FormData();
    formData.set("bankId", "bank-1");
    formData.set("idempotencyToken", "token-0001");
    formData.set("file", new File(["type,difficulty,tags,content_latex,answer_key_json,options_json,explanation_latex,authoring_notes,image_path\n"], "import.csv", { type: "text/csv" }));

    const response = await POST(
      new Request("http://localhost/api/organizer/problem-banks/import", {
        method: "POST",
        headers: {
          origin: "http://localhost",
          host: "localhost",
        },
        body: formData,
      }),
    );

    const payload = (await response.json()) as {
      code: string;
      idempotentReplay: boolean;
      summary: { totalRows: number; insertedRows: number; failedRows: number };
    };

    expect(response.status).toBe(200);
    expect(payload.code).toBe("ok");
    expect(payload.idempotentReplay).toBe(true);
    expect(payload.summary).toEqual(
      expect.objectContaining({
        totalRows: 5,
        insertedRows: 4,
        failedRows: 1,
      }),
    );
  });

  test("POST returns write_conflict when same token is still processing", async () => {
    mockClientForImport({
      profileResult: {
        data: { id: "organizer-1", role: "organizer", is_active: true },
        error: null,
      },
      bankResult: {
        data: {
          id: "bank-1",
          organizer_id: "organizer-1",
          name: "Algebra",
          description: "",
          is_default_bank: false,
          is_visible_to_organizers: false,
          is_deleted: false,
          created_at: "2026-04-06T00:00:00.000Z",
          updated_at: "2026-04-06T00:00:00.000Z",
        },
        error: null,
      },
      jobResult: {
        data: {
          id: "job-1",
          status: "processing",
          total_rows: 0,
          inserted_rows: 0,
          failed_rows: 0,
          row_errors_json: [],
          completed_at: null,
        },
        error: null,
      },
    });

    const formData = new FormData();
    formData.set("bankId", "bank-1");
    formData.set("idempotencyToken", "token-0001");
    formData.set("file", new File(["header\n"], "import.csv", { type: "text/csv" }));

    const response = await POST(
      new Request("http://localhost/api/organizer/problem-banks/import", {
        method: "POST",
        headers: {
          origin: "http://localhost",
          host: "localhost",
        },
        body: formData,
      }),
    );

    const payload = (await response.json()) as { code: string };

    expect(response.status).toBe(409);
    expect(payload.code).toBe("write_conflict");
  });
});
