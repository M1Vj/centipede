// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CalendarWidget } from "@/components/dashboard/calendar-widget";

describe("CalendarWidget", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("highlights the current date and marks scheduled competition days", () => {
    render(
      <CalendarWidget
        events={[
          { id: "event-1", title: "Regional Team Round", date: "2026-04-27T09:00:00.000Z" },
          { id: "event-2", title: "Qualifier", date: "2026-05-02T09:00:00.000Z" },
        ]}
      />,
    );

    expect(screen.getByText("April 2026")).toBeInTheDocument();
    expect(screen.getByLabelText("April 23, 2026, today")).toBeInTheDocument();
    expect(screen.getByLabelText("April 27, 2026, scheduled competition")).toBeInTheDocument();
    expect(screen.getByText("Regional Team Round - Apr 27")).toBeInTheDocument();
  });

  test("supports month navigation for future scheduled competitions", () => {
    render(
      <CalendarWidget
        events={[{ id: "event-2", title: "Qualifier", date: "2026-05-02T09:00:00.000Z" }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next month" }));

    expect(screen.getByText("May 2026")).toBeInTheDocument();
    expect(screen.getByLabelText("May 2, 2026, scheduled competition")).toBeInTheDocument();
  });
});
