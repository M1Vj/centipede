import { randomBytes } from "node:crypto";
import { TEAM_CODE_LENGTH } from "@/lib/teams/validation";

const TEAM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateTeamCode(length = TEAM_CODE_LENGTH) {
  const bytes = randomBytes(length);
  let code = "";

  for (let index = 0; index < length; index += 1) {
    const byte = bytes[index] ?? 0;
    code += TEAM_CODE_ALPHABET[byte % TEAM_CODE_ALPHABET.length];
  }

  return code;
}
