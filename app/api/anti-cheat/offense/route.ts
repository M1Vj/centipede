import { jsonError, jsonOk, requireMathleteActor } from "@/lib/arena/api";
import { logTabSwitchOffense, type AntiCheatMetadata } from "@/lib/anti-cheat/offense";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const supabase = createAdminClient();
  if (!supabase) {
    return jsonError("service_unavailable", "Anti-cheat logging is temporarily unavailable.", 503);
  }

  const result = await logTabSwitchOffense(supabase, payload.attemptId, payload.metadata, actorId);

  if ("error" in result) {
    console.error("Failed to log anti-cheat offense:", result.error);
    const mappedError = mapOffenseLogError(result.error ?? "log_failed");
    return jsonError(mappedError.code, mappedError.message, mappedError.status);
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

function mapOffenseLogError(error: string) {
  if (error.includes("attempt_not_found")) {
    return {
      code: "attempt_not_found",
      message: "Competition attempt was not found.",
      status: 404,
    };
  }

  if (error.includes("forbidden")) {
    return {
      code: "forbidden",
      message: "You cannot log offenses for this attempt.",
      status: 403,
    };
  }

  if (error.includes("attempt_not_active")) {
    return {
      code: "attempt_not_active",
      message: "Competition attempt is no longer active.",
      status: 409,
    };
  }

  if (error.includes("metadata_json") || error.includes("attempt_id_required")) {
    return {
      code: "invalid_payload",
      message: "Anti-cheat offense payload is invalid.",
      status: 400,
    };
  }

  return {
    code: "log_failed",
    message: "Unable to log anti-cheat offense.",
    status: 500,
  };
}
