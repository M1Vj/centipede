import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rotateSessionVersionForUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type SessionPayload = {
  accessToken: string;
  refreshToken: string;
};

async function readSessionPayload(request: Request) {
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
      };
    }
  } catch {
    return null;
  }

  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  let {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const payload = await readSessionPayload(request);

    if (payload) {
      const { data, error } = await supabase.auth.setSession({
        access_token: payload.accessToken,
        refresh_token: payload.refreshToken,
      });

      if (error) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      user = data.user;
    }
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
