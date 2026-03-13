"use client";

import { useState } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { isProfileComplete, PROFILE_SELECT_FIELDS } from "@/lib/auth/profile";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useFeedbackRouter } from "@/hooks/use-feedback-router";
import { useFormStatusRegion } from "@/hooks/use-form-status-region";
import { Button } from "@/components/ui/button";
import { FormStatusMessage } from "@/components/ui/feedback-states";
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

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
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

  const redirectAfterLogin = async (userId: string) => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT_FIELDS)
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    feedbackRouter.push(isProfileComplete(data) ? "/" : "/profile/complete");
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
        },
      });

      if (error) {
        throw error;
      }
    } catch (nextError: unknown) {
      setStatus({
        message:
          nextError instanceof Error
            ? nextError.message
            : "Unable to start Google login.",
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
      await supabase.auth.signOut({ scope: "local" });

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
      setStatus({
        message: nextError instanceof Error ? nextError.message : "An error occurred",
        type: "error",
      });
    } finally {
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
    </div>
  );
}
