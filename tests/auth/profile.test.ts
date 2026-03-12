import { describe, expect, test } from "vitest";
import { isProfileComplete } from "@/lib/auth/profile";

describe("isProfileComplete", () => {
  test("returns true when required profile fields are present", () => {
    expect(
      isProfileComplete({
        full_name: "VJ Mabansag",
        school: "Mathwiz Academy",
        grade_level: "10",
      }),
    ).toBe(true);
  });

  test("returns false when any required field is blank after trimming", () => {
    expect(
      isProfileComplete({
        full_name: " ",
        school: "Mathwiz Academy",
        grade_level: "10",
      }),
    ).toBe(false);
    expect(
      isProfileComplete({
        full_name: "VJ Mabansag",
        school: "",
        grade_level: "10",
      }),
    ).toBe(false);
    expect(
      isProfileComplete({
        full_name: "VJ Mabansag",
        school: "Mathwiz Academy",
        grade_level: "   ",
      }),
    ).toBe(false);
  });
});
