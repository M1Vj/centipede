// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import Loading from "@/app/organizer/competition/[competitionId]/loading";

describe("organizer competition detail loading state", () => {
  test("shows a dedicated settings skeleton while competition detail loads", () => {
    render(<Loading />);

    expect(screen.getByText("Loading competition settings...")).toBeInTheDocument();
    expect(screen.getAllByTestId("detail-skeleton-line").length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByTestId("form-skeleton-field").length).toBeGreaterThanOrEqual(4);
  });
});
