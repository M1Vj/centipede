"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleAlert, Eye, EyeOff, Lock, Mail } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { isProfileComplete, PROFILE_SELECT_FIELDS } from "@/lib/auth/profile";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useFeedbackRouter } from "@/hooks/use-feedback-router";
import { useFormStatusRegion } from "@/hooks/use-form-status-region";
import { useAuth } from "@/components/providers/auth-provider";
import { AuthDivider, AuthField, GoogleMark } from "@/components/auth/auth-form-primitives";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormStatusMessage } from "@/components/ui/feedback-states";
import { ProgressLink } from "@/components/ui/progress-link";
import { getErrorMessage } from "@/lib/errors";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingAction, setPendingAction] = useState<"email" | "google" | null>(null);
  const [status, setStatus] = useState<{
    message: string | null;
    type: "error" | "pending";
  }>({
    message: null,
    type: "pending",
  });
  const feedbackRouter = useFeedbackRouter();
  const { statusId, statusRef } = useFormStatusRegion(status.message);
  const isLoading = pendingAction !== null;

  useEffect(() => {
    if (!user) {
      setPendingAction(null);
      setStatus({ message: null, type: "pending" });
    }
  }, [user]);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam === "suspended") {
      setStatus({
        message:
          "Your account is pending organizer approval or has been suspended. Please contact support if you believe this is an error.",
        type: "error",
      });
    }
  }, [searchParams]);

  const redirectAfterLogin = async (userId: string) => {
    const supabase = getSupabaseClient();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT_FIELDS)
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (profile && profile.is_active === false) {
      await supabase.auth.signOut();
      setStatus({
        message:
          "This account is inactive or pending approval. Please check your application status or contact support.",
        type: "error",
      });
      setPendingAction(null);
      return;
    }

    if (!profile || !isProfileComplete(profile)) {
      feedbackRouter.push("/profile/complete");
      return;
    }

    if (profile.role === "admin") {
      feedbackRouter.push("/admin");
    } else if (profile.role === "organizer") {
      feedbackRouter.push("/organizer");
    } else {
      feedbackRouter.push("/mathlete");
    }
  };

  const refreshAcceptedSession = async (session: Session) => {
    const response = await fetch("/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
      }),
    });

    if (!response.ok) {
      throw new Error("Unable to refresh the active session.");
    }
  };

  const handleGoogle = async () => {
    const supabase = getSupabaseClient();
    setPendingAction("google");
    setStatus({
      message: "Connecting you to Google sign-in...",
      type: "pending",
    });

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/confirm?next=/profile/complete`,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (error) {
        throw error;
      }
    } catch (nextError: unknown) {
      setStatus({
        message: getErrorMessage(nextError, "Unable to start Google login."),
        type: "error",
      });
      setPendingAction(null);
    }
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const supabase = getSupabaseClient();
    setPendingAction("email");
    setStatus({
      message: "Signing you in with email and password...",
      type: "pending",
    });

    try {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      const {
        data: { user: nextUser },
      } = await supabase.auth.getUser();

      if (!nextUser) {
        throw new Error("Login succeeded but no user session was returned.");
      }

      if (!signInData.session) {
        throw new Error("Login succeeded but no active session was returned.");
      }

      await refreshAcceptedSession(signInData.session);
      await redirectAfterLogin(nextUser.id);
    } catch (nextError: unknown) {
      const raw = getErrorMessage(nextError, "An error occurred during login.");
      const message =
        raw === "Invalid login credentials"
          ? "Invalid email or password. If you don't have an account, please sign up first."
          : raw;
      setStatus({ message, type: "error" });
      setPendingAction(null);
    }
  };

  return (
    <div className={cn("space-y-5", className)} {...props}>
      <form
        onSubmit={handleLogin}
        className="space-y-6"
        aria-busy={isLoading}
        aria-describedby={status.message ? statusId : undefined}
      >
        <AuthField
          id="email"
          type="email"
          autoComplete="username"
          placeholder="Email Address"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          label="Email Address"
          icon={<Mail className="size-4" />}
        />

        <AuthField
          id="password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          label="Password"
          icon={<Lock className="size-4" />}
          trailing={
            <button
              type="button"
              className="inline-flex items-center justify-center text-slate-400 transition hover:text-[#0f172a]"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-3 py-1">
          <label className="inline-flex items-center gap-2 text-sm text-slate-500" htmlFor="remember-me">
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
              className="border-slate-300 data-[state=checked]:border-[#f49700] data-[state=checked]:bg-[#f49700]"
            />
            Remember me
          </label>
          <ProgressLink
            href="/auth/forgot-password"
            className="text-sm font-semibold text-[#0f172a] underline-offset-4 hover:text-[#f49700] hover:underline"
          >
            Forgot Password?
          </ProgressLink>
        </div>

        <div id={statusId} ref={statusRef} tabIndex={-1} className="focus:outline-none">
          <FormStatusMessage
            status={status.type}
            message={status.message}
            icon={status.type === "error" ? CircleAlert : undefined}
          />
        </div>

        <Button
          type="submit"
          className="h-12 w-full rounded-xl bg-[#f49701] text-base font-bold text-white hover:bg-[#df8e00]"
          pending={pendingAction === "email"}
          pendingText="Signing in..."
          disabled={pendingAction === "google"}
        >
          Sign In
        </Button>
      </form>

      <AuthDivider />

      <Button
        type="button"
        variant="outline"
        className="h-12 w-full rounded-xl border-slate-200 bg-white text-base font-bold text-slate-700 shadow-none hover:bg-slate-50"
        onClick={() => void handleGoogle()}
        pending={pendingAction === "google"}
        pendingText="Connecting to Google..."
        disabled={pendingAction === "email"}
      >
        <GoogleMark />
        Continue with Google
      </Button>

      <Dialog open={pendingAction === "email"}>
        <DialogContent
          showCloseButton={false}
          className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1A1E2E] p-0 shadow-[0_40px_100px_-40px_rgba(0,0,0,0.6)]"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <div className="flex flex-col items-center justify-center gap-5 px-8 py-10 text-center">
            <div className="relative flex size-16 items-center justify-center">
              <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[#F49700]" />
              <img src="/mathwiz-logo.svg" alt="" className="h-9 w-9 object-contain" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white">Signing in</DialogTitle>
              <DialogDescription className="mt-2 text-sm text-slate-400">
                Please wait while we verify your credentials and sign you in.
              </DialogDescription>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
