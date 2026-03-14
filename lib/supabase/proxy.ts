import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthRedirect } from "@/lib/auth/routing";
import { isProfileComplete, PROFILE_SELECT_FIELDS } from "@/lib/auth/profile";
import { getSupabaseEnv, hasEnvVars } from "./env";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // If the env vars are not set, skip proxy check. You can remove this
  // once you setup the project.
  if (!hasEnvVars) {
    return supabaseResponse;
  }

  const { supabaseUrl, supabasePublicKey } = getSupabaseEnv();

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    supabaseUrl,
    supabasePublicKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasCompletedProfile = false;

  if (user) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT_FIELDS)
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    hasCompletedProfile = isProfileComplete(profile);
  }

  const redirectPath = getAuthRedirect({
    pathname: request.nextUrl.pathname,
    isAuthenticated: Boolean(user),
    hasCompletedProfile,
  });

  if (redirectPath && redirectPath !== request.nextUrl.pathname) {
    const url = request.nextUrl.clone();
    url.pathname = redirectPath;
    url.search = "";

    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  return supabaseResponse;
}
