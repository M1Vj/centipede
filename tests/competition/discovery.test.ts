import { describe, expect, test } from "vitest";
import {
  buildCompetitionSearchParams,
  parseCompetitionSearchParams,
} from "@/lib/competition/discovery";

describe("competition discovery helpers", () => {
  test("parseCompetitionSearchParams applies defaults", () => {
    const result = parseCompetitionSearchParams({});

    expect(result.filters).toEqual({
      query: "",
      type: "all",
      format: "all",
      status: "all",
    });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
  });

  test("parseCompetitionSearchParams accepts valid values", () => {
    const result = parseCompetitionSearchParams({
      q: "algebra",
      type: "scheduled",
      format: "team",
      status: "live",
      page: "2",
    });

    expect(result.filters.query).toBe("algebra");
    expect(result.filters.type).toBe("scheduled");
    expect(result.filters.format).toBe("team");
    expect(result.filters.status).toBe("live");
    expect(result.page).toBe(2);
  });

  test("buildCompetitionSearchParams omits defaults", () => {
    const params = buildCompetitionSearchParams(
      {
        query: "",
        type: "all",
        format: "all",
        status: "all",
      },
      1,
    );

    expect(params.toString()).toBe("");
  });

  test("buildCompetitionSearchParams includes filters", () => {
    const params = buildCompetitionSearchParams(
      {
        query: "geometry",
        type: "open",
        format: "individual",
        status: "published",
      },
      3,
    );

    expect(params.get("q")).toBe("geometry");
    expect(params.get("type")).toBe("open");
    expect(params.get("format")).toBe("individual");
    expect(params.get("status")).toBe("published");
    expect(params.get("page")).toBe("3");
  });
});
