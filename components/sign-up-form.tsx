"use client";

import { useState } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
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

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
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

  const handleGoogle = async () => {
    const supabase = getSupabaseClient();
    setPendingAction("google");
    setStatus({
      message: "Connecting you to Google registration...",
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
            : "Unable to start Google registration.",
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
      message: "Creating your account...",
      type: "pending",
    });

    if (password !== repeatPassword) {
      setStatus({
        message: "Passwords do not match",
        type: "error",
      });
      setPendingAction(null);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/profile/complete`,
        },
      });

      if (error) {
        throw error;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        feedbackRouter.push("/profile/complete");
        return;
      }

      setStatus({
        message: "Check your email to confirm your account, then finish your profile.",
        type: "success",
      });
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
          <CardTitle className="text-2xl">Sign up</CardTitle>
          <CardDescription>
            Register with Google or create an email and password.
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
            onSubmit={handleSignUp}
            aria-busy={isLoading}
            aria-describedby={status.message ? statusId : undefined}
          >
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="repeat-password">Repeat Password</Label>
                <Input
                  id="repeat-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={repeatPassword}
                  onChange={(event) => setRepeatPassword(event.target.value)}
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
                pendingText="Creating an account..."
                disabled={pendingAction === "google"}
              >
                Create account
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <ProgressLink href="/auth/login" className="underline underline-offset-4">
                Log in
              </ProgressLink>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
