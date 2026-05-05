// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { OffenseLogsPanel } from "@/components/anti-cheat/offense-logs-panel";
import type { OffenseLog } from "@/lib/anti-cheat/queries";

function buildLog(): OffenseLog {
  return {
    id: "log-1",
    offense_number: 2,
    penalty_applied: "warning",
    logged_at: "2026-04-22T12:34:56.000Z",
    client_timestamp: null,
    metadata_json: {
      event_source: "visibilitychange",
      visibility_state: "hidden",
      route_path: "/arena/competition-1",
      user_agent: "Mozilla/5.0",
      client_timestamp: null,
    },
    competition_attempts: {
      competition_registrations: {
        profile_id: "profile-1",
        team_id: null,
        profiles: {
          full_name: "Dana Kim",
        },
        teams: null,
      },
    },
  };
}

describe("OffenseLogsPanel", () => {
  test("renders offense rows with native time formatting", () => {
    render(<OffenseLogsPanel logs={[buildLog()]} />);

    expect(screen.getByText("Anti-Cheat Logs (1)")).toBeInTheDocument();
    expect(screen.getByText("Dana Kim")).toBeInTheDocument();
    expect(screen.getByText("warning")).toBeInTheDocument();
    expect(screen.getByText("visibilitychange")).toBeInTheDocument();
    expect(screen.getByText(/\d{2}:\d{2}:\d{2}/)).toBeInTheDocument();
  });
});
