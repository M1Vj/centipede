import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { clearSessionVersionCookie, getSafeNextPath } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  return handleSignOut(request);
}

export async function GET(request: NextRequest) {
  return handleSignOut(request);
}

async function handleSignOut(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    await supabase.auth.signOut();
  }

  revalidatePath("/", "layout");

  const targetPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));
  const targetUrl = new URL(targetPath, request.url);

  const response = NextResponse.redirect(targetUrl, { status: 303 });
  clearSessionVersionCookie(response);
  return response;
}
