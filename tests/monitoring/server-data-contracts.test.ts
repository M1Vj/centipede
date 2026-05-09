import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const SERVER_DATA_PATH = join(process.cwd(), "components/monitoring/server-data.ts");
const API_PATH = join(process.cwd(), "lib/monitoring/api.ts");

describe("monitoring server data contracts", () => {
  test("active attempt queries use only valid attempt_status enum values", () => {
    const serverData = readFileSync(SERVER_DATA_PATH, "utf8");
    const monitoringApi = readFileSync(API_PATH, "utf8");

    expect(serverData).toContain("listMonitoringAttemptSummaries(competitionId, registrations, [\"in_progress\"]");
    expect(monitoringApi).toContain('.eq("status", "in_progress")');
    expect(serverData).not.toContain('"paused"]');
    expect(monitoringApi).not.toContain('"paused"]');
  });

  test("server data loads finished mathlete attempts separately from active attempts", () => {
    const serverData = readFileSync(SERVER_DATA_PATH, "utf8");

    expect(serverData).toContain("finishedAttempts");
    expect(serverData).toContain("listMonitoringAttemptSummaries(competitionId, registrations, [\"submitted\", \"auto_submitted\", \"disqualified\", \"graded\"]");
  });

  test("active attempt last-seen uses updated heartbeat timestamp before start fallback", () => {
    const serverData = readFileSync(SERVER_DATA_PATH, "utf8");

    expect(serverData).toContain("started_at, updated_at");
    expect(serverData).toContain("lastSeenAt: readString(row.updated_at) ?? readString(row.started_at)");
  });
});
