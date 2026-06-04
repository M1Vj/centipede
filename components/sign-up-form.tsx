"use client";

import { useState } from "react";
import { CircleAlert, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { isProfileComplete, PROFILE_SELECT_FIELDS } from "@/lib/auth/profile";
import { getAuthRedirect } from "@/lib/auth/routing";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useFeedbackRouter } from "@/hooks/use-feedback-router";
import { useFormStatusRegion } from "@/hooks/use-form-status-region";
import { AuthDivider, AuthField, GoogleMark } from "@/components/auth/auth-form-primitives";
import { Button } from "@/components/ui/button";
import { FormStatusMessage } from "@/components/ui/feedback-states";
import { getErrorMessage } from "@/lib/errors";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const [pendingAction, setPendingAction] = useState<"email" | "google" | null>(null);
  const [status, setStatus] = useState<{
    message: string | null;
    type: "error" | "pending" | "success";
  }>({
    message: null,
    type: "pending",
  });
  const feedbackRouter = useFeedbackRouter();
  const { statusId, statusRef } = useFormStatusRegion(status.message);
  const isLoading = pendingAction !== null;

  const redirectIfAlreadySignedIn = async () => {
    const supabase = getSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return false;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT_FIELDS)
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    const redirectPath = getAuthRedirect({
      pathname: "/auth/sign-up",
      isAuthenticated: true,
      hasCompletedProfile: isProfileComplete(profile),
      role: profile?.role,
    });

    if (!redirectPath) {
      return false;
    }

    setStatus({
      message: "You are already signed in. Redirecting to your workspace...",
      type: "pending",
    });
    feedbackRouter.push(redirectPath);
    return true;
  };

  const handleGoogle = async () => {
    const supabase = getSupabaseClient();
    setPendingAction("google");
    setStatus({
      message: "Checking your active session...",
      type: "pending",
    });

    try {
      if (await redirectIfAlreadySignedIn()) {
        return;
      }

      setStatus({
        message: "Connecting you to Google registration...",
        type: "pending",
      });

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
        message: getErrorMessage(nextError, "Unable to start Google registration."),
        type: "error",
      });
      setPendingAction(null);
    }
  };

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const supabase = getSupabaseClient();
    setPendingAction("email");
    setStatus({
      message: "Checking your active session...",
      type: "pending",
    });

    try {
      if (await redirectIfAlreadySignedIn()) {
        return;
      }

      if (password !== repeatPassword) {
        setStatus({
          message: "Passwords do not match",
          type: "error",
        });
        setPendingAction(null);
        return;
      }

      setStatus({
        message: "Creating your account...",
        type: "pending",
      });

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/auth/email-confirmed`,
        },
      });

      if (error) {
        throw error;
      }

      if (data.user && data.session) {
        feedbackRouter.push("/profile/complete");
        return;
      }

      setStatus({
        message: "Check your email to confirm your account, then finish your profile.",
        type: "success",
      });
    } catch (nextError: unknown) {
      setStatus({
        message: getErrorMessage(nextError, "An error occurred"),
        type: "error",
      });
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className={cn("space-y-5", className)} {...props}>
      <form
        onSubmit={handleSignUp}
        className="space-y-5"
        aria-busy={isLoading}
        aria-describedby={status.message ? statusId : undefined}
      >
        <AuthField
          id="email"
          type="email"
          autoComplete="email"
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
          autoComplete="new-password"
          placeholder="Password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          label="Password"
          icon={<Lock className="size-4" />}
          trailing={
            <button
              type="button"
              className="inline-flex items-center justify-center text-slate-400 transition hover:text-foreground"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          }
        />

        <AuthField
          id="repeat-password"
          type={showRepeatPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Confirm Password"
          required
          value={repeatPassword}
          onChange={(event) => setRepeatPassword(event.target.value)}
          label="Confirm Password"
          icon={<Lock className="size-4" />}
          trailing={
            <button
              type="button"
              className="inline-flex items-center justify-center text-slate-400 transition hover:text-foreground"
              onClick={() => setShowRepeatPassword((value) => !value)}
              aria-label={showRepeatPassword ? "Hide password confirmation" : "Show password confirmation"}
            >
              {showRepeatPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          }
        />

        <div id={statusId} ref={statusRef} tabIndex={-1} className="focus:outline-none">
          <FormStatusMessage
            status={status.type}
            message={status.message}
            icon={status.type === "error" ? CircleAlert : undefined}
          />
        </div>

        <Button
          type="submit"
          className="h-12 w-full rounded-xl bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90"
          pending={pendingAction === "email"}
          pendingText="Creating an account..."
          disabled={pendingAction === "google"}
        >
          Create Account
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
    </div>
  );
}
