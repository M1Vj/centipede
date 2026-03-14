import { describe, expect, test } from "vitest";
import { getErrorMessage } from "@/lib/errors";

describe("getErrorMessage", () => {
  test("returns the message from standard Error instances", () => {
    expect(getErrorMessage(new Error("Permission denied"), "Fallback")).toBe(
      "Permission denied",
    );
  });

  test("returns the message from Supabase-style error objects", () => {
    expect(
      getErrorMessage(
        {
          code: "42501",
          message: "new row violates row-level security policy",
        },
        "Fallback",
      ),
    ).toBe("new row violates row-level security policy");
  });

  test("falls back when no message is available", () => {
    expect(getErrorMessage(null, "Fallback")).toBe("Fallback");
  });
});
