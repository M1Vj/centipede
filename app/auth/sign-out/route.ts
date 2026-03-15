import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  return handleSignOut(request);
}

export async function GET(request: NextRequest) {
  return handleSignOut(request);
}

async function handleSignOut(request: NextRequest) {
  const supabase = await createClient();

  // 1. Check if we have an active session before attempting to sign out.
  // This avoids errors if the user is already signed out but the route is hit again.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    // 2. Explicitly sign out on the server to clear all session cookies.
    await supabase.auth.signOut();
  }

  // 3. Clear the Next.js router cache for all routes to prevent stale UI.
  revalidatePath("/", "layout");

  const url = request.nextUrl.clone();
  url.pathname = "/auth/login";
  url.search = "";

  // 4. Perform a full redirect to the login page.
  // We use 303 See Other to ensure the browser performs a GET request to the login page.
  return NextResponse.redirect(url, {
    status: 303,
  });
}
