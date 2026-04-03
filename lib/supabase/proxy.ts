import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthRedirect } from "@/lib/auth/routing";
import { isProfileComplete, PROFILE_SELECT_FIELDS } from "@/lib/auth/profile";
import { getSupabaseEnv, hasEnvVars } from "./env";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next();

  // Perform early short-circuit for static assets and public non-auth routes
  // to avoid unnecessary Supabase client creation or database hits.
  const path = request.nextUrl.pathname;
  if (
    path.startsWith("/api/") ||
    path.startsWith("/_next") ||
    path.startsWith("/favicon.ico") ||
    path === "/robots.txt" ||
    path === "/sitemap.xml" ||
    path === "/manifest.json" ||
    path.endsWith(".svg") ||
    path.endsWith(".png") ||
    path.endsWith(".jpg") ||
    path.endsWith(".jpeg")
  ) {
    return supabaseResponse;
  }

  // Skip proxy for auth sign-out route to prevent redundant checks or redirect loops
  if (path === "/auth/sign-out" || !hasEnvVars) {
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
          supabaseResponse = NextResponse.next();
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError && authError.message !== "Auth session missing!") {
    // We log real errors (malformed tokens, network issues) but ignore 
    // the "missing session" message which is expected for logged-out users.
    console.error("[Middleware] Auth getUser error:", authError.message);
  }

  const resolvedUser = authError ? null : user;

  let hasCompletedProfile = false;
  let role: string | null = null;
  let isActive = true;

  if (resolvedUser) {
    // Use a race to ensure slow or cold DB starts don't block the middleware indefinitely.
    const profilePromise = supabase
      .from("profiles")
      .select(PROFILE_SELECT_FIELDS)
      .eq("id", resolvedUser.id)
      .maybeSingle();

    let timeoutHandle: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error("Profile fetch timeout")),
        1500,
      );
    });

    try {
      const { data: profile, error } = await Promise.race([
        profilePromise,
        timeoutPromise,
      ]);
      clearTimeout(timeoutHandle!);

      if (error) {
        // Uncaught throws in middleware crash the request. We log and fallback
        // to treating the user as having an incomplete profile for safety.
        console.error("[Middleware] Profile fetch error:", error.message);
      } else {
        hasCompletedProfile = isProfileComplete(profile);
        role = profile?.role || null;
        isActive = profile?.is_active !== false;
      }
    } catch (err: unknown) {
      clearTimeout(timeoutHandle!);
      console.error("[Middleware] Profile fetch failure:", err instanceof Error ? err.message : String(err));
    }
  }

  if (resolvedUser && !isActive && path !== "/auth/suspended") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/suspended";
    url.search = "";

    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  const redirectPath = getAuthRedirect({
    pathname: path,
    isAuthenticated: Boolean(resolvedUser),
    hasCompletedProfile,
    role,
  });

  if (redirectPath && redirectPath !== request.nextUrl.pathname) {
    const url = request.nextUrl.clone();
    url.pathname = redirectPath;
    
    // Only clear auth-specific sensitive parameters instead of wiping all search context.
    // This allows legitimate params like ?next= or ?error= to persist.
    url.searchParams.delete("code");
    url.searchParams.delete("token");
    url.searchParams.delete("type");

    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  return supabaseResponse;
}
