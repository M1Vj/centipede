import { describe, expect, test } from "vitest";
import {
  validateCompetitionId,
  validateIdempotencyToken,
  validateRegistrationId,
  validateStatusReason,
  validateTeamId,
} from "@/lib/registrations/validation";

describe("registration validation helpers", () => {
  test("validateCompetitionId accepts uuids and rejects invalid values", () => {
    expect(validateCompetitionId("2c7f5d7e-3a3c-4c73-81b1-8cf0c6f2c111")).toEqual({
      ok: true,
      value: "2c7f5d7e-3a3c-4c73-81b1-8cf0c6f2c111",
      errors: [],
    });

    expect(validateCompetitionId("nope")).toEqual({
      ok: false,
      value: null,
      errors: [
        {
          field: "competitionId",
          reason: "competitionId must be a valid UUID.",
        },
      ],
    });
  });

  test("validateRegistrationId accepts uuids and rejects invalid values", () => {
    expect(validateRegistrationId("6ab7b29b-0ad5-4698-82bc-7a0b7b4a6b34")).toEqual({
      ok: true,
      value: "6ab7b29b-0ad5-4698-82bc-7a0b7b4a6b34",
      errors: [],
    });

    expect(validateRegistrationId("   ")).toEqual({
      ok: false,
      value: null,
      errors: [
        {
          field: "registrationId",
          reason: "registrationId must be a valid UUID.",
        },
      ],
    });
  });

  test("validateTeamId allows null and accepts uuids", () => {
    expect(validateTeamId(null)).toEqual({ ok: true, value: null, errors: [] });
    expect(validateTeamId("0f9a42ef-0d2d-41a2-8e52-1f885b75d4af")).toEqual({
      ok: true,
      value: "0f9a42ef-0d2d-41a2-8e52-1f885b75d4af",
      errors: [],
    });
  });

  test("validateStatusReason requires bounded content", () => {
    expect(validateStatusReason("team withdrew")).toEqual({
      ok: true,
      value: "team withdrew",
      errors: [],
    });

    expect(validateStatusReason(" ")).toEqual({
      ok: false,
      value: null,
      errors: [
        {
          field: "statusReason",
          reason: "statusReason is required.",
        },
      ],
    });

    expect(validateStatusReason("x".repeat(161))).toEqual({
      ok: false,
      value: null,
      errors: [
        {
          field: "statusReason",
          reason: "statusReason must be 160 characters or fewer.",
        },
      ],
    });
  });

  test("validateIdempotencyToken is re-exported from teams validation", () => {
    expect(validateIdempotencyToken("req:12345678")).toEqual({
      ok: true,
      value: "req:12345678",
      errors: [],
    });
  });
});