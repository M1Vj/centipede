import { describe, expect, test } from "vitest";
import {
  TEAM_CODE_LENGTH,
  validateIdempotencyToken,
  validateInviteAction,
  validateTeamCodeInput,
  validateTeamNameInput,
} from "@/lib/teams/validation";

describe("team validation helpers", () => {
  test("accepts a normalized team name", () => {
    const result = validateTeamNameInput("  The   Alpha  Team  ");

    expect(result.ok).toBe(true);
    expect(result.value).toBe("The Alpha Team");
  });

  test("rejects missing or overly long team names", () => {
    const emptyResult = validateTeamNameInput("   ");
    expect(emptyResult.ok).toBe(false);
    expect(emptyResult.errors[0]?.field).toBe("name");

    const longName = "A".repeat(81);
    const longResult = validateTeamNameInput(longName);
    expect(longResult.ok).toBe(false);
    expect(longResult.errors[0]?.reason).toBe(
      "Team name must be 80 characters or fewer.",
    );
  });

  test("validates team code length and format", () => {
    const validCode = "abc1234567";
    const validResult = validateTeamCodeInput(validCode);

    expect(validResult.ok).toBe(true);
    expect(validResult.value).toBe(validCode.toUpperCase());

    const invalidResult = validateTeamCodeInput("ABC1234!");
    expect(invalidResult.ok).toBe(false);
    expect(invalidResult.errors[0]?.reason).toBe(
      `Team code must be ${TEAM_CODE_LENGTH} characters using letters and numbers only.`,
    );
  });

  test("validates idempotency token format", () => {
    const missing = validateIdempotencyToken(" ");
    expect(missing.ok).toBe(false);
    expect(missing.errors[0]?.reason).toBe("requestIdempotencyToken is required.");

    const invalid = validateIdempotencyToken("short");
    expect(invalid.ok).toBe(false);

    const valid = validateIdempotencyToken("invite:team-1234");
    expect(valid.ok).toBe(true);
    expect(valid.value).toBe("invite:team-1234");
  });

  test("validates invite action choices", () => {
    expect(validateInviteAction("accept").ok).toBe(true);
    expect(validateInviteAction("decline").ok).toBe(true);

    const invalid = validateInviteAction("maybe");
    expect(invalid.ok).toBe(false);
    expect(invalid.errors[0]?.reason).toBe("Action must be either 'accept' or 'decline'.");
  });
});
