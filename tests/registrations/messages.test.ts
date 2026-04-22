import { describe, expect, test } from "vitest";
import {
  registrationMachineCodeMessage,
  withdrawalMachineCodeMessage,
} from "@/lib/registrations/messages";

describe("registration message helpers", () => {
  test("registrationMachineCodeMessage maps success", () => {
    const result = registrationMachineCodeMessage("ok");
    expect(result.tone).toBe("success");
    expect(result.message).toContain("Registration confirmed");
  });

  test("registrationMachineCodeMessage maps ineligible", () => {
    const result = registrationMachineCodeMessage("ineligible");
    expect(result.tone).toBe("warning");
    expect(result.message).toContain("ineligible");
  });

  test("withdrawalMachineCodeMessage maps attempts exist", () => {
    const result = withdrawalMachineCodeMessage("attempts_exist");
    expect(result.tone).toBe("warning");
    expect(result.message).toContain("cannot withdraw");
  });

  test("withdrawalMachineCodeMessage maps default", () => {
    const result = withdrawalMachineCodeMessage("unknown");
    expect(result.tone).toBe("error");
  });
});
