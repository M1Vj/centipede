import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { resolveCompetitionProblemPoints } from "@/app/api/organizer/competitions/_shared";

const EFFECTIVE_POINTS_MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260603172000_apply_effective_problem_points_on_publish.sql",
);

describe("competition problem point materialization", () => {
  test("resolves selected problem points from difficulty by default", () => {
    expect(resolveCompetitionProblemPoints("difficulty", {}, "easy", "problem-1")).toBe(1);
    expect(resolveCompetitionProblemPoints("difficulty", {}, "average", "problem-2")).toBe(2);
    expect(resolveCompetitionProblemPoints("difficulty", {}, "difficult", "problem-3")).toBe(3);
  });

  test("uses manual custom points with difficulty fallback", () => {
    expect(resolveCompetitionProblemPoints("custom", { "problem-1": 7 }, "easy", "problem-1")).toBe(7);
    expect(resolveCompetitionProblemPoints("custom", {}, "difficult", "problem-2")).toBe(3);
  });

  test("publish snapshot applies effective points before grading can read them", () => {
    const sql = readFileSync(EFFECTIVE_POINTS_MIGRATION_PATH, "utf8");

    expect(sql).toContain("create or replace function public.snapshot_competition_problems");
    expect(sql).toContain("when v_competition.scoring_mode::text = 'custom'");
    expect(sql).toContain("v_competition.custom_points ->> cp.problem_id::text");
    expect(sql).toContain("'points', cp.points");
    expect(sql).not.toContain("set points = coalesce(\n        cp.points");
  });
});
