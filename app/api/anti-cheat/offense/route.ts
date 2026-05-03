import { jsonError, jsonOk, requireMathleteActor } from "@/lib/arena/api";
import { logTabSwitchOffense, type AntiCheatMetadata } from "@/lib/anti-cheat/offense";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const sameOriginError = requireAntiCheatMutation(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const { error, actorId, profile } = await requireMathleteActor();
  if (error) {
    return error;
  }

  if (!actorId || !profile) {
    return jsonError("unauthorized", "Sign in required.", 401);
  }

  const payload = (await readOffensePayload(request)) as {
    attemptId?: string;
    metadata?: Partial<AntiCheatMetadata>;
  };

  if (!payload.attemptId) {
    return jsonError("invalid_payload", "Attempt id is required.", 400);
  }

  const supabase = await createClient();
  const result = await logTabSwitchOffense(supabase, payload.attemptId, payload.metadata);

  if ("error" in result) {
    console.error("Failed to log anti-cheat offense:", result.error);
    return jsonError("log_failed", "Unable to log anti-cheat offense.", 500);
  }

  return jsonOk({ penaltyApplied: result.penaltyApplied });
}

function requireAntiCheatMutation(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) {
    return jsonError("forbidden", "Cross-site mutation requests are not allowed.", 403);
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host
        ? null
        : jsonError("forbidden", "Cross-site mutation requests are not allowed.", 403);
    } catch {
      return jsonError("forbidden", "Cross-site mutation requests are not allowed.", 403);
    }
  }

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && !["same-origin", "same-site", "none"].includes(secFetchSite)) {
    return jsonError("forbidden", "Cross-site mutation requests are not allowed.", 403);
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).host === host
        ? null
        : jsonError("forbidden", "Cross-site mutation requests are not allowed.", 403);
    } catch {
      return jsonError("forbidden", "Cross-site mutation requests are not allowed.", 403);
    }
  }

  return secFetchSite === "same-origin" || secFetchSite === "same-site" || secFetchSite === "none"
    ? null
    : jsonError("forbidden", "Cross-site mutation requests are not allowed.", 403);
}

async function readOffensePayload(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return request.json().catch(() => ({}));
  }

  const text = await request.text().catch(() => "");
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
