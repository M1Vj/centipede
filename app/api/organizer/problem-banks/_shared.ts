import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  mapDatabaseError,
  normalizeProblemBankRow,
  type ProblemBankActorContext,
  type ProblemBankActorRole,
  type ProblemBankRecord,
} from "@/lib/problem-bank/api-helpers";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

type ActorProfileRow = {
  id: string;
  role: string;
  is_active: boolean | null;
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

export function jsonDatabaseError(error: unknown) {
  const mapped = mapDatabaseError(error);
  return jsonError(mapped.code, mapped.message, mapped.status);
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

export async function requireProblemBankActor({
  allowAdmin = true,
  allowOrganizer = true,
}: {
  allowAdmin?: boolean;
  allowOrganizer?: boolean;
} = {}): Promise<
  | {
      supabase: ServerSupabaseClient;
      actor: ProblemBankActorContext;
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

  const role = (profile.role ?? "mathlete") as ProblemBankActorRole;

  if (role === "admin" && !allowAdmin) {
    return {
      response: jsonError("forbidden", "You do not have permission for this operation.", 403),
    };
  }

  if (role === "organizer" && !allowOrganizer) {
    return {
      response: jsonError("forbidden", "You do not have permission for this operation.", 403),
    };
  }

  if (role !== "admin" && role !== "organizer") {
    return {
      response: jsonError("forbidden", "You do not have permission for this operation.", 403),
    };
  }

  return {
    supabase,
    actor: {
      userId: profile.id,
      role,
      isActive: true,
    },
  };
}

export async function fetchProblemBank(
  supabase: ServerSupabaseClient,
  bankId: string,
): Promise<
  | {
      bank: ProblemBankRecord;
    }
  | {
      response: NextResponse;
    }
> {
  const { data, error } = await supabase
    .from("problem_banks")
    .select(
      "id, organizer_id, name, description, is_default_bank, is_visible_to_organizers, is_deleted, created_at, updated_at",
    )
    .eq("id", bankId)
    .maybeSingle();

  if (error) {
    return {
      response: jsonDatabaseError(error),
    };
  }

  const bank = normalizeProblemBankRow(data);
  if (!bank) {
    return {
      response: jsonError("not_found", "Requested resource was not found.", 404),
    };
  }

  return { bank };
}

export async function createProblemAssetSignedUrl(
  supabase: ServerSupabaseClient,
  imagePath: string | null,
): Promise<string | null> {
  if (!imagePath) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from("problem-assets")
    .createSignedUrl(imagePath, 60 * 30);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}
