import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import {
  clearActiveSessionForUser,
  clearSessionVersionCookie,
  getSafeNextPath,
  getSessionVersionCookieValue,
} from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  return signOutWithPost(request);
}

export async function GET() {
  return NextResponse.json(
    { error: "Method Not Allowed" },
    {
      status: 405,
      headers: {
        Allow: "POST",
      },
    },
  );
}

async function signOutWithPost(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const sessionVersion = getSessionVersionCookieValue(request.cookies);

  if (session) {
    const userId = session.user.id;
    try {
      const adminClient = createAdminClient();
      await clearActiveSessionForUser(adminClient ?? supabase, userId, sessionVersion);
    } catch {
      // Sign-out must still clear local auth even if the active marker cannot be updated.
    }

    await supabase.auth.signOut();
  }

  revalidatePath("/", "layout");

  const targetPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));
  const targetUrl = new URL(targetPath, request.url);

  const response = NextResponse.redirect(targetUrl, { status: 303 });
  clearSessionVersionCookie(response);
  return response;
}
