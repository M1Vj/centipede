"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { isProfileComplete, PROFILE_SELECT_FIELDS } from "@/lib/auth/profile";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useFeedbackRouter } from "@/hooks/use-feedback-router";
import { useFormStatusRegion } from "@/hooks/use-form-status-region";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { FormStatusMessage } from "@/components/ui/feedback-states";
import { Spinner } from "@/components/ui/spinner";
import { ProgressLink } from "@/components/ui/progress-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/errors";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        message: "Your account is suspended. Please contact support.",
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
      feedbackRouter.push("/auth/suspended");
      return;
    }

    if (!profile || !isProfileComplete(profile)) {
      feedbackRouter.push("/profile/complete");
      return;
    }

    // Role-based redirection
    if (profile.role === "admin") {
      feedbackRouter.push("/admin");
    } else if (profile.role === "organizer") {
      feedbackRouter.push("/organizer");
    } else {
      feedbackRouter.push("/");
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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Login succeeded but no user session was returned.");
      }

      await redirectAfterLogin(user.id);
    } catch (nextError: unknown) {
      const raw = getErrorMessage(nextError, "An error occurred during login.");
      const message = raw === "Invalid login credentials"
        ? "Invalid email or password. If you don\u2019t have an account, please sign up first."
        : raw;
      setStatus({ message, type: "error" });
      setPendingAction(null);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Sign in with Google or use your email and password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid gap-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void handleGoogle()}
              pending={pendingAction === "google"}
              pendingText="Connecting to Google..."
              disabled={pendingAction === "email"}
            >
              Continue with Google
            </Button>
          </div>

          <form
            onSubmit={handleLogin}
            aria-busy={isLoading}
            aria-describedby={status.message ? statusId : undefined}
          >
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <ProgressLink
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </ProgressLink>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
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
                className="w-full"
                pending={pendingAction === "email"}
                pendingText="Logging in..."
                disabled={pendingAction === "google"}
              >
                Login with email
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              Don&apos;t have an account?{" "}
              <ProgressLink
                href="/auth/sign-up"
                className="underline underline-offset-4"
              >
                Sign up
              </ProgressLink>
            </div>
          </form>
        </CardContent>
      </Card>

      <AlertDialog.Root open={pendingAction === "email"}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[90] bg-background/80 backdrop-blur-sm transition-all duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:animate-in data-[state=open]:fade-in" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[100] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 outline-none transition-all duration-300 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95">
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border/70 bg-background/95 p-8 shadow-[0_30px_90px_-32px_hsl(var(--shadow)/0.5)]">
              <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                <Spinner className="size-6 text-primary" />
              </div>
              <AlertDialog.Title className="text-xl font-semibold tracking-tight text-foreground">
                Signing in
              </AlertDialog.Title>
              <AlertDialog.Description className="text-center text-sm text-muted-foreground">
                Please wait while we verify your credentials and sign you in.
              </AlertDialog.Description>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
