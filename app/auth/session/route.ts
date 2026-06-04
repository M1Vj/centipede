import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  getSessionSignOutHref,
  getSessionVersionCookieValue,
  isActiveSessionCurrent,
  isSessionStale,
  isSessionVersionSchemaError,
  rotateSessionVersionForUser,
} from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type SessionPayload = {
  accessToken: string;
  refreshToken: string;
  mode?: "check" | "replace";
};

async function readSessionPayload(request: Request): Promise<SessionPayload | null> {
  try {
    const payload = (await request.json()) as Partial<SessionPayload>;
    if (
      typeof payload.accessToken === "string"
      && typeof payload.refreshToken === "string"
      && payload.accessToken.length > 0
      && payload.refreshToken.length > 0
    ) {
      return {
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        mode: payload.mode === "check" ? "check" : "replace",
      };
    }
  } catch {
    return null;
  }

  return null;
}

async function getAuthenticatedUser(payload: SessionPayload | null) {
  const supabase = await createClient();
  let {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (payload) {
      const { data, error } = await supabase.auth.setSession({
        access_token: payload.accessToken,
        refresh_token: payload.refreshToken,
      });

      if (error) {
        return {
          supabase,
          user: null,
        };
      }

      user = data.user;
    }
  }

  return {
    supabase,
    user,
  };
}

type SessionStatusClient = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle<T>(): PromiseLike<{
          data: T | null;
          error: { code?: string | null; message?: string | null } | null;
        }>;
      };
    };
  };
};

type SessionStatusProfile = {
  session_version?: number | null;
  active_session_expires_at?: string | null;
};

async function getSessionStatusProfile(client: SessionStatusClient, userId: string) {
  const { data, error } = await client
    .from("profiles")
    .select("session_version, active_session_expires_at")
    .eq("id", userId)
    .maybeSingle<SessionStatusProfile>();

  if (error && !isSessionVersionSchemaError(error)) {
    throw error;
  }

  return error ? null : data;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let profile: SessionStatusProfile | null = null;
  try {
    profile = await getSessionStatusProfile(supabase as unknown as SessionStatusClient, user.id);
  } catch {
    return NextResponse.json({ error: "Unable to verify session." }, { status: 500 });
  }

  const sessionVersion = getSessionVersionCookieValue(await cookies());
  if (isSessionStale(profile, { sessionVersion })) {
    return NextResponse.json(
      {
        error: "Session replaced",
        redirectTo: getSessionSignOutHref("/auth/login"),
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const payload = await readSessionPayload(request);
  const { supabase, user } = await getAuthenticatedUser(payload);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (payload?.mode === "check") {
    const client = createAdminClient() ?? supabase;
    try {
      const profile = await getSessionStatusProfile(client as unknown as SessionStatusClient, user.id);
      return NextResponse.json({
        ok: true,
        hasActiveSession: isActiveSessionCurrent(profile),
      });
    } catch {
      return NextResponse.json({ error: "Unable to verify active sessions." }, { status: 500 });
    }
  }

  const response = NextResponse.json({ ok: true });
  try {
    const adminClient = createAdminClient();
    if (adminClient) {
      await rotateSessionVersionForUser(adminClient, user.id, response);
    } else {
      await rotateSessionVersionForUser(supabase, user.id, response);
    }
  } catch {
    return NextResponse.json({ error: "Unable to refresh session." }, { status: 500 });
  }

  return response;
}
