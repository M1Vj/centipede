import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { isProfileComplete, PROFILE_SELECT_FIELDS, type AuthProfile } from "@/lib/auth/profile";
import { getAuthRedirect } from "@/lib/auth/routing";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");
  const safeNext = next?.startsWith("/") ? next : "/";

  async function handleRedirect(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never) {
    const { data: { user } } = await supabase.auth.getUser();
    
    let targetPath = safeNext;
    if (user && safeNext === "/") {
      const { data: profile } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT_FIELDS)
        .eq("id", user.id)
        .maybeSingle();
      
      const authProfile = profile as AuthProfile | null;
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
    
    redirect(targetPath);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      await handleRedirect(supabase);
    } else {
      redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
    }
  }

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      await handleRedirect(supabase);
    } else {
      redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
    }
  }

  redirect(`/auth/error?error=No token hash or type`);
}
