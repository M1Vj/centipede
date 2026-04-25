import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/errors";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ActorProfileRow = {
  id: string;
  role: string;
  is_active: boolean | null;
};

export type MathleteActorContext = {
  userId: string;
  role: "mathlete";
  isActive: boolean;
};

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

export function jsonOk(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status });
}

export function jsonDatabaseError(error: unknown, fallbackMessage: string) {
  return jsonError("operation_failed", getErrorMessage(error, fallbackMessage), 500);
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

export async function requireMathleteActor(): Promise<
  | {
      supabase: ServerSupabaseClient;
      actor: MathleteActorContext;
    }
  | {
      response: NextResponse;
    }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      response: jsonError("unauthorized", "Authentication is required.", 401),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .maybeSingle<ActorProfileRow>();

  if (profileError) {
    return {
      response: jsonError("auth_context_failed", "Unable to resolve actor context.", 500),
    };
  }

  if (!profile || profile.is_active === false) {
    return {
      response: jsonError("forbidden", "You do not have permission for this operation.", 403),
    };
  }

  if (profile.role !== "mathlete") {
    return {
      response: jsonError("forbidden", "You do not have permission for this operation.", 403),
    };
  }

  return {
    supabase,
    actor: {
      userId: profile.id,
      role: "mathlete",
      isActive: true,
    },
  };
}
