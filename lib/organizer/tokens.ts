import { createHash, randomBytes } from "node:crypto";
import {
  STATUS_LOOKUP_TOKEN_REGEX,
  STATUS_LOOKUP_TOKEN_TTL_DAYS,
} from "@/lib/organizer/constants";

export function createStatusLookupToken() {
  return randomBytes(32).toString("hex");
}

export function normalizeStatusLookupToken(token: string) {
  return token.trim().toLowerCase().replace(/\s+/g, "");
}

export function hashStatusLookupToken(token: string) {
  const normalized = normalizeStatusLookupToken(token);

  if (!STATUS_LOOKUP_TOKEN_REGEX.test(normalized)) {
    return null;
  }

  return createHash("sha256")
    .update(`centipede:status-lookup:${normalized}`)
    .digest("hex");
}

export function getStatusLookupTokenExpiryDate(base = new Date()) {
  const expiresAt = new Date(base);
  expiresAt.setDate(expiresAt.getDate() + STATUS_LOOKUP_TOKEN_TTL_DAYS);
  return expiresAt;
}
