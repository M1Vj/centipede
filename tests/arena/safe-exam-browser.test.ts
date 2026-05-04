import { describe, expect, test } from "vitest";
import {
  buildSafeExamBrowserRequestHash,
  verifySafeExamBrowserRequest,
} from "@/lib/safe-exam-browser";

describe("safe exam browser gate", () => {
  test("verifies SEB Config Key request hash against absolute start URL", () => {
    const configKeyHash = "a".repeat(64);
    const request = new Request("http://localhost:3000/api/mathlete/competition/competition-1/start", {
      method: "POST",
      headers: {
        "x-safeexambrowser-configkeyhash": buildSafeExamBrowserRequestHash(
          "http://localhost:3000/api/mathlete/competition/competition-1/start",
          configKeyHash,
        ),
      },
    });

    expect(verifySafeExamBrowserRequest(request, [configKeyHash])).toBe(true);
  });

  test("rejects missing or mismatched SEB Config Key request hash", () => {
    const request = new Request("http://localhost:3000/api/mathlete/competition/competition-1/start", {
      method: "POST",
    });

    expect(verifySafeExamBrowserRequest(request, ["a".repeat(64)])).toBe(false);
  });
});
