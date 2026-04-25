import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PROFILE_SELECT_FIELDS, type AuthProfile } from "@/lib/auth/profile";

export function jsonOk(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status });
}

export function jsonError(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      code,
      message,
      ...(details ?? {}),
    },
    { status },
  );
}

export function requireSameOriginMutation(request: Request) {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");

  if (!origin || !host) {
    return jsonError("forbidden", "Cross-site mutation requests are not allowed.", 403);
  }

  let normalizedOriginHost = "";
  try {
    normalizedOriginHost = new URL(origin).host;
  } catch {
    return jsonError("forbidden", "Cross-site mutation requests are not allowed.", 403);
  }

  if (normalizedOriginHost !== host) {
    return jsonError("forbidden", "Cross-site mutation requests are not allowed.", 403);
  }

  return null;
}

export async function requireMathleteActor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: jsonError("unauthorized", "Sign in required.", 401),
      actorId: null,
      profile: null,
    };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT_FIELDS)
    .eq("id", user.id)
    .maybeSingle<AuthProfile>();

  if (error) {
    throw error;
  }

  if (!profile || profile.role !== "mathlete" || profile.is_active === false) {
    return {
      error: jsonError("forbidden", "Mathlete access required.", 403),
      actorId: null,
      profile: null,
    };
  }

  return {
    error: null,
    actorId: user.id,
    profile,
  };
}
