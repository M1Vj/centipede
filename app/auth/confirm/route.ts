import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isProfileComplete, PROFILE_SELECT_FIELDS, type AuthProfile } from "@/lib/auth/profile";
import { getAuthRedirect } from "@/lib/auth/routing";
import {
  clearSessionVersionCookie,
  getSafeNextPath,
  getSessionSignOutHref,
  rotateSessionVersionForUser,
} from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const safeNext = getSafeNextPath(searchParams.get("next"), "/");

  async function handleRedirect(
    supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  ) {
    const { data: { user } } = await supabase.auth.getUser();
    
    let targetPath = safeNext;
    if (user && safeNext === "/") {
      const { data: profile } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT_FIELDS)
        .eq("id", user.id)
        .maybeSingle();
      
      const authProfile = profile as AuthProfile | null;
      if (authProfile && authProfile.is_active === false) {
        await supabase.auth.signOut();
        const response = NextResponse.redirect(new URL("/auth/suspended", request.url), {
          status: 303,
        });
        clearSessionVersionCookie(response);
        return response;
      }
      const redirectPath = getAuthRedirect({
        pathname: "/auth/confirm",
        isAuthenticated: true,
        hasCompletedProfile: isProfileComplete(authProfile),
        role: authProfile?.role
      });

      if (redirectPath) {
        targetPath = redirectPath;
      }
    }

    const response = NextResponse.redirect(new URL(targetPath, request.url), {
      status: 303,
    });

    if (user) {
      try {
        await rotateSessionVersionForUser(supabase, user.id, response);
      } catch {
        return NextResponse.redirect(new URL(getSessionSignOutHref("/auth/login"), request.url), {
          status: 303,
        });
      }
    }

    return response;
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return await handleRedirect(supabase);
    } else {
      return NextResponse.redirect(new URL(`/auth/error?error=${encodeURIComponent(error.message)}`, request.url), {
        status: 303,
      });
    }
  }

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      return await handleRedirect(supabase);
    } else {
      return NextResponse.redirect(new URL(`/auth/error?error=${encodeURIComponent(error.message)}`, request.url), {
        status: 303,
      });
    }
  }

  return NextResponse.redirect(new URL(`/auth/error?error=No token hash or type`, request.url), {
    status: 303,
  });
}
